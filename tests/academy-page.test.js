// שלב 3ג בתוכנית שלוש האפליקציות (13/10/2026): academy.html — הספרייה כדף עצמאי.
// ה־CSP זהה לזה של index.html חוץ מה־hash של הסקריפט שבדף (אותם מקורות — מקור חדש = בשני הדפים), סדר הסקריפטים,
// בלי app.js / cloud.js, ההבדלים במצב עצמאי ב־library.js, והקבצים במטמון של ה־SW.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const page = read('academy.html');
const idx = read('index.html');
const csp = (html) => (html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/) || [])[1] || '';

const inline = [...page.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
ok(inline.length === 1, 'סקריפט inline אחד בדיוק');
const h = "'sha256-" + crypto.createHash('sha256').update(inline[0]).digest('base64') + "'";
ok(csp(page).includes(h), 'ה־hash של הסקריפט ב־CSP (שינוי בסקריפט = לעדכן)');
ok(csp(page).replace(/'sha256-[^']+'/g, 'H') === csp(idx).replace(/'sha256-[^']+'/g, 'H'), 'ה־CSP זהה ל־index.html (חוץ מה־hash) — מקור חדש נכנס לשניהם');
ok(/if\(self!==top\)/.test(inline[0]), 'הגנה מפני מסגרת זרה (clickjacking) כמו ב־index.html');
ok(!/on(load|error|click)=/.test(page), 'בלי מאזינים בתוך HTML');

const srcs = [...page.matchAll(/<script (?:type="module" )?src="([^"]+)"/g)].map((m) => m[1]);
ok(JSON.stringify(srcs) === JSON.stringify(['firebase-config.js', 'strings-academy.js', 'core.js', 'auth.js', 'academy.js']),
  'סדר הסקריפטים: הגדרות → מחרוזות → core → auth → האתחול (מודול, רץ אחרי ה־defer)');
ok(!/app\.js|cloud\.js|returns\.js/.test(page), 'בלי app.js / cloud.js / returns.js — Academy לא טוענת את התיק');

const boot = read('academy.js');
ok(/import \{ openLibrary \} from '\.\/library\.js'/.test(boot) && /standalone: \{ auth: A, home: '\.\/' \}/.test(boot), 'academy.js פותח את אותו library.js במצב עצמאי');
ok(/wireCoreBack\(\)/.test(boot) && boot.indexOf('wireCoreBack()') < boot.indexOf('openLibrary({'), '"חזור" של החלונות נרשם לפני הספרייה (הסדר של מאזיני popstate קובע)');
ok(/pwa_auth_rl/.test(boot) && /Date\.now\(\) - last > 8000/.test(boot), 'טעינה מחדש כשהחיבור משתנה — עם שומר מפני לולאה');

const lib = read('library.js');
ok(/if \(SA && !restore\) history\.replaceState\(/.test(lib), 'עצמאי: רשומת הבית מחליפה את רשומת הדף — "חזור" מהבית יוצא מהדף');
ok(/if \(lvl < 1 && root && !SA\)/.test(lib), 'עצמאי: אין "חזרה לסקירה" (אין תיק)');
ok(/if \(SA\) location\.href = SA\.home/.test(lib), 'עצמאי: "THE SNOWBALL" עובר ל־Invest');

const sw = read('sw.js');
const shell = (sw.match(/const LIB_SHELL = \[([\s\S]*?)\];/) || [])[1] || '';
for (const f of ['academy.html', 'academy.js', 'strings-academy.js', 'core.js', 'auth.js']) ok(shell.includes("'./" + f + "'"), 'LIB_SHELL כולל ' + f + ' (אופליין)');
ok(/caches\.match\(request, \{ ignoreSearch: true \}\)\.then\(\(pg\) => pg \|\| caches\.match\('\.\/index\.html'\)\)/.test(sw), 'אופליין: ניווט ל־academy.html מקבל את הדף עצמו, לא את התיק');
console.log('# ' + n + ' בדיקות עברו');
