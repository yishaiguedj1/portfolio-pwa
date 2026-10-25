// 25/10/2026 — יוטיוב בשרת דרך חשבון ייעודי (בקשת המשתמש): עוגיות cookies.txt שהמנהל מדביק במרכז הניהול. טהור
// (lib/ytck.js: סינון ליוטיוב/גוגל, חשבון מחובר, גבולות) + השרתון האמיתי עם Firestore מדומה: adminYt (מנהל בלבד, העוגיות
// לא חוזרות), ytCk (טוקן שרת — רק כשהגרסה השתנתה, put רק לאותה גרסה, שתי חסימות = נחסם), status.yc לטלפון,
// ובדיקת המוכנות. + הטלפון (cloudBlocked / ytHost עם ui.yc) והעובד (fetchurl/agent — python). הרצה: node tests/yt-server.test.js
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const { fakeR2, ACC } = require('./_r2fake');

const L = (dom, name, val, ex) => [dom, 'TRUE', '/', 'TRUE', String(ex == null ? 1800000000 : ex), name, val].join('\t');
const GOOD = ['# Netscape HTTP Cookie File', '# comment', L('.youtube.com', 'SAPISID', 'aaaBBB/ccc'), '#HttpOnly_' + L('.youtube.com', '__Secure-3PSID', 'x1y2z3', 1790000000),
  L('.youtube.com', 'PREF', 'f6=40000000'), L('.facebook.com', 'c_user', '12345'), L('accounts.google.com', 'LSID', 'q'), L('.evil-youtube.com', 'SID', 'z'), 'garbage line', ''].join('\r\n');

(async () => {
  const YT = require(path.join(root, 'ibkr-proxy/lib/ytck.js'));
  /* ---------- 1. טהור ---------- */
  const c = YT.normCookies(GOOD);
  ok(!c.error && c.n === 4, 'רק יוטיוב וגוגל נשמרות (פייסבוק, דומיין מתחזה ושורות זבל — בחוץ)');
  ok(/^# Netscape HTTP Cookie File\n/.test(c.text) && !/facebook|evil|garbage|\r/.test(c.text) && /#HttpOnly_\.youtube\.com\t/.test(c.text), 'פורמט Netscape נקי, HttpOnly נשמר');
  ok(c.exp === 1790000000 * 1000, 'התפוגה = הקרובה מבין עוגיות החשבון');
  ok(YT.normCookies([L('.youtube.com', 'PREF', 'x'), L('.youtube.com', 'YSC', 'y')].join('\n')).error === 'not_logged_in', 'בלי עוגיות של חשבון מחובר — נדחה');
  ok(YT.normCookies('').error === 'empty' && YT.normCookies('hello world').error === 'no_cookies', 'ריק / לא cookies.txt — נדחה');
  ok(YT.normCookies('x'.repeat(YT.IN_MAX + 1)).error === 'too_large', 'גדול מדי — נדחה');
  ok(YT.normCookies(L('.youtube.com', 'SAPISID', 'a b')).error === 'no_cookies' && YT.normCookies(L('.youtube.com', 'SA PISID', 'ab')).error === 'no_cookies', 'ערך/שם עם רווח — לא נכנס');
  ok(YT.normRep({ ok: true }).ok === true && YT.normRep({ ok: false, code: 'blocked' }).code === 'blocked' && YT.normRep({ ok: false, code: 'rm -rf' }) === null, 'דיווח מהשרת — רק קודים מוכרים');
  ok(YT.ytView({}).st === 'off' && YT.ytView({ yk: 'x', ys: 'bad', yc: 'login' }).st === 'bad' && !('yk' in YT.ytView({ yk: 'x' })), 'המצב למסך — בלי העוגיות');
  ok(YT.ytCloud({ yk: 'x' }) && !YT.ytCloud({ yk: 'x', ys: 'bad' }) && !YT.ytCloud({}), 'הטלפון: יש חשבון ולא נחסם');
  const SS = require(path.join(root, 'ibkr-proxy/lib/studio.js'));
  ok(['yk', 'yv', 'ya', 'yn', 'ye', 'ys', 'yc', 'yt', 'yo', 'yp', 'yb'].every((k) => !SS.JSON_FIELDS.includes(k)), 'שמות השדות לא ב־JSON_FIELDS (חל על כל האוספים)');

  /* ---------- 2. השרתון ---------- */
  const sa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const fb = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  Object.assign(process.env, {
    R2L_ACCOUNT_ID: ACC, R2L_ACCESS_KEY_ID: 'AKTEST', R2L_SECRET_ACCESS_KEY: 'sekret/xyz', R2L_BUCKET: 'snb-studio',   // הדלי המדומה היחיד
    GDRIVE_SA_KEY: JSON.stringify({ client_email: 'sa@p.iam.gserviceaccount.com', private_key: sa.privateKey.export({ type: 'pkcs8', format: 'pem' }) }),
    LIBRARY_READERS: 'owner@example.com', STUDIO_USERS: 'other@example.com', SNB_SITEWATCH: 'off', SNB_ADMINWATCH: 'off',
  });
  for (const k of ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET', 'IBKR_VAULT_KEY']) delete process.env[k];
  const gauth = require(path.join(root, 'ibkr-proxy/lib/gauth.js'));
  const R2 = require(path.join(root, 'ibkr-proxy/lib/r2.js'));
  const studio = require(path.join(root, 'ibkr-proxy/api/studio.js'));
  gauth._reset(); studio._reset(); R2._reset();
  const keys = { k1: fb.publicKey.export({ type: 'spki', format: 'pem' }) };
  const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const tnow = Math.floor(Date.now() / 1000);
  const tok = (sub, email) => {
    const hd = b64u({ alg: 'RS256', kid: 'k1' }), bd = b64u({ aud: 'yishaiguedj1-c786e', iss: 'https://securetoken.google.com/yishaiguedj1-c786e', sub, iat: tnow - 5, exp: tnow + 3000, email, email_verified: true });
    return hd + '.' + bd + '.' + crypto.sign('RSA-SHA256', Buffer.from(hd + '.' + bd), fb.privateKey).toString('base64url');
  };
  const OWNER = tok('ownerUid0001', 'owner@example.com'), OTHER = tok('otherUid0002', 'other@example.com');
  const R = fakeR2();
  const db = new Map();
  let utSeq = 0;
  const J = (o, st = 200) => ({ status: st, ok: st < 300, json: async () => o, text: async () => JSON.stringify(o), headers: { get: () => null } });
  const fetchAll = async (url, opt = {}) => {
    if (url.includes('.r2.cloudflarestorage.com')) return R.fetch(url, opt);
    if (url.includes('oauth2.googleapis.com/token')) return J({ access_token: 'SA', expires_in: 3600 });
    if (url.endsWith('/documents:runQuery')) {
      const q = JSON.parse(opt.body).structuredQuery, w = q.where, col = q.from[0].collectionId;
      const fl = !w ? [] : w.fieldFilter ? [w.fieldFilter] : w.compositeFilter.filters.map((f) => f.fieldFilter);
      return J([...db.entries()].filter(([k, v]) => k.startsWith(col + '/') && fl.every((f) => v.fields[f.field.fieldPath] && v.fields[f.field.fieldPath].stringValue === f.value.stringValue))
        .map(([k, v]) => ({ document: { name: 'projects/p/databases/(default)/documents/' + k, fields: v.fields, updateTime: v.ut } })).concat([{ readTime: 'x' }]));
    }
    const lm = url.match(/\/documents\/([A-Za-z]+)\?(.*)$/);
    if (lm && (opt.method || 'GET') === 'GET') return J({ documents: [] });
    const m = url.match(/\/documents\/([A-Za-z]+)\/([A-Za-z0-9_-]+)(?:\?(.*))?$/);
    if (!m) return J({}, 404);
    const k = m[1] + '/' + m[2], cur = db.get(k);
    if ((opt.method || 'GET') === 'GET') return cur ? J({ fields: cur.fields, updateTime: cur.ut }) : J({}, 404);
    if (opt.method === 'DELETE') { db.delete(k); return J({}); }
    if (opt.method === 'PATCH') {
      const qp = new URLSearchParams(m[3] || '');
      const mask = qp.getAll('updateMask.fieldPaths'), pre = qp.get('currentDocument.updateTime');
      if (pre && (!cur || cur.ut !== pre)) return J({}, 400);
      const body = JSON.parse(opt.body).fields;
      db.set(k, { fields: mask.length ? Object.assign({}, cur ? cur.fields : {}, ...mask.map((f) => ({ [f]: body[f] }))) : body, ut: 't' + (++utSeq) });
      return J({});
    }
    return J({}, 400);
  };
  let NOW = R.now;
  const deps = () => ({ verify: { keys }, fetch: fetchAll, now: NOW });
  const call = async (body, worker, get) => {
    const res = { code: 0, j: null, setHeader() {}, status(c) { res.code = c; return res; }, json(o) { res.j = o; return res; }, end() { return res; } };
    const req = { method: get ? 'GET' : 'POST', query: {}, body, headers: worker || get ? {} : { origin: 'https://yishaiguedj1.github.io' }, socket: { remoteAddress: '9.9.9.9' } };
    await studio._handler(req, res, deps());
    return res;
  };
  const api = (op, b) => call(Object.assign({}, b, { op, idToken: OWNER })).then((r) => r.j);
  const other = (op, b) => call(Object.assign({}, b, { op, idToken: OTHER })).then((r) => r.j);
  const raw = (op, b, who) => call(Object.assign({}, b, { op, idToken: who || OWNER }));
  const S = require(path.join(root, 'ibkr-proxy/lib/studio.js'));
  const SID = 'ytsrv0000001', STOK = S.newServerToken(SID);
  db.set('studioServers/' + SID, { fields: S.toFields({ th: S.keyHash(STOK), name: 'test', created: NOW, by: 'ownerUid0001' }), ut: 't0' });
  const srv = async (b) => {
    const res = { code: 0, j: null, setHeader() {}, status(x) { res.code = x; return res; }, json(o) { res.j = o; return res; }, end() { return res; } };
    await studio._handler({ method: 'POST', query: {}, body: Object.assign({ op: 'ytCk' }, b), headers: { authorization: 'Bearer ' + STOK }, socket: { remoteAddress: '9.9.9.8' } }, res, deps());
    return res;
  };
  /* ---------- 2. השרתון ---------- */
  let r = await srv({ v: 0 });
  ok(r.code === 200 && r.j.v === 0 && !r.j.ck, 'בלי חשבון — השרת מקבל גרסה 0 ובלי עוגיות');
  ok((await raw('adminYt', { set: GOOD }, OTHER)).code === 403, 'לא מנהל — 403');
  ok((await raw('adminYt', { set: L('.youtube.com', 'PREF', 'x') })).j.error === 'not_logged_in', 'עוגיות אורח — 400 not_logged_in');
  let a = await api('adminYt', { set: GOOD });
  ok(a.ok && a.yt.on && a.yt.n === 4 && a.yt.st === 'new' && !JSON.stringify(a).includes('aaaBBB'), 'המנהל שומר — המסך מקבל רק מצב, בלי העוגיות');
  const stored = JSON.stringify(db.get('studioVault/_ytck'));
  ok(!stored.includes('aaaBBB') && !stored.includes('x1y2z3'), 'בכספת — מוצפן (אין ערך גלוי ב־Firestore)');
  const log = [...db.entries()].filter(([k]) => k.startsWith('sysLog/')).map(([, v]) => v.fields.k.stringValue);
  ok(log.includes('yt_set') && ![...db.entries()].filter(([k]) => k.startsWith('sysLog/')).some(([, v]) => JSON.stringify(v).includes('aaaBBB')), 'יומן הפעולות: yt_set, בלי העוגיות');
  r = await srv({ v: 0 });
  const V = r.j.v;
  ok(r.j.v > 0 && r.j.ck === c.text, 'השרת מקבל את העוגיות (מפוענחות) כשהגרסה שונה');
  r = await srv({ v: V });
  ok(r.j.same === true && !r.j.ck, 'אותה גרסה — לא שולחים שוב');
  const st1 = await api('status', {});
  ok(st1.yc === false || st1.yc === true, 'status מחזיר yc');
  // ה־R2 של הסטודיו לא מוגדר בבדיקה → url=false → yc=false; הכלל: yc רק עם הורדה מקישור
  ok(st1.yc === (st1.url === true), 'yc רק כשהורדה מקישור פתוחה');
  r = await srv({ v: V, rep: { ok: false, code: 'blocked' } });
  ok(YT.ytView((await api('adminYt', {})).yt).st !== 'bad' && (await api('adminYt', {})).yt.st === 'new', 'חסימה אחת — עוד לא "נחסם"');
  r = await srv({ v: V, rep: { ok: true } });
  ok((await api('adminYt', {})).yt.st === 'ok', 'הצלחה — "עובד" ומאפסת את הספירה');
  await srv({ v: V, rep: { ok: false, code: 'blocked' } });
  await srv({ v: V, rep: { ok: false, code: 'login' } });
  a = await api('adminYt', {});
  ok(a.yt.st === 'bad' && a.yt.sc === 'login', 'שתי חסימות ברצף — "נחסם", עם הקוד האחרון');
  await srv({ v: V - 1, rep: { ok: true } });
  ok((await api('adminYt', {})).yt.st === 'bad', 'דיווח על גרסה ישנה — לא נספר');
  const PUT = GOOD.replace('aaaBBB/ccc', 'rotated999');
  await srv({ v: V, put: PUT });
  r = await srv({ v: 0 });
  ok(r.j.ck.includes('rotated999') && r.j.v === V, 'העוגיות שהשרת עדכן (put) נשמרות — אותה גרסה');
  NOW += 1000;
  a = await api('adminYt', { set: GOOD });
  r = await srv({ v: V, put: PUT.replace('rotated999', 'stale000') });
  ok(r.j.v > V && r.j.ck && !r.j.ck.includes('stale000') && r.j.ck.includes('aaaBBB'), 'put על גרסה ישנה — לא דורס עוגיות חדשות של המנהל');
  ok((await api('adminYt', {})).yt.st === 'new', 'עוגיות חדשות — המצב מתאפס (לא "נחסם")');
  a = await api('adminYt', { clear: true });
  r = await srv({ v: r.j.v });
  ok(!a.yt.on && r.j.v > V && !r.j.ck && !r.j.same, 'הסרה — גרסה חדשה בלי עוגיות (השרת מוחק את הקובץ)');
  ok((await (async () => { const x = { code: 0, setHeader() {}, status(q) { x.code = q; return x; }, json() { return x; } }; await studio._handler({ method: 'POST', query: {}, body: { op: 'ytCk', v: 0 }, headers: { authorization: 'Bearer ' + SID + '-' + 'x'.repeat(43) }, socket: { remoteAddress: '9.9.9.7' } }, x, deps()); return x.code; })()) === 401, 'טוקן שרת שגוי — 401');

  /* ---------- 3. בדיקת המוכנות ---------- */
  const AO = require(path.join(root, 'ibkr-proxy/lib/adminov.js'));
  const base = { now: NOW, cache: {}, builds: {}, api: {} };
  ok(!AO.readyView(base).checks.some((x) => x.k === 'yt'), 'בלי חשבון — אין בדיקה');
  ok(AO.readyView(Object.assign({ yt: { on: true, st: 'ok' } }, base)).checks.find((x) => x.k === 'yt').ok === true, 'חשבון עובד — עוברת');
  ok(AO.readyView(Object.assign({ yt: { on: true, st: 'bad', sc: 'blocked' } }, base)).checks.find((x) => x.k === 'yt').ok === false, 'נחסם — נכשלת (והבדיקה המתוזמנת שולחת התראה)');
  ok(AO.LOG_KINDS ? AO.LOG_KINDS.includes('yt_set') : !!AO.logEntry('yt_set', '4', 'a@b.co', NOW), 'yt_set ביומן הפעולות');

  /* ---------- 4. הטלפון ---------- */
  const st = fs.readFileSync(path.join(root, 'studio.js'), 'utf8');
  ok(/ui\.yc = j\.yc === true;/.test(st), 'הטלפון קורא yc מ־status');
  ok(/export const cloudBlocked = \(r\) => \/\^youtube\/i\.test\(String\(\(r && r\.s\) \|\| ''\)\) && !ui\.yc;/.test(st), 'עם חשבון בשרת — יוטיוב לא חסום לענן');
  ok(/if \(ui\.url && !ui\.yc && ytHost\(L\.u\)\) \{ L\.st = 'err'; L\.e = 'yt'; \}/.test(st), 'בלי האפליקציה: יוטיוב נעצר רק כשאין חשבון בשרת');
  const adm = fs.readFileSync(path.join(root, 'admin-app.js'), 'utf8');
  ok(/page\('yt'/.test(adm) && /api\('adminYt'/.test(adm) && !/\.ck\b/.test(adm.slice(adm.indexOf("page('yt'"), adm.indexOf("page('infra'"))), 'מרכז הניהול: עמוד יוטיוב, בלי שדה עוגיות שחוזר');
  const DL = require(path.join(root, 'ibkr-proxy/lib/devlog.js'));
  ok(!/aaaBBB|x1y2z3/.test(DL.redact(GOOD)) && !/q1w2/.test(DL.redact('SID=q1w2; __Secure-3PAPISID=q1w2')), 'עוגיות לא נכנסות ליומן (redact)');

  /* ---------- 5. העובד (python) ---------- */
  const py = spawnSync('python3', ['-m', 'unittest', 'tests.test_ytck'], { encoding: 'utf8', cwd: path.join(root, 'translator') });
  ok(py.status === 0 && /\nOK\s*$/.test(py.stderr || ''), 'העובד: fetchurl + agent (' + String(py.stderr || '').trim().split('\n').slice(-3).join(' ') + ')');
  console.log('\n' + n + ' בדיקות עברו');
})().catch((e) => { console.error(e); process.exit(1); });
