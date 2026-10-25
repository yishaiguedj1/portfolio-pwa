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
// מאזן: הדוח השנתי גובר על השוואה בדוח רבעוני מאוחר יותר (eBay 2025)
ok(F.normalizeSec(facts([['Revenues', 'USD', yrs([1, 1], 2024)], ['Assets', 'USD', [[null, '2024-12-31', 19365, '10-K', '2025-02-01'], [null, '2025-12-31', 17610, '10-K', '2026-02-19'], [null, '2025-12-31', 17437, '10-Q', '2026-04-29']]]]), []).A.ta.join() === '19365,17610',
  'מאזן סוף שנה: ה־10-K גובר על 10-Q מאוחר שתיקן אותו לאחור');
// פיצול חברה ש־Yahoo רושם כ"ספליט" (Western Digital/Sandisk 1.323) — מספר המניות עלה רק ב־10%: לא מתקנים
{ const WD = facts([['Revenues', 'USD', yrs([1, 1, 1], 2023)], ['NetIncomeLoss', 'USD', yrs([-1700, -850, 1840], 2023)],
    ['EarningsPerShareDiluted', 'USD/shares', yrs([-5.37, -2.61, 5.12], 2023)], ['WeightedAverageNumberOfDilutedSharesOutstanding', 'shares', yrs([318, 326, 359], 2023)]]);
  ok(F.normalizeSec(WD, [['2025-02-24', 1.323]]).A.eps.join() === '-5.37,-2.61,5.12', 'פיצול חברה (1.323, מניות +10%) — הרווח למניה לא מחולק');
  const SP = facts([['Revenues', 'USD', yrs([1, 1, 1], 2023)], ['EarningsPerShareDiluted', 'USD/shares', yrs([4, 4.4, 2.3], 2023)], ['WeightedAverageNumberOfDilutedSharesOutstanding', 'shares', yrs([100, 98, 196], 2023)]]);
  ok(F.normalizeSec(SP, [['2025-03-01', 2]]).A.eps.join() === '2,2.2,2.3', 'פיצול אמיתי 2:1 (המניות קפצו פי 2) — השנים שלפני מותאמות'); }
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
  console.log(`\nכל ${n} הבדיקות עברו ✓`);
})().catch((e) => { console.error('נכשל:', e.stack || e.message); process.exit(1); });
