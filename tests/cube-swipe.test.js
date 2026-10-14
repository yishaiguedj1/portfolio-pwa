// 14/10/2026: מעבר "קובייה" בין עמודים + אותה חוקיות החלקה בשלוש האפליקציות (בקשת המשתמש — כמו במשגר של OnePlus 15)
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const rd = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const app = rd('app.js'), core = rd('core.js'), lib = rd('library.js'), st = rd('studio.js'), css = rd('styles.css');
const fn = (src, name) => { const i = src.indexOf('function ' + name + '('); if (i < 0) return ''; let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && !--d) return src.slice(i, k + 1); } return ''; };

// ---- המנוע: טהור, בתוך core (מגיע ל־Academy ול־Studio דרך core.js)
const ctx = {};
vm.runInNewContext('const CUBE_P = 1.8, CUBE_W = 17, CUBE_RUB = 0.07;' + fn(app, 'cubeTransform') + fn(app, 'cubeSpring') + fn(app, 'cubeVisible') + ';this.T = cubeTransform; this.S = cubeSpring; this.V = cubeVisible;', ctx);
const { T, S, V } = ctx;
const parse = (s) => { const m = /perspective\(([-\d.]+)px\) translateZ\(([-\d.]+)px\) rotateY\(([-\d.]+)deg\) translateZ\(([-\d.]+)px\)/.exec(s); return m ? m.slice(1).map(Number) : null; };
const W = 390;
ok(/const CUBE_P = 1\.8/.test(app), 'נקודת המבט = 1.8 רוחבי מסך (נמדד בסרטון)');
const z0 = parse(T(0, 1, false, W));
ok(z0 && Math.abs(z0[1] + z0[3]) < 0.01 && z0[2] === 0, 'בהתחלה — העמוד היוצא במקומו (בלי תזוזה)');
ok(parse(T(1, 1, true, W))[2] === 0 && Math.abs(parse(T(1, 1, true, W))[1] + W / 2) < 0.01, 'בסוף — העמוד הנכנס במקומו');
ok(parse(T(0, 1, true, W))[2] === 90 && parse(T(0, -1, true, W))[2] === -90, 'הנכנס מתחיל בצד הנכון (side)');
let edgeOk = true, convex = true;
for (const p of [0.1, 0.25, 0.5, 0.75, 0.9]) {
  for (const side of [1, -1]) {
    // הצלע המשותפת: בפאה היוצאת x = side·W/2, בנכנסת x = −side·W/2 — עומק אחרי ההעתקות = 0 (נשארת במישור המסך)
    const depth = (tr, x) => { const [, t1, a, t2] = parse(tr); const r = a * Math.PI / 180; return t1 + (-x * Math.sin(r) + t2 * Math.cos(r)); };
    const dOut = depth(T(p, side, false, W), side * W / 2), dIn = depth(T(p, side, true, W), -side * W / 2);
    if (Math.abs(dOut) > 0.6 || Math.abs(dIn) > 0.6) edgeOk = false;
    if (depth(T(p, side, false, W), -side * W / 2) >= 0) convex = false;   // הצלע הרחוקה של היוצא — מאחורי המסך
  }
}
ok(edgeOk, 'הצלע המשותפת נשארת בגובה המסך בכל זווית (הקובייה נסוגה — כמו בסרטון)');
ok(convex, 'קובייה קמורה: הצלע הרחוקה נסוגה אחורה');
// 14/10/2026 (דיווח המשתמש): פאה שהגב שלה פונה אליך — מוסתרת כולה; ההדר בזכוכית (שכבה מורכבת) הופיע הפוך מעל הדף החדש
ok(V(0, 1, false, W) && !V(0, 1, true, W) && V(1, 1, true, W) && !V(1, 1, false, W), 'בהתחלה רק היוצא, בסוף רק הנכנס');
ok(!V(0.92, -1, false, W) && !V(0.08, -1, true, W) && V(0.5, -1, false, W) && V(0.5, -1, true, W), 'קרוב לקצה — הפאה שמפנה גב מוסתרת, באמצע שתיהן גלויות');
ok(/opacity: c\.rub \|\| cubeVisible\(q, c\.side, isIn, vw\) \? 1 : 0/.test(fn(app, 'cubeRun')) && /style\.opacity = cubeVisible/.test(fn(app, 'cubeSet')), 'ההסתרה גם באנימציה וגם בגרירה');
const s1 = S(0.4, 3, 1);
ok(Math.abs(s1[0] - 0.4) < 1e-9 && s1[s1.length - 1] === 1 && s1.every((x) => x >= 0 && x <= 1), 'הקפיץ: מהמקום של האצבע עד הסוף, בגבולות');
ok(Math.abs((s1[1] - s1[0]) * 60 - 3) < 1.2, 'הקפיץ ממשיך מהמהירות של האצבע (בלי קפיצה במהירות בשחרור)');
const s0 = S(0, 0, 1);
ok(s0.length / 60 <= 0.5 && s0.length / 60 > 0.25 && s0.findIndex((x) => x > 0.95) / 60 < 0.3, 'לחיצה: 95% מהסיבוב תוך פחות מ־0.3 שנ׳, מתייצב עד חצי שנייה (כמו בסרטון)');
ok(s0.every((x, i) => i === 0 || x >= s0[i - 1] - 1e-9), 'בלי חזרה אחורה במעבר מלא');
ok(S(0.3, -2, 0).every((x) => x >= 0 && x <= 0.31), 'ביטול: חוזר למקום');

// ---- אותה חוקיות בשלוש האפליקציות: הספים וההחלטה בתוך core
ok(/PAGE_SWIPE_FRAC = 0\.33, PAGE_SWIPE_MIN = 96/.test(core) && /WL_SWIPE_MIN = 48, WL_SWIPE_MAX_FRAC = 0\.3, WL_PAGE_FRAC = 0\.55/.test(core) && /function pageSwipeDecide\(/.test(core), 'הספים של Invest (v281) ו־pageSwipeDecide ב־core.js');
for (const f of ['cubeTransform', 'cubeSpring', 'cubeFace', 'cubeRun', 'cubeClone', 'cubeGhostRun', 'cubeSlideIn', 'snbSwipe']) ok(new RegExp('function ' + f + '\\(').test(core), f + ' ב־core.js');
const sw = fn(app, 'snbSwipe');
ok(/pageSwipeDecide\(d, g\.w, 0, true\)/.test(sw) && /pageSwipeDecide\(s\.d \|\| 0, s\.w, fwd \? v : 0, s\.watch\)/.test(sw), 'snbSwipe — אותה החלטה כמו ב־Invest (גם בשחרור)');
ok(/d < zone\) tx = g\.tab \? d \* 0\.5/.test(sw) && /p = \(d - zone\) \/ \(g\.w - zone\)/.test(sw), 'עמוד עם טאבים: קצרה = התוכן של הטאב, ארוכה = העמוד מסתובב');
ok(/Math\.abs\(dx\) < Math\.abs\(dy\) \* 1\.5\) \{ unhook\(g\); g = null; return; \}/.test(sw) && /PAGE_SWIPE_EDGE/.test(sw), 'תנועה אנכית = גלילה; קצה המסך ("חזור") לא נחשב');
ok(/tg\.addEventListener\('touchmove', move, \{ passive: false \}\)/.test(sw) && /document\.addEventListener\('touchmove'/.test(sw) && /const seen = /.test(sw), 'האלמנט שנגעו בו נמחק כשהעמוד השכן נצבע — האזנה עליו ועל המסמך (לקח v283)');
ok(/Promise\.resolve\(r\)\.then\(done, done\)/.test(sw), 'ביטול: הדף הקודם נצבע מאחורי ההעתק — ורק אז ההעתק יורד (בלי הבהוב)');

// ---- Invest
const s = fn(app, 'switchTab');
ok(/tabCubeOk\(prev, name, opts\)\) return tabCubeSwitch\(prev, name, opts\)/.test(s) && /cubeNow\.finish\(\)/.test(s), 'switchTab: מעבר בקובייה (מעבר קודם מסתיים מיד)');
ok(/opts\.restore \|\| opts\.instant \|\| opts\.uaAnim/.test(fn(app, 'tabCubeOk')) && /cubeReduce\(\)/.test(fn(app, 'tabCubeOk')), 'בלי קובייה: שחזור בפתיחה, "חזור" ש־Chrome כבר הנפיש, הפחתת תנועה');
ok(/uaAnim: !!\(e && e\.hasUAVisualTransition\)/.test(fn(app, 'wireBackNav')), '"חזור" עם האנימציה של Chrome — בלי קובייה כפולה');
ok(/s\.classList\.add\('no-in'\)/.test(s) && /\.tabpage\.no-in \{ animation: none; \}/.test(css), 'אחרי קובייה — בלי אנימציית הכניסה (no-in עד שהעמוד יוצא)');
ok(/\.tabpage\.cube-in, \.tabpage\.cube-out \{ display: block; \}/.test(css), 'הנכנס בגרירה והיוצא בסיבוב — מוצגים');
const w = fn(app, 'wirePageSwipe');
ok(/g\.cube = tabCubeDrag\(g\.cur, g\.to, cubeSideFwd\(g\.next\)\)/.test(w) && /cubeSet\(g\.cube, g\.cube\.rub \? pp \* 0\.15 : pp\)/.test(w), 'Invest: העמוד מסתובב צמוד לאצבע; בלי עמוד — קפיץ קטן');
ok(!/g\.page\.style\.(transform|opacity)/.test(w), 'Invest: בלי ההזזה/השקיפות הישנות של העמוד');
ok(/tabPageRender\(to\)/.test(fn(app, 'tabCubeDrag')) && /_renderForce = true/.test(fn(app, 'tabPageRender')), 'Invest: העמוד הנכנס נצבע בגרירה למרות שאינו פעיל');
ok(/switchTab\(c\.to, \{ cubeDone: true \}\)/.test(fn(app, 'tabCubeCommit')), 'Invest: בהתחייבות — switchTab האמיתי (מראש העמוד), הסיבוב ממשיך');

// ---- Academy
ok(/if \(\(kind === 'push' \|\| kind === 'pop'\) && cubeOk\(\)\) return cubeNav\(kind, y\)/.test(lib), 'Academy: מעבר בין דפים (לחיצה, "חזור") = קובייה');
ok(/const LIB_SIB = \['home', 'notes', 'settings'\]/.test(lib) && /wireLibSwipe\(\);/.test(lib), 'Academy: עמודים ראשיים = בית ← מה למדתי ← הגדרות, ההחלקה מחוברת');
ok(/\['snb', 'mine'\]/.test(fn(lib, 'libSwipeTabs')) && /cubeSlideIn/.test(fn(lib, 'setShelf')), 'Academy: טאבים פנימיים = שתי הספריות, נכנסות מהצד');
ok(/!\(history\.state \|\| \{\}\)\.sb\) return null/.test(fn(lib, 'libSwipePage')) && /sb: sb/.test(fn(lib, 'goView')), 'Academy: החלקה אחורה לבית רק כשהבית באמת מתחת לרשומה');
ok(/if \(swipePop > 0\)/.test(fn(lib, 'onPop')), 'Academy: חזרה לבית בהחלקה לא מציירת שוב ב־popstate');

// ---- Studio
const r = fn(st, 'render');
ok(/cubeClone\(root\)/.test(r) && /cubeGhostRun\(root, ghost, cubeSideFwd\(kind === 'push'\)\)/.test(r), 'Studio: מעבר בין דפים = קובייה');
ok(/const ST_SIB = \['home', 'tower', 'settings'\]/.test(st) && /wireStSwipe\(\);/.test(st), 'Studio: עמודים ראשיים = בית ← מגדל הפיקוח ← הגדרות, ההחלקה מחוברת');
ok(/alert: 'alTab', inc: 'incTab'/.test(st) && /stTab\('alTab', k\)/.test(st) && /stTab\('incTab', k\)/.test(st), 'Studio: טאבים פנימיים = פרטים · ציר · קשורות (גם בלחיצה — נכנסים מהצד)');
ok(/'play', 'subs', 'cut'/.test(st), 'Studio: בלי החלקה בנגן, בעורכים ובטפסים');
ok(/if \(swipePop > 0\)/.test(fn(st, 'onPop')), 'Studio: חזרה לבית בהחלקה לא מציירת שוב ב־popstate');

// ---- ההעתק והרקע
ok(/\.cube-ghost, \.cube-ghost \* \{ animation: none !important; transition: none !important; \}/.test(css), 'ההעתק בלי אנימציות כניסה שמתחילות מחדש');
ok(/\.cube-bd \{ position: fixed; inset: 0; z-index: 899; background: var\(--bg\);/.test(css), 'רקע אטום מתחת לשכבה — התיק לא מבצבץ בין הפאות (לקח v330)');
ok(/dead: true/.test(fn(app, 'cubeGhostRun')) && !/pointerEvents = 'none'; *\n *return f/.test(fn(app, 'cubeFace')), 'רק הפאה היוצאת חסומה — הנכנסת לחיצה כבר בזמן הסיבוב');
ok(/^\s*if \(cubeNow && cubeNow\.finish\) cubeNow\.finish\(\);\s*const c = el\.cloneNode\(true\);/m.test(fn(app, 'cubeClone').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n')), 'מעבר שני ברצף: הקודם מסתיים לפני ההעתק — השכבה לא נשארת מסובבת');
ok(/\[id\]'\)\.forEach\(\(x\) => x\.removeAttribute\('id'\)\)/.test(fn(app, 'cubeClone')) && /inert = true/.test(fn(app, 'cubeClone')), 'ההעתק: בלי מזהים כפולים, לא לחיץ');
console.log('# ' + n + ' בדיקות עברו');
