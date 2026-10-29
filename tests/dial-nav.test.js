/* החוגה בתחתית המסך (29/10/2026, בקשת המשתמש — לפי סרטון): הגאומטריה, ההצלבה בין הבועות, הסנכרון עם הקובייה והמבנה.
   הרצה: node tests/dial-nav.test.js */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
let n = 0;
const ok = (c, name) => { n++; assert(c, name); console.log('ok -', name); };
const R = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const app = R('app.js'), css = R('styles.css'), html = R('index.html');
const fn = (name) => { const i = app.indexOf('function ' + name + '('); assert(i >= 0, name); return app.slice(i, app.indexOf('\n}\n', i) + 2); };
const line = (re) => { const m = app.match(re); assert(m, String(re)); return m[0]; };

const ctx = { Math, JSON, NAV_SUBS: ['advanced', 'backup'], CUBE_RUB: 0.07 };
vm.createContext(ctx);
vm.runInContext([line(/const TAB_ORDER = [^\n]*/), line(/const DIAL_TABS = [^\n]*/), line(/const DIAL_SET = [^\n]*/), line(/const DIAL_S0 = [^\n]*/), line(/function investDialIndex[^\n]*/), fn('dialStep'), fn('dialRest'), fn('dialFrame'), fn('dialCubeState'), fn('dialRubber')].join('\n')
  + '\nthis.api = { DIAL_TABS, DIAL_SET, dialIndex: investDialIndex, dialStep, dialRest, dialFrame, dialCubeState, dialRubber };', ctx);
const A = ctx.api;
const num = (s, i) => +String(s).replace('translate3d', '').match(/-?[\d.]+/g)[i];

// מספור
ok(A.DIAL_TABS.join() === 'settings,overview,stocks,wishlist,trades,deposits,pension', 'הסדר מימין לשמאל: הגדרות, סקירה (הראשי), מניות, מעקב, עסקאות, הפקדות, פנסיה (29/10/2026)');
ok(A.dialIndex('settings') === 0 && A.dialIndex('overview') === 1 && A.dialIndex('advanced') === 0 && A.dialIndex('backup') === 0, 'עמודי המשנה של ההגדרות = "הגדרות"');
ok([...html.matchAll(/<button class="tab[^"]*" data-tab="(\w+)"/g)].map((m) => m[1]).join() === A.DIAL_TABS.join(), 'סדר הכפתורים ב־index.html = DIAL_TABS');

// מנוחה: הפעיל במרכז, גבוה ומוגדל; השכנים על הקשת
const f = A.dialFrame(A.dialRest(3), 7, 412, true);
ok(num(f[3].it, 0) === 0 && num(f[3].it, 1) < 0 && f[3].glow === 1 && f[3].bub === 1 && f[3].ico === 0 && f[3].lbl === 0, 'הפעיל במרכז: בועה עם כיתוב, בלי סמל ובלי כיתוב מתחת');
ok(/scale\(1\)/.test(f[3].disc) && /scale\(0\.66\)/.test(f[2].disc), 'הבועה בגודל מלא (חדה), השאר מוקטנים');
// 29/10/2026 (בקשת המשתמש, צילום מהטלפון): הפרדה בין הבועה לשכנים גם במסך צר — הבועה (39) + עיגול שכן + 6px לפחות; בין העיגולים — 6px לפחות; הקצה עדיין חצי־גלוי
for (const vw of [360, 390, 412, 430]) {
  const g = A.dialFrame(A.dialRest(3), 7, vw, true), x = (i) => Math.abs(num(g[i].it, 0)), r = (i) => 39 * 0.66 * (1 - 0.045 * Math.abs(i - 3));
  ok(x(2) - 39 - r(2) >= 6 && x(4) - 39 - r(4) >= 6 && x(1) - x(2) - r(1) - r(2) >= 6, 'רווח בין הבועה לשכנים ובין העיגולים (' + vw + 'px)');
  ok(x(0) - r(0) < vw / 2, 'הקצה נראה (' + vw + 'px)');
}
ok(Math.abs(num(A.dialFrame(A.dialRest(1), 4, 360, true)[0].it, 0)) === A.dialStep(360, 4), 'ארבעה פריטים — בלי המרווח הנוסף (רחב ממילא)');
ok(num(f[2].it, 0) > 0 && num(f[4].it, 0) < 0, 'RTL: הקודם מימין למרכז, הבא משמאל');
ok(num(f[5].it, 1) > num(f[4].it, 1) && num(f[4].it, 1) > 0, 'קשת: ככל שרחוק מהמרכז — נמוך יותר');
ok(f.every((v) => v.o === 1), 'כל השבעה גלויים כשהאמצעי במרכז — הקצוות בצדדים');
ok(Math.abs(num(f[0].it, 0)) + 46 > 206 && Math.abs(num(f[0].it, 0)) < 206, 'הקצוות חצי־גלויים: מרכז הפריט בתוך המסך, חלקו מעבר לקצה (412px)');
ok(A.dialFrame({ pos: 0, from: 0, to: 0, p: 0 }, 7, 412, true)[6].o === 0, 'מעבר לשבעה מקומות — נמוג');
ok(A.dialStep(412) >= 60 && A.dialStep(412) * 3 < 206, 'המרחק בין פריטים — שלושה מכל צד נכנסים במסך');
ok(num(A.dialFrame(A.dialRest(3), 7, 412, false)[4].it, 0) > 0, 'LTR: הבא מימין');

// הצלבה: באמצע המעבר שתי הבועות חצי־שקופות, והחוגה באמצע הדרך
const m = A.dialFrame({ pos: 1.5, from: 1, to: 2, p: 0.5 }, 7, 412, true);
ok(m[1].glow === 0.5 && m[2].glow === 0.5 && num(m[1].it, 0) === -num(m[2].it, 0), 'באמצע: שתי הבועות חצי, סימטריות סביב המרכז');

// הקובייה: החוגה = אותה זווית
const c = { dial: { pos0: 1, from: 1, to: 2, dir: 1 } };
ok(A.dialCubeState(c, 0).pos === 1 && A.dialCubeState(c, 1).pos === 2 && A.dialCubeState(c, 0.25).p === 0.25, 'זווית הקובייה ↔ מיקום החוגה וההצלבה');
const r = { dial: { pos0: 0, from: 0, to: null, dir: -1 } };
ok(A.dialCubeState(r, 1).pos < 0 && A.dialCubeState(r, 1).pos > -0.3 && A.dialCubeState(r, 1).to === 0, '"קפיץ" (אין עמוד): נמשכת מעט, הבחירה לא משתנה');
ok(A.dialRubber(-1, 5) < 0 && A.dialRubber(-1, 5) > -0.5 && A.dialRubber(3, 5) === 3 && A.dialRubber(6, 5) < 5.5, 'גרירה מעבר לקצה — בהתנגדות');

// חיבור לקובייה ולמעברים
ok(/dialCubeRun\(c, p1, v0\);[^\n]*\n  cubeRun\(c, p1, v0, \(\) => \{\n[^\n]*\n    dialCubeDone\(c\);/.test(fn('tabCubeRun')), 'tabCubeRun: החוגה באותו קפיץ, ומסתיימת עם הקובייה');
ok(/const ps = cubeSpring\(c\.p \|\| 0, v0 \|\| 0, p1\)/.test(fn('dialCubeRun')) && /a\.startTime = t0/.test(fn('dialAnimate')), 'אותה סדרת מיקומים ואותו זמן התחלה כמו cubeRun');
ok(/dialCubeBegin\(c, cur, to, side\);/.test(fn('tabCubeDrag')) && /cubeSet\(g\.cube, [^)]*\); dialCube\(g\.cube\);/.test(app), 'גרירת עמוד: החוגה צמודה לאצבע');
ok(/_dial\.run && _dial\.run\.to === i/.test(fn('dialSync')), 'switchTab לא מפריע לחוגה שכבר נוסעת עם הקובייה');
ok(/dialRidePaint\(_dial\.ride, pos\)/.test(fn('wireDial')) && /dialRideRun\(r, /.test(fn('wireDial')) && /e\.stopPropagation\(\); e\.preventDefault\(\);/.test(fn('wireDial')), 'גרירת החוגה מעבירה גם את העמודים (29/10/2026), ולא נחשבת ללחיצה');
ok(/_dial\.ride/.test(fn('dialSync')), 'switchTab בזמן נסיעה של החוגה לא עוצר אותה');
ok(/const c = hst\.begin\(name, to, cubeSideFwd\(dir > 0\)\)/.test(fn('dialRideCube')) && /if \(p < 1\) return cubeSet\(r\.c, p\);/.test(fn('dialRideCube')) && /hst\.land\(c\);/.test(fn('dialRideCube')), 'הקובייה צמודה למיקום החוגה; בזווית מלאה — השכן נעשה הנוכחי');
const inv = app.slice(app.indexOf('const INVEST_DIAL = {'), app.indexOf('/* <core> */', app.indexOf('const INVEST_DIAL = {')));
ok(/const c = tabCubeDrag\(cur, to, side\);/.test(inv) && /switchTab\(c\.to, \{ cubeDone: true, keepScroll: true \}\)/.test(inv) && /cubeNow = r;/.test(fn('dialRideRun')) && /CUBE_HZ/.test(fn('dialRideRun')), 'Invest: הקובייה של העמודים; נחיתה כמו סוף קובייה; השחרור באותו קפיץ, ונגיעה חדשה מסיימת אותו');
ok(/dialHost\(INVEST_DIAL\); wireDial\(INVEST_DIAL\.nav\(\)\);/.test(app), 'Invest מארח את החוגה בפתיחה');
const core = R('core.js');
ok(['dialFrame', 'dialAnimate', 'dialRideCube', 'wireDial', 'dialHost', 'dialCubeRun'].every((k) => core.includes('function ' + k + '(')), 'המנוע ב־core.js — משותף לסטודיו');
ok(!/positionTabIndicator|tab-ind|tabSetBar/.test(app + css), 'בלי שאריות של הגלולה הישנה');

// Studio ו־Academy (29/10/2026, בקשת המשתמש): אותה חוגה אחד לאחד — רק צבע האפליקציה
const st = R('studio.js'), lib = R('library.js'), stc = R('studio.css'), libc = R('library.css');
ok(/const ST_SIB = \['settings', 'home', 'job', 'tower'\]/.test(st) && /const LIB_SIB = \['settings', 'snb', 'mine', 'notes'\]/.test(lib), 'הסדר מימין לשמאל: Studio — הגדרות · העבודות · העבודה · המגדל; Academy — הגדרות · THE SNOWBALL · הספרייה שלי · מה למדתי');
ok(/!FINAL\.includes\(r\.srv\.state\)/.test(st) && /r\.srv\.state === 'done'/.test(st), 'Studio: "העבודה" = הפעילה, ואם אין — האחרונה שהסתיימה');
ok(/dialNavBuild\('st-dial'/.test(st) && /dialNavBuild\('lib-dial'/.test(lib) && /dialHost\(STUDIO_DIAL\)/.test(st) && /dialHost\(LIB_DIAL\)/.test(lib) && /wireDial\(dialNav\)/.test(st) && /wireDial\(libNav\)/.test(lib), 'שתיהן בונות את החוגה מאותו מנוע (core) ומארחות אותו');
ok(/dialHost\(dialPrev\)/.test(st) && /dialHost\(libDialPrev\)/.test(lib), 'בסגירה המארח חוזר (Invest מתחת לשכבה)');
ok(/\.st-dial \{ --primary: #FF4656;[^}]*z-index: 950/.test(stc) && /\.lib-dial \{ --primary: #4699FF;[^}]*z-index: 910/.test(libc), 'אדום ל־Studio, כחול ל־Academy; מעל השכבה (900), Academy מתחת לקורא (920)');
ok(/dial: \(\) => stKeyOf/.test(st) && /dial: \(\) => libKeyOf/.test(lib) && /if \(o\.dial\) dialCubeBegin\(s\.cube, pg\.from, pg\.to, s\.side\)/.test(app), 'החלקת עמוד (snbSwipe) מזיזה את החוגה צמוד לאצבע');
ok(/cubeNow !== _dial\.ride/.test(fn('cubeClone')), 'נסיעה של החוגה שמציירת שכן לא נעצרת בהעתק (cubeClone)');
ok(A.dialStep(412, 4) > A.dialStep(412) && A.dialStep(412, 4) * 2 + 40 < 412 / 2 + 86, 'ארבעה פריטים — מרווחים יותר (הכיתובים לא נוגעים)');
ok(/history\.go\(1 - d\)/.test(lib) && /ld: 1/.test(lib) && !/history\.go\(/.test(st), 'Academy: מעמוד משנה עמוק — חוזרים לרמת האח (העומק ld, כמו navBack ב־Invest); Studio — מחסנית CloseWatcher, בלי history.go');

ok(/\{ k: 'snb', ico: LIB_DIAL_ICO\.snb, bub: LIB_DIAL_ICO\.snb, lbl: 'THE SNOWBALL', cls: 'tab-snow' \}/.test(lib) && /class="tab-bub-ico"/.test(fn('dialNavBuild')) && /if \(!u\.firstElementChild\) u\.textContent = t;/.test(app) && /\.tab-snow \.tab-bub-ico \{ width: 58px; height: 58px; \}/.test(css), 'THE SNOWBALL — פתית שלג גדול בבועה (בקשת המשתמש), הכיתוב מתחת כשאינו נבחר');
// 29/10/2026 (בקשת המשתמש): בכל הפריטים בשלוש האפליקציות — בבועה רק הסמל בלבן, בלי טקסט
ok(/\(it\.bub \|\| it\.ico\)/.test(fn('dialNavBuild')) && /\.tab-bub-ico \{ width: 44px; height: 44px; stroke: #fff;/.test(css) && /\.tab-bub-fill path \{ fill: #fff;/.test(css), 'Studio/Academy: כל בועה = הסמל בלבן');
{ const bs = [...html.matchAll(/<button class="tab[^"]*" data-tab="\w+"[^\n]*/g)].map((m) => m[0]);
  ok(bs.length === 7 && bs.every((l) => /<span class="tab-bub" aria-hidden="true"><svg class="tab-bub-ico/.test(l) && !/tab-bub" data-i18n/.test(l)), 'Invest: כל בועה = הסמל בלבן (בלי data-i18n שידרוס אותו)'); }

// עיצוב
ok(/\.tab-disc \{[^}]*transform: scale\(\.66\)/.test(css) && /@keyframes dialWave/.test(css) && /prefers-reduced-motion: reduce\) \{ \.tab\.zap/.test(css), 'עיגול 78 מוקטן (‎.66); גל בנחיתה; בלי אנימציה כשמבקשים להפחית תנועה');
ok(/body\.has-dock \.toast \{/.test(css), 'ההודעה הקופצת מעל החוגה');
console.log(n + ' בדיקות עברו');
