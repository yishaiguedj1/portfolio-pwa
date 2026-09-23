'use strict';
/* ============================================================
 * תיק ההשקעות — PWA עצמאית
 * נתונים סטטיים: פוזיציות, הפקדות, פנסיה (מהגיליון, 2026-09-22)
 * מחירים חיים: Yahoo (ראשי) ← CNBC (גיבוי), דיליי ~15 דקות
 * היסטוריה לגרפים: Twelve Data (ראשי; מפתח חינמי נשמר בטלפון) ← Yahoo ← Stooq
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

/* ---------------- Twelve Data (היסטוריה לגרפים) ---------------- */
/* עובד ישירות מהדפדפן (CORS מאושר), זמן אמת בחינם.
   דורש מפתח חינמי — נשמר ב־localStorage בטלפון בלבד, לעולם לא בקוד/בריפו. */
const LS_TDKEY = 'pwa_tdkey_v1';
const LS_INTRA = 'pwa_intra_v1_'; // + sym — מטמון תוך־יומי קצר (10 דקות)

function tdKey() {
  try { return (localStorage.getItem(LS_TDKEY) || '').trim(); } catch (e) { return ''; }
}

const tdURL = (sym, interval, outputsize) =>
  'https://api.twelvedata.com/time_series?symbol=' + encodeURIComponent(sym.toUpperCase()) +
  '&interval=' + interval + '&outputsize=' + outputsize +
  '&timezone=America/New_York&order=ASC&apikey=' + encodeURIComponent(tdKey());

/* מפענח תשובת Twelve Data time_series לשורות הגרף.
   withTime=true לגרף תוך־יומי (datetime כולל שעה, שעון ניו־יורק). */
function parseTwelveBars(json, withTime) {
  const rows = [];
  try {
    const vals = json && json.values;
    if (!Array.isArray(vals)) return rows;
    for (const v of vals) {
      if (!v || typeof v !== 'object') continue;
      const close = pf(v.close);
      if (!(close > 0)) continue;
      const m = String(v.datetime || '').match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}))?/);
      if (!m) continue;
      rows.push({
        date: m[1],
        time: withTime ? (m[2] || null) : null,
        open: pf(v.open),
        high: pf(v.high),
        low: pf(v.low),
        close: close,
        volume: parseInt(v.volume, 10) || 0
      });
    }
  } catch (e) {}
  rows.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    const ta = a.time || '', tb = b.time || '';
    return ta < tb ? -1 : ta > tb ? 1 : 0;
  });
  return rows;
}

/* מגבלת התוכנית החינמית: 8 קריאות/דקה — מרווחים קריאות כדי לא להיחסם (429) */
let tdLastAt = 0;
function tdThrottle() {
  const now = Date.now();
  const wait = 8000 - (now - tdLastAt);
  tdLastAt = Math.max(now, tdLastAt + 8000);
  return wait > 0 ? new Promise((r) => setTimeout(r, wait)) : Promise.resolve();
}

/* ניסיון אחד להביא נרות מ־Twelve Data.
   kind: 'daily' | 'intraday'. מחזיר rows, null, או 'BADKEY' כשהמפתח לא תקין. */
async function fetchTwelveBars(sym, kind, wantMax, notes) {
  if (!tdKey()) return null;
  await tdThrottle();
  const intraday = kind === 'intraday';
  const url = tdURL(sym, intraday ? '5min' : '1day', intraday ? 250 : (wantMax ? 5000 : 1500));
  try {
    const json = await fetchJSONTimeout(url, 15000);
    if (json && (json.status === 'error' || (json.code && json.code >= 400))) {
      const msg = String((json && json.message) || json.code || 'שגיאה');
      notes.push('TwelveData: ' + msg.slice(0, 60));
      if (json.code === 401 || /invalid|unauthorized|api\s?key/i.test(msg)) return 'BADKEY';
      return null;
    }
    const rows = parseTwelveBars(json, intraday);
    if (rows.length) return rows;
    notes.push('TwelveData: החזיר ריק');
  } catch (e) {
    // מפתח לא תקין מגיע כ־HTTP 401 (זריקה), לא כ־JSON
    if (e && /http 401/.test(e.message || '')) {
      notes.push('TwelveData: המפתח לא התקבל (401)');
      return 'BADKEY';
    }
    notes.push('TwelveData: ' + netErrName(e));
  }
  return null;
}

/* מפתח לא תקין — מוחקים אותו מהטלפון ומציגים שוב את כרטיס ההזנה */
function clearTdKey(notes) {
  try { localStorage.removeItem(LS_TDKEY); } catch (e) {}
  notes.push('TwelveData: המפתח לא תקין — צריך להזין מפתח חדש');
  switchTab('settings');
  renderTdKeyStatus();
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
    case '3y':    return rows.slice(-756);
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

/* ---------------- נתוני ברירת מחדל — תיק דוגמה פיקטיבי ---------------- */
/* נשמרים בטלפון (localStorage) וניתנים לעריכה מהאפליקציה. */

/* מסד הנתונים המקומי — נטען פעם אחת, נשמר אחרי כל שינוי */
const LS_DB = 'pwa_db_v1';

/* תיק דוגמה — מה שמוצג למי שלא התחבר או למשתמש חדש במצב מקומי.
   הנתונים האמיתיים נשמרים רק בענן, בחשבון הפרטי של כל משתמש. */
const DEFAULT_DB = {
  v: 1,
  positions: [
    { sym: 'GOOGL', name: 'גוגל', full: 'Alphabet Inc',      shares: 10, avg: 140.00 },
    { sym: 'META',  name: 'מטא',  full: 'Meta Platforms Inc', shares: 5,  avg: 480.00 }
  ],
  deposits: [{ date: '01/01/2026', amount: -1000, place: 'הפקדת דוגמה' }],
  pensionFunds: [{ name: 'פנסיה — מקום עבודה', usd: 0, ils: 1000 }],
  pensionDeposits: [],
  cash: { usd: 100, ils: 100 }
};

/* גרסת האפליקציה — מוצגת בהגדרות כדי לוודא שהטלפון מעודכן */
const APP_VERSION = 'v20';


function saveDBto(db) {
  try { localStorage.setItem(LS_DB, JSON.stringify(db)); } catch (e) {}
}
function loadDB() {
  try {
    const raw = localStorage.getItem(LS_DB);
    if (raw) {
      const db = JSON.parse(raw);
      if (db && db.v === 1 && Array.isArray(db.positions) && Array.isArray(db.deposits)) {
        if (!db.cash) db.cash = { usd: 0, ils: 0 };
        return db;
      }
    }
  } catch (e) {}
  const db = JSON.parse(JSON.stringify(DEFAULT_DB));
  saveDBto(db);
  return db;
}
const DB = loadDB();
function saveDB() { saveDBto(DB); if (window.__cloudSave) window.__cloudSave(); }

/* תיק דוגמה — למי שאין לו נתונים: משתמש חדש, אחרי איפוס, או לא מחובר */
function demoDb() {
  return JSON.parse(JSON.stringify(DEFAULT_DB));
}

/* מחיל נתונים על ה-DB החי — במקום, כדי לא לשבור הפניות קיימות */
function applyDbData(data) {
  const clean = JSON.parse(JSON.stringify(data || {}));
  if (!Array.isArray(DB.positions)) DB.positions = [];
  if (!Array.isArray(DB.deposits)) DB.deposits = [];
  if (!Array.isArray(DB.pensionFunds)) DB.pensionFunds = [];
  if (!Array.isArray(DB.pensionDeposits)) DB.pensionDeposits = [];
  DB.positions.length = 0;
  if (Array.isArray(clean.positions)) DB.positions.push(...clean.positions);
  DB.deposits.length = 0;
  if (Array.isArray(clean.deposits)) DB.deposits.push(...clean.deposits);
  DB.pensionFunds.length = 0;
  if (Array.isArray(clean.pensionFunds)) DB.pensionFunds.push(...clean.pensionFunds);
  DB.pensionDeposits.length = 0;
  if (Array.isArray(clean.pensionDeposits)) DB.pensionDeposits.push(...clean.pensionDeposits);
  const c = clean.cash || {};
  DB.cash = { usd: num(c.usd) || 0, ils: num(c.ils) || 0 };
  saveDBto(DB);
}

/* שמות תואמים לקוד הקיים — מצביעים לאותם מערכים; עריכה תמיד במקום (push/splice) */
let POSITIONS = DB.positions;
let DEPOSITS = DB.deposits;
let PENSION_FUNDS = DB.pensionFunds;
let PENSION_DEPOSITS = DB.pensionDeposits;

/* סך הפקדות נטו — מחושב מהרשומות (סכום שלילי = כסף שנכנס לתיק) */
function netDepositsILS() {
  return -DEPOSITS.reduce((a, d) => a + (num(d.amount) || 0), 0);
}

/* מזומן במטבע התצוגה */
function cashInCur(cur) {
  const c = (DB && DB.cash) || { usd: 0, ils: 0 };
  if (cur === 'ILS' && state.fx) return (c.ils || 0) + (c.usd || 0) * state.fx;
  return (c.usd || 0) + (state.fx && c.ils ? c.ils / state.fx : 0);
}

/* ---------------- מקורות נתונים ---------------- */
/* מחירים חיים: Yahoo (ראשי) ← CNBC (גיבוי). היסטוריה ומסחר מורחב: Twelve Data (ראשי) ← Yahoo ← Stooq. */

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
  source: null,     // מאיזה מקור הגיעו המחירים (Yahoo / CNBC)
  quotesAt: null,
  stale: false,     // מוצגים נתונים שמורים (אין חיבור)
  hist: {},         // sym -> daily rows
  intra: {},        // sym -> intraday rows (יום)
  histDbg: {},      // sym -> מה קרה בניסיון להביא היסטוריה (לאבחון)
  open: {},         // sym -> bool (שורה פתוחה)
  range: {},        // sym -> 'day'|'week'|'month'|'ytd'|'year'|'5y'|'max'
  measure: {},      // sym -> { on, pts:[idxA, idxB] }
  pfRange: '5y',    // טווח גרף ביצועי התיק
  edit: { stocks: false, deposits: false, pension: false }  // מצב עריכה (מוגן מטעויות)
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
/* סדר הניסיון: Yahoo ← CNBC ← נתונים שמורים. */

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

/* --- כתובת CNBC (גיבוי; נבנית מחדש אחרי כל שינוי ברשימת המניות) --- */
const cnbcURL = () =>
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

async function tryFx() {
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
    fetchJSONTimeout(cnbcURL(), 10000),
    tryFx()
  ]);
  const q = parseCNBCQuotes(json);
  const missing = POSITIONS.filter((p) => !q[p.sym]).length;
  if (missing > Math.max(1, Math.floor(POSITIONS.length / 2))) throw new Error('too few quotes');
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
  if (missing > Math.max(1, Math.floor(POSITIONS.length / 2))) throw new Error('too few quotes');
  const fx = await tryFx();
  return { quotes: q, fx: fx, source: 'Yahoo' };
}

async function refreshQuotes() {
  if (!POSITIONS.length) {
    try { state.fx = await tryFx(); } catch (e) { /* אין שער */ }
    state.quotes = {};
    state.quotesAt = Date.now();
    state.source = state.fx ? 'שער חליפין' : null;
    state.stale = false;
    setBanner('');
    updateSourceLabel();
    renderAll();
    return;
  }
  // מרוץ מקורות: Yahoo ו־CNBC במקביל — מי שמגיב ראשון מנצח.
  // ככה לא מחכים ל-timeout של מקור חסום ברשת של המשתמש.
  try {
    const res = await Promise.any([tryYahooQuotes(), tryCNBCQuotes()]);
    applyQuotes(res); renderAll(); return;
  } catch (e) { /* שניהם נכשלו — נופלים לנתונים שמורים */ }
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
  const td = await fetchTwelveBars(sym, 'daily', wantMax, notes);
  if (td === 'BADKEY') clearTdKey(notes);
  else if (td) return save(td);
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
  // מטמון קצר (10 דקות) לחיסכון במכסת הקריאות החינמית
  const cached = lsGet(LS_INTRA + sym);
  if (cached && cached.rows && cached.rows.length && (Date.now() - cached.at) < 10 * 60 * 1000) {
    state.intra[sym] = cached.rows;
    return cached.rows;
  }
  const notes = [];
  const td = await fetchTwelveBars(sym, 'intraday', false, notes);
  if (td === 'BADKEY') clearTdKey(notes);
  else if (td) {
    state.intra[sym] = td;
    lsSet(LS_INTRA + sym, { at: Date.now(), rows: td });
    return td;
  }
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
  // SPY = בנצ'מרק S&P 500, QQQ = נאסד"ק 100 (להשוואת ביצועים מותאמת הפקדות)
  await pool(POSITIONS.map((p) => p.sym).concat(['SPY', 'QQQ']), 3, (sym) => getDaily(sym, false));
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
  const usd = (DB.cash && DB.cash.usd) || 0;
  const ils = (DB.cash && DB.cash.ils) || 0;
  return { stockVal: stockVal, total: stockVal + usd + (state.fx ? ils / state.fx : 0) };
}

function depositsInCur() {
  const nd = netDepositsILS();
  return state.currency === 'ILS' ? nd : (state.fx ? nd / state.fx : null);
}

/* ---------------- DOM ---------------- */

function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

function flash(msg) {
  let t = document.getElementById('toast');
  if (!t) {
    t = el('div', 'toast');
    t.id = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), 2200);
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
    'מניות: ' + money(stockVal, cur) + ' · מזומן: ' + money(cashInCur(cur), cur);

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
  drawPfChart();
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

/* ---------------- גרף ביצועי התיק + בנצ'מרק S&P 500 ---------------- */

const PF_RANGES = [['year', 'שנה'], ['3y', '3 שנים'], ['5y', '5 שנים'], ['max', 'מקסימום']];

/* מחיר סגירה אחרון עד תאריך נתון (היסטוריה ממוינת ישן -> חדש) */
function closeOnOrBefore(hist, date) {
  let lo = 0, hi = hist.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (hist[mid].date <= date) { ans = mid; lo = mid + 1; }
    else hi = mid - 1;
  }
  return ans >= 0 ? hist[ans].close : null;
}


/* ---------------- היסטוריית שער דולר־שקל (לבנצ'מרק מותאם הפקדות) ---------------- */
/* מקור חינמי, בלי מפתח: Frankfurter. נשמר לצמיתות — היסטוריה לא משתנה. */
const LS_FXHIST = 'pwa_fxhist_v1';
let fxHistCache = null; // {dates:[iso], rates:{iso:rate}}

function parseDepDate(dstr) { // 'DD/MM/YYYY' -> 'YYYY-MM-DD'
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(dstr || '').trim());
  if (!m) return null;
  const iso = m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
  return isNaN(new Date(iso + 'T12:00:00Z')) ? null : iso;
}

function addDaysISO(iso, n) {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function ensureFxHist() {
  if (fxHistCache) return fxHistCache;
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(LS_FXHIST) || 'null'); } catch (e) {}
  const today = todayISO();
  let earliest = null;
  for (const d of DEPOSITS) {
    const iso = parseDepDate(d.date);
    if (iso && (!earliest || iso < earliest)) earliest = iso;
  }
  if (!earliest) earliest = addDaysISO(today, -5 * 365);
  const have = (saved && saved.rates) || {};
  const haveDates = Object.keys(have).sort();
  const lastHave = haveDates.length ? haveDates[haveDates.length - 1] : null;
  const rates = Object.assign({}, have);
  const fetchFrom = (lastHave && lastHave >= earliest) ? addDaysISO(lastHave, 1) : earliest;
  if (fetchFrom <= today) {
    let ok = false;
    try {
      const j = await fetchJSONTimeout(
        'https://api.frankfurter.dev/v1/' + fetchFrom + '..' + today + '?base=USD&symbols=ILS', 25000);
      if (j && j.rates) {
        for (const [dt, r] of Object.entries(j.rates)) if (r && r.ILS > 0) rates[dt] = r.ILS;
        ok = true;
      }
    } catch (e) { /* גיבוי: Twelve Data */ }
    if (!ok && tdKey()) {
      try {
        const rows = parseTwelveBars(await fetchJSONTimeout(tdURL('USD/ILS', '1day', 5000), 25000), false);
        for (const r of rows) if (r.date >= fetchFrom && r.close > 0) rates[r.date] = r.close;
        ok = rows.length > 0;
      } catch (e) {}
    }
    if (ok) {
      try { localStorage.setItem(LS_FXHIST, JSON.stringify({ rates: rates })); } catch (e) {}
    }
  }
  fxHistCache = { dates: Object.keys(rates).sort(), rates: rates };
  return fxHistCache;
}

/* שער דולר־שקל ביום נתון (או יום העסקים הקודם — סופ"ש/חג) */
function fxOnOrBefore(iso) {
  const c = fxHistCache;
  if (!c || !c.dates.length) return state.fx || null;
  let lo = 0, hi = c.dates.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (c.dates[mid] <= iso) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans >= 0 ? c.rates[c.dates[ans]] : null;
}

/* ---------------- בנצ'מרק מותאם הפקדות (בשקלים) ---------------- */
/* מדמה: כל הפקדה אמיתית קונה את המדד באותו יום, בשער הדולר של אותו יום. */
function buildIndexBenchmark(sym) {
  const hist = state.hist[sym] || [];
  if (!hist.length || !fxHistCache || !fxHistCache.dates.length) return null;
  const deps = [];
  for (const d of DEPOSITS) {
    const amt = -(num(d.amount) || 0); // חיובי = כסף שנכנס
    if (!amt) continue;
    deps.push({ date: parseDepDate(d.date), amt: amt });
  }
  if (!deps.length) return null;
  let startD = null;
  for (const d of deps) if (d.date && (!startD || d.date < startD)) startD = d.date;
  if (!startD) startD = hist[0].date;
  for (const d of deps) if (!d.date) d.date = startD; // תאריך לא תקין -> להתחלה
  deps.sort((a, b) => a.date.localeCompare(b.date));
  let shares = 0, di = 0, invested = 0;
  const series = [];
  for (const row of hist) {
    if (row.date < startD) continue;
    while (di < deps.length && deps[di].date <= row.date) {
      const dep = deps[di++];
      const fx = fxOnOrBefore(dep.date);
      const px = closeOnOrBefore(hist, dep.date);
      if (fx && px && px > 0) shares += (dep.amt / fx) / px; // משיכה מקטינה מניות
      invested += dep.amt;
    }
    if (shares > 0) {
      const fx = fxOnOrBefore(row.date) || state.fx;
      if (fx) series.push({ date: row.date, value: shares * row.close * fx });
    }
  }
  if (!series.length || !(invested > 0)) return null;
  return { series: series, invested: invested, retPct: (series[series.length - 1].value / invested - 1) * 100 };
}

/* סדרת שווי התיק בשקלים לאורך זמן (אחזקות נוכחיות + מזומן).
   מגבלה ידועה: אין יומן קניות היסטורי, אז מניחים את האחזקות הנוכחיות לאורך כל התקופה. */
function portfolioSeriesILS() {
  const dates = new Set();
  for (const p of POSITIONS) for (const r of (state.hist[p.sym] || [])) dates.add(r.date);
  if (!dates.size) return [];
  const cashU = (DB.cash && DB.cash.usd) || 0;
  const cashI = (DB.cash && DB.cash.ils) || 0;
  const out = [];
  for (const d of [...dates].sort()) {
    const fx = fxOnOrBefore(d) || state.fx;
    if (!fx) continue;
    let v = cashI + cashU * fx;
    for (const p of POSITIONS) {
      const c = closeOnOrBefore(state.hist[p.sym] || [], d);
      if (c) v += c * p.shares * fx;
    }
    out.push({ date: d, value: v });
  }
  return out;
}

/* סך תשואת הפנסיה — מספר בודד (אין היסטוריית שווי יומית לקרנות) */
function pensionReturnPct() {
  const fx = state.fx;
  let val = 0;
  for (const f of PENSION_FUNDS) val += (num(f.ils) || 0) + (fx ? (num(f.usd) || 0) * fx : 0);
  const dep = -PENSION_DEPOSITS.reduce((a, r) => a + (num(r.amount) || 0), 0);
  if (!(dep > 0)) return null;
  return (val / dep - 1) * 100;
}

function renderPfChips() {
  const box = document.getElementById('pfChips');
  if (!box || box.children.length) return;
  for (const [key, label] of PF_RANGES) {
    const b = el('button', 'range-btn' + (state.pfRange === key ? ' active' : ''), label);
    b.type = 'button';
    b.addEventListener('click', () => {
      state.pfRange = key;
      box.querySelectorAll('.range-btn').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      drawPfChart();
    });
    box.appendChild(b);
  }
}

/* גרף ביצועי התיק מול מדדים — כולם בשקלים, המדדים מותאמי הפקדות */
let pfChartToken = 0;
async function drawPfChart() {
  const canvas = document.getElementById('pfChart');
  const loading = document.getElementById('pfLoading');
  const legend = document.getElementById('pfLegend');
  if (!canvas) return;
  renderPfChips();
  const my = ++pfChartToken;
  const alive = () => my === pfChartToken;
  if (loading) {
    loading.textContent = tdKey() ? 'טוען נתוני היסטוריה…' : 'הגרף דורש מפתח נתונים (לשונית הגדרות)';
    loading.classList.remove('hidden');
  }

  await ensureFxHist();
  if (!alive()) return;

  const pfFull = portfolioSeriesILS();
  const pf = filterRange(pfFull, state.pfRange);
  const spyB = buildIndexBenchmark('SPY');
  const qqqB = buildIndexBenchmark('QQQ');
  const spy = spyB ? filterRange(spyB.series, state.pfRange) : [];
  const qqq = qqqB ? filterRange(qqqB.series, state.pfRange) : [];
  if (!alive()) return;

  // סך תשואה: התיק לפי שווי חי, המדדים לפי סוף הסדרה, הפנסיה כמספר בודד
  const t = totalsUSD();
  const totalILS = state.fx ? t.total * state.fx : null;
  const depILS = netDepositsILS();
  const pfRet = (totalILS !== null && depILS > 0) ? (totalILS / depILS - 1) * 100 : null;
  const penRet = pensionReturnPct();

  if (!pf.length) {
    if (loading) { loading.textContent = 'אין נתוני גרף כרגע'; loading.classList.remove('hidden'); }
    if (legend) legend.innerHTML = '';
    return;
  }
  if (loading) loading.classList.add('hidden');

  const pfD = downsample(pf, 300), spyD = downsample(spy, 300), qqqD = downsample(qqq, 300);

  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 320, h = 210;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  const all = pfD.concat(spyD, qqqD);
  let min = Infinity, max = -Infinity;
  for (const p of all) { if (p.value < min) min = p.value; if (p.value > max) max = p.value; }
  if (min === max) { min *= 0.99; max *= 1.01; }
  const padL = 6, padR = 46, padT = 10, padB = 22;
  const plotW = w - padL - padR, plotH = h - padT - padB;
  const X = (i, n) => padL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const Y = (v) => padT + (1 - (v - min) / (max - min)) * plotH;

  ctx.font = '11px system-ui'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.strokeStyle = '#E3E7E4'; ctx.fillStyle = '#9AA5A0';
  for (let g = 0; g <= 4; g++) {
    const v = min + (max - min) * g / 4;
    const y = Y(v);
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
    ctx.fillText(v >= 1000 ? (v / 1000).toFixed(1) + 'K' : v.toFixed(0), w - padR + 6, y);
  }
  ctx.textAlign = 'center';
  const step = Math.max(1, Math.floor(pfD.length / 4));
  for (let i = 0; i < pfD.length; i += step) {
    ctx.fillText(fmtDateIL(pfD[i].date).slice(3), X(i, pfD.length), h - 8);
  }

  const drawLine = (series, color, width) => {
    if (series.length < 2) return;
    ctx.beginPath();
    series.forEach((p, i) => {
      const x = X(i, series.length), y = Y(p.value);
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    });
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
  };
  if (spyD.length) drawLine(spyD, '#1A73E8', 1.5);
  if (qqqD.length) drawLine(qqqD, '#9334E6', 1.5);
  drawLine(pfD, '#006A4E', 2.5);

  if (legend) {
    const cls = (v) => v === null ? '' : v >= 0 ? 'pos' : 'neg';
    const row = (color, name, v, extra) =>
      '<li><span class="dot" style="background:' + color + '"></span>' +
      '<span class="lg-name">' + name + (extra || '') + '</span>' +
      '<span class="lg-pct ' + cls(v) + '">' + (v === null ? '—' : fmtPct(v, true)) + '</span></li>';
    legend.innerHTML =
      row('#006A4E', 'התיק שלי', pfRet) +
      (spyB ? row('#1A73E8', 'S&P 500', spyB.retPct) : '') +
      (qqqB ? row('#9334E6', 'נאסד״ק 100', qqqB.retPct) : '') +
      row('#F29900', 'פנסיה', penRet, ' <small style="opacity:.6">(סך הכל)</small>');
  }
}

/* ---------------- רינדור: מניות ---------------- */

function renderStocks() {
  const list = document.getElementById('stockList');
  list.innerHTML = '';
  const sc = document.getElementById('stockCount');
  if (sc) sc.textContent = POSITIONS.length;
  if (state.edit.stocks) {
    const add = el('button', 'card add-card');
    add.type = 'button';
    add.innerHTML = '<span class="add-plus">＋</span> הוספת מניה';
    add.addEventListener('click', () => showAddPositionForm(list));
    list.appendChild(add);
  }
  if (!POSITIONS.length && !state.edit.stocks) {
    const m = el('p', 'fine');
    m.style.padding = '0';
    m.textContent = 'אין מניות בתיק. הפעילו ✏️ עריכה כדי להוסיף.';
    list.appendChild(m);
  }
  for (const p of POSITIONS) {
    list.appendChild(buildStockCard(p));
  }
}

/* ולידציה למניה (טהורה — ניתנת לבדיקה) */
function validPosition(sym, shares, avg, ignoreSym) {
  const s = String(sym || '').trim().toUpperCase();
  if (!/^[A-Z.]{1,8}$/.test(s)) return 'סימול לא תקין — אותיות באנגלית בלבד';
  if (ignoreSym !== s && POSITIONS.some((p) => p.sym === s)) return 'המניה כבר קיימת בתיק';
  if (!(shares > 0)) return 'כמות המניות חייבת להיות חיובית';
  if (!(avg > 0)) return 'מחיר הקנייה חייב להיות חיובי';
  return null;
}

/* טופס עריכת כמות ומחיר קנייה בתוך כרטיס המניה */
function showEditPositionForm(card, p) {
  const body = card.querySelector('.stock-body');
  card.classList.add('open');
  body.innerHTML =
    '<div class="form-grid">' +
    '<label>כמות מניות<input id="ep-shares" type="number" min="0" step="any" inputmode="decimal" value="' + p.shares + '"></label>' +
    '<label>מחיר קנייה ממוצע ($)<input id="ep-avg" type="number" min="0" step="any" inputmode="decimal" value="' + p.avg + '"></label>' +
    '</div>' +
    '<div class="form-err hidden" id="ep-err"></div>' +
    '<div class="edit-actions"><button class="btn" id="ep-save" type="button">שמור</button>' +
    '<button class="link-btn" id="ep-cancel" type="button">ביטול</button></div>';
  body.querySelector('#ep-cancel').addEventListener('click', () => refreshStockBody(p.sym));
  body.querySelector('#ep-save').addEventListener('click', () => {
    const shares = parseFloat(body.querySelector('#ep-shares').value);
    const avg = parseFloat(body.querySelector('#ep-avg').value);
    const err = validPosition(p.sym, shares, avg, p.sym);
    const errEl = body.querySelector('#ep-err');
    if (err) { errEl.textContent = err; errEl.classList.remove('hidden'); return; }
    p.shares = shares;
    p.avg = avg;
    saveDB();
    refreshStockBody(p.sym);
    renderOverview();
    flash('נשמר ✓');
  });
}

/* טופס הוספת מניה חדשה */
function showAddPositionForm(list) {
  if (document.getElementById('addPosForm')) return;
  const card = el('div', 'card');
  card.id = 'addPosForm';
  card.innerHTML =
    '<h2>הוספת מניה</h2>' +
    '<div class="form-grid">' +
    '<label>סימול (אנגלית)<input id="ap-sym" type="text" dir="ltr" placeholder="NVDA" autocomplete="off"></label>' +
    '<label>שם בעברית<input id="ap-name" type="text" placeholder="אנבידיה"></label>' +
    '<label>שם מלא (אופציונלי)<input id="ap-full" type="text" dir="ltr" placeholder="NVIDIA Corp" autocomplete="off"></label>' +
    '<label>כמות מניות<input id="ap-shares" type="number" min="0" step="any" inputmode="decimal"></label>' +
    '<label>מחיר קנייה ממוצע ($)<input id="ap-avg" type="number" min="0" step="any" inputmode="decimal"></label>' +
    '</div>' +
    '<div class="form-err hidden" id="ap-err"></div>' +
    '<div class="edit-actions"><button class="btn" id="ap-save" type="button">הוסף מניה</button>' +
    '<button class="link-btn" id="ap-cancel" type="button">ביטול</button></div>';
  list.insertBefore(card, list.firstChild);
  card.querySelector('#ap-cancel').addEventListener('click', () => card.remove());
  card.querySelector('#ap-save').addEventListener('click', () => {
    const sym = card.querySelector('#ap-sym').value.trim().toUpperCase();
    const name = card.querySelector('#ap-name').value.trim() || sym;
    const full = card.querySelector('#ap-full').value.trim();
    const shares = parseFloat(card.querySelector('#ap-shares').value);
    const avg = parseFloat(card.querySelector('#ap-avg').value);
    const err = validPosition(sym, shares, avg, null);
    const errEl = card.querySelector('#ap-err');
    if (err) { errEl.textContent = err; errEl.classList.remove('hidden'); return; }
    POSITIONS.push({ sym: sym, name: name, full: full, shares: shares, avg: avg });
    saveDB();
    card.remove();
    renderAll();
    flash('המניה נוספה ✓');
    refreshQuotes().then(() => warmHistories());
  });
}

function deletePosition(p) {
  if (!confirm('למחוק את ' + p.name + ' (' + p.sym + ') מהתיק?\nגם נתוני הגרף השמורים שלה יימחקו.')) return;
  const i = POSITIONS.findIndex((x) => x.sym === p.sym);
  if (i >= 0) POSITIONS.splice(i, 1);
  delete state.hist[p.sym];
  delete state.intra[p.sym];
  delete state.quotes[p.sym];
  delete state.open[p.sym];
  delete state.range[p.sym];
  try {
    localStorage.removeItem(LS_HIST + p.sym);
    localStorage.removeItem(LS_INTRA + p.sym);
  } catch (e) {}
  saveDB();
  renderAll();
  flash('המניה נמחקה ✓');
  refreshQuotes().then(() => warmHistories());
}

function buildStockCard(p) {
  const sym = p.sym;
  const m = metrics(sym);
  const cur = state.currency;
  const priceTxt = m.price === null ? '—' : (cur === 'ILS' && state.fx ? fmtILS(m.price * state.fx) : fmtUSD2(m.price));

  const card = el('div', 'stock' + (state.open[sym] ? ' open' : ''));
  card.dataset.sym = sym;
  const head = el('button', 'stock-head');
  head.type = 'button';
  head.innerHTML =
    '<span class="stock-id"><span class="stock-sym">' + sym + '</span>' +
    '<span class="stock-name">' + esc(p.name) + '</span></span>' +
    '<span class="stock-price">' + priceTxt + '</span>' +
    '<span class="stock-sub"><span class="day-chg ' + (m.dayChg === null ? '' : m.dayChg >= 0 ? 'pos' : 'neg') + '">' +
    (m.dayChg === null ? '—' : 'היום ' + fmtPct(m.dayChg, true)) + '</span>' +
    '<span>' + (m.value === null ? '—' : money(cur === 'ILS' && state.fx ? m.value * state.fx : m.value, cur)) +
    ' <span class="chev">▾</span></span></span>';
  head.addEventListener('click', () => toggleStock(sym, card));
  card.appendChild(head);

  // מצב עריכה: כפתורי עריכה/מחיקה מתחת לכותרת הכרטיס
  if (state.edit.stocks) {
    const actions = el('div', 'edit-actions');
    const eb = el('button', 'chip-btn', '✏️ ערוך');
    eb.type = 'button';
    eb.addEventListener('click', (ev) => { ev.stopPropagation(); showEditPositionForm(card, p); });
    const dbtn = el('button', 'chip-btn danger', '🗑 מחק');
    dbtn.type = 'button';
    dbtn.addEventListener('click', (ev) => { ev.stopPropagation(); deletePosition(p); });
    actions.appendChild(eb);
    actions.appendChild(dbtn);
    card.appendChild(actions);
  }

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
  const card = document.querySelector('#stockList .stock[data-sym="' + sym + '"]');
  const p = POSITIONS.find((x) => x.sym === sym);
  if (!card || !p) return;
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

/* ---------------- עריכת הפקדות ---------------- */

/* המרת תאריך DD/MM/YYYY <-> YYYY-MM-DD (לטופס תאריך) */
function dateToInput(s) {
  const m = String(s || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? m[3] + '-' + m[2] + '-' + m[1] : '';
}
function dateFromInput(s) {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? m[3] + '/' + m[2] + '/' + m[1] : '';
}
function validDeposit(dateStr, amount) {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr || '')) return 'תאריך לא תקין';
  if (!(amount > 0)) return 'הסכום חייב להיות חיובי';
  return null;
}

function depositAmountHTML(amt) {
  if (amt === 0) return '<span class="r-amt zero">₪0</span>';
  if (amt > 0) return '<span class="r-amt in" title="משיכה/תיקון">+₪' + amt.toLocaleString('en-US') + '</span>';
  return '<span class="r-amt out">₪' + Math.abs(amt).toLocaleString('en-US') + '</span>';
}

function renderDeposits() {
  const nd = netDepositsILS();
  const ndTxt = '₪' + Math.abs(nd).toLocaleString('en-US');
  document.getElementById('depTotal').textContent = ndTxt;
  document.getElementById('depCount').textContent = DEPOSITS.length + ' רשומות';
  const nt = document.getElementById('noteDepTotal');
  if (nt) nt.textContent = ndTxt;
  const ul = document.getElementById('depositList');
  ul.innerHTML = '';
  const ed = state.edit.deposits;
  if (ed) {
    const addLi = el('li');
    const addBtn = el('button', 'chip-btn', '＋ הוספת הפקדה');
    addBtn.type = 'button';
    addBtn.addEventListener('click', () => showAddDepositForm(ul));
    addLi.appendChild(addBtn);
    ul.appendChild(addLi);
  }
  DEPOSITS.forEach((d, i) => ul.appendChild(buildDepositRow(d, i, ed)));
}

function buildDepositRow(d, i, ed) {
  const li = el('li');
  li.dataset.depIdx = i;
  const main = el('span');
  main.innerHTML = '<span class="r-date">' + d.date + '</span>' +
    (d.place ? '<br><span class="r-note">' + esc(d.place) + '</span>' : '');
  li.appendChild(main);
  const wrap = el('span');
  wrap.innerHTML = depositAmountHTML(d.amount);
  li.appendChild(wrap);
  if (ed) {
    const actions = el('span', 'row-actions');
    const eb = el('button', 'mini-btn', 'ערוך');
    eb.type = 'button';
    eb.addEventListener('click', () => showEditDepositForm(li, d, i));
    const dbtn = el('button', 'mini-btn danger', 'מחק');
    dbtn.type = 'button';
    dbtn.addEventListener('click', () => deleteDeposit(i));
    actions.appendChild(eb);
    actions.appendChild(dbtn);
    li.appendChild(actions);
  }
  return li;
}

/* טופס עריכת הפקדה — בתוך שורת הרשימה */
function depositFormHTML(d, idp) {
  const isOut = d.amount > 0;
  return '<div class="form-grid">' +
    '<label>תאריך<input id="' + idp + '-date" type="date" value="' + dateToInput(d.date) + '"></label>' +
    '<label>סוג<select id="' + idp + '-type">' +
      '<option value="in"' + (!isOut ? ' selected' : '') + '>הפקדה (כסף נכנס)</option>' +
      '<option value="out"' + (isOut ? ' selected' : '') + '>משיכה (כסף יוצא)</option>' +
    '</select></label>' +
    '<label>סכום (₪)<input id="' + idp + '-amt" type="number" min="0" step="any" inputmode="decimal" value="' + Math.abs(d.amount) + '"></label>' +
    '<label>חברה / הערה<input id="' + idp + '-place" type="text" value="' + esc(d.place || '') + '" placeholder="אופציונלי"></label>' +
    '</div>' +
    '<div class="form-err hidden" id="' + idp + '-err"></div>' +
    '<div class="edit-actions"><button class="btn" id="' + idp + '-save" type="button">שמור</button>' +
    '<button class="link-btn" id="' + idp + '-cancel" type="button">ביטול</button></div>';
}

function readDepositForm(box, idp) {
  const date = dateFromInput(box.querySelector('#' + idp + '-date').value);
  const type = box.querySelector('#' + idp + '-type').value;
  const amount = parseFloat(box.querySelector('#' + idp + '-amt').value);
  const place = box.querySelector('#' + idp + '-place').value.trim();
  const err = validDeposit(date, amount);
  if (err) return { err: err };
  return { date: date, amount: type === 'out' ? Math.abs(amount) : -Math.abs(amount), place: place };
}

function showEditDepositForm(li, d, i) {
  const idp = 'de' + i;
  li.classList.add('form-li');
  li.innerHTML = depositFormHTML(d, idp);
  li.querySelector('#' + idp + '-cancel').addEventListener('click', () => renderDeposits());
  li.querySelector('#' + idp + '-save').addEventListener('click', () => {
    const r = readDepositForm(li, idp);
    const errEl = li.querySelector('#' + idp + '-err');
    if (r.err) { errEl.textContent = r.err; errEl.classList.remove('hidden'); return; }
    DEPOSITS[i] = { date: r.date, amount: r.amount, place: r.place };
    saveDB();
    renderDeposits();
    renderOverview();
    flash('נשמר ✓');
  });
}

function showAddDepositForm(ul) {
  if (document.getElementById('addDepForm')) return;
  const li = el('li');
  li.id = 'addDepForm';
  li.classList.add('form-li');
  li.innerHTML = '<b>הפקדה חדשה</b>' + depositFormHTML({ date: '', amount: 0, place: '' }, 'da');
  ul.insertBefore(li, ul.firstChild);
  li.querySelector('#da-cancel').addEventListener('click', () => li.remove());
  li.querySelector('#da-save').addEventListener('click', () => {
    const r = readDepositForm(li, 'da');
    const errEl = li.querySelector('#da-err');
    if (r.err) { errEl.textContent = r.err; errEl.classList.remove('hidden'); return; }
    DEPOSITS.unshift({ date: r.date, amount: r.amount, place: r.place });
    saveDB();
    renderDeposits();
    renderOverview();
    flash('ההפקדה נוספה ✓');
  });
}

function deleteDeposit(i) {
  const d = DEPOSITS[i];
  if (!d) return;
  if (!confirm('למחוק את ההפקדה מ־' + d.date + ' (' + Math.abs(d.amount).toLocaleString('en-US') + ' ₪)?')) return;
  DEPOSITS.splice(i, 1);
  saveDB();
  renderDeposits();
  renderOverview();
  flash('ההפקדה נמחקה ✓');
}

/* ---------------- רינדור: פנסיה ---------------- */

function renderPension() {
  const cur = state.currency;
  const wrap = document.getElementById('pensionCards');
  wrap.innerHTML = '';
  for (const f of PENSION_FUNDS) {
    const v = cur === 'ILS' ? f.ils : f.usd;
    const card = el('div', 'card stat',
      '<div class="stat-label">' + esc(f.name) + '</div>' +
      '<div class="stat-value">' + money(v, cur) + '</div>');
    wrap.appendChild(card);
  }
  const tu = PENSION_FUNDS.reduce((a, f) => a + (num(f.usd) || 0), 0);
  const ti = PENSION_FUNDS.reduce((a, f) => a + (num(f.ils) || 0), 0);
  document.getElementById('pensionTotal').textContent = money(cur === 'ILS' ? ti : tu, cur);

  const ul = document.getElementById('pensionDeposits');
  ul.innerHTML = '';
  const ed = state.edit.pension;
  if (ed) {
    const addLi = el('li');
    const addBtn = el('button', 'chip-btn', '＋ הוספת הפקדה');
    addBtn.type = 'button';
    addBtn.addEventListener('click', () => showAddPensionDepositForm(ul));
    addLi.appendChild(addBtn);
    ul.appendChild(addLi);
  }
  PENSION_DEPOSITS.forEach((r, i) => ul.appendChild(buildPensionDepositRow(r, i, ed)));
}

function buildPensionDepositRow(r, i, ed) {
  const li = el('li');
  li.innerHTML =
    '<span><b>' + esc(r.place) + '</b><br><span class="r-date">' + esc(r.period) + '</span>' +
    (r.note ? '<br><span class="r-note">' + esc(r.note) + '</span>' : '') + '</span>' +
    '<span class="r-amt out">₪' + Math.abs(r.amount).toLocaleString('en-US') + '</span>';
  if (ed) {
    const actions = el('span', 'row-actions');
    const eb = el('button', 'mini-btn', 'ערוך');
    eb.type = 'button';
    eb.addEventListener('click', () => showEditPensionDepositForm(li, r, i));
    const dbtn = el('button', 'mini-btn danger', 'מחק');
    dbtn.type = 'button';
    dbtn.addEventListener('click', () => deletePensionDeposit(i));
    actions.appendChild(eb);
    actions.appendChild(dbtn);
    li.appendChild(actions);
  }
  return li;
}

function pensionDepositFormHTML(r, idp) {
  const isOut = r.amount > 0;
  return '<div class="form-grid">' +
    '<label>חברה<input id="' + idp + '-place" type="text" value="' + esc(r.place || '') + '"></label>' +
    '<label>תקופה<input id="' + idp + '-period" type="text" dir="ltr" value="' + esc(r.period || '') + '" placeholder="MM/YYYY – MM/YYYY"></label>' +
    '<label>סוג<select id="' + idp + '-type">' +
      '<option value="in"' + (!isOut ? ' selected' : '') + '>הפקדה (כסף נכנס)</option>' +
      '<option value="out"' + (isOut ? ' selected' : '') + '>משיכה (כסף יוצא)</option>' +
    '</select></label>' +
    '<label>סכום (₪)<input id="' + idp + '-amt" type="number" min="0" step="any" inputmode="decimal" value="' + Math.abs(r.amount) + '"></label>' +
    '<label>הערה<input id="' + idp + '-note" type="text" value="' + esc(r.note || '') + '" placeholder="אופציונלי"></label>' +
    '</div>' +
    '<div class="form-err hidden" id="' + idp + '-err"></div>' +
    '<div class="edit-actions"><button class="btn" id="' + idp + '-save" type="button">שמור</button>' +
    '<button class="link-btn" id="' + idp + '-cancel" type="button">ביטול</button></div>';
}

function readPensionDepositForm(box, idp) {
  const place = box.querySelector('#' + idp + '-place').value.trim();
  const period = box.querySelector('#' + idp + '-period').value.trim();
  const type = box.querySelector('#' + idp + '-type').value;
  const amount = parseFloat(box.querySelector('#' + idp + '-amt').value);
  const note = box.querySelector('#' + idp + '-note').value.trim();
  if (!place) return { err: 'צריך למלא את שם החברה' };
  if (!(amount > 0)) return { err: 'הסכום חייב להיות חיובי' };
  return { place: place, period: period, amount: type === 'out' ? Math.abs(amount) : -Math.abs(amount), note: note };
}

function showEditPensionDepositForm(li, r, i) {
  const idp = 'pe' + i;
  li.classList.add('form-li');
  li.innerHTML = pensionDepositFormHTML(r, idp);
  li.querySelector('#' + idp + '-cancel').addEventListener('click', () => renderPension());
  li.querySelector('#' + idp + '-save').addEventListener('click', () => {
    const v = readPensionDepositForm(li, idp);
    const errEl = li.querySelector('#' + idp + '-err');
    if (v.err) { errEl.textContent = v.err; errEl.classList.remove('hidden'); return; }
    PENSION_DEPOSITS[i] = { place: v.place, period: v.period, amount: v.amount, note: v.note };
    saveDB();
    renderPension();
    flash('נשמר ✓');
  });
}

function showAddPensionDepositForm(ul) {
  if (document.getElementById('addPenDepForm')) return;
  const li = el('li');
  li.id = 'addPenDepForm';
  li.classList.add('form-li');
  li.innerHTML = '<b>הפקדת פנסיה חדשה</b>' + pensionDepositFormHTML({ place: '', period: '', amount: 0, note: '' }, 'pa');
  ul.insertBefore(li, ul.firstChild);
  li.querySelector('#pa-cancel').addEventListener('click', () => li.remove());
  li.querySelector('#pa-save').addEventListener('click', () => {
    const v = readPensionDepositForm(li, 'pa');
    const errEl = li.querySelector('#pa-err');
    if (v.err) { errEl.textContent = v.err; errEl.classList.remove('hidden'); return; }
    PENSION_DEPOSITS.unshift({ place: v.place, period: v.period, amount: v.amount, note: v.note });
    saveDB();
    renderPension();
    flash('נוספה ✓');
  });
}

function deletePensionDeposit(i) {
  const r = PENSION_DEPOSITS[i];
  if (!r) return;
  if (!confirm('למחוק את ההפקדה של ' + r.place + ' (' + Math.abs(r.amount).toLocaleString('en-US') + ' ₪)?')) return;
  PENSION_DEPOSITS.splice(i, 1);
  saveDB();
  renderPension();
  flash('נמחקה ✓');
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

/* ---------------- הגדרות ומצב עריכה ---------------- */

function renderTdKeyStatus() {
  const s = document.getElementById('tdKeyStatus');
  if (!s) return;
  const k = tdKey();
  s.textContent = k
    ? 'מפתח שמור: ••••' + k.slice(-4) + ' — הגרפים פעילים'
    : 'אין מפתח שמור — הגרפים לא יעבדו. הזן מפתח למטה.';
}

function wireEditToggle(btnId, hintId, key, rerender) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.addEventListener('click', () => {
    state.edit[key] = !state.edit[key];
    btn.classList.toggle('on', state.edit[key]);
    const hint = document.getElementById(hintId);
    if (hint) hint.classList.toggle('hidden', !state.edit[key]);
    rerender();
  });
}

function renderCashInputs() {
  const u = document.getElementById('cashUsd');
  const s = document.getElementById('cashIls');
  if (u) u.value = (DB.cash && DB.cash.usd) || 0;
  if (s) s.value = (DB.cash && DB.cash.ils) || 0;
}

function renderPensionFundEditors() {
  const box = document.getElementById('pensionFundEditors');
  if (!box) return;
  box.innerHTML = '';
  PENSION_FUNDS.forEach((f, i) => {
    const d = el('div', 'fund-editor');
    d.innerHTML = '<b>' + esc(f.name) + '</b>' +
      '<div class="form-grid">' +
      '<label>דולרים ($)<input data-fund="' + i + '" data-cur="usd" type="number" min="0" step="any" inputmode="decimal" value="' + f.usd + '"></label>' +
      '<label>שקלים (₪)<input data-fund="' + i + '" data-cur="ils" type="number" min="0" step="any" inputmode="decimal" value="' + f.ils + '"></label>' +
      '</div>';
    box.appendChild(d);
  });
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
      drawPfChart();
      for (const sym of Object.keys(state.open)) {
        if (state.open[sym]) ensureChartData(sym);
      }
    }, 250);
  });

  // Service Worker (רק בהקשר מאובטח, לא file://)
  if ('serviceWorker' in navigator && /^https?:$/.test(window.location.protocol)) {
    // כשיוצאת גרסה חדשה והיא משתלטת — לרענן אוטומטית כדי שהמשתמש יקבל אותה מיד.
    // רק אם הדף כבר היה תחת שליטה (עדכון), לא בהתקנה ראשונה.
    const hadController = !!navigator.serviceWorker.controller;
    let autoReloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (autoReloaded || !hadController) return;
      autoReloaded = true;
      location.reload();
    });
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').then((reg) => {
        // בדיקת עדכון יזומה בכל פתיחה — למקרה שהדפדפן דילג על הבדיקה האוטומטית
        try { if (reg && reg.update) reg.update().catch(() => {}); } catch (e) {}
      }).catch(() => {});
    });
  }

  // מפתח Twelve Data לגרפים (נשמר בטלפון בלבד) — בלשונית הגדרות
  const tdSave = document.getElementById('tdKeySave');
  if (tdSave) tdSave.addEventListener('click', () => {
    const inp = document.getElementById('tdKeyInput');
    const v = (inp && inp.value || '').trim();
    if (!v) return;
    try { localStorage.setItem(LS_TDKEY, v); } catch (e) {}
    renderTdKeyStatus();
    if (window.__cloudSave) window.__cloudSave();
    flash('המפתח נשמר ✓');
    state.hist = {}; state.intra = {};
    warmHistories();
    for (const sym of Object.keys(state.open)) if (state.open[sym]) ensureChartData(sym);
  });
  renderTdKeyStatus();
  if (!tdKey()) { switchTab('settings'); }

  // מצבי עריכה — כבויים כברירת מחדל כדי למנוע טעויות בלחיצות אקראיות
  wireEditToggle('editStocksBtn', 'editStocksHint', 'stocks', renderStocks);
  wireEditToggle('editDepositsBtn', 'editDepositsHint', 'deposits', renderDeposits);
  wireEditToggle('editPensionBtn', 'editPensionHint', 'pension', renderPension);

  // מזומן
  renderCashInputs();
  document.getElementById('cashSave').addEventListener('click', () => {
    const u = parseFloat(document.getElementById('cashUsd').value);
    const s = parseFloat(document.getElementById('cashIls').value);
    const errEl = document.getElementById('cashErr');
    if (!(u >= 0) || !(s >= 0)) {
      errEl.textContent = 'הסכומים חייבים להיות מספרים לא־שליליים';
      errEl.classList.remove('hidden');
      return;
    }
    errEl.classList.add('hidden');
    DB.cash = { usd: u, ils: s };
    saveDB();
    renderOverview();
    flash('המזומן נשמר ✓');
  });

  // קרנות פנסיה והשתלמות
  renderPensionFundEditors();
  document.getElementById('pensionFundsSave').addEventListener('click', () => {
    const errEl = document.getElementById('pfErr');
    const vals = [];
    let bad = false;
    document.querySelectorAll('#pensionFundEditors input').forEach((inp) => {
      const v = parseFloat(inp.value);
      if (!(v >= 0)) { bad = true; return; }
      vals.push([+inp.dataset.fund, inp.dataset.cur, v]);
    });
    if (bad) {
      errEl.textContent = 'כל הערכים חייבים להיות מספרים לא־שליליים';
      errEl.classList.remove('hidden');
      return;
    }
    errEl.classList.add('hidden');
    for (const [i, c, v] of vals) PENSION_FUNDS[i][c] = v;
    saveDB();
    renderPension();
    flash('הקרנות נשמרו ✓');
  });

  // איפוס נתונים
  const verEl = document.getElementById('appVersion');
  if (verEl && typeof APP_VERSION !== 'undefined') verEl.textContent = 'גרסת אפליקציה: ' + APP_VERSION;
  document.getElementById('resetData').addEventListener('click', () => {
    if (!confirm('לאפס את כל הנתונים? התיק יימחק לגמרי (מניות, הפקדות, פנסיה, מזומן) ויחזור לתיק הדוגמה.\nלא ניתן לבטל.')) return;
    const doReset = () => {
      try { localStorage.removeItem(LS_DB); } catch (e) {}
      location.reload();
    };
    if (window.Cloud && window.Cloud.resetCloud) window.Cloud.resetCloud().then(doReset);
    else doReset();
  });

  const startApp = () => {
    renderAll();
    refreshQuotes().then(() => warmHistories());
  };
  if (window.Cloud && window.Cloud.boot) window.Cloud.boot(startApp);
  else startApp();
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', init);
}
