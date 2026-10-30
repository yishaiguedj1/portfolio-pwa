/* סטודיו התרגום — כל מה שמדבר עם הרשת (שלב 2, v355). studio.js (הממשק) לא פונה לרשת בעצמו.
   1. השרתון (/api/studio): החיבור ל־Claude, עבודות, גישה זמנית ל־Drive. האימות = ההתחברות של האפליקציה (Firebase).
   2. Google Drive של המשתמש: תיקייה "THE SNOWBALL — סטודיו" ובתוכה תיקייה לכל פרויקט. העלאה מתחדשת (resumable)
      ישירות מהטלפון ל־Drive: הסרטון לא עובר בשרתון ולא נטען כולו לזיכרון — כל פעם נקראת רק החתיכה הנוכחית (Blob.slice),
      ולכן גם קובץ של כמה GB עולה בלי בעיה. כתובת ההעלאה תקפה שבוע: נפל החיבור / רענון → שואלים "כמה הגיע?" וממשיכים
      מאותו בייט. גודל החתיכה מסתגל למהירות (כפולה של 256KB, כמו ש־Drive דורש).
   3. חילוץ הקול בטלפון בלי קידוד מחדש (Mediabunny, vendor/mediabunny — נטען רק כשמתחילים עבודה).
   4. מודל הזמנים של מסך ההתקדמות (טהור).
   5. ת4: עבודה במצב שרת שומרת ב־Cloudflare R2 (studiostore.js): התיקייה R2_<עבודה>, מזהה קובץ <תיקייה>_<אקראי> —
      כל פונקציה כאן בוחרת R2 או Drive לפי המזהה, כך שהנגן, העורכים וסט הזהב לא השתנו.
   בלי DOM: התלויות מוזרקות (createNet(env)), ו־tests/studio-v355 בודק את המנוע ב־node עם Drive מדומה. */
import { lang2 } from './studiotracks.js';
import { r2Upload, isR2Folder, isR2Id, r2JobOf } from './studiostore.js';

const UP = 'https://www.googleapis.com/upload/drive/v3/files';
const API = 'https://www.googleapis.com/drive/v3/files';
const FOLDER_MIME = 'application/vnd.google-apps.folder';   // 26/10/2026: רשימת הקבצים (browseList)
export const MEDIA_PATH = './studio-media/';   // מ1: = MEDIA_RE ב־sw.js
const FOLDER = 'application/vnd.google-apps.folder';
export const ROOT_NAME = 'THE SNOWBALL — סטודיו';
const K256 = 256 * 1024;
export const CHUNK_MIN = 4 * K256, CHUNK_MAX = 128 * K256, CHUNK_START = 16 * K256;   // 1MB · 32MB · 4MB
const STALL_MS = 45000;          // חתיכה בלי שום התקדמות 45 שניות = החיבור נתקע → מנסים שוב
const MAX_FAILS = 12;            // ברצף, כשיש רשת — אחרי זה שגיאה גלויה (והמשתמש יכול "לנסות שוב")
export const STAGES = ['up', 'tr', 'al', 'tl', 'rv', 'bn', 'sv'];

/* ---------------- טהורות ---------------- */
/* "bytes=0-1048575" → 1048576 = הבייט הבא לשלוח. בלי כותרת = עוד לא הגיע כלום */
export function rangeNext(range) { const m = /bytes=(\d+)-(\d+)/.exec(String(range || '')); return m ? +m[2] + 1 : 0; }
export const backoff = (n) => Math.min(30000, 1000 * 2 ** Math.min(Math.max(n, 1) - 1, 5));
/* חתיכה של כ־15 שניות לפי המהירות שנמדדה — לא קטנה מ־1MB ולא גדולה מ־32MB, בכפולות של 256KB */
export function nextChunk(bytesPerSec) {
  if (!(bytesPerSec > 0)) return CHUNK_START;
  return Math.max(CHUNK_MIN, Math.min(CHUNK_MAX, Math.round(bytesPerSec * 15 / K256) * K256));
}
/* v380: זיכרון המונחים — מילון אחד לכל משתמש, קובץ TSV בתיקיית הסטודיו ב־Drive (appProperties snbGloss=1).
   אותו פורמט של tr/glossary.tsv של vt: אנגלית<TAB>עברית (חלופות ב־/)[<TAB>הערה]. glClean/glParse זהים ל־gl_clean/gl_parse
   בעובד (job.py) ול־glClean בשרתון — tests/studio-v380 משווה */
export const GL_MAX = 400, GL_NAME = 'מילון מונחים.tsv';
const GL_HEAD = '# מילון המונחים של סטודיו התרגום — אנגלית<TAB>עברית (חלופות מופרדות ב־/)<TAB>הערה. כל עבודה מקבלת רק את המונחים שמופיעים בסרטון.\n';
export function glClean(v, n) {
  const s = String(v == null ? '' : v).replace(/[\x00-\x1f\x7f<>`]/g, ' ').replace(/\s+/g, ' ').trim();
  return s.includes('://') ? '' : s.slice(0, n);
}
export function glParse(text) {
  const rows = [], seen = new Set();
  for (const line of String(text || '').split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const c = line.split('\t');
    if (c.length < 2) continue;
    const en = glClean(c[0], 60), he = glClean(c[1], 80), n = c.length > 2 ? glClean(c[2], 100) : '';
    if (!en || !he || seen.has(en.toLowerCase())) continue;
    seen.add(en.toLowerCase());
    rows.push([en, he, n]);
    if (rows.length >= GL_MAX) break;
  }
  return rows;
}
export const glFormat = (rows) => GL_HEAD + rows.map((r) => r[0] + '\t' + r[1] + (r[2] ? '\t' + r[2] : '')).join('\n') + (rows.length ? '\n' : '');
/* הוספה/עדכון (אותו מונח באנגלית — בלי תלות באותיות גדולות — מתעדכן), עד GL_MAX. מחזיר מערך חדש */
export function glUpsert(rows, add) {
  const out = rows.map((r) => r.slice());
  for (const a of add) {
    const en = glClean(a[0], 60), he = glClean(a[1], 80), n = glClean(a[2], 100);
    if (!en || !he) continue;
    const i = out.findIndex((r) => r[0].toLowerCase() === en.toLowerCase());
    if (i >= 0) out[i] = [en, he, n]; else if (out.length < GL_MAX) out.push([en, he, n]);
  }
  return out;
}

/* זמן משוער לכל שלב, בשניות. מהתוכנית: ראיון של 77 דק׳ ב־Opus 5.5 · Medium = תמלול 8, יישור 5, תרגום 50, בדיקה 12,
   צריבה 23, שמירה 3 דקות. כלומר דקות עבודה לכל דקת סרטון. התרגום והבדיקה גדלים/קטנים לפי המצב (min של המצב מול 105 של
   המומלץ); השאר לא תלוי במצב. ההעלאה נמדדת בטלפון. כשהעבודות האמיתיות יצטברו — הקצב יכויל מהן (שלב 3). */
const RATE = { tr: 8 / 77, al: 5 / 77, tl: 50 / 77, rv: 12 / 77, bn: 23 / 77, sv: 3 / 77 };
export function stageEstimates(modeMin, durSec) {
  const durMin = (durSec > 0 ? durSec : 3600) / 60, k = (modeMin > 0 ? modeMin : 105) / 105;
  const out = {};
  for (const s of STAGES.slice(1)) out[s] = Math.round(RATE[s] * durMin * (s === 'tl' || s === 'rv' ? k : 1) * 60);
  return out;
}
/* 10/10/2026: צפי נלמד (studioeta.js בשרתון). העבודה מקבלת בלקיחה תוכנית (ep: p50 לכל שלב + אי־ודאות);
   לעבודה שעוד לא נלקחה — המודל מ־status. planFrom = planOf בשרתון (tests/studio-eta.test.js משווה). */
export const Q_DEF = [0, 0.295, 0.449];          // לפני 8 עבודות: σ=0.35 → p80 = ×1.34, p90 = ×1.57 (זהה לשרתון)
const ETA_ST = ['tr', 'al', 'tl', 'rv', 'bn', 'sv'];
export const PX_EXP = 0.85;   // = PX_EXP בשרתון: הצריבה לפי "דקות אפקטיביות" = דקות × px^0.85 (px = פיקסלים לשנייה מול 1080p30)
export function planFrom(model, modeMin, durSec, px) {
  if (!model || !model.st) return null;
  const m = (durSec > 0 ? durSec : 3600) / 60, k = (modeMin > 0 ? modeMin : 105) / 105, s = {};
  const pf = px >= 0.02 && px <= 16 ? Math.pow(px, PX_EXP) : 1;
  let t = 0;
  for (const x of ETA_ST) {
    const ab = model.st[x];
    if (!Array.isArray(ab)) return null;
    s[x] = Math.round((ab[0] + ab[1] * m * (x === 'bn' ? pf : 1)) * ((x === 'tl' || x === 'rv') ? k : 1));
    t += s[x];
  }
  return { s, t, q: Array.isArray(model.q) && model.q.length === 3 ? model.q : Q_DEF, n: model.n || 0 };
}
/* 21/10/2026 (מחקר הצפי השני — הסיכום ביומן): משכי שלבים מתפלגים בערך לוג־נורמלית (שגיאה כפלית). לשלב שרץ עכשיו
   הזמן שנשאר הוא לפי ההתפלגות המותנית — "בהינתן שעברו t שניות": q_p(T | T>t) = F⁻¹(F(t) + p·(1−F(t))).
   כך שלב שלוקח יותר מהצפוי לא "נתקע על פחות מדקה" — מה שנשאר בו גדל, כמו שקורה באמת לשלבים עם זנב ארוך. */
const SQ2 = Math.SQRT2;
function erf(x) {   // Abramowitz–Stegun 7.1.26 (שגיאה < 1.5e-7)
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
}
export const normCdf = (z) => 0.5 * (1 + erf(z / SQ2));
export function normInv(p) {   // Acklam (שגיאה יחסית < 1.2e-9)
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
/* הקוונטיל p של משך השלב בהינתן שעברו t שניות (median = הצפי, σ בסקאלה לוגריתמית) */
export function condQuantile(median, sigma, t, p) {
  const m = Math.max(1, median), sg = Math.max(0.05, sigma);
  if (!(t > 0)) return m * Math.exp(sg * normInv(p));
  const F = normCdf(Math.log(t / m) / sg);
  return Math.max(t, m * Math.exp(sg * normInv(F + p * (1 - F))));
}
export const STAGE_SIGMA = 0.45;   // אי־הוודאות של שלב בודד לפני שיש נתונים (גדולה משל העבודה כולה — שלבים מתקזזים)
/* זחילה: שלב בלי דיווח התקדמות פנימי (תשובה של Claude, כיול לפני צריבה) — הפס ממשיך לזוז לפי הזמן הצפוי,
   מתקרב ל־90% של השלב ולא מגיע לסופו עד שהשלב באמת נגמר (Apple HIG: פס שעומד נקרא כתקיעה; Harrison 2007) */
export const creep = (el, e) => 0.9 * (1 - Math.exp(-Math.max(0, el) / Math.max(1, e)));

/* מצב המסך: לכל שלב — הסתיים (כמה לקח) / עכשיו (כמה נשאר + אחוז) / מחכה (הערכה). והסכום: כמה נשאר בסך הכל.
   10/10/2026 (מחקר הצפי): השלב הנוכחי = שילוב של ההערכה עם הקצב בפועל לפי כמה התקדם (w = p/(p+0.15));
   שלבים שלא התחילו = ההערכה × ‎√ρ (ρ = בפועל/צפוי של השלבים שכבר הסתיימו בעבודה הזו — עומס בשרת משפיע על כולם);
   left = p50, left80/left90 = לפי אי־ודאות העבר, שמצטמצמת ככל שמתקדמים.
   21/10/2026: ההערכה של השלב הנוכחי = החציון המותנה (condQuantile) — לא "הצפי פחות מה שעבר"; הפס (pct) כולל זחילה
   בשלב בלי דיווח (p = max(מה שדווח, creep)); over = השלב עבר את ה־p90 שלו ("לוקח יותר מהרגיל").
   job = מה שהשרתון מחזיר (prog.stg: זמני התחלה וסיום אמיתיים מהעובד); up = מצב ההעלאה בטלפון {p, left, done} */
/* 22/10/2026: קובץ כתוביות קיים — = subsPlan ב־ibkr-proxy/lib/studioeta.js (אותם SUBS_STG): תמלול, יישור וצריבה קצרים */
export const SUBS_STG = { tr: 60, al: 10, bn: 15, sv: 30 };
export function subsPlan(pl) {
  if (!pl || !pl.s) return pl;
  const s = Object.assign({}, pl.s, SUBS_STG);
  return Object.assign({}, pl, { s, t: ['tr', 'al', 'tl', 'rv', 'bn', 'sv'].reduce((a, k) => a + (s[k] || 0), 0) });
}
/* 26/10/2026: קריוקי — = kaPlan ב־ibkr-proxy/lib/studioeta.js (אותם KA_STG): הפרדה, יישור וצריבה, בלי תרגום וביקורת */
export const KA_STG = { tr: [60, 90], al: [40, 30], bn: [30, 40], sv: [20, 2] };
export function kaPlan(pl, durSec) {
  const m = Math.max(0, Number(durSec) || 0) / 60, s = Object.assign({}, (pl && pl.s) || {});
  for (const k of ['tr', 'al', 'tl', 'rv', 'bn', 'sv']) s[k] = KA_STG[k] ? Math.round(KA_STG[k][0] + KA_STG[k][1] * m) : 0;
  return Object.assign({}, pl || {}, { s, t: ['tr', 'al', 'tl', 'rv', 'bn', 'sv'].reduce((a, k) => a + (s[k] || 0), 0) });
}
export function progressModel(job, est, up, now, q) {
  const prog = (job && job.prog) || {};
  const stg = prog.stg || {};
  const cur = prog.st || '';
  const ended = job && job.state === 'done';
  // v361: נכשלה / בוטלה — השלב שבו נעצרה נסגר בשרתון, אבל הוא לא "הושלם" (בלי ✓; "המשך" פותח אותו מחדש)
  const stopped = job && (job.state === 'failed' || job.state === 'cancelled');
  // 28/10/2026 (ניתוח הזמנים): התוצרים כבר אצלך (stg.sv.r מהשרתון) — מה שנשאר רץ ברקע (~5 דק׳ בפרק של 22 דק׳).
  // עד היום הטבעת עמדה על 99% ו"נשארו 10 שנ׳" כל הזמן הזה; עכשיו — מוכן (bg), והשמירה נמדדת עד שהתוצרים הגיעו
  const bg = !ended && !stopped && cur === 'sv' && !!(stg.sv && stg.sv.r > 0);
  const qq = Array.isArray(q) && q.length === 3 ? q : Q_DEF;
  // σ של שלב: מאי־הוודאות של העבודות הקודמות (q[2] = 1.28σ של העבודה) × 1.25, בין 0.25 ל־0.8
  const sgS = Math.max(0.25, Math.min(0.8, (qq[2] > 0 ? qq[2] / 1.2816 : STAGE_SIGMA / 1.25) * 1.25));
  // ρ: כמה לקחו השלבים שהסתיימו מול ההערכה שלהם (0.5–3)
  let dT = 0, dE = 0;
  for (const s of STAGES) {
    if (s === 'up' || !(stg[s] && stg[s].e && stg[s].s)) continue;
    dT += Math.max(0, (stg[s].e - stg[s].s) / 1000); dE += est[s] || 60;
  }
  const rho = dE > 0 && dT > 0 ? Math.max(0.5, Math.min(3, dT / dE)) : 1, adj = Math.sqrt(rho);
  const stages = [];
  let left = 0, doneW = 0, allW = 0;
  // 21/10/2026: שלב אחרי השלב הנוכחי שנסגר לפני שהנוכחי התחיל = מהסשן הקודם (לפני "המשך") — ייעשה שוב, לא ✓
  const ci = STAGES.indexOf(cur), c0 = cur && stg[cur] ? stg[cur].s : 0;
  const redo = (s) => !ended && ci >= 0 && STAGES.indexOf(s) > ci && c0 > 0 && stg[s] && stg[s].e > 0 && stg[s].e <= c0;
  // הזמן שהושקע בשלב בכל הסשנים (a = מה שנצבר לפני "המשך") — כך סכום השלבים = הזמן שעבר ביעדים
  const spent = (x) => Math.max(0, Math.round(((+x.a || 0) + (x.e > 0 && x.s > 0 ? x.e - x.s : 0)) / 1000));
  for (const s of STAGES) {
    const e0 = s === 'up' ? Math.max(30, up && up.est ? up.est : 60) : est[s] || 60;
    const e = s === 'up' ? e0 : Math.round(e0 * adj);
    allW += e0;
    let row;
    if (s === 'up') {
      if (up && up.done) row = { id: s, state: 'done', took: up.took || 0 };
      else row = { id: s, state: up && up.active ? 'now' : 'wait', left: up && up.left > 0 ? up.left : e, p: up ? up.p || 0 : 0, est: e };
    } else if (stopped && s === cur) row = { id: s, state: 'wait', est: e };
    else if (bg && s === 'sv') row = { id: s, state: 'done', took: Math.max(0, Math.round(((+stg.sv.a || 0) + stg.sv.r - stg.sv.s) / 1000)) };
    else if (ended || bg || (stg[s] && stg[s].e && !redo(s))) row = { id: s, state: 'done', took: stg[s] ? spent(stg[s]) : 0 };
    else if (s === cur && stg[s]) {
      const el = Math.max(0, (now - stg[s].s) / 1000), p = Math.max(0, Math.min(0.99, prog.p || 0));
      const tot0 = condQuantile(e, sgS, el, 0.5);       // משך השלב הצפוי בהינתן מה שכבר עבר
      // העובד יודע הכי טוב (eta); אחרת שילוב: ההערכה בהתחלה, הקצב בפועל ככל שמתקדמים (לא קופצים מיד לקצב — הוא רועש בהתחלה)
      let l;
      if (prog.eta != null) l = Math.max(0, prog.eta - Math.max(0, (now - (prog.at || now)) / 1000));
      else {
        const w = p > 0 ? p / (p + 0.15) : 0, tot = (1 - w) * tot0 + (p > 0 ? w * el / p : 0);
        l = Math.max(tot - el, (1 - p) * (tot0 - el));
      }
      l = Math.max(10, Math.round(l));
      // הפס: מה שדווח, ולפחות הזחילה לפי הזמן — אבל לא יותר ממה שהזמן שנשאר מרשה
      const pv = Math.max(p, Math.min(creep(el, e), el / (el + l)));
      const over = el > condQuantile(e, sgS, 0, 0.9) && el > 120;
      row = { id: s, state: 'now', left: l, p, pv, est: e, slow: over, over };
    } else row = { id: s, state: 'wait', est: e };
    if (row.state === 'done') doneW += e0;
    else if (row.state === 'now') { left += row.left; doneW += e0 * (row.pv != null ? row.pv : row.p || 0); }
    else left += row.est;
    stages.push(row);
  }
  const fin = ended || bg;
  const pct = fin ? 1 : Math.max(0, Math.min(0.99, doneW / allW));
  const k = (i) => Math.exp((qq[i] || 0) * (1 - pct));   // האי־ודאות קטנה ככל שנשאר פחות
  const l50 = fin ? 0 : Math.round(left * k(0));
  return { stages, left: l50, left80: fin ? 0 : Math.max(l50, Math.round(left * k(1))), left90: fin ? 0 : Math.max(l50, Math.round(left * k(2))), pct, rho, bg };
}

/* 21/10/2026: מה שמוצג — הטבעת לא חוזרת אחורה (חזרה = "משהו השתבש"), ושעת הסיום יציבה (ראו shownEnd בסטודיו).
   key = עבודה + מספר ההפעלה ("המשך" פותח מחדש — שם מותר להתחיל מנקודה אחרת) */
export function monoPct(memo, key, pct) {
  const prev = memo.get(key);
  const v = prev != null && prev > pct ? prev : pct;
  memo.set(key, v);
  return v;
}

const abortErr = () => { const e = new Error('aborted'); e.name = 'AbortError'; return e; };
const isAbort = (e) => !!e && (e.name === 'AbortError' || e.code === 'aborted');
function fatal(code) { const e = new Error(code); e.code = code; e.fatal = true; return e; }
async function driveErr(r) {
  let j = null; try { j = await r.json(); } catch (e) {}
  const reason = (((j && j.error && j.error.errors) || [])[0] || {}).reason || '';
  if (/storageQuotaExceeded|quotaExceeded/.test(reason)) return fatal('drive_full');
  const e = new Error('drive_http_' + r.status); e.code = e.message; e.status = r.status; return e;
}

/* PUT של חתיכה עם התקדמות בתוך החתיכה (XHR — ל־fetch אין התקדמות העלאה) וזיהוי חיבור תקוע.
   Drive מחזיר 308 בלי Location ("עוד לא הסתיים") — XHR מחזיר אותו כמו שהוא, עם כותרת Range. */
export function xhrPut(url, body, headers, onProgress, signal) {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    let last = Date.now(), stalled = false, user = false;
    const tick = setInterval(() => { if (Date.now() - last > STALL_MS) { stalled = true; x.abort(); } }, 5000);
    const end = () => clearInterval(tick);
    x.open('PUT', url);
    for (const [k, v] of Object.entries(headers || {})) x.setRequestHeader(k, v);
    if (x.upload) x.upload.onprogress = (e) => { last = Date.now(); if (onProgress) onProgress(e.loaded); };
    x.onload = () => { end(); let json = null; try { json = JSON.parse(x.responseText || 'null'); } catch (e) {} resolve({ status: x.status, range: x.getResponseHeader('Range'), json }); };
    x.onerror = () => { end(); resolve({ status: 0 }); };
    x.onabort = () => { end(); if (user) reject(abortErr()); else resolve({ status: 0, stalled }); };
    if (signal) {
      if (signal.aborted) { end(); reject(abortErr()); return; }
      signal.addEventListener('abort', () => { user = true; x.abort(); }, { once: true });
    }
    x.send(body == null ? null : body);
  });
}

/* ---------------- חילוץ הקול (Mediabunny) ---------------- */
const MB_URL = './vendor/mediabunny/mediabunny.min.mjs';
let mbLoad = null;
export const loadMediabunny = () => (mbLoad = mbLoad || import(MB_URL).catch((e) => { mbLoad = null; throw e; }));
/* קריאה מהירה (פחות משנייה גם לקובץ ענק — רק הכותרות): אורך + האם יש קול */
export async function probeVideo(file, load) {
  try {
    const MB = await (load || loadMediabunny)();
    const input = new MB.Input({ formats: MB.ALL_FORMATS, source: new MB.BlobSource(file) });
    const dur = await input.computeDuration();
    const at = await input.getPrimaryAudioTrack();
    return { dur: Number.isFinite(dur) ? Math.round(dur) : 0, audio: at ? String(at.codec || '') : '' };
  } catch (e) { return { dur: 0, audio: '', err: 'probe' }; }
}
/* ---------- סבב 2: בדיקת הסרטון לפני ההעלאה (בטלפון, בלי רשת ובלי טוקנים) ----------
   אורך, מידות, שפת הקול (כפי שמסומנת בקובץ), ושקט בהתחלה / בסוף + עוצמת הדיבור — מפענוח של חלונות קצרים בלבד
   (דקה בהתחלה, דקה בסוף ו־3 דגימות של 15 שנ׳ באמצע), כך שגם קובץ של כמה GB נבדק בשניות ובלי לטעון אותו לזיכרון */
export const INSPECT_WIN = 60, LEVEL_BIN = 0.5, SILENCE_DB = -45, QUIET_DB = -50;
const ISO3 = { eng: 'en', heb: 'he', ara: 'ar', rus: 'ru', fre: 'fr', fra: 'fr', spa: 'es', ger: 'de', deu: 'de', ita: 'it', por: 'pt', jpn: 'ja',
  chi: 'zh', zho: 'zh', kor: 'ko', tur: 'tr', pol: 'pl', dut: 'nl', nld: 'nl', hin: 'hi', yid: 'yi', per: 'fa', fas: 'fa', ukr: 'uk', gre: 'el', ell: 'el' };
export function langOf(code) {   // קוד השפה של רצועת הקול → קוד דו־אותי ('' = לא מסומן)
  const c = String(code || '').toLowerCase().split(/[-_]/)[0];
  if (!/^[a-z]{2,3}$/.test(c) || c === 'und' || c === 'mul' || c === 'zxx') return '';
  return c.length === 2 ? c : ISO3[c] || '';
}
/* צובר עוצמה לפי חלונות של LEVEL_BIN: מוסיפים חתיכות קול (מונו = ממוצע הערוצים) בלי לשמור אותן */
export function levelAcc(bin = LEVEL_BIN) {
  const m = new Map();
  return {
    add(t, sr, chans) {
      if (!chans.length || !(sr > 0)) return;
      const n = chans[0].length, k = chans.length;
      let b = Math.floor(t / bin), end = (b + 1) * bin, s = 0, c = 0;
      for (let j = 0; j < n; j++) {
        const tt = t + j / sr;
        if (tt >= end) { if (c) { const x = m.get(b) || [0, 0]; x[0] += s; x[1] += c; m.set(b, x); } b = Math.floor(tt / bin); end = (b + 1) * bin; s = 0; c = 0; }
        let v = 0;
        for (let q = 0; q < k; q++) v += chans[q][j];
        v /= k; s += v * v; c++;
      }
      if (c) { const x = m.get(b) || [0, 0]; x[0] += s; x[1] += c; m.set(b, x); }
    },
    bins() {
      return [...m.entries()].sort((a, b2) => a[0] - b2[0]).map(([b, [s, c]]) => ({ t: b * bin, db: s > 0 ? 10 * Math.log10(s / c) : -120 }));
    },
  };
}
/* כמה שניות של שקט בהתחלה ובסוף (רק מתוך החלונות שנבדקו), ועוצמת הדיבור = האחוזון ה־90 של החלונות */
export function edgeSilence(bins, dur, win = INSPECT_WIN, thr = SILENCE_DB, bin = LEVEL_BIN) {
  const loud = bins.filter((x) => x.db > thr);
  const head = loud.filter((x) => x.t < win), tail = loud.filter((x) => x.t + bin > dur - win);
  const lead = head.length ? head[0].t : Math.min(win, dur);
  const trail = tail.length ? Math.max(0, dur - (tail[tail.length - 1].t + bin)) : Math.min(win, dur);
  const dbs = bins.map((x) => x.db).sort((a, b) => a - b);
  const db = dbs.length ? Math.round(dbs[Math.min(dbs.length - 1, Math.floor(dbs.length * 0.9))]) : null;
  return { lead: Math.round(lead * 10) / 10, trail: Math.round(trail * 10) / 10, db };
}
export async function inspectSource(file, o = {}) {
  const MB = await (o.load || loadMediabunny)();
  const input = new MB.Input({ formats: MB.ALL_FORMATS, source: new MB.BlobSource(file) });
  const d = await input.computeDuration();
  const dur = Number.isFinite(d) && d > 0 ? d : 0;
  let vt = null;
  try { vt = await input.getPrimaryVideoTrack(); } catch (e) {}
  const at = await input.getPrimaryAudioTrack();
  const m = { dur: Math.round(dur), w: vt ? vt.displayWidth | 0 : 0, h: vt ? vt.displayHeight | 0 : 0, audio: at ? String(at.codec || '') : '', lang: at ? langOf(at.languageCode) : '',
    lead: null, trail: null, db: null };
  if (!at || !dur) return m;
  let ok = false;
  try { ok = await at.canDecode(); } catch (e) {}
  if (!ok) return m;   // קודק שהדפדפן לא מפענח — בלי בדיקת קול (לא "שקט")
  const win = Math.min(INSPECT_WIN, dur / 2), spans = [[0, win], [dur - win, dur]];
  if (dur > 4 * INSPECT_WIN) for (const f of [0.3, 0.5, 0.7]) spans.push([dur * f, dur * f + 15]);
  const sink = new MB.AudioBufferSink(at), acc = levelAcc();
  for (const [a, b] of spans) {
    for await (const x of sink.buffers(a, b)) {
      if (o.signal && o.signal.aborted) throw abortErr();
      const buf = x.buffer, k = Math.min(2, buf.numberOfChannels), ch = [];
      for (let q = 0; q < k; q++) ch.push(buf.getChannelData(q));
      acc.add(x.timestamp, buf.sampleRate, ch);
    }
  }
  return Object.assign(m, edgeSilence(acc.bins(), dur, win));
}
/* רצועת הקול בלי קידוד מחדש (העתקה) — Opus/Vorbis ל־WebM, כל השאר ל־M4A (המיכל שהספייק בדק על הראיון של אקמן).
   כשההעתקה בלתי אפשרית (קודק שהמיכל לא מקבל, ואין מקודד בדפדפן) — בלי קול, והעבודה מתחילה מהסרטון המלא */
/* 21/10/2026 (צילום המשתמש: "מוציאים את הקול ושולחים אותו קודם" — 17 דק׳, והשרת חיכה כל הזמן הזה; הסרטון המלא עלה אחר כך
   בדקה וחצי). "הקול קודם" נועד לרשת איטית — אבל כשהחילוץ בטלפון איטי, הכל חיכה לו. התזמור (טהור, בלי DOM — נבדק ב־node):
   הסרטון מתחיל לעלות מיד, במקביל לחילוץ; כשהקול מוכן — הסרטון ממתין (gate) עד שהקול עלה ברשת המלאה; הסרטון סיים לפני
   החילוץ — החילוץ נעצר ומתחילים מהסרטון. ברשת איטית — כמו קודם (החילוץ מהיר מההעלאה, והקול עולה ראשון).
   o: { needAudio, needVideo, signal, extract(signal), upAudio(ex), upVideo(gate), gate(), onPhase(ph), audioDone(f, ex),
        noAudio(why, videoFirst), videoDone(f), start() } */
export async function uploadBoth(o) {
  const sig = o.signal;
  let audioUp = false, vidP = null;
  const pause = () => new Promise((r) => setTimeout(r, o.pauseMs || 400));
  const vGate = async () => {
    if (o.gate) await o.gate();
    while (audioUp && !(sig && sig.aborted)) await pause();
  };
  const startVideo = () => {
    if (vidP || !o.needVideo) return vidP;
    vidP = Promise.resolve().then(() => o.upVideo(vGate));
    vidP.catch(() => {});                  // נבדק ב־await למטה — כאן רק שלא תהיה דחייה "לא מטופלת"
    return vidP;
  };
  if (o.needAudio) {
    o.onPhase('extract');
    startVideo();
    const exCtl = new AbortController();
    if (sig) sig.addEventListener('abort', () => exCtl.abort(), { once: true });
    let videoFirst = false, extracting = true;
    if (vidP) vidP.then(() => { if (extracting) { videoFirst = true; exCtl.abort(); } }, () => {});
    let ex;
    try { ex = await o.extract(exCtl.signal); }
    catch (e) { if (videoFirst) ex = { none: 'video_first' }; else if (e && (e.name === 'AbortError' || e.code === 'aborted')) throw e; else ex = { none: 'extract' }; }
    finally { extracting = false; }
    if (ex.none) o.noAudio(ex.none, videoFirst);
    else {
      o.onPhase('audio');
      audioUp = true;
      let f;
      try { f = await o.upAudio(ex); } finally { audioUp = false; }
      await o.audioDone(f, ex);
    }
  }
  if (o.start) await o.start();
  if (o.needVideo) {
    o.onPhase('video');
    const f = await startVideo();
    await o.videoDone(f);
  }
}

export async function extractAudio(file, o = {}) {
  const MB = await (o.load || loadMediabunny)();
  const input = new MB.Input({ formats: MB.ALL_FORMATS, source: new MB.BlobSource(file) });
  const at = await input.getPrimaryAudioTrack();
  if (!at) return { none: 'no_audio' };
  const webm = at.codec === 'opus' || at.codec === 'vorbis';
  const output = new MB.Output({ format: webm ? new MB.WebMOutputFormat() : new MB.Mp4OutputFormat(), target: new MB.BufferTarget() });
  const conv = await MB.Conversion.init({ input, output, video: { discard: true }, showWarnings: false });
  if (!conv.isValid) return { none: 'codec' };
  if (o.onProgress) conv.onProgress = (p) => o.onProgress(Math.max(0, Math.min(1, p)));
  if (o.signal) { if (o.signal.aborted) throw abortErr(); o.signal.addEventListener('abort', () => { conv.cancel().catch(() => {}); }, { once: true }); }
  await conv.execute();
  if (o.signal && o.signal.aborted) throw abortErr();
  const buf = output.target.buffer;
  return { blob: new Blob([buf], { type: webm ? 'audio/webm' : 'audio/mp4' }), ext: webm ? 'webm' : 'm4a', codec: String(at.codec || '') };
}

/* ---------------- השרתון + Drive ---------------- */
/* ---------- v387: סט הזהב — השוואה דטרמיניסטית לתרגום אנושי (בלי AI, בלי טוקנים) ---------- */
export const GOLD_REF_NAME = 'תרגום אנושי (ייחוס).srt', GOLD_REF_MAX = 2 * 1024 * 1024;
const tc = (h, m, s, ms) => ((+h * 60 + +m) * 60 + +s) * 1000 + +ms;
/* הסרת תגיות (<i>…</i>) בלי regex: כל מה שבין < ל־> יוצא, ושום < או > לא נשאר בטקסט */
function stripTags(s) {
  let out = '', inTag = false;
  for (const ch of s) {
    if (ch === '<') { inTag = true; continue; }
    if (ch === '>') { inTag = false; continue; }
    if (!inTag) out += ch;
  }
  return out;
}
/* SRT → [{a, b, t}] (מילישניות, טקסט בלי תגיות). שורה פגומה — מדלגים */
export function parseSrt(text) {
  const out = [];
  const blocks = String(text || '').replace(/^﻿/, '').replace(/\r\n?/g, '\n').split(/\n{2,}/);
  for (const b of blocks) {
    const lines = b.split('\n').filter((l) => l.trim() !== '');
    const i = lines.findIndex((l) => l.includes('-->'));
    if (i < 0) continue;
    const m = /(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/.exec(lines[i]);
    if (!m) continue;
    const t = stripTags(lines.slice(i + 1).join(' ')).replace(/\{[^}]*\}/g, '').replace(/\s+/g, ' ').trim();
    const a = tc(m[1], m[2], m[3], m[4].padEnd(3, '0')), z = tc(m[5], m[6], m[7], m[8].padEnd(3, '0'));
    if (z > a && t) out.push({ a, b: z, t });
  }
  return out.sort((x, y) => x.a - y.a);
}
/* chrF++ — port זהה ל־translator/tedeval.py (תואם sacrebleu: nc 6, nw 2, β 2, בלי lowercase, בלי רווחים בתווים).
   מאגר המדידות ו"סט הזהב" מודדים באותה נוסחה; שינוי כאן = גם שם (tests/studio-v387 בודק את אותם ערכי sacrebleu) */
const CHRF_PUNCT = new Set(Array.from('!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~'));
function chrfWords(s) {
  const out = [];
  for (const w of String(s).split(/\s+/).filter(Boolean)) {
    const a = Array.from(w);
    if (a.length === 1) out.push(w);
    else if (CHRF_PUNCT.has(a[a.length - 1])) out.push(a.slice(0, -1).join(''), a[a.length - 1]);
    else if (CHRF_PUNCT.has(a[0])) out.push(a[0], a.slice(1).join(''));
    else out.push(w);
  }
  return out;
}
function ngramStat(h, r, n) {
  const count = (a) => { const m = new Map(); for (let i = 0; i + n <= a.length; i++) { const g = a.slice(i, i + n).join('\u0001'); m.set(g, (m.get(g) || 0) + 1); } return m; };
  const gh = count(h), gr = count(r);
  let th = 0, tr = 0, mt = 0;
  for (const v of gh.values()) th += v;
  for (const v of gr.values()) tr += v;
  for (const [g, v] of gh) mt += Math.min(v, gr.get(g) || 0);
  return [mt, th, tr];
}
export function chrfpp(hyp, ref, nc = 6, nw = 2, beta = 2) {
  const ch = Array.from(String(hyp || '').split(/\s+/).join('')), cr = Array.from(String(ref || '').split(/\s+/).join(''));
  const hw = chrfWords(hyp || ''), rw = chrfWords(ref || ''), st = [];
  for (let n = 1; n <= nc; n++) st.push(ngramStat(ch, cr, n));
  for (let n = 1; n <= nw; n++) st.push(ngramStat(hw, rw, n));
  let ap = 0, ar = 0, eff = 0;
  for (const [m, ht, rt] of st) if (ht > 0 && rt > 0) { ap += m / ht; ar += m / rt; eff++; }
  if (!eff) return 0;
  ap /= eff; ar /= eff;
  if (ap + ar === 0) return 0;
  const b2 = beta * beta;
  return 100 * (1 + b2) * ap * ar / (b2 * ap + ar);
}
/* נרמול עברית לפני השוואה — זהה ל־norm_he: תווי כיוון וניקוד החוצה, גרשיים/מקף/שלוש־נקודות אחידים */
export function normHe(s) {
  return String(s || '').replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, '').replace(/[\u05b0-\u05bd\u05bf\u05c1\u05c2\u05c4\u05c5\u05c7]/g, '')
    .replace(/[״“”]/g, '"').replace(/[׳‘’]/g, "'").replace(/[־–—]/g, '-').replace(/…/g, '...').split(/\s+/).filter(Boolean).join(' ');
}
const SOUND_ONLY = /^[\s(\[][^)\]]*[)\]][\s.!?]*$/;     // (מחיאות כפיים) — יורדת משני הצדדים, כמו ב־tedeval
/* כמה מזמן הדיבור בתרגום האנושי מכוסה בכתוביות שלנו (%) */
export function timeCover(hyp, ref) {
  let tot = 0, cov = 0;
  for (const c of ref) {
    tot += c.b - c.a;
    for (const x of hyp) { if (x.b <= c.a) continue; if (x.a >= c.b) break; cov += Math.min(c.b, x.b) - Math.max(c.a, x.a); }
  }
  return tot ? Math.round(Math.min(1, cov / tot) * 1000) / 10 : 0;
}
/* הציון של עבודה מול הייחוס (כמו chrf_doc של tedeval): s = chrF++ על כל הטקסט המנורמל לפי סדר הזמן
   (בלי כתוביות של צלילים, ובלי שלנו לפני הכתובית הראשונה בייחוס), tm = כיסוי הזמן, n = כתוביות בייחוס */
export function goldCompare(hypText, refText) {
  const r = parseSrt(refText).filter((c) => !SOUND_ONLY.test(c.t));
  if (!r.length) return null;
  const h = parseSrt(hypText).filter((c) => !SOUND_ONLY.test(c.t) && (c.a + c.b) / 2 >= r[0].a);
  const doc = (cs) => normHe(cs.map((c) => c.t).join(' '));
  return { s: Math.round(chrfpp(doc(h), doc(r))), tm: Math.round(timeCover(h, r)), n: r.length };
}

/* 26/10/2026: מילים לקריוקי מ־LRCLIB (מאגר פתוח, בלי מפתח, CORS פתוח) — ישירות מהטלפון, רק שם השיר יוצא.
   התשובה = טקסט מאתר חיצוני: רק שדות מוכרים, אורך מוגבל, ומוצג/נכנס לשדה רק כטקסט */
export const LRC_API = 'https://lrclib.net/api/search';
const LRC_MAX = 8000;   // = KA_LYR_MAX
const LRC_CTL = /[\u0000-\u0008\u000b-\u001f\u007f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;
const lrcStr = (v, n) => String(v == null ? '' : v).replace(LRC_CTL, '').replace(/\r\n?/g, '\n').slice(0, n);
/* שורות מתוזמנות [mm:ss.xx] → טקסט רגיל (שורות ריקות של מעבר נשמרות כרווח בין בתים) */
export function lrcPlain(synced) {
  return lrcStr(synced, LRC_MAX * 2).split('\n').map((l) => l.replace(/^(\s*\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\])+\s*/, '')).join('\n')
    .replace(/\n{3,}/g, '\n\n').trim().slice(0, LRC_MAX);
}
/* שם הקובץ / הכותרת → שאילתה: בלי סיומת, סוגריים ("Official Video", "[HD]") ומילים של יוטיוב */
export function lyrGuess(name) {
  let t = String(name || '').replace(/\.[A-Za-z0-9]{2,4}$/, '').replace(/[_]+/g, ' ');
  t = t.replace(/[([{][^)\]}]*[)\]}]/g, ' ')
    .replace(/\b(official|music|lyric|lyrics|video|audio|clip|hd|hq|4k|1080p|720p|remaster(?:ed)?|live)\b/gi, ' ')
    .replace(/(^|\s)(?:הקליפ הרשמי|קליפ רשמי|גרסה רשמית|הקליפ|קליפ|מילים)(?=\s|$)/g, ' ')   // \b לא מכיר עברית
    .replace(/\s*[|•·]\s*/g, ' - ').replace(/\s+/g, ' ').replace(/(\s-)+\s*$/, '').replace(/^[\s-]+|[\s-]+$/g, '');
  return t.slice(0, 120);
}
/* תשובת LRCLIB → עד 8 תוצאות עם מילים, הקרובות באורך לשיר קודם (ואז מתוזמנות). dur = אורך השיר בשניות (0 = לא ידוע) */
export function lrcResults(json, dur) {
  if (!Array.isArray(json)) return [];
  const out = [];
  for (const x of json.slice(0, 40)) {
    if (!x || typeof x !== 'object' || x.instrumental) continue;
    const sy = typeof x.syncedLyrics === 'string' ? x.syncedLyrics : '';
    const plain = lrcStr(typeof x.plainLyrics === 'string' && x.plainLyrics.trim() ? x.plainLyrics : lrcPlain(sy), LRC_MAX).trim();
    if (!plain) continue;
    const d = Number(x.duration) > 0 && Number(x.duration) < 7200 ? Math.round(Number(x.duration)) : 0;
    out.push({ t: lrcStr(x.trackName, 120).trim(), a: lrcStr(x.artistName, 120).trim(), d, s: !!sy, plain });
  }
  const off = (r) => (dur > 0 && r.d > 0 ? Math.abs(r.d - dur) : 999);
  const seen = new Set();
  return out.map((r, i) => ({ r, i })).sort((x, y) => (Math.min(off(x.r), 999) > 3) - (Math.min(off(y.r), 999) > 3) || off(x.r) - off(y.r) || (y.r.s - x.r.s) || x.i - y.i)
    .map((x) => x.r).filter((r) => { const k = r.plain.slice(0, 200); if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, 8).map((r) => Object.assign(r, { m: dur > 0 && r.d > 0 && Math.abs(r.d - dur) <= 3 }));
}

/* ---------------- 28/10/2026: כתוביות רשמיות מהרשת (בקשת המשתמש — "כמו VLC / BS Player / Stremio") ----------------
   ישירות מהטלפון: CORS פתוח, בלי מפתח, והמכסה של המשתמש ולא של השרת (החלטת המשתמש). יוצא רק: טביעת האצבע והגודל,
   מזהה IMDb ושם הסדרה/הסרט — הקובץ עצמו לא. זיהוי: טביעת האצבע של OpenSubtitles (64KB מההתחלה + 64KB מהסוף + הגודל)
   מול rest.opensubtitles.org, אחרת שם הקובץ מול Cinemeta. חיפוש: OpenSubtitles דרך Stremio (עם הטביעה — m:'h' = תואם
   בדיוק) ו־Wizdom (עברית). מקור שלא עונה תוך NS_MS — מדלגים עליו. התשובות = טקסט מאתר חיצוני: רק שדות מוכרים, אורך מוגבל */
export const NS_OSH = 'https://rest.opensubtitles.org/search/';
export const NS_OS3 = 'https://opensubtitles-v3.strem.io/subtitles/';
export const NS_META = 'https://v3-cinemeta.strem.io/catalog/';
export const NS_WIZ = 'https://wizdom.xyz/api/';
export const NS_SRC = { os: 'OpenSubtitles', wz: 'Wizdom' };   // שם המקור שמוצג למשתמש
const NS_MS = 9000, NS_MAX = 3 * 1024 * 1024, NS_CH = 65536;
const nsStr = (v, n) => String(v == null ? '' : v).replace(LRC_CTL, '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, n);
/* טביעת האצבע של OpenSubtitles: הגודל + סכום של מילים של 64 ביט (little-endian) ב־64KB הראשונים והאחרונים. blob = {size, slice} */
export async function osHash(blob) {
  if (blob && /^[0-9a-f]{16}$/.test(String(blob.oh || ''))) return blob.oh;   // 30/10/2026: מהאפליקציה (PhCore.osHash) — הקובץ לא בדף
  const size = blob && Number(blob.size);
  if (!(size >= NS_CH) || typeof BigInt !== 'function') return '';
  const M = (BigInt(1) << BigInt(64)) - BigInt(1);
  let h = BigInt(size);
  for (const [a, b] of [[0, NS_CH], [size - NS_CH, size]]) {
    const u = new Uint8Array(await blob.slice(a, b).arrayBuffer());
    const dv = new DataView(u.buffer, u.byteOffset, u.byteLength);
    for (let i = 0; i + 8 <= u.length; i += 8) h = (h + dv.getBigUint64(i, true)) & M;
  }
  return h.toString(16).padStart(16, '0');
}
/* שם הקובץ → { q: שם הסדרה/הסרט, s, e, y }. SxxEyy / 1x02 / שנה; מה שאחרי (איכות, קבוצה) יורד */
export function nsGuess(name) {
  const t = ' ' + String(name || '').replace(/\.[A-Za-z0-9]{2,4}$/, '').replace(/[._]+/g, ' ') + ' ';
  let s = 0, e = 0, y = 0, cut = t.length;
  const m = /[\s\-[(]s(\d{1,2})\s?-?\s?e(\d{1,3})(?!\d)/i.exec(t) || /[\s\-[(](\d{1,2})x(\d{2,3})(?!\d)/i.exec(t);
  if (m) { s = +m[1]; e = +m[2]; cut = m.index; }
  const ym = /[\s([]((?:19|20)\d{2})(?=[\s)\]])/.exec(t.slice(0, Math.max(cut, 5)) + ' ') || (!m && /[\s([]((?:19|20)\d{2})(?=[\s)\]])/.exec(t));
  if (ym && ym.index > 0) { y = +ym[1]; cut = Math.min(cut, ym.index); }
  const q0 = /\b(2160p|1080[pi]|720p|480p|web-?dl|webrip|bluray|brrip|bdrip|dvdrip|hdtv|x26[45]|h ?26[45]|hevc|proper|repack)\b/i.exec(t);
  if (q0 && q0.index < cut) cut = q0.index;
  const q = t.slice(0, cut).replace(/[[({][^\])}]*[\])}]/g, ' ').replace(/\s+-\s*$/, '').replace(/\s+/g, ' ').trim().slice(0, 100);
  return { q, s, e, y };
}
/* שם הוצאה תואם לשם הקובץ? (אותה קבוצה / אותה איכות+מקור) — רמת ההתאמה 'r' */
const nsToks = (x) => new Set(String(x || '').toLowerCase().replace(/\.[a-z0-9]{2,4}$/, '').split(/[\s._\-[\]()]+/).filter((w) => w.length > 1));
const NS_INFO = /^(2160p|1080[pi]|720p|480p|web|webdl|webrip|dl|bluray|brrip|bdrip|dvdrip|hdtv|x264|x265|h264|h265|hevc|amzn|nf|dsnp|hmax|atvp|hulu)$/;
export function nsRelMatch(fileName, rel) {
  const a = nsToks(fileName), b = nsToks(rel);
  const ga = String(fileName || '').replace(/\.[A-Za-z0-9]{2,4}$/, '').split('-').pop().toLowerCase().trim();
  const gb = String(rel || '').replace(/\.[A-Za-z0-9]{2,4}$/, '').split('-').pop().toLowerCase().trim();
  if (ga && ga.length > 2 && ga === gb && !/\s/.test(ga)) return true;
  let n = 0;
  for (const w of a) if (NS_INFO.test(w) && b.has(w)) n++;
  return n >= 2;
}
const ttId = (n) => { const d = String(n || '').replace(/^tt/, ''); return /^\d{1,9}$/.test(d) && +d > 0 ? 'tt' + d.padStart(7, '0') : ''; };
/* תשובת החיפוש לפי טביעה → הזיהוי. הטביעה משותפת לפעמים לכמה כותרים — רוב, ועדיפות למה שתואם לשם הקובץ */
export function nsPickHash(json, g) {
  if (!Array.isArray(json)) return null;
  const votes = new Map();
  for (const x of json.slice(0, 80)) {
    if (!x || typeof x !== 'object') continue;
    const ep = x.MovieKind === 'episode' && ttId(x.SeriesIMDBParent) && +x.SeriesSeason > 0 && +x.SeriesEpisode > 0;
    const id = ep ? ttId(x.SeriesIMDBParent) : ttId(x.IDMovieImdb);
    if (!id) continue;
    const r = ep ? { type: 'series', id, s: +x.SeriesSeason, e: +x.SeriesEpisode } : { type: 'movie', id, s: 0, e: 0 };
    const k = r.id + ':' + r.s + ':' + r.e;
    const v = votes.get(k) || Object.assign(r, { t: nsStr(String(x.MovieName || '').replace(/^"([^"]+)".*$/, '$1'), 100), n: 0 });
    v.n++; votes.set(k, v);
  }
  const all = [...votes.values()].sort((a, b) => b.n - a.n);
  if (!all.length) return null;
  const fit = g && g.s ? all.find((v) => v.s === g.s && v.e === g.e) : null;
  return Object.assign({}, fit || all[0], { by: 'h' });
}
/* תשובת Cinemeta → הזיהוי לפי השם (עדיפות לשנה התואמת) */
export function nsPickMeta(json, g) {
  const ms = json && Array.isArray(json.metas) ? json.metas.slice(0, 10) : [];
  const ok = ms.filter((m) => m && ttId(m.imdb_id || m.id));
  if (!ok.length) return null;
  const m = (g && g.y && ok.find((x) => String(x.releaseInfo || x.year || '').startsWith(String(g.y)))) || ok[0];
  const ser = !!(g && g.s);
  return { type: ser ? 'series' : 'movie', id: ttId(m.imdb_id || m.id), s: ser ? g.s : 0, e: ser ? g.e : 0, t: nsStr(m.name, 100), by: 'n' };
}
/* תשובת Stremio (OpenSubtitles) → פריטים אחידים. url רק מ־https://*.strem.io */
export function nsParseOs(json, fileName) {
  const L = json && Array.isArray(json.subtitles) ? json.subtitles.slice(0, 400) : [];
  const out = [];
  for (const x of L) {
    if (!x || typeof x !== 'object') continue;
    const url = String(x.url || '');
    if (!/^https:\/\/[a-z0-9-]+\.strem\.io\/[^\s"'<>]{1,400}$/i.test(url)) continue;
    const lang = lang2(x.lang === 'pob' ? 'pt' : x.lang);
    if (!/^[a-z]{2,3}$/.test(lang)) continue;
    const rel = nsStr(x.movieReleaseName || x.subtitleFileName, 160);
    const fps = Number(x.fpsMilli) > 0 && Number(x.fpsMilli) < 200000 ? Math.round(Number(x.fpsMilli)) / 1000 : 0;
    out.push({ id: 'os:' + nsStr(x.id, 40).replace(/[^\w-]/g, ''), src: 'os', url, lang, rel, fps, m: x.m === 'h' ? 'h' : nsRelMatch(fileName, rel) ? 'r' : 'n' });
  }
  return out;
}
/* תשובת Wizdom → פריטים (עברית, קובץ zip) */
export function nsParseWiz(json, fileName) {
  if (!Array.isArray(json)) return [];
  return json.slice(0, 200).filter((x) => x && /^\d{1,9}$/.test(String(x.id))).map((x) => {
    const rel = nsStr(x.versioname, 160);
    return { id: 'wz:' + x.id, src: 'wz', url: NS_WIZ + 'files/sub/' + x.id, lang: 'he', rel, fps: 0, zip: 1, m: nsRelMatch(fileName, rel) ? 'r' : 'n' };
  });
}
/* סדר: תואם בדיוק → אותה הוצאה → השאר; בלי כפולים (אותה שפה + אותו שם הוצאה ממקור אחר נשאר — המקור שונה) */
export function nsSort(list) {
  const rank = { h: 0, r: 1, n: 2 };
  const seen = new Set();
  return list.map((x, i) => ({ x, i })).sort((a, b) => rank[a.x.m] - rank[b.x.m] || a.i - b.i).map((o) => o.x)
    .filter((x) => { if (seen.has(x.id)) return false; seen.add(x.id); return true; });
}
/* zip (Wizdom): הקובץ שתואם לפרק (SxxEyy) או הראשון; stored או deflate. לא zip → כמו שהוא */
export async function nsUnzip(u, g) {
  if (!(u && u.length > 22 && u[0] === 0x50 && u[1] === 0x4b)) return u;
  const dv = new DataView(u.buffer, u.byteOffset, u.byteLength);
  let eo = -1;
  for (let i = u.length - 22; i >= Math.max(0, u.length - 66000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eo = i; break; }
  if (eo < 0) throw new Error('zip');
  const cnt = dv.getUint16(eo + 10, true);
  let p = dv.getUint32(eo + 16, true);
  const ents = [];
  for (let k = 0; k < cnt && p + 46 <= u.length && dv.getUint32(p, true) === 0x02014b50; k++) {
    const meth = dv.getUint16(p + 10, true), csz = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true);
    const el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
    const name = new TextDecoder('latin1').decode(u.subarray(p + 46, p + 46 + nl));
    if (/\.(srt|ass|ssa|vtt)$/i.test(name)) ents.push({ name, meth, csz, lo });
    p += 46 + nl + el + cl;
  }
  if (!ents.length) throw new Error('zip');
  const se = g && g.s ? new RegExp('s0?' + g.s + '\\s?[._-]?\\s?e0?' + g.e + '(?!\\d)|(?:^|\\D)' + g.s + 'x0?' + g.e + '(?!\\d)', 'i') : null;
  const ent = (se && ents.find((x) => se.test(x.name))) || ents[0];
  const lo = ent.lo;
  if (dv.getUint32(lo, true) !== 0x04034b50) throw new Error('zip');
  const st = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true);
  const data = u.subarray(st, st + ent.csz);
  if (ent.meth === 0) return data.slice();
  if (ent.meth !== 8 || typeof DecompressionStream !== 'function') throw new Error('zip');
  const out = new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw')));
  return new Uint8Array(await out.arrayBuffer());
}

export function createNet(env) {
  const E = Object.assign({ fetch: (...a) => fetch(...a), now: () => Date.now(), sleep: (ms) => new Promise((r) => setTimeout(r, ms)), put: xhrPut }, env);
  let dtok = null;      // { at, exp } — גישה זמנית ל־Drive (שעה), רק בזיכרון

  async function api(op, body) {
    let tk = '';
    try { tk = await E.idToken(); } catch (e) {}
    if (!tk) return { ok: false, error: 'signin' };
    let r;
    try {
      // 25/10/2026: learnUx נשלח גם כשהדף נסגר (pagehide) — keepalive כדי שהבקשה לא תבוטל עם הדף (גוף קטן, ≤64KB)
      r = await E.fetch(E.base() + '/api/studio', Object.assign({ method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, E.headers ? E.headers() : {}),
        body: JSON.stringify(Object.assign({}, body || {}, { op, idToken: tk })) }, op === 'learnUx' || op === 'fnl' ? { keepalive: true } : {}));
    } catch (e) { return { ok: false, error: 'net' }; }
    let j = null; try { j = await r.json(); } catch (e) {}
    return j && typeof j === 'object' ? j : { ok: false, error: 'http_' + r.status };
  }

  async function driveToken(force) {
    if (!force && dtok && dtok.exp - 120e3 > E.now()) return dtok.at;
    const j = await api('drive');
    if (!j.ok || !j.token) { const e = new Error(j.error || 'drive'); e.code = j.error || 'drive'; e.fatal = j.error === 'not_connected' || j.error === 'revoked' || j.error === 'not_allowed'; throw e; }
    dtok = { at: j.token, exp: Math.min(j.exp || 0, E.now() + 3500e3) || E.now() + 3000e3 };
    return dtok.at;
  }
  /* בקשה ל־Drive עם הגישה הזמנית: 401 = גישה חדשה פעם אחת; 429/5xx = עוד שני ניסיונות */
  async function dreq(method, url, body) {
    let force = false;
    for (let a = 0; ; a++) {
      const r = await E.fetch(url, { method, body: body ? JSON.stringify(body) : undefined,
        headers: Object.assign({ Authorization: 'Bearer ' + await driveToken(force) }, body ? { 'Content-Type': 'application/json; charset=UTF-8' } : {}) });
      force = false;
      if (r.status === 401 && a === 0) { force = true; continue; }
      if ((r.status === 429 || r.status >= 500) && a < 2) { await E.sleep(800 * (a + 1)); continue; }
      if (r.status < 200 || r.status >= 300) throw await driveErr(r);
      return r.json();
    }
  }
  const q = (s) => encodeURIComponent(s);
  async function folder(name, key, val, parent, description) {
    const qs = "appProperties has { key='" + key + "' and value='" + val + "' } and trashed=false and mimeType='" + FOLDER + "'" + (parent ? " and '" + parent + "' in parents" : '');
    const j = await dreq('GET', API + '?q=' + q(qs) + '&fields=files(id)&pageSize=5&spaces=drive');
    if (j && j.files && j.files.length) return j.files[0].id;
    const meta = { name, mimeType: FOLDER, appProperties: { [key]: val } };
    if (parent) meta.parents = [parent];
    if (description) meta.description = description;
    return (await dreq('POST', API + '?fields=id', meta)).id;
  }
  /* תיקיית הפרויקט (נמצאת לפי המזהה — גם אחרי רענון / ממכשיר אחר, בלי ליצור כפילות) */
  async function jobFolder(jobId, title) {
    const root = await folder(ROOT_NAME, 'snbStudio', '1', '', 'הסרטונים והתרגומים של סטודיו התרגום ב־THE SNOWBALL.');
    return folder(String(title || jobId).slice(0, 180), 'snbJob', jobId, root);
  }
  async function initUpload(meta, size, mime) {
    for (let a = 0; a < 2; a++) {
      const r = await E.fetch(UP + '?uploadType=resumable&fields=id,name,size,mimeType,parents', { method: 'POST',
        headers: { Authorization: 'Bearer ' + await driveToken(a > 0), 'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': mime || 'application/octet-stream', 'X-Upload-Content-Length': String(size) },
        body: JSON.stringify(meta) });
      if (r.status === 401 && a === 0) continue;
      const loc = r.headers && r.headers.get ? r.headers.get('Location') : '';
      if (r.status >= 200 && r.status < 300 && loc) return loc;
      throw await driveErr(r);
    }
    throw fatal('drive_auth');
  }

  /* העלאה של קובץ אחד. o: { blob, size, mime, meta, uri, onUri, onProgress(bytes), onWait(why|err), gate(), signal }
     מחזיר את הקובץ ש־Drive יצר ({ id, name, size, mimeType, parents }). אפשר לעצור (signal) ולהמשיך אחר כך עם אותה כתובת */
  async function upload(o) {
    const parent = o.meta && Array.isArray(o.meta.parents) ? o.meta.parents[0] : '';
    if (isR2Folder(parent)) {   // ת4: עבודה במצב שרת — ל־R2 (st = מצב ההעלאה השמור, להמשך אחרי רענון)
      return r2Upload({ api, job: r2JobOf(parent), name: (o.meta && o.meta.name) || '', blob: o.blob, size: o.size, mime: o.mime,
        signal: o.signal, gate: o.gate, onProgress: o.onProgress, onWait: o.onWait, onState: o.onR2, st: o.r2 },
      { put: E.put, sleep: E.sleep, now: E.now, online: E.online });
    }
    const size = o.size, mime = o.mime || 'application/octet-stream';
    let uri = o.uri || '', next = 0, fails = 0, need = !!uri, chunk = CHUNK_START;
    const stopped = () => o.signal && o.signal.aborted;
    for (;;) {
      if (stopped()) throw abortErr();
      if (o.gate) await o.gate();
      try {
        if (!uri) { uri = await initUpload(o.meta, size, mime); next = 0; need = false; if (o.onUri) o.onUri(uri); }
        if (need) {           // "כמה הגיע?" — אחרי רענון, אחרי תקלה, ואחרי חיבור שנתקע
          const s = await E.put(uri, null, { 'Content-Range': 'bytes */' + size }, null, o.signal);
          if (s.status === 200 || s.status === 201) { if (o.onProgress) o.onProgress(size); return s.json || {}; }
          if (s.status === 404 || s.status === 410) { uri = ''; continue; }      // הכתובת פגה (שבוע) — מתחילים כתובת חדשה
          if (s.status !== 308) throw Object.assign(new Error('drive_http_' + s.status), { code: 'drive_http_' + s.status });
          next = rangeNext(s.range); need = false;
          if (o.onProgress) o.onProgress(next);
        }
        if (next >= size) throw Object.assign(new Error('drive_range'), { code: 'net' });   // הכל הגיע אבל לא נסגר — שואלים שוב
        const end = Math.min(size, next + chunk) - 1;
        const t0 = E.now(), start = next;
        const r = await E.put(uri, o.blob.slice(start, end + 1), { 'Content-Range': 'bytes ' + start + '-' + end + '/' + size, 'Content-Type': mime },
          (b) => { if (o.onProgress) o.onProgress(start + Math.min(b, end + 1 - start)); }, o.signal);
        if (r.status === 200 || r.status === 201) { if (o.onProgress) o.onProgress(size); return r.json || {}; }
        if (r.status === 308) {
          const got = rangeNext(r.range);
          if (got > start) { fails = 0; chunk = nextChunk((got - start) / Math.max(0.2, (E.now() - t0) / 1000)); }
          next = got;
          if (o.onProgress) o.onProgress(next);
          continue;
        }
        if (r.status === 404 || r.status === 410) { uri = ''; continue; }
        if (r.status === 403) { let reason = ''; try { reason = JSON.stringify(r.json || ''); } catch (e) {} if (/storageQuotaExceeded|quotaExceeded/.test(reason)) throw fatal('drive_full'); }
        if (r.status >= 400 && r.status < 500 && r.status !== 408 && r.status !== 429) throw fatal('drive_http_' + r.status);
        throw Object.assign(new Error(r.stalled ? 'stalled' : 'drive_http_' + r.status), { code: r.stalled ? 'stalled' : 'net' });
      } catch (e) {
        if (isAbort(e) || stopped()) throw abortErr();
        if (e.fatal) throw e;
        if (E.online && !E.online()) fails = Math.min(fails, 3);     // בלי רשת מחכים כמה שצריך — זו לא שגיאה
        else fails++;
        if (fails > MAX_FAILS) throw e;
        need = !!uri;
        chunk = Math.max(CHUNK_MIN, Math.round(chunk / 2 / K256) * K256);   // אחרי תקלה — חתיכה קטנה יותר
        if (o.onWait) o.onWait(e);
        await E.sleep(backoff(fails || 1));
      }
    }
  }

  /* חיבור Drive (חלון ההסכמה; libbackup.js מקבל Response) — v357: לקוח OAuth נפרד לסטודיו, דרך /api/studio ולא השרתון של הספרייה */
  const driveApi = (body) => E.fetch(E.base() + '/api/studio', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, E.headers ? E.headers() : {}), body: JSON.stringify(body) });

  /* תבנית "קוד ההקמה" של השרת (infra/cloud-init.yaml) — מאותו אתר שממנו נטענה האפליקציה, כלומר אותו מקור אמון
     כמו הקוד עצמו. בלי מטמון: גרסה ישנה של התבנית = שרת שמוקם בהגדרה ישנה */
  async function cloudInitTemplate() {
    try { const r = await E.fetch('infra/cloud-init.yaml', { cache: 'no-store' }); if (r.ok) return await r.text(); } catch (e) {}
    return '';
  }

  /* 11/10/2026: המילון ב־R2 כשהשרתון מוגדר (id = 'r2'): קישורים חתומים לחמש דקות, הקובץ עובר ישירות.
     עוד אין שם קובץ → מהמילון הישן ב־Drive (אם יש) ומעבירים אותו פעם אחת ל־R2; Drive לא מחובר — מתחילים ריק.
     שרתון בלי R2 (או גרסה ישנה) → Drive בדיוק כמו קודם */
  async function glossLoad() {
    const u = await api('glossUrl');
    if (!(u && u.ok && u.r2 && u.get && u.put)) return glossLoadDrive();
    const r = await E.fetch(u.get, { cache: 'no-store' });
    if (r.status === 200) return { id: 'r2', rows: glParse(await r.text()) };
    if (r.status !== 404) throw Object.assign(new Error('r2_' + r.status), { code: 'r2' });
    let rows = [];
    try { rows = (await glossLoadDrive()).rows; } catch (e) { rows = []; }
    if (rows.length) await glossPutR2(rows, u.put);
    return { id: 'r2', rows, moved: rows.length };
  }
  async function glossPutR2(rows, url) {
    const r = await E.fetch(url, { method: 'PUT', body: glFormat(rows), headers: { 'Content-Type': 'text/tab-separated-values; charset=UTF-8' } });
    if (!r.ok) throw Object.assign(new Error('r2_' + r.status), { code: 'r2' });
  }
  /* v380: המילון ב־Drive — {id, rows}. אין קובץ = רשימה ריקה (נוצר בשמירה הראשונה, בתיקיית הסטודיו) */
  async function glossLoadDrive() {
    const qs = "appProperties has { key='snbGloss' and value='1' } and trashed=false";
    const j = await dreq('GET', API + '?q=' + q(qs) + '&fields=files(id,size)&pageSize=3&spaces=drive');
    const f = j && j.files && j.files[0];
    if (!f) return { id: '', rows: [] };
    const r = await E.fetch(API + '/' + f.id + '?alt=media', { headers: { Authorization: 'Bearer ' + await driveToken() } });
    if (!r.ok) throw await driveErr(r);
    return { id: f.id, rows: glParse(await r.text()) };
  }
  async function glossSave(id, rows) {
    if (id === 'r2') {
      const u = await api('glossUrl');
      if (!(u && u.ok && u.r2 && u.put)) throw Object.assign(new Error(u && u.error || 'r2'), { code: u && u.error || 'r2' });
      await glossPutR2(rows, u.put);
      return 'r2';
    }
    const body = glFormat(rows);
    if (id) {
      const r = await E.fetch(UP + '/' + id + '?uploadType=media&fields=id', { method: 'PATCH', body,
        headers: { Authorization: 'Bearer ' + await driveToken(), 'Content-Type': 'text/tab-separated-values; charset=UTF-8' } });
      if (!r.ok) throw await driveErr(r);
      return id;
    }
    const root = await folder(ROOT_NAME, 'snbStudio', '1', '', 'הסרטונים והתרגומים של סטודיו התרגום ב־THE SNOWBALL.');
    const b = 'snb' + Math.random().toString(36).slice(2);
    const meta = { name: GL_NAME, parents: [root], mimeType: 'text/tab-separated-values', appProperties: { snbGloss: '1' } };
    const mp = '--' + b + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(meta) + '\r\n--' + b +
      '\r\nContent-Type: text/tab-separated-values; charset=UTF-8\r\n\r\n' + body + '\r\n--' + b + '--';
    const r = await E.fetch(UP + '?uploadType=multipart&fields=id', { method: 'POST', body: mp,
      headers: { Authorization: 'Bearer ' + await driveToken(), 'Content-Type': 'multipart/related; boundary=' + b } });
    if (!r.ok) throw await driveErr(r);
    return (await r.json()).id;
  }

  /* Drive כמקור וכיעד (Google Picker — הרשאה לקובץ/לתיקייה שבחרת בלבד): פרטי סרטון שבחרת, והעברה / העתקה לתיקייה שבחרת */
  const DFID = /^[A-Za-z0-9_-]{10,200}$/;
  async function driveMeta(id) {
    if (!DFID.test(String(id || ''))) throw Object.assign(new Error('bad_id'), { code: 'bad_id' });
    const r = await E.fetch(API + '/' + id + '?fields=id,name,size,mimeType,trashed,videoMediaMetadata(durationMillis)', { headers: { Authorization: 'Bearer ' + await driveToken() } });
    if (!r.ok) throw await driveErr(r);
    return r.json();
  }
  /* 26/10/2026: רשימת הקבצים ב־Drive בעיצוב של Studio (במקום Google Picker) — בגישה של לקוח הרשימה (drive.readonly, tok()).
     o: { tab: 'r' אחרונים | 'f' תיקייה (parent) | 's' מסומנים בכוכב, q: חיפוש בשם, page } → { files, next } */
  async function browseList(tok, o) {
    o = o || {};
    const vid = "mimeType contains 'video/'", fold = "mimeType = '" + FOLDER_MIME + "'";
    const q = String(o.q || '').trim().slice(0, 80), cond = ['trashed = false'];
    if (q) cond.push("name contains '" + q.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'", '(' + vid + ' or ' + fold + ')');
    else if (o.tab === 'f') cond.push("'" + (DFID.test(String(o.parent || '')) ? o.parent : 'root') + "' in parents", '(' + vid + ' or ' + fold + ')');
    else if (o.tab === 's') cond.push('starred = true', '(' + vid + ' or ' + fold + ')');
    else cond.push(vid);
    const qs = new URLSearchParams({ q: cond.join(' and '), pageSize: '60', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true',
      orderBy: o.tab === 'f' && !q ? 'folder,name_natural' : o.tab === 's' && !q ? 'folder,modifiedTime desc' : 'modifiedTime desc',
      fields: 'nextPageToken,files(id,name,mimeType,size,modifiedTime,thumbnailLink,videoMediaMetadata(durationMillis,width,height))' });
    if (o.page) qs.set('pageToken', String(o.page).slice(0, 2000));
    const r = await E.fetch(API + '?' + qs, { headers: { Authorization: 'Bearer ' + await tok() } });
    if (!r.ok) throw await driveErr(r);
    const j = await r.json();
    const files = (Array.isArray(j.files) ? j.files : []).filter((f) => f && DFID.test(String(f.id || ''))).map((f) => ({
      id: f.id, name: String(f.name || '').slice(0, 200), folder: f.mimeType === FOLDER_MIME, type: String(f.mimeType || '').slice(0, 60),
      size: Number(f.size) || 0, at: Date.parse(f.modifiedTime) || 0, dur: Math.round(Number(f.videoMediaMetadata && f.videoMediaMetadata.durationMillis) / 1000) || 0,
      w: Number(f.videoMediaMetadata && f.videoMediaMetadata.width) || 0, h: Number(f.videoMediaMetadata && f.videoMediaMetadata.height) || 0,
      th: /^https:\/\/[a-z0-9-]+\.googleusercontent\.com\//.test(String(f.thumbnailLink || '')) ? String(f.thumbnailLink).slice(0, 1000) : '' }));
    return { files, next: typeof j.nextPageToken === 'string' ? j.nextPageToken : '' };
  }
  /* 26/10/2026: סרטון ב־Drive כ"קובץ" לקריאה בחלקים (Range) — בשביל רצועות הכתוביות שבתוכו (studiotracks.js קורא רק size
     ו־slice(a, b).arrayBuffer()). הרשימה = תחילת הקובץ / ה־moov בלבד; חילוץ מ־MKV עובר על הקובץ (בחלקים של chunk) */
  function rangeBlob(tok, id, size, name) {
    if (!DFID.test(String(id || '')) || !(size > 0)) throw Object.assign(new Error('bad_id'), { code: 'bad_id' });
    const get = async (a, b) => {
      for (let i = 0; ; i++) {
        const r = await E.fetch(API + '/' + id + '?alt=media&supportsAllDrives=true', { headers: { Authorization: 'Bearer ' + await tok(i > 0), Range: 'bytes=' + a + '-' + (b - 1) } });
        if ((r.status === 401 || r.status === 429 || r.status >= 500) && i < 2) continue;
        if (r.status !== 206 && !(r.status === 200 && a === 0 && b >= size)) throw await driveErr(r);
        return r.arrayBuffer();
      }
    };
    return { id, size, name: String(name || ''), chunk: 4 * 1024 * 1024, remote: true,
      slice: (a, b) => { const x = Math.max(0, a | 0), y = Math.min(size, b == null ? size : b); return { arrayBuffer: () => (y > x ? get(x, y) : Promise.resolve(new ArrayBuffer(0))) }; } };
  }
  /* 26/10/2026 (בקשת המשתמש): "הסרטונים שלי" — תיקייה אחת ב־Drive לכל מה שנשמר מ־Studio, עם תיקיות משנה שמנהלים כאן.
     בגישה של הסטודיו (drive.file — האפליקציה רואה רק מה שהיא עצמה יצרה): התיקייה הראשית snbVids=1, תיקיות שנוצרו כאן
     snbVf=1, וכל קובץ שנשמר snbVid=dx (גם מהעובד בשרת — translator/job.py dx_auto) */
  const VID_FIELDS = 'id,name,mimeType,size,modifiedTime,parents,thumbnailLink,webViewLink,videoMediaMetadata(durationMillis,width,height)';
  const vidOf = (f) => ({
    id: f.id, name: String(f.name || '').slice(0, 200), folder: f.mimeType === FOLDER_MIME, type: String(f.mimeType || '').slice(0, 60),
    size: Number(f.size) || 0, at: Date.parse(f.modifiedTime) || 0, parent: Array.isArray(f.parents) && DFID.test(String(f.parents[0] || '')) ? f.parents[0] : '',
    dur: Math.round(Number(f.videoMediaMetadata && f.videoMediaMetadata.durationMillis) / 1000) || 0,
    w: Number(f.videoMediaMetadata && f.videoMediaMetadata.width) || 0, h: Number(f.videoMediaMetadata && f.videoMediaMetadata.height) || 0,
    th: /^https:\/\/[a-z0-9-]+\.googleusercontent\.com\//.test(String(f.thumbnailLink || '')) ? String(f.thumbnailLink).slice(0, 1000) : '',
    url: /^https:\/\/drive\.google\.com\//.test(String(f.webViewLink || '')) ? String(f.webViewLink).slice(0, 500) : '' });
  async function vidsRoot(name) {
    return folder(String(name || 'THE SNOWBALL').slice(0, 120), 'snbVids', '1', '', 'הסרטונים שנשמרו מ־Studio ב־THE SNOWBALL.');
  }
  /* תוכן של תיקייה (תיקיות קודם, ואז מהחדש לישן), או חיפוש בשם בכל "הסרטונים שלי" (q) */
  async function vidsList(parent, o) {
    o = o || {};
    const q = String(o.q || '').trim().slice(0, 80), mine = "(appProperties has { key='snbVid' and value='dx' } or appProperties has { key='snbVf' and value='1' })";
    const cond = ['trashed = false'];
    if (q) cond.push("name contains '" + q.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'", mine);
    else if (DFID.test(String(parent || ''))) cond.push("'" + parent + "' in parents");
    else throw Object.assign(new Error('bad_id'), { code: 'bad_id' });
    const qs = new URLSearchParams({ q: cond.join(' and '), pageSize: '100', orderBy: 'folder,modifiedTime desc', spaces: 'drive', fields: 'nextPageToken,files(' + VID_FIELDS + ')' });
    if (o.page) qs.set('pageToken', String(o.page).slice(0, 2000));
    const j = await dreq('GET', API + '?' + qs);
    return { files: (Array.isArray(j && j.files) ? j.files : []).filter((f) => f && DFID.test(String(f.id || ''))).map(vidOf), next: j && typeof j.nextPageToken === 'string' ? j.nextPageToken : '' };
  }
  async function vidsFolder(parent, name) {
    if (!DFID.test(String(parent || ''))) throw Object.assign(new Error('bad_id'), { code: 'bad_id' });
    return vidOf(await dreq('POST', API + '?fields=' + q(VID_FIELDS), { name: String(name || '').slice(0, 120), mimeType: FOLDER, parents: [parent], appProperties: { snbVf: '1' } }));
  }
  /* תיקייה בשם הזה בתוך parent — קיימת (שנוצרה כאן) או חדשה. לשמירה של עבודה שלמה: תיקייה לכל סרטון */
  async function vidsSub(parent, name) {
    const n = String(name || '').slice(0, 120);
    const qs = "'" + parent + "' in parents and trashed=false and mimeType='" + FOLDER + "' and name='" + n.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
    const j = await dreq('GET', API + '?q=' + q(qs) + '&fields=files(' + q(VID_FIELDS) + ')&pageSize=5&spaces=drive');
    return j && j.files && j.files.length ? vidOf(j.files[0]) : vidsFolder(parent, n);
  }
  async function driveRename(id, name) {
    if (!DFID.test(String(id || ''))) throw Object.assign(new Error('bad_id'), { code: 'bad_id' });
    return vidOf(await dreq('PATCH', API + '/' + id + '?fields=' + q(VID_FIELDS), { name: String(name || '').slice(0, 200) }));
  }
  async function driveTrash(id) {
    if (!DFID.test(String(id || ''))) throw Object.assign(new Error('bad_id'), { code: 'bad_id' });
    return dreq('PATCH', API + '/' + id + '?fields=id', { trashed: true });   // לפח של Drive (30 יום לשחזור)
  }
  async function driveMoveTo(id, from, to) {
    if (![id, from, to].every((x) => DFID.test(String(x || '')))) throw Object.assign(new Error('bad_id'), { code: 'bad_id' });
    return vidOf(await dreq('PATCH', API + '/' + id + '?addParents=' + to + '&removeParents=' + from + '&fields=' + q(VID_FIELDS), {}));
  }
  /* העברה (בלי עותק — סרטון גדול לא תופס אחסון פעמיים): מתיקיית העבודה לתיקייה שבחרת */
  async function driveMove(id, from, to) {
    if (![id, from, to].every((x) => DFID.test(String(x || '')))) throw Object.assign(new Error('bad_id'), { code: 'bad_id' });
    const r = await E.fetch(API + '/' + id + '?addParents=' + to + '&removeParents=' + from + '&fields=id,parents', { method: 'PATCH',
      headers: { Authorization: 'Bearer ' + await driveToken(), 'Content-Type': 'application/json' }, body: '{}' });
    if (!r.ok) throw await driveErr(r);
    return r.json();
  }
  /* העתקה (לקבצים קטנים — כתוביות): המקור נשאר בתיקיית העבודה (העורך וסט הזהב קוראים ממנו) */
  async function driveCopy(id, to, name) {
    if (!DFID.test(String(id || '')) || !DFID.test(String(to || ''))) throw Object.assign(new Error('bad_id'), { code: 'bad_id' });
    const r = await E.fetch(API + '/' + id + '/copy?fields=id', { method: 'POST',
      headers: { Authorization: 'Bearer ' + await driveToken(), 'Content-Type': 'application/json' }, body: JSON.stringify({ parents: [to], name: String(name || '').slice(0, 200) }) });
    if (!r.ok) throw await driveErr(r);
    return r.json();
  }

  /* ת4: תוצר מ־R2 לתיקייה שבחרת ב־Drive — זורם: קוראים מ־R2 ושולחים ל־Drive בחתיכות (לא נטען כולו לזיכרון) */
  async function r2ToDrive(id, to, name, onProgress) {
    if (!isR2Id(id) || !DFID.test(String(to || ''))) throw Object.assign(new Error('bad_id'), { code: 'bad_id' });
    const g = await r2Get(id);
    const r = await E.fetch(g.url);
    if (!r.ok || !r.body) throw Object.assign(new Error('r2_http_' + r.status), { code: 'r2_http_' + r.status });
    const size = g.size, mime = g.type || 'application/octet-stream', CH = 32 * K256;
    const uri = await initUpload({ name: String(name || '').slice(0, 200), parents: [to], appProperties: { snbVid: 'dx' } }, size, mime);
    const rd = r.body.getReader();
    let parts = [], have = 0, sent = 0, last = null;
    const flush = async (final) => {
      while (have >= CH || (final && have > 0)) {
        const all = new Blob(parts), n = final && have < CH ? have : CH, chunk = all.slice(0, n);
        parts = [all.slice(n)]; have -= n;
        const end = sent + n - 1;
        last = await E.put(uri, chunk, { 'Content-Range': 'bytes ' + sent + '-' + end + '/' + size, 'Content-Type': mime });
        if (!(last.status === 308 || last.status === 200 || last.status === 201)) throw Object.assign(new Error('drive_http_' + last.status), { code: 'drive_http_' + last.status });
        sent = end + 1;
        if (onProgress) onProgress(sent / size);
      }
    };
    for (;;) {
      const { value, done } = await rd.read();
      if (done) break;
      parts.push(value); have += value.byteLength;
      if (have >= CH) await flush(false);
    }
    await flush(true);
    if (sent !== size || !last || (last.status !== 200 && last.status !== 201)) throw Object.assign(new Error('drive_incomplete'), { code: 'drive_incomplete' });
    return last.json || {};
  }

  /* v387: סט הזהב — קובץ טקסט מ־Drive (התוצר שלנו / הייחוס), והעלאת הייחוס לתיקיית העבודה */
  async function r2Get(id, name) {
    const g = await api('r2url', Object.assign({ job: r2JobOf(id), id }, name ? { name } : {}));
    if (!g || !g.ok || !g.url) throw Object.assign(new Error((g && g.error) || 'r2'), { code: (g && g.error) || 'r2' });
    return g;
  }
  async function driveText(id) {
    if (isR2Id(id)) {
      const r = await E.fetch((await r2Get(id)).url);
      if (!r.ok) throw Object.assign(new Error('r2_http_' + r.status), { code: 'r2_http_' + r.status });
      return r.text();
    }
    const r = await E.fetch(API + '/' + encodeURIComponent(id) + '?alt=media', { headers: { Authorization: 'Bearer ' + await driveToken() } });
    if (!r.ok) throw await driveErr(r);
    return r.text();
  }
  /* סבב 8: קובץ קטן כ־Blob (העותק לוואטסאפ — לשיתוף מהטלפון). לא דרך ה־SW (טווח פתוח שם מוגבל ל־4MB); גדול מ־max — שגיאה */
  async function driveBlob(id, max) {
    const lim = max || 64 * 1048576;
    const r = isR2Id(id) ? await E.fetch((await r2Get(id)).url)
      : await E.fetch(API + '/' + encodeURIComponent(id) + '?alt=media', { headers: { Authorization: 'Bearer ' + await driveToken() } });
    if (!r.ok) throw isR2Id(id) ? Object.assign(new Error('r2_http_' + r.status), { code: 'r2_http_' + r.status }) : await driveErr(r);
    if (Number(r.headers && r.headers.get && r.headers.get('content-length')) > lim) throw Object.assign(new Error('too_big'), { code: 'too_big' });
    const b = await r.blob();
    if (b.size > lim) throw Object.assign(new Error('too_big'), { code: 'too_big' });
    return b;
  }
  /* מ1: הנגן — הסרטון מ־Drive דרך ה־Service Worker (./studio-media/<id>): ה־SW מבקש כאן אסימון (MessageChannel) ומעביר
     Range ל־Drive עם Authorization — הטוקן לא בכתובת. רק קבצים שהדף אישר (mediaAllow) — לא כל קובץ שמישהו מבקש */
  const mediaAllow = new Set();
  let mediaWired = false;
  function mediaUrl(id) {
    if (!/^[A-Za-z0-9_-]{10,200}$/.test(String(id || ''))) return '';
    mediaAllow.add(id);
    const sw = E.sw || (typeof navigator !== 'undefined' && navigator.serviceWorker);
    if (!sw || !sw.controller) return '';               // בלי SW שולט — הקורא יבחר דרך אחרת (הורדה / פתיחה ב־Drive)
    if (!mediaWired && typeof sw.addEventListener === 'function') {
      mediaWired = true;
      sw.addEventListener('message', (e) => {
        const d = e && e.data;
        const port = e && e.ports && e.ports[0];
        if (!d || typeof d.snbMedia !== 'string' || !port) return;
        if (!mediaAllow.has(d.snbMedia)) { port.postMessage({ t: '' }); return; }
        mediaInfo(d.snbMedia, !!d.fresh).then((x) => port.postMessage(x), () => port.postMessage({ t: '' }));
      });
    }
    return MEDIA_PATH + id;
  }
  /* לשאלה של ה־SW: אסימון + גודל וסוג הקובץ (Content-Range נבנה ב־SW מהגודל — לא חשוף בתשובת CORS של Drive) */
  const mediaMeta = new Map();
  async function mediaInfo(id, fresh) {
    if (isR2Id(id)) { const g = await r2Get(id); return { u: g.url, exp: g.exp || 0, size: g.size, type: g.type || '' }; }   // ת4: קישור חתום (שעה) — ה־SW מבקש ישירות מ־R2
    const t = await driveToken(fresh);
    let m = mediaMeta.get(id);
    if (!m) {
      const r = await E.fetch(API + '/' + encodeURIComponent(id) + '?fields=size,mimeType', { headers: { Authorization: 'Bearer ' + t } });
      if (!r.ok) throw await driveErr(r);
      const j = await r.json();
      m = { size: Math.floor(Number(j.size) || 0), type: String(j.mimeType || '') };
      mediaMeta.set(id, m);
    }
    return { t: t || '', exp: (dtok && dtok.exp) || 0, size: m.size, type: m.type };
  }
  async function driveJson(id) { return JSON.parse(await driveText(id)); }
  /* קובץ טקסט קטן לתיקיית העבודה (multipart) — הייחוס של סט הזהב, גרסה ערוכה של הכתוביות (מ2) */
  async function textUpload(folderId, name, mime, text, props) {
    if (isR2Folder(folderId)) {   // ת4: לתיקייה של העבודה ב־R2
      const blob = new Blob([text], { type: mime });
      return (await r2Upload({ api, job: r2JobOf(folderId), name, blob, size: blob.size, mime }, { put: E.put, sleep: E.sleep, now: E.now, online: E.online })).id;
    }
    if (!/^[A-Za-z0-9_-]{10,100}$/.test(String(folderId || ''))) throw Object.assign(new Error('folder'), { code: 'folder' });
    const b = 'snb' + Math.random().toString(36).slice(2);
    const meta = { name, parents: [folderId], mimeType: mime, appProperties: props || {} };
    const mp = '--' + b + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(meta) + '\r\n--' + b +
      '\r\nContent-Type: ' + mime + '; charset=UTF-8\r\n\r\n' + text + '\r\n--' + b + '--';
    const r = await E.fetch(UP + '?uploadType=multipart&fields=id', { method: 'POST', body: mp,
      headers: { Authorization: 'Bearer ' + await driveToken(), 'Content-Type': 'multipart/related; boundary=' + b } });
    if (!r.ok) throw await driveErr(r);
    return (await r.json()).id;
  }
  /* מילים לשיר (LRCLIB) — 8 שנ׳ לכל היותר; תקלה = רשימה ריקה עם קוד */
  async function lyricsSearch(qs, dur) {
    const qq = String(qs || '').trim().slice(0, 120);
    if (qq.length < 2) return { ok: false, error: 'short', list: [] };
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const tm = ctl ? setTimeout(() => ctl.abort(), 8000) : 0;
    try {
      const r = await E.fetch(LRC_API + '?q=' + encodeURIComponent(qq), ctl ? { signal: ctl.signal } : {});
      if (!r.ok) return { ok: false, error: 'http_' + r.status, list: [] };
      return { ok: true, list: lrcResults(await r.json(), dur || 0) };
    } catch (e) { return { ok: false, error: 'net', list: [] }; } finally { if (tm) clearTimeout(tm); }
  }
  /* כתוביות מהרשת: זיהוי + חיפוש בכל המקורות (כל אחד עד NS_MS; מקור שנפל לא עוצר). blob = {size, slice} */
  async function nsGet(url, kind) {
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const tm = ctl ? setTimeout(() => ctl.abort(), NS_MS) : 0;
    try {
      const r = await E.fetch(url, ctl ? { signal: ctl.signal } : {});
      if (!r.ok) return null;
      if (kind === 'json') return await r.json();
      const b = new Uint8Array(await r.arrayBuffer());
      return b.length <= NS_MAX ? b : null;
    } catch (e) { return null; } finally { if (tm) clearTimeout(tm); }
  }
  async function subsFind(blob, name) {
    const g = nsGuess(name), size = blob ? Number(blob.size) || 0 : 0;
    let hash = '';
    try { hash = await osHash(blob); } catch (e) { hash = ''; }
    let id = hash ? nsPickHash(await nsGet(NS_OSH + 'moviebytesize-' + size + '/moviehash-' + hash, 'json'), g) : null;
    if (!id && g.q.length >= 2) id = nsPickMeta(await nsGet(NS_META + (g.s ? 'series' : 'movie') + '/top/search=' + encodeURIComponent(g.q) + '.json', 'json'), g);
    if (!id) return { ok: false, error: 'none', list: [] };
    const vid = id.id + (id.type === 'series' ? ':' + id.s + ':' + id.e : '');
    const [a, b] = await Promise.all([
      nsGet(NS_OS3 + id.type + '/' + vid + (hash ? '/videoHash=' + hash + '&videoSize=' + size : '') + '.json', 'json'),
      nsGet(NS_WIZ + 'search?action=by_id&imdb=' + id.id + (id.type === 'series' ? '&season=' + id.s + '&episode=' + id.e + '&version=1' : ''), 'json')]);
    return { ok: true, id, hash: !!hash, list: nsSort([...nsParseOs(a, name), ...nsParseWiz(b, name)]) };
  }
  /* קובץ אחד → בתים (zip נפתח). רק מהכתובות שהפענוח אישר */
  async function subsGet(item, g) {
    const u = String(item && item.url || '');
    if (!(/^https:\/\/[a-z0-9-]+\.strem\.io\//i.test(u) || u.startsWith(NS_WIZ + 'files/sub/'))) return null;
    const b = await nsGet(u, 'bin');
    if (!b) return null;
    try { return await nsUnzip(b, g); } catch (e) { return null; }
  }
  const goldUpload = (folderId, text) => textUpload(folderId, GOLD_REF_NAME, 'application/x-subrip', text, { snbRef: '1' });


  return { api, driveApi, driveToken, browseList, rangeBlob, vidsRoot, vidsList, vidsFolder, vidsSub, driveRename, driveTrash, driveMoveTo, jobFolder, upload, r2ToDrive, r2Get, cloudInitTemplate, glossLoad, glossSave, driveText, driveBlob, driveJson, goldUpload, textUpload, mediaUrl, driveMeta, driveMove, driveCopy, lyricsSearch, subsFind, subsGet, _forget: () => { dtok = null; } };
}
