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
  ok(r.c === 'def', 'בלי השדות החלופיים — נשאר def');
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
console.log('\nכל ' + n + ' הבדיקות עברו ✓');
