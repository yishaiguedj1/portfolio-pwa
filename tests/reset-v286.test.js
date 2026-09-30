// v286: כרטיס איפוס קומפקטי — שורה "אפשרויות איפוס" שפותחת גיליון בסגנון Apple עם שלוש האפשרויות
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const card = html.slice(html.indexOf('id="resetCard"'), html.indexOf('</section>', html.indexOf('id="resetCard"')));
ok(/id="resetOpen"[\s\S]*data-i18n="resetOptions"/.test(card), 'בכרטיס: שורה אחת "אפשרויות איפוס"');
ok(!/data-i18n="reset(Manual|Ibkr)?Desc"/.test(card), 'בלי טקסטי הסבר (בקשת המשתמש)');
ok(/id="resetSheetVeil"[\s\S]*id="resetManual"[\s\S]*id="resetIbkr"[\s\S]*id="resetData"[\s\S]*id="resetCancel"/.test(card), 'בגיליון: שלוש האפשרויות (אותם מזהים) + ביטול');
ok(/resetOptions: 'אפשרויות איפוס'/.test(app) && /resetOptions: 'Reset options'/.test(app), 'מחרוזת בעברית ובאנגלית');
ok(/if \(v\.parentNode !== document\.body\) document\.body\.appendChild\(v\)/.test(app), 'הגיליון עובר ל־body (position:fixed לא נשבר בתוך כרטיס)');
ok(/closest\('\.reset-opt'\)\) closeResetSheet\(\); \}, true\)/.test(app), 'בחירה סוגרת את הגיליון לפני האישור (capture)');
ok(/getElementById\('resetData'\)\.addEventListener\('click', \(\) => \{\s*if \(!confirm\(t\('resetConfirm'\)\)\) return;/.test(app), 'האישור לפני מחיקה נשמר');
ok(/\.reset-opt \{ color: var\(--loss\)/.test(css) && /\.reset-cancel \{[^}]*color: var\(--primary\)/.test(css), 'עיצוב: אפשרויות באדום, ביטול נפרד');
ok(/prefers-reduced-motion: reduce\) \{ \.reset-veil/.test(css), 'תנועה מופחתת');
ok(!/\.reset-row/.test(css), 'כללי השורות הישנים הוסרו');
console.log('# ' + n + ' בדיקות עברו');
