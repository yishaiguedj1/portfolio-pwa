// 23/10/2026 (בקשת המשתמש: העלאה שממשיכה גם כשהאפליקציה סגורה): הסרטון ב־Background Fetch.
// 1. functions/up.js — רק קישור חתום לחלק של העלאה בסטודיו ב־R2 (לא שער פתוח), והגוף עובר כמו שהוא
// 2. השרתון האמיתי (api/studio.js, Firestore ו־R2 מדומים): r2bg → קישורים לכל החלקים + מפתח סיום; r2bgDone בלי התחברות —
//    רק עם המפתח, סוגר את ההעלאה ורושם את הסרטון; מפתח שגוי / עבודה אחרת / פעם שנייה
// 3. studiobg.js — מתי מנסים, תכנון החלקים, הרשמה ל־Background Fetch, הצטרפות אחרי רענון, דפדפן שלא תומך, ביטול
// 4. sw.js — המאזינים: הצלחה → r2bgDone לשרתון מהרשימה בלבד + עדכון ההתראה; כישלון; מזהה של מישהו אחר — לא נוגעים
// 5. studio.js — הסרטון ברקע רק אחרי הקול, נופל להעלאה הרגילה, מבוטל במחיקה
// הרצה: node tests/studio-bgup.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const { fakeR2, ENV } = require('./_r2fake');

(async () => {
  /* ---------- 1. functions/up.js ---------- */
  const UP = await import(path.join(root, 'functions/up.js'));
  Object.assign(process.env, ENV);
  const R2 = require(path.join(root, 'ibkr-proxy/lib/r2.js'));
  const SR = require(path.join(root, 'ibkr-proxy/lib/studior2.js'));
  R2._reset();
  const R = fakeR2();
  const c = R2.config();
  const FOLDER0 = SR.folderFor('j' + 'Q'.repeat(20)), ID0 = SR.newId(FOLDER0);
  const real = await R2.mpPartUrl(c, { fetch: R.fetch, now: () => R.now }, SR.keyOf('ownerUid0001', ID0), 'UPLOADID', 3, 3600);
  ok(UP.upTarget(real) === real, 'קישור חתום אמיתי של השרתון לחלק של העלאה — מתקבל');
  const u = new URL(real);
  const bad = (f) => { const x = new URL(real); f(x); return UP.upTarget(x.href); };
  ok(bad((x) => { x.hostname = 'evil.example'; }) === '' && bad((x) => { x.hostname = 'a'.repeat(32) + '.r2.cloudflarestorage.com.evil.example'; }) === '',
    'מארח אחר (גם שמסתיים בכתובת דומה) — נדחה');
  ok(bad((x) => { x.protocol = 'http:'; }) === '' && bad((x) => { x.pathname = x.pathname.replace('/st/', '/lib/'); }) === ''
    && bad((x) => { x.pathname = x.pathname + 'x'; }) === '', 'לא https / לא קובץ של הסטודיו — נדחה');
  ok(bad((x) => { x.searchParams.delete('X-Amz-Signature'); }) === '' && bad((x) => { x.searchParams.delete('uploadId'); }) === ''
    && bad((x) => { x.searchParams.set('x-id', 'GetObject'); }) === '' && bad((x) => { x.searchParams.append('partNumber', '4'); }) === ''
    && bad((x) => { x.searchParams.set('partNumber', '0'); }) === '', 'בלי חתימה / בלי העלאה / פרמטר נוסף / כפול / מספר חלק לא תקין — נדחה');
  ok(UP.upTarget('') === '' && UP.upTarget('javascript:alert(1)') === '' && UP.upTarget(u.origin + u.pathname) === '', 'קלט ריק / לא כתובת — נדחה');
  {
    const sent = [];
    const fwd = async (url, len, body, st = 200) => UP.upForward(new Request('https://studio.thesnowball.app/up?u=' + encodeURIComponent(url), {
      method: 'POST', body, headers: { 'content-length': String(len) }, duplex: 'half' }),
    { fetch: async (t, o) => { sent.push({ t, o, b: Buffer.from(await new Response(o.body).arrayBuffer()) }); return new Response('', { status: st, headers: { etag: '"e1"' } }); } });
    const data = crypto.randomBytes(5000);
    let r = await fwd(real, data.length, data);
    let j = await r.json();
    ok(r.status === 200 && j.ok && j.etag === '"e1"' && sent[0].t === real && sent[0].o.method === 'PUT' && sent[0].o.headers['content-length'] === '5000'
      && Buffer.compare(sent[0].b, data) === 0, 'החלק עובר ל־R2 ב־PUT לאותו קישור, באותו אורך ובאותם בייטים');
    r = await fwd('https://evil.example/x', 10, Buffer.alloc(10));
    ok(r.status === 400 && sent.length === 1, 'יעד לא תקין — לא שולחים לשום מקום');
    r = await fwd(real, UP.UP_MAX + 1, Buffer.alloc(10));
    ok(r.status === 413 && sent.length === 1, 'מעל 100MB (מגבלת Workers) — נדחה לפני שליחה');
    r = await fwd(real, 10, Buffer.alloc(10), 403);
    ok(r.status === 403 && !(await r.json()).ok, 'קישור שפג (403 מ־R2) — כישלון גלוי (Background Fetch נכשל והטלפון חוזר להעלאה הרגילה)');
    r = await fwd(real, 10, Buffer.alloc(10), 500);
    ok(r.status === 502, 'תקלה ב־R2 — 502');
    {
      const big = await UP.upForward(new Request('https://studio.thesnowball.app/up?u=' + encodeURIComponent(real), {
        method: 'POST', body: Buffer.alloc(10), headers: { 'content-length': '10' }, duplex: 'half' }),
      { fetch: async () => new Response('', { status: 200, headers: { etag: '"' + 'x'.repeat(9000) + '"' } }) });
      const sizes = [(await big.arrayBuffer()).byteLength];
      for (const st of [403, 500]) sizes.push((await (await fwd(real, 10, Buffer.alloc(10), st)).arrayBuffer()).byteLength);
      ok(sizes.every((n) => n > 0 && n < 400), 'כל תשובה של /up קטנה (גם עם ETag ענק) — מתחת לתקרה שהטלפון מצהיר ל־Chrome לכל חלק');
    }
    const g = UP.onRequestGet();
    ok((await g.json()).up === 1, 'GET /up = "יש כאן נתיב העלאה" (הטלפון בודק לפני)');
  }

  /* ---------- 2. השרתון ---------- */
  const sa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const fb = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  Object.assign(process.env, ENV, {
    GDRIVE_SA_KEY: JSON.stringify({ client_email: 'sa@p.iam.gserviceaccount.com', private_key: sa.privateKey.export({ type: 'pkcs8', format: 'pem' }) }),
    LIBRARY_READERS: 'owner@example.com', STUDIO_USERS: 'other@example.com',
  });
  delete process.env.IBKR_VAULT_KEY;
  const gauth = require(path.join(root, 'ibkr-proxy/lib/gauth.js'));
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
    if (!m) return J({ documents: [] });
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
  const call = async (body, origin = 'https://studio.thesnowball.app') => {
    const res = { code: 0, j: null, setHeader() {}, status(cd) { res.code = cd; return res; }, json(o) { res.j = o; return res; }, end() { return res; } };
    const req = { method: 'POST', query: {}, body, headers: origin ? { origin } : {}, socket: { remoteAddress: '9.9.9.8' } };
    await studio._handler(req, res, deps());
    return res;
  };
  const phone = (who) => (op, b) => call(Object.assign({}, b, { op, idToken: who })).then((r) => r.j);
  const api = phone(OWNER), other = phone(OTHER);
  const MiB = 1024 * 1024;
  const video = crypto.randomBytes(9 * MiB + 77), audio = crypto.randomBytes(300000);
  const spec = { name: 'lecture.mp4', size: video.length, type: 'video/mp4', dur: 600, from: 'en', to: ['he'], mode: 'sonnet-medium', out: ['same'], eng: 'api', cap: 5 };
  let j = await api('create', { spec });
  ok(j.ok && SR.isFolder(j.job.folder), 'עבודה במצב שרת — תיקייה ב־R2');
  const JOB = j.job.id, FOLDER = j.job.folder;
  const put = async (url, body) => { const r = await R.fetch(url, { method: 'PUT', body }); return { status: r.status }; };
  const fa = await store.r2Upload({ api, job: store.r2JobOf(FOLDER), name: 'a.m4a', blob: new Blob([audio]), size: audio.length, mime: 'audio/mp4' }, { put, sleep: async () => {} });
  ok((await api('file', { job: JOB, which: 'a', id: fa.id, folder: FOLDER })).ok, 'הקול עלה ונרשם (כמו היום)');

  j = await api('r2bg', { job: JOB, size: video.length, type: 'video/mp4', name: 'lecture.mp4' });
  ok(j.ok && SR.inFolder(j.id, FOLDER) && j.ps === SR.bgPartSize(video.length) && j.ps === 8 * MiB && Object.keys(j.urls).length === 2 && /^[A-Za-z0-9_-]{43}$/.test(j.fk) && j.exp > R.now,
    'r2bg: חלקים לפי bgPartSize, קישור לכל חלק חסר, מפתח סיום חד־פעמי');
  const urlTtl = Number(new URL(j.urls[1]).searchParams.get('X-Amz-Expires'));
  ok(urlTtl === SR.BG_TTL, 'הקישורים לשלושה ימים (הדפדפן יכול להשהות בלי רשת)');
  ok(UP.upTarget(j.urls[1]) === j.urls[1], 'הקישור שהשרתון נותן עובר את הבדיקה של /up');
  const rec0 = db.get('studioUp/' + j.id).fields;
  ok(rec0.bk && /^[a-f0-9]{64}$/.test(rec0.bk.stringValue) && rec0.bk.stringValue !== j.fk && !JSON.stringify(rec0).includes(j.fk), 'ברשומה רק ה־hash של המפתח');
  const BG = j;
  ok((await other('r2bg', { job: JOB, size: video.length })).error === 'no_job', 'משתמש אחר — לא פותח העלאה ברקע בעבודה שלי');

  const done = (b, origin) => call(Object.assign({ op: 'r2bgDone', job: JOB }, b), origin);
  let r = await done({ id: BG.id, up: BG.up, fk: BG.fk });
  ok(r.code === 200 && r.j.ok === false && r.j.error === 'r2_parts', 'לפני שהחלקים הגיעו — לא נסגר');
  for (const [n, u] of Object.entries(BG.urls)) await R.fetch(u, { method: 'PUT', body: video.subarray((n - 1) * BG.ps, n * BG.ps) });
  r = await done({ id: BG.id, up: BG.up, fk: 'x'.repeat(43) });
  ok(r.code === 403 && !db.get('studioJobs/' + JOB).fields.fv, 'מפתח שגוי — 403, הסרטון לא נרשם');
  r = await done({ id: BG.id, up: BG.up, fk: BG.fk }, '');
  ok(r.code === 403, 'בלי Origin של האפליקציה — נחסם (guard)');
  r = await done({ id: BG.id, up: BG.up, fk: BG.fk, job: 'j' + 'Z'.repeat(20) });
  ok(r.code === 404, 'עבודה אחרת — לא נמצא');
  r = await done({ id: BG.id, up: BG.up, fk: BG.fk });
  const fv = JSON.parse(db.get('studioJobs/' + JOB).fields.fv.stringValue);
  ok(r.code === 200 && r.j.ok && fv.id === BG.id && fv.size === video.length, 'עם המפתח: ההעלאה נסגרה והסרטון נרשם בעבודה — בלי התחברות ובלי הטלפון');
  ok(!db.get('studioUp/' + BG.id).fields.bk.stringValue, 'המפתח נמחק אחרי הסיום (פעם אחת)');
  r = await done({ id: BG.id, up: BG.up, fk: BG.fk });
  ok(r.code === 403, 'אותו מפתח פעם שנייה — 403 (אבל הסרטון כבר רשום)');
  const fin = await store.r2Upload({ api, job: store.r2JobOf(FOLDER), name: 'lecture.mp4', blob: new Blob([video]), size: video.length, mime: 'video/mp4',
    st: { id: BG.id, up: BG.up, ps: BG.ps } }, { put: async () => { throw new Error('לא אמור להעלות'); }, sleep: async () => {} });
  ok(fin.id === BG.id && fin.size === video.length, 'הדף נפתח אחרי שה־service worker סיים — ההעלאה הרגילה רק מאשרת, בלי להעלות שוב');
  j = await api('r2bg', { job: JOB, id: BG.id, size: video.length });
  ok(j.ok && j.file, 'r2bg על קובץ שכבר הושלם — מחזיר את הקובץ');

  // העלאה רגילה בתחילתה (8MiB) → r2bg מתחיל מחדש בחלקים גדולים; העלאה שרובה כבר עלה — ממשיכה (או no_bg)
  const big = { s: 9 * MiB * 450, k: SR.keyOf('ownerUid0001', SR.newId(FOLDER)) };
  const recSmall = { k: big.k, s: big.s, t: 'video/mp4', n: 'x', up: await R2.mpCreate(c, { fetch: R.fetch, now: () => R.now }, big.k, 'video/mp4'), ps: 8 * MiB, ok: 0, at: R.now, by: 'phone', uid: 'ownerUid0001' };
  const o1 = await SR.upBg(c, { fetch: R.fetch, now: () => R.now }, { uid: 'ownerUid0001', folder: FOLDER, id: big.k.split('/').pop(), size: big.s, rec: recSmall });
  ok(o1.res.ok && o1.res.ps === SR.bgPartSize(big.s) && o1.res.ps === SR.BG_PS && o1.res.up !== recSmall.up, 'העלאה רגילה בחלקים קטנים שעוד בתחילתה — מתחילים מחדש בחלקים גדולים (64MiB לסרטון של 4GB)');

  // 24/10/2026: ההתראה של Chrome מתקדמת לפי חלקים — כ־64 צעדים, בין 8MiB ל־64MiB לחלק
  const steps = (sz) => Math.ceil(sz / SR.bgPartSize(sz));
  ok(SR.bgPartSize(130e6) === 8 * MiB && steps(130e6) === 16 && SR.bgPartSize(650e6) === 10 * MiB && steps(650e6) <= SR.BG_STEPS
    && SR.bgPartSize(5e9) === SR.BG_PS && SR.bgPartSize(SR.MAX.phone) <= SR.BG_PART_MAX && steps(SR.MAX.phone) <= SR.BG_MAX_PARTS
    && [70e6, 200e6, 1e9, 3e9, 4.2e9].every((sz) => SR.bgPartSize(sz) % MiB === 0 && SR.bgPartSize(sz) >= 8 * MiB && SR.bgPartSize(sz) <= SR.BG_PS && steps(sz) <= SR.BG_STEPS + 1),
    'bgPartSize: צעדים קטנים בהתראה (עד ~64), חלק בין 8MiB ל־64MiB, מתחת לתקרת /up ולמספר החלקים');

  /* ---------- 3. studiobg.js ---------- */
  const B = await import(path.join(root, 'studiobg.js'));
  const base = { size: 200 * MiB, r2: true, ext: false, wifi: false, off: false, api: true, up: true };
  ok(B.bgEligible(base) && !B.bgEligible(Object.assign({}, base, { size: 10 * MiB })) && !B.bgEligible(Object.assign({}, base, { r2: false }))
    && !B.bgEligible(Object.assign({}, base, { ext: true })) && !B.bgEligible(Object.assign({}, base, { wifi: true }))
    && !B.bgEligible(Object.assign({}, base, { off: true })) && !B.bgEligible(Object.assign({}, base, { up: false })) && !B.bgEligible(Object.assign({}, base, { api: false })),
  'מתי מנסים: רק R2, סרטון גדול, לא מ־Drive, לא "רק Wi‑Fi", יש /up ו־Background Fetch, והדפדפן לא סירב קודם');
  ok(B.bgApis('https://api.thesnowball.app').join() === 'https://api.thesnowball.app,https://ibkr-proxy-wine.vercel.app' && B.bgApis('https://api-staging.thesnowball.app').length === 1,
    'השרתונים ל־service worker: בייצור גם הגיבוי ב־Vercel, בניסוי רק שלו');
  const plan = B.bgPlan(150, 64, { 3: 'u3', 1: 'u1', x: 'bad' });
  ok(plan.length === 2 && plan[0].n === 1 && plan[0].start === 0 && plan[0].end === 64 && plan[1].n === 3 && plan[1].start === 128 && plan[1].end === 150,
    'תכנון: חלק לכל קישור, לפי הסדר, האחרון קצר');
  ok(B.bgIdOf(JOB) === 'snbup-' + JOB && B.jobOfBgId('snbup-' + JOB) === JOB && B.bgIdOf('../x') === '' && B.jobOfBgId('other-' + JOB) === '', 'מזהה ה־Background Fetch לפי העבודה');

  const mkEnv = (bgf) => {
    const saved = [];
    return { saved, env: { reg: async () => ({ backgroundFetch: bgf }), Request: function (u, o) { this.url = u; this.o = o; }, put: async (x) => { saved.push(x); }, del: async (k) => { saved.push({ del: k }); },
      base: () => 'https://api.thesnowball.app', lang: () => 'he', now: () => 1000 } };
  };
  const fakeBg = () => {
    const L = new Set();
    const bg = { uploaded: 0, uploadTotal: 0, result: '', failureReason: '', aborted: false,
      addEventListener: (k, f) => L.add(f), removeEventListener: (k, f) => L.delete(f), abort: async () => { bg.aborted = true; return true; },
      fire: () => [...L].forEach((f) => f()) };
    return bg;
  };
  {
    const bg = fakeBg(); let got = null, apiCalls = [];
    const bgf = { get: async () => null, fetch: async (id, reqs, opt) => { got = { id, reqs, opt }; bg.uploadTotal = reqs.reduce((a, r) => a + r.o.body.size, 0); return bg; } };
    const { env, saved } = mkEnv(bgf);
    const blob = new Blob([Buffer.alloc(150)]);
    const prog = [];
    const st = [];
    const p = B.bgUpload({ api: async (op, b) => { apiCalls.push([op, b]); return { ok: true, id: 'FID', up: 'UP', ps: 64, done: [2], urls: { 1: 'https://r/1', 3: 'https://r/3' }, fk: 'K'.repeat(43), exp: 9 }; },
      job: JOB, name: 'v.mp4', blob, size: 150, mime: 'video/mp4', onState: (x) => st.push(x), onProgress: (b) => prog.push(b), title: 'T' }, env);
    await new Promise((r) => setTimeout(r, 20));
    ok(apiCalls[0][0] === 'r2bg' && got.id === 'snbup-' + JOB && got.reqs.length === 2 && got.reqs[0].url === '/up?u=' + encodeURIComponent('https://r/1')
      && got.reqs[0].o.method === 'POST' && got.reqs[0].o.body.size === 64 && got.reqs[1].o.body.size === 22 && got.opt.title === 'T' && !('downloadTotal' in got.opt),
    'נרשם Background Fetch: POST ל־/up באותו מקור לכל חלק חסר, עם הקישור החתום שלו — בלי downloadTotal (ההתראה לפי חלקים, בלי ספירה כפולה)');
    ok(st[0].id === 'FID' && st[0].up === 'UP' && st[0].ps === 64, 'מצב ההעלאה נשמר (ההעלאה הרגילה ממשיכה מאותה העלאה)');
    ok(saved[0].id === 'snbup-' + JOB && saved[0].fk === 'K'.repeat(43) && saved[0].fid === 'FID' && saved[0].apis.length === 2 && saved[0].l === 'he',
      'מה שה־service worker צריך — נשמר (העבודה, הקובץ, המפתח, השרתונים, השפה)');
    bg.uploaded = 40; bg.fire();
    ok(prog[prog.length - 1] === 64 + 40, 'התקדמות: מה שכבר הגיע קודם + מה שעלה עכשיו');
    bg.uploaded = 80; bg.fire(); bg.uploaded = 50; bg.fire();
    ok(prog[prog.length - 1] === 64 + 80, 'Chrome סופר חלק פעמיים ואז יורד — מה שהוצג לא יורד (27/10/2026)');
    bg.uploaded = 86; bg.result = 'success'; bg.fire();
    ok((await p).ok, 'הסתיים בהצלחה → ok (וההעלאה הרגילה רק תסגור)');
  }
  {
    const bg = fakeBg(); bg.uploadTotal = 100; bg.uploaded = 30;
    let fetched = false, called = false;
    const { env } = mkEnv({ get: async () => bg, fetch: async () => { fetched = true; } });
    const p = B.bgUpload({ api: async () => { called = true; return {}; }, job: JOB, blob: new Blob([]), size: 150 }, env);
    await new Promise((r) => setTimeout(r, 10));
    ok(!fetched && !called, 'אחרי רענון: מצטרפים ל־Background Fetch שכבר רץ (בלי לפתוח חדש)');
    bg.result = 'failure'; bg.failureReason = 'bad-status'; bg.fire();
    ok((await p).fallback === 'bg_bad-status', 'נכשל → חוזרים להעלאה הרגילה (היא ממשיכה מהחלקים שהגיעו)');
  }
  {
    const { env, saved } = mkEnv({ get: async () => null, fetch: async () => { throw new TypeError('Requests with a body are not supported'); } });
    const r1 = await B.bgUpload({ api: async () => ({ ok: true, id: 'FID', up: 'UP', ps: 64, done: [], urls: { 1: 'https://r/1' }, fk: 'K'.repeat(43) }), job: JOB, blob: new Blob([Buffer.alloc(10)]), size: 10 }, env);
    ok(r1.unsupported && saved.some((x) => x.del === 'snbup-' + JOB), 'הדפדפן לא מקבל העלאה ב־Background Fetch → unsupported (לא לנסות שוב בטלפון הזה), בלי רשומה יתומה');
    const r2 = await B.bgUpload({ api: async () => ({}), job: JOB, blob: new Blob([]), size: 10 }, { reg: async () => ({}) });
    ok(r2.unsupported, 'אין Background Fetch בכלל → unsupported');
    const r3 = await B.bgUpload({ api: async () => ({ ok: false, error: 'no_bg' }), job: JOB, blob: new Blob([]), size: 10 }, mkEnv({ get: async () => null, fetch: async () => null }).env);
    ok(r3.fallback === 'no_bg', 'השרתון לא נתן (no_bg / רשת) → ההעלאה הרגילה');
  }
  {
    const bg = fakeBg(); bg.uploadTotal = 100;
    const ctl = new AbortController();
    const p = B.bgUpload({ api: async () => ({}), job: JOB, blob: new Blob([]), size: 150, signal: ctl.signal }, mkEnv({ get: async () => bg }).env);
    await new Promise((r) => setTimeout(r, 10));
    ctl.abort();
    ok((await p).aborted && bg.aborted, 'עצירה / מחיקה בדף → מבטלים גם את ה־Background Fetch');
  }

  // 26/10/2026 (בטלפון: "עלו 1KB מתוך 187MB" יותר מדקה): Chrome קיבל ולא התחיל — שעון תקיעה, רק כשהדף מוצג
  {
    ok(B.bgStallLimit(false, 8 * MiB) === B.BG_FIRST_MS && B.bgStallLimit(true, 8 * MiB) === B.BG_STALL_MS
      && B.bgStallLimit(true, 64 * MiB) === 512 * 1000, 'הסף: בלי בית אחד — 2 דק׳; אחרי שהתחיל — חלק שלם בקצב איטי, לפחות 3 דק׳');
    const run = async ({ start = 0, vis = () => true, steps, poll }) => {
      const bg = fakeBg(); bg.uploadTotal = 100; bg.uploaded = start;
      let t = 1000; const prog = [];
      const m = mkEnv({ get: async () => bg }); m.env.now = () => t; m.env.visible = vis;
      const ctl = new AbortController();
      const p = B.bgUpload({ api: async () => ({}), job: JOB, blob: new Blob([]), size: 150, st: { id: 'FID', up: 'UP', ps: 8 * MiB }, signal: ctl.signal, poll, onProgress: (b) => prog.push(b) }, m.env);
      await new Promise((r) => setTimeout(r, 5));
      let res = null; p.then((x) => { res = x; });
      for (const s of steps) { t += s.dt; if (s.up != null) bg.uploaded = s.up; bg.fire(); await new Promise((r) => setTimeout(r, 2)); if (res) break; }
      await new Promise((r) => setTimeout(r, 5));
      const out = { res, bg, aborted: bg.aborted, saved: m.saved, prog };
      if (!res) { ctl.abort(); await p; }   // התרחיש שלא הסתיים — עוצרים (בלי טיימר שנשאר)
      return out;
    };
    const tens = (n, extra = {}) => Array.from({ length: n }, () => Object.assign({ dt: 10000 }, extra));
    let r = await run({ steps: tens(11) });
    ok(!r.res, 'פחות מ־2 דק׳ בלי התקדמות — מחכים');
    r = await run({ steps: tens(13) });
    ok(r.res && r.res.stall && r.res.fallback === 'bg_stall' && !r.res.started && r.bg.aborted && r.saved.some((x) => x.del === 'snbup-' + JOB),
      '2 דק׳ בלי בית אחד (גם לא בשרת) כשהדף מוצג → מבטלים את ה־Background Fetch, מוחקים את הרשומה, וההעלאה הרגילה ממשיכה');
    // Chrome לא מדווח לדף (0 כל הזמן), אבל החלקים מגיעים ל־R2 — השרתון הוא ההתקדמות, ולא מבטלים
    {
      let k = 0; const calls = [];
      const poll = async () => { calls.push(1); k += 2; return { ok: true, ps: 64, done: Array.from({ length: Math.min(k, 3) }, (_, i) => i + 1) }; };
      const PS = 64; // size 150 = 64 + 64 + 22
      r = await run({ poll, steps: tens(40) });
      ok(!r.res && !r.aborted && calls.length >= 3 && Math.max(...r.prog) === 150 && r.prog.includes(128),
        'Chrome לא מדווח (אפס), החלקים מגיעים ל־R2 → ההתקדמות מהשרתון (64+64 ואז 150), בלי ביטול — וכשהכל שם מחכים לסגירה של ה־service worker');
      ok(B.partsBytes(150, PS, [1, 3]) === 86 && B.partsBytes(150, PS, [1, 1, 9]) === 64 && B.partsBytes(0, PS, [1]) === 0, 'partsBytes: האחרון קצר, כפולים / מחוץ לטווח לא נספרים');
    }
    {
      const poll = async () => ({ ok: true, file: { size: 150 }, done: [] });
      r = await run({ poll, steps: tens(3) });
      ok(r.res && r.res.ok && !r.aborted && Math.max(...r.prog) === 150, 'השרתון אומר שהקובץ כבר שלם (ה־service worker סגר) → מסיימים ok');
    }
    {
      let calls = 0;
      const poll = async () => { calls++; return { ok: true, ps: 64, done: [1] }; };
      r = await run({ poll, vis: () => false, steps: tens(10) });
      ok(calls === 0, 'הדף ברקע — לא פונים לשרתון (בלי קריאות מיותרות)');
      calls = 0;
      r = await run({ poll, steps: tens(10) });
      ok(calls >= 3 && calls <= 6, 'פנייה לשרתון לכל היותר פעם ב־20 שנ׳ (לא בכל טיק)');
    }
    r = await run({ vis: () => false, steps: tens(40) });
    ok(!r.res && !r.aborted, 'הדף ברקע — לא סופרים (שם Background Fetch הוא כל הטעם)');
    r = await run({ steps: [{ dt: 10000, up: 0 }, { dt: 60000, up: 0 }, { dt: 60000, up: 0 }] });
    ok(!r.res, 'טיק אחד אחרי הפסקה ארוכה (טיימר מואט) — לא נספר כולו');
    r = await run({ start: 10, steps: tens(15).concat([{ dt: 10000, up: 20 }], tens(15)) });
    ok(!r.res, 'אחרי שהתחיל: עד 3 דק׳ בין עדכונים — תקין (Chrome מעדכן רק כשחלק נגמר)');
    r = await run({ start: 10, steps: tens(19) });
    ok(r.res && r.res.stall && r.res.started, 'התחיל ונעצר יותר מ־3 דק׳ → נתקע');
  }
  {
    const st = read('studio.js');
    ok(/visible: \(\) => typeof document === 'undefined' \|\| document\.visibilityState === 'visible'/.test(st), 'studio.js: השעון יודע אם הדף מוצג');
    ok(/r\.stall \? 4/.test(st) && /if \(st >= 2\) store\.settings\.bgNo = Date\.now\(\)/.test(st) && /s\.bgS2 = Math\.min\(9/.test(st),
      'studio.js: נתקע = 4 במדידה; פעם שנייה בטלפון הזה — לא מנסים חודש; המונה נשמר בהגדרות');
    ok(/const stale = Number\(o\.bgSt\) >= 2;/.test(st) && /if \(!stale && Number\.isFinite\(\+o\.bgNo\)/.test(st) && !/s\.bgSt =/.test(st),
      'studio.js: חסימה לחודש ש־2.52.2 קבע לפי "תקיעות" שלא היו (bgSt ≥ 2) — נמחקת פעם אחת, והמונה הישן נזרק');
    ok(/run\.bg\) parts\.push\(T\('studioBgNote'\)\)/.test(st) && (read('app.js').match(/\bstudioBgNote: "/g) || []).length === 2,
      'בזמן העלאה ברקע הכרטיס אומר שהיא ממשיכה גם כשסוגרים את Studio (בשתי השפות)');
    ok((st.match(/poll: bgPoll\(id, up\)/g) || []).length === 2 && /net\.api\('r2parts', \{ job: id, id: st\.id, up: st\.up \}\)/.test(st),
      'studio.js: גם העלאה חדשה וגם המשך אחרי רענון שואלים את השרתון מה כבר ב־R2');
    ok(/if \(n <= 0\) return '0KB'/.test(st), '"0KB" כשלא עלה כלום — לא "1KB"');
  }

  /* ---------- 4. sw.js ---------- */
  const sw = read('sw.js');
  ok(/'\.\/studiobg\.js'/.test(sw.match(/const STUDIO_SHELL = \[[^\]]*\]/)[0]), 'studiobg.js בקבצי הסטודיו של sw.js (נפתח אופליין)');
  {
    const L = {}, posted = [], fetched = [], msgs = [];
    const idbData = new Map();
    const fakeIdb = { open: () => { const r = {}; setTimeout(() => { r.result = { objectStoreNames: { contains: () => true }, transaction: () => {
      const tx = {}; const done = (q) => { setTimeout(() => { if (tx.oncomplete) tx.oncomplete(); }, 0); return q; };
      tx.objectStore = () => ({ get: (k) => done({ result: idbData.get(k) }), delete: (k) => { idbData.delete(k); return done({}); } });
      return tx; } }; r.onsuccess(); }, 0); return r; } };
    let respond = (url, o) => ({ status: 200, json: async () => ({ ok: true }) });
    const self = { addEventListener: (k, f) => { L[k] = f; }, registration: { scope: 'https://studio.thesnowball.app/', showNotification: async () => {} },
      clients: { matchAll: async () => [{ postMessage: (m) => msgs.push(m), url: 'https://studio.thesnowball.app/' }], openWindow: async () => {} } };
    const ctx = { self, caches: {}, indexedDB: fakeIdb, fetch: async (u, o) => { fetched.push([u, JSON.parse(o.body)]); return respond(u, o); }, URL, Promise, console, Response: function () {}, setTimeout, JSON };
    vm.runInNewContext(sw, ctx);
    ok(['backgroundfetchsuccess', 'backgroundfetchfail', 'backgroundfetchabort', 'backgroundfetchclick'].every((k) => typeof L[k] === 'function'), 'sw.js: ארבעת המאזינים של Background Fetch');
    const ev = (id, extra) => { const e = Object.assign({ registration: { id, failureReason: 'bad-status' }, updateUI: async (o) => { posted.push(o); }, waitUntil: (p) => { e.p = p; } }, extra); return e; };
    const ID = 'snbup-' + JOB;
    idbData.set(ID, { id: ID, job: JOB, fid: 'FID', up: 'UP', fk: 'K'.repeat(43), apis: ['https://evil.example', 'https://api.thesnowball.app', 'https://ibkr-proxy-wine.vercel.app'], l: 'he' });
    let e = ev(ID); L.backgroundfetchsuccess(e); await e.p;
    ok(fetched.length === 1 && fetched[0][0] === 'https://api.thesnowball.app/api/studio' && fetched[0][1].op === 'r2bgDone' && fetched[0][1].job === JOB
      && fetched[0][1].fk === 'K'.repeat(43) && fetched[0][1].id === 'FID' && fetched[0][1].up === 'UP', 'הצלחה → r2bgDone לשרתון (רק כתובות מהרשימה הסגורה — לא evil.example)');
    ok(posted[0].title === 'הסרטון עלה — Studio ממשיך לבד' && !idbData.has(ID) && msgs[0].snbBg === JOB && msgs[0].ok, 'ההתראה מתעדכנת, הרשומה נמחקת, והדף הפתוח שומע');
    idbData.set(ID, { id: ID, job: JOB, fid: 'FID', up: 'UP', fk: 'K'.repeat(43), apis: ['https://api.thesnowball.app', 'https://ibkr-proxy-wine.vercel.app'], l: 'en' });
    fetched.length = 0;
    respond = (u) => { if (u.startsWith('https://api.')) throw new TypeError('Failed to fetch'); return { status: 200, json: async () => ({ ok: true }) }; };
    e = ev(ID); L.backgroundfetchsuccess(e); await e.p;
    ok(fetched.length === 2 && fetched[1][0].startsWith('https://ibkr-proxy-wine.vercel.app') && posted[1].title === 'Video uploaded — Studio carries on', 'השרת שלנו לא עונה → הגיבוי ב־Vercel (ובשפה של הדף)');
    idbData.set(ID, { id: ID, job: JOB, fid: 'FID', up: 'UP', fk: 'K'.repeat(43), apis: ['https://api.thesnowball.app'], l: 'he' });
    fetched.length = 0;
    respond = () => ({ status: 403, json: async () => ({ ok: false, error: 'forbidden' }) });
    e = ev(ID); L.backgroundfetchsuccess(e); await e.p;
    ok(posted[2].title === 'הסרטון עלה — פתחו את Studio כדי לסיים' && idbData.has(ID), 'השרתון סירב → "פתחו את Studio" (ההעלאה הרגילה בדף תסגור)');
    e = ev(ID); L.backgroundfetchfail(e); await e.p;
    ok(posted[3].title === 'ההעלאה נעצרה — פתחו את Studio כדי להמשיך' && msgs[msgs.length - 1].ok === false, 'כישלון → ההתראה אומרת לפתוח את Studio');
    fetched.length = 0;
    e = ev('other-download'); L.backgroundfetchsuccess(e);
    ok(!e.p && !fetched.length, 'Background Fetch של מישהו אחר — לא נוגעים');
  }

  /* ---------- 4ב. 27/10/2026: העלאה ישנה שתקועה בתור של Chrome מבוטלת לפני העלאה חדשה ---------- */
  {
    const J = (c) => 'j' + c.repeat(20);
    const aborted = [];
    const mk = (id, result) => ({ id, result, abort: async () => { aborted.push(id); return true; } });
    const regs = { ['snbup-' + J('a')]: mk('snbup-' + J('a'), ''), ['snbup-' + J('b')]: mk('snbup-' + J('b'), ''), ['snbup-' + J('c')]: mk('snbup-' + J('c'), 'success'),
      ['snbup-' + J('d')]: mk('snbup-' + J('d'), ''), 'other-dl': mk('other-dl', '') };
    const reg = { backgroundFetch: { getIds: async () => Object.keys(regs), get: async (id) => regs[id] || null } };
    const n = await B.bgSweep(reg, J('d'), (job) => job === J('b'));
    ok(n === 1 && aborted.length === 1 && aborted[0] === 'snbup-' + J('a'),
      'מבוטלת רק העלאה שלנו שאין לה עבודה פעילה — לא זו שעוד צריך, לא שהסתיימה, לא של העבודה הזו, ולא של מישהו אחר');
    ok(await B.bgSweep({ backgroundFetch: {} }, J('d')) === 0 && await B.bgSweep(null, J('d')) === 0, 'בלי getIds / בלי רישום — לא נכשל');
    const st0 = read('studio.js');
    ok(/keep: \(job\) => \{ const r = jobRec\(job\);/.test(st0) && /await bgSweep\(reg, o\.job, env\.keep\);/.test(read('studiobg.js')),
      'לפני כל העלאה חדשה — מנקים, לפי העבודות בטלפון');
  }

  /* ---------- 5. studio.js ---------- */
  const st = read('studio.js');
  const uv = st.slice(st.indexOf('upVideo: async (vGate) => {'), st.indexOf('videoDone: async'));
  ok(/if \(await bgCan\(rec, file\)\) \{\s*await audioSettled; await vGate\(\);/.test(uv) && uv.indexOf('bgTry(') < uv.indexOf('net.upload('),
    'הסרטון ברקע רק אחרי הקול (Background Fetch אי אפשר להשהות), ואחריו תמיד ההעלאה הרגילה (סוגרת / ממשיכה)');
  ok((st.match(/audioSettle\(\)/g) || []).length >= 3, 'הקול "הסתיים" בכל מסלול: כבר עלה / אין קול / עלה עכשיו');
  ok(/stopRun\(id\);\s*bgAbort\(id\);/.test(st), 'מחיקה / ביטול עבודה — מבטלים גם את ההעלאה ברקע (גם כשהדף לא מריץ אותה)');
  ok(/if \(r\.unsupported\) \{ store\.settings\.bgNo = Date\.now\(\); save\(\); \}/.test(st) && /s\.bgNo = Math\.floor\(\+o\.bgNo\)/.test(st), 'דפדפן שסירב — נשמר, ולא מנסים שוב חודש');
  const SS = require(path.join(root, 'ibkr-proxy/lib/studio.js'));
  ok(SS.UTL_KEYS.includes('bg') && /'vf', 'bg'[,\]]/.test(st), 'המדידה מהטלפון כוללת את ההעלאה ברקע (bg) — זהה בשני הצדדים');
  console.log('\nכל ' + n + ' הבדיקות עברו ✓');
})().catch((e) => { console.error(e); process.exit(1); });
