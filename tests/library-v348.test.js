// v348 (בקשת המשתמש 06/10/2026): במדף הספרים של THE SNOWBALL — האסופות האוטומטיות לפני "האסופות שלי"; ב"הספרייה שלי" — הסדר הקודם
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const lib = fs.readFileSync(path.join(__dirname, '..', 'library.js'), 'utf8');
const i = lib.indexOf('function shelvesView(');
const body = lib.slice(i, lib.indexOf('\n}\n', i));
ok(i > 0, 'shelvesView קיימת');
ok(/ui\.shelf === 'snb' \? \[\.\.\.auto, \.\.\.mine\] : \[\.\.\.mine, \.\.\.auto\]/.test(body), 'הסדר לפי הספרייה: snb — אוטומטי קודם, שלי — האסופות שלי קודם');
ok(!/box\.append\(h\('h4'/.test(body), 'כותרות המקטעים נבנות לפני הסידור (לא נוספות ישירות לפי סדר קבוע)');
// קטע LTR ארוך (span.en) עם nowrap גלש מעבר לעמודה — והופיע מעל הטקסט בעמודים הבאים (מכתב 1965)
ok(!/span\.en \{ white-space: nowrap/.test(lib) && !/white-space:\s*nowrap/.test(lib.slice(lib.indexOf('function bookCSS'), lib.indexOf('function bookCSS') + 6000)), 'בעיצוב הספר אין nowrap — שורה ארוכה נשברת');
ok(/p, li, blockquote, dd, td, th, h1, h2, h3, h4, h5, h6 \{ overflow-wrap: break-word; \}/.test(lib), 'מילה ארוכה מדי נשברת ולא גולשת לעמוד הבא');
console.log(n + ' בדיקות עברו');
