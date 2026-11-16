/* התיק של ביל אקמן (פרשינג סקוור) — תיק הדמו של Invest (16/11/2026, בקשת המשתמש).
   מקור האמת: הדיווחים הציבוריים ל־SEC. חלק 1 (כאן): הפענוח — טהור ובלי רשת, כך שהבדיקות רצות על קבצים אמיתיים.
   - 13F-HR: טבלת המידע (infoTable) + דף השער (primary_doc.xml). מ־רבעון 2 2026 הדוח מוגש ע"י Pershing Square Inc.
     (CIK 2026053, החברה הציבורית שמעל חברת הניהול) ולא ע"י PSCM (CIK 1336528, שמגישה 13F-NT).
     בדוח של PS Inc. יש גם אחזקות של חברת הניהול עצמה (Pershing Square HHH Holdings / PSUS Holdings) — הן לא התיק
     של הקרנות ("התיק של המניות, לא חברת הניהול" — המשתמש) ולכן יוצאות לפי שם המנהל הכלול, לא לפי מספר.
   - Form 4 (XML): עסקאות מדויקות — תאריך, כמות, מחיר.
   - יחידות השווי ב־13F: מדוחות שהוגשו מ־3/1/2023 — דולרים; לפני כן — אלפי דולרים. */
'use strict';

const CIK = { pscm: '1336528', psinc: '2026053' };
const OWN_RE = /\b(HHH|PSUS)\s+Holdings\b/i;   // מאזן חברת הניהול — לא התיק של הקרנות

/* מסיר קידומות namespace (<ns1:x>, </n1:x>) — ה־XML של SEC משתמש בכמה צורות */
function unNs(xml) {
  return String(xml || '').replace(/<(\/?)[A-Za-z_][\w.-]*:/g, '<$1').replace(/\sxmlns(:\w+)?="[^"]*"/g, '');
}
function decode(s) {
  return String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, '\u00a0')
    .replace(/&#x([0-9a-f]{1,6});/gi, (m, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d{1,7});/g, (m, d) => String.fromCodePoint(+d))
    .replace(/&amp;/g, '&').trim();
}
/* הטקסט של התגית הראשונה בשם הזה בתוך הקטע */
function tagText(xml, tag) {
  const m = new RegExp('<' + tag + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + tag + '>').exec(xml);
  return m ? decode(m[1]) : '';
}
/* כל המופעים של תגית (כולל התוכן) */
function blocks(xml, tag) {
  const out = [], re = new RegExp('<' + tag + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + tag + '>', 'g');
  let m;
  while ((m = re.exec(xml))) out.push(m[1]);
  return out;
}
const num = (v) => {
  const n = parseFloat(String(v == null ? '' : v).replace(/[,$\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
/* "06-30-2026" / "2026-06-30" / "06/30/2026" → "2026-06-30" */
function isoDate(s) {
  const t = String(s || '').trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (m) return m[1] + '-' + m[2] + '-' + m[3];
  m = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(t);
  if (m) return m[3] + '-' + m[1].padStart(2, '0') + '-' + m[2].padStart(2, '0');
  return '';
}

/* ---------- 13F: דף השער ---------- */
function parse13fPrimary(xml) {
  const x = unNs(xml);
  const included = blocks(x, 'otherManager2').map((b) => ({
    n: tagText(b, 'sequenceNumber'), cik: tagText(b, 'cik').replace(/^0+/, ''), name: tagText(b, 'name'),
  }));
  const reporting = blocks(tagText(x, 'otherManagersInfo') ? x.slice(x.indexOf('<otherManagersInfo')) : '', 'otherManager')
    .map((b) => ({ cik: tagText(b, 'cik').replace(/^0+/, ''), name: tagText(b, 'name') }))
    .filter((o) => o.name);
  return {
    form: tagText(x, 'submissionType'),
    period: isoDate(tagText(x, 'reportCalendarOrQuarter') || tagText(x, 'periodOfReport')),
    filer: tagText(tagText(x, 'filingManager') ? x.slice(x.indexOf('<filingManager')) : '', 'name'),
    isAmendment: /^true$/i.test(tagText(x, 'isAmendment')),
    amendType: tagText(x, 'amendmentType'),          // 'RESTATEMENT' | 'NEW HOLDINGS' | ''
    reportType: tagText(x, 'reportType'),            // '13F HOLDINGS REPORT' | '13F NOTICE' | '13F COMBINATION REPORT'
    entryTotal: num(tagText(x, 'tableEntryTotal')),
    confidential: /^(true|y)/i.test(tagText(x, 'isConfidentialOmitted')),   // הושמטה אחזקה חסויה — ייתכן תיקון NEW HOLDINGS
    valueTotal: num(tagText(x, 'tableValueTotal')),
    included: included.filter((o) => o.n),
    reporting,
    note: tagText(x, 'additionalInformation'),
  };
}

/* ---------- 13F: טבלת המידע ---------- */
function parse13fTable(xml) {
  const x = unNs(xml);
  return blocks(x, 'infoTable').map((b) => {
    const sh = tagText(b, 'shrsOrPrnAmt') ? b.slice(b.indexOf('<shrsOrPrnAmt')) : '';
    return {
      name: tagText(b, 'nameOfIssuer'),
      cls: tagText(b, 'titleOfClass'),
      cusip: tagText(b, 'cusip').toUpperCase(),
      value: num(tagText(b, 'value')),
      shares: num(tagText(sh, 'sshPrnamt')),
      type: tagText(sh, 'sshPrnamtType'),
      pc: tagText(b, 'putCall').toUpperCase(),
      disc: tagText(b, 'investmentDiscretion'),
      mgr: tagText(b, 'otherManager'),
    };
  });
}

/* יחידת השווי לפי תאריך ההגשה (SEC: מ־3/1/2023 בדולרים) */
function valueUnit(filed) { return String(filed || '') >= '2023-01-03' ? 1 : 1000; }

/* השורות של הקרנות בלבד: מסיר שורה שאחד המנהלים שלה הוא כלי של חברת הניהול (HHH/PSUS Holdings) */
function fundRows(rows, primary) {
  const own = new Set((primary.included || []).filter((o) => OWN_RE.test(o.name)).map((o) => String(o.n)));
  if (!own.size) return rows.slice();
  return rows.filter((r) => !String(r.mgr || '').split(/[,\s]+/).some((k) => own.has(k)));
}

/* איחוד רבעון: הדוח המקורי + תיקונים לפי סדר ההגשה (NEW HOLDINGS מוסיף, RESTATEMENT מחליף).
   filings = [{form, filed, cik, primary, rows}] של אותו רבעון. מחזיר שורות מצטברות לפי (cusip, putCall), שווי בדולרים. */
function consolidateQuarter(filings) {
  let rows = [];
  const used = [];
  const list = (filings || []).slice().sort((a, b) => (a.filed < b.filed ? -1 : a.filed > b.filed ? 1 : 0));
  for (const f of list) {
    if (!f || /13F-NT/i.test(f.form || '') || !Array.isArray(f.rows)) continue;
    // Holdco לפני רבעון 2 2026: דוח של שורה אחת — מאזן חברת הניהול (9M HHH), לא הקרנות
    if (String(f.cik) === CIK.psinc && !(f.primary && (f.primary.included || []).length)) continue;
    const unit = valueUnit(f.filed);
    const mine = fundRows(f.rows, f.primary || {}).map((r) => Object.assign({}, r, { value: r.value * unit }));
    const amend = /\/A$/.test(f.form || '') || (f.primary && f.primary.isAmendment);
    if (!amend) rows = mine;
    else if (/NEW/i.test((f.primary && f.primary.amendType) || '')) rows = rows.concat(mine);
    else rows = mine;
    used.push(f.acc || '');
  }
  const agg = new Map();
  for (const r of rows) {
    const k = r.cusip + '|' + (r.pc || '');
    const a = agg.get(k) || { cusip: r.cusip, pc: r.pc || '', name: r.name, cls: r.cls, shares: 0, value: 0 };
    a.shares += r.shares; a.value += r.value;
    agg.set(k, a);
  }
  return { rows: [...agg.values()].sort((a, b) => b.value - a.value), acc: used };
}

/* ---------- Form 4 ---------- */
/* התוכן הפנימי של התגית הראשונה בשם הזה (בלי לפענח — כדי להמשיך לחפש בתוכו) */
function inner(xml, tag) {
  const m = new RegExp('<' + tag + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + tag + '>').exec(xml || '');
  return m ? m[1] : '';
}
/* ערך <value> של שדה, או null כשאין ערך (למשל מחיר שמופיע רק בהערת שוליים) */
function val(xml, tag) {
  const b = inner(xml, tag);
  if (!/<value>/.test(b)) return null;
  const v = tagText(b, 'value');
  return v === '' ? null : v;
}
/* עסקאות במניות (nonDerivativeTable) ובנגזרים (derivativeTable).
   code: P קנייה בשוק, S מכירה בשוק, J אחר (העברה/החלפה — ההסבר בהערת השוליים), A הקצאה, M מימוש, C המרה… */
function parseForm4(xml) {
  const x = unNs(xml);
  const owners = blocks(x, 'reportingOwner').map((b) => ({ cik: tagText(b, 'rptOwnerCik').replace(/^0+/, ''), name: tagText(b, 'rptOwnerName') }));
  const tx = (b, deriv) => {
    const amt = inner(b, 'transactionAmounts');
    const shares = val(amt, 'transactionShares'), price = val(amt, 'transactionPricePerShare');
    const after = val(inner(b, 'postTransactionAmounts'), 'sharesOwnedFollowingTransaction');
    const o = {
      deriv,
      security: val(b, 'securityTitle') || '',
      date: isoDate(val(b, 'transactionDate')),
      code: tagText(inner(b, 'transactionCoding'), 'transactionCode'),
      shares: shares == null ? null : num(shares),
      price: price == null ? null : num(price),
      ad: val(amt, 'transactionAcquiredDisposedCode') || '',
      after: after == null ? null : num(after),
      direct: val(inner(b, 'ownershipNature'), 'directOrIndirectOwnership') || '',
      footnoteIds: [...new Set((b.match(/footnoteId\s+id="(F\d+)"/g) || []).map((s) => s.replace(/.*"(F\d+)"/, '$1')))],
    };
    if (deriv) {
      const ex = val(b, 'conversionOrExercisePrice'), und = val(inner(b, 'underlyingSecurity'), 'underlyingSecurityShares');
      o.exercise = ex == null ? null : num(ex);
      o.underlying = und == null ? null : num(und);
      o.expires = isoDate(val(b, 'expirationDate'));
    }
    return o;
  };
  const nd = blocks(x, 'nonDerivativeTransaction').map((b) => tx(b, false));
  const dv = blocks(x, 'derivativeTransaction').map((b) => tx(b, true));
  const notes = {};
  const re = /<footnote\s+id="(F\d+)"\s*>([\s\S]*?)<\/footnote>/g;
  const fb = inner(x, 'footnotes');
  let m;
  while ((m = re.exec(fb))) notes[m[1]] = decode(m[2]).replace(/\s+/g, ' ');
  return {
    form: tagText(x, 'documentType'),
    period: isoDate(tagText(x, 'periodOfReport')),
    issuer: { cik: tagText(x, 'issuerCik').replace(/^0+/, ''), name: tagText(x, 'issuerName'), ticker: tagText(x, 'issuerTradingSymbol').toUpperCase() },
    owners,
    tx: nd.concat(dv),
    notes,
  };
}

/* ---------- Schedule 13D / 13G (XML, מאז 12/2024) ---------- */
/* המנפיק, תאריך האירוע וכמה מניות לכל מדווח. מסננים לפי המנפיק ולא לפי המגיש: ה־13G/A של 11/2026, למשל,
   עוסק במניות של Pershing Square Inc. עצמה (בעלי המניות של חברת הניהול) — לא בתיק של הקרנות.
   13G: eventDateRequiresFilingThisStatement / issuerCusipNumber / classPercent; ‏13D: dateOfEvent / issuerCUSIP / percentOfClass */
function parse13dg(xml) {
  const x = unNs(xml);
  const pick = (src, tags) => { for (const t of tags) { const v = tagText(src, t); if (v !== '') return v.trim(); } return ''; };
  const head = inner(x, 'coverPageHeader') || x;
  const issuer = {
    cik: pick(head, ['issuerCik', 'issuerCIK']).replace(/^0+/, ''),
    name: pick(head, ['issuerName']),
    cusip: pick(head, ['issuerCusipNumber', 'issuerCUSIP', 'issuerCusip']).toUpperCase(),
  };
  const persons = blocks(x, 'coverPageHeaderReportingPersonDetails').concat(blocks(x, 'reportingPersonInfo')).map((b) => ({
    name: pick(b, ['reportingPersonName']),
    shares: num(pick(b, ['reportingPersonBeneficiallyOwnedAggregateNumberOfShares', 'aggregateAmountOwned'])),
    pct: num(pick(b, ['classPercent', 'percentOfClass'])),
  })).filter((p) => p.name);
  return {
    form: pick(x, ['submissionType']),
    event: isoDate(pick(head, ['eventDateRequiresFilingThisStatement', 'dateOfEvent'])),
    amendment: pick(head, ['amendmentNo']),
    issuer,
    persons,
    shares: persons.reduce((m, p) => Math.max(m, p.shares || 0), 0),
    pct: persons.reduce((m, p) => Math.max(m, p.pct || 0), 0),
  };
}

/* "April 30, 2026" / "Apr. 30, 2026" / "4/30/2026" / "2026-04-30" → "2026-04-30" */
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
function anyDate(s) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  const iso = isoDate(t);
  if (iso) return iso;
  const m = /^([A-Za-z]{3})[a-z]*\.? (\d{1,2}),? (\d{4})$/.exec(t);
  if (m && MONTHS[m[1].toLowerCase()]) return m[3] + '-' + String(MONTHS[m[1].toLowerCase()]).padStart(2, '0') + '-' + m[2].padStart(2, '0');
  return '';
}

/* נספח "Trading Data" של 13D (סעיף 5(c) — כל העסקאות של 60 הימים האחרונים): טבלת HTML עם שם הקרן, תאריך,
   קנייה/מכירה, כמות, מחיר ליחידה וסוג הנייר. מחזיר את כל השורות; deriv:true לחוזה Forward / אופציה / swap —
   מחוץ לתיק המניות (וגם מחוץ ל־13F). שורה שלא מתאימה לכותרת (מספר תאים אחר) — לא נכנסת (שמרני). */
function parseTradingData(htmlText) {
  const out = [];
  const trs = String(htmlText || '').match(/<tr[\s\S]*?<\/tr>/gi) || [];
  let cols = null, width = 0;
  for (const tr of trs) {
    const raw = (tr.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) || []).map((c) => decode(c.replace(/<[^>]+>/g, ' ')).replace(/[\s\u00a0]+/g, ' ').trim());
    const cells = [];
    for (const c of raw) {
      if (!c) continue;
      if ((c === ')' || c === '%') && cells.length) { cells[cells.length - 1] += c; continue; }
      if (cells.length && /^[$(]$/.test(cells[cells.length - 1])) { cells[cells.length - 1] += c; continue; }
      cells.push(c);
    }
    if (!cells.length) continue;
    const low = cells.map((c) => c.toLowerCase());
    if (low.some((c) => /date/.test(c)) && low.some((c) => /shares|quantity/.test(c))) {
      const at = (re, not) => low.findIndex((c) => re.test(c) && !(not && not.test(c)));
      cols = { name: at(/name|fund|entity|account/), date: at(/date/, /expir/), side: at(/buy|sell|nature|transaction type/), qty: at(/shares|quantity/),
        price: at(/unit cost|price per|^price|cost per/, /strike/), sec: at(/security|instrument/) };
      width = cells.length;
      if (cols.date < 0 || cols.qty < 0 || cols.price < 0) cols = null;
      continue;
    }
    if (!cols || cells.length !== width) continue;
    const date = anyDate(cells[cols.date]);
    const qty = num(cells[cols.qty].replace(/[()]/g, ''));
    const price = num(cells[cols.price]);
    if (!date || !(qty > 0) || !(price > 0)) continue;
    const sideTxt = cols.side >= 0 ? cells[cols.side] : '';
    const sell = /sell|sale|dispos/i.test(sideTxt) || /^\(/.test(cells[cols.qty]);
    const sec = cols.sec >= 0 ? cells[cols.sec] : 'Common Stock';
    out.push({ fund: cols.name >= 0 ? cells[cols.name] : '', date, qty: sell ? -qty : qty, price, security: sec,
      deriv: /forward|option|swap|call|put|warrant|future/i.test(sec) || !/common|ordinary|share|stock|class [a-c]\b/i.test(sec) });
  }
  return out;
}

module.exports = { CIK, OWN_RE, unNs, decode, tagText, blocks, inner, isoDate, anyDate, parse13fPrimary, parse13fTable, valueUnit, fundRows, consolidateQuarter, parseForm4, parse13dg, parseTradingData };
