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
/* המודולים של כל אפליקציה (כל מה ש־library.js / studio.js מייבאים). מודול חדש = להוסיף כאן. */
const APPS = {
  academy: ['library.js', 'libadmin.js', 'libbackup.js', 'pagecurl.js', 'pagetex.js', 'ribbon3d.js', 'epubkit.js', 'academy-data.js', 'shell.js', 'academy-app.js', 'acclink.js'],
  studio: ['studio.js', 'studionet.js', 'studioplay.js', 'studiosubs.js', 'studioedl.js', 'studioai.js', 'studiostore.js', 'libbackup.js', 'shell.js', 'studio-app.js', 'acclink.js'],
  admin: ['shell.js', 'admin-app.js', 'acclink.js'],   // מרכז הניהול (שלב 5א)
};
const HEAD = '/* נוצר אוטומטית מ־app.js ב־tools/coregen.js — לא לערוך ביד (שינוי = ב־app.js, ואז node tools/coregen.js). */\n';

/* האזורים המסומנים בקובץ: tag = 'core' (app.js) או 'auth' (cloud.js, בתוך ה־IIFE — מוזחים, הסימון עם רווחים לפניו) */
function regions(src, tag) {
  const t = tag || 'core';
  const open = new RegExp('^[ ]*/\\* <' + t + '> \\*/\\n', 'gm');
  const close = new RegExp('^[ ]*/\\* </' + t + '> \\*/\\n', 'm');
  const out = [];
  let m;
  while ((m = open.exec(src))) {
    const rest = src.slice(m.index + m[0].length);
    const c = close.exec(rest);
    if (!c) throw new Error('אזור ' + t + ' בלי סגירה');
    out.push(rest.slice(0, c.index));
    open.lastIndex = m.index + m[0].length + c.index + c[0].length;
  }
  if (!out.length) throw new Error('אין אזורי ' + t);
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
  /* auth.js — התבנית (tools/auth.tpl.js) + האזורים <auth> של cloud.js (טעינת Firebase, החיבור המשותף, החלפת בעלים) */
  const tpl = fs.readFileSync(path.join(__dirname, 'auth.tpl.js'), 'utf8');
  if (tpl.split('// @@cloud@@').length !== 2) throw new Error('auth.tpl.js בלי // @@cloud@@');
  files['auth.js'] = HEAD.replace('מ־app.js', 'מ־cloud.js ו־tools/auth.tpl.js').replace('ב־app.js', 'ב־cloud.js / ב־tools/auth.tpl.js') +
    tpl.replace('// @@cloud@@', regions(fs.readFileSync(path.join(ROOT, 'cloud.js'), 'utf8'), 'auth').join('\n').replace(/\n$/, ''));
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
    // קריאה וכתיבה דרך אותו מזהה קובץ פתוח — בלי פער בין הבדיקה לכתיבה (CodeQL: file system race)
    let fd = null;
    try { fd = fs.openSync(p, check ? 'r' : 'r+'); } catch (e) { fd = null; }
    try {
      const cur = fd === null ? null : fs.readFileSync(fd, 'utf8');
      if (cur === txt) continue;
      if (check) { console.error(f + ' לא מעודכן — node tools/coregen.js'); stale++; continue; }
      if (fd === null) fs.writeFileSync(p, txt, { flag: 'wx' });   // קובץ חדש — רק אם עדיין לא קיים
      else { fs.ftruncateSync(fd, 0); fs.writeSync(fd, txt, 0, 'utf8'); }
      console.log(f + ' נכתב (' + Buffer.byteLength(txt) + ' בתים)');
    } finally { if (fd !== null) fs.closeSync(fd); }
  }
  if (check && stale) process.exit(1);
  if (check) console.log('core.js ומחרוזות האפליקציות מעודכנים');
}
module.exports = { build, regions, APPS };
