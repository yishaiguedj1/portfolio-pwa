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
vm.runInNewContext("const TAB_ORDER = ['settings', 'overview', 'stocks', 'wishlist', 'trades', 'deposits', 'pension', 'advanced', 'backup'];" +
  (app.match(/const PAGE_SWIPE_MAIN = [^\n]+/) || [''])[0] + fn('pageSwipeTarget') + ';this.f = pageSwipeTarget;', ctx);
const f = ctx.f;
// 30/10/2026 (בקשת המשתמש): מימין לשמאל — סקירה, מניות, מעקב, עסקאות, הפקדות, פנסיה; ההגדרות — רק מהתפריט
ok(f('overview', true) === 'stocks' && f('wishlist', true) === 'trades' && f('trades', true) === 'deposits' && f('deposits', true) === 'pension', 'הבא (שמאלה ב־RTL) לפי סדר הלשוניות');
ok(f('wishlist', false) === 'stocks' && f('stocks', false) === 'overview', 'הקודם (ימינה) לפי סדר הלשוניות');
ok(f('pension', true) === null && f('overview', false) === null, 'בקצוות — אין עמוד');
ok(f('settings', true) === null && f('settings', false) === null, 'ההגדרות מחוץ להחלקה — נפתחות רק מהתפריט (30/10/2026)');
ok(f('nope', true) === null, 'עמוד לא ראשי — בלי החלקה');

// v281: סף כמו הסטנדרט (טהורה). 14/10/2026 (בקשת המשתמש): בלי "החלקה קצרה" לרשימות — החלקה = עמוד בכל מקום
const dctx = {};
vm.runInNewContext("const PAGE_SWIPE_FRAC = 0.33, PAGE_SWIPE_MIN = 96, PAGE_FLING_V = 0.45, PAGE_FLING_FRAC = 0.15, PAGE_FLING_MIN = 56;" + fn('pageSwipeDecide') + ';this.d = pageSwipeDecide;', dctx);
const D = dctx.d, W = 412;
ok(/PAGE_SWIPE_FRAC = 0\.33, PAGE_SWIPE_MIN = 96/.test(app) && /PAGE_FLING_V = 0\.45/.test(app), 'הקבועים בקוד = הקבועים בבדיקה');
ok(D(110, W, 0.1) === null && D(140, W, 0.1) === 'page', 'משיכה איטית: שליש מהרוחב');
ok(D(80, W, 0.8) === 'page' && D(40, W, 2) === null, 'הטלה מהירה: רק מ־15% מהרוחב');
ok(!/WL_SWIPE|WL_PAGE_FRAC|'list'/.test(fn('pageSwipeDecide')) && !/WL_SWIPE_MIN/.test(app), 'אין יותר "החלקה קצרה" לרשימות (בקשת המשתמש)');
ok(!/function wireWatchSwipe/.test(app), 'מנגנון אחד לשתי המחוות (בלי מאזין כפול)');
const w = fn('wirePageSwipe');
ok(/Math\.abs\(dx\) < Math\.abs\(dy\) \* 1\.5\) \{ unhook\(g\); g = null; return; \}/.test(w), 'תנועה אנכית = גלילה, לא החלקה');
ok(/const v = swipeVelocity\(s\.samples, clock\(\)\)/.test(w) && /let act = pageSwipeDecide\(s\.d \|\| 0, s\.w, Math\.max\(0, v\)\)/.test(w), 'ההחלטה בשחרור לפי מרחק + מהירות האצבע ברגע השחרור, בכיוון (14/10/2026: swipeVelocity)');
ok(/PAGE_SWIPE_EDGE/.test(w), 'קצה המסך (מחוות חזור) לא נחשב');
ok(/canvas, \.sc-ov, input, textarea, select/.test(fn('pageSwipeBlocked')) && /\.wl-tabs/.test(fn('pageSwipeBlocked')), 'גרף/שדה/טאבי רשימות — לא מחליקים עמוד');
ok(/overflowX/.test(fn('pageSwipeBlocked')), 'פס גלילה אופקי — לא מחליקים עמוד');
ok(!/wlSwitch|wlTo|watch/.test(w), 'במעקב — החלקה = עמוד, בין הרשימות רק בלחיצה (14/10/2026)');
ok(/dragBusy\(\)/.test(w) && /state\.cardAnim/.test(w), 'לא בזמן גרירה/אנימציית כרטיס');
ok(/tg\.addEventListener\('touchmove', move, \{ passive: false \}\)/.test(w), 'האזנה על האלמנט — עמיד לרענון חי');
ok(/html, body \{ overscroll-behavior-x: none; \}/.test(css), 'בלי "חזור" של הדפדפן במשיכה אופקית');
ok(/s\.style\.animation = ''/.test(fn('setTabPageDirection')) && /setTabPageDirection\(prev, name\)/.test(fn('switchTab')), 'מעבר עמוד מחזיר את אנימציית הכניסה');
ok(/try \{ wirePageSwipe\(\); \}/.test(app), 'מחובר באתחול');
// v283: אחרי מעבר בהחלקה — לראש העמוד / לראש טאבי הרשימות
ok(/if \(s\.cube && s\.cube\.in\) tabCubeCommit\(s\.cube, Math\.max\(0, vp\)\);[^\n]*\n\s*else \{ switchTab\(s\.to\); swipeScrollTop\(\); \}/.test(w) && /navScrollTop\(\)/.test(fn('tabCubeGo')), 'מעבר עמוד → ראש העמוד (גם כשנשמר מיקום גלילה); בקובייה — tabCubeGo גולל בשחרור, והיוצא נשאר במקומו');
const sst = fn('swipeScrollTop');
ok(/cancelScrollRestore\(\)/.test(sst) && /topCover\(\)/.test(sst) && /position === 'sticky'/.test(fn('topCover')), 'מתחת להדר ולסרגל הדביקים (topCover), בלי שחזור הגלילה');
ok(!/on\.scrollIntoView\(\{ block: 'nearest'/.test(app) && /tabs\.scrollBy\(\{ left:/.test(app), 'צ׳יפ הרשימה נגלל אופקית בלבד (לא מזיז את העמוד)');
ok(/document\.addEventListener\('touchmove', \(e\) => \{ if \(g\) move\(e\); \}, \{ passive: false \}\)/.test(w) && /const seen = /.test(w), 'גם על המסמך (אלמנט שהוחלף), כל אירוע פעם אחת');
ok(!/sy0[\s\S]{0,5}y0: window/.test(w) && /y0: t\.clientY/.test(w), 'y0 = מיקום האצבע (לא נדרס)');

// לוגו
const bh = fn('wireBrandHome');
ok(/switchTab\('overview'\)/.test(bh) && /scrollTo\(\{ top: 0/.test(bh), 'לוגו → סקירה (בסקירה — לראש העמוד)');
ok(/try \{ wireBrandHome\(\); \}/.test(app) && /\.appbar h1\.brand \{ cursor: pointer;/.test(css), 'הלוגו לחיץ');
console.log('# ' + n + ' בדיקות עברו');
