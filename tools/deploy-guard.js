#!/usr/bin/env node
// שומר הפריסה (11/10/2026, אחרי התנגשות v387 בין שני סשנים): בודק PR מול ה־main שהוא נכנס אליו.
// רץ ב־CI רק ב־pull_request (test.yml, job ‏deploy-guard), על קומיט המיזוג: HEAD^1 = ה־main הנוכחי.
// 12/10/2026 — פס פריסה אחד: sw.js נגזר מהקבצים (tools/swgen.js) וההתקנה בטלפון מאמתת כל קובץ, ולכן תוכן ו־sw.js
// עולים יחד, ב־PR אחד. הכללים:
//   1. PR שמשנה תוכן (קבצי המעטפות שב־sw.js + index.html) או את sw.js — APP_VERSION גבוה מזה שב־main.
//   2. sw.js מעודכן לקבצים של ה־PR (swgen --check) ו־CACHE_NAME = APP_VERSION.
//   3. APP_VERSION לא יורד (מיזוג ישן שדורס גרסה חדשה).
// 12/10/2026 (v395) — שני מספרים, כמו באנדרואיד (versionName + versionCode):
//   APP_VERSION 'vNNN' = מספר הבנייה (עולה בכל PR שמשנה תוכן; מפתח המטמון — כללים 1–3).
//   APP_RELEASE 'X.Y.Z' = גרסת המערכת (SemVer) — עולה רק כשמשחררים לפרודקשן. הכללים:
//   4. תקין (X.Y.Z), ולא יורד.
//   5. עלה → ב־CHANGELOG.md יש כותרת "## X.Y.Z" (מה חדש בגרסה).
'use strict';
const { execFileSync } = require('child_process');

function verOf(src, re) {
  const m = String(src || '').match(re);
  return m ? parseInt(m[1], 10) : 0;
}
const appVer = (s) => verOf(s, /const APP_VERSION = 'v(\d+)'/);
const swVer = (s) => verOf(s, /const CACHE_NAME = 'portfolio-pwa-v(\d+)'/);
// גרסת המערכת: [X, Y, Z] או null (אין / לא תקינה)
function relOf(src) {
  const m = String(src || '').match(/const APP_RELEASE = '([^']*)'/);
  if (!m) return null;
  const v = m[1].match(/^(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})$/);
  return v ? [+v[1], +v[2], +v[3]] : 'bad';
}
const relCmp = (a, b) => (a[0] - b[0]) || (a[1] - b[1]) || (a[2] - b[2]);
const relStr = (r) => (Array.isArray(r) ? r.join('.') : String(r));

// קבצי התוכן = כל מה שמופיע במעטפות של sw.js ('./x') + index.html
function shellFiles(sw) {
  const out = new Set(['index.html']);
  for (const m of String(sw || '').matchAll(/'\.\/([^'\s]+)'/g)) if (m[1]) out.add(m[1]);
  out.delete('sw.js');
  return out;
}

// טהורה: base/head = { app, sw } (תוכן הקבצים), changed = רשימת קבצים ששונו ב־PR, sync = sw.js מעודכן לקבצים (swgen)
function checkPr({ base, head, changed, sync }) {
  const errs = [];
  const shells = new Set([...shellFiles(base.sw), ...shellFiles(head.sw)]);
  const content = changed.filter((f) => shells.has(f));
  const swChanged = changed.includes('sw.js');
  const bA = appVer(base.app), hA = appVer(head.app), bC = swVer(base.sw), hC = swVer(head.sw);
  if ((content.length || swChanged) && !(hA > bA)) {
    errs.push(`ה־PR משנה ${content.length ? 'תוכן' : 'את sw.js'} אבל APP_VERSION ‏v${hA} לא גבוה מ־main ‏(v${bA}) — מספר גרסה חדש (הגבוה מבין main וה־PR הפתוחים + 1)`);
  }
  if (hA && bA && hA < bA) errs.push(`APP_VERSION יורד מ־v${bA} ל־v${hA} — כנראה מיזוג ישן; למזג את main מחדש`);
  if (hC !== hA) errs.push(`CACHE_NAME ‏v${hC} שונה מ־APP_VERSION ‏v${hA} — להריץ node tools/swgen.js`);
  else if (sync === false) errs.push('sw.js לא מעודכן לקבצים של ה־PR (טביעות) — להריץ node tools/swgen.js');
  const bR = relOf(base.app), hR = relOf(head.app);
  let released = false;
  if (hR === null || hR === 'bad') errs.push(`APP_RELEASE ${hR === null ? 'חסר' : 'לא תקין'} ב־app.js — צריך X.Y.Z (למשל 1.2.0)`);
  else if (Array.isArray(bR)) {
    const c = relCmp(hR, bR);
    if (c < 0) errs.push(`APP_RELEASE יורד מ־${relStr(bR)} ל־${relStr(hR)}`);
    released = c > 0;
  } else released = true;   // main בלי APP_RELEASE (המעבר, v395)
  if (released && Array.isArray(hR)) {
    const head2 = '## ' + relStr(hR);   // השוואת שורות — בלי לבנות ביטוי רגולרי מהמספר
    const has = String(head.changelog || '').split(/\r?\n/).some((l) => l === head2 || l.startsWith(head2 + ' '));
    if (!has) errs.push(`APP_RELEASE עלה ל־${relStr(hR)} אבל ב־CHANGELOG.md אין כותרת "## ${relStr(hR)}" — לכתוב מה חדש בגרסה`);
  }
  return { ok: errs.length === 0, errs, content, swChanged, released, versions: { bA, hA, bC, hC, bR: relStr(bR), hR: relStr(hR) } };
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 << 20 });
}
function show(rev, file) {
  try { return git(['show', `${rev}:${file}`]); } catch (_) { return ''; }
}

// sw.js של ה־PR מעודכן לקבצים של ה־PR (מתוך git, בתים כמו שהם — גם תמונות)
function swSync(rev) {
  try {
    const read = (rel) => execFileSync('git', ['show', `${rev}:${rel}`], { maxBuffer: 64 << 20 });
    return !require('./swgen').build(read).changed;
  } catch (_) { return false; }
}

function main() {
  const baseRev = process.argv[2] || 'HEAD^1';
  const headRev = process.argv[3] || 'HEAD';
  const changed = git(['diff', '--name-only', baseRev, headRev]).split('\n').map((s) => s.trim()).filter(Boolean);
  const r = checkPr({
    base: { app: show(baseRev, 'app.js'), sw: show(baseRev, 'sw.js') },
    head: { app: show(headRev, 'app.js'), sw: show(headRev, 'sw.js'), changelog: show(headRev, 'CHANGELOG.md') },
    changed,
    sync: swSync(headRev),
  });
  const v = r.versions;
  console.log(`main: ${v.bR} (v${v.bA}), CACHE_NAME v${v.bC} · PR: ${v.hR} (v${v.hA}), CACHE_NAME v${v.hC} · קבצי תוכן: ${r.content.length} · sw.js: ${r.swChanged ? 'כן' : 'לא'} · שחרור לפרודקשן: ${r.released ? 'כן' : 'לא (רק ניסוי)'}`);
  if (r.ok) { console.log('שומר הפריסה: תקין'); return 0; }
  for (const e of r.errs) console.log('✗ ' + e);
  return 1;
}

if (require.main === module) process.exit(main());
module.exports = { checkPr, shellFiles, appVer, swVer, relOf, relCmp };
