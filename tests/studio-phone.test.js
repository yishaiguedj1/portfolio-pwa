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

  /* ---------- 5. הצריבה בטלפון ---------- */
  ok((await api('phBurn', { job: JOB, pbn: { s: 'run', p: 0.5 } })).error === 'state', 'לפני שהעבודה הסתיימה — אין צריבה');
  db.get('studioJobs/' + JOB).fields.state = { stringValue: 'done' };
  ok((await api('phBurn', { job: plain.job.id, pbn: { s: 'run' } })).error === 'state', 'עבודה רגילה — אין דיווח צריבה מהטלפון');
  ok((await api('phBurn', { job: JOB, pbn: { s: '??' } })).error === 'bad_params', 'מצב לא מוכר — נדחה');
  j = await api('phBurn', { job: JOB, pbn: { s: 'run', p: 0.25 } });
  ok(j.ok && j.job.pbn.s === 'run' && j.job.pbn.p === 0.25, 'הטלפון מדווח שהצריבה רצה');
  j = await api('phBurn', { job: JOB, pbn: { s: 'done', sz: 4e8, ms: 570000 } });
  ok(j.ok && (await api('job', { job: JOB })).job.pbn.s === 'done', 'הצריבה הסתיימה — רואים את זה גם אחרי טעינה מחדש');
  ok((await other('phBurn', { job: JOB, pbn: { s: 'fail' } })).error === 'no_job', 'משתמש אחר לא מדווח על עבודה שלי');

  /* ---------- 6. תור: עבודת טלפון שחזרה לתור מחכה למדידות, לא לסרטון ---------- */
  const api_src = require('fs').readFileSync(path.join(root, 'ibkr-proxy/api/studio.js'), 'utf8');
  ok(/job\.vw && !\(\(job\.spec && job\.spec\.ph === 1 \? job\.fph : job\.fv\)/.test(api_src), 'השרת לוקח עבודת טלפון שחזרה לתור רק כשהמדידות נרשמו');

  console.log('\nכל ' + n + ' הבדיקות עברו ✓');
})().catch((e) => { console.error(e); process.exit(1); });
