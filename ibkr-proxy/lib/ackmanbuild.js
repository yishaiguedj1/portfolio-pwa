/* הרכבת הקלט של מחולל הספר (16/11/2026): נתוני ה־13F מהריפו (lib/ackman-13f.json) + רבעונים חדשים מהשרת +
   עסקאות מדויקות + הייחוס (ackmanref.js) + מחירים → buildBook. משמש גם את העבודה בשרת וגם את tools/ackman-build.js. */
'use strict';
const B = require('./ackmanbook');
const REF = require('./ackmanref');

/* רבעון בצורה הדחוסה של הקובץ → צורת המחולל. רק מניות: אופציות לא נכנסות לכמות המניות —
   ב־13F שורת CALL מדווחת במניות הבסיס ובשווי הנקוב שלהן (P&G ברבעון 2 2013: ‏8.94M מניות + CALL על 25M), ואיחוד היה
   מנפח את הכמות פי ארבעה. ה־CALL נשמר בצד (calls) — לתצוגה ("חשיפה באופציות, מחוץ לתיק"); PUT (גידור) — גם הוא לא נכנס.
   co — הדוח הודיע שהשמיט אחזקה חסויה (isConfidentialOmitted): ייתכן תיקון NEW HOLDINGS בהמשך */
function qFrom(q, symbols) {
  const m = new Map(), calls = [], puts = [];
  for (const r of q.h) {
    const [sym, shares, value, pc] = r;
    if (pc === 'P') { puts.push({ sym, shares, value }); continue; }
    if (pc === 'C') { calls.push({ sym, shares, value }); continue; }
    const a = m.get(sym);
    if (a) { a.shares += shares; a.value += value; }
    else m.set(sym, { sym, shares, value, name: (symbols[sym] && symbols[sym].n) || sym });
  }
  return { period: q.p, filed: q.f, acc: q.a || [], rows: [...m.values()], calls, puts, co: !!q.co };
}

/* data13f: {symbols, quarters} · extra: { quarters: [...אותה צורה], symbols: {...}, exact: [...] } · px: {SYM: series} */
function assemble(data13f, extra, px, opts) {
  const o = opts || {};
  const symbols = Object.assign({}, data13f.symbols, (extra && extra.symbols) || {});
  const byP = new Map();
  for (const q of data13f.quarters) byP.set(q.p, q);
  for (const q of ((extra && extra.quarters) || [])) byP.set(q.p, q);   // רבעון שהשרת פענח גובר (תיקון מאוחר)
  const quarters = [...byP.values()].sort((a, b) => (a.p < b.p ? -1 : 1)).map((q) => qFrom(q, symbols));
  const info = {};
  for (const [sym, s] of Object.entries(symbols)) {
    const country = REF.COUNTRY[sym] || s.c || 'US';
    const cu = (s.cu || [])[(s.cu || []).length - 1] || '';
    // ISIN: קנדה — CA; ני"ע עם CINS (אות ראשונה) — מדינת המנפיק; כל השאר (כולל ADR) — US
    const cc = country === 'CA' ? 'CA' : /^[A-Z]/.test(cu) ? country : 'US';
    info[sym] = { name: s.n || sym, country, isin: B.isinFrom(cu, cc) };
  }
  const exact = REF.MANUAL.concat((extra && extra.exact) || []);
  const params = Object.assign({}, REF.PARAMS, { marks: REF.MARKS, asOf: o.asOf }, o.params || {});
  return { quarters, exact, actions: REF.ACTIONS, px, info, params };
}

function build(data13f, extra, px, opts) {
  const input = assemble(data13f, extra, px, opts);
  const book = B.buildBook(input);
  book.ackman.symbols = Object.fromEntries(Object.entries(input.info).map(([k, v]) => [k, v.name]));
  return book;
}

/* הסימבולים שצריך להם מחירים: כל מה שהוחזק בעידן היומי + SPY (לוח ימי המסחר); בלי מניות שאין להן נתונים */
function neededSymbols(data13f, extra, from) {
  const symbols = Object.assign({}, data13f.symbols, (extra && extra.symbols) || {});
  const out = new Set(['SPY']);
  const qs = data13f.quarters.concat((extra && extra.quarters) || []);
  for (const q of qs) for (const r of q.h) if (!(symbols[r[0]] && symbols[r[0]].nd) && (!from || q.p >= from)) out.add(r[0]);
  for (const a of REF.ACTIONS) if (!from || a.date >= from) { if (!(symbols[a.sym] || {}).nd) out.add(a.sym); if (a.to && !(symbols[a.to] || {}).nd && !REF.MARKS[a.to]) out.add(a.to); }
  for (const x of ((extra && extra.exact) || [])) out.add(x.sym);
  for (const k of Object.keys(REF.MARKS)) out.delete(k);
  return [...out].sort();
}

module.exports = { qFrom, assemble, build, neededSymbols };
