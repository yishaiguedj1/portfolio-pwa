// ui-v153.test.js — אחרי רענון חוזרים לאותו טאב ולאותה נקודת גלילה.
// לפני: (1) בלי מפתח Twelve Data כל רענון עבר להגדרות; (2) השחזור קפץ לפני שהתוכן נטען,
// הדפדפן חתך את הקפיצה והמיקום החתוך נשמר על האמיתי.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }

ok(!/if \(!tdKey\(\)\) \{ switchTab\('settings'\); \}/.test(src), 'אין מעבר כפוי להגדרות כשאין מפתח Twelve Data');
ok(/history\.scrollRestoration = 'manual'/.test(src), 'הדפדפן לא מתחרה בשחזור (scrollRestoration=manual)');
ok(/if \(scrollRestoring\(\)\) return; \/\/ v153/.test(src), 'לא שומרים מיקום בזמן שחזור');
ok(/switchTab\('settings'\);\s*cancelScrollRestore\(\);/.test(src), 'כפתור ההגדרות (גלובוס בתפריט פתוח) מבטל שחזור — לראש העמוד בכוונה');

// סימולציה: עמוד שמתארך אחרי 600ms (תוכן מהענן/רשת)
const timers = []; let now = 0;
const store = {};
const listeners = {};
const win = {
  innerHeight: 900, scrollY: 0,
  scrollTo(x, y) { const max = Math.max(0, docEl.scrollHeight - 900); win.scrollY = Math.min(y, max); },
  addEventListener(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); },
  removeEventListener(ev, fn) { listeners[ev] = (listeners[ev] || []).filter((f) => f !== fn); },
};
const docEl = { scrollHeight: 900 };
const sb = {
  localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
  document: { documentElement: docEl, addEventListener() {}, getElementById: () => null, querySelectorAll: () => [],
    querySelector: (q) => (q === '.tab.active' ? { dataset: { tab: 'stocks' } } : null),
    createElement: () => ({ classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {} }) },
  window: win, navigator: {}, location: {}, AbortController, fetch: () => Promise.reject(new Error('x')),
  setTimeout: (fn, ms) => { timers.push({ at: now + (ms || 0), fn }); return timers.length; },
  clearTimeout: (id) => { if (timers[id - 1]) timers[id - 1].fn = null; },
  Date: { now: () => now }, console,
};
vm.createContext(sb);
vm.runInContext(src, sb);
const run = (ms) => { const end = now + ms; for (;;) { timers.sort((a, b) => a.at - b.at); const t = timers.find((x) => x.fn && x.at <= end); if (!t) break; now = t.at; const f = t.fn; t.fn = null; f(); } now = end; };

vm.runInContext("restoreScrollTo('stocks', 1400)", sb);
run(300);
ok(win.scrollY === 0 && vm.runInContext('scrollRestoring()', sb), 'עמוד קצר: עדיין מחכה (לא נכנע)');
docEl.scrollHeight = 3000; run(300);
ok(win.scrollY === 1400 && !vm.runInContext('scrollRestoring()', sb), 'התוכן הגיע: קופץ בדיוק לנקודה השמורה ומסיים');

win.scrollY = 0; docEl.scrollHeight = 900;
vm.runInContext("restoreScrollTo('stocks', 1400)", sb); run(100);
(listeners.touchstart || []).forEach((f) => f());
docEl.scrollHeight = 3000; run(500);
ok(win.scrollY === 0 && !vm.runInContext('scrollRestoring()', sb), 'המשתמש נגע במסך: השחזור נעצר, בלי קפיצה מפתיעה');

docEl.scrollHeight = 900; vm.runInContext("restoreScrollTo('stocks', 1400)", sb); run(9000);
ok(!vm.runInContext('scrollRestoring()', sb), 'תוכן שלא הגיע: מוותרים אחרי 8 שניות');

const ver = (src.match(/APP_VERSION = '(v\d+)'/) || [])[1];
ok(fs.readFileSync(path.join(root, 'sw.js'), 'utf8').includes('portfolio-pwa-' + ver), 'CACHE_NAME תואם לגרסה');
console.log('\n' + n + ' בדיקות עברו');
