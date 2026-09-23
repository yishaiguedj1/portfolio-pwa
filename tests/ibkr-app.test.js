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
  '\n;globalThis.__t = { ibkrCfg, ibkrSaveCfg, ibkrProxyBase, ibkrRequestReport, ibkrPollStatement, renderIbkrCard, ibkrMapImport, ibkrMapDeposits, isIbkrMode, costBasisUSD, costBasisInCur, portfolioPerformance, portfolioBasisInCur, netDepositsILS, totalsUSD, editAllowed, renderIbkrLocks };';
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

  /* ---------- ibkrMapImport ---------- */
  const impData = {
    positions: [
      { symbol: 'AAPL', asset: 'STK', qty: 10, markPrice: 185, costBasis: 1805, currency: 'USD' },
      { symbol: 'AAPL 260116C00200000', asset: 'OPT', qty: 2, markPrice: 5, costBasis: 800, currency: 'USD' },
      { symbol: 'NESN', asset: 'STK', qty: 5, markPrice: 100, costBasis: 480, currency: 'CHF' },
      { symbol: 'TSLA', asset: 'STK', qty: 0, markPrice: 250, costBasis: 0, currency: 'USD' },
      { symbol: 'MSFT', qty: 4, markPrice: 400, costBasis: 1500, currency: 'USD' },
    ],
    cashBalances: [
      { currency: 'USD', balance: 1234.567 },
      { currency: 'ILS', balance: 200 },
      { currency: 'EUR', balance: 50 },
    ],
  };
  const imp = T.ibkrMapImport(impData);
  ok(imp.positions.length === 2, 'מייבא רק מניות דולריות עם כמות חיובית');
  ok(imp.positions[0].sym === 'AAPL' && imp.positions[0].shares === 10, 'סימבול וכמות נשמרים');
  ok(Math.abs(imp.positions[0].avg - 180.5) < 1e-9, 'מחיר ממוצע = עלות/כמות');
  ok(imp.positions[1].sym === 'MSFT', 'פוזיציה בלי asset (פרוקסי ישן) מתקבלת');
  ok(imp.skipped === 3, 'אופציה, מט״ח וכמות אפס מדולגות ונספרות');
  ok(imp.cash.usd === 1234.57 && imp.cash.ils === 200, 'מזומן $/₪ ממופה ומעוגל');
  const impEmpty = T.ibkrMapImport({});
  ok(impEmpty.positions.length === 0 && impEmpty.skipped === 0, 'נתונים ריקים לא שוברים');
  const impNoCost = T.ibkrMapImport({ positions: [{ symbol: 'NVDA', asset: 'STK', qty: 3, markPrice: 900, costBasis: 0, currency: 'USD' }] });
  ok(impNoCost.positions[0].avg === 900, 'בלי עלות — נופל למחיר שוק');

  /* איחוד לוטות לפי סימבול — הבאג של הכפילויות */
  const impLots = T.ibkrMapImport({
    positions: [
      { symbol: 'ADBE', asset: 'STK', qty: 10, markPrice: 240, costBasis: 2000, currency: 'USD' },
      { symbol: 'ADBE', asset: 'STK', qty: 20, markPrice: 240, costBasis: 5000, currency: 'USD' },
      { symbol: 'ADBE', asset: 'STK', qty: 11, markPrice: 240, costBasis: -2860, currency: 'USD' },
      { symbol: 'META', asset: 'STK', qty: 5, markPrice: 700, costBasis: 3000, currency: 'USD' },
    ],
    cashBalances: [],
  });
  ok(impLots.positions.length === 2, 'לוטות של אותו סימבול מאוחדים לרשומה אחת');
  ok(impLots.lots === 4, 'סופר את כל שורות הקנייה');
  const adbe = impLots.positions.find((p) => p.sym === 'ADBE');
  ok(adbe && adbe.shares === 41, 'כמויות מסוכמות (10+20+11)');
  ok(adbe && Math.abs(adbe.avg - (2000 + 5000 + 2860) / 41) < 1e-9, 'מחיר ממוצע משוקלל לפי עלות (גם עלות שלילית)');
  ok(impLots.cash === null, 'בלי יתרות מזומן בדוח — cash הוא null ולא מאפס');
  const impCashOnly = T.ibkrMapImport({ positions: [], cashBalances: [{ currency: 'USD', balance: 100 }] });
  ok(impCashOnly.cash && impCashOnly.cash.usd === 100, 'יתרת מזומן בודדת ממופה');

  /* ---------- הפרדה בין משתמש IBKR לידני (v36) ---------- */
  vm.runInContext('DB.source = undefined;', sandbox);
  ok(T.isIbkrMode() === false, 'ברירת מחדל: לא מצב IBKR');
  vm.runInContext('DB.source = "ibkr";', sandbox);
  ok(T.isIbkrMode() === true, 'אחרי ייבוא מ־IBKR: מצב IBKR פעיל');
  vm.runInContext('DB.source = "manual";', sandbox);
  ok(T.isIbkrMode() === false, 'מצב ידני מפורש: לא IBKR');

  vm.runInContext('POSITIONS = [{ sym: "A", shares: 10, avg: 100 }, { sym: "B", shares: 5, avg: 200 }, { sym: "C", shares: 3 }];', sandbox);
  ok(T.costBasisUSD() === 2000, 'עלות קנייה = סכום avg×shares (10×100 + 5×200, בלי avg מתעלמים)');

  const perf = T.portfolioPerformance(146089, 115944);
  ok(perf.gl === 146089 - 115944, 'רווח = שווי נוכחי פחות עלות קנייה');
  ok(Math.abs(perf.yld - (146089 - 115944) / 115944 * 100) < 1e-9, 'תשואה מחושבת מעלות הקנייה');
  const perfZero = T.portfolioPerformance(146089, 0);
  ok(perfZero.gl === null && perfZero.yld === null, 'בלי עלות קנייה — אין חישוב (מוצג —)');
  const perfDemo = T.portfolioPerformance(146089, 332);
  ok(perfDemo.yld > 40000, 'עם בסיס הפקדות דמו זעיר התשואה מתפוצצת — לכן מתעלמים מהפקדות במצב IBKR');
  vm.runInContext('DB.source = undefined;', sandbox);

  /* ---------- מיפוי הפקדות מ־IBKR (v36) ---------- */
  const fxStub = (iso) => 3.2;
  const txs = [
    { date: '2024-01-15', amount: 10000, currency: 'USD', fxToBase: 1, type: 'Deposits/Withdrawals', description: 'Deposit' },
    { date: '2024-06-01', amount: -2000, currency: 'USD', fxToBase: 1, type: 'Deposits/Withdrawals', description: 'Withdrawal' },
    { date: '2024-03-01', amount: 500, currency: 'USD', fxToBase: 1, type: 'Dividends', description: 'Dividend' },
    { date: '2024-02-01', amount: 3000, currency: 'ILS', fxToBase: 0.31, type: 'Deposits/Withdrawals', description: '' },
    { date: '2024-04-01', amount: 0, currency: 'USD', fxToBase: 1, type: 'Deposits/Withdrawals', description: 'Zero' },
  ];
  const deps = T.ibkrMapDeposits(txs, fxStub);
  ok(deps.length === 3, 'רק העברות חיצוניות ממופות — דיבידנד ואפס מסוננים');
  ok(deps[0].date === '2024-01-15' && deps[0].amount === -32000, 'הפקדה בדולרים מומרת לשקלים ונשמרת שלילית (נכנס)');
  ok(deps[1].date === '2024-02-01' && deps[1].amount === -3000, 'העברה בשקלים נשמרת כמו שהיא');
  ok(deps[2].date === '2024-06-01' && deps[2].amount === 6400, 'משיכה נשמרת חיובית (יוצא)');
  ok(deps.every((d) => d.place && d.place.length > 0), 'לכל הפקדה יש תיאור');
  ok(JSON.stringify(deps.map((d) => d.date)) === JSON.stringify(['2024-01-15', '2024-02-01', '2024-06-01']), 'ממוין לפי תאריך');
  ok(T.ibkrMapDeposits(null, fxStub).length === 0, 'בלי תנועות — רשימה ריקה (לא מוחקים קיים)');
  ok(T.ibkrMapDeposits([{ date: '2024-01-01', amount: 100, currency: 'EUR', fxToBase: 0, type: 'Deposits/Withdrawals' }], fxStub).length === 0, 'מטבע בלי שער המרה — מדלגים');

  /* ---------- אימות מתמטי מלא של צינור IBKR (v36) ---------- */
  // תיק סינתטי עם ערכים ידועים, חישוב ידני עצמאי:
  // תנועות: הפקדה 1000$ @3.0, הפקדה 500$ @3.5, משיכה 200$ @3.2, דיבידנד 50$ (מסונן החוצה)
  // → ‎-3000, ‎-1750, ‎+640 → נטו ‎-4110 → סך הפקדות ‎4110
  // שווי נוכחי: 2200 → תשואה צפויה: (2200-4110)/4110*100 = ‎-46.474...%
  vm.runInContext('DB.source = "ibkr"; state.currency = "ILS";', sandbox);
  const fxT = (iso) => ({ '2024-01-10': 3.0, '2024-05-20': 3.5, '2024-09-01': 3.2 }[iso] || 0);
  const txs2 = [
    { date: '2024-01-10', amount: 1000, currency: 'USD', fxToBase: 1, type: 'Deposits/Withdrawals', description: 'Wire' },
    { date: '2024-05-20', amount: 500, currency: 'USD', fxToBase: 1, type: 'Deposits/Withdrawals', description: 'Wire' },
    { date: '2024-09-01', amount: -200, currency: 'USD', fxToBase: 1, type: 'Deposits/Withdrawals', description: 'Withdrawal' },
    { date: '2024-06-15', amount: 50, currency: 'USD', fxToBase: 1, type: 'Dividends', description: 'DIV' },
  ];
  const mapped2 = T.ibkrMapDeposits(txs2, fxT);
  vm.runInContext('DEPOSITS = ' + JSON.stringify(mapped2) + ';', sandbox);
  ok(T.netDepositsILS() === 4110, 'סך הפקדות נטו = ‎4110 (דיבידנד לא נספר כהפקדה)');
  ok(T.portfolioBasisInCur() === 4110, 'בסיס החישוב במצב IBKR = ההפקדות המסונכרנות');
  const perf2 = T.portfolioPerformance(2200, T.portfolioBasisInCur());
  ok(perf2.gl === 2200 - 4110, 'רווח = ‎-1910');
  ok(Math.abs(perf2.yld - (-1910 / 4110 * 100)) < 1e-9, 'תשואה = ‎-46.47% — זהה לחישוב ידני עצמאי');

  /* ---------- אימות שווי מול מחירי שוק חיים (v36) ---------- */
  // 9 הפוזיציות האמיתיות של ישי + מחירי Yahoo חיים מ־2026-09-23 — חישוב עצמאי: $72,977.62
  const liveQ = { NOW: 137.0, META: 736.595, ADBE: 238.25, MBLY: 7.68, UNH: 372.95, MSFT: 498.0, UBER: 69.89, INTU: 292.35, APP: 328.73 };
  const yPos = [
    { sym: 'NOW', shares: 97, avg: 89.12 }, { sym: 'META', shares: 17, avg: 504.17 },
    { sym: 'ADBE', shares: 41, avg: 251.82 }, { sym: 'MBLY', shares: 1047, avg: 12.23 },
    { sym: 'UNH', shares: 20, avg: 286.91 }, { sym: 'MSFT', shares: 15, avg: 369.00 },
    { sym: 'UBER', shares: 93, avg: 70.48 }, { sym: 'INTU', shares: 17, avg: 277.63 },
    { sym: 'APP', shares: 9, avg: 308.81 },
  ];
  vm.runInContext('POSITIONS = ' + JSON.stringify(yPos) + ';', sandbox);
  const qobj = {};
  for (const [k, v] of Object.entries(liveQ)) qobj[k] = { close: v };
  vm.runInContext('state.quotes = ' + JSON.stringify(qobj) + '; DB.cash = { usd: 0, ils: 0 };', sandbox);
  ok(Math.abs(T.totalsUSD().total - 72977.62) < 0.01, 'שווי התיק מהאפליקציה תואם לחישוב עצמאי ממחירים חיים');
  ok(Math.abs(T.costBasisUSD() - 65671.80) < 0.01, 'עלות הקנייה תואמת לחישוב עצמאי');

  /* ---------- נעילת עריכה במצב IBKR (v36) ---------- */
  vm.runInContext('DB.source = "ibkr"; state.edit.stocks = true; state.edit.deposits = true;', sandbox);
  T.renderIbkrLocks();
  ok(vm.runInContext('state.edit.stocks === false && state.edit.deposits === false', sandbox), 'במצב IBKR מצב העריכה נכבה אוטומטית');
  ok(T.editAllowed('stocks') === false && T.editAllowed('deposits') === false, 'במצב IBKR אין עריכה ידנית של מניות/הפקדות');
  vm.runInContext('DB.source = "manual"; state.edit.stocks = true;', sandbox);
  ok(T.editAllowed('stocks') === true, 'אחרי ניתוק (מצב ידני) העריכה חוזרת לעבוד');

  /* ---------- עקביות קבצים ---------- */
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  for (const id of ['ibkrCard', 'ibkrProxy', 'ibkrToken', 'ibkrQuery', 'ibkrSaveTest', 'ibkrSyncImport', 'ibkrDisconnect', 'ibkrStatus', 'ibkrErr', 'ibkrData', 'ibkrStocksNote']) {
    ok(html.includes('id="' + id + '"'), 'index.html מכיל #' + id);
  }
  const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
  ok(css.includes('.btn-row'), 'styles.css מכיל .btn-row');
  const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
  const ver = (src.match(/const APP_VERSION = 'v(\d+)'/) || [])[1];
  ok(!!ver, 'APP_VERSION נמצא ב־app.js');
  ok(sw.includes('portfolio-pwa-v' + ver), 'sw.js תואם ל־APP_VERSION (v' + ver + ')');

  console.log(`\nכל הבדיקות עברו ✓ (סה"כ אסרטים: ${n})`);
})().catch((e) => { console.error('נכשל:', e.message); process.exit(1); });
