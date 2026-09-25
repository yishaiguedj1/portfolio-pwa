// privacy-guard.test.js — שומר פרטיות: הריפו ציבורי (CLAUDE.md סעיף 3).
// נכשל אם קובץ כלשהו בריפו מכיל מספר חשבון IBKR, טוקן Flex, מפתח Google מחוץ
// לקובץ ההגדרות של Firebase, או כתובת מייל פרטית. הבדיקה לא מכילה את הערכים עצמם —
// רק תבניות — כדי שהיא לא תחשוף בעצמה את מה שהיא שומרת.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
let n = 0;
const fails = [];
function ok(cond, name) { n++; if (!cond) fails.push(name); else console.log('ok - ' + name); }

let files;
try {
  files = execSync('git ls-files', { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
} catch (e) {
  // בלי git (למשל ארכיון) — סורקים את תיקיית הפרויקט
  files = [];
  const walk = (d) => { for (const f of fs.readdirSync(path.join(root, d))) {
    if (f === '.git' || f === 'node_modules') continue;
    const rel = d ? d + '/' + f : f; const st = fs.statSync(path.join(root, rel));
    if (st.isDirectory()) walk(rel); else files.push(rel); } };
  walk('');
}
const textExt = /\.(js|md|html|css|json|yml|yaml|webmanifest|txt)$/i;
files = files.filter((f) => textExt.test(f) && fs.existsSync(path.join(root, f)));
ok(files.length > 20, 'נסרקו ' + files.length + ' קבצים');

const DUMMY_TOKEN = '1234567890'.repeat(3).slice(0, 24); // הטוקן המדומה של בדיקות השרתון
const rules = [
  { name: 'מספר חשבון IBKR', re: /\b[UI]\d{7,8}\b/g },
  { name: 'טוקן Flex (20+ ספרות)', re: /(?<![\d.])\d{20,}(?![\d.])/g, allow: (m) => m === DUMMY_TOKEN },
  { name: 'מפתח Google API', re: /AIza[0-9A-Za-z_-]{30,}/g, allowFile: (f) => f === 'firebase-config.js' },
  { name: 'כתובת מייל פרטית', re: /[A-Za-z0-9._%+-]+@(gmail|yahoo|hotmail|outlook|icloud|walla)\.[a-z.]+/gi },
  { name: 'Query ID בטקסט', re: /Query ?ID[^\n]{0,12}?\b\d{6,}\b/gi, allow: (m) => /999999/.test(m) },
];
for (const r of rules) {
  const hits = [];
  for (const f of files) {
    if (f === 'tests/privacy-guard.test.js') continue;
    if (r.allowFile && r.allowFile(f)) continue;
    const src = fs.readFileSync(path.join(root, f), 'utf8');
    for (const m of src.matchAll(r.re)) {
      if (r.allow && r.allow(m[0])) continue;
      const line = src.slice(0, m.index).split('\n').length;
      hits.push(f + ':' + line); // לא מדפיסים את הערך עצמו
    }
  }
  ok(hits.length === 0, r.name + (hits.length ? ' — נמצא ב: ' + hits.slice(0, 5).join(', ') : ': לא נמצא'));
}

if (fails.length) {
  for (const f of fails) console.error('FAIL - ' + f);
  console.error('\nמידע פרטי בריפו הציבורי. להסיר לפני push (CLAUDE.md סעיף 3).');
  process.exit(1);
}
console.log('\n' + n + ' בדיקות עברו');
