/* מחולל הספר של תיק אקמן (16/11/2026) — מהדיווחים הציבוריים לחשבון שלם בצורת דוח IBKR.
   טהור ובלי רשת: מקבל רבעונים (13F), עסקאות מדויקות (Form 4 / 13D), פעולות תאגידיות ומחירים — ומחזיר
   { meta, trades, positions, cashTransactions, navHistory, navDaily, cashBalances, ackman } כמו statementOne של lib/ibkr.js,
   כך שהאפליקציה מציגה אותו בדיוק כמו חשבון אמיתי (תשואה, דיבידנדים, עמלות, מס במקור, הפקדות).
   עקרונות (המחקר המלא: docs/ackman-research.md):
   1. ה־13F הוא מקור האמת לכמויות: בסוף כל רבעון הכמות של כל מניה בחשבון = בדיוק הכמות בדיווח.
   2. עסקה מדויקת (תאריך, כמות, מחיר מדיווח עסקה) גוברת. מה שנשאר מההפרש בין הרבעונים — עסקה נאמדת אחת למניה ברבעון,
      במחיר הממוצע המשוקלל במחזור (VWAP) של הרבעון, ביום המסחר שהסגירה שלו הכי קרובה לממוצע (כדי שהשווי היומי לא "יקפוץ").
   3. מזומן: קנייה שאין לה מזומן — הפקדה באותו יום (הון חדש שנכנס לתיק המניות); בסוף כל רבעון המזומן שנשאר יוצא במשיכה
      (חוזר לשאר נכסי הקרנות). כך השווי בסוף כל רבעון = שווי ה־13F.
   4. דיבידנד נרשם ביום האקס (בלי קפיצה בשווי היומי), על הכמות שהוחזקה בסוף היום הקודם; מס במקור לפי מדינת המנפיק והשנה.
   5. כל רשומה מסומנת: est=true לאומדן, src למקור. */
'use strict';

const r2 = (x) => Math.round(x * 100) / 100;
const r6 = (x) => Math.round(x * 1e6) / 1e6;

/* ---------- מחירים ---------- */
/* סדרה גולמית מתוצאת chart של Yahoo: Yahoo מתאים מחירים, מחזור ודיבידנדים לספליטים (וגם ל"ספליטים" מדומים של ספינאוף)
   שאחרי התאריך — מבטלים את ההתאמה כדי לקבל את המחיר שנסחר באמת באותו יום. */
function seriesFromYahoo(j) {
  const r = j && j.chart && j.chart.result && j.chart.result[0];
  if (!r || !Array.isArray(r.timestamp)) return null;
  const q = (r.indicators && r.indicators.quote && r.indicators.quote[0]) || {};
  const ev = r.events || {};
  const off = Number((r.meta && r.meta.gmtoffset) || 0);
  const day = (t) => new Date((Number(t) + off) * 1000).toISOString().slice(0, 10);
  const splits = Object.values(ev.splits || {}).map((s) => [day(s.date), Number(s.numerator) / Number(s.denominator)])
    .filter((s) => s[1] > 0).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const fAfter = (d) => { let f = 1; for (const s of splits) if (s[0] > d) f *= s[1]; return f; };
  const d = [], c = [], h = [], l = [], v = [];
  for (let i = 0; i < r.timestamp.length; i++) {
    const cl = (q.close || [])[i];
    if (!(cl > 0)) continue;
    const dt = day(r.timestamp[i]);
    const f = fAfter(dt);
    if (d.length && d[d.length - 1] === dt) { d.pop(); c.pop(); h.pop(); l.pop(); v.pop(); }
    d.push(dt);
    c.push(r6(cl * f));
    h.push(r6(((q.high || [])[i] > 0 ? q.high[i] : cl) * f));
    l.push(r6(((q.low || [])[i] > 0 ? q.low[i] : cl) * f));
    v.push(Math.round(((q.volume || [])[i] || 0) / f));
  }
  const div = Object.values(ev.dividends || {}).map((x) => [day(x.date), r6(Number(x.amount) * fAfter(day(x.date)))])
    .filter((x) => x[1] > 0).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  return { d, c, h, l, v, div, splits, cur: String((r.meta && r.meta.currency) || 'USD').toUpperCase() };
}

/* האינדקס של יום המסחר האחרון שלא אחרי date (או -1) */
function idxOnOrBefore(s, date) {
  let lo = 0, hi = s.d.length - 1, ans = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (s.d[m] <= date) { ans = m; lo = m + 1; } else hi = m - 1; }
  return ans;
}
function closeOn(s, date, maxBack) {
  if (!s) return null;
  const i = idxOnOrBefore(s, date);
  if (i < 0) return null;
  if (maxBack != null && (Date.parse(date) - Date.parse(s.d[i])) / 86400000 > maxBack) return null;
  return s.c[i];
}
/* VWAP של החלון (from, to] — מחיר טיפוסי (גבוה+נמוך+סגירה)/3 משוקלל במחזור; והיום שהסגירה שלו הכי קרובה אליו */
function vwapWindow(s, from, to) {
  if (!s) return null;
  let a = 0, b = 0, n = 0;
  const idx = [];
  for (let i = Math.max(0, idxOnOrBefore(s, from)); i < s.d.length && s.d[i] <= to; i++) {
    if (s.d[i] <= from) continue;
    const tp = (s.h[i] + s.l[i] + s.c[i]) / 3, w = s.v[i] > 0 ? s.v[i] : 1;
    a += tp * w; b += w; n++; idx.push(i);
  }
  if (!n) return null;
  const px = a / b;
  let best = idx[0];
  for (const i of idx) if (Math.abs(s.c[i] - px) < Math.abs(s.c[best] - px)) best = i;
  return { vwap: px, date: s.d[best], close: s.c[best], days: n };
}

/* ---------- עזר ---------- */
/* ISIN מ־CUSIP: קידומת מדינה + CUSIP + ספרת ביקורת (Luhn על הספרות אחרי המרת אותיות ל־10..35) */
function isinFrom(cusip, cc) {
  const body = String(cc || 'US').toUpperCase() + String(cusip || '').toUpperCase();
  if (!/^[A-Z]{2}[0-9A-Z]{9}$/.test(body)) return '';
  const digits = body.split('').map((ch) => (/[0-9]/.test(ch) ? ch : String(ch.charCodeAt(0) - 55))).join('');
  let sum = 0;
  for (let i = digits.length - 1, dbl = true; i >= 0; i--, dbl = !dbl) {
    let d = Number(digits[i]);
    if (dbl) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return body + String((10 - (sum % 10)) % 10);
}
/* יחס כטקסט: 1.5 → "3 FOR 2", 50 → "50 FOR 1", 0.1 → "1 FOR 10", 1/9 → "1 FOR 9" */
function fmtRatio(r) {
  for (let d = 1; d <= 20; d++) { const n = r * d; if (Math.abs(n - Math.round(n)) < 1e-6) return Math.round(n) + ' FOR ' + d; }
  return String(Math.round(r * 1e6) / 1e6) + ' FOR 1';
}
function addDays(iso, n) { const t = new Date(iso + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); }
function midDate(a, b) { return new Date((Date.parse(a) + Date.parse(b)) / 2).toISOString().slice(0, 10); }
/* יום חול (שני–שישי) לא אחרי התאריך */
function weekdayOnOrBefore(iso) { let d = iso; for (let k = 0; k < 7; k++) { const w = new Date(d + 'T00:00:00Z').getUTCDay(); if (w > 0 && w < 6) return d; d = addDays(d, -1); } return iso; }

/* שיעור מס במקור: params.wht = { US: [[fromYear, rate],…], CA: […], … } — הערך האחרון שהשנה שלו לא אחרי שנת הדיבידנד */
function whtRate(params, country, date) {
  const t = (params.wht || {})[country] || (params.wht || {}).default || [];
  const y = Number(String(date).slice(0, 4));
  let r = 0;
  for (const [from, rate] of t) if (y >= from) r = rate;
  return r;
}

/* ---------- הבנייה ---------- */
/* input:
   quarters: [{ period, filed, acc: [...], rows: [{ sym, shares, value, pc, cusip, name }] }] — שורות הקרנות בלבד, ממוינות לפי תקופה
   exact:    [{ date, sym, qty (+קנייה / −מכירה), price, src, url, note }]
   actions:  [{ date, type: 'split', sym, ratio } | { date, type: 'spinoff', sym, to, ratio, px? } | { date, type: 'merger', sym, to?, ratio?, cash? }]
   px:       { SYM: series (seriesFromYahoo) }
   info:     { SYM: { name, country: 'US'|'CA'|…, cur } }
   params:   { dailyFrom, asOf, commission: { perShare }, wht: {...}, fees: [{ date, amount, desc }] } */
function buildBook(input) {
  const quarters = (input.quarters || []).slice().sort((a, b) => (a.period < b.period ? -1 : 1));
  const params = input.params || {};
  const px = input.px || {};
  const info = input.info || {};
  const actions = (input.actions || []).slice().sort((a, b) => (a.date < b.date ? -1 : 1));
  const exact = (input.exact || []).slice().sort((a, b) => (a.date < b.date ? -1 : 1));
  const perShare = (params.commission && params.commission.perShare != null) ? params.commission.perShare : 0.01;
  const asOf = params.asOf || quarters[quarters.length - 1].period;
  const warn = [];

  /* לוח ימי המסחר (SPY); כל אירוע נצמד ליום המסחר האחרון שלא אחריו — כדי שתזרים לא "ייפול" על סופ"ש מחוץ לשרשור היומי */
  const cal = (px.SPY && px.SPY.d) || null;
  const tday = (d) => { if (!cal) return weekdayOnOrBefore(d); const i = idxOnOrBefore(px.SPY, d); return i >= 0 ? cal[i] : d; };

  /* מחיר ידוע ל"מניה בלי נתונים": המחירים המשתמעים מה־13F (שווי/כמות) בסוף כל רבעון — ביום המסחר של סוף הרבעון */
  const implied = {};
  for (const q of quarters) for (const r of q.rows) if (r.shares > 0 && r.value > 0) (implied[r.sym] = implied[r.sym] || []).push([tday(q.period), r.value / r.shares]);
  const marks = params.marks || {};   // { SYM: [[date, price], …] } — למניה בלי נתונים (למשל ספינאוף שנמכר מיד)
  const markOn = (sym, date) => {
    const s = px[sym];
    const c = s ? closeOn(s, date, 10) : null;
    if (c != null) return c;
    let mk = null;
    for (const [d, p] of (marks[sym] || [])) if (d <= date) mk = p;
    if (mk == null && (marks[sym] || []).length) mk = marks[sym][0][1];
    if (mk != null) return mk;
    const im = implied[sym] || [];
    let best = null;
    for (const [d, p] of im) { if (d <= date) best = p; }
    if (best == null && im.length) best = im[0][1];
    return best;
  };
  /* מכפלת הספליטים האמיתיים של המניה בחלון (from, to] */
  const splitF = (sym, from, to) => {
    let f = 1;
    for (const a of actions) if (a.type === 'split' && a.sym === sym && a.date > from && a.date <= to) f *= a.ratio;
    return f;
  };

  /* --- שלב 1: רשימת אירועים מתוזמנים (עסקאות, פעולות תאגידיות) --- */
  const ev = [];   // { date, k: 'trade'|'ca'|'sweep', ... , ord }
  let tradeSeq = 0;
  const pushTrade = (t) => { ev.push(Object.assign({ k: 'trade', ord: 2, id: ++tradeSeq }, t)); };

  // סימולציה של כמויות לפי רבעונים, כדי לחשב את השארית שצריך לאמוד
  let held = {};   // sym → כמות אחרי הרבעון הקודם (ביחידות של סוף הרבעון הקודם)
  let prevPeriod = null;
  const qMeta = [];
  for (let qi = 0; qi < quarters.length; qi++) {
    const q = quarters[qi];
    const from = prevPeriod || addDays(q.period, -92);
    const to = q.period;
    const target = {};
    for (const r of q.rows) target[r.sym] = (target[r.sym] || 0) + r.shares;
    // כמויות מדומות: ההחזקה הקודמת → פעולות תאגידיות → עסקאות מדויקות
    const sim = Object.assign({}, held);
    for (const a of actions) {
      if (!(a.date > from && a.date <= to)) continue;
      const q0 = sim[a.sym] || 0;
      if (a.type === 'split') sim[a.sym] = Math.floor(q0 * a.ratio + 1e-6);
      else if (a.type === 'spinoff' && q0 > 0) sim[a.to] = (sim[a.to] || 0) + Math.floor(q0 * a.ratio);
      else if (a.type === 'merger' && q0 > 0) { if (a.to) sim[a.to] = (sim[a.to] || 0) + Math.floor(q0 * (a.ratio || 0)); sim[a.sym] = 0; }
    }
    const simCa = Object.assign({}, sim);   // הרבעון הקודם אחרי פעולות תאגידיות — הבסיס ל"מה השתנה" (ספליט/ספינאוף הם לא קנייה)
    const exQ = exact.filter((x) => x.date > from && x.date <= to);
    for (const x of exQ) sim[x.sym] = (sim[x.sym] || 0) + x.qty * splitF(x.sym, x.date, to);
    for (const x of exQ) pushTrade({ date: tday(x.date), sym: x.sym, qty: x.qty, price: x.price, est: !!x.est, src: x.src || 'SEC', url: x.url || '', note: x.note || '' });
    // שארית → עסקה נאמדת
    const syms = new Set([...Object.keys(sim), ...Object.keys(target)]);
    for (const sym of syms) {
      const want = target[sym] || 0, have = sim[sym] || 0;
      const resid = Math.round(want - have);
      if (!resid) continue;
      const s = px[sym];
      let date, price, how;
      // חלון: כל הרבעון — אבל לא לפני פעולה תאגידית שיצרה את המניה ולא אחרי מיזוג שהוציא אותה; לרבעון הראשון — היום האחרון
      let wFrom = from, wTo = to;
      for (const a of actions) {
        if (!(a.date > from && a.date <= to)) continue;
        if (a.to === sym && a.date > wFrom) wFrom = addDays(a.date, -1);
        if (a.sym === sym && a.type === 'merger' && a.date <= wTo) wTo = addDays(a.date, -1);
      }
      const w = (qi === 0) ? null : vwapWindow(s, wFrom, wTo);
      if (w) { date = w.date; price = w.close; how = 'vwap'; }
      else {
        // בלי נתוני מחיר: מחיר משתמע מה־13F (סוף הרבעון הקודם ו/או הנוכחי, ביחידות של היום שנבחר)
        const p1 = (q.rows.find((r) => r.sym === sym && r.shares > 0) || null);
        const prevQ = qi > 0 ? quarters[qi - 1] : null;
        const p0 = prevQ ? (prevQ.rows.find((r) => r.sym === sym && r.shares > 0) || null) : null;
        if (qi === 0) date = tday(to);
        else date = tday(midDate(addDays(wFrom, 1), wTo));
        const a1 = p1 ? p1.value / p1.shares * splitF(sym, date, to) : null;
        const a0 = p0 ? p0.value / p0.shares / splitF(sym, from, date) : null;
        price = (a0 != null && a1 != null) ? (a0 + a1) / 2 : (a1 != null ? a1 : a0);
        if (qi === 0 && s) { const c = closeOn(s, to, 10); if (c != null) { price = c; date = s.d[idxOnOrBefore(s, to)]; } }
        how = (qi === 0) ? 'open' : 'implied';
      }
      if (!(price > 0)) { const mk = markOn(sym, date); if (mk > 0) { price = mk; how = 'mark'; } }
      if (!(price > 0)) { warn.push('אין מחיר ל־' + sym + ' ברבעון ' + to); continue; }
      const f = splitF(sym, date, to);
      if (f === 1) { pushTrade({ date, sym, qty: resid, price: r6(price), est: true, how, src: '13F', period: to }); continue; }
      // לפני ספליט באותו רבעון: כמות שלמה ביחידות של אז, והשארית (פחות ממנה אחת לפני הספליט) — אחרי הספליט, ביום האחרון
      const qPre = Math.trunc(resid / f), rem = Math.round(resid - qPre * f);
      if (qPre) pushTrade({ date, sym, qty: qPre, price: r6(price), est: true, how, src: '13F', period: to });
      if (rem) { const dl = tday(to), pl = markOn(sym, dl); if (pl > 0) pushTrade({ date: dl, sym, qty: rem, price: r6(pl), est: true, how: 'close', src: '13F', period: to }); }
    }
    held = target;
    // h — האחזקות כפי שדווחו ([סימבול, מניות, שווי $]); d — מה השתנה מול הרבעון הקודם ([סימבול, מ־, ל־], אחרי פעולות
    // תאגידיות, ביחידות של היום) — לחלונות "מה השתנה" ו"הסיפור" באפליקציה
    const d = [];
    if (qi > 0) for (const sym of new Set([...Object.keys(simCa), ...Object.keys(target)])) {
      const a = Math.round(simCa[sym] || 0), b = target[sym] || 0;
      if (a !== b) d.push([sym, a, b]);
    }
    qMeta.push(Object.assign({ period: q.period, filed: q.filed, acc: q.acc || [], total: q.rows.reduce((t, r) => t + r.value, 0), n: q.rows.length,
      h: q.rows.map((r) => [r.sym, r.shares, r.value]).sort((a, b) => b[2] - a[2]), d },
      (q.calls || []).length ? { calls: q.calls } : {}, (q.puts || []).length ? { puts: q.puts } : {}, q.co ? { co: 1 } : {}));
    prevPeriod = to;
    ev.push({ k: 'sweep', date: tday(to), period: to, ord: 9 });
  }
  // אחרי הדיווח האחרון: עסקאות מדויקות (Form 4 / 13D) ופעולות תאגידיות עד היום
  for (const x of exact) if (x.date > prevPeriod && x.date <= asOf) pushTrade({ date: tday(x.date), sym: x.sym, qty: x.qty, price: x.price, est: !!x.est, src: x.src || 'SEC', url: x.url || '', note: x.note || '' });
  for (const a of actions) if (a.date > quarters[0].period && a.date <= asOf) ev.push(Object.assign({ k: 'ca', ord: 1 }, a, { date: tday(a.date) }));

  ev.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.ord - b.ord || (a.id || 0) - (b.id || 0)));

  /* --- שלב 2: ריצה כרונולוגית — מזומן, מנות (FIFO), דיבידנדים, שווי --- */
  const pos = {};          // sym → { qty, lots: [{ qty, cost }] } — cost כולל עמלה
  let cash = 0;
  const trades = [], cashTx = [], navDaily = [], taxEvents = [], realizedCa = [];
  const caAlloc = {};
  let txSeq = 0;
  const tx = (date, amount, type, desc, extra) => { if (!amount) return; cashTx.push(Object.assign({ date, amount: r2(amount), currency: 'USD', fxToBase: 1, type, description: desc, actionId: 'A' + (++txSeq) }, extra || {})); };
  const P = (sym) => (pos[sym] = pos[sym] || { qty: 0, lots: [] });
  const fees = (params.fees || []).slice().sort((a, b) => (a.date < b.date ? -1 : 1));

  // דיבידנדים מתוזמנים: לכל מניה עם נתונים, כל יום אקס בטווח
  const divEv = [];
  for (const sym of Object.keys(px)) for (const [d, amt] of (px[sym].div || [])) if (d > quarters[0].period && d <= asOf) divEv.push({ date: d, sym, amt });
  divEv.sort((a, b) => (a.date < b.date ? -1 : 1));

  const doTrade = (e) => {
    const p = P(e.sym);
    const qty = r6(e.qty), price = e.price;
    const comm = r2(Math.abs(qty) * perShare);
    let realized = 0;
    if (qty > 0) {
      const need = qty * price + comm;
      if (cash < need) { const dep = r2(need - cash); tx(e.date, dep, 'Deposits/Withdrawals', 'CAPITAL IN (FUNDS ' + e.sym + ' PURCHASE)', { est: true, kind: 'buy' }); cash += dep; }
      cash -= need;
      p.lots.push({ qty, cost: need });
      p.qty = r6(p.qty + qty);
    } else if (qty < 0) {
      let left = -qty, basis = 0;
      while (left > 1e-9 && p.lots.length) {
        const lot = p.lots[0], take = Math.min(left, lot.qty);
        const c = lot.cost * take / lot.qty;
        basis += c; lot.cost -= c; lot.qty = r6(lot.qty - take); left = r6(left - take);
        if (lot.qty <= 1e-9) p.lots.shift();
      }
      if (left > 1e-6) warn.push('מכירה מעבר לכמות: ' + e.sym + ' ' + e.date + ' (' + left + ')');
      const proceeds = -qty * price - comm;
      realized = proceeds - basis;
      cash += proceeds;
      p.qty = r6(p.qty + qty);
    }
    trades.push({
      symbol: e.sym, description: (info[e.sym] && info[e.sym].name) || e.sym, date: e.date, tradeDate: e.date, time: '',
      qty, price: r6(price), proceeds: r2(-qty * price), commission: -comm, commissionCurrency: 'USD', taxes: 0,
      netCash: r2(-qty * price - comm), realized: r2(realized), side: qty > 0 ? 'BUY' : 'SELL', openClose: qty > 0 ? 'O' : 'C',
      currency: 'USD', fxToBase: 1, asset: 'STK', subCategory: 'COMMON', multiplier: 1, transactionType: 'ExchTrade',
      exchange: '', tradeId: 'PS' + e.id, levelOfDetail: 'EXECUTION', country: (info[e.sym] && info[e.sym].country) || 'US', isin: (info[e.sym] && info[e.sym].isin) || '',
      est: !!e.est, how: e.how || '', src: e.src || '', url: e.url || '', note: e.note || '', period: e.period || '',
    });
  };
  /* פעולה תאגידית: הכמויות והעלות זזות כאן; ברשימה היא נרשמת כמו ב־IBKR (מקטע CorporateAction → taxEvents k:'ca'),
     כדי שמנוע המנות של האפליקציה (taxil.js tiFifo) יעבור אותה בעצמו. ספינאוף/מיזוג — חלוקת העלות ב־caAlloc (אחוז לפי
     השווי ביום הראשון), כמו שהמשתמש היה מזין במרכז המס. */
  const caSeq = {};
  const caEv = (a, type, rows, desc) => {
    const id = 'CA-' + a.date.replace(/-/g, '') + '-' + a.sym + (caSeq[a.date + a.sym] = (caSeq[a.date + a.sym] || 0) + 1);
    rows.forEach((r, i) => taxEvents.push({ k: 'ca', id: id + '-' + (i + 1), actionId: id, type, symbol: r.symbol, conid: '', date: a.date,
      qty: r.qty, proceeds: r2(r.proceeds || 0), currency: 'USD', asset: 'STK', description: desc, src: a.src || '', url: a.url || '' }));
    return id;
  };
  const doCa = (a) => {
    const p = P(a.sym);
    if (a.type === 'split') {
      if (!(p.qty > 0)) return;
      const before = p.qty, after = Math.floor(p.qty * a.ratio + 1e-6);
      // שבר מניה (חצי מניה בספליט 3:2 על כמות אי־זוגית) — לא נוצר; העלות נשארת על המניות השלמות
      for (const l of p.lots) l.qty = l.qty * after / before;
      p.qty = after;
      const txt = a.ratio >= 1 ? 'SPLIT ' + fmtRatio(a.ratio) : 'REVERSE SPLIT ' + fmtRatio(a.ratio);
      if (a.ratio >= 1) caEv(a, 'FS', [{ symbol: a.sym, qty: after - before }], a.sym + '() ' + txt);
      else caEv(a, 'RS', [{ symbol: a.sym, qty: -before }, { symbol: a.sym, qty: after }], a.sym + '() ' + txt);
    } else if (a.type === 'spinoff' && p.qty > 0) {
      const n = Math.floor(p.qty * a.ratio + 1e-6);
      // הקצאת עלות לפי השווי ביום הראשון: חלק המניה החדשה מסך השווי
      const pOld = markOn(a.sym, a.date), pNew = a.px || markOn(a.to, a.date);
      const vNew = n * (pNew || 0), vOld = p.qty * (pOld || 0);
      const frac = (vNew + vOld) > 0 ? vNew / (vNew + vOld) : 0;
      const q = P(a.to);
      let moved = 0;
      for (const l of p.lots) { const c = l.cost * frac; l.cost -= c; moved += c; }
      q.lots.push({ qty: n, cost: moved });
      q.qty = r6(q.qty + n);
      const id = caEv(a, 'SO', [{ symbol: a.to, qty: n }], a.sym + '() SPINOFF ' + fmtRatio(a.ratio) + ' (' + a.to + ')');
      caAlloc[id] = Math.round(frac * 1e8) / 1e6;
    } else if (a.type === 'merger' && p.qty > 0) {
      const q0 = p.qty;
      const basis = p.lots.reduce((t, l) => t + l.cost, 0);
      const cashIn = (a.cash || 0) * q0;
      const n = a.to ? Math.floor(q0 * (a.ratio || 0) + 1e-6) : 0;
      const pNew = a.to ? (a.px || markOn(a.to, a.date) || 0) : 0;
      const vNew = n * pNew;
      // מזומן — מימוש יחסי של העלות; המניות החדשות יורשות את שאר העלות
      const fracCash = (cashIn + vNew) > 0 ? cashIn / (cashIn + vNew) : 1;
      if (cashIn) cash += cashIn;
      p.qty = 0; p.lots = [];
      if (n) { const q = P(a.to); q.lots.push({ qty: n, cost: basis * (1 - fracCash) }); q.qty = r6(q.qty + n); }
      realizedCa.push({ date: a.date, sym: a.sym, realized: r2(cashIn - basis * fracCash) });
      const rows = [{ symbol: a.sym, qty: -q0, proceeds: cashIn }];
      if (n) rows.push({ symbol: a.to, qty: n });
      const id = caEv(a, 'TC', rows, a.sym + '() MERGED' + (a.to ? ' (' + a.to + ' ' + fmtRatio(a.ratio || 0) + ')' : '') + (a.cash ? ' + ' + a.cash + ' USD' : ''));
      caAlloc[id] = Math.round((1 - fracCash) * 1e8) / 1e6;
    }
  };
  const doDiv = (d) => {
    const p = pos[d.sym];
    if (!p || !(p.qty > 0)) return;
    const gross = p.qty * d.amt;
    const country = (info[d.sym] && info[d.sym].country) || 'US';
    const isin = (info[d.sym] && info[d.sym].isin) || '';
    const head = d.sym + '(' + isin + ') Cash Dividend USD ' + r6(d.amt) + ' per Share';
    tx(d.date, gross, 'Dividends', head + ' (Ordinary Dividend)', { symbol: d.sym, perShare: d.amt, qty: p.qty });
    cash += r2(gross);
    const rate = whtRate(params, country, d.date);
    if (rate > 0) { const w = r2(gross * rate); tx(d.date, -w, 'Withholding Tax', head + ' - ' + country + ' Tax', { symbol: d.sym, est: true, rate }); cash -= w; }
  };
  const sweep = (date) => {
    if (cash > 0.005) { tx(date, -cash, 'Deposits/Withdrawals', 'CAPITAL OUT (QUARTER-END CASH)', { est: true, kind: 'sweep' }); cash = 0; }
    else if (cash < -0.005) { tx(date, -cash, 'Deposits/Withdrawals', 'CAPITAL IN (QUARTER-END)', { est: true, kind: 'sweep' }); cash = 0; }
  };
  const value = (date) => {
    let v = cash;
    for (const sym of Object.keys(pos)) { const p = pos[sym]; if (Math.abs(p.qty) > 1e-9) v += p.qty * (markOn(sym, date) || 0); }
    return v;
  };

  const days = [];
  if (cal) for (const d of cal) if (d >= quarters[0].period && d <= asOf) days.push(d);
  const dailyFrom = params.dailyFrom || quarters[0].period;
  // ריצה: אירועים לפי יום; בסוף כל יום מסחר (מ־dailyFrom) — שווי
  let ei = 0, di = 0, fi = 0;
  const flowsByDay = {};
  const flowNow = () => cashTx.filter((t) => t.type === 'Deposits/Withdrawals').reduce((t, x) => t + x.amount, 0);
  let flowSeen = 0;
  const calSet = new Set(cal || []);
  const allDates = [...new Set([...ev.map((e) => e.date), ...divEv.map((d) => d.date), ...fees.map((f) => tday(f.date)), ...days])].filter((d) => d <= asOf).sort();
  for (const date of allDates) {
    while (di < divEv.length && divEv[di].date < date) di++;      // (לא אמור לקרות — כל התאריכים ברשימה)
    while (di < divEv.length && divEv[di].date === date) doDiv(divEv[di++]);   // דיבידנד ביום האקס — על הכמות שלפני העסקאות של היום
    while (ei < ev.length && ev[ei].date === date) {
      const e = ev[ei++];
      if (e.k === 'trade') doTrade(e);
      else if (e.k === 'ca') doCa(e);
      else if (e.k === 'sweep') {
        const vPre = value(date);
        sweep(date);
        const q = qMeta.find((m) => m.period === e.period);
        if (q) { q.navPre = r2(vPre); q.nav = r2(value(date)); q.navDate = date; }
      }
    }
    while (fi < fees.length && tday(fees[fi].date) === date) { const f = fees[fi++]; tx(date, -Math.abs(f.amount), 'Other Fees', f.desc || 'FEE', { est: !!f.est, src: f.src || '' }); cash -= Math.abs(f.amount); }
    const fNow = flowNow();
    if (fNow !== flowSeen) { flowsByDay[date] = r2(fNow - flowSeen); flowSeen = fNow; }
    if (date >= dailyFrom && (!cal || calSet.has(date))) navDaily.push({ date, total: r2(value(date)) });
  }
  // עמידה בתאריכי רבעון שלא היו ימי מסחר (סופ"ש): השווי נקבע ביום המסחר האחרון — נרשם שוב בתאריך הרבעון
  for (const q of qMeta) if (q.nav == null) { q.nav = r2(value(q.period)); }

  /* --- שלב 3: תקופות NAV רבעוניות (TWR) --- */
  const navHistory = [];
  for (let i = 1; i < qMeta.length; i++) {
    const a = qMeta[i - 1], b = qMeta[i];
    const inDaily = a.period >= dailyFrom;
    let twr;
    if (inDaily) {
      // שרשור יומי: r = (V_t − F_t)/V_{t−1}
      const rows = navDaily.filter((x) => x.date >= (a.navDate || tday(a.period)) && x.date <= b.period);
      let g = 1;
      for (let k = 1; k < rows.length; k++) { const f = flowsByDay[rows[k].date] || 0; if (rows[k - 1].total > 0) g *= (rows[k].total - f) / rows[k - 1].total; }
      twr = (g - 1) * 100;
    } else {
      // Modified Dietz על התזרימים ברבעון (הפקדות ביום הקנייה, משיכה ביום האחרון)
      const T = (Date.parse(b.period) - Date.parse(a.period)) / 86400000 || 1;
      let F = 0, W = 0;
      for (const [d, f] of Object.entries(flowsByDay)) if (d > a.period && d <= b.period) { F += f; W += f * (Date.parse(b.period) - Date.parse(d)) / 86400000 / T; }
      twr = ((b.nav - a.nav - F) / (a.nav + W)) * 100;
    }
    navHistory.push({ fromDate: a.period, toDate: b.period, startingValue: a.nav, endingValue: b.nav, twr: Math.round(twr * 1e4) / 1e4, flows: r2(Object.entries(flowsByDay).filter(([d]) => d > a.period && d <= b.period).reduce((t, [, f]) => t + f, 0)) });
  }

  /* --- שלב 4: מצב נוכחי --- */
  const positions = [];
  for (const sym of Object.keys(pos)) {
    const p = pos[sym];
    if (!(p.qty > 1e-6)) continue;
    const mark = markOn(sym, asOf) || 0;
    const cost = p.lots.reduce((t, l) => t + l.cost, 0);
    positions.push({ symbol: sym, description: (info[sym] && info[sym].name) || sym, asset: 'STK', qty: r6(p.qty), markPrice: r6(mark),
      marketValue: r2(p.qty * mark), costBasis: r2(cost), costPrice: r6(cost / p.qty), unrealized: r2(p.qty * mark - cost), currency: 'USD', fxToBase: 1,
      country: (info[sym] && info[sym].country) || 'US', isin: (info[sym] && info[sym].isin) || '', levelOfDetail: 'SUMMARY' });
  }
  positions.sort((a, b) => b.marketValue - a.marketValue);

  return {
    meta: { accountId: 'PERSHING-13F', fromDate: quarters[0].period, toDate: asOf, baseCurrency: 'USD', demo: 'ackman' },
    trades, positions, cashTransactions: cashTx, navHistory, navDaily, cashBalances: [{ currency: 'USD', balance: r2(cash) }],
    taxEvents, caAlloc,
    ackman: { quarters: qMeta, realizedCa, warn },
  };
}

module.exports = { isinFrom, fmtRatio, seriesFromYahoo, idxOnOrBefore, closeOn, vwapWindow, whtRate, buildBook, addDays, weekdayOnOrBefore };
