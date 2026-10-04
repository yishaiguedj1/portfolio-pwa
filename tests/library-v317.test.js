// v317: חלונות ושכבות של האפליקציה שהספרייה משתמשת בהם — תמיד מעל שכבת הספרייה (באג: חלון "שחזור הפרטים מהקובץ" נפתח מאחוריה)
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const lib = fs.readFileSync(path.join(root, 'library.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'library.css'), 'utf8');
const libZ = +(css.match(/\.lib-root \{[^}]*z-index: (\d+)/) || [])[1];
const z = (re) => +((css.match(re) || [])[1] || 0);
ok(libZ === 900, 'שכבת הספרייה: 900');
// כל רכיב של האפליקציה שהספרייה פותחת — חייב שכבה מעליה
const uses = { askConfirm: /askConfirm\(/.test(lib), showItemActions: /showItemActions\(/.test(lib), flash: /flash\(/.test(lib) };
ok(uses.askConfirm && uses.showItemActions && uses.flash, 'הספרייה משתמשת בחלון האישור, בכפתורי העריכה/מחיקה ובהודעות של האפליקציה');
ok(z(/html\.lib-open \.dlg-veil \{ z-index: (\d+)/) > libZ, 'חלון האישור (שחזור / הסתרה / הסרה) מעל הספרייה — לא מאחוריה בסקירה');
ok(z(/html\.lib-open \.item-acts\.floating \{ z-index: (\d+)/) > libZ, 'כפתורי העריכה/מחיקה מעל הספרייה');
ok(z(/#toast\.toast \{ z-index: (\d+)/) > libZ, 'ההודעות הקופצות מעל הספרייה');
ok(z(/html\.lib-open \.dlg-veil \{ z-index: (\d+)/) > z(/html\.lib-open \.item-acts\.floating \{ z-index: (\d+)/), 'חלון האישור מעל הכפתורים שפתחו אותו');
ok(/md5: cur\.md5 \|\| ''/.test(lib) && /flash\(T\('edRestored'\)\)/.test(lib), 'שחזור מהקובץ: בלי הורדה מחדש מיותרת (אותו md5) + הודעה שהשחזור בוצע');
console.log('# ' + n + ' בדיקות עברו');
