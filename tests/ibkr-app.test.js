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
    setAttribute() {},
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
  AbortController,
  fetch: async () => { throw new Error('fetch לא הוגדר בטסט'); },
  setTimeout, clearTimeout, confirm: () => true,
  console,
};
vm.createContext(sandbox);
const src = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8') +
  '\n;globalThis.__t = { ibkrCfg, ibkrSaveCfg, ibkrProxyBase, ibkrRequestReport, ibkrPollStatement, renderIbkrCard, ibkrMapImport, ibkrMapDeposits, isIbkrMode, costBasisUSD, costBasisInCur, portfolioPerformance, portfolioBasisInCur, netDepositsILS, totalsUSD, editAllowed, renderIbkrLocks, ibkrSnapshotManual, ibkrRestoreManual, ibkrReportTotal, ibkrTrades, fmtTradeMoney, tradeRowData, renderTrades, ibkrFetchFullHistory, ibkrSyncIsComplete, ibkrDateChunks, ibkrChunkRetryPlan, ibkrYmd, ibkrFriendlyErr, ibkrCacheIsStale, ibkrDefaultFromYmd, ibkrHasImportedData, ibkrEarliestDate, IBKR_AUTO_START_YMD };';
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
  ok(els.ibkrStatus.textContent.includes('טרם יובא דוח'), 'סטטוס: טרם יובא דוח כשאין נתונים');
  T.ibkrSaveCfg({ proxyUrl: 'https://p', token: 't', queryId: '1', lastSync: Date.now(), data: { positions: [{}, {}], trades: [{}], cashTransactions: [{}, {}, {}] } });
  T.renderIbkrCard();
  ok(els.ibkrStatus.textContent.includes('יובא:'), 'סטטוס: מוצג זמן יבוא');
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

  /* ---------- צילום ושחזור נתונים ידניים (v42) ---------- */
  vm.runInContext(`
    DB.positions.length = 0;
    DB.positions.push({ sym: 'MAN', shares: 5, avg: 10 });
    DB.deposits.length = 0;
    DB.deposits.push({ date: '2024-01-01', amount: -1000, place: 'ידני' });
    DB.cash = { usd: 50, ils: 60 };
    delete DB.ibkrSnapshot;
  `, sandbox);
  ok(T.ibkrSnapshotManual() === true, 'צילום ידני ראשון נשמר');
  ok(vm.runInContext('!!DB.ibkrSnapshot', sandbox) === true, 'הצילום קיים ב־DB');
  // שינוי הנתונים (כאילו יבוא IBKR דרס אותם)
  vm.runInContext(`
    DB.positions.length = 0;
    DB.positions.push({ sym: 'IBKR', shares: 9, avg: 99 });
    DB.deposits.length = 0;
    DB.deposits.push({ date: '2026-01-01', amount: -5000, place: 'IBKR' });
    DB.cash = { usd: 133, ils: 0 };
  `, sandbox);
  ok(T.ibkrSnapshotManual() === false, 'צילום שני (סנכרון חוזר) לא דורס את המקור הידני');
  ok(vm.runInContext('DB.ibkrSnapshot.deposits[0].place', sandbox) === 'ידני',
    'הצילום שומר את ההפקדה הידנית המקורית');
  ok(T.ibkrRestoreManual() === true, 'שחזור אחרי ניתוק מחזיר true');
  ok(vm.runInContext('DB.positions[0].sym', sandbox) === 'MAN', 'מניות ידניות שוחזרו');
  ok(vm.runInContext('DB.deposits[0].place', sandbox) === 'ידני', 'הפקדות ידניות שוחזרו לטאב');
  ok(vm.runInContext('DB.cash.usd', sandbox) === 50, 'מזומן ידני שוחזר');
  ok(vm.runInContext('!!DB.ibkrSnapshot', sandbox) === false, 'הצילום נמחק אחרי השחזור');
  ok(T.ibkrRestoreManual() === false, 'שחזור בלי צילום מחזיר false');

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


  /* ---------- שווי לפי הדוח (v43) ---------- */
  const rptData = {
    meta: { baseCurrency: 'USD' },
    positions: [
      { symbol: 'A', marketValue: 10000, fxToBase: 1 },
      { symbol: 'B', marketValue: 5000, fxToBase: 1 },
      { symbol: 'C', marketValue: NaN, fxToBase: 1 },
    ],
  };
  ok(T.ibkrReportTotal(null, null, 3) === null, 'בלי דוח — null');
  ok(T.ibkrReportTotal({ meta: { baseCurrency: 'USD' }, positions: [] }, null, 3) === null, 'בלי פוזיציות — null');
  ok(Math.abs(T.ibkrReportTotal(rptData, { usd: 1000, ils: 310 }, 3.1) - (15000 + 1000 + 100)) < 1e-9,
    'שווי = פוזיציות + מזומן דולרי + שקלי מומר (15000+1000+310/3.1)');
  const rptILS = { meta: { baseCurrency: 'ILS' }, positions: [{ marketValue: 50000, fxToBase: 1 }] };
  ok(Math.abs(T.ibkrReportTotal(rptILS, { usd: 100, ils: 200 }, 3.2) - (50000 + 200 + 320)) < 1e-9,
    'מטבע בסיס שקל: מזומן דולרי מומר (50000+200+100×3.2)');


  /* ---------- טאב עסקאות (v44) ---------- */
  ok(T.fmtTradeMoney(180.5, 'USD') === '$180.50', 'עיצוב דולרי');
  ok(T.fmtTradeMoney(180.5, 'ILS') === '\u20aa180.50', 'עיצוב שקלי');
  ok(T.fmtTradeMoney(180.5, 'EUR') === 'EUR 180.50', 'מטבע אחר עם קוד');
  const rd = T.tradeRowData({ date: '2026-01-05', symbol: 'AAPL', side: 'BUY', qty: 10, price: 180.5, commission: -1, commissionCurrency: 'USD', currency: 'USD' });
  ok(rd.isBuy === true && rd.qtyTxt === '10' && rd.priceTxt === '$180.50', 'שורת קנייה: כמות ומחיר');
  ok(rd.totalTxt === '$1,805.00', 'סה״כ = כמות × מחיר');
  ok(rd.commTxt === '$1.00', 'עמלה בערך מוחלט');
  const rdS = T.tradeRowData({ date: '2026-02-01', symbol: 'MSFT', side: 'SELL', qty: -5, price: 400, commission: 0, currency: 'USD' });
  ok(rdS.isBuy === false && rdS.qtyTxt === '5' && rdS.commTxt === null, 'מכירה: כמות מוחלטת, בלי עמלה אפסית');
  const rdF = T.tradeRowData({ symbol: 'X', side: 'BUY', qty: 1.23456, price: 10, currency: 'USD' });
  ok(rdF.qtyTxt === '1.2346', 'כמות שברית מעוגלת ל־4 ספרות');
  // מיון וסינון
  T.ibkrSaveCfg({ token: 't', queryId: '1', data: { trades: [
    { symbol: 'A', date: '2026-01-01', side: 'BUY', qty: 1, price: 1, currency: 'USD' },
    { symbol: '', date: '2026-03-01', side: 'BUY', qty: 1, price: 1, currency: 'USD' },
    { symbol: 'B', date: '2026-02-01', side: 'SELL', qty: 2, price: 2, currency: 'USD' },
  ] } });
  const trs = T.ibkrTrades();
  ok(trs.length === 2 && trs[0].symbol === 'B' && trs[1].symbol === 'A', 'עסקאות ממוינות מהחדשה לישנה, בלי סימבול ריק');
  // רינדור: מונה מתעדכן
  vm.runInContext('DB.source = "ibkr";', sandbox);
  T.renderTrades();
  ok(vm.runInContext('document.getElementById("tradeCount").textContent', sandbox) === 2, 'מונה עסקאות בטאב = 2');
  T.ibkrSaveCfg({ token: '', queryId: '', data: null });
  vm.runInContext('DB.source = "manual";', sandbox);

  /* ---------- ibkrFetchFullHistory: מיזוג למודל returns.js ---------- */
  const flexChunk = (trades, positions, nav) => ({
    meta: { accountId: 'X1', fromDate: '2025-01-01', toDate: '2025-12-31', baseCurrency: 'USD' },
    trades: trades || [], positions: positions || [], cashTransactions: [],
    navHistory: nav || [], cashBalances: [{ currency: 'USD', balance: 500 }],
  });
  const trA = { date: '2025-02-01', symbol: 'ACME', qty: 10, price: 100, side: 'BUY', commission: 1, currency: 'USD', tradeId: 'T1' };
  const trA2 = { date: '2025-02-01', symbol: 'ACME', qty: 10, price: 100, side: 'BUY', commission: 1, currency: 'USD', tradeId: 'T1' }; // כפילות מאותו chunk
  const trB = { date: '2025-03-01', symbol: 'ACME', qty: 5, price: 110, side: 'BUY', commission: 1, currency: 'USD', tradeId: 'T2' };
  const pos1 = [{ symbol: 'ACME', asset: 'STK', qty: 15, markPrice: 120, costBasis: 1550, currency: 'USD', levelOfDetail: 'SUMMARY' }];
  const nav1 = [{ fromDate: '2025-01-01', toDate: '2025-12-31', startingValue: 10000, endingValue: 11500, twr: 15, mtm: 1500 }];
  // startYmd קרוב להיום -> חלק יחיד
  const nowD = new Date(); nowD.setDate(nowD.getDate() - 6);
  const startYmd = T.ibkrYmd(nowD);
  const flexFetch = async (url, opts) => {
    const u = String(url);
    if (u.includes('/api/flex-request')) return { json: async () => ({ ok: true, referenceCode: 'RC1', statementUrl: 'https://x' }) };
    return { json: async () => ({ ok: true, status: 'ready', data: flexChunk([trA, trA2, trB], pos1, nav1) }) };
  };
  const merged = await T.ibkrFetchFullHistory(flexFetch, 'https://proxy.example.com', 'tok', '1', startYmd, null);
  ok(merged.meta.kind === 'flex', 'flex: meta.kind=flex');
  ok(merged.trades.length === 2, 'flex: כפילות tradeId מוסרת, נשארות 2 עסקאות');
  ok(merged.positions.length === 1 && merged.positions[0].symbol === 'ACME', 'flex: פוזיציות מהחלק העדכני');
  ok(merged.navPeriods.length === 1 && merged.navPeriods[0].twr === 15, 'flex: navHistory -> navPeriods עם TWR רשמי');
  ok(merged.cashBalances.length === 1, 'flex: יתרות מזומן מהחלק העדכני');
  ok(T.ibkrSyncIsComplete(merged) === true, 'flex: סנכרון שלם כשהחלק האחרון הצליח');
  ok(merged.meta.toDate === '2025-12-31', 'flex: meta.toDate מהחלק');
  // החלק העדכני נכשל -> חסום
  const badFetch = async (url) => {
    if (String(url).includes('/api/flex-request')) return { json: async () => ({ ok: true, referenceCode: 'RC1', statementUrl: '' }) };
    return { json: async () => ({ ok: false, error: 'flex_1020', message: 'rate' }) };
  };
  const mergedBad = await T.ibkrFetchFullHistory(badFetch, 'https://proxy.example.com', 'tok', '1', startYmd, null, { tries: 1 });
  ok(T.ibkrSyncIsComplete(mergedBad) === false, 'flex: סנכרון חסום כשהחלק העדכני נכשל');
  ok(T.ibkrChunkRetryPlan(new Error('x flex_1003 y')).attempts === 3, 'flex_1003 מקבל יותר ניסיונות');
  ok(T.ibkrChunkRetryPlan(new Error('boom')).attempts === 2, 'כשל רגיל: 2 ניסיונות');
  const chunks = T.ibkrDateChunks('20250101', '20260101');
  ok(chunks.length === 2 && chunks[0].fd === '20250101' && chunks[1].td === '20260101', 'חלוקה לחלקי 365 יום');
  ok(String(T.ibkrFriendlyErr('x flex_1015 y')).length > 0 && !/flex_1015/.test(T.ibkrFriendlyErr('x flex_1015 y')), 'שגיאה ידידותית ל־1015');

  /* ---------- flex: דדופליקציה מודעת־מופעים במזומן ---------- */
  const cashDup = { date: '2025-01-15', amount: 500, type: 'Deposits/Withdrawals', currency: 'USD', description: 'Wire deposit' };
  // שני חלקים (400 יום אחורה) מחזירים את אותן שתי תנועות זהות —
  // כפילות לגיטימית בתוך חלק נשמרת, חזרה על החלק לא מוכפלת
  const cashChunk = {
    meta: { fromDate: '2024-01-01', toDate: '2025-12-31', baseCurrency: 'USD' },
    trades: [], positions: [], cashTransactions: [cashDup, { ...cashDup }],
    navHistory: [], cashBalances: [],
  };
  const oldD = new Date(); oldD.setDate(oldD.getDate() - 400);
  const cashFetch = async (url) => {
    if (String(url).includes('/api/flex-request')) return { json: async () => ({ ok: true, referenceCode: 'RC', statementUrl: 'https://x' }) };
    return { json: async () => ({ ok: true, status: 'ready', data: cashChunk }) };
  };
  const mergedCash = await T.ibkrFetchFullHistory(cashFetch, 'https://proxy.example.com', 'tok', '1', T.ibkrYmd(oldD), null);
  ok(mergedCash.cashTransactions.length === 2, 'flex: שתי תנועות זהות לגיטימיות נשמרות, חזרת החלק לא מוכפלת');
  // מזהה יציב קודם לתוכן: C1 פעמיים באותו חלק -> 1, C2 שונה -> נשמר
  const idChunk = {
    meta: { fromDate: '2024-01-01', toDate: '2025-12-31', baseCurrency: 'USD' },
    trades: [], positions: [], navHistory: [], cashBalances: [],
    cashTransactions: [{ ...cashDup, id: 'C1' }, { ...cashDup, id: 'C1' }, { ...cashDup, id: 'C2' }],
  };
  const idFetch = async (url) => {
    if (String(url).includes('/api/flex-request')) return { json: async () => ({ ok: true, referenceCode: 'RC', statementUrl: 'https://x' }) };
    return { json: async () => ({ ok: true, status: 'ready', data: idChunk }) };
  };
  const mergedId = await T.ibkrFetchFullHistory(idFetch, 'https://proxy.example.com', 'tok', '1', T.ibkrYmd(oldD), null);
  ok(mergedId.cashTransactions.length === 3, 'flex: מזהה יציב — C1×2+C2 בשני חלקים זהים -> 3 (מקסימום מופעים לחלק)');

  // מטמון מיושן + Lot מצורף במיפוי
  const cachedPos = { positions: [{ symbol: 'AAPL', qty: 10 }, { symbol: 'MSFT', qty: 5 }] };
  ok(T.ibkrCacheIsStale(cachedPos, []) === true, 'מטמון מיושן: תיק ריק אחרי יבוא -> יבוא מחדש');
  ok(T.ibkrCacheIsStale(cachedPos, [{ sym: 'MSFT' }]) === false, 'מטמון תקף: סימבול אחד מהמטמון קיים בתיק');
  ok(T.ibkrCacheIsStale(cachedPos, [{ sym: 'TSLA' }]) === true, 'מטמון מיושן: אף סימבול לא קיים בתיק');
  ok(T.ibkrCacheIsStale(null, []) === false, 'אין מטמון -> לא מיושן');
  ok(T.ibkrCacheIsStale({ positions: [] }, []) === false, 'מטמון בלי פוזיציות -> לא מיושן');
  const lotAgg = T.ibkrMapImport({ positions: [{ symbol: 'NVDA', qty: 8, asset: 'STK', currency: 'USD', costBasis: 800, markPrice: 120, levelOfDetail: 'LOT', lots: 3 }] });
  ok(lotAgg.positions.length === 1 && lotAgg.positions[0].sym === 'NVDA' && lotAgg.positions[0].shares === 8, 'Lot מצורף (lots) מתקבל במיפוי כפוזיציה אחת');
  const rawLot = T.ibkrMapImport({ positions: [{ symbol: 'NVDA', qty: 8, asset: 'STK', currency: 'USD', costBasis: 800, levelOfDetail: 'LOT' }] });
  ok(rawLot.positions.length === 0 && rawLot.skipped === 1, 'פירוט LOT גולמי עדיין מסונן');

  // ברירת מחדל חכמה לתאריך התחלה + קיטוע רב־שנתי
  const endFix = new Date(2026, 8, 22); // אתמול = 22.09.2026
  ok(T.ibkrDefaultFromYmd({ meta: { toDate: '2024-09-27' } }, endFix) === '20240927', 'ברירת מחדל: ממשיך מתאריך הסיום של הנתונים הקיימים');
  ok(T.ibkrDefaultFromYmd(null, endFix) === '20240922', 'ברירת מחדל: שנתיים אחורה מאתמול כשאין נתונים');
  ok(T.ibkrDefaultFromYmd({ meta: {} }, endFix) === '20240922', 'ברירת מחדל: meta בלי toDate -> שנתיים אחורה');
  const threeY = T.ibkrDateChunks('20230924', '20260922');
  ok(threeY.length === 3 && threeY[0].fd === '20230924' && threeY[threeY.length - 1].td === '20260922', 'קיטוע 3 שנים: 3 חלקים מקצה לקצה');
  ok(threeY.every((c) => {
    const a = new Date(c.fd.slice(0,4), c.fd.slice(4,6)-1, c.fd.slice(6,8));
    const b = new Date(c.td.slice(0,4), c.td.slice(4,6)-1, c.td.slice(6,8));
    return (b - a) / 86400000 <= 364;
  }), 'כל חלק בקיטוע עד 364 יום');
  // משיכה מלאה עם תאריך התחלה מפורש: שולח fd/td לכל חלק
  const seenRanges = [];
  const rangeFetch = async (url, opts) => {
    const u = String(url);
    if (u.includes('/api/flex-request')) {
      const body = JSON.parse(opts.body || '{}');
      seenRanges.push([body.fd, body.td]);
      return { json: async () => ({ ok: true, referenceCode: 'RC', statementUrl: 'https://x' }) };
    }
    const chunk = { meta: { fromDate: '2023-01-01', toDate: '2026-09-22', baseCurrency: 'USD' }, trades: [], positions: [], navHistory: [], cashBalances: [], cashTransactions: [] };
    return { json: async () => ({ ok: true, status: 'ready', data: chunk }) };
  };
  const oldStart = new Date(2026, 8, 23); oldStart.setFullYear(oldStart.getFullYear() - 3);
  const manualRes = await T.ibkrFetchFullHistory(rangeFetch, 'https://proxy.example.com', 'tok', '1', T.ibkrYmd(oldStart), null);
  const eD = new Date(); eD.setDate(eD.getDate() - 1);
  const expChunks = T.ibkrDateChunks(T.ibkrYmd(oldStart), T.ibkrYmd(eD));
  ok(seenRanges.length === expChunks.length && seenRanges.length >= 3 &&
     seenRanges[0][0] === T.ibkrYmd(oldStart) && seenRanges[seenRanges.length - 1][1] === T.ibkrYmd(eD),
     'משיכה 3 שנים אחורה: בקשה לכל חלק עם fd/td, מההתחלה עד אתמול');

  // משיכה עמוקה אוטומטית (v118): מהעבר הרחוק קדימה — אותו נתיב כמו ידני
  ok(T.IBKR_AUTO_START_YMD === '20200101', 'משיכה עמוקה: רצפת ההתחלה האוטומטית היא ינואר 2020');
  ok(T.ibkrHasImportedData({ positions: [{ symbol: 'A' }] }) === true, 'יש נתונים: פוזיציות');
  ok(T.ibkrHasImportedData({ trades: [], navPeriods: [] }) === false, 'אין נתונים: מערכים ריקים');
  ok(T.ibkrHasImportedData(null) === false, 'אין נתונים: null');
  ok(T.ibkrEarliestDate({ trades: [{ date: '2023-10-03' }], cashTransactions: [{ date: '2023-09-28' }], navPeriods: [{ fromDate: '2023-01-01', toDate: '2023-12-31' }] }) === '2023-01-01', 'התאריך המוקדם ביותר: מינימום על עסקאות/מזומן/NAV');
  ok(T.ibkrEarliestDate({ trades: [{ date: '2024-05-05' }] }) === '2024-05-05', 'התאריך המוקדם ביותר: עובד גם עם סוג יחיד');
  ok(T.ibkrEarliestDate({ trades: [], cashTransactions: [], navPeriods: [] }) === '', 'התאריך המוקדם ביותר: מחרוזת ריקה כשאין מידע');
  ok(T.ibkrEarliestDate(null) === '', 'התאריך המוקדם ביותר: null');
  // סימולציה: 3 חלקים מהעבר קדימה, כולם עם מידע — מיזוג מלא בלי עצירה מוקדמת
  let dstmt = 0;
  const deepRanges = [];
  const deepFetch = async (url, opts) => {
    const u = String(url);
    if (u.includes('/api/flex-request')) {
      const body = JSON.parse(opts.body || '{}');
      deepRanges.push([body.fd, body.td]);
      return { json: async () => ({ ok: true, referenceCode: 'RCD' + dstmt, statementUrl: 'https://x' }) };
    }
    const idx = dstmt++;
    const chunk = {
      meta: { fromDate: '2024-01-01', toDate: '2026-09-22', baseCurrency: 'USD' },
      trades: [{ tradeId: 'DT' + idx, date: '2024-0' + (idx + 1) + '-15', symbol: 'AAA', qty: 1, side: 'BUY', price: 10 }],
      positions: idx === 2 ? [{ symbol: 'AAA', qty: 5, price: 11 }] : [],
      navHistory: [{ fromDate: '2024-0' + (idx + 1) + '-01', toDate: '2024-0' + (idx + 1) + '-28', twr: 1 }],
      cashBalances: [], cashTransactions: [],
    };
    return { json: async () => ({ ok: true, status: 'ready', data: chunk }) };
  };
  const deepRes = await T.ibkrFetchFullHistory(deepFetch, 'https://proxy.example.com', 'tok', '1', '20240101', null);
  ok(dstmt === 3, 'משיכה עמוקה: 3 חלקים מהעבר קדימה, כולם נמשכו');
  ok(deepRanges[0][0] === '20240101' && deepRanges[0][1] < deepRanges[1][1] && deepRanges[1][1] < deepRanges[2][1], 'משיכה עמוקה: החלקים מהעבר לקדימה (העתיק ראשון)');
  ok(deepRes.trades.length === 3, 'משיכה עמוקה: מוזגו עסקאות מכל החלקים');
  ok(deepRes.navPeriods.length === 3, 'משיכה עמוקה: מוזגו תקופות NAV מכל החלקים');
  ok(deepRes.latestChunkOk === true, 'משיכה עמוקה: החלק העדכני תקין');
  ok((deepRes.positions || []).length === 1, 'משיכה עמוקה: פוזיציות רק מהחלק העדכני');
  ok(deepRes._autoWall !== true, 'משיכה עמוקה: אין דגל קיר־שמירה');
  // חלק אמצעי ריק לא עוצר את המשיכה — ממשיכים עד הסוף
  let mstmt = 0;
  const midRanges = [];
  const midFetch = async (url, opts) => {
    if (String(url).includes('/api/flex-request')) {
      const body = JSON.parse(opts.body || '{}');
      midRanges.push([body.fd, body.td]);
      return { json: async () => ({ ok: true, referenceCode: 'RCM' + mstmt, statementUrl: 'https://x' }) };
    }
    const idx = mstmt++;
    const chunk = idx === 1
      ? { meta: {}, trades: [], positions: [], navHistory: [], cashBalances: [], cashTransactions: [] }
      : { meta: { fromDate: '2024-01-01', toDate: '2026-09-22', baseCurrency: 'USD' },
          trades: [{ tradeId: 'MT' + idx, date: '2024-06-01', symbol: 'BBB', qty: 1, side: 'BUY', price: 5 }],
          positions: [], navHistory: [], cashBalances: [], cashTransactions: [] };
    return { json: async () => ({ ok: true, status: 'ready', data: chunk }) };
  };
  const midRes = await T.ibkrFetchFullHistory(midFetch, 'https://proxy.example.com', 'tok', '1', '20240101', null);
  ok(mstmt === 3, 'משיכה עמוקה: חלק אמצעי ריק לא עוצר — כל 3 החלקים נמשכו');
  ok(midRes.trades.length === 2, 'משיכה עמוקה: מידע משני צדי החלק הריק מוזג');
  // החלק העדכני נכשל -> נחסם, לא מייבאים
  const failFetch = async (url) => {
    if (String(url).includes('/api/flex-request')) throw new Error('boom');
    return { json: async () => ({ ok: true, status: 'ready', data: {} }) };
  };
  const failRes = await T.ibkrFetchFullHistory(failFetch, 'https://proxy.example.com', 'tok', '1', '20250101', null);
  ok(T.ibkrSyncIsComplete(failRes) === false, 'משיכה עמוקה: כשלון החלק העדכני חוסם יבוא');

  console.log(`\nכל הבדיקות עברו ✓ (סה"כ אסרטים: ${n})`);
})().catch((e) => { console.error('נכשל:', e.message); process.exit(1); });
