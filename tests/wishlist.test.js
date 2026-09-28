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
  '\n;globalThis.__t = { wlValidate, quoteSymbols, wlItem, sortWatchList };';
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
// v240: רשימת המעקב זהה לטאב המניות — אותו חיפוש, אותו מיון, אותם כרטיסים (בלי נתוני אחזקה)
for (const id of ['tab-wishlist', 'wishlistList', 'wlSearchInput', 'wlSearchResults', 'wlSearchClear', 'wlSearchCancel', 'wlSortRow']) {
  ok(html.includes('id="' + id + '"'), 'אלמנט ' + id + ' קיים ב־index.html');
}
ok(!/id="wlSym"|id="wlAddBtn"|data-i18n="wishlistHint"/.test(html), 'v240: הטופס הישן וטקסט ההסבר הוסרו');
ok(!html.includes('id="wishlistCount"') && !html.includes('id="stockCount"'), 'v232/v240: בלי מונים בלשוניות (מעקב ומניות)');
const fnSrc = (name) => { const a = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8'); const i = a.indexOf('function ' + name + '('); return a.slice(i, a.indexOf('\n}\n', i)); };
const appSrc = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
ok(/buildStockCard\(wlItem\(w\)\)/.test(fnSrc('renderWishlist')), 'v240: כרטיסי המעקב = buildStockCard (אותו כרטיס כמו בטאב המניות)');
ok(/p\.watch \? '' : srcTagHTML/.test(appSrc) && /if \(p\.watch\) return watchKvHTML/.test(appSrc), 'v240: במעקב — בלי תגית מקור ובלי אריחי אחזקה');
const it = T.wlItem({ sym: 'NVDA', note: 'n' });
ok(it.watch === true && it.sym === 'NVDA' && !('shares' in it) && !('avg' in it), 'wlItem: פריט מעקב בלי כמות/ממוצע');
const sw = T.sortWatchList([{ sym: 'B' }, { sym: 'A' }, { sym: 'C' }], 'day', (s) => ({ A: 1, B: null, C: 3 })[s]);
ok(sw.map((x) => x.sym).join('') === 'CAB', 'מיון לפי ביצועי היום — בלי נתון בסוף');
ok(T.sortWatchList([{ sym: 'B' }, { sym: 'A' }], 'name', () => 0).map((x) => x.sym).join('') === 'AB', 'מיון א״ב');
ok(T.sortWatchList([{ sym: 'B' }, { sym: 'A' }], 'added', () => 0).map((x) => x.sym).join('') === 'BA', 'סדר הוספה = כמו שנשמר');
console.log('\nכל הבדיקות עברו ✓ (סה"כ אסרטים: ' + n + ')');
