/* POST /api/quotes  { syms: ['AAPL','POLI.TA',…] (עד 40) }
   -> { ok, data: { SYM: { chart: {…נר אחרון, מבנה Yahoo חתוך…}, x: { state, pre, post, night } } }, failed: [...] }
   מחיר חי לכל התיק בבקשה אחת (Yahoo מהשרת). שני מקורות משולבים:
   - chart (interval=1m): הנר האחרון — מחיר חי בכל סשן, כולל overnight. נחתך ל־3 נרות + מטא.
   - quote v7 (עם crumb+cookie, כמו האתר של Yahoo): marketState + מחירי/שינויי טרום־מסחר,
     אחרי־מסחר ו־overnight יחסית לסגירה הרגילה — שדות שאין ב־chart. crumb נשמר במופע ומתחדש ב־401.
   מגבלות שנמדדו 25/09/2026 מהשרת: chart 8/שנייה ו־v7 4/שנייה בלי 429 — "מספר הזהב" הוא לא
   השרת אלא הטלפון (חסימה לפי IP של הספק הסלולרי), לכן הכל מהשרת, עם מטמון 1.5 שניות. */
const { guard } = require('../lib/ibkr');

const SYM_RE = /^[A-Z0-9][A-Z0-9.\-=^]{0,11}$/;
const MAX_SYMS = 40;
const CONCURRENCY = 10;
const PER_FETCH_MS = 5000;
const BUDGET_MS = 8000;
const CACHE_MS = 1500;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';
const META_KEYS = ['currency', 'symbol', 'regularMarketPrice', 'chartPreviousClose', 'previousClose', 'regularMarketTime',
  'regularMarketDayHigh', 'regularMarketDayLow', 'regularMarketVolume', 'gmtoffset', 'timezone', 'exchangeName', 'currentTradingPeriod', 'longName', 'shortName'];
const cache = new Map();
let crumbState = { cookie: '', crumb: '', at: 0 };

const hits = new Map();
function limited(ip) { // טיק כל 2 שניות = 30 בדקה לטלפון; מרווח ל־120
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 60000);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > 120;
}

function trimChart(j) {
  const r = j && j.chart && j.chart.result && j.chart.result[0];
  if (!r || (j.chart && j.chart.error)) return null;
  const meta = {};
  for (const k of META_KEYS) if (r.meta && r.meta[k] !== undefined) meta[k] = r.meta[k];
  const ts = r.timestamp || [];
  const cl = (r.indicators && r.indicators.quote && r.indicators.quote[0] && r.indicators.quote[0].close) || [];
  const keepT = [], keepC = [];
  for (let i = Math.min(ts.length, cl.length) - 1; i >= 0 && keepT.length < 3; i--) {
    if (cl[i] > 0) { keepT.unshift(ts[i]); keepC.unshift(cl[i]); }
  }
  if (!keepC.length && !(meta.regularMarketPrice > 0)) return null;
  return { chart: { result: [{ meta, timestamp: keepT, indicators: { quote: [{ close: keepC }] } }] } };
}

/* v7/quote → השדות המורחבים בלבד. ת"א (ILA) לשקלים. טהורה. */
function extFromQuote(q) {
  if (!q || !q.symbol) return null;
  const k = String(q.currency || '').toUpperCase() === 'ILA' ? 0.01 : 1;
  const sec = (pfx) => {
    const p = q[pfx + 'MarketPrice'];
    if (!(p > 0)) return null;
    return { p: p * k, ch: (q[pfx + 'MarketChange'] || 0) * k, pct: q[pfx + 'MarketChangePercent'] || 0, t: q[pfx + 'MarketTime'] || 0 };
  };
  const out = { state: String(q.marketState || ''), reg: q.regularMarketPrice > 0 ? { p: q.regularMarketPrice * k, ch: (q.regularMarketChange || 0) * k, pct: q.regularMarketChangePercent || 0, t: q.regularMarketTime || 0 } : null };
  const pre = sec('pre'), post = sec('post'), night = sec('overnight');
  if (pre) out.pre = pre;
  if (post) out.post = post;
  if (night) out.night = night;
  return out;
}

async function getCrumb(force) {
  if (!force && crumbState.crumb && Date.now() - crumbState.at < 6 * 3600 * 1000) return crumbState;
  const r0 = await fetch('https://fc.yahoo.com', { headers: { 'User-Agent': UA }, redirect: 'manual' });
  const cookie = (r0.headers.get('set-cookie') || '').split(';')[0];
  const cr = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', { headers: { 'User-Agent': UA, Cookie: cookie } });
  const crumb = (await cr.text()).trim();
  if (!crumb || crumb.length > 40 || /[<>]/.test(crumb)) throw new Error('no_crumb');
  crumbState = { cookie, crumb, at: Date.now() };
  return crumbState;
}

/* v7/quote לכל הסימבולים בבקשה אחת (עד 40). כשל = null (המחיר הבסיסי עדיין מגיע מ־chart) */
async function fetchExt(syms, deadline) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const left = deadline - Date.now();
    if (left < 800) return null;
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), Math.min(PER_FETCH_MS, left));
    try {
      const cs = await getCrumb(attempt > 0);
      const url = 'https://query2.finance.yahoo.com/v7/finance/quote?symbols=' + encodeURIComponent(syms.join(',')) +
        '&fields=marketState,currency,regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketTime,' +
        'preMarketPrice,preMarketChange,preMarketChangePercent,preMarketTime,postMarketPrice,postMarketChange,postMarketChangePercent,postMarketTime,' +
        'overnightMarketPrice,overnightMarketChange,overnightMarketChangePercent,overnightMarketTime&crumb=' + encodeURIComponent(cs.crumb);
      const r = await fetch(url, { headers: { 'User-Agent': UA, Cookie: cs.cookie, Accept: 'application/json' }, signal: ctl.signal });
      if (r.status === 401 || r.status === 403) continue; // crumb ישן — מתחדש בניסיון הבא
      if (r.status !== 200) return null;
      const j = await r.json();
      const out = {};
      for (const q of ((j.quoteResponse && j.quoteResponse.result) || [])) { const e = extFromQuote(q); if (e) out[String(q.symbol).toUpperCase()] = e; }
      return out;
    } catch (e) { /* ניסיון נוסף / ויתור */ } finally { clearTimeout(to); }
  }
  return null;
}

async function fetchChart(sym, deadline) {
  for (const host of ['query1', 'query2']) {
    const left = deadline - Date.now();
    if (left < 400) return null;
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), Math.min(PER_FETCH_MS, left));
    try {
      const url = 'https://' + host + '.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) +
        '?interval=1m&range=1d&includePrePost=true';
      const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: ctl.signal });
      if (r.status !== 200) continue;
      const v = trimChart(await r.json());
      if (v) return v;
    } catch (e) { /* המארח הבא */ } finally { clearTimeout(to); }
  }
  return null;
}

module.exports = async (req, res) => {
  if (guard(req, res)) return;
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0] || (req.socket && req.socket.remoteAddress) || 'unknown';
  if (limited(ip)) return res.status(429).json({ ok: false, error: 'rate_limited' });
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const raw = Array.isArray(body && body.syms) ? body.syms : [];
  const syms = [...new Set(raw.map((s) => String(s || '').trim().toUpperCase()))].filter((s) => SYM_RE.test(s));
  if (!syms.length || raw.length > MAX_SYMS) return res.status(400).json({ ok: false, error: 'bad_params' });
  const key = syms.slice().sort().join(',');
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return res.status(200).json(hit.v);
  const deadline = Date.now() + BUDGET_MS;
  const data = {}, failed = [];
  let i = 0;
  const worker = async () => {
    while (i < syms.length) {
      const s = syms[i++];
      const v = await fetchChart(s, deadline);
      if (v) data[s] = v; else failed.push(s);
    }
  };
  const [ext] = await Promise.all([fetchExt(syms, deadline), ...Array.from({ length: Math.min(CONCURRENCY, syms.length) }, worker)]);
  if (ext) for (const s of Object.keys(data)) if (ext[s]) data[s].x = ext[s];
  const v = { ok: true, data, failed, ext: !!ext };
  cache.set(key, { at: Date.now(), v });
  if (cache.size > 200) cache.clear();
  return res.status(200).json(v);
};

module.exports._trimChart = trimChart;
module.exports._extFromQuote = extFromQuote;
module.exports._cache = cache;
module.exports._setCrumb = (c) => { crumbState = c; };
