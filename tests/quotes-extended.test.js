/* בדיקות למסחר מורחב (pre/post-market) בציטוטים: parseYahooQuote / parseCNBCQuotes / etSessionNow.
   הרצה: node tests/quotes-extended.test.js */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

let n = 0;
const ok = (cond, name) => { n++; assert(cond, name); console.log('ok -', name); };

const store = {};
const localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};
const document = {
  addEventListener() {},
  getElementById: () => null,
  querySelectorAll: () => [],
  createElement: () => ({}),
};
const sandbox = {
  localStorage, document,
  window: {}, navigator: {}, location: {},
  fetch: async () => { throw new Error('no fetch'); },
  setTimeout, clearTimeout, console,
};
vm.createContext(sandbox);
const src = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8') +
  '\n;globalThis.__t = { parseYahooQuote, parseCNBCQuotes, etSessionNow };';
vm.runInContext(src, sandbox, { filename: 'app.js' });
const T = sandbox.__t;
ok(!!T, 'app.js נטען בלי שגיאות תחביר');

/* ---------- etSessionNow ---------- */
// 2026-09-23T07:35:00-04:00 = premarket; 10:00-04:00 = regular; 17:00-04:00 = post; 02:00-04:00 = closed
const ts = (s) => new Date(s).getTime();
ok(T.etSessionNow(ts('2026-09-23T07:35:00-04:00')) === 'pre', 'בוקר ET מוקדם = pre');
ok(T.etSessionNow(ts('2026-09-23T04:00:00-04:00')) === 'pre', 'פתיחת premarket בדיוק = pre');
ok(T.etSessionNow(ts('2026-09-23T10:00:00-04:00')) === '', 'שעות מסחר = ריק');
ok(T.etSessionNow(ts('2026-09-23T17:00:00-04:00')) === 'post', 'אחרי הסגירה = post');
ok(T.etSessionNow(ts('2026-09-23T02:00:00-04:00')) === '', 'לילה = ריק');
ok(T.etSessionNow(ts('2026-09-23T09:29:00-04:00')) === 'pre', 'דקה לפני פתיחה = pre');
ok(T.etSessionNow(ts('2026-09-23T09:30:00-04:00')) === '', 'פתיחה בדיוק = ריק');

/* ---------- parseYahooQuote ---------- */
function yahooJSON(closes, ctp) {
  return {
    chart: {
      result: [{
        meta: {
          regularMarketPrice: 339.75,
          regularMarketDayHigh: 345.34,
          regularMarketDayLow: 338.75,
          chartPreviousClose: 338.98,
          regularMarketVolume: '40599377',
          currentTradingPeriod: ctp || {},
        },
        timestamp: closes.map((_, i) => 1790150000 + i * 60),
        indicators: { quote: [{ close: closes }] },
      }],
      error: null,
    },
  };
}
const nowPre = ts('2026-09-23T07:35:00-04:00');
const ctpPre = {
  pre: { start: nowPre / 1000 - 3600, end: nowPre / 1000 + 7200 },
  regular: { start: nowPre / 1000 + 7200, end: nowPre / 1000 + 23400 },
  post: { start: nowPre / 1000 + 23400, end: nowPre / 1000 + 37800 },
};
{
  const q = T.parseYahooQuote(yahooJSON([339.0, null, 340.45], ctpPre), 'AAPL', nowPre);
  ok(q && q.close === 340.45, 'Yahoo: מחיר premarket מנר הדקה האחרון (null מדולג)');
  ok(q.session === 'pre', 'Yahoo: session=pre');
  ok(q.prev === 338.98, 'Yahoo: prev נשמר לחישוב שינוי יומי');
  const q2 = T.parseYahooQuote(yahooJSON([null, null], ctpPre), 'AAPL', nowPre);
  ok(q2 && q2.close === 339.75, 'Yahoo: גיבוי ל־regularMarketPrice כשאין נרות');
  const nowReg = ts('2026-09-23T10:00:00-04:00');
  const q3 = T.parseYahooQuote(yahooJSON([350.0], {
    pre: { start: 1, end: 2 }, regular: { start: nowReg / 1000 - 10, end: nowReg / 1000 + 10000 }, post: { start: 3, end: 4 },
  }), 'AAPL', nowReg);
  ok(q3 && q3.session === 'regular', 'Yahoo: session=regular בשעות מסחר');
  ok(T.parseYahooQuote({ chart: { error: 'x' } }, 'AAPL') === null, 'Yahoo: שגיאה מחזירה null');
  ok(T.parseYahooQuote(yahooJSON([], {}), 'ZZZ') === null || true, 'Yahoo: לא קורס בלי ctp');
}

/* ---------- parseCNBCQuotes ---------- */
function cnbcJSON(ext) {
  return {
    FormattedQuoteResult: {
      FormattedQuote: [{
        symbol: 'aapl',
        last: '339.75',
        last_time: '2026-09-22',
        open: '340.00', high: '341.00', low: '338.00',
        volume: '40,599,377',
        ExtendedMktQuote: ext || undefined,
      }],
    },
  };
}
{
  const ext = { type: 'PRE_MKT', last: '340.45', last_timedate: '7:35 AM EDT', last_time: '2026-09-23T07:35:44.451-0400' };
  const q = T.parseCNBCQuotes(cnbcJSON(ext), 'pre');
  ok(q.AAPL.close === 340.45, 'CNBC: מחיר premarket מ־ExtendedMktQuote');
  ok(q.AAPL.session === 'pre', 'CNBC: session=pre');
  ok(q.AAPL.time === '7:35 AM EDT', 'CNBC: זמן מורחב נשמר');
  const q2 = T.parseCNBCQuotes(cnbcJSON(ext), '');
  ok(q2.AAPL.close === 339.75 && q2.AAPL.session === '', 'CNBC: בלי סשן — המחיר הרגיל');
  const q3 = T.parseCNBCQuotes(cnbcJSON(ext), 'post');
  ok(q3.AAPL.close === 339.75, 'CNBC: סוג לא תואם (PRE בזמן post) — לא משתמשים במורחב');
  const extPost = { type: 'POST_MKT', last: '341.20', last_timedate: '5:00 PM EDT' };
  const q4 = T.parseCNBCQuotes(cnbcJSON(extPost), 'post');
  ok(q4.AAPL.close === 341.20 && q4.AAPL.session === 'post', 'CNBC: post-market עובד');
  const q5 = T.parseCNBCQuotes(cnbcJSON(null), 'pre');
  ok(q5.AAPL.close === 339.75, 'CNBC: בלי ExtendedMktQuote — גיבוי ל־last');
  const q6 = T.parseCNBCQuotes(cnbcJSON({ type: 'PRE_MKT', last: '0' }), 'pre');
  ok(q6.AAPL.close === 339.75, 'CNBC: מחיר מורחב 0 — מתעלמים');
}

console.log('\nכל ' + n + ' הבדיקות עברו.');
