// claude-md.test.js — שומר החיסכון בטוקנים (27/10/2026, בקשת המשתמש).
// CLAUDE.md נטען לכל סשן ולכל סוכן־משנה ונקרא מחדש בכל צעד. ב־27/10 הוא הגיע ל־500KB (~250 אלף טוקנים בכל בקשה)
// וחצי יום עבודה אכל 13% מהמכסה השבועית. מאז: ליבה קצרה, והידע המפורט ב־docs/ — נקרא רק לפי הצורך.
// נכשל? להעביר את הלקח לקובץ הנושא ב־docs/, לא להגדיל את התקרה.
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const root = path.join(__dirname, '..');
let n = 0, bad = 0;
const ok = (c, m) => { n++; if (!c) { bad++; console.error('FAIL ' + m); } };

const md = fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8');
const MAX = 40 * 1024;
ok(Buffer.byteLength(md) <= MAX, `CLAUDE.md עד ${MAX} בתים (עכשיו ${Buffer.byteLength(md)}) — לקח מפורט → docs/`);
ok(md.indexOf('כלל ברזל מס׳ 0') > -1 && md.indexOf('כלל ברזל מס׳ 0') < 400, 'כלל העברית בראש הקובץ');
ok(/## 0\. ⛔ חיסכון בטוקנים/.test(md), 'סעיף החיסכון בטוקנים קיים');

// כל קובץ שהמפתח מפנה אליו קיים, וכל קובץ ב־docs/ מופיע במפתח (בלי ידע "יתום" שאף אחד לא ימצא)
const refs = new Set((md.match(/docs\/[a-z0-9-]+\.md/g) || []));
const docs = fs.readdirSync(path.join(root, 'docs')).filter((f) => f.endsWith('.md')).map((f) => 'docs/' + f);
for (const r of refs) ok(fs.existsSync(path.join(root, r)), 'קיים: ' + r);
for (const d of docs) ok(refs.has(d), 'במפתח של CLAUDE.md: ' + d);

// הכלים שהכללים מפנים אליהם
for (const t of ['tools/t.sh', 'tools/wait-ci.sh']) {
  ok(fs.existsSync(path.join(root, t)), 'קיים: ' + t);
  try { cp.execFileSync('bash', ['-n', path.join(root, t)]); ok(true, ''); } catch (e) { ok(false, 'תחביר bash: ' + t); }
}
// t.sh לוקח את רשימת ה־SKIP מ־test.yml — שהיא עדיין שם
ok(/SKIP="[^"]+"/.test(fs.readFileSync(path.join(root, '.github/workflows/test.yml'), 'utf8')), 'test.yml: רשימת SKIP במקום שבו t.sh קורא אותה');

// הכלל הישן שהעיר סשנים לא חוזר לליבה
ok(!/לכל סשן פעיל אחר שולחים `send_message`/.test(md), 'בלי חובת send_message לכל סשן');

console.log(`claude-md: ${n - bad}/${n}`);
process.exit(bad ? 1 : 0);
