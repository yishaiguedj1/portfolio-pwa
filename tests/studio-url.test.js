// 22/10/2026: הורדה מקישור — בדיקת קישור (טלפון ↔ תור ↔ עובד), עבודה עם spec.src=url, רישום הקבצים מהעובד.
// השרתון האמיתי (api/studio.js) מול Firestore ו־R2 מדומים. הרצה: node tests/studio-url.test.js
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

  const SU = require(path.join(root, 'ibkr-proxy/lib/studiourl.js'));
  const other = phone(OTHER);
  /* ---------- 0. צורת קישור ---------- */
  ok(SU.normSrcUrl('צפו בזה https://youtu.be/abc?si=1).') === 'https://youtu.be/abc?si=1', 'קישור מתוך טקסט ששותף');
  for (const u of ['http://127.0.0.1/x', 'http://169.254.169.254/', 'https://localhost/', 'https://a:b@x.com/', 'ftp://x.com/', 'https://intranet/', 'http://[::1]/', 'https://x.com:22/', 'javascript:alert(1)'])
    ok(SU.normSrcUrl(u) === '', 'נדחה: ' + u);

  /* ---------- 1. בדיקת קישור: טלפון → תור → עובד → טלפון ---------- */
  ok((await other('urlProbe', { url: 'https://youtu.be/abc' })).error === 'not_allowed', 'משתמש רגיל — בלי הורדה מקישור (שלב ראשון: מנהל / "כל המודלים")');
  ok((await api('urlProbe', { url: 'http://10.0.0.1/v' })).error === 'bad_url', 'כתובת פנימית — נדחית כבר בשרתון');
  let j = await api('urlProbe', { url: 'שתפו https://www.youtube.com/watch?v=abc' });
  ok(j.ok && j.probe.st === 'q' && /^p[0-9a-z]+$/.test(j.probe.id), 'בדיקה נוצרה וממתינה לעובד');
  const PID = j.probe.id;
  ok((await other('urlProbe', { pid: PID })).error === 'not_allowed' && (await api('urlProbe', { pid: 'pzzzzzzzz' })).error === 'no_probe', 'בדיקה של משתמש אחר / שלא קיימת');

  // שרת רשום
  const SID = 'srv000000001', STOK = SID + '-' + crypto.randomBytes(32).toString('base64url');
  db.set('studioServers/' + SID, { fields: { th: { stringValue: crypto.createHash('sha256').update(STOK).digest('hex') }, by: { stringValue: 'ownerUid0001' }, seen: { integerValue: String(R.now) } }, ut: 't0' });
  const srv = async (b, tk) => { const res = { code: 0, j: null, setHeader() {}, status(c) { res.code = c; return res; }, json(o) { res.j = o; return res; } };
    await studio._handler({ method: 'POST', query: {}, body: b, headers: { authorization: 'Bearer ' + (tk || STOK) }, socket: { remoteAddress: '1.1.1.1' } }, res, deps()); return res; };
  ok((await srv({ op: 'pq' }, 'srv000000001-' + 'x'.repeat(43))).code === 401, 'pq בלי טוקן שרת נכון — 401');
  let q = await srv({ op: 'pq' });
  ok(q.code === 200 && q.j.pr && q.j.pr.id === PID && q.j.pr.u === 'https://www.youtube.com/watch?v=abc', 'העובד לקח את הבדיקה (עם הקישור המנורמל)');
  ok((await srv({ op: 'pq' })).j.pr === null, 'בדיקה שנלקחה לא נלקחת שוב');
  ok((await api('urlProbe', { pid: PID })).probe.st === 'r', 'הטלפון רואה "בודקים"');
  const RES = { t: 'Talk‮ x', u: 'https://www.youtube.com/watch?v=abc', s: 'Youtube', up: 'Ch', d: 600, ud: '20261020', ch: [[0, 'Intro'], [60, 'Main']],
    sub: [{ l: 'en', n: 'English', a: 0 }, { l: '<script>', n: 'x', a: 0 }], q: [{ h: 1080, v: '399', a: '251', c: 'av1', ac: 'opus', fps: 30, hdr: 0, sz: 160e6 }, { h: 720, v: 'bad id!', a: '' }],
    rec: 1080, ao: { id: '251', ac: 'opus', br: 135, sz: 1e7 }, fm: [{ id: '399', k: 'v', h: 1080, c: 'av1', sz: 15e7 }], th: 'javascript:x' };
  ok((await srv({ op: 'pq', done: true, pid: PID, ok: true, r: RES }, 'srv000000002-' + 'y'.repeat(43))).code === 401, 'שרת אחר לא מחזיר תשובה לבדיקה שלא שלו');
  ok((await srv({ op: 'pq', done: true, pid: PID, ok: true, r: RES })).j.ok, 'העובד החזיר את הסיכום');
  j = await api('urlProbe', { pid: PID });
  const r = j.probe.r;
  ok(j.probe.st === 'd' && r.t === 'Talk x' && r.q.length === 1 && r.q[0].v === '399' && r.sub.length === 1 && r.th === '' && r.ch.length === 2, 'הטלפון מקבל סיכום נקי: בלי תווי כיווניות, בלי מזהה לא תקין, בלי תמונה לא תקינה');
  // שגיאה מהעובד
  const P2 = (await api('urlProbe', { url: 'https://example.com/page' })).probe.id;
  await srv({ op: 'pq' });
  await srv({ op: 'pq', done: true, pid: P2, ok: false, e: 'blocked' });
  ok((await api('urlProbe', { pid: P2 })).probe.e === 'blocked', 'קוד שגיאה מהעובד (blocked) מגיע לטלפון');
  const P3 = (await api('urlProbe', { url: 'https://example.com/p3' })).probe.id;
  await srv({ op: 'pq' });
  await srv({ op: 'pq', done: true, pid: P3, ok: false, e: '<b>free text</b>' });
  ok((await api('urlProbe', { pid: P3 })).probe.e === 'fail', 'טקסט חופשי במקום קוד — "fail"');
  // 24/10/2026 (בייצור: TED נתקע ב"בודקים" — התשובה 15.8KB, השרתון דחה כל בקשה מהשרת מעל 4KB): תשובה אמיתית עם תמונה עוברת
  const P3b = (await api('urlProbe', { url: 'https://example.com/p3b' })).probe.id;
  await srv({ op: 'pq' });
  const BIG = Object.assign({}, RES, { th: 'data:image/jpeg;base64,' + 'A'.repeat(70 * 1024 - 30), fm: Array.from({ length: 40 }, (_, i) => ({ id: 'f' + i, k: 'v', h: 360 + i, c: 'avc1', sz: 1e7 })) });
  const big = await srv({ op: 'pq', done: true, pid: P3b, ok: true, r: BIG });
  ok(big.code === 200 && big.j.ok && JSON.stringify(BIG).length > 70000, 'תשובת בדיקה גדולה (תמונה של 70KB) מתקבלת — לא 413');
  ok((await api('urlProbe', { pid: P3b })).probe.r.th.length > 70000, 'התמונה מגיעה לטלפון');
  ok((await srv({ op: 'pq', done: true, pid: P3b, ok: true, r: Object.assign({}, BIG, { th: 'x'.repeat(200000) }) })).code === 413, 'מעל התקרה — עדיין 413');
  ok((await srv({ op: 'pq', pad: 'x'.repeat(5000) })).code === 413, 'בקשה רגילה מהשרת מעל 4KB — עדיין 413');

  // שלב 2 (דפדפן הציד): קובץ שנמצא בדף — הבדיקה והעבודה נושאות את הדף (Referer) עד העובד
  ok((await api('urlProbe', { url: 'https://cdn.example.com/v/master.m3u8', ref: 'javascript:alert(1)' })).error === 'bad_url', 'Referer לא תקין — נדחה');
  const P4 = (await api('urlProbe', { url: 'https://cdn.example.com/v/master.m3u8', ref: 'https://site.example/watch/9' })).probe.id;
  q = await srv({ op: 'pq' });
  ok(q.j.pr && q.j.pr.id === P4 && q.j.pr.ref === 'https://site.example/watch/9', 'העובד מקבל את הדף שבו נמצא הקובץ');
  await srv({ op: 'pq', done: true, pid: P4, ok: false, e: 'fail' });
  q = await api('urlProbe', { url: 'https://example.com/p5' });
  ok(!(await srv({ op: 'pq' })).j.pr.ref, 'בלי Referer — בלי שדה');
  await srv({ op: 'pq', done: true, pid: q.probe.id, ok: false, e: 'fail' });

  /* ---------- 2. עבודה מקישור ---------- */
  const spec = { name: r.t, size: 170e6, type: 'video/url', dur: 600, from: 'en', to: ['he'], mode: 'haiku-high', out: ['same'], eng: 'api', cap: 5,
    src: 'url', url: r.u, pick: { v: '399', a: '251', h: 1080, ch: 1 } };
  ok((await other('create', { spec })).error === 'not_allowed', 'משתמש רגיל לא יוצר עבודה מקישור');
  ok((await api('create', { spec: Object.assign({}, spec, { eng: undefined }) })).error === 'bad_spec', 'עבודה מקישור — רק במצב השרת');
  j = await api('create', { spec });
  ok(j.ok && j.job.spec.src === 'url' && j.job.spec.pick.v === '399' && SR.isFolder(j.job.folder), 'עבודה מקישור נוצרת עם תיקייה ב־R2');
  const JOB = j.job.id, FOLDER = j.job.folder;
  const jr = await api('create', { spec: Object.assign({}, spec, { url: 'https://cdn.example.com/v/master.m3u8', ref: 'https://site.example/watch/9' }) });
  ok(jr.ok && jr.job.spec.ref === 'https://site.example/watch/9', 'עבודה מקובץ שנמצא בדף — עם ה־Referer');
  ok(!(await api('create', { spec: Object.assign({}, spec, { ref: 'ftp://x' }) })).job.spec.ref, 'Referer לא תקין לא נשמר');
  j = await api('start', { job: JOB });
  ok(j.ok && j.job.state === 'queued', 'מתחילה בלי קבצים מהטלפון — העובד יביא אותם');

  /* ---------- 3. העובד מוריד ורושם ---------- */
  const KEY = crypto.randomBytes(32).toString('base64url');
  const doc = db.get('studioJobs/' + JOB).fields;
  Object.assign(doc, { kh: { stringValue: crypto.createHash('sha256').update(KEY).digest('hex') }, kx: { integerValue: String(R.now + 3600e3) }, state: { stringValue: 'running' } });
  const wrk = (op, b) => call(Object.assign({}, b, { op, job: JOB, key: KEY }), true).then((x) => x.j);
  const audio = crypto.randomBytes(200000), video = crypto.randomBytes(900000);
  const up = async (buf, name) => { const u = await wrk('r2wup', { size: buf.length, type: 'video/x-matroska', name }); await R.fetch(u.urls[1], { method: 'PUT', body: buf }); await wrk('r2wdone', { id: u.id, up: u.up }); return u.id; };
  const aid = await up(audio, 'Talk.audio.m4a');
  ok((await wrk('srcFile', { which: 'a', id: aid })).ok, 'העובד רשם את הקול שהוריד');
  ok((await wrk('srcFile', { which: 'a', id: SR.newId(FOLDER) })).error === 'file_bad', 'קובץ שלא קיים בתיקייה — נדחה');
  ok((await wrk('srcFile', { which: 'x', id: aid })).error === 'bad_params', 'סוג לא מוכר — נדחה');
  const vid = await up(video, 'Talk.mkv');
  ok((await wrk('srcFile', { which: 'v', id: vid })).ok, 'העובד רשם את הסרטון');
  j = await api('job', { job: JOB });
  ok(j.job.files.a.id === aid && j.job.files.v.id === vid && j.job.spec.size === video.length, 'הטלפון רואה את שני הקבצים, והגודל האמיתי במקום האומדן');

  /* ---------- 4. srcFile רק לעבודה מקישור ---------- */
  const plain = await api('create', { spec: { name: 'a.mp4', size: 10, to: ['he'], eng: 'api', cap: 5 } });
  const K2 = crypto.randomBytes(32).toString('base64url');
  Object.assign(db.get('studioJobs/' + plain.job.id).fields, { kh: { stringValue: crypto.createHash('sha256').update(K2).digest('hex') }, kx: { integerValue: String(R.now + 3600e3) }, state: { stringValue: 'running' } });
  ok((await call({ op: 'srcFile', job: plain.job.id, key: K2, which: 'v', id: SR.newId(plain.job.folder) }, true)).j.error === 'bad_params', 'עבודה רגילה — העובד לא רושם מקור');

  /* ---------- 5. הדגל במרכז הניהול ---------- */
  db.set('sysCfg/main', { fields: { flOff: { stringValue: 'st_url' } }, ut: 'tf' });
  studio._reset();
  ok((await api('urlProbe', { url: 'https://youtu.be/abc' })).error === 'flag_off', 'הדגל "הורדה מקישור" כבוי — אין בדיקה');
  ok((await api('create', { spec })).error === 'flag_off', 'הדגל כבוי — אין עבודה חדשה מקישור');

  console.log('\nכל ' + n + ' הבדיקות עברו ✓');
})().catch((e) => { console.error(e); process.exit(1); });
