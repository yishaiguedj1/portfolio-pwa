/* GET /api/flex-statement?token=..&code=.. [&base=overrideHost]
   -> { ok:true, status:'pending' }  |  { ok:true, status:'ready', data:{...} }  |  { ok:false, error } */
const { IBKR_HOST, cors, rateLimited, ibkrGet, errorXml, parseXml, statementToJson } = require('../lib/ibkr');

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'GET only' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0] || req.socket?.remoteAddress || 'unknown';
  if (rateLimited(ip)) return res.status(429).json({ ok: false, error: 'rate_limited' });

  const token = String(req.query.token || '').trim();
  const code = String(req.query.code || '').trim();
  if (!/^\d{6,}$/.test(token) || !code) {
    return res.status(400).json({ ok: false, error: 'bad_params' });
  }

  try {
    const base = IBKR_HOST; // SendRequest may return a host; default is fine
    const url = `${base}/AccountManagement/FlexWebService/GetStatement?t=${encodeURIComponent(token)}&q=${encodeURIComponent(code)}&v=3`;
    const { status, text } = await ibkrGet(url);
    if (status !== 200) return res.status(502).json({ ok: false, error: 'ibkr_http_' + status });
    const err = errorXml(text);
    if (err) {
      // 1009/1019 = statement still generating -> pending
      if (err.code === '1009' || err.code === '1019') {
        return res.status(200).json({ ok: true, status: 'pending' });
      }
      return res.status(200).json({ ok: false, error: 'flex_' + err.code, message: err.message });
    }
    if (!/<FlexStatement[\s>]/.test(text)) {
      return res.status(200).json({ ok: true, status: 'pending' });
    }
    const tree = parseXml(text);
    const data = statementToJson(tree);
    return res.status(200).json({ ok: true, status: 'ready', data });
  } catch (e) {
    return res.status(502).json({ ok: false, error: 'fetch_failed' });
  }
};
