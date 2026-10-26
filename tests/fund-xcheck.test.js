// 26/10/2026 — כלי ההשוואה (שכבה 8, ibkr-proxy/lib/fundxcheck.js): נתונים סינתטיים בלבד, בלי רשת.
// נוסחאות מ־SEC לערכים מחושבים, אומדן לרבעון רביעי, פיצולים, מילון ההגדרות, ext רופף, ttm, השלמה מ־Yahoo, 10-K במאזן.
// הרצה: node tests/fund-xcheck.test.js
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const X = require(path.join(__dirname, '..', 'ibkr-proxy/lib/fundxcheck.js'));

function facts(tags) {
  const g = {};
  for (const [tag, unit, rows] of tags) g[tag] = { units: { [unit]: rows.map(([start, end, val, form, filed]) => ({ start: start || undefined, end, val, form, filed })) } };
  return { facts: { 'us-gaap': g } };
}
const Y = (y) => [y + '-01-01', y + '-12-31'];
const Q = (y, q) => [[y + '-01-01', y + '-04-01', y + '-07-01', y + '-10-01'][q - 1], [y + '-03-31', y + '-06-30', y + '-09-30', y + '-12-31'][q - 1]];
const base = (o) => Object.assign({ ok: true, checks: [], splits: [], fill: [], derived: {}, fy: ['2023-12-31', '2024-12-31'], q: [], A: {}, Q: {}, tags: {} }, o);
const find = (x, m, k, p) => x.find((r) => r.m === m && r.k === k && r.p === p);

// 1. רווח גולמי מחושב (אין GrossProfit): SEC = Revenues − CostOfRevenue באותה תקופה
{
  const f = facts([['Revenues', 'USD', [[...Y(2024), 1000e6, '10-K', '2025-02-01']]], ['CostOfRevenue', 'USD', [[...Y(2024), 400e6, '10-K', '2025-02-01']]]]);
  const d = base({ tags: { rev: 'Revenues', cogs: 'CostOfRevenue' }, A: { rev: [null, 1000e6], gp: [null, 600e6] } });
  let r = find(X.xcheck(d, f, null, null), 'gp', 'A', '2024-12-31');
  ok(r.c === 'ok' && r.raw === 600e6 && r.rf === 'rev-cogs', 'רווח גולמי מחושב — נבדק מול הנוסחה מ־SEC (לא none)');
  d.A.gp = [null, 650e6];
  r = find(X.xcheck(d, f, null, null), 'gp', 'A', '2024-12-31');
  ok(r.c === 'bug', 'רווח גולמי שלא תואם לנוסחה — bug');
}
// 2. סך התחייבויות = סך התחייבויות והון − הון; הון כולל מיעוט חסר בתקופה → הון בעלי המניות
{
  const f = facts([['LiabilitiesAndStockholdersEquity', 'USD', [[null, '2024-12-31', 5000e6, '10-K', '2025-02-01']]],
    ['StockholdersEquity', 'USD', [[null, '2024-12-31', 1200e6, '10-K', '2025-02-01']]],
    ['StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest', 'USD', [[null, '2022-12-31', 999e6, '10-K', '2023-02-01']]]]);
  const d = base({ tags: { tle: 'LiabilitiesAndStockholdersEquity', eq: 'StockholdersEquity', eqt: 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest' }, A: { tl: [null, 3800e6] } });
  const r = find(X.xcheck(d, f, null, null), 'tl', 'A', '2024-12-31');
  ok(r.c === 'ok' && r.raw === 3800e6 && r.rf === 'tle-eq', 'סך התחייבויות מחושב — מול הנוסחה, גם כשאין הון כולל מיעוט לתקופה');
}
// 3. רבעון רביעי של רווח למניה ומספר מניות — אין מקור, אומדן מ־SEC
{
  const eps = [[...Y(2024), 4.0, '10-K', '2025-02-01'], [...Q(2024, 1), 0.9, '10-Q', '2024-05-01'], [...Q(2024, 2), 1.0, '10-Q', '2024-08-01'], [...Q(2024, 3), 1.05, '10-Q', '2024-11-01']];
  const sh = [[...Y(2024), 100, '10-K', '2025-02-01'], [...Q(2024, 1), 102, '10-Q', '2024-05-01'], [...Q(2024, 2), 100, '10-Q', '2024-08-01'], [...Q(2024, 3), 99, '10-Q', '2024-11-01']];
  const f = facts([['EarningsPerShareDiluted', 'USD/shares', eps], ['WeightedAverageNumberOfDilutedSharesOutstanding', 'shares', sh]]);
  const d = base({ tags: { eps: 'EarningsPerShareDiluted', sh: 'WeightedAverageNumberOfDilutedSharesOutstanding' }, fy: ['2023-12-31', '2024-12-31'],
    q: ['2024-03-31', '2024-06-30', '2024-09-30', '2024-12-31'], A: { eps: [null, 4.0], sh: [null, 100] },
    Q: { eps: [0.9, 1.0, 1.05, 1.06], sh: [102, 100, 99, 99] }, derived: { eps: ['2024-12-31'] } });
  let x = X.xcheck(d, f, null, null);
  const re = find(x, 'eps', 'Q', '2024-12-31'), rs = find(x, 'sh', 'Q', '2024-12-31');
  ok(re.c === 'est' && Math.abs(re.est - 1.05) < 1e-9, 'רווח למניה ברבעון רביעי: est (השנה פחות שלושה רבעונים = 1.05)');
  ok(rs.c === 'est' && rs.est === 99, 'ממוצע מניות ברבעון רביעי: est (4 × 100 − 301 = 99)');
  d.Q.eps[3] = 1.5;
  x = X.xcheck(d, f, null, null);
  ok(find(x, 'eps', 'Q', '2024-12-31').c === 'estx', 'רחוק מהאומדן — estx');
}
// 4. פיצול: 2022 דווח רק לפני פיצול 10:1 — SEC הגולמי מנורמל לפי תאריך ההגשה
{
  const f = facts([['WeightedAverageNumberOfDilutedSharesOutstanding', 'shares', [[...Y(2022), 450, '10-K', '2023-02-01'], [...Y(2024), 4400, '10-K', '2026-01-20']]],
    ['EarningsPerShareDiluted', 'USD/shares', [[...Y(2022), 9.95, '10-K', '2023-02-01'], [...Y(2024), 1.98, '10-K', '2026-01-20']]]]);
  const d = base({ tags: { sh: 'WeightedAverageNumberOfDilutedSharesOutstanding', eps: 'EarningsPerShareDiluted' }, fy: ['2022-12-31', '2024-12-31'], splits: [['2025-11-17', 10]],
    A: { sh: [450, 4400], eps: [9.95, 1.98] } });
  let x = X.xcheck(d, f, null, null);
  ok(find(x, 'sh', 'A', '2022-12-31').c === 'spl' && find(x, 'eps', 'A', '2022-12-31').c === 'spl', 'פיצול שלא הוחל אצלנו — spl (לא def/ok)');
  d.A.sh = [4500, 4400]; d.A.eps = [0.995, 1.98];
  x = X.xcheck(d, f, null, null);
  ok(find(x, 'sh', 'A', '2022-12-31').c === 'ok' && find(x, 'eps', 'A', '2022-12-31').c === 'ok', 'אחרי שהוחל — ok מול SEC המנורמל');
  // "פיצול" קטן ב־Yahoo (הפרדת חברה, 1.06) — לא נכנס לנרמול
  d.splits = [['2025-11-17', 1.061]]; d.A.sh = [450, 4400]; d.A.eps = [9.95, 1.98];
  ok(find(X.xcheck(d, f, null, null), 'sh', 'A', '2022-12-31').c === 'ok', 'הפרדת חברה (יחס 1.06) — לא פיצול');
}
// 5. מילון ההגדרות: Yahoo OperatingIncome בלי פריטים חריגים — אנחנו = TotalOperatingIncomeAsReported
{
  const f = facts([['OperatingIncomeLoss', 'USD', [[...Y(2024), 150, '10-K', '2025-02-01']]]]);
  const d = base({ tags: { op: 'OperatingIncomeLoss' }, A: { op: [null, 150e6] } });
  f.facts['us-gaap'].OperatingIncomeLoss.units.USD[0].val = 150e6;
  const y = { fy: ['2024-12-31'], q: [], A: { op: [200e6] }, Q: {} };
  const ya = { A: { OperatingIncome: { '2024-12-31': 200e6 }, TotalOperatingIncomeAsReported: { '2024-12-31': 150e6 } }, Q: {} };
  let r = find(X.xcheck(d, f, y, null, { ya }), 'op', 'A', '2024-12-31');
  ok(r.c === 'okd' && r.why === 'y_op_asrep', 'רווח תפעולי מול Yahoo: okd (ההגדרה של Yahoo, as-reported תואם)');
  r = find(X.xcheck(d, f, y, null), 'op', 'A', '2024-12-31');
  ok(r.c === 'odd' && !r.why, 'בלי השדות החלופיים — אין הסבר: odd (בעיה לבדוק), לא def');
}
// 6. Nasdaq "מזומן" כולל מזומן מוגבל — Nasdaq = CashCashEquivalentsRestricted… ב־SEC
{
  const f = facts([['CashAndCashEquivalentsAtCarryingValue', 'USD', [[null, '2024-12-31', 1e9, '10-K', '2025-02-01']]],
    ['CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents', 'USD', [[null, '2024-12-31', 9e9, '10-K', '2025-02-01']]]]);
  const d = base({ tags: { cash: 'CashAndCashEquivalentsAtCarryingValue' }, A: { cash: [null, 1e9] } });
  const nq = { A: { ends: ['2024-12-31'], v: { cash: { '2024-12-31': 9e9 } } } };
  const r = find(X.xcheck(d, f, null, nq), 'cash', 'A', '2024-12-31');
  ok(r.c === 'okd' && r.why === 'n_cash_restr', 'מזומן מול Nasdaq: okd (Nasdaq כולל מזומן מוגבל)');
}
// 7. ext רופף: Yahoo ו־Nasdaq קרובים (4%) ורחוקים מאיתנו פי 50 — לא "הגדרה"
{
  const f = facts([['PaymentsToAcquirePropertyPlantAndEquipment', 'USD', [[...Y(2024), 155e6, '10-K', '2025-02-01']]]]);
  const d = base({ tags: { capex: 'PaymentsToAcquirePropertyPlantAndEquipment' }, A: { capex: [null, 155e6], rev: [null, 20e9] } });
  const y = { fy: ['2024-12-31'], q: [], A: { capex: [7.66e9] }, Q: {} }, nq = { A: { ends: ['2024-12-31'], v: { capex: { '2024-12-31': 7.38e9 } } } };
  const r = find(X.xcheck(d, f, y, nq), 'capex', 'A', '2024-12-31');
  ok(r.c === 'ext' && r.xl === 1, 'השקעות הוניות 2% מהאמת (AEP) — ext, לא def');
}
// 8. רווח נקי: Nasdaq "לבעלי המניות" = הכולל → ok (לא ext)
{
  const f = facts([['NetIncomeLoss', 'USD', [[...Y(2024), 100e6, '10-K', '2025-02-01']]]]);
  const d = base({ tags: { ni: 'NetIncomeLoss' }, A: { ni: [null, 100e6], nic: [null, 95e6] } });
  const y = { fy: ['2024-12-31'], q: [], A: { ni: [100e6] }, Q: {} }, nq = { A: { ends: ['2024-12-31'], v: { nic: { '2024-12-31': 100e6 } } } };
  ok(find(X.xcheck(d, f, y, nq), 'ni', 'A', '2024-12-31').c === 'ok', 'רווח נקי: מקור שמציג את הכולל כ"לבעלי המניות" — ok');
}
// 9. "שנים" במרווח של רבעון (12 חודשים אחרונים בדוחות רבעוניים) — bug ttm
{
  const d = base({ fy: ['2024-12-31', '2025-03-31', '2025-06-30'], A: { rev: [1, 2, 3] }, tags: { rev: 'Revenues' } });
  const x = X.xcheck(d, facts([]), null, null);
  ok(find(x, 'rev', 'A', '2025-03-31').why === 'ttm' && find(x, 'rev', 'A', '2024-12-31').why !== 'ttm', 'שנה שמתחילה 3 חודשים אחרי הקודמת — bug ttm');
}
// 10. שורה שהושלמה מ־Yahoo — לא נבדקת מול Yahoo
{
  const d = base({ tags: {}, fill: ['eps'], A: { eps: [null, 2.5] } });
  const y = { fy: ['2024-12-31'], q: [], A: { eps: [2.5] }, Q: {} };
  ok(find(X.xcheck(d, facts([]), y, null), 'eps', 'A', '2024-12-31').c === 'yfill', 'השלמה מ־Yahoo — yfill (לא ok)');
}
// 11. מאזן: 10-Q מאוחר הציג מחדש את סוף השנה — הערך מה־10-K תקף (המדיניות של fundamentals)
{
  const f = facts([['CashAndCashEquivalentsAtCarryingValue', 'USD', [[null, '2024-12-31', 12487e6, '10-K', '2025-02-17'], [null, '2024-12-31', 12273e6, '10-Q', '2025-10-22']]]]);
  const d = base({ tags: { cash: 'CashAndCashEquivalentsAtCarryingValue' }, A: { cash: [null, 12487e6] } });
  ok(find(X.xcheck(d, f, null, null), 'cash', 'A', '2024-12-31').c === 'ok', 'מאזן: ערך ה־10-K מול 10-Q מאוחר — ok');
}
// 12. רבעון רביעי בחברה שמדווחת רבעונים ישירים (בלי מצטבר): השנה פחות שלושה
{
  const rows = [[...Y(2024), 1000e6, '10-K', '2025-02-01'], ...[1, 2, 3].map((q) => [...Q(2024, q), 240e6, '10-Q', '2024-0' + (q * 3 + 2) + '-01'])];
  const f = facts([['Revenues', 'USD', rows]]);
  const d = base({ tags: { rev: 'Revenues' }, q: ['2024-03-31', '2024-06-30', '2024-09-30', '2024-12-31'], A: { rev: [null, 1000e6] }, Q: { rev: [240e6, 240e6, 240e6, 280e6] } });
  const r = find(X.xcheck(d, f, null, null), 'rev', 'Q', '2024-12-31');
  ok(r.c === 'ok' && r.raw === 280e6, 'רבעון רביעי מרבעונים ישירים — SEC = 1000 − 720');
}
// 13. השקעות הוניות כסכום תגיות
{
  const f = facts([['PaymentsToAcquirePropertyPlantAndEquipment', 'USD', [[...Y(2024), 300e6, '10-K', '2025-02-01']]], ['PaymentsToAcquireSoftware', 'USD', [[...Y(2024), 50e6, '10-K', '2025-02-01']]]]);
  const d = base({ tags: { capex: 'PaymentsToAcquirePropertyPlantAndEquipment+PaymentsToAcquireSoftware' }, A: { capex: [null, 350e6] } });
  const r = find(X.xcheck(d, f, null, null), 'capex', 'A', '2024-12-31');
  ok(r.c === 'ok' && r.raw === 350e6, 'סכום תגיות — SEC הגולמי הוא הסכום');
}
// 14. תגית מועמדת: התקופה הושלמה מתגית משנית (mergeTags) — SEC גולמי מאותה תגית
{
  const f = facts([['Revenues', 'USD', [[...Y(2024), 1000, '10-K', '2025-02-01']]], ['RevenueFromContractWithCustomerExcludingAssessedTax', 'USD', [[...Y(2023), 900, '10-K', '2024-02-01']]]]);
  const d = base({ tags: { rev: 'Revenues' }, A: { rev: [900, 1000] } });
  const r = find(X.xcheck(d, f, null, null, { cand: { rev: ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax'] } }), 'rev', 'A', '2023-12-31');
  ok(r.c === 'ok' && r.raw === 900 && r.rf === 'RevenueFromContractWithCustomerExcludingAssessedTax', 'תקופה מתגית משנית — נבדקת מול אותה תגית');
}
// מאזן (בדיקת המאזן, 26/10/2026): מטבע, דוח שנתי "קרוב", ומזומן מכמה תגיות
{
  // (א) Nebius: אותה תגית ברובל ובדולר — SEC הגולמי רק במטבע הדיווח
  const f1 = { facts: { 'us-gaap': { CashAndCashEquivalentsAtCarryingValue: { units: {
    RUB: [{ end: '2024-12-31', val: 79275e6, form: '20-F', filed: '2025-04-20' }], USD: [{ end: '2024-12-31', val: 1127e6, form: '20-F', filed: '2025-04-01' }] } } } } };
  const d1 = base({ cur: 'USD', tags: { cash: 'CashAndCashEquivalentsAtCarryingValue' }, A: { cash: [null, 1127e6] } });
  ok(find(X.xcheck(d1, f1, null, null), 'cash', 'A', '2024-12-31').c === 'ok', 'SEC גולמי רק במטבע הדיווח — לא ערך ברובל שהוגש אחר כך');
  // (ב) מאזן 2023: מה שהודפס במאזן (10-K של 2023/2024) — לא יתרת פתיחה בתזרים של 10-K מאוחר בשנתיים
  const C = 'CashAndCashEquivalentsAtCarryingValue', i = (end, val, filed) => ({ end, val, form: '10-K', filed, accn: 'a' + filed });
  const f2 = { facts: { 'us-gaap': { [C]: { units: { USD: [i('2023-12-31', 100e6, '2024-02-01'), i('2023-12-31', 100e6, '2025-02-01'), i('2024-12-31', 110e6, '2025-02-01'),
    i('2023-12-31', 90e6, '2026-02-01'), i('2025-12-31', 120e6, '2026-02-01')] } } } } };
  const d2 = base({ cur: 'USD', tags: { cash: C }, A: { cash: [100e6, 110e6] } });
  ok(find(X.xcheck(d2, f2, null, null), 'cash', 'A', '2023-12-31').c === 'ok', 'מאזן: מול הדוח השנתי שבמאזן שלו מופיע התאריך (100), לא מול הצגה מחדש בתזרים שנתיים אחר כך (90)');
  // (ג) מזומן מהסך הכולל מזומן מוגבל פחות המזומן המוגבל (Chevron) — SEC מאשר
  const R = 'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents', k = (end, val) => ({ end, val, form: '10-K', filed: '2025-02-01' });
  const f3 = { facts: { 'us-gaap': { [R]: { units: { USD: [k('2024-12-31', 7285e6)] } }, RestrictedCashCurrent: { units: { USD: [k('2024-12-31', 174e6)] } },
    RestrictedCashNoncurrent: { units: { USD: [k('2024-12-31', 818e6)] } } } } };
  const d3 = base({ cur: 'USD', tags: { cash: R }, A: { cash: [null, 6293e6] } });
  const r3 = find(X.xcheck(d3, f3, null, null), 'cash', 'A', '2024-12-31');
  ok(r3.c === 'ok' && r3.rf === 'cash-restr', 'מזומן = הסך הכולל פחות המזומן המוגבל — מאושר מ־SEC (rf = cash-restr)');
}
/* ---------- סבב 2 (26/10/2026): def בלי הסבר → odd, ומילון ההגדרות מורחב (כל הסבר נבדק מול הדוח המודפס) ---------- */
// (א) Nasdaq בדולרים לחברה שמדווחת באירו: אותו יחס בכל המדדים של התקופה (ASML 2024: ‏1.035)
{
  const tags = [['Revenues', 1000e6], ['NetIncomeLoss', 200e6], ['Assets', 5000e6], ['Liabilities', 3000e6]];
  const f = facts(tags.map(([t, v]) => [t, 'EUR', [[...(t === 'Assets' || t === 'Liabilities' ? [null, '2024-12-31'] : Y(2024)), v, '10-K', '2025-02-01']]]));
  const d = base({ cur: 'EUR', tags: { rev: 'Revenues', ni: 'NetIncomeLoss', ta: 'Assets', tl: 'Liabilities' }, A: { rev: [null, 1000e6], ni: [null, 200e6], ta: [null, 5000e6], tl: [null, 3000e6] } });
  const nq = { A: { ends: ['2024-12-31'], v: { rev: { '2024-12-31': 1035e6 }, nic: { '2024-12-31': 207e6 }, ta: { '2024-12-31': 5175e6 }, tl: { '2024-12-31': 3105e6 } } } };
  const x = X.xcheck(d, f, null, nq);
  ok(['rev', 'ni', 'ta', 'tl'].every((m) => { const r = find(x, m, 'A', '2024-12-31'); return r.c === 'okd' && r.why === 'n_fx'; }), 'Nasdaq בדולרים (יחס אחיד 1.035 בכל המדדים) — okd n_fx');
  nq.A.v.rev['2024-12-31'] = 1100e6;
  ok(find(X.xcheck(d, f, null, nq), 'rev', 'A', '2024-12-31').c === 'odd', 'מדד אחד ביחס אחר מהשער — לא n_fx (odd)');
}
// (ב) הוצג מחדש: Yahoo = מה שהוגש לראשונה; אבל ערך של תקופה ישנה מהגשה מאוחרת בשנים (באור) — לא "הצגה מחדש"
{
  const rows = [[...Y(2023), 2.31, '10-K', '2024-02-01'], [...Y(2023), 2.33, '10-K', '2025-02-01']];
  const f = facts([['EarningsPerShareDiluted', 'USD/shares', rows]]);
  const d = base({ tags: { eps: 'EarningsPerShareDiluted' }, fy: ['2023-12-31', '2024-12-31'], A: { eps: [2.33, null] } });
  const y = { fy: ['2023-12-31'], q: [], A: { eps: [2.31] }, Q: {} };
  const r = find(X.xcheck(d, f, y, null), 'eps', 'A', '2023-12-31');
  ok(r.c === 'okd' && r.why === 'restated', 'Yahoo = הגשה קודמת, אנחנו = הדוח שהציג מחדש (Axon 2023) — okd restated');
  const g = facts([['OperatingLeaseLeaseIncome', 'USD', [[...Y(2022), 2735e6, '10-K', '2023-02-20'], [...Y(2022), 3094e6, '10-K', '2026-02-20']]]]);
  const d2 = base({ tags: { rev: 'OperatingLeaseLeaseIncome' }, fy: ['2022-12-31', '2023-12-31'], A: { rev: [3094e6, null] } });
  const r2 = find(X.xcheck(d2, g, null, { A: { ends: ['2022-12-31'], v: { rev: { '2022-12-31': 2735e6 } } } }), 'rev', 'A', '2022-12-31');
  ok(r2.c === 'odd', 'ערך של 2022 מדוח 2025 (באור, לא עמודת השוואה) — לא מוסבר כהצגה מחדש (AvalonBay): odd');
}
// (ג) Yahoo ביחידה אחרת: רווח למניה ÷4 (Digital Realty) / ADS = 4 מניות (PDD) — okd y_unit; יחס לא שלם — לא
{
  const f = facts([['EarningsPerShareDiluted', 'USD/shares', [[...Y(2024), 1.61, '10-K', '2025-02-01']]]]);
  const d = base({ tags: { eps: 'EarningsPerShareDiluted' }, A: { eps: [null, 1.61] } });
  const y = (v) => ({ fy: ['2024-12-31'], q: [], A: { eps: [v] }, Q: {} });
  ok(find(X.xcheck(d, f, y(0.4025), null), 'eps', 'A', '2024-12-31').why === 'y_unit' && find(X.xcheck(d, f, y(6.44), null), 'eps', 'A', '2024-12-31').why === 'y_unit', 'רווח למניה פי 4 / חלקי 4 — y_unit');
  ok(find(X.xcheck(d, f, y(0.6), null), 'eps', 'A', '2024-12-31').c === 'odd', 'יחס 2.7 — לא יחידה (odd)');
}
// (ד) Nasdaq: רווח תפעולי אחרי ריבית (בורסות) — okd; קנה מידה פי אלף — okd; רבעון = המצטבר מתחילת השנה — okd
{
  const f = facts([['OperatingIncomeLoss', 'USD', [[...Y(2024), 4309e6, '10-K', '2025-02-01']]], ['InterestExpenseNonoperating', 'USD', [[...Y(2024), 910e6, '10-K', '2025-02-01']]]]);
  const d = base({ tags: { op: 'OperatingIncomeLoss' }, A: { op: [null, 4309e6] } });
  ok(find(X.xcheck(d, f, null, { A: { ends: ['2024-12-31'], v: { op: { '2024-12-31': 3399e6 } } } }), 'op', 'A', '2024-12-31').why === 'n_op_int', 'Nasdaq = רווח תפעולי פחות ריבית (ICE) — n_op_int');
  const g = facts([['PaymentsToAcquirePropertyPlantAndEquipment', 'USD', [[...Y(2024), 25.4e6, '10-K', '2025-02-01']]]]);
  const d2 = base({ tags: { capex: 'PaymentsToAcquirePropertyPlantAndEquipment' }, A: { capex: [null, 25.4e6] } });
  ok(find(X.xcheck(d2, g, null, { A: { ends: ['2024-12-31'], v: { capex: { '2024-12-31': 25000 } } } }), 'capex', 'A', '2024-12-31').why === 'n_scale', 'Nasdaq פי אלף (PulteGroup) — n_scale');
  const q = facts([['Revenues', 'USD', [['2025-01-01', '2025-09-30', 13067e6, '10-Q', '2025-11-01'], ['2025-07-01', '2025-09-30', 4331e6, '10-Q', '2025-11-01']]]]);
  const d3 = base({ tags: { rev: 'Revenues' }, fy: ['2024-12-31'], q: ['2025-09-30'], A: { rev: [16e9] }, Q: { rev: [4331e6] } });
  ok(find(X.xcheck(d3, q, null, { Q: { ends: ['2025-09-30'], v: { rev: { '2025-09-30': 13067e6 } } } }), 'rev', 'Q', '2025-09-30').why === 'n_ytd', 'Nasdaq ברבעון = 9 חודשים מצטבר (Devon) — n_ytd');
}
// (ה) השקעות הוניות: אנחנו רכוש קבוע + תוכנה, המקור רק רכוש קבוע — def capex_part (בחירה שלנו, נשאר def עם הסבר)
{
  const f = facts([['PaymentsToAcquirePropertyPlantAndEquipment', 'USD', [[...Y(2024), 390e6, '10-K', '2025-02-01']]], ['PaymentsForSoftware', 'USD', [[...Y(2024), 295e6, '10-K', '2025-02-01']]]]);
  const d = base({ tags: { capex: 'PaymentsToAcquirePropertyPlantAndEquipment+PaymentsForSoftware' }, A: { capex: [null, 685e6] } });
  const r = find(X.xcheck(d, f, null, { A: { ends: ['2024-12-31'], v: { capex: { '2024-12-31': 390e6 } } } }), 'capex', 'A', '2024-12-31');
  ok(r.c === 'def' && r.why === 'capex_part', 'Nasdaq = רק שורת הרכוש הקבוע (Akamai) — def capex_part');
}
// (ו) מול הדוח המודפס (opt.face): הערך שלנו מודפס → okd face; המקור = אנחנו + שורה מודפסת אחרת → odd fline (אולי חסרה לנו שורה — Host);
//     התגית שלנו לא מודפסת → odd nf; שורת רכישות מודפסת (תגית פרטית) → def capex_acq (Devon)
{
  const C = 'PaymentsForCapitalImprovements';
  const f = facts([[C, 'USD', [[...Y(2024), 260e6, '10-K', '2025-02-01']]]]);
  const d = base({ tags: { capex: C }, A: { capex: [null, 260e6], rev: [null, 5e9] } });
  const face = (rows) => ({ cf: { cols: [{ end: '2024-12-31', months: 12, cur: null }], scale: { cur: 1e6, sh: 1 }, rows: rows.map(([tag, label, v]) => ({ ns: 'us-gaap', tag, label, v: [v] })) } });
  const nq = (v) => ({ A: { ends: ['2024-12-31'], v: { capex: { '2024-12-31': v } } } });
  let r = find(X.xcheck(d, f, null, nq(300e6), { face: face([[C, 'Return on investment', -260]]) }), 'capex', 'A', '2024-12-31');
  ok(r.c === 'okd' && r.why === 'face', 'הערך שלנו = השורה המודפסת, ו־Nasdaq לא מוסבר — okd face');
  r = find(X.xcheck(d, f, null, nq(548e6), { face: face([[C, 'Return on investment', -260], ['PaymentsToAcquireOtherProductiveAssets', 'Renewals and replacements', -288]]) }), 'capex', 'A', '2024-12-31');
  ok(r.c === 'odd' && r.why === 'fline', 'המקור = אנחנו + שורה מודפסת אחרת (Host: ‏Renewals and replacements) — odd fline');
  r = find(X.xcheck(d, f, null, nq(300e6), { face: face([['PaymentsToAcquireProductiveAssets', 'Capital expenditures', -300]]) }), 'capex', 'A', '2024-12-31');
  ok(r.c === 'odd' && r.why === 'nf', 'התגית שלנו לא מודפסת בדוח — odd nf (Kimco)');
  r = find(X.xcheck(d, f, null, nq(3905e6), { face: face([[C, 'Capital expenditures', -260], ['PaymentsToPropertyAndEquipmentAcquisition', 'Acquisitions of property and equipment', -3645]]) }), 'capex', 'A', '2024-12-31');
  ok(r.c === 'def' && r.why === 'capex_acq', 'המקור כולל שורת רכישות מודפסת (תגית פרטית, אין ב־companyfacts) — def capex_acq');
  r = find(X.xcheck(d, f, null, nq(300e6)), 'capex', 'A', '2024-12-31');
  ok(r.c === 'odd' && !r.why, 'בלי הדוח המודפס — odd בלי הסבר');
}
ok(X.PROBLEM.has('odd') && !X.PROBLEM.has('def') && !X.PROBLEM.has('okd'), 'odd = בעיה בסיכום; def (עם הסבר) ו־okd — לא');
console.log('\nכל ' + n + ' הבדיקות עברו ✓');
