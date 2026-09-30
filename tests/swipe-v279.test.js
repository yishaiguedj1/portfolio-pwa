// v279→v281: החלקה אופקית בין העמודים הראשיים (משיכה מלאה בלבד, אחרי האחרון — הגדרות) + לוגו → סקירה
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
// v281: סף כמו הסטנדרט + הפרדה במעקב (טהורה)
const dctx = {};
vm.runInNewContext("const PAGE_SWIPE_FRAC = 0.33, PAGE_SWIPE_MIN = 96, PAGE_FLING_V = 0.45, PAGE_FLING_FRAC = 0.15, PAGE_FLING_MIN = 56;" +
  "const WL_SWIPE_MIN = 48, WL_SWIPE_MAX_FRAC = 0.3, WL_PAGE_FRAC = 0.55;" + fn('pageSwipeDecide') + ';this.d = pageSwipeDecide;', dctx);
const D = dctx.d, W = 412;
ok(/PAGE_SWIPE_FRAC = 0\.33, PAGE_SWIPE_MIN = 96/.test(app) && /PAGE_FLING_V = 0\.45/.test(app) && /WL_SWIPE_MIN = 48, WL_SWIPE_MAX_FRAC = 0\.3, WL_PAGE_FRAC = 0\.55/.test(app), 'הקבועים בקוד = הקבועים בבדיקה');
ok(D(110, W, 0.1, false) === null && D(140, W, 0.1, false) === 'page', 'משיכה איטית: שליש מהרוחב');
ok(D(80, W, 0.8, false) === 'page' && D(40, W, 2, false) === null, 'הטלה מהירה: רק מ־15% מהרוחב');
ok(D(90, W, 0, true) === 'list' && D(30, W, 0, true) === null, 'מעקב: החלקה קצרה = רשימה');
ok(D(180, W, 0, true) === null, 'מעקב: אזור ביניים — כלום (הפרדה ודאית)');
ok(D(240, W, 0, true) === 'page' && D(100, W, 3, true) === 'list', 'מעקב: רק משיכה ארוכה = עמוד; הטלה לא מעבירה עמוד');
ok(!/function wireWatchSwipe/.test(app), 'מנגנון אחד לשתי המחוות (בלי מאזין כפול)');
const w = fn('wirePageSwipe');
ok(/Math\.abs\(dx\) < Math\.abs\(dy\) \* 1\.5\) \{ unhook\(g\); g = null; return; \}/.test(w), 'תנועה אנכית = גלילה, לא החלקה');
ok(/let act = pageSwipeDecide\(s\.d \|\| 0, s\.w, fwd \? v : 0, s\.watch\)/.test(w), 'ההחלטה בשחרור לפי מרחק + מהירות בכיוון');
ok(/PAGE_SWIPE_EDGE/.test(w), 'קצה המסך (מחוות חזור) לא נחשב');
ok(/canvas, \.sc-ov, input, textarea, select/.test(fn('pageSwipeBlocked')) && /\.wl-tabs/.test(fn('pageSwipeBlocked')), 'גרף/שדה/טאבי רשימות — לא מחליקים עמוד');
ok(/overflowX/.test(fn('pageSwipeBlocked')), 'פס גלילה אופקי — לא מחליקים עמוד');
ok(/const watch = cur === 'wishlist' && wlLists\(\)\.length > 1;/.test(w) && /wlSwitch\(s\.wlTo/.test(w), 'במעקב עם כמה רשימות — מצב שתי מחוות בכל הטאב (גם רשימה ריקה)');
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
