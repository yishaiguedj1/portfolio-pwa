// מכפיל באפט (18/11/2026, docs/buffett-pe.md): המסווג של ההודעות לעיתונות (ibkr-proxy/lib/secsbc.js), השמירה בשרתון
// (lib/bsfiled.js — load/fillSx), והחישוב במנתח (analysis.js — bufCalc, bpeOf, bfpeOf, MED). הרצה: node tests/buffett-pe.test.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

let n = 0;
const ok = (c, name) => { n++; assert(c, name); console.log('ok -', name); };
const root = path.join(__dirname, '..');
const X = require(path.join(root, 'ibkr-proxy/lib/secsbc.js'));
const BSF = require(path.join(root, 'ibkr-proxy/lib/bsfiled.js'));

/* ---------- המסווג: קטעים קצרים בתבנית של כל מקרה שנמצא בבדיקה החיה (67 חברות) ---------- */
const HEAD = 'news release. results for the three months ended september 30, 2026. net income per diluted share $1.00. ';
const C = (t) => X.classify(HEAD + t);
let r = C('gaap net income $ 277 $ 502 stock-based compensation 630 492 amortization of purchased intangibles 120 90 non-gaap net income $ 1,050 $ 980 non-gaap diluted eps $ 1.00 $ 0.92');
ok(r.er && r.ex && r.fut, 'שורת תגמול בטבלה שמסתיימת ברווח נקי מותאם — מוציא (NOW)');
r = C('cash flows from operating activities net income 36,629 adjustments to reconcile net income to net cash from operations: depreciation 11,744 stock-based compensation expense 3,134 2,983 net recognized gains');
ok(r.er && !r.ex, 'התגמול רק בדוח תזרים המזומנים — לא מוציא (MSFT)');
r = C('gaap net income 100 stock-based compensation 50 non-gaap net income 150. beginning in the first quarter of fiscal 2027, our non-gaap financial measures will no longer exclude share-based compensation expense.');
ok(r.ex && !r.fut, '"will no longer exclude" — ההודעה הזו מוציאה, מכאן והלאה לא (INTU)');
r = C("beginning in the first quarter of fiscal 2027, the company's non-gaap financial measures no longer exclude stock-based compensation expense. gaap net income 100 stock-based compensation 50 non-gaap net income 150");
ok(!r.ex && !r.fut, '"no longer exclude" — לא מוציא, גם אם יש שורה בטבלה ישנה (NVDA)');
r = C('(1) the three months ended june 30, 2026 include $19 million of stock-based compensation expense associated with restructuring activities. reconciliation of gaap net income to non-gaap net income');
ok(!r.ex, 'הערת שוליים ("associated with restructuring") לפני טבלת ההתאמה — לא נספרת (PYPL)');
r = C('operating income $ 7,286 incremental non-cash share-based compensation expense1 - - 722 adjusted eps $0.62');
ok(!r.ex, 'תגמול חד־פעמי ("incremental") — לא התגמול השוטף (WMT)');
r = C('annual effective tax rate, excluding discrete items excess stock-based compensation (3) restructuring costs 41 adjusted profit per share $ 7.13');
ok(!r.ex, 'פריט מס ("excess stock-based compensation") — לא נספר (CAT)');
r = C('adjusted ebitda excludes stock-based compensation expense, which has been, and will continue to be a significant recurring expense.');
ok(!r.ex, 'תיאור במילים על EBITDA מותאם בלבד — לא הרווח למניה (UBER, ABNB)');
r = C('we define segment profit as operating income, excluding stock compensation expense, pension and other postretirement service costs');
ok(!r.ex, 'רווח מגזרי ("segment profit ... excluding stock compensation") — לא (HON)');
r = C('to supplement our financial results presented on a gaap basis, we use the non-gaap measures indicated in the tables, which exclude certain significant expenses including stock-based compensation, expenses related to acquisitions');
ok(r.ex, 'תיאור במילים: "non-gaap measures ... exclude ... stock-based compensation" — מוציא (ORCL)');
r = C('gaap diluted net income per share $ 4.62 stock-based and deferred compensation expense 1.38 amortization of intangibles 0.15 non-gaap diluted net income per share $ 6.15');
ok(r.ex, '"stock-based and deferred compensation" — מוציא (ADBE)');
r = C('stock-based compensation expense, net of tax 459 682 803 digital assets unrealized (gain) loss non-gaap net income attributable to common stockholders 1,770');
ok(r.ex, 'שורה עם ", net of tax" ומספרים — שורה בטבלה (TSLA)');
r = C('adjusted ebitda margin was 82%. we define adjusted ebitda for a particular period as net income adjusted for loss from discontinued operations, net of income taxes, interest expense and loss on settlement of debt, other income, net (excluding certain recurring items), provision for (benefit from) income taxes, amortization, depreciation and write-offs and as further adjusted for non-operating foreign exchange (gain) loss, stock-based compensation, transaction-related expense, restructuring costs, as well as certain other items');
ok(!r.ex, 'הגדרה ארוכה של Adjusted EBITDA — המשפט כולו נבדק, לא רק 350 התווים האחרונים (APP 4Q25)');
r = C('net income on gaap basis $ 13,088 $ 9,310 amortization of acquisition-related intangible assets 2,006 1,967 stock-based compensation expense 2,019 2,092 restructuring and other charges 103 71 non-gaap tax reconciling adjustments 931 1,407 net income on non-gaap basis $ 16,372 $ 12,074');
ok(r.ex, 'טבלה בצורה "net income on non-gaap basis" — מוציא (AVGO)');
r = C('gross margin on gaap basis $ 20,456 amortization of acquisition-related intangible assets 1,499 stock-based compensation expense 224 restructuring charges 12 gross margin on non-gaap basis $ 22,191');
ok(!r.ex, 'שורה בטבלת הרווח הגולמי ("gross margin on non-gaap basis") — לא הרווח למניה');
r = C('(1) non-gaap adjustment for the number of shares used in the diluted per share calculations excludes the impact of stock-based compensation expense expected to be incurred in future periods');
ok(!r.ex, 'הערת שוליים על מספר המניות — לא עדות (זה מה ש"זיהה" את AVGO במקרה לפני התיקון)');
ok(!X.classify('investor day presentation. our strategy for the decade.').er, 'הודעה בלי רבעון ורווח למניה — לא הודעת תוצאות');
ok(X.classify('exxonmobil announces third-quarter 2026 results. earnings per share assuming dilution $1.88 net income attributable').er, 'הודעת תוצאות גם בלי "diluted" כמילה (XOM, MRK)');
ok(X.classify('<p>GAAP net income</p><td>277</td><p>Stock-based compensation</p><td>630</td><p>Non-GAAP net income</p><td>1,050</td><p>three months ended</p><p>diluted per share</p>').ex, 'HTML — מנוקה לפני הסיווג');

/* ---------- גל 2 (SV=6): ארגון מחדש ורכישות, שורות תגמול נוספות, הרווח המותאם, AFFO ורווחי השקעות ---------- */
r = C('(in millions, except per share data) three months ended september 30, 2026 2025 gaap net income $ 502 $ 503 stock-based compensation 633 492 amortization of purchased intangibles 198 33 business combination and other related costs 35 19 impairment of assets - - severance costs 87 24 (gains) losses on strategic investments, net (3) (7) income tax effects (180) (150) non-gaap net income $ 1,050 $ 980 non-gaap net income per share - diluted (2)(3) $ 1.00 $ 0.95. non-gaap diluted eps of $1.00');
ok(JSON.stringify(r.rx) === JSON.stringify([[2, 35, 19], [1, 87, 24]]) && r.u === 1e6 && r.yo === 1 && r.ae === 1, 'שורות ארגון מחדש ורכישה בגישור לרווח המותאם (NOW): בלי הפחתה ובלי השקעות; היחידות, סדר השנים והרווח המותאם');
r = C('non-gaap income from operations reconciliation restructuring costs 40 10 non-gaap operating income $ 900 $ 800');
ok(r.rx == null, 'שורת ארגון מחדש שהיעד שלה הרווח התפעולי — לא נספרת');
r = C('net cash provided by operating activities net income 100 restructuring charges 40 10 non-gaap net income 150');
ok(r.rx == null, 'ארגון מחדש בדוח התזרים — לא');
r = C('(in thousands) gaap net income 1,000 transaction-related and non-operating items 47,409 236,431 amortization and other acquisition-related costs 182 104 adjusted net income $ 1,273,602');
ok(r.rx == null, 'שורה מעורבת ("non-operating") והפחתה שקשורה לרכישה — לא ארגון מחדש ורכישות (KKR, ‏CAH)');
r = C('(in thousands) net income attributable to kkr 900,000 equity-based compensation - time based 63,287 58,270 equity-based compensation - market condition 88,437 117,832 amortization of acquired intangibles 715 12,695 adjusted net income $ 1,273,602 $ 1,645,493');
ok(JSON.stringify(r.sa) === JSON.stringify([63287, 58270]) && JSON.stringify(r.so) === JSON.stringify([[88437, 117832]]), 'שורת תגמול נוספת באותה טבלה (KKR, ‏market condition) — so, לא שורת התגמול הרגילה');
r = C('gaap net income 1,000 equity-based compensation - other 90,715 86,026 equity-based compensation - acquisition-related 80,652 83,257 equity-based compensation - business combination grants 20,935 16,592 distributable earnings 385,460 341,002');
ok(r.so && r.so.length === 2 && r.so[0][0] === 80652 && r.so[1][0] === 20935, 'שתי שורות תגמול נוספות (Blue Owl)');
r = C('gaap net income 100 share-based compensation 517 355 share-based compensation-related charges 12 4 non-gaap net income per share, diluted $ 0.85 $ 0.75 share-based compensation - per share 0.64 0.52');
ok(r.so == null, 'שורת "related charges" ושורה למניה — לא שורות תגמול נוספות (PANW)');
r = C('adjusted eps guidance to at least $8.20 from a range of $7.90 to $8.10. adjusted eps (2) $ 2.09 $ 1.60 at least $8.20. adjusted eps of $2.09 increased from $1.60');
ok(r.ae === 2.09, 'הרווח המותאם — הערך השכיח, לא התחזית ולא הטווח (CVS)');
r = C('fee related earnings per adjusted share of $1.15. adjusted net income per adjusted share of $1.41, up from $1.18');
ok(r.ae === 1.41, 'מנהלות השקעות: ANI למניה מותאמת, לא FRE (KKR)');
r = C('fre per adjusted share $ 1.15 $ 1.42 ani per adjusted share $ 1.41 $ 1.78');
ok(r.ae == null, 'רווח מותאם רק מטקסט רץ — בטבלה העמודה והתקופה לא ודאיות (BX, APO, EMR)');
r = C('adjusted funds from operations ( affo ) increased 3.7% to $1.12 per share. normalized ffo per share $ 1.10 $ 1.09 affo per share $ 1.12 $ 1.08. raising our 2026 affo per share guidance to $4.45-$4.46');
ok(r.af === 1.12 && r.ae == null, 'AFFO למניה (Realty Income) — לא התחזית');
r = C('affo attributable to amt common stockholders per share $ 2.87 3.2 %');
ok(r.af === 2.87, 'AFFO למניה אחרי "attributable to" (AMT)');
r = C('for q3 2026, the net effect of the loss on equity securities of $8.7 billion decreased the provision for income tax, net income, and diluted net income per common share by $1.9 billion, $6.7 billion, and $0.55, respectively.');
ok(r.ig === -0.55, 'השפעת הפסד על ניירות ערך הוניים למניה — עם סימן (Alphabet)');
r = C('for q2 2026, the net effect of the gain on equity securities of $99.0 billion increased the provision for income tax, net income, and diluted net income per common share by $21.9 billion, $77.1 billion, and $6.26, respectively.');
ok(r.ig === 6.26, 'השפעת רווח — חיובית');

/* ---------- בחירת ההודעות והתשובה ללקוח ---------- */
const sub = { filings: { recent: {
  form: ['8-K', '10-Q', '8-K', '8-K', '8-K'], items: ['2.02,9.01', '', '7.01', '2.02', '2.02'],
  accessionNumber: ['0000001-26-000009', '0000001-26-000008', '0000001-26-000007', '0000001-26-000005', '0000001-23-000001'],
  filingDate: ['2026-10-28', '2026-10-29', '2026-09-01', '2026-07-22', '2023-07-20'], primaryDocument: ['a.htm', 'q.htm', 'b.htm', 'c.htm', 'd.htm'],
  reportDate: ['2026-10-28', '2026-09-30', '', '', ''] } } };
const pk = X.pick(sub, Date.parse('2026-11-18'));
ok(pk.length === 2 && pk[0].acc === '0000001-26-000009' && pk[1].filed === '2026-07-22', 'pick — רק 8-K עם 2.02 משלוש השנים האחרונות (DAYS 1100, גל 2), החדש קודם');
const fc = X.forClient({ a: { filed: '2026-10-28', er: true, ex: true, fut: false, n: 900, sv: X.SV }, b: { filed: '2026-07-22', er: true, ex: false, fut: false, n: 800, sv: X.SV },
  c: { filed: '2026-09-01', er: false, ex: false, fut: false, sv: X.SV }, d: { filed: '2026-04-22', er: true, ex: true, fut: true, sv: X.SV - 1 },
  e: { filed: '2026-01-28', er: true, ex: true, fut: true, n: 950, tr: 0.21, sa: [633, 492], nt: 0, qe: '2025-12-31', tb: 1, ns: 1.6e9, pp: 1, sv: X.SV } });
ok(JSON.stringify(fc) === JSON.stringify([['2026-01-28', 1, 1, 950, 0.21, [633, 492], 0, '2025-12-31', 0, 1, 1.6e9, 1, null, 0, 0, null, null, null, null], ['2026-04-22', 1, 1, 0, null, null, 0, null, 0, 0, null, 0, null, 0, 0, null, null, null, null], ['2026-07-22', 0, 0, 800, null, null, 0, null, 0, 0, null, 0, null, 0, 0, null, null, null, null], ['2026-10-28', 1, 0, 900, null, null, 0, null, 0, 0, null, 0, null, 0, 0, null, null, null, null]]),
  'forClient — רק הודעות תוצאות, מהישנה לחדשה; גרסת מסווג קודמת נשלחת עד הקריאה מחדש (בלי שיעור מס, סכום ורבעון); מגרסה 3 — גם הם');
// סוף הרבעון שההודעה מדווחת עליו: המאוחר שלפני ההגשה — לא השנה הקודמת (APA), לא רבעון התחזית (CRM)
ok(X.classify('year ended december 31, 2025 results … three months ended september 30, 2026 net income', '2026-11-04').qe === '2026-09-30', 'סוף הרבעון — התאריך המאוחר שלפני ההגשה, לא "year ended" הקודם (APA)');
ok(X.classify('guidance for the quarter ended october 31, 2026 … three months ended july 31, 2026 2025', '2026-08-26').qe === '2026-07-31', 'סוף הרבעון — לא רבעון התחזית שאחרי ההגשה (CRM)');
ok(X.classify('marvell\'s actual results for the quarter ended october 31, 2026 may differ from these preliminary estimates', '2026-11-02').qe === '2026-10-31', 'הודעת מיזוג עם הכנסות מקדימות — הרבעון שלה (Marvell)');

/* ---------- גרסה 3 (19/11/2026, גל 1 של שיטת באפט — docs/buffett-method-research.md §13.1, §13.11): שיעור המס שהחברה מצהירה,
   והמספרים בשורת התגמול בגישור. הנוסחים — מההודעות האמיתיות (22 חברות) ---------- */
const TRS = [
  ['based on our long-term projections, we are using a non-gaap tax rate of 21% for the three and nine months ended september 30, 2026 and 20% for the three', 0.21, 'NOW'],
  ["the company's non-gaap tax provision uses a long-term projected tax rate of 20.5%, which reflects currently available information", 0.205, 'CRM'],
  ['(1) income tax effect is based on an estimated long-term annual effective tax rate of 23.0% for the period presented.', 0.23, 'PLTR'],
  ['effective income tax rate gaap effective income tax rate 22.5 % income tax adjustments (1.5) non-gaap effective income tax rate (*) 18.0 %', 0.18, 'ADBE'],
  ['$759 million $611 million 24% effective tax rate 19.2% 24.1% non-gaap effective tax rate 18.5% 21.9% diluted eps', 0.185, 'CAH'],
  ['interest other approximately $120 million adjusted income tax rate 21%* weighted average shares outstanding', 0.21, 'FLEX'],
  ['primarily due to higher revenue. non-gaap effective tax rate for the third quarter was 17.0%. commitments we have', 0.17, 'NVDA'],
  ['represents an adjustment to arrive at our fixed estimated non-gaap tax rate of 12.5% for the fourth quarter of fiscal 2026', 0.125, 'QCOM'],
];
for (const [t, v, nm] of TRS) ok(Math.abs(X.classify(t).tr - v) < 1e-9, 'שיעור המס שהחברה מצהירה — ' + nm + ' (' + v * 100 + '%)');
ok(X.classify('for the full year fiscal 2027, nvidia expects gaap and non-gaap tax rates to be between 16.0% and 18.0%, excluding any discrete items').tr === null,
  'תחזית שנתית ברבים ("tax rates to be between") — לא שיעור');
ok(Math.abs(X.classify('for fiscal 2027 we expect a non-gaap tax rate of 19%. results: the non-gaap effective tax rate for the quarter was 17.5% compared to').tr - 0.175) < 1e-9,
  'הצהרה בתוך תחזית ("expect") — רק כשאין אחרת; השיעור של הרבעון קודם');
ok(X.classify('gaap effective tax rate 22.5% operating margin').tr === null, 'שיעור ה־GAAP — לא נלקח');
ok(Math.abs(X.classify('three fiscal quarters ended provision for income taxes on gaap basis $ 2,187 $ 820 non-gaap tax reconciling adjustments 931 1,407 provision for income taxes on non-gaap basis $ 3,118 $ 2,227 net income on gaap basis $ 13,088 net income on non-gaap basis $ 16,372 $ 12,074').tr - 0.16) < 1e-9,
  'בלי הצהרה — השיעור המשתמע: הפרשה ÷ (רווח + הפרשה) בטבלת הגישור (Broadcom ‏16.0%)');
ok(X.classify('non-gaap net income of $16.4 billion and non-gaap provision for income taxes of $3.1 billion').tr === null, 'במילים ("of $16.4 billion") — לא שורה בטבלה, לא נלקח');
let c3 = X.classify('three months ended october 31, 2026 2025 gaap net income $ 482 $ 334 share-based compensation-related charges 622 387 acquisition-related costs (1) 55 5 amortization expense of acquired intangible assets 282 39 non-gaap net income $ 881 $ 662 diluted');
ok(c3.ex && JSON.stringify(c3.sa) === '[622,387]' && c3.nt === 0, 'הסכום בשורה: "‎-related charges 622 387" — עמודת הרבעון והשוואה (PANW)');
c3 = X.classify('q3 fy27 guidance gaap diluted net income per share range (1)(2) $1.81 - $1.83 plus amortization of purchased intangibles $ 0.57 stock-based compensation expense $ 1.29 restructuring (3) $ 0.12 non-gaap diluted net income per share $2.86 - $2.88 '
  + 'three months ended july 31, 2026 2025 gaap net income $ 3,526 $ 1,887 plus amortization of purchased intangibles (1) 522 380 stock-based compensation expense (2)(3) 904 793 restructuring and acquisition-related costs 115 4 non-gaap net income $ 4,500 $ 3,000');
ok(c3.ex && JSON.stringify(c3.sa) === '[904,793]', 'טבלת תחזית (CRM: "range … $ 1.29") — מדולגת; הסכום מטבלת הרבעון שדווח');
c3 = X.classify('three months ended gaap net income 1,021 share-based compensation expense 543 521 485 - 1,549 net (gain) loss on debt securities 5 non-gaap net income $ 2,000 diluted');
ok(JSON.stringify(c3.sa) === '[543,521,485,1549]', 'רבעוני השנה זה לצד זה (INTU) — כל המספרים, והלקוח בוחר מול XBRL; מקף ריק — מדולג');
c3 = X.classify('three months ended amortization and other acquisition-related costs 182 104 acquisition-related cash and share-based compensation costs 94 64 impairments (4) 2 non-gaap net earnings attributable to cardinal health $ 600 diluted');
ok(!c3.ex && c3.sa === null, 'שורת רכישות ("acquisition-related cash and share-based compensation costs") — לא התגמול השוטף; לא "מוציא" (CAH)');
c3 = X.classify('three months ended gaap net income 100 stock-based compensation expense, net of tax 50 40 non-gaap net income 150 diluted');
ok(c3.ex && JSON.stringify(c3.sa) === '[50,40]' && c3.nt === 1, 'שורה "net of tax" — מסומנת (כבר אחרי מס)');
// בדיקת העומק, גל 2 (B-026, ‏B-027): שורת מס ומשפט מס; מדדי מנהלות השקעות; כמה שורות תגמול; המס של המדד כולל את הטבת המס (tb)
c3 = X.classify('three months ended gaap net income 1,500 income tax effect of share-based compensation (20) non-gaap net income 1,700 diluted. the non-gaap tax rate includes the normalized tax benefit of share-based compensation');
ok(!c3.ex, 'שורת "income tax effect of share-based compensation" ומשפט "tax benefit of" — לא עדות (AMAT, ‏B-026)');
c3 = X.classify('three months ended net income attributable to ares management corporation 200 equity compensation expense 150,720 123,821 469,105 383,004 amortization of intangibles 48,176 realized income 500 after-tax realized income per share 1.26');
ok(c3.ex && JSON.stringify(c3.sa) === '[150720,123821,469105,383004]', '"realized income" — יעד (ARES, ‏B-027)');
c3 = X.classify('three months ended net income attributable to blackstone inc. 600 equity-based compensation (h) 301,562 358,364 561,217 353,753 329,217 1,084,882 1,244,187 1,368,031 taxes and related payables (77,484) distributable earnings 1,900');
ok(c3.ex && c3.sa.length === 8 && c3.sa[4] === 329217, '"distributable earnings" (BX) — יעד; עד 8 מספרים בשורה');
c3 = X.classify('three months ended gaap income before income taxes 94,247 equity-based compensation - other 90,715 86,026 92,983 81,541 80,807 351,265 equity-based compensation - acquisition-related 80,652 fee-related earnings 300');
ok(c3.ex && c3.sa[0] === 90715 && c3.sa.length === 6, '"fee-related earnings" — יעד (Blue Owl: ה־DE רחוק); שורה עם תיאור אחרי מקף — הראשונה');
ok(!X.classify('three months ended gaap net income 100 stock-based compensation 40 unrealized income on investments 5 adjusted ebitda 300').ex, '"unrealized income" — לא יעד');
c3 = X.classify('three months ended net income 900 equity-based compensation - time based 63,287 58,270 205,314 equity-based compensation - market condition 88,437 117,832 259,548 adjusted net income 1,273,602. income taxes on adjusted earnings includes the benefit of tax deductions arising from equity-based compensation, which reduces income taxes');
ok(c3.ex && JSON.stringify(c3.sa) === '[63287,58270,205314]' && c3.tb === 1, 'KKR — השורה הרגילה (time based), והמס של המדד כולל את הטבת המס (tb)');
const TBS = [['our methodology uses the tax benefits from certain expenses that are not included in these non-gaap metrics, such as equity-based compensation from the vesting', 'ARES'],
  ['this adjustment reflects the benefit of deductions available to the company on certain expense items that are excluded from the underlying calculation of distributable earnings, such as equity-based compensation', 'CG'],
  ['current income taxes payable reflect the benefit of tax deductions that are excluded when calculating distributable earnings (e.g., equity-based compensation expenses, transaction expenses', 'OWL']];
// B-030 ‏(Ciena): "adjusted (non-gaap)" עם סוגריים; התגמול מפוצל לפי פונקציה בגישור ההוצאות, והסך עובר לגישור הרווח הנקי (בשרשרת)
const CIEN = 'three months ended operating expense reconciliation (gaap non-gaap) gaap operating expense $ 458,086 $ 429,544 share-based compensation-research and development 20,173 16,749 share-based compensation-sales and marketing 16,623 13,277 total adjustments related to operating expense 58,056 49,360 adjusted (non-gaap) operating expense $ 400,030 $ 380,184 income from operations reconciliation (gaap non-gaap) gaap income from operations $ 301,179 total adjustments related to operating expense 58,056 total adjustments related to income from operations 74,549 adjusted (non-gaap) income from operations $ 375,728 net income reconciliation (gaap non-gaap) gaap net income $ 266,418 $ 50,308 exclude gaap provision for income taxes 44,203 15,511 income before income taxes 310,621 65,819 total adjustments related to income from operations 74,549 57,561 adjusted income before income taxes 384,593 123,380 non-gaap tax provision on adjusted income before income taxes 76,919 27,144 adjusted (non-gaap) net income $ 307,674 $ 96,236 diluted';
c3 = X.classify(CIEN);
ok(c3.ex && c3.sa === null && Math.abs(c3.tr - 0.2) < 1e-9, 'גישור בשרשרת (CIEN, ‏B-030) — מוציא; פיצול לפי פונקציה — בלי שורה (הסכום מה־XBRL); השיעור המשתמע 20%');
ok(!X.classify(CIEN.replace('total adjustments related to income from operations 74,549 57,561 ', '')).ex, 'בלי שורת הסך בגישור הרווח הנקי — התגמול בגישור התפעולי לבד אינו עדות');
ok(X.classify('three months ended gaap net income 100 stock-based compensation 40 adjusted (non-gaap) net income 140 diluted').ex, '"adjusted (non-gaap) net income" — יעד');
const NSS = [['distributable earnings ( de ) of $1.7 billion ($1.32/share) in the quarter', 1.288e9, 'BX'], ['distributable earnings of $385.5 million, or $0.24 per adjusted share capital metrics', 1.606e9, 'OWL'],
  ['adjusted net income ( ani ) of $1.6 billion ($1.78/adjusted share)', 0.899e9, 'KKR']];
for (const [t, v, nm] of NSS) ok(Math.abs(X.classify('three months ended net income 900 equity-based compensation 63 distributable earnings 1,200 adjusted net income 1,100. ' + t).ns / v - 1) < 0.001, 'בסיס המניות של המדד למניה — ' + nm);
ok(X.classify('three months ended gaap net income 100 stock-based compensation 50 non-gaap net income 150 diluted. net income of $1.2 billion, or $1.10 per diluted share').ns === null, 'רווח נקי GAAP "or $ per share" — לא בסיס של המדד');
for (const [t, nm] of TBS) ok(X.classify('three months ended net income 900 equity-based compensation 63 distributable earnings 1,200. ' + t).tb === 1, 'tb — ' + nm);
ok(X.classify('three months ended gaap net income 100 stock-based compensation expense 50 non-gaap net income 150 diluted. the non-gaap provision for income taxes excludes the tax benefits of stock-based compensation').tb === 0,
  'מס non-GAAP שמוציא את הטבת המס על התגמול — לא tb');
// B-034 עד B-036: הטבת מס עודפת "associated with" (גם עם קיצור במרכאות); חלק מהתגמול ("certain", ‏"portion of", קשור לרכישה); "adjusted net loss"
const ADJ = 'three months ended gaap net income 100 amortization 30 adjusted net income 130 diluted. ';
const DGX = 'the term adjusted refers to non-gaap operating performance measures that exclude special items such as restructuring and integration charges, amortization expense, ';
for (const [t, nm] of [[DGX + 'and excess tax benefits ("etb") associated with stock-based compensation. the company', 'קיצור במרכאות'],
  [DGX + 'excess tax benefits ( etb ) associated with stock-based compensation, gains and losses', 'קיצור בסוגריים']])
  ok(!X.classify(ADJ + t).ex, 'הטבת מס עודפת על התגמול — לא עדות (DGX, ‏B-034, ' + nm + ')');
for (const [t, nm] of [['adjusted net income excludes certain share-based compensation expenses', 'certain'], ['adjusted net income excludes a portion of the stock-based compensation expense', 'portion of'],
  ['adjusted net income excludes stock-based compensation related to the acme acquisition', 'רכישה'], ['adjusted net income excludes share-based compensation expense associated with our ipo', 'הנפקה']])
  ok(!X.classify(ADJ + t).ex, 'חלק מהתגמול בלי סכום — לא עדות (' + nm + ', ‏B-035)');
const CMC = 'three months ended net income attributable to comcast corporation $ 3,295 amortization 600 adjusted net income $ 3,895 diluted. net income attributable to comcast corporation includes $61 million, $46 million net of tax, related to certain share-based compensation expenses';
c3 = X.classify(CMC);
ok(c3.ex && c3.pp === 1 && JSON.stringify(c3.sa) === '[61000000]' && c3.nt === 0, 'חלק מהתגמול עם סכום (CMCSA, ‏B-035) — מוציא, והסכום לפני מס בדולרים (pp)');
ok(!X.classify(CMC.replace('$61 million, $46 million net of tax, related to certain share-based compensation expenses', '$123 million, $92 million net of tax, of other adjustments, which includes a gain related to a legal settlement and certain share-based compensation expenses')).ex,
  'סכום מעורב ("other adjustments, which includes … certain") — לא');
ok(X.classify(ADJ + 'stock-based compensation 40. ' + CMC).pp === 0, 'עדות מלאה בהודעה — לא חלקי');
c3 = X.classify('three months ended net loss $ (110) stock-based compensation 160 adjusted net loss $ (529) diluted');
ok(c3.ex, '"adjusted net loss" — יעד (CRWV, ‏B-036)');
// B-037 ‏(Con Edison): שורת גורם שינוי ב־EPS — לא הוצאה. ‏B-038 ‏(Emerson): מדד של התגמול עצמו, וחלק השילוב בטבלה — חלקי עם הסכום
const ED = 'three months ended reported eps (gaap basis) 1.30 diluted. variation for the three months ended september 30, 2025 vs. 2024 net income for common stock (net of tax) (millions of dollars) earnings per share higher electric rate base $37 $0.11 lower commercial paper interest expense 14 0.04 lower stock based compensation 13 0.04 lower state and local taxes other than income 7 0.02 total cecony 102 0.22 adjusted eps (non-gaap basis) 1.62 1.51';
ok(!X.classify(ED).ex, 'שורת גורם שינוי "lower stock based compensation" — לא עדות (ED, ‏B-037)');
ok(!X.classify(ED.replace('lower stock', 'higher stock')).ex, 'גם "higher …"');
const EMR = 'three months ended net earnings 1,000 adjusted earnings per share 1.52 diluted. table 5 adjusted corporate and other supplemental (dollars in millions, unaudited) the following table shows the company\'s stock compensation and corporate and other expenses on an adjusted basis. the company\'s definition of adjusted stock compensation excludes integration-related stock compensation expense. this metric is useful for reconciling from total adjusted segment ebita to the company\'s consolidated adjusted ebita. quarter ended march 31, 2025 2026 stock compensation (gaap) $ (59) $ (57) integration-related stock compensation expense 9 1 4 adjusted stock compensation (non-gaap) $ (50) $ (53) quarter ended march 31, 2025 2026 corporate and other (gaap) $ (238) $ (51) 1 integration-related stock compensation expense for the three months ended march 31, 2025 relates to aspentech. adjusted earnings per share excludes intangibles amortization and restructuring';
c3 = X.classify(EMR);
ok(c3.ex && c3.pp === 1 && JSON.stringify(c3.sa) === '[4000000]', 'מדד "adjusted stock compensation" — לא יעד; חלק השילוב בטבלה — חלקי, הרבעון הנוכחי (2026 — האחרון), במיליונים (EMR, ‏B-038)');
c3 = X.classify(EMR.replace(/2025 2026/g, '2026 2025').replace('expense 9 1 4', 'expense 4 9 1'));
ok(c3.pp === 1 && JSON.stringify(c3.sa) === '[4000000]', 'שנים מהחדש לישן — הראשון');
ok(!X.classify(EMR.replace('(dollars in millions, unaudited)', '')).ex, 'בלי יחידות לפני הטבלה — לא (לא מנחשים)');

/* ---------- tagQ (fundamentals.js): סדרה רבעונית מתגית אחת — ישיר, מצטבר פחות מצטבר מאותה התחלה, שנה פחות שלושה רבעונים ---------- */
{
  const FU = require(path.join(root, 'ibkr-proxy/lib/fundamentals.js'));
  const f = { dur: new Map([['2026-07-01|2026-09-30', { v: 120 }], ['2026-01-01|2026-06-30', { v: 210 }], ['2026-01-01|2026-03-31', { v: 100 }],
    ['2025-01-01|2025-03-31', { v: 80 }], ['2025-04-01|2025-06-30', { v: 85 }], ['2025-07-01|2025-09-30', { v: 90 }], ['2025-01-01|2025-12-31', { v: 350 }]]) };
  const r = FU.tagQ(f, ['2025-12-31', '2026-03-31', '2026-06-30', '2026-09-30', '2026-12-31']);
  ok(r['2026-09-30'] === 120 && r['2026-03-31'] === 100 && r['2026-06-30'] === 110 && r['2025-12-31'] === 95 && !('2026-12-31' in r),
    'tagQ — רבעון ישיר, חצי שנה פחות רבעון, שנה פחות שלושה רבעונים; בלי ערך — חסר (לא מתגית אחרת)');
  ok(FU.BX_TAGS.length === 6 && FU.BX_TAGS[4] === 'EquitySecuritiesFvNiGainLoss' && FU.BX_TAGS[0] === 'AllocatedShareBasedCompensationExpense' && FU.BX_TAGS[1] === 'ShareBasedCompensation', 'סדר התגיות של bx — כמו ב־sbcAmt');
}

/* ---------- השמירה בשרתון: load קורא עד 2 הודעות חדשות, שומר ב־o.sx, ומחזיר sx ---------- */
(async () => {
  const mem = new Map(), store = { get: (k) => mem.get(k), put: (k, v) => mem.set(k, JSON.parse(JSON.stringify(v))) };
  const REL = '<html><p>three months ended september 30, 2026</p><p>diluted per share</p><p>GAAP net income</p><td>277</td><p>Stock-based compensation</p><td>630</td><p>Non-GAAP net income</p><td>1,050</td></html>';
  const urls = [];
  const getText = async (u) => {
    urls.push(u);
    if (/index\.json$/.test(u)) return JSON.stringify({ directory: { item: [{ name: 'ex99-1.htm', size: 5000 }, { name: 'a.htm', size: 9000 }] } });
    if (/ex99-1\.htm$/.test(u)) return REL;
    throw new Error('http_404');
  };
  const out = await BSF.load('1234', sub, { store, getText, now: Date.parse('2026-11-18') });
  ok(out && Array.isArray(out.sx) && out.sx.length === 2 && out.sx[1][0] === '2026-10-28' && out.sx[1][1] === 1 && out.sx[1][2] === 1, 'load — שתי הודעות התוצאות נקראו, סווגו (מוציא) והוחזרו');
  const saved = mem.get(BSF.key('1234'));
  ok(saved && saved.sx && Object.keys(saved.sx).length === 2 && saved.sx['0000001-26-000009'].sv === X.SV, 'load — נשמר באובייקט של החברה ב־R2 (שדה sx)');
  const n0 = urls.length;
  await BSF.load('1234', sub, { store, getText, now: Date.parse('2026-11-18') });
  ok(urls.filter((u) => /index\.json|ex99/.test(u)).length === urls.slice(0, n0).filter((u) => /index\.json|ex99/.test(u)).length, 'load שני — הודעות שכבר נקראו לא נקראות שוב');
  // הודעה ישנה שיצאה מהחלון — נמחקת
  const o2 = { v: BSF.V, f: {}, sx: { '0000001-20-000001': { filed: '2020-01-01', er: true, ex: true, fut: true, sv: X.SV } } };
  await BSF.fillSx('1234', sub, o2, { getText, now: Date.parse('2026-11-18') }, 6);
  ok(!o2.sx['0000001-20-000001'] && Object.keys(o2.sx).length === 2, 'fillSx — רק שלוש השנים האחרונות נשמרות');

  /* ---------- החישוב במנתח ---------- */
  const src = fs.readFileSync(path.join(root, 'analysis.js'), 'utf8');
  const sb = { console, Date, Math, JSON };
  vm.createContext(sb);
  vm.runInContext(src.replace(/^export (async )?(function|const)/gm, '$1$2') + '\n;globalThis.A = _test;', sb);
  const A = sb.A;
  A.setEnv({ t: (k) => k });
  // חברה סינתטית: 6 שנים + רבעון בשנה הפתוחה; רווח 20% מההכנסות, מס 20%, תגמול במניות 2% מההכנסות, מיליארד מניות
  const fy = ['2020-12-31', '2021-12-31', '2022-12-31', '2023-12-31', '2024-12-31', '2025-12-31'];
  const rev = [100, 110, 121, 133, 146, 161].map((x) => x * 1e9);
  const A0 = { rev, op: rev.map((x) => x * 0.25), ni: rev.map((x) => x * 0.2), pretax: rev.map((x) => x * 0.25), tax: rev.map((x) => x * 0.05),
    eps: rev.map((x) => x * 0.2 / 1e9), sh: fy.map(() => 1e9), ocf: rev.map((x) => x * 0.3), capex: rev.map((x) => x * 0.08), sbc: rev.map((x) => x * 0.02),
    dep: rev.map((x) => x * 0.05), cash: fy.map(() => 30e9), debt: fy.map(() => 20e9), eq: rev.map((x) => x * 0.9) };
  const INST = new Set(['cash', 'debt', 'eq', 'sh']), q = [], Q = {};
  for (const k in A0) Q[k] = [];
  fy.forEach((e, i) => ['03-31', '06-30', '09-30', '12-31'].forEach((md) => { q.push(e.slice(0, 4) + '-' + md); for (const k in A0) Q[k].push(INST.has(k) ? A0[k][i] : A0[k][i] / 4); }));
  q.push('2026-03-31'); for (const k in A0) Q[k].push(INST.has(k) ? A0[k][5] : A0[k][5] / 4 * 1.1);
  const L = q.length - 1, last4 = [L - 3, L - 2, L - 1, L];
  // "רווח הרחוב" = GAAP + 1 בכל רבעון (התאמות גדולות מהתגמול), תאריכי Yahoo — סוף החודש (עד 3 ימים מהדוח)
  const hist = (d) => last4.map((i) => ({ q: q[i], a: Q.eps[i] + d, e: Q.eps[i] }));
  const rel = (e, ex, fut = ex) => [new Date(Date.parse(e) + 30 * 864e5).toISOString().slice(0, 10), ex, fut, 5000];
  const base = { ok: true, sym: 'SYN', src: 'sec', cur: 'USD', fy, q, A: A0, Q, T: null, prof: { name: 'Syn' }, price: 400, sharesOut: 1e9, fpe: 18,
    est: [{ p: '+1y', eps: 42, n: 9, rev: 190e9, rn: 9, end: '2027-12-31' }], indData: {}, checks: [], fill: [] };
  const mk = (o) => A.prep({ ...base, ...o }, null, 3.7);
  const gaap = last4.reduce((s, i) => s + Q.eps[i], 0), sbcAt = last4.reduce((s, i) => s + Q.sbc[i] * 0.8 / 1e9, 0);
  const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;

  let co = mk({ hist: hist(1), sbcX: last4.map((i) => rel(q[i], 1)) });
  let b = A.bufCalc(co);
  ok(b && near(b.st, gaap + 4) && near(b.g, gaap) && near(b.t, 0.2), 'רחוב, GAAP ושיעור המס — מ־4 הרבעונים האחרונים');
  ok(near(b.ded, sbcAt) && near(b.eps, gaap + 4 - sbcAt) && b.pol === 'ex', 'ההודעות מאשרות שהתגמול הוצא — יורד כולו, אחרי מס');
  ok(near(A.bpeOf(co), 400 / b.eps), 'מכפיל באפט = מחיר ÷ רווח לפי באפט');
  const fe = 400 / 18, fd = 0.02 * 190e9 * 0.8 / 1e9;
  ok(b.f && near(b.f.base, fe) && near(b.f.ded, fd, 1e-4) && near(b.f.eps, fe - fd, 1e-4), 'הצפוי — הרווח של המכפיל הצפוי פחות התגמול הצפוי (2% מההכנסות הצפויות, אחרי מס)');
  ok(b.f.end === null && b.f.n === null, 'הרווח של המכפיל הצפוי שונה מממוצע +1y — בלי שנה ובלי מספר אנליסטים');
  ok(near(A.bfpeOf(co), 400 / (fe - fd), 1e-4), 'מכפיל באפט צפוי = מחיר ÷ הרווח הצפוי לפי באפט');
  ok(A.isAdj(co), 'רחוב רחוק מ־GAAP — המכפיל הצפוי מסומן "לפי הרווח המותאם"');
  // אותו רווח כמו +1y — עם השנה ומספר האנליסטים
  b = A.bufCalc(mk({ hist: hist(1), sbcX: last4.map((i) => rel(q[i], 1)), fpe: 400 / 42 }));
  ok(b.f.end === '2027-12-31' && b.f.n === 9, 'הרווח של המכפיל הצפוי = ממוצע +1y — השנה ומספר האנליסטים מוצגים');

  // מחיר חי שונה מהמחיר של Yahoo ברגע השליפה: המכפיל הצפוי עובר למחיר החי, והרווח הצפוי שמאחוריו לא זז
  co = A.prep({ ...base, hist: hist(1), sbcX: last4.map((i) => rel(q[i], 1)) }, { close: 440 }, 3.7);
  ok(near(co.fpe, 18 * 1.1) && near(A.bufCalc(co).f.base, fe) && near(A.bfpeOf(co), 440 / (fe - fd), 1e-4), 'מחיר חי — שני המכפילים הצפויים על אותו מחיר, הרווח הצפוי לא משתנה');
  co = A.prep({ ...base, hist: hist(1) }, { close: 2000 }, 3.7);
  ok(co.fpe === 18, 'יחס חריג בין המחיר החי למחיר של Yahoo (פיצול באמצע) — נשאר המכפיל של Yahoo');
  b = A.bufCalc(mk({ hist: hist(1), sbcX: last4.map((i) => rel(q[i], 0)) }));
  ok(b.ded === 0 && near(b.eps, gaap + 4) && b.pol === 'in' && b.f.ded === 0 && b.f.chg === false, 'הרווח המותאם כולל את התגמול (JNJ, MSFT) — לא יורד כלום, גם לא בצפוי, ובלי ההערה "מעכשיו כולל" (APP)');
  b = A.bufCalc(mk({ hist: hist(0), sbcX: last4.map((i) => rel(q[i], 1)) }));
  ok(b.ded === 0 && b.yGaap && b.f.ded === 0, 'הסדרה של Yahoo = GAAP (PLTR) — לא יורד, גם כשהחברה מוציאה בהודעה');
  b = A.bufCalc(mk({ hist: hist(0.3) }));
  ok(near(b.ded, 1.2) && b.pol === '?', 'בלי הודעות — עד גובה הפער מול GAAP (0.3 ברבעון, פחות מהתגמול)');
  b = A.bufCalc(mk({ hist: hist(1), sbcX: last4.map((i, j) => rel(q[i], j < 2 ? 1 : 0)) }));
  ok(b.pol === 'mix' && near(b.ded, (Q.sbc[L - 3] + Q.sbc[L - 2]) * 0.8 / 1e9), 'החברה שינתה הגדרה — יורד רק ברבעונים שבהם הוצא');
  b = A.bufCalc(mk({ hist: hist(1), sbcX: last4.map((i, j) => rel(q[i], 1, j < 3)) }));
  ok(near(b.ded, sbcAt) && b.f.fut === false && b.f.chg === true && b.f.ded === 0, 'ההודעה האחרונה: "will no longer exclude" — ב־12 החודשים יורד, בצפוי לא, וההערה "מעכשיו כולל" (INTU)');
  // שתי הודעות לאותו רבעון: הארוכה (ההודעה המלאה) קובעת
  co = mk({ hist: hist(1), sbcX: last4.map((i) => rel(q[i], 1)).concat([[new Date(Date.parse(q[L]) + 5 * 864e5).toISOString().slice(0, 10), 0, 0, 100]]).sort((x, y) => (x[0] < y[0] ? -1 : 1)) });
  ok(A.sbcPol(co, q[L]) === 1, 'כמה הודעות לאותו רבעון — הארוכה קובעת (הודעה מקדימה קצרה לא)');
  // תאריך של Yahoo שונה בכמה ימים (שנה של 52/53 שבועות)
  const h2 = hist(1).map((x) => ({ ...x, q: new Date(Date.parse(x.q) - 3 * 864e5).toISOString().slice(0, 10) }));
  ok(A.bufCalc(mk({ hist: h2, sbcX: last4.map((i) => rel(q[i], 1)) })) != null, 'תאריך הרבעון ב־Yahoo רחוק עד 20 יום — מותאם');
  ok(A.bufCalc(mk({ hist: hist(1).slice(1) })) === null, 'חסר רבעון ב־Yahoo — אין חישוב (לא מנחשים)');
  ok(A.bufCalc(mk({ hist: hist(1).map((x) => ({ ...x, a: x.a * 100 })) })) === null, 'יחידות שונות (פי 100 — אגורות) — אין חישוב');
  // הפסד אחרי התגמול (SNOW) — אין מכפיל
  co = mk({ hist: last4.map((i) => ({ q: q[i], a: 0.1, e: 0.1 })), Q: { ...Q, eps: Q.eps.map((v, i) => (last4.includes(i) ? -1 : v)) }, sbcX: last4.map((i) => rel(q[i], 1)) });
  b = A.bufCalc(co);
  ok(b.eps < 0 && A.bpeOf(co) === null, 'רווח לפי באפט שלילי — אין מכפיל (לא מספר שלילי)');
  // מחיר לבדיקה: הרווח לא תלוי במחיר, המכפיל זז ביחס ישר; ההיפוך של הטופס מחזיר את המחיר
  co = mk({ hist: hist(1), sbcX: last4.map((i) => rel(q[i], 1)) });
  const m0 = A.bpeOf(co), f0 = A.bfpeOf(co);
  A.setPx(co, 800);
  ok(near(A.bpeOf(co), m0 * 2) && near(A.bfpeOf(co), f0 * 2, 1e-6), 'מחיר ערוך פי 2 — שני מכפילי באפט פי 2');
  ok(near(A.MED.bpe.inv(m0, null, 1e9, A.real(co)), 400) && near(A.MED.bfpe.inv(f0, null, 1e9, A.real(co)), 400, 1e-6), 'עריכת המכפיל — ההיפוך מחזיר את המחיר');
  ok(near(A.metNow(co, 'bpe'), A.bpeOf(co)) && near(A.metNow(co, 'bfpe'), A.bfpeOf(co)), 'metNow — אותו ערך כמו באריח');
  ok(A.bufCalc({ ...mk({ hist: hist(1) }), fxNote: true }) === null, 'מטבע מחיר שונה ממטבע הדוחות — אין חישוב');

  /* ---------- גל 1 של שיטת באפט (19/11/2026, docs/buffett-method-research.md §13.1, §13.5, §13.11–§13.13) ---------- */
  // סכום התגמול: השורה בגישור, בסדר הגודל שמתאים ל־XBRL של אותו רבעון; הדוחות גדולים ממנה ב־15% ומעלה — תגמול בשורות אחרות (PANW)
  const relX = (e, ex, tr, sa, nt = 0) => [new Date(Date.parse(e) + 30 * 864e5).toISOString().slice(0, 10), ex, ex, 5000, tr, sa, nt];
  const bxOf = (f) => Object.fromEntries(last4.map((i) => [q[i], f(i)]));
  const sumAt = (f, t) => last4.reduce((x, i) => x + f(i) * (1 - t) / 1e9, 0);
  co = mk({ hist: hist(1), sbcX: last4.map((i) => relX(q[i], 1, 0.21, [Q.sbc[i] / 1e6, Q.sbc[i] / 2e6])), bx: bxOf((i) => [Q.sbc[i] * 1.32, Q.sbc[i] * 1.25, null, null]) });
  b = A.bufCalc(co);
  ok(near(b.ded, sumAt((i) => Q.sbc[i], 0.21)) && b.asrc === 'pr' && b.oth, 'הסכום מהשורה בגישור (במיליונים), לא ההוצאה בדוחות (פי 1.32 — Palo Alto); מסומן "בשורות אחרות"');
  ok(near(b.t, 0.21) && b.ts === 'pr', 'שיעור המס — מה שהחברה מצהירה בהודעה (21%), לא שיעור הדוחות (20%)');
  const r3 = (i) => [Q.sbc[i] * 1.12 / 1e6, Q.sbc[i] * 1.06 / 1e6, Q.sbc[i] / 1e6];
  co = mk({ hist: hist(1), sbcX: last4.map((i) => relX(q[i], 1, 0.21, r3(i).concat([r3(i).reduce((a, b) => a + b, 0)]))), bx: bxOf((i) => [null, Q.sbc[i], null, null]) });
  ok(near(A.bufCalc(co).ded, sumAt((i) => Q.sbc[i], 0.21)), 'רבעוני השנה זה לצד זה וסך בסוף (INTU) — הרבעון שלפני הסך, לא הראשון');
  co = mk({ hist: hist(1), sbcX: last4.map((i) => relX(q[i], 1, 0.21, [Q.sbc[i] * 0.98 / 1e6, Q.sbc[i] / 1e6, 5 * Q.sbc[i] / 1e6])), bx: bxOf((i) => [null, Q.sbc[i], null, null]) });
  ok(near(A.bufCalc(co).ded, sumAt((i) => Q.sbc[i] * 0.98, 0.21)), 'העמודה הראשונה — גם כשהשנייה (שנה קודמת) קרובה יותר ל־XBRL (Salesforce ‏805 מול ‏820, ‏XBRL ‏819)');
  co = mk({ hist: hist(1), sbcX: last4.map((i) => relX(q[i], 1, 0.21, [Q.sbc[i - 4] / 1e6, Q.sbc[i] / 1e6])), bx: Object.fromEntries(q.slice(-12).map((e) => [e, [null, Q.sbc[q.indexOf(e)], null, null]])) });
  ok(near(A.bufCalc(co).ded, sumAt((i) => Q.sbc[i], 0.21)), 'שנה קודמת בעמודה הראשונה (מתאימה ל־XBRL של לפני שנה) — העמודה השנייה');
  co = mk({ hist: hist(1), sbcX: last4.map((i) => relX(q[i], 1, 0.21, [Q.sbc[i] * 1.26 / 1e6, Q.sbc[i] / 1e6])), bx: bxOf((i) => [null, Q.sbc[i], null, null]) });
  ok(near(A.bufCalc(co).ded, sumAt((i) => Q.sbc[i] * 1.26, 0.21)), 'השורה בגישור גדולה מה־XBRL ב־26% (Bloom, ‏B-033) — עדיין העמודה הראשונה, לא הרבעון הקודם');
  // שורה של 5 רבעונים (מנהלות השקעות): הכיוון מהתזוזה מול ההודעה של הרבעון הקודם; בלי תזוזה — עמודת מצטבר של רבעונים רצופים
  const S = (j) => Q.sbc[j] * (1 + 0.04 * (j % 5)), bx12 = Object.fromEntries(q.slice(-12).map((e) => [e, [null, S(q.indexOf(e)), null, null]]));
  const five = (i) => [i - 4, i - 3, i - 2, i - 1, i].map((j) => S(j) / 1e3);
  co = mk({ hist: hist(1), sbcX: [L - 4].concat(last4).map((i) => relX(q[i], 1, 0.21, five(i).concat([1e9]))), bx: bx12 });
  ok(near(A.bufCalc(co).ded, sumAt(S, 0.21)), '5 רבעונים מהישן לחדש (Blackstone, ‏Carlyle) — החמישית, לפי התזוזה מול ההודעה הקודמת');
  co = mk({ hist: hist(1), sbcX: [L - 4].concat(last4).map((i) => relX(q[i], 1, 0.21, five(i).reverse())), bx: bx12 });
  ok(near(A.bufCalc(co).ded, sumAt(S, 0.21)), '5 רבעונים מהחדש לישן (Blue Owl) — הראשונה');
  const ytdO = (i) => [S(i - 4), S(i - 2), S(i - 1), S(i), S(i - 2) + S(i - 1) + S(i)].map((v) => v / 1e3);
  co = mk({ hist: hist(1), sbcX: last4.map((i) => relX(q[i], 1, 0.21, ytdO(i))), bx: bx12 });
  ok(near(A.bufCalc(co).ded, sumAt(S, 0.21)), 'עמודת מצטבר = סכום של רבעונים רצופים (Apollo) — האחרון מהם, לפי היחס ל־XBRL');
  const ytdN = (i) => [S(i), S(i - 1), S(i - 2), S(i - 4), S(i) + S(i - 1) + S(i - 2)].map((v) => v / 1e3);
  co = mk({ hist: hist(1), sbcX: last4.map((i) => relX(q[i], 1, 0.21, ytdN(i))), bx: bx12 });
  ok(near(A.bufCalc(co).ded, sumAt(S, 0.21)), 'עמודת מצטבר מהחדש לישן — הראשון מהרבעונים');
  co = mk({ hist: hist(1), sbcX: last4.map((i) => relX(q[i], 1, 0.21, [Q.sbc[i] / 1e3])), bx: bxOf((i) => [null, Q.sbc[i] * 1.01, null, null]) });
  ok(near(A.bufCalc(co).ded, sumAt((i) => Q.sbc[i], 0.21)) && !A.bufCalc(co).oth, 'שורה באלפים (PLTR) — אותו סכום');
  co = mk({ hist: hist(1), sbcX: last4.map((i) => relX(q[i], 1, 0.21, [Math.round(Q.sbc[i] / 1e7) / 100])), bx: bxOf((i) => [null, Q.sbc[i], null, null]) });
  ok(near(A.bufCalc(co).ded, last4.reduce((x, i) => x + Math.round(Q.sbc[i] / 1e7) / 100 * 0.79, 0)), 'שורה למניה (עם נקודה עשרונית) × המניות');
  co = mk({ hist: hist(1), sbcX: last4.map((i) => relX(q[i], 1, 0.21, [Q.sbc[i] / 1e6 * 0.79], 1)), bx: bxOf((i) => [null, Q.sbc[i], null, null]) });
  ok(near(A.bufCalc(co).ded, sumAt((i) => Q.sbc[i], 0.21)), 'שורה "net of tax" — מוחזרת לפני מס ומנוכה פעם אחת');
  co = mk({ hist: hist(1), sbcX: last4.map((i) => relX(q[i], 1, 0.21, [Q.sbc[i] * 0.08]).concat([q[i], 3, 0, null, 1])), bx: bxOf((i) => [null, Q.sbc[i], null, null]) });
  b = A.bufCalc(co);
  ok(near(b.ded, sumAt((i) => Q.sbc[i] * 0.08, 0.21)) && b.pp, 'חלק מהתגמול (CMCSA, ‏B-035) — רק הסכום שבהודעה, בדולרים, גם כשהוא רחוק מה־XBRL');
  // הודעת מיזוג ארוכה עם הכנסות מקדימות (Marvell): לרבעון שלפניה — לא (רבעון אחר); לרבעון שלה — לא (בלי אזכור של התגמול)
  const merger = [new Date(Date.parse(q[L]) + 2 * 864e5).toISOString().slice(0, 10), 0, 0, 99999, null, null, 0, q[L], 0];
  co = mk({ hist: hist(1), sbcX: last4.map((i) => relX(q[i], 1, 0.11, null).concat([q[i], 12])).concat([merger]).sort((x, y) => (x[0] < y[0] ? -1 : 1)) });
  ok(A.sbcPol(co, q[L]) === 1 && A.sbcPol(co, q[L - 1]) === 1 && A.bufCalc(co).pol === 'ex', 'הודעת מיזוג ארוכה בלי אזכור של התגמול — לא נבחרת, לא לרבעון שלה ולא לקודם');
  co = mk({ hist: hist(1), sbcX: last4.map((i) => relX(q[i], 1, 0.11, null)).concat([[new Date(Date.parse(q[L - 1]) + 93 * 864e5).toISOString().slice(0, 10), 0, 0, 99999, null, null, 0, q[L], 0]]).sort((x, y) => (x[0] < y[0] ? -1 : 1)) });
  ok(A.sbcPol(co, q[L - 1]) === 1, 'הודעה של רבעון אחר בתוך 100 הימים — לא נבחרת לפי האורך (סוף הרבעון שבה)');
  // בלי שורה בהודעה: XBRL מתגית אחת — ההוצאה בדוח הרווח, חוץ מתיוג חלקי (פחות מחצי מהתזרים — FIS); בלי bx (תשובה ישנה) — Q.sbc
  co = mk({ hist: hist(1), sbcX: last4.map((i) => relX(q[i], 1, 0.21, null)), bx: bxOf((i) => [Q.sbc[i] * 0.9, Q.sbc[i], null, null]) });
  ok(near(A.bufCalc(co).ded, sumAt((i) => Q.sbc[i] * 0.9, 0.21)) && A.bufCalc(co).asrc === 'al', 'בלי שורה — ההוצאה בדוח הרווח (Allocated)');
  co = mk({ hist: hist(1), sbcX: last4.map((i) => relX(q[i], 1, 0.21, null)), bx: bxOf((i) => [Q.sbc[i] * 0.01, Q.sbc[i], null, null]) });
  ok(near(A.bufCalc(co).ded, sumAt((i) => Q.sbc[i], 0.21)) && A.bufCalc(co).asrc === 'cf', 'תיוג חלקי בדוח הרווח — התוספת בתזרים');
  co = mk({ hist: hist(1), sbcX: last4.map((i) => relX(q[i], 1, 0.21, [Q.sbc[i] / 1e6])) });
  ok(near(A.bufCalc(co).ded, sumAt((i) => Q.sbc[i], 0.21)), 'תשובה בלי bx — הסדרה הכללית משמשת כייחוס');
  // שיעור המס: ריט → 0; השיעור האחרון שהוצהר בהודעה קרובה (MRVL); מחוץ ל־10%–30% — לא; בלי הצהרה — הדוחות (0–35%); אחרת 21%
  // גל 2: שדות ההודעה r[7..18] (qe, k, tb, ns, pp, rx, u, yo, so, ae, af, ig)
  const w2x = (r, f) => { const a = r.slice(); const d = [null, 0, 0, null, 0, null, 0, 0, null, null, null, null]; while (a.length < 19) a.push(d[a.length - 7]); for (const k in f) a[k] = f[k]; return a; };
  co = mk({ hist: hist(1), sic: 6798, sbcX: last4.map((i) => w2x(relX(q[i], 1, 0.21, null), { 7: q[i], 17: 2.5 })) });
  b = A.bufCalc(co);
  ok(near(b.ded, sumAt((i) => Q.sbc[i], 0)) && b.ts === 'reit' && b.t === 0 && near(b.st, 10) && b.reit && b.f == null, 'ריט — הבסיס AFFO מההודעה, התגמול יורד במלואו (בלי מגן מס), בלי מכפיל צפוי');
  co = mk({ hist: hist(1), sic: 6798, sbcX: last4.map((i, j) => w2x(relX(q[i], 1, 0.21, null), { 7: q[i], 17: j === 2 ? null : 2.5 })) });
  ok(A.bufCalc(co) === null, 'ריט — רבעון בלי AFFO בהודעה: אין אריח (החלטת המשתמש ל־B-028)');
  co = mk({ hist: hist(1), sic: 6798, sbcX: last4.map((i) => relX(q[i], 1, 0.21, null)) });
  b = A.bufCalc(co);
  ok(b && near(b.ded, sumAt((i) => Q.sbc[i], 0)) && !b.reit, 'ריט עם הודעות מגרסה קודמת (בלי שדות גל 2) — החישוב של גל 1 עד הקריאה מחדש');
  // בדיקת הרחוב מול ההנהלה: הרווח המותאם בהודעה שונה ביותר מ־3% וגם מ־0.03$ — המספר של ההודעה; יחס של פיצול — לא
  co = mk({ hist: hist(0), sbcX: last4.map((i) => w2x(relX(q[i], 1, 0.21, null), { 7: q[i], 16: +(Q.eps[i] + 0.5).toFixed(2) })) });
  b = A.bufCalc(co);
  ok(b.nAe === 4 && near(b.st, last4.reduce((x, i) => x + +(Q.eps[i] + 0.5).toFixed(2), 0)), 'הרחוב שונה מההנהלה — המספר של ההודעה בכל רבעון');
  co = mk({ hist: hist(1), sbcX: last4.map((i) => w2x(relX(q[i], 1, 0.21, null), { 7: q[i], 16: +(Q.eps[i] + 1.01).toFixed(2) })) });
  ok(A.bufCalc(co).nAe === 0, 'הפרש קטן (פחות מ־3% או מ־0.03$) — הרחוב של Yahoo נשאר');
  co = mk({ hist: hist(1), sbcX: last4.map((i) => w2x(relX(q[i], 1, 0.21, null), { 7: q[i], 16: +((Q.eps[i] + 1) * 5).toFixed(2) })) });
  ok(A.bufCalc(co).nAe === 0, 'יחס של פיצול מניות (פי 5) — לא מחליפים');
  co = mk({ hist: hist(0), sbcX: last4.map((i, j) => w2x(relX(q[i], 1, 0.21, null), { 7: q[i], 16: +(j === 1 ? (Q.eps[i] + 0.5) * 3 : Q.eps[i] + 0.5).toFixed(2) })) });
  ok(A.bufCalc(co).nAe === 0, 'רבעון אחד שונה מההנהלה ולא הוחלף — לא מחליפים אף רבעון (Uber, הכל או כלום)');
  // רווחי השקעות ברחוב (Alphabet): הרחוב = GAAP והחברה מפרסמת את ההשפעה למניה → GAAP פחות ההשפעה; הרחוב כבר בלעדיהם (GOOG) — לא נוגעים
  co = mk({ hist: hist(0), sbcX: last4.map((i) => w2x(relX(q[i], 0, 0.21, null), { 7: q[i], 18: 0.4 })) });
  b = A.bufCalc(co);
  ok(near(b.st, last4.reduce((x, i) => x + Q.eps[i], 0) - 1.6) && near(b.ig, 1.6) && b.ded === 0, 'הרחוב כולל רווחי השקעות — GAAP פחות ההשפעה שהחברה פרסמה');
  co = mk({ hist: hist(-0.4), sbcX: last4.map((i) => w2x(relX(q[i], 0, 0.21, null), { 7: q[i], 18: 0.4 })) });
  ok(near(A.bufCalc(co).ig, 0), 'הרחוב כבר בלי רווחי ההשקעות — לא נוגעים');
  // ארגון מחדש ורכישות (§13.6): חוזרים — הממוצע של 12 הרבעונים אחרי מס; לא חוזרים — מוצגים בנפרד, לא מורדים
  const q12 = q.slice(-12), sbcX12 = (f) => q12.map((e, j) => w2x(relX(e, 1, 0.21, [Q.sbc[q.indexOf(e)] / 1e6]), { 7: e, 12: f(j) }));
  co = mk({ hist: hist(1), sbcX: sbcX12((j) => (j % 3 === 0 ? null : [[1, 120, 80]])), bx: Object.fromEntries(q12.map((e) => [e, [null, Q.sbc[q.indexOf(e)], null, null]])) });
  b = A.bufCalc(co);
  const avg = 120e6 * 8 / 12;
  ok(near(b.ra, 4 * avg * 0.79 / 1e9) && near(b.eps, b.st - b.ded - b.ra) && near(b.f.ra, 4 * avg * 0.79 / 1e9), 'ארגון מחדש חוזר (8 מתוך 12) — הממוצע של 12 הרבעונים, אחרי מס, גם בצפוי');
  co = mk({ hist: hist(1), sbcX: sbcX12((j) => (j === 11 ? [[2, 300, 0]] : null)), bx: Object.fromEntries(q12.map((e) => [e, [null, Q.sbc[q.indexOf(e)], null, null]])) });
  b = A.bufCalc(co);
  ok(b.ra === 0 && near(b.raOne, 300e6 * 0.79 / 1e9), 'עלות רכישה חד־פעמית — לא מורדת, מוצגת בנפרד');
  // שורות תגמול נוספות (KKR, ‏Blue Owl) — באותה עמודה וסדר גודל כמו השורה הרגילה, כשחוזרות
  co = mk({ hist: hist(1), sbcX: q12.map((e) => w2x(relX(e, 1, 0.21, [Q.sbc[q.indexOf(e)] / 1e6, 1]), { 7: e, 15: [[Q.sbc[q.indexOf(e)] / 2e6, 2]] })), bx: Object.fromEntries(q12.map((e) => [e, [null, Q.sbc[q.indexOf(e)] * 1.5, null, null]])) });
  b = A.bufCalc(co);
  ok(near(b.ded, sumAt((i) => Q.sbc[i] * 1.5, 0.21)) && !b.oth, 'שורת תגמול נוספת שחוזרת — מנוכה (וההערה "בשורות אחרות" יורדת)');
  co = mk({ hist: hist(1), sbcX: last4.map((i) => relX(q[i], 1, 0.21, null).concat([q[i], 3, 1])) });
  b = A.bufCalc(co);
  ok(near(b.ded, sumAt((i) => Q.sbc[i], 0)) && b.ts === 'tb' && b.t === 0, 'המס של המדד המותאם כבר כולל את הטבת המס (מנהלות השקעות) — לפני מס');
  co = mk({ hist: hist(1), sbcX: last4.map((i, j) => relX(q[i], 1, 0.21, null).concat([q[i], 3, j === 3 ? 1 : 0])) });
  ok(A.bufCalc(co).ts === 'tb', 'tb בהודעה אחת — לכל הרבעונים בטווח 400 יום (מדיניות של החברה)');
  co = mk({ hist: hist(1), sbcX: last4.map((i) => relX(q[i], 1, 0.21, null).concat([q[i], 3, 0, 2e9])) });
  ok(near(A.bufCalc(co).ded, sumAt((i) => Q.sbc[i], 0.21) / 2), 'Up-C — התגמול מחולק על בסיס המניות של המדד שבהודעה (פי 2 מה־XBRL), לא על Class A');
  co = mk({ hist: hist(1), sbcX: last4.map((i) => relX(q[i], 1, 0.21, null).concat([q[i], 3, 0, 9e9])) });
  ok(near(A.bufCalc(co).ded, sumAt((i) => Q.sbc[i], 0.21)), 'בסיס מניות בהודעה מעל פי 4 מה־XBRL — לא נלקח');
  co = mk({ hist: last4.map((i, j) => ({ q: q[i], a: Q.eps[i] + (j % 2 ? 1 : 0), e: Q.eps[i] })), sbcX: last4.map((i) => relX(q[i], 1, 0.21, null)) });
  ok(A.bufCalc(co) === null, 'סדרה מעורבת של Yahoo (שני רבעונים = GAAP, והחברה מוציאה — TPG, ‏B-028) — אין אריח');
  co = mk({ hist: last4.map((i, j) => ({ q: q[i], a: Q.eps[i] + (j === 0 ? 0 : 1), e: Q.eps[i] })), sbcX: last4.map((i) => relX(q[i], 1, 0.21, null)) });
  ok(near(A.bufCalc(co).ded, sumAt((i) => (i === L - 3 ? 0 : Q.sbc[i]), 0.21)), 'רבעון אחד שבו הרחוב = GAAP — בלי ניכוי ברבעון הזה בלבד');
  co = mk({ hist: hist(1), sbcX: last4.map((i, j) => relX(q[i], 1, j === 0 ? 0.11 : null, null)) });
  ok(near(A.bufCalc(co).t, 0.11) && A.bufCalc(co).ts === 'pr', 'רבעון בלי הצהרה — השיעור האחרון שהחברה הצהירה (Marvell ‏11%)');
  co = mk({ hist: hist(1), sbcX: last4.map((i) => relX(q[i], 1, 0.35, null)) });
  ok(near(A.bufCalc(co).t, 0.2) && A.bufCalc(co).ts === 'x', 'שיעור מוצהר מחוץ ל־10%–30% — לא נלקח; שיעור הדוחות');
  co = mk({ hist: hist(1), sbcX: last4.map((i) => relX(q[i], 1, null, null)), Q: { ...Q, pretax: Q.pretax.map((v, i) => (i === L ? null : v)) } });
  ok(near(A.bufCalc(co).t, 0.2) && A.bufCalc(co).ts === 'x', 'חסר רווח לפני מס ברבעון — שיעור הדוחות של השנה האחרונה, לא 21% קבוע');
  co = mk({ hist: hist(1), sbcX: last4.map((i) => relX(q[i], 1, null, null)), A: { ...A0, tax: A0.tax.map((x) => x * 8) }, Q: { ...Q, tax: Q.tax.map((x) => x * 8) } });
  ok(near(A.bufCalc(co).t, 0.21) && A.bufCalc(co).ts === 'd', 'שיעור בדוחות מעל 30% (מס זר, APA) — 21%');
  co = mk({ hist: hist(1), sbcX: last4.map((i) => relX(q[i], 1, null, null)), A: { ...A0, tax: A0.tax.map((x) => x * 0.2) }, Q: { ...Q, tax: Q.tax.map((x) => x * 0.2) } });
  ok(near(A.bufCalc(co).t, 0.21) && A.bufCalc(co).ts === 'd', 'שיעור בדוחות 4% (הטבות חד־פעמיות — Meta, Broadcom) — 21%, לא 4%');
  // בלי הודעות (§13.5): הפער מול GAAP מיוחס קודם להפחתה מרכישות אחרי מס, והיתר לתגמול — עד התגמול אחרי מס
  co = mk({ hist: hist(1), bx: bxOf((i) => [null, Q.sbc[i], null, 0.8e9]) });
  b = A.bufCalc(co);
  ok(near(b.ded, 4 - 4 * 0.8 * 0.79) && b.pol === '?', 'בלי הודעות — פער 4 פחות הפחתה מרכישות אחרי מס ‏(2.528) = ‏1.472');
  co = mk({ hist: hist(1), bx: bxOf((i) => [null, Q.sbc[i], null, 2e9]) });
  ok(A.bufCalc(co).ded === 0, 'בלי הודעות — ההפחתה מכסה את כל הפער: לא יורד כלום');

  /* ---------- שילוב: אריחים, גיליון, השוואה, מחרוזות ---------- */
  ok(/fact\(T\('anFBpe'\), fmt\(bpeOf\(co\)[\s\S]{0,80}'bpe'\), fact\(T\('anFBfpe'\), fmt\(bfpeOf\(co\)/.test(src), 'שני האריחים אחרי "מכפיל צפוי"');
  ok(/\['bpe', 'anFBpe', 'anLoCheap', 'x', -1\], \['bfpe', 'anFBfpe', 'anCmpFwd', 'x', -1\]/.test(src) && /bpe: bpeOf\(c\), bfpe: bfpeOf\(c\)/.test(src), 'טבלת ההשוואה מול חברות אחרות');
  ok(/if \(key === 'bpe' \|\| key === 'bfpe'\) \{ bufSheet\(key\); return; \}/.test(src), 'לחיצה על האריח — גיליון החישוב');
  ok(/const note = fwd && b\.f\.chg \? 'anBFutIn'/.test(src), 'ההערה "מעכשיו כולל" — רק כשהחברה הודיעה על שינוי, לא בכל חברה שכוללת ממילא');
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const keys = ['anFBpe', 'anFBfpe', 'anCmpFwd', 'anHFpeAdj', 'anHBpe', 'anHBfpe', 'anXFpeAdj', 'anXBpe', 'anXBfpe', 'anXBufNone', 'anBStreet', 'anBStreetS', 'anBSbc', 'anBSbcS',
    'anBFwd', 'anBFwd0', 'anBFwdY', 'anBSbcF', 'anBSbcFS', 'anBEps', 'anBMultS', 'anBNeg', 'anBGaap', 'anBGaapS', 'anBPolEx', 'anBPolIn', 'anBPolMix', 'anBPolUnk', 'anBPolGaap', 'anBFutIn', 'anBSbcSP', 'anBSbcSD', 'anBSbcSR', 'anBSbcSB', 'anBOth', 'anBPart', 'anFPebt', 'anHPebt', 'anHPebt0', 'anXPebt', 'anPtG', 'anPtGS', 'anPtIg', 'anPtIgS', 'anPtAm', 'anPtAmS',
    'anPtRo', 'anPtRoS', 'anPtB', 'anPtES', 'anPtTx', 'anPtTxS', 'anPtBu', 'anBuHead', 'anYPre', 'anYAft', 'anYAftS', 'anYBond', 'anYBondIL', 'anYOver', 'anYUnder', 'anY10', 'anBuOk', 'anBuFlag', 'anBuNeg', 'anBuTax'];
  ok(keys.every((k) => (app.match(new RegExp('\\n  ' + k + ': ', 'g')) || []).length === 2), 'כל המחרוזות בעברית ובאנגלית');
  /* ---------- גל 3: דרך ב (מלמטה), ‏P/EBT, תשואת רווח מול האג"ח (docs/buffett-pe.md §2ג) ---------- */
  {
    const ptS = last4.reduce((s, i) => s + Q.pretax[i], 0);
    // הרחוב = GAAP + התגמול אחרי מס (מה שהחברה מוציאה), הפחתה 0.1B ורווח השקעות 0.2B ברבעון
    const hs = last4.map((i) => ({ q: q[i], a: Q.eps[i] + Q.sbc[i] * 0.8 / 1e9, e: Q.eps[i] }));
    let c3 = mk({ hist: hs, sbcX: last4.map((i) => rel(q[i], 1)), bx: bxOf((i) => [Q.sbc[i], Q.sbc[i], null, 1e8, 2e8, 9e9]) });
    let u = A.bufBU(c3), b3 = A.bufCalc(c3);
    ok(u && near(u.pt, ptS, 1) && u.ig === 8e8 && u.am === 4e8 && near(u.ebt, ptS - 8e8 + 4e8, 1), 'דרך ב: לפני מס בדוח − רווחי השקעות (העמודה הראשונה, בלי ערבוב) + הפחתה מרכישות');
    ok(near(u.eps, u.ebt * (1 - b3.tl) / 1e9) && near(A.pebtOf(c3), 400 / b3.eps * (1 - b3.tl)) && near(A.ebtPs(c3), b3.eps / (1 - b3.tl)), 'אחרי מס — בשיעור של דרך א; ‏P/EBT = מכפיל באפט × (1 − τ) — הרווח של מכפיל באפט, לפני מס (באפט 1991)');
    ok(u.flag === false && Math.abs(u.gap) <= 0.1, 'פער של עד 10% מול דרך א — בלי דגל');
    c3 = mk({ hist: hist(1), sbcX: last4.map((i) => rel(q[i], 1)), bx: bxOf((i) => [Q.sbc[i], Q.sbc[i], null, null, null, 3e9]) });
    u = A.bufBU(c3);
    ok(u.ig === 12e9 && u.am === 0 && u.flag === true, 'בלי העמודה הראשונה — השקעות בכלל; רחוב רחוק מהחישוב מלמטה → דגל');
    { const c4 = mk({ hist: hist(1), sbcX: last4.map((i) => rel(q[i], 1)) }); ok(A.bufBU(c4) === null && A.pebtOf(c4) > 0, 'בלי bx (IFRS) — אין בקרה מלמטה, אבל יש P/EBT (מהרווח של מכפיל באפט)'); }
    c3 = mk({ hist: hs, sbcX: last4.map((i) => rel(q[i], 1)), bx: { ...bxOf((i) => [Q.sbc[i], Q.sbc[i], null, i === L ? 5e8 : null, null, null]), ttm: [null, null, null, 1.2e9, null, null] } });
    ok(A.bufBU(c3).am === 1.2e9, 'הפחתה רק בשנתי (Emerson) — 12 החודשים מהשרתון, לא רבעון אחד');
    const FU3 = require(path.join(root, 'ibkr-proxy/lib/fundamentals.js'));
    const fx = (rows) => ({ dur: new Map(rows.map(([s, e, v]) => [s + '|' + e, { v }])) });
    ok(FU3.tagTTM(fx([['2025-10-01', '2026-09-30', 1116]]), '2026-09-30') === 1116, 'tagTTM: שנה שמסתיימת ברבעון האחרון');
    ok(FU3.tagTTM(fx([['2025-01-01', '2025-12-31', 400], ['2026-01-01', '2026-06-30', 250], ['2025-01-01', '2025-06-30', 190]]), '2026-06-30') === 460, 'tagTTM: שנה קודמת + מצטבר − המצטבר המקביל');
    ok(FU3.tagTTM(fx([['2026-04-01', '2026-06-30', 90]]), '2026-06-30') === null, 'tagTTM: רק רבעון — null');
    c3 = mk({ hist: hs, sbcX: last4.map((i) => rel(q[i], 1)), bx: bxOf((i) => [Q.sbc[i], Q.sbc[i], null, 0, 0, null]) });
    const v0 = A.pebtOf(c3); A.setPx(c3, 800);
    ok(near(A.pebtOf(c3), v0 * 2) && near(A.MED.pebt.inv(v0, null, 1e9, A.real(c3)), 400), 'מחיר ערוך — ‏P/EBT זז ביחס ישר, וההיפוך מחזיר את המחיר');
    ok(/fact\(T\('anFBfpe'\)[^\n]*\n    pebtFact\(co, fact\),/.test(src) && /if \(key === 'pebt'\) \{ pebtSheet\(\); return; \}/.test(src), 'האריח אחרי "מכפיל באפט צפוי", והלחיצה פותחת את הגיליון');
    ok(/MAC\.rf30 > 0 \? \{ r: MAC\.rf30, y: 30 \}/.test(src), 'האג"ח הארוך (30 שנה) קודם ל־10 שנים');
  }
  const fsrc = fs.readFileSync(path.join(root, 'ibkr-proxy/lib/fundamentals.js'), 'utf8');
  ok(/nq: n \|\| null, sbcX,/.test(fsrc) && /sbcX = bsf && bsf\.sx/.test(fsrc), 'התשובה של op:fund כוללת sbcX');
  console.log(`\nכל ${n} הבדיקות עברו ✓`);
})().catch((e) => { console.error('נכשל:', e.stack || e.message); process.exit(1); });
