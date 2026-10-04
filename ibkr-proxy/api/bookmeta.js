/* פרטי ספר מהאינטרנט (לעריכת ספר בספרייה) — POST /api/bookmeta
     { op:'search', isbn?, title?, author?, lang? } -> { ok, results:[...], status:{ nli, google, openlibrary, apple } }
     { op:'cover', url }                            -> התמונה עצמה (רק ממארחי המקורות, עד 3MB)
   מידע ציבורי בלבד; Origin מאושר + הגבלת קצב לכל IP. GOOGLE_BOOKS_KEY (אופציונלי) ב־Vercel בלבד. */
const { guard } = require('../lib/ibkr');
const { searchAll, normQuery, coverAllowed } = require('../lib/bookmeta');

const MAX_COVER = 3 * 1024 * 1024;
const hits = new Map();
function limited(ip, max) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 60000);
  arr.push(now); hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > max;
}
const cache = new Map();   // חיפוש זהה בתוך המופע — בלי לחזור למקורות

async function handler(req, res, deps = {}) {
  if (guard(req, res)) return;
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const ip = String((req.headers && (req.headers['x-forwarded-for'] || '')) || '').split(',')[0].trim() || 'x';
  if (limited(ip, 40)) return res.status(429).json({ ok: false, error: 'rate_limited' });
  const f = deps.fetch || fetch;

  if (body.op === 'cover') {
    const url = String(body.url || '');
    if (!coverAllowed(url)) return res.status(400).json({ ok: false, error: 'bad_url' });
    try {
      const r = await f(url, { redirect: 'follow', headers: { 'User-Agent': 'TheSnowball-Library/1.0' } });
      const type = String(r.headers.get('content-type') || '');
      if (r.status !== 200 || !/^image\/(jpeg|png|webp|gif)/.test(type)) return res.status(502).json({ ok: false, error: 'cover_http_' + r.status });
      // אחרי הפניה (Open Library → archive.org) — גם היעד חייב להיות ממארח מאושר
      if (r.url && r.url !== url && !coverAllowed(r.url)) return res.status(400).json({ ok: false, error: 'bad_redirect' });
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length > MAX_COVER || buf.length < 200) return res.status(502).json({ ok: false, error: 'cover_size' });
      res.setHeader('Content-Type', type.split(';')[0]);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.status(200).send(buf);
    } catch (e) { return res.status(502).json({ ok: false, error: 'cover_failed' }); }
  }

  if (body.op === 'search') {
    const q = normQuery(body);
    if (!q) return res.status(400).json({ ok: false, error: 'bad_query' });
    const ck = JSON.stringify(q);
    const hit = cache.get(ck);
    if (hit && Date.now() - hit.at < 6 * 3600 * 1000) return res.status(200).json(Object.assign({ ok: true, cached: true }, hit.v));
    const v = await searchAll(q, { fetch: f, googleKey: process.env.GOOGLE_BOOKS_KEY || '', timeout: deps.timeout });
    if (cache.size > 300) cache.clear();
    if (v.results.length) cache.set(ck, { at: Date.now(), v });
    return res.status(200).json(Object.assign({ ok: true }, v));
  }
  res.status(400).json({ ok: false, error: 'bad_op' });
}
module.exports = handler;
module.exports._reset = () => { hits.clear(); cache.clear(); };
