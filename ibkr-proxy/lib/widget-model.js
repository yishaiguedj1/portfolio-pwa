/* מודל הווידג'ט (v211): מציטוטי Yahoo (מבנה /api/quotes: chart חתוך + x מ־v7) → טקסטים מוכנים לכרטיס ולכותרת.
   טהור (בלי רשת) — נבדק ב־tests/widget.test.js. אותה לוגיקה כמו באפליקציה (v209/v210): השינוי היומי = המספרים
   הרשמיים של המסחר הרגיל (regularMarketChange/Percent, או regularMarketPrice מול previousClose), אחרי־מסחר בנפרד;
   ת״א באגורות, מדד ת״א בנקודות; "השוק סגור · סיבה" מלוח NYSE / הלוח העברי (lib/market.js).
   מידע שוק ציבורי בלבד — הקישור מכיל סימבולים ותגית מקור, בלי כמויות/שווי. */
'use strict';
const market = require('./market');

const STR = {
  he: {
    open: 'המסחר פתוח', pre: 'מסחר־מוקדם', post: 'מסחר־מאוחר', night: 'מסחר־לילי', closed: 'השוק סגור', closedDot: 'השוק סגור ·',
    cardPost: 'מסחר־מאוחר', cardPre: 'מסחר־מוקדם', cardNight: 'מסחר־לילי', taClosed: 'סגור', updated: 'עודכן',
    tinyPost: 'מסחר־מאוחר', tinyPre: 'מסחר־מוקדם', tinyNight: 'מסחר־לילי', lastClose: 'סגירה',
    ag: 'אג׳', pts: 'נק׳', manual: 'ידני', watch: 'מעקב',
    hdWeekend: 'סופ״ש', hdNewYear: '1 בינואר', hdMlk: 'יום MLK', hdPresidents: 'יום הנשיאים', hdGoodFriday: 'שישי הטוב',
    hdMemorial: 'יום הזיכרון', hdJuneteenth: 'ג׳ונטינת׳', hdIndependence: '4 ביולי', hdLabor: 'יום העבודה',
    hdThanksgiving: 'חג ההודיה', hdChristmas: 'חג המולד',
    hdTaErevRH: 'ערב ראש השנה', hdTaRH: 'ראש השנה', hdTaErevYK: 'ערב יום כיפור', hdTaYK: 'יום כיפור',
    hdTaErevSukkot: 'ערב סוכות', hdTaSukkot: 'סוכות', hdTaErevSimchat: 'הושענא רבה', hdTaSimchat: 'שמחת תורה',
    hdTaPurim: 'פורים', hdTaErevPesach: 'ערב פסח', hdTaPesach: 'פסח', hdTaIndependence: 'יום העצמאות',
    hdTaErevShavuot: 'ערב שבועות', hdTaShavuot: 'שבועות', hdTaTishaBav: 'ט׳ באב',
  },
  en: {
    open: 'Market open', pre: 'Pre-market', post: 'After hours', night: 'Overnight', closed: 'Closed', closedDot: 'Closed ·',
    cardPost: 'After hours', cardPre: 'Pre-market', cardNight: 'Overnight', taClosed: 'Closed', updated: 'Updated',
    tinyPost: 'Post', tinyPre: 'Pre', tinyNight: 'Night', lastClose: 'Close',
    ag: 'ag.', pts: 'pts', manual: 'Manual', watch: 'Watch',
    hdWeekend: 'Weekend', hdNewYear: 'New Year', hdMlk: 'MLK Day', hdPresidents: 'Presidents', hdGoodFriday: 'Good Friday',
    hdMemorial: 'Memorial', hdJuneteenth: 'Juneteenth', hdIndependence: 'July 4th', hdLabor: 'Labor Day',
    hdThanksgiving: 'Thanksgiving', hdChristmas: 'Christmas',
    hdTaErevRH: 'Erev Rosh Hashanah', hdTaRH: 'Rosh Hashanah', hdTaErevYK: 'Erev Yom Kippur', hdTaYK: 'Yom Kippur',
    hdTaErevSukkot: 'Erev Sukkot', hdTaSukkot: 'Sukkot', hdTaErevSimchat: 'Hoshana Rabbah', hdTaSimchat: 'Simchat Torah',
    hdTaPurim: 'Purim', hdTaErevPesach: 'Erev Passover', hdTaPesach: 'Passover', hdTaIndependence: 'Independence Day',
    hdTaErevShavuot: 'Erev Shavuot', hdTaShavuot: 'Shavuot', hdTaTishaBav: "Tisha B'Av",
  },
};
const FX_SYM = 'USDILS=X';
const STATE_SESSION = { PRE: 'pre', PREPRE: 'closed', POST: 'post', POSTPOST: 'closed', OVERNIGHT: 'night', CLOSED: 'closed', REGULAR: 'regular' };
const SYM_RE = /^\^?[A-Z0-9][A-Z0-9.\-=^]{0,15}$/; // v255: ^ בהתחלה = מדד (^GSPC); v274: עד 16 תווים (PEPE24478-USD)
const MINUS = '−';
const LRI = '⁦', RLI = '⁧', PDI = '⁩';

const isTA = (s) => /\.TA$/i.test(s);
const isTaseIndex = (s) => /^(\d{1,4}|\^?TA\d{2,3}|TA-[A-Z]{2,8}|MIDCAP50|TELDIV20|ESTATE15|TASEBM|TEL-TECH)\.TA$/i.test(s); // = app.js
const IDX_EXTRA = new Set(['000001.SS', 'FTSEMIB.MI', 'DX-Y.NYB']);
const YIELDS = new Set(['^TNX', '^TYX', '^FVX', '^IRX']);
const isIndex = (s) => (/^\^/.test(s) || isTaseIndex(s) || IDX_EXTRA.has(s)) && !YIELDS.has(s); // v255: מדד (מעקב) — נקודות, בלי לוגו
// v274: שאר הנכסים של רשימות המעקב (כמו mktKind באפליקציה): תשואת אג"ח, מט"ח, סחורה, קריפטו
const mkKind = (s) => (YIELDS.has(s) ? 'yield' : /=F$/.test(s) ? 'future' : /^[A-Z]{6}=X$/.test(s) ? 'fx' : /^[A-Z0-9]{1,15}-USD$/.test(s) ? 'crypto' : isIndex(s) ? 'index' : null);
// v278: אותו סימבול תצוגה כמו באפליקציה (dispSym ← MARKET_INDICES): BZ=F → BRENT, ^GSPC → SPX. tests/widget.test.js משווה לאפליקציה
const MKT_DISP = { '^GSPC': 'SPX', '^IXIC': 'COMP', 'DX-Y.NYB': 'DXY', '^GDAXI': 'DAX', '^FCHI': 'CAC', '^STOXX50E': 'STOXX50', '^STOXX': 'STOXX600', 'FTSEMIB.MI': 'FTSEMIB', '^SSMI': 'SMI', '^N225': 'NIKKEI', '000001.SS': 'SSE', '^KS11': 'KOSPI', '^TWII': 'TAIEX', '^BSESN': 'SENSEX', '^NSEI': 'NIFTY', '^AXJO': 'ASX', '^GSPTSE': 'TSX', '^BVSP': 'BOVESPA', '^MXX': 'IPC', 'TA-BANKS.TA': 'TABANKS', 'TA-FIN.TA': 'TAFIN', 'TA-INS.TA': 'TAINS', 'MIDCAP50.TA': 'SME60', 'TEL-TECH.TA': 'TELTECH', 'TELDIV20.TA': 'TELDIV', '200.TA': 'ARISTOCRATS', '184.TA': 'CLEANTECH', '55.TA': 'CONSTRUCTION', '207.TA': '207.TA', 'CL=F': 'WTI', 'BZ=F': 'BRENT', 'NG=F': 'NATGAS', 'RB=F': 'GASOLINE', 'HO=F': 'HO', 'GC=F': 'GOLD', 'SI=F': 'SILVER', 'PL=F': 'PLATINUM', 'PA=F': 'PA', 'HG=F': 'COPPER', 'ALI=F': 'ALUMINUM', 'ZC=F': 'CORN', 'ZW=F': 'WHEAT', 'ZS=F': 'SOYBEANS', 'KC=F': 'COFFEE', 'SB=F': 'SUGAR', 'CC=F': 'COCOA', 'CT=F': 'COTTON', 'OJ=F': 'OJ', 'LE=F': 'CATTLE', 'HE=F': 'HOGS', 'ES=F': 'ES', 'NQ=F': 'NQ', 'YM=F': 'YM', 'RTY=F': 'RTY', 'ZN=F': 'ZN', 'ZB=F': 'ZB', 'BTC-USD': 'BTC', 'ETH-USD': 'ETH', 'SOL-USD': 'SOL', 'XRP-USD': 'XRP', 'BNB-USD': 'BNB', 'DOGE-USD': 'DOGE', 'ADA-USD': 'ADA', 'TRX-USD': 'TRX', 'AVAX-USD': 'AVAX', 'LINK-USD': 'LINK', 'DOT-USD': 'DOT', 'LTC-USD': 'LTC', 'BCH-USD': 'BCH', 'SHIB-USD': 'SHIB', 'XLM-USD': 'XLM', 'TON11419-USD': 'TON', 'SUI20947-USD': 'SUI', 'HBAR-USD': 'HBAR', 'NEAR-USD': 'NEAR', 'UNI7083-USD': 'UNI', 'PEPE24478-USD': 'PEPE', 'XMR-USD': 'XMR', 'ETC-USD': 'ETC', 'ATOM-USD': 'ATOM', 'AAVE-USD': 'AAVE', 'FIL-USD': 'FIL', 'ICP-USD': 'ICP', 'APT21794-USD': 'APT', 'ARB11841-USD': 'ARB', 'USDT-USD': 'USDT', 'USDC-USD': 'USDC', 'USDILS=X': 'USD/ILS', 'EURILS=X': 'EUR/ILS', 'GBPILS=X': 'GBP/ILS', 'EURUSD=X': 'EUR/USD', 'GBPUSD=X': 'GBP/USD', 'USDJPY=X': 'USD/JPY', 'USDCHF=X': 'USD/CHF', 'AUDUSD=X': 'AUD/USD', 'USDCAD=X': 'USD/CAD', 'USDCNY=X': 'USD/CNY' };
function dispOf(sym) {
  if (MKT_DISP[sym]) return MKT_DISP[sym];
  const k = mkKind(sym);
  if (k === 'crypto') return sym.replace(/\d*-USD$/, '');
  if (k === 'future') return sym.replace(/=F$/, '');
  if (k === 'fx') return sym.slice(0, 3) + '/' + sym.slice(3, 6);
  return sym.replace(/^\^/, '').replace(/\.TA$/i, '');
}
const num = (v) => (typeof v === 'number' && isFinite(v) ? v : null);

/* פרמטר s של הקישור: "AAPL~i~Apple,LUMI.TA~m~לאומי~leumi,TSLA~w~Tesla" — סימבול~מקור(i/m/w)~שם~מזהה לוגו (ת״א) */
function parseItems(s, max) {
  const out = [];
  for (const part of String(s || '').split(',')) {
    const f = part.split('~');
    const sym = String(f[0] || '').trim().toUpperCase();
    if (!SYM_RE.test(sym) || out.some((x) => x.sym === sym)) continue;
    const src = f[1] === 'i' ? 'ibkr' : f[1] === 'w' ? 'watch' : 'manual';
    const name = String(f[2] || '').replace(/[<>&"]/g, '').trim().slice(0, 40);
    const logo = /^[a-z0-9-]{1,60}$/.test(f[3] || '') ? f[3] : '';
    out.push({ sym, src, name, logo });
    if (out.length >= (max || 12)) break;
  }
  return out;
}

/* ציטוט אחד (מבנה /api/quotes) → { price, regClose, regCh, regPct, ext, session, name }. ת״א באגורות → שקלים. */
function parseQuote(entry, nowMs) {
  const res = entry && entry.chart && entry.chart.result && entry.chart.result[0];
  if (!res) return null;
  const meta = res.meta || {};
  const k = String(meta.currency || '').toUpperCase() === 'ILA' ? 0.01 : 1;
  const ts = res.timestamp || [];
  const cl = (res.indicators && res.indicators.quote && res.indicators.quote[0] && res.indicators.quote[0].close) || [];
  let li = Math.min(ts.length, cl.length) - 1;
  while (li >= 0 && !(cl[li] > 0)) li--;
  const reg = num(meta.regularMarketPrice) ? meta.regularMarketPrice * k : null;
  const price = li >= 0 ? cl[li] * k : reg;
  if (!(price > 0)) return null;
  const pc = (num(meta.previousClose) || num(meta.chartPreviousClose) || 0) * k;
  const q = { price, regClose: reg, regCh: null, regPct: null, ext: null, session: '', name: meta.longName || meta.shortName || '' };
  if (reg > 0 && pc > 0) { q.regCh = reg - pc; q.regPct = (reg - pc) / pc * 100; }
  // חלון המסחר לפי Yahoo (נר מורחב אחרי הסגירה הרגילה = אחרי־מסחר / טרום־מסחר)
  const nowS = (nowMs || Date.now()) / 1000;
  const ctp = meta.currentTradingPeriod || {};
  const inP = (p) => p && nowS >= p.start && nowS < p.end;
  q.session = inP(ctp.pre) ? 'pre' : inP(ctp.post) ? 'post' : inP(ctp.regular) ? 'regular' : 'closed';
  const lastTs = li >= 0 ? ts[li] : 0;
  if (reg > 0 && !inP(ctp.regular) && lastTs > (num(meta.regularMarketTime) || 0) + 60 && Math.abs(price - reg) > 1e-9) {
    q.ext = { kind: q.session === 'pre' ? 'pre' : 'post', pct: (price - reg) / reg * 100 };
  }
  // v7 (כשיש): marketState + המספרים הרשמיים
  const x = entry.x;
  if (x) {
    const sess = STATE_SESSION[String(x.state || '').toUpperCase()];
    if (sess) q.session = sess;
    if (x.reg && x.reg.p > 0) { q.regClose = x.reg.p; if (num(x.reg.ch) !== null) q.regCh = x.reg.ch; if (num(x.reg.pct) !== null) q.regPct = x.reg.pct; }
    const pick = sess === 'night' ? (x.night || x.post) : sess === 'post' ? x.post : sess === 'pre' ? x.pre : sess === 'closed' ? x.post : null;
    const kind = sess === 'night' ? (x.night ? 'night' : 'post') : sess === 'pre' ? 'pre' : 'post';
    if (pick && pick.p > 0) q.ext = { kind, pct: num(pick.pct) || 0 };
    if (kind === 'night' && pick && pick.p > 0) q.price = pick.p; // v226: אין נרות לילה בגרף — המחיר הראשי = הלילי (כמו באפליקציה)
    else if (sess === 'regular') q.ext = null;
  }
  if (isTA(meta.symbol || '')) q.ext = null; // אין מסחר מורחב בת״א
  return q;
}

/* השינוי היומי: הרשמי; 0 (Yahoo בחג/סופ״ש מחזיר סגירה קודמת = המחיר) → מהסגירות היומיות (v167) */
function dayChange(q, daily) {
  if (q.regCh !== null && q.regCh !== 0 && num(q.regPct) !== null) return { ch: q.regCh, pct: q.regPct };
  if (daily && daily.length >= 2) {
    const a = daily[daily.length - 2], b = daily[daily.length - 1];
    if (a > 0 && b > 0) return { ch: b - a, pct: (b - a) / a * 100 };
  }
  return { ch: q.regCh || 0, pct: q.regPct || 0 };
}

const fmt2 = (v) => Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const sign = (v, eps) => (v > (eps || 0) ? '+' : v < -(eps || 0) ? MINUS : '');
function fmtPct(v) { const r = Math.round(v * 100) / 100; return LRI + sign(r, 0.004) + fmt2(r) + '%' + PDI; }
function fmtPrice(v, sym, L) {
  const k = mkKind(sym);
  if (k === 'yield') return LRI + v.toFixed(3) + '%' + PDI;
  if (k === 'fx') return LRI + v.toFixed(Math.abs(v) >= 20 ? 2 : 4) + PDI;
  if (k === 'crypto' && v > 0 && v < 1) return LRI + '$' + v.toPrecision(4) + PDI;
  if (isIndex(sym)) return isHe(L) ? RLI + fmt2(v) + ' ' + L.pts + PDI : fmt2(v) + ' ' + L.pts;
  if (isTA(sym)) { const n = Math.round(v * 100).toLocaleString('en-US'); return isHe(L) ? RLI + n + ' ' + L.ag + PDI : n + ' ' + L.ag; }
  return LRI + '$' + fmt2(v) + PDI;
}
function fmtChg(ch, sym, L) {
  // בצ׳יפ (LTR): "−101 אג׳ (−1.31%)" — המספר ואחריו היחידה, כמו "‎−$1.19"
  const k = mkKind(sym);
  if (k === 'yield' || k === 'fx') return LRI + sign(ch, 0) + Math.abs(ch).toFixed(k === 'yield' ? 3 : Math.abs(ch) >= 1 ? 2 : 4) + (k === 'yield' ? '%' : '') + PDI;
  if (isIndex(sym)) { const r = Math.round(ch * 100) / 100; return LRI + sign(r, 0.004) + fmt2(r) + ' ' + L.pts + PDI; }
  if (isTA(sym)) { const a = Math.round(ch * 10000) / 100; const n = Math.abs(a).toLocaleString('en-US', { maximumFractionDigits: 2 }); return LRI + sign(a, 0.004) + n + ' ' + L.ag + PDI; }
  const r = Math.round(ch * 100) / 100;
  return LRI + sign(r, 0.004) + '$' + fmt2(r) + PDI;
}
const isHe = (L) => L === STR.he;
const dirOf = (v) => (Math.abs(v) < 0.005 ? 'flat' : v > 0 ? 'pos' : 'neg');

// v241: לוגו שגוי אצל FMP → עותק תקין באתר (כמו LOGO_OVERRIDES באפליקציה)
const SITE = 'https://yishaiguedj1.github.io/portfolio-pwa/';
const LOGO_OVERRIDES = { KHC: SITE + 'logos/KHC.png' };
let TA_PNG = new Set();
try { TA_PNG = new Set(require('./ta-logos.json')); } catch (e) {}
function logoUrl(it) {
  if (LOGO_OVERRIDES[it.sym]) return LOGO_OVERRIDES[it.sym];
  if (mkKind(it.sym)) return ''; // v274: גם סחורה/קריפטו/מט"ח — בלי לוגו
  // v242: לוגו ת״א = PNG מוכן באתר (logos/ta/) — ה־SVG של TradingView (18×18 בלי viewBox) יצא בווידג׳ט זעיר וחתוך בפינה.
  // לוגו שעוד לא הומר (מניה חדשה) — ה־SVG כמו קודם.
  if (isTA(it.sym)) return !it.logo ? '' : TA_PNG.has(it.logo) ? SITE + 'logos/ta/' + it.logo + '.png' : 'https://s3-symbol-logo.tradingview.com/' + it.logo + '.svg';
  return 'https://financialmodelingprep.com/image-stock/' + encodeURIComponent(it.sym) + '.png';
}

/* כותרת: מצב השוק האמריקאי (לפי הסימבול האמריקאי הראשון); בלי אמריקאיות — הבורסה בת״א */
function headerOf(cards, nowMs, L) {
  const us = cards.find((c) => c.q && !isTA(c.sym));
  if (us) {
    const s = us.q.session;
    if (s === 'regular') return { lines: [L.open], live: true };
    if (s === 'pre' || s === 'post' || s === 'night') return { lines: [L[s]], live: false };
    const why = market.marketClosedReason(nowMs);
    return why && L[why] ? { lines: [L.closedDot, L[why]], live: false } : { lines: [L.closed], live: false };
  }
  const t = market.taseMarketNow(nowMs);
  if (!t.closed) return { lines: [L.open], live: true };
  return t.reason && L[t.reason] ? { lines: [L.closedDot, L[t.reason]], live: false } : { lines: [L.closed], live: false };
}

/* הכותרת בשורה אחת כשקצרה (סופ״ש), בשתי שורות בחג — כך לא נוגעת בלוגו בשום רוחב (נמדד על כל החגים) */
function headerTwoLine(h, lang) {
  const text = h.lines.join('');
  return h.lines.length > 1 && text.length > (lang === 'en' ? 12 : 16);
}

function timeIL(nowMs) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(nowMs || Date.now()));
}

/* בועת הסשן של הכרטיס — אחד לאחד כמו extSessionHTML / taseSessionHTML באפליקציה (v199–v206):
   ארה״ב, שוק סגור: שתי שורות — "השוק סגור · סיבה" (לוח NYSE) ומתחת הסשן המורחב האחרון (קצר) + האחוז שלו;
   טרום/אחרי/לילי: שורה אחת — נקודה חיה + הסשן + האחוז; מסחר רגיל: בלי בועה.
   ת״א: סגור → "השוק סגור · סיבה" (הלוח העברי) ומתחת "סגירה" + השינוי היומי; פתוח → בלי בועה (אין מסחר מורחב). */
function bubbleOf(it, q, d, nowMs, L, taStat) {
  const closedL1 = (key) => (key && L[key] ? L.closedDot + ' ' + L[key] : L.closed);
  if (isTA(it.sym)) {
    if (!taStat.closed) return null;
    const pct = d && num(d.pct) !== null ? d.pct : null;
    return { closed: true, l1: closedL1(taStat.reason), l2: pct === null ? '' : L.lastClose, pct: pct === null ? '' : fmtPct(pct), dir: pct === null ? 'flat' : dirOf(pct) };
  }
  if (!q.ext) return null;
  const pct = Number(q.ext.pct) || 0;
  if (q.session === 'closed') {
    const tiny = q.ext.kind === 'pre' ? L.tinyPre : q.ext.kind === 'night' ? L.tinyNight : L.tinyPost;
    return { closed: true, l1: closedL1(market.marketClosedReason(nowMs)), l2: tiny, pct: fmtPct(pct), dir: dirOf(pct) };
  }
  if (q.session === 'regular') return null;
  const lbl = q.ext.kind === 'pre' ? L.cardPre : q.ext.kind === 'night' ? L.cardNight : L.cardPost;
  return { closed: false, l1: lbl, l2: '', pct: fmtPct(pct), dir: dirOf(pct) };
}

/* items + quotes ({SYM: entry}) + daily ({SYM: [closes]}) → מודל התצוגה */
/* v228: שוק המט״ח פתוח (שעון ניו־יורק): ראשון 17:00 → שישי 17:00 — עותק של fxMarketOpen באפליקציה */
function fxMarketOpen(nowMs) {
  try {
    const g = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(new Date(nowMs || Date.now()));
    const pick = (t) => (g.find((p) => p.type === t) || {}).value;
    const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(pick('weekday'));
    const mins = (+pick('hour') % 24) * 60 + (+pick('minute'));
    if (dow === 6) return false;
    if (dow === 0) return mins >= 17 * 60;
    if (dow === 5) return mins < 17 * 60;
    return true;
  } catch (e) { return true; }
}
/* v228: בועת שער הדולר בכותרת הווידג'ט — כמו בועת ההדר באפליקציה: "₪3.06" (שתי ספרות), נקודה ירוקה/אדומה
   לפי הכיוון מול הסגירה הקודמת כשהשוק פתוח, אפורה כשסגור. entry = ציטוט USDILS=X במבנה /api/quotes */
function fxOf(entry, nowMs) {
  const res = entry && entry.chart && entry.chart.result && entry.chart.result[0];
  if (!res) return null;
  const meta = res.meta || {};
  const cl = (res.indicators && res.indicators.quote && res.indicators.quote[0] && res.indicators.quote[0].close) || [];
  let li = cl.length - 1;
  while (li >= 0 && !(cl[li] > 0)) li--;
  const v = li >= 0 ? cl[li] : num(meta.regularMarketPrice);
  if (!(v > 0)) return null;
  const prev = num(meta.previousClose) || num(meta.chartPreviousClose);
  const open = fxMarketOpen(nowMs);
  return { v: v.toFixed(2), dir: !open || !(prev > 0) ? 'flat' : v >= prev ? 'pos' : 'neg', open };
}

function buildModel(items, quotes, daily, opts) {
  const lang = opts && opts.lang === 'en' ? 'en' : 'he';
  const L = STR[lang];
  const nowMs = (opts && opts.nowMs) || Date.now();
  const taStat = market.taseMarketNow(nowMs);
  const cards = items.map((it) => {
    const q = parseQuote(quotes[it.sym], nowMs);
    const c = { sym: it.sym, disp: dispOf(it.sym), src: it.src, name: it.name || (q && q.name) || '', logo: logoUrl(it), q };
    if (!q) return Object.assign(c, { price: '—', chg: '', dir: 'flat', sub: '', subDir: 'flat', bubble: null });
    const d = dayChange(q, daily && daily[it.sym]);
    c.bubble = bubbleOf(it, q, d, nowMs, L, taStat);
    c.price = fmtPrice(q.price, it.sym, L);
    c.chg = fmtChg(d.ch, it.sym, L) + ' (' + fmtPct(d.pct) + ')';
    c.dir = dirOf(d.pct);
    c.sub = ''; c.subDir = 'flat';
    if (isTA(it.sym)) {
      if (taStat.closed) c.sub = L.taClosed + (taStat.reason && L[taStat.reason] ? ' · ' + L[taStat.reason] : '');
    } else if (q.ext && q.session !== 'regular') {
      const lbl = q.ext.kind === 'pre' ? L.cardPre : q.ext.kind === 'night' ? L.cardNight : L.cardPost;
      c.sub = lbl; c.subPct = fmtPct(q.ext.pct); c.subDir = dirOf(q.ext.pct);
    }
    return c;
  });
  const header = headerOf(cards, nowMs, L);
  header.two = headerTwoLine(header, lang);
  if (header.two) header.lines[0] = header.lines[0].replace(/\s*·\s*$/, '');
  const fx = fxOf(quotes && quotes[FX_SYM], nowMs);
  return { lang, dir: lang === 'he' ? 'rtl' : 'ltr', L, cards, header, updated: L.updated + ' ' + timeIL(nowMs), fx };
}

module.exports = { FX_SYM, fxOf, fxMarketOpen, STR, parseItems, parseQuote, dayChange, buildModel, bubbleOf, fmtPrice, fmtChg, fmtPct, headerOf, headerTwoLine, logoUrl, isTA };
