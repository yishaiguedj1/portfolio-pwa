/* בדיקות לזיהוי הפקדות/משיכות מ־IBKR: ibkrIsDepositTx / ibkrMapDeposits / ibkrCashTxTypeList.
   הרצה: node tests/ibkr-deposits.test.js */
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
const sandbox = {
  localStorage, document,
  window: {}, navigator: {}, location: {},
  fetch: async () => { throw new Error('no fetch'); },
  setTimeout, clearTimeout, console,
};
vm.createContext(sandbox);
const src = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8') +
  '\n;globalThis.__t = { ibkrIsDepositTx, ibkrMapDeposits, ibkrCashTxTypeList };';
vm.runInContext(src, sandbox, { filename: 'app.js' });
const T = sandbox.__t;
ok(!!T, 'app.js נטען בלי שגיאות תחביר');

/* ---------- ibkrIsDepositTx ---------- */
ok(T.ibkrIsDepositTx({ type: 'Deposits/Withdrawals' }) === true, 'סוג סטנדרטי Deposits/Withdrawals מזוהה');
ok(T.ibkrIsDepositTx({ type: 'Deposit' }) === true, 'Deposit יחיד מזוהה');
ok(T.ibkrIsDepositTx({ type: 'Withdrawal' }) === true, 'Withdrawal מזוהה');
ok(T.ibkrIsDepositTx({ type: '', description: 'Wire deposit received' }) === true, 'ניסוח ב־description מזוהה כגיבוי');
ok(T.ibkrIsDepositTx({ type: 'Dividends' }) === false, 'דיבידנד לא נחשב הפקדה');
ok(T.ibkrIsDepositTx({ type: 'Withholding Tax' }) === false, 'מס לא נחשב הפקדה');
ok(T.ibkrIsDepositTx({ type: 'Broker Interest Paid' }) === false, 'ריבית לא נחשבת הפקדה');
ok(T.ibkrIsDepositTx({ type: 'Deposits/Withdrawals', description: 'INTERNAL TRANSFER' }) === false, 'העברה פנימית מסוננת');
ok(T.ibkrIsDepositTx(null) === false, 'רשומה ריקה לא נחשבת הפקדה');
ok(T.ibkrIsDepositTx({}) === false, 'רשומה בלי שדות לא נחשבת הפקדה');

/* ---------- ibkrMapDeposits ---------- */
const fxOf = () => 3.5;
const mapped = T.ibkrMapDeposits([
  { type: 'Deposits/Withdrawals', description: 'Electronic Deposit', amount: 1000, currency: 'USD', date: '2025-01-05', fxToBase: 1 },
  { type: 'Deposits/Withdrawals', description: 'Cash withdrawal', amount: -200, currency: 'USD', date: '2025-02-10', fxToBase: 1 },
  { type: 'Dividends', description: 'DIV', amount: 50, currency: 'USD', date: '2025-03-01', fxToBase: 1 },
  { type: 'Deposits/Withdrawals', description: 'INTERNAL TRANSFER', amount: 500, currency: 'USD', date: '2025-04-01', fxToBase: 1 },
  { type: 'Deposits/Withdrawals', description: 'Zero', amount: 0, currency: 'USD', date: '2025-05-01', fxToBase: 1 },
  { type: 'Deposits/Withdrawals', description: 'ILS deposit', amount: 7000, currency: 'ILS', date: '2025-06-01', fxToBase: 1 },
], fxOf);
ok(mapped.length === 3, 'רק 3 הפקדות/משיכות אמיתיות מופו (דיבידנד, פנימית ואפס סוננו)');
ok(mapped[0].amount === -3500 && mapped[0].date === '2025-01-05', 'הפקדה בדולרים: סימן שלילי + המרה לשקלים');
ok(mapped[1].amount === 700 && mapped[1].date === '2025-02-10', 'משיכה: סימן חיובי');
ok(mapped[2].amount === -7000 && mapped[2].currency === undefined, 'הפקדה בשקלים נשארת כמו שהיא');
ok(/USD 1,000/.test(mapped[0].place), 'הסכום המקורי נשמר לתצוגה');

/* ---------- ibkrCashTxTypeList ---------- */
const types = T.ibkrCashTxTypeList([
  { type: 'Dividends' }, { type: 'Deposits/Withdrawals' }, { type: 'Dividends' }, { type: '' }, {},
]);
ok(JSON.stringify(types) === JSON.stringify(['Deposits/Withdrawals', 'Dividends']), 'רשימת סוגים ייחודית וממוינת');
ok(T.ibkrCashTxTypeList([]).length === 0, 'רשימה ריקה בלי תנועות');
ok(T.ibkrCashTxTypeList(null).length === 0, 'null לא קורס');

console.log('\nכל ' + n + ' הבדיקות עברו.');
