// 01/11/2026 (שדרוג הסטודיו, Z1): ייחוס לכל מודל CC-BY שהעובד מריץ — דף "מודלים ורישיונות" בהגדרות של Studio.
// מודל חדש ברישיון שמחייב ייחוס (CC-BY) בתמונת העובד → שורה ב־CREDITS שב־studio.js.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'studio.js'), 'utf8');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } };
const m = src.match(/const CREDITS = \[([\s\S]*?)\n\];/);
ok(m, 'CREDITS ב־studio.js');
const rows = m ? [...m[1].matchAll(/\['(\w+)', '([^']+)', '([^']+)', '([^']+)'\]/g)].map((x) => x.slice(1)) : [];
for (const need of ['Parakeet', 'DictaBERT', 'WeSpeaker']) {
  const r = rows.find((x) => x[1].includes(need));
  ok(r && /^CC-BY/.test(r[3]), 'ייחוס ל־' + need + ' (CC-BY)');
}
const he = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
for (const [role] of rows) ok(he.split(role + ':').length === 3, 'המחרוזת ' + role + ' בעברית ובאנגלית');
ok(/ui\.view === 'credits'\) pageCredits\(p\)/.test(src), 'הדף רשום בניווט');
ok(/x === 'credits'/.test(src), '"חזור" מהדף מוביל להגדרות');
console.log(fails ? `---- ${fails} נכשלו` : `---- studio-credits: ${rows.length} מודלים, הכל תקין`);
process.exit(fails ? 1 : 0);
