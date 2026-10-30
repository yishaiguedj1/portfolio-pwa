// 24/10/2026: תרגום בטלפון (שלב 1) — הסרטון לא עוזב את הטלפון: עבודה עם spec.ph, הקול וקובץ המדידות ב־R2, בלי סרטון ובלי
// צריבה בשרת, ודיווח הצריבה מהטלפון. השרתון האמיתי מול Firestore ו־R2 מדומים. הרצה: node tests/studio-phone.test.js
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
  const api = phone(OWNER), other = phone(OTHER);

  /* ---------- 1. הצורה ---------- */
  const base = { name: 'talk.mp4', size: 900e6, type: 'video/mp4', dur: 3600, from: 'en', to: ['he'], mode: 'haiku-high', eng: 'api', cap: 5 };
  let sp = S.normSpec(Object.assign({}, base, { ph: 1, pb: 'same', out: ['same', 'mkv'], edl: { k: [[1, 20]], ar: '9:16' } }));
  ok(sp && sp.ph === 1 && sp.pb === 'same' && sp.out.length === 0 && !sp.edl, 'ph: בלי תוצרי וידאו בשרת ובלי חיתוך לפני התרגום; הצריבה בטלפון (pb)');
  ok(S.normSpec(Object.assign({}, base, { ph: 1, eng: undefined })) === null, 'ph רק במצב השרת');
  ok(S.normSpec(Object.assign({}, base, { ph: 1, src: 'subs', size: 1000 })) === null, 'ph לא עם קובץ כתוביות');
  ok(!S.normSpec(Object.assign({}, base, { ph: 1, pb: 'evil' })).pb, 'pb לא מוכר — לא נשמר');
  ok(!('ph' in S.normSpec(base)), 'בלי ph — כמו קודם');
  ok(S.JSON_FIELDS.includes('fph') && S.JSON_FIELDS.includes('pbn'), 'השדות החדשים נשמרים כ־JSON');
  ok(S.normPbn({ s: 'run', p: 0.4567 }, 5).p === 0.457 && S.normPbn({ s: 'x' }) === null && S.normPbn({ s: 'fail', e: '<b>' }).e === undefined && S.normPbn({ s: 'fail', e: 'no_codec' }).e === 'no_codec', 'מצב הצריבה: רק מספרים וקוד');
  ok(S.normPbn({ s: 'done', p: 0.2, sz: 1234, ms: 9000 }).p === 1 && S.normPbn({ s: 'done', sz: 1234 }).sz === 1234, 'הצריבה הסתיימה — 100%, גודל');

  /* ---------- 2. יצירה, קבצים, התחלה ---------- */
  let j = await api('create', { spec: Object.assign({}, base, { ph: 1, pb: 'same' }) });
  ok(j.ok && j.job.spec.ph === 1 && SR.isFolder(j.job.folder) && j.job.files.m === null, 'עבודת טלפון נוצרת עם תיקייה ב־R2');
  const JOB = j.job.id, FOLDER = j.job.folder;
  const up = async (buf, name) => { const u = await api('r2up', { job: JOB, size: buf.length, type: 'application/octet-stream', name }); await R.fetch(u.urls[1], { method: 'PUT', body: buf }); await api('r2done', { job: JOB, id: u.id, up: u.up }); return u.id; };
  ok((await api('start', { job: JOB })).error === 'no_files', 'בלי הקול — לא מתחילים');
  const audio = crypto.randomBytes(150000);
  const aid = await up(audio, 'talk.audio.m4a');
  const fakeV = await up(crypto.randomBytes(1000), 'talk.mp4');
  ok((await api('file', { job: JOB, which: 'v', id: fakeV, folder: FOLDER })).error === 'bad_params', 'בעבודת טלפון הסרטון לא נרשם לעולם');
  ok((await api('file', { job: JOB, which: 'a', id: aid, folder: FOLDER })).ok, 'הקול נרשם');
  j = await api('start', { job: JOB });
  ok(j.ok && j.job.state === 'queued', 'מתחילה מהקול לבד (המדידות יגיעו אחר כך)');
  const meta = Buffer.from(JSON.stringify({ v: 1, probe: { format: { duration: '3600' }, streams: [{ index: 0, codec_type: 'video', width: 1920, height: 1080 }, { index: 1, codec_type: 'audio' }] }, shots: { threshold: 10, shots: [{ t: 3.2, score: 40 }] } }));
  const mid = await up(meta, 'talk.phone.json');
  j = await api('file', { job: JOB, which: 'm', id: mid, folder: FOLDER });
  ok(j.ok && j.job.files.m && j.job.files.m.size === meta.length, 'קובץ המדידות נרשם (files.m)');
  ok(db.get('studioJobs/' + JOB).fields.fph && !db.get('studioJobs/' + JOB).fields.fv, 'במסמך: fph, בלי fv');

  /* ---------- 3. העובד רואה את המדידות ---------- */
  const KEY = crypto.randomBytes(32).toString('base64url');
  Object.assign(db.get('studioJobs/' + JOB).fields, { kh: { stringValue: crypto.createHash('sha256').update(KEY).digest('hex') }, kx: { integerValue: String(R.now + 3600e3) }, state: { stringValue: 'running' } });
  const wrk = (op, b) => call(Object.assign({}, b, { op, job: JOB, key: KEY }), true).then((x) => x.j);
  j = await wrk('claim', {});
  ok(j.ok && j.job.files.m && j.job.files.m.id === mid && j.job.files.a.id === aid && !j.job.files.v && j.job.spec.ph === 1, 'בלקיחה: הקול והמדידות, בלי סרטון');

  /* ---------- 4. קובץ מדידות גדול מדי ---------- */
  const j2 = await api('create', { spec: Object.assign({}, base, { ph: 1 }) });
  const up2 = async (buf) => { const u = await api('r2up', { job: j2.job.id, size: buf.length, type: 'application/json', name: 'm.json' }); await R.fetch(u.urls[1], { method: 'PUT', body: buf }); await api('r2done', { job: j2.job.id, id: u.id, up: u.up }); return u.id; };
  const bigId = await up2(crypto.randomBytes(S.PH_META_MAX + 10));
  ok((await api('file', { job: j2.job.id, which: 'm', id: bigId, folder: j2.job.folder })).error === 'file_size', 'מדידות מעל התקרה — נדחה');
  const plain = await api('create', { spec: base });
  ok((await api('file', { job: plain.job.id, which: 'm', id: SR.newId(plain.job.folder), folder: plain.job.folder })).error === 'bad_params', 'בעבודה רגילה אין קובץ מדידות');

  /* ---------- 5. Studio לאנדרואיד — מפתח לעבודה אחת ---------- */
  ok((await api('phKey', { job: plain.job.id })).error === 'state', 'עבודה רגילה — אין מפתח טלפון');
  ok((await other('phKey', { job: j2.job.id })).error === 'no_job', 'משתמש אחר לא מקבל מפתח לעבודה שלי');
  const pk1 = await api('phKey', { job: j2.job.id });
  ok(pk1.ok && S.KEY_RE.test(pk1.key) && pk1.exp > R.now, 'מפתח טלפון לעבודה');
  ok(!JSON.stringify(db.get('studioJobs/' + j2.job.id).fields).includes(pk1.key), 'במסמך אין את המפתח עצמו (hash + מוצפן)');
  const pk = await api('phKey', { job: j2.job.id });
  ok(pk.key === pk1.key, 'בקשה חוזרת — אותו מפתח (לא מבטלת העלאה שבדרך; הדף מבקש מראש)');
  const PJ = j2.job.id, PK = pk.key;
  const ph = (op, b, key) => call(Object.assign({ op, job: PJ, key: key || PK }, b), true).then((x) => x.j);
  // מפתח שנשאר לו פחות מיום — מוחלף
  const dj = db.get('studioJobs/' + PJ).fields, pkx0 = dj.pkx;
  dj.pkx = { integerValue: String(R.now + 3600e3) };
  const pk2 = await api('phKey', { job: PJ });
  ok(pk2.key !== PK && (await ph('phJob', {}, PK)).error === 'bad_key', 'מפתח שעומד לפוג — מפתח חדש, והקודם מת');
  const PK2 = pk2.key;
  const ph2 = (op, b) => call(Object.assign({ op, job: PJ, key: PK2 }, b), true).then((x) => x.j);
  ok((await ph('phJob', {}, crypto.randomBytes(32).toString('base64url'))).error === 'bad_key', 'מפתח לא נכון — נדחה');
  ok((await call({ op: 'phJob', job: JOB, key: PK2 }, true)).j.error === 'bad_key', 'המפתח לא פותח עבודה אחרת');
  j = await ph2('phJob', {});
  ok(j.ok && j.job.state === 'new' && j.job.a === false && j.job.out.length === 0, 'הטלפון קורא את המצב (בלי התחברות, בלי Origin)');
  ok((await ph2('phStart', {})).error === 'no_files', 'בלי קול — לא מתחילים');
  // הקול מהטלפון
  const u = await ph2('phUp', { size: audio.length, type: 'audio/x-matroska', name: 'talk.audio.mka' });
  ok(u.ok && SR.inFolder(u.id, j2.job.folder), 'העלאה לתיקייה של העבודה');
  await R.fetch(u.urls[1], { method: 'PUT', body: audio });
  ok((await ph2('phDone', { id: u.id, up: u.up })).ok, 'ההעלאה נסגרה');
  ok((await ph2('phFile', { which: 'v', id: u.id })).error === 'bad_params', 'סרטון — לא');
  ok((await ph2('phFile', { which: 'a', id: SR.newId(FOLDER) })).error === 'bad_params', 'קובץ מתיקייה של עבודה אחרת — לא');
  ok((await ph2('phFile', { which: 'a', id: u.id })).ok, 'הקול נרשם מהטלפון');
  ok((await ph2('phUp', { size: S.PH_UP_MAX + 1, name: 'x' })).error === 'too_big', 'מעל התקרה — לא');
  j = await ph2('phStart', {});
  ok(j.ok && j.state === 'queued' && (await api('job', { job: PJ })).job.state === 'queued', 'הטלפון התחיל את העבודה (לתור של השרת)');
  ok((await ph2('phStart', {})).state === 'queued', 'התחלה שנייה — לא מפעילה שוב');
  // הצריבה
  ok((await ph2('phBurn', { pbn: { s: 'run', p: 0.5 } })).error === 'state', 'לפני שהעבודה הסתיימה — אין צריבה');
  const OUT = SR.newId(j2.job.folder);
  await R.fetch((await ph2('phUp', { size: 50, type: 'text/plain', name: 'he.ass' })).urls[1], { method: 'PUT', body: Buffer.alloc(50) }).catch(() => null);
  Object.assign(db.get('studioJobs/' + PJ).fields, { state: { stringValue: 'done' }, fo: { stringValue: JSON.stringify([{ id: OUT, name: 'talk.he.ass', size: 50, k: 'ass' }]) } });
  ok((await ph2('phFile', { which: 'm', id: OUT })).error === 'state', 'אחרי הסיום — לא רושמים קבצים');
  j = await ph2('phJob', {});
  ok(j.job.state === 'done' && j.job.out[0].k === 'ass', 'הטלפון רואה את התוצרים');
  ok((await ph2('phGet', { id: SR.newId(j2.job.folder) })).error === 'bad_id', 'רק קבצים מהתוצרים של העבודה');
  ok((await ph2('phBurn', { pbn: { s: '??' } })).error === 'bad_params', 'מצב צריבה לא מוכר — נדחה');
  ok((await ph2('phBurn', { pbn: { s: 'run', p: 0.25 } })).ok, 'הטלפון מדווח שהצריבה רצה');
  ok((await ph2('phBurn', { pbn: { s: 'done', sz: 4e8, ms: 570000 } })).ok, 'הצריבה הסתיימה');
  j = await api('job', { job: PJ });
  ok(j.job.pbn.s === 'done' && j.job.pbn.sz === 4e8 && (await ph2('phJob', {})).job.pbn.s === 'done', 'הדף והאפליקציה רואים את אותו מצב צריבה');
  ok((await ph2('phJob', { pad: 'x'.repeat(5000) })).error === 'too_large', 'גוף מעל 4KB — נדחה');

  /* ---------- 5ב. שלב 2 (25/10/2026): גם התמלול והיישור בטלפון — המילים והמדידות, בלי קול ---------- */
  sp = S.normSpec(Object.assign({}, base, { ph: 1, pw: 1 }));
  ok(sp.ph === 1 && sp.pw === 1, 'pw נשמר רק עם ph');
  ok(!('pw' in S.normSpec(Object.assign({}, base, { pw: 1 }))), 'pw בלי ph — לא נשמר');
  ok(S.JSON_FIELDS.includes('fpw'), 'fpw נשמר כ־JSON');
  const j3 = await api('create', { spec: Object.assign({}, base, { ph: 1, pw: 1 }) });
  ok(j3.ok && j3.job.spec.pw === 1 && j3.job.files.w === null, 'עבודה בשלב 2 נוצרת (files.w)');
  const PJ3 = j3.job.id, PK3 = (await api('phKey', { job: PJ3 })).key;
  const ph3 = (op, b) => call(Object.assign({ op, job: PJ3, key: PK3 }, b), true).then((x) => x.j);
  const up3 = async (buf, name) => { const x = await ph3('phUp', { size: buf.length, type: 'application/json', name }); await R.fetch(x.urls[1], { method: 'PUT', body: buf }); await ph3('phDone', { id: x.id, up: x.up }); return x.id; };
  // ההתקדמות בטלפון (op:'phProg') — רק כשהעבודה "חדשה", רק שלב מהרשימה ומספרים / קוד
  ok((await ph3('phProg', { ppr: { s: 'asr', p: 0.4567 } })).ok, 'הטלפון מדווח שהוא מתמלל');
  let pj = await api('job', { job: PJ3 });
  ok(pj.job.ppr && pj.job.ppr.s === 'asr' && pj.job.ppr.p === 0.457 && pj.job.ppr.at > 0, 'הדף רואה את ההתקדמות בטלפון: ' + JSON.stringify(pj.job.ppr));
  ok((await ph3('phProg', { ppr: { s: 'evil', p: 1 } })).error === 'bad_params' && (await ph3('phProg', { ppr: { s: 'err', e: '<b>' } })).error === 'bad_params', 'שלב לא מוכר / קוד לא תקין — נדחה');
  ok((await ph3('phProg', { ppr: { s: 'diar' } })).ok && (await api('job', { job: PJ3 })).job.ppr.p === -1, 'שלב בלי אחוז — ‎-1');
  ok(S.JSON_FIELDS.includes('ppr'), 'ppr נשמר כ־JSON');
  const aud3 = await up3(crypto.randomBytes(2000), 'talk.audio.mka');
  ok((await ph3('phFile', { which: 'a', id: aud3 })).error === 'bad_params', 'בשלב 2 הקול לא נרשם לעולם');
  const words = Buffer.from(JSON.stringify({ v: 1, words: [{ w: 'Hello', s: 0.5, e: 0.9, spk: 'S1' }] }));
  const wid = await up3(words, 'talk.words.json');
  ok((await ph3('phFile', { which: 'w', id: wid })).ok, 'המילים נרשמו (w)');
  ok((await ph3('phStart', {})).error === 'no_files', 'בלי המדידות — לא מתחילים');
  const mid3 = await up3(meta, 'talk.phone.json');
  ok((await ph3('phFile', { which: 'm', id: mid3 })).ok, 'המדידות נרשמו');
  ok((await ph3('phJob', {})).job.w === true, 'הטלפון רואה שהמילים נרשמו');
  j = await ph3('phStart', {});
  ok(j.ok && j.state === 'queued', 'המילים והמדידות — מתחילים');
  ok((await ph3('phProg', { ppr: { s: 'asr', p: 0.5 } })).error === 'state', 'אחרי ההתחלה — לא מדווחים התקדמות בטלפון');
  const f3 = db.get('studioJobs/' + PJ3).fields;
  ok(f3.fpw && f3.fph && !f3.fa, 'במסמך: fpw ו־fph, בלי קול');
  Object.assign(f3, { kh: { stringValue: crypto.createHash('sha256').update(KEY).digest('hex') }, kx: { integerValue: String(R.now + 3600e3) }, state: { stringValue: 'running' } });
  j = await call({ op: 'claim', job: PJ3, key: KEY }, true).then((x) => x.j);
  ok(j.ok && j.job.files.w && j.job.files.w.id === wid && j.job.files.m.id === mid3 && !j.job.files.a && j.job.spec.pw === 1, 'בלקיחה: המילים והמדידות, בלי קול ובלי סרטון');
  const j5 = await api('create', { spec: Object.assign({}, base, { ph: 1 }) });
  const PK5 = (await api('phKey', { job: j5.job.id })).key;
  const w1 = await call({ op: 'phFile', job: j5.job.id, key: PK5, which: 'w', id: SR.newId(j5.job.folder) }, true).then((x) => x.j);
  ok(w1.error === 'bad_params', 'בעבודה של שלב 1 — w לא נרשם');
  const j4 = await api('create', { spec: Object.assign({}, base, { ph: 1, pw: 1 }) });
  const PK4 = (await api('phKey', { job: j4.job.id })).key;
  const ph4 = (op, b) => call(Object.assign({ op, job: j4.job.id, key: PK4 }, b), true).then((x) => x.j);
  const big = await (async () => {
    const n = S.PH_WORDS_MAX + 10, x = await ph4('phUp', { size: n, type: 'application/json', name: 'w.json' });
    for (const [k, url] of Object.entries(x.urls)) { const i = +k; await R.fetch(url, { method: 'PUT', body: Buffer.alloc(Math.min(x.ps, n - (i - 1) * x.ps)) }); }
    await ph4('phDone', { id: x.id, up: x.up });
    return x.id;
  })();
  const bg4 = await ph4('phFile', { which: 'w', id: big });
  ok(bg4.error === 'file_size', 'מילים מעל התקרה — נדחה: ' + JSON.stringify(bg4));

  /* ---------- 5ג. phAlive (25/10/2026): הסרטון נשמר בטלפון עד שהפרויקט נמחק ---------- */
  const al1 = await call({ op: 'phAlive', job: PJ3, key: 'K'.repeat(43) }, true);
  ok(al1.j.ok && al1.j.alive === true, 'העבודה קיימת — alive (גם עם מפתח שפג/לא תואם: רק קיום)');
  const jx = await api('create', { spec: Object.assign({}, base, { ph: 1 }) });
  ok((await api('remove', { job: jx.job.id })).ok, 'הפרויקט נמחק באתר');
  const al2 = await call({ op: 'phAlive', job: jx.job.id, key: 'K'.repeat(43) }, true);
  ok(al2.code === 404 && al2.j.error === 'gone', 'אחרי המחיקה — gone (404): ' + JSON.stringify(al2.j));

  /* ---------- 6. תור: עבודת טלפון שחזרה לתור מחכה למדידות, לא לסרטון ---------- */
  const api_src = require('fs').readFileSync(path.join(root, 'ibkr-proxy/api/studio.js'), 'utf8');
  ok(/job\.vw && !\(\(job\.spec && job\.spec\.ph === 1 \? job\.fph : job\.fv\)/.test(api_src), 'השרת לוקח עבודת טלפון שחזרה לתור רק כשהמדידות נרשמו');

  /* ---------- 7. האתר: ‎#phpick= ו־normPbn (זהה לשרתון) ---------- */
  const fs = require('fs');
  const src = fs.readFileSync(path.join(root, 'studio.js'), 'utf8');
  const fnSrc = (name) => src.slice(src.indexOf('export function ' + name + '('), src.indexOf('\n}\n', src.indexOf('export function ' + name + '(')) + 2).replace(/^export /, '');
  const num = (v) => (Number.isFinite(+v) && +v > 0 ? +v : 0);
  const W = new Function('num', 'TextDecoder', 'atob', 'PPR_S', fnSrc('parsePhPick') + '\n' + fnSrc('normPbn') + '\n' + fnSrc('normPpr') + '\nreturn { parsePhPick, normPbn, normPpr };')(num, TextDecoder, atob, S.PPR_S);
  const pprSrc = /export const PPR_S = (\[[^\]]*\])/.exec(src);
  ok(pprSrc && JSON.stringify(JSON.parse(pprSrc[1].replace(/'/g, '"'))) === JSON.stringify(S.PPR_S), 'רשימת השלבים בטלפון — זהה בדף ובשרתון');
  for (const c of [{ s: 'asr', p: 0.4567, at: 9 }, { s: 'diar' }, { s: 'err', e: 'models_wifi' }, { s: 'err', e: 'X' }, { s: 'models', p: 7 }, { s: 'q' }, null]) {
    const a = W.normPpr(c), b = S.normPpr(c, 9);
    ok(JSON.stringify(a && Object.assign({}, a, { at: 0 })) === JSON.stringify(b && Object.assign({}, b, { at: 0 })), 'normPpr זהה בדף ובשרתון: ' + JSON.stringify(c));
  }
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const PID = 'p0123456789abcdef';
  let pp = W.parsePhPick(PID + '.' + enc({ pid: PID, name: 'הרצאה.mp4', size: 123456789, dur: 3600.5, w: 1920, h: 1080 }));
  ok(pp && pp.pid === PID && pp.name === 'הרצאה.mp4' && pp.size === 123456789 && pp.dur === 3600.5 && pp.w === 1920, '‎#phpick= — הסרטון שנבחר בטלפון (שם בעברית)');
  ok(W.parsePhPick('!space').e === 'space' && W.parsePhPick('!<b>') === null, 'שגיאה מהאפליקציה — רק קוד');
  ok(W.parsePhPick('p0123456789abcdee.' + enc({ pid: PID, size: 5 })) === null, 'pid לא תואם — נדחה');
  ok(W.parsePhPick(PID + '.' + enc({ pid: PID, size: 0 })) === null && W.parsePhPick('x.' + enc({})) === null, 'בלי גודל / מזהה לא תקין — נדחה');
  ok(W.parsePhPick(PID + '.' + enc({ pid: PID, size: 9, name: 'a\u0000\u0007b' })).name === 'ab', 'תווי בקרה בשם — יורדים');
  // 30/10/2026: בבחירה דרך האפליקציה — טביעת האצבע והכתוביות שבקובץ (מקטע שלישי, דחוס)
  const zl = require('zlib');
  const Z = zl.deflateRawSync(Buffer.from(JSON.stringify([{ i: 2, l: 'eng', t: 'SDH', f: false, x: '1\n00:00:01,000 --> 00:00:02,000\nHi\n' }, { i: 'x', x: 'bad' }]))).toString('base64url');
  pp = W.parsePhPick(PID + '.' + enc({ pid: PID, size: 9, oh: '5f9fe02060a3cd40' }) + '.' + Z);
  ok(pp && pp.oh === '5f9fe02060a3cd40' && pp.z === Z, '‎#phpick= עם טביעת אצבע וכתוביות');
  ok(W.parsePhPick(PID + '.' + enc({ pid: PID, size: 9, oh: 'zz' })).oh === '' && W.parsePhPick(PID + '.' + enc({ pid: PID, size: 9 })).z === '', 'בלי (Studio ישן) — ריק');
  const phSubs = new Function('atob', 'DecompressionStream', 'Response', 'Blob', 'return ' + src.slice(src.indexOf('async function phSubs('), src.indexOf('\n}\n', src.indexOf('async function phSubs(')) + 2).replace(/^export /, ''))(atob, DecompressionStream, Response, Blob);
  const PS = await phSubs(Z);
  ok(PS.length === 1 && PS[0].i === 2 && PS[0].l === 'eng' && /Hi/.test(PS[0].x), 'phSubs — פתיחת הדחיסה, רק רצועות תקינות');
  ok(/phTracks\(f, r\)/.test(src) && /nsFor\(f, vf\)/.test(src) && /blob\.oh/.test(fs.readFileSync(path.join(root, 'studionet.js'), 'utf8')), 'בחירה דרך האפליקציה: כתוביות מהרשת (לפי oh) ומהקובץ');
  for (const c of [{ s: 'run', p: 0.42 }, { s: 'done', sz: 77, p: 0.1 }, { s: 'fail', e: 'no_codec' }, { s: 'fail', e: 'BAD!' }, { s: 'x' }, null]) {
    const a = W.normPbn(c), b = S.normPbn(c, 0);
    ok(JSON.stringify(a && Object.assign({}, a, { at: 0 })) === JSON.stringify(b && Object.assign({}, b, { at: 0, ms: undefined })), 'normPbn זהה בדף ובשרתון: ' + JSON.stringify(c));
  }

  // ה־intent המלא (Playwright לא רואה את ה־#Intent;… — נבדק כאן): החבילה של Studio, וחזרה לאתר כשהאפליקציה לא מותקנת
  const iStart = src.indexOf('function phIntent(kind, q) {'), iEnd = src.indexOf('\n}\n', iStart) + 2;
  const phIntent = new Function('uiLang', 'DL_PKG', 'location', src.slice(iStart, iEnd) + '\nreturn phIntent;')(() => 'he', 'app.thesnowball.studio', { origin: 'https://studio.thesnowball.app', pathname: '/' });
  const iu = phIntent('phburn', { pid: PID, j: 'j' + 'a'.repeat(20), k: 'K'.repeat(43), b: 'https://api.thesnowball.app', pb: 'small' });
  ok(/^intent:\/\/phburn\?pid=p0123456789abcdef&j=ja{20}&k=K{43}&b=https%3A%2F%2Fapi\.thesnowball\.app&pb=small&l=he&w=https%3A%2F%2Fstudio\.thesnowball\.app%2F#Intent;scheme=snbstudio;package=app\.thesnowball\.studio;S\.browser_fallback_url=[^;]*phpick%3D!noapp;end$/.test(iu), 'intent://phburn — הפרמטרים, החבילה של Studio, וחזרה עם noapp: ' + iu.slice(0, 80));
  const android = fs.readFileSync(path.join(root, 'android/app/src/studio/AndroidManifest.xml'), 'utf8');
  ok(['phpick', 'ph', 'phburn', 'phgo'].every((x) => android.includes('android:host="' + x + '"')), 'כל ה־intents של האתר — במניפסט של PhActivity');
  const core = fs.readFileSync(path.join(root, 'android/app/src/studio/java/io/github/yishaiguedj1/snowball/PhCore.kt'), 'utf8');
  ok(/const val PH_V = 1/.test(core) && /^PH_V = 1$/m.test(fs.readFileSync(path.join(root, 'translator/job.py'), 'utf8')), 'PH_V זהה בטלפון ובעובד');
  const act = fs.readFileSync(path.join(root, 'android/app/src/studio/java/io/github/yishaiguedj1/snowball/PhActivity.kt'), 'utf8');
  ok(/"https:\/\/studio\.thesnowball\.app\/", "https:\/\/studio-staging\.thesnowball\.app\/"/.test(act), 'האפליקציה חוזרת רק לאתר של Studio (ייצור / ניסוי)');
  ok(['studioPh', 'phburn', 'phKey'].every((x) => src.includes(x)) && !/net\.api\('phBurn'/.test(src), 'הדף לא מדווח צריבה (רק האפליקציה, במפתח של העבודה)');
  // 24/10/2026 (בטלפון: הצריבה הופיעה רק בהתראה) — עבודה שהסתיימה ממשיכה להיבדק בזמן הצריבה, והאחוז נשלח כל 5 שנ׳ ברקע
  ok(/st === 'running' \|\| \(r && r\.srv && r\.srv\.bg\) \|\| phBurnLive\(r\) \|\| phPrepLive\(r\) \? 4000/.test(src) && /phBurnTap\.set\(rec\.id, Date\.now\(\)\)/.test(src), 'בזמן הצריבה (וגם כשהטלפון מתמלל/מיישר) דף העבודה שואל כל 4 שנ׳ (גם כשהעבודה "הסתיימה")');
  ok(/kind === 'ph' && rec\.spec\.pw \? \{ pw: 1 \}/.test(src) && /if \(f\.pw === true\) spec\.pw = 1/.test(src) && /on: f\.pw === true/.test(src), 'הכל בטלפון: רק כשהופעל (כבוי כברירת מחדל, 30/10/2026) — העבודה עם pw, וה־intent מעביר pw=1');
  const work = fs.readFileSync(path.join(root, 'android/app/src/studio/java/io/github/yishaiguedj1/snowball/PhWork.kt'), 'utf8');
  ok(/lastRep > 2_000/.test(work) && /class Latest/.test(work) && /pending\.getAndSet\(o\) == null/.test(work) && !/\* 0\.95/.test(work) && /repDone\(JSONObject\(\)\.put\("s", "done"\)/.test(work),
    'הצריבה מדווחת כל 2 שנ׳, רק הערך האחרון (בלי תור שמפגר — 35% בדף מול 51% בהתראה), אותו אחוז של ההתראה; "הסתיים" אחרון');
  ok(!/f\.delete\(\)/.test(work.slice(work.indexOf('fun burn('))), 'אחרי הצריבה הסרטון נשאר בטלפון (צריבה נוספת עד מחיקת הפרויקט)');
  const phStore = fs.readFileSync(path.join(root, "android/app/src/studio/java/io/github/yishaiguedj1/snowball/PhStore.kt"), "utf8");
  ok(/optString\("error"\) == "gone"/.test(phStore) && /catch \(e: Throwable\) \{ update\(ctx, pid\) \{ it\.put\("chk", now\) \}; continue \}/.test(phStore), 'הסרטון נמחק מהטלפון רק כשהשרתון ענה במפורש "gone" — תקלה/רשת לא מוחקות');
  ok(/android:name="\.PhGcJob"/.test(fs.readFileSync(path.join(root, 'android/app/src/studio/AndroidManifest.xml'), 'utf8')), 'הבדיקה ברקע (PhGcJob) במניפסט');

  // 25/10/2026 (בטלפון: "נעצר בטלפון — משהו השתבש (fail)") — Parakeet פתח את nemo128.onnx תמיד, והטלפון לא מוריד אותו.
  // כל קובץ מודל שהטלפון פותח בלי תנאי — חייב להיות ברשימת ההורדה
  const models = fs.readFileSync(path.join(root, 'android/app/src/studio/java/io/github/yishaiguedj1/snowball/PhModels.kt'), 'utf8');
  const have = new Set([...models.matchAll(/F\("([^"]+)"/g)].map((m) => m[1]));
  const labOrt = fs.readFileSync(path.join(root, 'android/app/src/labcore/java/io/github/yishaiguedj1/snowball/lab/LabOrt.kt'), 'utf8');
  const pkSrc = labOrt.slice(labOrt.indexOf('class Parakeet('), labOrt.indexOf('\n}\n', labOrt.indexOf('class Parakeet(')));
  const eager = [...pkSrc.matchAll(/(?:private )?val \w+ = (?:Vocab\.parse\()?(?:Ort\.session\()?File\(dir, "([^"]+)"/g)].map((m) => 'parakeet/' + m[1]);
  ok(eager.length >= 3 && eager.every((x) => have.has(x)), 'כל מה ש־Parakeet פותח בבנייה — בין המודלים שהטלפון מוריד: ' + eager.join(', '));
  ok(/lazy \{ Ort\.session\(File\(dir, "nemo128\.onnx"\)/.test(pkSrc) && /preL\.isInitialized\(\)/.test(pkSrc) && !have.has('parakeet/nemo128.onnx'), 'nemo128.onnx נפתח רק כשהמאפיינים לא מבחוץ (בטלפון — NemoMel)');
  const onnx = fs.readFileSync(path.join(root, 'android/app/src/phcore/java/io/github/yishaiguedj1/snowball/ph2/Onnx.kt'), 'utf8');
  const qf = [...onnx.matchAll(/File\(dir, "([^"]+)"\)/g)].map((m) => 'aligner/' + m[1]);
  ok(qf.length >= 5 && qf.every((x) => have.has(x)), 'כל מה ש־QwenAligner פותח — בין המודלים: ' + qf.join(', '));
  const local = fs.readFileSync(path.join(root, 'android/app/src/studio/java/io/github/yishaiguedj1/snowball/PhLocal.kt'), 'utf8');
  const lf = [...local.matchAll(/File\((?:md|am), "([^"]+)"\)/g)].map((m) => m[1]).filter((x) => /\./.test(x)).map((x) => have.has(x) ? x : 'aligner/model/' + x);
  ok(lf.length >= 5 && lf.every((x) => have.has(x)), 'כל קובץ ש־PhLocal פותח — בין המודלים: ' + lf.join(', '));
  ok(!/models_wifi"\)/.test(work) && !/isActiveNetworkMetered/.test(work), 'הורדת המודלים גם בחבילת גלישה — בלי חובת Wi‑Fi (בקשת המשתמש 25/10/2026)');
  ok(/fun codeOf\(e: Throwable\)/.test(work) && /"x_" \+ e\.javaClass\.simpleName/.test(work) && (work.match(/val code = codeOf\(e\)/g) || []).length === 3, 'כשל לא צפוי מדווח עם סוג החריגה (x_…), לא "fail" (הקול, הצריבה והסרטון לענן)');
  ok(/rec\.up\.ph && \(!rec\.srv \|\| !rec\.srv\.state \|\| rec\.srv\.state === 'new'\)/.test(src) && /T\('studioPhStopBig'\)/.test(src), 'עבודה שעוד בטלפון — בלי "הקבצים מוכנים בענן"');

  // 25/10/2026 (בקשת המשתמש): הסרטון שנצרב בטלפון — בנגן שלנו, עם בחירת קול וכתוביות
  const SP = await import('../studioplay.js');
  ok(SP.trackLang('und') === '' && SP.trackLang('HEB') === 'heb' && SP.trackLang('en') === 'en' && SP.trackLang('x-y') === '', 'trackLang: קוד ISO בלבד, und = בלי');
  const isT = (t) => !/ec-3|ac-3/.test(t);
  ok(!SP.fileNeedsBridge([{ c: 'aac' }, { c: 'opus' }], 0, isT) && SP.fileNeedsBridge([{ c: 'aac' }, { c: 'opus' }], 1, isT) && SP.fileNeedsBridge([{ c: 'eac3' }], 0, isT),
    'גשר הקול: לכל רצועה חוץ מהראשונה, ולראשונה רק כשהדפדפן לא מכיר אותה');
  ok(SP.pickAudio([{ l: 'eng', d: true }, { l: 'heb' }], 'heb') === 1 && SP.pickAudio([{ l: 'eng' }, { l: 'heb', d: true }], '') === 1, 'הרצועה ההתחלתית: השפה שנבחרה, אחרת ברירת המחדל של הקובץ');
  const pls = fs.readFileSync(path.join(root, 'studioplay.js'), 'utf8');
  ok(/if \(opts\.burned\) ccB\.disabled = !hasEn\(\);/.test(pls) && /page === 't' && opts\.burned/.test(pls), 'בסרטון צרוב — כתוביות המקור באנגלית מעל (בלי עברית כפולה)');
  ok(/opts\.localFile \|\| mode !== 'file'/.test(pls) && /if \(opts\.localFile\) fileTracks\(\);/.test(pls) && /if \(fBridge\) \{ fBridge\.destroy\(\)/.test(pls), 'קובץ מקומי: רצועות מ־Mediabunny, בלי פענוח Dolby כפול, והגשר נסגר עם הנגן');
  const iO = src.indexOf('export const phOutName'), oName = new Function(src.slice(iO + 7, src.indexOf('\n', iO)).replace(/^const phOutName = /, 'return ').replace(/;\s*\/\/.*$/, ''))();
  ok(oName('My Clip.mp4', false) === 'My Clip — עברית.mp4' && oName('a/b:c.mkv', true) === 'a_b_c — עברית קטן.mp4' && oName('', false) === 'video — עברית.mp4', 'שם הקובץ שנצרב = PhCore.outName');
  ok(/const phLocal = \(rec\) =>/.test(src) && /burnedOut\(rec\) \|\| phLocal\(rec\)/.test(src) && /handleOp\('get', 'po:' \+ rec\.id\)/.test(src) && /handleOp\('del', 'po:' \+ id\)/.test(src) && /phSizeOk/.test(src),
    'צפייה בסרטון שנצרב: ידית שמורה לכל עבודה (נמחקת עם העבודה), נבדק לפי הגודל');
  const pcore = fs.readFileSync(path.join(root, 'android/app/src/studio/java/io/github/yishaiguedj1/snowball/PhCore.kt'), 'utf8');
  ok(/if \(all\) "1:a" else "1:a:0"/.test(pcore) && /info, aac, !small\)/.test(work), 'הצריבה: כל רצועות הקול (לוואטסאפ — רק הראשונה)');

  console.log('\nכל ' + n + ' הבדיקות עברו ✓');
})().catch((e) => { console.error(e); process.exit(1); });
