// 18/11/2026 (בקשת המשתמש: "הסרטון לא מתחיל לעבוד, אחרי שעושים play לא קורה כלום" — ניגון פריט מהספרייה ב־Drive):
// 1. sw.js: בקשת Drive מה־SW שנכשלה / לא ענתה — הדף מביא את הטווח (askBytes), ומאז לאותו קובץ ישר דרך הדף; נכשל גם שם — מפסק קצר.
// 2. studionet: המענה לבקשת הבתים, הסיבה (mediaWhy), גישה חדשה ל־Drive לא יותר מפעם ב־30 שניות.
// 3. studioplay: החלופי לא נכנס ללולאה (דגל, לא השוואת כתובת מלאה ליחסית), ושעון לטעינה שלא מתקדמת.
// 4. studio.js: דף הפריט מציג את השגיאה, הסיבה, "לנסות שוב" ו"צפייה ב־Drive".
// הרצה: node tests/studio-lib-play.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }

(async () => {
  /* ---------- 1. ה־SW ---------- */
  const sw = read('sw.js');
  const listeners = {}, fetched = [], asked = [];
  let replies = [], fetchMode = 'ok';
  let lastCh = null;
  const sandbox = {
    self: { addEventListener: (t, f) => { listeners[t] = f; }, location: { origin: 'https://x.test', hostname: 'x.test' }, skipWaiting() {},
      clients: { get: async () => ({ postMessage: (m) => { asked.push(m); const rep = replies.shift(); const ch = lastCh; setTimeout(() => ch.port1.onmessage({ data: rep }), 0); } }) } },
    caches: { open: async () => ({ addAll: async () => {}, match: async () => null, put: async () => {} }), keys: async () => [], match: async () => null },
    fetch: async (u, o) => { fetched.push([u, o]); if (fetchMode === 'throw') throw new TypeError('Failed to fetch'); return { status: fetchMode === '500' ? 500 : 206, body: 'B' }; },
    Response: class { constructor(b, o) { this.body = b; Object.assign(this, o || {}); } },
    Headers: Map, URL, setTimeout, clearTimeout, Date, Math, Number, String, console, Promise,
    MessageChannel: class { constructor() { lastCh = this; this.port1 = {}; this.port2 = {}; } },
  };
  vm.createContext(sandbox);
  vm.runInContext(sw, sandbox);
  const run = (id, range) => {
    let p;
    listeners.fetch({ request: { method: 'GET', url: 'https://x.test/studio-media/' + id, headers: { get: (k) => (k === 'range' ? range : null) } }, clientId: 'c1', respondWith: (x) => { p = x; } });
    return p;
  };
  const TOK = { t: 'TOKEN_abcdefghij', exp: Date.now() + 3600e3, size: 10e6, type: 'video/mp4' };

  fetchMode = 'throw'; replies = [TOK, { buf: new ArrayBuffer(100) }];
  let r = await run('relayAAAAAAAAAA', 'bytes=0-99');
  ok(r.status === 206 && r.body.byteLength === 100 && r.headers['Content-Range'] === 'bytes 0-99/10000000' && r.headers['Content-Length'] === '100' && r.headers['Content-Type'] === 'video/mp4',
    'בקשת ה־SW ל־Drive נכשלה — הבתים מהדף: 206 עם Content-Range לפי מה שהגיע');
  ok(asked.length === 2 && asked[1].snbBytes === 'relayAAAAAAAAAA' && asked[1].a === 0 && asked[1].b === 99, 'הדף נשאל על הטווח המדויק (snbBytes)');
  const f0 = fetched.length;
  replies = [{ buf: new ArrayBuffer(50) }];
  r = await run('relayAAAAAAAAAA', 'bytes=100-149');
  ok(r.status === 206 && fetched.length === f0 && asked[asked.length - 1].snbBytes && r.headers['Content-Range'] === 'bytes 100-149/10000000', 'אחרי כישלון — אותו קובץ ישר דרך הדף, בלי עוד בקשה מה־SW');
  replies = [{ buf: new ArrayBuffer(10) }];
  await run('relayAAAAAAAAAA', null);
  ok(asked[asked.length - 1].a === 0 && asked[asked.length - 1].b === 4 * 1048576 - 1, 'בקשה פתוחה דרך הדף — עד 4MB (כמו מה־SW)');
  replies = [{ buf: new ArrayBuffer(10) }];
  await run('relayAAAAAAAAAA', 'bytes=0-9000000');
  ok(asked[asked.length - 1].b === 8 * 1048576 - 1, 'טווח מפורש דרך הדף — עד 8MB (העברה בזיכרון)');
  replies = [{ buf: new ArrayBuffer(500) }];
  r = await run('relayAAAAAAAAAA', 'bytes=0-99');
  ok(r.status === 502, 'הדף החזיר יותר בתים ממה שביקשנו — נדחה');

  fetchMode = '500'; replies = [TOK, {}];
  const a0 = asked.length;
  r = await run('badBBBBBBBBBBBB', 'bytes=0-99');
  ok(r.status === 502 && asked.length === a0 + 2 && asked[a0 + 1].snbBytes === 'badBBBBBBBBBBBB', 'תשובה לא צפויה מ־Drive — ניסיון דרך הדף; נכשל גם שם = 502');
  const a1 = asked.length, f1 = fetched.length;
  r = await run('badBBBBBBBBBBBB', 'bytes=0-99');
  ok(r.status === 502 && asked.length === a1 && fetched.length === f1, 'מפסק: הדפדפן מנסה שוב מיד — 502 בלי לשאול את הדף ובלי בקשה ל־Drive');

  fetchMode = '500'; replies = [{ u: 'https://acct1.r2.cloudflarestorage.com/snb/x?X-Amz-Signature=a', exp: Date.now() + 600e3, size: 10e6, type: 'video/mp4' }];
  const a2 = asked.length;
  r = await run('R2_jAAAAAAAAAAAAAAAAAAAA_v1', 'bytes=0-99');
  ok(r.status === 502 && asked.length === a2 + 1 && !asked.slice(a2).some((m) => m.snbBytes), 'R2 — בלי מסלול הדף (הקישור החתום, כמו קודם)');
  ok(/const MEDIA_WAIT = 20000;/.test(sw) && /setTimeout\(\(\) => ac\.abort\(\), MEDIA_WAIT\)/.test(sw) && /signal: ac \? ac\.signal : undefined/.test(sw),
    'בקשת ה־SW ל־Drive שלא ענתה תוך 20 שניות — מבוטלת ועוברת לדף');

  /* ---------- 2. הדף ---------- */
  const N = await import(path.join(root, 'studionet.js'));
  let listener = null, driveCalls = 0, driveMode = 206;
  const ranges = [];
  const net = N.createNet({ sw: { controller: {}, addEventListener: (t, f) => { listener = f; } }, idToken: async () => 'ID', base: () => 'https://p.test',
    sleep: async () => {},
    fetch: async (u, o) => {
      if (/googleapis\.com\/drive/.test(u)) {
        ranges.push(o && o.headers && o.headers.Range);
        if (driveMode === 'net') throw new TypeError('Failed to fetch');
        if (driveMode !== 206) return { status: driveMode, ok: false, json: async () => ({ error: { errors: [{ reason: 'downloadQuotaExceeded' }] } }) };
        return { status: 206, ok: true, arrayBuffer: async () => new ArrayBuffer(100) };
      }
      const b = JSON.parse((o && o.body) || '{}');
      if (b.op === 'drive') driveCalls++;
      return { ok: true, status: 200, json: async () => ({ ok: true, token: 'TOK' + driveCalls, exp: Date.now() + 3600e3 }) };
    } });
  const ask = (d) => new Promise((res) => listener({ data: d, ports: [{ postMessage: (m, tr) => res({ m, tr }) }] }));
  ok(net.mediaUrl('fileCCCCCCCCCCCC') === N.MEDIA_PATH + 'fileCCCCCCCCCCCC' && typeof listener === 'function', 'mediaUrl מחבר את המאזין');
  let x = await ask({ snbBytes: 'fileCCCCCCCCCCCC', a: 0, b: 99 });
  ok(x.m.buf && x.m.buf.byteLength === 100 && x.tr && x.tr[0] === x.m.buf && ranges[ranges.length - 1] === 'bytes=0-99', 'בקשת בתים מה־SW — הדף מביא את הטווח ומעביר את ה־ArrayBuffer (בלי העתקה)');
  x = await ask({ snbBytes: 'otherDDDDDDDDDDD', a: 0, b: 99 });
  ok(!x.m.buf, 'קובץ שהדף לא ביקש — בלי בתים');
  x = await ask({ snbBytes: 'fileCCCCCCCCCCCC', a: 0, b: 9 * 1048576 });
  ok(!x.m.buf, 'טווח גדול מ־8MB — נדחה');
  driveMode = 403;
  x = await ask({ snbBytes: 'fileCCCCCCCCCCCC', a: 0, b: 99 });
  ok(!x.m.buf && net.mediaWhy('fileCCCCCCCCCCCC') === 'drive 403 · downloadQuotaExceeded', 'Drive סירב — הסיבה נשמרת (mediaWhy) עם הקוד של Google');
  const rn = ranges.length;
  x = await ask({ snbBytes: 'fileCCCCCCCCCCCC', a: 0, b: 99 });
  ok(!x.m.buf && ranges.length === rn, 'נכשל לפני רגע — בלי עוד בקשה ל־Drive (הדפדפן מנסה שוב ושוב)');
  net.mediaUrl('fileCCCCCCCCCCCC');
  ok(net.mediaWhy('fileCCCCCCCCCCCC') === '', 'ניסיון חדש (mediaUrl) — הסיבה הישנה נמחקת');
  driveMode = 'net';
  net.mediaUrl('fileEEEEEEEEEEEE');
  x = await ask({ snbBytes: 'fileEEEEEEEEEEEE', a: 0, b: 99 });
  ok(!x.m.buf && net.mediaWhy('fileEEEEEEEEEEEE') === 'net', 'שגיאת רשת — net');
  const d0 = driveCalls;
  await net.driveToken(true); await net.driveToken(true);
  await Promise.all([net.driveToken(true), net.driveToken(true)]);
  ok(driveCalls - d0 <= 1, 'גישה חדשה ל־Drive (force) — לא יותר מפעם ב־30 שניות (כל ניסיון חוזר של הנגן ביקש מהשרתון = קריאה ב־Firestore)');

  /* ---------- 3. הנגן ---------- */
  const sp = read('studioplay.js');
  ok(!/&& v\.src\.indexOf\(opts\.fallback\) < 0\)/.test(sp) && /if \(opts\.fallback && !fbOn\) \{[^\n]*\n\s*fbOn = true;/.test(sp) && /fbOn = !opts\.src; v\.src = opts\.src \|\| opts\.fallback/.test(sp),
    'החלופי: דגל במקום השוואת כתובת מלאה ליחסית — חלופי שנכשל מציג שגיאה, לא לולאה');
  ok(/const STALL_MS = 30000;/.test(sp) && /opts\.dead\(v\.currentSrc \|\| v\.src\)/.test(sp) && /if \(v\.readyState < 1\) stallArm\(\);/.test(sp) && /clearTimeout\(stallT\); clearTimeout\(hideT\)/.test(sp),
    'שעון: טעינה שלא מתקדמת אחרי לחיצת ניגון = שגיאה (30 שניות, או מיד כשידוע שהקובץ לא ייטען)');
  ok(/try \{ v\.removeAttribute\('src'\); v\.load\(\); \} catch \(e\) \{\}/.test(sp), 'אחרי השגיאה — בלי ניסיונות חוזרים ברקע');

  /* ---------- 4. דף הפריט ---------- */
  const st = read('studio.js');
  ok(/onError: fail, dead,/.test(st) && /me\.why = \(b && net\.mediaWhy\(b\.id\)\) \|\| \(v && net\.mediaWhy\(v\.id\)\)/.test(st) && /else if \(lp\.st === 'err'\) hero\.append\(lpErr\(it\)\);/.test(st),
    'דף הפריט: הנגן שנכשל מוחלף בהודעה עם הסיבה');
  ok(/btn\('st-lp-a', T\('studioLibRetry'\)/.test(st) && /h\('a', 'st-lp-a', T\('studioPlOpenDrive'\)\)/.test(st) && /w\.dir = 'ltr'/.test(st), 'לנסות שוב + צפייה ב־Drive; הסיבה בכיוון שמאל־לימין');
  const css = read('studio.css');
  ok(/\.st-lp-a \{[^}]*border-radius: var\(--radius-xl\)/.test(css) && /st-lp-a/.test(read('glass-btn.css')), 'עיצוב: עיגול פינות במשתנה, ומסווג בשכבת הזכוכית');

  console.log(`\n${n} בדיקות עברו`);
})().catch((e) => { console.error(e); process.exit(1); });
