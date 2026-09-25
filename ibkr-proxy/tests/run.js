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
    await quotes(mockReq({ body: { syms: ['AAPL'] } }), r);
    ok(calls === c1 && r.payload.data.AAPL, 'quotes: מטמון של כמה שניות — בלי פנייה חוזרת ל־Yahoo');
    r = mockRes();
    await quotes(mockReq({ body: { syms: Array.from({ length: 41 }, (_, i) => 'S' + i) } }), r);
    ok(r.statusCode === 400, 'quotes: יותר מ־40 → 400');
    r = mockRes();
    await quotes(mockReq({ body: { syms: ['AAPL'] }, headers: { origin: 'https://evil.example' } }), r);
    ok(r.statusCode === 403, 'quotes: Origin זר → 403');
    mockReq.ip = '8.8.8.5';
    let last = 0;
    for (let k = 0; k < 61; k++) { r = mockRes(); await quotes(mockReq({ body: { syms: ['AAPL'] } }), r); last = r.statusCode; }
    ok(last === 429, 'quotes: הגבלת קצב (60 בדקה ל־IP)');
  }

  console.log(`\nכל ${n} הבדיקות עברו ✓`);
})().catch((e) => { console.error('נכשל:', e.message); process.exit(1); });
