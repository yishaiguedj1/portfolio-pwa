/* בדיקות ל-ibkr-proxy. הרצה: node tests/run.js */
const assert = require('node:assert/strict');
const { statementBaseFrom, statementEndpointFrom, errorXml, ibkrUserAgent, FLEX_SEND_PATH, FLEX_GET_PATH, parseXml, statementToJson } = require('../lib/ibkr');
const flexStatement = require('../api/flex-statement');
const flexRequest = require('../api/flex-request');
const history = require('../api/history');
const quotes = require('../api/quotes');

let n = 0;
const ok = (cond, name) => { n++; assert(cond, name); console.log('ok -', name); };

/* ---------- statementBaseFrom (SSRF guard) ---------- */
ok(statementBaseFrom('https://ndcdyn.interactivebrokers.com/AccountManagement/FlexWebService/GetStatement?q=1&t=2&v=3')
  === 'https://ndcdyn.interactivebrokers.com', 'ndcdyn מאושר');
ok(statementBaseFrom('https://gdcdyn.interactivebrokers.com:443/x') === 'https://gdcdyn.interactivebrokers.com',
  'gdcdyn עם פורט מאושר');
ok(statementBaseFrom('http://ndcdyn.interactivebrokers.com/x') === null, 'http נדחה');
ok(statementBaseFrom('https://evil.com/x') === null, 'הוסט זר נדחה');
ok(statementBaseFrom('https://ndcdyn.interactivebrokers.com.evil.com/x') === null, 'זיוף סאבדומיין נדחה');
ok(statementBaseFrom('https://interactivebrokers.com.evil.com/x') === null, 'זיוף נוסף נדחה');
ok(statementBaseFrom('') === null, 'ריק נדחה');
ok(statementBaseFrom('not a url') === null, 'זבל נדחה');
ok(statementBaseFrom(null) === null, 'null נדחה');

ok(statementEndpointFrom('https://gdcdyn.interactivebrokers.com/AccountManagement/FlexWebService/GetStatement?q=1').path
  === '/AccountManagement/FlexWebService/GetStatement', 'נתיב Flex תקין מתקבל');
ok(statementEndpointFrom('https://evil.com/AccountManagement/FlexWebService/GetStatement') === null, 'הוסט זר ב-endpoint נדחה');
ok(statementEndpointFrom('https://ndcdyn.interactivebrokers.com/Universal/servlet/FlexStatementService.GetStatement') === null,
  'הנתיב הישן Universal נדחה (IBKR מחזיר עליו תמיד 1001)');
ok(/^Node\.js\/\d/.test(ibkrUserAgent()), 'User-Agent תקין (Node.js)');
  ok(errorXml("<FlexStatementResponse><Status>Fail</Status><ErrorCode>1020</ErrorCode><ErrorMessage>Invalid request</ErrorMessage></FlexStatementResponse>").code === '1020',
  'Status=Fail מזוהה כשגיאה');

/* ---------- mock req/res ---------- */
function mockReq({ method = 'POST', query = {}, body = {}, headers } = {}) {
  // ברירת מחדל: בקשה מהאפליקציה החיה (Origin מאושר)
  const h = headers || { origin: 'https://yishaiguedj1.github.io' };
  return { method, query, body, headers: h, socket: { remoteAddress: mockReq.ip || '9.9.9.9' } };
}
function mockRes() {
  const r = { statusCode: 200, payload: null, headers: {} };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (o) => { r.payload = o; return r; };
  r.end = () => r;
  return r;
}

const READY_XML = `<FlexQueryResponse><FlexStatements><FlexStatement accountId="U123" fromDate="20240101" toDate="20240131" baseCurrency="USD">
<Trades><Trade symbol="AAPL" dateTime="20240105;093000" quantity="10" tradePrice="180.5" proceeds="1805" ibCommission="-1" ibCommissionCurrency="USD" taxes="0.5" netCash="-1806.5" fifoPnlRealized="50" buySell="BUY" openCloseIndicator="O" exchange="NASDAQ" tradeID="T123" currency="USD" fxRateToBase="1"/></Trades>
<OpenPositions><OpenPosition symbol="AAPL" assetCategory="STK" position="10" markPrice="185" positionValue="1850" costBasisMoney="1805" fifoPnlUnrealized="45" currency="USD" fxRateToBase="1.2"/></OpenPositions>
<CashTransactions><CashTransaction dateTime="20240110;000000" amount="-1806" currency="USD" fxRateToBase="1" type="Deposits/Withdrawals" description="Wire"/></CashTransactions>
<ChangeInNAV startingValue="10000" endingValue="10500" twr="0.05" mtm="500"/>
<EquitySummaryByReportDateInBase><EquitySummaryByReportDateInBase currency="USD" cashBalance="5000"/></EquitySummaryByReportDateInBase>
</FlexStatement></FlexStatements></FlexQueryResponse>`;

const PENDING_XML = `<FlexQueryResponse><Status>Error</Status><ErrorCode>1019</ErrorCode><ErrorMessage>Statement is not ready</ErrorMessage></FlexQueryResponse>`;
const TOKEN_ERR_XML = `<FlexQueryResponse><Status>Error</Status><ErrorCode>1015</ErrorCode><ErrorMessage>Token is invalid</ErrorMessage></FlexQueryResponse>`;

let lastFetchUrl = '';
function stubFetch(text, status = 200) {
  lastFetchUrl = '';
  global.fetch = async (url) => { lastFetchUrl = String(url); return { status, text: async () => text }; };
}

(async () => {
  /* ---------- POST ready, statementUrl מאושר ---------- */
  stubFetch(READY_XML);
  let res = mockRes();
  await flexStatement(mockReq({ body: { token: '1234567890', code: 'ABC123', statementUrl: 'https://gdcdyn.interactivebrokers.com/AccountManagement/FlexWebService/GetStatement?q=ABC&t=1' } }), res);
  ok(res.payload.ok === true && res.payload.status === 'ready', 'POST מחזיר ready');
  ok(lastFetchUrl.startsWith('https://gdcdyn.interactivebrokers.com/AccountManagement/FlexWebService/GetStatement?t=1234567890&q=ABC123'),
    'משתמש ב-host ובנתיב ש-IBKR החזיר');
  ok(res.payload.data.trades.length === 1 && res.payload.data.trades[0].symbol === 'AAPL', 'עסקה נפרסה');
  ok(res.payload.data.trades[0].commission === -1, 'עמלת IBKR נפרסה (שלילית כמו ב־Flex)');
  ok(res.payload.data.trades[0].commissionCurrency === 'USD', 'מטבע העמלה נפרס');
  ok(res.payload.data.trades[0].netCash === -1806.5, 'netCash נפרס');
  ok(res.payload.data.trades[0].taxes === 0.5, 'מס עסקה נפרס');
  ok(res.payload.data.trades[0].openClose === 'O', 'open/close נפרס');
  ok(res.payload.data.trades[0].tradeId === 'T123', 'מזהה עסקה נפרס');
  ok(res.payload.data.positions[0].unrealized === 45, 'פוזיציה נפרסה');
  ok(res.payload.data.positions[0].fxToBase === 1.2, 'fxToBase של פוזיציה נפרס');
  ok(res.payload.data.positions[0].asset === 'STK', 'סוג נכס נפרס');
  ok(res.payload.data.nav.twr === 0.05, 'NAV/TWR נפרס');
  ok(res.payload.data.cashTransactions[0].amount === -1806, 'תנועת מזומן נפרסה');

  /* ---------- ChangeInNAV מרובה שורות (פירוט יומי) ---------- */
  const multiXml = `<FlexQueryResponse><FlexStatements><FlexStatement accountId="U123" fromDate="20240101" toDate="20240103" baseCurrency="USD">` +
    `<ChangeInNAV fromDate="20240101" toDate="20240101" startingValue="10000" endingValue="11000" twr="10" mtm="1000"/>` +
    `<ChangeInNAV fromDate="20240102" toDate="20240102" startingValue="11000" endingValue="12100" twr="10" mtm="1100"/>` +
    `<ChangeInNAV fromDate="20240103" toDate="20240103" startingValue="12100" endingValue="10890" twr="-10" mtm="-1210"/>` +
    `</FlexStatement></FlexStatements></FlexQueryResponse>`;
  const multi = statementToJson(parseXml(multiXml));
  ok(multi.navHistory.length === 3, 'שלוש שורות NAV נשמרו להיסטוריה');
  ok(multi.navHistory[0].toDate === '2024-01-01' && multi.navHistory[2].endingValue === 10890, 'תאריכים וערכים יומיים מפוענחים');
  const expTwr = (1.1 * 1.1 * 0.9 - 1) * 100;
  ok(Math.abs(multi.nav.twr - expTwr) < 1e-9, 'TWR תקופתי מורכב משורות יומיות (1.1*1.1*0.9-1)');
  ok(multi.nav.startingValue === 10000 && multi.nav.endingValue === 10890, 'ערכי התחלה/סיום מהשורות הקיצוניות');
  ok(multi.nav.mtm === 890, 'mtm מסוכם על פני הימים');

  /* ---------- statementUrl זדוני -> fallback ל-host ברירת מחדל ---------- */
  stubFetch(READY_XML);
  res = mockRes();
  await flexStatement(mockReq({ body: { token: '1234567890', code: 'ABC123', statementUrl: 'https://evil.com/steal' } }), res);
  ok(lastFetchUrl.startsWith('https://ndcdyn.interactivebrokers.com/'), 'URL זדוני נדחה, fallback לברירת מחדל');
  ok(res.payload.ok === true, 'עדיין ok');

  /* ---------- GET נחסם (אבטחה): הטוקן לעולם לא ב־URL ---------- */
  stubFetch(READY_XML);
  res = mockRes();
  await flexStatement(mockReq({ method: 'GET', query: { token: '1234567890', code: 'ABC123' } }), res);
  ok(res.statusCode === 405 && lastFetchUrl === '', 'GET נחסם (405) ולא פונה ל־IBKR');

  /* ---------- pending ---------- */
  stubFetch(PENDING_XML);
  res = mockRes();
  await flexStatement(mockReq({ body: { token: '1234567890', code: 'ABC123' } }), res);
  ok(res.payload.ok === true && res.payload.status === 'pending', '1019 -> pending');

  /* ---------- שגיאת טוקן ---------- */
  stubFetch(TOKEN_ERR_XML);
  res = mockRes();
  await flexStatement(mockReq({ body: { token: '1234567890', code: 'ABC123' } }), res);
  ok(res.payload.ok === false && res.payload.error === 'flex_1015', 'שגיאת טוקן מועברת');

  /* ---------- פרמטרים לא תקינים ---------- */
  stubFetch(READY_XML);
  res = mockRes();
  await flexStatement(mockReq({ body: { token: 'abc', code: '' } }), res);
  ok(res.statusCode === 400 && res.payload.error === 'bad_params', 'bad_params -> 400');

  /* ---------- IBKR מחזיר 500 ---------- */
  stubFetch('boom', 500);
  res = mockRes();
  await flexStatement(mockReq({ body: { token: '1234567890', code: 'ABC123' } }), res);
  ok(res.statusCode === 502 && res.payload.error === 'ibkr_http_500', 'http 500 -> 502');

  /* ---------- XML בלי FlexStatement -> pending ---------- */
  stubFetch('<html>wait</html>');
  res = mockRes();
  await flexStatement(mockReq({ body: { token: '1234567890', code: 'ABC123' } }), res);
  ok(res.payload.status === 'pending', 'תשובה לא מוכרת -> pending');

  /* ---------- נפילה בין שרתי IBKR (אזור ארה"ב/אירופה) ---------- */
  const SEND_OK_XML = `<FlexQueryResponse><Status>Success</Status><ReferenceCode>RC123</ReferenceCode><Url>https://gdcdyn.interactivebrokers.com/x</Url></FlexQueryResponse>`;
  const seenHosts = [];
  global.fetch = async (url) => {
    const u = String(url);
    seenHosts.push(u);
    if (u.startsWith('https://ndcdyn.')) return { status: 403, text: async () => 'denied' };
    return { status: 200, text: async () => SEND_OK_XML };
  };
  res = mockRes();
  await flexRequest(mockReq({ body: { token: '123456789012345678901234', queryId: '999999' } }), res);
  ok(res.payload.ok === true && res.payload.referenceCode === 'RC123', 'נדחה ב-ndcdyn, הצליח ב-gdcdyn');
  ok(seenHosts.length === 2 && seenHosts[0].startsWith('https://ndcdyn.') && seenHosts[1].startsWith('https://gdcdyn.'),
    'ניסה את שני ההוסטים לפי הסדר');
  ok(seenHosts[0].includes('/AccountManagement/FlexWebService/SendRequest?t='), 'נתיב SendRequest רשמי');

  /* ---------- 200 עם שגיאת Flex בהוסט הראשון -> לא מנסה שני ---------- */
  seenHosts.length = 0;
  global.fetch = async (url) => {
    seenHosts.push(String(url));
    return { status: 200, text: async () => TOKEN_ERR_XML };
  };
  res = mockRes();
  await flexRequest(mockReq({ body: { token: '123456789012345678901234', queryId: '999999' } }), res);
  ok(res.payload.ok === false && res.payload.error === 'flex_1015', 'שגיאת Flex לא גוררת fallback');
  ok(seenHosts.length === 1, 'רק הוסט אחד נקרא');

  /* ---------- נסיון חוזר על שגיאה זמנית (1001) ---------- */
  flexRequest._setRetryWaitMs(1);
  const FAIL1001 = `<FlexStatementResponse><Status>Fail</Status><ErrorCode>1001</ErrorCode><ErrorMessage>Statement could not be generated at this time. Please try again shortly.</ErrorMessage></FlexStatementResponse>`;
  const SEND_OK = `<FlexStatementResponse><Status>Success</Status><ReferenceCode>RC9</ReferenceCode><Url>https://gdcdyn.interactivebrokers.com/AccountManagement/FlexWebService/GetStatement</Url></FlexStatementResponse>`;
  let calls = 0;
  global.fetch = async () => {
    calls++;
    return { status: 200, text: async () => (calls === 1 ? FAIL1001 : SEND_OK) };
  };
  res = mockRes();
  await flexRequest(mockReq({ body: { token: '123456789012345678901234', queryId: '999999' } }), res);
  ok(res.payload.ok === true && res.payload.referenceCode === 'RC9', 'אחרי 1001 מנסה שוב ומצליח');
  ok(calls === 2, 'בוצעו שני נסיונות');

  /* ---------- שלוש שגיאות 1001 -> מחזיר כשלון עם retried ---------- */
  calls = 0;
  global.fetch = async () => { calls++; return { status: 200, text: async () => FAIL1001 }; };
  res = mockRes();
  await flexRequest(mockReq({ body: { token: '123456789012345678901234', queryId: '999999' } }), res);
  ok(res.payload.ok === false && res.payload.error === 'flex_1001' && res.payload.retried === true, 'אחרי 3 נסיונות מחזיר flex_1001');
  ok(calls === 3, 'בוצעו שלושה נסיונות');

  /* ---------- שגיאה קבועה (1015) -> אין נסיון חוזר ---------- */
  calls = 0;
  const FAIL1015 = `<FlexStatementResponse><Status>Fail</Status><ErrorCode>1015</ErrorCode><ErrorMessage>Token is invalid.</ErrorMessage></FlexStatementResponse>`;
  global.fetch = async () => { calls++; return { status: 200, text: async () => FAIL1015 }; };
  res = mockRes();
  await flexRequest(mockReq({ body: { token: '123456789012345678901234', queryId: '999999' } }), res);
  ok(res.payload.ok === false && res.payload.error === 'flex_1015' && !res.payload.retried, 'טוקן לא תקין -> כשלון מיידי');
  ok(calls === 1, 'נסיון יחיד לשגיאה קבועה');

  /* ---------- הגבלת קצב (1018) -> אין נסיון חוזר כלל (v120) ---------- */
  calls = 0;
  const FAIL1018 = `<FlexStatementResponse><Status>Fail</Status><ErrorCode>1018</ErrorCode><ErrorMessage>Too many requests have been made from this token. Please try again shortly.</ErrorMessage></FlexStatementResponse>`;
  global.fetch = async () => { calls++; return { status: 200, text: async () => FAIL1018 }; };
  res = mockRes();
  await flexRequest(mockReq({ body: { token: '123456789012345678901234', queryId: '999999' } }), res);
  ok(res.payload.ok === false && res.payload.error === 'flex_1018' && !res.payload.retried, 'הגבלת קצב 1018 -> כשלון מיידי בלי נסיון חוזר');
  ok(calls === 1, 'נסיון יחיד להגבלת קצב (ניסיון חוזר רק שורף תקציב בקשות)');
  flexRequest._setRetryWaitMs(7000);

  /* ---------- שני ההוסטים נכשלים -> שגיאת ההוסט האחרון ---------- */
  global.fetch = async () => ({ status: 500, text: async () => 'boom' });
  res = mockRes();
  await flexRequest(mockReq({ body: { token: '123456789012345678901234', queryId: '999999' } }), res);
  ok(res.statusCode === 502 && res.payload.error === 'ibkr_http_500', 'שני הוסטים נכשלים -> 502');

  /* ---------- flex-statement: ההוסט המועדף נדחה, השני מצליח ---------- */
  const seenStmt = [];
  global.fetch = async (url) => {
    const u = String(url);
    seenStmt.push(u);
    if (u.startsWith('https://gdcdyn.')) return { status: 403, text: async () => 'denied' };
    return { status: 200, text: async () => READY_XML };
  };
  res = mockRes();
  await flexStatement(mockReq({ body: { token: '1234567890', code: 'ABC123', statementUrl: 'https://gdcdyn.interactivebrokers.com/AccountManagement/FlexWebService/GetStatement?q=ABC' } }), res);
  ok(res.payload.ok === true && res.payload.status === 'ready', 'statement נפל להוסט השני והצליח');
  ok(seenStmt.length === 2 && seenStmt[1].startsWith('https://ndcdyn.'), 'ההוסט השני נוסה');

  /* ---------- v125: תזרימים ב־ChangeInNAV + NAV יומי ---------- */
  {
    const xml = '<FlexQueryResponse><FlexStatements><FlexStatement accountId="U0" fromDate="20260101" toDate="20260110">' +
      '<ChangeInNAV fromDate="20260101" toDate="20260110" startingValue="1000" endingValue="1650" depositsWithdrawals="500" assetTransfers="100" twr="4.5" mtm="50"/>' +
      '<EquitySummaryInBase>' +
      '<EquitySummaryByReportDateInBase reportDate="20260102" total="1010"/>' +
      '<EquitySummaryByReportDateInBase reportDate="20260105" total="1520.5"/>' +
      '<EquitySummaryByReportDateInBase reportDate="20260106" total=""/>' +
      '</EquitySummaryInBase></FlexStatement></FlexStatements></FlexQueryResponse>';
    const j = statementToJson(parseXml(xml));
    ok(j.navHistory[0].flows === 600, 'ChangeInNAV: תזרימים = הפקדות/משיכות + העברות');
    ok(Array.isArray(j.navDaily) && j.navDaily.length === 2, 'NAV יומי: שורה לכל יום, בלי ערך חסר');
    ok(j.navDaily[0].date === '2026-01-02' && j.navDaily[1].total === 1520.5, 'NAV יומי: תאריך ושווי נכונים');
    const j2 = statementToJson(parseXml('<FlexStatement fromDate="20260101" toDate="20260110"></FlexStatement>'));
    ok(Array.isArray(j2.navDaily) && j2.navDaily.length === 0, 'בלי סעיף NAV — מערך ריק, לא שגיאה');
  }

  /* ---------- v122: IBKR איטי — השרתון מחזיר JSON לפני ש־Vercel הורג אותו ---------- */
  {
    const { ibkrGetMulti } = require('../lib/ibkr');
    global.fetch = (url, opts) => new Promise((resolve, reject) => {
      opts.signal.addEventListener('abort', () => reject(new Error('aborted')));
    });
    const t0 = Date.now();
    const r = await ibkrGetMulti('/x', null, 300);
    ok(r.status === 0 && Date.now() - t0 < 1500, 'IBKR תקוע -> ibkrGetMulti חוזר בתוך תקציב הזמן');
  }

  /* ---------- שמירת גישה: Origin, מפתח אפליקציה, גודל, פורמט ---------- */
  {
    mockReq.ip = '7.7.7.7'; // IP נפרד — לא נחסם בהגבלת הקצב של הבדיקות הקודמות
    const { originAllowed, safeEqual } = require('../lib/ibkr');
    ok(originAllowed('https://yishaiguedj1.github.io'), 'Origin: האתר החי מאושר');
    ok(originAllowed('http://localhost:8080') && originAllowed('http://127.0.0.1:5500'), 'Origin: localhost לבדיקות');
    ok(!originAllowed('https://evil.example') && !originAllowed('https://yishaiguedj1.github.io.evil.com') && !originAllowed(''),
      'Origin: אתר זר / זיוף סאבדומיין / חסר — נדחים');
    ok(!originAllowed('http://localhost.evil.com'), 'Origin: זיוף localhost נדחה');
    ok(safeEqual('abc', 'abc') && !safeEqual('abc', 'abd') && !safeEqual('', '') && !safeEqual('a', 'ab'), 'safeEqual');

    for (const [fn, name, body] of [[flexRequest, 'flex-request', { token: '123456789012345678901234', queryId: '999999' }],
                                    [flexStatement, 'flex-statement', { token: '1234567890', code: 'ABC123' }]]) {
      stubFetch(READY_XML);
      let r = mockRes();
      await fn(mockReq({ body, headers: { origin: 'https://evil.example' } }), r);
      ok(r.statusCode === 403 && r.payload.error === 'forbidden_origin' && lastFetchUrl === '', name + ': Origin זר → 403, לא פונה ל־IBKR');
      ok(!r.headers['Access-Control-Allow-Origin'], name + ': אין כותרת CORS לאתר זר');
      r = mockRes();
      await fn(mockReq({ body, headers: {} }), r);
      ok(r.statusCode === 403 && lastFetchUrl === '', name + ': בלי Origin (curl) → 403');
      r = mockRes();
      await fn(mockReq({ method: 'OPTIONS' }), r);
      ok(r.statusCode === 204 && r.headers['Access-Control-Allow-Origin'] === 'https://yishaiguedj1.github.io' &&
        /X-App-Key/.test(r.headers['Access-Control-Allow-Headers']), name + ': preflight מהאתר → 204 + X-App-Key מותר');

      process.env.APP_KEY = 'k'.repeat(32);
      r = mockRes();
      await fn(mockReq({ body }), r);
      ok(r.statusCode === 401 && r.payload.error === 'bad_app_key' && lastFetchUrl === '', name + ': APP_KEY מוגדר ואין מפתח → 401');
      r = mockRes();
      await fn(mockReq({ body, headers: { origin: 'https://yishaiguedj1.github.io', 'x-app-key': 'x'.repeat(32) } }), r);
      ok(r.statusCode === 401, name + ': מפתח שגוי → 401');
      r = mockRes();
      await fn(mockReq({ method: 'OPTIONS' }), r);
      ok(r.statusCode === 204, name + ': preflight לא דורש מפתח');
      r = mockRes();
      await fn(mockReq({ body, headers: { origin: 'https://yishaiguedj1.github.io', 'x-app-key': 'k'.repeat(32) } }), r);
      ok(r.statusCode !== 401 && r.statusCode !== 403 && lastFetchUrl !== '', name + ': מפתח נכון → עובר את השמירה ופונה ל־IBKR');
      delete process.env.APP_KEY;

      r = mockRes();
      await fn(mockReq({ body: Object.assign({}, body, { pad: 'x'.repeat(5000) }) }), r);
      ok(r.statusCode === 413, name + ': גוף ענק → 413');
    }
    let r = mockRes();
    await flexRequest(mockReq({ body: { token: '1'.repeat(65), queryId: '999999' } }), r);
    ok(r.statusCode === 400, 'token ארוך מ־64 → 400');
    r = mockRes();
    await flexRequest(mockReq({ body: { token: '1234567890', queryId: '1'.repeat(13) } }), r);
    ok(r.statusCode === 400, 'queryId ארוך מ־12 → 400');
    r = mockRes();
    await flexStatement(mockReq({ body: { token: '1234567890', code: 'AB<script>' } }), r);
    ok(r.statusCode === 400, 'קוד דוח עם תווים לא חוקיים → 400');
  }

  /* ---------- v163: /api/history — היסטוריית מחירים ציבורית מהשרת ---------- */
  {
    mockReq.ip = '8.8.4.4';
    const day = (iso) => Math.floor(Date.parse(iso + 'T00:00:00Z') / 1000);
    const chart = (cur, ts, closes) => ({ chart: { result: [{ meta: { currency: cur, gmtoffset: 0 }, timestamp: ts, indicators: { quote: [{ close: closes }] } }] } });
    const pc = history._parseChart(chart('ILA', [day('2026-09-01'), day('2026-09-02'), day('2026-09-02') + 60, day('2026-09-03')], [7830, null, 7900, 7950]));
    ok(pc.c[0] === 78.3 && pc.c.length === 3 && pc.c[1] === 79, 'history: אגורות → שקלים, בלי ערכים ריקים, יום כפול = האחרון');
    ok(history._parseChart({}) === null, 'history: תשובה לא תקינה → null');
    let urls = [];
    global.fetch = async (url) => {
      urls.push(String(url));
      const sym = decodeURIComponent(/chart\/([^?]+)/.exec(url)[1]);
      if (sym === 'BAD') return { status: 429, json: async () => ({}) };
      const now = Math.floor(Date.now() / 1000);
      const ts = [now - 9 * 365 * 86400, now - 3 * 86400, now - 86400];
      return { status: 200, json: async () => chart('USD', ts, [10, 11, 12]) };
    };
    history._cache.clear();
    let r = mockRes();
    await history(mockReq({ body: { syms: ['spy', 'BAD', 'SPY'], range: '7y' } }), r);
    ok(r.statusCode === 200 && r.payload.ok && r.payload.data.SPY && r.payload.failed.includes('BAD'), 'history: מחזיר נתונים, מסמן כשל, בלי כפילויות');
    ok(r.payload.data.SPY.c.length === 2, 'history: 7y — נחתך ל־7 שנים (מביא 10y)');
    ok(urls.some((u) => /query1\.finance\.yahoo\.com\/v8\/finance\/chart\/SPY\?interval=1d&range=10y/.test(u)), 'history: רק Yahoo chart, 10y ל־7y');
    ok(urls.filter((u) => /BAD/.test(u)).length === 2, 'history: 429 → מנסה את המארח השני ומוותר');
    urls = [];
    r = mockRes();
    await history(mockReq({ body: { syms: ['SPY'], range: '7y' } }), r);
    ok(urls.length === 0 && r.payload.data.SPY, 'history: מטמון — בלי פנייה חוזרת ל־Yahoo');
    r = mockRes();
    await history(mockReq({ body: { syms: ['A/../B'] } }), r);
    ok(r.statusCode === 400, 'history: סימבול לא חוקי → 400');
    r = mockRes();
    await history(mockReq({ body: { syms: Array.from({ length: 41 }, (_, i) => 'S' + i) } }), r);
    ok(r.statusCode === 400, 'history: יותר מ־40 סימבולים → 400');
    r = mockRes();
    await history(mockReq({ body: { syms: ['SPY'] }, headers: { origin: 'https://evil.example' } }), r);
    ok(r.statusCode === 403, 'history: Origin זר → 403');
    r = mockRes();
    await history(mockReq({ method: 'GET', body: {} }), r);
    ok(r.statusCode === 405, 'history: GET → 405');
  }

  /* ---------- v164: /api/quotes — מחיר חי לכל התיק בבקשה אחת ---------- */
  {
    mockReq.ip = '8.8.8.4';
    const full = { chart: { result: [{ meta: { currency: 'USD', regularMarketPrice: 101, chartPreviousClose: 99, gmtoffset: -14400, secret: 'x',
      currentTradingPeriod: { regular: { start: 1, end: 2 } } }, timestamp: [10, 20, 30, 40, 50], indicators: { quote: [{ close: [1, 2, 3, null, 5], open: [1, 1, 1, 1, 1] }] } }] } };
    const tr = quotes._trimChart(full).chart.result[0];
    ok(tr.timestamp.join() === '20,30,50' && tr.indicators.quote[0].close.join() === '2,3,5', 'quotes: 3 הנרות האחרונים עם מחיר (בלי ריקים)');
    ok(tr.meta.chartPreviousClose === 99 && tr.meta.currentTradingPeriod && tr.meta.secret === undefined && !tr.indicators.quote[0].open, 'quotes: רק שדות המטא הנחוצים');
    ok(quotes._trimChart({ chart: { result: null, error: { code: 'x' } } }) === null, 'quotes: שגיאת Yahoo → null');
    let calls = 0;
    global.fetch = async (url) => { calls++; if (/BAD/.test(url)) return { status: 429, json: async () => ({}) }; return { status: 200, json: async () => full }; };
    quotes._cache.clear();
    let r = mockRes();
    await quotes(mockReq({ body: { syms: ['aapl', 'BAD'] } }), r);
    ok(r.statusCode === 200 && r.payload.data.AAPL && r.payload.failed.join() === 'BAD', 'quotes: מחזיר מה שיש, מסמן כשל');
    const c1 = calls;
    r = mockRes();
    await quotes(mockReq({ body: { syms: ['AAPL', 'BAD'] } }), r);
    ok(calls === c1 && r.payload.data.AAPL, 'quotes: מטמון של 1.5 שניות (אותו סט סימבולים) — בלי פנייה חוזרת ל־Yahoo');
    r = mockRes();
    await quotes(mockReq({ body: { syms: Array.from({ length: 41 }, (_, i) => 'S' + i) } }), r);
    ok(r.statusCode === 400, 'quotes: יותר מ־40 → 400');
    r = mockRes();
    await quotes(mockReq({ body: { syms: ['AAPL'] }, headers: { origin: 'https://evil.example' } }), r);
    ok(r.statusCode === 403, 'quotes: Origin זר → 403');
    mockReq.ip = '8.8.8.5';
    let last = 0;
    for (let k = 0; k < 121; k++) { r = mockRes(); await quotes(mockReq({ body: { syms: ['AAPL'] } }), r); last = r.statusCode; }
    ok(last === 429, 'quotes: הגבלת קצב (120 בדקה ל־IP — v165: טיק כל 2 שניות = 30)');
  }

  /* ---------- v165: שדות מורחבים (טרום/אחרי/overnight) ---------- */
  {
    const e = quotes._extFromQuote({ symbol: 'AAPL', currency: 'USD', marketState: 'POST', regularMarketPrice: 341.07, regularMarketChange: 5.15, regularMarketChangePercent: 1.53, regularMarketTime: 1,
      postMarketPrice: 341, postMarketChange: -0.07, postMarketChangePercent: -0.02, postMarketTime: 2, preMarketPrice: 336, preMarketChange: 0.08, preMarketChangePercent: 0.02, preMarketTime: 0 });
    ok(e.state === 'POST' && e.post.p === 341 && e.post.pct === -0.02 && e.pre.p === 336 && e.reg.p === 341.07 && !e.night, 'ext: אחרי־מסחר + טרום־מסחר + סגירה רגילה');
    const n2 = quotes._extFromQuote({ symbol: 'TSLA', marketState: 'OVERNIGHT', regularMarketPrice: 372, overnightMarketPrice: 370.5, overnightMarketChange: -1.5, overnightMarketChangePercent: -0.4, overnightMarketTime: 9 });
    ok(n2.state === 'OVERNIGHT' && n2.night.p === 370.5 && n2.night.pct === -0.4, 'ext: overnight');
    { // v226: בלילה המחיר הראשי בווידג'ט = הלילי; PREPRE = סגור
      const wm = require('../lib/widget-model');
      const ch = { chart: { result: [{ meta: { symbol: 'NOW', currency: 'USD', regularMarketPrice: 135.62, previousClose: 137.78, regularMarketTime: 100, currentTradingPeriod: {} }, timestamp: [200], indicators: { quote: [{ close: [135.6] }] } }] } };
      const qn = wm.parseQuote(Object.assign({ x: { state: 'OVERNIGHT', reg: { p: 135.62, ch: -2.16, pct: -1.57 }, night: { p: 136.74, ch: 1.12, pct: 0.83, t: 300 } } }, ch));
      ok(qn.session === 'night' && qn.price === 136.74 && qn.ext.kind === 'night', 'widget: לילה — המחיר הלילי');
      const qp = wm.parseQuote(Object.assign({ x: { state: 'PREPRE', reg: { p: 135.62 }, post: { p: 135.6, ch: -0.02, pct: -0.02, t: 200 } } }, ch));
      ok(qp.session === 'closed' && qp.price === 135.6 && qp.ext.kind === 'post', 'widget: PREPRE = סגור + אחרי־מסחר אחרון');
    }
    { // v228: בועת שער הדולר בכותרת הווידג'ט
      const wm = require('../lib/widget-model');
      const fxq = (c, pc) => ({ chart: { result: [{ meta: { symbol: 'USDILS=X', regularMarketPrice: c, previousClose: pc }, timestamp: [1], indicators: { quote: [{ close: [c] }] } }] } });
      const wed = Date.UTC(2026, 8, 30, 15), sat = Date.UTC(2026, 9, 3, 15);
      const a = wm.fxOf(fxq(3.0612, 3.05), wed), b = wm.fxOf(fxq(3.04, 3.05), wed), c = wm.fxOf(fxq(3.04, 3.05), sat);
      ok(a.v === '3.06' && a.dir === 'pos' && a.open && b.dir === 'neg', 'widget fx: שתי ספרות, כיוון מול הסגירה הקודמת');
      ok(!c.open && c.dir === 'flat' && wm.fxOf(null) === null, 'widget fx: שבת = סגור (נקודה אפורה); בלי ציטוט = null');
      const m = wm.buildModel([{ sym: 'AAPL', src: 'i', name: 'Apple' }], { 'USDILS=X': fxq(3.06, 3.05) }, {}, { lang: 'he', nowMs: wed });
      ok(m.fx && m.fx.v === '3.06' && m.cards.length === 1, 'widget fx: במודל, לא ככרטיס');
    }
    const il = quotes._extFromQuote({ symbol: 'POLI.TA', currency: 'ILA', marketState: 'POSTPOST', regularMarketPrice: 7830, regularMarketChange: 30 });
    ok(il.reg.p === 78.3 && il.reg.ch === 0.3 && !il.post, 'ext: ת"א אגורות → שקלים, בלי אחרי־מסחר');
    ok(quotes._extFromQuote(null) === null && quotes._extFromQuote({}) === null, 'ext: קלט ריק → null');
    // crumb מתחדש ב־401, ומחיר חוזר גם כש־v7 נכשל לגמרי
    let v7calls = 0, crumbs = 0;
    global.fetch = async (url, o) => {
      const u = String(url);
      if (/fc\.yahoo\.com/.test(u)) return { status: 302, headers: { get: () => 'A3=d=x; Path=/' } };
      if (/getcrumb/.test(u)) { crumbs++; return { status: 200, text: async () => 'crumb' + crumbs }; }
      if (/v7\/finance\/quote/.test(u)) { v7calls++; if (v7calls === 1) return { status: 401, json: async () => ({}) }; return { status: 200, json: async () => ({ quoteResponse: { result: [{ symbol: 'AAPL', marketState: 'PRE', regularMarketPrice: 340, preMarketPrice: 342, preMarketChange: 2, preMarketChangePercent: 0.59, preMarketTime: 5 }] } }) }; }
      return { status: 200, json: async () => ({ chart: { result: [{ meta: { currency: 'USD', regularMarketPrice: 340, gmtoffset: 0 }, timestamp: [1, 2], indicators: { quote: [{ close: [339, 340] }] } }] } }) };
    };
    quotes._cache.clear(); quotes._setCrumb({ cookie: '', crumb: '', at: 0 });
    mockReq.ip = '8.8.8.6';
    let r = mockRes();
    await quotes(mockReq({ body: { syms: ['AAPL'] } }), r);
    ok(r.payload.ext === true && r.payload.data.AAPL.x && r.payload.data.AAPL.x.pre.p === 342 && crumbs === 2, 'quotes: 401 → crumb מתחדש, השדות המורחבים מצורפים');
    global.fetch = async (url) => { const u = String(url); if (/v7\/finance\/quote|getcrumb|fc\.yahoo/.test(u)) throw new Error('down'); return { status: 200, json: async () => ({ chart: { result: [{ meta: { currency: 'USD', regularMarketPrice: 340, gmtoffset: 0 }, timestamp: [1], indicators: { quote: [{ close: [340] }] } }] } }) }; };
    quotes._cache.clear();
    r = mockRes();
    await quotes(mockReq({ body: { syms: ['MSFT'] } }), r);
    ok(r.statusCode === 200 && r.payload.data.MSFT && !r.payload.data.MSFT.x && r.payload.ext === false, 'quotes: v7 למטה → המחיר הבסיסי עדיין מגיע (בלי x)');
    r = mockRes();
    await quotes(mockReq({ body: { syms: ['MSFT'] } }), r);
    ok(r.payload.data.MSFT, 'quotes: מטמון 1.5 שניות לפי סט הסימבולים');
  }

  /* ---------- v239: /api/search — חיפוש סובלני לטעויות ---------- */
  {
    const S = require('../lib/search');
    const search = require('../api/search');
    const U = S.universe();
    ok(U.length > 5000 && U[0].r === 1, 'search: היקום נטען (כל ארה"ב + קרנות סל)');
    const top = (q) => (S.searchUniverse(U, q, 3)[0] || {}).sym;
    const cases = { rddt: 'RDDT', rdtt: 'RDDT', redit: 'RDDT', reddit: 'RDDT', nvidea: 'NVDA', microsft: 'MSFT', tesle: 'TSLA', palantr: 'PLTR',
      cocacola: 'KO', 'coca cola': 'KO', 'service now': 'NOW', facebook: 'META', jpmorgan: 'JPM', 'brk.b': 'BRK-B', brkb: 'BRK-B', netflx: 'NFLX', spy: 'SPY' };
    for (const [q, want] of Object.entries(cases)) ok(top(q) === want, 'search: "' + q + '" → ' + want);
    ok(S.dl('rddt', 'rdtt', 1) === 1 && S.dl('abc', 'xyz', 1) === 2, 'search: מרחק Damerau (החלפת אותיות סמוכות = 1) עם עצירה מוקדמת');
    const m = search._mergeResults([{ sym: 'RDDT', name: 'Reddit', type: 'EQUITY', sc: 1000 }, { sym: 'EDIT', name: 'Editas', type: 'EQUITY', sc: 380 }],
      [{ sym: 'POLI.TA', name: 'Hapoalim', type: 'EQUITY' }, { sym: 'RDDT', name: 'Reddit, Inc.', type: 'EQUITY' }], 8);
    ok(m.map((x) => x.sym).join() === 'RDDT,POLI.TA,EDIT', 'search: מיזוג — התאמה חזקה, Yahoo, חלשה; בלי כפילויות');
    global.fetch = async (url) => ({ status: 200, json: async () => ({ quotes: [{ symbol: 'POLI.TA', quoteType: 'EQUITY', longname: 'Bank Hapoalim' }, { symbol: 'BKHPF', quoteType: 'EQUITY' }, { symbol: '5BK0.F', quoteType: 'EQUITY' }, { symbol: 'X1', quoteType: 'OPTION' }] }) });
    mockReq.ip = '8.8.8.9';
    let r = mockRes();
    await search(mockReq({ body: { q: 'hapoalim' } }), r);
    ok(r.statusCode === 200 && r.payload.items[0].sym === 'POLI.TA' && !r.payload.items.some((x) => x.sym === '5BK0.F' || x.sym === 'X1'), 'search: Yahoo מהשרת — ת"א כן, בורסות זרות/אופציות לא');
    r = mockRes();
    await search(mockReq({ body: { q: 'בנק' } }), r);
    ok(r.statusCode === 400, 'search: עברית → 400 (מקומי באפליקציה)');
  }

  /* ---------- v242: לוגו ת״א בווידג׳ט = PNG מהאתר ---------- */
  {
    const taList = require('../lib/ta-logos.json');
    ok(taList.includes('bank-hapoalim') && taList.includes('elbit-systems') && taList.length >= 40, 'ווידג׳ט: רשימת לוגואי ת״א שהומרו ל־PNG');
  }

  /* ---------- האקדמיה: /api/translate — תרגום בהקשר (Gemini, גיבוי בסיסי) ---------- */
  {
    const translate = require('../api/translate');
    const calls = [];
    const gem = (status, payload) => ({ status, json: async () => payload });
    const okGem = (t, note) => gem(200, { candidates: [{ content: { parts: [{ text: JSON.stringify({ translation: t, note }) }] } }] });
    const mm = (t) => ({ status: 200, json: async () => ({ responseData: { translatedText: t } }) });
    const setFetch = (fn) => { global.fetch = async (url, opt) => { calls.push({ url: String(url), opt }); return fn(String(url), opt); }; };
    const run = async (body, headers) => { const r = mockRes(); await translate(mockReq({ body, headers }), r); return r; };
    const oldKey = process.env.GEMINI_API_KEY;

    delete process.env.GEMINI_API_KEY; translate._cache.clear(); calls.length = 0;
    setFetch((u) => (u.includes('mymemory') ? mm('החפיר') : gem(500, {})));
    let r = await run({ text: 'moat', context: 'A wide moat protects the business.' });
    ok(r.statusCode === 200 && r.payload.engine === 'basic' && r.payload.translation === 'החפיר' && !calls.some((c) => c.url.includes('googleapis')),
      'translate: בלי מפתח — גיבוי בסיסי, בלי פנייה ל־Gemini');

    process.env.GEMINI_API_KEY = 'test-key'; translate._cache.clear(); calls.length = 0;
    setFetch((u) => (u.includes('gemini-flash-latest') ? okGem('חפיר כלכלי', 'יתרון תחרותי עמיד שמגן על העסק') : mm('x')));
    r = await run({ text: 'moat', context: 'A wide moat protects the business.', title: 'מכתב באפט 2023' });
    const g = calls.find((c) => c.url.includes('googleapis'));
    const sent = g && JSON.parse(g.opt.body);
    ok(r.statusCode === 200 && r.payload.engine === 'ai' && r.payload.translation === 'חפיר כלכלי' && r.payload.note.includes('יתרון'),
      'translate: עם מפתח — תרגום AI בהקשר + הסבר מונח');
    ok(g && g.opt.headers['x-goog-api-key'] === 'test-key' && !g.url.includes('test-key'), 'translate: המפתח בכותרת, לא בכתובת');
    ok(sent && sent.contents[0].parts[0].text.includes('A wide moat protects the business.') && sent.contents[0].parts[0].text.includes('מכתב באפט 2023'),
      'translate: נשלחים גם ההקשר וגם שם הספר');

    translate._cache.clear(); calls.length = 0;
    setFetch((u) => (u.includes('gemini-flash-latest') ? gem(404, {}) : u.includes('googleapis') ? okGem('צף') : mm('x')));
    r = await run({ text: 'float', context: 'Insurance float is money we hold.' });
    ok(r.payload.engine === 'ai' && r.payload.translation === 'צף' && calls.filter((c) => c.url.includes('googleapis')).length === 2,
      'translate: מודל שלא קיים (404) — עוברים לבא ברשימה');

    translate._cache.clear(); calls.length = 0;
    setFetch((u) => (u.includes('googleapis') ? gem(429, {}) : mm('בסיסי')));
    r = await run({ text: 'float', context: 'x' });
    ok(r.payload.engine === 'basic' && r.payload.quota === true, 'translate: מכסת החינם נגמרה (429) — גיבוי בסיסי ומסומן');

    calls.length = 0;
    r = await run({ text: 'float', context: 'x' });
    ok(r.payload.engine === 'basic' && calls.length === 0, 'translate: אותו קטע באותו הקשר — מהמטמון');

    r = await run({ text: '   ' });
    ok(r.statusCode === 400, 'translate: טקסט ריק → 400');
    r = await run({ text: 'moat' }, { origin: 'https://evil.example' });
    ok(r.statusCode === 403, 'translate: Origin זר נחסם');
    const p = translate._prompt('moat', 'ctx', 'T', 'he');
    ok(p.sys.includes('עברית') && p.sys.includes('CONTEXT'), 'translate: ההנחיה מבקשת תרגום לפי ההקשר');
    if (oldKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = oldKey;
  }

  /* ---------- האקדמיה שלב 2: /api/library — Drive + אימות קוראים ---------- */
  {
    const crypto = require('crypto');
    const gauth = require('../lib/gauth');
    const lib = require('../api/library');
    const env = ['GDRIVE_SA_KEY', 'LIBRARY_FOLDER_ID', 'LIBRARY_READERS'].map((k) => [k, process.env[k]]);
    const fb = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const sa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const keys = { k1: fb.publicKey.export({ type: 'spki', format: 'pem' }) };
    const b64u = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
    const now = Math.floor(Date.now() / 1000);
    const mkTok = (claims, key = fb.privateKey, kid = 'k1') => {
      const hd = b64u({ alg: 'RS256', kid }); const bd = b64u(Object.assign({ aud: 'yishaiguedj1-c786e', iss: 'https://securetoken.google.com/yishaiguedj1-c786e', sub: 'u1', iat: now - 10, exp: now + 3000, email: 'reader@example.com', email_verified: true }, claims));
      return hd + '.' + bd + '.' + crypto.sign('RSA-SHA256', Buffer.from(hd + '.' + bd), key).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
    };
    const u = await gauth.verifyIdToken(mkTok({}), { keys });
    ok(u.uid === 'u1' && u.email === 'reader@example.com', 'library: אסימון Firebase תקין מאומת (חתימה + פרויקט)');
    const bad = async (tk, why) => { try { await gauth.verifyIdToken(tk, { keys }); return false; } catch (e) { return e.message === why; } };
    ok(await bad(mkTok({}, sa.privateKey), 'bad_token'), 'library: חתימה של מפתח אחר נדחית');
    ok(await bad(mkTok({ aud: 'other-project', iss: 'https://securetoken.google.com/other-project' }), 'wrong_project'), 'library: אסימון של פרויקט אחר נדחה');
    ok(await bad(mkTok({ exp: now - 5 }), 'expired'), 'library: אסימון שפג נדחה');
    ok(await bad('a.b.c', 'bad_token') && await bad(mkTok({}, fb.privateKey, 'nope'), 'bad_token'), 'library: אסימון פגום / מפתח לא מוכר נדחה');
    ok(gauth.readerAllowed(u, 'x@y.com, Reader@Example.com') && !gauth.readerAllowed(u, 'x@y.com') && gauth.readerAllowed(u, '*')
      && !gauth.readerAllowed(Object.assign({}, u, { verified: false }), 'reader@example.com'), 'library: רשימת הרשאות לפי מייל מאומת ("*" = כל מחובר)');

    process.env.GDRIVE_SA_KEY = Buffer.from(JSON.stringify({ client_email: 'sa@p.iam.gserviceaccount.com', private_key: sa.privateKey.export({ type: 'pkcs8', format: 'pem' }), token_uri: 'https://oauth2.googleapis.com/token' })).toString('base64');
    process.env.LIBRARY_FOLDER_ID = 'ROOTFOLDER0001';
    process.env.LIBRARY_READERS = 'reader@example.com';
    const calls = [];
    const J = (o, st = 200) => ({ status: st, json: async () => o, arrayBuffer: async () => Buffer.from('PK-epub'), headers: { get: () => '' } });
    const fakeFetch = async (url, opt) => {
      calls.push({ url, opt });
      if (url.includes('oauth2.googleapis.com/token')) {
        const a = decodeURIComponent(String(opt.body)).split('assertion=')[1].split('.');
        const okSig = crypto.verify('RSA-SHA256', Buffer.from(a[0] + '.' + a[1]), sa.publicKey, Buffer.from(a[2].replace(/-/g, '+').replace(/_/g, '/'), 'base64'));
        return okSig ? J({ access_token: 'AT', expires_in: 3600 }) : J({}, 400);
      }
      if (url.includes('alt=media')) return J({});
      if (url.includes("'ROOTFOLDER0001'")) return J({ files: [{ id: 'SUBFOLDER0001', name: 'באפט', mimeType: 'application/vnd.google-apps.folder' }, { id: 'FILE00000001', name: 'מכתב 2023.epub', size: '61000', md5Checksum: 'aa', modifiedTime: 't' }, { id: 'FILE00000009', name: 'notes.txt', size: '10' }] });
      if (url.includes("'SUBFOLDER0001'")) return J({ files: [{ id: 'FILE00000002', name: 'letter-2022.epub', size: '58000', md5Checksum: 'bb' }] });
      if (url.includes('/FILE00000001?fields')) return J({ parents: ['ROOTFOLDER0001'] });
      if (url.includes('/FILE00000002?fields')) return J({ parents: ['ELSEWHERE0001'] });
      return J({}, 404);
    };
    const run = async (body, headers) => { const r = mockRes(); r.send = (b) => { r.payload = b; return r; }; await lib._handler(mockReq({ body, headers }), r, { verify: { keys }, fetch: fakeFetch }); return r; };
    gauth._reset(); lib._reset();
    let r = await run({ op: 'list', idToken: mkTok({}) });
    ok(r.statusCode === 200 && r.payload.items.map((x) => x.id).join() === 'FILE00000001,FILE00000002', 'library: רשימה — EPUB מהתיקייה ומתת־תיקייה, בלי קבצים אחרים');
    const tokCall = calls.find((c) => c.url.includes('oauth2'));
    ok(tokCall && calls.filter((c) => c.url.includes('googleapis.com/drive')).every((c) => c.opt.headers.Authorization === 'Bearer AT'), 'library: חשבון השירות חותם JWT ומקבל אסימון גישה ל־Drive');
    r = await run({ op: 'file', idToken: mkTok({}), id: 'FILE00000001' });
    ok(r.statusCode === 200 && Buffer.isBuffer(r.payload) && r.headers['Content-Type'] === 'application/epub+zip', 'library: הורדת קובץ מהתיקייה');
    r = await run({ op: 'file', idToken: mkTok({}), id: 'FILE00000002' });
    ok(r.statusCode === 404, 'library: קובץ שההורה שלו מחוץ לתיקייה — נחסם');
    r = await run({ op: 'file', idToken: mkTok({}), id: 'NOTINLIST0001' });
    ok(r.statusCode === 404, 'library: קובץ שלא ברשימה — נחסם (לא דרך השרתון לקבצים אחרים שמשותפים לחשבון)');
    r = await run({ op: 'list', idToken: mkTok({ email: 'stranger@example.com' }) });
    ok(r.statusCode === 403 && r.payload.error === 'not_allowed', 'library: מחובר שלא ברשימת ההרשאות — 403');
    r = await run({ op: 'list', idToken: 'garbage' });
    ok(r.statusCode === 401 && r.payload.error === 'no_auth', 'library: בלי התחברות — 401');
    r = await run({ op: 'list', idToken: mkTok({}) }, { origin: 'https://evil.example' });
    ok(r.statusCode === 403, 'library: Origin זר נחסם');
    r = await run({ op: 'health' });
    ok(r.statusCode === 200 && r.payload.count === 2 && !JSON.stringify(r.payload).includes('epub'), 'library: בדיקת תקינות — רק מספר המכתבים, בלי שמות ובלי התחברות');
    ok(lib._folderId('https://drive.google.com/drive/folders/1AbCdEfGhIjK_l-9?usp=sharing') === '1AbCdEfGhIjK_l-9' && lib._folderId(' 1AbCdEfGhIjK ') === '1AbCdEfGhIjK'
      && lib._folderId('https://drive.google.com/open?id=1AbCdEfGhIjK') === '1AbCdEfGhIjK', 'library: מזהה התיקייה — גם מהקישור המלא');
    // שלב 5: ניתוח מכתב — EPUB סינתטי (ZIP ללא דחיסה) → טקסט → מנוע הניתוח (מדומה)
    const mkZip = (files) => {
      const parts = [], cen = []; let off = 0;
      for (const [name, text] of files) {
        const nb = Buffer.from(name), data = Buffer.from(text);
        const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(0, 8); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(nb.length, 26);
        const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(0, 10); ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(nb.length, 28); ch.writeUInt32LE(off, 42);
        parts.push(lh, nb, data); cen.push(ch, nb); off += 30 + nb.length + data.length;
      }
      const cd = Buffer.concat(cen); const e = Buffer.alloc(22); e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(files.length, 8); e.writeUInt16LE(files.length, 10); e.writeUInt32LE(cd.length, 12); e.writeUInt32LE(off, 16);
      return Buffer.concat([...parts, cd, e]);
    };
    const para = 'מרווח ביטחון הוא העיקרון המרכזי. '.repeat(40);
    const epub = mkZip([['mimetype', 'application/epub+zip'], ['META-INF/container.xml', '<container><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>'],
      ['OEBPS/content.opf', '<package><metadata><dc:title>מכתב בדיקה 1987</dc:title></metadata><manifest><item id="c2" href="t/ch2.xhtml"/><item id="c1" href="t/ch1.xhtml"/></manifest><spine><itemref idref="c1"/><itemref idref="c2"/></spine></package>'],
      ['OEBPS/t/ch1.xhtml', '<html><head><title>x</title></head><body><h1>פרק &amp; ראשון</h1><p>' + para + '</p></body></html>'], ['OEBPS/t/ch2.xhtml', '<html><body><p>פרק שני &#1488;</p></body></html>']]);
    const { epubText } = require('../lib/epubtext');
    const et = epubText(epub);
    ok(et.title === 'מכתב בדיקה 1987' && et.text.startsWith('פרק & ראשון') && et.text.indexOf('פרק שני א') > et.text.indexOf('מרווח'), 'insight: טקסט מ־EPUB לפי סדר ה־spine, בלי תגיות ועם ישויות');
    const { cleanInsight } = require('../lib/insight');
    const ci = cleanInsight({ summary: ' תקציר ', ideas: ['א', '', 'ב'], lens: [{ thinker: 'graham', point: 'מרווח' }, { thinker: 'hacker', point: 'x' }], terms: [{ he: 'פלוט', def: 'כסף' }], question: 'מה?' });
    ok(ci.summary === 'תקציר' && ci.ideas.length === 2 && ci.lens.length === 1 && ci.terms.length === 1 && cleanInsight({ ideas: [] }) === null, 'insight: ניקוי התשובה — רק הוגים מהרשימה, בלי שדות ריקים');
    let aiCalls = 0, aiText = '';
    const fakeFetch2 = async (url, opt) => (url.includes('alt=media') ? { status: 200, arrayBuffer: async () => epub, json: async () => ({}) } : fakeFetch(url, opt));
    const run2 = async (body) => { const r = mockRes(); r.send = (b) => { r.payload = b; return r; };
      await lib._handler(mockReq({ body }), r, { verify: { keys }, fetch: fakeFetch2, insight: async (title, text) => { aiCalls++; aiText = text; return { insight: { summary: 'ס', ideas: ['i'], lens: [], terms: [], question: 'q' } }; } }); return r; };
    lib._reset();
    r = await run2({ op: 'insight', idToken: mkTok({}), id: 'FILE00000001' });
    ok(r.statusCode === 200 && r.payload.insight.summary === 'ס' && aiCalls === 1 && aiText.includes('מרווח ביטחון'), 'insight: הניתוח נבנה מהטקסט האמיתי של המכתב מה־Drive');
    r = await run2({ op: 'insight', idToken: mkTok({}), id: 'FILE00000001' });
    ok(r.statusCode === 200 && aiCalls === 1, 'insight: פעם שנייה — מהמטמון, בלי קריאה נוספת ל־AI');
    r = await run2({ op: 'insight', idToken: mkTok({ email: 'stranger@example.com' }), id: 'FILE00000001' });
    ok(r.statusCode === 403, 'insight: רק לקוראים מורשים');
    r = await run2({ op: 'insight', idToken: mkTok({}), id: 'FILE00000002' });
    ok(r.statusCode === 404, 'insight: קובץ מחוץ לתיקייה — נחסם גם כאן');
    // שלב 6: ניהול קוראים — Firestore מדומה, חתימה, הרשאות מנהל
    {
      const store = { doc: null };
      const fsFetch = async (url, opt = {}) => {
        if (url.includes('firestore.googleapis.com')) {
          if (opt.method === 'PATCH') { store.doc = JSON.parse(opt.body); return { status: 200, json: async () => store.doc }; }
          return store.doc ? { status: 200, json: async () => store.doc } : { status: 404, json: async () => ({}) };
        }
        return fakeFetch(url, opt);
      };
      const run3 = async (body) => { const r = mockRes(); await lib._handler(mockReq({ body }), r, { verify: { keys }, fetch: fsFetch }); return r; };
      process.env.LIBRARY_READERS = 'boss@example.com, reader@example.com';
      lib._reset();
      const boss = mkTok({ email: 'boss@example.com' });
      let x = await run3({ op: 'me', idToken: boss });
      ok(x.payload.admin === true && (await run3({ op: 'me', idToken: mkTok({}) })).payload.admin === false, 'readers: המנהל = המייל הראשון ב־LIBRARY_READERS (בלי LIBRARY_ADMINS)');
      x = await run3({ op: 'addReader', idToken: mkTok({}), email: 'new@example.com' });
      ok(x.statusCode === 403 && x.payload.error === 'not_admin', 'readers: קורא רגיל לא יכול להוסיף קוראים');
      x = await run3({ op: 'addReader', idToken: boss, email: 'New@Example.com' });
      ok(x.statusCode === 200 && x.payload.app.map((a) => a.email).join() === 'new@example.com' && store.doc.fields.sig.stringValue.length === 64, 'readers: המנהל מוסיף קורא — נשמר ב־Firestore עם חתימה');
      x = await run3({ op: 'list', idToken: mkTok({ email: 'new@example.com' }) });
      ok(x.statusCode === 200, 'readers: קורא שנוסף מהאפליקציה נכנס לספרייה');
      store.doc.fields.readers.arrayValue.values.push({ stringValue: 'hacker@example.com|1' });
      require('../lib/readers')._reset(); lib._reset();
      x = await run3({ op: 'list', idToken: mkTok({ email: 'hacker@example.com' }) });
      ok(x.statusCode === 403, 'readers: מי שהוסיף את עצמו ישירות ב־Firestore (בלי חתימה תקינה) — נחסם');
      x = await run3({ op: 'list', idToken: mkTok({ email: 'new@example.com' }) });
      ok(x.statusCode === 403, 'readers: רשימה שזויפה נפסלת כולה');
      x = await run3({ op: 'addReader', idToken: boss, email: 'not-an-email' });
      ok(x.statusCode === 400, 'readers: מייל לא תקין נדחה');
      store.doc = null; require('../lib/readers')._reset();
      await run3({ op: 'addReader', idToken: boss, email: 'a@example.com' });
      x = await run3({ op: 'removeReader', idToken: boss, email: 'a@example.com' });
      ok(x.statusCode === 200 && x.payload.app.length === 0 && x.payload.env.includes('boss@example.com'), 'readers: הסרה + רשימת Vercel מוצגת בנפרד');
      process.env.LIBRARY_READERS = 'reader@example.com';
    }
    delete process.env.GDRIVE_SA_KEY;
    r = await run({ op: 'list', idToken: mkTok({}) });
    ok(r.statusCode === 503 && r.payload.error === 'not_configured', 'library: בלי חשבון שירות — not_configured (האפליקציה שקטה)');
    env.forEach(([k, v]) => { if (v === undefined) delete process.env[k]; else process.env[k] = v; });
  }

  console.log(`\nכל ${n} הבדיקות עברו ✓`);
})().catch((e) => { console.error('נכשל:', e.message); process.exit(1); });
