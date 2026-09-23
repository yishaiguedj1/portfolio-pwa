/* בדיקות לשיוך קרנות פנסיה/השתלמות (v29). הרצה: node tests/pension-kinds.test.js */
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
  fetch: async () => { throw new Error('n/a'); },
  setTimeout, clearTimeout, confirm: () => true, console,
};
vm.createContext(sandbox);
const src = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8') +
  '\n;globalThis.__t = { ensurePensionKinds, addPensionFund, fundKindReturn, ' +
  'getDB: () => DB, state };';
vm.runInContext(src, sandbox, { filename: 'app.js' });
const T = sandbox.__t;
ok(!!T, 'app.js נטען בלי שגיאות תחביר');

const DB = T.getDB();
function setFunds(arr) { DB.pensionFunds.length = 0; DB.pensionFunds.push(...arr); }
function setDeposits(arr) { DB.pensionDeposits.length = 0; DB.pensionDeposits.push(...arr); }

/* ---------- ensurePensionKinds ---------- */
setFunds([{ name: 'מנורה מבטחים' }, { name: 'הפניקס' }, { name: 'מיטב דש' }, { name: 'קרן כללית' }]);
ok(T.ensurePensionKinds() === true, 'מזהה שינוי');
const kinds = DB.pensionFunds.map((f) => f.kind);
ok(kinds[0] === 'pension', 'מנורה -> פנסיה');
ok(kinds[1] === 'study', 'הפניקס -> השתלמות');
ok(kinds[2] === 'study', 'מיטב -> השתלמות');
ok(kinds[3] === 'pension', 'שם גנרי -> פנסיה (ברירת מחדל)');

setFunds([{ name: 'מיטב', kind: 'pension' }]);
T.ensurePensionKinds();
ok(DB.pensionFunds[0].kind === 'pension', 'לא דורס kind שהמשתמש הגדיר');

setFunds([{ name: 'מנורה', kind: 'pension' }]);
ok(T.ensurePensionKinds() === false, 'לא מדווח שינוי כשאין מה לשנות');

/* ---------- fundKindReturn לא מערבב ---------- */
setFunds([
  { name: 'מנורה', usd: 0, ils: 2200, kind: 'pension' },
  { name: 'הפניקס', usd: 0, ils: 9000, kind: 'study' },
  { name: 'מיטב', usd: 0, ils: 3000, kind: 'study' },
]);
setDeposits([{ amount: -2000, kind: 'pension', place: 'מנורה', period: '2024' }]);
const pr = T.fundKindReturn('pension');
ok(Math.abs(pr - 10) < 0.001, 'תשואת פנסיה = 10% (רק מנורה מול הפקדות מנורה), לא ' + pr);
ok(T.fundKindReturn('study') === null, 'השתלמות בלי הפקדות -> null, לא מעורבבת בפנסיה');

/* ---------- addPensionFund ---------- */
setFunds([]);
const f = T.addPensionFund('מיטב', 'study');
ok(f && f.kind === 'study' && f.usd === 0 && f.ils === 0, 'הוספת קרן השתלמות');
ok(DB.pensionFunds.length === 1, 'הקרן נכנסה לרשימה');
ok(T.addPensionFund('   ', 'pension') === null, 'שם ריק נדחה');
const f2 = T.addPensionFund('מנורה', 'pension');
ok(f2.kind === 'pension', 'הוספת קרן פנסיה');

/* ---------- HTML ---------- */
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
for (const id of ['newFundName', 'newFundKind', 'pensionFundAdd']) {
  ok(html.includes('id="' + id + '"'), 'index.html מכיל #' + id);
}
const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
const ver = (src.match(/const APP_VERSION = 'v(\d+)'/) || [])[1];
ok(!!ver, 'APP_VERSION נמצא ב־app.js');
ok(sw.includes('portfolio-pwa-v' + ver), 'sw.js תואם ל־APP_VERSION (v' + ver + ')');

console.log(`\nכל הבדיקות עברו ✓ (סה"כ אסרטים: ${n})`);
