/* GET /api/widget?s=AAPL~i~Apple,LUMI.TA~m~לאומי~leumi&l=he&t=dark&n=3&z=1234  →  image/png
   v211: ווידג'ט למסך הבית (KWGT מציג את התמונה ומרענן אותה לפי z). מצויר ב־Chromium מאותו עיצוב שאושר
   (lib/widget-html.js) — כך העברית, ה־RTL והעיצוב זהים לתצוגה המקדימה, בלי לבנות פריסה בתוך KWGT.
   פרטיות (החלטת המשתמש, 26/09/2026): הקישור מכיל סימבולים, תגית מקור ושם — בלי כמויות/שווי/מחירי קנייה.
   מידע שוק ציבורי בלבד. GET (KWGT לא שולח Origin/POST), הגבלת קצב לכל IP, מטמון 50 שניות למופע + Cache-Control
   לרשת של Vercel. `?format=json` מחזיר את המודל (לבדיקות). */
'use strict';
const quotes = require('./quotes');
const model = require('../lib/widget-model');
const market = require('../lib/market');
const { buildHtml, WIDTH } = require('../lib/widget-html');

const MAX_ITEMS = 12;
const CACHE_MS = 50000;
const BUDGET_MS = 9000;
const UA = 'Mozilla/5.0 (compatible; portfolio-pwa/1.0)';
const cache = new Map();
const hits = new Map();
function limited(ip) { // KWGT: ~פעם בדקה; מרווח נדיב לרענון ידני ולכמה ווידג'טים
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
  let i = 0;
  const worker = async () => { while (i < syms.length) { const s = syms[i++]; const v = await quotes._fetchChart(s, deadline); if (v) data[s] = v; } };
  const [ext] = await Promise.all([quotes._fetchExt(syms, deadline), ...Array.from({ length: Math.min(8, syms.length) }, worker)]);
  if (ext) for (const s of Object.keys(data)) if (ext[s]) data[s].x = ext[s];
  const daily = {};
  const need = syms.filter((s) => { const q = model.parseQuote(data[s]); return q && !(q.regCh); });
  await Promise.all(need.map(async (s) => { const d = await fetchDaily(s, deadline); if (d) daily[s] = d; }));
  return { data, daily };
}

/* דפדפן חם בין קריאות (מופע Vercel שחי) — חוסך ~2–4 שניות לכל ציור */
let _browser = null;
async function browser() {
  if (_browser && _browser.connected !== false) return _browser;
  const chromium = (await import('@sparticuz/chromium')).default;
  const puppeteer = require('puppeteer-core');
  // WIDGET_PROXY: בדיקה מקומית בלבד (רשת דרך פרוקסי); ב־Vercel לא מוגדר
  _browser = await puppeteer.launch({
    args: chromium.args.concat(process.env.WIDGET_PROXY ? ['--proxy-server=' + process.env.WIDGET_PROXY, '--ignore-certificate-errors'] : []), executablePath: await chromium.executablePath(), headless: true,
    defaultViewport: { width: WIDTH, height: 200, deviceScaleFactor: 3 },
  });
  return _browser;
}
async function render(html) {
  const b = await browser();
  const page = await b.newPage();
  try {
    await page.setViewport({ width: WIDTH, height: 200, deviceScaleFactor: 3 });
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 12000 });
    await page.evaluate(() => Promise.all([document.fonts.ready, window.__logos]));
    const el = await page.$('#wrap');
    return await el.screenshot({ type: 'png', omitBackground: true });
  } finally { await page.close().catch(() => {}); }
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'method' });
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0] || (req.socket && req.socket.remoteAddress) || 'unknown';
  const q = req.query || {};
  const items = model.parseItems(q.s, MAX_ITEMS);
  if (!items.length || String(q.s || '').length > 1500) return res.status(400).json({ ok: false, error: 'bad_params' });
  const lang = q.l === 'en' ? 'en' : 'he';
  const theme = q.t === 'light' ? 'light' : 'dark';
  const n = Math.max(1, Math.min(8, parseInt(q.n, 10) || 3));
  const asJson = q.format === 'json';
  const key = [q.s, lang, theme, n, asJson ? 'j' : 'p'].join('|');
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return send(res, hit.v, asJson);
  if (limited(ip)) return res.status(429).json({ ok: false, error: 'rate_limited' });
  try {
    const shown = items.slice(0, n);
    const { data, daily } = await getData(shown);
    const m = model.buildModel(shown, data, daily, { lang });
    const v = asJson ? m : await render(buildHtml(m, { theme, n }));
    cache.set(key, { at: Date.now(), v });
    if (cache.size > 100) cache.clear();
    return send(res, v, asJson);
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'render_failed', detail: String((e && e.message) || e).slice(0, 200) });
  }
};
function send(res, v, asJson) {
  res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=45');
  if (asJson) return res.status(200).json({ ok: true, model: v });
  res.setHeader('Content-Type', 'image/png');
  return res.status(200).send(v);
}
module.exports._limited = limited;
