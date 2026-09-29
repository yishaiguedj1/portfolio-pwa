/* v256: POST /api/wordmark  { syms: ['ADBE', 'LUMI.TA', …] (עד 40) }  ->  { ok, items: { SYM: { url, w, h } | null } }
   לוגו אופקי רשמי של כל חברה (Wikidata → Wikimedia Commons, lib/wordmark.js). מידע ציבורי בלבד — רק סימבולים.
   מטמון בזיכרון שבוע (הלוגואים כמעט לא משתנים); Wikimedia דורשים User-Agent מזהה. */
const { guard } = require('../lib/ibkr');
const W = require('../lib/wordmark');

const UA = 'SnowballPortfolio/1.0 (https://github.com/yishaiguedj1/portfolio-pwa; public logos for a personal dashboard)';
const TTL = 7 * 24 * 3600 * 1000, MISS_TTL = 24 * 3600 * 1000;
const cache = new Map();
const SYM_RE = /^[A-Z0-9][A-Z0-9.\-]{0,11}$/;

async function getJSON(url, ms) {
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: ctl.signal });
    return r.ok ? await r.json() : null;
  } catch (e) { return null; } finally { clearTimeout(to); }
}

async function lookup(syms) {
  const q = W.sparqlFor(syms);
  if (!q) return {};
  const sp = await getJSON('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(q), 6000);
  if (!sp) return null; // תקלה — לא שומרים "אין לוגו"
  const files = W.pickFiles(syms, sp.results && sp.results.bindings);
  const names = [...new Set(Object.values(files))];
  let thumbs = {};
  if (names.length) {
    const ii = await getJSON('https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|size&iiurlwidth=500&titles=' +
      encodeURIComponent(names.map((n) => 'File:' + n).join('|')), 5000);
    if (!ii) return null;
    thumbs = W.pickThumbs(ii);
  }
  const out = {};
  for (const s of syms) out[s] = (files[s] && thumbs[files[s]]) || null;
  return out;
}

module.exports = async (req, res) => {
  if (guard(req, res)) return;
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const raw = Array.isArray(body && body.syms) ? body.syms.slice(0, 40) : [];
  const syms = [...new Set(raw.map((s) => String(s || '').trim().toUpperCase()))].filter((s) => SYM_RE.test(s));
  if (!syms.length) return res.status(400).json({ ok: false, error: 'bad_params' });
  const now = Date.now(), items = {}, need = [];
  for (const s of syms) {
    const c = cache.get(s);
    if (c && now - c.at < (c.v ? TTL : MISS_TTL)) items[s] = c.v; else need.push(s);
  }
  if (need.length) {
    const got = await lookup(need);
    for (const s of need) {
      const v = got ? got[s] || null : null;
      items[s] = v;
      if (got) cache.set(s, { at: now, v });
    }
    if (cache.size > 5000) cache.clear();
  }
  return res.status(200).json({ ok: true, items });
};
