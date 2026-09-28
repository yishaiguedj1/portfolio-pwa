// search-v239.test.js — חיפוש סובלני לטעויות (בקשת המשתמש 28/09/2026: "rddt" ו"בנק הפועלים" לא נמצאו;
// גם שם/סימבול לא מדויק צריך למצוא את המניה). חלק המקומי (מיידי, בלי רשת) — עברית, טעויות, מילים מיותרות.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const retSrc = fs.readFileSync(path.join(root, 'returns.js'), 'utf8');
let n = 0;
function ok(cond, name) { n++; if (!cond) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const sb = {
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  document: { hidden: false, activeElement: null, addEventListener() {}, getElementById: () => null, querySelectorAll: () => [], querySelector: () => null,
    createElement: () => ({ classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {}, style: {} }) },
  window: {}, navigator: {}, location: {}, AbortController, fetch: () => Promise.reject(new Error('no net')),
  setTimeout, clearTimeout, console: { log() {}, warn() {}, error: console.error },
};
vm.createContext(sb);
vm.runInContext(retSrc, sb);
vm.runInContext(src, sb);
const loc = vm.runInContext('localStockSearch', sb);
const top = (q) => (loc(q)[0] || {}).sym;
const cases = {
  'בנק הפועלים': 'POLI.TA', 'הפועלים': 'POLI.TA', 'פועלים': 'POLI.TA', 'הפועליםם': 'POLI.TA', 'בנק לאומי': 'LUMI.TA', 'לאומי': 'LUMI.TA',
  'מזרחי': 'MZTF.TA', 'אלביט': 'ESLT.TA', 'אלביט מערכות': 'ESLT.TA', 'עלביט': 'ESLT.TA', 'טאוור': 'TSEM.TA', 'קבוצת עזריאלי': 'AZRG.TA',
  'אנבידיה': 'NVDA', 'אנוידיה': 'NVDA', 'טסלה': 'TSLA', 'רדיט': 'RDDT', 'ברקשייר': 'BRK-B', 'פייסבוק': 'META', 'גוגל': 'GOOGL', 'קוקה קולה': 'KO',
  'צק פוינט': 'CHKP', 'צ׳ק פוינט': 'CHKP',
  'nvidea': 'NVDA', 'microsft': 'MSFT', 'tesle': 'TSLA', 'aapl': 'AAPL', 'brkb': 'BRK-B', 'brk.b': 'BRK-B', 'hapoalim': 'POLI.TA', 'leumi': 'LUMI.TA', 'elbit': 'ESLT.TA',
};
for (const [q, want] of Object.entries(cases)) ok(top(q) === want, '"' + q + '" → ' + want + ' (קיבלנו ' + top(q) + ')');
ok(vm.runInContext('searchNorm', sb)('צ׳ק־פוינט בע"מ') === 'צק פוינט בעמ', 'נרמול: בלי גרשיים/מקפים, אותיות סופיות');
ok(loc('xq').length === 0 || !loc('xq').some((r) => r.sym === 'NVDA'), 'שאילתה קצרה ולא קשורה — לא מחזירה זבל');
// הרשת: קודם השרתון (/api/search), Yahoo ישירות רק כשהשרתון לא ענה
ok(/const px = heb \? null : await withTimeout\(proxySearchAPI\(q\)/.test(src) && /if \(!heb && !apiOk\) \{/.test(src), 'רשת: השרתון קודם, Yahoo ישירות רק בכשל');
ok(!/id="ibkrStocksNote"/.test(fs.readFileSync(path.join(root, 'index.html'), 'utf8')) && !/ibkrStocksNote/.test(src), 'הטקסט "מניות IBKR מתעדכנות…" הוסר מטאב המניות');
console.log('\n' + n + ' בדיקות עברו');
