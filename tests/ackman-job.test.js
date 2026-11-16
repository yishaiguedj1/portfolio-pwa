/* תיק אקמן — העדכון האוטומטי (ibkr-proxy/lib/ackmanjob.js) והמסלול ב־/api/history, 16/11/2026.
   הכל עם fetch מדומה ומחסן בזיכרון: אף בקשה לא יוצאת ל־SEC / Yahoo / OpenFIGI / R2.
   הקבצים ב־tests/fixtures/ackman/ — דיווחים ציבוריים אמיתיים, מקוצרים (13D/A על HHH, נספח Trading Data של QSR).
   הרצה: node tests/ackman-job.test.js */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

let n = 0;
const ok = (c, name) => { n++; assert(c, name); console.log('ok -', name); };
const ROOT = path.join(__dirname, '..');
const FX = (f) => fs.readFileSync(path.join(__dirname, 'fixtures/ackman', f), 'utf8');
const A = require(path.join(ROOT, 'ibkr-proxy/lib/ackman.js'));
const AB = require(path.join(ROOT, 'ibkr-proxy/lib/ackmanbuild.js'));
const J = require(path.join(ROOT, 'ibkr-proxy/lib/ackmanjob.js'));
const DATA = require(path.join(ROOT, 'ibkr-proxy/lib/ackman-13f.json'));

(async () => {
  /* ---- 13D ונספח העסקאות ---- */
  const D13 = A.parse13dg(FX('13d-hhh-2026-06-04.xml'));
  ok(D13.form === 'SCHEDULE 13D/A' && D13.event === '2026-06-04' && D13.issuer.cusip === '44267T102' && D13.issuer.cik === '1981792', '13D: סוג, תאריך האירוע, המנפיק');
  const own = D13.persons.filter((p) => A.OWN_RE.test(p.name)).reduce((s, p) => s + p.shares, 0);
  ok(D13.persons.length === 6 && D13.shares - own === 18852064, '13D: מניות הקרנות = הסה"כ פחות HHH Holdings של חברת הניהול — בדיוק כמו ב־13F');
  const TD = A.parseTradingData(FX('13d-qsr-ex9911.htm'));
  ok(TD.length === 9 && TD.filter((r) => !r.deriv).length === 3, 'Trading Data: 9 שורות — 3 במניה רגילה, 6 חוזי Forward');
  ok(TD[0].date === '2026-04-30' && TD[0].qty === 1000000 && TD[0].price === 80.61 && TD[0].fund === 'Pershing Square USA, Ltd.', 'Trading Data: תאריך מילולי, כמות, מחיר (עם &#xa0; ו־$)');
  const sale = A.parseTradingData('<table><tr><td>Trade Date</td><td>Shares</td><td>Price</td><td>Buy/Sell</td></tr><tr><td>12/1/2026</td><td>(5,000)</td><td>$</td><td>10.5</td><td>Sale</td></tr></table>');
  ok(sale.length === 1 && sale[0].qty === -5000 && sale[0].price === 10.5 && !sale[0].deriv, 'Trading Data: מכירה, "$" בתא נפרד');
  ok(A.parseTradingData('<table><tr><td>Name</td><td>Title</td></tr><tr><td>A</td><td>B</td></tr></table>').length === 0, 'Trading Data: נספח אחר (רשימת נושאי משרה) — כלום');
  const T13 = J.tradesFrom13d(TD, 'QSR', 'u');
  ok(T13.length === 3 && T13.every((t) => t.sym === 'QSR' && t.qty > 0 && t.src === '13D Item 5(c)'), '13D → עסקאות: רק המניה הרגילה');
  ok(J.tradesFrom13d([{ fund: 'Pershing Square HHH Holdings, LLC', date: '2026-12-01', qty: 5, price: 1, deriv: false }], 'HHH', 'u').length === 0, '13D → עסקאות: לא של הכלים של חברת הניהול');

  /* ---- Form 4 ---- */
  const F4 = A.parseForm4(FX('form4-hhc-2018-11-08.xml'));
  ok(J.tradesFromForm4(F4, 'u', { symbols: {} }).length === 0, 'Form 4: מנפיק שלא בתיק → כלום');
  const t4 = J.tradesFromForm4(F4, 'u', { symbols: { HHC: {} } });
  ok(t4.length === 1 && t4[0].qty === -899647 && t4[0].price === 109.39 && t4[0].date === '2018-11-08', 'Form 4: המכירה במניה; עסקת ההחלף (J, נגזר) לא');

  /* ---- בלי כפילויות ---- */
  const st = { exact: [] };
  ok(J.addTrades(st, [{ date: '2026-12-01', sym: 'QSR', qty: 10, price: 1 }, { date: '2026-12-01', sym: 'QSR', qty: 20, price: 1 }], 'a1') === 2, 'שתי עסקאות באותו יום מאותה הגשה (שתי קרנות) — שתיהן');
  ok(J.addTrades(st, [{ date: '2026-12-01', sym: 'QSR', qty: 30, price: 1 }, { date: '2026-12-02', sym: 'QSR', qty: 5, price: 1 }], 'a2') === 1 && st.exact.length === 3, 'הגשה אחרת (13D/A שחוזר על 60 יום) — רק היום החדש');
  ok(J.addTrades(st, [{ date: '2026-12-01', sym: 'QSR', qty: 7, price: 2 }], 'a3', true) === 1 && st.exact.filter((x) => x.date === '2026-12-01').length === 1, 'תיקון (4/A) מחליף את מה שדווח לאותו יום');
  ok(J.addTrades(st, [{ date: J.CUT.trades, sym: 'QSR', qty: 1, price: 1 }], 'a4') === 0, 'עסקה עד סוף הרבעון שבנתונים — כבר בתיק');

  /* ---- זמן ניו יורק ---- */
  const dates = ['2026-11-12', '2026-11-13', '2026-11-16'];
  ok(J.lastClosedDay(dates, Date.parse('2026-11-16T15:00:00Z')) === '2026-11-13', 'המסחר של היום עוד פתוח (10:00 בניו יורק) → עד יום שישי');
  ok(J.lastClosedDay(dates, Date.parse('2026-11-16T21:30:00Z')) === '2026-11-16', 'אחרי 16:20 בניו יורק → כולל היום');
  ok(J.lastClosedDay(dates, Date.parse('2026-11-17T03:00:00Z')) === '2026-11-16', 'אחרי חצות UTC (עדיין ערב בניו יורק) → כולל אותו יום');
  ok(J.pxFresh({ at: '2026-11-16T21:30:00Z' }, Date.parse('2026-11-17T14:00:00Z')), 'מחירים שנמשכו אחרי הסגירה אתמול — טריים בבוקר');
  ok(!J.pxFresh({ at: '2026-11-16T21:30:00Z' }, Date.parse('2026-11-17T21:40:00Z')), 'אחרי הסגירה של היום — מרעננים');
  ok(!J.pxFresh({ at: '2026-11-16T15:00:00Z' }, Date.parse('2026-11-16T21:40:00Z')), 'נמשכו באמצע המסחר — אחרי הסגירה מרעננים');

  /* ---- אופציות לא נכנסות לכמות המניות (P&G, רבעון 2 2013) ---- */
  const q13 = DATA.quarters.find((q) => q.p === '2013-06-30');
  const qq = AB.qFrom(q13, DATA.symbols);
  const pg = qq.rows.find((r) => r.sym === 'PG');
  ok(pg && pg.shares === q13.h.find((r) => r[0] === 'PG' && !r[3])[1] && qq.calls.some((c) => c.sym === 'PG' && c.shares === 25000000), 'אופציות CALL — בצד (calls), לא בכמות המניות');

  /* ---- מחזור מלא: הגשות חדשות → בנייה → הגשה לאפליקציה ---- */
  const NOW = Date.parse('2026-12-15T22:00:00Z');   // 17:00 בניו יורק, יום שלישי — אחרי הסגירה
  const acc = { q3: '0001172661-26-009001', old: '0001172661-26-003790', g1: '0001193125-26-460795', g2: '0001140361-26-099002', f1: '0001140361-26-042135', d1: '0001140361-26-099003', nt: '0001172661-26-009000' };
  const base = (cik, a) => 'https://www.sec.gov/Archives/edgar/data/' + cik + '/' + a.replace(/-/g, '') + '/';
  const sub = (rows) => ({ filings: { recent: {
    form: rows.map((r) => r[0]), accessionNumber: rows.map((r) => r[1]), filingDate: rows.map((r) => r[2]), reportDate: rows.map((r) => r[3] || ''), primaryDocument: rows.map((r) => r[4]),
  } } });
  const SUBS = {
    '0002026053': sub([
      ['SCHEDULE 13D/A', acc.d1, '2026-12-04', '', 'xslSCHEDULE_13D_X02/primary_doc.xml'],
      ['13F-HR', acc.q3, '2026-11-16', '2026-09-30', 'xslForm13F_X02/primary_doc.xml'],
      ['SCHEDULE 13G/A', acc.g2, '2026-11-14', '', 'xslSCHEDULE_13G_X02/primary_doc.xml'],
      ['SCHEDULE 13G/A', acc.g1, '2026-11-13', '', 'xslSCHEDULE_13G_X02/primary_doc.xml'],
      ['4', acc.f1, '2026-11-05', '2026-11-03', 'xslF345X06/form4.xml'],
      ['10-Q', '0001193125-26-450239', '2026-11-06', '2026-09-30', 'ps-20260930.htm'],
      ['13F-HR', acc.old, '2026-08-14', '2026-06-30', 'xslForm13F_X02/primary_doc.xml'],
    ]),
    '0001336528': sub([['13F-NT', acc.nt, '2026-11-16', '2026-09-30', 'xslForm13F_X02/primary_doc.xml']]),
  };
  const primQ3 = FX('13f-2026q2-primary.xml').replace(/06-30-2026/g, '09-30-2026');
  const newRow = '  <infoTable>\n    <nameOfIssuer>NEWCO INC</nameOfIssuer>\n    <titleOfClass>COM</titleOfClass>\n    <cusip>999999999</cusip>\n    <value>50000000</value>\n    <shrsOrPrnAmt>\n      <sshPrnamt>1000000</sshPrnamt>\n      <sshPrnamtType>SH</sshPrnamtType>\n    </shrsOrPrnAmt>\n    <investmentDiscretion>DFND</investmentDiscretion>\n    <otherManager>1, 2, 3, 4</otherManager>\n  </infoTable>\n';
  const tableQ3 = FX('13f-2026q2-table.xml').replace(/<sshPrnamt>34326200<\/sshPrnamt>/, '<sshPrnamt>30000000</sshPrnamt>').replace(/(<\/(?:\w+:)?informationTable>)/, newRow + '$1');
  const g13 = (cik, cusip, name) => '<edgarSubmission><headerData><submissionType>SCHEDULE 13G/A</submissionType></headerData><formData><coverPageHeader><eventDateRequiresFilingThisStatement>09/30/2026</eventDateRequiresFilingThisStatement><issuerInfo><issuerCik>' + cik + '</issuerCik><issuerName>' + name + '</issuerName><issuerCusips><issuerCusipNumber>' + cusip + '</issuerCusipNumber></issuerCusips></issuerInfo></coverPageHeader><coverPageHeaderReportingPersonDetails><reportingPersonName>Pershing Square Capital Management, L.P.</reportingPersonName><reportingPersonBeneficiallyOwnedAggregateNumberOfShares>30000000</reportingPersonBeneficiallyOwnedAggregateNumberOfShares><classPercent>1.4</classPercent></coverPageHeaderReportingPersonDetails></formData></edgarSubmission>';
  const d13 = '<edgarSubmission><headerData><submissionType>SCHEDULE 13D/A</submissionType></headerData><formData><coverPageHeader><dateOfEvent>12/03/2026</dateOfEvent><issuerInfo><issuerCIK>0001618756</issuerCIK><issuerCusips><issuerCusipNumber>76131D103</issuerCusipNumber></issuerCusips><issuerName>Restaurant Brands International Inc.</issuerName></issuerInfo></coverPageHeader><reportingPersons><reportingPersonInfo><reportingPersonName>Pershing Square Capital Management, L.P.</reportingPersonName><aggregateAmountOwned>26071284</aggregateAmountOwned><percentOfClass>7.5</percentOfClass></reportingPersonInfo></reportingPersons></formData></edgarSubmission>';
  const ex = '<table><tr><td>Name</td><td>Trade Date</td><td>Buy/Sell</td><td>No. of Shares</td><td>Unit Cost</td><td>Security</td></tr>'
    + '<tr><td>Pershing Square, L.P.</td><td>December 1, 2026</td><td>Buy</td><td>100,000</td><td>$</td><td>70.10</td><td>Common Stock</td></tr>'
    + '<tr><td>Pershing Square Holdings, Ltd.</td><td>December 2, 2026</td><td>Sell</td><td>50,000</td><td>$71.00</td><td>Common Stock</td></tr>'
    + '<tr><td>Pershing Square USA, Ltd.</td><td>December 3, 2026</td><td>Buy</td><td>200,000</td><td>$70.50</td><td>OTC Equity Forward</td></tr></table>';
  const FILES = {
    [base(2026053, acc.q3) + 'index.json']: { directory: { item: [{ name: 'primary_doc.xml' }, { name: 'infotable.xml' }] } },
    [base(2026053, acc.q3) + 'primary_doc.xml']: primQ3,
    [base(2026053, acc.q3) + 'infotable.xml']: tableQ3,
    [base(2026053, acc.g1) + 'index.json']: { directory: { item: [{ name: 'primary_doc.xml' }] } },
    [base(2026053, acc.g1) + 'primary_doc.xml']: g13('0002026053', '71531U102', 'Pershing Square Inc.'),
    [base(2026053, acc.g2) + 'index.json']: { directory: { item: [{ name: 'primary_doc.xml' }] } },
    [base(2026053, acc.g2) + 'primary_doc.xml']: g13('0001543151', '90353T100', 'Uber Technologies, Inc.'),
    [base(2026053, acc.f1) + 'form4.xml']: FX('form4-hhc-2018-11-08.xml'),
    [base(2026053, acc.d1) + 'index.json']: { directory: { item: [{ name: 'primary_doc.xml' }, { name: 'ex99-1.htm' }, { name: 'ex99-2.htm' }] } },
    [base(2026053, acc.d1) + 'primary_doc.xml']: d13,
    [base(2026053, acc.d1) + 'ex99-1.htm']: ex,
    [base(2026053, acc.d1) + 'ex99-2.htm']: '<table><tr><td>Name</td><td>Title</td></tr></table>',
  };
  /* מחירים מדומים לכל סימבול: ימי חול מ־2005, גל סינוס סביב מחיר קבוע לכל מניה */
  let now = NOW;
  const chart = (sym) => {
    const days = [];   // עד "עכשיו" של הבדיקה — כמו Yahoo
    for (let t = Date.parse('2005-01-03T12:00:00Z'); t <= now; t += 864e5) { const wd = new Date(t).getUTCDay(); if (wd && wd !== 6) days.push(t / 1000); }
    const b = 20 + [...sym].reduce((s, ch) => s + ch.charCodeAt(0), 0) % 80;
    const c = days.map((t, i) => Math.round(b * (1 + 0.2 * Math.sin(i / 40)) * 100) / 100);
    return { chart: { result: [{ meta: { currency: 'USD', gmtoffset: 0 }, timestamp: days, indicators: { quote: [{ close: c, high: c.map((x) => x * 1.01), low: c.map((x) => x * 0.99), volume: c.map(() => 1e6) }] }, events: {} }] } };
  };
  const calls = [];
  const resp = (status, body) => ({ status, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)), json: async () => (typeof body === 'string' ? JSON.parse(body) : body) });
  const fakeFetch = async (url, o) => {
    calls.push({ url, ua: (o && o.headers && o.headers['User-Agent']) || '', method: (o && o.method) || 'GET', body: (o && o.body) || '' });
    let m = /^https:\/\/data\.sec\.gov\/submissions\/CIK(\d{10})\.json$/.exec(url);
    if (m) return SUBS[m[1]] ? resp(200, SUBS[m[1]]) : resp(404, '');
    if (FILES[url] != null) return resp(200, FILES[url]);
    if (url === 'https://api.openfigi.com/v3/mapping') {
      const q = JSON.parse(o.body)[0];
      return resp(200, [q.idValue === '999999999' ? { data: [{ ticker: 'NEWCO', name: 'NEWCO INC', securityType: 'Common Stock' }] } : { error: 'No identifier found.' }]);
    }
    m = /^https:\/\/query1\.finance\.yahoo\.com\/v8\/finance\/chart\/([^?]+)\?/.exec(url);
    if (m) return resp(200, chart(decodeURIComponent(m[1])));
    return resp(404, '');
  };
  const mem = new Map();
  const store = { get: (k) => (mem.has(k) ? JSON.parse(mem.get(k)) : null), put: (k, o) => mem.set(k, JSON.stringify(o)) };
  const deps = { fetch: fakeFetch, store, gap: 0, now: () => now };

  ok((await J.tick({ fetch: fakeFetch, gap: 0, r2c: { ok: false } })).error === 'no_r2' && calls.length === 0, 'בלי R2 — לא פונים ל־SEC בכלל');
  const t0 = Date.now();
  const r1 = await J.tick(deps);
  ok(r1.ok && r1.polled && r1.v, 'סיבוב ראשון: נבדק ונבנה (' + (Date.now() - t0) + 'ms)');
  const S = store.get(J.KEY.state);
  ok([acc.q3, acc.g1, acc.g2, acc.f1, acc.d1, acc.old].every((a) => S.seen[a]) && !S.seen[acc.nt] && !S.seen['0001193125-26-450239'], 'כל ההגשות הרלוונטיות סומנו; 13F-NT ו־10-Q — לא נוגעים');
  ok(!calls.some((c) => c.url.includes(acc.old.replace(/-/g, ''))), '13F שכבר בנתונים שבריפו — לא נקרא שוב');
  const Q3 = S.quarters.find((q) => q.p === '2026-09-30');
  const h3 = Q3 && new Map(Q3.h.map((r) => [r[0], r[1]]));
  ok(Q3 && Q3.h.length === 14 && h3.get('UBER') === 30000000 && h3.get('NEWCO') === 1000000 && h3.get('HHH') === 18852064, '13F חדש: 13 אחזקות + מניה חדשה; HHH של הקרנות בלבד (בלי 9M של חברת הניהול)');
  ok(!Q3.h.some((r) => /^CUSIP-/.test(r[0])) && S.symbols.NEWCO && S.symbols.NEWCO.cu[0] === '999999999', 'CUSIP חדש → סימבול (OpenFIGI)');
  ok(S.exact.length === 2 && S.exact[0].qty === 100000 && S.exact[0].price === 70.1 && S.exact[1].qty === -50000 && S.exact.every((x) => x.sym === 'QSR' && x.src === '13D Item 5(c)'), '13D/A: שתי העסקאות במניה נכנסו, חוזה ה־Forward לא');
  const kinds = S.events.map((e) => e.kind + ':' + (e.sym || e.period));
  ok(kinds.join() === '13G:UBER,13F:2026-09-30,13D:QSR', 'ציר הזמן לפי סדר ההגשה: ‏13G על מניה בתיק, ‏13F, ‏13D — בלי ה־13G על מניות Pershing Square Inc. ובלי Form 4 של מנפיק אחר');
  ok(S.events.find((e) => e.kind === '13D').shares === 26071284 && S.events.find((e) => e.kind === '13D').n === 2, '13D: מספר המניות והעסקאות בציר הזמן');
  const secCalls = calls.filter((c) => /sec\.gov/.test(c.url));
  ok(secCalls.length && secCalls.every((c) => /TheSnowball/.test(c.ua)), 'כל בקשה ל־SEC עם User-Agent מזוהה');
  ok(!calls.some((c) => /yishai|gmail/i.test(c.url + c.ua + c.body)), 'בלי פרטים אישיים בבקשות החוצה');

  const meta = store.get(J.KEY.meta), book = store.get(J.KEY.book);
  const pos = new Map(book.positions.map((p) => [p.symbol, p.qty]));
  ok(meta.v === r1.v && meta.asOf === '2026-12-15' && book.meta.toDate === '2026-12-15' && meta.lastQ === '2026-09-30', 'הספר נבנה עד יום המסחר האחרון שנסגר; הרבעון האחרון — 30/9');
  ok(pos.get('QSR') === h3.get('QSR') + 50000 && pos.get('UBER') === 30000000 && pos.get('NEWCO') === 1000000 && pos.get('MSFT') === h3.get('MSFT'), 'הכמויות: ה־13F החדש + עסקאות ה־13D שאחריו');
  ok(book.trades.some((t) => t.src === '13D Item 5(c)' && !t.est && t.tradeDate === '2026-12-01' && t.qty === 100000 && t.price === 70.1), 'עסקת ה־13D בספר — מדויקת (לא נאמדת), עם התאריך והמחיר');
  ok(book.ackman.events.length === 3 && book.ackman.v === meta.v && book.ackman.asOf === '2026-12-15', 'הספר נושא את ציר הזמן ואת הגרסה');
  const yahoo1 = calls.filter((c) => /yahoo/.test(c.url)).length;

  // אותו יום, אחרי הבנייה: אין הגשות חדשות → לא בונים שוב
  calls.length = 0;
  const r2 = await J.tick(deps);
  ok(r2.ok && r2.changed === false && !r2.v && !calls.some((c) => /yahoo/.test(c.url)), 'סיבוב שני באותו ערב: רק בדיקת SEC, בלי בנייה ובלי Yahoo');
  // למחרת אחרי הסגירה: בנייה יומית — רק המניות שבתיק נמשכות שוב
  now = Date.parse('2026-12-16T22:00:00Z');
  calls.length = 0;
  const r3 = await J.tick(deps);
  const yahoo3 = calls.filter((c) => /yahoo/.test(c.url)).length;
  ok(r3.ok && r3.v && r3.v !== r1.v && store.get(J.KEY.meta).asOf === '2026-12-16', 'למחרת אחרי הסגירה: בנייה יומית — יום נוסף');
  ok(yahoo3 > 0 && yahoo3 <= 20 && yahoo3 < yahoo1, 'בנייה יומית: רק המניות שבתיק ו־SPY נמשכות שוב (' + yahoo3 + ' מתוך ' + yahoo1 + ')');
  ok((await J.rebuild(deps)).same === true, 'בנייה חוזרת בלי שינוי — אותה גרסה, לא נכתב שוב');

  /* ---- ההגשה לאפליקציה ---- */
  const mkRes = () => ({ code: 200, headers: {}, out: null, body: null,
    status(c) { this.code = c; return this; }, json(o) { this.body = o; return this; }, setHeader(k, v) { this.headers[k] = v; },
    end(b) { this.out = b; return this; }, set statusCode(c) { this.code = c; }, get statusCode() { return this.code; } });
  J._reset();
  let res = mkRes();
  await J.serve({ headers: {} }, {}, res, { store: { get: () => null, put() {} } });
  ok(res.body && res.body.ok === false && res.body.error === 'not_ready', 'הגשה: אין עדיין ספר → not_ready');
  J._reset();
  res = mkRes();
  await J.serve({ headers: { 'accept-encoding': 'gzip, br' } }, {}, res, deps);
  const got = JSON.parse(zlib.gunzipSync(res.out).toString('utf8'));
  ok(res.headers['Content-Encoding'] === 'gzip' && got.ok && got.v === r3.v && got.book.positions.length === book.positions.length, 'הגשה: הספר המלא, דחוס ב־gzip (' + Math.round(res.out.length / 1024) + 'KB)');
  ok(/Origin/.test(res.headers.Vary) && res.headers['Cache-Control'] === 'no-store', 'הגשה: Vary כולל Origin, בלי מטמון בדרך');
  res = mkRes();
  await J.serve({ headers: {} }, { v: r3.v }, res, deps);
  ok(res.body && res.body.same === true && !res.body.book, 'הגשה: הגרסה שכבר בטלפון → {same:true} בלי הספר');
  res = mkRes();
  await J.serve({ headers: {} }, {}, res, deps);
  ok(!res.headers['Content-Encoding'] && JSON.parse(res.out.toString('utf8')).v === r3.v, 'הגשה: בלי gzip — JSON רגיל');

  /* ---- המסלול ב־/api/history ---- */
  const history = require(path.join(ROOT, 'ibkr-proxy/api/history.js'));
  const env0 = { VERCEL: process.env.VERCEL, CRON_SECRET: process.env.CRON_SECRET };
  process.env.VERCEL = '1';
  res = mkRes();
  await history({ method: 'GET', url: '/api/history?job=ackman', query: { job: 'ackman' }, headers: {} }, res);
  ok(res.code === 404, 'job=ackman ב־Vercel → 404 (רק בשרת שלנו)');
  delete process.env.VERCEL;
  process.env.CRON_SECRET = 'test-secret';
  res = mkRes();
  await history({ method: 'GET', url: '/api/history?job=ackman', query: { job: 'ackman' }, headers: { authorization: 'Bearer nope' } }, res);
  ok(res.code === 401, 'job=ackman בלי הסוד → 401');
  for (const [k, v] of Object.entries(env0)) { if (v == null) delete process.env[k]; else process.env[k] = v; }
  J._reset();
  res = mkRes();
  await history({ method: 'POST', url: '/api/history', headers: { origin: 'http://localhost:8080' }, body: { op: 'ackman' }, socket: { remoteAddress: '10.0.0.7' } }, res);
  ok(res.code === 200 && res.body && res.body.ok === false && res.body.error === 'not_ready', 'op:ackman דרך /api/history — בלי R2 מוגדר: not_ready');
  res = mkRes();
  await history({ method: 'POST', url: '/api/history', headers: { origin: 'https://evil.example' }, body: { op: 'ackman' }, socket: { remoteAddress: '10.0.0.8' } }, res);
  ok(res.code === 403, 'op:ackman ממקור לא מאושר → 403');

  /* ---- השרת: השעון ---- */
  const srv = fs.readFileSync(path.join(ROOT, 'ibkr-proxy/server.js'), 'utf8');
  ok(/startAckman\(server\)/.test(srv) && /SNB_ACKMAN/.test(srv) && /job=ackman/.test(srv), 'server.js — הבודק מופעל כל 10 דק׳ (SNB_ACKMAN=off מכבה)');

  console.log(`\nכל ${n} הבדיקות עברו ✓`);
})().catch((e) => { console.error(e); process.exit(1); });
