/* v239: POST /api/search  { q: 'nvidea' }  ->  { ok, items: [{ sym, name, type }] }
   חיפוש מניות סובלני לטעויות (מידע ציבורי בלבד, שום נתון של המשתמש):
   1. היקום המקומי (lib/universe.txt — כל ארה"ב לפי שווי שוק + קרנות סל): סימבול/שם עם טעות כתיב, בלי רווחים, כינויים.
   2. Yahoo search מהשרת — שמות מדויקים, מניות חדשות, ת"א (hapoalim → POLI.TA). מהטלפון Yahoo חוסם (429) — לכן כאן.
   התאמה חזקה ביקום (סימבול/תחילת שם) קודמת; אחרת Yahoo קודם. רק ארה"ב ות"א. */
const { guard } = require('../lib/ibkr');
const { universe, searchUniverse } = require('../lib/search');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';
const YAHOO_MS = 2500;
const CACHE_MS = 10 * 60 * 1000;
const cache = new Map();
const hits = new Map();
function limited(ip) { // הקלדה = בקשה לכל כמה אותיות; 90 בדקה
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 60000);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > 90;
}
const marketOk = (s) => !/\./.test(s) || /\.TA$/.test(s);

async function yahooSearch(q) {
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), YAHOO_MS);
  try {
    const r = await fetch('https://query2.finance.yahoo.com/v1/finance/search?q=' + encodeURIComponent(q) + '&quotesCount=10&newsCount=0',
      { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: ctl.signal });
    if (r.status !== 200) return [];
    const j = await r.json();
    return ((j && j.quotes) || [])
      .filter((x) => x && x.symbol && ['EQUITY', 'ETF'].includes(x.quoteType) && marketOk(String(x.symbol).toUpperCase()))
      .map((x) => ({ sym: String(x.symbol).toUpperCase(), name: x.longname || x.shortname || x.symbol, type: x.quoteType }));
  } catch (e) { return []; } finally { clearTimeout(to); }
}

/* מיזוג טהור: התאמה חזקה ביקום (≥700) ראשונה, אחר כך Yahoo, אחר כך השאר. בלי כפילויות. */
function mergeResults(uni, yh, limit) {
  const strong = uni.filter((x) => x.sc >= 700), weak = uni.filter((x) => x.sc < 700);
  const seen = new Set(), out = [];
  for (const it of [...strong, ...yh, ...weak]) {
    const key = it.sym.replace('.', '-');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ sym: it.sym, name: it.name, type: it.type });
  }
  return out.slice(0, limit || 8);
}

module.exports = async (req, res) => {
  if (guard(req, res)) return;
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0] || (req.socket && req.socket.remoteAddress) || 'unknown';
  if (limited(ip)) return res.status(429).json({ ok: false, error: 'rate_limited' });
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const q = String((body && body.q) || '').trim().slice(0, 40);
  if (!q || /[^\w\s.&'\-]/.test(q)) return res.status(400).json({ ok: false, error: 'bad_params' }); // עברית — מקומי באפליקציה
  const key = q.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return res.status(200).json({ ok: true, items: hit.v });
  const uni = searchUniverse(universe(), q, 10);
  const yh = await yahooSearch(q);
  const items = mergeResults(uni, yh, 8);
  cache.set(key, { at: Date.now(), v: items });
  if (cache.size > 2000) cache.clear();
  return res.status(200).json({ ok: true, items });
};
module.exports._mergeResults = mergeResults;
