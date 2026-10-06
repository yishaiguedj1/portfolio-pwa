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
console.log(n + ' בדיקות עברו');
