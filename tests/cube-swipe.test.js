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
vm.runInNewContext('const CUBE_P = 1.8, CUBE_W = 17, CUBE_RUB = 0.07, CUBE_HZ = 120;' + fn(app, 'cubeTransform') + fn(app, 'cubeSpring') + fn(app, 'cubeVisible') + fn(app, 'swipeVelocity') + ';this.T = cubeTransform; this.S = cubeSpring; this.V = cubeVisible; this.SV = swipeVelocity;', ctx);
const { T, S, V, SV } = ctx, HZ = 120;
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
ok(Math.abs((s1[1] - s1[0]) * HZ - 3) < 1.2, 'הקפיץ ממשיך מהמהירות של האצבע (בלי קפיצה במהירות בשחרור)');
const s0 = S(0, 0, 1);
ok(s0.length / HZ <= 0.5 && s0.length / HZ > 0.25 && s0.findIndex((x) => x > 0.95) / HZ < 0.3, 'לחיצה: 95% מהסיבוב תוך פחות מ־0.3 שנ׳, מתייצב עד חצי שנייה (כמו בסרטון)');
ok(s0.every((x, i) => i === 0 || x >= s0[i - 1] - 1e-9), 'בלי חזרה אחורה במעבר מלא');
ok(S(0.3, -2, 0).every((x) => x >= 0 && x <= 0.31), 'ביטול: חוזר למקום');
// 14/10/2026 (בקשת המשתמש: "הסוף לא חלק" — נמדד פריים־פריים): בלי "קליק" בסוף, בלי בלימה פתאומית, 120 פריימים לשנייה
const steps = (a) => a.slice(1).map((x, i) => Math.abs(x - a[i]));
const tailOk = (a) => { const d = steps(a), k = d.length; return d[k - 1] <= d[k - 2] * 1.05 + 1e-4 && d[k - 1] < 0.004; };
ok([S(0, 0, 1), S(0.35, 2, 1), S(0.5, 6, 1), S(0.3, -1, 0), S(0.1, -0.5, 0)].every(tailOk), 'הפריים האחרון לא גדול מזה שלפניו (עד עכשיו פי 3–4 — "קליק" בסוף)');
const fast = S(0.6, 12, 1), fd = steps(fast);
ok(fd.every((x, i) => i === 0 || x <= fd[i - 1] + 1e-9) && fast.filter((x) => x === 1).length === 1, 'החלקה מהירה: מאט ברצף עד הסוף — בלי להיתקע בגבול ולעמוד (עד עכשיו 16 פריימים קפואים)');
ok(Math.abs(fd[0] * HZ - 12) < 2.5, 'החלקה מהירה: ממשיך מהמהירות של האצבע');
ok(/const CUBE_HZ = 120;/.test(core) && /\* 1000 \/ CUBE_HZ/.test(fn(app, 'cubeRun')), '120 פריימים לשנייה — בלי מדרגות במסך של 120Hz');
// מהירות האצבע ברגע השחרור (כמו VelocityTracker)
ok(Math.abs(SV([[0, 0], [16, 16], [32, 32], [48, 48], [64, 64]], 64) - 1) < 1e-6, 'מהירות קבועה — נמדדת בדיוק');
ok(SV([[0, 0], [16, 10], [32, 20], [48, 26], [64, 29], [80, 30]], 80) < 0.5, 'אצבע שהאטה — המהירות של הסוף, לא הממוצע (שזרק את הקובייה קדימה)');
ok(SV([[0, 0], [16, 16], [32, 32]], 120) === 0, 'אצבע שעמדה לפני השחרור — בלי זריקה');
ok(/swipeVelocity\(s\.samples, clock\(\)\)/.test(fn(core, 'snbSwipe')) && /swipeVelocity\(s\.samples, clock\(\)\)/.test(fn(app, 'wirePageSwipe')), 'אותה מדידה בשלוש האפליקציות');
ok(/g\.x0 = t\.clientX;/.test(fn(core, 'snbSwipe')) && /g\.x0 = t\.clientX;/.test(fn(app, 'wirePageSwipe')), 'הסיבוב מתחיל מאפס ברגע הנעילה (בלי קפיצה של סף 10 הפיקסלים)');
ok(/a\.startTime = t0/.test(fn(app, 'cubeRun')) && /performance\.now\(\) - t0 < 40/.test(fn(app, 'cubeRun')), 'השחרור — הסיבוב ממשיך מיד (בלי 1–3 פריימים של המתנה), רק מזמן פריים טרי');
ok(/transform = 'none'/.test(fn(app, 'cubeRun')), 'הפריים האחרון של הפאה שמגיעה — בלי תלת־ממד (חד כבר בפריים הזה)');
ok(/px -60px calc\(100% - /.test(fn(app, 'cubeFace')), 'חיתוך לגובה בלבד — הצל של כרטיס בשוליים לא "מופיע" בסוף');
ok(/cube-flat/.test(fn(app, 'cubeFace')) && /\.cube-flat \.appbar \{ -webkit-backdrop-filter: none !important; backdrop-filter: none !important; \}/.test(css), 'ההדר בזכוכית בלי טשטוש בפאה שבראש הגלילה (50ms לפריים → 16)');
// Invest: העמודים לא קופצים בשחרור, ושום פריסה בזמן הסיבוב
const tft = fn(app, 'tabFlowTop');
ok(/marginTop/.test(tft) && /tabFlowTop\(out\)/.test(fn(app, 'tabCubeDrag')), 'העמוד המוצמד בדיוק במקום של הזרימה (margin של הילד הראשון — עד עכשיו קפיצה של 8–16px בשחרור)');
const go = fn(app, 'tabCubeGo');
ok(/cube-out/.test(go) && !/cubeFace\(/.test(go) && /keepScroll: true/.test(go) && /style\.top = -sy/.test(go), 'בשחרור: בלי מדידה מחדש של העמודים (היוצא נשאר בזרימה, הנכנס מוצמד עד הסוף)');
ok(/tabCubeGo\(tabCubeDrag\(prev, name/.test(fn(app, 'tabCubeSwitch')), 'לחיצה על לשונית — אותה דרך כמו גרירה ושחרור');
{ const d = fn(app, 'tabCubeDrag'); ok(d.indexOf('const sy = window.scrollY') >= 0 && d.indexOf('const sy = window.scrollY') < d.indexOf("classList.add('cube-in'") && /top: top \+ sy/.test(d) && d.indexOf("pg.style.position = 'fixed'") < d.indexOf("classList.add('cube-in'") && /c\.in\.css = css0/.test(d), 'עמוד גלול: הגלילה נקראת לפני שהעמוד הנכנס מוצג, והוא מחוץ לזרימה מההתחלה (scroll anchoring הזיז את שני העמודים מהמסך באחורה)'); }
ok(/classList\.remove\('cube-in'\); cubeFaceOff\(c\.in\)/.test(fn(app, 'tabCubeRun')), 'ביטול: העמוד הנכנס מוסתר לפני שהוא חוזר לזרימה');
ok(!/tabs\.animate\(/.test(fn(app, 'tabCubeGo')) && /cancelScrollRestore\(\); navScrollTop\(\);/.test(fn(app, 'tabCubeGo')), '29/10/2026: הלשוניות קבועות בתחתית — אין שורה דבוקה שיורדת עם הגלילה');
ok(/function cubeHold\(root, y\)/.test(app) && /b\.top >= y\) continue/.test(fn(app, 'cubeHold')) && /cube-hold/.test(fn(app, 'cubeHold')), 'רצועה קבועה: מעתיקים רק את מה שמעל הקו, בלי סיבוב');
ok(/cubeClipTop\(c\.out, hy\); cubeClipTop\(c\.in, hy\)/.test(fn(app, 'cubeGhostRun')) && /cubeClipTop\(s\.cube\.out, hy\)/.test(fn(app, 'snbSwipe')), 'הפאות נחתכות מתחת לרצועה — בלחיצה ובגרירה');
ok(/holdOn\(c, 'commit'\)/.test(fn(app, 'snbSwipe')) && /holdOn\(c, 'cancel'\)/.test(fn(app, 'snbSwipe')) && /c\.hold\.remove\(\)/.test(fn(app, 'snbSwipe')), 'הרצועה משלימה/חוזרת בשחרור ויורדת בסוף');
{ const lib = fs.readFileSync(path.join(__dirname, '..', 'library.js'), 'utf8'); ok(!/segHold|shelfSeg|lib-seg/.test(lib), 'Academy (29/10/2026): הבורר שמתחת להדר הוסר — החוגה בתחתית במקומו'); }
ok(/fitNumbers\(pg\)/.test(fn(app, 'tabCubeDrag')), 'המספרים בעמוד הנכנס מותאמים כבר בגרירה — לא משנים גודל באמצע הסיבוב');
ok(/function tabPrewarm\(\)/.test(app) && /tabPrewarm\(\);/.test(fn(app, 'switchTab')) && /_prewarmCss/.test(fn(app, 'tabCubeDrag')), 'העמודים השכנים נצבעים מראש כשהטלפון פנוי');

// ---- אותה חוקיות בשלוש האפליקציות: הספים וההחלטה בתוך core
ok(/PAGE_SWIPE_FRAC = 0\.33, PAGE_SWIPE_MIN = 96/.test(core) && /function pageSwipeDecide\(d, w, v\)/.test(core) && !/WL_SWIPE/.test(core + app), 'הספים של Invest (v281) ו־pageSwipeDecide ב־core.js; בלי "החלקה קצרה" בשום מקום');
for (const f of ['cubeTransform', 'cubeSpring', 'cubeFace', 'cubeRun', 'cubeClone', 'cubeGhostRun', 'cubeSlideIn', 'snbSwipe']) ok(new RegExp('function ' + f + '\\(').test(core), f + ' ב־core.js');
const sw = fn(app, 'snbSwipe');
ok(/pageSwipeDecide\(d, g\.w, 0\)/.test(sw) && /pageSwipeDecide\(s\.d \|\| 0, s\.w, Math\.max\(0, v\)\)/.test(sw), 'snbSwipe — אותה החלטה כמו ב־Invest (גם בשחרור)');
ok(!/hasTabs|o\.tabs|tabMove/.test(sw), 'בלי טאבים בהחלקה — רק עמודים (בקשת המשתמש)');
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
ok(/tabCubeGo\(c, v0, c\.to, null\)/.test(fn(app, 'tabCubeCommit')) && /switchTab\(name, Object\.assign\(\{\}, opts, \{ cubeDone: true, keepScroll: true \}\)\)/.test(fn(app, 'tabCubeGo')), 'Invest: בהתחייבות — switchTab האמיתי (מראש העמוד), הסיבוב ממשיך');

// ---- Academy
ok(/if \(\(kind === 'push' \|\| kind === 'pop'\) && cubeOk\(\)\) return cubeNav\(kind, y\)/.test(lib), 'Academy: מעבר בין דפים (לחיצה, "חזור") = קובייה');
ok(/const LIB_SIB = \['mine', 'snb', 'notes'\]/.test(lib) && /wireLibSwipe\(\);/.test(lib), 'Academy (29/10/2026, כמו החוגה): מימין לשמאל — הגדרות ← THE SNOWBALL ← הספרייה שלי ← מה למדתי');
ok(!/libSwipeTabs/.test(lib) && /libDialTo\(v\)/.test(fn(lib, 'setShelf')) && /navigateTo\(k !== cur && fwd \? 'push' : 'pop', 0\)/.test(fn(lib, 'libDialTo')), 'Academy: שתי הספריות = עמודים בקובייה (גם בלחיצה בחוגה)');
ok(/!\(history\.state \|\| \{\}\)\.sb\)\) return next \? null : libBackPage\(\)/.test(fn(lib, 'libSwipePage')) && /sb: sb/.test(fn(lib, 'goView')), 'Academy: החלקה אחורה לבית רק כשהבית באמת מתחת לרשומה');
ok(/if \(swipePop > 0\)/.test(fn(lib, 'onPop')), 'Academy: חזרה לבית בהחלקה לא מציירת שוב ב־popstate');
ok(/pv: pv/.test(fn(lib, 'goView')) && /return next \? null : libBackPage\(\)/.test(fn(lib, 'libSwipePage')) && /ui\.view = to;/.test(fn(lib, 'libBackPage')) && /swipePop\+\+; afterBack\(\(\) => history\.back\(\)\)/.test(fn(lib, 'libBackPage')), 'Academy: בעמוד משנה החלקה אחורה = "חזור" לדף הקודם (נשמר ברשומה), צמוד לאצבע');
ok(/const LIB_NOBACK = \['edit', 'mgr', 'admin'\]/.test(lib), 'Academy: בלי החלקה אחורה בעריכה ובניהול');

// ---- Studio
const r = fn(st, 'render');
ok(/cubeClone\(root\)/.test(r) && /cubeGhostRun\(root, ghost, cubeSideFwd\(fwd\)\)/.test(r) && /const fwd = kind === 'push' \|\| kind === 'dfwd'/.test(r), 'Studio: מעבר בין דפים = קובייה');
ok(/const ST_SIB = \['ka', 'home', 'job', 'tower'\]/.test(st) && /wireStSwipe\(\);/.test(st), 'Studio: עמודים ראשיים (29–30/10/2026, כמו החוגה) = בית ← קריוקי ← העבודה ← מגדל הפיקוח, ההחלקה מחוברת');
ok(!/stSwipeTabs|ST_TABS/.test(st) && /stTab\('alTab', k\)/.test(st), 'Studio: בלי החלקה בין הלשוניות — רק בלחיצה');
ok(/'play', 'subs', 'cut'/.test(st), 'Studio: בלי החלקה בנגן, בעורכים ובטפסים');
ok(/if \(swipePop > 0\)/.test(fn(st, 'onPop')), 'Studio: חזרה לבית בהחלקה לא מציירת שוב ב־popstate');

// ---- ההעתק והרקע
ok(/\.cube-ghost, \.cube-ghost \*, \.cube-hold, \.cube-hold \* \{ transition: none !important; \}/.test(css)
  && /\.cube-ghost, \.cube-ghost \*:not\(\.brand, \.brand \*\), \.cube-hold, \.cube-hold \*:not\(\.brand, \.brand \*\) \{ animation: none !important; \}/.test(css), 'ההעתק והרצועה הקבועה בלי אנימציות כניסה שמתחילות מחדש');
// 29/10/2026 (גלאי הנחיתה): הרצועה הקבועה זהה לדף — רקע בגודל השכבה המלאה, אב חלקי בגובה המקורי (הלשוניות הדביקות לא נדחפות)
ok(/st\.backgroundSize = r\.width \+ 'px ' \+ r\.height \+ 'px'; st\.backgroundPosition = '0 0'/.test(core), 'הרצועה הקבועה — הרקע המדורג בגודל השכבה, לא נדחס');
ok(/copy\(ch, b\.height\)/.test(core) && /if \(hh > 0\) \{ c\.style\.boxSizing = 'border-box'; c\.style\.minHeight = hh \+ 'px'; \}/.test(core), 'הרצועה הקבועה — אב שהועתק חלקית בגובה המקורי (sticky לא נדחף)');
ok(/:is\(\.st-root, \.lib-root\):is\(\.cube-face, \.cube-ghost\) \*, [^{]*\{ -webkit-backdrop-filter: none !important; backdrop-filter: none !important; \}/.test(css), 'בלי זכוכית בפאה מסתובבת — Studio ו־Academy');
// 29/10/2026: הלוגו החי ממשיך באותו רגע — בהעתק, בכל כניסה של ההדר ל־DOM (Studio/Academy)
ok(/function animSync\(el\)[\s\S]{0,700}a\.startTime = 0/.test(core) && /animSync\(el\); animSync\(c\);/.test(core), 'הלוגו בהעתק — באותו שעון של המקור (animSync)');
ok(/root\.replaceChildren\(p\);[\s\S]{0,200}animSync\(SA\.shell\.el\)/.test(st), 'Studio: ההדר שנכנס שוב לבית — הלוגו ממשיך (animSync)');
// 27/10/2026 (סרטון המשתמש — מנתח החברות): הרצועה הקבועה הריצה מחדש את אנימציית הכניסה של השכבה, והגרף בראש נעלם בהעתקים
ok((app.match(/querySelectorAll\('\[id\]:not\(svg \*\)'\)/g) || []).length === 2, 'ההעתקים (cubeClone, cubeHold) שומרים מזהים בתוך SVG — מעבר צבע בגרף לא נעלם');
{
  const an = fs.readFileSync(path.join(__dirname, '..', 'analysis.js'), 'utf8');
  ok(/S\.hero && S\.hero\.co === co && S\.hero\.k === hk \? S\.hero\.el/.test(an), 'מנתח החברות: הגרף בראש עובר מציור לציור — לא נבנה מחדש בכל מעבר לשונית');
  ok(/width: cw \|\| w \+ 'px'/.test(an) && /width: \(fw \|\| w\) \+ 'px'/.test(an), 'מנתח החברות: הגלולה בבורר זזה גם ברוחב — לא נמתחת על שתי לשוניות');
}
ok(/\.cube-bd \{ position: fixed; inset: 0; z-index: 899; background: var\(--bg\);/.test(css), 'רקע אטום מתחת לשכבה — התיק לא מבצבץ בין הפאות (לקח v330)');
ok(/dead: true/.test(fn(app, 'cubeGhostRun')) && !/pointerEvents = 'none'; *\n *return f/.test(fn(app, 'cubeFace')), 'רק הפאה היוצאת חסומה — הנכנסת לחיצה כבר בזמן הסיבוב');
ok(/^\s*if \(cubeNow && cubeNow !== _dial\.ride && cubeNow\.finish\) cubeNow\.finish\(\);[^\n]*\s*const c = el\.cloneNode\(true\);/m.test(fn(app, 'cubeClone').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n')), 'מעבר שני ברצף: הקודם מסתיים לפני ההעתק — השכבה לא נשארת מסובבת');
ok(/\[id\]:not\(svg \*\)'\)\.forEach\(\(x\) => x\.removeAttribute\('id'\)\)/.test(fn(app, 'cubeClone')) && /inert = true/.test(fn(app, 'cubeClone')), 'ההעתק: בלי מזהים כפולים, לא לחיץ');
console.log('# ' + n + ' בדיקות עברו');
// 30/10/2026 (בקשת המשתמש): ההגדרות נפתחות רק מהתפריט — בכל האפליקציות כפתור והחלקה אחורה לעמוד הראשי
ok(/if \(ui\.view && ui\.view\.settings\) return next \? null : libSibPage\(libKeyOf\(ui\.view\), 'snb'\)/.test(lib) && /addEventListener\('click', \(\) => libDialTo\('snb'\)\)/.test(lib), 'Academy: מההגדרות — "‹ THE SNOWBALL" והחלקה אחורה לעמוד הראשי');
ok(/if \(ui\.view === 'settings'\) return next \? null : stSibPage\('home'\)/.test(st) && /navBar\(\{ back: T\('studioDialHome'\), go: \(\) => stDialTo\('home'\) \}\)/.test(st), 'Studio: מההגדרות — "‹ תרגום סרטונים" והחלקה אחורה לעמוד הראשי');
