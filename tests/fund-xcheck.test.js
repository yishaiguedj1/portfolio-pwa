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
// סבב 2 (26/10/2026): רווח נקי, רבעון רביעי ומניות
{
  const NI = 'NetIncomeLoss';
  // (א) רבעון רביעי כפי שדווח לראשונה — השנה הוצגה מחדש אחר כך ותשעת החודשים לא (International Flavors 2024: ‎−46 כמו בהודעה, החישוב הפשוט ‎−26)
  const fa = facts([[NI, 'USD', [[...Y(2024), 243e6, '10-K', '2025-02-28'], [...Y(2024), 263e6, '10-K', '2026-02-27'], ['2024-01-01', '2024-09-30', 289e6, '10-Q', '2024-11-05']]]]);
  const da = base({ tags: { ni: NI }, fy: ['2023-12-31', '2024-12-31'], q: ['2024-12-31'], A: { ni: [null, 263e6] }, Q: { ni: [-46e6] }, derived: { ni: ['2024-12-31'] } });
  const ra = find(X.xcheck(da, fa, null, null), 'ni', 'Q', '2024-12-31');
  ok(ra.c === 'ok' && ra.raw === -46e6 && /orig/.test(ra.rf), 'רבעון רביעי מהשנה ותשעת החודשים כפי שדווחו לראשונה — מאושר (rf orig), לא bug');
  // (ב) המקורות החיצוניים = הרבעון לפני שהחברה תיקנה את תשעת החודשים בדוח השנתי (Alnylam, Monolithic Power) — okd q_orig
  const fb = facts([[NI, 'USD', [['2025-01-01', '2025-09-30', 445.8e6, '10-Q', '2025-11-05'], ['2025-01-01', '2025-09-30', 449.8e6, '10-K', '2026-02-27'], [...Y(2025), 621.5e6, '10-K', '2026-02-27']]]]);
  const db = base({ tags: { ni: NI }, fy: ['2024-12-31', '2025-12-31'], q: ['2025-12-31'], A: { ni: [null, 621.5e6] }, Q: { ni: [171.7e6] }, derived: { ni: ['2025-12-31'] } });
  const yb = { fy: [], q: ['2025-12-31'], A: {}, Q: { ni: [175.7e6] } }, nb = { A: null, Q: { ends: ['2025-12-31'], v: { nic: { '2025-12-31': 175.7e6 } } } };
  const rb = find(X.xcheck(db, fb, yb, nb), 'ni', 'Q', '2025-12-31');
  ok(rb.c === 'okd' && rb.why === 'q_orig', 'Yahoo ו־Nasdaq = תשעת החודשים לפני התיקון — הגדרה (q_orig), לא ext');
  // (ג) הרווח לבעלי המניות = רווח כולל פחות זכויות מיעוט (תגית מורכבת של fundamentals)
  const C = 'ProfitLoss-NetIncomeLossAttributableToNoncontrollingInterest';
  const fc = facts([['ProfitLoss', 'USD', [[...Y(2025), -87.14e6, '10-K', '2026-02-09']]], ['NetIncomeLossAttributableToNoncontrollingInterest', 'USD', [[...Y(2025), 1.294e6, '10-K', '2026-02-09']]]]);
  const dc = base({ tags: { ni: C }, fy: ['2024-12-31', '2025-12-31'], A: { ni: [null, -88.434e6] } });
  const rc = find(X.xcheck(dc, fc, null, null), 'ni', 'A', '2025-12-31');
  ok(rc.c === 'ok' && Math.round(rc.raw) === -88434000, 'תגית מורכבת (ProfitLoss פחות זכויות מיעוט) — SEC הגולמי כהפרש');
  // (ד) תגית משלימה: זו שתואמת אותנו (CME — ProfitLoss), לא הראשונה ברשימה (הרווח לבעלי המניות)
  const fd = facts([[NI, 'USD', [[...Y(2024), 3525.8e6, '10-K', '2025-02-27']]], ['NetIncomeLossAvailableToCommonStockholdersBasic', 'USD', [['2024-07-01', '2024-09-30', 901.3e6, '10-Q', '2024-11-08']]],
    ['ProfitLoss', 'USD', [['2024-07-01', '2024-09-30', 912.8e6, '10-Q', '2024-11-08']]]]);
  const dd = base({ tags: { ni: NI }, fy: ['2023-12-31', '2024-12-31'], q: ['2024-09-30'], A: { ni: [null, 3525.8e6] }, Q: { ni: [912.8e6] } });
  const rd = find(X.xcheck(dd, fd, null, null, { cand: { ni: [NI, 'NetIncomeLossAvailableToCommonStockholdersBasic', 'ProfitLoss'] } }), 'ni', 'Q', '2024-09-30');
  ok(rd.c === 'ok' && rd.rf === 'ProfitLoss', 'תגית משלימה — זו שתואמת (ProfitLoss), לא הראשונה ברשימה');
  // (ה) חברה זרה: Yahoo לפי ADS (4 מניות רגילות) — okd y_ads, לא one
  const fe = facts([['WeightedAverageNumberOfDilutedSharesOutstanding', 'shares', [[...Y(2025), 5929.576e6, '20-F', '2026-04-29']]]]);
  const de = base({ face: { form: '20-F' }, tags: { sh: 'WeightedAverageNumberOfDilutedSharesOutstanding' }, fy: ['2024-12-31', '2025-12-31'], A: { sh: [null, 5929.576e6] } });
  const re = find(X.xcheck(de, fe, { fy: ['2025-12-31'], q: [], A: { sh: [1482.394e6] }, Q: {} }, null), 'sh', 'A', '2025-12-31');
  ok(re.c === 'okd' && re.why === 'y_ads', 'Yahoo לפי ADS (יחס שלם בחברה זרה) — הגדרה, לא one');
  // (ו) ממוצע מניות ברבעון רביעי כשהחברה הגישה בקנה מידה שגוי (McDonald's ‏"720") — האומדן באותו קנה מידה שלנו
  const sh = [[...Y(2024), 721.9, '10-K', '2025-02-24'], [...Q(2024, 1), 723.6, '10-Q', '2024-04-30'], [...Q(2024, 2), 722.1, '10-Q', '2024-08-06'], [...Q(2024, 3), 720, '10-Q', '2024-10-29']];
  const ff = facts([['WeightedAverageNumberOfDilutedSharesOutstanding', 'shares', sh]]);
  const df = base({ tags: { sh: 'WeightedAverageNumberOfDilutedSharesOutstanding' }, fy: ['2023-12-31', '2024-12-31'], q: ['2024-12-31'], A: { sh: [null, 721.9e6] }, Q: { sh: [721.9e6] } });
  const rf = find(X.xcheck(df, ff, null, null), 'sh', 'Q', '2024-12-31');
  ok(rf.c === 'est' && rf.est === 721900000, 'אומדן מניות ברבעון רביעי בקנה המידה שלנו (721.9M, לא 720 מניות)');
}
// 26/10/2026 (סבב 2) — רבעון "כפי שדווח", רבעון ישיר בתגית משלימה, סך התחייבויות מהמאזן שבו התאריך הודפס, הצגה מחדש, רכישות בהשקעות ההוניות
{
  const M = 1e6, R = (s, e, v, form, filed) => [s, e, v * M, form, filed];
  // Becton Dickinson: חצי השנה הוצג מחדש אחרי מכירת עסק (489 במקום 857) — הרבעון השני שלנו 857 − 693 = 164, לא 489 − 693
  const f1 = facts([['NetCashProvidedByUsedInOperatingActivities', 'USD', [R(...Y(2024), 3000, '10-K', '2025-02-01'), R(...Q(2025, 1), 693, '10-Q', '2025-05-01'),
    R('2025-01-01', '2025-06-30', 857, '10-Q', '2025-08-01'), R('2025-01-01', '2025-06-30', 489, '10-Q', '2026-08-01')]]]);
  const d1 = base({ fy: ['2023-12-31', '2024-12-31'], q: ['2025-06-30'], tags: { ocf: 'NetCashProvidedByUsedInOperatingActivities' }, A: { ocf: [null, 3000 * M] }, Q: { ocf: [164 * M] }, derived: { ocf: ['2025-06-30'] } });
  const r1 = find(X.xcheck(d1, f1, null, null), 'ocf', 'Q', '2025-06-30');
  ok(r1.c === 'ok' && /asfiled|orig/.test(r1.rf), 'רבעון מחושב "כפי שדווח" (המצטבר מהדוח הראשון אחרי הקודם) — לא bug מול חיסור של מצטבר שהוצג מחדש');
  // Fortive: רבעון ישיר רק בתגית משלימה, מדוח שהציג מחדש את התשעה חודשים
  const f2 = facts([['PaymentsToAcquirePropertyPlantAndEquipment', 'USD', [R(...Y(2023), 78.6, '10-K', '2024-02-01'), R('2023-01-01', '2023-09-30', 60, '10-Q', '2023-10-30'), R('2023-01-01', '2023-09-30', 50, '10-Q', '2025-10-29'),
    R('2024-01-01', '2024-06-30', 55.6, '10-Q', '2024-07-24'), R('2024-01-01', '2024-09-30', 83.4, '10-Q', '2024-10-30'), R('2024-01-01', '2024-09-30', 63.5, '10-Q', '2025-10-29')]],
    ['PaymentsToAcquireProductiveAssets', 'USD', [R('2024-07-01', '2024-09-30', 21.6, '10-Q', '2025-10-29')]]]);
  const d2 = base({ fy: ['2023-12-31'], q: ['2024-09-30'], tags: { capex: 'PaymentsToAcquirePropertyPlantAndEquipment' }, A: { capex: [78.6 * M] }, Q: { capex: [21.6 * M] } });
  const r2 = find(X.xcheck(d2, f2, null, null, { cand: { capex: ['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets'] } }), 'capex', 'Q', '2024-09-30');
  ok(r2.c === 'ok' && r2.rf === 'PaymentsToAcquireProductiveAssets:q', 'רבעון ישיר בתגית משלימה (מדוח שהציג מחדש) — מאושר, לא bug מול חיסור בין בסיסים');
  // Berkshire: ההון של 2021 בדוח ההון של 2024 (510.3) מול המאזן שבו 2021 הודפס (514.9) — סך ההתחייבויות מהמאזן
  const i = (e, v, form, filed) => [null, e, v * M, form, filed];
  const f3 = facts([['LiabilitiesAndStockholdersEquity', 'USD', [i('2021-12-31', 958784, '10-K', '2022-02-28')]],
    ['StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest', 'USD', [i('2021-12-31', 514930, '10-K', '2022-02-28'), i('2022-12-31', 1, '10-K', '2023-02-27'), i('2021-12-31', 514930, '10-K', '2023-02-27'),
      i('2023-12-31', 1, '10-K', '2024-02-26'), i('2021-12-31', 510299, '10-K', '2024-02-26')]]]);
  const d3 = base({ fy: ['2021-12-31'], tags: { tle: 'LiabilitiesAndStockholdersEquity', eqt: 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest' }, A: { tl: [443854 * M] } });
  const r3 = find(X.xcheck(d3, f3, null, null), 'tl', 'A', '2021-12-31');
  ok(r3.c === 'ok' && r3.raw === 443854 * M, 'סך התחייבויות מחושב — מהמאזן שבו התאריך הודפס, לא מדוח ההון של שנתיים אחר כך');
  // Monolithic Power: מאזן רבעוני שהוצג מחדש ב־10-K; Yahoo ו־Nasdaq — כפי שדווח ב־10-Q
  const f4 = facts([['Assets', 'USD', [i('2025-09-30', 4206, '10-Q', '2025-11-05'), i('2025-09-30', 4107, '10-K', '2026-02-27')]]]);
  const d4 = base({ fy: ['2024-12-31'], q: ['2025-09-30'], tags: { ta: 'Assets' }, Q: { ta: [4107 * M] } });
  const nq4 = { Q: { ends: ['2025-09-30'], v: { ta: { '2025-09-30': 4206 * M } } } };
  const r4 = find(X.xcheck(d4, f4, { fy: [], q: ['2025-09-30'], A: {}, Q: { ta: [4206 * M] } }, nq4), 'ta', 'Q', '2025-09-30');
  ok(r4.c === 'okd' && r4.why === 'restated', 'מקור חיצוני = הערך כפי שדווח לפני הצגה מחדש — הגדרה שלו (restated)');
  // Diamondback: Yahoo ו־Nasdaq = הקידוח + רכישת שטחים
  const f5 = facts([['PaymentsToExploreAndDevelopOilAndGasProperties', 'USD', [R(...Y(2025), 3523, '10-K', '2026-02-01')]], ['PaymentsToAcquireOilAndGasProperty', 'USD', [R(...Y(2025), 5938, '10-K', '2026-02-01')]]]);
  const d5 = base({ fy: ['2025-12-31'], tags: { capex: 'PaymentsToExploreAndDevelopOilAndGasProperties' }, A: { capex: [3523 * M] } });
  const r5 = find(X.xcheck(d5, f5, { fy: ['2025-12-31'], q: [], A: { capex: [9461 * M] }, Q: {} }, { A: { ends: ['2025-12-31'], v: { capex: { '2025-12-31': 9461 * M } } } }), 'capex', 'A', '2025-12-31');
  ok(r5.c !== 'bug' && r5.why === 'capex_acq', 'השקעות הוניות: Yahoo ו־Nasdaq כוללים רכישת שטחים — מוסבר (capex_acq)');
}
// 26/10/2026 (סבב 2) — רווח גולמי, הכנסות ורווח תפעולי
{
  const yy = (o) => ({ fy: ['2024-12-31'], q: [], A: o, Q: {} });
  const nq = (o) => ({ A: { ends: ['2024-12-31'], v: Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { '2024-12-31': v }])) }, Q: null });
  // (א) Ball: השרתון חישב הכנסות − עלות מכר (GrossProfit של SEC — טבלת הרבעונים אחרי פחת — נדחה); הייחוס = אותה נוסחה, לא GrossProfit
  const f1 = facts([['Revenues', 'USD', [[...Y(2024), 3082e6, '10-K', '2025-02-01']]], ['CostOfRevenue', 'USD', [[...Y(2024), 2425e6, '10-K', '2025-02-01']]],
    ['GrossProfit', 'USD', [[...Y(2024), 545e6, '10-K', '2025-02-01']]]]);
  const d1 = base({ tags: { rev: 'Revenues', cogs: 'CostOfRevenue' }, A: { rev: [null, 3082e6], gp: [null, 657e6] } });
  const r1 = find(X.xcheck(d1, f1, null, null, { cand: { gp: ['GrossProfit'] } }), 'gp', 'A', '2024-12-31');
  ok(r1.c === 'ok' && r1.rf === 'rev-cogs', 'רווח גולמי מחושב — מול הנוסחה, לא מול GrossProfit שהשרתון דחה (לא bug)');
  // (ב) Marathon Petroleum: הרווח התפעולי שבדוח כולל חברות כלולות, מכירת נכסים והכנסות אחרות — Yahoo ו־Nasdaq מוציאים: okd
  const f2 = facts([['OperatingIncomeLoss', 'USD', [[...Y(2024), 6796e6, '10-K', '2025-02-01']]], ['IncomeLossFromEquityMethodInvestments', 'USD', [[...Y(2024), 1048e6, '10-K', '2025-02-01']]],
    ['GainLossOnDispositionOfAssets1', 'USD', [[...Y(2024), 28e6, '10-K', '2025-02-01']]], ['OtherOperatingIncome', 'USD', [[...Y(2024), 472e6, '10-K', '2025-02-01']]]]);
  const d2 = base({ tags: { op: 'OperatingIncomeLoss' }, A: { op: [null, 6796e6] } });
  const r2 = find(X.xcheck(d2, f2, yy({ op: [5248e6] }), nq({ op: 5248e6 })), 'op', 'A', '2024-12-31');
  ok(r2.c === 'okd' && r2.why === 'op_oi', 'רווח תפעולי כולל הכנסות אחרות (Marathon) — okd op_oi, לא ext');
  d2.A.op = [null, 7000e6];
  ok(find(X.xcheck(d2, f2, yy({ op: [5248e6] }), nq({ op: 5248e6 })), 'op', 'A', '2024-12-31').c === 'bug', '...ערך שלא תואם ל־SEC — עדיין bug');
  // (ג) EQT: "Total operating revenues" כולל רווח / הפסד מנגזרים (שלילי — הסימן נשמר) — Yahoo ו־Nasdaq = המכירות
  const f3 = facts([['Revenues', 'USD', [[...Y(2024), 7498e6, '10-K', '2025-02-01']]], ['DerivativeInstrumentsNotDesignatedAsHedgingInstrumentsGainLossNet', 'USD', [[...Y(2024), -4643e6, '10-K', '2025-02-01']]]]);
  const d3 = base({ tags: { rev: 'Revenues' }, A: { rev: [null, 7498e6] } });
  const r3 = find(X.xcheck(d3, f3, yy({ rev: [12141e6] }), nq({ rev: 12141e6 })), 'rev', 'A', '2024-12-31');
  ok(r3.c === 'okd' && r3.why === 'rev_oi', 'הכנסות כולל הפסד מנגזרים (EQT) — okd rev_oi');
  // (ד) WEC: רווח גולמי מחושב; Yahoo ו־Nasdaq מנכים גם תפעול ואחזקה — okd gp_opx (לפני gp_calc)
  const f5 = facts([['Revenues', 'USD', [[...Y(2024), 8599.9e6, '10-K', '2025-02-01']]], ['CostOfGoodsAndServicesSold', 'USD', [[...Y(2024), 2656e6, '10-K', '2025-02-01']]],
    ['OtherCostAndExpenseOperating', 'USD', [[...Y(2024), 2158e6, '10-K', '2025-02-01']]]]);
  const d5 = base({ tags: { rev: 'Revenues', cogs: 'CostOfGoodsAndServicesSold' }, A: { rev: [null, 8599.9e6], gp: [null, 5943.9e6] } });
  const r5 = find(X.xcheck(d5, f5, yy({ gp: [3785.9e6] }), nq({ gp: 3785.9e6 })), 'gp', 'A', '2024-12-31');
  ok(r5.c === 'okd' && r5.why === 'gp_opx', 'רווח גולמי של חברת חשמל — המקור מנכה גם תפעול ואחזקה: okd gp_opx');
  // (ה) L3Harris: ב־SEC "רבעון רביעי" = השנה (תיוג שגוי של החברה); השרתון מחשב שנה פחות 9 חודשים — הייחוס בלי הערך הישיר
  const f6 = facts([['OperatingIncomeLoss', 'USD', [[...Y(2024), 2110e6, '10-K', '2025-02-12'], ['2024-01-01', '2024-09-30', 1717e6, '10-Q', '2024-11-01'],
    [...Q(2024, 4), 2110e6, '10-K', '2025-02-12']]]]);
  const d6 = base({ tags: { op: 'OperatingIncomeLoss' }, q: ['2024-12-31'], A: { op: [null, 2110e6] }, Q: { op: [393e6] }, derived: { op: ['2024-12-31'] } });
  const r6 = find(X.xcheck(d6, f6, null, null), 'op', 'Q', '2024-12-31');
  ok(r6.c === 'ok' && r6.raw === 393e6 && /cum/.test(r6.rf), 'רבעון רביעי שתויג כשנה ב־SEC — הייחוס = שנה פחות 9 חודשים (לא bug על הערך הנכון)');
  // (ו) Lennox: הרבעון הרביעי מטבלת הרבעונים של ה־10-K; Yahoo ו־Nasdaq = השנה פחות תשעת החודשים כפי שדווחו ב־10-Q
  const f7 = facts([['GrossProfit', 'USD', [[...Y(2024), 1734.8e6, '10-K', '2025-02-17'], ['2024-01-01', '2024-09-30', 1319.6e6, '10-Q', '2024-10-22'],
    ['2024-01-01', '2024-09-30', 1345.5e6, '10-K', '2025-02-17'], [...Q(2024, 4), 389.3e6, '10-K', '2025-02-17']]]]);
  const d7 = base({ tags: { gp: 'GrossProfit' }, q: ['2024-12-31'], A: { gp: [null, 1734.8e6] }, Q: { gp: [389.3e6] } });
  const q4 = { fy: [], q: ['2024-12-31'], A: {}, Q: { gp: [415.2e6] } }, nq4 = { A: null, Q: { ends: ['2024-12-31'], v: { gp: { '2024-12-31': 415.2e6 } } } };
  const r7 = find(X.xcheck(d7, f7, q4, nq4), 'gp', 'Q', '2024-12-31');
  ok(r7.c === 'okd' && r7.why === 'q_orig', 'רבעון רביעי מטבלת הרבעונים המעודכנת — המקורות = שנה פחות 9 חודשים כפי שדווחו: okd q_orig');
}
console.log('\nכל ' + n + ' הבדיקות עברו ✓');
