// 16/11/2026 (בקשת המשתמש: מתחרה שסורק את האתר לא יגלה באיזה מודל הסטודיו משתמש): האתר מגיש רק את קבצי האפליקציה
// (tools/sitefiles.js — רשימה מותרת). כאן: (1) כל קובץ שהאפליקציה טוענת נמצא ברשימה — מעטפות sw.js, הפניות מהדפים,
// מהמניפסטים ו־import בין המודולים; (2) הקוד הפנימי (docs/, translator/, ibkr-proxy/, tools/, tests/, היומן…) לא ברשימה.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const { isSiteFile, siteFiles } = require('../tools/sitefiles.js');
const { shellPaths, fileOf } = require('../tools/swgen.js');
let n = 0;
const t = (name, fn) => { fn(); n++; console.log('✓ ' + name); };

const all = execFileSync('git', ['ls-files', '-z'], { cwd: root, maxBuffer: 1 << 28 }).toString('utf8').split('\0').filter(Boolean);
const site = new Set(siteFiles(all));

/* הפניה מקומית → נתיב קובץ באתר (או '' כשהיא לא מקומית) */
function local(ref, from) {
  let r = String(ref || '').trim();
  if (!r || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|\{|\$)/i.test(r)) return '';
  r = r.split('#')[0].split('?')[0];
  const base = path.posix.dirname(from);
  let p = r.startsWith('/') ? r.slice(1) : path.posix.normalize(path.posix.join(base, r));
  if (p === '' || p === '.' || p === './') p = 'index.html';
  if (p.endsWith('/')) p += 'index.html';
  return p;
}
const resolveSite = (p) => site.has(p) || site.has(p + '.html') || (p === 'share' && site.has('share.html'));

t('הכלי: קבצי האפליקציה בפנים, הקוד הפנימי בחוץ', () => {
  for (const f of ['index.html', 'studio.html', 'studio.js', 'sw.js', 'core.js', 'strings-studio.js', 'manifest-studio.webmanifest', '_headers', '.nojekyll',
    'CHANGELOG.md', 'infra/cloud-init.yaml', 'fonts/NotoSansHebrew-VF.woff2', '.well-known/assetlinks.json', 'functions/index.js', 'functions/up.js', 'logos/KHC.png']) assert.ok(isSiteFile(f), 'חסר באתר: ' + f);
  for (const f of ['CLAUDE.md', 'README.md', 'SECURITY.md', 'יומן-עבודה.md', 'משימות-פתוחות.md', 'docs/studio-worker.md', 'translator/llm.py', 'translator/job.py',
    'ibkr-proxy/lib/studio.js', 'ibkr-proxy/api/studio.js', 'tools/swgen.js', 'tests/site-files.test.js', 'android/app/build.gradle', '.claude/settings.json',
    '.github/workflows/deploy.yml', 'design-mockups/monitor/index.html', 'infra/compose.yaml', 'firestore/firestore.rules', 'brand/README.md', '.gitignore',
    '.dockerignore', '../etc/passwd', 'a/../CLAUDE.md']) assert.ok(!isSiteFile(f), 'לא אמור להיות באתר: ' + f);
  for (const f of site) if (f !== 'infra/cloud-init.yaml') assert.ok(!/^(docs|translator|ibkr-proxy|tools|tests|android|infra|firestore|design-mockups|qa-deep-out|brand|\.claude|\.github)\//.test(f), 'באתר: ' + f);
  for (const f of site) if (!f.includes('/')) assert.ok(!/\.(md|py|sh|yml|yaml|txt|json)$/i.test(f) || f === 'CHANGELOG.md', 'קובץ פנימי בשורש האתר: ' + f);
});

t('כל המעטפות של sw.js (APP/LIB/STUDIO/FLOW) באתר', () => {
  const ps = shellPaths(read('sw.js'));
  assert.ok(ps.length > 40, 'מעטפות: ' + ps.length);
  for (const p of ps) assert.ok(site.has(fileOf(p)), 'sw.js מטמין קובץ שלא עולה לאתר: ' + p);
  for (const m of read('sw.js').matchAll(/importScripts\(([^)]*)\)/g)) for (const q of m[1].matchAll(/'([^']+)'/g)) assert.ok(site.has(local(q[1], 'sw.js')), 'importScripts: ' + q[1]);
});

t('כל src/href בדפים — באתר', () => {
  let k = 0;
  for (const f of [...site].filter((x) => x.endsWith('.html'))) {
    for (const m of read(f).matchAll(/\s(?:src|href)="([^"]+)"/g)) {
      const p = local(m[1], f);
      if (!p) continue;
      k++;
      assert.ok(resolveSite(p), f + ' מפנה ל־' + m[1] + ' שלא עולה לאתר');
    }
  }
  assert.ok(k > 30, 'הפניות: ' + k);
});

t('המניפסטים — אייקונים, צילומים, כתובת פתיחה, פעולות', () => {
  for (const f of [...site].filter((x) => x.endsWith('.webmanifest'))) {
    const j = JSON.parse(read(f));
    const refs = [j.start_url, j.scope].concat((j.icons || []).map((i) => i.src), (j.screenshots || []).map((i) => i.src),
      (j.shortcuts || []).flatMap((s) => [s.url].concat((s.icons || []).map((i) => i.src))), (j.file_handlers || []).map((h) => h.action),
      j.share_target ? [j.share_target.action] : []);
    for (const r of refs) { const p = local(r, f); if (p && p !== 'index.html') assert.ok(resolveSite(p), f + ': ' + r); }
  }
});

t('import / import() / Worker בין המודולים — באתר', () => {
  let k = 0;
  for (const f of [...site].filter((x) => /\.m?js$/.test(x) && !x.startsWith('vendor/') && !x.startsWith('functions/'))) {
    const s = read(f);
    const refs = [...s.matchAll(/^\s*import\s[^'"]*?from\s+['"](\.[^'"]+)['"]/gm), ...s.matchAll(/^\s*import\s+['"](\.[^'"]+)['"]/gm),
      ...s.matchAll(/\bimport\(\s*['"](\.[^'"]+)['"]\s*\)/g), ...s.matchAll(/new (?:Shared)?Worker\(\s*['"](\.[^'"]+)['"]/g),
      ...s.matchAll(/\bfetch\(\s*['"`]((?![a-z][a-z0-9+.-]*:|\/|\$\{)[^'"`]+)['"`]/gi)].map((m) => m[1]);   // גם fetch יחסי (CHANGELOG.md, infra/cloud-init.yaml)
    for (const r of refs) { k++; assert.ok(site.has(local(r, f)), f + ' טוען ' + r + ' שלא עולה לאתר'); }
  }
  assert.ok(k > 20, 'imports: ' + k);
});

console.log(`\n${n} בדיקות עברו (site-files)`);
