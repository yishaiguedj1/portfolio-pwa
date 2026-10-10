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
  const issOf = (c) => { let v = issMemo.get(c); if (!v) { v = cueIssues(c); issMemo.set(c, v); } return v; };
  const T = opts.T || ((k) => k);
  const iname = opts.issueName || ((k) => k);
  const hist = createHistory((opts.cues || []).map((c) => Object.assign({}, c)));
  let sel = -1, only = false, act = -1, q = '', rep = '', searchOn = false, shiftOn = false;
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
    sugEl.hidden = !ss.length;
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
        if (apply(g.cues, null)) { if (opts.flash) opts.flash(T('studioSgFixed')); }
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
    const r = el('div', 'st-se-row' + (open ? ' open' : '') + (k === act ? ' act' : '') + (issOf(c).length ? ' bad' : ''));
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
    selected: () => sel,
    /* מ7: שינויים מגיליון ה־AI — צעד ביטול אחד */
    applyCues(next) { return apply(next, null); },
    destroy() { rows.clear(); },
  };
}
