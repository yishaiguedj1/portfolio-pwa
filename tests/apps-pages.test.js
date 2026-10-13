// שלב 3ג–3ד בתוכנית שלוש האפליקציות (13/10/2026): academy.html ו־studio.html — דפים עצמאיים בלי app.js.
// לכל דף: ה־CSP זהה לזה של index.html חוץ מה־hash של הסקריפט שבדף (מקור חדש = בכל הדפים), סדר הסקריפטים, בלי התיק,
// ההבדלים במצב עצמאי במודול (SA), והקבצים במטמון של ה־SW.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const idx = read('index.html');
const sw = read('sw.js');
const csp = (html) => (html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/) || [])[1] || '';
const APPS = [
  { app: 'academy', mod: 'library.js', open: 'openLibrary', shell: 'LIB_SHELL', st: 'lib', cls: 'lib-open' },
  { app: 'studio', mod: 'studio.js', open: 'openStudio', shell: 'STUDIO_SHELL', st: 'studio', cls: 'studio-open' },
];

for (const A of APPS) {
  const page = read(A.app + '.html');
  const inline = [...page.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  ok(inline.length === 1, A.app + ': סקריפט inline אחד בדיוק');
  const h = "'sha256-" + crypto.createHash('sha256').update(inline[0]).digest('base64') + "'";
  ok(csp(page).includes(h), A.app + ': ה־hash של הסקריפט ב־CSP (שינוי בסקריפט = לעדכן)');
  ok(csp(page).replace(/'sha256-[^']+'/g, 'H') === csp(idx).replace(/'sha256-[^']+'/g, 'H'), A.app + ': ה־CSP זהה ל־index.html (חוץ מה־hash) — מקור חדש נכנס לכולם');
  ok(/if\(self!==top\)/.test(inline[0]) && inline[0].includes("classList.add('" + A.cls + "')") && inline[0].includes('h.' + A.st), A.app + ': מסגרת זרה, ערכת נושא ווילון ברענון');
  ok(!/on(load|error|click)=/.test(page), A.app + ': בלי מאזינים בתוך HTML');
  const srcs = [...page.matchAll(/<script (?:type="module" )?src="([^"]+)"/g)].map((m) => m[1]);
  ok(JSON.stringify(srcs) === JSON.stringify(['firebase-config.js', 'strings-' + A.app + '.js', 'core.js', 'auth.js', A.app + '-app.js']),
    A.app + ': סדר הסקריפטים — הגדרות → מחרוזות → core → auth → האתחול (מודול, אחרי ה־defer)');
  ok(!/app\.js"|cloud\.js|returns\.js/.test(page.replace(A.app + '-app.js', '')), A.app + ': בלי app.js / cloud.js / returns.js — בלי התיק');

  const boot = read(A.app + '-app.js');
  ok(boot.includes("import { " + A.open + " } from './" + A.mod + "'") && /standalone: \{ auth: A, home: '\.\/' \}/.test(boot), A.app + ': האתחול פותח את אותו המודול במצב עצמאי');
  ok(boot.indexOf('wireCoreBack()') > 0 && boot.indexOf('wireCoreBack()') < boot.indexOf(A.open + '({'), A.app + ': "חזור" של החלונות נרשם לפני המודול (סדר מאזיני popstate)');
  ok(/pwa_auth_rl/.test(boot) && /Date\.now\(\) - last > 8000/.test(boot), A.app + ': טעינה מחדש כשהחיבור משתנה — עם שומר מפני לולאה');

  const mod = read(A.mod);
  ok(/if \(SA && !restore\) [^\n]*history\.replaceState\(/.test(mod), A.app + ': הבית מחליף את רשומת הדף — "חזור" ממנו יוצא מהדף');
  ok(/location\.href = SA\.home \|\| '\.\/'/.test(mod) && /SA\.auth\.signIn\(\)/.test(mod), A.app + ': "THE SNOWBALL" → Invest, ובלי חיבור — כפתור כניסה');

  const shell = (sw.match(new RegExp('const ' + A.shell + ' = \\[([\\s\\S]*?)\\];')) || [])[1] || '';
  for (const f of [A.app + '.html', A.app + '-app.js', 'strings-' + A.app + '.js', 'core.js', 'auth.js']) ok(shell.includes("'./" + f + "'"), A.app + ': ' + A.shell + ' כולל ' + f);
}
ok(/if \(lvl < 1 && root && !SA\)/.test(read('library.js')) && /if \(!st\.studio && SA\) return;/.test(read('studio.js')), 'עצמאי: אין "חזרה לסקירה" (אין תיק)');
ok(/\[#&\]studio=\(j\[A-Za-z0-9_-\]\{20\}\)/.test(read('studio-app.js')), 'studio.html: קישור מהתראה (#studio=) פותח את העבודה');
/* אופליין: ניווט לדף עצמאי מקבל את הדף עצמו — גם בכתובת בלי סיומת (Cloudflare: academy.html → /academy). מריצים את sw.js ב־vm */
{
  const vm = require('vm');
  const L = {};
  const BASE = 'https://staging.thesnowball.app/';
  const cached = { [BASE + 'index.html']: 'INVEST', [BASE + 'academy.html']: 'ACADEMY', [BASE + 'studio.html']: 'STUDIO' };
  const norm = (k) => { const u = new URL(typeof k === 'string' ? k : k.url, BASE); return u.origin + u.pathname; };
  const caches = { match: async (k) => cached[norm(k)] || undefined, open: async () => ({ put: async () => {} }), keys: async () => [] };
  const self = { addEventListener: (k, f) => { L[k] = f; }, location: { origin: 'https://staging.thesnowball.app' }, registration: { scope: BASE }, clients: {} };
  vm.runInNewContext(sw, { self, caches, fetch: () => Promise.reject(new Error('offline')), URL, Promise, console, Response: function () {}, setTimeout, crypto: {} });
  const nav = (p) => new Promise((res) => L.fetch({ request: { method: 'GET', url: BASE + p, mode: 'navigate' }, respondWith: (pr) => pr.then(res, () => res('ERR')) }));
  (async () => {
    const r = await Promise.all(['academy', 'academy.html', 'studio', 'studio?x=1', 'nothing'].map(nav));
    ok(r.join() === 'ACADEMY,ACADEMY,STUDIO,STUDIO,INVEST', 'אופליין: /academy ו־academy.html → Academy, /studio → Studio, דף לא מוכר → התיק (' + r.join() + ')');
      })();
}
console.log('# ' + n + ' בדיקות עברו');
