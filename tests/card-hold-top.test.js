// 31/10/2026 — כרטיס מניה שנפתח נשאר מתחת להדר גם כשתוכן נטען אחרי הפתיחה (holdCardTop)
const fs = require('fs');
const path = require('path');
const vm = require('vm');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const fn = (src, name) => { const i = src.indexOf('function ' + name + '('); if (i < 0) return ''; let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } } return ''; };
ok(/if \(opening && steer\) holdCardTop\(sym\);/.test(fn(app, 'toggleStock')), 'toggleStock מחזיק את הכרטיס אחרי פתיחה');

function run(touch) {
  const timers = [], ls = {}, pins = [];
  const card = { isConnected: true };
  const ctx = {
    state: { open: { META: true }, cardAnim: null },
    window: { addEventListener: (e, f) => { ls[e] = f; }, removeEventListener: (e) => { delete ls[e]; } },
    setTimeout: (f, ms) => timers.push([ms, f]),
    stockCardEl: () => card,
    scrollCardToTop: (c) => pins.push(c),
  };
  vm.runInNewContext(fn(app, 'holdCardTop') + 'holdCardTop("META");', ctx);
  timers.sort((a, b) => a[0] - b[0]);
  timers[0][1]();
  if (touch) ls.touchstart();
  for (const t of timers.slice(1)) t[1]();
  return { pins: pins.length, timers: timers.length, left: Object.keys(ls).length };
}
const a = run(false);
ok(a.timers === 4 && a.pins === 4, 'בלי מגע — מצמיד בכל אחת מארבע הבדיקות');
ok(a.left === 0, 'המאזינים מוסרים בסוף');
const b = run(true);
ok(b.pins === 1, 'אחרי מגע/גלילה של המשתמש — מפסיק להצמיד');
console.log(n + ' passed');
