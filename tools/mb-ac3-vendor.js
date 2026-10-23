// 22/10/2026: מכין את @mediabunny/ac3 (פענוח Dolby AC-3/E-AC-3 בדפדפן) ל־vendor/mediabunny בלי לשנות את הקוד שלו:
// (1) הייבוא "mediabunny" → הקובץ שלנו (אותו מופע של המודול — אחרת registerDecoder נרשם במופע אחר);
// (2) ה־Worker נוצר במקור מקוד ב־blob — ה־CSP שלנו (worker-src 'self') חוסם את זה. הקוד שלו יוצא לקובץ קבוע
//     (ac3-worker.js, נטען מאותו מקור), וה־WebAssembly מתקמפל בתוך ה־Worker (לקובץ ה־Worker אין CSP של הדף).
// הרצה: node tools/mb-ac3-vendor.js <נתיב ל־dist/bundles/mediabunny-ac3.min.mjs מהחבילה ב־npm>
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const src = fs.readFileSync(process.argv[2], 'utf8');
const head = 'function s(){return c(`';
const i = src.indexOf(head);
if (i < 0 || src.indexOf(head, i + 1) >= 0) throw new Error('worker: לא נמצא בדיוק פעם אחת');
let j = i + head.length, depth = 0;
for (; j < src.length; j++) {            // סוף ה־template literal: ` שלא אחרי \
  if (src[j] === '\\') { j++; continue; }
  if (src[j] === '$' && src[j + 1] === '{') throw new Error('worker: ${} לא מוברח — לא בטוח לחלץ');
  if (src[j] === '`') break;
}
if (!src.startsWith('`)}', j)) throw new Error('worker: סוף לא צפוי');
const lit = src.slice(i + head.length - 1, j + 1);              // כולל שני ה־`
const code = vm.runInNewContext(lit, Object.create(null));     // רק פירוק הבריחות של המחרוזת (בלי ${} — נבדק למעלה)
let out = src.slice(0, i) + "function s(){return Promise.resolve(new Worker(new URL('./ac3-worker.js',import.meta.url)))}" + src.slice(j + 3);
const n = (out.match(/from"mediabunny"/g) || []).length;
if (!n) throw new Error('ייבוא mediabunny לא נמצא');
out = out.replace(/from"mediabunny"/g, 'from"./mediabunny.min.mjs"');
const dir = path.join(__dirname, '..', 'vendor', 'mediabunny');
fs.writeFileSync(path.join(dir, 'mediabunny-ac3.min.mjs'), out);
fs.writeFileSync(path.join(dir, 'ac3-worker.js'), code);
console.log('ac3:', out.length, 'בתים · worker:', code.length, 'בתים · ייבואים שהוחלפו:', n);
