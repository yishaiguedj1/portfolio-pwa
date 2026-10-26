// 25/10/2026 — שכבת הנתונים של "ניתוח חברה" (ibkr-proxy/lib/fundamentals.js + op:'fund'/'macro' ב־/api/history).
// נתונים סינתטיים בלבד (בלי רשת): נרמול companyfacts של SEC, גזירת רבעונים, פיצולים, בדיקות אימות, Yahoo, Treasury/FRED,
// והמסלול המלא דרך הפונקציה של Vercel עם fetch מדומה. הרצה: node tests/fundamentals.test.js
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const near = (a, b, t = 1e-6) => a != null && b != null && Math.abs(a - b) <= t;
const root = path.join(__dirname, '..');
const F = require(path.join(root, 'ibkr-proxy/lib/fundamentals.js'));

/* ---------- companyfacts סינתטי ---------- */
function facts(tags) {
  const g = {};
  for (const [tag, unit, rows] of tags) g[tag] = { units: { [unit]: rows.map(([start, end, val, form, filed, fy]) => ({ start: start || undefined, end, val, form, filed, fy: fy || 2099, fp: 'FY' })) } };
  return { facts: { 'us-gaap': Object.assign(g, Object.fromEntries(Array.from({ length: 25 }, (_, i) => ['Filler' + i, { units: { USD: [] } }]))) } };
}
const Y = (y) => [y + '-01-01', y + '-12-31'];
const ACME = facts([
  // החלפת תגית: Revenues עד 2017, ואחר כך RevenueFromContract…; 2019 תוקן לאחור בדוח של 2021 (fy=2021 מטעה — לא משנה)
  ['Revenues', 'USD', [[...Y(2016), 100, '10-K', '2017-02-01'], [...Y(2017), 120, '10-K', '2018-02-01']]],
  ['RevenueFromContractWithCustomerExcludingAssessedTax', 'USD', [
    [...Y(2018), 150, '10-K', '2019-02-01'], [...Y(2019), 180, '10-K', '2020-02-01', 2019], [...Y(2019), 181, '10-K', '2021-02-01', 2021], [...Y(2020), 200, '10-K', '2021-02-01'],
    ['2020-01-01', '2020-03-31', 45, '10-Q', '2020-05-01'], ['2020-04-01', '2020-06-30', 50, '10-Q', '2020-08-01'], ['2020-07-01', '2020-09-30', 52, '10-Q', '2020-11-01'],
    ['2020-01-01', '2020-09-30', 147, '10-Q', '2020-11-01'],
    ['2021-01-01', '2021-03-31', 55, '10-Q', '2021-05-01'], ['2021-04-01', '2021-06-30', 60, '10-Q', '2021-08-01'], ['2021-01-01', '2021-06-30', 115, '10-Q', '2021-08-01']]],
  ['CostOfRevenue', 'USD', [[...Y(2020), 80, '10-K', '2021-02-01']]],
  ['NetIncomeLoss', 'USD', [[...Y(2018), 150, '10-K', '2019-02-01'], [...Y(2019), 200, '10-K', '2020-02-01'], [...Y(2020), 220, '10-K', '2021-02-01']]],
  // רווח למניה ומספר מניות — 2018–2019 דווחו רק לפני הפיצול 2:1 (15/06/2020)
  ['EarningsPerShareDiluted', 'USD/shares', [[...Y(2018), 1.5, '10-K', '2019-02-01'], [...Y(2019), 2.0, '10-K', '2020-02-01'], [...Y(2020), 1.1, '10-K', '2021-02-01']]],
  ['WeightedAverageNumberOfDilutedSharesOutstanding', 'shares', [[...Y(2018), 100, '10-K', '2019-02-01'], [...Y(2019), 100, '10-K', '2020-02-01'], [...Y(2020), 200, '10-K', '2021-02-01']]],
  // תזרים — רק מצטבר מתחילת השנה (כמו ב־10-Q), כולל השנה הפתוחה 2021
  ['NetCashProvidedByUsedInOperatingActivities', 'USD', [
    ['2020-01-01', '2020-03-31', 10, '10-Q', '2020-05-01'], ['2020-01-01', '2020-06-30', 25, '10-Q', '2020-08-01'], ['2020-01-01', '2020-09-30', 45, '10-Q', '2020-11-01'],
    [...Y(2020), 70, '10-K', '2021-02-01'], ['2021-01-01', '2021-03-31', 12, '10-Q', '2021-05-01'], ['2021-01-01', '2021-06-30', 30, '10-Q', '2021-08-01']]],
  ['LongTermDebtNoncurrent', 'USD', [[null, '2020-12-31', 50, '10-K', '2021-02-01']]],
  ['LongTermDebtCurrent', 'USD', [[null, '2020-12-31', 5, '10-K', '2021-02-01']]],
  ['Assets', 'USD', [[null, '2019-12-31', 400, '10-K', '2020-02-01'], [null, '2020-12-31', 500, '10-K', '2021-02-01']]],
  ['Liabilities', 'USD', [[null, '2019-12-31', 250, '10-K', '2020-02-01'], [null, '2020-12-31', 300, '10-K', '2021-02-01']]],
  ['StockholdersEquity', 'USD', [[null, '2019-12-31', 150, '10-K', '2020-02-01'], [null, '2020-12-31', 150, '10-K', '2021-02-01']]],
  ['GrossProfit', 'USD', []],
  ['Revenues8K', 'USD', [[...Y(2020), 999, '8-K', '2021-01-15']]],
]);
const d = F.normalizeSec(ACME, [['2020-06-15', 2]]);
const A = (k, e) => d.A[k] && d.A[k][d.fy.indexOf(e)];
const Q = (k, e) => d.Q[k] && d.Q[k][d.q.indexOf(e)];
ok(d && d.fy.join() === '2016-12-31,2017-12-31,2018-12-31,2019-12-31,2020-12-31', 'שנים פיסקליות לפי תאריכי התקופה (לא לפי fy של הדוח)');
ok(A('rev', '2016-12-31') === 100 && A('rev', '2018-12-31') === 150, 'החלפת תגית: Revenues עד 2017, RevenueFromContract מ־2018');
ok(A('rev', '2019-12-31') === 181, 'תיקון לאחור: הערך שהוגש אחרון גובר (181, לא 180)');
ok(Q('rev', '2020-12-31') === 53, 'רבעון 4 בהכנסות = שנה פחות 9 חודשים מצטברים (200 − 147)');
ok(Q('ocf', '2020-06-30') === 15 && Q('ocf', '2020-09-30') === 20 && Q('ocf', '2020-12-31') === 25, 'תזרים מצטבר → רבעונים (15, 20, 25)');
ok(Q('ocf', '2021-06-30') === 18, 'השנה הפתוחה (2021): רבעון 2 = 30 − 12');
ok(d.derived.ocf.includes('2021-06-30') && d.derived.rev.includes('2020-12-31'), 'רבעונים נגזרים מסומנים');
ok(A('gp', '2020-12-31') === 120, 'רווח גולמי חסר = הכנסות − עלות ההכנסות');
ok(A('debt', '2020-12-31') === 55, 'חוב בלי LongTermDebt = לא שוטף + שוטף');
ok(A('eps', '2019-12-31') === 1 && A('sh', '2019-12-31') === 200 && A('eps', '2018-12-31') === 0.75, 'פיצול 2:1: שנים שדווחו לפניו מתוקנות');
ok(A('eps', '2020-12-31') === 1.1 && A('sh', '2020-12-31') === 200, 'שנים אחרי הפיצול לא נוגעים בהן');
ok(!d.fy.includes('2020-12-31') || A('rev', '2020-12-31') === 200, 'טופס 8-K לא נכנס');

/* ---------- רווח למניה ברבעון הרביעי (26/10/2026): לפי ממוצע המניות של הרבעון, לא של השנה ---------- */
{
  const qd = (a, b, v, f) => [a, b, v, '10-Q', f];
  const BUY = facts([
    ['Revenues', 'USD', [[...Y(2024), 400, '10-K', '2025-02-01'], qd('2024-01-01', '2024-03-31', 100, '2024-05-01'), qd('2024-04-01', '2024-06-30', 100, '2024-08-01'), qd('2024-07-01', '2024-09-30', 100, '2024-11-01')]],
    ['NetIncomeLoss', 'USD', [[...Y(2024), 400, '10-K', '2025-02-01'], qd('2024-01-01', '2024-03-31', 100, '2024-05-01'), qd('2024-04-01', '2024-06-30', 100, '2024-08-01'), qd('2024-07-01', '2024-09-30', 100, '2024-11-01')]],
    ['WeightedAverageNumberOfDilutedSharesOutstanding', 'shares', [[...Y(2024), 102.5, '10-K', '2025-02-01'], qd('2024-01-01', '2024-03-31', 110, '2024-05-01'), qd('2024-04-01', '2024-06-30', 105, '2024-08-01'), qd('2024-07-01', '2024-09-30', 100, '2024-11-01')]],
  ]);
  const db = F.normalizeSec(BUY, []), iq = db.q.indexOf('2024-12-31');
  ok(iq >= 0 && Math.abs(db.Q.sh[iq] - 95) < 1e-9, 'מניות ברבעון הרביעי ≈ 4 × ממוצע השנה פחות שלושת הרבעונים (קונה מניות חוזרות: 95, לא 102.5)');
  ok(db.Q.eps[iq] === 1.05 && db.derived.eps.includes('2024-12-31'), 'רווח למניה ברבעון הרביעי = 100 ÷ 95 (לא ÷ 102.5), מסומן כנגזר');
  const ODD = facts([['Revenues', 'USD', [[...Y(2024), 400, '10-K', '2025-02-01'], qd('2024-01-01', '2024-03-31', 100, '2024-05-01'), qd('2024-04-01', '2024-06-30', 100, '2024-08-01'), qd('2024-07-01', '2024-09-30', 100, '2024-11-01')]],
    ['NetIncomeLoss', 'USD', [[...Y(2024), 400, '10-K', '2025-02-01'], qd('2024-01-01', '2024-03-31', 100, '2024-05-01'), qd('2024-04-01', '2024-06-30', 100, '2024-08-01'), qd('2024-07-01', '2024-09-30', 100, '2024-11-01')]],
    ['WeightedAverageNumberOfDilutedSharesOutstanding', 'shares', [[...Y(2024), 100, '10-K', '2025-02-01'], qd('2024-01-01', '2024-03-31', 100, '2024-05-01'), qd('2024-04-01', '2024-06-30', 100, '2024-08-01'), qd('2024-07-01', '2024-09-30', 160, '2024-11-01')]]]);
  // מספר המניות השנתי בקנה מידה שגוי (McDonald's: "721.9 מניות") — מתוקן לפני הרבעון הרביעי, אחרת רווח למניה של מיליונים
  const MCD = facts([...Object.entries(BUY.facts['us-gaap']).filter(([t]) => !/^Filler|Weighted/.test(t)).map(([t, g]) => [t, 'USD', g.units.USD.map((x) => [x.start, x.end, x.val, x.form, x.filed])]),
    ['EarningsPerShareDiluted', 'USD/shares', [[...Y(2024), 4, '10-K', '2025-02-01'], qd('2024-01-01', '2024-03-31', 1, '2024-05-01'), qd('2024-04-01', '2024-06-30', 1, '2024-08-01'), qd('2024-07-01', '2024-09-30', 1, '2024-11-01')]],
    ['WeightedAverageNumberOfDilutedSharesOutstanding', 'shares', [[...Y(2024), 100e-6, '10-K', '2025-02-01'], qd('2024-01-01', '2024-03-31', 100, '2024-05-01'), qd('2024-04-01', '2024-06-30', 100, '2024-08-01'), qd('2024-07-01', '2024-09-30', 100, '2024-11-01')]]]);
  const dm4 = F.normalizeSec(MCD, []), im = dm4.q.indexOf('2024-12-31');
  ok(Math.abs(dm4.Q.sh[im] - 100) < 1e-6 && dm4.Q.eps[im] === 1, 'מספר מניות שנתי בקנה מידה שגוי — מתוקן לפני הרבעון הרביעי (1, לא מיליון)');
  // חלק הרווח שבבסיס הרווח למניה — לפי השנה (P&G: הבכורה חוזרת במדולל) — 4.4 × 100 ÷ 400 = 1.1
  const PG = facts([...Object.entries(BUY.facts['us-gaap']).filter(([t]) => !/^Filler/.test(t)).map(([t, g]) => [t, Object.keys(g.units)[0], g.units[Object.keys(g.units)[0]].map((x) => [x.start, x.end, x.val, x.form, x.filed])]),
    ['EarningsPerShareDiluted', 'USD/shares', [[...Y(2024), 4.4 * 400 / 102.5 / 4, '10-K', '2025-02-01']]]]);
  const dpg = F.normalizeSec(PG, []), ip = dpg.q.indexOf('2024-12-31');
  ok(dpg.Q.eps[ip] === Math.round(100 * 1.1 / 95 * 100) / 100, 'רבעון רביעי: הרווח × היחס של השנה (רווח למניה × מניות ÷ רווח נקי)');
  // רבעון מחושב: המספר שהחברה פרסמה (Yahoo) גובר כשהוא קרוב (Bank of America ‎0.94 → 0.98); רחוק / סימן הפוך — לא נוגעים
  const sq = { q: ['2025-09-30', '2025-12-31'], Q: { eps: [1.06, 0.94] }, derived: { eps: ['2025-12-31'] } };
  const qf = F.q4Eps(sq, { q: ['2025-09-30', '2025-12-31'], Q: { eps: [1.07, 0.98] } });
  ok(sq.Q.eps[1] === 0.98 && sq.Q.eps[0] === 1.06 && qf.length === 1 && qf[0].k === 'qeps' && qf[0].v === 0.94, 'רבעון מחושב — כפי שהחברה פרסמה (רק הנגזר, נרשם qeps)');
  const sq2 = { q: ['2025-12-31'], Q: { eps: [0.94] }, derived: { eps: ['2025-12-31'] } };
  ok(!F.q4Eps(sq2, { q: ['2025-12-31'], Q: { eps: [1.5] } }).length && sq2.Q.eps[0] === 0.94 && !F.q4Eps(sq2, { q: ['2025-12-31'], Q: { eps: [-0.9] } }).length, 'רחוק מ־15% או בסימן הפוך — החישוב שלנו נשאר');
  // רבעונים שהתגית שלהם היא רכיב אחד ובשנה — הכל (McDonald's: עלות המכר) — לא מוצגים, ונרשם qmix
  const MIX = facts([['Revenues', 'USD', [[...Y(2024), 400, '10-K', '2025-02-01'], qd('2024-01-01', '2024-03-31', 100, '2024-05-01'), qd('2024-04-01', '2024-06-30', 100, '2024-08-01'), qd('2024-07-01', '2024-09-30', 100, '2024-11-01'), qd('2025-01-01', '2025-03-31', 104, '2025-05-01')]],
    ['NetIncomeLoss', 'USD', [[...Y(2024), 40, '10-K', '2025-02-01']]],
    ['CostOfGoodsAndServicesSold', 'USD', [[...Y(2024), 240, '10-K', '2025-02-01'], qd('2024-01-01', '2024-03-31', 9, '2024-05-01'), qd('2024-04-01', '2024-06-30', 9, '2024-08-01'), qd('2024-07-01', '2024-09-30', 9, '2024-11-01'), qd('2025-01-01', '2025-03-31', 9, '2025-05-01')]]]);
  const dx = F.normalizeSec(MIX, []), qc = (e) => dx.Q.cogs && dx.Q.cogs[dx.q.indexOf(e)];
  ok(qc('2024-06-30') == null && qc('2024-12-31') == null && qc('2025-03-31') == null && dx.A.cogs[0] === 240, 'רבעונים על בסיס אחר מהשנה — ריקים (גם בשנה הפתוחה), השנה נשארת');
  ok(dx.qmix.some((c) => c.m === 'cogs' && c.p === '2024-12-31') && F.validate(dx).some((c) => c.k === 'qmix'), 'נרשם qmix');
  ok(dx.Q.rev[dx.q.indexOf('2024-06-30')] === 100, 'מדד תקין באותה חברה — לא נוגעים');
  // עמודת "12 החודשים האחרונים" ב־10-Q (Amazon) — לא שנה פיסקלית
  const TTMQ = facts([['Revenues', 'USD', [[...Y(2023), 400, '10-K', '2024-02-01'], [...Y(2024), 440, '10-K', '2025-02-01'],
    ['2023-04-01', '2024-03-31', 410, '10-Q', '2024-05-01'], ['2023-07-01', '2024-06-30', 420, '10-Q', '2024-08-01'], qd('2024-01-01', '2024-03-31', 105, '2024-05-01')]],
    ['NetIncomeLoss', 'USD', [[...Y(2023), 40, '10-K', '2024-02-01'], [...Y(2024), 44, '10-K', '2025-02-01']]]]);
  ok(F.normalizeSec(TTMQ, []).fy.join() === '2023-12-31,2024-12-31', 'עמודת 12 חודשים אחרונים בדוח רבעוני — לא נעשית סוף שנה');
  ok(F.TAGS && F.TAGS.gaap && F.TAGS.gaap.rev, 'התגיות המועמדות מיוצאות לכלי ההשוואה');
  const dd = F.normalizeSec(ODD, []);
  ok(dd.Q.sh[dd.q.indexOf('2024-12-31')] === 100, 'הערכה רחוקה מהשנה ביותר מ־12% (40 מול 100) — ממוצע השנה');
}

const chk = F.validate(d);
ok(chk.some((c) => c.k === 'bal' && c.p === '2020-12-31') && !chk.some((c) => c.k === 'bal' && c.p === '2019-12-31'), 'בדיקה: נכסים ≠ התחייבויות + הון ב־2020 מסומן, 2019 תקין');
ok(chk.every((c) => !(c.k === 'eps' && c.p === '2020-12-31')), 'בדיקה: רווח ≈ EPS × מניות');
const bad = JSON.parse(JSON.stringify(d)); bad.A.rev[bad.fy.indexOf('2017-12-31')] = 1200000;
ok(F.validate(bad).some((c) => c.k === 'scale'), 'בדיקה: קפיצה של סדר גודל מסומנת');
ok(F.crossCheck(d, { fy: ['2020-12-31'], A: { rev: [210], ni: [220] } }).some((c) => c.k === 'xy' && c.m === 'rev'), 'בדיקה צולבת מול Yahoo: הכנסות 200 מול 210 מסומן');

/* שנה פיסקלית ביוני, רבעונים ישירים בלבד */
const JUNE = facts([
  ['Revenues', 'USD', [['2024-07-01', '2025-06-30', 400, '10-K', '2025-08-01'], ['2024-07-01', '2024-09-30', 90, '10-Q', '2024-10-30'],
    ['2024-10-01', '2024-12-31', 100, '10-Q', '2025-01-30'], ['2025-01-01', '2025-03-31', 105, '10-Q', '2025-04-30']]],
]);
const dj = F.normalizeSec(JUNE, []);
ok(dj.fy.join() === '2025-06-30' && dj.Q.rev[dj.q.indexOf('2025-06-30')] === 105, 'שנה ביוני: רבעון 4 = 400 − (90+100+105)');

/* שתי תגיות הכנסות שמודדות דברים שונים (Mastercard 2018–2021: RevenueFromContract… = ברוטו לפני הנחות, Revenues = נטו) */
const yrs = (a, y0) => a.map((v, i) => [...Y(y0 + i), v, '10-K', (y0 + i + 1) + '-02-01']);
const MAX = facts([
  ['Revenues', 'USD', yrs([125, 150, 169, 153, 189, 222, 251], 2017)],
  ['RevenueFromContractWithCustomerExcludingAssessedTax', 'USD', yrs([218, 250, 236, 298], 2018)],
]);
const dm = F.normalizeSec(MAX, []);
const g = (dd, e1, e0) => dd.A.rev[dd.fy.indexOf(e1)] / dd.A.rev[dd.fy.indexOf(e0)] - 1;
ok(dm.A.rev.join() === '125,150,169,153,189,222,251', 'ברוטו מול נטו: נשארת סדרה אחת (נטו) בכל השנים');
ok(near(g(dm, '2020-12-31', '2019-12-31'), 153 / 169 - 1) && near(g(dm, '2022-12-31', '2021-12-31'), 222 / 189 - 1), 'צמיחה 2020 ו־2022 מהנטו בלבד');
// גם כשהתגית הלא נכונה ראשונה ברשימה — היא הפסיקה לדווח, ולכן לא ראשית
const MAX2 = facts([
  ['SalesRevenueNet', 'USD', yrs([218, 250, 236, 298], 2018)],
  ['SalesRevenueGoodsNet', 'USD', yrs([125, 150, 169, 153, 189, 222, 251], 2017)],
]);
ok(F.normalizeSec(MAX2, []).A.rev.join() === '125,150,169,153,189,222,251', 'תגית שהפסיקה לדווח לא נבחרת כראשית גם כשהיא ראשונה בסדר');
// השלמה תקינה: תגית ישנה שמסכימה בשנה המשותפת משלימה שנים חסרות
const FILL = facts([
  ['Revenues', 'USD', yrs([95, 100, 120, 140], 2016).filter((r) => r[1] !== '2017-12-31')],
  ['SalesRevenueNet', 'USD', yrs([94, 95, 100], 2015)],
]);
const df = F.normalizeSec(FILL, []);
ok(df.A.rev.join() === '94,95,100,120,140', 'תגית ישנה שמסכימה משלימה רק את מה שחסר');
// ערך שגוי בתוך התגית הנבחרת (Procter & Gamble: ‏Revenues = ‏28 במקום 83 ב־2012–2014)
const PG = facts([
  ['Revenues', 'USD', [...yrs([77, 81], 2010), ...yrs([28, 29, 29], 2012), ...yrs([71, 65, 65, 67], 2015)]],
  ['SalesRevenueNet', 'USD', yrs([77, 81, 82, 80, 74, 71], 2010)],
]);
ok(F.normalizeSec(PG, []).A.rev.join() === '77,81,82,80,74,71,65,65,67', 'רצף שגוי באמצע מוחלף בתגית שמתיישרת עם השכנים');
// בנק / כרטיסי אשראי (American Express): הסך = הכנסות נטו מהוצאות ריבית, Revenues = רק חלק
ok(F.normalizeSec(facts([['Revenues', 'USD', yrs([38, 41], 2024)], ['RevenuesNetOfInterestExpense', 'USD', yrs([66, 72], 2024)]]), []).A.rev.join() === '66,72', 'בנקים: RevenuesNetOfInterestExpense קודם ל־Revenues');
// צניחה אמיתית (בלי תגית חלופית) לא נוגעים בה
ok(F.normalizeSec(facts([['Revenues', 'USD', yrs([100, 40, 110], 2019)]]), []).A.rev.join() === '100,40,110', 'צניחה אמיתית בלי חלופה — נשארת');
/* ---------- מאזן (26/10/2026): איזו הגשה ואיזו תגית לכל תאריך ---------- */
{
  const inst = (end, v, form, filed) => [null, end, v, form, filed];
  const base = [['Revenues', 'USD', yrs([500, 520, 540, 560], 2022)], ['NetIncomeLoss', 'USD', yrs([50, 52, 54, 56], 2022)]];
  // (1) מאזן 2022: 10-K של 2022 (100) ו־10-K של 2023 (השוואה, 100) מול 10-K של 2024 — יתרת פתיחה בתזרים אחרי הפרדת פעילות (90)
  //     ‏10-Q מאוחר עם הצגה מחדש (80) — לא גובר על הדוח השנתי (Baxter/Carrier/Leidos; APTV/HON/BDX)
  const CF1 = facts([...base, ['CashAndCashEquivalentsAtCarryingValue', 'USD', [
    inst('2022-12-31', 100, '10-K', '2023-02-01'), inst('2021-12-31', 70, '10-K', '2023-02-01'),
    inst('2023-12-31', 120, '10-K', '2024-02-01'), inst('2022-12-31', 100, '10-K', '2024-02-01'),
    inst('2024-12-31', 130, '10-K', '2025-02-01'), inst('2023-12-31', 120, '10-K', '2025-02-01'), inst('2022-12-31', 90, '10-K', '2025-02-01'),
    inst('2025-12-31', 140, '10-K', '2026-02-01'), inst('2026-06-30', 150, '10-Q', '2026-08-01'), inst('2025-12-31', 80, '10-Q', '2026-08-01')]]]);
  const c1 = F.normalizeSec(CF1, []), ca = (dd, e) => dd.A.cash[dd.fy.indexOf(e)];
  ok(ca(c1, '2022-12-31') === 100, 'מאזן: הערך מהמאזן השנתי (100), לא מתזרים של דוח שנתי מאוחר בשנתיים (90)');
  ok(ca(c1, '2025-12-31') === 140, 'מאזן: הדוח השנתי גובר על השוואה מוצגת מחדש בדוח רבעוני מאוחר (140, לא 80)');
  // (2) מזומן: התגית הכוללת מזומן מוגבל (סך התזרים, כולל מזומן של פעילות מוחזקת למכירה) רק כשאין שורת מאזן לאותו תאריך;
  //     "Cash" (מבטחים/שירותים) נחשב שורת מאזן; כשהתגית הרגילה מופיעה רק ב־10-Q מאוחר — הדוח השנתי בתגית הכוללת גובר (Zoetis)
  const R = 'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents';
  const CF2 = facts([...base,
    ['CashAndCashEquivalentsAtCarryingValue', 'USD', [inst('2022-12-31', 483, '10-K', '2023-02-01'), inst('2024-12-31', 469, '10-K', '2025-02-01'),
      inst('2025-12-31', 245, '10-Q', '2026-05-01'), inst('2026-03-31', 194, '10-Q', '2026-05-01')]],
    [R, 'USD', [inst('2022-12-31', 552, '10-K', '2023-02-01'), inst('2023-12-31', 735, '10-K', '2024-02-01'), inst('2024-12-31', 469, '10-K', '2025-02-01'),
      inst('2025-12-31', 231, '10-K', '2026-02-01'), inst('2026-03-31', 194, '10-Q', '2026-05-01')]],
    ['Cash', 'USD', [inst('2023-12-31', 703, '10-K', '2024-02-01')]]]);
  const c2 = F.normalizeSec(CF2, []);
  ok(ca(c2, '2022-12-31') === 483 && ca(c2, '2023-12-31') === 703 && ca(c2, '2024-12-31') === 469, 'מזומן: שורת המאזן (483, ‏Cash 703), לא סך התזרים הכולל מזומן מוגבל (552, 735)');
  ok(ca(c2, '2025-12-31') === 231 && c2.tags.cash === 'CashAndCashEquivalentsAtCarryingValue', 'מזומן: 10-K בתגית הכוללת (231) גובר על השוואה מוצגת מחדש בתגית הרגילה ב־10-Q (245)');
  // (2ב) רק הסך הכולל מזומן מוגבל (Chevron — שורת המאזן בתגית של החברה): פחות המזומן המוגבל השוטף והלא שוטף של אותו תאריך
  const CVX = facts([...base, [R, 'USD', [inst('2024-12-31', 8262, '10-K', '2025-02-01'), inst('2025-12-31', 7285, '10-K', '2026-02-01')]],
    ['RestrictedCashCurrent', 'USD', [inst('2025-12-31', 174, '10-K', '2026-02-01')]], ['RestrictedCashNoncurrent', 'USD', [inst('2025-12-31', 818, '10-K', '2026-02-01')]]]);
  const bsFace = (ns, tag, v) => ({ bs: { title: '', cols: [{ end: '2025-12-31' }], scale: { cur: 1, sh: 1 }, rows: [{ ns, tag, label: 'Cash and cash equivalents', v: [v] }] } });
  const c3 = F.normalizeSec(CVX, [], bsFace('cvx', 'CashAndCashEquivalentsExcludingTimeDeposits', 6293));
  ok(ca(c3, '2025-12-31') === 6293 && ca(c3, '2024-12-31') === 8262, 'מזומן מהסך הכולל מזומן מוגבל: פחות המזומן המוגבל שדווח (7285 − 174 − 818); בלי פירוט — כמו שהוא');
  // ‏Bank of America / GE / Erie: הסך הכולל הוא שורת המאזן עצמה — לא מחסרים (וגם בלי מאזן מודפס)
  ok(ca(F.normalizeSec(CVX, [], bsFace('us-gaap', R, 7285)), '2025-12-31') === 7285 && ca(F.normalizeSec(CVX, []), '2025-12-31') === 7285, 'הסך הכולל הוא שורת המאזן (או בלי מאזן מודפס) — בלי חיסור');
  // (3) Amazon: ב־10-Q גם "12 חודשים שהסתיימו" — לא שנה פיסקלית
  const AM = facts([['Revenues', 'USD', yrs([500, 520], 2023)], ['NetIncomeLoss', 'USD', [...yrs([50, 52], 2023), ['2024-04-01', '2025-03-31', 55, '10-Q', '2025-05-01'],
    ['2024-07-01', '2025-06-30', 58, '10-Q', '2025-08-01']]]]);
  ok(F.normalizeSec(AM, []).fy.join() === '2023-12-31,2024-12-31', 'שנים פיסקליות רק מדוח שנתי — 12 חודשים ב־10-Q לא נספרים כשנה');
  // (4) סך התחייבויות שלא דווח = סך התחייבויות והון פחות כל ההון וההון הזמני — גם בתגית ברבים (ADM: ‏$287M נספרו כהתחייבות).
  //     LiabilitiesNoncurrent לא נכנס: בחברות חשמל ומים הוא רק "התחייבויות נדחות ואחרות" (AWK/CNP/Eversource) — בלי החוב
  const TL = facts([...base, ['LiabilitiesAndStockholdersEquity', 'USD', [inst('2025-12-31', 1000, '10-K', '2026-02-01'), inst('2024-12-31', 900, '10-K', '2026-02-01')]],
    ['StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest', 'USD', [inst('2025-12-31', 400, '10-K', '2026-02-01'), inst('2024-12-31', 380, '10-K', '2026-02-01')]],
    ['StockholdersEquity', 'USD', [inst('2025-12-31', 395, '10-K', '2026-02-01'), inst('2024-12-31', 375, '10-K', '2026-02-01')]],
    ['TemporaryEquityCarryingAmountIncludingPortionAttributableToNoncontrollingInterests', 'USD', [inst('2025-12-31', 30, '10-K', '2026-02-01'), inst('2024-12-31', 20, '10-K', '2026-02-01')]],
    ['LiabilitiesCurrent', 'USD', [inst('2025-12-31', 250, '10-K', '2026-02-01'), inst('2024-12-31', 240, '10-K', '2026-02-01')]],
    ['LiabilitiesNoncurrent', 'USD', [inst('2025-12-31', 200, '10-K', '2026-02-01')]]]); // חלקי — לא נכנס
  const t4 = F.normalizeSec(TL, []), tl = (e) => t4.A.tl[t4.fy.indexOf(e)];
  ok(tl('2025-12-31') === 570 && tl('2024-12-31') === 500, 'סך התחייבויות מחושב: 1000 − 400 − 30 ו־900 − 380 − 20 (הון זמני בתגית ברבים; לא שוטפות + לא שוטפות)');
}

/* ---------- שכבה 1: הדוח כפי שהוגש (FilingSummary + דפי R) ---------- */
const SF = require(path.join(root, 'ibkr-proxy/lib/secface.js'));
const FSUM = `<FilingSummary><MyReports>
<Report instance="x"><HtmlFileName>R2.htm</HtmlFileName><ShortName>Cover</ShortName><MenuCategory>Cover</MenuCategory></Report>
<Report instance="x"><HtmlFileName>R3.htm</HtmlFileName><ShortName>Consolidated Statements of Operations</ShortName><MenuCategory>Statements</MenuCategory></Report>
<Report instance="x"><HtmlFileName>R4.htm</HtmlFileName><ShortName>Consolidated Statements of Comprehensive Income</ShortName><MenuCategory>Statements</MenuCategory></Report>
<Report instance="x"><HtmlFileName>R5.htm</HtmlFileName><ShortName>Consolidated Balance Sheets</ShortName><MenuCategory>Statements</MenuCategory></Report>
<Report instance="x"><HtmlFileName>R6.htm</HtmlFileName><ShortName>Consolidated Balance Sheets (Parenthetical)</ShortName><MenuCategory>Statements</MenuCategory></Report>
<Report instance="x"><HtmlFileName>R8.htm</HtmlFileName><ShortName>Consolidated Statements of Cash Flows</ShortName><MenuCategory>Statements</MenuCategory></Report>
</MyReports></FilingSummary>`;
ok(JSON.stringify(SF.pickStatements(FSUM)) === '{"is":"R3.htm","bs":"R5.htm","cf":"R8.htm"}', 'FilingSummary: רווח והפסד, מאזן ותזרים — בלי "רווח כולל" ובלי Parenthetical');
const row = (cls, tag, label, vals) => `<tr class="${cls}"><td class="pl"><a onclick="Show.showAR( this, 'defref_${tag}', window );">${label}</a></td>${vals.map((v) => `<td class="nump">${v}<span></span></td>`).join('')}</tr>`;
const RIS = `<table><tr><th class="tl" colspan="1" rowspan="2"><div><strong>Consolidated Statements of Operations - USD ($)<br> shares in Millions, $ in Millions</strong></div></th><th class="th" colspan="2">12 Months Ended</th></tr>
<tr><th class="th"><div>Dec. 31, 2025</div></th><th class="th"><div>Dec. 31, 2024</div></th></tr>
${row('ro', 'us-gaap_Revenues', 'Net revenue', ['$ 222', '$ 189'])}${row('re', 'us-gaap_IncomeTaxExpenseBenefit', 'Income tax', ['(30)', '(25)'])}${row('reu', 'us-gaap_EarningsPerShareDiluted', 'Diluted EPS', ['$ 1.50', '$ 1.20'])}
${row('ro', 'us-gaap_WeightedAverageNumberOfDilutedSharesOutstanding', 'Diluted shares', ['100', '100'])}</table>`;
const pr = SF.parseR(RIS);
ok(pr.cols.map((c) => c.end + '/' + c.months).join() === '2025-12-31/12,2024-12-31/12' && pr.scale.cur === 1e6 && pr.scale.sh === 1e6, 'דף R: תאריכים, "12 Months Ended" וקנה מידה');
ok(SF.rowVals(pr, pr.rows[0]).join() === '222000000,189000000' && SF.rowVals(pr, pr.rows[1]).join() === '-30000000,-25000000' && SF.rowVals(pr, pr.rows[2]).join() === '1.5,1.2' && SF.rowVals(pr, pr.rows[3])[0] === 1e8, 'דף R: מיליונים, סוגריים = מינוס, למניה בלי קנה מידה, מניות לפי "shares in"');
// ישות של < בכותרת שורה (&#60;script&#62;) — אחרי הפענוח לא נשאר אף < או > (טקסט בלבד, CodeQL)
{ const rx = SF.parseR(`<table><tr><th class="tl"><div><strong>Consolidated Balance Sheets - USD ($)<br> $ in Millions</strong></div></th><th class="th"><div>Dec. 31, 2025</div></th></tr>${row('ro', 'us-gaap_Assets', 'Assets &#60;script&#62;x&#60;/script&#62;', ['$ 5'])}</table>`);
  ok(rx.rows[0] && !/[<>]/.test(rx.rows[0].label) && rx.rows[0].v[0] === 5, 'דף R: ישויות של < ו־> לא הופכות לתגית בכותרת השורה'); }
// תגית בדוח גוברת על סדר העדיפות; כל ערך מושווה לדוח
const FACEX = facts([
  ['RevenuesNetOfInterestExpense', 'USD', yrs([180, 210], 2024)],
  ['Revenues', 'USD', yrs([189, 222], 2024)],
  ['IncomeTaxExpenseBenefit', 'USD', yrs([25e6, 30e6], 2024)],
  ['EarningsPerShareDiluted', 'USD/shares', yrs([1.2, 1.5], 2024)],
  ['WeightedAverageNumberOfDilutedSharesOutstanding', 'shares', yrs([100e6, 100e6], 2024)],
]);
FACEX.facts['us-gaap'].Revenues.units.USD.forEach((r) => { r.val *= 1e6; });
FACEX.facts['us-gaap'].RevenuesNetOfInterestExpense.units.USD.forEach((r) => { r.val *= 1e6; });
const dfx = F.normalizeSec(FACEX, [], { is: pr });
ok(dfx.tags.rev === 'Revenues' && dfx.A.rev.join() === '189000000,222000000', 'התגית שהחברה הציגה בדוח גוברת על סדר העדיפות');
const fc = F.faceCheck(dfx, { is: pr });
ok(fc.seen.n === 8 && fc.seen.ok === 8 && !fc.out.length, 'מול הדוח: הכנסות, מס (מינוס בדוח = הוצאה), רווח למניה ומניות — כולם תואמים');
dfx.A.rev[1] = 230e6;
{ const f2 = F.faceCheck(dfx, { is: pr }), x = f2.fill.find((q) => q.m === 'rev');
  ok(x && x.i === 1 && x.v === 222e6 && x.old === 230e6 && !f2.out.length && f2.seen.ok === f2.seen.n, 'ערך שלא תואם לדוח, בשורה אחת עם התגית — מוחלף בזה שהודפס (ffix)'); }
dfx.A.rev[1] = null;
{ const x = F.faceCheck(dfx, { is: pr }).fill.find((q) => q.m === 'rev'); ok(x && x.i === 1 && x.v === 222e6 && x.old === null, 'שנה שחסרה אצלנו והדוח הדפיס אותה — מושלמת (ffill)'); }
dfx.A.rev[1] = 222e6;
// כמה שורות עם אותה תגית: הקרובה ביותר, סכום כולן, שורה הפוכה בסימן — ושום החלפה כשאין שורה חד־משמעית
{ const page = (rows) => SF.parseR(`<table><tr><th class="tl" colspan="1" rowspan="2"><div><strong>Statements of Operations - USD ($)<br> $ in Millions</strong></div></th><th class="th" colspan="2">12 Months Ended</th></tr>
<tr><th class="th"><div>Dec. 31, 2025</div></th><th class="th"><div>Dec. 31, 2024</div></th></tr>${rows.map((v) => row('ro', 'us-gaap_Revenues', 'Revenue', v)).join('')}</table>`);
  const D = (a) => ({ tags: { rev: 'Revenues' }, fy: ['2024-12-31', '2025-12-31'], A: { rev: a }, cur: 'USD' });
  const sum = F.faceCheck(D([189e6, 222e6]), { is: page([['150', '120'], ['72', '69']]) });
  ok(sum.seen.n === 2 && sum.seen.ok === 2 && !sum.fill.length, 'Carrier: מוצרים ושירותים באותה תגית — מושווה לסכום השורות');
  const gap = F.faceCheck(D([189e6, null]), { is: page([['150', '120'], ['72', '69']]) }).fill;
  ok(gap.length === 1 && gap[0].v === 222e6, 'שנה חסרה — מושלמת מהסכום שתאם בשנה אחרת');
  const best = F.faceCheck(D([189e6, 222e6]), { is: page([['0', '0'], ['222', '189']]) });
  ok(best.seen.ok === 2 && !best.out.length, 'Diamondback: שורה של חברת הבת עם אותה תגית — נבחרת השורה שתואמת');
  const amb = F.faceCheck(D([189e6, 222e6]), { is: page([['300', '250'], ['50', '40']]) });
  ok(amb.out.length === 2 && !amb.fill.length, 'אף שורה לא תואמת ויש כמה — פער מסומן, בלי החלפה');
  const neg = F.faceCheck(D([189e6, 222e6]), { is: page([['(222)', '(189)']]) });
  ok(neg.seen.ok === 2 && !neg.out.length && !neg.fill.length, 'Mettler: שורה שכולה הפוכה בסימן (תווית הפוכה) — לא פער ולא החלפה'); }
/* ---------- רווח גולמי, רווח תפעולי, רווח נקי והכנסות — מה שהדוח באמת מציג (26/10/2026) ---------- */
{
  const page = (rows, title = 'Consolidated Statements of Operations') => SF.parseR(`<table><tr><th class="tl" colspan="1" rowspan="2"><div><strong>${title} - USD ($)<br> $ in Millions</strong></div></th><th class="th" colspan="2">12 Months Ended</th></tr>
<tr><th class="th"><div>Dec. 31, 2025</div></th><th class="th"><div>Dec. 31, 2024</div></th></tr>${rows.map(([c, t, l, v]) => row(c, t, l, v)).join('')}</table>`);
  const M = (a) => a.map((v) => v * 1e6);
  // UnitedHealth: "Cost of products sold" ליד "Medical costs" — עלות מכר חלקית: בלי עלות מכר ובלי רווח גולמי מחושב
  const UN = facts([['Revenues', 'USD', yrs(M([400, 447]), 2024)], ['CostOfGoodsAndServicesSold', 'USD', yrs(M([46, 50]), 2024)],
    ['OperatingIncomeLoss', 'USD', yrs(M([32, 19]), 2024)], ['NetIncomeLoss', 'USD', yrs(M([14, 12]), 2024)]]);
  const unF = { is: page([['ro', 'us-gaap_Revenues', 'Total revenues', ['447', '400']], ['ro', 'us-gaap_PolicyholderBenefitsAndClaimsIncurredNet', 'Medical costs', ['365', '300']],
    ['ro', 'us-gaap_CostOfGoodsAndServicesSold', 'Cost of products sold', ['50', '46']], ['rou', 'us-gaap_CostsAndExpenses', 'Total operating costs', ['428', '368']],
    ['rou', 'us-gaap_OperatingIncomeLoss', 'Earnings from operations', ['19', '32']], ['rou', 'us-gaap_NetIncomeLoss', 'Net earnings', ['12', '14']]]) };
  const du = F.normalizeSec(UN, [], unF);
  ok(du.gpx === 'part' && !du.A.gp && !du.A.cogs && !du.tags.cogs && du.A.op.join() === M([32, 19]).join(), 'עלות מכר חלקית (UnitedHealth) — בלי עלות מכר ובלי "רווח גולמי" של 89%');
  // Alphabet: "Cost of revenues" ליד מחקר ושיווק, בלי שורת רווח גולמי — הכנסות פחות עלות ההכנסות (כמו אצל כולם)
  const GO = facts([['Revenues', 'USD', yrs(M([350, 403]), 2024)], ['CostOfRevenue', 'USD', yrs(M([146, 163]), 2024)], ['NetIncomeLoss', 'USD', yrs(M([100, 132]), 2024)]]);
  const dg = F.normalizeSec(GO, [], { is: page([['ro', 'us-gaap_Revenues', 'Revenues', ['403', '350']], ['ro', 'us-gaap_CostOfRevenue', 'Cost of revenues', ['163', '146']],
    ['ro', 'us-gaap_ResearchAndDevelopmentExpense', 'R&D', ['60', '49']], ['rou', 'us-gaap_NetIncomeLoss', 'Net income', ['132', '100']]]) });
  ok(dg.gpx === 'ok' && dg.A.gp.join() === M([204, 240]).join() && dg.gpd.length === 2, 'עלות ההכנסות בלי שורת רווח גולמי (Alphabet) — מחושב, ונרשם כמחושב בשנים');
  // McDonald's: CostOfGoodsAndServicesSold רק ב־10-Q (רכיב אחד), ב־10-K אין שורה כזו — גם הרבעונים בלי רווח גולמי
  const MC = facts([['Revenues', 'USD', [...yrs(M([25920, 26885]), 2024), ['2025-01-01', '2025-03-31', 5956e6, '10-Q', '2025-05-01'], ['2025-04-01', '2025-06-30', 6843e6, '10-Q', '2025-08-01']]],
    ['CostOfGoodsAndServicesSold', 'USD', [['2025-01-01', '2025-03-31', 620e6, '10-Q', '2025-05-01'], ['2025-04-01', '2025-06-30', 654e6, '10-Q', '2025-08-01']]],
    ['NetIncomeLoss', 'USD', yrs(M([8223, 8563]), 2024)]]);
  const dm = F.normalizeSec(MC, [], { is: page([['ro', 'us-gaap_Revenues', 'Total revenues', ['26885', '25920']], ['ro', 'mcd_FoodAndPaperCosts', 'Food & paper', ['3006', '2995']],
    ['rou', 'us-gaap_NetIncomeLoss', 'Net income', ['8563', '8223']]]) });
  ok(dm.gpx === 'off' && !dm.Q.gp && !dm.Q.cogs, 'עלות מכר שלא מופיעה בדוח השנתי (McDonald\'s ב־10-Q) — בלי רווח גולמי ברבעונים');
  // Honeywell: OperatingIncomeLoss = "Total Segment profit" בביאור; בדוח רווח והפסד אין רווח תפעולי
  const HO = facts([['Revenues', 'USD', yrs(M([38, 37]), 2024)], ['OperatingIncomeLoss', 'USD', yrs(M([8.6, 8.1]), 2024)], ['NetIncomeLoss', 'USD', yrs(M([5.7, 4.9]), 2024)]]);
  const dh = F.normalizeSec(HO, [], { is: page([['ro', 'us-gaap_Revenues', 'Net sales', ['37', '38']], ['rou', 'us-gaap_IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest', 'Income before taxes', ['5.5', '6.2']],
    ['rou', 'us-gaap_NetIncomeLoss', 'Net income', ['4.9', '5.7']]]) });
  ok(dh.opx === 'off' && !dh.A.op && !dh.tags.op, 'רווח תפעולי שלא בדוח רווח והפסד (Honeywell — רווח המגזרים מהביאור) — לא מוצג');
  ok(F.normalizeSec(HO, []).A.op.join() === M([8.6, 8.1]).join(), '...ובלי דוח לבדוק — כמו קודם');
  // GrossProfit שמתויג רק בביאור (Oracle / Booking: מגזר או מוצר) — לא "הרווח הגולמי" כשהדוח לא מציג אותו
  const OR = facts([['Revenues', 'USD', yrs(M([57, 67]), 2024)], ['GrossProfit', 'USD', yrs(M([21, 24]), 2024)], ['NetIncomeLoss', 'USD', yrs(M([12, 17]), 2024)]]);
  ok(!F.normalizeSec(OR, [], { is: page([['ro', 'us-gaap_Revenues', 'Total revenues', ['67', '57']], ['rou', 'us-gaap_NetIncomeLoss', 'Net income', ['17', '12']]]) }).A.gp
    && F.normalizeSec(OR, []).A.gp.join() === M([21, 24]).join(), 'GrossProfit מהביאורים כשבדוח אין שורת רווח גולמי — לא מוצג (בלי דוח לבדוק — כמו קודם)');
  // Devon: בלי דוח רווח והפסד שזוהה, התזרים מתחיל ב־ProfitLoss (כולל זכויות מיעוט) — הרווח הנקי נשאר NetIncomeLoss
  const DV = facts([['Revenues', 'USD', yrs(M([15, 16]), 2024)], ['NetIncomeLoss', 'USD', yrs(M([2891, 2681]), 2024)], ['ProfitLoss', 'USD', yrs(M([2942, 2731]), 2024)]]);
  const cf = SF.parseR(`<table><tr><th class="tl"><div><strong>Consolidated Statements of Cash Flows - USD ($)<br> $ in Millions</strong></div></th><th class="th" colspan="2">12 Months Ended</th></tr><tr><th class="th"><div>Dec. 31, 2025</div></th><th class="th"><div>Dec. 31, 2024</div></th></tr>${row('ro', 'us-gaap_ProfitLoss', 'Net earnings', ['2731', '2942'])}</table>`);
  ok(F.normalizeSec(DV, [], { cf }).tags.ni === 'NetIncomeLoss', 'Devon: "רווח נקי" מהתזרים (כולל זכויות מיעוט) לא קודם לרווח המיוחס לחברה');
  // עלות המכר בכמה שורות "Cost of …" בדוח (26/10/2026) — כל השורות, לא רק התגית שבדוח
  // EchoStar: "Cost of services" + "Cost of sales - equipment and other" — שתיהן ב־SEC: הסכום (גם ברבעונים)
  const EC = facts([['RevenueFromContractWithCustomerExcludingAssessedTax', 'USD', [...yrs(M([158, 150]), 2024), ['2025-01-01', '2025-03-31', 40e6, '10-Q', '2025-05-01']]],
    ['CostOfGoodsAndServiceExcludingDepreciationDepletionAndAmortization', 'USD', [...yrs(M([101, 94]), 2024), ['2025-01-01', '2025-03-31', 25e6, '10-Q', '2025-05-01']]],
    ['OtherCostOfOperatingRevenue', 'USD', [...yrs(M([16, 17]), 2024), ['2025-01-01', '2025-03-31', 4e6, '10-Q', '2025-05-01']]], ['NetIncomeLoss', 'USD', yrs(M([-1, -14]), 2024)]]);
  const ecF = { is: page([['ro', 'us-gaap_RevenueFromContractWithCustomerExcludingAssessedTax', 'Total revenue', ['150', '158']],
    ['ro', 'us-gaap_CostOfGoodsAndServiceExcludingDepreciationDepletionAndAmortization', 'Cost of services', ['94', '101']],
    ['ro', 'us-gaap_OtherCostOfOperatingRevenue', 'Cost of sales - equipment and other', ['17', '16']], ['rou', 'us-gaap_NetIncomeLoss', 'Net loss', ['(14)', '(1)']]]) };
  const de = F.normalizeSec(EC, [], ecF);
  ok(de.gpx === 'ok' && /\+OtherCostOfOperatingRevenue$/.test(de.tags.cogs) && de.A.gp.join() === M([41, 39]).join() && de.Q.gp[de.q.indexOf('2025-03-31')] === 11e6,
    'EchoStar: שתי שורות "Cost of" בתגיות של SEC — עלות המכר = הסכום, הרווח הגולמי 39 (לא 56), גם ברבעון');
  // SBA: "Cost of site leasing" בתגית פרטית + "Cost of site development"; הסך ב־CostOfRevenue (לא בדוח) — הוא עלות המכר
  const SB = facts([['Revenues', 'USD', yrs(M([268, 281]), 2024)], ['CostOfGoodsAndServicesSold', 'USD', yrs(M([12, 20]), 2024)],
    ['CostOfRevenue', 'USD', yrs(M([58, 69]), 2024)], ['NetIncomeLoss', 'USD', yrs(M([75, 105]), 2024)]]);
  const sbF = { is: page([['rou', 'us-gaap_Revenues', 'Total revenues', ['281', '268']], ['ro', 'sbac_CostOfGoodsSoldDirectOperatingLease', 'Cost of site leasing', ['49', '46']],
    ['ro', 'us-gaap_CostOfGoodsAndServicesSold', 'Cost of site development', ['20', '12']], ['rou', 'us-gaap_NetIncomeLoss', 'Net income', ['105', '75']]]) };
  const ds = F.normalizeSec(SB, [], sbF);
  ok(ds.gpx === 'ok' && ds.tags.cogs === 'CostOfRevenue' && ds.A.gp.join() === M([210, 212]).join(), 'SBA: הסך שאינו בדוח (= סכום שורות העלות) גובר על השורה שבדוח — רווח גולמי 212 (לא 261)');
  // Alnylam: שורה בתגית פרטית שאין ב־SEC, מעל 0.5% מההכנסות — בלי עלות מכר ורווח גולמי מ־SEC ('sum'; Yahoo משלים)
  const AL = facts([['RevenueFromContractWithCustomerExcludingAssessedTax', 'USD', yrs(M([1828, 2248]), 2024)], ['CostOfGoodsAndServicesSold', 'USD', yrs(M([268, 306]), 2024)],
    ['NetIncomeLoss', 'USD', yrs(M([-440, -278]), 2024)]]);
  const alF = (x) => ({ is: page([['ro', 'us-gaap_RevenueFromContractWithCustomerExcludingAssessedTax', 'Total revenues', ['2248', '1828']],
    ['ro', 'us-gaap_CostOfGoodsAndServicesSold', 'Cost of goods sold', ['306', '268']], ['ro', 'alny_CostOfCollaborationManufacturingAndRoyalties', 'Cost of collaborations and royalties', x],
    ['rou', 'us-gaap_NetIncomeLoss', 'Net loss', ['(278)', '(440)']]]) });
  const da = F.normalizeSec(AL, [], alF(['17', '42']));
  ok(da.gpx === 'sum' && !da.A.cogs && !da.A.gp && !da.tags.cogs, 'Alnylam: שורת עלות בתגית פרטית (2.3% מההכנסות) — לא רווח גולמי חלקי מ־SEC');
  const da2 = F.normalizeSec(AL, [], alF(['2', '1']));
  ok(da2.gpx === 'ok' && da2.tags.cogs === 'CostOfGoodsAndServicesSold' && da2.A.gp.join() === M([1560, 1942]).join(), '...שורה זניחה (פחות מ־0.5%) — השורה הגדולה מספיקה');
  // L3Harris: בדוח השנתי ערכי השנה תויגו על הקשר של רבעון רביעי (הכנסות — רק שם; רווח תפעולי — גם שנה) — השנה = הערך, הרבעון = השנה פחות 9 חודשים
  const LH = facts([['RevenueFromContractWithCustomerExcludingAssessedTax', 'USD', [...yrs(M([20000]), 2024), ['2025-01-01', '2025-09-30', 16200e6, '10-Q', '2025-11-01'],
    ['2025-07-01', '2025-09-30', 5600e6, '10-Q', '2025-11-01'], ['2025-10-01', '2025-12-31', 21800e6, '10-K', '2026-02-12']]],
    ['OperatingIncomeLoss', 'USD', [...yrs(M([1900, 2100]), 2024), ['2025-01-01', '2025-09-30', 1700e6, '10-Q', '2025-11-01'], ['2025-07-01', '2025-09-30', 600e6, '10-Q', '2025-11-01'],
      ['2025-10-01', '2025-12-31', 2100e6, '10-K', '2026-02-12']]], ['NetIncomeLoss', 'USD', yrs(M([1500, 1600]), 2024)]]);
  const dl = F.normalizeSec(LH, []), iq = dl.q.indexOf('2025-12-31');
  ok(dl.A.rev[dl.fy.indexOf('2025-12-31')] === 21800e6 && dl.Q.rev[iq] === 5600e6 && dl.Q.op[iq] === 400e6 && dl.derived.rev.includes('2025-12-31'),
    'L3Harris: "רבעון רביעי" שהוא השנה — השנה 21,800, הרבעון 5,600 (לא 21,800), רווח תפעולי ברבעון 400 (לא 2,100)');
  const LH2 = facts([['RevenueFromContractWithCustomerExcludingAssessedTax', 'USD', [...yrs(M([20000, 22000]), 2024), ['2025-01-01', '2025-09-30', 16200e6, '10-Q', '2025-11-01'],
    ['2025-10-01', '2025-12-31', 5800e6, '10-K', '2026-02-12']]], ['NetIncomeLoss', 'USD', yrs(M([1500, 1600]), 2024)]]);
  const dl2 = F.normalizeSec(LH2, []);
  ok(dl2.Q.rev[dl2.q.indexOf('2025-12-31')] === 5800e6, '...רבעון רביעי רגיל — לא נוגעים');
  // Chevron: הסך "Total Revenues and Other Income" בתגית Revenues (מכירות + חברות כלולות + הכנסות אחרות) — ההכנסות = שורת המכירות
  const CV = facts([['Revenues', 'USD', yrs(M([200949, 202792]), 2023)], ['RevenueFromContractWithCustomerExcludingAssessedTax', 'USD', yrs(M([196913, 193414]), 2023)],
    ['NetIncomeLoss', 'USD', yrs(M([21369, 17661]), 2023)]]);
  const cvF = (lab) => ({ is: page([['ro', 'us-gaap_RevenueFromContractWithCustomerExcludingAssessedTax', 'Sales and other operating revenues', ['193414', '196913']],
    ['ro', 'cvx_EquityMethodInvestmentIncome', 'Income from equity affiliates', ['4596', '5131']], ['rou', 'us-gaap_Revenues', lab, ['202792', '200949']],
    ['rou', 'us-gaap_NetIncomeLoss', 'Net income', ['17661', '21369']]]) });
  ok(F.normalizeSec(CV, [], cvF('Total Revenues and Other Income')).tags.rev === 'RevenueFromContractWithCustomerExcludingAssessedTax', 'Chevron: סך "…and Other Income" — ההכנסות = שורת המכירות');
  ok(F.normalizeSec(CV, [], cvF('Total revenues')).tags.rev === 'Revenues', '...סך "Total revenues" — הסך, כמו קודם');
  // AvalonBay: ה־10-K של 2025 תייג את 2022 (שכבר לא עמודה בדוח) בערך של 2025 — שלושת הדוחות שבהם 2022 מודפסת גוברים
  const AV = facts([['Revenues', 'USD', [[...Y(2022), 2735e6, '10-K', '2023-02-16'], [...Y(2022), 2735e6, '10-K', '2025-02-13'], [...Y(2023), 2874e6, '10-K', '2025-02-13'],
    [...Y(2024), 2980e6, '10-K', '2025-02-13'], [...Y(2022), 3094e6, '10-K', '2026-02-13'], [...Y(2025), 3094e6, '10-K', '2026-02-13'], [...Y(2024), 2980e6, '10-K', '2026-02-13']]],
    ['NetIncomeLoss', 'USD', yrs(M([1137, 929, 1081, 1100]), 2022)]]);
  const dv = F.normalizeSec(AV, []);
  ok(dv.A.rev[dv.fy.indexOf('2022-12-31')] === 2735e6 && dv.A.rev[dv.fy.indexOf('2024-12-31')] === 2980e6, 'AvalonBay: שנה ישנה מדוח מאוחר (לא עמודת השוואה) לא גוברת על הדוחות שבהם היא מודפסת');
  const AV2 = facts([['Revenues', 'USD', [[...Y(2023), 2874e6, '10-K', '2024-02-15'], [...Y(2023), 2900e6, '10-K', '2025-02-13'], [...Y(2024), 2980e6, '10-K', '2025-02-13']]],
    ['NetIncomeLoss', 'USD', yrs(M([929, 1081]), 2023)]]);
  ok(F.normalizeSec(AV2, []).A.rev[0] === 2900e6, '...הצגה מחדש בדוח שבו השנה עדיין עמודה — גוברת כמו קודם');
  // Gartner: GrossProfit בביאור (לא בדוח) בלי עלות אחרת של ‏0.5% — לא "תואם"; הרווח הגולמי = ההכנסות פחות שורת העלות שבדוח
  const GT = facts([['RevenueFromContractWithCustomerExcludingAssessedTax', 'USD', yrs(M([5907, 6267]), 2024)], ['CostOfGoodsAndServicesSold', 'USD', yrs(M([1903, 2023]), 2024)],
    ['GrossProfit', 'USD', yrs(M([4035, 4277]), 2024)], ['NetIncomeLoss', 'USD', yrs(M([882, 1250]), 2024)]]);
  const gtF = { is: page([['ro', 'us-gaap_RevenueFromContractWithCustomerExcludingAssessedTax', 'Total revenues', ['6267', '5907']],
    ['ro', 'us-gaap_CostOfGoodsAndServicesSold', 'Cost of services and product development', ['2023', '1903']], ['rou', 'us-gaap_NetIncomeLoss', 'Net income', ['1250', '882']]]) };
  const dt = F.normalizeSec(GT, [], gtF);
  ok(!dt.tags.gp && dt.A.gp.join() === M([4004, 4244]).join(), 'Gartner: GrossProfit מהביאור שונה ב־0.5% מהדוח — לא גובר על ההכנסות פחות עלות המכר');
  // NiSource: שורת הסיכום שהחברה מציגה גוברת על רכיב שקודם לה ברשימה
  const NI = facts([['RevenueFromContractWithCustomerExcludingAssessedTax', 'USD', yrs(M([5283, 6523]), 2024)], ['RegulatedOperatingRevenue', 'USD', yrs(M([5455, 6642]), 2024)], ['NetIncomeLoss', 'USD', yrs(M([1, 1]), 2024)]]);
  const dn = F.normalizeSec(NI, [], { is: page([['ro', 'us-gaap_RevenueFromContractWithCustomerExcludingAssessedTax', 'Customer revenues', ['6523', '5283']],
    ['ro', 'us-gaap_RegulatedOperatingRevenueOther', 'Other revenues', ['119', '172']], ['rou', 'us-gaap_RegulatedOperatingRevenue', 'Total Operating Revenues', ['6642', '5455']]]) });
  ok(dn.tags.rev === 'RegulatedOperatingRevenue' && dn.A.rev.join() === M([5455, 6642]).join(), 'הכנסות: שורת הסך שבדוח (NiSource) — לא "הכנסות מלקוחות"');
  // Camden: בלי שורת סך — השורה הגדולה ("Property revenues", ‏OperatingLeaseLeaseIncome), לא דמי הניהול
  const CP = facts([['RevenueFromContractWithCustomerExcludingAssessedTax', 'USD', yrs(M([7, 13]), 2024)], ['OperatingLeaseLeaseIncome', 'USD', yrs(M([1544, 1574]), 2024)], ['NetIncomeLoss', 'USD', yrs(M([1, 1]), 2024)]]);
  const dcp = F.normalizeSec(CP, [], { is: page([['ro', 'us-gaap_OperatingLeaseLeaseIncome', 'Property revenues', ['1574', '1544']], ['ro', 'us-gaap_RevenueFromContractWithCustomerExcludingAssessedTax', 'Fee and asset management', ['13', '7']]]) });
  ok(dcp.tags.rev === 'OperatingLeaseLeaseIncome' && dcp.A.rev.join() === M([1544, 1574]).join(), 'הכנסות בלי שורת סך (Camden) — השורה הגדולה שבדוח');
  // דוח "רווח כולל" משולב — רק כשאין דוח רווח והפסד אחר (Royal Caribbean, Devon)
  const fs1 = (n) => SF.pickStatements(`<FilingSummary><MyReports><Report><HtmlFileName>R2.htm</HtmlFileName><ShortName>${n}</ShortName><MenuCategory>Statements</MenuCategory></Report></MyReports></FilingSummary>`);
  ok(fs1('CONSOLIDATED STATEMENTS OF COMPREHENSIVE INCOME (LOSS)').isAlt === true && fs1('Consolidated Statements of Comprehensive Earnings').is === 'R2.htm' && fs1('Consolidated Statements of (Loss) Earnings').is === 'R2.htm',
    'דוח רווח והפסד: "Comprehensive Earnings", ‏"(Loss) Earnings", ודוח רווח כולל משולב כשאין אחר');
  ok(!SF.pickStatements(FSUM).isAlt, '...ולא כשיש דוח רווח והפסד נפרד');
  // כותרת שורה בתגית פרטית (class="pl custom")
  const cu = SF.parseR(`<table><tr><th class="tl"><div><strong>Statements of Income - USD ($)<br> $ in Millions</strong></div></th><th class="th"><div>Dec. 31, 2025</div></th></tr><tr class="ro"><td class="pl custom"><a onclick="Show.showAR( this, 'defref_ice_Section31Fees', window );">Section 31 fees</a></td><td class="nump">412</td></tr></table>`);
  ok(cu.rows[0].label === 'Section 31 fees', 'דף R: כותרת של שורה בתגית פרטית (pl custom)');
  // כלי ההשוואה: SEC הגולמי — דוח שנתי גובר על 10-Q מאוחר שתייג "שנה" (Comfort Systems)
  const X = require(path.join(root, 'ibkr-proxy/lib/fundxcheck.js'));
  const rs = X.rawSeries(facts([['GrossProfit', 'USD', [[...Y(2025), 2195.9e6, '10-K', '2026-02-19'], [...Y(2025), 403.4e6, '10-Q', '2026-04-23']]]]), 'GrossProfit');
  ok(X.rawAt(rs, '2025-12-31', 'A') === 2195.9e6, 'כלי ההשוואה: שנה מה־10-K, לא מ־10-Q מאוחר שתייג את הרבעון כשנה');
}
// מאזן: הדוח השנתי גובר על השוואה בדוח רבעוני מאוחר יותר (eBay 2025)
ok(F.normalizeSec(facts([['Revenues', 'USD', yrs([1, 1], 2024)], ['Assets', 'USD', [[null, '2024-12-31', 19365, '10-K', '2025-02-01'], [null, '2025-12-31', 17610, '10-K', '2026-02-19'], [null, '2025-12-31', 17437, '10-Q', '2026-04-29']]]]), []).A.ta.join() === '19365,17610',
  'מאזן סוף שנה: ה־10-K גובר על 10-Q מאוחר שתיקן אותו לאחור');
// פיצול חברה ש־Yahoo רושם כ"ספליט" (Western Digital/Sandisk 1.323) — מספר המניות עלה רק ב־10%: לא מתקנים
{ const WD = facts([['Revenues', 'USD', yrs([1, 1, 1], 2023)], ['NetIncomeLoss', 'USD', yrs([-1700, -850, 1840], 2023)],
    ['EarningsPerShareDiluted', 'USD/shares', yrs([-5.37, -2.61, 5.12], 2023)], ['WeightedAverageNumberOfDilutedSharesOutstanding', 'shares', yrs([318, 326, 359], 2023)]]);
  ok(F.normalizeSec(WD, [['2025-02-24', 1.323]]).A.eps.join() === '-5.37,-2.61,5.12', 'פיצול חברה (1.323, מניות +10%) — הרווח למניה לא מחולק');
  const SP = facts([['Revenues', 'USD', yrs([1, 1, 1], 2023)], ['EarningsPerShareDiluted', 'USD/shares', yrs([4, 4.4, 2.3], 2023)], ['WeightedAverageNumberOfDilutedSharesOutstanding', 'shares', yrs([100, 98, 196], 2023)]]);
  ok(F.normalizeSec(SP, [['2025-03-01', 2]]).A.eps.join() === '2,2.2,2.3', 'פיצול אמיתי 2:1 (המניות קפצו פי 2) — השנים שלפני מותאמות'); }
// ---- פיצולים לפי תאריך ההגשה + ממוצע המניות ברבעון הרביעי (26/10/2026) ----
{ // רבעונים: 10-Q של 2024 הוגשו לפני הפיצול 2:1 (15/08/2024); 10-Q של רבעון 3 ו־10-K — אחריו, עם השוואה לשנה הקודמת שכבר הוצגה מחדש
  const qr = (y, a) => [[y + '-01-01', y + '-03-31'], [y + '-04-01', y + '-06-30'], [y + '-07-01', y + '-09-30']].map(([s, e], i) => [s, e, a[i][0], '10-Q', a[i][1]]);
  const mk = (sh, eps, ratio) => facts([
    ['Revenues', 'USD', [[...Y(2023), 200, '10-K', '2024-02-01'], [...Y(2024), 200, '10-K', '2025-02-01'], ...qr(2023, [[50, '2023-05-01'], [50, '2023-08-01'], [50, '2023-11-01']]), ...qr(2024, [[50, '2024-05-01'], [50, '2024-08-01'], [50, '2024-11-01']])]],
    ['NetIncomeLoss', 'USD', [[...Y(2023), 400, '10-K', '2024-02-01'], [...Y(2024), 400, '10-K', '2025-02-01'], ...qr(2023, [[100, '2023-05-01'], [100, '2023-08-01'], [100, '2023-11-01']]), ...qr(2024, [[100, '2024-05-01'], [100, '2024-08-01'], [100, '2024-11-01']])]],
    ['EarningsPerShareDiluted', 'USD/shares', eps], ['WeightedAverageNumberOfDilutedSharesOutstanding', 'shares', sh]]);
  // 2:1 — לפני: 1000 מניות, אחרי: 2000. הערכים שהוגשו אחרי הפיצול (גם של 2023) כבר מותאמים
  const pre = (v) => v, post = (v) => v * 2;
  const SH = [[...Y(2023), post(1000), '10-K', '2025-02-01'], [...Y(2024), post(1000), '10-K', '2025-02-01'],
    ...qr(2023, [[pre(1000), '2023-05-01'], [pre(1000), '2023-08-01'], [post(1000), '2024-11-01']]), ...qr(2024, [[pre(1000), '2024-05-01'], [pre(1000), '2024-08-01'], [post(1000), '2024-11-01']])];
  const EPS = [[...Y(2023), 0.2, '10-K', '2025-02-01'], [...Y(2024), 0.2, '10-K', '2025-02-01'],
    ...qr(2023, [[0.1, '2023-05-01'], [0.1, '2023-08-01'], [0.05, '2024-11-01']]), ...qr(2024, [[0.1, '2024-05-01'], [0.1, '2024-08-01'], [0.05, '2024-11-01']])];
  const d = F.normalizeSec(mk(SH, EPS), [['2024-08-15', 2]]);
  ok(d.Q.sh.every((x) => x === 2000) && d.Q.eps.every((x) => x === 0.05), 'פיצול 2:1: רבעון שהוצג מחדש בהשוואה שאחרי הפיצול לא מותאם שוב (גם הרבעון הרביעי)');
  ok(d.splitsUsed.length === 1 && d.splitsUsed[0][0] === '2024-08-15', 'הפיצול נרשם ב־splitsUsed');
  // פיצול הפוך 1:100 — אותו מבנה
  const R = (v) => v / 100;
  const SHr = SH.map((r) => [r[0], r[1], r[2] === 2000 ? 10 : 1000, r[3], r[4]]), EPSr = EPS.map((r) => [r[0], r[1], r[2] === 0.05 ? 10 : r[2] === 0.2 ? 40 : r[2], r[3], r[4]]);
  const dr = F.normalizeSec(mk(SHr, EPSr), [['2024-08-15', 0.01]]);
  ok(dr.Q.sh.every((x) => Math.abs(x - 10) < 1e-9) && dr.Q.eps.every((x) => x === 10), 'פיצול הפוך 1:100: כל הרבעונים בבסיס שאחרי הפיצול, בלי התאמה כפולה');
  // הרבעון האחרון שלפני הפיצול הוגש אחריו (Booking: ‏10-Q של מרץ הוגש אחרי הפיצול של אפריל) — הרבעונים הישנים עדיין מותאמים
  const SHb = SH.map((r) => r.slice()); SHb[6][4] = '2024-08-20'; SHb[6][2] = 2000; // רבעון 2 של 2024 הוגש אחרי הפיצול
  const EPSb = EPS.map((r) => r.slice()); EPSb[6][4] = '2024-08-20'; EPSb[6][2] = 0.05;
  const db = F.normalizeSec(mk(SHb, EPSb), [['2024-08-15', 2]]);
  ok(db.Q.sh.every((x) => x === 2000) && db.Q.eps.every((x) => x === 0.05), 'הרבעון שלפני הפיצול כבר הוצג מחדש — לא "מוכיח" שאין פיצול; הישנים מותאמים');
  // פיצול חברה ש־Yahoo רושם כ"ספליט" (DuPont/Qnity 2.39): אותה תקופה לפני ואחרי — המניות לא השתנו → לא מוחל
  const SHs = SH.map((r) => [r[0], r[1], 1000, r[3], r[4]]), EPSs = EPS.map((r) => [r[0], r[1], r[2] === 0.05 ? 0.1 : r[2] === 0.2 ? 0.4 : r[2], r[3], r[4]]);
  const ds = F.normalizeSec(mk(SHs, EPSs), [['2024-08-15', 2.39]]);
  ok(!ds.splitsUsed.length && ds.Q.sh.every((x) => x === 1000), 'פיצול חברה (2.39) — אותה תקופה לפני ואחרי בלי קפיצה: לא מוחל');
}
{ // הרבעון הרביעי כשהרבעון הראשון בהפסד (Southwest 2025): מדולל = בסיסי ברבעון ההפסד — מהבסיסי + הדילול של הרבעון השלישי
  const q = (a, y = 2025) => [[y + '-01-01', y + '-03-31'], [y + '-04-01', y + '-06-30'], [y + '-07-01', y + '-09-30']].map(([s, e], i) => [s, e, a[i], '10-Q', (y) + '-' + ['05', '08', '11'][i] + '-01']);
  const L = facts([['Revenues', 'USD', [[...Y(2025), 28e9, '10-K', '2026-02-05'], ...q([6.4e9, 7.2e9, 6.9e9])]],
    ['NetIncomeLoss', 'USD', [[...Y(2025), 441e6, '10-K', '2026-02-05'], ...q([-149e6, 213e6, 54e6])]],
    ['EarningsPerShareDiluted', 'USD/shares', [[...Y(2025), 0.79, '10-K', '2026-02-05'], ...q([-0.26, 0.39, 0.1])]],
    ['WeightedAverageNumberOfDilutedSharesOutstanding', 'shares', [[...Y(2025), 558e6, '10-K', '2026-02-05'], ...q([584e6, 541e6, 526e6])]],
    ['WeightedAverageNumberOfSharesOutstandingBasic', 'shares', [[...Y(2025), 540e6, '10-K', '2026-02-05'], ...q([584e6, 538e6, 523e6])]]]);
  const dl = F.normalizeSec(L, []), i4 = dl.q.indexOf('2025-12-31');
  ok(Math.abs(dl.Q.sh[i4] - 518e6) < 1e6, 'רבעון רביעי אחרי רבעון הפסד: 4 × הבסיסי פחות שלושה + הדילול (518M; ההודעה: 521M, במדולל היה 581M)');
  // רכישה באמצע השנה (Capital One): הרבעון הרביעי רחוק מהממוצע השנתי אבל קרוב לשלישי — ההערכה נשמרת
  const C = facts([['Revenues', 'USD', [[...Y(2025), 50e9, '10-K', '2026-02-05'], ...q([10e9, 12e9, 14e9])]],
    ['NetIncomeLoss', 'USD', [[...Y(2025), 2.4e9, '10-K', '2026-02-05'], ...q([1.4e9, 1.5e9, 3.2e9])]],
    ['WeightedAverageNumberOfDilutedSharesOutstanding', 'shares', [[...Y(2025), 541.3e6, '10-K', '2026-02-05'], ...q([384e6, 505.6e6, 639.5e6])]]]);
  const dc = F.normalizeSec(C, []);
  ok(Math.abs(dc.Q.sh[dc.q.indexOf('2025-12-31')] - 636.1e6) < 1e6, 'רכישה באמצע השנה: הרבעון הרביעי לפי 4 × שנה פחות שלושה (636M; ההודעה 631.6M), לא הממוצע השנתי');
}
{ // פיצול ש־Yahoo לא רושם נכון (Honeywell 2026: פיצול הפוך 1:2 נרשם כ־0.9535): SEC עצמו מראה — אותן תקופות, חצי מהמניות
  const q = (s, e, v, f) => [s, e, v, '10-Q', f];
  const HN = facts([['Revenues', 'USD', [[...Y(2024), 38e9, '10-K', '2025-02-14'], [...Y(2025), 40e9, '10-K', '2026-02-17'],
      q('2025-04-01', '2025-06-30', 10e9, '2025-07-24'), q('2025-07-01', '2025-09-30', 10e9, '2025-10-23'), q('2026-01-01', '2026-03-31', 10e9, '2026-04-23'), q('2026-04-01', '2026-06-30', 10e9, '2026-07-23')]],
    ['WeightedAverageNumberOfDilutedSharesOutstanding', 'shares', [[...Y(2024), 655e6, '10-K', '2025-02-14'], [...Y(2025), 642.8e6, '10-K', '2026-02-17'],
      q('2025-01-01', '2025-03-31', 651.7e6, '2025-04-29'), q('2025-01-01', '2025-03-31', 651.7e6, '2026-04-23'), // לא השתנה עד אפריל 2026 — הפיצול אחריו
      q('2025-04-01', '2025-06-30', 640.9e6, '2025-07-24'), q('2025-04-01', '2025-06-30', 320.5e6, '2026-07-23'),
      q('2025-07-01', '2025-09-30', 638.8e6, '2025-10-23'), q('2025-07-01', '2025-09-30', 319.4e6, '2026-10-22'),
      q('2026-01-01', '2026-03-31', 638.4e6, '2026-04-23'), q('2026-04-01', '2026-06-30', 318.6e6, '2026-07-23')]],
    ['EarningsPerShareDiluted', 'USD/shares', [[...Y(2025), 7.36, '10-K', '2026-02-17'], q('2025-04-01', '2025-06-30', 2.45, '2025-07-24'), q('2025-04-01', '2025-06-30', 4.9, '2026-07-23')]]]);
  const dh = F.normalizeSec(HN, [['2025-10-30', 1.061], ['2026-06-29', 0.9535]]);
  ok(dh.splitsUsed.length === 1 && dh.splitsUsed[0][0] === '2026-06-29' && dh.splitsUsed[0][1] === 0.5, 'פיצול 1:2 מתוך SEC (שתי תקופות שהוצגו מחדש), בתאריך של Yahoo שבתוך החלון (אחרי אפריל 2026) — היחס מ־SEC');
  ok(near(dh.A.sh[dh.fy.indexOf('2025-12-31')], 321.4e6, 1) && dh.A.eps[dh.fy.indexOf('2025-12-31')] === 14.72 && near(dh.Q.sh[dh.q.indexOf('2026-03-31')], 319.2e6, 1),
    'השנה והרבעון שהוגשו לפני הפיצול — בבסיס החדש (321.4M, ‏14.72; ‏319.2M)');
  // הגשה שכבר הוצגה מחדש לפני התאריך ש־Yahoo רושם (A. O. Smith 2013): החלון מ־SEC מקדים את התאריך — בלי התאמה כפולה
  const AO = facts([['Revenues', 'USD', [[...Y(2012), 1.9e9, '10-K', '2013-02-27'], q('2013-01-01', '2013-03-31', 0.5e9, '2013-05-06')]],
    ['WeightedAverageNumberOfDilutedSharesOutstanding', 'shares', [[...Y(2011), 46e6, '10-K', '2012-02-27'], [...Y(2012), 46.6e6, '10-K', '2013-02-27'],
      [...Y(2011), 92e6, '10-K', '2014-02-27'], [...Y(2012), 93.2e6, '10-K', '2014-02-27'], q('2012-01-01', '2012-03-31', 46.4e6, '2012-05-01'), q('2012-01-01', '2012-03-31', 92.8e6, '2013-05-06'),
      q('2013-01-01', '2013-03-31', 92.9e6, '2013-05-06')]]]);
  const da = F.normalizeSec(AO, [['2013-05-16', 2]]);
  ok(near(da.Q.sh[da.q.indexOf('2013-03-31')], 92.9e6, 1) && da.splitsUsed[0][0] === '2013-05-06', '10-Q שהוגש לפני התאריך של Yahoo וכבר הוצג מחדש — לא מוכפל שוב');
}
// השקעות הוניות = כל השורות שבדוח (רכוש קבוע + תוכנה), רק בשנים שבהן שתיהן קיימות
const RCF = `<table><tr><th class="tl"><div><strong>Cash Flows - USD ($)<br> $ in Millions</strong></div></th><th class="th" colspan="1">12 Months Ended</th></tr><tr><th class="th"><div>Dec. 31, 2025</div></th></tr>
${row('ro', 'us-gaap_PaymentsToAcquirePropertyPlantAndEquipment', 'PP&E', ['(489)'])}${row('re', 'us-gaap_PaymentsToAcquireSoftware', 'Software', ['(726)'])}</table>`;
const CPX = facts([
  ['Revenues', 'USD', yrs([1, 1, 1], 2023)],
  ['PaymentsToAcquirePropertyPlantAndEquipment', 'USD', yrs([371e6, 474e6, 489e6], 2023)],
  ['PaymentsToAcquireSoftware', 'USD', yrs([720e6, 726e6], 2024)],
]);
const dcx = F.normalizeSec(CPX, [], { cf: SF.parseR(RCF) });
ok(dcx.A.capex.join() === ',' + [1194e6, 1215e6].join() || (dcx.A.capex[0] == null && dcx.A.capex[1] === 1194e6 && dcx.A.capex[2] === 1215e6), 'השקעות הוניות = רכוש קבוע + תוכנה; שנה בלי אחד החלקים — ריקה (לא קפיצה)');
// 26/10/2026 — השקעות הוניות: שורה אחת בדוח בתגית שאינה ברשימה הראשית (Eli Lilly / ADP: ‏PaymentsToAcquireOtherPropertyPlantAndEquipment)
{ const RC1 = `<table><tr><th class="tl"><div><strong>Cash Flows - USD ($)<br> $ in Millions</strong></div></th><th class="th" colspan="1">12 Months Ended</th></tr><tr><th class="th"><div>Dec. 31, 2025</div></th></tr>
${row('ro', 'us-gaap_PaymentsToAcquireOtherPropertyPlantAndEquipment', 'Purchases of property and equipment', ['(7,841)'])}${row('re', 'us-gaap_PaymentsToAcquireInProcessResearchAndDevelopment', 'Purchases of in-process research and development', ['(3,008)'])}</table>`;
  const LL = facts([['Revenues', 'USD', yrs([1, 1, 1], 2023)], ['PaymentsToAcquireOtherPropertyPlantAndEquipment', 'USD', yrs([3448e6, 5058e6, 7841e6], 2023)],
    ['PaymentsToAcquireInProcessResearchAndDevelopment', 'USD', yrs([3944e6, 3346e6, 3008e6], 2023)]]);
  const dl = F.normalizeSec(LL, [], { cf: SF.parseR(RC1) });
  ok(dl.tags.capex === 'PaymentsToAcquireOtherPropertyPlantAndEquipment' && dl.A.capex.join() === [3448e6, 5058e6, 7841e6].join(), 'השקעות הוניות: שורה אחת בדוח בתגית "רכוש קבוע אחר" — נבחרת (לא ריק שמושלם מ־Yahoo עם מו"פ בתהליך)');
  // חברת חשמל (AEP): "Construction Expenditures" + "Acquisitions of Generation Facilities" — רכישת תחנות אינה השקעה הונית
  const RC2 = `<table><tr><th class="tl"><div><strong>Cash Flows - USD ($)<br> $ in Millions</strong></div></th><th class="th" colspan="1">12 Months Ended</th></tr><tr><th class="th"><div>Dec. 31, 2025</div></th></tr>
${row('ro', 'us-gaap_PaymentsForConstructionInProcess', 'Construction Expenditures', ['(8,453)'])}${row('re', 'us-gaap_PaymentsToAcquireProductiveAssets', 'Acquisitions of Generation Facilities', ['(3,453)'])}</table>`;
  const AE = facts([['Revenues', 'USD', yrs([1, 1, 1], 2023)], ['PaymentsForConstructionInProcess', 'USD', yrs([7378e6, 7631e6, 8453e6], 2023)],
    ['PaymentsToAcquireProductiveAssets', 'USD', yrs([155e6, 399e6, 3453e6], 2023)]]);
  const da = F.normalizeSec(AE, [], { cf: SF.parseR(RC2) });
  ok(da.tags.capex === 'PaymentsForConstructionInProcess' && da.A.capex.join() === [7378e6, 7631e6, 8453e6].join(), 'השקעות הוניות של חברת חשמל = "Construction Expenditures", בלי "Acquisitions of …"');
  // דוח משותף לכמה ישויות (Dominion + Virginia Electric): אחרי שורת dei_LegalEntityAxis — חברת הבת, לא שלנו
  const RC3 = `<table><tr><th class="tl"><div><strong>Cash Flows - USD ($)<br> $ in Millions</strong></div></th><th class="th" colspan="1">12 Months Ended</th></tr><tr><th class="th"><div>Dec. 31, 2025</div></th></tr>
${row('ro', 'd_PaymentsToAcquirePropertyPlantAndEquipmentIncludingNuclearFuel', 'Plant construction (including nuclear fuel)', ['(12,641)'])}<tr class="rh"><td class="pl"><a onclick="Show.showAR( this, 'defref_dei_LegalEntityAxis', window );">Virginia Electric and Power Company</a></td><td class="text">&#160;</td></tr>
${row('ro', 'us-gaap_PaymentsToAcquirePropertyPlantAndEquipment', 'Plant construction and other property additions', ['(10,333)'])}</table>`;
  const p3 = SF.parseR(RC3);
  ok(p3.rows.length === 1 && p3.rows[0].tag === 'PaymentsToAcquirePropertyPlantAndEquipmentIncludingNuclearFuel', 'דף R משותף: רק החברה המאוחדת — השורות של חברת הבת לא נכנסות'); }
// רבעון מחושב שלילי בהשקעות הוניות = שני מצטברים מבסיסים שונים (DuPont אחרי פיצול Qnity; ‏Honeywell אחרי הפרדת התעופה)
{ const qr = (y) => [['01-01', '03-31'], ['04-01', '06-30'], ['07-01', '09-30'], ['10-01', '12-31']].map(([a, b]) => [y + '-' + a, y + '-' + b, 1, '10-Q', y + '-' + b]);
  const DDX = facts([['Revenues', 'USD', [...yrs([4, 4, 4], 2023), ...qr(2024), ...qr(2025)]],
    ['PaymentsToAcquireProductiveAssets', 'USD', [...yrs([302e6], 2023),
      ['2024-01-01', '2024-03-31', 207e6, '10-Q', '2024-05-01'], ['2024-01-01', '2024-06-30', 309e6, '10-Q', '2024-07-31'],
      ['2024-01-01', '2024-09-30', 418e6, '10-Q', '2024-11-05'], ['2024-01-01', '2024-09-30', 376e6, '10-Q', '2025-11-06'], // תשעה חודשים — הוצגו מחדש (הצגה אחת)
      ['2024-01-01', '2024-12-31', 579e6, '10-K', '2025-02-14'], ['2024-01-01', '2024-12-31', 285e6, '10-K', '2026-02-17'], // השנה — הוצגה מחדש (הצגה אחרת)
      ['2025-01-01', '2025-03-31', 249e6, '10-Q', '2025-05-02'], ['2025-01-01', '2025-06-30', 365e6, '10-Q', '2025-08-05'],
      ['2025-01-01', '2025-09-30', 483e6, '10-Q', '2025-11-06'], ['2025-01-01', '2025-12-31', 333e6, '10-K', '2026-02-17']]]]);
  const RC4 = `<table><tr><th class="tl"><div><strong>Cash Flows - USD ($)<br> $ in Millions</strong></div></th><th class="th" colspan="1">12 Months Ended</th></tr><tr><th class="th"><div>Dec. 31, 2025</div></th></tr>
${row('ro', 'us-gaap_PaymentsToAcquireProductiveAssets', 'Capital expenditures', ['(333)'])}</table>`;
  const dd = F.normalizeSec(DDX, [], { cf: SF.parseR(RC4) }), q = (e) => dd.Q.capex[dd.q.indexOf(e)];
  ok(q('2024-12-31') === 161e6, 'רבעון רביעי שלילי (‎285 − 376) — הזוג כפי שדווח במקור (‎579 − 418)');
  ok(q('2025-12-31') == null && F.validate(dd).some((c) => c.k === 'qmix' && c.m === 'capex' && c.p === '2025-12-31'), 'אין זוג לא שלילי (‎333 − 483) — הרבעון לא מוצג, ונרשם qmix');
  // "Net additions of property" (Hartford, Lennar) — נטו אחרי מכירות: רבעון שלילי בצדק, נשאר
  const RC5 = RC4.replace('Capital expenditures', 'Net additions of property and equipment');
  const dn = F.normalizeSec(DDX, [], { cf: SF.parseR(RC5) });
  ok(dn.Q.capex[dn.q.indexOf('2025-12-31')] === -150e6, 'תווית "net" — רבעון שלילי נשאר כמו שדווח'); }
// רבעון ישיר מתגית משלימה שמודדת ברבעונים משהו אחר (Copart): חצי השנה שלה ‏412 מול ‏353 — הרבעונים מהמצטבר של הסדרה
{ const qr = (y) => [['01-01', '03-31'], ['04-01', '06-30'], ['07-01', '09-30'], ['10-01', '12-31']].map(([a, b]) => [y + '-' + a, y + '-' + b, 1, '10-Q', y + '-' + b]);
  const CP = facts([['Revenues', 'USD', [...yrs([4, 4], 2024), ...qr(2025)]],
    ['PaymentsToAcquirePropertyPlantAndEquipment', 'USD', [...yrs([500e6, 569e6], 2024), ['2025-01-01', '2025-03-31', 236.8e6, '10-Q', '2025-05-01'],
      ['2025-01-01', '2025-06-30', 353.4e6, '10-Q', '2025-08-01'], ['2025-01-01', '2025-09-30', 481.3e6, '10-Q', '2025-11-01']]],
    ['PaymentsToAcquireProductiveAssets', 'USD', [...yrs([501e6, 570.2e6], 2024), ['2025-01-01', '2025-03-31', 238e6, '10-Q', '2025-05-01'],
      ['2025-01-01', '2025-06-30', 412.1e6, '10-Q', '2025-08-01'], ['2025-04-01', '2025-06-30', 174.1e6, '10-Q', '2025-08-01'],
      ['2025-01-01', '2025-09-30', 482.6e6, '10-Q', '2025-11-01'], ['2025-07-01', '2025-09-30', 70.5e6, '10-Q', '2025-11-01']]]]);
  const dc = F.normalizeSec(CP, []), q = (e) => Math.round(dc.Q.capex[dc.q.indexOf(e)] / 1e5) / 10;
  ok(q('2025-06-30') === 116.6 && q('2025-09-30') === 127.9 && q('2025-12-31') === 87.7, 'השקעות הוניות: רבעון ישיר של תגית משלימה שהמצטבר שלה שונה — לא נכנס; הרבעונים מהמצטבר של הסדרה');
  // ...ותגית משלימה שהמצטברים שלה זהים (Fortive — אותו מדד בתגית של הדוח הרבעוני) — הרבעון הישיר שלה נשמר
  const FT = facts([['Revenues', 'USD', [...yrs([4, 4], 2024), ...qr(2025)]],
    ['PaymentsToAcquirePropertyPlantAndEquipment', 'USD', [...yrs([86e6, 105e6], 2024), ['2025-01-01', '2025-03-31', 21.1e6, '10-Q', '2026-04-30'],
      ['2025-01-01', '2025-06-30', 63.4e6, '10-Q', '2025-08-01'], ['2025-01-01', '2025-09-30', 74.7e6, '10-Q', '2025-11-01']]],
    ['PaymentsToAcquireProductiveAssets', 'USD', [...yrs([86e6, 105e6], 2024), ['2025-01-01', '2025-03-31', 21.1e6, '10-Q', '2026-04-30'],
      ['2025-01-01', '2025-06-30', 63.4e6, '10-Q', '2025-08-01'], ['2025-04-01', '2025-06-30', 36.7e6, '10-Q', '2025-08-01'],
      ['2025-01-01', '2025-09-30', 74.7e6, '10-Q', '2025-11-01'], ['2025-07-01', '2025-09-30', 28.6e6, '10-Q', '2025-11-01']]]]);
  const df = F.normalizeSec(FT, []);
  ok(df.Q.capex[df.q.indexOf('2025-09-30')] === 28.6e6, 'תגית משלימה עם אותם מצטברים — הרבעון הישיר שלה (כפי שהוגש) נשמר'); }
// מספר מניות בקנה מידה שגוי (McDonald's): רווח ÷ EPS = מניות × מיליון
const MCDX = facts([['NetIncomeLoss', 'USD', yrs([8223e6, 8563e6], 2024)], ['EarningsPerShareDiluted', 'USD/shares', yrs([11.39, 11.95], 2024)],
  ['WeightedAverageNumberOfDilutedSharesOutstanding', 'shares', yrs([721.9, 716.4], 2024)]]);
const dmc = F.normalizeSec(MCDX, []);
ok(Math.round(dmc.A.sh[1]) === 716400000 && dmc.fixes.length === 2 && F.validate(dmc).some((c) => c.k === 'fix' && c.m === 'sh'), 'מניות במיליונים בלי קנה מידה — מתוקן ונרשם');
// פיצול חברה ש־Yahoo רושם כ"ספליט" (GE Vernova, 1.25) — לא נוגעים ב־EPS
const SPIN = facts([['NetIncomeLoss', 'USD', yrs([9e9, 6e9], 2023)], ['EarningsPerShareDiluted', 'USD/shares', yrs([8.36, 5.5], 2023)],
  ['WeightedAverageNumberOfDilutedSharesOutstanding', 'shares', yrs([1.09e9, 1.09e9], 2023)]]);
ok(F.normalizeSec(SPIN, [['2024-04-02', 1.253]]).A.eps[0] === 8.36, 'פיצול חברה (יחס 1.25, המניות לא קפצו) — לא "ספליט"');
// זהויות חדשות
const IDN = facts([
  ['Revenues', 'USD', yrs([100, 110], 2024)], ['CostOfRevenue', 'USD', yrs([60, 70], 2024)], ['GrossProfit', 'USD', yrs([40, 30], 2024)],
  ['OperatingIncomeLoss', 'USD', yrs([20, 120], 2024)],
  ['Assets', 'USD', [[null, '2024-12-31', 100, '10-K', '2025-02-01'], [null, '2025-12-31', 100, '10-K', '2026-02-01']]],
  ['AssetsCurrent', 'USD', [[null, '2025-12-31', 120, '10-K', '2026-02-01']]],
  ['LiabilitiesAndStockholdersEquity', 'USD', [[null, '2024-12-31', 100, '10-K', '2025-02-01'], [null, '2025-12-31', 104, '10-K', '2026-02-01']]],
]);
const vi = F.validate(F.normalizeSec(IDN, []));
ok(vi.some((c) => c.k === 'gp' && c.p === '2025-12-31') && !vi.some((c) => c.k === 'gp' && c.p === '2024-12-31'), 'רווח גולמי ≠ הכנסות − עלות המכר — מסומן');
ok(vi.some((c) => c.k === 'part' && c.m === 'ca') && vi.some((c) => c.k === 'part' && c.m === 'op'), 'רכוש שוטף > סך נכסים, רווח תפעולי > הכנסות — מסומנים');
ok(vi.some((c) => c.k === 'bal' && c.p === '2025-12-31') && !vi.some((c) => c.k === 'bal' && c.p === '2024-12-31'), 'נכסים ≠ סך התחייבויות והון — מסומן');

/* ---------- Yahoo ---------- */
const ts = { timeseries: { result: [
  ['annualTotalRevenue', [['2024-12-31', 1000], ['2025-12-31', 1100]]],
  ['quarterlyTotalRevenue', [['2025-03-31', 260], ['2025-06-30', 270], ['2025-09-30', 280], ['2026-03-31', 300]]],
  ['annualCapitalExpenditure', [['2025-12-31', -90]]], ['trailingTotalRevenue', [['2026-03-31', 1140]]],
  ['annualOrdinarySharesNumber', [['2025-12-31', 5e6]]],
].map(([t, rows]) => ({ meta: { type: [t] }, [t]: rows.map(([d0, v]) => ({ asOfDate: d0, reportedValue: { raw: v } })) })) } };
const y = F.parseYahooTs(ts);
ok(y.Q.rev[y.q.indexOf('2025-12-31')] === 290, 'Yahoo: רבעון 4 חסר = 1100 − 810');
ok(y.A.capex[y.fy.indexOf('2025-12-31')] === 90, 'Yahoo: השקעות הוניות בסימן חיובי (כמו ב־SEC)');
ok(y.T.rev === 1140 && y.sharesOut === 5e6, 'Yahoo: 12 החודשים האחרונים ומספר המניות');

const qs = { quoteSummary: { result: [{
  assetProfile: { sectorDisp: 'Tech', industryDisp: 'Internet Content & Information', website: 'https://x.example', companyOfficers: [{ name: 'Mr. Jane  Roe', title: 'Founder & CEO' }] },
  price: { longName: 'Acme Inc.', exchangeName: 'NasdaqGS', currency: 'ILA', regularMarketPrice: { raw: 12190 }, regularMarketPreviousClose: { raw: 12010 } },
  summaryDetail: { forwardPE: { raw: 18.4 } }, defaultKeyStatistics: { sharesOutstanding: { raw: 7e6 } }, financialData: { financialCurrency: 'ILS' },
  earningsTrend: { trend: [{ period: '0y', endDate: '2026-12-31', earningsEstimate: { avg: { raw: 2.1 }, numberOfAnalysts: { raw: 5 } }, revenueEstimate: { avg: { raw: 1200 } }, growth: { raw: 0.1 } },
    { period: '+1y', earningsEstimate: { avg: {} }, revenueEstimate: {} }] },
  earningsHistory: { history: [{ quarter: { fmt: '2026-06-30' }, epsActual: { raw: 0.6 }, epsEstimate: { raw: 0.5 } }] },
  calendarEvents: { earnings: { earningsDate: [{ fmt: '2026-11-11' }] } },
}] } };
const sm = F.parseSummary(qs, 100);
ok(sm.price === 121.9 && sm.prev === 120.1, 'פרופיל: מחיר באגורות מחולק ב־100');
ok(sm.prof.ceo === 'Jane Roe' && sm.prof.industry === 'Internet Content & Information', 'פרופיל: מנכ״ל בלי תואר ורווחים כפולים');
ok(sm.est.length === 1 && sm.est[0].eps === 2.1 && sm.est[0].n === 5, 'אומדנים: שורה ריקה (‎+1y בלי ערכים) יורדת');
ok(sm.hist[0].a === 0.6 && sm.nextEarn === '2026-11-11', 'בפועל מול צפי ומועד הדוח הבא');

const ch = { chart: { result: [{ meta: { currency: 'ILA' }, timestamp: [1704067200, 1706745600], indicators: { quote: [{ close: [12000, 12500] }] },
  events: { splits: { a: { date: 1593000000, numerator: 10, denominator: 1 } } } }] } };
const pm = F.parseMonthly(ch);
ok(pm.px.t.join() === '2024-01,2024-02' && pm.px.c[1] === 125 && pm.splits[0][1] === 10, 'מחירים חודשיים בשקלים + פיצולים');
ok(F.parseNasdaq({ data: { yearlyForecast: { rows: [{ fiscalEnd: 'Dec 2027', consensusEPSForecast: 33.9, noOfEstimates: 17 }, { fiscalEnd: 'junk', consensusEPSForecast: 1 }] } } }).length === 1, 'Nasdaq: רק שורות תקינות');
const fr = F.parseFred('observation_date,DGS10\n2021-10-20,1.60\n2026-10-21,5.10\n2026-10-22,.\n2026-10-23,5.00\n');
ok(fr.rf === 0.05 && fr.rfDate === '2026-10-23' && near(fr.rf5, 0.0505, 1e-6), 'FRED: הריבית האחרונה וממוצע 5 שנים (בלי ימים ריקים ובלי מה שלפני 5 שנים)');
const tr = F.parseTreasury('Date,"1 Mo","10 Yr","30 Yr"\n10/23/2026,4.11,5.00,5.33\n10/22/2026,4.11,4.96,5.29\n');
ok(tr.length === 2 && tr[1][0] === '2026-10-23' && tr[1][1] === 5, 'Treasury: עמודת 10 Yr ותאריך ISO');
ok(F.industryFor('Internet Content & Information') === 'Software (Internet)' && F.industryFor('Packaged Foods') === 'Food Processing' && F.industryFor('???') === 'Total Market (without financials)', 'ענף Damodaran לפי הענף של Yahoo');
ok(F.industryFor('Beverages - Non - Alcoholic') === 'Beverage (Soft)' && F.industryFor('Beverages—Non-Alcoholic') === 'Beverage (Soft)' && F.industryFor('Beverages - Brewers') === 'Beverage (Alcoholic)', 'קוקה־קולה = משקאות קלים (Yahoo כותב היום "Non - Alcoholic")');
ok(JSON.stringify(F.parsePeers({ finance: { result: [{ recommendedSymbols: [1, 2, 3, 4, 5, 6, 7, 8].map((i) => ({ symbol: 'S' + i })) }] } }, 'X')) === '["S1","S2","S3","S4","S5","S6"]' && F.parsePeers(null, 'X').length === 0, 'parsePeers: עד 6, ותשובה ריקה = רשימה ריקה');
const dmd = require(path.join(root, 'ibkr-proxy/lib/damodaran.json'));
ok(dmd.erp > 0.02 && dmd.erp < 0.08 && dmd.crpIL > 0 && Object.keys(dmd.ind).length > 80, 'damodaran.json: פרמיית שוק, פרמיית ישראל ויותר מ־80 ענפים');

/* ---------- המסלול המלא: /api/history עם op:'fund' / op:'macro' ---------- */

/* ---------- דוחות של חברות זרות (25/10/2026, ריצת 500 החברות) ---------- */
{
  const th = (d, cur) => `<th class="th"><div>${d} </div><div>${cur}</div></th>`;
  const R = (title, heads, rows) => `<table><tr><th class="tl"><div><strong>${title}</strong></div></th><th class="th" colspan="${heads.length}">12 Months Ended</th></tr><tr>${heads.join('')}</tr>${rows}</table>`;
  // Alibaba: עמודת המרה לדולר באותה שנה; ¥ (&#165;) במיליונים
  const baba = SF.parseR(R('INCOME STATEMENTS<br> &#165; in Millions, shares in Millions, $ in Millions', [th('Mar. 31, 2026', 'CNY (&#165;)'), th('Mar. 31, 2026', 'USD ($)'), th('Mar. 31, 2025', 'CNY (&#165;)')],
    row('ro', 'us-gaap_Revenues', 'Revenue', ['1,023,670', '148,401', '996,347'])));
  ok(baba.cols.map((c) => c.cur).join() === 'CNY,USD,CNY' && SF.rowVals(baba, baba.rows[0])[0] === 1023670e6, 'מטבע לכל עמודה; ¥ מפוענח (לא נמחק) — קנה מידה במיליונים');
  ok(!SF.colOk(baba.cols[1], 'CNY') && SF.colOk(baba.cols[0], 'CNY') && SF.colOk({ end: 'x' }, 'CNY'), 'עמודת ההמרה לדולר לא נבדקת מול נתונים ביואן');
  // ASML: "€ in Millions" בלי $
  const asml = SF.parseR(R('Statements of Operations - EUR (&#8364;)<br> &#8364; in Millions, shares in Millions', [th('Dec. 31, 2025', ''), th('Dec. 31, 2024', '')], row('ro', 'ifrs-full_Revenue', 'Total net sales', ['32,667.3', '28,262.9'])));
  ok(SF.rowVals(asml, asml.rows[0])[0] === 32667.3e6 && asml.scale.sh === 1e6, '€ במיליונים (עד היום רק "$ in" זוהה — ASML יצאה פי מיליון)');
  // Chunghwa: "$ in Millions" רק לעמודת הדולר; NT$ ביחידות
  const cht = SF.parseR(R('Balance Sheet<br> $ in Millions', [th('Dec. 31, 2025', 'TWD (NT$)'), th('Dec. 31, 2025', 'USD ($)')], row('ro', 'ifrs-full_CashAndCashEquivalents', 'Cash', ['36,944,000,000', '1,178'])));
  ok(SF.rowVals(cht, cht.rows[0]).join() === '36944000000,1178000000', 'קנה מידה לפי מטבע העמודה ($ במיליונים, NT$ ביחידות)');
  // TSMC: "$ in Millions, $ in Millions" — אותו סימן לשני המטבעות; לפי סדר ההופעה
  const tsm = SF.parseR(R('Financial Position<br> $ in Millions, $ in Millions', [th('Dec. 31, 2025', 'TWD (NT$)'), th('Dec. 31, 2025', 'USD ($)')], row('ro', 'ifrs-full_Assets', 'Total assets', ['7,000,000', '220,000'])));
  ok(SF.rowVals(tsm, tsm.rows[0]).join() === '7000000000000,220000000000', 'שני מקטעים לשני מטבעות — לפי הסדר');
  // SAP: <td colspan="2" class="nump">
  const sap = SF.parseR(R('Cash Flows - EUR (&#8364;)<br> &#8364; in Millions', [th('Dec. 31, 2025', ''), th('Dec. 31, 2024', '')],
    `<tr class="ro"><td class="pl"><a onclick="Show.showAR( this, 'defref_ifrs-full_AdjustmentsForSharebasedPayments', window );">SBC</a></td><td class="th"><sup></sup></td><td colspan="2" class="nump">1,695<span></span></td><td class="nump">2,385<span></span></td><td class="fn"></td></tr>`));
  ok(sap.rows[0].v.join() === '1695,2385', 'תא עם colspan לפני class נקרא (SAP: התזרים זז בשנה)');
  ok(SF.num('₩ 1,234') === 1234 && SF.num('kr (56)') === -56 && SF.num('—') === null, 'סימני מטבע שונים והערות יורדים');
  // מטבע הדיווח: Nebius (רובל → דולר) — רק דולר; Alibaba (יואן + דולר באותה הגשה) — יואן
  const NB = facts([['Revenues', 'RUB', yrs([800e9, 900e9], 2021)], ['NetIncomeLoss', 'RUB', yrs([10e9, 11e9], 2021)]]);
  NB.facts['us-gaap'].Revenues.units.USD = yrs([9.8e6, 117e6, 530e6], 2023).map(([start, end, val, form, filed]) => ({ start, end, val, form, filed, fy: 2099, fp: 'FY' }));
  const dnb = F.normalizeSec(NB, []);
  ok(dnb.cur === 'USD' && !dnb.A.rev.some((v) => v > 1e9) && !(dnb.A.ni || []).some((v) => v != null), 'חברה שהחליפה מטבע — רק המטבע החדש (בלי רובלים בגרף של דולרים)');
  const BB = facts([['Revenues', 'CNY', yrs([941e9, 996e9, 1023e9], 2023)]]);
  BB.facts['us-gaap'].Revenues.units.USD = [{ start: '2025-01-01', end: '2025-12-31', val: 148e9, form: '10-K', filed: '2026-02-01', fy: 2099, fp: 'FY' }];
  const dbb = F.normalizeSec(BB, []);
  ok(dbb.cur === 'CNY' && dbb.A.rev[dbb.A.rev.length - 1] === 1023e9, 'שני מטבעות באותה הגשה — זה שיש בו יותר ערכים (יואן, לא עמודת ההמרה)');
  // פיצול אחרי סוף השנה האחרונה (HDFC Bank): אין תקופה אחרי — מחילים רק יחס שלם
  const HD = facts([['NetIncomeLoss', 'INR', yrs([600e9, 670e9], 2024)], ['EarningsPerShareDiluted', 'INR/shares', yrs([88.31, 89.63], 2024)],
    ['WeightedAverageNumberOfDilutedSharesOutstanding', 'shares', yrs([7.1e9, 7.6e9], 2024)]]);
  ok(F.normalizeSec(HD, [['2026-09-08', 2]]).A.eps.join() === '44.155,44.815', 'פיצול 2:1 אחרי השנה האחרונה — מוחל (בלי זה המכפיל כפול)');
  ok(F.normalizeSec(HD, [['2026-09-08', 1.25]]).A.eps.join() === '88.31,89.63', 'יחס לא שלם (פיצול חברה) בלי תקופה לאמת — לא מוחל');
}

/* ---------- ריצת 500 החברות, סבב 2 (25/10/2026) ---------- */
{
  // Comfort Systems: 10-Q שהוגש אחרי ה־10-K תייג "שנה" בערך שגוי — הדוח השנתי גובר
  const CF = facts([['Revenues', 'USD', yrs([5206e6, 7027e6, 9101e6], 2023)]]);
  CF.facts['us-gaap'].Revenues.units.USD.push({ start: '2025-01-01', end: '2025-12-31', val: 1831e6, form: '10-Q', filed: '2026-04-23', fy: 2099, fp: 'Q1' });
  ok(F.normalizeSec(CF, []).A.rev.slice(-1)[0] === 9101e6, 'שנה שלמה: הדוח השנתי גובר על 10-Q מאוחר יותר');
  // Ares: הכנסות שבאמת קופצות (דמי ביצוע), והדוח המודפס מאשר אותן — fixRuns לא מחליף בתגית אחרת
  const AR = facts([['RevenueFromContractWithCustomerExcludingAssessedTax', 'USD', yrs([1765e6, 1764e6, 4212e6, 3055e6, 3632e6, 3885e6, 5601e6], 2019)],
    ['Revenues', 'USD', yrs([1433e6, 1754e6, 2289e6, 2880e6, 3236e6, 3691e6, 4756e6], 2019)]]);
  const th2 = (d) => `<th class="th"><div>${d}</div></th>`;
  const arF = SF.parseR(`<table><tr><th class="tl"><div><strong>Income - USD ($)<br> $ in Millions</strong></div></th><th class="th" colspan="3">12 Months Ended</th></tr><tr>${th2('Dec. 31, 2025')}${th2('Dec. 31, 2024')}${th2('Dec. 31, 2023')}</tr>
${row('ro', 'us-gaap_RevenueFromContractWithCustomerExcludingAssessedTax', 'Total revenues', ['5,601', '3,885', '3,632'])}</table>`);
  const dar = F.normalizeSec(AR, [], { is: arF });
  ok(dar.tags.rev === 'RevenueFromContractWithCustomerExcludingAssessedTax' && dar.A.rev.join() === [1765e6, 1764e6, 4212e6, 3055e6, 3632e6, 3885e6, 5601e6].join(), 'קפיצה אמיתית שהדוח מאשר — לא "מתוקנת" בתגית אחרת');
  // פיצול אחרי הגשת הדוח: הדוח לפני הפיצול, אצלנו אחריו — משווים אחרי אותו פיצול
  const BK = facts([['NetIncomeLoss', 'USD', yrs([4e9, 5e9], 2024)], ['EarningsPerShareDiluted', 'USD/shares', yrs([120, 165], 2024)],
    ['WeightedAverageNumberOfDilutedSharesOutstanding', 'shares', yrs([33e6, 30e6], 2024)]]);
  const dbk = F.normalizeSec(BK, [['2026-06-01', 25]]);
  const bkF = SF.parseR(`<table><tr><th class="tl"><div><strong>Income - USD ($)<br> $ in Millions</strong></div></th><th class="th" colspan="2">12 Months Ended</th></tr><tr>${th2('Dec. 31, 2025')}${th2('Dec. 31, 2024')}</tr>
${row('ro', 'us-gaap_EarningsPerShareDiluted', 'Diluted', ['165', '120'])}</table>`);
  const fbk = F.faceCheck(dbk, { is: bkF, filed: '2026-02-20' }, [['2026-06-01', 25]]);
  ok(dbk.A.eps.join() === '4.8,6.6' && fbk.seen.n === 2 && fbk.seen.ok === 2, 'פיצול 25:1 אחרי ההגשה — רווח למניה תואם לדוח אחרי אותו פיצול');
  // Canadian Pacific: "$ in Millions, $ in Millions" על עמודות CAD
  const cp = SF.parseR(`<table><tr><th class="tl"><div><strong>Cash Flows<br> $ in Millions, $ in Millions</strong></div></th><th class="th" colspan="1">12 Months Ended</th></tr><tr><th class="th"><div>Dec. 31, 2025</div><div>CAD ($)</div></th></tr>
${row('ro', 'us-gaap_NetCashProvidedByUsedInOperatingActivities', 'Cash from operations', ['5,309'])}</table>`);
  ok(SF.rowVals(cp, cp.rows[0])[0] === 5309e6, 'מטבע אחד ושני מקטעים באותו קנה מידה — במיליונים');
  const bmo = SF.parseR(`<table><tr><th class="tl"><div><strong>Income<br> $ in Millions</strong></div></th><th class="th" colspan="1">12 Months Ended</th></tr><tr><th class="th"><div>Oct. 31, 2025</div><div>CAD ($)</div></th></tr>
${row('ro', 'us-gaap_Revenues', 'Revenue', ['36,274'])}</table>`);
  ok(SF.rowVals(bmo, bmo.rows[0])[0] === 36274e6, 'בנק קנדי: "$ in Millions" על עמודת CAD');
}
/* ---------- הצגה מחדש (26/10/2026, AppLovin): צמיחה מול השנה הקודמת באותו דוח ---------- */
// 2023 ו־2024 הוצגו מחדש בדוח של 2026 בלי עסק שנמכר; 2022 נשאר כפי שדווח אז. 9 חודשים של 2023 — רק כפי שדווחו אז
const RST = facts([['Revenues', 'USD', [
  [...Y(2021), 2793, '10-K', '2022-03-11'], [...Y(2021), 2793, '10-K', '2023-02-28'], [...Y(2022), 2817, '10-K', '2023-02-28'],
  [...Y(2022), 2817, '10-K', '2024-02-26'], [...Y(2023), 3283, '10-K', '2024-02-26'], [...Y(2022), 2817, '10-K', '2025-02-27'],
  [...Y(2023), 3283, '10-K', '2025-02-27'], [...Y(2024), 4709, '10-K', '2025-02-27'],
  [...Y(2023), 1842, '10-K', '2026-02-19'], [...Y(2024), 3224, '10-K', '2026-02-19'], [...Y(2025), 5481, '10-K', '2026-02-19'],
  ['2023-01-01', '2023-09-30', 2330, '10-Q', '2023-11-08'], ['2023-01-01', '2023-09-30', 2330, '10-Q', '2024-11-06'], ['2024-01-01', '2024-09-30', 3336, '10-Q', '2024-11-06'],
  ['2024-01-01', '2024-09-30', 2225, '10-Q', '2025-11-05'], ['2025-01-01', '2025-09-30', 3823, '10-Q', '2025-11-05']]],
  ['NetIncomeLoss', 'USD', [[...Y(2022), 35, '10-K', '2023-02-28'], [...Y(2023), 356, '10-K', '2024-02-26'], [...Y(2024), 1580, '10-K', '2025-02-27'], [...Y(2025), 3300, '10-K', '2026-02-19']]]]);
const dr = F.normalizeSec(RST, []);
const ri = (e) => dr.fy.indexOf(e);
ok(dr.A.rev[ri('2023-12-31')] === 1842 && dr.A.rev[ri('2022-12-31')] === 2817, 'הסדרה: הערך האחרון שהוגש (2023 אחרי ההצגה מחדש), 2022 כפי שדווח');
ok(near(dr.C.A.rev[ri('2023-12-31')], 3283 / 2817), '2023 מול 2022: היחס מהדוח האחרון שמציג את שתיהן (‎+16.5%, לא ‎−35%)');
ok(dr.C.A.rev[ri('2024-12-31')] == null && dr.C.A.rev[ri('2025-12-31')] == null, 'שנים שהסדרה כבר על אותו בסיס — בלי יחס בתשובה');
ok(!dr.C.A.ni, 'מדד בלי הצגה מחדש — אין בכלל');
ok(dr.Q.rev[dr.q.indexOf('2023-12-31')] === 3283 - 2330 && dr.Q.rev[dr.q.indexOf('2024-12-31')] === 3224 - 2225,
  'רבעון רביעי מחושב: השנה כפי שדווחה מול אותם תשעה חודשים (לא 1,842 − 2,330 = רבעון שלילי)');
ok(dr.C.Q.rev[dr.q.indexOf('2024-12-31')] === 0, 'רבעון רביעי שאין לו רבעון מקביל על אותו בסיס — 0 = בלי צמיחה, לא צמיחה שגויה');
const vr = F.validate(dr);
ok(vr.some((c) => c.k === 'rst' && c.m === 'rev' && c.p === '2023-12-31') && !vr.some((c) => c.k === 'q4' && c.m === 'rev'), 'שנה שהוצגה מחדש — סימון מידע (rst), לא "הרבעונים לא מסתכמים"');

/* ---------- רווח נקי, רבעון מחושב ומניות ברבעון (סבב 2 של בקרת הדיוק, 26/10/2026) ---------- */
{
  const qd = (a, b, v, f, form = '10-Q') => [a, b, v, form, f];
  const qn = (dd, e) => (dd.q.indexOf(e) >= 0 ? dd.Q.ni[dd.q.indexOf(e)] : undefined);
  // CME: ‏NetIncomeLoss רק בשנים; ‏ProfitLoss = הרווח הנקי בכל תקופה משותפת, הרווח לבעלי המניות (ניירות משתתפים) נמוך ב־1.3% —
  // הרבעונים מהתגית שתואמת לראשית, והרבעון הרביעי לא מערבב שנה של רווח נקי עם תשעה חודשים לבעלי המניות
  const CM = facts([['NetIncomeLoss', 'USD', yrs([3200e6, 3525.8e6], 2023)],
    ['NetIncomeLossAvailableToCommonStockholdersBasic', 'USD', [...yrs([3160e6, 3481.5e6], 2023), qd('2024-01-01', '2024-09-30', 2617.8e6, '2024-11-08'), qd('2024-07-01', '2024-09-30', 901.3e6, '2024-11-08')]],
    ['ProfitLoss', 'USD', [...yrs([3200e6, 3525.8e6], 2023), qd('2024-01-01', '2024-09-30', 2651.2e6, '2024-11-08'), qd('2024-07-01', '2024-09-30', 912.8e6, '2024-11-08')]]]);
  const dcm = F.normalizeSec(CM, []);
  ok(qn(dcm, '2024-09-30') === 912.8e6 && Math.round(qn(dcm, '2024-12-31') / 1e5) === 8746, 'CME: רבעונים מ־ProfitLoss (= הרווח הנקי), לא מהרווח לבעלי המניות; רבעון רביעי ‎874.6 (לא ‎908)');
  // Realty Income 2026: אין NetIncomeLoss ברבעון — ProfitLoss פחות זכויות המיעוט (‎311.8), לא ProfitLoss כולל אותן (‎320.9)
  const OI = facts([['NetIncomeLoss', 'USD', yrs([860.8e6, 1058.6e6], 2024)],
    ['ProfitLoss', 'USD', [...yrs([867.3e6, 1069.8e6], 2024), qd('2026-01-01', '2026-03-31', 320.935e6, '2026-05-07')]],
    ['NetIncomeLossAttributableToNoncontrollingInterest', 'USD', [...yrs([6.5e6, 11.2e6], 2024), qd('2026-01-01', '2026-03-31', 9.169e6, '2026-05-07')]]]);
  const doi = F.normalizeSec(OI, []);
  ok(Math.round(qn(doi, '2026-03-31')) === 311766000, 'רבעון בלי NetIncomeLoss: ProfitLoss פחות זכויות המיעוט');
  // Bloom Energy: בדוח "Net loss" ‏(ProfitLoss) ושורת זכויות המיעוט; הרווח לבעלי המניות בתגית פרטית — הרווח = ההפרש
  const pg = (rows) => SF.parseR(`<table><tr><th class="tl" colspan="1" rowspan="2"><div><strong>Consolidated Statements of Operations - USD ($)<br> $ in Millions</strong></div></th><th class="th" colspan="2">12 Months Ended</th></tr>
<tr><th class="th"><div>Dec. 31, 2025</div></th><th class="th"><div>Dec. 31, 2024</div></th></tr>${rows.map(([c, t, l, v]) => row(c, t, l, v)).join('')}</table>`);
  const BL = facts([['Revenues', 'USD', yrs([1.47e9, 2.02e9], 2024)], ['ProfitLoss', 'USD', yrs([-27.2e6, -87.1e6], 2024)],
    ['NetIncomeLossAttributableToNoncontrollingInterest', 'USD', yrs([2e6, 1.3e6], 2024)], ['NetIncomeLoss', 'USD', [[...Y(2018), -273.5e6, '10-K', '2019-03-01']]]]);
  const dbl = F.normalizeSec(BL, [], { is: pg([['ro', 'us-gaap_Revenues', 'Revenue', ['2020', '1470']], ['rou', 'us-gaap_ProfitLoss', 'Net loss', ['(87.1)', '(27.2)']],
    ['ro', 'us-gaap_NetIncomeLossAttributableToNoncontrollingInterest', 'Less: noncontrolling interest', ['1.3', '2']], ['rou', 'be_NetIncomeLossAttributableToParent', 'Net loss attributable to common', ['(88.4)', '(29.2)']]]) });
  ok(dbl.tags.ni === 'ProfitLoss-NetIncomeLossAttributableToNoncontrollingInterest' && Math.round(dbl.A.ni[dbl.fy.indexOf('2025-12-31')]) === -88400000, 'Bloom: הרווח לבעלי המניות = הרווח הכולל פחות זכויות המיעוט (שתי השורות בדוח)');
  // Tractor Supply 2025: ההקשר של "הרבעון הרביעי" ב־10-K קיבל את הרווח של כל השנה — לא רבעון; שנה פחות תשעה חודשים
  const TS = facts([['NetIncomeLoss', 'USD', [...yrs([1101.2e6, 1096.087e6], 2024), qd('2025-01-01', '2025-09-30', 868.68e6, '2025-11-06'),
    qd('2025-07-01', '2025-09-30', 259.268e6, '2025-11-06'), qd('2025-10-01', '2025-12-31', 1096.087e6, '2026-02-19', '10-K')]]]);
  ok(Math.round(qn(F.normalizeSec(TS, []), '2025-12-31')) === 227407000, '"רבעון" שערכו השנה כולה — לא נכנס; הרבעון = שנה פחות תשעה חודשים');
  // CrowdStrike: (1) שנה שהוצגה מחדש בדוח שאחריה ותשעה חודשים שלא — הרבעון כפי שדווח (‎−92.3, כמו בהודעה לעיתונות);
  // (2) הדוח השנתי שבו הבסיס השתנה (הציג מחדש את השנה הקודמת) ותשעה חודשים מלפניו — אין רבעון (qmix · rst);
  // (3) Alnylam: תשעה חודשים מתוקנים בתוך הדוח השנתי עצמו — הרבעון מהם (‎111.5, כמו בהודעה)
  const CR = facts([['NetIncomeLoss', 'USD', [
    ['2023-02-01', '2024-01-31', 89.327e6, '10-K', '2024-03-07'], ['2023-02-01', '2024-01-31', 72.181e6, '10-K', '2026-03-05'],
    qd('2024-02-01', '2024-10-31', 73.011e6, '2024-11-27'), qd('2024-02-01', '2024-10-31', 73.011e6, '2025-12-03'),
    ['2024-02-01', '2025-01-31', -19.271e6, '10-K', '2025-03-10'], ['2024-02-01', '2025-01-31', -15.241e6, '10-K', '2026-03-05'],
    qd('2025-02-01', '2025-10-31', -221.879e6, '2025-12-03'), ['2025-02-01', '2026-01-31', -162.502e6, '10-K', '2026-03-05']]]]);
  const dcr = F.normalizeSec(CR, []);
  ok(Math.round(qn(dcr, '2025-01-31')) === -92282000, 'שנה שהוצגה מחדש בלי תשעת החודשים — הרבעון הרביעי כפי שדווח (‎−92.3, לא ‎−88.3)');
  ok(qn(dcr, '2026-01-31') == null && dcr.qmix.some((c) => c.m === 'ni' && c.p === '2026-01-31' && c.x === 'rst'), 'הדוח השנתי שינה בסיס ותשעת החודשים מלפניו — אין רבעון רביעי (qmix)');
  const AL = facts([['NetIncomeLoss', 'USD', [[...Y(2024), -278.157e6, '10-K', '2025-02-13'], [...Y(2024), -270e6, '10-K', '2026-02-12'],
    qd('2025-01-01', '2025-09-30', 127.328e6, '2025-10-30'), qd('2025-01-01', '2025-09-30', 202.204e6, '2026-02-12', '10-K'), [...Y(2025), 313.747e6, '10-K', '2026-02-12']]]]);
  ok(Math.round(qn(F.normalizeSec(AL, []), '2025-12-31')) === 111543000, 'תשעה חודשים מתוקנים בתוך הדוח השנתי — הרבעון הרביעי מהם (‎111.5)');
  // TransDigm: תשלומים לבעלי אופציות במקום דיבידנד מנוכים מהרווח למניה ברבעון שבו שולם הדיבידנד — הרבעון הרביעי מהרווח הגלום
  // (רווח למניה × מניות של השנה פחות שלושת הרבעונים): ‎7.75 כמו שפורסם, לא ‎9.42 (הרווח × היחס של השנה)
  const q3 = (y) => [['01-01', '03-31'], ['04-01', '06-30'], ['07-01', '09-30']].map(([a, b]) => [y + '-' + a, y + '-' + b]);
  const TDq = (vals) => q3(2025).map(([a, b], i) => qd(a, b, vals[i], b));
  const TD = facts([['NetIncomeLoss', 'USD', [...yrs([1714e6, 2074e6], 2024), ...TDq([493e6, 479e6, 492e6])]],
    ['EarningsPerShareDiluted', 'USD/shares', [...yrs([25.62, 32.08], 2024), ...TDq([7.62, 8.24, 8.47])]],
    ['WeightedAverageNumberOfDilutedSharesOutstanding', 'shares', [...yrs([57.8e6, 58.2e6], 2024), ...TDq([58.3e6, 58.1e6, 58.1e6])]]]);
  const dtd = F.normalizeSec(TD, []);
  ok(dtd.Q.eps[dtd.q.indexOf('2025-12-31')] === 7.75 && dtd.derived.eps.includes('2025-12-31'), 'רווח למניה ברבעון הרביעי מהרווח הגלום בשנה (‎7.75, לא ‎9.42)');
  // ממוצע המניות ברבעון הרביעי — מה שפורסם (Yahoo) גובר על ההערכה כשהוא קרוב; ערך ש־Yahoo חישב בעצמו — לא; הרווח למניה מחושב מחדש
  const BY = facts([['NetIncomeLoss', 'USD', [...yrs([380e6, 400e6], 2024), ...TDq([100e6, 100e6, 100e6])]],
    ['WeightedAverageNumberOfDilutedSharesOutstanding', 'shares', [...yrs([110e6, 102.5e6], 2024), ...TDq([110e6, 105e6, 100e6])]]]);
  const dby = () => F.normalizeSec(BY, []), iq = dby().q.indexOf('2025-12-31');
  const s1 = dby(); ok(s1.shEst.includes('2025-12-31') && Math.round(s1.Q.sh[iq] / 1e5) === 950, 'ההערכה שלנו (95) מסומנת כהערכה');
  const yq = { q: ['2025-09-30', '2025-12-31'], Q: { sh: [100e6, 96e6], eps: [1, null] }, qc: {} };
  const c1 = F.qShares(s1, yq);
  ok(s1.Q.sh[iq] === 96e6 && s1.Q.eps[iq] === 1.04 && c1.length === 1 && c1[0].k === 'qsh', 'מה שפורסם (96) גובר, והרווח למניה מחושב מחדש (100 ÷ 96 = 1.04); נרשם qsh');
  const s2 = dby(); F.qShares(s2, { ...yq, qc: { sh: ['2025-12-31'] } });
  ok(Math.round(s2.Q.sh[iq] / 1e5) === 950, 'רבעון ש־Yahoo חישב בעצמו (ממוצע שלושה) — לא גובר');
  const s3 = dby(); F.qShares(s3, { ...yq, Q: { sh: [100e6, 130e6], eps: [1, null] } });
  ok(Math.round(s3.Q.sh[iq] / 1e5) === 950, 'רחוק מההערכה ביותר מ־10% — ההערכה נשארת');
  ok(y.qc && y.qc.rev && y.qc.rev.includes('2025-12-31') && !F.q4Eps({ q: ['2025-12-31'], Q: { eps: [0.94] }, derived: { eps: ['2025-12-31'] } },
    { q: ['2025-12-31'], Q: { eps: [0.97] }, qc: { eps: ['2025-12-31'] } }).length, 'parseYahooTs מסמן רבעון שחישב (qc), ו־q4Eps לא מאמץ אותו');
}
/* ---------- 26/10/2026 (סבב 2): השקעות הוניות, מזומן וסך התחייבויות — מול הדוחות עצמם ---------- */
{
  const cfF = (rows) => ({ cf: { title: '', cols: [{ end: '2025-12-31', months: 12 }], scale: { cur: 1, sh: 1 }, rows: rows.map(([tag, label, v]) => ({ ns: 'us-gaap', tag, label, v: [v] })) } });
  const bsF = (rows) => ({ bs: { title: '', cols: [{ end: '2025-12-31' }], scale: { cur: 1, sh: 1 }, rows: rows.map(([tag, label, v]) => ({ ns: 'us-gaap', tag, label, v: [v] })) } });
  const REV = ['Revenues', 'USD', yrs([9, 9, 9], 2023)];
  // Dow: ‏"Capital expenditures" + "Purchases of previously leased assets" + "Investment in gas field developments" — רק הראשונה
  const DW = facts([REV, ['PaymentsToAcquireMachineryAndEquipment', 'USD', yrs([1501, 1823, 2356], 2023)], ['PaymentsToAcquireEquipmentOnLease', 'USD', yrs([694, 7, 7], 2023)],
    ['PaymentsToExploreAndDevelopOilAndGasProperties', 'USD', yrs([215, 203, 157], 2023)]]);
  const dw = F.normalizeSec(DW, [], cfF([['PaymentsToAcquireMachineryAndEquipment', 'Capital expenditures', -2356], ['PaymentsToExploreAndDevelopOilAndGasProperties', 'Investment in gas field developments', -157],
    ['PaymentsToAcquireEquipmentOnLease', 'Purchases of previously leased assets', -7]]));
  ok(dw.A.capex.join() === '1501,1823,2356', 'השקעות הוניות: בלי רכישת נכסים שהיו בחכירה ובלי פיתוח שדה גז לצד "Capital expenditures" (Dow)');
  // Diamondback: ‏"Additions to oil and natural gas properties" + "Property acquisitions" — רק הקידוח והפיתוח
  const FG = facts([REV, ['PaymentsToExploreAndDevelopOilAndGasProperties', 'USD', yrs([2701, 2867, 3523], 2023)], ['PaymentsToAcquireOilAndGasProperty', 'USD', yrs([2013, 8920, 5938], 2023)]]);
  const fg = F.normalizeSec(FG, [], cfF([['PaymentsToExploreAndDevelopOilAndGasProperties', 'Additions to oil and natural gas properties', -3523], ['PaymentsToAcquireOilAndGasProperty', 'Property acquisitions', -5938]]));
  ok(fg.tags.capex === 'PaymentsToExploreAndDevelopOilAndGasProperties' && fg.A.capex.join() === '2701,2867,3523', 'השקעות הוניות של נפט וגז: הקידוח, לא "Property acquisitions" (Diamondback)');
  // Host Hotels: ‏"Renewals and replacements" + "Return on investment"
  const HS = facts([REV, ['PaymentsToAcquireOtherProductiveAssets', 'USD', yrs([451, 288, 362], 2023)], ['PaymentsForCapitalImprovements', 'USD', yrs([195, 260, 282], 2023)]]);
  ok(F.normalizeSec(HS, [], cfF([['PaymentsToAcquireOtherProductiveAssets', 'Renewals and replacements', -362], ['PaymentsForCapitalImprovements', 'Return on investment', -282]])).A.capex.join() === '646,548,644', 'השקעות הוניות = חידושים + השקעה בשיפורים (Host)');
  // Camden: פיתוח (כמעט הכל) + נכסים אחרים (רק בחלק מה־10-Q) — הרבעונים מהפיתוח
  const CP = facts([['Revenues', 'USD', [...yrs([9, 9, 9], 2023), ['2026-01-01', '2026-03-31', 2, '10-Q', '2026-05-01'], ['2026-04-01', '2026-06-30', 2, '10-Q', '2026-07-31']]], ['PaymentsToDevelopRealEstateAssets', 'USD', [...yrs([411, 394, 440], 2023), ['2026-01-01', '2026-03-31', 94, '10-Q', '2026-05-01'], ['2026-01-01', '2026-06-30', 240, '10-Q', '2026-07-31']]],
    ['PaymentsToAcquireOtherPropertyPlantAndEquipment', 'USD', yrs([5.6, 3.8, 2.4], 2023)]]);
  const cp = F.normalizeSec(CP, [], cfF([['PaymentsToDevelopRealEstateAssets', 'Development and capital improvements, including land', -440], ['PaymentsToAcquireOtherPropertyPlantAndEquipment', 'Increase in non-real estate assets', -2.4]]));
  const cq = (d, e) => (d.q.includes(e) ? d.Q.capex[d.q.indexOf(e)] : undefined);
  ok(near(cp.A.capex[2], 442.4) && cq(cp, '2026-03-31') === 94 && cq(cp, '2026-06-30') === 146, 'ריט: פיתוח ושיפורים בהשקעות ההוניות, ורבעונים מהחלק העיקרי (Camden)');
  // Republic Services: רבעון ישיר בתגית משלימה = ביאור המגזרים (453.7); בתזרים 1357.4 − 917.9 = 439.5
  const q = (s, e, v, form, filed) => [s, e, v, form, filed];
  const RS = facts([['Revenues', 'USD', [...yrs([16, 16], 2023), q('2024-01-01', '2024-03-31', 4, '10-Q', '2024-05-01'), q('2024-04-01', '2024-06-30', 4, '10-Q', '2024-07-25'), q('2024-07-01', '2024-09-30', 4, '10-Q', '2024-10-30')]],
    ['PaymentsToAcquirePropertyPlantAndEquipment', 'USD', [...yrs([1300, 1631], 2022), q('2023-01-01', '2023-09-30', 1100, '10-Q', '2023-10-30'), q('2023-01-01', '2023-09-30', 1100, '10-Q', '2024-10-30'),
      q('2024-01-01', '2024-03-31', 514.5, '10-Q', '2024-05-01'), q('2024-01-01', '2024-06-30', 917.9, '10-Q', '2024-07-25'), q('2024-01-01', '2024-09-30', 1357.4, '10-Q', '2024-10-30')]],
    ['PaymentsToAcquireProductiveAssets', 'USD', [...yrs([1300, 1631], 2022), q('2024-04-01', '2024-06-30', 403.4, '10-Q', '2024-07-25'), q('2024-07-01', '2024-09-30', 453.7, '10-Q', '2024-10-30')]]]);
  const rs = F.normalizeSec(RS, []);
  ok(near(cq(rs, '2024-09-30'), 439.5) && near(cq(rs, '2024-06-30'), 403.4), 'רבעון ישיר בתגית משלימה שסותר את המצטברים מאותו דוח — לא נכנס (Republic Services); רבעון שמתיישב — נכנס');
  // Fortive: אחרי הפרדה התשעה חודשים הוצגו מחדש (63.5 במקום 83.4) — הרבעון הישיר מהבסיס החדש נכנס
  const FV = facts([['Revenues', 'USD', [...yrs([16, 16], 2023), q('2024-07-01', '2024-09-30', 4, '10-Q', '2024-10-30')]],
    ['PaymentsToAcquirePropertyPlantAndEquipment', 'USD', [...yrs([80, 78.6], 2022), q('2023-01-01', '2023-09-30', 60, '10-Q', '2023-10-30'), q('2023-01-01', '2023-09-30', 50, '10-Q', '2025-10-29'),
      q('2024-01-01', '2024-06-30', 55.6, '10-Q', '2024-07-24'), q('2024-01-01', '2024-09-30', 83.4, '10-Q', '2024-10-30'), q('2024-01-01', '2024-09-30', 63.5, '10-Q', '2025-10-29')]],
    ['PaymentsToAcquireProductiveAssets', 'USD', [...yrs([80, 78.6], 2022), q('2024-06-29', '2024-09-30', 21.6, '10-Q', '2025-10-29')]]]);
  ok(cq(F.normalizeSec(FV, []), '2024-09-30') === 21.6, 'רבעון ישיר מדוח שהציג מחדש — נכנס (Fortive)');
  // Fortinet: ב־10-Q של 2026 השורה בתזרים עברה לתגית אחרת; התגית הקודמת בביאור (בלי 2025 לצידה)
  const FT = facts([['Revenues', 'USD', [...yrs([16, 16, 16], 2023), q('2026-01-01', '2026-03-31', 4, '10-Q', '2026-05-08'), q('2026-04-01', '2026-06-30', 4, '10-Q', '2026-07-30')]],
    ['PaymentsToAcquireProductiveAssets', 'USD', [...yrs([204, 379, 365], 2023), q('2025-01-01', '2025-03-31', 66.5, '10-Q', '2025-05-08'), q('2025-01-01', '2025-06-30', 234.3, '10-Q', '2025-08-08'),
      q('2026-01-01', '2026-03-31', 47.1, '10-Q', '2026-05-08'), q('2026-01-01', '2026-06-30', 62.1, '10-Q', '2026-07-30')]],
    ['PaymentsToAcquirePropertyPlantAndEquipment', 'USD', [q('2025-01-01', '2025-03-31', 66.5, '10-Q', '2025-05-08'), q('2025-01-01', '2025-03-31', 66.5, '10-Q', '2026-05-08'),
      q('2025-01-01', '2025-06-30', 234.3, '10-Q', '2025-08-08'), q('2025-01-01', '2025-06-30', 234.3, '10-Q', '2026-07-30'),
      q('2026-01-01', '2026-03-31', 70.6, '10-Q', '2026-05-08'), q('2026-01-01', '2026-06-30', 148.6, '10-Q', '2026-07-30')]]]);
  const ft = F.normalizeSec(FT, [], cfF([['PaymentsToAcquireProductiveAssets', 'Purchases of property and equipment', -365]]));
  ok(near(cq(ft, '2026-03-31'), 70.6) && near(cq(ft, '2026-06-30'), 78), 'השקעות הוניות: ערך בלי השוואה לשנה הקודמת באותו דוח מוחלף בשורה שיש לה (Fortinet 2026)');
  // מזומן — Gen Digital: ‏"Cash" בביאור; המאזן בתגית הכוללת מזומן מוגבל
  const inst = (end, val, form, filed) => [null, end, val, form, filed];
  const R = 'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents';
  const GN = facts([REV, ['CashAndCashEquivalentsAtCarryingValue', 'USD', [inst('2024-12-31', 1006, '10-K', '2025-02-01')]],
    ['Cash', 'USD', [inst('2024-12-31', 462, '10-K', '2025-02-01'), inst('2025-12-31', 283, '10-K', '2026-02-01')]],
    [R, 'USD', [inst('2024-12-31', 1006, '10-K', '2026-02-01'), inst('2025-12-31', 411, '10-K', '2026-02-01')]]]);
  const gn = F.normalizeSec(GN, [], bsF([[R, 'Cash, cash equivalents and restricted cash', 411]]));
  ok(gn.A.cash.join() === ',1006,411', 'מזומן: "Cash" שאינה בשורה במאזן — לא נכנסת (Gen Digital)');
  // 3M: השורה במאזן בתגית שכוללת מזומן של פעילות שנמכרה — 2023 כפי שבמאזן (5735), לא סך התזרים (5933)
  const DG = 'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalentsIncludingDisposalGroupAndDiscontinuedOperations';
  const MM = facts([REV, [R, 'USD', [inst('2023-12-31', 5933, '10-K', '2024-02-01'), inst('2023-12-31', 5933, '10-K', '2025-02-01'), inst('2024-12-31', 5600, '10-K', '2025-02-01')]],
    [DG, 'USD', [inst('2023-12-31', 5933, '10-K', '2024-02-01'), inst('2023-12-31', 5735, '10-K', '2025-02-01'), inst('2024-12-31', 5600, '10-K', '2025-02-01'), inst('2025-12-31', 5235, '10-K', '2026-02-01')]]]);
  ok(F.normalizeSec(MM, [], bsF([[DG, 'Cash and cash equivalents', 5235]])).A.cash.join() === '5735,5600,5235', 'מזומן: התגית שבמאזן גם כשהיא כוללת פעילות שנמכרה (3M)');
  // McKesson: ‏"Redeemable noncontrolling interests" לא בסך ההתחייבויות המחושב
  const MK = facts([REV, ['LiabilitiesAndStockholdersEquity', 'USD', [inst('2025-12-31', 82323, '10-K', '2026-02-01')]],
    ['StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest', 'USD', [inst('2025-12-31', -1777, '10-K', '2026-02-01')]],
    ['StockholdersEquity', 'USD', [inst('2025-12-31', -2172, '10-K', '2026-02-01')]],
    ['RedeemableNoncontrollingInterestEquityCommonCarryingAmount', 'USD', [inst('2025-12-31', 943, '10-K', '2026-02-01')]]]);
  ok(F.normalizeSec(MK, [], bsF([['RedeemableNoncontrollingInterestEquityCommonCarryingAmount', 'Redeemable noncontrolling interests', 943]])).A.tl[2] === 83157, 'סך התחייבויות מחושב בלי זכויות מיעוט שניתנות לפדיון — השורה במאזן (McKesson)');
  ok(F.normalizeSec(MK, [], bsF([['StockholdersEquity', 'Total stockholders equity', -2172]])).A.tl[2] === 84100, 'אותה תגית בביאור בלבד — לא מחסרים (NiSource: זכויות המיעוט כבר בתוך ההון)');
  // Nebius: דוח ברובל עם עמודת המרה לדולר — העמודה לא נכנסת; דוח בדולר (השוואה מוצגת מחדש) — כן
  const NB = facts([['Revenues', 'USD', yrs([13.5, 9.8, 91.5], 2022).map((r) => [...r.slice(0, 3), '20-F', '2026-04-30'])], ['Assets', 'RUB', [inst('2021-12-31', 515496e6, '20-F', '2023-04-20'), inst('2022-12-31', 616719e6, '20-F', '2023-04-20')]]]);
  NB.facts['us-gaap'].Assets.units.USD = [{ end: '2022-12-31', val: 8768e6, form: '20-F', filed: '2023-04-20', fy: 2022, fp: 'FY' }, { end: '2023-12-31', val: 8755e6, form: '20-F', filed: '2026-04-30', fy: 2025, fp: 'FY' },
    { end: '2024-12-31', val: 3549e6, form: '20-F', filed: '2026-04-30', fy: 2025, fp: 'FY' }];
  const nb = F.normalizeSec(NB, []);
  ok(nb.cur === 'USD' && nb.A.ta.join() === [null, 8755e6, 3549e6].join(), 'עמודת המרה (הדוח ברובל, הדולר רק לשנה האחרונה) — לא נכנסת (Nebius 2022)');
}

(async () => {
  const calls = [];
  global.fetch = async (url, opts = {}) => {
    const u = String(url); calls.push(u);
    const J = (o, st = 200) => ({ status: st, ok: st === 200, headers: { get: (h) => (h === 'set-cookie' ? 'A3=x; Path=/' : null) }, json: async () => o, text: async () => (typeof o === 'string' ? o : JSON.stringify(o)) });
    if (u.includes('company_tickers_exchange')) return J({ fields: ['cik', 'name', 'ticker', 'exchange'], data: [[123, 'Acme', 'ACME', 'NYSE']] });
    if (u.includes('/companyfacts/CIK0000000123')) { ok(/@/.test(opts.headers['User-Agent']), 'SEC: מזהה עם כתובת (נדרש ב־www.sec.gov)'); return J(ACME); }
    if (u.includes('/submissions/CIK0000000123')) return J({ sic: '7370', sicDescription: 'Services', fiscalYearEnd: '1231', filings: { recent: { filingDate: ['2021-08-01'] } } });
    if (u.includes('/v8/finance/chart/')) return J({ chart: { result: [{ meta: { currency: 'USD' }, timestamp: [1609459200], indicators: { quote: [{ close: [50] }] }, events: { splits: { a: { date: 1592179200, numerator: 2, denominator: 1 } } } }] } });
    if (u.includes('fc.yahoo.com')) return J('');
    if (u.includes('getcrumb')) return J('crumbX');
    if (u.includes('quoteSummary')) return J({ quoteSummary: { result: [{ price: { longName: 'Acme', currency: 'USD', regularMarketPrice: { raw: 50 } }, assetProfile: { industryDisp: 'Software - Application' } }] } });
    if (u.includes('fundamentals-timeseries')) return J({ timeseries: { result: [] } });
    if (u.includes('api.nasdaq.com')) return J({ data: null });
    if (u.includes('recommendationsbysymbol')) return J({ finance: { result: [{ symbol: 'ACME', recommendedSymbols: [{ symbol: 'BETA' }, { symbol: 'ACME' }, { symbol: 'bad sym!' }, { symbol: 'GAMA.TA' }] }] } });
    if (u.includes('fred.stlouisfed.org')) return J('down', 503);
    if (u.includes('home.treasury.gov')) return J('Date,"10 Yr"\n10/23/2026,5.00\n');
    return J({}, 404);
  };
  const history = require(path.join(root, 'ibkr-proxy/api/history.js'));
  const call = async (body, origin = 'https://yishaiguedj1.github.io') => {
    const res = { code: 0, body: null, headers: {}, status(c) { this.code = c; return this; }, json(o) { this.body = o; return this; }, setHeader(k, v) { this.headers[k] = v; }, end() { return this; } };
    await history({ method: 'POST', headers: { origin }, body, socket: { remoteAddress: '1.2.3.' + (n % 200) } }, res);
    return res;
  };
  let r = await call({ op: 'fund', sym: 'ACME' });
  ok(r.code === 200 && r.body.ok && r.body.src === 'sec' && r.body.sic === '7370', 'op:fund — SEC דרך /api/history');
  ok(r.body.A.rev.length === r.body.fy.length && r.body.ind === 'Software (System & Application)' && r.body.indData && r.body.indData.bu > 0, 'op:fund — דוחות, ענף ונתוני הענף');
  ok(r.body.checks.some((c) => c.k === 'bal'), 'op:fund — בדיקות האימות חוזרות ללקוח');
  ok(r.body.sharesOut === 200 && r.body.price === 50, 'op:fund — מניות מהדוח האחרון (לא מ־Yahoo) ומחיר');
  ok(JSON.stringify(r.body.peers) === '["BETA","GAMA.TA"]', 'op:fund — מועמדים לעמיתים מ־Yahoo: בלי החברה עצמה ובלי סימבול לא תקין');
  const before = calls.length;
  await call({ op: 'fund', sym: 'acme' });
  ok(calls.length === before, 'op:fund — מטמון: בקשה שנייה בלי פנייה החוצה');
  r = await call({ op: 'fund', sym: '../etc' });
  ok(r.code === 400, 'op:fund — סימבול לא תקין = 400');
  r = await call({ op: 'fund', sym: 'ACME' }, 'https://evil.example');
  ok(r.code === 403, 'op:fund — מקור לא מאושר = 403');
  r = await call({ op: 'macro' });
  ok(r.code === 200 && r.body.rf === 0.05 && r.body.rfSrc === 'US Treasury' && r.body.erp === dmd.erp && r.body.ind['Software (Internet)'], 'op:macro — FRED נפל → Treasury; פרמיות וענפים');
  ok(!calls.some((u) => /portfolio|uid|token/i.test(u)), 'שום פנייה החוצה לא נושאת מידע של המשתמש');
  // היסטוריה ארוכה (JPM מ־1984): ‏range=max מחזיר נרות של 3 חודשים — בקשה נוספת ל־25 שנה בחודשים, הפיצולים מהמלאה
  const seen = [];
  global.fetch = async (url) => {
    const u = String(url); seen.push(u);
    const J = (o) => ({ status: 200, ok: true, headers: { get: () => null }, json: async () => o, text: async () => JSON.stringify(o) });
    const ts = (n, step) => Array.from({ length: n }, (_, i) => 1e9 + i * step);
    if (u.includes('range=max')) return J({ chart: { result: [{ meta: { currency: 'USD', dataGranularity: '3mo' }, timestamp: ts(10, 7776000), indicators: { quote: [{ close: ts(10, 1).map(() => 10) }] }, events: { splits: { a: { date: 900000000, numerator: 2, denominator: 1 } } } }] } });
    return J({ chart: { result: [{ meta: { currency: 'USD', dataGranularity: '1mo' }, timestamp: ts(30, 2629800), indicators: { quote: [{ close: ts(30, 1).map(() => 12) }] } }] } });
  };
  const ym = await F.yahooMonthly('JPM');
  ok(seen.length === 2 && /period1=\d+&period2=\d+&interval=1mo/.test(seen[1]) && ym.px.t.length === 30 && ym.px.c[0] === 12 && ym.splits.length === 1, 'מחירים חודשיים גם לחברה ותיקה — והפיצולים נשמרים');
  console.log(`\nכל ${n} הבדיקות עברו ✓`);
})().catch((e) => { console.error('נכשל:', e.stack || e.message); process.exit(1); });
