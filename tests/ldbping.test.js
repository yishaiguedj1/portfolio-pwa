// ldbping.test.js — 8/11/2026: שלב 3 בתוכנית העצמאות מ־Firebase — איחוד לפי אירוע (ibkr-proxy/lib/ldbping.js).
// 1. החתימה: הודעה חתומה עוברת; חתימה שגויה, מפתח/פרויקט אחר, הודעה ישנה/עתידית, שידור חוזר, גוף משובש — נדחים.
// 2. המקבל (POST /api/ldbping): 202 + איחוד; 401 אחיד; הגבלת קצב; בלי מפתח; מונים בסטטוס (בלי תוכן).
// 3. ldbsync: כמה הודעות ברצף = איחוד אחד; הודעה בזמן איחוד = עוד אחד; בלי הודעות — איחוד רק בעלייה ופעם בשעה (24 שעות מדומות).
// 4. השולח: Vercel (stampFetch) מודיע רק אחרי רשומה מוצלחת ביומן, וממשיך לכתוב כשההודעה נכשלה / נתקעת / זורקת; הפסקה אחרי תקלה.
// 5. החיבורים: SERVER_ONLY, server-provision, הכתובת לפי הפרויקט. mocks בלבד.
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const root = path.join(__dirname, '..');
let n = 0;
function ok(cond, name) { n++; if (!cond) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

const PG = require(root + '/ibkr-proxy/lib/ldbping.js');
const LS = require(root + '/ibkr-proxy/lib/ldbsync.js');
const C = require(root + '/ibkr-proxy/lib/ldbchg.js');

const K = crypto.randomBytes(32), K2 = crypto.randomBytes(32), P = 'p1';
function mkRes() {
  const r = { code: 0, body: null, h: {} };
  r.setHeader = (k, v) => { r.h[k.toLowerCase()] = v; };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
}

(async () => {
  // ---------------------------------------------------------------- 1. החתימה
  let clock = 1_800_000_000_000;
  const now = () => clock;
  PG._reset();
  const m = PG.make(K, P, clock);
  ok(m.v === 1 && m.t === clock && /^[A-Za-z0-9_-]{24}$/.test(m.n) && /^[0-9a-f]{64}$/.test(m.s) && Object.keys(m).length === 4, 'ההודעה: v, t, n, s בלבד — בלי תוכן ובלי מזהים');
  ok(PG.check(m, K, P, clock) === '', 'הודעה חתומה — עוברת');
  ok(PG.check(m, K, P, clock) === 'replay', 'אותה הודעה שוב — שידור חוזר, נדחית');
  ok(PG.check(PG.make(K2, P, clock), K, P, clock) === 'sig', 'מפתח אחר — חתימה שגויה');
  ok(PG.check(PG.make(K, 'other', clock), K, P, clock) === 'sig', 'פרויקט אחר (ניסוי מול ייצור) — חתימה שגויה');
  const bad = Object.assign({}, PG.make(K, P, clock)); bad.s = (bad.s[0] === 'a' ? 'b' : 'a') + bad.s.slice(1);
  ok(PG.check(bad, K, P, clock) === 'sig', 'חתימה ששונתה בתו אחד — נדחית');
  const moved = Object.assign({}, PG.make(K, P, clock), { t: clock + 1 });
  ok(PG.check(moved, K, P, clock) === 'sig', 'זמן ששונה אחרי החתימה — נדחה (הזמן בתוך החתימה)');
  ok(PG.check(PG.make(K, P, clock - PG.WIN_MS - 1), K, P, clock) === 'old', 'הודעה ישנה (מעבר לחלון של דקה) — נדחית');
  ok(PG.check(PG.make(K, P, clock + PG.WIN_MS + 1), K, P, clock) === 'old', 'הודעה "מהעתיד" — נדחית');
  ok(PG.check(PG.make(K, P, clock - PG.WIN_MS + 1000), K, P, clock) === '', 'בתוך החלון (שעון של Vercel מעט מאחור) — עוברת');
  for (const b of [null, {}, 'x', { v: 2, t: clock, n: 'a'.repeat(20), s: 'a'.repeat(64) }, { v: 1, t: String(clock), n: 'a'.repeat(20), s: 'a'.repeat(64) },
    { v: 1, t: clock, n: 'short', s: 'a'.repeat(64) }, { v: 1, t: clock, n: 'a'.repeat(20), s: 'A'.repeat(64) }, { v: 1, t: clock, n: 'a/'.repeat(10), s: 'a'.repeat(64) }])
    ok(PG.check(b, K, P, clock) === 'form', 'גוף משובש — נדחה לפני ה־HMAC: ' + JSON.stringify(b).slice(0, 40));
  const src = read('ibkr-proxy/lib/ldbping.js');
  ok(/crypto\.timingSafeEqual\(want, got\)/.test(src) && !/b\.s === |=== b\.s/.test(src), 'השוואת החתימה בזמן קבוע (timingSafeEqual), לא ===');
  ok(/derive\(LABEL\)/.test(src) && PG.LABEL === 'snb-ldb-ping/v1', 'המפתח: vault.derive עם תווית משלו (snb-ldb-ping/v1)');
  // הזיכרון של ה־nonce מתנקה
  clock += 3 * PG.WIN_MS;
  ok(PG.check(m, K, P, clock) === 'old', 'nonce ישן נשכח — וההודעה הישנה נדחית לפי הזמן');

  // ---------------------------------------------------------------- 2. המקבל
  PG._reset();
  let kicks = 0;
  const H = PG.makeHandler({ now, key: K, project: P, kick: () => { kicks++; } });
  const req = (body, ip = '1.1.1.1', method = 'POST') => ({ method, headers: { 'x-forwarded-for': ip }, body });
  let r = mkRes(); await H(req(PG.make(K, P, clock)), r);
  ok(r.code === 202 && r.body.ok === true && kicks === 1 && r.h['cache-control'] === 'no-store', 'הודעה חתומה → 202 ובקשת איחוד');
  const once = PG.make(K, P, clock);
  r = mkRes(); await H(req(once), r);
  r = mkRes(); await H(req(once), r);
  ok(r.code === 401 && kicks === 2, 'שידור חוזר → 401, בלי איחוד');
  r = mkRes(); await H(req(PG.make(K2, P, clock)), r);
  ok(r.code === 401 && kicks === 2 && JSON.stringify(r.body) === '{"ok":false}', 'חתימה שגויה → 401 אחיד (בלי לגלות למה), בלי איחוד');
  r = mkRes(); await H(req(PG.make(K, P, clock - 5 * 60e3)), r);
  ok(r.code === 401 && kicks === 2, 'הודעה ישנה → 401, בלי איחוד');
  r = mkRes(); await H(req(null, '1.1.1.1', 'GET'), r);
  ok(r.code === 405, 'GET → 405');
  r = mkRes(); await H(req({ v: 1, t: clock, n: 'a'.repeat(20), s: 'a'.repeat(64), pad: 'x'.repeat(600) }), r);
  ok(r.code === 413 && kicks === 2, 'גוף גדול → 413');
  r = mkRes(); await PG.makeHandler({ now, key: null, project: P, kick: () => { kicks++; } })(req(PG.make(K, P, clock), '2.2.2.2'), r);
  ok(r.code === 503 && kicks === 2, 'בלי מפתח (אין כספת) → 503, בלי איחוד');
  // קצב: לכתובת
  PG._reset();
  let codes = [];
  for (let i = 0; i < PG.IP_MAX + 3; i++) { r = mkRes(); await H(req(PG.make(K2, P, clock), '3.3.3.3'), r); codes.push(r.code); }
  ok(codes.slice(0, PG.IP_MAX).every((c) => c === 401) && codes.slice(PG.IP_MAX).every((c) => c === 429), 'הגבלת קצב לכתובת: מעל ' + PG.IP_MAX + ' בדקה → 429 (לפני ה־HMAC)');
  r = mkRes(); await H(req(PG.make(K, P, clock), '4.4.4.4'), r);
  ok(r.code === 202, 'כתובת אחרת לא נחסמת בגלל הראשונה');
  clock += 61e3;
  r = mkRes(); await H(req(PG.make(K, P, clock), '3.3.3.3'), r);
  ok(r.code === 202, 'אחרי דקה — הכתובת חוזרת');
  // קצב: בסך הכל
  PG._reset();
  codes = [];
  for (let i = 0; i < PG.ALL_MAX + 2; i++) { r = mkRes(); await H(req(PG.make(K2, P, clock), '10.0.' + (i >> 8) + '.' + (i & 255)), r); codes.push(r.code); }
  ok(codes.filter((c) => c === 429).length === 2, 'הגבלת קצב כוללת: מעל ' + PG.ALL_MAX + ' בדקה מכל הכתובות → 429');
  clock += 61e3;
  // מונים
  PG._reset();
  r = mkRes(); await H(req(PG.make(K, P, clock)), r);
  r = mkRes(); await H(req(PG.make(K2, P, clock)), r);
  r = mkRes(); await H(req(PG.make(K, P, clock - 3600e3)), r);
  const v = PG.view();
  ok(v.ok === 1 && v.no === 2 && v.why.sig === 1 && v.why.old === 1 && v.at === new Date(clock).toISOString(), 'מונים: התקבלו / נדחו לפי סיבה');
  ok(!/[0-9a-f]{64}|[A-Za-z0-9_-]{24}/.test(JSON.stringify(v)), 'במונים אין חתימות, nonce או תוכן');

  // ---------------------------------------------------------------- 3. ldbsync: לפי אירוע
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ldbping-'));
  let q = 0, hold = null;
  const remote = async (url, init) => {
    const u = String(url);
    if (/:runQuery$/.test(u) && /snbChg/.test(String(init && init.body))) { q++; if (hold) await hold; return { status: 200, json: async () => [] }; }
    if (/:listCollectionIds$/.test(u)) return { status: 200, json: async () => ({ collectionIds: [] }) };
    return { status: 200, json: async () => ({}) };
  };
  const timers = [];
  const later = (fn, ms) => { const t = { fn, at: clock + ms }; timers.push(t); return t; };
  const runDue = async () => { for (;;) { const due = timers.filter((t) => t.at <= clock && !t.done); if (!due.length) return; for (const t of due) { t.done = true; await t.fn(); } } };
  const ctl = LS.create({ own: () => true, fetch: remote, env: { SNB_UDATA: 'off' }, project: P, dir: path.join(tmp, 'a'), now, token: async () => 'T', timers: false, later });
  ok(await ctl.start(), 'המסד עולה (בלי R2, תיקייה זמנית)');
  ok(LS.MERGE_MS === 3600e3 && /every\(runMerge, MERGE_MS\)/.test(read('ibkr-proxy/lib/ldbsync.js')), 'רשת הביטחון: איחוד קבוע פעם בשעה (היה כל 2 דק׳)');
  for (let i = 0; i < 5; i++) ok(ctl.kick() === true, 'הודעה ' + (i + 1) + ' — נרשמה');
  ok(timers.length === 1 && q === 0, 'חמש הודעות ברצף — טיימר אחד, עוד אין קריאה');
  clock += LS.KICK_MS; await runDue();
  ok(q === 1 && ctl.status().merge.kicks === 1 && ctl.status().merge.runs === 1, 'אחרי הריכוך — איחוד אחד (קריאה אחת ל־snbChg)');
  // הודעה בזמן איחוד — עוד איחוד אחריו
  let release; hold = new Promise((res) => { release = res; });
  ctl.kick(); clock += LS.KICK_MS;
  const p1 = runDue();
  await new Promise((res) => setImmediate(res));
  ok(q === 2, 'איחוד שני התחיל');
  ctl.kick(); ctl.kick();
  release(); hold = null; await p1;
  clock += LS.KICK_MS; await runDue();
  ok(q === 3, 'הודעות שהגיעו בזמן איחוד → עוד איחוד אחד אחריו (לא שניים)');
  clock += 10 * 60e3; await runDue();
  ok(q === 3, 'בלי הודעות — אין איחוד');
  // הודעה מהמקבל האמיתי (בלי kick מוזרק) מגיעה ל־ctl הזה
  PG._reset();
  r = mkRes(); await PG.makeHandler({ now, key: K, project: P })(req(PG.make(K, P, clock)), r);
  clock += LS.KICK_MS; await runDue();
  ok(r.code === 202 && q === 4, 'POST /api/ldbping → ldbsync.kick() → איחוד');
  ok(ctl.status().ping && ctl.status().ping.ok === 1, 'GET /api/session → ldb.ping: המונים');
  ctl.stop();
  ok(LS.kick() === false, 'אין מסד (נעצר) — kick לא עושה כלום');

  // 24 שעות מדומות בלי הודעות: איחוד רק בעלייה (שניים) ופעם בשעה
  q = 0; timers.length = 0;
  const intervals = [];
  const t0 = clock;
  const day = LS.create({ own: () => true, fetch: remote, env: { SNB_UDATA: 'off' }, project: P, dir: path.join(tmp, 'b'), now, token: async () => 'T', later,
    every: (fn, ms) => { intervals.push({ fn, ms, next: t0 + ms }); } });
  ok(await day.start(), 'מסד שני — עם התזמון (שעון מדומה)');
  for (clock = t0; clock <= t0 + 24 * 3600e3; clock += 1000) {
    await runDue();
    for (const it of intervals) if (clock >= it.next) { it.next += it.ms; await it.fn(); }
  }
  ok(q === 26, 'בלי הודעות, 24 שעות: ' + q + ' קריאות ldb:merge (שתיים בעלייה + 24) — במקום 720');
  day.stop();
  fs.rmSync(tmp, { recursive: true, force: true });

  // ---------------------------------------------------------------- 4. השולח
  const FS = 'https://firestore.googleapis.com/v1/projects/' + P + '/databases/(default)/documents';
  const mkInner = (commitCode) => { const log = []; const f = async (url, init) => { log.push(String(url)); return { status: /:commit$/.test(url) ? commitCode : 200, json: async () => ({}) }; }; f.log = log; return f; };
  const write = (f) => f(FS + '/studioJobs/j1?updateMask.fieldPaths=a', { method: 'PATCH', headers: { Authorization: 'Bearer X' }, body: '{}' });
  let pinged = [];
  let inner = mkInner(200);
  let res = await write(C.stampFetch(inner, now, (p) => { pinged.push(p); return Promise.resolve(true); }));
  ok(res.status === 200 && inner.log.length === 2 && pinged.length === 1 && pinged[0] === P, 'כתיבה → רשומה ביומן → הודעה אחת (רק שם הפרויקט עובר)');
  pinged = []; inner = mkInner(500);
  res = await write(C.stampFetch(inner, now, (p) => { pinged.push(p); return true; }));
  ok(res.status === 200 && pinged.length === 0, 'הרשומה ביומן נכשלה — אין הודעה (אין מה לאחד), והכתיבה עצמה מצליחה');
  pinged = []; inner = mkInner(200);
  await C.stampFetch(inner, now, (p) => { pinged.push(p); })(FS + '/studioJobs/j1', { method: 'GET' });
  await C.stampFetch(inner, now, (p) => { pinged.push(p); })(FS + '/users/u1:foo', { method: 'POST', body: '{}' });
  ok(pinged.length === 0, 'קריאה / כתובת שלא נרשמת ביומן — אין הודעה');
  res = await write(C.stampFetch(mkInner(200), now, () => { throw new Error('boom'); }));
  ok(res.status === 200, 'ההודעה זורקת — Vercel ממשיך לכתוב');
  res = await write(C.stampFetch(mkInner(200), now, () => Promise.reject(new Error('down'))));
  ok(res.status === 200, 'ההודעה נדחית — Vercel ממשיך לכתוב');

  // השולח האמיתי (send): הצלחה, תקלה, נתקע, הפסקה אחרי תקלה, ריכוז
  PG._reset();
  const sent = [];
  let mode = 'ok';
  const hubFetch = (url, init) => {
    sent.push({ url, body: JSON.parse(init.body), signal: init.signal });
    if (mode === 'ok') return Promise.resolve({ status: 202 });
    if (mode === 'err') return Promise.reject(new Error('ECONNREFUSED'));
    return new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(new Error('aborted'))));   // נתקע עד ה־timeout
  };
  ok(await PG.send({ fetch: hubFetch, project: P, key: K, hub: 'https://hub.test', now }) === true, 'send: נשלח ומאושר (202)');
  ok(sent[0].url === 'https://hub.test/api/ldbping' && PG.check(sent[0].body, K, P, clock) === '', 'send: לכתובת הנכונה, וחתום כך שהמקבל מאשר');
  mode = 'hang';
  const t1 = Date.now();
  ok(await PG.send({ fetch: hubFetch, project: P, key: K, hub: 'https://hub.test', now, ms: 80 }) === false && Date.now() - t1 < 1000, 'send: השרת נתקע — מוותרים אחרי הזמן המרבי, בלי לזרוק');
  const before = sent.length;
  mode = 'ok';
  ok(await PG.send({ fetch: hubFetch, project: P, key: K, hub: 'https://hub.test', now }) === false && sent.length === before, 'אחרי תקלה — לא שולחים ' + PG.OPEN_MS / 1000 + ' שנ׳ (לא מעכבים כל כתיבה כשהשרת למטה)');
  clock += PG.OPEN_MS + 1;
  ok(await PG.send({ fetch: hubFetch, project: P, key: K, hub: 'https://hub.test', now }) === true, 'אחרי ההפסקה — שולחים שוב');
  mode = 'err';
  ok(await PG.send({ fetch: hubFetch, project: P, key: K, hub: 'https://hub.test', now }) === false, 'send: שגיאת רשת — false, לא זורק');
  clock += PG.OPEN_MS + 1;
  mode = 'ok';
  const b0 = sent.length;
  const all = await Promise.all([1, 2, 3, 4, 5].map(() => PG.send({ fetch: hubFetch, project: P, key: K, hub: 'https://hub.test', now })));
  ok(all.every((x) => x === true) && sent.length - b0 === 2, 'חמש כתיבות ברצף באותו תהליך — שתי הודעות (אחת בדרך + אחת אחריה)');
  ok(await PG.send({ fetch: hubFetch, project: P, key: null, hub: 'https://hub.test', now }) === false, 'בלי מפתח — לא שולחים');
  ok(await PG.send({ fetch: hubFetch, project: 'unknown', key: K, now, env: {} }) === false, 'פרויקט לא מוכר — אין לאן לשלוח');

  // Vercel עם השולח האמיתי, כשהשרת שלנו למטה: הכתיבה עוברת
  PG._reset();
  const saved = { sa: process.env.GDRIVE_SA_KEY, url: process.env.SNB_LDB_PING_URL };
  process.env.GDRIVE_SA_KEY = JSON.stringify({ client_email: 'x@y', private_key: 'test-only-not-a-key' });
  process.env.SNB_LDB_PING_URL = 'https://hub.test';
  const downLog = [];
  const down = async (url, init) => {
    downLog.push(String(url));
    if (String(url).startsWith('https://hub.test')) throw new Error('ECONNREFUSED');
    return { status: 200, json: async () => ({}) };
  };
  res = await write(C.stampFetch(down, now));
  ok(res.status === 200 && downLog.length === 3 && downLog[2] === 'https://hub.test/api/ldbping', 'Vercel: השרת שלנו למטה — ההודעה נכשלה, והכתיבה + היומן עברו');
  res = await write(C.stampFetch(down, now));
  ok(res.status === 200 && downLog.length === 5, 'כתיבה נוספת מיד אחרי — בלי ניסיון שליחה (הפסקה)');
  if (saved.sa === undefined) delete process.env.GDRIVE_SA_KEY; else process.env.GDRIVE_SA_KEY = saved.sa;
  if (saved.url === undefined) delete process.env.SNB_LDB_PING_URL; else process.env.SNB_LDB_PING_URL = saved.url;

  // ---------------------------------------------------------------- 5. החיבורים
  ok(PG.hubOf('yishaiguedj1-c786e', {}) === 'https://api.thesnowball.app' && PG.hubOf('snowball-staging-758f6', {}) === 'https://api-staging.thesnowball.app', 'הכתובת לפי הפרויקט: ייצור / ניסוי');
  ok(PG.hubOf('yishaiguedj1-c786e', { SNB_LDB_PING_URL: 'off' }) === '' && PG.hubOf('x', { SNB_LDB_PING_URL: 'http://evil' }) === '', 'SNB_LDB_PING_URL=off מכבה; כתובת לא HTTPS — נדחית');
  const server = require(root + '/ibkr-proxy/server.js');
  ok(server.SERVER_ONLY.ldbping === 'lib/ldbping.js' && !fs.existsSync(path.join(root, 'ibkr-proxy/api/ldbping.js')), 'ldbping — רק בשרת (SERVER_ONLY), לא פונקציה ב־Vercel (12 מתוך 12)');
  ok(fs.readdirSync(path.join(root, 'ibkr-proxy/api')).filter((f) => f.endsWith('.js')).length === 12, 'עדיין 12 פונקציות ב־api/');
  const prov = read('tools/server-provision.js');
  ok(/ldbping\.js'\)\)\.send\(\{ fetch: deps\.fetch, project: env\.project, hub: env\.api/.test(prov), 'הקמת שרת: אחרי הרשומה ביומן — הודעה לשרתון של הסביבה (שרת חדש לא מחכה שעה)');
  ok(/require\('\.\/ldbping'\)\.send\(\{ fetch: inner, project \}\)/.test(read('ibkr-proxy/lib/ldbchg.js')), 'Vercel: stampFetch שולח עם ה־fetch הפנימי (לא עובר שוב ביומן)');

  console.log('כל ' + n + ' הבדיקות עברו ✓');
})().catch((e) => { console.error('FAIL -', e && e.stack || e); process.exit(1); });
