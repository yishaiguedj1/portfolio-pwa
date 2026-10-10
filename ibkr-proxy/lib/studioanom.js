'use strict';
/* v385: ציון חריגה 0–10 (ServiceNow: Metric Intelligence) — מגדל הפיקוח 2.0. טהור, בלי טוקנים ובלי קריאות.
   לכל עבודה שהסתיימה: זמן לכל שלב **ביחס לצפי של העבודה** (studioeta — a + b·דקות; ‏ep שנקבע בלקיחה, ואם אין — ה־prior
   של המנוע) ועלות לכל סוכן (דולר לשעת סרטון). כך מודל זמנים אחד: "שניות לדקה" הניח שהכל יחסי לאורך, וסרטון קצר
   (קבוע טעינה גדול) נראה "איטי" בלי סיבה. הבסיס = העבודות הקודמות שלך
   (חציון + סטייה חציונית, MAD — עמיד לחריגים); הציון = כמה סטיות מעל הרגיל, 0–10. רק כלפי מעלה (איטי / יקר מהרגיל).
   קפיצה בודדת לא מתריעה: התראה רק כשמדד חריג (≥ HI) ב־2 מתוך 3 העבודות האחרונות (התמדה); התדירות = מתוך 5 האחרונות.
   נגזר מרשימת העבודות של op:'jobs' — בלי קריאה ובלי אחסון נוסף. */
const L = require('./studiosla');
const ETA = require('./studioeta');
const DAY = 86400e3;
const BASE_N = 5, BASE_MAX = 20, BASE_WIN = 90 * DAY;   // מינימום עבודות לבסיס; לכל היותר 20 אחרונות; 90 יום
const REL_MIN = 0.15;                                   // סטייה מינימלית = 15% מהחציון (בלי זה עבודות זהות → כל שינוי "חריג")
const HI = 6, PERSIST = [2, 3], FREQ_N = 5, RECENT = 10;
// המדדים: t:<שלב> = זמן, u:<סוכן> = עלות. רכיב = מי אחראי (לפי מפת השירות); m = הבסיס לפי אותו מצב תרגום
const METRICS = [
  { k: 't:tr', c: 'vt' }, { k: 't:al', c: 'vt' }, { k: 't:tl', c: 'claude' }, { k: 't:rv', c: 'claude' }   /* המצב כבר בצפי */,
  { k: 't:bn', c: 'vt' }, { k: 't:sv', c: 'drive' },
  // עלות: הבסיס לפי אותו מצב **ואותו מנוע** (e) — מעבר Routine ↔ השרת משנה את עלות מנהל העבודה בסדר גודל
  { k: 'u:main', c: 'claude', m: 1, e: 1 }, { k: 'u:tl', c: 'claude', m: 1, e: 1 }, { k: 'u:rv', c: 'claude', m: 1, e: 1 }, { k: 'u:jg', c: 'claude', m: 1, e: 1 },
];
const COMPS = ['vt', 'claude', 'drive'];

/* הערכים של עבודה שהסתיימה (מה שאין — חסר) */
function metricVals(j) {
  const out = {};
  if (!j || j.kind !== 'tr' || j.state !== 'done' || !j.spec || !(j.spec.dur > 0)) return out;
  const hr = j.spec.dur / 3600;
  const stg = (j.prog && j.prog.stg) || {};
  const ep = ETA.normEp(j.ep), plan = ep ? ep.s : ETA.planOf(ETA.PRIOR[j.eng === 'api' ? 'a' : 'r'], j.spec.mode, j.spec.dur).s;
  for (const s of L.STAGES) {
    const g = stg[s];
    if (g && g.s > 0 && g.e >= g.s && plan[s] > 0) out['t:' + s] = Math.round((g.e - g.s) / 1000 / plan[s] * 1000) / 1000;   // 1 = בדיוק כצפוי
  }
  if (Array.isArray(j.use)) {
    const by = {};
    for (const r of j.use) {
      if (!r || typeof r.usd !== 'number') continue;
      const k = r.k === 'sub' ? 'main' : r.k;   // סוכן־משנה כללי = חלק מהעבודה הראשית
      by[k] = (by[k] || 0) + r.usd;
    }
    for (const k of ['main', 'tl', 'rv', 'jg']) if (by[k] > 0) out['u:' + k] = Math.round(by[k] / hr * 1000) / 1000;
  }
  return out;
}
const median = (a) => {
  const s = a.slice().sort((x, y) => x - y), n = s.length;
  return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0;
};
/* הבסיס למדד: חציון + קנה מידה (1.4826 × MAD, לפחות REL_MIN מהחציון) */
function baseline(vals) {
  if (!Array.isArray(vals) || vals.length < BASE_N) return null;
  const med = median(vals), mad = median(vals.map((v) => Math.abs(v - med)));
  const sc = Math.max(1.4826 * mad, REL_MIN * med, 1e-6);
  return { med, sc, n: vals.length };
}
/* הציון: z = (ערך − חציון) / קנה מידה; z ≤ 1 = רגיל (0), z = 5 ומעלה = 10 */
function score(v, b) {
  if (!b || typeof v !== 'number') return null;
  const z = (v - b.med) / b.sc;
  return Math.round(Math.max(0, Math.min(10, (z - 1) * 2.5)) * 10) / 10;
}
const doneAt = (j) => j.ended || j.updated || 0;

/* התצוגה: הבסיס, הציון לכל עבודה אחרונה, ומה חריג בהתמדה */
function anomView(list, now) {
  const jobs = (Array.isArray(list) ? list : [])
    .filter((j) => j && j.kind === 'tr' && j.state === 'done' && doneAt(j) && now - doneAt(j) <= BASE_WIN)
    .sort((a, b) => doneAt(a) - doneAt(b));
  const vals = jobs.map((j) => ({ j, v: metricVals(j), m: (j.spec && j.spec.mode) || '', e: j.eng === 'api' ? 'a' : 'r' }));
  // הציון של כל עבודה — מול העבודות שלפניה בלבד (לא מול עצמה ולא מול העתיד)
  const scored = [];
  for (let i = 0; i < vals.length; i++) {
    const cur = vals[i], sc = {};
    for (const M of METRICS) {
      if (typeof cur.v[M.k] !== 'number') continue;
      const prev = vals.slice(0, i).filter((x) => typeof x.v[M.k] === 'number' && (!M.m || x.m === cur.m) && (!M.e || x.e === cur.e)).slice(-BASE_MAX).map((x) => x.v[M.k]);
      const b = baseline(prev);
      const s = score(cur.v[M.k], b);
      if (s != null) sc[M.k] = { s, v: cur.v[M.k], med: Math.round(b.med * 1000) / 1000 };
    }
    scored.push({ j: cur.j, at: doneAt(cur.j), m: cur.m, sc });
  }
  const recent = scored.slice(-RECENT);
  const out = { n: jobs.length, min: BASE_N, hi: HI, j: {}, m: [], act: [] };
  for (const r of recent) {
    const rows = Object.keys(r.sc).filter((k) => r.sc[k].s > 0).map((k) => [k, r.sc[k].s, r.sc[k].v, r.sc[k].med]).sort((a, b) => b[1] - a[1]);   // רק מה שמעל הרגיל
    if (rows.length) out.j[r.j.id] = rows;
  }
  // לכל מדד: הציון האחרון, המגמה, התדירות (מתוך 5) וההתמדה (2 מתוך 3)
  for (const M of METRICS) {
    const seq = scored.filter((r) => r.sc[M.k]).map((r) => ({ s: r.sc[M.k].s, v: r.sc[M.k].v, med: r.sc[M.k].med, j: r.j.id, at: r.at }));
    if (!seq.length) continue;
    const last = seq[seq.length - 1], prev = seq.length > 1 ? seq[seq.length - 2] : null;
    const tr = !prev ? 'f' : last.s > prev.s + 0.5 ? 'u' : last.s < prev.s - 0.5 ? 'd' : 'f';
    const f = seq.slice(-FREQ_N).filter((x) => x.s >= HI).length;
    const p = seq.slice(-PERSIST[1]).filter((x) => x.s >= HI).length >= PERSIST[0];
    const row = { k: M.k, c: M.c, s: last.s, v: last.v, med: last.med, tr, f, fn: Math.min(FREQ_N, seq.length), p, j: last.j, at: last.at };
    out.m.push(row);
    if (p) out.act.push(M.k);
  }
  out.m.sort((a, b) => (b.p - a.p) || (b.s - a.s));
  return out;
}
/* ההתראות: רכיב עם מדד חריג בהתמדה — פתוחה (בלי עבודה — דפוס בין עבודות); רכיב שחזר לרגיל — נסגרת */
function anomAlerts(view) {
  const on = new Set(((view && view.m) || []).filter((r) => r.p).map((r) => r.c));
  return COMPS.map((c) => (on.has(c) ? { c, k: 'anomaly' } : { c, k: 'anomaly', ok: true }));
}

module.exports = { BASE_N, BASE_MAX, BASE_WIN, REL_MIN, HI, PERSIST, FREQ_N, RECENT, METRICS, COMPS, metricVals, baseline, score, anomView, anomAlerts };
