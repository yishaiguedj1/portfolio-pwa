// v343 (בקשת המשתמש 05/10/2026): צייר העמוד — גב הדף בתלת־ממד מהפריסה האמיתית, אחד לאחד
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'pagetex.js'), 'utf8');
const lib = fs.readFileSync(path.join(root, 'library.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const { swVersionOk } = require('./_swver.js');
const M = {}, names = [...src.matchAll(/^export function (\w+)/gm)].map((m) => m[1]);
new Function('M', src.replace(/^export /gm, '') + '\n' + names.map((k) => 'M.' + k + ' = ' + k + ';').join('\n'))(M);
ok(!/^import /m.test(src), 'בלי ייבוא (נבדק ב־node)');
ok(M.runDir('שלום', 'ltr') === 'rtl' && M.runDir("Lowe's", 'rtl') === 'ltr' && M.runDir('2023', 'rtl') === 'rtl' && M.runDir('2023', 'ltr') === 'ltr', 'כיוון כל מילה: עברית RTL, אנגלית LTR, מספרים לפי האלמנט');
ok(M.fontString({ fontStyle: 'italic', fontWeight: '540', fontSize: '19px', fontFamily: '"SNB Noto", sans-serif' }) === 'italic 540 19px "SNB Noto", sans-serif', 'הגופן המחושב — כולל עובי משתנה');
ok(JSON.stringify(M.words('  שלום  עולם ')) === '[[2,6,"שלום"],[8,12,"עולם"]]', 'מילים עם המיקום שלהן');
ok(/getClientRects\(\)/.test(src) && /fontBoundingBoxAscent/.test(src), 'מיקום מדויק מהפריסה האמיתית + קו בסיס מהמדדים של הגופן');
ok(/Intl\.Segmenter/.test(src), 'מילה שנשברה — לפי גרפמות (ניקוד נשמר)');
ok(/globalCompositeOperation = 'multiply'/.test(src), 'הדגשות הקורא — באותו צבע (כמו בקינדל)');
ok(/import\('\.\/pagetex\.js'\)/.test(lib) && /new FontFace\('SNB Noto'/.test(lib), 'נטען בעצלתיים + הגופן שלנו במסמך הראשי');
const v = (app.match(/APP_VERSION = '(v\d+)'/) || [])[1];
ok(!!v && swVersionOk(v), 'גרסה');
console.log(`\n${n} בדיקות עברו`);
