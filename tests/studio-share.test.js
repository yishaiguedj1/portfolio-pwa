// שיתוף תוצאה בקישור (11/11/2026, בקשת המשתמש: "לשתף את התוצאה עם חבר — רק צפייה והורדה, בלי עריכה").
// 1. הכללים הטהורים (ibkr-proxy/lib/studioshare.js). 2. מסלול מלא מול השרתון האמיתי (api/studio.js) עם Firestore ו־R2 מדומים:
//    יצירה, אותו קישור שוב, צפייה בלי התחברות, הורדה עם שם, רק התוצרים של העבודה, משתמש אחר, טוקן שגוי / פג / בוטל, מקור זר,
//    מגביל קצב. 3. הדף (share.html / share.js): CSP, בלי סקריפט מוטבע, noindex/no-referrer, רק פעולות קריאה, שמות התוצרים כמו
//    בטלפון, הנגן, מצב "קריאה בלבד" בדף הניתוח. 4. הטלפון: הכפתור, הדף והכתובת.
// הרצה: node tests/studio-share.test.js
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const { fakeR2, ENV } = require('./_r2fake');

(async () => {
  /* ---------- 1. הכללים הטהורים ---------- */
  const SH = require(path.join(root, 'ibkr-proxy/lib/studioshare.js'));
  const NOW = Date.UTC(2026, 10, 11, 12);
  const JID = 'j' + 'A'.repeat(20), JID2 = 'j' + 'B'.repeat(20);
  const KEY = crypto.randomBytes(32), KEY2 = crypto.randomBytes(32);
  const sec = SH.newSecret(JID, KEY);
  ok(/^[A-Za-z0-9_-]{43}$/.test(sec) && sec !== SH.newSecret(JID, KEY), 'סוד: 43 תווים (32 בתים — 128 ביט אקראיים + תג), אקראי');
  ok(SH.secSigned(JID, sec, KEY) && !SH.secSigned(JID2, sec, KEY) && !SH.secSigned(JID, sec, KEY2) && !SH.secSigned(JID, sec, null), 'תג HMAC: תקף רק לעבודה שלו ובמפתח שלנו');
  const flip = (x, i) => x.slice(0, i) + (x[i] === 'A' ? 'B' : 'A') + x.slice(i + 1);
  ok([0, 10, 21, 30, 42].every((i) => !SH.secSigned(JID, flip(sec, i), KEY)) && !SH.secSigned(JID, crypto.randomBytes(32).toString('base64url'), KEY), 'שינוי של תו אחד / סוד אקראי — נדחה בלי מסד');
  const nc = sec.slice(0, 42) + 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'[('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'.indexOf(sec[42]) ^ 1)];
  ok(!SH.secSigned(JID, nc, KEY), 'קידוד לא קנוני של אותם בתים — נדחה');
  let thr = false; try { SH.newSecret(JID, null); } catch (e) { thr = true; }
  ok(thr, 'בלי מפתח — אין סוד (אין קישור בלי הכספת)');
  const tk = SH.tokenOf(JID, sec);
  ok(tk === JID + '.' + sec && SH.parseToken(tk).id === JID && SH.parseToken(tk).sec === sec, 'טוקן = <עבודה>.<סוד>, ומתפרק בחזרה');
  ok(!SH.parseToken(JID) && !SH.parseToken(tk + 'x') && !SH.parseToken('../' + tk) && !SH.parseToken(null) && !SH.tokenOf('x', sec), 'טוקן פגום — נדחה');
  const job0 = { lnh: SH.secHash(sec), lnx: NOW + 1000 };
  ok(SH.shareOk(job0, sec, NOW) && !SH.shareOk(job0, SH.newSecret(JID, KEY), NOW), 'הסוד נבדק מול ה־hash');
  ok(!SH.shareOk(job0, sec, NOW + 1000) && !SH.shareOk({ lnh: '', lnx: NOW + 1000 }, sec, NOW) && !SH.shareOk(null, sec, NOW), 'פג / בוטל — לא עובר');
  ok(SH.shareActive(job0, NOW) && !SH.shareActive({ lnh: job0.lnh, lnx: 0 }, NOW), 'shareActive');
  const r2f = (f) => /^R2_j/.test(String(f || ''));
  const FOLD = 'R2_' + JID;
  const done = { kind: 'tr', folder: FOLD, spec: { name: 'x.mp4' }, fo: [{ k: 'srt', id: FOLD + '_aaaaaaaaaaaa', size: 3, name: 'x.he.srt' }] };
  ok(SH.shareErr(done, 'done', r2f) === '' && SH.shareErr(Object.assign({}, done, { rdy: 1 }), 'running', r2f) === '', 'עבודה שהסתיימה (או שהתוצרים כבר אצלך) — אפשר לשתף');
  ok(SH.shareErr(done, 'running', r2f) === 'state' && SH.shareErr(done, 'failed', r2f) === 'state', 'עבודה שלא הסתיימה — לא');
  ok(['dry', 'vo', 'vp', 'vj'].every((k) => SH.shareErr(Object.assign({}, done, { spec: { [k]: k === 'dry' ? true : 1 } }), 'done', r2f) === 'state'), 'הרצה יבשה ועבודות פנימיות של הניתוח (אימות, טיוטה, שופט) — לא');
  ok(SH.shareErr(Object.assign({}, done, { folder: 'driveFolderId123' }), 'done', r2f) === 'not_r2', 'קבצים ב־Drive — not_r2');
  ok(SH.shareErr(Object.assign({}, done, { fo: [{ k: 'cues', id: FOLD + '_bbbbbbbbbbbb' }] }), 'done', r2f) === 'no_out', 'בלי תוצר שמוצג בדף — no_out');
  ok(SH.shareErr({ kind: 'dx', folder: FOLD, fo: done.fo }, 'done', r2f) === 'state', 'רק עבודות תרגום/ניתוח/קריוקי');
  const inF = (id, f) => String(id).startsWith(f + '_');
  const outs = SH.outsOf({ folder: FOLD, fo: [{ k: 'srt', id: FOLD + '_a', size: 9.7, name: 'a.he.srt' }, { k: 'cues', id: FOLD + '_b' }, { k: 'compact', id: 'R2_jOTHER_c', name: 'v.MP4' }, { k: 'vi', id: FOLD + '_d', name: 'vi.json' }] }, inF);
  ok(outs.length === 2 && outs[0].k === 'srt' && outs[0].size === 9 && outs[0].x === 'srt' && outs[1].x === 'json' && !('name' in outs[0]), 'התוצרים: רק מה שבדף התוצאה, רק בתיקייה של העבודה, בלי שם הקובץ — רק הסיומת');
  ok(SH.shareExp({ j: NOW + 5 * 864e5 }, NOW, 30) === NOW + 5 * 864e5 && SH.shareExp(null, NOW, 30) === NOW + SH.SH_MAX && SH.shareExp({ j: NOW + 90 * 864e5 }, NOW, 30) === NOW + SH.SH_MAX, 'תוקף: עד שהקבצים נמחקים, ולא יותר מ־30 יום');
  ok(SH.shareExp(null, NOW) === NOW + 7 * 864e5 && SH.shareExp(null, NOW, 1) === NOW + 864e5 && SH.shareExp(null, NOW, 365) === NOW + 7 * 864e5 && SH.shareExp({ j: NOW + 3 * 864e5 }, NOW, 7) === NOW + 3 * 864e5, 'תוקף לפי הבחירה (יום/שבוע/חודש), ברירת המחדל שבוע; ערך אחר — שבוע');
  const meta = SH.shareMeta({ uid: 'u1', spec: { name: 'a\u0007b.mp4', vi: 1, from: 'en', to: ['he', '<x>'], dur: 61.4, email: 'x@y' }, ended: NOW, lnx: NOW + 9, use: [{ c: 1 }] }, NOW);
  ok(meta.n === 'a b.mp4' && meta.k === 'vi' && meta.to.join() === 'he' && meta.dur === 61 && meta.exp === NOW + 9 && Object.keys(meta).sort().join() === 'at,dur,exp,from,k,n,to', 'מה הצופה מקבל: שם, סוג, שפות, אורך, תאריכים — בלי מזהה, מייל, עלות');
  ok(SH.srcOf({ folder: FOLD, fv: { id: FOLD + '_v' } }, inF) === FOLD + '_v' && !SH.srcOf({ folder: FOLD, fv: { id: FOLD + '_v' }, sx: 5 }, inF) && !SH.srcOf({ folder: FOLD, fv: { id: FOLD + '_v', ext: true } }, inF), 'סרטון המקור לנגן — רק כשהוא עוד ב־R2 של העבודה');
  ok(SH.dlName('a\r\nb/c:"d"') === 'a b c d' && SH.dlName('x'.repeat(300)).length === 120, 'שם ההורדה מנוקה');
  ok(SH.dlName('a\u202egpj.exe') === 'a gpj.exe' && SH.dlName('a\u200f\u2066b') === 'a b' && !/[\u202a-\u202e]/.test(SH.shareMeta({ spec: { name: 'x\u202eyz' } }, NOW).n), 'בלי תווי כיווניות שמסווים סיומת');
  ok(SH.dlFile('הרצאה ראשונה.he.srt', { k: 'srt', x: 'srt' }) === 'הרצאה ראשונה.he.srt' && SH.dlFile('invoice.exe', { k: 'srt', x: 'srt' }) === 'invoice.srt'
    && SH.dlFile('a.html', { k: 'compact', x: 'mp4' }) === 'a.mp4' && SH.dlFile('', { k: 'vi', x: '' }) === 'vi.json' && SH.dlFile('...', { k: 'mkv' }) === 'mkv.mkv', 'הסיומת בהורדה — של הקובץ האמיתי, לא מהדף');

  /* ---------- 2. מסלול מלא מול השרתון ---------- */
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
  const studio = require(path.join(root, 'ibkr-proxy/api/studio.js'));
  gauth._reset(); studio._reset(); R2._reset();
  const keys = { k1: fb.publicKey.export({ type: 'spki', format: 'pem' }) };
  const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const tnow = Math.floor(Date.now() / 1000);
  const idt = (sub, email) => {
    const hd = b64u({ alg: 'RS256', kid: 'k1' }), bd = b64u({ aud: 'yishaiguedj1-c786e', iss: 'https://securetoken.google.com/yishaiguedj1-c786e', sub, iat: tnow - 5, exp: tnow + 3000, email, email_verified: true });
    return hd + '.' + bd + '.' + crypto.sign('RSA-SHA256', Buffer.from(hd + '.' + bd), fb.privateKey).toString('base64url');
  };
  const OWNER = idt('ownerUid0001', 'owner@example.com'), OTHER = idt('otherUid0002', 'other@example.com');
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
    if ((opt.method || 'GET') === 'GET') { reads++; return cur ? J({ fields: cur.fields, updateTime: cur.ut }) : J({}, 404); }
    if (opt.method === 'DELETE') { db.delete(k); return J({}); }
    if (opt.method === 'PATCH') {
      const qp = new URLSearchParams(m[3] || '');
      const mask = qp.getAll('updateMask.fieldPaths');
      const body = JSON.parse(opt.body).fields;
      db.set(k, { fields: mask.length ? Object.assign({}, cur ? cur.fields : {}, ...mask.map((f) => ({ [f]: body[f] }))) : body, ut: 't' + (++utSeq) });
      return J({});
    }
    return J({}, 400);
  };
  let reads = 0, ip = 0;
  const deps = () => ({ verify: { keys }, fetch: fetchAll, now: R.now });
  const call = async (body, origin = 'https://yishaiguedj1.github.io') => {
    const res = { code: 0, j: null, setHeader() {}, status(c) { res.code = c; return res; }, json(o) { res.j = o; return res; }, end() { return res; } };
    const req = { method: 'POST', query: {}, body, headers: { origin, 'x-forwarded-for': '10.0.0.' + (ip % 250) }, socket: { remoteAddress: '9.9.9.9' } };
    await studio._handler(req, res, deps());
    return res;
  };
  const phone = (who) => (op, b) => call(Object.assign({}, b, { op, idToken: who })).then((r) => r.j);
  const api = phone(OWNER), other = phone(OTHER);
  const view = (t, o) => call(Object.assign({ op: 'shareView', t }, o || {}));

  const spec = { name: 'הרצאה_ראשונה.mp4', size: 1000, type: 'video/mp4', dur: 600, from: 'en', to: ['he'], mode: 'haiku-high', out: ['compact'], eng: 'api', cap: 5 };
  let j = await api('create', { spec });
  ok(j.ok && SR.isFolder(j.job.folder), 'עבודה במצב שרת (תיקייה ב־R2)');
  const JOB = j.job.id, FOLDER = j.job.folder;
  const id = (s) => FOLDER + '_' + s.padEnd(12, 'x').slice(0, 12);
  const F = { v: id('vid'), srt: id('srt'), cues: id('cues'), comp: id('comp'), thumb: id('thumb'), notes: id('notes') };
  const D = () => db.get('studioJobs/' + JOB).fields;   // המסמך הנוכחי (כתיבה חלקית יוצרת אובייקט חדש)
  const sv = (o) => ({ stringValue: JSON.stringify(o) });
  Object.assign(D(), { state: { stringValue: 'running' }, fv: sv({ id: F.v, name: 'v.mp4', size: 1000, mime: 'video/mp4' }),
    fo: sv([{ k: 'srt', id: F.srt, name: 'x.he.srt', size: 40 }, { k: 'cues', id: F.cues, name: 'cues.json', size: 30 }, { k: 'compact', id: F.comp, name: 'x.mp4', size: 900 },
      { k: 'thumb', id: F.thumb, name: 't.jpg', size: 5 }, { k: 'notes', id: F.notes, name: 'n.json', size: 5 }]) });
  ok((await api('shareMake', { job: JOB })).error === 'state', 'עבודה שרצה — אין עדיין מה לשתף (state)');
  Object.assign(D(), { state: { stringValue: 'done' }, ended: { integerValue: String(R.now) } });
  R.objs.set('st/ownerUid0001/' + F.srt, Buffer.from('1\n00:00:01,000 --> 00:00:02,000\nשלום\n'));

  j = await api('shareMake', { job: JOB });
  const T1 = j.t;
  ok(j.ok && /^j[A-Za-z0-9_-]{20}\.[A-Za-z0-9_-]{43}$/.test(T1) && T1.startsWith(JOB + '.') && j.exp === R.now + 7 * 864e5 && j.d === 7 && j.job.ln.d === 7, 'הבעלים יוצר קישור — טוקן, ותוקף של שבוע כברירת מחדל');
  ok(j.job.ln && j.job.ln.x === j.exp && !JSON.stringify(j.job).includes(T1.split('.')[1]), 'בעבודה: רק שהקישור פעיל ועד מתי (הסוד לא בתצוגה)');
  const raw = JSON.stringify(db.get('studioJobs/' + JOB).fields);
  ok(!raw.includes(T1.split('.')[1]) && D().lnh.stringValue === crypto.createHash('sha256').update(T1.split('.')[1]).digest('hex') && D().lne.stringValue.length > 40, 'במסד: hash והסוד מוצפן בכספת — אף פעם לא גלוי');
  ok((await api('shareMake', { job: JOB })).t === T1, 'שוב — אותו קישור (לא מבטל קישור ששלחת)');
  j = await api('shareMake', { job: JOB, d: 1 });
  ok(j.t === T1 && j.d === 1 && j.exp === R.now + 864e5 && D().lnd.integerValue === '1', 'שינוי התוקף ליום — אותו קישור, תוקף חדש');
  ok((await api('shareMake', { job: JOB, d: 365 })).error === 'bad_params' && (await api('shareMake', { job: JOB, d: '7' })).error === 'bad_params', 'תוקף שלא ברשימה — נדחה');
  j = await api('shareMake', { job: JOB, d: 30 });
  ok(j.t === T1 && j.d === 30 && j.exp > R.now + 7 * 864e5 && j.exp <= R.now + 30 * 864e5, 'וחזרה לחודש (לא אחרי שהקבצים נמחקים)');
  ok((await other('shareMake', { job: JOB })).error === 'no_job' && (await other('shareOff', { job: JOB })).error === 'no_job', 'משתמש אחר — לא יוצר ולא מבטל');

  let r = await view(T1);
  ok(r.code === 200 && r.j.ok && r.j.v.n === spec.name && r.j.v.k === 'tr' && r.j.v.to.join() === 'he' && r.j.v.exp === j.exp, 'צפייה בלי התחברות — השם, הסוג והתוקף');
  ok(r.j.outs.map((o) => o.k).join() === 'srt,compact', 'רק התוצרים שבדף התוצאה (בלי קבצי עזר והערות)');
  const body = JSON.stringify(r.j);
  ok(!/owner@|"uid"|idToken|"use"|"spec"|"lnh"|"lne"/.test(body), 'בלי מייל, uid, עלות, spec או שדות הקישור בתשובה');
  ok(!body.replace(/https:\/\/[^"]+/g, '').includes('ownerUid0001') && body.includes('/st/ownerUid0001/'), 'ה־uid רק בתוך הנתיב של הקישורים החתומים ל־R2 (מזהה פנימי, לא הרשאה) — בשום שדה אחר');
  ok([r.j.play.src, r.j.play.fb, r.j.cues, r.j.srt, r.j.thumb].every((u) => u.includes('.r2.cloudflarestorage.com/') && u.includes('X-Amz-Expires=900')) && r.j.vi === '' && r.j.vis === '', 'קישורים חתומים ל־15 דקות — המקור, הצרוב, הכתוביות, התמונה; בלי ניתוח');
  const ctOf = (u) => new URL(u).searchParams.get('response-content-type');
  ok(r.j.ux - r.j.now === 900e3 && ctOf(r.j.play.src) === 'video/mp4' && ctOf(r.j.play.fb) === 'video/mp4' && ctOf(r.j.cues) === 'application/json' && ctOf(r.j.srt) === 'text/plain; charset=utf-8'
    && ctOf(r.j.thumb) === 'image/jpeg' && ![r.j.play.src, r.j.srt].some((u) => u.includes('response-content-disposition')), 'כל קישור חתום קובע סוג תוכן (R2 לא יגיש HTML גם אם הקובץ הוחלף); לצפייה — בלי attachment');
  ok(SH.srcType({ fv: { mime: 'video/webm' } }) === 'video/webm' && SH.srcType({ fv: { mime: 'text/html' } }) === 'video/mp4' && SH.srcType({}) === 'video/mp4', 'סוג המקור — רק video/*');
  ok((await R.fetch(r.j.srt)).status === 200, 'הקישור החתום עובד מול R2');
  const g = await call({ op: 'shareGet', t: T1, id: F.srt, name: 'הרצאה ראשונה.he.srt' });
  const gq = new URL(g.j.url).searchParams;
  ok(g.code === 200 && gq.get('response-content-disposition') === 'attachment; filename="_____ ______.he.srt"; filename*=UTF-8\'\'' + encodeURIComponent('הרצאה ראשונה.he.srt') && (await R.fetch(g.j.url)).status === 200, 'הורדה — קישור טרי עם שם הקובץ (RFC 6266: ASCII + UTF-8)');
  ok(gq.get('response-content-type') === 'application/octet-stream', 'הורדה — סוג תוכן גנרי (הדפדפן שומר, לא מציג או מריץ)');
  const g2 = await call({ op: 'shareGet', t: T1, id: F.comp, name: 'evil".html\r\nX: y' });
  const cd2 = new URL(g2.j.url).searchParams.get('response-content-disposition');
  ok(cd2 === 'attachment; filename="evil .html X y.mp4"; filename*=UTF-8\'\'evil%20.html%20X%20y.mp4', 'שם עם מרכאות/שורה חדשה/סיומת אחרת — מנוקה, והסיומת של הקובץ (' + cd2 + ')');
  ok((await call({ op: 'shareGet', t: T1, id: F.v })).j.error === 'bad_id' && (await call({ op: 'shareGet', t: T1, id: F.notes })).j.error === 'bad_id', 'הורדה רק של תוצר שבדף — לא המקור ולא קבצי עזר');
  const vault = require(path.join(root, 'ibkr-proxy/lib/vault.js'));
  const SKEY = vault.derive('studio-share/v1').key;
  const wrong = JOB + '.' + crypto.randomBytes(32).toString('base64url');
  const r0 = reads;
  ok((await view(wrong)).code === 404 && (await view(wrong)).j.error === 'gone' && (await view('x')).j.error === 'gone' && (await view('j' + 'Z'.repeat(20) + '.' + crypto.randomBytes(32).toString('base64url'))).j.error === 'gone', 'סוד שגוי / טוקן פגום / עבודה שלא קיימת — אותה תשובה (gone)');
  ok((await call({ op: 'shareGet', t: wrong, id: F.srt })).j.error === 'gone', 'הורדה עם סוד שגוי — gone');
  ok(reads === r0, 'טוקן מזויף — נדחה בלי אף קריאה מ־Firestore (בלי שריפת מכסה)');
  const ZJ = 'j' + 'Z'.repeat(20);
  ok((await view(ZJ + '.' + SH.newSecret(ZJ, SKEY))).j.error === 'gone' && reads === r0 + 1, 'טוקן חתום לעבודה שלא קיימת — קריאה אחת, ואותה תשובה');
  ok((await view(JOB + '.' + SH.newSecret(JOB, SKEY))).j.error === 'gone', 'טוקן חתום אבל לא הסוד של הקישור הפעיל — gone');
  ok((await view(T1.replace(JOB, 'j' + 'Y'.repeat(20)))).j.error === 'gone', 'הסוד של עבודה אחת לא פותח עבודה אחרת');
  // חסימה אחרי ניסיונות כושלים
  studio._shBadClear(); studio._hitsClear(); ip = 101;
  for (let i = 0; i < 19; i++) await view(JOB + '.' + crypto.randomBytes(32).toString('base64url'));
  ok((await view(T1)).code === 200, '19 טוקנים שגויים — עדיין לא חסום (משתמשים מאחורי אותה כתובת של ספק)');
  await view(JOB + '.' + crypto.randomBytes(32).toString('base64url'));
  r = await view(T1);
  ok(r.code === 429 && r.j.error === 'rate_limited', '20 טוקנים שגויים מאותו IP — חסום (גם עם טוקן נכון) עד סוף החלון');
  ip = 102;
  ok((await view(T1)).code === 200, 'IP אחר — לא מושפע');
  R.now += 10 * 60e3 + 1; ip = 101; studio._hitsClear();
  ok((await view(T1)).code === 200, 'אחרי 10 דקות — החסימה נגמרת');
  studio._shBadClear(); ip = 0;
  // תקרה כללית לקריאות Firestore (טוקנים חתומים לעבודות שונות — כל אחד קריאה)
  studio._reset();
  const busy = [];
  for (let i = 0; i < 121; i++) { ip = 130 + (i % 100); const zj = 'j' + String(i).padStart(3, '0') + 'Q'.repeat(17); busy.push((await view(zj + '.' + SH.newSecret(zj, SKEY))).j.error); }
  ok(busy.slice(0, 120).every((e) => e === 'gone') && busy[120] === 'busy', 'יותר מ־120 קריאות מסד בדקה למופע — עוצר (503 busy), המכסה מוגנת');
  studio._reset(); ip = 0;
  ok(studio._ipKey('2001:db8:1:2:3:4:5:6') === studio._ipKey('2001:db8:1:2::9') && studio._ipKey('2001:db8:1:2::9') === '2001:db8:1:2::/64' && studio._ipKey('2001:db8:1:3::1') !== studio._ipKey('2001:db8:1:2::1')
    && studio._ipKey('::ffff:10.1.2.3') === '10.1.2.3' && studio._ipKey('10.1.2.3') === '10.1.2.3' && studio._ipKey('::1') === '0:0:0:0::/64', 'IPv6 — לפי ‎/64 (אי אפשר לעקוף בהחלפת כתובת בתוך הרשת)');
  ok((await view(T1, {}).then(() => call({ op: 'shareView', t: T1 }, 'https://evil.example'))).code === 403, 'מקור זר — נחסם (CORS / guard)');
  const before = reads;
  for (let i = 0; i < 3; i++) await view(T1);
  ok(reads === before, 'רענון — העבודה מהזיכרון (בלי קריאות Firestore)');

  // ביטול
  j = await api('shareOff', { job: JOB });
  ok(j.ok && !j.job.ln && D().lnh.stringValue === '' && D().lne.stringValue === '', 'ביטול — השדות נמחקים');
  ok((await view(T1)).j.error === 'gone' && (await call({ op: 'shareGet', t: T1, id: F.srt })).j.error === 'gone', 'אחרי ביטול — הקישור לא עובד מיד (גם במטמון)');
  const T2 = (await api('shareMake', { job: JOB })).t;
  ok(T2 && T2 !== T1 && (await view(T2)).j.ok && (await view(T1)).j.error === 'gone', 'קישור חדש — סוד חדש; הישן לא חוזר');
  // תוקף
  D().lnx = { integerValue: String(R.now - 1) };
  studio._reset();
  ok((await view(T2)).j.error === 'gone', 'קישור שפג — gone');
  ok((await api('shareMake', { job: JOB })).t !== T2, 'אחרי שפג — יצירה נותנת קישור חדש');
  // ניתוח
  const T3 = (await api('shareMake', { job: JOB })).t;
  Object.assign(D(), { spec: sv(Object.assign({}, spec, { vi: 1, out: [] })), fo: sv([{ k: 'vi', id: id('vi'), name: 'vi.json', size: 50 }, { k: 'vis', id: id('vis'), name: 'vis.bin', size: 90 }, { k: 'cues', id: F.cues, name: 'c.json', size: 3 }]) });
  studio._reset();
  r = await view(T3);
  ok(r.j.ok && r.j.v.k === 'vi' && r.j.vi.includes(id('vi')) && r.j.vis.includes(id('vis')) && r.j.outs.map((o) => o.k).join() === 'vi' && r.j.play.src && !r.j.play.fb, 'ניתוח: vi.json, השקפים והמקור לנגן; להורדה — קובץ הניתוח');
  // מגביל קצב
  studio._hitsClear(); ip = 7;
  const codes = [];
  studio._shBadClear();
  for (let i = 0; i < 42; i++) codes.push((await view(T3)).code);
  ok(codes.slice(0, 40).every((c) => c === 200) && codes[41] === 429, 'מגביל קצב לכל IP (40 בדקה)');
  studio._hitsClear();
  ok((await view(T3)).code === 429, 'איפוס המגבילים של שאר השרתון (הצפה במפה המשותפת) — לא משחרר את מגביל השיתוף');
  studio._shBadClear();
  studio._hitsClear();
  // מחיקת העבודה = הקישור מת
  db.delete('studioJobs/' + JOB); studio._reset();
  ok((await view(T3)).j.error === 'gone', 'עבודה שנמחקה — gone');

  /* ---------- 3. הדף ---------- */
  const html = read('share.html');
  const csp = (html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/) || [])[1] || '';
  const pol = {}; for (const p of csp.split(';')) { const [k, ...v] = p.trim().split(/\s+/); if (k) pol[k] = v; }
  ok(pol['default-src'].join() === "'none'" && pol['script-src'].join() === "'self'" && pol['object-src'].join() === "'none'" && pol['base-uri'].join() === "'none'", 'CSP: ברירת מחדל none, סקריפטים רק מהאתר (בלי inline/eval)');
  ok(pol['connect-src'].join(' ') === "'self' https://*.r2.cloudflarestorage.com https://ibkr-proxy-wine.vercel.app https://api.thesnowball.app https://api-staging.thesnowball.app" && pol['media-src'].includes('https://*.r2.cloudflarestorage.com'), 'CSP: השרתון (ייצור, ניסוי, גיבוי) ו־R2 לנגן');
  const fc = read('firebase-config.js');
  for (const u of [...fc.matchAll(/var (?:PROXY|PROD_API|STAGING_PROXY) = '([^']+)'/g)].map((m) => m[1])) ok(pol['connect-src'].some((s) => s === u || (s.startsWith('https://*.') && u.endsWith(s.slice(9)))), 'CSP מכסה את השרתון ' + u);
  ok(!/<script>/.test(html) && !/\son[a-z]+\s*=/.test(html), 'בלי סקריפט מוטבע ובלי on…= ב־HTML');
  ok(/<meta name="referrer" content="no-referrer">/.test(html) && /<meta name="robots" content="noindex, nofollow">/.test(html), 'no-referrer ו־noindex');
  ok(/data-app="share"/.test(html) && /src="strings-share\.js"/.test(html) && /src="firebase-config\.js"/.test(html) && /type="module" src="share\.js"/.test(html) && !/auth\.js|core\.js|firebase-app/.test(html), 'טוען רק: ההגדרות, המחרוזות ו־share.js (בלי Firebase ובלי core.js)');
  const sj = read('share.js');
  ok([...sj.matchAll(/op: '([A-Za-z]+)'/g)].map((m) => m[1]).every((o) => o === 'shareView' || o === 'shareGet'), 'share.js קורא רק ל־shareView / shareGet (אין פעולה שמשנה משהו)');
  ok([...sj.matchAll(/innerHTML\s*=\s*([^;]+);/g)].every((m) => m[1] === "TT ? TT.createHTML(ICON[k] || '') : (ICON[k] || '')") && /renderVi\(\{[^]*?ro: true/.test(sj), 'כל טקסט — textContent; הניתוח במצב קריאה בלבד (ro)');
  ok(pol['style-src'].join() === "'self'" && pol['require-trusted-types-for'].join() === "'script'" && pol['trusted-types'].join() === 'snb-share'
    && /createPolicy\('snb-share', \{ createHTML: \(x\) => \(ICON_SET\.has\(x\) \? x : ''\) \}\)/.test(sj), "CSP: בלי סגנון מוטבע, Trusted Types — רק האייקונים הקבועים נכנסים כ־HTML");
  for (const f of ['share.js', 'studioplay.js', 'studiovi.js']) ok(!/insertAdjacentHTML|outerHTML|document\.write|createContextualFragment|DOMParser|new Function|\beval\(|setAttribute\('style'|setAttribute\('on/.test(read(f)), f + ': בלי הזרקת HTML/קוד/סגנון מוטבע');
  for (const f of ['studioplay.js', 'studiovi.js']) ok(!/\.innerHTML\s*=/.test(read(f)), f + ': בלי innerHTML (הנגן והניתוח בונים DOM בלבד)');
  const vi = read('studiovi.js');
  const vc = read('translator/vicheck.py');
  const normVi = /def norm_vi\(o\):([^]*?)\ndef /.exec(vc)[1];
  ok(normVi.includes("out = {'v': VI_V") && !/tok|usd|cost/.test(normVi) && /return vicheck\.norm_vi\(vi\)/.test(read('translator/analyze.py')), 'vi.json של ניתוח אמיתי עובר norm_vi (רשימה סגורה) — בלי עלות/טוקנים; ההרצה היבשה (עם tok) לא ניתנת לשיתוף');
  ok(/if \(!ctx\.ro\) body\.append\(btn\('st-linkb st-vi-miss'/.test(vi) && /if \(it && !ctx\.ro\) \{/.test(vi), 'studiovi: בלי "חסר משהו" ובלי "דווח על טעות" במצב קריאה בלבד');
  ok(SH.parseToken(T3) && new RegExp(/TOKEN_RE = \/(.*)\/;/.exec(sj)[1]).test(T3) && !new RegExp(/TOKEN_RE = \/(.*)\/;/.exec(sj)[1]).test(T3 + 'A'), 'אותה צורת טוקן בדף ובשרתון');
  const shIcons = /const ICON = \{([^]*?)\n\};/.exec(sj)[1];
  for (const m of new Set([...vi.matchAll(/ctx\.ico\('([a-z]+)'/g)].map((x) => x[1]))) ok(new RegExp('\\b' + m + ": '<").test(shIcons), 'האייקון ' + m + ' של renderVi קיים בדף (אחרת svg בלי גודל שובר את הפריסה)');
  const P = await import(path.join(root, 'share.js'));
  ok(P.tokenFrom('#' + T3) === T3 && P.tokenFrom('#' + encodeURIComponent(T3)) === T3 && P.tokenFrom('#x') === '' && P.tokenFrom('') === '', 'tokenFrom מה־#');
  ok(P.tokenFrom('#' + T3 + '&app=s1&upd=2&n=k3') === T3 && P.tokenFrom('#x&' + T3) === '', 'tokenFrom: פתיחה באפליקציה — המעטפת מוסיפה ‎&app=…&n=… ל־hash');
  ok(/html:is\(\[data-app="studio"\], \[data-app="share"\]\) \{\s*--primary: #FF4656/.test(read('styles.css')), 'דף הצפייה בצבע של הסטודיו (אדום), לא בירוק של Invest');
  ok(P.shareLang(['he-IL']) === 'he' && P.shareLang(['iw']) === 'he' && P.shareLang(['en-US', 'fr']) === 'en', 'שפת הדף לפי הדפדפן של הצופה');
  const st = read('studio.js');
  const outNameSrc = /function outName\(k\) \{([^]*?)\n\}/.exec(st)[1];
  for (const [k, key] of Object.entries(P.OUT_LABEL)) {
    const inPhone = k === 'srt' ? /default: return T\('studioOutSrt'\)/.test(outNameSrc) : k === 'en' ? /k === 'en' \? T\('studioOutEnShort'\)/.test(st) : k === 'same' ? /k === 'same' \? T\('studioOutSameShort'\)/.test(st) : new RegExp("case '" + k + "': return T\\('" + key + "'\\)").test(outNameSrc);
    ok(inPhone, 'שם התוצר ' + k + ' — אותו מפתח כמו בטלפון (' + key + ')');
  }
  ok(SH.SH_KINDS.join() === "compact,same,mkv,small,srt,en,inst,lrc,elrc,lyr,vi" && /export const OUT_MAIN = \['compact', 'same', 'mkv', 'small', 'srt', 'en', 'inst', 'lrc', 'elrc', 'lyr', 'vi'\]/.test(st), 'התוצרים בשיתוף = OUT_MAIN בטלפון');
  const v0 = { n: 'הרצאה_ראשונה.mp4', to: ['he'] };
  ok(P.dlName(v0, { k: 'srt' }) === 'הרצאה ראשונה.he.srt' && P.dlName(v0, { k: 'en' }) === 'הרצאה ראשונה.en.srt' && /\.mkv$/.test(P.dlName(v0, { k: 'mkv' })) && /\.json$/.test(P.dlName(v0, { k: 'vi', x: 'json' })) && /\.m4a$/.test(P.dlName(v0, { k: 'inst', x: 'm4a' })), 'שם ההורדה: כתוביות "שם.he.srt", השאר עם הסיומת האמיתית');
  ok(P.playPlan('tr', { src: 'S', fb: 'B' }, true).src === 'S' && P.playPlan('tr', { src: 'S', fb: 'B' }, false).burned && P.playPlan('ka', { src: 'S', fb: 'B' }, true).src === 'B' && P.playPlan('vi', { src: 'S', fb: '' }).src === 'S' && P.playPlan('tr', { src: '', fb: '' }, true) === null, 'הנגן: תרגום — המקור עם הכתוביות (כמו אצלך), אחרת הצרוב; קריוקי — הצרוב; ניתוח — המקור');
  const cg = require(path.join(root, 'tools/coregen.js'));
  ok(cg.APPS.share && cg.APPS.share.join() === 'share.js,studioplay.js,studiovi.js' && fs.existsSync(path.join(root, 'strings-share.js')), 'coregen: strings-share.js (רק מה שהדף צריך)');
  const SS = require('vm').runInNewContext(read('strings-share.js') + ';STRINGS');
  ok(Object.keys(SS.he).length < 400 && SS.he.studioSvGone && SS.en.studioSvGone && !SS.he.accAddGoogle, 'strings-share.js קטן — בלי המחרוזות של הליבה');

  /* ---------- 4. הטלפון ---------- */
  ok(/navBar\(\{ back: T\('studioShort'\), end: shrBtn\(rec\) \}\)/.test(st) && /navBar\(\{ back: T\('studioDialVi'\), end: shrBtn\(rec\) \}\)/.test(st), 'כפתור השיתוף בסרגל — בדף התוצאה ובדף הניתוח');
  ok(/const shrOk = \(rec\) => !!\(rec && rec\.srv && rec\.srv\.state === 'done' && !rec\.spec\.dry && isR2Folder\(jobFolder\(rec\)\)/.test(st), 'הכפתור רק בעבודה שהסתיימה עם קבצים ב־R2');
  ok(/else if \(ui\.view === 'shr'\) pageShr\(p\);/.test(st) && /if \(ui\.view === 'shr'\) return 'shr\|'/.test(st), 'דף השיתוף רשום (ציור וצורה)');
  ok(/askConfirm\(T\('studioShrOffQ'\), go2, \{ ok: T\('studioShrOff'\), danger: true \}\)/.test(st), 'ביטול הקישור — באישור');
  const su = /export function shareUrl\(t, loc\) \{([^]*?)\n\}/.exec(st)[1];
  const shareUrl = new Function('t', 'loc', su);
  ok(shareUrl(T3, new URL('https://studio.thesnowball.app/?x=1#studio=j1')) === 'https://studio.thesnowball.app/share#' + T3, 'הכתובת בייצור: ‎/share#<טוקן> (בלי השאילתה של האפליקציה)');
  ok(shareUrl(T3, new URL('https://yishaiguedj1.github.io/portfolio-pwa/studio.html')) === 'https://yishaiguedj1.github.io/portfolio-pwa/share.html#' + T3, 'באתר המאוחד: share.html ליד האפליקציה');
  const pj = read('ibkr-proxy/lib/studio.js');
  ok(/ln: typeof job\.lnh === 'string' && job\.lnh\.length === 64 && Number\(job\.lnx\) > now \? \{ x: /.test(pj), 'publicJob: רק "פעיל עד" — לא ה־hash ולא הסוד');
  ok(/const shrDayOpts = \(\) => \[\[1, T\('studioShrD1'\)\], \[7, T\('studioShrD7'\)\], \[30, T\('studioShrD30'\)\]\]/.test(st) && SH.SH_DAYS.join() === '1,7,30' && /seg\.setAttribute\('role', 'radiogroup'\)/.test(st), 'בורר התוקף בטלפון = SH_DAYS בשרתון');
  const app = read('app.js');
  for (const k of ['studioShrTitle', 'studioShrNote', 'studioShrOffQ', 'studioSvGone', 'studioSvBy']) ok((app.match(new RegExp('\\b' + k + ': "', 'g')) || []).length === 2, k + ' בעברית ובאנגלית');

  console.log('# ' + n + ' בדיקות עברו');
})().catch((e) => { console.error('FAIL -', e); process.exit(1); });
