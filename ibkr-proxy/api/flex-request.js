/* POST /api/flex-request  { token, queryId } -> { ok, referenceCode, statementUrl }
   מאובטח: Origin מאושר בלבד + X-App-Key (אם הוגדר APP_KEY) — ראה guard ב־lib/ibkr.js */
const { guard, rateLimited, ibkrGetMulti, errorXml, FLEX_SEND_PATH, TOKEN_RE, QUERY_RE } = require('../lib/ibkr');

/* קודי Flex זמניים — IBKR מבקש "לנסות שוב בעוד רגע" (עומס / שגיאה חולפת).
   1020 ("invalid request") נכלל כי בפועל הוא מתחלף להצלחה אחרי המתנה קצרה.
   1018 ("too many requests") הוסר בכוונה: זו הגבלת קצב — ניסיון חוזר מידי
   רק שורף תקציב בקשות ומעמיק את ההגבלה. האפליקציה עוצרת ומסבירה למשתמש.
   1025 (נעילת טוקן) אינו כאן — עליו אסור לנסות שוב כלל. */
const TRANSIENT_FLEX_CODES = new Set(['1001', '1004', '1009', '1019', '1020', '1021']);
const MAX_ATTEMPTS = 3;
const RETRY_WAIT_MS = 7000; // סה"כ תקציב: ~3 נסיונות + 2 המתנות < 30 שניות (maxDuration)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// זמן ההמתנה בין נסיונות — ניתן לעקיפה בבדיקות דרך _setRetryWaitMs
let retryWaitMs = RETRY_WAIT_MS;

module.exports = async (req, res) => {
  if (guard(req, res)) return; // Origin מאושר, POST בלבד, מפתח אפליקציה, גודל

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0] || req.socket?.remoteAddress || 'unknown';
  if (rateLimited(ip)) return res.status(429).json({ ok: false, error: 'rate_limited' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const token = String((body && body.token) || '').trim();
  const queryId = String((body && body.queryId) || '').trim();
  // דריסת טווח תאריכים (אופציונלי): fd=YYYYMMDD, td=YYYYMMDD — עד 365 יום לבקשה.
  const fd = String((body && body.fd) || '').trim();
  const td = String((body && body.td) || '').trim();
  if (!TOKEN_RE.test(token) || !QUERY_RE.test(queryId)) {
    return res.status(400).json({ ok: false, error: 'bad_params' });
  }
  let dateParams = '';
  if (/^\d{8}$/.test(fd) && /^\d{8}$/.test(td)) {
    dateParams = `&fd=${fd}&td=${td}`;
  }

  try {
    // מנסה את שרתי IBKR לפי הסדר (ארה"ב ואז אירופה).
    // הנתיב: /Universal/servlet/FlexStatementService.SendRequest (הנתיב השני נחסם ברמת הרשת).
    const path = `${FLEX_SEND_PATH}?t=${encodeURIComponent(token)}&q=${encodeURIComponent(queryId)}&v=3${dateParams}`;
    let lastFlexErr = null;
    let retried = false;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const { status, text } = await ibkrGetMulti(path);
      if (status !== 200) return res.status(502).json({ ok: false, error: 'ibkr_http_' + status });
      const err = errorXml(text);
      if (!err) {
        const mRef = text.match(/<ReferenceCode>\s*([^<]+)\s*<\/ReferenceCode>/);
        const mUrl = text.match(/<Url>\s*([^<]+)\s*<\/Url>/i);
        if (!mRef) return res.status(502).json({ ok: false, error: 'no_reference_code' });
        return res.status(200).json({
          ok: true,
          referenceCode: mRef[1].trim(),
          statementUrl: mUrl ? mUrl[1].trim() : '',
        });
      }
      lastFlexErr = err;
      // שגיאה זמנית? מחכים ומנסים שוב. שגיאה קבועה (טוקן/שאילתה) — עוצרים מיד.
      if (TRANSIENT_FLEX_CODES.has(err.code) && attempt < MAX_ATTEMPTS) {
        retried = true;
        await sleep(retryWaitMs);
        continue;
      }
      break;
    }
    // נכשל — עם או בלי נסיונות חוזרים
    return res.status(200).json({ ok: false, error: 'flex_' + lastFlexErr.code, message: lastFlexErr.message, retried });
  } catch (e) {
    return res.status(502).json({ ok: false, error: 'fetch_failed' });
  }
};

// לבדיקות בלבד — קיצור ההמתנה בין נסיונות
module.exports._setRetryWaitMs = (ms) => { retryWaitMs = ms; };
