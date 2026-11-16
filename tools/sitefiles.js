#!/usr/bin/env node
/* 16/11/2026 (בקשת המשתמש: מתחרה שסורק את האתר לא יגלה באיזה מודל הסטודיו משתמש): האתר מגיש רק את קבצי האפליקציה.
   עד היום שלושת היעדים (הניסוי ב־Cloudflare, GitHub Pages, הייצור ב־Cloudflare) קיבלו את כל הריפו — כל אחד יכל לקרוא
   ‎/translator/llm.py, ‎/docs/…, ‎/CLAUDE.md והיומן ישר מהאתר. מעכשיו — רשימה מותרת (לא רשימה אסורה: תיקייה חדשה
   בריפו לא עולה לאתר בטעות). קובץ שהאתר באמת צריך ולא ברשימה = tests/site-files.test.js נכשל (מעטפות sw.js, הפניות
   מהדפים ומהמניפסטים).
   שימוש:  node tools/sitefiles.js --out <תיקייה> [--rev <קומיט>]   — מעתיק לתיקייה (מ־git archive של הקומיט, ברירת מחדל HEAD)
           node tools/sitefiles.js --list                          — מדפיס את הרשימה (מהקבצים שב־git) */
'use strict';
const path = require('path');

/* קבצים בשורש — לפי סיומת. ‎.md — רק CHANGELOG.md ("מה חדש" בטלפון קורא אותו) */
const ROOT_EXT = /\.(html|js|mjs|css|webmanifest|png|webp|jpg|jpeg|ico|svg|woff2)$/i;
const ROOT_NAMES = new Set(['_headers', '.nojekyll', 'CHANGELOG.md', 'robots.txt']);
/* תיקיות שהאתר מגיש כמו שהן. functions/ — הפונקציות של Cloudflare Pages (השורש לכל אפליקציה, ‎/up) */
const DIRS = ['.well-known/', 'fonts/', 'logos/', 'vendor/', 'functions/'];
/* קבצים בודדים בתוך תיקיות פנימיות שהאפליקציה טוענת מהאתר: תבנית "קוד ההקמה" של השרת (studionet.js, cloudInitTemplate) */
const FILES = new Set(['infra/cloud-init.yaml']);

function isSiteFile(rel) {
  const p = String(rel || '').replace(/\\/g, '/');
  if (!p || p.startsWith('/') || p.split('/').includes('..')) return false;
  if (!p.includes('/')) return ROOT_NAMES.has(p) || ROOT_EXT.test(p);
  return FILES.has(p) || DIRS.some((d) => p.startsWith(d));
}

const siteFiles = (list) => list.filter(isSiteFile);

module.exports = { isSiteFile, siteFiles, DIRS, ROOT_NAMES, FILES };

if (require.main === module) {
  const { execFileSync } = require('child_process');
  const fs = require('fs');
  const ROOT = path.join(__dirname, '..');
  const args = process.argv.slice(2);
  const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : ''; };
  const rev = opt('--rev') || 'HEAD';
  const git = (a, o) => execFileSync('git', a, Object.assign({ cwd: ROOT, maxBuffer: 1 << 30 }, o || {}));
  const all = git(['ls-tree', '-r', '-z', '--name-only', rev]).toString('utf8').split('\0').filter(Boolean);
  const keep = siteFiles(all);
  if (args.includes('--list')) { process.stdout.write(keep.join('\n') + '\n'); process.exit(0); }
  const out = opt('--out');
  if (!out) { console.error('שימוש: node tools/sitefiles.js --out <תיקייה> [--rev <קומיט>] | --list'); process.exit(2); }
  const dest = path.resolve(out);
  fs.mkdirSync(dest, { recursive: true });
  if (fs.readdirSync(dest).length) { console.error('sitefiles: התיקייה ' + dest + ' לא ריקה'); process.exit(2); }
  // git archive של הקומיט עם רשימת הנתיבים בלבד (בלי .git, בדיוק התוכן שבקומיט) → tar לתיקייה
  const tar = git(['archive', '--format=tar', rev, '--'].concat(keep.map((f) => ':(literal)' + f)));
  execFileSync('tar', ['-x', '-C', dest], { input: tar, maxBuffer: 1 << 30 });
  console.log('sitefiles: ' + keep.length + ' קבצים מתוך ' + all.length + ' → ' + dest);
}
