/* 27/10/2026 (בקשת המשתמש): "גרף נרות" — מסך גרף מלא לפי ת־גרף (ומעבר), לצד "ניתוח" בכרטיס המניה.
   מנוע הציור: KLineChart 10.1 (Apache-2.0, vendor/klinecharts — נטען רק כאן). החישובים: chartlib.js (טהור, נבדק).
   נתונים: נרות OHLCV מהשרתון (op:'candles' ב־/api/history), מחיר חי כל שנייה מ־/api/quotes (כמו התיק) + רענון נרות
   תקופתי מהשרתון (תיקון גבוה/נמוך/נפח). הכל דרך env (app.js → chartEnv) — בלי fetch/אחסון במודול.
   שכבה במסך מלא (z 900, html.kc-open — לולאת המחירים של התיק עוצרת). מחלקות רק kc-*; מחרוזות kc* ב־STRINGS.
   יכולות: 18 טווחי זמן (כולל 3m/45m/2h/4h/3M/6M/12M בצבירה), 10 סוגי גרף (נרות, חלולים, ברים, קו, שטח, Heikin Ashi,
   Renko, Line Break, Kagi), 27 אינדיקטורים מובנים + 45 שלנו, ~55 כלי ציור (קווים, ערוצים, פיבונאצ'י וגאן, תבניות, גלי
   אליוט, פוזיציה Long/Short, מדידות, AVWAP מעוגן, פרופיל נפח לטווח, צורות, טקסט), ניתוח אוטומטי (קווי מגמה, תמיכה/התנגדות,
   פיבונאצ'י, תבניות נרות וגרף, פרופיל נפח לטווח הנראה, קונוס תנועה צפויה), השוואת מניות וחוזק יחסי, עד 4 גרפים במסך,
   Bar Replay, התראות מחיר, עונתיות, בדיקה לאחור, ביטול/חזרה, עץ אובייקטים, צילום מסך, קיצורי מקלדת, שמירה לכל מניה. */
import * as L from './chartlib.js';

let E = null;          // env מ־app.js
let K = null;          // klinecharts (גלובלי מה־UMD)
let ROOT = null;
const T = (k, v) => (E && E.t ? E.t(k, v) : k);
const S = { cells: [], active: 0, layout: 1, modal: null, sheets: [], tool: null, magnet: 0, sel: null, timer: null, poll: 0, busy: false, store: null, keyOn: false, ro: null, watch: false, wq: {} };
const MAIN = 'candle_pane';
const DRAW_COLORS = ['#0A84FF', '#FF453A', '#30D158', '#FF9F0A', '#BF5AF2', '#8E8E93', '#64D2FF', '#FF375F'];   // פלטת iOS — כמו שאר האפליקציה
const NOW = () => Date.now();
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- טעינת הספרייה (פעם אחת) ---------- */
let LIBP = null;
function loadLib() {
  if (K) return Promise.resolve(K);
  if (LIBP) return LIBP;
  LIBP = new Promise((res, rej) => {
    if (typeof window !== 'undefined' && window.klinecharts) { K = window.klinecharts; registerAll(); return res(K); }
    const s = document.createElement('script');
    s.src = 'vendor/klinecharts/klinecharts.min.js';
    s.onload = () => { K = window.klinecharts; if (!K) return rej(new Error('lib')); registerAll(); res(K); };
    s.onerror = () => { LIBP = null; rej(new Error('lib')); };
    document.head.appendChild(s);
  });
  return LIBP;
}
function ensureCss() {
  if (document.getElementById('kcCss')) return Promise.resolve();
  const l = document.createElement('link'); l.id = 'kcCss'; l.rel = 'stylesheet'; l.href = 'chart.css';
  const p = new Promise((res) => { l.addEventListener('load', res); l.addEventListener('error', res); setTimeout(res, 1000); });
  document.head.appendChild(l);
  return p;
}

/* ---------- עזרי DOM ---------- */
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  if (attrs) for (const k of Object.keys(attrs)) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k === 'html') e.innerHTML = v;   // רק אייקונים קבועים (ICON) — לעולם לא נתון חיצוני
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  return e;
}
const btn = (cls, label, on, icon) => h('button', { type: 'button', class: cls, 'aria-label': label, title: label, onclick: on, html: icon || null }, icon ? null : label);
const css = (name) => { try { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); } catch (e) { return ''; } };
const isDark = () => typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark';
const rgba = (hex, a) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim()); if (!m) return hex; const n = parseInt(m[1], 16); return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; };
const fmtNum = (v, p) => (v == null || !isFinite(v) ? '—' : Number(v).toLocaleString(E && E.lang === 'en' ? 'en-US' : 'he-IL', { minimumFractionDigits: p, maximumFractionDigits: p }));
const fmtPct = (v) => (v == null || !isFinite(v) ? '—' : (v > 0 ? '+' : '') + v.toFixed(2) + '%');
const fmtBig = (v) => { if (v == null || !isFinite(v)) return '—'; const a = Math.abs(v); return a >= 1e9 ? (v / 1e9).toFixed(2) + 'B' : a >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : a >= 1e3 ? (v / 1e3).toFixed(1) + 'K' : String(Math.round(v)); };
/* 28/10/2026: בבועת המדידה — מילה מלאה ("18 ימים") ולא קיצור */
const fmtDurW = (ms) => { const m = Math.round(ms / 60000), n = m < 60 ? m : Math.round(m / 60) < 48 ? Math.round(m / 60) : Math.round(m / 1440), u = m < 60 ? 'Min' : Math.round(m / 60) < 48 ? 'Hour' : 'Day'; return n + ' ' + T(n === 1 ? 'kc' + u + 'W1' : 'kc' + u + 'W'); };
const fmtDur = (ms) => { const m = Math.round(ms / 60000); if (m < 60) return m + T('kcMinShort'); const hh = Math.round(m / 60); if (hh < 48) return hh + T('kcHourShort'); return Math.round(hh / 24) + T('kcDayShort'); };

/* ---------- אייקונים (SVG קבועים) ---------- */
const sv = (d, extra) => '<svg viewBox="0 0 24 24" aria-hidden="true"' + (extra || '') + '><path d="' + d + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON = {
  back: sv('M15 5l-7 7 7 7'),
  more: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.8" fill="currentColor"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/><circle cx="19" cy="12" r="1.8" fill="currentColor"/></svg>',
  candle: sv('M7 4v3M7 17v3M17 4v5M17 15v5M5 7h4v10H5zM15 9h4v6h-4z'),
  hollow: sv('M7 4v3M7 17v3M5 7h4v10H5zM17 4v5M17 15v5M15 9h4v6h-4z'),
  bars: sv('M7 4v16M4 8h3M7 15h3M17 4v16M14 11h3M17 7h3'),
  line: sv('M3 17l5-6 4 3 4-7 5 5'),
  area: sv('M3 17l5-6 4 3 4-7 5 5V20H3z'),
  ha: sv('M7 4v4M7 16v4M5 8h4v8H5zM17 3v4M17 13v4M15 7h4v6h-4z'),
  renko: sv('M3 18h5v-5H3zM8 13h5V8H8zM13 8h5V3h-5zM16 21h5v-5h-5z'),
  lb: sv('M3 18h4V9H3zM8 14h4V5H8zM13 20h4v-9h-4zM18 16h3V7h-3z'),
  kagi: sv('M4 20V9h5v6h5V4h6'),
  baseline: sv('M3 12h18M3 15l4-5 4 3 4-6 6 5', ' '),
  fx: '<svg viewBox="0 0 24 24" aria-hidden="true"><text x="3" y="17" font-size="14" font-style="italic" font-weight="700" fill="currentColor" font-family="Georgia,serif">fx</text></svg>',
  plus: sv('M12 5v14M5 12h14'),
  layout: sv('M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z'),
  replay: sv('M4 12a8 8 0 1 0 3-6.2M4 4v4h4M10 9v6l5-3z'),
  bell: sv('M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0'),
  auto: sv('M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4zM18 15l.9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9z'),
  cam: sv('M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'),
  gear: sv('M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.6 15H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 9.7 4.3V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z'),
  list: sv('M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01'),
  cursor: sv('M5 3l14 7-6 2-2 6z'),
  cross: sv('M12 3v18M3 12h18'),
  pencil: sv('M4 20l4-1 11-11-3-3L5 16zM14 6l3 3'),
  trend: sv('M4 19L20 5M4 19h.01M20 5h.01'),
  ray: sv('M4 18L20 6M4 18h.01'),
  extline: sv('M2 20L22 4'),
  hline: sv('M3 12h18'),
  hray: sv('M6 12h15M6 12h.01'),
  vline: sv('M12 3v18'),
  crossline: sv('M12 3v18M3 12h18'),
  info: sv('M4 19L20 5M12 12h6v-4'),
  arrow: sv('M4 20L19 5M12 5h7v7'),
  channel: sv('M3 15L17 5M7 19L21 9'),
  pchannel: sv('M3 17L17 7M3 12L17 2M7 21L21 11'),
  regress: sv('M3 17L21 7M3 13l18-10M3 21l18-10', ' stroke-dasharray="3 2"'),
  fork: sv('M3 12h6M9 12l12-7M9 12l12 0M9 12l12 7'),
  fib: sv('M3 5h18M3 9h18M3 12h18M3 15h18M3 19h18'),
  fibext: sv('M3 19l6-12 5 6M14 8h7M14 4h7M14 12h7'),
  fibtime: sv('M4 4v16M7 4v16M10 4v16M15 4v16M21 4v16'),
  fan: sv('M3 20L21 4M3 20L21 9M3 20L21 14M3 20L21 18'),
  fibcircle: sv('M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0M12 12m-7 0a7 7 0 1 0 14 0a7 7 0 1 0-14 0'),
  gann: sv('M3 3h18v18H3zM3 21L21 3M3 3l18 18M12 3v18M3 12h18'),
  xabcd: sv('M3 18L8 6l4 9 5-11 4 14'),
  abcd: sv('M3 18l6-12 5 8 7-10'),
  wave: sv('M2 18l4-8 3 4 5-10 3 6 5-8'),
  hs: sv('M2 18l3-6 3 3 4-10 4 10 3-3 3 6M5 15h14', ' '),
  tri: sv('M3 18L12 5l9 13z'),
  long: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3" width="16" height="9" fill="currentColor" opacity=".25"/><rect x="4" y="12" width="16" height="6" fill="currentColor" opacity=".12"/><path d="M4 12h16" stroke="currentColor" stroke-width="1.8"/></svg>',
  short: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="6" width="16" height="6" fill="currentColor" opacity=".12"/><rect x="4" y="12" width="16" height="9" fill="currentColor" opacity=".25"/><path d="M4 12h16" stroke="currentColor" stroke-width="1.8"/></svg>',
  ruler: sv('M3 17L17 3l4 4L7 21zM7 13l2 2M10 10l2 2M13 7l2 2'),
  prange: sv('M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4'),
  qprice: sv('M7 4h10M7 20h10M12 7v10M9.5 9.5L12 7l2.5 2.5M9.5 14.5L12 17l2.5-2.5'),
  qboth: sv('M4 4h16v16H4zM12 7.5v9M7.5 12h9M10.2 9.3L12 7.5l1.8 1.8M10.2 14.7L12 16.5l1.8-1.8M9.3 10.2L7.5 12l1.8 1.8M14.7 10.2l1.8 1.8-1.8 1.8'),
  drange: sv('M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4'),
  updown: sv('M8 9l4-4 4 4M8 15l4 4 4-4'),
  avwap: sv('M4 20c4-1 6-7 9-9s5-2 7-6M4 20v-3'),
  vprofile: sv('M4 4v16M4 6h9M4 9h13M4 12h16M4 15h10M4 18h6'),
  rect: sv('M4 6h16v12H4z'),
  circle: sv('M12 12m-8 0a8 8 0 1 0 16 0a8 8 0 1 0-16 0'),
  brush: sv('M3 17c3 0 3-4 6-4s3 4 6 4 3-6 6-8'),
  text: sv('M5 6h14M12 6v13'),
  note: sv('M4 4h16v12H9l-5 4z'),
  up: sv('M12 20V5M6 11l6-6 6 6'),
  down: sv('M12 4v15M6 13l6 6 6-6'),
  flag: sv('M5 21V4h11l-2 4 2 4H5'),
  tag: sv('M3 12l7-7h10v14H10z'),
  magnet: sv('M6 4v8a6 6 0 0 0 12 0V4h-4v8a2 2 0 0 1-4 0V4zM6 8h4M14 8h4'),
  lock: sv('M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z'),
  unlock: sv('M7 11V8a5 5 0 0 1 9.6-2M5 11h14v10H5z'),
  eye: sv('M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'),
  eyeoff: sv('M3 3l18 18M10.6 6.1A10 10 0 0 1 12 6c6 0 10 6 10 6a17 17 0 0 1-3 3.5M6.5 6.6C3.8 8.4 2 12 2 12s4 6 10 6a9 9 0 0 0 4-.9'),
  trash: sv('M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3'),
  undo: sv('M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3'),
  redo: sv('M15 14l5-5-5-5M20 9H9a5 5 0 0 0 0 10h3'),
  copy: sv('M8 8h12v12H8zM4 16V4h12'),
  close: sv('M6 6l12 12M18 6L6 18'),
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4l13 8-13 8z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h4v16H6zM14 4h4v16h-4z" fill="currentColor"/></svg>',
  step: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4l10 8-10 8zM16 4h3v16h-3z" fill="currentColor"/></svg>',
  search: sv('M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4'),
  star: sv('M12 3l2.7 5.6 6.2.9-4.5 4.4 1 6.1L12 17l-5.5 3 1-6.1L3 9.5l6.2-.9z'),
  season: sv('M4 20V10M8 20V6M12 20v-8M16 20V4M20 20v-6'),
  test: sv('M9 3h6M10 3v6L4 19a1.5 1.5 0 0 0 1.3 2h13.4a1.5 1.5 0 0 0 1.3-2L14 9V3'),
  zoomin: sv('M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4M8 11h6M11 8v6'),
  zoomout: sv('M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4M8 11h6'),
  fit: sv('M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5'),
  now: sv('M6 7l5 5-5 5M13 7l5 5-5 5'),
  watch: sv('M4 6h16M4 12h10M4 18h7M18 14l2 2 3-4'),
};

/* ---------- סוגי גרף ---------- */
const TYPES = [
  ['candle_solid', 'kcTyCandle', 'candle'], ['candle_up_stroke', 'kcTyHollow', 'hollow'], ['ohlc', 'kcTyBars', 'bars'],
  ['line', 'kcTyLine', 'line'], ['area', 'kcTyArea', 'area'], ['ha', 'kcTyHA', 'ha'],
  ['renko', 'kcTyRenko', 'renko'], ['lb', 'kcTyLB', 'lb'], ['kagi', 'kcTyKagi', 'kagi'],
];
const TRANSFORM = { ha: L.heikinAshi, renko: (b) => L.renko(b), lb: (b) => L.lineBreak(b, 3), kagi: (b) => L.kagi(b, 0.04) };
const NO_HISTORY_MORE = new Set(['renko', 'lb', 'kagi']);   // טרנספורמציה שתלויה בכל ההיסטוריה — בלי טעינה הדרגתית

/* ---------- אינדיקטורים: מובנים + שלנו ---------- */
const BUILTIN = {
  MA: { g: 'trend', main: 1 }, EMA: { g: 'trend', main: 1 }, SMA: { g: 'trend', main: 1 }, BOLL: { g: 'vol', main: 1 }, SAR: { g: 'trend', main: 1 },
  BBI: { g: 'trend', main: 1 }, AVP: { g: 'trend', main: 1 }, KCVOL: { g: 'volume', main: 1 }, VOL: { g: 'volume' }, MACD: { g: 'osc' }, RSI: { g: 'osc', lv: [70, 30] }, KDJ: { g: 'osc' },
  OBV: { g: 'volume' }, CCI: { g: 'osc' }, DMI: { g: 'trend' }, WR: { g: 'osc' }, AO: { g: 'osc' }, TRIX: { g: 'osc' }, ROC: { g: 'osc' },
  MTM: { g: 'osc' }, BIAS: { g: 'osc' }, BRAR: { g: 'osc' }, CR: { g: 'osc' }, DMA: { g: 'trend' }, EMV: { g: 'volume' }, PSY: { g: 'osc' }, PVT: { g: 'volume' }, VR: { g: 'volume' },
};
const AUTO = { KCAUTOTL: 1, KCAUTOSR: 1, KCAUTOFIB: 1, KCCANDLES: 1, KCPATTERNS: 1, KCVPVR: 1, KCCONE: 1 };
const isMain = (name) => !!((L.IND[name] && L.IND[name].main) || (BUILTIN[name] && BUILTIN[name].main) || AUTO[name] || name === 'KCCMP' || name === 'KCBT');
const AN = new Map();   // תוצאות ניתוח אוטומטי לכל אינדיקטור (id) — מחושב ב־calc, מצויר ב־draw

function cellOf(ind) { const c = ind && ind.extendData && ind.extendData.c; return S.cells[c] || S.cells[S.active] || null; }
/* מפתח יום בשעון הבורסה — מטמון של היסט אזור הזמן לכל שעה (Intl יקר בלולאה של כל נר) */
const TZOFF = new Map();
function tzOffset(tz, ms) {
  const k = tz + '|' + Math.floor(ms / 3600000);
  if (TZOFF.has(k)) return TZOFF.get(k);
  let off = 0;
  try {
    const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(new Date(ms));
    const g = (t) => +p.find((x) => x.type === t).value;
    off = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute')) - Math.floor(ms / 60000) * 60000;
  } catch (e) { off = 0; }
  if (TZOFF.size > 20000) TZOFF.clear();
  TZOFF.set(k, off);
  return off;
}
const dayKeyFor = (tz) => (ms) => Math.floor((ms + tzOffset(tz, ms)) / 86400000);
function ctxOf(ind) {
  const c = cellOf(ind);
  return { intra: c ? L.isIntraday(c.tf) : false, dayKey: dayKeyFor((c && c.tz) || 'America/New_York'), cmp: c && c.bench ? c.bench.bars : null };
}

function figOf(key, title, type) {
  const f = { key, title: title + ': ', type: type || 'line' };
  if (type === 'bar') {
    f.baseValue = 0;
    f.styles = ({ data }) => { const v = data.current && data.current[key]; const up = css('--gain') || '#30D158', dn = css('--loss') || '#FF453A'; return { color: rgba(v >= 0 ? up : dn, 0.7), borderColor: rgba(v >= 0 ? up : dn, 0.7) }; };
  }
  if (type === 'circle') f.styles = () => ({ color: key === 'sq' ? '#FF453A' : '#30D158' });
  return f;
}
/* קווי רמה מקווקווים (70/30 וכו') לחלוניות מתנדים */
function drawLevels(lv) {
  return ({ ctx, bounding, yAxis }) => {
    ctx.save();
    ctx.strokeStyle = isDark() ? 'rgba(255,255,255,.22)' : 'rgba(0,0,0,.2)'; ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
    for (const v of lv) { const y = Math.round(yAxis.convertToPixel(v)) + 0.5; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(bounding.width, y); ctx.stroke(); }
    ctx.restore();
    return false;
  };
}
/* מילוי ענן איצ'ימוקו בין Span A ל־Span B */
function drawCloud({ ctx, chart, indicator, xAxis, yAxis }) {
  const r = indicator.result || [], vr = chart.getVisibleRange();
  ctx.save();
  for (let i = Math.max(1, vr.from); i < Math.min(r.length, vr.to); i++) {
    const a = r[i - 1], b = r[i];
    if (!a || !b || a.spanA == null || a.spanB == null || b.spanA == null || b.spanB == null) continue;
    const x0 = xAxis.convertToPixel(i - 1), x1 = xAxis.convertToPixel(i);
    ctx.fillStyle = b.spanA >= b.spanB ? 'rgba(48,209,88,.16)' : 'rgba(255,69,58,.16)';
    ctx.beginPath();
    ctx.moveTo(x0, yAxis.convertToPixel(a.spanA)); ctx.lineTo(x1, yAxis.convertToPixel(b.spanA));
    ctx.lineTo(x1, yAxis.convertToPixel(b.spanB)); ctx.lineTo(x0, yAxis.convertToPixel(a.spanB));
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  return false;
}

/* ציור עזר: טקסט עם רקע על ה־canvas */
function label(ctx, x, y, text, bg, fg, align) {
  ctx.font = '600 11px -apple-system, system-ui, sans-serif';
  const w = ctx.measureText(text).width + 8;
  const x0 = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
  ctx.fillStyle = bg; ctx.fillRect(x0, y - 8, w, 16);
  ctx.fillStyle = fg || '#fff'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillText(text, x0 + 4, y);
}
const px = (chart, t, v) => chart.convertToPixel({ timestamp: t, value: v }, { paneId: MAIN });
const dataIdx = (list, t) => { let lo = 0, hi = list.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (list[m].timestamp < t) lo = m + 1; else hi = m; } return lo; };

/* ---------- ניתוח אוטומטי כאינדיקטורים על הגרף הראשי (מחושב ב־calc, מצויר ב־draw — זז עם הגרף ומתעדכן חי) ---------- */
const ANALYSIS_TAIL = 800;   // ניתוח על 800 הנרות האחרונים — מספיק לתבניות ומהיר בכל טיק
function tail(list) { const k = Math.max(0, list.length - ANALYSIS_TAIL); return { k, bars: list.slice(k) }; }
const AUTO_DEF = {
  KCAUTOTL: {
    calc: (list) => L.autoTrendlines(tail(list).bars, { max: 2 }),
    draw: (res, { ctx, chart }) => {
      for (const l of res) {
        const a = px(chart, l.a.t, l.a.price), b = px(chart, l.b.t, l.b.price);
        ctx.strokeStyle = l.kind === 'sup' ? '#30D158' : '#FF453A'; ctx.lineWidth = 1.6; ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        label(ctx, b.x, b.y, T(l.kind === 'sup' ? 'kcAutoSup' : 'kcAutoRes') + ' ×' + l.touches, ctx.strokeStyle, '#fff', 'right');
      }
    },
  },
  KCAUTOSR: {
    calc: (list) => L.autoLevels(tail(list).bars, 6),
    draw: (res, { ctx, chart, bounding }) => {
      const prec = (chart.getSymbol() || {}).pricePrecision || 2;
      for (const l of res) {
        const y = Math.round(px(chart, NOW(), l.price).y) + 0.5;
        const c = l.kind === 'sup' ? 'rgba(48,209,88,' : 'rgba(255,69,58,';
        ctx.fillStyle = c + '.07)'; ctx.fillRect(0, y - 3, bounding.width, 6);
        ctx.strokeStyle = c + '.75)'; ctx.setLineDash([6, 4]); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(bounding.width, y); ctx.stroke(); ctx.setLineDash([]);
        label(ctx, 4, y, l.price.toFixed(prec) + ' · ×' + l.touches, c + '.9)', '#fff');
      }
    },
  },
  KCAUTOFIB: {
    calc: (list) => L.autoFib(tail(list).bars),
    draw: (res, { ctx, chart, bounding }) => {
      if (!res) return;
      const lv = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
      const a = px(chart, res.a.t, res.a.price), prec = (chart.getSymbol() || {}).pricePrecision || 2;
      const cols = ['#787B86', '#FF453A', '#FF9800', '#4CAF50', '#30D158', '#00BCD4', '#787B86'];
      lv.forEach((r, i) => {
        const v = res.b.price - (res.b.price - res.a.price) * r, y = px(chart, res.b.t, v).y;
        ctx.strokeStyle = cols[i]; ctx.lineWidth = 1; ctx.setLineDash(r === 0.5 || r === 0.618 ? [] : [3, 3]);
        ctx.beginPath(); ctx.moveTo(a.x, y); ctx.lineTo(bounding.width, y); ctx.stroke();
        label(ctx, a.x, y - 9, r + ' (' + v.toFixed(prec) + ')', 'transparent', cols[i]);
      });
      ctx.setLineDash([]);
      label(ctx, a.x, a.y, T('kcAutoFib'), '#787B86', '#fff');
    },
  },
  KCCANDLES: {
    calc: (list) => { const { k, bars } = tail(list); return L.candlePatterns(bars).map((p) => Object.assign(p, { i: p.i + k })); },
    draw: (res, { ctx, chart, xAxis, yAxis }) => {
      const vr = chart.getVisibleRange(), list = chart.getDataList();
      // מהחדש לישן; תווית שנופלת על תווית קודמת באותו צד — רק נקודה קטנה (בלי ערימה של טקסט על הגרף)
      const free = { up: Infinity, dn: Infinity };
      for (let j = res.length - 1; j >= 0; j--) {
        const p = res[j];
        if (p.i < vr.from || p.i >= vr.to) continue;
        const b = list[p.i], x = xAxis.convertToPixel(p.i), side = p.dir >= 0 ? 'up' : 'dn';
        const col = p.dir > 0 ? 'rgba(48,209,88,.92)' : p.dir < 0 ? 'rgba(255,69,58,.92)' : 'rgba(120,123,134,.92)';
        const y = side === 'up' ? yAxis.convertToPixel(b.low) + 16 : yAxis.convertToPixel(b.high) - 16;
        const txt = T('kcCp_' + p.key), w = txt.length * 6.2 + 12;
        if (x + w / 2 + 4 <= free[side]) { label(ctx, x, y, txt, col, '#fff', 'center'); free[side] = x - w / 2; }
        else { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, side === 'up' ? y - 8 : y + 8, 2.5, 0, Math.PI * 2); ctx.fill(); }
      }
    },
  },
  KCPATTERNS: {
    calc: (list) => { const { k, bars } = tail(list); return L.chartPatterns(bars).map((p) => Object.assign(p, { pts: p.pts.map((s) => Object.assign({}, s, { i: s.i + k })) })); },
    draw: (res, { ctx, chart }) => {
      for (const p of res) {
        const c = p.dir > 0 ? '#30D158' : p.dir < 0 ? '#FF453A' : '#0A84FF';
        ctx.strokeStyle = c; ctx.lineWidth = 1.5; ctx.fillStyle = rgba(c, 0.08); ctx.setLineDash([]);
        ctx.beginPath();
        p.pts.forEach((s, j) => { const q = px(chart, s.t, s.price); if (j) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); });
        ctx.stroke();
        if (p.neck) { const a = px(chart, p.neck[0].t, p.neck[0].price), b = px(chart, p.neck[1].t, p.neck[1].price); ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.setLineDash([]); }
        const top = p.pts.reduce((m, s) => (s.price > m.price ? s : m), p.pts[0]), q = px(chart, top.t, top.price);
        label(ctx, q.x, q.y - 14, T('kcPt_' + p.key), c, '#fff', 'center');
      }
    },
  },
  /* פרופיל נפח לטווח הנראה (TradingView "Visible Range Volume Profile") — מימין, עם POC ואזור הערך */
  KCVPVR: {
    calc: () => null,
    draw: (res, { ctx, chart, bounding, yAxis }) => {
      const vr = chart.getVisibleRange(), list = chart.getDataList().slice(Math.max(0, vr.realFrom), Math.max(0, vr.realTo));
      const vp = L.volumeProfile(list, 32);
      if (!vp || !vp.max) return;
      const W = bounding.width * 0.24;
      for (let r = 0; r < vp.tot.length; r++) {
        const y0 = yAxis.convertToPixel(vp.lo + vp.step * (r + 1)), y1 = yAxis.convertToPixel(vp.lo + vp.step * r);
        const hgt = Math.max(1, y1 - y0 - 1), wu = W * vp.up[r] / vp.max, wd = W * vp.dn[r] / vp.max;
        const inVA = vp.lo + vp.step * r >= vp.val - 1e-9 && vp.lo + vp.step * (r + 1) <= vp.vah + 1e-9;
        ctx.fillStyle = inVA ? 'rgba(48,209,88,.38)' : 'rgba(48,209,88,.16)'; ctx.fillRect(bounding.width - wu - wd, y0, wu, hgt);
        ctx.fillStyle = inVA ? 'rgba(255,69,58,.38)' : 'rgba(255,69,58,.16)'; ctx.fillRect(bounding.width - wd, y0, wd, hgt);
      }
      const yp = Math.round(yAxis.convertToPixel(vp.pocPrice)) + 0.5;
      ctx.strokeStyle = '#FF9800'; ctx.lineWidth = 1.5; ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(0, yp); ctx.lineTo(bounding.width, yp); ctx.stroke();
      label(ctx, 4, yp, 'POC', '#FF9800');
    },
  },
  /* קונוס תנועה צפויה (±1σ/±2σ מהתנודתיות ההיסטורית) — מצויר לעתיד, באזור הריק מימין לנר האחרון */
  KCCONE: {
    calc: (list, ind) => { const c = cellOf(ind); const per = c ? Math.round(252 * 86400 / Math.max(60, c.secReal || 86400)) : 252; return L.expectedMove(list, 20, Math.min(per, 252 * 390)); },
    draw: (res, { ctx, chart, xAxis, yAxis }) => {
      if (!res) return;
      const n = chart.getDataList().length - 1, x0 = xAxis.convertToPixel(n), y0 = yAxis.convertToPixel(res.p0);
      for (const [ku, kd, a] of [['up2', 'dn2', 0.08], ['up1', 'dn1', 0.14]]) {
        ctx.fillStyle = 'rgba(10,132,255,' + a + ')'; ctx.beginPath(); ctx.moveTo(x0, y0);
        res.pts.forEach((p) => ctx.lineTo(xAxis.convertToPixel(n + p.k), yAxis.convertToPixel(p[ku])));
        for (let j = res.pts.length - 1; j >= 0; j--) ctx.lineTo(xAxis.convertToPixel(n + res.pts[j].k), yAxis.convertToPixel(res.pts[j][kd]));
        ctx.closePath(); ctx.fill();
      }
      const e = res.pts[res.pts.length - 1], xe = xAxis.convertToPixel(n + e.k);
      label(ctx, xe, yAxis.convertToPixel(e.up1), '+1σ ' + e.up1.toFixed(2), 'rgba(10,132,255,.85)', '#fff', 'right');
      label(ctx, xe, yAxis.convertToPixel(e.dn1), '−1σ ' + e.dn1.toFixed(2), 'rgba(10,132,255,.85)', '#fff', 'right');
    },
  },
};

/* השוואה (Compare): המניה האחרת מנורמלת לנר הראשון המשותף — ציר האחוזים מראה את הביצוע היחסי (לפי ת־גרף) */
const CMPC = ['#FF9800', '#9C27B0', '#00BCD4', '#E91E63', '#795548'];
async function calcCmp(list, ind) {
  const c = cellOf(ind), sym = ind.extendData && ind.extendData.sym;
  if (!c || !sym || !list.length) return list.map(() => ({}));
  const bars = await cmpBars(c, sym);
  const map = new Map(bars.map((b) => [b.timestamp, b.close]));
  let ratio = null, last = null;
  return list.map((b) => {
    const v = map.has(b.timestamp) ? map.get(b.timestamp) : last;
    if (v == null) return {};
    last = v;
    if (ratio == null) ratio = b.close / v;
    return { cmp: v * ratio };
  });
}
async function cmpBars(c, sym) {
  const key = sym + '|' + c.tf + '|' + (c.raw && c.raw.length ? c.raw[0].timestamp : 0);
  c.cmpCache = c.cmpCache || new Map();
  if (c.cmpCache.has(key)) return c.cmpCache.get(key);
  const p = (async () => {
    const d = TF[c.tf], out = [];
    let to = 0, guard = 0;
    while (guard++ < 6) {
      const r = await E.api({ op: 'candles', sym, iv: d.base, to: to || undefined, pre: !!S.store.g.ext && L.isIntraday(c.tf) });
      if (!r || !r.ok) break;
      const b = L.fromColumns(r);
      out.unshift(...b);
      if (!r.more || !b.length || !c.raw.length || b[0].timestamp <= c.raw[0].timestamp) break;
      to = b[0].timestamp / 1000;
    }
    return L.aggregate(out, c.tf);
  })().catch(() => []);
  c.cmpCache.set(key, p);
  return p;
}
const TF = L.TF;

let REG = false;
function registerAll() {
  if (REG || !K) return;
  REG = true;
  for (const k of Object.keys(L.IND)) {
    const def = L.IND[k];
    K.registerIndicator({
      name: k, shortName: k === 'RIBBON' ? 'EMA Ribbon' : k, calcParams: def.p.map((x) => x[1]), series: def.main ? 'price' : 'normal',
      precision: def.main ? 2 : (k === 'AD' || k === 'FORCE' || k === 'CHAIKIN' ? 0 : 2), shouldFormatBigNumber: k === 'AD' || k === 'FORCE' || k === 'CHAIKIN',
      figures: def.f.map(([key, title, type]) => figOf(key, title, type)),
      calc: async (list, ind) => {
        if (k === 'RS') { const c = cellOf(ind); if (c) await ensureBench(c); }
        return L.CALC[k](list, ind.calcParams, ctxOf(ind));
      },
      draw: k === 'ICHIMOKU' ? drawCloud : def.lv ? drawLevels(def.lv) : null,
    });
  }
  // קווי רמה גם ל־RSI המובנה (70/30) — עטיפה שקורית לפני הציור הרגיל
  for (const k of Object.keys(AUTO_DEF)) {
    const def = AUTO_DEF[k];
    K.registerIndicator({
      name: k, shortName: T('kcAutoN_' + k), series: 'price', calcParams: [], figures: [],
      calc: (list, ind) => { try { AN.set(ind.id, def.calc(list, ind)); } catch (e) { AN.set(ind.id, null); } return list.map(() => ({})); },
      draw: (p) => { const r = AN.get(p.indicator.id); if (r) { p.ctx.save(); try { def.draw(r, p); } catch (e) { /* ציור חלקי */ } p.ctx.restore(); } return false; },
    });
  }
  /* נפח משולב: עמודות ברצועה התחתונה של חלון הנרות (16%; הנרות נפרסים על כל הגובה ועוברים מעליהן), סקאלה משלהן (המקסימום במסך), מאחורי הנרות (destination-over)
     ובשקיפות קלה בלבד — חדות ובולטות. בלי figures, כך שהן לא משפיעות על טווח ציר המחיר */
  K.registerIndicator({
    name: 'KCVOL', shortName: '', series: 'normal', calcParams: [], figures: [], calc: (list) => list.map(() => ({})),
    draw: ({ ctx, chart, xAxis, bounding }) => {
      const list = chart.getDataList(), vr = chart.getVisibleRange();
      if (!list.length || !bounding) return false;
      const a = Math.max(0, vr.from), b = Math.min(list.length, vr.to + 1);
      let max = 0;
      for (let i = a; i < b; i++) max = Math.max(max, +list[i].volume || 0);
      if (!max) return false;
      const p = palette(), sp = chart.getBarSpace(), w = Math.max(1, (sp && (sp.gapBar || sp.bar * 0.8)) || 3), H = bounding.height * 0.16, y0 = bounding.height;
      ctx.save();
      ctx.globalCompositeOperation = 'destination-over';
      for (let i = a; i < b; i++) {
        const d = list[i], v = +d.volume || 0;
        if (!v) continue;
        const hh = Math.max(1, (v / max) * H), x = xAxis.convertToPixel(i);
        ctx.fillStyle = rgba(d.close >= d.open ? p.up : p.dn, isDark() ? 0.5 : 0.4);
        ctx.fillRect(Math.round(x - w / 2), Math.round(y0 - hh), Math.max(1, Math.round(w)), Math.round(hh));
      }
      ctx.restore();
      return false;
    },
  });
  K.registerIndicator({ name: 'KCCMP', shortName: 'CMP', series: 'price', calcParams: [], figures: [{ key: 'cmp', title: '', type: 'line' }], calc: calcCmp });
  K.registerIndicator({
    name: 'KCBT', shortName: T('kcBtTitle'), series: 'price', calcParams: [], figures: [], calc: (list) => list.map(() => ({})),
    draw: ({ ctx, chart, xAxis, yAxis, indicator }) => {
      const r = indicator.extendData && indicator.extendData.res, list = chart.getDataList();
      if (!r) return false;
      ctx.save();
      for (const t of r.trades) {
        const a = list[t.a], b = list[t.b];
        if (!a || !b) continue;
        const xa = xAxis.convertToPixel(t.a), xb = xAxis.convertToPixel(t.b), ya = yAxis.convertToPixel(a.open), yb = yAxis.convertToPixel(b.open);
        ctx.strokeStyle = t.r > 0 ? '#30D158' : '#FF453A'; ctx.setLineDash([4, 3]); ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(xa, ya); ctx.lineTo(xb, yb); ctx.stroke(); ctx.setLineDash([]);
        label(ctx, xa, yAxis.convertToPixel(a.low) + 14, '▲ ' + T('kcBtBuy'), 'rgba(48,209,88,.9)', '#fff', 'center');
        label(ctx, xb, yAxis.convertToPixel(b.high) - 14, '▼ ' + (t.r * 100).toFixed(1) + '%', t.r > 0 ? 'rgba(48,209,88,.9)' : 'rgba(255,69,58,.9)', '#fff', 'center');
      }
      ctx.restore();
      return false;
    },
  });
  registerOverlays();
  try {
    K.registerLocale('he-IL', { time: 'זמן ', open: 'פ ', high: 'ג ', low: 'נ ', close: 'ס ', volume: 'נפח ', change: 'שינוי ', turnover: 'מחזור ', second: 'שנ׳', minute: 'דק׳', hour: 'שעה', day: 'יום', week: 'שבוע', month: 'חודש', year: 'שנה' });
  } catch (e) { /* גרסה בלי locale */ }
}
async function ensureBench(c) {
  const bench = /\.TA$/.test(c.sym) ? '^TA125.TA' : 'SPY';
  const key = bench + '|' + c.tf;
  if (c.bench && c.bench.key === key) return;
  c.bench = { key, bars: await cmpBars(c, bench) };
}

/* ---------- כלי ציור (Overlays). מובנים ב־KLineChart: segment, rayLine, straightLine, horizontal*, vertical*, priceLine,
   parallelStraightLine, priceChannelLine, fibonacciLine, simpleAnnotation, simpleTag, brush. כל השאר — כאן (kc*).
   הצבע מהסגנון של השרטוט (styles.line.color) — כך סרגל העריכה (צבע/עובי/קו מקווקו) משנה גם את הכלים שלנו. ---------- */
const DEF_COLOR = '#0A84FF';
const oc = (o) => (o.styles && o.styles.line && o.styles.line.color) || DEF_COLOR;
const ow = (o) => (o.styles && o.styles.line && o.styles.line.size) || 1;
const odash = (o) => (o.styles && o.styles.line && o.styles.line.style === 'dashed' ? 'dashed' : 'solid');
const precOf = (chart) => ((chart.getSymbol && chart.getSymbol()) || {}).pricePrecision || 2;
const lineFig = (o, coords, extra) => ({ type: 'line', attrs: { coordinates: coords }, styles: Object.assign({ color: oc(o), size: ow(o), style: odash(o), dashedValue: [4, 4] }, extra || {}) });
const textFig = (x, y, text, color, opt) => ({ type: 'text', ignoreEvent: true, attrs: Object.assign({ x, y, text, align: 'left', baseline: 'middle' }, opt && opt.attrs), styles: Object.assign({ color: '#fff', backgroundColor: color, borderColor: color, size: 11, paddingLeft: 4, paddingRight: 4, paddingTop: 2, paddingBottom: 2, borderRadius: 2 }, opt && opt.styles) });
const polyFig = (coords, color, a) => ({ type: 'polygon', attrs: { coordinates: coords }, styles: { style: 'fill', color: rgba(color, a == null ? 0.15 : a) } });
const valAt = (o, i) => (o.points[i] && o.points[i].value);
const fmtP = (chart, v) => (v == null ? '' : Number(v).toFixed(precOf(chart)));
const extendRay = (a, b, w) => { const dx = b.x - a.x, dy = b.y - a.y; if (!dx) return { x: b.x, y: dy > 0 ? 1e5 : -1e5 }; const k = ((dx > 0 ? w : 0) - a.x) / dx; return { x: a.x + dx * k, y: a.y + dy * k }; };

/* רמות פיבונאצ'י (TradingView: 0–1 + הרחבות). צבע לכל רמה כמו בברירת המחדל של TV */
const FIB = [[0, '#787B86'], [0.236, '#FF453A'], [0.382, '#FF9800'], [0.5, '#4CAF50'], [0.618, '#30D158'], [0.786, '#00BCD4'], [1, '#787B86'], [1.272, '#0A84FF'], [1.618, '#9C27B0'], [2.618, '#E91E63']];
const FIB_EXT = [[0, '#787B86'], [0.382, '#FF453A'], [0.618, '#FF9800'], [1, '#4CAF50'], [1.272, '#30D158'], [1.618, '#00BCD4'], [2, '#0A84FF'], [2.618, '#9C27B0'], [3.618, '#E91E63']];

/* תבניות מסומנות בנקודות (XABCD, ABCD, גלי אליוט, ראש וכתפיים, משולש): קו שבור + תוויות + יחסי פיבונאצ'י */
function wavePattern(name, labels, ratios) {
  return {
    name, totalStep: labels.length + 1, needDefaultPointFigure: true, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false,
    createPointFigures: ({ overlay, coordinates }) => {
      const c = oc(overlay), figs = [];
      if (coordinates.length > 1) figs.push(lineFig(overlay, coordinates));
      if (ratios && coordinates.length >= 3) {
        // צל שקוף על המשולשים XAB / BCD (כמו בכלי ה־XABCD של TV)
        if (coordinates.length >= 3) figs.push(polyFig(coordinates.slice(0, 3), c, 0.1));
        if (coordinates.length >= 5) figs.push(polyFig([coordinates[2], coordinates[3], coordinates[4]], c, 0.1));
        for (const [i, j, k] of ratios) {
          if (coordinates.length <= k) continue;
          const v = (q) => valAt(overlay, q), r = Math.abs((v(k) - v(j)) / ((v(j) - v(i)) || 1));
          const mx = (coordinates[i].x + coordinates[k].x) / 2, my = (coordinates[i].y + coordinates[k].y) / 2;
          figs.push(lineFig(overlay, [coordinates[i], coordinates[k]], { style: 'dashed', size: 1 }));
          figs.push(textFig(mx, my, r.toFixed(3), c, { attrs: { align: 'center' } }));
        }
      }
      coordinates.forEach((p, i) => {
        if (!labels[i]) return;
        const up = i > 0 ? p.y <= coordinates[i - 1].y : coordinates[1] ? p.y <= coordinates[1].y : true;
        figs.push(textFig(p.x, p.y + (up ? -14 : 14), labels[i], c, { attrs: { align: 'center' } }));
      });
      return figs;
    },
  };
}

function registerOverlays() {
  const R = (o) => K.registerOverlay(Object.assign({ needDefaultPointFigure: true, needDefaultXAxisFigure: true, needDefaultYAxisFigure: true }, o));

  /* קו מגמה עם נתונים (Info Line): שינוי, אחוז, נרות, זווית */
  R({
    name: 'kcInfoLine', totalStep: 3,
    createPointFigures: ({ chart, overlay, coordinates }) => {
      if (coordinates.length < 2) return [];
      const a = overlay.points[0], b = overlay.points[1], d = b.value - a.value;
      const list = chart.getDataList(), ia = dataIdx(list, a.timestamp), ib = dataIdx(list, b.timestamp);
      const txt = (d >= 0 ? '+' : '') + fmtP(chart, d) + ' (' + fmtPct(a.value ? d / a.value * 100 : 0) + ') · ' + Math.abs(ib - ia) + ' ' + T('kcBarsW');
      return [lineFig(overlay, coordinates), textFig(coordinates[1].x + 6, coordinates[1].y, txt, oc(overlay))];
    },
  });
  R({ name: 'kcArrow', totalStep: 3, createPointFigures: ({ overlay, coordinates }) => {
    if (coordinates.length < 2) return [];
    const [a, b] = coordinates, ang = Math.atan2(b.y - a.y, b.x - a.x), s = 10 + ow(overlay) * 2;
    const p1 = { x: b.x - s * Math.cos(ang - 0.45), y: b.y - s * Math.sin(ang - 0.45) }, p2 = { x: b.x - s * Math.cos(ang + 0.45), y: b.y - s * Math.sin(ang + 0.45) };
    return [lineFig(overlay, [a, b]), { type: 'polygon', attrs: { coordinates: [b, p1, p2] }, styles: { style: 'fill', color: oc(overlay) } }];
  } });
  R({ name: 'kcCrossLine', totalStep: 2, createPointFigures: ({ overlay, coordinates, bounding }) => (coordinates.length ? [lineFig(overlay, [{ x: 0, y: coordinates[0].y }, { x: bounding.width, y: coordinates[0].y }]), lineFig(overlay, [{ x: coordinates[0].x, y: 0 }, { x: coordinates[0].x, y: bounding.height }])] : []) });

  /* ערוץ רגרסיה לינארית בין שתי נקודות זמן (Regression Trend) — מחושב מהנרות עצמם */
  R({
    name: 'kcRegression', totalStep: 3, needDefaultYAxisFigure: false,
    createPointFigures: ({ chart, overlay, coordinates }) => {
      if (coordinates.length < 2) return [];
      const list = chart.getDataList();
      let ia = dataIdx(list, overlay.points[0].timestamp), ib = dataIdx(list, overlay.points[1].timestamp);
      if (ia > ib) [ia, ib] = [ib, ia];
      const n = ib - ia + 1;
      if (n < 3) return [lineFig(overlay, coordinates)];
      const c = list.map((b) => b.close), r = L.linreg(c, n, ib);
      let s = 0; for (let j = 0; j < n; j++) s += (c[ia + j] - (r.icpt + r.slope * j)) ** 2;
      const sd = Math.sqrt(s / n), t0 = list[ia].timestamp, t1 = list[ib].timestamp;
      const at = (t, v) => px(chart, t, v);
      const m0 = at(t0, r.icpt), m1 = at(t1, r.end), u0 = at(t0, r.icpt + 2 * sd), u1 = at(t1, r.end + 2 * sd), d0 = at(t0, r.icpt - 2 * sd), d1 = at(t1, r.end - 2 * sd);
      return [polyFig([u0, u1, d1, d0], oc(overlay), 0.08), lineFig(overlay, [m0, m1]), lineFig(overlay, [u0, u1], { style: 'dashed' }), lineFig(overlay, [d0, d1], { style: 'dashed' })];
    },
  });
  /* מזלג אנדרוז (Pitchfork): קו חציון מ־A לאמצע BC, מקבילים דרך B ו־C */
  R({
    name: 'kcPitchfork', totalStep: 4,
    createPointFigures: ({ overlay, coordinates, bounding }) => {
      if (coordinates.length < 2) return [];
      if (coordinates.length < 3) return [lineFig(overlay, coordinates)];
      const [a, b, c] = coordinates, m = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 }, end = extendRay(a, m, bounding.width);
      const dx = end.x - m.x, dy = end.y - m.y;
      return [
        polyFig([b, { x: b.x + dx, y: b.y + dy }, { x: c.x + dx, y: c.y + dy }, c], oc(overlay), 0.07),
        lineFig(overlay, [a, end]), lineFig(overlay, [b, c]),
        lineFig(overlay, [b, { x: b.x + dx, y: b.y + dy }]), lineFig(overlay, [c, { x: c.x + dx, y: c.y + dy }]),
      ];
    },
  });

  /* פיבונאצ'י Retracement מלא (עם הרחבות 1.272/1.618/2.618 ומילוי בין הרמות) */
  R({
    name: 'kcFibRet', totalStep: 3,
    createPointFigures: ({ chart, overlay, coordinates, bounding }) => {
      if (coordinates.length < 2) return [];
      const [a, b] = coordinates, va = valAt(overlay, 0), vb = valAt(overlay, 1), x0 = Math.min(a.x, b.x), figs = [];
      let prevY = null;
      FIB.forEach(([r, col], i) => {
        const y = b.y + (a.y - b.y) * r, v = vb + (va - vb) * r;
        if (prevY != null) figs.push(polyFig([{ x: x0, y: prevY }, { x: bounding.width, y: prevY }, { x: bounding.width, y }, { x: x0, y }], col, 0.07));
        figs.push({ type: 'line', attrs: { coordinates: [{ x: x0, y }, { x: bounding.width, y }] }, styles: { color: col, size: 1 } });
        figs.push({ type: 'text', ignoreEvent: true, attrs: { x: x0, y, text: r + ' (' + fmtP(chart, v) + ')', align: 'left', baseline: 'bottom' }, styles: { color: col, backgroundColor: 'transparent', size: 11 } });
        prevY = y; void i;
      });
      figs.push(lineFig(overlay, [a, b], { style: 'dashed' }));
      return figs;
    },
  });
  /* הרחבת פיבונאצ'י מבוססת מגמה (Trend-Based Fib Extension): A→B, ההשלכה מנקודה C */
  R({
    name: 'kcFibExt', totalStep: 4,
    createPointFigures: ({ chart, overlay, coordinates, bounding }) => {
      if (coordinates.length < 2) return [];
      const figs = [lineFig(overlay, coordinates, { style: 'dashed' })];
      if (coordinates.length < 3) return figs;
      const c = coordinates[2], dy = coordinates[1].y - coordinates[0].y, dv = valAt(overlay, 1) - valAt(overlay, 0), x0 = Math.min(coordinates[1].x, c.x);
      for (const [r, col] of FIB_EXT) {
        const y = c.y + dy * r, v = valAt(overlay, 2) + dv * r;
        figs.push({ type: 'line', attrs: { coordinates: [{ x: x0, y }, { x: bounding.width, y }] }, styles: { color: col, size: 1 } });
        figs.push({ type: 'text', ignoreEvent: true, attrs: { x: x0, y, text: r + ' (' + fmtP(chart, v) + ')', align: 'left', baseline: 'bottom' }, styles: { color: col, backgroundColor: 'transparent', size: 11 } });
      }
      return figs;
    },
  });
  /* אזורי זמן פיבונאצ'י (Fib Time Zones): קווים אנכיים במרחקי 0,1,2,3,5,8,13… מהמרווח שנבחר */
  R({
    name: 'kcFibTime', totalStep: 3, needDefaultYAxisFigure: false,
    createPointFigures: ({ overlay, coordinates, bounding }) => {
      if (coordinates.length < 2) return [];
      const u = coordinates[1].x - coordinates[0].x, figs = [];
      [0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89].forEach((f, i) => {
        const x = coordinates[0].x + u * f;
        figs.push({ type: 'line', attrs: { coordinates: [{ x, y: 0 }, { x, y: bounding.height }] }, styles: { color: rgba(FIB[i % FIB.length][1], 0.9), size: 1 } });
        figs.push({ type: 'text', ignoreEvent: true, attrs: { x: x + 3, y: 12, text: String(f), align: 'left', baseline: 'middle' }, styles: { color: oc(overlay), backgroundColor: 'transparent', size: 11 } });
      });
      return figs;
    },
  });
  /* מניפת מהירות פיבונאצ'י (Speed Resistance Fan) */
  R({
    name: 'kcFibFan', totalStep: 3,
    createPointFigures: ({ overlay, coordinates, bounding }) => {
      if (coordinates.length < 2) return [];
      const [a, b] = coordinates, figs = [];
      [[0, '#787B86'], [0.25, '#FF453A'], [0.382, '#FF9800'], [0.5, '#4CAF50'], [0.618, '#30D158'], [0.75, '#00BCD4'], [1, '#787B86']].forEach(([r, col]) => {
        const p = { x: b.x, y: b.y + (a.y - b.y) * r }, e = extendRay(a, p, bounding.width);
        figs.push({ type: 'line', attrs: { coordinates: [a, e] }, styles: { color: col, size: 1 } });
        figs.push({ type: 'text', ignoreEvent: true, attrs: { x: b.x + 3, y: p.y, text: String(r), align: 'left', baseline: 'middle' }, styles: { color: col, backgroundColor: 'transparent', size: 10 } });
      });
      figs.push(lineFig(overlay, [a, b], { style: 'dashed' }));
      return figs;
    },
  });
  /* מעגלי פיבונאצ'י */
  R({
    name: 'kcFibCircle', totalStep: 3,
    createPointFigures: ({ overlay, coordinates }) => {
      if (coordinates.length < 2) return [];
      const [a, b] = coordinates, d = Math.hypot(b.x - a.x, b.y - a.y), figs = [lineFig(overlay, [a, b], { style: 'dashed' })];
      [[0.236, '#FF453A'], [0.382, '#FF9800'], [0.5, '#4CAF50'], [0.618, '#30D158'], [0.786, '#00BCD4'], [1, '#787B86'], [1.618, '#9C27B0']].forEach(([r, col]) => figs.push({ type: 'circle', attrs: { x: a.x, y: a.y, r: d * r }, styles: { style: 'stroke', borderColor: col, borderSize: 1, color: 'transparent' } }));
      return figs;
    },
  });
  /* קופסת גאן (Gann Box): רשת יחסים 0.25/0.382/0.5/0.618/0.75 בשני הצירים + אלכסונים */
  R({
    name: 'kcGannBox', totalStep: 3,
    createPointFigures: ({ overlay, coordinates }) => {
      if (coordinates.length < 2) return [];
      const [a, b] = coordinates, figs = [polyFig([a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }], oc(overlay), 0.05)];
      const rs = [0, 0.25, 0.382, 0.5, 0.618, 0.75, 1];
      for (const r of rs) {
        const x = a.x + (b.x - a.x) * r, y = a.y + (b.y - a.y) * r;
        figs.push({ type: 'line', attrs: { coordinates: [{ x, y: a.y }, { x, y: b.y }] }, styles: { color: rgba(oc(overlay), 0.6), size: 1 } });
        figs.push({ type: 'line', attrs: { coordinates: [{ x: a.x, y }, { x: b.x, y }] }, styles: { color: rgba(oc(overlay), 0.6), size: 1 } });
      }
      figs.push(lineFig(overlay, [a, b]), lineFig(overlay, [{ x: a.x, y: b.y }, { x: b.x, y: a.y }]));
      return figs;
    },
  });

  /* פוזיציה Long / Short (הכלי האהוב ב־TradingView): כניסה, יעד, סטופ → יחס סיכוי/סיכון, אחוזים, כמות לפי סכום הסיכון */
  const position = (name, long) => R({
    name, totalStep: 4, needDefaultYAxisFigure: true,
    createPointFigures: ({ chart, overlay, coordinates, bounding }) => {
      if (!coordinates.length) return [];
      const e = coordinates[0], ev = valAt(overlay, 0);
      const x1 = coordinates[1] ? Math.max(coordinates[1].x, e.x + 40) : Math.min(bounding.width, e.x + 120);
      const tv = coordinates[1] ? valAt(overlay, 1) : null, sv0 = coordinates[2] ? valAt(overlay, 2) : null;
      const yt = coordinates[1] ? coordinates[1].y : null, ys = coordinates[2] ? coordinates[2].y : null;
      const figs = [];
      if (yt != null) figs.push({ type: 'polygon', attrs: { coordinates: [{ x: e.x, y: e.y }, { x: x1, y: e.y }, { x: x1, y: yt }, { x: e.x, y: yt }] }, styles: { style: 'fill', color: 'rgba(48,209,88,.2)' } });
      if (ys != null) figs.push({ type: 'polygon', attrs: { coordinates: [{ x: e.x, y: e.y }, { x: x1, y: e.y }, { x: x1, y: ys }, { x: e.x, y: ys }] }, styles: { style: 'fill', color: 'rgba(255,69,58,.2)' } });
      figs.push({ type: 'line', attrs: { coordinates: [{ x: e.x, y: e.y }, { x: x1, y: e.y }] }, styles: { color: '#787B86', size: 1 } });
      const risk = (S.store && S.store.g.risk) || 100;
      if (tv != null && sv0 != null) {
        const pc = L.positionCalc(ev, sv0, tv, risk);
        const okDir = long ? tv > ev && sv0 < ev : tv < ev && sv0 > ev;
        figs.push(textFig(e.x + 4, yt + (long ? 10 : -10), T('kcPosTarget') + ' ' + fmtP(chart, tv) + ' (' + fmtPct(pc.targetPct) + ')', '#30D158'));
        figs.push(textFig(e.x + 4, ys + (long ? -10 : 10), T('kcPosStop') + ' ' + fmtP(chart, sv0) + ' (' + fmtPct(pc.stopPct) + ')', '#FF453A'));
        figs.push(textFig(e.x + 4, e.y, (okDir ? T('kcPosRR', { v: pc.rr.toFixed(2) }) : T('kcPosBad')) + ' · ' + T('kcPosQty', { q: pc.qty, r: risk }), okDir ? '#0A84FF' : '#787B86'));
      } else if (tv != null) figs.push(textFig(e.x + 4, yt, T('kcPosTarget') + ' ' + fmtP(chart, tv), '#30D158'));
      return figs;
    },
  });
  position('kcLong', true);
  position('kcShort', false);

  /* מדידות (Price Range / Date Range / Date & Price Range) — לפי ת־גרף: מלבן שקוף, חץ אנכי (מחיר) וחץ אופקי (זמן)
     עם ראשי חצים לכיוון נקודת הסיום, וכרטיס של שתי שורות (28/10/2026): שינוי למניה (אחוז), ואז "18 ימים, 12 נרות". כחול לעלייה, אדום לירידה */
  const arrowFig = (x1, y1, x2, y2, col) => {
    const ang = Math.atan2(y2 - y1, x2 - x1), k = 7, s1 = ang + Math.PI * 0.82, s2 = ang - Math.PI * 0.82;
    return [{ type: 'line', ignoreEvent: true, attrs: { coordinates: [{ x: x1, y: y1 }, { x: x2, y: y2 }] }, styles: { color: col, size: 1.5 } },
      { type: 'line', ignoreEvent: true, attrs: { coordinates: [{ x: x2 + Math.cos(s1) * k, y: y2 + Math.sin(s1) * k }, { x: x2, y: y2 }, { x: x2 + Math.cos(s2) * k, y: y2 + Math.sin(s2) * k }] }, styles: { color: col, size: 1.5 } }];
  };
  const LRM = '\u200E';
  const mBlue = () => (isDark() ? '#0A84FF' : '#007AFF');   // כחול המערכת — אותו צבע בעלייה ובירידה (המדידה ניטרלית, לא ירוק/אדום)
  const mSel = (o) => !!(S.sel && !S.sel.alert && S.sel.id === o.id);
  const mCell = (chart) => S.cells.find((x) => x.chart === chart);
  const axDate = (chart, ts) => {
    const c = mCell(chart), intra = c ? L.isIntraday(c.tf) : false, tz = S.store && S.store.g.tz === 'local' ? undefined : (c && c.tz) || 'America/New_York';
    try { return new Date(ts).toLocaleString(E.lang === 'en' ? 'en-US' : 'he-IL', Object.assign({ timeZone: tz, day: '2-digit', month: 'short', year: '2-digit' }, intra ? { hour: '2-digit', minute: '2-digit', hour12: false } : {})); } catch (e) { return new Date(ts).toISOString().slice(0, 10); }
  };
  const measure = (name, mode) => R({
    name, totalStep: 3, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false,
    // נבחרה: פס כחול על ציר המחיר בין שני המחירים ותוויות כחולות על שני הצירים
    createYAxisFigures: ({ chart, overlay, coordinates, bounding, yAxis }) => {
      if (coordinates.length < 2 || mode === 'd' || !mSel(overlay)) return [];
      const col = mBlue(), left = yAxis && yAxis.isFromZero && yAxis.isFromZero(), [a, b] = coordinates, y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
      return [{ type: 'rect', ignoreEvent: true, attrs: { x: 0, y: y0, width: bounding.width, height: y1 - y0 }, styles: { style: 'fill', color: rgba(col, 0.18) } },
        ...[0, 1].map((i) => textFig(left ? 0 : bounding.width, coordinates[i].y, fmtP(chart, valAt(overlay, i)), col, { attrs: { align: left ? 'left' : 'right' }, styles: { paddingTop: 3, paddingBottom: 3, borderRadius: 4 } }))];
    },
    // נבחרה: פס כחול על ציר הזמן ושני התאריכים
    createXAxisFigures: ({ chart, overlay, coordinates, bounding }) => {
      if (coordinates.length < 2 || mode === 'p' || !mSel(overlay)) return [];
      const col = mBlue(), [a, b] = coordinates, x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y = bounding.height / 2;
      return [{ type: 'rect', ignoreEvent: true, attrs: { x: x0, y: 0, width: x1 - x0, height: bounding.height }, styles: { style: 'fill', color: rgba(col, 0.18) } },
        // שני תאריכים קרובים — לא אחד על השני: השמאלי נצמד שמאלה מהנקודה שלו והימני ימינה
        ...[0, 1].map((i) => { const near = x1 - x0 < 120, lo = coordinates[i].x === x0 && (i === 0 || a.x !== b.x);
          return textFig(coordinates[i].x, y, axDate(chart, overlay.points[i].timestamp), col, { attrs: { align: near ? (lo ? 'right' : 'left') : 'center' }, styles: { paddingTop: 3, paddingBottom: 3, borderRadius: 4 } }); })];
    },
    createPointFigures: ({ chart, overlay, coordinates }) => {
      if (coordinates.length < 2) return [];
      const [a, b] = coordinates, list = chart.getDataList();
      const ia = dataIdx(list, overlay.points[0].timestamp), ib = dataIdx(list, overlay.points[1].timestamp);
      const st = L.rangeStats(list, ia, ib), v0 = valAt(overlay, 0), dv = valAt(overlay, 1) - v0, pct = v0 ? dv / v0 * 100 : 0;
      const up = mode === 'd' ? b.x >= a.x : dv >= 0, col = mBlue(), p = palette();
      const lines = [];
      if (mode !== 'd') lines.push(LRM + (dv >= 0 ? '' : '−') + fmtP(chart, Math.abs(dv)) + ' (' + (dv >= 0 ? '' : '−') + Math.abs(pct).toFixed(2) + '%)');
      if (mode !== 'p' && st) lines.push(LRM + fmtDurW(Math.abs(overlay.points[1].timestamp - overlay.points[0].timestamp)) + ', ' + LRM + (ib - ia) + ' ' + T('kcBarsW'));
      const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y), mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
      const figs = [{ type: 'polygon', ignoreEvent: true, attrs: { coordinates: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }] }, styles: { style: 'fill', color: rgba(col, 0.2) } }];
      if (mode !== 'd') figs.push(...arrowFig(mx, a.y, mx, b.y, col));
      if (mode !== 'p') figs.push(...arrowFig(a.x, my, b.x, my, col));
      // הכרטיס: מעל המלבן בעלייה, מתחת בירידה (לפי ת־גרף)
      const fs = 13, lh = 18, w = Math.max(...lines.map((l) => l.length)) * 7.1 + 28, hh = lines.length * lh + 12, rr = Math.min(hh / 2, 14);
      const ty = (mode === 'd' ? true : up) ? y0 - 8 - hh : y1 + 8;
      // בועת זכוכית: צל רך, מילוי שקוף למחצה, קו שיער (הקנבס לא מטשטש — המילוי אטום מספיק לקריאות)
      figs.push({ type: 'rect', ignoreEvent: true, attrs: { x: mx - w / 2, y: ty + 2, width: w, height: hh }, styles: { style: 'fill', color: p.glassSh, borderRadius: rr } });
      figs.push({ type: 'rect', ignoreEvent: true, attrs: { x: mx - w / 2, y: ty, width: w, height: hh }, styles: { style: 'stroke_fill', color: p.glass, borderColor: p.glassLine, borderSize: 1, borderRadius: rr } });
      lines.forEach((l, i) => figs.push({ type: 'text', ignoreEvent: true, attrs: { x: mx, y: ty + 6 + lh * i + lh / 2, text: l, align: 'center', baseline: 'middle' }, styles: { color: i === 0 && mode !== 'd' ? (dv >= 0 ? p.up : p.dn) : (isDark() ? '#F2F2F7' : '#1C1C1E'), size: fs, weight: 600, family: p.font, backgroundColor: 'transparent', borderSize: 0, paddingLeft: 0, paddingRight: 0, paddingTop: 0, paddingBottom: 0 } }));
      // נבחרה: עיגולים חלולים גדולים בשתי הנקודות (ידיות לגרירה)
      if (mSel(overlay)) for (const q of [a, b]) figs.push({ type: 'circle', ignoreEvent: true, attrs: { x: q.x, y: q.y, r: 9 }, styles: { style: 'stroke_fill', color: p.tipBg, borderColor: col, borderSize: 2.5 } });
      return figs;
    },
  });
  measure('kcPriceRange', 'p');
  measure('kcDateRange', 'd');
  measure('kcMeasure', 'pd');

  /* VWAP מעוגן (Anchored VWAP) מנקודה שנבחרה עד הנר האחרון */
  R({
    name: 'kcAvwap', totalStep: 2, needDefaultYAxisFigure: false,
    createPointFigures: ({ chart, overlay, coordinates }) => {
      if (!coordinates.length) return [];
      const list = chart.getDataList(), i0 = dataIdx(list, overlay.points[0].timestamp), pts = [];
      let pv = 0, vv = 0;
      for (let i = i0; i < list.length; i++) {
        const b = list[i], v = b.volume || 1;
        pv += (b.high + b.low + b.close) / 3 * v; vv += v;
        pts.push({ timestamp: b.timestamp, value: pv / vv });
      }
      if (pts.length < 2) return [];
      const cs = chart.convertToPixel(pts, { paneId: MAIN });
      const last = cs[cs.length - 1];
      return [lineFig(overlay, cs, { size: Math.max(1.5, ow(overlay)) }), textFig(last.x + 4, last.y, 'AVWAP ' + fmtP(chart, pts[pts.length - 1].value), oc(overlay))];
    },
  });
  /* פרופיל נפח לטווח קבוע (Fixed Range Volume Profile) */
  R({
    name: 'kcVolProfile', totalStep: 3, needDefaultYAxisFigure: false,
    createPointFigures: ({ chart, overlay, coordinates }) => {
      if (coordinates.length < 2) return [];
      const list = chart.getDataList();
      let ia = dataIdx(list, overlay.points[0].timestamp), ib = dataIdx(list, overlay.points[1].timestamp);
      if (ia > ib) [ia, ib] = [ib, ia];
      const vp = L.volumeProfile(list.slice(ia, ib + 1), 24);
      if (!vp) return [];
      const x0 = Math.min(coordinates[0].x, coordinates[1].x), x1 = Math.max(coordinates[0].x, coordinates[1].x), W = Math.max(30, (x1 - x0) * 0.7);
      const figs = [];
      const yOf = (v) => px(chart, list[ia].timestamp, v).y;
      for (let r = 0; r < vp.tot.length; r++) {
        const yTop = yOf(vp.lo + vp.step * (r + 1)), yBot = yOf(vp.lo + vp.step * r), hgt = Math.max(1, yBot - yTop - 1);
        const wu = W * vp.up[r] / vp.max, wd = W * vp.dn[r] / vp.max, inVA = vp.lo + vp.step * r >= vp.val - 1e-9 && vp.lo + vp.step * (r + 1) <= vp.vah + 1e-9;
        figs.push({ type: 'rect', ignoreEvent: true, attrs: { x: x0, y: yTop, width: wu, height: hgt }, styles: { style: 'fill', color: inVA ? 'rgba(48,209,88,.42)' : 'rgba(48,209,88,.18)' } });
        figs.push({ type: 'rect', ignoreEvent: true, attrs: { x: x0 + wu, y: yTop, width: wd, height: hgt }, styles: { style: 'fill', color: inVA ? 'rgba(255,69,58,.42)' : 'rgba(255,69,58,.18)' } });
      }
      const yp = yOf(vp.pocPrice);
      figs.push({ type: 'line', attrs: { coordinates: [{ x: x0, y: yp }, { x: x1, y: yp }] }, styles: { color: '#FF9800', size: 1.5 } });
      figs.push(polyFig([{ x: x0, y: coordinates[0].y }, { x: x1, y: coordinates[0].y }, { x: x1, y: coordinates[1].y }, { x: x0, y: coordinates[1].y }], oc(overlay), 0.04));
      figs.push(textFig(x1 + 4, yp, 'POC ' + fmtP(chart, vp.pocPrice), '#FF9800'));
      return figs;
    },
  });

  /* צורות */
  R({ name: 'kcRect', totalStep: 3, createPointFigures: ({ overlay, coordinates }) => (coordinates.length < 2 ? [] : [polyFig([coordinates[0], { x: coordinates[1].x, y: coordinates[0].y }, coordinates[1], { x: coordinates[0].x, y: coordinates[1].y }], oc(overlay), 0.14), lineFig(overlay, [coordinates[0], { x: coordinates[1].x, y: coordinates[0].y }, coordinates[1], { x: coordinates[0].x, y: coordinates[1].y }, coordinates[0]])]) });
  R({ name: 'kcCircle', totalStep: 3, needDefaultYAxisFigure: false, createPointFigures: ({ overlay, coordinates }) => (coordinates.length < 2 ? [] : [{ type: 'circle', attrs: { x: coordinates[0].x, y: coordinates[0].y, r: Math.hypot(coordinates[1].x - coordinates[0].x, coordinates[1].y - coordinates[0].y) }, styles: { style: 'stroke_fill', color: rgba(oc(overlay), 0.12), borderColor: oc(overlay), borderSize: ow(overlay) } }]) });
  R({ name: 'kcTriangle', totalStep: 4, needDefaultYAxisFigure: false, createPointFigures: ({ overlay, coordinates }) => (coordinates.length < 2 ? [] : coordinates.length < 3 ? [lineFig(overlay, coordinates)] : [polyFig(coordinates, oc(overlay), 0.14), lineFig(overlay, coordinates.concat([coordinates[0]]))]) });
  R({ name: 'kcCycle', totalStep: 3, needDefaultYAxisFigure: false, createPointFigures: ({ overlay, coordinates, bounding }) => {
    if (coordinates.length < 2) return [];
    const u = Math.abs(coordinates[1].x - coordinates[0].x), figs = [];
    if (u < 3) return [];
    for (let x = Math.min(coordinates[0].x, coordinates[1].x); x < bounding.width; x += u) figs.push(lineFig(overlay, [{ x, y: 0 }, { x, y: bounding.height }], { style: 'dashed' }));
    return figs;
  } });

  /* טקסט, הערה (Callout), תגית מחיר, חצים וסימון */
  R({ name: 'kcText', totalStep: 2, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false, createPointFigures: ({ overlay, coordinates }) => (coordinates.length ? [{ type: 'text', attrs: { x: coordinates[0].x, y: coordinates[0].y, text: (overlay.extendData && overlay.extendData.text) || T('kcTextPh'), align: 'left', baseline: 'middle' }, styles: { color: oc(overlay), backgroundColor: 'transparent', borderColor: 'transparent', size: 12 + ow(overlay) * 2, weight: '600' } }] : []) });
  R({ name: 'kcNote', totalStep: 3, needDefaultXAxisFigure: false, createPointFigures: ({ overlay, coordinates }) => {
    if (!coordinates.length) return [];
    const t = (overlay.extendData && overlay.extendData.text) || T('kcTextPh'), b = coordinates[1] || { x: coordinates[0].x + 40, y: coordinates[0].y - 40 };
    return [lineFig(overlay, [coordinates[0], b]), textFig(b.x, b.y, t, oc(overlay), { styles: { size: 12, paddingLeft: 6, paddingRight: 6, paddingTop: 4, paddingBottom: 4, borderRadius: 4 } })];
  } });
  R({ name: 'kcPriceLabel', totalStep: 2, needDefaultXAxisFigure: false, createPointFigures: ({ chart, overlay, coordinates }) => (coordinates.length ? [textFig(coordinates[0].x + 8, coordinates[0].y - 12, fmtP(chart, valAt(overlay, 0)), oc(overlay)), lineFig(overlay, [coordinates[0], { x: coordinates[0].x + 8, y: coordinates[0].y - 12 }])] : []) });
  const mark = (name, up) => R({ name, totalStep: 2, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false, createPointFigures: ({ coordinates }) => {
    if (!coordinates.length) return [];
    const { x, y } = coordinates[0], c = up ? '#30D158' : '#FF453A', s = up ? 1 : -1;
    return [{ type: 'polygon', attrs: { coordinates: [{ x, y }, { x: x - 9, y: y + 12 * s }, { x: x - 3.5, y: y + 12 * s }, { x: x - 3.5, y: y + 22 * s }, { x: x + 3.5, y: y + 22 * s }, { x: x + 3.5, y: y + 12 * s }, { x: x + 9, y: y + 12 * s }] }, styles: { style: 'fill', color: c } }];
  } });
  mark('kcArrowUp', true);
  mark('kcArrowDown', false);
  R({ name: 'kcFlag', totalStep: 2, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false, createPointFigures: ({ overlay, coordinates }) => {
    if (!coordinates.length) return [];
    const { x, y } = coordinates[0];
    return [lineFig(overlay, [{ x, y }, { x, y: y - 26 }], { size: 2 }), { type: 'polygon', attrs: { coordinates: [{ x, y: y - 26 }, { x: x + 16, y: y - 21 }, { x, y: y - 16 }] }, styles: { style: 'fill', color: oc(overlay) } }];
  } });

  /* קו התראה (פעמון) — נקבע ממסך ההתראות; גרירה מעדכנת את מחיר ההתראה */
  R({
    name: 'kcAlert', totalStep: 2, needDefaultXAxisFigure: false,
    createPointFigures: ({ chart, overlay, coordinates, bounding }) => {
      if (!coordinates.length) return [];
      const y = coordinates[0].y, done = overlay.extendData && overlay.extendData.done, c = done ? '#787B86' : '#FF9800';
      return [{ type: 'line', attrs: { coordinates: [{ x: 0, y }, { x: bounding.width, y }] }, styles: { color: c, size: 1, style: 'dashed', dashedValue: [6, 4] } },
        textFig(6, y, '🔔 ' + fmtP(chart, valAt(overlay, 0)) + (overlay.extendData && overlay.extendData.note ? ' · ' + overlay.extendData.note : ''), c)];
    },
  });

  /* מחיר טרום/אחרי/לילי כשהגרף מציג רק מסחר רגיל: קו מקווקו, גלולה "טרום/אחרי/לילי" צמודה לציר
     ותווית המחיר בציר, בצבע של הסשן (טרום כתום, אחרי כחול, לילי סגול — extendData.k; לפי ת־גרף) */
  R({
    name: 'kcExtPx', totalStep: 2, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false,
    createPointFigures: ({ overlay, coordinates, bounding }) => {
      if (!coordinates.length) return [];
      const y = coordinates[0].y, d = overlay.extendData || {}, col = EXTC[d.k] || EXTC.post;
      return [{ type: 'line', ignoreEvent: true, attrs: { coordinates: [{ x: 0, y }, { x: bounding.width, y }] }, styles: { color: col, size: 1, style: 'dashed', dashedValue: [2, 2] } },
        textFig(bounding.width, y, d.t || '', col, { attrs: { align: 'right' }, styles: { paddingLeft: 6, paddingRight: 6, paddingTop: 3, borderRadius: 3 } })];
    },
    createYAxisFigures: ({ chart, overlay, coordinates, bounding, yAxis }) => {
      if (!coordinates.length) return [];
      const left = yAxis && yAxis.isFromZero && yAxis.isFromZero();
      return [textFig(left ? 0 : bounding.width, coordinates[0].y, fmtP(chart, valAt(overlay, 0)), EXTC[(overlay.extendData || {}).k] || EXTC.post, { attrs: { align: left ? 'left' : 'right' }, styles: { paddingTop: 3, borderRadius: 3 } })];
    },
  });

  /* חץ עסקה (מ־Flex/ידני): משולש ירוק מתחת לנר בקנייה, אדום מעל במכירה, והכמות לידו. נעול, לא נבחר */
  R({
    name: 'kcFill', totalStep: 2, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false,
    createPointFigures: ({ overlay, coordinates }) => {
      if (!coordinates.length) return [];
      const d = overlay.extendData || {}, x = coordinates[0].x, s = d.buy ? 1 : -1, y = coordinates[0].y + 5 * s, c = d.buy ? '#30D158' : '#FF453A';
      return [{ type: 'polygon', ignoreEvent: true, attrs: { coordinates: [{ x, y }, { x: x - 6, y: y + 9 * s }, { x: x + 6, y: y + 9 * s }] }, styles: { style: 'fill', color: c } },
        { type: 'text', ignoreEvent: true, attrs: { x, y: y + 11 * s, text: d.t || '', align: 'center', baseline: d.buy ? 'top' : 'bottom' }, styles: { color: c, backgroundColor: 'transparent', size: 10, weight: 600 } }];
    },
  });
  /* קו המחיר הממוצע של הפוזיציה — קו מלא דק, תגית "N מניות · ממוצע X · רווח/הפסד חי" ותווית בציר (כמו kcExtPx) */
  R({
    name: 'kcPos', totalStep: 2, needDefaultXAxisFigure: false, needDefaultYAxisFigure: false,
    createPointFigures: ({ overlay, coordinates, bounding }) => {
      if (!coordinates.length) return [];
      const y = coordinates[0].y, d = overlay.extendData || {}, c = d.c || '#787B86';
      return [{ type: 'line', ignoreEvent: true, attrs: { coordinates: [{ x: 0, y }, { x: bounding.width, y }] }, styles: { color: c, size: 1, style: 'solid' } },
        textFig(6, y, d.t || '', c, { styles: { size: 10, borderRadius: 3 } })];
    },
    createYAxisFigures: ({ chart, overlay, coordinates, bounding, yAxis }) => {
      if (!coordinates.length) return [];
      const left = yAxis && yAxis.isFromZero && yAxis.isFromZero(), c = (overlay.extendData && overlay.extendData.c) || '#787B86';
      return [textFig(left ? 0 : bounding.width, coordinates[0].y, fmtP(chart, valAt(overlay, 0)), c, { attrs: { align: left ? 'left' : 'right' }, styles: { paddingTop: 3, borderRadius: 3 } })];
    },
  });

  /* תבניות: XABCD (הרמוניות), ABCD, גלי אליוט (5 ו־ABC), ראש וכתפיים, משולש, שלושה דחפים */
  R(wavePattern('kcXABCD', ['X', 'A', 'B', 'C', 'D'], [[0, 1, 2], [1, 2, 3], [2, 3, 4], [0, 1, 4]]));
  R(wavePattern('kcABCD', ['A', 'B', 'C', 'D'], [[0, 1, 2], [1, 2, 3]]));
  R(wavePattern('kcElliott5', ['0', '1', '2', '3', '4', '5']));
  R(wavePattern('kcElliott3', ['0', 'A', 'B', 'C']));
  R(wavePattern('kcElliottWXY', ['0', 'W', 'X', 'Y']));
  R(wavePattern('kcHS', ['', 'LS', '', 'H', '', 'RS', '']));
  R(wavePattern('kcTriPat', ['A', 'B', 'C', 'D']));
  R(wavePattern('kcThreeDrives', ['', '1', '', '2', '', '3']));
}

/* ---------- קטלוג הכלים (סרגל הציור) — קבוצות לפי ת־גרף ---------- */
const TOOLS = [
  ['kcGLines', [['segment', 'kcToTrend', 'trend'], ['rayLine', 'kcToRay', 'ray'], ['kcInfoLine', 'kcToInfo', 'info'], ['straightLine', 'kcToExt', 'extline'], ['kcArrow', 'kcToArrow', 'arrow'],
    ['horizontalStraightLine', 'kcToHLine', 'hline'], ['horizontalRayLine', 'kcToHRay', 'hray'], ['verticalStraightLine', 'kcToVLine', 'vline'], ['kcCrossLine', 'kcToCross', 'crossline'], ['priceLine', 'kcToPriceLine', 'tag']]],
  ['kcGChannels', [['parallelStraightLine', 'kcToParallel', 'channel'], ['priceChannelLine', 'kcToPChannel', 'pchannel'], ['kcRegression', 'kcToRegress', 'regress'], ['kcPitchfork', 'kcToFork', 'fork']]],
  ['kcGFib', [['kcFibRet', 'kcToFib', 'fib'], ['kcFibExt', 'kcToFibExt', 'fibext'], ['kcFibTime', 'kcToFibTime', 'fibtime'], ['kcFibFan', 'kcToFibFan', 'fan'], ['kcFibCircle', 'kcToFibCircle', 'fibcircle'], ['kcGannBox', 'kcToGann', 'gann'], ['kcCycle', 'kcToCycle', 'fibtime']]],
  ['kcGPatterns', [['kcXABCD', 'kcToXABCD', 'xabcd'], ['kcABCD', 'kcToABCD', 'abcd'], ['kcHS', 'kcToHS', 'hs'], ['kcTriPat', 'kcToTriPat', 'tri'], ['kcThreeDrives', 'kcToDrives', 'wave'], ['kcElliott5', 'kcToEw5', 'wave'], ['kcElliott3', 'kcToEw3', 'abcd'], ['kcElliottWXY', 'kcToEwWXY', 'abcd']]],
  ['kcGForecast', [['kcLong', 'kcToLong', 'long'], ['kcShort', 'kcToShort', 'short'], ['kcPriceRange', 'kcToPRange', 'prange'], ['kcDateRange', 'kcToDRange', 'drange'], ['kcMeasure', 'kcToMeasure', 'ruler'], ['kcAvwap', 'kcToAvwap', 'avwap'], ['kcVolProfile', 'kcToVP', 'vprofile']]],
  ['kcGShapes', [['brush', 'kcToBrush', 'brush'], ['kcRect', 'kcToRect', 'rect'], ['kcCircle', 'kcToCircle', 'circle'], ['kcTriangle', 'kcToTriangle', 'tri']]],
  ['kcGText', [['kcText', 'kcToText', 'text'], ['kcNote', 'kcToNote', 'note'], ['kcPriceLabel', 'kcToPLabel', 'tag'], ['simpleAnnotation', 'kcToAnno', 'note'], ['kcArrowUp', 'kcToUp', 'up'], ['kcArrowDown', 'kcToDown', 'down'], ['kcFlag', 'kcToFlag', 'flag']]],
];
const TOOL_INFO = {};
for (const [, items] of TOOLS) for (const [name, key, icon] of items) TOOL_INFO[name] = { key, icon };
const TEXT_TOOLS = new Set(['kcText', 'kcNote']);

/* ---------- מצב שמור (pwa_charts_v1 דרך env.store — מפתח אישי לכל חשבון) ----------
   g = העדפות כלליות + הגרפים במסך (סימבול/טווח/סוג/אינדיקטורים לכל תא, כמו "Layout" של TradingView)
   s = לכל מניה: השרטוטים (כמו TV — שרטוט שייך למניה, בכל טווח זמן) · alerts = התראות מחיר לכל מניה */
const DEF_FAV = ['1m', '5m', '15m', '1h', '4h', '1D', '1W'];
const DEF_IND = [{ n: 'KCVOL', main: true }];
function loadStore() {
  let o = null;
  try { o = E.store && E.store.get(); } catch (e) { o = null; }
  o = o && typeof o === 'object' ? o : {};
  const g = o.g && typeof o.g === 'object' ? o.g : {};
  const cellsIn = Array.isArray(g.cells) ? g.cells.slice(0, 4) : [];
  const cells = cellsIn.map((c) => { const s = L.sanitizeLayout(c); return { sym: typeof c.sym === 'string' ? c.sym.slice(0, 20) : '', tf: s.tf, type: s.type, ind: s.ind }; });
  return {
    g: {
      layout: [1, 2, 3, 4, 5].includes(g.layout) ? g.layout : 1, fav: Array.isArray(g.fav) ? g.fav.filter((x) => TF[x]).slice(0, 12) : DEF_FAV.slice(),
      ext: g.extV === 2 ? !!g.ext : true, extV: 2, tz: g.tz === 'ex' ? 'ex' : 'local', colors: ['tv', 'app', 'mono'].includes(g.colors) ? g.colors : 'app', grid: g.grid === 0 ? 0 : 1,
      risk: +g.risk > 0 ? +g.risk : 100, scale: ['normal', 'logarithm', 'percentage'].includes(g.scale) ? g.scale : 'normal', hl: g.hl === 0 ? 0 : 1,
      syncSym: !!g.syncSym, syncTf: !!g.syncTf, stay: !!g.stay, fills: g.fills === 0 ? 0 : 1, cells, indFav: Array.isArray(g.indFav) ? g.indFav.filter((x) => typeof x === 'string').slice(0, 30) : [],
    },
    s: o.s && typeof o.s === 'object' ? o.s : {},
    alerts: o.alerts && typeof o.alerts === 'object' ? o.alerts : {},
  };
}
let saveT = null;
function save() {
  if (!S.store) return;
  clearTimeout(saveT);
  saveT = setTimeout(saveNow, 600);
}
function saveNow() {
  clearTimeout(saveT); saveT = null;
  if (!S.store || !E || !E.store) return;
  // בלי הגרף פתוח (התראה מכרטיס המניה) — S.cells ריק, והפריסה השמורה נשארת כמו שהיא
  if (S.cells.length) S.store.g.cells = S.cells.map((c) => ({ sym: c.sym, tf: c.tf, type: c.type, ind: c.chart ? indSnap(c) : c.indSaved || [] }));
  for (const c of S.cells) if (c.chart && c.drawnFor === c.sym) {
    const dr = drawSnap(c);
    if (dr.length) S.store.s[c.sym] = { dr }; else delete S.store.s[c.sym];
  }
  // עד 200 מניות עם שרטוטים — הישנות נמחקות ראשונות (סדר ההכנסה)
  const ks = Object.keys(S.store.s);
  if (ks.length > 200) for (const k of ks.slice(0, ks.length - 200)) delete S.store.s[k];
  try { E.store.set({ v: 1, g: S.store.g, s: S.store.s, alerts: S.store.alerts }); } catch (e) { /* מכסה מלאה — לא מפילים את המסך */ }
}
function indSnap(c) {
  return c.chart.getIndicators().filter((i) => i.name !== 'KCBT').map((i) => ({ n: i.name, p: (i.calcParams || []).filter((v) => typeof v === 'number'), main: i.paneId === MAIN, h: i.visible === false ? 1 : 0, sym: i.extendData && i.extendData.sym }));
}
function drawSnap(c) {
  return c.chart.getOverlays({ groupId: 'user' }).filter((o) => o.points && o.points.length && o.currentStep === -1)
    .map((o) => ({ name: o.name, points: o.points.map((p) => ({ timestamp: p.timestamp, value: p.value })), styles: o.styles || undefined, lock: !!o.lock, ext: o.extendData && typeof o.extendData === 'object' ? o.extendData : undefined, hide: o.visible === false }));
}

/* ---------- תא = גרף אחד במסך (עד 4) ---------- */
const BASESEC = { '1m': 60, '2m': 120, '5m': 300, '15m': 900, '30m': 1800, '60m': 3600, '1d': 86400, '1wk': 604800, '1mo': 2592000 };
function newCell(i, conf) {
  return { i, sym: conf.sym, tf: TF[conf.tf] ? conf.tf : '1D', type: conf.type || 'candle_solid', indSaved: conf.ind && conf.ind.length ? conf.ind : DEF_IND, raw: [], disp: [], more: false, tz: 'America/New_York', cur: '', name: '', chart: null, sub: null, el: null, host: null, lastVol: null, q: null, replay: null, undo: [], redo: [], snap: '[]', seq: 0, err: null, loading: false, drawnFor: null, cmpCache: new Map(), secReal: TF[conf.tf] ? TF[conf.tf].sec : 86400 };
}
const candleType = (t) => (t === 'line' || t === 'area' ? 'area' : t === 'candle_up_stroke' || t === 'ohlc' ? t : 'candle_solid');
function palette() {
  // ברירת המחדל: הצבעים של האפליקציה (iOS — ‎--gain/--loss, רקע מערכת). "קלאסי" = הפלטה של TradingView
  const dk = isDark(), g = S.store.g;
  let up = css('--gain') || '#30D158', dn = css('--loss') || '#FF453A';
  if (g.colors === 'tv') { up = '#089981'; dn = '#F23645'; }
  if (g.colors === 'mono') { up = dk ? '#E5E5EA' : '#1C1C1E'; dn = dk ? '#636366' : '#AEAEB2'; }
  return {
    up, dn, text: dk ? '#98989D' : '#636366', grid: dk ? 'rgba(255,255,255,.07)' : 'rgba(60,60,67,.08)', axis: dk ? 'rgba(255,255,255,.14)' : 'rgba(60,60,67,.14)',
    bg: dk ? '#000000' : '#FFFFFF', cross: dk ? '#8E8E93' : '#8E8E93', tipBg: dk ? '#1C1C1E' : '#FFFFFF', label: dk ? '#48484A' : '#1C1C1E',
    glass: dk ? 'rgba(58,58,60,.84)' : 'rgba(255,255,255,.86)', glassLine: dk ? 'rgba(255,255,255,.24)' : 'rgba(0,0,0,.08)', glassSh: dk ? 'rgba(0,0,0,.45)' : 'rgba(0,0,0,.10)',   // בועות על הגרף — זכוכית (לפי ת־עיצוב) font: css('--font') || '-apple-system, system-ui, sans-serif',
  };
}
/* בטלפון הכותרת היא זכוכית שקופה מעל הגרף — בתא העליון המקרא ובוררי הפינה יורדים מתחתיה.
   --kc-toph על התא (CSSOM, לא מאפיין style — CSP) */
function topPad(c) {
  let t = 0;
  try { if (UI.top && c && c.el && getComputedStyle(UI.top).position === 'absolute' && c.el.offsetTop < 4) t = UI.top.offsetHeight; } catch (e) { t = 0; }
  if (c && c.el) c.el.style.setProperty('--kc-toph', t + 'px');
  if (t && ROOT) ROOT.style.setProperty('--kc-toph', t + 'px');   // גם לסרגל עריכת השרטוט, שהוא ילד של השורש
  return t ? t + 4 : 6;   // צמוד מתחת לכותרת (הטשטוש נגמר בקצה שלה — המקרא חד). t נמדד, כך שבועה גבוהה ("השוק סגור") מורידה אותו
}
/* בטלפון הסרגל התחתון צף (זכוכית) מעל הגרף — ציר התאריכים גדל בגובה הסרגל, כך שהתאריכים נשארים מעליו */
function xSize() {
  try { if (UI.mbar && getComputedStyle(UI.mbar).position === 'absolute') return 26 + UI.mbar.offsetHeight; } catch (e) { /* ברירת מחדל */ }
  return 'auto';
}
function chartStyles(c) {
  const p = palette(), g = S.store.g, line = c.type === 'line';
  const axis = { axisLine: { color: p.axis }, tickLine: { color: p.axis }, tickText: { color: p.text, size: 11, family: p.font } };
  return {
    grid: { show: g.grid !== 0, horizontal: { color: p.grid, style: 'solid' }, vertical: { color: p.grid, style: 'solid' } },
    candle: {
      type: candleType(c.type),
      bar: { upColor: p.up, downColor: p.dn, noChangeColor: p.text, upBorderColor: p.up, downBorderColor: p.dn, noChangeBorderColor: p.text, upWickColor: p.up, downWickColor: p.dn, noChangeWickColor: p.text },
      area: { lineSize: 2, lineColor: p.up, value: 'close', smooth: false, backgroundColor: line ? [{ offset: 0, color: rgba(p.up, 0) }, { offset: 1, color: rgba(p.up, 0) }] : [{ offset: 0, color: rgba(p.up, 0.02) }, { offset: 1, color: rgba(p.up, 0.26) }], point: { show: false } },   // לפי ת־עיצוב Stocks
      priceMark: { show: true, high: { show: g.hl !== 0, color: p.text }, low: { show: g.hl !== 0, color: p.text }, last: { show: true, upColor: p.up, downColor: p.dn, noChangeColor: p.text, line: { show: true, style: 'dashed', dashedValue: [2, 2], size: 1 }, text: { show: true, style: 'fill', size: 11, weight: '600', family: p.font, color: '#FFFFFF', borderStyle: 'solid', borderColor: 'transparent', borderSize: 0, borderDashedValue: [2, 2], paddingLeft: 4, paddingRight: 4, paddingTop: 3, paddingBottom: 2, borderRadius: 3 }, extendTexts: [{ show: true, position: 'below_price', style: 'fill', size: 10, weight: '500', family: p.font, color: '#FFFFFF', backgroundColor: null, borderStyle: 'solid', borderColor: 'transparent', borderSize: 0, borderDashedValue: [2, 2], paddingLeft: 4, paddingRight: 4, paddingTop: 1, paddingBottom: 3, borderRadius: 3, updateInterval: 1000 }] } },
      tooltip: {
        showRule: 'always', showType: 'standard', offsetTop: topPad(c),
        rect: { color: p.tipBg, borderColor: p.axis },
        title: { show: false },
        // בטלפון: שורה אחת (בקשת המשתמש 28/10) — טקסט 10 ורווחים צרים, כך ששש התוויות נכנסות ברוחב הגרף בלי לגלוש לשורה שנייה
        legend: { color: p.text, size: narrow() ? 10 : 11, family: p.font, marginLeft: narrow() ? 3 : 6, marginTop: 4, marginRight: narrow() ? 3 : 4, template: narrow() ? [] : [{ title: 'open', value: '{open}' }, { title: 'high', value: '{high}' }, { title: 'low', value: '{low}' }, { title: 'close', value: '{close}' }, { title: 'change', value: '{change}' }, { title: 'volume', value: '{volume}' }] },
      },
    },
    indicator: {
      bars: [{ style: 'fill', borderStyle: 'solid', borderSize: 1, borderDashedValue: [2, 2], upColor: rgba(p.up, 0.55), downColor: rgba(p.dn, 0.55), noChangeColor: rgba('#8E8E93', 0.55) }],
      lines: ['#FF9F0A', '#BF5AF2', '#0A84FF', '#FF375F', '#64D2FF', '#30D158', '#FFD60A'].map((color) => ({ style: 'solid', smooth: false, size: 1.2, dashedValue: [2, 2], color })),
      tooltip: { showRule: 'always', title: { color: p.text, size: 11, family: p.font }, legend: { color: p.text, size: 11, family: p.font } }, lastValueMark: { show: true, text: { show: true, size: 10, family: p.font } } },
    xAxis: Object.assign({}, axis, { size: xSize() }), yAxis: axis,
    separator: { color: p.axis, activeBackgroundColor: 'rgba(10,132,255,.08)' },
    crosshair: {
      horizontal: { line: { color: p.cross, style: 'dashed', dashedValue: [4, 3] }, text: { backgroundColor: p.label, borderColor: 'transparent', family: p.font, borderRadius: 6 } },
      vertical: { line: { color: p.cross, style: 'dashed', dashedValue: [4, 3] }, text: { backgroundColor: p.label, borderColor: 'transparent', family: p.font, borderRadius: 6 } },
    },
    overlay: { line: { color: DEF_COLOR }, point: { color: DEF_COLOR, borderColor: rgba(DEF_COLOR, 0.35), activeColor: DEF_COLOR, activeBorderColor: rgba(DEF_COLOR, 0.35) }, text: { backgroundColor: DEF_COLOR, borderColor: DEF_COLOR } },
  };
}

function mountCell(c) {
  if (c.chart) { try { K.dispose(c.host); } catch (e) { /* כבר נסגר */ } c.chart = null; }
  c.host.textContent = '';
  const chart = K.init(c.host, { locale: E.lang === 'en' ? 'en-US' : 'he-IL', styles: chartStyles(c), layout: { barSpaceLimit: { min: 1, max: 60 } } });
  if (!chart) throw new Error('init');
  c.chart = chart;
  chart.setOffsetRightDistance(64);
  chart.setFormatter({ formatExtendText: (x) => (x && x.type === 'last_price' ? countdown(c, x.data, Date.now()) : '') });
  try { chart.overrideYAxis({ paneId: MAIN, name: S.store.g.scale }); } catch (e) { /* ברירת מחדל */ }
  chart.subscribeAction('onCrosshairChange', (x) => onCross(c, x));
  chart.subscribeAction('onVisibleRangeChange', (r) => { const n = chart.getDataList().length; const back = !!(r && n > 0 && r.to < n - 1); if (c.nowB) c.nowB.classList.toggle('on', back);
    // זום לפי ת־גרף: כשרואים את הנר האחרון — הוא נשאר צמוד לימין; בגלילה בהיסטוריה — סביב האצבעות/הסמן
    if (c.anchor !== back) { c.anchor = back; try { chart.setZoomAnchor(back ? 'cursor' : 'last_bar'); } catch (e) { /* גרסה אחרת */ } }
    // זום/גלילה אחרי בחירת טווח — הטווח כבר לא נכון: הבורר עובר להציג את מה שרואים בפועל
    if (!c.pkRaf) c.pkRaf = requestAnimationFrame(() => { c.pkRaf = 0; if (c.pkRg && c.pkRg.isConnected && !c.pkRg.querySelector('.kc-roll')) c.pkRg.textContent = spanLabel(c); }); });
  wireCellPointer(c);
  setSymbolPeriod(c);
  restoreIndicators(c, c.indSaved);
  volGap(c);
}
/* לפי ת־גרף: מתחת לתווית המחיר האחרון — כמה זמן נשאר עד סגירת הנר (mm:ss / h:mm:ss / 3d 4h).
   רק כשהנר באמת חי: תוך־יומי בזמן מסחר (או טרום/אחרי כשהמורחב מוצג), שבועי/חודשי בזמן מסחר. יומי — לא (הסגירה תלויה בבורסה). */
function countdown(c, bar, now) {
  if (!bar || c.replay || !c.q) return '';
  const intra = L.isIntraday(c.tf), st = c.q.st, live = st === 'REGULAR' || (intra && S.store.g.ext && c.q.ext && c.q.extK !== 'night');
  if (!live || (!intra && c.secReal < 7 * 86400)) return '';
  const ms = bar.timestamp + c.secReal * 1000 - now;
  if (!(ms > 0) || ms > c.secReal * 1000) return '';
  const t = Math.floor(ms / 1000), d = Math.floor(t / 86400), h = Math.floor(t / 3600) % 24, m = Math.floor(t / 60) % 60, sec = t % 60, z = (x) => String(x).padStart(2, '0');
  return d ? d + 'd ' + h + 'h' : h ? h + ':' + z(m) + ':' + z(sec) : z(m) + ':' + z(sec);
}
function setSymbolPeriod(c) {
  c.seq++; c.extKey = null; c.fillKey = null; c.posKey = null; c.fx = null; c.raw = []; c.disp = []; c.more = false; c.lastVol = null; c.err = null; c.sub = null; c.cmpCache = new Map(); c.bench = null;
  c.secReal = TF[c.tf].sec;
  c.chart.setSymbol({ ticker: c.sym, pricePrecision: 2, volumePrecision: 0 });
  c.chart.setPeriod(TF[c.tf].p);
  c.chart.setDataLoader(loader(c));
}
function loader(c) {
  const seq = c.seq;
  return {
    getBars: async ({ type, callback }) => {
      try {
        if (type === 'init') {
          if (!c.raw.length) await fetchInit(c);
          else if (NO_HISTORY_MORE.has(c.type)) { let g = 0; while (c.more && g++ < 3) await fetchOlder(c); }
          if (seq !== c.seq) return;
          c.disp = display(c);
          const p = L.precisionFor(c.disp.length ? c.disp[c.disp.length - 1].close : 0);
          const sym = c.chart.getSymbol();
          if (!sym || sym.pricePrecision !== p) c.chart.setSymbol({ ticker: c.sym, pricePrecision: p, volumePrecision: 0 });
          callback(c.disp.slice(), { forward: canMore(c), backward: false });
          afterInit(c);
        } else if (type === 'forward') {
          if (!canMore(c)) return callback([], { forward: false, backward: false });
          await fetchOlder(c);
          if (seq !== c.seq) return;
          const cl = c.chart.getDataList(), first = cl.length ? cl[0].timestamp : Infinity;
          const nd = display(c); c.disp = nd;
          const k = dataIdx(nd, first);
          if (nd[k] && nd[k].timestamp === first && cl[0]) Object.assign(cl[0], nd[k]);   // נר הצבירה שבתפר — מושלם
          callback(nd.slice(0, nd[k] && nd[k].timestamp >= first ? k : nd.length).filter((b) => b.timestamp < first), { forward: canMore(c), backward: false });
        } else callback([], { forward: canMore(c), backward: false });
      } catch (e) {
        if (seq !== c.seq) return;
        c.err = (e && e.code) || 'fail';
        callback([], { forward: false, backward: false });
        renderStatus(c);
      }
    },
    subscribeBar: ({ callback }) => { c.sub = callback; },
    unsubscribeBar: () => { c.sub = null; },
  };
}
const canMore = (c) => c.more && !NO_HISTORY_MORE.has(c.type) && !c.replay;
/* 28/10/2026 (בקשת המשתמש — "כמו אפליקציה שהכל נטען מראש"): מטמון נרות בזיכרון לפי סימבול|בסיס|מסחר מורחב.
   החלפת אינטרוול/טווח שהנרות שלו כבר כאן — באותו פריים, בלי שהתווית מתחלפת והגרף הישן נשאר עוד חצי שנייה.
   הבקשה עצמה נשמרת (גם בזמן שהיא בדרך — שתי לחיצות = בקשה אחת). הרענון התקופתי (reconcile) עוקף ומעדכן */
const CC = new Map();
let PEXT = false;   // המסחר המורחב לפני שהגרף נפתח (טעינה מוקדמת מכרטיס המניה)
const extOn = () => !!(S.store ? S.store.g.ext : PEXT);
const ccTtl = (base) => (/m$/.test(base) ? 300000 : 900000);   // ישן מעט = מוצג מיד, והרענון התקופתי ממזג את החדשים
function fetchCandles(c, to, sym, tf, fresh) {
  sym = sym || c.sym; tf = tf || c.tf;
  const d = TF[tf], ext = extOn() && L.isIntraday(tf), k = sym + '|' + d.base + '|' + (ext ? 1 : 0);
  if (!to && !fresh) { const e = CC.get(k); if (e && Date.now() - e.at < ccTtl(d.base)) return e.p; }
  const p = Promise.resolve(E.api({ op: 'candles', sym, iv: d.base, to: to ? Math.floor(to / 1000) : undefined, pre: ext })).then((r) => {
    if (!r || !r.ok) { const e = new Error((r && r.error) || 'fail'); e.code = (r && r.error) || 'fail'; throw e; }
    return r;
  });
  if (!to) {
    CC.set(k, { at: Date.now(), p });
    p.catch(() => { const e = CC.get(k); if (e && e.p === p) CC.delete(k); });
    if (CC.size > 80) CC.delete(CC.keys().next().value);
  }
  return p;
}
/* אחרי שהגרף עלה: האינטרוולים המועדפים והטווחים של הסימבול נטענים ברקע, אחד־אחד (לא עומס על השרתון — 90 לדקה) */
let warmTok = 0;
function warmCandles(sym) {
  if (lite()) return;
  const tok = ++warmTok, seen = new Set(), tfs = [];
  for (const tf of [...S.store.g.fav, ...RANGES.map((r) => r[1])]) { if (TF[tf] && !seen.has(TF[tf].base)) { seen.add(TF[tf].base); tfs.push(tf); } }
  const next = () => {
    if (tok !== warmTok || !ROOT || !tfs.length) return;
    const tf = tfs.shift();
    fetchCandles(null, 0, sym, tf).catch(() => {}).then(() => setTimeout(next, 120));
  };
  if (typeof requestIdleCallback === 'function') requestIdleCallback(next, { timeout: 1200 }); else setTimeout(next, 600);
}
async function fetchInit(c) {
  c.loading = true; c.err = null; renderStatus(c);
  try {
    const pk = c.sym + '|' + c.tf + '|' + (S.store.g.ext ? 1 : 0);
    const r = c.pre && c.pre.key === pk ? c.pre.r : await fetchCandles(c);
    c.pre = null;
    c.raw = L.fromColumns(r); c.more = !!r.more; c.tz = r.tz || c.tz; c.cur = r.cur || ''; c.ex = r.ex || ''; c.name = r.name || '';
    // מעט נרות (טווח קצר מאוד) — טוענים עוד מנה מראש כדי שיהיה מה לגלול
    if (c.raw.length < 300 && c.more && !NO_HISTORY_MORE.has(c.type)) await fetchOlder(c);
    if (NO_HISTORY_MORE.has(c.type)) { let g = 0; while (c.more && g++ < 3) await fetchOlder(c); }
    if (!c.raw.length) { const e = new Error('empty'); e.code = 'empty'; throw e; }
    if (S.store.g.tz === 'ex') { try { c.chart.setTimezone(c.tz); } catch (e) { /* אזור לא מוכר */ } }
  } finally { c.loading = false; renderStatus(c); }
}
async function fetchOlder(c) {
  if (!c.raw.length) return;
  const r = await fetchCandles(c, c.raw[0].timestamp);
  const b = L.fromColumns(r).filter((x) => x.timestamp < c.raw[0].timestamp);
  c.raw = b.concat(c.raw);
  c.more = !!r.more && b.length > 0;
}
function display(c) {
  let b = L.aggregate(c.raw, c.tf);
  const tr = TRANSFORM[c.type];
  if (tr) b = tr(b);
  if (c.replay) b = b.slice(0, Math.max(1, c.replay.end));
  return b;
}
function afterInit(c) {
  if (c.drawnFor !== c.sym) {
    c.drawnFor = c.sym;
    c.chart.removeOverlay({ groupId: 'user' });
    const st = S.store.s[c.sym];
    const dr = st ? L.sanitizeLayout({ dr: st.dr }).dr : [];
    S.restoring = true;
    for (const d of dr) createDrawing(c, d);
    S.restoring = false;
    c.snap = JSON.stringify(drawSnap(c)); c.undo = []; c.redo = [];
  }
  drawAlerts(c);
  drawFills(c); drawPos(c);
  if (c.fit) { const f = c.fit; c.fit = null; fitRange(c, f); }
  if (c === S.cells[S.active]) updHeader();
  if (c === S.cells[S.active] && c.warmed !== c.sym) { c.warmed = c.sym; warmCandles(c.sym); }
}

/* ---------- זמן אמת: מחיר כל שנייה + רענון נרות תקופתי ---------- */
function parseQuote(d) {
  const r = d && d.chart && d.chart.result && d.chart.result[0];
  if (!r) return null;
  const m = r.meta || {}, x = d.x || {}, st = String(x.state || '').toUpperCase();
  const k = String(m.currency || '').toUpperCase() === 'ILA' ? 100 : 1;
  const reg = x.reg || (m.regularMarketPrice > 0 ? { p: m.regularMarketPrice / k, t: m.regularMarketTime || 0, ch: null, pct: null } : null);
  // לילי (OVERNIGHT, ‏20:00–04:00 ניו יורק) — היה חסר: באמצע המסחר הלילי לא הוצג מחיר מורחב בכלל
  const ext = st === 'PRE' ? x.pre : st === 'POST' || st === 'POSTPOST' ? x.post : x.night && (st === 'OVERNIGHT' || st === 'CLOSED' || st === 'PREPRE') ? x.night : null;
  const extK = !ext ? '' : ext === x.pre ? 'pre' : ext === x.night ? 'night' : 'post';
  return { st, reg, ext, extK, prev: (m.chartPreviousClose || m.previousClose || 0) / k, dayVol: m.regularMarketVolume || 0, name: m.longName || m.shortName || '' };
}
function onQuote(c, q) {
  c.q = q;
  if (c.raw.length) { drawExt(c); drawFills(c); drawPos(c); }
  if (c.replay || !c.raw.length || !c.sub) return;
  const d = TF[c.tf], intra = /m$/.test(d.base), regular = q.st === 'REGULAR';
  let price = 0, time = 0;
  if (regular && q.reg) { price = q.reg.p; time = q.reg.t * 1000; } else if (intra && S.store.g.ext && q.ext && q.extK !== 'night') { price = q.ext.p; time = q.ext.t * 1000; }
  else if (q.reg && q.reg.p > 0 && q.reg.t > 0) {
    /* אחרי הסגירה: הנרות של Yahoo לא כוללים את מכירת הסגירה (נר אחרון 154.81 מול סגירה רשמית 154.78) —
       הנר שמכיל את זמן הסגירה נסגר על המחיר הרשמי, לפי ת־גרף ובכרטיס המניה */
    const b = c.raw[c.raw.length - 1], t = q.reg.t * 1000, p = q.reg.p;
    if (b && b.timestamp <= t && t <= b.timestamp + BASESEC[d.base] * 1000 && b.close !== p) {
      b.close = p; b.high = Math.max(b.high, p); b.low = Math.min(b.low, p);
      pushLive(c, false);
    }
    return;
  }
  if (!(price > 0) || !(time > 0)) return;
  let dv = 0;
  if (regular && intra) { if (c.lastVol != null && q.dayVol >= c.lastVol) dv = q.dayVol - c.lastVol; c.lastVol = q.dayVol; }
  const before = c.raw.length ? c.raw[c.raw.length - 1].close : null;
  const r = L.applyTick(c.raw, { price, time, dv, regular, dayVol: q.dayVol }, { sec: BASESEC[d.base], intra, base: d.base, dayKey: dayKeyFor(c.tz) });
  if (r.changed && (r.added || before !== price || dv)) pushLive(c, false);
}
function pushLive(c, deep) {
  const nd = display(c);
  c.disp = nd;
  if (!c.sub || !c.chart) return;
  const cl = c.chart.getDataList();
  if (!cl.length || !nd.length) return;
  const lastTs = cl[cl.length - 1].timestamp;
  let j = nd.length - 1;
  while (j > 0 && nd[j].timestamp > lastTs) j--;
  /* 28/10/2026 (מול TradingView): הנר האחרון בגרף לא קיים בנתונים (נר בזמן לא מיושר מרענון קודם) — הוא חסם את העדכונים
     (רק נרות מאוחרים ממנו נדחפים), והגרף קפא על מחיר ישן עד הנר הבא. טוענים מחדש מהנתונים המתוקנים */
  if (nd[j].timestamp !== lastTs && lastTs > nd[0].timestamp) { c.chart.resetData(); return; }
  // נרות שכבר בגרף ותוקנו (רענון מהשרתון) — מעדכנים במקום; החדשים/האחרון — דרך subscribeBar
  for (let k = j - 1, n = 0; k >= 0 && n < (deep ? 600 : 2); k--, n++) {
    const i = dataIdx(cl, nd[k].timestamp);
    if (cl[i] && cl[i].timestamp === nd[k].timestamp) Object.assign(cl[i], nd[k]);
  }
  for (let k = j; k < nd.length; k++) if (nd[k].timestamp >= lastTs) c.sub(Object.assign({}, nd[k]));
}
async function reconcile(c) {
  if (!c.raw.length || c.replay || c.loading) return;
  const seq = c.seq;
  try {
    const r = await fetchCandles(c, 0, null, null, true);
    if (seq !== c.seq) return;
    const fresh = L.fromColumns(r);
    if (!fresh.length) return;
    c.raw = L.mergeBars(c.raw, fresh);
    pushLive(c, true);
  } catch (e) { /* הרענון הבא */ }
}
function quoteSyms() {
  const s = new Set(S.cells.map((c) => c.sym));
  if (S.watch && E.symbols) for (const x of E.symbols()) { if (s.size >= 40) break; s.add(x); }
  for (const k of Object.keys(S.store.alerts)) if ((S.store.alerts[k] || []).some((a) => !a.done) && s.size < 40) s.add(k);
  return [...s];
}
let quiet = 0;
/* 29/10/2026 (סבב קפיצות 4, סרטון הגרף): בפתיחה הראש הציג את סגירת הנר האחרון בלי שורת השינוי, וחצי שנייה אחר כך
   המחיר החי והשינוי נכנסו והזיזו את הכל. המחירים האחרונים נשמרים באפליקציה (E.qcache — נתוני שוק ציבוריים) ומשמשים לציור
   הראשון — רק אם הם מ־30 הדקות האחרונות */
const KCQ_MAX_MS = 30 * 60e3;   // המטמון עצמו באפליקציה (E.qcache, pwa_kcq_v1)
let kcqAt = 0;
function kcqSave(d) {
  if (!d || Date.now() - kcqAt < 15e3) return;
  kcqAt = Date.now();
  try { if (E.qcache) E.qcache.set({ t: kcqAt, d: Object.assign({}, S.wq) }); } catch (e) {}
}
function kcqSeed() {
  try {
    const o = E.qcache ? E.qcache.get() : null;
    if (o && o.d && Date.now() - (o.t || 0) < KCQ_MAX_MS) for (const k of Object.keys(o.d)) if (!S.wq[k]) S.wq[k] = o.d[k];
  } catch (e) {}
  let any = false;
  for (const c of S.cells) { const d = S.wq[c.sym], q = d && parseQuote(d); if (q && !c.q) { c.q = q; any = true; } }
  if (any) updHeader();
}
/* 27/10/2026 (בקשת המשתמש: "שלא יגיעו בשום צורה למגבלות של Vercel ו־Firebase"): כשהבקשות הולכות ל־Vercel (השרת שלנו
   נפל והטלפון עבר לגיבוי, או כתובת ישנה) — מחיר כל 10 שנ׳ ונרות פי 6 לאט יותר. בשרת שלנו (הרגיל) — כל שנייה */
const lite = () => { try { return !!(E && E.lite && E.lite()); } catch (e) { return false; } };
async function poll() {
  if (!ROOT || S.busy || (typeof document !== 'undefined' && document.hidden)) return;
  S.poll++;
  const slow = lite();
  if (slow && S.poll % 10) return;
  // שוק סגור בכל המניות שבמסך (אין מחיר טרום/אחרי) — כל 15 שניות במקום כל שנייה
  if (quiet > 30 && S.poll % 15) return;
  S.busy = true;
  try {
    const j = await E.quotes(quoteSyms());
    if (!ROOT || !j || !j.ok) return;
    // 29/10/2026 (סבב קפיצות 4, סרטון הגרף): מיזוג ולא החלפה — כשהמגירה סגורה הבקשה רק על המניה שבגרף, ורשימת המעקב
    // נפתחה שוב עם "—" בכל השורות עד הטיק הבא (אותו לקח כמו applyQuotes ב־Invest)
    S.wq = Object.assign({}, S.wq, j.data || {});
    kcqSave(j.data);
    let live = false;
    for (const c of S.cells) {
      const d = S.wq[c.sym], q = d && parseQuote(d);
      if (!q) continue;
      onQuote(c, q);
      if (q.st === 'REGULAR' || q.st === 'PRE' || q.st === 'POST') live = true;
    }
    quiet = live ? 0 : quiet + 1;
    updHeader();
    if (S.watch) updWatch();
    checkAlerts();
  } catch (e) { /* הטיק הבא */ } finally { S.busy = false; }
  // רענון נרות מהשרתון: תוך־יומי כל 20 שנ׳, יומי ומעלה כל דקה
  for (const c of S.cells) {
    const every = (L.isIntraday(c.tf) ? 20 : 60) * (slow ? 6 : 1);
    if (!c.recAt || NOW() - c.recAt > every * 1000) { c.recAt = NOW(); if (c.q && (c.q.st === 'REGULAR' || (S.store.g.ext && L.isIntraday(c.tf)))) reconcile(c); }
  }
}

/* ---------- שרטוטים: יצירה, בחירה, עריכה, ביטול/חזרה ---------- */
const DS = { color: DEF_COLOR, width: 1, dash: false };
function styleSet(color, size, dashed) {
  const f = rgba(color, 0.12);
  return {
    line: { color, size, style: dashed ? 'dashed' : 'solid', dashedValue: [5, 4] }, polygon: { color: f, borderColor: color }, rect: { color: f, borderColor: color },
    circle: { color: f, borderColor: color }, arc: { color }, text: { backgroundColor: color, borderColor: color },
    point: { color, borderColor: rgba(color, 0.35), activeColor: color, activeBorderColor: rgba(color, 0.35) },
  };
}
function ovEvents(c) {
  return {
    onDrawEnd: (e) => {
      const o = e && e.overlay;
      if (o && TEXT_TOOLS.has(o.name)) setTimeout(() => askText(c, o.id), 0);
      setTimeout(() => {
        changed(c);
        if (S.store.g.stay && S.tool && !TEXT_TOOLS.has(S.tool)) startTool(S.tool); else { S.tool = null; updToolUI(); }
      }, 0);
    },
    onPressedMoveEnd: () => setTimeout(() => changed(c), 0),
    onSelected: (e) => select(c, e.overlay),
    onDeselected: () => deselect(),
    onDoubleClick: (e) => { if (TEXT_TOOLS.has(e.overlay.name)) askText(c, e.overlay.id); },
    onRightClick: (e) => { if (e.preventDefault) e.preventDefault(); select(c, e.overlay); },
  };
}
function createDrawing(c, d) {
  return c.chart.createOverlay(Object.assign({ name: d.name, groupId: 'user', points: d.points, styles: d.styles, lock: !!d.lock, visible: !d.hide, extendData: d.ext, mode: S.magnet ? 'weak_magnet' : 'normal' }, ovEvents(c)));
}
function cancelPending(c) {
  if (!c || !c.chart) return;
  for (const o of c.chart.getOverlays({ groupId: 'user' })) if (o.currentStep !== -1) c.chart.removeOverlay({ id: o.id });
}
function startTool(name) {
  const c = S.cells[S.active];
  if (!c || !c.chart || !c.raw.length) return;
  cancelPending(c);
  curEnd();
  S.tool = name;
  if (CUR_TOOLS.has(name) && coarse() && curBegin(c, name)) { deselect(); updToolUI(); return; }
  c.chart.createOverlay(Object.assign({ name, groupId: 'user', mode: S.magnet ? (S.magnet === 2 ? 'strong_magnet' : 'weak_magnet') : 'normal', styles: styleSet(DS.color, DS.width, DS.dash) }, ovEvents(c)));
  updToolUI();
}
function stopTool() { const c = S.cells[S.active], s = curEnd(); if (s && s.id && s.c.chart) s.c.chart.removeOverlay({ id: s.id }); cancelPending(c); S.tool = null; updToolUI(); }

/* ---------- מדידה בטלפון — מצב צלב (הצלב זז יחסית לאצבע) ----------
   הקשה על סמל המדידה → צלב על הגרף. גרירה בכל מקום במסך מזיזה את הצלב יחסית לאצבע (האצבע לא מסתירה את הנקודה),
   הקשה = עיגון הנקודה הראשונה, גרירה = המלבן והנתונים גדלים חי, הקשה שנייה = סיום, והמדידה נבחרת
   (ידיות, פס כחול על הצירים וסרגל העריכה). בזמן המדידה הגרף לא נגלל. במחשב (עכבר) — הציור הרגיל */
const CUR_TOOLS = new Set(['kcMeasure', 'kcPriceRange', 'kcDateRange']);
const coarse = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
function curSnap(c, x, y) {
  const list = c.chart.getDataList(), sz = c.chart.getSize(MAIN, 'main');
  if (!list.length || !sz) return null;
  x = Math.max(0, Math.min(sz.width - 1, x)); y = Math.max(0, Math.min(sz.height - 1, y));
  const p = c.chart.convertFromPixel([{ x, y }], { paneId: MAIN })[0] || {};
  const bar = list[Math.max(0, Math.min(list.length - 1, typeof p.dataIndex === 'number' ? p.dataIndex : list.length - 1))];
  let v = p.value;
  if (S.magnet) { let bd = Infinity; for (const k of ['open', 'high', 'low', 'close']) { const d = Math.abs(bar[k] - v); if (d < bd) { bd = d; v = bar[k]; } } }   // מגנט: לפתיחה/גבוה/נמוך/סגירה הקרובים
  const q = px(c.chart, bar.timestamp, v);
  return { x: q && isFinite(q.x) ? q.x : x, y: q && isFinite(q.y) ? q.y : y, pt: { timestamp: bar.timestamp, value: v } };
}
function curShow() {
  const s = S.cur;
  if (!s || !s.c.chart) return;
  s.raf = 0;
  const r = curSnap(s.c, s.x, s.y);
  if (!r) return;
  s.snap = r;
  s.c.chart.executeAction('onCrosshairChange', { x: r.x, y: r.y, paneId: MAIN });
  if (s.id) s.c.chart.overrideOverlay({ id: s.id, points: [s.p1, r.pt] });
}
function curBegin(c, name) {
  const sz = c.chart.getSize(MAIN, 'main'), list = c.chart.getDataList(), last = list[list.length - 1];
  if (!sz || !last) return false;
  const q = px(c.chart, last.timestamp, last.close), inX = q && q.x >= 0 && q.x < sz.width, inY = q && q.y >= 0 && q.y < sz.height;
  S.cur = { c, name, x: inX ? q.x : sz.width / 2, y: inY ? q.y : sz.height / 2, p1: null, id: null, raf: 0 };
  requestAnimationFrame(curShow);
  return true;
}
function curTap() {
  const s = S.cur;
  if (!s || !s.snap) return;
  try { if (navigator.vibrate) navigator.vibrate(5); } catch (x) { /* בלי רטט */ }
  if (!s.p1) {
    s.p1 = s.snap.pt;
    s.id = s.c.chart.createOverlay(Object.assign({ name: s.name, groupId: 'user', points: [s.p1, s.p1], styles: styleSet(DS.color, DS.width, DS.dash) }, ovEvents(s.c)));
    return;
  }
  const c = s.c, id = s.id;
  curEnd();
  changed(c);
  if (S.store.g.stay) { startTool(s.name); return; }
  S.tool = null; updToolUI();
  const o = getOv(c, id);
  if (o) select(c, o);
}
function curEnd() {
  const s = S.cur;
  if (!s) return null;
  S.cur = null;
  cancelAnimationFrame(s.raf);
  try { s.c.chart.executeAction('onCrosshairChange', null); } catch (e) { /* כבר נסגר */ }
  return s;
}
function changed(c) {
  if (S.restoring || !c.chart) return;
  const s = JSON.stringify(drawSnap(c));
  if (s === c.snap) return;
  c.undo.push(c.snap); if (c.undo.length > 80) c.undo.shift();
  c.redo = []; c.snap = s;
  save(); updUndo();
}
function applySnap(c, s) {
  S.restoring = true;
  c.chart.removeOverlay({ groupId: 'user' });
  for (const d of JSON.parse(s)) createDrawing(c, d);
  S.restoring = false;
  deselect(); save(); updUndo();
}
function undo() { const c = S.cells[S.active]; if (!c || !c.undo.length) return; c.redo.push(c.snap); c.snap = c.undo.pop(); applySnap(c, c.snap); }
function redo() { const c = S.cells[S.active]; if (!c || !c.redo.length) return; c.undo.push(c.snap); c.snap = c.redo.pop(); applySnap(c, c.snap); }
function getOv(c, id) { return c && c.chart ? c.chart.getOverlays({ id })[0] : null; }
function select(c, o) { if (!o || o.groupId !== 'user') return; S.sel = { c, id: o.id, at: Date.now() }; renderSel(); }
/* קו התראה נבחר (הקשה עליו) — אותו סרגל צף: חימוש מחדש, עריכה, מחיקה; לחיצה ארוכה — גיליון עם "מחק" */
function selectAlert(c, o) {
  const a = o && (S.store.alerts[c.sym] || []).find((x) => x.id === (o.extendData && o.extendData.id));
  if (!a) return;
  S.sel = { c, id: o.id, at: Date.now(), alert: a };
  renderSel();
}
function delAlert(sym, a) {
  const arr = (S.store.alerts[sym] || []).filter((x) => x !== a);
  if (arr.length) S.store.alerts[sym] = arr; else delete S.store.alerts[sym];
  save(); bgSoon();
  for (const x of S.cells) if (x.sym === sym) drawAlerts(x);
  updBars();
}
function deselect() { S.sel = null; renderSel(); }
function selStyle(patch) {
  const s = S.sel, o = s && getOv(s.c, s.id);
  if (!o) return;
  const ln = (o.styles && o.styles.line) || {};
  const color = patch.color || ln.color || DS.color, size = patch.width || ln.size || DS.width, dash = patch.dash != null ? patch.dash : ln.style === 'dashed';
  Object.assign(DS, { color, width: size, dash });   // השרטוט הבא — באותו סגנון (לפי ת־גרף)
  s.c.chart.overrideOverlay({ id: s.id, styles: styleSet(color, size, dash) });
  changed(s.c); renderSel();
}
function selDelete() { const s = S.sel; if (!s) return; if (s.alert) { deselect(); delAlert(s.c.sym, s.alert); return; } s.c.chart.removeOverlay({ id: s.id }); deselect(); changed(s.c); }
/* לחיצה ארוכה על אובייקט (לפי ת־גרף): גיליון קצר — מחק תמיד ראשון, ואחריו מה שמתאים */
function openObjMenu() {
  const s = S.sel, o = s && getOv(s.c, s.id);
  if (!o) return;
  const name = s.alert ? '🔔 ' + fmtNum(s.alert.p, L.precisionFor(s.alert.p)) : T(TOOL_INFO[o.name] ? TOOL_INFO[o.name].key : 'kcDrawing');
  openSheet(name, (b, sh) => {
    const it = (icon, text, fn, cls) => h('button', { type: 'button', class: 'kc-li' + (cls ? ' ' + cls : ''), onclick: () => { closeSheet(sh); fn(); } }, h('span', { class: 'kc-ico', html: ICON[icon] }), h('span', { class: 'kc-li-n', text }));
    const rows = [it('trash', T('kcDelete'), selDelete, 'danger')];
    if (s.alert) {
      if (s.alert.done) rows.push(it('bell', T('kcRearm'), () => { rearm(s.c.sym, s.alert); save(); bgSoon(); drawAlerts(s.c); deselect(); }));
      rows.push(it('bell', T('kcAlerts'), () => { deselect(); openAlerts(); }));
    } else {
      rows.push(it('copy', T('kcClone'), selClone), it(o.lock ? 'unlock' : 'lock', o.lock ? T('kcUnlock') : T('kcLock'), selLock));
      if (TEXT_TOOLS.has(o.name)) rows.push(it('text', T('kcEditText'), () => askText(s.c, s.id)));
    }
    b.append(h('div', { class: 'kc-act' }, ...rows));
  }, { clear: true });   // 28/10 (בקשת המשתמש): בלי טשטוש — רואים את הגרף ולאן האובייקט הוזז
}
function selLock() { const s = S.sel, o = s && getOv(s.c, s.id); if (!o) return; s.c.chart.overrideOverlay({ id: s.id, lock: !o.lock }); changed(s.c); renderSel(); }
function selClone() {
  const s = S.sel, o = s && getOv(s.c, s.id);
  if (!o) return;
  const list = s.c.chart.getDataList(), span = list.length ? Math.max(...list.slice(-50).map((b) => b.high)) - Math.min(...list.slice(-50).map((b) => b.low)) : 0;
  createDrawing(s.c, { name: o.name, points: o.points.map((p) => ({ timestamp: p.timestamp, value: p.value + span * 0.08 })), styles: o.styles, ext: o.extendData });
  changed(s.c);
}
function askText(c, id) {
  const o = getOv(c, id);
  if (!o) return;
  openSheet(T('kcTextT'), (b, sh) => {
    const ta = h('textarea', { class: 'kc-in kc-ta', maxlength: '240', rows: '3', placeholder: T('kcTextPh') });
    ta.value = (o.extendData && o.extendData.text) || '';
    b.append(ta, h('div', { class: 'kc-row-end' }, btn('kc-btn pri', T('kcSave'), () => {
      const cur = getOv(c, id);
      if (cur) {
        const d = { name: cur.name, points: cur.points, styles: cur.styles, lock: cur.lock, ext: Object.assign({}, cur.extendData, { text: ta.value.trim().slice(0, 240) }) };
        S.restoring = true; c.chart.removeOverlay({ id }); createDrawing(c, d); S.restoring = false;
        changed(c);
      }
      closeSheet(sh);
    })));
    setTimeout(() => ta.focus(), 50);
  });
}

/* ---------- אינדיקטורים בתא ---------- */
/* הנרות מקבלים כמה שיותר גובה (בקשת המשתמש 28/10): עם נפח משולב אין לו חלונית — הנרות נפרסים עד התחתית ועוברים מעליו.
   מרווחי ציר המחיר קטנים מברירת המחדל (0.2/0.1) — רק מה שצריך מתחת לכותרת ומעל ציר התאריכים */
function volGap(c) {
  try {
    // למעלה: השיא (ותווית המחיר שלו) מתחיל מתחת לשורת המקרא — לפי המיקום שלה בפועל (הכותרת מתארכת עם בועה גבוהה)
    // gap הוא חלק מטווח המחירים (לא מהגובה): חלק f מהגובה = g/(1+g+b) → g = f(1+b)/(1−f)
    const H = (c.chart.getSize(MAIN) || {}).height || (c.host && c.host.clientHeight) || 600, f = Math.min(0.4, Math.max(0.06, (topPad(c) + 62) / H));   // 62 = שורת המקרא (~22) + תווית השיא שמצוירת מעל הנר (~20) + מרווח
    const bottom = c.chart.getIndicators({ name: 'KCVOL' }).length ? 0.04 : 0.1;
    c.chart.overrideYAxis({ paneId: MAIN, gap: { top: f * (1 + bottom) / (1 - f), bottom } });   // ב־10.1 המרווח שייך לציר, לא לאפשרויות החלונית
  } catch (e) { /* גרסה בלי gap */ }
}
function restoreIndicators(c, list) {
  // פעם אחת: חלונית הנפח (VOL) של ברירת המחדל → נפח משולב בתחתית הגרף (KCVOL). מי שיוסיף VOL אחר כך — יקבל חלונית
  if (!S.store.g.volIn) { S.store.g.volIn = 1; list = (list || []).map((x) => (x.n === 'VOL' && !x.main ? { n: 'KCVOL', main: true, h: x.h } : x)); save(); }
  for (const x of list || []) { try { addInd(c, x.n, x); } catch (e) { /* אינדיקטור שלא קיים יותר */ } }
}
function addInd(c, name, o) {
  o = o || {};
  if (!c.chart) return null;
  const main = o.main != null ? !!o.main && isMain(name) : isMain(name);
  const conf = { name, extendData: { c: c.i, sym: o.sym }, visible: !o.h };
  if (o.p && o.p.length) conf.calcParams = o.p;
  // נפח נקי לפי ת־גרף — בלי שלושת הממוצעים של ברירת המחדל (5/10/20, שנשמרו גם אצל מי שלא בחר בהם)
  if (name === 'VOL' && (!conf.calcParams || conf.calcParams.join() === '5,10,20')) conf.calcParams = [];
  if (name === 'KCCMP') { const k = c.chart.getIndicators({ name: 'KCCMP' }).length; conf.shortName = o.sym; conf.styles = { lines: [{ color: CMPC[k % CMPC.length], size: 1.6, style: 'solid', smooth: false, dashedValue: [2, 2] }] }; }
  if (o.res) conf.extendData.res = o.res;
  if (main) conf.paneId = MAIN;
  const id = c.chart.createIndicator(conf, main);
  if (id && !main) {
    const ind = c.chart.getIndicators({ id })[0];
    // גובה יחסי לתא (בפריסה של 4 גרפים חלונית קבועה של 120px הייתה מוחקת את הנרות)
    const H = (c.host && c.host.clientHeight) || 600, base = name === 'VOL' ? 90 : 120;
    if (ind) c.chart.setPaneOptions({ id: ind.paneId, height: Math.round(Math.min(base, Math.max(32, H * (name === 'VOL' ? 0.15 : 0.2)))), minHeight: 30 });
  }
  if (name === 'KCCONE') c.chart.setOffsetRightDistance(180);
  if (name === 'KCVOL') volGap(c);
  save();
  return id;
}
function removeInd(c, id) {
  const ind = c.chart.getIndicators({ id })[0];
  c.chart.removeIndicator({ id });
  if (ind && ind.name === 'KCCONE') c.chart.setOffsetRightDistance(64);
  if (ind && ind.name === 'KCCMP' && !c.chart.getIndicators({ name: 'KCCMP' }).length) setScale(c, S.store.g.scale);
  if (ind && ind.name === 'KCVOL') volGap(c);
  save();
}
function hasInd(c, name) { return c.chart ? c.chart.getIndicators({ name }).length > 0 : false; }
function toggleInd(c, name) { const i = c.chart.getIndicators({ name })[0]; if (i) removeInd(c, i.id); else addInd(c, name); }
function setScale(c, name) { try { c.chart.overrideYAxis({ paneId: MAIN, name }); } catch (e) { /* ברירת מחדל */ } }

/* ---------- התראות מחיר ---------- */
function lastTs(c) { const l = c.chart ? c.chart.getDataList() : []; return l.length ? l[l.length - 1].timestamp : NOW(); }
function drawAlerts(c) {
  if (!c.chart) return;
  c.chart.removeOverlay({ groupId: 'alert' });
  for (const a of S.store.alerts[c.sym] || []) {
    c.chart.createOverlay({
      name: 'kcAlert', groupId: 'alert', points: [{ timestamp: lastTs(c), value: a.p }], extendData: { id: a.id, note: a.note || '', done: !!a.done },
      onPressedMoveEnd: (e) => { a.p = e.overlay.points[0].value; rearm(c.sym, a); save(); bgSoon(); setTimeout(() => drawAlerts(c), 0); },
      onSelected: (e) => selectAlert(c, e.overlay),
      onDeselected: () => { if (S.sel && S.sel.alert) deselect(); },
      onRightClick: (e) => { if (e.preventDefault) e.preventDefault(); },
    });
  }
}
const EXTC = { pre: '#FF9F0A', post: '#0A84FF', night: '#BF5AF2' };   // צבעי המערכת: כתום טרום, כחול אחרי, סגול לילי
function drawExt(c) {
  if (!c.chart) return;
  const q = c.q, st = q && q.st, show = !!(q && q.ext && q.ext.p > 0 && st !== 'REGULAR' && !c.replay);   // גם באינטרוולים תוך־יומיים (28/10: הגלולה נעלמה כשהמסחר המורחב מוצג בנרות)
  const k = q && q.extK || (/PRE/.test(st) ? 'pre' : 'post'), t = show ? T({ pre: 'kcPre', post: 'kcPost', night: 'kcNight' }[k]) : '', key = show ? q.ext.p + '|' + t + '|' + c.raw.length : '';
  if (c.extKey === key) return;
  c.extKey = key;
  const o = { points: [{ timestamp: lastTs(c), value: show ? q.ext.p : 0 }], extendData: { t, k } };
  if (show && c.extId && c.chart.getOverlays({ id: c.extId }).length) return c.chart.overrideOverlay(Object.assign({ id: c.extId }, o));
  c.chart.removeOverlay({ groupId: 'ext' });
  c.extId = show ? c.chart.createOverlay(Object.assign({ name: 'kcExtPx', groupId: 'ext', lock: true }, o)) : null;
}
/* ---------- העסקאות שלי על הגרף: חיצי קנייה/מכירה + קו הממוצע (רק מהנתונים שכבר באפליקציה — E.fills) ---------- */
const POSC = { up: '#30D158', dn: '#FF453A', flat: '#787B86' };
function fillsOf(c) {
  if (!c.fx || c.fx.sym !== c.sym) { let v = null; try { v = E.fills ? E.fills(c.sym) : null; } catch (e) { v = null; } c.fx = { sym: c.sym, v: v || { trades: [], pos: null } }; }
  return c.fx.v;
}
// זמן הביצוע: תאריך + שעה (IBKR מדווח בשעון ניו יורק). בלי שעה (עסקה ידנית) — סוף היום בשעון הבורסה, ולא אחרי עכשיו
function fillTs(f, tz) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(f.d || ''), t = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(f.t || '');
  if (!m) return NaN;
  const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], t ? +t[1] : 23, t ? +t[2] : 59, t ? +(t[3] || 0) : 0), zone = t ? 'America/New_York' : tz;
  const ms = wall - tzOffset(zone, wall);
  return t ? ms : Math.min(ms, NOW());
}
function drawFills(c) {
  if (!c.chart) return;
  const on = S.store.g.fills !== 0, fx = on ? fillsOf(c) : null, list = on ? c.chart.getDataList() : [];
  const key = on && fx.trades.length && list.length ? c.sym + '|' + c.tf + '|' + c.type + '|' + list.length + '|' + list[0].timestamp + '|' + list[list.length - 1].timestamp : '';
  if (c.fillKey === key) return;
  c.fillKey = key;
  c.chart.removeOverlay({ groupId: 'fills' });
  if (!key) return;
  const daily = !L.isIntraday(c.tf), dk = dayKeyFor(c.tz);
  const fills = fx.trades.map((f) => {
    const ms = fillTs(f, c.tz), m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(f.d || '');
    return { k: daily ? (m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000 : NaN) : ms, side: f.side, qty: f.qty, price: f.price };
  });
  const span = daily ? Math.ceil((c.secReal || 86400) / 86400) + 1 : (c.secReal || 60) * 1000;
  for (const x of L.fillMarks(list, fills, daily ? (b) => dk(b.timestamp) : (b) => b.timestamp, span)) {
    c.chart.createOverlay({ name: 'kcFill', groupId: 'fills', lock: true, points: [{ timestamp: x.timestamp, value: x.value }], extendData: { buy: x.buy, t: (x.buy ? '+' : '−') + fmtQty(x.qty) } });
  }
}
const fmtQty = (q) => (Math.abs(q) >= 1e4 ? fmtBig(q) : fmtNum(q, Number.isInteger(q) ? 0 : Math.min(4, (String(q).split('.')[1] || '').length)));
function drawPos(c) {
  if (!c.chart) return;
  const fx = S.store.g.fills !== 0 ? fillsOf(c) : null, p = fx && fx.pos;
  const live = p ? (quotePrice(c.q) || (c.raw.length ? c.raw[c.raw.length - 1].close : 0)) : 0;
  const pl = p && live > 0 ? (live - p.avg) * p.n : null;
  const col = pl == null || Math.abs(pl) < 0.005 ? POSC.flat : pl > 0 ? POSC.up : POSC.dn;
  const iso = (x) => '\u2066' + x + '\u2069';   // הקנבס מצייר בכיוון LTR — בעברית התגית כולה בבידוד RTL והמספרים בבידוד LTR, אחרת הסדר מתהפך
  const t = p ? (E && E.lang === 'en' ? '' : '\u2067') + T('kcPosTag', { n: iso(fmtQty(p.n)), p: iso(fmtNum(p.avg, L.precisionFor(p.avg))) }) + (pl == null ? '' : ' · ' + iso((pl > 0 ? '+' : pl < 0 ? '−' : '') + fmtNum(Math.abs(pl), 2))) + (E && E.lang === 'en' ? '' : '\u2069') : '';
  const key = p ? p.avg + '|' + t + '|' + col : '';
  if (c.posKey === key) return;
  c.posKey = key;
  const o = { points: [{ timestamp: lastTs(c), value: p ? p.avg : 0 }], extendData: { t, c: col } };
  if (p && c.posId && c.chart.getOverlays({ id: c.posId }).length) return c.chart.overrideOverlay(Object.assign({ id: c.posId }, o));
  c.chart.removeOverlay({ groupId: 'pos' });
  c.posId = p ? c.chart.createOverlay(Object.assign({ name: 'kcPos', groupId: 'pos', lock: true }, o)) : null;
}
function redrawMine() { for (const c of S.cells) { c.fillKey = null; c.posKey = null; drawFills(c); drawPos(c); } }
const lastPx = {};
function quotePrice(q) { if (!q) return 0; if (q.st === 'REGULAR' && q.reg) return q.reg.p; if (q.ext) return q.ext.p; return q.reg ? q.reg.p : 0; }
function checkAlerts() {
  for (const sym of Object.keys(S.store.alerts)) {
    const list = S.store.alerts[sym] || [], q = S.wq[sym] && parseQuote(S.wq[sym]), p = quotePrice(q);
    if (!(p > 0)) continue;
    const prev = lastPx[sym]; lastPx[sym] = p;
    if (prev == null) continue;
    let hit = false;
    for (const a of list) {
      if (a.done) continue;
      const up = prev < a.p && p >= a.p, dn = prev > a.p && p <= a.p;
      if ((a.dir === 'up' && up) || (a.dir === 'down' && dn) || (a.dir !== 'up' && a.dir !== 'down' && (up || dn))) {
        a.done = true; a.at = NOW(); hit = true;
        const msg = T('kcAlertHit', { s: sym, p: fmtNum(a.p, 2) }) + (a.note ? ' · ' + a.note : '');
        if (E.flash) E.flash(msg);
        notify(msg);
      }
    }
    if (hit) { save(); bgSoon(); for (const c of S.cells) if (c.sym === sym) drawAlerts(c); }
  }
}
function notify(msg) {
  if (BG.st === 'on') return;   // ההתראה למערכת מגיעה מהשרתון (Push) — בלי כפילות; על המסך — flash
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    if (navigator.serviceWorker && navigator.serviceWorker.ready) navigator.serviceWorker.ready.then((r) => r.showNotification('THE SNOWBALL', { body: msg, tag: 'kc-alert', icon: 'icon-192.png' })).catch(() => {});
    else new Notification('THE SNOWBALL', { body: msg });   // eslint-disable-line no-new
  } catch (e) { /* בלי התראת מערכת — ההודעה על המסך מספיקה */ }
}

/* ---------- התראות ברקע (27/10/2026, בקשת המשתמש: "גם כשהאפליקציה סגורה לגמרי") ----------
   ההתראות הפעילות + מנוי ה־Push של המכשיר נשלחים לשרתון (op:'pxa'); השרת שלנו בודק כל 30 שנ׳ ושולח Push (sw.js → #chart=SYM).
   מזהה חדש בכל חימוש מחדש / הזזה — כך השרתון לא מדלג על התראה שכבר נשלחה פעם. b = המחיר ברגע ההגדרה (נקודת המוצא לחצייה) */
const BG = { st: '', t: null, busy: false };
const newId = () => (Date.now().toString(36) + Math.random().toString(36).slice(2)).replace(/[^a-z0-9]/g, '').slice(-10);
function curPx(sym) {
  if (lastPx[sym] > 0) return lastPx[sym];
  const p = quotePrice(S.wq[sym] && parseQuote(S.wq[sym]));
  if (p > 0) return p;
  const c = S.cells.find((x) => x.sym === sym && x.disp.length);
  return c ? c.disp[c.disp.length - 1].close : 0;
}
function rearm(sym, a) { a.done = false; a.at = 0; a.id = newId(); a.b = curPx(sym); delete lastPx[sym]; }
function bgList() {
  const out = [];
  for (const s of Object.keys(S.store.alerts)) for (const a of S.store.alerts[s] || []) if (!a.done) out.push({ i: a.id, s, p: a.p, b: +a.b || 0, d: a.dir, n: a.note || '' });
  return out;
}
const b64u = (k) => { const t = atob(String(k).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((String(k).length + 3) % 4)); return Uint8Array.from(t, (ch) => ch.charCodeAt(0)); };
async function bgSub() {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker || typeof PushManager === 'undefined') return null;
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return null;
    const k = await E.sync({ op: 'pxa', act: 'key' });
    if (!k || !k.ok || !k.key) return null;
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64u(k.key) });
  }
  return sub ? sub.toJSON() : null;
}
async function bgSync(ask) {
  if (!E || !E.sync || !S.store || BG.busy) return;
  BG.busy = true;
  try {
    const canPush = typeof navigator !== 'undefined' && !!navigator.serviceWorker && typeof PushManager !== 'undefined' && typeof Notification !== 'undefined';
    if (ask && canPush && Notification.permission === 'default') { try { await Notification.requestPermission(); } catch (e) { /* לא נתמך */ } }
    let sub = null;
    try { sub = await bgSub(); } catch (e) { sub = null; }
    const r = await E.sync({ op: 'pxa', act: 'sync', alerts: bgList(), sub, lang: E.lang === 'en' ? 'en' : 'he' });
    if (!r || !r.ok) BG.st = r && r.error === 'no_auth' ? 'auth' : 'err';
    else {
      BG.st = r.n > 0 && sub ? 'on' : !canPush ? 'no' : Notification.permission === 'denied' ? 'deny' : 'off';
      // מה שהשרתון כבר שלח בזמן שהאפליקציה הייתה סגורה — מסומן כאן כ"הופעלה"
      let ch = false;
      for (const s of Object.keys(S.store.alerts)) for (const a of S.store.alerts[s] || []) if (!a.done && r.fired && r.fired[a.id]) { a.done = true; a.at = +r.fired[a.id] || NOW(); ch = true; }
      if (ch) { save(); for (const c of S.cells) drawAlerts(c); updBars(); }
    }
  } catch (e) { BG.st = 'err'; } finally { BG.busy = false; }
  if (BG.onSt) BG.onSt();
}
function bgSoon() { clearTimeout(BG.t); BG.t = setTimeout(() => bgSync(false), 1200); }

/* ---------- טווחי תצוגה (1D 5D 1M…) — כמו בתחתית TradingView: טווח + זום מתאים ---------- */
const RANGES = [['1D', '1m', 1], ['5D', '5m', 5], ['1M', '30m', 31], ['3M', '1h', 92], ['6M', '1D', 183], ['YTD', '1D', 'ytd'], ['1Y', '1D', 365], ['5Y', '1W', 1826], ['ALL', '1M', 'all']];
function fitRange(c, days) {
  const list = c.chart ? c.chart.getDataList() : [];
  if (!list.length) return;
  const end = list[list.length - 1].timestamp;
  let start;
  if (days === 'all') start = list[0].timestamp;
  else if (days === 'ytd') start = Date.UTC(new Date(end).getUTCFullYear(), 0, 1);
  else if (days === 1) { const dk = dayKeyFor(c.tz), k = dk(end); let i = list.length - 1; while (i > 0 && dk(list[i - 1].timestamp) === k) i--; start = list[i].timestamp; }
  else start = end - days * 86400000;
  const n = Math.max(2, list.length - dataIdx(list, start));
  const sz = c.chart.getSize(MAIN, 'main'), w = sz ? sz.width - 70 : 600;
  c.chart.setBarSpace(Math.max(1, Math.min(60, w / n)));
  c.chart.scrollToRealTime();
}
function goRange(r) {
  const c = S.cells[S.active];
  if (!c || !c.chart) return;
  S.range = r[0];
  if (c.tf !== r[1]) { c.fit = r[2]; setTf(c, r[1]); } else fitRange(c, r[2]);
  updBars();
}

/* ---------- שינוי סימבול / טווח / סוג ---------- */
/* מעבר חלק (בקשת המשתמש — "בלי תקיעות וקפיצות"): הנרות החדשים נטענים ברקע בזמן שהגרף הקודם עדיין על המסך
   (פס התקדמות דק בראש התא), ורק כשהם כאן — החלפה בפריים אחד. בלי מסך ריק ובלי ספינר באמצע */
async function switchCell(x, sym, tf) {
  const tok = (x.swTok = (x.swTok || 0) + 1);
  x.swTf = tf;   // הכפתור מסומן מיד — לא אחרי הטעינה
  x.el && x.el.classList.add('busy');
  let r = null;
  try { r = await fetchCandles(x, 0, sym, tf); } catch (e) { r = null; }
  if (tok !== x.swTok || !ROOT || !x.chart) return;
  x.el.classList.remove('busy'); x.swTf = null;
  if (x.replay) exitReplay(x, true);
  const symChanged = x.sym !== sym;
  x.sym = sym; x.tf = tf;
  if (symChanged) { x.drawnFor = null; x.q = null; x.chart.removeOverlay({ groupId: 'user' }); }
  x.pre = r ? { key: sym + '|' + tf + '|' + (S.store.g.ext ? 1 : 0), r } : null;
  setSymbolPeriod(x);
  save(); updBars(); updHeader(); updTags();
}
function setTf(c, tf) {
  if (!TF[tf]) return;
  const all = S.store.g.syncTf ? S.cells : [c];
  for (const x of all) switchCell(x, x.sym, tf);
  updBars();
}
function setSym(c, sym) {
  sym = String(sym || '').toUpperCase().slice(0, 20);
  if (!sym) return;
  saveNow();
  const all = S.store.g.syncSym ? S.cells : [c];
  for (const x of all) switchCell(x, sym, x.tf);
  const rec = S.store.g.recent = (S.store.g.recent || []).filter((x) => x !== sym); rec.unshift(sym); rec.splice(12);
  save();
}
function setType(c, type) {
  c.type = type;
  c.chart.setStyles(chartStyles(c));
  c.chart.resetData();
  save(); updBars();
}

/* ---------- Bar Replay (TradingView Premium) — חזרה על ההיסטוריה נר אחר נר ---------- */
function startPick() {
  const c = S.cells[S.active];
  if (!c || !c.chart || !c.raw.length) return;
  if (c.replay) { exitReplay(c); return; }
  S.pick = c; renderReplay();
}
function beginReplay(c, idx) {
  S.pick = null;
  const full = display(Object.assign({}, c, { replay: null })).length;
  if (!(idx >= 1)) idx = Math.max(1, full - 150);
  c.replay = { end: Math.min(full - 1, idx + 1), full, timer: null, speed: 1 };
  c.chart.resetData();
  renderReplay(); updBars();
}
function replayStep(c) {
  const r = c.replay;
  if (!r) return;
  if (r.end >= r.full) { replayPause(c); return; }
  r.end++;
  const nd = display(c);
  c.disp = nd;
  if (c.sub) c.sub(Object.assign({}, nd[nd.length - 1]));
  renderReplay();
}
function replayPlay(c) { const r = c.replay; if (!r || r.timer) return; r.timer = setInterval(() => replayStep(c), Math.round(1000 / r.speed)); renderReplay(); }
function replayPause(c) { const r = c.replay; if (r && r.timer) { clearInterval(r.timer); r.timer = null; } renderReplay(); }
function replaySpeed(c) { const r = c.replay; if (!r) return; const sp = [1, 2, 3, 5, 10]; r.speed = sp[(sp.indexOf(r.speed) + 1) % sp.length]; if (r.timer) { replayPause(c); replayPlay(c); } renderReplay(); }
function exitReplay(c, silent) {
  if (!c.replay) return;
  if (c.replay.timer) clearInterval(c.replay.timer);
  c.replay = null;
  if (!silent && c.chart) c.chart.resetData();
  S.pick = null;
  renderReplay(); updBars();
}
function onCross(c, x) {
  c.crossIdx = x && typeof x.dataIndex === 'number' ? x.dataIndex : c.crossIdx;
  updOhlc(c);
  plusAt(c, x);
  if (c === S.cells[S.active]) updLegendTime(x);
}
/* מגע לפי ת־גרף (ו־Apple Stocks): הצלב מופיע רק בלחיצה ארוכה, עם רטט קצר, ונשאר אחרי ההרמה.
   הקשה רגילה רק מסתירה אותו (התיקון בספרייה — vendor/klinecharts/README.md). */
/* פגיעה באצבע: הספרייה בודקת קווים בסטייה של 2px בלבד (מתאים לעכבר) — במגע מחפשים את האובייקט הקרוב עד 14px,
   לפי ת־גרף. מחזיר { o, alert } או null. x/y — יחסית לגרף */
const HIT_PX = 14;
function segDist(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy;
  const t = l ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l)) : 0;
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
function hitAt(c, x, y, tol) {
  if (!c || !c.chart) return null;
  let best = null, bd = tol || HIT_PX;
  const take = (o, d, alert) => { if (d <= bd) { bd = d; best = { o, alert }; } };
  const P = { x, y };
  for (const o of c.chart.getOverlays({ groupId: 'alert' }) || []) {
    const q = o.points[0] && px(c.chart, lastTs(c), o.points[0].value);
    if (q && isFinite(q.y)) take(o, Math.abs(q.y - y), true);
  }
  for (const o of c.chart.getOverlays({ groupId: 'user' }) || []) {
    if (o.visible === false) continue;
    const pts = (o.points || []).map((q) => px(c.chart, q.timestamp, q.value)).filter((q) => q && isFinite(q.x) && isFinite(q.y));
    if (!pts.length) continue;
    const n = o.name;
    let d = Infinity;
    if (/^horizontal/.test(n) || n === 'priceLine') d = Math.abs(pts[0].y - y);
    else if (/^vertical/.test(n)) d = Math.abs(pts[0].x - x);
    else if (n === 'kcCrossLine') d = Math.min(Math.abs(pts[0].y - y), Math.abs(pts[0].x - x));
    else if (pts.length === 1) d = Math.max(0, Math.hypot(pts[0].x - x, pts[0].y - y) - 14);   // טקסט, הערה, תגית, דגל, חץ — יש להם גוף סביב הנקודה
    else {
      for (let i = 1; i < pts.length; i++) d = Math.min(d, segDist(P, pts[i - 1], pts[i]));
      // קו ישר / קרן — ממשיכים מעבר לנקודות
      if (/^(straightLine|rayLine)$/.test(n)) { const a = pts[0], b = pts[1], vx = b.x - a.x, vy = b.y - a.y, k = n === 'rayLine' ? 0 : -1e3; if (vx || vy) d = Math.min(d, segDist(P, { x: a.x + vx * k, y: a.y + vy * k }, { x: a.x + vx * 1e3, y: a.y + vy * 1e3 })); }
      // כל צורה שאינה קו פשוט (מלבן, פיבונאצ׳י, תבניות, ערוצים, פוזיציה, טווחים, מדידה…) — נגיעה בתוך המסגרת שלה
      if (!/^(segment|rayLine|straightLine|kcInfoLine|kcArrow|brush)$/.test(n)) {
        const xs = pts.map((q) => q.x), ys = pts.map((q) => q.y);
        if (x >= Math.min(...xs) && x <= Math.max(...xs) && y >= Math.min(...ys) && y <= Math.max(...ys)) d = Math.min(d, HIT_PX - 1);
      }
    }
    take(o, d, false);
  }
  return best;
}
function selectHit(c, r) { if (r.alert) selectAlert(c, r.o); else select(c, r.o); }
function wireCellPointer(c) {
  let down = null, lp = 0, ct = null;
  // מצב מדידה בטלפון: נגיעה באצבע אחת מזיזה את הצלב ולא מגיעה לגרף (בלי גלילה/זום); כפתורים מעל הגרף — כרגיל
  const cOn = (e) => S.cur && S.cur.c === c && !(e.target && e.target.closest && e.target.closest('button'));
  // מדידה שנבחרה: גרירת אחת הידיות משנה את הנקודה שלה, לפי ת־גרף — האצבע שומרת על ההיסט מהידית כדי שלא תסתיר אותה
  let ed = null;
  const edGet = () => { const s = S.sel, o = s && !s.alert && s.c === c ? getOv(c, s.id) : null; return o && CUR_TOOLS.has(o.name) && !o.lock && (o.points || []).length === 2 ? o : null; };
  c.el.addEventListener('touchstart', (e) => {
    ed = null;
    const o = !S.cur && !S.tool && e.touches.length === 1 && !(e.target && e.target.closest && e.target.closest('button')) ? edGet() : null;
    if (!o) return;
    const r = c.host.getBoundingClientRect(), t = e.touches[0], x = t.clientX - r.left, y = t.clientY - r.top;
    let bi = -1, bd = 28;
    o.points.forEach((q, i) => { const p = px(c.chart, q.timestamp, q.value), d = p ? Math.hypot(p.x - x, p.y - y) : Infinity; if (d < bd) { bd = d; bi = i; ed = { o, i, dx: p.x - x, dy: p.y - y, r }; } });
    if (bi < 0) { ed = null; return; }
    e.stopPropagation();
  }, { capture: true, passive: true });
  c.el.addEventListener('touchmove', (e) => {
    if (!ed) return;
    e.stopPropagation();
    if (e.cancelable) e.preventDefault();
    const t = e.touches[0], sn = curSnap(c, t.clientX - ed.r.left + ed.dx, t.clientY - ed.r.top + ed.dy);
    if (!sn) return;
    const pts = ed.o.points.slice();
    pts[ed.i] = sn.pt;
    ed.moved = true;
    c.chart.overrideOverlay({ id: ed.o.id, points: pts });
    ed.o = getOv(c, ed.o.id) || ed.o;
    c.chart.executeAction('onCrosshairChange', { x: sn.x, y: sn.y, paneId: MAIN });
  }, { capture: true, passive: false });
  const edEnd = (e) => {
    if (!ed) return;
    const d = ed;
    ed = null;
    e.stopPropagation();
    if (e.cancelable) e.preventDefault();
    c.chart.executeAction('onCrosshairChange', null);
    if (d.moved) changed(c);
  };
  c.el.addEventListener('touchend', edEnd, { capture: true, passive: false });
  c.el.addEventListener('touchcancel', edEnd, true);
  // גרירת אובייקט (שרטוט / קו התראה) לפי ת־גרף: נגיעה אחת עליו בוחרת וגוררת מיד, בלי "הקשה ואז גרירה".
  // קרוב לידית — זזה הידית בלבד; במקום אחר על האובייקט — כולו זז. הספרייה לא רואה את הנגיעה, אז הגרף לא גולל בטעות
  let od = null;
  const odSel = (o, i) => {
    try { c.chart._chartStore.setClickOverlayInfo({ paneId: MAIN, overlay: o, figureType: 'point', figureIndex: i, figure: null }, () => {}, () => {}); } catch (x) { /* בלי ידיות — הסרגל עדיין נבחר */ }
  };
  c.el.addEventListener('touchstart', (e) => {
    od = null;
    if (ed || S.cur || S.tool || S.pick === c || !c.chart || e.touches.length !== 1 || (e.target && e.target.closest && e.target.closest('button'))) return;
    const r = c.host.getBoundingClientRect(), t = e.touches[0], x = t.clientX - r.left, y = t.clientY - r.top, sz = c.chart.getSize(MAIN, 'main');
    if (!sz || x < 0 || y < 0 || x >= sz.width || y >= sz.height) return;   // ציר המחיר והזמן — כרגיל
    const hit = hitAt(c, x, y, 20);
    if (!hit) return;
    selectHit(c, hit);
    const o = hit.o;
    if (!hit.alert && o.lock) return;
    const pts = (o.points || []).map((q) => px(c.chart, q.timestamp, q.value));
    if (!pts.length || pts.some((q) => !q || !isFinite(q.x) || !isFinite(q.y))) return;
    let pi = -1;
    if (!hit.alert && pts.length > 1) { let bd = 26; pts.forEach((q, i) => { const d = Math.hypot(q.x - x, q.y - y); if (d < bd) { bd = d; pi = i; } }); }
    odSel(o, pi < 0 ? 0 : pi);
    od = { o, alert: hit.alert, x0: t.clientX, y0: t.clientY, pts, pi, base: (o.points || []).map((q) => ({ timestamp: q.timestamp, value: q.value })), sz, moved: false };
    e.stopPropagation();
  }, { capture: true, passive: true });
  c.el.addEventListener('touchmove', (e) => {
    if (!od) return;
    e.stopPropagation();
    if (e.cancelable) e.preventDefault();
    const t = e.touches[0], dx = t.clientX - od.x0, dy = t.clientY - od.y0;
    if (!od.moved && Math.hypot(dx, dy) < 3) return;
    od.moved = true;
    const next = od.base.map((b, i) => {
      if (od.alert) { const q = od.pts[i], cv = c.chart.convertFromPixel([{ x: q.x, y: Math.max(0, Math.min(od.sz.height - 1, q.y + dy)) }], { paneId: MAIN })[0]; return { timestamp: b.timestamp, value: cv && isFinite(cv.value) ? cv.value : b.value }; }
      if (od.pi >= 0 && od.pi !== i) return b;
      const q = od.pts[i], cv = c.chart.convertFromPixel([{ x: Math.max(0, Math.min(od.sz.width - 1, q.x + dx)), y: Math.max(0, Math.min(od.sz.height - 1, q.y + dy)) }], { paneId: MAIN })[0];
      return cv && isFinite(cv.value) ? { timestamp: typeof cv.timestamp === 'number' && isFinite(cv.timestamp) ? cv.timestamp : b.timestamp, value: cv.value } : b;
    });
    c.chart.overrideOverlay({ id: od.o.id, points: next });
    od.next = next;
  }, { capture: true, passive: false });
  const odEnd = (e) => {
    if (!od) return;
    const d = od;
    od = null;
    e.stopPropagation();
    if (e.cancelable) e.preventDefault();
    if (!d.moved || !d.next) return;
    if (d.alert) {
      const a = (S.store.alerts[c.sym] || []).find((x) => x.id === (d.o.extendData && d.o.extendData.id));
      if (!a) return;
      a.p = d.next[0].value; rearm(c.sym, a); save(); bgSoon();
      setTimeout(() => {
        drawAlerts(c);
        const n = (c.chart.getOverlays({ groupId: 'alert' }) || []).find((x) => x.extendData && x.extendData.id === a.id);
        if (n) { odSel(n, 0); selectAlert(c, n); }   // הקו נבנה מחדש — נשאר נבחר
      }, 0);
    } else changed(c);
  };
  c.el.addEventListener('touchend', odEnd, { capture: true, passive: false });
  c.el.addEventListener('touchcancel', odEnd, true);
  c.el.addEventListener('touchstart', (e) => {
    if (ed || !cOn(e) || e.touches.length > 1) { ct = null; return; }
    e.stopPropagation();
    const t = e.touches[0];
    ct = { x: t.clientX, y: t.clientY, cx: S.cur.x, cy: S.cur.y, t: Date.now(), moved: false };
  }, { capture: true, passive: true });
  c.el.addEventListener('touchmove', (e) => {
    if (!ct || !cOn(e)) return;
    e.stopPropagation();
    if (e.cancelable) e.preventDefault();
    const t = e.touches[0], dx = t.clientX - ct.x, dy = t.clientY - ct.y;
    if (!ct.moved && Math.hypot(dx, dy) < 6) return;
    ct.moved = true;
    const sz = c.chart && c.chart.getSize(MAIN, 'main');
    S.cur.x = Math.max(0, Math.min(sz ? sz.width - 1 : 9999, ct.cx + dx));
    S.cur.y = Math.max(0, Math.min(sz ? sz.height - 1 : 9999, ct.cy + dy));
    if (!S.cur.raf) S.cur.raf = requestAnimationFrame(curShow);
  }, { capture: true, passive: false });
  c.el.addEventListener('touchend', (e) => {
    if (!ct || !cOn(e)) { ct = null; return; }
    e.stopPropagation();
    if (e.cancelable) e.preventDefault();   // בלי עכבר מדומה / click אחרי ההקשה
    const d = ct;
    ct = null;
    if (!d.moved && Date.now() - d.t < 400) curTap();
  }, { capture: true, passive: false });
  c.el.addEventListener('touchcancel', () => { ct = null; }, true);
  // גרירה אנכית חופשית לפי ת־גרף: הספרייה מזיזה את המחיר רק כשהציר כבר לא אוטומטי (אחרי גרירת הסרגל מימין).
  // גרירה שנעשית אנכית בזמן שהציר אוטומטי — מקבעת את הטווח הנוכחי וממשיכה אותו עם האצבע; משם הספרייה ממשיכה לבד
  let pv = null;
  c.el.addEventListener('pointerdown', (e) => { pv = e.isPrimary && !S.tool && !(S.cur && S.cur.c === c) ? { id: e.pointerId, x: e.clientX, y: e.clientY, r0: null } : null; }, true);
  c.el.addEventListener('pointermove', (e) => {
    if (!pv || e.pointerId !== pv.id || ed || od || ct || !c.chart) return;
    if (e.pointerType === 'mouse' && !(e.buttons & 1)) { pv = null; return; }
    const ev = c.chart._chartEvent;
    if (!ev || !ev._startScrollCoordinate) return;   // הספרייה לא גוללת (שרטוט נגרר, ציר, צלב)
    const dy = e.clientY - pv.y;
    if (!pv.r0) {
      const axs = mainYAxes(c).filter((a) => a.getAutoCalcTickFlag() && a.scrollZoomEnabled !== false);
      if (!axs.length) { pv = null; return; }
      if (Math.abs(dy) < 12 || Math.abs(dy) < Math.abs(e.clientX - pv.x) * 0.6) return;
      const sz = c.chart.getSize(MAIN, 'main');
      pv.r0 = axs.map((a) => [a, Object.assign({}, a.getRange())]);
      pv.h = (sz && sz.height) || 1;
    }
    pv.r0.forEach(([ax, r]) => {
      const g = r.range * ((ax.reverse ? -dy : dy) / pv.h), from = r.from + g, to = r.to + g;
      const rf = ax.valueToRealValue(from, { range: r }), rt = ax.valueToRealValue(to, { range: r });
      const df = ax.realValueToDisplayValue(rf, { range: r }), dt = ax.realValueToDisplayValue(rt, { range: r });
      ax.setRange({ from, to, range: to - from, realFrom: rf, realTo: rt, realRange: rt - rf, displayFrom: df, displayTo: dt, displayRange: dt - df });
    });
    if (!pv.raf) pv.raf = requestAnimationFrame(() => { if (pv) pv.raf = 0; try { c.chart.layout({ update: true, buildYAxisTick: true }); } catch (x) { /* גרסה אחרת */ } });
  }, true);
  const pvEnd = (e) => { if (pv && e.pointerId === pv.id) pv = null; };
  c.el.addEventListener('pointerup', pvEnd, true);
  c.el.addEventListener('pointercancel', pvEnd, true);
  const far = (e) => down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8;
  c.el.addEventListener('pointerdown', (e) => {
    if (S.cur && S.cur.c === c) { down = null; clearTimeout(lp); return; }
    down = { x: e.clientX, y: e.clientY, t: Date.now(), touch: e.pointerType === 'touch' };
    if (S.active !== c.i) setActive(c.i);
    clearTimeout(lp);
    if (down.touch && e.isPrimary) lp = setTimeout(() => {
      if (!down) return;
      try { if (navigator.vibrate) navigator.vibrate(8); } catch (x) { /* בלי רטט */ }
      // הנגיעה בחרה אובייקט (שרטוט / קו התראה) — לחיצה ארוכה עליו = תפריט עם "מחק", לפי ת־גרף
      if (S.tool) return;
      const r = c.host.getBoundingClientRect(), hit = hitAt(c, down.x - r.left, down.y - r.top);
      if (hit) selectHit(c, hit);
      if (hit || (S.sel && S.sel.c === c && S.sel.at >= down.t - 30)) { down = null; c.chart.executeAction('onCrosshairChange', null); openObjMenu(); }
    }, 520);
  }, true);
  c.el.addEventListener('pointermove', (e) => { if (far(e)) clearTimeout(lp); }, true);
  c.el.addEventListener('pointercancel', () => { clearTimeout(lp); down = null; }, true);
  c.el.addEventListener('pointerup', (e) => {
    clearTimeout(lp);
    if (!down) return;
    const moved = far(e), tap = down.touch && !moved && Date.now() - down.t < 350;
    const d0 = down;
    down = null;
    // הקשה באצבע על אובייקט = בחירה (בחלון רחב יותר משל הספרייה); הקשה על רקע ריק = ביטול הבחירה
    if (tap && !S.tool && S.pick !== c && c.chart) {
      const r = c.host.getBoundingClientRect(), hit = hitAt(c, d0.x - r.left, d0.y - r.top);
      setTimeout(() => { if (hit) selectHit(c, hit); else if (S.sel && S.sel.c === c && S.sel.at < d0.t - 30) deselect(); }, 0);
    }
    if (!moved && S.pick === c) {
      // במגע הקשה לא פותחת צלב (vendor/klinecharts/README.md) — הנר נקבע מנקודת ההקשה
      if (tap && c.chart) { try { const r = c.host.getBoundingClientRect(), p = c.chart.convertFromPixel([{ x: e.clientX - r.left, y: e.clientY - r.top }], { paneId: MAIN })[0]; if (p && typeof p.dataIndex === 'number') c.crossIdx = p.dataIndex; } catch (x) { /* נשאר האחרון */ } }
      setTimeout(() => beginReplay(c, c.crossIdx), 30);
    }
  }, true);
}

/* ---------- גיליונות (חלונות מלמטה בטלפון / במרכז במחשב). כל גיליון = רשומת "חזור" ---------- */
function openSheet(title, fill, opt) {
  const root = (opt && opt.root) || ROOT;
  if (!root) return null;
  if (S.watch && narrow()) closeWatch();
  const sh = { el: null, modal: null };
  const body = h('div', { class: 'kc-sh-body' });
  const panel = h('div', { class: 'kc-sheet' + (opt && opt.wide ? ' wide' : ''), role: 'dialog', 'aria-label': title },
    h('div', { class: 'kc-sh-head' }, h('div', { class: 'kc-sh-title', text: title }), btn('kc-ib', T('kcClose'), () => closeSheet(sh), ICON.close)), body);
  sh.el = h('div', { class: 'kc-sh-back' + (opt && opt.clear ? ' clear' : ''), onclick: (e) => { if (e.target === sh.el) closeSheet(sh); } }, panel);
  root.appendChild(sh.el);
  if (opt && opt.onClose) sh.onClose = opt.onClose;
  S.sheets.push(sh);
  sh.modal = E.modalPush ? E.modalPush(() => closeSheet(sh, true)) : null;
  fill(body, sh);
  return sh;
}
function closeSheet(sh, fromPop) {
  if (!sh || !sh.el) return;
  const i = S.sheets.indexOf(sh);
  if (i >= 0) S.sheets.splice(i, 1);
  const el = sh.el; sh.el = null;
  if (!reduced() && typeof el.animate === 'function') {
    el.style.pointerEvents = 'none';
    const a = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, easing: 'ease-in', fill: 'forwards' });
    a.onfinish = () => el.remove();
  } else el.remove();
  if (!fromPop && sh.modal) unwind([sh.modal]);
  sh.modal = null;
  if (sh.onClose) sh.onClose();
}
function unwind(recs) {
  let n = 0;
  for (const r of recs) {
    if (!r || r === true || r.done) continue;
    if (r.pushed) n++;
    r.popping = true;
    if (E.modalDone) E.modalDone(r);
  }
  if (n && E.back) E.back(n);
}
const row = (...kids) => h('div', { class: 'kc-row' }, ...kids);
function toggle(label, on, set) {
  const b = h('button', { type: 'button', class: 'kc-tg' + (on ? ' on' : ''), role: 'switch', 'aria-checked': on ? 'true' : 'false' }, h('span', { text: label }), h('i'));
  b.addEventListener('click', () => { on = !on; b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); set(on); });
  return b;
}
function seg(opts, cur, set) {
  const w = h('div', { class: 'kc-seg' });
  for (const [v, label] of opts) {
    const b = btn('kc-seg-b' + (v === cur ? ' on' : ''), label, () => { for (const x of w.children) x.classList.remove('on'); b.classList.add('on'); set(v); });
    w.appendChild(b);
  }
  return w;
}

/* ---------- המסך ---------- */
const LAYOUTS = { 1: 1, 2: 2, 3: 2, 4: 3, 5: 4 };   // 1 · שניים בעמודות · שניים בשורות · אחד גדול ושניים · 2×2
const UI = {};
const act = () => S.cells[S.active];
function tfLabel(tf) { return tf; }
function build(sym) {
  ROOT.textContent = '';
  const g = S.store.g;
  S.layout = g.layout;
  const n = LAYOUTS[S.layout];
  S.cells = [];
  for (let i = 0; i < n; i++) {
    const conf = g.cells[i] || (i ? { tf: (g.cells[0] || {}).tf || '1D', type: 'candle_solid', ind: DEF_IND } : { tf: '1D', type: 'candle_solid', ind: DEF_IND });
    S.cells.push(newCell(i, { sym: i === 0 ? sym : conf.sym || sym, tf: conf.tf, type: conf.type, ind: conf.ind }));
  }
  S.active = 0;
  UI.top = h('div', { class: 'kc-top' });
  UI.bar = h('div', { class: 'kc-bar', role: 'toolbar' });
  UI.side = h('div', { class: 'kc-side', role: 'toolbar', 'aria-label': T('kcTools') });
  UI.grid = h('div', { class: 'kc-grid', 'data-l': String(S.layout) });
  UI.watch = h('div', { class: 'kc-watch' + (S.watch ? ' on' : '') });
  UI.wveil = h('div', { class: 'kc-wveil', onclick: () => closeWatch() });   // בטלפון: טשטוש מאחורי רשימת המעקב, נגיעה בו סוגרת
  UI.foot = h('div', { class: 'kc-foot' });
  UI.sel = h('div', { class: 'kc-selbar' });
  UI.rep = h('div', { class: 'kc-repbar' });
  UI.fab = btn('kc-fab', T('kcTools'), openToolsSheet, ICON.pencil);
  UI.mbar = h('div', { class: 'kc-mbar' });
  ROOT.append(UI.top, UI.bar, h('div', { class: 'kc-main' }, UI.side, UI.grid, UI.wveil, UI.watch), UI.foot, UI.mbar, UI.sel, UI.rep, UI.fab);
  for (const c of S.cells) {
    c.host = h('div', { class: 'kc-host', dir: 'ltr' });
    c.stEl = h('div', { class: 'kc-st' });
    c.tagEl = btn('kc-ctag', '', () => { setActive(c.i); openSearch(); });
    // ">>" לפי ת־גרף — מופיע רק כשגללו אחורה והנר האחרון לא במסך
    c.nowB = btn('kc-now', T('kcToNow'), () => { if (c.chart) c.chart.scrollToRealTime(200); }, ICON.now);
    // "+" בציר המחיר ליד הצלב (TradingView): התראה / קו אופקי במחיר הזה
    c.plusB = btn('kc-plus', T('kcPlusAt'), () => openPlus(c), ICON.plus);
    // מדידה מהירה בפינה העליונה (בטלפון, לפי ת־גרף): מחיר+תאריך, מחיר
    c.qm = h('div', { class: 'kc-qm' },
      qmBtn(c, 'kcMeasure', T('kcToMeasure'), ICON.qboth), qmBtn(c, 'kcPriceRange', T('kcToPRange'), ICON.qprice));
    // בטלפון: "נר" (טווח הזמן של כל נר) ו"תצוגה" (כמה זמן רואים בגרף) בפינה העליונה של הגרף
    c.pick = h('div', { class: 'kc-pick' });
    c.ohlc = h('div', { class: 'kc-ohlc', 'aria-hidden': 'true' });
    c.el = h('div', { class: 'kc-cell' + (c.i === S.active ? ' act' : '') }, c.host, c.stEl, c.tagEl, c.nowB, c.plusB, c.qm, c.pick, c.ohlc);
    UI.grid.appendChild(c.el);
  }
  renderTop(); updBars(); renderSide(); renderFoot(); renderSel(); renderReplay(); updTags();
  requestAnimationFrame(() => {
    if (!ROOT) return;
    for (const c of S.cells) { try { mountCell(c); } catch (e) { c.err = 'fail'; renderStatus(c); } }
  });
  if (S.ro) S.ro.disconnect();
  if (typeof ResizeObserver === 'function') {
    S.ro = new ResizeObserver(() => { for (const c of S.cells) if (c.chart) { c.chart.setStyles({ candle: { tooltip: { offsetTop: topPad(c) } }, xAxis: { size: xSize() } }); volGap(c); c.chart.resize(); } });
    S.ro.observe(UI.grid);
    S.ro.observe(UI.top);
    S.ro.observe(UI.mbar);   // הכותרת מתארכת כשבועת הסשן מופיעה — המקרא יורד מתחתיה
  }
}
function qmBtn(c, tool, label, icon) {
  const b = btn('kc-ib sm', label, () => { if (S.tool === tool && S.active === c.i) { stopTool(); return; } setActive(c.i); startTool(tool); }, icon);
  b.dataset.t = tool;
  return b;
}
function setActive(i) {
  if (!S.cells[i] || S.active === i) return;
  if (S.tool) stopTool();
  S.active = i;
  for (const c of S.cells) c.el.classList.toggle('act', c.i === i);
  updHeader(); updBars(); renderReplay();
}
function setLayout(l) {
  if (!LAYOUTS[l]) return;
  saveNow();
  const sym = act() ? act().sym : '';
  for (const c of S.cells) { if (c.replay) exitReplay(c, true); if (c.chart) { try { K.dispose(c.host); } catch (e) { /* כבר נסגר */ } c.chart = null; } }
  S.store.g.layout = l;
  S.store.g.cells = S.store.g.cells.slice(0, LAYOUTS[l]);
  build(sym);
  save();
}

function renderTop() {
  UI.top.textContent = '';
  UI.hd = {};
  // זכוכית מדורגת: חמש שכבות טשטוש שכל אחת נמוגה במקום אחר — הטשטוש מתחזק בהדרגה כלפי מעלה, והגרף נעלם לתוכה
  UI.top.appendChild(h('div', { class: 'kc-pb', 'aria-hidden': 'true' }, ...[1, 2, 3, 4, 5].map(() => h('i'))));
  const c = act();
  UI.hd.sym = h('span', { class: 'kc-sym' });
  UI.hd.name = h('span', { class: 'kc-name' });
  UI.hd.logo = h('span', { class: 'kc-logo' });
  UI.hd.px = h('span', { class: 'kc-px stock-price' });   // stock-price: הבזק ירוק/אדום של רובין הוד (styles.css), כמו בכרטיס
  UI.hd.cur = h('span', { class: 'kc-cur' });
  UI.hd.ch = h('span', { class: 'kc-ch' });
  UI.hd.st = h('span', { class: 'kc-mst' });
  UI.hd.ext = h('span', { class: 'kc-ext' });
  const symBtn = h('button', { type: 'button', class: 'kc-symbtn', 'aria-label': T('kcSearch'), onclick: openSearch }, UI.hd.logo, h('span', { class: 'kc-symcol' }, UI.hd.sym, UI.hd.name), h('span', { class: 'kc-caret', html: ICON.search }));
  UI.top.append(
    btn('kc-ib kc-back', T('kcBack'), () => closeChart(), ICON.back),
    symBtn,
    // סטטוס המסחר (מאוחר / טרום / לילי) — בין הסימבול למחיר (בקשת המשתמש 28/10)
    h('div', { class: 'kc-xst' }, UI.hd.ext),
    h('div', { class: 'kc-quote' }, h('div', { class: 'kc-pxrow' }, UI.hd.px, UI.hd.cur), h('div', { class: 'kc-pxrow sm' }, UI.hd.ch, UI.hd.st)),
    h('div', { class: 'kc-top-end' },
      UI.undoB = btn('kc-ib kc-undo', T('kcUndo'), undo, ICON.undo), UI.redoB = btn('kc-ib kc-redo', T('kcRedo'), redo, ICON.redo),
      btn('kc-ib', T('kcShot'), shot, ICON.cam), btn('kc-ib' + (S.watch ? ' on' : ''), T('kcWatch'), toggleWatch, ICON.watch), btn('kc-ib', T('kcSettings'), openSettings, ICON.gear)),
  );
  if (c) updHeader();
  updUndo();
}
/* בטלפון: שורת הנתונים (פתיחה/גבוה/נמוך/סגירה/שינוי/נפח) — HTML ברוחב המסך, תווית קטנה ומעליה ערך גדול (לפי ת־גרף),
   במקום המקרא הזעיר של הקנבס. הנר שתחת הצלב, או האחרון */
function updOhlc(c) {
  if (!c || !c.ohlc || !c.disp || !c.disp.length) return;
  const n = c.disp.length, i = typeof c.crossIdx === 'number' && c.crossIdx >= 0 && c.crossIdx < n ? c.crossIdx : n - 1;
  const b = c.disp[i], pv = i > 0 ? c.disp[i - 1].close : b.open, pr = L.precisionFor(b.close), ch = b.close - pv;
  const cells = [['kcOhO', fmtNum(b.open, pr)], ['kcOhH', fmtNum(b.high, pr)], ['kcOhL', fmtNum(b.low, pr)], ['kcOhC', fmtNum(b.close, pr)], ['kcOhCh', fmtPct(pv ? (ch / pv) * 100 : 0), ch > 0 ? 'up' : ch < 0 ? 'dn' : ''], ['kcVolW', fmtBig(b.volume)]];
  const key = i + '|' + b.close + '|' + b.volume;
  if (c.ohlc.dataset.k === key) return;
  c.ohlc.dataset.k = key;
  c.ohlc.replaceChildren(...cells.map(([k, v, cl]) => h('span', { class: 'kc-oh' }, h('i', { text: T(k) }), h('b', { class: cl || '', text: v }))));
}
function updHeader() {
  const c = act();
  if (!c || !UI.hd) return;
  updOhlc(c);
  const q = c.q, last = c.disp.length ? c.disp[c.disp.length - 1] : null;
  const reg = (q && q.reg && q.reg.p) || (last && last.close) || 0, st = q ? q.st : '';
  /* כמו בכרטיס המניה: מחוץ למסחר הרגיל המחיר הראשי = המחיר המורחב, לידו גלולת "מסחר־מאוחר −0.28%",
     ומתחת השינוי של היום (סגירה רגילה מול הסגירה הקודמת) */
  const extOn = !!(q && q.ext && q.ext.p > 0 && st !== 'REGULAR' && q.reg && q.reg.p), p = extOn ? q.ext.p : reg;
  const prev = q && q.prev ? q.prev : 0;
  if (UI.hd.sym.textContent !== c.sym) {
    UI.hd.sym.textContent = c.sym;
    UI.hd.logo.innerHTML = E.logoHTML ? E.logoHTML(c.sym) : '';   // HTML קבוע של האפליקציה (תמונת לוגו)
  }
  const nm = (E.name && E.name(c.sym)) || c.name || (q && q.name) || '';
  UI.hd.name.textContent = nm && nm !== c.sym ? nm : (c.ex || '');
  const pr = L.precisionFor(p);
  // מחיר כמו בכרטיס המניה: הספרות שהשתנו מתגלגלות למעלה/למטה והמחיר מהבהב (livePriceSwap של האפליקציה, E.pxSwap)
  const pt = p ? fmtNum(p, pr) : '—', pel = UI.hd.px;
  if (pel.dataset.sym !== c.sym) { pel.dataset.sym = c.sym; delete pel.dataset.px; }   // מניה אחרת — בלי גלגול מהמחיר הקודם
  if (E.pxSwap && p) E.pxSwap(pel, pt, p); else { pel.textContent = pt; if (p) pel.dataset.px = String(p); }
  pel.classList.toggle('px-lg', pt.length >= 8 && pt.length < 10); pel.classList.toggle('px-xl', pt.length >= 10);   // כמו בכרטיס: מחיר ארוך מוקטן
  UI.hd.cur.textContent = p && c.cur ? ' ' + c.cur : '';
  const ch = prev && reg ? reg - prev : null;
  UI.hd.ch.textContent = ch == null ? '' : (ch > 0 ? '+' : '') + fmtNum(ch, pr) + ' (' + fmtPct((reg / prev - 1) * 100) + ')';
  UI.hd.ch.className = 'kc-ch ' + (ch > 0 ? 'up' : ch < 0 ? 'dn' : '');
  UI.hd.st.textContent = !q || extOn ? '' : st === 'REGULAR' ? '● ' + T('kcStLive') : st === 'PRE' || st === 'PREPRE' ? T('kcStPre') : st === 'POST' || st === 'POSTPOST' ? T('kcStPost') : T('kcStClosed');
  UI.hd.st.className = 'kc-mst' + (st === 'REGULAR' ? ' live' : '');
  if (extOn) {
    const xk = q.extK || (/PRE/.test(st) ? 'pre' : 'post'), ep = (q.ext.p / q.reg.p - 1) * 100, k = { pre: 'sessPreShort', post: 'sessPostShort', night: 'sessNightShort' }[xk];
    // בטלפון התווית הקצרה ("אחרי" / "טרום" / "לילי") — אין רוחב ל־"מסחר־מאוחר" ליד המחיר והסימבול
    const sh = { pre: 'kcPre', post: 'kcPost', night: 'kcNight' }[xk];
    UI.hd.ext.replaceChildren(h('span', { class: 'ext-dot' }), h('span', { class: 'ext-lbl lg', text: T(k) }), h('span', { class: 'ext-lbl sm', text: T(sh) }), h('span', { class: 'ext-pct', text: fmtPct(ep) }));
    UI.hd.ext.className = 'kc-ext ext-sess ' + (Math.abs(ep) < 0.005 ? '' : ep > 0 ? 'pos' : 'neg');
    // השוק סגור (סופ״ש/חג): במקום "לילי" — הבועה הקומפקטית של Invest (שתי שורות, אותו גודל)
    const cl = st === 'CLOSED' && E.closedEl ? E.closedEl({ symbol: c.sym, session: 'closed', ext: { kind: xk, price: q.ext.p, pct: ep } }) : null;
    if (cl) { UI.hd.ext.replaceChildren(cl); UI.hd.ext.className = 'kc-ext kc-cl'; }
  } else { UI.hd.ext.textContent = ''; UI.hd.ext.className = 'kc-ext'; }
  updClock();
}
/* ספירה לאחור לסגירת הנר (כמו בציר המחיר של TradingView) + השעה בבורסה */
const CLOCKF = new Map();   // יצירת Intl.DateTimeFormat בכל שנייה — יקרה (נמדד)
function updClock() {
  const c = act();
  if (!c || !UI.clock) return;
  let s = '';
  const last = c.disp.length ? c.disp[c.disp.length - 1] : null;
  if (last && L.isIntraday(c.tf) && c.q && c.q.st === 'REGULAR' && !c.replay) {
    const left = Math.max(0, last.timestamp + TF[c.tf].sec * 1000 - NOW());
    const m = Math.floor(left / 60000), ss = Math.floor(left / 1000) % 60;
    if (left < TF[c.tf].sec * 1000 + 1000) s = T('kcCloseIn') + ' ' + (m >= 60 ? Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0') : m) + ':' + String(ss).padStart(2, '0') + ' · ';
  }
  const tz = S.store.g.tz === 'local' ? undefined : c.tz;
  try {
    const fk = tz || '';
    if (!CLOCKF.has(fk)) CLOCKF.set(fk, new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }));
    s += CLOCKF.get(fk).format(new Date()) + ' ' + (tz ? tz.split('/').pop().replace(/_/g, ' ') : T('kcLocal'));
  } catch (e) { /* אזור לא מוכר */ }
  UI.clock.textContent = s;
}
function updUndo() {
  const c = act();
  if (UI.undoB) UI.undoB.disabled = !c || !c.undo.length;
  if (UI.redoB) UI.redoB.disabled = !c || !c.redo.length;
  const mu = UI.mbar && !S.tool && UI.mbar.lastChild;
  if (mu) mu.disabled = !c || !c.undo.length;
}
function updTags() {
  const multi = S.cells.length > 1;
  for (const c of S.cells) {
    if (!c.tagEl) continue;
    c.tagEl.hidden = !multi;
    c.tagEl.textContent = c.sym + ' · ' + tfLabel(c.tf);
  }
}

/* סרגל עליון: טווחי זמן מועדפים, סוג גרף, אינדיקטורים, השוואה, פריסה, Replay, התראות, ניתוח אוטומטי, עוד */
function updBars() {
  if (!UI.bar) return;
  const c = act(), sx = UI.bar.scrollLeft;
  UI.bar.textContent = '';
  if (!c) return;
  const g = S.store.g;
  const tfs = h('div', { class: 'kc-tfs' }), ctf = c.swTf || c.tf;
  for (const tf of g.fav) tfs.appendChild(btn('kc-tf' + (tf === ctf ? ' on' : ''), tfLabel(tf), () => setTf(c, tf)));
  if (!g.fav.includes(ctf)) tfs.appendChild(btn('kc-tf on', tfLabel(ctf), openTfSheet));
  tfs.appendChild(btn('kc-tf more', T('kcMoreTf'), openTfSheet, ICON.more));
  const ty = TYPES.find((x) => x[0] === c.type) || TYPES[0];
  const sep = () => h('span', { class: 'kc-sep' });
  const tb = (icon, label, on, active) => { const b = h('button', { type: 'button', class: 'kc-tb' + (active ? ' on' : ''), title: label, 'aria-label': label, onclick: on, html: ICON[icon] }); b.appendChild(h('span', { text: label })); return b; };
  UI.bar.append(tfs, sep(),
    tb(ty[2], T('kcType'), openTypeSheet),
    tb('fx', T('kcIndicators'), openIndSheet),
    tb('plus', T('kcCompare'), openCompare, hasInd(c, 'KCCMP')),
    tb('auto', T('kcAuto'), openAutoSheet, Object.keys(AUTO).some((k) => hasInd(c, k))),
    sep(),
    tb('layout', T('kcLayout'), openLayoutSheet, S.cells.length > 1),
    tb('replay', T('kcReplay'), startPick, !!(c.replay || S.pick === c)),
    tb('bell', T('kcAlerts'), openAlerts, (S.store.alerts[c.sym] || []).some((a) => !a.done)),
    tb('season', T('kcSeason'), openSeason),
    tb('test', T('kcBacktest'), openBacktest, hasInd(c, 'KCBT')),
    tb('list', T('kcObjects'), openObjects),
  );
  UI.bar.scrollLeft = sx;   // בנייה מחדש בלי קפיצה של הסרגל להתחלה
  renderFoot();
  renderMbar();
  for (const x of S.cells) renderPick(x);
}

/* טלפון: שני בוררים בפינה העליונה של הגרף, כל אחד עם כותרת קטנה לפי ת־גרף —
   "אינטרוול" (Interval) = כמה זמן כל נר (1D, 1W…), "טווח תאריכים" (Date range) = כמה זמן מוצג בגרף (1M, 1Y…).
   בדיוק כמו הכפתור שהיה בסרגל התחתון: גרירה אנכית = גלגלת, הקשה = רשימה */
function renderPick(c) {
  if (!c.pick) return;
  c.pick.textContent = '';
  const r = c === act() && S.range ? RANGES.find((x) => x[0] === S.range && x[1] === c.tf) : null;
  const pill = (cap, aria, val, open, items, pick) => {
    const v = h('b', { class: 'kc-pk-v', text: val });
    const b = h('button', { type: 'button', class: 'kc-pk', 'aria-label': aria + ': ' + val, title: aria, onclick: () => { setActive(c.i); open(); } },
      h('span', { class: 'kc-pk-c', text: cap }), h('span', { class: 'kc-pk-r' }, v, h('span', { class: 'kc-pk-ud', html: ICON.updown })));   // ⌃⌄ כמו בורר גלילה של iOS — רמז שאפשר לגלגל
    wheel(b, items, (it) => { setActive(c.i); pick(it); }, v);
    return b;
  };
  const ctf = c.swTf || c.tf, fav = S.store.g.fav.includes(ctf) ? S.store.g.fav : [...S.store.g.fav, ctf];
  c.pick.append(
    pill(T('kcPickTf'), T('kcPickTfA'), tfLabel(ctf), openTfSheet, () => fav.map((tf) => ({ v: tf, t: tfLabel(tf), l: tfLong(tf), cur: tf === ctf })), (it) => setTf(c, it.v)),
    pill(T('kcPickRg'), T('kcPickRgA'), r ? r[0] : spanLabel(c), openRangeSheet, () => RANGES.map((x) => ({ v: x, t: x[0], l: rangeLong(x[0]), cur: !!r && x === r })), (it) => goRange(it.v)));
  c.pkRg = r ? null : c.pick.lastChild.querySelector('.kc-pk-v');   // בלי טווח שנבחר — מציג את הטווח שרואים בפועל (מתעדכן בגלילה/זום)
}
/* הטווח שרואים עכשיו בגרף → הטווח הקרוב ברשימה (כשלא נבחר טווח, או אחרי זום) */
function spanLabel(c) {
  const list = c.chart ? c.chart.getDataList() : [];
  if (list.length < 2) return '—';
  const vr = c.chart.getVisibleRange(), a = list[Math.max(0, Math.min(list.length - 1, vr.realFrom))], b = list[Math.max(0, Math.min(list.length - 1, vr.realTo - 1))];
  if (vr.realFrom <= 0) return 'ALL';
  const d = (b.timestamp - a.timestamp) / 86400000;
  let best = RANGES[0], bd = Infinity;
  for (const x of RANGES) if (typeof x[2] === 'number') { const k = Math.abs(Math.log(Math.max(d, 0.3) / x[2])); if (k < bd) { bd = k; best = x; } }
  return best[0];
}
/* שם מלא לטווח בגלגלת ("5 שנים", "1 month") — Intl, בלי מחרוזות חדשות */
function rangeLong(r) {
  const m = /^(\d+)(D|M|Y)$/.exec(r);
  if (!m) return r;
  try { return new Intl.NumberFormat(E.lang === 'en' ? 'en-US' : 'he-IL', { style: 'unit', unit: { D: 'day', M: 'month', Y: 'year' }[m[2]], unitDisplay: 'long' }).format(+m[1]); } catch (e) { return r; }
}
function openRangeSheet() {
  const c = act();
  openSheet(T('kcPickRgA'), (b, sh) => {
    b.appendChild(h('div', { class: 'kc-ranges wrap' }, ...RANGES.map((r) => btn('kc-rg' + (S.range === r[0] && c.tf === r[1] ? ' on' : ''), r[0], () => { closeSheet(sh); goRange(r); }))));
    b.appendChild(h('div', { class: 'kc-note', text: T('kcPickRgNote') }));
  });
}

/* ---------- טלפון: סרגל תחתון לפי ת־גרף ----------
   ציור · אינדיקטורים · עוד · בטל.
   בזמן ציור הסרגל מתחלף לכלי הציור: הכלי, מגנט, ציור רציף, נעילה, הסתרה, אובייקטים, סיום. */
function renderMbar() {
  if (!UI.mbar) return;
  UI.mbar.textContent = '';
  const c = act();
  if (!c) return;
  const ib = (icon, label, on, active) => btn('kc-mb' + (active ? ' on' : ''), label, on, ICON[icon]);
  if (S.tool) {
    const ti = TOOL_INFO[S.tool];
    UI.mbar.classList.add('draw');
    UI.mbar.append(
      ib(ti ? ti.icon : 'pencil', T('kcTools'), openToolsSheet, true),
      ib('magnet', T('kcMagnet'), () => { S.magnet = (S.magnet + 1) % 3; if (E.flash) E.flash(T('kcMagnet' + S.magnet)); renderSide(); renderMbar(); }, !!S.magnet),
      ib('pencil', T('kcStay'), () => { S.store.g.stay = !S.store.g.stay; save(); renderMbar(); }, !!S.store.g.stay),
      ib(S.allLocked ? 'lock' : 'unlock', T('kcLockAll'), () => { lockAll(); renderMbar(); }, S.allLocked),
      ib(S.allHidden ? 'eyeoff' : 'eye', T('kcHideAll'), () => { hideAll(); renderMbar(); }, S.allHidden),
      ib('list', T('kcObjects'), openObjects),
      ib('close', T('kcCancel'), stopTool));
    return;
  }
  UI.mbar.classList.remove('draw');
  // רשימת המניות וההגדרות ירדו מהכותרת לכאן (בקשת המשתמש 28/10) — הכותרת נשארת נקייה: מחיר, לוגו, סימבול
  // בלי הסימבול (בקשת המשתמש 28/10) — הוא בכותרת, והקשה עליו פותחת חיפוש. הכפתורים מתפזרים על כל הרוחב
  UI.mbar.append(
    ib('watch', T('kcWatch'), toggleWatch, S.watch),
    ib('pencil', T('kcTools'), openToolsSheet),
    ib('fx', T('kcIndicators'), openIndSheet),
    ib('more', T('kcMore'), openMore),
    ib('gear', T('kcSettings'), openSettings),
    ib('undo', T('kcUndo'), undo));
  const u = UI.mbar.lastChild;
  u.disabled = !c.undo.length;
}
/* שם מלא לטווח בגלגלת ("15 דקות", "1 hour") — Intl, בלי מחרוזות חדשות */
function tfLong(tf) {
  const m = /^(\d+)(m|h|D|W|M)$/.exec(tf);
  if (!m) return tf;
  try { return new Intl.NumberFormat(E.lang === 'en' ? 'en-US' : 'he-IL', { style: 'unit', unit: { m: 'minute', h: 'hour', D: 'day', W: 'week', M: 'month' }[m[2]], unitDisplay: 'long' }).format(+m[1]); } catch (e) { return tf; }
}
/* גלגלת בחירה לפי ת־גרף: גרירה על הכפתור גוללת ברצף (מעגלית), חלון כהה באמצע הגרף עם השמות המלאים,
   והתווית בכפתור מתגלגלת עם האצבע. רטט קטן בכל מעבר פריט; שחרור = בחירת הפריט הקרוב */
const WH_ROW = 26, WH_BTN = 20;
/* מיקום דרך CSSOM (לא מאפיין style — מדיניות CSP) */
const whPos = (e, y, o) => { e.style.transform = 'translateY(' + y.toFixed(1) + 'px)'; e.style.opacity = Math.max(0, o).toFixed(2); return e; };
function wheel(b, items, pick, tx = b) {   // tx = האלמנט שהתווית בו מתגלגלת (ברירת מחדל: הכפתור כולו)
  let st = null;
  b.style.touchAction = 'none';
  const at = (i) => st.items[((i % st.n) + st.n) % st.n];
  const ok = (i) => st.loop || (i >= 0 && i < st.n);
  const draw = () => {
    const base = Math.floor(st.pos), fr = st.pos - base;
    st.list.textContent = '';
    for (let k = -4; k <= 5; k++) {
      const i = base + k, d = Math.abs(k - fr);
      if (!ok(i) || d > 3.6) continue;
      const it = at(i);
      st.list.appendChild(whPos(h('div', { class: 'kc-wh-i' + (d < 0.5 ? ' cur' : ''), text: it.l || it.t }), (k - fr) * WH_ROW, 1 - d * 0.3));
    }
    st.roll.textContent = '';
    for (let k = 0; k <= 1; k++) {
      const i = base + k;
      if (!ok(i)) continue;
      st.roll.appendChild(whPos(h('span', { class: 'kc-roll-i', text: at(i).t }), (k - fr) * WH_BTN, 1 - Math.abs(k - fr) * 1.4));
    }
  };
  b.addEventListener('pointerdown', (e) => { st = { y: e.clientY, on: false }; });
  b.addEventListener('pointermove', (e) => {
    if (!st) return;
    const dy = e.clientY - st.y;
    if (!st.on) {
      if (Math.abs(dy) < 6) return;
      st.items = items();
      st.n = st.items.length;
      if (st.n < 2) { st = null; return; }
      st.on = true; st.loop = st.n > 2; st.y = e.clientY;
      st.i0 = st.idx = Math.max(0, st.items.findIndex((x) => x.cur)); st.pos = st.i0;
      try { b.setPointerCapture(e.pointerId); } catch (x) { /* בלי לכידה */ }
      st.el = h('div', { class: 'kc-wheel', 'aria-hidden': 'true' }, st.list = h('div', { class: 'kc-wh-l' }));
      ROOT.appendChild(st.el);
      st.txt = tx.textContent;
      tx.textContent = '';
      tx.appendChild(st.roll = h('span', { class: 'kc-roll' }));
      requestAnimationFrame(() => { if (st && st.el) st.el.classList.add('on'); });
      draw();
      return;
    }
    e.preventDefault();
    let p = st.i0 - (e.clientY - st.y) / WH_ROW;
    if (!st.loop) p = Math.max(0, Math.min(st.n - 1, p));
    st.pos = p;
    const idx = Math.round(p);
    if (idx !== st.idx) { st.idx = idx; try { if (navigator.vibrate) navigator.vibrate(3); } catch (x) { /* בלי רטט */ } }
    if (!st.raf) st.raf = requestAnimationFrame(() => { if (st) { st.raf = 0; draw(); } });
  });
  const end = () => {
    if (!st) return;
    const s0 = st;
    st = null;
    if (!s0.on) return;
    cancelAnimationFrame(s0.raf);
    const el = s0.el;
    el.classList.remove('on');
    setTimeout(() => el.remove(), 180);
    tx.textContent = s0.txt;
    b.dataset.drag = '1';
    setTimeout(() => { delete b.dataset.drag; }, 60);
    const it = s0.items[((s0.idx % s0.n) + s0.n) % s0.n];
    if (!it.cur) { tx.textContent = it.t; pick(it); }
  };
  b.addEventListener('pointerup', end);
  b.addEventListener('pointercancel', end);
  b.addEventListener('click', (e) => { if (b.dataset.drag) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);
}
/* "עוד" בטלפון: כל מה שבסרגל העליון ובתחתון של המחשב */
function openMore() {
  const c = act();
  if (!c) return;
  openSheet(T('kcMore'), (b, sh) => {
    const ty = TYPES.find((x) => x[0] === c.type) || TYPES[0];
    const cell = (icon, key, fn, on) => h('button', { type: 'button', class: 'kc-tcell' + (on ? ' on' : ''), onclick: () => { closeSheet(sh); fn(); } }, h('span', { class: 'kc-ico', html: ICON[icon] }), h('span', { text: T(key) }));
    b.append(h('div', { class: 'kc-tgrid' },
      cell(ty[2], 'kcType', openTypeSheet), cell('plus', 'kcCompare', openCompare, hasInd(c, 'KCCMP')),
      cell('auto', 'kcAuto', openAutoSheet, Object.keys(AUTO).some((k) => hasInd(c, k))), cell('bell', 'kcAlerts', openAlerts, (S.store.alerts[c.sym] || []).some((a) => !a.done)),
      cell('replay', 'kcReplay', startPick, !!c.replay), cell('layout', 'kcLayout', openLayoutSheet, S.cells.length > 1),
      cell('season', 'kcSeason', openSeason), cell('test', 'kcBacktest', openBacktest, hasInd(c, 'KCBT')),
      cell('list', 'kcObjects', openObjects), cell('cam', 'kcShot', shot), cell('redo', 'kcRedo', redo)));
    b.appendChild(h('div', { class: 'kc-gt', text: T('kcRangesT') }));
    b.appendChild(h('div', { class: 'kc-ranges wrap' }, ...RANGES.map((r) => btn('kc-rg' + (S.range === r[0] && c.tf === r[1] ? ' on' : ''), r[0], () => { closeSheet(sh); goRange(r); }))));
    const sc = S.store.g.scale;
    b.appendChild(row(seg([['normal', T('kcScaleN')], ['percentage', '%'], ['logarithm', 'log']], sc, (v) => { S.store.g.scale = v; for (const x of S.cells) if (x.chart) setScale(x, v); save(); renderFoot(); })));
  });
}
/* "+" ליד הצלב בציר המחיר */
function plusAt(c, x) {
  if (!c.plusB || !c.chart) return;
  clearTimeout(c.plusT);
  const show = x && x.paneId === MAIN && typeof x.y === 'number' && !S.tool && !c.replay;
  if (!show) { c.plusT = setTimeout(() => { if (!c.plusB.matches(':hover')) c.plusB.classList.remove('on'); }, 250); return; }
  let v = null;
  try { const p = c.chart.convertFromPixel([{ y: x.y }], { paneId: MAIN })[0]; v = p && p.value; } catch (e) { v = null; }
  if (!(v > 0)) return;
  const ax = (c.chart.getSize(MAIN, 'yAxis') || {}).width || 56;
  c.plusV = v;
  c.plusB.style.top = x.y + 'px';
  c.plusB.style.right = ax + 4 + 'px';
  c.plusB.classList.add('on');
}
function openPlus(c) {
  const p = c.plusV;
  if (!(p > 0)) return;
  const ps = fmtNum(p, L.precisionFor(p));
  openSheet(c.sym + ' · ' + ps, (b, sh) => {
    const it = (icon, text, fn) => h('button', { type: 'button', class: 'kc-li', onclick: () => { closeSheet(sh); fn(); } }, h('span', { class: 'kc-ico', html: ICON[icon] }), h('span', { class: 'kc-li-n', text }));
    b.append(h('div', { class: 'kc-act' },
      it('bell', T('kcAlertAt', { p: ps }), () => {
        const arr = S.store.alerts[c.sym] = S.store.alerts[c.sym] || [];
        if (arr.length >= 20) { if (E.flash) E.flash(T('kcAlertMax')); return; }
        arr.push({ id: newId(), p, dir: 'cross', note: '', done: false, at: 0, b: curPx(c.sym) || p });
        delete lastPx[c.sym];
        save(); drawAlerts(c); updBars(); bgSync(true);
        if (E.flash) E.flash(T('kcAlertAt', { p: ps }));
      }),
      it('hline', T('kcHLineAt', { p: ps }), () => {
        createDrawing(c, { name: 'horizontalStraightLine', points: [{ timestamp: lastTs(c), value: p }], styles: styleSet(DS.color, DS.width, DS.dash) });
        changed(c);
      })));
  });
}

/* סרגל כלים אנכי (במחשב). בטלפון — כפתור צף שפותח את כל הכלים */
function renderSide() {
  UI.side.textContent = '';
  S.lastIn = S.lastIn || {};
  const cur = h('button', { type: 'button', class: 'kc-sb' + (!S.tool ? ' on' : ''), title: T('kcCursor'), 'aria-label': T('kcCursor'), html: ICON.cross, onclick: stopTool });
  UI.side.appendChild(cur);
  for (const [gk, items] of TOOLS) {
    const last = S.lastIn[gk] || items[0][0];
    const on = items.some((x) => x[0] === S.tool);
    const b = h('button', { type: 'button', class: 'kc-sb' + (on ? ' on' : ''), title: T(gk), 'aria-label': T(gk), html: ICON[TOOL_INFO[on ? S.tool : last].icon] });
    b.addEventListener('click', () => openFly(b, gk, items));
    UI.side.appendChild(b);
  }
  UI.side.append(h('span', { class: 'kc-sep h' }),
    h('button', { type: 'button', class: 'kc-sb' + (S.magnet ? ' on' : ''), title: T('kcMagnet'), 'aria-label': T('kcMagnet'), html: ICON.magnet, onclick: () => { S.magnet = (S.magnet + 1) % 3; if (E.flash) E.flash(T('kcMagnet' + S.magnet)); renderSide(); } }),
    h('button', { type: 'button', class: 'kc-sb' + (S.store.g.stay ? ' on' : ''), title: T('kcStay'), 'aria-label': T('kcStay'), html: ICON.pencil, onclick: () => { S.store.g.stay = !S.store.g.stay; save(); renderSide(); } }),
    h('button', { type: 'button', class: 'kc-sb' + (S.allLocked ? ' on' : ''), title: T('kcLockAll'), 'aria-label': T('kcLockAll'), html: S.allLocked ? ICON.lock : ICON.unlock, onclick: lockAll }),
    h('button', { type: 'button', class: 'kc-sb' + (S.allHidden ? ' on' : ''), title: T('kcHideAll'), 'aria-label': T('kcHideAll'), html: S.allHidden ? ICON.eyeoff : ICON.eye, onclick: hideAll }),
    h('button', { type: 'button', class: 'kc-sb', title: T('kcClearAll'), 'aria-label': T('kcClearAll'), html: ICON.trash, onclick: clearAll }),
  );
}
function updToolUI() {
  if (!ROOT || !UI.side) return;
  renderSide();
  renderMbar();
  UI.fab.classList.toggle('on', !!S.tool);
  ROOT.classList.toggle('kc-drawing', !!S.tool);
  for (const x of S.cells) if (x.qm) for (const b of x.qm.children) b.classList.toggle('on', !!S.tool && b.dataset.t === S.tool && x.i === S.active);
  if (UI.hint) UI.hint.remove();
  UI.hint = null;
  if (S.tool && !S.cur) {   // במדידה בטלפון — בלי שורת הסבר: הסמל הכחול והצלב אומרים הכל
    UI.hint = h('div', { class: 'kc-hint' }, h('span', { text: T(TOOL_INFO[S.tool] ? TOOL_INFO[S.tool].key : 'kcDrawing') + ' · ' + T('kcDrawHint') }), btn('kc-hint-x', T('kcCancel'), stopTool, ICON.close));
    ROOT.appendChild(UI.hint);
  }
}
let FLY = null;
function closeFly() { if (FLY) { FLY.remove(); FLY = null; document.removeEventListener('pointerdown', flyOut, true); } }
function flyOut(e) { if (FLY && !FLY.contains(e.target)) closeFly(); }
function openFly(anchor, gk, items) {
  closeFly();
  const r = anchor.getBoundingClientRect(), rr = ROOT.getBoundingClientRect();
  FLY = h('div', { class: 'kc-fly', role: 'menu' }, h('div', { class: 'kc-fly-t', text: T(gk) }),
    ...items.map(([name, key, icon]) => h('button', { type: 'button', role: 'menuitem', class: 'kc-fly-i' + (S.tool === name ? ' on' : ''), onclick: () => { S.lastIn[gk] = name; closeFly(); startTool(name); } }, h('span', { class: 'kc-ico', html: ICON[icon] }), h('span', { text: T(key) }))));
  FLY.style.top = Math.max(8, Math.min(r.top - rr.top, rr.height - 40 * items.length - 60)) + 'px';
  FLY.style.insetInlineStart = (document.documentElement.dir === 'rtl' ? rr.right - r.left + 6 : r.right - rr.left + 6) + 'px';
  ROOT.appendChild(FLY);
  setTimeout(() => document.addEventListener('pointerdown', flyOut, true), 0);
}
function openToolsSheet() {
  if (S.tool) { stopTool(); return; }
  openSheet(T('kcTools'), (b, sh) => {
    for (const [gk, items] of TOOLS) {
      b.appendChild(h('div', { class: 'kc-gt', text: T(gk) }));
      b.appendChild(h('div', { class: 'kc-tgrid' }, ...items.map(([name, key, icon]) => h('button', { type: 'button', class: 'kc-tcell', onclick: () => { closeSheet(sh); startTool(name); } }, h('span', { class: 'kc-ico', html: ICON[icon] }), h('span', { text: T(key) })))));
    }
    b.appendChild(h('div', { class: 'kc-gt', text: T('kcOptions') }));
    b.append(
      row(seg([[0, T('kcMagnet0')], [1, T('kcMagnet1')], [2, T('kcMagnet2')]], S.magnet, (v) => { S.magnet = v; renderSide(); })),
      toggle(T('kcStay'), !!S.store.g.stay, (v) => { S.store.g.stay = v; save(); }),
      h('div', { class: 'kc-row' }, btn('kc-btn', T('kcLockAll'), () => { lockAll(); closeSheet(sh); }), btn('kc-btn', T('kcHideAll'), () => { hideAll(); closeSheet(sh); }), btn('kc-btn danger', T('kcClearAll'), () => { closeSheet(sh); clearAll(); })),
    );
  });
}
function lockAll() {
  S.allLocked = !S.allLocked;
  for (const c of S.cells) if (c.chart) { c.chart.overrideOverlay({ groupId: 'user', lock: S.allLocked }); changed(c); }
  renderSide();
}
function hideAll() {
  S.allHidden = !S.allHidden;
  for (const c of S.cells) if (c.chart) { c.chart.overrideOverlay({ groupId: 'user', visible: !S.allHidden }); changed(c); }
  renderSide();
}
async function clearAll() {
  const c = act();
  if (!c || !c.chart || !c.chart.getOverlays({ groupId: 'user' }).length) return;
  const ok = E.askConfirm ? await E.askConfirm(T('kcClearAllQ', { s: c.sym })) : true;
  if (!ok || !ROOT) return;
  c.chart.removeOverlay({ groupId: 'user' }); deselect(); changed(c);
}

/* סרגל תחתון: טווחים (1D…ALL), שעון וספירה לאחור, סולם (%/לוג), זום */
function renderFoot() {
  if (!UI.foot) return;
  const c = act();
  UI.foot.textContent = '';
  const rs = h('div', { class: 'kc-ranges' });
  for (const r of RANGES) rs.appendChild(btn('kc-rg' + (S.range === r[0] && c && c.tf === r[1] ? ' on' : ''), r[0], () => goRange(r)));
  UI.clock = h('span', { class: 'kc-clock' });
  const sc = S.store.g.scale;
  const setSc = (v) => { S.store.g.scale = S.store.g.scale === v ? 'normal' : v; for (const x of S.cells) if (x.chart) setScale(x, S.store.g.scale); save(); renderFoot(); };
  UI.foot.append(rs, UI.clock, h('div', { class: 'kc-scales' },
    btn('kc-ib sm', T('kcZoomOut'), () => zoom(0.8), ICON.zoomout), btn('kc-ib sm', T('kcZoomIn'), () => zoom(1.25), ICON.zoomin),
    btn('kc-ib sm', T('kcFit'), () => { const x = act(); if (x && x.chart) fitView(x); }, ICON.fit),
    btn('kc-sc' + (sc === 'percentage' ? ' on' : ''), '%', () => setSc('percentage')),
    btn('kc-sc' + (sc === 'logarithm' ? ' on' : ''), 'log', () => setSc('logarithm'))));
  updClock();
}
function mainYAxes(c) { try { const p = c.chart.getDrawPaneById(MAIN); return (p && p.getYAxisComponents && p.getYAxisComponents()) || []; } catch (e) { return []; } }
// "התאם" מחזיר גם את ציר המחיר לאוטומטי (אחרי גרירה אנכית)
function fitView(c) { c.chart.setBarSpace(8); c.chart.scrollToRealTime(); const ys = mainYAxes(c).filter((a) => !a.getAutoCalcTickFlag()); if (ys.length) { ys.forEach((a) => a.setAutoCalcTickFlag(true)); try { c.chart.layout({ measureWidth: true, update: true, buildYAxisTick: true }); } catch (e) { /* גרסה אחרת */ } } }
function zoom(k) { const c = act(); if (!c || !c.chart) return; const sz = c.chart.getSize(MAIN, 'main'); c.chart.zoomAtCoordinate(k, sz ? { x: sz.width - 40, y: sz.height / 2 } : undefined, 150); }
function updLegendTime() { /* המקרא של הנר (פ/ג/נ/ס) — מצויר בגרף עצמו */ }

/* מצב התא: טעינה / שגיאה + "נסה שוב" */
function renderStatus(c) {
  if (!c || !c.stEl) return;
  c.stEl.textContent = '';
  if (c.err) {
    const key = c.err === 'not_found' ? 'kcErrNotFound' : c.err === 'empty' ? 'kcErrEmpty' : c.err === 'rate_limited' ? 'kcErrRate' : 'kcErrLoad';
    c.stEl.append(h('div', { class: 'kc-st-msg', text: T(key) }), btn('kc-btn', T('kcRetry'), () => { c.err = null; renderStatus(c); if (c.chart) setSymbolPeriod(c); }));
    c.stEl.className = 'kc-st on';
  } else if (c.loading && !c.raw.length) {
    c.stEl.append(h('div', { class: 'kc-spin' }), h('div', { class: 'kc-st-msg', text: T('kcLoading') }));
    c.stEl.className = 'kc-st on';
  } else c.stEl.className = 'kc-st';
}

/* סרגל עריכה לשרטוט שנבחר (כמו הסרגל הצף של TradingView) */
function renderSel() {
  if (!UI.sel) return;
  UI.sel.textContent = '';
  const s = S.sel, o = s && getOv(s.c, s.id);
  UI.sel.classList.toggle('on', !!o);
  if (!o) UI.sel.classList.remove('pal');
  if (!o) return;
  if (s.alert) {
    const a = s.alert;
    UI.sel.append(h('span', { class: 'kc-sel-n al', text: '🔔 ' + fmtNum(a.p, L.precisionFor(a.p)) + (a.note ? ' · ' + a.note : '') }),
      ...(a.done ? [btn('kc-ib sm', T('kcRearm'), () => { rearm(s.c.sym, a); save(); bgSoon(); drawAlerts(s.c); deselect(); }, ICON.bell)] : []),
      btn('kc-ib sm', T('kcAlerts'), () => { deselect(); openAlerts(); }, ICON.gear),
      btn('kc-ib sm danger', T('kcDelete'), selDelete, ICON.trash),
      btn('kc-ib sm', T('kcClose'), deselect, ICON.close));
    return;
  }
  const ln = (o.styles && o.styles.line) || {}, color = ln.color || DS.color, size = ln.size || 1, dash = ln.style === 'dashed';
  const cols = h('div', { class: 'kc-cols' }, ...DRAW_COLORS.map((cl) => {
    const b = h('button', { type: 'button', class: 'kc-col' + (cl.toLowerCase() === String(color).toLowerCase() ? ' on' : ''), 'aria-label': cl, onclick: () => selStyle({ color: cl }) });
    b.style.background = cl;
    return b;
  }));
  const wid = h('div', { class: 'kc-wids' }, ...[1, 2, 3, 4].map((w) => btn('kc-wid' + (w === size ? ' on' : ''), w + 'px', () => selStyle({ width: w }))));
  // בטלפון (כמו הסרגל הצף של TradingView): עיגול צבע שפותח את הפלטה, ו־"2px" שמחליף עובי בכל הקשה
  const sw = h('button', { type: 'button', class: 'kc-swatch', 'aria-label': T('kcColor'), onclick: () => UI.sel.classList.toggle('pal') });
  sw.style.background = color;
  UI.sel.append(
    h('span', { class: 'kc-sel-n', text: T(TOOL_INFO[o.name] ? TOOL_INFO[o.name].key : 'kcDrawing') }), sw, cols, wid,
    btn('kc-wid kc-wcyc on', size + 'px', () => selStyle({ width: size % 4 + 1 })),
    btn('kc-ib sm kc-dash' + (dash ? ' on' : ''), T('kcDashed'), () => selStyle({ dash: !dash }), '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h4M10 12h4M17 12h4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>'),
    ...(TEXT_TOOLS.has(o.name) ? [btn('kc-ib sm', T('kcEditText'), () => askText(s.c, s.id), ICON.text)] : []),   // append(null) כותב "null" (נראה בטלפון)
    btn('kc-ib sm' + (o.lock ? ' on' : ''), o.lock ? T('kcUnlock') : T('kcLock'), selLock, o.lock ? ICON.lock : ICON.unlock),
    btn('kc-ib sm', T('kcClone'), selClone, ICON.copy),
    btn('kc-ib sm danger', T('kcDelete'), selDelete, ICON.trash),
    h('span', { class: 'kc-sel-div', 'aria-hidden': 'true' }),
    btn('kc-ib sm', T('kcClose'), deselect, ICON.close),
  );
}

/* סרגל ה־Replay */
function renderReplay() {
  if (!UI.rep) return;
  const c = act();
  UI.rep.textContent = '';
  if (S.pick) {
    UI.rep.append(h('span', { text: T('kcReplayPick') }), btn('kc-btn', T('kcReplayRecent'), () => beginReplay(S.pick, -1)), btn('kc-ib sm', T('kcCancel'), () => { S.pick = null; renderReplay(); updBars(); }, ICON.close));
    UI.rep.className = 'kc-repbar on';
    return;
  }
  if (!c || !c.replay) { UI.rep.className = 'kc-repbar'; return; }
  const r = c.replay, cur = c.disp[c.disp.length - 1];
  UI.rep.append(
    btn('kc-ib', r.timer ? T('kcPause') : T('kcPlay'), () => (r.timer ? replayPause(c) : replayPlay(c)), r.timer ? ICON.pause : ICON.play),
    btn('kc-ib', T('kcStep'), () => replayStep(c), ICON.step),
    btn('kc-btn', r.speed + '×', () => replaySpeed(c)),
    h('span', { class: 'kc-rep-t', text: cur ? new Date(cur.timestamp).toLocaleString(E.lang === 'en' ? 'en-US' : 'he-IL', { timeZone: S.store.g.tz === 'local' ? undefined : c.tz, dateStyle: 'medium', timeStyle: L.isIntraday(c.tf) ? 'short' : undefined }) : '' }),
    h('span', { class: 'kc-rep-n', text: (r.full - r.end) + ' ' + T('kcBarsLeft') }),
    btn('kc-btn', T('kcReplayExit'), () => exitReplay(c), null),
  );
  UI.rep.className = 'kc-repbar on';
}

/* ---------- גיליונות התוכן ---------- */
function openTfSheet() {
  const c = act();
  openSheet(T('kcTimeframe'), (b, sh) => {
    const groups = [['kcTfMin', ['1m', '2m', '3m', '5m', '10m', '15m', '30m', '45m']], ['kcTfHour', ['1h', '2h', '3h', '4h']], ['kcTfDay', ['1D', '1W', '1M', '3M', '6M', '12M']]];
    for (const [gk, list] of groups) {
      b.appendChild(h('div', { class: 'kc-gt', text: T(gk) }));
      b.appendChild(h('div', { class: 'kc-tfgrid' }, ...list.map((tf) => {
        const fav = S.store.g.fav.includes(tf);
        const star = h('button', { type: 'button', class: 'kc-star' + (fav ? ' on' : ''), 'aria-label': T('kcFav'), html: ICON.star });
        star.addEventListener('click', (e) => {
          e.stopPropagation();
          const f = S.store.g.fav, i = f.indexOf(tf);
          if (i >= 0) f.splice(i, 1); else { f.push(tf); f.sort((x, y) => L.TF_ORDER.indexOf(x) - L.TF_ORDER.indexOf(y)); }
          star.classList.toggle('on', i < 0); save(); updBars();
        });
        return h('div', { class: 'kc-tfcell' + (c.tf === tf ? ' on' : '') }, btn('kc-tfpick', tfLabel(tf), () => { closeSheet(sh); setTf(c, tf); }), star);
      })));
    }
    b.appendChild(h('div', { class: 'kc-note', text: T('kcTfNote') }));
  });
}
function openTypeSheet() {
  const c = act();
  openSheet(T('kcType'), (b, sh) => {
    b.appendChild(h('div', { class: 'kc-list' }, ...TYPES.map(([id, key, icon]) => h('button', { type: 'button', class: 'kc-li' + (c.type === id ? ' on' : ''), onclick: () => { closeSheet(sh); setType(c, id); } }, h('span', { class: 'kc-ico', html: ICON[icon] }), h('span', { text: T(key) })))));
  });
}

/* אינדיקטורים: חיפוש, מועדפים, קטגוריות, הפעילים בגרף (הסתרה / פרמטרים / הסרה) */
const IGROUPS = [['all', 'kcIgAll'], ['fav', 'kcIgFav'], ['trend', 'kcIgTrend'], ['osc', 'kcIgOsc'], ['vol', 'kcIgVol'], ['volume', 'kcIgVolume']];
function indCatalog() {
  const out = [];
  for (const k of Object.keys(BUILTIN)) out.push({ n: k, g: BUILTIN[k].g });
  for (const k of Object.keys(L.IND)) out.push({ n: k, g: L.IND[k].g });
  return out;
}
const indName = (n) => { const s = T('kcI_' + n); return s === 'kcI_' + n ? n : s; };
function openIndSheet() {
  const c = act();
  if (!c || !c.chart) return;
  openSheet(T('kcIndicators'), (b) => {
    const q = h('input', { class: 'kc-in', type: 'search', placeholder: T('kcIndSearch'), 'aria-label': T('kcIndSearch'), autocomplete: 'off' });
    let grp = 'all';
    const tabs = seg(IGROUPS.map(([v, k]) => [v, T(k)]), grp, (v) => { grp = v; draw(); });
    const activeBox = h('div', { class: 'kc-act' }), list = h('div', { class: 'kc-list' });
    b.append(q, tabs, activeBox, list);
    const cat = indCatalog();
    function drawActive() {
      activeBox.textContent = '';
      const inds = c.chart.getIndicators().filter((i) => !AUTO[i.name] && i.name !== 'KCBT');
      if (!inds.length) return;
      activeBox.appendChild(h('div', { class: 'kc-gt', text: T('kcIndActive') }));
      for (const i of inds) {
        const vis = i.visible !== false;
        activeBox.appendChild(h('div', { class: 'kc-li static' },
          h('span', { class: 'kc-li-n', text: i.name === 'KCCMP' ? T('kcCompare') + ' ' + ((i.extendData && i.extendData.sym) || '') : indName(i.name) + ((i.calcParams || []).length ? ' (' + i.calcParams.join(', ') + ')' : '') }),
          btn('kc-ib sm', vis ? T('kcHide') : T('kcShow'), () => { c.chart.overrideIndicator({ id: i.id, visible: !vis }); save(); drawActive(); }, vis ? ICON.eye : ICON.eyeoff),
          i.name !== 'KCCMP' && (i.calcParams || []).length ? btn('kc-ib sm', T('kcParams'), () => openParams(c, i, drawActive), ICON.gear) : null,
          btn('kc-ib sm danger', T('kcRemove'), () => { removeInd(c, i.id); drawActive(); draw(); updBars(); }, ICON.trash)));
      }
    }
    function draw() {
      list.textContent = '';
      const s = q.value.trim().toLowerCase(), fav = S.store.g.indFav;
      const items = cat.filter((x) => (grp === 'all' || (grp === 'fav' ? fav.includes(x.n) : x.g === grp)) && (!s || x.n.toLowerCase().includes(s) || indName(x.n).toLowerCase().includes(s)));
      for (const x of items) {
        const on = hasInd(c, x.n), isF = fav.includes(x.n);
        const star = h('button', { type: 'button', class: 'kc-star' + (isF ? ' on' : ''), 'aria-label': T('kcFav'), html: ICON.star });
        star.addEventListener('click', (e) => { e.stopPropagation(); const i = fav.indexOf(x.n); if (i >= 0) fav.splice(i, 1); else fav.push(x.n); save(); draw(); });
        list.appendChild(h('div', { class: 'kc-li' + (on ? ' on' : ''), role: 'button', tabindex: '0', onclick: () => { addInd(c, x.n); drawActive(); draw(); updBars(); } },
          h('span', { class: 'kc-li-n' }, h('b', { text: x.n === 'KCVOL' ? 'VOL' : x.n }), indName(x.n) !== x.n ? h('span', { class: 'kc-li-s', text: indName(x.n) }) : null), star));
      }
      if (!items.length) list.appendChild(h('div', { class: 'kc-note', text: T('kcNoResults') }));
    }
    q.addEventListener('input', draw);
    drawActive(); draw();
  }, { wide: true });
}
function openParams(c, ind, done) {
  const def = L.IND[ind.name], names = def ? def.p.map((x) => x[0]) : null;
  openSheet(indName(ind.name), (b, sh) => {
    const ins = (ind.calcParams || []).map((v, i) => {
      const inp = h('input', { class: 'kc-in num', type: 'number', step: 'any', inputmode: 'decimal', value: String(v) });
      b.appendChild(h('label', { class: 'kc-field' }, h('span', { text: names && names[i] ? names[i] : '#' + (i + 1) }), inp));
      return inp;
    });
    b.appendChild(h('div', { class: 'kc-row-end' },
      btn('kc-btn', T('kcDefaults'), () => { const d = def ? def.p.map((x) => x[1]) : null; if (d) ins.forEach((x, i) => { x.value = String(d[i]); }); }),
      btn('kc-btn pri', T('kcSave'), () => {
        const p = ins.map((x, i) => { const v = parseFloat(x.value); return isFinite(v) && v > 0 && v < 5000 ? v : ind.calcParams[i]; });
        c.chart.overrideIndicator({ id: ind.id, calcParams: p });
        save(); closeSheet(sh); if (done) done();
      })));
  });
}

/* השוואת מניות (אחוזים מאותה נקודה) + חוזק יחסי */
function openCompare() {
  const c = act();
  if (!c || !c.chart) return;
  openSheet(T('kcCompare'), (b, sh) => {
    const cur = h('div', { class: 'kc-act' });
    function drawCur() {
      cur.textContent = '';
      for (const i of c.chart.getIndicators({ name: 'KCCMP' })) {
        const s = (i.extendData && i.extendData.sym) || '';
        cur.appendChild(h('div', { class: 'kc-li static' }, h('span', { class: 'kc-li-n', text: s }), btn('kc-ib sm danger', T('kcRemove'), () => { removeInd(c, i.id); drawCur(); updBars(); }, ICON.trash)));
      }
    }
    const add = (sym) => {
      sym = String(sym || '').toUpperCase();
      if (!sym || sym === c.sym || c.chart.getIndicators({ name: 'KCCMP' }).some((i) => i.extendData && i.extendData.sym === sym)) return;
      addInd(c, 'KCCMP', { sym });
      setScale(c, 'percentage');
      drawCur(); updBars();
    };
    const quick = /\.TA$/.test(c.sym) ? ['^TA125.TA', '^TA35.TA'] : ['SPY', 'QQQ', 'DIA', 'IWM'];
    b.append(searchBox((it) => add(it.sym)), h('div', { class: 'kc-chips' }, ...quick.map((s) => btn('kc-chip', s, () => add(s)))), cur,
      h('div', { class: 'kc-row-end' }, btn('kc-btn', T('kcAddRS'), () => { if (!hasInd(c, 'RS')) addInd(c, 'RS'); closeSheet(sh); updBars(); })));
    drawCur();
  });
}
function searchBox(onPick) {
  const inp = h('input', { class: 'kc-in', type: 'search', placeholder: T('kcSymSearch'), 'aria-label': T('kcSymSearch'), autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false' });
  const res = h('div', { class: 'kc-list' });
  let seq = 0, tmr = null;
  const show = (items) => {
    res.textContent = '';
    for (const it of items || []) res.appendChild(h('button', { type: 'button', class: 'kc-li', onclick: () => onPick(it) }, h('span', { class: 'kc-li-n' }, h('b', { text: it.sym, dir: 'ltr' }), it.name ? h('span', { class: 'kc-li-s', text: it.name, dir: 'auto' }) : null)));
  };
  const recent = () => show((S.store.g.recent || []).map((s) => ({ sym: s, name: E.name ? E.name(s) : '' })));
  inp.addEventListener('input', () => {
    clearTimeout(tmr);
    const q = inp.value.trim();
    if (!q) { recent(); return; }
    const my = ++seq;
    tmr = setTimeout(async () => {
      if (!E.search) return;
      try { const r = await E.search(q, (x) => { if (my === seq) show(x); }); if (my === seq && r && r.length) show(r); } catch (e) { /* בלי תוצאות */ }
    }, 220);
  });
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' && inp.value.trim()) { const first = res.querySelector('button'); if (first) first.click(); else onPick({ sym: inp.value.trim() }); } });
  recent();
  setTimeout(() => inp.focus(), 60);
  return h('div', { class: 'kc-search' }, inp, res);
}
function openSearch(pre) {
  const c = act();
  if (!c) return;
  openSheet(T('kcSymSearch'), (b, sh) => {
    const box = searchBox((it) => { closeSheet(sh); setSym(c, it.sym); });
    b.appendChild(box);
    if (typeof pre === 'string' && pre) { const inp = box.querySelector('input'); inp.value = pre; inp.dispatchEvent(new Event('input')); }
  });
}

/* ניתוח אוטומטי (מה שאין ב־TradingView בלי סקריפטים בתשלום) */
function openAutoSheet() {
  const c = act();
  if (!c || !c.chart) return;
  openSheet(T('kcAuto'), (b) => {
    for (const k of Object.keys(AUTO_DEF)) b.appendChild(toggle(T('kcAutoN_' + k), hasInd(c, k), () => { toggleInd(c, k); updBars(); }));
    b.appendChild(h('div', { class: 'kc-note', text: T('kcAutoNote') }));
  });
}
function openLayoutSheet() {
  openSheet(T('kcLayout'), (b, sh) => {
    const pics = { 1: '<rect x="3" y="4" width="18" height="16" rx="2"/>', 2: '<rect x="3" y="4" width="8" height="16" rx="2"/><rect x="13" y="4" width="8" height="16" rx="2"/>', 3: '<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/>', 4: '<rect x="3" y="4" width="18" height="8" rx="2"/><rect x="3" y="14" width="8" height="6" rx="2"/><rect x="13" y="14" width="8" height="6" rx="2"/>', 5: '<rect x="3" y="4" width="8" height="7" rx="2"/><rect x="13" y="4" width="8" height="7" rx="2"/><rect x="3" y="13" width="8" height="7" rx="2"/><rect x="13" y="13" width="8" height="7" rx="2"/>' };
    b.appendChild(h('div', { class: 'kc-tgrid' }, ...[1, 2, 3, 4, 5].map((l) => h('button', { type: 'button', class: 'kc-tcell' + (S.layout === l ? ' on' : ''), 'aria-label': T('kcLayoutN', { n: LAYOUTS[l] }), onclick: () => { closeSheet(sh); setLayout(l); } },
      h('span', { class: 'kc-ico', html: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6">' + pics[l] + '</svg>' }), h('span', { text: String(LAYOUTS[l]) })))));
    b.append(toggle(T('kcSyncSym'), S.store.g.syncSym, (v) => { S.store.g.syncSym = v; save(); }), toggle(T('kcSyncTf'), S.store.g.syncTf, (v) => { S.store.g.syncTf = v; save(); }));
  });
}

/* התראות מחיר — נבדקות בכל טיק (כל שנייה) כל עוד המסך פתוח */
function openAlerts() {
  const c = act();
  if (!c) return;
  openSheet(T('kcAlerts'), (b) => {
    const p0 = quotePrice(c.q) || (c.disp.length ? c.disp[c.disp.length - 1].close : 0), pr = L.precisionFor(p0);
    const price = h('input', { class: 'kc-in num', type: 'number', step: 'any', inputmode: 'decimal', value: p0 ? p0.toFixed(pr) : '' });
    const note = h('input', { class: 'kc-in', type: 'text', maxlength: '80', placeholder: T('kcAlertNote') });
    let dir = 'cross';
    const list = h('div', { class: 'kc-act' });
    function drawList() {
      list.textContent = '';
      const syms = Object.keys(S.store.alerts).filter((s) => (S.store.alerts[s] || []).length);
      for (const s of syms) for (const a of S.store.alerts[s]) {
        list.appendChild(h('div', { class: 'kc-li static' + (a.done ? ' done' : '') },
          h('span', { class: 'kc-li-n' }, h('b', { text: s, dir: 'ltr' }), h('span', { class: 'kc-li-s', text: T(a.dir === 'up' ? 'kcAlertUp' : a.dir === 'down' ? 'kcAlertDown' : 'kcAlertCross') + ' ' + fmtNum(a.p, L.precisionFor(a.p)) + (a.done ? ' · ' + T('kcAlertDone') : '') + (a.note ? ' · ' + a.note : '') })),
          a.done ? btn('kc-ib sm', T('kcRearm'), () => { rearm(s, a); save(); bgSoon(); redraw(s); drawList(); }, ICON.bell) : null,
          btn('kc-ib sm danger', T('kcRemove'), () => { S.store.alerts[s] = S.store.alerts[s].filter((x) => x !== a); if (!S.store.alerts[s].length) delete S.store.alerts[s]; save(); bgSoon(); redraw(s); drawList(); updBars(); }, ICON.trash)));
      }
      if (!list.children.length) list.appendChild(h('div', { class: 'kc-note', text: T('kcNoAlerts') }));
    }
    const redraw = (s) => { for (const x of S.cells) if (x.sym === s) drawAlerts(x); };
    // מצב ההתראות ברקע: שורה אחת — פעיל / הפעלה / למה לא
    const bgRow = h('div', { class: 'kc-bg' });
    function bgShow() {
      bgRow.textContent = '';
      const on = BG.st === 'on', key = on ? 'kcBgOn' : { auth: 'kcBgAuth', deny: 'kcBgDeny', no: 'kcBgNo' }[BG.st] || 'kcBgOff';
      bgRow.classList.toggle('on', on);
      bgRow.append(h('span', { class: 'kc-bg-t', text: T(key) + (on ? '' : ' · ' + T('kcAlertNoteOpen')) }));
      if (!on && !['auth', 'deny', 'no'].includes(BG.st)) bgRow.appendChild(btn('kc-btn sm', T('kcBgEnable'), () => bgSync(true), ICON.bell));
    }
    BG.onSt = bgShow;
    b.append(
      h('label', { class: 'kc-field' }, h('span', { text: c.sym }), price),
      seg([['cross', T('kcAlertCross')], ['up', T('kcAlertUp')], ['down', T('kcAlertDown')]], dir, (v) => { dir = v; }),
      note,
      h('div', { class: 'kc-row-end' }, btn('kc-btn pri', T('kcAlertAdd'), () => {
        const v = parseFloat(price.value);
        if (!(v > 0)) return;
        const arr = S.store.alerts[c.sym] = S.store.alerts[c.sym] || [];
        if (arr.length >= 20) { if (E.flash) E.flash(T('kcAlertMax')); return; }
        arr.push({ id: newId(), p: v, dir, note: note.value.trim().slice(0, 80), done: false, at: 0, b: curPx(c.sym) || p0 });
        delete lastPx[c.sym];
        save(); redraw(c.sym); drawList(); updBars(); note.value = '';
        bgSync(true);   // בלחיצה (מחווה של המשתמש) — הדפדפן מרשה לבקש הרשאת התראות
      })),
      bgRow,
      list,
    );
    drawList();
    bgShow();
    bgSync(true);   // ברירת מחדל: פתיחת החלון (נגיעה) = בקשת הרשאה אם עוד לא נשאלה, ורישום לרקע
  });
}

/* ---------- התראות מכרטיס המניה (app.js) — בלי לפתוח את הגרף. אותו מאגר (pwa_charts_v1) ואותו סנכרון לרקע ---------- */
function alStore(env) { if (!ROOT) { if (env) E = env; S.store = loadStore(); } return S.store; }
export function stockAlerts(sym, env) { const st = alStore(env); return (st.alerts[String(sym).toUpperCase()] || []).map((a) => Object.assign({}, a)); }
/* עריכה (id) או התראה חדשה (בלי id). px = המחיר החי מהכרטיס — נקודת ההתחלה של "חוצה" */
export async function openStockAlert(sym, env, id, px) {
  sym = String(sym || '').toUpperCase();
  const st = alStore(env);
  await ensureCss();
  let root = ROOT, fl = null;
  if (!root) { fl = h('div', { class: 'kc-root kc-float' }); document.body.appendChild(fl); root = fl; }
  const list = () => st.alerts[sym] || [];
  const a0 = id ? list().find((x) => x.id === id) : null;
  const cur = px > 0 ? px : curPx(sym), p0 = a0 ? a0.p : cur, pr = L.precisionFor(p0 || 1);
  const done = () => {
    for (const c of S.cells) if (c.sym === sym) drawAlerts(c);
    if (ROOT && ROOT !== fl) { save(); updBars(); } else saveNow();
    if (E.onAlerts) E.onAlerts(sym);
  };
  openSheet(T('kcAlerts') + ' · ' + sym, (b, sh) => {
    const price = h('input', { class: 'kc-in num', type: 'number', step: 'any', inputmode: 'decimal', value: p0 > 0 ? p0.toFixed(pr) : '' });
    const note = h('input', { class: 'kc-in', type: 'text', maxlength: '80', placeholder: T('kcAlertNote'), value: a0 ? a0.note || '' : '' });
    let dir = a0 ? a0.dir : 'cross';
    const close = () => closeSheet(sh);
    b.append(
      h('label', { class: 'kc-field' }, h('span', { text: sym }), price),
      seg([['cross', T('kcAlertCross')], ['up', T('kcAlertUp')], ['down', T('kcAlertDown')]], dir, (v) => { dir = v; }),
      note,
      h('div', { class: 'kc-row-end' },
        a0 ? btn('kc-btn danger', T('kcRemove'), () => { const arr = list().filter((x) => x.id !== a0.id); if (arr.length) st.alerts[sym] = arr; else delete st.alerts[sym]; done(); bgSoon(); close(); }) : null,
        a0 && a0.done ? btn('kc-btn', T('kcRearm'), () => { a0.done = false; a0.at = 0; a0.id = newId(); a0.b = cur || a0.p; done(); bgSync(true); close(); }) : null,
        btn('kc-btn pri', a0 ? T('kcSave') : T('kcAlertAdd'), () => {
          const v = parseFloat(price.value);
          if (!(v > 0)) { price.focus(); return; }
          const n = note.value.trim().slice(0, 80);
          if (a0) {
            // מחיר או כיוון חדשים = התראה חדשה מבחינת השרתון (מזהה חדש, נקודת התחלה עכשווית)
            if (v !== a0.p || dir !== a0.dir || a0.done) { a0.id = newId(); a0.done = false; a0.at = 0; a0.b = cur || v; }
            a0.p = v; a0.dir = dir; a0.note = n;
          } else {
            const arr = st.alerts[sym] = list();
            if (arr.length >= 20) { if (E.flash) E.flash(T('kcAlertMax')); return; }
            arr.push({ id: newId(), p: v, dir, note: n, done: false, at: 0, b: cur || v });
          }
          delete lastPx[sym];
          done();
          bgSync(true);   // בלחיצה (מחווה) — בקשת הרשאת התראות אם עוד לא נשאלה, ורישום לרקע: ההתראות פעילות כברירת מחדל
          close();
        })));
    if (!a0) setTimeout(() => { try { price.focus(); price.select(); } catch (e) { /* בלי מקלדת */ } }, 60);
  }, { root, onClose: () => { if (fl) setTimeout(() => fl.remove(), 160); } });
}

/* עונתיות: ממוצע תשואה לכל חודש + מפת חום לפי שנים (כמו Seasonals של TradingView Premium) */
function openSeason() {
  const c = act();
  if (!c) return;
  openSheet(T('kcSeason') + ' · ' + c.sym, async (b) => {
    b.appendChild(h('div', { class: 'kc-spin' }));
    let bars = [];
    try { const r = await E.api({ op: 'candles', sym: c.sym, iv: '1mo' }); if (r && r.ok) bars = L.fromColumns(r); } catch (e) { bars = []; }
    b.textContent = '';
    if (bars.length < 13) { b.appendChild(h('div', { class: 'kc-note', text: T('kcSeasonNone') })); return; }
    const s = L.seasonality(bars), mon = (i) => new Date(Date.UTC(2020, i, 1)).toLocaleString(E.lang === 'en' ? 'en-US' : 'he-IL', { month: 'short', timeZone: 'UTC' });
    const cell = (v, extra) => { const td = h('td', { class: 'kc-hm' + (extra || ''), text: v == null ? '' : (v * 100).toFixed(1) }); if (v != null) td.style.background = v >= 0 ? 'rgba(48,209,88,' + Math.min(0.85, 0.12 + Math.abs(v) * 6) + ')' : 'rgba(255,69,58,' + Math.min(0.85, 0.12 + Math.abs(v) * 6) + ')'; return td; };
    const years = Object.keys(s.years).sort().reverse().slice(0, 15);
    const tbl = h('table', { class: 'kc-tbl', dir: 'ltr' },
      h('thead', null, h('tr', null, h('th', { text: '' }), ...Array.from({ length: 12 }, (_, i) => h('th', { text: mon(i) })))),
      h('tbody', null,
        h('tr', { class: 'avg' }, h('th', { text: T('kcAvg') }), ...s.months.map((m) => cell(m.avg, ' b'))),
        h('tr', null, h('th', { text: T('kcWinRate') }), ...s.months.map((m) => h('td', { class: 'kc-hm', text: m.win == null ? '' : Math.round(m.win * 100) + '%' }))),
        ...years.map((y) => h('tr', null, h('th', { text: y }), ...s.years[y].map((v) => cell(v))))));
    b.append(h('div', { class: 'kc-scroll' }, tbl), h('div', { class: 'kc-note', text: T('kcSeasonNote') }));
  }, { wide: true });
}

/* בדיקה לאחור (Strategy Tester): חציית ממוצעים / RSI על הנרות שבגרף, סימון העסקאות על הגרף */
function openBacktest() {
  const c = act();
  if (!c || !c.chart) return;
  openSheet(T('kcBacktest'), (b, sh) => {
    let kind = 'ema';
    const f = h('input', { class: 'kc-in num', type: 'number', value: '9', min: '2', max: '400' }), s = h('input', { class: 'kc-in num', type: 'number', value: '21', min: '3', max: '400' });
    const out = h('div', { class: 'kc-bt' });
    const run = () => {
      const list = c.chart.getDataList();
      const a = Math.max(2, Math.min(400, +f.value || 9)), z = Math.max(3, Math.min(400, +s.value || 21));
      const rule = kind === 'rsi' ? { kind: 'rsi', n: 14, lo: a > 50 ? 30 : a, hi: z > 50 ? z : 70 } : { kind: 'cross', ma: kind, fast: Math.min(a, z), slow: Math.max(a, z) };
      const r = L.backtest(list, rule);
      out.textContent = '';
      const stat = (k, v, cls) => h('div', { class: 'kc-stat' }, h('span', { text: T(k) }), h('b', { class: cls || '', text: v }));
      out.append(
        stat('kcBtNet', fmtPct(r.net * 100), r.net >= 0 ? 'up' : 'dn'), stat('kcBtBH', fmtPct(r.bh * 100), r.bh >= 0 ? 'up' : 'dn'),
        stat('kcBtTrades', String(r.trades.length)), stat('kcBtWin', Math.round(r.win * 100) + '%'),
        stat('kcBtPF', r.pf === Infinity ? '∞' : r.pf.toFixed(2)), stat('kcBtDD', '-' + (r.dd * 100).toFixed(1) + '%', 'dn'),
        h('div', { class: 'kc-note', text: T('kcBtNote', { n: list.length }) }),
        h('div', { class: 'kc-row-end' }, btn('kc-btn pri', T('kcBtShow'), () => {
          for (const i of c.chart.getIndicators({ name: 'KCBT' })) c.chart.removeIndicator({ id: i.id });
          c.chart.createIndicator({ name: 'KCBT', paneId: MAIN, extendData: { c: c.i, res: r } }, true);
          closeSheet(sh); updBars();
        }), hasInd(c, 'KCBT') ? btn('kc-btn', T('kcBtHide'), () => { for (const i of c.chart.getIndicators({ name: 'KCBT' })) c.chart.removeIndicator({ id: i.id }); closeSheet(sh); updBars(); }) : null),
      );
    };
    b.append(seg([['ema', T('kcBtEma')], ['sma', T('kcBtSma')], ['rsi', 'RSI']], kind, (v) => { kind = v; if (v === 'rsi') { f.value = '30'; s.value = '70'; } else { f.value = '9'; s.value = '21'; } run(); }),
      h('div', { class: 'kc-row' }, h('label', { class: 'kc-field' }, h('span', { text: T('kcBtA') }), f), h('label', { class: 'kc-field' }, h('span', { text: T('kcBtB') }), s)),
      h('div', { class: 'kc-row-end' }, btn('kc-btn', T('kcBtRun'), run)), out);
    run();
  });
}

/* עץ אובייקטים: כל השרטוטים והאינדיקטורים בגרף — הסתרה, נעילה, מחיקה */
function openObjects() {
  const c = act();
  if (!c || !c.chart) return;
  openSheet(T('kcObjects'), (b) => {
    function draw() {
      b.textContent = '';
      const ovs = c.chart.getOverlays({ groupId: 'user' }).filter((o) => o.currentStep === -1);
      b.appendChild(h('div', { class: 'kc-gt', text: T('kcDrawings') + ' (' + ovs.length + ')' }));
      for (const o of ovs) {
        const vis = o.visible !== false;
        b.appendChild(h('div', { class: 'kc-li static' },
          h('span', { class: 'kc-ico', html: ICON[TOOL_INFO[o.name] ? TOOL_INFO[o.name].icon : 'trend'] }),
          h('span', { class: 'kc-li-n', text: T(TOOL_INFO[o.name] ? TOOL_INFO[o.name].key : 'kcDrawing') + (o.extendData && o.extendData.text ? ' · ' + String(o.extendData.text).slice(0, 24) : '') }),
          btn('kc-ib sm', vis ? T('kcHide') : T('kcShow'), () => { c.chart.overrideOverlay({ id: o.id, visible: !vis }); changed(c); draw(); }, vis ? ICON.eye : ICON.eyeoff),
          btn('kc-ib sm', o.lock ? T('kcUnlock') : T('kcLock'), () => { c.chart.overrideOverlay({ id: o.id, lock: !o.lock }); changed(c); draw(); }, o.lock ? ICON.lock : ICON.unlock),
          btn('kc-ib sm danger', T('kcDelete'), () => { c.chart.removeOverlay({ id: o.id }); deselect(); changed(c); draw(); }, ICON.trash)));
      }
      const inds = c.chart.getIndicators();
      b.appendChild(h('div', { class: 'kc-gt', text: T('kcIndicators') + ' (' + inds.length + ')' }));
      for (const i of inds) {
        const vis = i.visible !== false;
        b.appendChild(h('div', { class: 'kc-li static' }, h('span', { class: 'kc-li-n', text: AUTO[i.name] ? T('kcAutoN_' + i.name) : i.name === 'KCBT' ? T('kcBtTitle') : i.name === 'KCCMP' ? T('kcCompare') + ' ' + ((i.extendData && i.extendData.sym) || '') : indName(i.name) }),
          btn('kc-ib sm', vis ? T('kcHide') : T('kcShow'), () => { c.chart.overrideIndicator({ id: i.id, visible: !vis }); save(); draw(); }, vis ? ICON.eye : ICON.eyeoff),
          btn('kc-ib sm danger', T('kcRemove'), () => { removeInd(c, i.id); updBars(); draw(); }, ICON.trash)));
      }
    }
    draw();
  });
}

/* הגדרות: צבעים, רשת, שעון, מסחר מורחב, סיכון לכלי הפוזיציה */
function restyleAll() { for (const c of S.cells) if (c.chart) c.chart.setStyles(chartStyles(c)); }
function openSettings() {
  const g = S.store.g;
  openSheet(T('kcSettings'), (b) => {
    const risk = h('input', { class: 'kc-in num', type: 'number', min: '1', step: 'any', value: String(g.risk) });
    risk.addEventListener('change', () => { const v = parseFloat(risk.value); if (v > 0) { g.risk = v; save(); } });   // כלי הפוזיציה קוראים את הסיכון בכל ציור
    b.append(
      h('div', { class: 'kc-gt', text: T('kcColors') }),
      seg([['app', T('kcColApp')], ['tv', T('kcColTv')], ['mono', T('kcColMono')]], g.colors, (v) => { g.colors = v; save(); restyleAll(); }),
      toggle(T('kcGrid'), g.grid !== 0, (v) => { g.grid = v ? 1 : 0; save(); restyleAll(); }),
      toggle(T('kcHL'), g.hl !== 0, (v) => { g.hl = v ? 1 : 0; save(); restyleAll(); }),
      toggle(T('kcFills'), g.fills !== 0, (v) => { g.fills = v ? 1 : 0; save(); redrawMine(); }),
      h('div', { class: 'kc-gt', text: T('kcData') }),
      toggle(T('kcExt'), g.ext, (v) => { g.ext = v; save(); for (const c of S.cells) if (c.chart && L.isIntraday(c.tf)) setSymbolPeriod(c); }),
      h('div', { class: 'kc-field' }, h('span', { text: T('kcTz') }), seg([['ex', T('kcTzEx')], ['local', T('kcTzLocal')]], g.tz, (v) => {
        g.tz = v; save();
        for (const c of S.cells) if (c.chart) { try { c.chart.setTimezone(v === 'local' ? Intl.DateTimeFormat().resolvedOptions().timeZone : c.tz); } catch (e) { /* אזור לא מוכר */ } }
      })),
      h('label', { class: 'kc-field' }, h('span', { text: T('kcRisk') }), risk),
      h('div', { class: 'kc-note', text: T('kcRiskNote') }),
      h('div', { class: 'kc-row-end' }, btn('kc-btn', T('kcShot'), shot)),
      h('div', { class: 'kc-gt', text: T('kcKeys') }),
      h('div', { class: 'kc-note', text: T('kcKeysList') }),
    );
  });
}

/* צילום מסך (שיתוף / הורדה) */
async function shot() {
  const c = act();
  if (!c || !c.chart) return;
  try {
    const url = c.chart.getConvertPictureUrl(true, 'png', palette().bg);
    const blob = await (await fetchData(url)).blob();
    const file = typeof File === 'function' ? new File([blob], c.sym + '-' + c.tf + '.png', { type: 'image/png' }) : null;
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: c.sym }); return; }
    const a = h('a', { href: url, download: c.sym + '-' + c.tf + '.png' });
    document.body.appendChild(a); a.click(); a.remove();
  } catch (e) { if (e && e.name !== 'AbortError' && E.flash) E.flash(T('kcShotFail')); }
}
// data: URL → Blob בלי רשת (המרה מקומית)
function fetchData(url) {
  const [head, b64] = String(url).split(',');
  const bin = atob(b64 || ''), u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  const blob = new Blob([u], { type: (/data:([^;]+)/.exec(head) || [])[1] || 'image/png' });
  return Promise.resolve({ blob: () => Promise.resolve(blob) });
}

/* רשימת מעקב בצד (כמו בצד ימין של TradingView) — המניות של התיק והמעקב, מחיר חי */
const narrow = () => typeof matchMedia === 'function' && matchMedia('(max-width: 720px)').matches;
// בטלפון רשימת המעקב היא מגירה מעל הגרף: נסגרת בנגיעה מחוץ לה, ב"חזור" ובפתיחת כל תפריט אחר
function closeWatch(fromPop) { if (S.watch) toggleWatch(fromPop); }
function toggleWatch(fromPop) {
  S.watch = !S.watch;
  UI.watch.classList.toggle('on', S.watch);
  if (UI.wveil) UI.wveil.classList.toggle('on', S.watch);
  if (S.watch) {
    closeFly();
    while (S.sheets.length) closeSheet(S.sheets[S.sheets.length - 1]);
    if (narrow() && E.modalPush) S.wModal = E.modalPush(() => closeWatch(true));
  } else if (S.wModal) { const m = S.wModal; S.wModal = null; if (fromPop !== true) unwind([m]); }
  renderTop(); renderMbar();
  if (S.watch) updWatch();
  setTimeout(() => { for (const c of S.cells) if (c.chart) c.chart.resize(); }, 50);
}
function updWatch() {
  if (!UI.watch || !S.watch) return;
  const syms = E.symbols ? E.symbols().slice(0, 40) : [];
  const sig = syms.join(',') + '|' + (act() ? act().sym : '');
  if (UI.watchSig === sig && UI.watchRows) {
    for (const [s, r] of UI.watchRows) {
      const q = S.wq[s] && parseQuote(S.wq[s]), p = q && q.reg ? q.reg.p : 0, pct = p && q.prev ? (p / q.prev - 1) * 100 : null;
      r.p.textContent = p ? fmtNum(p, L.precisionFor(p)) : '—';
      r.c.textContent = fmtPct(pct); r.c.className = 'kc-wc ' + (pct > 0 ? 'up' : pct < 0 ? 'dn' : '');
    }
    return;
  }
  UI.watchSig = sig; UI.watchRows = new Map();
  UI.watch.textContent = '';
  UI.watch.appendChild(h('div', { class: 'kc-gt', text: T('kcWatch') }));
  for (const s of syms) {
    const q = S.wq[s] && parseQuote(S.wq[s]), p = q && q.reg ? q.reg.p : 0, pct = p && q.prev ? (p / q.prev - 1) * 100 : null;
    const rp = h('span', { class: 'kc-wp', text: p ? fmtNum(p, L.precisionFor(p)) : '—' }), rc = h('span', { class: 'kc-wc ' + (pct > 0 ? 'up' : pct < 0 ? 'dn' : ''), text: fmtPct(pct) });
    UI.watchRows.set(s, { p: rp, c: rc });
    UI.watch.appendChild(h('button', { type: 'button', class: 'kc-wr' + (act() && act().sym === s ? ' on' : ''), onclick: () => setSym(act(), s) }, h('b', { text: s, dir: 'ltr' }), rp, rc));
  }
  if (!syms.length) UI.watch.appendChild(h('div', { class: 'kc-note', text: T('kcWatchEmpty') }));
}

/* ---------- מקלדת (לפי ת־גרף) ---------- */
function onKey(e) {
  if (!ROOT) return;
  const tag = e.target && e.target.tagName, typing = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target && e.target.isContentEditable);
  if (e.key === 'Escape') {
    e.stopPropagation(); e.preventDefault();
    if (FLY) closeFly(); else if (S.sheets.length) closeSheet(S.sheets[S.sheets.length - 1]); else if (S.tool) stopTool(); else if (S.sel) deselect(); else if (S.pick) { S.pick = null; renderReplay(); updBars(); } else closeChart();
    return;
  }
  if (typing || S.sheets.length) return;
  const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
  const c = act();
  if (mod && k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
  if ((mod && k === 'y') || (mod && k === 'z' && e.shiftKey)) { e.preventDefault(); redo(); return; }
  if ((e.key === 'Delete' || e.key === 'Backspace') && S.sel) { e.preventDefault(); selDelete(); return; }
  if (e.altKey && !mod) {
    const map = { t: 'segment', h: 'horizontalStraightLine', v: 'verticalStraightLine', f: 'kcFibRet', j: 'horizontalRayLine', c: 'kcCrossLine' };
    const code = (e.code || '').replace(/^Key/, '').toLowerCase();
    if (map[code]) { e.preventDefault(); startTool(map[code]); return; }
    if (code === 'r' && c && c.chart) { e.preventDefault(); fitView(c); return; }
    if (code === 'i') { e.preventDefault(); openIndSheet(); return; }
    if (code === 'a') { e.preventDefault(); openAlerts(); return; }
  }
  if (!mod && !e.altKey && c && c.replay && (e.key === 'ArrowRight' || e.key === ' ')) { e.preventDefault(); if (e.key === ' ') (c.replay.timer ? replayPause(c) : replayPlay(c)); else replayStep(c); return; }
  if (!mod && !e.altKey && /^[a-z0-9^]$/i.test(e.key)) { e.preventDefault(); openSearch(e.key.toUpperCase()); }
}

/* ---------- פתיחה / סגירה ---------- */
function failView(msg) {
  ROOT.textContent = '';
  ROOT.append(h('div', { class: 'kc-top' }, btn('kc-ib kc-back', T('kcBack'), () => closeChart(), ICON.back)), h('div', { class: 'kc-st on' }, h('div', { class: 'kc-st-msg', text: msg })));
}
export async function openChart(sym, env) {
  E = env || E;
  sym = String(sym || '').toUpperCase();
  if (ROOT && S.store && act()) { if (act().sym !== sym) setSym(act(), sym); return; }   // נגיעה בהתראה כשהגרף פתוח
  if (ROOT) closeChart(true);
  ROOT = h('div', { class: 'kc-root no-swipe', role: 'dialog', 'aria-modal': 'true', 'aria-label': T('kcTitle') }, h('div', { class: 'kc-st on' }, h('div', { class: 'kc-spin' })));
  const root = ROOT;
  document.body.appendChild(ROOT);
  if (!reduced() && typeof ROOT.animate === 'function') ROOT.animate([{ opacity: 0, transform: 'translateY(24px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' });
  document.documentElement.classList.add('kc-open');
  S.modal = E.modalPush ? E.modalPush(() => closeChart(true)) : null;
  document.addEventListener('keydown', onKey, true);
  await ensureCss();
  try { await loadLib(); } catch (e) { if (ROOT === root) failView(T('kcErrLib')); return; }
  if (ROOT !== root) return;
  S.store = loadStore();
  S.sel = null; S.tool = null; S.pick = null; S.sheets = []; S.range = null; S.allLocked = false; S.allHidden = false;
  build(sym);
  kcqSeed();
  quiet = 0;
  clearInterval(S.timer);
  S.timer = setInterval(() => { poll(); updClock(); }, 1000);
  setTimeout(poll, 0);
  if (bgList().length || BG.st === 'on') setTimeout(() => bgSync(false), 1500);   // מה שנשלח ברקע → מסומן כאן; מנוי שהתחלף → מתעדכן
  if (typeof matchMedia === 'function') { S.mq = matchMedia('(prefers-color-scheme: dark)'); S.mqf = () => restyleAll(); try { S.mq.addEventListener('change', S.mqf); } catch (e) { /* דפדפן ישן */ } }
}
export function closeChart(fromPop) {
  if (!ROOT) return;
  document.removeEventListener('keydown', onKey, true);
  closeFly();
  clearInterval(S.timer); S.timer = null;
  if (S.ro) { S.ro.disconnect(); S.ro = null; }
  if (S.mq && S.mqf) { try { S.mq.removeEventListener('change', S.mqf); } catch (e) { /* דפדפן ישן */ } }
  if (S.store) saveNow();
  const recs = [...S.sheets.map((x) => x.modal).reverse(), S.wModal, S.modal];
  S.wModal = null;
  if (narrow()) S.watch = false;   // בטלפון המגירה לא נשארת פתוחה לפתיחה הבאה
  for (const sh of S.sheets) if (sh.el) sh.el.remove();
  S.sheets = [];
  for (const c of S.cells) {
    if (c.replay && c.replay.timer) clearInterval(c.replay.timer);
    c.seq++;
    if (c.chart) { try { K.dispose(c.host); } catch (e) { /* כבר נסגר */ } c.chart = null; }
  }
  S.cells = []; S.sel = null; S.tool = null; S.pick = null;
  const r = ROOT; ROOT = null;
  document.documentElement.classList.remove('kc-open');
  S.modal = null;
  if (!fromPop) unwind(recs);
  if (!reduced() && typeof r.animate === 'function') {
    r.style.pointerEvents = 'none';
    const a = r.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(24px)' }], { duration: 200, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' });
    a.onfinish = () => r.remove();
  } else r.remove();
  if (E.onClose) E.onClose();
}
/* טעינה מראש (הכפתור נראה בכרטיס המניה): הספרייה והעיצוב — בלחיצה המסך עולה מיד */
export function prefetchChart(env, sym) {
  E = env || E;
  if (typeof document === 'undefined') return;
  ensureCss();
  loadLib().catch(() => {});
  // 28/10/2026: גם הנרות של האינטרוול שייפתח — בלחיצה הגרף עולה מלא, בלי ספינר
  if (!sym || ROOT || lite()) return;
  const st = loadStore(), c0 = st.g.cells[0], tf = c0 && TF[c0.tf] ? c0.tf : '1D';
  PEXT = st.g.ext;
  fetchCandles(null, 0, String(sym).toUpperCase(), tf).catch(() => {});
}
