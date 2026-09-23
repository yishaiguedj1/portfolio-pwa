/* בדיקות ללוגיקת IBKR בצד האפליקציה (app.js). הרצה: node tests/ibkr-app.test.js */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

let n = 0;
const ok = (cond, name) => { n++; assert(cond, name); console.log('ok -', name); };

/* ---------- stubs ---------- */
const store = {};
const localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};
function elStub() {
  return {
    value: '', textContent: '', innerHTML: '',
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener() {}, appendChild() {}, dataset: {}, style: {},
    disabled: false,
  };
}
const els = {};
const document = {
  addEventListener() {},
  getElementById: (id) => (els[id] || (els[id] = elStub())),
  querySelectorAll: () => [],
  createElement: () => elStub(),
};
const sandbox = {
  localStorage, document,
  window: {}, navigator: {}, location: { reload() {} },
  fetch: async () => { throw new Error('fetch לא הוגדר בטסט'); },
  setTimeout, clearTimeout, confirm: () => true,
  console,
};
vm.createContext(sandbox);
const src = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8') +
  '\n;globalThis.__t = { ibkrCfg, ibkrSaveCfg, ibkrProxyBase, ibkrRequestReport, ibkrPollStatement, renderIbkrCard };';
vm.runInContext(src, sandbox, { filename: 'app.js' });
const T = sandbox.__t;
ok(!!T, 'app.js נטען בלי שגיאות תחביר');

const calls = [];
function stubFetch(script) {
  calls.length = 0;
  let i = 0;
  sandbox.fetch = async (url, opts) => {
    calls.push({ url: String(url), opts });
    const item = script[Math.min(i++, script.length - 1)];
    if (item instanceof Error) throw item;
    return { json: async () => item };
  };
}
const noSleep = async () => {};

/* ---------- cfg ---------- */
Object.keys(store).forEach((k) => delete store[k]);
T.ibkrSaveCfg({ proxyUrl: 'https://proxy.example.com///', token: 'tok123', queryId: '999' });
ok(T.ibkrCfg().token === 'tok123', 'שמירה/טעינה של הגדרות IBKR');
ok(T.ibkrProxyBase() === 'https://proxy.example.com', 'ניקוי לוכסנים מסוף ה־URL');

/* ---------- ibkrRequestReport ---------- */
stubFetch([{ ok: true, referenceCode: 'RC1', statementUrl: 'https://gdcdyn.interactivebrokers.com/x' }]);
(async () => {
  const rep = await T.ibkrRequestReport(sandbox.fetch, 'https://proxy.example.com', 'tok123', '999');
  ok(rep.referenceCode === 'RC1', 'בקשת דוח מחזירה referenceCode');
  ok(calls[0].url === 'https://proxy.example.com/api/flex-request', 'נקרא ל־/api/flex-request');
  ok(calls[0].opts.method === 'POST', 'ב־POST');
  const body = JSON.parse(calls[0].opts.body);
  ok(body.token === 'tok123' && body.queryId === '999', 'הטוקן ב־body');
  ok(!calls[0].url.includes('tok123'), 'הטוקן לא ב־URL');

  stubFetch([{ ok: false, error: 'flex_1018', message: 'bad token' }]);
  await assert.rejects(
    T.ibkrRequestReport(sandbox.fetch, 'https://proxy.example.com', 'bad', '999'),
    /flex_1018/, 'שגיאת שרתון נזרקת עם הקוד'
  );
  console.log('ok - שגיאת flex-request נזרקת');

  /* ---------- ibkrPollStatement ---------- */
  const data = { positions: [{ symbol: 'AAPL' }], trades: [], cashTransactions: [], meta: {} };
  stubFetch([
    { ok: true, status: 'pending' },
    { ok: true, status: 'pending' },
    { ok: true, status: 'ready', data },
  ]);
  const got = await T.ibkrPollStatement(sandbox.fetch, 'https://proxy.example.com', 'tok123', 'RC1', 'https://gdcdyn.interactivebrokers.com/x', { sleep: noSleep });
  ok(got === data, 'poll מחזיר data כשהדוח מוכן');
  ok(calls.length === 3, 'נשאלו 3 פעמים עד שהיה מוכן');
  ok(calls[0].url === 'https://proxy.example.com/api/flex-statement', 'נקרא ל־/api/flex-statement בלי query string');
  const pb = JSON.parse(calls[0].opts.body);
  ok(pb.token === 'tok123' && pb.code === 'RC1', 'טוקן וקוד ב־body של ה־poll');

  stubFetch([{ ok: false, error: 'flex_1021' }]);
  await assert.rejects(
    T.ibkrPollStatement(sandbox.fetch, 'https://proxy.example.com', 'tok123', 'RC1', '', { sleep: noSleep, tries: 2 }),
    /flex_1021/, 'שגיאת statement נזרקת'
  );
  console.log('ok - שגיאת flex-statement נזרקת');

  stubFetch([{ ok: true, status: 'pending' }]);
  await assert.rejects(
    T.ibkrPollStatement(sandbox.fetch, 'https://proxy.example.com', 'tok123', 'RC1', '', { sleep: noSleep, tries: 3 }),
    /לא היה מוכן/, 'timeout אחרי tries ניסיונות'
  );
  console.log('ok - timeout ב־poll');

  stubFetch([new Error('boom'), { ok: true, status: 'ready', data }]);
  const got2 = await T.ibkrPollStatement(sandbox.fetch, 'https://proxy.example.com', 'tok123', 'RC1', '', { sleep: noSleep });
  ok(got2 === data, 'כשל רשת חולף — ממשיך לנסות');

  /* ---------- renderIbkrCard ---------- */
  Object.keys(store).forEach((k) => delete store[k]);
  T.renderIbkrCard();
  ok(els.ibkrStatus.textContent.includes('לא מחובר'), 'סטטוס: לא מחובר כשאין הגדרות');
  T.ibkrSaveCfg({ proxyUrl: 'https://p', token: 't', queryId: '1', lastSync: Date.now(), data: { positions: [{}, {}], trades: [{}], cashTransactions: [{}, {}, {}] } });
  T.renderIbkrCard();
  ok(els.ibkrStatus.textContent.includes('סונכרן'), 'סטטוס: מוצג זמן סנכרון');
  ok(els.ibkrData.textContent.includes('פוזיציות: 2') && els.ibkrData.textContent.includes('עסקאות בדוח: 1'),
    'סיכום נתונים מוצג בכרטיס');

  /* ---------- עקביות קבצים ---------- */
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  for (const id of ['ibkrCard', 'ibkrProxy', 'ibkrToken', 'ibkrQuery', 'ibkrSaveTest', 'ibkrSync', 'ibkrDisconnect', 'ibkrStatus', 'ibkrErr', 'ibkrData']) {
    ok(html.includes('id="' + id + '"'), 'index.html מכיל #' + id);
  }
  const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
  ok(css.includes('.btn-row'), 'styles.css מכיל .btn-row');
  const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
  ok(sw.includes('portfolio-pwa-v23'), 'sw.js בגרסת v23');
  ok(src.includes("const APP_VERSION = 'v23'"), 'APP_VERSION v23');

  console.log(`\nכל הבדיקות עברו ✓ (סה"כ אסרטים: ${n})`);
})().catch((e) => { console.error('נכשל:', e.message); process.exit(1); });
