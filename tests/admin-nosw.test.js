// 21/10/2026: admin.thesnowball.app פתח את Invest — Service Worker ישן של Invest בכתובת הזו הגיש את index.html מהמטמון.
// בכתובת של מרכז הניהול sw.js לא מתקין מעטפת, לא עונה לבקשות, ומוחק את עצמו ואת המטמון; admin-app.js מסיר כל SW.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; console.log('ok - ' + m); };

function run(host) {
  const L = {}, log = [];
  const self = {
    location: { hostname: host },
    addEventListener: (k, f) => { L[k] = f; },
    skipWaiting: () => log.push('skip'),
    registration: { scope: 'https://' + host + '/', unregister: async () => { log.push('unreg'); return true; } },
    clients: { matchAll: async () => [{ url: 'https://' + host + '/', navigate: async (u) => log.push('nav:' + u) }], claim: async () => log.push('claim') },
  };
  const caches = { keys: async () => ['a', 'b'], delete: async (k) => { log.push('del:' + k); return true; }, open: async () => ({ put: async () => {} }), match: async () => null };
  const ctx = { self, caches, fetch: () => { log.push('fetch'); return Promise.reject(new Error('net')); }, URL, Promise, console, Response: function () {}, Request: function (u) { this.url = u; }, setTimeout, crypto: { subtle: {} }, TextEncoder };
  vm.runInNewContext(sw, ctx);
  return { L, log };
}

(async () => {
  for (const host of ['admin.thesnowball.app', 'admin-staging.thesnowball.app']) {
    const { L, log } = run(host);
    const waits = [];
    L.install({ waitUntil: (p) => waits.push(p) });
    ok(log.includes('skip') && !waits.length && !log.includes('fetch'), host + ': התקנה בלי מעטפת (בלי בדיקת טביעות שהייתה נכשלת)');
    let responded = false;
    L.fetch({ request: { method: 'GET', url: 'https://' + host + '/', mode: 'navigate' }, respondWith: () => { responded = true; } });
    ok(!responded, host + ': לא עונה לבקשות — הכל מהרשת');
    const aw = [];
    L.activate({ waitUntil: (p) => aw.push(p) });
    await Promise.all(aw);
    ok(log.includes('del:a') && log.includes('del:b') && log.includes('unreg') && log.some((x) => x.startsWith('nav:')), host + ': מוחק מטמון, מסיר את עצמו ומרענן את החלון');
  }
  {
    const { L, log } = run('invest.thesnowball.app');
    const waits = [];
    L.install({ waitUntil: (p) => waits.push(p.catch(() => {})) });
    ok(waits.length === 1 && !log.includes('skip'), 'בשאר הכתובות — ההתקנה הרגילה (מעטפת מאומתת)');
  }
  const adm = fs.readFileSync(path.join(__dirname, '..', 'admin-app.js'), 'utf8');
  ok(/getRegistrations\(\)\.then\(\(rs\) => rs\.forEach\(\(r\) => r\.unregister\(\)\)\)/.test(adm), 'admin-app.js מסיר כל Service Worker בכתובת שלו');
  ok(!/serviceWorker\.register\(/.test(adm), 'מרכז הניהול לא רושם Service Worker');
  console.log('\n' + n + ' בדיקות עברו ✓');
})().catch((e) => { console.error(e); process.exit(1); });
