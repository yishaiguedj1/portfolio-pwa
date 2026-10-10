// מ1 (10/10/2026): נגן הסטודיו — הפרוקסי ב־sw.js (./studio-media/<id> → Drive בבקשות טווח).
// האסימון מגיע מהדף (MessageChannel) ולא בכתובת; Content-Range נבנה מהגודל; תקרה לבקשה פתוחה; 416; 401 = אסימון חדש פעם אחת.
// רץ ב־vm עם self/clients/fetch מדומים. sw.js בלי המאזין (שלב התוכן בפרוטוקול הדו־שלבי) — דילוג.
// הרצה: node tests/sw-media-studio.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const src = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
if (!/MEDIA_RE/.test(src)) { console.log('sw.js עוד בלי פרוקסי המדיה — דילוג'); process.exit(0); }

const listeners = {}, fetched = [], asked = [];
let replies = [], statuses = [];
let lastCh = null;
const sandbox = {
  self: { addEventListener: (t, f) => { listeners[t] = f; }, location: { origin: 'https://x.test' }, skipWaiting() {},
    clients: { get: async (id) => (id === 'gone' ? null : { postMessage: (m, ports) => { asked.push(m); const rep = replies.shift(); setTimeout(() => lastCh.port1.onmessage({ data: rep }), 0); } }) } },
  caches: { open: async () => ({ addAll: async () => {}, match: async () => null, put: async () => {} }), keys: async () => [], match: async () => null },
  fetch: async (u, o) => { fetched.push([u, o]); return { status: statuses.length ? statuses.shift() : 206, body: 'B' }; },
  Response: class { constructor(b, o) { this.body = b; Object.assign(this, o || {}); } },
  Headers: Map, URL, setTimeout, clearTimeout, Date, Math, Number, String, console, Promise,
  MessageChannel: class { constructor() { lastCh = this; this.port1 = {}; this.port2 = {}; } },
};
vm.createContext(sandbox);
vm.runInContext(src, sandbox);

const ID = 'abcdefghij12';
const run = async (range, opts = {}) => {
  let p;
  listeners.fetch({ request: { method: 'GET', url: 'https://x.test/portfolio-pwa/studio-media/' + (opts.id || ID), headers: { get: (k) => (k === 'range' ? range : null) } },
    clientId: opts.client || 'c1', respondWith: (x) => { p = x; } });
  return p;
};
const TOK = { t: 'TOKEN_abcdefghij', exp: Date.now() + 3600e3, size: 10e6, type: 'video/webm' };

(async () => {
  replies = [TOK];
  let r = await run(null);
  ok(r.status === 206 && r.headers['Content-Range'] === 'bytes 0-4194303/10000000' && r.headers['Content-Length'] === '4194304' && r.headers['Content-Type'] === 'video/webm',
    'בקשה בלי טווח — עד 4MB, Content-Range נבנה מהגודל (לא חשוף בתשובת CORS של Drive)');
  ok(fetched[0][1].headers.Authorization === 'Bearer TOKEN_abcdefghij' && !/access_token|TOKEN/.test(fetched[0][0]) && fetched[0][1].cache === 'no-store',
    'האסימון בכותרת בלבד, לא בכתובת; בלי מטמון');
  ok(asked.length === 1 && asked[0].snbMedia === ID, 'הדף נשאל פעם אחת (MessageChannel)');
  r = await run('bytes=9000000-');
  ok(r.status === 206 && r.headers['Content-Range'] === 'bytes 9000000-9999999/10000000' && asked.length === 1, 'טווח פתוח בסוף הקובץ; האסימון מהזיכרון (בלי לשאול שוב)');
  r = await run('bytes=20000000-');
  ok(r.status === 416 && r.headers['Content-Range'] === 'bytes */10000000', 'טווח מחוץ לקובץ = 416');
  r = await run('bytes=-100');
  ok(r.status === 206 && r.headers['Content-Range'] === 'bytes 9999900-9999999/10000000', 'סיומת (bytes=-N)');
  r = await run('bytes=x');
  ok(r.status === 416, 'טווח לא תקין = 416');
  statuses = [401, 206]; replies = [Object.assign({}, TOK, { t: 'TOKEN_new_abcdefgh' })];
  r = await run('bytes=0-99');
  ok(r.status === 206 && fetched[fetched.length - 1][1].headers.Authorization === 'Bearer TOKEN_new_abcdefgh' && asked[asked.length - 1].fresh === true, 'אסימון שפג (401) — פעם אחת אסימון חדש מהדף');
  statuses = [500];
  r = await run('bytes=0-99');
  ok(r.status === 502, 'תשובה לא צפויה מ־Drive = 502 (לא מעבירים גוף שגיאה לנגן)');
  replies = [{ t: '' }];
  r = await run(null, { id: 'zzzzzzzzzzzz' });
  ok(r.status === 403, 'הדף לא נתן אסימון (קובץ שלא ביקש) — 403');
  r = await run(null, { id: 'yyyyyyyyyyyy', client: 'gone' });
  ok(r.status === 403, 'בלי דף שמנגן — 403');
  replies = [{ t: 'bad token with spaces', size: 5 }];
  r = await run(null, { id: 'xxxxxxxxxxxx' });
  ok(r.status === 403, 'אסימון בצורה לא תקינה — נדחה');
  let other;
  listeners.fetch({ request: { method: 'GET', url: 'https://evil.test/studio-media/' + ID, headers: { get: () => null } }, clientId: 'c1', respondWith: (x) => { other = x; } });
  ok(other === undefined, 'מקור אחר — לא עובר בפרוקסי');
  ok(!/cache\.put\([^)]*studio-media/.test(src) && /if \(mm\) \{ event\.respondWith\(mediaFetch\(event, mm\[1\]\)\); return; \}/.test(src), 'הפרוקסי לפני המטמון — מדיה לעולם לא נשמרת');
  console.log(`\n${n} בדיקות עברו`);
})().catch((e) => { console.error(e); process.exit(1); });
