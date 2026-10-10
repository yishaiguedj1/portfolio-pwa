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

/* הבדיקות, לפי הסדר במסך. c = קטגוריה: setup (הגדרה), sec (גישה), env (סביבה), clean (ניקיון) */
const CHECKS = [
  { k: 'claude', c: 'setup' },
  { k: 'drive', c: 'sec' },
  { k: 'quota', c: 'env' },
  { k: 'fires', c: 'env' },
  { k: 'budget', c: 'setup' },
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

module.exports = {
  DAY, GB, PEN, PASS, STALE_OK, OLD_JOB, QUOTA_LOW, QUOTA_CRIT, FIRES_WARN, MAX_FOLDERS, CHECKS, CHECK_KEYS, KINDS, CLEAN_KINDS,
  orphanFolders, dupeFolders, doneCheckpoints, oldJobs, scanFindings, scanView,
};
