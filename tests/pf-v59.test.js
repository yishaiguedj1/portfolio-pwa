'use strict';
/* בדיקות v59: התאמת ספליטים בשחזור TWR */
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const sandbox = { localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  document: { addEventListener() {}, getElementById: () => null, querySelectorAll: () => [], createElement: () => ({}) },
  window: {}, navigator: {}, location: {}, AbortController, fetch: async () => { throw new Error('no net'); },
  setTimeout, clearTimeout, console };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('/home/hatch/workspace/pwa-portfolio/app.js', 'utf8') +
  '\n;globalThis.__t={parseYahooBars, applySplitAdjustment, buildTradesHistory};', sandbox, { filename: 'app.js' });
const T = sandbox.__t;
let passed = 0;
function ok(name, cond) { assert(cond, name); console.log('  PASS ' + name); passed++; }

// מדמה תשובת Yahoo עם ספליט 2:1 — close לא מותאם, adjclose מותאם
function mockYahoo(nDays, splitIdx) {
  const ts = [], closes = [], adj = [];
  const t0 = Date.UTC(2026, 0, 1) / 1000;
  let p = 100;
  for (let i = 0; i < nDays; i++) {
    ts.push(t0 + i * 86400);
    p *= 1.001;
    closes.push(i < splitIdx ? p * 2 : p);
    adj.push(p);
  }
  return { chart: { result: [{ timestamp: ts, meta: { gmtoffset: -18000 },
    indicators: { quote: [{ open: closes, high: closes, low: closes, close: closes, volume: closes.map(() => 1000) }],
      adjclose: [{ adjclose: adj }] } }] } };
}

const rows = T.parseYahooBars(mockYahoo(60, 30), false);
ok('ספליט 2:1 זוהה', (rows.splitsApplied || '').includes('×2'));
ok('מחיר טרום־ספליט הותאם (100 ולא 200)', rows[0].close > 90 && rows[0].close < 110);
ok('מחיר אחרי ספליט לא השתנה', rows[59].close > 100 && rows[59].close < 112);

// TWR מקצה לקצה: קנייה 100 @ 200$ לפני ספליט, החזקה — התשואה ~6%
const h = rows.map((r) => ({ date: r.date, close: r.close }));
const tr = T.buildTradesHistory({
  trades: [{ date: h[5].date, symbol: 'XXX', side: 'BUY', qty: 100, price: 200, commission: 0, currency: 'USD', fxToBase: 1 }],
  positions: [{ sym: 'XXX', shares: 200 }],
  cash: { usd: 0, ils: 0 }, cashTx: [],
  hist: { XXX: h }, fxOf: () => 3.3,
});
const twr = tr.length ? tr[tr.length - 1].value / 100 - 1 : NaN;
ok('TWR עם ספליט חיובי ונכון (~6%, לא שלילי עמוק)', twr > 0.03 && twr < 0.10);

// בלי ספליט — אין התאמה, אין שינוי
const rows2 = T.parseYahooBars(mockYahoo(60, -1), false);
ok('בלי ספליט אין splitsApplied', !rows2.splitsApplied);
ok('בלי ספליט המחיר נשאר (~100)', rows2[0].close > 90 && rows2[0].close < 110);

console.log(`\n${passed} passed, 0 failed`);
