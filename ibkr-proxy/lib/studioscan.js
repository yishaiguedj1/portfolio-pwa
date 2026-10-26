'use strict';
/* v378: בדיקת מוכנות ותחזוקה — מגדל הפיקוח 2.0 (כמו Instance Scan + CMDB Health של ServiceNow). טהור, בלי טוקנים.
   השרתון אוסף עובדות (החיבור ל־Claude, Drive, המכסה, התיקיות, העבודות) והקובץ הזה הופך אותן לממצאים:
   לכל ממצא עדיפות 1–5, קטגוריה, ופעולה אחת (מסך להגדרה / "נקה"). הציון = 100 פחות קנס לפי העדיפות.
   "נקה" אף פעם לא סומך על רשימה שמורה — השרתון סורק מחדש ברגע הניקוי, והמזהים לא יוצאים לטלפון. */

const DAY = 86400000;
const GB = 1024 * 1024 * 1024;
const PEN = { 1: 30, 2: 15, 3: 8, 4: 3, 5: 1 };          // קנס לכל עדיפות
const PASS = 70;                                         // כמו מדד האיכות: מ־70 "עובר"
const STALE_OK = 14 * DAY;                               // החיבור ל־Claude לא הצליח מזה שבועיים — כדאי לבדוק
const OLD_JOB = 90 * DAY;                                // עבודה שהסתיימה לפני יותר מזה — רשומה ישנה
const QUOTA_LOW = 5 * GB, QUOTA_CRIT = 1 * GB;           // מקום פנוי ב־Drive (סרטון של שעה ≈ 1–3GB)
const FIRES_WARN = 0.8;                                  // 80% ממכסת ההפעלות בשעה
const MAX_FOLDERS = 30;                                  // ניקוי — עד 30 תיקיות בכל פעם (זמן הפונקציה ב־Vercel)
const R2_GRACE = 3600000;                                // ת4: תיקייה ב־R2 שנגעו בה בשעה האחרונה — לא יתומה (מחיקה שעוד רצה)
const R2_FOLDER_RE = /^R2_j[A-Za-z0-9_-]{20}$/;          // = FOLDER_RE ב־lib/studior2.js

/* הבדיקות, לפי הסדר במסך. c = קטגוריה: setup (הגדרה), sec (גישה), env (סביבה), clean (ניקיון) */
const CHECKS = [
  { k: 'claude', c: 'setup' },
  { k: 'drive', c: 'sec' },
  { k: 'quota', c: 'env' },
  { k: 'fires', c: 'env' },
  { k: 'budget', c: 'setup' },
  { k: 'offsite', c: 'sec' },   // 11/10/2026: הגיבוי אצל ספק שני (Drive של המנהל) — רק למנהל
  { k: 'orphans', c: 'clean' },
  { k: 'dupes', c: 'clean' },
  { k: 'ck', c: 'clean' },
  { k: 'old', c: 'clean' },
];
const CHECK_KEYS = CHECKS.map((x) => x.k);
/* סוגי ממצא (k) → הבדיקה שהם שייכים לה + העדיפות. הטלפון מציג תווית לכל סוג (מחרוזות קבועות) */
const KINDS = {
  claude_missing: { ch: 'claude', p: 1 },     // אין Routine ואין שרת פעיל — אי אפשר לתרגם
  claude_untested: { ch: 'claude', p: 3 },    // מחובר, אבל בדיקת החיבור עוד לא עברה
  claude_stale: { ch: 'claude', p: 4 },       // הבדיקה האחרונה שעברה — לפני יותר משבועיים
  drive_cfg: { ch: 'drive', p: 1 },           // Drive של הסטודיו לא מוגדר בשרתון
  drive_missing: { ch: 'drive', p: 1 },       // לא מחובר
  drive_revoked: { ch: 'drive', p: 1 },       // הגישה בוטלה בחשבון Google
  drive_err: { ch: 'drive', p: 3 },           // לא הצלחנו לבדוק (תקלה רגעית)
  quota_crit: { ch: 'quota', p: 1 },
  quota_low: { ch: 'quota', p: 2 },
  fires_high: { ch: 'fires', p: 3 },
  budget_low: { ch: 'budget', p: 4 },         // התקציב לעבודה קטן מעבודה רגילה של שעה — כל עבודה ארוכה תיעצר לאישור
  offsite_none: { ch: 'offsite', p: 2 },      // הגיבוי ל־Drive עוד לא רץ / אין חיבור ל־Drive
  offsite_stale: { ch: 'offsite', p: 2 },     // הגיבוי האחרון ל־Drive — לפני יותר מיומיים
  orphans: { ch: 'orphans', p: 4 },           // תיקיות של עבודות שמחקת (הקבצים נשארו ב־Drive בכוונה — רק מציעים)
  dupes: { ch: 'dupes', p: 4 },               // כמה תיקיות לאותה עבודה
  ck: { ch: 'ck', p: 5 },                     // נקודות שמירה של עבודות שהסתיימו — כבר לא נחוצות
  old: { ch: 'old', p: 5 },                   // רשומות של עבודות שהסתיימו לפני יותר מ־90 יום
};
const CLEAN_KINDS = ['orphans', 'dupes', 'ck', 'old'];

/* תיקיות של עבודות שכבר לא ברשימה. folders = [{id, job, t}] (job = appProperties.snbJob), ids = מזהי העבודות הקיימות */
function orphanFolders(folders, ids) {
  const have = new Set(ids || []);
  return (Array.isArray(folders) ? folders : []).filter((f) => f && f.job && !have.has(f.job));
}
/* כמה תיקיות לאותה עבודה: נשארת זו שהעבודה מצביעה עליה (job.folder), ואם אין — הראשונה שנוצרה */
function dupeFolders(folders, jobs) {
  const keep = new Map((Array.isArray(jobs) ? jobs : []).filter((j) => j && j.folder).map((j) => [j.id, j.folder]));
  const by = new Map();
  for (const f of Array.isArray(folders) ? folders : []) if (f && f.job) { if (!by.has(f.job)) by.set(f.job, []); by.get(f.job).push(f); }
  const out = [];
  for (const [job, list] of by) {
    if (list.length < 2) continue;
    const k = keep.get(job) && list.some((f) => f.id === keep.get(job)) ? keep.get(job) : list.slice().sort((a, b) => (a.t || 0) - (b.t || 0))[0].id;
    out.push(...list.filter((f) => f.id !== k));
  }
  return out;
}
/* ת4: התיקיות ב־R2 מרשימת המפתחות (st/<uid>/<תיקייה>_<12>) → [{f, job, b, at}]. מפתח בצורה אחרת — לא נספר */
function r2Folders(items, uid) {
  const pre = 'st/' + uid + '/', by = new Map();
  for (const it of Array.isArray(items) ? items : []) {
    const k = String((it && it.key) || '');
    if (!k.startsWith(pre)) continue;
    const id = k.slice(pre.length), cut = id.lastIndexOf('_');
    if (cut < 0 || !/^[A-Za-z0-9]{12}$/.test(id.slice(cut + 1))) continue;
    const f = id.slice(0, cut);
    if (!R2_FOLDER_RE.test(f)) continue;
    const x = by.get(f) || { f, job: f.slice(3), b: 0, at: 0 };
    x.b += Number(it.size) || 0; x.at = Math.max(x.at, Number(it.at) || 0);
    by.set(f, x);
  }
  return [...by.values()];
}
/* יתומה ב־R2 = אף עבודה ברשימה לא משתמשת בתיקייה (עבודות משנה וסט הזהב יורשים אותה), ולא נגעו בה בשעה האחרונה */
function r2Orphans(folders, jobs, now) {
  const used = new Set((Array.isArray(jobs) ? jobs : []).filter((j) => j && j.folder).map((j) => j.folder));
  return (Array.isArray(folders) ? folders : []).filter((x) => x && !used.has(x.f) && now - (x.at || 0) > R2_GRACE);
}
/* נקודות שמירה של עבודות שהסתיימו בהצלחה (אי אפשר להמשיך עבודה שהסתיימה — הן רק תופסות מקום) */
function doneCheckpoints(jobs) {
  const out = [];
  for (const j of Array.isArray(jobs) ? jobs : []) {
    if (!j || j.kind !== 'tr' || j.state !== 'done' || !Array.isArray(j.ck)) continue;
    for (const c of j.ck) if (c && c.id) out.push({ job: j.id, id: c.id, size: Number(c.size) || 0 });
  }
  return out;
}
/* רשומות ישנות: הסתיימו לפני יותר מ־90 יום (הקבצים ב־Drive נשארים, כמו במחיקה רגילה) */
const FINAL = ['done', 'failed', 'cancelled'];
function oldJobs(jobs, now) {
  return (Array.isArray(jobs) ? jobs : []).filter((j) => j && j.kind === 'tr' && !j.gd && FINAL.includes(j.state) && (j.ended || j.updated || 0) > 0 && now - (j.ended || j.updated) > OLD_JOB);   // v387: עבודת זהב לא "ישנה"
}

/* הממצאים מהעובדות. f = {claude:{conn, ok, servers}, drive:{cfg, conn, err, free, total}, fires:{n, max}, budget:{b, need},
   clean:{orphans:{n,b}, dupes:{n,b}, ck:{n,b}, old:{n}}} — עובדה שחסרה (null) = הבדיקה לא רצה, לא ממצא */
function scanFindings(f, now) {
  f = f || {};
  const out = [], ran = new Set();
  const add = (k, extra) => out.push(Object.assign({ k, p: KINDS[k].p, ch: KINDS[k].ch }, extra || {}));
  const c = f.claude;
  if (c) {
    ran.add('claude');
    if (!c.conn && !(c.servers > 0)) add('claude_missing');
    else if (c.conn && !c.ok && !(c.servers > 0)) add('claude_untested');
    else if (c.conn && c.ok && now - c.ok > STALE_OK && !(c.servers > 0)) add('claude_stale', { d: Math.floor((now - c.ok) / DAY) });
  }
  const d = f.drive;
  if (d) {
    ran.add('drive');
    if (!d.cfg) add('drive_cfg');
    else if (d.err === 'revoked') add('drive_revoked');
    else if (d.err === 'not_connected') add('drive_missing');
    else if (d.err) add('drive_err');
    else if (!d.conn) add('drive_missing');
    if (d.cfg && d.conn && !d.err && d.free != null) {
      ran.add('quota');
      if (d.free < QUOTA_CRIT) add('quota_crit', { b: d.free });
      else if (d.free < QUOTA_LOW) add('quota_low', { b: d.free });
    }
  }
  if (f.fires && f.fires.max > 0) {
    ran.add('fires');
    if (f.fires.n >= Math.ceil(f.fires.max * FIRES_WARN)) add('fires_high', { n: f.fires.n, m: f.fires.max });
  }
  if (f.budget) {
    ran.add('budget');
    if (f.budget.b > 0 && f.budget.need > 0 && f.budget.b < f.budget.need) add('budget_low', { u: f.budget.b, need: Math.round(f.budget.need * 100) / 100 });
  }
  const o = f.offsite;   // { day: 'YYYY-MM-DD' של הגיבוי האחרון, err: קוד } — רק למנהל
  if (o) {
    ran.add('offsite');
    if (!o.day) add('offsite_none');
    else if (now - Date.parse(o.day + 'T00:00:00Z') > 2 * DAY + DAY) add('offsite_stale', { d: Math.floor((now - Date.parse(o.day + 'T00:00:00Z')) / DAY) });
  }
  const cl = f.clean;
  if (cl) {
    for (const k of CLEAN_KINDS) {
      if (!cl[k]) continue;
      ran.add(k);
      if (cl[k].n > 0) add(k, { n: cl[k].n, b: cl[k].b || 0 });
    }
  }
  out.sort((a, b) => a.p - b.p || CHECK_KEYS.indexOf(a.ch) - CHECK_KEYS.indexOf(b.ch));
  const s = Math.max(0, 100 - out.reduce((a, x) => a + PEN[x.p], 0));
  return { at: now, s, n: ran.size, ok: CHECK_KEYS.filter((k) => ran.has(k) && !out.some((x) => x.ch === k)), f: out,
    fb: cl ? CLEAN_KINDS.reduce((a, k) => a + (cl[k] && cl[k].b > 0 ? cl[k].b : 0), 0) : 0 };
}

/* הסריקה השמורה (studioOps.sc) — לטלפון. צורה קבועה; מה שלא תקין נזרק */
function scanView(sc) {
  if (!sc || typeof sc !== 'object' || !(sc.at > 0)) return null;
  const f = (Array.isArray(sc.f) ? sc.f : []).filter((x) => x && KINDS[x.k]).slice(0, 20).map((x) => {
    const o = { k: x.k, p: KINDS[x.k].p, ch: KINDS[x.k].ch };
    for (const n of ['n', 'b', 'd', 'm', 'u', 'need']) if (typeof x[n] === 'number' && Number.isFinite(x[n]) && x[n] >= 0) o[n] = x[n];
    return o;
  });
  return { at: sc.at, s: Math.max(0, Math.min(100, Math.round(Number(sc.s) || 0))), n: Math.max(0, Math.min(CHECKS.length, Number(sc.n) || 0)),
    ok: (Array.isArray(sc.ok) ? sc.ok : []).filter((k) => CHECK_KEYS.includes(k)), f, fb: Math.max(0, Number(sc.fb) || 0), pass: PASS };
}
/* 21/10/2026 (בקשת המשתמש): עבודה שהקבצים שלה ב־R2 שלנו נשמרת חודש מהסיום, ואז נמחקת לבד (רשומה + קבצים).
   לא נמחקות: עבודת זהב (gd — הייחוס לבדיקות), עבודה שעוד רצה, ועבודה שהקבצים שלה ב־Drive של המשתמש (שם הם שלו) */
const JOB_TTL = 30 * DAY;
/* 26/10/2026 (בקשת המשתמש): כמה זמן הקבצים של עבודה ב־R2 נשמרים — בלי אחסון כפול לחודש.
   הסרטון הצרוב וכל שאר העבודה: jobTtl מהסיום — ייצור 30 יום, סביבת הניסוי 7 — בלי קשר לפתיחה חוזרת של הפרויקט.
   ההפקות מחדש באותה תיקייה נספרות (endAt = הסיום האחרון בתיקייה — folderEnds), כדי שסרטון שנצרב מחדש יקבל את הימים שלו.
   סרטון המקור והקבצים שנגזרים ממנו (הקול, איכויות הצפייה, עותקי הקול, נקודות השמירה) — SRC_TTL מפתיחת הפרויקט (created),
   כדי לערוך ולצרוב מחדש באותו יום בלי להעלות שוב; ולא פחות מ־SRC_GRACE אחרי הסיום (עבודה ארוכה / שחיכתה לסרטון).
   אחרי המחיקה sx = מתי; הפקה מחדש, "המשך" וסט הזהב — לא אפשריים (src_gone). עבודת זהב והרצות שלה (gs) — לא נוגעים במקור */
const SRC_TTL = DAY, SRC_GRACE = 6 * 3600e3;
const STAGING_PROJECT = 'snowball-staging-758f6';
const jobTtl = (project) => (project === STAGING_PROJECT ? 7 : 30) * DAY;
const endOf = (j) => (j && (j.ended || j.updated)) || 0;
function folderEnds(jobs) {
  const m = new Map();
  for (const j of Array.isArray(jobs) ? jobs : []) if (j && j.kind !== 'dx' && R2_FOLDER_RE.test(String(j.folder || ''))) m.set(j.folder, Math.max(m.get(j.folder) || 0, endOf(j)));
  return m;
}
function expiredJob(j, now, ttl = JOB_TTL, endAt = 0) {
  const e = Math.max(endOf(j), endAt || 0);
  return !!(j && j.kind === 'tr' && !j.gd && FINAL.includes(j.state) && R2_FOLDER_RE.test(String(j.folder || ''))
    && e > 0 && now - e > ttl);
}
const srcDueAt = (j) => (j && (j.created || 0) > 0 ? Math.max(j.created + SRC_TTL, endOf(j) + SRC_GRACE) : 0);
/* המזהים של סרטון המקור והקבצים שנגזרים ממנו — רק בתיקייה של העבודה ב־R2 (מקור מ־Drive של המשתמש לא נוגעים בו) */
function srcFiles(j) {
  if (!j || !R2_FOLDER_RE.test(String(j.folder || ''))) return [];
  const ids = [j.fa && j.fa.id, j.fv && !j.fv.ext && j.fv.id];
  for (const k of ['hl', 'hla', 'ck']) for (const x of Array.isArray(j[k]) ? j[k] : []) ids.push(x && x.id);
  const pre = j.folder + '_';
  return Array.from(new Set(ids.filter((id) => typeof id === 'string' && id.startsWith(pre) && /^[A-Za-z0-9_-]{30,80}$/.test(id))));
}
/* מקור שעוד לא נמחק (עבודה שהסתיימה, ב־R2, לא זהב ולא הרצה של זהב) */
const srcPending = (j) => !!(j && j.kind === 'tr' && !j.gd && !j.gs && !(j.sx > 0) && FINAL.includes(j.state) && srcFiles(j).length > 0);
const srcExpired = (j, now) => srcPending(j) && srcDueAt(j) > 0 && now >= srcDueAt(j);
/* מה הטלפון רואה: עד מתי סרטון המקור (s, 0 = כבר נמחק / לא נמחק לבד) ועד מתי העבודה (j). רק לעבודה שהסתיימה ב־R2 */
function retention(j, project, endAt) {
  if (!j || j.kind !== 'tr' || j.gd || !FINAL.includes(j.state) || !R2_FOLDER_RE.test(String(j.folder || ''))) return null;
  const e = Math.max(endOf(j), endAt || 0);
  return { s: srcPending(j) ? srcDueAt(j) : 0, j: e > 0 ? e + jobTtl(project) : 0 };
}

module.exports = {
  JOB_TTL, expiredJob, SRC_TTL, SRC_GRACE, jobTtl, folderEnds, srcDueAt, srcFiles, srcPending, srcExpired, retention,
  DAY, GB, PEN, PASS, STALE_OK, OLD_JOB, QUOTA_LOW, QUOTA_CRIT, FIRES_WARN, MAX_FOLDERS, R2_GRACE, CHECKS, CHECK_KEYS, KINDS, CLEAN_KINDS,
  FINAL, orphanFolders, dupeFolders, r2Folders, r2Orphans, doneCheckpoints, oldJobs, scanFindings, scanView,
};
