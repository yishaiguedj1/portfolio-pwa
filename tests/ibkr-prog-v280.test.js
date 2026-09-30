// v280: כרטיס התקדמות של משיכת IBKR — תוויות הדוחות, חלק ההתקדמות, ודיווח onChunk מתוך ibkrFetchFullHistory
const fs = require('fs');
const path = require('path');
const vm = require('vm');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const store = {};
function elStub() { return { value: '', textContent: '', innerHTML: '', classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {}, appendChild() {}, dataset: {}, style: {}, setAttribute() {}, querySelectorAll: () => [], querySelector: () => null }; }
const els = {};
const sandbox = {
  localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
  document: { addEventListener() {}, getElementById: (id) => (els[id] || (els[id] = elStub())), querySelectorAll: () => [], createElement: () => elStub() },
  window: {}, navigator: {}, location: { reload() {} }, AbortController, fetch: async () => { throw new Error('no fetch'); },
  setTimeout, clearTimeout, confirm: () => true, console,
};
vm.createContext(sandbox);
const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
vm.runInContext(app + '\n;globalThis.__t = { ibkrFetchFullHistory, ibkrChunkLabel, ibkrChunkFrac, ibkrYmd, ibkrDateChunks, ibkrProgressOpen };', sandbox, { filename: 'app.js' });
const T = sandbox.__t;
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

// תוויות
const L = (a, b) => { const x = T.ibkrChunkLabel(a, b); return x.y + '|' + x.sub; };
ok(L('20230101', '20231231') === '2023|', 'שנה מלאה = השנה');
ok(L('20240101', '20241230') === '2024|', 'שנה מעוברת (1/1–30/12) = השנה');
ok(L('20241231', '20241231') === '31/12/2024|', 'יום בודד = תאריך');
ok(L('20260101', '20260929') === '2026|עד 29/09', 'השנה הנוכחית — "עד"');
ok(L('20260922', '20260929') === '2026|22/09–29/09', 'סנכרון המשך — טווח ימים');
// חלק ההתקדמות
ok(T.ibkrChunkFrac({ state: 'wait' }) === 0 && T.ibkrChunkFrac({ state: 'done' }) === 1 && T.ibkrChunkFrac({ state: 'skip' }) === 1, 'בתור = 0, הושלם/דולג = 1');
const f1 = T.ibkrChunkFrac({ state: 'now', stage: 'wait', n: 1 }), f5 = T.ibkrChunkFrac({ state: 'now', stage: 'wait', n: 5 });
ok(T.ibkrChunkFrac({ state: 'now', stage: 'request' }) < f1 && f1 < f5 && f5 < 1, 'כל בדיקה של IBKR מקדמת — אף פעם לא מגיעה ל־100% לפני שהדוח התקבל');

(async () => {
  // שלושה חלקים: הראשון 1003 (לפני פתיחת החשבון), שני האחרים מצליחים
  const endD = new Date(2026, 8, 29);
  const start = '20240101';
  const chunks = T.ibkrDateChunks(start, T.ibkrYmd(endD));
  const seen = [];
  const f = async (url, opts) => {
    const b = JSON.parse(opts.body);
    if (String(url).includes('flex-request')) return { json: async () => ({ ok: true, referenceCode: 'R' + b.fd, statementUrl: '' }) };
    if (b.code === 'R' + chunks[0].fd) return { json: async () => ({ ok: false, error: 'flex_1003' }) };
    return { json: async () => ({ ok: true, status: 'ready', data: { meta: { fromDate: '2025-01-01', toDate: '2026-09-29' }, trades: [{ tradeId: b.code, date: '2025-02-01', symbol: 'A', qty: 1, side: 'BUY', price: 1 }], cashTransactions: [], positions: [], navHistory: [] } }) };
  };
  await T.ibkrFetchFullHistory(f, 'https://p', 'tok', '1', start, null, { chunkGapMs: 5, endDate: endD, onChunk: (x) => seen.push(x.state + ':' + x.fd + (x.trades !== undefined ? ':' + x.trades : '')) });
  ok(seen[0] === 'start:' + chunks[0].fd && seen[1] === 'skip:' + chunks[0].fd, 'חלק לפני פתיחת החשבון — start ואז skip');
  ok(seen.filter((s) => s.startsWith('done:')).length === chunks.length - 1, 'כל חלק שהצליח מדווח done');
  ok(seen.some((s) => s === 'done:' + chunks[1].fd + ':1'), 'done כולל את מספר העסקאות');
  // כשל: שני חלקים נכשלים → fail לכל אחד
  const seen2 = [];
  const bad = async (url) => (String(url).includes('flex-request') ? { json: async () => ({ ok: true, referenceCode: 'R', statementUrl: '' }) } : { json: async () => ({ ok: false, error: 'flex_1019' }) });
  await T.ibkrFetchFullHistory(bad, 'https://p', 'tok', '1', '20250101', null, { chunkGapMs: 5, endDate: endD, onChunk: (x) => seen2.push(x.state) });
  ok(seen2.filter((s) => s === 'fail').length >= 2, 'חלקים שנכשלו מדווחים fail');
  // מקור אמת אחד לרשימת הדוחות
  ok(/ibkrProgressOpen\(ibkrDateChunks\(startYmd, endYmd\), startYmd, endYmd\)/.test(app) && /endDate: endD,/.test(app), 'הכרטיס והמשיכה על אותם חלקים (אותו תאריך סיום)');
  ok(/uiFail\(head, !locked && !throttled\)/.test(app), 'נעילה/הגבלת קצב — בלי "נסו שוב" (ניסיון מיידי מאריך את החסימה)');
  ok(/await ui\.ready\(\);/.test(app) && /if \(!uiFailed\) ui\.close\(\);/.test(app), 'מוכן → אישור → נסגר; בכשל נשאר עם ההודעה');
  // עיצוב
  ok(/--ibkr: #A3182E/.test(css) && /\[data-theme="dark"\] \{\n  --ibkr: /.test(css), 'בורדו IBKR בבהיר ובכהה');
  ok(/#ibkrCard \{\n  background: linear-gradient/.test(css), 'רקע הכרטיס בגוון IBKR');
  ok(/#ibkrCard \.btn, \.ibkr-btn \{ background: var\(--ibkr\)/.test(css) && /border-radius: var\(--pill\)/.test(css), 'כפתור ראשי = בורדו מלא, גלולה');
  ok(/#ibkrCard\.syncing > :not\(\.ibkr-prog\) \{ display: none; \}/.test(css), 'בזמן משיכה — רק כרטיס ההתקדמות');
  console.log('# ' + n + ' בדיקות עברו');
})().catch((e) => { console.error(e); process.exit(1); });
