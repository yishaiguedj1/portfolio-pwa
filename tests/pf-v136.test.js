// pf-v136.test.js — סנכרון IBKR אחרי חצות בישראל נכשל ב־flex_1003.
// דיווח (25/09/2026, 00:17 בישראל): "חלק 20260101–20260924 נכשל (flex_1003 —
// Statement is not available)". תאריך הסיום היה "אתמול" לפי שעון ישראל = 24/09,
// אבל בניו־יורק עדיין 24/09 17:17 — היום לא נגמר ו־IBKR לא פרסם עליו דוח.
// mocks בלבד — לעולם לא הטוקן האמיתי.
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
  Intl,
};
vm.createContext(sb);
vm.runInContext(src, sb);
const A = (k) => vm.runInContext(k, sb);
const ymd = A('ibkrYmd');

(async () => {
  // --- 1. יום המסחר האחרון שנסגר — לפי ניו־יורק ---
  const last = A('ibkrLastClosedDate');
  ok(ymd(last(new Date('2026-09-24T21:17:00Z'))) === '20260923', '00:17 בישראל (17:17 בניו־יורק, 24/09): הסגור האחרון = 23/09');
  ok(ymd(last(new Date('2026-09-25T13:00:00Z'))) === '20260924', '16:00 בישראל (09:00 בניו־יורק, 25/09): הסגור האחרון = 24/09');
  ok(ymd(last(new Date('2026-01-01T03:00:00Z'))) === '20251230', 'מעבר שנה: 31/12 22:00 בניו־יורק → 30/12');

  const prevWd = A('ibkrPrevWeekdayYmd');
  ok(prevWd('20260928') === '20260925', 'יום חול קודם: שני → שישי');
  ok(prevWd('20260924') === '20260923', 'יום חול קודם: חמישי → רביעי');

  // --- 2. החלק העדכני מקבל 1003 → ניסיון אחד שמסתיים יום מסחר קודם ---
  const reqs = [];
  const chunk = (fd, td) => ({
    meta: { fromDate: fd.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'), toDate: td.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'), baseCurrency: 'USD' },
    trades: [], positions: [{ symbol: 'ACME', asset: 'STK', qty: 1, markPrice: 10, currency: 'USD', levelOfDetail: 'SUMMARY' }],
    cashTransactions: [], navHistory: [], cashBalances: [],
  });
  const mk = (notReadyTd) => async (url, opts) => {
    const body = JSON.parse(opts.body);
    if (String(url).includes('/api/flex-request')) {
      reqs.push(body.fd + '-' + body.td);
      return { json: async () => ({ ok: true, referenceCode: body.fd + '-' + body.td, statementUrl: 'x' }) };
    }
    const [fd, td] = body.code.split('-');
    if (td === notReadyTd) return { json: async () => ({ ok: false, error: 'flex_1003', message: 'Statement is not available' }) };
    return { json: async () => ({ ok: true, status: 'ready', data: chunk(fd, td) }) };
  };
  const endDate = new Date(2026, 8, 24);
  const full = A('ibkrFetchFullHistory');
  const m = await full(mk('20260924'), 'https://p', 'tok', '1', '20250101', null, { chunkGapMs: 1, tries: 1, endDate });
  ok(m.latestChunkOk === true, 'הסנכרון מושלם למרות ש־24/09 עוד לא פורסם');
  ok(m.meta.toDate === '2026-09-23', 'הנתונים עד 23/09 — סנכרון ההמשך ישלים את 24/09');
  ok(!m._chunks.some((c) => !c.ok), 'אין חלק שנכשל (אין אזהרת פער)');
  ok(A('ibkrSyncIsComplete')(m) === true, 'מותר לייבא');
  ok(reqs.filter((r) => r === '20260101-20260924').length === 3, 'הטווח המקורי: 3 ניסיונות כמו ב־v111 (לא שונה)');
  ok(reqs.filter((r) => r === '20260101-20260923').length === 1, 'גיבוי: ניסיון אחד בלבד שמסתיים ביום המסחר הקודם');

  // שני הימים לא זמינים → עדיין נכשל בגלוי, לא ממציא
  reqs.length = 0;
  const bad = async (url, opts) => {
    const body = JSON.parse(opts.body);
    if (String(url).includes('/api/flex-request')) return { json: async () => ({ ok: true, referenceCode: body.fd + '-' + body.td, statementUrl: 'x' }) };
    const [fd, td] = body.code.split('-');
    if (fd === '20260101') return { json: async () => ({ ok: false, error: 'flex_1003', message: 'x' }) };
    return { json: async () => ({ ok: true, status: 'ready', data: chunk(fd, td) }) };
  };
  const m2 = await full(bad, 'https://p', 'tok', '1', '20250101', null, { chunkGapMs: 1, tries: 1, endDate });
  ok(m2.latestChunkOk === false && A('ibkrSyncIsComplete')(m2) === false, 'גם הניסיון הקודם נכשל → לא מייבאים, הודעה כרגיל');

  const ver = (src.match(/APP_VERSION = '(v\d+)'/) || [])[1];
  ok(fs.readFileSync(path.join(root, 'sw.js'), 'utf8').includes('portfolio-pwa-' + ver), 'CACHE_NAME תואם לגרסה');
  console.log('\n' + n + ' בדיקות עברו');
})().catch((e) => { console.error('נכשל:', e && e.stack || e); process.exit(1); });
