/* בדיקות לרשימת המעקב (wishlist) ב־app.js. הרצה: node tests/wishlist.test.js */
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
  fetch: async () => { throw new Error('fetch לא הוגדר בטסט'); },
  setTimeout, clearTimeout, confirm: () => true,
  console,
};
vm.createContext(sandbox);
const src = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8') +
  '\n;globalThis.__t = { wlValidate, quoteSymbols };';
vm.runInContext(src, sandbox, { filename: 'app.js' });
const T = sandbox.__t;
ok(!!T, 'app.js נטען בלי שגיאות תחביר');

/* ---------- ולידציה ---------- */
vm.runInContext('WISHLIST = []; POSITIONS = [{ sym: "NOW", shares: 97, avg: 89 }];', sandbox);
ok(T.wlValidate('nvda').sym === 'NVDA', 'סימבול תקין מנורמל לאותיות גדולות');
ok(!!T.wlValidate('xx!').err, 'סימבול לא תקין נדחה');
vm.runInContext('WISHLIST.push({ sym: "NVDA", note: "" });', sandbox);
ok(!!T.wlValidate('NVDA').err, 'כפילות ברשימת המעקב נדחית');
ok(!!T.wlValidate('NOW').err, 'מניה שכבר בתיק לא ניתנת להוספה למעקב');

/* ---------- סימבולים לציטוט ---------- */
vm.runInContext('WISHLIST = [{ sym: "NVDA", note: "" }, { sym: "TSLA", note: "x" }]; POSITIONS = [{ sym: "NOW", shares: 97, avg: 89 }];', sandbox);
const syms = T.quoteSymbols();
ok(syms.includes('NOW') && syms.includes('NVDA') && syms.includes('TSLA'), 'הציטוט כולל אחזקות + מעקב');
ok(syms.length === 3, 'אין כפילויות בסימבולים');
vm.runInContext('WISHLIST.push({ sym: "NOW", note: "" });', sandbox);
ok(T.quoteSymbols().length === 3, 'סימבול כפול (תיק+מעקב) נספר פעם אחת');

/* ---------- עקביות קבצים ---------- */
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
for (const id of ['tab-wishlist', 'wishlistList', 'wishlistCount', 'wlSym', 'wlNote', 'wlAddBtn', 'wlErr']) {
  ok(html.includes('id="' + id + '"'), 'אלמנט ' + id + ' קיים ב־index.html');
}
const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
for (const cls of ['.wl-card', '.wl-sym', '.wl-close', '.wl-chg']) {
  ok(css.includes(cls), 'סגנון ' + cls + ' קיים ב־styles.css');
}

console.log('\nכל הבדיקות עברו ✓ (סה"כ אסרטים: ' + n + ')');
