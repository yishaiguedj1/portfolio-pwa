/* POST /api/flex-statement  { token, code, statementUrl? }
   GET  /api/flex-statement?token=..&code=..[&statementUrl=..]
   POST with a JSON body is preferred: the token never appears in URLs/logs.
   statementUrl is the <Url> returned by SendRequest; only known IBKR hosts
   are accepted (SSRF guard), otherwise the default host is used.
   -> { ok:true, status:'pending' }  |  { ok:true, status:'ready', data:{...} }  |  { ok:false, error } */
const { IBKR_HOST, cors, rateLimited, ibkrGetMulti, errorXml, parseXml, statementToJson, statementBaseFrom } = require('../lib/ibkr');

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'GET_or_POST_only' });
  }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0] || req.socket?.remoteAddress || 'unknown';
  if (rateLimited(ip)) return res.status(429).json({ ok: false, error: 'rate_limited' });

  let params = req.query || {};
  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
    params = body || {};
  }

  const token = String(params.token || '').trim();
  const code = String(params.code || '').trim();
  if (!/^\d{6,}$/.test(token) || !code) {
    return res.status(400).json({ ok: false, error: 'bad_params' });
  }

  // Use the host IBKR itself returned, but only if it is a known IBKR host.
  // אם הוא נכשל — ננסה את ההוסט הקשיח השני (אזור אחר).
  const base = statementBaseFrom(params.statementUrl || params.url) || IBKR_HOST;

  try {
    const path = `/AccountManagement/FlexWebService/GetStatement?t=${encodeURIComponent(token)}&q=${encodeURIComponent(code)}&v=3`;
    const { status, text } = await ibkrGetMulti(path, base);
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
