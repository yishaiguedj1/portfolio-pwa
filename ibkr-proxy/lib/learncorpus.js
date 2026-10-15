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

function normCue(c) {
  if (!c || typeof c !== 'object' || !Number.isInteger(c.i) || c.i < 0 || c.i > 1e6) return null;
  const o = { i: c.i, s: n3(c.s), e: n3(c.e), k: SPK_RE.test(String(c.k || '')) ? c.k : 'S?', en: txt(c.en), d: txt(c.d) };
  for (const k of ['f', 'r', 'z']) if (typeof c[k] === 'string') o[k] = txt(c[k]);
  return o;
}
function normWord(w) {
  if (!Array.isArray(w) || w.length < 3) return null;
  return [txt(w[0], 60), n3(w[1]), n3(w[2]), SPK_RE.test(String(w[3] || '')) ? w[3] : 'S?', n3(w[4]), n3(w[5]), n3(w[6]),
    ALIGN_RE.test(String(w[7] || '')) ? String(w[7] || '') : ''];
}

/* הגוף מהעובד → הפריט שנשמר (או null). month = 'YYYY-MM' מהשרתון */
function normCorpus(o, month) {
  if (!o || typeof o !== 'object' || Array.isArray(o) || o.v !== LC_V || !Array.isArray(o.cu)) return null;
  const cu = o.cu.slice(0, MAX_CUES).map(normCue).filter(Boolean);
  if (!cu.length) return null;
  const out = { v: LC_V, m: MONTH_RE.test(String(month || '')) ? month : '', cu };
  for (const k of ['mode', 'src', 'dst']) if (TOK_RE.test(String(o[k] || ''))) out[k] = o[k];
  if (isNum(o.dur) && o.dur > 0) out.dur = Math.round(o.dur * 10) / 10;
  if (Array.isArray(o.fin)) out.fin = o.fin.slice(0, MAX_CUES).filter((c) => c && typeof c === 'object').map((c) => ({ s: n3(c.s), e: n3(c.e), h: txt(c.h) }));
  if (Array.isArray(o.wd)) out.wd = o.wd.slice(0, MAX_WORDS).map(normWord).filter(Boolean);
  if (Array.isArray(o.pt)) out.pt = o.pt.slice(0, MAX_PT).filter((x) => typeof x === 'string').map((x) => txt(x));
  if (o.sp && typeof o.sp === 'object' && !Array.isArray(o.sp)) {
    const sp = {};
    for (const [k, v] of Object.entries(o.sp).slice(0, 20)) {
      if (!SPK_RE.test(k) || !v || typeof v !== 'object') continue;
      const x = {};
      for (const f of ['n', 'r', 'g']) if (typeof v[f] === 'string' && v[f].trim()) x[f] = txt(v[f], 80);
      if (Object.keys(x).length) sp[k] = x;
    }
    if (Object.keys(sp).length) out.sp = sp;
  }
  if (Array.isArray(o.gl)) out.gl = o.gl.slice(0, MAX_GL).filter((x) => typeof x === 'string').map((x) => txt(x, 200));
  return out;
}

const monthOf = (now) => new Date(now).toISOString().slice(0, 7);
const qKey = (lid) => 'q/' + lid + '.bin';
const cKey = (month, lid) => 'c/' + month + '/' + lid + '.bin';
/* המפתח → {kind q|c, month, lid} (או null — לא שלנו) */
function parseKey(k) {
  let m = /^q\/([0-9a-f]{20})\.bin$/.exec(String(k || ''));
  if (m) return { kind: 'q', month: '', lid: m[1] };
  m = /^c\/(\d{4}-\d{2})\/([0-9a-f]{20})\.bin$/.exec(String(k || ''));
  return m ? { kind: 'c', month: m[1], lid: m[2] } : null;
}
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
  const out = { n: 0, q: 0, bytes: 0, months: {} };
  for (const it of items || []) {
    const p = parseKey(it.key);
    if (!p) continue;
    out.bytes += it.size || 0;
    if (p.kind === 'q') out.q++;
    else { out.n++; out.months[p.month] = (out.months[p.month] || 0) + 1; }
  }
  return out;
}

module.exports = { LC_V, KEEP_MONTHS, LID_RE, scrub, normCorpus, monthOf, qKey, cKey, parseKey, oldestMonth, expired, corpusStats };
