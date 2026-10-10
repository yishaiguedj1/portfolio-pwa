'use strict';
/* v379: דוח אחרי תקלה (Post-Incident Review) — מגדל הפיקוח 2.0, כמו ה־Major Incident Workbench של ServiceNow.
   לתקלות P1–P2 בלבד (החלטה 3 בתוכנית). החלק המספרי בלי טוקנים: זמן לזיהוי (מהאות הראשון עד שהתקלה נפתחה), זמן לתיקון
   (עד שנפתרה), ומה עלה בטעות (הסשנים שנכשלו). הסיכום — שלושה משפטים ש־Claude (Sonnet, הסשן של העבודה הבאה) כותב פעם אחת
   מעובדות מובנות בלבד (קודים, זמנים, סכומים — בלי טקסט חופשי ובלי תוכן מהסרטון), ונשמר. הקובץ טהור — בלי רשת. */

const DAY = 86400e3;
const PIR_SEV = 2;               // רק P1–P2
const PIR_AGE = 7 * DAY;         // מבקשים סיכום רק לתקלה שנפתרה בשבוע האחרון
const PIR_ASK = 3;               // לכל היותר 3 בקשות לתקלה — סשן שלא כתב לא יקבל אותה לנצח
const SUM_MIN = 20, SUM_MAX = 420;
const MODEL_RE = /^claude-[a-z0-9-]{1,50}$/;
const DONE = ['r', 'x'];

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const usdOf = (use) => (Array.isArray(use) ? use : []).reduce((s, r) => s + (r && typeof r.usd === 'number' && r.usd > 0 ? r.usd : 0), 0);
/* מה עלה בטעות: הסשנים הקודמים (כל "המשך" בא אחרי כישלון), ואם העבודה לא הסתיימה בהצלחה — גם האחרון */
function wastedUsd(job, state) {
  return Math.round((usdOf(job && job.use0) + (state === 'done' ? 0 : usdOf(job && job.use))) * 100) / 100;
}
/* בשעת הפתרון: המספרים של הדוח נקבעים פעם אחת. al = ההתראות (studioOps.al), f = jobFacts של העבודה */
function pirOnResolve(x, f, al) {
  if (!x || !(x.s <= PIR_SEV)) return null;
  const first = (Array.isArray(al) ? al : []).filter((a) => a && a.j === x.j && num(a.f) > 0).reduce((m, a) => Math.min(m, a.f), Infinity);
  const tti = Number.isFinite(first) && first < x.f ? Math.round((x.f - first) / 1000) : 0;
  return { tti, usd: f && typeof f.w === 'number' ? f.w : 0 };
}
const eligible = (x, now) => x && x.s <= PIR_SEV && DONE.includes(x.st) && x.pr && typeof x.pr === 'object' && !x.ps && num(x.pq) < PIR_ASK && now - num(x.rt) < PIR_AGE;
/* התקלה הבאה שמחכה לסיכום (החדשה ביותר) */
function pirPending(inc, now) {
  return (Array.isArray(inc) ? inc : []).filter((x) => eligible(x, now)).sort((a, b) => num(b.rt) - num(a.rt))[0] || null;
}
/* העובדות לסשן — רק קודים, זמנים יחסיים (דקות מתחילת התקלה) וסכומים. הקטלוג (H_CODES, קודי שגיאה, רכיבים) קבוע */
function pirForWorker(x, al) {
  const tl = (Array.isArray(x.h) ? x.h : []).filter((e) => Array.isArray(e) && typeof e[0] === 'number' && typeof e[1] === 'string').map((e) => [Math.round((e[0] - x.f) / 60e3), e[1]]);
  for (const a of (Array.isArray(al) ? al : []).filter((y) => y && y.j === x.j && num(y.f) > 0)) tl.push([Math.round((a.f - x.f) / 60e3), 'a', a.c, a.k]);
  tl.sort((p, q) => p[0] - q[0]);
  return { no: x.no, c: x.c, e: x.e, s: x.s, by: x.by || '', n: num(x.n) || 1, m: x.m ? 1 : 0,
    tti: num(x.pr.tti), ttr: Math.max(0, Math.round((num(x.rt) - num(x.f)) / 1000)), usd: num(x.pr.usd), st: x.st,
    rc: (Array.isArray(x.rc) ? x.rc : []).map((r) => ({ t: r.t, c: r.c, k: r.k, p: r.p })), tl: tl.slice(-16) };
}
/* הטקסט מ־Claude: רק טקסט, בלי כתובות, קוד ותגיות, באורך מוגבל. מוצג בטלפון כטקסט בלבד */
function normPirText(t) {
  const x = String(t == null ? '' : t).replace(/[\x00-\x1f\x7f]/g, ' ').replace(/https?:\/\/\S+|www\.\S+/gi, '').replace(/[`<>{}\[\]\\$|*#]/g, '')
    .replace(/\s+/g, ' ').trim().slice(0, SUM_MAX);
  return x.length >= SUM_MIN ? x : '';
}
/* הסיכום מהעובד → נשמר בתקלה (פעם אחת). מחזיר רשימה חדשה, או null */
function pirSave(inc, no, text, model, job, now) {
  const t = normPirText(text);
  if (!t || !Number.isInteger(no)) return null;
  const out = (Array.isArray(inc) ? inc : []).map((x) => Object.assign({}, x));
  const x = out.find((y) => y.no === no);
  if (!x || !(x.s <= PIR_SEV) || !DONE.includes(x.st) || !x.pr || x.ps) return null;
  x.ps = { t, m: MODEL_RE.test(String(model || '')) ? model : '', at: now, j: job };
  return out;
}
/* "האם הסיכום עזר" (👍 / 👎 / ביטול) */
function pirVote(inc, no, v) {
  if (![1, -1, 0].includes(v)) return null;
  const out = (Array.isArray(inc) ? inc : []).map((x) => Object.assign({}, x));
  const x = out.find((y) => y.no === no);
  if (!x || !x.ps) return null;
  x.ps = Object.assign({}, x.ps, { v });
  return out;
}
/* לטלפון: null = אין דוח (לא P1–P2 / עוד לא נפתרה) */
function pirView(x, now) {
  if (!x || !(x.s <= PIR_SEV) || !DONE.includes(x.st) || !x.pr || typeof x.pr !== 'object') return null;
  const out = { tti: num(x.pr.tti), ttr: Math.max(0, Math.round((num(x.rt) - num(x.f)) / 1000)), usd: num(x.pr.usd), ps: null };
  if (x.ps && typeof x.ps === 'object' && normPirText(x.ps.t)) out.ps = { t: normPirText(x.ps.t), m: MODEL_RE.test(String(x.ps.m || '')) ? x.ps.m : '', at: num(x.ps.at), v: [1, -1].includes(x.ps.v) ? x.ps.v : 0 };
  else out.wait = num(x.pq) < PIR_ASK && num(x.rt) > 0 && num(now) - num(x.rt) < PIR_AGE;   // הסיכום ייכתב בעבודה הבאה
  return out;
}

module.exports = { PIR_SEV, PIR_AGE, PIR_ASK, SUM_MIN, SUM_MAX, wastedUsd, pirOnResolve, pirPending, pirForWorker, normPirText, pirSave, pirVote, pirView };
