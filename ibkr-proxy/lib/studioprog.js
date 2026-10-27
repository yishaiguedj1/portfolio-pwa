'use strict';
/* 27/10/2026 (בקשת המשתמש: "להתעדכן בכל שלבי התרגום בווילון ההתראות גם כשהאפליקציה סגורה לגמרי"): ההתקדמות המשוערת
   של השלב הנוכחי — בשרתון, כדי שההתראה תזוז גם בלי הדף. בשלבים של Claude העובד כמעט לא מדווח אחוזים, והפס בטלפון
   הוא הערכה לפי הזמן (progressModel ב־studionet.js). זו העתקה מדויקת של השורה "now" שם — אותו מספר בטלפון ובהתראה.
   **שינוי ב־progressModel = אותו שינוי כאן** (tests/studio-shade.test.js משווה). טהור, בלי Firestore */

const STAGES = ['up', 'tr', 'al', 'tl', 'rv', 'bn', 'sv'];   // = STAGES ב־studionet.js
const Q_DEF = [0, 0.295, 0.449];
const STAGE_SIGMA = 0.45;
const SQ2 = Math.SQRT2;
function erf(x) {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
}
const normCdf = (z) => 0.5 * (1 + erf(z / SQ2));
function normInv(p) {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const q = Math.min(1 - 1e-12, Math.max(1e-12, p));
  if (q < 0.02425) { const r = Math.sqrt(-2 * Math.log(q)); return (((((c[0] * r + c[1]) * r + c[2]) * r + c[3]) * r + c[4]) * r + c[5]) / ((((d[0] * r + d[1]) * r + d[2]) * r + d[3]) * r + 1); }
  if (q > 1 - 0.02425) { const r = Math.sqrt(-2 * Math.log(1 - q)); return -(((((c[0] * r + c[1]) * r + c[2]) * r + c[3]) * r + c[4]) * r + c[5]) / ((((d[0] * r + d[1]) * r + d[2]) * r + d[3]) * r + 1); }
  const r = q - 0.5, s = r * r;
  return (((((a[0] * s + a[1]) * s + a[2]) * s + a[3]) * s + a[4]) * s + a[5]) * r / (((((b[0] * s + b[1]) * s + b[2]) * s + b[3]) * s + b[4]) * s + 1);
}
function condQuantile(median, sigma, t, p) {
  const m = Math.max(1, median), sg = Math.max(0.05, sigma);
  if (!(t > 0)) return m * Math.exp(sg * normInv(p));
  const F = normCdf(Math.log(t / m) / sg);
  return Math.max(t, m * Math.exp(sg * normInv(F + p * (1 - F))));
}
const creep = (el, e) => 0.9 * (1 - Math.exp(-Math.max(0, el) / Math.max(1, e)));

/* { st, p } — השלב שרץ עכשיו והחלק שלו שהושלם (0–0.99), או null (אין שלב פתוח / העלאה / אין תוכנית) */
function stageNow(job, now) {
  const prog = (job && job.prog) || {}, stg = prog.stg || {}, cur = prog.st || '';
  const ep = job && job.ep;
  if (!cur || cur === 'up' || !STAGES.includes(cur) || !stg[cur] || stg[cur].e || !(stg[cur].s > 0) || !ep || !ep.s) return null;
  const est = ep.s, qq = Array.isArray(ep.q) && ep.q.length === 3 ? ep.q : Q_DEF;
  const sgS = Math.max(0.25, Math.min(0.8, (qq[2] > 0 ? qq[2] / 1.2816 : STAGE_SIGMA / 1.25) * 1.25));
  let dT = 0, dE = 0;
  for (const s of STAGES) {
    if (s === 'up' || !(stg[s] && stg[s].e && stg[s].s)) continue;
    dT += Math.max(0, (stg[s].e - stg[s].s) / 1000); dE += est[s] || 60;
  }
  const rho = dE > 0 && dT > 0 ? Math.max(0.5, Math.min(3, dT / dE)) : 1, adj = Math.sqrt(rho);
  const e = Math.round((est[cur] || 60) * adj);
  const el = Math.max(0, (now - stg[cur].s) / 1000), p = Math.max(0, Math.min(0.99, prog.p || 0));
  const tot0 = condQuantile(e, sgS, el, 0.5);
  let l;
  if (prog.eta != null) l = Math.max(0, prog.eta - Math.max(0, (now - (prog.at || now)) / 1000));
  else {
    const w = p > 0 ? p / (p + 0.15) : 0, tot = (1 - w) * tot0 + (p > 0 ? w * el / p : 0);
    l = Math.max(tot - el, (1 - p) * (tot0 - el));
  }
  l = Math.max(10, Math.round(l));
  return { st: cur, p: Math.max(p, Math.min(creep(el, e), el / (el + l))) };
}

/* מתי שולחים התראת שלב: שלב אחר ממה שנשלח, או עשירייה חדשה באותו שלב. pn = מה שנשלח אחרון ({ st, b }) */
const bucket = (p) => Math.floor((Number(p) || 0) * 10 + 1e-9);
function shadeDue(pn, x) {
  if (!x || !STAGES.includes(x.st)) return false;
  if (!pn || pn.st !== x.st) return true;
  return bucket(x.p) > (Number(pn.b) || 0);
}
const shadeMark = (x) => ({ st: x.st, b: bucket(x.p) });

module.exports = { stageNow, shadeDue, shadeMark, condQuantile, creep, STAGES };
