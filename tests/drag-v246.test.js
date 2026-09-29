// drag-v246.test.js — סידור בגרירה + "סדר הוספה" בטאב המניות (בקשת המשתמש 29/09/2026)
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
let n = 0;
function ok(cond, name) { n++; if (!cond) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const sb = {
  localStorage: { _s: {}, getItem(k) { return k in this._s ? this._s[k] : null; }, setItem(k, v) { this._s[k] = String(v); }, removeItem(k) { delete this._s[k]; } },
  document: { hidden: false, activeElement: null, addEventListener() {}, getElementById: () => null, querySelectorAll: () => [], querySelector: () => null,
    createElement: () => ({ classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {}, style: {} }) },
  window: {}, navigator: {}, location: {}, AbortController, fetch: () => Promise.reject(new Error('no net')),
  setTimeout, clearTimeout, console: { log() {}, warn() {}, error: console.error },
};
vm.createContext(sb);
vm.runInContext(fs.readFileSync(path.join(root, 'returns.js'), 'utf8'), sb);
vm.runInContext(src, sb);
const R = (c) => vm.runInContext(c, sb);
ok(R('getStockSort()') === 'added', 'ברירת מחדל בטאב המניות: "סדר הוספה"');
const list = [{ sym: 'A' }, { sym: 'B' }, { sym: 'C' }, { sym: 'D' }];
const val = { A: 10, B: 40, C: 30, D: 20 };
const mOf = (p) => ({ value: val[p.sym], dayChg: 0, gainPct: 0 });
sb.__list = list; sb.__mOf = mOf;
const order = (o) => R('sortPositionsList(__list, "added", __mOf, ' + JSON.stringify(o) + ')').map((p) => p.sym).join('');
ok(order([]) === 'BCDA' && order(null) === 'BCDA', 'בלי סידור ידני — לפי גודל בתיק');
ok(order(['D', 'A', 'B', 'C']) === 'DABC', 'סידור ידני נשמר כמו שנגרר');
ok(order(['C', 'A']) === 'CABD', 'מניה שלא סודרה (חדשה/מסנכרון) — אחרי המסודרות, לפי גודל');
ok(order(['X', 'C']) === 'CBDA', 'מניה שנמכרה ברשימה השמורה — מתעלמים');
ok(R('sortPositionsList(__list, "size", __mOf, ["D","A","B","C"])').map((p) => p.sym).join('') === 'BCDA', 'מיון אחר — הסידור הידני לא משפיע');
ok(/data-sort="added" data-i18n="wlSortAdded"[^>]*>סדר הוספה<\/button>\s*<button class="chip-btn sort-chip" type="button" data-sort="size"/.test(html), '"סדר הוספה" ראשון בשורת המיון של המניות');
ok(/canDrag: \(\) => getStockSort\(\) === 'added' && getSrcFilter\('stocks'\) === 'all'/.test(src) && /canDrag: \(\) => getWatchSort\(\) === 'added'/.test(src), 'גרירה רק ב"סדר הוספה" (במניות — בלי סינון)');
ok(/onDrop: \(syms\) => \{ DB\.stockOrder = syms; saveDB\(\); \}/.test(src), 'הסדר במניות נשמר (DB.stockOrder → ענן)');
ok(/if \(Array\.isArray\(clean\.stockOrder\)\) DB\.stockOrder = clean\.stockOrder/.test(fs.readFileSync(path.join(root, 'cloud.js'), 'utf8')), 'ענן: הסדר עובר בין מכשירים');
ok(/list\._dragging\) \{ list\._pendingRender = true; return; \}/.test(src), 'ציור מחדש (עדכון מחירים) לא שובר גרירה באמצע');
ok(/html\.drag-active \.tabpage \{ transform: none !important/.test(css), 'בזמן גרירה — בלי transform על הדף (אחרת position:fixed נמדד ממנו)');
ok(/\.stock-head \{ -webkit-touch-callout: none;/.test(css), 'לחיצה ארוכה לא פותחת בחירת טקסט/תפריט');
console.log('\n' + n + ' בדיקות עברו');
