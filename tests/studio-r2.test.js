// ת4: אחסון הסטודיו ב־Cloudflare R2 — חתימת SigV4 (מול הדוגמאות הרשמיות של AWS), העלאה בחלקים מהטלפון
// עם המשך אחרי ניתוק/רענון/קישור שפג, והחוקים מי ניגש לאיזה קובץ. R2 מדומה בזיכרון — הוא מאמת כל חתימה ותוקף.
// העובד: translator/tests/test_store.py.
// הרצה: node tests/studio-r2.test.js
const path = require('path');
const crypto = require('crypto');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const R2 = require(path.join(root, 'ibkr-proxy/lib/r2.js'));
const SR = require(path.join(root, 'ibkr-proxy/lib/studior2.js'));

/* ---------- R2 מדומה: תת־קבוצה של S3 + אימות חתימות ---------- */
const ACC = 'a'.repeat(32), BUCKET = 'snb-studio';
const ENV = { R2_ACCOUNT_ID: ACC, R2_ACCESS_KEY_ID: 'AKTEST', R2_SECRET_ACCESS_KEY: 'sekret/xyz', R2_BUCKET: BUCKET };
function fakeR2(o = {}) {
  const S = { objs: new Map(), ups: new Map(), now: Date.UTC(2026, 9, 10, 12), calls: [], fail: o.fail || (() => 0), seq: 0, cors: o.cors !== false };
  const host = ACC + (o.eu === false ? '' : '.eu') + '.r2.cloudflarestorage.com';
  const resp = (status, body, hd) => new Response(status === 204 || body == null ? null : body, { status, headers: hd || {} });
  const xmlErr = (status, code) => resp(status, '<Error><Code>' + code + '</Code></Error>');
  function verify(u, init) {
    const q = Object.fromEntries(u.searchParams.entries());
    const hd = {}; for (const [k, v] of Object.entries(init.headers || {})) hd[k.toLowerCase()] = v;
    const path = decodeURIComponent(u.pathname);
    if (q['X-Amz-Signature']) {
      const t = q['X-Amz-Date'];
      const now = Date.UTC(+t.slice(0, 4), +t.slice(4, 6) - 1, +t.slice(6, 8), +t.slice(9, 11), +t.slice(11, 13), +t.slice(13, 15));
      if (S.now > now + Number(q['X-Amz-Expires']) * 1000) return 'expired';
      const rest = {}; for (const k of Object.keys(q)) if (!/^X-Amz-/.test(k)) rest[k] = q[k];
      const s = R2.sign({ method: init.method || 'GET', host: u.host, path, query: rest, accessKey: 'AKTEST', secret: 'sekret/xyz', now, presign: Number(q['X-Amz-Expires']) });
      return s.sig === q['X-Amz-Signature'] ? '' : 'badsig';
    }
    const auth = hd.authorization || '';
    const m = /SignedHeaders=([^,]+), Signature=([a-f0-9]+)/.exec(auth);
    if (!m) return 'nosig';
    const t = hd['x-amz-date'];
    const now = Date.UTC(+t.slice(0, 4), +t.slice(4, 6) - 1, +t.slice(6, 8), +t.slice(9, 11), +t.slice(11, 13), +t.slice(13, 15));
    const extra = {}; for (const k of m[1].split(';')) if (!['host', 'x-amz-date', 'x-amz-content-sha256'].includes(k)) extra[k] = hd[k];
    const body = typeof init.body === 'string' ? init.body : '';
    const s = R2.sign({ method: init.method, host: u.host, path, query: Object.fromEntries(u.searchParams.entries()), headers: extra,
      payload: crypto.createHash('sha256').update(body).digest('hex'), accessKey: 'AKTEST', secret: 'sekret/xyz', now });
    return s.sig === m[2] ? '' : 'badsig';
  }
  S.fetch = async (url, init = {}) => {
    const u = new URL(url), method = init.method || 'GET';
    S.calls.push(method + ' ' + u.pathname + u.search.slice(0, 40));
    if (u.host !== host) return xmlErr(404, 'NoSuchBucket');
    if (method === 'OPTIONS') return resp(200, '', S.cors ? { 'access-control-allow-origin': init.headers.Origin } : {});
    const bad = verify(u, init);
    if (bad === 'expired') return xmlErr(403, 'ExpiredRequest');
    if (bad) return xmlErr(403, 'SignatureDoesNotMatch');
    const f = S.fail(method, u); if (f) return f === 'net' ? Promise.reject(new TypeError('net')) : xmlErr(f, 'Injected');
    const parts = decodeURIComponent(u.pathname).split('/').filter(Boolean);
    if (parts[0] !== BUCKET) return xmlErr(404, 'NoSuchBucket');
    const key = parts.slice(1).join('/');
    const q = u.searchParams;
    if (!key && method === 'GET') {
      const pre = q.get('prefix') || '';
      const ks = [...S.objs.keys()].filter((k) => k.startsWith(pre)).sort();
      return resp(200, '<ListBucketResult>' + ks.map((k) => '<Contents><Key>' + k + '</Key><Size>' + S.objs.get(k).length + '</Size><LastModified>2026-10-10T00:00:00.000Z</LastModified></Contents>').join('') + '<IsTruncated>false</IsTruncated></ListBucketResult>');
    }
    if (method === 'POST' && q.has('uploads')) { const id = 'up' + (++S.seq); S.ups.set(id, { key, parts: new Map() }); return resp(200, '<InitiateMultipartUploadResult><UploadId>' + id + '</UploadId></InitiateMultipartUploadResult>'); }
    if (q.has('uploadId')) {
      const up = S.ups.get(q.get('uploadId'));
      if (!up || up.key !== key) return xmlErr(404, 'NoSuchUpload');
      if (method === 'PUT') { const b = Buffer.from(await new Response(init.body).arrayBuffer()); up.parts.set(Number(q.get('partNumber')), b); return resp(200, '', { etag: '"' + crypto.createHash('md5').update(b).digest('hex') + '"' }); }
      if (method === 'GET') return resp(200, '<ListPartsResult>' + [...up.parts.entries()].sort((a, b) => a[0] - b[0]).map(([pn, b]) => '<Part><PartNumber>' + pn + '</PartNumber><ETag>&quot;' + crypto.createHash('md5').update(b).digest('hex') + '&quot;</ETag><Size>' + b.length + '</Size></Part>').join('') + '<IsTruncated>false</IsTruncated></ListPartsResult>');
      if (method === 'DELETE') { S.ups.delete(q.get('uploadId')); return resp(204); }
      if (method === 'POST') {
        const want = [...String(init.body).matchAll(/<PartNumber>(\d+)<\/PartNumber><ETag>([^<]+)<\/ETag>/g)].map((m) => [Number(m[1]), m[2].replace(/&quot;/g, '"')]);
        const sizes = want.map(([pn]) => (up.parts.get(pn) || Buffer.alloc(0)).length);
        if (sizes.slice(0, -1).some((s) => s !== sizes[0])) return xmlErr(400, 'InvalidPart');      // R2: אותו גודל לכל החלקים
        for (const [pn, et] of want) { const b = up.parts.get(pn); if (!b || '"' + crypto.createHash('md5').update(b).digest('hex') + '"' !== et) return xmlErr(400, 'InvalidPart'); }
        S.objs.set(key, Buffer.concat(want.map(([pn]) => up.parts.get(pn)))); S.ups.delete(q.get('uploadId'));
        return resp(200, '<CompleteMultipartUploadResult><Key>' + key + '</Key></CompleteMultipartUploadResult>');
      }
    }
    if (method === 'PUT') { S.objs.set(key, Buffer.from(await new Response(init.body).arrayBuffer())); return resp(200, ''); }
    if (method === 'HEAD') { const b = S.objs.get(key); return b ? resp(200, null, { 'content-length': String(b.length), etag: '"x"' }) : resp(404); }
    if (method === 'DELETE') { S.objs.delete(key); return resp(204); }
    if (method === 'GET') { const b = S.objs.get(key); if (!b) return xmlErr(404, 'NoSuchKey'); const r = /bytes=(\d+)-/.exec((init.headers || {}).Range || ''); return resp(r ? 206 : 200, r ? b.subarray(+r[1]) : b); }
    return xmlErr(400, 'Unsupported');
  };
  S.deps = { fetch: S.fetch, now: () => S.now };
  return S;
}

(async () => {
  /* ---------- 1. SigV4 מול הדוגמאות הרשמיות של AWS ---------- */
  const K = 'AKIAIOSFODNN7EXAMPLE', SEC = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY', T0 = Date.UTC(2013, 4, 24);
  const ex = { host: 'examplebucket.s3.amazonaws.com', accessKey: K, secret: SEC, region: 'us-east-1', now: T0 };
  ok(R2.sign(Object.assign({ method: 'GET', path: '/test.txt', presign: 86400 }, ex)).sig === 'aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404', 'AWS: קישור חתום (presigned GET)');
  ok(R2.sign(Object.assign({ method: 'GET', path: '/test.txt', headers: { Range: 'bytes=0-9' } }, ex)).sig === 'f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41', 'AWS: GET עם כותרת Authorization');
  ok(R2.sign(Object.assign({ method: 'PUT', path: '/test$file.text', headers: { Date: 'Fri, 24 May 2013 00:00:00 GMT', 'x-amz-storage-class': 'REDUCED_REDUNDANCY' },
    payload: crypto.createHash('sha256').update('Welcome to Amazon S3.').digest('hex') }, ex)).sig === '98ad721746da40c64f1a55b78f14c238d841ea1380cd77a1b5971af0ece108bd', 'AWS: PUT עם גוף ותו מיוחד בשם');
  ok(R2.sign(Object.assign({ method: 'GET', path: '/', query: { 'max-keys': '2', prefix: 'J' } }, ex)).sig === '34b48302e7b5fa45bde8084f4b7868a86f0a534bc59db6670ed5711ef69dc6f7', 'AWS: רשימה עם שאילתה');

  /* ---------- 2. הגדרה ומפתחות ---------- */
  ok(!R2.config({}).ok && R2.config(ENV).ok, 'בלי ארבעת המשתנים — לא מוגדר');
  ok(!R2.config(Object.assign({}, ENV, { R2_ACCOUNT_ID: 'xyz' })).ok, 'Account ID לא תקין — לא מוגדר');
  ok(R2.config(Object.assign({}, ENV, { R2_JURISDICTION: 'EU' })).j === 'eu' && R2.config(Object.assign({}, ENV, { R2_JURISDICTION: 'mars' })).j === '', 'אזור שיפוט: רק eu/us/fedramp');
  for (const bad of ['../x', 'a//b', '/x', 'a b', 'x/', '', 'א']) ok(!R2.okKey(bad), 'מפתח אסור: ' + JSON.stringify(bad));
  ok(R2.partSize(100) === 8 * R2.MIB && R2.partSize(200 * 1024 * R2.MIB) === 21 * R2.MIB, 'גודל חלק: לפחות 8MiB, ולא יותר מ־10,000 חלקים');
  ok(R2.partsOf(200 * 1024 * R2.MIB, R2.partSize(200 * 1024 * R2.MIB)) <= 10000, '200GB → עד 10,000 חלקים');
  const pc = R2.partsCheck([{ n: 1, size: 10 }, { n: 2, size: 10 }, { n: 3, size: 5 }], 25, 10);
  ok(pc.ok && !R2.partsCheck([{ n: 1, size: 10 }, { n: 3, size: 5 }], 25, 10).ok && R2.partsCheck([{ n: 1, size: 10 }, { n: 3, size: 5 }], 25, 10).missing[0] === 2, 'partsCheck: חלק חסר נתפס');
  ok(!R2.partsCheck([{ n: 1, size: 9 }, { n: 2, size: 10 }, { n: 3, size: 6 }], 25, 10).ok, 'partsCheck: חלק בגודל לא נכון נתפס');
  ok(!R2.partsCheck([{ n: 1, size: 10 }, { n: 2, size: 10 }, { n: 3, size: 5 }, { n: 4, size: 1 }], 25, 10).ok, 'partsCheck: חלק עודף נתפס');

  /* ---------- 3. חוקי הגישה ---------- */
  const UID = 'User12345', JOB = 'j' + 'A'.repeat(20);
  ok(SR.keyOf(UID, JOB, 'v') === 'st/User12345/' + JOB + '/in/video', 'סרטון → in/video של העבודה');
  ok(SR.keyOf(UID, JOB, 'o:he.srt') === 'st/User12345/' + JOB + '/out/he.srt' && SR.keyOf(UID, JOB, 'ck:al').endsWith('/ck/al.tgz'), 'תוצר ונקודת שמירה');
  for (const bad of ['o:../x', 'o:', 'ck:zz', 'x', 'o:a/b', 'o:.hidden']) ok(!SR.keyOf(UID, JOB, bad), 'תא אסור: ' + bad);
  ok(!SR.keyOf('ab', JOB, 'v') && !SR.keyOf(UID, 'jshort', 'v'), 'uid / מזהה עבודה לא תקינים');
  const S0 = fakeR2();
  const c = R2.config(ENV);
  R2._reset();
  let x = await SR.upStart(c, S0.deps, { uid: UID, job: JOB, slot: 'o:he.srt', size: 10, by: 'phone' });
  ok(x.res.error === 'forbidden', 'הטלפון לא כותב לתוצרים');
  x = await SR.upStart(c, S0.deps, { uid: UID, job: JOB, slot: 'v', size: 10, by: 'worker' });
  ok(x.res.error === 'forbidden', 'העובד לא כותב על הסרטון המקורי');
  x = await SR.upStart(c, S0.deps, { uid: UID, job: JOB, slot: 'a', size: 3 * 1024 ** 3, by: 'phone' });
  ok(x.res.error === 'too_big', 'קול מעל 2GB — נדחה');

  /* ---------- 4. איתור הדלי (EU / רגיל) ובדיקת חיבור ---------- */
  R2._reset();
  ok(await R2.locate(c, S0.deps) === 'eu', 'דלי ב־EU נמצא בכתובת של EU');
  const S1 = fakeR2({ eu: false }); R2._reset();
  ok(await R2.locate(c, S1.deps) === '', 'דלי רגיל נמצא בכתובת הרגילה');
  R2._reset();
  let h = await R2.health(c, S0.deps, 'https://yishaiguedj1.github.io');
  ok(h.ok && h.eu && h.cors && S0.objs.size === 0, 'בדיקת חיבור: כתיבה, קריאה, מחיקה ו־CORS');
  const S2 = fakeR2({ cors: false }); R2._reset();
  h = await R2.health(c, S2.deps, 'https://yishaiguedj1.github.io');
  ok(!h.ok && h.error === 'r2_cors', 'בלי מדיניות CORS — הבדיקה אומרת בדיוק מה חסר');
  R2._reset();
  h = await R2.health(R2.config(Object.assign({}, ENV, { R2_SECRET_ACCESS_KEY: 'wrong' })), S0.deps, '');
  ok(!h.ok, 'מפתח שגוי — הבדיקה נכשלת (החתימה לא עוברת)');
  ok(!(await R2.health(R2.config({}), S0.deps)).ok, 'לא מוגדר → not_configured');

  /* ---------- 5. העלאה מהטלפון: חלקים, ניתוק, קישור שפג, רענון באמצע ---------- */
  const store = await import(path.join(root, 'studiostore.js'));
  ok(store.partCount(25, 10) === 3 && store.partRange(25, 10, 3).end === 25 && store.doneBytes(25, 10, [1, 3]) === 15, 'חישובי החלקים בטלפון = בשרתון');
  const MiB = R2.MIB;
  const data = crypto.randomBytes(20 * MiB + 12345);       // 3 חלקים של 8MiB (האחרון קצר)
  const blob = new Blob([data]);
  function phoneEnv(S, job, opts = {}) {
    let rec = null;
    const api = async (op, b) => {
      R2.config(ENV);
      let out;
      if (op === 'r2up') out = await SR.upStart(c, S.deps, { uid: UID, job, slot: b.slot, size: b.size, type: b.type, rec, by: 'phone' });
      else if (op === 'r2parts') out = await SR.upParts(c, S.deps, { rec, up: b.up });
      else if (op === 'r2done') out = await SR.upDone(c, S.deps, { rec, up: b.up });
      if (out.rec) rec = out.rec;
      return out.res;
    };
    const put = async (url, body, hd, onP) => {
      if (opts.put) { const o = opts.put(url); if (o) return o; }
      let r; try { r = await S.fetch(url, { method: 'PUT', body }); } catch (e) { return { status: 0 }; }
      if (r.status === 403) return { status: 0 };            // בדפדפן: 403 של קישור שפג מגיע בלי CORS → נראה כשגיאת רשת
      if (onP) onP(body.size);
      return { status: r.status };
    };
    return { api, put, getRec: () => rec };
  }
  R2._reset();
  const S3 = fakeR2();
  const J1 = 'j' + 'B'.repeat(20);
  const P1 = phoneEnv(S3, J1);
  const prog = [];
  let res = await store.r2Upload({ api: P1.api, job: J1, slot: 'v', blob, size: data.length, mime: 'video/mp4', onProgress: (b) => prog.push(b) }, { put: P1.put, sleep: async () => {} });
  const key1 = SR.keyOf(UID, J1, 'v');
  ok(res.ok && Buffer.compare(S3.objs.get(key1), data) === 0, 'העלאה שלמה: הקובץ ב־R2 זהה בייט לבייט');
  ok(prog[prog.length - 1] === data.length && prog.every((b, i) => i === 0 || b >= prog[i - 1]), 'התקדמות מגיעה ל־100%');
  ok(P1.getRec().ok === 1 && !P1.getRec().up, 'ברשומת העבודה: הושלם, בלי העלאה פתוחה');
  ok(S3.ups.size === 0, 'אין העלאות פתוחות שנשארו ב־R2');

  /* ניתוק באמצע + קישור שפג + "רענון" (מנוע חדש עם המצב השמור) */
  R2._reset();
  const S4 = fakeR2();
  const J2 = 'j' + 'C'.repeat(20);
  let drop = 2, putCount = 0;
  const P2 = phoneEnv(S4, J2, { put: () => { putCount++; if (putCount === 2 && drop-- > 0) return { status: 0, stalled: true }; return null; } });
  const ac = new AbortController();
  let saved = null;
  let parts = 0;
  const first = store.r2Upload({ api: P2.api, job: J2, slot: 'v', blob, size: data.length, signal: ac.signal, onState: (s) => { saved = s; },
    onProgress: () => {} }, { put: async (u, b, hd, onP, sig) => { const r = await P2.put(u, b, hd, onP); if (r.status === 200 && ++parts === 1) ac.abort(); return r; }, sleep: async () => {}, conc: 1 });
  let aborted = false; try { await first; } catch (e) { aborted = e.name === 'AbortError'; }
  ok(aborted && saved && saved.up && S4.ups.size === 1, 'עצירה באמצע (רענון) — ההעלאה נשארת פתוחה ב־R2, המצב נשמר');
  S4.now += 2 * 3600e3;                 // הקישורים הישנים פגו
  const before = S4.calls.filter((s) => s.startsWith('PUT')).length;
  res = await store.r2Upload({ api: P2.api, job: J2, slot: 'v', blob, size: data.length, st: saved }, { put: P2.put, sleep: async () => {} });
  const putsAfter = S4.calls.filter((s) => s.startsWith('PUT')).length - before;
  ok(res.ok && Buffer.compare(S4.objs.get(SR.keyOf(UID, J2, 'v')), data) === 0, 'המשך אחרי רענון + קישורים שפגו: הקובץ שלם');
  ok(putsAfter <= 3, 'בהמשך לא שולחים שוב חלק שכבר הגיע (' + putsAfter + ' שליחות)');

  /* העלאה שהסתיימה ואז "רענון" — לא מעלים שוב */
  const again = await store.r2Upload({ api: P1.api, job: J1, slot: 'v', blob, size: data.length }, { put: async () => { throw new Error('לא אמור לשלוח'); }, sleep: async () => {} });
  ok(again.ok && again.file && again.file.size === data.length, 'קובץ שכבר הושלם — לא נשלח שוב');

  /* קובץ אחר באותו תא (גודל שונה) — ההעלאה הישנה מבוטלת וחדשה נפתחת */
  R2._reset();
  const S5 = fakeR2();
  const J3 = 'j' + 'D'.repeat(20);
  const P3 = phoneEnv(S5, J3);
  const st1 = await P3.api('r2up', { slot: 'a', size: 9 * MiB, type: 'audio/mp4' });
  const st2 = await P3.api('r2up', { slot: 'a', size: 10 * MiB, type: 'audio/mp4' });
  ok(st1.up !== st2.up && S5.ups.size === 1, 'גודל אחר = העלאה חדשה, הישנה מבוטלת ב־R2');
  ok((await P3.api('r2parts', { up: st1.up })).error === 'r2_gone', 'מזהה העלאה ישן → r2_gone');
  ok((await P3.api('r2done', { up: st2.up })).error === 'r2_parts', 'סגירה לפני שהכל הגיע — נדחית עם רשימת החסרים');
  ok(Object.keys(st2.urls).length === 2 && Number(Object.keys(st2.urls)[0]) === 1, 'קישורים רק לחלקים החסרים');

  /* שגיאה סופית (403 של מפתח שגוי בטלפון לא אפשרי — אבל 400 מ־R2) לא נכנסת ללולאה */
  R2._reset();
  const S6 = fakeR2();
  const J4 = 'j' + 'E'.repeat(20);
  const P4 = phoneEnv(S6, J4, { put: () => ({ status: 400 }) });
  let fatalCode = '';
  try { await store.r2Upload({ api: P4.api, job: J4, slot: 'v', blob: new Blob([Buffer.alloc(100)]), size: 100 }, { put: P4.put, sleep: async () => {} }); } catch (e) { fatalCode = e.code; }
  ok(fatalCode === 'r2_http_400', 'שגיאה סופית מ־R2 — עוצרים מיד');

  /* ---------- 6. הורדה לעובד ומחיקת עבודה ---------- */
  R2._reset();
  const g = await SR.getUrl(c, S3.deps, { rec: P1.getRec(), by: 'worker' });
  const gr = await S3.fetch(g.url);
  ok(g.ok && gr.status === 200 && Buffer.compare(Buffer.from(await gr.arrayBuffer()), data) === 0, 'קישור הורדה לעובד עובד');
  S3.now += 7 * 3600e3;
  ok((await S3.fetch(g.url)).status === 403, 'קישור ההורדה פג אחרי 6 שעות');
  const gp = await SR.getUrl(c, S3.deps, { rec: P1.getRec(), by: 'phone', name: 'הרצאה.mp4' });
  ok(/response-content-disposition=attachment/.test(gp.url) && /X-Amz-Expires=3600/.test(gp.url), 'קישור לטלפון: שעה, עם שם להורדה');
  ok(!(await SR.getUrl(c, S3.deps, { rec: P2.getRec() && Object.assign({}, P2.getRec(), { ok: 0 }), by: 'worker' })).ok, 'קובץ שלא הושלם — אין קישור');
  const removed = await SR.purgeJob(c, S3.deps, { uid: UID, job: J1, recs: {} });
  ok(removed === 1 && !S3.objs.has(key1), 'מחיקת עבודה מוחקת את כל הקבצים שלה');
  ok(await SR.purgeJob(c, S3.deps, { uid: '..', job: J1 }) === 0, 'מחיקה עם uid לא תקין — כלום');

  console.log('\n' + n + ' בדיקות עברו');
})().catch((e) => { console.error('FAIL -', e); process.exit(1); });
