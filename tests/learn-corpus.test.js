// 15/10/2026 — מאגר הלמידה מ׳2: קורפוס הטקסט. השרתון האמיתי (api/studio.js) עם Firestore ו־R2 מדומים:
// הניקוי והרשימה המותרת (lib/learncorpus.js); learnPut מהעובד → מוצפן בתור q/; בלי הודעה שנקראה / מתג כבוי / דלי — לא נשמר;
// פעם אחת לעבודה; האצווה היומית q → c/<חודש>; מחיקה אחרי 24 חודשים; "מחק את התרומות שלי" מוחק גם מהדלי;
// משיכת הניתוח (learnPull) — המספרים, ועם ci גם הפריטים. **בשום פריט אין uid, מייל, שם קובץ או מזהה עבודה.**
// הרצה: node tests/learn-corpus.test.js
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const { fakeR2, ACC } = require('./_r2fake');

(async () => {
  const LC = require(path.join(root, 'ibkr-proxy/lib/learncorpus.js'));
  /* ---------- 1. ניקוי ורשימה מותרת (טהור) ---------- */
  ok(LC.scrub('כתבו לי ל־dana.levi@example.com או 054-123-4567') === 'כתבו לי ל־⟨מייל⟩ או ⟨מספר⟩', 'מייל וטלפון מוחלפים בתגים');
  ok(LC.scrub('ב־1965 קנינו 7 מניות ב־$1,000,000') === 'ב־1965 קנינו 7 מניות ב־$1,000,000', 'שנים, מספרים קצרים וסכומים נשארים');
  ok(LC.scrub('ת"ז 123456789 · www.example.com/x') === 'ת"ז ⟨מספר⟩ · ⟨קישור⟩', 'מספר ארוך וקישור מוחלפים');
  ok(LC.scrub('Warren Buffett said') === 'Warren Buffett said', 'שמות נשארים (בלעדיהם אי אפשר ללמוד תרגום שמות)');
  const raw = { v: 1, uid: 'ownerUid0001', name: 'my-video.mp4', folder: 'X', mode: 'sonnet-medium', src: 'en', dst: 'he', dur: 600,
    cu: [{ i: 1, s: 1.2, e: 3.4, k: 'S1', en: 'Call 054-123-4567', d: 'תתקשרו', f: 'התקשרו', secret: 'x' }, { i: 2, s: 4, e: 5, k: 'Dana Levi', en: 'Hi', d: 'היי' }, { i: 'x' }],
    fin: [{ s: 1.2, e: 3.4, h: 'התקשרו\nעכשיו', id: 9 }], wd: [['Call', 1.2, 1.5, 'S1', 1.1, 1.25, 1.2, 'qwen3', 'extra'], ['bad']],
    pt: ['bufet => Buffett'], sp: { S1: { n: 'Warren Buffett', r: 'CEO', g: 'm', x: 'drop' }, 'Dana': { n: 'x' }, S2: { n: 'call 054-123-4567' } }, gl: ['Berkshire\tברקשייר'], at: 123 };
  const it = LC.normCorpus(raw, '2026-10');
  ok(it && it.m === '2026-10' && it.cu.length === 2 && !('uid' in it) && !('name' in it) && !('folder' in it) && !('at' in it), 'רק השדות המותרים (uid, שם, תיקייה וזמן — לא)');
  ok(it.cu[0].en === 'Call ⟨מספר⟩' && it.cu[0].f === 'התקשרו' && !('secret' in it.cu[0]) && !('r' in it.cu[0]), 'הכתובית: מנוקה, ורק השלבים ששינו משהו');
  ok(it.cu[1].k === 'S?', 'שם דובר במקום S1/S2 — לא נשמר');
  ok(it.wd.length === 1 && it.wd[0].length === 8 && it.fin[0].h === 'התקשרו\nעכשיו' && !('id' in it.fin[0]), 'זמני המילים והסופי — בצורה קבועה');
  ok(JSON.stringify(it.sp) === JSON.stringify({ S1: { n: 'Warren Buffett', r: 'CEO', g: 'm' }, S2: { n: 'call ⟨מספר⟩' } }), 'שמות הדוברים נשמרים (בקשת המשתמש) — רק S1/S2, שם/תפקיד/מגדר, מנוקים');
  ok(LC.normCorpus(Object.assign({}, raw, { v: 2 }), '2026-10') === null && LC.normCorpus({ v: 1, cu: [] }, 'x') === null, 'גרסה אחרת / בלי כתוביות — לא נשמר');
  ok(LC.oldestMonth(Date.UTC(2026, 9, 15)) === '2024-10' && LC.expired('2024-09', Date.UTC(2026, 9, 15)) && !LC.expired('2024-10', Date.UTC(2026, 9, 15)), '24 חודשים בדיוק');
  ok(LC.parseKey('c/2026-10/' + 'a'.repeat(20) + '.bin').month === '2026-10' && LC.parseKey('c/x/../y.bin') === null, 'מפתחות בדלי — רק בצורה שלנו');

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
  const OWNER = tok('ownerUid0001', 'owner@example.com');
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
  const spec = { name: 'my-private-lecture.mp4', size: 1000, type: 'video/mp4', dur: 600, from: 'en', to: ['he'], mode: 'sonnet-medium', out: ['srt'] };
  const newJob = async () => {
    const j = await api('create', { spec });
    const id = j.job.id, key = crypto.randomBytes(32).toString('base64url');
    Object.assign(db.get('studioJobs/' + id).fields, { kh: { stringValue: crypto.createHash('sha256').update(key).digest('hex') }, kx: { integerValue: String(NOW + 3600e3) }, state: { stringValue: 'running' } });
    return { id, key, put: (lc) => call({ op: 'learnPut', job: id, key, lc }, true).then((r) => r.j) };
  };
  const body = (o) => zlib.gzipSync(Buffer.from(JSON.stringify(o))).toString('base64');
  const LR = require(path.join(root, 'ibkr-proxy/lib/studiolearn.js'));
  const keysIn = async (pre) => (await R2.list(R2.config({ R2_ACCOUNT_ID: ACC, R2_ACCESS_KEY_ID: 'AKTEST', R2_SECRET_ACCESS_KEY: 'sekret/xyz', R2_BUCKET: 'snb-studio' }), { fetch: fetchAll, now: () => NOW }, pre)).map((x) => x.key);

  const a = await newJob();
  ok((await a.put(body(raw))).saved === false, 'ההודעה עוד לא נקראה — הטקסט לא נשמר (המדדים כן, בנפרד)');
  ok((await api('learnPref', { ack: true })).ok, 'הנוסח הישן נקרא (lra בלי tv)');
  ok((await a.put(body(raw))).saved === false, 'אישור של הנוסח הישן ("רק מספרים") — הטקסט לא נשמר');
  const ackT = await api('learnPref', { ack: true, tv: 2 });
  ok(ackT.ok && ackT.lrt > 0, 'הנוסח החדש (tv 2 — "גם הטקסט נשמר") נקרא: lrt');
  const pr = await a.put(body(raw));
  ok(pr.ok && pr.saved === true, 'learnPut: נשמר');
  const q1 = await keysIn('q/');
  ok(q1.length === 1 && q1[0] === 'q/' + LR.lid(a.id) + '.bin', 'בתור — לפי המזהה המגובב, בלי זמן בשם');
  const sealed = Buffer.from(R.objs.get('snb-studio/' + q1[0]) || R.objs.get(q1[0]) || '').toString('utf8');
  ok(sealed.startsWith('v1.') && !/my-private-lecture|ownerUid0001|owner@example|054-123|התקשרו/.test(sealed), 'בדלי — מוצפן: בלי טקסט, בלי שם הקובץ, uid או מייל');
  ok((await a.put(body(raw))).saved === false, 'פעם אחת לעבודה (lc)');
  ok((await a.put('not-base64-gzip')).saved === false, 'גוף שבור — לא נשמר, בלי שגיאה לעובד');
  const big = await call({ op: 'learnPut', job: a.id, key: 'x'.repeat(43), lc: 'A'.repeat(3e6) }, true);
  ok(big.code === 413, 'גוף גדול מדי — 413');

  // מתג כבוי — לא נשמר
  await api('learnPref', { on: false });
  const b = await newJob();
  ok((await b.put(body(raw))).saved === false, 'המתג כבוי — לא נשמר');
  await api('learnPref', { on: true });
  const c = await newJob();
  ok((await c.put(body(raw))).saved === true, 'המתג דולק שוב — נשמר');

  /* האצווה היומית */
  let w = await call({}, false, true);
  ok(w.j.ok && w.j.lc === 2, 'האצווה: שני הפריטים עברו מהתור');
  ok((await keysIn('q/')).length === 0 && (await keysIn('c/')).every((k) => /^c\/2026-10\/[0-9a-f]{20}\.bin$/.test(k)) && (await keysIn('c/')).length === 2, 'אחרי האצווה: c/<חודש>/<מזהה>, התור ריק');
  w = await call({}, false, true);
  ok(w.j.lc === 0, 'פעם ביום בלבד');

  /* משיכת הניתוח */
  const at = await api('atNew', { n: 'test' });
  const tokA = at.token || at.at || at.tok;
  const lp = await call({ op: 'learnPull', at: tokA, ci: 5 }, true);
  ok(lp.j && lp.j.ok && lp.j.corpus.on && lp.j.corpus.n === 2 && lp.j.corpus.items.length === 2, 'learnPull: המספרים + הפריטים (עם ci)');
  const flat = JSON.stringify(lp.j.corpus.items);
  ok(!/my-private-lecture|ownerUid0001|owner@example|054-123|Dana Levi/.test(flat) && /התקשרו/.test(flat) && /Warren Buffett/.test(flat) && lp.j.corpus.items[0].m === '2026-10', 'הפריטים הפתוחים: הטקסט כן — שום שדה מזהה לא');
  const lp0 = await call({ op: 'learnPull', at: tokA }, true);
  ok(lp0.j.corpus.n === 2 && !lp0.j.corpus.items, 'בלי ci — רק המספרים');

  /* 24 חודשים */
  NOW = Date.UTC(2028, 10, 2, 12); R.now = NOW;
  w = await call({}, false, true);
  ok((await keysIn('c/')).length === 0, 'אחרי 24 חודשים — התוכן נמחק');

  /* "מחק את התרומות שלי" */
  NOW = Date.UTC(2026, 9, 20, 12); R.now = NOW;
  const d = await newJob();
  ok((await d.put(body(raw))).saved === true, 'עוד עבודה — נשמרה (בתור)');
  const fg = await api('learnForget', {});
  ok(fg.ok && fg.nc === 1 && (await keysIn('q/')).length === 0, '"מחק את התרומות שלי" — גם הקורפוס בדלי נמחק');
  const e = await newJob();
  ok((await e.put(body(raw))).saved === false, 'עבודה שנוצרה לפני המחיקה — לא נכנסת שוב');

  /* מ׳4 (15/10/2026): הקול ועותק ה־240p — קישור חתום ומפתח עטוף; רק אחרי ההודעה שאומרת זאת (lrm) */
  NOW = Date.UTC(2026, 9, 22, 12); R.now = NOW;
  for (const [k, v] of db) if (k.startsWith('studioJobs/')) v.fields.state = { stringValue: 'done' };
  const mj = await newJob();
  const mcall = (op, k) => call({ op, job: mj.id, key: mj.key, k }, true).then((r) => r.j);
  ok((await mcall('learnMedia', 'a')).skip === true, 'הקול: ההודעה של הקול וה־240p עוד לא נקראה (tv 2 בלבד) — לא מבקשים');
  const ack3 = await api('learnPref', { ack: true, tv: 3 });
  ok(ack3.lrm > 0 && ack3.lrt > 0, 'הנוסח של מ׳4 (tv 3) — גם lrm');
  const ma = await mcall('learnMedia', 'a');
  const lidM = LR.lid(mj.id);
  ok(ma.url && ma.url.includes('.r2.cloudflarestorage.com/') && ma.url.includes('/m/2026-10/' + lidM + '.a.mp4') && /X-Amz-Signature=/.test(ma.url), 'קישור PUT חתום לנתיב m/<חודש>/<מזהה>.a.mp4');
  ok(/^[0-9a-f]{32}$/.test(ma.key) && /^[0-9a-f]{32}$/.test(ma.kid) && ma.max > 0, 'מפתח הצפנה חדש לעבודה (16 בתים) + מזהה');
  const kobj = (await keysIn('m/')).find((k) => k.endsWith('.a.key'));
  const ksealed = Buffer.from(R.objs.get('snb-studio/' + kobj) || R.objs.get(kobj) || '').toString('utf8');
  ok(kobj && ksealed.startsWith('v1.') && !ksealed.includes(ma.key), 'המפתח נשמר ליד הקובץ — עטוף בכספת, לא גלוי');
  const pu = await R.fetch(ma.url, { method: 'PUT', body: Buffer.alloc(5000, 7), headers: { 'content-length': '5000' } });
  ok(pu.status === 200, 'העובד מעלה ישירות לדלי');
  ok((await mcall('learnMediaDone', 'a')).saved === true, 'learnMediaDone: נבדק הגודל ונרשם');
  ok((await mcall('learnMedia', 'a')).skip === true, 'פעם אחת לכל סוג בעבודה (lm)');
  const mv = await mcall('learnMedia', 'v');
  ok(mv.url && mv.url.includes('/m/2026-10/' + lidM + '.v.mp4') && mv.key !== ma.key, 'ה־240p: קישור ומפתח משלו, באותו חודש');
  ok((await mcall('learnMediaDone', 'v')).saved === false && !(await keysIn('m/')).some((k) => k.includes('.v.')), 'לא הועלה — לא נרשם, והמפתח נמחק');
  ok((await mcall('learnMedia', 'x')).skip === true, 'סוג לא מוכר — לא');
  const lpm = await call({ op: 'learnPull', at: tokA }, true);
  ok(lpm.j.corpus.na === 1 && lpm.j.corpus.nv === 0 && lpm.j.corpus.mb === 5000, 'בלוח: כמה קול / 240p ו־MB');
  NOW = Date.UTC(2028, 11, 2, 12); R.now = NOW;
  await call({}, false, true);
  ok((await keysIn('m/')).length === 0, 'הקול וה־240p — נמחקים אחרי 24 חודשים');
  NOW = Date.UTC(2026, 9, 23, 12); R.now = NOW;
  for (const [k, v] of db) if (k.startsWith('studioJobs/')) v.fields.state = { stringValue: 'done' };
  const mj2 = await newJob();
  const m2 = await call({ op: 'learnMedia', job: mj2.id, key: mj2.key, k: 'a' }, true).then((r) => r.j);
  await R.fetch(m2.url, { method: 'PUT', body: Buffer.alloc(100, 1), headers: { 'content-length': '100' } });
  await call({ op: 'learnMediaDone', job: mj2.id, key: mj2.key, k: 'a' }, true);
  ok((await keysIn('m/')).length === 2, 'עבודה נוספת — הקול והמפתח בדלי');
  await api('learnForget', {});
  ok((await keysIn('m/')).length === 0, '"מחק את התרומות שלי" — גם הקול וה־240p');

  /* בלי הדלי — כלום */
  for (const [k, v] of db) if (k.startsWith('studioJobs/')) v.fields.state = { stringValue: 'done' };   // מקום לעבודה חדשה
  delete process.env.R2L_BUCKET; R2._reset();
  ok((await (await newJob()).put(body(raw))).saved === false, 'בלי הגדרת הדלי — לא נשמר, בלי שגיאה');

  console.log('\nכל ' + n + ' הבדיקות עברו ✓');
})().catch((e) => { console.error(e); process.exit(1); });
