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

const { fakeR2, ENV, ACC } = require('./_r2fake');

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

  /* ---------- 3. מזהים ותיקיות (כמו של Drive) ---------- */
  const UID = 'User12345', JOB = 'j' + 'A'.repeat(20), FOLDER = SR.folderFor(JOB);
  const id1 = SR.newId(FOLDER);
  ok(FOLDER === 'R2_' + JOB && SR.isFolder(FOLDER) && SR.isId(id1) && SR.inFolder(id1, FOLDER) && SR.folderOfId(id1) === FOLDER, 'תיקייה ומזהה של R2');
  ok(/^[A-Za-z0-9_-]{10,100}$/.test(id1) && /^[A-Za-z0-9_-]{10,100}$/.test(FOLDER), 'עוברים את FILE_ID_RE של השרתון (כמו מזהה של Drive)');
  ok(SR.keyOf(UID, id1) === 'st/' + UID + '/' + id1 && !SR.keyOf('..', id1) && !SR.keyOf(UID, 'x'), 'המפתח ב־R2: st/<uid>/<מזהה> — הבעלים בנתיב');
  ok(!SR.inFolder(SR.newId(SR.folderFor('j' + 'B'.repeat(20))), FOLDER), 'קובץ מתיקייה של עבודה אחרת — לא בתיקייה');
  ok(SR.newId(FOLDER) !== SR.newId(FOLDER), 'מזהים אקראיים');
  const S0 = fakeR2();
  const c = R2.config(ENV);
  R2._reset();
  let x = await SR.upStart(c, S0.deps, { uid: UID, folder: FOLDER, size: 3 * 1024 ** 3, by: 'phone', type: 'audio/mp4' });
  ok(x.res.ok, 'קובץ של 3GB מהטלפון — מותר');
  x = await SR.upStart(c, S0.deps, { uid: UID, folder: FOLDER, size: 21 * 1024 ** 3, by: 'phone' });
  ok(x.res.error === 'too_big', 'מעל 20GB מהטלפון — נדחה');
  x = await SR.upStart(c, S0.deps, { uid: UID, folder: FOLDER, id: SR.newId(SR.folderFor('j' + 'C'.repeat(20))), size: 10, by: 'worker' });
  ok(x.res.error === 'bad_id', 'מזהה מתיקייה אחרת — נדחה');
  x = await SR.upStart(c, S0.deps, { uid: UID, folder: 'drivefolderid123', size: 10, by: 'worker' });
  ok(x.res.error === 'bad_folder', 'תיקייה של Drive — לא כאן');

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
  ok(store.isR2Folder(FOLDER) && store.isR2Id(id1) && store.r2JobOf(id1) === JOB && store.r2JobOf(FOLDER) === JOB && !store.isR2Id('1AbCdEfGhIjKlMnOp'), 'הטלפון מזהה תיקייה / קובץ של R2 = השרתון');
  ok(String(store.R2_ID_RE) === String(/^R2_j[A-Za-z0-9_-]{20}_[A-Za-z0-9]{12}$/) && SR.isId(id1), 'אותה צורת מזהה בטלפון ובשרתון');
  const MiB = R2.MIB;
  const data = crypto.randomBytes(20 * MiB + 12345);       // 3 חלקים של 8MiB (האחרון קצר)
  const blob = new Blob([data]);
  /* "השרתון" בזיכרון: רשומת העלאה לכל מזהה — כמו studioUp/<id> ב־api/studio.js */
  function phoneEnv(S, folder, opts = {}) {
    const recs = new Map();
    const api = async (op, b) => {
      const id = b.id || '';
      const rec = id ? recs.get(id) : null;
      let out;
      if (op === 'r2up') out = await SR.upStart(c, S.deps, { uid: UID, folder, id, size: b.size, type: b.type, name: b.name, rec, by: 'phone' });
      else if (op === 'r2parts') out = await SR.upParts(c, S.deps, { id, rec, up: b.up, uid: UID });
      else if (op === 'r2done') out = await SR.upDone(c, S.deps, { id, rec, up: b.up, uid: UID });
      if (out.rec) recs.set(out.res.id || id, out.rec);
      return out.res;
    };
    const put = async (url, body, hd, onP) => {
      if (opts.put) { const o = opts.put(url); if (o) return o; }
      let r; try { r = await S.fetch(url, { method: 'PUT', body }); } catch (e) { return { status: 0 }; }
      if (r.status === 403) return { status: 0 };            // בדפדפן: 403 של קישור שפג מגיע בלי CORS → נראה כשגיאת רשת
      if (onP) onP(body.size);
      return { status: r.status };
    };
    return { api, put, recs };
  }
  R2._reset();
  const S3 = fakeR2();
  const F1 = SR.folderFor('j' + 'B'.repeat(20));
  const P1 = phoneEnv(S3, F1);
  const prog = [];
  let res = await store.r2Upload({ api: P1.api, job: store.r2JobOf(F1), name: 'הרצאה.mp4', blob, size: data.length, mime: 'video/mp4', onProgress: (b) => prog.push(b) }, { put: P1.put, sleep: async () => {} });
  ok(SR.inFolder(res.id, F1) && res.size === data.length && res.name === 'הרצאה.mp4', 'העלאה שלמה — מחזירה מזהה בתיקייה, כמו קובץ של Drive');
  ok(Buffer.compare(S3.objs.get(SR.keyOf(UID, res.id)), data) === 0, 'הקובץ ב־R2 זהה בייט לבייט');
  ok(prog[prog.length - 1] === data.length && prog.every((b, i) => i === 0 || b >= prog[i - 1]), 'התקדמות עולה בלבד ומגיעה ל־100%');
  ok(P1.recs.get(res.id).ok === 1 && !P1.recs.get(res.id).up && S3.ups.size === 0, 'הרשומה: הושלם; אין העלאות פתוחות ב־R2');
  const v1 = res.id;

  /* ניתוק באמצע + קישור שפג + "רענון" (מנוע חדש עם המצב השמור) */
  R2._reset();
  const S4 = fakeR2();
  const F2 = SR.folderFor('j' + 'C'.repeat(20));
  let drop = 2, putCount = 0;
  const P2 = phoneEnv(S4, F2, { put: () => { putCount++; if (putCount === 2 && drop-- > 0) return { status: 0, stalled: true }; return null; } });
  const ac = new AbortController();
  let saved = null, parts = 0;
  const first = store.r2Upload({ api: P2.api, job: store.r2JobOf(F2), blob, size: data.length, signal: ac.signal, onState: (st) => { saved = st; } },
    { put: async (u, b, hd, onP) => { const r = await P2.put(u, b, hd, onP); if (r.status === 200 && ++parts === 1) ac.abort(); return r; }, sleep: async () => {}, conc: 1 });
  let aborted = false; try { await first; } catch (e) { aborted = e.name === 'AbortError'; }
  ok(aborted && saved && saved.id && saved.up && S4.ups.size === 1, 'עצירה באמצע (רענון) — ההעלאה נשארת פתוחה ב־R2, המצב (מזהה + העלאה) נשמר');
  S4.now += 2 * 3600e3;                 // הקישורים הישנים פגו
  const before = S4.calls.filter((t) => t.startsWith('PUT')).length;
  res = await store.r2Upload({ api: P2.api, job: store.r2JobOf(F2), blob, size: data.length, st: saved }, { put: P2.put, sleep: async () => {} });
  const putsAfter = S4.calls.filter((t) => t.startsWith('PUT')).length - before;
  ok(res.id === saved.id && Buffer.compare(S4.objs.get(SR.keyOf(UID, res.id)), data) === 0, 'המשך אחרי רענון + קישורים שפגו: אותו קובץ, שלם');
  ok(putsAfter <= 3, 'בהמשך לא שולחים שוב חלק שכבר הגיע (' + putsAfter + ' שליחות)');

  /* העלאה שהסתיימה ואז "רענון" — לא מעלים שוב */
  const again = await store.r2Upload({ api: P1.api, job: store.r2JobOf(F1), blob, size: data.length, st: { id: v1 } }, { put: async () => { throw new Error('לא אמור לשלוח'); }, sleep: async () => {} });
  ok(again.id === v1 && again.size === data.length, 'קובץ שכבר הושלם — לא נשלח שוב');

  /* אותו מזהה עם גודל אחר — ההעלאה הישנה מבוטלת וחדשה נפתחת */
  R2._reset();
  const S5 = fakeR2();
  const F3 = SR.folderFor('j' + 'D'.repeat(20));
  const P3 = phoneEnv(S5, F3);
  const st1 = await P3.api('r2up', { size: 9 * MiB, type: 'audio/mp4' });
  const st2 = await P3.api('r2up', { id: st1.id, size: 10 * MiB, type: 'audio/mp4' });
  ok(st1.id === st2.id && st1.up !== st2.up && S5.ups.size === 1, 'גודל אחר לאותו קובץ = העלאה חדשה, הישנה מבוטלת ב־R2');
  ok((await P3.api('r2parts', { id: st1.id, up: st1.up })).error === 'r2_gone', 'מזהה העלאה ישן → r2_gone');
  ok((await P3.api('r2done', { id: st2.id, up: st2.up })).error === 'r2_parts', 'סגירה לפני שהכל הגיע — נדחית עם רשימת החסרים');
  ok(Object.keys(st2.urls).length === 2 && Number(Object.keys(st2.urls)[0]) === 1, 'קישורים רק לחלקים החסרים');
  ok((await SR.upParts(c, S5.deps, { id: st2.id, rec: P3.recs.get(st2.id), up: st2.up, uid: 'Other12345' })).res.error === 'r2_gone', 'משתמש אחר לא ממשיך העלאה שלא שלו');

  /* שגיאה סופית מ־R2 (400) לא נכנסת ללולאה */
  R2._reset();
  const S6 = fakeR2();
  const P4 = phoneEnv(S6, SR.folderFor('j' + 'E'.repeat(20)), { put: () => ({ status: 400 }) });
  let fatalCode = '';
  try { await store.r2Upload({ api: P4.api, job: 'j' + 'E'.repeat(20), blob: new Blob([Buffer.alloc(100)]), size: 100 }, { put: P4.put, sleep: async () => {} }); } catch (e) { fatalCode = e.code; }
  ok(fatalCode === 'r2_http_400', 'שגיאה סופית מ־R2 — עוצרים מיד');

  /* ---------- 6. החלפת תוכן (איכויות הצפייה), הורדה, בדיקת קובץ ומחיקה ---------- */
  R2._reset();
  const small = Buffer.from('packed video');
  const rp = await SR.upStart(c, S3.deps, { uid: UID, folder: F1, id: v1, size: small.length, type: 'video/mp4', rec: P1.recs.get(v1), by: 'worker', replace: true });
  ok(rp.res.ok && rp.res.id === v1 && rp.res.up, 'העובד מחליף את תוכן הסרטון (אותו מזהה)');
  await S3.fetch(rp.res.urls[1], { method: 'PUT', body: small });
  const rd = await SR.upDone(c, S3.deps, { id: v1, rec: rp.rec, up: rp.res.up, uid: UID });
  ok(rd.res.ok && Buffer.compare(S3.objs.get(SR.keyOf(UID, v1)), small) === 0, 'אחרי ההחלפה — התוכן החדש, אותו מזהה');
  const fi = await SR.fileIn(c, S3.deps, { uid: UID, folder: F1, id: v1, rec: rd.rec });
  ok(fi && fi.size === small.length && fi.name === 'הרצאה.mp4', 'בדיקת קובץ: קיים, בגודל ובשם (כמו driveFileInFolder)');
  ok(!(await SR.fileIn(c, S3.deps, { uid: 'Other12345', folder: F1, id: v1 })), 'אותו מזהה דרך משתמש אחר — לא נמצא');
  ok(!(await SR.fileIn(c, S3.deps, { uid: UID, folder: F2, id: v1 })), 'קובץ שלא בתיקייה — לא נמצא');
  const g = await SR.getUrl(c, S3.deps, { uid: UID, folder: F1, id: v1, by: 'worker' });
  const gr = await S3.fetch(g.url);
  ok(g.ok && g.size === small.length && gr.status === 200 && Buffer.compare(Buffer.from(await gr.arrayBuffer()), small) === 0, 'קישור הורדה לעובד עובד');
  S3.now += 7 * 3600e3;
  ok((await S3.fetch(g.url)).status === 403, 'קישור ההורדה פג אחרי 6 שעות');
  const gp = await SR.getUrl(c, S3.deps, { uid: UID, folder: F1, id: v1, by: 'phone', name: 'הרצאה.mp4' });
  ok(/response-content-disposition=attachment/.test(gp.url) && /X-Amz-Expires=3600/.test(gp.url), 'קישור לטלפון: שעה, עם שם להורדה');
  ok((await SR.getUrl(c, S3.deps, { uid: UID, folder: F1, id: SR.newId(F1), by: 'worker' })).error === 'not_found', 'קובץ שלא קיים — אין קישור');
  ok(await SR.delFile(c, S3.deps, { uid: UID, folder: F1, id: v1 }) && !S3.objs.has(SR.keyOf(UID, v1)), 'מחיקת קובץ');
  const big = await SR.upStart(c, S3.deps, { uid: UID, folder: F1, size: 100, by: 'worker' });
  await S3.fetch(big.res.urls[1], { method: 'PUT', body: Buffer.alloc(100) });
  await SR.upDone(c, S3.deps, { id: big.res.id, rec: big.rec, up: big.res.up, uid: UID });
  const open = await SR.upStart(c, S3.deps, { uid: UID, folder: F1, size: 100, by: 'worker' });
  const removed = await SR.purgeFolder(c, S3.deps, { uid: UID, folder: F1, recs: [open.rec] });
  ok(removed === 1 && ![...S3.objs.keys()].some((k) => k.includes(F1)) && ![...S3.ups.values()].some((u) => u.key.includes(F1)), 'מחיקת תיקייה: כל הקבצים + העלאות פתוחות');
  ok(await SR.purgeFolder(c, S3.deps, { uid: '..', folder: F1 }) === 0, 'מחיקה עם uid לא תקין — כלום');

  /* ---------- 8. studionet בטלפון: כל פונקציה בוחרת R2 לפי המזהה ---------- */
  {
    Object.assign(process.env, ENV); R2._reset();
    const net0 = await import(path.join(root, 'studionet.js'));
    const SN = fakeR2();
    const FN = SR.folderFor('j' + 'N'.repeat(20));
    const recs = new Map();
    const driveGot = [];
    const fetch = async (url, init = {}) => {
      if (url === 'https://proxy.test/api/studio') {
        const b = JSON.parse(init.body);
        const id = b.id || '', rec = id ? recs.get(id) : null;
        if (b.op === 'drive') return new Response(JSON.stringify({ ok: true, token: 'DT', exp: Date.now() + 3600e3 }));
        if (b.job !== 'j' + 'N'.repeat(20)) return new Response(JSON.stringify({ ok: false, error: 'no_job' }));
        let out;
        if (b.op === 'r2up') out = await SR.upStart(c, SN.deps, { uid: UID, folder: FN, id, size: b.size, type: b.type, name: b.name, rec, by: 'phone' });
        else if (b.op === 'r2parts') out = await SR.upParts(c, SN.deps, { id, rec, up: b.up, uid: UID });
        else if (b.op === 'r2done') out = await SR.upDone(c, SN.deps, { id, rec, up: b.up, uid: UID });
        else if (b.op === 'r2url') return new Response(JSON.stringify(await SR.getUrl(c, SN.deps, { uid: UID, folder: FN, id, by: 'phone' })));
        if (out.rec) recs.set(out.res.id || id, out.rec);
        return new Response(JSON.stringify(out.res));
      }
      if (url.startsWith('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable')) {
        driveGot.push(JSON.parse(init.body));
        return new Response('{}', { status: 200, headers: { Location: 'https://www.googleapis.com/upload/drive/v3/files?upload_id=X' } });
      }
      return SN.fetch(url, init);
    };
    const drivePut = [];
    const put = async (url, body, hd, onP) => {
      if (url.startsWith('https://www.googleapis.com/upload/')) {
        drivePut.push({ range: hd['Content-Range'], size: body.size, data: Buffer.from(await body.arrayBuffer()) });
        const last = /\/(\d+)$/.exec(hd['Content-Range']), end = /-(\d+)\//.exec(hd['Content-Range']);
        return Number(end[1]) + 1 === Number(last[1]) ? { status: 200, json: { id: 'DRIVEOUT1' } } : { status: 308 };
      }
      const r = await SN.fetch(url, { method: 'PUT', body });
      if (onP) onP(body.size);
      return { status: r.status };
    };
    const net = net0.createNet({ fetch, put, base: () => 'https://proxy.test', idToken: async () => 'tok', sleep: async () => {}, online: () => true });
    const vid = crypto.randomBytes(12 * MiB + 5);
    let st = null;
    const fv = await net.upload({ blob: new Blob([vid]), size: vid.length, mime: 'video/mp4', meta: { name: 'lecture.mp4', parents: [FN] }, onR2: (x) => { st = x; } });
    ok(SR.inFolder(fv.id, FN) && fv.size === vid.length && st && st.id === fv.id && Buffer.compare(SN.objs.get(SR.keyOf(UID, fv.id)), vid) === 0, 'net.upload לתיקייה של R2 — עולה ל־R2 (ולא ל־Drive), מחזיר קובץ כמו של Drive');
    const tid = await net.textUpload(FN, 'cues.json', 'application/json', '{"a":"שלום"}');
    ok(SR.inFolder(tid, FN) && (await net.driveText(tid)) === '{"a":"שלום"}', 'textUpload / driveText — קובץ טקסט ב־R2 (העורכים, בקשות AI)');
    ok((await net.driveJson(tid)).a === 'שלום', 'driveJson מ־R2');
    const res2 = await net.r2ToDrive(fv.id, 'DriveFolderABC', 'lecture — same.mp4');
    const got = Buffer.concat(drivePut.map((x) => x.data));
    ok(res2.id === 'DRIVEOUT1' && Buffer.compare(got, vid) === 0 && driveGot[0].parents[0] === 'DriveFolderABC', 'ייצוא מ־R2 לתיקייה שבחרת ב־Drive — זורם בחתיכות, הקובץ שלם');
    ok(drivePut.slice(0, -1).every((x) => x.size % (256 * 1024) === 0), 'חתיכות לדרייב בכפולות של 256KB (חוץ מהאחרונה)');
    let bad = '';
    try { await net.driveText(SR.newId(SR.folderFor('j' + 'O'.repeat(20)))); } catch (e) { bad = e.code; }
    ok(bad === 'no_job', 'קובץ של עבודה אחרת — שגיאה, לא תוכן');
  }

  /* ---------- 7. בדיקת החיבור מהשרתון (GET ?r2=1) — רק כן/לא וקוד ---------- */
  Object.assign(process.env, ENV);
  const api = require(path.join(root, 'ibkr-proxy/api/studio.js'));
  const call = async (q, S) => { const out = {}; const res = { setHeader() {}, status(c) { out.c = c; return res; }, json(j) { out.j = j; return res; } };
    await api._handler({ method: 'GET', query: q, headers: {} }, res, { fetch: S.fetch, now: S.now }); return out; };
  R2._reset(); api._reset();
  const SH = fakeR2();
  let hr = await call({ r2: '1' }, SH);
  ok(hr.c === 200 && hr.j.r2.ok && hr.j.r2.eu && hr.j.r2.cors === true && !hr.j.r2.error, 'השרתון: R2 מחובר, באירופה, CORS תקין');
  ok(!JSON.stringify(hr.j).includes('sekret') && !JSON.stringify(hr.j).includes(ACC), 'בתשובה אין מפתח ואין Account ID');
  R2._reset();
  hr = await call({ r2: '1' }, fakeR2({ cors: false }));
  ok(hr.j.r2.ok === false && hr.j.r2.error === 'r2_cors', 'השרתון: CORS חסר — קוד ברור');
  R2._reset();
  await call({ r2: '1' }, SH);
  ok((await call({ r2: '1' }, SH)).c === 429, 'בדיקת החיבור מוגבלת ל־3 בדקה');
  for (const k of Object.keys(ENV)) delete process.env[k];
  R2._reset(); api._reset();
  hr = await call({ r2: '1' }, SH);
  ok(hr.j.r2.ok === false && hr.j.r2.error === 'not_configured', 'בלי משתנים — not_configured');

  console.log('\n' + n + ' בדיקות עברו');
})().catch((e) => { console.error('FAIL -', e); process.exit(1); });
