// v296: עומק "אוטומטי" (ברירת המחדל) — משיכה מהשנה הנוכחית אחורה עד השנה שלפני פתיחת החשבון
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
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
vm.runInContext(app + '\n;globalThis.__t = { ibkrFetchFullHistory, ibkrDepthChoice, ibkrChunkEmpty, ibkrAutoStartYmd, IBKR_AUTO_MAX_YEARS };', sandbox, { filename: 'app.js' });
const T = sandbox.__t;

ok(T.ibkrDepthChoice('') === 'auto' && T.ibkrDepthChoice(undefined) === 'auto' && T.ibkrDepthChoice('auto') === 'auto', 'ברירת מחדל = אוטומטי');
ok(T.ibkrDepthChoice('3') === '3' && T.ibkrDepthChoice(10) === '10' && T.ibkrDepthChoice('7') === 'auto', 'עומק תקין נשמר, לא תקין → אוטומטי');
ok(T.ibkrChunkEmpty({ trades: [], cashTransactions: [], navHistory: [], positions: [] }) && !T.ibkrChunkEmpty({ navHistory: [{}] }) && !T.ibkrChunkEmpty({ navDaily: [{}] }), 'דוח ריק = בלי עסקאות/מזומן/NAV/פוזיציות');
const endD = new Date(2026, 8, 29);
ok(T.ibkrAutoStartYmd(endD) === String(2026 - T.IBKR_AUTO_MAX_YEARS) + '0101', 'תחילת הטווח האוטומטי = תקרה ביטחונית, 1 בינואר');

// מדמה IBKR: שנה → תשובה. 'data' | 'empty' | 'e1003' | 'e1019'
function mk(byYear, log) {
  const codes = {};
  let c = 0;
  return async (url, opts) => {
    const b = JSON.parse(opts.body || '{}');
    if (String(url).includes('flex-request')) { const code = 'R' + (c++); codes[code] = b; log.push(b.fd + '-' + b.td); return { json: async () => ({ ok: true, referenceCode: code, statementUrl: '' }) }; }
    const req = codes[b.code] || {};
    const y = String(req.fd || '').slice(0, 4);
    const kind = (typeof byYear === 'function') ? byYear(y, req) : (byYear[y] || 'e1003');
    if (kind === 'e1003') return { json: async () => ({ ok: false, error: 'flex_1003' }) };
    if (kind === 'e1019') return { json: async () => ({ ok: false, error: 'flex_1019' }) };
    const data = kind === 'empty' ? { meta: {}, trades: [], positions: [], navHistory: [], cashTransactions: [] }
      : { meta: { fromDate: y + '-01-01', toDate: y + '-12-31', baseCurrency: 'USD' }, trades: [{ tradeId: 'T' + y, date: y + '-03-01', symbol: 'A', qty: 1, side: 'BUY', price: 1 }],
          positions: y === '2026' ? [{ symbol: 'A', qty: 1 }] : [], navHistory: [{ fromDate: y + '-01-01', toDate: y + '-12-31', twr: 1 }], cashTransactions: [] };
    return { json: async () => ({ ok: true, status: 'ready', data }) };
  };
}
// שנה מעוברת = שני חלקים (1/1–30/12 + 31/12) — משווים לפי שנים ייחודיות
const yrs = (log) => [...new Set(log.map((s) => s.slice(0, 4)))].join(',');
const run = (f, extra) => T.ibkrFetchFullHistory(f, 'https://p', 'tok', '1', T.ibkrAutoStartYmd(endD), null, Object.assign({ chunkGapMs: 1, endDate: endD, autoDepth: true, tries: 1 }, extra || {}));

(async () => {
  // חשבון מ־2023: 2026→2023 עם נתונים, 2022 = 1003 → עוצרים
  let log = [];
  const seen = [];
  const r1 = await run(mk({ 2026: 'data', 2025: 'data', 2024: 'data', 2023: 'data' }, log), { onChunk: (x) => seen.push(x.state + ':' + x.fd.slice(0, 4)) });
  ok(yrs(log) === '2026,2025,2024,2023,2022', 'מהחדש לישן, עוצר בשנה שלפני החשבון (5 בקשות מתוך ' + (T.IBKR_AUTO_MAX_YEARS + 1) + ')');
  ok(r1.trades.length === 4 && r1.navPeriods.length === 4, 'כל השנים עם פעילות מוזגו');
  ok(r1.latestChunkOk === true && r1.positions.length === 1, 'החלק העדכני תקין, פוזיציות ממנו');
  ok(r1._autoStop === true && r1.meta.fromDate === '2023-01-01', 'עצירה אוטומטית; תחילת הנתונים = השנה הראשונה עם פעילות');
  ok(r1._chunks.every((c) => c.ok), 'השנה שלפני החשבון לא נספרת ככשל (אין אזהרת פער)');
  ok(seen.includes('skip:2022') && seen.indexOf('start:2026') === 0, 'דיווח לכרטיס: מתחיל מהשנה הנוכחית, השנה שלפני החשבון = דולג');
  ok(r1.trades[0].date < r1.trades[3].date, 'העסקאות ממוינות לפי תאריך');

  // שנה ריקה אחת באמצע לא עוצרת; שתיים ברצף — כן
  log = [];
  const r2 = await run(mk({ 2026: 'data', 2025: 'empty', 2024: 'data', 2023: 'empty', 2022: 'empty', 2021: 'data' }, log));
  ok(yrs(log) === '2026,2025,2024,2023,2022', 'שנה ריקה אחת ממשיכה; שתי ריקות ברצף עוצרות');
  ok(r2.trades.length === 2 && r2._autoStop === true && r2.meta.fromDate === '2024-01-01', 'שנים ריקות לא משנות את תחילת הנתונים');

  // הדוח העדכני עוד לא פורסם (1003) — ניסיון עד יום המסחר הקודם, ואז ממשיכים אחורה
  log = [];
  const r3 = await run(mk((y, req) => {
    if (y === '2026') return req.td === '20260929' ? 'e1003' : 'data'; // היום האחרון עוד לא פורסם
    return y === '2025' ? 'data' : 'e1003';
  }, log));
  ok(r3.latestChunkOk === true && r3.trades.length === 2, 'העדכני 1003 → גיבוי יום קודם → ממשיך לשנים ישנות');
  ok(log.some((s) => s.startsWith('20260101-') && s !== log[0] && s < log[0]), 'הגיבוי מבקש את אותה שנה עד יום מסחר קודם');

  // העדכני נכשל (לא 1003) — לא ממשיכים לשנים ישנות
  log = [];
  const r4 = await run(mk({ 2026: 'e1019', 2025: 'data' }, log));
  ok(r4.latestChunkOk === false && r4._stopped === true && !log.some((s) => s.startsWith('2025')), 'העדכני נכשל → עוצרים מיד, בלי 25 בקשות מיותרות');

  // מצב רגיל (עומק ידני) לא השתנה: מהישן לחדש
  log = [];
  await T.ibkrFetchFullHistory(mk({ 2024: 'data', 2025: 'data', 2026: 'data' }, log), 'https://p', 'tok', '1', '20240101', null, { chunkGapMs: 1, endDate: endD, tries: 1 });
  ok(yrs(log) === '2024,2025,2026', 'עומק ידני — עדיין מהישן לחדש');

  // ממשק
  const sec = html.slice(html.indexOf('id="ibkrRangeDetails"'), html.indexOf('id="ibkrConnDetails"'));
  ok(/data-i18n="ibkrRangeTitle">בחירת טווח למשיכה</.test(sec), 'כותרת: "בחירת טווח למשיכה"');
  ok(/<option value="auto" data-i18n="ibkrDepthAuto" selected>אוטומטי</.test(sec) && !/<label/.test(sec) && !/<p /.test(sec), 'אוטומטי ראשון ונבחר; בלי תוויות ובלי טקסט הסבר');
  ok(/ibkrRangeTitle: 'Choose pull range'/.test(app) && /ipAutoRange: '/.test(app), 'מחרוזות באנגלית');
  ok(/autoDepth: autoAll/.test(app) && /\{ grow: autoAll \}/.test(app), 'המשיכה והכרטיס מקבלים את המצב האוטומטי');
  console.log('# ' + n + ' בדיקות עברו');
})().catch((e) => { console.error(e); process.exit(1); });
