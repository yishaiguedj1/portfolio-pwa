/* סטודיו התרגום — POST /api/studio (v355, שלב 2 מתוך התוכנית). הפונקציה ה־12, האחרונה ב־Vercel Hobby:
   יכולת נוספת לסטודיו בשרתון = op חדש כאן, לא קובץ חדש.
   מהטלפון (Origin מאושר + התחברות Firebase מאומתת + משתמש מורשה: המנהל או STUDIO_USERS):
     status → החיבור ל־Claude (רק "trig_…ab12", לעולם לא המפתח), Drive, ומה העובד בענן יודע לבצע
     connect { url, key } → בדיקת צורה + שמירה מוצפנת בכספת · disconnect → מחיקה מהכספת
     test → עבודת "בדיקת חיבור" + הפעלת ה־Routine (פעם בדקה לכל היותר). בלי חיבור ל־Claude: conn_missing (not_connected = Drive)
     drive → גישה זמנית ל־Drive (שעה) להעלאה מהטלפון
     gdConfig (בלי התחברות) · gdConnect · gdStatus · gdToken · gdDisconnect → חיבור Drive של הסטודיו (v357: לקוח OAuth נפרד, studioDrive/{uid})
     create { spec } · file { job, which: a|v, id, folder } · start { job } · jobs · job { job } · cancel { job } · remove { job }
     resume { job } → v361: הפעלה חוזרת של עבודה שנכשלה / בוטלה / נתקעה — העובד ממשיך מנקודת השמירה האחרונה
     rules { rl } → v367: החוקים שלך (תקציב, מצב מקסימלי, אישור לפני צריבה) · halt { on } → מתג החירום: עוצר את כל הסוכנים
       (מבטל את מפתחות העבודות הפעילות, והמגדל עוצר את הסשן בבדיקה הבאה) ומשהה הפעלות עד "להחזיר"
   מהעובד בענן (שרת לשרת, בלי Origin; מזוהה רק במפתח העבודה):
     claim { job, key } → פרטי העבודה + גישה ל־Drive לשעה · token { job, key } → גישה חדשה · report { job, key, st, p, ... } → התקדמות
     qa { job, key } → v367: השאלה / השער הפתוחים והתשובה (בלי Drive — לבדיקה כל כמה שניות בזמן שמחכים לך)
   מצב העבודות ב־Firestore (studioJobs/{id}, studioVault/{uid}) דרך חשבון השירות — הטלפון לא קורא משם ישירות.
   הפעלת Routine: אין מפתח למניעת כפילות, ולכן לעולם לא מנסים שוב לבד — אחרת ייפתחו שני סשנים. */
const { guard } = require('../lib/ibkr');
const { verifyIdToken, datastoreToken, isAdmin, emails } = require('../lib/gauth');
const vault = require('../lib/vault');
const gdrive = require('../lib/gdrive').studio;   // v357: לקוח OAuth נפרד לסטודיו — לא רואה את גיבוי הספרייה
const S = require('../lib/studio');
const O = require('../lib/studioops');

const PROJECT = () => process.env.FIREBASE_PROJECT_ID || 'yishaiguedj1-c786e';
const BASE = () => 'https://firestore.googleapis.com/v1/projects/' + PROJECT() + '/databases/(default)/documents';
const DRIVE = 'https://www.googleapis.com/drive/v3/files/';
const UID_RE = /^[A-Za-z0-9]{6,128}$/;
const AAD = (uid) => 'studio|' + uid + '|r';
const WORKER_OPS = new Set(['claim', 'token', 'report', 'qa']);
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
/* v363: "הרגיל" של המשתמש — דגימה לכל עבודה שהסתיימה (studioStats/{uid}, נפרד מהכספת: ניתוק Claude לא מוחק את ההיסטוריה) */
/* v365: מגדל הפיקוח 2.0 — אירועים והתראות (lib/studioops.js) ב־studioOps/{uid}. תקלה כאן לעולם לא מפילה את הפעולה עצמה */
async function raise(deps, uid, evs, j, now, once) {
  if (!evs || !evs.length) return;
  try {
    const d = await readDoc(deps, 'studioOps', uid);
    const al = O.opsApply(d && d.al, evs, j, now, once);
    if (al) await patchDoc(deps, 'studioOps', uid, { al, updated: now });
  } catch (e) {}
}
async function closeJobOps(deps, uid, j, now) {
  try {
    const d = await readDoc(deps, 'studioOps', uid);
    const al = d && O.opsCloseJob(d.al, j, now);
    if (al) await patchDoc(deps, 'studioOps', uid, { al, updated: now });
  } catch (e) {}
}
const readStats = async (deps, uid) => { try { const d = await readDoc(deps, 'studioStats', uid); return d || {}; } catch (e) { return {}; } };
const readNs = async (deps, uid) => { const d = await readStats(deps, uid); return Array.isArray(d.ns) ? d.ns : []; };
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
async function fireJob(deps, uid, v, job, now, resume) {
  const key = S.newKey();
  const fh = S.recentFires(v.fh, now);
  await patchJob(deps, job.id, { state: 'queued', kh: S.keyHash(key), kx: now + S.KEY_TTL, fired: now, fires: (job.fires || 0) + 1, err: '', ed: '', warn: '', use: null, tw: null, rw: 0, updated: now });
  const f = await fire(deps, v, uid, S.fireText(job.id, key));
  if (job.kind === 'tr') await raise(deps, uid, f.ok ? [{ c: 'routine', k: 'fire', ok: true }, { c: 'routine', k: 'rate', ok: true }] : [O.fireEvent(f.error)].filter(Boolean), job.id, now);
  if (!f.ok && UNSURE.includes(f.error)) {
    // v356: 5xx או תקלת רשת — ייתכן שהסשן כבר נפתח (קרה אצל המשתמש: "לא זמין", והסשן הגיע ונדחה ב־bad_key).
    // לא מבטלים: המפתח נשאר בתוקף והעבודה ממתינה. נלקחה — ממשיכה כרגיל; לא נלקחה בזמן — נכשלת עם השגיאה של Anthropic (effState)
    await patchJob(deps, job.id, { warn: f.error, ed: f.detail || '', updated: now });
    await patchVault(deps, uid, { tt: now, fh: fh.concat(now) });   // ייתכן שנפתח סשן — נספר בתקציב
    return { ok: true, unsure: f.error, detail: f.detail || '' };
  }
  if (!f.ok) {
    // המשך שלא הופעל — חוזרים ל"נכשלה" (עם השגיאה של ההפעלה), לא ל"חדשה"
    const back = job.kind === 'ping' || resume ? { state: 'failed', err: f.error, ended: now, kh: '' } : { state: 'new', err: f.error, kh: '', fired: job.fired || 0 };
    await patchJob(deps, job.id, Object.assign(back, { ed: f.detail || '', updated: now }));
    if (f.error !== 'routine_net') await patchVault(deps, uid, { tt: now });
    return f;
  }
  await patchJob(deps, job.id, { sess: f.sess, updated: now });
  await patchVault(deps, uid, { tt: now, fh: fh.concat(now) });
  return f;
}

/* v367: לפני הפעלה — מתג החירום (תמיד חוסם) ומצב מעל המקסימום שבחוקים (חוסם עד שמאשרים: ov) */
async function ruleBlock(deps, uid, job, body) {
  const st = await readStats(deps, uid);
  if (st.halt) return { error: 'halted' };
  const rl = S.normRules(st.rl);
  if (job.spec && S.modeOver(job.spec.mode, rl.mx) && body.ov !== true) return { error: 'rule_mode', mx: rl.mx };
  return null;
}

/* v361: "המשך מאותה נקודה" — מפתח חדש והפעלה חוזרת של ה־Routine; העובד מוריד את נקודת השמירה האחרונה וממשיך ממנה.
   הטוקנים של הסשנים הקודמים נשמרים (use0) ומתווספים לדיווח הבא. v368: גם "המשך" אוטומטי אחרי תקלה חולפת (auto) —
   אותה דרך בדיוק, פעם אחת לעבודה (ar), והמצב שאישרת בהתחלה לא נשאל שוב (ov) */
async function doResume(deps, uid, job, now, body, auto) {
  const why = S.canResume(job, now);
  if (why) return { status: 409, json: { ok: false, error: why } };
  const stop = await ruleBlock(deps, uid, job, auto ? { ov: true } : body);   // v367
  if (stop) return { status: 409, json: Object.assign({ ok: false }, stop) };
  const v = await readVault(deps, uid);
  if (!v || !v.r) return { status: 200, json: { ok: false, error: 'conn_missing' } };
  if (S.recentFires(v.fh, now).length >= S.FIRE_HOUR) return { status: 429, json: { ok: false, error: 'budget' } };
  const use0 = S.mergeUse(job.use0, job.use);
  // v364: העצירה של המגדל (אם הייתה) עוברת לסשן הבא — לאבחון ולרישום תיקון; fireJob מאפס את tw
  const ls = job.tw && job.tw.lv === 'red' && job.tw.fp ? { fp: job.tw.fp, why: job.tw.why || '', st: (job.prog && job.prog.st) || '' } : null;
  // v367: "המשך" אחרי שעצרת בתקציב = אישור להמשיך (התקציב גדל בעוד תקציב אחד)
  const bx = job.err === 'budget_stop' ? (job.bx || 0) + 1 : (job.bx || 0);
  const patch = { use0, ls, bx, ended: 0, updated: now };
  if (auto) patch.ar = (job.ar || 0) + 1;   // נרשם לפני ההפעלה — שתי צפיות במקביל לא יפעילו פעמיים
  await patchJob(deps, job.id, patch);
  Object.assign(job, patch);
  const f = await fireJob(deps, uid, v, job, now, true);
  const j = await readJob(deps, job.id);
  return { status: 200, json: Object.assign({ ok: f.ok, job: S.publicJob(j, now) }, f.ok ? (f.unsure ? { unsure: f.unsure, detail: f.detail } : {}) : { error: f.error, retry: f.retry, detail: f.detail || '' }) };
}
/* v368: עבודות שחלון ההתאוששות שלהן נגמר — ממשיכות לבד (נבדק בכל צפייה מהטלפון). מתג החירום / אין חיבור — מוותרים, והעבודה נשארת "נכשלה" */
async function autoRecover(deps, uid, jobs, now) {
  const due = jobs.filter((j) => j.kind === 'tr' && S.recoverAt(j, now) && now >= S.recoverAt(j, now));
  for (const j of due) {
    const r = await doResume(deps, uid, j, now, {}, true).catch(() => ({ json: { ok: false, error: 'failed' } }));
    if (!r.json.ok && r.json.error !== 'budget') await patchJob(deps, j.id, { rw: 0, updated: now }).catch(() => {});   // תקציב ההפעלות — ננסה בצפייה הבאה
    if (r.json.ok) await raise(deps, uid, [{ c: 'claude', k: 'auto' }], j.id, now);
  }
  return due.length;
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
      if (job.kind === 'tr') await raise(deps, job.uid, [{ c: 'drive', k: 'auth', ok: !!t.ok }], id, now);   // v365
      return t.ok ? { token: t.token, exp: t.exp } : { error: t.error };
    };
    if (body.op === 'claim') {
      const patch = { updated: now };
      if (job.state === 'queued') { patch.state = 'running'; patch.claimed = now; patch.warn = ''; job.state = 'running'; }
      await patchJob(deps, id, patch);
      const stats = job.kind === 'tr' ? await readStats(deps, job.uid) : {};
      const nm = job.kind === 'tr' && job.spec ? S.learnedNorm(stats.ns, job.spec.mode) : null;
      return res.status(200).json({ ok: true, job: S.workerJob(job, nm, S.fbForWorker(stats.fb), stats.fm, stats.rl), drive: await driveFor(), now });
    }
    if (body.op === 'token') return res.status(200).json({ ok: true, drive: await driveFor(), now });
    if (body.op === 'qa') return res.status(200).json({ ok: true, qa: job.qa && job.qa.id ? { id: job.qa.id, g: job.qa.g || '', a: job.qa.a || null } : null, bx: job.bx || 0, now });
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
    if (body.ask != null) {
      // שאלה באמצע העבודה — מוצגת בטלפון עד שעונים או עד שהעובד ממשיך עם ברירת המחדל
      const qa = S.normAsk(body.ask);
      if (!qa) return res.status(400).json({ ok: false, error: 'ask_bad' });
      if ((job.qn || 0) >= S.ASK_MAX) return res.status(409).json({ ok: false, error: 'ask_limit' });   // לא 429: העובד מנסה שוב לבד על 429
      up.qa = Object.assign(qa, { at: now, a: null });
      up.qn = (job.qn || 0) + 1;
    }
    let gateId = '';
    if (body.gate != null) {
      // v367: שער — הפרה של חוק (תקציב) או אישור לפני צריבה. השרתון בונה את השאלה (בלי טקסט מ־Claude); העבודה מחכה לך
      if ((job.gn || 0) >= S.GATE_MAX) return res.status(409).json({ ok: false, error: 'gate_limit' });
      const qa = S.normGate(body.gate, S.newGateId());
      if (!qa) return res.status(400).json({ ok: false, error: 'gate_bad' });
      up.qa = Object.assign(qa, { at: now, a: null });
      up.gn = (job.gn || 0) + 1;
      gateId = qa.id;
    }
    if (body.askTimeout != null && job.qa && !job.qa.a && String(body.askTimeout) === job.qa.id) {
      // לא ענית בזמן — העובד ממשיך עם ברירת המחדל, והטלפון מראה את זה במקום שאלה פתוחה
      const d = job.qa.d;
      up.qa = Object.assign({}, job.qa, { a: { i: d, t: d >= 0 ? job.qa.o[d] : '', auto: true, at: now } });
    }
    if (body.usage != null) {
      // v359: טוקנים ועלות (בדיווח האחרון). נתון לא תקין נזרק בשקט — לא מפילים בגללו את סוף העבודה
      // v361: אחרי "המשך" — יחד עם הסשנים הקודמים (use0)
      const use = S.normUsage(body.usage);
      if (use) up.use = S.mergeUse(job.use0, use);
    }
    if (body.tower != null) {
      // v362: מגדל הפיקוח — מצב תקין/חריג, ובעצירה הסיבה והמספרים (מגיע יחד עם fail: tower_stop). לא תקין — נזרק בשקט
      const tw = S.normTower(body.tower);
      if (tw) up.tw = Object.assign(tw, { at: now });
    }
    if (body.ck != null) {
      // v361: נקודת שמירה — הארכיון חייב להיות בתיקיית העבודה ב־Drive (כמו התוצרים)
      const ck = S.normCk(body.ck);
      if (!ck || !job.folder) return res.status(400).json({ ok: false, error: 'ck_bad' });
      const t = await gdrive.accessToken(deps, job.uid);
      if (!t.ok) return res.status(200).json({ ok: false, error: t.error });
      const r = await (deps.fetch || fetch)(DRIVE + ck.id + '?fields=id,size,parents,trashed', { headers: { Authorization: 'Bearer ' + t.token } });
      let meta = null; try { meta = await r.json(); } catch (e) {}
      if (r.status !== 200 || !meta || meta.trashed || !(Array.isArray(meta.parents) && meta.parents.includes(job.folder))) return res.status(400).json({ ok: false, error: 'ck_bad' });
      ck.size = Math.floor(Number(meta.size) || ck.size);
      up.ck = S.addCk(job.ck, ck, now);
    }
    if (job.state === 'queued') { up.state = up.state || 'running'; up.claimed = now; up.warn = ''; }
    if (job.kind === 'tr' && up.state === 'failed' && (job.ar || 0) < S.AUTO_RESUME_MAX) {
      // v368: תקלה חולפת (Drive / רשת) — חלון התאוששות, ואז "המשך" אוטומטי אחד
      let kinds = [];
      try { kinds = O.opsView(((await readDoc(deps, 'studioOps', job.uid)) || {}).al, now).open.filter((a) => a.j === id).map((a) => a.c + ':' + a.k); } catch (e) {}
      if (S.isTransient(up.err, kinds.concat(O.normEvents(body.ev).filter((e) => !e.ok).map((e) => e.c + ':' + e.k)))) up.rw = now + S.RECOVER_WAIT;
    }
    await patchJob(deps, id, up);
    if (job.kind === 'ping' && up.state === 'done') await patchVault(deps, job.uid, { ok: now, okj: id }).catch(() => {});
    // v364: ספר התיקונים — עצירה של המגדל נרשמת לפי טביעת האצבע; Claude רושם תיקון (אחרי אבחון בהמשך); המגדל הזכיר תיקון מוכר.
    // תקלה כאן לא מפילה את הדיווח עצמו
    if (job.kind === 'tr' && (up.tw && up.tw.lv === 'red' && up.tw.fp || body.fix != null || body.fixUsed != null)) {
      const stats = await readStats(deps, job.uid);
      let fb = null;
      if (up.tw && up.tw.lv === 'red' && up.tw.fp) fb = S.fbStop(stats.fb, up.tw, (job.prog && job.prog.st) || '', now);
      else if (body.fix != null && body.fix && typeof body.fix === 'object') fb = S.fbFix(stats.fb, String(body.fix.fp || ''), body.fix.t, now, stats.fm);   // v366: הצעה או תיקון — לפי המסלול
      else if (body.fixUsed != null) fb = S.fbUsed(stats.fb, String(body.fixUsed), now);
      if (fb) await patchDoc(deps, 'studioStats', job.uid, { fb, updated: now }).catch(() => {});
    }
    if (job.kind === 'tr') {
      // v365: אירועים מהעובד (vt, Drive, רשת) ומהמגדל → התראות; סוף העבודה סוגר את כולן
      if (up.state === 'done') await closeJobOps(deps, job.uid, id, now);
      else await raise(deps, job.uid, O.normEvents(body.ev).concat(up.tw ? O.towerEvents(up.tw) : [], up.qa && up.qa.g === 'b' ? [{ c: 'claude', k: 'budget' }] : []), id, now);
    }
    if (job.kind === 'tr' && up.state === 'done') {
      // v363: עבודה שהסתיימה מלמדת את המגדל מה "רגיל" אצלך. תקלה כאן לא מפילה את סוף העבודה
      const smp = S.normSample(job, up.use || job.use, now);
      if (smp) await patchDoc(deps, 'studioStats', job.uid, { ns: S.addSample(await readNs(deps, job.uid), smp), updated: now }).catch(() => {});
    }
    return res.status(200).json(Object.assign({ ok: true, stop: false, state: up.state || job.state }, gateId ? { gate: gateId } : {}));
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
  const opsFor = async (u) => { const d = await readDoc(deps, 'studioOps', u).catch(() => null) || {}; return O.opsView(d.al, now, d.mu); };
  try {
    if (op === 'status') {
      const v = await readVault(deps, uid);
      const d = await gdrive.driveState(deps, uid).catch(() => ({ configured: gdrive.configured(), connected: false, email: '' }));
      const st = await readStats(deps, uid);   // v363: "הרגיל" לכל מצב · v364: ספר התיקונים — למסך "מגדל הפיקוח"
      return res.status(200).json({ ok: true, conn: v && v.r ? { hint: v.hint || '', since: v.since || 0, ok: v.ok || 0 } : null,
        drive: { configured: d.configured, connected: d.connected, email: d.email }, kinds: S.WORKER_KINDS.slice(),
        norm: S.normsView(st.ns), fb: S.fbView(st.fb), fm: S.normFixMode(st.fm), ops: await opsFor(uid),
        rl: S.normRules(st.rl), halt: st.halt || 0, now });   // v367: החוקים ומתג החירום
    }
    if (op === 'rules') {
      // v367: החוקים שלך — נשמרים בחשבון; חלים על עבודות שמתחילות מעכשיו (והתקציב — גם על עבודה רצה, בבדיקה הבאה של המגדל אחרי "המשך")
      const rl = S.normRules(body.rl);
      await patchDoc(deps, 'studioStats', uid, { rl, updated: now });
      return res.status(200).json({ ok: true, rl });
    }
    if (op === 'halt') {
      // v367: מתג החירום — "עצור את כל הסוכנים": כל עבודה שהופעלה מבוטלת ומפתח העבודה שלה נמחק (העובד מקבל "עצור" בפנייה הבאה,
      // והמגדל חוסם את הסשן). הפעלות חדשות מושהות עד "להחזיר". עבודה שנעצרה ממשיכה אחר כך מנקודת השמירה ("המשך")
      if (body.on !== true) {
        await patchDoc(deps, 'studioStats', uid, { halt: 0, updated: now });
        return res.status(200).json({ ok: true, halt: 0 });
      }
      await patchDoc(deps, 'studioStats', uid, { halt: now, updated: now });
      const act = (await listJobs(deps, uid)).filter((j) => (j.state === 'queued' || j.state === 'running') && !S.FINAL.includes(S.effState(j, now).state));
      for (const j of act) {
        await patchJob(deps, j.id, { state: 'cancelled', err: 'halted', kh: '', ended: now, updated: now });
        await closeJobOps(deps, uid, j.id, now);
      }
      // v368: גם ההמשך האוטומטי שמחכה (אחרי תקלה חולפת) לא יקרה
      for (const j of (await listJobs(deps, uid)).filter((x) => x.rw && !act.some((y) => y.id === x.id))) await patchJob(deps, j.id, { rw: 0, updated: now });
      return res.status(200).json({ ok: true, halt: now, n: act.length });
    }
    if (op === 'fixMode') {
      // v366: מסלול התיקונים — "הצעות לאישור" (ברירת מחדל) או "עצמאי"
      if (!S.FIX_MODES.includes(body.mode)) return res.status(400).json({ ok: false, error: 'bad_mode' });
      await patchDoc(deps, 'studioStats', uid, { fm: body.mode, updated: now });
      return res.status(200).json({ ok: true, fm: body.mode });
    }
    if (op === 'fbDecide') {
      // v366: החלטה על הצעת תיקון של Claude — לשמור או לא
      const st = await readStats(deps, uid);
      const fb = S.fbDecide(st.fb, String(body.fp || ''), body.ok === true, now);
      if (!fb) return res.status(404).json({ ok: false, error: 'no_proposal', fb: S.fbView(st.fb) });
      await patchDoc(deps, 'studioStats', uid, { fb, updated: now });
      return res.status(200).json({ ok: true, fb: S.fbView(fb) });
    }
    if (op === 'mute') {
      // v368: השתקה לסוג התראה (רכיב · סוג), עם תפוגה — שעה / 4 שעות / יום; h = 0 מבטל. לא מסתירה מהציון ומהזמינות, רק מהרעש
      const d = await readDoc(deps, 'studioOps', uid).catch(() => null) || {};
      const mu = O.muteSet(d.mu, String(body.c || ''), String(body.k || ''), body.h, now);
      if (!mu) return res.status(400).json({ ok: false, error: 'bad_mute' });
      await patchDoc(deps, 'studioOps', uid, { mu, updated: now });
      return res.status(200).json({ ok: true, ops: O.opsView(d.al, now, mu) });
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
      if ((await readStats(deps, uid)).halt) return res.status(409).json({ ok: false, error: 'halted' });   // v367: מתג החירום
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
      // v365: עבודה שנתקעה / שאף סשן לא לקח — התראה (פעם אחת לעבודה; הצפייה החוזרת לא מגדילה את המונה)
      for (const j of all) {
        const e = S.effState(j, now);
        if (S.isStale(j, now)) await raise(deps, uid, [{ c: 'claude', k: 'stale' }], j.id, now, true);
        else if (e.state === 'failed' && e.err === 'no_claim' && j.state === 'queued') await raise(deps, uid, [{ c: 'routine', k: 'no_claim' }], j.id, now, true);
      }
      // v368: חלון ההתאוששות נגמר — "המשך" אוטומטי, והרשימה נקראת מחדש
      const list = await autoRecover(deps, uid, all, now) ? (await listJobs(deps, uid)).filter((j) => j.kind !== 'ping') : all;
      return res.status(200).json({ ok: true, jobs: list.slice(0, S.MAX_STORED).map(view), kinds: S.WORKER_KINDS.slice(), now });
    }
    let job = await mine(body.job);
    if (!job) return res.status(404).json({ ok: false, error: 'no_job' });
    if (op === 'job' && await autoRecover(deps, uid, [job], now)) job = await readJob(deps, job.id);   // v368
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
      const stop = await ruleBlock(deps, uid, job, body);   // v367: מתג החירום / מצב מעל המקסימום
      if (stop) return res.status(409).json(Object.assign({ ok: false, job: view(job) }, stop));
      const v = await readVault(deps, uid);
      if (!v || !v.r) return res.status(200).json({ ok: false, error: 'conn_missing' });
      if (S.recentFires(v.fh, now).length >= S.FIRE_HOUR) return res.status(429).json({ ok: false, error: 'budget' });
      const f = await fireJob(deps, uid, v, job, now);
      const j = await readJob(deps, job.id);
      return res.status(200).json(Object.assign({ ok: f.ok, job: view(j) }, f.ok ? (f.unsure ? { unsure: f.unsure, detail: f.detail } : {}) : { error: f.error, retry: f.retry, detail: f.detail || '' }));
    }
    if (op === 'answer') {
      // תשובה לשאלה של Claude — פעם אחת, לשאלה הנוכחית בלבד, כל עוד העבודה רצה
      if (st !== 'queued' && st !== 'running') return res.status(409).json({ ok: false, error: 'state', job: view(job) });
      const a = S.normAnswer(job.qa, body);
      if (!a) return res.status(400).json({ ok: false, error: 'bad_answer', job: view(job) });
      job.qa = Object.assign({}, job.qa, { a: Object.assign(a, { at: now }) });
      const patch = { qa: job.qa, updated: now };
      if (job.qa.g === 'b' && a.i === 0) { patch.bx = (job.bx || 0) + 1; job.bx = patch.bx; }   // v367: "להמשיך" — התקציב גדל בעוד תקציב אחד
      await patchJob(deps, job.id, patch);
      if (job.qa.g === 'b' && a.i === 0) await raise(deps, uid, [{ c: 'claude', k: 'budget', ok: true }], job.id, now);
      return res.status(200).json({ ok: true, job: view(job) });
    }
    if (op === 'resume') {
      const r = await doResume(deps, uid, job, now, body, false);
      if (!r.json.job) r.json.job = view(job);
      return res.status(r.status).json(r.json);
    }
    if (op === 'event') {
      // v365: אירוע מהטלפון (העלאה שנכשלה / נתקעה, Drive מלא) — רק מהקטלוג
      const evs = O.normEvents(body.ev).filter((e) => e.c === 'phone' || e.c === 'drive');
      if (!evs.length) return res.status(400).json({ ok: false, error: 'bad_event' });
      await raise(deps, uid, evs, job.id, now);
      return res.status(200).json({ ok: true });
    }
    if (op === 'cancel') {
      await closeJobOps(deps, uid, job.id, now);
      if (job.rw) { await patchJob(deps, job.id, { rw: 0, updated: now }); job.rw = 0; }   // v368: "בטל" גם עוצר את ההמשך האוטומטי
      if (!S.FINAL.includes(st)) {
        await patchJob(deps, job.id, { state: 'cancelled', ended: now, updated: now });
        job.state = 'cancelled'; job.ended = now;
      }
      return res.status(200).json({ ok: true, job: view(job) });
    }
    if (op === 'remove') {
      if ((st === 'queued' || st === 'running') && !S.isStale(job, now)) return res.status(409).json({ ok: false, error: 'active' });   // נתקעה — אפשר למחוק
      await delDoc(deps, 'studioJobs', job.id);
      await closeJobOps(deps, uid, job.id, now);
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
