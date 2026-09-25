/* POST /api/flex-statement  { token, code, statementUrl? }
   POST בלבד (מ־25/09/2026): הטוקן לעולם לא ב־URL/לוגים. GET → 405.
   מאובטח: Origin מאושר בלבד + X-App-Key (אם הוגדר APP_KEY) — ראה guard ב־lib/ibkr.js.
   statementUrl is the <Url> returned by SendRequest; only known IBKR hosts
   are accepted (SSRF guard), otherwise the default host is used.
   -> { ok:true, status:'pending' }  |  { ok:true, status:'ready', data:{...} }  |  { ok:false, error } */
const { IBKR_HOST, guard, TOKEN_RE, CODE_RE, rateLimited, ibkrGetMulti, errorXml, parseXml, statementToJson, statementEndpointFrom, FLEX_GET_PATH } = require('../lib/ibkr');

module.exports = async (req, res) => {
  if (guard(req, res)) return; // Origin מאושר, POST בלבד, מפתח אפליקציה, גודל

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0] || req.socket?.remoteAddress || 'unknown';
  if (rateLimited(ip)) return res.status(429).json({ ok: false, error: 'rate_limited' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const params = body || {};

  const token = String(params.token || '').trim();
  const code = String(params.code || '').trim();
  if (!TOKEN_RE.test(token) || !CODE_RE.test(code)) {
    return res.status(400).json({ ok: false, error: 'bad_params' });
  }

  // Use the host+path IBKR itself returned, but only if host and path are known IBKR Flex endpoints.
  // אם הוא נכשל — ננסה את ההוסט הקשיח השני (אזור אחר).
  const ep = statementEndpointFrom(String(params.statementUrl || params.url || '').slice(0, 300));
  const base = ep ? ep.base : IBKR_HOST;
  const getPath = ep ? ep.path : FLEX_GET_PATH;

  try {
    const path = `${getPath}?t=${encodeURIComponent(token)}&q=${encodeURIComponent(code)}&v=3`;
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
