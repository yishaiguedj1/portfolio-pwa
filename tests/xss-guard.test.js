// xss-guard.test.js — שומר הזרקות: כל טקסט שמגיע מבחוץ (שמות מניות מ־Yahoo, תיאורי
// הפקדות מ־IBKR, הערות שהמשתמש מקליד, הודעות שגיאה) חייב לעבור esc() לפני innerHTML.
// נכשל אם שורה שכותבת HTML משרשרת שדה "חיצוני" בלי esc( באותה שורה.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
let n = 0;
function ok(cond, name) { n++; if (!cond) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }

// שדה חיצוני שמשורשר ישירות: "+ x.name" / "+ dbg" / "x.note +"
const RISKY = /\+\s*[\w$.\[\]]*\.(name|place|note|desc|description|symbol|message|full|period|type)\b|\+\s*(dbg|errMsg|message)\b|[\w$\]]\.(name|place|note|desc|description|symbol|message|full|period|type)\s*\+/;
for (const file of ['app.js', 'cloud.js']) {
  const lines = fs.readFileSync(path.join(root, file), 'utf8').split('\n');
  const bad = [];
  lines.forEach((ln, i) => {
    if (!/innerHTML\s*[+]?=|insertAdjacentHTML/.test(ln)) return;
    if (/^\s*(\/\/|\*)/.test(ln)) return;
    // שרשור של שדה חיצוני, שלא בתוך esc(...)
    const stripped = ln.replace(/esc\([^()]*(\([^()]*\)[^()]*)*\)/g, 'ESC');
    if (RISKY.test(stripped)) bad.push(file + ':' + (i + 1));
  });
  ok(bad.length === 0, file + ': כל שדה חיצוני ב־innerHTML עובר esc()' + (bad.length ? ' — ' + bad.join(', ') : ''));
}
const src = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
ok(/function esc\(v\)[\s\S]{0,200}&amp;[\s\S]{0,80}&lt;[\s\S]{0,80}&gt;[\s\S]{0,80}&quot;[\s\S]{0,40}&#39;/.test(src), 'esc() מקודד & < > " \'');
ok(/esc\(dbg\)/.test(src), 'טקסט דיבאג בהודעת "אין גרף" עובר esc()');
ok(!fs.existsSync(path.join(root, 'source-test.html')), 'דף הבדיקה הישן source-test.html הוסר');
console.log('\n' + n + ' בדיקות עברו');
