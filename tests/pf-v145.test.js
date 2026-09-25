// pf-v145.test.js — טאב ההפקדות במצב IBKR כולל כסף שנכנס דרך קניות ידניות.
// קנייה ידנית = הפקדה, מכירה = משיכה, בשקלים לפי שער יום העסקה. נתונים סינתטיים בלבד.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

let n = 0;
function ok(cond, name) {
  n++;
  if (!cond) { console.error('FAIL - ' + name); process.exit(1); }
  console.log('ok - ' + name);
}

const sb = {
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  document: {
    addEventListener() {}, getElementById: () => null,
    querySelectorAll: () => [], querySelector: () => null,
    createElement: () => ({ classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {} }),
  },
  window: {}, navigator: {}, location: {},
  AbortController, fetch: () => Promise.reject(new Error('no net')),
  setTimeout, clearTimeout, console,
};
vm.createContext(sb);
vm.runInContext(src, sb);
const mf = vm.runInContext('manualFlowsILS', sb);
const close = (a, b) => Math.abs(a - b) < 0.005;

const fxOf = (d) => (d < '2026-01-01' ? 3.7 : 3.0);
const trades = [
  { id: 'a', date: '2026-03-30', sym: 'XYZ', side: 'BUY', qty: 10, price: 100, fee: 5 },   // $1,005 × 3.0
  { id: 'b', date: '2025-06-01', sym: 'ABC', side: 'BUY', qty: 2, price: 50, fee: 0 },     // $100 × 3.7
  { id: 'c', date: '2026-05-01', sym: 'XYZ', side: 'SELL', qty: 4, price: 120, fee: 5 },   // $475 × 3.0 החוצה
  { id: 'd', date: '2026-02-01', sym: 'TEVA.TA', side: 'BUY', qty: 10, price: 60, fee: 0 }, // ₪600, בלי המרה
];
const r = mf([], trades, fxOf, 3.1);
ok(r.rows.length === 4, 'שורה לכל עסקה');
const byId = {}; for (const x of r.rows) byId[x.id] = x;
ok(close(byId.a.amount, -3015), 'קנייה = הפקדה (שלילי): (כמות×מחיר+עמלה)×שער יום העסקה');
ok(close(byId.b.amount, -370), 'שער לפי תאריך העסקה, לא שער היום');
ok(close(byId.c.amount, 1425), 'מכירה = משיכה (חיובי): (כמות×מחיר−עמלה)×שער');
ok(close(byId.d.amount, -600), 'מניית ת"א: כבר בשקלים, בלי המרה');
ok(close(r.inILS, 3015 + 370 - 1425 + 600), 'סה"כ נטו שנכנס = קניות − מכירות');
ok(r.rows[0].date === '2026-05-01' && r.rows[3].date === '2025-06-01', 'ממוין מהחדש לישן');

const noHist = mf([], [trades[0]], () => null, 3.1);
ok(close(noHist.rows[0].amount, -3115.5), 'בלי היסטוריית שער — נופל לשער הנוכחי');
const noFx = mf([], [trades[0]], () => null, null);
ok(noFx.rows.length === 0 && noFx.missing === 1, 'בלי שער בכלל — לא ממציאים, נספר כחסר');

const pos = [
  { sym: 'AVG1', shares: 10, avg: 20, src: 'manual' },               // לפי ממוצע
  { sym: 'XYZ', shares: 6, avg: 100, src: 'manual', fromTrades: true }, // נספר כבר דרך העסקאות
  { sym: 'IBK', shares: 100, avg: 50 },                                // IBKR — לא נספר
];
const r2 = mf(pos, [], fxOf, 3.1);
ok(r2.avgRows.length === 1 && r2.avgRows[0].sym === 'AVG1', 'רק פוזיציה ידנית "לפי ממוצע" — לא IBKR ולא לפי עסקאות');
ok(close(r2.avgRows[0].amount, -620), 'לפי ממוצע: עלות × שער נוכחי');
ok(r2.rows.length === 0 && close(r2.inILS, 620), 'סה"כ לפי ממוצע');
ok(mf(null, null, fxOf, 3).rows.length === 0, 'קלט ריק לא קורס');

// חיווט
ok(/manualFlowsILS\(POSITIONS, mtActiveTrades\(\)/.test(src), 'renderDeposits משתמש בעסקאות הפעילות (לא המוצללות)');
ok(/isIbkrMode\(\)\s*\?\s*manualFlowsILS/.test(src), 'רק במצב IBKR (במצב ידני המשתמש מזין הפקדות בעצמו)');
ok(/function netDepositsILS\(\) \{\n  return -DEPOSITS\.reduce/.test(src), 'netDepositsILS לא השתנה — התשואה/בסיס לא מושפעים');

const ver = (src.match(/APP_VERSION = '(v\d+)'/) || [])[1];
ok(fs.readFileSync(path.join(root, 'sw.js'), 'utf8').includes('portfolio-pwa-' + ver), 'CACHE_NAME תואם לגרסה');

console.log('\n' + n + ' בדיקות עברו');
