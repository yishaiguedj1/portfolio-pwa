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
  if (/MEDIA_CAP_RANGE/.test(src)) {   // איכויות הצפייה: קטע של hls.js בטווח מפורש — כולו (לא נחתך ב־4MB)
    r = await run('bytes=1000000-8999999');
    ok(r.status === 206 && r.headers['Content-Range'] === 'bytes 1000000-8999999/10000000' && r.headers['Content-Length'] === '8000000', 'טווח מפורש (קטע של איכות) — כולו, עד 64MB');
  }
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
  if (/function r2Url/.test(src)) {   // R2 (ת4): הדף נותן קישור חתום — ה־SW מבקש ממנו ישירות, בלי Authorization
    const U = 'https://acct123.r2.cloudflarestorage.com/snb/R2_jx/v?X-Amz-Signature=abc';
    replies = [{ u: U, exp: Date.now() + 600e3, size: 10e6, type: 'video/mp4' }];
    r = await run('bytes=0-99', { id: 'R2_jAAAAAAAAAAAAAAAAAAAA_v1' });
    const last = fetched[fetched.length - 1];
    ok(r.status === 206 && last[0] === U && !last[1].headers.Authorization && last[1].headers.Range === 'bytes=0-99' && r.headers['Content-Range'] === 'bytes 0-99/10000000',
      'R2: קישור חתום ישיר עם Range, בלי Authorization; Content-Range מהגודל');
    replies = [{ u: 'https://evil.example/x', size: 10e6 }];
    r = await run('bytes=0-99', { id: 'R2_jBBBBBBBBBBBBBBBBBBBB_v1' });
    ok(r.status === 403, 'R2: רק מארחים של R2 (‎*.r2.cloudflarestorage.com) — אחר נדחה');
    replies = [{ u: 'http://acct123.r2.cloudflarestorage.com/x', size: 10e6 }];
    r = await run('bytes=0-99', { id: 'R2_jCCCCCCCCCCCCCCCCCCCC_v1' });
    ok(r.status === 403, 'R2: רק https');
  }
  let other;
  listeners.fetch({ request: { method: 'GET', url: 'https://evil.test/studio-media/' + ID, headers: { get: () => null } }, clientId: 'c1', respondWith: (x) => { other = x; } });
  ok(other === undefined, 'מקור אחר — לא עובר בפרוקסי');
  ok(!/cache\.put\([^)]*studio-media/.test(src) && /if \(mm\) \{ event\.respondWith\(mediaFetch\(event, mm\[1\]\)\); return; \}/.test(src), 'הפרוקסי לפני המטמון — מדיה לעולם לא נשמרת');
  console.log(`\n${n} בדיקות עברו`);
})().catch((e) => { console.error(e); process.exit(1); });
