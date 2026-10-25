// 24/10/2026 — מאגר הנתונים מ־Studio DM (שלב ב׳): יומן ההורדות מהאפליקציה הנייטיב.
// lib/dmlog.js (טהור): רשימה מותרת, ניקוי כתובות/עוגיות/מיילים/נתיבים גם אם הטלפון לא ניקה, הסכמה בנוסח הנוכחי.
// השרתון האמיתי (api/studio.js) עם R2 מדומה: dmLog בלי Origin (אפליקציה) עם התחברות Firebase; בלי התחברות — 401;
// הסכמה ישנה — 409; מוצפן בדלי, בלי uid בנתיב; dmForget מוחק רק של המשתמש; 24 חודשים.
// הרצה: node tests/dm-log.test.js
const path = require('path');
const crypto = require('crypto');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const { fakeR2, ACC } = require('./_r2fake');

(async () => {
  const D = require(path.join(root, 'ibkr-proxy/lib/dmlog.js'));
  /* ---------- 1. טהור ---------- */
  const url = 'https://rr3---sn-x.googlevideo.com/videoplayback?expire=1793&sig=AOq0QJ8wRQIhAKzSECRET&ip=1.2.3.4';
  const ev = { t: 1793000000000, k: 'fail', id: 'abc123', kind: 'yt', dom: 'YouTube.com', name: '/storage/x/My video.mp4', code: 'blocked',
    size: 1000, got: 400, ms: 2000, bps: 200, conns: 4, tries: 1, ex: 'IOException', msg: 'HTTP Error 403 ' + url + ' cookie=SID123 by a@b.com',
    tail: ['ERROR: ' + url], url, cookies: 'SID=1', ua: 'Mozilla' };
  const e = D.normEv(ev);
  const s = JSON.stringify(e);
  ok(e && e.dom === 'youtube.com' && e.name === 'My video.mp4' && e.code === 'blocked' && e.conns === 4, 'השדות המותרים נשמרים');
  ok(!('url' in e) && !('cookies' in e) && !('ua' in e), 'כתובת, עוגיות ו־User-Agent — לא נשמרים גם אם נשלחו');
  ok(!/videoplayback|AOq0|SID123|a@b\.com|1\.2\.3\.4/.test(s) && s.includes('<rr3---sn-x.googlevideo.com>'), 'ההודעה והשורות: רק הדומיין, בלי חתימה, עוגייה, מייל וכתובת IP בקישור');
  ok(D.normEv(Object.assign({}, ev, { k: 'x' })) === null && D.normEv(Object.assign({}, ev, { id: '../x' })) === null && D.normEv(Object.assign({}, ev, { code: 'A B' })).code === undefined, 'סוג / מזהה לא תקינים — נזרק; קוד לא תקין — בלי קוד');
  ok(D.normBatch({ cv: 0, ev: [ev] }) === null && D.normBatch({ cv: D.DMC_V, ev: [] }) === null, 'בלי הסכמה בנוסח הנוכחי / בלי אירועים — כלום');
  const big = D.normBatch({ cv: D.DMC_V, ev: Array(500).fill(ev), dev: { v: '1.0.42', sdk: 35, model: 'OnePlus CPH2747', x: 1 } });
  ok(big.ev.length === D.EV_MAX && big.dev.v === '1.0.42' && big.dev.sdk === 35 && !('x' in big.dev), 'עד 200 אירועים במנה, ופרטי המכשיר המותרים');
  const k1 = D.dmKey('ownerUid0001', 'snb', Date.UTC(2026, 9, 24), 'mo1abc-0123456789');
  ok(D.parseKey(k1) && !k1.includes('ownerUid0001') && k1.startsWith(D.userPrefix('ownerUid0001', 'snb')), 'הנתיב: hash של המשתמש, בלי uid');
  ok(D.expiredKey('dm/u/0123456789abcdef/2024-09/abcdef12.bin', Date.UTC(2026, 9, 24)) && !D.expiredKey('dm/u/0123456789abcdef/2024-10/abcdef12.bin', Date.UTC(2026, 9, 24)), '24 חודשים בדיוק');

  /* ---------- 2. השרתון ---------- */
  const sa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const fb = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  Object.assign(process.env, {
    R2L_ACCOUNT_ID: ACC, R2L_ACCESS_KEY_ID: 'AKTEST', R2L_SECRET_ACCESS_KEY: 'sekret/xyz', R2L_BUCKET: 'snb-studio',
    GDRIVE_SA_KEY: JSON.stringify({ client_email: 'sa@p.iam.gserviceaccount.com', private_key: sa.privateKey.export({ type: 'pkcs8', format: 'pem' }) }),
    LIBRARY_READERS: 'owner@example.com', SNB_SITEWATCH: 'off', SNB_ADMINWATCH: 'off', SNB_FUNDWATCH: 'off',
  });
  for (const k of ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET', 'IBKR_VAULT_KEY', 'STUDIO_USERS']) delete process.env[k];
  const gauth = require(path.join(root, 'ibkr-proxy/lib/gauth.js'));
  const R2 = require(path.join(root, 'ibkr-proxy/lib/r2.js'));
  const vault = require(path.join(root, 'ibkr-proxy/lib/vault.js'));
  const studio = require(path.join(root, 'ibkr-proxy/api/studio.js'));
  gauth._reset(); studio._reset(); R2._reset();
  const keys = { k1: fb.publicKey.export({ type: 'spki', format: 'pem' }) };
  const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const tnow = Math.floor(Date.now() / 1000);
  const tok = (sub, email) => {
    const hd = b64u({ alg: 'RS256', kid: 'k1' }), bd = b64u({ aud: 'yishaiguedj1-c786e', iss: 'https://securetoken.google.com/yishaiguedj1-c786e', sub, iat: tnow - 5, exp: tnow + 3000, email, email_verified: true });
    return hd + '.' + bd + '.' + crypto.sign('RSA-SHA256', Buffer.from(hd + '.' + bd), fb.privateKey).toString('base64url');
  };
  const A = tok('dmUserA00001', 'a@example.com'), B = tok('dmUserB00002', 'b@example.com');
  const R = fakeR2();
  const db = new Map();
  const J = (o, st = 200) => ({ status: st, ok: st < 300, json: async () => o, text: async () => JSON.stringify(o), headers: { get: () => null } });
  const fetchAll = async (u, opt = {}) => {
    if (u.includes('.r2.cloudflarestorage.com')) return R.fetch(u, opt);
    if (u.includes('oauth2.googleapis.com/token')) return J({ access_token: 'SA', expires_in: 3600 });
    const m = u.match(/\/documents\/([A-Za-z]+)\/([A-Za-z0-9_-]+)/);
    if (m) {
      const k = m[1] + '/' + m[2];
      if ((opt.method || 'GET') === 'GET') return db.has(k) ? J({ fields: db.get(k), updateTime: 't1' }) : J({}, 404);
      if (opt.method === 'PATCH') { db.set(k, Object.assign({}, db.get(k), JSON.parse(opt.body).fields)); return J({}); }
    }
    return J({}, 404);
  };
  const deps = () => ({ verify: { keys }, fetch: fetchAll, now: R.now });
  // אפליקציה נייטיב: בלי Origin בכלל
  const call = async (body) => {
    const res = { code: 0, j: null, setHeader() {}, status(c) { res.code = c; return res; }, json(o) { res.j = o; return res; }, end() { return res; } };
    await studio._handler({ method: 'POST', query: {}, body, headers: {}, socket: { remoteAddress: '9.9.9.9' } }, res, deps());
    return res;
  };
  const cfg = R2.config({ R2_ACCOUNT_ID: ACC, R2_ACCESS_KEY_ID: 'AKTEST', R2_SECRET_ACCESS_KEY: 'sekret/xyz', R2_BUCKET: 'snb-studio' });
  const keysIn = async (pre) => (await R2.list(cfg, { fetch: fetchAll, now: () => R.now }, pre)).map((x) => x.key);

  ok((await call({ op: 'dmLog', cv: D.DMC_V, ev: [ev] })).code === 401, 'בלי התחברות — 401');
  const tokApp = (sub, app) => {
    const hd = b64u({ alg: 'RS256', kid: 'k1' }), bd = b64u({ aud: 'yishaiguedj1-c786e', iss: 'https://securetoken.google.com/yishaiguedj1-c786e', sub, iat: tnow - 5, exp: tnow + 3000, app });
    return hd + '.' + bd + '.' + crypto.sign('RSA-SHA256', Buffer.from(hd + '.' + bd), fb.privateKey).toString('base64url');
  };
  ok((await call({ op: 'dmLog', idToken: tokApp('dmUserA00001', 'invest'), cv: D.DMC_V, ev: [ev] })).j.error === 'wrong_app', 'שלב 7: טוקן של Invest — 403 wrong_app (הפעולה של Studio)');
  ok((await call({ op: 'dmLog', idToken: A, cv: 0, ev: [ev] })).j.error === 'consent', 'הסכמה בנוסח ישן — 409 consent, לא נשמר');
  const r1 = await call({ op: 'dmLog', idToken: A, cv: D.DMC_V, ev: [ev, { k: 'bad' }], dev: { v: '1.0.1', sdk: 35 } });
  ok(r1.code === 200 && r1.j.saved === 1, 'נשמר — בלי Origin, לכל משתמש מחובר (גם בלי גישה לסטודיו)');
  await call({ op: 'dmLog', idToken: B, cv: D.DMC_V, ev: [ev] });
  const all = await keysIn('dm/');
  ok(all.length === 2 && all.every((k) => D.parseKey(k)) && !all.join().match(/dmUser/), 'שני פריטים בדלי, בנתיב בלי uid');
  const raw = await R2.getText(cfg, { fetch: fetchAll, now: () => R.now }, all.find((k) => k.startsWith(D.userPrefix('dmUserA00001', 'snb'))));
  ok(!/youtube\.com|blocked/.test(raw), 'בדלי — מוצפן (לא קריא בלי הכספת)');
  const open = vault.open(raw, 'dm|' + all.find((k) => k.startsWith(D.userPrefix('dmUserA00001', 'snb'))));
  ok(open && open.ev[0].code === 'blocked' && open.dev.sdk === 35 && !JSON.stringify(open).includes('videoplayback'), 'מתפענח בכספת: האירוע המנוקה ופרטי המכשיר');
  const fg = await call({ op: 'dmForget', idToken: A });
  const left = await keysIn('dm/');
  ok(fg.j.ok && fg.j.deleted === 1 && left.length === 1 && left[0].startsWith(D.userPrefix('dmUserB00002', 'snb')), '"מחק את הנתונים שלי" — רק של המשתמש');

  /* ---------- 3. משיכה לניתוח (שלב ג׳) ---------- */
  const AT = 'snbL_' + 'a'.repeat(32);
  ok((await call({ op: 'dmPull', at: AT })).code === 401, 'dmPull: טוקן לא רשום — 401');
  db.set('sysTokens/' + crypto.createHash('sha256').update(AT).digest('hex').slice(0, 40), { exp: { integerValue: String(R.now + 864e5) } });
  await call({ op: 'dmLog', idToken: A, cv: D.DMC_V, ev: [ev, Object.assign({}, ev, { k: 'done', code: '', bps: 5000, dom: 'example.org' })] });
  const pl = await call({ op: 'dmPull', at: AT, days: 7 });
  const plS = JSON.stringify(pl.j);
  ok(pl.j.ok && pl.j.items.length === 2 && pl.j.items.every((x) => /^[0-9a-f]{16}$/.test(x.u)), 'dmPull: היומנים של כולם, המשתמש רק כ־hash');
  ok(!/dmUser|@example\.com|videoplayback/.test(plS), 'dmPull: בלי uid, מייל או כתובת');
  ok(pl.j.stats.n === 3 && pl.j.stats.users === 2 && pl.j.stats.codes[0][0] === 'blocked' && pl.j.stats.ok === 33.3, 'dmPull: סיכום — אירועים, משתמשים, קודים, אחוז הצלחה');
  const plB = await call({ op: 'dmPull', at: AT, days: 7, before: [...(await keysIn('dm/'))].sort()[0] });
  ok(plB.j.ok && plB.j.items.length <= 1, 'dmPull: before — רק מה שלפני (המשך משיכה)');
  const DP = require(path.join(root, 'tools/dm-pull.js'));
  const md = DP.failsMd(pl.j.items), sm = DP.summaryMd(pl.j.items, 7);
  ok(md.includes('`blocked`') && md.includes('ERROR:') && sm.includes('הצלחה 33.3%'), 'tools/dm-pull.js: fails.md ו־summary.md');
  /* ---------- 4. מרכז הניהול (adminDm) ---------- */
  const callO = async (body) => {
    const res = { code: 0, j: null, setHeader() {}, status(c) { res.code = c; return res; }, json(o) { res.j = o; return res; }, end() { return res; } };
    await studio._handler({ method: 'POST', query: {}, body, headers: { origin: 'https://admin.thesnowball.app' }, socket: { remoteAddress: '9.9.9.8' } }, res, deps());
    return res;
  };
  process.env.LIBRARY_READERS = 'a@example.com';   // המנהל = המייל הראשון ברשימה
  ok(['not_admin', 'not_allowed'].includes((await callO({ op: 'adminDm', idToken: B })).j.error), 'adminDm: רק המנהל');
  const ad = await callO({ op: 'adminDm', idToken: A });
  const adS = JSON.stringify(ad.j);
  ok(ad.j.ok && ad.j.dm.st.n === 3 && ad.j.dm.fails.length === 2 && ad.j.dm.days.length === 14, 'adminDm: סיכום, כשלים אחרונים ו־14 ימים');
  ok(!/dmUser|@example\.com|videoplayback|"u":/.test(adS), 'adminDm: בלי uid, מייל, כתובת או hash של משתמש');
  ok(D.dmView([], R.now, 14).st.n === 0, 'dmView: בלי נתונים — אפס');
  console.log('\n' + n + ' בדיקות עברו');
})().catch((e) => { console.error(e); process.exit(1); });
