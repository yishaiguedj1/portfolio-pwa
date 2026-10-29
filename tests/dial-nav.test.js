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
vm.runInContext([line(/const TAB_ORDER = [^\n]*/), line(/const DIAL_TABS = [^\n]*/), line(/const DIAL_SET = [^\n]*/), fn('dialIndex'), fn('dialStep'), fn('dialRest'), fn('dialFrame'), fn('dialCubeState'), fn('dialRubber')].join('\n')
  + '\nthis.api = { DIAL_TABS, DIAL_SET, dialIndex, dialStep, dialRest, dialFrame, dialCubeState, dialRubber };', ctx);
const A = ctx.api;
const num = (s, i) => +String(s).replace('translate3d', '').match(/-?[\d.]+/g)[i];

// מספור
ok(A.DIAL_TABS.join() === 'settings,wishlist,stocks,overview,trades,deposits,pension', 'הסדר מימין לשמאל: הגדרות, מעקב, מניות, סקירה (באמצע), עסקאות, הפקדות, פנסיה');
ok(A.dialIndex('settings') === 0 && A.dialIndex('overview') === 3 && A.dialIndex('advanced') === 0 && A.dialIndex('backup') === 0, 'עמודי המשנה של ההגדרות = "הגדרות"');
ok([...html.matchAll(/<button class="tab[^"]*" data-tab="(\w+)"/g)].map((m) => m[1]).join() === A.DIAL_TABS.join(), 'סדר הכפתורים ב־index.html = DIAL_TABS');

// מנוחה: הפעיל במרכז, גבוה ומוגדל; השכנים על הקשת
const f = A.dialFrame(A.dialRest(3), 7, 412, true);
ok(num(f[3].it, 0) === 0 && num(f[3].it, 1) < 0 && f[3].glow === 1 && f[3].bub === 1 && f[3].ico === 0 && f[3].lbl === 0, 'הפעיל במרכז: בועה עם כיתוב, בלי סמל ובלי כיתוב מתחת');
ok(/scale\(1\)/.test(f[3].disc) && /scale\(0\.68\)/.test(f[2].disc), 'הבועה בגודל מלא (חדה), השאר מוקטנים');
ok(num(f[2].it, 0) > 0 && num(f[4].it, 0) < 0, 'RTL: מניות מימין לסקירה, עסקאות משמאל');
ok(num(f[5].it, 1) > num(f[4].it, 1) && num(f[4].it, 1) > 0, 'קשת: ככל שרחוק מהמרכז — נמוך יותר');
ok(f.every((v) => v.o === 1), 'כל השבעה גלויים כשהסקירה במרכז — ההגדרות והפנסיה בקצוות (29/10/2026, כמו בסרטון)');
ok(Math.abs(num(f[0].it, 0)) + 40 > 206 && Math.abs(num(f[0].it, 0)) < 206, 'הקצוות חצי־גלויים: מרכז הפריט בתוך המסך, חלקו מעבר לקצה (412px)');
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
ok(/r\.c = tabCubeDrag\(name, to, cubeSideFwd\(dir > 0\)\)/.test(fn('dialRideCube')) && /if \(p < 1\) return cubeSet\(r\.c, p\);/.test(fn('dialRideCube')) && /dialRideLand\(r\);/.test(fn('dialRideCube')), 'הקובייה צמודה למיקום החוגה; בזווית מלאה — השכן נעשה הנוכחי');
ok(/switchTab\(c\.to, \{ cubeDone: true, keepScroll: true \}\)/.test(fn('dialRideLand')) && /cubeNow = r;/.test(fn('dialRideRun')) && /CUBE_HZ/.test(fn('dialRideRun')), 'נחיתה כמו סוף קובייה; השחרור באותו קפיץ, ונגיעה חדשה מסיימת אותו');
ok(!/positionTabIndicator|tab-ind|tabSetBar/.test(app + css), 'בלי שאריות של הגלולה הישנה');

// עיצוב
ok(/\.tab-disc \{[^}]*transform: scale\(\.68\)/.test(css) && /@keyframes dialWave/.test(css) && /prefers-reduced-motion: reduce\) \{ \.tab\.zap/.test(css), 'עיגול 68 מוקטן; גל בנחיתה; בלי אנימציה כשמבקשים להפחית תנועה');
ok(/body\.has-dock \.toast \{/.test(css), 'ההודעה הקופצת מעל החוגה');
console.log(n + ' בדיקות עברו');
