/* GET /api/widget?s=AAPL~i~Apple,LUMI.TA~m~לאומי~leumi&l=he  →  JSON { ok, model }
   המודל של ווידג'ט מסך הבית באפליקציית האנדרואיד (Glance, WidgetRefresh.kt): לכל מניה מחיר, שינוי יומי כמו Yahoo,
   אחרי־מסחר, אגורות בת״א, וכותרת מצב השוק לפי לוח החגים — אותו חישוב של האפליקציה (lib/widget-model.js + lib/market.js).
   v215 (שלב 4): ציור התמונה ל־KWGT (Chromium) הוסר — רק JSON. `format` מתעלמים (תאימות לאחור).
   פרטיות (החלטת המשתמש, 26/09/2026): הקישור מכיל סימבולים, תגית מקור ושם — בלי כמויות/שווי/מחירי קנייה.
   מידע שוק ציבורי בלבד. GET (הווידג'ט הנייטיב לא שולח Origin), הגבלת קצב לכל IP, מטמון 50 שניות למופע. */
'use strict';
const quotes = require('./quotes');
const model = require('../lib/widget-model');
const market = require('../lib/market');

const MAX_ITEMS = 30; // כל התיק — תקרה להגנה על זמן התשובה
const CACHE_MS = 50000;
const BUDGET_MS = 9000;
const UA = 'Mozilla/5.0 (compatible; portfolio-pwa/1.0)';
const cache = new Map();
const hits = new Map();
function limited(ip) { // הווידג'ט: ~פעם בדקה; מרווח נדיב לרענון ידני ולכמה טלפונים באותה רשת
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 60000);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > 20;
}

function tradingDay(sym, ms) {
  if (model.isTA(sym)) { const p = market.ilDateParts(ms); return p.dow !== 0 && p.dow !== 6 && !market.taseHolidayKey(p); }
  const p = market.etDateParts(ms);
  return p.dow !== 0 && p.dow !== 6 && !market.nyseHolidays(p.y)[p.key];
}
/* סגירות יומיות אחרונות — רק כש־Yahoo מחזיר שינוי 0 (חג/סופ״ש בת״א, v167) */
async function fetchDaily(sym, deadline) {
  const left = deadline - Date.now();
  if (left < 500) return null;
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), Math.min(4000, left));
  try {
    const r = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) + '?interval=1d&range=5d',
      { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: ctl.signal });
    if (r.status !== 200) return null;
    const j = await r.json();
    const res = j && j.chart && j.chart.result && j.chart.result[0];
    const cl = (res && res.indicators && res.indicators.quote && res.indicators.quote[0] && res.indicators.quote[0].close) || [];
    const ts = (res && res.timestamp) || [];
    const k = String((res && res.meta && res.meta.currency) || '').toUpperCase() === 'ILA' ? 0.01 : 1;
    // Yahoo מוסיף שורה ליום בלי מסחר (למשל ערב סוכות) עם אותה סגירה — מסננים ימים שהבורסה סגורה בהם
    const out = [];
    for (let i = 0; i < ts.length; i++) if (cl[i] > 0 && tradingDay(sym, ts[i] * 1000)) out.push(cl[i] * k);
    return out;
  } catch (e) { return null; } finally { clearTimeout(to); }
}

async function getData(items) {
  const syms = items.map((x) => x.sym);
  const deadline = Date.now() + BUDGET_MS;
  const data = {};
  const all = syms.concat([model.FX_SYM]); // v228: שער הדולר לבועה בכותרת — באותו סבב (chart בלבד)
  let i = 0;
  const worker = async () => { while (i < all.length) { const s = all[i++]; const v = await quotes._fetchChart(s, deadline); if (v) data[s] = v; } };
  const [ext] = await Promise.all([quotes._fetchExt(syms, deadline), ...Array.from({ length: Math.min(8, all.length) }, worker)]);
  if (ext) for (const s of Object.keys(data)) if (ext[s]) data[s].x = ext[s];
  const daily = {};
  const need = syms.filter((s) => { const q = model.parseQuote(data[s]); return q && !(q.regCh); });
  await Promise.all(need.map(async (s) => { const d = await fetchDaily(s, deadline); if (d) daily[s] = d; }));
  return { data, daily };
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'method' });
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0] || (req.socket && req.socket.remoteAddress) || 'unknown';
  const q = req.query || {};
  const items = model.parseItems(q.s, MAX_ITEMS);
  if (!items.length || String(q.s || '').length > 1500) return res.status(400).json({ ok: false, error: 'bad_params' });
  const lang = q.l === 'en' ? 'en' : 'he';
  const n = Math.max(1, Math.min(MAX_ITEMS, parseInt(q.n, 10) || items.length)); // בלי n = כל המניות בקישור
  const key = [q.s, lang, n].join('|');
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return send(res, hit.v);
  if (limited(ip)) return res.status(429).json({ ok: false, error: 'rate_limited' });
  try {
    const shown = items.slice(0, n);
    const { data, daily } = await getData(shown);
    const v = model.buildModel(shown, data, daily, { lang });
    cache.set(key, { at: Date.now(), v });
    if (cache.size > 100) cache.clear();
    return send(res, v);
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'failed', detail: String((e && e.message) || e).slice(0, 200) });
  }
};
function send(res, v) {
  res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=45');
  res.setHeader('Access-Control-Allow-Origin', '*'); // מידע שוק ציבורי
  return res.status(200).json({ ok: true, model: v });
}
module.exports._limited = limited;
