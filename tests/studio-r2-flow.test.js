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
    const lm = url.match(/\/documents\/([A-Za-z]+)\?(.*)$/);   // רשימת אוסף (הגיבוי היומי)
    if (lm && (opt.method || 'GET') === 'GET') {
      return J({ documents: [...db.entries()].filter(([k]) => k.startsWith(lm[1] + '/')).map(([k, v]) => ({ name: 'projects/p/databases/(default)/documents/' + k, fields: v.fields, updateTime: v.ut })) });
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
  const spec = { name: 'lecture.mp4', size: video.length, type: 'video/mp4', dur: 600, from: 'en', to: ['he'], mode: 'haiku-high', out: ['same'], eng: 'api', cap: 5 };
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

  /* ---------- 7. מילון המונחים ב־R2 (11/10) ---------- */
  let gu = await api('glossUrl', {});
  ok(gu.ok && gu.r2 && /\/gl\/ownerUid0001\.tsv\?/.test(gu.get) && /X-Amz-Expires=300/.test(gu.put), 'מילון: קישורים חתומים לקובץ של המשתמש בלבד (gl/<uid>.tsv), לחמש דקות');
  ok((await R.fetch(gu.get)).status === 404, 'מילון: עוד אין קובץ — 404 (הטלפון ינסה את Drive ויעביר)');
  const tsv = S.glFormat([['Moat', 'חפיר', ''], ['Berkshire', 'ברקשייר', 'שם']]);
  ok((await R.fetch(gu.put, { method: 'PUT', body: tsv })).status === 200, 'מילון: הטלפון כותב ישירות ל־R2');
  ok(S.glParse(await (await R.fetch(gu.get)).text()).length === 2, 'מילון: וקורא בחזרה');
  const go = await other('glossUrl', {});
  ok(go.ok && /\/gl\/otherUid0002\.tsv\?/.test(go.get) && (await R.fetch(go.get)).status === 404, 'מילון: משתמש אחר — הקובץ שלו, לא של בעלים אחר');
  // העובד מקבל את המילון בתוך תשובת הלקיחה (גם Routine — בלי גישה ל־R2)
  j = await api('create', { spec: Object.assign({}, spec, { eng: undefined }) });
  const J3 = j.job.id, K3 = crypto.randomBytes(32).toString('base64url');
  Object.assign(db.get('studioJobs/' + J3).fields, { kh: { stringValue: crypto.createHash('sha256').update(K3).digest('hex') }, kx: { integerValue: String(R.now + 3600e3) }, state: { stringValue: 'queued' }, fired: { integerValue: String(R.now) } });
  const cl = (await call({ op: 'claim', job: J3, key: K3 }, true)).j;
  ok(cl.ok && Array.isArray(cl.job.gl) && cl.job.gl.length === 2 && cl.job.gl[1][0] === 'Berkshire', 'מילון: העובד (גם Routine) מקבל אותו בלקיחה');
  for (const k of Object.keys(ENV)) delete process.env[k];
  gu = await api('glossUrl', {});
  const cl2 = (await call({ op: 'claim', job: J3, key: K3 }, true)).j;
  Object.assign(process.env, ENV); R2._reset();
  ok(gu.ok && gu.r2 === false && cl2.ok && cl2.job.gl === null, 'מילון: בלי R2 בשרתון — r2:false והעובד קורא מ־Drive כמו קודם');

  /* ---------- 7ב. A1 (1/11/2026): כרטיס הסדרה — smGet / smEdit (sm/<uid>.json, רק של המשתמש). שמות בדויים.
     02/11/2026 (PR2 2.3/2.10): כתיבה רק דרך smUpdate (If-Match) — 412 → ניסיון חוזר; קריאה כושלת = שגיאה ובלי כתיבה ---------- */
  {
    const sk = 'sm/ownerUid0001.json';
    let d0 = S.smMerge({}, S.seriesOf('Show.S01E01.mkv'), { gl: [['Vexley', 'וקסלי']], ch: [['נעמה', 'm', '']] }, 100);
    d0 = S.smMerge(d0, S.seriesOf('Show.S01E02.mkv'), { gl: [['Vexley', 'וקסלי']] }, 100);
    R.objs.set(sk, Buffer.from(JSON.stringify(d0)));
    R.meta.set(sk, { type: 'application/json', am: {} });
    let g = await api('smGet', {});
    ok(g.ok && g.r2 && g.s.length === 1 && g.s[0].k === 'show' && g.s[0].at === 100 && JSON.stringify(g.s[0].gl[0]) === '["Vexley","וקסלי"]'
      && JSON.stringify(g.s[0].ch[0]) === '["נעמה","m",""]', 'סדרה: smGet — הכרטיס של המשתמש, בצורה של הטלפון (בלי n/l/f)');
    ok((await other('smGet', {})).s.length === 0, 'סדרה: משתמש אחר לא רואה את הכרטיס');
    ok((await api('smEdit', { k: 'show', at: 99, gl: [['Vexley', 'וקסלה']] })).error === 'stale', 'סדרה: גרסה ישנה (העובד כתב בינתיים) — stale');
    ok((await api('smEdit', { k: 'nope', at: 100, gl: [['A', 'א']] })).error === 'sm_none', 'סדרה: סדרה שלא קיימת');
    ok((await api('smEdit', { k: 'show', at: 100 })).error === 'bad_params', 'סדרה: בלי שינוי — bad_params');
    // קריאה כושלת — שגיאה, ולא כותבים כלום (עד היום: "אין סדרות" / קובץ חדש בלי שאר הסדרות)
    const before = R.objs.get(sk);
    R.fail = (m, u) => (u.pathname.endsWith('/' + sk) && m === 'GET' ? 500 : 0);
    const gf = await api('smGet', {}), ef = await api('smEdit', { k: 'show', at: 100, gl: [['Vexley', 'וקסלה']] });
    R.fail = () => 0;
    ok(gf.error === 'sm_read' && ef.error === 'sm_read' && R.objs.get(sk) === before, 'סדרה: קריאה כושלת — שגיאה, והקובץ לא נגע');
    // 412 (מישהו כתב בינתיים) — ניסיון חוזר, ובסוף הכתיבה עוברת
    let n412 = 0;
    R.fail = (m, u) => (u.pathname.endsWith('/' + sk) && m === 'PUT' && n412++ < 1 ? 412 : 0);
    g = await api('smEdit', { k: 'show', at: 100, gl: [['Vexley', 'וקסלה']], ch: [['נעמה', 'f']] });
    R.fail = () => 0;
    ok(n412 === 2 && g.ok && g.s[0].gl[0][1] === 'וקסלה' && g.s[0].ch[0][1] === 'f' && g.s[0].at > 100, 'סדרה: 412 → ניסיון חוזר; הכתיב והמגדר שלך גוברים');
    const raw = S.smParse(R.objs.get(sk).toString('utf8')).s.show;
    ok(JSON.stringify(raw.gl[0]) === JSON.stringify(['Vexley', 'וקסלה', 2, 2, S.SM_LOCK]) && raw.ch[0][5] === S.SM_LOCK, 'סדרה: עריכה שומרת n/l ונועלת (f=1)');
    g = await api('smEdit', { k: 'show', at: g.s[0].at, drop: true });
    ok(g.ok && g.s.length === 0 && (await api('smGet', {})).s.length === 0, 'סדרה: מחיקת הסדרה');
  }

  /* ---------- 8. תיקיות יתומות ב־R2 — סריקה וניקוי (11/10) ---------- */
  studio._reset();
  j = await api('create', { spec });
  const LIVE = S.fromFields(db.get('studioJobs/' + j.job.id).fields).folder, ORPH = 'R2_jORPHANorphanORPHAN12', KEPT = 'R2_jKEPTkeptKEPTkeptKEPT', OTHERF = 'R2_jOTHERotherOTHERother';
  ok(SR.isFolder(LIVE) && SR.isFolder(ORPH) && SR.isFolder(KEPT) && SR.isFolder(OTHERF), 'יתומות: מזהים תקינים');
  R.objs.set('st/ownerUid0001/' + LIVE + '_aaaaaaaaaaaa', Buffer.alloc(10));
  R.objs.set('st/ownerUid0001/' + ORPH + '_bbbbbbbbbbbb', Buffer.alloc(300));
  R.objs.set('st/ownerUid0001/' + ORPH + '_cccccccccccc', Buffer.alloc(200));
  R.objs.set('st/ownerUid0001/' + KEPT + '_dddddddddddd', Buffer.alloc(50));
  R.objs.set('st/otherUid0002/' + OTHERF + '_eeeeeeeeeeee', Buffer.alloc(70));
  R.objs.set('st/ownerUid0001/notafolder', Buffer.alloc(5));
  // עבודה שעוד קיימת (אצל אחר / מחוץ לרשימה) — לא נוגעים בתיקייה שלה
  db.set('studioJobs/' + KEPT.slice(3), { fields: { uid: { stringValue: 'someoneElse01' }, kind: { stringValue: 'tr' } }, ut: 'tk' });
  const sc8 = await api('scan', {});
  const fo = sc8.ok && sc8.sc.f.find((x) => x.k === 'orphans');
  ok(fo && fo.n === 1 && fo.b === 500, 'יתומות: הסריקה מוצאת תיקייה אחת ב־R2 (500 בתים) — בלי Drive מחובר');
  const cr = await api('clean', { k: 'orphans' });
  ok(cr.ok && cr.n === 1, 'יתומות: "נקה" מוחק תיקייה אחת');
  ok(![...R.objs.keys()].some((k) => k.includes(ORPH)), 'יתומות: כל הקבצים של התיקייה נמחקו');
  ok(R.objs.has('st/ownerUid0001/' + LIVE + '_aaaaaaaaaaaa'), 'יתומות: תיקייה של עבודה קיימת — נשארת');
  ok(R.objs.has('st/ownerUid0001/' + KEPT + '_dddddddddddd'), 'יתומות: עבודה שקיימת מחוץ לרשימה — נשארת');
  ok(R.objs.has('st/otherUid0002/' + OTHERF + '_eeeeeeeeeeee'), 'יתומות: קבצים של משתמש אחר — לא נוגעים');
  ok(R.objs.has('gl/ownerUid0001.tsv') && R.objs.has('st/ownerUid0001/notafolder'), 'יתומות: המילון ומפתחות בצורה אחרת — לא נוגעים');
  ok(!(cr.sc.f || []).some((x) => x.k === 'orphans'), 'יתומות: אחרי הניקוי — בלי ממצא');

  /* ---------- 9. הגיבוי היומי (ת7, 11/10) ---------- */
  const BK = require(path.join(root, 'ibkr-proxy/lib/backup.js'));
  R.objs.set('bk/2026-09-01/fs.json.gz', Buffer.alloc(3));   // גיבוי ישן מתקופת השמירה
  R.objs.set('lib/catalog.json', Buffer.from('{"v":1,"items":[]}'));
  const wcall = async () => {
    const res = { code: 0, j: null, setHeader() {}, status(c) { res.code = c; return res; }, json(o) { res.j = o; return res; }, end() { return res; } };
    await studio._handler({ method: 'GET', query: {}, body: null, headers: {}, socket: { remoteAddress: '9.9.9.9' } }, res, deps());
    return res;
  };
  let w = await wcall();
  const today = BK.bkDate(R.now);
  ok(w.code === 200 && w.j.bk === 1 && R.objs.has(BK.bkKey(today)) && R.objs.has(BK.bkCatKey(today)), 'גיבוי: הקרון היומי יוצר גיבוי של היום (Firestore + קטלוג הספרייה)');
  const bj = BK.readBackup(R.objs.get(BK.bkKey(today)));
  const nJobs = [...db.keys()].filter((k) => k.startsWith('studioJobs/')).length;
  ok(bj.cols.studioJobs.length === nJobs && nJobs > 0 && Array.isArray(bj.cols.studioStats), 'גיבוי: כל המסמכים של האוספים, בפורמט של Firestore');
  ok(!bj.cols.studioVault && !bj.cols.users, 'גיבוי: בלי הכספות ובלי התיק');
  ok(!R.objs.has('bk/2026-09-01/fs.json.gz'), 'גיבוי: מה שעבר 14 יום נמחק');
  w = await wcall();
  ok(w.j.bk === 0, 'גיבוי: קריאה חוזרת באותו יום — בלי גיבוי נוסף');
  ok(BK.bkExpired(['bk/2026-09-25/fs.json.gz', 'bk/2026-09-26/fs.json.gz', 'bk/x/y', 'lib/a.epub'], R.now).join() === 'bk/2026-09-25/fs.json.gz', 'גיבוי: תקופת השמירה לפי התאריך בנתיב בלבד');

  /* ---------- 10. כמה זמן הקבצים נשמרים (26/10/2026, בקשת המשתמש; 10/11/2026 — המקור נשמר כל ימי העבודה) ----------
     הצרוב וכל השאר — 30 יום בייצור, 7 בניסוי. סרטון המקור — בלי מחיקה מוקדמת (SRC_TTL = 0): נמחק יחד עם העבודה.
     עבודה ישנה שהמקור שלה כבר נמחק (sx) — עדיין src_gone, והנגן מנגן את הצרוב */
  const SC = require(path.join(root, 'ibkr-proxy/lib/studioscan.js'));
  const H = 3600e3, D = 24 * H, T0 = R.now;
  const sv = (o) => ({ stringValue: JSON.stringify(o) }), iv = (x) => ({ integerValue: String(x) });
  const mkSrc = (tag, extra) => {
    const id = ('jRet' + tag + 'xxxxxxxxxxxxxxxxxxxx').slice(0, 21), F = 'R2_' + id, f = (k) => F + '_' + (k + 'zzzzzzzzzzzz').slice(0, 12);
    const files = { a: f('aud'), v: f('vid'), l: f('low'), o: f('alt'), c: f('ckp'), b: f('brn'), s: f('srt') };
    for (const k of Object.keys(files)) {
      R.objs.set('st/ownerUid0001/' + files[k], Buffer.alloc(10));
      db.set('studioUp/' + files[k], { fields: { k: { stringValue: 'st/ownerUid0001/' + files[k] }, s: iv(10), uid: { stringValue: 'ownerUid0001' }, f: { stringValue: F }, ok: iv(1) }, ut: 'u' });
    }
    db.set('studioJobs/' + id, { fields: Object.assign({ uid: { stringValue: 'ownerUid0001' }, kind: { stringValue: 'tr' }, state: { stringValue: 'done' }, folder: { stringValue: F },
      created: iv(T0 - 25 * H), ended: iv(T0 - 24 * H), updated: iv(T0 - 24 * H),
      fa: sv({ id: files.a, name: 'a.m4a', size: 10 }), fv: sv({ id: files.v, name: 'v.mp4', size: 10 }),
      hl: sv([{ id: files.v, h: 1080, size: 10 }, { id: files.l, h: 360, size: 10 }]), hla: sv([{ id: files.o, size: 10 }]),
      ck: sv([{ s: 'rv', id: files.c, size: 10, at: T0 - 24 * H }]),
      fo: sv([{ k: 'compact', id: files.b, name: 'b.mp4', size: 10 }, { k: 'cues', id: files.s, name: 'c.json', size: 10 }]) }, extra || {}), ut: 't' + (++utSeq) });
    return { id, F, files };
  };
  const has = (x, k) => R.objs.has('st/ownerUid0001/' + x.files[k]);
  const srcGone = (x) => !has(x, 'a') && !has(x, 'v') && !has(x, 'l') && !has(x, 'o') && !has(x, 'c');
  ok(SC.jobTtl('snowball-staging-758f6') === 7 * D && SC.jobTtl('yishaiguedj1-c786e') === 21 * D && SC.jobTtl(undefined) === 21 * D && SC.JOB_TTL === 21 * D, 'שמירה: המקור והצרוב — 3 שבועות בייצור, 7 ימים בניסוי (10/11/2026)');
  ok(SC.SRC_TTL === 0 && SC.srcDueAt({ created: T0, ended: T0 + H }) === 0 && SC.srcDueAt({ created: T0, ended: T0 + 30 * H }) === 0,
    'שמירה: המקור — בלי מחיקה מוקדמת (10/11/2026)');
  ok(SC.expiredJob({ kind: 'tr', state: 'done', folder: 'R2_jAAAAAAAAAAAAAAAAAAAA', ended: T0 - 8 * D }, T0, SC.jobTtl('snowball-staging-758f6')), 'שמירה: בניסוי — עבודה בת 8 ימים נמחקת');
  ok(!SC.expiredJob({ kind: 'tr', state: 'done', folder: 'R2_jAAAAAAAAAAAAAAAAAAAA', ended: T0 - 31 * D }, T0, 30 * D, T0 - 10 * D), 'שמירה: צריבה מחדש לפני 10 ימים באותה תיקייה — העבודה נשארת');

  const due = mkSrc('Due'), late = mkSrc('Lat', { created: iv(T0 - 10 * D), ended: iv(T0 - 9 * D), updated: iv(T0 - 9 * D) });
  const old = mkSrc('Old', { sx: iv(T0 - D) });   // נמחק לפני השינוי
  const pub0 = (await api('job', { job: due.id })).job;
  ok(pub0 && pub0.rt && pub0.rt.s === 0 && pub0.rt.j === T0 - 24 * H + 21 * D && pub0.sx === 0, 'שמירה: הטלפון רואה עד מתי העבודה, בלי תאריך מחיקה נפרד למקור');
  studio._reset();
  w = await wcall();
  const dj = S.fromFields(db.get('studioJobs/' + due.id).fields);
  ok(w.code === 200 && !srcGone(due) && has(due, 'a') && has(due, 'v') && has(due, 'l') && has(due, 'o') && has(due, 'c') && has(due, 'b') && has(due, 's'),
    'שמירה: אחרי יום — המקור, הקול, איכויות הצפייה, עותקי הקול ונקודות השמירה נשארים');
  ok(!(dj.sx > 0) && Array.isArray(dj.hl) && dj.hl.length === 2 && db.has('studioUp/' + due.files.v), 'שמירה: העבודה לא מסומנת sx, ואיכויות הצפייה נשארות');
  ok(!srcGone(late) && has(late, 'v'), 'שמירה: גם עבודה בת 9 ימים — המקור עוד שמור');
  ok(!SC.srcPending(dj) && !SC.srcExpired(dj, T0 + 20 * D) && !SC.expiredJob(dj, T0 + 19 * D, SC.jobTtl(undefined)) && SC.srcFiles(dj).length === 5 && SC.expiredJob(dj, T0 + 21 * D, SC.jobTtl(undefined)),
    'שמירה: המקור יוצא רק עם העבודה (אחרי 3 שבועות)');
  ok(S.canResume(Object.assign({}, dj, { state: 'failed' }), T0) !== 'src_gone', 'שמירה: "המשך" — המקור עוד שמור');
  const pubO = (await api('job', { job: old.id })).job;
  ok(pubO.sx === T0 - D && pubO.rt.s === 0, 'שמירה: עבודה ישנה שהמקור שלה נמחק — הטלפון רואה sx');
  const rr = await call({ op: 'rerender', idToken: OWNER, job: old.id, out: ['compact'] });
  ok(rr.code === 409 && rr.j.error === 'src_gone', 'שמירה: הפקה מחדש בעבודה שהמקור שלה נמחק — src_gone');
  ok(S.canResume(Object.assign({}, dj, { state: 'failed', sx: T0 - D }), T0) === 'src_gone', 'שמירה: "המשך" אחרי שהמקור נמחק — src_gone');
  for (const x of [due, late, old]) db.delete('studioJobs/' + x.id);

  /* ---------- 11. "אמת שוב" (PR 1.2ג, 10/11/2026): עבודת־בת שמריצה רק את האימות על ה־vi.json של ניתוח שהסתיים כטיוטה ---------- */
  const mkVi = (tag, extra) => {
    const id = ('jVi' + tag + 'xxxxxxxxxxxxxxxxxxxx').slice(0, 21), F = 'R2_' + id, vi = F + '_' + 'vijsonzzzzzz';
    R.objs.set('st/ownerUid0001/' + vi, Buffer.from('{"v":1}'));
    db.set('studioUp/' + vi, { fields: { k: { stringValue: 'st/ownerUid0001/' + vi }, s: iv(7), uid: { stringValue: 'ownerUid0001' }, f: { stringValue: F }, ok: iv(1) }, ut: 'u' });
    db.set('studioJobs/' + id, { fields: Object.assign({ uid: { stringValue: 'ownerUid0001' }, kind: { stringValue: 'tr' }, state: { stringValue: 'done' }, folder: { stringValue: F },
      created: iv(T0 - 2 * H), ended: iv(T0 - H), updated: iv(T0 - H),
      spec: sv({ name: 'talk.mp4', size: 10, type: 'video/mp4', dur: 600, from: 'en', to: ['he'], mode: 'haiku-high', out: [], vi: 1, eng: 'api', cap: 5 }),
      fo: sv([{ id: vi, name: 'talk.vi.json', size: 7, k: 'vi' }]), vsm: sv({ n: 9, ok: 0, cov: 90, so: 0, d: 600 }) }, extra || {}), ut: 'u' });
    return { id, F, vi };
  };
  const jobOf = (id) => S.fromFields(db.get('studioJobs/' + id).fields);
  const pv = mkVi('A');
  ok(S.canViVerify(jobOf(pv.id), T0) === '' && S.canViVerify(Object.assign(jobOf(pv.id), { vr: S.VV_MAX }), T0) === 'vv_limit'
    && S.canViVerify(Object.assign(jobOf(pv.id), { spec: Object.assign({}, jobOf(pv.id).spec, { dry: 1 }) }), T0) === 'state'
    && S.canViVerify(Object.assign(jobOf(pv.id), { fo: [] }), T0) === 'state' && S.canViVerify(Object.assign(jobOf(pv.id), { state: 'running' }), T0) === 'state',
    'אמת שוב: רק ניתוח (לא יבש) שהסתיים ויש לו vi.json, ועד VV_MAX פעמים');
  let vv = await api('viVerify', { job: pv.id });
  const CH = vv.job && vv.job.id;
  ok(vv.ok && CH && vv.job.rp === pv.id && vv.job.spec.vo === 1 && vv.job.spec.vi === 1 && vv.job.spec.dur === 0 && vv.job.state === 'queued',
    'אמת שוב: עבודת־בת (tr, vi+vo, בלי משך) נוצרת ונכנסת לתור');
  const ch = jobOf(CH);
  ok(ch.fvi && ch.fvi.id === pv.vi && ch.folder === pv.F && jobOf(pv.id).vr === 1 && jobOf(pv.id).state === 'done',
    'אמת שוב: עבודת־הבת מצביעה על ה־vi.json של ההורה באותה תיקייה (נשמר כ־JSON), ההורה נספר ונשאר "הסתיים"');
  ok(S.workerJob(ch).files.i.id === pv.vi && S.workerJob(jobOf(pv.id)).files.i === null, 'אמת שוב: העובד מקבל את ה־vi.json ב־files.i (analyze.vi_reverify)');
  ok((await api('viVerify', { job: pv.id })).error === 'vv_busy', 'אמת שוב: לחיצה שנייה בזמן שהאימות רץ — vv_busy');
  ok((await other('viVerify', { job: pv.id })).error === 'no_job', 'אמת שוב: משתמש אחר — no_job');
  ok((await api('viVerify', { job: CH })).error === 'state', 'אמת שוב: על עבודת־הבת עצמה — לא');
  const lj = (await api('jobs', {})).jobs || [];
  ok(lj.some((x) => x.id === CH && x.rp === pv.id && x.spec.vo === 1), 'אמת שוב: הטלפון רואה את עבודת־הבת ב־jobs (rp + vo — מסנן אותה מהרשימה)');

  // העובד: מעלה vi.json חדש ומדווח done — השרתון מחליף את ה־vi של ההורה ואת הסיכום
  const VK = crypto.randomBytes(32).toString('base64url');
  Object.assign(db.get('studioJobs/' + CH).fields, { kh: { stringValue: crypto.createHash('sha256').update(VK).digest('hex') }, kx: iv(R.now + 3600e3), state: { stringValue: 'running' } });
  const vw = (op, b) => call(Object.assign({}, b, { op, job: CH, key: VK }), true).then((r) => r.j);
  const nvi = Buffer.from('{"v":1,"items":[]}');
  const vu = await vw('r2wup', { size: nvi.length, type: 'application/json', name: 'talk.vi.json' });
  await R.fetch(vu.urls[1], { method: 'PUT', body: nvi });
  ok((await vw('r2wdone', { id: vu.id, up: vu.up })).ok && SR.inFolder(vu.id, pv.F), 'אמת שוב: העובד מעלה vi.json חדש לתיקייה של ההורה');
  const vd = await vw('report', { done: true, out: [{ id: vu.id, name: 'talk.vi.json', size: nvi.length, k: 'vi' }], vsm: { n: 9, ok: 7, cov: 90, so: 0, d: 600 } });
  const pa = jobOf(pv.id);
  ok(vd.ok && jobOf(CH).state === 'done' && pa.fo.length === 1 && pa.fo[0].id === vu.id && pa.fo[0].k === 'vi' && pa.vsm && pa.vsm.ok === 7 && pa.state === 'done',
    'אמת שוב: בסיום — ה־vi החדש והסיכום נכנסים להורה (במקום הישנים), ההורה נשאר "הסתיים"');
  ok(S.vvAdopt({ fo: [{ id: pv.vi, k: 'vi' }, { id: 'x', k: 'srt' }] }, [{ id: vu.id, name: 'a', size: 1, k: 'vi' }])[1].id === 'x' && S.vvAdopt({ fo: [] }, [{ id: vu.id, k: 'vi' }]) === null && S.vvAdopt(pa, []) === null,
    'אמת שוב: vvAdopt — מחליף רק את ה־vi; בלי vi בהורה או בתוצר — כלום');

  // שוב: עבודת־הבת הקודמת שהסתיימה נמחקת (רק האחרונה נשמרת); כישלון לא נוגע בהורה; ואחרי VV_MAX — vv_limit
  vv = await api('viVerify', { job: pv.id });
  const CH2 = vv.job && vv.job.id;
  ok(vv.ok && CH2 !== CH && !db.has('studioJobs/' + CH) && jobOf(pv.id).vr === 2, 'אמת שוב: פעם שנייה — עבודת־הבת הקודמת שהסתיימה נמחקת');
  const VK2 = crypto.randomBytes(32).toString('base64url');
  Object.assign(db.get('studioJobs/' + CH2).fields, { kh: { stringValue: crypto.createHash('sha256').update(VK2).digest('hex') }, kx: iv(R.now + 3600e3), state: { stringValue: 'running' } });
  await call({ op: 'report', job: CH2, key: VK2, fail: true, err: 'vi_schema', msg: 'x' }, true);
  ok(jobOf(CH2).state === 'failed' && jobOf(pv.id).state === 'done' && jobOf(pv.id).fo[0].id === vu.id, 'אמת שוב: עבודת־הבת נכשלה — ההורה לא נפגע (הקובץ והמצב)');
  db.get('studioJobs/' + pv.id).fields.vr = iv(S.VV_MAX);
  ok((await api('viVerify', { job: pv.id })).error === 'vv_limit', 'אמת שוב: אחרי VV_MAX ניסיונות — vv_limit');
  db.get('studioJobs/' + pv.id).fields.vr = iv(0);
  ok((await api('remove', { job: pv.id })).ok && !db.has('studioJobs/' + CH2) && !db.has('studioJobs/' + pv.id), 'אמת שוב: מחיקת הניתוח מוחקת גם את עבודות־הבת');

  /* ---------- 12. סט הזהב של הניתוח (PR 1.6, 10/11/2026): חבילת ייחוס (viRef, מנהל), מקור זהב, הרצת גל והציון מול הייחוס ---------- */
  const gv = mkVi('G', { fv: sv({ id: 'R2_jViGxxxxxxxxxxxxxxxxx_srcvideozzz', name: 'talk.mp4', size: 10 }) });
  const REF = { bounds: [{ t0: 0, lv: 1, title: 'פתיחה' }, { t0: 120, lv: 1, title: 'חלק ב' }, { t0: 130, lv: 2, title: 'משנה' }],
    units: [{ text: 'הזיכרון נבנה בשני שלבים', w: 3 }, { text: '<b>x</b>', w: 9 }], qa: [{ q: 'מה?', a: 'כך', t: 125, so: 1 }], meta: { tier: 'z', genre: 'panel', lic: 'CC-BY' }, junk: 1 };
  ok((await api('viRef', { job: gv.id, get: true })).ref === null, 'זהב ניתוח: לפני השמירה — אין ייחוס');
  ok((await api('viRef', { job: gv.id, ref: { units: [] } })).error === 'bad_params', 'זהב ניתוח: ייחוס ריק — bad_params');
  ok((await other('viRef', { job: gv.id, ref: REF })).error === 'no_job', 'זהב ניתוח: משתמש אחר — no_job');
  let vgr = await api('viRef', { job: gv.id, ref: REF });
  const gj = jobOf(gv.id);
  ok(vgr.ok && vgr.job.vg === 1 && vgr.job.gd === null && gj.gd.vr === 1 && gj.vrf && gj.vrf.v === 'snb.vi-ref/1' && gj.vrf.units[1].w === 1 && gj.vrf.meta.tier === 'a' && !('junk' in gj.vrf),
    'זהב ניתוח: הייחוס נשמר מנורמל (JSON, לא "[object Object]"), הניתוח מסומן (vg) ו־gd אמיתי שומר עליו מהניקויים');
  ok((await api('viRef', { job: gv.id, get: true })).ref.bounds.length === 3 && S.goldSources([gj]).length === 1 && S.isGold(gj) && !S.isGold({ kind: 'tr', spec: { vi: 1 }, gd: { vr: 1 } }),
    'זהב ניתוח: get מחזיר אותו, והניתוח הוא מקור זהב (goldSources)');
  ok((await api('gold', { job: gv.id, ref: 'x'.repeat(12) })).error === 'no_srt', 'זהב ניתוח: סימון של התרגום (gold) — לא לניתוח');
  // ה5: טיוטת ייחוס — עבודת־בת על ה־vi.json (Sonnet / Haiku), רק אחרי אישור; הטיוטה חוזרת ב־get
  ok((await api('viRef', { job: gv.id, draft: 's' })).error === 'confirm' && (await api('viRef', { job: gv.id, draft: 'z', ok: true })).error === 'bad_params', 'טיוטת ייחוס: בלי אישור — confirm; מודל לא מוכר — bad_params');
  const vdr = await api('viRef', { job: gv.id, draft: 's', ok: true });
  const VPJ = [...db.keys()].filter((k) => k.startsWith('studioJobs/')).map((k) => Object.assign(jobOf(k.slice(11)), { id: k.slice(11) })).find((x) => S.isVp(x) && x.rp === gv.id);
  ok(vdr.ok && vdr.dst === 'queued' && VPJ && VPJ.spec.mode === 'sonnet-medium' && VPJ.spec.vi === 1 && !VPJ.spec.vo && VPJ.fvi.id === gv.vi && VPJ.folder === gv.F && S.workerJob(VPJ).files.i.id === gv.vi,
    'טיוטת ייחוס: עבודת־בת עם Sonnet על ה־vi.json של הניתוח, בתיקייה שלו, ונכנסת לתור');
  ok((await api('viRef', { job: gv.id, draft: 'h', ok: true })).error === 'vp_busy' && (await api('viRef', { job: VPJ.id, get: true })).error === 'state', 'טיוטת ייחוס: שוב בזמן שהיא רצה — vp_busy; על עבודת־הבת עצמה — state');
  const KP = crypto.randomBytes(32).toString('base64url');
  Object.assign(db.get('studioJobs/' + VPJ.id).fields, { kh: { stringValue: crypto.createHash('sha256').update(KP).digest('hex') }, kx: iv(R.now + 3600e3), state: { stringValue: 'running' } });
  await call({ op: 'report', job: VPJ.id, key: KP, done: true, vpd: { bounds: [{ t0: 0, lv: 1, title: 'פתיחה' }], units: [{ w: 9, text: 'יחידה' }], qa: [], slides: [], meta: { genre: 'nope' }, junk: 1 } }, true);
  const gd2 = await api('viRef', { job: gv.id, get: true });
  ok(gd2.ok && gd2.dst === 'done' && gd2.draft && gd2.draft.units[0].w === 1 && gd2.draft.meta.genre === 'other' && !('junk' in gd2.draft) && gd2.ref.units.length === 2 && gd2.usd.s === S.VP_USD.s,
    'טיוטת ייחוס: הטיוטה נשמרת מנורמלת (JSON) וחוזרת ב־get לצד הייחוס המאושר — לא מחליפה אותו');
  ok(require('../ibkr-proxy/lib/studiolearn').learnRec(jobOf(VPJ.id), R.now, S.effState) === null, 'טיוטת ייחוס: לא נכנסת למאגר הלמידה');
  db.delete('studioJobs/' + VPJ.id);
  // גל: זרוע עם הדגל vwin — העבודה שומרת את התוצרים של הניתוח, vg ו־vrb (תחילת הפרקים ברמה 1)
  const wv = await api('goldRun', { ok: true, arms: [{ mode: 'haiku-medium', xf: ['vwin', 'nope'] }, { mode: 'haiku-high' }] });
  const wc = (wv.jobs || []).map((x) => jobOf(x.id));
  ok(wv.ok && wc.length === 2 && wc.every((c) => c.gs === gv.id && c.spec.vi === 1 && c.spec.vg === 1 && JSON.stringify(c.spec.vrb) === '[0,120]' && JSON.stringify(c.spec.out) === '[]' && !c.vrf)
    && JSON.stringify(wc[0].spec.xf) === '["vwin"]' && wc[0].wa === 0 && wc[1].wa === 1, 'זהב ניתוח: "הרץ גל" — עבודת ניתוח לכל זרוע, עם vg, ‏vrb ו־xf (דגל לא מוכר נזרק)');
  ok((await api('goldRun', { ok: true, arms: [{ mode: 'haiku-high' }] })).error === 'gold_busy', 'זהב ניתוח: גל שני בזמן שהראשון פתוח — gold_busy');
  // העובד מדווח done עם vq — נשמר רק בהרצת זהב, ומוצג לטלפון
  const GK = crypto.randomBytes(32).toString('base64url'), C0 = wv.jobs[0].id;
  Object.assign(db.get('studioJobs/' + C0).fields, { kh: { stringValue: crypto.createHash('sha256').update(GK).digest('hex') }, kx: iv(R.now + 3600e3), state: { stringValue: 'running' } });
  const gw = (op, b) => call(Object.assign({}, b, { op, job: C0, key: GK }), true).then((r) => r.j);
  const vgu = await gw('r2wup', { size: nvi.length, type: 'application/json', name: 'talk.vi.json' });
  await R.fetch(vgu.urls[1], { method: 'PUT', body: nvi });
  await gw('r2wdone', { id: vgu.id, up: vgu.up });
  await call({ op: 'report', job: C0, key: GK, done: true, out: [{ id: vgu.id, name: 'talk.vi.json', size: nvi.length, k: 'vi' }], vsm: { n: 5, ok: 5, cov: 80, so: 0, d: 600 }, vq: { f5: 0.5, f10: 2 } }, true);
  ok(jobOf(C0).state === 'done' && jobOf(C0).vq.f5 === 0.5 && jobOf(C0).vq.f10 === null && (await api('job', { job: C0 })).job.vq.f5 === 0.5, 'זהב ניתוח: הציון מול הייחוס (vq) נשמר ומוצג; ערך מחוץ לטווח נזרק');
  /* ---------- 13. השופט בזוגות (PR 1.6): viJudge — אומדן, אישור, עבודת שופט למקור, vjd וההכרעה ---------- */
  const C1 = wv.jobs[1].id, GK1 = crypto.randomBytes(32).toString('base64url');
  Object.assign(db.get('studioJobs/' + C1).fields, { kh: { stringValue: crypto.createHash('sha256').update(GK1).digest('hex') }, kx: iv(R.now + 3600e3), state: { stringValue: 'running' } });
  const gw1 = (op, b) => call(Object.assign({}, b, { op, job: C1, key: GK1 }), true).then((r) => r.j);
  const vgu1 = await gw1('r2wup', { size: nvi.length, type: 'application/json', name: 'talk.vi.json' });
  await R.fetch(vgu1.urls[1], { method: 'PUT', body: nvi });
  await gw1('r2wdone', { id: vgu1.id, up: vgu1.up });
  await call({ op: 'report', job: C1, key: GK1, done: true, out: [{ id: vgu1.id, name: 'talk.vi.json', size: nvi.length, k: 'vi' }] }, true);
  ok(jobOf(C1).state === 'done', 'השופט: שתי הזרועות של הגל הסתיימו');
  ok((await other('viJudge', { get: true })).error === 'admin', 'השופט: לא מנהל — admin');
  let jg = await api('viJudge', { get: true });
  ok(jg.ok && jg.np === 1 && jg.ns === 1 && jg.usd === S.VJ_USD && jg.dec.length === 0 && jg.jobs.length === 0, 'השופט: get — זוג אחד (זרוע 1 מול 0) והאומדן, עוד בלי הכרעה');
  ok((await api('viJudge', {})).error === 'confirm', 'השופט: בלי אישור — confirm');
  const jn = await api('viJudge', { ok: true });
  const VJ = jn.jobs && jn.jobs[0] && jn.jobs[0].id, vjj = VJ && jobOf(VJ);
  ok(jn.ok && vjj && S.isVj(vjj) && vjj.rp === gv.id && vjj.folder === jobOf(gv.id).folder && vjj.spec.vi === 1 && vjj.spec.dur === 0 && jn.jobs[0].state === 'queued'
    && vjj.fvj.p.length === 1 && vjj.fvj.p[0].x.j === C0 && vjj.fvj.p[0].y.j === C1 && vjj.fvj.p[0].y.id === vgu1.id && vjj.vref && vjj.vref.units.length === 2,
    'השופט: עבודת שופט למקור — בתיקייה שלו, עם הזוג (x = זרוע 0) ועותק הייחוס (JSON), ונכנסת לתור');
  ok((await api('viJudge', { ok: true })).error === 'gold_busy', 'השופט: שוב בזמן שהוא רץ — gold_busy');
  const wjv = S.workerJob(vjj);
  ok(wjv.vjp.length === 1 && wjv.vjp[0].x.id === vgu.id && wjv.vjp[0].y.wa === 1 && wjv.vref.units.length === 2 && S.workerJob(jobOf(C0)).vjp === null, 'השופט: העובד מקבל את הזוגות ואת הייחוס (רק בעבודת השופט)');
  const KJ = crypto.randomBytes(32).toString('base64url');
  Object.assign(db.get('studioJobs/' + VJ).fields, { kh: { stringValue: crypto.createHash('sha256').update(KJ).digest('hex') }, kx: iv(R.now + 3600e3), state: { stringValue: 'queued' }, fired: iv(R.now) });
  const clj = (await call({ op: 'claim', job: VJ, key: KJ }, true)).j;
  ok(clj.ok && clj.job.spec.vj === 1 && clj.job.vjp.length === 1 && clj.job.vref.units.length === 2 && clj.job.files.i === null, 'השופט: העובד לוקח את העבודה עם הזוגות והייחוס (job.py שומר vjp ו־vref)');
  Object.assign(db.get('studioJobs/' + VJ).fields, { state: { stringValue: 'running' } });
  await call({ op: 'report', job: VJ, key: KJ, done: true, vjd: { v: 1, p: [{ j: C1, wa: 1, w: 'Y', ex: 6, ey: 0, yu: 0, a: { support_rate: 0.9, junk: 5 }, b: { support_rate: 0.95 } }, { j: 'bad', wa: 1, w: 'Y' }], usd: 0.02 } }, true);
  const vjd = jobOf(VJ).vjd;
  ok(jobOf(VJ).state === 'done' && vjd && vjd.p.length === 1 && vjd.p[0].w === 'Y' && !('junk' in vjd.p[0].a) && vjd.usd === 0.02, 'השופט: vjd נשמר מנורמל (JSON; זוג לא תקין ושדה זר נזרקים)');
  jg = await api('viJudge', { get: true });
  ok(jg.dec.length === 1 && jg.dec[0].wa === 1 && jg.dec[0].n === 1 && jg.dec[0].wins === 1 && jg.dec[0].ex === 6 && jg.dec[0].pass === false && jg.dec[0].why.includes('wins') && jg.jobs[0].state === 'done',
    'השופט: ההכרעה לזרוע 1 — ניצחון אחד לא מספיק (Wilson)');
  ok(require('../ibkr-proxy/lib/studiolearn').learnRec(jobOf(VJ), R.now, S.effState) === null && S.canViVerify(jobOf(VJ), R.now) === 'state', 'השופט: לא נכנס למאגר הלמידה, ואין לו "אמת שוב"');
  db.delete('studioJobs/' + VJ);
  vgr = await api('viRef', { job: gv.id, ref: null });
  ok(vgr.ok && vgr.job.vg === 0 && !jobOf(gv.id).gd && !jobOf(gv.id).vrf, 'זהב ניתוח: הסרה — הייחוס והסימון נמחקים');
  ok((await api('viRef', { job: C0, get: true })).error === 'state', 'זהב ניתוח: ייחוס רק לניתוח מקורי (לא להרצת זהב)');
  for (const c of wv.jobs) db.delete('studioJobs/' + c.id);

  console.log('\n' + n + ' בדיקות עברו');
})().catch((e) => { console.error('FAIL -', e); process.exit(1); });
