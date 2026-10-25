/* 25/10/2026 — עסקאות IBKR באותו יום לא היו בסדר כרונולוגי, ובלי שעה.
   עכשיו: שעה ודקה בשורה, ומיון לפי שעה (ובעסקאות ישנות בלי שעה — לפי מזהה העסקה).
   הרצה: node tests/ibkr-trade-time.test.js */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

let n = 0;
const ok = (cond, name) => { n++; assert(cond, name); console.log('ok -', name); };
const store = {};
const sandbox = {
  localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
  document: { addEventListener() {}, getElementById: () => null, querySelectorAll: () => [], createElement: () => ({}) },
  window: {}, navigator: {}, location: {},
  fetch: async () => { throw new Error('no fetch'); },
  setTimeout, clearTimeout, console,
};
vm.createContext(sandbox);
const root = path.join(__dirname, '..');
vm.runInContext(fs.readFileSync(path.join(root, 'returns.js'), 'utf8'), sandbox, { filename: 'returns.js' });
vm.runInContext(fs.readFileSync(path.join(root, 'app.js'), 'utf8') +
  '\n;globalThis.__t = { tradeNewestFirst, tradeRowData, ibkrTrades, ibkrSaveCfg, rMergeData };', sandbox, { filename: 'app.js' });
const T = sandbox.__t;

// אותו יום: קנייה 09:31, מכירה 10:05, קנייה 15:59 — מהחדשה לישנה
const day = [
  { symbol: 'A', date: '2026-10-23', time: '09:31:00', tradeId: '100', side: 'BUY' },
  { symbol: 'B', date: '2026-10-23', time: '15:59:10', tradeId: '300', side: 'BUY' },
  { symbol: 'C', date: '2026-10-23', time: '10:05:00', tradeId: '200', side: 'SELL' },
  { symbol: 'D', date: '2026-10-22', time: '16:00:00', tradeId: '50', side: 'BUY' },
];
T.ibkrSaveCfg({ data: { trades: day } });
ok(T.ibkrTrades().map((x) => x.symbol).join('') === 'BCAD', 'מיון לפי תאריך ואז שעה — מהחדשה לישנה');

// עסקאות ישנות בלי שעה — לפי מזהה העסקה (גם באורכים שונים)
const old = [
  { symbol: 'X', date: '2026-10-23', tradeId: '999' },
  { symbol: 'Y', date: '2026-10-23', tradeId: '1001' },
  { symbol: 'Z', date: '2026-10-23', tradeId: '1000' },
];
ok(old.slice().sort(T.tradeNewestFirst).map((x) => x.symbol).join('') === 'YZX', 'בלי שעה — לפי מזהה העסקה (מספרי)');

// תצוגה: שעה ודקה
ok(T.tradeRowData(day[1]).time === '15:59', 'שעה ודקה לתצוגה');
ok(T.tradeRowData({ date: '2026-10-23' }).time === '', 'בלי שעה — ריק');

// מיזוג: עסקה ישנה בלי שעה מקבלת את השעה ממשיכה חדשה של אותה עסקה
const m = T.rMergeData({ trades: [{ symbol: 'A', date: '2026-10-23', tradeId: '100' }] },
  { trades: [{ symbol: 'A', date: '2026-10-23', tradeId: '100', time: '09:31:00' }] });
ok(m.trades.length === 1 && m.trades[0].time === '09:31:00', 'מיזוג משלים שעה בלי לשכפל');

console.log('\nכל ' + n + ' הבדיקות עברו.');
