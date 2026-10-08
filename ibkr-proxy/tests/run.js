/* בדיקות ל-ibkr-proxy. הרצה: node tests/run.js */
const assert = require('node:assert/strict');
const { statementBaseFrom, statementEndpointFrom, errorXml, ibkrUserAgent, FLEX_SEND_PATH, FLEX_GET_PATH, parseXml, statementToJson } = require('../lib/ibkr');
const flexStatement = require('../api/flex-statement');
const flexRequest = require('../api/flex-request');
const history = require('../api/history');
const quotes = require('../api/quotes');

let n = 0;
process.env.AI_ANON_DAILY = process.env.AI_ANON_DAILY || '1000000';   // v339: בבדיקות הישנות — בלי מגבלה יומית לכתובת
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
  r.send = (b) => { r.payload = b; return r; };
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
    setFetch((u) => (u.includes('gemini-3.5-flash-lite') ? okGem('חפיר כלכלי', 'יתרון תחרותי עמיד שמגן על העסק') : mm('x')));
    r = await run({ text: 'moat', context: 'A wide moat protects the business.', title: 'מכתב באפט 2023' });
    const g = calls.find((c) => c.url.includes('googleapis'));
    const sent = g && JSON.parse(g.opt.body);
    ok(r.statusCode === 200 && r.payload.engine === 'ai' && r.payload.translation === 'חפיר כלכלי' && r.payload.note.includes('יתרון'),
      'translate: עם מפתח — תרגום AI בהקשר + הסבר מונח');
    ok(g && g.opt.headers['x-goog-api-key'] === 'test-key' && !g.url.includes('test-key'), 'translate: המפתח בכותרת, לא בכתובת');
    ok(sent && sent.contents[0].parts[0].text.includes('A wide moat protects the business.') && sent.contents[0].parts[0].text.includes('מכתב באפט 2023'),
      'translate: נשלחים גם ההקשר וגם שם הספר');

    translate._cache.clear(); calls.length = 0;
    setFetch((u) => (u.includes('gemini-3.5-flash-lite') ? gem(404, {}) : u.includes('googleapis') ? okGem('צף') : mm('x')));
    r = await run({ text: 'float', context: 'Insurance float is money we hold.' });
    ok(r.payload.engine === 'ai' && r.payload.translation === 'צף' && calls.filter((c) => c.url.includes('googleapis')).length === 2,
      'translate: מודל שלא קיים (404) — עוברים לבא ברשימה');

    // v333: התרגום פונה קודם ל־Flash-Lite (מכסה חינמית גדולה פי ~25), ו־429 של מודל אחד לא עוצר
    translate._cache.clear(); calls.length = 0;
    setFetch((u) => (u.includes('gemini-3.5-flash-lite') ? gem(429, {}) : u.includes('googleapis') ? okGem('צף ביטוחי') : mm('x')));
    r = await run({ text: 'float', context: 'Insurance float.' });
    const gm = calls.filter((c) => c.url.includes('googleapis')).map((c) => c.url.split('/models/')[1].split(':')[0]);
    ok(gm[0] === 'gemini-3.5-flash-lite' && r.payload.engine === 'ai' && r.payload.quota === false && r.payload.translation === 'צף ביטוחי',
      'translate: 429 במודל הראשון — ממשיכים למודל הבא (לכל מודל מכסה נפרדת), בלי "מכסה" למשתמש');
    translate._cache.clear(); calls.length = 0;
    setFetch((u) => (u.includes('gemini-3.5-flash-lite') ? okGem('חפير עמוק') : u.includes('googleapis') ? okGem('חפיר') : mm('x')));
    r = await run({ text: 'moat', context: 'wide moat' });
    ok(r.payload.translation === 'חפיר' && r.payload.diag['gemini-3.5-flash-lite:err'] === 'mixed_script', 'translate: עברית עם אותיות ערביות ("חפير" — נמצא חי) נפסלת');
    translate._cache.clear(); calls.length = 0;
    setFetch((u) => (u.includes('googleapis') ? okGem('חפير כלכלי') : mm('בסיסי')));
    r = await run({ text: 'moat', context: 'durable moat' });
    ok(r.payload.engine === 'ai' && r.payload.translation === 'חפיר כלכלי',
      'translate v335: כל המודלים גלשו לערבית — הגרסה המתוקנת ולא תרגום בסיסי בלי הקשר וויקיפדיה');
    translate._cache.clear(); calls.length = 0;
    setFetch((u) => (u.includes('googleapis') ? okGem('חפير כלכלי') : mm('בסיסי')));
    r = await run({ text: 'moat', context: 'durable moat' });
    ok(r.payload.engine === 'ai' && r.payload.translation === 'חפיר כלכלי' && !/[\u0600-\u06FF]/.test(r.payload.translation),
      'translate v335: כל המודלים גלשו לערבית — הגרסה המתוקנת ("חפיר") ולא תרגום בסיסי בלי הקשר וויקיפדיה');
    // מצב מהיר: הכרטיס של Google Translate
    translate._cache.clear(); calls.length = 0;
    setFetch((u) => (u.includes('clients5.google.com') ? { status: 200, json: async () => ({ sentences: [{ trans: 'תְעָלַת מָגֵן', orig: 'moat' }], dict: [{ pos: 'שם עצם', terms: ['תְעָלַת מָגֵן', 'חפיר', 'חפיר'] }], src: 'en' }) } : gem(500, {})));
    r = await run({ text: 'moat', mode: 'quick' });
    ok(r.payload.engine === 'google' && r.payload.translation === 'תְעָלַת מָגֵן' && r.payload.dict[0].terms.join() === 'תְעָלַת מָגֵן,חפיר' && r.payload.src === 'en' && !calls.some((c) => c.url.includes('googleapis')),
      'translate quick: תרגום + חלקי דיבר, עם הניקוד (v334 — בלעדיו כתיב מנוקד נשבר) ובלי כפילויות, בלי Gemini');

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
  /* v334: ניתוח מכתב — Flash-Lite ראשון (החלטת המשתמש), Flash גיבוי, Mistral אחרון */
  {
    const { insight } = require('../lib/insight');
    const oldKey = process.env.GEMINI_API_KEY, oldM = process.env.MISTRAL_API_KEY; process.env.GEMINI_API_KEY = 'k'; delete process.env.MISTRAL_API_KEY;
    const seen = [];
    const good = { status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ summary: 'תקציר', ideas: ['א'], question: 'ש' }) }] } }] }) };
    const name = (u) => (String(u).includes('/models/') ? String(u).split('/models/')[1].split(':')[0] : 'mistral');
    let o = await insight('T', 'text', async (u) => { const m = name(u); seen.push(m); return /lite/.test(m) ? { status: 429, json: async () => ({}) } : good; });
    ok(/lite/.test(seen[0]) && o.insight && !/lite/.test(o.insight.model), 'insight: Flash-Lite ראשון; במכסה (429) — ממשיכים ל־Flash');
    o = await insight('T', 'text', async () => ({ status: 429, json: async () => ({}) }));
    ok(o.error === 'quota', 'insight: "מכסה" רק כשכל המודלים החזירו 429 (בלי מפתח Mistral)');
    process.env.MISTRAL_API_KEY = 'mk'; const calls2 = [];
    o = await insight('T', 'text', async (u, opt) => { calls2.push({ u: String(u), opt }); if (String(u).includes('mistral.ai')) return { status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify({ summary: 'תקציר ממיסטרל', ideas: ['א'], question: 'ש' }) } }] }) }; return { status: 429, json: async () => ({}) }; });
    const mc = calls2.find((c) => c.u.includes('mistral.ai'));
    ok(o.insight && o.insight.summary === 'תקציר ממיסטרל' && o.insight.model === 'ministral-14b-latest', 'insight: כל Gemini במכסה — Ministral 14B כגיבוי אחרון, והמודל מדווח');
    ok(mc && mc.opt.headers.Authorization === 'Bearer mk' && !mc.u.includes('mk'), 'insight: מפתח Mistral בכותרת, לא בכתובת');
    if (oldKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = oldKey;
    if (oldM === undefined) delete process.env.MISTRAL_API_KEY; else process.env.MISTRAL_API_KEY = oldM;
  }
  /* v334: "בהקשר הזה" — Mistral ראשון, Gemini גיבוי, שם המודל בתשובה */
  {
    const translate = require('../api/translate');
    const oldG = process.env.GEMINI_API_KEY, oldM = process.env.MISTRAL_API_KEY;
    process.env.GEMINI_API_KEY = 'g'; process.env.MISTRAL_API_KEY = 'm';
    const calls = [];
    const mOk = (o) => ({ status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify(o) } }] }) });
    const gOk = (o) => ({ status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(o) }] } }] }) });
    const run = async (body) => { const r = mockRes(); await translate(mockReq({ body }), r); return r; };
    const set = (fn) => { global.fetch = async (u, opt) => { calls.push({ u: String(u), opt }); return fn(String(u), opt); }; };
    translate._cache.clear(); translate._hits.clear(); calls.length = 0;
    set((u) => (u.includes('googleapis') ? gOk({ translation: 'חפיר כלכלי', note: 'יתרון תחרותי עמיד', wiki: 'Economic moat' }) : mOk({ translation: 'x' })));
    let r = await run({ text: 'moat', context: 'a wide moat', title: 'T' });
    ok(r.payload.provider === 'gemini' && r.payload.model === 'gemini-3.5-flash-lite' && r.payload.wiki === 'Economic moat' && !calls.some((c) => c.u.includes('mistral.ai')),
      'context v339: Gemini 3.5 Flash-Lite ראשון — תרגום, הערה, שם ערך ושם המודל; בלי פנייה ל־Mistral');
    translate._cache.clear(); calls.length = 0;
    set((u) => (u.includes('googleapis') ? { status: 429, json: async () => ({}) } : mOk({ translation: 'חפיר כלכלי', note: 'יתרון תחרותי עמיד', wiki: 'Economic moat' })));
    r = await run({ text: 'moat', context: 'a wide moat 2', title: 'T' });
    const sent = JSON.parse(calls.find((c) => c.u.includes('mistral.ai')).opt.body);
    ok(r.payload.provider === 'mistral' && r.payload.model === 'ministral-14b-latest' && r.payload.quota === false && r.payload.wiki === 'Economic moat',
      'context v339: כל Gemini במכסה — Ministral 14B (חינמי) כגיבוי, בלי "מכסה" למשתמש');
    ok(sent.response_format.type === 'json_object' && /wiki/.test(sent.messages[0].content) && sent.messages[1].content.includes('a wide moat 2'), 'context: JSON בלבד, ההנחיה מבקשת גם ערך ויקיפדיה, וההקשר נשלח');
    translate._cache.clear(); calls.length = 0;
    const mm = (t) => ({ status: 200, json: async () => ({ responseData: { translatedText: t } }) });
    set((u) => (u.includes('googleapis') ? { status: 429, json: async () => ({}) } : u.includes('mistral.ai') ? { status: 429, json: async () => ({}) } : mm('בסיסי')));
    r = await run({ text: 'float', context: 'insurance float' });
    ok(r.payload.engine === 'basic' && r.payload.quota === true, 'context: כולם במכסה — תרגום בסיסי + "מכסה"');
    translate._cache.clear(); calls.length = 0;
    set((u) => (u.includes('googleapis') ? { status: 429, json: async () => ({}) } : u.includes('mistral.ai') ? mOk({ translation: 'חפير', note: '' }) : mm('בסיסי')));
    r = await run({ text: 'moat', context: 'c' });
    ok(r.payload.provider !== 'mistral' && r.payload.translation !== 'חפير', 'context: כתב מעורב מ־Mistral נפסל');
    translate._cache.clear(); calls.length = 0;
    set((u) => (u.includes('mistral.ai') ? mOk({ translation: 'ממיסטרל' }) : gOk({ translation: 'מג׳מיני' })));
    r = await run({ text: 'moat', context: 'c', only: 'gemini' });
    ok(r.payload.provider === 'gemini' && !calls.some((c) => c.u.includes('mistral.ai')), 'השוואה: only=gemini — רק Gemini');
    r = await run({ text: 'moat', context: 'c', only: 'mistral' });
    ok(r.payload.provider === 'mistral' && r.payload.translation === 'ממיסטרל', 'השוואה: only=mistral — רק Mistral');
    // v338: אבחון חשבון Mistral — תקינות המפתח, מודלים, וכותרות המגבלה, בלי לחשוף את המפתח
    calls.length = 0;
    set((u) => (u.endsWith('/v1/models') ? { status: 200, json: async () => ({ data: [{ id: 'mistral-small-latest' }, { id: 'x-2501' }] }) }
      : { status: 429, headers: new Map([['x-ratelimit-limit-tokens-minute', '0'], ['content-type', 'json']]), json: async () => ({ message: 'Rate limit exceeded' }) }));
    r = await run({ text: 'x', mode: 'mistralProbe' });
    const pj = JSON.stringify(r.payload);
    ok(r.payload.models === 200 && r.payload.modelCount === 2 && r.payload.chat['mistral-small-latest'].status === 429 && r.payload.chat['mistral-small-latest'].h['x-ratelimit-limit-tokens-minute'] === '0' && !pj.includes('"m"') && !/Bearer/.test(pj),
      'v338: אבחון Mistral — מודלים, סטטוס לכל מודל, כותרות מגבלה; בלי המפתח');
    if (oldG === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = oldG;
    if (oldM === undefined) delete process.env.MISTRAL_API_KEY; else process.env.MISTRAL_API_KEY = oldM;
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

  /* ---------- סנכרון IBKR ברקע: /api/ibkr-sync + כספת מוצפנת (Firestore מדומה, IBKR מדומה) ---------- */
  {
    const crypto = require('crypto'), fs = require('fs'), path = require('path');
    const gauth = require('../lib/gauth');
    const vault = require('../lib/vault');
    const D = require('../lib/ibkrdates');
    const sync = require('../api/ibkr-sync');
    const env = ['GDRIVE_SA_KEY', 'LIBRARY_READERS', 'IBKR_VAULT_KEY', 'IBKR_SYNC_USERS', 'CRON_SECRET'].map((k) => [k, process.env[k]]);
    ['IBKR_VAULT_KEY', 'IBKR_SYNC_USERS', 'CRON_SECRET'].forEach((k) => delete process.env[k]);
    const fb = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const sa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    process.env.GDRIVE_SA_KEY = JSON.stringify({ client_email: 'sa@p.iam.gserviceaccount.com', private_key: sa.privateKey.export({ type: 'pkcs8', format: 'pem' }) });
    process.env.LIBRARY_READERS = 'owner@example.com, reader@example.com';
    gauth._reset();
    const keys = { k1: fb.publicKey.export({ type: 'spki', format: 'pem' }) };
    const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
    const tnow = Math.floor(Date.now() / 1000);
    const tok = (sub, email) => {
      const hd = b64u({ alg: 'RS256', kid: 'k1' }), bd = b64u({ aud: 'yishaiguedj1-c786e', iss: 'https://securetoken.google.com/yishaiguedj1-c786e', sub, iat: tnow - 5, exp: tnow + 3000, email, email_verified: true });
      return hd + '.' + bd + '.' + crypto.sign('RSA-SHA256', Buffer.from(hd + '.' + bd), fb.privateKey).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
    };
    const OWNER = tok('ownerUid0001', 'owner@example.com'), OTHER = tok('otherUid0002', 'reader@example.com');

    // כספת: סודיות, שלמות, קשירה למשתמש ולשדה
    const sealed = vault.seal({ t: '123456789012345678', q: '999999' }, 'u1|c');
    ok(/^v1\.s\./.test(sealed) && !sealed.includes('123456789012345678') && vault.seal({ a: 1 }, 'x') !== vault.seal({ a: 1 }, 'x'), 'כספת: מוצפן (לא טקסט גלוי), IV אקראי — אותו ערך מוצפן אחרת בכל פעם');
    ok(vault.open(sealed, 'u1|c').t === '123456789012345678', 'כספת: נפתח עם אותו משתמש ושדה');
    ok(vault.open(sealed, 'u2|c') === null && vault.open(sealed, 'u1|a') === null, 'כספת: ערך שהועתק למשתמש/שדה אחר — לא נפתח (AAD)');
    const parts = sealed.split('.'); const ct = Buffer.from(parts[3].replace(/-/g, '+').replace(/_/g, '/'), 'base64'); ct[2] ^= 1;
    ok(vault.open(parts.slice(0, 3).join('.') + '.' + ct.toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_'), 'u1|c') === null && vault.open('garbage', 'u1|c') === null, 'כספת: שינוי של ביט אחד / זבל — נדחה (GCM)');
    process.env.IBKR_VAULT_KEY = crypto.randomBytes(32).toString('base64');
    const sealedE = vault.seal({ z: 1 }, 'u1|c');
    ok(/^v1\.e\./.test(sealedE) && vault.open(sealed, 'u1|c') && vault.open(sealedE, 'u1|c').z === 1, 'כספת: מפתח ייעודי (IBKR_VAULT_KEY) גובר, ורשומות ישנות עדיין נפתחות');
    delete process.env.IBKR_VAULT_KEY;
    ok(vault.open(sealedE, 'u1|c') === null, 'כספת: בלי המפתח — אי אפשר לפתוח');

    // התאריכים בשרתון = התאריכים באפליקציה (אחרת החלקים לא יתאימו)
    const appSrc = fs.readFileSync(path.join(__dirname, '..', '..', 'app.js'), 'utf8');
    const grab = (name) => appSrc.match(new RegExp('function ' + name + '\\([\\s\\S]*?\\n}\\n'))[0];
    const A = new Function(['ibkrYmd', 'ibkrDateChunks', 'ibkrLastClosedDate', 'ibkrHasWeekday', 'ibkrAutoTargetMs'].map(grab).join('\n') + '\nconst IBKR_AUTO_HOUR_IL = ' + (appSrc.match(/const IBKR_AUTO_HOUR_IL = (\d+)/) || [])[1] + ';\nreturn { ibkrYmd, ibkrDateChunks, ibkrLastClosedDate, ibkrHasWeekday, ibkrAutoTargetMs };')();
    const ranges = [['20261001', '20261004'], ['20251215', '20260105'], ['20240101', '20241231'], ['20230601', '20260930'], ['20261003', '20261004']];
    const times = [Date.UTC(2026, 9, 5, 12, 10), Date.UTC(2026, 9, 4, 22, 30), Date.UTC(2026, 0, 1, 3, 0), Date.UTC(2026, 2, 29, 11, 59), Date.UTC(2026, 10, 2, 12, 5)];
    ok(ranges.every(([a, b]) => JSON.stringify(D.dateChunks(a, b)) === JSON.stringify(A.ibkrDateChunks(a, b)) && D.hasWeekday(a, b) === A.ibkrHasWeekday(a, b))
      && times.every((t) => D.lastClosedYmd(t) === A.ibkrYmd(A.ibkrLastClosedDate(new Date(t))) && D.autoTargetMs(t) === A.ibkrAutoTargetMs(t)), 'סנכרון ברקע: חלוקה לחלקים, יום סגירה ושעת היעד — זהים לאפליקציה');

    // Firestore מדומה
    const store = new Map(); let ver = 0; const fsCalls = [];
    const J = (o, st = 200) => ({ status: st, json: async () => o });
    const fakeFetch = async (url, opt = {}) => {
      if (url.includes('oauth2.googleapis.com/token')) return J({ access_token: 'AT', expires_in: 3600 });
      fsCalls.push({ url, method: opt.method });
      const m = url.match(/documents\/ibkrVault(?:\/([A-Za-z0-9]+))?(?:\?(.*))?$/); if (!m) return J({}, 404);
      const [, uid, qs = ''] = m; const q = new URLSearchParams(qs);
      if (!uid) return J({ documents: [...store.entries()].map(([k, v]) => ({ name: 'projects/p/databases/(default)/documents/ibkrVault/' + k, fields: v.fields, updateTime: v.updateTime })) });
      const cur = store.get(uid);
      if (opt.method === 'GET') return cur ? J({ fields: cur.fields, updateTime: cur.updateTime }) : J({}, 404);
      if (opt.method === 'DELETE') { store.delete(uid); return J({}); }
      if (opt.method === 'PATCH') {
        const pre = q.get('currentDocument.updateTime');
        if (pre && (!cur || cur.updateTime !== pre)) return J({ error: { status: 'FAILED_PRECONDITION' } }, 400);
        const mask = q.getAll('updateMask.fieldPaths'); const body = JSON.parse(opt.body).fields;
        const fields = mask.length ? Object.assign({}, cur ? cur.fields : {}, ...mask.map((k) => ({ [k]: body[k] }))) : body;
        store.set(uid, { fields, updateTime: 't' + (++ver) }); return J({ fields, updateTime: 't' + ver });
      }
      return J({}, 400);
    };
    // IBKR מדומה: SendRequest → קוד, GetStatement → פעם אחת "בהכנה" ואז הדוח
    let ib = { send: 0, get: 0, mode: 'ok' };
    const fakeIbkr = async (p) => {
      if (p.includes('/SendRequest')) { ib.send++; ib.lastSend = p; return ib.mode === 'throttle' ? { status: 200, text: '<FlexStatementResponse><Status>Fail</Status><ErrorCode>1018</ErrorCode><ErrorMessage>Too many</ErrorMessage></FlexStatementResponse>' } : { status: 200, text: '<FlexStatementResponse><Status>Success</Status><ReferenceCode>REF123456</ReferenceCode><Url>https://gdcdyn.interactivebrokers.com/AccountManagement/FlexWebService/GetStatement</Url></FlexStatementResponse>' }; }
      ib.get++; return { status: 200, text: ib.get % 2 ? PENDING_XML : READY_XML };
    };
    const NOW = Date.UTC(2026, 9, 5, 12, 10);   // שני 15:10 שעון ישראל
    const deps = { verify: { keys }, fetch: fakeFetch, ibkrGetMulti: fakeIbkr, sleep: async () => {}, now: NOW };
    const post = async (body) => { const r = mockRes(); await sync._handler(mockReq({ body }), r, deps); return r; };
    const cronRun = async (headers = {}) => { const r = mockRes(); await sync._handler({ method: 'GET', headers, query: {} }, r, deps); return r; };

    let r = await post({ op: 'enable', idToken: OTHER, token: '123456789012345678', queryId: '999999', have: '2026-09-30' });
    ok(r.statusCode === 403 && !store.size, 'סנכרון ברקע: משתמש שאינו מורשה (לא המנהל) — נחסם, שום דבר לא נשמר');
    r = await post({ op: 'enable', token: '123456789012345678', queryId: '999999', have: '2026-09-30' });
    ok(r.statusCode === 401, 'סנכרון ברקע: בלי התחברות מאומתת — 401');
    r = await post({ op: 'enable', idToken: OWNER, token: '123456789012345678', queryId: '999999', have: '2026-09-30' });
    const rec = store.get('ownerUid0001');
    ok(r.statusCode === 200 && rec && !JSON.stringify(rec).includes('123456789012345678') && !JSON.stringify(rec).includes('999999') && !JSON.stringify(rec).includes('20261001'), 'סנכרון ברקע: ה־token, ה־Query ID ונקודת ההמשך נשמרים בענן רק מוצפנים');
    ok(vault.open(rec.fields.a.stringValue, 'ownerUid0001|a').from === '20261001', 'סנכרון ברקע: ממשיכים ביום שאחרי הנתונים שבטלפון');
    r = await post({ op: 'status', idToken: OWNER });
    ok(r.payload.enabled && r.payload.allowed && !('token' in r.payload) && !JSON.stringify(r.payload).includes('123456789012345678'), 'סנכרון ברקע: סטטוס — בלי להחזיר את ה־token');

    r = await cronRun();
    ok(r.statusCode === 200 && r.payload.runs.owne === 'ok' && ib.send === 1 && /fd=20261001&td=20261004/.test(ib.lastSend), 'קרון: מושך מ־IBKR בדיוק את החלק החסר (מהיום שאחרי עד יום הסגירה)');
    ok(!JSON.stringify(store.get('ownerUid0001')).includes('AAPL') && !JSON.stringify(r.payload).includes('AAPL'), 'קרון: הדוח נשמר מוצפן, והתשובה בלי נתונים');
    const sends = ib.send; r = await cronRun(); await cronRun();
    ok(ib.send === sends && r.payload.runs.owne === 'skip', 'קרון: קריאות חוזרות באותו יום (גם מבחוץ) — לא פונות ל־IBKR שוב');

    r = await post({ op: 'pull', idToken: OWNER, have: '2026-09-30' });
    ok(r.payload.chunks.length === 1 && r.payload.chunks[0].fd === '20261001' && r.payload.chunks[0].td === '20261004' && r.payload.chunks[0].data.trades[0].symbol === 'AAPL', 'משיכה מהענן: החלק המוכן חוזר מפוענח, בדיוק בצורה של flex-statement');
    r = await post({ op: 'pull', idToken: OTHER, have: '2026-09-30' });
    ok(r.statusCode === 403, 'משיכה מהענן: משתמש אחר לא מקבל את הדוח');
    r = await post({ op: 'ack', idToken: OWNER, have: '2026-10-04' });
    const after = store.get('ownerUid0001');
    ok(r.statusCode === 200 && vault.open(after.fields.s.stringValue, 'ownerUid0001|s').chunks.length === 0 && vault.open(after.fields.a.stringValue, 'ownerUid0001|a').from === '20261005', 'אחרי ייבוא: הדוח נמחק מהענן ונקודת ההמשך מתקדמת');

    // הגבלת קצב של IBKR — עוצרים, לא מנסים שוב
    store.get('ownerUid0001').fields.run = { integerValue: '0' };
    store.get('ownerUid0001').fields.a = { stringValue: vault.seal({ from: '20260928' }, 'ownerUid0001|a') };
    ib = { send: 0, get: 0, mode: 'throttle' };
    r = await cronRun();
    ok(r.payload.runs.owne === 'flex_1018' && ib.send === 1 && ib.get === 0 && store.get('ownerUid0001').fields.err.stringValue === 'flex_1018', 'קרון: הגבלת קצב (1018) — בקשה אחת, שומר קוד שגיאה, בלי ניסיון חוזר');

    // רשומה מזויפת (נכתבה ישירות ל־Firestore בלי המפתח) — לא נפתחת ולא פונה ל־IBKR
    store.set('fakeUid00003', { fields: { c: { stringValue: 'v1.s.AAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAAAAAAAA' }, a: { stringValue: 'x' }, run: { integerValue: '0' } }, updateTime: 'tf' });
    ib = { send: 0, get: 0, mode: 'ok' }; store.get('ownerUid0001').fields.run = { integerValue: String(NOW) };
    r = await cronRun();
    ok(r.payload.runs.fake === 'bad' && ib.send === 0, 'קרון: רשומה מזויפת בלי המפתח — נפסלת, בלי פנייה ל־IBKR');

    process.env.CRON_SECRET = 'cron-secret-123';
    r = await cronRun();
    const r2 = await cronRun({ authorization: 'Bearer cron-secret-123' });
    ok(r.statusCode === 401 && r2.statusCode === 200, 'קרון: עם CRON_SECRET — רק Vercel Cron (Bearer) יכול להפעיל');
    delete process.env.CRON_SECRET;

    r = await post({ op: 'disable', idToken: OWNER });
    const r3 = await post({ op: 'pull', idToken: OWNER, have: '2026-10-04' });
    ok(r.statusCode === 200 && !store.has('ownerUid0001') && r3.payload.enabled === false, 'ביטול: הרשומה (כולל ה־token המוצפן) נמחקת מהענן');
    r = await (async () => { const x = mockRes(); await sync._handler(mockReq({ body: { op: 'status', idToken: OWNER }, headers: { origin: 'https://evil.example.com' } }), x, deps); return x; })();
    ok(r.statusCode === 403, 'סנכרון ברקע: Origin לא מאושר — נחסם');
    env.forEach(([k, v]) => { if (v === undefined) delete process.env[k]; else process.env[k] = v; });
    gauth._reset();
  }

  /* ---------- פרטי ספר מהאינטרנט (bookmeta) — 4 מקורות מדומים, בלי רשת ---------- */
  {
    const bm = require('../lib/bookmeta');
    const api = require('../api/bookmeta');
    const NLI = `<searchRetrieveResponse><records><record><recordData><record xmlns="http://www.loc.gov/MARC21/slim">
<controlfield tag="001">990012345</controlfield><controlfield tag="008">191104s2010    is            000 0 heb d</controlfield>
<datafield ind1=" " ind2=" " tag="020"><subfield code="a">978-965-545-123-0</subfield></datafield>
<datafield ind1="1" ind2=" " tag="100"><subfield code="a">גראהם, בנג'מין,</subfield></datafield>
<datafield ind1="1" ind2="0" tag="245"><subfield code="a">המשקיע הנבון :</subfield><subfield code="b">מדריך מעשי /</subfield></datafield>
<datafield ind1=" " ind2="1" tag="264"><subfield code="a">תל אביב :</subfield><subfield code="b">סיאל,</subfield><subfield code="c">2010.</subfield></datafield>
<datafield ind1=" " ind2=" " tag="300"><subfield code="a">623 עמודים ;</subfield></datafield>
<datafield ind1=" " ind2="0" tag="650"><subfield code="a">השקעות.</subfield></datafield>
<datafield ind1="1" ind2=" " tag="700"><subfield code="a">צוויג, ג'ייסון.</subfield></datafield>
</record></recordData></record></records></searchRetrieveResponse>`;
    const GOOGLE = { items: [{ id: 'g1', volumeInfo: { title: 'The Intelligent Investor', subtitle: 'The Definitive Book on Value Investing', authors: ['Benjamin Graham'], publisher: 'Harper', publishedDate: '2006-02-21', description: '<p>The <b>classic</b> text</p>', industryIdentifiers: [{ type: 'ISBN_10', identifier: '0060555661' }, { type: 'ISBN_13', identifier: '9780060555665' }], pageCount: 640, categories: ['Business & Economics'], language: 'en', imageLinks: { thumbnail: 'http://books.google.com/books/content?id=g1&printsec=frontcover&img=1&zoom=1&edge=curl' } } }] };
    const OL = { docs: [{ key: '/works/OL1W', title: 'The intelligent investor', author_name: ['Benjamin Graham'], publisher: ['Harper'], first_publish_year: 1949, isbn: ['9780060555665'], language: ['eng'], cover_i: 42, subject: ['Investments'] }] };
    const APPLE = { results: [{ trackId: 7, trackName: 'The Intelligent Investor', artistName: 'Benjamin Graham', releaseDate: '2009-03-17T07:00:00Z', description: 'Desc', genres: ['Books', 'Investing'], artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/x/100x100bb.jpg' }] };
    const urls = [];
    const fake = async (u) => {
      urls.push(String(u));
      const j = (o) => ({ status: 200, json: async () => o, text: async () => JSON.stringify(o) });
      if (/alma\.exlibrisgroup/.test(u)) return { status: 200, text: async () => NLI };
      if (/googleapis\.com\/books/.test(u)) return j(GOOGLE);
      if (/openlibrary\.org\/works/.test(u)) return j({ description: { value: 'From the works record' } });
      if (/openlibrary\.org\/search/.test(u)) return j(OL);
      if (/itunes\.apple\.com/.test(u)) return j(APPLE);
      return { status: 404 };
    };
    const n1 = bm.parseNli(NLI)[0];
    ok(n1.title === 'המשקיע הנבון' && n1.subtitle === 'מדריך מעשי' && n1.authors[0] === "בנג'מין גראהם" && n1.authors[1] === "ג'ייסון צוויג" && n1.authorSort === "גראהם, בנג'מין"
      && n1.publisher === 'סיאל' && n1.year === 2010 && n1.lang === 'he' && n1.isbn === '9789655451230' && n1.pages === 623 && n1.tags[0] === 'השקעות', 'ספרייה לאומית: MARC → כותר, כותב (שם תצוגה + שם מיון), הוצאה, שנה, שפה, ISBN, עמודים, נושא');
    const g1 = bm.parseGoogle(GOOGLE)[0];
    ok(g1.isbn === '9780060555665' && g1.desc === 'The classic text' && /^https:/.test(g1.cover) && !/edge=curl/.test(g1.cover) && g1.year === 2006, 'Google Books: ISBN-13, תקציר בלי HTML, כריכה ב־https בגודל גדול');
    const a1 = bm.parseApple(APPLE)[0];
    ok(/1200x1200bb/.test(a1.cover) && a1.tags.join() === 'Investing', 'Apple Books: כריכה ברזולוציה גבוהה, בלי הז\'אנר "Books"');
    ok(bm.normQuery({ title: 'המשקיע הנבון' }).lang === 'he' && bm.normQuery({ isbn: '978-0-06-055566-5' }).isbn === '9780060555665' && bm.normQuery({}) === null, 'קלט: שפה מזוהה מהטקסט, ISBN מנוקה, בלי כותר/ISBN — נדחה');
    let res = mockRes();
    await api(mockReq({ body: { op: 'search', title: 'The Intelligent Investor', author: 'Graham' } }), res, { fetch: fake });
    ok(res.statusCode === 200 && res.payload.ok && res.payload.status.google === 1 && res.payload.status.nli === 1 && res.payload.status.apple === 1 && res.payload.status.openlibrary === 1, 'חיפוש: ארבעת המקורות נשאלים במקביל');
    ok(res.payload.results[0].src === 'google' && res.payload.results.find((x) => x.src === 'openlibrary').desc === 'From the works record', 'דירוג באנגלית: Google ראשון; תקציר Open Library מרשומת היצירה');
    res = mockRes();
    await api(mockReq({ body: { op: 'search', title: 'המשקיע הנבון' } }), res, { fetch: fake });
    ok(res.payload.results[0].src === 'nli', 'דירוג בעברית: הספרייה הלאומית ראשונה');
    res = mockRes();
    await api(mockReq({ body: { op: 'cover', url: 'https://evil.example.com/x.jpg' } }), res, { fetch: fake });
    ok(res.statusCode === 400 && bm.coverAllowed('https://covers.openlibrary.org/b/id/1-L.jpg') && bm.coverAllowed('https://is5-ssl.mzstatic.com/a.jpg') && !bm.coverAllowed('http://books.google.com/x') && !bm.coverAllowed('https://books.google.com.evil.com/x'), 'כריכות: רק ממארחי המקורות וב־https (לא פרוקסי כללי)');
    res = mockRes();
    const imgFetch = async (u) => ({ status: 200, url: u, headers: { get: () => 'image/jpeg' }, arrayBuffer: async () => new Uint8Array(5000).buffer });
    await api(mockReq({ body: { op: 'cover', url: 'https://covers.openlibrary.org/b/id/42-L.jpg' } }), res, { fetch: imgFetch });
    ok(res.statusCode === 200 && res.headers['Content-Type'] === 'image/jpeg' && res.payload.length === 5000, 'כריכה מאושרת — מוחזרת כתמונה');
    res = mockRes();
    const redir = async (u) => ({ status: 200, url: 'https://evil.example.com/a.jpg', headers: { get: () => 'image/jpeg' }, arrayBuffer: async () => new Uint8Array(5000).buffer });
    await api(mockReq({ body: { op: 'cover', url: 'https://covers.openlibrary.org/b/id/42-L.jpg' } }), res, { fetch: redir });
    ok(res.statusCode === 400, 'כריכה שהופנתה למארח לא מאושר — נחסמת');
    res = mockRes();
    await api(mockReq({ body: { op: 'search', title: 'x' }, headers: { origin: 'https://evil.example.com' } }), res, { fetch: fake });
    ok(res.statusCode === 403, 'פרטי ספר: Origin לא מאושר — נחסם');
    const mg = bm.mergeByIsbn([bm.parseNli(NLI)[0], Object.assign(bm.parseGoogle(GOOGLE)[0], { isbn: '9789655451230' })]);
    ok(mg[0].src === 'nli' && /^https:/.test(mg[0].cover) && mg[0].desc === 'The classic text' && mg[0].publisher === 'סיאל', 'מיזוג לפי ISBN: רשומת הספרייה הלאומית מקבלת כריכה ותקציר מ־Google, ושומרת על הפרטים שלה');
    ok(bm.clean('\u200fקיצור תולדות האנושות /\u200f') === 'קיצור תולדות האנושות', 'ניקוי תווי כיווניות וסימני קטלוג מכותרות');
    let g503 = 0;
    const flaky = async (u) => { if (/googleapis/.test(u) && !g503++) return { status: 503, json: async () => ({ error: { message: 'Service temporarily unavailable' } }) }; return fake(u); };
    res = mockRes();
    await api(mockReq({ body: { op: 'search', title: 'Some Other Book' } }), res, { fetch: flaky });
    ok(res.payload.status.google === 1 && g503 >= 2, 'Google 503 רגעי — ניסיון אחד נוסף מצליח (+ השלמת כריכה לפי ISBN מהקטלוג)');
    {
      const calls = [];
      const ef = async (u) => {
        calls.push(u);
        if (/alma\.exlibrisgroup/.test(u)) return { status: 200, text: async () => NLI };
        if (/googleapis\.com\/books/.test(u)) return /isbn%3A9789655451230/.test(u) ? { status: 200, json: async () => ({ items: [{ id: 'gx', volumeInfo: { title: 'המשקיע הנבון', industryIdentifiers: [{ identifier: '9789655451230' }], imageLinks: { thumbnail: 'https://books.google.com/books/content?id=gx&img=1' }, description: 'תקציר' } }] }) } : { status: 200, json: async () => ({}) };
        return { status: 200, json: async () => ({}) };
      };
      const out = await bm.searchAll(bm.normQuery({ title: 'המשקיע הנבון' }), { fetch: ef });
      ok(out.results.length === 1 && out.results[0].src === 'nli' && /books\.google/.test(out.results[0].cover) && out.results[0].desc === 'תקציר' && calls.some((u) => /isbn%3A9789655451230/.test(u)), 'ספר עברי: כריכה ותקציר מ־Google לפי ה־ISBN של הספרייה הלאומית — בלי רשומה כפולה');
    }
    api._reset();
  }

  /* ---------- v318: גיבוי הספרייה הפרטית ל־Google Drive — חיבור, גישה זמנית, ניתוק (Google ו־Firestore מדומים) ---------- */
  {
    const crypto = require('crypto');
    const gauth = require('../lib/gauth');
    const gd = require('../lib/gdrive');
    const lib = require('../api/library');
    const env = ['GDRIVE_SA_KEY', 'GDRIVE_CLIENT_ID', 'GDRIVE_CLIENT_SECRET', 'IBKR_VAULT_KEY'].map((k) => [k, process.env[k]]);
    const fb = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const sa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    process.env.GDRIVE_SA_KEY = JSON.stringify({ client_email: 'sa@p.iam.gserviceaccount.com', private_key: sa.privateKey.export({ type: 'pkcs8', format: 'pem' }) });
    delete process.env.GDRIVE_CLIENT_ID; delete process.env.GDRIVE_CLIENT_SECRET; delete process.env.IBKR_VAULT_KEY;
    gauth._reset();
    const keys = { k1: fb.publicKey.export({ type: 'spki', format: 'pem' }) };
    const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
    const tnow = Math.floor(Date.now() / 1000);
    const tok = (sub, email) => {
      const hd = b64u({ alg: 'RS256', kid: 'k1' }), bd = b64u({ aud: 'yishaiguedj1-c786e', iss: 'https://securetoken.google.com/yishaiguedj1-c786e', sub, iat: tnow - 5, exp: tnow + 3000, email, email_verified: true });
      return hd + '.' + bd + '.' + crypto.sign('RSA-SHA256', Buffer.from(hd + '.' + bd), fb.privateKey).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
    };
    const U1 = tok('userUid00001', 'someone@example.com'), U2 = tok('userUid00002', 'other@example.com');
    const store = new Map(); const calls = [];
    let grant = { refresh: 'RT-SECRET-1', scope: 'openid email https://www.googleapis.com/auth/drive.file', bad: false };
    const J = (o, st = 200) => ({ status: st, json: async () => o });
    const idt = 'x.' + b64u({ email: 'drive.owner@example.com' }) + '.y';
    const fake = async (url, opt = {}) => {
      calls.push({ url, body: opt.body || '' });
      if (url.includes('oauth2.googleapis.com/token')) {
        const p = new URLSearchParams(opt.body || '');
        if (p.get('grant_type') === 'urn:ietf:params:oauth:grant-type:jwt-bearer' || p.get('assertion')) return J({ access_token: 'SA', expires_in: 3600 });
        if (p.get('grant_type') === 'authorization_code') return p.get('code') === 'GOOD' ? J(Object.assign({ access_token: 'AT1', expires_in: 3599, scope: grant.scope, id_token: idt }, grant.refresh ? { refresh_token: grant.refresh } : {})) : J({ error: 'invalid_grant' }, 400);
        if (p.get('grant_type') === 'refresh_token') return grant.bad ? J({ error: 'invalid_grant' }, 400) : J({ access_token: 'AT2', expires_in: 3599 });
      }
      if (url.includes('oauth2.googleapis.com/revoke')) return J({});
      const m = url.match(/documents\/driveVault\/([A-Za-z0-9]+)/);
      if (m) {
        const cur = store.get(m[1]);
        if (opt.method === 'GET') return cur ? J({ fields: cur }) : J({}, 404);
        if (opt.method === 'DELETE') { store.delete(m[1]); return J({}); }
        if (opt.method === 'PATCH') { store.set(m[1], JSON.parse(opt.body).fields); return J({}); }
      }
      return J({}, 404);
    };
    const run = async (body) => { const r = mockRes(); await lib._handler(mockReq({ body }), r, { verify: { keys }, fetch: fake }); return r; };
    const RED = 'https://yishaiguedj1.github.io/portfolio-pwa/oauth.html';
    let r = await run({ op: 'gdConfig' });
    ok(r.payload.ok && r.payload.configured === false && r.payload.clientId === '', 'גיבוי Drive: בלי GDRIVE_CLIENT_ID/SECRET — "לא מוגדר" (בלי לחשוף ערכים)');
    r = await run({ op: 'gdStatus', idToken: U1 });
    ok(r.statusCode === 503 && r.payload.error === 'gd_not_configured', 'גיבוי Drive: פעולה בלי הגדרה — 503 מוסבר');
    process.env.GDRIVE_CLIENT_ID = 'cid.apps.googleusercontent.com'; process.env.GDRIVE_CLIENT_SECRET = 'csecret';
    r = await run({ op: 'gdConfig' });
    ok(r.payload.configured === true && r.payload.clientId === 'cid.apps.googleusercontent.com' && !JSON.stringify(r.payload).includes('csecret'), 'גיבוי Drive: מזהה הלקוח (ציבורי) חוזר, הסוד לעולם לא');
    r = await run({ op: 'gdStatus' });
    ok(r.statusCode === 401, 'גיבוי Drive: בלי התחברות — 401');
    r = await run({ op: 'gdConnect', idToken: U1, code: 'GOOD', redirect: 'https://evil.example/oauth.html' });
    ok(r.statusCode === 400 && r.payload.error === 'bad_params', 'גיבוי Drive: כתובת חזרה זרה — נדחית');
    r = await run({ op: 'gdConnect', idToken: U1, code: 'BAD', redirect: RED });
    ok(r.statusCode === 400 && /^gd_/.test(r.payload.error) && !store.size, 'גיבוי Drive: קוד שגוי — שגיאה, בלי רשומה');
    grant.scope = 'openid email';
    r = await run({ op: 'gdConnect', idToken: U1, code: 'GOOD', redirect: RED });
    ok(r.payload.error === 'gd_no_scope' && !store.size && calls.some((c) => c.url.includes('/revoke')), 'גיבוי Drive: המשתמש לא אישר גישה ל־Drive — הגישה מבוטלת ולא נשמרת');
    grant.scope = 'openid email https://www.googleapis.com/auth/drive.file';
    r = await run({ op: 'gdConnect', idToken: U1, code: 'GOOD', redirect: RED });
    const rec = store.get('userUid00001');
    ok(r.payload.ok && r.payload.access_token === 'AT1' && r.payload.email === 'drive.owner@example.com' && !('refresh_token' in r.payload), 'גיבוי Drive: חיבור — גישה זמנית + המייל, בלי ההרשאה הקבועה');
    ok(rec && !JSON.stringify(rec).includes('RT-SECRET-1') && /^v1\./.test(rec.r.stringValue), 'גיבוי Drive: ההרשאה הקבועה נשמרת רק מוצפנת');
    store.set('userUid00002', rec);   // רשומה שהועתקה למשתמש אחר — לא נפתחת (AAD לפי uid)
    r = await run({ op: 'gdToken', idToken: U2 });
    ok(r.payload.ok === false && r.payload.error === 'not_connected', 'גיבוי Drive: רשומה מוצפנת של משתמש אחר — לא נפתחת');
    store.delete('userUid00002');
    r = await run({ op: 'gdToken', idToken: U1 });
    ok(r.payload.ok && r.payload.access_token === 'AT2' && calls.some((c) => /refresh_token=RT-SECRET-1/.test(c.body)), 'גיבוי Drive: גישה זמנית חדשה מההרשאה השמורה');
    grant.refresh = '';
    r = await run({ op: 'gdConnect', idToken: U1, code: 'GOOD', redirect: RED });
    ok(r.payload.ok && store.get('userUid00001'), 'גיבוי Drive: חיבור חוזר בלי הרשאה קבועה חדשה — נשארת הקודמת');
    r = await run({ op: 'gdConnect', idToken: U2, code: 'GOOD', redirect: RED });
    ok(r.payload.error === 'gd_no_refresh', 'גיבוי Drive: אין הרשאה קבועה בכלל — שגיאה ברורה');
    grant.bad = true;
    r = await run({ op: 'gdToken', idToken: U1 });
    ok(r.payload.error === 'revoked' && !store.has('userUid00001'), 'גיבוי Drive: הגישה בוטלה בחשבון Google — הרשומה נמחקת');
    grant.bad = false; grant.refresh = 'RT-SECRET-2';
    await run({ op: 'gdConnect', idToken: U1, code: 'GOOD', redirect: RED });
    const nRev = calls.filter((c) => c.url.includes('/revoke')).length;
    r = await run({ op: 'gdDisconnect', idToken: U1 });
    ok(r.payload.ok && !store.has('userUid00001') && calls.filter((c) => c.url.includes('/revoke')).length === nRev + 1 && /RT-SECRET-2/.test(calls.filter((c) => c.url.includes('/revoke')).pop().body), 'גיבוי Drive: ניתוק — ביטול אצל Google + מחיקת הרשומה');
    ok(gd.REDIRECT_RE.test('http://localhost:8080/oauth.html') && !gd.REDIRECT_RE.test('https://yishaiguedj1.github.io/other/oauth.html'), 'גיבוי Drive: כתובת חזרה — רק עמוד האפליקציה (או localhost)');
    env.forEach(([k, v]) => { if (v == null) delete process.env[k]; else process.env[k] = v; });
    gauth._reset();
  }

  /* ---------- v339: מטמון AI משותף + מפסק יומי + מגבלה לכל קורא (Firestore מדומה) ---------- */
  {
    const { createAiStore, aiKey } = require('../lib/aicache');
    const docs = {}; const counters = {}; const calls = [];
    const fsFetch = async (u, opt) => {
      calls.push({ u, m: opt.method });
      const name = u.split('/documents/')[1];
      if (u.endsWith(':commit')) {
        const w = JSON.parse(opt.body).writes[0].transform;
        const day = w.document.split('/aiUse/')[1]; counters[day] = counters[day] || {};
        const tr = w.fieldTransforms.map((f) => { counters[day][f.fieldPath] = (counters[day][f.fieldPath] || 0) + 1; return { integerValue: String(counters[day][f.fieldPath]) }; });
        return { status: 200, json: async () => ({ writeResults: [{ transformResults: tr }] }) };
      }
      if (opt.method === 'PATCH') { docs[name] = JSON.parse(opt.body); return { status: 200, json: async () => ({}) }; }
      if (docs[name]) return { status: 200, json: async () => docs[name] };
      return { status: 404, json: async () => ({}) };
    };
    const st = createAiStore({ fetch: fsFetch, token: async () => 't' });
    ok(aiKey('ctx', ['he', 'moat', 'a']) === aiKey('ctx', ['he', 'moat', 'a']) && aiKey('ctx', ['he', 'moat', 'a']) !== aiKey('ctx', ['he', 'moat', 'b']) && /^ctx_[0-9a-f]{40}$/.test(aiKey('ctx', ['x'])), 'aicache: מפתח לפי שפה+מילה+הקשר (sha256, בלי הטקסט עצמו)');
    ok(await st.get('ctx', ['he', 'moat', 'c']) === null, 'aicache: חסר — null');
    await st.set('ctx', ['he', 'moat', 'c'], { translation: 'חפיר', model: 'g' });
    st._memCache.clear();
    const g = await st.get('ctx', ['he', 'moat', 'c']);
    ok(g && g.translation === 'חפיר' && !JSON.stringify(docs).includes('moat'), 'aicache: נשמר ב־Firestore ונקרא בחזרה (מופע אחר) — בלי המילה/ההקשר במסמך');
    process.env.AI_USER_DAILY = '3'; process.env.AI_DAILY_LIMIT = '5'; process.env.AI_ANON_DAILY = '2';
    const r1 = []; for (let i = 0; i < 4; i++) r1.push((await st.allow('uidA', 'ctx')).ok);
    ok(r1.join() === 'true,true,true,false', 'מגבלה לכל קורא: 3 ביום, הרביעית נחסמת');
    const an = createAiStore({ fetch: fsFetch, token: async () => 't' });
    Object.keys(counters).forEach((k) => delete counters[k]);
    const r3 = []; for (let i = 0; i < 3; i++) r3.push((await an.allow('ip:1.2.3.4', 'ctx')).ok);
    ok(r3.join() === 'true,true,false' && (await an.allow('uidZ', 'ctx')).ok, 'לא מחובר — תקרה נמוכה (2) לפי כתובת, בלי לפגוע בקורא מחובר');
    Object.keys(counters).forEach((k) => delete counters[k]); for (let i = 0; i < 5; i++) await an.allow('u' + i, 'ctx');
    const d = await st.allow('uidB', 'ctx');
    ok(!d.ok && d.why === 'daily', 'מפסק יומי: מעבר לתקרה הכוללת — ה־AI כבוי לכולם');
    // Firestore לא זמין → מונים בזיכרון עם אותן תקרות
    const down = createAiStore({ fetch: async () => { throw new Error('down'); }, token: async () => 't' });
    const r2 = []; for (let i = 0; i < 4; i++) r2.push((await down.allow('uidC', 'ctx')).ok);
    ok(r2.join() === 'true,true,true,false' && down._mem.day, 'Firestore לא זמין — מונים בזיכרון, אותה מגבלה (אף פעם לא בלי הגבלה)');
    process.env.AI_USER_DAILY = ''; process.env.AI_DAILY_LIMIT = ''; process.env.AI_ANON_DAILY = '1000000';

    // התרגום: מטמון משותף לפני AI, מפסק לפני AI, שמירה אחרי AI
    const translate = require('../api/translate');
    const oldG = process.env.GEMINI_API_KEY, oldM = process.env.MISTRAL_API_KEY;
    process.env.GEMINI_API_KEY = 'g'; delete process.env.MISTRAL_API_KEY;
    const ai = []; const saved = [];
    const fake = { hit: null, gate: { ok: true },
      get: async () => fake.hit, set: async (k, p, v) => saved.push(v), allow: async (who) => { fake.who = who; return fake.gate; } };
    translate._deps.store = fake; translate._deps.verify = { fake: true };
    const prevFetch = global.fetch;
    global.fetch = async (u) => { ai.push(String(u)); if (String(u).includes('googleapis')) return { status: 200, json: async () => ({ usageMetadata: { promptTokenCount: 300, candidatesTokenCount: 40 }, candidates: [{ content: { parts: [{ text: JSON.stringify({ translation: 'חפיר כלכלי', note: 'n', wiki: 'Economic moat' }) }] } }] }) }; return { status: 200, json: async () => ({ responseData: { translatedText: 'בסיסי' } }) }; };
    const run = async (body) => { const r = mockRes(); await translate(mockReq({ body }), r); return r; };
    translate._cache.clear(); fake.hit = { translation: 'משותף', note: '', wiki: 'W', engine: 'ai', provider: 'gemini', model: 'gemini-x' };
    let r = await run({ text: 'moat', context: 'c1' });
    ok(r.payload.cached && r.payload.translation === 'משותף' && !ai.length, 'תרגום: תשובה מהמטמון המשותף — בלי פנייה ל־AI');
    translate._cache.clear(); fake.hit = null; fake.gate = { ok: false, why: 'user' };
    r = await run({ text: 'moat', context: 'c2' });
    ok(r.payload.limited === 'user' && r.payload.engine === 'basic' && !ai.some((u) => u.includes('googleapis')), 'תרגום: מעבר למגבלה — בלי AI (תרגום בסיסי), עם סיבה');
    translate._cache.clear(); fake.gate = { ok: true }; ai.length = 0;
    r = await run({ text: 'moat', context: 'c3' });
    ok(r.payload.engine === 'ai' && saved.length === 1 && saved[0].translation === 'חפיר כלכלי' && saved[0].wiki === 'Economic moat' && fake.who.startsWith('ip:'), 'תרגום: תשובת AI נשמרת למטמון המשותף; לא מחובר = לפי כתובת');
    ok(JSON.stringify(r.payload.diag).includes('"gemini-3.5-flash-lite:tok":[300,40,0]'), 'מדידת טוקנים לכל דגם באבחון (קלט, פלט, חשיבה)');
    global.fetch = prevFetch; delete translate._deps.store; delete translate._deps.verify;
    if (oldG === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = oldG;
    if (oldM !== undefined) process.env.MISTRAL_API_KEY = oldM;
  }

  /* ---------- v355: סטודיו התרגום — /api/studio (Firestore, Drive, Google ו־Anthropic מדומים) ---------- */
  {
    const crypto = require('crypto');
    const gauth = require('../lib/gauth');
    const vault = require('../lib/vault');
    const S = require('../lib/studio');
    const studio = require('../api/studio');
    const envKeys = ['GDRIVE_SA_KEY', 'GDRIVE_CLIENT_ID', 'GDRIVE_CLIENT_SECRET', 'STUDIO_GDRIVE_CLIENT_ID', 'STUDIO_GDRIVE_CLIENT_SECRET', 'IBKR_VAULT_KEY', 'LIBRARY_READERS', 'LIBRARY_ADMINS', 'STUDIO_USERS'];
    const env = envKeys.map((k) => [k, process.env[k]]);
    const fb = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const sa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    process.env.GDRIVE_SA_KEY = JSON.stringify({ client_email: 'sa@p.iam.gserviceaccount.com', private_key: sa.privateKey.export({ type: 'pkcs8', format: 'pem' }) });
    process.env.GDRIVE_CLIENT_ID = 'cid.apps.googleusercontent.com'; process.env.GDRIVE_CLIENT_SECRET = 'csecret';
    process.env.STUDIO_GDRIVE_CLIENT_ID = 'scid.apps.googleusercontent.com'; process.env.STUDIO_GDRIVE_CLIENT_SECRET = 'ssecret';   // v357: לקוח נפרד לסטודיו
    process.env.LIBRARY_READERS = 'owner@example.com, reader@example.com'; process.env.STUDIO_USERS = 'friend@example.com';
    delete process.env.IBKR_VAULT_KEY; delete process.env.LIBRARY_ADMINS;
    gauth._reset(); studio._reset();
    const keys = { k1: fb.publicKey.export({ type: 'spki', format: 'pem' }) };
    const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
    const tnow = Math.floor(Date.now() / 1000);
    const tok = (sub, email) => {
      const hd = b64u({ alg: 'RS256', kid: 'k1' }), bd = b64u({ aud: 'yishaiguedj1-c786e', iss: 'https://securetoken.google.com/yishaiguedj1-c786e', sub, iat: tnow - 5, exp: tnow + 3000, email, email_verified: true });
      return hd + '.' + bd + '.' + crypto.sign('RSA-SHA256', Buffer.from(hd + '.' + bd), fb.privateKey).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
    };
    const OWNER = tok('ownerUid0001', 'owner@example.com'), READER = tok('readerUid002', 'reader@example.com'), FRIEND = tok('friendUid03', 'friend@example.com');
    const RKEY = 'sk-ant-oat01-' + 'Q'.repeat(60) + '_x-Y9AA', RURL = 'https://api.anthropic.com/v1/claude_code/routines/trig_01ABCDEFGHJKLMNOPQRSTUVW/fire';

    // Firestore מדומה: כמה אוספים, כתיבה חלקית (updateMask) ושאילתת runQuery לפי uid
    const db = new Map();   // 'col/id' → { fields }
    const calls = [];
    let fireMode = 'ok', fires = [], driveFiles = new Map(), now = Date.UTC(2026, 9, 7, 9, 0);
    const J = (o, st = 200, hd = {}) => ({ status: st, json: async () => o, headers: { get: (k) => hd[String(k).toLowerCase()] || null } });
    const fake = async (url, opt = {}) => {
      calls.push({ url, method: opt.method || 'GET', body: opt.body || '' });
      if (url.includes('oauth2.googleapis.com/token')) {
        const p = new URLSearchParams(opt.body || '');
        if (p.get('assertion')) return J({ access_token: 'SA', expires_in: 3600 });
        // v357: לסטודיו לקוח OAuth משלו — ההרשאה של הסטודיו עובדת רק איתו, וזו של גיבוי הספרייה לא מגיעה לסטודיו
        const cid = p.get('client_id');
        if (p.get('grant_type') === 'refresh_token') return p.get('refresh_token') === 'SRT-1' && cid === 'scid.apps.googleusercontent.com' ? J({ access_token: 'DRIVE-AT', expires_in: 3599 })
          : p.get('refresh_token') === 'RT-1' && cid === 'cid.apps.googleusercontent.com' ? J({ access_token: 'LIB-AT', expires_in: 3599 }) : J({ error: 'invalid_grant' }, 400);
        if (p.get('grant_type') === 'authorization_code' && p.get('code') === 'SCODE' && cid === 'scid.apps.googleusercontent.com' && p.get('client_secret') === 'ssecret')
          return J({ access_token: 'S-AT1', expires_in: 3599, refresh_token: 'SRT-1', scope: 'openid email https://www.googleapis.com/auth/drive.file', id_token: 'x.' + b64u({ email: 'drive.owner@example.com' }) + '.y' });
        return J({}, 400);
      }
      if (url.startsWith('https://api.anthropic.com/')) {
        fires.push({ url, headers: opt.headers, body: JSON.parse(opt.body || '{}') });
        if (fireMode === 'throw') throw new Error('net');
        if (fireMode === 401) return J({ type: 'error', error: { type: 'authentication_error', message: 'bad' } }, 401);
        if (fireMode === 429) return J({ type: 'error', error: { type: 'rate_limit_error', message: 'slow' } }, 429, { 'retry-after': '1800' });
        if (fireMode === 'paused') return J({ type: 'error', error: { type: 'invalid_request_error', message: 'Routine is paused' } }, 400);
        if (fireMode === 500) return J({ type: 'error', error: { type: 'api_error', message: 'Internal <b>x</b>' } }, 500, { 'request-id': 'req_011CXtest<script>' });
        if (fireMode === 'odd') return J({ type: 'routine_fire', session: { id: 'x' } });   // 200 במבנה לא מוכר
        if (fireMode === 'nojson') return { status: 200, json: async () => { throw new Error('not json'); }, headers: { get: () => null } };
        if (fireMode === 'docs') return J({ type: 'routine_fire', claude_code_session_id: 'session_01DOCSSESSION' + fires.length, claude_code_session_url: 'https://claude.ai/code/session_01DOCSSESSION' + fires.length });
        // כמו בפועל (07/10/2026): המזהה cse_… — בתיעוד session_…
        return J({ type: 'routine_fire', claude_code_session_id: 'cse_01TESTSESSION' + fires.length, claude_code_session_url: 'https://claude.ai/code/cse_01TESTSESSION' + fires.length });
      }
      const dm = url.match(/^https:\/\/www\.googleapis\.com\/drive\/v3\/files\/([A-Za-z0-9_-]+)\?/);
      if (dm) {
        if ((opt.headers || {}).Authorization !== 'Bearer DRIVE-AT') return J({}, 401);
        const f = driveFiles.get(dm[1]);
        return f ? J(f) : J({}, 404);
      }
      if (url.endsWith('/documents:runQuery')) {
        const q = JSON.parse(opt.body).structuredQuery;
        const uid = q.where.fieldFilter.value.stringValue;
        return J([...db.entries()].filter(([k, v]) => k.startsWith('studioJobs/') && v.fields.uid && v.fields.uid.stringValue === uid)
          .map(([k, v]) => ({ document: { name: 'projects/p/databases/(default)/documents/' + k, fields: v.fields } })).concat([{ readTime: 'x' }]));
      }
      const m = url.match(/\/documents\/([A-Za-z]+)\/([A-Za-z0-9_-]+)(?:\?(.*))?$/);
      if (!m) return J({}, 404);
      const k = m[1] + '/' + m[2], cur = db.get(k);
      if (opt.method === 'GET') return cur ? J({ fields: cur.fields }) : J({}, 404);
      if (opt.method === 'DELETE') { db.delete(k); return J({}); }
      if (opt.method === 'PATCH') {
        const mask = new URLSearchParams(m[3] || '').getAll('updateMask.fieldPaths');
        const body = JSON.parse(opt.body).fields;
        const fields = mask.length ? Object.assign({}, cur ? cur.fields : {}, ...mask.map((f) => ({ [f]: body[f] }))) : body;
        db.set(k, { fields }); return J({ fields });
      }
      return J({}, 400);
    };
    db.set('driveVault/ownerUid0001', { fields: { r: { stringValue: vault.seal({ rt: 'RT-1', email: 'drive.owner@example.com' }, 'gdrive|ownerUid0001|r') } } });
    const deps = () => ({ verify: { keys }, fetch: fake, now });
    const payloads = [];
    const run = async (body, headers) => { const r = mockRes(); await studio._handler(mockReq({ body, headers }), r, deps()); payloads.push(JSON.stringify(r.payload)); return r; };
    const wrk = async (body) => { const r = mockRes(); await studio._handler({ method: 'POST', headers: {}, body }, r, deps()); payloads.push(JSON.stringify(r.payload)); return r; };
    const keyOf = (f) => (/key=([A-Za-z0-9_-]{43})/.exec(f.body.text) || [])[1];
    const jobOf = (f) => (/job=(j[A-Za-z0-9_-]{20})/.exec(f.body.text) || [])[1];

    // טהורות
    ok(S.normRoutine('  ' + RURL + ' ', 'Bearer ' + RKEY + '\n').trig === 'trig_01ABCDEFGHJKLMNOPQRSTUVW' && S.normRoutine('https://api.anthropic.com.evil.com/v1/claude_code/routines/trig_01ABCDEFGH/fire', RKEY).error === 'bad_url'
      && S.normRoutine(RURL.replace('https', 'http'), RKEY).error === 'bad_url' && S.normRoutine(RURL, 'sk-ant-api03-' + 'x'.repeat(40)).error === 'bad_key', 'סטודיו: כתובת ומפתח של Routine — רווחים ו־Bearer מתנקים, כתובת/מפתח מסוג אחר נדחים');
    const sp = S.normSpec({ name: 'Ackman\u0000 interview.mkv', size: 3.2 * 1024 ** 3, to: ['he', 'he', 'xx', 'en'], mode: 'nope', out: ['same', 'mkv', 'zip'], terms: 'Bill Ackman', from: 'en', dur: 4620.4 });
    ok(sp && sp.name === 'Ackman interview.mkv' && sp.to.join() === 'he,en' && sp.mode === 'opus-medium' && sp.out.join() === 'same,mkv' && sp.dur === 4620 && !S.normSpec({ name: 'x', size: 0, to: ['he'] }) && !S.normSpec({ name: 'x', size: 5, to: ['xx'] }), 'סטודיו: פרטי עבודה — מנוקים ומוגבלים (שפות כפולות/לא מוכרות, מצב לא מוכר, גודל 0)');
    let rep = S.applyReport({ prog: null }, { st: 'tr', p: 0.4, msg: 'כותבים\u0007 כל מילה', ex: 'דקה 3 מתוך 77' }, 1000);
    rep = S.applyReport({ prog: rep.prog }, { st: 'al', p: 7 }, 5000);
    ok(rep.prog.stg.tr.s === 1000 && rep.prog.stg.tr.e === 5000 && rep.prog.stg.al.s === 5000 && rep.prog.p === 1 && rep.prog.st === 'al' && !/\u0007/.test(rep.prog.msg || 'כותבים כל מילה'), 'סטודיו: דיווח — שלב חדש סוגר את הקודם עם זמן אמיתי, אחוז מוגבל ל־0–1, תווי בקרה מנוקים');
    const fin = S.applyReport({ prog: rep.prog }, { fail: true, err: 'Bad Code!' }, 9000);
    ok(fin.state === 'failed' && fin.err === 'worker' && fin.prog.stg.al.e === 9000 && S.applyReport({}, { st: 'zz' }, 1).prog.st === '', 'סטודיו: כשל — קוד שגיאה לא תקין הופך ל־worker; שלב לא מוכר נדחה');

    // הרשאות
    let r = await run({ op: 'status' });
    ok(r.statusCode === 401, 'סטודיו: בלי התחברות — 401');
    r = await run({ op: 'status', idToken: READER });
    ok(r.statusCode === 403 && r.payload.error === 'not_allowed', 'סטודיו: קורא בספרייה שאינו המנהל ולא ב־STUDIO_USERS — חסום');
    r = await run({ op: 'status', idToken: OWNER }, {});
    ok(r.statusCode === 403 && r.payload.error === 'forbidden_origin', 'סטודיו: פעולת טלפון בלי Origin של האפליקציה — חסומה');
    r = await run({ op: 'status', idToken: FRIEND });
    ok(r.payload.ok && r.payload.conn === null && r.payload.drive.connected === false, 'סטודיו: משתמש מ־STUDIO_USERS מורשה (בלי חיבור ובלי Drive משלו)');
    // v357: Drive של הסטודיו — לקוח OAuth נפרד. החיבור של גיבוי הספרייה (driveVault) לא נחשב כאן
    r = await run({ op: 'status', idToken: OWNER });
    ok(r.payload.ok && r.payload.drive.connected === false && r.payload.drive.configured === true, 'סטודיו: החיבור של גיבוי הספרייה לא נותן גישה לסטודיו (לקוח OAuth אחר)');
    r = await run({ op: 'drive', idToken: OWNER });
    ok(!r.payload.ok && r.payload.error === 'not_connected' && !JSON.stringify(r.payload).includes('LIB-AT'), 'סטודיו: בלי חיבור משלו — אין גישה ל־Drive (גם לא של הספרייה)');
    r = await run({ op: 'gdConfig' });
    ok(r.payload.ok && r.payload.configured && r.payload.clientId === 'scid.apps.googleusercontent.com', 'סטודיו: gdConfig — המזהה של לקוח הסטודיו (ציבורי, בלי התחברות)');
    r = await run({ op: 'gdConnect', idToken: OWNER, code: 'SCODE', redirect: 'https://evil.example/oauth.html' });
    ok(r.statusCode === 400 && r.payload.error === 'bad_params' && !db.has('studioDrive/ownerUid0001'), 'סטודיו: כתובת חזרה זרה — נדחית');
    const lib0 = JSON.stringify(db.get('driveVault/ownerUid0001'));
    r = await run({ op: 'gdConnect', idToken: OWNER, code: 'SCODE', redirect: 'https://yishaiguedj1.github.io/portfolio-pwa/oauth.html' });
    const sd = db.get('studioDrive/ownerUid0001');
    ok(r.payload.ok && r.payload.email === 'drive.owner@example.com' && !('refresh_token' in r.payload) && sd && !JSON.stringify(sd).includes('SRT-1')
      && vault.open(sd.fields.r.stringValue, 'sdrive|ownerUid0001|r').rt === 'SRT-1' && vault.open(sd.fields.r.stringValue, 'gdrive|ownerUid0001|r') === null
      && JSON.stringify(db.get('driveVault/ownerUid0001')) === lib0, 'סטודיו: חיבור Drive — נשמר מוצפן ב־studioDrive (AAD משלו), בלי לגעת בחיבור של הספרייה ובלי להחזיר את ההרשאה הקבועה');
    r = await run({ op: 'status', idToken: OWNER });
    ok(r.payload.ok && r.payload.conn === null && r.payload.drive.connected && r.payload.drive.email === 'drive.owner@example.com' && r.payload.kinds.join() === 'ping,tr', 'סטודיו: מצב — Drive של הסטודיו מחובר, עדיין לא Claude; העובד יודע לבדוק חיבור ולתרגם');

    // חיבור: כספת
    r = await run({ op: 'connect', idToken: OWNER, url: 'https://evil.example/fire', key: RKEY });
    ok(r.statusCode === 400 && r.payload.error === 'bad_url' && !db.has('studioVault/ownerUid0001'), 'סטודיו: כתובת שאינה של Anthropic — נדחית, שום דבר לא נשמר');
    r = await run({ op: 'connect', idToken: OWNER, url: RURL, key: ' Bearer ' + RKEY });
    const vdoc = db.get('studioVault/ownerUid0001');
    ok(r.payload.ok && r.payload.conn.hint === 'trig_…STUVW'.replace('STUVW', 'TUVW') && !JSON.stringify(r.payload).includes(RKEY), 'סטודיו: חיבור נשמר — בתשובה רק "trig_…" + 4 תווים, בלי המפתח');
    ok(vdoc && !JSON.stringify(vdoc).includes(RKEY) && !JSON.stringify(vdoc).includes('trig_01ABCDEFGHJKLMNOPQRSTUVW') && vault.open(vdoc.fields.r.stringValue, 'studio|ownerUid0001|r').k === RKEY
      && vault.open(vdoc.fields.r.stringValue, 'studio|friendUid03|r') === null, 'סטודיו: בכספת המפתח והכתובת מוצפנים (AES-GCM), קשורים למשתמש — לא נפתחים למשתמש אחר');

    // בדיקת חיבור: הפעלה + העובד מדווח
    r = await run({ op: 'test', idToken: OWNER });
    const f1 = fires[0], K1 = keyOf(f1), JP = jobOf(f1);
    ok(r.payload.ok && fires.length === 1 && f1.url === RURL && f1.headers.Authorization === 'Bearer ' + RKEY && f1.headers['anthropic-version'] === '2023-06-01'
      && r.payload.job.state === 'queued' && r.payload.job.sess.url === 'https://claude.ai/code/session_01TESTSESSION1' && JP === r.payload.job.id && K1, 'סטודיו: בדיקת חיבור — הפעלה אחת עם הכותרות של התיעוד; בטקסט רק מזהה עבודה ומפתח עבודה');
    const jdoc = db.get('studioJobs/' + JP);
    ok(!JSON.stringify(jdoc).includes(K1) && jdoc.fields.kh.stringValue === S.keyHash(K1) && !JSON.stringify(r.payload).includes(K1), 'סטודיו: מפתח העבודה לא נשמר ולא חוזר לטלפון — רק ה־SHA-256 שלו');
    r = await run({ op: 'test', idToken: OWNER });
    ok(r.statusCode === 429 && r.payload.error === 'wait' && fires.length === 1, 'סטודיו: בדיקה חוזרת תוך דקה — לא מפעילה שוב');
    r = await wrk({ op: 'claim', job: JP, key: K1.slice(0, -1) + (K1.endsWith('A') ? 'B' : 'A') });
    ok(r.statusCode === 403 && r.payload.stop, 'סטודיו: עובד עם מפתח שגוי — 403 ו"עצור"');
    r = await wrk({ op: 'claim', job: JP, key: K1 });
    ok(r.payload.ok && r.payload.job.kind === 'ping' && r.payload.drive.token === 'DRIVE-AT' && !('kh' in r.payload.job) && JSON.parse(db.get('studioJobs/' + JP).fields.state ? '"' + db.get('studioJobs/' + JP).fields.state.stringValue + '"' : '""') === 'running', 'סטודיו: העובד לוקח את העבודה — מקבל את פרטיה וגישה ל־Drive לשעה; המצב "רץ"');
    r = await wrk({ op: 'report', job: JP, key: K1, done: true, checks: { drive: true }, msg: 'החיבור תקין' });
    ok(r.payload.ok && r.payload.state === 'done', 'סטודיו: העובד מדווח "הסתיים"');
    r = await run({ op: 'status', idToken: OWNER });
    ok(r.payload.conn && r.payload.conn.ok === now, 'סטודיו: בדיקת חיבור שהסתיימה מסמנת את החיבור כ"נבדק"');
    r = await run({ op: 'job', idToken: OWNER, job: JP });
    ok(r.payload.job.state === 'done' && r.payload.job.prog.ck.drive === true && r.payload.job.prog.msg === 'החיבור תקין', 'סטודיו: הטלפון רואה את תוצאת הבדיקה (גם Drive מהסשן)');
    r = await wrk({ op: 'report', job: JP, key: K1, st: 'tr' });
    ok(r.payload.stop && r.payload.state === 'done', 'סטודיו: אחרי שהעבודה הסתיימה — המפתח רק מחזיר "עצור"');

    // שגיאות הפעלה
    now += 61e3; fireMode = 401;
    r = await run({ op: 'test', idToken: OWNER });
    ok(!r.payload.ok && r.payload.error === 'routine_auth' && r.payload.job.state === 'failed' && fires.length === 2, 'סטודיו: מפתח Routine שבוטל/שגוי (401) — שגיאה ברורה, העבודה נכשלה, בלי ניסיון נוסף');
    now += 61e3; fireMode = 429;
    r = await run({ op: 'test', idToken: OWNER });
    ok(r.payload.error === 'routine_rate' && r.payload.retry === 1800 && fires.length === 3, 'סטודיו: מגבלת ההפעלות של Anthropic (429) — עם זמן ההמתנה מהכותרת');
    now += 61e3; fireMode = 'paused';
    r = await run({ op: 'test', idToken: OWNER });
    ok(r.payload.error === 'routine_paused', 'סטודיו: Routine מושהה — מזוהה');
    now += 61e3; fireMode = 'throw';
    r = await run({ op: 'test', idToken: OWNER });
    ok(r.payload.ok && r.payload.unsure === 'routine_net' && r.payload.job.state === 'queued' && fires.length === 5,
      'סטודיו: תקלת רשת בהפעלה — "לא ודאי": לא מנסים שוב לבד (אחרת שני סשנים) וגם לא מבטלים — מחכים לסשן');
    ok(r.payload.detail === 'Error' && r.payload.job.ed === 'Error', 'סטודיו: תקלת רשת — עם פרטים לאבחון');
    // v356 — מה שקרה אצל המשתמש: Anthropic החזיר 500, אבל הסשן נפתח והגיע עם המפתח. עד v355 העבודה סומנה "נכשלה" והמפתח נמחק → bad_key
    now += 61e3; fireMode = 500;
    r = await run({ op: 'test', idToken: OWNER });
    const J5 = r.payload.job.id, K5 = keyOf(fires[fires.length - 1]);
    ok(r.payload.ok && r.payload.unsure === 'routine_down' && r.payload.job.state === 'queued' && r.payload.detail === 'HTTP 500 · api_error · req_011CXtestscript'
      && r.payload.job.ed === r.payload.detail && fires.length === 6,
      'סטודיו: 500 מ־Anthropic — העבודה ממתינה (לא נכשלת), עם פרטים לתמיכה (סטטוס, סוג, מזהה בקשה — רק תווים בטוחים)');
    let w5 = await wrk({ op: 'claim', job: J5, key: K5 });
    ok(w5.payload.ok && !w5.payload.stop && w5.payload.job.state === 'running', 'סטודיו: הסשן שנפתח למרות ה־500 מתקבל (לא bad_key)');
    w5 = await wrk({ op: 'report', job: J5, key: K5, done: true, checks: { drive: true } });
    r = await run({ op: 'job', idToken: OWNER, job: J5 });
    ok(r.payload.job.state === 'done' && r.payload.job.err === '', 'סטודיו: ...והבדיקה מסתיימת בהצלחה');
    now += 61e3; fireMode = 500;
    r = await run({ op: 'test', idToken: OWNER });
    const J6 = r.payload.job.id;
    now += 7 * 60e3;
    r = await run({ op: 'job', idToken: OWNER, job: J6 });
    ok(r.payload.job.state === 'failed' && r.payload.job.err === 'routine_down' && r.payload.job.ed === 'HTTP 500 · api_error · req_011CXtestscript',
      'סטודיו: 500 וסשן לא הגיע בזמן — נכשלת עם השגיאה של Anthropic (לא "לא התחיל" שמפנה לרשת), והפרטים נשמרים');
    ok([...db.keys()].filter((k) => k.startsWith('studioJobs/')).length === 3, 'סטודיו: נשמרות רק 3 בדיקות החיבור האחרונות');
    // מה שקרה אצל המשתמש (07/10/2026): Anthropic החזיר 200 עם מזהה cse_… (בתיעוד session_…), השרתון פסל את התשובה,
    // סימן "נכשל" ומחק את המפתח — וה־Claude שכבר נפתח נדחה ב־bad_key. עכשיו: כל 2xx = נפתח
    const fsx = (o) => JSON.stringify(S.fireSession(o));
    ok(fsx({ claude_code_session_id: 'cse_01S4ogTESTxyz', claude_code_session_url: 'https://claude.ai/code/cse_01S4ogTESTxyz' }) === JSON.stringify({ id: 'cse_01S4ogTESTxyz', url: 'https://claude.ai/code/session_01S4ogTESTxyz' })
      && fsx({ claude_code_session_id: 'session_01HJKLMNOPQRSTUVWXYZ', claude_code_session_url: 'https://claude.ai/code/session_01HJKLMNOPQRSTUVWXYZ' }) === JSON.stringify({ id: 'session_01HJKLMNOPQRSTUVWXYZ', url: 'https://claude.ai/code/session_01HJKLMNOPQRSTUVWXYZ' })
      && S.fireSession({ claude_code_session_id: 'cse_01S4ogTESTxyz' }).url === 'https://claude.ai/code/session_01S4ogTESTxyz'
      && S.fireSession({ claude_code_session_id: 'cse_01S4ogTESTxyz', claude_code_session_url: 'https://evil.example/code/session_01S4ogTESTxyz' }).url === 'https://claude.ai/code/session_01S4ogTESTxyz'
      && S.fireSession({ claude_code_session_id: 'cse_<b>x</b>12345678' }) === null && S.fireSession({ claude_code_session_id: 'session_01AB' }) === null && S.fireSession(null) === null,
      'סטודיו: מזהה הסשן — cse_ (בפועל) ו־session_ (בתיעוד); הכתובת לטלפון תמיד claude.ai/code/session_…, וכתובת ממארח אחר נבנית מהמזהה');
    for (const mode of ['ok', 'odd', 'nojson', 'docs']) {
      now += 61e3; fireMode = mode;
      r = await run({ op: 'test', idToken: OWNER });
      const nf = fires.length, Jx = r.payload.job && r.payload.job.id, Kx = keyOf(fires[nf - 1]);
      const want = { ok: 'https://claude.ai/code/session_01TESTSESSION' + nf, docs: 'https://claude.ai/code/session_01DOCSSESSION' + nf }[mode] || '';
      ok(r.payload.ok && !r.payload.unsure && !r.payload.error && r.payload.job.state === 'queued' && r.payload.job.err === '' && (r.payload.job.sess ? r.payload.job.sess.url : '') === want,
        'סטודיו: 200 (' + mode + ') — Claude נפתח: העבודה ממתינה לו, בלי שגיאה' + (want ? '' : ' (מבנה לא מוכר — בלי קישור לסשן, אבל לא "נכשל")'));
      const wx = await wrk({ op: 'claim', job: Jx, key: Kx });
      ok(wx.payload.ok && !wx.payload.stop && wx.payload.job.state === 'running', 'סטודיו: 200 (' + mode + ') — ה־Claude שנפתח מתקבל (לא bad_key)');
      await wrk({ op: 'report', job: Jx, key: Kx, done: true, checks: { drive: true } });
      r = await run({ op: 'job', idToken: OWNER, job: Jx });
      ok(r.payload.job.state === 'done' && r.payload.job.err === '', 'סטודיו: 200 (' + mode + ') — הבדיקה מסתיימת בהצלחה');
    }
    fireMode = 'ok';

    // עבודה: יצירה, קבצים, התחלה
    r = await run({ op: 'create', idToken: OWNER, spec: { name: 'x', size: 0, to: ['he'] } });
    ok(r.statusCode === 400 && r.payload.error === 'bad_spec', 'סטודיו: עבודה בלי קובץ אמיתי — נדחית');
    const SPEC = { name: 'Ackman_TKP_interview.mkv', size: 294649856, type: 'video/x-matroska', dur: 4620, from: 'en', to: ['he'], mode: 'opus-medium', out: ['same'], style: 'bold', terms: 'Bill Ackman' };
    r = await run({ op: 'create', idToken: OWNER, spec: SPEC });
    const JT = r.payload.job.id;
    ok(r.payload.ok && r.payload.job.state === 'new' && r.payload.job.kind === 'tr' && r.payload.job.spec.size === SPEC.size, 'סטודיו: עבודת תרגום נוצרת במצב "חדשה" (מעלים לפני ההפעלה)');
    r = await run({ op: 'jobs', idToken: OWNER });
    ok(r.payload.jobs.length === 1 && r.payload.jobs[0].id === JT, 'סטודיו: רשימת העבודות — בלי בדיקות החיבור');
    r = await run({ op: 'job', idToken: FRIEND, job: JT });
    ok(r.statusCode === 404, 'סטודיו: משתמש אחר לא רואה את העבודה');
    driveFiles.set('fold1234567890', { id: 'fold1234567890' });
    driveFiles.set('aud1234567890', { id: 'aud1234567890', name: 'קול.m4a', size: '73400320', mimeType: 'audio/mp4', parents: ['fold1234567890'], trashed: false });
    driveFiles.set('vid1234567890', { id: 'vid1234567890', name: SPEC.name, size: String(SPEC.size), mimeType: 'video/x-matroska', parents: ['fold1234567890'], trashed: false });
    driveFiles.set('elsewhere12345', { id: 'elsewhere12345', name: 'x', size: '5', parents: ['otherFolder123'], trashed: false });
    driveFiles.set('vidbad12345678', { id: 'vidbad12345678', name: 'x.mkv', size: '1000', parents: ['fold1234567890'], trashed: false });
    r = await run({ op: 'start', idToken: OWNER, job: JT });
    ok(r.statusCode === 409 && r.payload.error === 'no_files', 'סטודיו: אי אפשר להתחיל לפני שקובץ עלה');
    r = await run({ op: 'file', idToken: OWNER, job: JT, which: 'a', id: 'elsewhere12345', folder: 'fold1234567890' });
    ok(r.payload.error === 'file_bad', 'סטודיו: קובץ שלא בתיקיית העבודה — נדחה (מאומת מול Drive)');
    r = await run({ op: 'file', idToken: OWNER, job: JT, which: 'v', id: 'vidbad12345678', folder: 'fold1234567890' });
    ok(r.payload.error === 'file_size', 'סטודיו: וידאו בגודל שונה מהמקור — נדחה');
    r = await run({ op: 'file', idToken: OWNER, job: JT, which: 'a', id: 'aud1234567890', folder: 'fold1234567890' });
    ok(r.payload.ok && r.payload.job.files.a.size === 73400320 && r.payload.job.files.v === null, 'סטודיו: הקול נרשם (הגודל מ־Drive)');
    ok(S.WORKER_KINDS.includes('tr'), 'סטודיו (v358): העובד יודע לתרגם — "start" מפעיל את ה־Routine');
    r = await run({ op: 'file', idToken: OWNER, job: JT, which: 'v', id: 'vid1234567890', folder: 'fold1234567890' });
    ok(r.payload.ok && r.payload.job.files.v.size === SPEC.size && r.payload.job.files.a, 'סטודיו: הווידאו נרשם — שני הקבצים נשמרים (שדות נפרדים, בלי דריסה)');

    // שלב 3: הפעלה, החלפת מפתח, תוצרים, ביטול
    fireMode = 401;   // v356: כשל ודאי (מפתח שבוטל). 5xx/רשת = "לא ודאי" — העבודה ממתינה (נבדק למעלה בבדיקות החיבור)
    r = await run({ op: 'start', idToken: OWNER, job: JT });
    const Ka = keyOf(fires[fires.length - 1]);
    ok(r.payload.error === 'routine_auth' && r.payload.job.state === 'new', 'סטודיו: הפעלה שנדחתה — העבודה חוזרת ל"חדשה" (אפשר לנסות שוב ביד)');
    r = await wrk({ op: 'claim', job: JT, key: Ka });
    ok(r.statusCode === 403, 'סטודיו: המפתח של הפעלה שנכשלה — לא תקף');
    fireMode = 'ok';
    r = await run({ op: 'start', idToken: OWNER, job: JT });
    const Kb = keyOf(fires[fires.length - 1]);
    ok(r.payload.ok && r.payload.job.state === 'queued' && Kb && Kb !== Ka, 'סטודיו: הפעלה — מפתח עבודה חדש לכל הפעלה');
    r = await wrk({ op: 'report', job: JT, key: Kb, st: 'tr', p: 0.25, msg: 'כותבים כל מילה', ex: 'דקה 19 מתוך 77', eta: 360 });
    ok(r.payload.ok && r.payload.state === 'running', 'סטודיו: דיווח ראשון מעביר ל"רץ" גם בלי claim');
    r = await run({ op: 'job', idToken: OWNER, job: JT });
    ok(r.payload.job.prog.st === 'tr' && r.payload.job.prog.p === 0.25 && r.payload.job.prog.eta === 360 && r.payload.job.prog.ex === 'דקה 19 מתוך 77' && r.payload.job.prog.stg.tr.s === now, 'סטודיו: הטלפון רואה שלב, אחוז, זמן שנשאר ודוגמה חיה');
    r = await wrk({ op: 'token', job: JT, key: Kb });
    ok(r.payload.ok && r.payload.drive.token === 'DRIVE-AT', 'סטודיו: העובד מקבל גישה חדשה ל־Drive (לעבודה ארוכה)');
    // v358: תוצרים — רק קבצים שבאמת בתיקיית העבודה ב־Drive
    driveFiles.set('outc1234567890', { id: 'outc1234567890', name: 'x (עברית).mp4', size: '156000000', parents: ['fold1234567890'], trashed: false });
    driveFiles.set('outs1234567890', { id: 'outs1234567890', name: 'x.he.srt', size: '90000', parents: ['fold1234567890'], trashed: false });
    r = await wrk({ op: 'report', job: JT, key: Kb, out: [{ id: 'elsewhere12345', name: 'x', size: 5, k: 'compact' }] });
    ok(r.statusCode === 400 && r.payload.error === 'out_bad', 'סטודיו: תוצר שלא בתיקיית העבודה — נדחה (מאומת מול Drive)');
    r = await wrk({ op: 'report', job: JT, key: Kb, out: [{ id: 'outc1234567890', name: 'a', size: 1, k: 'compact' }, { id: 'outs1234567890', name: 'b', size: 1, k: 'compact' }] });
    ok(r.statusCode === 400 && r.payload.error === 'out_bad', 'סטודיו: אותו סוג תוצר פעמיים / סוג לא מוכר — נדחה');
    r = await wrk({ op: 'report', job: JT, key: Kb, st: 'sv', p: 1, out: [{ id: 'outc1234567890', name: 'x (עברית).mp4', size: 1, k: 'compact' }, { id: 'outs1234567890', name: 'x.he.srt', size: 1, k: 'srt' }] });
    r = await run({ op: 'job', idToken: OWNER, job: JT });
    ok(r.payload.job.files.o.length === 2 && r.payload.job.files.o[0].size === 156000000 && r.payload.job.files.o[1].k === 'srt' && r.payload.job.prog.st === 'sv',
      'סטודיו: התוצרים נשמרים (הגודל מ־Drive) והטלפון רואה אותם');
    // v359: טוקנים ועלות — עד 6 שורות, רק מספרים, מזהה מודל claude-…; נתון לא תקין נזרק בלי להפיל את הדיווח
    const USE = [
      { k: 'main', m: 'claude-sonnet-5-5', n: 40, i: 120, o: 9000, cr: 2400000, c5: 0, c1: 60000, usd: 0.71 },
      { k: 'tl', m: 'claude-opus-5-5', n: 12, i: 30, o: 52000, cr: 900000, c5: 130000, c1: 0, usd: 2.0, op: 126000, oc: 0.63 },
      { k: 'rv', m: 'claude-opus-5-5', n: 6, i: 10, o: 8000, cr: 400000, c5: 128000, c1: 0, usd: 0.88123456, op: 128000, oc: 0.64 },
      { k: 'sub', m: 'claude-haiku-5-5', n: 1, i: 5, o: 5, cr: 0, c5: 1000, c1: 0, usd: null, op: 1000, oc: null },
    ];
    const bads = [
      USE.concat(USE.slice(0, 3)),                                             // 7 שורות
      [Object.assign({}, USE[0], { m: 'gpt-4o' })],                            // מודל זר
      [Object.assign({}, USE[0], { m: 'claude-<b>x</b>' })],                   // תבנית
      [Object.assign({}, USE[0], { i: '120' })],                               // מחרוזת במקום מספר
      [Object.assign({}, USE[0], { o: -1 })],                                  // שלילי
      [Object.assign({}, USE[0], { usd: 'free' })],
      [Object.assign({}, USE[0], { k: 'evil' })],
      'x', [], [null],
    ];
    let badStored = false;
    for (const b of bads) {
      r = await wrk({ op: 'report', job: JT, key: Kb, st: 'sv', p: 1, usage: b });
      const j2 = (await run({ op: 'job', idToken: OWNER, job: JT })).payload.job;
      if (!r.payload.ok || j2.use) badStored = true;
    }
    ok(!badStored, 'סטודיו: עלות — נתון לא תקין (7 שורות, מודל זר, מחרוזת, שלילי, סוג לא מוכר) נזרק, והדיווח עצמו עובר');
    r = await wrk({ op: 'report', job: JT, key: Kb, st: 'sv', p: 1, usage: USE.map((x, i) => i === 0 ? Object.assign({ evil: '<script>' }, x) : x) });
    r = await run({ op: 'job', idToken: OWNER, job: JT });
    const U = r.payload.job.use;
    ok(Array.isArray(U) && U.length === 4 && U[1].oc === 0.63 && U[1].op === 126000 && U[2].usd === 0.8812 && U[3].usd === null && !('op' in U[0]) && !('evil' in U[0])
      && !JSON.stringify(U).includes('script'), 'סטודיו: עלות — נשמרת בעבודה ומוחזרת לטלפון (שדות מוכרים בלבד, דולרים מעוגלים, מודל בלי מחירון = null)');
    // v361: נקודות שמירה — כל ארכיון חייב להיות בתיקיית העבודה ב־Drive; אחת לכל שלב
    driveFiles.set('ckas1234567890', { id: 'ckas1234567890', name: 'נקודת שמירה — התמלול.tar.gz', size: '2400000', parents: ['fold1234567890'], trashed: false });
    driveFiles.set('ckal1234567890', { id: 'ckal1234567890', name: 'נקודת שמירה — היישור.tar.gz', size: '3100000', parents: ['fold1234567890'], trashed: false });
    driveFiles.set('ckal2234567890', { id: 'ckal2234567890', name: 'נקודת שמירה — היישור.tar.gz', size: '3200000', parents: ['fold1234567890'], trashed: false });
    r = await wrk({ op: 'report', job: JT, key: Kb, ck: { s: 'asr', id: 'elsewhere12345', size: 5 } });
    ok(r.statusCode === 400 && r.payload.error === 'ck_bad', 'סטודיו: נקודת שמירה שלא בתיקיית העבודה — נדחית (מאומת מול Drive)');
    r = await wrk({ op: 'report', job: JT, key: Kb, ck: { s: 'bn', id: 'ckas1234567890', size: 5 } });
    ok(r.statusCode === 400 && r.payload.error === 'ck_bad', 'סטודיו: נקודת שמירה בשלב לא מוכר — נדחית');
    await wrk({ op: 'report', job: JT, key: Kb, ck: { s: 'al', id: 'ckal1234567890', size: 1 } });
    await wrk({ op: 'report', job: JT, key: Kb, ck: { s: 'asr', id: 'ckas1234567890', size: 1 } });
    await wrk({ op: 'report', job: JT, key: Kb, ck: { s: 'al', id: 'ckal2234567890', size: 1 } });
    r = await run({ op: 'job', idToken: OWNER, job: JT });
    ok(r.payload.job.ck && r.payload.job.ck.s === 'al' && r.payload.job.ck.at === now && !('id' in r.payload.job.ck), 'סטודיו: הטלפון רואה אחרי איזה שלב נשמר (בלי מזהי הקבצים)');
    r = await wrk({ op: 'claim', job: JT, key: Kb });
    const CK = r.payload.job.ck;
    ok(CK.length === 2 && CK[0].s === 'asr' && CK[1].s === 'al' && CK[1].id === 'ckal2234567890' && CK[1].size === 3200000,
      'סטודיו: העובד מקבל את נקודות השמירה לפי סדר השלבים — אחת לכל שלב, החדשה מחליפה (והגודל מ־Drive)');
    // שלב 3 סבב ד׳: שאלה קצרה באמצע העבודה — מהעובד לטלפון ובחזרה
    r = await wrk({ op: 'report', job: JT, key: Kb, ask: { id: 'bad id', q: 'x' } });
    ok(r.statusCode === 400 && r.payload.error === 'ask_bad', 'סטודיו: שאלה — מזהה לא תקין נדחה');
    r = await wrk({ op: 'report', job: JT, key: Kb, ask: { id: 'q1', q: 'איך כותבים את שם הדובר?\u0000', o: ['ביל אקמן', 'ביל אקמאן', '', 'x'.repeat(200), 'חמישית'], d: 1, w: 99999 } });
    r = await run({ op: 'job', idToken: OWNER, job: JT });
    let QA = r.payload.job.qa;
    ok(QA && QA.id === 'q1' && QA.o.length === 4 && QA.o[2].length === 80 && QA.o[3] === 'חמישית' && QA.d === 1 && QA.w === 1800 && QA.a === null && !/\u0000/.test(QA.q),
      'סטודיו: שאלה — נשמרת ומוחזרת לטלפון (עד 4 תשובות, ריקות נזרקות, אורך מוגבל, המתנה עד 30 דק׳)');
    r = await run({ op: 'answer', idToken: OWNER, job: JT, qid: 'q0', i: 0 });
    ok(r.statusCode === 400 && r.payload.error === 'bad_answer', 'סטודיו: תשובה לשאלה אחרת — נדחית');
    r = await run({ op: 'answer', idToken: OWNER, job: JT, qid: 'q1', i: 4 });
    ok(r.statusCode === 400, 'סטודיו: תשובה מחוץ לרשימה — נדחית');
    r = await run({ op: 'answer', idToken: OWNER, job: JT, qid: 'q1', i: 1, t: 'משהו אחר' });
    ok(r.payload.ok && r.payload.job.qa.a.i === 1 && r.payload.job.qa.a.t === 'ביל אקמאן', 'סטודיו: תשובה מהטלפון — התשובה המוכנה שנבחרה (לא טקסט חופשי כשיש תשובות)');
    r = await run({ op: 'answer', idToken: OWNER, job: JT, qid: 'q1', i: 0 });
    ok(r.statusCode === 400, 'סטודיו: אי אפשר לענות פעמיים');
    r = await wrk({ op: 'claim', job: JT, key: Kb });
    ok(r.payload.job.qa.id === 'q1' && r.payload.job.qa.a.t === 'ביל אקמאן' && r.payload.job.qa.q === 'איך כותבים את שם הדובר?' && !('o' in r.payload.job.qa),
      'סטודיו: העובד מקבל את התשובה (v361: וגם את השאלה — סשן שממשיך עבודה צריך לדעת על מה ענית)');
    r = await wrk({ op: 'report', job: JT, key: Kb, ask: { id: 'q2', q: 'מה המגדר של הדובר השני?' } });
    r = await run({ op: 'answer', idToken: OWNER, job: JT, qid: 'q2', i: 0 });
    ok(r.statusCode === 400, 'סטודיו: שאלה פתוחה — בלי טקסט אין תשובה');
    r = await run({ op: 'answer', idToken: OWNER, job: JT, qid: 'q2', t: '  אישה  ' });
    ok(r.payload.ok && r.payload.job.qa.a.t === 'אישה' && r.payload.job.qa.a.i === -1, 'סטודיו: שאלה פתוחה — טקסט חופשי; שאלה חדשה מחליפה את הקודמת');
    r = await wrk({ op: 'report', job: JT, key: Kb, ask: { id: 'q3', q: 'לתרגם את שם התוכנית?', o: ['כן', 'לא'], d: 1 } });
    r = await wrk({ op: 'report', job: JT, key: Kb, askTimeout: 'q2' });
    r = await run({ op: 'job', idToken: OWNER, job: JT });
    ok(r.payload.job.qa.id === 'q3' && r.payload.job.qa.a === null, 'סטודיו: "לא ענית בזמן" לשאלה ישנה — לא נוגע בשאלה הנוכחית');
    r = await wrk({ op: 'report', job: JT, key: Kb, askTimeout: 'q3' });
    r = await run({ op: 'job', idToken: OWNER, job: JT });
    ok(r.payload.job.qa.a && r.payload.job.qa.a.auto === true && r.payload.job.qa.a.t === 'לא', 'סטודיו: לא ענית בזמן — הטלפון רואה שהעבודה המשיכה עם ברירת המחדל');
    r = await run({ op: 'answer', idToken: OWNER, job: JT, qid: 'q3', i: 0 });
    ok(r.statusCode === 400, 'סטודיו: אחרי ברירת המחדל — אי אפשר לענות');
    for (const q of ['q4', 'q5']) await wrk({ op: 'report', job: JT, key: Kb, ask: { id: q, q: 'עוד?' } });
    r = await wrk({ op: 'report', job: JT, key: Kb, ask: { id: 'q6', q: 'ועוד?' } });
    ok(r.statusCode === 409 && r.payload.error === 'ask_limit', 'סטודיו: לכל היותר 5 שאלות לעבודה (לולאה לא מציפה את הטלפון)');
    r = await run({ op: 'remove', idToken: OWNER, job: JT });
    ok(r.statusCode === 409 && r.payload.error === 'active', 'סטודיו: אי אפשר למחוק עבודה שרצה — קודם ביטול');
    r = await run({ op: 'cancel', idToken: OWNER, job: JT });
    ok(r.payload.job.state === 'cancelled', 'סטודיו: ביטול');
    r = await wrk({ op: 'report', job: JT, key: Kb, st: 'al' });
    ok(r.payload.stop && r.payload.state === 'cancelled', 'סטודיו: אחרי ביטול — העובד מקבל "עצור" בדיווח הבא');
    // v361: "המשך מאותה נקודה" — מפתח חדש והפעלה חוזרת; הטוקנים של הסשן הקודם נשמרים ומתווספים
    const firesBefore = fires.length;
    fireMode = 401;
    r = await run({ op: 'resume', idToken: OWNER, job: JT });
    ok(!r.payload.ok && r.payload.error === 'routine_auth' && r.payload.job.state === 'failed', 'סטודיו: המשך שלא הופעל — העבודה חוזרת ל"נכשלה" (לא ל"חדשה")');
    fireMode = 'ok';
    r = await run({ op: 'resume', idToken: OWNER, job: JT });
    const Kc = keyOf(fires[fires.length - 1]);
    ok(r.payload.ok && r.payload.job.state === 'queued' && Kc && Kc !== Kb && fires.length === firesBefore + 2 && r.payload.job.ck.s === 'al' && r.payload.job.ended === 0,
      'סטודיו: המשך — מפתח חדש, הפעלה חוזרת, ונקודת השמירה נשארת');
    ok(JSON.stringify(r.payload.job.use) === JSON.stringify(U), 'סטודיו: המשך — העלות של הסשן הקודם נשארת מוצגת');
    r = await wrk({ op: 'claim', job: JT, key: Kb });
    ok(r.statusCode === 403, 'סטודיו: המשך — המפתח הקודם כבר לא תקף (סשן ישן שהתעורר נעצר)');
    r = await wrk({ op: 'claim', job: JT, key: Kc });
    ok(r.payload.ok && r.payload.job.ck.length === 2, 'סטודיו: המשך — הסשן החדש מקבל את נקודות השמירה');
    r = await run({ op: 'resume', idToken: OWNER, job: JT });
    ok(r.statusCode === 409 && r.payload.error === 'state', 'סטודיו: אי אפשר "להמשיך" עבודה שרצה');
    r = await wrk({ op: 'report', job: JT, key: Kc, st: 'tl', p: 0.5, usage: [USE[0]] });
    r = await run({ op: 'job', idToken: OWNER, job: JT });
    ok(r.payload.job.use.length === 4 && r.payload.job.use[0].n === 80 && r.payload.job.use[0].o === 18000 && Math.abs(r.payload.job.use[0].usd - 1.42) < 1e-9 && r.payload.job.use[1].n === 12,
      'סטודיו: המשך — הטוקנים של שני הסשנים מסוכמים לפי סוג ומודל');
    now += S.STALE_MS + 1;
    r = await run({ op: 'job', idToken: OWNER, job: JT });
    ok(r.payload.job.state === 'running' && r.payload.job.stale === true, 'סטודיו: "רצה" בלי דיווח שעתיים — מסומנת "נתקעה"');
    r = await run({ op: 'resume', idToken: OWNER, job: JT });
    const Kd = keyOf(fires[fires.length - 1]);
    ok(r.payload.ok && r.payload.job.state === 'queued' && Kd !== Kc && !r.payload.job.stale, 'סטודיו: עבודה שנתקעה — אפשר להמשיך');
    // v362: מגדל הפיקוח — מצב מה־Hook בסשן; עצירה = "נכשלה" עם tower_stop והפרטים; המשך מאפס
    await wrk({ op: 'report', job: JT, key: Kd, tower: { lv: 'ok', x: 1.14, usd: 3.456, exp: 3.2 } });
    r = await run({ op: 'job', idToken: OWNER, job: JT });
    ok(r.payload.job.tw && r.payload.job.tw.lv === 'ok' && r.payload.job.tw.x === 1.1 && r.payload.job.tw.usd === 3.46 && r.payload.job.tw.at === now, 'סטודיו: מגדל הפיקוח — הטלפון רואה "הכל תקין · פי X מהרגיל"');
    for (const bad of [{ lv: 'evil' }, { lv: 'red', why: 'evil', x: 9 }, 'x', [1]]) await wrk({ op: 'report', job: JT, key: Kd, tower: bad });
    r = await run({ op: 'job', idToken: OWNER, job: JT });
    ok(r.payload.job.tw.lv === 'ok' && r.payload.job.state === 'running', 'סטודיו: מגדל הפיקוח — מצב לא תקין נזרק בשקט');
    r = await wrk({ op: 'report', job: JT, key: Kd, fail: true, err: 'tower_stop', tower: { lv: 'red', why: 'loop', n: 6, x: 2.1, usd: 4, exp: 1.9, evil: '<b>' } });
    r = await run({ op: 'job', idToken: OWNER, job: JT });
    ok(r.payload.job.state === 'failed' && r.payload.job.err === 'tower_stop' && r.payload.job.tw.why === 'loop' && r.payload.job.tw.n === 6 && !('evil' in r.payload.job.tw),
      'סטודיו: מגדל הפיקוח עצר — העבודה "נכשלה" עם הסיבה והמספרים');
    r = await wrk({ op: 'claim', job: JT, key: Kd });
    ok(r.payload.stop === true, 'סטודיו: אחרי העצירה — כל פנייה של העובד מקבלת "עצור" (גם בלי גישה ל־Drive)');
    r = await run({ op: 'resume', idToken: OWNER, job: JT });
    ok(r.payload.ok && r.payload.job.tw === null && r.payload.job.state === 'queued', 'סטודיו: "להמשיך" אחרי עצירה של המגדל — מתחיל נקי');
    db.get('studioJobs/' + JT).fields.fires = { integerValue: String(S.RESUME_MAX) };
    await run({ op: 'cancel', idToken: OWNER, job: JT });
    r = await run({ op: 'resume', idToken: OWNER, job: JT });
    ok(r.statusCode === 409 && r.payload.error === 'resume_limit', 'סטודיו: לכל היותר 10 הפעלות לעבודה (המשך שחוזר על עצמו נעצר)');
    r = await wrk({ op: 'report', job: JT, key: Kd, st: 'al' });
    now += S.KEY_TTL + 1;
    r = await wrk({ op: 'claim', job: JT, key: Kb });
    ok(r.statusCode === 403, 'סטודיו: מפתח עבודה פג אחרי 48 שעות');
    r = await run({ op: 'remove', idToken: OWNER, job: JT });
    ok(r.payload.ok && !db.has('studioJobs/' + JT), 'סטודיו: מחיקת עבודה שבוטלה');

    // v363: "הרגיל" נלמד מהעבודות של המשתמש — דגימה לכל עבודה שהסתיימה בהפעלה אחת; החציון לשעת סרטון מ־3 עבודות
    r = await run({ op: 'status', idToken: OWNER });
    ok(r.payload.norm && r.payload.norm['opus-medium'].d === true && r.payload.norm['opus-medium'].ph === 6 && r.payload.norm['sonnet-high'].ph === 4.2,
      'סטודיו: בלי היסטוריה — "הרגיל" = המדידות שלנו (לכל מצב)');
    const nmJob = async (usd) => {
      const c = await run({ op: 'create', idToken: OWNER, spec: SPEC });
      const id = c.payload.job.id;
      await run({ op: 'file', idToken: OWNER, job: id, which: 'a', id: 'aud1234567890', folder: 'fold1234567890' });
      await run({ op: 'start', idToken: OWNER, job: id });
      const k = keyOf(fires[fires.length - 1]);
      const cl = await wrk({ op: 'claim', job: id, key: k });
      await wrk({ op: 'report', job: id, key: k, done: true, usage: [{ k: 'main', m: 'claude-opus-5-5', n: 9, i: 10, o: 1000, cr: 0, c5: 0, c1: 0, usd }] });
      return cl.payload.job;
    };
    const w1 = await nmJob(6.42);                                    // 4620 שנ׳ = 1.283 שעות → 5$ לשעה
    ok(w1.nm === null, 'סטודיו: העובד לא מקבל "רגיל" לפני שיש 3 עבודות במצב הזה');
    await nmJob(12.83); await nmJob(7.7);                              // 10$ ו־6$ לשעה
    r = await run({ op: 'status', idToken: OWNER });
    const NM = r.payload.norm['opus-medium'];
    ok(NM.ph === 6 && NM.mx === 10 && NM.n === 3 && !NM.d && r.payload.norm['opus-high'].d === true, 'סטודיו: אחרי 3 עבודות — החציון לשעת סרטון והכבדה ביותר (רק למצב שלהן)');
    const sdoc = db.get('studioStats/ownerUid0001');
    ok(sdoc && !/Ackman|aud1234567890|fold/.test(JSON.stringify(sdoc)), 'סטודיו: ההיסטוריה — רק מצב, אורך ועלות (בלי שמות קבצים)');
    const w4 = await nmJob(30);
    ok(w4.nm && w4.nm.ph === 6 && w4.nm.mx === 10 && w4.nm.n === 3, 'סטודיו: העובד מקבל את "הרגיל" שלך למצב של העבודה (בלקיחה)');
    ok(S.normSample({ kind: 'tr', fires: 2, spec: SPEC }, [{ usd: 5 }], 1) === null && S.normSample({ kind: 'tr', fires: 1, spec: SPEC }, [{ usd: 5 }, { usd: null }], 1) === null
      && S.normSample({ kind: 'ping', fires: 1, spec: SPEC }, [{ usd: 5 }], 1) === null && S.normSample({ kind: 'tr', fires: 1, spec: Object.assign({}, SPEC, { dur: 0 }) }, [{ usd: 5 }], 1) === null,
    'סטודיו: לא לומדים מעבודה שהופעלה שוב (המשך), ממודל בלי מחירון, מבדיקת חיבור או בלי אורך');
    let many = []; for (let i = 0; i < 50; i++) many = S.addSample(many, { m: 'opus-max', d: 600, u: 1 + i, at: i });
    ok(many.length === 40 && many[0].u === 11 && S.learnedNorm([{ m: 'opus-max', d: 60, u: 1 }, { m: 'opus-max', d: 60, u: 1 }, { m: 'opus-max', d: 60, u: 1 }], 'opus-max').ph === 6,
      'סטודיו: עד 40 דגימות (האחרונות); סרטון קצר נמדד כ־10 דק׳');
    ok(S.normTower({ lv: 'ok', x: 1, b: 'u', nj: 3 }).nj === 3 && !('b' in S.normTower({ lv: 'ok', b: 'evil' })), 'סטודיו: מגדל הפיקוח מדווח אם "הרגיל" נלמד מהעבודות שלך');

    // v364: ספר התיקונים — עצירה נרשמת לפי טביעת אצבע, Claude רושם תיקון בהמשך, העבודה הבאה מקבלת אותו, "טופל לבד" נספר
    const FPX = 'a1b2c3d4e5f6';
    let rr = await run({ op: 'create', idToken: OWNER, spec: SPEC });
    const JF = rr.payload.job.id;
    await run({ op: 'file', idToken: OWNER, job: JF, which: 'a', id: 'aud1234567890', folder: 'fold1234567890' });
    await run({ op: 'start', idToken: OWNER, job: JF });
    let Kf = keyOf(fires[fires.length - 1]);
    await wrk({ op: 'claim', job: JF, key: Kf });
    await wrk({ op: 'report', job: JF, key: Kf, st: 'tl', p: 0.4 });
    await wrk({ op: 'report', job: JF, key: Kf, fix: { fp: FPX, t: 'לפני שיש עצירה' } });
    ok(!JSON.stringify(db.get('studioStats/ownerUid0001') || {}).includes('לפני שיש עצירה'), 'סטודיו: ספר התיקונים — תיקון לתקלה שלא נרשמה אצל המשתמש — נזרק');
    await wrk({ op: 'report', job: JF, key: Kf, fail: true, err: 'tower_stop', tower: { lv: 'red', why: 'loop', n: 6, x: 1.2, fp: FPX } });
    rr = await run({ op: 'status', idToken: OWNER });
    let FB = rr.payload.fb;
    ok(FB.length === 1 && FB[0].fp === FPX && FB[0].why === 'loop' && FB[0].st === 'tl' && FB[0].n === 1 && FB[0].fix === '' && FB[0].auto === 0,
      'סטודיו: ספר התיקונים — עצירה של המגדל נרשמת (טביעה, סוג, שלב, כמה פעמים) והטלפון רואה אותה');
    rr = await run({ op: 'resume', idToken: OWNER, job: JF });
    Kf = keyOf(fires[fires.length - 1]);
    rr = await wrk({ op: 'claim', job: JF, key: Kf });
    ok(rr.payload.job.ls && rr.payload.job.ls.fp === FPX && rr.payload.job.ls.why === 'loop' && rr.payload.job.ls.st === 'tl' && rr.payload.job.fb.length === 0,
      'סטודיו: ספר התיקונים — ההמשך מקבל את העצירה הקודמת (לאבחון); בלי תיקון עדיין — ספר ריק לעובד');
    await wrk({ op: 'report', job: JF, key: Kf, fix: { fp: FPX, t: 'מפצלים כתובית ארוכה https://evil.example/x `rm -rf` <b>לשתיים</b>' + 'א'.repeat(300) } });
    rr = await run({ op: 'status', idToken: OWNER });
    FB = rr.payload.fb;
    ok(FB[0].fix.startsWith('מפצלים כתובית ארוכה') && FB[0].fix.length <= S.FIX_MAX && !/https|evil|`|<|>/.test(FB[0].fix),
      'סטודיו: ספר התיקונים — התיקון נשמר מנוקה (בלי קישורים, קוד ותגיות; עד 160 תווים)');
    await wrk({ op: 'report', job: JF, key: Kf, done: true });
    rr = await run({ op: 'create', idToken: OWNER, spec: SPEC });
    const JF2 = rr.payload.job.id;
    await run({ op: 'file', idToken: OWNER, job: JF2, which: 'a', id: 'aud1234567890', folder: 'fold1234567890' });
    await run({ op: 'start', idToken: OWNER, job: JF2 });
    const Kf2 = keyOf(fires[fires.length - 1]);
    rr = await wrk({ op: 'claim', job: JF2, key: Kf2 });
    ok(rr.payload.job.fb.length === 1 && rr.payload.job.fb[0].fp === FPX && rr.payload.job.fb[0].fix === FB[0].fix && rr.payload.job.ls === null,
      'סטודיו: ספר התיקונים — העבודה הבאה מקבלת את התקלות המוכרות עם התיקון');
    await wrk({ op: 'report', job: JF2, key: Kf2, fixUsed: FPX });
    await wrk({ op: 'report', job: JF2, key: Kf2, fixUsed: 'ffffffffffff' });
    rr = await run({ op: 'status', idToken: OWNER });
    ok(rr.payload.fb.length === 1 && rr.payload.fb[0].auto === 1, 'סטודיו: ספר התיקונים — המגדל הזכיר את התיקון = "טופל לבד" (טביעה לא מוכרת — נזרקת)');
    await wrk({ op: 'report', job: JF2, key: Kf2, done: true });
    let fbl = []; for (let i = 0; i < 40; i++) fbl = S.fbStop(fbl, { fp: ('00000000000' + i.toString(16)).slice(-12), why: 'cost' }, 'tl', i) || fbl;
    ok(fbl.length === S.FB_MAX && S.fbStop([], { fp: 'XYZ', why: 'loop' }, 'tl', 1) === null && S.fbStop([], { fp: FPX, why: 'evil' }, 'tl', 1) === null
      && S.normTower({ lv: 'ok', fp: FPX }).fp === undefined && S.normTower({ lv: 'red', why: 'loop', fp: 'bad' }).fp === undefined,
    'סטודיו: ספר התיקונים — עד 30 תקלות; טביעה/סוג לא תקינים — נזרקים; טביעה רק בעצירה');

    // v365: מגדל הפיקוח 2.0 — אירועים מכל המקורות → התראות (איחוד, קיבוץ, סגירה), בריאות, זמינות ו־MTTR
    const O = require('../lib/studioops');
    rr = await run({ op: 'create', idToken: OWNER, spec: SPEC });
    const JO = rr.payload.job.id;
    await run({ op: 'file', idToken: OWNER, job: JO, which: 'a', id: 'aud1234567890', folder: 'fold1234567890' });
    await run({ op: 'start', idToken: OWNER, job: JO });
    const Ko = keyOf(fires[fires.length - 1]);
    await wrk({ op: 'claim', job: JO, key: Ko });
    await wrk({ op: 'report', job: JO, key: Ko, ev: [{ c: 'drive', k: 'dl_retry' }, { c: 'evil', k: 'x' }, { c: 'drive', k: '<b>' }] });
    await wrk({ op: 'report', job: JO, key: Ko, ev: [{ c: 'drive', k: 'dl_retry' }, { c: 'drive', k: 'dl_fail' }] });
    await wrk({ op: 'report', job: JO, key: Ko, tower: { lv: 'warn', x: 2.2 } });
    rr = await run({ op: 'status', idToken: OWNER });
    let OP = rr.payload.ops;
    const closed0 = OP.closed30;
    const dr = OP.open.find((g) => g.c === 'drive');
    ok(OP.open.length === 2 && dr && dr.k === 'dl_fail' && dr.s === 2 && dr.rel === 1 && dr.n === 3 && dr.j === JO && OP.comp.drive === 2 && OP.comp.claude === 3 && OP.comp.phone === 0,
      'סטודיו: מגדל 2.0 — אירועים זהים מתאחדים (מונה), קשורים מקובצים לפי רכיב ועבודה (הראשית = החמורה), סוג לא מהקטלוג נזרק');
    ok(OP.score === 100 - 20 - 4 - 8 + 2 || OP.score === 70, 'סטודיו: מגדל 2.0 — ציון הבריאות יורד לפי ההתראות הפתוחות (P2 = 20, P3 = 8, P4 = 2)');
    ok(!JSON.stringify(db.get('studioOps/ownerUid0001')).includes('<b>'), 'סטודיו: מגדל 2.0 — רק סוגים מהקטלוג נשמרים (בלי טקסט חופשי)');
    now += 10 * 60e3;
    await wrk({ op: 'report', job: JO, key: Ko, tower: { lv: 'ok', x: 1.1 }, ev: [{ c: 'drive', k: 'dl_retry', ok: true }] });
    rr = await run({ op: 'status', idToken: OWNER });
    OP = rr.payload.ops;
    ok(OP.comp.claude === 0 && OP.open.length === 1 && OP.open[0].k === 'dl_fail' && OP.open[0].rel === 0 && OP.closed30 === closed0 + 1 && typeof OP.mttr === 'number',
      'סטודיו: מגדל 2.0 — חזרה לתקין / אירוע ok סוגרים את ההתראה, וזמן התיקון נכנס לממוצע (MTTR)');
    rr = await run({ op: 'event', idToken: OWNER, job: JO, ev: [{ c: 'phone', k: 'stall' }, { c: 'vt', k: 'asr' }] });
    ok(rr.payload.ok, 'סטודיו: מגדל 2.0 — אירוע מהטלפון');
    rr = await run({ op: 'event', idToken: OWNER, job: JO, ev: [{ c: 'vt', k: 'asr' }] });
    ok(rr.statusCode === 400, 'סטודיו: מגדל 2.0 — הטלפון מדווח רק על הטלפון ועל Drive');
    now += 20 * 60e3;
    await wrk({ op: 'report', job: JO, key: Ko, done: true });
    rr = await run({ op: 'status', idToken: OWNER });
    OP = rr.payload.ops;
    ok(OP.open.length === 0 && OP.score === 100 && OP.comp.drive === 0 && OP.avail < 100 && OP.avail > 99,
      'סטודיו: מגדל 2.0 — עבודה שהסתיימה סוגרת את ההתראות שלה; זמינות 30 יום = הזמן בלי התראות P1–P2');
    // הפעלה שנכשלה → התראה ל־Routine; הצלחה סוגרת
    rr = await run({ op: 'create', idToken: OWNER, spec: SPEC });
    const JO2 = rr.payload.job.id;
    await run({ op: 'file', idToken: OWNER, job: JO2, which: 'a', id: 'aud1234567890', folder: 'fold1234567890' });
    fireMode = 401;
    await run({ op: 'start', idToken: OWNER, job: JO2 });
    rr = await run({ op: 'status', idToken: OWNER });
    ok(rr.payload.ops.comp.routine === 2 && rr.payload.ops.open.some((g) => g.k === 'fire' && g.j === JO2), 'סטודיו: מגדל 2.0 — הפעלה של ה־Routine שנכשלה = התראה P2 על ה־Routine');
    fireMode = 'ok';
    await run({ op: 'start', idToken: OWNER, job: JO2 });
    rr = await run({ op: 'status', idToken: OWNER });
    ok(rr.payload.ops.comp.routine === 0, 'סטודיו: מגדל 2.0 — הפעלה שהצליחה סוגרת את ההתראה');
    now += S.STALE_MS + 1;
    const Ko2 = keyOf(fires[fires.length - 1]);
    rr = await run({ op: 'jobs', idToken: OWNER });
    await run({ op: 'jobs', idToken: OWNER });
    rr = await run({ op: 'status', idToken: OWNER });
    ok(rr.payload.ops.comp.claude === 0 && rr.payload.ops.comp.routine === 2 && rr.payload.ops.open.find((g) => g.k === 'no_claim').n === 1,
      'סטודיו: מגדל 2.0 — הופעל ואף סשן לא לקח = התראה על ה־Routine, פעם אחת (צפייה חוזרת לא מגדילה את המונה)');
    await run({ op: 'cancel', idToken: OWNER, job: JO2 });
    rr = await run({ op: 'status', idToken: OWNER });
    ok(rr.payload.ops.open.length === 0, 'סטודיו: מגדל 2.0 — ביטול סוגר את ההתראות של העבודה');
    void Ko2;
    // טהור: התראה בלי עבודה נסגרת לבד אחרי חצי שעה; עד 150 התראות; איחוד מקטעים לזמינות
    let al0 = O.opsApply([], [{ c: 'phone', k: 'stall' }], '', 1000);
    ok(O.opsView(al0, 1000 + O.GLOBAL_TTL - 1).open.length === 1 && O.opsView(al0, 1000 + O.GLOBAL_TTL + 1).open.length === 0, 'סטודיו: מגדל 2.0 — התראה בלי עבודה נסגרת לבד אחרי חצי שעה בלי חזרה');
    ok(O.unionMs([[0, 10], [5, 20], [30, 40]], 0, 100) === 30, 'סטודיו: מגדל 2.0 — זמינות: מקטעים חופפים נספרים פעם אחת');
    let big = []; for (let i = 0; i < 200; i++) big = O.opsApply(big, [{ c: 'vt', k: 'asr' }], 'j' + ('0000000000000000000' + i).slice(-20), i) || big;
    ok(big.length === O.AL_MAX, 'סטודיו: מגדל 2.0 — עד 150 התראות');
    studio._reset();   // הבלוק הזה שלח הרבה בקשות — מאפסים את מגבלת הקצב בזיכרון לפני הבדיקות הבאות

    // הפעלה שאף סשן לא לקח
    r = await run({ op: 'create', idToken: OWNER, spec: SPEC });
    const JS = r.payload.job.id;
    await run({ op: 'file', idToken: OWNER, job: JS, which: 'a', id: 'aud1234567890', folder: 'fold1234567890' });
    r = await run({ op: 'start', idToken: OWNER, job: JS });
    const Ks = keyOf(fires[fires.length - 1]);
    now += 31 * 60e3;
    r = await run({ op: 'job', idToken: OWNER, job: JS });
    ok(r.payload.job.state === 'failed' && r.payload.job.err === 'no_claim', 'סטודיו: הופעל ואף סשן לא לקח את העבודה תוך 30 דק׳ — "נכשל" עם סיבה');
    r = await wrk({ op: 'claim', job: JS, key: Ks });
    ok(r.payload.stop, 'סטודיו: עובד שמגיע מאוחר מדי — "עצור"');

    // מגבלות וקלט מהעובד
    for (let i = 0; i < 6; i++) r = await run({ op: 'create', idToken: OWNER, spec: SPEC });
    ok(r.statusCode === 409 && r.payload.error === 'too_many', 'סטודיו: עד 5 עבודות פתוחות בבת אחת');
    r = await wrk({ op: 'report', job: JS, key: Ks, msg: 'x'.repeat(20000) });
    ok(r.statusCode === 413, 'סטודיו: דיווח ענק מהעובד — נדחה');
    r = await wrk({ op: 'claim', job: '../etc', key: Ks });
    ok(r.statusCode === 400, 'סטודיו: מזהה עבודה לא תקין — נדחה');
    r = await run({ op: 'drive', idToken: OWNER });
    ok(r.payload.ok && r.payload.token === 'DRIVE-AT' && r.payload.email === 'drive.owner@example.com', 'סטודיו: גישה זמנית ל־Drive לטלפון (העלאה)');
    r = await run({ op: 'drive', idToken: FRIEND });
    ok(!r.payload.ok && r.payload.error === 'not_connected', 'סטודיו: בלי Drive מחובר — שגיאה ברורה');

    // ניתוק
    r = await run({ op: 'disconnect', idToken: OWNER });
    ok(r.payload.ok && !db.has('studioVault/ownerUid0001'), 'סטודיו: ניתוק מוחק את הרשומה מהכספת');
    now += 61e3;
    r = await run({ op: 'test', idToken: OWNER });
    ok(r.payload.error === 'conn_missing', 'סטודיו: אחרי ניתוק — אין הפעלה (conn_missing — לא מתבלבל עם Drive)');
    ok(payloads.every((p) => !p.includes(RKEY) && !p.includes('RT-1')), 'סטודיו: המפתח של ה־Routine וההרשאה הקבועה של Drive לא הופיעו באף תשובה');

    env.forEach(([k, v]) => { if (v == null) delete process.env[k]; else process.env[k] = v; });
    gauth._reset(); studio._reset();
  }

  console.log(`\nכל ${n} הבדיקות עברו ✓`);
})().catch((e) => { console.error('נכשל:', e.message); process.exit(1); });
