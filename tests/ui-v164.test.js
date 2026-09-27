// ui-v164.test.js — מחירים חיים דרך השרתון בבקשה אחת (Yahoo חסם את הטלפון בגלל ~90 בקשות בדקה);
// התשובה החתוכה מפוענחת בדיוק כמו התשובה המלאה של Yahoo.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const trim = require(path.join(root, 'ibkr-proxy', 'api', 'quotes.js'))._trimChart;
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const sb = { localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, document: { addEventListener() {}, getElementById: () => null, querySelectorAll: () => [], querySelector: () => null, createElement: () => ({ classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {} }) }, window: {}, navigator: {}, location: {}, AbortController, fetch: () => Promise.reject(1), setTimeout, clearTimeout, console };
vm.createContext(sb); vm.runInContext(src, sb);
const parse = vm.runInContext('parseYahooQuote', sb);
// יום מסחר סינתטי: 390 נרות דקה, חורים, טרום/אחרי מסחר, ומניה ישראלית באגורות
function day(cur, base, n0) {
  const start = 1790343000, ts = [], close = [], open = [];
  for (let i = 0; i < n0; i++) { ts.push(start + i * 60); const v = i % 17 === 5 ? null : base * (1 + Math.sin(i / 30) / 50); close.push(v); open.push(base); }
  return { chart: { result: [{ meta: { currency: cur, regularMarketPrice: base * 1.01, chartPreviousClose: base * 0.99, regularMarketTime: start + n0 * 60,
    gmtoffset: -14400, regularMarketDayHigh: base * 1.03, regularMarketDayLow: base * 0.97, regularMarketVolume: 12345,
    currentTradingPeriod: { pre: { start: start - 19800, end: start }, regular: { start: start, end: start + 23400 }, post: { start: start + 23400, end: start + 37800 } } },
    timestamp: ts, indicators: { quote: [{ close: close, open: open, high: open, low: open, volume: open }] } }] } };
}
for (const [cur, base, cnt, now] of [['USD', 250, 390, 1790350000000], ['ILA', 7830, 300, 1790350000000], ['USD', 90, 410, 1790370000000], ['USD', 90, 20, 1790340000000]]) {
  const full = day(cur, base, cnt);
  const a = parse(full, 'X', now), b = parse(trim(full), 'X', now);
  ok(JSON.stringify(a) === JSON.stringify(b), 'אותו ציטוט מתשובה מלאה ומחתוכה (' + cur + ', ' + cnt + ' נרות, סשן ' + (a && a.session) + ')');
}
ok(JSON.stringify(trim(day('USD', 100, 390))).length < 1500, 'תשובה חתוכה: פחות מ־1.5KB למניה (במקום עשרות KB)');
ok(/let out = \{\};\s*try \{ out = await proxyQuotes\(syms\); \}/.test(src), 'liveFetch: קודם השרתון');
ok(/if \(!rest\.length \|\| yahooCooling\(\)\) return out;/.test(src), 'ישירות ל־Yahoo רק אם השרתון לא החזיר, וגם Yahoo לא חוסם');
ok(/if \(direct\) yahooOk\(\); else yahooFailed\(\);/.test(src), 'כשל ישיר מפעיל את ההפסקה');
ok(/const q = await liveFetch\(quoteSymbols\(\)\.concat\(\[FX_SYM\]\)\);/.test(src), 'טעינה ראשונה: אותו מסלול (בקשה אחת, v193: כולל שער הדולר)');
ok(/Date\.now\(\) - \(live\.lastRecover \|\| 0\) > 120000/.test(src), 'גרפים שחסרו מושלמים כשהמחירים חוזרים (לכל היותר פעם בשתי דקות)');
console.log('\n' + n + ' בדיקות עברו');
