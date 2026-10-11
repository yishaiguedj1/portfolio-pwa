#!/usr/bin/env node
// שומר הפריסה (11/10/2026, אחרי התנגשות v387 בין שני סשנים): בודק PR מול ה־main שהוא נכנס אליו.
// רץ ב־CI רק ב־pull_request (test.yml, job ‏deploy-guard), על קומיט המיזוג: HEAD^1 = ה־main הנוכחי.
// הכללים = פרוטוקול הפריסה (CLAUDE.md סעיף 8):
//   1. sw.js לא באותו PR עם קבצי תוכן (קבצי המעטפת שב־sw.js + index.html).
//   2. PR שמשנה תוכן — APP_VERSION גבוה מזה שב־main (לא אותו מספר כמו PR שכבר מוזג).
//   3. PR שמשנה את sw.js — CACHE_NAME = ה־APP_VERSION שכבר ב־main (התוכן כבר חי), וגבוה מהקודם.
//   4. APP_VERSION לא יורד (מיזוג ישן שדורס גרסה חדשה).
'use strict';
const { execFileSync } = require('child_process');

function verOf(src, re) {
  const m = String(src || '').match(re);
  return m ? parseInt(m[1], 10) : 0;
}
const appVer = (s) => verOf(s, /const APP_VERSION = 'v(\d+)'/);
const swVer = (s) => verOf(s, /const CACHE_NAME = 'portfolio-pwa-v(\d+)'/);

// קבצי התוכן = כל מה שמופיע במעטפות של sw.js ('./x') + index.html
function shellFiles(sw) {
  const out = new Set(['index.html']);
  for (const m of String(sw || '').matchAll(/'\.\/([^'\s]+)'/g)) if (m[1]) out.add(m[1]);
  out.delete('sw.js');
  return out;
}

// טהורה: base/head = { app, sw } (תוכן הקבצים), changed = רשימת קבצים ששונו ב־PR
function checkPr({ base, head, changed }) {
  const errs = [];
  const shells = new Set([...shellFiles(base.sw), ...shellFiles(head.sw)]);
  const content = changed.filter((f) => shells.has(f));
  const swChanged = changed.includes('sw.js');
  const bA = appVer(base.app), hA = appVer(head.app), bC = swVer(base.sw), hC = swVer(head.sw);
  if (swChanged && content.length) {
    errs.push(`sw.js באותו PR עם קבצי תוכן (${content.slice(0, 5).join(', ')}) — שני PR: קודם התוכן, אחרי אימות חי sw.js`);
  }
  if (content.length && !(hA > bA)) {
    errs.push(`ה־PR משנה תוכן אבל APP_VERSION ‏v${hA} לא גבוה מ־main ‏(v${bA}) — מספר גרסה חדש (הגבוה מבין main וה־PR הפתוחים + 1)`);
  }
  if (hA && bA && hA < bA) errs.push(`APP_VERSION יורד מ־v${bA} ל־v${hA} — כנראה מיזוג ישן; למזג את main מחדש`);
  if (swChanged && !content.length) {
    if (hC !== bA) errs.push(`CACHE_NAME ‏v${hC} חייב להיות שווה ל־APP_VERSION שכבר ב־main ‏(v${bA}) — sw.js רק אחרי שהתוכן מוזג ואומת חי`);
    else if (!(hC > bC)) errs.push(`sw.js השתנה בלי להעלות את CACHE_NAME ‏(v${hC}) — שינוי ב־sw.js = גרסה חדשה`);
  }
  return { ok: errs.length === 0, errs, content, swChanged, versions: { bA, hA, bC, hC } };
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 << 20 });
}
function show(rev, file) {
  try { return git(['show', `${rev}:${file}`]); } catch (_) { return ''; }
}

function main() {
  const baseRev = process.argv[2] || 'HEAD^1';
  const headRev = process.argv[3] || 'HEAD';
  const changed = git(['diff', '--name-only', baseRev, headRev]).split('\n').map((s) => s.trim()).filter(Boolean);
  const r = checkPr({
    base: { app: show(baseRev, 'app.js'), sw: show(baseRev, 'sw.js') },
    head: { app: show(headRev, 'app.js'), sw: show(headRev, 'sw.js') },
    changed,
  });
  const v = r.versions;
  console.log(`main: APP_VERSION v${v.bA}, CACHE_NAME v${v.bC} · PR: APP_VERSION v${v.hA}, CACHE_NAME v${v.hC} · קבצי תוכן: ${r.content.length} · sw.js: ${r.swChanged ? 'כן' : 'לא'}`);
  if (r.ok) { console.log('שומר הפריסה: תקין'); return 0; }
  for (const e of r.errs) console.log('✗ ' + e);
  return 1;
}

if (require.main === module) process.exit(main());
module.exports = { checkPr, shellFiles, appVer, swVer };
