/* 15/11/2026 (בקשת המשתמש): העסקאות לפי חברות ולפי שנים — החישובים הטהורים והחיווט.
   הרצה: node tests/tx-view.test.js */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

let n = 0;
const ok = (cond, name) => { n++; assert(cond, name); console.log('ok -', name); };
const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

const store = {};
function elStub() {
  return { value: '', textContent: '', innerHTML: '', classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {}, appendChild() {},
    insertBefore() {}, removeChild() {}, firstChild: null, dataset: {}, style: {}, setAttribute() {}, querySelectorAll: () => [], querySelector: () => null };
}
const els = {};
const sandbox = {
  localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
  document: { addEventListener() {}, getElementById: (id) => (els[id] || (els[id] = elStub())), querySelectorAll: () => [], createElement: () => elStub() },
  window: {}, navigator: {}, location: { reload() {} }, AbortController, setTimeout, clearTimeout, console,
  fetch: async () => { throw new Error('אין רשת בטסט'); },
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'taxil.js'), 'utf8'), sandbox, { filename: 'taxil.js' });
vm.runInContext(app + '\n;globalThis.__t = { txUnify, txYearsOf, txTotals, txCompanies, txRunning, txReturn, txReturnHTML, txReturnFifo, txAmt, txQty, renderTrades, TX_UI, POSITIONS };', sandbox, { filename: 'app.js' });
const T = sandbox.__t;

// --- איחוד: IBKR + ידני, מהחדשה לישנה, צד/כמות/עמלה מוחלטים ---
const ib = [
  { symbol: 'AAPL', date: '2026-11-10', time: '09:45:00', side: 'SELL', qty: -10, price: 228.1, commission: -1, currency: 'USD', tradeId: '9', acct: 'U1' },
  { symbol: 'AAPL', date: '2025-06-10', side: 'BUY', qty: 20, price: 195.5, commission: -1, currency: 'USD', tradeId: '3' },
  { symbol: '', date: '2026-01-01', side: 'BUY', qty: 1, price: 1 },
];
const man = [
  { id: 'm1', sym: 'aapl', date: '2026-04-02', side: 'BUY', qty: 5, price: 198, fee: 1 },
  { id: 'm2', sym: 'LUMI.TA', date: '2024-03-04', side: 'BUY', qty: 100, price: 30, fee: 0 },
];
const rows = T.txUnify(ib, man, (s) => s === 'LUMI.TA');
ok(rows.length === 4, 'איחוד: בלי סימבול ריק');
ok(rows.map((r) => r.date).join(',') === '2026-11-10,2026-04-02,2025-06-10,2024-03-04', 'איחוד: מהחדשה לישנה, משני המקורות');
ok(rows[0].src === 'ibkr' && rows[0].side === 'SELL' && rows[0].qty === 10 && rows[0].fee === 1 && rows[0].time === '09:45' && rows[0].acct === 'U1', 'IBKR: צד, כמות ועמלה מוחלטות, שעה, חשבון');
ok(rows[1].src === 'manual' && rows[1].sym === 'AAPL' && rows[1].id === 'm1' && rows[1].cur === 'USD', 'ידני: סימבול באותיות גדולות, מזהה, מטבע');
ok(rows[3].cur === 'ILS' && rows[3].shadow === true && rows[1].shadow === false, 'ת״א בשקלים; ידנית שלא נספרת מסומנת');

// --- שנים וחברות ---
const ys = T.txYearsOf(rows);
ok(ys.map((x) => x.y + ':' + x.n).join(',') === '2026:2,2025:1,2024:1', 'שנים: מהחדשה, עם מונה');
const cos = T.txCompanies(rows);
ok(cos.length === 2 && cos[0].sym === 'AAPL' && cos[0].rows.length === 3 && cos[0].last === '2026-11-10', 'חברות: לפי העסקה האחרונה, כל העסקאות שלה');

// --- סכומים לפי מטבע ---
const tt = T.txTotals(rows);
ok(tt.nb === 3 && tt.ns === 1 && tt.syms.size === 2, 'סכומים: מונה קניות/מכירות/חברות');
ok(Math.abs(tt.buy.USD - (20 * 195.5 + 5 * 198)) < 1e-6 && tt.buy.ILS === 3000 && Math.abs(tt.sell.USD - 2281) < 1e-6 && tt.fee.USD === 3, 'סכומים: לפי מטבע');
ok(T.txAmt({ USD: 12480.4, ILS: 3000 }) === '$12,480 · ₪3,000' && T.txAmt({}) === '—' && T.txAmt({ USD: 1.5 }, 2) === '$1.50', 'txAmt: דולר ראשון, ריק = מקף');
ok(T.txQty(1500) === '1,500' && T.txQty(1.23456) === '1.2346', 'txQty: מפריד אלפים, שבר עד 4 ספרות');

// --- האחזקה אחרי כל עסקה: מעוגנת להיום, הולכת אחורה ---
const aapl = cos[0].rows;   // מכירה 10, קנייה 5, קנייה 20
const run = T.txRunning(aapl, 15);
ok(run && run.join(',') === '15,25,20', 'אחרי: 15 היום → 25 לפני המכירה → 20 לפני הקנייה של 5');
ok(T.txRunning(aapl, 0) === null, 'אחזקה שלילית איפשהו (חסרה היסטוריה) — לא מציגים');
ok(T.txRunning([{ side: 'BUY', qty: 5, shadow: true }, { side: 'BUY', qty: 3 }], 3).join(',') === ',3', 'ידנית שלא נספרת — בלי ערך ובלי השפעה');

// --- רינדור בלי DOM לא נופל, בשתי התצוגות ---
T.renderTrades();
T.TX_UI.v = 'yr'; T.renderTrades(); T.TX_UI.v = 'co';
ok(true, 'renderTrades רץ בלי DOM בשתי התצוגות');

// --- התשואה הכוללת על מניה: מאז הקנייה הראשונה, כולל מה שנמכר ---
const R = (side, qty, price, fee, date, extra) => Object.assign({ sym: 'HE', side, qty, price, fee, cur: 'USD', feeCur: 'USD', date }, extra || {});
const sold = [R('SELL', 241, 12.18, 5, '2025-08-22'), R('BUY', 74, 10.07, 5, '2024-09-25'), R('BUY', 152, 9.81, 5, '2024-05-01'), R('BUY', 15, 9.5, 5, '2024-02-01')];
const rs = T.txReturn(sold, 0, null);
const buys = 74 * 10.07 + 152 * 9.81 + 15 * 9.5 + 15, sells = 241 * 12.18 - 5;
ok(rs && Math.abs(rs.pl - (sells - buys)) < 1e-9 && Math.abs(rs.pct - (sells - buys) / buys * 100) < 1e-9 && rs.from === '2024-02-01' && !rs.open, 'נמכרה כולה: תמורה − קניות − עמלות, מאז הקנייה הראשונה');
const part = [R('SELL', 10, 30, 1, '2026-01-01'), R('BUY', 30, 20, 1, '2025-01-01')];
const rp = T.txReturn(part, 20, 25);
ok(rp && Math.abs(rp.pl - (299 + 500 - 601)) < 1e-9 && rp.open, 'חלק נמכר: כולל שווי האחזקה היום במחיר הנוכחי');
ok(T.txReturn(part, 25, 25) === null, 'היסטוריה חסרה (הכמות נטו ≠ האחזקה) — לא מציגים');
ok(T.txReturn(part, 20, null) === null, 'אחזקה בלי מחיר — לא מציגים');
ok(T.txReturn([R('BUY', 1, 10, 0, '2025-01-01'), R('BUY', 1, 10, 0, '2025-02-01', { cur: 'ILS', feeCur: 'ILS' })], 2, 10) === null, 'כמה מטבעות — לא מציגים');
ok(T.txReturn([R('BUY', 5, 10, 0, '2025-01-01'), R('BUY', 5, 10, 0, '2025-02-01', { shadow: true })], 5, 12).pl === 10, 'עסקה ידנית שלא נספרת — מחוץ לחישוב');
ok(/class="tx-g">\+\$100 · \+25\.0%/.test(T.txReturnHTML({ pl: 100, pct: 25, cur: 'USD', from: '2024-01-01' })) &&
  /class="tx-l">−\$50 · −10\.0%/.test(T.txReturnHTML({ pl: -50, pct: -10, cur: 'USD', from: '2024-01-01' })) && T.txReturnHTML(null) === '', 'התצוגה: סימן וצבע לפי רווח/הפסד');
const rd = T.txReturn(part, 20, 25, { USD: 12, ILS: 99 });
ok(rd && Math.abs(rd.pl - (299 + 500 + 12 - 601)) < 1e-9 && rd.div === 12, 'דיבידנדים נטו — רק במטבע העסקאות, בלי המרה');
ok(/כולל דיבידנדים/.test(T.txReturnHTML({ pl: 1, pct: 1, cur: 'USD', from: '2024-01-01', div: 3 })), 'התצוגה: "כולל דיבידנדים" כשיש');
ok(/function txDivs\(\)[\s\S]{0,1400}tiDividends\(cash, null\)[\s\S]{0,300}r\.gross\)[\s\S]{0,40}r\.wh\)/.test(app) && !/function txDivs\(\)[\s\S]{0,1600}(grossIls|whIls)/.test(app), 'דיבידנדים ממנוע המס — בסכום המקורי (דולר), לא בשקלים');
ok(/txReturnHTML\(txReturnOf\(c\.sym, all, held,/.test(app), 'בכרטיס החברה — מכל העסקאות, לא רק מהשנה שנבחרה');

// --- מניה מ־IBKR: החישוב במנוע מרכז המס (tiFifo), רק בשדות הדולריים ---
const fx1 = () => 1;
const ibT = (o) => Object.assign({ symbol: 'HE', currency: 'USD' }, o);
const fA = sandbox.tiFifo([ibT({ date: '2024-01-02', side: 'BUY', qty: 100, price: 10, commission: -1, tradeId: '1' }),
  ibT({ date: '2024-06-02', side: 'SELL', qty: -40, price: 15, commission: -1, tradeId: '2' })], fx1, {});
const ra = T.txReturnFifo(fA, 'HE', 60, 12, { USD: 5 });
// עלות 1001; מכירה: 599 − 400.4 = 198.6; פתוח: 60×12 − 600.6 = 119.4; דיבידנד 5
ok(ra && Math.abs(ra.pl - (198.6 + 119.4 + 5)) < 1e-6 && Math.abs(ra.pct - ra.pl / 1001 * 100) < 1e-9 && ra.from === '2024-01-02', 'מנוע המס: ממומש + לא־ממומש + דיבידנד, אחוז מעלות הקניות');
const fUs = sandbox.tiFifo([ibT({ date: '2024-01-02', side: 'BUY', qty: 10, price: 10, tradeId: '1' }), ibT({ date: '2024-02-02', side: 'SELL', qty: -10, price: 12, tradeId: '2' })], () => 3.7, {});
ok(Math.abs(T.txReturnFifo(fUs, 'HE', 0, null).pl - 20) < 1e-9, 'מנוע המס: בדולרים — שער השקל לא משנה את התוצאה');
const fCa = sandbox.tiFifo([ibT({ date: '2024-01-02', side: 'BUY', qty: 10, price: 10, tradeId: '1' }), ibT({ date: '2024-01-03', side: 'BUY', qty: 10, price: 10, tradeId: '7' }),
  ibT({ date: '2024-01-03', side: 'BUY (Ca.)', qty: 10, price: 10, tradeId: '8', origTradeId: '7' })], fx1, {});
ok(T.txReturnFifo(fCa, 'HE', 10, 11) && Math.abs(T.txReturnFifo(fCa, 'HE', 10, 11).pl - 10) < 1e-9, 'מנוע המס: עסקה שבוטלה לא נספרת');
const fNo = sandbox.tiFifo([ibT({ date: '2024-02-02', side: 'SELL', qty: -10, price: 12, tradeId: '2' })], fx1, {});
ok(T.txReturnFifo(fNo, 'HE', 0, null) === null && T.txReturnFifo(fA, 'HE', 70, 12) === null && T.txReturnFifo(null, 'HE', 0, 1) === null, 'מנוע המס: היסטוריה חסרה / כמות שונה — לא מציגים');
ok(/function txFifo\(\)[\s\S]{0,500}tiFifo\(tr, \(\) => 1,/.test(app) && !/function txReturnFifo[\s\S]{0,1600}(costIls|proceedsIls|gIls|gFx)\b(?![^\n]*\*\/)/.test(app.replace(/\/\*[\s\S]*?\*\//g, '')), 'מנוע המס: בלי שדות שקליים בחישוב');

// --- חיווט וממשק ---
ok(/id="txSeg"[\s\S]{0,400}data-txv="co"[\s\S]{0,200}data-txv="yr"/.test(html) && /id="txYears"/.test(html) && /id="txSearch"/.test(html), 'HTML: בורר חברות/שנים, שנים, חיפוש');
ok(!/tradeFormHost/.test(html) && /id="addManualTradeBtn"/.test(html), 'HTML: עסקה חדשה בגיליון (בלי מארח טופס בעמוד)');
ok(/<ul id="tradeList" class="tx-list/.test(html) && !/id="tab-trades"[\s\S]{0,1500}class="back/.test(html), 'בתוך הלשונית, בלי עמוד נפרד וכפתור חזור');
ok(/function openTradeSheet\(opts\)[\s\S]{0,400}modalPush\(closeTradeSheet\)/.test(app) && /function closeTradeSheet\(\)[\s\S]{0,200}modalDone/.test(app), 'גיליון העריכה: "חזור" סוגר אותו');
ok(/data-mt="' \+ esc\(r\.id\)/.test(app) && /const ed = r\.src === 'manual'/.test(app), 'רק עסקה ידנית נלחצת לעריכה (IBKR לקריאה בלבד)');
ok(/.mt-del[\s\S]{0,200}color: var\(--loss\)/.test(css) && /\.tx-co-list \{[^}]*var\(--gl-card\)/.test(css), 'CSS: זכוכית, מחיקה באדום');
ok(!/\.tx-[\w-]+[^{}]*\{[^}]*(margin|padding)-(left|right)|\.tx-[\w-]+[^{}]*\{[^}]*text-align: (left|right)/.test(css), 'CSS: יישור לוגי בלבד');
for (const k of ['txByCo', 'txByYr', 'txAll', 'txCount', 'txCount1', 'txCos', 'txCos1', 'txShares', 'txSoldOut', 'txBuys', 'txSells', 'txFees', 'txAfter', 'txNewest', 'txOldest', 'txAddFor', 'txReturn', 'txSince', 'txWithDiv', 'txSearchPh', 'txNoMatch', 'mtDelBtn', 'mtTotal', 'txViewAria', 'txYearAria'])
  ok((app.match(new RegExp('\\n  ' + k + ': \'', 'g')) || []).length === 2, 'מחרוזת בעברית ובאנגלית: ' + k);

console.log('\n' + n + ' בדיקות עברו');
