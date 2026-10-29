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
const crypto = require('crypto');
const { guard } = require('../lib/ibkr');
const { verifyIdToken, datastoreToken, isAdmin, emails, hasEmail } = require('../lib/gauth');
const SW = require('../lib/sitewatch');
const vault = require('../lib/vault');
const gdrive = require('../lib/gdrive').studio;
const gbrowse = require('../lib/gdrive').browse;   // 26/10/2026: רשימת הקבצים ב־Drive (drive.readonly) — לקוח נפרד
/* הסודות של השרת שלנו נקבעים בהקמה (SNB_ENV_GZ) — משתנה חדש ב־Vercel לא מגיע אליו עד הקמה מחדש. בינתיים: 421 = "לא כאן",
   והטלפון שולח את אותה בקשה ל־Vercel (installFailover ב־firebase-config.js), כמו במאגר הלמידה */
const gbRemote = () => !gbrowse.configured() && process.env.SNB_RELAY_HUB_ON === '1';   // v357: לקוח OAuth נפרד לסטודיו — לא רואה את גיבוי הספרייה
const S = require('../lib/studio');
const O = require('../lib/studioops');
const I = require('../lib/studioinc');
const P = require('../lib/studioprob');   // v376: בעיות וספרי הפעלה
const L = require('../lib/studiosla');   // v377: יעדי שירות, ערך ותחזית
const ETA = require('../lib/studioeta');
const PG = require('../lib/studioprog');   // 27/10/2026: ההתקדמות המשוערת של השלב (= הפס בטלפון) — להתראות בווילון   // 10/10/2026: צפי זמנים נלמד לכל שלב
const SC = require('../lib/studioscan');
const PIR = require('../lib/studiopir');   // v379: דוח אחרי תקלה   // v378: בדיקת מוכנות ותחזוקה
const R2 = require('../lib/r2');   // ת4: האחסון ב־Cloudflare R2
const BK = require('../lib/backup');
const OFF = require('../lib/offsite');   // 11/10/2026: גיבוי אצל ספק שני — ל־Google Drive של המנהל (הגישה דרך הלקוח של הספרייה, בתוך offsite.js)
const LM = require('../lib/libmgr');   // ס׳9: הניקוי היומי של הספרייה   // ת7: גיבוי יומי ל־R2
const SR = require('../lib/studior2');   // ת4: הקבצים של הסטודיו ב־R2 (תיקייה R2_<עבודה>, מזהה <תיקייה>_<אקראי>)
const W = require('../lib/webpush');
const UM = require('../lib/usermon');   // 29/10/2026: ניטור משתמשים במרכז הניהול   // שלב 4 בסטודיו: התראות לטלפון (Web Push עצמאי)
const SLO = require('../lib/studioslo');   // v383: תקציב שגיאות
const AN = require('../lib/studioanom');   // v385: ציון חריגה 0–10
const LR = require('../lib/studiolearn');
const LI = require('../lib/learnimpact');   // 21/10/2026: השפעת המאגר לאורך זמן
const LC = require('../lib/learncorpus');
const DL = require('../lib/devlog');   // 15/10/2026: האיסוף המלא בתקופת הפיתוח (הדגל learn_full) — לוגים, יומן הקריאות, מדדים, שגיאות מהטלפון
const DMLOG = require('../lib/dmlog');
const FNL = require('../lib/studiofnl');   // 26/10/2026: המסלול שלפני העבודה + "למה ויתרת?" (מונים בלבד)
const FAU = require('../lib/fundaudit');   // 25/10/2026: בקרת הדיוק של מנתח החברות — הסיכום הלילי מה־Release ‏fund-audit   // 24/10/2026: מאגר הנתונים מ־Studio DM — יומן ההורדות, בהסכמה מפורשת
const SU = require('../lib/studiourl');   // 22/10/2026: הורדה מקישור — בדיקת קישור בתור לעובד
const MON = require('../lib/studiomon');
const MAILER = require('../lib/mailer');
const SVC = require('../lib/services');
const DNSX = require('../lib/dnsexport');   // 26/10/2026: שליחת מיילים משלנו (מרכז הניהול ← שליחת מיילים)
const USG = require('../lib/usage');   // 23/10/2026: מעקב תעבורה/אחסון של Vercel, R2 ו־Firestore (טוקנים לקריאה בלבד)   // 22/10/2026: ניטור השרתים — היסטוריית דופק + טוקן קריאה לווידג׳ט
const SF = require('../lib/sysflags');
const YT = require('../lib/ytck');   // 25/10/2026: חשבון יוטיוב ייעודי לשרת (עוגיות מוצפנות)   // 15/10/2026: מצב תחזוקה והגדרות ודגלים (sysCfg/main)   // 15/10/2026 (מ׳2): קורפוס הטקסט — לדלי נפרד snb-learn
const AICACHE = require('../lib/aicache');   // 15/10/2026: התקרות היומיות של ה־AI (limits) — למסך AI ועלויות
const AO = require('../lib/adminov');   // 15/10/2026: מרכז הניהול — הסקירה, "מחכה לך" ו"מה רץ איפה"   // 14/10/2026: מאגר הלמידה — רשומה אנונימית לכל עבודה + לוח הבקרה של המנהל
const FSM = require('../lib/fsmeter');   // 28/10/2026: מונה קריאות Firestore לפי פעולה — ניטור השרתים והתראת fs_hot
const RL = require('../lib/relay');   // 24/10/2026: ההעברה — השרת עושה הכל, Claude דרך ה־Routine של המשתמש
const A = require('../lib/studioagents');   // v373: מלאי הסוכנים   // v371: תקלות, שורש סביר ותקלה רחבה

const PROJECT = () => process.env.FIREBASE_PROJECT_ID || 'yishaiguedj1-c786e';
const BASE = () => 'https://firestore.googleapis.com/v1/projects/' + PROJECT() + '/databases/(default)/documents';
const DRIVE = 'https://www.googleapis.com/drive/v3/files/';
const UID_RE = /^[A-Za-z0-9]{6,128}$/;
const AAD = (uid) => 'studio|' + uid + '|r';
const WORKER_OPS = new Set(['claim', 'token', 'report', 'qa', 'r2get', 'r2wup', 'r2wparts', 'r2wdone', 'r2del', 'learnPut', 'learnMedia', 'learnMediaDone', 'srcFile', 'smPut']);   // 22/10/2026: srcFile — הורדה מקישור
const RELAY_OPS = new Set(['rlPut', 'rlFix', 'rlWait', 'rlEnd', 'rlNext', 'rlMark']);   // 24/10/2026: rlPut…rlEnd = העובד (kh), rlNext/rlMark = ה־Routine (rkh)
// 24/10/2026: תרגום בטלפון — Studio לאנדרואיד (נייטיב, בלי Origin ובלי התחברות) עם מפתח לעבודה אחת (pkh — רק ה־hash)
const PHONE_OPS = new Set(['phUp', 'phParts', 'phDone', 'phFile', 'phStart', 'phJob', 'phGet', 'phBurn', 'phProg', 'phAlive', 'phClaim']);   // phClaim — 25/10/2026, שלב 3: הטלפון לוקח את העבודה ומריץ אותה
const PH_KEY_TTL = 7 * 24 * 3600e3;   // הצריבה יכולה לקרות ימים אחרי שהתרגום מוכן
const SERVER_OPS = new Set(['poll', 'beat', 'devLog', 'devMet', 'pq', 'ytCk', 'ptNext', 'ptMark', 'pulse']);   // pulse — התראת השלב בווילון כל דקה (27/10/2026)   // ptNext/ptMark — העונה לעבודות שהטלפון מריץ (25/10/2026)   // ytCk — עוגיות החשבון הייעודי (25/10/2026)   // pq — בדיקות קישור (22/10/2026)   // devLog/devMet — האיסוף המלא (lib/devlog.js)
/* מצב API: תקציב חודשי לכל משתמש (מפתח ה־API של המערכת). מעבר לזה — התקרה ב־Console של Anthropic */
const LEARN_MAX = 5000, LEARN_SYNC_MAX = 400;   // מאגר הלמידה: כמה רשומות קוראים, וכמה משלימים בכל פתיחה של לוח הבקרה
const USER_MONTH = () => Math.max(1, Math.min(10000, Number(process.env.STUDIO_API_USER_MONTH_USD) || 30));
/* 29/10/2026: תקרה לכל משתמש (studioStats.mc, נקבעת במרכז הניהול) — ואם אין, התקרה של המערכת */
const userMonth = (st) => UM.capOf(st, USER_MONTH());
const FIRE_TIMEOUT = 20000;

const hits = new Map();
function limited(key, max) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < 60000);
  arr.push(now); hits.set(key, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > max;
}
const allowed = (u) => isAdmin(u) || hasEmail(u, emails(process.env.STUDIO_USERS));

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
  if (col === 'studioJobs') obj = jmTouch(obj);
  const keys = Object.keys(obj).filter((k) => obj[k] !== undefined && k !== 'id');
  const q = keys.map((k) => 'updateMask.fieldPaths=' + k).join('&');
  const r = await fsCall(deps, 'PATCH', '/' + col + '/' + id + '?' + q, { fields: S.toFields(obj) });
  if (r.status !== 200) throw new Error('fs_http_' + r.status);
}
/* כתיבה רק אם המסמך לא השתנה מאז שקראנו אותו — שני שרתים לא לוקחים את אותה עבודה */
async function patchIf(deps, col, id, obj, updateTime) {
  if (col === 'studioJobs') obj = jmTouch(obj);
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
/* 15/10/2026: ספירה בלי לקרוא מסמכים (aggregation count) — מרכז הניהול רואה כמה, לא מה. null = לא נמדד */
async function fsCount(deps, col) {
  try {
    const r = await fsCall(deps, 'POST', ':runAggregationQuery', { structuredAggregationQuery: { structuredQuery: { from: [{ collectionId: col }] }, aggregations: [{ alias: 'n', count: {} }] } });
    const v = r.status === 200 && Array.isArray(r.j) && r.j[0] && r.j[0].result && r.j[0].result.aggregateFields && r.j[0].result.aggregateFields.n;
    return v ? +v.integerValue : null;
  } catch (e) { return null; }
}
async function delDoc(deps, col, id) {
  const r = await fsCall(deps, 'DELETE', '/' + col + '/' + id);
  if (r.status !== 200 && r.status !== 404) throw new Error('fs_http_' + r.status);
  if (col === 'studioJobs') for (const u of jobMem.users.values()) u.jobs.delete(id);
}
/* העבודות של משתמש — שאילתה עם שוויון אחד (אינדקס אוטומטי, בלי הגדרה ב־Firebase) */
async function listJobsFs(deps, uid) {
  const r = await fsCall(deps, 'POST', ':runQuery', { structuredQuery: { from: [{ collectionId: 'studioJobs' }],
    where: { fieldFilter: { field: { fieldPath: 'uid' }, op: 'EQUAL', value: { stringValue: uid } } }, limit: 300 } });
  if (r.status !== 200) throw new Error('fs_http_' + r.status);
  return (Array.isArray(r.j) ? r.j : []).filter((x) => x && x.document && x.document.name)
    .map((x) => Object.assign(S.fromFields(x.document.fields), { id: String(x.document.name).split('/').pop() }));
}
/* 29/10/2026 (התראת fs_hot: studio:jobs — 1,807 קריאות בשעה): listJobs נקרא מ־op:'jobs' ועוד ~20 מקומות, וכל קריאה = מסמך לכל
   עבודה (150+). מטמון בזיכרון של המופע: רשימה מלאה למשתמש פעם ב־JM_FULL_MS, ובין לבין שאילתה אחת לכל המשתמשים על מה שנכתב
   מאז (`mt` — חותמת שכל כתיבה ל־studioJobs מקבלת, patchDoc/patchIf; טווח על שדה אחד = אינדקס אוטומטי), ותוך JM_TTL_MS — בלי
   קריאה. כתיבה כאן מבטלת את ה־TTL (קוראים מה שכתבנו), מחיקה כאן — מוסרת מיד. מחיקה במופע אחר / כתיבה בלי patchDoc (acmerge) —
   עד הרשימה המלאה הבאה. בבדיקות עם fetch מדומה — כבוי (אלא אם deps.jobMem) */
const JM_TTL_MS = 15e3, JM_FULL_MS = 30 * 60e3, JM_OVERLAP_MS = 60e3, JM_SYNC_MAX = 300;
let jobMem = { users: new Map(), sync: 0, dirty: false };
function jmTouch(obj) { jobMem.dirty = true; return Object.assign({}, obj, { mt: Date.now() }); }
async function listJobs(deps, uid) {
  const on = deps.jobMem != null ? !!deps.jobMem : !deps.fetch;
  if (!on) return (await listJobsFs(deps, uid)).sort((a, b) => (b.created || 0) - (a.created || 0));
  const now = Date.now(), m = jobMem;
  let u = m.users.get(uid);
  if (!u || !(now >= u.full && now - u.full < JM_FULL_MS)) {
    const t0 = Date.now();
    u = { jobs: new Map((await listJobsFs(deps, uid)).map((j) => [j.id, j])), full: now };
    m.users.set(uid, u);
    if (!m.sync) { m.sync = t0; m.dirty = false; }
  } else if (m.dirty || !(now >= m.sync && now - m.sync < JM_TTL_MS)) {
    const t0 = Date.now();
    m.dirty = false;
    const r = await fsCall(deps, 'POST', ':runQuery', { structuredQuery: { from: [{ collectionId: 'studioJobs' }],
      where: { fieldFilter: { field: { fieldPath: 'mt' }, op: 'GREATER_THAN_OR_EQUAL', value: { integerValue: String(Math.round(m.sync - JM_OVERLAP_MS)) } } },
      orderBy: [{ field: { fieldPath: 'mt' }, direction: 'DESCENDING' }], limit: JM_SYNC_MAX } });
    if (r.status !== 200) { m.dirty = true; throw new Error('fs_http_' + r.status); }
    const got = (Array.isArray(r.j) ? r.j : []).filter((x) => x && x.document && x.document.name)
      .map((x) => Object.assign(S.fromFields(x.document.fields), { id: String(x.document.name).split('/').pop() }));
    if (got.length >= JM_SYNC_MAX) { m.users.clear(); m.sync = 0; return listJobs(deps, uid); }   // יותר מדי שינויים — רשימות מלאות
    for (const j of got) {
      for (const [k, x] of m.users) if (k !== j.uid) x.jobs.delete(j.id);   // עבודה שעברה משתמש (מיזוג חשבונות)
      const x = m.users.get(j.uid);
      if (x) x.jobs.set(j.id, j);
    }
    m.sync = t0;
  }
  return [...u.jobs.values()].map((j) => structuredClone(j)).sort((a, b) => (b.created || 0) - (a.created || 0));
}
const readJob = (deps, id) => readDoc(deps, 'studioJobs', id);
const patchJob = (deps, id, o) => patchDoc(deps, 'studioJobs', id, o);
const readVault = (deps, uid) => readDoc(deps, 'studioVault', uid);
/* 15/10/2026: מרכז הניהול — עובדות מבחוץ (GitHub ציבורי, sw.js החי) עם מטמון של 5 דקות במופע (GitHub בלי טוקן = 60 בשעה).
   כל תקלה = "לא ידוע" (0 / null), לא שגיאה — המסך מציג מה שיש */
const AO_TTL = 300000, AO_REPO = 'yishaiguedj1/portfolio-pwa';
const aoCache = new Map();
async function aoGet(deps, key, fn, now) {
  const c = aoCache.get(key);
  if (c && now - c.at < AO_TTL) return c.v;
  let v = null; try { v = await fn(); } catch (e) { v = null; }
  aoCache.set(key, { at: now, v });
  return v;
}
/* 15/10/2026: יומן הפעולות של מרכז הניהול (sysLog). תקלה ברישום לא מפילה את הפעולה עצמה */
async function adminLog(deps, user, k, d, now) {
  const e = AO.logEntry(k, d, user && user.email, now);
  if (!e) return;
  try { await patchDoc(deps, 'sysLog', now.toString(36) + crypto.randomBytes(3).toString('hex'), e); } catch (err) {}
}
/* 29/10/2026: הסיכום היומי למנהל — פעם ביום אחרי 21:00 בישראל (בודק fsw, כל 5 דק׳). היום שנשלח — בזיכרון וב־sysBackup/cfg.dsd */
let dailyC = '';
async function dailyPush(deps, now) {
  if (!umOn(deps)) return 0;
  const day = UM.dailyDue(now, dailyC);
  if (!day) return 0;
  dailyC = day;
  const cfg = await readDoc(deps, 'sysBackup', 'cfg').catch(() => null);
  if (!cfg || !UID_RE.test(String(cfg.uid || '')) || cfg.dsd === day) return 0;
  await patchDoc(deps, 'sysBackup', 'cfg', { dsd: day }).catch(() => {});
  const [stats, jobs] = await Promise.all([query(deps, 'studioStats', null, 500).catch(() => []), jobs30(deps, now)]);
  return notify(deps, cfg.uid, 'daily', '', now, UM.dailySum(stats, jobs || [], now));
}
/* 15/10/2026: עבודות התרגום של 30 הימים האחרונים מכל המשתמשים — למרכז הניהול (סוכנים, שרתים, שימוש). טווח + orderBy על created
   (בלי אינדקס מורכב), עד 400, מטמון 5 דק׳. null = Firestore לא ענה */
function jobs30(deps, now) {
  return aoGet(deps, 'jobs30', async () => {
    const r = await fsCall(deps, 'POST', ':runQuery', { structuredQuery: { from: [{ collectionId: 'studioJobs' }],
      where: { fieldFilter: { field: { fieldPath: 'created' }, op: 'GREATER_THAN_OR_EQUAL', value: { integerValue: String(now - 30 * 86400000) } } },
      orderBy: [{ field: { fieldPath: 'created' }, direction: 'DESCENDING' }], limit: 400 } });
    if (r.status !== 200) return null;
    return (Array.isArray(r.j) ? r.j : []).filter((x) => x && x.document && x.document.name)
      .map((x) => Object.assign(S.fromFields(x.document.fields), { id: String(x.document.name).split('/').pop() }));
  }, now);
}
let provC = { at: 0, v: null };
async function provGet(deps, now) {
  if (provC.v && now >= provC.at && now - provC.at < 120e3) return provC.v;
  const v = await USG.usageAll(process.env, deps.fetch || fetch, now);
  provC = { at: now, v };
  return v;
}
/* 26/10/2026: ההגדרות של טוקן הניטור (monKh/monAt) לפניות של הווידג׳ט ושל מסך הניטור. כשל קריאה — נזרק (503), לא נשמר */
const MON_CFG_MS = 60e3;
let monCfgC = { at: 0, v: null };
async function monCfg(deps, now) {
  if (monCfgC.v && now >= monCfgC.at && now - monCfgC.at < MON_CFG_MS) return monCfgC.v;
  const d = (await readDoc(deps, 'sysCfg', 'main')) || {};
  monCfgC = { at: now, v: { monKh: d.monKh || '', monAt: d.monAt || 0 } };
  return monCfgC.v;
}
async function aoJson(deps, url) {
  const h = { Accept: 'application/vnd.github+json', 'User-Agent': 'snb-admin' };
  if (process.env.GITHUB_TOKEN) h.Authorization = 'Bearer ' + process.env.GITHUB_TOKEN;
  const r = await (deps.fetch || fetch)(url, { headers: h, signal: AbortSignal.timeout(6000) });
  return r.status === 200 ? r.json() : null;
}
async function aoFacts(deps, now) {
  const f = deps.fetch || fetch;
  const build = (u) => aoGet(deps, 'sw|' + u, async () => { const r = await f(u, { headers: { 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(6000) }); return r.status === 200 ? AO.swBuild(await r.text()) : 0; }, now);
  const gh = await aoGet(deps, 'gh', async () => {
    const A = 'https://api.github.com/repos/' + AO_REPO;
    const [runs, prs, tags] = await Promise.all([aoJson(deps, A + '/actions/runs?status=waiting&per_page=5'), aoJson(deps, A + '/pulls?state=open&per_page=30'), aoJson(deps, A + '/tags?per_page=1')]);
    if (!runs && !prs) return null;
    return {
      waiting: ((runs && runs.workflow_runs) || []).slice(0, 5).map((w) => ({ id: Number(w.id) || 0, at: Date.parse(w.created_at) || 0 })),
      prs: (Array.isArray(prs) ? prs : []).map((p) => ({ n: Number(p.number) || 0, t: String(p.title || '').slice(0, 120), dep: /\[bot\]$/.test(String(p.user && p.user.login || '')) ? 1 : 0, at: Date.parse(p.created_at) || 0 })),
      tag: Array.isArray(tags) && tags[0] && /^v\d+\.\d+\.\d+$/.test(String(tags[0].name)) ? tags[0].name : '',
    };
  }, now);
  const [prodBuild, stagBuild] = await Promise.all([build('https://invest.thesnowball.app/sw.js'), build('https://thesnowball.pages.dev/sw.js')]);
  return { gh, prodBuild: prodBuild || 0, stagBuild: stagBuild || 0 };
}
/* 14/10/2026: מאגר הלמידה — משלימים רשומות מכל העבודות (אנונימיות, כולל ישנות ושל כל המשתמשים, בלי מי שכיבה את המתג),
   ומחזירים את כל הרשומות לפי הזמן. משותף לפעולות המנהל ולמשיכה בטוקן ניתוח */
/* 15/10/2026: בדיקת המוכנות — עובדות ציבוריות בלבד (כתובות האתר) + מוני החיבור המשותף. משותף למסך ולבדיקה המתוזמנת */
async function readyNow(deps, now) {
  const f = deps.fetch || fetch;
  const get = async (u, txt) => { try { const r = await f(u, { headers: { 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(6000) }); return { s: r.status, cc: r.headers && r.headers.get ? r.headers.get('cache-control') : null, t: txt && r.status === 200 ? await r.text() : '' }; } catch (e) { return null; } };
  const H = { invest: 'https://invest.thesnowball.app', academy: 'https://academy.thesnowball.app', studio: 'https://studio.thesnowball.app' };
  const sw = await Promise.all(Object.values(H).map((u) => get(u + '/sw.js', true)));
  const cache = {}, builds = {};
  Object.keys(H).forEach((k, i) => { const x = sw[i]; cache[k] = x && x.s === 200 ? (x.cc || '') : null; builds[k] = x && x.s === 200 ? AO.swBuild(x.t) : 0; });
  const [main, fb, links, sec] = await Promise.all([get('https://api.thesnowball.app/api/session', true), get('https://ibkr-proxy-wine.vercel.app/api/session', true), get(H.invest + '/.well-known/assetlinks.json', true), get(H.invest + '/.well-known/security.txt', true)]);
  let sess = null; try { sess = main && main.s === 200 ? { last: JSON.parse(main.t).last || [] } : null; } catch (e) {}
  let nl = null; try { nl = links && links.s === 200 ? (JSON.parse(links.t) || []).filter((x) => x && x.target && x.target.package_name).length : null; } catch (e) {}
  const sm = sec && /^Expires:\s*(\S+)/m.exec(sec.t || '');
  const yt = YT.ytView(await ytDoc(deps, now, true).catch(() => null), now);
  return AO.readyView({ now, cache, builds, sess, links: nl, api: { main: !!(main && main.s === 200), fb: !!(fb && fb.s === 200) }, sec: sm ? sm[1] : null, yt });
}
/* התשובות לבדיקות בטלפון (sysChecks) — { id: { st, n, at } } */
async function checkAnswers(deps) {
  const l = await query(deps, 'sysChecks', null, 300).catch(() => []);
  const o = {}; for (const x of l) o[x.id] = { st: x.st, n: x.n || '', at: x.at || 0, t: x.t || '' };
  return o;
}
/* 26/10/2026 (מכסת Firestore נגמרה, ומרכז הניהול איטי): כל פתיחה של מרכז הניהול קראה את *כל* מאגר הלמידה ואת *כל*
   העבודות (עד 5,000 כל אחד) — אלפי קריאות ומגה־בייטים בכל כניסה. עכשיו בזיכרון של המופע: קריאה מלאה פעם ב־LEARN_FULL_MS,
   בין לבין רק העבודות שהשתנו מאז הסנכרון הקודם (טווח על updated — אינדקס אוטומטי), ותוך LEARN_TTL_MS — בלי לקרוא בכלל.
   "מחק את התרומות שלי" מאפס (learnMem = null) */
const LEARN_TTL_MS = 60e3, LEARN_FULL_MS = 6 * 3600e3, LEARN_OVERLAP_MS = 10 * 60e3;
let learnMem = null;
async function jobsSince(deps, since, limit) {
  const r = await fsCall(deps, 'POST', ':runQuery', { structuredQuery: { from: [{ collectionId: 'studioJobs' }],
    where: { fieldFilter: { field: { fieldPath: 'updated' }, op: 'GREATER_THAN_OR_EQUAL', value: { integerValue: String(Math.round(since)) } } },
    orderBy: [{ field: { fieldPath: 'updated' }, direction: 'DESCENDING' }], limit } });
  if (r.status !== 200) throw new Error('fs_http_' + r.status);
  return (Array.isArray(r.j) ? r.j : []).filter((x) => x && x.document && x.document.name)
    .map((x) => Object.assign(S.fromFields(x.document.fields), { id: String(x.document.name).split('/').pop() }));
}
async function learnLoad(deps, now) {
  const m = learnMem;
  if (m && now >= m.at && now - m.at < LEARN_TTL_MS) return { recs: m.recs, wrote: 0 };
  const full = !m || !(now >= m.full && now - m.full < LEARN_FULL_MS);
  const have = full ? new Map((await query(deps, 'studioLearn', null, LEARN_MAX)).map((d) => [d.id, d])) : m.have;
  let wrote = 0;
  const offs = new Map();
  const jobs = full ? await query(deps, 'studioJobs', null, LEARN_MAX) : await jobsSince(deps, m.sync - LEARN_OVERLAP_MS, LEARN_SYNC_MAX);
  for (const j of jobs) {
    if (wrote >= LEARN_SYNC_MAX) break;
    if (await learnSkip(deps, j, offs)) continue;   // המשתמש כיבה את המתג / מחק את התרומות שלו
    const rec = LR.learnRec(j, now, S.effState);
    if (!rec) continue;
    const h = LR.recHash(rec), old = have.get(rec.id);
    if (old && old.h === h) continue;
    await patchDoc(deps, 'studioLearn', rec.id, { lr: rec, h, at: rec.at || now, updated: now });
    have.set(rec.id, { id: rec.id, lr: rec, h });
    wrote++;
  }
  const recs = [...have.values()].map((d) => d.lr).filter(Boolean).sort((a, b) => (a.at || 0) - (b.at || 0));
  // כתיבה שנעצרה ב־LEARN_SYNC_MAX — הפעם הבאה קריאה מלאה (כמו עד היום: כל פתיחה ממשיכה להשלים)
  learnMem = { have, recs, at: now, full: wrote >= LEARN_SYNC_MAX ? -Infinity : full ? now : m.full, sync: now };
  return { recs, wrote };
}
/* טוקני ניתוח: המזהה = sha256 של הטוקן (40 תווים) — הטוקן עצמו לא נשמר. לטלפון: שם, מתי נוצר/פג/שימוש אחרון — בלי מי יצר */
const AT_DAYS = 30, AT_MAX = 5;
const AT_RE = /^snbL_[A-Za-z0-9_-]{32}$/;
const atId = (tok) => crypto.createHash('sha256').update(String(tok)).digest('hex').slice(0, 40);
const atView = (t) => ({ id: t.id, n: String(t.n || ''), at: t.at || 0, exp: t.exp || 0, last: t.last || 0, uses: t.uses || 0 });
/* משיכה בטוקן ניתוח — שרת לשרת (סשן של Claude Code), בלי Origin ובלי Firebase. קריאה בלבד: הרשומות האנונימיות + החבילה */
async function learnPull(req, res, body, deps) {
  const tok = String(body.at || '');
  if (!AT_RE.test(tok)) return res.status(401).json({ ok: false, error: 'bad_token' });
  if (limited('at|' + atId(tok).slice(0, 12), 6)) return res.status(429).json({ ok: false, error: 'rate_limited' });
  const now = deps.now || Date.now();
  try {
    const t = await readDoc(deps, 'sysTokens', atId(tok));
    if (!t || !(t.exp > now)) return res.status(401).json({ ok: false, error: 'bad_token' });
    const { recs } = await learnLoad(deps, now);
    await patchDoc(deps, 'sysTokens', t.id, { last: now, uses: (t.uses || 0) + 1 }).catch(() => {});
    const view = LR.learnView(recs, now);
    // 15/10/2026: גם התשובות של המנהל לבדיקות בטלפון — כך הסשן יודע מה עובד ומה לא (רק כותרת, מצב והערה של המנהל)
    const checks = Object.entries(await checkAnswers(deps)).map(([id, x]) => ({ id, t: x.t, st: x.st, n: x.n, at: x.at }));
    // מ׳2: קורפוס הטקסט — המספרים תמיד; הפריטים עצמם (עד 20) רק כשהסשן ביקש (ci) — לניתוח ב־Claude שבמנוי
    const corpus = await learnCorpusView(deps, Math.max(0, Math.min(20, Math.floor(+body.ci || 0)))).catch(() => ({ on: false, error: 'r2' }));
    // 22/10/2026 (בקשת המשתמש — מעבר דקה־דקה על הסרטונים): הקול / ה־240p של עד 4 עבודות — קישור קריאה חתום לשעה + המפתח
    const media = Array.isArray(body.mi) ? await learnMediaPull(deps, body.mi, body.mv === true).catch(() => ({})) : undefined;
    return res.status(200).json(Object.assign({ ok: true, v: LR.LR_V, at: now, brief: LR.learnBrief(view, now), view, records: recs, checks, corpus }, media ? { media } : {}));
  } catch (e) {
    return res.status(502).json({ ok: false, error: /^fs_http_/.test(String(e.message)) ? String(e.message).slice(0, 20) : 'failed' });
  }
}
/* הקול (ותמיד רק כשביקשו — גם ה־240p) של עבודות מהמאגר, לניתוח בסשן של Claude Code בטוקן הניתוח: קישור GET חתום לשעה
   ומפתח ה־CENC (פתיחת הכספת כאן — המפתח לא נשמר גלוי בדלי). עד 4 עבודות בבקשה */
async function learnMediaPull(deps, ids, withVideo) {
  const c = learnCfg();
  if (!c.ok) return {};
  const rd = r2deps(deps);
  const want = ids.filter((x) => LC.LID_RE.test(String(x))).slice(0, 4);
  const keys = await R2.list(c, rd, 'm/', 50000);
  const out = {};
  for (const lid of want) {
    for (const k of withVideo ? ['a', 'v'] : ['a']) {
      const mk = keys.map((x) => LC.parseKey(x.key)).find((p) => p && p.kind === 'm' && p.lid === lid && p.mk === k && p.part === 'mp4');
      if (!mk) continue;
      const kw = vault.open(await R2.getText(c, rd, LC.mKey(mk.month, lid, k, 'key'), 4096).catch(() => ''), 'learn|' + lid + '|' + k);
      if (!kw || !/^[0-9a-f]{32}$/.test(String(kw.k || ''))) continue;
      const url = await R2.presign(c, rd, { method: 'GET', key: LC.mKey(mk.month, lid, k, 'mp4'), expires: 3600 });
      (out[lid] = out[lid] || {})[k] = { url, key: kw.k };
    }
  }
  return out;
}
/* 14/10/2026 (בקשת המשתמש): המתג "שיפור התרגום בעזרת העבודות שלי" בהגדרות — כבוי (studioStats.lo = 1) = העבודות של
   המשתמש לא נכנסות למאגר מעכשיו. 15/10 (מ׳1): "מחק את התרומות שלי" (studioStats.lf = מתי) — עבודה שנוצרה עד אז לא נכנסת שוב.
   תקלה בקריאה = לא שומרים (זהירות) */
async function learnSkip(deps, job, cache) {
  if (!(await flagOn(deps, 'learn'))) return true;   // 15/10/2026: הדגל "איסוף למאגר הלמידה" כבוי — לכולם
  const uid = job.uid;
  let p = cache && cache.get(uid);
  if (!p) {
    try { const st = (await readDoc(deps, 'studioStats', uid)) || {}; p = { off: !!st.lo, lf: +st.lf || 0 }; } catch (e) { p = { off: true, lf: 0 }; }
    if (cache) cache.set(uid, p);
  }
  return p.off || (p.lf > 0 && (+job.created || 0) <= p.lf);
}
/* הרשומות של עבודות שנמחקו — כדי ש"מחק את התרומות שלי" ימחק גם אותן. רק המזהים המגובבים, במסמך הפרטי של המשתמש (studioStats.lgn) */
const LGN_MAX = 400;
async function learnGone(deps, uid, ids, now) {
  try {
    const st = (await readDoc(deps, 'studioStats', uid)) || {};
    const have = String(st.lgn || '').split(',').filter((x) => /^[0-9a-f]{20}$/.test(x));
    const all = [...new Set([...have, ...ids.map(LR.lid)])].slice(-LGN_MAX);
    await patchDoc(deps, 'studioStats', uid, { lgn: all.join(','), updated: now });
  } catch (e) {}
}
/* 14/10/2026: מאגר הלמידה — רשומה אנונימית לכל עבודה (studioLearn/{מזהה מגובב}), נשארת גם אחרי מחיקת העבודה.
   בלי uid, שמות, מזהי קבצים או טקסט (studiolearn.js). כתיבה רק כשהרשומה השתנתה. תקלה כאן לא מפילה שום פעולה */
async function learnSave(deps, job, now, offCache) {
  try {
    if (await learnSkip(deps, job, offCache)) return;
    const rec = LR.learnRec(job, now, S.effState);
    if (!rec) return;
    await patchDoc(deps, 'studioLearn', rec.id, { lr: rec, h: LR.recHash(rec), at: rec.at || now, updated: now });
  } catch (e) {}
}
/* ---------- מאגר הלמידה מ׳2 (15/10/2026): קורפוס הטקסט בדלי נפרד ----------
   הדלי snb-learn עם מפתח משלו (R2L_* במשתני Vercel; החשבון — R2L_ACCOUNT_ID או של snb-studio). בלי הגדרה — לא נשמר כלום.
   העובד שולח בסוף העבודה (learnPut, מפתח העבודה) → ניקוי ורשימה מותרת (lib/learncorpus.js) → הצפנה (vault, AAD learn|<lid>)
   → התור q/<lid>.bin. פעם ביום (learnBatch מתוך watch) התור עובר ל־c/<חודש>/<lid>.bin — כך זמן הקובץ בדלי הוא זמן האצווה,
   לא הרגע שבו המשתמש הריץ עבודה. התוכן נמחק אחרי 24 חודשים; הרשומות המספריות (studioLearn) נשארות.
   נשמר רק כשהמתג דולק, ההודעה נקראה (lra — הסכמה לתוכן), והעבודה לא כבר נשמרה (lc). תקלה כאן לעולם לא מפילה את סוף העבודה */
const LC_MAX_BODY = 4000000;   // 15/10: עד 4MB — באיסוף המלא גם קבצי הטקסט של הפרויקט (Vercel: 4.5MB)
const learnCfg = (env = process.env) => R2.config({ R2_ACCOUNT_ID: env.R2L_ACCOUNT_ID || env.R2_ACCOUNT_ID, R2_ACCESS_KEY_ID: env.R2L_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY: env.R2L_SECRET_ACCESS_KEY, R2_BUCKET: env.R2L_BUCKET, R2_JURISDICTION: env.R2L_JURISDICTION || env.R2_JURISDICTION });
/* 15/10/2026: שרת שהוקם בלי המפתחות של הדלי (Sensitive ב־Vercel ולא ב־PROD_APP_EXTRA — tools/server-provision.js כותב
   SNB_LEARN_REMOTE=1). פעולה מהטלפון שנוגעת בדלי לא "מצליחה" כאן בלי לעשות כלום — 421 לפני כל שינוי, והטלפון שולח את
   אותה בקשה ל־Vercel (installFailover ב־firebase-config.js). בלי הדלי בשום מקום (בלי הדגל) — כמו קודם */
const learnRemote = (env = process.env) => env.SNB_LEARN_REMOTE === '1' && !learnCfg(env).ok;
const LEARN_REMOTE_OPS = new Set(['learnForget', 'learn', 'adminDm']);   // adminDm — יומני Studio DM (24/10)
/* 28/10/2026: זיכרון סדרה — sm/<uid>.json ב־R2 (lib/studio.js: seriesOf, smMerge). המפתח של הסדרה — משם הקובץ שבעבודה,
   לא ממה שהעובד שולח. בלי R2 / בלי סדרה בשם / תקלה — בלי זיכרון (העבודה לא נעצרת בגלל זה) */
async function smRead(deps, job) {
  const ser = S.jobSeries(job), c = R2.config(), key = S.smKey(job.uid);
  if (!ser || !c.ok || !key) return null;
  try { return S.smForWorker(S.smParse(await R2.getText(c, r2deps(deps), key, S.SM_BYTES)), ser); } catch (e) { return null; }
}
async function smPut(deps, job, sm, now) {
  const ser = S.jobSeries(job), c = R2.config(), key = S.smKey(job.uid);
  if (job.kind !== 'tr' || !ser || !c.ok || !key) return false;
  const add = S.normSm(sm);
  if (!add.gl.length && !add.ch.length) return false;
  const rd = r2deps(deps);
  const doc = S.smParse(await R2.getText(c, rd, key, S.SM_BYTES).catch(() => null));
  await R2.putText(c, rd, key, JSON.stringify(S.smMerge(doc, ser, add, now)), 'application/json');
  return true;
}
async function learnPut(deps, job, b64, now) {
  try {
    const c = learnCfg();
    if (!c.ok || job.kind !== 'tr' || job.lc || typeof b64 !== 'string' || b64.length > LC_MAX_BODY) return false;
    if (await learnSkip(deps, job)) return false;
    const st = (await readDoc(deps, 'studioStats', job.uid)) || {};
    if (!(+st.lrt > 0)) return false;   // 15/10/2026: ההסכמה לטקסט (lrt) — רק אחרי שאושר הנוסח שאומר שהטקסט נשמר; lra הישן ("רק מספרים") לא מספיק
    const raw = require('zlib').gunzipSync(Buffer.from(b64, 'base64'), { maxOutputLength: 16 * 1024 * 1024 });
    const full = await learnFull(deps, job, st);   // 15/10/2026: האיסוף המלא — בלי scrub, עם קבצי הטקסט ותמונת העבודה
    const item = LC.normCorpus(JSON.parse(raw.toString('utf8')), LC.monthOf(now), full);
    if (!item) return false;
    if (full) Object.assign(item, fullExtras(job));
    const lid = LR.lid(job.id);
    await R2.putText(c, r2deps(deps), LC.qKey(lid), vault.seal(item, 'learn|' + lid), 'application/octet-stream');
    await patchJob(deps, job.id, { lc: now });
    return true;
  } catch (e) { return false; }
}
/* מ׳3: העריכות שלך בעורך הכתוביות — אותם תנאים של learnPut (המתג, ההודעה נקראה), פריט אחד לעבודה שמצטבר בכל שמירה:
   הקיים נפתח (מהתור qe/ או מהחודש e/<le>/), השמירה החדשה נוספת (LC.addEdits), ונכתב לתור. job.le = החודש של הפריט */
const LE_MAX = 1500000;
const LRN_TV = 2;   // **זהה ל־LRN_TV ב־studio.js** — הנוסח של ההודעה שאומר שגם הטקסט נשמר
async function learnEditPut(deps, job, sess, now) {
  try {
    const c = learnCfg();
    if (!c.ok || job.kind !== 'tr' || !sess || typeof sess !== 'object') return false;
    if (JSON.stringify(sess).length > LE_MAX) return false;
    if (await learnSkip(deps, job)) return false;
    const st = (await readDoc(deps, 'studioStats', job.uid)) || {};
    if (!(+st.lrt > 0)) return false;   // ההסכמה לטקסט — כמו ב־learnPut
    const lid = LR.lid(job.id), rd = r2deps(deps), aad = 'learn|' + lid;
    let prev = vault.open(await R2.getText(c, rd, LC.qeKey(lid), LE_MAX * 3), aad);
    if (!prev && /^\d{4}-\d{2}$/.test(String(job.le || ''))) prev = vault.open(await R2.getText(c, rd, LC.eKey(job.le, lid), LE_MAX * 3), aad);
    const item = LC.addEdits(prev, sess, LC.monthOf(now));
    if (!item) return false;
    await R2.putText(c, rd, LC.qeKey(lid), vault.seal(item, aad), 'application/octet-stream');
    if (job.le !== item.m) await patchJob(deps, job.id, { le: item.m });
    return true;
  } catch (e) { return false; }
}
/* מ׳4 (15/10/2026): הקול (Opus 32kbps) והעותק ב־240p. העובד מבקש קישור לכל סוג (learnMedia) → מפתח הצפנה חדש לעבודה
   (16 בתים, CENC של ffmpeg) עטוף בכספת ליד הקובץ + קישור PUT חתום לשעה → העובד מצפין בזמן הקידוד ומעלה ישירות לדלי →
   learnMediaDone בודק את הגודל ורושם (job.lm). אותם תנאים של הקורפוס, ובנוסף ההודעה שאומרת שגם הקול ועותק קטן נשמרים (lrm).
   לא נשמר: המקור המלא. נמחק אחרי 24 חודשים ובמחיקת התרומות. תקלה כאן לעולם לא מפילה את סוף העבודה */
const LRN_MV = 3;   // **זהה ל־LRN_TV ב־studio.js** — הנוסח שאומר שגם הקול ועותק ב־240p נשמרים
async function learnMedia(deps, job, k, now) {
  try {
    const c = learnCfg();
    if (!c.ok || job.kind !== 'tr' || !LC.MEDIA_KINDS.includes(k) || String(job.lm || '').includes(k)) return null;
    if (job.spec && job.spec.ph === 1) return null;   // 25/10/2026: תרגום בטלפון — הסרטון והקול לא עוזבים את הטלפון
    if (await learnSkip(deps, job)) return null;
    const st = (await readDoc(deps, 'studioStats', job.uid)) || {};
    if (!(+st.lrm > 0)) return null;
    const lid = LR.lid(job.id), rd = r2deps(deps);
    const month = /^\d{4}-\d{2}$/.test(String(job.lmm || '')) ? job.lmm : LC.monthOf(now);   // הקול והסרטון באותו חודש
    const key = crypto.randomBytes(16).toString('hex'), kid = crypto.randomBytes(16).toString('hex');
    await R2.putText(c, rd, LC.mKey(month, lid, k, 'key'), vault.seal({ k: key, i: kid, at: now }, 'learn|' + lid + '|' + k), 'application/octet-stream');
    const url = await R2.presign(c, rd, { method: 'PUT', key: LC.mKey(month, lid, k, 'mp4'), expires: 3600 });
    if (job.lmm !== month) await patchJob(deps, job.id, { lmm: month });
    return { url, key, kid, max: LC.MEDIA_MAX[k] };
  } catch (e) { return null; }
}
async function learnMediaDone(deps, job, k) {
  try {
    const c = learnCfg();
    if (!c.ok || !LC.MEDIA_KINDS.includes(k) || !/^\d{4}-\d{2}$/.test(String(job.lmm || '')) || String(job.lm || '').includes(k)) return false;
    const lid = LR.lid(job.id), rd = r2deps(deps);
    const h = await R2.head(c, rd, LC.mKey(job.lmm, lid, k, 'mp4'));
    if (!h || !(h.size > 0) || h.size > LC.MEDIA_MAX[k]) {   // לא הגיע / גדול מהמותר — לא נשאר כלום
      for (const part of ['mp4', 'key']) await R2.del(c, rd, LC.mKey(job.lmm, lid, k, part)).catch(() => {});
      return false;
    }
    await patchJob(deps, job.id, { lm: String(job.lm || '') + k });
    return true;
  } catch (e) { return false; }
}
/* האצווה היומית: q → c/<חודש>, ומחיקת חודשים ישנים מ־24. פעם ביום (sysLearn/batch.day). מחזיר כמה עברו, ‎0 = לא היום */
const LC_BATCH_MAX = 500;
async function learnBatch(deps, now) {
  const c = learnCfg();
  if (!c.ok || process.env.SNB_LEARNBATCH === 'off') return 0;
  const day = new Date(now).toISOString().slice(0, 10);
  const b = (await readDoc(deps, 'sysLearn', 'batch').catch(() => null)) || {};
  if (b.day === day) return 0;
  await patchDoc(deps, 'sysLearn', 'batch', { day, at: now });
  const rd = r2deps(deps);
  let moved = 0, gone = 0;
  for (const it of (await R2.list(c, rd, 'q/', LC_BATCH_MAX)).slice(0, LC_BATCH_MAX)) {
    const p = LC.parseKey(it.key);
    if (!p || p.kind !== 'q') continue;
    const sealed = await R2.getText(c, rd, it.key, LC_MAX_BODY * 2);
    const item = sealed && vault.open(sealed, 'learn|' + p.lid);
    if (item && /^\d{4}-\d{2}$/.test(String(item.m || ''))) { await R2.copy(c, rd, it.key, LC.cKey(item.m, p.lid), 'application/octet-stream'); moved++; }
    await R2.del(c, rd, it.key);   // לא נפתח (מפתח אחר / שובש) — לא נשאר בתור לנצח
  }
  for (const it of (await R2.list(c, rd, 'qe/', LC_BATCH_MAX)).slice(0, LC_BATCH_MAX)) {   // מ׳3: העריכות — אותו מסלול
    const p = LC.parseKey(it.key);
    if (!p || p.kind !== 'qe') continue;
    const sealed = await R2.getText(c, rd, it.key, LE_MAX * 3);
    const item = sealed && vault.open(sealed, 'learn|' + p.lid);
    if (item && /^\d{4}-\d{2}$/.test(String(item.m || ''))) { await R2.copy(c, rd, it.key, LC.eKey(item.m, p.lid), 'application/octet-stream'); moved++; }
    await R2.del(c, rd, it.key);
  }
  for (const pre of ['c/', 'e/', 'm/']) {
    for (const it of await R2.list(c, rd, pre, 50000)) {
      const p = LC.parseKey(it.key);
      if (p && (p.kind === 'c' || p.kind === 'e' || p.kind === 'm') && LC.expired(p.month, now)) { await R2.del(c, rd, it.key); gone++; }
    }
  }
  gone += await devGc(deps, now).catch(() => 0);   // האיסוף המלא: לוגים ומדדים מעל 30 יום
  gone += await dmGc(deps, now).catch(() => 0);    // יומני Studio DM מעל 24 חודשים
  await patchDoc(deps, 'sysLearn', 'batch', { day, at: now, mv: moved, gn: gone });
  return moved;
}
/* "מחק את התרומות שלי": כל פריט שהמזהה שלו ברשימה — בתור ובחודשים. מחזיר כמה נמחקו */
async function learnCorpusForget(deps, ids) {
  const c = learnCfg();
  if (!c.ok || !ids.size) return 0;
  let n = 0;
  try {
    const rd = r2deps(deps);
    for (const pre of ['q/', 'c/', 'qe/', 'e/', 'm/']) {
      for (const it of await R2.list(c, rd, pre, 50000)) {
        const p = LC.parseKey(it.key);
        if (p && ids.has(p.lid)) { await R2.del(c, rd, it.key); n++; }
      }
    }
  } catch (e) {}
  return n;
}
/* למנהל ולסשן הניתוח: כמה פריטים, כמה בתור, כמה MB — מרשימת המפתחות בלבד. items = עד n פריטים פתוחים, מהחודש החדש */
async function learnCorpusView(deps, items) {
  const c = learnCfg();
  if (!c.ok) return { on: false };
  const rd = r2deps(deps);
  const keys = [...await R2.list(c, rd, 'q/', 5000), ...await R2.list(c, rd, 'c/', 50000), ...await R2.list(c, rd, 'qe/', 5000), ...await R2.list(c, rd, 'e/', 50000), ...await R2.list(c, rd, 'm/', 50000)];
  const out = Object.assign({ on: true }, LC.corpusStats(keys));
  if (items > 0) {
    const list = [];
    // 24/10/2026 (בקשת המשתמש): גם עבודות שעוד בתור (q/) — עד האצווה היומית עבודה שהסתיימה עכשיו לא נראתה בניתוח.
    // התור קודם (החדשות), ואחריו c/ מהחדש לישן; אותה עבודה פעם אחת. q:1 = עוד לא עברה באצווה
    const rank = (k) => (k.lastModified ? Date.parse(k.lastModified) || 0 : 0);
    const qd = keys.filter((k) => (LC.parseKey(k.key) || {}).kind === 'q').sort((a, b) => rank(b) - rank(a));
    const cd = keys.filter((k) => (LC.parseKey(k.key) || {}).kind === 'c').sort((a, b) => (a.key < b.key ? 1 : -1));
    const seen = new Set();
    for (const it of [...qd, ...cd]) {
      if (list.length >= Math.min(items, 20)) break;
      const p = LC.parseKey(it.key);
      if (seen.has(p.lid)) continue;
      const x = vault.open(await R2.getText(c, rd, it.key, LC_MAX_BODY * 2), 'learn|' + p.lid);
      if (!x) continue;
      seen.add(p.lid);
      if (p.kind === 'q') x.q = 1;
      const ek = keys.find((k) => { const q = LC.parseKey(k.key); return q && q.lid === p.lid && (q.kind === 'e' || q.kind === 'qe'); });   // מ׳3: העריכות של אותה עבודה
      const ed = ek ? vault.open(await R2.getText(c, rd, ek.key, LE_MAX * 3), 'learn|' + p.lid) : null;
      list.push(Object.assign({ id: p.lid }, x, ed ? { ed: ed.ss } : {}));
    }
    out.items = list;
  }
  return out;
}
/* ---------- האיסוף המלא בתקופת הפיתוח (15/10/2026, בקשת המשתמש — הדגל learn_full במרכז הניהול) ----------
   לכבות כשיהיו משתמשים. בדלי של מאגר הלמידה (snb-learn), מוצפן (AAD dev|<המפתח>), תחת d/<יום>/<סוג>/ — נמחק אחרי 30 יום.
   - j: מהשרת בסוף כל עבודה / כשהיא תקועה — סוף הלוג, traceback, מצב התהליכים, יומן הקריאות ל־Claude. רק לעבודה שהבעלים
     שלה אישר את הנוסח של האיסוף המלא (lrf) — הלוג כולל את שם הקובץ ומשפטים מהעבודה.
   - m: מדדי השרת (מעבד/זיכרון/דיסק) פעם בדקה, במנות. בלי תוכן — רק הדגל.
   - e: שגיאות JavaScript מהטלפון (Academy, Studio) — רק של המנהל.
   משיכה לקריאה בלבד: devPull בטוקן הניתוח (tools/dev-pull.js). בלי Firestore — כל פריט = קובץ אחד בדלי. */
const LRN_FV = 4;   // **זהה ל־LRN_TV ב־studio.js** — הנוסח שאומר שבתקופת הפיתוח נשמר הכל (שם הקובץ, הטקסט המלא, הלוגים)
const FULL_KINDS = ['tr', 'rr', 'ai'];   // עבודות שהיומן שלהן נאסף במצב המלא (הקורפוס — רק תרגום, learnPut)
async function learnFull(deps, job, st) {
  try {
    // 22/10/2026: גם הפקה מחדש וגיליון ה־AI — הפקה ש"נלקחה ולא רצה" (באג agent.AUTO_KINDS) לא השאירה שורת יומן אחת
    if (!(await flagOn(deps, 'learn_full')) || !FULL_KINDS.includes(job.kind) || (await learnSkip(deps, job))) return false;
    const s = st || (await readDoc(deps, 'studioStats', job.uid)) || {};
    return +s.lrf > 0;
  } catch (e) { return false; }
}
/* מה שהשרתון יודע ומוסיף לפריט במאגר במצב המלא: שם הקובץ, ההערות שלך, השאלות והתשובות, ותמונת העבודה (בלי סודות) */
function fullExtras(job) {
  const spec = job.spec || {};
  const o = { fn: DL.text(spec.name, 300), jb: DL.jobSnap(job) };
  if (Array.isArray(job.nh) && job.nh.length) o.nh = DL.jobSnap(job.nh);
  if (job.qa) o.qa = DL.jobSnap(job.qa);
  return o;
}
async function devPut(deps, kind, item, now) {
  const c = learnCfg();
  if (!c.ok || !item) return false;
  const id = DL.newId(now, crypto.randomBytes(6).toString('hex').replace(/[^a-z0-9]/g, ''));
  const key = DL.dKey(now, kind, id);
  await R2.putText(c, r2deps(deps), key, vault.seal(item, 'dev|' + key), 'application/octet-stream');
  return true;
}
/* מהשרת (טוקן השרת): devLog = היומן של עבודה, devMet = מנת מדדים */
async function devSrv(deps, body, sid, now) {
  try {
    if (!(await flagOn(deps, 'learn_full', now))) return false;
    if (body.op === 'devMet') {
      const m = DL.normMet(body.d);
      return m ? devPut(deps, 'm', Object.assign(m, { sid }), now) : false;
    }
    const l = DL.normJobLog(body.d);
    if (!l) return false;
    const job = await readJob(deps, l.job);
    if (!job || job.sid !== sid && job.sid !== '' || !(await learnFull(deps, job))) return false;   // רק עבודה שהשרת הזה לקח
    return devPut(deps, 'j', Object.assign(l, { sid, eng: job.eng || '', mode: (job.spec && job.spec.mode) || '' }), now);
  } catch (e) { return false; }
}
/* מהטלפון (Academy / Studio): שגיאות JavaScript — רק של המנהל, רק כשהדגל דולק */
async function devErr(deps, user, body, now) {
  try {
    if (!isAdmin(user) || !(await flagOn(deps, 'learn_full', now))) return false;
    if (limited('de|' + user.uid, 6)) return false;
    return devPut(deps, 'e', DL.normErrs(body), now);
  } catch (e) { return false; }
}
/* Studio DM (24/10/2026): יומן ההורדות מהאפליקציה הנייטיב — בלי Origin (אפליקציה, לא דף), התחברות Firebase (Google ב־DM)
   והסכמה בנוסח הנוכחי (cv). לכל משתמש מחובר — לא רק למי שפתוח לו הסטודיו. dmForget = "מחק את הנתונים שלי" */
async function dmOps(req, res, body, deps) {
  // שלב 7 (appscope): הפעולה של Studio — בלי guard (אין Origin לאפליקציה נייטיב), לכן כאן: טוקן של Invest/Academy (טענת app) = 403
  const ta = require('../lib/appscope').tokenApp(body.idToken);
  if (ta && ta !== 'studio' && ta !== 'all') return res.status(403).json({ ok: false, error: 'wrong_app' });
  let user;
  try { user = await verifyIdToken(body.idToken, deps.verify || {}); } catch (e) { return res.status(401).json({ ok: false, error: 'no_auth' }); }
  if (!UID_RE.test(String(user.uid || ''))) return res.status(401).json({ ok: false, error: 'no_auth' });
  if (limited('dm|' + user.uid, 12)) return res.status(429).json({ ok: false, error: 'rate_limited' });
  const c = learnCfg();
  if (!c.ok) return res.status(learnRemote() ? 421 : 503).json({ ok: false, error: learnRemote() ? 'learn_remote' : 'not_configured' });
  if (!vault.configured()) return res.status(503).json({ ok: false, error: 'vault_not_configured' });
  const rd = r2deps(deps), now = deps.now || Date.now();
  try {
    if (body.op === 'dmForget') {
      let n = 0;
      for (const it of await R2.list(c, rd, DMLOG.userPrefix(user.uid, 'snb'), 50000)) { await R2.del(c, rd, it.key); n++; }
      return res.status(200).json({ ok: true, deleted: n });
    }
    const b = DMLOG.normBatch(body);
    if (!b) return res.status(+body.cv === DMLOG.DMC_V ? 400 : 409).json({ ok: false, error: +body.cv === DMLOG.DMC_V ? 'bad_params' : 'consent' });
    const id = now.toString(36) + '-' + crypto.randomBytes(5).toString('hex');
    const key = DMLOG.dmKey(user.uid, 'snb', now, id);
    await R2.putText(c, rd, key, vault.seal(Object.assign({ v: DMLOG.DMC_V, at: now }, b), 'dm|' + key), 'application/octet-stream');
    return res.status(200).json({ ok: true, saved: b.ev.length });
  } catch (e) { return res.status(503).json({ ok: false, error: 'store' }); }
}
/* Studio Browser (27/10/2026, בקשת המשתמש: "שהמידע בדרייב מוצפן — שרק המשתמש עם החשבון במערכת שלנו יוכל לקרוא"):
   מפתח ההצפנה של הסנכרון בין המכשירים. הנתונים ב־Google Drive של המשתמש, המפתח אצלנו — Google לא יכול לקרוא אותם, ומשתמש
   אחר לא מקבל את המפתח (נגזר מהכספת + ה־uid, AAD לא נחוץ). בלי Firestore ובלי אחסון: אותו uid = אותו מפתח, בכל מכשיר.
   אפליקציה נייטיב — בלי Origin; התחברות Firebase (Google) */
async function brKey(req, res, body, deps) {
  const ta = require('../lib/appscope').tokenApp(body.idToken);
  if (ta && ta !== 'studio' && ta !== 'all') return res.status(403).json({ ok: false, error: 'wrong_app' });
  let user;
  try { user = await verifyIdToken(body.idToken, deps.verify || {}); } catch (e) { return res.status(401).json({ ok: false, error: 'no_auth' }); }
  if (!UID_RE.test(String(user.uid || ''))) return res.status(401).json({ ok: false, error: 'no_auth' });
  if (limited('bk|' + user.uid, 20)) return res.status(429).json({ ok: false, error: 'rate_limited' });
  const d = vault.derive('snb-br-sync aes-256-gcm v1|' + user.uid);
  if (!d) return res.status(503).json({ ok: false, error: 'vault_not_configured' });
  return res.status(200).json({ ok: true, kid: d.kid, k: d.key.toString('base64') });
}
/* ניקוי: יומני DM מעל 24 חודשים (האצווה היומית) */
async function dmGc(deps, now) {
  const c = learnCfg();
  if (!c.ok) return 0;
  const rd = r2deps(deps);
  let n = 0;
  for (const it of await R2.list(c, rd, 'dm/', 50000)) if (DMLOG.expiredKey(it.key, now)) { await R2.del(c, rd, it.key); n++; }
  return n;
}
/* ניקוי: פריטים מעל 30 יום. מתוך האצווה היומית של מאגר הלמידה */
async function devGc(deps, now) {
  const c = learnCfg();
  if (!c.ok) return 0;
  const rd = r2deps(deps);
  let n = 0;
  for (const it of await R2.list(c, rd, 'd/', 50000)) if (DL.expiredKey(it.key, now)) { await R2.del(c, rd, it.key); n++; }
  return n;
}
/* מ׳6 (20/10/2026): סיכום האיסוף המלא למסך המעבדה — רק ספירות לפי סוג ויום, בלי לפתוח אף פריט */
async function devView(deps, now) {
  const on = await flagOn(deps, 'learn_full', now);
  const c = learnCfg();
  if (!c.ok) return { on, r2: false };
  return Object.assign({ on, r2: true }, DL.devStats(await R2.list(c, r2deps(deps), 'd/', 50000)));
}
/* משיכה לקריאה בלבד בטוקן הניתוח — הלוגים, יומן הקריאות, המדדים ושגיאות הטלפון של הימים האחרונים.
   days 1–14, kinds = j/m/e, job = רק עבודה אחת. עד DEV_PULL_MAX פריטים פתוחים (מהחדש) */
const DEV_PULL_MAX = 400;
const DEV_PULL_BUDGET_MS = 18000;
async function devPull(req, res, body, deps) {
  const tok = String(body.at || '');
  if (!AT_RE.test(tok)) return res.status(401).json({ ok: false, error: 'bad_token' });
  if (limited('at|' + atId(tok).slice(0, 12), 6)) return res.status(429).json({ ok: false, error: 'rate_limited' });
  const now = deps.now || Date.now();
  try {
    const t = await readDoc(deps, 'sysTokens', atId(tok));
    if (!t || !(t.exp > now)) return res.status(401).json({ ok: false, error: 'bad_token' });
    const c = learnCfg();
    const on = await flagOn(deps, 'learn_full', now);
    if (!c.ok) return res.status(200).json({ ok: true, on, r2: false, at: now, items: [] });
    await patchDoc(deps, 'sysTokens', t.id, { last: now, uses: (t.uses || 0) + 1 }).catch(() => {});
    const kinds = new Set((Array.isArray(body.kinds) ? body.kinds : DL.KINDS).filter((k) => DL.KINDS.includes(k)));
    const days = new Set(DL.daysBack(now, Math.max(1, Math.min(14, Math.floor(+body.days || 2)))));
    const job = /^j[A-Za-z0-9_-]{20}$/.test(String(body.job || '')) ? body.job : '';
    const rd = r2deps(deps);
    const all = await R2.list(c, rd, 'd/', 50000);
    // 21/10/2026: יום אחד בכל הסוגים = ~70 פריטים שנפתחו אחד־אחד → 504 (maxDuration 30). עכשיו: 8 במקביל, תקציב זמן,
    // ו־next = המפתח שממנו ממשיכים (מהחדש לישן) — tools/dev-pull.js ממשיך לבד עד שאין next
    const before = typeof body.before === 'string' && body.before.startsWith('d/') ? body.before : '';
    const keys = all.filter((it) => { const p = DL.parseKey(it.key); return p && kinds.has(p.kind) && days.has(p.day) && (!before || it.key < before); })
      .sort((a, b) => (a.key < b.key ? 1 : -1)).slice(0, DEV_PULL_MAX);
    const t0 = Date.now(), items = [];
    let i = 0, next = '';
    while (i < keys.length) {
      if (Date.now() - t0 > DEV_PULL_BUDGET_MS) { next = keys[i - 1] ? keys[i - 1].key : ''; break; }
      const batch = keys.slice(i, i + 8);
      i += batch.length;
      const got = await Promise.all(batch.map((it) => R2.getText(c, rd, it.key, 8 * 1024 * 1024).then((t) => vault.open(t, 'dev|' + it.key)).catch(() => null)));
      got.forEach((x, n) => {
        if (!x || (job && x.job !== job)) return;
        const p = DL.parseKey(batch[n].key);
        items.push(Object.assign({ k: p.kind, day: p.day }, x));
      });
    }
    return res.status(200).json({ ok: true, on, r2: true, at: now, stats: DL.devStats(all), items, next: next || undefined });
  } catch (e) {
    return res.status(502).json({ ok: false, error: /^fs_http_/.test(String(e.message)) ? String(e.message).slice(0, 20) : 'failed' });
  }
}
/* יומני DM של N הימים האחרונים (רק החודשים שמכסים אותם), מהחדש לישן, 8 במקביל עם תקציב זמן; next = מאיפה ממשיכים */
async function dmCollect(deps, c, now, days, before) {
  const months = DMLOG.monthsBack(now, days), from = now - days * 864e5;
  const rd = r2deps(deps);
  const keys = (await R2.list(c, rd, 'dm/u/', 50000)).filter((it) => { const p = DMLOG.parseKey(it.key), kt = DMLOG.keyTime(it.key); return p && months.has(p.month) && kt >= from && (!before || kt < before); })
    .sort((a, b) => DMLOG.keyTime(b.key) - DMLOG.keyTime(a.key)).slice(0, DEV_PULL_MAX);
  const t0 = Date.now(), items = [];
  let i = 0, next = '';
  while (i < keys.length) {
    if (Date.now() - t0 > DEV_PULL_BUDGET_MS) { next = keys[i - 1] ? keys[i - 1].key : ''; break; }
    const batch = keys.slice(i, i + 8);
    i += batch.length;
    const got = await Promise.all(batch.map((it) => R2.getText(c, rd, it.key, 4 * 1024 * 1024).then((x) => vault.open(x, 'dm|' + it.key)).catch(() => null)));
    got.forEach((x, n) => { if (x) items.push(Object.assign({ u: DMLOG.parseKey(batch[n].key).u }, x)); });
  }
  return { items, next };
}
/* Studio DM (24/10/2026, שלב ג׳): משיכת יומני ההורדות בטוקן הניתוח — קריאה בלבד, N הימים האחרונים (עד 31),
   מהחדש לישן, 8 במקביל עם תקציב זמן ו־next. המשתמש מזוהה רק ב־hash (u) — בלי uid ובלי מייל. stats = סיכום במספרים */
async function dmPull(req, res, body, deps) {
  const tok = String(body.at || '');
  if (!AT_RE.test(tok)) return res.status(401).json({ ok: false, error: 'bad_token' });
  if (limited('at|' + atId(tok).slice(0, 12), 6)) return res.status(429).json({ ok: false, error: 'rate_limited' });
  const now = deps.now || Date.now();
  try {
    const t = await readDoc(deps, 'sysTokens', atId(tok));
    if (!t || !(t.exp > now)) return res.status(401).json({ ok: false, error: 'bad_token' });
    const c = learnCfg();
    if (!c.ok) return res.status(learnRemote() ? 421 : 200).json({ ok: !learnRemote(), r2: false, at: now, items: [] });
    await patchDoc(deps, 'sysTokens', t.id, { last: now, uses: (t.uses || 0) + 1 }).catch(() => {});
    const days = Math.max(1, Math.min(31, Math.floor(+body.days || 7)));
    const before = typeof body.before === 'string' && body.before.startsWith('dm/') ? DMLOG.keyTime(body.before) : 0;
    const { items, next } = await dmCollect(deps, c, now, days, before);
    return res.status(200).json({ ok: true, r2: true, at: now, stats: DMLOG.dmStats(items), items, next: next || undefined });
  } catch (e) {
    return res.status(502).json({ ok: false, error: /^fs_http_/.test(String(e.message)) ? String(e.message).slice(0, 20) : 'failed' });
  }
}
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
    const ok = { a: 0, r: 0 };   // 20/10/2026: סיום אחרון שהצליח — סוגר תקלה רחבה שעברה (studioinc majorSync)
    for (const j of jobs) if (j.kind === 'tr' && S.effState(j, now).state === 'done') { const k = apiJob(j) ? 'a' : 'r'; ok[k] = Math.max(ok[k], Number(j.ended) || 0); }
    const mi = I.majorSync(d.mi, inc || d.inc, d.al, now, ok);
    const marked = I.majorMark(inc || d.inc, mi || d.mi, now);
    if (marked) inc = marked;
    const patch = {};
    if (inc) patch.inc = inc;
    if (mi) patch.mi = mi;
    if (inc || mi) await patchDoc(deps, 'studioOps', uid, Object.assign(patch, { updated: now }));
    if (mi && mi.at === now && !mi.x) await notify(deps, uid, 'major', '', now);   // 14/10/2026: תקלה רחבה חדשה — התראה לטלפון
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
/* 15/10/2026: מצב תחזוקה ודגלים — המסמך sysCfg/main, במטמון של המופע 30 שנ׳ (שינוי מהמנהל מעדכן מיד). תקלה בקריאה = כמו
   ברירת המחדל (בלי תחזוקה, כל הדגלים דולקים) — תקלה ב־Firestore לא עוצרת את כל המערכת */
let cfgC = { at: 0, v: null };
async function sysCfg(deps, now) {
  if (cfgC.v && Math.abs(now - cfgC.at) < 30e3) return cfgC.v;
  const d = (await readDoc(deps, 'sysCfg', 'main').catch(() => null)) || {};
  cfgC = { at: now, v: d };
  return d;
}
const flagOn = async (deps, k, now) => SF.flagOn(await sysCfg(deps, now || Date.now()), k);
/* עבודה חדשה / התחלה / המשך: בזמן תחזוקה — רק המנהל; מנוע שהדגל שלו כבוי — לא; "המשך" אוטומטי — רק כש־st_auto דולק.
   עבודות שכבר רצות ממשיכות (התחזוקה עוצרת רק מה שמתחיל) */
async function sysBlock(deps, job, now, auto, adm, uid) {
  const d = await sysCfg(deps, now);
  if (SF.maintOn(d, now) && !adm) return { error: 'maint', msg: SF.normMsg(d.mtMsg), til: +d.mtTil || 0 };
  // 29/10/2026: המנהל השהה את המשתמש (studioStats.ps) — בלי עבודות חדשות / "המשך"; עבודות שכבר רצות ממשיכות
  const u = uid || (job && job.uid);
  if (!adm && umOn(deps) && u && UM.paused(await readStats(deps, u))) return { error: 'user_paused' };
  if (['tr', 'rr', 'ai', 'dx'].includes(job.kind)) {
    const fl = apiJob(job) ? 'st_api' : 'st_routine';
    if (!SF.flagOn(d, fl)) return { error: 'flag_off', fl };
  }
  if (auto && !SF.flagOn(d, 'st_auto')) return { error: 'flag_off', fl: 'st_auto' };
  return null;
}
async function notify(deps, uid, kind, jobId, now, x) {
  try {
    if (!(await flagOn(deps, 'push', now))) return 0;   // הדגל "התראות לטלפון" כבוי
    // 27/10/2026: התקדמות (stage) נשלחת עד ~70 פעם בעבודה — המנויים ומפתח ה־VAPID מהזיכרון (מכסת הקריאות של Firestore)
    const hit = kind === 'stage' ? PUSH_MEM.get(uid) : null;
    const fresh = hit && now - hit.at < PUSH_MEM_MS;
    const subs = fresh ? hit.subs : W.normSubs((await readStats(deps, uid)).wp);
    const v = fresh ? hit.v : null;
    if (!subs.length) { PUSH_MEM.set(uid, { subs, v: null, at: now }); return 0; }
    const vk = v || await vapidKeys(deps);
    if (!fresh) PUSH_MEM.set(uid, { subs, v: vk, at: now });
    const r = await W.sendAll(deps, vk, subs, kind, jobId, now, x);
    if (r.subs.length !== subs.length) { PUSH_MEM.delete(uid); await patchDoc(deps, 'studioStats', uid, { wp: r.subs, updated: now }).catch(() => {}); }
    return r.sent;
  } catch (e) { return 0; }
}
const PUSH_MEM = new Map(), PUSH_MEM_MS = 5 * 60 * 1000;
/* ---------- 29/10/2026: ניטור משתמשים (lib/usermon.js) ----------
   בבדיקות עם fetch מדומה — כבוי (אלא אם deps.userMon), כמו jobMem: קריאות וכתיבות נוספות משנות את הספירות של תרחישים קיימים */
const umOn = (deps) => (deps.userMon != null ? !!deps.userMon : !deps.fetch);
/* מי המנהל לצורך ההתראות — בעל הגיבוי (sysBackup/cfg.uid, כמו fs_hot), בזיכרון 10 דק׳ */
let admC = { at: 0, uid: '', wl: 0 };
async function adminUid(deps, now) {
  if (admC.at && now - admC.at < 600e3) return admC.uid;
  const cfg = await readDoc(deps, 'sysBackup', 'cfg').catch(() => null);
  admC = { at: now, uid: cfg && UID_RE.test(String(cfg.uid || '')) ? cfg.uid : '', wl: (cfg && +cfg.wl) || 0 };
  return admC.uid;
}
/* השם והמייל של המשתמש (מהטוקן) + "נראה לאחרונה" ב־studioStats — כתיבה אחת ל־6 שעות לכל משתמש במופע; בפעם הראשונה
   במופע — קריאה אחת, כדי לרשום "הצטרף" (fs) רק כשאין */
const UM_SEEN = new Map(), UM_SEEN_MS = 6 * 3600e3;
async function seenUser(deps, user, now) {
  if (!umOn(deps) || !user || user.mon === true || !UID_RE.test(String(user.uid || ''))) return;
  const id = UM.idOf(user), key = id.nm + '|' + id.em, hit = UM_SEEN.get(user.uid);
  if (hit && now - hit.at < UM_SEEN_MS && hit.k === key) return;
  if (UM_SEEN.size > 2000) UM_SEEN.clear();
  UM_SEEN.set(user.uid, { at: now, k: key });
  const o = { nm: id.nm, em: id.em, ls: now, updated: now };
  if (!hit) { const st = await readStats(deps, user.uid); if (!st.fs) o.fs = now; }
  await patchDoc(deps, 'studioStats', user.uid, o).catch(() => {});
}
/* השם לתצוגה של בעל העבודה — מהזיכרון (30 דק׳), אחרת קריאה אחת */
const NAME_MEM = new Map();
async function nameOf(deps, uid, now) {
  const hit = NAME_MEM.get(uid);
  if (hit && now - hit.at < 1800e3) return hit.st;
  const d = await readStats(deps, uid);
  const st = { id: uid, nm: d.nm || '', em: d.em || '' };
  if (NAME_MEM.size > 1000) NAME_MEM.clear();
  NAME_MEM.set(uid, { at: now, st });
  return st;
}
/* עבודה של משתמש אחר רצה — התראה למנהל בווילון (תג משלה, מתעדכנת עם ההתקדמות). x = PG.stageNow (או הדיווח) */
async function watchPush(deps, job, x, now) {
  if (!umOn(deps) || !x) return 0;
  const adm = await adminUid(deps, now);
  if (!UM.watchFor(job, adm)) return 0;
  const st = await nameOf(deps, job.uid, now);
  const r = UM.liveRow(job, st, now);
  return notify(deps, adm, 'watch', job.id, now, { nm: r.nm, st: x.st || r.st, p: r.p, usd: r.usd, left: r.left });
}
/* עבודה של משתמש אחר הסתיימה / נעצרה — התראה למנהל, ואם ביקש ("להודיע לי כשמסתיים") ואין עוד עבודות של אחרים — גם זו */
async function watchEnd(deps, job, ok, now) {
  if (!umOn(deps)) return 0;
  const adm = await adminUid(deps, now);
  if (!UM.watchFor(job, adm)) return 0;
  const st = await nameOf(deps, job.uid, now), r = UM.liveRow(job, st, now);
  let n = await notify(deps, adm, 'watch_end', job.id, now, { nm: r.nm, ok, usd: r.usd, min: r.t0 ? (now - r.t0) / 60000 : 0 });
  if (admC.wl) {
    const live = await liveJobs(deps, now, true).catch(() => null);
    if (live && !live.some((j) => j.uid !== adm && j.id !== job.id)) {
      admC.wl = 0;
      await patchDoc(deps, 'sysBackup', 'cfg', { wl: 0 }).catch(() => {});
      n += await notify(deps, adm, 'watch_clear', '', now);
    }
  }
  return n;
}
/* העבודות שרצות עכשיו אצל כל המשתמשים — שאילתה אחת לכל מצב, בזיכרון 10 שנ׳ (המסך "עכשיו" מתרענן כל 10 שנ׳) */
let liveC = { at: 0, v: null };
async function liveJobs(deps, now, fresh) {
  if (!fresh && liveC.v && now - liveC.at < 10e3) return liveC.v;
  const l = (await Promise.all(['running', 'queued'].map((s) => query(deps, 'studioJobs', { state: s }, 30)))).flat().filter(UM.isLive);
  liveC = { at: now, v: l };
  return l;
}
/* סכומים מצטברים לכל משתמש (studioStats.tt) — כמו monthSpend: קריאה עם updateTime ו־patchIf */
async function totalAdd(deps, uid, d, now) {
  if (!umOn(deps)) return;
  for (let i = 0; i < 4; i++) {
    const st = await readDocT(deps, 'studioStats', uid).catch(() => undefined);
    if (st === undefined) break;
    const o = { tt: Object.assign(UM.addTotal(st && st.tt, d), st && st.tt && st.tt.bf ? { bf: 1 } : {}), updated: now };
    const ok = st && st._ut ? await patchIf(deps, 'studioStats', uid, o, st._ut).catch(() => true)
      : await patchDoc(deps, 'studioStats', uid, o).then(() => true, () => true);
    if (ok) break;
  }
}
/* 27/10/2026 (בקשת המשתמש: "להתעדכן בכל שלבי התרגום בווילון גם כשהאפליקציה סגורה לגמרי"): השרת שלנו שולח כל דקה
   op:'pulse' עם העבודות שהוא מריץ, והשרתון שולח התראת שלב בכל עשירייה של ההערכה (PG.stageNow = הפס בטלפון).
   בלי קריאות ל־Firestore: העבודה מהדיווח האחרון של העובד (SHADE_JOB — אותו תהליך), ומה שנשלח אחרון (SHADE_PN) — בזיכרון.
   תהליך אחר (Vercel) / אחרי הפעלה מחדש — קריאה אחת לעבודה, ואולי התראה חוזרת על אותה עשירייה (שקטה, sw.js לא מחזיר אחורה) */
const SHADE_JOB = new Map(), SHADE_PN = new Map(), SHADE_MS = 15 * 60 * 1000, SHADE_MAX = 200;
function shadeJob(job, now) {
  if (SHADE_JOB.size > SHADE_MAX) { SHADE_JOB.clear(); SHADE_PN.clear(); }
  SHADE_JOB.set(job.id, { job, at: now });
}
async function shadePush(deps, job, x, now) {
  if (!x || !PG.shadeDue(SHADE_PN.get(job.id), x)) return 0;
  SHADE_PN.set(job.id, PG.shadeMark(x));
  const sp = job.spec || {};
  const n = await notify(deps, job.uid, 'stage', job.id, now, { st: x.st, p: x.p, to: Array.isArray(sp.to) ? sp.to.join(',') : String(sp.to || ''), v: sp.ka ? 'ka' : sp.src === 'subs' ? 'sb' : '' });
  return n + await watchPush(deps, job, x, now).catch(() => 0);   // 29/10/2026: וגם למנהל, כשזו עבודה של משתמש אחר
}
async function pulseOp(deps, body, sid, now) {
  const ids = (Array.isArray(body.jobs) ? body.jobs : []).map(String).filter((j) => S.JOB_RE.test(j)).slice(0, 8);
  let n = 0;
  for (const id of ids) {
    const hit = SHADE_JOB.get(id);
    const job = hit && now - hit.at < SHADE_MS ? hit.job : await readDoc(deps, 'studioJobs', id).catch(() => null);
    if (!job || job.sid !== sid || job.kind !== 'tr' || job.state !== 'running' || job.rdy) continue;
    if (job.qa && job.qa.at && !job.qa.a) continue;   // מחכה לתשובה שלך — יש לזה התראה משלה
    if (!hit || now - hit.at >= SHADE_MS) shadeJob(Object.assign({ id }, job), now);
    n += await shadePush(deps, Object.assign({ id }, job), PG.stageNow(job, now), now);
  }
  return { ok: true, n };
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
  // הסוד (אופציונלי) — של GitHub או של הקרון היומי של Vercel (CRON_SECRET, שולח אותו ככותרת Authorization)
  const secret = process.env.STUDIO_WATCH_SECRET, auth = String((req.headers || {}).authorization || '');
  if (secret && auth !== 'Bearer ' + secret && !(process.env.CRON_SECRET && auth === 'Bearer ' + process.env.CRON_SECRET)) return res.status(401).json({ ok: false });
  /* 28/10/2026: ?fsw=1 — הבודק של קריאות Firestore (server.js — startFsWatch, כל 5 דק׳, רק בשרת שלנו שבו המונה חי).
     פעולה אחת מעל FSM.TAG_HOUR בשעה, או קצב שיגמור 70% מהמכסה עד האיפוס → התראה (fs_hot) למנהל, פעם ביום לכל ממצא.
     בלי ממצא — אין אף קריאה ל־Firestore */
  if (String((req.query || {}).fsw || '') === '1') {
    if (process.env.VERCEL) return res.status(404).json({ ok: false, error: 'not_here' });
    const now = deps.now || Date.now();
    const al = FSM.alarms(now);
    let sent = 0;
    if (al.length) {
      const cfg = await readDoc(deps, 'sysBackup', 'cfg').catch(() => null);
      if (cfg && UID_RE.test(String(cfg.uid || ''))) for (const a of al.slice(0, 3)) sent += await notify(deps, cfg.uid, 'fs_hot', '', now, a);
      console.log('[fsw]', JSON.stringify(al));
    }
    sent += await dailyPush(deps, now).catch(() => 0);   // 29/10/2026: הסיכום היומי למנהל (21:00 בישראל)
    return res.status(200).json({ ok: true, al: al.length, sent });
  }
  /* ת4: בדיקת החיבור ל־R2 (?r2=1) — כותבת קובץ זעיר, קוראת ומוחקת, ובודקת CORS לאתר. בתשובה רק כן/לא וקוד שגיאה */
  if (String((req.query || {}).r2 || '') === '1') {
    if (limited('r2h', 3)) return res.status(429).json({ ok: false, error: 'rate_limited' });
    const h = await R2.health(R2.config(), { fetch: deps.fetch, now: deps.now ? () => deps.now : undefined }, 'https://yishaiguedj1.github.io');
    return res.status(200).json({ ok: true, r2: { ok: !!h.ok, eu: !!h.eu, cors: h.cors === undefined ? null : !!h.cors, error: String(h.error || '').slice(0, 60) } });
  }
  if (limited('watch', 6)) return res.status(429).json({ ok: false, error: 'rate_limited' });
  const now = deps.now || Date.now();
  let down;
  try { down = await checkServers(deps, now); }
  catch (e) { return res.status(502).json({ ok: false }); }
  const recent = await recentJobs(deps, now).catch(() => null);   // 26/10/2026: קריאה אחת לשתי הבדיקות (מכסת Firestore)
  const ar = recent ? await recoverAll(deps, now, recent).catch(() => -1) : -1;   // 14/10/2026: "המשך" אוטומטי גם כשהטלפון סגור
  const sa = recent ? await startAll(deps, now, recent).catch(() => -1) : -1;   // 25/10/2026: עבודות מוכנות שה"התחל" שלהן לא הגיע / סירוב חולף שעבר
  const st = await siteWatch(deps, now).catch(() => -1);   // שלב 5: הכתובות עצמן (השרתון שלנו ושלוש האפליקציות)
  const bk = await dailyBackup(deps, now);   // ת7: הגיבוי היומי — תקלה בו לא מפילה את הניטור
  const ob = await offsiteBackup(deps, now).catch(() => -1);   // 11/10/2026: ועותק ב־Drive (ספק אחר)
  const aw = await adminWatch(deps, now).catch(() => -1);   // 15/10/2026: התראות למנהל — הגיבוי ובדיקת המוכנות
  const lc = await learnBatch(deps, now).catch(() => -1);   // 15/10/2026 (מ׳2): קורפוס הטקסט — האצווה היומית ומחיקה אחרי 24 חודשים
  const lw = await learnWeekly(deps, now).catch(() => -1);   // 20/10/2026 (מ׳7): הסיכום השבועי של המעבדה — התראה למנהל
  const jg = await jobGc(deps, now).catch(() => -1);   // 21/10/2026: עבודות ב־R2 שהסתיימו לפני יותר מחודש
  const us = await usageSnap(deps, now).catch(() => -1);   // 23/10/2026: נקודה לשעה לאחוזי השימוש של הספקים (היסטוריה של חודש)
  const fa = await fundWatch(deps, now).catch(() => -1);   // 25/10/2026: בקרת הדיוק של מנתח החברות — התראה כשמשהו נשבר
  const sv = await svcWatch(deps, now).catch(() => -1);   // 26/10/2026: כל השירותים — התראה למנהל מ־70% מהמכסה
  return res.status(200).json({ ok: true, down, ar, sa, st, bk, ob, aw, lc, lw, jg, us, fa, sv });
}
/* 21/10/2026 (בקשת המשתמש): עבודה ב־R2 שהסתיימה לפני SC.jobTtl (ייצור 30 יום, ניסוי 7 — 26/10/2026) נמחקת כמו "מחיקה" בטלפון —
   removeJobRec: קודם הרשומה במאגר הלמידה נשמרת (learnSave), ואז הרשומה, הקבצים ב־R2, ההפקות מחדש וגיליונות ה־AI.
   הדלי של מאגר הלמידה (snb-learn) לא נוגעים בו. סריקה מלאה פעם ב־6 שעות למופע, עד GC_MAX בריצה (זמן הפונקציה).
   26/10/2026: סרטון המקור — יום מפתיחת הפרויקט (SC.srcDueAt). הסריקה המלאה רושמת בזיכרון את המקורות שהזמן שלהם מגיע
   ב־6 השעות הבאות (srcSoon), וכל בדיקה מתוזמנת (10 דק׳) קוראת רק את העבודות שהגיע זמנן — בלי עוד סריקות של כל העבודות
   (מכסת הקריאות של Firestore). מופע שעלה מחדש — הסריקה הראשונה בונה את הרשימה שוב. מספר שנמחקו, ‎-1 = תקלה */
const GC_EVERY = 6 * 3600e3, GC_MAX = 20, SRC_MAX = 20;
let lastGc = 0, srcSoon = new Map();
async function jobGc(deps, now) {
  if (process.env.SNB_JOBGC === 'off') return 0;
  let n = 0;
  if (Math.abs(now - lastGc) >= GC_EVERY) {
    lastGc = now;
    const all = [];
    for (const st of SC.FINAL) all.push(...await query(deps, 'studioJobs', { state: st }, 300));
    const ok = all.filter((x) => UID_RE.test(String(x.uid || '')));
    const ttl = SC.jobTtl(PROJECT()), ends = SC.folderEnds(ok), gone = new Set();
    for (const j of ok.filter((x) => SC.expiredJob(x, now, ttl, ends.get(x.folder))).slice(0, GC_MAX)) {
      try { await removeJobRec(deps, j.uid, j, now); gone.add(j.id); n++; } catch (e) {}
    }
    srcSoon = new Map();
    for (const j of ok) if (!gone.has(j.id) && SC.srcPending(j) && SC.srcDueAt(j) <= now + GC_EVERY) srcSoon.set(j.id, { uid: j.uid, due: SC.srcDueAt(j) });
  }
  let k = 0;
  for (const [id, x] of Array.from(srcSoon)) {
    if (x.due > now) continue;
    if (k++ >= SRC_MAX) break;
    srcSoon.delete(id);
    const j = await readJob(deps, id).catch(() => null);
    if (j && j.uid === x.uid && SC.srcExpired(j, now)) { try { if (await srcPurge(deps, j, now)) n++; } catch (e) {} }
  }
  return n;
}
/* מחיקת סרטון המקור של עבודה (והקבצים שנגזרים ממנו). לא כשעבודה אחרת באותה תיקייה עוד רצה (הפקה מחדש / AI) או היא עבודת זהב —
   אז נשאר, והסריקה הבאה תנסה שוב. הרשומה מסומנת sx; איכויות הצפייה ונקודות השמירה יורדות ממנה */
async function srcPurge(deps, j, now) {
  if (!R2.config().ok) return false;
  const jobs = await listJobs(deps, j.uid);
  if (jobs.some((c) => c.id !== j.id && c.folder === j.folder && (S.ACTIVE.includes(S.effState(c, now).state) || c.gd))) return false;
  const recs = await query(deps, 'studioUp', { f: j.folder }, 500).catch(() => []);
  const byId = new Map(recs.map((r) => [r.id, r]));
  for (const id of SC.srcFiles(j)) {
    await SR.delFile(R2.config(), r2deps(deps), { uid: j.uid, folder: j.folder, id, rec: byId.get(id) });
    if (byId.has(id)) await delDoc(deps, 'studioUp', id).catch(() => null);
  }
  await patchJob(deps, j.id, { sx: now, hl: null, hla: null, ck: [] });
  return true;
}
/* שלב 5 (ב2): ניטור הכתובות מבחוץ (lib/sitewatch.js). המצב ב־sysWatch/sites (sd = נפלו, sp = נכשלו פעם אחת); ההתראה —
   למנהל שרשום כבעל הגיבוי (sysBackup/cfg.uid). מחזיר כמה כתובות למטה כרגע, ‎-1 = תקלה בבדיקה עצמה */
/* 15/10/2026: התראה לטלפון של המנהל רק על מה שלא יכול לחכות (On-call) — פעם בשעה למופע:
   בדיקת מוכנות שנכשלה (רק כשרשימת הכשלים השתנתה — לא כל שעה מחדש), והגיבוי אצל ספק שני שלא רץ יותר מיומיים (פעם ביום).
   המצב ב־sysWatch/ready (fp = הכשלים שכבר דווחו, bkd = היום שבו דווח הגיבוי). 1 = נשלחה התראה, 0 = לא */
/* מ׳7 (20/10/2026): התראה שבועית למנהל — "סיכום השבוע במעבדה מוכן". פעם בשבוע (sysWatch/learnWk.at) ורק כשהיו
   עבודות תרגום ב־7 הימים האחרונים; בדיקה פעם ב־6 שעות למופע. קריאה בלבד מ־studioLearn — הסיכום עצמו מחושב כשנכנסים למעבדה */
const LW_EVERY = 6 * 3600e3, LW_WEEK = 7 * 86400e3;
let lastLw = 0;
async function learnWeekly(deps, now) {
  if (process.env.SNB_LEARNWEEK === 'off' || Math.abs(now - lastLw) < LW_EVERY) return 0;
  lastLw = now;
  const cfg = await readDoc(deps, 'sysBackup', 'cfg').catch(() => null);
  if (!cfg || !UID_RE.test(String(cfg.uid || ''))) return 0;
  const w = (await readDoc(deps, 'sysWatch', 'learnWk').catch(() => null)) || {};
  if (w.at && now - w.at < LW_WEEK - 3600e3) return 0;
  const docs = await query(deps, 'studioLearn', null, LEARN_MAX);
  const n = docs.filter((d) => d.lr && d.lr.k === 'tr' && (d.lr.at || 0) >= now - LW_WEEK).length;
  if (!n) return 0;   // שבוע בלי עבודות — בלי התראה, ובודקים שוב בעוד 6 שעות
  await patchDoc(deps, 'sysWatch', 'learnWk', { at: now, n });
  await notify(deps, cfg.uid, 'lab_week', '', now);
  return 1;
}
/* 25/10/2026 (שכבה 5): בקרת הדיוק של מנתח החברות. ה־workflow הלילי (fund-audit.yml) מפרסם summary.json + history.json
   ב־Release הציבורי fund-audit; כאן קוראים (מטמון AO_TTL), ושולחים התראה למנהל פעם אחת לכל ריצה שבה משהו נשבר
   (FAU.auditAlert: סט הזהב זז / ההתאמה לדוח ירדה / חברות נכשלו). sysWatch/fund.at = הריצה האחרונה שנבדקה */
async function fundAuditGet(deps, now) {
  return aoGet(deps, 'fund', async () => {
    const f = deps.fetch || fetch, get = async (n) => {
      const r = await f(FAU.REL + n, { signal: AbortSignal.timeout(8000) });
      return r.ok ? r.json() : null;
    };
    const [s, h] = await Promise.all([get('summary.json'), get('history.json').catch(() => [])]);
    const cur = FAU.normAudit(s);
    return cur ? { cur, hist: FAU.normHist(h) } : null;
  }, now);
}
const FW_EVERY = 3 * 3600e3;
let lastFw = 0;
async function fundWatch(deps, now) {
  if (process.env.SNB_FUNDWATCH === 'off' || Math.abs(now - lastFw) < FW_EVERY) return 0;
  lastFw = now;
  const a = await fundAuditGet(deps, now);
  if (!a) return 0;
  const w = (await readDoc(deps, 'sysWatch', 'fund').catch(() => null)) || {};
  if (w.at === a.cur.at) return 0;
  const prev = a.hist.filter((x) => x.at !== a.cur.at).pop() || null;
  const why = FAU.auditAlert(a.cur, prev);
  await patchDoc(deps, 'sysWatch', 'fund', { at: a.cur.at, why: why ? why.join(',') : '' });
  if (!why) return 0;
  const cfg = await readDoc(deps, 'sysBackup', 'cfg').catch(() => null);
  if (!cfg || !UID_RE.test(String(cfg.uid || ''))) return 0;
  await notify(deps, cfg.uid, 'fund_audit', '', now);
  return 1;
}
/* 26/10/2026 (שלב 1 ב־תוכנית-עמידות-שירותים.md): כל השירותים במקום אחד. בלי פנייה לספקים — רק מה שכבר נמדד (sysUsage/main,
   נמדד פעם בשעה ב־usageSnap), השרתים ושרשרת המיילים. sysWatch/svc.ks = המדדים שכבר הותרעו (מחרוזת — לא שדה JSON),
   התראה אחת לכל מדד עד שהוא יורד מתחת ל־60%. פעם בשעה למופע */
async function svcFacts(deps, now, live) {
  const cfg = (await readDoc(deps, 'sysUsage', 'main').catch(() => null)) || {};
  const prov = USG.provMerge(live ? await provGet(deps, now).catch(() => null) : null, cfg.upv);
  let servers = [];
  try { servers = (await query(deps, 'studioServers', null, S.SRV_MAX + 5)) || []; } catch (e) {}
  const mail = await MAILER.view({ fetch: deps.fetch || fetch, token: () => datastoreToken(deps.fetch) }, now).catch(() => null);
  return { prov, sto: cfg.sto || null, servers: servers.map((x) => ({ seen: +x.seen || 0, paused: !!x.paused, dn: +x.dn || 0, hb: x.hb && typeof x.hb === 'object' ? { disk: x.hb.disk } : null })), mail, now };
}
const SV_EVERY = 3600e3;
let lastSv = 0;
async function svcWatch(deps, now) {
  if (process.env.SNB_SVCWATCH === 'off' || Math.abs(now - lastSv) < SV_EVERY) return 0;
  lastSv = now;
  const v = SVC.servicesView(await svcFacts(deps, now, false));
  const w = (await readDoc(deps, 'sysWatch', 'svc').catch(() => null)) || {};
  const prev = {};
  for (const k of String(w.ks || '').split(',')) if (k) prev[k] = 1;
  const a = SVC.alertsDue(v, prev);
  const ks = Object.keys(a.keep).sort().join(',');
  if (ks !== String(w.ks || '')) await patchDoc(deps, 'sysWatch', 'svc', { ks, at: now });
  if (!a.fire.length) return 0;
  const cfg = await readDoc(deps, 'sysBackup', 'cfg').catch(() => null);
  if (!cfg || !UID_RE.test(String(cfg.uid || ''))) return 0;
  await notify(deps, cfg.uid, 'svc_quota', '', now);
  return 1;
}
const AW_EVERY = 3600e3;
let lastAw = 0;
async function adminWatch(deps, now) {
  if (process.env.SNB_SITEWATCH === 'off' || process.env.SNB_ADMINWATCH === 'off' || Math.abs(now - lastAw) < AW_EVERY) return 0;
  lastAw = now;
  const cfg = await readDoc(deps, 'sysBackup', 'cfg').catch(() => null);
  if (!cfg || !UID_RE.test(String(cfg.uid || ''))) return 0;
  const prev = (await readDoc(deps, 'sysWatch', 'ready').catch(() => null)) || {};
  const rd = await readyNow(deps, now);
  aoCache.set('ready', { at: now, v: rd });
  const step = AO.watchStep(prev, rd, cfg, now);
  if (step.patch) await patchDoc(deps, 'sysWatch', 'ready', step.patch);
  for (const k of step.send) await notify(deps, cfg.uid, k, '', now);
  return step.send.length ? 1 : 0;
}
async function siteWatch(deps, now) {
  if (process.env.SNB_SITEWATCH === 'off') return 0;   // בבדיקות השרתון (run.js) — הכתובות האמיתיות לא נגישות שם
  const f = deps.fetch || fetch;
  const ok = {};
  await Promise.all(SW.SITES.map(async ([n, u]) => {
    try {
      const r = await f(u, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(SW.TIMEOUT), headers: { 'Cache-Control': 'no-cache' } });
      ok[n] = r.status === 200;
    } catch (e) { ok[n] = false; }
  }));
  const prev = (await readDoc(deps, 'sysWatch', 'sites').catch(() => null)) || {};
  const r = SW.siteStep(prev, ok);
  if (r.sd !== String(prev.sd || '') || r.sp !== String(prev.sp || '')) await patchDoc(deps, 'sysWatch', 'sites', { sd: r.sd, sp: r.sp, at: now });
  const kind = r.down.length ? 'site_down' : r.up.length && !r.sd ? 'site_up' : '';   // "חזר" — רק כשכולן עונות
  if (kind) {
    const cfg = await readDoc(deps, 'sysBackup', 'cfg').catch(() => null);
    if (cfg && UID_RE.test(String(cfg.uid || ''))) await notify(deps, cfg.uid, kind, '', now);
  }
  return r.sd ? r.sd.split(',').length : 0;
}
/* 11/10/2026 — הגיבוי אצל ספק שני (lib/offsite.js): ל־Drive של המנהל שרשום ב־sysBackup/cfg (נרשם כשהמנהל פותח את הסטודיו).
   הגישה: רק הלקוח של הספרייה (OFF.ownerToken) — **לא של הסטודיו**: העובד מקבל גישה של הלקוח של הסטודיו, ועובד שנפרץ היה
   רואה (ויכול למחוק) את הגיבוי. המצב במסמך: day (היום האחרון שגובה), okAt, up (קבצים שעלו
   בסה"כ), err (קוד בלבד). פעם ב־OFF_EVERY למופע; תקציב זמן — הפונקציה מוגבלת ל־30 שנ׳. 1 = רץ, 0 = לא היה מה / לא הגיע הזמן, -1 = תקלה */
const OFF_EVERY = 8 * 60e3;
let lastOff = 0;
/* 23/10/2026: נקודת היסטוריה לשעה לאחוזי השימוש של הספקים — רק אם הגיע הזמן (לא קוראים לספקים בכל מחזור) */
async function usageSnap(deps, now) {
  const cfg = (await readDoc(deps, 'sysUsage', 'main').catch(() => null)) || {};
  const f = deps.fetch || fetch;
  // 24/10/2026: האחסון לפי מקום — R2 לכל דלי, ו־Drive של הגיבוי. פעם בשעה (stoAt), בנפרד מההיסטוריה — בלי טוקנים
  // של ספקים ההיסטוריה לא גדלה ו־histDue נשאר אמת, אבל לא שואלים את Drive כל 10 דק׳. תקלה כאן לא מפילה את ההיסטוריה
  // חותמת לפי מי שמודד: מופע עם CF_USAGE_TOKEN (Vercel) — stoAt; בלי (השרתון שלנו) — רק Drive, בחותמת משלו (stdAt),
  // כדי שהשרתון, שרץ כל 10 דק׳, לא יחסום את המדידה של R2 ב־Vercel (שמגיע לכאן רק מדי כמה שעות)
  const set = {}, stamp = process.env.CF_USAGE_TOKEN ? 'stoAt' : 'stdAt';
  if (!(now - (+cfg[stamp] || 0) < USG.STO_GAP)) {
    set.sto = await storeSnap(deps, f, now, cfg.sto).catch(() => cfg.sto || null);
    set[stamp] = now;
  }
  let n = 0, prov = null;
  // 24/10/2026: מופע עם טוקן של ספק (Vercel) שומר את מה שמדד, פעם בשעה — השרת שלנו (בלי הטוקנים) מציג ממנו
  if ((process.env.CF_USAGE_TOKEN || process.env.VERCEL_USAGE_TOKEN) && !(now - (+cfg.upvAt || 0) < USG.STO_GAP)) {
    prov = await USG.usageAll(process.env, f, now);
    set.upv = USG.provKeep(cfg.upv, prov, now);
    set.upvAt = now;
  }
  if (USG.histDue(cfg.uh, now)) {
    prov = prov || await USG.usageAll(process.env, f, now);
    set.uh = USG.histPush(cfg.uh, USG.provMerge(prov, set.upv || cfg.upv), now);
    n = set.uh.length;
  }
  if (!Object.keys(set).length) return 0;
  if (set.sto == null) delete set.sto;
  await patchDoc(deps, 'sysUsage', 'main', Object.assign(set, { updated: now }));
  return n;
}
async function storeSnap(deps, f, now, prev) {
  const bk = await readDoc(deps, 'sysBackup', 'cfg').catch(() => null);
  const t = bk && UID_RE.test(String(bk.uid || '')) ? await OFF.ownerToken(deps, bk.uid).catch(() => null) : null;
  const [r2, drive] = await Promise.all([USG.r2Store(process.env, f, now).catch(() => null), USG.driveStore(t && t.ok ? t.token : '', f).catch(() => null)]);
  return USG.storeMerge(prev, r2, drive, now);
}
async function offsiteBackup(deps, now) {
  if (!R2.config().ok || Math.abs(now - lastOff) < OFF_EVERY) return 0;
  lastOff = now;
  const cfg = await readDoc(deps, 'sysBackup', 'cfg').catch(() => null);
  if (!cfg || !UID_RE.test(String(cfg.uid || ''))) return 0;
  const t = await OFF.ownerToken(deps, cfg.uid).catch(() => ({ ok: false, error: 'gd_failed' }));
  if (!t.ok) { await patchDoc(deps, 'sysBackup', 'cfg', { err: String(t.error || 'gd').slice(0, 30), at: now }).catch(() => {}); return -1; }
  const c = R2.config(), rd = r2deps(deps), f = deps.fetch || fetch;
  const io = {
    r2: { list: (p) => R2.list(c, rd, p, 5000), get: (k, max) => R2.getBuf(c, rd, k, max) },
    drive: OFF.driveIo(f, t.token),
    clock: () => Date.now(),
  };
  try {
    const r = await OFF.runOffsite(io, now, { day: cfg.day || '' }, Date.now() + 15000);
    await patchDoc(deps, 'sysBackup', 'cfg', { day: r.day, okAt: now, up: (Number(cfg.up) || 0) + r.up, left: r.left, err: '', at: now });
    return 1;
  } catch (e) {
    await patchDoc(deps, 'sysBackup', 'cfg', { err: /^(gd_http_\d+|r2_[a-z_]+|fs_http_\d+)$/.test(String(e.message)) ? String(e.message) : 'failed', at: now }).catch(() => {});
    return -1;
  }
}
/* המנהל פותח את הסטודיו → הוא בעל הגיבוי (פעם אחת; מנהל אחר לא דורס) */
let offOwnerSeen = '';
async function offsiteOwner(deps, uid) {
  if (offOwnerSeen === uid) return;
  const cfg = await readDoc(deps, 'sysBackup', 'cfg').catch(() => null);
  if (!cfg || !cfg.uid) await patchDoc(deps, 'sysBackup', 'cfg', { uid, at: Date.now() });
  offOwnerSeen = uid;
}
/* ת7: הגיבוי היומי (lib/backup.js) — פעם ביום, ל־R2. בתשובה רק מצב (בלי תוכן): 1 = נוצר עכשיו, 0 = כבר היה, -1 = תקלה / בלי R2 */
async function fsListCol(deps, col, max) {
  const out = [];
  let pt = '';
  for (let i = 0; i < Math.ceil(max / 300); i++) {
    const r = await fsCall(deps, 'GET', '/' + col + '?pageSize=300' + (pt ? '&pageToken=' + encodeURIComponent(pt) : ''));
    if (r.status !== 200) throw new Error('fs_http_' + r.status);
    for (const d of (r.j && Array.isArray(r.j.documents) ? r.j.documents : [])) out.push({ name: String(d.name || '').split('/').pop(), fields: d.fields || {}, ut: d.updateTime || '' });
    pt = r.j && r.j.nextPageToken ? String(r.j.nextPageToken) : '';
    if (!pt) break;
  }
  return out;
}
let dnsTry = '';
async function dailyBackup(deps, now) {
  const c = R2.config();
  if (!c.ok) return -1;
  const rd = r2deps(deps);
  try {
    const r = await BK.runBackup({
      listCol: (col, max) => fsListCol(deps, col, max),
      head: (k) => R2.head(c, rd, k), get: (k, max) => R2.getBuf(c, rd, k, max), put: (k, b, t) => R2.putBuf(c, rd, k, b, t),
      list: (p) => R2.list(c, rd, p, 2000), del: (k) => R2.del(c, rd, k),
      dns: () => { const d = new Date(now).toISOString().slice(0, 10); if (dnsTry === d) return null; dnsTry = d; return DNSX.dnsExport(process.env, deps.fetch || fetch); },   // 26/10/2026: רשומות הדומיין — ניסיון אחד ביום למופע
    }, now);
    if (r.done) await LM.dailyGc(deps, now).catch(() => null);   // ס׳9: ניקוי הספרייה — פעם ביום, אחרי שהקטלוג גובה
    return r.done ? 1 : 0;
  } catch (e) { return -1; }
}
/* הבדיקה עצמה — גם מהקרון וגם מהטלפון (11/10/2026): GitHub מדלג על ריצות מתוזמנות (בפועל פעם בכמה שעות),
   ולכן גם status/jobs מהטלפון בודקים — לכל היותר פעם ב־WATCH_EVERY לכל מופע, ורק את השרתים של מי ששואל */
const WATCH_EVERY = 5 * 60e3;
let lastWatch = 0;
function watchDue(now) {
  if (Math.abs(now - lastWatch) < WATCH_EVERY) return false;
  lastWatch = now;
  return true;
}
async function checkServers(deps, now, onlyUid) {
  let n = 0;
  for (const s of S.serversDown(await query(deps, 'studioServers', null, S.SRV_MAX + 5), now)) {
    if (onlyUid && s.by !== onlyUid) continue;
    const got = await patchIf(deps, 'studioServers', s.id, { dn: now, updated: now }, s._ut).catch(() => false);
    if (!got || !UID_RE.test(String(s.by || ''))) continue;
    n++;
    await raise(deps, s.by, [{ c: 'server', k: 'down' }], '', now);
    await notify(deps, s.by, 'srv_down', '', now);
  }
  return n;
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

/* 15/10/2026: "השרת לא מצליח להתחבר" — הטוקן נדחה. רישום לכל היותר פעם ב־BAD_AUTH_GAP (בלי כתיבה בכל ניסיון);
   התראה במגדל + לטלפון רק בפעם הראשונה (עד שפנייה תקינה מאפסת את ba) */
async function badAuth(deps, srv, sid, now) {
  if (!S.badAuthDue(srv, now)) return;
  const first = !(srv.ba > 0);
  const got = await patchIf(deps, 'studioServers', sid, { ba: now, updated: now }, srv._ut).catch(() => false);
  if (!got || !first || !UID_RE.test(String(srv.by || ''))) return;
  await raise(deps, srv.by, [{ c: 'server', k: 'auth' }], '', now);
  await notify(deps, srv.by, 'srv_auth', '', now);
}
async function authBack(deps, srv, sid, now) {
  if (!UID_RE.test(String(srv.by || ''))) return;
  try {
    const others = (await query(deps, 'studioServers', null, S.SRV_MAX + 5)).filter((x) => x.id !== sid && x.ba && x.by === srv.by);
    if (!others.length) await raise(deps, srv.by, [{ c: 'server', k: 'auth', ok: true }], '', now);
  } catch (e) {}
}

/* ---------- מצב "API של המערכת": תור לשרת שלנו (בלי Routine) ---------- */
/* העבודה נכנסת לתור; שרת פנוי לוקח אותה ב־poll ומקבל מפתח עבודה חדש (המפתח נוצר רק שם — לא מחכה בתור) */
async function queueApi(deps, uid, job, now) {
  const st = await readStats(deps, uid);
  const cap = S.jobCap(job.spec, S.monthUsed(st.mu, now), userMonth(st), S.usdOf(job.use0));
  if (!cap) return { ok: false, error: capWhy(job, st, now) };
  let rx = {};
  if (relayJob(job)) {
    const r = await fireRelay(deps, uid, job, now);
    if (!r.ok) return r;
    rx = r.patch;
  }
  await patchJob(deps, job.id, Object.assign({ state: 'queued', eng: 'api', sid: '', pk: 0, vw: 0, kh: '', kx: 0, fired: now, fires: (job.fires || 0) + 1,
    err: '', ed: '', warn: '', use: null, tw: null, sess: null, updated: now }, rx));
  return { ok: true };
}
/* 24/10/2026 (בקשת המשתמש: "שהיישור והצריבה יהיו על השרת שלנו גם במצב Routine"): עבודת "המנוי שלי" רצה כמו עבודת שרת
   (העובד שלנו — הורדה, תמלול, יישור, צריבה), ורק הקריאות ל־Claude עוברות ל־Routine של המשתמש דרך התור (lib/relay.js).
   ה־Routine מופעל כאן עם מפתח משלו (rkh) — הוא פותח רק את פעולות ההעברה של העבודה הזו, לא את הקבצים ולא את הדיווח.
   כשל ודאי בהפעלה = העבודה לא נכנסת לתור (נשארת כמו שהייתה, עם השגיאה של ההפעלה) */
const relayJob = (job) => apiJob(job) && job.spec.ry === 1 && job.kind !== 'rr';   // הפקה מחדש — בלי Claude, בלי Routine
/* 25/10/2026 (שלב 3 של "תרגום בטלפון"): pt = הטלפון מריץ את כל העבודה (גם שלבי הטקסט), והקריאות ל־Claude עוברות דרך אותו
   תור — אבל העונה הוא השרת שלנו, עם המפתח של המערכת (agent.py, ptNext/ptMark). העלות נספרת כאן מכל תשובה (ptMark), לא
   מהדיווח של הטלפון. השרת לא לוקח את העבודה (poll מדלג) — הטלפון לוקח אותה במפתח הטלפון (phClaim) */
const ptJob = (job) => apiJob(job) && job.kind === 'tr' && job.spec.pt === 1;
const hubJob = (job) => relayJob(job) || ptJob(job);
async function fireRelay(deps, uid, job, now) {
  const v = await readVault(deps, uid);
  if (!v || !v.r) return { ok: false, error: 'conn_missing' };
  if (S.recentFires(v.fh, now).length >= S.FIRE_HOUR) return { ok: false, error: 'budget' };
  const rk = S.newKey(), fh = S.recentFires(v.fh, now);
  await patchJob(deps, job.id, { rkh: S.keyHash(rk), rkx: now + S.KEY_TTL, rcl: 0, fr: { s: -1, ms: 0 }, updated: now });
  const f = await fire(deps, v, uid, S.fireText(job.id, rk));
  if (job.kind === 'tr') await raise(deps, uid, f.ok ? [{ c: 'routine', k: 'fire', ok: true }, { c: 'routine', k: 'rate', ok: true }] : [O.fireEvent(f.error)].filter(Boolean), job.id, now);
  if (!f.ok && !UNSURE.includes(f.error)) {
    await patchJob(deps, job.id, { rkh: '', rkx: 0, err: f.error, ed: f.detail || '', fr: f.fr || null, updated: now });
    if (f.error !== 'routine_net') await patchVault(deps, uid, { tt: now });
    return { ok: false, error: f.error, retry: f.retry, detail: f.detail || '' };
  }
  await patchVault(deps, uid, { tt: now, fh: fh.concat(now) });
  return { ok: true, patch: Object.assign({ fr: f.fr || null }, f.ok ? { sess: f.sess } : { warn: f.error, ed: f.detail || '' }) };
}
/* כתובת התור: תהליך אחד של חדר האפליקציה (ibkr-proxy/server.js) — לפי הסביבה. ב־Vercel אין תור */
const RELAY_HUB = () => process.env.SNB_RELAY_HUB || (PROJECT() === 'snowball-staging-758f6' ? 'https://api-staging.thesnowball.app' : 'https://api.thesnowball.app');
/* האימות של פעולות ההעברה בלי לקרוא את Firestore בכל פעולה (המתנה ארוכה = עשרות פעולות לדקה): המפתח נבדק מול רשומת
   העבודה פעם ב־RL_AUTH_TTL, ובינתיים מול ה־hash שבזיכרון. עבודה שהסתיימה / בוטלה — התור נסגר וכולם מקבלים "עצור" */
const RL_AUTH_TTL = 90e3, rlAuth = new Map();
async function relayAuth(deps, id, key, f, now) {
  const ck = id + '|' + f, h = S.keyHash(key), c = rlAuth.get(ck);
  if (c && c.h === h && now - c.at < RL_AUTH_TTL && now <= c.kx) return { ok: true, pt: c.pt };
  const job = await readJob(deps, id);
  const fx = f === 'rkh' ? 'rkx' : 'kx';
  if (!job || !(f === 'rkh' ? relayJob(job) : hubJob(job)) || !S.keyMatches(job, key, f) || now > (job[fx] || 0)) { rlAuth.delete(ck); return { ok: false, status: 403, error: 'bad_key' }; }
  const e = S.effState(job, now);
  if (S.FINAL.includes(e.state)) { const hb = RL.hub(); if (hb) hb.end(id, e.state); return { ok: false, status: 200, error: 'stop', state: e.state }; }
  if (rlAuth.size > 500) rlAuth.clear();
  const pt = ptJob(job);
  rlAuth.set(ck, { h, at: now, kx: job[fx], pt });
  return { ok: true, job, pt };
}
async function relayOp(req, res, body, deps) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
  const hub = RL.hub();
  if (!hub) return res.status(503).json({ ok: false, error: 'no_hub', hub: RELAY_HUB() });
  const id = String(body.job || ''), key = String(body.key || ''), op = String(body.op);
  if (!S.JOB_RE.test(id) || !S.KEY_RE.test(key)) return res.status(400).json({ ok: false, error: 'bad_params' });
  if (limited('rl|' + id, 600)) return res.status(429).json({ ok: false, error: 'rate_limited' });
  const now = deps.now || Date.now();
  const routine = op === 'rlNext' || op === 'rlMark';
  try {
    const a = await relayAuth(deps, id, key, routine ? 'rkh' : 'kh', now);
    if (!a.ok) return res.status(a.status).json({ ok: false, error: a.error, stop: true, state: a.state });
    let out;
    if (op === 'rlPut') out = hub.put(id, body, a.pt);
    else if (op === 'rlFix') out = hub.fix(id, body.fh, body.fx);
    else if (op === 'rlWait') out = await hub.wait(id, body.rid, body.w);
    else if (op === 'rlEnd') out = hub.end(id, body.why);
    else if (op === 'rlNext') out = await hub.next(id, body.have, body.max, body.w);
    else out = hub.mark(id, body.rid, body.st, body.ans);
    return res.status(200).json(Object.assign(out, { now: Date.now() }));
  } catch (err) {
    return res.status(502).json({ ok: false, error: /^(fs_http_|sa_http_)/.test(String(err.message)) ? String(err.message).slice(0, 30) : 'failed' });
  }
}
/* התקציב החודשי של המשתמש: קריאה וכתיבה בתנאי (updateTime) — שני דיווחים במקביל (שתי עבודות) לא דורסים זה את הסכום
   של זה. תקלה כאן לא מפילה את מה שקרא לה */
async function monthSpend(deps, uid, spent, now) {
  for (let i = 0; i < 4; i++) {
    const st = await readDocT(deps, 'studioStats', uid).catch(() => undefined);
    if (st === undefined) break;
    const o = { mu: S.addMonth(st && st.mu, spent, now), updated: now };
    const ok = st && st._ut ? await patchIf(deps, 'studioStats', uid, o, st._ut).catch(() => true)
      : await patchDoc(deps, 'studioStats', uid, o).then(() => true, () => true);
    if (ok) { await capCheck(deps, uid, st, o.mu, now).catch(() => {}); break; }
  }
}
/* 29/10/2026: משתמש עבר 80% מהתקרה החודשית שלו — התראה למנהל, פעם אחת בחודש (m80) */
async function capCheck(deps, uid, st, mu, now) {
  if (!umOn(deps)) return;
  const w = UM.capWarn(st, S.monthUsed(mu, now), USER_MONTH(), now);
  if (!w) return;
  const adm = await adminUid(deps, now);
  if (!adm || adm === uid) return;
  await patchDoc(deps, 'studioStats', uid, { m80: w.mk });
  await notify(deps, adm, 'cap80', '', now, { nm: UM.label(st && st.nm, st && st.em), usd: S.monthUsed(mu, now), cap: w.cap });
}

/* 25/10/2026 (שלב 3 של "תרגום בטלפון"): העונה בשרת שלנו (agent.py, טוקן שרת) — הבקשות ל־Claude של כל העבודות שהטלפון
   מריץ (ptNext), והתשובות (ptMark). לפני שבקשה יוצאת: העבודה עדיין רצה, והתקרה שלה (capc — הנמוכה מהתקרה שלך ומהתקציב
   החודשי שנשאר, בלקיחה) עוד לא נוצלה — אחרת התשובה היא budget_cap בלי לקרוא ל־Claude. העלות של כל תשובה (מחושבת בעונה —
   המחירון בצד הפייתון) נרשמת ב־job.use ובתקציב החודשי, בתור לכל עבודה (שתי תשובות במקביל לא דורסות זו את זו) */
const PT_PAR = 16, ptChain = new Map();
function ptSerial(id, fn) {
  const prev = ptChain.get(id) || Promise.resolve();
  const p = prev.then(fn, fn);
  ptChain.set(id, p.catch(() => {}));
  p.finally(() => { if (ptChain.get(id) && ptChain.size > 200) ptChain.delete(id); }).catch(() => {});
  return p;
}
async function ptOp(deps, body, now) {
  const hb = RL.hub();
  if (!hb) return { ok: false, error: 'no_hub', hub: RELAY_HUB() };
  if (body.op === 'ptNext') {
    const out = await hb.nextSrv(body.have, Math.min(PT_PAR, Number(body.max) || 0), body.w);
    const seen = new Map(), reqs = [];
    for (const r of out.reqs) {
      if (!seen.has(r.job)) seen.set(r.job, await readJob(deps, r.job).catch(() => null));
      const job = seen.get(r.job);
      const e = job && S.effState(job, now);
      if (!job || !ptJob(job) || !e || !['queued', 'running'].includes(e.state)) { hb.mark(r.job, r.rid, 'd', { err: 'relay_stop' }); continue; }
      // התקרה של ההפעלה הזו (capc) — מול מה שעלה מאז הלקיחה (use כולל את הסשנים הקודמים — use0)
      if (S.usdOf(job.use) - S.usdOf(job.use0) >= (Number(job.capc) || 0) / 100) { hb.mark(r.job, r.rid, 'd', { err: 'budget_cap' }); continue; }
      reqs.push(Object.assign(r, { md: job.spec.mode }));
    }
    return { ok: true, reqs, fx: out.fx };
  }
  // ptMark
  const id = String(body.job || ''), rid = String(body.rid || '');
  if (!S.JOB_RE.test(id) || !RL.RID_RE.test(rid)) return { ok: false, error: 'bad_params' };
  const pk = hb.peek(id, rid);
  if (!pk || !pk.srv) return { ok: true, gone: true };
  if (body.st === 's') return hb.mark(id, rid, 's');
  const a = RL.normAns(body.ans);
  if (!a) return { ok: false, error: 'bad_params' };
  const usd = Number(body.usd);
  if (!a.err || (a.u && (a.u.i || a.u.o))) {
    // גם קריאה שנכשלה בסוף עלתה כסף (ה־ledger של llm.py רושם אותה) — נספרת
    await ptSerial(id, async () => {
      const job = await readJob(deps, id);
      if (!job || !ptJob(job)) return;
      // use = כל הסשנים (כמו בדיווח של העובד בשרת — mergeUse(use0, …)): אחרי "המשך" ממשיכים מ־use0
      await patchJob(deps, id, { use: S.useAdd(Array.isArray(job.use) ? job.use : job.use0, pk.k, pk.m, a.u || {}, usd) });
      if (usd > 0 && usd < 1e4) await monthSpend(deps, job.uid, usd, now);   // כל תשובה — התוספת שלה (בלי mucc)
    }).catch(() => {});
  }
  return hb.mark(id, rid, 'd', a);
}

/* למה אין תקציב להפעלה: התקרה של העבודה נוצלה בסשנים הקודמים (budget_cap — "המשך" במצב זול יותר / תקרה גבוהה יותר), או החודש */
const capWhy = (job, st, now) => (S.jobCap(job.spec, 0, userMonth(st), S.usdOf(job.use0)) ? 'month_cap' : 'budget_cap');
const apiJob = (job) => (job.kind === 'tr' || job.kind === 'rr' || job.kind === 'ai' || job.kind === 'dx') && job.spec && job.spec.eng === 'api';   // מ2 · מ7: הפקה מחדש וגיליון ה־AI — באותו מנוע כמו המקור   // מ2: הפקה מחדש — באותו מנוע כמו המקור

/* 21/10/2026 (סבב הייעול, 9 — "חלון עדכון"): עבודה שנלקחה בדיוק כשהעובד מתעדכן נהרגה (worker_lost פעמיים). אחרי קידום
   של תמונת עובד ל־prod (ריצת worker-image מוצלחת על main — מה־API הציבורי של GitHub, מטמון 2 דק׳), עובד שעוד בגרסה
   הקודמת (hb.v ≠ ה־SHA החדש) לא מקבל עבודה חדשה UPD_WIN — snb-update בודק כל 2 דק׳ (עד 25/10/2026 — 15; בשרת שעוד לא קיבל את snb-update החדש). אחרי החלון — עבודה כרגיל גם אם
   העדכון לא קרה (לא תוקעים את התור). כל תקלה בבדיקה = אין חלון */
const UPD_WIN = 20 * 60e3, UPD_TTL = 2 * 60e3;
let _upd = { at: 0, sha: '', t: 0 };
async function latestWorker(deps, now) {
  if (deps.workerRelease) return deps.workerRelease(now);
  if (now - _upd.at < UPD_TTL) return _upd;
  _upd = { at: now, sha: _upd.sha, t: _upd.t };
  try {
    const r = await (deps.fetch || fetch)('https://api.github.com/repos/yishaiguedj1/portfolio-pwa/actions/workflows/worker-image.yml/runs?branch=main&status=success&per_page=1',
      { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'snb-studio' }, signal: AbortSignal.timeout ? AbortSignal.timeout(4000) : undefined });
    const run = r.status === 200 ? ((await r.json()).workflow_runs || [])[0] : null;
    if (run && /^[0-9a-f]{40}$/.test(String(run.head_sha)) && Date.parse(run.updated_at) > 0) _upd = { at: now, sha: run.head_sha, t: Date.parse(run.updated_at) };
  } catch (e) {}
  return _upd;
}
/* 25/10/2026: מתי שרת שאל בפעם האחרונה וקיבל "חלון עדכון" (בזיכרון — הטלפון והעובד מדברים עם אותו שרתון בייצור;
   במופע אחר בלי הסימון רק ההודעה הכללית "בתור לשרת"). עבודה בתור שרואה אותו — "השרת מתעדכן לגרסה חדשה" */
let updWaitAt = 0;
const UPD_SEEN_MS = 90e3;
const updWaiting = (job, now) => now - updWaitAt < UPD_SEEN_MS && apiJob(job) && job.state === 'queued' && !job.sid && !job.vw;
async function updatePending(deps, ver, now) {
  if (!/^[0-9a-f]{12}$/.test(String(ver || ''))) return false;      // dev / לא ידוע — בלי חלון
  const w = await latestWorker(deps, now);
  return !!(w && w.sha && w.t && now - w.t >= 0 && now - w.t < UPD_WIN && !w.sha.startsWith(ver));
}

/* ---------- 25/10/2026 (בקשת המשתמש): יוטיוב בשרת דרך חשבון ייעודי ----------
   המנהל מדביק את cookies.txt במרכז הניהול (adminYt) → מוצפן בכספת (studioVault/_ytck). שרת התרגום מושך אותו עם הטוקן שלו
   (ytCk) רק כשהגרסה (v) השתנתה, מחזיר את הגרסה ש־yt-dlp עדכן (put — רק לאותה גרסה: עוגיות חדשות של המנהל גוברות),
   ומדווח הצלחה/חסימה (rep). שתי חסימות ברצף = "נחסם": הטלפון חוזר להסביר שיוטיוב רק באנדרואיד, ובדיקת המוכנות שולחת התראה */
const YT_DOC = '_ytck', YT_AAD = 'ytck|cookies', YT_BAD_N = 2;
let ytC = { at: 0, v: null };
async function ytDoc(deps, now, fresh) {
  if (!fresh && ytC.v && Math.abs(now - ytC.at) < 60e3) return ytC.v;
  const d = (await readDoc(deps, 'studioVault', YT_DOC).catch(() => null)) || {};
  ytC = { at: now, v: d };
  return d;
}
async function ytCkOp(deps, body, now) {
  if (!vault.configured()) return { ok: true, v: 0 };
  const d = await ytDoc(deps, now, true);
  const v = +d.yv || 0;
  const patch = {};
  const rp = YT.normRep(body.rep);
  if (rp && d.yk && +body.v === v) {
    if (rp.ok) { if (d.ys !== 'ok' || now - (+d.yo || 0) > 600e3 || +d.yb) Object.assign(patch, { ys: 'ok', yo: now, yb: 0 }); }
    else {
      const yb = (+d.yb || 0) + 1;
      Object.assign(patch, { yb, yc: rp.code, yt: now }, yb >= YT_BAD_N ? { ys: 'bad' } : {});
    }
  }
  if (typeof body.put === 'string' && d.yk && +body.v === v) {
    const c = YT.normCookies(body.put);
    if (!c.error) Object.assign(patch, { yk: vault.seal({ t: c.text }, YT_AAD), yn: c.n, ye: c.exp, yp: now });
  }
  if (Object.keys(patch).length) { await patchDoc(deps, 'studioVault', YT_DOC, patch); ytC = { at: 0, v: null }; }
  if (!d.yk) return { ok: true, v };
  if (+body.v === v) return { ok: true, v, same: true };
  const o = vault.open(d.yk, YT_AAD);
  return o && o.t ? { ok: true, v, ck: o.t } : { ok: true, v: 0 };
}
/* 26/10/2026: אימות שרת בזיכרון לפעולות הקלות (ראו server). שרת שהוסר / טוקן שהוחלף — עד SRV_AUTH_MS בפעולות האלה בלבד;
   poll (לקיחת עבודה) תמיד מול Firestore */
const SRV_LIGHT = new Set(['pq', 'ptNext', 'ptMark', 'ytCk', 'devLog', 'devMet', 'pulse']);   // pulse — התראות השלב (27/10/2026)
const SRV_AUTH_MS = 5 * 60e3;
const srvAuthMem = new Map();
function srvAuthHit(sid, tok, now) {
  const e = srvAuthMem.get(sid);
  return e && now - e.at >= 0 && now - e.at < SRV_AUTH_MS && S.serverMatches(e.srv, tok) ? e.srv : null;
}
function srvAuthPut(sid, srv, now) {
  if (srv) srvAuthMem.set(sid, { srv, at: now });
  else srvAuthMem.delete(sid);
  if (srvAuthMem.size > 200) srvAuthMem.clear();
}

/* 27/10/2026 (מחקר היעילות): שרת פנוי כתב את מסמך השרת בכל poll (כל 20 שנ׳ — כ־4,300 כתיבות ביום מתוך מכסה של 20 אלף).
   עכשיו: כתיבה רק כשמשהו שמישהו קורא השתנה (עבודות שרצות, גרסה, עלייה מחדש, דגלים, העבודה שבמסמך) — אחרת פעם ב־SEEN_MS.
   ההשוואה מול המסמך שכבר נקרא ב־poll (בלי זיכרון במופע). "לא מדווח" (SRV_ONLINE_MS 12 דק׳, SRV_DOWN_MS 15) רחוק מזה */
const SEEN_MS = 3 * 60e3;
const hbKey = (h) => { h = h && typeof h === 'object' ? h : {}; return [+h.nj || 0, h.busy || '', h.v || '', +h.mx || 0].join('|'); };
const seenDue = (srv, hb, boot, now) => boot || hbKey(srv.hb) !== hbKey(hb) || !(now - (+srv.seen || 0) < SEEN_MS);

/* ---------- 22/10/2026: הורדה מקישור — בדיקת קישור בתור לעובד ----------
   הטלפון יוצר מסמך ב־studioProbe (op:'urlProbe'), העובד לוקח (op:'pq' עם טוקן השרת) ומחזיר סיכום או קוד שגיאה.
   כדי לא לקרוא ל־Firestore בכל 4 שניות: probeHint = מתי נוצרה בדיקה במופע הזה (בייצור הטלפון והעובד מדברים עם אותו
   שרת); בלי בדיקה חדשה — שאילתה אחת לדקה (בדיקה שנוצרה במופע אחר — Vercel כגיבוי — נלקחת עד דקה אחרי). */
let probeHint = 0, probeScan = 0;
const PROBE_SCAN_MS = 20e3;
const PQ_DONE_MAX = 128 * 1024;   // התמונה (עד 80KB) + הפורמטים, הכתוביות והפרקים
async function pqOp(deps, body, sid, now) {
  if (body.done === true) {
    const pid = String(body.pid || '');
    if (!/^p[0-9a-z]{6,30}$/.test(pid)) return { ok: false, error: 'bad_params' };
    const pr = await readDoc(deps, 'studioProbe', pid);
    if (!pr || pr.st !== 'r' || pr.sid !== sid) return { ok: false, error: 'state' };
    if (body.ok === true) {
      const r = SU.normProbe(body.r);
      if (!r) await patchDoc(deps, 'studioProbe', pid, { st: 'e', e: 'fail', ft: now });
      else await patchDoc(deps, 'studioProbe', pid, { st: 'd', pbr: r, ft: now });
    } else {
      const e = SU.PROBE_ERRS.includes(String(body.e || '')) ? String(body.e) : 'fail';
      await patchDoc(deps, 'studioProbe', pid, { st: 'e', e, ft: now });
    }
    return { ok: true };
  }
  // 24/10/2026: בייצור העובד שואל את Vercel והטלפון את api.thesnowball.app — probeHint לא עוזר שם, ודקה של המתנה + הבדיקה
  // עברו את מה שהטלפון חיכה. סריקה כל PROBE_SCAN_MS (שאילתה ריקה = קריאה אחת ב־Firestore)
  if (now - probeHint > SU.PROBE_TTL && now - probeScan < PROBE_SCAN_MS) return { ok: true, pr: null };
  probeScan = now;
  const qd = (await query(deps, 'studioProbe', { st: 'q' }, 10)).sort((a, b) => (a.at || 0) - (b.at || 0));
  for (const pr of qd) {
    if (now - (pr.at || 0) > SU.PROBE_TTL) continue;                          // הטלפון כבר הציג "לא ענה"
    if (await patchIf(deps, 'studioProbe', pr.id, { st: 'r', sid, rt: now }, pr._ut).catch(() => false)) return { ok: true, pr: Object.assign({ id: pr.id, u: pr.u }, pr.ref ? { ref: pr.ref } : {}) };
  }
  return { ok: true, pr: null };
}

async function server(req, res, body, deps) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
  let len = 0; try { len = JSON.stringify(body).length; } catch (e) { len = 1e9; }
  // 24/10/2026: תשובה לבדיקת קישור כוללת תמונה קטנה (עד TH_MAX) + כל הפורמטים — TED יצא 15.8KB, והתקרה של 4KB דחתה אותה
  // בשקט (413): הבדיקה נשארה "בודקים" והטלפון הציג "השרת לא ענה בזמן". normProbe מגביל כל שדה
  const cap = body.op === 'devLog' || body.op === 'devMet' ? DL.BODY_MAX : body.op === 'pq' && body.done === true ? PQ_DONE_MAX : body.op === 'ytCk' ? YT.OUT_MAX + 4096
    : body.op === 'ptMark' ? RL.MAX_TEXT + 8192 : 4096;   // 25/10/2026: תשובה של Claude לעבודה שהטלפון מריץ
  if (len > cap) return res.status(413).json({ ok: false, error: 'too_large' });
  const hd = req.headers || {};
  const m = /^Bearer (\S+)$/.exec(String(hd.authorization || hd.Authorization || ''));
  const p = m && S.parseServerToken(m[1]);
  if (!p) return res.status(401).json({ ok: false, error: 'no_auth' });
  const pt = body.op === 'ptNext' || body.op === 'ptMark';
  if (limited((body.op === 'pq' ? 'q|' : pt ? 't|' : 's|') + p.sid, body.op === 'pq' ? 40 : pt ? 600 : 20)) return res.status(429).json({ ok: false, error: 'rate_limited' });   // pq — כל כמה שניות
  const now = deps.now || Date.now();
  try {
    // 26/10/2026: מכסת הקריאות היומית של Firestore (50 אלף בתוכנית החינמית) נגמרה בבוקר — רק משרת התרגום כשהוא פנוי:
    // pq כל 4 שניות, ptNext, devMet — כל אחת קראה את מסמך השרת. הפעולות הקלות מאמתות מול עותק בזיכרון (SRV_AUTH_MS);
    // poll/beat (שכותבים למסמך בתנאי) — תמיד קריאה טרייה, שגם מרעננת את העותק
    const light = SRV_LIGHT.has(body.op);
    const hit = light && srvAuthHit(p.sid, p.tok, now);
    const srv = hit || await readDocT(deps, 'studioServers', p.sid);   // _ut — הרישום של טוקן שנדחה בכתיבה בתנאי
    if (!hit) srvAuthPut(p.sid, srv, now);
    if (!srv || !S.serverMatches(srv, p.tok)) {
      if (srv) await badAuth(deps, srv, p.sid, now).catch(() => {});   // 15/10/2026: שרת קיים שהטוקן שלו נדחה — מדווחים, לא בשקט
      return res.status(401).json({ ok: false, error: 'no_auth', stop: true });
    }
    if (body.op === 'devLog' || body.op === 'devMet') return res.status(200).json({ ok: true, saved: await devSrv(deps, body, p.sid, now), now });   // האיסוף המלא
    if (pt) return res.status(200).json(Object.assign(await ptOp(deps, body, now), { now }));   // 25/10/2026: העונה לעבודות שהטלפון מריץ
    if (body.op === 'pq') return res.status(200).json(Object.assign(await pqOp(deps, body, p.sid, now), { now }));   // 22/10/2026: בדיקת קישור
    if (body.op === 'pulse') return res.status(200).json(Object.assign(await pulseOp(deps, body, p.sid, now), { now }));   // 27/10/2026: התראות השלב
    if (body.op === 'ytCk') return res.status(200).json(Object.assign(await ytCkOp(deps, body, now), { now }));   // 25/10/2026: חשבון יוטיוב ייעודי
    const hb = S.normHb(body.hb);
    const seen = { seen: now, hb, updated: now, mon: MON.monPush(srv.mon, hb, now) };   // 22/10/2026: נקודת היסטוריה לכל 5 דק׳ (לא מוסיף קריאה — נכתב עם הדופק)
    if (!(srv.seen > 0)) {
      // 15/10/2026: שרת שמתחבר בפעם הראשונה — התראה לטלפון (שרת שהוזמן אוטומטית עלה בלי שאף אחד ידע). כתיבה בתנאי: התראה אחת בלבד
      const first = await patchIf(deps, 'studioServers', p.sid, { seen: now, updated: now }, srv._ut).catch(() => false);
      if (first && UID_RE.test(String(srv.by || ''))) await notify(deps, srv.by, 'srv_new', '', now).catch(() => {});
    }
    if (srv.ba) { seen.ba = 0; await authBack(deps, srv, p.sid, now); }
    if (srv.dn) { seen.dn = 0; await serverBack(deps, srv, p.sid, now); }   // ת7: שרת שסומן "לא מדווח" חזר
    if (body.op === 'beat' || srv.paused) {
      if (body.op === 'beat' || seen.ba === 0 || seen.dn === 0 || seenDue(srv, hb, body.boot === true, now)) await patchDoc(deps, 'studioServers', p.sid, seen);
      return res.status(200).json({ ok: true, job: null, paused: srv.paused === true, now });
    }
    if (await updatePending(deps, hb.v, now).catch(() => false)) {
      updWaitAt = now;   // 25/10/2026: לדף העבודה — "השרת מתעדכן" במקום "בתור לשרת"
      await patchDoc(deps, 'studioServers', p.sid, seen);
      return res.status(200).json({ ok: true, job: null, upd: true, now });   // חלון עדכון — העובד מתחלף בדקות הקרובות
    }
    // 20/10/2026: הסוכן עלה (boot) — עבודה שהשרת הזה לקח ועוד "רצה" נקטעה בהפעלה מחדש. עד היום רק הסוכן דיווח עליה
    // (report_lost), אבל מצב העבודה שלו ב־/state (tmpfs) נמחק בהפעלה מחדש — והעבודה "רצה" שעתיים בלי שאף אחד עובד עליה
    if (body.boot === true) await lostOnBoot(deps, p.sid, now).catch(() => {});
    else if (hb.nj === 0 && orphanDue(p.sid, now)) await lostOnBoot(deps, p.sid, now, true).catch(() => {});   // 26/10: פעם ב־ORPHAN_MS, לא בכל poll   // שרת פנוי — עבודה "רצה" אצלו = יתומה
    if (body.boot === true) await smokeAfterUpdate(deps, srv, p.sid, hb.v, now).catch(() => {});   // פריט 13: עבודת בדיקה אחרי עדכון
    // poll: העבודה הוותיקה ביותר שמחכה לשרת
    const qd = (await query(deps, 'studioJobs', { state: 'queued', eng: 'api', sid: '' }, 30)).sort((a, b) => (a.fired || 0) - (b.fired || 0));
    // 21/10/2026: השרת כבר מריץ עבודה ושואל אם יש עוד — רק עבודה שהשיא הצפוי שלה נכנס בזיכרון שנשאר לו (fit).
    // לפי הסדר: אם הוותיקה לא נכנסת, לא מקדימים לה עבודה קטנה (אחרת עבודה ארוכה מחכה לנצח מאחורי קצרות)
    const fit = S.normFit(body.fit);
    for (const job of qd) {
      if (!apiJob(job) || S.effState(job, now).state !== 'queued') continue;
      if (ptJob(job)) continue;   // 25/10/2026: הטלפון לוקח אותה בעצמו (phClaim)
      if (job.vw && !((job.spec && job.spec.ph === 1 ? job.fph : job.fv) || {}).id) continue;   // 15/10/2026: מחכה לסרטון — לא תופסים שרת עד שהוא נרשם (24/10: בתרגום בטלפון — לקובץ המדידות)
      if (fit && S.peakNeed(job, fit) > fit.mb) break;
      const st = await readStats(deps, job.uid);
      const cap = S.jobCap(job.spec, S.monthUsed(st.mu, now), userMonth(st), S.usdOf(job.use0));
      if (!cap) {
        // התקציב החודשי (או התקרה של העבודה) נגמר בזמן שהעבודה חיכתה — נכשלת, לא נלקחת
        await patchIf(deps, 'studioJobs', job.id, { state: 'failed', err: capWhy(job, st, now), ended: now, updated: now }, job._ut).catch(() => false);
        continue;
      }
      const key = S.newKey();
      // 21/10/2026: לצפי — הליבות של השרת וכמה עבודות כבר רצות עליו (חולקות את המעבד)
      const fx = Object.assign(hb.cpu > 0 ? { hc: Math.round(hb.cpu) } : {}, { cc: Math.max(0, Math.round(hb.nj || 0)) });
      const got = await patchIf(deps, 'studioJobs', job.id, Object.assign({ sid: p.sid, pk: now, vw: 0, capc: Math.round(cap * 100), kh: S.keyHash(key), kx: now + S.KEY_TTL, updated: now }, fx), job._ut);
      if (!got) continue;
      await patchDoc(deps, 'studioServers', p.sid, Object.assign(seen, { job: job.id }));
      const dur = job.spec && job.spec.dur > 0 ? Math.round(job.spec.dur) : 0;
      return res.status(200).json({ ok: true, job: Object.assign({ id: job.id, key, kind: job.kind }, dur ? { dur } : {}), now });
    }
    // שרת שעדיין מריץ עבודה (nj) ושאל אם יש עוד — העבודה שלו נשארת רשומה. 27/10/2026: בלי שינוי — לא כותבים (seenDue)
    const clr = !(hb.nj > 0) && !!srv.job;
    if (clr || seen.ba === 0 || seen.dn === 0 || seenDue(srv, hb, body.boot === true, now)) await patchDoc(deps, 'studioServers', p.sid, Object.assign(seen, hb.nj > 0 ? {} : { job: '' }));
    return res.status(200).json({ ok: true, job: null, now });
  } catch (err) {
    return res.status(502).json({ ok: false, error: /^(fs_http_|sa_http_)/.test(String(err.message)) ? String(err.message).slice(0, 30) : 'failed' });
  }
}

/* פריט 13 (סבב הייעול, 21/10/2026): הסוכן עלה בגרסה חדשה של העובד (hb.v ≠ smv) — עבודת בדיקה של דקה (S.smokeJob) למי
   שהוסיף את השרת, מעבודת הזהב שלו, לתור הרגיל (רצה כשיש מקום — לא עוצרת עבודה). נכשלה = ההתראות הרגילות של עבודה שנכשלה.
   הפעם הראשונה של שרת רק נרשמת; smv נכתב בתנאי — בדיקה אחת לגרסה. STUDIO_SMOKE=off מכבה */
async function smokeAfterUpdate(deps, srv, sid, v, now) {
  if (process.env.STUDIO_SMOKE === 'off' || !/^[0-9a-f]{12}$/.test(String(v || '')) || srv.smv === v) return;
  const mine = await patchIf(deps, 'studioServers', sid, { smv: v, updated: now }, srv._ut).catch(() => false);
  if (!mine || !srv.smv || !UID_RE.test(String(srv.by || ''))) return;
  const all = await listJobs(deps, srv.by);
  if (all.some((j) => j.sm && S.ACTIVE.includes(S.effState(j, now).state))) return;
  const src = S.goldSources(all).sort((a, b) => (b.created || 0) - (a.created || 0))[0];
  const c = src && S.smokeJob(src, S.newJobId(), srv.by, now);
  if (!c) return;
  await patchJob(deps, c.id, c);
  await queueApi(deps, srv.by, c, now);
}
/* 20/10/2026: העבודה שהשרת הזה עבד עליה כשהסוכן עלה מחדש — כמו דיווח fail: worker_lost של העובד (תקלה חולפת: חלון
   התאוששות ואז "המשך" אוטומטי מנקודת השמירה). רק עבודה שבאמת אצלו (sid) ושעוד רצה; המפתח מת — עובד ישן לא ממשיך לכתוב */
/* 22/10/2026 (הפקה מחדש "צורבים" עם פס ריק, השרת ב־0% — באג agent.AUTO_KINDS): שרת שמדווח שאין אצלו אף עבודה (hb.nj = 0)
   ועבודה רשומה "רצה" אצלו יותר מ־ORPHAN_MS — אף אחד לא עובד עליה. כמו בעלייה מחדש: worker_lost (+ "המשך" אוטומטי לתרגום),
   במקום לחכות לשעתיים של STALE_MS. רק סוכן שמדווח nj (מ־21/10) */
const ORPHAN_MS = 3 * 60 * 1000;
/* 26/10/2026: שאילתת היתומות של שרת פנוי — לכל היותר פעם ב־ORPHAN_MS לשרת (עד היום בכל poll, כל 20 שניות) */
const orphanAt = new Map();
function orphanDue(sid, now) {
  const t = orphanAt.get(sid) || 0;
  if (now >= t && now - t < ORPHAN_MS) return false;
  orphanAt.set(sid, now);
  if (orphanAt.size > 200) orphanAt.clear();
  return true;
}
async function lostOnBoot(deps, sid, now, idle) {
  let n = 0;
  for (const job of await query(deps, 'studioJobs', { sid, state: 'running' }, 20)) {
    if (!apiJob(job) || S.effState(job, now).state !== 'running') continue;
    if (idle && !(now - (+job.pk || +job.claimed || now) > ORPHAN_MS)) continue;   // נלקחה ממש עכשיו — עוד לא נרשמה במשבצת
    const up = S.applyReport(job, { fail: true, err: 'worker_lost', msg: idle ? 'השרת לא עבד על העבודה' : 'השרת הופעל מחדש באמצע העבודה' }, now);
    up.kh = ''; up.kx = 0;
    if (job.kind === 'tr' && (job.ar || 0) < S.AUTO_RESUME_MAX) up.rw = now + S.recoverWait(job, now);
    if (job.kind === 'tr') up.eh = (Array.isArray(job.eh) ? job.eh : []).concat([{ e: 'worker_lost', s: (up.prog && up.prog.st) || '', at: now }]).slice(-10);
    if (await patchIf(deps, 'studioJobs', job.id, up, job._ut).catch(() => false)) n++;
  }
  return n;
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
async function doResume(deps, uid, job, now, body, auto, adm) {
  // 20/10/2026: קריאה טרייה עם updateTime, והכתיבה הראשונה בתנאי — שני "המשך" כמעט באותו רגע (לחיצה + ההמשך האוטומטי,
  // או שתי לחיצות) קראו שניהם "נכשלה" והשני דרס את המפתח של הראשון, שהשרת כבר לקח: העובד קיבל "עצור" והעבודה נתקעה
  const fresh = await readDocT(deps, 'studioJobs', job.id).catch(() => null);
  if (fresh && fresh.uid === job.uid) job = fresh;
  const why = S.canResume(job, now);
  if (why) return { status: 409, json: { ok: false, error: why } };
  // v376: ספר ההפעלה "מצב זול יותר" — משנה את התוצאה, ולכן רק בלחיצה שלך (לא בהמשך האוטומטי) ורק אחרי עצירה על עלות
  let dm = '';
  if (body.mode != null && !auto) {
    const from = job.spec && job.spec.mode;
    if (!S.COST_STOP(job) || !S.cheaperModes(from).includes(body.mode)) return { status: 409, json: { ok: false, error: 'mode' } };
    dm = from;
  }
  const sb = await sysBlock(deps, job, now, auto, adm);   // 15/10/2026: תחזוקה / דגל כבוי
  if (sb) return { status: 409, json: Object.assign({ ok: false }, sb) };
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
  { const pg = S.resumeProg(job.prog, now); if (pg) patch.prog = pg; }   // 21/10/2026: השלב שנעצר בו — "עכשיו", לא ✓
  if (dm) patch.spec = Object.assign({}, job.spec, { mode: body.mode, dm });   // dm = המצב שממנו ירדנו (לספירת ספר ההפעלה)   // נרשם לפני ההפעלה — שתי צפיות במקביל לא יפעילו פעמיים
  if (job._ut) {
    // בתנאי: מישהו אחר כבר המשיך אותה מאז שקראנו — לא מפעילים שוב (ולא דורסים את המפתח של ההפעלה שרצה)
    if (!(await patchIf(deps, 'studioJobs', job.id, patch, job._ut))) return { status: 409, json: { ok: false, error: 'state', job: S.publicJob(await readJob(deps, job.id), now) } };
  } else await patchJob(deps, job.id, patch);
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
/* 14/10/2026: עד היום ההמשך האוטומטי רץ רק כשהטלפון פתח את רשימת העבודות — עבודה שנכשלה בתקלה חולפת כשהסטודיו סגור
   נשארה "נכשלה" בשקט (בלי התראה, כי חיכתה להמשך). עכשיו גם הבדיקה המתוזמנת (watch) עוברת על העבודות שנכשלו.
   שאילתה עם שוויון אחד (state) — בלי אינדקס. מחזיר כמה עבודות הופעלו */
/* 25/10/2026 (עבודה אמיתית מאייפון: פרק שחיכה שעתיים ל"התחל" שלא הגיע): ההתחלה במקום אחד — מהטלפון (op:'start'), ביצירה של
   עבודה מקישור (create עם start:true), ומהבדיקה המתוזמנת (startAll — גם כשהטלפון סגור). סירוב נרשם במסמך העבודה
   (sw = הקוד, swt = מתי): מכשיר אחר רואה למה העבודה מחכה, והבדיקה המתוזמנת מנסה שוב רק סירוב חולף (S.START_RETRY).
   g = { adm, modeLocked, engLocked } — מהבקשה; בבדיקה המתוזמנת אין משתמש (adm שקר, והמצב / המנוע כבר נבדקו ביצירה) */
const filesReady = (job) => job.kind === 'dx' || !(job.kind === 'ai' ? !job.fq : job.spec && job.spec.src === 'subs' ? !job.fsu : job.spec && job.spec.src === 'url' ? !SR.isFolder(job.folder) : job.spec && job.spec.ph === 1 ? (job.spec.pw === 1 ? !(job.fpw && job.fph) : !job.fa) || !SR.isFolder(job.folder) : !job.fa && !job.fv || job.kind === 'rr' && !(job.fv && job.fc));
const jobView = (j, now) => Object.assign(S.publicJob(j, now), updWaiting(j, now) ? { uw: 1 } : {});
async function startJob(deps, uid, job, body, now, g) {
  const r = await startJob0(deps, uid, job, body, now, g);
  const o = r[1], e = !o.ok && o.error && !['state', 'no_files'].includes(o.error) ? String(o.error).slice(0, 40) : '';
  if (e || (o.ok && job.sw)) {   // רישום הסירוב (או ניקוי שלו) לא מפיל את התשובה
    await patchJob(deps, job.id, e ? { sw: e, swt: now } : { sw: '', swt: 0 }).catch(() => {});
    if (o.job) o.job = Object.assign({}, o.job, { sw: e });
  }
  return r;
}
async function startJob0(deps, uid, job, body, now, g) {
  const view = (x) => jobView(x, now);
  const st = S.effState(job, now).state;
  if (!['tr', 'rr', 'ai', 'dx'].includes(job.kind) || st !== 'new') return [409, { ok: false, error: 'state', job: view(job) }];
  if (!filesReady(job)) return [409, { ok: false, error: 'no_files' }];
  if (job.kind === 'tr' && !S.langReady(job.spec)) return [400, { ok: false, error: 'lang_unsupported', job: view(job) }];
  if (job.kind !== 'rr' && job.kind !== 'dx' && g.modeLocked && await g.modeLocked(job.spec && job.spec.mode)) return [403, { ok: false, error: 'mode_locked', job: view(job) }];   // גם עבודה שנוצרה לפני שהרשימה השתנתה / סט הזהב
  if (!S.WORKER_KINDS.includes(job.kind)) return [200, { ok: false, error: 'worker_not_ready', job: view(job) }];
  const sbs = await sysBlock(deps, job, now, false, !!g.adm);   // 15/10/2026: תחזוקה / דגל כבוי
  if (sbs) return [409, Object.assign({ ok: false, job: view(job) }, sbs)];
  if (g.engLocked && await g.engLocked(job.spec)) return [403, { ok: false, error: 'eng_locked', job: view(job) }];   // 25/10/2026: גם עבודה ישנה שנוצרה ב־Routine
  const stop = await ruleBlock(deps, uid, job, body);   // v367: מתג החירום / מצב מעל המקסימום
  if (stop) return [409, Object.assign({ ok: false, job: view(job) }, stop)];
  const mj = body.mo !== true ? await majorNow(deps, uid, job) : null;   // v371: תקלה רחבה — מחכים, או "להתחיל בכל זאת"
  if (mj) return [409, { ok: false, error: 'major', mi: { c: mj.c, e: mj.e, at: mj.at, n: mj.n || 0 }, job: view(job) }];
  if (apiJob(job)) {
    const q = await queueApi(deps, uid, job, now);
    return [200, Object.assign({ ok: q.ok, job: view(await readJob(deps, job.id)) }, q.ok ? {} : { error: q.error })];
  }
  const v = await readVault(deps, uid);
  if (!v || !v.r) return [200, { ok: false, error: 'conn_missing' }];
  if (S.recentFires(v.fh, now).length >= S.FIRE_HOUR) return [429, { ok: false, error: 'budget' }];
  const f = await fireJob(deps, uid, v, job, now);
  const j = await readJob(deps, job.id);
  return [200, Object.assign({ ok: f.ok, job: view(j) }, f.ok ? (f.unsure ? { unsure: f.unsure, detail: f.detail } : {}) : { error: f.error, retry: f.retry, detail: f.detail || '' })];
}
/* הבדיקה המתוזמנת (כל 10 דק׳): עבודות במצב השרת שמוכנות ולא התחילו — "התחל" לא הגיע (הדף הוקפא / נסגר אחרי היצירה או
   אחרי שהקול עלה), או סירוב חולף שעבר (תחזוקה, דגל, תקלה רחבה, יותר מדי עבודות). רק במצב השרת (Routine = הפעלה של המנוי
   שלך — לא מכאן), רק עד START_AGE מהיצירה, ועד START_MAX בריצה. מחזיר כמה התחילו */
const START_AGE = 24 * 3600e3, START_MAX = 10;
/* 26/10/2026 (מכסת Firestore נגמרה): הבדיקה המתוזמנת קראה כל 10 דק׳ את *כל* העבודות במצב "נכשלה" (עד 100) ו"חדשה" (עד 200)
   — גם בנות חודשים. שתיהן צריכות רק עבודות שהשתנו ביממה האחרונה (START_AGE; חלון ההתאוששות ותקלה רחבה — 24 שעות), לכן
   שאילתה אחת עם טווח על updated (אינדקס אוטומטי, כמו jobs30) — כל עבודה פעם אחת, משותפת לשתי הבדיקות באותה ריצה */
const RECENT_MS = 26 * 3600e3, RECENT_MAX = 300;
async function recentJobs(deps, now) {
  const r = await fsCall(deps, 'POST', ':runQuery', { structuredQuery: { from: [{ collectionId: 'studioJobs' }],
    where: { fieldFilter: { field: { fieldPath: 'updated' }, op: 'GREATER_THAN_OR_EQUAL', value: { integerValue: String(Math.round(now - RECENT_MS)) } } },
    orderBy: [{ field: { fieldPath: 'updated' }, direction: 'DESCENDING' }], limit: RECENT_MAX } });
  if (r.status !== 200) throw new Error('fs_http_' + r.status);
  const v = (Array.isArray(r.j) ? r.j : []).filter((x) => x && x.document && x.document.name)
    .map((x) => Object.assign(S.fromFields(x.document.fields), { id: String(x.document.name).split('/').pop(), _ut: x.document.updateTime || '' }));
  return v;
}
async function startAll(deps, now, recent) {
  if (process.env.SNB_STARTALL === 'off') return 0;
  const cands = (recent || await recentJobs(deps, now)).filter((j) => j.state === 'new').filter((j) => UID_RE.test(String(j.uid || '')) && S.startDue(j, now, START_AGE) && apiJob(j) && filesReady(j));
  let n = 0;
  for (const j of cands.slice(0, START_MAX)) {
    const fresh = await readDocT(deps, 'studioJobs', j.id).catch(() => null);
    if (!fresh || fresh.uid !== j.uid || !S.startDue(fresh, now, START_AGE)) continue;   // הטלפון הקדים בינתיים
    const [, o] = await startJob(deps, j.uid, fresh, {}, now, { adm: false }).catch(() => [0, { ok: false }]);
    if (o.ok) n++;
  }
  return n;
}
const incSeen = new Map();
async function recoverAll(deps, now, recent) {
  const failed = (recent || await recentJobs(deps, now)).filter((j) => j.state === 'failed' && j.kind === 'tr' && UID_RE.test(String(j.uid || '')));
  // תקלה רחבה מזוהה גם כשהטלפון סגור (syncInc) — רק למי שנכשלה לו עבודה ביממה האחרונה, עד 5 משתמשים בריצה
  // 26/10/2026: רק כשהופיע כישלון חדש מאז הסנכרון האחרון למשתמש (incSeen) — עד היום כל 10 דק׳ קראו את כל העבודות שלו
  // (עד 300 קריאות) כל עוד היה כישלון אחד ביממה האחרונה
  const last = {};
  for (const j of failed) if (now - (j.ended || j.updated || 0) < 864e5) last[j.uid] = Math.max(last[j.uid] || 0, +j.updated || +j.ended || 0);
  const fresh = Object.keys(last).filter((uid) => last[uid] > (incSeen.get(uid) || 0)).slice(0, 5);
  for (const uid of fresh) { await syncInc(deps, uid, await listJobs(deps, uid), now); incSeen.set(uid, last[uid]); }
  const due = failed.filter((j) => S.recoverAt(j, now) && now >= S.recoverAt(j, now));
  const by = {};
  for (const j of due) (by[j.uid] = by[j.uid] || []).push(j);
  let n = 0;
  for (const uid of Object.keys(by)) n += await autoRecover(deps, uid, by[uid], now);
  return n;
}
/* v368: עבודות שחלון ההתאוששות שלהן נגמר — ממשיכות לבד (נבדק בכל צפייה מהטלפון). מתג החירום / אין חיבור — מוותרים, והעבודה נשארת "נכשלה" */
async function autoRecover(deps, uid, jobs, now) {
  const due = jobs.filter((j) => j.kind === 'tr' && S.recoverAt(j, now) && now >= S.recoverAt(j, now));
  let n = 0;
  for (const j of due) {
    if (await majorNow(deps, uid, j)) continue;   // v371: בתקלה רחבה מחכים (rw נשאר) — ממשיכים כשהיא עוברת
    if (SF.maintOn(await sysCfg(deps, now), now)) continue;   // 15/10/2026: בזמן תחזוקה מחכים — ממשיכים כשהיא נגמרת
    n++;
    const r = await doResume(deps, uid, j, now, {}, true).catch(() => ({ json: { ok: false, error: 'failed' } }));
    if (!r.json.ok && r.json.error !== 'budget') {   // תקציב ההפעלות — ננסה בפעם הבאה
      await patchJob(deps, j.id, { rw: 0, updated: now }).catch(() => {});
      await notify(deps, uid, 'fail', j.id, now);   // ויתרנו על ההמשך — עכשיו זה כישלון אמיתי, וההתראה שנדחתה נשלחת
    }
    if (r.json.ok) await raise(deps, uid, [{ c: 'claude', k: 'auto' }], j.id, now);
  }
  return n;
}

/* קובץ שהעובד העלה — קיים, לא בפח, ובתיקיית העבודה ב־Drive (הלקוח של הסטודיו רואה רק מה שהאפליקציה יצרה). מחזיר את הגודל, או null */
async function driveFileInFolder(deps, uid, folder, fid) {
  if (SR.isFolder(folder)) {   // ת4: עבודה שהקבצים שלה ב־R2 — אותה בדיקה (קיים, בתיקייה, הגודל)
    const c = R2.config();
    if (!c.ok) return { error: 'r2_off' };
    const m = await SR.fileIn(c, r2deps(deps), { uid, folder, id: fid, rec: await upRec(deps, fid) });
    return m ? { id: fid, name: m.name, size: m.size, mime: m.mime } : null;
  }
  const t = await gdrive.accessToken(deps, uid);
  if (!t.ok) return { error: t.error };
  const r = await (deps.fetch || fetch)(DRIVE + fid + '?fields=id,name,size,parents,trashed', { headers: { Authorization: 'Bearer ' + t.token } });
  let meta = null; try { meta = await r.json(); } catch (e) {}
  if (r.status !== 200 || !meta || meta.trashed || !(Array.isArray(meta.parents) && meta.parents.includes(folder))) return null;
  return { id: fid, name: String(meta.name || '').slice(0, 200), size: Number(meta.size) || 0 };
}

/* ---------- ת4: הקבצים ב־R2 ----------
   רשומת העלאה לכל קובץ במסמך משלו (studioUp/<id>, עם f = התיקייה) — בלי לגעת במסמך העבודה שהעובד והטלפון כותבים אליו.
   הטלפון מעלה ומוריד בתיקייה של העבודה שלו; העובד — בתיקייה של העבודה שהמפתח שלו פותח. */
const r2deps = (deps) => ({ fetch: deps.fetch, now: () => deps.now || Date.now() });
async function upRec(deps, id) { return SR.isId(id) ? readDoc(deps, 'studioUp', id).catch(() => null) : null; }
async function r2Files(deps, op, body, uid, folder, by) {
  if (!SR.isFolder(folder)) return [400, { ok: false, error: 'not_r2' }];
  const c = R2.config();
  if (!c.ok) return [503, { ok: false, error: 'r2_off' }];
  const id = String(body.id || ''), rd = r2deps(deps);
  if ((id || (op !== 'up' && op !== 'bg')) && !SR.inFolder(id, folder)) return [400, { ok: false, error: 'bad_id' }];
  const rec = id ? await upRec(deps, id) : null;
  let out;
  if (op === 'up') out = await SR.upStart(c, rd, { uid, folder, id, size: body.size, type: body.type, name: body.name, rec, by, replace: by === 'worker' && body.replace === true });
  else if (op === 'bg' && by === 'phone') out = await SR.upBg(c, rd, { uid, folder, id, size: body.size, type: body.type, name: body.name, rec });   // 23/10/2026: Background Fetch
  else if (op === 'parts') out = await SR.upParts(c, rd, { id, rec, up: body.up, uid });
  else if (op === 'done') out = await SR.upDone(c, rd, { id, rec, up: body.up, uid });
  else if (op === 'url') return [200, await SR.getUrl(c, rd, { uid, folder, id, by, name: body.name ? String(body.name) : '' })];
  else if (op === 'del') { await SR.delFile(c, rd, { uid, folder, id, rec }); if (rec) await delDoc(deps, 'studioUp', id).catch(() => null); return [200, { ok: true }]; }
  else return [400, { ok: false, error: 'bad_op' }];
  const fid = out.res.id || id;
  if (out.rec && fid) await patchDoc(deps, 'studioUp', fid, Object.assign({}, out.rec, { f: folder }));
  return [200, out.res];
}
/* רישום קובץ שעלה ל־R2 בעבודה (op:'file' מהטלפון, ו־r2bgDone מה־service worker): קיים, בתיקייה של העבודה, והסרטון /
   הכתוביות בגודל של המקור. משנה את job במקום. מחזיר {} או { code, error } */
async function r2Register(deps, job, which, fid, now) {
  const fkey = which === 's' ? 'fsu' : which === 'm' ? 'fph' : which === 'w' ? 'fpw' : which === 'r' ? 'fsr' : 'f' + which;   // m = קובץ המדידות, w = המילים (תרגום בטלפון), r = עזר להגהה
  const m = await driveFileInFolder(deps, job.uid, job.folder, fid);
  if (m && m.error) return { code: 200, error: m.error };
  const f = m && S.normFile({ id: fid, name: m.name || (which === 'v' ? 'video' : which === 's' ? 'subs' : 'audio'), size: m.size, mimeType: m.mime });
  if (!f) return { code: 400, error: 'file_bad' };
  if ((which === 'v' || which === 's') && job.spec && f.size !== job.spec.size) return { code: 400, error: 'file_size' };
  if (which === 'm' && f.size > S.PH_META_MAX) return { code: 400, error: 'file_size' };
  if (which === 'w' && f.size > S.PH_WORDS_MAX) return { code: 400, error: 'file_size' };
  if (which === 'r' && f.size > S.SUBS_MAX) return { code: 400, error: 'file_size' };
  f.at = now;
  await patchJob(deps, job.id, { [fkey]: f, updated: now });
  job[fkey] = f;
  return {};
}

/* 24/10/2026: תרגום בטלפון — Studio לאנדרואיד מדבר עם השרתון בלי הדפדפן, במפתח של עבודה אחת (op:'phKey' מהדף).
   מותר רק מה שהטלפון צריך: להעלות לתיקייה של העבודה, לרשום את הקול ואת קובץ המדידות, להתחיל (פעם אחת — כל הבדיקות
   של התחלה רגילה), לקרוא את המצב, להוריד את התוצרים של העבודה (he.ass לצריבה) ולדווח על הצריבה. שום דבר אחר */
async function phoneOp(req, res, body, deps) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
  let len = 0; try { len = JSON.stringify(body).length; } catch (e) { len = 1e9; }
  if (len > 4096) return res.status(413).json({ ok: false, error: 'too_large' });
  const id = String(body.job || ''), key = String(body.key || '');
  if (!S.JOB_RE.test(id) || !S.KEY_RE.test(key)) return res.status(400).json({ ok: false, error: 'bad_params' });
  if (limited('ph|' + id, 60)) return res.status(429).json({ ok: false, error: 'rate_limited' });
  const now = deps.now || Date.now();
  try {
    const job = await readJob(deps, id);
    // 25/10/2026: הסרטון נשמר בטלפון לצריבה נוספת עד שהפרויקט נמחק — הטלפון שואל אם העבודה עדיין קיימת. "נמחקה" רק
    // כש־Firestore ענה 404 (תקלה = חריגה = 5xx, והטלפון לא מוחק). בלי בדיקת המפתח: הוא פג אחרי זמן, והתשובה אומרת רק
    // אם מזהה (21 תווים אקראיים) קיים — בלי שום פרט ממנו
    if (body.op === 'phAlive') {
      if (!job) return res.status(404).json({ ok: false, error: 'gone' });
      return res.status(200).json({ ok: true, now, alive: true });
    }
    if (!job || !(job.spec && job.spec.ph === 1) || job.kind !== 'tr' || !S.keyMatches(job, key, 'pkh') || now > (job.pkx || 0)) return res.status(403).json({ ok: false, error: 'bad_key' });
    const e = S.effState(job, now), op = body.op;
    if (op === 'phJob') {
      return res.status(200).json({ ok: true, now, job: { id, state: e.state, err: e.err, prog: job.prog || null, pb: job.spec.pb || '',
        out: (Array.isArray(job.fo) ? job.fo : []).map((o) => ({ id: o.id, k: o.k, size: o.size })), a: !!job.fa, m: !!job.fph, w: !!job.fpw, pbn: S.normPbn(job.pbn, job.pbn && job.pbn.at) } });
    }
    if (op === 'phGet') {
      const fid = String(body.id || '');
      if (!(Array.isArray(job.fo) && job.fo.some((o) => o && o.id === fid))) return res.status(400).json({ ok: false, error: 'bad_id' });
      const [code, out] = await r2Files(deps, 'url', { id: fid }, job.uid, job.folder, 'worker');
      return res.status(code).json(Object.assign({ now }, out));
    }
    if (op === 'phBurn') {
      if (e.state !== 'done') return res.status(409).json({ ok: false, error: 'state' });
      const pbn = S.normPbn(body.pbn, now);
      if (!pbn) return res.status(400).json({ ok: false, error: 'bad_params' });
      await patchJob(deps, id, { pbn });
      // 25/10/2026: הצריבה בטלפון מסתיימת אחרי שהעבודה "done" — בלי זה התוצאה שלה לא הגיעה לרשומה במאגר (רק בסוף, לא בכל אחוז)
      if (pbn.s !== 'run') await learnSave(deps, Object.assign({}, job, { pbn }), now);
      return res.status(200).json({ ok: true, now });
    }
    if (!['new', 'queued', 'running', 'failed'].includes(e.state)) return res.status(409).json({ ok: false, error: 'state' });
    if (op === 'phProg') {   // 25/10/2026 (שלב 2): התמלול/היישור בטלפון — לפני שהעבודה מתחילה בשרת (רק "חדשה")
      if (e.state !== 'new') return res.status(409).json({ ok: false, error: 'state' });
      const ppr = S.normPpr(body.ppr, now);
      if (!ppr) return res.status(400).json({ ok: false, error: 'bad_params' });
      await patchJob(deps, id, { ppr });
      return res.status(200).json({ ok: true, now });
    }
    if (op === 'phClaim') {
      // 25/10/2026 (שלב 3): הטלפון לוקח את העבודה שלו — כמו poll של שרת: מפתח עבודה חדש (הקודם מת — Studio שהופעל מחדש
      // לוקח שוב), התקרה לפי התקציב שנשאר. רק אחרי phStart (בתור), ורק עבודה שהטלפון מריץ (pt)
      if (!ptJob(job)) return res.status(409).json({ ok: false, error: 'not_pt' });
      if (!(e.state === 'queued' || (e.state === 'running' && job.sid === 'ph'))) return res.status(409).json({ ok: false, error: 'state', state: e.state });
      const sbp = await sysBlock(deps, job, now, false, false);
      if (sbp) return res.status(409).json(Object.assign({ ok: false }, sbp));
      const stp = await readStats(deps, job.uid);
      const cap = S.jobCap(job.spec, S.monthUsed(stp.mu, now), userMonth(stp), S.usdOf(job.use0));
      if (!cap) return res.status(409).json({ ok: false, error: capWhy(job, stp, now) });
      const fresh = await readDocT(deps, 'studioJobs', id);
      const k = S.newKey();
      const got = fresh && await patchIf(deps, 'studioJobs', id, { sid: 'ph', pk: now, vw: 0, capc: Math.round(cap * 100), kh: S.keyHash(k), kx: now + S.KEY_TTL, updated: now }, fresh._ut).catch(() => false);
      if (!got) return res.status(409).json({ ok: false, error: 'busy' });
      rlAuth.delete(id + '|kh');
      const dur = job.spec && job.spec.dur > 0 ? Math.round(job.spec.dur) : 0;
      return res.status(200).json({ ok: true, now, job: Object.assign({ id, key: k, kind: job.kind }, dur ? { dur } : {}) });
    }
    if (op === 'phUp' || op === 'phParts' || op === 'phDone') {
      if (op === 'phUp' && !(Number(body.size) > 0 && Number(body.size) <= S.PH_UP_MAX)) return res.status(400).json({ ok: false, error: 'too_big' });
      const [code, out] = await r2Files(deps, { phUp: 'up', phParts: 'parts', phDone: 'done' }[op], body, job.uid, job.folder, 'phone');
      return res.status(code).json(Object.assign({ now }, out));
    }
    if (op === 'phFile') {
      const pw = !!(job.spec && job.spec.pw === 1);
      const which = (pw ? body.which === 'w' : body.which === 'a') || body.which === 'm' ? body.which : '';   // שלב 2: בלי קול, עם המילים
      const fid = String(body.id || '');
      if (!which || !S.FILE_ID_RE.test(fid) || !SR.inFolder(fid, job.folder)) return res.status(400).json({ ok: false, error: 'bad_params' });
      const rg = await r2Register(deps, job, which, fid, now);
      if (rg.error) return res.status(rg.code).json({ ok: false, error: rg.error });
      return res.status(200).json({ ok: true, now });
    }
    // phStart: פעם אחת, אחרי שהקול נרשם — אותן בדיקות של התחלה מהדף (תחזוקה ודגלים, מתג החירום והחוקים, תקלה רחבה)
    if (e.state !== 'new') return res.status(200).json({ ok: true, state: e.state, now });   // כבר התחילה — לא שוב
    if (job.spec && job.spec.pw === 1 ? !(job.fpw && job.fph) : !job.fa) return res.status(409).json({ ok: false, error: 'no_files' });   // שלב 2: המילים והמדידות לפני ההתחלה
    const sbs = await sysBlock(deps, job, now, false, false);
    if (sbs) return res.status(409).json(Object.assign({ ok: false }, sbs));
    const stop = await ruleBlock(deps, job.uid, job, { ov: body.ov === true });   // ov — מה שאישרת בדף לפני המסירה לאפליקציה
    if (stop) return res.status(409).json(Object.assign({ ok: false }, stop));
    const mj = body.mo !== true ? await majorNow(deps, job.uid, job) : null;
    if (mj) return res.status(409).json({ ok: false, error: 'major' });
    const q = await queueApi(deps, job.uid, job, now);
    return res.status(200).json(Object.assign({ ok: q.ok, now }, q.ok ? { state: 'queued' } : { error: q.error }));
  } catch (err) {
    return res.status(503).json({ ok: false, error: 'store' });
  }
}

/* 23/10/2026: הסרטון עלה ב־Background Fetch — ה־service worker (גם כשהאפליקציה סגורה) מסיים את ההעלאה ורושם אותו.
   בלי התחברות: ההרשאה = מפתח הסיום החד־פעמי שהשרתון נתן לטלפון ב־r2bg (ברשומת ההעלאה רק ה־hash). רק סרטון של עבודת
   תרגום, רק בתיקייה של העבודה. העבודה כבר התחילה מהקול (הקול קודם) — העובד מחכה לסרטון ולוקח אותו מכאן */
async function r2BgDone(req, res, body, deps) {
  const ip = String(((req.socket || {}).remoteAddress) || '');
  if (limited('bg|' + ip, 30)) return res.status(429).json({ ok: false, error: 'rate_limited' });
  const now = deps.now || Date.now();
  const jid = String(body.job || ''), id = String(body.id || '');
  if (!S.JOB_RE.test(jid) || !SR.isId(id)) return res.status(400).json({ ok: false, error: 'bad_params' });
  const c = R2.config();
  if (!c.ok) return res.status(503).json({ ok: false, error: 'r2_off' });
  const job = await readJob(deps, jid);
  if (!job || job.kind !== 'tr' || !SR.inFolder(id, job.folder)) return res.status(404).json({ ok: false, error: 'not_found' });
  const rec = await upRec(deps, id);
  if (!rec || rec.f !== job.folder || rec.uid !== job.uid) return res.status(404).json({ ok: false, error: 'not_found' });
  const out = await SR.bgDone(c, r2deps(deps), { id, rec, up: String(body.up || ''), fk: String(body.fk || '') });
  if (out.rec) await patchDoc(deps, 'studioUp', id, Object.assign({}, out.rec, { f: job.folder }));
  if (!out.res.ok) return res.status(out.res.error === 'forbidden' ? 403 : 200).json({ ok: false, error: out.res.error, missing: out.res.missing });
  const st = S.effState(job, now).state;
  if (job.fv && job.fv.id === id) return res.status(200).json({ ok: true });
  if (!['new', 'queued', 'running', 'failed'].includes(st)) return res.status(200).json({ ok: true, reg: 'state' });
  const rg = await r2Register(deps, job, 'v', id, now);
  return res.status(200).json(rg.error ? { ok: true, reg: rg.error } : { ok: true });
}

/* מחיקת עבודה: הקבצים ב־R2 נמחקים כשאף עבודה אחרת לא משתמשת בתיקייה (עבודות משנה וסט הזהב יורשים אותה) */
async function r2Purge(deps, uid, job) {
  if (!SR.isFolder(job.folder) || !R2.config().ok) return;
  try {
    if ((await listJobs(deps, uid)).some((j) => j.id !== job.id && j.folder === job.folder)) return;
    const recs = await query(deps, 'studioUp', { f: job.folder }, 500).catch(() => []);
    await SR.purgeFolder(R2.config(), r2deps(deps), { uid, folder: job.folder, recs });
    for (const r of recs) await delDoc(deps, 'studioUp', r.id).catch(() => null);
  } catch (e) {}
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
  await learnSave(deps, job, now);   // 14/10/2026: הרשומה במאגר הלמידה נשארת אחרי המחיקה
  await delDoc(deps, 'studioJobs', job.id);
  await r2Purge(deps, uid, job);   // ת4
  const gone = [job.id];
  if (job.kind === 'tr' && Array.isArray(job.fo) && job.fo.length) {   // מ2 · מ7: ההפקות מחדש, גיליונות ה־AI והשמירות ל־Drive (dx) של העבודה הולכים איתה
    const sub = job.fo.some((o) => o && o.k === 'cues') ? ['rr', 'ai', 'dx'] : ['dx'];
    for (const r of (await listJobs(deps, uid)).filter((j) => sub.includes(j.kind) && j.rp === job.id)) { await delDoc(deps, 'studioJobs', r.id); gone.push(r.id); }
  }
  await learnGone(deps, uid, gone, now);   // 15/10 (מ׳1): כדי ש"מחק את התרומות שלי" ימצא גם אותן
  await closeJobOps(deps, uid, job.id, now);
  try {   // v371 · v379: התקלה נסגרת, עם מה שעלה בטעות (לדוח)
    const d = await readDoc(deps, 'studioOps', uid);
    const inc = d && I.incCloseJob(d.inc, job.id, now, d.al, PIR.wastedUsd(job, S.effState(job, now).state));
    if (inc) await patchDoc(deps, 'studioOps', uid, { inc, updated: now });
  } catch (e) {}
}
/* מה אפשר לנקות עכשיו — תמיד סריקה טרייה (לא רשימה שמורה). תיקייה של עבודה שקיימת אצל משתמש אחר (אותו Drive בשני חשבונות) — לא נוגעים */
async function cleanTargets(deps, uid, token, jobs, now) {
  const orphans = [];
  let dupes = [];
  if (token) {   // ת4: בלי Drive — רק R2
    const folders = await studioFolders(deps, token);
    const ids = jobs.map((j) => j.id);
    for (const f of SC.orphanFolders(folders, ids).slice(0, SC.MAX_FOLDERS)) {
      const other = await readJob(deps, f.job).catch(() => null);
      if (!other) orphans.push(f);
    }
    dupes = SC.dupeFolders(folders, jobs).slice(0, SC.MAX_FOLDERS);
  }
  return { orphans: orphans.concat(await r2OrphanTargets(deps, uid, jobs, now)), dupes, ck: SC.doneCheckpoints(jobs), old: SC.oldJobs(jobs, now) };
}
/* ת4: תיקיות ב־R2 שהעבודה שלהן נמחקה (מחיקה שנכשלה באמצע, או עבודה שנמחקה לפני ש־R2 נמחק). רק בתחילית של המשתמש —
   המילון (gl/) וספריית המכתבים (lib/) לא בתוכה. עבודה שעוד קיימת (גם אם לא ברשימה) — לא נוגעים */
async function r2OrphanTargets(deps, uid, jobs, now) {
  if (!R2.config().ok) return [];
  const items = await R2.list(R2.config(), r2deps(deps), 'st/' + uid + '/', 20000);
  const out = [];
  for (const x of SC.r2Orphans(SC.r2Folders(items, uid), jobs, now).slice(0, SC.MAX_FOLDERS)) {
    const other = await readJob(deps, x.job).catch(() => null);
    if (!other) out.push({ r2: x.f, job: x.job, b: x.b });
  }
  return out;
}
/* ניקוי תיקייה יתומה: ב־R2 נמחקת (אין פח), ב־Drive — לפח */
async function trashTarget(deps, uid, token, x) {
  if (x.r2) {
    const recs = await query(deps, 'studioUp', { f: x.r2 }, 500).catch(() => []);
    await SR.purgeFolder(R2.config(), r2deps(deps), { uid, folder: x.r2, recs });
    for (const r of recs) await delDoc(deps, 'studioUp', r.id).catch(() => null);
  } else await driveTrash(deps, token, x.id);
}

/* ---------- העובד בענן ---------- */
async function worker(req, res, body, deps) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
  let len = 0; try { len = JSON.stringify(body).length; } catch (e) { len = 1e9; }
  if (len > (body.op === 'learnPut' ? LC_MAX_BODY : 16384)) return res.status(413).json({ ok: false, error: 'too_large' });
  const id = String(body.job || ''), key = String(body.key || '');
  if (!S.JOB_RE.test(id) || !S.KEY_RE.test(key)) return res.status(400).json({ ok: false, error: 'bad_params' });
  if (limited('w|' + id, 90)) return res.status(429).json({ ok: false, error: 'rate_limited' });
  const now = deps.now || Date.now();
  try {
    const job = await readJob(deps, id);
    if (body.op === 'claim' && job && relayJob(job) && S.keyMatches(job, key, 'rkh') && now <= (job.rkx || 0)) {
      // 24/10/2026: ה־Routine של "המנוי שלי" — רק Claude. מקבל את כתובת התור, וזהו (בלי קבצים, בלי דיווח)
      const e0 = S.effState(job, now);
      if (S.FINAL.includes(e0.state)) return res.status(200).json({ ok: false, stop: true, state: e0.state });
      if (!job.rcl) await patchJob(deps, id, { rcl: now, warn: '' }).catch(() => {});
      return res.status(200).json({ ok: true, relay: true, hub: RELAY_HUB(), job: { id, kind: job.kind }, now });
    }
    if (!job || !S.keyMatches(job, key) || now > (job.kx || 0)) return res.status(403).json({ ok: false, error: 'bad_key', stop: true });
    const e = S.effState(job, now);
    if (S.FINAL.includes(e.state)) return res.status(200).json({ ok: false, stop: true, state: e.state });
    const driveFor = async () => {
      const t = await gdrive.accessToken(deps, job.uid).catch(() => ({ ok: false, error: 'gd_failed' }));
      if (job.kind === 'tr' && (t.ok || !SR.isFolder(job.folder))) await raise(deps, job.uid, [{ c: 'drive', k: 'auth', ok: !!t.ok }], id, now);   // v365 · ת4: עבודה ב־R2 לא צריכה את Drive — בלי התראה
      return t.ok ? { token: t.token, exp: t.exp } : { error: t.error };
    };
    if (body.op === 'claim') {
      const patch = { updated: now };
      if (job.state === 'queued') { patch.state = 'running'; patch.claimed = now; patch.warn = ''; job.state = 'running'; }
      const stats = job.kind === 'tr' ? await readStats(deps, job.uid) : {};
      const nm = job.kind === 'tr' && job.spec ? S.learnedNorm(stats.ns, job.spec.mode, job.eng) : null;   // 11/10: לפי המנוע
      // v384: מצב צל — בלקיחה הראשונה בלבד (בהמשך — אותו מצב צל של העבודה). תקלה כאן לא מפילה את הלקיחה
      if (job.kind === 'tr' && job.spec && !job.c0 && job.eng !== 'api') {   // 11/10: מצב הצל = ספי המגדל, שרץ רק ב־Routine
        const m = job.spec.mode, th = Object.assign({}, stats.thr || {});
        const step = S.thStep(th[m], nm);
        th[m] = step.next;
        if (step.sh) { patch.sh = step.sh; job.sh = step.sh; }
        await patchDoc(deps, 'studioStats', job.uid, { thr: th, updated: now }).catch(() => {});
      }
      // v377: יעדי השירות — נקבעים פעם אחת, בלקיחה הראשונה (ההערכה שראית בהתחלה + "הרגיל" שלך עכשיו). השעון מתחיל כאן
      if (!job.c0) patch.c0 = now;
      if (job.kind === 'tr' && !job.c0 && S.dualAb(job, now)) patch.xd = 1;   // 28/10/2026: טיוטה אחת (הניסוי הסתיים — לכל עבודה)
      if (job.kind === 'tr' && !job.c0 && S.rvAb(job, now)) patch.xr = 1;   // 28/10/2026: ניסוי "ביקורת ב־medium"
      // 10/10/2026: התוכנית (p50 לכל שלב + אי־ודאות) מהמודל הנלמד; יעד הזמן = p90 + דקה ("חרגה" רק כשבאמת חריג)
      let ep = job.ep;
      if (job.kind === 'tr' && !ep && job.spec && job.spec.dur > 0) {
        const ge = job.eng === 'api' ? ((await readDoc(deps, 'studioEta', 'a').catch(() => null)) || {}).et : null;
        ep = ETA.etaPlan(ETA.etaModel(ETA.etSamplesFor(stats.et, ge, job.eng === 'api' ? 'a' : 'r'), job.eng === 'api' ? 'a' : 'r', now), job.spec.mode, job.spec.dur, ETA.jobFactors(job));
        if (job.spec.src === 'subs') ep = ETA.subsPlan(ep);   // 22/10/2026: קובץ כתוביות — בלי תמלול, יישור וצריבה
        if (job.spec.ka === 1) ep = ETA.kaPlan(ep, job.spec.dur);   // 26/10/2026: קריוקי — הפרדה, יישור וצריבה, בלי תרגום
        patch.ep = ep;
      }
      if (job.kind === 'tr' && !job.tg) {
        const tg = L.targets(job.spec, nm ? nm.ph : S.normDef(job.spec && job.spec.mode, job.eng), S.normFixed(job.eng));
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
      // 11/10: מילון המונחים מ־R2 (כשקיים שם) — בתוך תשובת הלקיחה, גם ל־Routine (שהסביבה שלו לא מגיעה ל־R2). תקלה = בלי (Drive כמו קודם)
      let gl = null;
      if (job.kind === 'tr' && R2.config().ok) {
        try { const t = await R2.getText(R2.config(), r2deps(deps), S.glKey(job.uid), 256 * 1024); if (t != null) gl = S.glParse(t); } catch (e) { gl = null; }
      }
      const full = (await learnFull(deps, job, stats)) ? 1 : 0;   // האיסוף המלא: העובד שולח גם את קבצי הטקסט ואת יומן הקריאות
      const wj = S.workerJob(job, nm, S.fbForWorker(stats.fb), stats.fm, stats.rl, gl);
      if (job.kind === 'tr') { const sm = await smRead(deps, job); if (sm) wj.sm = sm; }   // 28/10/2026: זיכרון הסדרה (או בלי)
      if (job.xd === 1 || patch.xd === 1) wj.xd = 1;   // 28/10/2026: ניסוי "טיוטה אחת" — העובד בלי הטיוטה השנייה
      if (job.xr === 1 || patch.xr === 1) wj.xr = 1;   // 28/10/2026: ניסוי "ביקורת ב־medium" — העובד מוריד את מאמץ הביקורת
      if (hubJob(job)) wj.rh = RELAY_HUB();   // 24/10/2026: Claude דרך התור — לאן לשלוח (25/10: גם בתרגום בטלפון — השרת עונה)
      return res.status(200).json({ ok: true, job: wj, drive: await driveFor(), pir, full, now });
    }
    if (body.op === 'token') {
      // 26/10/2026: src — הגישה של רשימת הקבצים, רק לעבודה במצב השרת שהמקור שלה נבחר שם (העובד ב־Routine לא מקבל אותה)
      if (body.src === true) {
        if (!(job.fv && job.fv.bx && S.bxOk(job))) return res.status(200).json({ ok: true, src: { error: 'bx_engine' }, now });
        const t = await gbrowse.accessToken(deps, job.uid).catch(() => ({ ok: false, error: 'gd_failed' }));
        return res.status(200).json({ ok: true, src: t.ok ? { token: t.token, exp: t.exp } : { error: t.error }, now });
      }
      return res.status(200).json({ ok: true, drive: await driveFor(), now });
    }
    if (body.op === 'smPut') return res.status(200).json({ ok: true, saved: await smPut(deps, job, body.sm, now), now });   // 28/10/2026: זיכרון הסדרה
    if (body.op === 'learnPut') return res.status(200).json({ ok: true, saved: await learnPut(deps, job, body.lc, now), now });   // מ׳2
    if (body.op === 'learnMedia') return res.status(200).json(Object.assign({ ok: true, now }, (await learnMedia(deps, job, String(body.k || ''), now)) || { skip: true }));   // מ׳4
    if (body.op === 'learnMediaDone') return res.status(200).json({ ok: true, saved: await learnMediaDone(deps, job, String(body.k || '')), now });
    if (body.op === 'srcFile') {
      // 22/10/2026: הורדה מקישור — העובד הוריד את הקול / הסרטון והעלה לתיקייה של העבודה ב־R2. רושמים כאילו הטלפון העלה
      // (fa/fv), כך שכל השאר — המשך, הנגן, איכויות הצפייה — לא יודע שהמקור היה קישור
      const which = body.which === 'v' ? 'v' : body.which === 'a' ? 'a' : '';
      const fid = String(body.id || '');
      if (!which || job.kind !== 'tr' || !(job.spec && job.spec.src === 'url') || !SR.isFolder(job.folder) || !S.FILE_ID_RE.test(fid)) return res.status(400).json({ ok: false, error: 'bad_params' });
      const m = await driveFileInFolder(deps, job.uid, job.folder, fid);
      if (m && m.error) return res.status(200).json({ ok: false, error: m.error });
      const f = m && S.normFile({ id: fid, name: m.name || (which === 'v' ? 'video' : 'audio'), size: m.size, mimeType: m.mime });
      if (!f) return res.status(400).json({ ok: false, error: 'file_bad' });
      f.at = now;
      const patch = { ['f' + which]: f, updated: now };
      if (which === 'v') patch.spec = Object.assign({}, job.spec, { size: f.size });   // הגודל האמיתי במקום האומדן מהבדיקה
      await patchJob(deps, job.id, patch);
      return res.status(200).json({ ok: true, now });
    }
    if (body.op.startsWith('r2')) {   // ת4: הקבצים של העבודה ב־R2 (קלט, תוצרים, נקודות שמירה)
      const op = { r2get: 'url', r2wup: 'up', r2wparts: 'parts', r2wdone: 'done', r2del: 'del' }[body.op];
      const [code, out] = await r2Files(deps, op, body, job.uid, job.folder, 'worker');
      return res.status(code).json(Object.assign({ now }, out));
    }
    if (body.op === 'qa') return res.status(200).json({ ok: true, qa: job.qa && job.qa.id ? { id: job.qa.id, g: job.qa.g || '', a: job.qa.a || null } : null, bx: job.bx || 0, cp: S.cpWorker(job.cp), sty: S.normSty(job.spec && job.spec.sty), now });   // 26/10/2026: sty = העיצוב שנבחר עכשיו (op sty)   // סבב 10: גם העתק־הדבק (קריאה בלבד)
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
      if (!job.rdy) up.fo = outs;   // 28/10/2026: אחרי rd התוצרים כבר אצלך (אולי ערכת כתוביות) — הדיווח הסופי לא דורס אותם
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
      // 22/10/2026: עותק הקול לנגן (Opus) — מאומת כמו האיכויות; לא תקין — האיכויות נשמרות בלעדיו (טלפון בלי מפענח לקול
      // המקורי ינגן בלי קול, כמו לפני כן)
      let hla = good && body.hla != null ? S.normHla(body.hla) : null;
      if (hla && hla.some((a) => hl.some((x) => x.id === a.id))) hla = null;
      for (const a of hla || []) { const m = await driveFileInFolder(deps, job.uid, job.folder, a.id); if (!m || m.error || m.size !== a.size) { hla = null; break; } }
      if (good) { up.hl = hl; up.fv = Object.assign({}, job.fv, { size: vs }); if (hla) up.hla = hla; }
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
    if (body.cpq != null) {
      // סבב 10: העתק־הדבק — בקשה חדשה ל־Claude של המשתמש. הקובץ בתיקיית העבודה; המספר עולה (לא מחליפים בקשה בלי תשובה בשקט)
      const q = S.normCpq(body.cpq);
      if (!q || !job.folder || !(job.spec && job.spec.cp === 1)) return res.status(400).json({ ok: false, error: 'cp_bad' });
      if (job.cp && job.cp.n >= q.n) return res.status(409).json({ ok: false, error: 'cp_seq' });
      const m = await driveFileInFolder(deps, job.uid, job.folder, q.id);
      if (m && m.error) return res.status(200).json({ ok: false, error: m.error });
      if (!m || !(m.size > 0 && m.size <= S.CP_FILE_MAX)) return res.status(400).json({ ok: false, error: 'cp_bad' });
      up.cp = { n: q.n, r: q.r, f: q.id, fs: Math.floor(m.size), at: now, a: '', as: 0 };
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
    if (body.askUsed != null && job.qa && job.qa.nb === 1 && body.askUsed && String(body.askUsed.id) === job.qa.id) {
      // 20/10/2026: לפי איזו תשובה התרגום נעשה (מספר, ‎-1 = שיקול דעת, ‎-2 = התשובה הפתוחה) — הטלפון מציע תיקון כשענית אחרת
      const u = Number(body.askUsed.u);
      if (Number.isInteger(u) && u >= -2 && u < job.qa.o.length) up.qa = Object.assign({}, up.qa || job.qa, { u });
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
    if (body.gq != null && (job.gs || S.normGd(job.gd))) { const gq = S.normGq(Object.assign({}, body.gq, { at: now })); if (gq) up.gq = gq; }   // פריט 15: הציון מול הייחוס — מהעובד
    if (body.gl != null) { const gl = S.normGl(body.gl); if (gl) up.gl = gl; }            // v380: זיכרון המונחים
    if (body.rvf != null) { const v = S.normRvf(body.rvf); if (v) up.rvf = v; }          // סבב 4: סימונים מהביקורת
    if (body.fil != null) { const v = S.normFil(body.fil); if (v) up.fil = v; }          // סבב 4: מילות מילוי
    if (body.lx != null) { const lx = LR.normLx(body.lx); if (lx) up.lx = lx; }   // 14/10/2026: עובדות למאגר הלמידה (מספרים וקודים בלבד)
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
    let parked = false;
    if (body.park === true) {
      // 15/10/2026: הסרטון לא הגיע — העבודה חוזרת לתור עד שיגיע, והשרת פנוי. המפתח מת (kh), מה ששולם עובר ל־use0
      if (!S.parkable(job)) return res.status(409).json({ ok: false, error: 'park_bad' });
      Object.assign(up, { state: 'queued', sid: '', pk: 0, kh: '', kx: 0, vw: now, wv0: job.wv0 || now });
      delete up.ended; delete up.err;
      parked = true;
    }
    if (job.state === 'queued') { up.state = up.state || 'running'; up.claimed = now; up.warn = ''; if (!job.c0) up.c0 = now; }
    // v377: מחכים לסרטון מהטלפון (wv) — השעון של יעד הזמן עוצר; דיווח התקדמות הבא בלי wv ממשיך אותו (אירוע בודד — לא)
    // 21/10/2026: העובד גילה את המידות והקצב האמיתיים (אחרי הקליטה) — שלב הצריבה בתוכנית מחושב מחדש, פעם אחת
    if (job.kind === 'tr' && !job.pxm && Number.isFinite(+body.px) && +body.px >= 0.02 && +body.px <= 16) {
      up.pxm = Math.round(+body.px * 1000);   // שלם (toFields מעגל מספרים) — px × 1000
      const ep2 = job.ep && ETA.replanPx(job.ep, job.spec && job.spec.dur, up.pxm / 1000);
      if (ep2) {
        up.ep = ep2;
        if (job.tg && job.tg.t) up.tg = Object.assign({}, job.tg, { t: ETA.etaTarget(ep2) });   // היעד נקבע על מידות משוערות
      }
    }
    if (body.wv === true && job.kind === 'tr') { if (!job.wv0) up.wv0 = now; }
    else if (job.wv0 && (body.st || body.done === true || body.fail === true)) {
      up.pz = (up.pz != null ? up.pz : job.pz || 0) + Math.max(0, now - job.wv0); up.wv0 = 0;
      // 21/10/2026: גם השלב שבו חיכינו לא סופר את ההמתנה (עד היום — 39 דק׳ "ביישור" אחרי חזרה לתור, והצפי ‎"עוד 3:09 ש׳")
      const ws = job.prog && job.prog.st;
      if (ws && up.prog) up.prog = S.excludeWait(up.prog, ws, job.wv0, now);
    }
    // Firestore שומר כאן מספרים שלמים — לכן סנטים (mucc), לא דולרים
    // 24/10/2026: עבודת "המנוי שלי" (relayJob) — לא מהתקציב החודשי של המערכת
    if (ptJob(job)) delete up.use;   // 25/10/2026: תרגום בטלפון — השימוש נרשם בשרתון מכל תשובה (ptMark), לא ממה שהטלפון מדווח
    const spent = job.eng === 'api' && !relayJob(job) && !ptJob(job) && up.use ? S.usdOf(up.use) - (job.mucc || 0) / 100 : 0;
    if (spent > 0) up.mucc = Math.round(S.usdOf(up.use) * 100);
    // 29/10/2026: ניטור משתמשים — גם הטוקנים (mtk = כמה כבר נספרו, כמו mucc)
    const tkn = spent > 0 ? Math.max(0, UM.tokOf(up.use) - (job.mtk || 0)) : 0;
    if (tkn > 0) up.mtk = UM.tokOf(up.use);
    if (parked && up.use) { up.use0 = up.use; up.use = null; }   // הסשן הבא מדווח מאפס — הסכום שלו מצטרף ל־use0 (כמו ב"המשך")
    if (job.kind === 'tr' && up.state === 'failed' && (job.ar || 0) < S.AUTO_RESUME_MAX) {
      // v368: תקלה חולפת (Drive / רשת) — חלון התאוששות, ואז "המשך" אוטומטי אחד
      let kinds = [];
      try { kinds = O.opsView(((await readDoc(deps, 'studioOps', job.uid)) || {}).al, now).open.filter((a) => a.j === id).map((a) => a.c + ':' + a.k); } catch (e) {}
      if (S.isTransient(up.err, kinds.concat(O.normEvents(body.ev).filter((e) => !e.ok).map((e) => e.c + ':' + e.k)))) up.rw = now + S.recoverWait(job, now);
    }
    if (up.state === 'failed' && job.kind === 'tr') {
      // 14/10/2026: היסטוריית הכשלים של העבודה — גם עבודה שהצליחה אחרי "המשך" מלמדת על מה שנכשל בדרך (למאגר הלמידה)
      // 20/10/2026: קריסה — גם איפה בקוד (w, צורה קשיחה בלבד), כדי שאפשר יהיה לאבחן בלי מסוף
      const w = up.err === 'worker_crash' ? S.crashWhere(body.msg) : '';
      up.eh = (Array.isArray(job.eh) ? job.eh : []).concat([Object.assign({ e: up.err, s: (up.prog && up.prog.st) || '', at: now }, w ? { w } : {})]).slice(-10);
    }
    await patchJob(deps, id, up);
    if (up.state === 'done' || up.state === 'failed') await learnSave(deps, Object.assign({}, job, up), now);
    if (spent > 0) await monthSpend(deps, job.uid, spent, now);   // מצב API: העלות נספרת בתקציב החודשי של המשתמש
    // 29/10/2026: הסכומים של המשתמש מאז ומעולם (מרכז הניהול ← משתמשים)
    const fin = job.kind === 'tr' && up.state === 'done' && job.state !== 'done';
    if (spent > 0 || fin) await totalAdd(deps, job.uid, { usd: spent, tok: tkn, n: fin ? 1 : 0, ok: fin ? 1 : 0, sec: fin ? (job.spec && job.spec.dur) || 0 : 0 }, now).catch(() => {});
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
      const kind = (up.state === 'done' && !job.rdy) || up.rdy ? 'done' : up.state === 'failed' && !up.rw ? 'fail' : gateId ? 'gate' : body.ask != null && up.qa ? 'ask' : up.cp ? 'cp' : '';
      if (kind) await notify(deps, job.uid, kind, id, now);
      if (kind === 'done' || kind === 'fail') await watchEnd(deps, Object.assign({ id }, job, up), kind === 'done', now).catch(() => 0);   // 29/10/2026: למנהל
      // 27/10/2026 (בקשת המשתמש): כל שלב בווילון ההתראות — אותה התראה מתחלפת (שלב חדש / כל 10%), שקטה. נגיעה = העבודה
      // 27/10/2026: האחוז = ההערכה של הטלפון (PG.stageNow), לא רק מה שהעובד דיווח; בין הדיווחים — op:'pulse' מהעובד (shadePush)
      else if ((!up.state || up.state === 'running') && up.prog && !parked && !job.rdy) {
        const nx = Object.assign({ id }, job, up);
        shadeJob(nx, now);
        const x = PG.stageNow(nx, now) || (up.prog.st ? { st: up.prog.st, p: up.prog.p || 0 } : null);
        await shadePush(deps, nx, x, now);
      }
      if ((up.state && up.state !== 'running') || up.rdy) { SHADE_JOB.delete(id); SHADE_PN.delete(id); }
    }
    if (job.kind === 'tr' && up.state === 'done' && !(job.spec && job.spec.src === 'subs')) {
      // v363: עבודה שהסתיימה מלמדת את המגדל מה "רגיל" אצלך. תקלה כאן לא מפילה את סוף העבודה
      // 22/10/2026: קובץ כתוביות (בלי תמלול ויישור) לא מלמד את הצפי ואת "הרגיל" של עבודות מסרטון — שלבים וזמנים אחרים
      const smp = S.normSample(job, up.use || job.use, now);
      // 10/10/2026: וגם כמה לקח כל שלב — מזה נלמד הצפי (studioeta.js)
      const es = job.spec && (job.spec.xe || job.spec.xg) ? null : ETA.etaSample(Object.assign({}, job, up), now);   // 24/10/2026: ניסוי המאמץ לא מלמד את הצפי
      if (smp || es) {
        const st0 = await readStats(deps, job.uid);
        const patchS = { updated: now };
        if (smp) patchS.ns = S.addSample(Array.isArray(st0.ns) ? st0.ns : [], smp);
        if (es) patchS.et = ETA.addEtSample(st0.et, es);
        await patchDoc(deps, 'studioStats', job.uid, patchS).catch(() => {});
        if (es && es.e === 'a') {
          // 20/10/2026: המאגר המשותף של השרת (studioEta/a) — כל העבודות בשרת מלמדות את הצפי של כולם
          const g = await readDoc(deps, 'studioEta', 'a').catch(() => null);
          await patchDoc(deps, 'studioEta', 'a', { et: ETA.addEtSample(g && g.et, es, ETA.ET_G_MAX), updated: now }).catch(() => {});
        }
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
  if (RELAY_OPS.has(String(body.op || ''))) return relayOp(req, res, body, deps);
  if (WORKER_OPS.has(String(body.op || ''))) return worker(req, res, body, deps);
  if (SERVER_OPS.has(String(body.op || ''))) return server(req, res, body, deps);
  if (PHONE_OPS.has(String(body.op || ''))) return phoneOp(req, res, body, deps);
  if (body.op === 'learnPull') return learnPull(req, res, body, deps);   // 14/10/2026: טוקן ניתוח (Claude Code)
  if (body.op === 'devPull') return devPull(req, res, body, deps);   // 15/10/2026: האיסוף המלא — לוגים, קריאות, מדדים, שגיאות (קריאה בלבד)
  if (body.op === 'dmPull') return dmPull(req, res, body, deps);   // שלב ג׳: יומני DM לניתוח (טוקן הניתוח, קריאה בלבד)
  if (body.op === 'dmLog' || body.op === 'dmForget') return dmOps(req, res, body, deps);   // 24/10/2026: Studio DM — אפליקציה נייטיב, בלי Origin
  if (body.op === 'brKey') return brKey(req, res, body, deps);   // 27/10/2026: Studio Browser — מפתח ההצפנה של הסנכרון בין המכשירים
  // 25/10/2026: adminYt = קובץ cookies.txt (קובץ אמיתי 5–30KB) — עד 64KB; כל השאר 4KB כמו תמיד
  if (guard(req, res, body.op === 'adminYt' ? 65536 : body.op === 'create' && body.spec && body.spec.ka === 1 ? 20000 : 4096)) return;   // 26/10/2026: קריוקי — המילים בטופס
  if (body.op === 'cfg') {   // 15/10/2026: מצב התחזוקה והדגלים — לשלוש האפליקציות, בלי התחברות (רק מה שציבורי)
    if (limited('cfg|' + String(((req.socket || {}).remoteAddress) || ''), 30)) return res.status(429).json({ ok: false, error: 'rate_limited' });
    const now = deps.now || Date.now();
    return res.status(200).json({ ok: true, cfg: SF.publicCfg(await sysCfg(deps, now), now), now });
  }
  if (body.op === 'r2bgDone') return r2BgDone(req, res, body, deps);   // 23/10/2026: Background Fetch — מפתח הסיום במקום התחברות
  if (body.op === 'gbConfig' && gbRemote()) return res.status(421).json({ ok: false, error: 'gb_remote' });
  if (body.op === 'gbConfig') return res.status(200).json({ ok: true, clientId: gbrowse.cfg().id, configured: gbrowse.configured() });   // 26/10/2026: הלקוח של רשימת הקבצים
  if (body.op === 'gdConfig') return res.status(200).json({ ok: true, clientId: gdrive.cfg().id, configured: gdrive.configured(), picker: !!S.pickerCfg(process.env, gdrive.cfg().id) });   // המזהה ציבורי · picker = האם מפתח ה־Picker נטען (רק כן/לא — לאבחון בלי התחברות)
  let user;
  const monTok = String((req.headers || {})['x-mon-token'] || '');
  if (body.op === 'adminMon' && monTok) {
    // 22/10/2026: הווידג׳ט באנדרואיד — טוקן קריאה בלבד (sysCfg/main.monKh, רק hash), בלי התחברות. מותר רק ל־adminMon
    // 26/10/2026: Firestore שלא ענה (מכסה, 429) = 503 — לא 401: הווידג׳ט הציג "הטוקן לא תקף — לחבר מחדש" על טוקן תקין
    // 26/10/2026: הווידג׳ט מתרענן כל דקה — ה־hash של הטוקן בזיכרון MON_CFG_MS (יצירה/ביטול באותו מופע מנקים מיד)
    let cfg;
    try { cfg = await monCfg(deps, deps.now || Date.now()); } catch (e) { return res.status(503).json({ ok: false, error: 'store' }); }
    if (!MON.monTokOk(monTok, cfg && cfg.monKh)) return res.status(401).json({ ok: false, error: 'no_auth' });
    user = { mon: true, uid: '' };
  } else {
    try { user = await verifyIdToken(body.idToken, deps.verify || {}); } catch (e) { return res.status(401).json({ ok: false, error: 'no_auth' }); }
  }
  if (user.mon !== true && !UID_RE.test(String(user.uid || ''))) return res.status(401).json({ ok: false, error: 'no_auth' });   // 22/10/2026: טוקן הניטור (mon) בלי uid — רק ל־adminMon (נאכף בבלוק)
  if (body.op === 'fbSend') {   // 15/10/2026: משוב מההגדרות של כל אפליקציה — כל משתמש מחובר (לא רק של Studio)
    if (limited('fb|' + user.uid, 3)) return res.status(429).json({ ok: false, error: 'rate_limited' });
    const now = deps.now || Date.now();
    const e = AO.fbEntry(body, user, now);
    if (!e) return res.status(400).json({ ok: false, error: 'bad_params' });
    try { await patchDoc(deps, 'sysFeedback', now.toString(36) + crypto.randomBytes(3).toString('hex'), e); } catch (err) { return res.status(503).json({ ok: false, error: 'store' }); }
    return res.status(200).json({ ok: true });
  }
  // 15/10/2026: מי שברשימת "כל המודלים" במרכז הניהול מקבל גם את הסטודיו (בלי לחכות לפתיחה לכולם / ל־STUDIO_USERS)
  // 22/10/2026: טוקן הניטור (mon) עובר רק ל־adminMon (נאכף למעלה) — בלי זהות אין רשימת הרשאות לבדוק
  // 25/10/2026: חשבונות הבדיקה (sysCfg.tsEm, מרכז הניהול) — גישה כמו משתמש רגיל, בלי המצבים הנעולים ובלי המגדל המורחב
  if (user.mon !== true && !allowed(user)) {
    const sc = await sysCfg(deps, deps.now || Date.now());
    if (!SF.amHas(sc, user) && !SF.tsHas(sc, user)) return res.status(403).json({ ok: false, error: 'not_allowed' });
  }
  if (limited('p|' + user.uid, 120)) return res.status(429).json({ ok: false, error: 'rate_limited' });
  if (body.op === 'devErr') return res.status(200).json({ ok: true, saved: await devErr(deps, user, body, deps.now || Date.now()) });   // שגיאות מהטלפון (האיסוף המלא)
  if (!vault.configured()) return res.status(503).json({ ok: false, error: 'vault_not_configured' });
  const uid = user.uid, op = String(body.op || ''), now = deps.now || Date.now();
  await seenUser(deps, user, now).catch(() => {});   // 29/10/2026: ניטור משתמשים — השם, המייל ו"נראה לאחרונה"
  // 15/10/2026: מצבי התרגום — לכולם רק PUBLIC_MODES ("רגיל" / "ביצועים"); המנהל ומי שברשימת "כל המודלים" — הכל
  const fullModes = async () => isAdmin(user) || SF.amHas(await sysCfg(deps, now), user);
  const modeLocked = async (m) => !S.modeOk(S.modeNow(m), await fullModes());
  // 25/10/2026 (בקשת המשתמש): למשתמשים רק השרת של המערכת — בלי Routine (גם לא ry) ובלי העתק־הדבק
  const engLocked = async (spec) => !S.engOk(spec, await fullModes());
  // 25/10/2026 (בקשת המשתמש): הורדה מקישור — גם לחשבונות הבדיקה (sysCfg.tsEm), לא רק למנהל ול"כל המודלים"
  const urlAllowed = async () => (await fullModes()) || SF.tsHas(await sysCfg(deps, now), user);
  if ((op === 'status' || op === 'jobs') && watchDue(now)) await checkServers(deps, now, uid).catch(() => 0);
  if (op === 'status' && isAdmin(user)) await offsiteOwner(deps, uid).catch(() => {});   // 11/10/2026: בעל הגיבוי ב־Drive
  // v357: חיבור Drive של הסטודיו (חלון ההסכמה של Google — אותו מנגנון של גיבוי הספרייה, לקוח אחר)
  if (op === 'gdConnect' || op === 'gdStatus' || op === 'gdToken' || op === 'gdDisconnect') return gdrive.handle(body, user, res, deps);
  if (/^gb[A-Z]/.test(op) && gbRemote()) return res.status(421).json({ ok: false, error: 'gb_remote' });
  if (op === 'gbConnect' || op === 'gbStatus' || op === 'gbToken' || op === 'gbDisconnect') return gbrowse.handle(body, user, res, deps);   // 26/10/2026
  const mine = async (id) => {
    if (!S.JOB_RE.test(String(id || ''))) return null;
    const j = await readJob(deps, id);
    return j && j.uid === uid ? j : null;
  };
  const view = (j) => Object.assign(S.publicJob(j, now), updWaiting(j, now) ? { uw: 1 } : {});
  // מצב API: התקציב החודשי, השרתים (למנהל — הכל; לאחרים — רק אם יש שרת פעיל)
  const servers = async () => (await query(deps, 'studioServers', null, S.SRV_MAX + 5)).map((x) => S.serverView(x, now)).filter(Boolean)
    .sort((a, b) => a.created - b.created);
  const apiView = async (st) => {
    const list = await servers().catch(() => []);
    return { month: S.monthUsed(st.mu, now), cap: userMonth(st), online: list.filter((x) => x.online && !x.paused).length, servers: list.length,
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
    if (isAdmin(user)) {   // 11/10/2026: הגיבוי אצל ספק שני — רק למנהל (בעל הגיבוי)
      const ob = await readDoc(deps, 'sysBackup', 'cfg').catch(() => null);
      f.offsite = ob && ob.uid === uid ? { day: String(ob.day || ''), err: String(ob.err || '') } : { day: '', err: 'owner' };
    }
    // התקציב לעבודה מול עבודה רגילה של שעה במצב ברירת המחדל (או במקסימום שבחרת, אם הוא זול יותר)
    const rl = S.normRules(st.rl);
    if (rl.b > 0) {
      const m = rl.mx && S.NORM_DEF[rl.mx] < S.NORM_DEF['opus-medium'] ? rl.mx : 'opus-medium';
      f.budget = { b: rl.b, need: S.normsView(st.ns, 'r')[m].ph + S.NORM_FIXED };   // התקציב לעבודה = חוק של ה־Routine (בשרת — התקרה החודשית)
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
            for (const x of tg[k]) b += x.r2 ? x.b : await folderBytes(deps, t.token, x.id);
            f.clean[k] = { n: tg[k].length, b };
          }
        } catch (e) { f.drive.err = 'gd_http'; }
      }
    }
    if (!f.clean.orphans && R2.config().ok) {   // ת4: Drive לא מחובר — התיקיות ב־R2 עדיין נבדקות
      try {
        const r2o = await r2OrphanTargets(deps, uid, jobs, now);
        f.clean.orphans = { n: r2o.length, b: r2o.reduce((a, x) => a + x.b, 0) };
      } catch (e) {}
    }
    const sc = SC.scanFindings(f, now);
    await patchDoc(deps, 'studioOps', uid, { sc, updated: now }).catch(() => {});
    return SC.scanView(sc);
  };
  try {
    if ((LEARN_REMOTE_OPS.has(op) || (op === 'cuesSave' && body.pt)) && learnRemote()) return res.status(421).json({ ok: false, error: 'learn_remote' });
    if (op === 'learnImpact') {
      // 21/10/2026: השפעת המאגר בטווח מותאם (from/to, ms) — רק למנהל; הטווחים המוכנים כבר ב־learn (view.im)
      if (!isAdmin(user)) return res.status(403).json({ ok: false, error: 'not_admin' });
      const from = Math.floor(+body.from), to = Math.floor(+body.to);
      if (!(from > 0 && to > from && to - from <= 400 * 864e5)) return res.status(400).json({ ok: false, error: 'bad_params' });
      const { recs } = await learnLoad(deps, now);
      return res.status(200).json({ ok: true, im: LI.impactView(recs.filter((r) => r && r.v === LR.LR_V), now, { from, to }), now });
    }
    if (op === 'learn' || op === 'learnExport' || op === 'learnBrief') {
      // 14/10/2026: מאגר הלמידה — רק למנהל. learnExport = כל הרשומות (לניתוח מחוץ לאפליקציה), learnBrief = החבילה ל־Claude
      if (!isAdmin(user)) return res.status(403).json({ ok: false, error: 'not_admin' });
      const { recs, wrote } = await learnLoad(deps, now);
      if (op === 'learnExport') return res.status(200).json({ ok: true, v: LR.LR_V, at: now, records: recs });
      if (op === 'learnBrief') return res.status(200).json({ ok: true, v: LR.LR_V, at: now, brief: LR.learnBrief(LR.learnView(recs, now), now), records: recs });
      // 26/10/2026: הספירות מהדלי = עשרות בקשות רשימה ל־R2 (עד 165 אלף מפתחות) בכל פתיחה של מרכז הניהול — מטמון AO_TTL, במקביל
      const [corpus, dev] = await Promise.all([
        aoGet(deps, 'lcorp', () => learnCorpusView(deps, 0), now).then((v) => v || { on: false, error: 'r2' }),   // מ׳2: רק המספרים
        aoGet(deps, 'ldev', () => devView(deps, now), now).then((v) => v || { on: false, error: 'r2' })]);         // מ׳6: האיסוף המלא — רק ספירות
      return res.status(200).json({ ok: true, view: LR.learnView(recs, now), insL: LR.INS_HE, synced: wrote, corpus, dev, now });
    }
    if (op === 'adminOv') {
      // 15/10/2026: מרכז הניהול — סקירה, "מחכה לך" ו"מה רץ איפה". מנהל בלבד; בלי פרטים אישיים (שמות שרתים, מספרי PR, גרסאות)
      if (!isAdmin(user)) return res.status(403).json({ ok: false, error: 'not_admin' });
      const [srvs, backup, sites, ext] = await Promise.all([
        query(deps, 'studioServers', null, S.SRV_MAX + 5).then((l) => l.map((x) => S.serverView(x, now)).filter(Boolean)).catch(() => []),
        readDoc(deps, 'sysBackup', 'cfg').catch(() => null), readDoc(deps, 'sysWatch', 'sites').catch(() => null), aoFacts(deps, now)]);
      const bk = backup ? { okAt: backup.okAt || 0, err: backup.err || '', up: backup.up || 0 } : null;
      // 15/10/2026: התראות לטלפון — כמה מכשירים רשומים אצלך, והאם ההתראות של המערכת נשלחות אליך (בעל הגיבוי, sysBackup/cfg.uid)
      const myst = await readStats(deps, uid).catch(() => ({}));
      const push = { n: W.normSubs(myst.wp).length, me: !!(backup && backup.uid === uid) };
      const jobs = (await aoGet(deps, 'ovj|' + uid, () => listJobs(deps, uid), now)) || [];   // פריט 16: ריצת מבחן מומלצת (סט הזהב שלך) · 26/10: מטמון AO_TTL (עד 300 קריאות בכל כניסה)
      return res.status(200).json({ ok: true, push, ov: AO.overview(Object.assign({ now, servers: srvs, backup: bk, sites: sites ? { sd: sites.sd || '' } : null, jobs }, ext)) });
    }
    if (op === 'adminAi') {
      // 15/10/2026: מרכז הניהול ← AI ועלויות. מנהל בלבד. רק מספרים: קריאות AI ליום (Academy), כמה קוראים (מספר, בלי זהות),
      // ההוצאה החודשית של Studio על השרת (סכום, כמה משתמשים, הגבוה ביותר מול התקרה — בלי לומר מי), ופונקציות Vercel
      if (!isAdmin(user)) return res.status(403).json({ ok: false, error: 'not_admin' });
      const keys = AO.dayKeys(now, AO.AI_DAYS);
      const docs = await Promise.all(keys.map((d) => readDoc(deps, 'aiUse', d).catch(() => null)));
      const days = {}; keys.forEach((d, i) => { days[d] = docs[i]; });
      const stats = await query(deps, 'studioStats', null, 500).catch(() => []);
      const used = stats.map((x) => S.monthUsed(x.mu, now)).filter((x) => x > 0);
      let fns = null;
      try { const n = require('fs').readdirSync(__dirname).filter((f) => /\.js$/.test(f)).length; fns = { n, max: 12 }; } catch (e) {}
      return res.status(200).json({ ok: true, ai: AO.aiView({ now, days, lim: AICACHE.limits(),
        month: { usd: used.reduce((a, b) => a + b, 0), users: used.length, cap: USER_MONTH(), top: used.length ? Math.max(...used) : 0 }, fns }) });
    }
    if (op === 'adminApps') {
      // 15/10/2026: מרכז הניהול ← האפליקציות. מספרים בלבד: כמה משתמשים, כמה חיברו IBKR / גיבוי / Studio, הקטלוג של Academy
      if (!isAdmin(user)) return res.status(403).json({ ok: false, error: 'not_admin' });
      const v = await aoGet(deps, 'apps', async () => {
        const [users, ibkr, lib, studio, sess] = await Promise.all(['users', 'ibkrVault', 'driveVault', 'studioDrive', 'sessions'].map((c) => fsCount(deps, c)));
        let cat = null; try { cat = (await require('../lib/libmgr').loadCat(deps)).cat; } catch (e) {}
        let rd = null; try { const r = await require('../lib/readers').getReaders(deps.fetch); rd = r.err ? null : r.list.length; } catch (e) {}
        return AO.appsView({ now, counts: { users, ibkr, lib, studio, sess }, cat, readers: rd });
      }, now);
      return res.status(200).json({ ok: true, apps: v });
    }
    if (op === 'adminTasks') {
      // 15/10/2026: מרכז הניהול ← סשנים ומשימות. משימות-פתוחות.md מהריפו (ציבורי) + ה־PR הפתוחים של הסשנים. מנהל בלבד
      if (!isAdmin(user)) return res.status(403).json({ ok: false, error: 'not_admin' });
      const md = await aoGet(deps, 'tasks', async () => {
        const r = await (deps.fetch || fetch)('https://raw.githubusercontent.com/' + AO_REPO + '/main/' + encodeURIComponent('משימות-פתוחות.md'), { signal: AbortSignal.timeout(6000) });
        return r.status === 200 ? (await r.text()).slice(0, 200000) : null;
      }, now);
      const ext = await aoFacts(deps, now);
      const prs = ((ext.gh && ext.gh.prs) || []).filter((x) => !x.dep);
      const tk = md == null ? null : AO.tasksParse(md, now);
      return res.status(200).json({ ok: true, tk, prs, lane: AO.laneView(prs, ext.gh && ext.gh.waiting), ck: tk ? AO.checksView(tk, await checkAnswers(deps)) : null, at: now });
    }
    if (op === 'adminYt') {
      // 25/10/2026: חשבון יוטיוב ייעודי לשרת — מנהל בלבד. set = cookies.txt (נבדק ומסונן ל־youtube/google), clear = הסרה.
      // העוגיות לא חוזרות לעולם — רק מצב (כמה, מתי, תקין/נחסם)
      if (!isAdmin(user)) return res.status(403).json({ ok: false, error: 'not_admin' });
      if (typeof body.set === 'string') {
        const c = YT.normCookies(body.set);
        if (c.error) return res.status(400).json({ ok: false, error: c.error });
        await patchDoc(deps, 'studioVault', YT_DOC, { yk: vault.seal({ t: c.text }, YT_AAD), yv: now, ya: now, yn: c.n, ye: c.exp, ys: '', yc: '', yt: 0, yo: 0, yp: 0, yb: 0 });
        await adminLog(deps, user, 'yt_set', String(c.n), now);
      } else if (body.clear === true) {
        await patchDoc(deps, 'studioVault', YT_DOC, { yk: '', yv: now, ya: now, yn: 0, ye: 0, ys: '', yc: '', yt: 0, yo: 0, yp: 0, yb: 0 });
        await adminLog(deps, user, 'yt_clr', '', now);
      }
      return res.status(200).json({ ok: true, yt: YT.ytView(await ytDoc(deps, now, true), now), now });
    }
    if (op === 'adminMail') {
      // 26/10/2026: שליחת מיילים משלנו (lib/mailer.js) — מנהל בלבד. set = { k, key } (key ריק = הסרה; המפתח לא חוזר לעולם),
      // test = שליחת מייל בדיקה למנהל דרך השרשרת. בלי — רק המצב: לכל שירות מוגדר?, היום/מכסה, החודש/מכסה, שגיאה אחרונה
      if (!isAdmin(user)) return res.status(403).json({ ok: false, error: 'not_admin' });
      const md = { fetch: deps.fetch || fetch, token: () => datastoreToken(deps.fetch) };
      if (body.set && typeof body.set === 'object') {
        const k = String(body.set.k || ''), key = body.set.key === '' ? '' : MAILER.normKey(k, body.set.key);
        if (!MAILER.KEYS.includes(k) || (body.set.key !== '' && !key)) return res.status(400).json({ ok: false, error: 'bad_params' });
        if (!vault.configured()) return res.status(503).json({ ok: false, error: 'vault_not_configured' });
        await MAILER.saveKey(md, k, key, now);
        await adminLog(deps, user, key ? 'mail_key' : 'mail_key_del', k, now);
      }
      let test = null;
      if (body.test === true) {
        const lang = body.lang === 'en' ? 'en' : 'he';
        test = await MAILER.send(md, Object.assign({ to: user.email }, MAILER.render('test', lang, {})), now).catch(() => ({ ok: false, error: 'x' }));
      }
      return res.status(200).json({ ok: true, mail: await MAILER.view(md, now), test: test ? { ok: !!test.ok, via: test.via || '', error: test.error || '', tried: test.tried || [] } : null });
    }
    if (op === 'adminCfg') {
      // 15/10/2026: מצב תחזוקה והגדרות ודגלים — מנהל בלבד. בלי set — רק קריאה
      if (!isAdmin(user)) return res.status(403).json({ ok: false, error: 'not_admin' });
      cfgC = { at: 0, v: null };
      const d = await sysCfg(deps, now);
      if (body.set) {
        const patch = SF.applyAdmin(d, body.set, now);
        if (!patch) return res.status(400).json({ ok: false, error: 'bad_params' });
        await patchDoc(deps, 'sysCfg', 'main', Object.assign({ updated: now }, patch));
        const lk = AO.cfgLogKind(body.set, d, now);
        if (lk) await adminLog(deps, user, lk[0], lk[1], now);
        cfgC = { at: now, v: Object.assign({}, d, patch) };
      }
      return res.status(200).json({ ok: true, cfg: SF.adminCfg(cfgC.v, now), now });
    }
    if (op === 'adminUsers') {
      // 15/10/2026: מרכז הניהול ← משתמשים והרשאות. מי מורשה ל־Academy (משתני Vercel + מי שנוסף מהאפליקציה), ל־Studio
      // (STUDIO_USERS + "כל המודלים") ולסנכרון IBKR ברקע. set = הוספה/הסרה של קורא ב־Academy (אותה רשימה חתומה של api/library)
      if (!isAdmin(user)) return res.status(403).json({ ok: false, error: 'not_admin' });
      const RD = deps.readers || require('../lib/readers');
      let cur = null;
      try { cur = await RD.getReaders(deps.fetch, true); } catch (e) { cur = { list: null, err: 'x' }; }
      if (body.set) {
        const email = String(body.set.email || '').trim().toLowerCase();
        if (body.set.k !== 'ac' || !RD.EMAIL_RE.test(email)) return res.status(400).json({ ok: false, error: 'bad_params' });
        if (!cur || cur.err) return res.status(503).json({ ok: false, error: 'store' });
        let list = cur.list.filter((x) => x.email !== email);
        if (body.set.on) list = list.concat([{ email, at: now }]).slice(-500);
        try { await RD.saveReaders(list, deps.fetch); } catch (e) { return res.status(503).json({ ok: false, error: 'store' }); }
        await adminLog(deps, user, body.set.on ? 'ac_add' : 'ac_del', email, now);
        cur = { list, err: '' };
      }
      const admins = emails(process.env.LIBRARY_ADMINS);
      const counts = await aoGet(deps, 'ucount', async () => {
        const [ibkr, lib, studio] = await Promise.all(['ibkrVault', 'driveVault', 'studioDrive'].map((c) => fsCount(deps, c)));
        return { ibkr, lib, studio };
      }, now);
      return res.status(200).json({ ok: true, users: AO.usersView({ admins: admins.length ? admins : emails(process.env.LIBRARY_READERS).slice(0, 1),
        acEnv: String(process.env.LIBRARY_READERS || '').split(/[\s,;]+/), acApp: cur ? cur.list : null, acErr: cur ? cur.err : 'x',
        stEnv: emails(process.env.STUDIO_USERS), am: SF.amList(await sysCfg(deps, now)), ts: SF.tsList(await sysCfg(deps, now)), ibEnv: emails(process.env.IBKR_SYNC_USERS), counts }) });
    }
    if (op === 'monTok') {
      // 22/10/2026: טוקן קריאה לווידג׳ט הניטור — רק מהמנהל. מוצג פעם אחת; השרתון שומר רק hash. ביטול = מחיקת ה-hash
      if (!isAdmin(user)) return res.status(403).json({ ok: false, error: 'not_admin' });
      monCfgC = { at: 0, v: null };   // 26/10/2026: טוקן חדש / ביטול — הווידג׳ט רואה מיד
      if (body.rev === true) {
        await patchDoc(deps, 'sysCfg', 'main', { monKh: '', monAt: 0, updated: now });
        await adminLog(deps, user, 'mon_tok_off', '', now);
        return res.status(200).json({ ok: true, on: false });
      }
      const tok = MON.monTokNew();
      await patchDoc(deps, 'sysCfg', 'main', { monKh: MON.monTokHash(tok), monAt: now, updated: now });
      await adminLog(deps, user, 'mon_tok_on', '', now);
      return res.status(200).json({ ok: true, on: true, tok, at: now });
    }
    if (op === 'adminMon') {
      // 22/10/2026: מוניטור — כל השרתים עם היסטוריית הדופק (24 שעות) + העבודות שרצות עכשיו. מנהל, או טוקן קריאה (הווידג׳ט)
      if (!(user.mon === true || isAdmin(user))) return res.status(403).json({ ok: false, error: 'not_admin' });
      let raw;
      // 28/10/2026: fr = קריאות Firestore לפי פעולה (lib/fsmeter.js, בזיכרון) — גם כש־Firestore לא עונה: אז הכי צריך לדעת מי צרך
      try { raw = await query(deps, 'studioServers', null, S.SRV_MAX + 5); } catch (e) { return res.status(503).json({ ok: false, error: 'store', fr: FSM.view(now) }); }
      const jobs = await query(deps, 'studioJobs', { state: 'running' }, 50).catch(() => []);
      const srv = raw.map((x) => { const v = S.serverView(x, now); return v && Object.assign(v, { mon: Array.isArray(x.mon) ? x.mon : [] }); }).filter(Boolean);
      const cfg = (await monCfg(deps, now).catch(() => null)) || {};
      const run = jobs.map((j) => ({ sid: j.sid, st: (j.prog || {}).st, p: (j.prog || {}).p }));
      // 24/10/2026: האחסון והעלות גם בווידג'ט · 26/10: נמדדים פעם בשעה — מטמון AO_TTL (הווידג׳ט מתרענן כל דקה)
      const usg = await aoGet(deps, 'monUsg', () => readDoc(deps, 'sysUsage', 'main'), now);
      return res.status(200).json({ ok: true, now, tok: { on: !!cfg.monKh, at: cfg.monAt > 0 ? cfg.monAt : 0 }, mon: MON.monView(srv, run, now), sto: USG.stoBrief(usg && usg.sto), fr: FSM.view(now) });
    }
    if (op === 'adminServices') {
      // 26/10/2026: מרכז הניהול ← "שירותים" — כל שירות: מצב, אחוז מהמכסה, הגיבוי, מתי נמדד (lib/services.js)
      if (!isAdmin(user)) return res.status(403).json({ ok: false, error: 'not_admin' });
      const v = SVC.servicesView(await svcFacts(deps, now, true));
      const w = (await readDoc(deps, 'sysWatch', 'svc').catch(() => null)) || {};
      return res.status(200).json({ ok: true, svc: Object.assign(v, { al: String(w.ks || '').split(',').filter(Boolean) }) });
    }
    if (op === 'provUsage') {
      // 23/10/2026: שימוש בפועל מול הספקים — רק מנהל (בלי טוקן ניטור). ספק בלי טוקן = off, ואף מספר לא מומצא
      if (!isAdmin(user)) return res.status(403).json({ ok: false, error: 'not_admin' });
      const cfg = (await readDoc(deps, 'sysUsage', 'main').catch(() => null)) || {};
      // 26/10/2026: מסך הניטור מתרענן כל 30 שנ׳ — שלושת הספקים (בקשות חיצוניות איטיות) רק פעם ב־2 דק׳ למופע
      const prov = USG.provMerge(await provGet(deps, now), cfg.upv);   // בלי טוקן כאן — מה ש־Vercel מדד
      return res.status(200).json({ ok: true, prov, hist: USG.histPush(cfg.uh, prov, now), sto: cfg.sto || null });   // sto: נמדד פעם בשעה ב־watch
    }
    if (op === 'adminAgents' || op === 'adminServers') {
      // 15/10/2026: מרכז הניהול ← Studio. עבודות התרגום של 30 הימים האחרונים מכל המשתמשים (שאילתה עם טווח על created —
      // בלי אינדקס מורכב), מצטבר בלבד: הסוכנים (studioagents), מצבי התרגום, והשרתים עם הדופק שלהם
      if (!isAdmin(user)) return res.status(403).json({ ok: false, error: 'not_admin' });
      const jobs = await jobs30(deps, now);
      if (op === 'adminAgents') {
        if (!jobs) return res.status(503).json({ ok: false, error: 'store' });
        const ag = A.agentsView(jobs, now);
        return res.status(200).json({ ok: true, ag: { jobs: ag.jobs, agents: ag.agents, ev: ag.ev, risk: ag.risk },
          md: AO.modesView({ now, jobs, modes: S.MODES, pub: S.PUBLIC_MODES, dflt: S.DEFAULT_MODE, def: S.NORM_DEF, defApi: S.NORM_DEF_API }) });
      }
      let list = [];
      try { list = (await query(deps, 'studioServers', null, S.SRV_MAX + 5)).map((x) => S.serverView(x, now)).filter(Boolean); }
      catch (e) { return res.status(503).json({ ok: false, error: 'store' }); }
      const busy = {};
      for (const j of jobs || []) if (j.state === 'running' && j.sid && !busy[j.sid]) busy[j.sid] = { st: j.prog && j.prog.st, p: j.prog && j.prog.p };
      return res.status(200).json({ ok: true, srv: AO.serversAdmin(list, busy, now) });
    }
    if (op === 'adminLive') {
      // 29/10/2026 (בקשת המשתמש): מרכז הניהול ← "עכשיו במערכת" — העבודות שרצות אצל כל המשתמשים: מי, איפה, כמה עלתה עד עכשיו.
      // j = עבודה אחת (גם אם כבר הסתיימה — מההתראה). wl = ביקשת "להודיע לי כשמסתיים"
      if (!isAdmin(user)) return res.status(403).json({ ok: false, error: 'not_admin' });
      let l;
      try { l = await liveJobs(deps, now, body.fresh === true); } catch (e) { return res.status(503).json({ ok: false, error: 'store' }); }
      const live = [];
      for (const j of l) { const r = UM.liveRow(j, await nameOf(deps, j.uid, now), now); if (r) live.push(Object.assign(r, { me: j.uid === uid })); }
      live.sort((a, b) => (a.me - b.me) || (b.t0 - a.t0));
      let one = null;
      if (S.JOB_RE.test(String(body.j || ''))) {
        const j = l.find((x) => x.id === body.j) || await readJob(deps, body.j).catch(() => null);
        if (j && j.kind !== 'ping') one = Object.assign(UM.liveRow(Object.assign({ id: body.j }, j), await nameOf(deps, j.uid, now), now), { me: j.uid === uid, end: +j.ended || 0 });
      }
      await adminUid(deps, now);
      return res.status(200).json({ ok: true, live, one, wl: !!admC.wl, now });
    }
    if (op === 'adminWait') {
      // 29/10/2026: "להודיע לי כשמסתיים" — התראה אחת כשאין יותר עבודות של משתמשים אחרים (watchEnd)
      if (!isAdmin(user)) return res.status(403).json({ ok: false, error: 'not_admin' });
      const on = body.on === true;
      try { await patchDoc(deps, 'sysBackup', 'cfg', { wl: on ? now : 0 }); } catch (e) { return res.status(503).json({ ok: false, error: 'store' }); }
      admC.wl = on ? now : 0;
      return res.status(200).json({ ok: true, wl: on });
    }
    if (op === 'adminAct') {
      // 29/10/2026 (בקשת המשתמש): מרכז הניהול ← משתמשים ופעילות — כמה כל משתמש תרגם ועלה (החודש, 30 יום, מאז ומעולם),
      // והטיימליין (עבודות, פעולות המנהל, משתמשים חדשים). מטמון AO_TTL; מילוי ראשון של "מאז ומעולם" — עד 5 משתמשים בכל פעם
      if (!isAdmin(user)) return res.status(403).json({ ok: false, error: 'not_admin' });
      if (body.fresh === true) aoCache.delete('uact');
      const v = await aoGet(deps, 'uact', async () => {
        const [stats, logs, jobs] = await Promise.all([query(deps, 'studioStats', null, 500), query(deps, 'sysLog', null, 300).catch(() => []), jobs30(deps, now)]);
        let bf = 0;
        for (const st of stats) {
          if (bf >= 5 || !UID_RE.test(String(st.id || '')) || (st.tt && st.tt.bf) || !(st.nm || st.em || st.mu)) continue;
          bf++;
          const all = await listJobs(deps, st.id).catch(() => null);
          if (!all) continue;
          st.tt = UM.backfill(all);
          await patchDoc(deps, 'studioStats', st.id, { tt: st.tt, updated: now }).catch(() => {});
        }
        return { us: UM.usersView(stats, jobs || [], now, { cap: USER_MONTH(), me: uid }), tl: UM.timeline(jobs || [], logs, stats, now) };
      }, now);
      if (!v) return res.status(503).json({ ok: false, error: 'store' });
      v.us.rows.forEach((r) => { r.me = r.u === uid; });
      return res.status(200).json(Object.assign({ ok: true, now, capDef: USER_MONTH() }, v));
    }
    if (op === 'adminUserSet') {
      // 29/10/2026: תקרה חודשית (cap: דולרים שלמים, 0 = של המערכת) / השהיה (ps) למשתמש אחד. נרשם ביומן הפעולות
      if (!isAdmin(user)) return res.status(403).json({ ok: false, error: 'not_admin' });
      const u = String(body.u || '');
      if (!UID_RE.test(u)) return res.status(400).json({ ok: false, error: 'bad_params' });
      const o = { updated: now };
      if (body.cap !== undefined) { const c = UM.normCap(body.cap); if (c < 0) return res.status(400).json({ ok: false, error: 'bad_params' }); o.mc = c; }
      if (body.ps !== undefined) { if (u === uid) return res.status(400).json({ ok: false, error: 'bad_params' }); o.ps = body.ps === true ? 1 : 0; }
      if (o.mc === undefined && o.ps === undefined) return res.status(400).json({ ok: false, error: 'bad_params' });
      const st = await readStats(deps, u);
      try { await patchDoc(deps, 'studioStats', u, o); } catch (e) { return res.status(503).json({ ok: false, error: 'store' }); }
      aoCache.delete('uact');
      const who = UM.label(st.nm, st.em);
      if (o.mc !== undefined) await adminLog(deps, user, 'us_cap', who + ' · ' + (o.mc ? '$' + o.mc : '—'), now);
      if (o.ps !== undefined) await adminLog(deps, user, o.ps ? 'us_pause' : 'us_resume', who, now);
      return res.status(200).json({ ok: true });
    }
    if (op === 'adminUsage') {
      // 15/10/2026: מרכז הניהול ← שימוש ומשפכים. רק ספירות (aggregation count) ועבודות 30 יום מצטברות — בלי מעקב חדש אחרי משתמשים
      if (!isAdmin(user)) return res.status(403).json({ ok: false, error: 'not_admin' });
      const c = await aoGet(deps, 'ucount2', async () => {
        const K = ['users', 'ibkrVault', 'driveVault', 'sessions', 'academyUsers', 'studioStats', 'studioVault', 'studioDrive'];
        const v = await Promise.all(K.map((k) => fsCount(deps, k)));
        return Object.fromEntries(K.map((k, i) => [k, v[i]]));
      }, now);
      return res.status(200).json({ ok: true, us: AO.usageView({ now, counts: c || {}, jobs: await jobs30(deps, now) }) });
    }
    if (op === 'adminDm') {
      // 24/10/2026: מרכז הניהול ← מעבדת השיפור ← Studio DM — יומני ההורדות של 14 הימים האחרונים (כבר מנוקים), בלי משתמשים
      if (!isAdmin(user)) return res.status(403).json({ ok: false, error: 'not_admin' });
      const c = learnCfg();
      if (!c.ok) return res.status(learnRemote() ? 421 : 200).json({ ok: !learnRemote(), r2: false, dm: null });
      try {
        const { items } = await dmCollect(deps, c, now, 14, 0);
        return res.status(200).json({ ok: true, r2: true, dm: DMLOG.dmView(items, now, 14) });
      } catch (e) { return res.status(503).json({ ok: false, error: 'store' }); }
    }
    if (op === 'adminFnl') {
      // 26/10/2026: מרכז הניהול ← מעבדת השיפור ← המסלול שלפני העבודה — 14 הימים האחרונים (14 קריאות, רק למנהל)
      if (!isAdmin(user)) return res.status(403).json({ ok: false, error: 'not_admin' });
      try {
        const ids = Array.from({ length: FNL.FNL_DAYS }, (_, i) => FNL.fnlDay(now - i * 86400000));
        const docs = await Promise.all(ids.map((id) => readDoc(deps, 'studioFunnel', id)));
        return res.status(200).json({ ok: true, fn: FNL.fnlView(docs.filter(Boolean), now) });
      } catch (e) { return res.status(503).json({ ok: false, error: 'store' }); }
    }
    if (op === 'adminFund') {
      // 25/10/2026: מרכז הניהול ← מעבדת השיפור ← דיוק הנתונים — הסיכום הלילי של מנתח החברות (מידע ציבורי בלבד)
      if (!isAdmin(user)) return res.status(403).json({ ok: false, error: 'not_admin' });
      const a = await fundAuditGet(deps, now);
      return res.status(200).json({ ok: true, fa: a ? FAU.auditView(a.cur, a.hist, now) : null });
    }
    if (op === 'adminFb') {
      // 15/10/2026: מרכז הניהול ← משוב ופניות. 300 האחרונים; set = { id, st: 'd'|'n'|'x' } (טופל / חדש / מחיקה)
      if (!isAdmin(user)) return res.status(403).json({ ok: false, error: 'not_admin' });
      if (body.set) {
        const id = String(body.set.id || ''), st = String(body.set.st || '');
        if (!/^[0-9a-z]{6,20}$/.test(id) || !['d', 'n', 'x'].includes(st)) return res.status(400).json({ ok: false, error: 'bad_params' });
        if (st === 'x') await delDoc(deps, 'sysFeedback', id); else await patchDoc(deps, 'sysFeedback', id, { st });
        if (st !== 'n') await adminLog(deps, user, st === 'x' ? 'fb_del' : 'fb_done', '', now);
      }
      let list = [];
      try { list = await query(deps, 'sysFeedback', null, 300); } catch (e) { return res.status(503).json({ ok: false, error: 'store' }); }
      return res.status(200).json({ ok: true, fb: AO.fbView(list) });
    }
    if (op === 'adminBackups') {
      // 17/10/2026: מרכז הניהול ← גיבויים. הגיבוי היומי ל־R2 (רשימת bk/) והגיבוי אצל ספק שני (sysBackup/cfg). קריאה בלבד
      if (!isAdmin(user)) return res.status(403).json({ ok: false, error: 'not_admin' });
      const c = R2.config();
      const [r2, off] = await Promise.all([c.ok ? R2.list(c, r2deps(deps), 'bk/', 200).catch(() => null) : Promise.resolve(null),
        readDoc(deps, 'sysBackup', 'cfg').catch(() => null)]);
      return res.status(200).json({ ok: true, bk: AO.backupsView({ now, r2, off, me: uid }) });
    }
    if (op === 'adminSecrets') {
      // 15/10/2026: מרכז הניהול ← סודות ותאריכים. רק "מוגדר / לא" לכל סוד (הקטלוג של SECURITY.md), אף פעם לא ערך;
      // מה שבכספות — כמה משתמשים, בלי uid
      if (!isAdmin(user)) return res.status(403).json({ ok: false, error: 'not_admin' });
      const vaults = await aoGet(deps, 'vaults', async () => {
        const [ibkr, routine] = await Promise.all(['ibkrVault', 'studioVault'].map((c) => fsCount(deps, c)));
        return { ibkr, routine };
      }, now);
      return res.status(200).json({ ok: true, sec: AO.secretsView({ now, host: process.env.VERCEL ? 'vercel' : 'srv', vaults: vaults || {},
        has: (n) => typeof process.env[n] === 'string' && process.env[n].trim() !== '' }) });
    }
    if (op === 'adminLog') {
      // 15/10/2026: מרכז הניהול ← יומן פעולות. 300 האחרונות (בלי orderBy — אוסף קטן של מנהל אחד), ממוין כאן; ישנות מ־90 יום נמחקות
      if (!isAdmin(user)) return res.status(403).json({ ok: false, error: 'not_admin' });
      let list = [];
      try { list = await query(deps, 'sysLog', null, 300); } catch (e) { return res.status(503).json({ ok: false, error: 'store' }); }
      for (const id of AO.logOld(list, now)) { try { await delDoc(deps, 'sysLog', id); } catch (e) {} }
      return res.status(200).json({ ok: true, log: AO.logView(list, now, user.email) });
    }
    if (op === 'adminReady') {
      // 15/10/2026: בדיקת מוכנות לכל המערכת — כותרות המטמון, הגרסה החיה בשלוש הכתובות, השרתון והגיבוי שלו, חתימת החיבור המשותף,
      // assetlinks, security.txt ותאריכים. רק עובדות ציבוריות (כתובות האתר) + מונים בלי פרטים. מטמון 5 דק׳ (fresh = לבדוק עכשיו)
      if (!isAdmin(user)) return res.status(403).json({ ok: false, error: 'not_admin' });
      if (body.fresh) aoCache.delete('ready');
      const v = await aoGet(deps, 'ready', () => readyNow(deps, now), now);
      return res.status(200).json({ ok: true, rd: v });
    }
    if (op === 'adminCheck') {
      // 15/10/2026: אימות אחרי שינוי — המנהל עונה על בדיקה בטלפון: ok (עובד) / no (לא עובד + הערה) / '' (לבטל). נשמר ב־sysChecks
      if (!isAdmin(user)) return res.status(403).json({ ok: false, error: 'not_admin' });
      const id = String(body.id || '');
      if (!/^[0-9a-f]{12}$/.test(id)) return res.status(400).json({ ok: false, error: 'bad_id' });
      const st = String(body.st || '');
      if (!['ok', 'no', ''].includes(st)) return res.status(400).json({ ok: false, error: 'bad_state' });
      if (!st) { await delDoc(deps, 'sysChecks', id); await adminLog(deps, user, 'ck_clr', AO.noteClean(body.t).slice(0, 90), now); return res.status(200).json({ ok: true }); }
      await patchDoc(deps, 'sysChecks', id, { st, n: st === 'no' ? AO.noteClean(body.note) : '', t: AO.noteClean(body.t).slice(0, 90), at: now });
      await adminLog(deps, user, st === 'ok' ? 'ck_ok' : 'ck_no', AO.noteClean(body.t).slice(0, 90), now);
      return res.status(200).json({ ok: true });
    }
    if (op === 'atNew' || op === 'atList' || op === 'atDel') {
      // 14/10/2026: טוקני ניתוח — קריאה בלבד של מאגר הלמידה, לסשן של Claude Code (tools/learn-pull.js). נשמר רק ה־hash
      if (!isAdmin(user)) return res.status(403).json({ ok: false, error: 'not_admin' });
      if (op === 'atNew') {
        const list = await query(deps, 'sysTokens', null, 50);
        if (list.filter((t) => t.exp > now).length >= AT_MAX) return res.status(409).json({ ok: false, error: 'too_many' });
        const tok = 'snbL_' + crypto.randomBytes(24).toString('base64url');
        const days = Math.max(1, Math.min(AT_DAYS, Math.round(Number(body.days) || AT_DAYS)));
        const nm = String(body.name || '').replace(/[^\p{L}\p{N} ._-]/gu, '').trim().slice(0, 40) || 'Claude';
        const rec = { n: nm, at: now, exp: now + days * 86400000, by: uid, last: 0, uses: 0 };
        await patchDoc(deps, 'sysTokens', atId(tok), rec);
        return res.status(200).json({ ok: true, token: tok, t: atView(Object.assign({ id: atId(tok) }, rec)) });
      }
      if (op === 'atDel') {
        const id = String(body.id || '');
        if (!/^[0-9a-f]{40}$/.test(id)) return res.status(400).json({ ok: false, error: 'bad_id' });
        await delDoc(deps, 'sysTokens', id);
      }
      const list = await query(deps, 'sysTokens', null, 50);
      return res.status(200).json({ ok: true, tokens: list.map(atView).sort((a, b) => b.at - a.at) });
    }
    if (op === 'learnPref') {
      // 14/10/2026: המתג בהגדרות — לכל משתמש (לא רק למנהל). 15/10 (מ׳1): ack = ההודעה בכניסה הראשונה נקראה (lra)
      // 15/10/2026: tv = גרסת הנוסח שנקרא. LRN_TV ומעלה (הנוסח שאומר שגם טקסט הכתוביות ושמות הדוברים נשמרים) = גם lrt — ההסכמה לטקסט
      const tx = body.ack === true && (body.tv | 0) >= LRN_TV ? Object.assign({ lrt: now }, (body.tv | 0) >= LRN_MV ? { lrm: now } : {}, (body.tv | 0) >= LRN_FV ? { lrf: now } : {}) : {};   // 4 = האיסוף המלא   // מ׳4: 3 = גם הקול ו־240p
      if (body.ack === true && body.on === undefined) { await patchDoc(deps, 'studioStats', uid, Object.assign({ lra: now, updated: now }, tx)); return res.status(200).json(Object.assign({ ok: true, lra: now }, tx)); }
      const on = body.on === true;
      await patchDoc(deps, 'studioStats', uid, Object.assign({ lo: on ? 0 : 1, updated: now }, body.ack === true ? Object.assign({ lra: now }, tx) : {}));
      learnMem = null;   // 26/10/2026: המתג השתנה — הסנכרון הבא של מאגר הלמידה קורא הכל (העבודות הישנות שלך לא "השתנו")
      return res.status(200).json({ ok: true, lrn: on });
    }
    if (op === 'learnForget') {
      // 15/10/2026 (מ׳1): "מחק את התרומות שלי" — הרשומות של כל העבודות של המשתמש (גם שנמחקו — studioStats.lgn), ועבודה
      // שנוצרה עד עכשיו לא נכנסת שוב (lf). המתג לא משתנה: עבודות חדשות נכנסות רק אם הוא דולק
      if (limited('lf|' + uid, 3)) return res.status(429).json({ ok: false, error: 'rate_limited' });
      const st = await readStats(deps, uid);
      const ids = new Set([...(await listJobs(deps, uid)).map((j) => LR.lid(j.id)), ...String(st.lgn || '').split(',').filter((x) => /^[0-9a-f]{20}$/.test(x))]);
      await patchDoc(deps, 'studioStats', uid, { lf: now, lgn: '', updated: now });
      let n = 0;
      for (const id of ids) { try { if (await readDoc(deps, 'studioLearn', id)) { await delDoc(deps, 'studioLearn', id); n++; } } catch (e) {} }
      learnMem = null;   // 26/10/2026: הרשומות שנמחקו לא נשארות במטמון של מרכז הניהול
      const nc = await learnCorpusForget(deps, ids);   // מ׳2: גם הטקסט בדלי (בתור ובחודשים)
      return res.status(200).json({ ok: true, n, nc, lf: now });
    }
    if (op === 'status') {
      const v = await readVault(deps, uid);
      const d = await gdrive.driveState(deps, uid).catch(() => ({ configured: gdrive.configured(), connected: false, email: '' }));
      const st = await readStats(deps, uid);   // v363: "הרגיל" לכל מצב · v364: ספר התיקונים — למסך "מגדל הפיקוח"
      return res.status(200).json({ ok: true, conn: v && v.r ? { hint: v.hint || '', since: v.since || 0, ok: v.ok || 0 } : null,
        drive: { configured: d.configured, connected: d.connected, email: d.email }, kinds: S.WORKER_KINDS.slice(),
        norm: S.normsView(st.ns, 'r'), normA: S.normsView(st.ns, 'a') /* 11/10: הרגיל לפי המנוע */, sh: S.thView(st.thr) /* v384: מצב צל לכל מצב */, wpN: W.normSubs(st.wp).length, fb: S.fbView(st.fb), fm: S.normFixMode(st.fm), ops: await opsFor(uid), inc: await incFor(uid),
        rl: S.normRules(st.rl), halt: st.halt || 0, api: await apiView(st), sc: await scFor(uid), eta: ETA.etaView(st.et, now, ((await readDoc(deps, 'studioEta', 'a').catch(() => null)) || {}).et),
        pk: S.pickerCfg(process.env, gdrive.cfg().id), gb: gbrowse.configured() || (gbRemote() ? 'r' : false) /* 26/10: רשימת הקבצים ב־Drive — 'r' = אולי ב־Vercel (gbConfig) */, lrn: !st.lo /* 14/10: המתג של מאגר הלמידה */, lra: +st.lra || 0, lrt: +st.lrt || 0, lrm: +st.lrm || 0 /* מ׳4 */, mf: await fullModes() /* 15/10: כל מצבי התרגום (המנהל / הרשימה) */, url: (await urlAllowed()) && (await flagOn(deps, 'st_url', now)) && !!R2.config().ok /* 22/10: הורדה מקישור */, yc: (await urlAllowed()) && (await flagOn(deps, 'st_url', now)) && !!R2.config().ok && YT.ytCloud(await ytDoc(deps, now)) /* 25/10: יוטיוב לענן דרך החשבון הייעודי */, lrf: +st.lrf || 0 /* האיסוף המלא — הנוסח נקרא */, lf: +st.lf || 0 /* 15/10 (מ׳1): ההודעה נקראה / מתי נמחקו התרומות */, r2: !!R2.config().ok /* 11/10: האחסון שלנו מוגדר (המילון שם) */, kt: { s: SC.SRC_TTL, j: SC.jobTtl(PROJECT()) } /* 26/10: כמה זמן נשמר — באומדן שלפני ההתחלה */, now });   // בחירה מ־Drive (Picker) — רק כשהוגדר מפתח   // v367: החוקים ומתג החירום
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
        PUSH_MEM.delete(uid);
        await patchDoc(deps, 'studioStats', uid, { wp, updated: now });
        return res.status(200).json({ ok: true, n: wp.length });
      }
      if (act === 'off') {
        const wp = W.dropSub(st.wp, body.e);
        PUSH_MEM.delete(uid);
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
    if (op === 'glossUrl') {
      // 11/10/2026: מילון המונחים ב־R2 — קישורים חתומים לקריאה ולכתיבה של הקובץ של המשתמש בלבד (gl/<uid>.tsv), לחמש דקות.
      // הקובץ עובר ישירות בין הטלפון ל־R2 (הגוף לשרתון מוגבל ל־4KB). בלי R2 — r2:false והטלפון נשאר ב־Drive
      const c = R2.config(), key = S.glKey(uid);
      if (!c.ok || !key) return res.status(200).json({ ok: true, r2: false });
      const rd = r2deps(deps);
      return res.status(200).json({ ok: true, r2: true, get: await R2.presign(c, rd, { method: 'GET', key, expires: 300 }),
        put: await R2.presign(c, rd, { method: 'PUT', key, expires: 300 }) });
    }
    if (op === 'fnl') {
      // 26/10/2026 (Vid Hub, שלב א׳): צעדים קבועים במסלול שלפני העבודה ו"למה ויתרת?" — מונים ליום (studioFunnel/<יום>), בלי משתמש.
      // תקלה בכתיבה לא מפריעה לכלום — זו מדידה בלבד
      const f = FNL.normFnl(body);
      if (!f) return res.status(400).json({ ok: false, error: 'bad_params' });
      if (limited('fnl:' + uid, 30)) return res.status(429).json({ ok: false, error: 'rate' });
      const doc = 'projects/' + PROJECT() + '/databases/(default)/documents/studioFunnel/' + FNL.fnlDay(now);
      const r = await fsCall(deps, 'POST', ':commit', FNL.fnlWrite(doc, f)).catch(() => ({ status: 0 }));
      return res.status(200).json({ ok: r.status === 200 });
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
    if (op === 'fbDel') {
      // 14/10/2026: מחיקת רשומה מספר התיקונים — היא לא תוזכר יותר לסוכנים; אם התקלה תחזור, תיפתח רשומה חדשה
      const st = await readStats(deps, uid);
      const fb = S.fbRemove(st.fb, String(body.fp || ''));
      if (!fb) return res.status(404).json({ ok: false, error: 'not_found', fb: S.fbView(st.fb) });
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
          srvAuthPut(sid, null, now);   // 26/10/2026: הטוקן מת מיד גם בפעולות הקלות (האימות בזיכרון)
          if (sd.dn) await downClear(deps, sd.by || uid, sid, now);   // ת7: שרת שנפל והוסר — ההתראה נסגרת
          if (sd.ba) await authBack(deps, Object.assign({ by: uid }, sd), sid, now);   // 15/10: שרת שהטוקן שלו נדחה והוסר — גם
        }
        await adminLog(deps, user, op === 'srvRemove' ? 'srv_del' : body.paused === true ? 'srv_pause' : 'srv_resume', sd.name || sid, now);   // 17/10/2026: יומן הפעולות
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
        if (!t.ok && !(k === 'orphans' && R2.config().ok)) return res.status(200).json({ ok: false, error: t.error });   // ת4: יתומות ב־R2 — בלי Drive
        if (k === 'ck') {
          const byJob = new Map();
          for (const c of SC.doneCheckpoints(jobs)) {
            if (SR.isId(c.id)) await r2Files(deps, 'del', { id: c.id }, uid, SR.folderOfId(c.id), 'phone');   // ת4: נקודת שמירה ב־R2
            else await driveTrash(deps, t.token, c.id);
            n++; byJob.set(c.job, true);
          }
          for (const id of byJob.keys()) await patchJob(deps, id, { ck: [] });
        } else {
          for (const x of (await cleanTargets(deps, uid, t.ok ? t.token : '', jobs, now))[k]) { await trashTarget(deps, uid, t.token, x); n++; }
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
    if (op === 'urlProbe') {
      // 22/10/2026: בדיקת קישור — למנהל, ל"כל המודלים" ולחשבונות הבדיקה (25/10), והדגל st_url. pid = מצב בדיקה קיימת
      if (!(await urlAllowed())) return res.status(403).json({ ok: false, error: 'not_allowed' });
      if (!(await flagOn(deps, 'st_url', now))) return res.status(409).json({ ok: false, error: 'flag_off', fl: 'st_url' });
      if (body.pid != null) {
        const pid = String(body.pid || '');
        const pr = /^p[0-9a-z]{6,30}$/.test(pid) ? await readDoc(deps, 'studioProbe', pid) : null;
        if (!pr || pr.uid !== uid) return res.status(404).json({ ok: false, error: 'no_probe' });
        return res.status(200).json({ ok: true, probe: SU.probeView(Object.assign(pr, { id: pid }), now), now });
      }
      const u = SU.normSrcUrl(body.url), ref = body.ref ? SU.normSrcUrl(body.ref) : '';   // ref — שלב 2: הדף שבו נמצא הקובץ
      if (!u || (body.ref && !ref)) return res.status(400).json({ ok: false, error: 'bad_url' });
      if (!R2.config().ok) return res.status(503).json({ ok: false, error: 'r2_needed' });
      if (limited('u|' + uid, 10)) return res.status(429).json({ ok: false, error: 'rate_limited' });
      const old = await query(deps, 'studioProbe', { uid }, 30).catch(() => []);
      for (const o of old.filter((x) => now - (x.at || 0) > SU.PROBE_KEEP).slice(0, 10)) await delDoc(deps, 'studioProbe', o.id).catch(() => {});
      const pid = 'p' + now.toString(36) + crypto.randomBytes(4).toString('hex');
      await patchDoc(deps, 'studioProbe', pid, Object.assign({ uid, u, st: 'q', at: now }, ref ? { ref } : {}));
      probeHint = now;
      return res.status(200).json({ ok: true, probe: SU.probeView({ id: pid, st: 'q', at: now }, now), now });
    }
    if (op === 'create') {
      const spec = S.normSpec(body.spec);
      if (!spec) return res.status(400).json({ ok: false, error: 'bad_spec' });
      if (!S.langReady(spec)) return res.status(400).json({ ok: false, error: 'lang_unsupported' });   // לפני ההעלאה, לא אחריה
      if (await modeLocked(spec.mode)) return res.status(403).json({ ok: false, error: 'mode_locked' });
      if (spec.ph && !R2.config().ok) return res.status(503).json({ ok: false, error: 'r2_needed' });   // 24/10/2026: תרגום בטלפון — הקבצים הקטנים ב־R2
      if (spec.ka && !isAdmin(user)) return res.status(403).json({ ok: false, error: 'not_allowed' });   // 26/10/2026: קריוקי — רק המנהל עד שמודל ההפרדה בתמונת העובד
      if (spec.ka && !R2.config().ok) return res.status(503).json({ ok: false, error: 'r2_needed' });
      if (spec.src === 'url') {   // 22/10/2026: הורדה מקישור — כמו בבדיקה: מנהל / "כל המודלים" / חשבונות הבדיקה, הדגל, ו־R2
        if (!(await urlAllowed())) return res.status(403).json({ ok: false, error: 'not_allowed' });
        if (!(await flagOn(deps, 'st_url', now))) return res.status(409).json({ ok: false, error: 'flag_off', fl: 'st_url' });
        if (!R2.config().ok) return res.status(503).json({ ok: false, error: 'r2_needed' });
      }
      const sbc = await sysBlock(deps, { kind: 'tr', spec }, now, false, isAdmin(user), uid);   // 15/10/2026: לפני שמעלים כמה GB
      if (sbc) return res.status(409).json(Object.assign({ ok: false }, sbc));
      if (await engLocked(spec)) return res.status(403).json({ ok: false, error: 'eng_locked' });   // 25/10/2026: אחרי התחזוקה והדגלים — ההודעה שלהם קודמת
      const all = (await listJobs(deps, uid)).filter((j) => j.kind !== 'ping');
      if (all.filter((j) => S.ACTIVE.includes(S.effState(j, now).state)).length >= S.maxActive(isAdmin(user))) return res.status(409).json({ ok: false, error: 'too_many' });
      for (const old of all.filter((j) => S.FINAL.includes(S.effState(j, now).state)).slice(S.MAX_STORED - 1)) { await learnSave(deps, old, now); await delDoc(deps, 'studioJobs', old.id); }
      const job = { id: S.newJobId(), uid, kind: 'tr', state: 'new', created: now, updated: now, spec };
      if (apiJob(job) && R2.config().ok) job.folder = SR.folderFor(job.id);   // ת4: עבודה במצב שרת — הקבצים ב־R2 (Routine נשאר ב־Drive)
      await patchJob(deps, job.id, job);
      // 25/10/2026: עבודה מקישור מתחילה כבר כאן — בלי לחכות שהטלפון יישאר פתוח עד op:'start' (באייפון Safari מקפיא את הדף
      // כשעוברים לאפליקציה אחרת, ופרק של משתמש חיכה כך שעתיים). סירוב — העבודה נשארת "חדשה", עם הקוד (sw)
      if (body.start === true && spec.src === 'url') {
        const [, so] = await startJob(deps, uid, job, {}, now, { adm: isAdmin(user), modeLocked, engLocked });
        const sx = {};
        for (const k of ['error', 'mi', 'mx', 'msg', 'til', 'fl', 'retry']) if (so[k] !== undefined) sx[k] = so[k];
        return res.status(200).json({ ok: true, job: so.job || view(job), start: Object.assign({ ok: !!so.ok }, sx) });
      }
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
      // פריט 15 ("ריצת מבחן"): src = עבודת זהב אחת, modes = כמה מצבים עליה (השוואה בין מצבים על אותו סרטון)
      const modes = Array.isArray(body.modes) ? Array.from(new Set(body.modes.filter((m) => S.MODES.includes(m) || S.LEGACY_MODES[m]).map((m) => S.modeNow(m)))).slice(0, S.GOLD_MAX) : [];   // מצב לא מוכר — נזרק (לא ברירת המחדל)
      if (Array.isArray(body.modes) && (!modes.length || !body.src)) return res.status(400).json({ ok: false, error: 'bad_params' });
      for (const m of modes) if (await modeLocked(m)) return res.status(403).json({ ok: false, error: 'mode_locked' });
      const gsrc = S.goldSources(all).filter((j) => !body.src || j.id === body.src);
      const xe = body.xe != null ? S.normXe(body.xe) : null;   // 24/10/2026: ניסוי המאמץ — רק מנהל (מרכז הניהול)
      if (body.xe != null && (!xe || !isAdmin(user))) return res.status(xe ? 403 : 400).json({ ok: false, error: xe ? 'admin' : 'bad_params' });
      const xg = body.xg === true;   // 24/10/2026: ניסוי "בלי מילון מונחים" — גם הוא רק מנהל
      if (xg && !isAdmin(user)) return res.status(403).json({ ok: false, error: 'admin' });
      // both = לכל מצב גם הרצה רגילה וגם הרצה בניסוי (השוואה על אותו סרטון, באותו זמן)
      const vx = xe || xg ? { xe, xg: xg ? 1 : 0 } : null;
      const vars = vx ? (body.both === true ? [null, vx] : [vx]) : [null];
      const src = (modes.length ? modes.flatMap((m) => vars.map((x) => [gsrc[0], m, x])) : gsrc.map((j) => [j, null, vx])).filter((x) => x[0]).slice(0, S.GOLD_MAX);
      if (!src.length) return res.status(400).json({ ok: false, error: 'no_gold' });
      if (all.some((j) => j.gs && S.ACTIVE.includes(S.effState(j, now).state))) return res.status(409).json({ ok: false, error: 'gold_busy' });   // הרצה קודמת עוד פתוחה
      if (all.filter((j) => S.ACTIVE.includes(S.effState(j, now).state)).length + src.length > S.maxActive(isAdmin(user))) return res.status(409).json({ ok: false, error: 'too_many' });   // הסקירה: לא לעקוף את MAX_ACTIVE
      for (const old of all.filter((j) => S.FINAL.includes(S.effState(j, now).state) && !j.gd).slice(S.MAX_STORED - src.length)) await delDoc(deps, 'studioJobs', old.id);
      const made = [];
      for (const [j, m, x] of src) { const c = S.goldClone(j, S.newJobId(), uid, now, m, x); await patchJob(deps, c.id, c); made.push(view(c)); }
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
      if (body.ref != null && job.sx > 0) return res.status(409).json({ ok: false, error: 'src_gone' });   // 26/10/2026: בלי מקור אין הרצה חוזרת
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
      await learnSave(deps, job, now);
      return res.status(200).json({ ok: true, job: view(job) });
    }
    if (op === 'r2up' || op === 'r2parts' || op === 'r2done' || op === 'r2url' || op === 'r2bg') {
      // ת4: העלאה מהטלפון ל־R2 (בחלקים, עם המשך) וקישור צפייה / הורדה — רק בתיקייה של העבודה הזו
      const [code, out] = await r2Files(deps, op.slice(2), body, uid, job.folder, 'phone');
      return res.status(code).json(out);
    }
    if (op === 'file') {
      // 21/10/2026 (עבודה אמיתית): הסרטון סיים לעלות בדיוק כשהעבודה נכשלה (השרת התעדכן — worker_lost) — 'state' השאיר
      // את הסרטון בלי רישום, וה"המשך" האוטומטי היה מחכה לו עד upload_timeout. עבודה שנכשלה עוד ממשיכה — רושמים
      if (job.kind !== 'tr' || !['new', 'queued', 'running', 'failed'].includes(st)) return res.status(409).json({ ok: false, error: 'state' });
      // 22/10/2026: s = קובץ כתוביות קיים (spec.src = 'subs') — נשמר ב־fsu, בגודל של המקור ועד SUBS_MAX
      const subs = !!(job.spec && job.spec.src === 'subs');
      const ph = !!(job.spec && job.spec.ph === 1);   // 24/10/2026: תרגום בטלפון — הקול וקובץ המדידות; הסרטון לא עולה לעולם
      // 26/10/2026: r = רצועת הכתוביות שבקובץ (בשפת המקור), עזר להגהת התמלול — רק כשהשרת שלנו מגיה (eng api), עד SUBS_MAX
      const hlp = body.which === 'r' && !subs && !!(job.spec && job.spec.eng === 'api');
      const which = hlp ? 'r' : subs ? (body.which === 's' ? 's' : '') : ph ? (body.which === 'a' || body.which === 'm' ? body.which : '') : body.which === 'v' ? 'v' : body.which === 'a' ? 'a' : '';
      const fkey = which === 's' ? 'fsu' : which === 'r' ? 'fsr' : 'f' + which;
      const fid = String(body.id || ''), folder = String(body.folder || ''), ext = body.ext === true && which === 'v';   // ext: סרטון שבחרת ב־Drive (Picker) — נשאר במקומו
      const bx = ext && body.bx === true;   // 26/10/2026: נבחר ברשימה של Studio (gbrowse) — רק במצב השרת, והאימות בגישה של הרשימה
      if (!which || !S.FILE_ID_RE.test(fid) || !S.FILE_ID_RE.test(folder) || (job.folder && job.folder !== folder)) return res.status(400).json({ ok: false, error: 'bad_params' });
      if (ph && !SR.isFolder(folder)) return res.status(400).json({ ok: false, error: 'bad_params' });
      if (bx && !S.bxOk(job)) return res.status(400).json({ ok: false, error: 'bx_engine' });
      if (bx && gbRemote()) return res.status(421).json({ ok: false, error: 'gb_remote' });
      if (SR.isFolder(folder) && !ext) {
        // ת4: קובץ ב־R2 — קיים, בתיקייה של העבודה, והסרטון בגודל של המקור (מקור מ־Drive — ext — נשאר ב־Drive, בבדיקה שלמטה)
        if (folder !== job.folder) return res.status(400).json({ ok: false, error: 'bad_params' });
        const rg = await r2Register(deps, job, which, fid, now);
        if (rg.error) return res.status(rg.code).json({ ok: false, error: rg.error });
        return res.status(200).json({ ok: true, job: view(job) });
      }
      // מאמתים מול Drive עצמו: הקובץ קיים, בתיקיית העבודה, והווידאו בגודל של המקור — העובד יוריד בדיוק את זה
      const t = await (bx ? gbrowse : gdrive).accessToken(deps, uid);
      if (!t.ok) return res.status(200).json({ ok: false, error: t.error });
      const r = await (deps.fetch || fetch)(DRIVE + fid + '?supportsAllDrives=true&fields=id,name,size,mimeType,parents,trashed', { headers: { Authorization: 'Bearer ' + t.token } });
      let meta = null; try { meta = await r.json(); } catch (e) {}
      if (r.status === 404) return res.status(400).json({ ok: false, error: 'file_missing' });
      if (r.status !== 200 || !meta) return res.status(502).json({ ok: false, error: 'drive_http_' + r.status });
      const f = S.normFile(meta);
      if (!f || meta.trashed || (ext ? !S.extVideoOk(meta) : !(Array.isArray(meta.parents) && meta.parents.includes(folder)))) return res.status(400).json({ ok: false, error: 'file_bad' });
      if (ext) f.ext = true;
      if (bx) f.bx = true;
      if ((which === 'v' || which === 's') && job.spec && f.size !== job.spec.size) return res.status(400).json({ ok: false, error: 'file_size' });
      if (which === 'r' && f.size > S.SUBS_MAX) return res.status(400).json({ ok: false, error: 'file_size' });
      f.at = now;
      await patchJob(deps, job.id, { [fkey]: f, folder, updated: now });
      job[fkey] = f; job.folder = folder;
      return res.status(200).json({ ok: true, job: view(job) });
    }
    if (op === 'start') {
      // 29/10/2026 (בקשת המשתמש): המנהל מתחיל תרגום / ריצת בדיקה בזמן שמשתמש אחר עובד — קודם שואלים (ow = "להתחיל בכל זאת")
      if (isAdmin(user) && body.ow !== true && job.kind === 'tr' && umOn(deps)) {
        const oth = (await liveJobs(deps, now).catch(() => [])).filter((j) => j.uid !== uid);
        if (oth.length) {
          const r = UM.liveRow(oth[0], await nameOf(deps, oth[0].uid, now), now);
          return res.status(409).json({ ok: false, error: 'others_busy', ob: { nm: r.nm, p: r.p, left: r.left, n: oth.length } });
        }
      }
      const [code, out] = await startJob(deps, uid, job, body, now, { adm: isAdmin(user), modeLocked, engLocked });
      return res.status(code).json(out);
    }
    if (op === 'phKey') {
      // 24/10/2026: תרגום בטלפון — מפתח לעבודה אחת בשביל Studio לאנדרואיד (הקול, המדידות, ההתחלה, ההורדה והצריבה בלי
      // הדפדפן). לבדיקה — ה־hash; לשליפה חוזרת — מוצפן בכספת (pke, ‏AAD לפי העבודה), אף פעם לא גלוי במסמך
      if (job.kind !== 'tr' || !(job.spec && job.spec.ph === 1) || !SR.isFolder(job.folder) || !['new', 'queued', 'running', 'failed', 'done'].includes(st)) return res.status(409).json({ ok: false, error: 'state' });
      // אותו מפתח כל עוד נשאר לו יותר מיום (מוצפן בכספת — pke): הדף מבקש אותו מראש, כדי לפתוח את האפליקציה ישר מהנגיעה
      // (Chrome פותח intent רק מתוך נגיעה), וזה לא מבטל מפתח שהאפליקציה כבר משתמשת בו באמצע העלאה
      const aad = 'phk|' + job.id;
      const old = job.pke && now < (job.pkx || 0) - 24 * 3600e3 ? vault.open(job.pke, aad) : null;
      if (old && S.KEY_RE.test(String(old.k || '')) && S.keyMatches(job, old.k, 'pkh')) return res.status(200).json({ ok: true, key: old.k, exp: job.pkx, api: 'studio' });
      const key = S.newKey();
      await patchJob(deps, job.id, { pkh: S.keyHash(key), pkx: now + PH_KEY_TTL, pke: vault.seal({ k: key }, aad) });
      return res.status(200).json({ ok: true, key, exp: now + PH_KEY_TTL, api: 'studio' });
    }
    if (op === 'rate') {
      // 25/10/2026: המשוב שלך על התרגום — 👍/👎, מה לא היה טוב (קודים) והכתוביות שסימנת בנגן. שדה שלא נשלח — נשאר כמו שהיה
      if (job.kind !== 'tr' || st !== 'done') return res.status(409).json({ ok: false, error: 'state' });
      const hasR = body.r !== undefined, hasC = body.c !== undefined;
      if ((!hasR && !hasC) || (hasR && ![1, -1, 0].includes(body.r)) || (hasR && body.w !== undefined && !Array.isArray(body.w))
        || (hasC && !Array.isArray(body.c)) || (hasC && body.c.length > S.RATE_FLAG_MAX)) return res.status(400).json({ ok: false, error: 'bad_params' });
      const cur = S.normRate(job.urt) || { r: 0 };
      const urt = S.normRate({ r: hasR ? body.r : cur.r, w: hasR ? body.w : cur.w, c: hasC ? body.c : cur.c, at: now });
      await patchJob(deps, job.id, { urt });
      job.urt = urt;
      await learnSave(deps, job, now);
      return res.status(200).json({ ok: true, urt });
    }
    if (op === 'learnUx') {
      // מ׳3: מה קרה אחרי העבודה — צפייה, הורדות ושיתוף, הצעות, גיליון ה־AI, מונחים (תוספת מספרים; LR.normUx)
      if (job.kind !== 'tr') return res.status(409).json({ ok: false, error: 'state' });
      const ux = LR.mergeUx(job.ux, body.ux);
      if (!LR.normUx(body.ux)) return res.status(400).json({ ok: false, error: 'bad_params' });
      await patchJob(deps, job.id, { ux });
      job.ux = ux;
      await learnSave(deps, job, now);
      return res.status(200).json({ ok: true });
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
      const ux = body.pe ? LR.mergeUx(job.ux, { e: Object.assign({}, body.pe, { s: 1 }) }) : null;   // מ׳3: מה השתנה בשמירה הזו (מספרים)
      if (ux) up.ux = ux;
      await patchJob(deps, job.id, Object.assign({}, up, { updated: now }));
      Object.assign(job, up);
      await learnSave(deps, job, now);   // עריכה אחרי העבודה = סימן למה שהתרגום פספס
      if (body.pt) await learnEditPut(deps, job, body.pt, now);   // מ׳3: הטקסט לפני/אחרי — רק עם ההסכמה לתוכן
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
      if (job.sx > 0) return res.status(409).json({ ok: false, error: 'src_gone' });   // 26/10/2026: סרטון המקור נמחק (יום מפתיחת הפרויקט)
      if ((await readStats(deps, uid)).halt) return res.status(409).json({ ok: false, error: 'halted' });
      const all = (await listJobs(deps, uid)).filter((j) => j.kind !== 'ping');
      if (all.some((j) => j.kind === 'rr' && j.rp === job.id && S.ACTIVE.includes(S.effState(j, now).state))) return res.status(409).json({ ok: false, error: 'rr_busy' });
      if (all.filter((j) => S.ACTIVE.includes(S.effState(j, now).state)).length >= S.maxActive(isAdmin(user))) return res.status(409).json({ ok: false, error: 'too_many' });
      const prv = body.prv === true;                 // סבב 10: צריבה לבדיקה מחליפה רק בדיקה קודמת (לא את ההפקה המלאה), ולהפך
      for (const old of all.filter((j) => j.kind === 'rr' && j.rp === job.id && !!(j.spec && j.spec.prv) === prv && S.FINAL.includes(S.effState(j, now).state))) await delDoc(deps, 'studioJobs', old.id);   // רק ההפקה האחרונה נשמרת
      const r = S.rrJob(job, body, S.newJobId(), uid, now);
      await patchJob(deps, r.id, r);
      return res.status(200).json({ ok: true, job: view(r) });
    }
    if (op === 'dxRun') {
      // 26/10/2026 (בקשת המשתמש): התוצרים מ־R2 לתיקייה שבחרת ב"הסרטונים שלי" ב־Drive — העובד בשרת מעתיק, הסרטון לא עובר
      // בטלפון. התיקייה נבדקת בגישה של הסטודיו (drive.file — רק תיקייה שהאפליקציה יצרה / שנבחרה בה)
      if (job.kind !== 'tr' || st !== 'done' || !SR.isFolder(job.folder) || !apiJob(job)) return res.status(409).json({ ok: false, error: 'state' });
      if ((await readStats(deps, uid)).halt) return res.status(409).json({ ok: false, error: 'halted' });
      const dx = S.normDx(body.dx, job.fo);
      if (!dx) return res.status(400).json({ ok: false, error: 'bad_params' });
      const t = await gdrive.accessToken(deps, uid);
      if (!t.ok) return res.status(200).json({ ok: false, error: t.error || 'gd_failed' });
      const r = await (deps.fetch || fetch)(DRIVE + dx.f + '?fields=id,name,mimeType,trashed,capabilities(canAddChildren)', { headers: { Authorization: 'Bearer ' + t.token } });
      let fm = null; try { fm = await r.json(); } catch (e) {}
      if (r.status !== 200 || !fm || fm.trashed || fm.mimeType !== 'application/vnd.google-apps.folder' || !(fm.capabilities && fm.capabilities.canAddChildren)) return res.status(200).json({ ok: false, error: 'dx_folder' });
      dx.n = S.dxName(fm.name || dx.n).slice(0, 120);
      const all = (await listJobs(deps, uid)).filter((j) => j.kind !== 'ping');
      if (all.some((j) => j.kind === 'dx' && j.rp === job.id && S.ACTIVE.includes(S.effState(j, now).state))) return res.status(409).json({ ok: false, error: 'dx_busy' });
      for (const old of all.filter((j) => j.kind === 'dx' && j.rp === job.id && S.FINAL.includes(S.effState(j, now).state))) await delDoc(deps, 'studioJobs', old.id);
      const d = S.dxJob(job, dx, S.newJobId(), uid, now);
      await patchJob(deps, d.id, d);
      return res.status(200).json({ ok: true, job: view(d) });
    }
    if (op === 'aiRun') {
      // מ7: גיליון ה־AI בהפעלה אחת — הבקשה כבר בתיקיית העבודה (הטלפון העלה); עבודה "חדשה" שמתחילים ב־start (אחרי אומדן ואישור בטלפון)
      if (job.kind !== 'tr' || st !== 'done' || !S.FILE_ID_RE.test(String(job.folder || ''))) return res.status(409).json({ ok: false, error: 'state' });
      if ((await readStats(deps, uid)).halt) return res.status(409).json({ ok: false, error: 'halted' });
      const q = String(body.q || '');
      if (!S.FILE_ID_RE.test(q)) return res.status(400).json({ ok: false, error: 'bad_params' });
      const all = (await listJobs(deps, uid)).filter((j) => j.kind !== 'ping');
      if (all.some((j) => j.kind === 'ai' && j.rp === job.id && S.ACTIVE.includes(S.effState(j, now).state))) return res.status(409).json({ ok: false, error: 'ai_busy' });
      if (all.filter((j) => S.ACTIVE.includes(S.effState(j, now).state)).length >= S.maxActive(isAdmin(user))) return res.status(409).json({ ok: false, error: 'too_many' });
      const fq = await driveFileInFolder(deps, uid, job.folder, q);
      if (fq && fq.error) return res.status(200).json({ ok: false, error: fq.error });
      if (!fq || !(fq.size > 0 && fq.size <= S.AI_Q_MAX)) return res.status(400).json({ ok: false, error: 'file_bad' });
      for (const old of all.filter((j) => j.kind === 'ai' && j.rp === job.id && S.FINAL.includes(S.effState(j, now).state))) await delDoc(deps, 'studioJobs', old.id);
      const a = S.aiJob(job, fq, (await modeLocked(body.mode)) ? S.DEFAULT_MODE : body.mode, S.newJobId(), uid, now);   // מצב שסגור למשתמש → ברירת המחדל
      await patchJob(deps, a.id, a);
      return res.status(200).json({ ok: true, job: view(a) });
    }
    if (op === 'cpAnswer') {
      // סבב 10: העתק־הדבק — התשובה שהדבקת (קובץ שהטלפון העלה לתיקיית העבודה) לבקשה הנוכחית, פעם אחת
      if (st !== 'queued' && st !== 'running') return res.status(409).json({ ok: false, error: 'state', job: view(job) });
      const n = Number(body.n), f = String(body.f || '');
      if (!job.cp || job.cp.n !== n || job.cp.a) return res.status(409).json({ ok: false, error: 'cp_seq', job: view(job) });
      if (!S.FILE_ID_RE.test(f) || !job.folder) return res.status(400).json({ ok: false, error: 'bad_params' });
      const m = await driveFileInFolder(deps, uid, job.folder, f);
      if (m && m.error) return res.status(200).json({ ok: false, error: m.error });
      if (!m || !(m.size > 0 && m.size <= S.CP_FILE_MAX)) return res.status(400).json({ ok: false, error: 'file_bad' });
      const patch = { cp: Object.assign({}, job.cp, { a: f, as: Math.floor(m.size), ad: now }), updated: now };
      await patchJob(deps, job.id, patch);
      return res.status(200).json({ ok: true, job: view(Object.assign({}, job, patch)) });
    }
    if (op === 'answer') {
      // תשובה לשאלה של Claude — פעם אחת, לשאלה הנוכחית בלבד, כל עוד העבודה רצה
      // 20/10/2026: שאלה שלא עוצרת את העבודה (nb) — אפשר לענות גם אחרי שהעבודה הסתיימה (ההצעה לתקן בסוף)
      if (st !== 'queued' && st !== 'running' && !(job.qa && job.qa.nb === 1 && job.kind === 'tr')) return res.status(409).json({ ok: false, error: 'state', job: view(job) });
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
    if (op === 'sty') {
      // 26/10/2026 (בעקבות Vid Hub): עיצוב הכתוביות גם בזמן שהעבודה רצה — העובד שואל לפני כל בנייה (op qa → sty).
      // רק מספרים וקודים (normSty); null = ברירת המחדל. בלי updated — זה לא התקדמות של העבודה
      if (job.kind !== 'tr' || (st !== 'new' && st !== 'queued' && st !== 'running')) return res.status(409).json({ ok: false, error: 'state', job: view(job) });
      if (body.sty !== null && (typeof body.sty !== 'object' || Array.isArray(body.sty))) return res.status(400).json({ ok: false, error: 'bad_params', job: view(job) });
      const sty = S.normSty(body.sty);
      const spec = Object.assign({}, job.spec);
      if (sty) spec.sty = sty; else delete spec.sty;
      await patchJob(deps, job.id, { spec });
      job.spec = spec;
      return res.status(200).json({ ok: true, job: view(job) });
    }
    if (op === 'resume') {
      if (body.mode != null && await modeLocked(body.mode)) return res.status(403).json({ ok: false, error: 'mode_locked', job: view(job) });   // "להמשיך במצב זול יותר" — רק למצב פתוח
      if (await engLocked(job.spec)) return res.status(403).json({ ok: false, error: 'eng_locked', job: view(job) });   // 25/10/2026: המשך של עבודת Routine ישנה
      const r = await doResume(deps, uid, job, now, body, false, isAdmin(user));
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
    if (op === 'upTel') {
      // 21/10/2026: מדידת ההעלאה מהטלפון (מספרים בלבד) — לאבחון "הקול לקח 17 דק׳". הטלפון שולח את כל המצטבר; דורס
      const tl = S.normUtl(body.tl);
      if (!tl || job.kind !== 'tr') return res.status(400).json({ ok: false, error: 'bad_params' });
      if (limited('ut|' + uid, 30)) return res.status(429).json({ ok: false, error: 'rate_limited' });
      await patchJob(deps, job.id, { utl: tl });          // בלי updated — הוא השעון של "נתקעה" (isStale), והטלפון לא אומר שהעובד חי
      // 25/10/2026 (מיפוי האיסוף): הרשומה במאגר נשמרת בסוף העבודה — מדידה שמגיעה אחרי הסוף (הסרטון סיים לעלות אחרי done)
      // לא נכנסה אליה עד השמירה הבאה, שלפעמים לא הגיעה
      if (S.FINAL.includes(st)) await learnSave(deps, Object.assign({}, job, { utl: tl }), now);
      return res.status(200).json({ ok: true });
    }
    if (op === 'cancel') {
      await closeJobOps(deps, uid, job.id, now);
      if (job.rw) { await patchJob(deps, job.id, { rw: 0, updated: now }); job.rw = 0; }   // v368: "בטל" גם עוצר את ההמשך האוטומטי
      if (!S.FINAL.includes(st)) {
        await patchJob(deps, job.id, { state: 'cancelled', ended: now, updated: now });
        job.state = 'cancelled'; job.ended = now;
        await learnSave(deps, job, now);
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
module.exports._reset = () => { hits.clear(); jobMem = { users: new Map(), sync: 0, dirty: false }; cfgC = { at: 0, v: null }; lastLw = 0; lastGc = 0; srcSoon = new Map(); _upd = { at: 0, sha: '', t: 0 }; updWaitAt = 0; srvAuthMem.clear(); orphanAt.clear(); monCfgC = { at: 0, v: null };
  incSeen.clear(); learnMem = null; provC = { at: 0, v: null }; aoCache.clear(); };   // 26/10/2026: המטמונים של מכסת Firestore
module.exports._updatePending = updatePending;
module.exports._updWaiting = (job, now, at) => { if (at != null) updWaitAt = at; return updWaiting(job, now); };
module.exports._jobMem = { listJobs, patchJob, delDoc, JM_TTL_MS, JM_FULL_MS };
