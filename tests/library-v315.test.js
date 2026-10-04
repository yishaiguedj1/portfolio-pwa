// v315: השלמת כריכות לספרים שכבר בטלפון, חזרה לספרייה אחרי רענון, משוב בכפתור "רענון הקטלוג", הודעות מעל הספרייה
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const lib = fs.readFileSync(path.join(root, 'library.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'library.css'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const sty = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

ok(/function backfillCovers\(\)/.test(lib) && /if \(b\.coverV( \|\| b\.coverCustom)?\) continue;/.test(lib), 'השלמת כריכה רק לספרים שלא נבדקו (coverV) — ולא דורסת כריכה שהמשתמש בחר (v316)');
ok(/const cur = \(await allBooksRaw\(\)\)\.find\(\(x\) => x\.id === b\.id\);   \/\/ רשומה עדכנית/.test(lib), 'ההשלמה כותבת על הרשומה העדכנית (לא דורסת התקדמות)');
ok(/rec\.coverV = 1;/.test(lib), 'ייבוא חדש מסומן כנבדק');
ok(/await first;\s+backfillCovers\(\);/.test(lib), 'ההשלמה רצה בכניסה לספרייה, אחרי הסנכרון');
ok(/hs && hs\.lib\) \{[\s\S]{0,400}import\('\.\/library\.js'\)\.then\(\(m\) => m\.openLibrary\(\{ restore: hs \}\)\)/.test(app), 'אחרי רענון כשהספרייה הייתה פתוחה — האפליקציה פותחת אותה שוב');
ok(/if \(!restore\) afterBack\(\(\) => history\.pushState/.test(lib), 'בשחזור לא נוספת רשומת היסטוריה (כבר קיימת)');
ok(/\{ lib: 2, book: id \}/.test(lib) && /openReader\(restore\.book, \{ restored: true \}\)/.test(lib), 'בתוך ספר — חוזרים לאותו ספר');
ok(/ui\.view = restore \? \(restore\.lv \|\| null\) : null;/.test(lib), 'בדף בתוך הספרייה — חוזרים לאותו דף');
ok(/sessionStorage\.setItem\(SCROLL_KEY/.test(lib) && /function restoreLibScroll/.test(lib), 'מקום הגלילה נשמר ומשוחזר');
ok(/admRefreshing: 'מרענן…'/.test(app) && /admRefreshing: 'Refreshing…'/.test(app), 'מחרוזת "מרענן" בעברית ובאנגלית');
ok(/if \(syncing\) await syncing;/.test(lib) && /res\.textContent = msg;/.test(lib), 'הרענון מחכה לסנכרון שרץ ומציג תוצאה בדף');
const zLib = +(css.match(/\.lib-root \{[^}]*z-index: (\d+)/) || [])[1];
const zToast = +(css.match(/#toast\.toast \{ z-index: (\d+)/) || [])[1];
ok(zToast > zLib && /\.toast \{[\s\S]*?z-index: 99;/.test(sty), 'ההודעות מעל שכבת הספרייה (היו מתחתיה)');
console.log('# ' + n + ' בדיקות עברו');
