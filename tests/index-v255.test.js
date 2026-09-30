// index-v255.test.js — מדדים (SPX, נאסד״ק, ת״א 35) בחיפוש רשימות המעקב בלבד; בתיק — רק קרנות הסל
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
let n = 0;
function ok(cond, name) { n++; if (!cond) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const sb = { localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, document: { addEventListener() {}, getElementById: () => null, querySelectorAll: () => [], querySelector: () => null, createElement: () => ({ classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {}, style: {} }) }, window: {}, navigator: {}, location: { origin: 'https://yishaiguedj1.github.io', pathname: '/portfolio-pwa/' }, AbortController, fetch: () => Promise.reject(new Error('x')), setTimeout, clearTimeout, console, TextEncoder, Image: class { set src(_) {} } };
vm.createContext(sb); vm.runInContext(app, sb);
const R = (c) => vm.runInContext(c, sb);
ok(R("indexSearch('spx')[0].sym") === '^GSPC' && R("indexSearch('S&P')[0].sym") === '^GSPC', 'SPX / S&P → ‎^GSPC');
ok(R("indexSearch('nasdaq').map((x) => x.sym).slice(0, 2).join()") === '^IXIC,^NDX' && R("indexSearch('dow')[0].sym") === '^DJI', 'נאסד״ק, דאו');
ok(R("indexSearch('נאסדק')[0].sym") === '^IXIC' && R("indexSearch('ת\"א 35')[0].sym") === 'TA35.TA' && R("indexSearch('ביטחוניות')[0].sym") === '207.TA', 'עברית: נאסדק, ת"א 35, ביטחוניות');
ok(R("indexSearch('apple').length") === 0 && R("indexSearch('').length") === 0, 'לא מתאים — בלי מדדים');
ok(R("isIndexSym('^GSPC') && isIndexSym('TA35.TA') && isIndexSym('^TA125.TA') && isIndexSym('207.TA') && !isIndexSym('SPY') && !isIndexSym('LUMI.TA')"), 'isIndexSym: מדדי ארה״ב ות״א, לא מניות/קרנות');
R("state.lang = 'he'; state.currency = 'ILS'; state.fx = 3.07;");
ok(R("fmtPx(7671.07, '^GSPC')") === '⁧7,671.07 ' + R("t('ptsShort')") + '⁩' && !/[$₪]/.test(R("fmtPx(7671.07, '^GSPC')")), 'מחיר מדד בנקודות — בלי $/₪ ובלי המרת שער');
ok(/^⁧.*\+71\.07.*⁩$/.test(R("fmtSignedPx(71.07, '^GSPC')")) && R("pxInFactor('TA35.TA')") === 1, 'שינוי בנקודות; ת״א 35 לא באגורות');
ok(R("logoSrc('^GSPC')") === null && /idx-logo/.test(R("stockLogoHTML('^GSPC')")) && R("dispSym('^GSPC')") === 'SPX' && R("dispSym('AAPL')") === 'AAPL', 'בלי לוגו — אייקון גרף; תצוגה SPX');
ok(R("wlValidate('^GSPC').sym") === '^GSPC', 'אפשר להוסיף מדד לרשימת מעקב');
ok(/initStockSearch\('wlSearch', [^\n]*wlAddPicked, \{ indices: true \}\)/.test(app) && /try \{ initStockSearch\(\); \}/.test(app), 'מדדים רק בחיפוש המעקב; בטאב המניות — בלי');
ok(/const idx = opts\.indices \? indexSearch\(q\) : \[\];/.test(app) && /\(opts\.indices \|\| !isWatchOnlySym\(r\.sym\)\)/.test(app), 'תוצאת מדד מהרשת לא מוצגת בתיק');
for (const f of ['ibkr-proxy/api/quotes.js', 'ibkr-proxy/api/history.js', 'ibkr-proxy/lib/widget-model.js']) {
  const re = new RegExp(/const SYM_RE = (\/.*\/);/.exec(fs.readFileSync(path.join(root, f), 'utf8'))[1].slice(1, -1));
  ok(re.test('^GSPC') && re.test('^TA125.TA') && re.test('AAPL') && !re.test('^^X') && !re.test('<X'), f + ': מקבל ‎^GSPC');
}
const M = require('../ibkr-proxy/lib/widget-model');
const chart = { chart: { result: [{ meta: { currency: 'USD', symbol: '^GSPC', regularMarketPrice: 7671.07, previousClose: 7600, regularMarketTime: 1790366401 }, timestamp: [1790366401], indicators: { quote: [{ close: [7671.07] }] } }] } };
const c = M.buildModel(M.parseItems('^GSPC~w~S＆P 500'), { '^GSPC': chart }, {}, { lang: 'he', nowMs: Date.parse('2026-09-26T12:00:00Z') }).cards[0];
ok(c.disp === 'SPX' && /נק׳/.test(c.price) && !/\$/.test(c.price) && c.logo === '' && c.name === 'S＆P 500', 'ווידג׳ט: מדד בנקודות, בלי לוגו, השם עם ＆');
console.log('\n' + n + ' בדיקות עברו');
