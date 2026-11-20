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
  // זרוע מימון — כמו הממשקים: רווח גולמי מ־Yahoo; רבעון ש־SEC לא מאפשר — המספר שהחברה פרסמה (Yahoo), רק זרימות שיש לנו
  ok(F.finArmOf([{ label: 'Automotive' }, { label: 'GM Financial' }]) && F.finArmOf([{ label: 'Interest expense on Company debt excluding Ford Credit' }]) &&
    !F.finArmOf([{ label: 'Net sales' }, { label: 'Income tax credit' }]), 'זרוע מימון בדוח רווח והפסד — מזוהה (לא זיכוי מס)');
  // Snap-on: השורות של שירותי המימון בלי שם הזרוע ("Net sales" עם ממד) — הזרוע רק בכותרת (h). עלות מימון של החברה עצמה — לא זרוע
  ok(F.finArmOf([{ label: 'Net sales' }, { label: 'Net sales', h: 'Financial Service' }]) && F.finArmOf([{ label: 'Interest expense of Financial Products' }]) &&
    F.finArmOf([{ label: 'Financing income' }, { label: 'Financing cost' }]) && F.finArmOf([{ label: 'Financial Services expenses' }]),
    'זרוע מימון — גם בכותרת שמעל השורות, וגם "Financial Service" ביחיד');
  ok(!['Write-off of financing costs on extinguished debt', 'Financing costs, net', 'Provision for credit losses', 'Provision for Credit Losses',
    'Net income (loss) attributable to Principal Financial Group, Inc.', 'Interest and other financing expenses', 'Amortization of deferred financing costs',
    'Mortgage and other financing income, net', 'Letter of credit and loan fees', 'Net losses on financial instruments',
    'Gains on Mark-to-Market Financial Commodity and Other Derivative Contracts, Net', 'Net income attributable to Prudential Financial, Inc.'].some((l) => F.finArmOf([{ label: l }])) &&
    !F.finArmOf([{ label: 'Net sales', h: 'Income tax credit' }]),
    'זרוע מימון — לא עלות מימון / הפרשה להפסדי אשראי / שם החברה (CBRE, ‏APA, בנקים, Principal)');
  const sq3 = { q: ['2025-09-30', '2025-12-31'], Q: { rev: [10, null], debt: [5, null] }, gpx: 'ok' }, ch3 = [];
  const qf3 = F.yQuarterFill(sq3, { q: ['2025-09-30', '2025-12-31'], Q: { rev: [10, 11], debt: [5, 6], gp: [3, 4] }, qc: {} }, true, ch3);
  ok(sq3.Q.rev[1] === 11 && sq3.Q.debt[1] == null && !sq3.Q.gp && qf3.rev.join() === '2025-12-31' && ch3[0].k === 'qfy', 'רבעון חסר — כפי שפורסם (Yahoo), רק זרימה שיש לנו (לא מאזן, לא רווח גולמי)');
  const sq4 = { q: ['2025-12-31'], Q: { rev: [null] }, gpx: 'ok' };
  ok(!F.yQuarterFill(sq4, { q: ['2025-12-31'], Q: { rev: [11] }, qc: { rev: ['2025-12-31'] } }, true, []).rev, 'רבעון ש־Yahoo חישב בעצמו — לא');
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
// שורת כותרת (rh) בתוך הדוח — נשמרת בשורות שאחריה (h); לפניה — בלי h (Snap-on: "Financial Service" מעל "Net sales" עם ממד)
{ const rh = (label) => `<tr class="rh"><td class="pl"><a onclick="Show.showAR( this, 'defref_srt_ProductOrServiceAxis=x_FinancialServicesMember', window );">${label}</a></td><td class="text">&#160;<span></span></td></tr>`;
  const rx = SF.parseR(`<table><tr><th class="tl"><div><strong>Consolidated Statements of Earnings - USD ($)<br> $ in Millions</strong></div></th><th class="th"><div>Jan. 03, 2026</div></th></tr>${row('re', 'us-gaap_Revenues', 'Net sales', ['$ 5,156.1'])}${rh('Financial Service')}${row('ro', 'us-gaap_Revenues', 'Net sales', ['412.9'])}</table>`);
  ok(rx.rows.length === 2 && rx.rows[0].h === undefined && rx.rows[1].h === 'Financial Service' && rx.rows[1].v[0] === 412.9 && F.finArmOf(rx.rows),
    'דף R: כותרת של ממד נשמרת בשורות שאחריה (h), וזרוע המימון מזוהה ממנה'); }
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
// FMX ‏2025: שתי שורות ProfitLoss ועמודת המרה לדולר — הבחירה בין השורות רק לפי העמודות שמושוות (מטבע הדיווח)
{ const S = { scale: { cur: 1e6, sh: 1e6 }, cols: [{ end: '2025-12-31', months: 12, cur: 'USD' }, { end: '2025-12-31', months: 12, cur: 'MXN' }, { end: '2024-12-31', months: 12, cur: 'MXN' }, { end: '2023-12-31', months: 12, cur: 'MXN' }],
    rows: [{ tag: 'ProfitLoss', label: 'CONSOLIDATED NET INCOME', v: [1836, 33053, 40236, 76677] }, { tag: 'ProfitLoss', label: 'CONSOLIDATED NET INCOME', v: [null, 31479, 40121, 44439] }] };
  const D = { tags: { ni: 'ProfitLoss' }, fy: ['2023-12-31', '2024-12-31', '2025-12-31'], A: { ni: [76677e6, 40236e6, 33053e6] }, cur: 'MXN' };
  const r = F.faceCheck(D, { is: S });
  ok(r.seen.n === 3 && r.seen.ok === 3 && !r.out.length && !r.fill.length, 'FMX: עמודת ההמרה לדולר לא בוחרת את השורה — נבחרת השורה שתואמת במטבע הדיווח'); }
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
  // Chevron: הסך "Total Revenues and Other Income" בתגית Revenues (מכירות + חברות כלולות + הכנסות אחרות) — נשאר ההכנסות (סט הזהב)
  const CV = facts([['Revenues', 'USD', yrs(M([200949, 202792]), 2023)], ['RevenueFromContractWithCustomerExcludingAssessedTax', 'USD', yrs(M([196913, 193414]), 2023)],
    ['NetIncomeLoss', 'USD', yrs(M([21369, 17661]), 2023)]]);
  const cvF = (lab) => ({ is: page([['ro', 'us-gaap_RevenueFromContractWithCustomerExcludingAssessedTax', 'Sales and other operating revenues', ['193414', '196913']],
    ['ro', 'cvx_EquityMethodInvestmentIncome', 'Income from equity affiliates', ['4596', '5131']], ['rou', 'us-gaap_Revenues', lab, ['202792', '200949']],
    ['rou', 'us-gaap_NetIncomeLoss', 'Net income', ['17661', '21369']]]) });
  ok(F.normalizeSec(CV, [], cvF('Total Revenues and Other Income')).tags.rev === 'Revenues', 'Chevron: סך "…and Other Income" — ההכנסות = הסך כפי שמודפס (כמו בסט הזהב ו־ExxonMobil)');
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
ok(F.parseTreasury('Date,"1 Mo","10 Yr","30 Yr"\n10/23/2026,4.11,5.00,5.33\n', '30 Yr')[0][1] === 5.33, 'Treasury: עמודת 30 Yr — האג"ח הארוך של מכפיל באפט (גל 3)');
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
  // גל 10 (F42) — Occidental ‏Q3 2026: סך התזרים התפעולי לא הוצג מחדש (תשעה חודשים של 2025 ‏7,898 בשני הדוחות); רק התגית של
  // "פעילות נמשכת" הציגה מחדש (‏7,898 → ‏7,208). הרבעון = ‏9,224 − ‏5,552 מאותה תגית (‏3,672), לא "בסיס מעורב"
  const OX = facts([['Revenues', 'USD', [...yrs([27000e6, 26000e6], 2024), ...[['01-01', '03-31'], ['04-01', '06-30'], ['07-01', '09-30']].map(([x, y]) => qd('2026-' + x, '2026-' + y, 6500e6, '2026-' + y))]], ['NetCashProvidedByUsedInOperatingActivities', 'USD', [...yrs([12000e6], 2024), [...Y(2025), 10532e6, '10-K', '2026-02-18'],
    qd('2025-01-01', '2025-06-30', 5108e6, '2025-08-06'), qd('2025-01-01', '2025-06-30', 5108e6, '2026-08-05'),
    qd('2025-01-01', '2025-09-30', 7898e6, '2025-11-10'), qd('2025-01-01', '2025-09-30', 7898e6, '2026-11-09'),
    qd('2026-01-01', '2026-03-31', 1281e6, '2026-05-05'), qd('2026-01-01', '2026-06-30', 5552e6, '2026-08-05'), qd('2026-01-01', '2026-09-30', 9224e6, '2026-11-09')]],
  ['NetCashProvidedByUsedInOperatingActivitiesContinuingOperations', 'USD', [qd('2025-01-01', '2025-09-30', 7898e6, '2025-11-10'),
    qd('2025-01-01', '2025-09-30', 7208e6, '2026-11-09'), qd('2025-01-01', '2025-06-30', 4761e6, '2026-08-05'),
    qd('2026-01-01', '2026-06-30', 6478e6, '2026-08-05'), qd('2026-01-01', '2026-09-30', 10606e6, '2026-11-09')]]]);
  const dox = F.normalizeSec(OX, []);
  ok(dox.Q.ocf[dox.q.indexOf('2026-09-30')] === 3672e6 && !dox.qmix.some((c) => c.m === 'ocf'), 'F42: הצגה מחדש רק בתגית מועמדת אחרת — הרבעון מאותה תגית (‏3,672), בלי qmix');
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
  // (16/11/2026, בדיקת העומק) כשהיחס של השנה מסביר את שלושת הרבעונים שהודפסו — הרווח × היחס, לא החיסור: השנה ‎10.01 מעוגלת
  // (‎1000.6 ÷ 100) והחיסור נותן ‎2.51; הרווח של הרבעון ÷ המניות — ‎2.50. מבחן לאחור על 135 רבעונים רביעיים שהודפסו: 80 → 99 נכונים
  const FT = facts([['NetIncomeLoss', 'USD', [...yrs([1000.6e6], 2025), ...TDq([250.4e6, 249.6e6, 250.4e6])]],
    ['EarningsPerShareDiluted', 'USD/shares', [...yrs([10.01], 2025), ...TDq([2.5, 2.5, 2.5])]],
    ['WeightedAverageNumberOfDilutedSharesOutstanding', 'shares', [...yrs([100e6], 2025), ...TDq([100e6, 100e6, 100e6])]]]);
  const dft = F.normalizeSec(FT, []);
  ok(dft.Q.eps[dft.q.indexOf('2025-12-31')] === 2.5, 'רווח למניה ברבעון הרביעי: היחס של השנה מסביר את הרבעונים — ‎2.50, לא ‎2.51 מהחיסור');
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
  // LyondellBasell (26/10/2026): ממוצע המניות מתויג רק עם ממד — אין ב־companyfacts; רווח נקי ÷ רווח למניה (‏115 ÷ ‏0.34 = ‏338M) הוא
  // הערכה (פעילות שהופסקה, ניירות משתתפים, עיגול לסנט) — מסומן shEst, ומה שפורסם בביאור (322M, דרך Yahoo) גובר
  const LY = facts([['NetIncomeLoss', 'USD', [...yrs([1360e6], 2024), ...TDq([177e6, 115e6, -890e6])]],
    ['EarningsPerShareDiluted', 'USD/shares', [...yrs([4.15], 2024), ...TDq([0.54, 0.34, -2.77])]]]);
  const sly = F.normalizeSec(LY, []), il = sly.q.indexOf('2025-06-30');
  ok(Math.round(sly.Q.sh[il] / 1e6) === 338 && sly.shEst.includes('2025-06-30'), 'מניות מרווח ÷ רווח למניה ברבעון — מסומנות כהערכה');
  const cly = F.qShares(sly, { q: ['2025-06-30'], Q: { sh: [322e6], eps: [0.34] }, qc: {} });
  ok(sly.Q.sh[il] === 322e6 && sly.Q.eps[il] === 0.34 && cly.length === 1, 'מה שפורסם (322M) גובר על רווח ÷ רווח למניה; הרווח למניה שדווח נשאר');
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
  /* סבב 3 (26/10/2026): שורת השקעה הונית בתגית פרטית לצד התגית שלנו, וחלק של סכום שאינו "תיקון" שלו */
  const cfX = (rows, ends = ['2025-12-31']) => ({ cf: { title: '', cols: ends.map((end) => ({ end, months: 12 })), scale: { cur: 1, sh: 1 },
    rows: rows.map(([tag, label, v]) => ({ ns: /:/.test(tag) ? tag.split(':')[0] : 'us-gaap', tag: tag.split(':').pop(), label, v: Array.isArray(v) ? v : [v] })) } });
  // CoStar: ‏"…for new campuses" (שלנו) ‏$307M + "Purchases of property, equipment, and other assets" (פרטית) ‏$82M — לא רק $307M
  const CS = F.normalizeSec(facts([REV, ['PaymentsToAcquirePropertyPlantAndEquipment', 'USD', yrs([118, 579, 307], 2023)]]), [],
    cfX([['PaymentsToAcquirePropertyPlantAndEquipment', 'Purchases of property, equipment, and other assets for new campuses', [-307, -579, -118]],
      ['csgp:PaymentsToAcquirePropertyAndEquipmentAndOtherAssets', 'Purchases of property, equipment, and other assets', [-82, -59, -25]],
      ['csgp:CapitalExpendituresIncurredButNotYetPaidAndNoncashLandlordIncentives', 'Accrued capital expenditures and non-cash landlord incentives', [74, 64, 29]]], ['2025-12-31', '2024-12-31', '2023-12-31']));
  ok(!CS.A.capex && !CS.tags.capex && CS.capFace && CS.capFace.map((c) => c.v).join() === '389,638,143', 'השקעות הוניות: התגית שלנו + שורה בתגית פרטית — לא חלק; capFace = הסכום שהודפס לכל שנה (CoStar), בלי הצבירה שלא שולמה');
  // Weyerhaeuser: ‏"…for timberlands reforestation" (שלנו) + "Capital expenditures for property and equipment" (פרטית), ובלי "Acquisition of timberlands"
  const WY = F.normalizeSec(facts([REV, ['PaymentsForCapitalImprovements', 'USD', yrs([57, 52, 51], 2023)], ['PaymentsToAcquireTimberlands', 'USD', yrs([233, 251, 469], 2023)]]), [],
    cfX([['wy:PaymentsForCapitalExpendituresOfPropertyPlantAndEquipment', 'Capital expenditures for property and equipment', -423], ['PaymentsForCapitalImprovements', 'Capital expenditures for timberlands reforestation', -51],
      ['PaymentsToAcquireTimberlands', 'Acquisition of timberlands (Note 4)', -469]]));
  ok(!WY.A.capex && WY.capFace && WY.capFace[0].v === 474, 'השקעות הוניות = שתי שורות "Capital expenditures" (Weyerhaeuser ‏423 + 51), בלי רכישת היערות');
  // שורה פרטית שהיא כבר הסך ("Total capital expenditures") — לבד, לא פעמיים
  const TT = F.normalizeSec(facts([REV, ['PaymentsToAcquirePropertyPlantAndEquipment', 'USD', yrs([90, 95, 100], 2023)]]), [],
    cfX([['PaymentsToAcquirePropertyPlantAndEquipment', 'Purchases of property and equipment', -100], ['xx:PaymentsForCapitalExpendituresTotal', 'Total capital expenditures', -130]]));
  ok(TT.capFace && TT.capFace[0].v === 130, 'שורה פרטית של הסך — הסך לבד (לא 230)');
  // התגית שלנו = הסכום שהודפס עם השורה הפרטית — נשארת (ConocoPhillips)
  const SM = F.normalizeSec(facts([REV, ['PaymentsToAcquirePropertyPlantAndEquipment', 'USD', yrs([90, 95, 130], 2023)]]), [],
    cfX([['PaymentsToAcquirePropertyPlantAndEquipment', 'Purchases of property and equipment', -100], ['xx:PaymentsForCapex', 'Capital expenditures — other', -30]]));
  ok(SM.tags.capex === 'PaymentsToAcquirePropertyPlantAndEquipment' && !SM.capFace, 'הערך שלנו = כל השורות שבדוח — לא נוגעים');
  // Dow / Exelon / Strategy: שורות פרטיות "קשורות" להשקעה — גידור, תמריצים, השקעות שלא שולמו, מקדמות — לא השקעה הונית
  const DX = F.normalizeSec(facts([REV, ['PaymentsToAcquireMachineryAndEquipment', 'USD', yrs([2356, 2940, 2479], 2023)]]), [],
    cfX([['PaymentsToAcquireMachineryAndEquipment', 'Capital expenditures', -2479], ['dow:ProceedsFromIncentivesRelatedToCapitalExpenditures', 'Proceeds from incentives related to capital expenditures', 145],
      ['dow:CashFlowHedgingRelatedToCapitalExpenditures', 'Cash flow hedging related to capital expenditures', -40], ['exc:ChangeInCapex', 'Increase (decrease) in capital expenditures not paid', -215],
      ['mstr:AdvanceDeposits', 'Advance deposits on purchases of property and equipment', -37]]));
  ok(DX.tags.capex === 'PaymentsToAcquireMachineryAndEquipment' && DX.A.capex.join() === '2356,2940,2479' && !DX.capFace, 'שורות "related to" / "not paid" / מקדמות בתגית פרטית — לא נוגעים בהשקעות ההוניות (Dow)');
  // Robinhood: הסכום (תוכנה שפותחה + רכוש קבוע) ‏83/57 ב־2021–2022; ‏PaymentsToAcquireProductiveAssets ‏63/28 = רק הרכוש הקבוע — לא "תיקון" של הרצף
  const HD = F.normalizeSec(facts([['Revenues', 'USD', yrs([9, 9, 9, 9, 9], 2021)], ['PaymentsToDevelopSoftware', 'USD', yrs([20, 29, 19, 37, 39], 2021)],
    ['PaymentsToAcquireOtherProductiveAssets', 'USD', yrs([63, 28, 2, 13, 15], 2021)], ['PaymentsToAcquireProductiveAssets', 'USD', yrs([63, 28], 2021)]]), [],
    cfX([['PaymentsToAcquireOtherProductiveAssets', 'Purchases of property, software, and equipment', -15], ['PaymentsToDevelopSoftware', 'Capitalization of internally developed software', -39]]));
  ok(HD.A.capex.join() === '83,57,21,50,54', 'השקעות הוניות: תגית שהיא אחד מחלקי הסכום לא מחליפה שנים שלו (Robinhood ‏2021–2022)');
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
  // בסיס אחד לתקופה (26/10/2026): הכנסות, עלות ורווח גולמי מאותה הגשה — זו שממנה ההכנסות
  {
    const Mx = (v) => v * 1e6, qq = (s, e, v, f, fm) => [s, e, Mx(v), fm || '10-Q', f];
    const base = (cogsQ3, gpQ3) => facts([
      ['Revenues', 'USD', [[...Y(2024), Mx(400), '10-K', '2025-02-01'], [...Y(2025), Mx(420), '10-K', '2026-02-01'],
        qq('2025-04-01', '2025-06-30', 100, '2025-08-01'), qq('2025-07-01', '2025-09-30', 105, '2025-11-01'), qq('2025-07-01', '2025-09-30', 50, '2026-11-01')]],
      ['CostOfGoodsAndServicesSold', 'USD', [[...Y(2024), Mx(250), '10-K', '2025-02-01'], [...Y(2025), Mx(260), '10-K', '2026-02-01'],
        qq('2025-04-01', '2025-06-30', 62, '2025-08-01'), ...cogsQ3]],
      ['GrossProfit', 'USD', [[...Y(2024), Mx(150), '10-K', '2025-02-01'], [...Y(2025), Mx(160), '10-K', '2026-02-01'],
        qq('2025-04-01', '2025-06-30', 38, '2025-08-01'), ...gpQ3]],
      ['NetIncomeLoss', 'USD', [[...Y(2024), Mx(50), '10-K', '2025-02-01'], [...Y(2025), Mx(55), '10-K', '2026-02-01']]],
    ]);
    const at = (d, k, e) => d.Q[k][d.q.indexOf(e)];
    // Honeywell: הרווח הגולמי רק מהבסיס הישן — ההפרש מההגשה של ההכנסות
    const h1 = F.normalizeSec(base([qq('2025-07-01', '2025-09-30', 65, '2025-11-01'), qq('2025-07-01', '2025-09-30', 32, '2026-11-01')],
      [qq('2025-07-01', '2025-09-30', 40, '2025-11-01')]), []);
    ok(at(h1, 'gp', '2025-09-30') === Mx(18) && at(h1, 'cogs', '2025-09-30') === Mx(32) && at(h1, 'gp', '2025-06-30') === Mx(38), 'בסיס אחד: רווח גולמי מהגשה ישנה → ההפרש מההגשה של ההכנסות');
    // J&J: עלות המכר רק מהבסיס הישן — ההפרש מההגשה של ההכנסות
    const h2 = F.normalizeSec(base([qq('2025-07-01', '2025-09-30', 65, '2025-11-01')],
      [qq('2025-07-01', '2025-09-30', 40, '2025-11-01'), qq('2025-07-01', '2025-09-30', 20, '2026-11-01')]), []);
    ok(at(h2, 'cogs', '2025-09-30') === Mx(30) && at(h2, 'gp', '2025-09-30') === Mx(20) && at(h2, 'rev', '2025-09-30') === Mx(50), 'בסיס אחד: עלות מכר מהגשה ישנה → ההפרש; ההכנסות לא משתנות');
    ok((h1.fixes || []).some((f) => f.m === 'gp' && f.p === '2025-09-30') && (h2.fixes || []).some((f) => f.m === 'cogs' && f.p === '2025-09-30'), 'בסיס אחד: התיקון נרשם (fix — מידע)');
  }
  // השקעה הונית שלא מוצגת בשורה נפרדת (5/11/2026, AppLovin): התזרים החופשי היה ריק מ־2024
  {
    const qs = (y) => [[y + '-01-01', y + '-03-31'], [y + '-04-01', y + '-06-30'], [y + '-07-01', y + '-09-30'], [y + '-10-01', y + '-12-31']];
    const per = (y, vals, form = '10-Q') => qs(y).slice(0, vals.length).map(([a, b], i) => [a, b, vals[i], i === 3 ? '10-K' : form, (+y + (i === 3 ? 1 : 0)) + '-' + ['05', '08', '11', '02'][i] + '-01']);
    const yr = (y, v) => [...Y(y), v, '10-K', (+y + 1) + '-02-20'];
    const mk = (oinv2026, cx2024 = 4) => facts([
      ['Revenues', 'USD', [2023, 2024, 2025].flatMap((y) => per(y, [100, 100, 100])).concat(per(2026, [100, 100, 100]), [yr(2023, 400), yr(2024, 400), yr(2025, 400)])],
      ['NetCashProvidedByUsedInOperatingActivities', 'USD', [2023, 2024, 2025].flatMap((y) => per(y, [50, 50, 50])).concat(per(2026, [50, 50, 50]), [yr(2023, 200), yr(2024, 200), yr(2025, 200)])],
      // רכוש קבוע: 2023 ברבעונים ובשנה, 2024 רק בדוח השנתי, 2025 — כלום
      ['PaymentsToAcquirePropertyPlantAndEquipment', 'USD', per(2023, [2, 2, 2]).concat([yr(2023, 8), yr(2024, cx2024)])],
      ['PaymentsForProceedsFromOtherInvestingActivities', 'USD', [2024, 2025].flatMap((y) => per(y, [1, 1, 1])).concat(per(2026, [1, 1, oinv2026]), [yr(2024, 4), yr(2025, 4)])],
    ]);
    const cfRow = (tag, label) => ({ ns: 'us-gaap', tag, label, v: [] });
    const face = (extra = []) => ({ cf: { rows: [cfRow('NetCashProvidedByUsedInOperatingActivities', 'Net cash provided by operating activities'), cfRow('PaymentsToAcquireIntangibleAssets', 'Purchase of intangible assets'),
      cfRow('PaymentsForProceedsFromOtherInvestingActivities', 'Other investing activities'), cfRow('NetCashProvidedByUsedInInvestingActivities', 'Net cash used in investing activities'), ...extra], cols: [], scale: { cur: 1, sh: 1 } } });
    const at = (d, P, e) => (P === 'A' ? d.A.capex[d.fy.indexOf(e)] : d.Q.capex[d.q.indexOf(e)]);
    const c1 = F.normalizeSec(mk(1), [], face());
    ok(at(c1, 'A', '2025-12-31') === 0 && at(c1, 'A', '2024-12-31') === 4 && at(c1, 'A', '2023-12-31') === 8, 'capex זניח: שנה בלי שורה = 0, שנה שדווחה נשארת');
    ok(at(c1, 'Q', '2024-03-31') === 0 && at(c1, 'Q', '2026-09-30') === 0 && at(c1, 'Q', '2023-06-30') === 2, 'capex זניח: רבעונים אחרי האחרון שדווח = 0, הישנים נשארים');
    ok(at(c1, 'Q', '2024-12-31') === 4 && c1.derived.capex.includes('2024-12-31'), 'capex זניח: רבעון רביעי של שנה שדווחה = השנה פחות שלושה רבעונים');
    const ch1 = F.validate(c1).filter((c) => c.k === 'cx0');
    ok(ch1.length > 0 && ch1.every((c) => c.m === 'capex') && !ch1.some((c) => c.p === '2024-12-31' && ch1.filter((x) => x.p === c.p).length > 1) && F.CHECK_INFO.has('cx0'), 'capex זניח: נרשם cx0 (מידע)');
    ok(!('oinv' in c1.A) && !('oinv' in c1.Q) && !c1.tags.oinv, 'capex זניח: "השקעות אחרות" לא נשלח למסך');
    // "השקעות אחרות" גדולות (מעל 5% מהתזרים מפעילות) — לא זניח, נשאר ריק
    const c2 = F.normalizeSec(mk(10), [], face());
    ok(at(c2, 'Q', '2026-09-30') == null && at(c2, 'Q', '2026-06-30') === 0, 'capex זניח: "השקעות אחרות" מעל 5% — ריק');
    // יש שורת השקעה הונית בדוח (גם בתגית פרטית) / אין דוח מודפס — לא נוגעים
    const c3 = F.normalizeSec(mk(1), [], face([{ ns: 'app', tag: 'PurchasesOfPpe', label: 'Purchases of property and equipment', v: [] }]));
    const c4 = F.normalizeSec(mk(1), [], null);
    ok(at(c3, 'Q', '2025-03-31') == null && at(c4, 'Q', '2025-03-31') == null && at(c4, 'A', '2025-12-31') == null, 'capex זניח: שורת השקעה הונית בדוח / בלי דוח — ריק');
    // ההשקעה ההונית האחרונה שדווחה לא זניחה (20% מהתזרים — Dominion, Cigna) — לא 0
    const c5 = F.normalizeSec(mk(1, 40), [], face());
    ok(at(c5, 'A', '2025-12-31') == null && at(c5, 'Q', '2025-03-31') == null, 'capex זניח: האחרונה שדווחה מעל 2% מהתזרים — ריק');
    // חור בסדרה: מדד שדווח ונעלם בארבעת הרבעונים האחרונים כשהבסיס ממשיך — "לבדוק"
    const hq = Array.from({ length: 12 }, (_, i) => '20' + (24 + Math.floor(i / 4)) + '-' + ['03-31', '06-30', '09-30', '12-31'][i % 4]);
    const hd = { q: hq, Q: { ocf: hq.map(() => 50), rev: hq.map(() => 100), capex: hq.map((_, i) => (i < 8 ? 2 : null)), sbc: hq.map((_, i) => (i < 9 ? 1 : null)) } };
    const hs = F.holes(hd);
    ok(hs.length === 1 && hs[0].k === 'hole' && hs[0].m === 'capex' && hs[0].p === hq[8] && !F.CHECK_INFO.has('hole'), 'חור בסדרה: ארבעה רבעונים אחרונים ריקים — hole (לא מידע); שלושה — לא');
    ok(F.holes(Object.assign({}, hd, { Q: Object.assign({}, hd.Q, { ocf: hq.map((_, i) => (i === 11 ? null : 50)) }) })).length === 0, 'חור בסדרה: בלי בסיס ברבעון — לא');
  }
  // מניה שלא נסחרת (EQR → VMRK, 26/10/2026): יום המסחר האחרון מהמטא, ומעל 3 שבועות — gone
  const pg = F.parseMonthly({ chart: { result: [{ meta: { currency: 'USD', regularMarketTime: Date.parse('2026-08-17T20:00:00Z') / 1000 }, timestamp: [], indicators: { quote: [{ close: [] }] } }] } });
  ok(pg.last === '2026-08-17', 'parseMonthly — יום המסחר האחרון');
  const now = Date.parse('2026-10-26');
  ok(F.goneSince('2026-08-17', now) === '2026-08-17' && F.goneSince('2026-10-23', now) === null && F.goneSince(null, now) === null, 'goneSince — רק מעל 3 שבועות (סופ״ש וחג — לא)');
  // רווח למניה מפעילות נמשכת (16/11/2026, בדיקת העומק): שורת ה־"Diluted" מתויגת IncomeLossFromContinuingOperationsPerDilutedShare.
  // 2019–2020 בתגית הרגילה; 2021 רק מפעילות נמשכת (אין פעילות שהופסקה); 2022 — נמשכת + שהופסקה מאותו דוח (אין שורת סך);
  // 2023 — נמשכת בלבד אבל הרווח כולל פעילות שהופסקה שהשורה שלה בדוח אחר — לא משלימים
  {
    const CO = facts([
      ['Revenues', 'USD', [2019, 2020, 2021, 2022, 2023].map((y) => [...Y(y), 1000, '10-K', (y + 1) + '-02-01'])],
      ['NetIncomeLoss', 'USD', [[...Y(2019), 200, '10-K', '2020-02-01'], [...Y(2020), 210, '10-K', '2021-02-01'], [...Y(2021), 300, '10-K', '2022-02-01'],
        [...Y(2022), 220, '10-K', '2023-02-01'], [...Y(2023), 250, '10-K', '2024-02-01']]],
      ['WeightedAverageNumberOfDilutedSharesOutstanding', 'shares', [2019, 2020, 2021, 2022, 2023].map((y) => [...Y(y), 100, '10-K', (y + 1) + '-02-01'])],
      ['EarningsPerShareDiluted', 'USD/shares', [[...Y(2019), 2.0, '10-K', '2020-02-01'], [...Y(2020), 2.1, '10-K', '2021-02-01']]],
      ['IncomeLossFromContinuingOperationsPerDilutedShare', 'USD/shares', [[...Y(2021), 3.0, '10-K', '2022-02-01'], [...Y(2022), 2.08, '10-K', '2023-02-01'], [...Y(2023), 2.0, '10-K', '2024-02-01']]],
      ['IncomeLossFromDiscontinuedOperationsNetOfTaxPerDilutedShare', 'USD/shares', [[...Y(2022), 0.12, '10-K', '2023-02-01'], [...Y(2023), 0.5, '10-K', '2023-02-01']]],
    ]);
    const dc = F.normalizeSec(CO, []), ec = (y) => dc.A.eps && dc.A.eps[dc.fy.indexOf(y + '-12-31')];
    ok(ec(2019) === 2.0 && ec(2020) === 2.1, 'EPS מפעילות נמשכת: השנים בתגית הרגילה — כמו שהן');
    ok(ec(2021) === 3.0, 'EPS מפעילות נמשכת: שנה בלי פעילות שהופסקה — מהשורה שבדוח (תואם לרווח/מניות)');
    ok(near(ec(2022), 2.2), 'EPS מפעילות נמשכת: נמשכת + שהופסקה מאותו דוח (2.08 + 0.12)');
    ok(ec(2023) == null, 'EPS מפעילות נמשכת: שורת הפעילות שהופסקה רק בדוח אחר — לא משלימים');
  }
  /* ---------- חוב כפי שמודפס במאזן (F7, 16/11/2026): השורות של המאזן האחרון, וההיסטוריה של כל שורה ---------- */
  {
    const inst = (end, val, form, filed) => [null, end, val, form, filed];
    // מיליונים (ההשוואה למאזן — בסובלנות של 1.5 מיליון או 0.5%)
    const K = (pairs) => pairs.map(([y, v]) => inst(y + '-12-31', v * 1e6, '10-K', (y + 1) + '-02-20'));
    const base = [['Revenues', 'USD', yrs([500, 510, 520, 530, 540, 550, 560], 2019)], ['NetIncomeLoss', 'USD', yrs([50, 51, 52, 53, 54, 55, 56], 2019)]];
    // מאזן מודפס: שורות [ns, tag, label, [2025, 2024], total] בין "סך נכסים" ל"סך התחייבויות והון" (ואחריו — after)
    const bs = (rows, after = []) => ({ bs: { title: 'Consolidated Balance Sheets', cols: [{ end: '2025-12-31' }, { end: '2024-12-31' }], scale: { cur: 1e6, sh: 1e6 },
      rows: [{ ns: 'us-gaap', tag: 'Assets', label: 'Total assets', total: true, v: [9e4, 8e4] },
        ...rows.map(([ns, tag, label, v, total]) => ({ ns, tag, label, v, total: !!total })),
        { ns: 'us-gaap', tag: 'LiabilitiesAndStockholdersEquity', label: 'Total liabilities and equity', total: true, v: [9e4, 8e4] },
        ...after.map(([ns, tag, label, v]) => ({ ns, tag, label, v }))] } });
    const debt = (d, y) => d.A.debt && d.A.debt[d.fy.indexOf(y + '-12-31')] / 1e6;
    const yrsv = (y0, a) => a.map((v, i) => [y0 + i, v]);
    // (1) Hershey: תגיות החוב שכוללות חכירה מימונית הן חוב (לא רק ההלוואות הקצרות); Coca-Cola: לפני המעבר לתגית של היום — מהחלופה
    const HS = facts([...base,
      ['ShortTermBorrowings', 'USD', K(yrsv(2019, [32, 74, 939, 694, 720, 1307, 219]))],
      ['LongTermDebtAndCapitalLeaseObligationsCurrent', 'USD', K(yrsv(2019, [703, 7, 506, 2, 401, 605, 503]))],
      ['LongTermDebtAndCapitalLeaseObligations', 'USD', K(yrsv(2022, [3343, 3089, 3190, 4681]))],
      ['LongTermDebtNoncurrent', 'USD', K(yrsv(2019, [3531, 4522, 4084]))]]);
    const hsF = bs([['us-gaap', 'ShortTermBorrowings', 'Short-term debt', [219, 1307]], ['us-gaap', 'AccountsPayableCurrent', 'Accounts payable', [900, 800]],
      ['us-gaap', 'LongTermDebtAndCapitalLeaseObligationsCurrent', 'Current portion of long-term debt', [503, 605]],
      ['us-gaap', 'LongTermDebtAndCapitalLeaseObligations', 'Long-term debt', [4681, 3190]]]);
    const df = F.debtFace(hsF, 'USD');
    ok(df.lines.map((l) => l.tag).join() === 'ShortTermBorrowings,LongTermDebtAndCapitalLeaseObligationsCurrent,LongTermDebtAndCapitalLeaseObligations' && df.tot.get('2025-12-31') === 5403e6,
      'חוב במאזן: שלוש שורות החוב (כולל התגיות "…AndCapitalLeaseObligations"), בלי ספקים');
    const hs = F.normalizeSec(HS, [], hsF);
    ok(debt(hs, 2025) === 5403 && debt(hs, 2024) === 5102 && debt(hs, 2022) === 694 + 2 + 3343, 'Hershey: חוב = הלוואות קצרות + חלויות + חוב לזמן ארוך — כמו במאזן');
    ok(debt(hs, 2020) === 74 + 7 + 4522 && hs.tags.debt === 'ShortTermBorrowings+LongTermDebtAndCapitalLeaseObligationsCurrent+LongTermDebtAndCapitalLeaseObligations',
      'Coca-Cola: השנים שלפני התגית של היום — מהחלופה מאותו סוג (LongTermDebtNoncurrent)');
    // (2) Microsoft: שורת ניירות ערך מסחריים שנעלמה מהמאזן (0 בעמודות של היום) — נכנסת להיסטוריה
    const MS = facts([...base,
      ['LongTermDebtCurrent', 'USD', K(yrsv(2019, [5516, 3749, 8072, 2749, 5247, 2249, 2999]))],
      ['LongTermDebtNoncurrent', 'USD', K(yrsv(2019, [66662, 59578, 50074, 47032, 41990, 42688, 40152]))],
      ['CommercialPaper', 'USD', K(yrsv(2019, [0, 0, 0, 0, 6693, 0, 0]))]]);
    const ms = F.normalizeSec(MS, [], bs([['us-gaap', 'LongTermDebtCurrent', 'Current portion of long-term debt', [2999, 2249]],
      ['us-gaap', 'LongTermDebtNoncurrent', 'Long-term debt', [40152, 42688]]]));
    ok(debt(ms, 2023) === 6693 + 5247 + 41990 && debt(ms, 2025) === 2999 + 40152 && debt(ms, 2021) === 8072 + 50074,
      'Microsoft: ניירות ערך מסחריים של 2023 בחוב, אף שאינם שורה במאזן של 2025');
    // (3) Xcel: ‏LongTermDebt בשורת "Long-term debt" של מאזן מסווג — בפועל החלק הלא שוטף; בשנים קודמות אותה תגית כוללת את
    //     החלויות (מהביאורים) — ההיסטוריה מהחלופה הלא שוטפת שתואמת למאזן
    const XE = facts([...base,
      ['LongTermDebtAndCapitalLeaseObligationsCurrent', 'USD', K(yrsv(2019, [702, 421, 601, 1151, 552, 1103, 501]))],
      ['ShortTermBorrowings', 'USD', K(yrsv(2019, [595, 584, 1005, 813, 785, 695, 1550]))],
      ['LongTermDebt', 'USD', K(yrsv(2019, [18109, 20066, 22380, 23964, 25465, 27316, 31832]))],
      ['LongTermDebtAndCapitalLeaseObligations', 'USD', K(yrsv(2019, [17407, 19645, 21779, 22813, 24913, 27316, 31832]))]]);
    const xe = F.normalizeSec(XE, [], bs([['us-gaap', 'LongTermDebtAndCapitalLeaseObligationsCurrent', 'Current portion of long-term debt', [501, 1103]],
      ['us-gaap', 'ShortTermBorrowings', 'Short-term debt', [1550, 695]], ['us-gaap', 'LongTermDebt', 'Long-term debt', [31832, 27316]]]));
    ok(debt(xe, 2020) === 421 + 584 + 19645 && debt(xe, 2025) === 501 + 1550 + 31832, 'Xcel: בלי לספור את החלויות פעמיים בשנים הקודמות (20,650, לא 21,071)');
    // (4) Con Edison: "LONG-TERM DEBT" מתויג LongTermDebtFairValue — חוב; "סך התחייבויות לא שוטפות" (…OtherThanLongtermDebt…) וסך ההון
    //     והחוב — לא חוב
    const edF = bs([['us-gaap', 'OtherLongTermDebtCurrent', 'Long-term debt due within one year', [250, 0]], ['us-gaap', 'NotesPayableCurrent', 'Notes payable', [1575, 2170]],
      ['us-gaap', 'LiabilitiesOtherThanLongtermDebtNoncurrent', 'TOTAL NONCURRENT LIABILITIES', [18248, 17516], true],
      ['us-gaap', 'LongTermDebtFairValue', 'LONG-TERM DEBT', [25551, 24651]], ['us-gaap', 'CapitalizationLongtermDebtAndEquity', 'Total capitalization', [49741, 46613], true]]);
    const de = F.debtFace(edF, 'USD');
    ok(de.lines.map((l) => l.tag).join() === 'OtherLongTermDebtCurrent,NotesPayableCurrent,LongTermDebtFairValue' && de.tot.get('2025-12-31') === 27376e6,
      'Con Edison: שורת החוב בתגית "שווי הוגן" נכנסת; "התחייבויות חוץ מחוב" וסך ההון והחוב — לא');
    // (5) AEP: שורת "סך הלוואות קצרות" במקום השורות שלפניה; Bank of America: אחרי "סך התחייבויות והון" (פירוט הישויות) — לא נספר
    const ae = F.debtFace(bs([['us-gaap', 'CommercialPaper', 'Commercial paper', [600, 500]], ['us-gaap', 'OtherShortTermBorrowings', 'Other short-term debt', [400, 400]],
      ['us-gaap', 'ShortTermBorrowings', 'Total short-term debt', [1000, 900], true], ['us-gaap', 'LongTermDebtNoncurrent', 'Long-term debt', [5000, 4000]]],
    [['us-gaap', 'LongTermDebtNoncurrent', 'Long-term debt', [777, 777]]]), 'USD');
    ok(ae.lines.map((l) => l.tag).join() === 'ShortTermBorrowings,LongTermDebtNoncurrent' && ae.tot.get('2025-12-31') === 6000e6, 'שורת סך של חוב במקום רכיביה, ובלי השורות שאחרי סך ההתחייבויות וההון');
    // (6) שורה בתגית של החברה, או ערך שלא תואם למאזן — השיטה הקודמת (לא חוב חלקי)
    const OL = facts([...base, ['LongTermDebtNoncurrent', 'USD', K(yrsv(2019, [10, 11, 12, 13, 14, 15, 16]))], ['ShortTermBorrowings', 'USD', K(yrsv(2019, [1, 1, 1, 1, 1, 2, 3]))]]);
    const ol1 = F.normalizeSec(OL, [], bs([['xyz', 'Borrowings', 'Short-term borrowings', [3, 2]], ['us-gaap', 'LongTermDebtNoncurrent', 'Long-term debt', [16, 15]]]));
    const ol2 = F.normalizeSec(OL, [], bs([['us-gaap', 'ShortTermBorrowings', 'Short-term borrowings', [3, 2]], ['us-gaap', 'LongTermDebtNoncurrent', 'Long-term debt', [99, 15]]]));
    ok(debt(ol1, 2025) === 19 && debt(ol2, 2025) === 19 && ol1.tags.debt !== 'Borrowings' && !/\+/.test(ol2.tags.debt || ''), 'שורה בתגית של החברה / ערך שלא תואם למאזן — השיטה הקודמת');
    // (7) McDonald's: חלויות שהיום בביאור (725 בעמודה של 2025, בתוך "Long-term debt") — לא נוספות למאזן של היום; ב־2020 היו שורה
    const MC = facts([...base, ['LongTermDebtNoncurrent', 'USD', K(yrsv(2019, [34118, 35197, 35623, 35904, 37153, 38424, 39973]))],
      ['LongTermDebtCurrent', 'USD', K([[2019, 59], [2020, 2244], [2025, 725]])], ['DebtCurrent', 'USD', K([[2022, 0], [2023, 2192], [2024, 0]])],
      ['ShortTermBorrowings', 'USD', K([[2023, 2192], [2024, 0]])], ['LongTermDebt', 'USD', K([[2019, 34177], [2020, 37441], [2025, 39973]])]]);
    const mc = F.normalizeSec(MC, [], bs([['us-gaap', 'LongTermDebtNoncurrent', 'Long-term debt', [39973, 38424]]]));
    ok(debt(mc, 2025) === 39973 && debt(mc, 2024) === 38424, "McDonald's: חלויות שבביאור היום — לא נוספות לשנים של המאזן");
    ok(debt(mc, 2023) === 37153 + 2192, "McDonald's: חוב שוטף כולל (DebtCurrent) — פעם אחת, לא יחד עם רכיביו (ShortTermBorrowings)");
    ok(debt(mc, 2020) === 35197 + 2244 && debt(mc, 2019) === 34118 + 59, "McDonald's: החלויות של 2019–2020 — בחוב, כי סך החוב לזמן ארוך באותה שנה (LongTermDebt) כולל אותן מעבר לשורה");
    // (8) Exelon: החוב לזמן ארוך מוצג רק בפירוט עם ממד ("צד לא קשור") — אין במאזן שנקרא שורה שיכולה להכיל אותו: נכנס בכל התאריכים
    const EX = facts([...base, ['ShortTermBorrowings', 'USD', K(yrsv(2019, [1370, 2031, 1248, 2586, 2523, 1859, 612]))],
      ['LongTermDebtAndCapitalLeaseObligationsCurrent', 'USD', K(yrsv(2019, [4710, 1819, 2153, 1802, 1403, 1453, 1665]))],
      ['LongTermDebtNoncurrent', 'USD', K(yrsv(2019, [31329, 35093, 30749, 35272, 39692, 42947, 47413]))]]);
    const ex = F.normalizeSec(EX, [], bs([['us-gaap', 'ShortTermBorrowings', 'Short-term borrowings', [612, 1859]],
      ['us-gaap', 'LongTermDebtAndCapitalLeaseObligationsCurrent', 'Long-term debt due within one year', [1665, 1453]]]));
    ok(debt(ex, 2025) === 612 + 1665 + 47413 && debt(ex, 2020) === 2031 + 1819 + 35093, 'Exelon: חוב לזמן ארוך שלא נקרא מהמאזן (פירוט עם ממד) — מהתגית, בכל השנים');
    // (9) Revvity: "Current portion of long-term debt" בתגית OtherLongTermDebtCurrent — חלויות: בשנים שבהן הן מתויגות גם
    //     LongTermDebtCurrent (בביאור) — פעם אחת
    const RV = facts([...base, ['OtherLongTermDebtCurrent', 'USD', K(yrsv(2019, [40, 41, 42, 43, 44, 45, 46]))], ['LongTermDebtCurrent', 'USD', K(yrsv(2019, [40, 41, 42]))],
      ['LongTermDebtNoncurrent', 'USD', K(yrsv(2019, [3000, 3100, 3200, 3300, 3400, 3500, 3600]))]]);
    const rv = F.normalizeSec(RV, [], bs([['us-gaap', 'OtherLongTermDebtCurrent', 'Current portion of long-term debt', [46, 45]], ['us-gaap', 'LongTermDebtNoncurrent', 'Long-term debt', [3600, 3500]]]));
    ok(debt(rv, 2020) === 41 + 3100 && debt(rv, 2025) === 46 + 3600, 'Revvity: חלויות בתגית OtherLongTermDebtCurrent — לא נספרות פעמיים');
    // (10) "Short-term borrowings and current portion of long-term debt" בתגית ShortTermBorrowings — חוב שוטף כולל: החלויות שבביאור לא נוספות
    const SB = facts([...base, ['ShortTermBorrowings', 'USD', K(yrsv(2019, [300, 310, 320, 330, 340, 350, 360]))], ['LongTermDebtCurrent', 'USD', K(yrsv(2019, [100, 110, 120]))],
      ['LongTermDebtNoncurrent', 'USD', K(yrsv(2019, [900, 910, 920, 930, 940, 950, 960]))]]);
    const sb = F.normalizeSec(SB, [], bs([['us-gaap', 'ShortTermBorrowings', 'Short-term borrowings and current portion of long-term debt', [360, 350]],
      ['us-gaap', 'LongTermDebtNoncurrent', 'Long-term debt', [960, 950]]]));
    ok(debt(sb, 2020) === 310 + 910, 'שורה אחת של הלוואות קצרות וחלויות — החלויות שבביאור לא נוספות עליה');
    // (11) מאזן לא מסווג עם "Long-term debt" (LongTermDebt): AIG — ההלוואות הקצרות בתוך השורה: סך החוב של החברה
    //      (DebtLongtermAndShorttermCombinedAmount) שווה לשורה — לא נוספות; Hartford — "Short-term debt" הייתה שורה נפרדת (נוספת)
    const AI = facts([...base, ['LongTermDebt', 'USD', K(yrsv(2019, [3500, 3600, 3700, 2718, 1060, 900, 950]))], ['ShortTermBorrowings', 'USD', K([[2022, 150], [2023, 25]])],
      ['DebtLongtermAndShorttermCombinedAmount', 'USD', K([[2022, 2718], [2023, 1060]])]]);
    const ai = F.normalizeSec(AI, [], bs([['us-gaap', 'LongTermDebt', 'Long-term debt', [950, 900]]]));
    ok(debt(ai, 2022) === 2718 && debt(ai, 2025) === 950, 'AIG: הלוואות קצרות שבתוך "Long-term debt" — לא נספרות פעמיים');
    const HG = facts([...base, ['LongTermDebt', 'USD', K(yrsv(2019, [4348, 4352, 4944, 4357, 4362, 4366, 4371]))], ['LongTermDebtNoncurrent', 'USD', K(yrsv(2019, [4348, 4352]))],
      ['ShortTermBorrowings', 'USD', K([[2019, 500], [2020, 0]])]]);
    const hg = F.normalizeSec(HG, [], bs([['us-gaap', 'LongTermDebt', 'Long-term debt', [4371, 4366]]]));
    ok(debt(hg, 2019) === 4348 + 500 && debt(hg, 2020) === 4352 && debt(hg, 2025) === 4371, 'Hartford: "Short-term debt" של 2019 (שורה שנעלמה) — בחוב');
    // (12) Palo Alto: במאזן רק אג"ח להמרה לא שוטפות — החלויות של אותו מכשיר (ConvertibleDebtCurrent) נכנסות בשנים שבהן היו
    const PA = facts([...base, ['ConvertibleDebtNoncurrent', 'USD', K(yrsv(2019, [1700, 1600, 0, 2000, 1900, 1800, 1700]))], ['ConvertibleDebtCurrent', 'USD', K([[2021, 3226], [2022, 0]])]]);
    const pa = F.normalizeSec(PA, [], bs([['us-gaap', 'ConvertibleDebtNoncurrent', 'Long-term convertible senior notes', [1700, 1800]]]));
    ok(debt(pa, 2021) === 3226 && debt(pa, 2020) === 1600 && debt(pa, 2025) === 1700, 'Palo Alto: החלויות של האג"ח להמרה (שורה שנעלמה) — בחוב');
    // (13) Con Edison: תגית "רכה" (LongTermDebtFairValue) — בשנים קודמות השווי ההוגן שבביאור: ההיסטוריה מהחלופה; וניירות ערך מסחריים
    //      (CommercialPaper) הם הפירוט של "Notes payable", לא ההיסטוריה של "Term loan"
    const ED = facts([...base, ['LongTermDebtFairValue', 'USD', K([[2019, 99999], [2020, 88888], [2024, 24651], [2025, 25551]])],
      ['LongTermDebtNoncurrent', 'USD', K(yrsv(2019, [18527, 20382, 22604, 22439, 21989, 24710]))], ['LongTermDebtCurrent', 'USD', K(yrsv(2019, [1446, 1967, 440, 1002, 251, 0, 250]))],
      ['NotesPayableCurrent', 'USD', K(yrsv(2019, [1692, 1705, 1488, 2640, 2288, 2170, 1575]))], ['CommercialPaper', 'USD', K(yrsv(2019, [1692, 1705, 1488, 2640, 2288, 2170]))],
      ['LoansPayableToBankCurrent', 'USD', K([[2024, 500], [2025, 500]])]]);
    const ed = F.normalizeSec(ED, [], bs([['us-gaap', 'LongTermDebtCurrent', 'Long-term debt due within one year', [250, 0]],
      ['us-gaap', 'LoansPayableToBankCurrent', 'Term loan', [500, 500]], ['us-gaap', 'NotesPayableCurrent', 'Notes payable', [1575, 2170]],
      ['us-gaap', 'LongTermDebtFairValue', 'LONG-TERM DEBT', [25551, 24651]]]));
    ok(debt(ed, 2025) === 250 + 500 + 1575 + 25551 && debt(ed, 2020) === 1967 + 1705 + 20382,
      'Con Edison: היסטוריית השורה בתגית "שווי הוגן" מהחלופה, וניירות הערך המסחריים לא נספרים פעמיים');
    // (14) Tyler: היום במאזן רק אג"ח להמרה; ב־2021 "Long-term debt" (LongTermDebtNoncurrent) כללה גם הלוואות — מחליפים כשסך החוב
    //      לזמן ארוך (LongTermDebt) מאשר
    const TY = facts([...base, ['ConvertibleDebtNoncurrent', 'USD', K(yrsv(2020, [0, 593, 594, 596, 598, 0]))], ['LongTermDebtNoncurrent', 'USD', K(yrsv(2021, [1311, 957, 596, 598]))],
      ['LoansPayableCurrent', 'USD', K(yrsv(2020, [0, 30, 30, 50, 0, 600]))], ['LongTermDebt', 'USD', K(yrsv(2021, [1341, 987, 646, 598, 600]))]]);
    const ty = F.normalizeSec(TY, [], bs([['us-gaap', 'LoansPayableCurrent', 'Current portion of convertible senior notes', [600, 0]],
      ['us-gaap', 'ConvertibleDebtNoncurrent', 'Convertible senior notes due 2026, net', [0, 598]]]));
    ok(debt(ty, 2021) === 1341 && debt(ty, 2022) === 987 && debt(ty, 2023) === 646 && debt(ty, 2025) === 600, 'Tyler: סך החוב הלא שוטף של 2021–2022 (הלוואות + אג"ח), לא רק האג"ח');
    // (15) Trimble: החלויות (LongTermDebtCurrent) מתויגות גם ShortTermBorrowings באותו סכום — פעם אחת
    const TR = facts([...base, ['LongTermDebtNoncurrent', 'USD', K(yrsv(2019, [1624, 1291, 1293, 1220, 2536, 1390, 1391]))],
      ['LongTermDebtCurrent', 'USD', K([[2019, 219], [2020, 256], [2022, 300]])], ['ShortTermBorrowings', 'USD', K([[2019, 219], [2020, 256], [2022, 300]])]]);
    const tr = F.normalizeSec(TR, [], bs([['us-gaap', 'LongTermDebtNoncurrent', 'Long-term debt', [1391, 1390]]]));
    ok(debt(tr, 2019) === 1624 + 219 && debt(tr, 2022) === 1220 + 300, 'Trimble: אותו סכום בשתי תגיות — נספר פעם אחת');
    // (16) Welltower: "Secured debt" ב־SecuredDebtOther מ־2024 — לפני כן מ־SecuredDebt (חלופה לפי המכשיר); "Unsecured credit facility" — לא
    //      סך החוב (LongTermDebt) כחלופה
    const WE = facts([...base, ['LineOfCredit', 'USD', K(yrsv(2019, [1588, 0, 0, 0, 0, 0, 0]))], ['UnsecuredDebt', 'USD', K(yrsv(2019, [10500, 11000, 11500, 12000, 12500, 13000, 13500]))],
      ['SecuredDebt', 'USD', K(yrsv(2019, [2676, 2500, 2400, 2300, 2200]))], ['SecuredDebtOther', 'USD', K([[2024, 2338], [2025, 2814]])],
      ['LongTermDebt', 'USD', K(yrsv(2019, [13200, 13500, 13900, 14300, 14700, 15338, 16314]))]]);
    const we = F.normalizeSec(WE, [], bs([['us-gaap', 'LineOfCredit', 'Unsecured credit facility and commercial paper', [0, 0]],
      ['us-gaap', 'UnsecuredDebt', 'Senior unsecured notes', [13500, 13000]], ['us-gaap', 'SecuredDebtOther', 'Secured debt', [2814, 2338]]]));
    ok(debt(we, 2019) === 1588 + 10500 + 2676 && debt(we, 2025) === 13500 + 2814, 'Welltower: היסטוריית "Secured debt" מ־SecuredDebt');
    // (17) Otis: "Short-term borrowings and current portion" (DebtCurrent) — בתגית שלה רק מ־2021; ב־2019–2020 רק החלויות (0, מהחלופה):
    //      ההלוואות הקצרות בתגית שלהן — כן; ב־2021 הן בתוך השורה — לא
    const OT = facts([...base, ['DebtCurrent', 'USD', K(yrsv(2021, [24, 670, 32, 1351, 1056]))], ['LongTermDebtCurrent', 'USD', K(yrsv(2019, [0, 0, 0]))],
      ['LongTermDebtNoncurrent', 'USD', K(yrsv(2019, [5, 5262, 7249, 6098, 6866, 6973, 7000]))],
      ['ShortTermBorrowings', 'USD', K(yrsv(2019, [34, 701, 24, 139, 32, 51, 500]))], ['CommercialPaper', 'USD', K([[2020, 664], [2021, 0]])]]);
    const ot = F.normalizeSec(OT, [], bs([['us-gaap', 'DebtCurrent', 'Short-term borrowings and current portion of long-term debt', [1056, 1351]],
      ['us-gaap', 'LongTermDebtNoncurrent', 'Long-term debt', [7000, 6973]]]));
    ok(debt(ot, 2019) === 34 + 5 && debt(ot, 2020) === 701 + 5262 && debt(ot, 2021) === 24 + 7249, 'Otis: ההלוואות הקצרות של 2019–2020 — רק כשלשורת החוב השוטף אין ערך בתגית שלה');
    // (18) KLA: מאזן מסווג ("Total current liabilities") ובו רק "Long-term debt" (LongTermDebt): בשנים הישנות התגית כוללת את החלויות — לא
    //      מוסיפים; כשהיא שווה ל־LongTermDebtNoncurrent — החלויות בשורה נפרדת: מוסיפים; הלוואות קצרות שכבר בתוך LongTermDebt — לא
    const KL = facts([...base, ['LongTermDebt', 'USD', K(yrsv(2019, [3423, 3461, 3424, 3700, 5143, 5880, 5884]))],
      ['LongTermDebtNoncurrent', 'USD', K([[2019, 3173], [2020, 3441], [2023, 5143], [2024, 5880]])],
      ['LongTermDebtCurrent', 'USD', K([[2019, 250], [2023, 750], [2025, 0]])], ['ShortTermBorrowings', 'USD', K([[2020, 20], [2021, 20]])]]);
    const kl = F.normalizeSec(KL, [], bs([['us-gaap', 'AccountsPayableCurrent', 'Accounts payable', [400, 380]], ['us-gaap', 'LiabilitiesCurrent', 'Total current liabilities', [3000, 2900], true],
      ['us-gaap', 'LongTermDebt', 'Long-term debt', [5884, 5880]]]));
    ok(debt(kl, 2019) === 3423 && debt(kl, 2020) === 3461 && debt(kl, 2021) === 3444 && debt(kl, 2023) === 5143 + 750 && debt(kl, 2025) === 5884,
      'KLA: ‏LongTermDebt כולל חלויות ב־2019, בלעדיהן ב־2023; ההלוואות הקצרות של 2020 כבר בפנים, של 2021 לא');
    // (19) Cardinal: ניירות ערך מסחריים בתוך "Current portion of long-term obligations and other short-term borrowings" — סך החוב של החברה
    //      (DebtAndCapitalLeaseObligations) כבר שווה לסכום: לא מוסיפים
    const CA = facts([...base, ['LongTermDebtAndCapitalLeaseObligationsCurrent', 'USD', K(yrsv(2019, [1327, 1000, 900, 800, 700, 600, 500]))],
      ['LongTermDebtAndCapitalLeaseObligations', 'USD', K(yrsv(2019, [9068, 9000, 8900, 8800, 8700, 8600, 8500]))], ['CommercialPaper', 'USD', K([[2019, 855], [2020, 0]])],
      ['DebtAndCapitalLeaseObligations', 'USD', K([[2019, 10395]])]]);
    const ca = F.normalizeSec(CA, [], bs([['us-gaap', 'LongTermDebtAndCapitalLeaseObligationsCurrent', 'Current portion of long-term obligations and other short-term borrowings', [500, 600]],
      ['us-gaap', 'LongTermDebtAndCapitalLeaseObligations', 'Long-term obligations, less current portion', [8500, 8600]]]));
    ok(debt(ca, 2019) === 10395, 'Cardinal: ניירות הערך המסחריים שבתוך שורת החלויות — לא נוספים כשסך החוב של החברה כבר שווה לסכום');
    // (20) McKesson: ‏DebtAndCapitalLeaseObligations = חוב לזמן ארוך כולל חלויות בלבד — לא ראיה שההלוואות הקצרות כבר בפנים
    const MK = facts([...base, ['LongTermDebtAndCapitalLeaseObligationsCurrent', 'USD', K(yrsv(2019, [777, 438, 404, 48, 1165, 1191, 1297]))],
      ['LongTermDebtAndCapitalLeaseObligations', 'USD', K(yrsv(2019, [6467, 5518, 5452, 5625, 4422, 4463, 4500]))],
      ['ShortTermBorrowings', 'USD', K([[2019, 152], [2020, 372]])], ['DebtAndCapitalLeaseObligations', 'USD', K([[2019, 7244], [2020, 5956]])]]);
    const mk = F.normalizeSec(MK, [], bs([['us-gaap', 'LongTermDebtAndCapitalLeaseObligationsCurrent', 'Current portion of long-term debt', [1297, 1191]],
      ['us-gaap', 'LongTermDebtAndCapitalLeaseObligations', 'Long-term debt', [4500, 4463]]]));
    ok(debt(mk, 2019) === 777 + 6467 + 152 && debt(mk, 2020) === 438 + 5518 + 372, 'McKesson: ההלוואות הקצרות נוספות גם כש־DebtAndCapitalLeaseObligations שווה לחוב לזמן ארוך');
    // (21) Nordson: "Current maturities of long-term debt and notes payable" — התווית לא ראיה שניירות הערך המסחריים בתוך השורה:
    //      ב־2021 השורה (10) קטנה מהם (192) — הם נוספים
    const ND = facts([...base, ['LongTermDebtCurrent', 'USD', K(yrsv(2019, [101, 95, 10, 336, 315, 54, 50]))],
      ['LongTermDebtNoncurrent', 'USD', K(yrsv(2019, [2085, 2119, 1529, 1786, 1681, 1943, 1836]))], ['CommercialPaper', 'USD', K([[2021, 192], [2024, 0]])]]);
    const nd = F.normalizeSec(ND, [], bs([['us-gaap', 'LongTermDebtCurrent', 'Current maturities of long-term debt and notes payable', [50, 54]],
      ['us-gaap', 'LongTermDebtNoncurrent', 'Long-term debt', [1836, 1943]]]));
    ok(debt(nd, 2021) === 10 + 1529 + 192 && debt(nd, 2022) === 336 + 1786, 'Nordson: ניירות ערך מסחריים נוספים גם כשתווית החלויות מזכירה "notes payable"');
    // (22) Invitation Homes: מאזן לא מסווג, ארבע שורות "סך" של מכשיר, ו־LongTermDebt שווה לסכומן ב־2024–2025. ב־2020–2023 היו גם אג"ח
    //      להמרה והלוואה בנקאית — שורות שנעלמו, שמשלימות בדיוק את הפער עד LongTermDebt: נכנסות (פעם אחת — NotesAndLoansPayable באותו סכום).
    //      ‏Welltower ‏2022: ‏SeniorNotes ‏545 הוא חלק מ־"Senior unsecured notes" ולא משלים את הפער — לא נכנס
    const IH = facts([...base, ['SecuredDebt', 'USD', K(yrsv(2020, [4820, 3056, 1646, 1627, 1386, 1384]))], ['SeniorNotes', 'USD', K(yrsv(2020, [0, 1922, 2518, 3305, 3801, 4399]))],
      ['UnsecuredDebt', 'USD', K(yrsv(2020, [2471, 2478, 3204, 3212, 2446, 2452]))], ['LineOfCredit', 'USD', K(yrsv(2020, [0, 0, 0, 0, 570, 145]))],
      ['ConvertibleDebt', 'USD', K([[2020, 339], [2021, 141], [2022, 0]])], ['LoansPayableToBank', 'USD', K(yrsv(2020, [401, 401, 401, 401]))],
      ['NotesAndLoansPayable', 'USD', K([[2020, 401]])], ['LongTermDebt', 'USD', K(yrsv(2020, [8032, 7999, 7769, 8546, 8203, 8380]))]]);
    const ih = F.normalizeSec(IH, [], bs([['us-gaap', 'SecuredDebt', 'Secured debt, net', [1384, 1386]], ['us-gaap', 'SeniorNotes', 'Unsecured notes, net', [4399, 3801]],
      ['us-gaap', 'UnsecuredDebt', 'Term loan facilities, net', [2452, 2446]], ['us-gaap', 'LineOfCredit', 'Revolving facility', [145, 570]]]));
    const WL = facts([...base, ['UnsecuredDebt', 'USD', K(yrsv(2022, [12437, 13552, 13162, 16384]))], ['SecuredDebtOther', 'USD', K([[2024, 2338], [2025, 2814]])],
      ['SecuredDebt', 'USD', K(yrsv(2022, [2111, 2183, 2338, 2814]))], ['LineOfCredit', 'USD', K(yrsv(2022, [0, 0, 0, 0]))], ['SeniorNotes', 'USD', K(yrsv(2022, [545, 546, 744, 745]))],
      ['LongTermDebt', 'USD', K(yrsv(2022, [14714, 15736, 15500, 19198]))]]);
    const wl = F.normalizeSec(WL, [], bs([['us-gaap', 'LineOfCredit', 'Unsecured credit facility and commercial paper', [0, 0]],
      ['us-gaap', 'UnsecuredDebt', 'Senior unsecured notes', [16384, 13162]], ['us-gaap', 'SecuredDebtOther', 'Secured debt', [2814, 2338]]]));
    ok(debt(ih, 2020) === 4820 + 2471 + 339 + 401 && debt(ih, 2022) === 1646 + 2518 + 3204 + 401 && debt(ih, 2024) === 8203 && debt(wl, 2022) === 12437 + 2111,
      'Invitation Homes: שורות שנעלמו נכנסות רק כשהן משלימות בדיוק את LongTermDebt; Welltower — לא');
    // (23) Veralto: חלויות + לא שוטף, ו־LongTermDebt שווה לסכום בעמודות של היום. ברבעון שאחרי הדוח השנתי לשורת החלויות אין ערך, והן
    //      ב־DebtCurrent (‏2,671 + 249 = 2,920): הסך — לפי LongTermDebt
    const q1 = (v) => ['2026-01-01', '2026-03-31', v * 1e6, '10-Q', '2026-05-01'], qi = (v) => [null, '2026-03-31', v * 1e6, '10-Q', '2026-05-01'];
    const VL = facts([['Revenues', 'USD', [...yrs([500, 510, 520, 530, 540, 550, 560], 2019), q1(140)]], ['NetIncomeLoss', 'USD', [...yrs([50, 51, 52, 53, 54, 55, 56], 2019), q1(14)]],
      ['LongTermDebtCurrent', 'USD', K([[2024, 700], [2025, 700]])], ['LongTermDebtNoncurrent', 'USD', [...K(yrsv(2019, [2650, 2660, 2670, 2672, 2672, 1972, 1973])), qi(2671)]],
      ['LongTermDebt', 'USD', [...K(yrsv(2019, [2650, 2660, 2670, 2672, 2672, 2672, 2673])), qi(2920)]], ['DebtCurrent', 'USD', [...K([[2025, 700]]), qi(249)]]]);
    const vl = F.normalizeSec(VL, [], bs([['us-gaap', 'LongTermDebtCurrent', 'Current portion of long-term debt', [700, 700]],
      ['us-gaap', 'LongTermDebtNoncurrent', 'Long-term debt', [1973, 1972]]]));
    const vq = vl.q.indexOf('2026-03-31');
    ok(vq >= 0 && vl.Q.debt[vq] / 1e6 === 2920 && debt(vl, 2025) === 2673 && debt(vl, 2022) === 2672, 'Veralto: ברבעון שאחרי הדוח השנתי — החלויות שבתגית אחרת, לפי LongTermDebt');
  }
  /* ---------- (24) המאזן המודפס של כל הגשה (17/11/2026, גל 2 — lib/bsfiled.js, ‏bsfDebt) ---------- */
  {
    const BSF = require(path.join(root, 'ibkr-proxy/lib/bsfiled.js'));
    const inst = (end, val, form, filed) => [null, end, val, form, filed];
    const K = (pairs) => pairs.map(([y, v]) => inst(y + '-12-31', v * 1e6, '10-K', (y + 1) + '-02-20'));
    const base = [['Revenues', 'USD', yrs([500, 510, 520, 530, 540, 550, 560], 2019)], ['NetIncomeLoss', 'USD', yrs([50, 51, 52, 53, 54, 55, 56], 2019)]];
    // מאזן של הגשה: עמודות [סוף, ...], שורות [tag, label, [ערכים]] בין סך הנכסים לסך ההתחייבויות וההון
    const sheet = (ends, rows, assets) => ({ cols: ends.map((end) => ({ end })), scale: { cur: 1e6, sh: 1e6 },
      rows: [{ ns: 'us-gaap', tag: 'Assets', label: 'Total assets', total: true, v: assets || ends.map(() => 9e4) },
        ...rows.map(([tag, label, v]) => ({ ns: 'us-gaap', tag, label, v, total: false })),
        { ns: 'us-gaap', tag: 'LiabilitiesAndStockholdersEquity', label: 'Total liabilities and equity', total: true, v: ends.map(() => 9e4) }] });
    const debt = (d, y) => d.A.debt && d.A.debt[d.fy.indexOf(y + '-12-31')] / 1e6;
    // החברה מתייגת היום רק חוב לזמן ארוך; ב־2021–2022 המאזן הדפיס גם "Notes payable" (הלוואות קצרות) שנעלמו — F7 מחזיר רק את החוב הארוך
    const MC = facts([...base, ['LongTermDebtNoncurrent', 'USD', K([[2019, 900], [2020, 950], [2021, 1000], [2022, 1100], [2023, 1150], [2024, 1200], [2025, 1250]])]]);
    const face = { bs: sheet(['2025-12-31', '2024-12-31'], [['LongTermDebtNoncurrent', 'Long-term debt', [1250, 1200]]]) };
    const have = {
      a22: { form: '10-K', filed: '2023-02-20', bs: sheet(['2022-12-31', '2021-12-31'], [['NotesPayableCurrent', 'Notes payable', [223, 150]], ['LongTermDebtNoncurrent', 'Long-term debt', [1100, 1000]]]) },
      // אותו תאריך בדוח רבעוני מאוחר — הדוח השנתי גובר (גם כשהרבעוני הוגש אחריו)
      q23: { form: '10-Q', filed: '2023-05-01', bs: sheet(['2023-03-31', '2022-12-31'], [['NotesPayableCurrent', 'Notes payable', [10, 999]], ['LongTermDebtNoncurrent', 'Long-term debt', [1120, 1100]]]) },
      // עמודה בלי סך נכסים (ביאור) — לא מאזן
      a23: { form: '10-K', filed: '2024-02-20', bs: sheet(['2023-12-31', '2022-12-31'], [['LongTermDebtNoncurrent', 'Long-term debt', [1150, 5]]], [9e4, null]) },
      // הגשה בלי שורות חוב במאזן — לא "0": הכלל של F7 נשאר
      a20: { form: '10-K', filed: '2021-02-20', bs: sheet(['2020-12-31', '2019-12-31'], [['AccountsPayableCurrent', 'Accounts payable', [40, 30]]]) },
      // עמודות ריקות (אפס בכל שורה, גם בסך הנכסים) — Albemarle ‏10-Q ‏2015
      z15: { form: '10-Q', filed: '2015-05-11', bs: sheet(['2015-03-31', '2014-03-31'], [['LongTermDebtNoncurrent', 'Long-term debt', [5, 0]]], [9e4, 0]) },
      bad: { form: '10-Q', filed: '2021-05-01', err: 'nobs' },
    };
    const m0 = F.normalizeSec(MC, [], face), m1 = F.normalizeSec(MC, [], face, have);
    ok(debt(m0, 2022) === 1100 && debt(m1, 2022) === 1323 && debt(m1, 2021) === 1150, '(24) המאזן של ההגשה: שורה שנעלמה ממאזן היום נספרת (‏1,100 + 223)');
    ok(debt(m1, 2023) === 1150 && debt(m1, 2020) === 950 && debt(m1, 2025) === 1250 && m1.bsfN >= 3, '(24) ביאור בלי סך נכסים לא דורס; הגשה בלי שורות חוב — הכלל של F7');
    const M = F.bsfDebt(have, 'USD');
    ok(M.get('2022-12-31').form === '10-K' && M.get('2022-12-31').v === 1323e6 && !M.has('2020-12-31') && M.get('2023-03-31').v === 1130e6 && !M.has('2014-03-31'), '(24) bsfDebt: השנתי גובר על רבעוני מאוחר באותו תאריך');
    // פחת: התגית שבתזרים לפני התגית שבדוח רווח והפסד (McDonald's: ‏DepreciationAndAmortization בתזרים ‏$2.2B,
    // ‏DepreciationDepletionAndAmortization שורה של "הוצאות אחרות" ‏$457M — עד גל 2 הפחת יצא ‏$457M; ‏F13)
    {
      const MD = facts([...base, ['DepreciationDepletionAndAmortization', 'USD', yrs([30, 31, 32, 33, 34, 35, 36], 2019)], ['DepreciationAndAmortization', 'USD', yrs([200, 210, 220, 230, 240, 250, 260], 2019)]]);
      const row = (tag) => ({ ns: 'us-gaap', tag, label: 'x', v: [1] });
      const fc = { cf: { cols: [{ end: '2025-12-31' }], scale: { cur: 1e6 }, rows: [row('DepreciationAndAmortization')] }, is: { cols: [{ end: '2025-12-31' }], scale: { cur: 1e6 }, rows: [row('DepreciationDepletionAndAmortization')] } };
      const d1 = F.normalizeSec(MD, [], fc), d0 = F.normalizeSec(MD, [], null);
      ok(d1.tags.dep === 'DepreciationAndAmortization' && d1.A.dep[d1.fy.indexOf('2025-12-31')] === 260 && d0.tags.dep === 'DepreciationDepletionAndAmortization', '(24) פחת: השורה בתזרים לפני השורה ברווח והפסד');
    }
    // גל 2, ‏F14: מו״פ בתגית "בלי מו״פ שנרכש" (AbbVie, ‏Amgen) ודיבידנד ב־PaymentsOfOrdinaryDividends (Accenture) — עד אז חסרים במסך
    {
      const MR = facts([...base, ['ResearchAndDevelopmentExpenseExcludingAcquiredInProcessCost', 'USD', yrs([50, 51, 52, 53, 54, 55, 56], 2019)], ['PaymentsOfOrdinaryDividends', 'USD', yrs([7, 8, 9, 10, 11, 12, 13], 2019)]]);
      const r = F.normalizeSec(MR, [], null), i = r.fy.indexOf('2025-12-31');
      ok(r.A.rnd && r.A.rnd[i] === 56 && r.A.divp && r.A.divp[i] === 13, '(24) מו״פ ודיבידנד בתגיות החלופיות (F14)');
    }
    // חוב שלילי (Hartford ‏10-K ‏2016: שגיאת סימן בהגשה) — העמודה לא נספרת, הרבעוני נשאר
    const neg = { q: { form: '10-Q', filed: '2016-04-28', bs: sheet(['2016-03-31', '2015-12-31'], [['LongTermDebtNoncurrent', 'Long-term debt', [5000, 5084]]]) },
      k: { form: '10-K', filed: '2016-02-26', bs: sheet(['2015-12-31', '2014-12-31'], [['ShortTermBorrowings', 'Short-term debt', [275, 456]], ['LongTermDebtNoncurrent', 'Long-term debt', [-5084, -5653]]]) } };
    const MN = F.bsfDebt(neg, 'USD');
    ok(MN.get('2015-12-31').v === 5084e6 && MN.get('2015-12-31').form === '10-Q' && !MN.has('2014-12-31'), '(24) bsfDebt: שורת חוב שלילית — העמודה לא נספרת');
    // "Notes Payable to Eversource Parent" במאזן המאוחד (ES ‏10-Q ‏2018) — לא חוב של הקבוצה
    const par = F.bsfDebt({ q: { form: '10-Q', filed: '2018-05-03', bs: sheet(['2018-03-31', '2017-12-31'], [['NotesPayable', 'Notes Payable', [1049, 1088]], ['NotesPayableRelatedPartiesClassifiedCurrent', 'Notes Payable to Eversource Parent', [276, 116]], ['LongTermDebtNoncurrent', 'Long-Term Debt', [12016, 11776]]]) } }, 'USD');
    ok(par.get('2018-03-31').v === 13065e6, '(24) "Notes payable to … Parent" — לא נספר');
    // גל 2, ‏F12 — ארבעה שורשים מהלפני/אחרי על כל היקום:
    const bd = (rows, cols) => F.bsfDebt({ k: { form: '10-K', filed: '2024-02-20', bs: sheet(cols || ['2023-12-31', '2022-12-31'], rows) } }, 'USD').get((cols || ['2023-12-31'])[0]);
    // Prologis: אותה שורה פעמיים (שני רושמים) — פעם אחת
    ok(bd([['LongTermDebt', 'Debt', [17715, 16000]], ['LongTermDebt', 'Debt', [17715, 16000]]]).v === 17715e6, '(24) שורת חוב כפולה — נספרת פעם אחת');
    // ICE: סכום־ביניים בלי "Total" (‏2,645 + 4,271 = ‏6,916)
    ok(bd([['LongTermDebtCurrent', 'Short-term debt', [2645, 100]], ['LongTermDebtNoncurrent', 'Long-term debt', [4271, 4000]], ['LongTermDebt', 'Long-term debt', [6916, 4100]]]).v === 6916e6, '(24) סכום־ביניים בלי "Total" — לא נספר שוב');
    // Invesco: "Debt and other liabilities of CIP" — של הקרנות המאוחדות, לא של החברה
    ok(bd([['LongTermDebt', 'Long-term debt', [1500, 1500]], ['DebtAndOtherLiabilitiesOfVariableInterestEntities', 'Debt and other liabilities of CIP', [6000, 5000]]]).v === 1500e6, '(24) "liabilities of" — לא חוב של החברה');
    // Vulcan: "Total short-term debt" ‏0 אחרי חלויות ‏400 — הוא לא הסך שלהן
    ok(bd([['LongTermDebtCurrent', 'Current maturities of long-term debt', [400, 0.5]], ['ShortTermBorrowings', 'Total short-term debt', [0, 550]], ['LongTermDebtNoncurrent', 'Long-term debt', [3964, 4359]]]).v === 4364e6, '(24) "Total" קטן מהשורות שלפניו — לא מחליף אותן');
    // Seagate ‏10-Q ‏2020: "Less: current portion of debt" אחרי סך ההתחייבויות וההון — נספר רק כשהוא משלים את סך ההתחייבויות השוטפות
    {
      const st = (lcTot) => { const b = sheet(['2020-10-02', '2020-07-03'], [['AccountsPayableCurrent', 'Accounts payable', [1795, 1808]], ['AccruedLiabilitiesCurrent', 'Accrued expenses', [603, 602]],
        ['LiabilitiesCurrent', 'Total current liabilities', lcTot], ['LongTermDebtNoncurrent', 'Long-term debt', [4138, 4156]]]);
        b.rows.find((r) => r.tag === 'LiabilitiesCurrent').total = true;
        b.rows.push({ ns: 'us-gaap', tag: 'LongTermDebtCurrent', label: 'Less: current portion of debt', v: [25, 19] });
        return F.bsfDebt({ q: { form: '10-Q', filed: '2020-10-29', bs: b } }, 'USD').get('2020-10-02').v / 1e6; };
      ok(st([2423, 2429]) === 4163 && st([2398, 2410]) === 4138, '(24) חלויות שוטפות אחרי סך המאזן — רק כשהן משלימות את סך ההתחייבויות השוטפות');
    }
    // FilingSummary: המאזן המאוחד סומן "Uncategorized" לפני הדוח הראשון ב־Statements (Eversource ‏10-K ‏2022) — הוא המאזן, לא של חברת־הבת
    const rep = (f, n, c) => `<Report><HtmlFileName>${f}</HtmlFileName><ShortName>${n}</ShortName><MenuCategory>${c}</MenuCategory></Report>`;
    const UNC = '<FilingSummary><MyReports>' + rep('R2.htm', 'Audit Information', 'Notes') + rep('R3.htm', 'CONSOLIDATED BALANCE SHEETS', 'Uncategorized')
      + rep('R5.htm', 'CONSOLIDATED STATEMENTS OF INCOME', 'Statements') + rep('R10.htm', 'SUBSIDIARY BALANCE SHEETS', 'Statements')
      + rep('R90.htm', 'Balance Sheet Details', 'Uncategorized') + '</MyReports></FilingSummary>';
    ok(SF.pickStatements(UNC).bs === 'R3.htm' && SF.pickStatements(UNC.replace('R3.htm', 'R3x.htm').replace('CONSOLIDATED BALANCE SHEETS', 'Other')).bs === 'R10.htm', '(24) FilingSummary: מאזן "Uncategorized" לפני הדוחות — נבחר; אחריהם — לא');
    // pickStatements: FilingSummary ישן בלי MenuCategory (McDonald's ‏10-Q ‏2014) — הסוג מתוך LongName
    const OLDFS = '<FilingSummary><MyReports><Report><HtmlFileName>R1.htm</HtmlFileName><LongName>0001000 - Document - Document and Entity Information</LongName><ShortName>Document and Entity Information</ShortName></Report>'
      + '<Report><HtmlFileName>R2.htm</HtmlFileName><LongName>1001000 - Statement - Condensed Consolidated Balance Sheet</LongName><ShortName>Condensed Consolidated Balance Sheet</ShortName></Report>'
      + '<Report><HtmlFileName>R9.htm</HtmlFileName><LongName>2001000 - Disclosure - Balance Sheet Details</LongName><ShortName>Balance Sheet Details</ShortName></Report></MyReports></FilingSummary>';
    ok(SF.pickStatements(OLDFS).bs === 'R2.htm' && !SF.pickStatements(OLDFS.replace('1001000 - Statement', '1001000 - Disclosure')).bs, '(24) FilingSummary ישן: המאזן לפי LongName');
    // slim: רק מסך הנכסים ועד סך ההתחייבויות וההון
    const sl = BSF.slim({ cols: [{ end: '2025-12-31' }], scale: { cur: 1 }, rows: [{ tag: 'Cash', v: [1] }, { tag: 'Assets', v: [9] }, { tag: 'NotesPayableCurrent', v: [2] }, { tag: 'LiabilitiesAndStockholdersEquity', v: [9] }, { tag: 'X', v: [1] }] });
    ok(sl.rows.map((r) => r.tag).join() === 'Assets,NotesPayableCurrent,LiabilitiesAndStockholdersEquity', '(24) slim: צד ההתחייבויות בלבד');
    // periodic: בלי ‎/A‎, רק מ־SINCE_Y שנים, החדשה ראשונה, גם מדפי ההמשך
    const SUB = { filings: { recent: { form: ['8-K', '10-Q', '10-K/A', '10-K', '10-Q'], accessionNumber: ['a', 'b', 'c', 'd', 'e'], filingDate: ['2026-05-01', '2026-04-30', '2026-03-01', '2026-02-20', '2001-05-01'] } } };
    const pl = BSF.periodic(SUB, [{ form: ['10-Q'], accessionNumber: ['f'], filingDate: ['2025-10-30'] }], 13, Date.parse('2026-11-17'));
    ok(pl.map((x) => x.acc).join() === 'b,d,f', '(24) periodic: 10-K/10-Q בלבד, בלי תיקונים וישנות, מהחדשה');
    // load: מחסן בזיכרון ו־getText מדומה — עד 4 חדשות שחסרות; 404 נשמר כתקלה, תקלת רשת — לא (תנוסה שוב)
    const store = new Map(), calls = [];
    const R = '<table><tr><th class="tl"><div><strong>Balance Sheets - USD ($)<br> $ in Millions</strong></div></th><th class="th">Dec. 31, 2025</th></tr>'
      + '<tr class="re"><td class="pl"><a onclick="x(\'defref_us-gaap_Assets\')">Total assets</a></td><td class="nump">900</td></tr>'
      + '<tr class="ro"><td class="pl"><a onclick="x(\'defref_us-gaap_LongTermDebtNoncurrent\')">Long-term debt</a></td><td class="nump">100</td></tr></table>';
    const FSX = '<FilingSummary><MyReports><Report><MenuCategory>Statements</MenuCategory><HtmlFileName>R2.htm</HtmlFileName><ShortName>Balance Sheets</ShortName></Report></MyReports></FilingSummary>';
    const getText = async (u) => { calls.push(u); if (/\/(e|f)\//.test(u)) throw new Error('http_404'); if (/\/g\//.test(u)) throw new Error('http_503'); return /FilingSummary/.test(u) ? FSX : R; };
    const SUB2 = { filings: { recent: { form: ['10-Q', '10-Q', '10-Q', '10-K', '10-Q', '10-Q'], accessionNumber: ['g', 'b', 'd', 'e', 'f', 'h'], filingDate: ['2026-10-30', '2026-07-30', '2026-04-30', '2026-02-20', '2025-10-30', '2025-07-30'] } } };
    const deps = { getText, store: { get: (k) => store.get(k), put: (k, o) => store.set(k, o) }, now: Date.parse('2026-11-17') };
    const f1 = (await BSF.load('123', SUB2, deps)).f;
    const saved = store.get(BSF.key('123'));
    ok(f1 && f1.b && f1.b.bs && f1.d && f1.e.err === 'nofs' && !f1.f && !f1.g && !f1.h && saved && saved.v === BSF.V, '(24) load: עד 4 הגשות, 404 נשמר, תקלת רשת לא, נכתב למחסן');
    const n0 = calls.length; const f2 = (await BSF.load('123', SUB2, deps)).f;
    ok(f2.h && f2.f.err === 'nofs' && !f2.g && f2.b && calls.length - n0 <= 6 && !calls.slice(n0).some((u) => /\/b\//.test(u)), '(24) load שני: רק מה שעוד חסר');
    ok(F.bsfDebt(f2, 'USD').get('2025-12-31').v === 100e6, '(24) מהדף שנקרא — החוב של העמודה');
    ok((await BSF.load('9', SUB2, { ...deps, getText: async () => { throw new Error('boom'); } })) === null, '(24) הכל נכשל — null (החוב בכלל של F7)');
    // tick (עבודת הרקע): עובר על הרשימה מהמקום שבו עצר, חברה טרייה (at < 20 שעות) — מדלג, תקרת זמן = עוצר באמצע וממשיך משם
    {
      const st2 = new Map(), urls = [];
      const SUBT = (n) => JSON.stringify({ filings: { recent: { form: Array(n).fill('10-Q'), accessionNumber: Array.from({ length: n }, (_, i) => 'x' + i), filingDate: Array.from({ length: n }, (_, i) => '2026-0' + (1 + (i % 9)) + '-01') }, files: [] } });
      const gt = async (u) => { urls.push(u); return /submissions/.test(u) ? SUBT(3) : /FilingSummary/.test(u) ? FSX : R; };
      const td = { getText: gt, cikMap: async () => new Map([['AAA', '1'], ['BBB', '2'], ['CCC', '3']]), syms: ['AAA', 'BBB', 'CCC'], gap: 0, now: Date.parse('2026-11-17'),
        store: { get: (k) => st2.get(k), put: (k, o) => st2.set(k, o) } };
      const t1 = await BSF.tick(td);
      ok(t1.ok && t1.done === 3 && t1.added === 9 && st2.get(BSF.key('2')).at && Object.keys(st2.get(BSF.key('3')).f).length === 3, '(24) tick: כל החברות, כל ההגשות, at נרשם');
      const n1 = urls.length, t2 = await BSF.tick(td);
      ok(t2.done === 0 && urls.length === n1, '(24) tick שני באותו יום — אין בקשות (הכל טרי)');
      const st3 = new Map(), t3 = await BSF.tick({ ...td, store: { get: (k) => st3.get(k), put: (k, o) => st3.set(k, o) }, budgetMs: 1, getText: async (u) => { await new Promise((r) => setTimeout(r, 3)); return gt(u); } });
      const o3 = st3.get(BSF.key('1'));
      ok(t3.i === 0 && (!o3 || !o3.at), '(24) tick בתקרת זמן: החברה לא מסומנת כגמורה, והסבב הבא מתחיל ממנה');
      // תקלה קבועה בחברה אחת (קובץ שנכשל בכל ניסיון) — לא עוצרת את הסבב: הבאות נקראות, והיא לא מסומנת כגמורה (גל 5)
      const st4 = new Map(), t4 = await BSF.tick({ ...td, store: { get: (k) => st4.get(k), put: (k, o) => st4.set(k, o) },
        getText: async (u) => { if (/\/1\/x1\//.test(u)) throw new Error('http_503'); return gt(u); } });
      ok(t4.done === 3 && t4.failed === 1 && !st4.get(BSF.key('1')).at && st4.get(BSF.key('3')).at, '(24) tick: תקלה קבועה בחברה אחת — ממשיכים לבאות');
    }
  }

  /* ---------- (25) הרבעון הרביעי מההודעה לעיתונות (17/11/2026, גל 2 — F2; lib/secpr.js, ‏q4Press) ---------- */
  {
    const PR = require(path.join(root, 'ibkr-proxy/lib/secpr.js'));
    const BSF = require(path.join(root, 'ibkr-proxy/lib/bsfiled.js'));
    // ההודעה של Apple לרבעון 4 של 2024 (מבנה אמיתי מקוצר: עמודות "$" נפרדות, שתי שורות "Diluted", וטבלת התאמה עם רווח מתואם)
    const td = (c) => '<td style="x">' + c + '</td>';
    const H = '<table><tr>' + td('') + td('Three Months Ended') + td('Twelve Months Ended') + '</tr>'
      + '<tr>' + td('Net income') + td('$') + td('14,736') + td('$') + td('22,956') + td('$') + td('93,736') + td('$') + td('96,995') + '</tr>'
      + '<tr>' + td('Earnings per share:') + '</tr>'
      + '<tr>' + td('Diluted') + td('$') + td('0.97') + td('$') + td('1.46') + td('$') + td('6.08') + td('$') + td('6.13') + '</tr>'
      + '<tr>' + td('Shares used in computing earnings per share:') + '</tr>'
      + '<tr>' + td('Diluted') + td('15,242,853') + td('15,672,400') + td('15,408,095') + td('15,812,547') + '</tr></table>'
      + '<table><tr>' + td('Diluted earnings per share') + td('$') + td('0.97') + td('$') + td('0.67') + td('$') + td('1.64') + '</tr>'
      + '<tr>' + td('Shares used in computing diluted earnings per share') + td('15,242,853') + td('&#8212;') + td('15,242,853') + '</tr></table>';
    const rows = PR.parse(H);
    ok(rows.length === 4 && rows[0].v.join() === '0.97,1.46,6.08,6.13' && rows[1].v[0] === 15242853 && rows[3].v[1] === null, '(25) parse: שורות "Diluted" בלבד, "$" נשמט, "—" שומר מקום');
    const m = PR.q4From(rows, 14736e6, 15.25e9);
    ok(m && m.eps === 0.97 && m.sh === 15242853e3 && m.col === 0, '(25) q4From: העמודה שמכפלתה = הרווח של הרבעון (באלפים → מניות), לא הרווח המתואם 1.64');
    ok(PR.q4From(rows, 20e9, 15.25e9) === null, '(25) מכפלה שלא מתאימה לרווח שלנו (בסיס אחר — MSFT ‏2017 אחרי הצגה מחדש) — לא נוגעים');
    ok(PR.q4From(rows, 14736e6, 13e9) === null, '(25) מניות רחוקות מההערכה (מעל 10%) בלי אימות של השנה — לא נוגעים');
    ok(PR.q4From(rows, 14736e6, 13e9, [], { sh: 15408095e3, ni: [93736e6] }).sh === 15242853e3, '(25) עמודת השנה מאמתת את הטבלה — עד 25% מההערכה (TransDigm)');
    // פיצול אחרי ההודעה: ההודעה של 2019 (לפני 4:1), אצלנו מותאם
    const pre = [{ t: 0, label: 'Diluted', v: [3.03] }, { t: 0, label: 'Diluted', v: [4648913] }];
    const mp = PR.q4From(pre, 3.03 * 4648913e3, 4 * 4648913e3, [4]);
    ok(mp && mp.sh === 4 * 4648913e3 && Math.abs(mp.eps - 0.7575) < 1e-9, '(25) פיצול 4:1 אחרי ההודעה — מניות × 4, רווח למניה ÷ 4');
    // עמודת "שינוי ב־%" עם n/m — אורך שונה בשתי השורות (Southwest), שורת מניות במיליונים עם עשרוני (P&G)
    ok(PR.q4From([{ t: 1, label: 'Diluted', v: [0.42, -0.42, 0.76, 0.76, null] }, { t: 1, label: 'Diluted', v: [641, 596, 7.6, 643, 640, 0.5] }], 269e6, 599e6).sh === 641e6, '(25) אורך שורות שונה — העמודה הראשונה, המכפלה מאמתת');
    ok(PR.isShares({ label: 'Diluted Weighted Average Common Shares Outstanding', v: [2472.2] }) && !PR.isShares({ label: 'Diluted EPS', v: [1.27] }), '(25) isShares: מניות במיליונים עם עשרוני — לפי התווית');
    // pickItems: ה־8-K של התוצאות אחרי סוף השנה (עד 100 יום), כמה מועמדים לפי הסדר
    const sub = { filings: { recent: { form: ['8-K', '8-K', '8-K', '10-K'], items: ['2.02,9.01', '2.02,9.01', '5.02', ''], accessionNumber: ['b', 'a', 'c', 'k'], filingDate: ['2025-01-28', '2025-01-10', '2025-01-05', '2025-02-01'], primaryDocument: ['b.htm', 'a.htm', 'c.htm', 'k.htm'] } } };
    const it = PR.pickItems(sub, ['2024-12-31', '2023-12-31']);
    ok(it.length === 1 && it[0].end === '2024-12-31' && it[0].cands.map((x) => x.acc).join() === 'a,b', '(25) pickItems: רק Item 2.02, אחרי סוף השנה, המוקדם קודם');
    ok(PR.exhibits({ directory: { item: [{ name: 'k8.htm', size: 9 }, { name: 'ex992.htm', size: 900 }, { name: 'ex991.htm', size: 100 }, { name: 'R1.htm', size: 5 }, { name: 'x.jpg' }] } }, 'k8.htm').join() === 'ex991.htm,ex992.htm', '(25) exhibits: ‏EX-99.1 קודם, בלי המסמך הראשי ודפי R');
    // readPr: 8-K ראשון בלי הודעה (נתוני תנועה) → השני; ‏EX-99.1 בלי מניות → גם EX-99.2 (UPS)
    const RNOS = '<table><tr><td>Diluted Earnings Per Share</td><td>3.52</td><td>3.59</td></tr></table>';
    const RFULL = '<table><tr><td>Diluted earnings per share</td><td>3.52</td></tr><tr><td>Denominator for diluted</td><td>879</td></tr></table>';
    const gtp = async (u) => /\/a\/index/.test(u) ? JSON.stringify({ directory: { item: [{ name: 'traffic.htm', size: 5 }] } })
      : /\/b\/index/.test(u) ? JSON.stringify({ directory: { item: [{ name: 'ex991.htm', size: 5 }, { name: 'ex992.htm', size: 9 }] } })
        : /traffic/.test(u) ? '<p>traffic</p>' : /ex991/.test(u) ? RNOS : RFULL;
    const rp = await BSF.readPr('1', it[0], gtp);
    ok(rp && rp.acc === 'b' && rp.file === 'ex991.htm ex992.htm' && rp.rows.length === 3 && rp.rows[2].t >= 1000, '(25) readPr: המועמד הבא כשאין הודעה; קובץ נוסף עד שורת מניות');
    ok((await BSF.readPr('1', it[0], async () => { throw new Error('http_503'); })) === null, '(25) readPr: תקלת רשת — null (ינוסה שוב, לא נשמר)');
    // q4Press: הרבעון הרביעי המוערך מקבל את המניות ואת הרווח למניה מההודעה; רבעון עם ערך מדווח — לא
    const sec = { fy: ['2024-09-28'], q: ['2024-06-29', '2024-09-28'], shEst: ['2024-09-28'], derived: { eps: ['2024-09-28'] }, epsNum: { '2024-09-28': 14736e6 },
      A: { sh: [15408095e3], ni: [93736e6] }, Q: { sh: [15.3e9, 15.20e9], eps: [1.40, 0.96], ni: [21448e6, 14736e6] } };
    const P = { '2024-09-28': { end: '2024-09-28', filed: '2024-10-31', rows } };
    const ch = F.q4Press(sec, P);
    ok(sec.Q.sh[1] === 15242853e3 && sec.Q.eps[1] === 0.97 && !sec.shEst.includes('2024-09-28') && ch.length === 2 && ch.every((c) => c.k === 'qsh' && c.src === '8k'), '(25) q4Press: ‎0.96 (הערכה) → ‎0.97 כמו בהודעה; המניות מההודעה; נרשם qsh');
    const sec2 = { fy: ['2024-09-28'], q: ['2024-09-28'], shEst: [], derived: { eps: [] }, epsNum: {}, A: {}, Q: { sh: [15.2e9], eps: [0.96], ni: [14736e6] } };
    ok(F.q4Press(sec2, P).length === 0 && sec2.Q.eps[0] === 0.96, '(25) q4Press: רבעון שלא הוערך — לא נוגעים');
    ok(F.q4Press(sec, null).length === 0, '(25) בלי הודעות (אין R2 / עוד לא נקרא) — כמו היום');
  }

  /* ---------- (26) המרת מטבע מלאה (17/11/2026, גל 2 — F6): שער חודשי מ־FRED ויחס ADR ---------- */
  {
    const urls = [];
    const gt = async (u) => { urls.push(u); return /id=DEXTAUS/.test(u) ? 'observation_date,DEXTAUS\n2026-11-12,32.80\n2026-11-13,.\n' : 'observation_date,EXTAUS\n2026-09-01,31.7381\n2026-10-01,32.2695\n'; };
    const v = await F.fxMonthly('TWD', { getText: gt });
    ok(v && v.src === 'FRED EXTAUS' && v.m.length === 2 && v.m[1][0] === '2026-10' && Math.abs(v.m[1][1] - 1 / 32.2695) < 1e-7 && Math.abs(v.now - 1 / 32.8) < 1e-7 && v.nowD === '2026-11-12', '(26) TWD: דולר ל־NT$ (הפוך), חודשי + היומי האחרון (בלי ".")');
    const n0 = urls.length; await F.fxMonthly('TWD', { getText: gt });
    ok(urls.length === n0, '(26) מטמון 12 שעות');
    const e = await F.fxMonthly('EUR', { getText: async (u) => (/DEXUSEU/.test(u) ? '' : 'd,EXUSEU\n2026-10-01,1.1198\n') });
    ok(e.m[0][1] === 1.1198 && e.now === 1.1198, '(26) EUR: כבר דולר ליורו; בלי יומי — החודש האחרון');
    ok((await F.fxMonthly('XYZ', { getText: gt })) === null, '(26) מטבע בלי סדרה — null (המסך: fxMix)');
    ok(F.adrRatio(25927.6e6, 5186472994) === 5 && F.adrRatio(19235e6, 2487744939) === 8 && F.adrRatio(1166e6, 1154204232) === 1, '(26) יחס ADR: TSMC 5, ‏Alibaba 8 (7.7), ‏SAP 1');
    ok(F.adrRatio(4443e6, 3333483124) === null && F.adrRatio(null, 5) === null, '(26) יחס לא שלם (רק סוג מניות אחד) — null, בלי המרה');
  }
  /* ---------- (27) פחת והשקעות הוניות מדף התזרים של כל 10-K (17/11/2026, גל 3 — F13; ‏bsfCf, ‏lib/bsfiled.js שדה cf) ---------- */
  {
    const BSF = require(path.join(root, 'ibkr-proxy/lib/bsfiled.js'));
    const TG = { dep: ['DepreciationDepletionAndAmortization', 'DepreciationAndAmortization', 'DepreciationAmortizationAndAccretionNet', 'Depreciation'], capex: ['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets'] };
    const cf = (ends, rows, m) => ({ cols: ends.map((end) => ({ end, months: m || 12, cur: null })), scale: { cur: 1e6, sh: 1 }, rows: rows.map(([tag, v]) => ({ ns: 'us-gaap', tag, label: tag, v })) });
    // Apple: עד 2017 בתגית DepreciationAmortizationAndAccretionNet, מאז DepreciationDepletionAndAmortization — לכל שנה ה־10-K האחרון שמדפיס אותה
    const have = {
      a: { form: '10-K', filed: '2015-10-28', cf: cf(['2015-09-26', '2014-09-27', '2013-09-28'], [['DepreciationAmortizationAndAccretionNet', [11257, 7946, 6757]], ['PaymentsToAcquirePropertyPlantAndEquipment', [-11247, -9571, -8165]]]) },
      b: { form: '10-K', filed: '2016-10-26', cf: cf(['2016-09-24', '2015-09-26', '2014-09-27'], [['DepreciationAmortizationAndAccretionNet', [10505, 11257, 7946]], ['PaymentsToAcquirePropertyPlantAndEquipment', [-12734, -11247, -9571]]]) },
      c: { form: '10-K', filed: '2026-11-03', cf: cf(['2026-09-26', '2025-09-27'], [['DepreciationDepletionAndAmortization', [13423, 11698]], ['PaymentsToAcquirePropertyPlantAndEquipment', [-9041, -12715]]]) },
      q: { form: '10-Q', filed: '2026-08-01', cf: cf(['2026-06-27'], [['DepreciationDepletionAndAmortization', [9000]]], 9) },
    };
    const M = F.bsfCf(have, 'USD', TG);
    ok(M.dep.get('2015-09-26').v === 11257e6 && M.dep.get('2014-09-27').v === 7946e6 && M.dep.get('2013-09-28').v === 6757e6 && M.dep.get('2026-09-26').v === 13423e6 && !M.dep.has('2026-06-27'), '(27) bsfCf: השורה המודפסת בכל שנה, גם בתגית ישנה; לא מ־10-Q');
    ok(M.dep.get('2014-09-27').filed === '2016-10-26' && M.capex.get('2014-09-27').v === 9571e6, '(27) bsfCf: ה־10-K האחרון שמדפיס את השנה; השקעה הונית — בערך מוחלט');
    // כמה שורות פחת באותו תזרים — סכום שאינו בדוח (ד): אותה שנה לא נלקחת; ב־10-K האחרון — המדד כולו לא נלקח
    const two = { ...have, b: { ...have.b, cf: cf(['2016-09-24', '2015-09-26', '2014-09-27'], [['Depreciation', [1, 2, 3]], ['DepreciationAndAmortization', [10505, 11257, 7946]]]) } };
    const M2 = F.bsfCf(two, 'USD', TG).dep;
    ok(!M2.has('2014-09-27') && !M2.has('2016-09-24') && M2.get('2013-09-28').filed === '2015-10-28', '(27) bsfCf: שתי שורות פחת בדוח האחרון שמכסה שנה — השנה לא נלקחת, גם לא מדוח ישן יותר (DHI, Devon)');
    const lastTwo = { c: { ...have.c, cf: cf(['2026-09-26'], [['Depreciation', [1]], ['DepreciationAndAmortization', [2]]]) }, a: have.a };
    ok(!F.bsfCf(lastTwo, 'USD', TG).dep, '(27) bsfCf: שתי שורות בדוח האחרון — בלי פחת מהתזרים');
    // הסדרה היום "Depreciation" בלבד (פחת בלי הפחתות) — לא מחליפים בסך פחת והפחתות של שנים קודמות (ד)
    const dOnly = { c: { ...have.c, cf: cf(['2026-09-26'], [['Depreciation', [1]]]) }, a: have.a };
    ok(!F.bsfCf(dOnly, 'USD', TG).dep, '(27) bsfCf: "Depreciation" בדוח האחרון — לא נוגעים');
    ok(Object.keys(F.bsfCf({}, 'USD', TG)).length === 0 && Object.keys(F.bsfCf(null, 'USD', TG)).length === 0, '(27) bsfCf: בלי הגשות — ריק');
    // slimCf / needCf: רק שורות הפחת וההשקעות; 10-K בלי cf (ובלי cfErr) — צריך להשלים; 10-Q / תקלה בהגשה — לא
    const sc = BSF.slimCf({ cols: [{ end: '2025-12-31', months: 12 }], scale: { cur: 1 }, rows: [{ ns: 'us-gaap', tag: 'NetIncomeLoss', v: [1] }, { ns: 'us-gaap', tag: 'DepreciationDepletionAndAmortization', v: [2] }, { ns: 'us-gaap', tag: 'PaymentsToAcquirePropertyPlantAndEquipment', v: [3] }, { ns: 'us-gaap', tag: 'AmortizationOfIntangibleAssets', v: [4] }] });
    ok(sc.rows.map((r) => r.tag).join() === 'DepreciationDepletionAndAmortization,PaymentsToAcquirePropertyPlantAndEquipment,AmortizationOfIntangibleAssets', '(27) slimCf: רק פחת/הפחתות ורכישת רכוש');
    ok(BSF.needCf({ form: '10-K', bs: {} }) && !BSF.needCf({ form: '10-K', cf: {} }) && !BSF.needCf({ form: '10-K', cfErr: 'nocf' }) && !BSF.needCf({ form: '10-Q', bs: {} }) && !BSF.needCf({ form: '10-K', err: 'nofs' }) && BSF.needCf({ form: '10-K', err: 'nobs' }), '(27) needCf');
    // load: הגשה שנתית חדשה — גם דף התזרים (3 בקשות); הגשה שנתית ישנה בלי cf — רק FilingSummary ודף התזרים, בלי המאזן
    const RB = '<table><tr><th class="tl"><div><strong>Balance Sheets - USD ($)<br> $ in Millions</strong></div></th><th class="th">Dec. 31, 2025</th></tr>'
      + '<tr class="re"><td class="pl"><a onclick="x(\'defref_us-gaap_Assets\')">Total assets</a></td><td class="nump">900</td></tr></table>';
    const RC = '<table><tr><th class="tl"><div><strong>Cash Flows - USD ($)<br> $ in Millions</strong></div></th><th class="th" colspan="1">12 Months Ended</th></tr><tr><th class="th">Dec. 31, 2025</th></tr>'
      + '<tr class="re"><td class="pl"><a onclick="x(\'defref_us-gaap_DepreciationDepletionAndAmortization\')">Depreciation and amortization</a></td><td class="nump">55</td></tr></table>';
    const FS2 = '<FilingSummary><MyReports><Report><MenuCategory>Statements</MenuCategory><HtmlFileName>R2.htm</HtmlFileName><ShortName>Balance Sheets</ShortName></Report>'
      + '<Report><MenuCategory>Statements</MenuCategory><HtmlFileName>R6.htm</HtmlFileName><ShortName>Consolidated Statements of Cash Flows</ShortName></Report></MyReports></FilingSummary>';
    const urls = [], store = new Map();
    store.set(BSF.key('7'), { v: BSF.V, f: { old: { form: '10-K', filed: '2025-02-20', bs: { rows: [] } } } });
    const gt = async (u) => { urls.push(u); return /FilingSummary/.test(u) ? FS2 : /R6/.test(u) ? RC : RB; };
    const SUB3 = { filings: { recent: { form: ['10-K', '10-K'], accessionNumber: ['new', 'old'], filingDate: ['2026-02-20', '2025-02-20'] } } };
    const fl = (await BSF.load('7', SUB3, { getText: gt, store: { get: (k) => store.get(k), put: (k, o) => store.set(k, o) }, now: Date.parse('2026-11-17') })).f;
    ok(fl.new.bs && fl.new.cf && fl.new.cf.rows[0].v[0] === 55 && fl.old.cf && fl.old.bs, '(27) load: 10-K חדש — מאזן ותזרים; ישן — הושלם התזרים');
    ok(urls.filter((u) => /\/new\//.test(u)).length === 3 && urls.filter((u) => /\/old\//.test(u)).length === 2 && !urls.some((u) => /\/old\/R2/.test(u)), '(27) load: לישן רק FilingSummary ודף התזרים');
    ok(F.bsfCf(fl, 'USD', TG).dep.get('2025-12-31').v === 55e6, '(27) מהדף שנקרא — הפחת של השנה');
    // כל ערך שהודפס (לכלל ההצגה מחדש: ערך שלנו שהודפס בתזרים של 10-K אחר — לא מוחלף; YUM) ופחת שלילי נשמר בסימן (Allstate)
    ok(M.dep.printed.get('2014-09-27').filter((v) => v === 7946e6).length === 2 && M.capex.printed.get('2014-09-27')[0] === 9571e6, '(27) bsfCf: הערכים שהודפסו בכל 10-K');
    const neg = F.bsfCf({ c: { form: '10-K', filed: '2011-02-20', cf: cf(['2010-12-31', '2009-12-31'], [['DepreciationAndAmortization', [100, -91]]]) } }, 'USD', TG);
    ok(neg.dep.get('2009-12-31').v === -91e6, '(27) bsfCf: פחת שלילי — כפי שהודפס');
  }
  /* ---------- (28) שורות החוב במאזן — גל 3 סעיף 3 (debtFace): הערה עם סכום בסוגריים, תגית "…NetOfUnamortized…", "סך" של כל הקבוצות ---------- */
  {
    const sh = (rows) => ({ bs: { cols: [{ end: '2012-12-31' }], scale: { cur: 1e6, sh: 1e6 },
      rows: [{ ns: 'us-gaap', tag: 'Assets', label: 'Total assets', total: true, v: [9e5] },
        ...rows.map(([ns, tag, label, v, total]) => ({ ns, tag, label, v: [v], total: !!total })),
        { ns: 'us-gaap', tag: 'LiabilitiesAndStockholdersEquity', label: 'Total liabilities and equity', total: true, v: [9e5] }] } });
    const tot = (rows) => F.debtFace(sh(rows), 'USD').tot.get('2012-12-31') / 1e6;
    // Goldman: תגית פרטית, ובתווית הערה "(includes $X at fair value)" — לא "fair value" של השורה
    ok(tot([['gs', 'UnsecuredShortTermBorrowingsIncludingCurrentPortionOfUnsecuredLongTermBorrowings', 'Unsecured short-term borrowings, including the current portion of unsecured long-term borrowings (includes $19,067 and $17,595 at fair value)', 44304],
      ['us-gaap', 'UnsecuredLongTermDebt', 'Unsecured long-term borrowings (includes $11,691 and $12,593 at fair value)', 167305]]) === 211609, '(28) Goldman: שתי השורות, גם עם הערת שווי הוגן');
    // JPMorgan: ‏OtherShortTermBorrowings "Other borrowed funds (included $13,306 … at fair value)"
    ok(tot([['us-gaap', 'CommercialPaper', 'Commercial paper', 55367], ['us-gaap', 'OtherShortTermBorrowings', 'Other borrowed funds (included $13,306 and $11,591 at fair value)', 26636],
      ['us-gaap', 'LongTermDebt', 'Long-term debt (included $28,878 and $30,788 at fair value)', 249024]]) === 331027, '(28) JPMorgan: "Other borrowed funds" נספר');
    // "(including current portion…)" בלי סכום — נשאר בתווית (הסיווג "קצר + חלויות" של debtCat)
    const dl = F.debtFace(sh([['us-gaap', 'ShortTermBorrowings', 'Short-term debt (including current portion of long-term debt)', 500]]), 'USD').lines[0];
    ok(/including current portion/.test(dl.label), '(28) הערה בלי סכום נשארת בתווית');
    // Realty Income: ‏o:NotesPayableNetOfUnamortizedDiscount — חוב; ‏UnamortizedDebtIssuanceCosts / DebtInstrumentUnamortizedDiscount — לא
    ok(tot([['us-gaap', 'LineOfCredit', 'Line of credit payable', 128], ['o', 'NotesPayableNetOfUnamortizedDiscount', 'Notes payable, net', 3185],
      ['us-gaap', 'DebtInstrumentUnamortizedDiscount', 'Unamortized discount on notes', 12]]) === 3313, '(28) Realty Income: "…NetOfUnamortizedDiscount" נספר, הניכיון לא');
    // Regions: ‏"Total short-term borrowings" + ‏"Long-term borrowings" ואז ‏"Total borrowed funds" — הסך במקום כולן, לא פעמיים
    ok(tot([['us-gaap', 'OtherShortTermBorrowings', 'Other short-term borrowings', 500], ['us-gaap', 'ShortTermBorrowings', 'Total short-term borrowings', 500, true],
      ['us-gaap', 'LongTermDebt', 'Long-term borrowings', 8132], ['us-gaap', 'DebtAndCapitalLeaseObligations', 'Total borrowed funds', 8632, true]]) === 8632, '(28) Regions: "Total borrowed funds" — 8,632, לא 9,132');
    // PNC: ‏"Total borrowed funds" שכולל ריפו (לא נספר) — הרכיבים נשארים (התווית "borrowed funds" לבדה אינה חוב)
    ok(tot([['us-gaap', 'FederalFundsPurchasedAndSecuritiesSoldUnderAgreementsToRepurchase', 'Federal funds purchased and repurchase agreements', 3327], ['us-gaap', 'SubordinatedDebt', 'Subordinated debt', 7299],
      ['us-gaap', 'CommercialPaper', 'Commercial paper (includes $0 and $6,045 for VIEs)', 8453], ['us-gaap', 'BorrowedFunds', 'Total borrowed funds', 19079, true]]) === 15752, '(28) PNC: סך שכולל ריפו — הרכיבים');
  }

  /* ---------- (29) רבעון רביעי מתויג שאינו עקבי עם הרווח (18/11/2026, גל 4 — q4Press): Sempra ‏2019 ---------- */
  {
    // XBRL: ‏0.21 לפני הפיצול 2:1 (‏0.105 אצלנו), ‏578M מניות, רווח ‏$447M — ‏0.105 × 578 = 61 ≠ 447. בהודעה: ‏1.55 ו־289.0M (‏Q4 ו־שנה)
    const rows = [{ t: 2, label: 'Diluted', v: [1.55, 1.28, 7.29, 3.42] }, { t: 2, label: 'Weighted-average common shares outstanding, diluted', v: [289012, 283117, 287820, 279824] }];
    const P = { '2019-12-31': { end: '2019-12-31', filed: '2020-02-25', rows } };
    const mk = (eps, ni) => ({ fy: ['2019-12-31'], q: ['2019-09-30', '2019-12-31'], shEst: [], derived: { eps: [] }, epsNum: {}, splitsUsed: [['2023-11-03', 2]],
      A: { sh: [575.6e6], ni: [2055e6] }, Q: { sh: [591.6e6, 578.0e6], eps: [1.42, eps], ni: [813e6, ni] } });
    const s1 = mk(0.105, 447e6), ch = F.q4Press(s1, P);
    ok(s1.Q.eps[1] === 0.775 && s1.Q.sh[1] === 578.0e6 && ch.length === 1 && ch[0].m === 'eps' && ch[0].v === 0.105 && ch[0].src === '8k', '(29) Sempra ‏2019: ‏0.105 → ‏0.775 מההודעה (אחרי הפיצול); המניות המתויגות נשארות');
    const s2 = mk(0.77, 447e6);
    ok(F.q4Press(s2, P).length === 0 && s2.Q.eps[1] === 0.77, '(29) רווח למניה עקבי עם הרווח — לא נוגעים (גם כשההודעה בסנט אחר)');
    const s3 = mk(0.03, 2e6);
    ok(F.q4Press(s3, P).length === 0 && s3.Q.eps[1] === 0.03, '(29) רווח קטן — פער של סנטים ביחס גדול, לא נוגעים');
    const s4 = mk(0.105, 447e6); s4.Q.sh[1] = 520e6;
    ok(F.q4Press(s4, P).length === 0, '(29) המניות בהודעה רחוקות מהמתויגות (מעל 2%) — לא אותה טבלה, לא נוגעים');
    // רבעון הפסד מוערך: בהודעה "Diluted" ‏381.1 ובשנה ‏371.0 (מדוללות מלאות), ה־XBRL השנתי ‏363.7 (בסיסי — אנטי־דילול). הרווח למניה מההודעה,
    // המניות נשארות הערכה. כשהשנה בהודעה = השנתי שלנו (Ventas) — גם המניות
    const lrows = [{ t: 1, label: 'Diluted', v: [-0.22, 0.95, -8.61, 2.27] }, { t: 1, label: 'Diluted', v: [381.1, 395.2, 371.0, 401.0] }];
    const mkL = (annSh) => ({ fy: ['2017-12-31'], q: ['2017-12-31'], shEst: ['2017-12-31'], derived: { eps: ['2017-12-31'] }, epsNum: { '2017-12-31': -81e6 },
      A: { sh: [annSh], ni: [-3131e6], eps: [-8.61] }, Q: { sh: [376.6e6], eps: [-0.21], ni: [-81e6] } });
    const PL = { '2017-12-31': { end: '2017-12-31', filed: '2018-02-01', rows: lrows } };
    const l1 = mkL(363.7e6), c1 = F.q4Press(l1, PL);
    ok(l1.Q.sh[0] === 376.6e6 && l1.Q.eps[0] === -0.22 && c1.length === 1 && c1[0].m === 'eps' && l1.shEst.includes('2017-12-31'), '(29) הפסד: שורת "Diluted" בבסיס אחר מהשנתי — רק הרווח למניה, המניות נשארות הערכה');
    const l2 = mkL(371.0e6), c2 = F.q4Press(l2, PL);
    ok(l2.Q.sh[0] === 381.1e6 && c2.some((c) => c.m === 'sh'), '(29) הפסד: השנה בהודעה = השנתי שלנו — המניות מההודעה (Ventas)');
  }

  /* ---------- (30) שורות בודדות בחוב (18/11/2026, גל 4 — debtFace) ---------- */
  {
    const sh = (rows) => ({ bs: { cols: [{ end: '2016-03-31' }], scale: { cur: 1e6, sh: 1e6 },
      rows: [{ ns: 'us-gaap', tag: 'Assets', label: 'Total assets', total: true, v: [9e5] },
        ...rows.map(([ns, tag, label, v, total]) => ({ ns, tag, label, v: [v], total: !!total })),
        { ns: 'us-gaap', tag: 'LiabilitiesAndStockholdersEquity', label: 'Total liabilities and equity', total: true, v: [9e5] }] } });
    const tot = (rows) => F.debtFace(sh(rows), 'USD').tot.get('2016-03-31') / 1e6;
    // LH ‏10-Q ‏2016: התוויות זזו בשורה — ‏LiabilitiesCurrent ‏"Long-term debt, less current portion" (‏1,642.7, סך) מחקה את ‏DebtCurrent ‏425.4
    ok(tot([['us-gaap', 'DebtCurrent', 'Debt, Current', 425.4], ['us-gaap', 'LiabilitiesCurrent', 'Long-term debt, less current portion', 1642.7, true],
      ['us-gaap', 'LongTermDebtNoncurrent', 'Long-term Debt, Excluding Current Maturities', 5969.5]]) === 6394.9, '(30) LH: תגית סך התחייבויות — לא חוב גם בתווית של חוב');
    // Con Edison: ‏ed:LongTermDebtExcludingHeldForSale — חוב; ‏ed:LiabilitiesNoncurrentExcludingLongTermDebt ‏"TOTAL NONCURRENT LIABILITIES" — לא
    ok(tot([['ed', 'LongTermDebtCurrentMaturitiesExcludingHeldForSale', 'Long-term debt due within one year', 440], ['us-gaap', 'NotesPayableCurrent', 'Notes payable', 1488],
      ['ed', 'LiabilitiesNoncurrentExcludingLongTermDebt', 'TOTAL NONCURRENT LIABILITIES', 14958, true], ['ed', 'LongTermDebtExcludingHeldForSale', 'LONG-TERM DEBT', 21927]]) === 23855, '(30) Con Edison: "Excluding …" בשם התגית לא נבדק מול "held for sale" / "debt"');
    // Vistra: ‏ShortTermBorrowings ‏"Accounts receivable securitization program" — חוב
    ok(tot([['us-gaap', 'ShortTermBorrowings', 'Accounts receivable securitization program', 350], ['us-gaap', 'LongTermDebtAndCapitalLeaseObligationsCurrent', 'Less amounts due currently', 181],
      ['us-gaap', 'LongTermDebtAndCapitalLeaseObligations', 'Long-term debt, less amounts due currently', 11060]]) === 11591, '(30) Vistra: איגוח חייבים בתגית של הלוואות קצרות נספר');
    // AIG ‏10-Q ‏2015: ‏OtherLongTermDebt ‏"Long-term debt (portion measured at fair value: 2015 - $4,844; …)"
    ok(tot([['us-gaap', 'OtherLongTermDebt', 'Long-term debt (portion measured at fair value: 2015 - $4,844; 2014 - $5,466)', 31999]]) === 31999, '(30) AIG: הערת "portion measured at fair value" עם סכום — לא חלק מהשם');
    // Morgan Stanley: רווח כולל אחר בתגית עם "Debt" (שלילי) — לא חוב, והעמודה לא נפסלת
    const ms = F.debtFace(sh([['us-gaap', 'ShortTermBorrowings', 'Short-term borrowings (includes $714 and $406 at fair value)', 1122], ['us-gaap', 'LongTermDebt', 'Long-term borrowings', 172688],
      ['ms', 'AccumulatedOtherComprehensiveIncomeLossNetOfCumulativeDebtValuationAdjustmentsAfterTax', 'Accumulated other comprehensive income (loss)', -2450]]), 'USD');
    ok(ms.lines.length === 2 && ms.tot.get('2016-03-31') === 173810e6, '(30) Morgan Stanley: רווח כולל אחר — לא שורת חוב');
  }
  /* ---------- (31) תגיות במשמעות זהה שלא היו ברשימה (18/11/2026, גל 4 — "חסר") ---------- */
  {
    // US GAAP: שותפות (ARES עד 2019) — רווח ומניות "ליחידה"; "Short-term investments" של מבטח ב־OtherShortTermInvestments
    const base = [['Revenues', 'USD', yrs([500, 510, 520], 2017)], ['NetIncomeLoss', 'USD', yrs([50, 51, 52], 2017)]];
    const lp = F.normalizeSec(facts([...base, ['NetIncomeLossNetOfTaxPerOutstandingLimitedPartnershipUnitDiluted', 'USD/shares', yrs([0.5, 0.51, 0.52], 2017)],
      ['WeightedAverageLimitedPartnershipUnitsOutstandingDiluted', 'shares', yrs([100e6, 100e6, 100e6], 2017)],
      ['OtherShortTermInvestments', 'USD', [[null, '2019-12-31', 77, '10-K', '2020-02-01']]]]), [], null), j = lp.fy.indexOf('2019-12-31');
    ok(lp.A.eps[j] === 0.52 && lp.A.sh[j] === 100e6, '(31) שותפות: רווח ומניות ליחידה כשאין רווח למניה');
    ok(lp.A.msec && lp.A.msec[j] === 77, '(31) מבטח: "Short-term investments" ב־OtherShortTermInvestments');
    const bo = F.normalizeSec(facts([...base, ['InterestAndDebtExpense', 'USD', yrs([20, 21, 22], 2017)], ['CostOfGoodsSoldExcludingDepreciationDepletionAndAmortization', 'USD', yrs([300, 305, 310], 2017)]]), [], null);
    ok(bo.A.int[bo.fy.indexOf('2019-12-31')] === 22 && bo.A.cogs[bo.fy.indexOf('2019-12-31')] === 310, '(31) "Interest and debt expense" (Boeing) ועלות מכר "בלי פחת" (Ball)');
    // הרגילה קודמת: כשיש רווח למניה — התגית של השותפות לא נכנסת
    const lp2 = F.normalizeSec(facts([...base, ['EarningsPerShareDiluted', 'USD/shares', yrs([0.4, 0.41, 0.42], 2017)],
      ['NetIncomeLossNetOfTaxPerOutstandingLimitedPartnershipUnitDiluted', 'USD/shares', yrs([0.5, 0.51, 0.52], 2017)]]), [], null);
    ok(lp2.A.eps[lp2.fy.indexOf('2019-12-31')] === 0.42, '(31) רווח למניה רגיל קודם ליחידה');
    // IFRS: רכישה חוזרת, מו״פ, דיבידנד לבעלי המניות, פחת מהתזרים, ני״ע לזמן קצר — לא היו במפה בכלל
    const ig = {};
    const put = (tag, unit, vals) => { ig[tag] = { units: { [unit]: vals.map((v, i) => ({ start: (2023 + i) + '-01-01', end: (2023 + i) + '-12-31', val: v, form: '20-F', filed: (2024 + i) + '-03-01', fy: 2024 + i, fp: 'FY' })) } }; };
    put('Revenue', 'EUR', [1000, 1100]); put('ProfitLossAttributableToOwnersOfParent', 'EUR', [100, 110]);
    put('PaymentsToAcquireOrRedeemEntitysShares', 'EUR', [40, 45]); put('ResearchAndDevelopmentExpense', 'EUR', [70, 75]);
    put('DividendsPaidToEquityHoldersOfParentClassifiedAsFinancingActivities', 'EUR', [30, 33]); put('AdjustmentsForDepreciationExpense', 'EUR', [20, 22]);
    ig.CurrentInvestments = { units: { EUR: [{ end: '2024-12-31', val: 9, form: '20-F', filed: '2025-03-01', fy: 2024, fp: 'FY' }] } };
    const fr = F.normalizeSec({ facts: { 'ifrs-full': ig } }, [], null), k = fr.fy.indexOf('2024-12-31');
    ok(fr.A.buy[k] === 45 && fr.A.rnd[k] === 75 && fr.A.divp[k] === 33 && fr.A.dep[k] === 22 && fr.A.msec[k] === 9,
      '(31) IFRS: רכישה חוזרת, מו״פ, דיבידנד לבעלי המניות, פחת ("Depreciation") וני״ע לזמן קצר');
  }
  /* ---------- (32) השלמה בלי תקופה משותפת — סבירה מול השכנים (18/11/2026, גל 5 — F21) ---------- */
  {
    const base = [['Revenues', 'USD', yrs([500, 510, 520, 530], 2018)], ['NetIncomeLoss', 'USD', yrs([50, 51, 52, 53], 2018)]];
    // Howmet ‏2018: ‏InterestExpenseDebt ‏19 (רכיב) מול ~300 בשנים הסמוכות — לא משלימים
    const hw = F.normalizeSec(facts([...base, ['InterestExpense', 'USD', yrs([300, 310, 320], 2019)], ['InterestExpenseDebt', 'USD', yrs([19], 2018)]]), [], null);
    ok(hw.A.int[hw.fy.indexOf('2018-12-31')] == null && hw.A.int[hw.fy.indexOf('2019-12-31')] === 300, '(32) השלמה רחוקה פי 16 מהשכנה — לא נכנסת');
    const ok2 = F.normalizeSec(facts([...base, ['InterestExpense', 'USD', yrs([300, 310, 320], 2019)], ['InterestExpenseDebt', 'USD', yrs([280], 2018)]]), [], null);
    ok(ok2.A.int[ok2.fy.indexOf('2018-12-31')] === 280, '(32) השלמה סבירה מול השכנה — נכנסת כמו היום');
  }
  /* ---------- (33) הראשית במאזן כשאף תגית לא מודפסת בדוח האחרון (18/11/2026, גל 5 — F22, Brown & Brown) ---------- */
  {
    const I = (a) => a.map(([e, v]) => [null, e, v, '10-K', e.slice(0, 4) * 1 + 1 + '-02-15']);
    const fx = facts([['Revenues', 'USD', yrs([500, 510, 520, 530, 540], 2020)], ['NetIncomeLoss', 'USD', yrs([50, 51, 52, 53, 54], 2020)],
      ['Assets', 'USD', I([['2024-12-31', 900], ['2025-12-31', 950]])],
      ['AvailableForSaleSecuritiesDebtSecuritiesCurrent', 'USD', I([['2021-12-31', 7], ['2022-12-31', 6], ['2023-12-31', 11]])],
      ['ShortTermInvestments', 'USD', I([['2020-12-31', 18], ['2021-12-31', 13], ['2022-12-31', 12], ['2023-12-31', 11], ['2024-12-31', 10]])]]);
    const face = { bs: { cols: [{ end: '2025-12-31' }], scale: { cur: 1, sh: 1 }, rows: [{ ns: 'us-gaap', tag: 'Assets', label: 'Total assets', total: true, v: [950] }] } };
    const b = F.normalizeSec(fx, [], face);
    ok(b.A.msec[b.fy.indexOf('2021-12-31')] === 13 && b.A.msec[b.fy.indexOf('2020-12-31')] === 18, '(33) בלי שורה מודפסת — הראשית היא זו שדיווחה אחרונה, לא תגית ביאור שנעצרה שנה קודם');
  }
  /* ---------- (34) רווח והפסד לפי הגשה (18/11/2026, גל 5 — F20, bsfIs) ---------- */
  {
    const K = (filed, ends, rows) => ({ form: '10-K', filed, is: { cols: ends.map((end) => ({ end, months: 12 })), scale: { cur: 1e6 },
      rows: rows.map(([ns, tag, v]) => ({ ns, tag, label: tag, v })) } });
    const have = {
      a: K('2026-02-10', ['2025-12-31', '2024-12-31', '2023-12-31'], [['us-gaap', 'InterestAndDebtExpense', [176, 195, 226]], ['us-gaap', 'OperatingIncomeLoss', [900, 850, 800]]]),
      // הדוח של 2023: השורה בתגית אחרת; 2021 — ‏380 המודפס (אצלנו 413 מביאור); הרווח התפעולי בתגית פרטית, ו־2021 ריק אצלנו
      b: K('2024-02-10', ['2023-12-31', '2022-12-31', '2021-12-31'], [['us-gaap', 'InterestExpense', [226, 237, 380]], ['hwm', 'OperatingProfit', [800, 700, 650]]]),
      // הדוח של 2021 מדפיס 2020 כ־300 — ואצלנו 300 (הודפס): נשאר גם כשהשרשרת לא מגיעה אליו
      c: K('2022-02-10', ['2021-12-31', '2020-12-31'], [['us-gaap', 'InterestExpense', [390, 300]]]),
    };
    const M = (o) => new Map(Object.entries(o).map(([e, v]) => [e, v * 1e6]));
    const r = F.bsfIs(have, 'USD', { int: M({ '2025-12-31': 176, '2024-12-31': 195, '2023-12-31': 226, '2022-12-31': 237, '2021-12-31': 413 }),
      op: M({ '2025-12-31': 900, '2024-12-31': 850, '2023-12-31': 800, '2022-12-31': 700 }) });
    ok(r.int.get('2021-12-31').v === 380e6 && r.op.get('2021-12-31').v === 650e6 && !r.int.has('2020-12-31'), '(34) שרשור לפי חפיפה: תגית אחרת ותגית פרטית — אותה שורה');
    ok(r.printed.get('2020-12-31').includes(300e6), '(34) כל ערך שהודפס בשנה — לבדיקת הצגה מחדש');
    const r2 = F.bsfIs(have, 'USD', { int: M({ '2025-12-31': 176, '2024-12-31': 199, '2023-12-31': 226 }) });
    ok(!r2.int, '(34) שער: הסדרה לא עוקבת היום אחרי השורה — לא נוגעים');
    ok(r.own.join() === '2025-12-31,2023-12-31,2021-12-31', '(34) השנה של כל 10-K');
    // מקצה לקצה: 2019 הודפס (971) רק בדוח של 2021 — אחרי הצגה מחדש, והדוח של 2019 לפני החלון: 509 שלנו נשאר. ‏2020 — הדוח של
    // 2020 בחלון ומדפיס 300 (אצלנו 305 מביאור) — מתוקן
    const HX = facts([['InterestExpense', 'USD', yrs([509e6, 305e6, 310e6, 320e6, 330e6], 2019)], ['Revenues', 'USD', yrs([5e9, 5e9, 5e9, 5e9, 5e9], 2019)]]);
    const hb = { a: K('2024-02-10', ['2023-12-31', '2022-12-31', '2021-12-31'], [['us-gaap', 'InterestExpense', [330, 320, 310]]]),
      b: K('2022-02-10', ['2021-12-31', '2020-12-31', '2019-12-31'], [['us-gaap', 'InterestExpense', [310, 300, 971]]]),
      c: K('2021-02-10', ['2020-12-31', '2019-12-31'], [['us-gaap', 'InterestExpense', [300, 290]]]) };
    const hx = F.normalizeSec(HX, [], null, hb), hi = (e) => hx.A.int[hx.fy.indexOf(e)];
    ok(hi('2019-12-31') === 509e6 && hi('2020-12-31') === 300e6 && hi('2023-12-31') === 330e6, '(34) תיקון רק כשהדוח של אותה שנה בחלון');
    // bsfiled: ‏10-K — גם דף רווח והפסד (בלי שורות למניה), והגשה שכבר נשמרה בלעדיו — משלימים רק אותו
    const BS2 = require('../ibkr-proxy/lib/bsfiled.js');
    const FS3 = '<FilingSummary><MyReports>' + [['R2.htm', 'Consolidated Statements of Operations'], ['R4.htm', 'Consolidated Balance Sheets'], ['R7.htm', 'Consolidated Statements of Cash Flows']]
      .map(([f, n]) => '<Report><MenuCategory>Statements</MenuCategory><HtmlFileName>' + f + '</HtmlFileName><ShortName>' + n + '</ShortName></Report>').join('') + '</MyReports></FilingSummary>';
    const RP = (rows) => '<table><tr><th class="tl"><div><strong>X - USD ($)<br> $ in Millions</strong></div></th><th class="th">12 Months Ended<br>Dec. 31, 2025</th></tr>'
      + rows.map(([t, l, v]) => '<tr class="re"><td class="pl"><a onclick="x(\'defref_' + t + '\')">' + l + '</a></td><td class="nump">' + v + '</td></tr>').join('') + '</table>';
    const pages = { 'R2.htm': RP([['us-gaap_InterestExpense', 'Interest expense', '226'], ['us-gaap_EarningsPerShareDiluted', 'Diluted', '1.5']]),
      'R4.htm': RP([['us-gaap_Assets', 'Total assets', '900'], ['us-gaap_LongTermDebtNoncurrent', 'Long-term debt', '100']]), 'R7.htm': RP([['us-gaap_DepreciationDepletionAndAmortization', 'D&A', '50']]) };
    const got = [], gt3 = async (u) => { got.push(u); const m = /(R\d+\.htm)$/.exec(u); return m ? pages[m[1]] : FS3; };
    const r1 = await BS2.readOne('1', { acc: '0000000001-26-000001', form: '10-K', filed: '2026-02-10' }, gt3);
    ok(r1.bs && r1.cf && r1.is && r1.is.rows.length === 1 && r1.is.rows[0].tag === 'InterestExpense', '(34) readOne ‏10-K: מאזן, תזרים ורווח והפסד (בלי שורות למניה)');
    const old0 = { form: '10-K', filed: '2025-02-10', bs: r1.bs, cf: r1.cf }, n0 = got.length;
    const add0 = await BS2.readMissing(old0, 'https://x/', null, gt3);
    ok(add0.is && !add0.cf && got.length - n0 === 2 && BS2.needIs(old0) && !BS2.needX({ ...old0, ...add0 }), '(34) הגשה ישנה: רק דף רווח והפסד (FilingSummary + דף אחד)');
  }
  /* ---------- (35) קבוצת העמודה לפי המיקום הפיזי (18/11/2026, גל 5 — parseR) ---------- */
  {
    // ‏ADI ‏10-K ‏2019: שמונה רבעונים ושלוש שנים; תאריך ב־colspan=2 ועמודות הערות שוליים — הקבוצות נספרות בעמודות פיזיות
    const d2 = (d) => `<th class="th" colspan="2"><div>${d}</div></th>`, fn = '<th class="th"><sup>[1]</sup></th>', d1 = (d) => `<th class="th"><div>${d}</div></th>`;
    const q = ['Nov. 02, 2019', 'Aug. 03, 2019', 'May 04, 2019', 'Feb. 02, 2019', 'Nov. 03, 2018', 'Aug. 04, 2018', 'May 05, 2018', 'Feb. 03, 2018'];
    const adi = SF.parseR(`<table><tr><th class="tl" colspan="1" rowspan="2"><div><strong>Income - USD ($)<br> $ in Thousands</strong></div></th><th class="th" colspan="16">3 Months Ended</th><th class="th" colspan="5">12 Months Ended</th></tr>
<tr>${q.map(d2).join('')}${d2('Nov. 02, 2019')}${fn}${d1('Nov. 03, 2018')}${d1('Oct. 28, 2017')}</tr>
${row('ro', 'us-gaap_CostOfRevenue', 'Cost of sales', ['1', '2', '3', '4', '5', '6', '7', '8', '1,977,315', '2,045,907', '2,078,110'])}</table>`);
    const ms = adi.cols.map((c) => c.months);
    ok(ms.slice(0, 8).every((m) => m === 3) && ms.slice(8).join() === '12,12,12' && adi.cols[10].end === '2017-10-28', '(35) ‏colspan=2 והערת שוליים — שלוש השנים מקבלות "12 חודשים"');
    // תאריך באותה שורה עם הקבוצות (rowspan) — לפי המספר הסידורי, כמו עד היום
    const rs = SF.parseR(`<table><tr><th class="tl" colspan="1" rowspan="2"><div><strong>Income - USD ($)<br> $ in Millions</strong></div></th><th class="th" colspan="2">12 Months Ended</th><th class="th" rowspan="2"><div>Dec. 31, 2023</div></th></tr>
<tr>${d1('Dec. 31, 2025')}${d1('Dec. 31, 2024')}</tr>${row('ro', 'us-gaap_Revenues', 'Revenue', ['1', '2', '3'])}</table>`);
    ok(rs.cols.length === 3 && rs.cols.filter((c) => c.months === 12).length === 2, '(35) תאריך בשורת הקבוצות — ההתנהגות הקודמת');
  }
  /* ---------- (36) הרבעון הרביעי: נספח בלי טבלאות ו־8-K בלי Item 2.02 (18/11/2026, גל 5 — F24, ‏F25) ---------- */
  {
    const SP = require('../ibkr-proxy/lib/secpr.js'), BS3 = require('../ibkr-proxy/lib/bsfiled.js');
    // שקף עם שכבת טקסט (Apollo): מקף בתווית, "$" צמוד, אחוזי שינוי והערת שוליים — לא עמודות
    const slide = '<DIV><FONT>Earnings (Loss) per share Net income (loss) attributable to Common Stockholders - Basic $2.42 $2.82 $1.07 Net income (loss) attributable to Common Stockholders - Diluted $2.39 $2.78 $1.07 Weighted average shares outstanding - Basic 584 589 594 Weighted average shares outstanding - Diluted 603 608 598 GAAP Income Statement</FONT></DIV>'
      + '<DIV>Earnings per diluted share (2) 3.53$ (59)% 15.88$</DIV>';
    const tr = SP.parseText(slide);
    ok(SP.parse(slide).length === 0 && tr.length === 3 && tr[0].v.join() === '2.39,2.78,1.07' && tr[1].v.join() === '603,608,598' && tr[2].v.join() === '3.53,15.88', '(36) רצף הטקסט: שורות "מדולל" בלי טבלה');
    const q = SP.q4From(tr, 1462e6, 600e6, null, null);
    ok(q && q.eps === 2.39 && q.sh === 603e6, '(36) המכפלה מאמתת את הזוג מהטקסט');
    // 8-K של התוצאות בלי 2.02 (רק 9.01) — מועמד רק כשאין 8-K עם 2.02 בחלון
    const sub = (rows) => ({ filings: { recent: { form: rows.map((x) => x[0]), items: rows.map((x) => x[1]), filingDate: rows.map((x) => x[2]), accessionNumber: rows.map((x, i) => 'a' + i), primaryDocument: rows.map(() => 'd.htm') } } });
    const p1 = SP.pickItems(BS3.merge8k(sub([['8-K', '9.01', '2022-02-03'], ['8-K', '5.02,9.01', '2022-01-10'], ['8-K', '2.02,9.01', '2022-05-03']]), []), ['2021-12-31']);
    const p2 = SP.pickItems(sub([['8-K', '9.01', '2022-01-05'], ['8-K', '2.02,9.01', '2022-02-03']]), ['2021-12-31']);
    ok(p1[0].cands.map((c) => c.acc).join() === 'a0' && p2[0].cands.map((c) => c.acc).join() === 'a1', '(36) 8-K בלי 2.02 — רק כשאין 8-K של תוצאות בחלון');
    // רשומת "לא נמצא" מהמפענח הקודם נקראת שוב פעם אחת
    ok(BS3.prNeed(undefined) && BS3.prNeed({ err: 'nofile' }) && !BS3.prNeed({ err: 'nofile', pv: BS3.PR_V }) && !BS3.prNeed({ rows: [{ label: 'Diluted weighted average shares', v: [1000] }], pv: BS3.PR_V })
      && BS3.prNeed({ rows: [{ label: 'Diluted EPS', v: [1.5] }] }) && !BS3.prNeed({ rows: [], pv: BS3.PR_V }), '(36) prNeed: רק רשומה חסרה, "לא נמצא" ישנה או ישנה בלי שורת מניות (גל 6)');
    // גל 8 (PR_V 4): המפענח שינה מספרים בתוך שורות (".45", ‏"($") — גם רשומה תקינה מלפני 4 נקראת שוב, פעם אחת
    ok(BS3.PR_V === 4 && BS3.prNeed({ rows: [{ label: 'Diluted weighted average shares', v: [1000] }] }) && BS3.prNeed({ rows: [{ label: 'Diluted weighted average shares', v: [1000] }], pv: 3 })
      && !BS3.prNeed({ rows: [{ label: 'Diluted EPS', v: [1.5] }], pv: 4 }), '(36) גל 8: רשומה מלפני PR_V 4 נקראת שוב פעם אחת');
    // בלי נספח (Halliburton) — ההודעה בגוף ה־8-K
    const docs = { 'index.json': JSON.stringify({ directory: { item: [{ name: 'hal8k.htm', size: 9000 }, { name: 'index.htm' }] } }),
      'hal8k.htm': '<table><tr><td>Diluted income per share</td><td>$</td><td>0.75</td><td>0.80</td></tr><tr><td>Diluted weighted average shares</td><td>890</td><td>880</td></tr></table>' };
    const pr = await BS3.readPr('45012', { end: '2019-12-31', cands: [{ acc: '0000045012-20-000010', filed: '2020-01-21', doc: 'hal8k.htm' }] }, async (u) => { const k = u.split('/').pop(); if (docs[k] == null) throw new Error('http_404'); return docs[k]; });
    ok(pr && pr.file === 'hal8k.htm' && pr.rows.length === 2, '(36) בלי נספח — המסמך הראשי');
  }
  console.log(`\nכל ${n} הבדיקות עברו ✓`);
  /* ---------- (37) גל 6: עוגן מחדש ועוגן חשבוני (F28), רווח והפסד ברבעונים (F20), הרבעון הרביעי אחרי התיקון (F29) ---------- */
  {
    const K = (filed, ends, rows, form, mon) => ({ form: form || '10-K', filed, is: { cols: ends.map((end) => ({ end, months: mon || 12 })), scale: { cur: 1e6 },
      rows: rows.map(([ns, tag, v]) => ({ ns, tag, label: tag, v })) } });
    const QQ = (filed, ends, rows) => K(filed, ends, rows, '10-Q', 3);
    const M = (o) => new Map(Object.entries(o).map(([e, v]) => [e, v * 1e6]));
    const PT = 'IncomeLossFromContinuingOperationsBeforeIncomeTaxes';
    // Ameriprise: ה־10-K של 2023 מדפיס 2021–2022 על הבסיס שלפני ההצגה מחדש — השרשור נשבר; ה־10-K של 2021 שווה שוב לסדרה שלנו
    const am = { a: K('2026-02-10', ['2025-12-31', '2024-12-31', '2023-12-31'], [['us-gaap', PT, [4504, 4267, 3234]]]),
      b: K('2023-02-10', ['2022-12-31', '2021-12-31', '2020-12-31'], [['us-gaap', PT, [3182, 3350, 1831]]]),
      c: K('2021-02-10', ['2020-12-31', '2019-12-31', '2018-12-31'], [['us-gaap', PT, [1831, 2232, 2484]]]),
      d: K('2019-02-10', ['2018-12-31', '2017-12-31', '2016-12-31'], [['us-gaap', 'X', [2484, 2214, 1591]]]),
      e: K('2017-02-10', ['2016-12-31', '2015-12-31', '2014-12-31'], [['us-gaap', 'X', [1591, 2142, 2547]]]) };
    const ours = M({ '2025-12-31': 4504, '2024-12-31': 4267, '2023-12-31': 3234, '2022-12-31': 3931, '2021-12-31': 4185, '2020-12-31': 1831, '2019-12-31': 2232, '2018-12-31': 2484, '2017-12-31': 2214, '2016-12-31': 1591 });
    const ra = F.bsfIs(am, 'USD', { pretax: ours });
    ok(ra.pretax.get('2015-12-31').v === 2142e6 && ra.pretax.get('2014-12-31').v === 2547e6 && !ra.pretax.has('2022-12-31'), '(37) F28 עוגן מחדש: אחרי שבירה — השורה ששווה לסדרה שלנו בשתי שנים, והשרשור ממשיך ממנה');
    // BNY: הרווח לפני מס בתגית פרטית והסדרה שלנו ריקה — R − מס = רווח נקי בכל שנה, והמס שווה לשלנו
    const bk = { a: K('2026-02-25', ['2025-12-31', '2024-12-31'], [['bk', PT, [7058, 5848]], ['us-gaap', 'IncomeTaxExpenseBenefit', [1475, 1305]], ['us-gaap', 'ProfitLoss', [5583, 4543]], ['us-gaap', 'NetIncomeLoss', [5549, 4530]]]),
      b: K('2025-02-25', ['2024-12-31', '2023-12-31'], [['bk', PT, [5848, 4283]]]) };
    const rb = F.bsfIs(bk, 'USD', { tax: M({ '2025-12-31': 1475, '2024-12-31': 1305 }) });
    ok(rb.pretax && rb.pretax.get('2025-12-31').v === 7058e6 && rb.pretax.get('2023-12-31').v === 4283e6, '(37) F28 עוגן חשבוני: רווח לפני מס − מס = רווח נקי');
    const rb2 = F.bsfIs(bk, 'USD', { tax: M({ '2025-12-31': 1400, '2024-12-31': 1305 }) });
    ok(!rb2.pretax, '(37) F28 עוגן חשבוני: המס לא שווה לשלנו — לא נוגעים');
    // F20 ברבעונים: כל רבעון פיסקלי — שרשרת משלו (ה־10-Q מדפיס את הרבעון ואת אותו רבעון שנה קודם)
    const qh = { a: QQ('2025-11-01', ['2025-09-30', '2024-09-30'], [['us-gaap', 'OperatingIncomeLoss', [120, 110]]]),
      b: QQ('2024-11-01', ['2024-09-30', '2023-09-30'], [['acme', 'OpProfit', [110, 95]]]),
      c: QQ('2025-08-01', ['2025-06-30', '2024-06-30'], [['us-gaap', 'OperatingIncomeLoss', [130, 99]]]) };
    const rq = F.bsfIs(qh, 'USD', { op: M({ '2025-09-30': 120, '2024-09-30': 110, '2025-06-30': 130 }) }, true);
    ok(rq.op.get('2023-09-30').v === 95e6 && !rq.op.has('2024-06-30'), '(37) F20 ברבעונים: שרשור לכל רבעון פיסקלי; בלי עוגן (רבעון אחד שלנו) — לא נוגעים');
    // מקצה לקצה (F29): השנתי של 2023 ‏(500 מביאור) מתוקן ל־450 המודפס; הרבעון הרביעי הנגזר (500 − 330 = 170) נגזר מחדש — 120,
    // כי שלושת הרבעונים מודפסים ב־10-Q; בלי דפי 10-Q — הרבעון הרביעי יורד (הוא מהבסיס הישן)
    const Qr = (y, a) => a.map((v, i) => [y + '-' + ['01-01', '04-01', '07-01'][i], y + '-' + ['03-31', '06-30', '09-30'][i], v, '10-Q', y + '-' + ['05-01', '08-01', '11-01'][i]]);
    const FX = facts([['Revenues', 'USD', yrs([2000e6, 2100e6, 2200e6, 2300e6], 2022).concat(Qr(2022, [500e6, 500e6, 500e6]), Qr(2023, [520e6, 520e6, 520e6]))],
      ['OperatingIncomeLoss', 'USD', [[...Y(2023), 500e6, '10-K', '2024-02-01'], [...Y(2024), 600e6, '10-K', '2025-02-01'], [...Y(2025), 650e6, '10-K', '2026-02-01']]
        .concat(Qr(2022, [90e6, 95e6, 97e6]), Qr(2023, [100e6, 110e6, 120e6]))]]);
    const ks = { a: K('2026-02-10', ['2025-12-31', '2024-12-31'], [['us-gaap', 'OperatingIncomeLoss', [650, 600]]]),
      b: K('2025-02-10', ['2024-12-31', '2023-12-31'], [['us-gaap', 'OperatingIncomeLoss', [600, 450]]]),
      c: K('2024-02-10', ['2023-12-31', '2022-12-31'], [['us-gaap', 'OperatingIncomeLoss', [450, 400]]]) };
    const qs = { q1: QQ('2023-05-01', ['2023-03-31', '2022-03-31'], [['us-gaap', 'OperatingIncomeLoss', [100, 90]]]),
      q2: QQ('2023-08-01', ['2023-06-30', '2022-06-30'], [['us-gaap', 'OperatingIncomeLoss', [110, 95]]]),
      q3: QQ('2023-11-01', ['2023-09-30', '2022-09-30'], [['us-gaap', 'OperatingIncomeLoss', [120, 97]]]) };
    const x0 = F.normalizeSec(FX, [], null, null), x1 = F.normalizeSec(FX, [], null, ks), x2 = F.normalizeSec(FX, [], null, { ...ks, ...qs });
    const qv = (d, e) => d.Q.op[d.q.indexOf(e)], av = (d, e) => d.A.op[d.fy.indexOf(e)];
    ok(qv(x0, '2023-12-31') === 170e6 && av(x0, '2023-12-31') === 500e6, '(37) הבסיס: הרבעון הרביעי נגזר מהשנתי הישן');
    ok(av(x2, '2023-12-31') === 450e6 && qv(x2, '2023-12-31') === 120e6 && x2.cfy.some((c) => c.k === 'q4fix'), '(37) F29: השנתי תוקן ושלושת הרבעונים מודפסים — הרבעון הרביעי נגזר מחדש');
    ok(av(x2, '2022-12-31') === 400e6 && qv(x2, '2022-12-31') === 118e6, '(37) F29: שנה שהתמלאה (ffill) — הרבעון הרביעי נגזר');
    ok(av(x1, '2023-12-31') === 450e6 && qv(x1, '2023-12-31') == null && x1.cfy.some((c) => c.k === 'q4drop'), '(37) F29: בלי דפי 10-Q — הרבעון הרביעי מהבסיס הישן יורד');
    // bsfiled: ‏10-Q — גם דף רווח והפסד (בלי תזרים), והגשה שכבר נשמרה בלעדיו — משלימים רק אותו
    const B4 = require('../ibkr-proxy/lib/bsfiled.js');
    const FS4 = '<FilingSummary><MyReports>' + [['R2.htm', 'Condensed Consolidated Statements of Operations'], ['R4.htm', 'Condensed Consolidated Balance Sheets'], ['R7.htm', 'Condensed Consolidated Statements of Cash Flows']]
      .map(([f, n]) => '<Report><MenuCategory>Statements</MenuCategory><HtmlFileName>' + f + '</HtmlFileName><ShortName>' + n + '</ShortName></Report>').join('') + '</MyReports></FilingSummary>';
    const RQ = (rows) => '<table><tr><th class="tl"><div><strong>X - USD ($)<br> $ in Millions</strong></div></th><th class="th">3 Months Ended<br>Sep. 30, 2025</th></tr>'
      + rows.map(([t, l, v]) => '<tr class="re"><td class="pl"><a onclick="x(\'defref_' + t + '\')">' + l + '</a></td><td class="nump">' + v + '</td></tr>').join('') + '</table>';
    const pg4 = { 'R2.htm': RQ([['us-gaap_OperatingIncomeLoss', 'Operating income', '120']]), 'R4.htm': RQ([['us-gaap_Assets', 'Total assets', '900']]), 'R7.htm': RQ([['us-gaap_DepreciationDepletionAndAmortization', 'D&A', '50']]) };
    const got4 = [], gt4 = async (u) => { got4.push(u); const m = /(R\d+\.htm)$/.exec(u); return m ? pg4[m[1]] : FS4; };
    const q1 = await B4.readOne('1', { acc: '0000000001-25-000009', form: '10-Q', filed: '2025-11-01' }, gt4);
    ok(q1.bs && q1.is && !q1.cf && q1.is.rows[0].tag === 'OperatingIncomeLoss', '(37) readOne ‏10-Q: מאזן ורווח והפסד, בלי תזרים');
    const oq0 = { form: '10-Q', filed: '2025-11-01', bs: q1.bs }, n4 = got4.length, aq = await B4.readMissing(oq0, 'https://x/', null, gt4);
    ok(aq.is && !aq.cf && got4.length - n4 === 2 && !B4.needX({ ...oq0, ...aq }), '(37) ‏10-Q ישן: רק דף רווח והפסד');
  }
  /* ---------- (38) גל 6: רווח למניה בלי "מדולל" (F30), מועמד עם שורת מניות (F31) ---------- */
  {
    const PR6 = require('../ibkr-proxy/lib/secpr.js'), B6 = require('../ibkr-proxy/lib/bsfiled.js');
    const FOXH = '<table><tr><td>(In millions, except per share data)</td><td>2019</td><td>2018</td></tr>'
      + '<tr><td>Net income attributable to stockholders per share:</td><td>$</td><td>0.73</td><td>$</td><td>0.76</td></tr>'
      + '<tr><td>Weighted average shares:</td><td>624</td><td>621</td></tr><tr><td>Dividends declared per share</td><td>0.23</td><td>0.23</td></tr></table>';
    ok(PR6.parse(FOXH).length === 0, '(38) parse: בלי "מדולל" — אין שורות');
    const fe = PR6.parseEps(FOXH);
    ok(fe.length === 2 && fe.every((x) => x.b) && fe[0].v[0] === 0.73 && PR6.isShares(fe[1]) && !fe.some((x) => /except|Dividend/.test(x.label)), '(38) F30 parseEps: רווח למניה ומניות (מסומנים b); לא כותרת "except per share" ולא דיבידנד');
    ok(!PR6.shRow({ label: 'is expected to be accretive', v: [2028] }) && PR6.shRow({ label: 'Diluted', v: [879, 870] }) && PR6.shRow({ label: 'Diluted Weighted Average Common Shares Outstanding', v: [2472.2] })
      && !PR6.shRow({ label: 'Diluted', v: [1.25, 1.09] }), '(38) shRow: שנה בתחזית — לא מניות; שורת "Diluted" במיליונים — כן');
    // F31: מועמד ראשון — תחזית עם "Diluted EPS" בלי מניות; השני — ההודעה המלאה
    const GUID = '<table><tr><td>Diluted EPS Range</td><td>12.12</td><td>12.32</td></tr></table>';
    const FULL = '<table><tr><td>Diluted earnings per share</td><td>1.10</td></tr><tr><td>Diluted weighted average shares</td><td>1770</td></tr></table>';
    const it6 = { end: '2024-12-31', cands: [{ acc: 'g', filed: '2025-01-06', doc: 'g.htm' }, { acc: 'f', filed: '2025-01-31', doc: 'f.htm' }, { acc: 'z', filed: '2025-02-20', doc: 'z.htm' }] };
    const idx6 = (n) => JSON.stringify({ directory: { item: [{ name: n, size: 5 }] } });
    const got6 = [], g6 = (pages) => async (u) => { got6.push(u); const m = /\/(\w)\/index\.json$/.exec(u); if (m) return idx6(m[1] + 'ex991.htm'); const k = /\/(\w)ex991\.htm$/.exec(u); if (k && pages[k[1]] != null) return pages[k[1]]; throw new Error('http_404'); };
    const r6 = await B6.readPr('1', it6, g6({ g: GUID, f: FULL, z: FULL }));
    ok(r6 && r6.acc === 'f' && r6.rows.some(PR6.isShares) && !got6.some((u) => /\/z\//.test(u)), '(38) F31 readPr: מועמד בלי שורת מניות — ממשיכים לבא; עוצרים בראשון שיש בו');
    const r6b = await B6.readPr('1', it6, g6({ g: GUID, f: '<p>x</p>', z: '<p>x</p>' }));
    ok(r6b && r6b.acc === 'g' && r6b.pv === B6.PR_V && !B6.prNeed(r6b), '(38) F31: אף מועמד בלי מניות — הראשון שיש בו "מדולל", ולא נקרא שוב');
    const r6c = await B6.readPr('1', it6, g6({ g: '<p>x</p>', f: FOXH, z: '<p>x</p>' }));
    ok(r6c && r6c.acc === 'f' && r6c.rows.every((x) => x.b) && !B6.prNeed(r6c), '(38) F30 readPr: בלי "מדולל" בכלל — שורות b מההודעה');
    // q4Press: שורות b רק בשנה בלי דילול (noDil), ובשנת הפסד — רק כשהרבעון הרביעי בהפסד
    const mk6 = (noDil, ani, qni) => ({ fy: ['2019-06-30'], q: ['2019-06-30'], shEst: ['2019-06-30'], derived: { eps: ['2019-06-30'] }, epsNum: {}, noDil,
      A: { sh: [621e6], ni: [ani] }, Q: { sh: [610e6], eps: [0.72], ni: [qni] } });
    const P6 = (rows) => ({ '2019-06-30': { end: '2019-06-30', filed: '2019-08-07', rows } });
    const s1 = mk6(['2019-06-30'], 1595e6, 455.5e6), c1 = F.q4Press(s1, P6(fe));
    ok(s1.Q.sh[0] === 624e6 && s1.Q.eps[0] === 0.73 && c1.length === 2, '(38) F30 q4Press: שנה בלי דילול — המניות והרווח למניה מההודעה');
    const s2 = mk6([], 1595e6, 455.5e6);
    ok(F.q4Press(s2, P6(fe)).length === 0 && s2.Q.eps[0] === 0.72, '(38) F30 q4Press: שנה עם דילול — שורות b לא נכנסות');
    const s3 = mk6(['2019-06-30'], -50e6, 455.5e6);
    ok(F.q4Press(s3, P6(fe)).length === 0, '(38) F30 q4Press: שנת הפסד ורבעון רביעי ברווח — לא');
    // noDil מ־normalizeSec: מניות בסיסיות = מדוללות (עד 0.1%) או תגית "בסיסי ומדולל"
    const nd = (b) => F.normalizeSec(facts([
      ['Revenues', 'USD', [[...Y(2022), 100, '10-K', '2023-02-01'], [...Y(2023), 100, '10-K', '2024-02-01']]],
      ['NetIncomeLoss', 'USD', [[...Y(2022), 10, '10-K', '2023-02-01'], [...Y(2023), 10, '10-K', '2024-02-01']]],
      ['WeightedAverageNumberOfDilutedSharesOutstanding', 'shares', [[...Y(2022), 1000, '10-K', '2023-02-01'], [...Y(2023), 1000, '10-K', '2024-02-01']]],
      ['WeightedAverageNumberOfSharesOutstandingBasic', 'shares', [[...Y(2022), b, '10-K', '2023-02-01'], [...Y(2023), 999.5, '10-K', '2024-02-01']]]]), []);
    ok(nd(990).noDil.join() === '2023-12-31' && nd(1000).noDil.length === 2, '(38) noDil: רק שנה שבה הבסיסיות = המדוללות');
  }
  /* ---------- (39) גל 7: F20 ברבעונים — 10-K עם עמודות רבעוניות, המשכיות לפי תגית, הגשה מאוחרת גוברת (F32); הרבעון הרביעי באותו בסיס (F33) ---------- */
  {
    const K = (filed, ends, rows, form, mon) => ({ form: form || '10-K', filed, is: { cols: ends.map((end) => ({ end, months: mon || 12 })), scale: { cur: 1e6 },
      rows: rows.map(([ns, tag, v]) => ({ ns, tag, label: tag, v })) } });
    const QQ = (filed, ends, rows) => K(filed, ends, rows, '10-Q', 3);
    const M = (o) => new Map(Object.entries(o).map(([e, v]) => [e, v * 1e6]));
    const OP = 'OperatingIncomeLoss';
    // 10-K שמדפיס רבעונים (Iron Mountain): הוא ההגשה האחרונה של 2024-Q3 (‏105 אחרי ההצגה מחדש); ה־10-Q הקודם (‏110) לא דורס אותו
    const ik = { a: K('2026-02-10', ['2025-12-31', '2025-09-30', '2024-12-31', '2024-09-30'], [['us-gaap', OP, [140, 120, 130, 105]]], '10-K', 3),
      b: QQ('2025-11-01', ['2025-09-30', '2024-09-30'], [['us-gaap', OP, [120, 110]]]),
      c: K('2026-02-10', ['2025-12-31', '2024-12-31'], [['us-gaap', OP, [500, 450]]]) };
    const ri = F.bsfIs(ik, 'USD', { op: M({ '2025-12-31': 140, '2025-09-30': 120, '2024-12-31': 130, '2024-09-30': 105 }) }, true);
    ok(ri.op && ri.op.get('2024-09-30').v === 105e6 && ri.lastF.get('2024-09-30') === '2026-02-10' && ri.printed.get('2024-09-30').includes(110e6),
      '(39) F32: ‏10-K עם עמודות של 3 חודשים בשרשור הרבעוני — ההגשה האחרונה של הרבעון');
    // המשכיות לפי תגית: ה־10-Q של 2024 הציג מחדש את 2024-Q1 (‏104 → 100) — ממשיכים באותה תגית; ‏2023-Q1 נקבע ממנו
    const tq = (tax) => ({ a: QQ('2025-05-01', ['2025-03-31', '2024-03-31'], [['us-gaap', OP, [120, 100]]]),
      b: QQ('2024-05-01', ['2024-03-31', '2023-03-31'], [['us-gaap', OP, [104, 90]]].concat(tax ? [['us-gaap', 'IncomeTaxExpenseBenefit', [100, 22]]] : [])),
      c: QQ('2023-05-01', ['2023-03-31', '2022-03-31'], [['us-gaap', OP, [90, 80]]]) });
    const ours = { op: M({ '2025-03-31': 120, '2024-03-31': 100 }) };
    const rt = F.bsfIs(tq(false), 'USD', ours, true);
    ok(rt.op.get('2023-03-31').v === 90e6 && rt.op.get('2022-03-31').v === 80e6 && rt.op.get('2023-03-31').tag === 'us-gaap:' + OP,
      '(39) F32: הצגה מחדש של הרבעון החופף — ממשיכים בשורה באותה תגית');
    const rt2 = F.bsfIs(tq(true), 'USD', ours, true);
    ok(!rt2.op.has('2023-03-31'), '(39) F32: שורה בתגית אחרת ששווה במקרה (המס = 100) — לא נלקחת כשהשורה בתגית שלנו קיימת');
    // מקצה לקצה: הערך שלנו לרבעון 2023-Q1 (‏95) הוגש ב־10-K של 2025 (ביאור רבעוני מוצג מחדש), אחרי ה־10-Q של 2024 שמדפיס ‏99 — לא
    // מוחלף. בלי ההגשה המאוחרת הערך שלנו (‏97, מביאור ב־10-Q של 2023 — לא מודפס בשום דף) מוחלף בהצגה האחרונה (‏99)
    const Qa = (y, v, filed) => [y + '-01-01', y + '-03-31', v, '10-Q', filed];
    const FX = (late) => facts([['Revenues', 'USD', yrs([2000e6, 2100e6, 2200e6], 2022).concat([Qa(2023, 500e6, '2023-05-01'), Qa(2024, 520e6, '2024-05-01'), Qa(2025, 540e6, '2025-05-01')])],
      ['OperatingIncomeLoss', 'USD', yrs([400e6, 450e6, 480e6], 2022).concat([Qa(2023, 97e6, '2023-05-01'), Qa(2024, 104e6, '2024-05-01'), Qa(2024, 104e6, '2025-05-01'), Qa(2025, 110e6, '2025-05-01')])
        .concat(late ? [Qa(2023, 95e6, '2025-02-01')] : [])]]);
    const bq = { a: QQ('2025-05-01', ['2025-03-31', '2024-03-31'], [['us-gaap', OP, [110, 104]]]), b: QQ('2024-05-01', ['2024-03-31', '2023-03-31'], [['us-gaap', OP, [104, 99]]]),
      c: QQ('2023-05-01', ['2023-03-31', '2022-03-31'], [['us-gaap', OP, [100, 90]]]) };
    const e0 = F.normalizeSec(FX(true), [], null, bq), e1 = F.normalizeSec(FX(false), [], null, bq), qv = (d, e) => d.Q.op[d.q.indexOf(e)];
    ok(qv(e0, '2023-03-31') === 95e6 && qv(e1, '2023-03-31') === 99e6, '(39) F32: ערך שלנו מהגשה מאוחרת יותר מהמקור של השרשור — נשאר; בלעדיה — ההצגה האחרונה (99)');
    // F33: השנתי של 2023 (‏450) הוצג מחדש ב־10-K של 2025; ה־10-K הראשון שאחרי הרבעונים (2024) מדפיס ‏480 — אין רבעון רביעי מחדש
    const Qr = (y, a) => a.map((v, i) => [y + '-' + ['01-01', '04-01', '07-01'][i], y + '-' + ['03-31', '06-30', '09-30'][i], v, '10-Q', y + '-' + ['05-01', '08-01', '11-01'][i]]);
    const FY = facts([['Revenues', 'USD', yrs([2000e6, 2100e6, 2200e6, 2300e6], 2022).concat(Qr(2023, [520e6, 520e6, 520e6]))],
      ['OperatingIncomeLoss', 'USD', [[...Y(2023), 500e6, '10-K', '2024-02-01'], [...Y(2024), 600e6, '10-K', '2025-02-01'], [...Y(2025), 650e6, '10-K', '2026-02-01']].concat(Qr(2023, [100e6, 110e6, 120e6]))]]);
    const k2 = (y23) => ({ a: K('2026-02-10', ['2025-12-31', '2024-12-31'], [['us-gaap', OP, [650, 600]]]), b: K('2025-02-10', ['2024-12-31', '2023-12-31'], [['us-gaap', OP, [600, 450]]]),
      c: K('2024-02-10', ['2023-12-31', '2022-12-31'], [['us-gaap', OP, [y23, 400]]]),
      q1: QQ('2023-05-01', ['2023-03-31', '2022-03-31'], [['us-gaap', OP, [100, 90]]]), q2: QQ('2023-08-01', ['2023-06-30', '2022-06-30'], [['us-gaap', OP, [110, 95]]]),
      q3: QQ('2023-11-01', ['2023-09-30', '2022-09-30'], [['us-gaap', OP, [120, 97]]]) });
    const z1 = F.normalizeSec(FY, [], null, k2(450)), z2 = F.normalizeSec(FY, [], null, k2(480)), av = (d, e) => d.A.op[d.fy.indexOf(e)];
    ok(av(z1, '2023-12-31') === 450e6 && qv(z1, '2023-12-31') === 120e6, '(39) F33: השנתי מודפס ב־10-K שאחרי הרבעונים — הרבעון הרביעי נגזר מחדש');
    ok(av(z2, '2023-12-31') === 450e6 && qv(z2, '2023-12-31') == null && z2.cfy.some((c) => c.k === 'q4drop' && c.p === '2023-12-31'),
      '(39) F33: השנתי הוצג מחדש אחרי ה־10-K הראשון — לא גוזרים מבסיסים שונים (הרבעון הישן יורד)');
    // ‏lateOf רק בערך שלנו (CoStar ‏2016-Q1): הערך שלנו (‏97) בתגית אחת מה־10-Q המקורי; ‏99 בתגית השנייה, המודפס, תויג שוב ב־10-K של 2025 —
    // זו לא "הגשה מאוחרת של הערך שלנו", והשרשור מחליף ל־‏99
    const PT1 = 'IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest', PT2 = 'IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments';
    const FP = facts([['Revenues', 'USD', yrs([2000e6, 2100e6, 2200e6], 2022).concat([Qa(2023, 500e6, '2023-05-01'), Qa(2024, 520e6, '2024-05-01'), Qa(2025, 540e6, '2025-05-01')])],
      [PT1, 'USD', yrs([400e6, 450e6, 480e6], 2022).concat([Qa(2023, 97e6, '2023-05-01'), Qa(2024, 104e6, '2024-05-01'), Qa(2025, 110e6, '2025-05-01')])],
      [PT2, 'USD', [Qa(2023, 99e6, '2023-05-01'), Qa(2023, 99e6, '2025-02-01')]]]);
    const bp = { a: QQ('2025-05-01', ['2025-03-31', '2024-03-31'], [['us-gaap', PT2, [110, 104]]]), b: QQ('2024-05-01', ['2024-03-31', '2023-03-31'], [['us-gaap', PT2, [104, 99]]]),
      c: QQ('2023-05-01', ['2023-03-31', '2022-03-31'], [['us-gaap', PT2, [99, 90]]]) };
    const p0 = F.normalizeSec(FP, [], null, bp);
    ok(p0.Q.pretax[p0.q.indexOf('2023-03-31')] === 99e6, '(39) F32: ‏lateOf — עובדה מאוחרת בערך אחר (התגית השנייה) לא שומרת על הערך שלנו');
  }
  /* ---------- (40) גל 8: המפענח — ".45" ו־"($" (PR_V 4) ---------- */
  {
    const P8 = require(path.join(root, 'ibkr-proxy/lib/secpr.js'));
    ok(P8.num('.45') === 0.45 && P8.num('(.45)') === -0.45 && P8.num('$.28') === 0.28 && P8.num('(0.45)') === -0.45 && P8.num('2,307.0') === 2307 && P8.num('.') === undefined,
      '(40) num: מספר בלי אפס מוביל (KeyCorp ‏".28")');
    // KeyCorp: התאים ".28", ".23", ".26" נבלעו בתווית, ונשארו רק עמודות האחוזים (21.7, 7.7)
    const K8 = '<table><tr><td>Income from continuing operations per common share — assuming dilution</td><td>.28</td><td>.23</td><td>.26</td><td>21.7</td><td>7.7</td></tr></table>';
    const k8 = P8.parse(K8);
    ok(k8.length === 1 && k8[0].v.join() === '0.28,0.23,0.26,21.7,7.7' && !/\.28/.test(k8[0].label), '(40) parse: ‏".28" הוא ערך, לא חלק מהתווית');
    // FedEx: ‏"($" בתא משלו, אחריו "0.26" ו־")" — הסימן נשמר (גם באמצע השורה)
    const F8 = '<table><tr><td>Diluted EPS</td><td>($</td><td>0.26</td><td>)</td><td>$</td><td>3.30</td><td>($</td><td>3.16</td><td>)</td><td>$</td><td>2.66</td></tr>'
      + '<tr><td>Diluted shares</td><td>269</td><td>283</td><td>(</td><td>5</td><td>%)</td></tr></table>';
    const f8 = P8.parse(F8);
    ok(f8[0].label === 'Diluted EPS' && f8[0].v.join() === '-0.26,3.3,-3.16,2.66' && f8[1].v.join() === '269,283,-5', '(40) parse: ‏"($" בתא משלו — המספר שאחריו שלילי');
    const t8 = P8.parseText('<p>Diluted EPS ($ 0.26) $ 3.30 ( 3.16 ) .45 Diluted shares 269 283</p>');
    ok(t8.length === 2 && t8[0].v.join() === '-0.26,3.3,-3.16,0.45' && t8[1].v.join() === '269,283', '(40) parseText: ‏"($" ו־".45" ברצף הטקסט');
    // F36 (Dollar Tree): שורת המניות שמתחת ל־"Diluted" בלי המילה "מדולל" — המדוללות; זו שמתחת ל־"Basic" — לא
    const D8 = '<table><tr><td>Net earnings (loss) per share:</td></tr><tr><td>Basic</td><td>$</td><td>(9.69</td><td>)</td><td>4.38</td></tr><tr><td>Weighted average number of shares</td><td>238.0</td><td>237.2</td></tr>'
      + '<tr><td>Diluted</td><td>$</td><td>(9.66</td><td>)</td><td>4.37</td></tr><tr><td>Weighted average number of shares</td><td>238.9</td><td>238.2</td></tr></table>';
    const d8 = P8.parse(D8);
    ok(d8.length === 2 && d8[1].v.join() === '238.9,238.2' && d8[1].ctx === 'Diluted' && P8.q4From(d8, -2307.0e6, 238.5e6, 1).sh === 238.9e6, '(40) F36: המניות מתחת ל־"Diluted" (‏238.9M), לא מתחת ל־"Basic"');
    // F34 (Gallagher): אין תגית מניות מדוללת — בסיסי + התוספת מאותה הגשה; בשנת הפסד התוספת מרחיקה את המכפלה מהרווח — נשאר הבסיסי
    const SB = 'WeightedAverageNumberOfSharesOutstandingBasic', SI = 'IncrementalCommonSharesAttributableToShareBasedPaymentArrangements';
    const G8 = (inc) => facts([['Revenues', 'USD', yrs([5000e6, 5500e6, 6000e6], 2022)], ['NetIncomeLoss', 'USD', yrs([819e6, 880e6, -100e6], 2022)],
      ['EarningsPerShareDiluted', 'USD/shares', yrs([4.2, 4.4, -0.5], 2022)], [SB, 'shares', yrs([191e6, 196e6, 200e6], 2022)]].concat(inc ? [[SI, 'shares', yrs([4e6, 4e6, 4e6], 2022)]] : []));
    const g8 = F.normalizeSec(G8(true), [], null, null), g0 = F.normalizeSec(G8(false), [], null, null);
    ok(g8.A.sh.join() === [195e6, 200e6, 200e6].join() && g8.tags.sh === SB + '+' + SI && g0.A.sh.join() === [191e6, 196e6, 200e6].join() && g0.tags.sh === SB,
      '(40) F34: בלי תגית מדוללת — בסיסי + IncrementalCommonShares… (195.0M); בהפסד — הבסיסי');
    // עם תגית מדוללת — התוספת לא נוגעת
    const G9 = facts([['Revenues', 'USD', yrs([5000e6, 5500e6], 2022)], ['NetIncomeLoss', 'USD', yrs([819e6, 880e6], 2022)], ['WeightedAverageNumberOfDilutedSharesOutstanding', 'shares', yrs([196e6, 201e6], 2022)],
      [SB, 'shares', yrs([191e6, 196e6], 2022)], [SI, 'shares', yrs([4e6, 4e6], 2022)]]);
    ok(F.normalizeSec(G9, [], null, null).A.sh.join() === [196e6, 201e6].join(), '(40) F34: יש תגית מדוללת — היא, בלי תוספת');
    // IFRS: המדוללות = AdjustedWeightedAverageShares (SAP ‏2023: ‏1,180M; הבסיסי ‏1,167M)
    const IF = { facts: { 'ifrs-full': Object.assign({ Revenue: { units: { EUR: yrs([31e9, 33e9], 2022).map(([s0, e, val, form, filed]) => ({ start: s0, end: e, val, form, filed, fy: 2099, fp: 'FY' })) } },
      ProfitLossAttributableToOwnersOfParent: { units: { EUR: yrs([2.28e9, 6.14e9], 2022).map(([s0, e, val, form, filed]) => ({ start: s0, end: e, val, form, filed, fy: 2099, fp: 'FY' })) } },
      WeightedAverageShares: { units: { shares: yrs([1170e6, 1167e6], 2022).map(([s0, e, val, form, filed]) => ({ start: s0, end: e, val, form, filed, fy: 2099, fp: 'FY' })) } },
      AdjustedWeightedAverageShares: { units: { shares: yrs([1175e6, 1180e6], 2022).map(([s0, e, val, form, filed]) => ({ start: s0, end: e, val, form, filed, fy: 2099, fp: 'FY' })) } } },
    Object.fromEntries(Array.from({ length: 25 }, (_, i) => ['Filler' + i, { units: { EUR: [] } }]))) } };
    const if8 = F.normalizeSec(IF, [], null, null);
    ok(if8 && if8.ifrs && if8.A.sh.join() === [1175e6, 1180e6].join() && if8.tags.sh === 'AdjustedWeightedAverageShares', '(40) F34: ‏IFRS — המניות המדוללות הן AdjustedWeightedAverageShares');
    // F36 רק בלי שורת מניות מדוללות מפורשת (Coca-Cola ‏Q4 2020: מתחת ל־"Diluted Net Income Per Share" — הבסיסי ‏4,300, ואחריו "Assuming Dilution" ‏4,329)
    const KO8 = '<table><tr><td>Diluted Net Income Per Share</td><td>$</td><td>0.34</td><td>$</td><td>0.47</td></tr><tr><td>Average Shares Outstanding</td><td>4,300</td><td>4,282</td></tr>'
      + '<tr><td>Effect of dilutive securities</td><td>29</td><td>40</td></tr><tr><td>Average Shares Outstanding Assuming Dilution</td><td>4,329</td><td>4,322</td></tr></table>';
    const ko8 = P8.parse(KO8);
    ok(!ko8.some((r) => r.label === 'Average Shares Outstanding') && P8.q4From(ko8, 1457e6, 4320e6, 1).sh === 4329e6, '(40) F36: יש "Assuming Dilution" — לא השורה שמתחת ל־"Diluted" (הבסיסי)');
    // F36 — מה לא: מניות לסוף תקופה (Regions), שורה מתחת ל־"Net income … basic and diluted" (TransDigm), תווית מדוללת שנשברה (Genuine Parts)
    const tb8 = (rows) => P8.parse('<table>' + rows.map((r) => '<tr>' + r.map((c) => '<td>' + c + '</td>').join('') + '</tr>').join('') + '</table>').map((r) => r.label);
    ok(tb8([['Diluted', '242.1', '241.7'], ['Actual shares outstanding at year end', '241', '240.6']]).join('|') === 'Diluted'
      && tb8([['Net income applicable to common stock - basic and diluted', '141,673', '108,157'], ['Weighted-average common shares outstanding', '53,609', '52,579']]).join('|') === 'Net income applicable to common stock - basic and diluted'
      && !tb8([['Diluted net income per common share', '1.07', '1.07'], ['Weighted average common shares outstanding', '150,552', '152,996'], ['assuming dilution', '151,355', '154,084']]).includes('Weighted average common shares outstanding'),
    '(40) F36: לא מניות לסוף תקופה, לא מתחת לשורת רווח, ולא כשיש שורה מדוללת מפורשת (גם בתווית שנשברה)');
    // התקרה (150 שורות, עד גל 8 — 40): טבלת התאמה ארוכה בראש ההודעה לא דוחקת את טבלת המניות (Air Products ‏FY2015)
    const big = '<table><tr><td>Operating Income Margin Net Income Diluted EPS</td></tr>' + Array.from({ length: 45 }, (_, i) => '<tr><td>Item ' + i + '</td><td>' + (10 + i) + '.5</td><td>.47</td></tr>').join('') + '</table>';
    const ap8 = P8.parse(big + '<table><tr><td>Diluted EPS</td><td>1.58</td></tr><tr><td>Weighted Average Common Shares Diluted (in millions)</td><td>217.7</td></tr></table>');
    ok(ap8.length === 47 && ap8[46].label === 'Weighted Average Common Shares Diluted (in millions)' && P8.q4From(ap8, 344.5e6, 217.8e6, 1).sh === 217.7e6, '(40) parse: מעבר ל־40 שורות — הטבלה עם המניות נשמרת (תקרה 150)');
    // F38 (Capital One ‏2014): ‏"Total other debt" ‏36,833 = ריפו ‏880 + ‏18,684 + ‏17,269 — סכום־ביניים כולל שורה שאינה חוב; לא נספר פעם שנייה
    const cof = { bs: { cols: [{ end: '2014-12-31' }], scale: { cur: 1e6, sh: 1 }, rows: [{ ns: 'us-gaap', tag: 'Assets', label: 'Total assets', total: true, v: [308167] },
      { ns: 'us-gaap', tag: 'Deposits', label: 'Total deposits', total: true, v: [205548] }, { ns: 'us-gaap', tag: 'SecuredDebt', label: 'Securitized debt obligations', v: [11624] },
      { ns: 'us-gaap', tag: 'FederalFundsPurchasedAndSecuritiesSoldUnderAgreementsToRepurchase', label: 'Federal funds purchased and securities loaned or sold under agreements to repurchase', v: [880] },
      { ns: 'us-gaap', tag: 'UnsecuredDebt', label: 'Senior and subordinated notes', v: [18684] }, { ns: 'us-gaap', tag: 'OtherBorrowings', label: 'Other borrowings', v: [17269] },
      { ns: 'us-gaap', tag: 'DebtExcludingSecuredDebt', label: 'Total other debt', total: true, v: [36833] }, { ns: 'us-gaap', tag: 'Liabilities', label: 'Total liabilities', total: true, v: [263114] },
      { ns: 'us-gaap', tag: 'LiabilitiesAndStockholdersEquity', label: 'Total liabilities and stockholders’ equity', total: true, v: [308167] }] } };
    ok(F.debtFace(cof, 'USD').tot.get('2014-12-31') === 47577e6, '(40) F38: ‏"Total other debt" (כולל ריפו) — סכום־ביניים, לא נספר שוב (47,577, לא 84,410)');
  }
  /* ---------- (41) גל 9: ‏F39 (סכום־ביניים בלי "Total"), ‏F40 (איגוח חייבים), ‏F41 (השורות שאחרי הסך), ‏F37 (הרבעון הרביעי מההודעה) ---------- */
  {
    const P9 = require(path.join(root, 'ibkr-proxy/lib/secpr.js')), B9 = require(path.join(root, 'ibkr-proxy/lib/bsfiled.js'));
    const row = (tag, label, v, total) => ({ ns: tag.includes(':') ? tag.split(':')[0] : 'us-gaap', tag: tag.includes(':') ? tag.split(':')[1] : tag, label, v, ...(total ? { total: true } : {}) });
    // F39 (Dominion ‏10-K ‏2017, עמודת 2016): ‏"Long-Term Debt" ‏30,231 = ‏24,878 + ‏2,980 + ‏2,373 ("Remarketable subordinated notes" — לא זוהתה כחוב)
    const dom = { bs: { cols: [{ end: '2017-12-31' }, { end: '2016-12-31' }], scale: { cur: 1e6, sh: 1 }, rows: [row('Assets', 'Total assets', [76585, 71610], 1),
      row('LongTermDebtCurrent', 'Securities due within one year', [3078, 1709]), row('ShortTermBorrowings', 'Short-term debt', [2298, 3155]),
      row('LiabilitiesCurrent', 'Total current liabilities', [9636, 8115], 1), row('LongTermLineOfCredit', 'Long-term debt', [25588, 24878]),
      row('d:SubordinatedDebtLongTermAffiliates', 'Junior subordinated notes', [3981, 2980]), row('d:RemarketableSubordinatedNotesNoncurrent', 'Remarketable subordinated notes', [1379, 2373]),
      row('LongTermDebtNoncurrent', 'Long-Term Debt', [30948, 30231]), row('DeferredTaxLiabilitiesNoncurrent', 'Deferred income taxes', [4523, 8602]),
      row('Liabilities', 'Total liabilities', [57215, 54770], 1), row('LiabilitiesAndStockholdersEquity', 'Total liabilities and equity', [76585, 71610], 1)] } };
    const d9 = F.debtFace(dom, 'USD');
    ok(d9.tot.get('2016-12-31') === 35095e6 && d9.tot.get('2017-12-31') === 36324e6, '(41) F39: סכום־ביניים בלי "Total" שכולל שורה שלא זוהתה כחוב — במקום השורות (35,095, לא 62,953)');
    // ...אבל רצף שיש בו שורה שאינה חוב במפורש (ריפו) — השורה לא נכנסת (הכלל של F38)
    const rp = JSON.parse(JSON.stringify(dom)); rp.bs.rows[6] = row('FederalFundsPurchasedAndSecuritiesSoldUnderAgreementsToRepurchase', 'Securities sold under agreements to repurchase', [1379, 2373]);
    ok(F.debtFace(rp, 'USD').tot.get('2016-12-31') === (1709 + 3155 + 24878 + 2980) * 1e6, '(41) F39: ריפו ברצף — לא סכום של חוב, השורות נשארות');
    // F40 (Targa ‏2015): ‏"Accounts receivable securitization facility" ב־CollateralizedFinancings — חוב
    const trg = { bs: { cols: [{ end: '2015-12-31' }], scale: { cur: 1e6, sh: 1 }, rows: [row('Assets', 'Total assets', [13253.7], 1),
      row('AccountsPayableAndAccruedLiabilitiesCurrent', 'Accounts payable and accrued liabilities', [657.1]), row('CollateralizedFinancings', 'Accounts receivable securitization facility', [219.3]),
      row('LiabilitiesCurrent', 'Total current liabilities', [881.6], 1), row('LongTermDebtNoncurrent', 'Long-term debt', [5718.8]),
      row('NotesReceivableNet', 'Notes receivable', [12]), row('LiabilitiesAndStockholdersEquity', 'Total liabilities and owners’ equity', [13253.7], 1)] } };
    ok(Math.abs(F.debtFace(trg, 'USD').tot.get('2015-12-31') - 5938.1e6) < 1, '(41) F40: איגוח חייבים — חוב (5,938.1); "Notes receivable" — לא');
    // F41: slim שומר את החלויות שאחרי "סך התחייבויות והון" (Seagate ‏10-Q ‏2020), ומאזן ישן בלעדיהן נקרא שוב רק כשהשוטפות לא מסתכמות
    const stx = { cols: [{ end: '2020-10-02' }], scale: { cur: 1e6, sh: 1 }, rows: [row('Assets', 'Total assets', [8000], 1), row('AccountsPayableCurrent', 'Accounts payable', [1500]),
      row('LiabilitiesCurrent', 'Total current liabilities', [1525], 1), row('LongTermDebtNoncurrent', 'Long-term debt, less current portion', [4138]),
      row('LiabilitiesAndStockholdersEquity', 'Total liabilities and equity', [8000], 1), row('LongTermDebtCurrent', 'Less: current portion of debt', [25]), row('Goodwill', 'Goodwill', [1237])] };
    const sl = B9.slim(stx), old = { ...sl, rows: sl.rows.slice(0, 5) }; delete old.t;
    ok(sl.t === 1 && sl.rows.length === 6 && sl.rows[5].tag === 'LongTermDebtCurrent' && F.debtFace({ bs: sl }, 'USD').tot.get('2020-10-02') === 4163e6, '(41) F41: slim — החלויות שאחרי הסך נשמרות (4,163)');
    ok(B9.needBs({ bs: old }) && !B9.needBs({ bs: sl }) && !B9.needBs({ bs: { ...old, rows: old.rows.map((r) => (r.tag === 'LiabilitiesCurrent' ? { ...r, v: [1500] } : r)) } }),
      '(41) F41: needBs — רק מאזן ישן שהשוטפות שלו גדולות מהשורות שלפניהן');
    const got = [];
    const gt = async (u) => { got.push(u); if (/FilingSummary/.test(u)) return '<Report><HtmlFileName>R2.htm</HtmlFileName><ShortName>Condensed Consolidated Balance Sheets</ShortName><MenuCategory>Statements</MenuCategory></Report>'; throw new Error('http_404'); };
    const rm = await B9.readMissing({ form: '10-Q', bs: old, is: { rows: [] } }, 'https://x/', null, gt);
    ok(rm && rm.bs && rm.bs.t === 1 && !B9.needBs({ bs: rm.bs }), '(41) F41: readMissing — דף שלא נמצא: מסומן t, לא נקרא שוב בכל סבב');
    // F37: שורות הרווח בהודעה (CrowdStrike ‏Q4 FY2026), והרבעון שנמחק בכוונה — מההודעה, לא מ־Yahoo
    const CR = '<table><tr><td></td><td>Three Months Ended</td><td>Year Ended</td></tr><tr><td>Net income (loss)</td><td>40,775</td><td>(86,735)</td><td>(161,165)</td><td>(12,566)</td></tr>'
      + '<tr><td>Net income (loss) attributable to non-controlling interest</td><td>2,084</td><td>(449)</td><td>1,337</td><td>2,675</td></tr>'
      + '<tr><td>Net income (loss) attributable to CrowdStrike</td><td>$</td><td>38,691</td><td>$</td><td>(86,286)</td><td>$</td><td>(162,502)</td><td>$</td><td>(15,241)</td></tr>'
      + '<tr><td>Net income (loss) per share attributable to CrowdStrike common stockholders, diluted</td><td>$</td><td>0.15</td><td>$</td><td>(0.35)</td><td>$</td><td>(0.65)</td><td>$</td><td>(0.06)</td></tr></table>';
    const ni9 = P9.parseNi(CR);
    ok(ni9.length === 2 && ni9[1].v.join() === '38691,-86286,-162502,-15241' && !ni9.some((r) => /non-controlling|per share/.test(r.label)), '(41) F37: parseNi — שורות הרווח, בלי זכויות מיעוט ובלי רווח למניה');
    const E = ['2025-04-30', '2025-07-31', '2025-10-31', '2026-01-31'];
    const mk = () => ({ fy: ['2025-01-31', '2026-01-31'], q: E.slice(), A: { ni: [-19271e3, -162502e3] }, Q: { ni: [-104264e3, -70153e3, -33997e3, null], eps: [-0.42, -0.28, -0.14, null], sh: [248e6, 250e6, 251e6, 252e6] },
      qmix: [{ k: 'qmix', m: 'ni', p: E[3], x: 'rst' }, { k: 'qmix', m: 'op', p: E[3], x: 'rst' }, { k: 'qmix', m: 'op', p: E[2], x: 'rst' }], shEst: [E[3]], derived: {}, splitsUsed: [] });
    const s9 = mk(), P = { [E[3]]: { end: E[3], ni: ni9, rows: P9.parse(CR).concat([{ t: 0, label: 'Weighted-average shares used, diluted', v: [258133, 248000, 246000, 245000] }]) } };
    const o9 = F.q4Ni(s9, P);
    ok(o9.length === 1 && s9.Q.ni[3] === 38691e3 && !s9.qmix.some((x) => x.m === 'ni') && s9.qmix.some((x) => x.m === 'op'), '(41) F37: q4Ni — הרבעון מהשורה המאומתת בעמודה השנתית (38.7M); הסימון qmix של הרווח יורד');
    F.q4Press(s9, P);
    ok(s9.Q.eps[3] === 0.15, '(41) F37: הרווח למניה של הרבעון — מאותה הודעה (0.15)');
    const s0 = mk(); s0.A.ni[1] = -170000e3;
    ok(F.q4Ni(s0, P).length === 0 && s0.Q.ni[3] == null, '(41) F37: העמודה השנתית לא שווה לשנתי שלנו — לא נוגעים');
    const s1 = mk(), y1 = { q: E.slice(), Q: { ni: [-104e6, -70e6, -34e6, 59377e3], op: [1, 2, 3, 13786e3] } }; s1.Q.op = [5, 6, null, null];
    F.yQuarterFill(s1, y1, true, []);
    ok(s1.Q.ni[3] == null && s1.Q.op[3] == null && s1.Q.op[2] === 3, '(41) F37: רבעון רביעי שנמחק בכוונה (qmix rst) — לא ממלאים מ־Yahoo; רבעון באמצע השנה — כמו קודם');
    ok(B9.prNeed({ rows: [{ label: 'Diluted EPS', v: [1] }], pv: 4 }, '2026-01-31', Date.parse('2026-11-19')) && !B9.prNeed({ rows: [{ label: 'Diluted EPS', v: [1] }], pv: 4 }, '2020-01-31', Date.parse('2026-11-19'))
      && !B9.prNeed({ rows: [{ label: 'Diluted EPS', v: [1] }], pv: 4, nv: 1 }, '2026-01-31', Date.parse('2026-11-19')), '(41) F37: prNeed — רשומה מהשנתיים האחרונות בלי nv נקראת שוב פעם אחת');
  }
})().catch((e) => { console.error('נכשל:', e.stack || e.message); process.exit(1); });
