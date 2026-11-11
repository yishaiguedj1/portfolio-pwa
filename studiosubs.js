/* מ2–מ3 (10/10/2026): עורך הכתוביות של סטודיו התרגום — אחרי התרגום, לפני (או בלי) צריבה מחדש.
   הנגן למעלה (studioplay.js) מציג את הכתוביות הערוכות בזמן אמת; כל כתובית: טקסט, תזמון, פיצול / מיזוג / מחיקה,
   בדיקות חיות (אותם כללים כמו מדד האיכות), חיפוש והחלפה, ביטול וחזרה.
   הלוגיקה טהורה ובלתי משנה (מחזירה מערך חדש) — נבדקת ב־node; ה־DOM רק ב־createSubsEditor. בלי רשת: studio.js שומר. */
import { cueIssues, cueAt, Q_LEN, Q_CPS, Q_LINES, Q_MIN_DUR, langDir, lineDir } from './studioplay.js';

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
/* Academy Pro גל 6 (C12, 03/11/2026): הכתוביות → טקסט ההרצאה (Markdown) לקריאה ב־Academy. פסקה חדשה בשתיקה של 2.5 שניות
   או אחרי ~90 שניות בסוף משפט; כותרת לכל פרק (מ"רעיונות" / מהאתר). טהורה */
export function toLectureMd(cues, chap, title) {
  const ch = (Array.isArray(chap) ? chap : []).filter((c) => c && c.title).slice().sort((a, b) => a.t - b.t);
  const clean = (x) => String(x || '').replace(/<[^>]+>/g, '').replace(/\{[^}]*\}/g, '').replace(/^\s*[-–—]\s*/, '').replace(/^#+\s*/, '').trim();
  const out = ['# ' + clean(title || 'Lecture'), ''];
  let para = [], pStart = 0, last = -1, ci = 0;
  const flush = () => { if (para.length) { out.push(para.join(' ').replace(/\s+/g, ' ').trim(), ''); para = []; } };
  for (const c of cues || []) {
    while (ci < ch.length && ch[ci].t <= c.start + 0.5) { flush(); out.push('## ' + clean(ch[ci].title), ''); ci++; }
    const txt = (c.lines || []).map(clean).filter(Boolean).join(' ');
    if (!txt) continue;
    if (para.length && (c.start - last >= 2.5 || (c.start - pStart > 90 && /[.!?…]["”'׳]?$/.test(para[para.length - 1])))) flush();
    if (!para.length) pStart = c.start;
    para.push(txt); last = c.end;
  }
  flush();
  return out.join('\n').trim() + '\n';
}
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
  return JSON.stringify(cues.map((c, n) => ({ id: n + 1, start: r3(c.s), end: r3(c.e), lines: c.lines.map(clean), en: c.en || '', spk: c.spk || '', ...(c.lg ? { lg: c.lg, src: c.src || '' } : {}) })));   // 10/11/2026: השפה של הקטע נשמרת גם אחרי עריכה
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
const ceil3 = (x) => Math.ceil(x * 1000 - 1e-6) / 1000, floor3 = (x) => Math.floor(x * 1000 + 1e-6) / 1000;
/* התיקון לכתובית i (גם ללוח הבדיקה, סבב 4 של השדרוג): { k, cues } או null */
export function fixOf(cues, i) {
  const c = cues[i], iss = c ? cueIssues(c) : [];
  if (!iss.length || (iss.length === 1 && iss[0] === 'en')) return null;   // אנגלית שלא תורגמה — רק תרגום (גיליון ה־AI)
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
  return next ? { k, cues: next } : null;
}
export function suggestions(cues, dismissed, max = SUG_MAX) {
  const out = [], no = dismissed || new Set();
  for (let i = 0; i < cues.length && out.length < max; i++) {
    const f = fixOf(cues, i);
    if (!f) continue;
    const c = cues[i], k = f.k, next = f.cues;
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

/* A9 (01/11/2026): ההערות מהעובד (notes.json) לפי מזהה הכתובית — כמו flagIndex, נעלמות כשהטקסט נערך.
   **NOTE_KEYS זהים בעובד (job.py smart_notes)**. lv: l לבדוק · m לשקול; p חלופות; x מה הצופה לא הבין; lg + o השפה והמקור */
export const NOTE_KEYS = ['lv', 'r', 'jg', 'x', 'p', 'lg', 'o'];
export function normNote(n) {
  if (!n || typeof n !== 'object' || (n.lv !== 'l' && n.lv !== 'm')) return null;
  const s = (v, m) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, m) : '');
  const out = { lv: n.lv, r: Array.isArray(n.r) ? n.r.filter((x) => typeof x === 'string' && /^[a-z:]{1,12}$/.test(x)).slice(0, 8) : [] };
  if (Number.isInteger(n.jg) && n.jg >= 1 && n.jg <= 5) out.jg = n.jg;
  if (s(n.x, 120)) out.x = s(n.x, 120);
  const p = Array.isArray(n.p) ? n.p.map((a) => s(a, 90)).filter(Boolean).slice(0, 3) : [];
  if (p.length) out.p = p;
  if (/^[a-z]{2,3}(-[a-z]{2})?$/i.test(String(n.lg || '')) && s(n.o, 400)) { out.lg = String(n.lg).toLowerCase(); out.o = s(n.o, 400); }
  return out;
}
export function noteIndex(cues, notes) {
  const m = new Map(), c = notes && typeof notes === 'object' && notes.c && typeof notes.c === 'object' ? notes.c : {};
  for (const [k, v] of Object.entries(c)) {
    const i = Number(k), n = normNote(v);
    if (!Number.isInteger(i) || !n) continue;
    const cue = (cues || []).find((x) => x.i === i);
    if (cue) m.set(i, { t: textOf(cue), n });
  }
  m.js = notes && typeof notes.js === 'number' && notes.js >= 1 && notes.js <= 5 ? Math.round(notes.js * 10) / 10 : null;
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
  return { r: META_R, pk, sh, wd: normWords(j.wd) };
}

/* ---------- סבב 4 של השדרוג (2/11/2026): זמן לכל מילה, מילים לא בטוחות, נשימה, בדיקה, דוברים ----------
   המילים של המקור מ־timeline.json (peaks.py): [[s, e, מילה, ביטחון 0–100 או ‎-1], …] בסדר עולה.
   **WD_MAX / WD_LEN זהים ל־peaks.py**. בלי מילים (עבודה ישנה) — wd = null והעורך כמו קודם */
export const WD_MAX = 60000, WD_LEN = 40, UNSURE = 50;
export function normWords(a) {
  if (!Array.isArray(a) || !a.length) return null;
  const n = Math.min(a.length, WD_MAX), s = new Float64Array(n), e = new Float64Array(n), c = new Int8Array(n), w = [];
  let k = 0, last = -1;
  for (let i = 0; i < n; i++) {
    const x = a[i];
    if (!Array.isArray(x)) continue;
    const xs = x[0], xe = x[1], xw = typeof x[2] === 'string' ? x[2].trim() : '', xc = x[3];
    if (typeof xs !== 'number' || !(xs >= 0 && xs < 86400) || typeof xe !== 'number' || !(xe > xs) || !xw || xs < last) continue;
    s[k] = xs; e[k] = Math.min(xe, xs + 10); w.push(xw.slice(0, WD_LEN));
    c[k] = Number.isInteger(xc) && xc >= 0 && xc <= 100 ? xc : -1;
    last = xs; k++;
  }
  return k ? { n: k, s: s.subarray(0, k), e: e.subarray(0, k), w, c: c.subarray(0, k) } : null;
}
/* המילים שמרכזן בתוך [a, b] — [מ־, עד) באינדקסים (חיפוש בינארי; מילה ארוכה לכל היותר 10 שנ׳) */
export function wordsIn(wd, a, b) {
  if (!wd) return [0, 0];
  let lo = 0, hi = wd.n;
  while (lo < hi) { const m = (lo + hi) >> 1; if (wd.s[m] < a - 10) lo = m + 1; else hi = m; }
  let i0 = -1, i1 = -1;
  for (let i = lo; i < wd.n && wd.s[i] <= b; i++) {
    const mid = (wd.s[i] + wd.e[i]) / 2;
    if (mid >= a && mid <= b) { if (i0 < 0) i0 = i; i1 = i + 1; }
  }
  return i0 < 0 ? [0, 0] : [i0, i1];
}
/* C2: המילים בכתובית שהזיהוי לא בטוח בהן (ביטחון מתחת ל־UNSURE) */
export function unsureIn(wd, c) {
  const out = [];
  if (!wd || !c) return out;
  const [i0, i1] = wordsIn(wd, c.s, c.e);
  for (let i = i0; i < i1; i++) if (wd.c[i] >= 0 && wd.c[i] < UNSURE) out.push({ w: wd.w[i], s: wd.s[i], e: wd.e[i], c: wd.c[i] });
  return out;
}
/* המילים הלא בטוחות על הטקסט באנגלית של הכתובית: [[מ־, עד) בתווים, מילה] לפי הסדר — השוואה בלי פיסוק ורישיות */
const wNorm = (x) => String(x).toLowerCase().replace(/[^\p{L}\p{N}']/gu, '');
export function markUnsure(en, uns) {
  const out = [], toks = [], re = /\S+/g;
  let m;
  while ((m = re.exec(String(en || '')))) toks.push([m.index, m.index + m[0].length, wNorm(m[0])]);
  let at = 0;
  for (const u of uns || []) {
    const q = wNorm(u.w);
    if (!q) continue;
    for (let j = at; j < toks.length; j++) if (toks[j][2] === q) { out.push([toks[j][0], toks[j][1], u]); at = j + 1; break; }
  }
  return out;
}
/* B4: הנשימה בתוך הכתובית — הרווח הארוך בין מילים (לפחות BR_MIN, לא ב־BR_EDGE הקצוות); בלי מילים — השקט הארוך בגל
   (25 dB מתחת לשיא של הכתובית). מחזיר { a, b } בשניות או null */
export const BR_MIN = 0.15, BR_EDGE = 0.4, BR_DB = 106;   // 106 ≈ 25 dB בסולם של peaks.py (255 ל־60 dB)
export function breathIn(meta, c) {
  if (!meta || !c) return null;
  const lo = c.s + BR_EDGE, hi = c.e - BR_EDGE;
  if (hi <= lo) return null;
  let best = null;
  const wd = meta.wd;
  if (wd) {
    const [i0, i1] = wordsIn(wd, c.s, c.e);
    for (let i = i0; i + 1 < i1; i++) {
      const a = wd.e[i], b = wd.s[i + 1];
      if (b - a >= BR_MIN && a >= lo && b <= hi && (!best || b - a > best.b - best.a)) best = { a, b };
    }
    if (best || i1 - i0 >= 2) return best;   // יש מילים ואין רווח — אין נשימה (לא מנחשים מהגל)
  }
  const pk = meta.pk, r = meta.r || META_R;
  if (!pk || !pk.length) return null;
  let top = 0;
  for (let i = Math.max(0, Math.floor(c.s * r)); i < Math.min(pk.length, Math.ceil(c.e * r)); i++) if (pk[i] > top) top = pk[i];
  const q = top - BR_DB, iA = Math.ceil(lo * r), iB = Math.min(pk.length, Math.floor(hi * r));
  let a = -1;
  for (let i = iA; i <= iB; i++) {
    const quiet = i < iB && pk[i] <= q;
    if (quiet && a < 0) a = i;
    if (!quiet && a >= 0) { const len = (i - a) / r; if (len >= BR_MIN && (!best || len > best.b - best.a)) best = { a: a / r, b: i / r }; a = -1; }
  }
  return best;
}
/* B4: פיצול בנשימה — הזמן לפי הנשימה, הטקסט לפי כמה מהמקור נאמר לפניה (מילים; בלי — לפי הזמן), ברווח הקרוב ליחס
   (עדיפות לפסיק / נקודה). null = אין נשימה / מילה אחת / חלק קצר מ־MIN_DUR */
export function splitBreath(cues, i, meta) {
  const c = cues[i], br = c ? breathIn(meta, c) : null;
  if (!br) return null;
  const all = words(c.lines.join(' '));
  let fr = null;
  if (meta.wd) {
    const [i0, i1] = wordsIn(meta.wd, c.s, c.e);
    let nb = 0;
    for (let j = i0; j < i1; j++) if (meta.wd.e[j] <= br.a + 1e-6) nb++;
    if (i1 > i0) fr = nb / (i1 - i0);
  }
  if (fr == null) fr = (br.a - c.s) / (c.e - c.s);
  const target = all.length * fr;
  let at = -1, sc = Infinity;
  for (let p = 1; p < all.length - 1; p++) {
    if (all[p] !== ' ') continue;
    const d = Math.abs(p - target) / all.length - (/[,.;:?!]/.test(all[p - 1]) ? 0.12 : 0);
    if (d < sc) { sc = d; at = p; }
  }
  if (at < 0) return null;
  const t1 = r3(Math.min(br.a + 0.05, (br.a + br.b) / 2)), t2 = r3(Math.max(br.b - 0.05, t1 + GAP_MIN));
  if (t1 - c.s < MIN_DUR || c.e - t2 < MIN_DUR) return null;
  const ew = words(c.en).split(' ').filter(Boolean), k = Math.round(ew.length * fr);
  const out = cues.slice();
  out.splice(i, 1, Object.assign({}, c, { e: t1, lines: autoBreak(all.slice(0, at)), en: ew.slice(0, k).join(' ') }),
    Object.assign({}, c, { i: -1, s: t2, lines: autoBreak(all.slice(at + 1)), en: ew.slice(k).join(' ') }));
  return out;
}
/* B1: לוח הבדיקה לפי ת־כתוביות — לכל סוג, האינדקסים. gap = פחות משני פריימים לבאה; cut = קצה ליד חיתוך ולא עליו */
export const QC_KINDS = ['cps', 'dur', 'len', 'lines', 'gap', 'cut'];
export function qcScan(cues, shots) {
  const m = {};
  for (const k of QC_KINDS) m[k] = [];
  const sh = Array.isArray(shots) && shots.length ? shots : null;
  (cues || []).forEach((c, i) => {
    for (const k of cueIssues(c)) if (m[k]) m[k].push(i);
    const nx = cues[i + 1];
    if (nx && nx.s - c.e < GAP_MIN - 1e-6) m.gap.push(i);
    if (sh && (snapEdge(cues, i, 's', sh) || snapEdge(cues, i, 'e', sh))) m.cut.push(i);
  });
  return m;
}
/* תיקון של הסוגים שנבחרו בכל הכתוביות (צעד ביטול אחד בעורך). מהסוף להתחלה — מיזוג משנה רק את מה שאחרי.
   מחזיר { cues, n } — n = כמה תיקונים */
export function qcFix(cues, kinds, shots) {
  const want = new Set(kinds || []);
  let cur = cues, n = 0;
  if (want.has('cut') && Array.isArray(shots) && shots.length) { const r = snapAll(cur, shots); if (r.n) { cur = r.cues; n += r.n; } }
  for (let i = cur.length - 1; i >= 0; i--) {
    if (cueIssues(cur[i]).some((k) => want.has(k))) { const f = fixOf(cur, i); if (f) { cur = f.cues; n++; } }
    const c = cur[i], nx = cur[i + 1];
    if (want.has('gap') && c && nx && nx.s - c.e < GAP_MIN - 1e-6) {
      const o = setEdge(cur, i, 'e', r3(nx.s - GAP_MIN));
      if (o && o !== cur && nx.s - o[i].e >= GAP_MIN - 1e-6) { cur = o; n++; }
    }
  }
  return { cues: cur, n };
}
/* C3: דובר לכתובית, ושינוי שם לדובר בכל הכתוביות (השם נשמר בשדה spk — עד 20 תווים, כמו rerender.py) */
export const SPK_LEN = 20;
const spkName = (x) => clean(String(x || '')).replace(/\s+/g, ' ').trim().slice(0, SPK_LEN);
export function setSpk(cues, i, spk) {
  const c = cues[i], v = spkName(spk);
  if (!c || !v) return null;
  if (c.spk === v) return cues;
  const out = cues.slice(); out[i] = Object.assign({}, c, { spk: v });
  return out;
}
export function renameSpk(cues, from, to) {
  const v = spkName(to);
  if (!from || !v) return null;
  if (v === from) return cues;
  let hit = false;
  const out = cues.map((c) => (c.spk === from ? (hit = true, Object.assign({}, c, { spk: v })) : c));
  return hit ? out : null;
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
/* C3 (2/11/2026): over = { שם: מספר צבע } — הבחירה שלך, לפי שם הדובר (אותה דמות — אותו צבע בכל הפרקים) */
export function spkColors(cues, over) {
  const m = new Map(), o = over && typeof over === 'object' ? over : {};
  for (const c of cues || []) if (c.spk && !m.has(c.spk)) {
    const x = o[c.spk];
    m.set(c.spk, SPK_COLORS[Number.isInteger(x) && x >= 0 && x < SPK_COLORS.length ? x : m.size % SPK_COLORS.length]);
  }
  return m.size >= 2 ? m : new Map();
}
/* הציר מתחת לנגן: חלון של span שנ׳ סביב הזמן; גל הקול, הכתוביות (צבע הדובר), חילופי השוטים, סמן הניגון.
   סבב 4 של השדרוג (C1 + H1 + B3): זום (צביטה / כפתורים, ZOOMS), גרירת קצה של הכתובית הנבחרת עם הצמדה לחיתוך
   ולגבול מילה, ופס המילים של המקור (לא בטוחה — כתום). נגיעה = קפיצה (על כתובית — בחירה; על מילה — לתחילתה);
   גרירה = גלילה בזמן. opts: { meta, cues(), sel(), video, seek(t), pick(k), colors(), edge(k, e, t), T } */
export const TL_SPAN = 16, TL_BEFORE = 5, ZOOMS = [4, 8, 16, 32, 64], TL_GRAB = 14, TL_SNAP = 9;
/* הצמדה בזמן הגרירה: חיתוך (התחלה — עליו, סוף — שני פריימים לפניו) קודם, אחר כך גבול מילה. px = שנ׳ לפיקסל */
export function tlSnap(t, edge, sh, wd, px) {
  let best = null;
  const near = (v, lim, kind) => { const d = Math.abs(v - t); if (d <= lim && (!best || d < best.d)) best = { t: v, d, kind }; };
  for (const x of sh || []) { if (x > t + 1) break; if (x > t - 1) near(edge === 's' ? x : r3(x - GAP_MIN), TL_SNAP * px, 'cut'); }
  if (!best && wd) { const [i0, i1] = wordsIn(wd, t - 1, t + 1); for (let i = i0; i < i1; i++) near(edge === 's' ? wd.s[i] : wd.e[i], (TL_SNAP - 3) * px, 'w'); }
  return best;
}
export function createTimeline(opts) {
  const T = opts.T || ((k) => k);
  const box = el('div', 'st-tlw');
  const cv = el('canvas', 'st-tl');
  cv.setAttribute('role', 'img'); cv.dataset.k = 'se-tl';
  const ctx = cv.getContext && cv.getContext('2d');
  const wd = opts.meta && opts.meta.wd;
  let raf = 0, drag = null, alive = true, span = TL_SPAN, magnet = null;
  const pts = new Map();
  const zl = el('div', 'st-tl-z');
  const zb = (lbl, d, k) => { const x = el('button', 'st-tl-zb', d < 0 ? '+' : '−'); x.type = 'button'; x.dataset.k = k; x.setAttribute('aria-label', lbl); x.addEventListener('click', (e) => { e.stopPropagation(); zoom(d); }); return x; };
  zl.append(zb(T('studioTlZoomIn'), -1, 'tl-zin'), zb(T('studioTlZoomOut'), 1, 'tl-zout'));
  box.append(cv, zl);
  const v = opts.video;
  const now = () => (v ? v.currentTime || 0 : 0);
  const geo = () => { const w = cv.clientWidth || 320, h = cv.clientHeight || 88; return { w, h, t0: now() - span * TL_BEFORE / TL_SPAN, k: w / span }; };
  function zoom(d) {
    const i = ZOOMS.indexOf(span), j = i < 0 ? ZOOMS.findIndex((z) => z >= span) : i + d;
    span = ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, j))];
    draw();
  }
  const WL = wd ? 20 : 0;   // פס המילים בתחתית
  function draw() {
    if (!ctx || !alive) return;
    const dpr = (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1, g = geo();
    if (cv.width !== Math.round(g.w * dpr) || cv.height !== Math.round(g.h * dpr)) { cv.width = Math.round(g.w * dpr); cv.height = Math.round(g.h * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, g.w, g.h);
    const xOf = (t) => (t - g.t0) * g.k, band = 16, bot = g.h - WL, mid = band + (bot - band) / 2, amp = (bot - band) / 2 - 2;
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
    // חילופי השוטים (זה שהקצה נצמד אליו — עבה יותר)
    const sh = (opts.meta && opts.meta.sh) || [];
    ctx.fillStyle = 'rgba(255,214,10,.85)';
    for (const t of sh) { if (t < g.t0) continue; if (t > g.t0 + span) break; ctx.fillRect(Math.round(xOf(t)) - (t === magnet ? 1 : 0), 0, t === magnet ? 3 : 1, bot); }
    // הכתוביות בפס העליון
    const cs = opts.cues(), sel = opts.sel(), col = opts.colors ? opts.colors() : null;
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i];
      if (c.e < g.t0) continue;
      if (c.s > g.t0 + span) break;
      const x0 = xOf(c.s), x1 = xOf(c.e);
      ctx.fillStyle = (col && col.get(c.spk)) || '#30D158';
      ctx.globalAlpha = i === sel ? 1 : 0.55;
      ctx.fillRect(x0 + 0.5, 3, Math.max(2, x1 - x0 - 1), band - 6);
      ctx.globalAlpha = 1;
      if (i === sel) {
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.strokeRect(x0 + 0.5, 2.5, Math.max(2, x1 - x0 - 1), band - 5);
        if (opts.edge) {   // C1: הידיות — הגבולות של הנבחרת לאורך הגל
          ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(x0, band, x1 - x0, bot - band);
          ctx.fillStyle = '#fff';
          for (const x of [x0, x1]) { ctx.fillRect(Math.round(x) - 1, band, 2, bot - band); ctx.fillRect(Math.round(x) - 3, mid - 9, 6, 18); }
        }
      }
    }
    // H1 + C2: המילים של המקור
    if (wd) {
      const [i0, i1] = wordsIn(wd, g.t0 - 1, g.t0 + span + 1);
      ctx.font = '11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let i = i0; i < i1; i++) {
        const x0 = xOf(wd.s[i]), x1 = xOf(wd.e[i]), lo = wd.c[i] >= 0 && wd.c[i] < UNSURE, ww = Math.max(2, x1 - x0 - 1);
        ctx.fillStyle = lo ? 'rgba(255,159,10,.30)' : 'rgba(235,235,245,.12)';
        ctx.fillRect(x0 + 0.5, bot + 3, ww, WL - 6);
        if (ww >= 18) {
          ctx.save(); ctx.beginPath(); ctx.rect(x0 + 1, bot, ww - 1, WL); ctx.clip();
          ctx.fillStyle = lo ? '#FF9F0A' : 'rgba(235,235,245,.8)'; ctx.fillText(wd.w[i], x0 + 0.5 + ww / 2, bot + WL / 2);
          ctx.restore();
        }
      }
    }
    // סמן הניגון
    ctx.fillStyle = '#fff';
    ctx.fillRect(Math.round(xOf(now())) - 1, 0, 2, g.h);
  }
  function loop() { draw(); if (alive && v && !v.paused) raf = requestAnimationFrame(loop); else raf = 0; }
  const kick = () => { if (!raf && typeof requestAnimationFrame === 'function') raf = requestAnimationFrame(loop); };
  if (v) for (const ev of ['play', 'seeked', 'timeupdate', 'loadedmetadata']) v.addEventListener(ev, kick);
  const pinchD = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; };
  cv.addEventListener('pointerdown', (e) => {
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { cv.setPointerCapture(e.pointerId); } catch (x) {}
    if (pts.size === 2) { drag = { k: 'pinch', d: pinchD(), span }; return; }
    if (pts.size > 2) return;
    const rc = cv.getBoundingClientRect(), g = geo(), px = e.clientX - rc.left, py = e.clientY - rc.top, k = opts.sel(), c = k >= 0 ? opts.cues()[k] : null;
    if (opts.edge && c && py < g.h - WL) {   // C1: גרירת קצה של הכתובית הנבחרת
      const ds = Math.abs(px - (c.s - g.t0) * g.k), de = Math.abs(px - (c.e - g.t0) * g.k);
      if (Math.min(ds, de) <= TL_GRAB) { drag = { k: 'edge', e: ds <= de ? 's' : 'e', i: k }; return; }
    }
    drag = { k: 'pan', x: e.clientX, t: now(), moved: false };
  });
  cv.addEventListener('pointermove', (e) => {
    if (pts.has(e.pointerId)) pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!drag) return;
    if (drag.k === 'pinch') { if (pts.size === 2) { span = Math.max(ZOOMS[0], Math.min(ZOOMS[ZOOMS.length - 1], drag.span * drag.d / pinchD())); draw(); } return; }
    const g = geo();
    if (drag.k === 'edge') {
      const rc = cv.getBoundingClientRect();
      let t = g.t0 + (e.clientX - rc.left) / g.k;
      const sn = tlSnap(t, drag.e, opts.meta && opts.meta.sh, wd, 1 / g.k);
      magnet = sn && sn.kind === 'cut' ? (drag.e === 's' ? sn.t : r3(sn.t + GAP_MIN)) : null;
      if (sn) t = sn.t;
      opts.edge(drag.i, drag.e, Math.max(0, t)); draw();
      return;
    }
    const dx = e.clientX - drag.x;
    if (Math.abs(dx) > 4) drag.moved = true;
    if (drag.moved) { opts.seek(Math.max(0, drag.t - dx / g.k)); kick(); }
  });
  cv.addEventListener('pointerup', (e) => {
    pts.delete(e.pointerId);
    const d = drag;
    if (d && d.k === 'pinch') { if (!pts.size) drag = null; return; }
    drag = null;
    if (d && d.k === 'edge') { magnet = null; draw(); return; }
    if (!d || d.moved) return;
    const rc = cv.getBoundingClientRect(), g = geo(), t = g.t0 + (e.clientX - rc.left) / g.k, y = e.clientY - rc.top;
    if (wd && y >= g.h - WL) {   // H1: נגיעה במילה — לתחילתה
      const [i0, i1] = wordsIn(wd, t - 1, t + 1);
      for (let i = i0; i < i1; i++) if (t >= wd.s[i] - 0.05 && t <= wd.e[i] + 0.05) { opts.seek(Math.max(0, wd.s[i] - 0.05)); kick(); return; }
    }
    const k = cueAt(opts.cues(), t);
    if (y < 18 && k >= 0 && opts.pick) opts.pick(k);
    opts.seek(Math.max(0, t)); kick();
  });
  cv.addEventListener('pointercancel', (e) => { pts.delete(e.pointerId); drag = null; magnet = null; });
  cv.addEventListener('wheel', (e) => { if (!e.ctrlKey) return; e.preventDefault(); zoom(e.deltaY > 0 ? 1 : -1); }, { passive: false });   // מחשב: Ctrl + גלגלת
  if (typeof ResizeObserver === 'function') { const ro = new ResizeObserver(() => draw()); ro.observe(cv); }
  return { el: box, cv, draw, span: () => span, zoom, destroy() { alive = false; if (raf) cancelAnimationFrame(raf); } };
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
/* 21/10/2026 (בקשת המשתמש): לכל כתובית גם המקור באנגלית של אותו קטע — קטן ואפור, משמאל לימין, עם תווית EN
   (אותה צורה כמו בבדיקה לפני הצריבה ב־studio.js; העיצוב ב־studio.css: .st-src) */
function srcLine(e, label, marks, onWord, wLabel, lg) {   // 10/11/2026: lg — המקור בשפה המדוברת באותו רגע (התווית = קוד השפה)
  const d = el('div', 'st-src'); d.dir = lg ? langDir(lg) || lineDir(String(e)) : 'ltr'; d.lang = lg || 'en';
  const tag = el('span', 'st-src-l', lg ? lg.toUpperCase() : 'EN'); tag.setAttribute('aria-label', label);
  const x = el('span', 'st-src-x'), txt = String(e);
  // C2 (סבב 4 של השדרוג): מילה שהזיהוי לא בטוח בה — קו מנוקד; נגיעה = השמעה של הרגע
  let at = 0;
  for (const [a, z, u] of marks || []) {
    if (a > at) x.append(txt.slice(at, a));
    const w = el('button', 'st-src-u', txt.slice(a, z)); w.type = 'button';
    w.setAttribute('aria-label', (wLabel || '') + ' · ' + u.c + '%');
    w.addEventListener('click', (ev) => { ev.stopPropagation(); if (onWord) onWord(u); });
    x.append(w); at = z;
  }
  if (at < txt.length) x.append(txt.slice(at));
  d.append(tag, x);
  return d;
}

export function createSubsEditor(opts) {
  const issMemo = new WeakMap();                       // מ9: הבדיקות לכל אובייקט כתובית — פעם אחת (בכל הקשה סופרים את כולן)
  const flags = opts.flags instanceof Map ? opts.flags : new Map();   // סבב 4: מזהה → { t: הטקסט המקורי, k: [סוגים] }
  const shots = Array.isArray(opts.shots) ? opts.shots : [];          // סבב 6: חילופי השוטים (הצמדה)
  const tmeta = opts.meta || null;                                     // סבב 4 של השדרוג: המילים והגל (נשימה, מילים לא בטוחות)
  const spkOver = opts.spkOver && typeof opts.spkOver === 'object' ? opts.spkOver : {};   // C3: הצבע שבחרת לכל שם
  const spkOrd = [];                                                   // סדר ההופעה — הצבעים לא קופצים כשכתובית נמחקת / שם משתנה
  let colors = new Map();                                              // סבב 6: צבע לכל דובר
  function recolor(cs) {
    for (const c of cs) if (c.spk && !spkOrd.includes(c.spk)) spkOrd.push(c.spk);
    const live = new Set(cs.map((c) => c.spk).filter(Boolean));
    colors = spkColors(spkOrd.filter((x) => live.has(x)).map((spk) => ({ spk })), spkOver);
  }
  recolor(opts.cues || []);
  const flagsOf = (c) => { const f = flags.get(c.i); return f && f.t === textOf(c) ? f.k : []; };
  const notes = opts.notes instanceof Map ? opts.notes : new Map();    // A9: מזהה → { t, n: ההערה }
  const noteOf = (c) => { const x = notes.get(c.i); return x && x.t === textOf(c) ? x.n : null; };
  const issOf = (c) => {
    let v = issMemo.get(c);
    if (!v) { const f = flagsOf(c), n = noteOf(c); v = cueIssues(c).concat(f, n && n.lv === 'l' && !f.length ? ['cf'] : []); issMemo.set(c, v); }
    return v;
  };
  const T = opts.T || ((k) => k);
  const iname = opts.issueName || ((k) => k);
  const hist = createHistory((opts.cues || []).map((c) => Object.assign({}, c)));
  let sel = -1, only = !!opts.only, act = -1, q = '', rep = '', searchOn = false, shiftOn = false, spkOn = false;
  const wrap = el('div', 'st-se');
  const bar = el('div', 'st-se-bar');
  const undoB = b('ic', T('studioSeUndo'), () => { if (hist.undo()) { sel = Math.min(sel, hist.cur.length - 1); changed(true); } }, 'se-undo', 'undo');
  const redoB = b('ic', T('studioSeRedo'), () => { if (hist.redo()) { sel = Math.min(sel, hist.cur.length - 1); changed(true); } }, 'se-redo', 'redo');
  const onlyB = b('chip', '', () => { only = !only; sel = -1; paintBar(); paintQc(); paintList(); }, 'se-only');
  const findB = b('ic', T('studioSeFind'), () => { searchOn = !searchOn; paintSearch(); if (searchOn) fq.focus(); }, 'se-find', 'search');
  const spkB = b('chip', T('studioSpkT'), () => { spkOn = !spkOn; paintSpk(); }, 'se-spk');   // C3: שם וצבע לכל דובר
  bar.append(undoB, redoB, onlyB, spkB, el('span', 'st-se-sp'), findB);
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
  const cfEl = confBar();                      // A9: ביטחון בתרגום — רק כשיש הערות מהעובד
  const qcEl = el('div', 'st-qc'); qcEl.hidden = true;   // B1: לוח הבדיקה — נפתח עם "רק בעיות"
  const spEl = el('div', 'st-spk'); spEl.hidden = true;  // C3: הדוברים
  wrap.append(bar, sp, spEl, ...(cfEl ? [cfEl] : []), qcEl, sugEl, listEl);
  const QC_NAME = { gap: () => T('studioIsGap'), cut: () => T('studioIsCut') };
  let qcAt = {};
  function paintQc() {
    qcEl.hidden = !only;
    if (!only) return;
    const m = qcScan(hist.cur, shots), ks = QC_KINDS.filter((k) => m[k].length);
    qcEl.replaceChildren();
    const hd = el('div', 'st-qc-h'); hd.append(el('b', null, T('studioQcT')), el('span', 'st-se-sp'));
    if (ks.length) hd.append(b('done', T('studioQcAll'), () => fixKinds(ks), 'qc-all'));
    qcEl.append(hd);
    if (!ks.length) { qcEl.append(el('div', 'st-qc-r st-qc-ok', T('studioQcNone'))); return; }
    for (const k of ks) {
      const r = el('div', 'st-qc-r');
      const nm = el('span', 'st-qc-k', QC_NAME[k] ? QC_NAME[k]() : iname(k));
      r.append(nm, el('bdi', 'st-qc-n', String(m[k].length)),
        b('', T('studioQcGo'), () => {   // הבאה מהסוג הזה אחרי הנבחרת (במעגל)
          const xs = qcScan(hist.cur, shots)[k];
          if (!xs.length) return;
          const from = qcAt[k] != null ? qcAt[k] : sel, nx = xs.find((i) => i > from) != null ? xs.find((i) => i > from) : xs[0];
          qcAt[k] = nx; choose(nx); opts.seek(hist.cur[nx].s);
        }, 'qc-go:' + k),
        b('', T('studioQcFix'), () => fixKinds([k]), 'qc-fix:' + k));
      qcEl.append(r);
    }
  }
  function fixKinds(ks) {
    const r = qcFix(hist.cur, ks, shots);
    if (r.n && apply(r.cues, null)) { if (opts.flash) opts.flash(T('studioQcDone', { n: r.n })); }
    else if (opts.flash) opts.flash(T('studioQcNoFix'));
  }
  function paintSpk() {
    spkB.hidden = colors.size < 2; spkB.classList.toggle('on', spkOn);
    spEl.hidden = !spkOn || colors.size < 2;
    if (spEl.hidden) return;
    spEl.replaceChildren();
    for (const [name, col] of colors) {
      const r = el('div', 'st-spk-r'); r.style.setProperty('--spk', col);
      const inp = el('input', 'st-se-in'); inp.type = 'text'; inp.value = name; inp.maxLength = SPK_LEN; inp.dir = 'auto';
      inp.setAttribute('aria-label', T('studioSpkName')); inp.dataset.k = 'spk-n';
      inp.addEventListener('change', () => {
        const nx = renameSpk(hist.cur, name, inp.value);
        if (!nx || nx === hist.cur) { inp.value = name; return; }
        const to = nx.find((c, j) => hist.cur[j].spk === name).spk;   // renameSpk — אותו סדר, רק השם
        const at = spkOrd.indexOf(name);
        if (at >= 0 && !spkOrd.includes(to)) spkOrd[at] = to;
        if (spkOver[name] != null && spkOver[to] == null && opts.onSpkColor) opts.onSpkColor(to, spkOver[name]);
        apply(nx, sel >= 0 ? sel : null);
      });
      const sw = el('div', 'st-spk-sw');
      SPK_COLORS.forEach((cc, ci) => {
        const x = b(cc === col ? 'on' : '', T('studioSpkCol'), () => {
          spkOver[name] = ci; if (opts.onSpkColor) opts.onSpkColor(name, ci);
          recolor(hist.cur); keep = new WeakMap(); paintSpk(); paintList(); if (opts.onChange) opts.onChange(hist.cur, hist.ver);
        }, 'spk-c:' + ci, null);
        x.textContent = ''; x.setAttribute('aria-label', T('studioSpkCol') + ' ' + (ci + 1)); x.setAttribute('aria-pressed', cc === col ? 'true' : 'false');
        x.style.setProperty('--c', cc); sw.append(x);
      });
      r.append(el('i', 'st-spk-dot'), inp, sw);
      spEl.append(r);
    }
  }
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
    if (structural) { const n0 = colors.size, k0 = [...colors].join(); recolor(hist.cur); if ([...colors].join() !== k0) keep = new WeakMap(); if (n0 !== colors.size || spkOn) paintSpk(); }
    paintBar();
    if (structural) { paintList(); paintSug(); } else paintRow(sel);
    if (structural) paintQc();   // B1
    if (opts.onChange) opts.onChange(hist.cur, hist.ver);
  }
  function paintBar() {
    undoB.disabled = !hist.canUndo(); redoB.disabled = !hist.canRedo();
    const n = hist.cur.reduce((a, c) => a + (issOf(c).length ? 1 : 0), 0);
    onlyB.textContent = n ? T('studioSeOnly', { n }) : T('studioSeNoIssues');
    onlyB.classList.toggle('on', only); onlyB.disabled = !n && !only && !shots.length;   // B1: גם בלי בעיות — הלוח (חיתוכים / צמודות)
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
  let keep = new WeakMap();
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
  function cueStep(k, n, back) { const j = k + (back ? -1 : 1); return j >= 0 && j < n ? j : -1; }
  function choose(k) {
    const prev = sel;
    sel = k;
    if (prev >= 0 && prev !== k) paintRow(prev);
    if (k >= 0) { if (rows.has(k)) paintRow(k); else paintList(); scrollTo(k); }
  }
  function confBar() {
    if (!notes.size && notes.js == null) return null;
    const all = opts.cues || [];
    let l = 0, m = 0;
    for (const c of all) { const n = noteOf(c); if (n) { if (n.lv === 'l') l++; else m++; } }
    const ok = Math.max(0, all.length - l - m), tot = Math.max(1, all.length);
    const box = el('div', 'st-se-cf');
    const h = el('div', 'st-se-cf-h'); h.append(el('b', null, T('studioCfTitle')));
    if (notes.js != null) h.append(el('bdi', 'st-se-cf-s', T('studioCfEst', { s: notes.js.toFixed(1) })));
    const barEl = el('div', 'st-se-cf-bar');
    for (const [k, n] of [['ok', ok], ['m', m], ['l', l]]) { if (!n) continue; const i = el('i', k); i.style.width = (100 * n / tot).toFixed(2) + '%'; barEl.append(i); }
    const lg = el('div', 'st-se-cf-lg');
    for (const [k, txt] of [['ok', T('studioCfOk', { n: ok })], ['m', T('studioCfMid', { n: m })], ['l', T('studioCfLow', { n: l })]]) {
      const x = el('span'); x.append(el('i', 'st-se-dot ' + k)); x.append(el('bdi', null, txt)); lg.append(x);
    }
    box.append(h, barEl, lg);
    return box;
  }
  const jgName = (c) => (c === 'mean' ? T('studioJgMean') : c === 'omit' ? T('studioJgOmit') : c === 'add' ? T('studioJgAdd')
    : c === 'gram' ? T('studioJgGram') : c === 'flu' ? T('studioJgFlu') : c === 'term' ? T('studioJgTerm') : '');
  function langName(lg) {
    try { return new Intl.DisplayNames([opts.lang || 'he'], { type: 'language' }).of(lg) || lg; } catch (e) { return lg; }
  }
  /* A9 · A6 · A10 · A12: הפירוט מתחת לכתובית — רק כשיש מה לומר (לשקול בלי פירוט = רק הנקודה ליד הזמן) */
  function noteBox(c, k) {
    const n = noteOf(c);
    if (!n) return null;
    const box = el('div', 'st-se-nts');
    const card = (cls, title, text) => { const d = el('div', 'st-se-nt ' + cls); d.append(el('b', null, title)); if (text) { const t = el('bdi', null, text); t.dir = 'auto'; d.append(t); } box.append(d); return d; };
    if (n.x) card('l', T('studioNtView'), n.x);
    else if (n.lv === 'l') { const jc = (n.r.find((r) => r.startsWith('jg:')) || '').slice(3); card('l', T('studioNtLow'), jgName(jc) ? T('studioNtJg', { c: jgName(jc) }) : ''); }
    if (n.p) {
      const d = card('p', T('studioNtPun'), '');
      const alts = el('div', 'st-se-alts');
      for (const a of n.p) {
        const x = b('st-se-alt', a, () => { const i = idxOf(c); const nx = i >= 0 ? setText(hist.cur, i, a) : null; if (nx && nx !== hist.cur) apply(nx, i); }, 'cue-alt:' + k);
        x.dir = 'rtl'; x.setAttribute('aria-label', T('studioNtPick', { t: a }));
        alts.append(x);
      }
      d.append(alts);
    }
    if (n.lg) card('g', T('studioNtLang', { l: langName(n.lg) }), n.o);
    return box.childNodes.length ? box : null;
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
  /* C2: המקור עם המילים הלא בטוחות; נגיעה במילה = הנגן מהרגע שלפניה */
  function src(c) {
    if (c.src) return srcLine(c.src, T('studioSrcOrig'), null, null, null, c.lg);   // קטע בשפה אחרת — המקור שלו, בלי סימוני Parakeet
    const uns = tmeta && tmeta.wd ? unsureIn(tmeta.wd, c) : [];
    return srcLine(c.en, T('studioSrcEn'), uns.length ? markUnsure(c.en, uns) : null,
      (u) => { opts.seek(Math.max(0, u.s - 0.4)); opts.play(); }, T('studioUnsure'));
  }
  function spkPick(k, c) {
    const box = el('div', 'st-se-spks');
    for (const [name, col] of colors) {
      const x = b(name === c.spk ? 'on' : '', name, () => apply(setSpk(hist.cur, k, name), k), 'cue-spk:' + k);
      x.style.setProperty('--spk', col); x.dir = 'auto'; box.append(x);
    }
    return box;
  }
  function mkRow(k) {
    const c = hist.cur[k], open = k === sel;
    const r = el('div', 'st-se-row' + (open ? ' open' : '') + (k === act ? ' act' : '') + (issOf(c).length ? ' bad' : '') + (colors.has(c.spk) ? ' spk' : ''));
    if (colors.has(c.spk)) r.style.setProperty('--spk', colors.get(c.spk));   // סבב 6: צבע הדובר
    r.setAttribute('role', 'listitem'); r.dataset.k = 'cue:' + k;
    const tm = b('st-se-tm', '', () => { opts.seek(c.s); opts.play(); }, 'cue-t:' + k);   // c — האובייקט, לא האינדקס (שורה שמורה זזה)
    tm.append(el('bdi', null, fmtTc(c.s)));
    const nt = noteOf(c);
    if (nt) tm.append(el('i', 'st-se-dot ' + nt.lv));        // A9: ביטחון — כתום לשקול, אדום לבדוק
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
      // 11/11/2026 (תצוגת מחשב, גל 4): ⌘↩ / Ctrl+Enter — השורה כבר שמורה (input) ועוברים לבאה וממשיכים להקליד; עם Shift — לקודמת
      ta.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' || !(e.metaKey || e.ctrlKey) || e.altKey || e.isComposing) return;
        const nk = cueStep(k, hist.cur.length, e.shiftKey);
        e.preventDefault();
        if (nk < 0) return;
        choose(nk); if (opts.seek && hist.cur[nk]) opts.seek(hist.cur[nk].s);
      });
      if (colors.has(c.spk)) body.append(spkPick(k, c));   // C3: הדובר של הכתובית
      body.append(ta);
      if (c.en || c.src) body.append(src(c));
      const nb = noteBox(c, k); if (nb) body.append(nb);
      body.append(el('div', 'st-se-mrow'));
      body.lastChild.append(mt, chips);
      body.append(actions(k, ta));
      setTimeout(() => { try { if (document.activeElement !== ta && opts.autofocus !== false) ta.focus({ preventScroll: true }); } catch (e) {} }, 0);
    } else {
      const tx = el('div', 'st-se-tx'); tx.dir = 'rtl';
      if (colors.has(c.spk)) { const w = el('bdi', 'st-se-who', c.spk); tx.append(w); }   // C3: שם הדובר
      for (const x of c.lines) tx.append(el('div', null, x));
      body.append(tx);
      if (c.en || c.src) body.append(src(c));
      const nb = noteBox(c, k); if (nb) body.append(nb);
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
    if (tmeta && breathIn(tmeta, c)) ar.append(b('', T('studioSeBreath'), () => { if (!apply(splitBreath(hist.cur, k, tmeta), k)) opts.flash && opts.flash(T('studioSeSplitNo')); }, 'cue-breath:' + k));   // B4
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
  paintBar(); paintSpk(); paintQc(); paintList(); paintSug();
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
    /* C1 (סבב 4 של השדרוג): גרירת קצה בציר — גרירה רצופה = צעד ביטול אחד (אותו תג) */
    edge(k, e, t) {
      const pv = hist.cur[k - 1], nx0 = hist.cur[k + 1];   // שני פריימים מהשכנה (כמו vt) — הגרירה לא יוצרת "צמודה"
      if (e === 'e' && nx0) t = Math.min(t, r3(nx0.s - GAP_MIN));
      if (e === 's' && pv) t = Math.max(t, r3(pv.e + GAP_MIN));
      const nx = setEdge(hist.cur, k, e, t);
      if (!nx || nx === hist.cur) return false;
      if (hist.push(nx, 'edge:' + k + e, Date.now())) { changed(false); return true; }
      return false;
    },
    /* סבב 4: "רק בעיות" מבחוץ (ההצעה "לבדיקה שלך" כשהעורך כבר טעון) */
    showOnly(on) { if (only === !!on) return; only = !!on; sel = -1; paintBar(); paintList(); },
    selected: () => sel,
    /* 21/10/2026: הכתובית הראשונה ברשימה כמו שהיא מוצגת עכשיו ("רק לבדיקה" / חיפוש) — הנגן נפתח עליה; ‎-1 = אין */
    firstShown() { const k = visible()[0]; return k == null ? -1 : k; },
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
export function editStats(diff, after, before) {
  const o = { n: diff.length, cd: 0, wd: 0, m: 0, wa: 0, ca: 0 };
  for (const k of ED_KINDS) o[k] = 0;
  for (const d of diff) { o[d.t] = (o[d.t] || 0) + 1; o.cd += d.cd || 0; o.wd += d.wd || 0; if (d.m) o.m++; }
  for (const c of after || []) { const t = edTxt(c); o.wa += edWords(t).length; o.ca += t.replace(/\s+/g, '').length; }
  if (before) Object.assign(o, suberCounts(before, after || []));   // מ׳5: SubER — גם השבירות והזמנים
  return o;
}

/* ---------- מאגר הלמידה מ׳5 (20/10/2026): SubER בשמירה מהעורך — טהור ----------
   כמה עריכות היו צריכות כדי להגיע מהגרסה הקודמת לחדשה, כולל שבירות שורה/כתובית וזמנים (apptek/SubER: TER על מילים
   ושבירות, מילים מתאימות רק כשהכתוביות שלהן חופפות בזמן). **העתק של translator/learnmetrics.py** (suber_counts, ter_edits —
   מ־lib_ter של sacrebleu); שינוי באחד = בשני — tests/learn-metrics.test.js משווה. sb = עריכות, sr = אסימוני הייחוס */
const TR_SHIFT_SIZE = 10, TR_SHIFT_DIST = 50, TR_BEAM = 100, TR_CACHE = 10000, TR_CANDS = 1000, TR_INF = 1e16;
class TrBeam {
  constructor(ref, match, allowed) {
    this.ref = ref; this.n = ref.length; this.match = match; this.allowed = allowed;
    this.init = Array.from({ length: this.n + 1 }, (_, i) => [i, 'i']);
    this.cache = new Map(); this.size = 0;
  }
  run(h) {
    let node = this.cache, start = 0;
    const dist = [this.init];
    for (const w of h) { const x = node.get(w); if (!x) break; start++; node = x[0]; dist.push(x[1]); }
    const nh = h.length, nCache = dist.length;
    for (let i = start; i < nh; i++) dist.push(Array.from({ length: this.n + 1 }, () => [TR_INF, 'x']));
    const ratio = nh ? this.n / nh : 1;
    const beam = TR_BEAM < ratio / 2 ? Math.ceil(ratio / 2 + TR_BEAM) : TR_BEAM;
    for (let i = start + 1; i <= nh; i++) {
      const diag = Math.floor(i * ratio), lo = Math.max(0, diag - beam), hi = i === nh ? this.n + 1 : Math.min(this.n + 1, diag + beam);
      const row = dist[i], prev = dist[i - 1];
      for (let j = lo; j < hi; j++) {
        if (j === 0) { row[j] = [prev[j][0] + 1, 'd']; continue; }
        let cs, op;
        if (this.match(h[i - 1], this.ref[j - 1])) { cs = 0; op = ' '; } else { cs = this.allowed(h[i - 1], this.ref[j - 1]) ? 1 : TR_INF; op = 's'; }
        for (const [c, o] of [[prev[j - 1][0] + cs, op], [prev[j][0] + 1, 'd'], [row[j - 1][0] + 1, 'i']]) if (row[j][0] > c) row[j] = [c, o];
      }
    }
    let trace = '', i = nh, j = this.n;
    while (i > 0 || j > 0) {
      const op = dist[i][j][1];
      trace = op + trace;
      if (op === 's' || op === ' ') { i--; j--; } else if (op === 'i') j--; else if (op === 'd') i--; else throw new Error('trace');
    }
    if (this.size < TR_CACHE) {                                  // המטמון לא משנה את התוצאה — רק את המהירות
      let nd = this.cache;
      for (let k = 0; k < start; k++) nd = nd.get(h[k])[0];
      for (let k = start; k < nh; k++) {
        let x = nd.get(h[k]);
        if (!x) { x = [new Map(), dist[k + 1]]; nd.set(h[k], x); this.size++; }
        nd = x[0];
      }
    }
    return [dist[nh][this.n][0], trace];
  }
}
function trAlign(trace) {
  let ph = -1, pr = -1;
  const he = [], re = [], al = new Map();
  for (const op of trace) {
    if (op === ' ' || op === 's') { ph++; pr++; al.set(pr, ph); he.push(op === 's' ? 1 : 0); re.push(op === 's' ? 1 : 0); }
    else if (op === 'i') { ph++; he.push(1); }
    else if (op === 'd') { pr++; al.set(pr, ph); re.push(1); }
  }
  return [al, re, he];
}
function trPerform(w, s, len, t) {
  if (t < s) return w.slice(0, t).concat(w.slice(s, s + len), w.slice(t, s), w.slice(s + len));
  if (t > s + len) return w.slice(0, s).concat(w.slice(s + len, t), w.slice(s, s + len), w.slice(t));
  return w.slice(0, s).concat(w.slice(s + len, len + t), w.slice(s, s + len), w.slice(len + t));
}
const trSum = (a, s, e) => { let x = 0; for (let k = s; k < e && k < a.length; k++) x += a[k]; return x; };
const trGt = (a, b) => { for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) return a[k] > b[k]; return false; };
function trShift(h, r, ed, checked, match) {
  const [pre, inv] = ed.run(h);
  const [al, refErr, hypErr] = trAlign(inv.replace(/[id]/g, (c) => (c === 'i' ? 'd' : 'i')));
  let best = null;
  const nh = h.length, nr = r.length;
  outer:
  for (let sh = 0; sh < nh; sh++) {
    for (let sr = 0; sr < nr; sr++) {
      if (Math.abs(sr - sh) > TR_SHIFT_DIST) continue;
      let ln = 0;
      while (match(h[sh + ln], r[sr + ln]) && ln < TR_SHIFT_SIZE) {
        ln++;
        if (trSum(hypErr, sh, sh + ln) !== 0 && trSum(refErr, sr, sr + ln) !== 0 && !(sh <= al.get(sr) && al.get(sr) < sh + ln)) {
          let prev = -1;
          for (let off = -1; off < ln; off++) {
            let idx;
            if (sr + off === -1) idx = 0;
            else if (al.has(sr + off)) idx = al.get(sr + off) + 1;
            else break;
            if (idx === prev) continue;
            prev = idx;
            const sw = trPerform(h, sh, ln, idx);
            const cand = [pre - ed.run(sw)[0], ln, -sh, -idx];
            checked++;
            if (!best || trGt(cand, best[0])) best = [cand, sw];
          }
          if (checked >= TR_CANDS) break outer;                  // כמו ב־Python: רק אחרי זוג שנבדק
        }
        if (nh === sh + ln || nr === sr + ln) break;
      }
    }
  }
  return best ? [best[0][0], best[1], checked] : [0, h, checked];
}
export function terEdits(h, r, match = (a, b) => a === b, allowed = () => true) {
  if (!r.length) return [h.length, 0];
  const ed = new TrBeam(r, match, allowed);
  let shifts = 0, cur = h, checked = 0;
  for (;;) {
    const [delta, nw, ck] = trShift(cur, r, ed, checked, match);
    checked = ck;
    if (checked >= TR_CANDS || delta <= 0) break;
    shifts++; cur = nw;
  }
  return [shifts + ed.run(cur)[0], r.length];
}
const PY_WS = /[\t\n\v\f\r \x1c-\x1f\x85\xa0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+/;   // = str.split() של Python
const pySplit = (s) => s.split(PY_WS).filter(Boolean);
const SB_PUNCT = /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/g;
function sbNorm(w) { const x = w.toLowerCase(), y = x.replace(SB_PUNCT, '').replace(/…/g, ''); return y || x; }
const SB_BR = new Set(['<eol>', '<eob>']);
function sbTimed(subs) {
  const out = [];
  for (const s of subs) {
    const ws = [];
    for (const line of s.lines || []) {
      ws.push(...pySplit(String(line).replace(/<\/?[^>]>/g, '')).map((w) => [w, '']));
      if (ws.length) ws[ws.length - 1][1] = '<eol>';
    }
    if (ws.length) ws[ws.length - 1][1] = '<eob>';
    for (const [w, br] of ws) { out.push({ w: sbNorm(w), s: s.s, e: s.e }); if (br) out.push({ w: br, s: s.s, e: s.e }); }
  }
  return out;
}
const sbOk = (a, b) => SB_BR.has(a.w) === SB_BR.has(b.w) && (a.s < b.e) === (b.s < a.e);
const sbMatch = (a, b) => a.w === b.w && sbOk(a, b);
function* sbParts(hyp, ref) {
  let hp = [], rp = [], i = 0, j = 0, last = -Infinity;
  while (i < hyp.length || j < ref.length) {
    if (i < hyp.length && (j === ref.length || hyp[i].s < ref[j].s)) {
      if ((hp.length || rp.length) && hyp[i].s >= last) { yield [hp, rp]; hp = []; rp = []; }
      hp.push(hyp[i]); last = Math.max(last, hyp[i].e); i++;
    } else {
      if ((hp.length || rp.length) && ref[j].s >= last) { yield [hp, rp]; hp = []; rp = []; }
      rp.push(ref[j]); last = Math.max(last, ref[j].e); j++;
    }
  }
  if (hp.length || rp.length) yield [hp, rp];
}
const sbSort = (a) => a.map((c, k) => [c, k]).sort((x, y) => x[0].s - y[0].s || x[1] - y[1]).map((x) => x[0]);
/* hyp / ref = [{s, e, lines}] → {sb, sr} */
export function suberCounts(hyp, ref) {
  let e = 0, n = 0;
  for (const [hp, rp] of sbParts(sbSort(hyp || []), sbSort(ref || []))) {
    const h = sbTimed(hp), r = sbTimed(rp);
    if (h.length === r.length && h.every((x, k) => x.w === r[k].w && x.s === r[k].s && x.e === r[k].e)) { n += r.length; continue; }
    const [a, b] = terEdits(h, r, sbMatch, sbOk);
    e += a; n += b;
  }
  return { sb: e, sr: n };
}
export function suber(hyp, ref) {
  const { sb, sr } = suberCounts(hyp, ref);
  return sr ? Math.round(100000 * sb / sr) / 1000 : (sb ? 100 : 0);
}

/* ---------- ייבוא קובץ כתוביות קיים (22/10/2026) — port זהה ל־translator/subsimport.py ----------
   הטלפון מציג "מה מצאנו בקובץ" (קידוד, פרסומות, SDH, שמות דוברים, הטיה ומיקום) עם אותם מספרים שהעובד יראה.
   שינוי כאן = גם שם (tests/subs-import.test.js מריץ את שניהם על אותם קבצים ומשווה). */
function imDecode(raw) {
  const b = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
  const dec = (enc, x, fatal) => new TextDecoder(enc, fatal ? { fatal: true } : undefined).decode(x);
  if (b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) return { text: dec('utf-8', b.subarray(3)), enc: 'utf-8', fixed: false };
  if (b[0] === 0xff && b[1] === 0xfe) return { text: dec('utf-16le', b.subarray(2)), enc: 'utf-16', fixed: true };
  if (b[0] === 0xfe && b[1] === 0xff) return { text: dec('utf-16be', b.subarray(2)), enc: 'utf-16', fixed: true };
  const head = b.subarray(0, 400);
  if (head.length >= 4) {
    let odd = 0, even = 0;
    for (let i = 1; i < head.length; i += 2) if (head[i] === 0) odd++;
    for (let i = 0; i < head.length; i += 2) if (head[i] === 0) even++;
    const half = Math.floor(head.length / 4);
    if (odd > half) return { text: dec('utf-16le', b), enc: 'utf-16', fixed: true };
    if (even > half) return { text: dec('utf-16be', b), enc: 'utf-16', fixed: true };
  }
  try { return { text: dec('utf-8', b, true), enc: 'utf-8', fixed: false }; }
  catch (e) { return { text: dec('windows-1252', b), enc: 'windows-1252', fixed: true }; }
}
const IM_SRT_T = /(\d{1,3}):(\d{1,2}):(\d{1,2})[,.](\d{1,3})\s*-->\s*(\d{1,3}):(\d{1,2}):(\d{1,2})[,.](\d{1,3})/;
const IM_VTS = '(?:(\\d{1,3}):)?(\\d{1,2}):(\\d{1,2})\\.(\\d{1,3})';
const IM_VTT_T = new RegExp(IM_VTS + '\\s*-->\\s*' + IM_VTS + '(.*)$');
const IM_ASS_T = /^(\d{1,2}):(\d{1,2}):(\d{1,2})[.:](\d{1,3})$/;
const IM_TOP = /\\an([789])|\\a([5679]|1[01])(?![0-9])/;
const imMs = (h, m, s, f) => ((Number(h || 0) * 60 + Number(m)) * 60 + Number(s)) * 1000 + Number((f + '00').slice(0, 3));
const pyStrip = (s) => s.trim();
const lstripBom = (t) => (t.charAt(0) === '\ufeff' ? t.slice(1) : t);
export function subsDetect(text) {
  const t = text.replace(/^[\ufeff \t\r\n]+/, '');
  if (t.startsWith('WEBVTT')) return 'vtt';
  if (/^\s*\[(Script Info|Events|V4\+? Styles)\]/im.test(t) || /^Dialogue:/m.test(t)) return 'ass';
  if (IM_SRT_T.test(t)) return 'srt';
  return '';
}
function imBlocks(text) {
  const out = []; let cur = [];
  for (const ln of text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')) {
    if (pyStrip(ln) === '') { if (cur.length) { out.push(cur); cur = []; } }
    else cur.push(ln.replace(/\s+$/, ''));
  }
  if (cur.length) out.push(cur);
  return out;
}
function imSrt(text) {
  const cues = [];
  for (const b of imBlocks(lstripBom(text))) {
    const i = b.slice(0, 3).findIndex((ln) => IM_SRT_T.test(ln));
    if (i < 0) continue;
    const g = IM_SRT_T.exec(b[i]).slice(1);
    let body = b.slice(i + 1);
    const cut = body.findIndex((ln) => IM_SRT_T.test(ln));
    let rest = [];
    if (cut >= 0) {
      const num = cut > 0 && /^\d+$/.test(pyStrip(body[cut - 1]));
      rest = body.slice(num ? cut - 1 : cut);
      body = body.slice(0, num ? cut - 1 : cut);
    }
    cues.push({ s: imMs(...g.slice(0, 4)), e: imMs(...g.slice(4)), raw: body });
    if (rest.length) cues.push(...imSrt(rest.join('\n')));
  }
  return cues;
}
function imVtt(text) {
  const cues = [];
  for (const b of imBlocks(lstripBom(text))) {
    if (/^(WEBVTT|NOTE|STYLE|REGION)/.test(b[0]) && !b.slice(0, 2).some((x) => x.includes('-->'))) continue;
    const i = b.slice(0, 3).findIndex((ln) => ln.includes('-->'));
    if (i < 0) continue;
    const m = IM_VTT_T.exec(b[i]);
    if (!m) continue;
    const g = m.slice(1);
    const sett = g[8] || '';
    let top = false;
    const lm = /\bline:(-?\d+(?:\.\d+)?)(%?)/.exec(sett);
    if (lm) { const v = parseFloat(lm[1]); top = lm[2] ? v < 50 : (v >= 0 && v <= 3); }
    let raw = b.slice(i + 1);
    if (top && raw.length) raw = ['{\\an8}' + raw[0]].concat(raw.slice(1));
    cues.push({ s: imMs(...g.slice(0, 4)), e: imMs(...g.slice(4, 8)), raw });
  }
  return cues;
}
function splitN(s, sep, max) {                       // str.split(sep, max) של Python — השארית נשמרת
  const out = []; let i = 0;
  while (out.length < max) { const j = s.indexOf(sep, i); if (j < 0) break; out.push(s.slice(i, j)); i = j + sep.length; }
  out.push(s.slice(i));
  return out;
}
function imAss(text) {
  const cues = []; let fmt = null, inEv = false;
  for (const ln of lstripBom(text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')).split('\n')) {
    const s = pyStrip(ln);
    if (s.startsWith('[')) { inEv = s.toLowerCase() === '[events]'; continue; }
    if (!inEv) continue;
    if (s.toLowerCase().startsWith('format:')) { fmt = splitN(s, ':', 1)[1].split(',').map((x) => pyStrip(x).toLowerCase()); continue; }
    if (!s.toLowerCase().startsWith('dialogue:')) continue;
    const f = fmt || ['layer', 'start', 'end', 'style', 'name', 'marginl', 'marginr', 'marginv', 'effect', 'text'];
    const parts = splitN(splitN(s, ':', 1)[1], ',', f.length - 1);
    if (parts.length < f.length) continue;
    const row = {}; f.forEach((k, j) => { row[k] = k !== 'text' ? pyStrip(parts[j]) : parts[j]; });
    const a = IM_ASS_T.exec(row.start || ''), z = IM_ASS_T.exec(row.end || '');
    if (!a || !z) continue;
    let t = row.text || '';
    if (/\\p[1-9]/.test(t)) continue;
    t = t.split('\\N').join('\n').split('\\n').join('\n').split('\\h').join(' ');
    cues.push({ s: imMs(...a.slice(1)), e: imMs(...z.slice(1)), raw: t.split('\n'), ass: 1, name: pyStrip(row.name || '') });
  }
  return cues;
}
// תגיות וסוגריים מסולסלים — עד שאין מה להסיר (הסרה אחת של "<<i>script>" משאירה "<script>"), ו־"<" שנשאר יוצא (CodeQL)
function imStrip(t) { let p; do { p = t; t = imDrop(imDrop(t, 0), 1); } while (t !== p); return t.replace(/</g, ''); }
// סריקה במקום replace עם ביטוי (זהה ל־_HTML / _BRACE בעובד): k=0 — </?אות…> עד ה־">" הראשון; k=1 — {…} עד ה־"}" הראשון
function imDrop(t, k) {
  let o = '', i = 0;
  while (i < t.length) {
    const c = t[i];
    let end = -1;
    if (k === 0 && c === '<') {
      const a = t[i + 1] === '/' ? i + 2 : i + 1;
      if (/[A-Za-z]/.test(t[a] || '')) end = t.indexOf('>', a);
    } else if (k === 1 && c === '{') end = t.indexOf('}', i + 1);
    if (end >= 0) { i = end + 1; continue; }
    o += c; i++;
  }
  return o;
}
const IM_VTT_TAG = /<\d{1,2}:\d{2}(?::\d{2})?\.\d{1,3}>/g;
const IM_LETTER = /[A-Za-z\u00C0-\u024F\u0590-\u05FF\u0600-\u06FF\u0400-\u04FF]/;
function imItalic(line, it) {
  const out = []; let nIt = 0, nAll = 0, i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (ch === '<') {
      const j = line.indexOf('>', i);
      if (j > 0) { const tag = pyStrip(line.slice(i + 1, j)).toLowerCase(); if (tag === 'i') it = true; else if (tag === '/i') it = false; i = j + 1; continue; }
    }
    if (ch === '{') {
      const j = line.indexOf('}', i);
      if (j > 0) { const tag = line.slice(i, j + 1); if (/\\i1/.test(tag)) it = true; else if (/\\i0|\\r/.test(tag)) it = false; i = j + 1; continue; }
    }
    out.push(ch);
    if (IM_LETTER.test(ch)) { nAll++; if (it) nIt++; }
    i++;
  }
  return [out.join(''), nIt, nAll, it];
}
const imWs = (s) => pyStrip(s.replace(/[ \t\u00a0]+/g, ' '));
const IM_AD = /(subtitles?|subs|captions?|captioning|synced?|sync|resync(?:ed)?|corrected|ripped|encoded|transcript|timing)\s*(?:&\s*\w+\s*)?(by|:)|opensubtitles|addic7ed|subscene|podnapisi|yts\.|yify|\bwww\.|https?:\/\/|[a-z0-9-]+\.(?:com|org|net|tv|io)\b|support us|become (?:a )?vip|advertise your|osdb\.link/i;
// 02/11/2026: גם "A & B:" (עד 3 שמות, עד 3 מילים לכל שם), ותווית לבד בשורה — רק כשיש עוד שורה. מראה: _LABEL ב־subsimport.py
const IM_LABEL = /^([-\u2013\u2014]\s*)?([A-Z][A-Z0-9'\u2019.\- ]{0,24}?(?:\s*(?:&|,|AND)\s*[A-Z][A-Z0-9'\u2019.\- ]{0,24}?){0,2})(\s*\([^)]{0,30}\))?\s*:(?:\s+(?=\S)|\s*$)/;
const IM_LABEL_SEP = /\s*(?:&|,|\bAND\b)\s*/;
const IM_MUSIC = /^[\s\u266a\u266b#*]+$/;
const isUpperCh = (c) => c === c.toUpperCase() && c !== c.toLowerCase();
const isAlphaCh = (c) => /\p{L}/u.test(c);
function imSpans(lines, op, cl) {
  const text = lines.join('\n'); const out = []; let n = 0, i = 0;
  const nl = (a, b) => { let k = 0; for (let x = a; x < b; x++) if (text[x] === '\n') k++; return k; };
  while (i < text.length) {
    const j = text.indexOf(op, i);
    if (j < 0) { out.push(text.slice(i)); break; }
    out.push(text.slice(i, j));
    const k = text.indexOf(cl, j + 1);
    if (k < 0 || nl(j, k) > 2) { out.push(text.slice(j)); break; }
    n++;
    out.push('\n'.repeat(nl(j, k)));
    i = k + 1;
  }
  return [out.join('').split('\n'), n];
}
function imLabel(line, multi = true) {
  const m = IM_LABEL.exec(line);
  if (!m) return [line, ''];
  const label = pyStrip(m[2]), rest = line.slice(m[0].length);
  const names = label.split(IM_LABEL_SEP).map((x) => x.split(/\s+/).filter(Boolean));
  if (names.some((x) => !x.length || x.length > 3) || !/[A-Z]/.test(label)) return [line, ''];
  if (!pyStrip(rest) && !multi) return [line, ''];
  const letters = [...rest].filter(isAlphaCh);
  if (letters.length && letters.every(isUpperCh)) return [line, ''];
  return [(m[1] || '') + rest, label];
}
const imTitle = (name) => name.split(/\s+/).filter(Boolean).map((w) => (w === w.toUpperCase() && w !== w.toLowerCase() ? w.slice(0, 1).toUpperCase() + w.slice(1).toLowerCase() : w)).join(' ');
const IM_DASH = /^[-\u2013\u2014]\s*/;
export function importSubs(raw, opt) {
  const sdh = !opt || opt.sdh !== false;
  const d = imDecode(raw);
  const fmt = subsDetect(d.text);
  let cues = fmt === 'vtt' ? imVtt(d.text) : fmt === 'ass' ? imAss(d.text) : fmt === 'srt' ? imSrt(d.text) : [];
  const st = { fmt, enc: d.enc, fixed: d.fixed, n_in: cues.length, ads: 0, empty: 0, dups: 0, overlaps: 0, sorted: 0, it: 0, pit: 0, top: 0, sdh: 0, sdh_cues: 0, labels: 0, dual: 0 };
  const names = new Map();
  const order = cues.map((_, k) => k).sort((a, b) => cues[a].s - cues[b].s || a - b);
  if (order.some((x, k) => x !== k)) st.sorted = 1;
  cues = order.map((k) => cues[k]);
  const out = [];
  for (const c of cues) {
    let top = false, nIt = 0, nAll = 0, itx = false;
    let lines = [];
    for (let ln of c.raw) {
      if (IM_TOP.test(ln)) top = true;
      ln = ln.replace(IM_VTT_TAG, '').replace(/<v(?:\.[^ >]*)?\s+([^>]*)>/g, '');
      const r = imItalic(ln, itx); nIt += r[1]; nAll += r[2]; itx = r[3];
      lines.push(imWs(imStrip(r[0])));
    }
    lines = lines.filter(Boolean);
    const whole = lines.join(' ');
    if (!lines.length) { st.empty++; continue; }
    if (IM_AD.test(whole) && whole.length <= 120) { st.ads++; continue; }
    if (c.e <= c.s) { st.empty++; continue; }
    let spk = c.ass ? (c.name || '') : '';
    const spks = [];
    if (sdh) {
      const before = lines.slice();
      let n1, n2;
      [lines, n1] = imSpans(lines, '[', ']');
      [lines, n2] = imSpans(lines, '(', ')');
      const kept = [];
      for (let ln of lines) {
        ln = imWs(ln);
        if (ln && IM_MUSIC.test(ln)) continue;
        let [ln2, label] = imLabel(ln, lines.length > 1);
        let nm = '';
        if (label) { st.labels++; nm = imTitle(label); names.set(nm, (names.get(nm) || 0) + 1); }
        ln2 = imWs(ln2);
        if (ln2 && /[A-Za-z0-9\u00C0-\u024F]/.test(ln2)) { kept.push(ln2); spks.push(nm); }
      }
      const removed = n1 + n2;
      const same = kept.length === before.length && kept.every((x, k) => x === imWs(before[k]));
      if (removed || !same) { st.sdh += removed; st.sdh_cues++; }
      lines = kept;
      if (spks.length && spks[0] && !spk) spk = spks[0];
      if (!lines.length) continue;
      if (lines.length === 1 && IM_DASH.test(lines[0])) lines[0] = lines[0].replace(IM_DASH, '');
    }
    const it = nAll > 0 && nIt * 10 >= nAll * 9;
    const dash = lines.length === 2 && lines.every((x) => /^[-\u2013\u2014]\s*\S/.test(x));
    const cur = { s: c.s, e: c.e, lines, it, pit: !!nIt && !it, top, spk, spk2: dash && spks.length > 1 ? spks[1] : '', dash };
    const prev = out.length ? out[out.length - 1] : null;
    if (prev && prev.lines.length === lines.length && prev.lines.every((x, k) => x === lines[k]) && cur.s < prev.e) {
      prev.e = Math.max(prev.e, cur.e); st.dups++; continue;
    }
    if (prev && prev.e > cur.s) {
      prev.e = cur.s; st.overlaps++;
      if (prev.e <= prev.s) { out.pop(); st.empty++; }
    }
    out.push(cur);
  }
  for (const c of out) { st.it += c.it ? 1 : 0; st.pit += c.pit ? 1 : 0; delete c.pit; st.top += c.top ? 1 : 0; st.dual += c.dash ? 1 : 0; }
  st.n = out.length;
  st.dur = out.length ? out[out.length - 1].e : 0;
  st.names = names.size;
  const nameList = [...names.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return { fmt, enc: d.enc, fixed: d.fixed, cues: out, stats: st, names: nameList };
}

/* ---------- A1 + A5 (1/11/2026): כרטיס הסדרה ותיקון לאחור בין פרקים ----------
   seriesOfName — אותו מפתח סדרה כמו בשרתון (lib/studio.js seriesOf; tests/studio-series-card משווה), כדי למצוא בטלפון את
   הפרקים הקודמים של הסדרה. smChanges — מה השתנה בכרטיס (כתיב → אפשר להחליף בכתוביות; מגדר → רק להציג איפה הדמות מופיעה).
   heReplace — החלפת כתיב בעברית גם אחרי אותיות השימוש (ו/ה/ב/ל/מ/ש/כ), רק מילה שלמה. הכל בטלפון, מול ה־Drive שלך */
const SER_RE_C = /^(.*?)[\s\-–_.([]*(?:s(\d{1,2})[\s._-]*e(\d{1,3})|(\d{1,2})x(\d{2,3}))(?![\p{L}\p{N}])/iu;
export function seriesOfName(name) {
  const base = String(name || '').replace(/\.[A-Za-z0-9]{2,4}$/, '').replace(/[._]+/g, ' ');
  const m = base.match(SER_RE_C);
  if (!m) return null;
  const n = m[1].replace(/[\s\-–]*(?:season|עונה)\s*\d{1,2}[\s\-–]*$/iu, ' ').replace(/\(\s*(19|20)\d\d\s*\)|\b(19|20)\d\d\s*$/g, ' ').replace(/[\s\-–[(]+$/, '').replace(/\s+/g, ' ').trim();
  const k = n.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  return k.length >= 2 ? { k: k.slice(0, 60), s: +(m[2] || m[4]) || 0, e: +(m[3] || m[5]) || 0 } : null;
}
/* לפני → אחרי (שורות הכרטיס): rep = [[ישן, חדש]] להחלפה, gen = [[שם, מגדר ישן, חדש]] */
export function smChanges(before, after) {
  const rep = [], gen = [];
  const b = before || {}, a = after || {};
  const gl0 = new Map((b.gl || []).map((r) => [r[0].toLowerCase(), r[1]]));
  for (const r of a.gl || []) { const o = gl0.get(r[0].toLowerCase()); if (o && o !== r[1]) rep.push([o, r[1]]); }
  const ch0 = new Map((b.ch || []).map((r) => [r[0], r[1]])), ch1 = new Map((a.ch || []).map((r) => [r[0], r[1]]));
  const gone = (b.ch || []).filter((r) => !ch1.has(r[0])), fresh = (a.ch || []).filter((r) => !ch0.has(r[0]));
  if (gone.length === 1 && fresh.length === 1) rep.push([gone[0][0], fresh[0][0]]);   // שינוי שם של דמות = מחיקה + הוספה בעריכה אחת
  for (const r of a.ch || []) if (ch0.has(r[0]) && ch0.get(r[0]) !== r[1]) gen.push([r[0], ch0.get(r[0]), r[1]]);
  return { rep: rep.filter((x) => x[0].trim().length >= 2 && x[0] !== x[1]), gen };
}
const heWord = (old) => new RegExp('(^|[^\\p{L}\\p{N}])([והבלמשכ]{0,3})' + reEsc(old) + '(?![\\p{L}\\p{N}])', 'gu');
/* מחרוזת אחת: [טקסט, כמה הוחלפו] */
export function heReplace(text, old, nu) {
  let n = 0;
  const out = String(text).replace(heWord(old), (m, pre, use) => { n++; return pre + use + nu; });
  return [out, n];
}
/* הכתוביות: כמה כתוביות מושפעות (hit) ומה התוצאה (cues חדשות) — בלי לגעת במקור */
export function cuesReplace(cues, rep) {
  let hit = 0;
  const out = (cues || []).map((c) => {
    let any = false;
    const lines = c.lines.map((l) => { let t = l; for (const [o, nu] of rep) { const [x, n] = heReplace(t, o, nu); if (n) { any = true; t = x; } } return t; });
    if (any) hit++;
    return any ? Object.assign({}, c, { lines }) : c;
  });
  return { hit, cues: out };
}
/* בכמה כתוביות מופיע השם (למגדר — רק מראים) */
export const cuesWith = (cues, name) => (cues || []).filter((c) => c.lines.some((l) => heWord(name).test(l))).length;
