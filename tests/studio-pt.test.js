// 25/10/2026: תרגום בטלפון, שלב 3 — הטלפון מריץ את כל העבודה (גם שלבי הטקסט), והקריאות ל־Claude עוברות דרך התור
// (lib/relay.js) לשרת שלנו, שעונה עם המפתח של המערכת (agent.py: ptNext/ptMark). העלות נספרת בשרתון מכל תשובה.
// 1. התור: עבודות שהשרת עונה להן (srv), nextSrv מכל העבודות, peek  2. השרתון האמיתי (Firestore מדומה): spec.pt, השרת
// לא לוקח (poll), הטלפון לוקח (phClaim), ptNext/ptMark, העלות בשרתון בלבד, התקרה, עבודה שבוטלה.
// הרצה: node tests/studio-pt.test.js
const path = require('path');
const crypto = require('crypto');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const RL = require(path.join(root, 'ibkr-proxy/lib/relay.js'));
const sha1 = (t) => crypto.createHash('sha1').update(t, 'utf8').digest('hex');

(async () => {
  /* ---------- 1. התור ---------- */
  const hub = RL.createHub();
  const FX = 'הנחיה קבועה '.repeat(40), FH = sha1(FX);
  const base = { rid: 'r'.repeat(20), k: 'tl', m: 'claude-haiku-5-5', e: 'high', mt: 64000, fh: FH, ex: '', pr: 'בקשה' };
  hub.fix('jA', FH, FX); hub.fix('jB', FH, FX); hub.fix('jR', FH, FX);
  ok(hub.put('jA', base, true).st === 'q' && hub.put('jB', Object.assign({}, base, { rid: 's'.repeat(20) }), true).st === 'q', 'שתי עבודות שהשרת עונה להן');
  ok(hub.put('jR', Object.assign({}, base, { rid: 't'.repeat(20) })).st === 'q', 'ועבודה של Routine (בלי srv)');
  let nx = await hub.nextSrv([], 8, 0);
  ok(nx.reqs.length === 2 && nx.reqs.every((r) => r.job === 'jA' || r.job === 'jB') && nx.fx[FH] === FX, 'nextSrv: הבקשות מכל העבודות של השרת, עם מזהה העבודה — לא של ה־Routine');
  ok((await hub.next('jR', [], 4, 0)).reqs.length === 1, 'הבקשה של ה־Routine נשארת לו');
  ok(hub.peek('jA', base.rid).k === 'tl' && hub.peek('jA', base.rid).srv === true && hub.peek('jR', 't'.repeat(20)).srv === false, 'peek: השלב והמודל של הבקשה');
  const wt = hub.nextSrv([FH], 4, 3000);
  hub.put('jA', Object.assign({}, base, { rid: 'u'.repeat(20) }), true);
  nx = await wt;
  ok(nx.reqs.length === 1 && nx.reqs[0].rid === 'u'.repeat(20) && !(FH in nx.fx), 'עונה שמחכה מתעורר מבקשה חדשה; בלוק שכבר אצלו — לא נשלח שוב');
  ok((await hub.wait('jA', base.rid, 0)).idle >= 0, 'העובד רואה שהעונה מחובר (idle לא ‎-1)');

  /* ---------- 2. השרתון ---------- */
  const sa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const fb = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  Object.assign(process.env, {
    GDRIVE_SA_KEY: JSON.stringify({ client_email: 'sa@p.iam.gserviceaccount.com', private_key: sa.privateKey.export({ type: 'pkcs8', format: 'pem' }) }),
    LIBRARY_READERS: 'owner@example.com', SNB_RELAY_HUB_ON: '1',
    R2_ACCOUNT_ID: 'a'.repeat(32), R2_ACCESS_KEY_ID: 'k'.repeat(32), R2_SECRET_ACCESS_KEY: 's'.repeat(64), R2_BUCKET: 'snb-studio',
  });
  delete process.env.IBKR_VAULT_KEY;
  delete process.env.SNB_RELAY_HUB;
  const gauth = require(path.join(root, 'ibkr-proxy/lib/gauth.js'));
  const S = require(path.join(root, 'ibkr-proxy/lib/studio.js'));
  const studio = require(path.join(root, 'ibkr-proxy/api/studio.js'));
  gauth._reset(); studio._reset();
  const keys = { k1: fb.publicKey.export({ type: 'spki', format: 'pem' }) };
  const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const tnow = Math.floor(Date.now() / 1000);
  const hd = b64u({ alg: 'RS256', kid: 'k1' }), bd = b64u({ aud: 'yishaiguedj1-c786e', iss: 'https://securetoken.google.com/yishaiguedj1-c786e', sub: 'ownerUid0001', iat: tnow - 5, exp: tnow + 3000, email: 'owner@example.com', email_verified: true });
  const OWNER = hd + '.' + bd + '.' + crypto.sign('RSA-SHA256', Buffer.from(hd + '.' + bd), fb.privateKey).toString('base64url');

  const db = new Map();
  let utSeq = 0, NOW = Date.now();
  const J = (o, st = 200) => ({ status: st, ok: st < 300, json: async () => o, text: async () => JSON.stringify(o), headers: { get: () => null } });
  const fetchAll = async (url, opt = {}) => {
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
  const call = async (body, hdr) => {
    const res = { code: 0, j: null, setHeader() {}, status(c) { res.code = c; return res; }, json(o) { res.j = o; return res; }, end() { return res; } };
    const req = { method: 'POST', query: {}, body, headers: hdr || {}, socket: { remoteAddress: '9.9.9.9' } };
    await studio._handler(req, res, { verify: { keys }, fetch: fetchAll, now: NOW });
    return res;
  };
  const api = (op, b) => call(Object.assign({}, b, { op, idToken: OWNER }), { origin: 'https://yishaiguedj1.github.io' }).then((r) => r.j);

  const spec = { name: 'lecture.mp4', size: 1e6, type: 'video/mp4', dur: 600, from: 'en', to: ['he'], mode: 'haiku-high', eng: 'api', cap: 5, ph: 1, pw: 1, pt: 1 };
  ok(S.normSpec(spec).pt === 1, 'spec.pt נשמר (עם ph ו־pw, במפתח של המערכת)');
  ok(!('pt' in S.normSpec(Object.assign({}, spec, { pw: 0 }))) && !('pt' in S.normSpec(Object.assign({}, spec, { cp: 1 }))) && !('pt' in S.normSpec(Object.assign({}, spec, { ry: 1 }))),
    'pt רק עם pw, ולא עם העתק־הדבק או "המנוי שלי"');
  let j = await api('create', { spec });
  ok(j.ok && j.job.spec.pt === 1, 'עבודה שהטלפון מריץ — נוצרת');
  const JOB = j.job.id;
  const doc = () => db.get('studioJobs/' + JOB).fields;
  const PK = crypto.randomBytes(32).toString('base64url');
  const f = (id) => ({ stringValue: JSON.stringify({ id, size: 100, at: NOW }) });
  Object.assign(doc(), { pkh: { stringValue: S.keyHash(PK) }, pkx: { integerValue: String(NOW + 86400e3 * 3) }, fpw: f('R2_' + JOB + '_wwwwwwwwwwww'), fph: f('R2_' + JOB + '_mmmmmmmmmmmm') });
  const ph = (op, b) => call(Object.assign({ op, job: JOB, key: PK }, b));
  let r = await ph('phClaim');
  ok(r.code === 409 && r.j.error === 'state', 'phClaim לפני phStart — לא');
  r = await ph('phStart');
  ok(r.j.ok && r.j.state === 'queued' && doc().state.stringValue === 'queued', 'phStart: לתור (בלי Routine)');

  // שרת שמושך עבודות — מדלג על העבודה של הטלפון
  const SID = 'srv000000pt1', STOK = SID + '-' + crypto.randomBytes(32).toString('base64url');
  db.set('studioServers/' + SID, { fields: { th: { stringValue: S.keyHash(STOK) }, by: { stringValue: 'ownerUid0001' }, seen: { integerValue: String(NOW) } }, ut: 's0' });
  const srv = (op, b) => call(Object.assign({ op }, b), { authorization: 'Bearer ' + STOK });
  r = await srv('poll', { hb: { nj: 0 } });
  ok(r.j.ok && r.j.job === null && !doc().sid.stringValue, 'השרת לא לוקח עבודה שהטלפון מריץ');

  r = await ph('phClaim');
  const WK = r.j.job && r.j.job.key;
  ok(r.j.ok && r.j.job.id === JOB && S.KEY_RE.test(WK) && doc().sid.stringValue === 'ph' && Number(doc().capc.integerValue) === 500, 'phClaim: הטלפון לוקח — מפתח עבודה, התקרה לפי התקציב');
  const wcall = (op, b, key) => call(Object.assign({ op, job: JOB, key: key || WK }, b));
  r = await wcall('claim');
  ok(r.j.ok && r.j.job.rh === 'https://api.thesnowball.app' && doc().state.stringValue === 'running', 'הלקיחה של העובד (job.py run) — עם כתובת התור, העבודה "רצה"');
  r = await ph('phClaim');
  const WK2 = r.j.job && r.j.job.key;
  ok(r.j.ok && WK2 !== WK, 'Studio שהופעל מחדש לוקח שוב — מפתח חדש');
  ok((await wcall('claim', {}, WK)).code === 403, 'והמפתח הקודם מת');

  // העובד בטלפון שולח בקשה לתור
  const RID = 'x'.repeat(24);
  ok((await wcall('rlFix', { fh: FH, fx: FX }, WK2)).j.ok && (await wcall('rlPut', Object.assign({}, base, { rid: RID }), WK2)).j.st === 'q', 'הטלפון שולח בקשה לתור');
  ok((await wcall('rlNext', { max: 1, w: 0 }, WK2)).code === 403, 'מפתח העובד לא עונה לעצמו (rlNext)');
  r = await call({ op: 'ptNext', have: [], max: 4, w: 0 });
  ok(r.code === 401, 'ptNext בלי טוקן שרת — לא');
  r = await srv('ptNext', { have: [], max: 4, w: 0 });
  ok(r.j.ok && r.j.reqs.length === 1 && r.j.reqs[0].job === JOB && r.j.reqs[0].md === 'haiku-high' && r.j.fx[FH] === FX, 'השרת (טוקן שרת) מקבל את הבקשה, עם המצב של העבודה');
  ok((await srv('ptMark', { job: JOB, rid: RID, st: 's' })).j.ok && (await wcall('rlWait', { rid: RID, w: 0 }, WK2)).j.st === 's', 'Claude התחיל — הטלפון רואה');
  r = await srv('ptMark', { job: JOB, rid: RID, st: 'd', usd: 0.0125, ans: { t: 'תרגום', u: { i: 1000, o: 500, cr: 20000, c5: 0, c1: 0 }, st: 'end_turn', th: 3 } });
  ok(r.j.ok, 'התשובה נרשמת');
  r = await wcall('rlWait', { rid: RID, w: 0 }, WK2);
  ok(r.j.st === 'd' && r.j.ans.t === 'תרגום', 'והטלפון מקבל אותה');
  const use = JSON.parse(doc().use.stringValue);
  ok(use.length === 1 && use[0].k === 'tl' && use[0].m === 'claude-haiku-5-5' && use[0].i === 1000 && use[0].usd === 0.0125, 'העלות נרשמה בשרתון (job.use) מהתשובה עצמה');
  const mu = JSON.parse((db.get('studioStats/ownerUid0001').fields.mu || {}).stringValue || '{}');
  ok(JSON.stringify(mu).includes('0.01'), 'התקציב החודשי של המשתמש עלה');

  // דיווח מהטלפון עם עלות אחרת — לא משנה את העלות שנרשמה
  await wcall('report', { st: 'tl', p: 0.5, usage: [{ k: 'tl', m: 'claude-haiku-5-5', n: 1, i: 1, o: 1, cr: 0, c5: 0, c1: 0, usd: 0 }] }, WK2);
  ok(JSON.parse(doc().use.stringValue)[0].usd === 0.0125, 'עלות שהטלפון מדווח — לא נכנסת (השרתון סופר)');

  // התקרה נוצלה — הבקשה הבאה נענית budget_cap בלי לקרוא ל־Claude
  doc().capc = { integerValue: '1' };
  const RID2 = 'y'.repeat(24);
  await wcall('rlPut', Object.assign({}, base, { rid: RID2 }), WK2);
  r = await srv('ptNext', { have: [FH], max: 4, w: 0 });
  ok(r.j.ok && r.j.reqs.length === 0, 'התקרה נוצלה — הבקשה לא יוצאת לשרת');
  r = await wcall('rlWait', { rid: RID2, w: 0 }, WK2);
  ok(r.j.st === 'd' && r.j.ans.err === 'budget_cap', 'והטלפון מקבל budget_cap');

  // אחרי "המשך": use מתחיל מ־use0 (כמו בדיווח של העובד בשרת), והתקרה של ההפעלה נמדדת רק על הסשן הזה
  Object.assign(doc(), { use: { nullValue: null }, use0: { stringValue: JSON.stringify([{ k: 'tl', m: 'claude-haiku-5-5', n: 1, i: 1, o: 1, cr: 0, c5: 0, c1: 0, usd: 0.4 }]) }, capc: { integerValue: '10' } });
  const RID4 = 'w'.repeat(24);
  await wcall('rlPut', Object.assign({}, base, { rid: RID4 }), WK2);
  r = await srv('ptNext', { have: [FH], max: 4, w: 0 });
  ok(r.j.reqs.length === 1 && r.j.reqs[0].rid === RID4, '"המשך": מה שעלה בסשנים הקודמים (use0) לא נספר בתקרה של ההפעלה הזו');
  await srv('ptMark', { job: JOB, rid: RID4, st: 'd', usd: 0.02, ans: { t: 'x', u: { i: 1, o: 1 }, st: 'end_turn' } });
  const u4 = JSON.parse(doc().use.stringValue);
  ok(u4.length === 1 && u4[0].n === 2 && Math.abs(u4[0].usd - 0.42) < 1e-9, 'והעלות ממשיכה מ־use0 (כל הסשנים, כמו בדיווח מהשרת)');

  // עבודה שבוטלה — הבקשה לא יוצאת
  doc().capc = { integerValue: '500' };
  const RID3 = 'z'.repeat(24);
  await wcall('rlPut', Object.assign({}, base, { rid: RID3 }), WK2);
  doc().state = { stringValue: 'cancelled' };
  r = await srv('ptNext', { have: [FH], max: 4, w: 0 });
  ok(r.j.reqs.length === 0 && (await wcall('rlWait', { rid: RID3, w: 0 }, WK2)).j.ans.err === 'relay_stop', 'עבודה שבוטלה — relay_stop, בלי Claude');
  ok((await srv('ptMark', { job: JOB, rid: 'q'.repeat(24), st: 'd', ans: { t: 'x' } })).j.gone === true, 'תשובה לבקשה שלא קיימת — נבלעת');

  delete process.env.SNB_RELAY_HUB_ON;
  r = await srv('ptNext', { have: [], max: 1, w: 0 });
  ok(r.j.error === 'no_hub', 'בלי תור (Vercel) — no_hub');

  /* ---------- 3. החיווט: האתר, Studio לאנדרואיד והבנייה ---------- */
  const fs = require('fs');
  const rd = (f) => fs.readFileSync(path.join(root, f), 'utf8');
  const A = 'android/app/src/studio/java/io/github/yishaiguedj1/snowball/';
  const web = rd('studio.js'), core = rd(A + 'PhCore.kt'), act = rd(A + 'PhActivity.kt'), wk = rd(A + 'PhWork.kt'), py = rd(A + 'PhPy.kt'), gr = rd('android/app/build.gradle.kts');
  const st = await import(path.join(root, 'studio.js'));
  ok(Number((core.match(/const val CAP = (\d+)/) || [])[1]) === st.PH_CAP_PT && /\.put\("cap", CAP\)/.test(core), 'Studio מדווח את היכולת (CAP) = PH_CAP_PT באתר');
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  ok(st.parsePhPick('p' + 'a'.repeat(16) + '.' + b64({ pid: 'p' + 'a'.repeat(16), name: 'x.mp4', size: 9, cap: 3 })).cap === 3
    && st.parsePhPick('p' + 'a'.repeat(16) + '.' + b64({ pid: 'p' + 'a'.repeat(16), name: 'x.mp4', size: 9 })).cap === 0, 'הבחירה מהאפליקציה: cap (ישנה — 0)');
  ok(/else if \(spec\.pw && \(P\.cap \|\| 0\) >= PH_CAP_PT\) spec\.pt = 1/.test(web), 'האתר מבקש pt רק מ־Studio שיודע (אחרת העבודה הייתה מחכה לטלפון שלא לוקח)');
  ok(st.normJob({ id: 'j' + 'A'.repeat(20), spec: { ph: 1, pw: 1, pt: 1, mode: 'haiku-high' } }).spec.pt === 1 && !('pt' in st.normJob({ id: 'j' + 'A'.repeat(20), spec: { ph: 1, pt: 1 } }).spec), 'normJob שומר pt רק עם pw');
  ok(/rec\.spec\.pt \? \{ pt: 1 \}/.test(web) && /getQueryParameter\("pt"\) == "1"/.test(act) && /\.put\("pt", pt\)/.test(act), 'pt עובר מהאתר לאפליקציה ונשמר ברשומה');
  ok(/n\.call\("phClaim"/.test(wk) && /"run", "--job"/.test(wk) && /listOf\("-u", job, "auto"\)/.test(wk) && /worker_crash/.test(wk), 'PhWork: phClaim → job.py run → auto, וקריסה מדווחת');
  ok(/"SNB_PHONE" to "1"/.test(py) && /"VT_PY" to py\(ctx\)/.test(py) && /SecurityException\("zip"\)/.test(py), 'PhPy: מצב טלפון, vt באותו פייתון, פתיחת הארכיון בלי ../');
  ok(/class PtPack/.test(gr) && /addGeneratedSourceDirectory\(ptPack/.test(gr) && /exclude\("tests\/\*\*"/.test(gr) && /withFlavor\("app" to "studio"\)/.test(gr), 'הבנייה: translator.zip ל־Studio בלבד, בלי הבדיקות');
  const sx = (f) => rd('android/app/src/studio/res/' + f + '/strings.xml');
  for (const k of ['phText', 'phTextTr', 'phTextTl', 'phTextRv', 'phTextSv', 'phTextDone', 'phTextDoneS']) ok(sx('values').includes('name="' + k + '"') && sx('values-en').includes('name="' + k + '"'), 'מחרוזת ' + k + ' בעברית ובאנגלית');
  ok(rd('app.js').split('studioPhPtQ: "').length === 3, 'studioPhPtQ בעברית ובאנגלית');
  console.log('1..' + n);
})().catch((e) => { console.error(e); process.exit(1); });
