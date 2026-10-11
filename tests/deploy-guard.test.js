// שומר הפריסה (tools/deploy-guard.js) — הכללים של סעיף 8 על PR מול main (11/10/2026)
const assert = require('assert');
const { checkPr, shellFiles } = require('../tools/deploy-guard.js');

let n = 0;
function t(name, fn) { fn(); n++; console.log('✓ ' + name); }

const app = (v) => `x\nconst APP_VERSION = 'v${v}';\n`;
const sw = (v, extra = '') => `const CACHE_NAME = 'portfolio-pwa-v${v}';\nconst APP_SHELL = ['./', './index.html', './app.js', './styles.css'];\nconst STUDIO_SHELL = ['./studio.js'${extra}];\n`;
const pr = (b, h, changed) => checkPr({ base: { app: app(b[0]), sw: sw(b[1]) }, head: { app: app(h[0]), sw: sw(h[1], h[2] || '') }, changed });

t('קבצי המעטפת נקראים מ־sw.js (בלי sw.js עצמו, עם index.html)', () => {
  const s = shellFiles(sw(1));
  assert.ok(s.has('app.js') && s.has('studio.js') && s.has('index.html'));
  assert.ok(!s.has('sw.js') && !s.has(''));
});

t('תוכן עם גרסה חדשה — תקין (1/2)', () => {
  assert.ok(pr([387, 387], [388, 387], ['app.js', 'studio.js', 'tests/x.test.js']).ok);
});

t('sw.js אחרי שהתוכן מוזג — תקין (2/2)', () => {
  assert.ok(pr([388, 387], [388, 388], ['sw.js']).ok);
  assert.ok(pr([388, 387], [388, 388, ", './new.js'"], ['sw.js']).ok, 'הוספת קובץ למעטפת באותו PR של sw.js');
});

t('v387: תוכן באותה גרסה אחרי ש־sw.js שלה כבר מוזג — נחסם', () => {
  const r = pr([387, 387], [387, 387], ['app.js', 'studio.js']);
  assert.ok(!r.ok);
  assert.ok(r.errs.some((e) => /לא גבוה מ־main/.test(e)));
});

t('sw.js יחד עם תוכן — נחסם', () => {
  const r = pr([387, 387], [388, 388], ['app.js', 'sw.js']);
  assert.ok(!r.ok && r.errs.some((e) => /באותו PR/.test(e)));
});

t('sw.js לפני שהתוכן מוזג — נחסם', () => {
  const r = pr([387, 387], [387, 388], ['sw.js']);
  assert.ok(!r.ok && r.errs.some((e) => /שווה ל־APP_VERSION/.test(e)));
});

t('sw.js בלי להעלות CACHE_NAME — נחסם', () => {
  const r = pr([388, 388], [388, 388, ", './x.js'"], ['sw.js']);
  assert.ok(!r.ok && r.errs.some((e) => /בלי להעלות/.test(e)));
});

t('APP_VERSION יורד — נחסם', () => {
  const r = pr([389, 388], [388, 388], ['CLAUDE.md']);
  assert.ok(!r.ok && r.errs.some((e) => /יורד/.test(e)));
});

t('PR בלי תוכן (שרתון, עובד, מסמכים, בדיקות) — בלי דרישת גרסה', () => {
  assert.ok(pr([387, 387], [387, 387], ['translator/llm.py', 'ibkr-proxy/lib/studio.js', 'CLAUDE.md', 'יומן-עבודה.md', 'tests/a.test.js']).ok);
});

t('קובץ תוכן חדש שנוסף רק למעטפת ב־main נחשב תוכן', () => {
  const r = checkPr({ base: { app: app(388), sw: sw(388, ", './studioedl.js'") }, head: { app: app(388), sw: sw(388, ", './studioedl.js'") }, changed: ['studioedl.js'] });
  assert.ok(!r.ok);
});

console.log(`\n${n} בדיקות עברו`);
