// ov-day.test.js — v730: שווי התיק החי בראש הסקירה + השינוי היומי של התיק (דולרים ואחוז).
// בקשת המשתמש (09/11/2026): הכרטיס הציג את השווי מדוח IBKR (סגירת אתמול) — לא תאם לעוגה ול־IBKR.
// נתונים סינתטיים בלבד.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const retSrc = fs.readFileSync(path.join(root, 'returns.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

function ok(cond, name) {
  if (!cond) { console.error('FAIL - ' + name); process.exit(1); }
  console.log('ok - ' + name);
}
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-9);

const sb = {
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  document: {
    hidden: false, activeElement: null, addEventListener() {}, getElementById: () => null,
    querySelectorAll: () => [], querySelector: () => null,
    createElement: () => ({ classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {}, style: {} }),
  },
  window: {}, navigator: {}, location: {},
  AbortController, fetch: () => Promise.reject(new Error('no net')),
  setTimeout, clearTimeout, console: { log() {}, warn() {}, error: console.error },
};
vm.createContext(sb);
vm.runInContext(retSrc, sb);
vm.runInContext(src, sb);
const run = (c) => vm.runInContext(c, sb);
const day = () => run('portfolioDayUSD()');

run(`state.fx = 4; state.currency = "USD"; state.hist = {}; POSITIONS.length = 0; DB.cash = { usd: 1000, ils: 0 };`);
ok(day() === null, 'בלי אחזקות — אין שינוי יומי');

run(`POSITIONS.push({ sym: 'AAA', name: 'A', shares: 10, avg: 50 }, { sym: 'LUMI.TA', name: 'L', shares: 100, avg: 60, src: 'manual' });
  state.quotes = { AAA: { close: 110, prev: 100 }, 'LUMI.TA': { close: 80, prev: 84 } };`);
const d = day();
// AAA: +10×10 = +100$ · LUMI: −4×100 = −400₪ = −100$ → סה"כ 0; שווי עכשיו 1100+2000+1000 = 4100
ok(d && near(d.abs, 0, 1e-6) && near(d.pct, 0, 1e-6), 'שינוי יומי: דולרים + שקלים מומרים, מתקזזים');
run(`state.quotes['LUMI.TA'] = { close: 88, prev: 84 };`);
const d2 = day();
// AAA +100$, LUMI +400₪ = +100$ → +200$; שווי עכשיו 1100 + 2200 + 1000 = 4300; אתמול 4100
ok(d2 && near(d2.abs, 200, 1e-6) && near(d2.pct, 200 / 4100 * 100, 1e-6), 'האחוז מול שווי אתמול כולל מזומן (כמו IBKR)');
run(`state.quotes = { AAA: { close: 110, prev: 100 } };`);
ok(day() === null, 'חסר מחיר לאחזקה אחת — לא מציגים מספר חלקי');
run(`state.quotes = { AAA: { close: 110, prev: 100, regClose: 110, regCh: 9, regPct: 8.9 }, 'LUMI.TA': { close: 88, prev: 84 } };`);
ok(near(day().abs, 90 + 100, 1e-6), 'המספרים הרשמיים של Yahoo (regCh) קובעים, כמו בכרטיס המניה');

// הכרטיס בסקירה: שווי חי גם במצב IBKR, והדוח רק כגיבוי
ok(/const liveAll = POSITIONS\.length && POSITIONS\.every\(/.test(src) && /if \(isIbkrMode\(\) && liveAll\) \{\s*vTxt = money\(total, cur\);/.test(src), 'מצב IBKR: שווי חי כשיש מחיר לכל אחזקה');
ok(/\} else if \(isIbkrMode\(\)\) \{[\s\S]{0,300}ibkrReportTotal\(/.test(src), 'מצב IBKR: השווי מהדוח נשאר כגיבוי');
ok(/<div class="ov-day hidden" id="ovDay"><\/div>\s*<\/div>/.test(html), 'שורת השינוי היומי בתוך כרטיס הנתונים');
ok(/\.ov-day \{ grid-column: 1 \/ -1;/.test(css), 'השורה לרוחב כל הכרטיס');
ok(/ovDayLbl: 'היום'/.test(src) && /ovDayLbl: 'Today'/.test(src), 'מחרוזת בשתי השפות');
ok(/ovStocksValue: 'שווי התיק'/.test(src), 'התווית: "שווי התיק" (כולל מזומן)');
