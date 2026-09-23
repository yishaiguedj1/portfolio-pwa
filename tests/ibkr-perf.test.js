/* בדיקות לגל ביצועי IBKR: TWR/XIRR/ממומש/לא־ממומש/דיבידנדים/ריבית/מסים/עמלות.
   הרצה: node tests/ibkr-perf.test.js */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

let n = 0;
const ok = (cond, name) => { n++; assert(cond, name); console.log('ok -', name); };
const close = (a, b, eps, name) => ok(Math.abs(a - b) <= eps, name + ' (קיבלנו ' + a + ', ציפינו ~' + b + ')');

/* ---------- stubs (כמו בטסט ה־earnings) ---------- */
const store = {};
const localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};
function elStub() {
  const ctxStub = new Proxy({}, {
    get: (t, p) => (...a) => {},
    set: () => true,
  });
  return {
    value: '', textContent: '', innerHTML: '',
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener() {}, appendChild() {}, dataset: {}, style: {},
    disabled: false,
    children: [],
    getContext: () => ctxStub,
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
  '\n;globalThis.__t = { ibkrPerfSums, ibkrXirrFlows, xirr, ibkrBaseCur, ibkrNav, fmtPct, ibkrNetDeposits, ibkrPeriodGain, renderOverview };';
vm.runInContext(src, sandbox, { filename: 'app.js' });
const T = sandbox.__t;
ok(!!T, 'app.js נטען בלי שגיאות תחביר');

/* ---------- נתוני דוגמה סינתטיים ---------- */
const sample = {
  meta: { accountId: 'U000', fromDate: '2024-01-01', toDate: '2025-01-01', baseCurrency: 'USD' },
  trades: [
    { symbol: 'AAPL', realized: 50, commission: -1, currency: 'USD', fxToBase: 1 },
    { symbol: 'TSLA', realized: -20, commission: 2, currency: 'USD', fxToBase: 1 },
  ],
  positions: [
    { symbol: 'AAPL', unrealized: 45, currency: 'USD', fxToBase: 1.2 },
    { symbol: 'NVDA', unrealized: 100, currency: 'USD', fxToBase: 1 },
  ],
  cashTransactions: [
    { date: '2024-03-01', amount: 100, currency: 'USD', fxToBase: 1, type: 'Dividends', description: 'AAPL DIV' },
    { date: '2024-03-01', amount: -25, currency: 'USD', fxToBase: 1, type: 'Withholding Tax', description: 'TAX' },
    { date: '2024-04-01', amount: 10, currency: 'USD', fxToBase: 1, type: 'Interest', description: 'INT' },
    { date: '2024-02-01', amount: 5000, currency: 'USD', fxToBase: 1, type: 'Deposits/Withdrawals', description: 'Wire' },
    { date: '2024-05-01', amount: -15, currency: 'USD', fxToBase: 1, type: 'Other Fees', description: 'FEE' },
  ],
  nav: { startingValue: 10000, endingValue: 12000, twr: 17.25, mtm: 2000 },
  cashBalances: [],
};

/* ---------- ibkrPerfSums ---------- */
const s = T.ibkrPerfSums(sample);
close(s.realized, 30, 1e-9, 'רווח ממומש = 50-20');
close(s.unrealized, 154, 1e-9, 'רווח לא־ממומש = 45*1.2+100 (עם fxToBase)');
close(s.dividends, 100, 1e-9, 'דיבידנדים');
close(s.interest, 10, 1e-9, 'ריבית');
close(s.taxes, -25, 1e-9, 'מסים בנפרד (לא בתוך דיבידנדים)');
close(s.fees, 18, 1e-9, 'עמלות = |−1|+|2| עסקאות + |−15| עמלה נוספת');
const empty = T.ibkrPerfSums(null);
ok(empty.realized === 0 && empty.fees === 0, 'קלט null -> אפסים');

/* ---------- twr הוא אחוז כמו שהוא (בלי חלוקה ב־100) ---------- */
ok(T.fmtPct(17.25, true) === '+17.25%', 'twr=17.25 מוצג כ־+17.25% ולא כ־0.17%');

/* ---------- xirr ---------- */
const r1 = T.xirr([{ d: '2023-01-01', amt: -1000 }, { d: '2024-01-01', amt: 1100 }]);
close(r1, 10, 0.01, 'XIRR קלאסי: ‎-1000 → +1100 בשנה = 10%');
const r2 = T.xirr([
  { d: '2024-01-01', amt: -1000 },
  { d: '2024-07-02', amt: -500 },
  { d: '2025-01-01', amt: 1600 },
]);
// אימות עצמי: NPV בתשואה המחושבת צריך להיות ~0
const npvAt = (r) => [{ d: '2024-01-01', amt: -1000 }, { d: '2024-07-02', amt: -500 }, { d: '2025-01-01', amt: 1600 }]
  .reduce((sum, f) => sum + f.amt / Math.pow(1 + r / 100, (Date.parse(f.d) - Date.parse('2024-01-01')) / 31557600000), 0);
ok(r2 !== null && Math.abs(npvAt(r2)) < 1e-4, 'XIRR עם הפקדת ביניים — NPV מתאפס');
ok(T.xirr([]) === null, 'אין תזרימים -> null');
ok(T.xirr([{ d: '2024-01-01', amt: -1000 }]) === null, 'תזרים יחיד -> null');
ok(T.xirr([{ d: '2023-01-01', amt: 1000 }, { d: '2024-01-01', amt: 1100 }]) === null, 'הכל חיובי -> null');
ok(T.xirr([{ d: 'bad-date', amt: -1000 }, { d: '2024-01-01', amt: 1100 }]) === null, 'תאריך שבור -> null');

/* ---------- ibkrXirrFlows ---------- */
const fl = T.ibkrXirrFlows(sample);
ok(fl.length === 3, 'שלושה תזרימים: התחלה + הפקדה + סיום');
ok(fl[0].d === '2024-01-01' && fl[0].amt === -10000, 'ערך התחלה כהשקעה שלילית');
ok(fl[1].d === '2024-02-01' && fl[1].amt === -5000, 'הפקדה חיובית ב־Flex -> תזרים שלילי');
ok(fl[2].d === '2025-01-01' && fl[2].amt === 12000, 'ערך סיום חיובי');
const flW = T.ibkrXirrFlows({
  meta: { fromDate: '2024-01-01', toDate: '2025-01-01' },
  nav: { startingValue: 10000, endingValue: 9000 },
  cashTransactions: [{ date: '2024-06-01', amount: -2000, fxToBase: 1, type: 'Deposits/Withdrawals' }],
});
ok(flW.some((f) => f.amt === 2000), 'משיכה (שלילית ב־Flex) -> תזרים חיובי');
ok(T.ibkrXirrFlows(null) === null, 'אין נתונים -> null');
ok(T.ibkrXirrFlows({ nav: { startingValue: 0, endingValue: 0 }, meta: {} }) === null, 'בלי תאריכים -> null');

/* ---------- מטבע בסיס ---------- */
ok(T.ibkrBaseCur(sample) === 'USD', 'מטבע בסיס מהדוח');
ok(T.ibkrBaseCur(null) === 'USD', 'ברירת מחדל USD');

/* ---------- עקביות HTML/CSS ---------- */
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
for (const id of ['ibkrPerfCard', 'ibkrPerfList', 'ibkrPerfPeriod']) {
  ok(html.includes('id="' + id + '"'), 'אלמנט ' + id + ' קיים ב־index.html');
}
const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
for (const cls of ['.perf-list', '.perf-row', '.perf-lbl', '.perf-val', '.perf-note']) {
  ok(css.includes(cls), 'סגנון ' + cls + ' קיים ב־styles.css');
}

/* ---------- רווח/הפסד בתקופת הדוח (Change in NAV) ---------- */
const depData = {
  nav: { startingValue: 100000, endingValue: 120000, twr: 15.5 },
  cashTransactions: [
    { type: 'Deposits/Withdrawals', amount: 10000, fxToBase: 1, date: '2025-10-01' },
    { type: 'Deposits/Withdrawals', amount: -4000, fxToBase: 1, date: '2025-11-01' },
    { type: 'Deposits/Withdrawals', amount: 5000, fxToBase: 1.2, date: '2025-12-01' }, // מט"ח
    { type: 'Dividends', amount: 405, fxToBase: 1, date: '2025-10-15' }, // לא הפקדה — מתעלמים
    { type: 'Withholding Tax', amount: -25, fxToBase: 1, date: '2025-10-15' },
  ],
};
ok(T.ibkrNetDeposits(depData) === 10000 - 4000 + 5000 * 1.2, 'הפקדות נטו: רק deposit/withdraw, עם fxToBase');
ok(T.ibkrNetDeposits({}) === 0, 'אין תנועות -> 0');
const pg = T.ibkrPeriodGain(depData);
ok(Math.abs(pg - (120000 - 100000 - 12000)) < 1e-9, 'רווח תקופה = סיום − התחלה − הפקדות נטו');
ok(T.ibkrPeriodGain({}) === null, 'אין NAV -> null (אסור להציג מספר מטעה)');
ok(T.ibkrPeriodGain({ nav: { startingValue: 'x', endingValue: 5 } }) === null, 'NAV שבור -> null');
const html2 = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
ok(html2.includes('id="ovGLSub"'), 'תת־כותרת ovGLSub קיימת (דינמית לפי מצב)');

/* ---------- רינדור כרטיס רווח/הפסד במצב IBKR ---------- */
vm.runInContext('DB.source = "ibkr"', sandbox);
store['pwa_ibkr_v1'] = JSON.stringify({
  data: {
    meta: { fromDate: '2025-09-23', toDate: '2026-09-22', baseCurrency: 'USD' },
    nav: null, navHistory: [],
    cashTransactions: [{ type: 'Deposits/Withdrawals', amount: 3323, fxToBase: 1, date: '2026-01-01' }],
    positions: [],
  },
});
T.renderOverview();
ok(document.getElementById('ovGL').textContent === '—', 'בלי NAV: הכרטיס מציג "—" ולא מספר מטעה');
ok(document.getElementById('ovGLSub').textContent === 'בתקופת הדוח', 'תת־כותרת: בתקופת הדוח');
store['pwa_ibkr_v1'] = JSON.stringify({
  data: {
    meta: { fromDate: '2025-09-23', toDate: '2026-09-22', baseCurrency: 'USD' },
    nav: { startingValue: 100000, endingValue: 120000, twr: 15.5 },
    navHistory: [
      { toDate: '2025-09-23', endingValue: 100000 },
      { toDate: '2026-09-22', endingValue: 120000 },
    ],
    cashTransactions: [{ type: 'Deposits/Withdrawals', amount: 12000, fxToBase: 1, date: '2026-01-01' }],
    positions: [],
  },
});
T.renderOverview();
const glTxt = document.getElementById('ovGL').textContent;
ok(/8,000/.test(glTxt) && glTxt[0] === '+', 'עם NAV: רווח תקופה = 120000−100000−12000 = +$8,000 (קיבלנו ' + glTxt + ')');
ok(/15\.5/.test(document.getElementById('ovYield').textContent), 'התשואה הראשית = TWR רשמי 15.5%');
vm.runInContext('DB.source = "manual"', sandbox);

console.log('\nכל הבדיקות עברו ✓ (סה"כ אסרטים: ' + n + ')');
