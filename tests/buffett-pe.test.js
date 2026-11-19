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

/* ---------- בחירת ההודעות והתשובה ללקוח ---------- */
const sub = { filings: { recent: {
  form: ['8-K', '10-Q', '8-K', '8-K', '8-K'], items: ['2.02,9.01', '', '7.01', '2.02', '2.02'],
  accessionNumber: ['0000001-26-000009', '0000001-26-000008', '0000001-26-000007', '0000001-26-000005', '0000001-24-000001'],
  filingDate: ['2026-10-28', '2026-10-29', '2026-09-01', '2026-07-22', '2024-07-20'], primaryDocument: ['a.htm', 'q.htm', 'b.htm', 'c.htm', 'd.htm'],
  reportDate: ['2026-10-28', '2026-09-30', '', '', ''] } } };
const pk = X.pick(sub, Date.parse('2026-11-18'));
ok(pk.length === 2 && pk[0].acc === '0000001-26-000009' && pk[1].filed === '2026-07-22', 'pick — רק 8-K עם 2.02 מ־15 החודשים האחרונים, החדש קודם');
const fc = X.forClient({ a: { filed: '2026-10-28', er: true, ex: true, fut: false, n: 900, sv: X.SV }, b: { filed: '2026-07-22', er: true, ex: false, fut: false, n: 800, sv: X.SV },
  c: { filed: '2026-09-01', er: false, ex: false, fut: false, sv: X.SV }, d: { filed: '2026-04-22', er: true, ex: true, fut: true, sv: X.SV - 1 } });
ok(JSON.stringify(fc) === JSON.stringify([['2026-04-22', 1, 1, 0], ['2026-07-22', 0, 0, 800], ['2026-10-28', 1, 0, 900]]), 'forClient — רק הודעות תוצאות, מהישנה לחדשה; גרסת מסווג קודמת נשלחת עד הקריאה מחדש');

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
  ok(!o2.sx['0000001-20-000001'] && Object.keys(o2.sx).length === 2, 'fillSx — רק 15 החודשים האחרונים נשמרים');

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

  /* ---------- שילוב: אריחים, גיליון, השוואה, מחרוזות ---------- */
  ok(/fact\(T\('anFBpe'\), fmt\(bpeOf\(co\)[\s\S]{0,80}'bpe'\), fact\(T\('anFBfpe'\), fmt\(bfpeOf\(co\)/.test(src), 'שני האריחים אחרי "מכפיל צפוי"');
  ok(/\['bpe', 'anFBpe', 'anLoCheap', 'x', -1\], \['bfpe', 'anFBfpe', 'anCmpFwd', 'x', -1\]/.test(src) && /bpe: bpeOf\(c\), bfpe: bfpeOf\(c\)/.test(src), 'טבלת ההשוואה מול חברות אחרות');
  ok(/if \(key === 'bpe' \|\| key === 'bfpe'\) \{ bufSheet\(key\); return; \}/.test(src), 'לחיצה על האריח — גיליון החישוב');
  ok(/const note = fwd && b\.f\.chg \? 'anBFutIn'/.test(src), 'ההערה "מעכשיו כולל" — רק כשהחברה הודיעה על שינוי, לא בכל חברה שכוללת ממילא');
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const keys = ['anFBpe', 'anFBfpe', 'anCmpFwd', 'anHFpeAdj', 'anHBpe', 'anHBfpe', 'anXFpeAdj', 'anXBpe', 'anXBfpe', 'anXBufNone', 'anBStreet', 'anBStreetS', 'anBSbc', 'anBSbcS',
    'anBFwd', 'anBFwd0', 'anBFwdY', 'anBSbcF', 'anBSbcFS', 'anBEps', 'anBMultS', 'anBNeg', 'anBGaap', 'anBGaapS', 'anBPolEx', 'anBPolIn', 'anBPolMix', 'anBPolUnk', 'anBPolGaap', 'anBFutIn'];
  ok(keys.every((k) => (app.match(new RegExp('\\n  ' + k + ': ', 'g')) || []).length === 2), 'כל המחרוזות בעברית ובאנגלית');
  const fsrc = fs.readFileSync(path.join(root, 'ibkr-proxy/lib/fundamentals.js'), 'utf8');
  ok(/nq: n \|\| null, sbcX,/.test(fsrc) && /sbcX = bsf && bsf\.sx/.test(fsrc), 'התשובה של op:fund כוללת sbcX');
  console.log(`\nכל ${n} הבדיקות עברו ✓`);
})().catch((e) => { console.error('נכשל:', e.stack || e.message); process.exit(1); });
