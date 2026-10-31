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
  // tl: מ־10/10 התרגום רץ במקביל ליישור — נשאר רק סבב התיקונים. tr/al (10/10, קיצור היישור): ההגהה עברה לשלב
  // התמליל (בעבודת Haiku הראשונה ~3.5 דק׳ ל־5 דק׳ סרטון) והצירוף רץ בזמנה — היישור עצמו ~3.4 דק׳ כולל הצירוף
  a: { tr: [70, 40], al: [60, 20], tl: [30, 2], rv: [40, 5], bn: [40, 28], sv: [10, 3] },
  r: { tr: [90, 6], al: [120, 4], tl: [180, 39], rv: [120, 9], bn: [60, 18], sv: [20, 2.5] },
};
const MODE_MIN = { 'sonnet-medium': 85, 'haiku-high': 76, 'haiku-medium': 74, 'sonnet-high': 95, 'opus-medium': 105, 'sonnet-low': 80 };   // = MODES בטלפון
const LAMBDA = 3, HALF_LIFE = 30 * 86400e3, SIGMA0 = 0.35, NQ = 8, ET_MAX = 40, MQ_MIN = 4;
// 20/10/2026 (בקשת המשתמש: צפי מדויק ככל האפשר): בשרת שלנו הזמן תלוי בחומרה, לא במשתמש — מאגר אחד לכל העבודות
// בשרת (studioEta/a), גדול יותר. ה־Routine נשאר לכל משתמש (המנוי שלו). כל עבודה שהסתיימה מעדכנת אותו.
const ET_G_MAX = 200;
const Z = { 50: 0, 80: 0.8416, 90: 1.2816 };

/* 21/10/2026 (מחקר הצפי השני): שלושה דברים שקובעים זמן ולא היו במודל.
   1. px — פיקסלים לשנייה ביחס ל־1080p30 (רוחב × גובה × פריימים): הצריבה מקודדת כל פיקסל, ו־4K60 לוקח פי ~5 מ־1080p30.
      נכנס כ"דקות אפקטיביות" של שלב הצריבה בלבד: x = דקות × px^PX_EXP (קידוד לא לגמרי לינארי בפיקסלים).
   2. c — הליבות של השרת (תמלול, יישור וצריבה מוגבלים במעבד): הזמנים מנורמלים ל־REF_CPUS ליבות בחזקת CPU_EXP
      (מקבול לא מושלם — מעבר מ־8 ל־16 ליבות נותן ~×1.7, לא ×2). כך דגימות משרתים שונים נכנסות לאותו מאגר.
   3. cc — כמה עבודות אחרות רצו בשרת כשהעבודה נלקחה: הן חולקות את המעבד. דגימה עם cc > 0 לא מלמדת את השלבים
      שמוגבלים במעבד (היא לא מייצגת עבודה לבד), ובתוכנית השלבים האלה גדלים ב־(1 + CC_K·cc) — הערכה שמרנית, הקצב
      בפועל מתקן אותה תוך כדי (progressModel). */
const CPU_ST = ['tr', 'al', 'bn'], REF_CPUS = 8, CPU_EXP = 0.8, PX_EXP = 0.85, CC_K = 0.5;
const fNorm = (f) => {
  f = f && typeof f === 'object' ? f : {};
  return { px: num(f.px, 0.02, 16) ? f.px : 1, c: num(f.c, 1, 256) ? Math.round(f.c) : REF_CPUS, cc: num(f.cc, 0, 16) ? Math.round(f.cc) : 0 };
};
/* המכפיל לשלב: ליבות (מנורמל ל־REF_CPUS) × עבודות במקביל — רק לשלבים שמוגבלים במעבד */
const cpuK = (k, f) => (CPU_ST.includes(k) ? Math.pow(REF_CPUS / f.c, CPU_EXP) * (1 + CC_K * f.cc) : 1);
const xOf = (k, m, f) => (k === 'bn' ? m * Math.pow(f.px, PX_EXP) : m);
const eng = (e) => (e === 'a' || e === 'api' ? 'a' : 'r');
const modeK = (m) => (MODE_MIN[m] || 105) / 105;
const num = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;

/* דגימה מעבודה שהסתיימה בהפעלה אחת: משך כל שלב בשניות (מ־prog.stg של השרתון), בלי שמות ובלי תוכן */
function etaSample(job, now) {
  if (!job || job.kind !== 'tr' || (job.fires || 0) > 1) return null;
  const sp = job.spec || {}, stg = (job.prog && job.prog.stg) || {};
  if (!(sp.dur > 0) || sp.ka === 1) return null;   // 31/10/2026: קריוקי — מאגר משלו (kaSample); "תמלול" שלו = הפרדה, ניפח את הצפי של התרגום
  const s = {};
  for (const k of STAGES) {
    const x = stg[k];
    // 28/10/2026: השמירה — עד שהתוצרים הגיעו אליך (r), בלי מה שהעובד משלים ברקע אחר כך
    const e = k === 'sv' && x && x.r > x.s ? x.r : x && x.e;
    if (x && x.s > 0 && e > x.s) s[k] = Math.round((e - x.s) / 1000);
  }
  if (Object.keys(s).length < 3) return null;
  const f = jobFactors(job), out = { e: eng(job.eng), m: MODE_MIN[sp.mode] ? sp.mode : 'opus-medium', d: Math.round(sp.dur), s, at: now };
  if (f.px !== 1 || f.c !== REF_CPUS || f.cc) out.f = f;
  return out;
}
/* הגורמים של עבודה: px מהעובד (אחרי הקליטה — המידות והקצב האמיתיים), אחרת מהטלפון (מידות בלבד, 30 פריימים);
   c ו־cc — מהלקיחה (השרת שלקח אותה) */
function jobFactors(job) {
  const sp = (job && job.spec) || {};
  // pxm = px × 1000 (Firestore שומר כאן מספרים שלמים — toFields מעגל)
  const px = job && num(job.pxm, 20, 16000) ? job.pxm / 1000 : sp.px;
  return fNorm({ px, c: job && job.hc, cc: job && job.cc });
}
function normEtSamples(list, max) {
  const out = [];
  for (const x of Array.isArray(list) ? list : []) {
    if (!x || !num(x.d, 1, 86400) || !num(x.at, 0, 1e14) || !x.s || typeof x.s !== 'object') continue;
    const s = {};
    for (const k of STAGES) if (num(x.s[k], 0, 86400)) s[k] = x.s[k];
    const o = { e: eng(x.e), m: MODE_MIN[x.m] ? x.m : 'opus-medium', d: x.d, s, at: x.at };
    if (x.f && typeof x.f === 'object') { const f = fNorm(x.f); if (f.px !== 1 || f.c !== REF_CPUS || f.cc) o.f = f; }
    out.push(o);
  }
  return out.slice(-(max || ET_MAX));
}
function addEtSample(list, smp, max) { return normEtSamples((Array.isArray(list) ? list : []).concat(smp ? [smp] : []), max); }
/* 20/10/2026: הדגימות לצפי של מנוע — השרת: המאגר המשותף (כשיש בו), אחרת של המשתמש; Routine — של המשתמש */
function etSamplesFor(userEt, globalEt, e) {
  return eng(e) === 'a' && Array.isArray(globalEt) && globalEt.length ? normEtSamples(globalEt, ET_G_MAX) : userEt;
}

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
  const list = normEtSamples(samples, ET_G_MAX).filter((x) => x.e === E);
  const st = {};
  for (const k of STAGES) {
    // ממירים לייחוס: מצב Opus · Medium (תרגום/ביקורת), REF_CPUS ליבות בלי עבודות במקביל (תמלול/יישור/צריבה), 1080p30 (צריבה)
    const pts = list.filter((x) => x.s[k] != null && !(CPU_ST.includes(k) && fNorm(x.f).cc > 0)).map((x) => {
      const f = fNorm(x.f);
      return { x: xOf(k, x.d / 60, f), y: ((k === 'tl' || k === 'rv') ? x.s[k] / modeK(x.m) : x.s[k]) / cpuK(k, f), at: x.at };
    });
    st[k] = fitStage(pts, pri[k][0], pri[k][1], now);
  }
  // אי־ודאות: יחס בפועל/צפי של כל עבודה שלמה (כל ששת השלבים נמדדו) — הצפי עם הגורמים שלה
  const full = list.filter((x) => STAGES.every((k) => x.s[k] != null))
    .map((x) => ({ m: x.m, v: Math.log(STAGES.reduce((a, k) => a + x.s[k], 0) / Math.max(1, planOf(st, x.m, x.d, x.f).t)) }));
  const lr = full.map((x) => x.v).sort((a, b) => a - b);
  // 28/10/2026 (ניתוח 46 עבודות): המצב משנה יותר ממה ש־MODE_MIN אומר — ב־high גם עריכת המקור (בשלב התמלול) והביקורת
  // חושבות יותר: הצפי היה קצר ב־16% ב־high ומדויק ב־medium. mq = החציון של 10 העבודות האחרונות באותו מצב (מ־MQ_MIN)
  const mq = {};
  for (const m of new Set(full.map((x) => x.m))) {
    const v = full.filter((x) => x.m === m).slice(-10).map((x) => x.v).sort((a, b) => a - b);
    if (v.length >= MQ_MIN) mq[m] = r3(v[(v.length - 1) >> 1]);
  }
  let q;
  if (lr.length >= NQ) {
    const at = (p) => lr[Math.min(lr.length - 1, Math.ceil((lr.length + 1) * p) - 1)];
    const q50 = lr[Math.floor((lr.length - 1) / 2)];
    q = [r3(q50), r3(Math.max(q50, at(0.8))), r3(Math.max(q50, at(0.9)))];
  } else q = [0, r3(Z[80] * SIGMA0), r3(Z[90] * SIGMA0)];
  return { st, q, n: lr.length, mq };
}
const r3 = (v) => Math.round(v * 1000) / 1000;
/* התוכנית לעבודה: p50 לכל שלב (שניות) והסכום */
function planOf(st, mode, durSec, fx) {
  const m = (durSec > 0 ? durSec : 3600) / 60, k = modeK(mode), s = {}, f = fNorm(fx);
  let t = 0;
  for (const x of STAGES) {
    const ab = (st && st[x]) || PRIOR.a[x];
    s[x] = Math.round((ab[0] + ab[1] * xOf(x, m, f)) * ((x === 'tl' || x === 'rv') ? k : 1) * cpuK(x, f));
    t += s[x];
  }
  return { s, t };
}
/* ‏ep של עבודה (נקבע בלקיחה, הטלפון מציג ממנו): שלבים p50 + קוונטילים + כמה עבודות מאחורי המודל.
   21/10/2026: עם הגורמים של העבודה (f), ו־bn = [a, b] של הצריבה — כדי לעדכן אותה כשהעובד מגלה את המידות האמיתיות */
function etaPlan(model, mode, durSec, fx) {
  const mdl = model || etaModel([], 'a', 0);
  const p = planOf(mdl.st, mode, durSec, fx);
  const bn = (mdl.st && mdl.st.bn) || PRIOR.a.bn;
  // החציון של המצב במקום החציון הכללי — אותו רוחב אי־ודאות (p80/p90 זזים איתו)
  const d = mdl.mq && typeof mdl.mq[mode] === 'number' && Array.isArray(mdl.q) ? mdl.mq[mode] - mdl.q[0] : 0;
  const q = d ? mdl.q.map((v) => r3(v + d)) : mdl.q;
  return { s: p.s, t: p.t, q, n: mdl.n, bn: [bn[0], bn[1]], f: fNorm(fx) };
}
/* 22/10/2026: קובץ כתוביות קיים — אין תמלול, יישור וצריבה: השלבים האלה קצרים (ייבוא + תדריך, tr-prep, בניית הקבצים).
   התרגום והביקורת — כמו בתוכנית. SUBS_STG זהה ב־studionet.js (subsPlan) */
const SUBS_STG = { tr: 60, al: 10, bn: 15, sv: 30 };
function subsPlan(ep) {
  if (!ep || !ep.s) return ep;
  const s = Object.assign({}, ep.s, SUBS_STG);
  return Object.assign({}, ep, { s, t: STAGES.reduce((a, k) => a + (s[k] || 0), 0) });
}
/* 26/10/2026: קריוקי — בלי תרגום וביקורת. tr = הפרדת הקול (הכבד), al = עוגנים + יישור, bn = צריבה; שניות = a + b·דקות.
   KA_STG זהה ב־studionet.js (kaPlan) — ה־prior, עד שנלמד.
   31/10/2026: (1) הצפי לומד מהעבודות שהסתיימו (kaSample → studioEta/a.ka, kaModel), במקום מספרים קבועים — הקבוע
   (3 דק׳ לדקת שיר) נקבע בריצה עם autocast מדומה על מעבד בלי bf16 ונשאר אחרי התיקון; ההפרדה עם קולות רקע (tb) נלמדת בנפרד.
   (2) ה־prior (docs/studio-karaoke-he.md, "מהירות ההפרדה"): בשרת Kim עם overlap 2 לקח כ־6.4 דק׳ לדקת שיר (העבודה של 31/10);
   overlap 1 = חצי → כ־200 שנ׳; "עם קולות רקע" = מעבר אחד במודל ה־karaoke (איטי פי 1.3) במקום Kim → עוד כ־60 שנ׳ לדקה */
const KA_STG = { tr: [60, 200], al: [40, 30], bn: [30, 40], sv: [20, 2] };
const KA_BV = [0, 60];   // התוספת של "עם קולות רקע" להפרדה (karaoke במקום Kim)
const KA_ST = ['tr', 'al', 'bn', 'sv'], KA_MAX = 30;
/* דגימה מעבודת קריוקי שהסתיימה בהפעלה אחת: משך כל שלב, האורך, עם/בלי קולות רקע, הליבות. בלי שמות ובלי תוכן */
function kaSample(job, now) {
  if (!job || job.kind !== 'tr' || (job.fires || 0) > 1) return null;
  const sp = job.spec || {}, stg = (job.prog && job.prog.stg) || {};
  if (sp.ka !== 1 || !(sp.dur > 0)) return null;
  const s = {};
  for (const k of KA_ST) {
    const x = stg[k], e = k === 'sv' && x && x.r > x.s ? x.r : x && x.e;
    if (x && x.s > 0 && e > x.s) s[k] = Math.round((e - x.s) / 1000);
  }
  if (s.tr != null && s.tr < 5 * sp.dur / 60) delete s.tr;   // מהמטמון של העובד (אותו שיר שוב) — לא הפרדה אמיתית
  if (Object.keys(s).length < 2) return null;
  const f = jobFactors(job), out = { d: Math.round(sp.dur), b: sp.bv === 1 ? 1 : 0, s, at: now };
  if (f.c !== REF_CPUS || f.cc) out.f = { c: f.c, cc: f.cc };
  return out;
}
function normKaSamples(list) {
  const out = [];
  for (const x of Array.isArray(list) ? list : []) {
    if (!x || !num(x.d, 1, 86400) || !num(x.at, 0, 1e14) || !x.s || typeof x.s !== 'object') continue;
    const s = {};
    for (const k of KA_ST) if (num(x.s[k], 0, 86400)) s[k] = x.s[k];
    const o = { d: x.d, b: x.b === 1 ? 1 : 0, s, at: x.at };
    if (x.f && typeof x.f === 'object') { const f = fNorm(x.f); if (f.c !== REF_CPUS || f.cc) o.f = { c: f.c, cc: f.cc }; }
    out.push(o);
  }
  return out.slice(-KA_MAX);
}
function addKaSample(list, smp) { return normKaSamples((Array.isArray(list) ? list : []).concat(smp ? [smp] : [])); }
/* המודל: לכל שלב [a, b] מותאמים לדגימות (fitStage, הזמנים מנורמלים ל־REF_CPUS); tb = ההפרדה עם קולות רקע */
function kaModel(samples, now) {
  const list = normKaSamples(samples), st = {};
  const pts = (k, keep) => list.filter((x) => x.s[k] != null && keep(x) && !(fNorm(x.f).cc > 0)).map((x) => ({ x: x.d / 60, y: x.s[k] / cpuK(k, fNorm(x.f)), at: x.at }));
  for (const k of KA_ST) st[k] = fitStage(pts(k, (x) => k !== 'tr' || !x.b), KA_STG[k][0], KA_STG[k][1], now);
  st.tb = fitStage(pts('tr', (x) => x.b === 1), KA_STG.tr[0] + KA_BV[0], KA_STG.tr[1] + KA_BV[1], now);
  return { st, n: list.length };
}
const kaOk = (m) => !!(m && m.st && KA_ST.concat('tb').every((k) => Array.isArray(m.st[k]) && m.st[k].length === 2 && m.st[k].every((v) => num(v, 0, 1e5))));
function kaPlan(ep, durSec, bv, mdl) {
  const m = Math.max(0, Number(durSec) || 0) / 60, s = Object.assign({}, (ep && ep.s) || {});
  const ab = (k) => (kaOk(mdl) ? mdl.st[k] : k === 'tb' ? [KA_STG.tr[0] + KA_BV[0], KA_STG.tr[1] + KA_BV[1]] : KA_STG[k]);
  for (const k of STAGES) { const [a, b] = KA_STG[k] ? ab(k === 'tr' && bv ? 'tb' : k) : [0, 0]; s[k] = Math.round(a + b * m); }
  return Object.assign({}, ep || {}, { s, t: STAGES.reduce((a, k) => a + (s[k] || 0), 0) });
}
/* העובד מדווח px אמיתי (אחרי הקליטה): שלב הצריבה בתוכנית מחושב מחדש, השאר כמו שהיה */
function replanPx(ep, durSec, px) {
  if (!ep || !ep.s || !num(px, 0.02, 16) || !(durSec > 0)) return null;
  const f = Object.assign(fNorm(ep.f), { px }), ab = Array.isArray(ep.bn) && ep.bn.length === 2 && ep.bn.every((v) => num(v, 0, 1e5)) ? ep.bn : PRIOR.a.bn;
  const bn = Math.round((ab[0] + ab[1] * xOf('bn', durSec / 60, f)) * cpuK('bn', f));
  const s = Object.assign({}, ep.s, { bn });
  return Object.assign({}, ep, { s, t: STAGES.reduce((a, k) => a + (s[k] || 0), 0), f });
}
/* px מהמידות והקצב (העובד: media.json; הטלפון: מידות בלבד → 30 פריימים) */
function pxOf(w, h, fps) {
  if (!(num(w, 16, 16384) && num(h, 16, 16384))) return null;
  const r = (w * h * (num(fps, 1, 240) ? fps : 30)) / (1920 * 1080 * 30);
  return Math.round(Math.max(0.02, Math.min(16, r)) * 1000) / 1000;
}
/* יעד הזמן (SLA): p90 של העבודה כולה + דקה — "חרגה" רק כשבאמת חריג */
function etaTarget(ep) {
  if (!ep || !(ep.t > 0)) return 0;
  return Math.round(ep.t * Math.exp((ep.q && ep.q[2]) || Z[90] * SIGMA0)) + 60;
}
/* מה שהטלפון מקבל ב־status: מודל לכל מנוע (לעבודות שעוד לא נלקחו) */
function etaView(samples, now, globalEt, globalKa) { return { a: etaModel(etSamplesFor(samples, globalEt, 'a'), 'a', now), r: etaModel(samples, 'r', now), k: kaModel(globalKa, now) }; }   // k — קריוקי (31/10/2026)
/* הטלפון שולח ep רק בצורה הזו (השרתון לא סומך על מה שנשמר בלי בדיקה) */
function normEp(ep) {
  if (!ep || typeof ep !== 'object' || !ep.s || typeof ep.s !== 'object') return null;
  const s = {};
  let t = 0;
  for (const k of STAGES) { if (!num(ep.s[k], 0, 86400)) return null; s[k] = ep.s[k]; t += s[k]; }
  const q = Array.isArray(ep.q) && ep.q.length === 3 && ep.q.every((v) => num(v, -3, 3)) ? ep.q.slice() : [0, r3(Z[80] * SIGMA0), r3(Z[90] * SIGMA0)];
  return { s, t, q, n: num(ep.n, 0, 1000) ? Math.round(ep.n) : 0 };   // רק מה שהטלפון צריך — bn/f נשארים בשרתון
}

module.exports = { MQ_MIN, KA_STG, KA_BV, kaPlan, kaSample, addKaSample, normKaSamples, kaModel, SUBS_STG, subsPlan, STAGES, PRIOR, MODE_MIN, LAMBDA, HALF_LIFE, SIGMA0, NQ, ET_MAX, ET_G_MAX, etSamplesFor,
  etaSample, normEtSamples, addEtSample, fitStage, etaModel, etaPlan, etaTarget, etaView, normEp, planOf,
  CPU_ST, REF_CPUS, CPU_EXP, PX_EXP, CC_K, jobFactors, replanPx, pxOf };
