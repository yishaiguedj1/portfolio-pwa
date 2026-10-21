// 15/10/2026 — האיסוף המלא בתקופת הפיתוח (הדגל learn_full). טהור: redact, הצורות הקבועות (lib/devlog.js), הקורפוס במצב
// המלא (בלי scrub, עם קבצי הטקסט). השרתון האמיתי עם Firestore ו־R2 מדומים: devMet/devLog מהשרת (טוקן שרת), devErr
// מהטלפון (רק המנהל), הדגל כבוי = כלום, בלי הנוסח החדש (lrf) = בלי לוג עבודה, claim מחזיר full, learnPut המלא מוסיף שם
// קובץ ותמונת עבודה בלי סודות, devPull בטוקן הניתוח, מחיקה אחרי 30 יום. הרצה: node tests/devlog.test.js
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const crypto = require('crypto');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const { fakeR2, ACC } = require('./_r2fake');

(async () => {
  const DL = require(path.join(root, 'ibkr-proxy/lib/devlog.js'));
  const LC = require(path.join(root, 'ibkr-proxy/lib/learncorpus.js'));
  const SF = require(path.join(root, 'ibkr-proxy/lib/sysflags.js'));
  /* ---------- 1. טהור ---------- */
  const SRV = 'A'.repeat(12) + '-' + 'b'.repeat(43);
  const red = DL.redact('key sk-ant-api03-abcdefghijk · Authorization: Bearer abc.def.ghijklmnop · job.py run --job j1 --key ' + 'k'.repeat(43)
    + ' · ' + SRV + ' · https://x.r2.cloudflarestorage.com/a?X-Amz-Signature=deadbeef&X-Amz-Credential=AK%2F1 · eyJhbGciOi.eyJzdWIiOiJ4.c2lnbmF0dXJl · ya29.a0AfH6SMBxyz123');
  ok(!/sk-ant-api03|abc\.def\.ghijk|kkkkkkkk|bbbbbbbbbb|deadbeef|AK%2F1|eyJzdWIiOiJ4|SMBxyz/.test(red), 'redact: מפתח API, Bearer, מפתח עבודה, טוקן שרת, חתימת קישור, JWT, גישת Google — נמחקים');
  ok(/--key ⟨key⟩/.test(red) && DL.redact('Traceback: ValueError in stage tl') === 'Traceback: ValueError in stage tl', 'redact: טקסט רגיל נשאר');
  const jl = DL.normJobLog({ job: 'j' + 'A'.repeat(20), t: 'end', rc: 1, tail: 'x'.repeat(300 * 1024) + 'END', tb: 'Traceback (most recent call last):\n  File "job.py"', calls: [
    { t: 1.76e9, ms: 1200, k: 'tl', m: 'claude-sonnet-5-5', a: 1, sr: 'max_tokens', rid: 'req_011CXYZabc', i: 10, o: 20, usd: 0.0123456789, bogus: 'x' },
    { t: 'bad' }, { t: 1.76e9, m: '<script>', err: 'api_overloaded', em: 'Overloaded sk-ant-xxxxxxxxxx' }], ps: [{ pid: 12, cm: 'python3', s: 'S', wc: 'futex_wait', rss: 1e6, cpu: 3.2, cl: 'python3 job.py run --key secretsecret' }],
    evil: 'x', uid: 'u' });
  ok(jl && jl.tail.length <= 200 * 1024 + 1 && jl.tail.endsWith('END') && !('evil' in jl) && !('uid' in jl), 'יומן עבודה: הזנב מהסוף, רק השדות המותרים');
  ok(jl.calls.length === 2 && jl.calls[0].sr === 'max_tokens' && jl.calls[0].rid === 'req_011CXYZabc' && jl.calls[0].usd === 0.012346 && !('bogus' in jl.calls[0]) && !('m' in jl.calls[1]) && !/sk-ant-x/.test(jl.calls[1].em), 'יומן הקריאות: stop_reason, request id, עלות; מודל לא תקין — נזרק; בלי סודות בהודעה');
  ok(jl.ps[0].wc === 'futex_wait' && /--key ⟨key⟩/.test(jl.ps[0].cl), 'מצב התהליכים: על מה מחכה, ושורת הפקודה בלי המפתח');
  ok(DL.normJobLog({ job: 'evil' }) === null && DL.normMet({ smp: [] }) === null && DL.normErrs({ app: 'x', errs: [{ msg: 'a' }] }) === null, 'לא תקין — לא נשמר');
  const mt = DL.normMet({ smp: [{ t: 1.76e9, cpu: 150, mem: 50.55, j: 'j' + 'B'.repeat(20), st: 'tl', p: 0.4, x: 1 }, { cpu: 1 }], cores: 4 });
  ok(mt.smp.length === 1 && mt.smp[0].cpu === 100 && mt.smp[0].mem === 50.6 && !('x' in mt.smp[0]) && mt.cores === 4, 'מדדים: בטווח, דגימה בלי זמן — נזרקת');
  const er = DL.normErrs({ app: 'studio', ver: 'v438', errs: Array.from({ length: 30 }, (_, i) => ({ msg: 'TypeError ' + i, ln: 5, stk: 'at f (studio.js:5:1)' })) });
  ok(er.errs.length === DL.ERR_MAX && er.app === 'studio', 'שגיאות מהטלפון: עד 20 במנה');
  const k = DL.dKey(Date.UTC(2026, 9, 15, 10), 'j', DL.newId(Date.UTC(2026, 9, 15, 10), 'abc123'));
  ok(/^d\/2026-10-15\/j\/[a-z0-9]+-abc123\.bin$/.test(k) && DL.parseKey(k).kind === 'j' && DL.parseKey('d/2026-10-15/x/a.bin') === null && DL.parseKey('d/../j/a.bin') === null, 'מפתחות בדלי — רק בצורה שלנו');
  ok(DL.expiredKey('d/2026-09-14/m/a.bin', Date.UTC(2026, 9, 15)) && !DL.expiredKey('d/2026-09-16/m/a.bin', Date.UTC(2026, 9, 15)), '30 יום');
  const snap = DL.jobSnap({ id: 'j1', uid: 'U', kh: 'H', kx: 1, sess: 's', spec: { name: 'lecture.mp4', key: 'k' }, use: [{ m: 'claude-x' }], err: 'x sk-ant-abcdefghij' });
  ok(!('uid' in snap) && !('kh' in snap) && !('sess' in snap) && !('key' in snap.spec) && snap.spec.name === 'lecture.mp4' && !/sk-ant-abc/.test(snap.err), 'תמונת העבודה: בלי סודות ובלי uid');
  ok(SF.KEYS.includes('learn_full') && SF.FLAGS.find((f) => f.k === 'learn_full').where, 'הדגל learn_full בקטלוג, עם המקום שבו הוא נאכף');
  const admin = fs.readFileSync(path.join(root, 'admin-app.js'), 'utf8'), app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  ok(/learn_full: \[\(\) => t\('admFlFull'\)/.test(admin) && (app.match(/admFlFull: "/g) || []).length === 2 && (app.match(/studioLrnAckQF: "/g) || []).length === 2, 'במרכז הניהול: שם ותיאור לדגל (עברית ואנגלית), והנוסח החדש של ההודעה');
  const qf = app.match(/studioLrnAckQF: "([^"]*)"/)[1];
  ok(/שם הקובץ/.test(qf) && /לוגים/.test(qf) && /Invest/.test(qf) && /30 יום/.test(qf), 'הנוסח (4) אומר מה נאסף, שאין נתוני Invest, ומתי נמחק');

  /* הקורפוס במצב המלא */
  const raw = { v: 1, cu: [{ i: 1, s: 1, e: 2, k: 'S1', en: 'Call 054-123-4567 or dana@example.com', d: 'התקשרו' }], tx: { 'tr/brief.md': '# תדריך', 'tr/batch_001.he.txt': '#1 שלום', '../etc/passwd': 'x', 'judge/verdict.txt': '#1 4 ok' } };
  const full = LC.normCorpus(raw, '2026-10', true), norm = LC.normCorpus(raw, '2026-10');
  ok(full.full === 1 && /054-123-4567/.test(full.cu[0].en) && /dana@example.com/.test(full.cu[0].en) && Object.keys(full.tx).length === 3 && !('../etc/passwd' in full.tx), 'מצב מלא: בלי scrub, עם קבצי הטקסט (רק נתיבים יחסיים)');
  ok(!norm.full && !norm.tx && /⟨מספר⟩/.test(norm.cu[0].en), 'הקריאה הרגילה אחריה — עם scrub ובלי קבצים (המנקה חזר)');

  /* ---------- 2. השרתון ---------- */
  const sa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const fb = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  Object.assign(process.env, {
    R2L_ACCOUNT_ID: ACC, R2L_ACCESS_KEY_ID: 'AKTEST', R2L_SECRET_ACCESS_KEY: 'sekret/xyz', R2L_BUCKET: 'snb-studio',
    GDRIVE_SA_KEY: JSON.stringify({ client_email: 'sa@p.iam.gserviceaccount.com', private_key: sa.privateKey.export({ type: 'pkcs8', format: 'pem' }) }),
    LIBRARY_READERS: 'owner@example.com', STUDIO_USERS: 'other@example.com', SNB_SITEWATCH: 'off', SNB_ADMINWATCH: 'off',
  });
  for (const x of ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET', 'IBKR_VAULT_KEY']) delete process.env[x];
  const gauth = require(path.join(root, 'ibkr-proxy/lib/gauth.js'));
  const R2 = require(path.join(root, 'ibkr-proxy/lib/r2.js'));
  const vault = require(path.join(root, 'ibkr-proxy/lib/vault.js'));
  const studio = require(path.join(root, 'ibkr-proxy/api/studio.js'));
  gauth._reset(); studio._reset(); R2._reset();
  const keys = { k1: fb.publicKey.export({ type: 'spki', format: 'pem' }) };
  const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const tnow = Math.floor(Date.now() / 1000);
  const tok = (sub, email) => {
    const hd = b64u({ alg: 'RS256', kid: 'k1' }), bd = b64u({ aud: 'yishaiguedj1-c786e', iss: 'https://securetoken.google.com/yishaiguedj1-c786e', sub, iat: tnow - 5, exp: tnow + 3000, email, email_verified: true });
    return hd + '.' + bd + '.' + crypto.sign('RSA-SHA256', Buffer.from(hd + '.' + bd), fb.privateKey).toString('base64url');
  };
  const OWNER = tok('ownerUid0001', 'owner@example.com'), OTHER = tok('otherUid0002', 'other@example.com');
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
      return J([...db.entries()].filter(([kk, v]) => kk.startsWith(col + '/') && fl.every((f) => v.fields[f.field.fieldPath] && v.fields[f.field.fieldPath].stringValue === f.value.stringValue))
        .map(([kk, v]) => ({ document: { name: 'projects/p/databases/(default)/documents/' + kk, fields: v.fields, updateTime: v.ut } })).concat([{ readTime: 'x' }]));
    }
    const lm = url.match(/\/documents\/([A-Za-z]+)\?(.*)$/);
    if (lm && (opt.method || 'GET') === 'GET') return J({ documents: [] });
    const m = url.match(/\/documents\/([A-Za-z]+)\/([A-Za-z0-9_-]+)(?:\?(.*))?$/);
    if (!m) return J({}, 404);
    const kk = m[1] + '/' + m[2], cur = db.get(kk);
    if ((opt.method || 'GET') === 'GET') return cur ? J({ fields: cur.fields, updateTime: cur.ut }) : J({}, 404);
    if (opt.method === 'DELETE') { db.delete(kk); return J({}); }
    if (opt.method === 'PATCH') {
      const qp = new URLSearchParams(m[3] || '');
      const mask = qp.getAll('updateMask.fieldPaths'), pre = qp.get('currentDocument.updateTime');
      if (pre && (!cur || cur.ut !== pre)) return J({}, 400);
      const body = JSON.parse(opt.body).fields;
      db.set(kk, { fields: mask.length ? Object.assign({}, cur ? cur.fields : {}, ...mask.map((f) => ({ [f]: body[f] }))) : body, ut: 't' + (++utSeq) });
      return J({});
    }
    return J({}, 400);
  };
  let NOW = Date.UTC(2026, 9, 15, 12); R.now = NOW;
  const deps = () => ({ verify: { keys }, fetch: fetchAll, now: NOW });
  const call = async (body, hdr, get, origin) => {
    const res = { code: 0, j: null, setHeader() {}, status(c) { res.code = c; return res; }, json(o) { res.j = o; return res; }, end() { return res; } };
    const req = { method: get ? 'GET' : 'POST', url: '/api/studio', query: {}, body, headers: hdr || (get ? {} : { origin: origin || 'https://yishaiguedj1.github.io' }), socket: { remoteAddress: '9.9.9.9' } };
    await studio._handler(req, res, deps());
    return res;
  };
  const api = (op, b, who) => call(Object.assign({}, b, { op, idToken: who || OWNER })).then((r) => r.j);
  const L = { R2_ACCOUNT_ID: ACC, R2_ACCESS_KEY_ID: 'AKTEST', R2_SECRET_ACCESS_KEY: 'sekret/xyz', R2_BUCKET: 'snb-studio' };
  const keysIn = async (pre) => (await R2.list(R2.config(L), { fetch: fetchAll, now: () => NOW }, pre)).map((x) => x.key);
  const openKey = (kk) => vault.open(Buffer.from(R.objs.get('snb-studio/' + kk) || R.objs.get(kk) || '').toString('utf8'), 'dev|' + kk);

  const sc = await api('srvCreate', { name: 'w1' });
  ok(sc.ok && sc.token, 'שרת לבדיקה');
  const SID = sc.token.split('-')[0] === sc.token ? '' : sc.server.id;
  const srv = (op, d) => call({ op, d }, { authorization: 'Bearer ' + sc.token }).then((r) => r);

  /* מדדים */
  let r = await srv('devMet', { smp: [{ t: Math.floor(NOW / 1000), cpu: 40, mem: 60, disk: 30, st: 'tl' }], cores: 8 });
  ok(r.code === 200 && r.j.saved === true, 'devMet: הדגל דולק (ברירת המחדל) — נשמר');
  const mk = (await keysIn('d/')).filter((x) => x.includes('/m/'));
  ok(mk.length === 1 && /^d\/2026-10-15\/m\//.test(mk[0]), 'בדלי: d/<יום>/m/');
  const mobj = openKey(mk[0]);
  ok(mobj && mobj.sid === SID && mobj.smp[0].cpu === 40 && mobj.cores === 8, 'מוצפן — נפתח רק עם ה־AAD של המפתח, ומזהה השרת בפנים');
  ok((await call({ op: 'devMet', d: { smp: [{ t: 1.76e9 }] } }, { authorization: 'Bearer ' + 'x'.repeat(12) + '-' + 'y'.repeat(43) })).code === 401, 'בלי טוקן שרת תקין — 401');
  ok((await srv('devMet', { smp: [] })).j.saved === false, 'מנה ריקה — לא נשמרת');

  /* יומן עבודה */
  const spec = { name: 'my-private-lecture.mp4', size: 1000, type: 'video/mp4', dur: 600, from: 'en', to: ['he'], mode: 'sonnet-medium', out: ['srt'] };
  const cj = await api('create', { spec });
  const jid = cj.job.id, jkey = crypto.randomBytes(32).toString('base64url');
  Object.assign(db.get('studioJobs/' + jid).fields, { kh: { stringValue: crypto.createHash('sha256').update(jkey).digest('hex') }, kx: { integerValue: String(NOW + 3600e3) },
    state: { stringValue: 'running' }, sid: { stringValue: SID }, eng: { stringValue: 'api' } });
  const log = { job: jid, t: 'end', rc: 1, tail: 'run --key ' + jkey + '\nTraceback (most recent call last):\nValueError', tb: 'Traceback (most recent call last):\nValueError',
    calls: [{ t: NOW / 1000, ms: 900, k: 'tl', m: 'claude-sonnet-5-5', sr: 'end_turn', rid: 'req_abcdef123', usd: 0.01 }] };
  ok((await srv('devLog', log)).j.saved === false, 'devLog: הבעלים עוד לא קרא את הנוסח של האיסוף המלא (lrf) — לא נשמר');
  let cl = await call({ op: 'claim', job: jid, key: jkey }, {});
  ok(cl.j && cl.j.ok && cl.j.full === 0, 'claim: full = 0 לפני הנוסח');
  const ack = await api('learnPref', { ack: true, tv: 4 });
  ok(ack.ok && ack.lrf > 0 && ack.lrm > 0 && ack.lrt > 0, 'הנוסח 4 נקרא: lrf (וגם lrt, lrm)');
  ok((await api('status', {})).lrf > 0, 'status מחזיר lrf לטלפון');
  cl = await call({ op: 'claim', job: jid, key: jkey }, {});
  ok(cl.j.full === 1, 'claim: full = 1 — העובד שולח קבצי טקסט ויומן קריאות');
  r = await srv('devLog', log);
  ok(r.j.saved === true, 'devLog: נשמר');
  const jk = (await keysIn('d/')).find((x) => x.includes('/j/'));
  const jobj = openKey(jk);
  ok(jobj.job === jid && jobj.eng === 'api' && jobj.calls[0].rid === 'req_abcdef123' && /ValueError/.test(jobj.tb), 'היומן: traceback, יומן הקריאות, המנוע');
  ok(!jobj.tail.includes(jkey) && !Buffer.from(R.objs.get('snb-studio/' + jk) || R.objs.get(jk)).toString().includes('my-private'), 'בלי מפתח העבודה בלוג; בדלי — מוצפן');
  Object.assign(db.get('studioJobs/' + jid).fields, { sid: { stringValue: 'otherserver1' } });
  ok((await srv('devLog', log)).j.saved === false, 'devLog לעבודה ששרת אחר לקח — לא נשמר');
  Object.assign(db.get('studioJobs/' + jid).fields, { sid: { stringValue: SID } });

  /* הקורפוס במצב המלא */
  const body = zlib.gzipSync(Buffer.from(JSON.stringify(raw))).toString('base64');
  const lp = await call({ op: 'learnPut', job: jid, key: jkey, lc: body }, {});
  ok(lp.j.saved === true, 'learnPut במצב המלא — נשמר');
  const LR = require(path.join(root, 'ibkr-proxy/lib/studiolearn.js'));
  const qk = 'q/' + LR.lid(jid) + '.bin';
  const item = vault.open(Buffer.from(R.objs.get('snb-studio/' + qk) || R.objs.get(qk)).toString('utf8'), 'learn|' + LR.lid(jid));
  ok(item.full === 1 && item.fn === 'my-private-lecture.mp4' && /054-123-4567/.test(item.cu[0].en) && item.tx['tr/brief.md'] === '# תדריך', 'בפריט: שם הקובץ, הטקסט בלי השמטות, קבצי הפרויקט');
  ok(item.jb && item.jb.id === jid && !('kh' in item.jb) && !('uid' in item.jb) && !('kx' in item.jb), 'תמונת העבודה מהשרתון — בלי hash המפתח, בלי uid');

  /* שגיאות מהטלפון */
  const errs = [{ ty: 'err', msg: 'TypeError: x is undefined', src: 'https://studio.thesnowball.app/studio.js', ln: 10, stk: 'at f (studio.js:10:2)' }];
  r = await call({ op: 'devErr', idToken: OWNER, app: 'academy', ver: 'v438', errs }, null, false, 'https://academy.thesnowball.app');
  ok(r.code === 200 && r.j.saved === true, 'devErr מ־Academy (המנהל) — נשמר (appscope: פתוח לכל האפליקציות)');
  r = await call({ op: 'devErr', idToken: OTHER, app: 'studio', errs }, null, false, 'https://studio.thesnowball.app');
  ok(r.j && r.j.saved === false, 'devErr של משתמש אחר — לא נשמר');
  const ek = (await keysIn('d/')).find((x) => x.includes('/e/'));
  ok(openKey(ek).app === 'academy' && openKey(ek).errs[0].ln === 10, 'השגיאה בדלי');

  /* משיכה לקריאה בלבד */
  const at = await api('atNew', { n: 'dev' });
  const tokA = at.token || at.at || at.tok;
  const dp = await call({ op: 'devPull', at: tokA, days: 2 }, {});
  ok(dp.j.ok && dp.j.on === true && dp.j.items.length === 3 && dp.j.stats.j === 1 && dp.j.stats.m === 1 && dp.j.stats.e === 1, 'devPull: לוג עבודה, מדדים ושגיאות');
  const dpj = await call({ op: 'devPull', at: tokA, job: jid, kinds: ['j'] }, {});
  ok(dpj.j.items.length === 1 && dpj.j.items[0].k === 'j', 'devPull: רק עבודה אחת / רק סוג אחד');
  ok((await call({ op: 'devPull', at: 'snbL_' + 'x'.repeat(32) }, {})).code === 401, 'devPull בלי טוקן תקף — 401');
  const DP = require(path.join(root, 'tools/dev-pull.js'));
  const sp = DP.split(dp.j.items);
  ok(sp.jobs.length === 1 && sp.calls.length === 1 && sp.calls[0].job === jid && sp.metrics.length === 1 && sp.errors.length === 1 && /עבודות שנכשלו/.test(DP.summary(dp.j, sp)), 'tools/dev-pull.js: הקבצים והסיכום');

  /* 21/10/2026: משיכה בחלקים (next) — לסוג אחד, וכל סוג עד הסוף; שרת בלי הדלי (r2:false) → הכתובת הבאה */
  {
    const pages = { j: [{ items: [{ k: 'j', job: jid }], next: 'd/2026-10-21/j/b.bin' }, { items: [{ k: 'j', job: jid }] }], m: [{ items: [{ k: 'm', smp: [] }] }], e: [{ items: [] }] };
    const seen = [];
    const fake = async (u, init) => { const b = JSON.parse(init.body); seen.push(b.kinds[0] + ':' + (b.before || '')); const pg = pages[b.kinds[0]].shift();
      return { ok: true, status: 200, json: async () => Object.assign({ ok: true, on: true, r2: true, at: NOW }, pg) }; };
    const all = await DP.pullAll('https://x', { token: tokA, days: 1, kinds: ['j', 'm', 'e'] }, fake);
    ok(all.items.length === 3 && seen.join(',') === 'j:,j:d/2026-10-21/j/b.bin,m:,e:', 'dev-pull: לכל סוג בנפרד, וממשיך עם next עד הסוף');
    const none = await DP.pullAll('https://x', { token: tokA, days: 1, kinds: ['j'] }, async () => ({ ok: true, status: 200, json: async () => ({ ok: true, on: true, r2: false, items: [] }) }));
    ok(none.r2 === false, 'dev-pull: r2:false מסומן (main עובר לכתובת הבאה)');
    const lost = DP.summary({ at: NOW, on: true, r2: true }, DP.split([{ k: 'j', job: jid, t: 'lost', rc: -9 }, { k: 'm', sid: 's', smp: [{ t: 1000, mem: 100, j: jid, st: 'al' }, { t: 1400, mem: 1 }] }]));
    ok(/lost/.test(lost) && /פערים בדגימות \(1\)/.test(lost), 'dev-pull: יומן של עבודה שנקטעה + פער בדגימות בסיכום');
  }
  // devPull בשרתון: next כשנגמר תקציב הזמן (לא 504)
  ok(/DEV_PULL_BUDGET_MS/.test(fs.readFileSync(path.join(root, 'ibkr-proxy/api/studio.js'), 'utf8')), 'devPull: תקציב זמן');

  /* הדגל כבוי */
  db.set('sysCfg/main', { fields: { flOff: { stringValue: 'learn_full' } }, ut: 'x' });
  NOW += 31e3; R.now = NOW;
  ok((await srv('devMet', { smp: [{ t: Math.floor(NOW / 1000), cpu: 1 }] })).j.saved === false, 'הדגל כבוי — מדדים לא נשמרים');
  ok((await srv('devLog', log)).j.saved === false, 'הדגל כבוי — לוג עבודה לא נשמר');
  ok((await call({ op: 'devErr', idToken: OWNER, app: 'studio', errs }, null, false, 'https://studio.thesnowball.app')).j.saved === false, 'הדגל כבוי — שגיאות לא נשמרות');
  cl = await call({ op: 'claim', job: jid, key: jkey }, {});
  ok(cl.j.full === 0, 'הדגל כבוי — claim: full = 0');
  db.delete('sysCfg/main');

  /* 30 יום */
  NOW = Date.UTC(2026, 10, 16, 12); R.now = NOW;
  await call({}, null, true);
  ok((await keysIn('d/')).length === 0, 'אחרי 30 יום — נמחק (באצווה היומית)');

  /* בשאר הקוד */
  const ag = fs.readFileSync(path.join(root, 'translator/agent.py'), 'utf8'), core = fs.readFileSync(path.join(root, 'core.js'), 'utf8');
  ok(/stdout=subprocess\.PIPE, stderr=subprocess\.STDOUT/.test(ag) && /os\.kill\(pid, signal\.SIGUSR1\)/.test(ag) && /'devMet'/.test(ag), 'agent.py: הפלט נאסף, תקיעה → SIGUSR1, מדדים');
  ok(/function devErrFlush/.test(core) && /c\.f\.learn_full === true/.test(core), 'core.js: שגיאות מהטלפון — רק כשהדגל ידוע כדולק');
  ok(/devErrBoot\(\(\) => A\.user\(\)\)/.test(fs.readFileSync(path.join(root, 'academy-app.js'), 'utf8')) && /devErrBoot\(\(\) => A\.user\(\)\)/.test(fs.readFileSync(path.join(root, 'studio-app.js'), 'utf8')), 'Academy ו־Studio מחברים את השליחה');

  console.log('\nכל ' + n + ' הבדיקות עברו ✓');
})().catch((e) => { console.error(e); process.exit(1); });
