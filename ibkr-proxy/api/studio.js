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
   מהשרת שלנו (מצב "API של המערכת"; שרת לשרת, בלי Origin; מזוהה בטוקן שרת בכותרת Authorization — נשמר רק ה־hash):
     poll { hb } → עבודה מהתור (מזהה + מפתח עבודה חדש) או כלום · beat { hb } → דופק באמצע עבודה
   מהטלפון גם: srvList · srvCreate { name } (המנהל; הטוקן מוצג פעם אחת) · srvPause { sid, paused } · srvRemove { sid }
   מצב העבודות ב־Firestore (studioJobs/{id}, studioVault/{uid}, studioServers/{sid}) דרך חשבון השירות — הטלפון לא קורא משם ישירות.
   הפעלת Routine: אין מפתח למניעת כפילות, ולכן לעולם לא מנסים שוב לבד — אחרת ייפתחו שני סשנים. */
const { guard } = require('../lib/ibkr');
const { verifyIdToken, datastoreToken, isAdmin, emails } = require('../lib/gauth');
const vault = require('../lib/vault');
const gdrive = require('../lib/gdrive').studio;   // v357: לקוח OAuth נפרד לסטודיו — לא רואה את גיבוי הספרייה
const S = require('../lib/studio');
const O = require('../lib/studioops');
const I = require('../lib/studioinc');
const P = require('../lib/studioprob');   // v376: בעיות וספרי הפעלה
const L = require('../lib/studiosla');   // v377: יעדי שירות, ערך ותחזית
const ETA = require('../lib/studioeta');   // 10/10/2026: צפי זמנים נלמד לכל שלב
const SC = require('../lib/studioscan');
const PIR = require('../lib/studiopir');   // v379: דוח אחרי תקלה   // v378: בדיקת מוכנות ותחזוקה
const W = require('../lib/webpush');   // שלב 4 בסטודיו: התראות לטלפון (Web Push עצמאי)
const SLO = require('../lib/studioslo');   // v383: תקציב שגיאות
const AN = require('../lib/studioanom');   // v385: ציון חריגה 0–10
const A = require('../lib/studioagents');   // v373: מלאי הסוכנים   // v371: תקלות, שורש סביר ותקלה רחבה

const PROJECT = () => process.env.FIREBASE_PROJECT_ID || 'yishaiguedj1-c786e';
const BASE = () => 'https://firestore.googleapis.com/v1/projects/' + PROJECT() + '/databases/(default)/documents';
const DRIVE = 'https://www.googleapis.com/drive/v3/files/';
const UID_RE = /^[A-Za-z0-9]{6,128}$/;
const AAD = (uid) => 'studio|' + uid + '|r';
const WORKER_OPS = new Set(['claim', 'token', 'report', 'qa']);
const SERVER_OPS = new Set(['poll', 'beat']);
/* מצב API: תקציב חודשי לכל משתמש (מפתח ה־API של המערכת). מעבר לזה — התקרה ב־Console של Anthropic */
const USER_MONTH = () => Math.max(1, Math.min(10000, Number(process.env.STUDIO_API_USER_MONTH_USD) || 30));
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
/* כמו readDoc, עם updateTime (_ut) — לכתיבה בתנאי. נפרד: מסמך שנקרא ב־readDoc נכתב לפעמים בחזרה כמו שהוא */
async function readDocT(deps, col, id) {
  const r = await fsCall(deps, 'GET', '/' + col + '/' + id);
  if (r.status === 404) return null;
  if (r.status !== 200) throw new Error('fs_http_' + r.status);
  return Object.assign(S.fromFields(r.j && r.j.fields), { id, _ut: r.j && r.j.updateTime || '' });
}
/* כתיבה חלקית (updateMask) — הטלפון והעובד כותבים שדות שונים באותו מסמך בלי לדרוס זה את זה */
async function patchDoc(deps, col, id, obj) {
  const keys = Object.keys(obj).filter((k) => obj[k] !== undefined && k !== 'id');
  const q = keys.map((k) => 'updateMask.fieldPaths=' + k).join('&');
  const r = await fsCall(deps, 'PATCH', '/' + col + '/' + id + '?' + q, { fields: S.toFields(obj) });
  if (r.status !== 200) throw new Error('fs_http_' + r.status);
}
/* כתיבה רק אם המסמך לא השתנה מאז שקראנו אותו — שני שרתים לא לוקחים את אותה עבודה */
async function patchIf(deps, col, id, obj, updateTime) {
  const keys = Object.keys(obj).filter((k) => obj[k] !== undefined && k !== 'id');
  const q = keys.map((k) => 'updateMask.fieldPaths=' + k).join('&') + '&currentDocument.updateTime=' + encodeURIComponent(updateTime);
  const r = await fsCall(deps, 'PATCH', '/' + col + '/' + id + '?' + q, { fields: S.toFields(obj) });
  if (r.status === 200) return true;
  if (r.status === 400 || r.status === 409 || r.status === 412) return false;   // FAILED_PRECONDITION — מישהו אחר הקדים
  throw new Error('fs_http_' + r.status);
}
/* שאילתה עם שוויונות בלבד (אינדקסים אוטומטיים) — בלי מיון בשרת; ממיינים כאן */
async function query(deps, col, eq, limit) {
  const f = Object.entries(eq || {}).map(([k, v]) => ({ fieldFilter: { field: { fieldPath: k }, op: 'EQUAL', value: { stringValue: String(v) } } }));
  const sq = { from: [{ collectionId: col }], limit: limit || 50 };
  if (f.length === 1) sq.where = f[0]; else if (f.length > 1) sq.where = { compositeFilter: { op: 'AND', filters: f } };
  const r = await fsCall(deps, 'POST', ':runQuery', { structuredQuery: sq });
  if (r.status !== 200) throw new Error('fs_http_' + r.status);
  return (Array.isArray(r.j) ? r.j : []).filter((x) => x && x.document && x.document.name)
    .map((x) => Object.assign(S.fromFields(x.document.fields), { id: String(x.document.name).split('/').pop(), _ut: x.document.updateTime || '' }));
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
async function closeJobOps(deps, uid, j, now, ok) {
  try {
    const d = await readDoc(deps, 'studioOps', uid);
    let al = d && O.opsCloseJob(d.al, j, now);
    // 10/10/2026: עבודה שהסתיימה בהצלחה = הרכיבים בשרשרת עובדים → התראות בריאות של עבודות אחרות נסגרות
    if (d && ok) al = O.opsRecover(al || d.al, j, now) || al;
    if (al) await patchDoc(deps, 'studioOps', uid, { al, updated: now });
  } catch (e) {}
}
/* v371: התקלות נגזרות מהעבודות (studioinc.js) — מסונכרנות בכל צפייה ברשימה. תקלה כאן לא מפילה את הצפייה */
async function syncInc(deps, uid, jobs, now) {
  try {
    const d = await readDoc(deps, 'studioOps', uid) || {};
    const st = await readStats(deps, uid);
    const facts = jobs.filter((j) => j.kind === 'tr').map((j) => I.jobFacts(j, S.effState(j, now), S.isStale(j, now)));
    let inc = I.incSync(d.inc, facts, d.al, st.fb, now);
    const mi = I.majorSync(d.mi, inc || d.inc, d.al, now);
    const marked = I.majorMark(inc || d.inc, mi || d.mi, now);
    if (marked) inc = marked;
    const patch = {};
    if (inc) patch.inc = inc;
    if (mi) patch.mi = mi;
    if (inc || mi) await patchDoc(deps, 'studioOps', uid, Object.assign(patch, { updated: now }));
    return { inc: inc || d.inc, mi: mi || d.mi, al: d.al, fb: st.fb, hpc: st.hpc || 0 };
  } catch (e) { return null; }
}
/* התקלה הרחבה שחלה על העבודה הזו: Routine לא נוגע לעבודות במצב API, והשרת שלנו לא נוגע לעבודות של ה־Routine */
const majorNow = async (deps, uid, job) => {
  try {
    const d = await readDoc(deps, 'studioOps', uid);
    const mi = d && I.majorActive(d.mi) ? d.mi : null;
    if (!mi || !job) return mi;
    return (mi.c === 'routine' && apiJob(job)) || (mi.c === 'server' && !apiJob(job)) ? null : mi;
  } catch (e) { return null; }
};
const readStats = async (deps, uid) => { try { const d = await readDoc(deps, 'studioStats', uid); return d || {}; } catch (e) { return {}; } };
const patchVault = (deps, uid, o) => patchDoc(deps, 'studioVault', uid, o);

/* ---------- הפעלת ה־Routine ---------- */
/* שלב 4 (10/10/2026): התראות לטלפון. מפתחות ה־VAPID נוצרים פעם אחת ונשמרים מוצפנים בכספת (studioVault/_vapid —
   מזהה שלא יכול להיות uid). יצירה רק אם אין (currentDocument.exists=false): שתי בקשות במקביל — אחת נשמרת, השנייה קוראת */
const VAPID_DOC = '_vapid', VAPID_AAD = 'webpush|vapid';
async function vapidKeys(deps) {
  const d = await readDoc(deps, 'studioVault', VAPID_DOC).catch(() => null);
  if (d && d.vk) { const v = vault.open(d.vk, VAPID_AAD); if (v && v.pub && v.d) return v; }
  const v = W.genVapid();
  const r = await fsCall(deps, 'PATCH', '/studioVault/' + VAPID_DOC + '?updateMask.fieldPaths=vk&updateMask.fieldPaths=pub&currentDocument.exists=false',
    { fields: S.toFields({ vk: vault.seal(v, VAPID_AAD), pub: v.pub }) });
  if (r.status === 200) return v;
  const d2 = await readDoc(deps, 'studioVault', VAPID_DOC);
  const v2 = d2 && d2.vk ? vault.open(d2.vk, VAPID_AAD) : null;
  if (!v2 || !v2.pub) throw new Error('vapid');
  return v2;
}
/* התראה לכל המכשירים של המשתמש — רק סוג האירוע ומזהה העבודה. תקלה כאן לא מפילה שום דבר */
async function notify(deps, uid, kind, jobId, now) {
  try {
    const st = await readStats(deps, uid);
    const subs = W.normSubs(st.wp);
    if (!subs.length) return 0;
    const r = await W.sendAll(deps, await vapidKeys(deps), subs, kind, jobId, now);
    if (r.subs.length !== subs.length) await patchDoc(deps, 'studioStats', uid, { wp: r.subs, updated: now }).catch(() => {});
    return r.sent;
  } catch (e) { return 0; }
}

async function fire(deps, v, uid, text) {
  const conn = vault.open(v && v.r, AAD(uid));
  if (!conn || !conn.u || !conn.k) return { ok: false, error: 'conn_missing' };
  const ac = typeof AbortController === 'function' ? new AbortController() : null;
  const to = ac ? setTimeout(() => ac.abort(), FIRE_TIMEOUT) : 0;
  const t0 = Date.now();
  try {
    const r = await (deps.fetch || fetch)(conn.u, { method: 'POST', signal: ac ? ac.signal : undefined,
      headers: { Authorization: 'Bearer ' + conn.k, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }) });
    let j = null; try { j = await r.json(); } catch (e) {}
    const hdr = (k) => (r.headers && typeof r.headers.get === 'function' ? r.headers.get(k) : null);
    // התיעוד: הבקשה חוזרת רק אחרי שהסשן נפתח — כל 2xx = Claude נפתח, גם כשמבנה התשובה לא מוכר (ממשק ניסיוני).
    // עד התיקון: מזהה cse_ לא זוהה → "נכשל" והמפתח נמחק, וה־Claude שכבר נפתח נדחה ב־bad_key (קרה אצל המשתמש)
    const fr = { s: r.status, ms: Date.now() - t0 };   // v369: מה Anthropic החזיר ותוך כמה זמן — לאבחון ("Claude לא התחיל")
    if (r.status >= 200 && r.status < 300) return { ok: true, sess: S.fireSession(j), fr };
    const ra = parseInt(hdr('retry-after') || '', 10);
    return { ok: false, error: S.fireError(r.status, j), retry: Number.isFinite(ra) ? Math.min(ra, 7200) : undefined,
      detail: S.fireDetail(r.status, j, hdr('request-id')), fr };   // v356: לאבחון — מוצג בטלפון ("פרטים לתמיכה")
  } catch (e) {
    // ייתכן שהבקשה הגיעה — לא מנסים שוב לבד
    return { ok: false, error: 'routine_net', detail: String((e && e.name) || 'Error').replace(/[^A-Za-z]/g, '').slice(0, 30), fr: { s: 0, ms: Date.now() - t0 } };
  } finally { clearTimeout(to); }
}
/* מפתח חדש → נשמר לפני ההפעלה (העובד יכול להגיע מהר) → הפעלה → הסשן נשמר; כשל ודאי = חוזרים למצב הקודם */
const UNSURE = ['routine_down', 'routine_net'];
async function fireJob(deps, uid, v, job, now, resume) {
  const key = S.newKey();
  const fh = S.recentFires(v.fh, now);
  // v369: fr = { s: -1 } עד שיש תשובה — אם הפונקציה נקטעת באמצע ההפעלה, הטלפון יודע שלא ידוע מה Anthropic ענה
  await patchJob(deps, job.id, { state: 'queued', kh: S.keyHash(key), kx: now + S.KEY_TTL, fired: now, fires: (job.fires || 0) + 1, err: '', ed: '', warn: '', use: null, tw: null, rw: 0, fr: { s: -1, ms: 0 }, updated: now });
  const f = await fire(deps, v, uid, S.fireText(job.id, key));
  if (f.fr) await patchJob(deps, job.id, { fr: f.fr }).catch(() => {});
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

/* ---------- ת7: ניטור השרתים ----------
   GitHub Actions (studio-watch.yml) קורא כל 10 דק׳ ב־GET בלי גוף. שרת שדיווח ושותק מעל רבע שעה → התראה לטלפון של מי
   שהוסיף אותו + התראה במגדל (server:down, נשארת פתוחה עד שהוא חוזר או מוסר). אידמפוטנטי: dn נרשם בתנאי updateTime —
   קריאות במקביל = התראה אחת, ושרת שדיווח בינתיים לא מסומן. אופציונלי: STUDIO_WATCH_SECRET ב־Vercel + באותו שם ב־GitHub.
   התשובה — רק מספר */
async function watch(req, res, deps) {
  res.setHeader('Cache-Control', 'no-store');
  const secret = process.env.STUDIO_WATCH_SECRET;
  if (secret && String((req.headers || {}).authorization || '') !== 'Bearer ' + secret) return res.status(401).json({ ok: false });
  if (limited('watch', 6)) return res.status(429).json({ ok: false, error: 'rate_limited' });
  const now = deps.now || Date.now();
  try {
    let n = 0;
    for (const s of S.serversDown(await query(deps, 'studioServers', null, S.SRV_MAX + 5), now)) {
      const got = await patchIf(deps, 'studioServers', s.id, { dn: now, updated: now }, s._ut).catch(() => false);
      if (!got || !UID_RE.test(String(s.by || ''))) continue;
      n++;
      await raise(deps, s.by, [{ c: 'server', k: 'down' }], '', now);
      await notify(deps, s.by, 'srv_down', '', now);
    }
    return res.status(200).json({ ok: true, down: n });
  } catch (e) { return res.status(502).json({ ok: false }); }
}
/* ההתראה במגדל אחת לכל המשתמש — נסגרת רק כשאף שרת אחר שלו לא מסומן */
async function downClear(deps, uid, sid, now) {
  if (!UID_RE.test(String(uid || ''))) return;
  try {
    const others = (await query(deps, 'studioServers', null, S.SRV_MAX + 5)).filter((x) => x.id !== sid && x.dn && x.by === uid);
    if (!others.length) await raise(deps, uid, [{ c: 'server', k: 'down', ok: true }], '', now);
  } catch (e) {}
}
async function serverBack(deps, srv, sid, now) {
  if (!UID_RE.test(String(srv.by || ''))) return;
  await downClear(deps, srv.by, sid, now);
  await notify(deps, srv.by, 'srv_up', '', now);
}

/* ---------- מצב "API של המערכת": תור לשרת שלנו (בלי Routine) ---------- */
/* העבודה נכנסת לתור; שרת פנוי לוקח אותה ב־poll ומקבל מפתח עבודה חדש (המפתח נוצר רק שם — לא מחכה בתור) */
async function queueApi(deps, uid, job, now) {
  const st = await readStats(deps, uid);
  const cap = S.jobCap(job.spec, S.monthUsed(st.mu, now), USER_MONTH());
  if (!cap) return { ok: false, error: 'month_cap' };
  await patchJob(deps, job.id, { state: 'queued', eng: 'api', sid: '', pk: 0, kh: '', kx: 0, fired: now, fires: (job.fires || 0) + 1,
    err: '', ed: '', warn: '', use: null, tw: null, sess: null, updated: now });
  return { ok: true };
}
const apiJob = (job) => (job.kind === 'tr' || job.kind === 'rr' || job.kind === 'ai') && job.spec && job.spec.eng === 'api';   // מ2 · מ7: הפקה מחדש וגיליון ה־AI — באותו מנוע כמו המקור   // מ2: הפקה מחדש — באותו מנוע כמו המקור

async function server(req, res, body, deps) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
  let len = 0; try { len = JSON.stringify(body).length; } catch (e) { len = 1e9; }
  if (len > 4096) return res.status(413).json({ ok: false, error: 'too_large' });
  const hd = req.headers || {};
  const m = /^Bearer (\S+)$/.exec(String(hd.authorization || hd.Authorization || ''));
  const p = m && S.parseServerToken(m[1]);
  if (!p) return res.status(401).json({ ok: false, error: 'no_auth' });
  if (limited('s|' + p.sid, 20)) return res.status(429).json({ ok: false, error: 'rate_limited' });
  const now = deps.now || Date.now();
  try {
    const srv = await readDoc(deps, 'studioServers', p.sid);
    if (!srv || !S.serverMatches(srv, p.tok)) return res.status(401).json({ ok: false, error: 'no_auth', stop: true });
    const hb = S.normHb(body.hb);
    const seen = { seen: now, hb, updated: now };
    if (srv.dn) { seen.dn = 0; await serverBack(deps, srv, p.sid, now); }   // ת7: שרת שסומן "לא מדווח" חזר
    if (body.op === 'beat' || srv.paused) {
      await patchDoc(deps, 'studioServers', p.sid, seen);
      return res.status(200).json({ ok: true, job: null, paused: srv.paused === true, now });
    }
    // poll: העבודה הוותיקה ביותר שמחכה לשרת
    const qd = (await query(deps, 'studioJobs', { state: 'queued', eng: 'api', sid: '' }, 30)).sort((a, b) => (a.fired || 0) - (b.fired || 0));
    for (const job of qd) {
      if (!apiJob(job) || S.effState(job, now).state !== 'queued') continue;
      const st = await readStats(deps, job.uid);
      const cap = S.jobCap(job.spec, S.monthUsed(st.mu, now), USER_MONTH());
      if (!cap) {
        // התקציב החודשי נגמר בזמן שהעבודה חיכתה — נכשלת, לא נלקחת
        await patchIf(deps, 'studioJobs', job.id, { state: 'failed', err: 'month_cap', ended: now, updated: now }, job._ut).catch(() => false);
        continue;
      }
      const key = S.newKey();
      const got = await patchIf(deps, 'studioJobs', job.id, { sid: p.sid, pk: now, capc: Math.round(cap * 100), kh: S.keyHash(key), kx: now + S.KEY_TTL, updated: now }, job._ut);
      if (!got) continue;
      await patchDoc(deps, 'studioServers', p.sid, Object.assign(seen, { job: job.id }));
      return res.status(200).json({ ok: true, job: { id: job.id, key, kind: job.kind }, now });
    }
    await patchDoc(deps, 'studioServers', p.sid, Object.assign(seen, { job: '' }));
    return res.status(200).json({ ok: true, job: null, now });
  } catch (err) {
    return res.status(502).json({ ok: false, error: /^(fs_http_|sa_http_)/.test(String(err.message)) ? String(err.message).slice(0, 30) : 'failed' });
  }
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
  // v376: ספר ההפעלה "מצב זול יותר" — משנה את התוצאה, ולכן רק בלחיצה שלך (לא בהמשך האוטומטי) ורק אחרי עצירה על עלות
  let dm = '';
  if (body.mode != null && !auto) {
    const from = job.spec && job.spec.mode;
    if (!S.COST_STOP(job) || !S.cheaperModes(from).includes(body.mode)) return { status: 409, json: { ok: false, error: 'mode' } };
    dm = from;
  }
  const stop = await ruleBlock(deps, uid, job, auto ? { ov: true } : body);   // v367
  if (stop) return { status: 409, json: Object.assign({ ok: false }, stop) };
  // v384: "המשך" חוזר — זו הפעם השלישית ב־24 שעות: לולאה. ההמשך האוטומטי מוותר (והתראה), ידני — רק באישור שלך (lo)
  const rh = S.loopRecent(job, now);
  if (rh.length >= S.LOOP_N - 1 && (auto || body.lo !== true)) {
    await raise(deps, uid, [{ c: 'claude', k: 'loop' }], job.id, now, true);
    return { status: 409, json: { ok: false, error: 'loop', n: rh.length + 1 } };
  }
  // v371: תקלה רחבה — הפעלות מחכות עד שזה עובר; "להתחיל בכל זאת" (mo) עוקף. ההמשך האוטומטי תמיד מחכה
  const mj = (auto || body.mo !== true) ? await majorNow(deps, uid, job) : null;
  if (mj) return { status: 409, json: { ok: false, error: 'major', mi: { c: mj.c, e: mj.e, at: mj.at, n: mj.n || 0 } } };
  const api = apiJob(job);   // מצב API: אין Routine — העבודה חוזרת לתור של השרת
  const v = api ? null : await readVault(deps, uid);
  if (!api && (!v || !v.r)) return { status: 200, json: { ok: false, error: 'conn_missing' } };
  if (v && S.recentFires(v.fh, now).length >= S.FIRE_HOUR) return { status: 429, json: { ok: false, error: 'budget' } };
  const use0 = S.mergeUse(job.use0, job.use);
  // v364: העצירה של המגדל (אם הייתה) עוברת לסשן הבא — לאבחון ולרישום תיקון; fireJob מאפס את tw
  const ls = job.tw && job.tw.lv === 'red' && job.tw.fp ? { fp: job.tw.fp, why: job.tw.why || '', st: (job.prog && job.prog.st) || '' } : null;
  // v367: "המשך" אחרי שעצרת בתקציב = אישור להמשיך (התקציב גדל בעוד תקציב אחד)
  const bx = job.err === 'budget_stop' ? (job.bx || 0) + 1 : (job.bx || 0);
  const patch = { use0, ls, bx, ended: 0, updated: now };
  const rhNext = rh.concat([now]).slice(-S.LOOP_N - 2);   // v384: נרשם רק אחרי הפעלה שהצליחה (הפעלה שנכשלה לא פתחה סשן)
  // v377: הזמן שבין העצירה ל"המשך" לא נספר בשעון של יעד הזמן (מחכה לך)
  if (job.ended && (job.state === 'failed' || job.state === 'cancelled')) { patch.pz = (job.pz || 0) + Math.max(0, now - job.ended); patch.wv0 = 0; }
  if (auto) patch.ar = (job.ar || 0) + 1;
  if (dm) patch.spec = Object.assign({}, job.spec, { mode: body.mode, dm });   // dm = המצב שממנו ירדנו (לספירת ספר ההפעלה)   // נרשם לפני ההפעלה — שתי צפיות במקביל לא יפעילו פעמיים
  await patchJob(deps, job.id, patch);
  Object.assign(job, patch);
  if (api) {
    const q = await queueApi(deps, uid, job, now);
    if (!q.ok) await patchJob(deps, job.id, { state: 'failed', err: q.error, ended: now, updated: now });
    if (q.ok) await raise(deps, uid, ['claude:tw_stop', 'claude:stale', 'claude:budget'].map((x) => ({ c: x.split(':')[0], k: x.split(':')[1], ok: true })), job.id, now);
    if (q.ok) await patchJob(deps, job.id, { rh: rhNext }).catch(() => {});
    return { status: 200, json: Object.assign({ ok: q.ok, job: S.publicJob(await readJob(deps, job.id), now) }, q.ok ? {} : { error: q.error }) };
  }
  const f = await fireJob(deps, uid, v, job, now, true);
  // v368: ההמשך הופעל — ההתראות של העצירה הקודמת נסגרות (אחרת "המגדל עצר" נשאר דחוף כשהעבודה כבר רצה)
  if (f.ok) await raise(deps, uid, ['claude:tw_stop', 'claude:stale', 'claude:budget', 'routine:no_claim'].map((x) => ({ c: x.split(':')[0], k: x.split(':')[1], ok: true })), job.id, now);
  if (f.ok) await patchJob(deps, job.id, { rh: rhNext }).catch(() => {});
  const j = await readJob(deps, job.id);
  return { status: 200, json: Object.assign({ ok: f.ok, job: S.publicJob(j, now) }, f.ok ? (f.unsure ? { unsure: f.unsure, detail: f.detail } : {}) : { error: f.error, retry: f.retry, detail: f.detail || '' }) };
}
/* v368: עבודות שחלון ההתאוששות שלהן נגמר — ממשיכות לבד (נבדק בכל צפייה מהטלפון). מתג החירום / אין חיבור — מוותרים, והעבודה נשארת "נכשלה" */
async function autoRecover(deps, uid, jobs, now) {
  const due = jobs.filter((j) => j.kind === 'tr' && S.recoverAt(j, now) && now >= S.recoverAt(j, now));
  let n = 0;
  for (const j of due) {
    if (await majorNow(deps, uid, j)) continue;   // v371: בתקלה רחבה מחכים (rw נשאר) — ממשיכים כשהיא עוברת
    n++;
    const r = await doResume(deps, uid, j, now, {}, true).catch(() => ({ json: { ok: false, error: 'failed' } }));
    if (!r.json.ok && r.json.error !== 'budget') await patchJob(deps, j.id, { rw: 0, updated: now }).catch(() => {});   // תקציב ההפעלות — ננסה בצפייה הבאה
    if (r.json.ok) await raise(deps, uid, [{ c: 'claude', k: 'auto' }], j.id, now);
  }
  return n;
}

/* קובץ שהעובד העלה — קיים, לא בפח, ובתיקיית העבודה ב־Drive (הלקוח של הסטודיו רואה רק מה שהאפליקציה יצרה). מחזיר את הגודל, או null */
async function driveFileInFolder(deps, uid, folder, fid) {
  const t = await gdrive.accessToken(deps, uid);
  if (!t.ok) return { error: t.error };
  const r = await (deps.fetch || fetch)(DRIVE + fid + '?fields=id,name,size,parents,trashed', { headers: { Authorization: 'Bearer ' + t.token } });
  let meta = null; try { meta = await r.json(); } catch (e) {}
  if (r.status !== 200 || !meta || meta.trashed || !(Array.isArray(meta.parents) && meta.parents.includes(folder))) return null;
  return { id: fid, name: String(meta.name || '').slice(0, 200), size: Number(meta.size) || 0 };
}

/* ---------- v378: בדיקת מוכנות ותחזוקה (lib/studioscan.js) ---------- */
const DRIVE_Q = 'https://www.googleapis.com/drive/v3/';
const FOLDER_MT = 'application/vnd.google-apps.folder';
async function driveJson(deps, token, url, opt) {
  const r = await (deps.fetch || fetch)(url, Object.assign({ headers: { Authorization: 'Bearer ' + token } }, opt || {}));
  let j = null; try { j = await r.json(); } catch (e) {}
  return { status: r.status, j };
}
/* רשימה מ־Drive (עד 5 עמודים). הלקוח של הסטודיו רואה רק מה שהאפליקציה יצרה */
async function driveList(deps, token, q, fields) {
  const out = [];
  let pt = '';
  for (let i = 0; i < 5; i++) {
    const qs = new URLSearchParams({ q, fields: 'nextPageToken,files(' + fields + ')', pageSize: '200', spaces: 'drive' });
    if (pt) qs.set('pageToken', pt);
    const r = await driveJson(deps, token, DRIVE_Q + 'files?' + qs);
    if (r.status !== 200 || !r.j) throw new Error('gd_http_' + r.status);
    out.push(...(Array.isArray(r.j.files) ? r.j.files : []));
    if (!r.j.nextPageToken) break;
    pt = String(r.j.nextPageToken);
  }
  return out;
}
/* תיקיות העבודות: מתחת לתיקיית הסטודיו (snbStudio=1; גם אם נוצרה פעמיים), לכל אחת snbJob */
async function studioFolders(deps, token) {
  const roots = (await driveList(deps, token, "appProperties has { key='snbStudio' and value='1' } and trashed=false and mimeType='" + FOLDER_MT + "'", 'id'))
    .filter((r) => S.FILE_ID_RE.test(String(r.id || ''))).slice(0, 5);
  const out = [];
  for (const r of roots) {
    const kids = await driveList(deps, token, "'" + r.id + "' in parents and trashed=false and mimeType='" + FOLDER_MT + "'", 'id,appProperties,createdTime');
    for (const k of kids) {
      const job = String((k.appProperties && k.appProperties.snbJob) || '');
      if (S.FILE_ID_RE.test(String(k.id || '')) && S.JOB_RE.test(job)) out.push({ id: k.id, job, t: Date.parse(k.createdTime || '') || 0 });
    }
  }
  return out;
}
async function folderBytes(deps, token, id) {
  const files = await driveList(deps, token, "'" + id + "' in parents and trashed=false", 'size');
  return files.reduce((a, f) => a + (Number(f.size) || 0), 0);
}
/* לפח של Drive — אפשר לשחזר 30 יום. קובץ שכבר לא קיים = נוקה */
async function driveTrash(deps, token, id) {
  const r = await driveJson(deps, token, DRIVE_Q + 'files/' + id + '?fields=id', { method: 'PATCH', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }) });
  if (r.status !== 200 && r.status !== 404) throw new Error('gd_http_' + r.status);
}
/* מחיקת רשומת עבודה (כמו "מחיקה" בטלפון): הרשומה, ההתראות והתקלה שלה. הקבצים ב־Drive נשארים */
async function removeJobRec(deps, uid, job, now) {
  await delDoc(deps, 'studioJobs', job.id);
  if (job.kind === 'tr' && Array.isArray(job.fo) && job.fo.some((o) => o && o.k === 'cues')) {   // מ2 · מ7: ההפקות מחדש וגיליונות ה־AI של העבודה הולכים איתה
    for (const r of (await listJobs(deps, uid)).filter((j) => (j.kind === 'rr' || j.kind === 'ai') && j.rp === job.id)) await delDoc(deps, 'studioJobs', r.id);
  }
  await closeJobOps(deps, uid, job.id, now);
  try {   // v371 · v379: התקלה נסגרת, עם מה שעלה בטעות (לדוח)
    const d = await readDoc(deps, 'studioOps', uid);
    const inc = d && I.incCloseJob(d.inc, job.id, now, d.al, PIR.wastedUsd(job, S.effState(job, now).state));
    if (inc) await patchDoc(deps, 'studioOps', uid, { inc, updated: now });
  } catch (e) {}
}
/* מה אפשר לנקות עכשיו — תמיד סריקה טרייה (לא רשימה שמורה). תיקייה של עבודה שקיימת אצל משתמש אחר (אותו Drive בשני חשבונות) — לא נוגעים */
async function cleanTargets(deps, uid, token, jobs, now) {
  const folders = await studioFolders(deps, token);
  const ids = jobs.map((j) => j.id);
  const orphans = [];
  for (const f of SC.orphanFolders(folders, ids).slice(0, SC.MAX_FOLDERS)) {
    const other = await readJob(deps, f.job).catch(() => null);
    if (!other) orphans.push(f);
  }
  return { orphans, dupes: SC.dupeFolders(folders, jobs).slice(0, SC.MAX_FOLDERS), ck: SC.doneCheckpoints(jobs), old: SC.oldJobs(jobs, now) };
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
      const stats = job.kind === 'tr' ? await readStats(deps, job.uid) : {};
      const nm = job.kind === 'tr' && job.spec ? S.learnedNorm(stats.ns, job.spec.mode) : null;
      // v384: מצב צל — בלקיחה הראשונה בלבד (בהמשך — אותו מצב צל של העבודה). תקלה כאן לא מפילה את הלקיחה
      if (job.kind === 'tr' && job.spec && !job.c0) {
        const m = job.spec.mode, th = Object.assign({}, stats.th || {});
        const step = S.thStep(th[m], nm);
        th[m] = step.next;
        if (step.sh) { patch.sh = step.sh; job.sh = step.sh; }
        await patchDoc(deps, 'studioStats', job.uid, { th, updated: now }).catch(() => {});
      }
      // v377: יעדי השירות — נקבעים פעם אחת, בלקיחה הראשונה (ההערכה שראית בהתחלה + "הרגיל" שלך עכשיו). השעון מתחיל כאן
      if (!job.c0) patch.c0 = now;
      // 10/10/2026: התוכנית (p50 לכל שלב + אי־ודאות) מהמודל הנלמד; יעד הזמן = p90 + דקה ("חרגה" רק כשבאמת חריג)
      let ep = job.ep;
      if (job.kind === 'tr' && !ep && job.spec && job.spec.dur > 0) {
        ep = ETA.etaPlan(ETA.etaModel(stats.et, job.eng === 'api' ? 'a' : 'r', now), job.spec.mode, job.spec.dur);
        patch.ep = ep;
      }
      if (job.kind === 'tr' && !job.tg) {
        const tg = L.targets(job.spec, nm ? nm.ph : S.NORM_DEF[job.spec && job.spec.mode], S.NORM_FIXED);
        if (tg && ep) tg.t = ETA.etaTarget(ep);
        if (tg) patch.tg = tg;
      }
      if (/^[0-9a-f]{12}$/.test(String(body.ev || ''))) patch.ev = body.ev;   // v371: גרסת הסביבה של העובד ("אחרי שינוי בסביבה")
      const pv = S.normPv(body.pv); if (pv) patch.pv = pv;   // v373: גרסת ההנחיות של כל סוכן (מלאי הסוכנים)
      await patchJob(deps, id, patch);
      // v379: דוח אחרי תקלה — תקלת P1–P2 שנפתרה ועוד אין לה סיכום: הסשן הזה (Sonnet) כותב אותו מהעובדות. ספירת הבקשות — שלא לבקש לנצח
      let pir = null;
      if (job.kind === 'tr') {
        try {
          const od = await readDoc(deps, 'studioOps', job.uid);
          const x = od && PIR.pirPending(od.inc, now);
          if (x) {
            pir = PIR.pirForWorker(x, od.al);
            await patchDoc(deps, 'studioOps', job.uid, { inc: od.inc.map((y) => (y.no === x.no ? Object.assign({}, y, { pq: (y.pq || 0) + 1 }) : y)), updated: now });
          }
        } catch (e) { pir = null; }
      }
      return res.status(200).json({ ok: true, job: S.workerJob(job, nm, S.fbForWorker(stats.fb), stats.fm, stats.rl), drive: await driveFor(), pir, now });
    }
    if (body.op === 'token') return res.status(200).json({ ok: true, drive: await driveFor(), now });
    if (body.op === 'qa') return res.status(200).json({ ok: true, qa: job.qa && job.qa.id ? { id: job.qa.id, g: job.qa.g || '', a: job.qa.a || null } : null, bx: job.bx || 0, now });
    // report
    const up = S.applyReport(job, body, now);
    if (body.out != null) {
      // v358: תוצרים — כל קובץ חייב להיות בתיקיית העבודה ב־Drive (הלקוח של הסטודיו רואה רק מה שהאפליקציה יצרה)
      const outs = S.normOut(body.out);
      if (!outs || !job.folder) return res.status(400).json({ ok: false, error: 'out_bad' });
      for (const o of outs) {
        const m = await driveFileInFolder(deps, job.uid, job.folder, o.id);
        if (m && m.error) return res.status(200).json({ ok: false, error: m.error });
        if (!m) return res.status(400).json({ ok: false, error: 'out_bad' });
        o.size = Math.floor(m.size || o.size);
      }
      up.fo = outs;
    }
    if (body.hl != null && job.kind === 'tr' && job.fv && job.folder) {
      // איכויות הצפייה: המקור הוחלף בגרסה הארוזה (אותו מזהה, גודל חדש = vs) + האיכויות הנמוכות. הכל מאומת מול Drive;
      // משהו לא מסתדר — מתעלמים מהאיכויות (העבודה עצמה נגמרת כרגיל, והנגן מנגן את המקור כמו קודם)
      const hl = S.normHl(body.hl, job.fv.id), vs = Math.floor(Number(body.vs));
      let good = !!hl && vs > 0 && hl[0].size === vs;
      for (const x of good ? hl : []) {
        const m = await driveFileInFolder(deps, job.uid, job.folder, x.id);
        if (!m || m.error || m.size !== x.size) { good = false; break; }
      }
      if (good) { up.hl = hl; up.fv = Object.assign({}, job.fv, { size: vs }); }
    }
    if (body.ask != null) {
      // שאלה באמצע העבודה — מוצגת בטלפון עד שעונים או עד שהעובד ממשיך עם ברירת המחדל
      const qa = S.normAsk(body.ask);
      if (!qa) return res.status(400).json({ ok: false, error: 'ask_bad' });
      if ((job.qn || 0) >= S.ASK_MAX) return res.status(409).json({ ok: false, error: 'ask_limit' });   // לא 429: העובד מנסה שוב לבד על 429
      if (job.qa && job.qa.at) up.pz = (up.pz != null ? up.pz : job.pz || 0) + L.qaPause(job.qa, now);   // v377: השעון עצר בשאלה הקודמת
      up.qa = Object.assign(qa, { at: now, a: null });
      up.qn = (job.qn || 0) + 1;
    }
    let gateId = '', note = '';   // v382: הערה שנמסרת בנקודת השמירה
    if (body.gate != null) {
      // v367: שער — הפרה של חוק (תקציב) או אישור לפני צריבה. השרתון בונה את השאלה (בלי טקסט מ־Claude); העבודה מחכה לך
      if ((job.gn || 0) >= S.GATE_MAX) return res.status(409).json({ ok: false, error: 'gate_limit' });
      const qa = S.normGate(body.gate, S.newGateId());
      if (!qa) return res.status(400).json({ ok: false, error: 'gate_bad' });
      if (job.qa && job.qa.at) up.pz = (up.pz != null ? up.pz : job.pz || 0) + L.qaPause(job.qa, now);   // v377
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
    if (body.quality != null) { const q = S.normQuality(body.quality); if (q) up.q = q; }   // v374: מדד האיכות — לא תקין נזרק בשקט
    if (body.inj != null) { const ij = S.normInj(body.inj); if (ij) up.ij = ij; }          // v374: שומר ההזרקות
    if (body.judge != null) { const jd = S.normJudge(body.judge); if (jd) up.jd = jd; }    // v375: שופט האיכות
    if (body.gl != null) { const gl = S.normGl(body.gl); if (gl) up.gl = gl; }            // v380: זיכרון המונחים
    if (body.trace != null) {
      // v373: עקיבה (מהיומנים, בסוף העבודה) — לא תקין נזרק בשקט
      const tr = S.normTrace(body.trace);
      if (tr) up.tr = tr;
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
      const m = await driveFileInFolder(deps, job.uid, job.folder, ck.id);
      if (m && m.error) return res.status(200).json({ ok: false, error: m.error });
      if (!m) return res.status(400).json({ ok: false, error: 'ck_bad' });
      ck.size = Math.floor(m.size || ck.size);
      up.ck = S.addCk(job.ck, ck, now);
      // v382: הערה שלך שמחכה — נמסרת עכשיו, בנקודת השמירה (העובד מדפיס אותה ל־Claude ומוסיף לתדריך)
      if (job.kind === 'tr' && job.nt && S.normNoteText(job.nt.t)) {
        note = S.normNoteText(job.nt.t);
        up.nh = (Array.isArray(job.nh) ? job.nh : []).concat([{ t: note, at: job.nt.at || now, d: now }]).slice(-S.NOTE_MAX);
        up.nt = null;
      }
    }
    if (job.state === 'queued') { up.state = up.state || 'running'; up.claimed = now; up.warn = ''; if (!job.c0) up.c0 = now; }
    // v377: מחכים לסרטון מהטלפון (wv) — השעון של יעד הזמן עוצר; דיווח התקדמות הבא בלי wv ממשיך אותו (אירוע בודד — לא)
    if (body.wv === true && job.kind === 'tr') { if (!job.wv0) up.wv0 = now; }
    else if (job.wv0 && (body.st || body.done === true || body.fail === true)) { up.pz = (up.pz != null ? up.pz : job.pz || 0) + Math.max(0, now - job.wv0); up.wv0 = 0; }
    // Firestore שומר כאן מספרים שלמים — לכן סנטים (mucc), לא דולרים
    const spent = job.eng === 'api' && up.use ? S.usdOf(up.use) - (job.mucc || 0) / 100 : 0;
    if (spent > 0) up.mucc = Math.round(S.usdOf(up.use) * 100);
    if (job.kind === 'tr' && up.state === 'failed' && (job.ar || 0) < S.AUTO_RESUME_MAX) {
      // v368: תקלה חולפת (Drive / רשת) — חלון התאוששות, ואז "המשך" אוטומטי אחד
      let kinds = [];
      try { kinds = O.opsView(((await readDoc(deps, 'studioOps', job.uid)) || {}).al, now).open.filter((a) => a.j === id).map((a) => a.c + ':' + a.k); } catch (e) {}
      if (S.isTransient(up.err, kinds.concat(O.normEvents(body.ev).filter((e) => !e.ok).map((e) => e.c + ':' + e.k)))) up.rw = now + S.RECOVER_WAIT;
    }
    await patchJob(deps, id, up);
    if (spent > 0) {
      // מצב API: העלות נספרת בתקציב החודשי של המשתמש. תקלה כאן לא מפילה את הדיווח
      // קריאה וכתיבה בתנאי (updateTime) — שני דיווחים במקביל (שתי עבודות) לא דורסים זה את הסכום של זה
      for (let i = 0; i < 4; i++) {
        const st = await readDocT(deps, 'studioStats', job.uid).catch(() => undefined);
        if (st === undefined) break;
        const o = { mu: S.addMonth(st && st.mu, spent, now), updated: now };
        const ok = st && st._ut ? await patchIf(deps, 'studioStats', job.uid, o, st._ut).catch(() => true)
          : await patchDoc(deps, 'studioStats', job.uid, o).then(() => true, () => true);
        if (ok) break;
      }
    }
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
    // v379: סיכום לדוח אחרי תקלה — רק לתקלת P1–P2 של אותו משתמש שנפתרה ועוד אין לה סיכום; טקסט בלבד, מנוקה. תקלה כאן לא מפילה את הדיווח
    let pirOk = null;
    if (job.kind === 'tr' && body.pir && typeof body.pir === 'object') {
      pirOk = false;
      try {
        const od = await readDoc(deps, 'studioOps', job.uid);
        const inc = od && PIR.pirSave(od.inc, Number(body.pir.no), body.pir.t, String(body.pir.m || ''), job.id, now);
        if (inc) { await patchDoc(deps, 'studioOps', job.uid, { inc, updated: now }); pirOk = true; }
      } catch (e) {}
    }
    if (job.kind === 'tr') {
      // v365: אירועים מהעובד (vt, Drive, רשת) ומהמגדל → התראות; סוף העבודה סוגר את כולן
      if (up.state === 'done') await closeJobOps(deps, job.uid, id, now, true);
      else await raise(deps, job.uid, O.normEvents(body.ev).concat(up.tw ? O.towerEvents(up.tw) : [], up.qa && up.qa.g === 'b' ? [{ c: 'claude', k: 'budget' }] : []), id, now);
    }
    if (job.kind === 'tr') {
      // שלב 4: התראה לטלפון — מוכן / נעצרה (לא כשממתינים להמשך אוטומטי) / שאלה / אישור
      const kind = up.state === 'done' ? 'done' : up.state === 'failed' && !up.rw ? 'fail' : gateId ? 'gate' : body.ask != null && up.qa ? 'ask' : '';
      if (kind) await notify(deps, job.uid, kind, id, now);
    }
    if (job.kind === 'tr' && up.state === 'done') {
      // v363: עבודה שהסתיימה מלמדת את המגדל מה "רגיל" אצלך. תקלה כאן לא מפילה את סוף העבודה
      const smp = S.normSample(job, up.use || job.use, now);
      // 10/10/2026: וגם כמה לקח כל שלב — מזה נלמד הצפי (studioeta.js)
      const es = ETA.etaSample(Object.assign({}, job, up), now);
      if (smp || es) {
        const st0 = await readStats(deps, job.uid);
        const patchS = { updated: now };
        if (smp) patchS.ns = S.addSample(Array.isArray(st0.ns) ? st0.ns : [], smp);
        if (es) patchS.et = ETA.addEtSample(st0.et, es);
        await patchDoc(deps, 'studioStats', job.uid, patchS).catch(() => {});
      }
    }
    return res.status(200).json(Object.assign({ ok: true, stop: false, state: up.state || job.state }, gateId ? { gate: gateId } : {}, pirOk != null ? { pir: pirOk } : {}, note ? { note } : {}));
  } catch (err) {
    return res.status(502).json({ ok: false, error: /^(fs_http_|sa_http_)/.test(String(err.message)) ? String(err.message).slice(0, 30) : 'failed' });
  }
}

/* ---------- הטלפון ---------- */
async function handler(req, res, deps = {}) {
  if (req.method === 'GET') return watch(req, res, deps);   // ת7: הבדיקה המתוזמנת (בלי גוף, בלי נתונים)
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};
  if (WORKER_OPS.has(String(body.op || ''))) return worker(req, res, body, deps);
  if (SERVER_OPS.has(String(body.op || ''))) return server(req, res, body, deps);
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
  // מצב API: התקציב החודשי, השרתים (למנהל — הכל; לאחרים — רק אם יש שרת פעיל)
  const servers = async () => (await query(deps, 'studioServers', null, S.SRV_MAX + 5)).map((x) => S.serverView(x, now)).filter(Boolean)
    .sort((a, b) => a.created - b.created);
  const apiView = async (st) => {
    const list = await servers().catch(() => []);
    return { month: S.monthUsed(st.mu, now), cap: USER_MONTH(), online: list.filter((x) => x.online && !x.paused).length, servers: list.length,
      admin: isAdmin(user), capDef: S.CAP_DEF, capMax: S.CAP_MAX };
  };
  const opsFor = async (u) => { const d = await readDoc(deps, 'studioOps', u).catch(() => null) || {}; return O.opsView(d.al, now, d.mu); };
  const scFor = async (u) => { const d = await readDoc(deps, 'studioOps', u).catch(() => null) || {}; return SC.scanView(d.sc); };   // v378
  const incFor = async (u) => { const d = await readDoc(deps, 'studioOps', u).catch(() => null) || {}; return I.incView(d.inc, d.mi, d.al, now); };   // v371
  // v378: בדיקת המוכנות — עובדות → ממצאים (studioscan.js). נשמרת ב־studioOps.sc; המזהים ב־Drive לא נשמרים ולא יוצאים לטלפון
  const doScan = async () => {
    const v = await readVault(deps, uid).catch(() => null);
    const st = await readStats(deps, uid);
    const srv = await servers().catch(() => []);
    const jobs = (await listJobs(deps, uid)).filter((j) => j.kind !== 'ping');
    const f = {
      claude: { conn: !!(v && v.r), ok: (v && v.ok) || 0, servers: srv.filter((x) => x.online && !x.paused).length },
      fires: { n: S.recentFires(v && v.fh, now).length, max: S.FIRE_HOUR },
      drive: { cfg: gdrive.configured(), conn: false, err: '', free: null },
    };
    // התקציב לעבודה מול עבודה רגילה של שעה במצב ברירת המחדל (או במקסימום שבחרת, אם הוא זול יותר)
    const rl = S.normRules(st.rl);
    if (rl.b > 0) {
      const m = rl.mx && S.NORM_DEF[rl.mx] < S.NORM_DEF['opus-medium'] ? rl.mx : 'opus-medium';
      f.budget = { b: rl.b, need: S.normsView(st.ns)[m].ph + S.NORM_FIXED };
    } else f.budget = { b: 0, need: 0 };
    const tmp = SC.doneCheckpoints(jobs);
    f.clean = { ck: { n: tmp.length, b: tmp.reduce((a, x) => a + x.size, 0) }, old: { n: SC.oldJobs(jobs, now).length } };
    if (f.drive.cfg) {
      const t = await gdrive.accessToken(deps, uid);
      if (!t.ok) f.drive.err = t.error;
      else {
        f.drive.conn = true;
        try {
          const q = await driveJson(deps, t.token, DRIVE_Q + 'about?fields=storageQuota');
          const sq = q.status === 200 && q.j && q.j.storageQuota;
          if (sq && Number(sq.limit) > 0) f.drive.free = Math.max(0, Number(sq.limit) - (Number(sq.usage) || 0));
          const tg = await cleanTargets(deps, uid, t.token, jobs, now);
          for (const k of ['orphans', 'dupes']) {
            let b = 0;
            for (const x of tg[k]) b += await folderBytes(deps, t.token, x.id);
            f.clean[k] = { n: tg[k].length, b };
          }
        } catch (e) { f.drive.err = 'gd_http'; }
      }
    }
    const sc = SC.scanFindings(f, now);
    await patchDoc(deps, 'studioOps', uid, { sc, updated: now }).catch(() => {});
    return SC.scanView(sc);
  };
  try {
    if (op === 'status') {
      const v = await readVault(deps, uid);
      const d = await gdrive.driveState(deps, uid).catch(() => ({ configured: gdrive.configured(), connected: false, email: '' }));
      const st = await readStats(deps, uid);   // v363: "הרגיל" לכל מצב · v364: ספר התיקונים — למסך "מגדל הפיקוח"
      return res.status(200).json({ ok: true, conn: v && v.r ? { hint: v.hint || '', since: v.since || 0, ok: v.ok || 0 } : null,
        drive: { configured: d.configured, connected: d.connected, email: d.email }, kinds: S.WORKER_KINDS.slice(),
        norm: S.normsView(st.ns), sh: S.thView(st.th) /* v384: מצב צל לכל מצב */, wpN: W.normSubs(st.wp).length, fb: S.fbView(st.fb), fm: S.normFixMode(st.fm), ops: await opsFor(uid), inc: await incFor(uid),
        rl: S.normRules(st.rl), halt: st.halt || 0, api: await apiView(st), sc: await scFor(uid), eta: ETA.etaView(st.et, now), now });   // v367: החוקים ומתג החירום
    }
    if (op === 'push') {
      // שלב 4: התראות — key (המפתח הציבורי, ל־subscribe בטלפון) / on (מנוי של המכשיר) / off / test
      const act = String(body.act || '');
      if (act === 'key') return res.status(200).json({ ok: true, key: (await vapidKeys(deps)).pub });
      const st = await readStats(deps, uid);
      if (act === 'on') {
        const sub = W.normSub(Object.assign({}, body.sub, { l: body.lang }));
        if (!sub) return res.status(400).json({ ok: false, error: 'bad_sub' });
        const wp = W.addSub(st.wp, sub, now);
        await patchDoc(deps, 'studioStats', uid, { wp, updated: now });
        return res.status(200).json({ ok: true, n: wp.length });
      }
      if (act === 'off') {
        const wp = W.dropSub(st.wp, body.e);
        await patchDoc(deps, 'studioStats', uid, { wp, updated: now });
        return res.status(200).json({ ok: true, n: wp.length });
      }
      if (act === 'test') {
        if (limited('pt|' + uid, 6)) return res.status(429).json({ ok: false, error: 'rate_limited' });
        const subs = W.normSubs(st.wp);
        const r = subs.length ? await W.sendAll(deps, await vapidKeys(deps), subs, 'test', '', now) : { subs, sent: 0 };
        if (r.subs.length !== subs.length) await patchDoc(deps, 'studioStats', uid, { wp: r.subs, updated: now }).catch(() => {});
        return res.status(200).json({ ok: true, sent: r.sent, n: r.subs.length });
      }
      return res.status(400).json({ ok: false, error: 'bad_act' });
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
    if (op === 'price') {
      // v377: מחיר מתרגם אנושי לדקת סרטון (ל"חסכת"). 0 / ריק = ברירת המחדל ($5)
      const hpc = body.hp == null || body.hp === 0 ? 0 : L.normPrice(body.hp);
      if (body.hp != null && body.hp !== 0 && !hpc) return res.status(400).json({ ok: false, error: 'bad_price' });
      await patchDoc(deps, 'studioStats', uid, { hpc, updated: now });
      return res.status(200).json({ ok: true, hp: hpc ? hpc / 100 : L.HP_DEF, hpd: !hpc });
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
    if (op === 'srvList' || op === 'srvCreate' || op === 'srvPause' || op === 'srvRemove') {
      if (!isAdmin(user)) return res.status(403).json({ ok: false, error: 'not_admin' });
      if (op === 'srvCreate') {
        const list = await servers();
        if (list.length >= S.SRV_MAX) return res.status(409).json({ ok: false, error: 'too_many' });
        const sid = S.newServerId(), token = S.newServerToken(sid);
        const name = String(body.name || '').replace(/[^\p{L}\p{N} ._-]/gu, '').trim().slice(0, 40) || 'snb-worker-' + (list.length + 1);
        await patchDoc(deps, 'studioServers', sid, { th: S.keyHash(token), name, created: now, seen: 0, paused: false, job: '', by: uid, updated: now });
        // הטוקן מוצג פעם אחת בלבד — מדביקים אותו ב־snb-setup בשרת. בשרתון נשמר רק ה־hash
        return res.status(200).json({ ok: true, token, server: S.serverView({ id: sid, name, created: now }, now) });
      }
      if (op !== 'srvList') {
        const sid = String(body.sid || '');
        const sd = S.SRV_ID_RE.test(sid) ? await readDoc(deps, 'studioServers', sid) : null;
        if (!sd) return res.status(404).json({ ok: false, error: 'no_server' });
        if (op === 'srvPause') await patchDoc(deps, 'studioServers', sid, { paused: body.paused === true, updated: now });
        else {
          await delDoc(deps, 'studioServers', sid);   // הטוקן מת מיד — השרת יקבל 401
          if (sd.dn) await downClear(deps, sd.by || uid, sid, now);   // ת7: שרת שנפל והוסר — ההתראה נסגרת
        }
      }
      const list = await servers();
      const jobs = await query(deps, 'studioJobs', { eng: 'api' }, 100).catch(() => []);
      const busy = new Map(jobs.filter((j) => ['queued', 'running'].includes(S.effState(j, now).state) && j.sid).map((j) => [j.sid, j]));
      return res.status(200).json({ ok: true, servers: list.map((x) => Object.assign(x, { job: busy.has(x.id) ? { id: busy.get(x.id).id, name: busy.get(x.id).uid === uid && busy.get(x.id).spec ? busy.get(x.id).spec.name : '', p: busy.get(x.id).prog ? busy.get(x.id).prog : null } : null })),
        queue: jobs.filter((j) => S.effState(j, now).state === 'queued' && !j.sid).length, now });
    }
    if (op === 'mute') {
      // v368: השתקה לסוג התראה (רכיב · סוג), עם תפוגה — שעה / 4 שעות / יום; h = 0 מבטל. לא מסתירה מהציון ומהזמינות, רק מהרעש
      const d = await readDoc(deps, 'studioOps', uid).catch(() => null) || {};
      const mu = O.muteSet(d.mu, String(body.c || ''), String(body.k || ''), body.h, now);
      if (!mu) return res.status(400).json({ ok: false, error: 'bad_mute' });
      await patchDoc(deps, 'studioOps', uid, { mu, updated: now });
      return res.status(200).json({ ok: true, ops: O.opsView(d.al, now, mu) });
    }
    if (op === 'pirVote') {
      // v379: "האם הסיכום עזר" — 👍 / 👎 (0 = ביטול)
      const d = await readDoc(deps, 'studioOps', uid).catch(() => null) || {};
      const inc = PIR.pirVote(d.inc, Number(body.no), Number(body.v));
      if (!inc) return res.status(400).json({ ok: false, error: 'bad_vote' });
      await patchDoc(deps, 'studioOps', uid, { inc, updated: now });
      return res.status(200).json({ ok: true, inc: I.incView(inc, d.mi, d.al, now), now });
    }
    if (op === 'ack') {
      // v369: "אשר" — ההתראה ידועה לך (נשארת פתוחה ובציון, יורדת מהבאנר בבית)
      const no = Number(body.no);
      if (!Number.isInteger(no) || no < 1) return res.status(400).json({ ok: false, error: 'bad_alert' });
      const d = await readDoc(deps, 'studioOps', uid).catch(() => null) || {};
      const al = O.opsAck(d.al, no, now);
      if (al) await patchDoc(deps, 'studioOps', uid, { al, updated: now });
      return res.status(200).json({ ok: true, ops: O.opsView(al || d.al, now, d.mu) });
    }
    if (op === 'scan') {
      if (limited('sc|' + uid, 6)) return res.status(429).json({ ok: false, error: 'rate_limited' });
      return res.status(200).json({ ok: true, sc: await doScan(), now });
    }
    if (op === 'clean') {
      // v378: "נקה" — תיקיות ונקודות שמירה עוברות לפח של Drive (30 יום לשחזור); רשומות ישנות נמחקות כמו "מחיקה" (הקבצים נשארים)
      const k = String(body.k || '');
      if (!SC.CLEAN_KINDS.includes(k)) return res.status(400).json({ ok: false, error: 'bad_kind' });
      if (limited('sc|' + uid, 6)) return res.status(429).json({ ok: false, error: 'rate_limited' });
      const jobs = (await listJobs(deps, uid)).filter((j) => j.kind !== 'ping');
      let n = 0;
      if (k === 'old') {
        for (const j of SC.oldJobs(jobs, now)) { await removeJobRec(deps, uid, j, now); n++; }
      } else {
        const t = await gdrive.accessToken(deps, uid);
        if (!t.ok) return res.status(200).json({ ok: false, error: t.error });
        if (k === 'ck') {
          const byJob = new Map();
          for (const c of SC.doneCheckpoints(jobs)) { await driveTrash(deps, t.token, c.id); n++; byJob.set(c.job, true); }
          for (const id of byJob.keys()) await patchJob(deps, id, { ck: [] });
        } else {
          for (const x of (await cleanTargets(deps, uid, t.token, jobs, now))[k]) { await driveTrash(deps, t.token, x.id); n++; }
        }
      }
      return res.status(200).json({ ok: true, n, sc: await doScan(), now });
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
      if (!S.langReady(spec)) return res.status(400).json({ ok: false, error: 'lang_unsupported' });   // לפני ההעלאה, לא אחריה
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
        else if (e.state === 'failed' && e.err === 'no_claim' && j.state === 'queued' && !apiJob(j)) await raise(deps, uid, [{ c: 'routine', k: 'no_claim' }], j.id, now, true);
        const br = L.slaBreaches(j, now);   // v377: הפרה של יעד הזמן / התקציב — P3, פעם אחת לעבודה
        if (br.length) await raise(deps, uid, br, j.id, now, true);
      }
      // v368: חלון ההתאוששות נגמר — "המשך" אוטומטי, והרשימה נקראת מחדש
      const list = await autoRecover(deps, uid, all, now) ? (await listJobs(deps, uid)).filter((j) => j.kind !== 'ping') : all;
      // v371: התקלות — נגזרות מהרשימה המלאה (עבודה שנעלמה ממנה נמחקה)
      const ic = await syncInc(deps, uid, list, now);
      // v385: ציון חריגה — מדד חריג בהתמדה (לא קפיצה בודדת) פותח התראה לרכיב; חזר לרגיל — נסגרת
      const an = AN.anomView(list, now);
      const anOpen = !!ic && (Array.isArray(ic.al) && ic.al.some((a) => a && a.k === 'anomaly' && !a.x));
      if (an.act.length || anOpen) await raise(deps, uid, AN.anomAlerts(an), '', now, true);   // בלי חריגה ובלי התראה פתוחה — בלי קריאה נוספת
      return res.status(200).json(Object.assign({ ok: true, jobs: list.slice(0, S.MAX_STORED).map(view), kinds: S.WORKER_KINDS.slice(), now },
        ic ? { inc: I.incView(ic.inc, ic.mi, ic.al, now),
          pb: P.problemsView(S.fbView(ic.fb), ic.inc, list, now), rb: P.runbooksView(ic.fb, list, now) } : {},   // v376: בעיות וספרי הפעלה
        { ag: A.agentsView(list, now), va: L.valueView(list, now, ic ? ic.hpc : 0), slo: SLO.sloView(list, now), an }));   // v383: תקציב שגיאות — מאותה רשימה   // v377: ערך, עלות ותחזית   // v373: מלאי הסוכנים — מאותה רשימה
    }
    if (op === 'goldRun') {
      // v387: הרצה חוזרת של סט הזהב — רק בלחיצה, אחרי אומדן ואישור בטלפון (ok:true). כאן רק נוצרות העבודות ("חדשות");
      // הטלפון מתחיל כל אחת ב־op:'start' — עם כל השמירות הרגילות (מתג חירום, חוקים, תקלה רחבה, Routine / שרת)
      if (body.ok !== true) return res.status(400).json({ ok: false, error: 'confirm' });
      if ((await readStats(deps, uid)).halt) return res.status(409).json({ ok: false, error: 'halted' });
      const all = (await listJobs(deps, uid)).filter((j) => j.kind !== 'ping');
      const src = S.goldSources(all).slice(0, S.GOLD_MAX);
      if (!src.length) return res.status(400).json({ ok: false, error: 'no_gold' });
      if (all.some((j) => j.gs && S.ACTIVE.includes(S.effState(j, now).state))) return res.status(409).json({ ok: false, error: 'gold_busy' });   // הרצה קודמת עוד פתוחה
      if (all.filter((j) => S.ACTIVE.includes(S.effState(j, now).state)).length + src.length > S.MAX_ACTIVE) return res.status(409).json({ ok: false, error: 'too_many' });   // הסקירה: לא לעקוף את MAX_ACTIVE
      for (const old of all.filter((j) => S.FINAL.includes(S.effState(j, now).state) && !j.gd).slice(S.MAX_STORED - src.length)) await delDoc(deps, 'studioJobs', old.id);
      const made = [];
      for (const j of src) { const c = S.goldClone(j, S.newJobId(), uid, now); await patchJob(deps, c.id, c); made.push(view(c)); }
      return res.status(200).json({ ok: true, jobs: made });
    }
    let job = await mine(body.job);
    if (!job) return res.status(404).json({ ok: false, error: 'no_job' });
    if (op === 'job' && await autoRecover(deps, uid, [job], now)) job = await readJob(deps, job.id);   // v368
    const st = S.effState(job, now).state;
    if (op === 'job') return res.status(200).json({ ok: true, job: view(job), now });
    if (op === 'gold') {
      // v387: לסמן עבודה שהסתיימה כ"זהב" עם תרגום אנושי לייחוס (הקובץ כבר בתיקיית העבודה ב־Drive), או להסיר (ref: null)
      if (job.kind !== 'tr' || st !== 'done' || job.gs || !S.FILE_ID_RE.test(String(job.folder || ''))) return res.status(409).json({ ok: false, error: 'state' });
      if (body.ref != null && !(Array.isArray(job.fo) && job.fo.some((o) => o && o.k === 'srt'))) return res.status(409).json({ ok: false, error: 'no_srt' });   // בלי SRT אין מה להשוות
      if (body.ref == null) { await patchJob(deps, job.id, { gd: null, gq: null, updated: now }); job.gd = null; job.gq = null; return res.status(200).json({ ok: true, job: view(job) }); }
      const ref = String(body.ref || '');
      if (!S.FILE_ID_RE.test(ref)) return res.status(400).json({ ok: false, error: 'bad_params' });
      const others = (await listJobs(deps, uid)).filter((j) => j.id !== job.id && S.normGd(j.gd));
      if (others.length >= S.GOLD_MAX) return res.status(409).json({ ok: false, error: 'gold_full' });
      const f = await driveFileInFolder(deps, uid, job.folder, ref);
      if (!f) return res.status(400).json({ ok: false, error: 'file_bad' });
      if (f.error) return res.status(200).json({ ok: false, error: f.error });
      if (!(f.size > 0 && f.size <= S.GOLD_REF_MAX)) return res.status(400).json({ ok: false, error: 'file_size' });
      const gd = { r: ref, n: f.size, at: now };
      await patchJob(deps, job.id, { gd, gq: null, updated: now });
      job.gd = gd; job.gq = null;
      return res.status(200).json({ ok: true, job: view(job) });
    }
    if (op === 'goldScore') {
      // v387: הציון מול הייחוס (מחושב בטלפון — chrF + כיסוי זמן). לעבודת זהב, או להרצה חוזרת שלה
      if (job.kind !== 'tr' || st !== 'done' || !(S.normGd(job.gd) || job.gs)) return res.status(409).json({ ok: false, error: 'state' });
      const gq = S.normGq(Object.assign({}, body.gq, { at: now }));
      if (!gq) return res.status(400).json({ ok: false, error: 'bad_params' });
      await patchJob(deps, job.id, { gq, updated: now });
      job.gq = gq;
      return res.status(200).json({ ok: true, job: view(job) });
    }
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
      if (!['tr', 'rr', 'ai'].includes(job.kind) || st !== 'new') return res.status(409).json({ ok: false, error: 'state', job: view(job) });
      if (job.kind === 'ai' ? !job.fq : !job.fa && !job.fv || job.kind === 'rr' && !(job.fv && job.fc)) return res.status(409).json({ ok: false, error: 'no_files' });
      if (job.kind === 'tr' && !S.langReady(job.spec)) return res.status(400).json({ ok: false, error: 'lang_unsupported', job: view(job) });
      if (!S.WORKER_KINDS.includes(job.kind)) return res.status(200).json({ ok: false, error: 'worker_not_ready', job: view(job) });
      const stop = await ruleBlock(deps, uid, job, body);   // v367: מתג החירום / מצב מעל המקסימום
      if (stop) return res.status(409).json(Object.assign({ ok: false, job: view(job) }, stop));
      const mj = body.mo !== true ? await majorNow(deps, uid, job) : null;   // v371: תקלה רחבה — מחכים, או "להתחיל בכל זאת"
      if (mj) return res.status(409).json({ ok: false, error: 'major', mi: { c: mj.c, e: mj.e, at: mj.at, n: mj.n || 0 }, job: view(job) });
      if (apiJob(job)) {
        const q = await queueApi(deps, uid, job, now);
        return res.status(200).json(Object.assign({ ok: q.ok, job: view(await readJob(deps, job.id)) }, q.ok ? {} : { error: q.error }));
      }
      const v = await readVault(deps, uid);
      if (!v || !v.r) return res.status(200).json({ ok: false, error: 'conn_missing' });
      if (S.recentFires(v.fh, now).length >= S.FIRE_HOUR) return res.status(429).json({ ok: false, error: 'budget' });
      const f = await fireJob(deps, uid, v, job, now);
      const j = await readJob(deps, job.id);
      return res.status(200).json(Object.assign({ ok: f.ok, job: view(j) }, f.ok ? (f.unsure ? { unsure: f.unsure, detail: f.detail } : {}) : { error: f.error, retry: f.retry, detail: f.detail || '' }));
    }
    if (op === 'cuesSave') {
      // מ2: גרסה ערוכה של הכתוביות — שני קבצים שהטלפון כבר העלה לתיקיית העבודה (cues JSON + SRT); הקודמים נשמרים בהיסטוריה
      if (job.kind !== 'tr' || st !== 'done' || !S.FILE_ID_RE.test(String(job.folder || ''))) return res.status(409).json({ ok: false, error: 'state' });
      const c = String(body.c || ''), s = String(body.s || '');
      if (!S.FILE_ID_RE.test(c) || !S.FILE_ID_RE.test(s) || c === s) return res.status(400).json({ ok: false, error: 'bad_params' });
      if ((body.ev | 0) !== (job.ev || 0)) return res.status(409).json({ ok: false, error: 'stale', job: view(job) });   // נערך במקום אחר בינתיים
      const fc = await driveFileInFolder(deps, uid, job.folder, c);
      if (fc && fc.error) return res.status(200).json({ ok: false, error: fc.error });
      const fs = fc ? await driveFileInFolder(deps, uid, job.folder, s) : null;
      if (fs && fs.error) return res.status(200).json({ ok: false, error: fs.error });
      if (!fc || !fs || !(fc.size > 0 && fc.size <= S.CUES_MAX) || !(fs.size > 0 && fs.size <= S.CUES_MAX)) return res.status(400).json({ ok: false, error: 'file_bad' });
      const up = S.cuesSwap(job, fc, fs, now);
      await patchJob(deps, job.id, Object.assign({}, up, { updated: now }));
      Object.assign(job, up);
      return res.status(200).json({ ok: true, job: view(job) });
    }
    if (op === 'cuesRestore') {
      // מ2: חזרה לגרסה קודמת של הכתוביות (מההיסטוריה) — הנוכחית עוברת להיסטוריה, כמו בשמירה
      const vh = Array.isArray(job.vh) ? job.vh : [];
      const i = Number.isInteger(body.i) ? body.i : -1, e = vh[i];
      if (job.kind !== 'tr' || st !== 'done' || !e || !job.folder) return res.status(409).json({ ok: false, error: 'state' });
      if ((body.ev | 0) !== (job.ev || 0)) return res.status(409).json({ ok: false, error: 'stale', job: view(job) });
      const fc = await driveFileInFolder(deps, uid, job.folder, e.c);
      if (fc && fc.error) return res.status(200).json({ ok: false, error: fc.error });
      const fs = fc && e.s ? await driveFileInFolder(deps, uid, job.folder, e.s) : null;
      if (fs && fs.error) return res.status(200).json({ ok: false, error: fs.error });
      if (!fc || !fs) return res.status(410).json({ ok: false, error: 'file_missing' });   // נמחקה מ־Drive
      const up = S.cuesSwap(Object.assign({}, job, { vh: vh.filter((_, k) => k !== i) }), fc, fs, now);
      await patchJob(deps, job.id, Object.assign({}, up, { updated: now }));
      Object.assign(job, up);
      return res.status(200).json({ ok: true, job: view(job) });
    }
    if (op === 'rerender') {
      // מ2: הפקה מחדש מהכתוביות הנוכחיות — עבודה חדשה (rr) באותה תיקייה; מתחילים אותה ב־op:'start' (כל השמירות הרגילות)
      if (job.kind !== 'tr' || st !== 'done' || !job.fv || !(Array.isArray(job.fo) && job.fo.some((o) => o && o.k === 'cues'))) return res.status(409).json({ ok: false, error: 'state' });
      if ((await readStats(deps, uid)).halt) return res.status(409).json({ ok: false, error: 'halted' });
      const all = (await listJobs(deps, uid)).filter((j) => j.kind !== 'ping');
      if (all.some((j) => j.kind === 'rr' && j.rp === job.id && S.ACTIVE.includes(S.effState(j, now).state))) return res.status(409).json({ ok: false, error: 'rr_busy' });
      if (all.filter((j) => S.ACTIVE.includes(S.effState(j, now).state)).length >= S.MAX_ACTIVE) return res.status(409).json({ ok: false, error: 'too_many' });
      for (const old of all.filter((j) => j.kind === 'rr' && j.rp === job.id && S.FINAL.includes(S.effState(j, now).state))) await delDoc(deps, 'studioJobs', old.id);   // רק ההפקה האחרונה נשמרת
      const r = S.rrJob(job, body, S.newJobId(), uid, now);
      await patchJob(deps, r.id, r);
      return res.status(200).json({ ok: true, job: view(r) });
    }
    if (op === 'aiRun') {
      // מ7: גיליון ה־AI בהפעלה אחת — הבקשה כבר בתיקיית העבודה (הטלפון העלה); עבודה "חדשה" שמתחילים ב־start (אחרי אומדן ואישור בטלפון)
      if (job.kind !== 'tr' || st !== 'done' || !S.FILE_ID_RE.test(String(job.folder || ''))) return res.status(409).json({ ok: false, error: 'state' });
      if ((await readStats(deps, uid)).halt) return res.status(409).json({ ok: false, error: 'halted' });
      const q = String(body.q || '');
      if (!S.FILE_ID_RE.test(q)) return res.status(400).json({ ok: false, error: 'bad_params' });
      const all = (await listJobs(deps, uid)).filter((j) => j.kind !== 'ping');
      if (all.some((j) => j.kind === 'ai' && j.rp === job.id && S.ACTIVE.includes(S.effState(j, now).state))) return res.status(409).json({ ok: false, error: 'ai_busy' });
      if (all.filter((j) => S.ACTIVE.includes(S.effState(j, now).state)).length >= S.MAX_ACTIVE) return res.status(409).json({ ok: false, error: 'too_many' });
      const fq = await driveFileInFolder(deps, uid, job.folder, q);
      if (fq && fq.error) return res.status(200).json({ ok: false, error: fq.error });
      if (!fq || !(fq.size > 0 && fq.size <= S.AI_Q_MAX)) return res.status(400).json({ ok: false, error: 'file_bad' });
      for (const old of all.filter((j) => j.kind === 'ai' && j.rp === job.id && S.FINAL.includes(S.effState(j, now).state))) await delDoc(deps, 'studioJobs', old.id);
      const a = S.aiJob(job, fq, body.mode, S.newJobId(), uid, now);
      await patchJob(deps, a.id, a);
      return res.status(200).json({ ok: true, job: view(a) });
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
    if (op === 'note') {
      // v382: הערה לעובד — לעבודת תרגום שרצה / ממתינה; נקראת בנקודת השמירה הבאה. הערה שעוד לא נקראה מתחלפת
      if (job.kind !== 'tr' || (st !== 'queued' && st !== 'running')) return res.status(409).json({ ok: false, error: 'state', job: view(job) });
      const t = S.normNoteText(body.t);
      if (!t) return res.status(400).json({ ok: false, error: 'bad_note', job: view(job) });
      const sent = job.nn || (Array.isArray(job.nh) ? job.nh.length : 0) + (job.nt ? 1 : 0);
      if (!job.nt && sent >= S.NOTE_MAX) return res.status(409).json({ ok: false, error: 'note_limit', job: view(job) });
      job.nn = job.nt ? sent : sent + 1;                 // הערה שעוד לא נקראה מתחלפת — לא נספרת שוב
      job.nt = { t, at: now };
      await patchJob(deps, job.id, { nt: job.nt, nn: job.nn, updated: now });
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
      await removeJobRec(deps, uid, job, now);
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
