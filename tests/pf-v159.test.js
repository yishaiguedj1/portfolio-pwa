// pf-v159.test.js — מניות ת"א: CNBC באגורות מחולק ב־100, רשת ביטחון לציטוט פי 100,
// מחיר מוצג באגורות ("7,830 אג'"), ולוגו רשמי (TradingView) במקום תמונה אקראית.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
function grab(name) {
  const i = src.indexOf('function ' + name + '(');
  let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); }
}
const tl = src.slice(src.indexOf('const TASE_LOGOS ='), src.indexOf('function logoSrc('));
const mk = (lang) => new Function('state', 't', 'normalizeSym', 'num', 'todayISO',
  ['symCur', 'fmtAg', 'parseCNBCQuotes', 'taseFixQuotes'].map(grab).join('\n') + tl + grab('logoSrc') +
  'return { fmtAg, parseCNBCQuotes, taseFixQuotes, logoSrc };')({ lang: lang }, (k) => (k === 'agShort' ? 'אג׳' : k),
  (s) => String(s || '').trim().toUpperCase(), (v) => Number(String(v).replace(/,/g, '')) || 0, () => '2026-09-25');
const he = mk('he'), en = mk('en');

ok(he.fmtAg(78.3) === '⁧7,830 אג׳⁩', 'עברית: "7,830 אג׳" (בבידוד RTL — אג׳ משמאל למספר)');
ok(en.fmtAg(78.3) === '7,830 ag.', 'אנגלית: "7,830 ag."');
ok(he.fmtAg(0.125).includes('12.5'), 'חצי אגורה נשמר');
ok(he.fmtAg(null) === '—', 'בלי מחיר — מקף');

const cn = he.parseCNBCQuotes({ FormattedQuoteResult: { FormattedQuote: [
  { symbol: 'POLI.TA', last: '7,830', open: '7,800', high: '7,900', low: '7,700' },
  { symbol: 'AAPL', last: '201.5' },
] } }, '');
ok(cn['POLI.TA'].close === 78.3 && cn['POLI.TA'].high === 79, 'CNBC: ת"א באגורות → שקלים');
ok(cn.AAPL.close === 201.5, 'CNBC: ארה"ב ללא שינוי');
const cn2 = he.parseCNBCQuotes({ FormattedQuoteResult: { FormattedQuote: [{ symbol: 'X.TA', last: '78.3', currencyCode: 'ILS' }] } }, '');
ok(cn2['X.TA'].close === 78.3, 'CNBC שמסמן ILS — לא מחלקים');

const q = { 'POLI.TA': { close: 7830, open: 7800 }, 'LUMI.TA': { close: 36 }, MSFT: { close: 500 } };
const fixed = he.taseFixQuotes(q, (s) => ({ 'POLI.TA': 77.9, 'LUMI.TA': 35.5, MSFT: 5 }[s]));
ok(fixed === 1 && q['POLI.TA'].close === 78.3 && q['POLI.TA'].open === 78, 'רשת ביטחון: פי 100 מהסגירה הידועה → מחולק');
ok(q['LUMI.TA'].close === 36 && q.MSFT.close === 500, 'מחיר תקין / ארה"ב — לא נוגעים');
ok(he.taseFixQuotes({ 'Z.TA': { close: 7830 } }, () => null) === 0, 'בלי ייחוס — לא מנחשים');

ok(he.logoSrc('POLI.TA') === 'https://s3-symbol-logo.tradingview.com/bank-hapoalim.svg', 'הפועלים: הלוגו הרשמי');
ok(he.logoSrc('TEVA.TA').endsWith('/teva.svg') && he.logoSrc('LUMI.TA').endsWith('/leumi.svg'), 'טבע, לאומי');
ok(he.logoSrc('ABCD.TA') === null, 'ת"א לא מוכרת — בלי תמונה (אות ראשונה)');
ok(he.logoSrc('MSFT').includes('financialmodelingprep.com/image-stock/MSFT.png'), 'ארה"ב — כמו קודם');
const taseSyms = (src.match(/const TASE_STOCKS = \[([\s\S]*?)\]\.map/)[1].match(/'([A-Z0-9]+)\.TA\|/g) || []).map((x) => x.slice(1, -4));
ok(taseSyms.length > 40 && taseSyms.every((s) => he.logoSrc(s + '.TA')), 'לכל מניות ת"א ברשימת החיפוש יש לוגו (' + taseSyms.length + ')');
ok(/img-src[^;]*https:\/\/s3-symbol-logo\.tradingview\.com/.test(html), 'CSP מאשר את מקור הלוגו');
ok(!/image-stock\/' \+ encodeURIComponent\(normalizeSym\(s\.sym\)\)/.test(src), 'מקרא העוגה דרך logoSrc');
ok(/if \(symCur\(sym\) === 'ILS'\) return fmtAg\(v, sym\);/.test(src), 'fmtPx: ת"א באגורות (מדד — בנקודות, v168)');
ok(/function liveMerge\(got\) \{\n  taseFixQuotes/.test(src) && /function applyQuotes\(res\) \{\n  taseFixQuotes/.test(src), 'רשת הביטחון בכל מיזוג ציטוטים');
ok(src.includes("if (/s3-symbol-logo\\.tradingview\\.com/.test(img.src || '')) return;"), 'לוגו רשמי לא עובר היפוך צבעים');
console.log('\n' + n + ' בדיקות עברו');
