/* POST /api/history  { syms: ['SPY','LUMI.TA',…] (עד 40), range: '1y'|'5y'|'7y'|'10y' }
   -> { ok, data: { SYM: { t: [ימים מאז 1970], c: [סגירות] } }, failed: [...] }
   מחירי סגירה יומיים מ־Yahoo (מידע ציבורי) — מהשרת, בבקשה אחת לכל הסימבולים.
   למה: בטלפון Yahoo חוסם לפעמים (429 לכתובת של הספק הסלולרי), ולמניות ת"א אין מקור אחר.
   מניות ת"א (ILA = אגורות) מוחזרות בשקלים. אין כאן שום מידע של המשתמש.
   מאובטח כמו שאר השרתון: Origin מאושר בלבד, POST בלבד, גוף קטן, הגבלת קצב. */
const { guard, rateLimited } = require('../lib/ibkr');

const SYM_RE = /^[A-Z0-9][A-Z0-9.\-=^]{0,11}$/;
const RANGES = new Set(['1y', '5y', '7y', '10y']); // 7y = 10y מ־Yahoo, חתוך ל־7 (תיק הדמו)
const MAX_SYMS = 40;
const CONCURRENCY = 8;
const PER_FETCH_MS = 8000;
const BUDGET_MS = 22000; // לפני ש־Vercel (maxDuration 30) הורג את הפונקציה
const CACHE_MS = 6 * 60 * 60 * 1000;
const UA = 'Mozilla/5.0 (compatible; portfolio-pwa/1.0)';
const cache = new Map(); // מופע חם בלבד — "best effort"

function parseChart(j) {
  const r = j && j.chart && j.chart.result && j.chart.result[0];
  if (!r || !Array.isArray(r.timestamp)) return null;
  const q = (r.indicators && r.indicators.quote && r.indicators.quote[0]) || {};
  const closes = q.close || [];
  const div = String((r.meta && r.meta.currency) || '').toUpperCase() === 'ILA' ? 100 : 1;
  const off = Number((r.meta && r.meta.gmtoffset) || 0);
  const t = [], c = [];
  let last = -1;
  for (let i = 0; i < r.timestamp.length; i++) {
    const v = closes[i];
    if (!(v > 0)) continue;
    const day = Math.floor((r.timestamp[i] + off) / 86400);
    const px = Math.round(v / div * 1e4) / 1e4;
    if (day === last) { c[c.length - 1] = px; continue; }
    t.push(day); c.push(px); last = day;
  }
  return t.length ? { t, c } : null;
}

async function fetchOne(sym, range, deadline) {
  const key = sym + '|' + range;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.v;
  for (const host of ['query1', 'query2']) {
    const left = deadline - Date.now();
    if (left < 500) return null;
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), Math.min(PER_FETCH_MS, left));
    try {
      const url = 'https://' + host + '.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) +
        '?interval=1d&range=' + (range === '7y' ? '10y' : range);
      const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: ctl.signal });
      if (r.status !== 200) continue;
      let v = parseChart(await r.json());
      if (v && range === '7y') {
        const from = Math.floor(Date.now() / 86400000) - 7 * 366;
        const k = v.t.findIndex((d) => d >= from);
        v = k > 0 ? { t: v.t.slice(k), c: v.c.slice(k) } : v;
      }
      if (v) {
        cache.set(key, { at: Date.now(), v });
        if (cache.size > 400) cache.clear();
        return v;
      }
    } catch (e) { /* המארח הבא */ } finally { clearTimeout(to); }
  }
  return null;
}

module.exports = async (req, res) => {
  if (guard(req, res)) return;
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0] || (req.socket && req.socket.remoteAddress) || 'unknown';
  if (rateLimited(ip)) return res.status(429).json({ ok: false, error: 'rate_limited' });
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const range = RANGES.has(body && body.range) ? body.range : '5y';
  const raw = Array.isArray(body && body.syms) ? body.syms : [];
  const syms = [...new Set(raw.map((s) => String(s || '').trim().toUpperCase()))].filter((s) => SYM_RE.test(s));
  if (!syms.length || syms.length > MAX_SYMS || raw.length > MAX_SYMS) {
    return res.status(400).json({ ok: false, error: 'bad_params' });
  }
  const deadline = Date.now() + BUDGET_MS;
  const data = {}, failed = [];
  let i = 0;
  const worker = async () => {
    while (i < syms.length) {
      const s = syms[i++];
      const v = await fetchOne(s, range, deadline);
      if (v) data[s] = v; else failed.push(s);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, syms.length) }, worker));
  return res.status(200).json({ ok: true, data, failed });
};

module.exports._parseChart = parseChart;
module.exports._cache = cache;
