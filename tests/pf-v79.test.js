/* v79 QA: firstEv מתחיל מ־fromDate, לא מ־1/1.
   הבאג: buildTradesHistory(o, '2024-09-24') סינן אירועים מ־2024-09-24,
   אבל firstEv='2024-01-01' כלל תאריכים פיקטיביים (ינואר־אוגוסט 2024)
   ב־dateSet — ה־TWR חושב תשואה על ערכים מדומיינים לפני ההקמה.
   התיקון: firstEv = fromDate כשסופק.
   Run: node tests/pf-v79.test.js */
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
const document = { addEventListener() {}, getElementById: () => null, querySelectorAll: () => [], createElement: () => ({}) };
const sandbox = {
  localStorage, document, window: {}, navigator: {}, location: {},
  AbortController, fetch: (...a) => fetch(...a),
  setTimeout, clearTimeout, console,
};
vm.createContext(sandbox);
const src = fs.readFileSync(__dirname + '/../app.js', 'utf8');
vm.runInContext(src + `
  globalThis.__t = { buildTradesHistory };
`, sandbox);
const T = sandbox.__t;

// תרחיש: הפקדה 100$ ב־2024-09-24, קנייה 10 מניות @ 10$ ב־2024-09-25,
// מחיר עולה ל־15$ ב־2026-09-23. תשואה אמיתית: +50%.
const mkHist = () => {
  const h = [];
  // היסטוריה מ־2024-01-01 (כולל לפני ההקמה!)
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0');
    h.push({ date: '2024-' + mm + '-15', close: 10 });
  }
  h.push({ date: '2024-09-24', close: 10 });
  h.push({ date: '2024-09-25', close: 10 });
  h.push({ date: '2026-09-23', close: 15 });
  return h.sort((a, b) => a.date < b.date ? -1 : 1);
};
const o = {
  trades: [{ symbol: 'AAA', date: '2024-09-25', qty: 10, price: 10, side: 'BUY', commission: 0, fxToBase: 1 }],
  cashTx: [{ date: '2024-09-24', amount: 100, currency: 'USD', fxToBase: 1, type: 'Transfer IN', description: '' }],
  positions: [{ sym: 'AAA', shares: 10 }],
  cash: { usd: 0, ils: 0 },
  hist: { AAA: mkHist() },
  fxOf: () => 1,
};

// Mock ibkrIsStockTrade / ibkrIsDepositTx — מוגדרים ב־app.js, אבל buildTradesHistory
// קורא להם ישירות. נוודא שהם עובדים דרך הסנדבוקס.
{
  const rows = T.buildTradesHistory(o, '2024-09-24');
  ok(rows.length >= 2, `התקבלו ${rows.length} שורות TWR`);
  const firstDate = rows[0].date;
  // הבאג: firstDate היה '2024-01-15' (פיקטיבי). התיקון: >= '2024-09-24'.
  ok(firstDate >= '2024-09-24', `שורה ראשונה: ${firstDate} (>= 2024-09-24, לא פיקטיבי)`);
  const lastVal = rows[rows.length - 1].value;
  const ret = lastVal - 100;
  // תשואה אמיתית: 10 מניות @ 10$ → @ 15$ = +50%. בלי זיהום פיקטיבי.
  ok(Math.abs(ret - 50) < 1.0, `תשואה: ${ret.toFixed(2)}% (≈+50%, לא מעוותת)`);
}

console.log(`\n${n} בדיקות v79 עברו ✓`);
