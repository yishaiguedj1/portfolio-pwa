// v328: לחיצה ארוכה על טקסט השורה במחברת = תפריט העריכה שלנו (לא סימון הטקסט של המערכת); סימנייה נראית כסימנייה
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const lib = fs.readFileSync(path.join(root, 'library.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'library.css'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
ok(/\.ann-row, \.ann-row \* \{ -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; \}/.test(css), 'שורה: בלי סימון טקסט ובלי תפריט המערכת (Copy / Google Translate)');
ok(/r\.addEventListener\('contextmenu', \(e\) => e\.preventDefault\(\)\);/.test(lib), 'שורה: תפריט ההקשר של הדפדפן חסום');
ok(/const openedAt = Date\.now\(\);[\s\S]{0,300}if \(e\.target === veil && Date\.now\(\) - openedAt > 450\) close\(\);/.test(lib), 'גיליון: ה־click שאחרי לחיצה ארוכה לא סוגר אותו מיד');
ok(/swallow = true; setTimeout\(\(\) => \{ swallow = false; \}, 600\);/.test(lib), 'לחיצה ארוכה: הנגיעה הבאה לא נבלעת');
ok(/r\.classList\.add\('bm'\);\s*r\.append\(h\('span', 'ann-ribbon'\)\);/.test(lib), 'סימנייה: סרט בראש הכרטיס');
ok(/if \(a\.b\) \{ const tag = h\('span', 'ann-bmtag'\);[\s\S]{0,120}ICON\.bookmark[\s\S]{0,80}T\('annBmLabel'\)/.test(lib), 'סימנייה: תווית עם אייקון');
ok(/\.ann-row\.bm \{ border-inline-start: 0 !important;/.test(css), 'סימנייה: בלי פס צבע (התבלבל עם הדגשה ורודה)');
ok(/\.ann-ribbon \{[^}]*clip-path: polygon/.test(css) && /\.ann-row\.bm \.ann-x \{ color: var\(--on-surface-var\)/.test(css), 'סימנייה: סרט + קטע העמוד בטון משני');
ok((app.match(/\bannBmLabel: '/g) || []).length === 2, 'מחרוזת בעברית ובאנגלית');
console.log('# ' + n + ' בדיקות עברו');
