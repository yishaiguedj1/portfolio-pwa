/* צפי לדוח הקרוב (15/11/2026): השרתון (lib/earnprev.js — קונצנזוס מ־Yahoo, צפי ההנהלה מהודעת הדוחות ב־SEC)
   והטלפון (app.js — התאמה לתאריך הדוח, פורמט, שורות הכרטיס וטבלת הגיליון). הרצה: node tests/earnprev.test.js
   הטקסטים כאן סינתטיים — באותה צורה כמו הודעות דוחות אמיתיות (משפט, תבליטים, טבלה עם עמודות), בלי רשת. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

let n = 0;
const ok = (cond, name) => { n++; assert(cond, name); console.log('ok -', name); };
const E = require(path.join(__dirname, '..', 'ibkr-proxy/lib/earnprev.js'));

(async () => {
  /* ---------- Yahoo: הקונצנזוס ---------- */
  const R = (v) => ({ raw: v, fmt: String(v) });
  const qs = { quoteSummary: { result: [{
    calendarEvents: { earnings: { earningsDate: [R(1794949200)], earningsAverage: R(2.47121), earningsLow: R(2.25754), earningsHigh: R(2.7), revenueAverage: R(108731903900), revenueLow: R(100481000000), revenueHigh: R(116251000000) } },
    earningsTrend: { trend: [
      { period: '0q', endDate: '2026-10-31', earningsEstimate: { avg: R(2.47), numberOfAnalysts: R(43), yearAgoEps: R(1.3), earningsCurrency: 'USD' }, revenueEstimate: { avg: R(1.08e11), numberOfAnalysts: R(45), yearAgoRevenue: R(57006000000) },
        epsTrend: { current: R(2.47121), '30daysAgo': R(2.47325), '90daysAgo': R(2.35237) }, epsRevisions: { upLast30days: R(0), downLast30days: R(1) } },
      { period: '0y', endDate: '2027-01-31', earningsEstimate: { avg: R(9.327) }, revenueEstimate: { avg: R(411.89e9) } },
    ] },
    earningsHistory: { history: [['2025Q4', 1.3, 1.25, 0.0346], ['2026Q1', 1.62, 1.54, 0.0532], ['2026Q2', 1.87, 1.77, 0.0554], ['2026Q3', 2.0, 2.09, -0.04]].map(([q, a, e, s]) => ({ quarter: { fmt: q }, epsActual: R(a), epsEstimate: R(e), surprisePercent: R(s) })) },
  }] } };
  const a = E.parseAnalysts(qs);
  ok(a.d === '2026-11-17' && a.q.eps === 2.4712 && a.q.epsLo === 2.2575 && a.q.rev === 108731903900 && a.q.n === 43 && a.q.rn === 45, 'אנליסטים: תאריך הדוח, ממוצע וטווח מ־calendarEvents, מספר אנליסטים מ־earningsTrend');
  ok(a.q.yEps === 1.3 && a.q.yRev === 57006000000 && a.y.eps === 9.327 && a.y.rev === 411.89e9 && a.cur === 'USD', 'אנליסטים: לפני שנה, שנה מלאה ומטבע');
  ok(a.q.ec === 2.4712 && a.q.e30 === 2.4733 && a.q.e90 === 2.3524 && a.q.up === 0 && a.q.dn === 1, 'מגמת הצפי: הקונצנזוס לפני 30/90 יום, העלו/הורידו ב־30 יום');
  ok(a.h.b === 3 && a.h.n === 4 && a.h.s === 2.6, 'עקיפת הצפי: 3 מ־4 הרבעונים האחרונים, ממוצע באחוזים');
  ok(!a.fy, 'רבעון שלא סוגר את שנת הכספים — לא דוח שנתי');
  const qs2 = JSON.parse(JSON.stringify(qs));
  qs2.quoteSummary.result[0].earningsTrend.trend[1].endDate = '2026-10-31';
  ok(a.la && a.la.e === 2 && a.la.d === null, 'הרווח בפועל האחרון ("של הרחוב") — לדגל מותאם/GAAP');
  ok(E.parseAnalysts(qs2).fy === 1, 'הרבעון והשנה נגמרים באותו חודש — דוח שנתי');
  ok(E.parseAnalysts({ quoteSummary: { result: [{ calendarEvents: { earnings: { earningsDate: [R(1794949200)] } }, earningsTrend: { trend: [] } }] } }).q === undefined, 'בלי כיסוי אנליסטים — בלי q');
  ok(E.parseAnalysts({}) === null, 'תשובה ריקה → null');

  /* ---------- ערכי צפי ---------- */
  const v1 = E.valueAt('$108.0 billion, plus or minus 2%. Next');
  ok(Math.abs(v1[0] - 105.84) < 1e-9 && Math.abs(v1[1] - 110.16) < 1e-9 && v1[2] === 1e9, '"$X billion, plus or minus Y%" → טווח');
  const v2 = E.valueAt('$4.3 billion, +/- $100 million');
  ok(Math.abs(v2[0] - 4.2) < 1e-9 && Math.abs(v2[1] - 4.4) < 1e-9, '"± $100 million" על בסיס מיליארדים → המרת יחידות');
  const v3 = E.valueAt('$1,523.2 - $1,529.2 million');
  ok(v3[0] === 1523.2 && v3[1] === 1529.2 && v3[2] === 1e6, 'טווח עם יחידה רק בסוף');
  ok(E.valueAt('$2.649 - $2.653 billion')[2] === 1e9 && E.valueAt('$51.1B')[2] === 1e9, 'יחידה מקוצרת (B) וטווח');
  ok(E.periodBefore('For the second quarter of fiscal 2027, revenue ', 47) === 'q', 'תקופה: "quarter of fiscal 2027" = רבעון (ה־fiscal בתוכו לא נספר כשנה)');
  ok(E.periodBefore('For full year fiscal 2027, revenue ', 35) === 'y', 'תקופה: שנה מלאה');
  ok(E.htmlText('<p>Revenue</p><p>is &#36;1.0 <span>bil</span>lion, &#43;&#47;- 2&#37;</p>') === ' Revenue is $1.0 billion, +/- 2% ', 'HTML → טקסט: ישויות מספריות, תגיות בתוך שורה בלי רווח');

  /* ---------- חילוץ צפי ההנהלה (טקסטים סינתטיים באותה צורה) ---------- */
  const A = (qRev, qEps, yRev, yEps) => ({ q: { rev: qRev, eps: qEps }, y: { rev: yRev, eps: yEps } });
  const g1 = E.extractGuidance('<p>Outlook</p><p>The outlook for the third quarter of fiscal 2027 is as follows:</p><ul><li>Revenue is expected to be $108.0 billion, plus or minus 2%.</li><li>Gross margins are expected to be 74.0%.</li></ul>' +
    '<p>Highlights: Data Center revenue was $89.0 billion, up 18%.</p>', A(108.7e9, 2.47, 411e9, 9.3));
  ok(g1.q && g1.q.rev[0] === 105840000000 && g1.q.rev[1] === 110160000000 && !g1.q.eps && !g1.y, 'משפט צפי: הכנסות ±2% לרבעון; תוצאה בפועל ("was … up") לא נספרת');
  const g2 = E.extractGuidance('<p>Guidance</p><p>Q2 FY 2027 Guidance: Revenue: $18.0 billion to $18.2 billion; Earnings per Share: GAAP: $1.07 to $1.09; Non-GAAP: $1.34 to $1.36</p>' +
    '<p>FY 2027 Guidance: Revenue: $74.8 billion to $75.8 billion; Non-GAAP EPS $5.47 - $5.53</p>', A(18.16e9, 1.35, 75.08e9, 5.5));
  ok(g2.q.rev[0] === 18e9 && g2.q.rev[1] === 18.2e9 && g2.q.eps[0] === 1.34 && g2.q.eps[1] === 1.36 && !g2.q.gaap, 'רבעון: טווח הכנסות, ורווח למניה מתואם (Non-GAAP) ולא GAAP');
  ok(g2.y.rev[0] === 74.8e9 && g2.y.eps[1] === 5.53, 'שנה מלאה נפרדת מהרבעון');
  const g3 = E.extractGuidance('<p>Business Outlook. The following table presents guidance for the first quarter of 2027:</p><table><tr><td></td><td>GAAP Outlook</td><td>Non-GAAP Outlook</td></tr>' +
    '<tr><td>Revenue</td><td>$61.5 billion ± $1.5 billion</td><td>$61.5 billion ± $1.5 billion</td></tr><tr><td>Diluted earnings per share</td><td>$37.84 ± $1.00</td><td>$38.15 ± $1.00</td></tr></table>', A(61.8e9, 38.29, 275e9, 176));
  ok(g3.q.rev[0] === 60e9 && g3.q.rev[1] === 63e9 && g3.q.eps[0] === 37.15 && g3.q.eps[1] === 39.15, 'טבלה עם עמודות GAAP | Non-GAAP — לוקחים את המתואמת');
  const g4 = E.extractGuidance('<p>Guidance</p><table><tr><td>Q3 FY27 Guidance</td><td>Full Year FY27 Guidance</td></tr><tr><td>Total revenue</td><td>$1,523.2 - $1,529.2 million</td><td>$5,991.1 - $6,011.1 million</td></tr></table>', A(1.53e9, 0.31, 6.01e9, 1.26));
  ok(g4.q.rev[0] === 1523200000 && g4.y.rev[1] === 6011100000, 'טבלה רבעון | שנה — התקופה לפי ההתאמה לקונצנזוס');
  const g5 = E.extractGuidance('<p>Our summary results and forecast for Q4 are below.</p><table><tr><td>Revenue</td><td>$ 11,510</td><td>$ 12,051</td><td>$ 13,442</td></tr></table><p>For 2026, we expect revenue of $51.1B and an operating margin of 31.5%.</p>', A(13.45e9, 0.68, 51.1e9, 3.6));
  ok(!g5.q && g5.y && g5.y.rev[0] === 51.1e9, 'שורה בטבלת תוצאות לפי רבעונים — לא צפי; "we expect revenue of $51.1B" — כן (שנתי)');
  const g6 = E.extractGuidance('<p>Outlook: for the fourth quarter we expect AI revenue to be between $9.0 billion and $9.5 billion.</p>', A(34.9e9, 3.8, 106e9, 11.7));
  ok(!g6.q, 'הכנסות של מגזר (רחוקות מהקונצנזוס) — נזרקות');
  const g7 = E.extractGuidance('<p>Guidance for the fourth quarter: revenue of $2.649 - $2.653 billion.</p>', null);
  ok(g7.q && g7.q.rev[0] === 2649e6, 'בלי קונצנזוס — לפי סימון התקופה, רק עם יחידה מפורשת');
  ok(Object.keys(E.extractGuidance('<p>Revenue was $13.4 billion, up 45% year over year.</p>', A(13e9, 1, 50e9, 4))).length === 0, 'הודעה בלי צפי — כלום');

  /* ---------- SEC: ההגשה וקישור הנספח ---------- */
  const sb = { filings: { recent: { form: ['4', '8-K', '8-K', '10-Q'], items: ['', '5.02', '2.02,9.01', ''], accessionNumber: ['a', 'b', '0001-26-000073', 'd'], filingDate: ['2026-09-01', '2026-08-30', '2026-08-26', '2026-08-26'] } } };
  const lr = E.lastResults(sb);
  ok(lr.acc === '0001-26-000073' && lr.fd === '2026-08-26', 'ההגשה האחרונה עם סעיף 2.02 (תוצאות), לא 8-K אחר');
  const idx = '<tr><td>1</td><td><a href="/ix?doc=/Archives/x/main.htm">main.htm</a></td><td>8-K</td></tr><tr><td>2</td><td><a href="/Archives/edgar/data/1/2/cfo.htm">cfo.htm</a></td><td>EX-99.2</td></tr>' +
    '<tr><td>3</td><td><a href="/Archives/edgar/data/1/2/pr.htm">pr.htm</a></td><td>EX-99.01</td></tr>';
  ok(E.exhibitHref(idx) === '/Archives/edgar/data/1/2/pr.htm', 'נספח 99.1 (גם בכתיב 99.01) עדיף על 99.2');

  /* ---------- handle: קלט ---------- */
  const res = () => { const o = { code: 0, body: null, setHeader() {}, status(c) { o.code = c; return o; }, json(b) { o.body = b; return o; } }; return o; };
  const r1 = res(); await E.handle({ op: 'earnPrev', syms: [] }, r1);
  ok(r1.code === 400, 'בלי סימבולים → 400');
  const r2 = res(); await E.handle({ op: 'earnPrev', syms: Array.from({ length: 17 }, (_, i) => 'S' + i) }, r2);
  ok(r2.code === 400, 'יותר מ־16 סימבולים → 400');
  E._cache.set('a:TEVA.TA', { at: Date.now(), v: { d: '2026-11-20', q: { eps: 0.6 } } });
  const r3 = res(); await E.handle({ op: 'earnPrev', syms: ['teva.ta', '<x>'] }, r3);
  ok(r3.code === 200 && r3.body.data['TEVA.TA'].a.q.eps === 0.6 && !r3.body.data['TEVA.TA'].g && !('<X>' in r3.body.data), 'ת״א: אנליסטים מהמטמון, בלי SEC; סימבול לא חוקי מסונן');
  const hist = fs.readFileSync(path.join(__dirname, '..', 'ibkr-proxy/api/history.js'), 'utf8');
  ok(/op === 'earnPrev'\) return require\('\.\.\/lib\/earnprev'\)\.handle/.test(hist), 'השרתון: op:\'earnPrev\' ב־api/history.js (בלי פונקציה חדשה ב־Vercel)');

  /* ---------- השרתון: מצב העסק (parseBiz) ---------- */
  const ts = (type, rows) => ({ meta: { type: [type] }, [type]: rows.map(([d, v]) => ({ asOfDate: d, reportedValue: { raw: v } })) });
  const bz = E.parseBiz({ timeseries: { result: [
    ts('quarterlyTotalRevenue', [['2025-06-30', 10e9], ['2025-09-30', 11e9], ['2025-12-31', 12e9], ['2026-03-31', 12.5e9], ['2026-06-30', 13e9], ['2026-09-30', 14e9]]),
    ts('quarterlyOperatingIncome', [['2025-09-30', 2e9], ['2026-09-30', 3.1e9]]),
    ts('quarterlyDilutedEPS', [['2026-09-30', 1.23456]]),
    ts('quarterlyCapitalExpenditure', [['2026-09-30', -5e8]]),
    { meta: { type: ['quarterlyGoodwill'] }, quarterlyGoodwill: [null, { asOfDate: '2026-09-30' }] },
  ] } });
  ok(bz.q.length === 5 && bz.q[0] === '2025-09-30' && bz.q[4] === '2026-09-30', 'parseBiz: 5 הרבעונים האחרונים לפי ההכנסות');
  ok(bz.rev[4] === 14e9 && bz.op[0] === 2e9 && bz.op[1] === null && bz.eps[4] === 1.2346 && bz.capex[4] === -5e8, 'parseBiz: ערכים לפי תאריך, חסר = null, רווח למניה 4 ספרות, השקעות בסימן המקורי');
  ok(!('gw' in bz) && !('ni' in bz), 'parseBiz: סדרה ריקה או פגומה — לא נשלחת');
  ok(E.parseBiz({ timeseries: { result: [ts('quarterlyTotalRevenue', [['2026-09-30', 1]])] } }) === null && E.parseBiz(null) === null, 'parseBiz: פחות משני רבעונים — null');
  ok(/biz\(s\)/.test(fs.readFileSync(path.join(__dirname, '..', 'ibkr-proxy/lib/earnprev.js'), 'utf8')), 'השרתון שולף את מצב העסק לכל סימבול');

  /* ---------- הטלפון (app.js) ---------- */
  const store = {};
  const elStub = () => ({ value: '', textContent: '', innerHTML: '', classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {}, appendChild() {}, dataset: {}, style: {}, setAttribute() {} });
  const els = {};
  const sandbox = {
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
    document: { addEventListener() {}, getElementById: (id) => (els[id] || (els[id] = elStub())), querySelectorAll: () => [], createElement: elStub },
    window: {}, navigator: {}, location: { reload() {} }, fetch: async () => { throw new Error('no fetch'); }, setTimeout, clearTimeout, console,
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8') +
    '\n;globalThis.__t = { earnXFor, earnXTone, earnEpsTxt, earnRevTxt, earnRangeTxt, earnXRowHTML, earnXSheetHTML, LS_CACHE_PREFIXES, hsSnapTarget, earnXExp, earnXBiz, earnXFlags, earnXSigHTML };', sandbox, { filename: 'app.js' });
  const T = sandbox.__t;
  const x = { at: 1, a: { d: '2026-11-17', q: { eps: 2.4712, rev: 108731903900, n: 43, yEps: 1.3, yRev: 57e9, epsLo: 2.26, epsHi: 2.7 }, cur: 'USD' }, g: { fd: '2026-08-26', q: { rev: [105840000000, 110160000000] } } };
  const m = T.earnXFor(x, '2026-11-17');
  ok(m.a && m.g, 'התאמה: אנליסטים עם אותו תאריך, הנהלה מהודעה שלפני הדוח');
  ok(T.earnXFor(x, '2027-02-25') === null, 'דוח של רבעון אחר (תאריך רחוק) — בלי צפי');
  ok(T.earnXFor({ g: { fd: '2026-11-17', q: {} } }, '2026-11-17') === null, 'הודעה מיום הדוח עצמו (צפי לרבעון הבא) — לא מוצגת');
  ok(T.earnEpsTxt(2.4712, 'USD') === '$2.47' && T.earnEpsTxt(-0.08, 'USD') === '−$0.08' && T.earnRevTxt(6562743160, 'ILS') === '₪6.56B', 'פורמט: רווח למניה, הפסד, הכנסות בשקלים');
  ok(T.earnRevTxt(108731903900, 'USD') === '$108.7B' && T.earnRevTxt(492e6, 'USD') === '$492M', 'פורמט: מיליארדים מעל 100 בספרה אחת, מיליונים');
  ok(T.earnRangeTxt(105840000000, 110160000000, 'rev', 'USD') === '$105.8–110.2B' && T.earnRangeTxt(1.34, 1.36, 'eps', 'USD') === '$1.34–1.36' && T.earnRangeTxt(34.8e9, 34.8e9, 'rev', 'USD') === '$34.80B' && T.earnRangeTxt(390e9, 398e9, 'rev', 'USD') === '$390–398B', 'פורמט: טווחים (בלי ".0" מיותר), וערך יחיד בלי טווח');
  const tp = T.earnXTone({ q: { eps: 2.47, ec: 2.4712, e30: 2.4733, e90: 2.3524, up: 0, dn: 1 } });
  ok(tp.k === 'pos' && Math.abs(tp.d90 - 0.0505) < 0.001, 'מגמה: הצפי עלה 5% ב־90 יום (משקל כפול) למרות אנליסט אחד שהוריד — חיובית');
  ok(T.earnXTone({ q: { eps: 4.01, ec: 4.0565, e30: 4.0536, e90: 4.455, up: 1, dn: 2 } }).k === 'neg', 'מגמה: הצפי ירד 9% ב־90 יום והורידו יותר מהעלו — שלילית');
  ok(T.earnXTone({ q: { eps: 4.86, e30: 4.86, e90: 4.85, up: 1, dn: 1 } }).k === 'neu', 'מגמה: בלי תזוזה — ניטרלית');
  ok(T.earnXTone({ q: { eps: 1 } }) === null && T.earnXTone(null) === null, 'בלי נתוני מגמה — בלי סימון');
  const row = T.earnXRowHTML(m);
  ok(/צפי/.test(row) && row.includes('$2.47 · $108.7B') && !/הנהלה/.test(row), 'שורת הכרטיס: "צפי" של האנליסטים בלבד (ההנהלה בגיליון)');
  ok(T.earnXRowHTML({ a: null, g: { fd: '2026-10-29', y: { rev: [1995e6, 2020e6] } } }).includes('הנהלה · שנתי'), 'בלי אנליסטים — צפי ההנהלה (השנתי מסומן)');
  ok(T.earnXRowHTML(null) === '', 'בלי צפי — בלי שורה');
  const fyx = { a: { fy: 1, q: { eps: 4.86, rev: 96.69e9, e90: 4.85, e30: 4.86, up: 1, dn: 1 }, y: { eps: 20.01, rev: 396e9 }, cur: 'USD', h: { b: 4, n: 4, s: 5.6 } }, g: { fd: '2026-10-29', q: { rev: [95e9, 97e9] }, y: { rev: [390e9, 398e9] } } };
  // 17/11/2026 (בקשת המשתמש — הערכה אמיתית לפי השקעות ערך): שני אותות ודגל. הפיקסטורות — מספרים פומביים מעוגלים
  // (מיליארדים) מ־Yahoo, באותה צורה שהשרתון מחזיר
  const B = (o) => Object.assign({ q: ['2025-09-30', '2025-12-31', '2026-03-31', '2026-06-30', '2026-09-30'] }, o);
  const G = 1e9;
  // רבעון אשתקד עם רווח חד־פעמי גדול (שערוך השקעות), והרחוב לפי GAAP — הרווח לא בר השוואה
  const uber = B({ rev: [13.47, 14.37, 13.2, 14.4, 14.7].map((v) => v * G), op: [1.11, 1.79, 1.6, 1.9, 1.95].map((v) => v * G), pretax: [2.6, 1.9, 1.7, 2.0, 2.1].map((v) => v * G),
    ni: [6.63, 0.3, 1.5, 1.8, 1.9].map((v) => v * G), norm: [5.56, 0.3, 1.5, 1.8, 1.9].map((v) => v * G), unus: [1.44, 1.66, 0.1, 0.1, 0.1].map((v) => v * G),
    ocf: [2.3, 2.6, 2.5, 2.9, 2.6].map((v) => v * G), capex: [-0.06, -0.06, -0.07, -0.07, -0.07].map((v) => v * G), sbc: [0.5, 0.5, 0.5, 0.5, 0.5].map((v) => v * G),
    sh: [2.17, 2.15, 2.12, 2.1, 2.09].map((v) => v * G), eps: [3.11, 0.13, 0.7, 0.86, 0.9] });
  const ua = { q: { eps: 0.97, yEps: 0.13, rev: 15.66 * G, yRev: 14.37 * G, end: '2026-12-31' }, la: { e: 0.9, d: '2026-09-30' } };
  const ue = T.earnXExp(ua, uber);
  ok(ue.k === 'up' && ue.eps === null && ue.nc && Math.abs(ue.rev - 0.0898) < 0.001, 'ציפיות: חד־פעמי ברבעון אשתקד והרחוב כלל אותו — הרווח מוחרג, לפי ההכנסות (+9%)');
  ok(T.earnXFlags(ua, uber).some((f) => f.k === 'one'), 'דגל: חד־פעמי');
  // ORCL: המותאם אשתקד כלל רווח הון — קרוב יותר ל־GAAP מאשר למנורמל
  const orcl = B({ eps: [1.01, 2.1, 1.27, 1.45, 1.56], sh: [2.91, 2.92, 2.91, 2.92, 3].map((v) => v * G), norm: [3.35, 4.16, 3.92, 4.68, 4.81].map((v) => v * G),
    op: [4.69, 5.16, 5.64, 6.96, 6.82].map((v) => v * G), unus: [-0.5, 2.04, -0.23, -0.47, -0.06].map((v) => v * G), rev: [14.93, 16.06, 17.19, 19.18, 19.34].map((v) => v * G) });
  orcl.q = ['2025-08-31', '2025-11-30', '2026-02-28', '2026-05-31', '2026-08-31'];
  ok(T.earnXExp({ q: { eps: 1.89, yEps: 2.26, rev: 21.33 * G, yRev: 16.06 * G, end: '2026-11-30' } }, orcl).nc, 'ציפיות: גם רווח מותאם שכלל את החד־פעמי — מוחרג');
  // PFE: החריגה ב־GAAP בלבד, הרחוב (מותאם) רחוק ממנה — ההשוואה נקייה
  const pfe = B({ eps: [0.62, -0.29, 0.5, 0.6, 0.56], sh: [5.7, 5.7, 5.7, 5.7, 5.7].map((v) => v * G), norm: [4.4, 3.6, 3.9, 4.2, 4.1].map((v) => v * G),
    op: [4.5, 2.0, 4.0, 4.2, 4.0].map((v) => v * G), unus: [-0.5, -3.5, -0.4, -0.3, -1.6].map((v) => v * G), rev: [16.65, 17.76, 13.7, 14.7, 16.3].map((v) => v * G) });
  const pa = { q: { eps: 0.69, yEps: 0.66, rev: 17.22 * G, yRev: 17.56 * G, end: '2026-12-31' }, la: { e: 0.87, d: '2026-09-30' } };
  const pe = T.earnXExp(pa, pfe);
  ok(pe.eps != null && !pe.nc && pe.k === 'up', 'ציפיות: חריגה שהרחוב כבר החריג — הרווח נשאר בהשוואה');
  const pfl = T.earnXFlags(pa, pfe).find((f) => f.k === 'adj');
  ok(pfl && pfl.a === 0.87 && pfl.g === 0.56, 'דגל: פער מותאם/GAAP ברבעון האחרון');
  // מצבים
  ok(T.earnXExp({ q: { eps: 1.8, yEps: 2.1, rev: 90, yRev: 100 } }).k === 'down' && T.earnXExp({ q: { eps: 1.8, yEps: 2.1, rev: 110, yRev: 100 } }).k === 'mix', 'ציפיות: ירידה / מעורב');
  ok(T.earnXExp({ q: { eps: 2.01, yEps: 2, rev: 101, yRev: 100 } }).k === 'flat' && T.earnXExp({ q: { eps: 1 } }) === null && T.earnXExp(null) === null, 'ציפיות: עד 2% יציב; בלי אשתקד — בלי');
  ok(T.earnXExp({ q: { eps: -0.2, yEps: -0.5 } }).k === 'up', 'ציפיות: הפסד קטן מאשתקד — צמיחה');
  // מצב העסק
  const ub = T.earnXBiz(uber);
  ok(ub.k === 'up' && ub.n === 5 && ub.sh < 0 && ub.cc > 1, 'העסק: הכנסות, שוליים, תזרים חופשי, רכישה חוזרת והמרת מזומן — משתפר');
  const weak = B({ rev: [100, 100, 100, 100, 90], op: [20, 20, 20, 20, 12], ocf: [20, 10, 10, 8, 8], ni: [15, 15, 15, 15, 15], sh: [10, 10, 10, 10, 10.5], capex: [-5, -5, -5, -5, -5] });
  ok(T.earnXBiz(weak).k === 'down', 'העסק: הכנסות ושוליים יורדים, דילול, רווח בלי מזומן — נחלש');
  ok(T.earnXBiz(null) === null && T.earnXBiz(B({ rev: [1, 1, 1, 1, 1] })) === null, 'העסק: פחות משני רכיבים — בלי');
  ok(T.earnXFlags(ua, weak).some((f) => f.k === 'cash'), 'דגל: רווח בלי מזומן');
  // רכישה (NVDA: 13.2B ברבעון אחד, המוניטין קפץ)
  const nv = B({ rev: [46.7, 57, 68.1, 81.6, 96.2].map((v) => v * G), acq: [-0.29, -0.69, -13.16, -0.09, -0.21].map((v) => v * G), gw: [5.75, 6.26, 20.83, 20.89, 21.13].map((v) => v * G) });
  ok(T.earnXFlags({ q: {} }, nv).some((f) => f.k === 'acq') && !T.earnXFlags({ q: {} }, B({ rev: [10, 10, 10, 10, 10], acq: [-0.1, 0, 0, 0, 0], gw: [5, 5, 5, 5, 5] })).length, 'דגל: רכישה משמעותית; רכישה זניחה — בלי');
  // הכרטיס
  const uex = { a: Object.assign({ cur: 'USD', h: { b: 4, n: 4 } }, ua), g: null, b: uber };
  const urow = T.earnXSigHTML(uex);
  ok(/^<span class="earn-sigs">/.test(urow) && !/earn-sig/.test(T.earnXRowHTML(uex)), 'האותות — תחתית ברוחב הכרטיס, לא בתוך שורת הצפי');
  ok(/earn-tone pos[^>]*><span aria-hidden="true">▲<\/span> ציפיות: צמיחה/.test(urow) && /class="earn-fc-v">הכנסות ⁦\+9\.0%⁩</.test(urow), 'בכרטיס: "ציפיות: צמיחה · הכנסות +9%" (בלי "לא בר השוואה" — בגיליון)');
  ok(/העסק: משתפר/.test(urow) && /class="earn-flag"[^>]*>.*יש חריגה/.test(urow), 'בכרטיס: "העסק: משתפר" ו"יש חריגה"');
  ok(!/עקפה/.test(urow) && !/מגמה/.test(urow), 'עקיפת הצפי ומגמת הצפי — רק בגיליון');
  ok(urow.indexOf('ציפיות') < urow.indexOf('העסק'), 'הסדר: ציפיות, ואחריהן העסק');
  ok(/earn-tone neg/.test(T.earnXSigHTML({ a: { q: { eps: 1.8, yEps: 2.1, rev: 9e8, yRev: 1e9 }, cur: 'USD' } })) && T.earnXSigHTML({ a: { q: { eps: 2, rev: 1e9 }, cur: 'USD' } }) === '', 'ירידה — אדומה; בלי אשתקד ובלי נתוני עסק — בלי תחתית');
  ok(T.earnXSigHTML({ a: null, g: { fd: '2026-10-29', y: { rev: [1995e6, 2020e6] } } }) === '' && T.earnXSigHTML(null) === '', 'צפי הנהלה בלבד — בלי אותות');
  ok(/earnXSigHTML\(exr\)/.test(fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8')), 'הכרטיס מחבר את התחתית');
  ok(/\.earn-sigs \{ flex: 1 0 100%;/.test(fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8')), 'התחתית ברוחב מלא');
  // הגיליון
  const ush = T.earnXSheetHTML(uex);
  ok(/ציפיות לרבעון/.test(ush) && /מצב העסק/.test(ush) && /שולי רווח תפעולי/.test(ush) && /המרת מזומן/.test(ush) && /לא בר השוואה/.test(ush), 'הגיליון: שני הסעיפים עם הרכיבים, ו"לא בר השוואה"');
  ok(/class="esx-flag"[^>]*>.*רווח חד־פעמי/.test(ush) && /לא תחזית ולא המלצה/.test(ush) && /רוב החברות עוקפות/.test(ush), 'הגיליון: הדגל במילים, ההסתייגות, וההערה על עקיפת הצפי');
  ok(/esx-flag[^<]*<span aria-hidden="true">⚠<\/span> הרווח ״של הרחוב״ ברבעון האחרון ⁦\$0\.87⁩ מול ⁦\$0\.56⁩/.test(T.earnXSheetHTML({ a: Object.assign({ cur: 'USD' }, pa), g: null, b: pfe })), 'הגיליון: פער מותאם/GAAP עם שני המספרים');
  const sh = T.earnXSheetHTML(m);
  ok(/צפי לדוח/.test(sh) && /רווח למניה/.test(sh) && /הכנסות/.test(sh) && /43 אנליסטים/.test(sh) && /לפני שנה/.test(sh) && /26\/08\/2026/.test(sh), 'הגיליון: טבלה, מספר אנליסטים, לפני שנה ומקור צפי ההנהלה');
  ok(!/<img/i.test(T.earnXSheetHTML({ a: { q: { eps: 1 }, cur: '<img onerror=x>' } })), 'מטבע מוזר לא מוזרק כ־HTML');
  ok(T.LS_CACHE_PREFIXES.includes('pwa_earnx_v1') && fs.readFileSync(path.join(__dirname, '..', 'move.js'), 'utf8').includes("'pwa_earnx_v1'"), 'המטמון ב־LS_CACHE_PREFIXES וב־move.js');
  const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
  ok(['.earn-x', '.es-x', '.esx-grid', '.esx-v'].every((c) => css.includes(c)), 'הסגנונות קיימים');
  // 17/11/2026 (בקשת המשתמש): קרוסלה אופקית — העמוד נגלל למעלה/למטה, הדוחות לצדדים; בלי גלילה פנימית אנכית
  const appSrc = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  ok(!/\.earn-list\.earn-scroll/.test(css) && !/overflow-y: auto/.test((css.match(/\.earn-list \{[^}]*\}/) || [''])[0]), 'אין יותר רשימה שנגללת למעלה/למטה בתוך הכרטיס');
  ok(/\.earn-list \{ display: flex;/.test(css) && /\.earn-list > \.earn-row \{ flex: 0 0 86%;/.test(css), 'קרוסלה: כרטיס 86% — הבא מציץ בקצה');
  ok(/HS_ROWS = '[^']*\.earn-list[^']*'/.test(appSrc), 'הגרירה דרך initHScroll (בלי שכבה שנעלמת בנחיתה) — וגם חוסמת החלקת עמוד');
  ok(!/id="earnMore"/.test(html) && !/earnMoreUpdate|sizeEarnWindow|earnWinRows/.test(appSrc), '"עוד N דוחות" והחלון האנכי הוסרו');
  ok(/id="earnCnt"/.test(html) && /<span data-i18n-html="earnTitle">/.test(html), 'מספר הדוחות ליד הכותרת (מחוץ לתרגום)');
  const st = [0, -300, -600, -900];
  ok(T.hsSnapTarget(st, 0, -40) === 0 && T.hsSnapTarget(st, 0, -200) === -300, 'נעצרת על הכרטיס הקרוב');
  ok(T.hsSnapTarget(st, -300, -2000) === -600 && T.hsSnapTarget(st, -300, 900) === 0, 'תנופה חזקה — לכל היותר כרטיס אחד');
  ok(T.hsSnapTarget([], 0, -55) === -55, 'בלי כרטיסים — בלי עצירה');

  console.log('\nכל הבדיקות עברו ✓ (סה"כ אסרטים: ' + n + ')');
})().catch((e) => { console.error(e); process.exit(1); });
