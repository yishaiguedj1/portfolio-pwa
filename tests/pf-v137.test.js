// pf-v137.test.js — משיכת 5 שנים לחשבון צעיר יותר נכשלה.
// דיווח (25/09/2026): 3 שנים עובד, 5 שנים → "חלק 20210101–20211231 נכשל (flex_1003)
// ; חלק 20220101–20221231 נכשל (flex_1003)" וכל הסנכרון בוטל: שני כשלונות רצופים
// עוצרים את המשיכה. 1003 לפני שחלק כלשהו החזיר נתונים = שנים שלפני פתיחת החשבון.
// mocks בלבד.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

let n = 0;
function ok(cond, name) {
  n++;
  if (!cond) { console.error('FAIL - ' + name); process.exit(1); }
  console.log('ok - ' + name);
}

const sb = {
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  document: {
    addEventListener() {}, getElementById: () => null,
    querySelectorAll: () => [], querySelector: () => null,
    createElement: () => ({ classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {} }),
  },
  window: {}, navigator: {}, location: {},
  AbortController, fetch: () => Promise.reject(new Error('no net')),
  setTimeout, clearTimeout, console: { log() {}, warn() {}, error: console.error },
};
vm.createContext(sb);
vm.runInContext(src, sb);
const A = (k) => vm.runInContext(k, sb);
const full = A('ibkrFetchFullHistory');
const iso = (y) => y.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');

// החשבון נפתח ב־2023: כל טווח שמסתיים לפני 2023 → 1003
function mkFetch(opened, extraFail) {
  const reqs = [];
  const fn = async (url, opts) => {
    const body = JSON.parse(opts.body);
    if (String(url).includes('/api/flex-request')) {
      reqs.push(body.fd + '-' + body.td);
      return { json: async () => ({ ok: true, referenceCode: body.fd + '-' + body.td, statementUrl: 'x' }) };
    }
    const [fd, td] = body.code.split('-');
    if (td < opened || (extraFail && extraFail(fd, td))) return { json: async () => ({ ok: false, error: 'flex_1003', message: 'Statement is not available.' }) };
    return { json: async () => ({ ok: true, status: 'ready', data: {
      meta: { fromDate: iso(fd < opened ? opened : fd), toDate: iso(td), baseCurrency: 'USD' },
      trades: [], positions: [{ symbol: 'ACME', asset: 'STK', qty: 1, markPrice: 10, currency: 'USD', levelOfDetail: 'SUMMARY' }],
      cashTransactions: [], navHistory: [{ fromDate: iso(fd), toDate: iso(td), startingValue: 1, endingValue: 1, twr: 0 }], cashBalances: [],
    } }) };
  };
  fn.reqs = reqs;
  return fn;
}
const endDate = new Date(2026, 8, 23);
const opts = { chunkGapMs: 1, tries: 1, endDate };

(async () => {
  // --- 1. 5 שנים לחשבון מ־2023 ---
  const f = mkFetch('20230101');
  const m = await full(f, 'https://p', 'tok', '1', '20210101', null, opts);
  ok(m.latestChunkOk === true && A('ibkrSyncIsComplete')(m) === true, '5 שנים: הסנכרון מושלם ומותר לייבא');
  ok(!m._stopped, 'לא נעצר בגלל "שני כשלונות רצופים"');
  ok(!m._chunks.some((c) => !c.ok), 'אין חלק נכשל → אין הודעת שגיאה ואין אזהרת פער');
  ok(m._chunks.filter((c) => c.noData).length === 2, '2021 ו־2022 מסומנים "לפני פתיחת החשבון"');
  ok(m.meta.fromDate === '2023-01-01', 'תחילת הנתונים = 2023, לא 2021');
  ok(f.reqs.filter((r) => r.startsWith('2021')).length === 1 && f.reqs.filter((r) => r.startsWith('2022')).length === 1,
    'שנה ריקה ישנה: בקשה אחת בלבד (בלי 3 ניסיונות × 15 שניות, בלי סיכון 1025)');

  // --- 2. 1003 באמצע (אחרי שכבר היו נתונים) — עדיין כשל גלוי ---
  const g = mkFetch('20230101', (fd) => fd === '20240101');
  const m2 = await full(g, 'https://p', 'tok', '1', '20210101', null, opts);
  const bad = m2._chunks.filter((c) => !c.ok);
  ok(bad.length === 1 && bad[0].fd === '20240101', 'חור באמצע ההיסטוריה נשאר כשל → אזהרת פער כרגיל');
  ok(m2.latestChunkOk === true, 'החלק העדכני הצליח — היבוא עם אזהרה');

  // --- 3. הכל 1003 (כולל העדכני) → כשל, לא "ריק" ---
  const h = mkFetch('29990101');
  const m3 = await full(h, 'https://p', 'tok', '1', '20230101', null, opts);
  ok(m3.latestChunkOk === false && A('ibkrSyncIsComplete')(m3) === false, 'שום חלק לא הצליח → לא מייבאים');
  ok(m3._chunks.some((c) => !c.ok) && !m3._chunks.some((c) => c.noData), 'הכשלונות מוצגים, לא מוסתרים כ"לפני החשבון"');

  const ver = (src.match(/APP_VERSION = '(v\d+)'/) || [])[1];
  ok(fs.readFileSync(path.join(root, 'sw.js'), 'utf8').includes('portfolio-pwa-' + ver), 'CACHE_NAME תואם לגרסה');
  console.log('\n' + n + ' בדיקות עברו');
})().catch((e) => { console.error('נכשל:', e && e.stack || e); process.exit(1); });
