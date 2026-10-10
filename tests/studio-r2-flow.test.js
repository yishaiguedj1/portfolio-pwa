// ת4: מסלול מלא של עבודה ב־R2 דרך השרתון האמיתי (api/studio.js) — Firestore ו־R2 מדומים:
// יצירה במצב שרת → תיקייה ב־R2; העלאה מהטלפון (בחלקים) ורישום; העובד מוריד, מעלה תוצר ונקודת שמירה והשרתון מאמת;
// קישור צפייה לטלפון; הגנות (משתמש אחר, עבודה אחרת); מחיקה מנקה את R2. Routine נשאר ב־Drive; בלי R2 — Drive.
// הרצה: node tests/studio-r2-flow.test.js
const path = require('path');
const crypto = require('crypto');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const { fakeR2, ENV } = require('./_r2fake');

(async () => {
  const sa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const fb = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  Object.assign(process.env, ENV, {
    GDRIVE_SA_KEY: JSON.stringify({ client_email: 'sa@p.iam.gserviceaccount.com', private_key: sa.privateKey.export({ type: 'pkcs8', format: 'pem' }) }),
    LIBRARY_READERS: 'owner@example.com', STUDIO_USERS: 'other@example.com',
  });
  delete process.env.IBKR_VAULT_KEY;
  const gauth = require(path.join(root, 'ibkr-proxy/lib/gauth.js'));
  const R2 = require(path.join(root, 'ibkr-proxy/lib/r2.js'));
  const SR = require(path.join(root, 'ibkr-proxy/lib/studior2.js'));
  const S = require(path.join(root, 'ibkr-proxy/lib/studio.js'));
  const studio = require(path.join(root, 'ibkr-proxy/api/studio.js'));
  const store = await import(path.join(root, 'studiostore.js'));
  gauth._reset(); studio._reset(); R2._reset();

  const keys = { k1: fb.publicKey.export({ type: 'spki', format: 'pem' }) };
  const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const tnow = Math.floor(Date.now() / 1000);
  const tok = (sub, email) => {
    const hd = b64u({ alg: 'RS256', kid: 'k1' }), bd = b64u({ aud: 'yishaiguedj1-c786e', iss: 'https://securetoken.google.com/yishaiguedj1-c786e', sub, iat: tnow - 5, exp: tnow + 3000, email, email_verified: true });
    return hd + '.' + bd + '.' + crypto.sign('RSA-SHA256', Buffer.from(hd + '.' + bd), fb.privateKey).toString('base64url');
  };
  const OWNER = tok('ownerUid0001', 'owner@example.com'), OTHER = tok('otherUid0002', 'other@example.com');

  /* Firestore מדומה (כתיבה חלקית, כתיבה בתנאי, runQuery בשוויונות) + R2 מדומה */
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
  const deps = () => ({ verify: { keys }, fetch: fetchAll, now: R.now });
  const call = async (body, worker) => {
    const res = { code: 0, j: null, setHeader() {}, status(c) { res.code = c; return res; }, json(o) { res.j = o; return res; }, end() { return res; } };
    const req = { method: 'POST', query: {}, body, headers: worker ? {} : { origin: 'https://yishaiguedj1.github.io' }, socket: { remoteAddress: '9.9.9.9' } };
    await studio._handler(req, res, deps());
    return res;
  };
  const phone = (who) => (op, b) => call(Object.assign({}, b, { op, idToken: who })).then((r) => r.j);
  const api = phone(OWNER);
  const put = async (url, body, hd, onP) => {
    let r; try { r = await R.fetch(url, { method: 'PUT', body }); } catch (e) { return { status: 0 }; }
    if (onP) onP(body.size);
    return { status: r.status === 403 ? 0 : r.status };
  };

  /* ---------- 1. יצירה במצב שרת → תיקייה ב־R2 ---------- */
  const MiB = 1024 * 1024;
  const video = crypto.randomBytes(9 * MiB + 77), audio = crypto.randomBytes(300000);
  const spec = { name: 'lecture.mp4', size: video.length, type: 'video/mp4', dur: 600, from: 'en', to: ['he'], mode: 'sonnet-medium', out: ['same'], eng: 'api', cap: 5 };
  let j = await api('create', { spec });
  ok(j.ok && SR.isFolder(j.job.folder) && j.job.folder === SR.folderFor(j.job.id), 'עבודה במצב שרת נוצרת עם תיקייה ב־R2');
  const JOB = j.job.id, FOLDER = j.job.folder;
  const jr = await api('create', { spec: Object.assign({}, spec, { eng: undefined }) });
  ok(jr.ok && !jr.job.folder, 'עבודת Routine — בלי תיקייה ב־R2 (נשארת ב־Drive)');
  for (const k of Object.keys(ENV)) delete process.env[k];
  const jd = await api('create', { spec });
  ok(jd.ok && !jd.job.folder, 'בלי הגדרות R2 בשרתון — גם עבודה במצב שרת נשארת ב־Drive');
  Object.assign(process.env, ENV); R2._reset();

  /* ---------- 2. העלאה מהטלפון ורישום ---------- */
  let saved = null;
  const fa = await store.r2Upload({ api, job: store.r2JobOf(FOLDER), name: 'lecture — audio.m4a', blob: new Blob([audio]), size: audio.length, mime: 'audio/mp4', onState: (s) => { saved = s; } }, { put, sleep: async () => {} });
  ok(SR.inFolder(fa.id, FOLDER) && saved && saved.id === fa.id, 'הקול עלה ל־R2 (מזהה בתיקייה, המצב נשמר)');
  ok(db.has('studioUp/' + fa.id) && db.get('studioUp/' + fa.id).fields.f.stringValue === FOLDER, 'רשומת ההעלאה במסמך משלה (לא במסמך העבודה)');
  j = await api('file', { job: JOB, which: 'a', id: fa.id, folder: FOLDER });
  ok(j.ok && j.job.files.a && j.job.files.a.size === audio.length, 'רישום הקול — השרתון אימת מול R2 (קיים, בתיקייה, הגודל)');
  const fv = await store.r2Upload({ api, job: store.r2JobOf(FOLDER), name: 'lecture.mp4', blob: new Blob([video]), size: video.length, mime: 'video/mp4' }, { put, sleep: async () => {} });
  j = await api('file', { job: JOB, which: 'v', id: fv.id, folder: FOLDER });
  ok(j.ok && j.job.files.v.size === video.length, 'רישום הסרטון — בגודל של המקור');
  const fbad = await store.r2Upload({ api, job: store.r2JobOf(FOLDER), blob: new Blob([Buffer.alloc(10)]), size: 10 }, { put, sleep: async () => {} });
  ok((await api('file', { job: JOB, which: 'v', id: fbad.id, folder: FOLDER })).error === 'file_size', 'סרטון בגודל אחר מהמקור — נדחה');
  ok((await api('file', { job: JOB, which: 'a', id: SR.newId(FOLDER), folder: FOLDER })).error === 'file_bad', 'קובץ שלא קיים ב־R2 — נדחה');
  ok((await api('file', { job: JOB, which: 'a', id: fa.id, folder: SR.folderFor('j' + 'Z'.repeat(20)) })).error === 'bad_params', 'תיקייה של עבודה אחרת — נדחה');

  /* ---------- 3. הגנות ---------- */
  const other = phone(OTHER);
  ok((await other('r2url', { job: JOB, id: fv.id })).error === 'no_job', 'משתמש אחר — לא מקבל קישור לקובץ');
  ok((await other('r2up', { job: JOB, size: 10 })).error === 'no_job', 'משתמש אחר — לא מעלה לתיקייה');
  const jo = await other('create', { spec });
  ok((await other('r2url', { job: jo.job.id, id: fv.id })).error === 'bad_id', 'עבודה של משתמש אחר עם מזהה שלי — bad_id');
  ok((await api('r2up', { job: jr.job.id, size: 10 })).error === 'not_r2', 'עבודה בלי תיקייה ב־R2 — לא מעלים ל־R2');

  /* ---------- 4. העובד: הורדה, תוצר, נקודת שמירה ---------- */
  const KEY = crypto.randomBytes(32).toString('base64url');
  const doc = db.get('studioJobs/' + JOB).fields;
  Object.assign(doc, { kh: { stringValue: crypto.createHash('sha256').update(KEY).digest('hex') }, kx: { integerValue: String(R.now + 3600e3) }, state: { stringValue: 'running' } });
  const wrk = (op, b) => call(Object.assign({}, b, { op, job: JOB, key: KEY }), true).then((r) => r.j);
  const g = await wrk('r2get', { id: fv.id });
  const gr = await R.fetch(g.url);
  ok(g.ok && g.size === video.length && Buffer.compare(Buffer.from(await gr.arrayBuffer()), video) === 0, 'העובד מוריד את הסרטון מ־R2 (קישור ל־6 שעות)');
  ok((await call({ op: 'r2get', job: JOB, key: 'x'.repeat(43), id: fv.id }, true)).code === 403, 'בלי המפתח של העבודה — אין גישה');
  const srt = Buffer.from('1\n00:00:01,000 --> 00:00:02,000\nשלום\n');
  let u = await wrk('r2wup', { size: srt.length, type: 'application/x-subrip', name: 'lecture.he.srt' });
  ok(u.ok && SR.inFolder(u.id, FOLDER) && u.urls[1], 'העובד פותח העלאה של תוצר');
  await R.fetch(u.urls[1], { method: 'PUT', body: srt });
  const d1 = await wrk('r2wdone', { id: u.id, up: u.up });
  ok(d1.ok && d1.file.size === srt.length, 'העלאת התוצר הושלמה');
  let rp = await wrk('report', { st: 'sv', p: 1, out: [{ id: u.id, name: 'lecture.he.srt', size: srt.length, k: 'srt' }] });
  ok(rp.ok && JSON.parse(db.get('studioJobs/' + JOB).fields.fo.stringValue)[0].id === u.id, 'דיווח התוצר — השרתון אימת מול R2 ושמר');
  rp = await call({ op: 'report', job: JOB, key: KEY, out: [{ id: SR.newId(FOLDER), name: 'x.srt', size: 3, k: 'srt' }] }, true);
  ok(rp.code === 400 && rp.j.error === 'out_bad', 'תוצר שלא קיים ב־R2 — נדחה');
  u = await wrk('r2wup', { size: 100, type: 'application/gzip', name: 'ck' });
  await R.fetch(u.urls[1], { method: 'PUT', body: Buffer.alloc(100) });
  await wrk('r2wdone', { id: u.id, up: u.up });
  rp = await wrk('report', { ck: { s: 'al', id: u.id, size: 100 } });
  ok(rp.ok && JSON.parse(db.get('studioJobs/' + JOB).fields.ck.stringValue).some((c) => c.id === u.id), 'נקודת שמירה ב־R2 — אומתה ונשמרה');
  const ckId = u.id;
  ok((await wrk('r2del', { id: ckId })).ok && !R.objs.has(SR.keyOf('ownerUid0001', ckId)), 'העובד מוחק נקודת שמירה ישנה');
  /* החלפת תוכן הסרטון (איכויות הצפייה) — אותו מזהה */
  const packed = Buffer.from('packed');
  u = await wrk('r2wup', { id: fv.id, replace: true, size: packed.length, type: 'video/mp4' });
  ok(u.ok && u.id === fv.id, 'העובד מחליף את תוכן הסרטון באותו מזהה');
  await R.fetch(u.urls[1], { method: 'PUT', body: packed });
  ok((await wrk('r2wdone', { id: fv.id, up: u.up })).ok && Buffer.compare(R.objs.get(SR.keyOf('ownerUid0001', fv.id)), packed) === 0, 'התוכן הוחלף');
  ok((await wrk('r2wup', { id: SR.newId(SR.folderFor('j' + 'Q'.repeat(20))), size: 5 })).error === 'bad_id', 'העובד לא כותב לתיקייה של עבודה אחרת');

  /* ---------- 5. קישור צפייה לטלפון ---------- */
  const view = await api('r2url', { job: JOB, id: d1.id || SR.newId(FOLDER) });
  const vr = view.ok ? await R.fetch(view.url) : null;
  ok(view.ok && vr && vr.status === 200 && /X-Amz-Expires=3600/.test(view.url), 'הטלפון מקבל קישור צפייה לשעה');

  /* ---------- 6. מחיקה מנקה את R2 ---------- */
  const keysBefore = [...R.objs.keys()].filter((k) => k.includes(FOLDER)).length;
  ok(keysBefore >= 3, 'לפני המחיקה: הקבצים של העבודה ב־R2');
  db.get('studioJobs/' + JOB).fields.state = { stringValue: 'done' };   // העבודה הסתיימה (רק אז מוחקים)
  const rm = await api('remove', { job: JOB });
  ok(rm.ok && ![...R.objs.keys()].some((k) => k.includes(FOLDER)) && ![...db.keys()].some((k) => k.startsWith('studioUp/' + FOLDER)), 'מחיקת העבודה מוחקת את כל הקבצים שלה מ־R2 ואת רשומות ההעלאה');

  /* תיקייה משותפת (עבודת משנה / סט הזהב) — לא נמחקת כל עוד עבודה אחרת משתמשת בה */
  j = await api('create', { spec });
  const J2 = j.job.id, F2 = j.job.folder;
  const f2 = await store.r2Upload({ api, job: store.r2JobOf(F2), blob: new Blob([Buffer.alloc(50)]), size: 50 }, { put, sleep: async () => {} });
  const clone = Object.assign({}, db.get('studioJobs/' + J2).fields);
  db.set('studioJobs/jCLONECLONECLONECLONE', { fields: Object.assign({}, clone, { kind: { stringValue: 'tr' } }), ut: 'tc' });
  await api('remove', { job: J2 });
  ok(R.objs.has(SR.keyOf('ownerUid0001', f2.id)), 'עבודה אחרת עדיין משתמשת בתיקייה — הקבצים נשארים');
  await api('remove', { job: 'jCLONECLONECLONECLONE' });
  ok(!R.objs.has(SR.keyOf('ownerUid0001', f2.id)), 'האחרונה שמשתמשת בתיקייה נמחקה — הקבצים נמחקים');

  console.log('\n' + n + ' בדיקות עברו');
})().catch((e) => { console.error('FAIL -', e); process.exit(1); });
