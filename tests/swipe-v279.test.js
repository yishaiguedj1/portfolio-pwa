// v279: החלקה אופקית בין העמודים הראשיים (משיכה מלאה בלבד, אחרי האחרון — הגדרות) + לוגו → סקירה
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const fn = (name) => { const i = app.indexOf('function ' + name + '('); let d = 0, j = app.indexOf('{', i); for (let k = j; k < app.length; k++) { if (app[k] === '{') d++; else if (app[k] === '}' && !--d) return app.slice(i, k + 1); } return ''; };

// סדר העמודים — טהור
const ctx = {};
vm.runInNewContext("const TAB_ORDER = ['overview', 'stocks', 'trades', 'wishlist', 'deposits', 'pension', 'settings'];" +
  "const PAGE_SWIPE_MAIN = TAB_ORDER.filter((t) => t !== 'settings');" + fn('pageSwipeTarget') + ';this.f = pageSwipeTarget;', ctx);
const f = ctx.f;
ok(f('stocks', true) === 'trades' && f('trades', true) === 'wishlist', 'הבא לפי סדר הלשוניות');
ok(f('trades', false) === 'stocks' && f('stocks', false) === 'overview', 'הקודם לפי סדר הלשוניות');
ok(f('overview', false) === null, 'לפני הסקירה — אין עמוד');
ok(f('pension', true) === 'settings', 'אחרי העמוד האחרון — תמיד ההגדרות');
ok(f('settings', true) === null && f('settings', false) === 'pension', 'מההגדרות — רק חזרה');
ok(f('nope', true) === null, 'עמוד לא ראשי — בלי החלקה');

// לא קל מדי
ok(/PAGE_SWIPE_FRAC = 0\.45, PAGE_SWIPE_MIN = 150/.test(app), 'סף: 45% מהרוחב, לפחות 150px');
const w = fn('wirePageSwipe');
ok(/Math\.abs\(dx\) < Math\.abs\(dy\) \* 1\.5\) \{ unhook\(g\); g = null; return; \}/.test(w), 'תנועה אנכית = גלילה, לא החלקה');
ok(/const armed = !!g\.to && d >= need;/.test(w) && /if \(s\.armed && s\.to/.test(w), 'מעבר רק אחרי משיכה מלאה (בלי הטלה מהירה)');
ok(/PAGE_SWIPE_EDGE/.test(w), 'קצה המסך (מחוות חזור) לא נחשב');
ok(/canvas, \.sc-ov, input, textarea, select/.test(fn('pageSwipeBlocked')) && /\.wl-tabs/.test(fn('pageSwipeBlocked')), 'גרף/שדה/טאבי רשימות — לא מחליקים עמוד');
ok(/overflowX/.test(fn('pageSwipeBlocked')), 'פס גלילה אופקי — לא מחליקים עמוד');
ok(/g\.cur === 'wishlist' && g\.inList/.test(w), 'במעקב — קודם מעבר בין רשימות');
ok(/dragBusy\(\)/.test(w) && /state\.cardAnim/.test(w), 'לא בזמן גרירה/אנימציית כרטיס');
ok(/tg\.addEventListener\('touchmove', move, \{ passive: false \}\)/.test(w), 'האזנה על האלמנט — עמיד לרענון חי');
ok(/html, body \{ overscroll-behavior-x: none; \}/.test(css), 'בלי "חזור" של הדפדפן במשיכה אופקית');
ok(/s\.style\.animation = ''/.test(fn('setTabPageDirection')) && /setTabPageDirection\(prev, name\)/.test(fn('switchTab')), 'מעבר עמוד מחזיר את אנימציית הכניסה');
ok(/try \{ wirePageSwipe\(\); \}/.test(app), 'מחובר באתחול');

// לוגו
const bh = fn('wireBrandHome');
ok(/switchTab\('overview'\)/.test(bh) && /scrollTo\(\{ top: 0/.test(bh), 'לוגו → סקירה (בסקירה — לראש העמוד)');
ok(/try \{ wireBrandHome\(\); \}/.test(app) && /\.appbar h1\.brand \{ cursor: pointer;/.test(css), 'הלוגו לחיץ');
console.log('# ' + n + ' בדיקות עברו');
