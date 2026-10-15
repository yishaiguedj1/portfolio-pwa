/* מ2–מ3 (10/10/2026): עורך הכתוביות של סטודיו התרגום — אחרי התרגום, לפני (או בלי) צריבה מחדש.
   הנגן למעלה (studioplay.js) מציג את הכתוביות הערוכות בזמן אמת; כל כתובית: טקסט, תזמון, פיצול / מיזוג / מחיקה,
   בדיקות חיות (אותם כללים כמו מדד האיכות), חיפוש והחלפה, ביטול וחזרה.
   הלוגיקה טהורה ובלתי משנה (מחזירה מערך חדש) — נבדקת ב־node; ה־DOM רק ב־createSubsEditor. בלי רשת: studio.js שומר. */
import { cueIssues, cueAt, Q_LEN, Q_CPS, Q_LINES, Q_MIN_DUR } from './studioplay.js';

export const MIN_DUR = 0.2;      // כתובית קצרה מזה לא נוצרת בפיצול / בהזזה (מדד האיכות מסמן מתחת ל־0.83)
export const STEP = 0.1;         // צעד בכפתורי התזמון
export const UNDO_MAX = 80;
export const LINES_MAX = 4;
const RLM = '‏';
const BIDI = /[‎‏‪-‮⁦-⁩]/g;
const CTRL = /[\u0000-\u0008\u000b-\u001f\u007f]/g;
const r3 = (x) => Math.round(x * 1000) / 1000;

/* ---------- זמן ---------- */
export function fmtTc(sec) {                 // 1:02.4 — עשיריות (בסרגל העריכה)
  const t = Math.max(0, Math.round((Number(sec) || 0) * 10) / 10);
  const m = Math.floor(t / 60), s = t - m * 60, h = Math.floor(m / 60);
  const ss = s.toFixed(1).padStart(4, '0');
  return h ? h + ':' + String(m % 60).padStart(2, '0') + ':' + ss : m + ':' + ss;
}
function srtTime(sec) {
  const ms = Math.max(0, Math.round(sec * 1000));
  const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') + ',' + String(ms % 1000).padStart(3, '0');
}

/* ---------- קבצים (כמו vt: write_srt עם RLM בתחילת כל שורה, cues.final.json) ---------- */
export const clean = (s) => String(s == null ? '' : s).replace(CTRL, '').replace(BIDI, '');
export function toSrt(cues) {
  return '﻿' + cues.map((c, n) => (n + 1) + '\n' + srtTime(c.s) + ' --> ' + srtTime(c.e) + '\n' + c.lines.map((x) => RLM + clean(x)).join('\n') + '\n').join('\n');
}
/* מ7: ייצוא — WebVTT (נגני רשת) ו־TTML (פלטפורמות; xml:lang=he, direction=rtl) */
function vttTime(sec) { return srtTime(sec).replace(',', '.'); }
export function toVtt(cues) {
  return 'WEBVTT\n\n' + cues.map((c, n) => (n + 1) + '\n' + vttTime(c.s) + ' --> ' + vttTime(c.e) + '\n' + c.lines.map((x) => RLM + clean(x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')).join('\n') + '\n').join('\n');
}
const xml = (s) => clean(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export function toTtml(cues, title) {
  const t = (sec) => vttTime(sec);
  return '<?xml version="1.0" encoding="UTF-8"?>\n<tt xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling" xml:lang="he">\n' +
    '<head><metadata><ttm:title xmlns:ttm="http://www.w3.org/ns/ttml#metadata">' + xml(title || '') + '</ttm:title></metadata></head>\n<body><div tts:direction="rtl">\n' +
    cues.map((c) => '<p begin="' + t(c.s) + '" end="' + t(c.e) + '">' + c.lines.map(xml).join('<br/>') + '</p>').join('\n') + '\n</div></body>\n</tt>\n';
}
/* סבב 8: EBU STL (Tech 3264) — הפורמט של שידורי הטלוויזיה. בלוק GSI של 1024 בתים + בלוק TTI של 128 לכל כתובית.
   CCT ‏04 = ISO 8859-8 (לטינית/עברית), 25 פריימים לשנייה, סדר לוגי (כמו בקובץ ה־SRT). תו שאין לו מקום בטבלה — '?' */
export const STL_FPS = 25;
export const STL_TF = 112;                       // שדה הטקסט בכל TTI
const HEB = { '־': '-', '׳': "'", '״': '"', '–': '-', '—': '-', '‘': "'", '’': "'", '“': '"', '”': '"', '…': '...', ' ': ' ' };
export function stlBytes(text) {                 // שורה אחת → בתים ב־ISO 8859-8 (בלי ניקוד וטעמים)
  const out = [];
  for (const ch of clean(text).normalize('NFC').replace(/[֑-ׇ]/g, (c) => (c === '־' ? c : ''))) {
    const c = ch.codePointAt(0), m = HEB[ch];
    if (m) for (const x of m) out.push(x.charCodeAt(0));
    else if (c >= 0x20 && c < 0x7f) out.push(c);
    else if (c >= 0x5d0 && c <= 0x5ea) out.push(c - 0x5d0 + 0xe0);
    else if (c === 0xd7) out.push(0xaa); else if (c === 0xf7) out.push(0xba);
    else if (c >= 0xa0 && c <= 0xbe && c !== 0xa1 && c !== 0xaa && c !== 0xba) out.push(c);   // הטבלה של 8859-8 זהה ל־Latin-1 כאן
    else out.push(0x3f);
  }
  return out;
}
function stlTc(sec) {
  const f = Math.max(0, Math.round((Number(sec) || 0) * STL_FPS));
  return [Math.floor(f / (STL_FPS * 3600)) % 24, Math.floor(f / (STL_FPS * 60)) % 60, Math.floor(f / STL_FPS) % 60, f % STL_FPS];
}
const stlYmd = (d) => String(d.getUTCFullYear() % 100).padStart(2, '0') + String(d.getUTCMonth() + 1).padStart(2, '0') + String(d.getUTCDate()).padStart(2, '0');
export function toStl(cues, title, now) {
  const n = cues.length, d = new Date(Number(now) || Date.now());
  const t32 = String.fromCharCode(...stlBytes(title || '').slice(0, 32));
  const tc = (sec) => stlTc(sec).map((x) => String(x).padStart(2, '0')).join('');
  const f = (v, len) => String(v).slice(0, len).padEnd(len, ' ');
  const gsi = f('850', 3) + f('STL25.01', 8) + f('0', 1) + f('04', 2) + f('00', 2) + f(t32, 32) + f('', 32) + f(t32, 32) + f('', 32) + f('', 32) + f('', 32) +
    f('', 16) + f(stlYmd(d), 6) + f(stlYmd(d), 6) + f('00', 2) + f(String(n).padStart(5, '0'), 5) + f(String(n).padStart(5, '0'), 5) + f('001', 3) +
    f('40', 2) + f('23', 2) + f('1', 1) + f('00000000', 8) + f(n ? tc(cues[0].s) : '00000000', 8) + f('1', 1) + f('1', 1) + f('ISR', 3) +
    f('', 32) + f('', 32) + f('', 32) + f('', 75) + f('', 576);
  const buf = new Uint8Array(1024 + 128 * n);
  for (let i = 0; i < 1024; i++) buf[i] = gsi.charCodeAt(i) & 0xff;
  cues.forEach((c, i) => {
    const o = 1024 + 128 * i, sn = i + 1;
    buf.set([0, sn & 0xff, (sn >> 8) & 0xff, 0xff, 0], o);                 // SGN, SN (LE), EBN = אחרון, CS
    buf.set(stlTc(c.s), o + 5); buf.set(stlTc(c.e), o + 9);
    const lines = (c.lines || []).filter((x) => clean(x).trim()).slice(0, 2);
    buf.set([lines.length > 1 ? 20 : 22, 2, 0], o + 13);                   // VP (שורה), JC = ממורכז, CF
    let tf = [];
    lines.forEach((x, k) => { if (k) tf.push(0x8a); tf = tf.concat(stlBytes(x)); });
    tf = tf.slice(0, STL_TF);
    buf.fill(0x8f, o + 16, o + 128); buf.set(tf, o + 16);
  });
  return buf;
}
export function toCuesJson(cues) {
  return JSON.stringify(cues.map((c, n) => ({ id: n + 1, start: r3(c.s), end: r3(c.e), lines: c.lines.map(clean), en: c.en || '', spk: c.spk || '' })));
}

/* ---------- שבירת שורות: עד Q_LEN תווים — שורה אחת; אחרת שתיים, מאוזנות, עדיפות אחרי פיסוק ---------- */
export function autoBreak(text, max = Q_LEN) {
  const t = clean(text).replace(/\s+/g, ' ').trim();
  if (!t) return [];
  if (t.length <= max) return [t];
  let best = -1, score = Infinity;
  for (let i = 1; i < t.length - 1; i++) {
    if (t[i] !== ' ') continue;
    const a = i, b = t.length - i - 1;
    let sc = Math.abs(a - b) + (a > max || b > max ? 1000 : 0);
    if (/[,.;:?!]/.test(t[i - 1])) sc -= 8;          // שבירה אחרי פסיק / נקודה — טבעית יותר לקריאה
    if (sc < score) { score = sc; best = i; }
  }
  return best < 0 ? [t] : [t.slice(0, best), t.slice(best + 1)];
}
const words = (s) => clean(s).replace(/\s+/g, ' ').trim();
export const textOf = (c) => c.lines.join('\n');
function linesOf(text) {
  const ls = String(text).split('\n').map((x) => words(x)).filter(Boolean);
  return ls.length > LINES_MAX ? ls.slice(0, LINES_MAX - 1).concat(ls.slice(LINES_MAX - 1).join(' ')) : ls;
}

/* ---------- פעולות (מחזירות מערך חדש; null = אי אפשר) ---------- */
export function setText(cues, i, text) {
  const c = cues[i];
  if (!c) return null;
  const lines = linesOf(text);
  if (!lines.length) return null;                  // כתובית ריקה — "מחיקה" (פעולה נפרדת, מפורשת)
  if (lines.join('\n') === c.lines.join('\n')) return cues;
  const out = cues.slice(); out[i] = Object.assign({}, c, { lines });
  return out;
}
/* פיצול במיקום הסמן (הטקסט בתיבה, כולל ירידות שורה). בלי מיקום טוב — באמצע. הזמן מתחלק לפי מספר התווים */
export function splitCue(cues, i, pos) {
  const c = cues[i];
  if (!c) return null;
  const all = c.lines.join('\n');
  pos = Math.max(0, Math.min(all.length, pos | 0));
  if (/\S/.test(all[pos - 1] || '') && /\S/.test(all[pos] || '')) {   // באמצע מילה — לרווח הקרוב
    const l = all.slice(0, pos).search(/\s\S*$/), r = all.slice(pos).search(/\s/);
    pos = l < 0 && r < 0 ? 0 : l < 0 ? pos + r : r < 0 ? l : (pos - l <= r ? l : pos + r);
  }
  let a = words(all.slice(0, pos)), b = words(all.slice(pos));
  if (!a || !b) {
    const flat = words(all), mid = flat.indexOf(' ', Math.floor(flat.length / 2));
    const at = mid > 0 ? mid : flat.lastIndexOf(' ');
    if (at <= 0) return null;                       // מילה אחת — אין מה לפצל
    a = flat.slice(0, at); b = flat.slice(at + 1);
  }
  const dur = c.e - c.s, t = r3(c.s + dur * a.length / (a.length + b.length));
  if (t - c.s < MIN_DUR || c.e - t < MIN_DUR) return null;
  const ew = words(c.en).split(' ').filter(Boolean), k = Math.round(ew.length * a.length / (a.length + b.length));
  const out = cues.slice();
  out.splice(i, 1, Object.assign({}, c, { e: t, lines: autoBreak(a), en: ew.slice(0, k).join(' ') }),
    Object.assign({}, c, { i: -1, s: t, lines: autoBreak(b), en: ew.slice(k).join(' ') }));
  return out;
}
/* מיזוג עם הכתובית הבאה */
export function mergeCues(cues, i) {
  const a = cues[i], b = cues[i + 1];
  if (!a || !b) return null;
  const out = cues.slice();
  out.splice(i, 2, Object.assign({}, a, { e: b.e, lines: autoBreak(words(a.lines.join(' ') + ' ' + b.lines.join(' '))),
    en: words((a.en || '') + ' ' + (b.en || '')), spk: a.spk || b.spk }));
  return out;
}
export function deleteCue(cues, i) {
  if (!cues[i]) return null;
  const out = cues.slice(); out.splice(i, 1);
  return out;
}
/* קצה (s / e) לזמן t — בלי חפיפה לשכנות ובלי לרדת מ־MIN_DUR */
export function setEdge(cues, i, edge, t) {
  const c = cues[i];
  if (!c || (edge !== 's' && edge !== 'e') || !Number.isFinite(t)) return null;
  const prev = cues[i - 1], next = cues[i + 1];
  let v = r3(t);
  if (edge === 's') v = Math.min(Math.max(v, prev ? prev.e : 0, 0), r3(c.e - MIN_DUR));
  else v = Math.max(Math.min(v, next ? next.s : Infinity), r3(c.s + MIN_DUR));
  if (v === c[edge]) return cues;
  const out = cues.slice(); out[i] = Object.assign({}, c, { [edge]: v });
  return out;
}
export const nudge = (cues, i, edge, dt) => (cues[i] ? setEdge(cues, i, edge, cues[i][edge] + dt) : null);
/* הזזת כל הכתוביות מ־from והלאה ב־dt (סנכרון): לא לפני 0 ולא לתוך הכתובית שלפני from */
export function shiftAll(cues, dt, from = 0) {
  if (!cues.length || !Number.isFinite(dt) || !dt || from < 0 || from >= cues.length) return null;
  const floor = from > 0 ? cues[from - 1].e : 0;
  const d = Math.max(dt, floor - cues[from].s);
  if (!d) return cues;
  return cues.map((c, k) => (k < from ? c : Object.assign({}, c, { s: r3(c.s + d), e: r3(c.e + d) })));
}

/* ---------- חיפוש והחלפה (טקסט רגיל, לא ביטוי רגולרי) ---------- */
export function findMatches(cues, q) {
  q = words(q);
  if (!q) return [];
  const lq = q.toLowerCase(), out = [];
  cues.forEach((c, k) => { if (c.lines.join(' ').toLowerCase().includes(lq)) out.push(k); });
  return out;
}
export function replaceAll(cues, q, rep) {
  q = words(q); rep = clean(rep).replace(/\n/g, ' ');
  if (!q) return { cues, n: 0 };
  const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  let n = 0;
  const out = cues.map((c) => {
    let hit = 0;
    const lines = c.lines.map((x) => x.replace(re, () => { hit++; return rep; })).map(words).filter(Boolean);
    if (!hit || !lines.length) return c;
    n += hit;
    return Object.assign({}, c, { lines });
  });
  return { cues: n ? out : cues, n };
}

/* ---------- מ6: הצעות לתיקון — מבדיקות הקוד (חינם, בלי טוקנים). תיקון בלחיצה (ביטול רגיל), "לא להציע שוב" לפי טביעה ---------- */
export const SUG_MAX = 3;
export const GAP_MIN = 0.083;                 // שני פריימים בין כתוביות (כמו vt)
const EXT_MAX = 2;                            // הארכה אוטומטית — עד 2 שנ׳
export function sugKey(c, k) {                // טביעה: סוג + הטקסט (FNV-1a) — לא תלויה במיקום, שורדת עריכות אחרות
  let x = 0x811c9dc5;
  const t = k + '|' + c.lines.join('\n');
  for (let i = 0; i < t.length; i++) { x ^= t.charCodeAt(i); x = Math.imul(x, 0x01000193) >>> 0; }
  return k + x.toString(36);
}
const passes = (c) => !cueIssues(c).some((k) => k !== 'en');
/* לכל כתובית עם בעיה — תיקון אחד שפותר אותה (אם יש): שבירת שורות מחדש ו/או הארכה לתוך הרווח (עד 2 שנ׳, בלי לגעת
   בשכנות), ואם לא מספיק — מיזוג עם הבאה. מחזיר עד max: { i, k: 'wrap'|'ext'|'wrapext'|'merge', key, cues } */
export function suggestions(cues, dismissed, max = SUG_MAX) {
  const out = [], no = dismissed || new Set();
  const ceil3 = (x) => Math.ceil(x * 1000 - 1e-6) / 1000, floor3 = (x) => Math.floor(x * 1000 + 1e-6) / 1000;
  for (let i = 0; i < cues.length && out.length < max; i++) {
    const c = cues[i], iss = cueIssues(c);
    if (!iss.length || (iss.length === 1 && iss[0] === 'en')) continue;   // אנגלית שלא תורגמה — רק תרגום (גיליון ה־AI)
    let fix = c, k = '';
    if (iss.includes('len') || iss.includes('lines')) {
      const lines = autoBreak(c.lines.join(' '));
      if (lines.length <= Q_LINES) { fix = Object.assign({}, fix, { lines }); k = 'wrap'; }
    }
    if (iss.includes('cps') || iss.includes('dur')) {
      const chars = fix.lines.reduce((t, x) => t + x.length, 0), need = Math.max(Q_MIN_DUR, chars / Q_CPS) - (c.e - c.s);
      const next = cues[i + 1], prev = cues[i - 1];
      const maxE = next ? next.s - GAP_MIN : Infinity, minS = prev ? prev.e + GAP_MIN : 0;
      const roomE = Math.max(0, maxE - c.e), roomS = Math.max(0, c.s - minS);
      if (need > 0 && need <= EXT_MAX && need <= roomE + roomS + 1e-9) {
        const de = Math.min(need, roomE), ds = need - de;
        fix = Object.assign({}, fix, { s: Math.max(minS, floor3(c.s - ds)), e: Math.min(maxE, ceil3(c.e + de)) });
        k = k ? 'wrapext' : 'ext';
      }
    }
    let next = null;
    if (k && passes(fix)) { next = cues.slice(); next[i] = fix; }
    else if (cues[i + 1]) { const m = mergeCues(cues, i); if (m && passes(m[i])) { next = m; k = 'merge'; } }
    if (!next) continue;
    const key = sugKey(c, k);
    if (!no.has(key)) out.push({ i, k, key, cues: next });
  }
  return out;
}

/* ---------- ביטול וחזרה: מצבים שלמים (המערכים לא משתנים — זול). עריכת טקסט רצופה באותה כתובית = צעד אחד ---------- */
/* סבב 4: מונח שתורגם בשתי דרכים (בלי AI) — terms = [[אנגלית, עברית עם חלופות ב־/], …] (מילון המונחים + המונחים של העבודה).
   כתובית שבאנגלית יש את המונח ובעברית אין אף חלופה שלו → [מזהה הכתובית, המונח]. השוואה בלי ניקוד ובלי האות האחרונה
   של מילה ארוכה (הטיות), כך שתחיליות (ו/ה/ב/ל…) וסופיות רגילות לא נספרות כ"שונה". טהור */
export const TERM_MAX = 200;
const heFold = (s) => clean(s).replace(/[\u0591-\u05C7]/g, '').replace(/[\u05BE\-־"'׳״]/g, ' ').replace(/[ךםןףץ]/g, (x) => 'כמנפצ'['ךםןףץ'.indexOf(x)]).replace(/\s+/g, ' ').trim();
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function termIssues(cues, terms) {
  const tt = [];
  for (const t of (Array.isArray(terms) ? terms : []).slice(0, TERM_MAX)) {
    if (!Array.isArray(t)) continue;
    const en = clean(t[0]).trim(), alts = String(t[1] || '').split('/').map((x) => heFold(x.replace(/\(.*?\)/g, ''))).filter((x) => x.length >= 2);
    if (en.length < 2 || !alts.length || !/[a-z]/i.test(en)) continue;
    const re = new RegExp('(^|[^a-z0-9])' + reEsc(en.toLowerCase()) + '(e?s)?(?=$|[^a-z0-9])');
    // כל חלופה = המילים שלה (כל מילה בלי האות האחרונה כשהיא ארוכה) — "הבינה המלאכותית" מתאימה ל"בינה מלאכותית"
    tt.push({ en, re, alts: alts.map((a) => a.split(' ').filter((w) => w.length >= 2).map((w) => (w.length >= 4 ? w.slice(0, -1) : w))).filter((ws) => ws.length) });
  }
  const out = [];
  if (!tt.length) return out;
  for (const c of cues || []) {
    const en = String(c.en || '').toLowerCase();
    if (!en) continue;
    const he = heFold(c.lines.join(' '));
    for (const t of tt) if (t.re.test(en) && !t.alts.some((ws) => ws.every((w) => he.includes(w)))) { out.push([c.i, t.en]); break; }
  }
  return out;
}
/* סימונים לבדיקה (מהביקורת / מהבדיקה של המונחים) לפי מזהה הכתובית — נעלמים כשהטקסט של הכתובית נערך */
export function flagIndex(cues, list) {
  const m = new Map();
  for (const [i, k] of Array.isArray(list) ? list : []) {
    if (!Number.isInteger(i) || typeof k !== 'string') continue;
    const c = (cues || []).find((x) => x.i === i);
    if (!c) continue;
    const r = m.get(i) || { t: textOf(c), k: [] };
    if (!r.k.includes(k)) r.k.push(k);
    m.set(i, r);
  }
  return m;
}

/* ---------- סבב 6: הציר — גל הקול, חילופי השוטים, דוברים ----------
   meta.json מהעובד (peaks.py): { v, r, pk: base64 — בית לכל 1/r שנ׳, sh: [שניות] }. **R/PK_MAX/SH_MAX זהים ל־peaks.py** */
export const META_R = 20, PK_MAX = 4 * 3600 * 20, SH_MAX = 5000;
export function normMeta(j) {
  if (!j || typeof j !== 'object' || j.v !== 1 || j.r !== META_R || typeof j.pk !== 'string' || j.pk.length > Math.ceil(PK_MAX / 3) * 4 + 4) return null;
  let pk;
  try {
    const bin = typeof atob === 'function' ? atob(j.pk) : Buffer.from(j.pk, 'base64').toString('binary');
    pk = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) pk[i] = bin.charCodeAt(i);
  } catch (e) { return null; }
  const sh = [];
  for (const t of Array.isArray(j.sh) ? j.sh.slice(0, SH_MAX) : []) if (typeof t === 'number' && t > 0 && t < 86400 && (!sh.length || t > sh[sh.length - 1])) sh.push(t);
  return { r: META_R, pk, sh };
}
/* הצמדה לחיתוך (כלל Netflix): התחלה עד SNAP_WIN מחילוף שוט — בדיוק עליו; סוף עד SNAP_WIN מחילוף — שני פריימים לפניו.
   לא חוצים כתובית שכנה ולא מקצרים מתחת ל־MIN_DUR (setEdge). מחזיר כתוביות חדשות או null (אין מה להצמיד) */
export const SNAP_WIN = 0.5;
function nearShot(sh, t) {
  let lo = 0, hi = sh.length - 1, best = null;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (sh[m] < t) lo = m + 1; else hi = m - 1; }
  for (const k of [lo - 1, lo]) if (k >= 0 && k < sh.length && Math.abs(sh[k] - t) <= SNAP_WIN && (best == null || Math.abs(sh[k] - t) < Math.abs(best - t))) best = sh[k];
  return best;
}
export function snapEdge(cues, i, edge, sh) {
  const c = cues[i];
  if (!c || !sh || !sh.length) return null;
  const x = nearShot(sh, c[edge]);
  if (x == null) return null;
  const t = edge === 's' ? x : r3(x - GAP_MIN);
  if (Math.abs(t - c[edge]) < 0.02) return null;
  const prev = cues[i - 1], next = cues[i + 1];   // שני פריימים לפחות בין כתוביות (כמו vt) — לא מצמידים לתוך הרווח הזה
  if (edge === 's' && prev && t - prev.e < GAP_MIN - 1e-6) return null;
  if (edge === 'e' && next && next.s - t < GAP_MIN - 1e-6) return null;
  const out = setEdge(cues, i, edge, t);
  return out && out !== cues && Math.abs(out[i][edge] - t) < 0.005 ? out : null;   // setEdge חסם (שכנה / אורך מינימלי) — לא חצי הצמדה
}
export function snapAll(cues, sh) {
  let cur = cues, n = 0;
  for (let i = 0; i < cues.length; i++) for (const e of ['s', 'e']) { const nx = snapEdge(cur, i, e, sh); if (nx) { cur = nx; n++; } }
  return { cues: cur, n };
}
/* צבע לכל דובר (לפי סדר ההופעה) — רק כשיש לפחות שניים */
export const SPK_COLORS = ['#64D2FF', '#FFD60A', '#FF9F0A', '#BF5AF2', '#30D158', '#FF6482'];
export function spkColors(cues) {
  const m = new Map();
  for (const c of cues || []) if (c.spk && !m.has(c.spk)) m.set(c.spk, SPK_COLORS[m.size % SPK_COLORS.length]);
  return m.size >= 2 ? m : new Map();
}
/* הציר מתחת לנגן: חלון של TL_SPAN שנ׳ סביב הזמן; גל הקול, הכתוביות (צבע הדובר), חילופי השוטים, סמן הניגון.
   נגיעה = קפיצה (על כתובית — בחירה שלה); גרירה = גלילה בזמן. opts: { meta, cues(), sel(), video, seek(t), pick(k), colors() } */
export const TL_SPAN = 16, TL_BEFORE = 5;
export function createTimeline(opts) {
  const cv = el('canvas', 'st-tl');
  cv.setAttribute('role', 'img'); cv.dataset.k = 'se-tl';
  const ctx = cv.getContext && cv.getContext('2d');
  let raf = 0, drag = null, alive = true;
  const v = opts.video;
  const now = () => (v ? v.currentTime || 0 : 0);
  const geo = () => { const w = cv.clientWidth || 320, h = cv.clientHeight || 56; return { w, h, t0: now() - TL_BEFORE, k: w / TL_SPAN }; };
  function draw() {
    if (!ctx || !alive) return;
    const dpr = (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1, g = geo();
    if (cv.width !== Math.round(g.w * dpr) || cv.height !== Math.round(g.h * dpr)) { cv.width = Math.round(g.w * dpr); cv.height = Math.round(g.h * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, g.w, g.h);
    const xOf = (t) => (t - g.t0) * g.k, band = 16, mid = band + (g.h - band) / 2, amp = (g.h - band) / 2 - 2;
    // גל הקול: עמודה לכל 2px — השיא בתחום
    const pk = opts.meta && opts.meta.pk, r = META_R;
    if (pk) {
      ctx.fillStyle = 'rgba(235,235,245,.38)';
      for (let x = 0; x < g.w; x += 2) {
        const a = Math.floor((g.t0 + x / g.k) * r), b = Math.max(a + 1, Math.floor((g.t0 + (x + 2) / g.k) * r));
        let m = 0;
        for (let i = Math.max(0, a); i < Math.min(pk.length, b); i++) if (pk[i] > m) m = pk[i];
        if (!m) continue;
        const hh = Math.max(1, (m / 255) ** 1.6 * amp);
        ctx.fillRect(x, mid - hh, 1.5, hh * 2);
      }
    }
    // חילופי השוטים
    const sh = (opts.meta && opts.meta.sh) || [];
    ctx.fillStyle = 'rgba(255,214,10,.85)';
    for (const t of sh) { if (t < g.t0) continue; if (t > g.t0 + TL_SPAN) break; ctx.fillRect(Math.round(xOf(t)), 0, 1, g.h); }
    // הכתוביות בפס העליון
    const cs = opts.cues(), sel = opts.sel(), col = opts.colors ? opts.colors() : null;
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i];
      if (c.e < g.t0) continue;
      if (c.s > g.t0 + TL_SPAN) break;
      const x0 = xOf(c.s), x1 = xOf(c.e);
      ctx.fillStyle = (col && col.get(c.spk)) || '#30D158';
      ctx.globalAlpha = i === sel ? 1 : 0.55;
      ctx.fillRect(x0 + 0.5, 3, Math.max(2, x1 - x0 - 1), band - 6);
      ctx.globalAlpha = 1;
      if (i === sel) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.strokeRect(x0 + 0.5, 2.5, Math.max(2, x1 - x0 - 1), band - 5); }
    }
    // סמן הניגון
    ctx.fillStyle = '#fff';
    ctx.fillRect(Math.round(xOf(now())) - 1, 0, 2, g.h);
  }
  function loop() { draw(); if (alive && v && !v.paused) raf = requestAnimationFrame(loop); else raf = 0; }
  const kick = () => { if (!raf && typeof requestAnimationFrame === 'function') raf = requestAnimationFrame(loop); };
  if (v) for (const ev of ['play', 'seeked', 'timeupdate', 'loadedmetadata']) v.addEventListener(ev, kick);
  cv.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, t: now(), moved: false }; try { cv.setPointerCapture(e.pointerId); } catch (x) {} });
  cv.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (Math.abs(dx) > 4) drag.moved = true;
    if (drag.moved) { opts.seek(Math.max(0, drag.t - dx / geo().k)); kick(); }
  });
  cv.addEventListener('pointerup', (e) => {
    const d = drag; drag = null;
    if (!d || d.moved) return;
    const rc = cv.getBoundingClientRect(), g = geo(), t = g.t0 + (e.clientX - rc.left) / g.k;
    const k = cueAt(opts.cues(), t);
    if (e.clientY - rc.top < 18 && k >= 0 && opts.pick) opts.pick(k);
    opts.seek(Math.max(0, t)); kick();
  });
  cv.addEventListener('pointercancel', () => { drag = null; });
  if (typeof ResizeObserver === 'function') { const ro = new ResizeObserver(() => draw()); ro.observe(cv); }
  return { el: cv, draw, destroy() { alive = false; if (raf) cancelAnimationFrame(raf); } };
}

export function createHistory(initial) {
  let past = [], future = [], cur = initial, tag = '', at = 0, ver = 0;
  return {
    get cur() { return cur; }, get ver() { return ver; },
    canUndo: () => past.length > 0, canRedo: () => future.length > 0,
    push(next, t, now) {
      if (!next || next === cur) return false;
      const glue = t && t === tag && now - at < 1500;   // הקלדה רצופה
      if (!glue) { past.push(cur); if (past.length > UNDO_MAX) past.shift(); }
      future = []; cur = next; tag = t || ''; at = now || 0; ver++;
      return true;
    },
    undo() { if (!past.length) return false; future.push(cur); cur = past.pop(); tag = ''; ver++; return true; },
    redo() { if (!future.length) return false; past.push(cur); cur = future.pop(); tag = ''; ver++; return true; },
  };
}

/* ---------------- הרכיב (DOM) ---------------- */
const SVG = 'http://www.w3.org/2000/svg';
const PATHS = {
  undo: 'M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62A8 8 0 0 1 20.36 16l2.37-.78A10.5 10.5 0 0 0 12.5 8z',
  redo: 'M18.4 10.6A10.46 10.46 0 0 0 11.5 8 10.5 10.5 0 0 0 1.27 15.22l2.37.78A8 8 0 0 1 16.62 12.38L13 16h9V7z',
  search: 'M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 4.99L20.49 19zm-6 0a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z',
  warn: 'M1 21h22L12 2zm12-3h-2v-2h2zm0-4h-2v-4h2z',
  ai: 'M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25z',
};
function icon(k) {
  const s = document.createElementNS(SVG, 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(SVG, 'path'); p.setAttribute('d', PATHS[k]); p.setAttribute('fill', 'currentColor'); s.append(p);
  return s;
}
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function b(cls, label, fn, k, iconK) {
  const x = el('button', 'st-se-b ' + cls); x.type = 'button';
  if (iconK) { x.append(icon(iconK)); x.setAttribute('aria-label', label); } else x.textContent = label;
  if (/^[−+]\d/.test(label)) x.dir = 'ltr';           // ‎−0.1 / +1 — הסימן לא מתהפך ב־RTL
  if (k) x.dataset.k = k;
  x.addEventListener('click', (e) => { e.stopPropagation(); fn(e); });
  return x;
}

/* opts: { cues (normCues), T, issueName(k), getTime(), seek(t), play(), flash(msg), onChange(cues, ver) }.
   מחזיר { el, cues(), ver(), time(t), setSaved(ver), destroy }. כתובית אחת פתוחה לעריכה בכל רגע (תיבת טקסט אחת — קל גם ל־1,500 כתוביות) */
export function createSubsEditor(opts) {
  const issMemo = new WeakMap();                       // מ9: הבדיקות לכל אובייקט כתובית — פעם אחת (בכל הקשה סופרים את כולן)
  const flags = opts.flags instanceof Map ? opts.flags : new Map();   // סבב 4: מזהה → { t: הטקסט המקורי, k: [סוגים] }
  const shots = Array.isArray(opts.shots) ? opts.shots : [];          // סבב 6: חילופי השוטים (הצמדה)
  const colors = spkColors(opts.cues);                                 // סבב 6: צבע לכל דובר
  const flagsOf = (c) => { const f = flags.get(c.i); return f && f.t === textOf(c) ? f.k : []; };
  const issOf = (c) => { let v = issMemo.get(c); if (!v) { v = cueIssues(c).concat(flagsOf(c)); issMemo.set(c, v); } return v; };
  const T = opts.T || ((k) => k);
  const iname = opts.issueName || ((k) => k);
  const hist = createHistory((opts.cues || []).map((c) => Object.assign({}, c)));
  let sel = -1, only = !!opts.only, act = -1, q = '', rep = '', searchOn = false, shiftOn = false;
  const wrap = el('div', 'st-se');
  const bar = el('div', 'st-se-bar');
  const undoB = b('ic', T('studioSeUndo'), () => { if (hist.undo()) { sel = Math.min(sel, hist.cur.length - 1); changed(true); } }, 'se-undo', 'undo');
  const redoB = b('ic', T('studioSeRedo'), () => { if (hist.redo()) { sel = Math.min(sel, hist.cur.length - 1); changed(true); } }, 'se-redo', 'redo');
  const onlyB = b('chip', '', () => { only = !only; sel = -1; paintList(); }, 'se-only');
  const findB = b('ic', T('studioSeFind'), () => { searchOn = !searchOn; paintSearch(); if (searchOn) fq.focus(); }, 'se-find', 'search');
  bar.append(undoB, redoB, onlyB, el('span', 'st-se-sp'), findB);
  if (opts.onAi) bar.append(b('ic', T('studioAiTitle'), () => opts.onAi(), 'se-ai', 'ai'));   // מ7: גיליון ה־AI
  const sp = el('div', 'st-se-search'); sp.hidden = true;
  const fq = el('input', 'st-se-in'); fq.type = 'search'; fq.placeholder = T('studioSeFindPh'); fq.dir = 'auto'; fq.dataset.k = 'se-q';
  const fr = el('input', 'st-se-in'); fr.type = 'text'; fr.placeholder = T('studioSeReplPh'); fr.dir = 'auto'; fr.dataset.k = 'se-r';
  const fn = el('span', 'st-se-n');
  const frB = b('st-se-go', T('studioSeReplAll'), () => {
    const r = replaceAll(hist.cur, q, rep);
    if (r.n && hist.push(r.cues, '', Date.now())) changed(true);
    fn.textContent = r.n ? T('studioSeReplaced', { n: r.n }) : T('studioSeNoMatch');
  }, 'se-repl');
  fq.addEventListener('input', () => { q = fq.value; paintList(); });
  fr.addEventListener('input', () => { rep = fr.value; });
  const sr = el('div', 'st-se-srow'); sr.append(fr, frB);
  sp.append(fq, sr, fn);
  const listEl = el('div', 'st-se-list'); listEl.setAttribute('role', 'list');
  const sugEl = el('div', 'st-sg');           // מ6: עד 3 הצעות לתיקון (בדיקות הקוד, חינם)
  const dismissed = opts.dismissed || new Set();
  wrap.append(bar, sp, sugEl, listEl);
  const SUG_LBL = { wrap: () => T('studioSgWrap'), ext: () => T('studioSgExt'), wrapext: () => T('studioSgWrapExt'), merge: () => T('studioSgMerge') };
  function paintSug() {
    const ss = suggestions(hist.cur, dismissed);
    sugEl.replaceChildren();
    // סבב 6: הצמדה לחילופי השוטים — כרטיס אחד לכל הכתוביות (כלל Netflix), לפני ההצעות הרגילות
    const sn = shots.length ? snapAll(hist.cur, shots) : { n: 0 }, snKey = 'snap:' + shots.length + ':' + sn.n;
    if (sn.n && !dismissed.has(snKey)) {
      const card = el('div', 'st-sg-c');
      const t = el('div', 'st-sg-t'); t.append(el('b', null, T('studioSgSnap', { n: sn.n })));
      const pv = el('div', 'st-sg-p', T('studioSgSnapS'));
      const acts = el('div', 'st-sg-a');
      acts.append(b('done', T('studioSgFix'), () => { if (apply(snapAll(hist.cur, shots).cues, null) && opts.flash) opts.flash(T('studioSgFixed')); }, 'sg-snap'),
        b('', T('studioSgNo'), () => { dismissed.add(snKey); if (opts.onDismiss) opts.onDismiss(snKey); paintSug(); }, 'sg-snap-no'));
      card.append(t, pv, acts);
      sugEl.append(card);
    }
    sugEl.hidden = !ss.length && !sugEl.childNodes.length;
    for (const g of ss) {
      const c = hist.cur[g.i], nc = g.cues[g.i];
      const card = el('div', 'st-sg-c');
      const t = el('div', 'st-sg-t');
      t.append(el('b', null, SUG_LBL[g.k]()), el('span', 'st-sg-w', ' · '));
      const at = el('bdi', 'st-sg-w', fmtTc(c.s)); t.append(at);
      const pv = el('div', 'st-sg-p'); pv.dir = 'rtl';
      for (const x of nc.lines) pv.append(el('div', null, x));
      const acts = el('div', 'st-sg-a');
      acts.append(b('done', T('studioSgFix'), () => {
        if (apply(g.cues, null)) { if (opts.flash) opts.flash(T('studioSgFixed')); if (opts.onSugFix) opts.onSugFix(g.k); }
      }, 'sg-fix:' + g.i),
      b('', T('studioSgNo'), () => { dismissed.add(g.key); if (opts.onDismiss) opts.onDismiss(g.key); paintSug(); }, 'sg-no:' + g.i),
      b('', T('studioSgShow'), () => { choose(g.i); opts.seek(c.s); }, 'sg-go:' + g.i));
      card.append(t, pv, acts);
      sugEl.append(card);
    }
  }

  function changed(structural) {
    paintBar();
    if (structural) { paintList(); paintSug(); } else paintRow(sel);
    if (opts.onChange) opts.onChange(hist.cur, hist.ver);
  }
  function paintBar() {
    undoB.disabled = !hist.canUndo(); redoB.disabled = !hist.canRedo();
    const n = hist.cur.reduce((a, c) => a + (issOf(c).length ? 1 : 0), 0);
    onlyB.textContent = n ? T('studioSeOnly', { n }) : T('studioSeNoIssues');
    onlyB.classList.toggle('on', only); onlyB.disabled = !n && !only;
    onlyB.setAttribute('aria-pressed', only ? 'true' : 'false');
  }
  function paintSearch() {
    sp.hidden = !searchOn; findB.classList.toggle('on', searchOn);
    if (!searchOn) { q = ''; fq.value = ''; fn.textContent = ''; paintList(); }
  }
  const rows = new Map();     // אינדקס → שורה
  function visible() {
    const cs = hist.cur, m = q ? new Set(findMatches(cs, q)) : null, out = [];
    cs.forEach((c, k) => { if ((!only || issOf(c).length || k === sel) && (!m || m.has(k))) out.push(k); });
    return out;
  }
  /* מ9 (ביצועים): שורה סגורה שמורה לפי אובייקט הכתובית (הפעולות לא משנות במקום) — אחרי פיצול / מיזוג / ביטול
     רק השורות החדשות נבנות, והשאר נשארות במקומן ב־DOM (בלי חישוב סגנון מחדש ל־1,500 שורות) */
  const keep = new WeakMap();
  function paintList() {
    rows.clear();
    const ks = visible(), want = [];
    for (const k of ks) {
      const c = hist.cur[k];
      let r = k !== sel ? keep.get(c) : null;
      if (r) {
        r.dataset.k = 'cue:' + k; r.firstChild.dataset.k = 'cue-t:' + k;
        r.classList.toggle('act', k === act);
        rows.set(k, r);
      } else r = mkRow(k);
      want.push(r);
    }
    const set = new Set(want);
    let at = listEl.firstChild;
    for (const r of want) {
      while (at && !set.has(at)) { const nx = at.nextSibling; at.remove(); at = nx; }
      if (r === at) { at = at.nextSibling; continue; }
      listEl.insertBefore(r, at);
    }
    while (at) { const nx = at.nextSibling; at.remove(); at = nx; }
    if (!ks.length) listEl.append(el('div', 'st-se-empty', q ? T('studioSeNoMatch') : T('studioSeNoIssues')));
    if (searchOn && q) fn.textContent = T('studioSeFound', { n: ks.length });
  }
  const idxOf = (c) => hist.cur.indexOf(c);
  function paintRow(k) {
    const old = rows.get(k);
    if (!old) return;
    const nr = (k !== sel && keep.get(hist.cur[k])) || mkRow(k);
    if (nr !== old) old.replaceWith(nr);
    rows.set(k, nr);
  }
  /* מ9 (ביצועים): בחירה / סיום — רק שתי השורות שהשתנו, לא 1,500 (נמדד: 4 שנ׳ בטלפון חלש) */
  function choose(k) {
    const prev = sel;
    sel = k;
    if (prev >= 0 && prev !== k) paintRow(prev);
    if (k >= 0) { if (rows.has(k)) paintRow(k); else paintList(); scrollTo(k); }
  }
  function issueChips(c) {
    const box = el('span', 'st-se-iss');
    for (const x of issOf(c)) box.append(el('span', 'st-se-chip', iname(x)));
    return box;
  }
  function meta(c) {
    const dur = c.e - c.s, chars = c.lines.reduce((a, x) => a + x.length, 0);
    const m = el('span', 'st-se-meta');
    const d = el('bdi', null, dur.toFixed(1) + ' ' + T('studioSeSecShort') + ' · ' + Math.round(chars / Math.max(0.01, dur)) + ' ' + T('studioSeCps'));
    m.append(d);
    return m;
  }
  function mkRow(k) {
    const c = hist.cur[k], open = k === sel;
    const r = el('div', 'st-se-row' + (open ? ' open' : '') + (k === act ? ' act' : '') + (issOf(c).length ? ' bad' : '') + (colors.has(c.spk) ? ' spk' : ''));
    if (colors.has(c.spk)) r.style.setProperty('--spk', colors.get(c.spk));   // סבב 6: צבע הדובר
    r.setAttribute('role', 'listitem'); r.dataset.k = 'cue:' + k;
    const tm = b('st-se-tm', '', () => { opts.seek(c.s); opts.play(); }, 'cue-t:' + k);   // c — האובייקט, לא האינדקס (שורה שמורה זזה)
    tm.append(el('bdi', null, fmtTc(c.s)));
    tm.setAttribute('aria-label', T('studioSePlayFrom', { t: fmtTc(c.s) }));
    const body = el('div', 'st-se-body');
    if (open) {
      const ta = el('textarea', 'st-se-ta'); ta.dir = 'rtl'; ta.rows = Math.max(2, c.lines.length); ta.value = textOf(c);
      ta.dataset.k = 'cue-ta:' + k; ta.setAttribute('aria-label', T('studioSeText'));
      const chips = issueChips(c), mt = meta(c);
      ta.addEventListener('input', () => {
        const nx = setText(hist.cur, k, ta.value);
        if (!nx || nx === hist.cur) return;
        hist.push(nx, 'txt:' + k, Date.now());
        const cc = hist.cur[k];
        chips.replaceWith(issueChips(cc)); mt.replaceWith(meta(cc));
        r.classList.toggle('bad', issOf(cc).length > 0);
        paintBar();
        if (opts.onChange) opts.onChange(hist.cur, hist.ver);
      });
      body.append(ta, el('div', 'st-se-mrow'));
      body.lastChild.append(mt, chips);
      body.append(actions(k, ta));
      setTimeout(() => { try { if (document.activeElement !== ta && opts.autofocus !== false) ta.focus({ preventScroll: true }); } catch (e) {} }, 0);
    } else {
      const tx = el('div', 'st-se-tx'); tx.dir = 'rtl';
      for (const x of c.lines) tx.append(el('div', null, x));
      body.append(tx);
      const iss = issOf(c);
      if (iss.length) { const w = el('span', 'st-se-warn'); w.append(icon('warn')); w.setAttribute('aria-label', iss.map(iname).join(', ')); body.append(w); }
      r.addEventListener('click', () => { const i = idxOf(c); if (i >= 0) choose(i); });
      keep.set(c, r);
    }
    r.append(tm, body);
    rows.set(k, r);
    return r;
  }
  function apply(nx, keepSel) {
    if (!nx) return false;
    if (hist.push(nx, '', Date.now())) { sel = keepSel != null ? keepSel : -1; changed(true); return true; }
    return false;
  }
  function actions(k, ta) {
    const box = el('div', 'st-se-acts');
    const c = hist.cur[k];
    const tr = el('div', 'st-se-trow');
    const edge = (e, lbl) => {
      const g = el('span', 'st-se-edge');
      g.append(el('span', 'st-se-el', lbl));
      g.append(b('sm', '−' + STEP, () => apply(nudge(hist.cur, k, e, -STEP), k), 'cue-' + e + '-:' + k));
      const v = el('bdi', 'st-se-ev', fmtTc(c[e])); g.append(v);
      g.append(b('sm', '+' + STEP, () => apply(nudge(hist.cur, k, e, STEP), k), 'cue-' + e + '+:' + k));
      g.append(b('sm now', T('studioSeNow'), () => apply(setEdge(hist.cur, k, e, opts.getTime()), k), 'cue-' + e + 'n:' + k));
      return g;
    };
    tr.append(edge('s', T('studioSeStart')), edge('e', T('studioSeEnd')));
    const ar = el('div', 'st-se-arow');
    ar.append(b('', T('studioSeSplit'), () => { if (!apply(splitCue(hist.cur, k, ta.selectionStart || 0), k)) opts.flash && opts.flash(T('studioSeSplitNo')); }, 'cue-split:' + k));
    if (k < hist.cur.length - 1) ar.append(b('', T('studioSeMerge'), () => apply(mergeCues(hist.cur, k), k), 'cue-merge:' + k));
    if (shots.length) {   // סבב 6: הצמדה לחיתוך הקרוב (התחלה ו/או סוף)
      const snapped = () => { let cur = hist.cur, any = false; for (const e of ['s', 'e']) { const nx = snapEdge(cur, k, e, shots); if (nx) { cur = nx; any = true; } } return any ? cur : null; };
      if (snapped()) ar.append(b('', T('studioSeSnap'), () => apply(snapped(), k), 'cue-snap:' + k));
    }
    ar.append(b(shiftOn ? 'on' : '', T('studioSeShift'), () => { shiftOn = !shiftOn; paintRow(k); }, 'cue-shift:' + k));
    ar.append(b('danger', T('studioSeDel'), () => apply(deleteCue(hist.cur, k), Math.min(k, hist.cur.length - 2)), 'cue-del:' + k));
    ar.append(b('done', T('studioSeDone'), () => { choose(-1); paintSug(); }, 'cue-done:' + k));
    box.append(tr, ar);
    if (shiftOn) {
      // סנכרון: כל הכתוביות מהזו והלאה זזות יחד (התרגום מוקדם / מאוחר מהדיבור)
      const sr = el('div', 'st-se-shift');
      sr.append(el('span', 'st-se-el', T('studioSeShiftFrom')));
      for (const d of [-1, -STEP, STEP, 1]) sr.append(b('sm', (d > 0 ? '+' : '−') + Math.abs(d), () => apply(shiftAll(hist.cur, d, k), k), 'cue-sh' + d + ':' + k));
      box.append(sr);
    }
    return box;
  }
  function scrollTo(k) {
    const r = rows.get(k);
    if (r && r.scrollIntoView) try { r.scrollIntoView({ block: 'nearest' }); } catch (e) {}
  }
  paintBar(); paintList(); paintSug();
  return {
    el: wrap,
    cues: () => hist.cur, ver: () => hist.ver,
    /* הזמן של הנגן: הכתובית שמתנגנת מודגשת; בזמן ניגון (כשלא עורכים) הרשימה עוקבת אחריה */
    time(t, playing) {
      const k = cueAt(hist.cur, t);
      if (k === act) return;
      const o = rows.get(act); if (o) o.classList.remove('act');
      act = k;
      const n = rows.get(k); if (n) n.classList.add('act');
      if (playing && sel < 0 && n) scrollTo(k);
    },
    select(k) { choose(k); },
    colors: () => colors,   // סבב 6: לציר
    /* סבב 4: "רק בעיות" מבחוץ (ההצעה "לבדיקה שלך" כשהעורך כבר טעון) */
    showOnly(on) { if (only === !!on) return; only = !!on; sel = -1; paintBar(); paintList(); },
    selected: () => sel,
    /* מ7: שינויים מגיליון ה־AI — צעד ביטול אחד */
    applyCues(next) { return apply(next, null); },
    destroy() { rows.clear(); },
  };
}

/* ---------- מאגר הלמידה מ׳3 (15/10/2026): מה השתנה בין שתי גרסאות של הכתוביות — טהור ----------
   לא לפי מזהים (השמירה ממספרת מחדש, ופיצול יוצר כתוביות חדשות) — לפי חפיפה בזמן: שתי כתוביות "אותה" אם החפיפה ביניהן
   היא לפחות ED_OV מהקצרה. כל רכיב קשיר = שינוי אחד: txt (טקסט; m = גם הזמנים זזו), tm (רק זמן), sp (פיצול), mg (מיזוג),
   add / del, mx (מורכב). cd / wd = מרחק עריכה בתווים / במילים (כמו HTER — כמה צריך היה לתקן) */
export const ED_MAX = 1500, ED_TM = 0.05, ED_OV = 0.3;
const edTxt = (c) => c.lines.join('\n');
function lev(a, b) {
  if (a.length > 600 || b.length > 600) return Math.max(a.length, b.length);   // כתובית ארוכה מאוד — אומדן עליון
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
const edWords = (s) => s.split(/\s+/).filter(Boolean);
export function editDiff(before, after) {
  const A = (before || []).slice().sort((x, y) => x.s - y.s), B = (after || []).slice().sort((x, y) => x.s - y.s);
  const par = Array.from({ length: A.length + B.length }, (_, k) => k);
  const find = (k) => { while (par[k] !== k) { par[k] = par[par[k]]; k = par[k]; } return k; };
  const join = (x, y) => { par[find(x)] = find(y); };
  for (let i = 0, j0 = 0; i < A.length; i++) {
    const a = A[i];
    while (j0 < B.length && B[j0].e <= a.s) j0++;
    for (let j = j0; j < B.length && B[j].s < a.e; j++) {
      const b = B[j], ov = Math.min(a.e, b.e) - Math.max(a.s, b.s);
      if (ov > 0 && ov >= ED_OV * Math.min(a.e - a.s, b.e - b.s)) join(i, A.length + j);
    }
  }
  const comp = new Map();
  const put = (k, side, c) => { const r = find(k); if (!comp.has(r)) comp.set(r, { b: [], a: [] }); comp.get(r)[side].push(c); };
  A.forEach((c, i) => put(i, 'b', c)); B.forEach((c, j) => put(A.length + j, 'a', c));
  const out = [];
  for (const g of comp.values()) {
    const nb = g.b.length, na = g.a.length;
    let t;
    if (nb === 1 && na === 1) {
      const x = g.b[0], y = g.a[0], txt = edTxt(x) !== edTxt(y), tm = Math.abs(x.s - y.s) > ED_TM || Math.abs(x.e - y.e) > ED_TM;
      if (!txt && !tm) continue;
      t = txt ? 'txt' : 'tm';
      g.m = txt && tm ? 1 : 0;
    } else t = !nb ? 'add' : !na ? 'del' : nb === 1 ? 'sp' : na === 1 ? 'mg' : 'mx';
    const hb = g.b.map(edTxt).join('\n'), ha = g.a.map(edTxt).join('\n');
    const row = { t, b: g.b.map((c) => ({ s: r3(c.s), e: r3(c.e), h: edTxt(c) })), a: g.a.map((c) => ({ s: r3(c.s), e: r3(c.e), h: edTxt(c) })),
      en: g.b.map((c) => c.en || '').filter(Boolean).join(' '), cd: lev(hb.replace(/\s+/g, ' '), ha.replace(/\s+/g, ' ')), wd: lev(edWords(hb), edWords(ha)) };
    if (g.m) row.m = 1;
    out.push(row);
  }
  out.sort((x, y) => ((x.b[0] || x.a[0]).s - (y.b[0] || y.a[0]).s));
  return out.slice(0, ED_MAX);
}
/* מספרים בלבד — למאגר (בלי טקסט): כמה שינויים מכל סוג, מרחקי העריכה, וכמה מילים / תווים יש בגרסה החדשה (המכנה של HTER) */
export const ED_KINDS = ['txt', 'tm', 'sp', 'mg', 'add', 'del', 'mx'];
export function editStats(diff, after) {
  const o = { n: diff.length, cd: 0, wd: 0, m: 0, wa: 0, ca: 0 };
  for (const k of ED_KINDS) o[k] = 0;
  for (const d of diff) { o[d.t] = (o[d.t] || 0) + 1; o.cd += d.cd || 0; o.wd += d.wd || 0; if (d.m) o.m++; }
  for (const c of after || []) { const t = edTxt(c); o.wa += edWords(t).length; o.ca += t.replace(/\s+/g, '').length; }
  return o;
}
