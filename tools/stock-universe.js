#!/usr/bin/env node
/* v239: מחולל היקום של החיפוש הסובלני (ibkr-proxy/lib/universe.txt) — מידע ציבורי בלבד.
   מניות: Nasdaq screener (כל ארה"ב, עם שווי שוק — לדירוג: "tesle" → TSLA לפני חברה קטנה).
   קרנות סל: nasdaqtrader (ETF=Y), אחרי המניות.
   שורה: SYM|שם|E (E = ETF). להריץ מדי כמה חודשים: node tools/stock-universe.js
   (מניות חדשות בינתיים — Yahoo search בשרתון מוצא אותן בסימבול/שם מדויק). */
const fs = require('fs');
const path = require('path');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';

const CLEAN = [/\s+(Common Stock|Ordinary Shares?|Class [A-C] (Common Stock|Ordinary Shares?|Subordinate Voting Shares|Shares))\b.*$/i,
  /\s+American Depositary Shares?\b.*$/i, /\s+-\s+.*$/, /\s+Common Shares?\b.*$/i, /\s+Depositary Shares?\b.*$/i];
function cleanName(n) {
  let s = String(n || '').replace(/\s+/g, ' ').trim();
  for (const re of CLEAN) s = s.replace(re, '');
  return s.replace(/\|/g, '/').trim();
}

// מניות בכורה, כתבי אופציה, יחידות, זכויות ואג"ח — רעש בחיפוש
const JUNK = /\b(Preferred|Warrants?|Units?|Rights?|Notes due|Debentures|Depositary Shares, each representing)\b/i;
// קרנות סל מוכרות — בראש קטע ה־ETF (אין להן שווי שוק בקובץ)
const TOP_ETF = ['SPY', 'VOO', 'IVV', 'QQQ', 'VTI', 'VT', 'SCHD', 'VUG', 'VEA', 'VWO', 'IWM', 'DIA', 'VGT', 'XLK', 'SMH', 'SOXX', 'ARKK',
  'GLD', 'SLV', 'TLT', 'BND', 'AGG', 'QQQM', 'SPLG', 'JEPI', 'JEPQ', 'VYM', 'XLF', 'XLE', 'XLV', 'IBIT', 'EEM', 'EFA', 'VNQ', 'SCHG', 'RSP', 'MGK', 'TQQQ', 'SQQQ', 'SOXL'];

(async () => {
  const r = await fetch('https://api.nasdaq.com/api/screener/stocks?tableonly=true&download=true', { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  const rows = ((await r.json()).data || {}).rows || [];
  const stocks = rows
    .map((x) => ({ s: String(x.symbol || '').trim().toUpperCase().replace('/', '-').replace('^', '-P'), n: cleanName(x.name), cap: parseFloat(x.marketCap) || 0 }))
    .filter((x) => /^[A-Z][A-Z0-9\-]{0,7}$/.test(x.s) && !/-P[A-Z]?$/.test(x.s) && x.n && !JUNK.test(x.n)) // -PA = מניית בכורה
    .sort((a, b) => b.cap - a.cap);
  const seen = new Set(stocks.map((x) => x.s));
  const etfs = [];
  for (const [url, symCol] of [['https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt', 'ACT Symbol'], ['https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt', 'Symbol']]) {
    const lines = (await (await fetch(url, { headers: { 'User-Agent': UA } })).text()).split('\n');
    const h = lines[0].split('|');
    const iS = h.indexOf(symCol), iN = h.indexOf('Security Name'), iE = h.indexOf('ETF'), iT = h.indexOf('Test Issue');
    for (const ln of lines.slice(1)) {
      const c = ln.split('|');
      const s = String(c[iS] || '').trim().toUpperCase();
      if (c[iE] !== 'Y' || JUNK.test(c[iN] || '') || c[iT] === 'Y' || !/^[A-Z][A-Z0-9]{0,6}$/.test(s) || seen.has(s)) continue;
      seen.add(s);
      etfs.push({ s, n: cleanName(c[iN]) });
    }
  }
  etfs.sort((a, b) => { const ia = TOP_ETF.indexOf(a.s), ib = TOP_ETF.indexOf(b.s); return (ia < 0 ? 1e3 : ia) - (ib < 0 ? 1e3 : ib); });
  const out = stocks.map((x) => x.s + '|' + x.n).concat(etfs.map((x) => x.s + '|' + x.n + '|E'));
  if (stocks.length < 3000) throw new Error('too few stocks: ' + stocks.length);
  const file = path.join(__dirname, '..', 'ibkr-proxy', 'lib', 'universe.txt');
  fs.writeFileSync(file, out.join('\n') + '\n');
  console.log('stocks', stocks.length, 'etfs', etfs.length, 'bytes', fs.statSync(file).size, '→', file);
})().catch((e) => { console.error(e); process.exit(1); });
