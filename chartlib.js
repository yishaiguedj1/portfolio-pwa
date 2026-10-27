/* 27/10/2026 (בקשת המשתמש — "גרף נרות" ברמה של TradingView ומעבר): החישובים של גרף הנרות — טהורים, בלי DOM.
   chart.js (המסך) מייבא מכאן; הבדיקות (tests/chart.test.js) מריצות ב־vm.
   נר = { timestamp (ms), open, high, low, close, volume }. מערך תוצאה של אינדיקטור = אובייקט לכל נר (ערך חסר = undefined).
   המקורות לנוסחאות: ההגדרות המקובלות (TradingView Help / StockCharts ChartSchool) — כל אינדיקטור נבדק מול ערכים ידניים. */

/* ---------- טווחי זמן ----------
   base = הטווח שמגיע מהשרתון (Yahoo), n = כמה נרות בסיס לנר אחד (צבירה בטלפון). sec = אורך נר בשניות (לטיק החי). */
export const TF = {
  '1m': { base: '1m', n: 1, p: { type: 'minute', span: 1 }, sec: 60 },
  '2m': { base: '2m', n: 1, p: { type: 'minute', span: 2 }, sec: 120 },
  '3m': { base: '1m', n: 3, p: { type: 'minute', span: 3 }, sec: 180 },
  '5m': { base: '5m', n: 1, p: { type: 'minute', span: 5 }, sec: 300 },
  '10m': { base: '5m', n: 2, p: { type: 'minute', span: 10 }, sec: 600 },
  '15m': { base: '15m', n: 1, p: { type: 'minute', span: 15 }, sec: 900 },
  '30m': { base: '30m', n: 1, p: { type: 'minute', span: 30 }, sec: 1800 },
  '45m': { base: '15m', n: 3, p: { type: 'minute', span: 45 }, sec: 2700 },
  '1h': { base: '60m', n: 1, p: { type: 'hour', span: 1 }, sec: 3600 },
  '2h': { base: '60m', n: 2, p: { type: 'hour', span: 2 }, sec: 7200 },
  '3h': { base: '60m', n: 3, p: { type: 'hour', span: 3 }, sec: 10800 },
  '4h': { base: '60m', n: 4, p: { type: 'hour', span: 4 }, sec: 14400 },
  '1D': { base: '1d', n: 1, p: { type: 'day', span: 1 }, sec: 86400 },
  '1W': { base: '1wk', n: 1, p: { type: 'week', span: 1 }, sec: 604800 },
  '1M': { base: '1mo', n: 1, p: { type: 'month', span: 1 }, sec: 2592000 },
  '3M': { base: '1mo', n: 3, p: { type: 'month', span: 3 }, sec: 7776000, cal: 3 },
  '6M': { base: '1mo', n: 6, p: { type: 'month', span: 6 }, sec: 15552000, cal: 6 },
  '12M': { base: '1mo', n: 12, p: { type: 'year', span: 1 }, sec: 31536000, cal: 12 },
};
export const TF_ORDER = Object.keys(TF);
export const isIntraday = (tf) => TF[tf] && /m$/.test(TF[tf].base);

/* צבירת נרות בסיס לנר גדול יותר.
   תוך־יומי: הנר מעוגן לתחילת הסשן (כמו TradingView: 45 דק׳ מ־9:30, 4 שעות = 9:30 ו־13:30) — סשן חדש = פער של 3 שעות ומעלה.
   חודשי: לפי רבעון/חצי/שנה קלנדריים (cal). */
export function aggregate(bars, tf) {
  const d = TF[tf];
  if (!d || d.n === 1 || !bars.length) return bars.slice();
  const out = [];
  let cur = null, key = null, anchor = null, prevT = null;
  const span = d.sec * 1000;
  for (const b of bars) {
    let k;
    if (d.cal) {
      const dt = new Date(b.timestamp + 43200000);   // חצי יום קדימה — חותמת חצות מקומית לא נופלת לחודש הקודם ב־UTC
      k = dt.getUTCFullYear() * 12 + Math.floor(dt.getUTCMonth() / d.cal) * d.cal;
    } else {
      if (prevT == null || b.timestamp - prevT >= 3 * 3600000) anchor = b.timestamp;
      k = anchor + Math.floor((b.timestamp - anchor) / span) * span;
    }
    prevT = b.timestamp;
    if (k !== key) {
      if (cur) out.push(cur);
      key = k;
      cur = { timestamp: d.cal ? b.timestamp : k, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume || 0 };
    } else {
      if (b.high > cur.high) cur.high = b.high;
      if (b.low < cur.low) cur.low = b.low;
      cur.close = b.close;
      cur.volume += b.volume || 0;
    }
  }
  if (cur) out.push(cur);
  return out;
}

/* תשובת השרתון (עמודות) → נרות */
export function fromColumns(r) {
  const out = [];
  if (!r || !Array.isArray(r.t)) return out;
  for (let i = 0; i < r.t.length; i++) out.push({ timestamp: r.t[i] * 1000, open: r.o[i], high: r.h[i], low: r.l[i], close: r.c[i], volume: r.v[i] || 0 });
  return out;
}

/* מיזוג נרות טריים (רענון תקופתי מהשרתון) לתוך הקיימים: חותמת זהה = מחליפים, חדשה = מוסיפים. מחזיר מערך חדש */
export function mergeBars(old, fresh) {
  if (!fresh.length) return old.slice();
  if (!old.length) return fresh.slice();
  const first = fresh[0].timestamp;
  let k = old.length;
  while (k > 0 && old[k - 1].timestamp >= first) k--;
  return old.slice(0, k).concat(fresh);
}

/* טיק חי (מחיר + נפח מצטבר של היום) על נרות הבסיס.
   intra: נר חדש כשהזמן עבר את סוף הנר האחרון (מעוגן לנר האחרון — כך גם נר של 60 דק׳ שמתחיל ב־9:30).
   יומי ומעלה: dayKey(ms) → מחרוזת היום בשעון הבורסה; יום חדש בסשן הרגיל = נר חדש. */
export function applyTick(bars, tick, opt) {
  if (!bars.length || !(tick.price > 0)) return { bars, changed: false, added: false };
  const last = bars[bars.length - 1];
  const t = tick.time;
  const sec = opt.sec * 1000;
  let added = false;
  if (opt.intra) {
    if (t < last.timestamp) return { bars, changed: false, added: false };
    if (t >= last.timestamp + sec) {
      const k = Math.floor((t - last.timestamp) / sec);
      bars.push({ timestamp: last.timestamp + k * sec, open: tick.price, high: tick.price, low: tick.price, close: tick.price, volume: Math.max(0, tick.dv || 0) });
      added = true;
    } else upd(last, tick.price, tick.dv);
  } else {
    if (!tick.regular) return { bars, changed: false, added: false };
    const same = opt.dayKey ? opt.dayKey(t) === opt.dayKey(last.timestamp) : true;
    if (!same && opt.base === '1d') {
      bars.push({ timestamp: t, open: tick.price, high: tick.price, low: tick.price, close: tick.price, volume: tick.dayVol || 0 });
      added = true;
    } else {
      upd(last, tick.price, 0);
      if (opt.base === '1d' && tick.dayVol > 0) last.volume = tick.dayVol;
    }
  }
  return { bars, changed: true, added };
}
function upd(b, p, dv) {
  b.close = p;
  if (p > b.high) b.high = p;
  if (p < b.low) b.low = p;
  if (dv > 0) b.volume = (b.volume || 0) + dv;
}

/* ---------- סוגי גרף שנבנים מהנתונים (TradingView: Heikin Ashi, Renko, Line Break, Kagi) ---------- */
export function heikinAshi(bars) {
  const out = [];
  let po = null, pc = null;
  for (const b of bars) {
    const c = (b.open + b.high + b.low + b.close) / 4;
    const o = po == null ? (b.open + b.close) / 2 : (po + pc) / 2;
    out.push({ timestamp: b.timestamp, open: o, high: Math.max(b.high, o, c), low: Math.min(b.low, o, c), close: c, volume: b.volume });
    po = o; pc = c;
  }
  return out;
}
/* Renko — לבנים בגודל קבוע (ברירת מחדל: ATR 14). הזמן = הנר שבו הלבנה נסגרה; כמה לבנים באותו נר = רווח של אלפית שנייה */
export function renko(bars, box) {
  if (!bars.length) return [];
  const size = box > 0 ? box : (last(atr(bars, 14)) || bars[0].close * 0.01);
  const out = [];
  let base = bars[0].close, dir = 0;
  for (const b of bars) {
    let k = 0;
    for (;;) {
      if (b.close >= base + size * (dir === -1 ? 2 : 1)) {
        const o = dir === -1 ? base + size : base;
        out.push({ timestamp: b.timestamp + k++, open: o, high: o + size, low: o, close: o + size, volume: b.volume });
        base = o + size; dir = 1;
      } else if (b.close <= base - size * (dir === 1 ? 2 : 1)) {
        const o = dir === 1 ? base - size : base;
        out.push({ timestamp: b.timestamp + k++, open: o, high: o, low: o - size, close: o - size, volume: b.volume });
        base = o - size; dir = -1;
      } else break;
    }
  }
  return out;
}
/* Line Break (3 קווים כברירת מחדל) — קו חדש רק כשהסגירה שוברת את n הקווים האחרונים */
export function lineBreak(bars, n) {
  n = n || 3;
  const out = [];
  for (const b of bars) {
    if (!out.length) { out.push({ timestamp: b.timestamp, open: b.open, high: Math.max(b.open, b.close), low: Math.min(b.open, b.close), close: b.close, volume: b.volume }); continue; }
    const p = out[out.length - 1], up = p.close >= p.open;
    const lastN = out.slice(-n);
    const hi = Math.max(...lastN.map((x) => Math.max(x.open, x.close))), lo = Math.min(...lastN.map((x) => Math.min(x.open, x.close)));
    let o = null;
    if (b.close > (up ? p.close : hi)) o = up ? p.close : p.open;
    else if (b.close < (up ? lo : p.close)) o = up ? p.open : p.close;
    if (o == null) { p.volume = (p.volume || 0) + (b.volume || 0); continue; }
    out.push({ timestamp: b.timestamp, open: o, high: Math.max(o, b.close), low: Math.min(o, b.close), close: b.close, volume: b.volume });
  }
  return out;
}
/* Kagi — היפוך כשהמחיר חוזר בשיעור rev (ברירת מחדל 4% — כמו ב־TradingView: ATR או אחוז). מוצג כנרות "קו" */
export function kagi(bars, rev) {
  rev = rev || 0.04;
  if (!bars.length) return [];
  const out = [];
  let dir = 0, ext = bars[0].close, start = bars[0].close, ts = bars[0].timestamp;
  for (const b of bars) {
    const c = b.close;
    if (dir >= 0 && c > ext) { ext = c; ts = b.timestamp; dir = 1; continue; }
    if (dir <= 0 && c < ext) { ext = c; ts = b.timestamp; dir = -1; continue; }
    if ((dir === 1 && c <= ext * (1 - rev)) || (dir === -1 && c >= ext * (1 + rev))) {
      out.push({ timestamp: ts, open: start, high: Math.max(start, ext), low: Math.min(start, ext), close: ext, volume: 0 });
      start = ext; ext = c; ts = b.timestamp; dir = -dir;
    }
  }
  out.push({ timestamp: Math.max(ts, out.length ? out[out.length - 1].timestamp + 1 : ts), open: start, high: Math.max(start, ext), low: Math.min(start, ext), close: ext, volume: 0 });
  return out;
}

/* ---------- מתמטיקה בסיסית (מערכים של מספרים; חסר = undefined) ---------- */
const last = (a) => (a.length ? a[a.length - 1] : undefined);
export function sma(src, n) {
  const out = new Array(src.length);
  let s = 0, k = 0;
  for (let i = 0; i < src.length; i++) {
    const v = src[i];
    if (v == null) { out[i] = undefined; continue; }
    s += v; k++;
    if (k > n) { s -= src[i - n]; k = n; }
    out[i] = k === n ? s / n : undefined;
  }
  return out;
}
export function ema(src, n) {
  const out = new Array(src.length), a = 2 / (n + 1);
  let p, seed = 0, k = 0;
  for (let i = 0; i < src.length; i++) {
    const v = src[i];
    if (v == null) { out[i] = undefined; continue; }
    if (p === undefined) { seed += v; k++; if (k === n) p = seed / n; out[i] = p; continue; }
    p = v * a + p * (1 - a); out[i] = p;
  }
  return out;
}
export function rma(src, n) {   // Wilder (RSI, ATR, ADX)
  const out = new Array(src.length);
  let p, seed = 0, k = 0;
  for (let i = 0; i < src.length; i++) {
    const v = src[i];
    if (v == null) { out[i] = undefined; continue; }
    if (p === undefined) { seed += v; k++; if (k === n) p = seed / n; out[i] = p; continue; }
    p = (p * (n - 1) + v) / n; out[i] = p;
  }
  return out;
}
export function wma(src, n) {
  const out = new Array(src.length), den = n * (n + 1) / 2;
  for (let i = 0; i < src.length; i++) {
    if (i < n - 1) { out[i] = undefined; continue; }
    let s = 0, ok = true;
    for (let j = 0; j < n; j++) { const v = src[i - j]; if (v == null) { ok = false; break; } s += v * (n - j); }
    out[i] = ok ? s / den : undefined;
  }
  return out;
}
export function hma(src, n) {
  const a = wma(src, Math.max(1, Math.round(n / 2))), b = wma(src, n);
  return wma(a.map((x, i) => (x == null || b[i] == null ? undefined : 2 * x - b[i])), Math.max(1, Math.round(Math.sqrt(n))));
}
const subArr = (a, b) => a.map((x, i) => (x == null || b[i] == null ? undefined : x - b[i]));
export function dema(src, n) { const e = ema(src, n), e2 = ema(e, n); return e.map((x, i) => (x == null || e2[i] == null ? undefined : 2 * x - e2[i])); }
export function tema(src, n) { const e = ema(src, n), e2 = ema(e, n), e3 = ema(e2, n); return e.map((x, i) => (e3[i] == null ? undefined : 3 * x - 3 * e2[i] + e3[i])); }
export function stdev(src, n) {
  const m = sma(src, n);
  return src.map((_, i) => {
    if (m[i] == null) return undefined;
    let s = 0;
    for (let j = 0; j < n; j++) s += (src[i - j] - m[i]) ** 2;
    return Math.sqrt(s / n);
  });
}
/* מקסימום/מינימום מתגלגל: חלון הזזה עם תור מונוטוני — O(n) לכל המערך במקום O(n·k) (נמדד: הפונקציה החמה ביותר בכל טיק).
   מחושב פעם אחת לכל (מערך, n) ונשמר ב־WeakMap — הקריאות לפי אינדקס נשארות כמו שהיו */
const ROLL = new WeakMap();
function rolling(a, n, max) {
  let per = ROLL.get(a);
  if (!per) { per = new Map(); ROLL.set(a, per); }
  const key = max ? n : -n;
  let out = per.get(key);
  if (out) return out;
  out = new Array(a.length);
  const dq = [];
  let head = 0;
  for (let i = 0; i < a.length; i++) {
    const v = a[i];
    if (v != null && !Number.isNaN(v)) {
      while (dq.length > head && (max ? a[dq[dq.length - 1]] <= v : a[dq[dq.length - 1]] >= v)) dq.pop();
      dq.push(i);
    }
    while (dq.length > head && dq[head] <= i - n) head++;
    out[i] = dq.length > head ? a[dq[head]] : (max ? -Infinity : Infinity);
  }
  per.set(key, out);
  return out;
}
const hiN = (a, i, n) => rolling(a, n, true)[i];
const loN = (a, i, n) => rolling(a, n, false)[i];
export function trueRange(bars) { return bars.map((b, i) => (i ? Math.max(b.high - b.low, Math.abs(b.high - bars[i - 1].close), Math.abs(b.low - bars[i - 1].close)) : b.high - b.low)); }
export function atr(bars, n) { return rma(trueRange(bars), n); }
const col = (bars, k) => bars.map((b) => b[k]);
const hl2 = (bars) => bars.map((b) => (b.high + b.low) / 2);
const hlc3 = (bars) => bars.map((b) => (b.high + b.low + b.close) / 3);
export function rsi(src, n) {
  const up = [undefined], dn = [undefined];
  for (let i = 1; i < src.length; i++) { const d = src[i] - src[i - 1]; up.push(Math.max(d, 0)); dn.push(Math.max(-d, 0)); }
  const u = rma(up, n), d = rma(dn, n);
  return u.map((x, i) => (x == null || d[i] == null ? undefined : d[i] === 0 ? 100 : 100 - 100 / (1 + x / d[i])));
}
export function linreg(src, n, i) {   // ערך קו הרגרסיה בנקודה i (מקדם ושיפוע) על n הערכים האחרונים
  let sx = 0, sy = 0, sxy = 0, sxx = 0;
  for (let j = 0; j < n; j++) { const x = j, y = src[i - n + 1 + j]; sx += x; sy += y; sxy += x * y; sxx += x * x; }
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx || 1);
  const icpt = (sy - slope * sx) / n;
  return { slope, icpt, end: icpt + slope * (n - 1) };
}

/* ---------- אינדיקטורים (מעבר ל־27 המובנים של KLineChart) ----------
   כל אחד: f(bars, params) → מערך אובייקטים. IND = הקטלוג: שם, קבוצה, פרמטרים, קווים, האם על הגרף הראשי. */
const zipObj = (keys, arrs) => arrs[0].map((_, i) => { const o = {}; keys.forEach((k, j) => { if (arrs[j][i] != null && isFinite(arrs[j][i])) o[k] = arrs[j][i]; }); return o; });

export const CALC = {
  /* VWAP לכל סשן (תוך־יומי: מתאפס כל יום; יומי ומעלה: מצטבר מתחילת התצוגה) + רצועות סטיית תקן */
  VWAP(bars, [m1 = 1, m2 = 2], ctx) {
    let pv = 0, vv = 0, pv2 = 0, prev = null;
    const dayKey = (ctx && ctx.dayKey) || ((t) => Math.floor(t / 86400000));
    return bars.map((b) => {
      const k = dayKey(b.timestamp);
      if (ctx && ctx.intra && k !== prev) { pv = 0; vv = 0; pv2 = 0; }
      prev = k;
      const tp = (b.high + b.low + b.close) / 3, v = b.volume || 0;
      pv += tp * v; vv += v; pv2 += tp * tp * v;
      if (!vv) return {};
      const w = pv / vv, sd = Math.sqrt(Math.max(0, pv2 / vv - w * w));
      return { vwap: w, up1: w + m1 * sd, dn1: w - m1 * sd, up2: w + m2 * sd, dn2: w - m2 * sd };
    });
  },
  WMA(bars, [n = 20]) { return wma(col(bars, 'close'), n).map((v) => ({ wma: v })); },
  HMA(bars, [n = 21]) { return hma(col(bars, 'close'), n).map((v) => ({ hma: v })); },
  DEMA(bars, [n = 21]) { return dema(col(bars, 'close'), n).map((v) => ({ dema: v })); },
  TEMA(bars, [n = 21]) { return tema(col(bars, 'close'), n).map((v) => ({ tema: v })); },
  VWMA(bars, [n = 20]) {
    const pv = sma(bars.map((b) => b.close * (b.volume || 0)), n), v = sma(col(bars, 'volume'), n);
    return pv.map((x, i) => ({ vwma: x != null && v[i] ? x / v[i] : undefined }));
  },
  RIBBON(bars, ns) {
    const c = col(bars, 'close'), arrs = (ns.length ? ns : [8, 13, 21, 34, 55, 89]).map((n) => ema(c, n));
    return zipObj(arrs.map((_, i) => 'e' + i), arrs);
  },
  SUPERTREND(bars, [n = 10, m = 3]) {
    const a = atr(bars, n), out = [];
    let up = null, dn = null, dir = 1;
    for (let i = 0; i < bars.length; i++) {
      if (a[i] == null) { out.push({}); continue; }
      const mid = (bars[i].high + bars[i].low) / 2, pc = i ? bars[i - 1].close : bars[i].close;
      let u = mid - m * a[i], d = mid + m * a[i];
      if (up != null && pc > up) u = Math.max(u, up);
      if (dn != null && pc < dn) d = Math.min(d, dn);
      if (dn != null && bars[i].close > dn) dir = 1; else if (up != null && bars[i].close < up) dir = -1;
      up = u; dn = d;
      out.push(dir === 1 ? { up: u } : { dn: d });
    }
    return out;
  },
  ICHIMOKU(bars, [t = 9, k = 26, s = 52]) {
    const H = col(bars, 'high'), L = col(bars, 'low'), C = col(bars, 'close');
    const mid = (i, n) => (i >= n - 1 ? (hiN(H, i, n) + loN(L, i, n)) / 2 : undefined);
    const out = bars.map(() => ({}));
    for (let i = 0; i < bars.length; i++) {
      const tk = mid(i, t), kj = mid(i, k);
      if (tk != null) out[i].tenkan = tk;
      if (kj != null) out[i].kijun = kj;
      if (i - k + 1 >= 0) out[i - k + 1].chikou = C[i];
      // הענן מוזז קדימה k נרות — על נרות קיימים בלבד (KLineChart לא מצייר אחרי הנר האחרון)
      const j = i + k - 1;
      if (j < bars.length) {
        if (tk != null && kj != null) out[j].spanA = (tk + kj) / 2;
        const sb = mid(i, s);
        if (sb != null) out[j].spanB = sb;
      }
    }
    return out;
  },
  KELTNER(bars, [n = 20, m = 2]) {
    const e = ema(col(bars, 'close'), n), a = atr(bars, n);
    return e.map((x, i) => (x == null || a[i] == null ? {} : { mid: x, up: x + m * a[i], dn: x - m * a[i] }));
  },
  DONCHIAN(bars, [n = 20]) {
    const H = col(bars, 'high'), L = col(bars, 'low');
    return bars.map((_, i) => (i < n - 1 ? {} : { up: hiN(H, i, n), dn: loN(L, i, n), mid: (hiN(H, i, n) + loN(L, i, n)) / 2 }));
  },
  ENVELOPE(bars, [n = 20, p = 2.5]) { return sma(col(bars, 'close'), n).map((x) => (x == null ? {} : { mid: x, up: x * (1 + p / 100), dn: x * (1 - p / 100) })); },
  ALLIGATOR(bars, [j = 13, t = 8, l = 5]) {
    const m = hl2(bars), J = rma(m, j), T = rma(m, t), L = rma(m, l), out = bars.map(() => ({}));
    for (let i = 0; i < bars.length; i++) {
      if (J[i] != null && i + 8 < bars.length) out[i + 8].jaw = J[i];
      if (T[i] != null && i + 5 < bars.length) out[i + 5].teeth = T[i];
      if (L[i] != null && i + 3 < bars.length) out[i + 3].lips = L[i];
    }
    return out;
  },
  CHANDELIER(bars, [n = 22, m = 3]) {
    const a = atr(bars, n), H = col(bars, 'high'), L = col(bars, 'low');
    return bars.map((_, i) => (a[i] == null ? {} : { long: hiN(H, i, n) - m * a[i], short: loN(L, i, n) + m * a[i] }));
  },
  PIVOTS(bars, [kind = 0], ctx) {   // נקודות ציר יומיות קלאסיות (0) / פיבונאצ'י (1) / Camarilla (2) — מהיום הקודם
    const dayKey = (ctx && ctx.dayKey) || ((t) => Math.floor(t / 86400000));
    const days = [];
    for (const b of bars) {
      const k = dayKey(b.timestamp), d = days[days.length - 1];
      if (!d || d.k !== k) days.push({ k, h: b.high, l: b.low, c: b.close }); else { d.h = Math.max(d.h, b.high); d.l = Math.min(d.l, b.low); d.c = b.close; }
    }
    const lv = {};
    for (let i = 1; i < days.length; i++) {
      const { h, l, c } = days[i - 1], p = (h + l + c) / 3, r = h - l;
      lv[days[i].k] = kind === 1 ? { p, r1: p + 0.382 * r, r2: p + 0.618 * r, r3: p + r, s1: p - 0.382 * r, s2: p - 0.618 * r, s3: p - r }
        : kind === 2 ? { p, r1: c + r * 1.1 / 12, r2: c + r * 1.1 / 6, r3: c + r * 1.1 / 4, s1: c - r * 1.1 / 12, s2: c - r * 1.1 / 6, s3: c - r * 1.1 / 4 }
          : { p, r1: 2 * p - l, r2: p + r, r3: h + 2 * (p - l), s1: 2 * p - h, s2: p - r, s3: l - 2 * (h - p) };
    }
    return bars.map((b) => lv[dayKey(b.timestamp)] || {});
  },
  LINREG(bars, [n = 100, m = 2]) {   // ערוץ רגרסיה לינארית על n הנרות האחרונים (כמו Linear Regression Channel)
    const c = col(bars, 'close'), out = bars.map(() => ({}));
    if (bars.length < n) return out;
    const r = linreg(c, n, bars.length - 1);
    let s = 0;
    for (let j = 0; j < n; j++) s += (c[bars.length - n + j] - (r.icpt + r.slope * j)) ** 2;
    const sd = Math.sqrt(s / n);
    for (let j = 0; j < n; j++) { const v = r.icpt + r.slope * j; out[bars.length - n + j] = { mid: v, up: v + m * sd, dn: v - m * sd }; }
    return out;
  },
  ZIGZAG(bars, [p = 5]) {
    const sw = zigzag(bars, p / 100), out = bars.map(() => ({}));
    for (const s of sw) out[s.i].zz = s.price;
    // קו רציף: אינטרפולציה בין נקודות המפנה
    for (let k = 1; k < sw.length; k++) {
      const a = sw[k - 1], b = sw[k];
      for (let i = a.i; i <= b.i; i++) out[i].zz = a.price + (b.price - a.price) * (i - a.i) / ((b.i - a.i) || 1);
    }
    return out;
  },
  /* ---- מתנדים (חלונית נפרדת) ---- */
  ATR(bars, [n = 14]) { return atr(bars, n).map((v) => ({ atr: v })); },
  ADX(bars, [n = 14]) {
    const pdm = [undefined], mdm = [undefined];
    for (let i = 1; i < bars.length; i++) {
      const u = bars[i].high - bars[i - 1].high, d = bars[i - 1].low - bars[i].low;
      pdm.push(u > d && u > 0 ? u : 0); mdm.push(d > u && d > 0 ? d : 0);
    }
    const tr = rma(trueRange(bars).map((x, i) => (i ? x : undefined)), n), p = rma(pdm, n), m = rma(mdm, n);
    const pdi = p.map((x, i) => (x == null || !tr[i] ? undefined : 100 * x / tr[i])), mdi = m.map((x, i) => (x == null || !tr[i] ? undefined : 100 * x / tr[i]));
    const dx = pdi.map((x, i) => (x == null || mdi[i] == null ? undefined : (x + mdi[i] ? 100 * Math.abs(x - mdi[i]) / (x + mdi[i]) : 0)));
    return zipObj(['adx', 'pdi', 'mdi'], [rma(dx, n), pdi, mdi]);
  },
  STOCH(bars, [n = 14, k = 3, d = 3]) {
    const H = col(bars, 'high'), L = col(bars, 'low');
    const raw = bars.map((b, i) => { if (i < n - 1) return undefined; const h = hiN(H, i, n), l = loN(L, i, n); return h === l ? 50 : 100 * (b.close - l) / (h - l); });
    const K = sma(raw, k);
    return zipObj(['k', 'd'], [K, sma(K, d)]);
  },
  STOCHRSI(bars, [r = 14, s = 14, k = 3, d = 3]) {
    const R = rsi(col(bars, 'close'), r);
    const raw = R.map((x, i) => {
      if (x == null || i < s - 1 || R[i - s + 1] == null) return undefined;
      const w = R.slice(i - s + 1, i + 1), h = Math.max(...w), l = Math.min(...w);
      return h === l ? 50 : 100 * (x - l) / (h - l);
    });
    const K = sma(raw, k);
    return zipObj(['k', 'd'], [K, sma(K, d)]);
  },
  MFI(bars, [n = 14]) {
    const tp = hlc3(bars), out = [];
    for (let i = 0; i < bars.length; i++) {
      if (i < n) { out.push({}); continue; }
      let p = 0, m = 0;
      for (let j = i - n + 1; j <= i; j++) { const f = tp[j] * (bars[j].volume || 0); if (tp[j] > tp[j - 1]) p += f; else if (tp[j] < tp[j - 1]) m += f; }
      out.push({ mfi: m === 0 ? 100 : 100 - 100 / (1 + p / m) });
    }
    return out;
  },
  CMF(bars, [n = 20]) {
    const mfv = bars.map((b) => (b.high === b.low ? 0 : ((b.close - b.low) - (b.high - b.close)) / (b.high - b.low) * (b.volume || 0)));
    const a = sma(mfv, n), v = sma(col(bars, 'volume'), n);
    return a.map((x, i) => ({ cmf: x != null && v[i] ? x / v[i] : undefined }));
  },
  AROON(bars, [n = 25]) {
    return bars.map((_, i) => {
      if (i < n) return {};
      let hi = i, lo = i;
      for (let j = i - n; j <= i; j++) { if (bars[j].high >= bars[hi].high) hi = j; if (bars[j].low <= bars[lo].low) lo = j; }
      return { up: 100 * (n - (i - hi)) / n, dn: 100 * (n - (i - lo)) / n };
    });
  },
  CMO(bars, [n = 9]) {
    const c = col(bars, 'close');
    return c.map((_, i) => {
      if (i < n) return {};
      let u = 0, d = 0;
      for (let j = i - n + 1; j <= i; j++) { const x = c[j] - c[j - 1]; if (x > 0) u += x; else d -= x; }
      return { cmo: u + d ? 100 * (u - d) / (u + d) : 0 };
    });
  },
  ULTOSC(bars, [a = 7, b = 14, c = 28]) {
    const bp = [], tr = [];
    bars.forEach((x, i) => { const pc = i ? bars[i - 1].close : x.close; bp.push(x.close - Math.min(x.low, pc)); tr.push(Math.max(x.high, pc) - Math.min(x.low, pc)); });
    const s = (arr, i, n) => { let t = 0; for (let j = i - n + 1; j <= i; j++) t += arr[j]; return t; };
    return bars.map((_, i) => (i < c ? {} : { uo: 100 * (4 * s(bp, i, a) / s(tr, i, a) + 2 * s(bp, i, b) / s(tr, i, b) + s(bp, i, c) / s(tr, i, c)) / 7 }));
  },
  TSI(bars, [l = 25, s = 13, g = 13]) {
    const c = col(bars, 'close'), m = c.map((x, i) => (i ? x - c[i - 1] : undefined));
    const n1 = ema(ema(m, l), s), d1 = ema(ema(m.map((x) => (x == null ? undefined : Math.abs(x))), l), s);
    const t = n1.map((x, i) => (x == null || !d1[i] ? undefined : 100 * x / d1[i]));
    return zipObj(['tsi', 'sig'], [t, ema(t, g)]);
  },
  COPPOCK(bars, [w = 10, l = 14, s = 11]) {
    const c = col(bars, 'close'), roc = (n) => c.map((x, i) => (i >= n ? 100 * (x / c[i - n] - 1) : undefined));
    const a = roc(l), b = roc(s);
    return wma(a.map((x, i) => (x == null || b[i] == null ? undefined : x + b[i])), w).map((v) => ({ cop: v }));
  },
  FISHER(bars, [n = 9]) {
    const m = hl2(bars), out = [];
    let v = 0, f = 0;
    for (let i = 0; i < bars.length; i++) {
      if (i < n - 1) { out.push({}); continue; }
      const h = hiN(m, i, n), l = loN(m, i, n);
      v = 0.66 * ((h === l ? 0 : (m[i] - l) / (h - l)) - 0.5) + 0.67 * v;
      v = Math.max(-0.999, Math.min(0.999, v));
      const pf = f;
      f = 0.5 * Math.log((1 + v) / (1 - v)) + 0.5 * f;
      out.push({ fish: f, trig: pf });
    }
    return out;
  },
  CHOP(bars, [n = 14]) {
    const tr = trueRange(bars), H = col(bars, 'high'), L = col(bars, 'low');
    return bars.map((_, i) => {
      if (i < n) return {};
      let s = 0; for (let j = i - n + 1; j <= i; j++) s += tr[j];
      const r = hiN(H, i, n) - loN(L, i, n);
      return { chop: r > 0 ? 100 * Math.log10(s / r) / Math.log10(n) : undefined };
    });
  },
  HV(bars, [n = 20, ann = 252]) {
    const c = col(bars, 'close'), lr = c.map((x, i) => (i ? Math.log(x / c[i - 1]) : undefined));
    return stdev(lr, n).map((v) => ({ hv: v == null ? undefined : v * Math.sqrt(ann) * 100 }));
  },
  /* TTM Squeeze (John Carter) — הבולינגר בתוך הקלטנר = "סחיטה"; המומנטום = רגרסיה של המחיר מול ממוצע ערוץ דונצ'יאן+SMA */
  SQUEEZE(bars, [n = 20, bm = 2, km = 1.5]) {
    const c = col(bars, 'close'), m = sma(c, n), sd = stdev(c, n), a = atr(bars, n), H = col(bars, 'high'), L = col(bars, 'low');
    const dev = c.map((x, i) => (i < n - 1 || m[i] == null ? undefined : x - ((hiN(H, i, n) + loN(L, i, n)) / 2 + m[i]) / 2));
    return bars.map((_, i) => {
      if (m[i] == null || a[i] == null || i < 2 * n - 2) return {};
      const on = m[i] - bm * sd[i] > m[i] - km * a[i] && m[i] + bm * sd[i] < m[i] + km * a[i];
      const mom = linreg(dev, n, i).end;
      return { mom, sq: on ? 0 : undefined, rel: on ? undefined : 0 };
    });
  },
  ELDER(bars, [n = 13]) {
    const e = ema(col(bars, 'close'), n);
    return bars.map((b, i) => (e[i] == null ? {} : { bull: b.high - e[i], bear: b.low - e[i] }));
  },
  VORTEX(bars, [n = 14]) {
    const tr = trueRange(bars);
    return bars.map((_, i) => {
      if (i < n) return {};
      let p = 0, m = 0, t = 0;
      for (let j = i - n + 1; j <= i; j++) { p += Math.abs(bars[j].high - bars[j - 1].low); m += Math.abs(bars[j].low - bars[j - 1].high); t += tr[j]; }
      return { vip: p / t, vim: m / t };
    });
  },
  PPO(bars, [f = 12, s = 26, g = 9]) {
    const c = col(bars, 'close'), a = ema(c, f), b = ema(c, s);
    const p = a.map((x, i) => (x == null || !b[i] ? undefined : 100 * (x - b[i]) / b[i])), sg = ema(p, g);
    return p.map((x, i) => ({ ppo: x, sig: sg[i], hist: x != null && sg[i] != null ? x - sg[i] : undefined }));
  },
  DPO(bars, [n = 20]) {
    const c = col(bars, 'close'), m = sma(c, n), sh = Math.floor(n / 2) + 1;
    return c.map((x, i) => ({ dpo: i - sh >= 0 && m[i] != null ? c[i - sh] - m[i] : undefined }));
  },
  KST(bars) {
    const c = col(bars, 'close'), roc = (n) => c.map((x, i) => (i >= n ? 100 * (x / c[i - n] - 1) : undefined));
    const r = [[10, 10], [15, 10], [20, 10], [30, 15]].map(([a, b]) => sma(roc(a), b));
    const k = c.map((_, i) => (r.some((x) => x[i] == null) ? undefined : r[0][i] + 2 * r[1][i] + 3 * r[2][i] + 4 * r[3][i]));
    return zipObj(['kst', 'sig'], [k, sma(k, 9)]);
  },
  MASS(bars, [n = 25]) {
    const r = bars.map((b) => b.high - b.low), e1 = ema(r, 9), e2 = ema(e1, 9), q = e1.map((x, i) => (x == null || !e2[i] ? undefined : x / e2[i]));
    return q.map((_, i) => { if (i < n - 1) return {}; let s = 0; for (let j = i - n + 1; j <= i; j++) { if (q[j] == null) return {}; s += q[j]; } return { mi: s }; });
  },
  BOP(bars, [n = 14]) { return sma(bars.map((b) => (b.high === b.low ? 0 : (b.close - b.open) / (b.high - b.low))), n).map((v) => ({ bop: v })); },
  AD(bars) {
    let s = 0;
    return bars.map((b) => { s += b.high === b.low ? 0 : ((b.close - b.low) - (b.high - b.close)) / (b.high - b.low) * (b.volume || 0); return { ad: s }; });
  },
  CHAIKIN(bars, [f = 3, sl = 10]) {
    const ad = CALC.AD(bars).map((x) => x.ad), a = ema(ad, f), b = ema(ad, sl);
    return a.map((x, i) => ({ co: x != null && b[i] != null ? x - b[i] : undefined }));
  },
  FORCE(bars, [n = 13]) { return ema(bars.map((b, i) => (i ? (b.close - bars[i - 1].close) * (b.volume || 0) : undefined)), n).map((v) => ({ fi: v })); },
  RVOL(bars, [n = 20]) {   // נפח יחסי — נפח הנר מול הממוצע (ציד פריצות)
    const v = col(bars, 'volume'), m = sma(v, n);
    return v.map((x, i) => ({ rvol: i && m[i - 1] ? x / m[i - 1] : undefined }));
  },
  ZSCORE(bars, [n = 20]) {
    const c = col(bars, 'close'), m = sma(c, n), sd = stdev(c, n);
    return c.map((x, i) => ({ z: m[i] != null && sd[i] ? (x - m[i]) / sd[i] : undefined }));
  },
  /* חוזק יחסי מול מדד (TrendSpider/IBD): היחס בין המניה למדד, מנורמל ל־100 בתחילת התצוגה. ctx.cmp = נרות המדד */
  RS(bars, [n = 50], ctx) {
    const cmp = ctx && ctx.cmp;
    if (!cmp || !cmp.length) return bars.map(() => ({}));
    const map = new Map(cmp.map((b) => [b.timestamp, b.close]));
    let base = null, lastC = null;
    const r = bars.map((b) => {
      const c = map.has(b.timestamp) ? map.get(b.timestamp) : lastC;
      if (c == null) return undefined;
      lastC = c;
      const v = b.close / c;
      if (base == null) base = v;
      return 100 * v / base;
    });
    return zipObj(['rs', 'ma'], [r, sma(r, n)]);
  },
};

/* הקטלוג: g = קבוצה (trend/osc/vol/volume/ai), main = על הגרף הראשי, p = פרמטרים (שם, ברירת מחדל), f = קווים [מפתח, כותרת, סוג?] */
export const IND = {
  VWAP: { g: 'vol', main: 1, p: [['×σ1', 1], ['×σ2', 2]], f: [['vwap', 'VWAP'], ['up1', '+1'], ['dn1', '-1'], ['up2', '+2'], ['dn2', '-2']], ctx: 1 },
  WMA: { g: 'trend', main: 1, p: [['n', 20]], f: [['wma', 'WMA']] },
  HMA: { g: 'trend', main: 1, p: [['n', 21]], f: [['hma', 'HMA']] },
  DEMA: { g: 'trend', main: 1, p: [['n', 21]], f: [['dema', 'DEMA']] },
  TEMA: { g: 'trend', main: 1, p: [['n', 21]], f: [['tema', 'TEMA']] },
  VWMA: { g: 'trend', main: 1, p: [['n', 20]], f: [['vwma', 'VWMA']] },
  RIBBON: { g: 'trend', main: 1, p: [['1', 8], ['2', 13], ['3', 21], ['4', 34], ['5', 55], ['6', 89]], f: [0, 1, 2, 3, 4, 5].map((i) => ['e' + i, 'EMA' + (i + 1)]) },
  SUPERTREND: { g: 'trend', main: 1, p: [['ATR', 10], ['×', 3]], f: [['up', 'Up'], ['dn', 'Down']] },
  ICHIMOKU: { g: 'trend', main: 1, p: [['Tenkan', 9], ['Kijun', 26], ['Senkou B', 52]], f: [['tenkan', 'Tenkan'], ['kijun', 'Kijun'], ['chikou', 'Chikou'], ['spanA', 'Span A'], ['spanB', 'Span B']] },
  KELTNER: { g: 'vol', main: 1, p: [['n', 20], ['×ATR', 2]], f: [['up', 'Up'], ['mid', 'Mid'], ['dn', 'Down']] },
  DONCHIAN: { g: 'vol', main: 1, p: [['n', 20]], f: [['up', 'Up'], ['mid', 'Mid'], ['dn', 'Down']] },
  ENVELOPE: { g: 'vol', main: 1, p: [['n', 20], ['%', 2.5]], f: [['up', 'Up'], ['mid', 'Mid'], ['dn', 'Down']] },
  ALLIGATOR: { g: 'trend', main: 1, p: [['Jaw', 13], ['Teeth', 8], ['Lips', 5]], f: [['jaw', 'Jaw'], ['teeth', 'Teeth'], ['lips', 'Lips']] },
  CHANDELIER: { g: 'vol', main: 1, p: [['n', 22], ['×ATR', 3]], f: [['long', 'Long stop'], ['short', 'Short stop']] },
  PIVOTS: { g: 'trend', main: 1, p: [['0/1/2', 0]], f: [['r3', 'R3'], ['r2', 'R2'], ['r1', 'R1'], ['p', 'P'], ['s1', 'S1'], ['s2', 'S2'], ['s3', 'S3']], ctx: 1 },
  LINREG: { g: 'trend', main: 1, p: [['n', 100], ['×σ', 2]], f: [['up', 'Up'], ['mid', 'Mid'], ['dn', 'Down']] },
  ZIGZAG: { g: 'trend', main: 1, p: [['%', 5]], f: [['zz', 'ZigZag']] },
  ATR: { g: 'vol', p: [['n', 14]], f: [['atr', 'ATR']] },
  ADX: { g: 'trend', p: [['n', 14]], f: [['adx', 'ADX'], ['pdi', '+DI'], ['mdi', '-DI']] },
  STOCH: { g: 'osc', p: [['%K', 14], ['K', 3], ['D', 3]], f: [['k', '%K'], ['d', '%D']], lv: [80, 20] },
  STOCHRSI: { g: 'osc', p: [['RSI', 14], ['Stoch', 14], ['K', 3], ['D', 3]], f: [['k', '%K'], ['d', '%D']], lv: [80, 20] },
  MFI: { g: 'volume', p: [['n', 14]], f: [['mfi', 'MFI']], lv: [80, 20] },
  CMF: { g: 'volume', p: [['n', 20]], f: [['cmf', 'CMF']], lv: [0] },
  AROON: { g: 'trend', p: [['n', 25]], f: [['up', 'Up'], ['dn', 'Down']] },
  CMO: { g: 'osc', p: [['n', 9]], f: [['cmo', 'CMO']], lv: [50, -50] },
  ULTOSC: { g: 'osc', p: [['1', 7], ['2', 14], ['3', 28]], f: [['uo', 'UO']], lv: [70, 30] },
  TSI: { g: 'osc', p: [['Long', 25], ['Short', 13], ['Signal', 13]], f: [['tsi', 'TSI'], ['sig', 'Signal']], lv: [0] },
  COPPOCK: { g: 'osc', p: [['WMA', 10], ['Long', 14], ['Short', 11]], f: [['cop', 'Coppock']], lv: [0] },
  FISHER: { g: 'osc', p: [['n', 9]], f: [['fish', 'Fisher'], ['trig', 'Trigger']] },
  CHOP: { g: 'vol', p: [['n', 14]], f: [['chop', 'CHOP']], lv: [61.8, 38.2] },
  HV: { g: 'vol', p: [['n', 20], ['Year', 252]], f: [['hv', 'HV %']] },
  SQUEEZE: { g: 'vol', p: [['n', 20], ['BB×', 2], ['KC×', 1.5]], f: [['mom', 'Momentum', 'bar'], ['sq', 'Squeeze', 'circle'], ['rel', 'Release', 'circle']] },
  ELDER: { g: 'osc', p: [['n', 13]], f: [['bull', 'Bull', 'bar'], ['bear', 'Bear', 'bar']] },
  VORTEX: { g: 'trend', p: [['n', 14]], f: [['vip', 'VI+'], ['vim', 'VI-']] },
  PPO: { g: 'osc', p: [['Fast', 12], ['Slow', 26], ['Signal', 9]], f: [['ppo', 'PPO'], ['sig', 'Signal'], ['hist', 'Hist', 'bar']] },
  DPO: { g: 'osc', p: [['n', 20]], f: [['dpo', 'DPO']], lv: [0] },
  KST: { g: 'osc', p: [], f: [['kst', 'KST'], ['sig', 'Signal']], lv: [0] },
  MASS: { g: 'vol', p: [['n', 25]], f: [['mi', 'Mass']], lv: [27, 26.5] },
  BOP: { g: 'osc', p: [['n', 14]], f: [['bop', 'BOP']], lv: [0] },
  AD: { g: 'volume', p: [], f: [['ad', 'A/D']] },
  CHAIKIN: { g: 'volume', p: [['Fast', 3], ['Slow', 10]], f: [['co', 'Chaikin']], lv: [0] },
  FORCE: { g: 'volume', p: [['n', 13]], f: [['fi', 'Force']], lv: [0] },
  RVOL: { g: 'volume', p: [['n', 20]], f: [['rvol', 'RVOL', 'bar']], lv: [1] },
  ZSCORE: { g: 'osc', p: [['n', 20]], f: [['z', 'Z']], lv: [2, 0, -2] },
  RS: { g: 'trend', p: [['MA', 50]], f: [['rs', 'RS'], ['ma', 'MA']], ctx: 1 },
};

/* ---------- ניתוח אוטומטי (TrendSpider / Autochartist — מה ש־TradingView לא עושה לבד) ---------- */

/* נקודות מפנה (swing): גבוה/נמוך שהוא הקיצון מבין k נרות מכל צד */
export function swings(bars, k) {
  k = k || 5;
  const out = [];
  for (let i = k; i < bars.length - k; i++) {
    let hi = true, lo = true;
    for (let j = i - k; j <= i + k; j++) {
      if (j === i) continue;
      if (bars[j].high >= bars[i].high) hi = false;
      if (bars[j].low <= bars[i].low) lo = false;
    }
    if (hi) out.push({ i, t: bars[i].timestamp, price: bars[i].high, hi: true });
    if (lo) out.push({ i, t: bars[i].timestamp, price: bars[i].low, hi: false });
  }
  return out;
}
/* ZigZag: מפנים לפי אחוז שינוי מינימלי — בסיס לפיבונאצ'י האוטומטי ולגלי אליוט */
export function zigzag(bars, pct) {
  if (bars.length < 2) return [];
  const pts = [];
  let dir = 0, hiI = 0, loI = 0;
  for (let i = 1; i < bars.length; i++) {
    const b = bars[i];
    if (dir === 0) {
      if (b.high > bars[hiI].high) hiI = i;
      if (b.low < bars[loI].low) loI = i;
      if (hiI > loI && bars[hiI].high >= bars[loI].low * (1 + pct)) { pts.push({ i: loI, price: bars[loI].low, hi: false }); dir = 1; }
      else if (loI > hiI && bars[loI].low <= bars[hiI].high * (1 - pct)) { pts.push({ i: hiI, price: bars[hiI].high, hi: true }); dir = -1; }
    } else if (dir === 1) {
      if (b.high >= bars[hiI].high) hiI = i;
      else if (b.low <= bars[hiI].high * (1 - pct)) { pts.push({ i: hiI, price: bars[hiI].high, hi: true }); dir = -1; loI = i; }
    } else {
      if (b.low <= bars[loI].low) loI = i;
      else if (b.high >= bars[loI].low * (1 + pct)) { pts.push({ i: loI, price: bars[loI].low, hi: false }); dir = 1; hiI = i; }
    }
  }
  // המפנה האחרון — עוד לא מאושר (כמו ZigZag של TradingView: הקו נמשך עד הקיצון הנוכחי)
  if (dir === 1) pts.push({ i: hiI, price: bars[hiI].high, hi: true }); else if (dir === -1) pts.push({ i: loI, price: bars[loI].low, hi: false });
  return pts.map((s) => Object.assign(s, { t: bars[s.i].timestamp }));
}

/* קווי מגמה אוטומטיים: מחברים שני מפנים (נמוכים עולים לתמיכה, גבוהים יורדים להתנגדות), נבחרים לפי כמה פעמים
   המחיר נגע בקו בלי לחצות אותו בסגירה. מחזיר עד max קווים: { a:{t,price}, b:{t,price}, kind:'sup'|'res', touches } */
export function autoTrendlines(bars, opt) {
  opt = opt || {};
  const k = opt.k || Math.max(3, Math.round(bars.length / 60));
  const sw = swings(bars, k), out = [];
  const tol = (last(atr(bars, 14)) || 0) * 0.35;
  for (const hi of [false, true]) {
    const pts = sw.filter((s) => s.hi === hi).slice(-14);
    const cand = [];
    for (let x = 0; x < pts.length; x++) {
      for (let y = x + 1; y < pts.length; y++) {
        const a = pts[x], b = pts[y];
        if (b.i - a.i < k * 2) continue;
        const slope = (b.price - a.price) / (b.i - a.i);
        if (hi ? slope > 0 && opt.strict : slope < 0 && opt.strict) continue;
        let touches = 0, broken = false;
        for (let i = a.i; i < bars.length; i++) {
          const v = a.price + slope * (i - a.i);
          const c = bars[i].close;
          if (hi ? c > v + tol : c < v - tol) { if (i > b.i) { broken = true; break; } if (i !== a.i && i !== b.i) { broken = true; break; } }
          if (Math.abs((hi ? bars[i].high : bars[i].low) - v) <= tol) touches++;
        }
        if (broken || touches < 2) continue;
        const endI = bars.length - 1;
        cand.push({ kind: hi ? 'res' : 'sup', touches, a: { t: a.t, price: a.price }, b: { t: bars[endI].timestamp, price: a.price + slope * (endI - a.i) }, score: touches + (b.i / bars.length) });
      }
    }
    cand.sort((p, q) => q.score - p.score);
    out.push(...cand.slice(0, opt.max || 2));
  }
  return out;
}

/* רמות תמיכה/התנגדות אוטומטיות: אשכולות של מפנים קרובים במחיר (בתוך חצי ATR), מדורגים לפי מספר הנגיעות והנפח */
export function autoLevels(bars, max) {
  if (bars.length < 20) return [];
  const sw = swings(bars, Math.max(2, Math.round(bars.length / 100)));
  const tol = (last(atr(bars, 14)) || bars[bars.length - 1].close * 0.01) * 0.5;
  const cl = [];
  for (const s of sw) {
    const c = cl.find((x) => Math.abs(x.price - s.price) <= tol);
    if (c) { c.price = (c.price * c.n + s.price) / (c.n + 1); c.n++; c.vol += bars[s.i].volume || 0; c.last = Math.max(c.last, s.i); } else cl.push({ price: s.price, n: 1, vol: bars[s.i].volume || 0, last: s.i });
  }
  const px = bars[bars.length - 1].close;
  return cl.filter((c) => c.n >= 2).sort((a, b) => (b.n - a.n) || (b.last - a.last)).slice(0, max || 6)
    .map((c) => ({ price: c.price, touches: c.n, kind: c.price >= px ? 'res' : 'sup' })).sort((a, b) => b.price - a.price);
}

/* פיבונאצ'י אוטומטי: המהלך הגדול האחרון (ZigZag לפי התנודתיות) — מהשפל לשיא או להפך */
export function autoFib(bars) {
  if (bars.length < 30) return null;
  const vol = (last(atr(bars, 14)) || 0) / bars[bars.length - 1].close;
  const zz = zigzag(bars, Math.max(0.03, vol * 6));
  if (zz.length < 3) return null;
  const a = zz[zz.length - 3], b = zz[zz.length - 2];
  return { a: { t: a.t, price: a.price }, b: { t: b.t, price: b.price }, up: b.price > a.price };
}

/* זיהוי תבניות נרות יפניים (על הנר i). מחזיר [{ i, key, dir: 1|-1|0 }] — מסומנים על הגרף כמו ב־TrendSpider/Autochartist */
export function candlePatterns(bars, from) {
  const out = [];
  const a = atr(bars, 14);
  for (let i = Math.max(from || 0, 3); i < bars.length; i++) {
    const b = bars[i], p = bars[i - 1], q = bars[i - 2];
    const body = Math.abs(b.close - b.open), range = b.high - b.low || 1e-9;
    const up = b.close > b.open, pup = p.close > p.open;
    const upper = b.high - Math.max(b.open, b.close), lower = Math.min(b.open, b.close) - b.low;
    const pbody = Math.abs(p.close - p.open);
    const big = (x) => Math.abs(x.close - x.open) > (a[i] || range) * 0.6;
    const trendDn = q.close > p.close && i >= 5 && bars[i - 5].close > p.close;
    const trendUp = q.close < p.close && i >= 5 && bars[i - 5].close < p.close;
    if (body <= range * 0.08 && range > (a[i] || 0) * 0.3) out.push({ i, key: 'doji', dir: 0 });
    else if (lower >= body * 2.2 && upper <= body * 0.6 && body > range * 0.1) out.push({ i, key: trendDn ? 'hammer' : trendUp ? 'hanging' : 'pinbar', dir: trendUp ? -1 : 1 });
    else if (upper >= body * 2.2 && lower <= body * 0.6 && body > range * 0.1) out.push({ i, key: trendUp ? 'shooting' : 'invhammer', dir: trendUp ? -1 : 1 });
    else if (body >= range * 0.92 && big(b)) out.push({ i, key: 'marubozu', dir: up ? 1 : -1 });
    if (up && !pup && b.close >= p.open && b.open <= p.close && body > pbody) out.push({ i, key: 'engulfBull', dir: 1 });
    if (!up && pup && b.open >= p.close && b.close <= p.open && body > pbody) out.push({ i, key: 'engulfBear', dir: -1 });
    if (pbody > body * 2 && Math.max(b.open, b.close) < Math.max(p.open, p.close) && Math.min(b.open, b.close) > Math.min(p.open, p.close) && big(p)) out.push({ i, key: pup ? 'haramiBear' : 'haramiBull', dir: pup ? -1 : 1 });
    if (!pup && up && big(p) && b.open < p.low && b.close > (p.open + p.close) / 2 && b.close < p.open) out.push({ i, key: 'piercing', dir: 1 });
    if (pup && !up && big(p) && b.open > p.high && b.close < (p.open + p.close) / 2 && b.close > p.open) out.push({ i, key: 'darkCloud', dir: -1 });
    const qb = Math.abs(q.close - q.open);
    if (q.close < q.open && big(q) && pbody < qb * 0.35 && up && b.close > (q.open + q.close) / 2) out.push({ i, key: 'morningStar', dir: 1 });
    if (q.close > q.open && big(q) && pbody < qb * 0.35 && !up && b.close < (q.open + q.close) / 2) out.push({ i, key: 'eveningStar', dir: -1 });
    if (up && pup && q.close > q.open && b.close > p.close && p.close > q.close && big(b) && big(p) && big(q)) out.push({ i, key: 'soldiers', dir: 1 });
    if (!up && !pup && q.close < q.open && b.close < p.close && p.close < q.close && big(b) && big(p) && big(q)) out.push({ i, key: 'crows', dir: -1 });
    if (Math.abs(b.low - p.low) <= range * 0.03 && !pup && up && trendDn) out.push({ i, key: 'tweezerBottom', dir: 1 });
    if (Math.abs(b.high - p.high) <= range * 0.03 && pup && !up && trendUp) out.push({ i, key: 'tweezerTop', dir: -1 });
  }
  return out;
}

/* תבניות גרף קלאסיות על מפני ZigZag: ראש וכתפיים (והפוך), שיא/שפל כפול, משולשים, דגל — כמו סורק התבניות של TrendSpider */
export function chartPatterns(bars) {
  const out = [];
  if (bars.length < 40) return out;
  const vol = (last(atr(bars, 14)) || 0) / bars[bars.length - 1].close;
  const z = zigzag(bars, Math.max(0.02, vol * 4));
  const near = (x, y, f) => Math.abs(x - y) <= Math.max(x, y) * (f || Math.max(0.015, vol * 1.5));
  for (let k = 4; k < z.length; k++) {
    const [p0, p1, p2, p3, p4] = z.slice(k - 4, k + 1);
    // ראש וכתפיים: כתף-ראש-כתף, הראש הקיצון, הכתפיים קרובות
    if (p0.hi === true && p2.hi === true && p4.hi === true && p2.price > p0.price && p2.price > p4.price && near(p0.price, p4.price, 0.04)) out.push({ key: 'hs', dir: -1, pts: [p0, p1, p2, p3, p4], neck: [p1, p3] });
    if (p0.hi === false && p2.hi === false && p4.hi === false && p2.price < p0.price && p2.price < p4.price && near(p0.price, p4.price, 0.04)) out.push({ key: 'ihs', dir: 1, pts: [p0, p1, p2, p3, p4], neck: [p1, p3] });
  }
  for (let k = 2; k < z.length; k++) {
    const [a, b, c] = z.slice(k - 2, k + 1);
    if (a.hi === true && c.hi === true && near(a.price, c.price) && c.i - a.i > 8) out.push({ key: 'doubleTop', dir: -1, pts: [a, b, c] });
    if (a.hi === false && c.hi === false && near(a.price, c.price) && c.i - a.i > 8) out.push({ key: 'doubleBottom', dir: 1, pts: [a, b, c] });
  }
  // משולש / יתד בסוף: ארבעת המפנים האחרונים מתכנסים
  if (z.length >= 5) {
    const t = z.slice(-5), hs = t.filter((x) => x.hi === true), ls = t.filter((x) => x.hi === false);
    if (hs.length >= 2 && ls.length >= 2) {
      const sh = (hs[hs.length - 1].price - hs[0].price) / (hs[hs.length - 1].i - hs[0].i || 1), sl = (ls[ls.length - 1].price - ls[0].price) / (ls[ls.length - 1].i - ls[0].i || 1);
      const flat = (s) => Math.abs(s) < bars[bars.length - 1].close * vol * 0.05;
      let key = null;
      if (sh < 0 && sl > 0) key = 'triSym';
      else if (flat(sh) && sl > 0) key = 'triAsc';
      else if (sh < 0 && flat(sl)) key = 'triDesc';
      else if (sh > 0 && sl > 0 && sl > sh) key = 'wedgeUp';
      else if (sh < 0 && sl < 0 && sh < sl) key = 'wedgeDn';
      if (key) out.push({ key, dir: key === 'triAsc' || key === 'wedgeDn' ? 1 : key === 'triDesc' || key === 'wedgeUp' ? -1 : 0, pts: t, hi: [hs[0], hs[hs.length - 1]], lo: [ls[0], ls[ls.length - 1]] });
    }
  }
  return out.slice(-12);
}

/* פרופיל נפח (Volume Profile) על טווח נרות: rows שורות מחיר. POC = שורת הנפח המרבי, VA = 70% מהנפח סביבו.
   הנפח של נר מתחלק לשורות שהוא חוצה (כמו "Visible Range" של TradingView); up/dn לפי צבע הנר */
export function volumeProfile(bars, rows, va) {
  rows = rows || 24; va = va || 0.7;
  if (!bars.length) return null;
  let lo = Infinity, hi = -Infinity;
  for (const b of bars) { if (b.low < lo) lo = b.low; if (b.high > hi) hi = b.high; }
  if (!(hi > lo)) return null;
  const step = (hi - lo) / rows, up = new Array(rows).fill(0), dn = new Array(rows).fill(0);
  for (const b of bars) {
    const a = Math.max(0, Math.floor((b.low - lo) / step)), z = Math.min(rows - 1, Math.floor((b.high - lo) / step));
    const share = (b.volume || 0) / (z - a + 1);
    for (let r = a; r <= z; r++) (b.close >= b.open ? up : dn)[r] += share;
  }
  const tot = up.map((u, i) => u + dn[i]), all = tot.reduce((s, x) => s + x, 0);
  let poc = 0; tot.forEach((v, i) => { if (v > tot[poc]) poc = i; });
  let l = poc, h = poc, acc = tot[poc];
  while (acc < all * va && (l > 0 || h < rows - 1)) {
    const nl = l > 0 ? tot[l - 1] : -1, nh = h < rows - 1 ? tot[h + 1] : -1;
    if (nh >= nl) { h++; acc += tot[h]; } else { l--; acc += tot[l]; }
  }
  return { lo, hi, step, up, dn, tot, poc, pocPrice: lo + step * (poc + 0.5), vah: lo + step * (h + 1), val: lo + step * l, max: tot[poc] };
}

/* עונתיות (TrendSpider/Seasonax): תשואה ממוצעת לכל חודש בשנה + אחוז השנים החיוביות, מנרות חודשיים או יומיים */
export function seasonality(bars) {
  const m = new Map();
  for (const b of bars) {
    const d = new Date(b.timestamp + 43200000), k = d.getUTCFullYear() * 12 + d.getUTCMonth();
    const x = m.get(k);
    if (!x) m.set(k, { y: d.getUTCFullYear(), mo: d.getUTCMonth(), o: b.open, c: b.close }); else x.c = b.close;
  }
  const keys = [...m.keys()].sort((a, b) => a - b), by = Array.from({ length: 12 }, () => []), years = {};
  for (let i = 0; i < keys.length; i++) {
    const x = m.get(keys[i]), prev = m.get(keys[i] - 1);
    const base = prev ? prev.c : x.o;
    const r = base ? x.c / base - 1 : 0;
    by[x.mo].push(r);
    (years[x.y] = years[x.y] || new Array(12).fill(null))[x.mo] = r;
  }
  return {
    months: by.map((a) => ({ avg: a.length ? a.reduce((s, x) => s + x, 0) / a.length : null, med: a.length ? a.slice().sort((p, q) => p - q)[Math.floor(a.length / 2)] : null, win: a.length ? a.filter((x) => x > 0).length / a.length : null, n: a.length })),
    years,
  };
}

/* קונוס תנועה צפויה (thinkorswim "Expected Move" / Probability Cone): ±1σ ו־±2σ מהתנודתיות ההיסטורית, לעתיד.
   perYear = כמה נרות בשנה בטווח הנוכחי. מחזיר נקודות לכל צעד קדימה */
export function expectedMove(bars, steps, perYear) {
  const c = bars.map((b) => b.close), n = Math.min(c.length - 1, 30);
  if (n < 5) return null;
  const lr = []; for (let i = c.length - n; i < c.length; i++) lr.push(Math.log(c[i] / c[i - 1]));
  const m = lr.reduce((s, x) => s + x, 0) / lr.length, sd = Math.sqrt(lr.reduce((s, x) => s + (x - m) ** 2, 0) / (lr.length - 1));
  const p0 = c[c.length - 1], out = [];
  for (let k = 1; k <= steps; k++) { const s = sd * Math.sqrt(k); out.push({ k, up1: p0 * Math.exp(s), dn1: p0 * Math.exp(-s), up2: p0 * Math.exp(2 * s), dn2: p0 * Math.exp(-2 * s) }); }
  return { p0, sd, annual: sd * Math.sqrt(perYear || 252), pts: out };
}

/* סטטיסטיקה לטווח נבחר (כלי המדידה): שינוי, אחוז, נרות, זמן, נפח */
export function rangeStats(bars, i0, i1) {
  if (i1 < i0) [i0, i1] = [i1, i0];
  i0 = Math.max(0, i0); i1 = Math.min(bars.length - 1, i1);
  if (i1 < i0) return null;
  const a = bars[i0], b = bars[i1];
  let vol = 0, hi = -Infinity, lo = Infinity;
  for (let i = i0; i <= i1; i++) { vol += bars[i].volume || 0; hi = Math.max(hi, bars[i].high); lo = Math.min(lo, bars[i].low); }
  return { ch: b.close - a.close, pct: a.close ? (b.close / a.close - 1) * 100 : 0, bars: i1 - i0, ms: b.timestamp - a.timestamp, vol, hi, lo };
}

/* בדיקה לאחור פשוטה (Strategy Tester בזעיר אנפין): חציית שני ממוצעים / RSI. סטטיסטיקה כמו ב־TradingView:
   רווח נקי, אחוז עסקאות מנצחות, Profit factor, ירידה מקסימלית, מספר עסקאות */
export function backtest(bars, rule) {
  const c = bars.map((b) => b.close);
  let sig;
  if (rule.kind === 'rsi') { const r = rsi(c, rule.n || 14); sig = r.map((v, i) => (i && r[i - 1] != null ? (r[i - 1] < (rule.lo || 30) && v >= (rule.lo || 30) ? 1 : r[i - 1] < (rule.hi || 70) && v >= (rule.hi || 70) ? -1 : 0) : 0)); }
  else {
    const f = (rule.ma === 'sma' ? sma : ema)(c, rule.fast || 9), s = (rule.ma === 'sma' ? sma : ema)(c, rule.slow || 21);
    sig = c.map((_, i) => (i && f[i - 1] != null && s[i - 1] != null ? (f[i - 1] <= s[i - 1] && f[i] > s[i] ? 1 : f[i - 1] >= s[i - 1] && f[i] < s[i] ? -1 : 0) : 0));
  }
  const trades = [];
  let pos = null, eq = 1, peak = 1, dd = 0;
  const curve = [];
  for (let i = 0; i < bars.length; i++) {
    if (sig[i] === 1 && !pos && i + 1 < bars.length) pos = { i: i + 1, p: bars[i + 1].open };
    else if (sig[i] === -1 && pos && i + 1 < bars.length) { const r = bars[i + 1].open / pos.p - 1; trades.push({ a: pos.i, b: i + 1, r }); eq *= 1 + r; pos = null; }
    const cur = pos ? eq * (c[i] / pos.p) : eq;
    peak = Math.max(peak, cur); dd = Math.max(dd, 1 - cur / peak);
    curve.push(cur);
  }
  if (pos) { const r = c[c.length - 1] / pos.p - 1; trades.push({ a: pos.i, b: c.length - 1, r, open: true }); eq *= 1 + r; }
  const wins = trades.filter((t) => t.r > 0), loss = trades.filter((t) => t.r <= 0);
  const gw = wins.reduce((s, t) => s + t.r, 0), gl = -loss.reduce((s, t) => s + t.r, 0);
  return { trades, net: eq - 1, win: trades.length ? wins.length / trades.length : 0, pf: gl ? gw / gl : (gw ? Infinity : 0), dd, bh: c.length ? c[c.length - 1] / c[0] - 1 : 0, curve };
}

/* מחשבון גודל פוזיציה (כלי Long/Short של TradingView): סיכון בכסף → כמות, יחס סיכוי/סיכון */
export function positionCalc(entry, stop, target, risk) {
  const per = Math.abs(entry - stop);
  const qty = per > 0 && risk > 0 ? Math.floor(risk / per) : 0;
  return { per, qty, rr: per > 0 && target != null ? Math.abs(target - entry) / per : null, reward: target != null ? qty * Math.abs(target - entry) : null, stopPct: entry ? (stop / entry - 1) * 100 : 0, targetPct: entry && target != null ? (target / entry - 1) * 100 : null };
}

/* מספר ספרות אחרי הנקודה לפי המחיר (פני מניה / שקלים / קריפטו זול) */
export function precisionFor(p) {
  if (!(p > 0)) return 2;
  if (p >= 1000) return 2;
  if (p >= 1) return 2;
  if (p >= 0.1) return 4;
  if (p >= 0.001) return 6;
  return 8;
}

/* פורמט פרמטרים לשמירה (מצב גרף לכל מניה) — רק מה שצריך, בלי פונקציות. נבדק בטעינה (מבנה שבור = ברירת מחדל) */
export function sanitizeLayout(o) {
  const ok = o && typeof o === 'object' ? o : {};
  const ind = Array.isArray(ok.ind) ? ok.ind.filter((x) => x && typeof x.n === 'string' && /^[A-Z0-9_]{1,16}$/.test(x.n)).slice(0, 30)
    .map((x) => ({ n: x.n, p: Array.isArray(x.p) ? x.p.filter((v) => typeof v === 'number' && isFinite(v)).slice(0, 8) : undefined, main: !!x.main, h: x.h === 1 ? 1 : 0 })) : [];
  const dr = Array.isArray(ok.dr) ? ok.dr.filter((x) => x && typeof x.name === 'string' && Array.isArray(x.points)).slice(0, 300)
    .map((x) => ({ name: x.name.slice(0, 40), points: x.points.slice(0, 12).filter((p) => p && isFinite(p.timestamp) && isFinite(p.value)).map((p) => ({ timestamp: +p.timestamp, value: +p.value })), styles: x.styles && typeof x.styles === 'object' ? x.styles : undefined, lock: !!x.lock, ext: typeof x.ext === 'object' && x.ext ? x.ext : undefined })) : [];
  return { tf: TF[ok.tf] ? ok.tf : '1D', type: typeof ok.type === 'string' ? ok.type.slice(0, 20) : 'candle_solid', ind, dr };
}

export const _test = { TF, aggregate, fromColumns, mergeBars, applyTick, heikinAshi, renko, lineBreak, kagi, sma, ema, rma, wma, hma, dema, tema, stdev, atr, rsi, linreg, CALC, IND, swings, zigzag, autoTrendlines, autoLevels, autoFib, candlePatterns, chartPatterns, volumeProfile, seasonality, expectedMove, rangeStats, backtest, positionCalc, precisionFor, sanitizeLayout };
