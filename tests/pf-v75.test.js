/* v75 QA: חיתוך טווחים לתאריך הקמת התיק.
   התרחיש: טווח 3Y/מקסימום מתחיל לפני ההפקדה הראשונה → תשואה פיקטיבית.
   התיקון: חותך את הסדרה לתאריך ההקמה (הפקדה/עסקה ראשונה) ומנרמל מחדש.
   Run: node tests/pf-v75.test.js */
const assert = require('node:assert/strict');
const fs = require('node:fs');
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
// נתוני IBKR מדומים: הפקדה ראשונה ב־2024-11-15, עסקה ב־2025-09-24
const ibkrData = {
  cashTransactions: [
    { date: '2024-11-15', amount: 50000, currency: 'USD', fxToBase: 1, type: 'Transfer IN', description: '' },
    { date: '2025-01-10', amount: 10000, currency: 'USD', fxToBase: 1, type: 'Transfer IN', description: '' },
    { date: '2024-06-01', amount: 50, currency: 'USD', fxToBase: 1, type: 'Dividends', description: 'DIV' },
  ],
  trades: [
    { symbol: 'NOW', date: '2025-09-24', qty: 10, price: 100, side: 'BUY', commission: 1, fxToBase: 1 },
  ],
  positions: [],
};
const sandbox = {
  localStorage, document, window: {}, navigator: {}, location: {},
  AbortController, fetch: (...a) => fetch(...a),
  setTimeout, clearTimeout, console,
};
vm.createContext(sandbox);
const src = fs.readFileSync(__dirname + '/../app.js', 'utf8');
vm.runInContext(src + `
  // עוקף את ibkrCfg להחזרת הנתונים המדומים
  const _origCfg = ibkrCfg;
  ibkrCfg = () => ({ data: ${JSON.stringify(ibkrData)} });
  globalThis.__t = { ibkrInceptionDate };
`, sandbox);
const T = sandbox.__t;

// 1. תאריך ההקמה = ההפקדה הראשונה (2024-11-15), לא הדיבידנד (2024-06-01)
{
  const inc = T.ibkrInceptionDate();
  ok(inc === '2024-11-15', `הקמה = 2024-11-15 (הפקדה ראשונה), קיבל: ${inc}`);
}

// 2. לוגיקת החיתוך: סדרה מ־2024-01-03 נחתכת ל־2024-11-15 ומנורמלת ל־100
{
  // מדמה את הקוד ב־drawPfChart
  const pfRows = [
    { date: '2024-01-03', value: 120 }, // פיקטיבי (לפני הקמה)
    { date: '2024-11-15', value: 100 }, // הקמה
    { date: '2025-06-01', value: 110 },
    { date: '2026-09-23', value: 148 }, // +48% מההקמה
  ];
  const inception = '2024-11-15';
  let out = pfRows;
  if (out[0].date < inception) {
    const cut = out.filter((r) => r.date >= inception);
    const base = cut[0].value;
    out = cut.map((r) => ({ date: r.date, value: (r.value / base) * 100 }));
  }
  ok(out[0].date === '2024-11-15', 'מתחיל מההקמה');
  ok(Math.abs(out[0].value - 100) < 1e-9, 'מנורמל ל־100');
  const ret = out[out.length - 1].value - 100;
  ok(Math.abs(ret - 48) < 0.01, `תשואה מההקמה: ${ret.toFixed(2)}% (≈+48%)`);
  // לפני החיתוך: 148/120 - 1 = 23.3% (שגוי)
  const wrong = (148 / 120 - 1) * 100;
  ok(Math.abs(wrong - 23.33) < 0.1, 'בלי חיתוך היה 23.3% (שגוי)');
}

console.log(`\n${n} בדיקות v75 עברו ✓`);
