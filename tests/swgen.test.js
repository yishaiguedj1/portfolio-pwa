// פס פריסה אחד (12/10/2026): sw.js נגזר מהקבצים (tools/swgen.js), וההתקנה בטלפון מאמתת כל קובץ.
// הבדיקה הזו היא מה שמחליף את פרוטוקול "שני PR": שכחת להריץ swgen = CI אדום, וקובץ ישן מה־CDN = התקנה שנכשלת.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const SG = require('../tools/swgen.js');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel));
const swSrc = read('sw.js').toString('utf8');
let n = 0;
async function t(name, fn) { await fn(); n++; console.log('✓ ' + name); }

// SW בתוך vm עם fetch/caches מדומים. serve(path) → Buffer או null (404)
function loadSw(serve, { libUsed = false } = {}) {
  const listeners = {};
  const store = new Map();        // שם מטמון → Map(מפתח → Response)
  const fetched = [];
  let skipped = 0;
  const keyOf = (k) => new URL(typeof k === 'string' ? k : k.url, 'https://x.test/app/sw.js').pathname;
  const caches = {
    open: async (name) => {
      if (!store.has(name)) store.set(name, new Map());
      const m = store.get(name);
      return { put: async (k, r) => { m.set(keyOf(k), r); }, match: async (k) => m.get(keyOf(k)) };
    },
    match: async (k) => {
      if (libUsed && keyOf(k) === '/app/library.js') return new Response('old');
      for (const m of store.values()) if (m.has(keyOf(k))) return m.get(keyOf(k));
      return undefined;
    },
    keys: async () => [...store.keys()],
    delete: async (name) => store.delete(name),
  };
  const fetchFn = async (req) => {
    const u = new URL(req.url, 'https://x.test/app/sw.js');
    fetched.push({ url: u.pathname + u.search, cache: req.cache });
    const rel = u.pathname === '/app/' ? 'index.html' : u.pathname.replace('/app/', '');
    const body = serve(rel);
    return body ? new Response(body, { status: 200, headers: { 'Content-Type': 'text/plain' } }) : new Response('', { status: 404 });
  };
  const self = {
    addEventListener: (k, f) => { listeners[k] = f; },
    skipWaiting: async () => { skipped++; },
    clients: { claim: async () => {} },
    location: { origin: 'https://x.test' },
    registration: {},
  };
  const Req = class extends Request { constructor(u, o) { super(new URL(u, 'https://x.test/app/sw.js'), o); } };
  const ctx = vm.createContext({ self, caches, fetch: fetchFn, Request: Req, Response, URL, crypto: globalThis.crypto, console, setTimeout, clearTimeout, MessageChannel });
  vm.runInContext(swSrc, ctx);
  const install = async () => {
    let p;
    listeners.install({ waitUntil: (x) => { p = x; } });
    return p;
  };
  return { install, store, fetched, skipped: () => skipped };
}
const disk = (rel) => { try { return read(rel); } catch (e) { return null; } };

(async () => {
  await t('sw.js מעודכן לקבצים (אחרת: node tools/swgen.js)', () => {
    const r = SG.build(read);
    assert.ok(!r.changed, 'sw.js לא מעודכן — להריץ node tools/swgen.js');
  });

  await t('CACHE_NAME = APP_VERSION, ולכל קובץ במעטפות טביעה', () => {
    const h = SG.readHashes(swSrc);
    const app = read('app.js').toString('utf8').match(/const APP_VERSION = '(v\d+)'/)[1];
    assert.strictEqual(h.version, app);
    const paths = SG.shellPaths(swSrc);
    assert.deepStrictEqual(Object.keys(h.hashes).sort(), [...paths].sort());
    for (const p of paths) assert.ok(fs.existsSync(path.join(ROOT, SG.fileOf(p))), 'קובץ חסר: ' + p);
    assert.ok(paths.includes('./app.js') && paths.includes('./library.js') && paths.includes('./studio.js'));
  });

  await t('swgen: שינוי בבייט אחד בקובץ = טביעה אחרת, sw.js "לא מעודכן"', () => {
    const r = SG.build((rel) => (rel === 'styles.css' ? Buffer.concat([read(rel), Buffer.from(' ')]) : read(rel)));
    assert.ok(r.changed);
    assert.notStrictEqual(r.hashes['./styles.css'], SG.readHashes(swSrc).hashes['./styles.css']);
  });

  await t('swgen: הגרסה נלקחת מ־app.js (מקום אחד)', () => {
    const r = SG.build((rel) => (rel === 'app.js' ? Buffer.from(read(rel).toString('utf8').replace(/const APP_VERSION = 'v\d+'/, "const APP_VERSION = 'v9999'")) : read(rel)));
    assert.ok(/const CACHE_NAME = 'portfolio-pwa-v9999';/.test(r.text));
  });

  await t('התקנה: כל הקבצים תואמים — נכנסים למטמון, ‎?v=<טביעה>, בלי מטמון הדפדפן', async () => {
    const s = loadSw(disk);
    await s.install();
    const ver = SG.readHashes(swSrc).version;
    const m = s.store.get('portfolio-pwa-' + ver);
    assert.ok(m && m.has('/app/app.js') && m.has('/app/index.html') && m.has('/app/'), 'המעטפת במטמון');
    const a = s.fetched.find((f) => f.url.startsWith('/app/app.js'));
    assert.ok(/\?v=[0-9a-f]{12}$/.test(a.url) && a.cache === 'reload');
    assert.ok(!m.has('/app/library.js'), 'הספרייה רק אצל מי שנכנס אליה');
    assert.strictEqual(s.skipped(), 1);
    assert.strictEqual(await m.get('/app/app.js').text(), read('app.js').toString('utf8'));
  });

  await t('התקנה: קובץ ישן מה־CDN (הרעלה) — ההתקנה נכשלת, שום דבר לא נשמר', async () => {
    const s = loadSw((rel) => (rel === 'app.js' ? Buffer.from('// הגרסה הקודמת\n') : disk(rel)));
    await assert.rejects(s.install(), /stale/);
    assert.strictEqual(s.store.size, 0, 'לא נוצר מטמון חדש');
    assert.strictEqual(s.skipped(), 0, 'לא מחליף את הגרסה הקודמת');
  });

  await t('התקנה: קובץ חסר (404) — נכשלת', async () => {
    const s = loadSw((rel) => (rel === 'styles.css' ? null : disk(rel)));
    await assert.rejects(s.install(), /http 404/);
    assert.strictEqual(s.skipped(), 0);
  });

  await t('התקנה: הספרייה בשימוש — נטענת; קובץ ספרייה ישן לא נשמר ולא מפיל', async () => {
    const s = loadSw((rel) => (rel === 'pagecurl.js' ? Buffer.from('old') : disk(rel)), { libUsed: true });
    await s.install();
    const m = s.store.get('portfolio-pwa-' + SG.readHashes(swSrc).version);
    assert.ok(m.has('/app/library.js') && m.has('/app/epubkit.js'));
    assert.ok(!m.has('/app/pagecurl.js'));
    assert.strictEqual(s.skipped(), 1);
  });

  await t('אימות חי (--live): תואם / קובץ חי שונה', async () => {
    const mk = (bad) => async (url) => {
      const u = new URL(url);
      let rel = u.pathname.replace(/^\/portfolio-pwa\//, '');
      if (!rel) rel = 'index.html';
      let b = disk(rel);
      if (bad && rel === bad) b = Buffer.from('x');
      return b ? new Response(b) : new Response('', { status: 404 });
    };
    const ok = await SG.live('https://yishaiguedj1.github.io/portfolio-pwa/', mk(null));
    assert.ok(ok.ok, ok.errs.join(' | '));
    const bad = await SG.live('https://yishaiguedj1.github.io/portfolio-pwa', mk('returns.js'));
    assert.ok(!bad.ok && bad.errs.some((e) => /returns\.js/.test(e)));
  });

  await t('הטביעה = SHA-256 (32 תווי hex ראשונים), כמו בדפדפן', () => {
    const want = crypto.createHash('sha256').update(read('app.js')).digest('hex').slice(0, 32);
    assert.strictEqual(SG.readHashes(swSrc).hashes['./app.js'], want);
  });

  console.log(`\n${n} בדיקות עברו`);
})().catch((e) => { console.error('✗', e && e.stack || e); process.exit(1); });
