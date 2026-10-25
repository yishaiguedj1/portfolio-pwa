/* 25/10/2026 — באג: "סך הפקדות נטו" גדל בכל סנכרון IBKR. זיהוי הכפילויות היה לפי הסכום בשקלים,
   שתלוי בשער שהיה זמין ברגע הסנכרון — אותה הפקדה קיבלה סכום אחר ונוספה שוב.
   עכשיו הפקדות IBKR נגזרות מהדוח הממוזג (ibkrRebuildDeposits), והתצוגה במטבע ההפקדה.
   הרצה: node tests/ibkr-deps-dup.test.js */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

let n = 0;
const ok = (cond, name) => { n++; assert(cond, name); console.log('ok -', name); };
const store = {};
const sandbox = {
  localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
  document: { addEventListener() {}, getElementById: () => null, querySelectorAll: () => [], createElement: () => ({}) },
  window: {}, navigator: {}, location: {},
  fetch: async () => { throw new Error('no fetch'); },
  setTimeout, clearTimeout, console,
};
vm.createContext(sandbox);
const src = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8') +
  '\n;globalThis.__t = { ibkrRebuildDeposits, ibkrSyncDeposits, depNative, depILS, depositAmountHTML, netDepositsILS, ' +
  'setFx: (c) => { fxHistCache = c; }, db: () => DB, deps: () => DEPOSITS };';
vm.runInContext(src, sandbox, { filename: 'app.js' });
const T = sandbox.__t;

const txs = [
  { date: '2026-06-26', amount: 3318.73, currency: 'USD', fxToBase: 1, type: 'Transfer IN', description: 'TRANSFER FROM A TO B' },
  { date: '2026-10-23', amount: -6335, currency: 'USD', fxToBase: 1, type: 'Transfer OUT', description: 'TRANSFER FROM B TO A' },
  { date: '2026-03-01', amount: 7000, currency: 'ILS', fxToBase: 0.3, type: 'Deposits/Withdrawals', description: 'Deposit' },
];
const data = { meta: { fromDate: '20260101', toDate: '20261023' }, cashTransactions: txs };
const manual = { date: '05/01/2026', amount: -1000, place: 'ידני' };
const oldOutside = { date: '2025-05-01', amount: -500, place: 'ישן', src: 'ibkr' };

// סנכרון ראשון — בלי היסטוריית שערים (נופל לשער של היום), שני — עם שער אחר
const first = T.ibkrRebuildDeposits([manual, oldOutside], data, () => 3.0);
const second = T.ibkrRebuildDeposits(first, data, () => 3.4);
const third = T.ibkrRebuildDeposits(second, data, () => 3.7);
ok(first.length === 5, 'ידני + ישן מחוץ לטווח + 3 מהדוח');
ok(third.length === 5, 'סנכרונים חוזרים עם שער שונה — בלי כפילויות');
ok(third.includes(manual) && third.some((d) => d.place === 'ישן'), 'ידני והפקדה מחוץ לטווח הדוח נשמרים');

// כפילויות ישנות מהבאג (בלי cur/amt, הסכום המקורי בתיאור) — נעלמות
const dupOld = [manual,
  { date: '2026-10-23', amount: 19774.7, place: 'TRANSFER FROM B TO A · USD 6,335', src: 'ibkr' },
  { date: '2026-10-23', amount: 20100.1, place: 'TRANSFER FROM B TO A · USD 6,335', src: 'ibkr' },
  { date: '2026-06-26', amount: -9949.22, place: 'TRANSFER FROM A TO B · USD 3,318.73', src: 'ibkr' },
  { date: '2026-06-26', amount: -10200, place: 'TRANSFER FROM A TO B · USD 3,318.73', src: 'ibkr' },
];
ok(T.depNative(dupOld[1]).cur === 'USD' && T.depNative(dupOld[1]).amt === -6335, 'רשומה ישנה: הסכום המקורי מהתיאור (משיכה = שלילי)');
ok(T.depNative(manual) === null, 'הפקדה ידנית — בלי מטבע מקור (שקלים)');
const fixed = T.ibkrRebuildDeposits(dupOld, data, () => 3.1);
ok(fixed.length === 4, 'הכפילויות מהבאג נעלמו');

// ibkrSyncDeposits על ה־DB החי — במקום, ואידמפוטנטי
const db = T.db();
db.deposits.length = 0; db.deposits.push(...dupOld);
ok(T.ibkrSyncDeposits(data) === true, 'תיקון: השתנה');
ok(T.deps() === db.deposits && T.deps().length === 4, 'DEPOSITS מצביע לאותו מערך (עריכה במקום)');
ok(T.ibkrSyncDeposits(data) === false, 'הרצה שנייה — בלי שינוי');

// הסך בשקלים לא תלוי בשער של רגע הסנכרון: עם היסטוריית שערים — לפי יום ההפקדה
T.setFx({ dates: ['2026-01-01'], rates: { '2026-01-01': 3.5 } });
const usdIn = db.deposits.find((d) => d.date === '2026-06-26');
ok(T.depILS(usdIn) === -Math.round(3318.73 * 3.5 * 100) / 100, 'הפקדה בדולרים — לפי שער יום ההפקדה');
const ilsIn = db.deposits.find((d) => d.date === '2026-03-01');
ok(T.depILS(ilsIn) === -7000, 'הפקדה בשקלים — כמו שהיא');
const nd = T.netDepositsILS();
ok(Math.abs(nd - (1000 + 7000 + 3318.73 * 3.5 - 6335 * 3.5)) < 0.02, 'סך נטו נכון');

// תצוגה במטבע ההפקדה
const out = db.deposits.find((d) => d.date === '2026-10-23');
const h1 = T.depositAmountHTML(out.amount, T.depNative(out));
ok(/−\$6,335/.test(h1) && !/₪/.test(h1), 'משיכה בדולרים מוצגת "−$6,335"');
const h2 = T.depositAmountHTML(usdIn.amount, T.depNative(usdIn));
ok(/\$3,318\.73/.test(h2) && /r-amt out/.test(h2), 'הפקדה בדולרים מוצגת בדולרים');
ok(/₪7,000/.test(T.depositAmountHTML(ilsIn.amount, T.depNative(ilsIn))), 'הפקדה בשקלים — בשקלים');

console.log('\nכל ' + n + ' הבדיקות עברו.');
