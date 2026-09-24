/* =====================================================================
   returns.js — v112
   פארסר CSV של IBKR + מנוע תשואות. נבנה מאפס, בלי שום קוד מהמנוע הקודם.
   מודול טהור: אין DOM, אין localStorage, אין רשת — נבדק ב־node.

   עקרונות:
   1. לא משחזרים — קוראים. ה־TWR הרשמי של IBKR נקרא מהדוח ומשורשר
      (chain-link). חישוב עצמאי של TWR מתוך סכומים מצטברים שגוי מתמטית
      כשתזרימים מתרחשים באמצע התקופה — לכן אסור.
   2. כל מספר חייב להיסגר מול הזהות החשבונאית של IBKR:
      Ending = Starting + MTM + Flows + Dividends − Withholding ± Accruals − Fees
   3. כשנתון חסר — לא מנחשים. מחזירים null וה־UI מציג מקף + הסבר.
   ===================================================================== */
'use strict';

/* ---------------- עזרים ---------------- */

function rNum(v) {
  if (v === null || v === undefined) return NaN;
  const s = String(v).replace(/,/g, '').replace(/%/g, '').trim();
  if (!s || s === '--' || s === 'N/A') return NaN;
  const n = Number(s);
  return isFinite(n) ? n : NaN;
}

function rDate(s) {
  // 'YYYY-MM-DD' מתוך 'YYYY-MM-DD', 'YYYY-MM-DD, HH:MM:SS', 'MM/DD/YYYY'
  const t = String(s || '').trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (m) return m[1] + '-' + m[2] + '-' + m[3];
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(t);
  if (m) return m[3] + '-' + m[1].padStart(2, '0') + '-' + m[2].padStart(2, '0');
  return '';
}

function rValidDate(d) { return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : ''; }

/* isFinite מחמיר: isFinite(null) === true ב־JS — לא מתאים לנו. */
function fin(v) {
  if (v === null || v === undefined || v === '') return false;
  return isFinite(Number(v));
}

/* ---------------- טוקניזר CSV ----------------
   מטפל במרכאות, פסיקים בתוך שדות, גרשיים כפולים ("") ו־CRLF. */

function csvRows(text) {
  const src = String(text || '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQ) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\r') { /* מחכה ל־\n */ }
    else if (ch === '\n') { row.push(field); field = ''; rows.push(row); row = []; }
    else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ''));
}

/* ---------------- פיצול לסקשנים ----------------
   שורת Flex: [שם־סקשן, סוג־שורה, ...] כאשר סוג ∈ Header/Data/Total/SubTotal */

const ROW_KINDS = { HEADER: 1, DATA: 1, TOTAL: 1, SUBTOTAL: 1 };

function splitSections(rows) {
  const sections = {}; // name -> {header:[], rows:[{}]}
  const order = [];
  const plain = [];
  for (const r of rows) {
    if (r.length < 2) { plain.push(r); continue; }
    const kind = String(r[1] || '').trim().toUpperCase();
    if (!ROW_KINDS[kind]) { plain.push(r); continue; }
    const name = String(r[0] || '').replace(/^\uFEFF/, '').trim();
    if (!name) continue;
    if (!sections[name]) { sections[name] = { header: null, rows: [] }; order.push(name); }
    const sec = sections[name];
    const cells = r.slice(2);
    if (kind === 'HEADER') sec.header = cells.map((c) => String(c || '').trim());
    else if (kind === 'DATA') {
      const obj = {};
      const hdr = sec.header || [];
      for (let i = 0; i < cells.length; i++) obj[hdr[i] || ('col' + i)] = cells[i];
      obj._kind = kind;
      sec.rows.push(obj);
    }
    // TOTAL / SUBTOTAL נזרקים — סיכומים, לא נתונים
  }
  return { sections, order, plain };
}

/* ---------------- מיפוי Activity Statement ----------------
   הפורמט המדויק של דוח הפעילות כ־CSV (אומת מול קובץ אמיתי). */

const MONTHS = {
  january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
  july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
};

function parseStatementPeriod(s) {
  // '"September 29, 2023 - September 27, 2024"' -> ['2023-09-29','2024-09-27']
  const m = /([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})\s*-\s*([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/.exec(String(s || ''));
  if (!m) return ['', ''];
  const conv = (mo, d, y) => {
    const mm = MONTHS[String(mo).toLowerCase()];
    return mm ? y + '-' + mm + '-' + String(d).padStart(2, '0') : '';
  };
  return [conv(m[1], m[2], m[3]), conv(m[4], m[5], m[6])];
}

function kvSection(sec) {
  // סקשן מסוג Field Name / Field Value -> {שם: ערך}
  const out = {};
  for (const r of (sec && sec.rows) || []) {
    const k = String(r['Field Name'] || '').trim();
    if (k) out[k] = r['Field Value'];
  }
  return out;
}

function mapActivityStatement(sections) {
  const data = {
    meta: { fromDate: '', toDate: '', baseCurrency: 'USD', title: '' },
    trades: [], positions: [], cashTransactions: [],
    navPeriods: [], cashBalances: [],
  };
  const warnings = [];

  const st = kvSection(sections['Statement']);
  data.meta.title = st['Title'] || '';
  const [fd, td] = parseStatementPeriod(st['Period']);
  data.meta.fromDate = fd; data.meta.toDate = td;

  const ai = kvSection(sections['Account Information']);
  if (ai['Base Currency']) data.meta.baseCurrency = String(ai['Base Currency']).trim() || 'USD';

  // תקופת NAV: Change in NAV (ערכים) + TWR רשמי משורת האחוזים ב־Net Asset Value
  const cn = kvSection(sections['Change in NAV']);
  let twr = NaN;
  const navSec = sections['Net Asset Value'];
  if (navSec) {
    for (const r of navSec.rows) {
      const vals = Object.values(r).filter((v, i) => i > 0 || true);
      // שורת ה־TWR: ערכים בודדים עם % (למשל '18.795871983%')
      const keys = Object.keys(r).filter((k) => k !== '_kind');
      if (keys.length === 1) {
        const v = rNum(r[keys[0]]);
        if (String(r[keys[0]]).includes('%') && isFinite(v)) twr = v;
      }
    }
  }
  const sv = rNum(cn['Starting Value']), ev = rNum(cn['Ending Value']);
  const flows = rNum(cn['Deposits & Withdrawals']);
  if (isFinite(sv) || isFinite(ev)) {
    data.navPeriods.push({
      fromDate: fd, toDate: td,
      startingValue: isFinite(sv) ? sv : null,
      endingValue: isFinite(ev) ? ev : null,
      netFlows: isFinite(flows) ? flows : 0,
      twr: isFinite(twr) ? twr : null, // אחוז, כמו ש־IBKR מדווח
      source: 'ibkr',
    });
  }
  if (!isFinite(twr)) warnings.push('no-twr');

  // עסקאות: רק DataDiscriminator=Order (SubTotal/Total כבר נזרקו)
  const tr = sections['Trades'];
  if (tr) {
    for (const r of tr.rows) {
      if (String(r['DataDiscriminator'] || '').trim() !== 'Order') continue;
      const sym = String(r['Symbol'] || '').trim();
      const qty = rNum(r['Quantity']);
      const date = rDate(r['Date/Time']);
      if (!sym || !isFinite(qty) || qty === 0 || !rValidDate(date)) continue;
      data.trades.push({
        symbol: sym,
        date: date,
        qty: Math.abs(qty),
        side: qty > 0 ? 'BUY' : 'SELL',
        price: rNum(r['T. Price']),
        proceeds: rNum(r['Proceeds']),
        commission: Math.abs(rNum(r['Comm/Fee'])),
        realized: rNum(r['Realized P/L']),
        currency: String(r['Currency'] || '').trim() || 'USD',
        asset: String(r['Asset Category'] || '').trim(),
        tradeId: '',
        fxToBase: 1,
      });
    }
  }
  if (!data.trades.length) warnings.push('no-trades');

  // פוזיציות פתוחות: DataDiscriminator=Summary (אין LOT כפול בדוח פעילות)
  const op = sections['Open Positions'];
  if (op) {
    for (const r of op.rows) {
      if (String(r['DataDiscriminator'] || '').trim() !== 'Summary') continue;
      const sym = String(r['Symbol'] || '').trim();
      const qty = rNum(r['Quantity']);
      if (!sym || !isFinite(qty) || qty === 0) continue;
      data.positions.push({
        symbol: sym,
        qty: qty,
        asset: String(r['Asset Category'] || '').trim(),
        currency: String(r['Currency'] || '').trim() || 'USD',
        markPrice: rNum(r['Close Price']),
        marketValue: rNum(r['Value']),
        costBasis: rNum(r['Cost Basis']),
        unrealized: rNum(r['Unrealized P/L']),
        levelOfDetail: 'SUMMARY',
        fxToBase: 1,
      });
    }
  }
  if (!data.positions.length) warnings.push('no-positions');

  // תנועות מזומן
  const dw = sections['Deposits & Withdrawals'];
  if (dw) {
    for (const r of dw.rows) {
      const amt = rNum(r['Amount']);
      const date = rDate(r['Settle Date']);
      if (!isFinite(amt) || amt === 0 || !rValidDate(date)) continue;
      const desc = String(r['Description'] || '').trim();
      const isXfer = /transfer/i.test(desc);
      data.cashTransactions.push({
        date: date,
        amount: amt, // חיובי = נכנס (מוסכמת IBKR)
        currency: String(r['Currency'] || '').trim() || 'USD',
        fxToBase: 1,
        type: isXfer ? ('Transfer ' + (/out/i.test(desc) ? 'OUT' : 'IN')) : 'Deposits/Withdrawals',
        description: desc,
      });
    }
  }
  const dv = sections['Dividends'];
  if (dv) {
    for (const r of dv.rows) {
      const amt = rNum(r['Amount']);
      const date = rDate(r['Date']);
      if (!isFinite(amt) || amt === 0 || !rValidDate(date)) continue;
      data.cashTransactions.push({
        date: date, amount: amt,
        currency: String(r['Currency'] || '').trim() || 'USD',
        fxToBase: 1, type: 'Dividend',
        description: String(r['Description'] || '').trim(),
      });
    }
  }
  const wt = sections['Withholding Tax'];
  if (wt) {
    for (const r of wt.rows) {
      const amt = rNum(r['Amount']);
      const date = rDate(r['Date']);
      if (!isFinite(amt) || amt === 0 || !rValidDate(date)) continue;
      data.cashTransactions.push({
        date: date, amount: amt, // שלילי בדוח (מס ששולם)
        currency: String(r['Currency'] || '').trim() || 'USD',
        fxToBase: 1, type: 'Withholding Tax',
        description: String(r['Description'] || '').trim(),
      });
    }
  }

  // יתרות מזומן: Cash Report / Ending Cash / Base Currency Summary
  const cr = sections['Cash Report'];
  if (cr) {
    for (const r of cr.rows) {
      const keys = Object.keys(r).filter((k) => k !== '_kind');
      const label = String(r[keys[0]] || '').trim();
      const scope = String(r[keys[1]] || '').trim();
      if (/^ending cash$/i.test(label) && /base currency/i.test(scope)) {
        const bal = rNum(r[keys[3]]);
        if (isFinite(bal)) {
          data.cashBalances.push({ currency: data.meta.baseCurrency, balance: bal });
        }
      }
    }
  }

  return { data, warnings };
}

/* ---------------- מיפוי Flex Query (סובלני) ----------------
   עמודות ה־Flex נבחרות ע״י המשתמש — לכן המיפוי לפי כינויים,
   לא לפי שמות מדויקים. מוצא את הטוב ביותר ממה שיש. */

function pickCol(header, aliases) {
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z]/g, '');
  const hl = header.map(norm);
  for (const a of aliases) {
    const i = hl.indexOf(norm(a));
    if (i >= 0) return header[i];
  }
  return null;
}

function mapFlexQuery(sections) {
  const data = {
    meta: { fromDate: '', toDate: '', baseCurrency: 'USD', title: 'Flex Query' },
    trades: [], positions: [], cashTransactions: [],
    navPeriods: [], cashBalances: [],
  };
  const warnings = [];

  const tr = sections['Trades'];
  if (tr && tr.header) {
    const H = tr.header;
    const cSym = pickCol(H, ['Symbol']), cDate = pickCol(H, ['Date/Time', 'DateTime', 'TradeDate', 'Date']),
      cQty = pickCol(H, ['Quantity']), cPrice = pickCol(H, ['T. Price', 'TradePrice', 'Price']),
      cSide = pickCol(H, ['Buy/Sell', 'Side']), cComm = pickCol(H, ['Comm/Fee', 'IBCommission', 'Commission']),
      cCcy = pickCol(H, ['Currency']), cProc = pickCol(H, ['Proceeds']),
      cTid = pickCol(H, ['TradeID', 'TransactionID', 'IBOrderID']),
      cAsset = pickCol(H, ['Asset Category', 'AssetCategory', 'Asset Class']),
      cFx = pickCol(H, ['FX Rate to Base', 'FxRateToBase']),
      cDisc = pickCol(H, ['DataDiscriminator']);
    for (const r of tr.rows) {
      if (cDisc && String(r[cDisc] || '').trim() && String(r[cDisc]).trim() !== 'Order') continue;
      const sym = cSym ? String(r[cSym] || '').trim() : '';
      let qty = cQty ? rNum(r[cQty]) : NaN;
      const date = cDate ? rDate(r[cDate]) : '';
      if (!sym || !isFinite(qty) || qty === 0 || !rValidDate(date)) continue;
      let side = cSide ? String(r[cSide] || '').trim().toUpperCase() : '';
      if (side !== 'BUY' && side !== 'SELL') { side = qty > 0 ? 'BUY' : 'SELL'; qty = Math.abs(qty); }
      else qty = Math.abs(qty);
      data.trades.push({
        symbol: sym, date: date, qty: qty, side: side,
        price: cPrice ? rNum(r[cPrice]) : NaN,
        proceeds: cProc ? rNum(r[cProc]) : NaN,
        commission: cComm ? Math.abs(rNum(r[cComm])) : 0,
        realized: NaN,
        currency: cCcy ? (String(r[cCcy] || '').trim() || 'USD') : 'USD',
        asset: cAsset ? String(r[cAsset] || '').trim() : '',
        tradeId: cTid ? String(r[cTid] || '').trim() : '',
        fxToBase: cFx ? (rNum(r[cFx]) || 1) : 1,
      });
    }
  }

  const op = sections['Open Positions'];
  if (op && op.header) {
    const H = op.header;
    const cSym = pickCol(H, ['Symbol']), cQty = pickCol(H, ['Position', 'Quantity']),
      cAsset = pickCol(H, ['Asset Category', 'AssetCategory', 'Asset Class']),
      cCcy = pickCol(H, ['Currency']),
      cMp = pickCol(H, ['Mark Price', 'MarkPrice', 'Close Price']),
      cMv = pickCol(H, ['Position Value', 'PositionValue', 'Market Value', 'Value']),
      cCb = pickCol(H, ['Cost Basis Money', 'CostBasisMoney', 'Cost Basis']),
      cUn = pickCol(H, ['Fifo Pnl Unrealized', 'Unrealized']),
      cLod = pickCol(H, ['Level Of Detail', 'LevelOfDetail']),
      cFx = pickCol(H, ['FX Rate to Base', 'FxRateToBase']);
    for (const r of op.rows) {
      if (cLod && String(r[cLod] || '').trim() && String(r[cLod]).trim() !== 'SUMMARY') continue;
      const sym = cSym ? String(r[cSym] || '').trim() : '';
      const qty = cQty ? rNum(r[cQty]) : NaN;
      if (!sym || !isFinite(qty) || qty === 0) continue;
      data.positions.push({
        symbol: sym, qty: qty,
        asset: cAsset ? String(r[cAsset] || '').trim() : '',
        currency: cCcy ? (String(r[cCcy] || '').trim() || 'USD') : 'USD',
        markPrice: cMp ? rNum(r[cMp]) : NaN,
        marketValue: cMv ? rNum(r[cMv]) : NaN,
        costBasis: cCb ? rNum(r[cCb]) : NaN,
        unrealized: cUn ? rNum(r[cUn]) : NaN,
        levelOfDetail: cLod ? String(r[cLod] || '').trim() : 'SUMMARY',
        fxToBase: cFx ? (rNum(r[cFx]) || 1) : 1,
      });
    }
  }

  const cn = sections['Change in NAV'];
  if (cn && cn.header) {
    const H = cn.header;
    const cFrom = pickCol(H, ['From Date', 'FromDate']), cTo = pickCol(H, ['To Date', 'ToDate']),
      cStart = pickCol(H, ['Starting Value', 'StartingValue']),
      cEnd = pickCol(H, ['Ending Value', 'EndingValue']),
      cTwr = pickCol(H, ['TWR']),
      cFlow = pickCol(H, ['Deposits & Withdrawals', 'Deposits/Withdrawals', 'DepositsWithdrawals']);
    for (const r of cn.rows) {
      const twr = cTwr ? rNum(r[cTwr]) : NaN;
      const sv = cStart ? rNum(r[cStart]) : NaN, ev = cEnd ? rNum(r[cEnd]) : NaN;
      if (!isFinite(twr) && !isFinite(sv) && !isFinite(ev)) continue;
      data.navPeriods.push({
        fromDate: cFrom ? rDate(r[cFrom]) : '',
        toDate: cTo ? rDate(r[cTo]) : '',
        startingValue: isFinite(sv) ? sv : null,
        endingValue: isFinite(ev) ? ev : null,
        netFlows: cFlow ? (rNum(r[cFlow]) || 0) : 0,
        twr: isFinite(twr) ? twr : null,
        source: 'ibkr',
      });
    }
    data.navPeriods.sort((a, b) => (a.fromDate < b.fromDate ? -1 : 1));
  }

  const ctName = sections['Cash Transactions'] ? 'Cash Transactions'
    : sections['Deposits & Withdrawals'] ? 'Deposits & Withdrawals' : null;
  const ct = ctName && sections[ctName];
  if (ct && ct.header) {
    const H = ct.header;
    const cDate = pickCol(H, ['Date/Time', 'DateTime', 'Settle Date', 'Date']),
      cAmt = pickCol(H, ['Amount']), cCcy = pickCol(H, ['Currency']),
      cType = pickCol(H, ['Type']), cDesc = pickCol(H, ['Description']),
      cFx = pickCol(H, ['FX Rate to Base', 'FxRateToBase']);
    for (const r of ct.rows) {
      const amt = cAmt ? rNum(r[cAmt]) : NaN;
      const date = cDate ? rDate(r[cDate]) : '';
      if (!isFinite(amt) || amt === 0 || !rValidDate(date)) continue;
      data.cashTransactions.push({
        date: date, amount: amt,
        currency: cCcy ? (String(r[cCcy] || '').trim() || 'USD') : 'USD',
        fxToBase: cFx ? (rNum(r[cFx]) || 1) : 1,
        type: cType ? String(r[cType] || '').trim() : '',
        description: cDesc ? String(r[cDesc] || '').trim() : '',
      });
    }
  }

  if (!data.navPeriods.some((p) => fin(p.twr))) warnings.push('no-twr');
  if (!data.trades.length) warnings.push('no-trades');
  if (!data.positions.length) warnings.push('no-positions');
  return { data, warnings };
}

/* ---------------- נקודת כניסה: ibkrParseCsv ---------------- */

function ibkrParseCsv(text) {
  const rows = csvRows(text);
  if (!rows.length) return { ok: false, error: 'empty', data: null, warnings: ['empty'], stats: null };
  const { sections, order } = splitSections(rows);
  const names = Object.keys(sections);
  if (!names.length) return { ok: false, error: 'no-sections', data: null, warnings: ['no-sections'], stats: null };

  // זיהוי: Activity Statement = סקשן Statement במבנה Field Name/Field Value
  const st = sections['Statement'];
  const isActivity = !!(st && st.header &&
    st.header.some((h) => /field name/i.test(h)) &&
    st.rows.some((r) => /activity statement/i.test(String(r['Field Name'] === undefined ? '' : '') + String(Object.values(r)[1] || ''))));
  const mapped = isActivity ? mapActivityStatement(sections) : mapFlexQuery(sections);
  const d = mapped.data;
  const twrPeriods = d.navPeriods.filter((p) => fin(p.twr));
  const stats = {
    kind: isActivity ? 'activity' : 'flex',
    sections: order.length,
    trades: d.trades.length,
    positions: d.positions.length,
    cashTxs: d.cashTransactions.length,
    periods: d.navPeriods.length,
    twrPeriods: twrPeriods.length,
    fromDate: d.meta.fromDate || '',
    toDate: d.meta.toDate || '',
  };
  return { ok: true, data: d, warnings: mapped.warnings, stats: stats };
}

/* ---------------- מיזוג קבצים (טווח זמן חופשי) ----------------
   כמה דוחות (למשל שנתיים עוקבות) מתמזגים לאחד:
   עסקאות/תנועות מתאחדות עם מניעת כפילויות, פוזיציות ומזומן מהחדש ביותר,
   תקופות NAV נצברות וממוינות — ה־TWR המשורשר מכסה את כל הטווח. */

function tradeKey(t) {
  // מזהה יציב קודם לשדות — לא למחוק שתי עסקאות זהות לגיטימיות
  const id = String((t && (t.tradeId || t.id)) || '').trim();
  if (id) return 'id:' + id;
  return [t.date, t.symbol, t.qty, t.side, Math.round((Number(t.price) || 0) * 10000)].join('|');
}
function cashKey(c) {
  return [c.date, c.type, Math.round((Number(c.amount) || 0) * 100), (c.description || '').slice(0, 30)].join('|');
}

/* האם שתי תקופות חופפות (כולל מגע בקצוות)? */
function rPeriodsOverlap(a, b) {
  if (!a || !b || !a.fromDate || !a.toDate || !b.fromDate || !b.toDate) return false;
  return a.fromDate <= b.toDate && b.fromDate <= a.toDate;
}

/* מיזוג תקופות: תקופה חדשה מחליפה כל תקופה קיימת שהיא חופפת (עדכון —
   לא כפילות ולא ספירה כפולה של TWR). תקופות נפרדות נשמרות וממוינות. */
function rPeriodsEqual(a, b) {
  // תקופה זהה לחלוטין — אותו טווח ואותם ערכים רשמיים
  return a && b && a.fromDate === b.fromDate && a.toDate === b.toDate &&
    (a.startingValue ?? null) === (b.startingValue ?? null) &&
    (a.endingValue ?? null) === (b.endingValue ?? null) &&
    (a.netFlows ?? 0) === (b.netFlows ?? 0) &&
    (a.twr ?? null) === (b.twr ?? null);
}
function rMergePeriods(existing, incoming) {
  let out = (existing || []).slice();
  const replaced = [];
  for (const np of (incoming || [])) {
    // תקופה זהה לחלוטין שכבר קיימת — לא "מוחלפת", פשוט כפילות
    if (out.some((p) => rPeriodsEqual(p, np))) continue;
    for (const p of out) if (rPeriodsOverlap(p, np)) replaced.push(p);
    out = out.filter((p) => !rPeriodsOverlap(p, np));
    out.push(np);
  }
  out.sort((a, b) => (a.fromDate < b.fromDate ? -1 : a.fromDate > b.fromDate ? 1 : 0));
  return { periods: out, replaced: replaced };
}

/* תצוגה מקדימה של מיזוג: מה יתווסף, מה יוחלף, מה כבר קיים וידולג.
   לא משנה דבר — רק מדווח. */
/* ספירת מופעים לפי מפתח — בסיס לאיחוד מודע־מופעים. */
function countKeys(arr, keyFn) {
  const m = new Map();
  for (const x of (arr || [])) {
    const k = keyFn(x);
    m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
}

/* איחוד מודע־מופעים: לכל מפתח נשמר מספר המופעים המקסימלי מבין שני המקורות.
   לא מוחק כפילויות לגיטימיות (למשל שתי הפקדות זהות באותו יום),
   ולא מכפיל רשומה שכבר קיימת (ייבוא חוזר של אותו דוח). */
function unionCount(a, b, keyFn) {
  const ca = countKeys(a, keyFn), cb = countKeys(b, keyFn);
  const out = (a || []).slice();
  const have = countKeys(out, keyFn);
  for (const x of (b || [])) {
    const k = keyFn(x);
    const want = Math.max(ca.get(k) || 0, cb.get(k) || 0);
    const h = have.get(k) || 0;
    if (h < want) { have.set(k, h + 1); out.push(x); }
  }
  return out;
}

/* כמה מופעים חדשים יש ב־incoming לעומת existing (מודע־מופעים).
   מחזיר { added, dup }. */
function countNew(existing, incoming, keyFn) {
  const ce = countKeys(existing, keyFn), ci = countKeys(incoming, keyFn);
  let added = 0, dup = 0;
  for (const [k, cnt] of ci) {
    const a = Math.max(0, cnt - (ce.get(k) || 0));
    added += a; dup += cnt - a;
  }
  return { added: added, dup: dup };
}

function rMergePreview(oldData, newData) {
  const o = oldData || {}, n = newData || {};
  const mp = rMergePeriods(o.navPeriods, n.navPeriods);
  const addedPeriods = mp.periods.filter(
    (p) => !(o.navPeriods || []).some((q) => q.fromDate === p.fromDate && q.toDate === p.toDate));
  // עסקאות/תזרימים: מה כבר קיים לפי מפתח הזהות (מודע־מופעים)
  const tr = countNew(o.trades, n.trades, tradeKey);
  const cx = countNew(o.cashTransactions, n.cashTransactions, cashKey);
  return {
    addedPeriods: addedPeriods,
    replacedPeriods: mp.replaced,
    newTrades: tr.added,
    newCash: cx.added,
    dupTrades: tr.dup,
    dupCash: cx.dup,
  };
}

function rMergeData(a, b) {
  const A = a || {}, B = b || {};
  const trades = unionCount(A.trades, B.trades, tradeKey);
  const cashTransactions = unionCount(A.cashTransactions, B.cashTransactions, cashKey);
  const seenP = rMergePeriods(A.navPeriods, B.navPeriods);
  const navPeriods = seenP.periods;
  const mA = A.meta || {}, mB = B.meta || {};
  const fds = [mA.fromDate, mB.fromDate].filter(Boolean).sort();
  const tds = [mA.toDate, mB.toDate].filter(Boolean).sort();
  // פוזיציות/מזומן: מהדוח עם תאריך הסיום המאוחר ביותר (לא לפי סדר הבחירה)
  const bNewer = String(mB.toDate || '') >= String(mA.toDate || '');
  const posSrc = (bNewer && (B.positions || []).length) ? B
    : ((A.positions || []).length ? A : B);
  const cashSrc = (bNewer && (B.cashBalances || []).length) ? B
    : ((A.cashBalances || []).length ? A : B);
  return {
    meta: {
      fromDate: fds[0] || '', toDate: tds[tds.length - 1] || '',
      baseCurrency: mB.baseCurrency || mA.baseCurrency || 'USD',
      title: 'Merged IBKR reports',
    },
    trades: trades,
    positions: posSrc.positions || [],
    cashTransactions: cashTransactions,
    navPeriods: navPeriods,
    cashBalances: cashSrc.cashBalances || [],
  };
}

/* ---------------- תקופות NAV ממקור טוקן ----------------
   מאחד את שני המקורות למבנה אחד: [{fromDate,toDate,twr,...}].
   נתוני טוקן (פרוקסי): data.navHistory = [{fromDate,toDate,twr,...}]. */

function rNavPeriods(data) {
  const d = data || {};
  if ((d.navPeriods || []).length) {
    return d.navPeriods
      .filter((p) => p && (fin(p.twr) || fin(p.startingValue)))
      .map((p) => ({
        fromDate: String(p.fromDate || '').slice(0, 10),
        toDate: String(p.toDate || '').slice(0, 10),
        startingValue: fin(p.startingValue) ? Number(p.startingValue) : null,
        endingValue: fin(p.endingValue) ? Number(p.endingValue) : null,
        netFlows: Number(p.netFlows) || 0,
        twr: fin(p.twr) ? Number(p.twr) : null,
        source: 'ibkr',
      }))
      .sort((a, b) => (a.fromDate < b.fromDate ? -1 : 1));
  }
  const nh = d.navHistory || [];
  const out = [];
  for (const r of nh) {
    const twr = (r.twr === null || r.twr === undefined || r.twr === '') ? null : Number(r.twr);
    out.push({
      fromDate: String(r.fromDate || '').slice(0, 10),
      toDate: String(r.toDate || '').slice(0, 10),
      startingValue: fin(r.startingValue) ? Number(r.startingValue) : null,
      endingValue: fin(r.endingValue) ? Number(r.endingValue) : null,
      netFlows: 0,
      twr: (twr !== null && isFinite(twr)) ? twr : null,
      source: 'ibkr',
    });
  }
  // גם nav בודד (תקופת הדוח כולה) — אם אין פירוט
  if (!out.length && d.nav) {
    const n = d.nav;
    const twr = (n.twr === null || n.twr === undefined || n.twr === '') ? null : Number(n.twr);
    out.push({
      fromDate: String((d.meta || {}).fromDate || '').slice(0, 10),
      toDate: String((d.meta || {}).toDate || '').slice(0, 10),
      startingValue: fin(n.startingValue) ? Number(n.startingValue) : null,
      endingValue: fin(n.endingValue) ? Number(n.endingValue) : null,
      netFlows: 0,
      twr: (twr !== null && isFinite(twr)) ? twr : null,
      source: 'ibkr',
    });
  }
  return out.sort((a, b) => (a.fromDate < b.fromDate ? -1 : 1));
}

/* ---------------- המנוע: שרשור TWR רשמי ----------------
   TWR מצטבר = Π(1 + twr_i/100) − 1. twr_i באחוזים, כמו ש־IBKR מדווח.
   זו הדרך היחידה הנכונה — חישוב עצמאי מסכומים מצטברים שגוי כשתזרימים
   מתרחשים באמצע התקופה (אומת: 97.6% מחושב מול 18.80% רשמי). */

function rChainTwr(periods) {
  const ps = (periods || []).filter((p) => p && fin(p.twr));
  if (!ps.length) return null;
  let g = 1;
  for (const p of ps) {
    const r = Number(p.twr) / 100;
    if (!(r > -1) || !isFinite(r)) return null;
    g *= 1 + r;
  }
  if (!isFinite(g) || g <= 0) return null;
  return (g - 1) * 100;
}

/* סדרת מדד TWR לגרף: מתחילה ב־100 בתחילת התקופה הראשונה,
   כל נקודה = סוף תקופה עם הערך המשורשר עד אליה. */
function rTwrIndexSeries(periods) {
  const ps = (periods || []).filter((p) => p && fin(p.twr) && p.fromDate && p.toDate);
  if (!ps.length) return [];
  const out = [{ date: ps[0].fromDate, value: 100 }];
  let cum = 100;
  for (const p of ps) {
    cum *= 1 + Number(p.twr) / 100;
    if (!isFinite(cum) || cum <= 0) return [];
    out.push({ date: p.toDate, value: cum });
  }
  return out;
}

/* ---------------- רווח/הפסד כלכלי ----------------
   הזהות של IBKR (אומתה מול דוח אמיתי):
   Ending = Starting + MTM + Flows + Dividends − Withholding ± Accruals − Fees
   רווח = Σ(Ending − Starting − NetFlows) על פני התקופות. */

function rGain(data) {
  const ps = rNavPeriods(data).filter((p) =>
    fin(p.startingValue) && fin(p.endingValue));
  if (!ps.length) return null;
  let g = 0;
  for (const p of ps) g += p.endingValue - p.startingValue - (Number(p.netFlows) || 0);
  return isFinite(g) ? g : null;
}

/* ---------------- סכומי רכיבים (אגרגציה פשוטה — לא "חישוב") ---------------- */

function rSums(data) {
  const out = { realized: 0, unrealized: 0, dividends: 0, withholding: 0, commissions: 0, fees: 0 };
  const d = data || {};
  for (const t of (d.trades || [])) {
    const fx = Number(t.fxToBase) || 1;
    const rl = Number(t.realized);
    if (isFinite(rl)) out.realized += rl * fx;
    const cm = Number(t.commission);
    if (isFinite(cm)) out.commissions += Math.abs(cm) * fx;
  }
  for (const p of (d.positions || [])) {
    const fx = Number(p.fxToBase) || 1;
    const un = Number(p.unrealized);
    if (isFinite(un)) out.unrealized += un * fx;
  }
  for (const c of (d.cashTransactions || [])) {
    const fx = Number(c.fxToBase) || 1;
    const amt = Number(c.amount);
    if (!isFinite(amt)) continue;
    const type = String(c.type || '');
    if (/dividend/i.test(type) && !/withholding/i.test(type)) out.dividends += amt * fx;
    else if (/withholding/i.test(type)) out.withholding += amt * fx; // שלילי בדוח
    else if (/fee/i.test(type) && !/receiv/i.test(type)) out.fees += amt * fx;
  }
  return out;
}

/* ---------------- XIRR (מתמטיקה סטנדרטית) ----------------
   מוסכמת סימנים: כסף שיוצא מכיס המשקיע = שלילי, שנכנס = חיובי.
   התחלה והפקדות שליליים, משיכות וסיום חיוביים. */

function rXirrFlows(data) {
  const ps = rNavPeriods(data).filter((p) =>
    fin(p.startingValue) && fin(p.endingValue) && p.fromDate && p.toDate);
  if (!ps.length) return null;
  const start = ps[0], end = ps[ps.length - 1];
  const flows = [];
  if (start.startingValue > 0 && start.fromDate) flows.push({ d: start.fromDate, amt: -start.startingValue });
  for (const c of ((data && data.cashTransactions) || [])) {
    const type = String(c.type || ''), desc = String(c.description || '');
    const isFlow = /deposit|withdraw/i.test(type) || /^transfer (in|out)$/i.test(type.trim()) ||
      (/transfer/i.test(desc) && /deposit|withdraw|transfer/i.test(type));
    if (!isFlow) continue;
    const amt = Number(c.amount);
    const dt = String(c.date || '').slice(0, 10);
    if (!amt || !rValidDate(dt)) continue;
    const fx = Number(c.fxToBase) || 1;
    flows.push({ d: dt, amt: -(amt * fx) }); // הפקדה (חיובי בדוח) = כסף שיצא מהכיס
  }
  if (end.endingValue > 0 && end.toDate) flows.push({ d: end.toDate, amt: end.endingValue });
  flows.sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
  const hasNeg = flows.some((f) => f.amt < 0), hasPos = flows.some((f) => f.amt > 0);
  return (hasNeg && hasPos) ? flows : null;
}

function rXirr(flows) {
  if (!flows || flows.length < 2) return null;
  const t0 = Date.parse(flows[0].d);
  if (!isFinite(t0)) return null;
  const yrs = flows.map((f) => {
    const tt = Date.parse(f.d);
    return isFinite(tt) ? (tt - t0) / 31557600000 : NaN;
  });
  if (yrs.some((y) => !isFinite(y) || y < 0)) return null;
  const npv = (r) => flows.reduce((s, f, i) => s + f.amt / Math.pow(1 + r, yrs[i]), 0);
  const dnpv = (r) => flows.reduce((s, f, i) => s + f.amt * -yrs[i] / Math.pow(1 + r, yrs[i] + 1), 0);
  let r = 0.1;
  for (let i = 0; i < 100; i++) {
    const f = npv(r), dv = dnpv(r);
    if (!isFinite(f) || !isFinite(dv) || Math.abs(dv) < 1e-12) return null;
    const nr = r - f / dv;
    if (!isFinite(nr) || nr <= -0.9999) return null;
    if (Math.abs(nr - r) < 1e-9) return nr * 100;
    r = nr;
  }
  return null;
}

/* ---------------- בחירת מקור ----------------
   'official' — יש TWR רשמי של IBKR (ודאות מלאה).
   'nav' — יש ערכי NAV אבל בלי TWR (לא מחשבים TWR מסכומים — מחזירים null).
   'none' — אין נתוני ביצועים. */

function rSourceKind(data) {
  const ps = rNavPeriods(data);
  if (ps.some((p) => fin(p.twr))) return 'official';
  if (ps.some((p) => fin(p.startingValue) && fin(p.endingValue))) return 'nav';
  return 'none';
}

/* תשואת הכותרת: TWR רשמי משורשר על כל התקופות, או null (בלי ניחושים). */
function rHeadlineTwr(data) {
  if (rSourceKind(data) !== 'official') return null;
  return rChainTwr(rNavPeriods(data));
}

/* ייצוא ל־node (טסטים) */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    csvRows, splitSections, ibkrParseCsv, rMergeData, rMergePeriods, rMergePreview,
    rPeriodsOverlap, rPeriodsEqual, countKeys, unionCount, countNew, parseStatementPeriod,
    rNavPeriods, rChainTwr, rTwrIndexSeries, rGain, rSums, rXirrFlows, rXirr,
    rSourceKind, rHeadlineTwr, rNum, rDate,
  };
}
