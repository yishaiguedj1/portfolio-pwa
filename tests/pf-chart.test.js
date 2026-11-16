/* בדיקות ללוגיקת גרף הביצועים: טווחים, נרמול, תשואה, בנצ'מרקים.
   הרצה: node tests/pf-chart.test.js */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

let n = 0;
const ok = (cond, name) => { n++; assert(cond, name); console.log('ok -', name); };

const store = {};
const localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};
const document = {
  addEventListener() {},
  getElementById: () => null,
  querySelectorAll: () => [],
  createElement: () => ({}),
};
let fetchCalls = 0;
let histApi = null; // מדמה את /api/history של השרתון (null = השרתון לא עונה)
const histReqs = [];
const sandbox = {
  localStorage, document,
  window: {}, navigator: {}, location: {},
  AbortController,
  fetch: async (url, opts) => {
    fetchCalls++;
    if (String(url).includes('/api/history') && histApi) {
      const body = JSON.parse(opts.body);
      histReqs.push(body);
      return { ok: true, json: async () => histApi(body) };
    }
    if (String(url).includes('stooq.com')) {
      let csv = 'Date,Open,High,Low,Close,Volume\n';
      for (let i = 40; i >= 1; i--) {
        const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
        csv += d + ',1,1,1,' + (100 + (40 - i)) + ',1\n';
      }
      return { ok: true, text: async () => csv };
    }
    throw new Error('unexpected fetch: ' + url);
  },
  setTimeout, clearTimeout, console,
};
vm.createContext(sandbox);
const src = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8') +
  '\n;globalThis.__t = { filterRange, sliceFromDate, retPct, normalize100, getBenchHist, closeOnOrBefore, todayISO, benchRangeFor, benchRowsForDates, benchStore, addDaysISO };';
vm.runInContext(src, sandbox, { filename: 'app.js' });
const T = sandbox.__t;
ok(!!T, 'app.js נטען בלי שגיאות תחביר');

/* ---------- עזר: בניית שורות יומיות ---------- */
function dailyRows(nDays, endISO) {
  const rows = [];
  const d = new Date(endISO + 'T12:00:00Z');
  for (let i = nDays - 1; i >= 0; i--) {
    const x = new Date(d.getTime() - i * 86400000);
    rows.push({ date: x.toISOString().slice(0, 10), value: 100 + i });
  }
  return rows;
}

/* ---------- filterRange ---------- */
{
  const rows = dailyRows(1500, T.todayISO());
  ok(T.filterRange(rows, 'max').length === 1500, 'max מחזיר הכל');
  const m1 = T.filterRange(rows, '1m');
  ok(m1.length === 22, '1m חותך ל־22 נקודות אחרונות, בפועל ' + m1.length);
  const m3 = T.filterRange(rows, '3m');
  ok(m3.length === 66, '3m = 66 נקודות אחרונות, בפועל ' + m3.length);
  const m6 = T.filterRange(rows, '6m');
  ok(m6.length === 132, '6m = 132 נקודות אחרונות, בפועל ' + m6.length);
  const ytd = T.filterRange(rows, 'ytd');
  ok(ytd.length >= 2 && ytd[0].date.startsWith(String(new Date().getFullYear())), 'ytd מתחיל בינואר השנה');
  ok(T.filterRange(rows, 'zzz').length === 1500, 'טווח לא מוכר מחזיר הכל');
  ok(T.filterRange([], '1m').length === 0, 'מערך ריק לא קורס');
}

/* ---------- sliceFromDate ---------- */
{
  const rows = [{ date: '2025-01-01' }, { date: '2025-01-03' }, { date: '2025-01-05' }];
  ok(T.sliceFromDate(rows, '2025-01-03').length === 2, 'חיתוך מתאריך אמצעי');
  ok(T.sliceFromDate(rows, '2025-01-01').length === 3, 'תאריך ראשון מחזיר הכל');
  ok(T.sliceFromDate(rows, '2024-01-01').length === 3, 'תאריך מוקדם יותר מחזיר הכל');
  ok(T.sliceFromDate(rows, '2026-01-01').length === 0, 'תאריך עתידי מחזיר ריק');
  ok(T.sliceFromDate([], '2025-01-01').length === 0, 'מערך ריק');
}

/* ---------- retPct ---------- */
{
  ok(Math.abs(T.retPct(100, 110) - 10) < 1e-9, 'תשואה חיובית');
  ok(Math.abs(T.retPct(100, 90) + 10) < 1e-9, 'תשואה שלילית');
  ok(T.retPct(100, 100) === 0, 'אפס');
  ok(T.retPct(0, 50) === null, 'חלוקה באפס מחזירה null');
  ok(Math.abs(T.retPct(3, 4) - 33.3333) < 0.001, 'שברירי');
}

/* ---------- normalize100 ---------- */
{
  const out = T.normalize100([{ date: 'a', value: 50 }, { date: 'b', value: 100 }, { date: 'c', value: 25 }]);
  ok(out[0].norm === 100 && out[1].norm === 200 && out[2].norm === 50, 'נרמול יחסי ל־100');
  ok(out[0].date === 'a', 'תאריכים נשמרים');
  const z = T.normalize100([{ date: 'a', value: 0 }, { date: 'b', value: 5 }]);
  ok(z.length === 0, 'ערך התחלה 0 מחזיר ריק (לא ניתן לנרמל)');
  ok(T.normalize100([]).length === 0, 'ריק');
}

/* ---------- getBenchHist (עם שרתון מדומה) ---------- */
(async () => {
  const today = T.todayISO();
  // שרתון מדומה: ימי מסחר מתאריך עד היום (ימים מאז 1970). ^SP500TR מ־1988, ^XNDX מ־1999 — כמו אצל המפרסמים
  const series = (fromIso) => {
    const t = [], c = [];
    const d0 = Math.floor(Date.parse(fromIso + 'T00:00:00Z') / 86400000), d1 = Math.floor(Date.now() / 86400000);
    for (let d = d0; d <= d1; d++) { const wd = new Date(d * 86400000).getUTCDay(); if (wd && wd !== 6) { t.push(d); c.push(50 + (d - d0) / 100); } }
    return { t, c };
  };
  const startOf = { '^SP500TR': '1988-01-04', '^XNDX': '1999-03-04' };
  histApi = (b) => {
    const data = {};
    for (const s of b.syms) {
      const from = b.range === 'max' ? startOf[s] : T.addDaysISO(today, b.range === '10y' ? -3653 : -1826);
      data[s] = series(from > startOf[s] ? from : startOf[s]);
    }
    return { ok: true, data };
  };
  // מטמון ישן עם SPY/QQQ (מחיר בלבד, עד 2.157.1) — לא נשאר
  store.pwa_bench_v1 = JSON.stringify({ SPY: { updated: today, rows: [['2026-01-02', 1]] }, QQQ: { updated: today, rows: [] } });
  const sp = await T.getBenchHist('^SP500TR');
  ok(!T.benchStore().SPY && !T.benchStore().QQQ, 'SPY/QQQ הישנים נמחקו מהמטמון');
  ok(sp.length > 1000 && histReqs[0].range === '5y' && histReqs[0].syms.join() === '^SP500TR,^XNDX', 'בלי תאריך: 5 שנים מהשרתון, בקשה אחת לשני מדדי התשואה הכוללת');
  ok(/^\d{4}-\d{2}-\d{2}$/.test(sp[0].date) && sp[0].close > 0, 'שורה ראשונה תקינה');
  const calls = histReqs.length;
  await T.getBenchHist('^SP500TR');
  ok(histReqs.length === calls, 'קריאה שנייה מהמטמון — בלי בקשה');
  ok((await T.getBenchHist('SPY')) === null, 'SPY (מחיר בלבד) כבר לא מדד השוואה');
  ok((await T.getBenchHist('XXX')) === null, 'סימול לא מוכר מחזיר null');
  ok((await T.getBenchHist('^sp500tr')) === null, 'אותיות קטנות לא מתקבלות');

  /* ---------- closeOnOrBefore ---------- */
  const hist = [{ date: '2025-01-02', close: 100 }, { date: '2025-01-03', close: 110 }];
  ok(T.closeOnOrBefore(hist, '2025-01-03') === 110, 'תאריך מדויק');
  ok(T.closeOnOrBefore(hist, '2025-01-04') === 110, 'סוף שבוע נצמד לאחור');
  ok(T.closeOnOrBefore(hist, '2025-01-01') === null, 'לפני ההתחלה — null');
  ok(T.closeOnOrBefore([], '2025-01-01') === null, 'היסטוריה ריקה');

  /* ---------- 16/11/2026: המדדים ב־5Y ובמקסימום ---------- */
  ok(T.benchRangeFor(null, today) === '5y', 'בלי תאריך — 5 שנים');
  ok(T.benchRangeFor(T.addDaysISO(today, -3 * 366), today) === '5y', '3Y — מספיק 5 שנים');
  ok(T.benchRangeFor(T.addDaysISO(today, -1826 - 17), today) === '10y', '5Y (יום הבסיס לפני הנר הראשון של 5y) — 10 שנים');
  ok(T.benchRangeFor('2005-11-01', today) === 'max', 'תיק מ־2005 — מתחילת המדד');

  const from05 = '2005-12-01';
  const r0 = histReqs.length;
  const [spL, ndL] = await Promise.all([T.getBenchHist('^SP500TR', from05), T.getBenchHist('^XNDX', from05)]);
  ok(histReqs.length === r0 + 1 && histReqs[r0].range === 'max' && histReqs[r0].syms.join() === '^SP500TR,^XNDX', 'מקסימום: בקשה אחת לשני המדדים, range=max');
  ok(spL[0].date <= T.addDaysISO(from05, -14) && spL[0].date >= T.addDaysISO(from05, -24), 'S&P 500 TR מכסה את תחילת התיק (נחתך לשבועיים לפני — לא שומרים מ־1988)');
  ok(ndL[0].date <= from05, 'Nasdaq-100 TR מכסה את 2005');
  const pfDates = ['2005-12-01', '2006-06-01', today];
  ok(T.benchRowsForDates(spL, pfDates) && T.benchRowsForDates(ndL, pfDates), 'הקווים מתיישרים לכל תאריכי התיק — לא null');
  const before = histReqs.length;
  await T.getBenchHist('^SP500TR', '2010-01-04');
  ok(histReqs.length === before, 'טווח קצר יותר — מהמטמון, בלי בקשה');

  // Nasdaq-100 TR מתחיל ב־1999: בקשה מ־1995 נשמרת כ"שלמה" ולא נמשכת שוב בכל ציור
  const r95 = await T.getBenchHist('^XNDX', '1995-06-01');
  const afterQ = histReqs.length;
  ok(r95[0].date >= '1999-03-04', 'Nasdaq-100 TR מתחילת המדד');
  await T.getBenchHist('^XNDX', '1995-06-01');
  ok(histReqs.length === afterQ, 'מדד שהתחיל אחרי תחילת התיק — לא נמשך שוב');

  // 5Y: יום הבסיס של התיק לפני הנר הראשון של '5y' — עכשיו 10y
  const base5 = T.addDaysISO(today, -1829);
  const sp5 = await T.getBenchHist('^SP500TR', base5);
  ok(T.benchRowsForDates(sp5, [base5, today]) !== null, '5Y: יש ערך גם ליום הבסיס');

  // השרתון נופל ביום חדש — נשאר המטמון הארוך, לא נדרס
  histApi = (b) => ({ ok: false, error: 'down' });
  T.benchStore()['^SP500TR'].updated = '2000-01-01';
  const st = await T.getBenchHist('^SP500TR', from05);
  ok(st.length > 1000 && st[0].date <= from05, 'שרתון לא עונה — ההיסטוריה הארוכה מהמטמון');
  ok(T.benchStore()['^SP500TR'].rows[0][0] <= from05, 'המטמון הארוך לא נדרס');

  /* ---------- השרתון: Nasdaq-100 TR מהמפרסם (parseNasdaqIdx) ---------- */
  const H = require('../ibkr-proxy/api/history.js');
  const pv = H._parseNasdaqIdx({ aaData: [
    { TimeStamp: '/Date(1794805200000)/', Value: null },          // היום — עוד בלי סגירה
    { TimeStamp: '/Date(1794546000000)/', Value: 34167.37830030993 },
    { TimeStamp: '/Date(1794459600000)/', Value: 34587.75772939639 },
    { TimeStamp: '/Date(920523600000)/', Value: 1933.03 },
  ] });
  const iso = (d) => new Date(d * 86400000).toISOString().slice(0, 10);
  ok(pv && pv.t.map(iso).join() === '1999-03-04,2026-11-12,2026-11-13', 'Nasdaq: תאריכי מסחר נכונים (חצות ניו־יורק), ישן → חדש, בלי היום הריק');
  ok(pv.c[2] === 34167.3783 && pv.c[0] === 1933.03, 'Nasdaq: ערכים מעוגלים כמו parseChart');
  ok(H._parseNasdaqIdx({ aaData: [] }) === null && H._parseNasdaqIdx(null) === null, 'Nasdaq: תשובה ריקה → null');
  const hsrc = fs.readFileSync(path.join(__dirname, '..', 'ibkr-proxy', 'api', 'history.js'), 'utf8');
  ok(/NQ_IDX\[sym\] && !INTRA\[range\]/.test(hsrc), 'השרתון: ^XNDX יומי מ־Nasdaq (ב־Yahoo רק מחיר נוכחי), תוך־יומי — Yahoo');

  console.log('\nכל ' + n + ' הבדיקות עברו.');
})().catch((e) => { console.error('נכשל:', e.message); process.exit(1); });
