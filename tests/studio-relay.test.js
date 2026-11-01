// 24/10/2026: ההעברה — עבודת "המנוי שלי" רצה בשרת שלנו, ורק הקריאות ל־Claude עוברות דרך התור (lib/relay.js) ל־Routine.
// 1. התור עצמו (שעון מדומה)  2. השרתון האמיתי (api/studio.js, Firestore מדומה): הפעלה, מפתח נפרד, פעולות, תקציב, עצירה
// 3. הפרוטוקול בין השפות: translator/relay.py (העובד וה־Routine) מול התור האמיתי, בשרת HTTP מקומי.
// הרצה: node tests/studio-relay.test.js
const path = require('path');
const crypto = require('crypto');
const http = require('http');
const { spawnSync, spawn } = require('child_process');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const RL = require(path.join(root, 'ibkr-proxy/lib/relay.js'));
const sha1 = (t) => crypto.createHash('sha1').update(t, 'utf8').digest('hex');

(async () => {
  /* ---------- 1. התור ---------- */
  let T = 1e12;
  const hub = RL.createHub({ now: () => T });
  const FX = 'הנחיה קבועה '.repeat(50), FH = sha1(FX);
  const base = { rid: 'r'.repeat(20), k: 'tl', m: 'claude-haiku-5-5', e: 'high', mt: 64000, fh: FH, ex: 'הוראה', pr: 'בקשה' };
  ok(hub.put('j1', base).error === 'need_fixed', 'בקשה בלי הבלוק הקבוע — need_fixed');
  ok(hub.fix('j1', FH, FX + 'x').error === 'bad_params', 'בלוק שלא תואם לטביעה — נדחה (לא אפשר לשתול טקסט תחת טביעה אחרת)');
  ok(hub.fix('j1', FH, FX).ok && hub.put('j1', base).st === 'q', 'הבלוק נשמר פעם אחת, והבקשה נכנסת לתור');
  ok(hub.put('j1', base).st === 'q' && hub.stats().reqs === 1, 'אותה בקשה שוב (אותו rid) — לא נכפלת');
  ok(hub.put('j1', Object.assign({}, base, { rid: 'bad id!', m: 'gpt' })).error === 'bad_params', 'מזהה / מודל לא תקינים — נדחים');
  let nx = await hub.next('j1', [], 4, 0);
  ok(nx.reqs.length === 1 && nx.fx[FH] === FX && nx.reqs[0].pr === 'בקשה', 'ה־Routine מקבל את הבקשה ואת הבלוק הקבוע');
  hub.put('j1', Object.assign({}, base, { rid: 's'.repeat(20) }));
  nx = await hub.next('j1', [FH], 4, 0);
  ok(nx.reqs.length === 1 && !(FH in nx.fx), 'בלוק שכבר אצלו (have) — לא נשלח שוב');
  const w0 = hub.wait('j1', base.rid, 1000);
  ok(hub.mark('j1', base.rid, 's').ok, 'Claude התחיל לענות');
  ok((await w0).st === 's', 'העובד מתעורר מיד כש־Claude התחיל (לא אחרי ההמתנה)');
  const w1 = hub.wait('j1', base.rid, 1000);
  ok(hub.mark('j1', base.rid, 'd', { t: 'תשובה', u: { i: 10, o: 20, cr: 5000, c5: -3, c1: 'x' }, st: 'end_turn', th: 7 }).ok, 'התשובה נמסרת');
  let a = await w1;
  ok(a.st === 'd' && a.ans.t === 'תשובה' && a.ans.u.cr === 5000 && a.ans.u.c5 === 0 && a.ans.u.c1 === 0 && a.ans.th === 7, 'העובד מקבל את התשובה — שימוש במספרים תקינים בלבד');
  ok((await hub.wait('j1', base.rid, 0)).st === 'd', 'תשובה שאבדה בדרך — נמסרת שוב (בלי לשלם שוב)');
  T += 6 * 60e3; hub._gc();
  ok((await hub.wait('j1', base.rid, 0)).st === 'unknown', 'אחרי 5 דק׳ — יוצאת מהזיכרון');
  ok(hub.mark('j1', 's'.repeat(20), 'd', { err: 'Bad Code!' }).error === 'bad_params' && hub.mark('j1', 's'.repeat(20), 'd', { err: 'sub_limit' }).ok, 'קוד שגיאה — רק בצורה קבועה');
  ok((await hub.wait('j1', 's'.repeat(20), 0)).ans.err === 'sub_limit', 'שגיאה מה־Routine מגיעה לעובד');
  hub.put('j1', Object.assign({}, base, { rid: 't'.repeat(20) }));
  await hub.next('j1', [FH], 1, 0);
  T += 51 * 60e3; hub._gc();
  ok((await hub.next('j1', [FH], 1, 0)).reqs.length === 1, 'נלקחה ולא נענתה 50 דק׳ — חוזרת לתור (סשן שמת)');
  const idle = (await hub.wait('j1', 't'.repeat(20), 0)).idle;
  ok(idle === 0, 'העובד יודע כמה זמן ה־Routine לא שאל (idle)');
  const nw = hub.next('j1', [FH], 2, 5000);
  hub.end('j1', 'done');
  ok((await nw).end === 'done', 'סוף העבודה — ה־Routine שמחכה מתעורר ויוצא');
  ok(hub.put('j1', Object.assign({}, base, { rid: 'u'.repeat(20) })).error === 'ended', 'אחרי הסוף — אין בקשות חדשות');
  ok((await hub.wait('jX', 'v'.repeat(20), 0)).idle === -1, 'עבודה שה־Routine עוד לא התחבר אליה — idle = ‎-1');

  /* ---------- 2. השרתון ---------- */
  const sa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const fb = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  Object.assign(process.env, {
    GDRIVE_SA_KEY: JSON.stringify({ client_email: 'sa@p.iam.gserviceaccount.com', private_key: sa.privateKey.export({ type: 'pkcs8', format: 'pem' }) }),
    LIBRARY_READERS: 'owner@example.com', SNB_RELAY_HUB_ON: '1',
  });
  delete process.env.IBKR_VAULT_KEY;
  delete process.env.SNB_RELAY_HUB;
  const gauth = require(path.join(root, 'ibkr-proxy/lib/gauth.js'));
  const vault = require(path.join(root, 'ibkr-proxy/lib/vault.js'));
  const S = require(path.join(root, 'ibkr-proxy/lib/studio.js'));
  const studio = require(path.join(root, 'ibkr-proxy/api/studio.js'));
  gauth._reset(); studio._reset();
  const keys = { k1: fb.publicKey.export({ type: 'spki', format: 'pem' }) };
  const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const tnow = Math.floor(Date.now() / 1000);
  const hd = b64u({ alg: 'RS256', kid: 'k1' }), bd = b64u({ aud: 'yishaiguedj1-c786e', iss: 'https://securetoken.google.com/yishaiguedj1-c786e', sub: 'ownerUid0001', iat: tnow - 5, exp: tnow + 3000, email: 'owner@example.com', email_verified: true });
  const OWNER = hd + '.' + bd + '.' + crypto.sign('RSA-SHA256', Buffer.from(hd + '.' + bd), fb.privateKey).toString('base64url');

  const db = new Map();
  let utSeq = 0, NOW = Date.now(), fires = [], fireStatus = 200, jobReads = 0;
  const J = (o, st = 200) => ({ status: st, ok: st < 300, json: async () => o, text: async () => JSON.stringify(o), headers: { get: () => null } });
  const fetchAll = async (url, opt = {}) => {
    if (url.includes('/claude_code/routines/')) { fires.push(JSON.parse(opt.body).text); return J(fireStatus === 200 ? { claude_code_session_id: 'cse_01ABC', claude_code_session_url: 'https://claude.ai/code/session_01ABC' } : { error: { type: 'authentication_error' } }, fireStatus); }
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
    if ((opt.method || 'GET') === 'GET') { if (m[1] === 'studioJobs') jobReads++; return cur ? J({ fields: cur.fields, updateTime: cur.ut }) : J({}, 404); }
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
  const call = async (body, worker) => {
    const res = { code: 0, j: null, setHeader() {}, status(c) { res.code = c; return res; }, json(o) { res.j = o; return res; }, end() { return res; } };
    const req = { method: 'POST', query: {}, body, headers: worker ? {} : { origin: 'https://yishaiguedj1.github.io' }, socket: { remoteAddress: '9.9.9.9' } };
    await studio._handler(req, res, { verify: { keys }, fetch: fetchAll, now: NOW });
    return res;
  };
  const api = (op, b) => call(Object.assign({}, b, { op, idToken: OWNER })).then((r) => r.j);
  const RURL = 'https://api.anthropic.com/v1/claude_code/routines/trig_01ABCDEFGHJKLMNOPQRSTUVW/fire';
  db.set('studioVault/ownerUid0001', { fields: { r: { stringValue: vault.seal({ u: RURL, k: 'sk-ant-oat01-' + 'Q'.repeat(60) }, 'studio|ownerUid0001|r') } }, ut: 'v0' });

  const spec = { name: 'lecture.mp4', size: 1e6, type: 'video/mp4', dur: 600, from: 'en', to: ['he'], mode: 'haiku-high', out: ['same'], eng: 'api', cap: 5, ry: 1 };
  let j = await api('create', { spec });
  ok(j.ok && j.job.spec.ry === 1 && j.job.spec.eng === 'api', 'עבודת "המנוי שלי" דרך השרת — נשמרת (ry)');
  ok(S.normSpec(Object.assign({}, spec, { cp: 1 })).cp === 1 && !S.normSpec(Object.assign({}, spec, { cp: 1 })).ry, 'העתק־הדבק גובר — לא שני מסלולים יחד');
  const JOB = j.job.id;
  const doc = () => db.get('studioJobs/' + JOB).fields;
  doc().fa = { stringValue: JSON.stringify({ id: 'a'.repeat(28), size: 100 }) };

  fireStatus = 401;
  j = await api('start', { job: JOB });
  ok(!j.ok && j.job.state === 'new' && fires.length === 1 && !doc().rkh.stringValue, 'הפעלת ה־Routine נכשלה בוודאות — העבודה לא נכנסת לתור, המפתח נמחק');
  fireStatus = 200; fires = [];
  j = await api('start', { job: JOB });
  ok(j.ok && j.job.state === 'queued' && j.job.ry === 1 && j.job.rc === 0, 'הפעלה: העבודה בתור של השרת, ה־Routine הופעל');
  const RK = (fires[0].match(/key=([A-Za-z0-9_-]{43})/) || [])[1];
  ok(fires.length === 1 && RK && fires[0].includes('job=' + JOB) && doc().rkh.stringValue === S.keyHash(RK) && !doc().kh.stringValue, 'ל־Routine מפתח משלו (rkh) — לא מפתח העובד');

  const rcall = (op, b, key) => call(Object.assign({ op, job: JOB, key }, b), true);
  let r = await rcall('claim', {}, RK);
  ok(r.j.ok && r.j.relay === true && r.j.hub === 'https://api.thesnowball.app' && !r.j.job.spec && !r.j.drive, 'ה־Routine לוקח: רק כתובת התור (בלי קבצים, בלי Drive)');
  ok(Number(doc().rcl.integerValue) === NOW, 'נרשם מתי ה־Routine התחבר');
  ok((await rcall('report', { st: 'tr', p: 0.5 }, RK)).code === 403 && (await rcall('token', {}, RK)).code === 403, 'מפתח ה־Routine לא מדווח ולא מקבל גישה לקבצים');

  const WK = crypto.randomBytes(32).toString('base64url');
  Object.assign(doc(), { kh: { stringValue: S.keyHash(WK) }, kx: { integerValue: String(NOW + 3600e3) }, state: { stringValue: 'running' }, sid: { stringValue: 'srv000000001' } });
  r = await rcall('claim', {}, WK);
  ok(r.j.ok && r.j.job.rh === 'https://api.thesnowball.app', 'העובד בשרת לוקח — ומקבל את כתובת התור (rh)');
  ok((await rcall('rlNext', { max: 1, w: 0 }, WK)).code === 403 && (await rcall('rlPut', base, RK)).code === 403, 'כל מפתח — רק הפעולות שלו (העובד שולח, ה־Routine עונה)');

  jobReads = 0;
  const RID = 'x'.repeat(24);
  r = await rcall('rlPut', Object.assign({}, base, { rid: RID }), WK);
  ok(r.j.error === 'need_fixed', 'העובד שולח בקשה — התור מבקש את הבלוק הקבוע');
  ok((await rcall('rlFix', { fh: FH, fx: FX }, WK)).j.ok && (await rcall('rlPut', Object.assign({}, base, { rid: RID }), WK)).j.st === 'q', 'הבלוק נשלח בנפרד, והבקשה בתור');
  r = await rcall('rlNext', { have: [], max: 4, w: 0 }, RK);
  ok(r.j.ok && r.j.reqs.length === 1 && r.j.reqs[0].rid === RID && r.j.fx[FH] === FX, 'ה־Routine מקבל את הבקשה');
  await rcall('rlMark', { rid: RID, st: 's' }, RK);
  ok((await rcall('rlWait', { rid: RID, w: 0 }, WK)).j.st === 's', 'העובד רואה ש־Claude התחיל');
  await rcall('rlMark', { rid: RID, st: 'd', ans: { t: 'שלום', u: { i: 1, o: 2, cr: 3, c5: 4, c1: 0 }, st: 'end_turn' } }, RK);
  r = await rcall('rlWait', { rid: RID, w: 0 }, WK);
  ok(r.j.st === 'd' && r.j.ans.t === 'שלום', 'התשובה מגיעה לעובד');
  ok(jobReads <= 2, 'אימות בזיכרון — לא קריאה ל־Firestore בכל פעולה (' + jobReads + ' קריאות ל־8 פעולות)');

  // התקציב החודשי של המערכת — לא נוגעים (המנוי של המשתמש)
  await rcall('report', { st: 'tr', p: 0.5, usage: [{ k: 'tl', m: 'claude-haiku-5-5', in: 100, out: 100, cr: 0, cw: 0, usd: 0.5 }] }, WK);
  ok(!doc().mucc || Number(doc().mucc.integerValue) === 0, 'עלות עבודת המנוי לא נספרת בתקציב החודשי של המערכת');
  ok(S.jobCap({ eng: 'api', ry: 1, cap: 5 }, 999, 30, 1) === 4 && S.jobCap({ eng: 'api', cap: 5 }, 999, 30, 0) === 0, 'התקרה של עבודת המנוי = התקרה שלך (בלי התקציב החודשי)');

  // העבודה בוטלה — אחרי שהאימות שבזיכרון פג, שני הצדדים מקבלים "עצור" והתור נסגר
  doc().state = { stringValue: 'cancelled' };
  NOW += 120e3;
  r = await rcall('rlNext', { max: 1, w: 0 }, RK);
  ok(r.j.stop === true && r.j.state === 'cancelled', 'עבודה שבוטלה — ה־Routine מקבל "עצור"');
  ok((await rcall('rlWait', { rid: RID, w: 0 }, WK)).j.stop === true, 'וגם העובד');

  delete process.env.SNB_RELAY_HUB_ON;
  r = await rcall('rlNext', { max: 1, w: 0 }, RK);
  ok(r.code === 503 && r.j.error === 'no_hub' && r.j.hub === 'https://api.thesnowball.app', 'בלי תור (Vercel) — 503 עם הכתובת הנכונה');
  process.env.SNB_RELAY_HUB_ON = '1';

  /* ---------- 2ב. הטלפון ---------- */
  const fs = require('fs');
  const src = fs.readFileSync(path.join(root, 'studio.js'), 'utf8'), app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const fnOf = (name) => new Function(src.match(new RegExp('export const ' + name + ' = [^\\n]+'))[0].replace(/^export /, '') + '\nreturn ' + name + ';')();
  const ryOn = fnOf('ryOn'), ryWaiting = fnOf('ryWaiting');
  ok(ryOn('sub', { servers: 1 }) && !ryOn('sub', { servers: 0 }) && !ryOn('sub', null) && !ryOn('api', { servers: 1 }) && !ryOn('copy', { servers: 1 }), 'המנוי שלי + יש שרת = דרך השרת; בלי שרת — רק ה־Routine כמו קודם');
  const T0 = 1e12;
  ok(ryWaiting({ srv: { ry: true, rc: 0, fired: T0 } }, T0 + 121e3) && !ryWaiting({ srv: { ry: true, rc: T0, fired: T0 } }, T0 + 121e3)
    && !ryWaiting({ srv: { ry: true, rc: 0, fired: T0 } }, T0 + 60e3) && !ryWaiting({ srv: { ry: false, rc: 0, fired: T0 } }, T0 + 1e6), 'הודעה רק כשה־Routine לא התחבר אחרי 2 דק׳');
  ok((src.match(/else if \(ryMode\(\)\)/g) || []).length === 4 && /else if \(ryMode\(\)\) spec\.ry = 1/.test(src), 'כל המסלולים (קובץ, כתוביות, קישור, ובשורה אחת תרגום בטלפון והעלאה דרך האפליקציה) — ry במנוי');
  ok(/const hosts = Array\.from\(new Set\(\[host, hub\]\)\)/.test(src), 'אשף החיבור: כתובת התור ברשימת הכתובות של הסביבה');
  for (const k of ['studioNowRyWait', 'studioErrRyNone', 'studioErrRyLost', 'studioErrRy']) ok(app.split(k + ': "').length === 3, 'מחרוזת ' + k + ' בעברית ובאנגלית');
  for (const c of ['relay_none', 'relay_lost', 'relay_hub']) ok(new RegExp("case '" + c + "'").test(src), 'טקסט בטלפון לקוד ' + c);

  /* ---------- 3. הפרוטוקול: relay.py מול התור האמיתי ---------- */
  const py = spawnSync('python3', ['-c', 'print(1)']);
  if (py.status !== 0) { console.log('# אין python3 — מדלג על חלק 3'); console.log('1..' + n); return; }
  const h2 = RL.createHub();
  const srv = http.createServer((req, res) => {
    let b = '';
    req.on('data', (c) => { b += c; });
    req.on('end', async () => {
      const o = JSON.parse(b || '{}'), id = o.job;
      let out;
      if (o.op === 'rlPut') out = h2.put(id, o);
      else if (o.op === 'rlFix') out = h2.fix(id, o.fh, o.fx);
      else if (o.op === 'rlWait') out = await h2.wait(id, o.rid, Math.min(o.w, 2000));
      else if (o.op === 'rlEnd') out = h2.end(id, o.why);
      else if (o.op === 'rlNext') out = await h2.next(id, o.have, o.max, Math.min(o.w, 2000));
      else if (o.op === 'rlMark') out = h2.mark(id, o.rid, o.st, o.ans);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(out || { ok: false }));
    });
  });
  await new Promise((ok2) => srv.listen(0, '127.0.0.1', ok2));
  const URL0 = 'http://127.0.0.1:' + srv.address().port;
  const KEY = 'k'.repeat(43), JID = 'j' + 'A'.repeat(20);
  // ה־Routine: לולאה שעונה (runner מדומה — מחזיר את אורך הבקשה, ושגיאה לבקשה שמבקשת אותה)
  const routine = spawn('python3', ['-I', '-c', [
    'import sys; sys.path.insert(0, sys.argv[1]); import relay',
    'def run(r, fx, started):',
    '    started()',
    "    if 'ERR' in r['pr']: return {'err': 'sub_limit'}",
    "    return {'t': 'ok:%d:%d' % (len(fx), len(r['pr'])), 'u': {'i': 1, 'o': 2, 'cr': 3, 'c5': 0, 'c1': 0}, 'st': 'end_turn', 'th': 5}",
    'sys.exit(relay.serve(sys.argv[2], sys.argv[3], sys.argv[4], run, par=3, log=lambda m: print(m, flush=True)))',
  ].join('\n'), path.join(root, 'translator'), URL0, JID, KEY], { stdio: ['ignore', 'pipe', 'pipe'] });
  const rexit = new Promise((done) => routine.on('exit', done));   // מיד — הוא יכול לצאת לפני שהעובד מסיים
  let rout = '';
  routine.stdout.on('data', (c) => { rout += c; });
  routine.stderr.on('data', (c) => { rout += c; });
  // העובד: 5 בקשות במקביל, אחת מהן נכשלת, ואז סוף
  // async (לא spawnSync): התור רץ בתהליך הזה — המתנה סינכרונית הייתה חוסמת אותו
  const runPy = (args, ms) => new Promise((done) => {
    const p = spawn('python3', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let so = '', se = '';
    p.stdout.on('data', (c) => { so += c; }); p.stderr.on('data', (c) => { se += c; });
    const t = setTimeout(() => { console.error('# timeout', so, se, rout); p.kill(); }, ms);
    p.on('exit', (code) => { clearTimeout(t); done({ status: code, stdout: so, stderr: se }); });
  });
  const w = await runPy(['-I', '-c', [
    'import sys, json, threading; sys.path.insert(0, sys.argv[1]); import relay',
    'out = {}; fixed = "קבוע " * 2000',
    'def one(i):',
    '    st = []',
    "    try: a = relay.call(sys.argv[2], sys.argv[3], sys.argv[4], k='tl', model='claude-haiku-5-5', effort='high', max_tokens=1000, fixed=fixed, extra='', prompt=('ERR' if i == 3 else 'p' * i), on_first_token=lambda: st.append(1))",
    "    except relay.RelayError as e: a = {'code': e.code}",
    "    a['s'] = len(st); out[i] = a",
    'ts = [threading.Thread(target=one, args=(i,)) for i in range(5)]',
    '[t.start() for t in ts]; [t.join() for t in ts]',
    "relay.end(sys.argv[2], sys.argv[3], sys.argv[4])",
    'print(json.dumps(out))',
  ].join('\n'), path.join(root, 'translator'), URL0, JID, KEY], 60000);
  const res = JSON.parse((w.stdout || '').trim().split('\n').pop() || '{}');
  if (w.status !== 0 || !res[0]) console.error(w.stdout, w.stderr, rout);
  ok(w.status === 0 && res[0] && res[0].t === 'ok:10000:0' && res[4].t === 'ok:10000:4', 'העובד (relay.call) מקבל תשובות מה־Routine (relay.serve), דרך התור האמיתי');
  ok(res[1].s === 1 && res[2].s === 1, 'on_first_token נקרא כש־Claude התחיל (המטמון נכתב)');
  ok(res[3].err === 'sub_limit', 'שגיאה ב־Routine — מגיעה לעובד כקוד');
  const rc = await rexit;
  ok(rc === 0 && /5 קריאות/.test(rout), 'ה־Routine יוצא כשהעבודה נגמרת (התור אמר "סוף")');
  // בלי Routine בכלל — relay_none אחרי FIRST_WAIT
  const w2 = await runPy(['-I', '-c', [
    'import sys; sys.path.insert(0, sys.argv[1]); import os; os.environ["SNB_RELAY_FIRST"] = "1"',
    'import relay; relay.WAIT_MS = 200; relay.FIRST_WAIT = 1',
    "try: relay.call(sys.argv[2], 'j' + 'B' * 20, sys.argv[3], k='tl', model='claude-haiku-5-5', effort='high', max_tokens=10, fixed='x', extra='', prompt='p')",
    'except relay.RelayError as e: print(e.code)',
  ].join('\n'), path.join(root, 'translator'), URL0, KEY], 30000);
  ok((w2.stdout || '').trim() === 'relay_none', 'ה־Routine לא התחבר — relay_none (לא תקיעה לנצח)');
  srv.close();
  console.log('1..' + n);
})().catch((e) => { console.error(e); process.exit(1); });
