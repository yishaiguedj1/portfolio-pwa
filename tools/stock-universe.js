#!/usr/bin/env node
/* v239: מחולל היקום של החיפוש הסובלני (ibkr-proxy/lib/universe.txt) — מידע ציבורי בלבד.
   מניות: Nasdaq screener (כל ארה"ב, עם שווי שוק — לדירוג: "tesle" → TSLA לפני חברה קטנה).
   קרנות סל: nasdaqtrader (ETF=Y), אחרי המניות.
   v274: השלמה מ־TradingView (scanner, מידע ציבורי) — מה שחסר בארה"ב (שותפויות, סוגי מניות LEN.B, ETN כמו VXX, קרנות בכורה כמו PFF)
   וכל ניירות ת"א: מניות + קרנות סל (TCH.F27 → TCH-F27.TA ב־Yahoo; אומת על כל 1,023 הניירות) עם התיאור המלא
   ("KSM ETF (4A) S&P 500") — כך מוצאים קרן סל ישראלית לפי המדד. TradingView לא ענה → נשארות שורות ת"א הקודמות.
   שורה: SYM|שם|E (E = ETF). מתעדכן אוטומטית ב־1 לכל חודש (.github/workflows/stock-universe.yml); ידנית: node tools/stock-universe.js
   (מניות חדשות בינתיים — Yahoo search בשרתון מוצא אותן בסימבול/שם מדויק). */
const fs = require('fs');
const path = require('path');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';

const CLEAN = [/\s+(Common Stock|Ordinary Shares?|Class [A-C] (Common Stock|Ordinary Shares?|Subordinate Voting Shares|Shares))\b.*$/i,
  /\s+American Depositary Shares?\b.*$/i, /\s+Common Units\b.*$/i, /\s+-\s+.*$/, /\s+Common Shares?\b.*$/i, /\s+Depositary Shares?\b.*$/i];
function cleanName(n) {
  let s = String(n || '').replace(/\s+/g, ' ').trim();
  for (const re of CLEAN) s = s.replace(re, '');
  return s.replace(/\|/g, '/').trim();
}

// מניות בכורה, כתבי אופציה, יחידות, זכויות ואג"ח — רעש בחיפוש
// v274: "Common Units" = שותפות (ET, MPLX) — לא יחידת SPAC; בקרן סל "Preferred" = קרן בכורה (PFF) — לא רעש
const JUNK = /\b(Preferred (?:Stock|Shares?|Securities)|Pfd|Warrants?|(?<!Common )Units?|Rights?|Notes due|Debentures|Depositary Shares, each representing)\b/i;
const JUNK_ETF = /\b(Warrants?|Rights?)\b/i;
async function tvScan(market, body) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await fetch('https://scanner.tradingview.com/' + market + '/scan', { method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (j && Array.isArray(j.data) && j.data.length) return j.data;
    } catch (e) { console.error('tradingview ' + market + ' attempt ' + attempt + ': ' + e.message); }
    await new Promise((res) => setTimeout(res, 4000 * attempt));
  }
  return null;
}
// קרנות סל מוכרות — בראש קטע ה־ETF (אין להן שווי שוק בקובץ)
const TOP_ETF = ['SPY', 'VOO', 'IVV', 'QQQ', 'VTI', 'VT', 'SCHD', 'VUG', 'VEA', 'VWO', 'IWM', 'DIA', 'VGT', 'XLK', 'SMH', 'SOXX', 'ARKK',
  'GLD', 'SLV', 'TLT', 'BND', 'AGG', 'QQQM', 'SPLG', 'JEPI', 'JEPQ', 'VYM', 'XLF', 'XLE', 'XLV', 'IBIT', 'EEM', 'EFA', 'VNQ', 'SCHG', 'RSP', 'MGK', 'TQQQ', 'SQQQ', 'SOXL'];

(async () => {
  let rows = [];
  for (let attempt = 1; attempt <= 3 && !rows.length; attempt++) { // ניסיון חוזר — התקלות אצל Nasdaq רגעיות
    try {
      const r = await fetch('https://api.nasdaq.com/api/screener/stocks?tableonly=true&download=true', { headers: { 'User-Agent': UA, Accept: 'application/json', 'Accept-Language': 'en-US,en;q=0.9' } });
      rows = ((await r.json()).data || {}).rows || [];
    } catch (e) { console.error('nasdaq attempt ' + attempt + ': ' + e.message); }
    if (!rows.length && attempt < 3) await new Promise((res) => setTimeout(res, 5000 * attempt));
  }
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
      if (c[iE] !== 'Y' || JUNK_ETF.test(c[iN] || '') || c[iT] === 'Y' || !/^[A-Z][A-Z0-9]{0,6}$/.test(s) || seen.has(s)) continue;
      seen.add(s);
      etfs.push({ s, n: cleanName(c[iN]) });
    }
  }
  // v274: השלמה מ־TradingView — ארה"ב (הבורסות הראשיות בלבד; בלי בכורה/יחידות)
  const tvUs = await tvScan('america', { columns: ['name', 'description', 'type', 'subtype', 'exchange', 'market_cap_basic'],
    filter: [{ left: 'exchange', operation: 'in_range', right: ['NASDAQ', 'NYSE', 'AMEX', 'CBOE'] }], range: [0, 20000] });
  let addUs = 0;
  for (const x of tvUs || []) {
    const [nm, desc, type, sub, , cap] = x.d;
    const sym = String(nm || '').toUpperCase().replace(/[./]/g, '-');
    if (!/^[A-Z][A-Z0-9\-]{0,7}$/.test(sym) || seen.has(sym) || !desc) continue;
    const isStock = (type === 'stock' && sub === 'common') || type === 'dr';
    const isFund = type === 'fund' && (sub === 'etf' || sub === 'closedend');
    if (!isStock && !isFund) continue;
    if (isStock && JUNK.test(desc)) continue;
    seen.add(sym); addUs++;
    if (isStock) stocks.push({ s: sym, n: cleanName(desc), cap: cap || 0 }); else etfs.push({ s: sym, n: cleanName(desc) });
  }
  stocks.sort((a, b) => b.cap - a.cap);
  // v274: ת"א — כל המניות וקרנות הסל
  const file0 = path.join(__dirname, '..', 'ibkr-proxy', 'lib', 'universe.txt');
  const tvIl = await tvScan('israel', { columns: ['name', 'description', 'type', 'subtype', 'market_cap_basic', 'Value.Traded'], range: [0, 5000] });
  let taStocks = [], taFunds = [];
  if (tvIl && tvIl.length > 600) {
    for (const x of tvIl) {
      const [nm, desc, type, , cap, traded] = x.d;
      const sym = String(nm || '').toUpperCase().replace(/\./g, '-') + '.TA';
      if (!/^[A-Z0-9][A-Z0-9\-]{0,11}\.TA$/.test(sym) || !desc) continue;
      if (type === 'stock') taStocks.push({ s: sym, n: cleanName(desc), k: cap || 0 });
      else if (type === 'fund') taFunds.push({ s: sym, n: String(desc).replace(/\|/g, '/').trim(), k: traded || 0 });
    }
    taStocks.sort((a, b) => b.k - a.k); taFunds.sort((a, b) => b.k - a.k);
  } else {
    console.error('tradingview israel failed — keeping previous TASE rows');
    try {
      for (const ln of fs.readFileSync(file0, 'utf8').split('\n')) {
        const c = ln.split('|');
        if (!/\.TA$/.test(c[0] || '')) continue;
        (c[2] === 'E' ? taFunds : taStocks).push({ s: c[0], n: c[1] });
      }
    } catch (e) {}
  }
  etfs.sort((a, b) => { const ia = TOP_ETF.indexOf(a.s), ib = TOP_ETF.indexOf(b.s); return (ia < 0 ? 1e3 : ia) - (ib < 0 ? 1e3 : ib); });
  const out = stocks.map((x) => x.s + '|' + x.n).concat(taStocks.map((x) => x.s + '|' + x.n), etfs.map((x) => x.s + '|' + x.n + '|E'), taFunds.map((x) => x.s + '|' + x.n + '|E'));
  if (stocks.length < 3000) throw new Error('too few stocks: ' + stocks.length);
  const file = path.join(__dirname, '..', 'ibkr-proxy', 'lib', 'universe.txt');
  // הגנה לעדכון האוטומטי: מקור שהחזיר רשימה חלקית (חסימה/תקלה) לא דורס רשימה טובה
  let prevStocks = 0;
  try { prevStocks = fs.readFileSync(file, 'utf8').split('\n').filter((l) => l && !l.endsWith('|E') && !/^[^|]*\.TA\|/.test(l)).length; } catch (e) {}
  if (prevStocks && stocks.length < prevStocks * 0.85) throw new Error('stocks dropped ' + prevStocks + ' → ' + stocks.length + ' — not overwriting');
  fs.writeFileSync(file, out.join('\n') + '\n');
  console.log('stocks', stocks.length, 'etfs', etfs.length, 'tv-us added', addUs, 'tase', taStocks.length, '+', taFunds.length, 'bytes', fs.statSync(file).size, '→', file);
})().catch((e) => { console.error(e); process.exit(1); });
