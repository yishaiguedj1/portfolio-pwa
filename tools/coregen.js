#!/usr/bin/env node
/* שלב 3 בתוכנית שלוש האפליקציות (13/10/2026): הקוד המשותף לדפים העצמאיים של Academy ו־Studio.
   מקור האמת נשאר app.js — האזורים המסומנים <core> … </core> (בהערה בשורה משלה) (תרגום, חלונות אישור, הודעה, "חזור",
   כפתורי לחיצה ארוכה, כתובת השרתון). הכלי מעתיק אותם ל־core.js, וכותב לכל אפליקציה קובץ מחרוזות עם המפתחות
   שהמודולים שלה באמת משתמשים בהם (strings-academy.js, strings-studio.js) — בלי 80KB של מחרוזות התיק.
   למה לא להוציא את הקוד מ־app.js: 164 בדיקות טוענות את app.js לבד; כך לא משתנה כלום באפליקציה הקיימת.

   שימוש:  node tools/coregen.js          — כותב את הקבצים
           node tools/coregen.js --check  — יוצא 1 אם משהו לא מעודכן (tests/core.test.js) */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const OPEN = '/* <core> */', CLOSE = '/* </core> */';
/* המודולים של כל אפליקציה (כל מה ש־library.js / studio.js מייבאים). מודול חדש = להוסיף כאן. */
const APPS = {
  academy: ['library.js', 'libadmin.js', 'libbackup.js', 'pagecurl.js', 'pagetex.js', 'ribbon3d.js', 'epubkit.js', 'academy-data.js'],
  studio: ['studio.js', 'studionet.js', 'studioplay.js', 'studiosubs.js', 'studioedl.js', 'studioai.js', 'studiostore.js', 'libbackup.js'],
};
const HEAD = '/* נוצר אוטומטית מ־app.js ב־tools/coregen.js — לא לערוך ביד (שינוי = ב־app.js, ואז node tools/coregen.js). */\n';

function regions(src) {
  const out = [];
  let i = 0;
  for (;;) {
    const a = src.indexOf(OPEN + '\n', i);
    if (a < 0) break;
    const b = src.indexOf(CLOSE + '\n', a);
    if (b < 0) throw new Error('אזור core בלי סגירה');
    out.push(src.slice(a + OPEN.length + 1, b));
    i = b + CLOSE.length;
  }
  if (!out.length) throw new Error('אין אזורי core ב־app.js');
  return out;
}

/* STRINGS מ־app.js: מראש הקובץ עד סוף הטבלה (הטבלה משתמשת באייקונים שלפניה) */
function strings(src) {
  const end = src.indexOf('\n};\n', src.indexOf('const STRINGS = {'));
  return vm.runInNewContext(src.slice(0, end + 3) + '\n;STRINGS');
}

/* כל מחרוזת במרכאות בקוד שהיא מפתח בטבלה. בלי בניית מפתח בשרשור ('studioMs' + x) — הבדיקה אוכפת */
function keysIn(code, all) {
  const out = new Set();
  for (const m of code.matchAll(/['"`]([A-Za-z_]\w*)['"`]/g)) if (all.has(m[1])) out.add(m[1]);
  return out;
}
function concatPrefixes(code, all) {
  const bad = [];
  for (const m of code.matchAll(/\b[Tt]\(\s*['"]([A-Za-z_]\w*)['"]\s*\+/g)) {
    const p = m[1];
    if (!all.has(p) && [...all].some((k) => k.startsWith(p))) bad.push(p);
  }
  for (const m of code.matchAll(/\b[Tt]\(\s*`([A-Za-z_]\w*)\$\{/g)) bad.push(m[1]);   // T(`studio${x}`)
  return bad;
}

function build() {
  const src = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  const code = regions(src);
  const core = HEAD +
    '/* הקוד המשותף ל־Academy ול־Studio (דפים עצמאיים, בלי app.js). לפני הקובץ — strings-<אפליקציה>.js (STRINGS). */\n' +
    '/* כותרת X-App-Key רדומה (v150) — בלי הגדרות IBKR בדפים האלה */\nfunction ibkrCfg() { return {}; }\n\n' +
    code.join('\n');
  const S = strings(src);
  const all = new Set(Object.keys(S.he));
  const coreKeys = keysIn(code.join('\n'), all);
  const files = { 'core.js': core };
  const problems = [];
  for (const [app, mods] of Object.entries(APPS)) {
    const keys = new Set(coreKeys);
    for (const f of mods) {
      const c = fs.readFileSync(path.join(ROOT, f), 'utf8');
      for (const k of keysIn(c, all)) keys.add(k);
      for (const p of concatPrefixes(c, all)) problems.push(f + ": מפתח נבנה בשרשור ('" + p + "' + …) — לא נמצא סטטית");
    }
    const sorted = [...keys].sort();
    const pick = (lang) => '{\n' + sorted.filter((k) => S[lang][k] != null).map((k) => '  ' + JSON.stringify(k) + ': ' + JSON.stringify(S[lang][k])).join(',\n') + '\n}';
    files['strings-' + app + '.js'] = HEAD + '/* המחרוזות של ' + app + ' (' + sorted.length + ' מפתחות מתוך ' + all.size + ') */\n' +
      'const STRINGS = {\nhe: ' + pick('he') + ',\nen: ' + pick('en') + '\n};\n';
  }
  return { files, problems };
}

if (require.main === module) {
  const check = process.argv.includes('--check');
  const { files, problems } = build();
  if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
  let stale = 0;
  for (const [f, txt] of Object.entries(files)) {
    const p = path.join(ROOT, f);
    const cur = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
    if (cur === txt) continue;
    if (check) { console.error(f + ' לא מעודכן — node tools/coregen.js'); stale++; continue; }
    fs.writeFileSync(p, txt);
    console.log(f + ' נכתב (' + txt.length + ' תווים)');
  }
  if (check && stale) process.exit(1);
  if (check) console.log('core.js ומחרוזות האפליקציות מעודכנים');
}
module.exports = { build, regions, APPS };
