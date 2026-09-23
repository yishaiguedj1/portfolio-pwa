/* POST /api/flex-request  { token, queryId } -> { ok, referenceCode, statementUrl } */
const { IBKR_HOST, cors, rateLimited, ibkrGet, errorXml } = require('../lib/ibkr');

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0] || req.socket?.remoteAddress || 'unknown';
  if (rateLimited(ip)) return res.status(429).json({ ok: false, error: 'rate_limited' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const token = String((body && body.token) || '').trim();
  const queryId = String((body && body.queryId) || '').trim();
  if (!/^\d{6,}$/.test(token) || !/^\d+$/.test(queryId)) {
    return res.status(400).json({ ok: false, error: 'bad_params' });
  }

  try {
    const url = `${IBKR_HOST}/AccountManagement/FlexWebService/SendRequest?t=${encodeURIComponent(token)}&q=${encodeURIComponent(queryId)}&v=3`;
    const { status, text } = await ibkrGet(url);
    if (status !== 200) return res.status(502).json({ ok: false, error: 'ibkr_http_' + status });
    const err = errorXml(text);
    if (err) return res.status(200).json({ ok: false, error: 'flex_' + err.code, message: err.message });
    const mRef = text.match(/<ReferenceCode>\s*([^<]+)\s*<\/ReferenceCode>/);
    const mUrl = text.match(/<Url>\s*([^<]+)\s*<\/Url>/i);
    if (!mRef) return res.status(502).json({ ok: false, error: 'no_reference_code' });
    return res.status(200).json({
      ok: true,
      referenceCode: mRef[1].trim(),
      statementUrl: mUrl ? mUrl[1].trim() : '',
    });
  } catch (e) {
    return res.status(502).json({ ok: false, error: 'fetch_failed' });
  }
};
