// שלב 4 בתוכנית שלוש האפליקציות (13/10/2026): כתובת לכל אפליקציה.
// ייצור <אפליקציה>.thesnowball.app, ניסוי <אפליקציה>-staging.thesnowball.app (ברמה הראשונה — התעודה החינמית של
// Cloudflare לא מכסה a.b.thesnowball.app). פרויקט Cloudflare Pages אחד; functions/index.js מגיש בשורש את הדף של
// האפליקציה; sw.js שומר את './' לפי הכתובת; firebase-config.js נותן לכל צד את הכתובות של האחרות; השרתון מקבל אותן.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; console.log('ok - ' + m); };

// ---------- firebase-config.js: הסביבה והכתובות לפי הכתובת שבה נמצאים
function envAt(host) {
  const window = {}; const document = { documentElement: { classList: { add() {} } } };
  vm.runInNewContext(read('firebase-config.js'), { window, document, location: { hostname: host } });
  return window.SNB_ENV;
}
{
  const a = envAt('academy-staging.thesnowball.app');
  ok(a.name === 'staging' && a.proxy === 'https://api-staging.thesnowball.app' && a.firebase.projectId === 'snowball-staging-758f6', 'academy-staging = סביבת הניסוי (Firebase והשרתון של הניסוי)');
  ok(a.apps.invest === 'https://invest-staging.thesnowball.app/' && a.apps.academy === 'https://academy-staging.thesnowball.app/' && a.apps.studio === 'https://studio-staging.thesnowball.app/', 'בכתובת נפרדת בניסוי — הכתובות של שלוש האפליקציות בניסוי');
  const p = envAt('studio.thesnowball.app');
  ok(p.name === 'prod' && p.apps.invest === 'https://invest.thesnowball.app/' && p.apps.academy === 'https://academy.thesnowball.app/', 'בכתובת נפרדת בייצור — הכתובות של הייצור (לא של הניסוי)');
  for (const h of ['yishaiguedj1.github.io', 'staging.thesnowball.app', 'thesnowball.pages.dev', 'localhost', 'academy.staging.thesnowball.app']) {
    const e = envAt(h);
    assert.deepStrictEqual({ ...e.apps }, { invest: './', academy: 'academy.html', studio: 'studio.html' }, h);
  }
  ok(true, 'באתר המאוחד (github.io, staging, pages.dev, localhost) — הדפים שלידו');
  ok(envAt('invest-staging.thesnowball.app').name === 'staging' && envAt('invest.thesnowball.app').name === 'prod' && envAt('evil-staging.thesnowball.app').name === 'prod', 'רק השמות הידועים עם -staging = ניסוי');
}
ok(/import \{ createShell, APP_URL, loginGate, accountCard, displayCard, advancedRow, advancedCards \} from '\.\/shell\.js'/.test(read('academy-app.js')) && /home: APP_URL\.invest/.test(read('studio-app.js')), '"THE SNOWBALL" בדפים העצמאיים → הכתובת של Invest');
ok(/const ENV_APPS = typeof window !== 'undefined' && window\.SNB_ENV && window\.SNB_ENV\.apps;/.test(read('shell.js')), 'shell.js לוקח את הכתובות מ־firebase-config.js');

// ---------- functions/index.js: השורש של כל כתובת
(async () => {
  const src = read('functions/index.js').replace(/export function/g, 'function') + '\nmodule.exports = { rootPage, onRequest };';
  const mod = { exports: {} };
  vm.runInNewContext(src, { module: mod, URL, Request });
  const F = mod.exports;
  ok(F.rootPage('academy-staging.thesnowball.app') === '/academy' && F.rootPage('studio.thesnowball.app') === '/studio'
    && F.rootPage('invest-staging.thesnowball.app') === '' && F.rootPage('staging.thesnowball.app') === '' && F.rootPage('academy.staging.thesnowball.app') === '', 'השורש: academy/studio → הדף שלהן, כל השאר → index.html');
  const seen = [];
  const env = { ASSETS: { fetch: async (r) => { seen.push(r.url); return 'asset'; } } };
  const next = async () => 'next';
  ok(await F.onRequest({ request: new Request('https://academy-staging.thesnowball.app/?v=abc'), env, next }) === 'asset'
    && seen[0] === 'https://academy-staging.thesnowball.app/academy?v=abc', 'academy-staging/ → ‎/academy באותה כתובת, עם ה־query');
  ok(await F.onRequest({ request: new Request('https://invest-staging.thesnowball.app/'), env, next }) === 'next'
    && await F.onRequest({ request: new Request('https://studio.thesnowball.app/', { method: 'POST' }), env, next }) === 'next', 'Invest ובקשה שאינה GET → כרגיל');

  // ---------- sw.js: ההתקנה בכתובת של Academy (‏'/' שם = academy.html — הטביעה נבדקת מול הדף הזה)
  const sw = read('sw.js');
  const HASHES = JSON.parse('{' + /const HASHES = \{([\s\S]*?)\};/.exec(sw)[1].replace(/,\s*$/, '') + '}');
  async function installAt(host) {
    const store = new Map(); const listeners = {};
    const keyOf = (k) => new URL(typeof k === 'string' ? k : k.url, 'https://' + host + '/sw.js').pathname;
    const caches = {
      open: async () => ({ put: async (k, r) => { store.set(keyOf(k), r); } }),
      match: async (k) => store.get(keyOf(k)), keys: async () => [], delete: async () => true,
    };
    const fetchFn = async (req) => {
      const u = new URL(req.url);
      let rel = u.pathname.slice(1);
      if (rel === 'index.html') rel = '';   // כמו Cloudflare Pages: ‎/index.html → 308 לשורש (fetch עוקב), ובשורש של כתובת אפליקציה — הדף שלה (13/10/2026: בלי זה הבדיקה לא תפסה שכל עדכון שם נכשל)
      if (rel === '') rel = host.startsWith('academy') ? 'academy.html' : host.startsWith('studio') ? 'studio.html' : 'index.html';   // functions/index.js
      const f = path.join(root, rel);
      return fs.existsSync(f) ? new Response(fs.readFileSync(f), { status: 200 }) : new Response('', { status: 404 });
    };
    const self = { addEventListener: (k, f) => { listeners[k] = f; }, skipWaiting: async () => {}, clients: { claim: async () => {} }, location: { origin: 'https://' + host, hostname: host }, registration: { scope: 'https://' + host + '/' } };
    const Req = class extends Request { constructor(u, o) { super(new URL(u, 'https://' + host + '/sw.js'), o); } };
    vm.runInContext(sw, vm.createContext({ self, caches, fetch: fetchFn, Request: Req, Response, URL, crypto: globalThis.crypto, console, setTimeout, clearTimeout }));
    let p; listeners.install({ waitUntil: (x) => { p = x; } }); await p;
    return store;
  }
  const crypto = require('crypto');
  const h = async (r) => crypto.createHash('sha256').update(Buffer.from(await r.clone().arrayBuffer())).digest('hex').slice(0, 32);
  const a = await installAt('academy-staging.thesnowball.app');
  ok(await h(a.get('/')) === HASHES['./academy.html'], 'academy-staging: ההתקנה מצליחה, ו־"./" במטמון = academy.html');
  const s = await installAt('studio.thesnowball.app');
  ok(await h(s.get('/')) === HASHES['./studio.html'], 'studio: "./" במטמון = studio.html');
  const i = await installAt('invest-staging.thesnowball.app');
  ok(await h(i.get('/')) === HASHES['./index.html'], 'invest ושאר הכתובות: "./" = index.html כמו קודם');
  ok(!a.has('/index.html') && !s.has('/index.html') && await h(i.get('/index.html')) === HASHES['./index.html'], 'כתובת אפליקציה: בלי index.html במטמון (מופנה לשורש = דף האפליקציה); ב־Invest — כן');

  // ---------- השרתון: הכתובות של הניסוי מותרות, ורק הן
  const ib = read('ibkr-proxy/lib/ibkr.js');
  const RE = new Function('return ' + /const STAGING_ORIGIN_RE = (\/.*\/);/.exec(ib)[1])();
  ok(['https://invest-staging.thesnowball.app', 'https://academy-staging.thesnowball.app', 'https://studio-staging.thesnowball.app', 'https://account-staging.thesnowball.app', 'https://staging.thesnowball.app'].every((o) => RE.test(o)), 'השרתון: הכתובות של כל אפליקציה בניסוי מותרות');
  ok(!['https://academy.staging.thesnowball.app', 'https://evil-staging.thesnowball.app', 'https://academy-staging.thesnowball.app.evil.com', 'http://academy-staging.thesnowball.app'].some((o) => RE.test(o)), 'השרתון: שמות אחרים נחסמים');

  console.log('# ' + n + ' בדיקות עברו');
})().catch((e) => { console.error(e); process.exit(1); });
