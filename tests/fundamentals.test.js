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
const dmd = require(path.join(root, 'ibkr-proxy/lib/damodaran.json'));
ok(dmd.erp > 0.02 && dmd.erp < 0.08 && dmd.crpIL > 0 && Object.keys(dmd.ind).length > 80, 'damodaran.json: פרמיית שוק, פרמיית ישראל ויותר מ־80 ענפים');

/* ---------- המסלול המלא: /api/history עם op:'fund' / op:'macro' ---------- */
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
