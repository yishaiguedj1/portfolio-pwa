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
  '\n;globalThis.__t = { ibkrPerfSums, ibkrXirrFlows, xirr, ibkrBaseCur, ibkrNav, fmtPct };';
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

console.log('\nכל הבדיקות עברו ✓ (סה"כ אסרטים: ' + n + ')');
