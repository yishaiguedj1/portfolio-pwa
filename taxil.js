/* taxil.js — מנוע מרכז המס הישראלי של Invest (מחקר-שדרוג-Invest.md, קבוצה ד). טהור: בלי DOM, בלי רשת.
   שער האימות (01/11/2026, מול נוסח הפקודה, חוזר מ״ה 22/2002 וע״א 3555/15 מוזס — דנ״א 7517/16 נדחה):
   הכללים כאן אומתו; מקורות וציטוטים ב־docs/invest.md "מרכז המס". כלל שלא אומת = verified:false → דגל,
   והמסך מציג "הערכה". זה עדיין לא תחליף לרו״ח.
   קלטים: עסקאות Flex (ibkr-proxy/lib/ibkr.js → data.trades), תנועות מזומן (data.cashTransactions),
   ופונקציית שער fxOf(cur, 'YYYY-MM-DD') → שקלים למטבע (שער יציג ביום, או ביום הפרסום הקודם).
   כל הסכומים בשקלים, אלא אם כתוב אחרת. */

/* כללים לפי שנת מס — לא בקוד. ערך שלא אומת = verified:false (שער האימות). */
const TI_RULES = {
  base: {
    rate: 0.25,                 // 91(ב)(1), 125ב — רווח הון ריאלי ודיבידנד ליחיד (30% לבעל מניות מהותי — opts.sub, סימון ידני)
    surtax: { th: 721560, r: 0.03 },   // 121ב(א) — 721,560 ₪ ב־2024–2027
    capSurtax: null,            // 121ב(א1) — מ־2025
    // fourCase: 88 (שער המטבע הוא המדד — חובה ליחיד) + מוזס. N>0, D<0 → 0: דוגמה 2 של מוזס; N<0, D>0 → 0: נגזר מהמנגנון.
    // fifo: תקנה 5 לתקנות החישוב (2002) + "ניירות ערך זהים" (תקנה 1) — FIFO נפרד לכל חשבון. fees: דברי ההסבר ל־1325. offset: 92(א)(1),(3),(4), 92(ב).
    // creditCarry: 205א — עודף זיכוי עובר 5 שנים מול אותו מקור (הנוסח אומת, docs/tax-il-research.md). לא ודאי: שהמקור
    // הוא "דיבידנד מחו״ל" בלי קשר למדינה; ההצמדה למדד (מ־03/11/2026, opts.cpi) לפי המדד הידוע בסוף כל שנה. ניצול = הערכה.
    verified: { rate: true, fourCase: true, fifo: true, fees: true, offset: true, surtax: true, capSurtax: true, dividend: true, creditCarry: false },
  },
  2025: { capSurtax: { th: 721560, r: 0.02 } },   // 2% על ההכנסה ההונית בלבד שמעל אותו סף (1.1 מיליון — לא קיים בחוק)
  2026: { capSurtax: { th: 721560, r: 0.02 } },
};
function tiRules(year) {
  const b = TI_RULES.base, y = TI_RULES[year] || TI_RULES[Object.keys(TI_RULES).filter((k) => /^\d{4}$/.test(k) && +k <= year).sort().pop()] || {};
  return Object.assign({}, b, y, { verified: Object.assign({}, b.verified, y.verified || {}) });
}

function tiNum(v) { const n = Number(v); return isFinite(n) ? n : 0; }
function tiDate(d) { const s = String(d || '').slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''; }

/* עסקאות Flex → צורה אחידה, מהישנה לחדשה (תאריך, שעה, מזהה עסקה).
   02/11/2026 (שלבים 3–4, docs/tax-il-research.md): ערך כספי מ־tradeMoney/proceeds (כולל מכפיל — אופציות, אג״ח),
   ובהיעדרם כמות × מחיר × מכפיל. תאריך ההמרה = tradeDate. ביטול (BUY (Ca.) / TradeCancel / קוד Ca) מוחק את
   העסקה המקורית לפי origTradeID (G19). שורת assetCategory=CASH (המרת מט״ח) לא נכנסת — cash:true (G20). */
const TI_LOT_CODES = ['LI', 'HC', 'SL', 'ML', 'MLG', 'MLL', 'MSG', 'MSL'];   // שיטת התאמה שאינה FIFO (ח8)
const TI_DERIV = ['OPT', 'FUT', 'FOP', 'WAR', 'FSOPT', 'FSFOP'];
function tiNormTrades(trades) {
  const out = [], cancels = [];
  for (const t of (trades || [])) {
    if (!t || !t.symbol) continue;
    const date = tiDate(t.tradeDate) || tiDate(t.date), qtyS = tiNum(t.qty);
    if (!date || !qtyS) continue;
    const sideRaw = String(t.side || '').toUpperCase();
    const codes = String(t.notes || '').toUpperCase().split(/[;,\s]+/).filter(Boolean);
    const cancel = /\(CA/.test(sideRaw) || /CANCEL/i.test(String(t.transactionType || '')) || codes.includes('CA');
    const base = sideRaw.replace(/\s*\(.*$/, '');
    const side = base === 'BUY' || base === 'SELL' ? base : (qtyS > 0 ? 'BUY' : 'SELL');
    const cur = String(t.currency || 'USD').toUpperCase();
    const feeCur = String(t.commissionCurrency || cur).toUpperCase();
    const mult = tiNum(t.multiplier) > 0 ? tiNum(t.multiplier) : 1;
    const qty = Math.abs(qtyS);
    const money = Math.abs(tiNum(t.tradeMoney)) || Math.abs(tiNum(t.proceeds)) || qty * Math.abs(tiNum(t.price)) * mult;
    const r = {
      sym: String(t.symbol).trim().toUpperCase(), date: date, time: String(t.time || ''), id: String(t.tradeId || ''),
      side: side, qty: qty, price: Math.abs(tiNum(t.price)), money: money, mult: mult, cur: cur,
      fee: Math.abs(tiNum(t.commission)) + Math.abs(tiNum(t.taxes)), feeCur: feeCur,
      openClose: String(t.openClose || '').toUpperCase(),
      isin: String(t.isin || '').toUpperCase(), country: String(t.country || '').toUpperCase(),
      conid: String(t.conid || ''), account: String(t.account || ''),
      cash: String(t.asset || '').toUpperCase() === 'CASH',
      lotCode: codes.find((c) => TI_LOT_CODES.includes(c)) || '',
      // שלבים 10, 12: נגזרים (אופציה/חוזה עתידי), קריפטו, פתיחה/סגירה (מכירה בחסר), מימוש/הקצאה של אופציה
      deriv: TI_DERIV.includes(String(t.asset || '').toUpperCase()),
      crypto: String(t.asset || '').toUpperCase() === 'CRYPTO',
      oc: String(t.openClose || '').toUpperCase(),
    };
    r.optEx = r.deriv && (codes.includes('EX') || codes.includes('A'));
    r.under = String(t.underlying || '').trim().toUpperCase() || r.sym.split(/\s+/)[0];
    if (cancel) { r.orig = String(t.origTradeId || ''); cancels.push(r); } else out.push(r);
  }
  // ביטול: לפי origTradeID; בלי מזהה — העסקה התואמת הראשונה (סימבול, תאריך, כמות, מחיר)
  for (const c of cancels) {
    let i = c.orig ? out.findIndex((x) => x.id === c.orig) : -1;
    if (i < 0) i = out.findIndex((x) => x.sym === c.sym && x.date === c.date && Math.abs(x.qty - c.qty) < 1e-9 && Math.abs(x.price - c.price) < 1e-9);
    if (i >= 0) out.splice(i, 1);
  }
  // מפתח מנות (ח4): חשבון|conid — רק כשכל העסקאות של הסימבול נושאות אותם (אחרת נתונים ישנים יתפצלו → noLots)
  const full = new Map();
  for (const x of out) full.set(x.sym, (full.get(x.sym) !== false) && !!x.conid);
  const fullAcct = new Map();
  for (const x of out) fullAcct.set(x.sym, (fullAcct.get(x.sym) !== false) && !!x.account);
  for (const x of out) x.key = (fullAcct.get(x.sym) ? x.account + '|' : '') + (full.get(x.sym) ? 'c' + x.conid : x.sym);
  const idn = (s) => s.replace(/\D/g, '');
  out.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (a.time && b.time && a.time !== b.time) return a.time < b.time ? -1 : 1;
    const ia = idn(a.id), ib = idn(b.id);
    if (ia && ib && ia !== ib) return ia.length !== ib.length ? ia.length - ib.length : (ia < ib ? -1 : 1);
    return 0;
  });
  return out;
}

/* ארבעת המצבים: רווח בשקלים (gIls) מול רווח במטבע × שער המכירה (gFx).
   שניהם רווח → הנמוך; שניהם הפסד → ההפסד הקטן; סימנים שונים → 0. (verified.fourCase) */
function tiFourCase(gIls, gFx) {
  if (gIls > 0 && gFx > 0) return Math.min(gIls, gFx);
  if (gIls < 0 && gFx < 0) return Math.max(gIls, gFx);
  return 0;
}

/* מנוע המנות: FIFO לכל חשבון ונייר. עמלת קנייה נכנסת לעלות, עמלת מכירה יורדת מהתמורה (verified.fees);
   עמלה במטבע אחר מומרת בשער של יום העסקה (✗11). המרות מט״ח (CASH) — FIFO נפרד ב־fx: הפרש השער בשקלים,
   מוצג כ"פטור (דגל)" ולא נכנס לרווח ההון (G20).
   opts (02/11/2026, שלבים 7, 10, 12 — כולם "לא ודאי" ומסומנים):
   - corp: פעולות תאגידיות [{type, symbol, date, qty, proceeds, actionId, description}] (שלב 7): FS/RS/FI/IC/SD —
     רציפות (אותה עלות ואותו תאריך, כמות חדשה; SD = מניות הטבה, 94); DW — מכירה ב־0; כל השאר (SO/TC/TO…) —
     issue מסוג corpDecide, עד שהמשתמש מזין ב־alloc[gid] כמה אחוזים מהעלות עוברים למניות החדשות.
   - tin: העברות ניירות נכנסות/יוצאות [{id, symbol, date, qty, currency}] (ח9). נכנסת בלי tinCost[id]={cost, date}
     (עלות במטבע הנייר ותאריך הקנייה המקורי) → tinNoCost ובלי מנה. יוצאת → המנות יוצאות בלי מכירה.
   - אופציות (ח2): Ep → מכירה ב־0 (G17, כמו כל מכירה); Ex/A → הפרמיה עוברת לעסקת נכס הבסיס באותו יום.
   - מכירה בחסר (ח3): מכירה בלי מנות עם openClose=O → פוזיציית שורט; הכיסוי סוגר אותה (G31). בלי O → noLots כמו קודם.
   - cpi(date) → המדד הידוע ביום (03/11/2026): נייר שקלי לפי מדד המחירים (88). R = תמורה − עלות × max(1, מדד מכירה/מדד
     קנייה), והחייב = tiFourCase(N, R) — אותו מנגנון של מוזס: רווח ריאלי; רווח נומינלי שכולו אינפלציה → 0; הפסד →
     הנומינלי. בלי מדד — נומינלי ומסומן, כמו קודם. (לא ודאי: יום הפרסום, וההפסד הנומינלי — verified.cpiReal)
   מחזיר {open:[מנות פתוחות], sales:[חלקי מכירה], fx:[חלקי המרות מט״ח], issues:[בעיות נתונים]} */
/* נייר שקלי: החייב הריאלי לפי המדד הידוע. null — אין מדד לאחד התאריכים */
function tiReal(cost, proceeds, buyDate, sellDate, cpi) {
  const a = tiNum(cpi && cpi(buyDate)), b = tiNum(cpi && cpi(sellDate));
  if (!(a > 0) || !(b > 0)) return null;
  const real = proceeds - cost * Math.max(1, b / a);
  return { real: real, taxable: tiFourCase(proceeds - cost, real) };
}
const TI_CA_SCALE = ['FS', 'RS', 'FI', 'IC', 'SD'];
function tiCorpGroups(rows) {
  const g = new Map();
  for (const c of (rows || [])) {
    if (!c) continue;
    const type = String(c.type || '').toUpperCase(), date = tiDate(c.date), sym = String(c.symbol || '').trim().toUpperCase();
    if (!type || !date || !sym) continue;
    const gid = String(c.actionId || '').trim() || (date + '|' + type + '|' + String(c.description || '').slice(0, 24));
    const pm = String(c.description || '').match(/^\s*([A-Z0-9.]+)\s*\(/);
    const r = g.get(gid) || { gid: gid, type: type, date: date, rows: [], parent: pm ? pm[1] : '' };
    if (date < r.date) r.date = date;
    r.rows.push({ sym: sym, qty: tiNum(c.qty), proceeds: tiNum(c.proceeds) });
    g.set(gid, r);
  }
  return [...g.values()];
}
function tiFifo(trades, fxOf, opts) {
  const o = opts || {};
  const lots = new Map(), fxLots = new Map(), shorts = new Map(); // key -> [{...}]
  const sales = [], fxSales = [], issues = [], lotWarn = new Set(), once = new Set(), pend = new Map();
  const rate = (cur, d) => (cur === 'ILS' ? 1 : tiNum(fxOf && fxOf(cur, d)));
  const flag = (type, x) => { const k = type + '|' + x.sym; if (!once.has(k)) { once.add(k); issues.push(Object.assign({ type: type }, x)); } };
  const T = tiNormTrades(trades);
  const keysOf = new Map();
  for (const t of T) { if (!keysOf.has(t.sym)) keysOf.set(t.sym, []); if (!keysOf.get(t.sym).includes(t.key)) keysOf.get(t.sym).push(t.key); }
  const keyFor = (sym, old) => {
    const pre = old && old.includes('|') ? old.slice(0, old.indexOf('|') + 1) : '';
    const ks = keysOf.get(sym) || [];
    return ks.find((k) => pre && k.startsWith(pre)) || ks[0] || pre + sym;
  };
  const addLots = (key, arr) => { const q = (lots.get(key) || []).concat(arr); q.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)); lots.set(key, q); };
  const sale = (x) => { const r = Object.assign({ isin: '', country: '', nominal: false }, x); if (r.cur === 'ILS') ilsReal(r); sales.push(r); };
  // מכירה בשקלים: ריאלי לפי המדד הידוע כשיש לשני התאריכים (openDate — מכירה בחסר)
  const ilsReal = (r) => {
    const x = tiReal(r.cost, r.proceeds, r.openDate || r.buyDate, r.sellDate, o.cpi);
    if (x) { r.taxable = x.taxable; r.gReal = x.real; r.nominal = false; r.cpiReal = true; }
  };
  const ev = [];
  T.forEach((t, i) => ev.push({ d: t.date, r: t.optEx ? 2 : 3, i: i, t: t }));
  tiCorpGroups(o.corp).forEach((g, i) => ev.push({ d: g.date, r: 0, i: i, g: g }));
  (o.tin || []).forEach((x, i) => {
    const date = tiDate(x && x.date), sym = String((x && x.symbol) || '').trim().toUpperCase(), qty = tiNum(x && x.qty);
    if (date && sym && qty) ev.push({ d: date, r: 1, i: i, x: { id: String(x.id || ''), sym: sym, date: date, qty: qty, cur: String(x.currency || 'USD').toUpperCase() } });
  });
  ev.sort((a, b) => (a.d !== b.d ? (a.d < b.d ? -1 : 1) : a.r !== b.r ? a.r - b.r : a.i - b.i));
  for (const e of ev) {
    if (e.g) { tiCorpApply(e.g); continue; }
    if (e.x) { tiTransfer(e.x); continue; }
    const t = e.t;
    const fx = rate(t.cur, t.date);
    if (!(fx > 0)) { issues.push({ type: 'noFx', sym: t.sym, date: t.date, cur: t.cur }); continue; }
    let fee = t.fee;
    if (fee && t.feeCur !== t.cur) {
      const ff = rate(t.feeCur, t.date);
      if (ff > 0) fee = fee * ff / fx; else issues.push({ type: 'feeCur', sym: t.sym, date: t.date });
    }
    if (t.lotCode && !lotWarn.has(t.key)) { lotWarn.add(t.key); issues.push({ type: 'lotMethod', sym: t.sym, date: t.date, code: t.lotCode }); }
    const book = t.cash ? fxLots : lots, out = t.cash ? fxSales : sales;
    const q = book.get(t.key) || [], sq = shorts.get(t.key) || [];
    // ח2: מימוש/הקצאה — הפרמיה (בשקלים) עוברת לעסקת נכס הבסיס באותו יום: + עלות ששולמה, − פרמיה שהתקבלה
    if (t.optEx) {
      const long = t.side === 'SELL', from = long ? q : sq;
      let left = t.qty, ils = 0;
      while (left > 1e-9 && from.length) {
        const l = from[0], take = Math.min(left, l.qty);
        ils += take * l.unit * l.fx; l.qty -= take; left -= take;
        if (l.qty <= 1e-9) from.shift();
      }
      if (left > 1e-9) issues.push({ type: 'noLots', sym: t.sym, date: t.date, qty: left });
      const k = t.under + '|' + t.date;
      pend.set(k, (pend.get(k) || 0) + (long ? ils : -ils));
      flag('option', { sym: t.sym, date: t.date });
      continue;
    }
    let money = t.money;
    const pk = t.sym + '|' + t.date;
    if (pend.has(pk)) { const adj = pend.get(pk) / fx; pend.delete(pk); money = t.side === 'BUY' ? money + adj : money - adj; }
    const tag = { deriv: t.deriv || undefined, crypto: t.crypto || undefined };
    if (t.side === 'BUY') {
      let left = t.qty;
      const unit = (money + fee) / t.qty;
      // ח3: כיסוי שורט — התמורה מהמכירה בחסר מול עלות הכיסוי; D לפי שער המכירה (G31, לא ודאי)
      while (left > 1e-9 && sq.length) {
        const s0 = sq[0], take = Math.min(left, s0.qty);
        const proceeds = take * s0.unit, cost = take * unit;
        const gIls = proceeds * s0.fx - cost * fx, gFx = (proceeds - cost) * s0.fx;
        out.push(Object.assign({
          sym: t.sym, cur: t.cur, qty: take, buyDate: t.date, sellDate: t.date, openDate: s0.date, buyId: t.id, sellId: s0.id,
          isin: t.isin, country: t.country, cost: cost, proceeds: proceeds, fxBuy: fx, fxSell: s0.fx,
          costIls: cost * fx, proceedsIls: proceeds * s0.fx, gIls: gIls, gFx: gFx,
          taxable: t.cur === 'ILS' ? gIls : tiFourCase(gIls, gFx), nominal: t.cur === 'ILS', short: true,
        }, tag));
        if (t.cur === 'ILS') ilsReal(out[out.length - 1]);
        s0.qty -= take; left -= take;
        if (s0.qty <= 1e-9) sq.shift();
      }
      shorts.set(t.key, sq);
      if (left > 1e-9) q.push({ sym: t.sym, key: t.key, cur: t.cur, date: t.date, id: t.id, qty: left, unit: unit, fx: fx, qty0: left, isin: t.isin, country: t.country, deriv: t.deriv, crypto: t.crypto });
      book.set(t.key, q);
      continue;
    }
    // מכירה: מתאימים למנות הוותיקות קודם
    let left = t.qty;
    const unitNet = (money - fee) / t.qty;
    while (left > 1e-9 && q.length) {
      const lot = q[0];
      const take = Math.min(left, lot.qty);
      const cost = take * lot.unit, proceeds = take * unitNet;
      const gIls = proceeds * fx - cost * lot.fx;
      const gFx = (proceeds - cost) * fx;
      out.push(Object.assign({
        sym: t.sym, cur: t.cur, qty: take, buyDate: lot.date, sellDate: t.date, buyId: lot.id, sellId: t.id,
        isin: t.isin || lot.isin || '', country: t.country || lot.country || '',
        cost: cost, proceeds: proceeds, fxBuy: lot.fx, fxSell: fx,
        costIls: cost * lot.fx, proceedsIls: proceeds * fx,
        gIls: gIls, gFx: gFx, taxable: t.cash ? gIls : t.cur === 'ILS' ? gIls : tiFourCase(gIls, gFx),
        // נייר שקלי: ריאלי לפי המדד כשיש (ilsReal); בלי מדד — נומינלי ומסומן
        nominal: !t.cash && t.cur === 'ILS',
      }, tag));
      if (!t.cash && t.cur === 'ILS') ilsReal(out[out.length - 1]);
      lot.qty -= take;
      left -= take;
      if (lot.qty <= 1e-9) q.shift();
    }
    if (left > 1e-9 && !t.cash) {
      if (/O/.test(t.oc)) {
        sq.push({ sym: t.sym, date: t.date, id: t.id, qty: left, unit: unitNet, fx: fx });
        shorts.set(t.key, sq);
        flag('short', { sym: t.sym, date: t.date });
      } else issues.push({ type: 'noLots', sym: t.sym, date: t.date, qty: left });
    }
    book.set(t.key, q);
  }
  for (const k of pend.keys()) issues.push({ type: 'optOrphan', sym: k.split('|')[0], date: k.split('|')[1] });
  const open = [];
  for (const q of lots.values()) for (const l of q) if (l.qty > 1e-9) open.push(l);
  for (const q of shorts.values()) for (const s0 of q) if (s0.qty > 1e-9) issues.push({ type: 'shortOpen', sym: s0.sym, date: s0.date, qty: s0.qty });
  return { open: open, sales: sales, fx: fxSales, issues: issues };

  /* פעולה תאגידית (שלב 7). src = הנייר שיוצא (שורה שלילית) או היחיד; dst = הנייר החדש */
  function tiCorpApply(g) {
    const neg = g.rows.filter((r) => r.qty < 0), pos = g.rows.filter((r) => r.qty > 0);
    // הנייר שיוצא: שורה שלילית, האם מהתיאור ("PAR(ISIN) SPINOFF…"), או השורה שיש לה מנות
    const has = (sym) => [...lots.values()].some((q) => q.length && q[0].sym === sym);
    const cand = [neg[0] && neg[0].sym, g.parent].concat(g.rows.map((r) => r.sym)).filter(Boolean);
    const src = cand.find(has) || cand[0];
    const dstRow = pos.find((r) => r.sym !== src);
    const dst = dstRow ? dstRow.sym : src;
    const ents = [...lots.entries()].filter(([, q]) => q.length && q[0].sym === src);
    const held = ents.reduce((a, [, q]) => a + q.reduce((b, l) => b + l.qty, 0), 0);
    if (!(held > 1e-9)) { issues.push({ type: 'corpNoLots', sym: src, date: g.date, ca: g.type, gid: g.gid }); return; }
    if (g.type === 'DW') {   // מחיקה/חדלות: מכירה ב־0 ביום הפעולה
      for (const [k, q] of ents) {
        for (const l of q) {
          const fx = rate(l.cur, g.date) || l.fx, cost = l.qty * l.unit, gIls = -cost * l.fx, gFx = -cost * fx;
          sale({ sym: src, cur: l.cur, qty: l.qty, buyDate: l.date, sellDate: g.date, buyId: l.id, sellId: g.gid, isin: l.isin || '', country: l.country || '',
            cost: cost, proceeds: 0, fxBuy: l.fx, fxSell: fx, costIls: cost * l.fx, proceedsIls: 0, gIls: gIls, gFx: gFx,
            taxable: l.cur === 'ILS' ? gIls : tiFourCase(gIls, gFx), nominal: l.cur === 'ILS', corp: 'DW' });
        }
        lots.set(k, []);
      }
      flag('corp', { sym: src, date: g.date, ca: 'DW' });
      return;
    }
    const scale = TI_CA_SCALE.includes(g.type);
    const al = o.alloc && o.alloc[g.gid];
    if (!scale && (al == null || !dstRow)) { issues.push({ type: 'corpDecide', sym: src, dst: dstRow ? dst : '', date: g.date, ca: g.type, gid: g.gid }); return; }
    const pct = scale ? 1 : Math.min(1, Math.max(0, tiNum(al) / 100));
    const keep = g.type === 'SO';   // ספין־אוף: נייר האם נשאר, חלק מהעלות עובר לחדש
    const newQty = scale ? held + g.rows.filter((r) => r.sym === src || r.sym === dst).reduce((a, r) => a + r.qty, 0)
      : pos.filter((r) => r.sym === dst).reduce((a, r) => a + r.qty, 0);
    if (!(newQty > 1e-9)) { issues.push({ type: 'corpNoLots', sym: src, date: g.date, ca: g.type, gid: g.gid }); return; }
    const cash = scale || keep ? 0 : g.rows.reduce((a, r) => a + r.proceeds, 0);
    for (const [k, q] of ents) {
      const nk = dst === src ? k : keyFor(dst, k), moved = [];
      for (const l of q) {
        const share = l.qty / held, nq = newQty * share, cost = l.qty * l.unit;
        moved.push(Object.assign({}, l, { sym: dst, key: nk, qty: nq, qty0: nq, unit: cost * pct / nq, corp: g.type }));
        if (keep) { l.unit *= (1 - pct); continue; }
        if (pct < 1) {   // מיזוג/רכש עם מזומן: יתרת העלות מול המזומן — מכירה (לפי החלטת המשתמש)
          const fx = rate(l.cur, g.date) || l.fx, c2 = cost * (1 - pct), p2 = Math.abs(cash) * share;
          const gIls = p2 * fx - c2 * l.fx, gFx = (p2 - c2) * fx;
          sale({ sym: src, cur: l.cur, qty: l.qty, buyDate: l.date, sellDate: g.date, buyId: l.id, sellId: g.gid, isin: l.isin || '', country: l.country || '',
            cost: c2, proceeds: p2, fxBuy: l.fx, fxSell: fx, costIls: c2 * l.fx, proceedsIls: p2 * fx, gIls: gIls, gFx: gFx,
            taxable: l.cur === 'ILS' ? gIls : tiFourCase(gIls, gFx), nominal: l.cur === 'ILS', corp: g.type });
        }
      }
      if (!keep) lots.set(k, []);
      if (keep && dst === src) continue;
      if (dst === src) lots.set(k, moved); else addLots(nk, moved);
    }
    flag('corp', { sym: src, date: g.date, ca: g.type });
  }

  /* העברת ניירות (ח9) */
  function tiTransfer(x) {
    if (x.qty < 0) {   // יוצאת לחשבון אחר — לא מכירה
      let left = -x.qty;
      for (const [, q] of lots) {
        while (left > 1e-9 && q.length && q[0].sym === x.sym) { const l = q[0], take = Math.min(left, l.qty); l.qty -= take; left -= take; if (l.qty <= 1e-9) q.shift(); }
      }
      return;
    }
    const m = o.tinCost && o.tinCost[x.id];
    const cost = m ? tiNum(m.cost) : 0, date = (m && tiDate(m.date)) || x.date;
    if (!(cost > 0)) { issues.push({ type: 'tinNoCost', sym: x.sym, date: x.date, qty: x.qty, id: x.id }); return; }
    const fx = rate(x.cur, date);
    if (!(fx > 0)) { issues.push({ type: 'noFx', sym: x.sym, date: date, cur: x.cur }); return; }
    const k = keyFor(x.sym, '');
    addLots(k, [{ sym: x.sym, key: k, cur: x.cur, date: date, id: 'tin:' + x.id, qty: x.qty, qty0: x.qty, unit: cost / x.qty, fx: fx, isin: '', country: '', tin: true }]);
  }
}

/* דיבידנדים וניכוי במקור מתנועות המזומן של Flex. התיאור של IBKR: "AAPL(US0378331005) Cash Dividend ..."
   kind: dividend · interest (ריבית זכות) · interestPaid (ריבית מרווח/אג״ח ששולמה — לא מנוכה מההכנסות: 101א(ב)
   מטיל 30% על מי שתובע ניכוי ריבית, ולכן היא מוצגת כמידע בלבד). ניכוי במקור על ריבית — לפי התיאור. */
function tiDividends(cashTx, fxOf) {
  const m = new Map();
  for (const c of (cashTx || [])) {
    const type = String((c && c.type) || '');
    const isDiv = /dividend|payment in lieu/i.test(type);
    const isWh = /withholding/i.test(type);
    const isPaid = !isWh && /interest/i.test(type) && /paid/i.test(type);
    const isInt = /interest/i.test(type) && !isWh && !isPaid;
    // ח6: Advisor Fees ודמי משמורת → ניכוי (תקנה 6); שאר Other Fees (דמי נתונים) → דגל בלבד
    const isFee = /advisor fee|other fee/i.test(type);
    if (!isDiv && !isWh && !isInt && !isPaid && !isFee) continue;
    const date = tiDate(c.date), amt = tiNum(c.amount);
    if (!date || !amt) continue;
    const desc = String(c.description || '');
    const sm = desc.match(/^\s*([A-Z0-9.]+)\s*\(/);
    const im = desc.match(/\(([A-Z]{2})[A-Z0-9]{9}\d\)/);
    // ניכוי על ריבית זכות: בלי "SYM(ISIN" ועם "interest"/"INT" בתיאור
    const whInt = isWh && !im && /interest|\bINT\b/i.test(desc);
    const kind = isFee ? (/advisor/i.test(type) || /custod|adr/i.test(desc) ? 'mgmtFee' : 'dataFee')
      : isPaid ? 'interestPaid' : (isInt || whInt) ? 'interest' : 'dividend';
    const sym = kind === 'dividend' ? (sm ? sm[1] : '') : '';
    const cur = String(c.currency || 'USD').toUpperCase();
    // ✗5: דיבידנד, הניכוי שלו, ביטול ורישום מחדש — אירוע אחד לפי actionId, בשנה ובשער של התשלום המקורי (התאריך
    // המוקדם בקבוצה). בלי actionId (נתונים ישנים / השדה לא בשאילתה) — המפתח הישן: תאריך+סימבול+מטבע.
    const aid = String((c && c.actionId) || '').trim();
    const tag = kind === 'interestPaid' ? 'PAID' : kind === 'interest' ? 'INT' : kind === 'dividend' ? sym : kind.toUpperCase();
    const key = aid ? 'A|' + aid + '|' + kind + '|' + cur : date + '|' + tag + '|' + cur;
    const r = m.get(key) || { date: date, sym: sym, kind: kind, country: im ? im[1] : '', cur: cur, gross: 0, wh: 0 };
    if (isWh) r.wh += -amt; else r.gross += amt;     // ביטול ניכוי מגיע חיובי — מקטין את הניכוי
    if (!r.country && im) r.country = im[1];
    if (!r.sym && sym) r.sym = sym;
    if (date < r.date) r.date = date;
    if (aid) r.actionId = aid;
    m.set(key, r);
  }
  const out = [];
  for (const r of m.values()) {
    if (r.actionId && Math.abs(r.gross) < 1e-9 && Math.abs(r.wh) < 1e-9) continue;   // אירוע שבוטל כולו
    const fx = r.cur === 'ILS' ? 1 : tiNum(fxOf && fxOf(r.cur, r.date));
    r.fx = fx > 0 ? fx : null;
    r.grossIls = r.fx ? r.gross * r.fx : null;
    r.whIls = r.fx ? r.wh * r.fx : null;
    r.whRate = r.gross > 0 ? r.wh / r.gross : null;
    out.push(r);
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/* שנת מס: קיזוז, מס רווח הון, דיבידנד וזיכוי, מס יסף.
   opts.carry — הפסד מועבר משנים קודמות (חיובי, בשקלים); opts.other — הכנסה חייבת אחרת שאינה הונית (עבודה, עסק — למס
   יסף; null = לא ידוע); opts.otherCap — הכנסה הונית אחרת מחוץ ל־IBKR (שכבת ה־2%); opts.pool — מאגר עודף זיכוי
   [{y, src, amt}] משנים קודמות (205א).
   02/11/2026 (שלבים 8, 11, 12): opts.noOffInt — בלי קיזוז הפסד מול ריבית ממזומן (G32 מצב ב׳); opts.poolCg — המאגר
   (דיבידנד) גם מול מס רווח הון זר (205א(ב)); opts.fxTax + opts.fx — הפרשי שער על המרות מט״ח כרווח הון; opts.sub —
   סימבולים שבהם המשתמש בעל מניות מהותי (30%, ח10). דמי ניהול (mgmtFee) = הפסד הון של השנה (תקנה 6, G26).
   השוואות למידע בלבד: marginCmp (101א(ב), G28) ו־shortcut (5329ב, ח13). כל ההגדרות השנויות במחלוקת → דגל disputed. */
const TI_SRC = ['dividend', 'interest'];   // מקורות הכנסה לזיכוי (199, 204(ב)) — כל מקור בנפרד
function tiYear(year, sales, divs, opts) {
  const o = opts || {};
  const R = tiRules(year);
  const y = String(year);
  const inY = (s) => s.sellDate.slice(0, 4) === y;
  const ys = (sales || []).filter(inY).concat(o.fxTax ? (o.fx || []).filter(inY) : []);
  const yd = (divs || []).filter((d) => d.date.slice(0, 4) === y && d.grossIls != null && !d.exempt);
  let gains = 0, losses = 0;
  for (const s of ys) { if (s.taxable > 0) gains += s.taxable; else losses -= s.taxable; }
  const mgmtFee = -yd.filter((d) => d.kind === 'mgmtFee').reduce((a, d) => a + d.grossIls, 0);
  if (mgmtFee > 0) losses += mgmtFee;
  const src = {};
  for (const k of TI_SRC) {
    const L = yd.filter((d) => d.kind === k);
    src[k] = { gross: L.reduce((a, d) => a + d.grossIls, 0), wh: L.reduce((a, d) => a + d.whIls, 0), n: L.length };
  }
  // ניכוי מעל 25% בדיבידנד אמריקאי — מוחזר רק מה־IRS (האמנה, סעיף 12), לא נכנס למאגר
  const irsRefund = yd.filter((d) => d.kind === 'dividend' && d.country === 'US')
    .reduce((a, d) => a + Math.max(0, d.whIls - 0.25 * d.grossIls), 0);
  const marginInt = -yd.filter((d) => d.kind === 'interestPaid').reduce((a, d) => a + d.grossIls, 0);
  const carryIn = Math.max(0, tiNum(o.carry));
  let net = gains - losses, carryUsed = 0, carryOut = carryIn, offIncome = 0, taxable = 0;
  if (net >= 0) {
    carryUsed = Math.min(carryIn, net);
    taxable = net - carryUsed;
    carryOut = carryIn - carryUsed;
  } else {
    // הפסד שוטף: 92(א)(4) — "יקוזז" (חובה) גם כנגד ריבית/דיבידנד מני״ע באותה שנה (שיעור עד 25%).
    // קודם מול המקור שנוכה בו פחות מס בחו״ל — כך נשמר יותר זיכוי (סדר הקיזוז בבחירת הנישום; חוזר 10/2025, משני).
    // היתרה מועברת — 92(ב): רק כנגד רווח הון, בלי הגבלת שנים, בתנאי שהוגש דוח לשנת ההפסד.
    let left = -net;
    const ratio = (k) => (src[k].gross > 0 ? src[k].wh / src[k].gross : 0);
    for (const k of TI_SRC.slice().sort((a, b) => ratio(a) - ratio(b)).filter((k) => !(o.noOffInt && k === 'interest'))) {
      const use = Math.min(left, Math.max(0, src[k].gross));
      src[k].off = use; left -= use; offIncome += use;
    }
    carryOut = carryIn + left;
  }
  // ח10: בעל מניות מהותי — 30% על הרווח מאותם ניירות (ההפסדים מקוזזים קודם מול השאר — לטובת הנישום)
  const sub = new Set((o.sub || []).map((x) => String(x).toUpperCase()));
  const subGain = ys.filter((s) => sub.has(s.sym) && s.taxable > 0).reduce((a, s) => a + s.taxable, 0);
  const subDiv = yd.filter((d) => d.kind === 'dividend' && sub.has(d.sym)).reduce((a, d) => a + d.grossIls, 0);
  const cgTax = R.rate * taxable + 0.05 * Math.min(taxable, subGain);
  // זיכוי לכל מקור: עד המס הישראלי על אותו מקור (204(ב)); העודף → מאגר ל־5 שנים (205א); המאגר מנוצל מהוותיק
  const pool = (o.pool || []).filter((p) => p.amt > 0.005 && p.y >= +year - 5 && p.y < +year).map((p) => Object.assign({}, p));
  let israeliInc = 0, credit = 0, extraInc = 0, creditLost = 0, poolUsed = 0;
  for (const k of TI_SRC) {
    const S = src[k];
    S.tax = R.rate * Math.max(0, S.gross - (S.off || 0)) + (k === 'dividend' ? 0.05 * Math.max(0, Math.min(subDiv, S.gross - (S.off || 0))) : 0);
    S.credit = Math.min(Math.max(0, S.wh), S.tax);
    S.excess = Math.max(0, S.wh - S.credit);
    let due = S.tax - S.credit;
    S.poolUsed = 0;
    for (const p of pool.filter((q) => q.src === k).sort((a, b) => a.y - b.y)) {
      if (due <= 0.005) break;
      const u = Math.min(due, p.amt);
      p.amt -= u; due -= u; S.poolUsed += u;
    }
    S.extra = due;
    israeliInc += S.tax; credit += S.credit; extraInc += due; creditLost += S.excess; poolUsed += S.poolUsed;
  }
  const refundDiv = Math.min(irsRefund, src.dividend.excess);
  // 205א(ב) (הגדרה שנויה במחלוקת): יתרת המאגר מדיבידנד גם מול מס רווח הון על ניירות זרים
  let poolCg = 0;
  if (o.poolCg && cgTax > 0 && gains > 0) {
    const fg = ys.filter((s) => s.taxable > 0 && s.cur !== 'ILS').reduce((a, s) => a + s.taxable, 0);
    let room = cgTax * fg / gains;
    for (const p of pool.filter((q) => q.src === 'dividend').sort((a, b) => a.y - b.y)) {
      if (room <= 0.005) break;
      const u = Math.min(room, p.amt);
      p.amt -= u; room -= u; poolCg += u;
    }
    poolUsed += poolCg;
  }
  const poolOut = pool.filter((p) => p.amt > 0.005);
  for (const k of TI_SRC) {
    const add = src[k].excess - (k === 'dividend' ? refundDiv : 0);
    if (add > 0.005) poolOut.push({ y: +year, src: k, amt: add });
  }
  // מס יסף: 3% על כל ההכנסה החייבת מעל הסף; 2% על ההכנסה ההונית לבדה מעל אותו סף. בלי הסכום האינפלציוני
  // (החייב כאן כבר ריאלי). לא נכלל במקדמה החצי־שנתית — 121ב(ב).
  const incNet = TI_SRC.reduce((a, k) => a + Math.max(0, src[k].gross - (src[k].off || 0)), 0);
  const otherCap = Math.max(0, tiNum(o.otherCap));
  const capital = taxable + incNet + otherCap;
  const other = o.other == null ? null : Math.max(0, tiNum(o.other));
  const total = (other || 0) + capital;
  const s3 = R.surtax ? R.surtax.r * Math.max(0, total - R.surtax.th) : 0;
  const s2 = R.capSurtax ? R.capSurtax.r * Math.max(0, capital - R.capSurtax.th) : 0;
  const flags = [];
  for (const k of Object.keys(R.verified)) if (!R.verified[k] && (k !== 'creditCarry' || poolUsed > 0)) flags.push(k);
  if (other == null) flags.push('otherUnknown');
  if (ys.some((s) => s.nominal)) flags.push('nominalIls');
  if (marginInt > 0.5) flags.push('marginInt');
  if (mgmtFee > 0.5) flags.push('mgmtFee');
  if (yd.some((d) => d.kind === 'dataFee')) flags.push('dataFee');
  for (const f of ['deriv', 'short', 'crypto', 'corp', 'resEx', 'cpiReal']) if (ys.some((s) => s[f])) flags.push(f);
  if (sub.size && (subGain > 0 || subDiv > 0)) flags.push('sub');
  if (o.noOffInt || o.poolCg || o.fxTax) flags.push('disputed');
  // G28: ניכוי ריבית המרווח = 30% על הרווח פחות הריבית (101א(ב)), מול 25% בלי ניכוי. מידע בלבד, נומינלי
  const marginCmp = marginInt > 0.5 && taxable > 0 ? { no: R.rate * taxable, deduct: 0.30 * Math.max(0, taxable - marginInt) } : null;
  if (marginCmp) marginCmp.better = marginCmp.deduct < marginCmp.no - 0.005;
  // ח13: המסלול המקוצר (5329ב) — מס על המכירות הרווחיות בלבד, בלי קיזוז. השוואה בלבד (לא ודאי)
  const shortcut = ys.length ? R.rate * ys.reduce((a, s) => a + Math.max(0, s.taxable), 0) : null;
  const pick = (k) => ({ gross: src[k].gross, wh: src[k].wh, n: src[k].n, off: src[k].off || 0, tax: src[k].tax, credit: src[k].credit, excess: src[k].excess, poolUsed: src[k].poolUsed, extra: src[k].extra });
  return {
    year: +year, rate: R.rate, sales: ys.length,
    gains: gains, losses: losses, net: net, carryIn: carryIn, carryUsed: carryUsed, carryOut: carryOut,
    offIncome: offIncome, taxable: taxable, cgTax: cgTax,
    div: pick('dividend'), interest: pick('interest'),
    israeliInc: israeliInc, credit: credit, extraInc: extraInc,
    creditLost: creditLost,                 // כל העודף של השנה (לא "אבד": refund להחזר מה־IRS, השאר למאגר)
    irsRefund: refundDiv, poolIn: o.pool || [], poolUsed: poolUsed, poolOut: poolOut,
    poolAdded: creditLost - refundDiv, marginInt: marginInt, marginCmp: marginCmp, mgmtFee: Math.max(0, mgmtFee),
    poolCg: poolCg, shortcut: shortcut,
    surtax: s3 + s2, surtax3: s3, surtax2: s2, otherCap: otherCap,
    due: cgTax - poolCg + extraInc + s3 + s2, flags: flags,
  };
}

/* האופציות של שנה אחת מתוך ההגדרות של כל השנים */
function tiYearOpts(o, y, carry, pool) {
  return { carry: carry, pool: pool, cpi: o.cpi, other: (o.other || {})[y], otherCap: (o.otherCap || {})[y],
    noOffInt: !!o.noOffInt, poolCg: !!o.poolCg, fxTax: !!o.fxTax, fx: o.fx || [], sub: o.sub || [] };
}

/* ח11: עולה חדש / תושב חוזר ותיק — פטור 10 שנים מתאריך התושבות על נכס ועל הכנסה פסיבית מחו״ל (97(ב)(3), 14).
   מכירה בתוך התקופה → 0; מכירה אחריה של נכס שנקנה לפני סופה → ליניארי לפי ימים (G29). res = {date}. */
function tiResident(sales, divs, res) {
  const d0 = tiDate(res && res.date);
  if (!d0) return { sales: sales || [], divs: divs || [] };
  const end = (+d0.slice(0, 4) + 10) + d0.slice(4);
  const day = (a) => Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10)) / 86400000;
  const foreign = (x) => x.cur !== 'ILS' && x.country !== 'IL' && String(x.isin || '').slice(0, 2) !== 'IL';
  const S = (sales || []).map((s) => {
    if (!foreign(s) || s.sellDate < d0) return s;
    let ex = 0;
    if (s.sellDate < end) ex = 1;
    else if (s.buyDate < end) ex = (day(end) - day(s.buyDate)) / Math.max(1, day(s.sellDate) - day(s.buyDate));
    return ex ? Object.assign({}, s, { taxable: s.taxable * (1 - ex), resEx: s.taxable * ex }) : s;
  });
  const D = (divs || []).map((d) => (d.date >= d0 && d.date < end && d.country && d.country !== 'IL' ? Object.assign({}, d, { exempt: true }) : d));
  return { sales: S, divs: D };
}

/* כמה שנים ברצף: ההפסד המועבר זורם משנה לשנה */
function tiYears(sales, divs, opts) {
  const o = opts || {};
  const ys = new Set();
  for (const s of (sales || [])) ys.add(+s.sellDate.slice(0, 4));
  for (const d of (divs || [])) ys.add(+d.date.slice(0, 4));
  const list = [...ys].filter((y) => y > 1990).sort((a, b) => a - b);
  let carry = Math.max(0, tiNum(o.carry)), pool = [];
  const out = [];
  for (const y of list) {
    const r = tiYear(y, sales, divs, tiYearOpts(o, y, carry, pool));
    // ח15: הפסד של שנה שלא הוגש עליה דוח לא עובר (92(ב)) — ההפסד המועבר הוותיק ממשיך
    if ((o.filed || {})[y] === false) { const keep = r.carryIn - r.carryUsed; r.carryLost = Math.max(0, r.carryOut - keep); r.carryOut = Math.min(r.carryOut, keep); }
    carry = r.carryOut;
    // 205א: עודף הזיכוי צמוד למדד — מסוף שנה לסוף השנה הבאה (המדד הידוע; השנה הנוכחית — האחרון שפורסם)
    const c0 = tiNum(o.cpi && o.cpi(y + '-12-31')), c1 = tiNum(o.cpi && o.cpi((y + 1) + '-12-31'));
    const k = c0 > 0 && c1 > 0 ? Math.max(1, c1 / c0) : 1;
    pool = r.poolOut.map((p) => (k === 1 ? p : Object.assign({}, p, { amt: p.amt * k })));
    out.push(r);
  }
  return out;
}

/* דוח ומקדמה חצי־שנתיים — 91(ד)(2ג)(ב): עד 31/7 על המחצית הראשונה, עד 31/1 על השנה כולה פחות מה שכבר דווח.
   מצטבר: הפסד של המחצית הראשונה מקטין את מקדמת השנייה (ולא נעלם). בלי מס יסף (121ב(ב)) ובלי הפסד מועבר
   (קיזוזו בדיווח החצי־שנתי שנוי במחלוקת — docs/tax-il-research.md). מחזיר את הבסיס החייב, לא את המס. */
function tiSemi(sales, year) {
  const y = String(year);
  const sum = (a, b) => (sales || []).filter((s) => s.sellDate >= y + a && s.sellDate <= y + b).reduce((x, s) => x + s.taxable, 0);
  const n1 = sum('-01-01', '-06-30'), n2 = sum('-07-01', '-12-31');
  const h1 = Math.max(0, n1);
  return { n1: n1, n2: n2, h1: h1, h2: Math.max(0, n1 + n2 - h1) };
}

/* "המס אם אמכור היום": לכל מנה פתוחה — ארבעת המצבים מול מחיר ושער של היום.
   priceOf(sym) → מחיר במטבע הנייר; fxNow(cur) → שער היום. fee — עמלת מכירה משוערת למנה (במטבע) */
function tiUnrealized(open, priceOf, fxNow, fee, cpi) {
  const rows = [];
  for (const l of (open || [])) {
    const p = tiNum(priceOf && priceOf(l.sym));
    const fx = l.cur === 'ILS' ? 1 : tiNum(fxNow && fxNow(l.cur));
    if (!(p > 0) || !(fx > 0)) { rows.push(Object.assign({}, l, { missing: true })); continue; }
    const cost = l.qty * l.unit, proceeds = l.qty * p - tiNum(fee);
    const gIls = proceeds * fx - cost * l.fx, gFx = (proceeds - cost) * fx;
    rows.push(Object.assign({}, l, {
      price: p, fxNow: fx, value: l.qty * p * fx, gIls: gIls, gFx: gFx,
      fxPart: gIls - gFx,   // החלק שנבע מהשער (לא חייב, והפסד ממנו לא מתקזז)
      taxable: l.cur === 'ILS' ? gIls : tiFourCase(gIls, gFx), nominal: l.cur === 'ILS',
    }));
    if (l.cur === 'ILS') {
      const x = tiReal(cost, proceeds, l.date, '9999-12-31', cpi);   // המדד הידוע היום = האחרון בסדרה
      if (x) Object.assign(rows[rows.length - 1], { taxable: x.taxable, gReal: x.real, nominal: false, cpiReal: true });
    }
  }
  return rows;
}

/* קציר הפסדים: מנות שמכירתן היום יוצרת הפסד מוכר, ומה היה נחסך מול הרווח החייב שנשאר השנה.
   הפסד שכולו מירידת המטבע לא נוצר (ארבעת המצבים מחזירים 0). */
function tiHarvest(unreal, yearState) {
  const R = tiRules(yearState && yearState.year || new Date().getFullYear());
  let room = Math.max(0, tiNum(yearState && yearState.taxable));
  const c = (unreal || []).filter((u) => !u.missing && u.taxable < 0).sort((a, b) => a.taxable - b.taxable);
  // 92(א)(4): מה שלא מקזז רווח הון מקזז חובה דיבידנד/ריבית של השנה — ושם, אם נוכה מס בחו״ל, הזיכוי עובר למאגר (205א)
  let incRoom = Math.max(0, tiNum(yearState && yearState.div && yearState.div.gross) + tiNum(yearState && yearState.interest && yearState.interest.gross) - tiNum(yearState && yearState.offIncome));
  return c.map((u) => {
    const use = Math.min(-u.taxable, room);
    room -= use;
    const onInc = Math.min(-u.taxable - use, incRoom);
    incRoom -= onInc;
    return { sym: u.sym, date: u.date, qty: u.qty, loss: -u.taxable, saves: R.rate * use, onIncome: onInc, carry: -u.taxable - use - onInc };
  });
}

/* בריאות הנתונים: הכמות שהמנוע שחזר מהעסקאות מול האחזקות של IBKR (Flex). פער = חסרות עסקאות
   (היסטוריה חלקית, פיצול, העברת מניות) — וכל מספר המס של הסימבול לא אמין */
function tiCheck(open, positions) {
  const mine = new Map(), theirs = new Map();
  for (const l of (open || [])) mine.set(l.sym, (mine.get(l.sym) || 0) + l.qty);
  for (const p of (positions || [])) {
    const s = String((p && p.symbol) || '').toUpperCase();
    if (!s || /^(CASH|FX)/i.test(String(p.asset || ''))) continue;
    theirs.set(s, (theirs.get(s) || 0) + tiNum(p.qty));
  }
  const out = [];
  for (const s of new Set([...mine.keys(), ...theirs.keys()])) {
    const a = mine.get(s) || 0, b = theirs.get(s) || 0;
    if (Math.abs(a - b) > 1e-6) out.push({ sym: s, lots: a, broker: b, diff: b - a });
  }
  return out.sort((x, y) => (x.sym < y.sym ? -1 : 1));
}

/* W-8BEN: דיבידנד אמריקאי שנוכה בו יותר מ־25% (העודף לא מתקזז בישראל — רק החזר מה־IRS) */
function tiW8(divs) {
  return (divs || []).filter((d) => d.kind === 'dividend' && d.country === 'US' && d.whRate != null && d.whRate > 0.26)
    .map((d) => ({ date: d.date, sym: d.sym, rate: d.whRate, lostIls: d.grossIls != null ? d.grossIls * (d.whRate - 0.25) : null }));
}

/* שער ביום או ביום הפרסום הקודם — rows [['YYYY-MM-DD', rate]] ממוין (op:'boifx') */
function tiRateOn(rows, iso) {
  let lo = 0, hi = (rows || []).length - 1, ans = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (rows[mid][0] <= iso) { ans = rows[mid][1]; lo = mid + 1; } else hi = mid - 1;
  }
  return ans;
}

/* דוח לרו״ח (ד8) — טיוטה לשנה אחת: שורות 1325 (מכירה לכל חלק FIFO), סיכום 1322, דיבידנדים וריבית ל־1324.
   שורות בלבד — הכותרות והקובץ (CSV) בממשק (taxcenter.js), כדי שיהיו בשפת המשתמש. Y = tiYear של אותה שנה */
function tiReport(year, sales, divs, Y) {
  const y = String(year);
  const inY = (sales || []).filter((s) => s.sellDate.slice(0, 4) === y);
  // ח12: קריפטו — לא ב־1325; דיווח נפרד (1399) תוך 30 יום מכל מכירה
  const s1399 = inY.filter((s) => s.crypto).map((s) => ({ sym: s.sym, qty: s.qty, buyDate: s.buyDate, sellDate: s.sellDate, gIls: s.gIls, taxable: s.taxable }));
  const s1325 = inY.filter((s) => !s.crypto).map((s) => ({
    sym: s.sym, isin: s.isin || '', country: s.country || (s.isin ? s.isin.slice(0, 2) : ''), qty: s.qty,
    buyDate: s.buyDate, sellDate: s.sellDate, cur: s.cur, cost: s.cost, proceeds: s.proceeds, fxBuy: s.fxBuy, fxSell: s.fxSell,
    costIls: s.costIls, proceedsIls: s.proceedsIls, gIls: s.gIls, gFx: s.gFx, taxable: s.taxable, nominal: !!s.nominal,
  }));
  const s1324 = (divs || []).filter((d) => d.date.slice(0, 4) === y && (d.kind === 'dividend' || d.kind === 'interest') && !d.exempt);
  const byCountry = new Map();
  for (const d of s1324) {
    const k = (d.country || '—') + '|' + d.kind;
    const r = byCountry.get(k) || { country: d.country || '', kind: d.kind, grossIls: 0, whIls: 0, n: 0, missing: 0 };
    if (d.grossIls == null) r.missing++; else { r.grossIls += d.grossIls; r.whIls += d.whIls; }
    r.n++;
    byCountry.set(k, r);
  }
  const sum = Y ? {
    gains: Y.gains, losses: Y.losses, carryIn: Y.carryIn, carryUsed: Y.carryUsed, offIncome: Y.offIncome, taxable: Y.taxable,
    rate: Y.rate, cgTax: Y.cgTax, carryOut: Y.carryOut, incGross: Y.div.gross + Y.interest.gross, incWh: Y.div.wh + Y.interest.wh,
    credit: Y.credit, extraInc: Y.extraInc, creditLost: Y.creditLost, irsRefund: Y.irsRefund, poolUsed: Y.poolUsed,
    poolAdded: Y.poolAdded, marginInt: Y.marginInt, surtax: Y.surtax, due: Y.due,
  } : null;
  return { year: +year, s1325: s1325, s1399: s1399, s1324: s1324, s1324c: [...byCountry.values()].sort((a, b) => (a.country < b.country ? -1 : 1)), s1322: sum };
}

/* מד חשיפה למס עיזבון אמריקאי (ד10): שווי נכסים שמקורם בארה״ב מול הסף לזר שאינו תושב (60,000$).
   מקור: ISIN שמתחיל ב־US או מדינת המנפיק מ־Flex. בלי ISIN — ניחוש: נייר במטבע דולר שאינו ת״א (guess).
   המזומן ב־IBKR לא נכלל (מעמדו לא ודאי). המס המשוער: מדרגות §2001(c) פחות זיכוי של $13,000 לזר שאינו תושב (ח7, G30). */
const TI_ESTATE_TH = 60000;
const TI_ESTATE_BR = [[0, 0, 0.18], [10000, 1800, 0.20], [20000, 3800, 0.22], [40000, 8200, 0.24], [60000, 13000, 0.26],
  [80000, 18200, 0.28], [100000, 23800, 0.30], [150000, 38800, 0.32], [250000, 70800, 0.34], [500000, 155800, 0.37],
  [750000, 248300, 0.39], [1000000, 345800, 0.40]];
function tiEstateTax(usd) {
  const v = Math.max(0, tiNum(usd));
  let b = TI_ESTATE_BR[0];
  for (const x of TI_ESTATE_BR) if (v > x[0]) b = x;
  return Math.max(0, b[1] + b[2] * (v - b[0]) - 13000);
}
function tiEstate(positions, priceOf) {
  let usd = 0, guess = 0, n = 0;
  for (const p of (positions || [])) {
    if (!p || /^(CASH|FX)/i.test(String(p.asset || ''))) continue;
    const sym = String(p.symbol || '').toUpperCase();
    const isin = String(p.isin || '').toUpperCase(), ctry = String(p.country || '').toUpperCase();
    const cur = String(p.currency || '').toUpperCase();
    let us = false, g = false;
    if (isin || ctry) us = isin.slice(0, 2) === 'US' || (!isin && ctry === 'US');
    else if (cur === 'USD' && !/\.TA$/.test(sym)) { us = true; g = true; }
    if (!us || cur !== 'USD') continue;
    const px = tiNum(priceOf && priceOf(sym)) || tiNum(p.markPrice);
    const v = Math.abs(tiNum(p.qty)) * px;
    if (!(v > 0)) continue;
    usd += v; n++;
    if (g) guess += v;
  }
  return { usd: usd, n: n, guess: guess, th: TI_ESTATE_TH, over: usd > TI_ESTATE_TH, tax: tiEstateTax(usd) };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    TI_RULES, tiRules, tiNormTrades, tiFourCase, tiFifo, tiDividends, tiYear, tiYears,
    tiUnrealized, tiHarvest, tiCheck, tiSemi, TI_SRC, tiW8, tiRateOn, tiReport, tiEstate, TI_ESTATE_TH,
    tiEstateTax, tiCorpGroups, tiResident, tiYearOpts, tiReal,
  };
}
