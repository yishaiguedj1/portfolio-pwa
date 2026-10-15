'use strict';
/* מאגר הלמידה מ׳2 (15/10/2026): קורפוס הטקסט — רשומה לכל כתובית מכל עבודת תרגום (המקור, הטיוטה, התיקונים, הביקורת,
   הסופי) + זמני המילים משלושת מנועי היישור + ההגהה + המילון של העבודה. טהור, בלי קריאות.
   - רשימה מותרת: רק השדות כאן יוצאים מהגוף שהעובד שלח (שדה חדש בעובד לא נכנס בלי שינוי כאן).
   - ניקוי טקסט (scrub): מיילים, קישורים, טלפונים ומספרים ארוכים (תעודת זהות, חשבון, כרטיס) מוחלפים בתגים.
     שמות נשארים — בלי זה אי אפשר ללמוד תרגום שמות (התוכנית, "איך מנתקים").
   - בלי uid, בלי שם קובץ/תיקייה/סרטון, בלי זמן מדויק — רק החודש (m), שהשרתון קובע. בכתוביות הדובר הוא S1/S2,
     ושמות הדוברים (עם התפקיד והמגדר — להתאמה בעברית) בטבלה אחת, sp (בקשת המשתמש 15/10/2026).
   המפתח בדלי: q/<lid>.bin (תור — עד האצווה היומית) → c/<YYYY-MM>/<lid>.bin. lid = אותו מזהה מגובב של studioLearn
   (מ׳1 — כך "מחק את התרומות שלי" מוצא גם את הקורפוס). התוכן מוצפן (lib/vault.js, AAD = learn|<lid>). */

const LC_V = 1;                          // **זהה ל־LC_V ב־translator/job.py**
const MAX_CUES = 4000, MAX_WORDS = 40000, MAX_TXT = 400, MAX_PT = 2000, MAX_GL = 300;
const KEEP_MONTHS = 24;                  // ההחלטה (14/10/2026): תוכן 24 חודשים, המדדים לתמיד
const LID_RE = /^[0-9a-f]{20}$/;
const SPK_RE = /^S\d{1,2}$/;
const TOK_RE = /^[a-z][a-z0-9,-]{0,47}$/;
const ALIGN_RE = /^[a-z0-9_]{0,12}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

const isNum = (v) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 1e7;
const n3 = (v) => (isNum(v) ? Math.round(v * 1000) / 1000 : null);

/* מה שמזהה אדם בתוך הדיבור עצמו — בלי לגעת בשמות, בשנים ובמספרים קצרים */
function scrub(s) {
  return String(s == null ? '' : s)
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '⟨מייל⟩')
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi, '⟨קישור⟩')
    .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, (m) => (m.replace(/\D/g, '').length >= 9 ? '⟨מספר⟩' : m))
    .slice(0, MAX_TXT);
}
const txt = (v, max) => scrub(v).slice(0, max || MAX_TXT);
/* האיסוף המלא (learn_full, תקופת הפיתוח — lib/devlog.js): בלי scrub (רק תווי בקרה), עם תקרה גבוהה יותר */
const MAX_TXT_F = 4000;
const raw = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').slice(0, max || MAX_TXT_F);
let T = txt;   // המנקה של הקריאה הנוכחית (normCorpus מחליף ומחזיר — הקוד סינכרוני)

function normCue(c) {
  if (!c || typeof c !== 'object' || !Number.isInteger(c.i) || c.i < 0 || c.i > 1e6) return null;
  const o = { i: c.i, s: n3(c.s), e: n3(c.e), k: SPK_RE.test(String(c.k || '')) ? c.k : 'S?', en: T(c.en), d: T(c.d) };
  for (const k of ['f', 'r', 'z']) if (typeof c[k] === 'string') o[k] = T(c[k]);
  return o;
}
function normWord(w) {
  if (!Array.isArray(w) || w.length < 3) return null;
  return [T(w[0], 60), n3(w[1]), n3(w[2]), SPK_RE.test(String(w[3] || '')) ? w[3] : 'S?', n3(w[4]), n3(w[5]), n3(w[6]),
    ALIGN_RE.test(String(w[7] || '')) ? String(w[7] || '') : ''];
}

/* הגוף מהעובד → הפריט שנשמר (או null). month = 'YYYY-MM' מהשרתון */
function normCorpus(o, month, full) {
  T = full ? raw : txt;
  try { return normCorpus0(o, month, !!full); } finally { T = txt; }
}
/* קבצי הטקסט של הפרויקט (רק באיסוף המלא): הנחיות, תרגום לכל חלק, הערות המבקר והשופט — { נתיב יחסי: תוכן } */
const TX_FILES = 120, TX_FILE = 300 * 1024, TX_TOTAL = 6 * 1024 * 1024;
const TX_PATH = /^(?!.*\.\.)[\w][\w./-]{0,119}$/;
function normTx(x) {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  const out = {};
  let left = TX_TOTAL, n = 0;
  for (const [k, v] of Object.entries(x)) {
    if (n >= TX_FILES || left <= 0) break;
    if (!TX_PATH.test(k) || typeof v !== 'string') continue;
    const c = raw(v, Math.min(TX_FILE, left));
    out[k] = c; left -= c.length; n++;
  }
  return n ? out : null;
}
function normCorpus0(o, month, full) {
  if (!o || typeof o !== 'object' || Array.isArray(o) || o.v !== LC_V || !Array.isArray(o.cu)) return null;
  const cu = o.cu.slice(0, MAX_CUES).map(normCue).filter(Boolean);
  if (!cu.length) return null;
  const out = { v: LC_V, m: MONTH_RE.test(String(month || '')) ? month : '', cu };
  for (const k of ['mode', 'src', 'dst']) if (TOK_RE.test(String(o[k] || ''))) out[k] = o[k];
  if (isNum(o.dur) && o.dur > 0) out.dur = Math.round(o.dur * 10) / 10;
  if (Array.isArray(o.fin)) out.fin = o.fin.slice(0, MAX_CUES).filter((c) => c && typeof c === 'object').map((c) => ({ s: n3(c.s), e: n3(c.e), h: T(c.h) }));
  if (Array.isArray(o.wd)) out.wd = o.wd.slice(0, MAX_WORDS).map(normWord).filter(Boolean);
  if (Array.isArray(o.pt)) out.pt = o.pt.slice(0, MAX_PT).filter((x) => typeof x === 'string').map((x) => T(x));
  if (o.sp && typeof o.sp === 'object' && !Array.isArray(o.sp)) {
    const sp = {};
    for (const [k, v] of Object.entries(o.sp).slice(0, 20)) {
      if (!SPK_RE.test(k) || !v || typeof v !== 'object') continue;
      const x = {};
      for (const f of ['n', 'r', 'g']) if (typeof v[f] === 'string' && v[f].trim()) x[f] = T(v[f], 80);
      if (Object.keys(x).length) sp[k] = x;
    }
    if (Object.keys(sp).length) out.sp = sp;
  }
  if (Array.isArray(o.gl)) out.gl = o.gl.slice(0, MAX_GL).filter((x) => typeof x === 'string').map((x) => T(x, 200));
  if (full) {
    out.full = 1;
    const tx = normTx(o.tx);
    if (tx) out.tx = tx;
  }
  return out;
}

/* מ׳3 (15/10/2026): העריכות שלך בעורך הכתוביות אחרי העבודה — לכל שמירה (ss) רשימת שינויים: t סוג (txt tm sp mg add del mx),
   b / a הכתוביות לפני / אחרי ({s, e, h}), en המקור באנגלית, m = שינוי טקסט שגם הזמן שלו זז; ws שניות עבודה פעילה.
   פריט אחד לעבודה, מצטבר: השרתון פותח את הקיים ומוסיף את השמירה החדשה (עד ED_SS שמירות / ED_CH שינויים) */
const ED_T = ['txt', 'tm', 'sp', 'mg', 'add', 'del', 'mx'];
const ED_SS = 40, ED_CH = 3000, ED_SIDE = 12;
const edCue = (c) => (c && typeof c === 'object' ? { s: n3(c.s), e: n3(c.e), h: txt(c.h) } : null);
function normEditSession(x) {
  if (!x || typeof x !== 'object' || !Array.isArray(x.ch)) return null;
  const ch = [];
  for (const d of x.ch.slice(0, ED_CH)) {
    if (!d || typeof d !== 'object' || !ED_T.includes(d.t)) continue;
    const r = { t: d.t, b: Array.isArray(d.b) ? d.b.slice(0, ED_SIDE).map(edCue).filter(Boolean) : [], a: Array.isArray(d.a) ? d.a.slice(0, ED_SIDE).map(edCue).filter(Boolean) : [] };
    if (typeof d.en === 'string' && d.en) r.en = txt(d.en);
    if (d.m === 1) r.m = 1;
    if (r.b.length || r.a.length) ch.push(r);
  }
  if (!ch.length) return null;
  const out = { ch };
  if (isNum(x.ws) && x.ws >= 0) out.ws = Math.round(Math.min(x.ws, 86400));
  return out;
}
/* prev = הפריט הקיים (או null), sess = השמירה החדשה מהטלפון → הפריט המעודכן (או null — אין מה לשמור) */
function addEdits(prev, sess, month) {
  const ns = normEditSession(sess);
  if (!ns) return null;
  const ok = prev && typeof prev === 'object' && prev.v === LC_V && Array.isArray(prev.ss);
  const ss = (ok ? prev.ss.map(normEditSession).filter(Boolean) : []).concat([ns]).slice(-ED_SS);
  let left = ED_CH;
  for (let k = ss.length - 1; k >= 0; k--) { if (left <= 0) { ss.splice(0, k + 1); break; } if (ss[k].ch.length > left) ss[k].ch = ss[k].ch.slice(0, left); left -= ss[k].ch.length; }
  return { v: LC_V, k: 'ed', m: ok && MONTH_RE.test(String(prev.m || '')) ? prev.m : (MONTH_RE.test(String(month || '')) ? month : ''), ss };
}

const monthOf = (now) => new Date(now).toISOString().slice(0, 7);
const qKey = (lid) => 'q/' + lid + '.bin';
const cKey = (month, lid) => 'c/' + month + '/' + lid + '.bin';
const qeKey = (lid) => 'qe/' + lid + '.bin';
const eKey = (month, lid) => 'e/' + month + '/' + lid + '.bin';
/* המפתח → {kind q|c|qe|e, month, lid} (או null — לא שלנו). q/c = הקורפוס מהעובד, qe/e = העריכות שלך (מ׳3) */
function parseKey(k) {
  let m = /^(q|qe)\/([0-9a-f]{20})\.bin$/.exec(String(k || ''));
  if (m) return { kind: m[1], month: '', lid: m[2] };
  m = /^(c|e)\/(\d{4}-\d{2})\/([0-9a-f]{20})\.bin$/.exec(String(k || ''));
  if (m) return { kind: m[1], month: m[2], lid: m[3] };
  m = /^m\/(\d{4}-\d{2})\/([0-9a-f]{20})\.(a|v)\.(mp4|key)$/.exec(String(k || ''));   // מ׳4: הקול וה־240p + המפתח העטוף
  return m ? { kind: 'm', month: m[1], lid: m[2], mk: m[3], part: m[4] } : null;
}
/* מ׳4 (15/10/2026): הקול (Opus 32kbps) והעותק ב־240p — מוצפנים ב־ffmpeg (CENC, AES-CTR) במפתח שהשרתון נותן לעבודה;
   המפתח עצמו נשמר עטוף בכספת (vault) ליד הקובץ. בלי תור: החודש בנתיב = חודש ההעלאה (העתקה של קובץ גדול באצווה עולה כסף) */
const MEDIA_KINDS = ['a', 'v'];
const MEDIA_MAX = { a: 80 * 1024 * 1024, v: 600 * 1024 * 1024 };   // ~5 שעות קול / ~4 שעות 240p — מעבר לזה לא נשמר
const mKey = (month, lid, k, part) => 'm/' + month + '/' + lid + '.' + k + '.' + part;
/* החודש האחרון שעוד נשמר: היום פחות 24 חודשים */
function oldestMonth(now) {
  const d = new Date(now);
  const y = d.getUTCFullYear(), mo = d.getUTCMonth() - KEEP_MONTHS;
  const t = new Date(Date.UTC(y, mo, 1));
  return t.toISOString().slice(0, 7);
}
const expired = (month, now) => MONTH_RE.test(month) && month < oldestMonth(now);

/* סטטיסטיקה למנהל מתוך רשימת המפתחות (בלי לפתוח קובץ) */
function corpusStats(items) {
  const out = { n: 0, q: 0, ne: 0, qe: 0, na: 0, nv: 0, mb: 0, bytes: 0, months: {} };
  for (const it of items || []) {
    const p = parseKey(it.key);
    if (!p) continue;
    out.bytes += it.size || 0;
    if (p.kind === 'm') { if (p.part === 'mp4') { out[p.mk === 'a' ? 'na' : 'nv']++; out.mb += it.size || 0; } continue; }
    if (p.kind === 'q') out.q++;
    else if (p.kind === 'qe') out.qe++;
    else if (p.kind === 'e') out.ne++;
    else { out.n++; out.months[p.month] = (out.months[p.month] || 0) + 1; }
  }
  return out;
}

module.exports = { LC_V, KEEP_MONTHS, LID_RE, scrub, normCorpus, normTx, normEditSession, addEdits, ED_SS, ED_CH, monthOf, qKey, cKey, qeKey, eKey, mKey, MEDIA_KINDS, MEDIA_MAX, parseKey, oldestMonth, expired, corpusStats };
