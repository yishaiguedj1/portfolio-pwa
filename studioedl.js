/* מ4–מ5 (10/10/2026): עורך הווידאו של סטודיו התרגום — חיתוך ויחס תמונה, לפני התרגום (מתרגמים רק את מה שנשאר — זול יותר)
   ואחרי התרגום (הפקה מחדש: הכתוביות זזות עם החיתוך). רשימת עריכות (EDL) אחת:
     { k: [[a, b], …]  — הקטעים שנשארים, בשניות בזמן המקור (ריק = הכל),  ar: 'src' | '9:16' | '1:1' | '4:5',  x: 0–1 — מרכז החיתוך }
   **אותה לוגיקה בדיוק ב־translator/edl.py ובשרתון (ibkr-proxy/lib/studio.js normEdl)** — tests/studio-edl משווה.
   הלוגיקה טהורה (נבדקת ב־node); ה־DOM רק ב־createEdlEditor. */

export const SEG_MIN = 0.5;          // קטע קצר מזה — לא נשמר
export const SEG_MAX = 60;           // קטעים בעריכה אחת
export const JOIN_GAP = 0.05;        // קטעים צמודים (פחות מזה) מתאחדים
export const ARS = ['src', '9:16', '1:1', '4:5'];
export const MAX_T = 24 * 3600;
const r3 = (x) => Math.round(x * 1000) / 1000;
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : NaN);

/* עריכה תקינה, או null כשאין מה לעשות (הכל נשאר, יחס המקור) */
export function normEdl(e, dur) {
  if (!e || typeof e !== 'object') return null;
  const lim = num(dur) > 0 ? Math.min(num(dur), MAX_T) : MAX_T;
  const segs = [];
  for (const p of (Array.isArray(e.k) ? e.k : []).slice(0, SEG_MAX * 4)) {
    if (!Array.isArray(p) || p.length !== 2) continue;
    const a = Math.max(0, num(p[0])), b = Math.min(lim, num(p[1]));
    if (!(a >= 0) || !(b - a >= SEG_MIN)) continue;
    segs.push([r3(a), r3(b)]);
  }
  segs.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  const k = [];
  for (const s of segs) {
    const last = k[k.length - 1];
    if (last && s[0] <= last[1] + JOIN_GAP) last[1] = Math.max(last[1], s[1]);
    else k.push(s.slice());
  }
  const ar = ARS.includes(e.ar) ? e.ar : 'src';
  const x = num(e.x) >= 0 && num(e.x) <= 1 ? Math.round(e.x * 100) / 100 : 0.5;
  const whole = !k.length || (k.length === 1 && k[0][0] <= JOIN_GAP && num(dur) > 0 && k[0][1] >= num(dur) - JOIN_GAP);
  if (whole && ar === 'src') return null;
  if (k.length > SEG_MAX) return null;                     // יותר מדי — לא מנחשים מה לשמור
  return { k: whole ? [] : k, ar, x: ar === 'src' ? 0.5 : x };
}
/* אורך אחרי החיתוך */
export function edlDur(e, dur) {
  if (!e || !e.k.length) return Math.max(0, num(dur) || 0);
  return r3(e.k.reduce((t, [a, b]) => t + (b - a), 0));
}
/* זמן במקור → זמן אחרי החיתוך (null = בחלק שנחתך) */
export function mapTime(e, t) {
  if (!e || !e.k.length) return t;
  let off = 0;
  for (const [a, b] of e.k) {
    if (t < a) return null;
    if (t <= b) return r3(off + t - a);
    off += b - a;
  }
  return null;
}
/* זמן אחרי החיתוך → זמן במקור */
export function unmapTime(e, t) {
  if (!e || !e.k.length) return t;
  let off = 0;
  for (const [a, b] of e.k) {
    if (t <= off + (b - a)) return r3(a + Math.max(0, t - off));
    off += b - a;
  }
  return e.k.length ? e.k[e.k.length - 1][1] : t;
}
/* כתוביות ({s, e, …} בשניות) → אחרי החיתוך: כתובית שנחתכה באמצע — החלק הארוך שנשאר; שנחתכה כולה — יוצאת */
export function mapCues(e, cues, minDur = 0.2) {
  if (!e || !e.k.length) return cues.slice();
  const out = [];
  for (const c of cues) {
    let best = null, off = 0;
    for (const [a, b] of e.k) {
      const s = Math.max(c.s, a), z = Math.min(c.e, b);
      if (z - s > (best ? best[1] - best[0] : 0)) best = [r3(off + s - a), r3(off + z - a)];
      off += b - a;
    }
    if (best && best[1] - best[0] >= minDur) out.push(Object.assign({}, c, { s: best[0], e: best[1] }));
  }
  return out;
}
/* שתי עריכות ברצף: e0 על המקור (לפני התרגום), e1 על התוצאה שלה (אחרי) → עריכה אחת על המקור */
export function composeEdl(e0, e1) {
  if (!e0) return e1 ? { k: e1.k.slice(), ar: e1.ar, x: e1.x } : null;
  if (!e1) return { k: e0.k.slice(), ar: e0.ar, x: e0.x };
  let k;
  if (!e1.k.length) k = e0.k.slice();
  else if (!e0.k.length) k = e1.k.slice();
  else {
    k = [];
    for (const [a1, b1] of e1.k) {
      let off = 0;
      for (const [a0, b0] of e0.k) {
        const len = b0 - a0, s = Math.max(a1, off), z = Math.min(b1, off + len);
        if (z - s > 1e-6) k.push([r3(a0 + s - off), r3(a0 + z - off)]);
        off += len;
      }
    }
  }
  const ar = e1.ar !== 'src' ? e1.ar : e0.ar;
  return { k, ar, x: e1.ar !== 'src' ? e1.x : e0.x };
}

/* ---------- פעולות עריכה (על רשימת קטעים מלאה: [[0, dur]] בהתחלה) ---------- */
export const segsOf = (e, dur) => (e && e.k.length ? e.k.map((p) => p.slice()) : [[0, r3(dur)]]);
export const segAt = (segs, t) => segs.findIndex(([a, b]) => t >= a && t < b);
export function splitAt(segs, t) {
  const i = segAt(segs, t);
  if (i < 0) return null;
  const [a, b] = segs[i];
  if (t - a < SEG_MIN || b - t < SEG_MIN) return null;
  const out = segs.slice(); out.splice(i, 1, [a, r3(t)], [r3(t), b]);
  return out;
}
export function removeAt(segs, t) {
  const i = segAt(segs, t);
  if (i < 0 || segs.length < 2) return null;              // הקטע האחרון — לא מוחקים הכל
  const out = segs.slice(); out.splice(i, 1);
  return out;
}
/* "מתחיל כאן" / "נגמר כאן" — הקטע שבו נמצאים */
export function trimAt(segs, t, edge) {
  const i = segAt(segs, t);
  if (i < 0) return null;
  const [a, b] = segs[i];
  const out = segs.slice();
  if (edge === 'a') { if (b - t < SEG_MIN) return null; out[i] = [r3(t), b]; }
  else { if (t - a < SEG_MIN) return null; out[i] = [a, r3(t)]; }
  return out;
}
/* הקטעים חוזרים לעריכה (אחרי חיתוך קטע = מחיקה, קטעים צמודים נשארים נפרדים בעורך אבל מתאחדים ב־normEdl) */
export const toEdl = (segs, ar, x, dur) => normEdl({ k: segs, ar, x }, dur);
/* מה החיתוך במלבן (WxH המקור, יחס יעד) — אותו חישוב כמו ב־edl.py (crop של ffmpeg) */
export function cropBox(W, H, ar, x) {
  if (ar === 'src' || !(W > 0 && H > 0)) return null;
  const [rw, rh] = ar.split(':').map(Number), r = rw / rh;
  const even = (v) => Math.max(2, Math.floor(v / 2) * 2);
  if (W / H > r) { const w = even(H * r), h = even(H); return { w, h, x: even((W - w) * x), y: 0 }; }
  const w = even(W), h = even(W / r);
  return { w, h, x: 0, y: even((H - h) / 2) };
}

/* ---------------- הרכיב (DOM) ---------------- */
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function b(cls, label, fn, k) {
  const x = el('button', 'st-se-b ' + cls, label); x.type = 'button';
  if (k) x.dataset.k = k;
  x.addEventListener('click', (e) => { e.stopPropagation(); fn(e); });
  return x;
}
const fmtM = (sec) => { const t = Math.max(0, Math.round(sec)), h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, s = t % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0'); };

/* opts: { video (HTMLVideoElement של הנגן), frame (המסגרת של הנגן — למסגרת החיתוך), dur, edl, T, onChange(edl), flash } → { el, edl(), destroy }.
   בתצוגה המקדימה הנגן מדלג על מה שנחתך */
export function createEdlEditor(opts) {
  const T = opts.T || ((k) => k), v = opts.video;
  let dur = num(opts.dur) > 0 ? opts.dur : 0;
  let segs = segsOf(opts.edl, dur), ar = opts.edl ? opts.edl.ar : 'src', x = opts.edl ? opts.edl.x : 0.5;
  const past = [], future = [];
  const wrap = el('div', 'st-ed');
  const tl = el('div', 'st-ed-tl'); tl.dir = 'ltr'; tl.setAttribute('role', 'slider'); tl.setAttribute('aria-label', T('studioPlSeek')); tl.tabIndex = 0;
  const segBox = el('div', 'st-ed-segs'), head = el('span', 'st-ed-head');
  tl.append(segBox, head);
  const sum = el('div', 'st-ed-sum');
  const ops = el('div', 'st-se-arow');
  const undoB = b('', T('studioSeUndo'), () => { if (past.length) { future.push(segs); segs = past.pop(); changed(); } }, 'ed-undo');
  ops.append(b('', T('studioEdSplit'), () => act(splitAt(segs, now()), T('studioEdSplitNo')), 'ed-split'),
    b('danger', T('studioEdRemove'), () => act(removeAt(segs, now()), T('studioEdRemoveNo')), 'ed-remove'),
    b('', T('studioEdStartHere'), () => act(trimAt(segs, now(), 'a'), T('studioEdTrimNo')), 'ed-in'),
    b('', T('studioEdEndHere'), () => act(trimAt(segs, now(), 'b'), T('studioEdTrimNo')), 'ed-out'),
    undoB);
  const arRow = el('div', 'st-se-arow');
  const arBtns = ARS.map((k) => b('', k === 'src' ? T('studioEdArSrc') : k, () => { ar = k; changed(); }, 'ed-ar:' + k));
  arRow.append(el('span', 'st-se-el', T('studioEdAr')), ...arBtns);
  const xr = el('input', 'st-ed-x'); xr.type = 'range'; xr.dir = 'ltr'; xr.min = '0'; xr.max = '1'; xr.step = '0.01'; xr.dataset.k = 'ed-x';   // dir=ltr: 0 = שמאל התמונה, גם בממשק RTL
  xr.setAttribute('aria-label', T('studioEdPos'));
  xr.addEventListener('input', () => { x = Number(xr.value); paintCrop(); emit(); });
  const xRow = el('div', 'st-ed-xrow'); xRow.append(el('span', 'st-se-el', T('studioEdPos')), xr);
  wrap.append(tl, sum, ops, arRow, xRow);

  // מסגרת החיתוך על הנגן: מה שמחוץ ליחס שנבחר — כהה (כמו ב־CapCut)
  const crop = el('div', 'st-ed-crop'), win = el('div', 'st-ed-win');
  crop.append(win);
  if (opts.frame) opts.frame.append(crop);
  function paintCrop() {
    const vw = v ? v.videoWidth : 0, vh = v ? v.videoHeight : 0, cb = cropBox(vw, vh, ar, x);
    crop.hidden = !cb || !opts.frame;
    if (crop.hidden) return;
    const fw = opts.frame.clientWidth, fh = opts.frame.clientHeight, k = Math.min(fw / vw, fh / vh);
    const ox = (fw - vw * k) / 2, oy = (fh - vh * k) / 2;
    Object.assign(win.style, { left: (ox + cb.x * k) + 'px', top: (oy + cb.y * k) + 'px', width: (cb.w * k) + 'px', height: (cb.h * k) + 'px' });
  }
  const ro = typeof ResizeObserver === 'function' && opts.frame ? new ResizeObserver(paintCrop) : null;
  if (ro) ro.observe(opts.frame);
  const now = () => (v ? v.currentTime || 0 : 0);
  function act(next, failMsg) {
    if (!next) { if (opts.flash) opts.flash(failMsg); return; }
    past.push(segs); if (past.length > 60) past.shift(); future.length = 0;
    segs = next; changed();
  }
  const cur = () => toEdl(segs, ar, x, dur);
  function emit() { if (opts.onChange) opts.onChange(cur()); }
  function changed() { paint(); emit(); }
  function paint() {
    segBox.replaceChildren();
    if (dur > 0) for (const [a, z] of segs) { const s = el('i'); s.style.left = (a / dur * 100) + '%'; s.style.width = Math.max(0.4, (z - a) / dur * 100) + '%'; segBox.append(s); }
    const left = segs.reduce((t, [a, z]) => t + (z - a), 0);
    sum.textContent = segs.length === 1 ? T('studioEdSum1', { t: fmtM(left), d: fmtM(dur) }) : T('studioEdSum', { n: segs.length, t: fmtM(left), d: fmtM(dur) });
    undoB.disabled = !past.length;
    arBtns.forEach((bt, i) => { const on = ARS[i] === ar; bt.classList.toggle('on', on); bt.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    xRow.hidden = ar === 'src'; xr.value = String(x);
    paintHead(); paintCrop();
  }
  function paintHead() { head.style.left = (dur > 0 ? Math.min(1, now() / dur) * 100 : 0) + '%'; }
  function seekX(cx) { const r = tl.getBoundingClientRect(); if (!(r.width > 0) || !(dur > 0) || !v) return; v.currentTime = Math.max(0, Math.min(1, (cx - r.left) / r.width)) * dur; paintHead(); }
  let drag = false;
  tl.addEventListener('pointerdown', (e) => { drag = true; try { tl.setPointerCapture(e.pointerId); } catch (z) {} seekX(e.clientX); });
  tl.addEventListener('pointermove', (e) => { if (drag) seekX(e.clientX); });
  tl.addEventListener('pointerup', () => { drag = false; });
  tl.addEventListener('pointercancel', () => { drag = false; });
  tl.addEventListener('keydown', (e) => { if (!v) return; if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); v.currentTime = Math.max(0, now() + (e.key === 'ArrowRight' ? 1 : -1)); } });
  // תצוגה מקדימה: בניגון מדלגים על החלקים שנחתכו
  const onTime = () => {
    paintHead();
    if (!v || v.paused || drag) return;
    const t = now();
    if (segAt(segs, t) >= 0) return;
    const nx = segs.find(([a]) => a > t);
    if (nx) v.currentTime = nx[0]; else v.pause();
  };
  const onMeta = () => { paintCrop(); if (!(dur > 0) && v && v.duration > 0 && Number.isFinite(v.duration)) { dur = v.duration; segs = segsOf(opts.edl ? normEdl(opts.edl, dur) : null, dur); paint(); } };
  if (v) { v.addEventListener('timeupdate', onTime); v.addEventListener('seeked', paintHead); v.addEventListener('loadedmetadata', onMeta); }
  paint();
  return {
    el: wrap, edl: cur,
    destroy() { if (ro) ro.disconnect(); crop.remove(); if (v) { v.removeEventListener('timeupdate', onTime); v.removeEventListener('seeked', paintHead); v.removeEventListener('loadedmetadata', onMeta); } },
  };
}
