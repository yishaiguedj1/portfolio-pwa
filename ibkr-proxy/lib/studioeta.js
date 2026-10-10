'use strict';
/* צפי זמנים לעבודת תרגום (10/10/2026 — אחרי העבודה האמיתית הראשונה ומחקר; הסיכום ביומן). טהור, בלי קריאות.
   הטבלה הישנה ("דקות לכל דקת סרטון") הניחה שכל הזמן יחסי לאורך — ו־5 דק׳ סרטון לקחו 13.5 דק׳ מול "כ־7".
   עכשיו לכל שלב: זמן = a + b·דקות (a = קבוע: טעינת מודלים, תשובת LLM, הפעלת ffmpeg; b = לכל דקת סרטון).
   - prior: ערכים התחלתיים לכל מנוע (השרת שלנו / Routine), מכוילים מהמדידה הראשונה.
   - למידה: ridge לעבר ה־prior (כ־3 "עבודות מדומות"), משקל 1/t² (שגיאה יחסית) ודעיכה של 30 יום — כמו CI (Jenkins/CircleCI)
     ו־DeepETA של Uber (בסיס קבוע + תיקון נלמד).
   - אי־ודאות: לוג היחס בפועל/צפי של עבודות קודמות (כל העבודה — השלבים לא בלתי תלויים: עומס בשרת משפיע על כולם);
     מ־8 עבודות — קוונטילים אמפיריים (conformal), לפני כן σ=0.35 קבוע. p80 = מה שמוצג, p90 = יעד ה־SLA ("חרגה" רק מעליו). */

const STAGES = ['tr', 'al', 'tl', 'rv', 'bn', 'sv'];
// [a שניות, b שניות לדקת סרטון]. api = השרת שלנו (8 vCPU): 5 דק׳ סרטון → ≈14 דק׳, כמו שנמדד (תמלול ~3, הגהה+צירוף+יישור ~5.4,
// תרגום ~1, ביקורת ~0.7, שופט+צריבה+העלאה ~3.4). r = Routine (סשן Claude Code): הסוכנים איטיים יותר, הקבוע גדול יותר.
const PRIOR = {
  a: { tr: [60, 22], al: [150, 30], tl: [30, 2], rv: [40, 5], bn: [40, 28], sv: [10, 3] },   // tl: מ־10/10 התרגום רץ במקביל ליישור — נשאר רק סבב התיקונים
  r: { tr: [90, 6], al: [120, 4], tl: [180, 39], rv: [120, 9], bn: [60, 18], sv: [20, 2.5] },
};
const MODE_MIN = { 'sonnet-medium': 85, 'haiku-medium': 75, 'haiku-high': 80, 'sonnet-high': 95, 'opus-medium': 105 };   // = MODES בטלפון
const LAMBDA = 3, HALF_LIFE = 30 * 86400e3, SIGMA0 = 0.35, NQ = 8, ET_MAX = 40;
const Z = { 50: 0, 80: 0.8416, 90: 1.2816 };

const eng = (e) => (e === 'a' || e === 'api' ? 'a' : 'r');
const modeK = (m) => (MODE_MIN[m] || 105) / 105;
const num = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;

/* דגימה מעבודה שהסתיימה בהפעלה אחת: משך כל שלב בשניות (מ־prog.stg של השרתון), בלי שמות ובלי תוכן */
function etaSample(job, now) {
  if (!job || job.kind !== 'tr' || (job.fires || 0) > 1) return null;
  const sp = job.spec || {}, stg = (job.prog && job.prog.stg) || {};
  if (!(sp.dur > 0)) return null;
  const s = {};
  for (const k of STAGES) {
    const x = stg[k];
    if (x && x.s > 0 && x.e > x.s) s[k] = Math.round((x.e - x.s) / 1000);
  }
  if (Object.keys(s).length < 3) return null;
  return { e: eng(job.eng), m: MODE_MIN[sp.mode] ? sp.mode : 'opus-medium', d: Math.round(sp.dur), s, at: now };
}
function normEtSamples(list) {
  const out = [];
  for (const x of Array.isArray(list) ? list : []) {
    if (!x || !num(x.d, 1, 86400) || !num(x.at, 0, 1e14) || !x.s || typeof x.s !== 'object') continue;
    const s = {};
    for (const k of STAGES) if (num(x.s[k], 0, 86400)) s[k] = x.s[k];
    out.push({ e: eng(x.e), m: MODE_MIN[x.m] ? x.m : 'opus-medium', d: x.d, s, at: x.at });
  }
  return out.slice(-ET_MAX);
}
function addEtSample(list, smp) { return normEtSamples((Array.isArray(list) ? list : []).concat(smp ? [smp] : [])); }

/* שלב אחד: ריבועים מינימליים משוקללים (משקל = דעיכה / y² — שגיאה יחסית). ה־prior נכנס כ"עבודות מדומות":
   λ עבודות על הקו של ה־prior, חצי ב־5 דק׳ וחצי ב־30 דק׳ — כך נלמדים גם הקבוע וגם השיפוע (עונש ישיר על a ו־b
   הכריע את הנתונים: הקבוע כמעט לא זז גם אחרי 12 עבודות). פתרון סגור של 2×2 */
function fitStage(pts, a0, b0, now) {
  const all = [{ x: 5, y: a0 + 5 * b0, w: LAMBDA / 2 }, { x: 30, y: a0 + 30 * b0, w: LAMBDA / 2 }];
  for (const p of pts) if (p.y > 0) all.push({ x: p.x, y: p.y, w: Math.pow(0.5, Math.max(0, now - p.at) / HALF_LIFE) });
  let s0 = 0, s1 = 0, s2 = 0, r0 = 0, r1 = 0;
  for (const p of all) {
    const w = p.w / (p.y * p.y);
    s0 += w; s1 += w * p.x; s2 += w * p.x * p.x; r0 += w * p.y; r1 += w * p.x * p.y;
  }
  const det = s0 * s2 - s1 * s1;
  if (!(Math.abs(det) > 1e-18)) return [a0, b0];
  let a = (r0 * s2 - s1 * r1) / det, b = (s0 * r1 - s1 * r0) / det;
  if (a < 0) { a = 0; b = Math.max(0, r1 / s2); }            // לא קבוע שלילי: מתאימים רק שיפוע
  if (b < 0) { b = 0; a = Math.max(0, r0 / s0); }
  return [Math.round(a * 10) / 10, Math.round(b * 100) / 100];
}
/* המודל למנוע: [a, b] לכל שלב (b של תרגום/ביקורת מנורמל ל־Opus · Medium), וקוונטילי האי־ודאות של העבודה כולה */
function etaModel(samples, e, now) {
  const E = eng(e), pri = PRIOR[E];
  const list = normEtSamples(samples).filter((x) => x.e === E);
  const st = {};
  for (const k of STAGES) {
    const pts = list.filter((x) => x.s[k] != null).map((x) => ({
      x: x.d / 60, y: (k === 'tl' || k === 'rv') ? x.s[k] / modeK(x.m) : x.s[k], at: x.at }));   // ממירים למצב הייחוס
    st[k] = fitStage(pts, pri[k][0], pri[k][1], now);
  }
  // אי־ודאות: יחס בפועל/צפי של כל עבודה שלמה (כל ששת השלבים נמדדו)
  const lr = list.filter((x) => STAGES.every((k) => x.s[k] != null))
    .map((x) => Math.log(STAGES.reduce((a, k) => a + x.s[k], 0) / Math.max(1, planOf(st, x.m, x.d).t))).sort((a, b) => a - b);
  let q;
  if (lr.length >= NQ) {
    const at = (p) => lr[Math.min(lr.length - 1, Math.ceil((lr.length + 1) * p) - 1)];
    const q50 = lr[Math.floor((lr.length - 1) / 2)];
    q = [r3(q50), r3(Math.max(q50, at(0.8))), r3(Math.max(q50, at(0.9)))];
  } else q = [0, r3(Z[80] * SIGMA0), r3(Z[90] * SIGMA0)];
  return { st, q, n: lr.length };
}
const r3 = (v) => Math.round(v * 1000) / 1000;
/* התוכנית לעבודה: p50 לכל שלב (שניות) והסכום */
function planOf(st, mode, durSec) {
  const m = (durSec > 0 ? durSec : 3600) / 60, k = modeK(mode), s = {};
  let t = 0;
  for (const x of STAGES) {
    const ab = (st && st[x]) || PRIOR.a[x];
    s[x] = Math.round((ab[0] + ab[1] * m) * ((x === 'tl' || x === 'rv') ? k : 1));
    t += s[x];
  }
  return { s, t };
}
/* ‏ep של עבודה (נקבע בלקיחה, הטלפון מציג ממנו): שלבים p50 + קוונטילים + כמה עבודות מאחורי המודל */
function etaPlan(model, mode, durSec) {
  const mdl = model || etaModel([], 'a', 0);
  const p = planOf(mdl.st, mode, durSec);
  return { s: p.s, t: p.t, q: mdl.q, n: mdl.n };
}
/* יעד הזמן (SLA): p90 של העבודה כולה + דקה — "חרגה" רק כשבאמת חריג */
function etaTarget(ep) {
  if (!ep || !(ep.t > 0)) return 0;
  return Math.round(ep.t * Math.exp((ep.q && ep.q[2]) || Z[90] * SIGMA0)) + 60;
}
/* מה שהטלפון מקבל ב־status: מודל לכל מנוע (לעבודות שעוד לא נלקחו) */
function etaView(samples, now) { return { a: etaModel(samples, 'a', now), r: etaModel(samples, 'r', now) }; }
/* הטלפון שולח ep רק בצורה הזו (השרתון לא סומך על מה שנשמר בלי בדיקה) */
function normEp(ep) {
  if (!ep || typeof ep !== 'object' || !ep.s || typeof ep.s !== 'object') return null;
  const s = {};
  let t = 0;
  for (const k of STAGES) { if (!num(ep.s[k], 0, 86400)) return null; s[k] = ep.s[k]; t += s[k]; }
  const q = Array.isArray(ep.q) && ep.q.length === 3 && ep.q.every((v) => num(v, -3, 3)) ? ep.q.slice() : [0, r3(Z[80] * SIGMA0), r3(Z[90] * SIGMA0)];
  return { s, t, q, n: num(ep.n, 0, 1000) ? Math.round(ep.n) : 0 };
}

module.exports = { STAGES, PRIOR, MODE_MIN, LAMBDA, HALF_LIFE, SIGMA0, NQ, ET_MAX,
  etaSample, normEtSamples, addEtSample, fitStage, etaModel, etaPlan, etaTarget, etaView, normEp, planOf };
