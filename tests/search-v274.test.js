// search-v274.test.js — חיפוש מקיף: סחורות (ברנט, WTI, זהב), קריפטו, מט"ח, תשואות אג"ח ומדדי עולם ברשימות המעקב;
// כל ניירות ת"א (מניות + קרנות סל) וההשלמות בארה"ב ביקום; עברית → אנגלית לשרתון.
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

// הקטלוג
const cat = R('MARKET_INDICES');
ok(cat.length >= 120 && new Set(cat.map((x) => x[0])).size === cat.length, 'קטלוג: ' + cat.length + ' נכסים, בלי כפילויות');
ok(cat.every((x) => x.length === 5 && x[1] && /[֐-׿]/.test(x[2]) && x[3] && x[4] && x[4].length <= 5), 'לכל נכס: שם, עברית, כינויים, תווית קצרה (≤5)');
ok(cat.every((x) => R('mktKind(' + JSON.stringify(x[0]) + ')')), 'כל נכס בקטלוג מזוהה כנכס מעקב (mktKind)');
ok(R("indexSearch('ברנט')[0].sym") === 'BZ=F' && R("indexSearch('brent')[0].sym") === 'BZ=F' && R("indexSearch('wti')[0].sym") === 'CL=F', 'ברנט / WTI');
ok(R("indexSearch('זהב')[0].sym") === 'GC=F' && R("indexSearch('ביטקוין')[0].sym") === 'BTC-USD' && R("indexSearch('דולר שקל')[0].sym") === 'USDILS=X', 'זהב, ביטקוין, דולר־שקל');
ok(R("indexSearch('ftse')[0].sym") === '^FTSE' && R("indexSearch('ניקיי')[0].sym") === '^N225' && R("indexSearch('ת\"א בנקים')[0].sym") === 'TA-BANKS.TA', 'מדדי עולם ות״א בנקים');
ok(R("indexSearch('אג\"ח 10')[0].sym") === '^TNX', 'תשואת אג״ח 10 שנים');

// סוגים ותצוגה
ok(R("[mktKind('BZ=F'), mktKind('BTC-USD'), mktKind('EURUSD=X'), mktKind('^TNX'), mktKind('^GSPC'), mktKind('TA-BANKS.TA'), mktKind('DX-Y.NYB'), mktKind('AAPL'), mktKind('LUMI.TA'), mktKind('KSM-F52.TA')].join()") === 'future,crypto,fx,yield,index,index,index,,,', 'mktKind: סחורה/קריפטו/מט"ח/אג"ח/מדד; מניה וקרן סל = null');
ok(R("[dispSym('BZ=F'), dispSym('PEPE24478-USD'), dispSym('EURUSD=X'), dispSym('NG=F'), dispSym('^KLSE')].join()") === 'BRENT,PEPE,EUR/USD,NATGAS,KLSE', 'תצוגה: BRENT, PEPE, EUR/USD, בלי ^');
R("state.lang = 'he'; state.currency = 'ILS'; state.fx = 3.07;");
ok(R("fmtPx(97.44, 'BZ=F')") === '$97.44' || /97\.44/.test(R("fmtPx(97.44, 'BZ=F')")), 'סחורה בדולרים');
ok(/3\.0628/.test(R("fmtPx(3.0628, 'USDILS=X')")) && !/[$₪]/.test(R("fmtPx(3.0628, 'USDILS=X')")), 'מט"ח: שער, בלי $/₪ ובלי המרה');
ok(/5\.255%/.test(R("fmtPx(5.255, '^TNX')")) && /\+0\.015%/.test(R("fmtSignedPx(0.015, '^TNX')")), 'תשואת אג״ח באחוזים');
ok(!/e-/.test(R("fmtSignedPx(-0.00000002, 'SHIB-USD')")) && /0\.0000058/.test(R("fmtPx(0.0000058, 'SHIB-USD')")), 'קריפטו זול — בלי כתיב מדעי');
ok(R("logoSrc('BZ=F')") === null && /mk-future/.test(R("stockLogoHTML('BZ=F')")) && /mk-crypto/.test(R("stockLogoHTML('BTC-USD')")) && /mk-fx/.test(R("stockLogoHTML('EURUSD=X')")), 'אייקון לפי סוג');
ok(R("isChartableSym('BZ=F') && isChartableSym('^GSPC') && isChartableSym('DX-Y.NYB') && isChartableSym('AAPL') && !isChartableSym('USD.ILS')"), 'גרף גם לנכסי שוק; לא לצמד IBKR');
ok(R("wlValidate('CL=F').sym") === 'CL=F' && R("wlValidate('PEPE24478-USD').sym") === 'PEPE24478-USD', 'רשימת מעקב מקבלת CL=F ו־PEPE24478-USD');
ok(R("isIndexSym('TA90.TA') && isIndexSym('MIDCAP50.TA') && !isIndexSym('TCH-F27.TA')"), 'מדדי ת״א חדשים; קרן סל אינה מדד');
ok(/\(opts\.indices \|\| !isWatchOnlySym\(r\.sym\)\)/.test(app), 'בתיק — רק מניות וקרנות (נכסי שוק רק במעקב)');

// עברית → אנגלית
ok(R("heToEnQuery('קסם נאסדק 100')") === 'KSM Nasdaq 100' && R("heToEnQuery('הראל ת״א 125')") === 'Harel TA 125', 'תרגום: קסם נאסדק 100, הראל ת״א 125');
ok(R("heToEnQuery('קסם אס אנד פי 500 מנוטרל מטבע')") === 'KSM S&P 500 Currency Hedged' && R("heToEnQuery('לאומי')") === null, 'ביטוי ארוך קודם; בלי תרגום = null');
const ta = R('TASE_STOCKS');
ok(ta.length >= 200 && new Set(ta.map((x) => x[0])).size === ta.length && ta.every((x) => /\.TA$/.test(x[0]) && /[֐-׿]/.test(x[2])), 'מניות ת״א בעברית: ' + ta.length);

// השרתון
const S = require('../ibkr-proxy/lib/search');
const u = S.universe();
const has = (s) => u.some((x) => x.s === s);
ok(['ET', 'MPLX', 'LEN-B', 'PFF', 'VXX', 'PFBC', 'BRK-B', 'SPY', 'TCH-F27.TA', 'KSM-F80.TA', 'LUMI.TA'].every(has), 'יקום: שותפויות, סוגי מניות, ETN, קרנות בכורה, ת״א');
ok(u.filter((x) => /\.TA$/.test(x.s)).length >= 900 && u.filter((x) => /\.TA$/.test(x.s) && x.etf).length >= 400, 'יקום: כל ת״א — מניות וקרנות סל');
ok(S.searchUniverse(u, 'KSM S&P 500', 3)[0].sym === 'KSM-F80.TA' && S.searchUniverse(u, 'Energy Transfer', 1)[0].sym === 'ET', 'KSM S&P 500 → הקרן הרגילה; Energy Transfer → ET');
const srch = fs.readFileSync(path.join(root, 'ibkr-proxy/api/search.js'), 'utf8');
ok(/const mk = !!\(body && body\.mk\);/.test(srch) && /MK_TYPES = \['INDEX', 'FUTURE', 'CRYPTOCURRENCY', 'CURRENCY'\]/.test(srch), 'שרתון: נכסי שוק מ־Yahoo רק עם mk');
for (const f of ['ibkr-proxy/api/quotes.js', 'ibkr-proxy/api/history.js', 'ibkr-proxy/lib/widget-model.js']) {
  const re = new RegExp(/const SYM_RE = (\/.*\/);/.exec(fs.readFileSync(path.join(root, f), 'utf8'))[1].slice(1, -1));
  ok(['BZ=F', 'PEPE24478-USD', 'EURUSD=X', 'DX-Y.NYB', 'KSM-F177.TA'].every((x) => re.test(x)), f + ': מקבל סחורות/קריפטו/מט"ח');
}
const gen = fs.readFileSync(path.join(root, 'tools/stock-universe.js'), 'utf8');
ok(/tvScan\('israel'/.test(gen) && /tvScan\('america'/.test(gen) && /keeping previous TASE rows/.test(gen), 'מחולל: TradingView לארה״ב ות״א, שומר שורות ת״א בכשל');
const M = require('../ibkr-proxy/lib/widget-model');
ok(/3\.0628/.test(M.fmtPrice(3.0628, 'USDILS=X', M.STR.he)) && /5\.255%/.test(M.fmtPrice(5.255, '^TNX', M.STR.he)) && /\$97\.44/.test(M.fmtPrice(97.44, 'BZ=F', M.STR.he)), 'ווידג׳ט: מט"ח/אג"ח/סחורה');
console.log('\n' + n + ' בדיקות עברו');
