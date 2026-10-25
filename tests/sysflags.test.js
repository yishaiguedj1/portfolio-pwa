// 15/10/2026 — מצב תחזוקה והגדרות ודגלים (בקשת המשתמש, מהמחקר על ServiceNow). השרתון האמיתי עם Firestore ו־R2 מדומים:
// op ציבורי cfg (בלי התחברות, רק מה שציבורי); adminCfg — מנהל בלבד; תחזוקה חוסמת יצירה/התחלה/המשך (חוץ מהמנהל) ופגה לבד;
// כל דגל שבמסך נאכף (st_routine, st_api, learn); ההודעה — טקסט בלבד. הרצה: node tests/sysflags.test.js
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const { fakeR2, ACC } = require('./_r2fake');

(async () => {
  const SF = require(path.join(root, 'ibkr-proxy/lib/sysflags.js'));
  const T0 = Date.UTC(2026, 9, 10, 12);
  /* ---------- 1. טהור ---------- */
  ok(SF.normMsg('עבודה על השרת <b>היום</b> https://evil.example/x עד 18:00') === 'עבודה על השרת b היום /b עד 18:00', 'ההודעה — טקסט בלבד, בלי תגיות וקישורים');
  let d = Object.assign({}, SF.applyAdmin({}, { mt: { on: true, msg: 'שדרוג', til: T0 + 3600e3 } }, T0));
  ok(SF.maintOn(d, T0) && !SF.maintOn(d, T0 + 3600e3) && d.mtAt === T0, 'תחזוקה עם שעת סיום — פגה לבד');
  ok(SF.applyAdmin({}, { mt: { on: true, til: T0 - 1 } }, T0) === null && SF.applyAdmin({}, { mt: { on: true, til: T0 + 8 * 864e5 } }, T0) === null, 'שעת סיום בעבר / יותר משבוע — נדחה');
  ok(SF.applyAdmin({}, { flag: 'nope', on: false }, T0) === null && SF.applyAdmin({}, { flag: 'push', on: 'x' }, T0) === null, 'דגל לא מוכר / ערך לא בוליאני — נדחה');
  const d2 = SF.applyAdmin({ flOff: 'push,zzz' }, { flag: 'learn', on: false }, T0);
  ok(d2.flOff === 'learn,push', 'רשימת הכבויים — לפי הקטלוג, בלי דגלים לא מוכרים');
  const pc = SF.publicCfg({ flOff: 'push', mtOn: 1, mtMsg: 'x', mtAt: 5 }, T0);
  ok(pc.f.push === false && pc.f.learn === true && pc.m.on && !('at' in pc.m) && Object.keys(pc.f).length === SF.KEYS.length, 'לאפליקציות: התחזוקה והדגלים בלבד (בלי מתי הודלק)');
  ok(SF.FLAGS.every((f) => f.where), 'לכל דגל — המקום שבו הוא נאכף');
  const studioSrc = require('fs').readFileSync(path.join(root, 'ibkr-proxy/api/studio.js'), 'utf8');
  const appSrc = require('fs').readFileSync(path.join(root, 'app.js'), 'utf8');
  for (const f of SF.FLAGS) {
    const src = /^app\.js/.test(f.where) ? appSrc : studioSrc;
    ok(new RegExp("['\"]" + f.k + "['\"]").test(src), 'הדגל ' + f.k + ' באמת נבדק בקוד (' + f.where.split(' ')[0] + ')');
  }

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
  const spec = { name: 'lecture.mp4', size: 1000, type: 'video/mp4', dur: 600, from: 'en', to: ['he'], mode: 'sonnet-medium', out: ['srt'] };
  const newJob = async () => {
    const j = await api('create', { spec });
    const id = j.job.id, key = crypto.randomBytes(32).toString('base64url');
    Object.assign(db.get('studioJobs/' + id).fields, { kh: { stringValue: crypto.createHash('sha256').update(key).digest('hex') }, kx: { integerValue: String(NOW + 3600e3) }, state: { stringValue: 'running' } });
    return { id, put: (lc) => call({ op: 'learnPut', job: id, key, lc }, true).then((r) => r.j) };
  };
  const body = (o) => zlib.gzipSync(Buffer.from(JSON.stringify(o))).toString('base64');
  const LR = require(path.join(root, 'ibkr-proxy/lib/studiolearn.js'));
  const keysIn = async (pre) => (await R2.list(R2.config({ R2_ACCOUNT_ID: ACC, R2_ACCESS_KEY_ID: 'AKTEST', R2_SECRET_ACCESS_KEY: 'sekret/xyz', R2_BUCKET: 'snb-studio' }), { fetch: fetchAll, now: () => NOW }, pre)).map((x) => x.key);

  /* ---------- 2. השרתון ---------- */
  let r = await call({ op: 'cfg' });
  ok(r.code === 200 && r.j.cfg.m === null && r.j.cfg.f.st_api === true, 'cfg בלי התחברות — ברירת המחדל: בלי תחזוקה, הכל דולק');
  ok((await raw('adminCfg', {}, OTHER)).code === 403, 'adminCfg — רק למנהל');
  let a = await api('adminCfg', { set: { mt: { on: true, msg: 'עובדים על השרת' } } });
  ok(a.ok && a.cfg.mt.on && a.cfg.mt.at === NOW && a.cfg.flags.length === SF.KEYS.length, 'המנהל מדליק תחזוקה');
  r = await call({ op: 'cfg' });
  ok(r.j.cfg.m && r.j.cfg.m.on && r.j.cfg.m.msg === 'עובדים על השרת', 'האפליקציות רואות את התחזוקה ואת ההודעה');
  let c = await other('create', { spec });
  ok(c.error === 'maint' && c.msg === 'עובדים על השרת', 'בזמן תחזוקה — עבודה חדשה נחסמת (עם ההודעה)');
  c = await api('create', { spec });
  ok(c.ok, 'המנהל כן יכול (לבדוק שהכל עובד לפני שמכבים)');
  const jid = c.job.id;
  a = await api('adminCfg', { set: { mt: { on: false } } });
  ok(!a.cfg.mt.on && (await call({ op: 'cfg' })).j.cfg.m === null, 'כיבוי — חוזרים לרגיל');
  a = await api('adminCfg', { set: { mt: { on: true, msg: 'עד הצהריים', til: NOW + 3600e3 } } });
  ok((await other('create', { spec })).error === 'maint', 'תחזוקה מתוזמנת — חוסמת עד הזמן');
  NOW += 3601e3; R.now = NOW;
  studio._reset();
  ok((await call({ op: 'cfg' })).j.cfg.m === null, 'אחרי הזמן — נגמרת לבד');
  c = await other('create', { spec });
  ok(c.ok, 'ואחריה אפשר ליצור שוב');

  /* דגלים */
  a = await api('adminCfg', { set: { flag: 'st_routine', on: false } });
  ok(a.ok && a.cfg.f.st_routine === false, 'המנהל מכבה את "תרגום ב־Claude שבמנוי"');
  c = await other('create', { spec });
  ok(c.error === 'flag_off' && c.fl === 'st_routine', 'הדגל כבוי — עבודת Routine חדשה נחסמת');
  ok((await other('create', { spec: Object.assign({}, spec, { eng: 'api', cap: 3 }) })).error !== 'flag_off', 'עבודה במצב שרת — לא מושפעת מהדגל של Routine');
  await api('adminCfg', { set: { flag: 'st_routine', on: true } });
  ok((await api('adminCfg', { set: { flag: 'bogus', on: false } })).error === 'bad_params', 'דגל לא מוכר — 400');

  /* learn — גם בעובד */
  await api('learnPref', { ack: true, tv: 2 });
  for (const [k, v] of db) if (k.startsWith('studioJobs/')) v.fields.state = { stringValue: 'done' };
  const nj = await newJob();
  const lc = zlib.gzipSync(Buffer.from(JSON.stringify({ v: 1, cu: [{ i: 1, s: 0, e: 1, k: 'S1', en: 'a', d: 'א' }] }))).toString('base64');
  await api('adminCfg', { set: { flag: 'learn', on: false } });
  ok((await nj.put(lc)).saved === false, 'הדגל "איסוף למאגר הלמידה" כבוי — הטקסט לא נשמר');
  await api('adminCfg', { set: { flag: 'learn', on: true } });
  ok((await nj.put(lc)).saved === true, 'דולק שוב — נשמר');
  ok(jid, 'עבודת המנהל נוצרה בזמן התחזוקה');

  // 25/10/2026: חשבונות בדיקה (sysCfg.tsEm) — גישה לסטודיו כמו משתמש רגיל, בלי המצבים הנעולים
  {
    ok(SF.applyAdmin({}, { ts: 'A@Example.com', on: true }, T0).tsEm === 'a@example.com' && SF.applyAdmin({}, { ts: 'x', on: true }, T0) === null
      && SF.applyAdmin({ tsEm: 'a@example.com,b@example.com' }, { ts: 'a@example.com', on: false }, T0).tsEm === 'b@example.com', 'חשבונות בדיקה: הוספה/הסרה, מייל לא תקין נדחה');
    ok(SF.tsHas({ tsEm: 'a@example.com' }, { email: 'a@example.com', verified: true }) && !SF.tsHas({ tsEm: 'a@example.com' }, { email: 'a@example.com', verified: false })
      && !('ts' in SF.publicCfg({ tsEm: 'a@example.com' }, T0)) && SF.adminCfg({ tsEm: 'a@example.com' }, T0).ts.join() === 'a@example.com', 'חשבונות בדיקה: רק מייל מאומת; לא יוצא ב־cfg הציבורי');
    const TEST = tok('testUid00003', 'tester@example.com');
    const tst = (op, b) => call(Object.assign({}, b, { op, idToken: TEST }));
    ok((await tst('status', {})).j.error === 'not_allowed', 'חשבון שלא ברשימה — אין גישה לסטודיו');
    const ad = await api('adminCfg', { set: { ts: 'tester@example.com', on: true } });
    ok(ad.ok && ad.cfg.ts.join() === 'tester@example.com', 'המנהל מוסיף חשבון בדיקה');
    studio._reset();
    const st = (await tst('status', {})).j;
    ok(st.ok && st.mf === false, 'חשבון בדיקה נכנס — בלי כל המודלים (כמו משתמש רגיל)');
    // 25/10/2026: הורדה מקישור פתוחה לחשבונות הבדיקה — עוברים את בדיקת ההרשאה (כאן נעצרים רק כי R2 לא מוגדר בבדיקה)
    const up = await tst('urlProbe', { url: 'https://vimeo.com/76979871' });
    ok(up.code === 503 && up.j.error === 'r2_needed', 'חשבון בדיקה: בדיקת קישור — מותרת (לא not_allowed)');
    const cu = await tst('create', { spec: Object.assign({}, spec, { mode: 'haiku-high', src: 'url', url: 'https://vimeo.com/76979871', type: 'video/url', eng: 'api' }) });
    ok(cu.j.error !== 'not_allowed', 'חשבון בדיקה: עבודה מקישור — לא נחסמת בהרשאה');
    ok((await tst('create', { spec: Object.assign({}, spec, { mode: 'opus-medium' }) })).j.error === 'mode_locked', 'חשבון בדיקה: מצב נעול — נחסם');
    ok((await tst('create', { spec: Object.assign({}, spec, { mode: 'haiku-high' }) })).j.ok, 'חשבון בדיקה: "רגיל" — עובד');
    const us = await api('adminUsers', {});
    ok(us.ok && us.users.st.ts.join() === 'tester@example.com', 'במשתמשים והרשאות — הרשימה מוצגת');
    await api('adminCfg', { set: { ts: 'tester@example.com', on: false } });
    studio._reset();
    ok((await tst('status', {})).j.error === 'not_allowed', 'הוסר מהרשימה — הגישה נסגרת');
    const OUT = tok('outUid000004', 'out@example.com');
    ok((await call({ op: 'urlProbe', url: 'https://vimeo.com/1', idToken: OUT })).j.error === 'not_allowed', 'מי שלא ברשימות — בלי בדיקת קישור');
  }
  // 15/10/2026: הודעה מהמנהל (מרכז הניהול ← הודעות)
  {
    const t0 = Date.parse('2026-10-15T10:00:00Z');
    const pa = SF.applyAdmin({}, { an: { on: true, t: 'עדכון <b>', b: 'קישור https://evil.example זה', apps: ['studio', 'zz'] } }, t0);
    ok(pa && pa.anId === t0 && pa.anT === 'עדכון b' && pa.anB === 'קישור זה' && pa.anApps === 'studio', 'הודעה: טקסט נקי, בלי קישורים, רק אפליקציות מהקטלוג');
    ok(SF.applyAdmin({}, { an: { on: true, t: '', b: '', apps: ['studio'] } }, t0) === null && SF.applyAdmin({}, { an: { on: true, t: 'x', apps: [] } }, t0) === null, 'הודעה: בלי טקסט או בלי אפליקציה — נדחית');
    ok(SF.publicCfg(pa, t0).an.id === t0 && SF.publicCfg(Object.assign({}, pa, { anTil: t0 + 1 }), t0 + 2).an === null && SF.publicCfg({ anId: 0, anT: 'x', anApps: 'invest' }, t0).an === null, 'הודעה: יוצאת ב־cfg הציבורי, פגה בזמן, כבויה = null');
    ok(SF.applyAdmin(pa, { an: { on: false } }, t0).anId === 0 && SF.adminCfg(pa, t0).anD.apps.join() === 'studio', 'הודעה: כיבוי; למנהל — הטיוטה');
  }
  console.log('\nכל ' + n + ' הבדיקות עברו ✓');
})().catch((e) => { console.error(e); process.exit(1); });
