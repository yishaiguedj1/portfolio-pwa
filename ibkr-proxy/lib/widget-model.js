/* מודל הווידג'ט (v211): מציטוטי Yahoo (מבנה /api/quotes: chart חתוך + x מ־v7) → טקסטים מוכנים לכרטיס ולכותרת.
   טהור (בלי רשת) — נבדק ב־tests/widget.test.js. אותה לוגיקה כמו באפליקציה (v209/v210): השינוי היומי = המספרים
   הרשמיים של המסחר הרגיל (regularMarketChange/Percent, או regularMarketPrice מול previousClose), אחרי־מסחר בנפרד;
   ת״א באגורות, מדד ת״א בנקודות; "השוק סגור · סיבה" מלוח NYSE / הלוח העברי (lib/market.js).
   מידע שוק ציבורי בלבד — הקישור מכיל סימבולים ותגית מקור, בלי כמויות/שווי. */
'use strict';
const market = require('./market');

const STR = {
  he: {
    open: 'המסחר פתוח', pre: 'טרום־מסחר', post: 'אחרי־מסחר', night: 'מסחר לילי', closed: 'השוק סגור', closedDot: 'השוק סגור ·',
    cardPost: 'אחרי־מסחר', cardPre: 'טרום־מסחר', cardNight: 'לילי', taClosed: 'סגור', updated: 'עודכן',
    ag: 'אג׳', pts: 'נק׳', manual: 'ידני', watch: 'מעקב',
    hdWeekend: 'סופ״ש', hdNewYear: 'ראש השנה', hdMlk: 'יום MLK', hdPresidents: 'הנשיאים', hdGoodFriday: 'שישי הטוב',
    hdMemorial: 'יום הזיכרון', hdJuneteenth: 'ג׳ונטינת׳', hdIndependence: '4 ביולי', hdLabor: 'העבודה',
    hdThanksgiving: 'חג ההודיה', hdChristmas: 'חג המולד',
    hdTaErevRH: 'ערב ראש השנה', hdTaRH: 'ראש השנה', hdTaErevYK: 'ערב יום כיפור', hdTaYK: 'יום כיפור',
    hdTaErevSukkot: 'ערב סוכות', hdTaSukkot: 'סוכות', hdTaErevSimchat: 'הושענא רבה', hdTaSimchat: 'שמחת תורה',
    hdTaPurim: 'פורים', hdTaErevPesach: 'ערב פסח', hdTaPesach: 'פסח', hdTaIndependence: 'יום העצמאות',
    hdTaErevShavuot: 'ערב שבועות', hdTaShavuot: 'שבועות', hdTaTishaBav: 'ט׳ באב',
  },
  en: {
    open: 'Market open', pre: 'Pre-market', post: 'After hours', night: 'Overnight', closed: 'Closed', closedDot: 'Closed ·',
    cardPost: 'After hours', cardPre: 'Pre-market', cardNight: 'Overnight', taClosed: 'Closed', updated: 'Updated',
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
const STATE_SESSION = { PRE: 'pre', PREPRE: 'pre', POST: 'post', POSTPOST: 'post', OVERNIGHT: 'night', CLOSED: 'closed', REGULAR: 'regular' };
const SYM_RE = /^[A-Z0-9][A-Z0-9.\-=^]{0,11}$/;
const MINUS = '−';
const LRI = '⁦', RLI = '⁧', PDI = '⁩';

const isTA = (s) => /\.TA$/i.test(s);
const isTaseIndex = (s) => /^\d{1,4}\.TA$/i.test(s);
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
  if (isTaseIndex(sym)) return isHe(L) ? RLI + fmt2(v) + ' ' + L.pts + PDI : fmt2(v) + ' ' + L.pts;
  if (isTA(sym)) { const n = Math.round(v * 100).toLocaleString('en-US'); return isHe(L) ? RLI + n + ' ' + L.ag + PDI : n + ' ' + L.ag; }
  return LRI + '$' + fmt2(v) + PDI;
}
function fmtChg(ch, sym, L) {
  // בצ׳יפ (LTR): "−101 אג׳ (−1.31%)" — המספר ואחריו היחידה, כמו "‎−$1.19"
  if (isTaseIndex(sym)) { const r = Math.round(ch * 100) / 100; return LRI + sign(r, 0.004) + fmt2(r) + ' ' + L.pts + PDI; }
  if (isTA(sym)) { const a = Math.round(ch * 10000) / 100; const n = Math.abs(a).toLocaleString('en-US', { maximumFractionDigits: 2 }); return LRI + sign(a, 0.004) + n + ' ' + L.ag + PDI; }
  const r = Math.round(ch * 100) / 100;
  return LRI + sign(r, 0.004) + '$' + fmt2(r) + PDI;
}
const isHe = (L) => L === STR.he;
const dirOf = (v) => (Math.abs(v) < 0.005 ? 'flat' : v > 0 ? 'pos' : 'neg');

function logoUrl(it) {
  if (isTA(it.sym)) return it.logo ? 'https://s3-symbol-logo.tradingview.com/' + it.logo + '.svg' : '';
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

/* items + quotes ({SYM: entry}) + daily ({SYM: [closes]}) → מודל התצוגה */
function buildModel(items, quotes, daily, opts) {
  const lang = opts && opts.lang === 'en' ? 'en' : 'he';
  const L = STR[lang];
  const nowMs = (opts && opts.nowMs) || Date.now();
  const taStat = market.taseMarketNow(nowMs);
  const cards = items.map((it) => {
    const q = parseQuote(quotes[it.sym], nowMs);
    const c = { sym: it.sym, disp: it.sym.replace(/\.TA$/i, ''), src: it.src, name: it.name || (q && q.name) || '', logo: logoUrl(it), q };
    if (!q) return Object.assign(c, { price: '—', chg: '', dir: 'flat', sub: '', subDir: 'flat' });
    const d = dayChange(q, daily && daily[it.sym]);
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
  return { lang, dir: lang === 'he' ? 'rtl' : 'ltr', L, cards, header, updated: L.updated + ' ' + timeIL(nowMs) };
}

module.exports = { STR, parseItems, parseQuote, dayChange, buildModel, fmtPrice, fmtChg, fmtPct, headerOf, headerTwoLine, logoUrl, isTA };
