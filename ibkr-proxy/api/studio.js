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
const { verifyIdToken, datastoreToken, isAdmin, emails } = require('../lib/gauth');
const SW = require('../lib/sitewatch');
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
const R2 = require('../lib/r2');   // ת4: האחסון ב־Cloudflare R2
const BK = require('../lib/backup');
const OFF = require('../lib/offsite');   // 11/10/2026: גיבוי אצל ספק שני — ל־Google Drive של המנהל (הגישה דרך הלקוח של הספרייה, בתוך offsite.js)
const LM = require('../lib/libmgr');   // ס׳9: הניקוי היומי של הספרייה   // ת7: גיבוי יומי ל־R2
const SR = require('../lib/studior2');   // ת4: הקבצים של הסטודיו ב־R2 (תיקייה R2_<עבודה>, מזהה <תיקייה>_<אקראי>)
const W = require('../lib/webpush');   // שלב 4 בסטודיו: התראות לטלפון (Web Push עצמאי)
const SLO = require('../lib/studioslo');   // v383: תקציב שגיאות
const AN = require('../lib/studioanom');   // v385: ציון חריגה 0–10
const LR = require('../lib/studiolearn');
const LC = require('../lib/learncorpus');
const DL = require('../lib/devlog');   // 15/10/2026: האיסוף המלא בתקופת הפיתוח (הדגל learn_full) — לוגים, יומן הקריאות, מדדים, שגיאות מהטלפון
const SF = require('../lib/sysflags');   // 15/10/2026: מצב תחזוקה והגדרות ודגלים (sysCfg/main)   // 15/10/2026 (מ׳2): קורפוס הטקסט — לדלי נפרד snb-learn
const AICACHE = require('../lib/aicache');   // 15/10/2026: התקרות היומיות של ה־AI (limits) — למסך AI ועלויות
const AO = require('../lib/adminov');   // 15/10/2026: מרכז הניהול — הסקירה, "מחכה לך" ו"מה רץ איפה"   // 14/10/2026: מאגר הלמידה — רשומה אנונימית לכל עבודה + לוח הבקרה של המנהל
const A = require('../lib/studioagents');   // v373: מלאי הסוכנים   // v371: תקלות, שורש סביר ותקלה רחבה

const PROJECT = () => process.env.FIREBASE_PROJECT_ID || 'yishaiguedj1-c786e';
const BASE = () => 'https://firestore.googleapis.com/v1/projects/' + PROJECT() + '/databases/(default)/documents';
const DRIVE = 'https://www.googleapis.com/drive/v3/files/';
const UID_RE = /^[A-Za-z0-9]{6,128}$/;
const AAD = (uid) => 'studio|' + uid + '|r';
const WORKER_OPS = new Set(['claim', 'token', 'report', 'qa', 'r2get', 'r2wup', 'r2wparts', 'r2wdone', 'r2del', 'learnPut', 'learnMedia', 'learnMediaDone']);
const SERVER_OPS = new Set(['poll', 'beat', 'devLog', 'devMet']);   // devLog/devMet — האיסוף המלא (lib/devlog.js)
/* מצב API: תקציב חודשי לכל משתמש (מפתח ה־API של המערכת). מעבר לזה — התקרה ב־Console של Anthropic */
const LEARN_MAX = 5000, LEARN_SYNC_MAX = 400;   // מאגר הלמידה: כמה רשומות קוראים, וכמה משלימים בכל פתיחה של לוח הבקרה
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
  return AO.readyView({ now, cache, builds, sess, links: nl, api: { main: !!(main && main.s === 200), fb: !!(fb && fb.s === 200) }, sec: sm ? sm[1] : null });
}
/* התשובות לבדיקות בטלפון (sysChecks) — { id: { st, n, at } } */
async function checkAnswers(deps) {
  const l = await query(deps, 'sysChecks', null, 300).catch(() => []);
  const o = {}; for (const x of l) o[x.id] = { st: x.st, n: x.n || '', at: x.at || 0, t: x.t || '' };
  return o;
}
async function learnLoad(deps, now) {
  const docs = await query(deps, 'studioLearn', null, LEARN_MAX);
  const have = new Map(docs.map((d) => [d.id, d]));
  let wrote = 0;
  const offs = new Map();
  for (const j of await query(deps, 'studioJobs', null, LEARN_MAX)) {
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
    return res.status(200).json({ ok: true, v: LR.LR_V, at: now, brief: LR.learnBrief(view, now), view, records: recs, checks, corpus });
  } catch (e) {
    return res.status(502).json({ ok: false, error: /^fs_http_/.test(String(e.message)) ? String(e.message).slice(0, 20) : 'failed' });
  }
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
const LEARN_REMOTE_OPS = new Set(['learnForget', 'learn']);
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
    for (const it of keys.filter((k) => (LC.parseKey(k.key) || {}).kind === 'c').sort((a, b) => (a.key < b.key ? 1 : -1)).slice(0, Math.min(items, 20))) {
      const p = LC.parseKey(it.key);
      const x = vault.open(await R2.getText(c, rd, it.key, LC_MAX_BODY * 2), 'learn|' + p.lid);
      if (!x) continue;
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
async function learnFull(deps, job, st) {
  try {
    if (!(await flagOn(deps, 'learn_full')) || job.kind !== 'tr' || (await learnSkip(deps, job))) return false;
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
    const keys = all.filter((it) => { const p = DL.parseKey(it.key); return p && kinds.has(p.kind) && days.has(p.day); })
      .sort((a, b) => (a.key < b.key ? 1 : -1)).slice(0, DEV_PULL_MAX);
    const items = [];
    for (const it of keys) {
      const x = vault.open(await R2.getText(c, rd, it.key, 8 * 1024 * 1024), 'dev|' + it.key);
      if (!x || (job && x.job !== job)) continue;
      const p = DL.parseKey(it.key);
      items.push(Object.assign({ k: p.kind, day: p.day }, x));
    }
    return res.status(200).json({ ok: true, on, r2: true, at: now, stats: DL.devStats(all), items });
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
async function sysBlock(deps, job, now, auto, adm) {
  const d = await sysCfg(deps, now);
  if (SF.maintOn(d, now) && !adm) return { error: 'maint', msg: SF.normMsg(d.mtMsg), til: +d.mtTil || 0 };
  if (['tr', 'rr', 'ai'].includes(job.kind)) {
    const fl = apiJob(job) ? 'st_api' : 'st_routine';
    if (!SF.flagOn(d, fl)) return { error: 'flag_off', fl };
  }
  if (auto && !SF.flagOn(d, 'st_auto')) return { error: 'flag_off', fl: 'st_auto' };
  return null;
}
async function notify(deps, uid, kind, jobId, now) {
  try {
    if (!(await flagOn(deps, 'push', now))) return 0;   // הדגל "התראות לטלפון" כבוי
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
  // הסוד (אופציונלי) — של GitHub או של הקרון היומי של Vercel (CRON_SECRET, שולח אותו ככותרת Authorization)
  const secret = process.env.STUDIO_WATCH_SECRET, auth = String((req.headers || {}).authorization || '');
  if (secret && auth !== 'Bearer ' + secret && !(process.env.CRON_SECRET && auth === 'Bearer ' + process.env.CRON_SECRET)) return res.status(401).json({ ok: false });
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
  const ar = await recoverAll(deps, now).catch(() => -1);   // 14/10/2026: "המשך" אוטומטי גם כשהטלפון סגור
  const st = await siteWatch(deps, now).catch(() => -1);   // שלב 5: הכתובות עצמן (השרתון שלנו ושלוש האפליקציות)
  const bk = await dailyBackup(deps, now);   // ת7: הגיבוי היומי — תקלה בו לא מפילה את הניטור
  const ob = await offsiteBackup(deps, now).catch(() => -1);   // 11/10/2026: ועותק ב־Drive (ספק אחר)
  const aw = await adminWatch(deps, now).catch(() => -1);   // 15/10/2026: התראות למנהל — הגיבוי ובדיקת המוכנות
  const lc = await learnBatch(deps, now).catch(() => -1);   // 15/10/2026 (מ׳2): קורפוס הטקסט — האצווה היומית ומחיקה אחרי 24 חודשים
  const lw = await learnWeekly(deps, now).catch(() => -1);   // 20/10/2026 (מ׳7): הסיכום השבועי של המעבדה — התראה למנהל
  return res.status(200).json({ ok: true, down, ar, st, bk, ob, aw, lc, lw });
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
async function dailyBackup(deps, now) {
  const c = R2.config();
  if (!c.ok) return -1;
  const rd = r2deps(deps);
  try {
    const r = await BK.runBackup({
      listCol: (col, max) => fsListCol(deps, col, max),
      head: (k) => R2.head(c, rd, k), get: (k, max) => R2.getBuf(c, rd, k, max), put: (k, b, t) => R2.putBuf(c, rd, k, b, t),
      list: (p) => R2.list(c, rd, p, 2000), del: (k) => R2.del(c, rd, k),
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
  const cap = S.jobCap(job.spec, S.monthUsed(st.mu, now), USER_MONTH(), S.usdOf(job.use0));
  if (!cap) return { ok: false, error: capWhy(job, st, now) };
  await patchJob(deps, job.id, { state: 'queued', eng: 'api', sid: '', pk: 0, vw: 0, kh: '', kx: 0, fired: now, fires: (job.fires || 0) + 1,
    err: '', ed: '', warn: '', use: null, tw: null, sess: null, updated: now });
  return { ok: true };
}
/* למה אין תקציב להפעלה: התקרה של העבודה נוצלה בסשנים הקודמים (budget_cap — "המשך" במצב זול יותר / תקרה גבוהה יותר), או החודש */
const capWhy = (job, st, now) => (S.jobCap(job.spec, 0, USER_MONTH(), S.usdOf(job.use0)) ? 'month_cap' : 'budget_cap');
const apiJob = (job) => (job.kind === 'tr' || job.kind === 'rr' || job.kind === 'ai') && job.spec && job.spec.eng === 'api';   // מ2 · מ7: הפקה מחדש וגיליון ה־AI — באותו מנוע כמו המקור   // מ2: הפקה מחדש — באותו מנוע כמו המקור

async function server(req, res, body, deps) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });
  let len = 0; try { len = JSON.stringify(body).length; } catch (e) { len = 1e9; }
  if (len > (body.op === 'devLog' || body.op === 'devMet' ? DL.BODY_MAX : 4096)) return res.status(413).json({ ok: false, error: 'too_large' });
  const hd = req.headers || {};
  const m = /^Bearer (\S+)$/.exec(String(hd.authorization || hd.Authorization || ''));
  const p = m && S.parseServerToken(m[1]);
  if (!p) return res.status(401).json({ ok: false, error: 'no_auth' });
  if (limited('s|' + p.sid, 20)) return res.status(429).json({ ok: false, error: 'rate_limited' });
  const now = deps.now || Date.now();
  try {
    const srv = await readDocT(deps, 'studioServers', p.sid);   // _ut — הרישום של טוקן שנדחה בכתיבה בתנאי
    if (!srv || !S.serverMatches(srv, p.tok)) {
      if (srv) await badAuth(deps, srv, p.sid, now).catch(() => {});   // 15/10/2026: שרת קיים שהטוקן שלו נדחה — מדווחים, לא בשקט
      return res.status(401).json({ ok: false, error: 'no_auth', stop: true });
    }
    if (body.op === 'devLog' || body.op === 'devMet') return res.status(200).json({ ok: true, saved: await devSrv(deps, body, p.sid, now), now });   // האיסוף המלא
    const hb = S.normHb(body.hb);
    const seen = { seen: now, hb, updated: now };
    if (!(srv.seen > 0)) {
      // 15/10/2026: שרת שמתחבר בפעם הראשונה — התראה לטלפון (שרת שהוזמן אוטומטית עלה בלי שאף אחד ידע). כתיבה בתנאי: התראה אחת בלבד
      const first = await patchIf(deps, 'studioServers', p.sid, { seen: now, updated: now }, srv._ut).catch(() => false);
      if (first && UID_RE.test(String(srv.by || ''))) await notify(deps, srv.by, 'srv_new', '', now).catch(() => {});
    }
    if (srv.ba) { seen.ba = 0; await authBack(deps, srv, p.sid, now); }
    if (srv.dn) { seen.dn = 0; await serverBack(deps, srv, p.sid, now); }   // ת7: שרת שסומן "לא מדווח" חזר
    if (body.op === 'beat' || srv.paused) {
      await patchDoc(deps, 'studioServers', p.sid, seen);
      return res.status(200).json({ ok: true, job: null, paused: srv.paused === true, now });
    }
    // poll: העבודה הוותיקה ביותר שמחכה לשרת
    const qd = (await query(deps, 'studioJobs', { state: 'queued', eng: 'api', sid: '' }, 30)).sort((a, b) => (a.fired || 0) - (b.fired || 0));
    for (const job of qd) {
      if (!apiJob(job) || S.effState(job, now).state !== 'queued') continue;
      if (job.vw && !(job.fv && job.fv.id)) continue;   // 15/10/2026: מחכה לסרטון — לא תופסים שרת עד שהוא נרשם
      const st = await readStats(deps, job.uid);
      const cap = S.jobCap(job.spec, S.monthUsed(st.mu, now), USER_MONTH(), S.usdOf(job.use0));
      if (!cap) {
        // התקציב החודשי (או התקרה של העבודה) נגמר בזמן שהעבודה חיכתה — נכשלת, לא נלקחת
        await patchIf(deps, 'studioJobs', job.id, { state: 'failed', err: capWhy(job, st, now), ended: now, updated: now }, job._ut).catch(() => false);
        continue;
      }
      const key = S.newKey();
      const got = await patchIf(deps, 'studioJobs', job.id, { sid: p.sid, pk: now, vw: 0, capc: Math.round(cap * 100), kh: S.keyHash(key), kx: now + S.KEY_TTL, updated: now }, job._ut);
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
async function recoverAll(deps, now) {
  const failed = (await query(deps, 'studioJobs', { state: 'failed' }, 100)).filter((j) => j.kind === 'tr' && UID_RE.test(String(j.uid || '')));
  // תקלה רחבה מזוהה גם כשהטלפון סגור (syncInc) — רק למי שנכשלה לו עבודה ביממה האחרונה, עד 5 משתמשים בריצה
  const fresh = Array.from(new Set(failed.filter((j) => now - (j.ended || j.updated || 0) < 864e5).map((j) => j.uid))).slice(0, 5);
  for (const uid of fresh) await syncInc(deps, uid, await listJobs(deps, uid), now);
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
  if ((id || op !== 'up') && !SR.inFolder(id, folder)) return [400, { ok: false, error: 'bad_id' }];
  const rec = id ? await upRec(deps, id) : null;
  let out;
  if (op === 'up') out = await SR.upStart(c, rd, { uid, folder, id, size: body.size, type: body.type, name: body.name, rec, by, replace: by === 'worker' && body.replace === true });
  else if (op === 'parts') out = await SR.upParts(c, rd, { id, rec, up: body.up, uid });
  else if (op === 'done') out = await SR.upDone(c, rd, { id, rec, up: body.up, uid });
  else if (op === 'url') return [200, await SR.getUrl(c, rd, { uid, folder, id, by, name: body.name ? String(body.name) : '' })];
  else if (op === 'del') { await SR.delFile(c, rd, { uid, folder, id, rec }); if (rec) await delDoc(deps, 'studioUp', id).catch(() => null); return [200, { ok: true }]; }
  else return [400, { ok: false, error: 'bad_op' }];
  const fid = out.res.id || id;
  if (out.rec && fid) await patchDoc(deps, 'studioUp', fid, Object.assign({}, out.rec, { f: folder }));
  return [200, out.res];
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
  if (job.kind === 'tr' && Array.isArray(job.fo) && job.fo.some((o) => o && o.k === 'cues')) {   // מ2 · מ7: ההפקות מחדש וגיליונות ה־AI של העבודה הולכים איתה
    for (const r of (await listJobs(deps, uid)).filter((j) => (j.kind === 'rr' || j.kind === 'ai') && j.rp === job.id)) { await delDoc(deps, 'studioJobs', r.id); gone.push(r.id); }
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
      // 10/10/2026: התוכנית (p50 לכל שלב + אי־ודאות) מהמודל הנלמד; יעד הזמן = p90 + דקה ("חרגה" רק כשבאמת חריג)
      let ep = job.ep;
      if (job.kind === 'tr' && !ep && job.spec && job.spec.dur > 0) {
        ep = ETA.etaPlan(ETA.etaModel(stats.et, job.eng === 'api' ? 'a' : 'r', now), job.spec.mode, job.spec.dur);
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
      const full = job.kind === 'tr' && (await learnFull(deps, job, stats)) ? 1 : 0;   // האיסוף המלא: העובד שולח גם את קבצי הטקסט ואת יומן הקריאות
      return res.status(200).json({ ok: true, job: S.workerJob(job, nm, S.fbForWorker(stats.fb), stats.fm, stats.rl, gl), drive: await driveFor(), pir, full, now });
    }
    if (body.op === 'token') return res.status(200).json({ ok: true, drive: await driveFor(), now });
    if (body.op === 'learnPut') return res.status(200).json({ ok: true, saved: await learnPut(deps, job, body.lc, now), now });   // מ׳2
    if (body.op === 'learnMedia') return res.status(200).json(Object.assign({ ok: true, now }, (await learnMedia(deps, job, String(body.k || ''), now)) || { skip: true }));   // מ׳4
    if (body.op === 'learnMediaDone') return res.status(200).json({ ok: true, saved: await learnMediaDone(deps, job, String(body.k || '')), now });
    if (body.op.startsWith('r2')) {   // ת4: הקבצים של העבודה ב־R2 (קלט, תוצרים, נקודות שמירה)
      const op = { r2get: 'url', r2wup: 'up', r2wparts: 'parts', r2wdone: 'done', r2del: 'del' }[body.op];
      const [code, out] = await r2Files(deps, op, body, job.uid, job.folder, 'worker');
      return res.status(code).json(Object.assign({ now }, out));
    }
    if (body.op === 'qa') return res.status(200).json({ ok: true, qa: job.qa && job.qa.id ? { id: job.qa.id, g: job.qa.g || '', a: job.qa.a || null } : null, bx: job.bx || 0, cp: S.cpWorker(job.cp), now });   // סבב 10: גם העתק־הדבק (קריאה בלבד)
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
    if (body.wv === true && job.kind === 'tr') { if (!job.wv0) up.wv0 = now; }
    else if (job.wv0 && (body.st || body.done === true || body.fail === true)) { up.pz = (up.pz != null ? up.pz : job.pz || 0) + Math.max(0, now - job.wv0); up.wv0 = 0; }
    // Firestore שומר כאן מספרים שלמים — לכן סנטים (mucc), לא דולרים
    const spent = job.eng === 'api' && up.use ? S.usdOf(up.use) - (job.mucc || 0) / 100 : 0;
    if (spent > 0) up.mucc = Math.round(S.usdOf(up.use) * 100);
    if (parked && up.use) { up.use0 = up.use; up.use = null; }   // הסשן הבא מדווח מאפס — הסכום שלו מצטרף ל־use0 (כמו ב"המשך")
    if (job.kind === 'tr' && up.state === 'failed' && (job.ar || 0) < S.AUTO_RESUME_MAX) {
      // v368: תקלה חולפת (Drive / רשת) — חלון התאוששות, ואז "המשך" אוטומטי אחד
      let kinds = [];
      try { kinds = O.opsView(((await readDoc(deps, 'studioOps', job.uid)) || {}).al, now).open.filter((a) => a.j === id).map((a) => a.c + ':' + a.k); } catch (e) {}
      if (S.isTransient(up.err, kinds.concat(O.normEvents(body.ev).filter((e) => !e.ok).map((e) => e.c + ':' + e.k)))) up.rw = now + S.RECOVER_WAIT;
    }
    if (up.state === 'failed' && job.kind === 'tr') {
      // 14/10/2026: היסטוריית הכשלים של העבודה — גם עבודה שהצליחה אחרי "המשך" מלמדת על מה שנכשל בדרך (למאגר הלמידה)
      // 20/10/2026: קריסה — גם איפה בקוד (w, צורה קשיחה בלבד), כדי שאפשר יהיה לאבחן בלי מסוף
      const w = up.err === 'worker_crash' ? S.crashWhere(body.msg) : '';
      up.eh = (Array.isArray(job.eh) ? job.eh : []).concat([Object.assign({ e: up.err, s: (up.prog && up.prog.st) || '', at: now }, w ? { w } : {})]).slice(-10);
    }
    await patchJob(deps, id, up);
    if (up.state === 'done' || up.state === 'failed') await learnSave(deps, Object.assign({}, job, up), now);
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
      const kind = up.state === 'done' ? 'done' : up.state === 'failed' && !up.rw ? 'fail' : gateId ? 'gate' : body.ask != null && up.qa ? 'ask' : up.cp ? 'cp' : '';
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
  if (body.op === 'learnPull') return learnPull(req, res, body, deps);   // 14/10/2026: טוקן ניתוח (Claude Code)
  if (body.op === 'devPull') return devPull(req, res, body, deps);   // 15/10/2026: האיסוף המלא — לוגים, קריאות, מדדים, שגיאות (קריאה בלבד)
  if (guard(req, res)) return;
  if (body.op === 'cfg') {   // 15/10/2026: מצב התחזוקה והדגלים — לשלוש האפליקציות, בלי התחברות (רק מה שציבורי)
    if (limited('cfg|' + String(((req.socket || {}).remoteAddress) || ''), 30)) return res.status(429).json({ ok: false, error: 'rate_limited' });
    const now = deps.now || Date.now();
    return res.status(200).json({ ok: true, cfg: SF.publicCfg(await sysCfg(deps, now), now), now });
  }
  if (body.op === 'gdConfig') return res.status(200).json({ ok: true, clientId: gdrive.cfg().id, configured: gdrive.configured(), picker: !!S.pickerCfg(process.env, gdrive.cfg().id) });   // המזהה ציבורי · picker = האם מפתח ה־Picker נטען (רק כן/לא — לאבחון בלי התחברות)
  let user;
  try { user = await verifyIdToken(body.idToken, deps.verify || {}); } catch (e) { return res.status(401).json({ ok: false, error: 'no_auth' }); }
  if (!UID_RE.test(String(user.uid || ''))) return res.status(401).json({ ok: false, error: 'no_auth' });
  if (body.op === 'fbSend') {   // 15/10/2026: משוב מההגדרות של כל אפליקציה — כל משתמש מחובר (לא רק של Studio)
    if (limited('fb|' + user.uid, 3)) return res.status(429).json({ ok: false, error: 'rate_limited' });
    const now = deps.now || Date.now();
    const e = AO.fbEntry(body, user, now);
    if (!e) return res.status(400).json({ ok: false, error: 'bad_params' });
    try { await patchDoc(deps, 'sysFeedback', now.toString(36) + crypto.randomBytes(3).toString('hex'), e); } catch (err) { return res.status(503).json({ ok: false, error: 'store' }); }
    return res.status(200).json({ ok: true });
  }
  // 15/10/2026: מי שברשימת "כל המודלים" במרכז הניהול מקבל גם את הסטודיו (בלי לחכות לפתיחה לכולם / ל־STUDIO_USERS)
  if (!allowed(user) && !SF.amHas(await sysCfg(deps, deps.now || Date.now()), user)) return res.status(403).json({ ok: false, error: 'not_allowed' });
  if (limited('p|' + user.uid, 120)) return res.status(429).json({ ok: false, error: 'rate_limited' });
  if (body.op === 'devErr') return res.status(200).json({ ok: true, saved: await devErr(deps, user, body, deps.now || Date.now()) });   // שגיאות מהטלפון (האיסוף המלא)
  if (!vault.configured()) return res.status(503).json({ ok: false, error: 'vault_not_configured' });
  const uid = user.uid, op = String(body.op || ''), now = deps.now || Date.now();
  // 15/10/2026: מצבי התרגום — לכולם רק PUBLIC_MODES ("רגיל" / "ביצועים"); המנהל ומי שברשימת "כל המודלים" — הכל
  const fullModes = async () => isAdmin(user) || SF.amHas(await sysCfg(deps, now), user);
  const modeLocked = async (m) => !S.modeOk(S.modeNow(m), await fullModes());
  if ((op === 'status' || op === 'jobs') && watchDue(now)) await checkServers(deps, now, uid).catch(() => 0);
  if (op === 'status' && isAdmin(user)) await offsiteOwner(deps, uid).catch(() => {});   // 11/10/2026: בעל הגיבוי ב־Drive
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
    if (op === 'learn' || op === 'learnExport' || op === 'learnBrief') {
      // 14/10/2026: מאגר הלמידה — רק למנהל. learnExport = כל הרשומות (לניתוח מחוץ לאפליקציה), learnBrief = החבילה ל־Claude
      if (!isAdmin(user)) return res.status(403).json({ ok: false, error: 'not_admin' });
      const { recs, wrote } = await learnLoad(deps, now);
      if (op === 'learnExport') return res.status(200).json({ ok: true, v: LR.LR_V, at: now, records: recs });
      if (op === 'learnBrief') return res.status(200).json({ ok: true, v: LR.LR_V, at: now, brief: LR.learnBrief(LR.learnView(recs, now), now), records: recs });
      const corpus = await learnCorpusView(deps, 0).catch(() => ({ on: false, error: 'r2' }));   // מ׳2: רק המספרים
      const dev = await devView(deps, now).catch(() => ({ on: false, error: 'r2' }));             // מ׳6: האיסוף המלא — רק ספירות
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
      return res.status(200).json({ ok: true, push, ov: AO.overview(Object.assign({ now, servers: srvs, backup: bk, sites: sites ? { sd: sites.sd || '' } : null }, ext)) });
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
        stEnv: emails(process.env.STUDIO_USERS), am: SF.amList(await sysCfg(deps, now)), ibEnv: emails(process.env.IBKR_SYNC_USERS), counts }) });
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
        rl: S.normRules(st.rl), halt: st.halt || 0, api: await apiView(st), sc: await scFor(uid), eta: ETA.etaView(st.et, now),
        pk: S.pickerCfg(process.env, gdrive.cfg().id), lrn: !st.lo /* 14/10: המתג של מאגר הלמידה */, lra: +st.lra || 0, lrt: +st.lrt || 0, lrm: +st.lrm || 0 /* מ׳4 */, mf: await fullModes() /* 15/10: כל מצבי התרגום (המנהל / הרשימה) */, lrf: +st.lrf || 0 /* האיסוף המלא — הנוסח נקרא */, lf: +st.lf || 0 /* 15/10 (מ׳1): ההודעה נקראה / מתי נמחקו התרומות */, r2: !!R2.config().ok /* 11/10: האחסון שלנו מוגדר (המילון שם) */, now });   // בחירה מ־Drive (Picker) — רק כשהוגדר מפתח   // v367: החוקים ומתג החירום
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
    if (op === 'glossUrl') {
      // 11/10/2026: מילון המונחים ב־R2 — קישורים חתומים לקריאה ולכתיבה של הקובץ של המשתמש בלבד (gl/<uid>.tsv), לחמש דקות.
      // הקובץ עובר ישירות בין הטלפון ל־R2 (הגוף לשרתון מוגבל ל־4KB). בלי R2 — r2:false והטלפון נשאר ב־Drive
      const c = R2.config(), key = S.glKey(uid);
      if (!c.ok || !key) return res.status(200).json({ ok: true, r2: false });
      const rd = r2deps(deps);
      return res.status(200).json({ ok: true, r2: true, get: await R2.presign(c, rd, { method: 'GET', key, expires: 300 }),
        put: await R2.presign(c, rd, { method: 'PUT', key, expires: 300 }) });
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
    if (op === 'create') {
      const spec = S.normSpec(body.spec);
      if (!spec) return res.status(400).json({ ok: false, error: 'bad_spec' });
      if (!S.langReady(spec)) return res.status(400).json({ ok: false, error: 'lang_unsupported' });   // לפני ההעלאה, לא אחריה
      if (await modeLocked(spec.mode)) return res.status(403).json({ ok: false, error: 'mode_locked' });
      const sbc = await sysBlock(deps, { kind: 'tr', spec }, now, false, isAdmin(user));   // 15/10/2026: לפני שמעלים כמה GB
      if (sbc) return res.status(409).json(Object.assign({ ok: false }, sbc));
      const all = (await listJobs(deps, uid)).filter((j) => j.kind !== 'ping');
      if (all.filter((j) => S.ACTIVE.includes(S.effState(j, now).state)).length >= S.MAX_ACTIVE) return res.status(409).json({ ok: false, error: 'too_many' });
      for (const old of all.filter((j) => S.FINAL.includes(S.effState(j, now).state)).slice(S.MAX_STORED - 1)) { await learnSave(deps, old, now); await delDoc(deps, 'studioJobs', old.id); }
      const job = { id: S.newJobId(), uid, kind: 'tr', state: 'new', created: now, updated: now, spec };
      if (apiJob(job) && R2.config().ok) job.folder = SR.folderFor(job.id);   // ת4: עבודה במצב שרת — הקבצים ב־R2 (Routine נשאר ב־Drive)
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
      await learnSave(deps, job, now);
      return res.status(200).json({ ok: true, job: view(job) });
    }
    if (op === 'r2up' || op === 'r2parts' || op === 'r2done' || op === 'r2url') {
      // ת4: העלאה מהטלפון ל־R2 (בחלקים, עם המשך) וקישור צפייה / הורדה — רק בתיקייה של העבודה הזו
      const [code, out] = await r2Files(deps, op.slice(2), body, uid, job.folder, 'phone');
      return res.status(code).json(out);
    }
    if (op === 'file') {
      if (job.kind !== 'tr' || st !== 'new' && st !== 'queued' && st !== 'running') return res.status(409).json({ ok: false, error: 'state' });
      const which = body.which === 'v' ? 'v' : body.which === 'a' ? 'a' : '';
      const fid = String(body.id || ''), folder = String(body.folder || ''), ext = body.ext === true && which === 'v';   // ext: סרטון שבחרת ב־Drive (Picker) — נשאר במקומו
      if (!which || !S.FILE_ID_RE.test(fid) || !S.FILE_ID_RE.test(folder) || (job.folder && job.folder !== folder)) return res.status(400).json({ ok: false, error: 'bad_params' });
      if (SR.isFolder(folder) && !ext) {
        // ת4: קובץ ב־R2 — קיים, בתיקייה של העבודה, והסרטון בגודל של המקור (מקור מ־Drive — ext — נשאר ב־Drive, בבדיקה שלמטה)
        if (folder !== job.folder) return res.status(400).json({ ok: false, error: 'bad_params' });
        const m = await driveFileInFolder(deps, uid, folder, fid);
        if (m && m.error) return res.status(200).json({ ok: false, error: m.error });
        const f = m && S.normFile({ id: fid, name: m.name || (which === 'v' ? 'video' : 'audio'), size: m.size, mimeType: m.mime });
        if (!f) return res.status(400).json({ ok: false, error: 'file_bad' });
        if (which === 'v' && job.spec && f.size !== job.spec.size) return res.status(400).json({ ok: false, error: 'file_size' });
        f.at = now;
        await patchJob(deps, job.id, { ['f' + which]: f, updated: now });
        job['f' + which] = f;
        return res.status(200).json({ ok: true, job: view(job) });
      }
      // מאמתים מול Drive עצמו: הקובץ קיים, בתיקיית העבודה, והווידאו בגודל של המקור — העובד יוריד בדיוק את זה
      const t = await gdrive.accessToken(deps, uid);
      if (!t.ok) return res.status(200).json({ ok: false, error: t.error });
      const r = await (deps.fetch || fetch)(DRIVE + fid + '?fields=id,name,size,mimeType,parents,trashed', { headers: { Authorization: 'Bearer ' + t.token } });
      let meta = null; try { meta = await r.json(); } catch (e) {}
      if (r.status === 404) return res.status(400).json({ ok: false, error: 'file_missing' });
      if (r.status !== 200 || !meta) return res.status(502).json({ ok: false, error: 'drive_http_' + r.status });
      const f = S.normFile(meta);
      if (!f || meta.trashed || (ext ? !S.extVideoOk(meta) : !(Array.isArray(meta.parents) && meta.parents.includes(folder)))) return res.status(400).json({ ok: false, error: 'file_bad' });
      if (ext) f.ext = true;
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
      if (job.kind !== 'rr' && await modeLocked(job.spec && job.spec.mode)) return res.status(403).json({ ok: false, error: 'mode_locked', job: view(job) });   // גם עבודה שנוצרה לפני שהרשימה השתנתה / סט הזהב
      if (!S.WORKER_KINDS.includes(job.kind)) return res.status(200).json({ ok: false, error: 'worker_not_ready', job: view(job) });
      const sbs = await sysBlock(deps, job, now, false, isAdmin(user));   // 15/10/2026: תחזוקה / דגל כבוי
      if (sbs) return res.status(409).json(Object.assign({ ok: false, job: view(job) }, sbs));
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
      if ((await readStats(deps, uid)).halt) return res.status(409).json({ ok: false, error: 'halted' });
      const all = (await listJobs(deps, uid)).filter((j) => j.kind !== 'ping');
      if (all.some((j) => j.kind === 'rr' && j.rp === job.id && S.ACTIVE.includes(S.effState(j, now).state))) return res.status(409).json({ ok: false, error: 'rr_busy' });
      if (all.filter((j) => S.ACTIVE.includes(S.effState(j, now).state)).length >= S.MAX_ACTIVE) return res.status(409).json({ ok: false, error: 'too_many' });
      const prv = body.prv === true;                 // סבב 10: צריבה לבדיקה מחליפה רק בדיקה קודמת (לא את ההפקה המלאה), ולהפך
      for (const old of all.filter((j) => j.kind === 'rr' && j.rp === job.id && !!(j.spec && j.spec.prv) === prv && S.FINAL.includes(S.effState(j, now).state))) await delDoc(deps, 'studioJobs', old.id);   // רק ההפקה האחרונה נשמרת
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
    if (op === 'resume') {
      if (body.mode != null && await modeLocked(body.mode)) return res.status(403).json({ ok: false, error: 'mode_locked', job: view(job) });   // "להמשיך במצב זול יותר" — רק למצב פתוח
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
module.exports._reset = () => { hits.clear(); cfgC = { at: 0, v: null }; lastLw = 0; };
