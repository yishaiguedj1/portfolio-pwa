/* מ4–מ5 (10/10/2026): עורך הווידאו של סטודיו התרגום — חיתוך ויחס תמונה, לפני התרגום (מתרגמים רק את מה שנשאר — זול יותר)
   ואחרי התרגום (הפקה מחדש: הכתוביות זזות עם החיתוך). רשימת עריכות (EDL) אחת:
     { k: [[a, b], …]  — הקטעים שנשארים, בשניות בזמן המקור (ריק = הכל),  ar: 'src' | '9:16' | '1:1' | '4:5',  x: 0–1 — מרכז החיתוך }
   סבב 3 (עורך הווידאו ב׳) — שדות רשות, רק כשהם לא ברירת המחדל, בסדר הזה:
     y: 0–1 מיקום אנכי · z: זום 1–3 · sp: מהירות (SPEEDS) · rt: סיבוב 90/180/270 · fh / fv: היפוך אופקי / אנכי ·
     vo: עוצמה 0–200% · mu: השתקה · fi / fo: הדרגה בהתחלה / בסוף (שניות) · ln: השוואת עוצמה ל־‎−14 LUFS
   סבב 7: dn ניקוי רעש 1/2 · br / ct בהירות / ניגודיות ‎−30…30 (צעד 5) · sa רוויה ‎−100…100 (צעד 10) · fx מסנן (FXS) ·
     bl טשטוש אזור [x, y, w, h] בשברים מהתמונה הסופית · tr מעבר (האפלה) בין קטעים · th זמן התמונה הממוזערת (בתוצאה)
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
export const FXS = ['bw', 'warm', 'cool', 'vint'];   // סבב 7: מסננים (שחור־לבן, חם, קר, וינטג׳)
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
  if (crop && e.af === true) ex.af = true;   // סבב 9: מסגור אוטומטי לדובר (העובד עוקב אחרי הפנים; רק כשיש חיתוך)
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
  // סבב 7 (עורך הווידאו ג׳): ניקוי רעש · בהירות / ניגודיות / רוויה · מסנן · טשטוש אזור · מעברים · תמונה ממוזערת
  if (!mu && (e.dn === 1 || e.dn === 2)) ex.dn = e.dn;
  for (const [f, lo, hi, st] of [['br', -30, 30, 5], ['ct', -30, 30, 5], ['sa', -100, 100, 10]]) {
    const v = num(e[f]);
    if (v >= lo && v <= hi) { const r = Math.round(v / st) * st; if (r !== 0) ex[f] = r; }
  }
  if (FXS.includes(e.fx)) ex.fx = e.fx;
  if (Array.isArray(e.bl) && e.bl.length === 4) {
    const [bx, by, bw, bh] = e.bl.map((v) => Math.round(num(v) * 100) / 100);
    if (bx >= 0 && by >= 0 && bw >= 0.05 && bh >= 0.05 && bx + bw <= 1.0001 && by + bh <= 1.0001) ex.bl = [bx, by, bw, bh];
  }
  if (e.tr === true) ex.tr = true;
  if (num(e.th) >= 0 && num(e.th) <= MAX_T) ex.th = Math.round(e.th * 10) / 10;
  const whole = !k.length || (k.length === 1 && k[0][0] <= JOIN_GAP && num(dur) > 0 && k[0][1] >= num(dur) - JOIN_GAP);
  if (whole && ar === 'src' && !Object.keys(ex).length) return null;
  if (k.length > SEG_MAX) return null;                     // יותר מדי — לא מנחשים מה לשמור
  return Object.assign({ k: whole ? [] : k, ar, x: crop ? x : 0.5 }, ex);
}
/* סבב 7: כותרת ולוגו בהפקה מחדש — **זהה ל־normOv בשרתון ול־norm_ov ב־rerender.py**.
   t = כותרת (עד OV_T_MAX תווים, בלי תווי בקרה / כיווניות / { } \ — נכנסת ל־ASS בלבד), ta = 0 כל הסרטון / 5 רק בהתחלה,
   lg = לוגו (data:image/png|jpeg|webp;base64, עד OV_LG_MAX — מוקטן בטלפון), lp = פינה (tl/tr/bl/br), ls = רוחב באחוזים (8–30, זוגי) */
export const OV_T_MAX = 60, OV_LG_MAX = 65536, OV_POS = ['tl', 'tr', 'bl', 'br'];
const OV_BAD = /[\u0000-\u001f\u007f\u200e\u200f\u202a-\u202e\u2066-\u2069{}\\]/g;
const OV_LG_RE = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
export function normOv(o) {
  if (!o || typeof o !== 'object') return null;
  const out = {};
  const t = typeof o.t === 'string' ? o.t.replace(OV_BAD, '').replace(/\s+/g, ' ').trim().slice(0, OV_T_MAX).trim() : '';
  if (t) { out.t = t; if (o.ta === 5) out.ta = 5; }
  if (typeof o.lg === 'string' && o.lg.length <= OV_LG_MAX && OV_LG_RE.test(o.lg)) {
    out.lg = o.lg;
    out.lp = OV_POS.includes(o.lp) ? o.lp : 'tr';
    const ls = Math.round(Number(o.ls) / 2) * 2;
    out.ls = Number.isFinite(ls) && ls >= 8 && ls <= 30 ? ls : 14;
  }
  return Object.keys(out).length ? out : null;
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
/* כתוביות ({s, e, …} בשניות) → אחרי החיתוך: כתובית שנחתכה כולה — יוצאת; נחתך ממנה רוב הזמן — החלק הארוך שנשאר;
   נחתך ממנה מעט (סבב 4: מילת מילוי / שקט קצר באמצע) — מהחלק הראשון עד האחרון, ברצף. **זהה ל־map_cues בעובד** */
export function mapCues(e, cues, minDur = 0.2) {
  if (!e || !e.k.length) return cues.slice();
  const out = [];
  for (const c of cues) {
    let best = null, first = null, last = null, kept = 0, off = 0;
    for (const [a, b] of e.k) {
      const s = Math.max(c.s, a), z = Math.min(c.e, b);
      if (z > s) {
        const p = [r3(off + s - a), r3(off + z - a)];
        if (!first) first = p;
        last = p; kept += z - s;
        if (!best || z - s > best[1] - best[0]) best = p;
      }
      off += b - a;
    }
    const span = first && first !== last && kept >= (c.e - c.s) * 0.5 ? [first[0], last[1]] : best;
    if (span && span[1] - span[0] >= minDur) out.push(Object.assign({}, c, { s: span[0], e: span[1] }));
  }
  return out;
}
/* סבב 4: מילות מילוי (טווחים מהתמלול) → חיתוך בתוך מה שכבר נבחר. מילה שהחיתוך שלה היה משאיר קטע קצר מ־SEG_MIN
   (= מוחק דיבור) — מדלגים עליה; עד SEG_MAX קטעים. מחזיר { segs, n, t } או null */
export function cutFillers(segs, ranges, dur) {
  const d = num(dur);
  let cur = segs && segs.length ? segs.map((p) => p.slice()) : d > 0 ? [[0, r3(d)]] : null;
  if (!cur) return null;
  let n = 0, t = 0;
  for (const [a, b] of (ranges || []).slice().sort((x, y) => (y[1] - y[0]) - (x[1] - x[0]))) {   // הארוכות קודם
    if (cur.length >= SEG_MAX) break;
    const i = segAt(cur, (a + b) / 2);
    if (i < 0) continue;
    const [x, y] = cur[i];
    if (a - x < SEG_MIN || y - b < SEG_MIN) continue;
    cur.splice(i, 1, [x, r3(a)], [r3(b), y]);
    n++; t += b - a;
  }
  return n ? { segs: cur, n, t: Math.round(t * 10) / 10 } : null;
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
const EXTRA_POS = ['y', 'af', 'z'], EXTRA_REST = ['sp', 'rt', 'fh', 'fv', 'vo', 'mu', 'fi', 'fo', 'ln', 'dn', 'br', 'ct', 'sa', 'fx', 'bl', 'tr', 'th'];
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
/* סבב 10: צריבה לבדיקה — אותה עריכה ועיצוב, רק PV_LEN שניות מ־t (בתוך מה שנשאר; אין שם כלום — מתחילת מה שנשאר).
   בלי תמונה ממוזערת. null = כל הסרטון (קצר מ־PV_LEN) */
export const PV_LEN = 20;
export function previewEdl(e, dur, t) {
  const segs = segsOf(e, dur);
  const k = intersectSegs(segs, [[Math.max(0, num(t)), Math.max(0, num(t)) + PV_LEN]]) || intersectSegs(segs, [[segs[0][0], segs[0][0] + PV_LEN]]);
  if (!k) return null;
  const x = Object.assign({}, e || { ar: 'src', x: 0.5 }, { k });
  delete x.th;
  return normEdl(x, dur);
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
/* סבב 7: התצוגה המקדימה של הצבע והמסנן (CSS filter) — בקירוב לתוצאה של ffmpeg */
export function cssFilter(e) {
  if (!e) return '';
  const f = [];
  if (e.br) f.push('brightness(' + (1 + e.br / 100) + ')');
  if (e.ct) f.push('contrast(' + (1 + e.ct / 100) + ')');
  if (e.sa) f.push('saturate(' + (1 + e.sa / 100) + ')');
  if (e.fx === 'bw') f.push('grayscale(1)');
  else if (e.fx === 'warm') f.push('sepia(.18)', 'saturate(1.08)');
  else if (e.fx === 'cool') f.push('hue-rotate(8deg)', 'saturate(.95)');
  else if (e.fx === 'vint') f.push('sepia(.4)', 'contrast(.92)');
  return f.join(' ');
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
const EXTRAS = ['y', 'af', 'z', 'sp', 'rt', 'fh', 'fv', 'vo', 'mu', 'fi', 'fo', 'ln', 'dn', 'br', 'ct', 'sa', 'fx', 'bl', 'tr', 'th'], FADES = [0, 1, 2, 3];
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
  // סבב 9: מסגור אוטומטי לדובר — רק בהפקה מחדש (לפני התרגום — רק חיתוך ויחס); המיקום מהסליידר = נקודת ההתחלה כשאין פנים
  const afRow = el('div', 'st-se-arow');
  const afB = opts.full ? b('sm', T('studioEdAf'), () => { if (ex.af) delete ex.af; else ex.af = true; changed(); }, 'ed-af') : null;
  const afHint = el('div', 'st-se-el st-ed-hint', T('studioEdAfHint'));
  if (afB) afRow.append(afB);
  wrap.append(tl, sum, ops, arRow, xRow, afRow, afHint);

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
  let dnBtns = [], gCo = null, brR = null, ctR = null, saR = null, coV = null, fxBtns = [], gMo = null, blB = null, trB = null, thB = null, thX = null;   // סבב 7
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
    // סבב 7: ניקוי רעש (afftdn — קל / חזק)
    const dnR = el('div', 'st-se-arow'); dnR.append(el('span', 'st-se-el', T('studioEdDn')));
    dnBtns = [0, 1, 2].map((d) => b('sm', d === 0 ? T('studioEdOff') : d === 1 ? T('studioEdDnLight') : T('studioEdDnStrong'), () => set('dn', d, 0), 'ed-dn:' + d));
    dnR.append(...dnBtns);
    gAu.d.append(vRow, tg, fiR, foR, dnR);
    // סבב 7: צבע — בהירות / ניגודיות / רוויה ומסנן
    gCo = group(T('studioEdGrpColor'), 'ed-g-co');
    const cRow = (k, lo, hi, st, label) => { const r = range('ed-' + k, lo, hi, st, ex[k] || 0, label, (v2) => { if (v2) ex[k] = v2; else delete ex[k]; paintExtras(); preview(); emit(); }); const w2 = el('div', 'st-ed-xrow'); w2.append(el('span', 'st-se-el', label), r); return [w2, r]; };
    const [brRow, br1] = cRow('br', -30, 30, 5, T('studioEdBr')), [ctRow, ct1] = cRow('ct', -30, 30, 5, T('studioEdCt')), [saRow, sa1] = cRow('sa', -100, 100, 10, T('studioEdSa'));
    brR = br1; ctR = ct1; saR = sa1;
    const fxR = el('div', 'st-se-arow');
    fxBtns = [''].concat(FXS).map((f) => b('sm', fxName(f), () => set('fx', f || undefined, undefined), 'ed-fx:' + (f || 'none')));
    fxR.append(...fxBtns);
    gCo.d.append(brRow, ctRow, saRow, fxR);
    coV = gCo.v;
    // סבב 7: עוד — טשטוש אזור, מעברים, תמונה ממוזערת
    gMo = group(T('studioEdGrpMore'), 'ed-g-mo');
    const mr = el('div', 'st-se-arow');
    blB = b('sm', T('studioEdBlur'), () => set('bl', ex.bl ? undefined : [0.35, 0.35, 0.3, 0.2], undefined), 'ed-bl');
    trB = b('sm', T('studioEdTr'), () => set('tr', !ex.tr || undefined, undefined), 'ed-tr');
    mr.append(blB, trB);
    const tr2 = el('div', 'st-se-arow'); tr2.append(el('span', 'st-se-el', T('studioEdThumb')));
    thB = b('sm', T('studioEdThumbHere'), () => { const e0 = cur(), t = mapTime(e0, now()); if (t == null) { if (opts.flash) opts.flash(T('studioEdThumbNo')); return; } set('th', Math.round(t / (ex.sp || 1) * 10) / 10, undefined); }, 'ed-th');
    thX = b('sm', T('studioEdThumbX'), () => set('th', undefined, undefined), 'ed-th-x');
    tr2.append(thB, thX);
    gMo.d.append(mr, tr2, el('div', 'st-se-el st-ed-hint', T('studioEdBlurHint')));
    wrap.append(gSp.d, gFr.d, gAu.d, gCo.d, gMo.d);
  }
  function fxName(f) { return f === 'bw' ? T('studioEdFxBw') : f === 'warm' ? T('studioEdFxWarm') : f === 'cool' ? T('studioEdFxCool') : f === 'vint' ? T('studioEdFxVint') : T('studioEdOff'); }
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
    gAu.v.textContent = mu ? T('studioEdMuted') : [ex.vo != null ? ex.vo + '%' : '', ex.ln ? 'LUFS' : '', ex.fi || ex.fo ? T('studioEdFades') : '', ex.dn ? T('studioEdDn') : ''].filter(Boolean).join(' · ');
    // סבב 7
    dnBtns.forEach((bt, i) => { on(bt, (ex.dn || 0) === i); bt.disabled = mu; });
    brR.value = String(ex.br || 0); ctR.value = String(ex.ct || 0); saR.value = String(ex.sa || 0);
    fxBtns.forEach((bt, i) => on(bt, (ex.fx || '') === ([''].concat(FXS))[i]));
    coV.textContent = [ex.br || ex.ct || ex.sa ? T('studioEdAdj') : '', ex.fx ? fxName(ex.fx) : ''].filter(Boolean).join(' · ');
    on(blB, ex.bl); on(trB, ex.tr);
    thX.hidden = ex.th == null; thB.textContent = ex.th == null ? T('studioEdThumbHere') : T('studioEdThumbAt', { t: fmtM(ex.th) });
    gMo.v.textContent = [ex.bl ? T('studioEdBlur') : '', ex.tr ? T('studioEdTr') : '', ex.th != null ? T('studioEdThumb') : ''].filter(Boolean).join(' · ');
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
    const key = [ex.sp, ex.rt, ex.fh, ex.fv, ex.vo, ex.mu, v.videoWidth, ex.br, ex.ct, ex.sa, ex.fx].join();
    if (key === pvKey) return;                 // רק כשמשהו השתנה — לא דורסים את הבקרות של הנגן בכל ציור
    pvKey = key;
    try { v.playbackRate = ex.sp || 1; } catch (e) {}
    v.style.transform = videoTransform();
    v.style.filter = cssFilter(ex);            // סבב 7: צבע ומסנן — בקירוב (בתוצאה — eq / colorbalance / curves של ffmpeg)
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
  // סבב 7: טשטוש אזור — מלבן על התמונה הסופית (גרירה = הזזה, הפינה = גודל); השברים — מהתמונה אחרי החיתוך
  const blr = el('div', 'st-ed-blr'), blH = el('span', 'st-ed-blh');
  blr.append(blH); blr.hidden = true; blr.dataset.k = 'ed-blr';
  if (opts.frame && opts.full) opts.frame.append(blr);
  let fr = null;                               // { x, y, w, h } — מלבן התמונה הסופית על המסך (px)
  function paintCrop() {
    const rt = ex.rt || 0, [vw, vh] = rotDims(v ? v.videoWidth : 0, v ? v.videoHeight : 0, rt), cb = cropBox(vw, vh, ar, x, ex.y, ex.z || 1);
    crop.hidden = !cb || !opts.frame;
    fr = null;
    if (opts.frame && vw > 0) {
      const fw = opts.frame.clientWidth, fh = opts.frame.clientHeight, k = Math.min(fw / vw, fh / vh);
      const ox = (fw - vw * k) / 2, oy = (fh - vh * k) / 2;
      fr = cb ? { x: ox + cb.x * k, y: oy + cb.y * k, w: cb.w * k, h: cb.h * k } : { x: ox, y: oy, w: vw * k, h: vh * k };
      if (cb) Object.assign(win.style, { left: fr.x + 'px', top: fr.y + 'px', width: fr.w + 'px', height: fr.h + 'px' });
    }
    blr.hidden = !(ex.bl && fr && opts.full);
    if (!blr.hidden) Object.assign(blr.style, { left: (fr.x + ex.bl[0] * fr.w) + 'px', top: (fr.y + ex.bl[1] * fr.h) + 'px', width: (ex.bl[2] * fr.w) + 'px', height: (ex.bl[3] * fr.h) + 'px' });
  }
  let bd = null;
  blr.addEventListener('pointerdown', (e) => { if (!ex.bl || !fr) return; e.stopPropagation(); bd = { x: e.clientX, y: e.clientY, bl: ex.bl.slice(), rs: e.target === blH }; try { blr.setPointerCapture(e.pointerId); } catch (z) {} });
  blr.addEventListener('pointermove', (e) => {
    if (!bd || !fr) return;
    const dx = (e.clientX - bd.x) / fr.w, dy = (e.clientY - bd.y) / fr.h, c = (v2, lo, hi) => Math.max(lo, Math.min(hi, Math.round(v2 * 100) / 100));
    const [bx, by, bw, bh] = bd.bl;
    ex.bl = bd.rs ? [bx, by, c(bw + dx, 0.05, 1 - bx), c(bh + dy, 0.05, 1 - by)] : [c(bx + dx, 0, 1 - bw), c(by + dy, 0, 1 - bh), bw, bh];
    paintCrop();
  });
  const blEnd = () => { if (bd) { bd = null; emit(); } };
  blr.addEventListener('pointerup', blEnd); blr.addEventListener('pointercancel', blEnd);
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
    afRow.hidden = !afB || xRow.hidden; afHint.hidden = afRow.hidden || !ex.af;
    if (afB) { afB.classList.toggle('on', !!ex.af); afB.setAttribute('aria-pressed', ex.af ? 'true' : 'false'); }
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
    destroy() { if (ro) ro.disconnect(); crop.remove(); blr.remove(); if (v && opts.full) { v.style.transform = ''; v.style.filter = ''; try { v.playbackRate = 1; v.volume = 1; v.muted = false; } catch (e) {} } if (v) { v.removeEventListener('timeupdate', onTime); v.removeEventListener('seeked', paintHead); v.removeEventListener('loadedmetadata', onMeta); } },
  };
}
