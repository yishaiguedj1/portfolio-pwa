#!/usr/bin/env node
// שלב 1 בתוכנית הסביבות (12/10/2026): פס פריסה אחד — sw.js נגזר מהקבצים עצמם.
// הכלי כותב ב־sw.js את CACHE_NAME (מ־APP_VERSION שב־app.js — הגרסה נקבעת במקום אחד) ואת HASHES:
// טביעת SHA-256 לכל קובץ במעטפות (APP_SHELL / LIB_SHELL / STUDIO_SHELL). בהתקנה הטלפון מוריד כל קובץ
// עם ‎?v=<טביעה> (עוקף את מטמון ה־CDN) ומאמת אותו מול הטביעה — קובץ ישן = ההתקנה נכשלת והגרסה הקודמת נשארת.
// לכן תוכן ו־sw.js באותו PR בטוחים, ופרוטוקול "שני PR" לא נחוץ.
//   node tools/swgen.js           — כותב את sw.js
//   node tools/swgen.js --check   — רק בודק שהוא מעודכן (בדיקות ו־CI); יציאה 1 אם לא
//   node tools/swgen.js --live <כתובת>  — אחרי פריסה: כל קובץ באתר החי זהה לטביעה ב־sw.js החי
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const HASH_LEN = 32;                       // 128 ביט — נגד קובץ ישן, לא נגד יריב (את זה עושה HTTPS)
const BEGIN = '/* <swgen> נוצר ב־node tools/swgen.js — לא לערוך ביד. הבדיקות ושומר הפריסה משווים לקבצים */';
const END = '/* </swgen> */';

const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex').slice(0, HASH_LEN);
const fileOf = (p) => (p === './' ? 'index.html' : p.replace(/^\.\//, ''));

// הנתיבים במעטפות — מהמערכים שב־sw.js, בסדר שלהם, בלי כפילות
function shellPaths(sw) {
  const out = [];
  for (const name of ['APP_SHELL', 'LIB_SHELL', 'STUDIO_SHELL']) {
    const m = String(sw).match(new RegExp('const ' + name + ' = \\[([\\s\\S]*?)\\];'));
    if (!m) throw new Error('swgen: חסר ' + name + ' ב־sw.js');
    for (const q of m[1].matchAll(/'(\.\/[^']*)'/g)) if (!out.includes(q[1])) out.push(q[1]);
  }
  return out;
}

function appVersion(app) {
  const m = String(app).match(/const APP_VERSION = '(v\d+)'/);
  if (!m) throw new Error('swgen: חסר APP_VERSION ב־app.js');
  return m[1];
}

function block(version, hashes) {
  const rows = Object.keys(hashes).map((p) => '  ' + JSON.stringify(p) + ': ' + JSON.stringify(hashes[p])).join(',\n');
  return BEGIN + '\nconst CACHE_NAME = \'portfolio-pwa-' + version + '\';\nconst HASHES = {\n' + rows + '\n};\n' + END;
}

// טהורה מול מערכת קבצים: read(rel) → Buffer
function build(read) {
  const sw = read('sw.js').toString('utf8');
  const version = appVersion(read('app.js').toString('utf8'));
  const hashes = {};
  for (const p of shellPaths(sw)) hashes[p] = sha(read(fileOf(p)));
  const b = block(version, hashes);
  const i = sw.indexOf(BEGIN), j = sw.indexOf(END);
  let text;
  if (i >= 0 && j > i) text = sw.slice(0, i) + b + sw.slice(j + END.length);
  else if (/const CACHE_NAME = '[^']*';/.test(sw)) text = sw.replace(/const CACHE_NAME = '[^']*';/, () => b);
  else throw new Error('swgen: לא נמצא מקום ל־CACHE_NAME ב־sw.js');
  return { text, version, hashes, changed: text !== sw };
}

// הטביעות שכתובות ב־sw.js (גם של האתר החי)
function readHashes(sw) {
  const i = sw.indexOf(BEGIN), j = sw.indexOf(END);
  if (i < 0 || j < i) return null;
  const m = sw.slice(i, j).match(/const HASHES = (\{[\s\S]*?\});/);
  const v = sw.slice(i, j).match(/const CACHE_NAME = 'portfolio-pwa-(v\d+)'/);
  return m && v ? { version: v[1], hashes: JSON.parse(m[1]) } : null;
}

async function live(base, fetchFn) {
  base = base.replace(/\/?$/, '/');
  const bust = () => 'n=' + Date.now() + Math.random().toString(36).slice(2, 6);
  const get = async (rel) => {
    const r = await fetchFn(base + rel.replace(/^\.\//, '') + (rel.includes('?') ? '&' : '?') + bust(), { cache: 'no-store' });
    if (!r.ok) throw new Error(rel + ': HTTP ' + r.status);
    return Buffer.from(await r.arrayBuffer());
  };
  const sw = (await get('./sw.js')).toString('utf8');
  const h = readHashes(sw);
  if (!h) return { ok: false, errs: ['sw.js החי בלי בלוק swgen'] };
  const errs = [];
  for (const [p, want] of Object.entries(h.hashes)) {
    try {
      const got = sha(await get(p === './' ? './' : p));
      if (got !== want) errs.push(p + ': הקובץ החי שונה מהטביעה');
    } catch (e) { errs.push(String(e.message || e)); }
  }
  return { ok: errs.length === 0, errs, version: h.version, n: Object.keys(h.hashes).length };
}

/* שלב 5: הכתובת של Academy/Studio — השורש מגיש את הדף של האפליקציה (functions/index.js), ולכן לא בודקים שם את
   המעטפת כולה (‎./ ו־index.html שם שונים), אלא שהשורש = הדף מהטביעות של sw.js באותה כתובת */
async function liveRoot(base, fetchFn) {
  base = base.replace(/\/?$/, '/');
  const host = new URL(base).hostname;
  const page = /^academy/.test(host) ? './academy.html' : /^studio/.test(host) ? './studio.html' : '';
  if (!page) return { ok: false, errs: ['לא כתובת של Academy/Studio: ' + host] };
  const get = async (rel) => {
    const r = await fetchFn(base + rel + '?n=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error((rel || '/') + ': HTTP ' + r.status);
    return Buffer.from(await r.arrayBuffer());
  };
  try {
    const h = readHashes((await get('sw.js')).toString('utf8'));
    if (!h) return { ok: false, errs: ['sw.js החי בלי בלוק swgen'] };
    if (sha(await get('')) !== h.hashes[page]) return { ok: false, errs: ['השורש לא זהה ל־' + page] };
    return { ok: true, errs: [], version: h.version, n: 1 };
  } catch (e) { return { ok: false, errs: [String(e.message || e)] }; }
}

async function main(argv) {
  if (argv[0] === '--live-root') {
    const r = await liveRoot(argv[1] || '', fetch);
    if (r.ok) { console.log('השורש תואם: ' + r.version); return 0; }
    for (const e of r.errs) console.log('✗ ' + e);
    return 1;
  }
  if (argv[0] === '--live') {
    const r = await live(argv[1] || 'https://yishaiguedj1.github.io/portfolio-pwa/', fetch);
    if (r.ok) { console.log('האתר החי תואם: ' + r.version + ' · ' + r.n + ' קבצים'); return 0; }
    for (const e of r.errs) console.log('✗ ' + e);
    return 1;
  }
  const read = (rel) => fs.readFileSync(path.join(ROOT, rel));
  const r = build(read);
  if (argv[0] === '--check') {
    if (!r.changed) { console.log('sw.js מעודכן: ' + r.version + ' · ' + Object.keys(r.hashes).length + ' קבצים'); return 0; }
    console.log('✗ sw.js לא מעודכן לקבצים — להריץ: node tools/swgen.js');
    return 1;
  }
  if (r.changed) fs.writeFileSync(path.join(ROOT, 'sw.js'), r.text);
  console.log((r.changed ? 'sw.js נכתב: ' : 'sw.js כבר מעודכן: ') + r.version + ' · ' + Object.keys(r.hashes).length + ' קבצים');
  return 0;
}

if (require.main === module) main(process.argv.slice(2)).then((c) => process.exit(c), (e) => { console.error(String(e.message || e)); process.exit(1); });
module.exports = { build, shellPaths, readHashes, live, liveRoot, sha, fileOf, BEGIN, END, HASH_LEN };
