/* מ4–מ5 (10/10/2026): עורך הווידאו של סטודיו התרגום — חיתוך ויחס תמונה, לפני התרגום (מתרגמים רק את מה שנשאר — זול יותר)
   ואחרי התרגום (הפקה מחדש: הכתוביות זזות עם החיתוך). רשימת עריכות (EDL) אחת:
     { k: [[a, b], …]  — הקטעים שנשארים, בשניות בזמן המקור (ריק = הכל),  ar: 'src' | '9:16' | '1:1' | '4:5',  x: 0–1 — מרכז החיתוך }
   סבב 3 (עורך הווידאו ב׳) — שדות רשות, רק כשהם לא ברירת המחדל, בסדר הזה:
     y: 0–1 מיקום אנכי · z: זום 1–3 · sp: מהירות (SPEEDS) · rt: סיבוב 90/180/270 · fh / fv: היפוך אופקי / אנכי ·
     vo: עוצמה 0–200% · mu: השתקה · fi / fo: הדרגה בהתחלה / בסוף (שניות) · ln: השוואת עוצמה ל־‎−14 LUFS
   לפני התרגום רק k / ar / x (edlPre) — מהירות ושמע משנים את מה שהתמלול שומע.
   **אותה לוגיקה בדיוק ב־translator/edl.py ובשרתון (ibkr-proxy/lib/studio.js normEdl)** — tests/studio-edl משווה.
   הלוגיקה טהורה (נבדקת ב־node); ה־DOM רק ב־createEdlEditor. */

export const SEG_MIN = 0.5;          // קטע קצר מזה — לא נשמר
export const SEG_MAX = 60;           // קטעים בעריכה אחת
export const JOIN_GAP = 0.05;        // קטעים צמודים (פחות מזה) מתאחדים
export const ARS = ['src', '9:16', '1:1', '4:5'];
export const MAX_T = 24 * 3600;
export const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];
export const ROTS = [0, 90, 180, 270];
export const Z_MAX = 3;
export const VOL_MAX = 200;
export const FADE_MAX = 10;
export const LUFS = -14;
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
  const z = num(e.z) > 1 ? Math.min(Z_MAX, Math.round(e.z * 20) / 20) : 1;
  const crop = ar !== 'src' || z > 1;
  const x = num(e.x) >= 0 && num(e.x) <= 1 ? Math.round(e.x * 100) / 100 : 0.5;
  const y = num(e.y) >= 0 && num(e.y) <= 1 ? Math.round(e.y * 100) / 100 : 0.5;
  const ex = {};
  if (crop && y !== 0.5) ex.y = y;
  if (z > 1) ex.z = z;
  if (SPEEDS.includes(num(e.sp)) && e.sp !== 1) ex.sp = e.sp;
  if (ROTS.includes(num(e.rt)) && e.rt !== 0) ex.rt = e.rt;
  if (e.fh === true) ex.fh = true;
  if (e.fv === true) ex.fv = true;
  const mu = e.mu === true;
  if (!mu && num(e.vo) >= 0 && num(e.vo) <= VOL_MAX && Math.round(e.vo) !== 100) ex.vo = Math.round(e.vo);
  if (mu) ex.mu = true;
  for (const f of ['fi', 'fo']) if (!mu && num(e[f]) > 0) { const r = Math.min(FADE_MAX, Math.round(e[f] * 2) / 2); if (r) ex[f] = r; }
  if (!mu && e.ln === true) ex.ln = true;
  const whole = !k.length || (k.length === 1 && k[0][0] <= JOIN_GAP && num(dur) > 0 && k[0][1] >= num(dur) - JOIN_GAP);
  if (whole && ar === 'src' && !Object.keys(ex).length) return null;
  if (k.length > SEG_MAX) return null;                     // יותר מדי — לא מנחשים מה לשמור
  return Object.assign({ k: whole ? [] : k, ar, x: crop ? x : 0.5 }, ex);
}
/* לפני התרגום: רק החיתוך ויחס התמונה (מהירות, סיבוב ושמע — רק בהפקה מחדש) */
export function edlPre(e) {
  if (!e) return null;
  return e.k.length || e.ar !== 'src' ? { k: e.k.map((p) => p.slice()), ar: e.ar, x: e.ar === 'src' ? 0.5 : e.x } : null;
}
/* האורך של התוצאה — אחרי החיתוך ואחרי המהירות */
export function outDur(e, dur) { return r3(edlDur(e, dur) / (e && e.sp ? e.sp : 1)); }
/* מידות התמונה אחרי הסיבוב */
export function rotDims(W, H, rt) { return rt === 90 || rt === 270 ? [H, W] : [W, H]; }
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
  const copy = (e) => Object.assign({}, e, { k: e.k.map((p) => p.slice()) });
  if (!e0) return e1 ? copy(e1) : null;
  if (!e1) return copy(e0);
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
  return withExtras({ k, ar, x: e1.ar !== 'src' ? e1.x : e0.x }, e0, e1);
}
/* הרכבה: המיקום והזום מהעריכה שקבעה את החיתוך; כל השאר (מהירות, סיבוב, שמע) — מהאחרונה */
const EXTRA_POS = ['y', 'z'], EXTRA_REST = ['sp', 'rt', 'fh', 'fv', 'vo', 'mu', 'fi', 'fo', 'ln'];
function withExtras(base, e0, e1) {
  const crop1 = e1.ar !== 'src' || e1.z > 1, from = crop1 ? e1 : e0;
  if (crop1) base.x = e1.x;
  for (const f of EXTRA_POS) if (from[f] !== undefined) base[f] = from[f];
  for (const f of EXTRA_REST) if (e1[f] !== undefined) base[f] = e1[f];
  return base;
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
/* מ8: הסרת שקטים — בלי טוקנים: הזמנים של הכתוביות (מהתמלול) הם הדיבור. נשאר כל מה שנאמר ± pad,
   שקט קצר מ־gap נשאר (נשימה, לא קטיעה). מחזיר קטעים, או null כשאין מה להסיר */
export function silenceSegs(cues, dur, gap = 1.2, pad = 0.25) {
  const d = num(dur) > 0 ? dur : Infinity, out = [];
  for (const c of cues) {
    const a = Math.max(0, c.s - pad), z = Math.min(d, c.e + pad);
    if (!(z > a)) continue;
    const last = out[out.length - 1];
    if (last && a - last[1] < gap) last[1] = Math.max(last[1], r3(z));
    else out.push([r3(a), r3(z)]);
  }
  const kept = out.filter(([a, z]) => z - a >= SEG_MIN);
  if (!kept.length || kept.length > SEG_MAX) return null;
  const total = kept.reduce((t, [a, z]) => t + z - a, 0);
  return Number.isFinite(d) && d - total < 1 ? null : kept;
}
/* מ8: חיתוך לפי התמליל — הוצאת טווח [a, b) מהקטעים (כתובית שלא רוצים) */
export function removeRange(segs, a, b) {
  const out = [];
  for (const [x, y] of segs) {
    if (b <= x || a >= y) { out.push([x, y]); continue; }
    if (a - x >= SEG_MIN) out.push([x, r3(a)]);
    if (y - b >= SEG_MIN) out.push([r3(b), y]);
  }
  return out.length ? out : null;
}
/* חיתוך משותף: מה שנשאר בשתי הרשימות (הסרת שקטים בתוך מה שכבר נבחר); קטעים קצרים מ־SEG_MIN בחוץ */
export function intersectSegs(x, y) {
  if (!x || !y) return null;
  const out = [];
  for (const [a, b] of x) for (const [c, d] of y) { const s = Math.max(a, c), z = Math.min(b, d); if (z - s >= SEG_MIN) out.push([r3(s), r3(z)]); }
  return out.length ? out.sort((p, q) => p[0] - q[0]) : null;
}
export function addRange(segs, a, b) {
  const all = segs.concat([[r3(a), r3(b)]]).sort((x, y) => x[0] - y[0]), out = [];
  for (const s of all) { const l = out[out.length - 1]; if (l && s[0] <= l[1] + JOIN_GAP) l[1] = Math.max(l[1], s[1]); else out.push(s.slice()); }
  return out;
}
/* הקטעים חוזרים לעריכה (אחרי חיתוך קטע = מחיקה, קטעים צמודים נשארים נפרדים בעורך אבל מתאחדים ב־normEdl) */
export const toEdl = (segs, ar, x, dur) => normEdl({ k: segs, ar, x }, dur);
/* מה החיתוך במלבן (WxH — אחרי הסיבוב, יחס יעד, מיקום x/y, זום z) — אותו חישוב כמו ב־edl.py (crop של ffmpeg) */
export function cropBox(W, H, ar, x, y, z) {
  const zz = z > 1 ? z : 1;
  if ((ar === 'src' && zz === 1) || !(W > 0 && H > 0)) return null;
  const even = (v) => Math.max(2, Math.floor(v / 2) * 2), pos = (free, f) => (free >= 2 ? Math.floor(free * f / 2) * 2 : 0);
  let bw = W, bh = H;
  if (ar !== 'src') { const [rw, rh] = ar.split(':').map(Number), r = rw / rh; if (W / H > r) bw = H * r; else bh = W / r; }
  const w = even(bw / zz), h = even(bh / zz);
  return { w, h, x: pos(W - w, x == null ? 0.5 : x), y: pos(H - h, y == null ? 0.5 : y) };
}
/* ---------------- הרכיב (DOM) ---------------- */
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function b(cls, label, fn, k) {
  const x = el('button', 'st-se-b ' + cls, label); x.type = 'button';
  if (k) x.dataset.k = k;
  x.addEventListener('click', (e) => { e.stopPropagation(); fn(e); });
  return x;
}
const fmtX = (n) => '\u2066' + n + '×\u2069';   // בידוד LTR — בעברית "×1.6" מתהפך
const EXTRAS = ['y', 'z', 'sp', 'rt', 'fh', 'fv', 'vo', 'mu', 'fi', 'fo', 'ln'], FADES = [0, 1, 2, 3];
const fmtM = (sec) => { const t = Math.max(0, Math.round(sec)), h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, s = t % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0'); };

/* opts: { video (HTMLVideoElement של הנגן), frame (המסגרת של הנגן — למסגרת החיתוך), dur, edl, T, onChange(edl), flash, full } → { el, edl(), destroy }.
   full = הפקה מחדש: גם מהירות, סיבוב, מסגור ושמע (סבב 3).
   בתצוגה המקדימה הנגן מדלג על מה שנחתך */
export function createEdlEditor(opts) {
  const T = opts.T || ((k) => k), v = opts.video;
  let dur = num(opts.dur) > 0 ? opts.dur : 0;
  let segs = segsOf(opts.edl, dur), ar = opts.edl ? opts.edl.ar : 'src', x = opts.edl ? opts.edl.x : 0.5;
  const ex = {};                       // סבב 3: y, z, sp, rt, fh, fv, vo, mu, fi, fo, ln (רק בהפקה מחדש)
  if (opts.full && opts.edl) for (const f of EXTRAS) if (opts.edl[f] !== undefined) ex[f] = opts.edl[f];
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

  /* ---------- סבב 3: מהירות וסיבוב · מסגור · שמע — מקטעים מקופלים, רק בהפקה מחדש ---------- */
  const set = (f, val, def) => { if (val === def || val == null) delete ex[f]; else ex[f] = val; changed(); };
  const range = (k, min, max, step, val, label, on) => {
    const r = el('input', 'st-ed-x'); r.type = 'range'; r.dir = 'ltr'; r.min = String(min); r.max = String(max); r.step = String(step); r.value = String(val); r.dataset.k = k;
    r.setAttribute('aria-label', label); r.addEventListener('input', () => on(Number(r.value)));
    return r;
  };
  const group = (title, k) => { const d = el('details', 'st-ed-grp'); const sm = el('summary'); const t = el('span', null, title), v = el('small'); sm.append(t, v); d.append(sm); d.dataset.k = k; return { d, v }; };
  let spBtns = [], rtB = null, fhB = null, fvB = null, zr = null, yr = null, yRow = null, vr = null, vv = null, muB = null, lnB = null, fiBtns = [], foBtns = [];
  let gSp = null, gFr = null, gAu = null;
  if (opts.full) {
    gSp = group(T('studioEdGrpSpeed'), 'ed-g-sp');
    const sr = el('div', 'st-se-arow');
    spBtns = SPEEDS.map((sp) => { const bt = b('sm', fmtX(sp), () => set('sp', sp, 1), 'ed-sp:' + sp); bt.dir = 'ltr'; return bt; });
    sr.append(...spBtns);
    const rr = el('div', 'st-se-arow');
    rtB = b('sm', T('studioEdRot'), () => set('rt', ((ex.rt || 0) + 90) % 360, 0), 'ed-rt');
    fhB = b('sm', T('studioEdFlipH'), () => set('fh', !ex.fh || undefined, undefined), 'ed-fh');
    fvB = b('sm', T('studioEdFlipV'), () => set('fv', !ex.fv || undefined, undefined), 'ed-fv');
    rr.append(rtB, fhB, fvB);
    gSp.d.append(sr, rr);
    gFr = group(T('studioEdGrpFrame'), 'ed-g-fr');
    zr = range('ed-z', 1, Z_MAX, 0.05, ex.z || 1, T('studioEdZoom'), (v2) => { if (v2 > 1) ex.z = v2; else delete ex.z; paintCrop(); paintExtras(); emit(); });
    const zRow = el('div', 'st-ed-xrow'); zRow.append(el('span', 'st-se-el', T('studioEdZoom')), zr);
    yr = range('ed-y', 0, 1, 0.01, ex.y == null ? 0.5 : ex.y, T('studioEdPosY'), (v2) => { if (v2 !== 0.5) ex.y = v2; else delete ex.y; paintCrop(); emit(); });
    yRow = el('div', 'st-ed-xrow'); yRow.append(el('span', 'st-se-el', T('studioEdPosY')), yr);
    gFr.d.append(zRow, yRow);
    gAu = group(T('studioEdGrpAudio'), 'ed-g-au');
    vr = range('ed-vo', 0, VOL_MAX, 5, ex.vo == null ? 100 : ex.vo, T('studioEdVol'), (v2) => { if (Math.round(v2) !== 100) ex.vo = Math.round(v2); else delete ex.vo; paintExtras(); preview(); emit(); });
    vv = el('span', 'st-se-ev');
    const vRow = el('div', 'st-ed-xrow'); vRow.append(el('span', 'st-se-el', T('studioEdVol')), vr, vv);
    const tg = el('div', 'st-se-arow');
    muB = b('sm', T('studioEdMute'), () => set('mu', !ex.mu || undefined, undefined), 'ed-mu');
    lnB = b('sm', T('studioEdLoud'), () => set('ln', !ex.ln || undefined, undefined), 'ed-ln');
    tg.append(muB, lnB);
    const fadeRow = (f, label) => {
      const r = el('div', 'st-se-arow'); r.append(el('span', 'st-se-el', label));
      const bs = FADES.map((sec) => b('sm', sec ? T('studioEdSec', { n: sec }) : T('studioEdNoFade'), () => set(f, sec, 0), 'ed-' + f + ':' + sec));
      r.append(...bs); return [r, bs];
    };
    const [fiR, fiB] = fadeRow('fi', T('studioEdFadeIn')), [foR, foB] = fadeRow('fo', T('studioEdFadeOut'));
    fiBtns = fiB; foBtns = foB;
    gAu.d.append(vRow, tg, fiR, foR);
    wrap.append(gSp.d, gFr.d, gAu.d);
  }
  function paintExtras() {
    if (!opts.full) return;
    const on = (bt, v2) => { bt.classList.toggle('on', !!v2); bt.setAttribute('aria-pressed', v2 ? 'true' : 'false'); };
    spBtns.forEach((bt, i) => on(bt, (ex.sp || 1) === SPEEDS[i]));
    rtB.textContent = T('studioEdRot') + (ex.rt ? ' · ' + ex.rt + '°' : ''); on(rtB, ex.rt); on(fhB, ex.fh); on(fvB, ex.fv);
    gSp.v.textContent = [ex.sp ? fmtX(ex.sp) : '', ex.rt ? ex.rt + '°' : '', ex.fh || ex.fv ? T('studioEdFlipped') : ''].filter(Boolean).join(' · ');
    zr.value = String(ex.z || 1);
    yRow.hidden = !hasYRoom();
    gFr.v.textContent = ex.z ? fmtX(ex.z) : '';
    const mu = !!ex.mu;
    vr.disabled = mu; vr.value = String(ex.vo == null ? 100 : ex.vo); vv.textContent = (ex.vo == null ? 100 : ex.vo) + '%';
    on(muB, mu); on(lnB, ex.ln); lnB.disabled = mu;
    fiBtns.forEach((bt, i) => { on(bt, (ex.fi || 0) === FADES[i]); bt.disabled = mu; });
    foBtns.forEach((bt, i) => { on(bt, (ex.fo || 0) === FADES[i]); bt.disabled = mu; });
    gAu.v.textContent = mu ? T('studioEdMuted') : [ex.vo != null ? ex.vo + '%' : '', ex.ln ? 'LUFS' : '', ex.fi || ex.fo ? T('studioEdFades') : ''].filter(Boolean).join(' · ');
  }
  /* יש מקום לזוז אנכית? (החיתוך צר מהתמונה בגובה) */
  function hasYRoom() {
    const [W, H] = rotDims(v ? v.videoWidth : 0, v ? v.videoHeight : 0, ex.rt || 0), cb = cropBox(W, H, ar, x, 0.5, ex.z || 1);
    return !!cb && H - cb.h >= 2;
  }
  /* התצוגה המקדימה בנגן: מהירות, סיבוב והיפוך (CSS), עוצמה / השתקה. הדרגה והשוואת עוצמה — רק בתוצאה */
  let pvKey = '';
  function preview() {
    if (!opts.full || !v) return;
    const key = [ex.sp, ex.rt, ex.fh, ex.fv, ex.vo, ex.mu, v.videoWidth].join();
    if (key === pvKey) return;                 // רק כשמשהו השתנה — לא דורסים את הבקרות של הנגן בכל ציור
    pvKey = key;
    try { v.playbackRate = ex.sp || 1; } catch (e) {}
    v.style.transform = videoTransform();
    try { v.volume = Math.min(1, (ex.vo == null ? 100 : ex.vo) / 100); v.muted = !!ex.mu; } catch (e) {}
  }
  function videoTransform() {
    const rt = ex.rt || 0, sx = ex.fh ? -1 : 1, sy = ex.fv ? -1 : 1;
    if (!rt && sx === 1 && sy === 1) return '';
    let k = 1;
    if ((rt === 90 || rt === 270) && opts.frame && v && v.videoWidth) {        // התמונה המסובבת נכנסת למסגרת
      const fw = opts.frame.clientWidth, fh = opts.frame.clientHeight, vw = v.videoWidth, vh = v.videoHeight;
      k = Math.min(fw / vh, fh / vw) / Math.min(fw / vw, fh / vh);
    }
    return 'scale(' + sx + ', ' + sy + ') rotate(' + rt + 'deg)' + (k !== 1 ? ' scale(' + k.toFixed(4) + ')' : '');
  }

  // מסגרת החיתוך על הנגן: מה שמחוץ ליחס שנבחר — כהה (כמו ב־CapCut)
  const crop = el('div', 'st-ed-crop'), win = el('div', 'st-ed-win');
  crop.append(win);
  if (opts.frame) opts.frame.append(crop);
  function paintCrop() {
    const rt = ex.rt || 0, [vw, vh] = rotDims(v ? v.videoWidth : 0, v ? v.videoHeight : 0, rt), cb = cropBox(vw, vh, ar, x, ex.y, ex.z || 1);
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
  const cur = () => normEdl(Object.assign({ k: segs, ar, x }, ex), dur);
  function emit() { if (opts.onChange) opts.onChange(cur()); }
  function changed() { paint(); emit(); }
  function paint() {
    segBox.replaceChildren();
    if (dur > 0) for (const [a, z] of segs) { const s = el('i'); s.style.left = (a / dur * 100) + '%'; s.style.width = Math.max(0.4, (z - a) / dur * 100) + '%'; segBox.append(s); }
    const left = segs.reduce((t, [a, z]) => t + (z - a), 0);
    sum.textContent = segs.length === 1 ? T('studioEdSum1', { t: fmtM(left), d: fmtM(dur) }) : T('studioEdSum', { n: segs.length, t: fmtM(left), d: fmtM(dur) });
    undoB.disabled = !past.length;
    arBtns.forEach((bt, i) => { const on = ARS[i] === ar; bt.classList.toggle('on', on); bt.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    xRow.hidden = ar === 'src' && !(ex.z > 1); xr.value = String(x);
    paintExtras(); preview();
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
  const onMeta = () => { paintCrop(); paintExtras(); preview(); if (!(dur > 0) && v && v.duration > 0 && Number.isFinite(v.duration)) { dur = v.duration; segs = segsOf(opts.edl ? normEdl(opts.edl, dur) : null, dur); paint(); } };
  if (v) { v.addEventListener('timeupdate', onTime); v.addEventListener('seeked', paintHead); v.addEventListener('loadedmetadata', onMeta); }
  paint();
  return {
    el: wrap, edl: cur,
    segs: () => segs,
    /* מ8: שינוי מבחוץ (הסרת שקטים, חיתוך לפי התמליל) — צעד ביטול רגיל */
    set(next, failMsg) { act(next, failMsg || ''); },
    destroy() { if (ro) ro.disconnect(); crop.remove(); if (v && opts.full) { v.style.transform = ''; try { v.playbackRate = 1; v.volume = 1; v.muted = false; } catch (e) {} } if (v) { v.removeEventListener('timeupdate', onTime); v.removeEventListener('seeked', paintHead); v.removeEventListener('loadedmetadata', onMeta); } },
  };
}
