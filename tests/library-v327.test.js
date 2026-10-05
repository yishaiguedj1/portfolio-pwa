// v327: מצב הגיבוי = בועה קטנה בשורת הכותרת (ענן + ✓ / חץ / !) במקום כרטיס מעל החיפוש — בקשת המשתמש, בהשראת Google Photos
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const lib = fs.readFileSync(path.join(root, 'library.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'library.css'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const i = lib.indexOf('export function bkPillState('); let d = 0, j = lib.indexOf('{', i); for (; j < lib.length; j++) { if (lib[j] === '{') d++; else if (lib[j] === '}' && --d === 0) break; }
const bkPillState = new Function(lib.slice(i + 7, j + 1) + '\nreturn bkPillState;')();
ok(bkPillState(false, { email: 'x' }, false) === 'off', 'לא מחובר → לא מגובה');
ok(bkPillState(true, {}, false) === 'off', 'בלי חיבור ל־Drive → לא מגובה');
ok(bkPillState(true, { email: 'x', lastAt: 1 }, true) === 'busy', 'גיבוי רץ → מגבה (גובר על שגיאה ישנה)');
ok(bkPillState(true, { email: 'x', lastAt: 1, err: 'e' }, false) === 'err', 'שגיאה → הגיבוי נכשל');
ok(bkPillState(true, { email: 'x', lastAt: 1 }, false) === 'ok', 'מגובה');
ok(bkPillState(true, { email: 'x' }, false) === 'off', 'מחובר אבל עוד לא גובה אף פעם → לא מגובה');
ok(!/function backupRow\(/.test(lib) && !/'lib-bkrow'/.test(lib) && !/\.lib-bkrow \{/.test(css), 'הכרטיס הישן הוסר');
ok(/const hrow = h\('div', 'lib-hrow'\);\s*hrow\.append\(h\('h1', 'lib-large', T\('libTitle'\)\)\);/.test(lib), 'הבועה בשורת הכותרת "ספרייה"');
ok(/pill\.addEventListener\('click', \(\) => goView\(\{ backup: 1 \}\)\)/.test(lib), 'נגיעה = מסך הגיבוי');
ok(/pill\.setAttribute\('aria-label', full\)/.test(lib), 'קורא מסך מקבל את הפרטים המלאים (מתי, כמה ספרים, גודל)');
ok(/ICON\.cloudOk : st === 'busy' \? ICON\.cloudUp : st === 'err' \? ICON\.cloudErr : ICON\.cloudOff/.test(lib) && /cloudErr: '<svg/.test(lib) && /cloudOff: '<svg/.test(lib), 'אייקון לכל מצב');
ok(/if \(st === 'ok' && pillPrev === 'busy'\) pill\.classList\.add\('done'\)/.test(lib) && /@keyframes bkCheck/.test(css), 'סוף הגיבוי — ה־✓ "נכתב"');
ok(/\.lib-bkpill\.busy [^{]*\{ animation: bkUp/.test(css), 'בזמן גיבוי — החץ עולה בלולאה');
ok(/\.lib-bkpill \{[^}]*background: var\(--primary-container\)[^}]*color: var\(--on-primary-container\)/.test(css) && /\.lib-bkpic \{[^}]*color: var\(--primary\)/.test(css), 'הירוק של הכפתורים');
ok(/border-radius: var\(--pill\)/.test(css.slice(css.indexOf('.lib-bkpill {'))), 'גלולה (משתנה רדיוס סטנדרטי)');
ok(/prefers-reduced-motion: reduce\) \{ \.lib-bkpill/.test(css), 'reduced-motion');
['bkPillOk', 'bkPillBusy', 'bkPillErr', 'bkPillOff'].forEach((k) => ok((app.match(new RegExp('\\b' + k + ": '", 'g')) || []).length === 2, 'מחרוזת בעברית ובאנגלית: ' + k));
console.log('# ' + n + ' בדיקות עברו');
