// udata.test.js — 6/11/2026: שלב 4 בתוכנית העצמאות מ־Firebase — התיק והספרייה דרך השרת שלנו.
// 1. נקודת הקצה (ibkr-proxy/lib/udata.js): מקור, אפליקציה, טוקן, שדות אסורים, תקרות, מסכת ה־merge, מחיקה, fb.
// 2. מצב "דרך" במסד (lib/ldbsync.js): קריאה מקומית, כתיבה ל־Firestore וחזרה, Firestore לא זמין, כתיבה ישירה + יומן → איחוד.
// 3. הטלפון (cloud.js → auth.js, library.js): השרת קודם, Firestore כגיבוי, רשומה ביומן רק כשהשרת נפל.
// 4. החיבורים: SERVER_ONLY, appscope, הכללים, המפתח במכשיר.
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
let n = 0;
function ok(cond, name) { n++; if (!cond) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

process.env.FIREBASE_PROJECT_ID = 'p1';
const P = 'p1';
const BASE = 'https://firestore.googleapis.com/v1/projects/' + P + '/databases/(default)/documents';
const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json' } });
function mkRes() {
  return { c: 0, j: null, h: {}, status(c) { this.c = c; return this; }, json(o) { this.j = o; return this; }, end() { return this; }, setHeader(k, v) { this.h[k] = v; } };
}
const INV = 'https://invest.thesnowball.app', ACA = 'https://academy.thesnowball.app';

(async () => {
  const UD = require(root + '/ibkr-proxy/lib/udata.js');
  // ---------------------------------------------------------------- 1. נקודת הקצה
  let calls = [], fsResp = null, refreshed = [], ready = true;
  const fakeFetch = async (url, init = {}) => { calls.push({ url, init }); return fsResp ? fsResp(url, init) : J({ name: 'x', fields: {}, updateTime: '2026-11-06T10:00:00Z' }); };
  const tokens = { tA: { uid: 'alice', app: 'invest' }, tAc: { uid: 'alice', app: 'academy' }, tAll: { uid: 'alice', app: 'all' }, tNo: { uid: 'alice', app: '' }, tBob: { uid: 'bob', app: 'invest' } };
  const env = { SNB_UDATA: 'on', SNB_SESSION_ENV: 'prod' };
  const H = UD.makeHandler({ env, fetch: fakeFetch, token: async () => 'OWN', now: () => Date.parse('2026-11-06T10:00:00Z'),
    verify: async (t) => { if (!tokens[t]) throw new Error('bad_token'); return tokens[t]; },
    ldb: { ready: () => ready, refresh: async (c, id) => { refreshed.push(c + '/' + id); return true; } } });
  const call = async (body, origin = INV, method = 'POST') => { const res = mkRes(); await H({ method, headers: { origin }, body }, res); return res; };

  let r = await call({ op: 'get', app: 'invest', idToken: 'tA' }, 'https://evil.example');
  ok(r.c === 403 && r.j.error === 'forbidden_origin' && !r.h['Access-Control-Allow-Origin'], 'מקור זר — 403 ובלי CORS');
  r = await call(null, INV, 'OPTIONS');
  ok(r.c === 204 && r.h['Access-Control-Allow-Origin'] === INV && !/Credentials/.test(Object.keys(r.h).join()), 'preflight — 204, בלי עוגיות');
  r = await call({ op: 'get', app: 'invest', idToken: 'tA' }, ACA);
  ok(r.c === 403 && r.j.error === 'wrong_app', 'Academy לא קוראת את התיק (לפי המקור)');
  r = await call({ op: 'get', app: 'academy', idToken: 'tAc' }, INV);
  ok(r.c === 403 && r.j.error === 'wrong_app', 'Invest לא קוראת את הספרייה (לפי המקור)');
  r = await call({ op: 'get', app: 'invest', idToken: 'tAc' });
  ok(r.c === 403 && r.j.error === 'wrong_app', 'טוקן של Academy לא קורא את התיק (כמו appIs)');
  r = await call({ op: 'get', app: 'nope', idToken: 'tA' });
  ok(r.c === 400 && r.j.error === 'bad_app', 'אפליקציה לא מוכרת — 400');
  r = await call({ op: 'get', app: '__proto__', idToken: 'tA' });
  ok(r.c === 400, '__proto__ — לא אפליקציה');
  r = await call({ op: 'get', app: 'invest', idToken: 'zzz' });
  ok(r.c === 401 && r.j.error === 'bad_token' && !calls.length, 'טוקן לא תקף — 401, בלי פנייה למסד');
  env.SNB_UDATA = '';
  r = await call({ op: 'get', app: 'invest', idToken: 'tA' });
  ok(r.c === 503 && r.j.error === 'off', 'כבוי (ברירת המחדל) — 503 off, והטלפון ממשיך ל־Firestore');
  env.SNB_UDATA = 'on'; ready = false;
  r = await call({ op: 'get', app: 'invest', idToken: 'tA' });
  ok(r.c === 503 && r.j.error === 'not_ready', 'האוסף עוד לא במסד — 503 not_ready');
  ready = true;

  fsResp = (url) => J({ name: 'n', fields: { db: { mapValue: { fields: { cash: { mapValue: { fields: { usd: { integerValue: '5' } } } } } } },
    updatedAt: { timestampValue: '2026-11-06T09:00:00Z' }, _mt: { integerValue: '1' } }, updateTime: '2026-11-06T09:00:01Z' });
  calls = [];
  r = await call({ op: 'get', app: 'invest', idToken: 'tA', uid: 'bob' });
  ok(r.c === 200 && r.j.doc.db.cash.usd === 5 && !('_mt' in r.j.doc) && r.j.at === Date.parse('2026-11-06T09:00:00Z') && r.j.ut === Date.parse('2026-11-06T09:00:01Z'), 'get — המסמך כ־JSON, בלי _mt, ו־at מ־updatedAt');
  ok(calls[0].url === BASE + '/users/alice' && calls[0].init.headers.Authorization === 'Bearer OWN', 'ה־uid מהטוקן בלבד (לא מהגוף), ובטוקן של השרת (המסד עונה רק לו)');
  r = await call({ op: 'get', app: 'invest', idToken: 'tNo' });
  ok(r.c === 200, 'טוקן בלי app (התחברות ישירה עם Google) — מותר, כמו בכללים');
  r = await call({ op: 'get', app: 'academy', idToken: 'tAll' }, 'https://thesnowball.app');
  ok(r.c === 200 && calls[calls.length - 1].url === BASE + '/academyUsers/alice', 'app=all (הכתובת המאוחדת) — לשתיהן');
  fsResp = () => J({ error: { code: 404 } }, 404);
  r = await call({ op: 'get', app: 'invest', idToken: 'tA' });
  ok(r.c === 200 && r.j.ok && r.j.doc === null, 'אין מסמך — doc=null (משתמש חדש)');
  fsResp = null;

  // put
  calls = [];
  r = await call({ op: 'put', app: 'invest', idToken: 'tA', data: { v: 1, db: { cash: { usd: 1.5, ils: 2 }, positions: [{ s: 'X' }], empty: {} } }, del: [['tdkey'], ['db', 'ibkrSnapshot']] });
  ok(r.c === 200 && r.j.ok, 'put — 200');
  const u0 = new URL(calls[0].url), mask = u0.searchParams.getAll('updateMask.fieldPaths'), b0 = JSON.parse(calls[0].init.body);
  ok(calls[0].init.method === 'PATCH' && u0.pathname.endsWith('/users/alice'), 'put = PATCH למסמך של המשתמש');
  ok(['v', 'db.cash.usd', 'db.cash.ils', 'db.positions', 'db.empty', 'tdkey', 'db.ibkrSnapshot', 'updatedAt'].every((p) => mask.includes(p)) && mask.length === 8, 'המסכה = העלים (כמו set עם merge) + המחיקות + updatedAt: ' + mask.join());
  ok(b0.fields.db.mapValue.fields.cash.mapValue.fields.usd.doubleValue === 1.5 && b0.fields.db.mapValue.fields.cash.mapValue.fields.ils.integerValue === '2' && !b0.fields.tdkey, 'הערכים בצורה של Firestore (שלם/עשרוני), ומה שנמחק — בלי ערך');
  ok(b0.fields.updatedAt.timestampValue === '2026-11-06T10:00:00.000Z', 'updatedAt נכתב בשרת (במקום serverTimestamp)');
  ok(!u0.searchParams.has('mask.fieldPaths'), 'בלי mask בתשובה — המסמך המלא חוזר למסד');
  calls = [];
  r = await call({ op: 'put', app: 'academy', idToken: 'tAc', data: { lib: { p: { 'kab-c.d': { c: '', f: 0.5, d: false, t: 9 } } } } }, ACA);
  const m2 = new URL(calls[0].url).searchParams.getAll('updateMask.fieldPaths');
  ok(r.c === 200 && m2.includes('lib.p.`kab-c.d`.f') && m2.length === 4 && !m2.includes('updatedAt'), 'ספרייה — נתיב עם תווים מיוחדים בגרשיים הפוכים, ובלי updatedAt');
  ok(UD.fieldPath(['a', 'x`y\\z']) === 'a.`x\\`y\\\\z`', 'גרש הפוך ולוכסן הפוך — מוברחים');
  for (const [body, why] of [
    [{ op: 'put', app: 'invest', idToken: 'tA', data: { isAdmin: true } }, 'isAdmin'],
    [{ op: 'put', app: 'invest', idToken: 'tA', data: { vault: { x: 1 } } }, 'vault'],
    [{ op: 'put', app: 'invest', idToken: 'tA', data: {}, del: [['admin']] }, 'מחיקת admin'],
    [{ op: 'put', app: 'invest', idToken: 'tA', data: { updatedAt: 1 } }, 'updatedAt מהטלפון'],
    [{ op: 'put', app: 'invest', idToken: 'tA', data: { _mt: 1 } }, '_mt'],
  ]) { calls = []; r = await call(body); ok(r.c === 403 && r.j.error === 'forbidden_field' && !calls.length, 'Invest — שדה אסור: ' + why); }
  for (const [data, why] of [[{ mv: 0 }, 'mv'], [{ dl: 1 }, 'dl'], [{ lib: {}, x: 1 }, 'שדה נוסף']]) {
    calls = []; r = await call({ op: 'put', app: 'academy', idToken: 'tAc', data }, ACA);
    ok(r.c === 403 && !calls.length, 'Academy — רק lib: ' + why);
  }
  r = await call({ op: 'put', app: 'invest', idToken: 'tA', data: {} });
  ok(r.c === 400 && r.j.error === 'empty', 'put ריק — 400');
  r = await call({ op: 'put', app: 'invest', idToken: 'tA', data: [1] });
  ok(r.c === 400, 'data שאינו אובייקט — 400');
  r = await call({ op: 'put', app: 'invest', idToken: 'tA', data: { db: { x: 1 } }, del: [['db', 5]] });
  ok(r.c === 400 && r.j.error === 'bad_del', 'נתיב מחיקה לא תקין — 400');
  let deep = {}; const top = deep; for (let i = 0; i < 25; i++) { deep.a = {}; deep = deep.a; } deep.z = 1;
  r = await call({ op: 'put', app: 'invest', idToken: 'tA', data: { db: top } });
  ok(r.c === 400 && r.j.error === 'too_deep', 'עומק מעל 20 — 400');
  const many = {}; for (let i = 0; i < 2100; i++) many['k' + i] = i;
  r = await call({ op: 'put', app: 'invest', idToken: 'tA', data: { db: many } });
  ok(r.c === 400 && r.j.error === 'too_many', 'יותר מ־2,000 שדות — 400');
  r = await call(JSON.stringify({ op: 'put', app: 'invest', idToken: 'tA', data: { db: { s: 'x'.repeat(1100 * 1024) } } }));
  ok(r.c === 413, 'גוף מעל 1MB — 413');
  fsResp = () => J({ error: { code: 500 } }, 500);
  r = await call({ op: 'put', app: 'invest', idToken: 'tA', data: { v: 1 } });
  ok(r.c === 502 && !r.j.ok, 'Firestore והמסד נכשלו — 502 (הטלפון כותב ישירות)');
  fsResp = null;

  // del + fb
  calls = [];
  r = await call({ op: 'del', app: 'academy', idToken: 'tAc' }, ACA);
  ok(r.c === 403 && !calls.length, 'מחיקת מסמך הספרייה — אסור (כמו בכללים)');
  r = await call({ op: 'del', app: 'invest', idToken: 'tA' });
  ok(r.c === 200 && calls[0].init.method === 'DELETE' && calls[0].url === BASE + '/users/alice', 'מחיקת התיק (איפוס) — מותר, רק שלך');
  refreshed = [];
  await call({ op: 'get', app: 'invest', idToken: 'tA', fb: 1 });
  await call({ op: 'get', app: 'invest', idToken: 'tBob' });
  ok(refreshed.join() === 'users/alice', 'fb=1 — קודם איחוד מ־Firestore, ורק למסמך של בעל הטוקן');
  r = await call({ op: 'nope', app: 'invest', idToken: 'tA' });
  ok(r.c === 400 && r.j.error === 'bad_op', 'פעולה לא מוכרת — 400');
  UD._reset();
  let last;
  for (let i = 0; i < 125; i++) last = await call({ op: 'get', app: 'invest', idToken: 'tBob' });
  ok(last.c === 429, 'קצב — מעל 120 בדקה למשתמש: 429');
  UD._reset();

  // ---------------------------------------------------------------- 2. מצב "דרך" במסד
  let sqliteOk = true;
  try { require('node:sqlite'); } catch (e) { sqliteOk = false; }
  if (sqliteOk) {
    process.env.SNB_UDATA = 'on';
    const L = require(root + '/ibkr-proxy/lib/ldb.js');
    const LS = require(root + '/ibkr-proxy/lib/ldbsync.js');
    const C = require(root + '/ibkr-proxy/lib/ldbchg.js');
    ok(C.serverCol('users') && C.thru('academyUsers') && !C.thru('studioJobs'), 'SNB_UDATA=on — האוספים של הטלפון במסד, במצב "דרך"');
    let clock = Date.parse('2026-11-06T10:00:00Z');
    const now = () => clock;
    const remote = L.createStore({ project: P, now, all: true });
    remote.handle('PATCH', BASE + '/users/alice', { fields: { db: { mapValue: { fields: { n: { integerValue: '1' } } } } } });
    remote.handle('PATCH', BASE + '/academyUsers/alice', { fields: { lib: { mapValue: { fields: {} } } } });
    remote.handle('PATCH', BASE + '/sysCfg/main', { fields: { mtOn: { integerValue: '0' } } });
    let rc = [], down = false;
    const remoteFetch = async (url, init = {}) => {
      const method = (init.method || 'GET').toUpperCase();
      const body = init.body ? JSON.parse(init.body) : null;
      rc.push(method + ' ' + url.replace(BASE, '').split('?')[0]);
      if (down) return J({ error: { code: 503 } }, 503);
      if (url.endsWith(':listCollectionIds')) return J({ collectionIds: [...remote._mem.keys()] });
      if (url.endsWith(':batchWrite')) return J({ writeResults: body.writes.map(() => ({})), status: body.writes.map((w) => (remote.handle('POST', BASE + ':commit', { writes: [w] }).status === 200 ? {} : { code: 9 })) });
      const x = remote.handle(method, url, body);
      return x ? J(x.j, x.status) : J({ error: { code: 400 } }, 400);
    };
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'udata-'));
    const ctl = LS.create({ own: () => true, fetch: remoteFetch, env: {}, project: P, dir: path.join(tmp, 'd'), now, token: async () => 'T', timers: false });
    ok(await ctl.start(), 'המסד עולה');
    for (let i = 0; i < 10 && !ctl.store.ready('users'); i++) await ctl.importTick();
    for (let i = 0; i < 10 && !ctl.store.ready('academyUsers'); i++) await ctl.importTick();
    ok(ctl.store.ready('users') && ctl.store.ready('academyUsers'), 'users ו־academyUsers מיובאים');
    const wf = ctl.wrapFetch(remoteFetch);
    const H2 = UD.makeHandler({ env: { SNB_UDATA: 'on', SNB_SESSION_ENV: 'prod' }, fetch: wf, token: async () => 'T', now,
      verify: async (t) => tokens[t], ldb: { ready: (c) => ctl.store.ready(c), refresh: (c, id) => ctl.refresh(c, id) } });
    const call2 = async (body, origin = INV) => { const res = mkRes(); await H2({ method: 'POST', headers: { origin }, body }, res); return res; };
    rc = [];
    r = await call2({ op: 'get', app: 'invest', idToken: 'tA' });
    ok(r.c === 200 && r.j.doc.db.n === 1 && !rc.length, 'get — מהמסד שלנו, בלי פנייה ל־Firestore');
    rc = [];
    r = await call2({ op: 'put', app: 'invest', idToken: 'tA', data: { db: { n: 2 } } });
    ok(r.c === 200 && rc.join() === 'PATCH /users/alice', 'put — ממשיך מיד ל־Firestore');
    ok(remote._mem.get('users').get('alice').f.db.mapValue.fields.n.integerValue === '2', 'Firestore קיבל את הכתיבה (העותק שלם)');
    rc = [];
    r = await call2({ op: 'get', app: 'invest', idToken: 'tA' });
    ok(r.j.doc.db.n === 2 && !rc.length && !ctl.store.rec('users', 'alice').dirty, 'והמסד התעדכן מהתשובה — נקי, בלי עותק נוסף');
    // Firestore לא זמין — כתיבה מקומית, והעותק ישלח
    down = true;
    r = await call2({ op: 'put', app: 'invest', idToken: 'tA', data: { db: { n: 3 } } });
    ok(r.c === 200 && ctl.store.rec('users', 'alice').dirty && ctl.status().thru.local === 1, 'Firestore לא זמין — נכתב במסד (dirty), ונספר ב־thru.local');
    down = false;
    await ctl.mirror();
    ok(remote._mem.get('users').get('alice').f.db.mapValue.fields.n.integerValue === '3' && !ctl.store.rec('users', 'alice').dirty, 'העותק שלח כשחזר');
    // הטלפון כתב ישירות (השרת לא היה זמין) + רשומה ביומן → האיחוד
    clock += 60e3;
    remote.handle('PATCH', BASE + '/users/alice?updateMask.fieldPaths=db', { fields: { db: { mapValue: { fields: { n: { integerValue: '4' } } } } } });
    remote.handle('PATCH', BASE + '/snbChg/users~alice', { fields: { c: { stringValue: 'users' }, i: { stringValue: 'alice' }, t: { integerValue: String(clock) }, d: { booleanValue: false }, f: { integerValue: '1' } } });
    clock += 1000;
    await ctl.merge();
    r = await call2({ op: 'get', app: 'invest', idToken: 'tA' });
    ok(r.j.doc.db.n === 4, 'כתיבה ישירה של הטלפון + רשומה ביומן — האיחוד מביא אותה');
    ok(!remote._mem.get('snbChg').get('users~alice') || remote._mem.get('snbChg').get('users~alice').del, 'והרשומה ביומן נמחקה');
    // רשומה עם שעון של טלפון בעתיד — הסמן לא קופץ
    remote.handle('PATCH', BASE + '/snbChg/academyUsers~alice', { fields: { c: { stringValue: 'academyUsers' }, i: { stringValue: 'alice' }, t: { integerValue: String(clock + 4 * 60e3) }, d: { booleanValue: false }, f: { integerValue: '1' } } });
    await ctl.merge();
    ok(+ctl.store.kv('chgSince') <= clock, 'שעון הטלפון בעתיד — הסמן של האיחוד לא עובר את השעה של השרת');
    // fb — בלי יומן (הרשומה נדחתה), הבקשה הבאה מאחדת
    clock += 60e3;
    remote.handle('PATCH', BASE + '/users/alice?updateMask.fieldPaths=db', { fields: { db: { mapValue: { fields: { n: { integerValue: '5' } } } } } });
    rc = [];
    r = await call2({ op: 'get', app: 'invest', idToken: 'tA', fb: 1 });
    ok(r.j.doc.db.n === 5 && rc.join() === 'GET /users/alice', 'fb=1 — קריאה אחת מ־Firestore, והתשובה כבר מאוחדת');
    // מסמך מקומי שנכתב אחרי Firestore ועוד לא נשלח — נשאר
    down = true; clock += 60e3;
    await call2({ op: 'put', app: 'invest', idToken: 'tA', data: { db: { n: 6 } } });
    down = false;
    await ctl.refresh('users', 'alice');
    ok(UD && (await call2({ op: 'get', app: 'invest', idToken: 'tA' })).j.doc.db.n === 6, 'השינוי האחרון גובר — המקומי (אחרי Firestore) נשאר');
    ok((await ctl.refresh('studioJobs', 'a/b')) === false, 'refresh — רק מזהה תקין');
    // ספרייה: merge עמוק — שני מכשירים, ספרים שונים
    await call2({ op: 'put', app: 'academy', idToken: 'tAc', data: { lib: { p: { k1: { t: 1, f: 0.1 } } } } }, ACA);
    await call2({ op: 'put', app: 'academy', idToken: 'tAc', data: { lib: { p: { k2: { t: 2, f: 0.2 } } } } }, ACA);
    r = await call2({ op: 'get', app: 'academy', idToken: 'tAc' }, ACA);
    ok(r.j.doc.lib.p.k1.f === 0.1 && r.j.doc.lib.p.k2.f === 0.2, 'ספרייה — כתיבה של ספר אחד לא דורסת ספר אחר (כמו set עם merge)');
    // הדגל ud_srv במרכז הניהול (sysCfg/main.flOn) — בלי משתנה סביבה
    for (let i = 0; i < 10 && !ctl.store.ready('sysCfg'); i++) await ctl.importTick();
    delete process.env.SNB_UDATA;
    const setFl = (v) => { ctl.store.handle('PATCH', BASE + '/sysCfg/main?updateMask.fieldPaths=flOn', { fields: { flOn: { stringValue: v } } }); clock += 6000; };
    clock += 6000;
    ok(!C.thruOn() && !C.serverCol('users'), 'בלי הדגל ובלי SNB_UDATA — כבוי');
    setFl('ud_srv');
    ok(C.thruOn() && C.serverCol('users'), 'ud_srv במרכז הניהול — דולק (נקרא מהמסד, בלי Firestore)');
    setFl('');
    ok(!C.thruOn() && !ctl.store.cols.has('users') && !ctl.store.rec('users', 'alice'), 'נכבה — האוספים של הטלפון יוצאים מהמסד (לא נשאר עותק ישן)');
    remote.handle('PATCH', BASE + '/users/alice?updateMask.fieldPaths=db', { fields: { db: { mapValue: { fields: { n: { integerValue: '9' } } } } } });
    setFl('ud_srv');
    ok(C.thruOn() && ctl.store.cols.get('users').st === 'imp', 'הודלק שוב — לייבוא מחדש');
    for (let i = 0; i < 10 && !ctl.store.ready('users'); i++) await ctl.importTick();
    r = await call2({ op: 'get', app: 'invest', idToken: 'tA' });
    ok(r.c === 200 && r.j.doc.db.n === 9, 'אחרי הייבוא — המצב העדכני מ־Firestore');
    const H3 = UD.makeHandler({ env: {}, fetch: wf, token: async () => 'T', now, verify: async (t) => tokens[t], ldb: { ready: (c) => ctl.store.ready(c), refresh: () => true } });
    const res3 = mkRes(); await H3({ method: 'POST', headers: { origin: INV }, body: { op: 'get', app: 'invest', idToken: 'tA' } }, res3);
    ok(res3.c === 200, 'udata — דולק לפי הדגל, גם בלי SNB_UDATA');
    setFl('');
    ctl.stop();
    ok(!C.serverCol('users') && !C.thru('users'), 'בלי SNB_UDATA — האוספים של הטלפון נשארים ב־Firestore (כמו קודם)');
    ok(C.stampCol('users') && !C.stampCol('snbChg'), 'Vercel רושם ביומן גם את האוספים של הטלפון (לא את היומן עצמו)');
    // 6/11/2026: בניסוי — דולק בלי הדגל; SNB_UDATA=off מכבה
    const stgEnv = {};
    const stg = LS.create({ own: () => true, fetch: remoteFetch, env: stgEnv, project: 'snowball-staging-758f6', dir: path.join(tmp, 's'), now, token: async () => 'T', timers: false });
    ok(await stg.start(), 'מסד של הניסוי עולה');
    clock += 6000;
    ok(C.thruOn({}) && stg.store.cols.get('users').st === 'imp', 'בניסוי — שלב 4 דולק בלי הדגל, והאוספים של הטלפון לייבוא');
    stgEnv.SNB_UDATA = 'off'; clock += 6000;
    ok(!C.thruOn({}), 'בניסוי — SNB_UDATA=off מכבה');
    stg.stop();
  }

  // ---------------------------------------------------------------- 3. הטלפון
  const cloud = read('cloud.js'), lib = read('library.js'), authJs = read('auth.js'), tpl = read('tools/auth.tpl.js');
  ok(/const snap = await readCloud\(\)/.test(cloud) && /async function readCloud\(\)[\s\S]{0,120}udGet\('invest'\)/.test(cloud), 'Invest — הקריאה בכניסה: קודם השרת');
  ok(/if \(await udPut\('invest', \{ v: 1, db: d \}/.test(cloud) && /set\(\{\s*v: 1,[\s\S]{0,400}\}, \{ merge: true \}\);\s*await udMark\('invest'\);/.test(cloud), 'Invest — השמירה: השרת, ואחרת Firestore + יומן');
  ok(/udPut\('invest', has \?/.test(cloud) && /udDel\('invest'\)/.test(cloud), 'Invest — דוח IBKR והאיפוס דרך השרת');
  ok(/async function libSet\(ref, data\)[\s\S]{0,200}ud\.put\('academy', data\)[\s\S]{0,120}ref\.set\(data, \{ merge: true \}\);\s*if \(ud\) ud\.mark\('academy'\);/.test(lib), 'Academy — כתיבה: השרת, ואחרת Firestore + יומן');
  ok(!/ref\.set\(\{ lib/.test(lib) && (lib.match(/libSet\(ref, \{/g) || []).length === 3, 'Academy — כל שלוש הכתיבות עוברות ב־libSet');
  ok(/ud\.get\('academy'\)/.test(lib) && /udGet\('academy'\)/.test(tpl) && /window\.SNBud = /.test(authJs), 'Academy — הקריאות (pullCloud, הבדיקה בכניסה) דרך השרת; SNBud ב־auth.js');

  // vm: העזר עצמו
  const regs = []; const re = /^[ ]*\/\* <auth> \*\/\n([\s\S]*?)^[ ]*\/\* <\/auth> \*\/\n/gm; let m;
  while ((m = re.exec(cloud))) regs.push(m[1]);
  const mkCtx = (resp) => {
    const ls = new Map(), fsw = [], fx = [];
    const ctx = {
      console, JSON, Date, Math, URL, Promise, setTimeout, clearTimeout, AbortController, Number, String, Object, Array,
      location: { hostname: 'invest.thesnowball.app', reload() {} },
      localStorage: { getItem: (k) => (ls.has(k) ? ls.get(k) : null), setItem: (k, v) => ls.set(k, String(v)), removeItem: (k) => ls.delete(k) },
      sessionStorage: { getItem: () => null, setItem() {} },
      fetch: async (url, init) => { fx.push({ url, body: JSON.parse(init.body) }); const x = resp(url, init); if (x === 'throw') throw new Error('net'); return x; },
      firebase: { apps: [1], auth: () => ({ currentUser: { uid: 'alice', getIdToken: async () => 'TK' } }),
        firestore: () => ({ collection: (c) => ({ doc: (id) => ({ set: async (d) => { fsw.push([c + '/' + id, d]); } }) }) }) },
    };
    ctx.window = ctx; ctx.window.SNB_ENV = { proxy: 'https://api.thesnowball.app' };
    vm.createContext(ctx);
    vm.runInContext('(function(){ let auth = null, user = null, fs = null; ' + regs.join('\n') + '\n})();', ctx);
    return { ud: ctx.SNBud, ls, fsw, fx };
  };
  const R = (j, s = 200) => ({ status: s, headers: { get: (k) => (k === 'date' ? 'Fri, 06 Nov 2026 10:00:00 GMT' : null) }, json: async () => j });
  let X = mkCtx(() => R({ ok: true, doc: { db: { n: 1 } }, ut: 5, at: 4 }));
  let v = await X.ud.get('invest');
  ok(v && v.doc.db.n === 1 && v.at === 4 && X.fx[0].url === 'https://api.thesnowball.app/api/udata' && X.fx[0].body.idToken === 'TK' && X.fx[0].body.app === 'invest', 'udGet — לשרת שלנו, עם הטוקן');
  await X.ud.get('invest');
  ok(X.fx.length === 1, 'udGet — זיכרון של 10 שנ׳ (הבדיקה בכניסה + המשיכה = קריאה אחת)');
  ok((await X.ud.put('invest', { v: 1 }, [])) === true && X.fx[1].body.op === 'put', 'udPut — true כשהשרת כתב');
  X = mkCtx(() => R({ ok: false, error: 'off' }, 503));
  ok((await X.ud.get('invest')) === null, 'השרת כבוי — null (הקוראת ממשיכה ל־Firestore)');
  await X.ud.mark('invest');
  ok(!X.fsw.length, 'כבוי — בלי רשומה ביומן (לא מוסיפים כתיבות כשהדגל כבוי)');
  await X.ud.get('academy');
  ok(X.fx.length === 1, 'אחרי תקלה — 5 דק׳ בלי לנסות');
  X = mkCtx(() => R({ ok: false, error: 'not_found' }, 404));
  await X.ud.put('invest', { v: 1 }); await X.ud.mark('invest');
  ok(!X.fsw.length, 'אין udata (Vercel, 404) — בלי רשומה ביומן');
  X = mkCtx(() => 'throw');
  ok((await X.ud.put('invest', { v: 1 })) === false, 'השרת נפל — false (הקוראת כותבת ישירות)');
  await X.ud.mark('invest');
  ok(X.fsw.length === 1 && X.fsw[0][0] === 'snbChg/users~alice' && X.fsw[0][1].c === 'users' && X.fsw[0][1].i === 'alice' && X.fsw[0][1].f === 1 && X.fsw[0][1].d === false && Object.keys(X.fsw[0][1]).sort().join() === 'c,d,f,i,t', 'השרת נפל — רשומה ביומן בדיוק בצורה שהכללים מתירים');
  ok(JSON.parse(X.ls.get('pwa_udfb_v1')).invest === 1, 'ודגל במכשיר (fb) לבקשה הבאה');
  X = mkCtx(() => R({ ok: true, doc: null }));
  X.ls.set('pwa_udfb_v1', '{"invest":1}');
  await X.ud.get('invest');
  ok(X.fx[0].body.fb === 1 && !JSON.parse(X.ls.get('pwa_udfb_v1')).invest, 'הבקשה הבאה שולחת fb=1, ואחרי הצלחה הדגל נמחק');

  // ---------------------------------------------------------------- 4. החיבורים
  const server = require(root + '/ibkr-proxy/server.js');
  ok(server.SERVER_ONLY.udata === 'lib/udata.js' && !fs.existsSync(path.join(root, 'ibkr-proxy/api/udata.js')), 'udata — רק בשרת (SERVER_ONLY), לא פונקציה ב־Vercel (12 מתוך 12)');
  const SC = require(root + '/ibkr-proxy/lib/appscope.js');
  ok(SC.SCOPE.udata.join() === 'invest,academy', 'appscope — שורה ל־udata');
  const rules = read('firestore/firestore.rules');
  ok(/match \/snbChg\/\{id\}[\s\S]{0,900}hasOnly\(\['c', 'i', 't', 'd', 'f'\]\)[\s\S]{0,400}request\.time\.toMillis\(\) - 300000/.test(rules) && !/match \/snbChg\/\{id\}\s*\{\s*allow read/.test(rules), 'הכללים — הטלפון כותב רק את הרשומה שלו ביומן, בלי קריאה');
  ok(/'pwa_udfb_v1'/.test(read('app.js').match(/const ACCOUNT_KEYS = \[[^\]]*\]/)[0]), 'הדגל במכשיר ב־ACCOUNT_KEYS (עובר/נמחק עם החשבון)');
  ok(/app: typeof claims\.app === 'string'/.test(read('ibkr-proxy/lib/gauth.js')), 'verifyIdToken מחזיר את app מהטוקן');

  console.log('# ' + n + ' בדיקות עברו');
})().catch((e) => { console.error('FAIL - ' + (e && e.stack || e)); process.exit(1); });
