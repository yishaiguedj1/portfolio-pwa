'use strict';
/* ============================================================
 * תיק ההשקעות — PWA עצמאית
 * נתונים סטטיים: פוזיציות, הפקדות, פנסיה (מהגיליון, 2026-09-22)
 * מחירים חיים: CNBC (ראשי) ← Yahoo (גיבוי), דיליי ~15 דקות
 * היסטוריה לגרפים: Yahoo (ראשי, כולל מסחר מורחב טרום/אחרי) ← Stooq (גיבוי)
 * שער דולר: open.er-api.com / frankfurter
 * ============================================================ */

/* ---------------- עזרים טהורים (נבדקים ב-node) ---------------- */

function pf(v) {
  const n = parseFloat(v);
  return isFinite(n) ? n : null;
}

/* מפענח היסטוריית Stooq יומית/תוך-יומית: Date[,Time],Open,High,Low,Close,Volume */
function parseHistoryCSV(text) {
  const rows = [];
  if (!text || typeof text !== 'string') return rows;
  const lines = text.trim().split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    const c = line.split(',');
    if (c.length < 6) continue;
    const m = c[0].trim().match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}(?::\d{2})?))?/);
    if (!m) continue; // כותרת או שורה לא תקינה
    const close = pf(c[4]);
    if (close === null || close <= 0) continue;
    rows.push({
      date: m[1],
      time: m[2] || null,
      open: pf(c[1]),
      high: pf(c[2]),
      low: pf(c[3]),
      close: close,
      volume: parseInt(c[5], 10) || 0
    });
  }
  rows.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    const ta = a.time || '', tb = b.time || '';
    return ta < tb ? -1 : ta > tb ? 1 : 0;
  });
  return rows;
}

function pad2(n) { return String(n).padStart(2, '0'); }

/* מפענח תשובת Yahoo Finance v8: timestamp (שניות UTC) + נרות OHLCV.
   withTime=true מחזיר גם שעה בשעון הבורסה (לגרף תוך־יומי, כולל מסחר מורחב). */
function parseYahooBars(json, withTime) {
  const rows = [];
  try {
    const chart = json && json.chart;
    const res = chart && chart.result && chart.result[0];
    if (!res || chart.error) return rows;
    const ts = res.timestamp || [];
    const ind = (res.indicators && res.indicators.quote && res.indicators.quote[0]) || {};
    const opens = ind.open || [], highs = ind.high || [], lows = ind.low || [],
          closes = ind.close || [], vols = ind.volume || [];
    const off = (res.meta && res.meta.gmtoffset) || 0;
    for (let i = 0; i < ts.length; i++) {
      const close = pf(closes[i]);
      if (!(close > 0)) continue;
      const d = new Date((ts[i] + off) * 1000);
      rows.push({
        date: d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate()),
        time: withTime ? pad2(d.getUTCHours()) + ':' + pad2(d.getUTCMinutes()) : null,
        open: pf(opens[i]),
        high: pf(highs[i]),
        low: pf(lows[i]),
        close: close,
        volume: parseInt(vols[i], 10) || 0
      });
    }
  } catch (e) {}
  return rows;
}

/* מסווג שגיאת רשת למילים פשוטות — כדי שנראה מה קרה בטלפון */
function netErrName(e) {
  if (e && e.name === 'AbortError') return 'לא ענה בזמן';
  if (e instanceof TypeError) return 'חסימת דפדפן/רשת';
  if (e && e.message) return String(e.message).slice(0, 40);
  return 'שגיאה';
}

/* ניסיון אחד להביא נרות מ־Yahoo; מחזיר rows או null ורושם מה קרה */
async function fetchYahooBars(url, withTime, notes, name) {
  try {
    const rows = parseYahooBars(await fetchJSONTimeout(url, 12000), withTime);
    if (rows.length) return rows;
    notes.push(name + ': החזיר ריק');
  } catch (e) { notes.push(name + ': ' + netErrName(e)); }
  return null;
}

/* סינון טווח מתוך היסטוריה יומית ממוינת (ישן -> חדש) */
function filterRange(rows, range) {
  if (!rows || !rows.length) return [];
  const n = rows.length;
  switch (range) {
    case 'week':  return rows.slice(-5);
    case 'month': return rows.slice(-22);
    case 'ytd': {
      const y = rows[n - 1].date.slice(0, 4);
      return rows.filter((r) => r.date.slice(0, 4) === y);
    }
    case 'year':  return rows.slice(-252);
    case '5y':    return rows.slice(-1260);
    case 'max':
    default:      return rows.slice();
  }
}

/* דילול נקודות לציור חלק */
function downsample(rows, max) {
  if (rows.length <= max) return rows;
  const step = rows.length / max;
  const out = [];
  for (let i = 0; i < max; i++) out.push(rows[Math.floor(i * step)]);
  out.push(rows[rows.length - 1]);
  return out;
}

/* מחיר סגירה קודם לחישוב שינוי יומי (מתמודד עם סופ"ש/חג) */
function prevCloseFor(quoteDate, hist) {
  if (!hist || !hist.length) return null;
  for (let i = hist.length - 1; i >= 0; i--) {
    if (hist[i].date < quoteDate) return hist[i].close;
  }
  return hist.length > 1 ? hist[hist.length - 2].close : null;
}

function athOf(hist) {
  if (!hist || !hist.length) return null;
  let best = hist[0];
  for (const r of hist) if (r.close > best.close) best = r;
  return { price: best.close, date: best.date };
}

/* ---------------- פורמט ---------------- */

function fmtUSD(v) {
  if (v === null || v === undefined || !isFinite(v)) return '—';
  return '$' + Math.round(v).toLocaleString('en-US');
}
function fmtUSD2(v) {
  if (v === null || v === undefined || !isFinite(v)) return '—';
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtILS(v) {
  if (v === null || v === undefined || !isFinite(v)) return '—';
  return '₪' + Math.round(v).toLocaleString('en-US');
}
function fmtPct(v, signed) {
  if (v === null || v === undefined || !isFinite(v)) return '—';
  const s = signed && v > 0 ? '+' : '';
  return s + v.toFixed(2) + '%';
}
function fmtDateIL(iso) { // YYYY-MM-DD -> DD/MM/YYYY
  if (!iso) return '—';
  const p = iso.split('-');
  return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : iso;
}
function fmtTimeIL(ts) {
  try {
    return new Date(ts).toLocaleString('he-IL', {
      timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  } catch (e) { return '—'; }
}
function money(v, cur) { return cur === 'ILS' ? fmtILS(v) : fmtUSD(v); }
function money2(v, cur) { return cur === 'ILS' ? fmtILS(v) : fmtUSD2(v); }

/* ---------------- נתונים סטטיים (גיליון 2026-09-22) ---------------- */

const POSITIONS = [
  { sym: 'NOW',  name: 'סרוויסנאו',   full: 'ServiceNow Inc',      shares: 97,   avg: 89.12  },
  { sym: 'META', name: 'מטא',         full: 'Meta Platforms Inc',  shares: 17,   avg: 504.17 },
  { sym: 'ADBE', name: 'אדובי',        full: 'Adobe Inc',          shares: 41,   avg: 251.82 },
  { sym: 'MBLY', name: 'מובילאיי',     full: 'Mobileye Global Inc', shares: 1047, avg: 12.23  },
  { sym: 'UNH',  name: 'יונייטדהלת׳',  full: 'UnitedHealth Group',  shares: 20,   avg: 286.91 },
  { sym: 'MSFT', name: 'מיקרוסופט',    full: 'Microsoft Corp',      shares: 15,   avg: 369.00 },
  { sym: 'UBER', name: 'אובר',        full: 'Uber Technologies',   shares: 93,   avg: 70.48  },
  { sym: 'INTU', name: 'אינטואיט',     full: 'Intuit Inc',          shares: 17,   avg: 277.63 },
  { sym: 'APP',  name: 'אפלובין',      full: 'AppLovin Corp',       shares: 9,    avg: 308.81 }
];

const NET_DEPOSITS_ILS = 187319;
const CASH_USD = 65;

const DEPOSITS = [
  ["08/08/2023",-26240],["08/08/2023",-2000],["10/08/2023",-2000],
  ["10/09/2023",-2504],["09/10/2023",-2511],["12/11/2023",-3011],
  ["04/12/2023",-2525],["06/12/2023",-2025],["10/12/2023",-1450],
  ["31/01/2024",-2500],["18/02/2024",-3017],["03/03/2024",-4024],
  ["12/04/2024",-3021],["09/05/2024",-3005],["10/05/2024",-1005],
  ["11/06/2024",-4026],["21/07/2024",-3026],["14/08/2024",-3027],
  ["10/09/2024",-3028],["10/10/2024",-3029],["10/11/2024",-3030],
  ["06/01/2025",-5025],["11/02/2025",-3525],["19/02/2025",37000],
  ["10/03/2025",-6000],["07/04/2025",-2026],["07/04/2025",-18027],
  ["28/05/2025",-15000],["05/08/2025",-5000],["07/09/2025",-525],
  ["10/10/2025",-5025],["12/11/2025",-5000],["07/12/2025",-1025],
  ["11/12/2025",-3025],["11/01/2026",-3825],["10/02/2026",-13025],
  ["02/03/2026",-5026],["09/03/2026",-2026],["22/03/2026",-5027],
  ["10/04/2026",-5028],["03/05/2026",-5029],["06/05/2026",-3030],
  ["21/05/2026",-3031],["18/06/2026",-20032],["26/06/2026",-10033],
  ["01/08/2026",0],["01/08/2026",0],["01/08/2026",0]
];

const PENSION_FUNDS = [
  { name: 'מנורה — פנסיה',     usd: 80053, ils: 241329 },
  { name: 'Fnx — השתלמות',     usd: 13345, ils: 40229  },
  { name: 'מיטב — השתלמות',    usd: 1021,  ils: 3077   }
];

const PENSION_DEPOSITS = [
  { place: 'צה״ל',              period: '02/12/2018 – 02/06/2019', amount: -7586,   note: 'סה״כ ₪190,803' },
  { place: 'רשף - בנק הפועלים', period: '15/11/2021 – 15/02/2022', amount: -7615,   note: '' },
  { place: 'צוות 3 - גוגל',     period: '15/03/2022 – 15/04/2026', amount: -175602, note: 'עודכן 17/09/26' }
];

/* ---------------- מקורות נתונים ---------------- */
/* מחירים חיים: CNBC (ראשי) ← Yahoo (גיבוי). היסטוריה ומסחר מורחב: Yahoo (ראשי) ← Stooq (גיבוי). */

const stooqDailyURL = (sym) => 'https://stooq.com/q/d/l/?s=' + sym.toLowerCase() + '.us&i=d';
const stooqIntradayURL = (sym) => 'https://stooq.com/q/d/l/?s=' + sym.toLowerCase() + '.us&i=5';

/* Yahoo Finance v8 — ללא מפתח, כולל מסחר מורחב (includePrePost) */
const yahooURL = (sym, params, host) =>
  'https://' + (host || 'query1') + '.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym.toUpperCase()) + '?' + params;
const yahooQuoteURL = (sym) => yahooURL(sym, 'interval=1d&range=5d');

const LS_QUOTES = 'pwa_quotes_v2'; // v2: ניקוי מטמון ישן שסומן כ־Stooq
const LS_HIST = 'pwa_hist_v1_'; // + sym

const PIE_COLORS = ['#006A4E','#2E7D32','#1565C0','#5E35B1','#C2185B','#E65100','#B7791F','#00838F','#6D4C41'];

/* ---------------- מצב ---------------- */

const state = {
  currency: 'USD',
  quotes: {},       // sym -> quote
  fx: null,         // USDILS
  source: null,     // מאיזה מקור הגיעו המחירים (Stooq / CNBC)
  quotesAt: null,
  stale: false,     // מוצגים נתונים שמורים (אין חיבור)
  hist: {},         // sym -> daily rows
  intra: {},        // sym -> intraday rows (יום)
  histDbg: {},      // sym -> מה קרה בניסיון להביא היסטוריה (לאבחון)
  open: {},         // sym -> bool (שורה פתוחה)
  range: {},        // sym -> 'day'|'week'|'month'|'ytd'|'year'|'5y'|'max'
  measure: {}       // sym -> { on, pts:[idxA, idxB] }
};

const RANGES = [
  ['day', 'יום'], ['week', 'שבוע'], ['month', 'חודש'], ['ytd', 'YTD'],
  ['year', 'שנה'], ['5y', '5 שנים'], ['max', 'מקסימום']
];

function lsGet(k) {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; }
}
function lsSet(k, v) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
}

/* ---------------- רשת ---------------- */

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: n }, async () => {
    while (i < items.length) {
      const idx = i++;
      try { out[idx] = await fn(items[idx]); } catch (e) { out[idx] = null; }
    }
  });
  await Promise.all(workers);
  return out;
}

/* ---------------- מקורות מחיר (רשת) ---------------- */
/* סדר הניסיון: CNBC ← נתונים שמורים בטלפון. */

async function fetchTextTimeout(url, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { cache: 'no-store', signal: ctrl.signal });
    if (!res.ok) throw new Error('http ' + res.status);
    return res.text();
  } finally { clearTimeout(t); }
}

async function fetchJSONTimeout(url, ms) {
  return JSON.parse(await fetchTextTimeout(url, ms));
}

function num(v) {
  if (v === null || v === undefined) return null;
  const n = parseFloat(String(v).replace(/,/g, '').replace('%', '').trim());
  return isFinite(n) ? n : null;
}

function todayISO() {
  const d = new Date();
  const p2 = (x) => String(x).padStart(2, '0');
  return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
}

/* --- מקור המחירים: CNBC --- */
const CNBC_QUOTES_URL =
  'https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol?symbols=' +
  POSITIONS.map((p) => p.sym.toUpperCase()).join('|') +
  '&requestMethod=quick&noform=1&partnerId=2&fund=1&exthrs=1&output=json';

function parseCNBCQuotes(json) {
  const out = {};
  const fqr = (json && json.FormattedQuoteResult) || {};
  let arr = fqr.FormattedQuote || [];
  if (!Array.isArray(arr)) arr = [arr];
  for (const it of arr) {
    if (!it || typeof it !== 'object') continue;
    const sym = String(it.symbol || '').toUpperCase();
    if (!sym) continue;
    const close = num(it.last);
    if (!(close > 0)) continue;
    out[sym] = {
      symbol: sym,
      date: todayISO(),
      time: String(it.last_time || ''),
      open: num(it.open),
      high: num(it.high),
      low: num(it.low),
      close: close,
      volume: parseInt(String(it.volume || '').replace(/,/g, ''), 10) || 0
    };
  }
  return out;
}

async function tryCNBCFx() {
  const urls = [
    'https://open.er-api.com/v6/latest/USD',
    'https://api.frankfurter.app/latest?from=USD&to=ILS'
  ];
  for (const u of urls) {
    try {
      const j = await fetchJSONTimeout(u, 8000);
      const r = num(j && j.rates && j.rates.ILS);
      if (r > 0) return r;
    } catch (e) {}
  }
  throw new Error('no fx');
}

async function tryCNBCQuotes() {
  const [json, fx] = await Promise.all([
    fetchJSONTimeout(CNBC_QUOTES_URL, 10000),
    tryCNBCFx()
  ]);
  const q = parseCNBCQuotes(json);
  const missing = POSITIONS.filter((p) => !q[p.sym]).length;
  if (missing > 2) throw new Error('too few quotes');
  return { quotes: q, fx: fx, source: 'CNBC' };
}

function applyQuotes(res) {
  state.quotes = res.quotes;
  state.fx = res.fx;
  state.source = res.source;
  state.quotesAt = Date.now();
  state.stale = false;
  lsSet(LS_QUOTES, { at: state.quotesAt, fx: state.fx, quotes: res.quotes, source: res.source });
  setBanner(null);
  updateSourceLabel();
}

function updateSourceLabel() {
  const el = document.getElementById('sourceLabel');
  if (el) {
    el.textContent = 'מקור: ' + (state.source || '—') + ' · דיליי ~15 דקות' +
      (state.stale ? ' · מוצגים נתונים שמורים' : '');
  }
}

async function tryYahooQuotes() {
  const results = await pool(POSITIONS.map((p) => p.sym), 3, async (sym) => {
    try {
      const json = await fetchJSONTimeout(yahooQuoteURL(sym), 10000);
      const chart = json && json.chart;
      const res = chart && chart.result && chart.result[0];
      if (!res || chart.error) return null;
      const meta = res.meta || {};
      const close = num(meta.regularMarketPrice);
      if (!(close > 0)) return null;
      return {
        symbol: sym,
        date: todayISO(),
        time: '',
        open: null,
        high: num(meta.regularMarketDayHigh),
        low: num(meta.regularMarketDayLow),
        close: close,
        volume: parseInt(meta.regularMarketVolume, 10) || 0
      };
    } catch (e) { return null; }
  });
  const q = {};
  for (const r of results) if (r) q[r.symbol] = r;
  const missing = POSITIONS.filter((p) => !q[p.sym]).length;
  if (missing > 2) throw new Error('too few quotes');
  const fx = await tryCNBCFx();
  return { quotes: q, fx: fx, source: 'Yahoo' };
}

async function refreshQuotes() {
  const tries = [tryCNBCQuotes, tryYahooQuotes];
  for (const fn of tries) {
    try { applyQuotes(await fn()); renderAll(); return; }
    catch (e) { /* ניסיון הבא */ }
  }
  const cached = lsGet(LS_QUOTES);
  if (cached && cached.quotes && cached.fx) {
    state.quotes = cached.quotes;
    state.fx = cached.fx;
    state.quotesAt = cached.at;
    state.source = cached.source || null;
    state.stale = true;
    setBanner('אין חיבור למקור המחירים — מוצגים נתונים אחרונים מ־' + fmtTimeIL(cached.at) + '.');
  } else {
    state.source = null;
    setBanner('לא התקבלו מחירים. בדקו חיבור לאינטרנט ונסו לרענן.');
  }
  updateSourceLabel();
  renderAll();
}

async function getDaily(sym, force) {
  const wantMax = state.range[sym] === 'max';
  if (!force && !wantMax) {
    if (state.hist[sym]) return state.hist[sym];
    const cached = lsGet(LS_HIST + sym);
    if (cached && cached.rows && cached.rows.length) {
      const dayOld = new Date(cached.at).toDateString() !== new Date().toDateString();
      if (!dayOld) { state.hist[sym] = cached.rows; return cached.rows; }
    }
  }
  const save = (rows) => {
    state.hist[sym] = rows;
    state.histDbg[sym] = null;
    lsSet(LS_HIST + sym, { at: Date.now(), rows: rows });
    return rows;
  };
  const notes = [];
  const dq = (host) => yahooURL(sym, 'interval=1d&range=' + (wantMax ? 'max' : '5y'), host);
  let rows = await fetchYahooBars(dq('query1'), false, notes, 'Yahoo')
          || await fetchYahooBars(dq('query2'), false, notes, 'Yahoo2');
  if (rows) return save(rows);
  try {
    rows = parseHistoryCSV(await fetchTextTimeout(stooqDailyURL(sym), 12000));
    if (rows.length) return save(rows);
    notes.push('Stooq: החזיר ריק');
  } catch (e) { notes.push('Stooq: ' + netErrName(e)); }
  state.histDbg[sym] = notes.join(' · ');
  const cached = lsGet(LS_HIST + sym);
  if (cached && cached.rows) { state.hist[sym] = cached.rows; return cached.rows; }
  return [];
}

async function getIntraday(sym) {
  if (state.intra[sym]) return state.intra[sym];
  const notes = [];
  const iq = (host) => yahooURL(sym, 'interval=5m&range=1d&includePrePost=true', host);
  let rows = await fetchYahooBars(iq('query1'), true, notes, 'Yahoo')
          || await fetchYahooBars(iq('query2'), true, notes, 'Yahoo2');
  if (rows) { state.intra[sym] = rows; return rows; }
  try {
    rows = parseHistoryCSV(await fetchTextTimeout(stooqIntradayURL(sym), 12000));
    if (rows.length) { state.intra[sym] = rows; return rows; }
  } catch (e) {}
  return [];
}

async function warmHistories() {
  await pool(POSITIONS.map((p) => p.sym), 3, (sym) => getDaily(sym, false));
  renderStocks();
  renderOverview();
}

/* ---------------- חישובים ---------------- */

function metrics(sym) {
  const p = POSITIONS.find((x) => x.sym === sym);
  const q = state.quotes[sym];
  const price = q ? q.close : null;
  const hist = state.hist[sym] || [];
  let dayChg = null;
  if (q && hist.length) {
    const pc = prevCloseFor(q.date, hist);
    if (pc) dayChg = (q.close - pc) / pc * 100;
  }
  const value = price !== null ? price * p.shares : null;
  const gl = price !== null ? (price - p.avg) * p.shares : null;
  const ath = athOf(hist);
  const offAth = (ath && price !== null) ? (price - ath.price) / ath.price * 100 : null;
  return { p, q, price, dayChg, value, gl, ath, offAth };
}

function totalsUSD() {
  let stockVal = 0;
  for (const p of POSITIONS) {
    const q = state.quotes[p.sym];
    if (q) stockVal += q.close * p.shares;
  }
  return { stockVal: stockVal, total: stockVal + CASH_USD };
}

function depositsInCur() {
  return state.currency === 'ILS' ? NET_DEPOSITS_ILS : (state.fx ? NET_DEPOSITS_ILS / state.fx : null);
}

/* ---------------- DOM ---------------- */

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

function setBanner(msg) {
  const b = document.getElementById('statusBanner');
  if (!msg) { b.classList.add('hidden'); b.textContent = ''; return; }
  b.classList.remove('hidden');
  b.textContent = msg;
}

function switchTab(name) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.tabpage').forEach((s) => s.classList.toggle('active', s.id === 'tab-' + name));
}

/* ---------------- רינדור: סקירה ---------------- */

function renderOverview() {
  const cur = state.currency;
  const t = totalsUSD();
  const total = cur === 'ILS' && state.fx ? t.total * state.fx : t.total;
  const stockVal = cur === 'ILS' && state.fx ? t.stockVal * state.fx : t.stockVal;
  const dep = depositsInCur();
  const gl = (dep !== null) ? total - dep : null;
  const yld = (dep && dep !== 0 && gl !== null) ? gl / dep * 100 : null;

  const vEl = document.getElementById('ovValue');
  vEl.textContent = money(total, cur);
  document.getElementById('ovValueSub').textContent =
    'מניות: ' + money(stockVal, cur) + ' · מזומן: ' + money(cur === 'ILS' && state.fx ? CASH_USD * state.fx : CASH_USD, cur);

  const gEl = document.getElementById('ovGL');
  if (gl === null) { gEl.textContent = '—'; }
  else { gEl.textContent = (gl < 0 ? '−' : '+') + money(Math.abs(gl), cur); }
  gEl.className = 'stat-value ' + (gl === null ? '' : gl >= 0 ? 'pos' : 'neg');

  const yEl = document.getElementById('ovYield');
  yEl.textContent = fmtPct(yld, true);
  yEl.className = 'stat-value ' + (yld === null ? '' : yld >= 0 ? 'pos' : 'neg');

  document.getElementById('ovMeta').textContent =
    'עודכן: ' + (state.quotesAt ? fmtTimeIL(state.quotesAt) : '—') +
    (state.fx ? ' · $=₪' + state.fx.toFixed(4) : '');

  drawPie();
}

function drawPie() {
  const canvas = document.getElementById('pieChart');
  const t = totalsUSD();
  const slices = POSITIONS.map((p, i) => {
    const q = state.quotes[p.sym];
    const v = q ? q.close * p.shares : 0;
    return { sym: p.sym, name: p.name, value: v, color: PIE_COLORS[i % PIE_COLORS.length] };
  }).filter((s) => s.value > 0);
  const total = slices.reduce((a, s) => a + s.value, 0);

  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 320, h = 220;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);
  if (!total) {
    ctx.fillStyle = '#9AA5A0'; ctx.font = '14px system-ui'; ctx.textAlign = 'center';
    ctx.fillText('אין נתוני מחיר עדיין', w / 2, h / 2);
    return;
  }
  const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - 10, r = R * 0.62;
  let a = -Math.PI / 2;
  for (const s of slices) {
    const a2 = a + (s.value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, R, a, a2);
    ctx.arc(cx, cy, r, a2, a, true);
    ctx.closePath();
    ctx.fillStyle = s.color;
    ctx.fill();
    a = a2;
  }
  ctx.fillStyle = '#191C1A'; ctx.textAlign = 'center';
  ctx.font = '700 13px system-ui';
  ctx.fillText('סך מניות', cx, cy - 4);
  ctx.font = '800 17px system-ui';
  const cur = state.currency;
  ctx.fillText(money(cur === 'ILS' && state.fx ? total * state.fx : total, cur), cx, cy + 18);

  const legend = document.getElementById('pieLegend');
  legend.innerHTML = '';
  const sorted = slices.slice().sort((a, b) => b.value - a.value);
  for (const s of sorted) {
    const li = el('li', '',
      '<span class="dot" style="background:' + s.color + '"></span>' +
      '<span class="lg-name">' + s.name + ' (' + s.sym + ')</span>' +
      '<span class="lg-val">' + money(cur === 'ILS' && state.fx ? s.value * state.fx : s.value, cur) + '</span>' +
      '<span class="lg-pct">' + (s.value / total * 100).toFixed(1) + '%</span>');
    legend.appendChild(li);
  }
}

/* ---------------- רינדור: מניות ---------------- */

function renderStocks() {
  const list = document.getElementById('stockList');
  list.innerHTML = '';
  for (const p of POSITIONS) {
    list.appendChild(buildStockCard(p));
  }
}

function buildStockCard(p) {
  const sym = p.sym;
  const m = metrics(sym);
  const cur = state.currency;
  const priceTxt = m.price === null ? '—' : (cur === 'ILS' && state.fx ? fmtILS(m.price * state.fx) : fmtUSD2(m.price));

  const card = el('div', 'stock' + (state.open[sym] ? ' open' : ''));
  const head = el('button', 'stock-head');
  head.type = 'button';
  head.innerHTML =
    '<span class="stock-id"><span class="stock-sym">' + sym + '</span>' +
    '<span class="stock-name">' + p.name + '</span></span>' +
    '<span class="stock-price">' + priceTxt + '</span>' +
    '<span class="stock-sub"><span class="day-chg ' + (m.dayChg === null ? '' : m.dayChg >= 0 ? 'pos' : 'neg') + '">' +
    (m.dayChg === null ? '—' : 'היום ' + fmtPct(m.dayChg, true)) + '</span>' +
    '<span>' + (m.value === null ? '—' : money(cur === 'ILS' && state.fx ? m.value * state.fx : m.value, cur)) +
    ' <span class="chev">▾</span></span></span>';
  head.addEventListener('click', () => toggleStock(sym, card));
  card.appendChild(head);

  const body = el('div', 'stock-body');
  body.appendChild(buildStockBody(p, m));
  card.appendChild(body);
  return card;
}

function kvHTML(k, v, cls) {
  return '<div class="kv"><div class="k">' + k + '</div><div class="v' + (cls ? ' ' + cls : '') + '">' + v + '</div></div>';
}

function buildStockBody(p, m) {
  const sym = p.sym;
  const cur = state.currency;
  const wrap = el('div');
  const toCur = (usd) => (usd === null ? null : (cur === 'ILS' && state.fx ? usd * state.fx : usd));

  const grid = el('div', 'kv-grid');
  grid.innerHTML =
    kvHTML('מניות', p.shares.toLocaleString('en-US')) +
    kvHTML('מחיר קנייה ממוצע', cur === 'ILS' && state.fx ? fmtILS(p.avg * state.fx) : fmtUSD2(p.avg)) +
    kvHTML('שווי', m.value === null ? '—' : money(toCur(m.value), cur)) +
    kvHTML('רווח/הפסד',
      m.gl === null ? '—' : (m.gl < 0 ? '−' : '+') + money(Math.abs(toCur(m.gl)), cur) +
        ' (' + fmtPct(m.gl / (p.avg * p.shares) * 100, true) + ')',
      m.gl === null ? '' : m.gl >= 0 ? 'pos' : 'neg') +
    kvHTML('משקל בתיק', weightTxt(sym)) +
    kvHTML('ATH',
      m.ath ? (cur === 'ILS' && state.fx ? fmtILS(m.ath.price * state.fx) : fmtUSD2(m.ath.price)) +
        '<br><span style="font-weight:400;font-size:12px">' + fmtDateIL(m.ath.date) +
        (m.offAth !== null ? ' · ' + fmtPct(m.offAth, true) + ' מהשיא' : '') + '</span>'
        : (state.hist[sym] ? '—' : '…'));
  wrap.appendChild(grid);

  if (!state.range[sym]) state.range[sym] = 'year';
  const chead = el('div', 'chart-head');
  const ranges = el('div', 'ranges');
  for (const [key, label] of RANGES) {
    const b = el('button', 'range-btn' + (state.range[sym] === key ? ' active' : ''), label);
    b.type = 'button';
    b.addEventListener('click', () => {
      state.range[sym] = key;
      state.measure[sym] = { on: false, pts: [] };
      refreshStockBody(sym);
    });
    ranges.appendChild(b);
  }
  chead.appendChild(ranges);
  const mb = el('button', 'measure-btn' + (measureState(sym).on ? ' on' : ''), '📏 מדידה');
  mb.type = 'button';
  mb.title = 'בחירת שתי נקודות על הגרף למדידת תשואה ביניהן';
  mb.addEventListener('click', () => {
    const ms = measureState(sym);
    ms.on = !ms.on;
    ms.pts = [];
    refreshStockBody(sym);
  });
  chead.appendChild(mb);
  wrap.appendChild(chead);

  const chip = el('div', 'measure-chip hidden');
  chip.id = 'mchip-' + sym;
  wrap.appendChild(chip);

  const cwrap = el('div', 'chart-wrap');
  const canvas = el('canvas');
  canvas.id = 'chart-' + sym;
  if (measureState(sym).on) canvas.classList.add('measuring');
  const loading = el('div', 'chart-loading', 'טוען נתונים…');
  loading.id = 'cload-' + sym;
  cwrap.appendChild(canvas);
  cwrap.appendChild(loading);
  wrap.appendChild(cwrap);

  const hint = el('div', 'chart-hint',
    measureState(sym).on
      ? 'מצב מדידה: געו בשתי נקודות על הגרף — התשואה ביניהן תוצג. געו שוב כדי להתחיל מחדש.'
      : 'טיפ: לחצו 📏 מדידה ואז געו בשתי נקודות כדי למדוד תשואה ביניהן.');
  wrap.appendChild(hint);

  attachMeasure(canvas, sym);
  // ציור יתבצע אחרי טעינת היסטוריה (ensureChartData)
  return wrap;
}

function measureState(sym) {
  if (!state.measure[sym]) state.measure[sym] = { on: false, pts: [] };
  return state.measure[sym];
}

function weightTxt(sym) {
  const t = totalsUSD();
  const p = POSITIONS.find((x) => x.sym === sym);
  const q = state.quotes[sym];
  if (!t.stockVal || !q) return '—';
  return (q.close * p.shares / t.stockVal * 100).toFixed(1) + '%';
}

function toggleStock(sym, card) {
  state.open[sym] = !state.open[sym];
  card.classList.toggle('open', state.open[sym]);
  if (state.open[sym]) ensureChartData(sym);
}

function refreshStockBody(sym) {
  const cards = document.querySelectorAll('#stockList .stock');
  const idx = POSITIONS.findIndex((p) => p.sym === sym);
  if (idx < 0 || !cards[idx]) return;
  const card = cards[idx];
  const p = POSITIONS[idx];
  const m = metrics(sym);
  const body = card.querySelector('.stock-body');
  body.innerHTML = '';
  body.appendChild(buildStockBody(p, m));
  ensureChartData(sym);
}

async function ensureChartData(sym) {
  const loading = document.getElementById('cload-' + sym);
  const range = state.range[sym] || 'year';
  if (loading) { loading.classList.remove('hidden'); loading.textContent = 'טוען נתונים…'; }
  try {
    if (range === 'day') {
      const intra = await getIntraday(sym);
      if (intra.length) {
        drawStockChart(sym, intra, true);
        if (loading) loading.classList.add('hidden');
        return;
      }
      // נפילה לגרף יומי אם אין תוך-יומי
    }
    const hist = await getDaily(sym, false);
    const pts = drawStockChart(sym, filterRange(hist, range === 'day' ? 'month' : range), false);
    if (pts && loading) loading.classList.add('hidden');
  } catch (e) {
    if (loading) { loading.textContent = 'לא התקבלו נתוני גרף'; loading.classList.remove('hidden'); }
  }
}

/* ---------------- גרף קו ---------------- */

function chartPoints(sym, rows, intraday) {
  return downsample(rows, 400).map((r) => ({
    label: intraday && r.time ? r.time.slice(0, 5) : fmtDateIL(r.date),
    date: r.date, time: r.time, close: r.close
  }));
}

function drawStockChart(sym, rows, intraday) {
  const canvas = document.getElementById('chart-' + sym);
  const loading = document.getElementById('cload-' + sym);
  if (!canvas) return null;
  const pts = chartPoints(sym, rows, intraday);
  if (!pts.length) {
    if (loading) {
      const dbg = state.histDbg && state.histDbg[sym];
      loading.innerHTML = 'אין נתוני גרף כרגע' + (dbg ? '<br><small style="opacity:.65">' + dbg + '</small>' : '');
      loading.classList.remove('hidden');
    }
    return null;
  }
  if (loading) loading.classList.add('hidden');

  const ms = measureState(sym);
  // ולידציה של אינדקסי מדידה מול אורך עדכני
  ms.pts = ms.pts.filter((i) => i >= 0 && i < pts.length);

  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 320, h = 210;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  const padL = 6, padR = 58, padT = 10, padB = 22;
  const plotW = w - padL - padR, plotH = h - padT - padB;
  let min = Infinity, max = -Infinity;
  for (const p of pts) { if (p.close < min) min = p.close; if (p.close > max) max = p.close; }
  if (min === max) { min *= 0.99; max *= 1.01; }
  const X = (i) => padL + (pts.length === 1 ? plotW / 2 : (i / (pts.length - 1)) * plotW);
  const Y = (v) => padT + (1 - (v - min) / (max - min)) * plotH;

  const up = pts[pts.length - 1].close >= pts[0].close;
  const lineCol = up ? '#137333' : '#B3261E';

  // רשת אופקית + תוויות מחיר
  ctx.font = '11px system-ui'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  for (let g = 0; g <= 4; g++) {
    const v = min + (max - min) * g / 4;
    const y = Y(v);
    ctx.strokeStyle = '#E7ECE8'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR + 6, y); ctx.stroke();
    ctx.fillStyle = '#6B7570';
    ctx.fillText(fmtUSD2(v), w - padR + 10, y);
  }

  // מילוי שטח
  const grad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
  grad.addColorStop(0, up ? 'rgba(19,115,51,.25)' : 'rgba(179,38,30,.22)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.beginPath();
  pts.forEach((p, i) => { const x = X(i), y = Y(p.close); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
  ctx.lineTo(X(pts.length - 1), padT + plotH);
  ctx.lineTo(X(0), padT + plotH);
  ctx.closePath();
  ctx.fillStyle = grad; ctx.fill();

  // קו
  ctx.beginPath();
  pts.forEach((p, i) => { const x = X(i), y = Y(p.close); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
  ctx.strokeStyle = lineCol; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();

  // תוויות ציר זמן (עד 5)
  ctx.fillStyle = '#6B7570'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  const ticks = Math.min(5, pts.length);
  for (let k = 0; k < ticks; k++) {
    const i = Math.round(k * (pts.length - 1) / (ticks - 1 || 1));
    ctx.fillText(pts[i].label, Math.min(Math.max(X(i), 30), w - padR - 20), padT + plotH + 6);
  }

  // נקודת מדידה
  const drawMarker = (i, color) => {
    const x = X(i), y = Y(pts[i].close);
    ctx.strokeStyle = color; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, padT + plotH); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
  };
  if (ms.pts.length >= 1) drawMarker(ms.pts[0], '#1565C0');
  if (ms.pts.length >= 2) {
    drawMarker(ms.pts[1], '#1565C0');
    const a = pts[ms.pts[0]], b = pts[ms.pts[1]];
    ctx.strokeStyle = '#1565C0'; ctx.setLineDash([6, 4]); ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(X(ms.pts[0]), Y(a.close));
    ctx.lineTo(X(ms.pts[1]), Y(b.close));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // שמירת מיפוי למדידה
  canvas._chartMap = { n: pts.length, padL: padL, plotW: plotW, pts: pts };
  updateMeasureChip(sym);
  return pts;
}

function updateMeasureChip(sym) {
  const chip = document.getElementById('mchip-' + sym);
  if (!chip) return;
  const ms = measureState(sym);
  const canvas = document.getElementById('chart-' + sym);
  const pts = canvas && canvas._chartMap ? canvas._chartMap.pts : [];
  if (!ms.on || ms.pts.length < 2 || !pts.length) {
    chip.classList.add('hidden');
    chip.innerHTML = '';
    return;
  }
  const a = pts[ms.pts[0]], b = pts[ms.pts[1]];
  const ret = (b.close - a.close) / a.close * 100;
  const la = a.time ? fmtDateIL(a.date) + ' ' + a.time.slice(0, 5) : fmtDateIL(a.date);
  const lb = b.time ? fmtDateIL(b.date) + ' ' + b.time.slice(0, 5) : fmtDateIL(b.date);
  chip.classList.remove('hidden');
  chip.innerHTML =
    '<span>תשואה: <b class="' + (ret >= 0 ? 'pos' : 'neg') + '">' + fmtPct(ret, true) + '</b>' +
    ' <span style="font-weight:400">(' + la + ' ← ' + lb + ')</span></span>' +
    '<button type="button" aria-label="ניקוי מדידה">✕</button>';
  chip.querySelector('button').addEventListener('click', () => {
    ms.pts = [];
    ensureChartData(sym);
  });
}

/* מדידה בשתי נקודות — עובד עם מגע (אצבע) ועם עכבר דרך Pointer Events */
function attachMeasure(canvas, sym) {
  canvas.addEventListener('pointerdown', (e) => {
    const ms = measureState(sym);
    if (!ms.on) return;
    const map = canvas._chartMap;
    if (!map || map.n < 2) return;
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    let idx = Math.round((x - map.padL) / map.plotW * (map.n - 1));
    idx = Math.max(0, Math.min(map.n - 1, idx));
    ms.pts.push(idx);
    if (ms.pts.length > 2) ms.pts = [idx]; // געו שלישית — מתחילים מחדש
    ensureChartData(sym);
  });
}

/* ---------------- רינדור: הפקדות ---------------- */

function renderDeposits() {
  const ul = document.getElementById('depositList');
  ul.innerHTML = '';
  for (const [date, amt] of DEPOSITS) {
    const li = el('li');
    const d = el('span', 'r-date', date);
    li.appendChild(d);
    let a;
    if (amt === 0) {
      a = el('span', 'r-amt zero', '₪0');
    } else if (amt > 0) {
      a = el('span', 'r-amt in', '+₪' + amt.toLocaleString('en-US'));
      a.title = 'משיכה/תיקון';
    } else {
      a = el('span', 'r-amt out', '₪' + Math.abs(amt).toLocaleString('en-US'));
    }
    li.appendChild(a);
    ul.appendChild(li);
  }
}

/* ---------------- רינדור: פנסיה ---------------- */

function renderPension() {
  const cur = state.currency;
  const wrap = document.getElementById('pensionCards');
  wrap.innerHTML = '';
  for (const f of PENSION_FUNDS) {
    const v = cur === 'ILS' ? f.ils : f.usd;
    const card = el('div', 'card stat',
      '<div class="stat-label">' + f.name + '</div>' +
      '<div class="stat-value">' + money(v, cur) + '</div>');
    wrap.appendChild(card);
  }
  const tu = PENSION_FUNDS.reduce((a, f) => a + f.usd, 0);
  const ti = PENSION_FUNDS.reduce((a, f) => a + f.ils, 0);
  document.getElementById('pensionTotal').textContent = money(cur === 'ILS' ? ti : tu, cur);

  const ul = document.getElementById('pensionDeposits');
  ul.innerHTML = '';
  for (const r of PENSION_DEPOSITS) {
    const li = el('li');
    li.innerHTML =
      '<span><b>' + r.place + '</b><br><span class="r-date">' + r.period + '</span>' +
      (r.note ? '<br><span class="r-note">' + r.note + '</span>' : '') + '</span>' +
      '<span class="r-amt out">₪' + Math.abs(r.amount).toLocaleString('en-US') + '</span>';
    ul.appendChild(li);
  }
}

/* ---------------- כללי ---------------- */

function renderAll() {
  renderOverview();
  renderStocks();
  renderDeposits();
  renderPension();
  // ציור מחדש של גרפים פתוחים (למשל אחרי מעבר מטבע)
  for (const sym of Object.keys(state.open)) {
    if (state.open[sym]) ensureChartData(sym);
  }
}

function init() {
  // טאבים
  document.querySelectorAll('.tab').forEach((t) => {
    t.addEventListener('click', () => switchTab(t.dataset.tab));
  });
  // מטבע
  const setCur = (c) => {
    state.currency = c;
    document.getElementById('curUSD').classList.toggle('active', c === 'USD');
    document.getElementById('curILS').classList.toggle('active', c === 'ILS');
    renderAll();
  };
  document.getElementById('curUSD').addEventListener('click', () => setCur('USD'));
  document.getElementById('curILS').addEventListener('click', () => setCur('ILS'));
  // רענון
  document.getElementById('refreshBtn').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.classList.add('spinning');
    state.hist = {}; state.intra = {};
    await refreshQuotes();
    await warmHistories();
    btn.classList.remove('spinning');
  });
  // שינוי גודל — ציור מחדש של גרפים פתוחים
  let rzT = null;
  window.addEventListener('resize', () => {
    clearTimeout(rzT);
    rzT = setTimeout(() => {
      drawPie();
      for (const sym of Object.keys(state.open)) {
        if (state.open[sym]) ensureChartData(sym);
      }
    }, 250);
  });

  // Service Worker (רק בהקשר מאובטח, לא file://)
  if ('serviceWorker' in navigator && /^https?:$/.test(window.location.protocol)) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }

  renderAll();
  refreshQuotes().then(() => warmHistories());
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', init);
}
