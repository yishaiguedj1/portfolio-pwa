/* סטודיו התרגום — POST /api/studio (v355, שלב 2 מתוך התוכנית). הפונקציה ה־12, האחרונה ב־Vercel Hobby:
   יכולת נוספת לסטודיו בשרתון = op חדש כאן, לא קובץ חדש.
   מהטלפון (Origin מאושר + התחברות Firebase מאומתת + משתמש מורשה: המנהל או STUDIO_USERS):
     status → החיבור ל־Claude (רק "trig_…ab12", לעולם לא המפתח), Drive, ומה העובד בענן יודע לבצע
     connect { url, key } → בדיקת צורה + שמירה מוצפנת בכספת · disconnect → מחיקה מהכספת
     test → עבודת "בדיקת חיבור" + הפעלת ה־Routine (פעם בדקה לכל היותר). בלי חיבור ל־Claude: conn_missing (not_connected = Drive)
     drive → גישה זמנית ל־Drive (שעה) להעלאה מהטלפון
     gdConfig (בלי התחברות) · gdConnect · gdStatus · gdToken · gdDisconnect → חיבור Drive של הסטודיו (v357: לקוח OAuth נפרד, studioDrive/{uid})
     create { spec } · file { job, which: a|v, id, folder } · start { job } · jobs · job { job } · cancel { job } · remove { job }
   מהעובד בענן (שרת לשרת, בלי Origin; מזוהה רק במפתח העבודה):
     claim { job, key } → פרטי העבודה + גישה ל־Drive לשעה · token { job, key } → גישה חדשה · report { job, key, st, p, ... } → התקדמות
   מצב העבודות ב־Firestore (studioJobs/{id}, studioVault/{uid}) דרך חשבון השירות — הטלפון לא קורא משם ישירות.
   הפעלת Routine: אין מפתח למניעת כפילות, ולכן לעולם לא מנסים שוב לבד — אחרת ייפתחו שני סשנים. */
const { guard } = require('../lib/ibkr');
const { verifyIdToken, datastoreToken, isAdmin, emails } = require('../lib/gauth');
const vault = require('../lib/vault');
const gdrive = require('../lib/gdrive').studio;   // v357: לקוח OAuth נפרד לסטודיו — לא רואה את גיבוי הספרייה
const S = require('../lib/studio');

const PROJECT = () => process.env.FIREBASE_PROJECT_ID || 'yishaiguedj1-c786e';
const BASE = () => 'https://firestore.googleapis.com/v1/projects/' + PROJECT() + '/databases/(default)/documents';
const DRIVE = 'https://www.googleapis.com/drive/v3/files/';
const UID_RE = /^[A-Za-z0-9]{6,128}$/;
const AAD = (uid) => 'studio|' + uid + '|r';
const WORKER_OPS = new Set(['claim', 'token', 'report']);
const FIRE_TIMEOUT = 20000;

const hits = new Map();
function limited(key, max) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < 60000);
  arr.push(now); hits.set(key, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > max;
}
const allowed = (u) => isAdmin(u) || (u.verified && emails(process.env.STUDIO_USERS).includes(u.email));

/* ---------- Firestore ---------- */
async function fsCall(deps, method, path, body) {
  const tk = await datastoreToken(deps.fetch);
  const r = await (deps.fetch || fetch)(BASE() + path, { method, headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch (e) {}
  return { status: r.status, j };
}
async function readDoc(deps, col, id) {
  const r = await fsCall(deps, 'GET', '/' + col + '/' + id);
  if (r.status === 404) return null;
  if (r.status !== 200) throw new Error('fs_http_' + r.status);
  return Object.assign(S.fromFields(r.j && r.j.fields), { id });
}
/* כתיבה חלקית (updateMask) — הטלפון והעובד כותבים שדות שונים באותו מסמך בלי לדרוס זה את זה */
async function patchDoc(deps, col, id, obj) {
  const keys = Object.keys(obj).filter((k) => obj[k] !== undefined && k !== 'id');
  const q = keys.map((k) => 'updateMask.fieldPaths=' + k).join('&');
  const r = await fsCall(deps, 'PATCH', '/' + col + '/' + id + '?' + q, { fields: S.toFields(obj) });
  if (r.status !== 200) throw new Error('fs_http_' + r.status);
}
async function delDoc(deps, col, id) {
  const r = await fsCall(deps, 'DELETE', '/' + col + '/' + id);
  if (r.status !== 200 && r.status !== 404) throw new Error('fs_http_' + r.status);
}
/* העבודות של משתמש — שאילתה עם שוויון אחד (אינדקס אוטומטי, בלי הגדרה ב־Firebase) */
async function listJobs(deps, uid) {
  const r = await fsCall(deps, 'POST', ':runQuery', { structuredQuery: { from: [{ collectionId: 'studioJobs' }],
    where: { fieldFilter: { field: { fieldPath: 'uid' }, op: 'EQUAL', value: { stringValue: uid } } }, limit: 300 } });
  if (r.status !== 200) throw new Error('fs_http_' + r.status);
  return (Array.isArray(r.j) ? r.j : []).filter((x) => x && x.document && x.document.name)
    .map((x) => Object.assign(S.fromFields(x.document.fields), { id: String(x.document.name).split('/').pop() }))
    .sort((a, b) => (b.created || 0) - (a.created || 0));
}
const readJob = (deps, id) => readDoc(deps, 'studioJobs', id);
const patchJob = (deps, id, o) => patchDoc(deps, 'studioJobs', id, o);
const readVault = (deps, uid) => readDoc(deps, 'studioVault', uid);
const patchVault = (deps, uid, o) => patchDoc(deps, 'studioVault', uid, o);

/* ---------- הפעלת ה־Routine ---------- */
async function fire(deps, v, uid, text) {
  const conn = vault.open(v && v.r, AAD(uid));
  if (!conn || !conn.u || !conn.k) return { ok: false, error: 'conn_missing' };
  const ac = typeof AbortController === 'function' ? new AbortController() : null;
  const to = ac ? setTimeout(() => ac.abort(), FIRE_TIMEOUT) : 0;
  try {
    const r = await (deps.fetch || fetch)(conn.u, { method: 'POST', signal: ac ? ac.signal : undefined,
      headers: { Authorization: 'Bearer ' + conn.k, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }) });
    let j = null; try { j = await r.json(); } catch (e) {}
    const hdr = (k) => (r.headers && typeof r.headers.get === 'function' ? r.headers.get(k) : null);
    // התיעוד: הבקשה חוזרת רק אחרי שהסשן נפתח — כל 2xx = Claude נפתח, גם כשמבנה התשובה לא מוכר (ממשק ניסיוני).
    // עד התיקון: מזהה cse_ לא זוהה → "נכשל" והמפתח נמחק, וה־Claude שכבר נפתח נדחה ב־bad_key (קרה אצל המשתמש)
    if (r.status >= 200 && r.status < 300) return { ok: true, sess: S.fireSession(j) };
    const ra = parseInt(hdr('retry-after') || '', 10);
    return { ok: false, error: S.fireError(r.status, j), retry: Number.isFinite(ra) ? Math.min(ra, 7200) : undefined,
      detail: S.fireDetail(r.status, j, hdr('request-id')) };   // v356: לאבחון — מוצג בטלפון ("פרטים לתמיכה")
  } catch (e) {
    // ייתכן שהבקשה הגיעה — לא מנסים שוב לבד
    return { ok: false, error: 'routine_net', detail: String((e && e.name) || 'Error').replace(/[^A-Za-z]/g, '').slice(0, 30) };
  } finally { clearTimeout(to); }
}
/* מפתח חדש → נשמר לפני ההפעלה (העובד יכול להגיע מהר) → הפעלה → הסשן נשמר; כשל ודאי = חוזרים למצב הקודם */
const UNSURE = ['routine_down', 'routine_net'];
async function fireJob(deps, uid, v, job, now) {
  const key = S.newKey();
  const fh = S.recentFires(v.fh, now);
  await patchJob(deps, job.id, { state: 'queued', kh: S.keyHash(key), kx: now + S.KEY_TTL, fired: now, fires: (job.fires || 0) + 1, err: '', ed: '', warn: '', updated: now });
  const f = await fire(deps, v, uid, S.fireText(job.id, key));
  if (!f.ok && UNSURE.includes(f.error)) {
    // v356: 5xx או תקלת רשת — ייתכן שהסשן כבר נפתח (קרה אצל המשתמש: "לא זמין", והסשן הגיע ונדחה ב־bad_key).
    // לא מבטלים: המפתח נשאר בתוקף והעבודה ממתינה. נלקחה — ממשיכה כרגיל; לא נלקחה בזמן — נכשלת עם השגיאה של Anthropic (effState)
    await patchJob(deps, job.id, { warn: f.error, ed: f.detail || '', updated: now });
    await patchVault(deps, uid, { tt: now, fh: fh.concat(now) });   // ייתכן שנפתח סשן — נספר בתקציב
    return { ok: true, unsure: f.error, detail: f.detail || '' };
  }
  if (!f.ok) {
    const back = job.kind === 'ping' ? { state: 'failed', err: f.error, ended: now, kh: '' } : { state: 'new', err: f.error, kh: '', fired: job.fired || 0 };
    await patchJob(deps, job.id, Object.assign(back, { ed: f.detail || '', updated: now }));
    if (f.error !== 'routine_net') await patchVault(deps, uid, { tt: now });
    return f;
  }
  await patchJob(deps, job.id, { sess: f.sess, updated: now });
  await patchVault(deps, uid, { tt: now, fh: fh.concat(now) });
  return f;
}

/* ---------- העובד בענן ---------- */
async function worker(req, res, body, deps) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
  let len = 0; try { len = JSON.stringify(body).length; } catch (e) { len = 1e9; }
  if (len > 16384) return res.status(413).json({ ok: false, error: 'too_large' });
  const id = String(body.job || ''), key = String(body.key || '');
  if (!S.JOB_RE.test(id) || !S.KEY_RE.test(key)) return res.status(400).json({ ok: false, error: 'bad_params' });
  if (limited('w|' + id, 90)) return res.status(429).json({ ok: false, error: 'rate_limited' });
  const now = deps.now || Date.now();
  try {
    const job = await readJob(deps, id);
    if (!job || !S.keyMatches(job, key) || now > (job.kx || 0)) return res.status(403).json({ ok: false, error: 'bad_key', stop: true });
    const e = S.effState(job, now);
    if (S.FINAL.includes(e.state)) return res.status(200).json({ ok: false, stop: true, state: e.state });
    const driveFor = async () => {
      const t = await gdrive.accessToken(deps, job.uid).catch(() => ({ ok: false, error: 'gd_failed' }));
      return t.ok ? { token: t.token, exp: t.exp } : { error: t.error };
    };
    if (body.op === 'claim') {
      const patch = { updated: now };
      if (job.state === 'queued') { patch.state = 'running'; patch.claimed = now; patch.warn = ''; job.state = 'running'; }
      await patchJob(deps, id, patch);
      return res.status(200).json({ ok: true, job: S.workerJob(job), drive: await driveFor(), now });
    }
    if (body.op === 'token') return res.status(200).json({ ok: true, drive: await driveFor(), now });
    // report
    const up = S.applyReport(job, body, now);
    if (body.out != null) {
      // v358: תוצרים — כל קובץ חייב להיות בתיקיית העבודה ב־Drive (הלקוח של הסטודיו רואה רק מה שהאפליקציה יצרה)
      const outs = S.normOut(body.out);
      if (!outs || !job.folder) return res.status(400).json({ ok: false, error: 'out_bad' });
      const t = await gdrive.accessToken(deps, job.uid);
      if (!t.ok) return res.status(200).json({ ok: false, error: t.error });
      for (const o of outs) {
        const r = await (deps.fetch || fetch)(DRIVE + o.id + '?fields=id,size,parents,trashed', { headers: { Authorization: 'Bearer ' + t.token } });
        let meta = null; try { meta = await r.json(); } catch (e) {}
        if (r.status !== 200 || !meta || meta.trashed || !(Array.isArray(meta.parents) && meta.parents.includes(job.folder))) return res.status(400).json({ ok: false, error: 'out_bad' });
        o.size = Math.floor(Number(meta.size) || o.size);
      }
      up.fo = outs;
    }
    if (job.state === 'queued') { up.state = up.state || 'running'; up.claimed = now; up.warn = ''; }
    await patchJob(deps, id, up);
    if (job.kind === 'ping' && up.state === 'done') await patchVault(deps, job.uid, { ok: now, okj: id }).catch(() => {});
    return res.status(200).json({ ok: true, stop: false, state: up.state || job.state });
  } catch (err) {
    return res.status(502).json({ ok: false, error: /^(fs_http_|sa_http_)/.test(String(err.message)) ? String(err.message).slice(0, 30) : 'failed' });
  }
}

/* ---------- הטלפון ---------- */
async function handler(req, res, deps = {}) {
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};
  if (WORKER_OPS.has(String(body.op || ''))) return worker(req, res, body, deps);
  if (guard(req, res)) return;
  if (body.op === 'gdConfig') return res.status(200).json({ ok: true, clientId: gdrive.cfg().id, configured: gdrive.configured() });   // המזהה ציבורי
  let user;
  try { user = await verifyIdToken(body.idToken, deps.verify || {}); } catch (e) { return res.status(401).json({ ok: false, error: 'no_auth' }); }
  if (!UID_RE.test(String(user.uid || ''))) return res.status(401).json({ ok: false, error: 'no_auth' });
  if (!allowed(user)) return res.status(403).json({ ok: false, error: 'not_allowed' });
  if (limited('p|' + user.uid, 120)) return res.status(429).json({ ok: false, error: 'rate_limited' });
  if (!vault.configured()) return res.status(503).json({ ok: false, error: 'vault_not_configured' });
  const uid = user.uid, op = String(body.op || ''), now = deps.now || Date.now();
  // v357: חיבור Drive של הסטודיו (חלון ההסכמה של Google — אותו מנגנון של גיבוי הספרייה, לקוח אחר)
  if (op === 'gdConnect' || op === 'gdStatus' || op === 'gdToken' || op === 'gdDisconnect') return gdrive.handle(body, user, res, deps);
  const mine = async (id) => {
    if (!S.JOB_RE.test(String(id || ''))) return null;
    const j = await readJob(deps, id);
    return j && j.uid === uid ? j : null;
  };
  const view = (j) => S.publicJob(j, now);
  try {
    if (op === 'status') {
      const v = await readVault(deps, uid);
      const d = await gdrive.driveState(deps, uid).catch(() => ({ configured: gdrive.configured(), connected: false, email: '' }));
      return res.status(200).json({ ok: true, conn: v && v.r ? { hint: v.hint || '', since: v.since || 0, ok: v.ok || 0 } : null,
        drive: { configured: d.configured, connected: d.connected, email: d.email }, kinds: S.WORKER_KINDS.slice(), now });
    }
    if (op === 'connect') {
      const c = S.normRoutine(body.url, body.key);
      if (c.error) return res.status(400).json({ ok: false, error: c.error });
      const hint = S.hintOf(c.trig);
      await patchVault(deps, uid, { r: vault.seal({ u: c.u, k: c.k }, AAD(uid)), hint, since: now, ok: 0, okj: '', at: now });
      return res.status(200).json({ ok: true, conn: { hint, since: now, ok: 0 } });
    }
    if (op === 'disconnect') {
      await delDoc(deps, 'studioVault', uid);
      return res.status(200).json({ ok: true });
    }
    if (op === 'drive') {
      const t = await gdrive.accessToken(deps, uid);
      if (!t.ok) return res.status(/^gd_http_/.test(t.error) ? 502 : 200).json({ ok: false, error: t.error });
      return res.status(200).json({ ok: true, token: t.token, exp: t.exp, email: t.email });
    }
    if (op === 'test') {
      const v = await readVault(deps, uid);
      if (!v || !v.r) return res.status(200).json({ ok: false, error: 'conn_missing' });
      if (v.tt && now - v.tt < S.TEST_GAP) return res.status(429).json({ ok: false, error: 'wait', retry: Math.ceil((S.TEST_GAP - (now - v.tt)) / 1000) });
      if (S.recentFires(v.fh, now).length >= S.FIRE_HOUR) return res.status(429).json({ ok: false, error: 'budget' });
      const all = await listJobs(deps, uid);
      for (const old of all.filter((j) => j.kind === 'ping').slice(2)) await delDoc(deps, 'studioJobs', old.id);   // שומרים רק את הבדיקות האחרונות
      const job = { id: S.newJobId(), uid, kind: 'ping', state: 'new', created: now, updated: now };
      await patchJob(deps, job.id, job);
      const f = await fireJob(deps, uid, v, job, now);
      const j = await readJob(deps, job.id);
      return res.status(200).json(Object.assign({ ok: f.ok, job: view(j) }, f.ok ? (f.unsure ? { unsure: f.unsure, detail: f.detail } : {}) : { error: f.error, retry: f.retry, detail: f.detail || '' }));
    }
    if (op === 'create') {
      const spec = S.normSpec(body.spec);
      if (!spec) return res.status(400).json({ ok: false, error: 'bad_spec' });
      const all = (await listJobs(deps, uid)).filter((j) => j.kind !== 'ping');
      if (all.filter((j) => S.ACTIVE.includes(S.effState(j, now).state)).length >= S.MAX_ACTIVE) return res.status(409).json({ ok: false, error: 'too_many' });
      for (const old of all.filter((j) => S.FINAL.includes(S.effState(j, now).state)).slice(S.MAX_STORED - 1)) await delDoc(deps, 'studioJobs', old.id);
      const job = { id: S.newJobId(), uid, kind: 'tr', state: 'new', created: now, updated: now, spec };
      await patchJob(deps, job.id, job);
      return res.status(200).json({ ok: true, job: view(job) });
    }
    if (op === 'jobs') {
      const all = (await listJobs(deps, uid)).filter((j) => j.kind !== 'ping');
      return res.status(200).json({ ok: true, jobs: all.slice(0, S.MAX_STORED).map(view), kinds: S.WORKER_KINDS.slice(), now });
    }
    const job = await mine(body.job);
    if (!job) return res.status(404).json({ ok: false, error: 'no_job' });
    const st = S.effState(job, now).state;
    if (op === 'job') return res.status(200).json({ ok: true, job: view(job), now });
    if (op === 'file') {
      if (job.kind !== 'tr' || st !== 'new' && st !== 'queued' && st !== 'running') return res.status(409).json({ ok: false, error: 'state' });
      const which = body.which === 'v' ? 'v' : body.which === 'a' ? 'a' : '';
      const fid = String(body.id || ''), folder = String(body.folder || '');
      if (!which || !S.FILE_ID_RE.test(fid) || !S.FILE_ID_RE.test(folder) || (job.folder && job.folder !== folder)) return res.status(400).json({ ok: false, error: 'bad_params' });
      // מאמתים מול Drive עצמו: הקובץ קיים, בתיקיית העבודה, והווידאו בגודל של המקור — העובד יוריד בדיוק את זה
      const t = await gdrive.accessToken(deps, uid);
      if (!t.ok) return res.status(200).json({ ok: false, error: t.error });
      const r = await (deps.fetch || fetch)(DRIVE + fid + '?fields=id,name,size,mimeType,parents,trashed', { headers: { Authorization: 'Bearer ' + t.token } });
      let meta = null; try { meta = await r.json(); } catch (e) {}
      if (r.status === 404) return res.status(400).json({ ok: false, error: 'file_missing' });
      if (r.status !== 200 || !meta) return res.status(502).json({ ok: false, error: 'drive_http_' + r.status });
      const f = S.normFile(meta);
      if (!f || meta.trashed || !(Array.isArray(meta.parents) && meta.parents.includes(folder))) return res.status(400).json({ ok: false, error: 'file_bad' });
      if (which === 'v' && job.spec && f.size !== job.spec.size) return res.status(400).json({ ok: false, error: 'file_size' });
      f.at = now;
      await patchJob(deps, job.id, { ['f' + which]: f, folder, updated: now });
      job['f' + which] = f; job.folder = folder;
      return res.status(200).json({ ok: true, job: view(job) });
    }
    if (op === 'start') {
      if (job.kind !== 'tr' || st !== 'new') return res.status(409).json({ ok: false, error: 'state', job: view(job) });
      if (!job.fa && !job.fv) return res.status(409).json({ ok: false, error: 'no_files' });
      if (!S.WORKER_KINDS.includes(job.kind)) return res.status(200).json({ ok: false, error: 'worker_not_ready', job: view(job) });
      const v = await readVault(deps, uid);
      if (!v || !v.r) return res.status(200).json({ ok: false, error: 'conn_missing' });
      if (S.recentFires(v.fh, now).length >= S.FIRE_HOUR) return res.status(429).json({ ok: false, error: 'budget' });
      const f = await fireJob(deps, uid, v, job, now);
      const j = await readJob(deps, job.id);
      return res.status(200).json(Object.assign({ ok: f.ok, job: view(j) }, f.ok ? (f.unsure ? { unsure: f.unsure, detail: f.detail } : {}) : { error: f.error, retry: f.retry, detail: f.detail || '' }));
    }
    if (op === 'cancel') {
      if (!S.FINAL.includes(st)) {
        await patchJob(deps, job.id, { state: 'cancelled', ended: now, updated: now });
        job.state = 'cancelled'; job.ended = now;
      }
      return res.status(200).json({ ok: true, job: view(job) });
    }
    if (op === 'remove') {
      if (st === 'queued' || st === 'running') return res.status(409).json({ ok: false, error: 'active' });
      await delDoc(deps, 'studioJobs', job.id);
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ ok: false, error: 'bad_op' });
  } catch (err) {
    return res.status(502).json({ ok: false, error: /^(fs_http_|sa_http_|vault_)/.test(String(err.message)) ? String(err.message).slice(0, 30) : 'failed' });
  }
}

module.exports = (req, res) => handler(req, res);
module.exports._handler = handler;
module.exports._reset = () => hits.clear();
