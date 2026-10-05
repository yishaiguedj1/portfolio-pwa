// v335 (דיווח המשתמש 05/10/2026): "Touch to Search" של Chrome בוחר את המילה בנגיעה קצרה → חלון הסימון קופץ
// וכרטיס התרגום נסגר. חוסמים את הסרגל (שינוי DOM + preventDefault בנגיעה), ובחירה זרה אחרי נגיעה קצרה מבוטלת.
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const lib = fs.readFileSync(path.join(root, 'library.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const { swVersionOk } = require('./_swver.js');
const pure = (name) => new Function(lib.match(new RegExp('export function ' + name + '[\\s\\S]*?\\n}\\n'))[0].replace('export ', '') + ';return ' + name + ';')();

const f = pure('foreignTapSel');
ok(f(10000, 9500, 0, false) === true, 'בחירה חצי שנייה אחרי נגיעה קצרה — של הדפדפן');
ok(f(10000, 9500, 9800, false) === false, 'אחרי לחיצה ארוכה שלנו — שלנו');
ok(f(10000, 9500, 0, true) === false, 'חלון סימון פתוח (גרירת ידיות) — לא נוגעים');
ok(f(10000, 5000, 0, false) === false, 'בחירה הרבה אחרי הנגיעה — לא זרה');
ok(/blockTouchSearch\(doc, e\)/.test(lib) && /e\.preventDefault\(\)/.test(lib.match(/function blockTouchSearch[\s\S]*?\n\}/)[0]) && /doc\.body\.append\(s\); s\.remove\(\)/.test(lib), 'בנגיעה: preventDefault + שינוי DOM סינכרוני (Chrome מדלג על הסרגל)');
ok(/foreignTapSel\(Date\.now\(\), rd\.tapAt, rd\.holdAt, selMode\)\) \{ try \{ sel\.removeAllRanges\(\)/.test(lib), 'showSel מבטל בחירה זרה בלי לסגור את כרטיס התרגום');
ok(/'touchend', \(\) => \{ if \(hold && rd\) rd\.tapAt = Date\.now\(\)/.test(lib), 'נגיעה קצרה נרשמת ב־touchend');
const gu = pure('googleUrl');
ok(gu('moat') === 'https://www.google.com/search?hl=he&q=moat' && gu('  economic   moat ') === 'https://www.google.com/search?hl=he&q=economic%20moat' && gu('') === '', 'לחצן Google: חיפוש על המילה (מקודד), ריק — בלי קישור');
ok(/acts\.append\(\.\.\.head\.childNodes, cp, gg\)/.test(lib) && /'noopener'/.test(lib) && /\.tr-acts \.tr-gg svg \{ width: 17px/.test(fs.readFileSync(path.join(root, 'library.css'), 'utf8')), 'לחצן Google קטן בראש הכרטיס, אחרון בשורה');
ok(/trGoogle: 'פתיחה ב־Google'/.test(app) && /trGoogle: 'Open in Google'/.test(app), 'תווית נגישות בעברית ובאנגלית');
const v = (app.match(/APP_VERSION = '(v\d+)'/) || [])[1];
ok(!!v && swVersionOk(v), 'גרסה ו־sw.js תואמים');
console.log(`\n${n} בדיקות עברו`);
