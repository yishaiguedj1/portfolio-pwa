// pf-v142.test.js — חיפוש מניות מהיר + מניות ישראליות בשקלים.
// בקשה (25/09/2026): החיפוש לוקח המון זמן; להוסיף מניות ישראליות, בשקלים,
// ושכל המערכת (שווי, רווח, תשואות) תתחשב בזה. נתונים סינתטיים בלבד.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const retSrc = fs.readFileSync(path.join(root, 'returns.js'), 'utf8');

let n = 0;
function ok(cond, name) {
  n++;
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
const A = (k) => vm.runInContext(k, sb);
const run = (c) => vm.runInContext(c, sb);

(async () => {
  // --- 1. מטבע לפי בורסה ---
  ok(A('symCur')('LUMI.TA') === 'ILS' && A('symCur')('GOOG') === 'USD' && A('symCur')('BRK-B') === 'USD', 'symCur: .TA = שקל, אחרת דולר');
  run('state.fx = 4; state.currency = "USD";');
  ok(A('nativeToUSD')(400, 'LUMI.TA') === 100 && A('nativeToUSD')(400, 'GOOG') === 400, 'המרה לדולר רק למניה בשקלים');
  ok(A('nativeToUSD')(400, 'LUMI.TA', 0) === null, 'בלי שער — null, לא ממציאים');
  ok(A('fmtPx')(75.88, 'LUMI.TA') === '₪75.88', 'מחיר מניה ישראלית — בשקלים');
  ok(A('fmtPx')(10, 'GOOG') === '$10.00', 'מחיר מניה אמריקאית — בדולרים');

  // --- 2. אגורות → שקלים ---
  const q = A('parseYahooQuote')({ chart: { result: [{
    meta: { currency: 'ILA', regularMarketPrice: 7588, chartPreviousClose: 7500, gmtoffset: 10800, regularMarketTime: 1790280000 },
    timestamp: [1790280000], indicators: { quote: [{ close: [7588] }] } }] } }, 'LUMI.TA', 1790280000000);
  ok(near(q.close, 75.88) && near(q.prev, 75), 'ציטוט ת"א: 7588 אגורות = ₪75.88 (גם סגירה קודמת)');
  const q2 = A('parseYahooQuote')({ chart: { result: [{
    meta: { currency: 'USD', regularMarketPrice: 100 }, timestamp: [1], indicators: { quote: [{ close: [100] }] } }] } }, 'X', 1000);
  ok(q2.close === 100, 'ציטוט בדולרים לא משתנה');
  const bars = A('parseYahooBars')({ chart: { result: [{
    meta: { currency: 'ILA', gmtoffset: 10800 }, timestamp: [1790200000, 1790280000],
    indicators: { quote: [{ close: [7400, 7588], open: [7300, 7500], high: [7450, 7600], low: [7290, 7480] }] } }] } }, false);
  ok(bars.length === 2 && near(bars[1].close, 75.88) && near(bars[0].open, 73), 'היסטוריה ת"א: כל המחירים בשקלים');

  // --- 3. שווי, רווח, משקל — בדולרים ---
  run(`POSITIONS.length = 0;
    POSITIONS.push({ sym: 'GOOG', name: 'G', shares: 10, avg: 100 }, { sym: 'LUMI.TA', name: 'L', shares: 100, avg: 60, src: 'manual' });
    state.quotes = { GOOG: { close: 150 }, 'LUMI.TA': { close: 80 } }; state.hist = {}; DB.cash = { usd: 0, ils: 0 };`);
  const m = A('metrics')('LUMI.TA');
  ok(m.price === 80 && near(m.value, 100 * 80 / 4) && near(m.gl, 100 * 20 / 4), 'מניה ישראלית: מחיר בשקלים, שווי ורווח בדולרים');
  const tot = A('totalsUSD')();
  ok(near(tot.stockVal, 1500 + 2000), 'שווי התיק: דולרים + שקלים מומרים');
  ok(near(A('costBasisUSD')(), 1000 + 6000 / 4), 'עלות קנייה: שקלים מומרים');
  ok(A('weightTxt')('LUMI.TA') === (2000 / 3500 * 100).toFixed(1) + '%', 'משקל בתיק לפי שווי בדולרים');

  // --- 4. אחזקות ידניות בשקלים ---
  const mt = A('manualTotalsUSD')(
    [{ sym: 'LUMI.TA', shares: 100, avg: 60, src: 'manual' }, { sym: 'TEVA.TA', shares: 10, avg: 0, src: 'manual', fromTrades: true }],
    [{ id: 'a', date: '2026-01-05', sym: 'TEVA.TA', side: 'BUY', qty: 10, price: 100, fee: 4 }],
    { 'LUMI.TA': { close: 80 }, 'TEVA.TA': { close: 120 } }, 4);
  ok(near(mt.value, (8000 + 1200) / 4), 'שווי ידני בשקלים → דולר');
  ok(near(mt.gain, 2000 / 4 + (1200 - 1004) / 4), 'רווח ידני בשקלים → דולר (ממוצע + עסקאות כולל עמלה)');

  // --- 5. TWR משולב עם עסקה בשקלים — שער לפי תאריך ---
  const nav = [{ date: '2026-03-02', total: 1000 }, { date: '2026-03-03', total: 1000 }, { date: '2026-03-04', total: 1000 }];
  const base = nav.map((d) => ({ date: d.date, value: 100 }));
  const hist = { 'TEVA.TA': [{ date: '2026-03-03', close: 40 }, { date: '2026-03-04', close: 44 }] };
  const fxOf = (d) => (d >= '2026-03-04' ? 4 : 4);
  const rows = A('rowsWithManualTwr')(base, nav, {}, [{ id: 'x', date: '2026-03-03', sym: 'TEVA.TA', side: 'BUY', qty: 10, price: 40, fee: 0 }], (s) => hist[s], fxOf);
  ok(rows && near(rows[1].value, 100), 'קנייה בשקלים: לא רווח ביום הקנייה');
  ok(near(rows[2].value, 100 * (1000 + 110) / (1000 + 100)), 'יום אחרי: רווח ב־$ לפי שער היום (440₪/4 = $110)');
  ok(A('rowsWithManualTwr')(base, nav, {}, [{ id: 'x', date: '2026-03-03', sym: 'TEVA.TA', side: 'BUY', qty: 10, price: 40 }], (s) => hist[s], () => null) === null,
    'בלי שער היסטורי — null (לא ממציאים), נשאר רשמי');

  // --- 5ב. חלק IBKR מעוגן לסדרה הרשמית (לא NAV גולמי) ---
  // NAV שטוח אבל הסדרה הרשמית עולה 1% ביום: בלי עסקה ידנית באותו יום — בדיוק הרשמי
  const navF = [{ date: '2026-04-01', total: 1000 }, { date: '2026-04-02', total: 1000 }, { date: '2026-04-03', total: 1000 }, { date: '2026-04-06', total: 1000 }];
  const baseUp = [{ date: '2026-04-01', value: 100 }, { date: '2026-04-02', value: 101 }, { date: '2026-04-03', value: 102.01 }, { date: '2026-04-06', value: 103.0301 }];
  const histF = { FLAT: [{ date: '2026-04-03', close: 10 }, { date: '2026-04-06', close: 10 }] };
  const rA = A('rowsWithManualTwr')(baseUp, navF, {}, [{ id: 'f', date: '2026-04-03', sym: 'FLAT', side: 'BUY', qty: 100, price: 10 }], (x) => histF[x], () => 4);
  ok(near(rA[2].value, 102.01), 'יום הקנייה: חלק IBKR = הרשמי (לא ה־NAV השטוח)');
  ok(near(rA[3].value, 102.01 * ((1000 * 1.01 + 1000) / (1000 + 1000))), 'יום אחרי: ממוצע משוקלל — IBKR +1% (רשמי) ומניה ידנית 0%');

  // --- 5ג. תרחיש המשתמש: מניה ידנית שעלתה פחות מ־IBKR באותה תקופה → המשולב ביניהם ---
  const dN = [], bN = [], hS = [];
  for (let i = 0; i <= 10; i++) {
    const d = '2026-05-' + String(i + 1).padStart(2, '0');
    dN.push({ date: d, total: 1000 * Math.pow(1.02, i) });   // IBKR +2% ביום
    bN.push({ date: d, value: 100 * Math.pow(1.02, i) });
    hS.push({ date: d, close: 10 * Math.pow(1.005, i) });     // מניה ידנית +0.5% ביום
  }
  const rB = A('rowsWithManualTwr')(bN, dN, {}, [{ id: 's', date: '2026-05-02', sym: 'SLOW', side: 'BUY', qty: 100, price: 10 * 1.005 }], () => hS, () => 4);
  const ib = bN[10].value / bN[1].value - 1, man = hS[10].close / hS[1].close - 1, comb = rB[10].value / rB[1].value - 1;
  ok(comb < ib && comb > man, 'מניה ידנית חלשה מ־IBKR באותה תקופה → המשולב נמוך מ־IBKR וגבוה מהמניה (' + (comb * 100).toFixed(1) + '% בין ' + (man * 100).toFixed(1) + '% ל־' + (ib * 100).toFixed(1) + '%)');

  // --- 6. חיפוש מקומי: עברית ות"א ---
  const loc = A('localStockSearch');
  ok(loc('לאומי')[0].sym === 'LUMI.TA', 'עברית: "לאומי" → LUMI.TA');
  ok(loc('טבע').some((r) => r.sym === 'TEVA.TA'), 'עברית: "טבע" → TEVA.TA');
  ok(loc('ל').length >= 1, 'עברית: גם אות אחת מחפשת (מיידי)');
  const teva = loc('TEVA').map((r) => r.sym);
  ok(teva.includes('TEVA') && teva.includes('TEVA.TA'), 'TEVA: גם נאסד"ק וגם ת"א');
  ok(loc('LUMI')[0].sym === 'LUMI.TA', 'סימבול בלי .TA מוצא את ת"א');
  const tase = A('TASE_STOCKS');
  ok(tase.length >= 45 && tase.every((r) => /\.TA$/.test(r[0]) && r[2]) && new Set(tase.map((r) => r[0])).size === tase.length, 'רשימת ת"א: סיומת .TA, שם בעברית, בלי כפילויות');

  // --- 7. מיזוג וסינון ---
  const merged = A('mergeSearchResults')('lumi', [[{ sym: 'BLMIF' }], [{ sym: 'LUMI.TA' }, { sym: 'BLMIF' }]]);
  ok(merged[0].sym === 'LUMI.TA' && merged.length === 2, 'מיזוג: מדויק ראשון, בלי כפילויות');
  const mk = A('searchMarketOk');
  ok(mk('GOOG') && mk('LUMI.TA') && mk('BRK-B') && !mk('GOOG.TO') && !mk('POSB11.SA'), 'רק ארה"ב ות"א (בורסות אחרות — מטבע לא נתמך)');

  // --- 8. חיפוש רשת: במקביל, timeout, מטמון ---
  let apiCalls = 0, directCalls = 0;
  sb.__slowApi = () => { apiCalls++; return new Promise(() => {}); };            // תקוע לגמרי
  sb.__fastDirect = (s) => { directCalls++; return Promise.resolve({ sym: s, name: s + ' Inc', type: 'EQUITY' }); };
  run('yahooSearchAPI = (q) => __slowApi(q); yahooDirectSymbol = (s) => __fastDirect(s);');
  const partials = [];
  const t0 = Date.now();
  const r1 = await A('searchStocksYahoo')('ZZZQ', (p) => partials.push(p.map((x) => x.sym).join(',')));
  const took = Date.now() - t0;
  ok(partials.length >= 1 && partials[0].split(',')[0] === 'ZZZQ', 'תוצאה מוצגת מיד כשמקור מהיר עונה — לא מחכה לתקוע');
  ok(took < 5000 && Array.isArray(r1) && r1[0].sym === 'ZZZQ', 'מקור תקוע לא חוסם — נגמר ב־timeout (' + took + 'ms)');
  sb.__okApi = (q) => { apiCalls++; return Promise.resolve([{ sym: 'ABCD', name: 'Abcd', type: 'EQUITY' }]); };
  run('yahooSearchAPI = (q) => __okApi(q);');
  const before = apiCalls;
  await A('searchStocksYahoo')('ABCD');
  await A('searchStocksYahoo')('abcd');
  ok(apiCalls === before + 1, 'מטמון: אותה שאילתה פעם שנייה — בלי רשת');
  const nb = apiCalls, nd = directCalls;
  const heb = await A('searchStocksYahoo')('הפועלים');
  ok(apiCalls === nb && directCalls === nd && heb[0].sym === 'POLI.TA', 'עברית: בלי בקשת רשת (Yahoo לא מחפש עברית) — מהרשימה');

  // --- 9. הוספה ---
  ok(A('validPosition')('DLEKG.TA', 1, 1, null) === null, 'סימבול ת"א ארוך (DLEKG.TA) תקין');
  ok(/SEARCH_TIMEOUT_MS = 3500/.test(src) && /}, 150\);/.test(src), 'השהיה לפני רשת 150ms (היה 400) ו־timeout לכל מקור');

  const ver = (src.match(/APP_VERSION = '(v\d+)'/) || [])[1];
  ok(fs.readFileSync(path.join(root, 'sw.js'), 'utf8').includes('portfolio-pwa-' + ver), 'CACHE_NAME תואם לגרסה');
  console.log('\n' + n + ' בדיקות עברו');
})().catch((e) => { console.error('נכשל:', e && e.stack || e); process.exit(1); });
