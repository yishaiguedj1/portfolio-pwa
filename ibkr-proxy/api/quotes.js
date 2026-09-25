/* POST /api/quotes  { syms: ['AAPL','POLI.TA',…] (עד 40) }
   -> { ok, data: { SYM: { chart: { result: [ { meta, timestamp, indicators } ] } } }, failed: [...] }
   מחיר חי (נר הדקה האחרון, כולל טרום/אחרי־מסחר) מ־Yahoo — מהשרת, בבקשה אחת לכל התיק.
   למה: הטלפון שלח בקשה נפרדת לכל מניה כל כמה שניות (~90 בדקה בזמן מסחר), ו־Yahoo חסם אותו (429) —
   מה שהפיל גם את הגרפים. התשובה נחתכת ל־meta + 3 הנרות האחרונים, במבנה של Yahoo, כך שהאפליקציה
   מפענחת אותה באותה פונקציה (parseYahooQuote). מידע שוק ציבורי בלבד.
   מאובטח כמו שאר השרתון: Origin מאושר, POST בלבד, גוף קטן, הגבלת קצב משלו (טיקים חיים). */
const { guard } = require('../lib/ibkr');

const SYM_RE = /^[A-Z0-9][A-Z0-9.\-=^]{0,11}$/;
const MAX_SYMS = 40;
const CONCURRENCY = 10;
const PER_FETCH_MS = 6000;
const BUDGET_MS = 9000;
const CACHE_MS = 4000; // כרטיס פתוח (5 שניות) + התיק כולו (10) — לא שואלים פעמיים באותו רגע
const UA = 'Mozilla/5.0 (compatible; portfolio-pwa/1.0)';
const META_KEYS = ['currency', 'symbol', 'regularMarketPrice', 'chartPreviousClose', 'previousClose', 'regularMarketTime',
  'regularMarketDayHigh', 'regularMarketDayLow', 'regularMarketVolume', 'gmtoffset', 'timezone', 'exchangeName', 'currentTradingPeriod'];
const cache = new Map();

const hits = new Map();
function limited(ip) { // טיק כל 5 שניות = 12 בדקה; מרווח ל־60
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 60000);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > 60;
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

async function fetchQuote(sym, deadline) {
  const hit = cache.get(sym);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.v;
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
      if (v) {
        cache.set(sym, { at: Date.now(), v });
        if (cache.size > 500) cache.clear();
        return v;
      }
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
  const deadline = Date.now() + BUDGET_MS;
  const data = {}, failed = [];
  let i = 0;
  const worker = async () => {
    while (i < syms.length) {
      const s = syms[i++];
      const v = await fetchQuote(s, deadline);
      if (v) data[s] = v; else failed.push(s);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, syms.length) }, worker));
  return res.status(200).json({ ok: true, data, failed });
};

module.exports._trimChart = trimChart;
module.exports._cache = cache;
