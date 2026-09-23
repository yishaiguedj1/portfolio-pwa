/* בדיקות ל־v48: היסטוריה אמיתית מעסקאות IBKR + טוען היסטוריה מהיר.
   הרצה: node tests/pf-v48.test.js */
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
let fetchCalls = [];
const yahooBars = (closes, startISO) => {
  const ts = closes.map((_, i) => Date.parse(startISO + 'T13:30:00Z') / 1000 + i * 86400);
  return {
    chart: {
      result: [{
        timestamp: ts,
        meta: { gmtoffset: 0 },
        indicators: { quote: [{ open: closes, high: closes, low: closes, close: closes, volume: closes.map(() => 1) }] },
      }],
      error: null,
    },
  };
};
const sandbox = {
  localStorage, document,
  window: {}, navigator: {}, location: {},
  AbortController,
  fetch: async (url) => {
    fetchCalls.push(String(url));
    if (String(url).includes('finance.yahoo.com')) {
      // 30 ימי מסחר: 100 -> 110
      const closes = Array.from({ length: 30 }, (_, i) => 100 + i * (10 / 29));
      return { ok: true, text: async () => JSON.stringify(yahooBars(closes, '2026-08-20')) };
    }
    throw new Error('unexpected fetch: ' + url);
  },
  setTimeout, clearTimeout, console,
};
vm.createContext(sandbox);
const src = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8') +
  '\n;globalThis.__t = { buildTradesHistory, getDailyFast, ibkrIsDepositTx, pfBenchOn, _state: () => state, _resetHist() { state.hist = {}; }, _setBench(b) { state.pfBench = b; } };';
vm.runInContext(src, sandbox, { filename: 'app.js' });
const T = sandbox.__t;
ok(!!T, 'app.js נטען בלי שגיאות תחביר');

/* ---------- buildTradesHistory ---------- */
const D = (iso, close) => ({ date: iso, close });
function hist30(sym, c0, c1, startISO) {
  const rows = [];
  const d0 = new Date(startISO + 'T12:00:00Z');
  for (let i = 0; i < 30; i++) {
    const d = new Date(d0.getTime() + i * 86400000);
    rows.push(D(d.toISOString().slice(0, 10), c0 + (c1 - c0) * (i / 29)));
  }
  return rows;
}
const fxOf = () => 3.2;

{
  ok(T.buildTradesHistory({ trades: [] }).length === 0, 'אין עסקאות -> מערך ריק');
  ok(T.buildTradesHistory({}).length === 0, 'אין כלום -> מערך ריק');
}

{ // קנייה אחת, מחיר עולה 100->110, בלי תזרים, מזומן 0 — TWR צריך להיות +10% בדיוק
  const h = hist30('AAA', 100, 110, '2026-08-20');
  const rows = T.buildTradesHistory({
    trades: [{ date: '2026-08-20', symbol: 'AAA', side: 'BUY', qty: 10, price: 100, commission: 1, currency: 'USD', fxToBase: 1 }],
    cashTx: [],
    positions: [{ sym: 'AAA', shares: 10 }],
    cash: { usd: 0, ils: 0 }, // 1000 התחלתי - 1000 קנייה - 1 עמלה... העמלה זניחה פה
    hist: { AAA: h },
    fxOf,
  });
  ok(rows.length >= 2, 'יש סדרה');
  const ret = rows[rows.length - 1].value / 100 - 1;
  ok(Math.abs(ret - 0.10) < 0.02, 'TWR +10% בלי תזרים, בפועל ' + (ret * 100).toFixed(2) + '%');
}

{ // הפקדה באמצע התקופה לא נראית כרווח: מחיר קבוע + הפקדה 9000 -> TWR ~0 (נאיבי היה +400%)
  const h = hist30('AAA', 100, 100, '2026-08-20');
  const rows = T.buildTradesHistory({
    trades: [{ date: '2026-08-20', symbol: 'AAA', side: 'BUY', qty: 10, price: 100, commission: 0, currency: 'USD', fxToBase: 1 }],
    cashTx: [{ date: '2026-09-03', amount: 9000, currency: 'USD', fxToBase: 1, type: 'Deposit', description: 'Deposit' }],
    positions: [{ sym: 'AAA', shares: 10 }],
    cash: { usd: 9000, ils: 0 }, // 1000 - 1000 + 9000
    hist: { AAA: h },
    fxOf,
  });
  const ret = rows[rows.length - 1].value / 100 - 1;
  ok(Math.abs(ret) < 0.01, 'הפקדה לא מנפחת — TWR ~0%, בפועל ' + (ret * 100).toFixed(2) + '%');
}

{ // משיכה באמצע התקופה לא נראית כהפסד: מחיר קבוע + משיכה 9000 -> TWR ~0 (נאיבי היה ‎-45%‎)
  const h = hist30('AAA', 100, 100, '2026-08-20');
  const rows = T.buildTradesHistory({
    trades: [{ date: '2026-08-21', symbol: 'AAA', side: 'BUY', qty: 100, price: 100, commission: 0, currency: 'USD', fxToBase: 1 }],
    cashTx: [
      { date: '2026-08-20', amount: 20000, currency: 'USD', fxToBase: 1, type: 'Deposit', description: 'Deposit' },
      { date: '2026-09-03', amount: -9000, currency: 'USD', fxToBase: 1, type: 'Withdrawal', description: 'Withdrawal' },
    ],
    positions: [{ sym: 'AAA', shares: 100 }],
    cash: { usd: 1000, ils: 0 }, // 20000 - 10000 - 9000
    hist: { AAA: h },
    fxOf,
  });
  const ret = rows[rows.length - 1].value / 100 - 1;
  ok(Math.abs(ret) < 0.01, 'משיכה לא מפילה — TWR ~0%, בפועל ' + (ret * 100).toFixed(2) + '%');
}

{ // הפקדה + עליית מחיר: התשואה אמיתית, לא מנופחת (נאיבי היה +205%)
  const h = hist30('AAA', 100, 110, '2026-08-20');
  const rows = T.buildTradesHistory({
    trades: [{ date: '2026-08-20', symbol: 'AAA', side: 'BUY', qty: 10, price: 100, commission: 0, currency: 'USD', fxToBase: 1 }],
    cashTx: [{ date: '2026-08-27', amount: 5000, currency: 'USD', fxToBase: 1, type: 'Deposit', description: 'Deposit' }],
    positions: [{ sym: 'AAA', shares: 10 }],
    cash: { usd: 5000, ils: 0 }, // 1000 - 1000 + 5000
    hist: { AAA: h },
    fxOf,
  });
  const ret = rows[rows.length - 1].value / 100 - 1;
  ok(ret > 0.02 && ret < 0.08, 'הפקדה + עלייה — TWR סביר (~4.6%), לא מנופח, בפועל ' + (ret * 100).toFixed(2) + '%');
}

{ // מכירה באמצע — הכמות משוחזרת לאחור נכון (לפני המכירה היו יותר מניות)
  const h = hist30('AAA', 100, 100, '2026-08-20'); // מחיר קבוע — התשואה צריכה להיות ~0
  const rows = T.buildTradesHistory({
    trades: [
      { date: '2026-08-20', symbol: 'AAA', side: 'BUY', qty: 10, price: 100, commission: 0, currency: 'USD', fxToBase: 1 },
      { date: '2026-09-01', symbol: 'AAA', side: 'SELL', qty: 4, price: 100, commission: 0, currency: 'USD', fxToBase: 1 },
    ],
    cashTx: [],
    positions: [{ sym: 'AAA', shares: 6 }],
    cash: { usd: 400, ils: 0 }, // 400 = תמורת המכירה
    hist: { AAA: h },
    fxOf,
  });
  ok(rows.length >= 2, 'סדרה עם מכירה');
  const ret = rows[rows.length - 1].value / 100 - 1;
  ok(Math.abs(ret) < 0.02, 'מחיר קבוע + מכירה -> תשואה ~0%, בפועל ' + (ret * 100).toFixed(2) + '%');
}

{ // עסקה בלי תאריך תקין מתעלמת
  const h = hist30('AAA', 100, 110, '2026-08-20');
  const rows = T.buildTradesHistory({
    trades: [
      { date: '', symbol: 'AAA', side: 'BUY', qty: 10, price: 100, commission: 0, currency: 'USD', fxToBase: 1 },
      { date: '2026-08-20', symbol: 'AAA', side: 'BUY', qty: 10, price: 100, commission: 0, currency: 'USD', fxToBase: 1 },
    ],
    cashTx: [],
    positions: [{ sym: 'AAA', shares: 10 }],
    cash: { usd: 0, ils: 0 },
    hist: { AAA: h },
    fxOf,
  });
  ok(rows.length >= 2, 'עסקה פגומה לא שוברת');
}

/* ---------- טוגל מדדי השוואה ---------- */
{
  T._setBench(null);
  ok(T.pfBenchOn('SPY') === true, 'SPY דולק כברירת מחדל');
  ok(T.pfBenchOn('QQQ') === true, 'QQQ דולק כברירת מחדל');
  T._setBench({ SPY: false });
  ok(T.pfBenchOn('SPY') === false, 'SPY כבוי אחרי טוגל');
  ok(T.pfBenchOn('QQQ') === true, 'QQQ נשאר דולק');
  T._setBench({ SPY: true, QQQ: true });
  ok(T.pfBenchOn('SPY') && T.pfBenchOn('QQQ'), 'שניהם דולקים שוב');
  T._setBench(null);
}

/* ---------- getDailyFast ---------- */
(async () => {
  T._resetHist();
  fetchCalls = [];
  const rows = await T.getDailyFast('AAA', false);
  ok(rows.length === 30, 'Yahoo תחילה — 30 שורות');
  ok(fetchCalls.some((u) => u.includes('finance.yahoo.com')), 'נקרא Yahoo');
  ok(!fetchCalls.some((u) => u.includes('twelvedata')), 'לא נקרא Twelve Data כש־Yahoo הצליח');
  ok(T._state().hist.AAA && T._state().hist.AAA.length === 30, 'נשמר ב־state.hist');
  const calls1 = fetchCalls.length;
  const rows2 = await T.getDailyFast('AAA', false);
  ok(rows2.length === 30 && fetchCalls.length === calls1, 'קריאה שנייה מהזיכרון — בלי רשת');
  console.log('\nכל הבדיקות עברו: ' + n);
})().catch((e) => { console.error('נכשל:', e); process.exit(1); });
