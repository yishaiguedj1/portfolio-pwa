// שומר הפריסה (tools/deploy-guard.js) — הכללים של סעיף 8 על PR מול main.
// 11/10/2026: שני PR; 12/10/2026 — פס פריסה אחד: תוכן ו־sw.js המעודכן (swgen) באותו PR.
const assert = require('assert');
const { checkPr, shellFiles } = require('../tools/deploy-guard.js');

let n = 0;
function t(name, fn) { fn(); n++; console.log('✓ ' + name); }

const app = (v) => `x\nconst APP_VERSION = 'v${v}';\n`;
const sw = (v, extra = '') => `const CACHE_NAME = 'portfolio-pwa-v${v}';\nconst APP_SHELL = ['./', './index.html', './app.js', './styles.css'];\nconst STUDIO_SHELL = ['./studio.js'${extra}];\n`;
const pr = (b, h, changed, sync = true) => checkPr({ base: { app: app(b[0]), sw: sw(b[1]) }, head: { app: app(h[0]), sw: sw(h[1], h[2] || '') }, changed, sync });

t('קבצי המעטפת נקראים מ־sw.js (בלי sw.js עצמו, עם index.html)', () => {
  const s = shellFiles(sw(1));
  assert.ok(s.has('app.js') && s.has('studio.js') && s.has('index.html'));
  assert.ok(!s.has('sw.js') && !s.has(''));
});

t('PR אחד: תוכן + sw.js מעודכן עם גרסה חדשה — תקין', () => {
  assert.ok(pr([393, 393], [394, 394], ['app.js', 'sw.js', 'studio.js', 'tests/x.test.js']).ok);
  assert.ok(pr([393, 393], [394, 394, ", './new.js'"], ['sw.js', 'new.js']).ok, 'קובץ חדש במעטפת באותו PR');
});

t('sw.js לא מעודכן לקבצים (בלי swgen) — נחסם', () => {
  const r = pr([393, 393], [394, 394], ['app.js', 'sw.js'], false);
  assert.ok(!r.ok && r.errs.some((e) => /swgen/.test(e)));
});

t('CACHE_NAME שונה מ־APP_VERSION — נחסם', () => {
  const r = pr([393, 393], [394, 393], ['app.js']);
  assert.ok(!r.ok && r.errs.some((e) => /שונה מ־APP_VERSION/.test(e)));
});

t('v387: תוכן באותה גרסה כמו main — נחסם', () => {
  const r = pr([387, 387], [387, 387], ['app.js', 'studio.js']);
  assert.ok(!r.ok);
  assert.ok(r.errs.some((e) => /לא גבוה מ־main/.test(e)));
});

t('שינוי ב־sw.js בלי גרסה חדשה — נחסם', () => {
  const r = pr([388, 388], [388, 388, ", './x.js'"], ['sw.js']);
  assert.ok(!r.ok && r.errs.some((e) => /את sw\.js/.test(e)));
});

t('APP_VERSION יורד — נחסם', () => {
  const r = pr([389, 389], [388, 388], ['CLAUDE.md']);
  assert.ok(!r.ok && r.errs.some((e) => /יורד/.test(e)));
});

t('PR בלי תוכן (שרתון, עובד, מסמכים, בדיקות) — בלי דרישת גרסה', () => {
  assert.ok(pr([387, 387], [387, 387], ['translator/llm.py', 'ibkr-proxy/lib/studio.js', 'CLAUDE.md', 'יומן-עבודה.md', 'tests/a.test.js']).ok);
});

t('קובץ תוכן שנמצא רק במעטפת נחשב תוכן', () => {
  const r = checkPr({ base: { app: app(388), sw: sw(388, ", './studioedl.js'") }, head: { app: app(388), sw: sw(388, ", './studioedl.js'") }, changed: ['studioedl.js'], sync: true });
  assert.ok(!r.ok);
});

console.log(`\n${n} בדיקות עברו`);
