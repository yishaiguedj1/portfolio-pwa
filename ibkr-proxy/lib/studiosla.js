'use strict';
/* v377: יעדי שירות (SLA), ערך ותחזית — מגדל הפיקוח 2.0. טהור, בלי טוקנים ובלי קריאות; הכל נגזר מרשומות העבודות.
   יעד זמן = ההערכה שראית בהתחלה (אותה טבלה של מסך ההתקדמות); יעד תקציב = הצפוי לפי "הרגיל" שלך בזמן הלקיחה.
   השעון רץ מהלקיחה הראשונה ועוצר כשמחכים לך (שאלה / שער), כשמחכים לסרטון מהטלפון, ובין כישלון ל"המשך". */

const ETA = require('./studioeta');
const STAGES = ['tr', 'al', 'tl', 'rv', 'bn', 'sv'];
// זהה ל־RATE ב־studionet.js (דקות עבודה לכל דקת סרטון; התרגום והבדיקה לפי המצב) — tests/studio-v377 משווה
const RATE = { tr: 8 / 77, al: 5 / 77, tl: 50 / 77, rv: 12 / 77, bn: 23 / 77, sv: 3 / 77 };
// זהה ל־min של MODES ב־studio.js
const MODE_MIN = { 'sonnet-medium': 85, 'haiku-medium': 70, 'haiku-high': 76, 'sonnet-high': 95, 'opus-medium': 105 };
const MARKS = [0.5, 0.75];                  // הסימונים על השעון, כמו ב־ServiceNow
const HP_DEF = 5;                           // החלטה 5: מחיר מתרגם אנושי לדקת סרטון (משנים בדף הערך)
const HP_MIN = 0.5, HP_MAX = 100;
const DAY = 86400000;

/* הסקירה (10/10/2026): הצפי של העבודה = מודל זמנים אחד (studioeta) — ep שנקבע בלקיחה, ואם אין — ה־prior של המנוע.
   הטבלה הישנה (stageTargets, דקות לכל דקת סרטון) נשארת רק כמראה של stageEstimates בטלפון; בסרטון קצר היא טעתה פי 5–6 */
function planOfJob(job) {
  const ep = ETA.normEp(job && job.ep);
  if (ep) return ep.s;
  const sp = (job && job.spec) || {};
  return ETA.planOf(ETA.PRIOR[job && job.eng === 'api' ? 'a' : 'r'], sp.mode, sp.dur).s;
}
/* יעד הזמן לכל שלב, בשניות (כמו stageEstimates בטלפון) */
function stageTargets(mode, dur) {
  const durMin = (dur > 0 ? dur : 3600) / 60, k = (MODE_MIN[mode] || 105) / 105;
  const out = {};
  for (const s of STAGES) out[s] = Math.round(RATE[s] * durMin * (s === 'tl' || s === 'rv' ? k : 1) * 60);
  return out;
}
/* היעדים של העבודה — נקבעים פעם אחת, בלקיחה הראשונה. ph = "הרגיל" לשעת סרטון (נלמד או ברירת המחדל), fixed = עלות הפתיחה */
function targets(spec, ph, fixed) {
  if (!spec || !(spec.dur > 0)) return null;
  const st = planOfJob({ spec, eng: spec.eng });     // ברירת מחדל; בלקיחה הקריאה דורסת ב־etaTarget(ep) — p90 של העבודה
  const t = STAGES.reduce((a, s) => a + st[s], 0);
  const u = ph > 0 ? Math.round((ph * spec.dur / 3600 + (fixed || 0)) * 100) / 100 : 0;
  return { t, u };
}
/* כמה מהעבודה נעשה (0–1), לפי משקל השלבים: שלבים שהסתיימו + השלב הנוכחי לפי האחוז שלו */
function progFrac(job) {
  if (job && job.state === 'done') return 1;
  const prog = (job && job.prog) || {}, stg = prog.stg || {};
  let all = 0, done = 0;
  const ep = planOfJob(job);                 // משקל לפי הצפי של העבודה (studioeta)
  for (const s of STAGES) {
    const w = ep[s] > 0 ? ep[s] : RATE[s];
    all += w;
    if (stg[s] && stg[s].e) done += w;
    else if (s === prog.st && stg[s]) done += w * Math.max(0, Math.min(1, +prog.p || 0));
  }
  return all ? Math.max(0, Math.min(1, done / all)) : 0;
}
/* זמן ההמתנה לשאלה / לשער (מהשאלה עד התשובה, או עד עכשיו) */
function qaPause(qa, now) {
  if (!qa || !qa.at) return 0;
  const end = qa.a && qa.a.at ? qa.a.at : now;
  return Math.max(0, end - qa.at);
}
const TERMINAL = ['done', 'failed', 'cancelled'];
/* השעון: מהלקיחה הראשונה (c0) עד עכשיו / הסוף, פחות ההמתנות */
function clock(job, now) {
  const c0 = job.c0 || job.claimed || 0;
  if (!c0) return { el: 0, pz: 0, paused: false };
  const end = TERMINAL.includes(job.state) && job.ended ? job.ended : now;
  const open = job.qa && job.qa.at && !(job.qa.a && job.qa.a.at);
  const wv = job.wv0 && !TERMINAL.includes(job.state) ? Math.max(0, now - job.wv0) : 0;
  const pz = Math.max(0, (job.pz || 0) + qaPause(job.qa, end) + wv);
  return { el: Math.max(0, end - c0 - pz), pz, paused: !!(open || job.wv0) && !TERMINAL.includes(job.state) };
}
const usdOf = (use) => Math.round((Array.isArray(use) ? use : []).reduce((s, r) => s + (r && typeof r.usd === 'number' ? r.usd : 0), 0) * 100) / 100;
/* רמה: ok / half (עברנו 50%) / risk (75% והעבודה מפגרת) / over (הפרה). עבודה שהסתיימה: met / over */
function level(f, pf, done) {
  if (done) return f > 1 ? 'over' : 'met';
  if (f >= 1) return 'over';
  if (f >= MARKS[1] && pf < f) return 'risk';
  if (f >= MARKS[0]) return 'half';
  return 'ok';
}
/* היעדים של עבודה אחת — לטלפון (null = אין יעד: אין אורך, עוד לא נלקחה, או לא עבודת תרגום) */
function slaView(job, now) {
  if (!job || job.kind !== 'tr' || !job.tg || !(job.tg.t > 0)) return null;
  const c = clock(job, now);
  if (!(job.c0 || job.claimed)) return null;
  const done = job.state === 'done', pf = progFrac(job);
  const ft = c.el / 1000 / job.tg.t;
  const out = { t: { tg: job.tg.t, el: Math.round(c.el / 1000), pz: Math.round(c.pz / 1000), f: Math.round(ft * 100) / 100, lv: level(ft, pf, done), paused: c.paused }, pf: Math.round(pf * 100) / 100 };
  if (job.tg.u > 0) {
    // העלות: מהדיווח של העובד (בסוף / בעצירה), ובזמן הריצה — מה שהמגדל מדד
    const sp = Math.max(usdOf(job.use || job.use0), job.tw && typeof job.tw.usd === 'number' ? job.tw.usd : 0);
    const fu = sp / job.tg.u;
    out.u = { tg: job.tg.u, sp: Math.round(sp * 100) / 100, f: Math.round(fu * 100) / 100, lv: level(fu, pf, done) };
  }
  return out;
}
/* הפרות לעבודה שרצה — לאירועים (P3, בסיכום היומי). עבודה שהסתיימה — סוף העבודה סוגר את ההתראות */
function slaBreaches(job, now) {
  const v = slaView(job, now);
  if (!v || TERMINAL.includes(job.state)) return [];
  const out = [];
  if (v.t.lv === 'over') out.push({ c: 'claude', k: 'sla_time' });
  if (v.u && v.u.lv === 'over') out.push({ c: 'claude', k: 'sla_cost' });
  return out;
}

/* מחיר מתרגם אנושי לדקה — בסנטים (Firestore שומר כאן שלמים) */
function normPrice(v) {
  const n = Number(v);
  return Number.isFinite(n) && n >= HP_MIN && n <= HP_MAX ? Math.round(n * 100) : 0;
}
const monthKey = (now) => new Date(now).toISOString().slice(0, 7);
/* ערך ועלות החודש + תחזית, צוואר הבקבוק ומסלולים חריגים (30 יום) */
function valueView(list, now, hpc) {
  const hp = hpc > 0 ? hpc / 100 : HP_DEF;
  const mk = monthKey(now);
  const jobs = (Array.isArray(list) ? list : []).filter((j) => j && j.kind === 'tr');
  const month = jobs.filter((j) => j.state === 'done' && j.ended && monthKey(j.ended) === mk && j.spec && j.spec.dur > 0);
  const min = month.reduce((a, j) => a + j.spec.dur / 60, 0);
  const priced = month.filter((j) => Array.isArray(j.use) && j.use.length && j.use.every((r) => typeof r.usd === 'number'));
  const usd = priced.reduce((a, j) => a + usdOf(j.use), 0);
  const pmin = priced.reduce((a, j) => a + j.spec.dur / 60, 0);
  const cpm = pmin > 0 ? usd / pmin : null;
  const d = new Date(now), dim = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  const elapsed = (now - Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)) / DAY;
  // תחזית: הקצב של החודש עד היום × ימי החודש. פחות משלושה ימים — מעט מדי נתונים, בלי תחזית
  const fc = usd > 0 && elapsed >= 3 ? Math.round(usd / elapsed * dim * 100) / 100 : null;
  const out = {
    m: mk, n: month.length, min: Math.round(min * 10) / 10, usd: Math.round(usd * 100) / 100,
    cpm: cpm == null ? null : Math.round(cpm * 1000) / 1000, hp, hpd: !(hpc > 0),
    saved: cpm == null ? null : Math.round((pmin * hp - usd) * 100) / 100, fc,
  };
  // צוואר הבקבוק (30 יום): השלב שלקח הכי הרבה מהזמן, וכמה מעל הצפוי
  const recent = jobs.filter((j) => j.state === 'done' && j.ended && now - j.ended <= 30 * DAY && j.spec && j.spec.dur > 0 && j.prog && j.prog.stg);
  const act = {}, exp = {};
  for (const j of recent) {
    const tgs = planOfJob(j);                 // מול הצפי של העבודה, לא מול הטבלה הישנה
    for (const s of STAGES) {
      const g = j.prog.stg[s];
      if (!g || !g.s || !g.e || g.e < g.s) continue;
      act[s] = (act[s] || 0) + (g.e - g.s) / 1000;
      exp[s] = (exp[s] || 0) + tgs[s];
    }
  }
  const tot = Object.values(act).reduce((a, x) => a + x, 0);
  if (recent.length && tot > 0) {
    const s = STAGES.filter((x) => act[x]).sort((a, b) => act[b] - act[a])[0];
    out.bn = { s, sh: Math.round(act[s] / tot * 100) / 100, x: exp[s] > 0 ? Math.round(act[s] / exp[s] * 10) / 10 : null, n: recent.length };
  }
  // מסלולים חריגים (30 יום): עבודות שעברו "המשך" או שחיכו לתשובה שלך
  const r30 = jobs.filter((j) => (j.ended || j.updated || 0) && now - (j.ended || j.updated) <= 30 * DAY && j.state !== 'new');
  out.ab = { n: r30.length, rs: r30.filter((j) => (j.fires || 0) > 1).length, qa: r30.filter((j) => (j.qn || 0) + (j.gn || 0) > 0).length };
  return out;
}

module.exports = {
  STAGES, RATE, MODE_MIN, MARKS, HP_DEF, HP_MIN, HP_MAX,
  stageTargets, targets, progFrac, qaPause, clock, slaView, slaBreaches, normPrice, valueView,
};
