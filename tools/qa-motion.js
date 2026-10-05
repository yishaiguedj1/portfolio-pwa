#!/usr/bin/env node
/* QA תנועה ומעברים (v322): מריץ את כל הזרימות של האפליקציה והספרייה בדפדפן אמיתי, ומודד בכל צעד:
     - קפיצות פריסה (PerformanceObserver layout-shift, בלי קלט אחרון)
     - פריימים ארוכים (רווח בין rAF > 100ms) ומשימות ארוכות (longtask > 50ms)
     - קפיצות גלילה (window ו־.lib-root — שינוי של >120px בפריים אחד בלי מגע)
     - הבהובים: צילום רציף (CDP screencast) → מסגרת "ריקה" בין שתי מסגרות עם תוכן, וקפיצה חדה בין מסגרות
   הרצה: node tools/qa-motion.js --out <dir> [--theme dark] [--width 360] [--rm] [--lang en] [--cpu 4] [--net slow] [--only lib|app] [--frames]
   דורש שרת מקומי על 8792 (python3 -m http.server 8792 בשורש הריפו). כל הרשת החיצונית מדומה — אף פעם לא מול שרתים אמיתיים.
   התוצאה: <out>/report.json + <out>/report.md (ספים: cls>0.02, scrollJump>120, flash, frameGap>250ms). */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require(process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright');

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
const OUT = path.resolve(String(arg('out', 'qa-motion-out')));
const MONKEY = +arg('monkey', 0), SEED = +arg('seed', 7);
const SESSION = String(arg('session', 'CLOSED')).toUpperCase(), SNAP = arg('snap', ''), COMPARE = arg('compare', '');
const LIVE = { tick: 0, fail: false, slowHist: false };   // v325: המחירים זזים בכל בקשה (ספרות מתגלגלות), כשל מוזרק, היסטוריה איטית
const THEME = arg('theme', 'light'), WIDTH = +arg('width', 390), RM = !!arg('rm', false), LANG = arg('lang', 'he');
const CPU = +arg('cpu', 1), NET = arg('net', ''), ONLY = arg('only', ''), FRAMES = !!arg('frames', false), DBG = !!arg('debug-scroll', false), MAXSTEPS = +arg('steps', 0);
const BASE = 'http://localhost:8792';
fs.mkdirSync(OUT, { recursive: true });

/* ---------- פיקסטורות: ספרי EPUB (zip בלי דחיסה — בלי תלויות) ---------- */
function crc32(buf) { let c, crc = 0xFFFFFFFF; for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xFF; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xEDB88320 : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ 0xFFFFFFFF) >>> 0; }
function zipStore(files) {   // [{name, data}] → Buffer (STORE)
  const parts = [], cd = []; let off = 0;
  for (const f of files) {
    const name = Buffer.from(f.name), data = Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data);
    const crc = crc32(data);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0, 6); lh.writeUInt16LE(0, 8); lh.writeUInt16LE(0, 10); lh.writeUInt16LE(0, 12);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(0, 28);
    parts.push(lh, name, data);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0, 8); ch.writeUInt16LE(0, 10); ch.writeUInt16LE(0, 12); ch.writeUInt16LE(0, 14);
    ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(name.length, 28); ch.writeUInt16LE(0, 30); ch.writeUInt16LE(0, 32); ch.writeUInt16LE(0, 34); ch.writeUInt16LE(0, 36); ch.writeUInt32LE(0, 38); ch.writeUInt32LE(off, 42);
    cd.push(ch, name);
    off += lh.length + name.length + data.length;
  }
  const cdBuf = Buffer.concat(cd);
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(0, 4); end.writeUInt16LE(0, 6); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(cdBuf.length, 12); end.writeUInt32LE(off, 16); end.writeUInt16LE(0, 20);
  return Buffer.concat([...parts, cdBuf, end]);
}
function epub(title, author, ident, lang, series) {
  const ser = series ? '<meta property="belongs-to-collection" id="s1">' + series + '</meta><meta refines="#s1" property="collection-type">series</meta>' : '';
  const opf = '<?xml version="1.0" encoding="utf-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="uid">' + ident + '</dc:identifier><dc:title>' + title + '</dc:title><dc:creator>' + author + '</dc:creator><dc:language>' + lang + '</dc:language>' + ser + '<meta property="dcterms:modified">2026-01-01T00:00:00Z</meta></metadata><manifest><item id="c1" href="c1.xhtml" media-type="application/xhtml+xml"/><item id="c2" href="c2.xhtml" media-type="application/xhtml+xml"/><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/></manifest><spine><itemref idref="c1"/><itemref idref="c2"/></spine></package>';
  const ch = (n) => '<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml" lang="' + lang + '"><body><h1>' + title + ' — ' + n + '</h1>' + ('<p>' + 'טקסט לדוגמה של הספר, פסקה אחרי פסקה. '.repeat(30) + '</p>').repeat(12) + '</body></html>';
  return zipStore([
    { name: 'mimetype', data: 'application/epub+zip' },
    { name: 'META-INF/container.xml', data: '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>' },
    { name: 'OEBPS/content.opf', data: opf },
    { name: 'OEBPS/nav.xhtml', data: '<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><body><nav epub:type="toc"><ol><li><a href="c1.xhtml">פרק 1</a></li><li><a href="c2.xhtml">פרק 2</a></li></ol></nav></body></html>' },
    { name: 'OEBPS/c1.xhtml', data: ch(1) }, { name: 'OEBPS/c2.xhtml', data: ch(2) },
  ]);
}
const BULK = Array.from({ length: 50 }, (_, i) => ({ name: 'bulk' + i + '.epub', data: epub('ספר עומס מספר ' + i, ['כותב א', 'כותב ב', 'כותב ג'][i % 3], 'id-bulk-' + i, 'he') }));
const BOOKS = [
  ['m1', 'Rich Dad Poor Dad', 'Robert Kiyosaki', 'en'], ['m2', "Rich Dad's Cashflow Quadrant", 'Robert Kiyosaki', 'en'], ['m3', 'The Subtle Art', 'Mark Manson', 'en'],
  ['m4', 'קיצור תולדות האנושות', 'יובל נח הררי', 'he'], ['m5', 'The Snowball', 'Alice Schroeder', 'en'], ['m6', 'לחשוב מהר, לחשוב לאט', 'דניאל כהנמן', 'he'],
].map(([f, t, a, l]) => ({ name: f + '.epub', data: epub(t, a, 'qa-' + f, l) }));
[1965, 1966, 1967, 1968, 1969, 1985, 1998, 2010, 2020, 2024].forEach((y) => BOOKS.push({ name: 'l' + y + '.epub', data: epub('מכתב באפט ' + y, 'וורן א. באפט', 'qa-l' + y, 'he', 'מכתבי באפט לבעלי המניות') }));
[2018, 2019, 2020].forEach((y) => BOOKS.push({ name: 'z' + y + '.epub', data: epub('מכתב בזוס ' + y, "ג'ף בזוס", 'qa-z' + y, 'he') }));

/* ---------- פיקסטורה: תיק ---------- */
const SYMS = ['AAPL', 'MSFT', 'GOOGL', 'NVDA', 'META', 'AMZN', 'BRK-B', 'KO', 'UNH', 'NOW', 'INTU', 'UBER'];
const PX = { AAPL: 228.4, MSFT: 512.1, GOOGL: 186.2, NVDA: 174.9, META: 731.5, AMZN: 228.1, 'BRK-B': 489.3, KO: 69.1, UNH: 352.6, NOW: 178.2, INTU: 701.4, UBER: 92.3, 'USDILS=X': 3.31 };
const DB = {
  v: 1,
  positions: SYMS.slice(0, 10).map((s, i) => ({ sym: s, name: s, full: s, shares: 10 + i * 3, avg: PX[s] * (0.72 + 0.04 * i), src: 'manual' })),
  deposits: [['03/01/2026', -40000, 'בנק'], ['15/02/2026', -25000, 'בנק'], ['01/04/2026', -30000, 'בנק'], ['20/06/2026', 8000, 'בנק'], ['02/08/2026', -15000, 'בנק']].map(([d, a, p]) => ({ date: d, amount: a, place: p })),
  wishlist: [{ sym: 'INTU', name: 'Intuit', note: '' }, { sym: 'UBER', name: 'Uber', note: '' }, { sym: 'KO', name: 'Coca-Cola', note: '' }],
  wlOrder: [], wlExtra: [{ id: 'w2', name: 'טכנולוגיה', items: [{ sym: 'NVDA', name: 'NVIDIA', note: '' }, { sym: 'META', name: 'Meta', note: '' }] }],
  pensionFunds: [{ name: 'פנסיה — מקום עבודה', usd: 0, ils: 182000, kind: 'pension' }, { name: 'קרן השתלמות', usd: 0, ils: 96000, kind: 'study' }],
  pensionDeposits: [], cash: { usd: 1200, ils: 4000 }, manualTrades: [],
};

/* ---------- רשת מדומה: שרתון (מחירים/היסטוריה/לוגואים/ספרייה), Firebase, Yahoo, לוגואים ---------- */
function quoteJson(sym) {
  const p = (PX[sym] || 100) * (1 + Math.sin(LIVE.tick / 3 + (sym.length)) * 0.002);   // תנודה קטנה בכל בקשה — גלגול ספרות בלי שינוי פריסה
  const now = Math.floor(Date.now() / 1000), day = now - (now % 86400);
  const ts = [], cl = [];
  for (let i = 0; i < 60; i++) { ts.push(day + 14.5 * 3600 + i * 60); cl.push(p * (1 + Math.sin(i / 7) * 0.004)); }
  return { chart: { result: [{ meta: { currency: sym.endsWith('.TA') ? 'ILA' : 'USD', regularMarketPrice: p, chartPreviousClose: p * 0.991, previousClose: p * 0.991, gmtoffset: -14400, regularMarketTime: ts[ts.length - 1], currentTradingPeriod: { regular: { start: day + 13.5 * 3600, end: day + 20 * 3600 }, pre: { start: day + 8 * 3600, end: day + 13.5 * 3600 }, post: { start: day + 20 * 3600, end: day + 24 * 3600 } }, longName: sym + ' Inc.' }, timestamp: ts, indicators: { quote: [{ close: cl }] } }], error: null }, x: { state: SESSION, reg: { p: p, ch: p * 0.009, pct: 0.9 }, pre: { p: p * 0.998, ch: -p * 0.002, pct: -0.2, t: now }, post: { p: p * 1.001, ch: p * 0.001, pct: 0.1, t: now }, night: { p: p * 1.002, ch: p * 0.002, pct: 0.2, t: now } } };
}
function histJson(syms, range) {
  const out = {};
  const days = range === '1d' || range === '5d' ? 0 : (range === 'max' || /7y|10y/.test(String(range))) ? 2700 : 1300;
  const today = Math.floor(Date.now() / 86400000);
  for (const s of syms) {
    const p = PX[s] || 100, t = [], c = [];
    if (!days) { for (let i = 0; i < 390; i += 5) { t.push(Math.floor(Date.now() / 60000) - 390 + i); c.push(p * (1 + Math.sin(i / 40) * 0.006)); } out[s] = { t, c, m: 1 }; continue; }
    for (let i = days; i >= 0; i--) { const d = today - i; if (new Date(d * 86400000).getUTCDay() % 6 === 0) continue; t.push(d); c.push(p * (0.55 + 0.45 * (1 - i / days)) * (1 + Math.sin(i / 23) * 0.03)); }
    out[s] = { t, c };
  }
  return out;
}
async function routes(ctx) {
  const J = (r, o, st) => r.fulfill({ status: st || 200, contentType: 'application/json', body: JSON.stringify(o), headers: { 'access-control-allow-origin': '*' } });
  await ctx.route(/gstatic|googleapis|firebase|yahoo|cnbc|stooq|frankfurter|er-api|wikimedia|financialmodelingprep|tradingview|accounts\.google/, (r) => r.abort());
  // v325: ב־Playwright הניתוב שנרשם אחרון גובר — התפיסה הכללית של /api/ חייבת להירשם ראשונה, אחרת כל הסטאבים (מחירים, היסטוריה) החזירו 503 והגרפים לא צוירו
  await ctx.route(/\/api\//, (r) => J(r, { ok: false }, 503));
  await ctx.route(/\/api\/quotes/, (r) => { LIVE.tick++; if (LIVE.fail) return J(r, { ok: false }, 503); const b = JSON.parse(r.request().postData() || '{}'); const data = {}; (b.syms || []).forEach((s) => { data[s] = quoteJson(s); }); setTimeout(() => J(r, { ok: true, data }), NET === 'slow' ? 900 : 40); });
  await ctx.route(/\/api\/history/, (r) => { if (LIVE.fail) return J(r, { ok: false }, 503); const b = JSON.parse(r.request().postData() || '{}'); setTimeout(() => J(r, { ok: true, data: histJson(b.syms || [], b.range) }), (NET === 'slow' || LIVE.slowHist) ? 1400 : 60); });
  await ctx.route(/\/api\/wordmark/, (r) => J(r, { ok: true, data: {} }));
  await ctx.route(/\/api\/translate/, (r) => setTimeout(() => J(r, { ok: true, translation: 'תרגום בדיקה', note: 'הערת הקשר', engine: 'ai' }), 300));
  await ctx.route(/\/api\/search/, (r) => J(r, { ok: true, results: [] }));
  await ctx.route(/\/api\/library/, (r) => { const b = JSON.parse(r.request().postData() || '{}'); if (b.op === 'gdConfig') return J(r, { ok: true, configured: false, clientId: '' }); if (b.op === 'me') return J(r, { ok: true, admin: false }); return J(r, { ok: false, error: 'not_configured' }, 503); });
  await ctx.route(/\/\.qa-books\/(.+)$/, (r) => { const n = decodeURIComponent(r.request().url().split('/.qa-books/')[1]); const f = BOOKS.find((x) => x.name === n) || BULK.find((x) => x.name === n); if (!f) return r.fulfill({ status: 404 }); r.fulfill({ status: 200, contentType: 'application/epub+zip', body: f.data }); });
}

/* ---------- מדידה בתוך הדף ---------- */
const INIT = `(() => {
  const M = window.__motion = { steps: [], cur: null, scrollLog: [], touching: 0 };
  const now = () => performance.now();
  M.mark = (name) => { M.flushStep(); M.cur = { name, t0: now(), cls: 0, clsMax: 0, shifts: [], longTasks: [], frameGaps: [], scrollJumps: [], heightChanges: 0 }; };
  M.flushStep = () => { if (M.cur) { M.cur.t1 = now(); M.steps.push(M.cur); M.cur = null; } };
  M.take = () => { M.flushStep(); const s = M.steps; M.steps = []; return s; };
  // בדיקות שלמות אחרי כל צעד (אחרי ההתייצבות): מחסנית החלונות מול ההיסטוריה, דגלים שלא נתקעו, שכבות יתומות
  M.check = async () => {
    const bad = []; const st = history.state || {}; const H = document.documentElement;
    if (!window.__lib && document.querySelector('.lib-root')) { try { window.__lib = await import('./library.js'); } catch (e) {} }
    const L = window.__lib && window.__lib._test ? window.__lib._test.state() : null;
    try {
      if (typeof _backPending !== 'undefined' && _backPending) bad.push('_backPending=' + _backPending);
      if (typeof _navSkipPop !== 'undefined' && _navSkipPop) bad.push('_navSkipPop=' + _navSkipPop);
      if (typeof _modals !== 'undefined' && _modals.length !== (st.modal || 0)) bad.push('modals=' + _modals.length + ' state.modal=' + (st.modal || 0));
      if (H.classList.contains('lib-restoring')) bad.push('lib-restoring תקוע');
      if (H.classList.contains('lib-open') !== !!document.querySelector('.lib-root')) bad.push('lib-open ≠ .lib-root');
      if (document.querySelectorAll('.lib-veil.out').length) bad.push('גיליון .out יתום');
      if (document.querySelectorAll('.dlg-veil').length > 1) bad.push('שני חלונות אישור');
      if (document.querySelectorAll('.item-acts').length > 1) bad.push('שתי קבוצות כפתורי לחיצה ארוכה');
      if (H.dataset.libVt) bad.push('data-lib-vt תקוע=' + H.dataset.libVt);
      if (H.dataset.modalPop || H.dataset.navSkip) bad.push('דגל popstate תקוע');
      const menuOpen = !!document.getElementById('menuDrop') && !document.getElementById('menuDrop').classList.contains('hidden');
      if (menuOpen && !(st.modal > 0)) bad.push('תפריט פתוח בלי רשומה');
      if (L) {
        if (L.sheetSkip) bad.push('sheetSkip=' + L.sheetSkip);
        if (L.vt) bad.push('VT.inside תקוע');
        if (L.root && (st.lib || 0) < 1) bad.push('ספרייה פתוחה בלי lib ברשומה');
        if (!L.root && st.lib) bad.push('רשומת lib בלי ספרייה');
        if (L.rd !== ((st.lib || 0) >= 2)) bad.push('קורא=' + L.rd + ' מול lib=' + (st.lib || 0));
        if (L.root && L.veils !== (st.sheet || 0)) bad.push('גיליונות=' + L.veils + ' מול state.sheet=' + (st.sheet || 0));
      }
    } catch (e) { bad.push('check: ' + e.message); }
    return bad;
  };
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) { if (e.hadRecentInput || !M.cur) continue; M.cur.cls += e.value; M.cur.clsMax = Math.max(M.cur.clsMax, e.value);
      const src = (e.sources || []).slice(0, 2).map((s) => { const n = s.node; if (!n) return '?'; let d = n.nodeType === 1 ? n : n.parentElement; return d ? (d.tagName.toLowerCase() + (d.id ? '#' + d.id : '') + (d.className && typeof d.className === 'string' ? '.' + d.className.trim().split(/\\s+/).slice(0, 2).join('.') : '')) : '?'; });
      M.cur.shifts.push({ v: +e.value.toFixed(4), t: Math.round(e.startTime - M.cur.t0), src }); } }).observe({ type: 'layout-shift', buffered: true });
  } catch (e) {}
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (M.cur) M.cur.longTasks.push(Math.round(e.duration)); }).observe({ type: 'longtask', buffered: true }); } catch (e) {}
  let last = now(), lastY = -1, lastLibY = -1, lastH = 0, dW = [0, 0], dL = [0, 0];
  const libRoot = () => document.querySelector('.lib-root');
  const tick = () => {
    const t = now(); const gap = t - last; last = t;
    if (M.cur && gap > 100) M.cur.frameGaps.push(Math.round(gap));
    const y = window.scrollY || 0; const lr = libRoot(); const ly = lr ? lr.scrollTop : -1;
    // קפיצה = שינוי גדול בפריים אחד כשלפניו הגלילה עמדה (אנימציה של גלילה זזה בכל פריים — לא נספרת)
    const jw = lastY >= 0 ? y - lastY : 0, jl = lastLibY >= 0 && ly >= 0 ? ly - lastLibY : 0;
    if (M.cur && !M.touching && !M.expectScroll) {
      // v325: גלילה לראש העמוד של מעבר טאב מסומנת data-nav-scroll על <html> (navScrollTop ב־app.js) — לא קפיצה
      if (Math.abs(jw) > 120 && Math.abs(dW[1]) < 6 && Math.abs(dW[0]) < 6 && !document.documentElement.dataset.navScroll) M.cur.scrollJumps.push({ el: 'window', from: Math.round(lastY), to: Math.round(y), t: Math.round(t - M.cur.t0) });
      // גלילה של מעבר דף בספרייה (דף חדש מראשו / חזרה למקום השמור) מסומנת data-nav-scroll — לא קפיצה
      if (Math.abs(jl) > 120 && Math.abs(dL[1]) < 6 && Math.abs(dL[0]) < 6 && !(lr && lr.dataset.navScroll)) M.cur.scrollJumps.push({ el: 'lib', from: Math.round(lastLibY), to: Math.round(ly), t: Math.round(t - M.cur.t0) });
    }
    dW = [dW[1], jw]; dL = [dL[1], jl];
    lastY = y; lastLibY = ly;
    const hh = document.documentElement.scrollHeight; if (M.cur && lastH && Math.abs(hh - lastH) > 40) M.cur.heightChanges++; lastH = hh;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  if (window.__dbgScroll) {   // --debug-scroll: מי גלגל (מחסנית קריאה) — לאבחון קפיצות
    const st = () => (new Error().stack || '').split(String.fromCharCode(10)).slice(2, 6).map((l) => l.trim().replace(/^at /, '').replace(location.origin, '')).join(' < ');
    const w = window.scrollTo.bind(window); window.scrollTo = function () { if (M.cur) (M.cur.scrollLog = M.cur.scrollLog || []).push(['scrollTo', JSON.stringify([...arguments]).slice(0, 50), st()]); return w.apply(window, arguments); };
    const si = Element.prototype.scrollIntoView; Element.prototype.scrollIntoView = function () { if (M.cur) (M.cur.scrollLog = M.cur.scrollLog || []).push(['scrollIntoView', this.tagName + '.' + String(this.className).slice(0, 30), st()]); return si.apply(this, arguments); };
    const f = HTMLElement.prototype.focus; HTMLElement.prototype.focus = function (o) { if (M.cur) (M.cur.scrollLog = M.cur.scrollLog || []).push(['focus', this.tagName + '.' + String(this.className).slice(0, 30), JSON.stringify(o || null)]); return f.call(this, o); };
    window.addEventListener('scroll', () => { if (M.cur) (M.cur.scrollLog = M.cur.scrollLog || []).push(['scroll', window.scrollY, Math.round(now() - M.cur.t0)]); });
  }
  window.addEventListener('touchstart', () => { M.touching++; }, true); window.addEventListener('touchend', () => { setTimeout(() => { M.touching = Math.max(0, M.touching - 1); }, 400); }, true);
  window.addEventListener('wheel', () => { M.touching++; setTimeout(() => { M.touching = Math.max(0, M.touching - 1); }, 400); }, { capture: true, passive: true });
})();`;

/* ---------- צילום רציף (screencast) לזיהוי הבהובים וקפיצות ---------- */
function makeCaster(cdp, dir) {
  let frames = [], on = false, idx = 0;
  cdp.on('Page.screencastFrame', async (ev) => {
    try { await cdp.send('Page.screencastFrameAck', { sessionId: ev.sessionId }); } catch (e) {}
    if (!on) return;
    const f = path.join(dir, 'f' + String(idx++).padStart(4, '0') + '.jpg');
    fs.writeFileSync(f, Buffer.from(ev.data, 'base64'));
    frames.push({ f, t: ev.metadata && ev.metadata.timestamp ? ev.metadata.timestamp * 1000 : Date.now() });
  });
  return {
    async start() { frames = []; idx = 0; on = true; await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 45, maxWidth: 400, maxHeight: 900, everyNthFrame: 1 }); },
    async stop() { on = false; try { await cdp.send('Page.stopScreencast'); } catch (e) {} return frames; },
  };
}
const PY = `
import sys, json
from PIL import Image, ImageChops, ImageStat
files = json.loads(sys.argv[1]); bg = tuple(json.loads(sys.argv[2])); top = int(sys.argv[3])
prev = None; out = []; hist = []
for f in files:
    im = Image.open(f).convert('RGB'); w, h = im.size
    im = im.crop((0, top, w, h)).resize((w // 2, (h - top) // 2))
    px = im.getdata(); n = len(px)
    blank = sum(1 for p in px if abs(p[0]-bg[0]) < 14 and abs(p[1]-bg[1]) < 14 and abs(p[2]-bg[2]) < 14) / n
    diff = 0.0; rev = 99.0
    if prev is not None:
        d = ImageChops.difference(im, prev).convert('L'); st = ImageStat.Stat(d); diff = st.mean[0]
    # rev = המרחק המינימלי מאחת מ־2–4 המסגרות שלפני הקודמת: קטן = התוכן "חזר" למה שהיה (ריצוד), גדול = אנימציה שהמשיכה
    for old in hist[-4:-1]:
        r = ImageStat.Stat(ImageChops.difference(im, old).convert('L')).mean[0]
        if r < rev: rev = r
    out.append({'blank': round(blank, 3), 'diff': round(diff, 2), 'rev': round(rev, 2)})
    prev = im; hist.append(im); hist = hist[-5:]
print(json.dumps(out))
`;
function analyzeFrames(frames, bg, top) {
  if (frames.length < 2) return { frames: frames.length, flash: 0, maxDiff: 0 };
  let rows;
  try { rows = JSON.parse(execFileSync('python3', ['-W', 'ignore', '-c', PY, JSON.stringify(frames.map((f) => f.f)), JSON.stringify(bg), String(top)], { maxBuffer: 1 << 26 }).toString()); }
  catch (e) { return { frames: frames.length, flash: 0, maxDiff: 0, err: String(e.message).slice(0, 80) }; }
  let flash = 0, maxDiff = 0, blankRun = 0, flicker = 0;
  for (let i = 1; i < rows.length - 1; i++) {
    maxDiff = Math.max(maxDiff, rows[i].diff);
    // הבהוב: מסגרת (או שתיים) כמעט ריקה בין שתי מסגרות עם תוכן — מה שהמשתמש רואה כ"רענון"
    if (rows[i].blank > 0.93 && rows[i - 1].blank < 0.8 && rows[Math.min(rows.length - 1, i + 2)].blank < 0.8) { blankRun++; if (blankRun === 1) flash++; } else blankRun = 0;
    // ריצוד: קפיצה חדה (diff>18) ואז תוך 1–3 מסגרות עוד קפיצה חדה **שמחזירה את התוכן למה שהיה לפני** (rev<4) — ציור כפול/החלפה הלוך־ושוב.
    // v325: בלי בדיקת החזרה, פריים כפול באמצע אנימציה רציפה (מסך שלא התעדכן ב־screencast) נספר כריצוד — "כרטיס פתוח" אחרי חזרת מחירים
    if (rows[i].diff > 18 && i + 3 < rows.length) { const nxt = rows.slice(i + 1, i + 4); if (nxt.some((r) => r.diff > 18 && r.rev < 4)) flicker++; }
  }
  return { frames: rows.length, flash, flicker, maxDiff: +maxDiff.toFixed(1), blanks: rows.map((r) => r.blank), diffs: rows.map((r) => r.diff) };
}

/* ---------- הרצה ---------- */
// ייצוא לסקריפטי אבחון: require('./qa-motion.js') מחזיר את הקבצים בלי להריץ
if (require.main !== module) { module.exports = { BOOKS, epub, zipStore, DB, routes, INIT }; return; }
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ viewport: { width: WIDTH, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block', hasTouch: true, ignoreHTTPSErrors: true,
    colorScheme: THEME === 'dark' ? 'dark' : 'light', reducedMotion: RM ? 'reduce' : 'no-preference', locale: LANG === 'en' ? 'en-GB' : 'he-IL' });
  await routes(ctx);
  if (DBG) await ctx.addInitScript(() => { window.__dbgScroll = true; });
  await ctx.addInitScript(INIT);
  await ctx.addInitScript(({ db, theme, lang }) => {
    try {
      if (!localStorage.getItem('__qa_seeded')) {
        localStorage.setItem('pwa_db_v1', JSON.stringify(db)); localStorage.setItem('pwa_owner_v1', 'local'); localStorage.setItem('pwa_theme_v1', theme);
        localStorage.setItem('pwa_lang_v1', lang); localStorage.setItem('__qa_seeded', '1');
      }
    } catch (e) {}
  }, { db: DB, theme: THEME, lang: LANG });
  let page = await ctx.newPage();   // let — מקטע האופליין מחליף זמנית לדף בהקשר עם Service Worker
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 160)));
  // שגיאות קונסול (בלי כשלי רשת של ה־API המדומה)
  page.on('console', (m) => { if (m.type() !== 'error') return; const t = m.text(); if (/Failed to load resource|net::|the server responded|503|Content Security Policy/.test(t)) return; errors.push('console: ' + t.slice(0, 160)); });
  const cdp = await ctx.newCDPSession(page);
  if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  const caster = makeCaster(cdp, OUT);
  const results = [];
  const bgOf = async () => page.evaluate(() => { const c = getComputedStyle(document.body).backgroundColor.match(/\d+/g) || [242, 242, 247]; return c.slice(0, 3).map(Number); });
  const topOf = async () => page.evaluate(() => { const r = document.querySelector('.lib-root') ? document.querySelector('.lib-top') : document.querySelector('.appbar'); return r ? Math.round(r.getBoundingClientRect().bottom * 400 / window.innerWidth) : 0; });

  let nSteps = 0;
  async function step(name, fn, opt = {}) {
    if (MAXSTEPS && nSteps >= MAXSTEPS) return; nSteps++;
    const settle = opt.settle || 900;
    if (!page.url().startsWith(BASE)) { process.stdout.write('  (הדף עזב ל־' + page.url().slice(0, 60) + ' — חוזרים)\n'); await page.goto(BASE + '/index.html', { waitUntil: 'load' }); await sleep(2000); }
    if (opt.pre) { try { await page.locator(opt.pre).first().evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' })); await sleep(250); } catch (e) {} }   // גלילה למרכז לפני הצעד (מחוץ למדידה) — בתחתית המסך שורת הטאבים מכסה ו־page.click נתקע
    await page.evaluate((x) => { if (window.__motion) window.__motion.expectScroll = !!x; }, !!opt.scroll);
    const bg = await bgOf(), top = await topOf();
    await page.evaluate((n) => window.__motion.mark(n), name);
    await caster.start();
    const t0 = Date.now();
    let err = '';
    const nErr0 = errors.length;
    try { await fn(); } catch (e) { err = String(e.message).split('\n')[0].slice(0, 120) + ' @' + page.url().slice(BASE.length, BASE.length + 40); }
    await page.waitForTimeout(settle);
    if (!err && errors.length > nErr0) err = 'שגיאת דף: ' + errors.slice(nErr0).join(' · ').slice(0, 200);
    if (!err && page.url().startsWith(BASE)) { const inv = await page.evaluate(() => (window.__motion && window.__motion.check) ? window.__motion.check() : []).catch(() => []); if (inv.length) err = 'שלמות: ' + inv.join(' · '); }
    const frames = await caster.stop();
    const exited = !page.url().startsWith(BASE);
    const [m] = exited ? [null] : await page.evaluate(() => window.__motion.take());
    const fr = analyzeFrames(frames, bg, top);
    if (!FRAMES && !opt.keep && !(fr.flash || fr.flicker || (m && m.scrollJumps.length))) frames.forEach((f) => { try { fs.unlinkSync(f.f); } catch (e) {} });
    else { const d = path.join(OUT, 'frames-' + name.replace(/[^\w֐-׿-]+/g, '_')); fs.mkdirSync(d, { recursive: true }); frames.forEach((f, i) => { try { fs.renameSync(f.f, path.join(d, 'f' + String(i).padStart(3, '0') + '.jpg')); } catch (e) {} }); }
    if (!err && opt.expect && !exited) { const okHere = await page.locator(opt.expect).first().count().catch(() => 0); if (!okHere) err = 'לא במקום הצפוי (' + opt.expect + ')'; }
    if (err && !exited) { try { err += ' · ' + await page.evaluate(() => 'state=' + JSON.stringify(history.state) + ' modals=' + (typeof _modals !== 'undefined' ? _modals.length : '?') + ' pend=' + (typeof _backPending !== 'undefined' ? _backPending : '?') + ' תפריט=' + (document.getElementById('menuDrop') && !document.getElementById('menuDrop').classList.contains('hidden')) + ' דף=' + ((document.querySelector('.tabpage.active') || {}).id || '-')); } catch (e) {} }
    if (err && !exited) { try { err += ' · מצב: ' + await page.evaluate(() => { if (document.querySelector('.rd')) return 'קורא'; const r = document.querySelector('.lib-root'); if (r) { const on = r.querySelector('.lib-chip.on'); return 'ספרייה/' + (r.querySelector('.bk-cta') ? 'דף' : on ? on.textContent.trim() : (r.querySelector('.lib-large') || {}).textContent); } const t = document.querySelector('.tab.active'); return 'אפליקציה/' + (t ? t.dataset.tab : '?'); }); } catch (e) {} }
    const row = { name, ms: Date.now() - t0 - settle, cls: +(m ? m.cls : 0).toFixed(4), clsMax: +(m ? m.clsMax : 0).toFixed(4), shifts: m ? m.shifts.slice(0, 6) : [], longTasks: m ? m.longTasks : [], frameGaps: m ? m.frameGaps : [], scrollJumps: m ? m.scrollJumps : [], heightChanges: m ? m.heightChanges : 0, flash: fr.flash, maxDiff: fr.maxDiff, frames: fr.frames, flicker: fr.flicker || 0, exited, err, scrollLog: m && m.scrollLog ? m.scrollLog.slice(0, 40) : undefined };
    row.bad = row.cls > (opt.cls == null ? 0.02 : opt.cls) || row.scrollJumps.length > 0 || row.flash > 0 || (row.flicker > 0 && !opt.flickerOk) || row.frameGaps.some((g) => g > (opt.gap || 250)) || !!row.err || (exited && !opt.exitOk);
    results.push(row);
    if (DBG && row.scrollJumps.length && row.scrollLog) row.scrollLog.forEach((l) => process.stdout.write('    ' + l.join('  ') + '\n'));
    process.stdout.write((row.bad ? '✗ ' : '✓ ') + name + '  cls=' + row.cls + ' gaps=' + row.frameGaps.join('/') + ' jumps=' + row.scrollJumps.length + ' flash=' + row.flash + ' flicker=' + row.flicker + (row.exited ? ' [יצא מהאפליקציה]' : '') + (row.err ? '  ERR ' + row.err : '') + '\n');
  }
  const sleep = (ms) => page.waitForTimeout(ms);
  const tapTab = (t) => page.click('.tab[data-tab="' + t + '"]');
  const jsClick = (sel) => page.evaluate((q) => { const e = document.querySelector(q); if (!e) throw new Error('אין ' + q); e.click(); }, sel);   // בלי הגלילה האוטומטית של Playwright (scrollIntoViewIfNeeded)
  const back = () => page.goBack().catch(() => {});
  const hold = async (sel) => { const bx = await page.locator(sel).first().boundingBox(); if (!bx) throw new Error('אין ' + sel); const tp = { x: bx.x + bx.width / 2, y: bx.y + bx.height / 2 }; const vp = page.viewportSize(); if (tp.y < 0 || tp.y > vp.height - 64 || tp.x < 0 || tp.x > vp.width) throw new Error('נקודת הלחיצה הארוכה מחוץ למסך/מתחת לשורת הטאבים (' + Math.round(tp.x) + ',' + Math.round(tp.y) + ') — להוסיף pre על האלמנט עצמו'); await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [tp] }); await sleep(700); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
  const scrollWin = (y) => page.evaluate((y) => window.scrollTo(0, y), y);
  const scrollLib = (y) => page.evaluate((y) => { const r = document.querySelector('.lib-root'); if (r) r.scrollTop = y; }, y);
  const reload = async (st) => { await page.reload({ waitUntil: 'load' }); await sleep(st || 2500); };

  // זריעת הספרייה (פעם אחת לדפדפן): ייבוא הספרים, סימון מכתבים כ־Drive, התקדמות, אסופות
  const ensureLibSeeded = async () => {
    const seeded = await page.evaluate(() => localStorage.getItem('__qa_lib') === '1');
    if (seeded) return false;
    if (!(await page.$('.lib-root'))) { await jsClick('#menuBtn'); await sleep(300); await jsClick('#menuLibraryBtn'); await sleep(1500); }
    await page.click('.lib-seg-b:nth-child(2)'); await sleep(500);
    await page.evaluate(async (names) => {
      const dt = new DataTransfer();
      for (const n of names) { const bl = await (await fetch('/.qa-books/' + n)).blob(); dt.items.add(new File([bl], n, { type: 'application/epub+zip' })); }
      const inp = document.querySelector('.lib-root input[type=file]'); inp.files = dt.files; inp.dispatchEvent(new Event('change'));
    }, BOOKS.map((b) => b.name));
    await sleep(9000);
    await page.evaluate(() => new Promise((res) => { const r = indexedDB.open('snb-library'); r.onsuccess = () => { const t = r.result.transaction('books', 'readwrite'); const st = t.objectStore('books'); const q = st.getAll(); q.onsuccess = () => q.result.forEach((x) => {
      if (/מכתב/.test(x.title)) { x.src = 'drive'; x.driveId = 'D' + x.id; x.md5 = 'a'; delete x.owner; }
      if (/Rich Dad Poor|1985|קיצור/.test(x.title)) { x.fraction = 0.3; x.lastRead = Date.now(); }
      if (/Subtle|2010|1966/.test(x.title)) { x.done = true; x.fraction = 1; }
      st.put(x); }); t.oncomplete = res; }; }));
    await page.evaluate(() => { localStorage.setItem('pwa_libcoll_v1', JSON.stringify({ local: { k1: { n: 'השקעות', s: 'mine', b: ['id-qa-m1', 'id-qa-m2', 'id-qa-m5'], u: 1 }, k2: { n: 'פיתוח אישי', s: 'mine', b: ['id-qa-m3', 'id-qa-m4'], u: 1 }, k3: { n: 'המכתבים האהובים', s: 'snb', b: ['id-qa-l1985', 'id-qa-l2024', 'id-qa-z2020'], u: 1 } } })); localStorage.setItem('__qa_lib', '1'); });
    return true;
  };

  /* ---------- האפליקציה ---------- */
  if (ONLY !== 'lib' && ONLY !== 'monkey' && ONLY !== 'ext' && ONLY !== 'ext2' && ONLY !== 'ext3' && ONLY !== 'ext4') {
    await step('app: טעינה ראשונה (סקירה)', async () => { await page.goto(BASE + '/index.html', { waitUntil: 'load' }); await sleep(2500); }, { settle: 1500 });
    for (const t of ['stocks', 'trades', 'wishlist', 'deposits', 'pension', 'overview']) await step('app: טאב ' + t, () => tapTab(t), { scroll: true });
    await step('app: פתיחת תפריט', () => jsClick('#menuBtn'));
    await step('app: הגדרות מהתפריט', async () => { await jsClick('#langBtn'); });
    await step('app: אפשרויות מתקדמות', () => page.click('#advancedOpen'));
    await step('app: חזור ← הגדרות', back, { expect: '#tab-settings.active' });
    await step('app: חזור ← סקירה', back, { expect: '#tab-overview.active' });
    await step('app: טאב מניות', () => tapTab('stocks'));
    // ב־reduced-motion מנוע הכרטיס גולל מיד (בלי קפיץ) — זו הכוונה, לא קפיצה
    await step('app: פתיחת כרטיס ראשון', async () => { await page.click('#stockList .stock >> nth=0 >> .stock-head'); await sleep(900); }, { settle: 1400, scroll: RM });
    await step('app: מעבר לכרטיס שלישי', async () => { await page.click('#stockList .stock >> nth=2 >> .stock-head'); await sleep(900); }, { settle: 1400, pre: '#stockList .stock >> nth=2', scroll: RM });
    await step('app: טווח 1Y בגרף', async () => { const b = page.locator('.stock.open .range-btn, .stock.open .chip-btn').filter({ hasText: /1Y|שנה/ }).first(); if (await b.count()) await b.click(); }, { settle: 1200 });
    await step('app: סגירת הכרטיס', async () => { await page.click('.stock.open .stock-head'); await sleep(900); }, { settle: 1200 });
    await step('app: גלילה למטה במניות', async () => { await scrollWin(600); await sleep(300); }, { scroll: true });
    await step('app: רענון בטאב מניות (גלול)', () => reload(), { settle: 2500 });
    await step('app: טאב מעקב', () => tapTab('wishlist'), { scroll: true });
    await step('app: החלפת רשימת מעקב', async () => { const t = page.locator('#wlTabs .wl-tab:not(.add) >> nth=1'); if (await t.count()) await t.click(); });
    await step('app: טאב סקירה', () => tapTab('overview'));
    await step('app: גלילה בסקירה', async () => { await scrollWin(900); await sleep(300); }, { scroll: true });
    await step('app: רענון בסקירה (גלול)', () => reload(), { settle: 2500 });
    await step('app: הגדרות מהתפריט (2)', async () => { await jsClick('#menuBtn'); await sleep(350); await jsClick('#langBtn'); }, { scroll: true });
    await step('app: ערכה כהה/בהירה', async () => { await page.click(THEME === 'dark' ? '#themeLight' : '#themeDark'); }, { settle: 1200, pre: '#themeDark' });
    await step('app: ערכה חזרה', async () => { await page.click(THEME === 'dark' ? '#themeDark' : '#themeLight'); }, { settle: 1200 });
    await step('app: גיליון איפוס', () => page.click('#resetOpen'), { pre: '#resetOpen', expect: '#resetSheetVeil:not(.hidden)' });
    await step('app: חזור עם גיליון פתוח', back, { expect: '#tab-settings.active:not(:has(#resetSheetVeil:not(.hidden)))' });
    await step('app: תפריט + חזור', async () => { await jsClick('#menuBtn'); await sleep(400); await back(); }, { expect: '#menuDrop.hidden' });
    await step('app: ניקוי (Escape)', async () => { await page.keyboard.press('Escape'); await page.evaluate(() => { try { closeResetSheet(); setMainMenuOpen(false); } catch (e) {} }); }, { settle: 400 });
    await step('app: טאב הפקדות', () => tapTab('deposits'), { scroll: true });
    await step('app: רענון בהפקדות', () => reload(), { settle: 2000 });
    await step('app: טאב פנסיה', () => tapTab('pension'));
    await step('app: רענון בפנסיה', () => reload(), { settle: 2000 });
    await step('app: טאב עסקאות', () => tapTab('trades'));
    await step('app: רענון בעסקאות', () => reload(), { settle: 2000 });
    // v323: "חזור" סוגר כל חלון — בועת סינון, תפריט רשימות + גיליון, כפתורי לחיצה ארוכה, חלון אישור; ורצפים מהירים
    await step('app: טאב הפקדות (2)', () => tapTab('deposits'), { scroll: true });
    await step('app: בועת סינון', () => page.click('#depositsSrcFilter .src-btn'), { expect: '#depositsSrcFilter.open' });
    await step('app: חזור ← סוגר את הבועה', back, { expect: '#tab-deposits.active:has(#depositsSrcFilter:not(.open))' });
    await step('app: סינון → ידני', async () => { await page.click('#depositsSrcFilter .src-btn'); await sleep(300); await page.click('#depositsSrcFilter .src-opt[data-srcf="manual"]'); }, { expect: '#depositsSrcFilter:not(.open)' });
    await step('app: סינון → הכל', async () => { await page.click('#depositsSrcFilter .src-btn'); await sleep(300); await page.click('#depositsSrcFilter .src-opt[data-srcf="all"]'); }, { expect: '#depositsSrcFilter:not(.open)' });
    await step('app: טאב מעקב (2)', () => tapTab('wishlist'), { scroll: true });
    await step('app: תפריט הרשימות', () => page.click('.wl-title-btn'), { expect: '.wl-pop:not(.hidden)' });
    await step('app: רשימה חדשה (גיליון)', () => page.click('.wl-pop [data-act="new"]'), { expect: '#wlSheetVeil' });
    await step('app: חזור ← סוגר את הגיליון', back, { expect: '#tab-wishlist.active:not(:has(#wlSheetVeil))' });
    await step('app: תפריט הרשימות + חזור', async () => { await page.click('.wl-title-btn'); await sleep(300); await back(); }, { expect: '#tab-wishlist.active:has(.wl-pop.hidden)' });
    await step('app: טאב מניות (2)', () => tapTab('stocks'), { scroll: true });
    await step('app: לחיצה ארוכה על מניה', () => hold('#stockList .stock >> nth=1'), { pre: '#stockList .stock >> nth=1', expect: '.item-acts' });
    await step('app: חזור ← מבטל את הכפתורים', back, { expect: '#tab-stocks.active:not(:has(.item-acts))' });
    await step('app: לחיצה ארוכה → מחיקה (חלון אישור)', async () => { await hold('#stockList .stock >> nth=1'); await sleep(400); await page.click('.item-acts .act-del'); }, { pre: '#stockList .stock >> nth=1', expect: '.dlg-veil' });
    await step('app: חזור ← ביטול החלון', back, { expect: '#tab-stocks.active:not(:has(.dlg-veil))' });
    await step('app: המניה נשארה', async () => { const n = await page.locator('#stockList .stock').count(); if (n < 2) throw new Error('המניה נמחקה אחרי ביטול'); }, { settle: 100 });
    await step('app: חלון אישור → אישור בכפתור', async () => { await hold('#stockList .stock >> nth=1'); await sleep(400); await page.click('.item-acts .act-del'); await sleep(400); await page.click('.dlg-cancel'); }, { pre: '#stockList .stock >> nth=1', expect: '#tab-stocks.active:not(:has(.dlg-veil))' });
    await step('app: תפריט → הגדרות → מתקדמות → חזור×2 מהר', async () => { await jsClick('#menuBtn'); await sleep(300); await jsClick('#langBtn'); await sleep(700); await page.click('#advancedOpen'); await sleep(900); await back(); await back(); }, { settle: 1500, scroll: true, expect: '#tab-overview.active' });
    await step('app: תפריט נפתח ונסגר מהר ואז הגדרות', async () => { await jsClick('#menuBtn'); await sleep(80); await jsClick('#menuBtn'); await sleep(80); await jsClick('#menuBtn'); await sleep(200); await jsClick('#langBtn'); }, { settle: 1200, expect: 'body:has(#tab-settings.active):has(#menuDrop.hidden)' });
    await step('app: חזור ← סקירה (2)', back, { expect: '#tab-overview.active' });
    await step('app: ספרייה מהתפריט ואז חזור', async () => { await jsClick('#menuBtn'); await sleep(300); await jsClick('#menuLibraryBtn'); await sleep(1800); await back(); }, { settle: 1500, expect: '#tab-overview.active' });
    await step('app: רענון עם תפריט פתוח', async () => { await jsClick('#menuBtn'); await sleep(400); await reload(); }, { settle: 1500, expect: '#menuDrop.hidden' });
    await step('app: אחרי הרענון — תפריט + חזור', async () => { await jsClick('#menuBtn'); await sleep(400); await back(); }, { expect: 'body:has(#tab-overview.active):has(#menuDrop.hidden)' });
  }

  /* ---------- הספרייה ---------- */
  if (ONLY !== 'app' && ONLY !== 'monkey' && ONLY !== 'ext' && ONLY !== 'ext2' && ONLY !== 'ext3' && ONLY !== 'ext4') {
    if (ONLY === 'lib') { await page.goto(BASE + '/index.html', { waitUntil: 'load' }); await sleep(2000); }
    await page.evaluate(() => { localStorage.setItem('pwa_libshelf_v1', 'mine'); });
    if (MAXSTEPS && nSteps >= MAXSTEPS) { /* מכסת צעדים */ }
    await step('lib: פתיחה מהתפריט', async () => { await jsClick('#menuBtn'); await sleep(300); await jsClick('#menuLibraryBtn'); await sleep(1200); }, { settle: 1200 });
    if (await ensureLibSeeded()) {
      await page.evaluate(() => history.back()); await sleep(800);
      await step('lib: פתיחה (אחרי ייבוא)', async () => { await jsClick('#menuBtn'); await sleep(300); await jsClick('#menuLibraryBtn'); await sleep(1200); }, { settle: 1200 });
    }
    await step('lib: מדף → THE SNOWBALL', () => page.click('.lib-seg-b:nth-child(1)'));
    await step('lib: מדף → הספרייה שלי', () => page.click('.lib-seg-b:nth-child(2)'));
    await step('lib: צ\'יפ הכל', () => page.click('.lib-chip:nth-child(2)'));
    await step('lib: צ\'יפ כותב', () => page.click('.lib-chip:nth-child(3)'));
    await step('lib: צ\'יפ מדף', () => page.click('.lib-chip.shelf'));
    await step('lib: אסופה', () => page.click('.col-card >> nth=0'), { expect: '.col-hero' });
    await step('lib: חזור ← מדף', back, { expect: '.col-grid' });
    await step('lib: הכל + גלילה', async () => { await page.click('.lib-chip:nth-child(2)'); await sleep(500); await scrollLib(500); await sleep(300); }, { scroll: true });
    await step('lib: דף ספר', async () => { await page.evaluate(() => { window.__dbgTop = document.querySelector('.lib-root').scrollTop; }); await jsClick('.lib-item'); }, { settle: 1200, expect: '.bk-cta' });   // בלי הגלילה האוטומטית של Playwright — אחרת "הגלילה השמורה" היא שלה
    await step('lib: קריאה', async () => { await page.click('.bk-cta'); await sleep(2500); }, { settle: 1500, expect: '.rd' });
    // החלקת מגע בתוך פריים הקורא (גרירת עכבר = בחירת טקסט, והנגיעה הבאה רק מבטלת אותה; CDP לא ממלא screenX שהמנוע נשען עליו)
    await step('lib: דפדוף (החלקה)', async () => {
      await page.evaluate(async () => {
        const fv = document.querySelector('.rd foliate-view');
        const c = fv && fv.renderer && fv.renderer.getContents ? fv.renderer.getContents() : [];   // ה־shadow root סגור — דרך ה־API הציבורי
        const d = c.length ? c[c.length - 1].doc : null; if (!d) throw new Error('אין פריים');
        const win = d.defaultView, el = d.body;
        const T = (x) => new win.Touch({ identifier: 1, target: el, clientX: x, clientY: 400, screenX: x, screenY: 400, pageX: x, pageY: 400 });
        const ev = (type, x, touches) => el.dispatchEvent(new win.TouchEvent(type, { bubbles: true, cancelable: true, touches, changedTouches: [T(x)], targetTouches: touches }));
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        ev('touchstart', 300, [T(300)]);
        for (let x = 280; x >= 80; x -= 25) { await wait(16); ev('touchmove', x, [T(x)]); }
        await wait(16); ev('touchend', 80, []);
      });
    }, { settle: 900 });
    await step('lib: נגיעה (סרגלים)', () => page.touchscreen.tap(195, 420), { expect: '.rd.chrome' });   // עכבר לא נקלט ב־iframe של הקורא — מגע כמו בטלפון
    // לחיצה אמיתית (לא evaluate): pushState של הגיליון בלי הפעלת משתמש → Chrome מסמן את הרשומה הקודמת "לדילוג" ו"חזור" מדלג עליה
    await step('lib: תוכן עניינים', async () => { await page.click('.rd-topbar .rd-ic[aria-label="תוכן העניינים"], .rd-topbar .rd-ic[aria-label="Contents"]'); }, { expect: '.lib-veil' });
    await step('lib: חזור ← סגירת גיליון', back, { expect: '.rd:not(:has(.lib-veil))' });
    await step('lib: חזור ← שומר (הודעה)', back, { expect: '.rd' });
    await step('lib: חזור ← דף הספר', back, { settle: 1300, keep: true, expect: '.bk-cta' });
    await step('lib: חזור ← הכל (גלילה שמורה)', back, { settle: 1200, keep: true, expect: '.lib-grid .lib-item' });
    // היעד = הגלילה שהייתה ממש לפני הלחיצה (הדף יכול להיות קצר מ־500 — "הספרייה שלי" עם 6 ספרים)
    await step('lib: בדיקת גלילה שמורה', async () => { const r = await page.evaluate(() => ({ y: document.querySelector('.lib-root').scrollTop, want: window.__dbgTop })); if (!(r.want > 50) || Math.abs(r.y - r.want) > 2) throw new Error('הגלילה לא שוחזרה (' + r.y + ' במקום ' + r.want + ')'); }, { settle: 100 });
    await step('lib: לחיצה ארוכה', async () => { const bx = await page.locator('.lib-item >> nth=1').boundingBox(); await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: bx.x + bx.width / 2, y: bx.y + bx.height / 2 }] }); await sleep(650); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); });
    await step('lib: עריכה', async () => { await page.click('.item-acts .act-edit'); await sleep(900); }, { settle: 1200, expect: '.ed-form' });
    await step('lib: חזור ← מעריכה', back, { expect: '.lib-grid .lib-item' });
    await step('lib: תפריט ⋯', () => page.click('.lib-tr .lib-round:nth-child(2)'), { pre: '.lib-tr', expect: '.lib-veil' });   // הכפתור בראש הדף — הגלילה אליו היא של Playwright
    await step('lib: חזור ← סגירת תפריט', back, { expect: '.lib-root:not(:has(.lib-veil)) .lib-grid' });
    await step('lib: מסך הגיבוי', async () => { await page.click('.lib-bkpill'); await sleep(600); }, { pre: '.lib-bkpill', expect: '.lib-bkpage' });   // v327: הכרטיס הוחלף בבועה בשורת הכותרת
    await step('lib: חזור ← מגיבוי', back, { expect: '.lib-grid .lib-item' });
    await step('lib: חיפוש', async () => { await page.fill('.lib-search input', 'rich'); await sleep(600); }, { cls: 0.5 });   // התוצאות מתחת לשדה מסתדרות מחדש — מותר; השדה עצמו לא זז (v322)
    await step('lib: ניקוי חיפוש', async () => { await page.fill('.lib-search input', ''); await sleep(400); });
    // v323: גיליונות עם רשומת היסטוריה — מיון, Aa, תפריט אסופה (גיליון מתוך גיליון), Escape, רצפים מהירים
    await step('lib: גיליון מיון', () => page.click('.lib-sortbtn'), { pre: '.lib-sortrow', expect: '.lib-veil' });
    await step('lib: חזור ← סוגר את המיון', back, { expect: '.lib-root:not(:has(.lib-veil:not(.out)))' });
    await step('lib: מיון → בחירה', async () => { await page.click('.lib-sortbtn'); await sleep(400); await page.click('.lib-veil .lib-row >> nth=1'); }, { expect: '.lib-root:not(:has(.lib-veil:not(.out)))' });
    await step('lib: מיון → Escape', async () => { await page.click('.lib-sortbtn'); await sleep(400); await page.keyboard.press('Escape'); }, { expect: '.lib-root:not(:has(.lib-veil:not(.out)))' });
    await step('lib: גיליון נפתח ונסגר מהר ×3', async () => { for (let i = 0; i < 3; i++) { await page.click('.lib-sortbtn'); await sleep(120); await page.keyboard.press('Escape'); await sleep(120); } }, { settle: 1200, expect: '.lib-root:not(:has(.lib-veil:not(.out)))' });
    await step('lib: מדף → אסופה שלי', async () => { await page.click('.lib-chip.shelf'); await sleep(600); await page.click('.col-card.mine >> nth=0'); }, { expect: '.col-hero' });
    await step('lib: תפריט ⋯ של האסופה', () => page.click('.lib-home .lib-top .lib-round'), { pre: '.lib-top', expect: '.lib-veil' });
    await step('lib: שינוי שם (גיליון מתוך גיליון)', () => page.click('.lib-veil .lib-row >> nth=0'), { expect: '.lib-veil .col-in' });
    await step('lib: חזור ← סוגר את שינוי השם', back, { expect: '.col-hero:not(:has(.lib-veil))' });
    await step('lib: חזור ← מדף (2)', back, { expect: '.col-grid' });
    await step('lib: דף ספר + חזור×2 מהר', async () => { await page.click('.lib-chip:nth-child(2)'); await sleep(600); await jsClick('.lib-item'); await sleep(900); await back(); await back(); }, { settle: 1500, expect: '#tab-overview.active' });
    await step('lib: פתיחה מחדש', async () => { await jsClick('#menuBtn'); await sleep(300); await jsClick('#menuLibraryBtn'); await sleep(1500); }, { settle: 1200, expect: '.lib-seg' });
    await step('lib: "מה למדתי"', async () => { await page.click('.lib-seg-b:nth-child(2)'); await sleep(500); await page.click('.lib-tr .lib-round[aria-label="מה למדתי"], .lib-tr .lib-round[aria-label="What I learned"]'); }, { expect: '.learn-sec, .lib-empty' });   // v325: nth=1 היה תפריט ⋯ (גיליון), לא הדף
    await step('lib: חזור ← מהעמוד', back, { expect: '.lib-seg' });
    await step('lib: ספר → קריאה → Aa', async () => { await page.click('.lib-chip:nth-child(2)'); await sleep(500); await jsClick('.lib-item'); await sleep(1000); await page.click('.bk-cta'); await sleep(2500); await page.touchscreen.tap(195, 420); await sleep(400); await page.click('.rd-topbar .rd-aa'); }, { settle: 1200, expect: '.rd .lib-veil, .lib-root .lib-veil' });
    await step('lib: חזור ← סוגר Aa', back, { expect: '.rd' });
    await step('lib: חזור×2 מהר מהקורא', async () => { await back(); await back(); }, { settle: 1500, expect: '.bk-cta' });
    await step('lib: קריאה → ✕ מיד', async () => { await page.click('.bk-cta'); await sleep(300); await page.evaluate(() => { const b = [...document.querySelectorAll('.rd-topbar .rd-ic')].find((x) => /סגירה|Close/.test(x.getAttribute('aria-label') || '')); if (b) b.click(); }); }, { settle: 1500, expect: '.bk-cta' });
    await step('lib: חזור ← הכל (3)', back, { expect: '.lib-grid' });
    await step('lib: רענון בבית הספרייה', () => reload(3000), { settle: 2000 });
    await step('lib: דף ספר (2)', async () => { await page.click('.lib-chip:nth-child(2)'); await sleep(500); await page.click('.lib-item >> nth=0'); }, { settle: 1200 });
    await step('lib: רענון בדף ספר', () => reload(3000), { settle: 2000 });
    await step('lib: קריאה (2)', async () => { await page.click('.bk-cta'); await sleep(2500); }, { settle: 1500 });
    await step('lib: רענון בקורא', () => reload(3500), { settle: 2500 });
    await step('lib: ✕ מהקורא', async () => { await page.evaluate(() => { const b = [...document.querySelectorAll('.rd-topbar .rd-ic')].find((x) => /סגירה|Close/.test(x.getAttribute('aria-label') || '')); if (b) b.click(); }); }, { settle: 1300, keep: true, expect: '.bk-cta' });
    await step('lib: חזור ← בית', back, { expect: '.lib-seg' });
    await step('lib: חזור ← יציאה מהספרייה', back, { settle: 1200, expect: '.tab.active' });
    await step('lib: חזור ← יציאה מהאפליקציה (צפוי)', back, { settle: 600, exitOk: true });
  }

  /* ---------- שלב 3 (v324): מחוות, טפסים ושמירה, דליפות, שינוי גודל/מקלדת, סימון בקורא, ערכת קורא, קישור עמוק ---------- */
  if (ONLY === 'ext' || !ONLY) {
    const swipe = async (x1, y1, x2, y2, steps = 8, ms = 160) => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x1, y: y1 }] });
      for (let i = 1; i <= steps; i++) { await sleep(ms / steps); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x1 + (x2 - x1) * i / steps, y: y1 + (y2 - y1) * i / steps }] }); }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    const activeTab = () => page.evaluate(() => (document.querySelector('.tabpage.active') || {}).id || '');
    const showChrome = async () => { for (let i = 0; i < 3; i++) { if (await page.$('.rd.chrome')) return; await page.touchscreen.tap(195, 420); await sleep(450); } };
    const swipeY = () => page.evaluate(() => {   // נקודה בתוך העמוד הפעיל שלא חסומה להחלקה (קנבס, קלט, פס גלילה אופקי)
      const blocked = (el) => { if (!el || !el.closest) return true; if (el.closest('canvas, .sc-ov, input, textarea, select, .wl-tabs, .item-acts, .no-swipe')) return true; for (let e = el; e && e.tagName !== 'MAIN'; e = e.parentElement) { if (e.scrollWidth > e.clientWidth + 2) { const ox = getComputedStyle(e).overflowX; if (ox === 'auto' || ox === 'scroll') return true; } } return false; };
      for (let y = 140; y < innerHeight - 40; y += 24) { const el = document.elementFromPoint(innerWidth / 2, y); if (el && el.closest('main') && !blocked(el)) return y; }
      return 300;
    });
    const nodes = () => page.evaluate(() => document.querySelectorAll('*').length);
    const W = WIDTH;
    const L = LANG === 'en' ? W : 0, R = LANG === 'en' ? 0 : W;   // "הבא" = מהצד L לצד R (ב־RTL משמאל לימין, באנגלית הפוך)
    const nx = (a) => L ? W - a : a;   // נקודה יחסית לכיוון
    if (!page.url().startsWith(BASE)) { await page.goto(BASE + '/index.html', { waitUntil: 'load' }); await sleep(2000); }
    await step('ext: סקירה', () => tapTab('overview'), { scroll: true });
    // מחוות החלקה בין עמודים — לשני הכיוונים
    let before = await activeTab();
    await step('ext: החלקה לעמוד הבא', async () => { const y = await swipeY(); await swipe(nx(30), y, nx(W - 30), y); await sleep(500); const a = await activeTab(); if (a === before) throw new Error('הטאב לא השתנה (' + a + ')'); }, { scroll: true, settle: 900 });
    before = await activeTab();
    await step('ext: החלקה חזרה', async () => { const y = await swipeY(); await swipe(nx(W - 30), y, nx(30), y); await sleep(500); const a = await activeTab(); if (a === before) throw new Error('הטאב לא השתנה (' + a + ')'); }, { scroll: true, settle: 900 });
    await step('ext: החלקה קצרה — לא מחליפה עמוד', async () => { const b = await activeTab(); const y = await swipeY(); await swipe(nx(30), y, nx(90), y); await sleep(500); const a = await activeTab(); if (a !== b) throw new Error('החלקה קצרה החליפה עמוד'); }, { settle: 600 });
    await step('ext: טאב מעקב', () => tapTab('wishlist'), { scroll: true });
    await step('ext: החלקה קצרה במעקב = רשימה אחרת', async () => { const b = await page.evaluate(() => (document.querySelector('#wlTabs .wl-tab.on') || {}).textContent); const y = await swipeY(); await swipe(nx(40), y, nx(40 + Math.min(100, Math.round(W * 0.25))), y); /* 48px–30% מהרוחב = רשימה; ב־320 100px כבר באזור המת */ await sleep(600); const a = await page.evaluate(() => (document.querySelector('#wlTabs .wl-tab.on') || {}).textContent); if (a === b) throw new Error('הרשימה לא התחלפה'); }, { settle: 900 });
    await step('ext: החלקה ארוכה במעקב = עמוד אחר', async () => { const y = await swipeY(); await swipe(nx(30), y, nx(W - 20), y); await sleep(500); const a = await activeTab(); if (a === 'tab-wishlist') throw new Error('נשארנו במעקב'); }, { scroll: true, settle: 900 });
    // טפסים ושמירה אחרי רענון
    await step('ext: טאב הפקדות + מצב עריכה', async () => { await tapTab('deposits'); await sleep(500); await page.click('#editDepositsBtn'); }, { scroll: true, expect: '#depositList .chip-btn' });
    const depN = await page.evaluate(() => DEPOSITS.length);
    await step('ext: הוספת הפקדה (טופס)', async () => { await page.click('#depositList .chip-btn'); await sleep(300); await page.evaluate(() => { const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }; set('da-date', '2026-09-01'); set('da-amt', '1234'); set('da-place', 'QA'); }); await jsClick('#da-save'); }, { pre: '#depositList .chip-btn', expect: '#depositList', cls: 0.5 });
    await step('ext: ההפקדה נוספה ונשמרה אחרי רענון', async () => { await reload(); const n = await page.evaluate(() => DEPOSITS.length); if (n !== depN + 1) throw new Error('הפקדות: ' + n + ' במקום ' + (depN + 1)); }, { settle: 1500 });
    await step('ext: טאב מניות + מצב עריכה', async () => { await tapTab('stocks'); await sleep(500); await page.click('#editStocksBtn'); }, { scroll: true, expect: '#stockList .add-card' });
    const stN = await page.evaluate(() => DB.positions.length);
    await step('ext: הוספת מניה (טופס)', async () => { await page.click('#stockList .add-card'); await sleep(400); await page.evaluate(() => { const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }; set('ap-sym', 'PEP'); set('ap-full', 'PepsiCo'); set('ap-shares', '3'); set('ap-avg', '60'); }); await jsClick('#ap-save'); }, { pre: '#stockList .add-card', cls: 0.5, expect: '#stockList .stock[data-sym="PEP"]' });   // מילוי בלי פוקוס — page.fill גולל לשדה
    await step('ext: המניה נשמרה אחרי רענון', async () => { await reload(); const syms = await page.evaluate(() => DB.positions.map((p) => p.sym).join(',')); const n = syms.split(',').length; if (n !== stN + 1) throw new Error('מניות: ' + n + ' במקום ' + (stN + 1) + ' (' + syms + ')'); }, { settle: 1500, expect: '#stockList .stock[data-sym="PEP"]' });
    await step('ext: מחיקת המניה (לחיצה ארוכה → אישור)', async () => { await hold('#stockList .stock[data-sym="PEP"]'); await sleep(400); await page.click('.item-acts .act-del'); await sleep(400); await page.click('.dlg-ok'); }, { pre: '#stockList .stock[data-sym="PEP"]', cls: 0.5, scroll: true, expect: '#stockList:not(:has(.stock[data-sym="PEP"]))' });
    await step('ext: יציאה ממצב עריכה', async () => { await page.evaluate(() => { try { state.edit.stocks = false; state.edit.deposits = false; renderAll(); } catch (e) {} }); }, { settle: 600, cls: 0.5 });
    // לחיצות מהירות
    await step('ext: 6 טאבים מהר', async () => { for (const t of ['trades', 'pension', 'overview', 'deposits', 'stocks', 'wishlist']) { await page.click('.tab[data-tab="' + t + '"]', { force: true }); await sleep(60); } }, { scroll: true, settle: 1400, expect: '#tab-wishlist.active' });
    await step('ext: טאב מניות', () => tapTab('stocks'), { scroll: true });
    await step('ext: כפול מהיר על כרטיס (פתיחה+סגירה)', async () => { await page.click('#stockList .stock >> nth=0 >> .stock-head'); await sleep(90); await page.click('#stockList .stock >> nth=0 >> .stock-head'); }, { scroll: true, settle: 1500, pre: '#stockList .stock >> nth=0' });
    // שינוי גודל חלון עם כרטיס פתוח (סיבוב/חלון מפוצל) — הגרף לא מתחת ל־140
    await step('ext: כרטיס פתוח', async () => { await page.click('#stockList .stock >> nth=0 >> .stock-head'); await sleep(900); }, { scroll: true, settle: 1200, pre: '#stockList .stock >> nth=0', expect: '#stockList .stock.open' });
    await step('ext: הצרה ל־360×780 עם כרטיס פתוח', async () => { await page.setViewportSize({ width: 360, height: 780 }); await sleep(700); const h = await page.evaluate(() => { const c = document.querySelector('.stock.open canvas'); return c ? c.getBoundingClientRect().height : 0; }); if (h < 140) throw new Error('הגרף נמוך מדי: ' + Math.round(h)); }, { cls: 1, scroll: true, settle: 900 });
    await step('ext: הרחבה ל־412×915', async () => { await page.setViewportSize({ width: 412, height: 915 }); await sleep(700); }, { cls: 1, scroll: true, settle: 900, expect: '#stockList .stock.open' });
    await step('ext: חזרה ל־' + W, async () => { await page.setViewportSize({ width: W, height: 844 }); await sleep(500); await page.click('#stockList .stock.open .stock-head'); }, { cls: 1, scroll: true, settle: 1200 });
    // דליפות: לולאות פתיחה/סגירה — מספר הצמתים לא גדל, אין שכבות יתומות
    await step('ext: 15× תפריט', async () => { for (let i = 0; i < 15; i++) { await jsClick('#menuBtn'); await sleep(60); await jsClick('#menuBtn'); await sleep(60); } }, { settle: 800, expect: '#menuDrop.hidden' });
    const n0 = await nodes();
    await step('ext: 8× כרטיס פתיחה/סגירה', async () => { for (let i = 0; i < 8; i++) { await page.click('#stockList .stock >> nth=0 >> .stock-head'); await sleep(700); await page.click('#stockList .stock >> nth=0 >> .stock-head'); await sleep(700); } }, { scroll: true, settle: 1200, pre: '#stockList .stock >> nth=0' });
    await step('ext: 6× ספרייה פתיחה/סגירה', async () => { for (let i = 0; i < 6; i++) { await jsClick('#menuBtn'); await sleep(250); await jsClick('#menuLibraryBtn'); await sleep(1200); await back(); await sleep(700); } }, { settle: 1200, expect: 'body:not(:has(.lib-root))' });
    await step('ext: בדיקת דליפות', async () => { const n1 = await nodes(); const left = await page.evaluate(() => document.querySelectorAll('.lib-root, .rd, .lib-veil, .dlg-veil, .item-acts, #wlSheetVeil, #earnCalVeil').length); if (left) throw new Error('שכבות יתומות: ' + left); if (n1 > n0 + 60) throw new Error('צמתים: ' + n0 + ' → ' + n1); }, { settle: 100 });
    // שפה ומטבע
    await step('ext: הגדרות → English', async () => { await jsClick('#menuBtn'); await sleep(300); await jsClick('#langBtn'); await sleep(700); await page.click('#langEn'); }, { cls: 1, scroll: true, settle: 1500, pre: '#langEn' });
    await step('ext: חזרה לעברית', () => page.click('#langHe'), { cls: 1, scroll: true, settle: 1500, pre: '#langHe' });
    await step('ext: מטבע ₪ ואז $', async () => { await page.click('#curToggleBtn'); await sleep(500); await page.click('#curToggleBtn'); }, { cls: 0.5, settle: 900 });
    await step('ext: חזור ← סקירה', back, { scroll: true, expect: '#tab-overview.active' });
    // קישור עמוק מהווידג׳ט
    await step('ext: קישור עמוק #stock=AAPL', async () => { await page.goto(BASE + '/index.html#stock=AAPL', { waitUntil: 'load' }); await sleep(3500); }, { scroll: true, settle: 1500, expect: '#tab-stocks.active #stockList .stock.open[data-sym="AAPL"]' });
    await step('ext: חזור אחרי קישור עמוק', back, { settle: 1200, exitOk: true });
    if (!page.url().startsWith(BASE)) { await page.goto(BASE + '/index.html', { waitUntil: 'load' }); await sleep(2000); }
    // הקורא: סימון טקסט → בועה → הדגשה; ערכה שחורה שורדת רענון; מקלדת (חלון נמוך) בחיפוש
    if (await ensureLibSeeded()) { await page.evaluate(() => history.back()); await sleep(800); }
    await step('ext: ספרייה → ספר → קריאה', async () => { await jsClick('#menuBtn'); await sleep(300); await jsClick('#menuLibraryBtn'); await sleep(1500); await page.click('.lib-seg-b:nth-child(2)'); await sleep(500); await page.click('.lib-chip:nth-child(2)'); await sleep(500); await jsClick('.lib-item'); await sleep(1000); await page.click('.bk-cta'); await sleep(2500); }, { settle: 1500, expect: '.rd' });
    await step('ext: סימון טקסט → בועה', async () => { await page.evaluate(() => { const fv = document.querySelector('.rd foliate-view'); const c = fv.renderer.getContents(); const d = c[c.length - 1].doc; const p = d.querySelector('p') || d.body; const sel = d.getSelection(); sel.removeAllRanges(); const r = d.createRange(); r.setStart(p.firstChild || p, 0); r.setEnd(p.firstChild || p, Math.min(12, (p.firstChild && p.firstChild.length) || 1)); sel.addRange(r); d.dispatchEvent(new Event('selectionchange')); }); await sleep(800); }, { expect: '.rd-pop' });
    await step('ext: הדגשה בצבע', async () => { await page.click('.rd-pop .rd-dot >> nth=0'); await sleep(600); }, { expect: '.rd:not(:has(.rd-pop))' });
    await step('ext: נגיעה בהדגשה → בועה', async () => { await page.evaluate(() => { const fv = document.querySelector('.rd foliate-view'); const c = fv.renderer.getContents(); const d = c[c.length - 1].doc; const p = d.querySelector('p'); const r = p.getBoundingClientRect(); const fr = d.defaultView.frameElement.getBoundingClientRect(); window.__hl = { x: fr.left + r.left + 20, y: fr.top + r.top + 8 }; }); const pt = await page.evaluate(() => window.__hl); await page.touchscreen.tap(pt.x, pt.y); await sleep(700); }, { expect: '.rd' });
    await step('ext: Escape (בועה אם פתוחה, ואז יציאה)', async () => { if (await page.$('.rd-pop')) { await page.keyboard.press('Escape'); await sleep(300); } await page.keyboard.press('Escape'); }, { settle: 1200, expect: '.bk-cta' });
    await step('ext: קריאה שוב — ההדגשה נשמרה', async () => { await page.click('.bk-cta'); await sleep(2500); const r = await page.evaluate(() => new Promise((res) => { const q = indexedDB.open('snb-library'); q.onsuccess = () => { const t = q.result.transaction('books'); const g = t.objectStore('books').get('id-qa-m6'); g.onsuccess = () => res({ ann: ((g.result || {}).ann || []).filter((a) => !a.d).length, drawn: (() => { try { const fv = document.querySelector('.rd foliate-view'); const c = fv.renderer.getContents(); const d = c[c.length - 1].doc; return d.querySelectorAll('svg *').length; } catch (e) { return -1; } })() }); }; q.onerror = () => res({ ann: -1 }); })); if (!(r.ann > 0)) throw new Error('ההדגשה לא נשמרה (ann=' + r.ann + ', מצוירים=' + r.drawn + ')'); }, { settle: 1200, expect: '.rd' });
    await step('ext: Aa → ערכה שחורה', async () => { await showChrome(); await page.click('.rd-topbar .rd-aa'); await sleep(500); await page.click('.rd-seg button >> nth=2'); await sleep(300); await page.click('.rd-themes button >> nth=3'); await sleep(300); await page.keyboard.press('Escape'); await sleep(300); const bg = await page.evaluate(() => getComputedStyle(document.querySelector('.rd')).backgroundColor); if (!/rgb\(0, 0, 0\)/.test(bg)) throw new Error('רקע: ' + bg); }, { settle: 900, expect: '.rd', flickerOk: true });   // גיליון → החלפת ערכה לבן/שחור → סגירה: שלושה שינויים גדולים בכוונה
    await step('ext: רענון בערכה שחורה', async () => { await reload(3500); const bg = await page.evaluate(() => { const r = document.querySelector('.rd'); return r ? getComputedStyle(r).backgroundColor : 'אין קורא'; }); if (!/rgb\(0, 0, 0\)/.test(bg)) throw new Error('רקע אחרי רענון: ' + bg); }, { settle: 2500, expect: '.rd' });
    await step('ext: חזרה לערכה לבנה', async () => { await showChrome(); await page.click('.rd-topbar .rd-aa'); await sleep(500); await page.click('.rd-seg button >> nth=2'); await sleep(300); await page.click('.rd-themes button >> nth=0'); await sleep(300); await page.keyboard.press('Escape'); }, { settle: 900, expect: '.rd', flickerOk: true });
    await step('ext: ✕ פעמיים מהר — נשארים בדף הספר', async () => { await page.evaluate(() => { const b = [...document.querySelectorAll('.rd-topbar .rd-ic')].find((x) => /סגירה|Close/.test(x.getAttribute('aria-label') || '')); if (b) { b.click(); b.click(); } }); }, { settle: 1500, expect: '.bk-cta' });
    await step('ext: קריאה (3)', async () => { await page.click('.bk-cta'); await sleep(2500); }, { settle: 1200, expect: '.rd' });
    await step('ext: ✕ מהקורא', async () => { await page.evaluate(() => { const b = [...document.querySelectorAll('.rd-topbar .rd-ic')].find((x) => /סגירה|Close/.test(x.getAttribute('aria-label') || '')); if (b) b.click(); }); }, { settle: 1300, expect: '.bk-cta' });
    await step('ext: חזור ← הכל', back, { expect: '.lib-search input' });
    await step('ext: מקלדת (חלון נמוך) בחיפוש', async () => { await page.focus('.lib-search input'); await page.setViewportSize({ width: W, height: 480 }); await sleep(400); await page.keyboard.type('rich'); await sleep(600); }, { cls: 1, scroll: true, settle: 900, expect: '.lib-search input' });
    await step('ext: סגירת המקלדת', async () => { await page.setViewportSize({ width: W, height: 844 }); await page.fill('.lib-search input', ''); }, { cls: 1, scroll: true, settle: 900 });
    await step('ext: חזור ← יציאה מהספרייה', back, { settle: 1200, expect: '.tab.active' });
  }

  /* ---------- שלב 4 (v325): אופליין, דמו, גרפים, דיאלוגי איפוס, IBKR, פנסיה, ספרייה לעומק, עומס, נגישות ---------- */
  if (ONLY === 'ext2' || !ONLY) {
    const W = WIDTH;
    const showChrome = async () => { for (let i = 0; i < 3; i++) { if (await page.$('.rd.chrome')) return; await page.touchscreen.tap(195, 420); await sleep(450); } };
    const twoFinger = async (sel, dx) => { const bx = await page.locator(sel).first().boundingBox(); if (!bx) throw new Error('אין ' + sel); const y = bx.y + bx.height / 2; const a = { x: bx.x + bx.width * 0.3, y }, b = { x: bx.x + bx.width * 0.7, y };
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a] }); await sleep(60); await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a, b] }); await sleep(120);
      for (let i = 1; i <= 4; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [a, { x: b.x + dx * i / 4, y }] }); await sleep(40); }
      await sleep(300); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
    const oneFinger = async (sel) => { const bx = await page.locator(sel).first().boundingBox(); if (!bx) throw new Error('אין ' + sel); const pt = { x: bx.x + bx.width * 0.4, y: bx.y + bx.height / 2 }; await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pt] }); await sleep(250); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: pt.x + 30, y: pt.y }] }); await sleep(250); return pt; };
    const endTouch = () => cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    if (!page.url().startsWith(BASE)) { await page.goto(BASE + '/index.html', { waitUntil: 'load' }); await sleep(2000); }
    // --- נגישות: כל כפתור/קישור נראה עם שם נגיש ---
    const a11y = (where) => step('ext2: נגישות — ' + where, async () => { const bad = await page.evaluate(() => { const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }; const name = (e) => (e.getAttribute('aria-label') || e.getAttribute('title') || e.textContent || '').trim() || (e.querySelector('img[alt]') || {}).alt || (e.getAttribute('aria-labelledby') ? 'x' : ''); return [...document.querySelectorAll('button, a[href], [role=button]')].filter((e) => vis(e) && !name(e)).slice(0, 6).map((e) => e.tagName + (e.id ? '#' + e.id : '') + '.' + String(e.className).split(' ')[0]); }); if (bad.length) throw new Error('כפתורים בלי שם נגיש: ' + bad.join(', ')); }, { settle: 100 });
    await step('ext2: סקירה', () => tapTab('overview'), { scroll: true });
    await a11y('סקירה');
    // --- גרף הביצועים: נגיעה באצבע אחת (בועה) ושתיים (מדידה) ---
    await step('ext2: גרף הביצועים — אצבע אחת', async () => { await oneFinger('#pfChart'); const ok = await page.$('.pf-tip'); const dg = await page.evaluate(() => { const c = document.getElementById('pfChart'); return 'drawn=' + c.classList.contains('drawn') + ' h=' + c.getBoundingClientRect().height + ' tipIdx=' + state.pfTipIdx + ' rows=' + ((state.pfRows || state.perfRows || []).length); }); await endTouch(); if (!ok) throw new Error('אין בועה (' + dg + ')'); }, { pre: '#pfChart', settle: 600 });
    await step('ext2: גרף הביצועים — שתי אצבעות (מדידה)', async () => { await twoFinger('#pfChart', 40); }, { pre: '#pfChart', settle: 600 });
    // --- כרטיס מניה: טווחים, תפריט שנים, נגיעה באצבע אחת ושתיים ---
    await step('ext2: טאב מניות', () => tapTab('stocks'), { scroll: true });
    await step('ext2: כרטיס פתוח', async () => { await page.click('#stockList .stock >> nth=0 >> .stock-head'); await sleep(900); }, { scroll: true, settle: 1200, pre: '#stockList .stock >> nth=0', expect: '#stockList .stock.open' });
    // כפתורי הטווח בתוך כרטיס פתוח — לחיצה דרך DOM (page.click גולל, והכרטיס מצמיד את עצמו לראש → "מלחמת גלילה")
    const rangeClick = (txt) => page.evaluate((t) => { const b = [...document.querySelectorAll('.stock.open .range-btn')].find((x) => x.textContent.trim().replace(/▾/, '').trim() === t); if (!b) throw new Error('אין טווח ' + t); b.click(); }, txt);
    for (const r of ['1D', '5D', '1M', '3M', 'YTD']) await step('ext2: טווח ' + r, () => rangeClick(r), { settle: 900, cls: 0.1, scroll: true });
    await step('ext2: תפריט שנים → 3Y', async () => { await rangeClick('1Y'); await sleep(400); const ok = await page.evaluate(() => { const o = [...document.querySelectorAll('.stock.open button, .range-pop button')].find((x) => /^3Y$/.test(x.textContent.trim())); if (o) { o.click(); return true; } return false; }); if (!ok) await page.keyboard.press('Escape'); }, { settle: 1200, cls: 0.1, scroll: true });
    await step('ext2: גרף המניה — אצבע אחת', async () => { await oneFinger('.stock.open canvas'); const ok = await page.$('.stock.open .sc-tip'); const dg = await page.evaluate(() => { const c = document.querySelector('.stock.open canvas'); return 'drawn=' + c.classList.contains('drawn') + ' sc=' + !!c._sc + ' ov=' + !!document.querySelector('.stock.open .sc-ov'); }); await endTouch(); if (!ok) throw new Error('אין בועה (' + dg + ')'); }, { pre: '.stock.open canvas', settle: 600 });
    await step('ext2: גרף המניה — שתי אצבעות', async () => { await twoFinger('.stock.open canvas', 50); }, { pre: '.stock.open canvas', settle: 600 });
    await a11y('כרטיס מניה פתוח');
    await step('ext2: סגירת הכרטיס', async () => { await page.click('#stockList .stock.open .stock-head'); await sleep(900); }, { scroll: true, settle: 1200, pre: '#stockList .stock.open' });
    // --- פנסיה: הוספת קרן, שמירה, רענון ---
    await step('ext2: טאב פנסיה', () => tapTab('pension'), { scroll: true });
    await a11y('פנסיה');
    const fundsN = await page.evaluate(() => (DB.pensionFunds || []).length);
    await step('ext2: הוספת קרן פנסיה', async () => { await page.evaluate(() => { const e = document.getElementById('newFundName'); e.value = 'קרן QA'; e.dispatchEvent(new Event('input', { bubbles: true })); }); await jsClick('#pensionFundAdd'); }, { pre: '#pensionFundAdd', cls: 0.5, expect: '.fund-editor' });
    await step('ext2: שמירת הקרנות + רענון', async () => { await jsClick('#pensionFundsSave'); await sleep(500); await reload(); const n = await page.evaluate(() => (DB.pensionFunds || []).length); if (n !== fundsN + 1) throw new Error('קרנות: ' + n + ' במקום ' + (fundsN + 1)); }, { settle: 1500 });
    // --- הגדרות: דיאלוגי איפוס (ביטול), IBKR — שגיאת חיבור, מתקדמות ---
    await step('ext2: הגדרות', async () => { await jsClick('#menuBtn'); await sleep(300); await jsClick('#langBtn'); }, { settle: 1200, scroll: true, expect: '#tab-settings.active' });
    await a11y('הגדרות');
    for (const id of ['resetManual', 'resetData']) {
      await step('ext2: איפוס → ' + id + ' → חלון אישור → ביטול', async () => { await page.click('#resetOpen'); await sleep(500); await page.click('#' + id); await sleep(500); const d = await page.$('.dlg-veil'); if (!d) throw new Error('אין חלון אישור'); await page.click('.dlg-cancel'); }, { pre: '#resetOpen', settle: 900, expect: 'body:not(:has(.dlg-veil)):has(#resetSheetVeil.hidden)' });
    }
    await step('ext2: IBKR — פרטי חיבור שגויים → שגיאה (לא קריסה)', async () => { await page.evaluate(() => { const d = document.getElementById('ibkrConnDetails'); if (d) d.open = true; const t = document.getElementById('ibkrToken'), q = document.getElementById('ibkrQuery'); t.value = 'qa-token-not-real'; q.value = '123456'; t.dispatchEvent(new Event('input', { bubbles: true })); q.dispatchEvent(new Event('input', { bubbles: true })); }); await jsClick('#ibkrSaveTest'); await sleep(4000); const ok = await page.evaluate(() => { const e = document.getElementById('ibkrErr'); const s = document.getElementById('ibkrStatus'); return (e && !e.classList.contains('hidden') && e.textContent.trim()) || (s && s.textContent.trim()); }); if (!ok) throw new Error('אין הודעת שגיאה/מצב'); }, { pre: '#ibkrSaveTest', settle: 1200, cls: 0.5 });
    await step('ext2: IBKR — ניתוק (ניקוי הפרטים)', async () => { await page.evaluate(() => { try { const b = document.getElementById('ibkrDisconnect'); if (b) b.click(); } catch (e) {} }); await sleep(500); if (await page.$('.dlg-veil')) await page.click('.dlg-ok'); }, { pre: '#ibkrDisconnect', settle: 1200, cls: 0.5 });
    await step('ext2: מתקדמות', () => page.click('#advancedOpen'), { pre: '#advancedOpen', scroll: true, expect: '#tab-advanced.active' });
    await a11y('מתקדמות');
    await step('ext2: חזור ×2 ← סקירה', async () => { await back(); await sleep(600); await back(); }, { settle: 1200, expect: '#tab-overview.active' });
    // --- תיק הדמו: טעינה (אישור), יציאה ---
    await step('ext2: דמו — טעינה מהתפריט', async () => { await jsClick('#menuBtn'); await sleep(300); await jsClick('#menuDemoBtn'); await sleep(600); if (await page.$('.dlg-veil')) await page.click('.dlg-ok'); for (let i = 0; i < 40; i++) { await sleep(1000); if (await page.evaluate(() => isDemoMode())) break; } const on = await page.evaluate(() => isDemoMode()); if (!on) throw new Error('הדמו לא נטען'); }, { gap: 1300, settle: 2500, cls: 1, scroll: true });   // בניית הדמו (demoBuild) היא חישוב סינכרוני אחד מאחורי כרטיס התקדמות — תחת CPU×4 ~1.1 שנ׳ (≈270ms בטלפון); חד־פעמי, מתועד
    await step('ext2: דמו — טאב מניות', () => tapTab('stocks'), { gap: 800, scroll: true, settle: 1500 });   // ציור ראשון של ~90 כרטיסים אחרי הדמו
    await step('ext2: דמו — רענון נשאר בדמו', async () => { await reload(3000); const on = await page.evaluate(() => isDemoMode()); if (!on) throw new Error('הדמו נעלם ברענון'); }, { settle: 2000 });
    await step('ext2: דמו — יציאה', async () => { await jsClick('#menuBtn'); await sleep(300); await jsClick('#menuDemoBtn'); await sleep(600); if (await page.$('.dlg-veil')) await page.click('.dlg-ok'); await sleep(3500); const on = await page.evaluate(() => isDemoMode()); if (on) throw new Error('עדיין בדמו'); const n = await page.evaluate(() => DB.positions.length); if (!n) throw new Error('התיק לא שוחזר'); }, { settle: 2500, cls: 1, scroll: true, exitOk: true });
    if (!page.url().startsWith(BASE)) { await page.goto(BASE + '/index.html', { waitUntil: 'load' }); await sleep(2000); }
    // --- ספרייה לעומק ---
    if (await ensureLibSeeded()) { await page.evaluate(() => history.back()); await sleep(800); }
    await step('ext2: ספרייה מהתפריט', async () => { await jsClick('#menuBtn'); await sleep(300); await jsClick('#menuLibraryBtn'); await sleep(1500); }, { settle: 1200, expect: '.lib-seg' });
    await step('ext2: THE SNOWBALL', () => page.click('.lib-seg-b:nth-child(1)'), { scroll: true });
    await step('ext2: צ\'יפ הכל', () => page.click('.lib-chip:nth-child(2)'), { scroll: true, expect: '.lib-grid .lib-item' });
    await a11y('ספרייה');
    const hidN = await page.evaluate(() => (document.querySelector('.lib-hidden-link') || { textContent: '' }).textContent);
    await step('ext2: הסתרת מכתב (לחיצה ארוכה → X → אישור)', async () => { await hold('.lib-grid .lib-item >> nth=0'); await sleep(400); await page.click('.item-acts .act-del'); await sleep(500); if (await page.$('.dlg-veil')) await page.click('.dlg-ok'); }, { pre: '.lib-grid .lib-item >> nth=0', settle: 1500, cls: 1, expect: '.lib-hidden-link' });
    await step('ext2: שחזור המכתב המוסתר', async () => { await page.click('.lib-hidden-link'); await sleep(500); await page.click('.lib-veil .mini-btn >> nth=0'); await sleep(800); if (await page.$('.lib-veil:not(.out)')) await page.keyboard.press('Escape'); }, { pre: '.lib-hidden-link', settle: 1500, cls: 1 });
    await step('ext2: המכתב חזר', async () => { const t = await page.evaluate(() => (document.querySelector('.lib-hidden-link') || { textContent: '' }).textContent); if (t && t === hidN + 'x') throw new Error('x'); const n = await page.locator('.lib-grid .lib-item').count(); if (n < 9) throw new Error('מכתבים: ' + n); }, { settle: 100 });
    // אריחי האקדמיה (הוגים/מילון/מסלולים) מופיעים ב"הכל" של THE SNOWBALL (לא במדף)
    await step('ext2: הוגים (אריח)', async () => { await page.click('.ac-tile >> nth=0'); }, { pre: '.ac-tiles', settle: 1200, expect: '.lib-root:not(:has(.ac-tiles))' });
    await step('ext2: חזור ← הכל', back, { expect: '.ac-tiles' });
    await step('ext2: מילון (אריח 2)', async () => { await page.click('.ac-tile >> nth=1'); }, { pre: '.ac-tiles', settle: 1200, expect: '.lib-root:not(:has(.ac-tiles))' });
    await step('ext2: חזור ← הכל (2)', back, { expect: '.ac-tiles' });
    // עריכת ספר + שחזור מהקובץ
    await step('ext2: הספרייה שלי → עריכה', async () => { await page.click('.lib-seg-b:nth-child(2)'); await sleep(500); await page.click('.lib-chip:nth-child(2)'); await sleep(500); await hold('.lib-grid .lib-item >> nth=0'); await sleep(400); await page.click('.item-acts .act-edit'); }, { settle: 1200, cls: 1, expect: '.ed-form' });
    await step('ext2: שינוי כותרת ושמירה', async () => { await page.evaluate(() => { const i = document.querySelector('.ed-form .ed-in'); i.value = 'כותרת QA'; i.dispatchEvent(new Event('input', { bubbles: true })); }); await jsClick('.ed-save'); }, { settle: 1500, expect: '.lib-grid' });   // שמירה = "חזור" לדף שממנו נכנסו (הרשת)
    await step('ext2: הכותרת החדשה ברשת', async () => { const t = await page.evaluate(() => document.querySelector('.lib-home').textContent); if (!/כותרת QA/.test(t)) throw new Error('הכותרת לא השתנתה'); }, { settle: 100 });
    await step('ext2: עריכה (2)', async () => { await hold('.lib-grid .lib-item >> nth=0'); await sleep(400); await page.click('.item-acts .act-edit'); }, { pre: '.lib-grid .lib-item >> nth=0', settle: 1200, cls: 1, expect: '.lib-admin-link' });
    // הקישור בתחתית הטופס — page.click גולל אליו בעצמו (נראה כקפיצה 0→919 בלי שום גלילה של האפליקציה; אומת עם stack); pre מרכז אותו לפני המדידה
    await step('ext2: שחזור מהקובץ', async () => { await page.click('.ed-form ~ .lib-admin-link, .lib-home .lib-admin-link'); await sleep(500); if (await page.$('.dlg-veil')) await page.click('.dlg-ok'); }, { pre: '.lib-admin-link', settle: 2500, cls: 1, expect: '.lib-grid' });
    await step('ext2: הכותרת המקורית חזרה', async () => { const t = await page.evaluate(() => document.querySelector('.lib-home').textContent); if (/כותרת QA/.test(t)) throw new Error('הכותרת לא שוחזרה'); }, { settle: 100 });
    // חיפוש בטקסט → קפיצה לקורא
    await step('ext2: חיפוש בטקסט', async () => { await page.focus('.lib-search input'); await page.keyboard.type('פסקה'); await sleep(2500); }, { pre: '.lib-search input', cls: 1, expect: '.ft-row' });   // page.focus גולל לשדה (ב־320 הספרייה הייתה גלולה) — pre לפני המדידה
    await step('ext2: קפיצה לתוצאה', () => page.click('.ft-row >> nth=0'), { pre: '.ft-row', settle: 3000, expect: '.rd' });
    // קורא: תוכן עניינים → פרק, סימנייה, מצב גלילה, גודל גופן
    await step('ext2: תוכן עניינים → פרק 2', async () => { await showChrome(); await page.click('.rd-topbar .rd-ic[aria-label="תוכן העניינים"], .rd-topbar .rd-ic[aria-label="Contents"]'); await sleep(600); const rows = page.locator('.lib-veil .lib-row'); const n = await rows.count(); await rows.nth(Math.min(1, n - 1)).click(); }, { settle: 1500, expect: '.rd:not(:has(.lib-veil:not(.out)))' });
    await step('ext2: סימנייה — הוספה', async () => { await showChrome(); await page.click('.rd-topbar .rd-bm'); }, { settle: 800, expect: '.rd-bm.on' });
    await step('ext2: סימנייה — הסרה', async () => { await showChrome(); await page.click('.rd-topbar .rd-bm'); }, { settle: 800, expect: '.rd-bm:not(.on)' });
    await step('ext2: Aa → מצב גלילה', async () => { await showChrome(); await page.click('.rd-topbar .rd-aa'); await sleep(500); await page.click('.rd-seg button >> nth=1'); await sleep(300); await page.click('.rd-mini-seg button:has-text("גלילה"), .rd-mini-seg button:has-text("Scroll")'); await sleep(800); await page.keyboard.press('Escape'); await sleep(400); const f = await page.evaluate(() => (document.querySelector('.rd foliate-view').renderer || {}).getAttribute ? document.querySelector('.rd foliate-view').renderer.getAttribute('flow') : ''); if (f !== 'scrolled') throw new Error('flow=' + f); }, { settle: 1200, expect: '.rd' });
    await step('ext2: גלילה בתוך הספר', async () => { await page.evaluate(() => { const fv = document.querySelector('.rd foliate-view'); const c = fv.renderer.getContents(); const d = c[c.length - 1].doc; d.defaultView.scrollBy(0, 400); }); }, { settle: 800, expect: '.rd' });
    await step('ext2: Aa → חזרה לעמודים + גופן גדול', async () => { await showChrome(); await page.click('.rd-topbar .rd-aa'); await sleep(500); await page.click('.rd-seg button >> nth=1'); await sleep(300); await page.click('.rd-mini-seg button:has-text("עמודים"), .rd-mini-seg button:has-text("Pages")'); await sleep(600); await page.click('.rd-seg button >> nth=0'); await sleep(300); await page.evaluate(() => { const r = document.querySelector('.rd-range'); r.value = '26'; r.dispatchEvent(new Event('input', { bubbles: true })); }); await sleep(600); await page.evaluate(() => { const r = document.querySelector('.rd-range'); r.value = '19'; r.dispatchEvent(new Event('input', { bubbles: true })); }); await sleep(400); await page.keyboard.press('Escape'); }, { settle: 1200, expect: '.rd' });
    // הקורא נפתח מתוצאת חיפוש בטקסט (לא מדף הספר) — ✕ חוזר לרשת עם החיפוש, לא לדף הספר
    await step('ext2: ✕ ← רשת החיפוש', async () => { await page.evaluate(() => { const b = [...document.querySelectorAll('.rd-topbar .rd-ic')].find((x) => /סגירה|Close/.test(x.getAttribute('aria-label') || '')); if (b) b.click(); }); }, { settle: 1300, expect: '.lib-search input' });
    await step('ext2: ניקוי החיפוש', async () => { await page.fill('.lib-search input', ''); }, { settle: 600, cls: 1 });
    // עומס: עוד 50 ספרים — ציור הבית והחיפוש בזמן סביר
    await step('ext2: ייבוא 50 ספרים נוספים', async () => { const names = []; for (let i = 0; i < 50; i++) names.push('bulk' + i + '.epub'); await page.evaluate(async (names) => { const dt = new DataTransfer(); for (const n of names) { const bl = await (await fetch('/.qa-books/' + n)).blob(); dt.items.add(new File([bl], n, { type: 'application/epub+zip' })); } const inp = document.querySelector('.lib-root input[type=file]'); inp.files = dt.files; inp.dispatchEvent(new Event('change')); }, names); for (let i = 0; i < 60; i++) { await sleep(1000); const n = await page.locator('.lib-grid .lib-item').count(); if (n >= 55) break; } }, { settle: 2000, cls: 1, scroll: true });
    await step('ext2: 56 ספרים — מדף', async () => { const t0 = Date.now(); await page.click('.lib-chip.shelf'); await page.waitForSelector('.col-grid'); const ms = Date.now() - t0; if (ms > 3000) throw new Error('המדף צויר ב־' + ms + 'ms'); }, { settle: 1200 });
    await step('ext2: 56 ספרים — הכל + חיפוש', async () => { await page.click('.lib-chip:nth-child(2)'); await sleep(800); const t0 = Date.now(); await page.focus('.lib-search input'); await page.keyboard.type('bulk4'); await sleep(300); const ms = Date.now() - t0; if (ms > 2500) throw new Error('חיפוש ' + ms + 'ms'); }, { settle: 1200, cls: 1 });
    await step('ext2: ניקוי + יציאה מהספרייה', async () => { await page.fill('.lib-search input', ''); await sleep(300); await back(); }, { settle: 1200, cls: 1, expect: '.tab.active' });
    // --- אופליין: הקשר נפרד עם Service Worker — האפליקציה והספרייה נטענות בלי רשת ---
    {
      const ctx2 = await browser.newContext({ viewport: { width: W, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'allow', hasTouch: true, ignoreHTTPSErrors: true, colorScheme: THEME === 'dark' ? 'dark' : 'light', locale: LANG === 'en' ? 'en-GB' : 'he-IL' });
      await routes(ctx2); await ctx2.addInitScript(INIT);
      await ctx2.addInitScript(({ db, theme, lang }) => { try { if (!localStorage.getItem('__qa_seeded')) { localStorage.setItem('pwa_db_v1', JSON.stringify(db)); localStorage.setItem('pwa_owner_v1', 'local'); localStorage.setItem('pwa_theme_v1', theme); localStorage.setItem('pwa_lang_v1', lang); localStorage.setItem('__qa_seeded', '1'); } } catch (e) {} }, { db: DB, theme: THEME, lang: LANG });
      const page1 = page; const page2 = await ctx2.newPage(); page2.on('pageerror', (e) => errors.push('offline: ' + String(e.message).slice(0, 120)));
      page = page2;
      await step('ext2: אופליין — טעינה + התקנת Service Worker', async () => { await page.goto(BASE + '/index.html', { waitUntil: 'load' }); for (let i = 0; i < 30; i++) { await sleep(500); const ok = await page.evaluate(async () => { try { const r = await navigator.serviceWorker.getRegistration(); if (!r || !r.active) return false; const ks = await caches.keys(); return ks.some((k) => /portfolio-pwa-v/.test(k)); } catch (e) { return false; } }); if (ok) break; } await sleep(2500); }, { settle: 500 });
      await step('ext2: אופליין — ניתוק הרשת ורענון', async () => { await ctx2.setOffline(true); await page.reload({ waitUntil: 'load' }); await sleep(2500); }, { settle: 1500, expect: '.tab.active' });
      await step('ext2: אופליין — טאב מניות', () => page.click('.tab[data-tab="stocks"]'), { scroll: true, expect: '#tab-stocks.active #stockList .stock' });
      await step('ext2: אופליין — הספרייה נפתחת מהמטמון', async () => { await page.evaluate(() => document.getElementById('menuBtn').click()); await sleep(300); await page.evaluate(() => document.getElementById('menuLibraryBtn').click()); await sleep(2500); }, { settle: 1500, expect: '.lib-root .lib-seg' });
      await step('ext2: אופליין — חזור', () => page.goBack().catch(() => {}), { settle: 1200, expect: '.tab.active' });
      await ctx2.setOffline(false);
      await ctx2.close();
      page = page1;
    }
  }

  /* ---------- שלב 5 (v325): מחירים חיים, מצבי סשן, הזרקת כשלים, היסטוריה איטית, ת"א ומדדים, ערכה/שפה בזמן כרטיס/ספרייה, תקציבי ביצועים, צילומי בסיס ---------- */
  if (ONLY === 'ext3' || !ONLY) {
    const snapDir = SNAP ? path.join(SNAP) : ''; if (snapDir) fs.mkdirSync(snapDir, { recursive: true });
    const snapDiffs = [];
    const snap = async (name) => {   // צילום בסיס (--snap <dir>) או השוואה לבסיס (--compare <dir>): שיעור פיקסלים שונים
      const f = name.replace(/[^\w֐-׿-]+/g, '_') + '.png';
      if (snapDir) { await page.screenshot({ path: path.join(snapDir, f) }); return; }
      if (!COMPARE) return;
      const cur = path.join(OUT, 'snap-' + f); await page.screenshot({ path: cur });
      const base = path.join(COMPARE, f); if (!fs.existsSync(base)) { snapDiffs.push(name + ': אין בסיס'); return; }
      let out = '1'; try { out = execFileSync('python3', ['-c', 'import sys\nfrom PIL import Image, ImageChops\na=Image.open(sys.argv[1]).convert("RGB");b=Image.open(sys.argv[2]).convert("RGB")\nif a.size!=b.size: print(1.0); sys.exit()\nd=ImageChops.difference(a,b).convert("L").point(lambda v: 255 if v>24 else 0)\nh=d.histogram(); print(h[255]/(a.size[0]*a.size[1]))', cur, base], { encoding: 'utf8' }); } catch (e) {}
      const ratio = +String(out || '1').trim(); if (ratio > 0.01) snapDiffs.push(name + ': ' + (ratio * 100).toFixed(1) + '%');
    };
    const bannerVisible = () => page.evaluate(() => { const b = document.getElementById('statusBanner'); return !!b && !b.classList.contains('hidden'); });
    if (!page.url().startsWith(BASE)) { await page.goto(BASE + '/index.html', { waitUntil: 'load' }); await sleep(2000); }
    // --- תקציבי ביצועים: טעינה קרה ---
    await step('ext3: ביצועים — טעינה קרה', async () => { await page.goto('about:blank'); await sleep(200); const t0 = Date.now(); await page.goto(BASE + '/index.html', { waitUntil: 'commit' }); await page.waitForSelector('.tab.active', { timeout: 15000 }); const tTab = Date.now() - t0; await page.waitForSelector('#stockList .stock, .cards-3 .stat-value', { timeout: 15000 }); const tData = Date.now() - t0; const nav = await page.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; return n ? Math.round(n.domContentLoadedEventEnd) : -1; }); const budget = CPU > 1 ? 9000 : 3500; if (tData > budget) throw new Error('טעינה ' + tData + 'ms (> ' + budget + '); טאב ' + tTab + 'ms, DOMContentLoaded ' + nav + 'ms'); process.stdout.write('    (טעינה: טאב ' + tTab + 'ms · נתונים ' + tData + 'ms · DCL ' + nav + 'ms)\n'); await sleep(2000); }, { settle: 1500, scroll: true, cls: 1 });
    await snap('סקירה');
    // --- מחירים חיים: 12 שניות במניות עם ספרות מתגלגלות — בלי קפיצות פריסה ---
    await step('ext3: טאב מניות', () => tapTab('stocks'), { scroll: true });
    await step('ext3: 12 שניות מחירים מתגלגלים — בלי קפיצה', async () => { await sleep(12000); }, { settle: 300 });
    // תג הסשן בכרטיס לפי מצב השוק שהסטאב מדווח (--session)
    await step('ext3: תג הסשן (' + SESSION + ')', async () => { const want = { PRE: /מוקדם|Pre/, POST: /מאוחר|After|Post/, OVERNIGHT: /לילי|Overnight|Night/, CLOSED: /סגור|Closed/, REGULAR: null }[SESSION]; const t = await page.evaluate(() => [...document.querySelectorAll('#stockList .stock .stock-ext')].map((e) => e.textContent.trim()).filter(Boolean).join(' | ')); if (want && !want.test(t)) throw new Error('תג: "' + t.slice(0, 80) + '"'); if (!want && /מוקדם|מאוחר|לילי/.test(t)) throw new Error('תג סשן במסחר רגיל: ' + t.slice(0, 80)); }, { settle: 100 });
    await snap('מניות');
    await step('ext3: כרטיס פתוח + 8 שניות מחירים', async () => { await page.click('#stockList .stock >> nth=0 >> .stock-head'); await sleep(1200); }, { scroll: true, settle: 8000, pre: '#stockList .stock >> nth=0', expect: '#stockList .stock.open canvas.drawn' });
    await snap('כרטיס פתוח');
    // --- היסטוריה איטית: כרטיס אחר (ללא נתונים בזיכרון) — "טוען" ואז גרף, בלי קפיצה ---
    await step('ext3: היסטוריה איטית — מעבר לכרטיס אחר', async () => { LIVE.slowHist = true; await page.evaluate(() => { try { state.hist = {}; } catch (e) {} }); await page.click('#stockList .stock >> nth=3 >> .stock-head'); await sleep(3500); LIVE.slowHist = false; }, { scroll: true, settle: 1500, pre: '#stockList .stock >> nth=3', expect: '#stockList .stock.open canvas.drawn' });
    await step('ext3: סגירת הכרטיס', async () => { await page.click('#stockList .stock.open .stock-head'); await sleep(900); }, { scroll: true, settle: 1200, pre: '#stockList .stock.open' });
    // --- הזרקת כשל רשת: הבאנר מופיע ונעלם — ומה זה עושה לפריסה ---
    // כשל בלולאה החיה: המחירים הקיימים נשארים ומסומנים "דיליי"/stale (באנר רק כשאין מחירים בכלל) — ובלי קריסה
    const staleNow = () => page.evaluate(() => !!state.stale || ((document.getElementById('sourceLabel') || {}).textContent || '').includes('דיליי') || (!!document.getElementById('statusBanner') && !document.getElementById('statusBanner').classList.contains('hidden')));
    await step('ext3: כשל מחירים → סימון "דיליי"/stale', async () => { LIVE.fail = true; for (let i = 0; i < 110; i++) { await sleep(500); if (await staleNow()) break; } if (!(await staleNow())) throw new Error('אין סימון stale/דיליי/באנר אחרי 55 שניות'); }, { settle: 800, cls: 1 });
    await snap('באנר כשל');
    await step('ext3: המחירים חזרו → הסימון נעלם', async () => { LIVE.fail = false; for (let i = 0; i < 60; i++) { await sleep(500); if (!(await staleNow())) break; } if (await staleNow()) throw new Error('הסימון נשאר אחרי 30 שניות'); }, { settle: 800, cls: 1 });
    // --- ערכה ושפה בזמן כרטיס פתוח ---
    await step('ext3: כרטיס פתוח', async () => { await page.click('#stockList .stock >> nth=1 >> .stock-head'); await sleep(1000); }, { scroll: true, settle: 1200, pre: '#stockList .stock >> nth=1', expect: '#stockList .stock.open' });
    await step('ext3: ערכה כהה עם כרטיס פתוח', async () => { await page.evaluate(() => { try { setThemeMode(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'); } catch (e) {} }); }, { settle: 1200, cls: 0.5, expect: '#stockList .stock.open canvas.drawn' });
    await step('ext3: ערכה חזרה', async () => { await page.evaluate(() => { try { setThemeMode(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'); } catch (e) {} }); }, { settle: 1200, cls: 0.5 });
    await step('ext3: סגירה', async () => { await page.click('#stockList .stock.open .stock-head'); await sleep(900); }, { scroll: true, settle: 1200, pre: '#stockList .stock.open' });
    // --- מדד ברשימת המעקב (חיפוש מקומי) + מניית ת"א בתיק ---
    await step('ext3: מעקב → הוספת SPX מהחיפוש', async () => { await tapTab('wishlist'); await sleep(700); await page.evaluate(() => { const i = document.getElementById('wlSearchInput'); i.value = 'SPX'; i.dispatchEvent(new Event('input', { bubbles: true })); }); await sleep(900); const ok = await page.evaluate(() => { const r = [...document.querySelectorAll('#wlSearchResults .stock-search-item')].find((x) => /SPX|S&P/.test(x.textContent)); if (r) { r.click(); return true; } return false; }); if (!ok) throw new Error('SPX לא נמצא בחיפוש המקומי'); }, { scroll: true, settle: 1500, cls: 1, expect: '#wishlistList .stock[data-sym="^GSPC"], #wishlistList .stock[data-sym="SPX"]' });
    await step('ext3: SPX מוצג בנקודות', async () => { const t = await page.evaluate(() => (document.querySelector('#wishlistList .stock[data-sym="^GSPC"], #wishlistList .stock[data-sym="SPX"]') || {}).textContent || ''); if (!/נק|pts/.test(t)) throw new Error('בלי "נק׳": ' + t.slice(0, 80)); }, { settle: 100 });
    await step('ext3: הסרת SPX (לחיצה ארוכה → X)', async () => { await hold('#wishlistList .stock[data-sym="^GSPC"], #wishlistList .stock[data-sym="SPX"]'); await sleep(400); await page.click('.item-acts .act-del'); await sleep(400); if (await page.$('.dlg-veil')) await page.click('.dlg-ok'); }, { pre: '#wishlistList .stock[data-sym="^GSPC"], #wishlistList .stock[data-sym="SPX"]', settle: 1200, cls: 1, scroll: true });   // pre על SPX עצמו — הוא אחרון ברשימה, ומרכוז הכרטיס הראשון השאיר אותו מתחת לשורת הטאבים (הנגיעה פספסה)
    await step('ext3: מניות → הוספת TEVA.TA', async () => { await tapTab('stocks'); await sleep(600); await page.evaluate(() => { state.edit.stocks = true; renderStocks(); }); await sleep(400); await page.click('#stockList .add-card'); await sleep(400); await page.evaluate(() => { const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }; set('ap-sym', 'TEVA.TA'); set('ap-full', 'Teva'); set('ap-shares', '10'); set('ap-avg', '1500'); }); await jsClick('#ap-save'); }, { pre: '#stockList', scroll: true, settle: 2500, cls: 1, expect: '#stockList .stock[data-sym="TEVA.TA"]' });
    await step('ext3: TEVA.TA — מחיר באגורות', async () => { for (let i = 0; i < 10; i++) { await sleep(500); const t = await page.evaluate(() => (document.querySelector('#stockList .stock[data-sym="TEVA.TA"] .stock-price') || {}).textContent || ''); if (/אג|ag/.test(t)) return; } throw new Error('המחיר לא באגורות'); }, { settle: 100 });
    await step('ext3: מחיקת TEVA.TA', async () => { await page.evaluate(() => { state.edit.stocks = false; }); await hold('#stockList .stock[data-sym="TEVA.TA"]'); await sleep(400); await page.click('.item-acts .act-del'); await sleep(400); await page.click('.dlg-ok'); }, { pre: '#stockList .stock[data-sym="TEVA.TA"]', settle: 1200, cls: 1, scroll: true, expect: '#stockList:not(:has(.stock[data-sym="TEVA.TA"]))' });
    // --- שפה בזמן שהספרייה פתוחה ---
    if (await ensureLibSeeded()) { await page.evaluate(() => history.back()); await sleep(800); }
    await step('ext3: ספרייה', async () => { await jsClick('#menuBtn'); await sleep(300); await jsClick('#menuLibraryBtn'); await sleep(1500); }, { settle: 1200, expect: '.lib-seg' });
    await snap('ספרייה — מדף');
    await step('ext3: ערכה כהה בספרייה', async () => { await page.evaluate(() => { try { setThemeMode('dark'); } catch (e) {} }); }, { settle: 1200, cls: 0.5, expect: '.lib-root' });
    await snap('ספרייה — כהה');
    await step('ext3: ערכה בהירה בספרייה', async () => { await page.evaluate(() => { try { setThemeMode('light'); } catch (e) {} }); }, { settle: 1200, cls: 0.5, expect: '.lib-root' });
    await step('ext3: יציאה מהספרייה', back, { settle: 1200, expect: '.tab.active' });
    await step('ext3: ביצועים — פתיחת כרטיס < 1200ms', async () => { await tapTab('stocks'); await sleep(800); const t0 = Date.now(); await page.click('#stockList .stock >> nth=1 >> .stock-head'); await page.waitForSelector('#stockList .stock.open canvas.drawn', { timeout: 8000 }); const ms = Date.now() - t0; if (ms > (CPU > 1 ? 3500 : 1200)) throw new Error('פתיחת כרטיס ' + ms + 'ms'); process.stdout.write('    (פתיחת כרטיס עם גרף: ' + ms + 'ms)\n'); }, { scroll: true, settle: 1200, cls: 0.5, pre: '#stockList .stock >> nth=1' });
    await step('ext3: סגירה (2)', async () => { await page.click('#stockList .stock.open .stock-head'); await sleep(900); }, { scroll: true, settle: 1200, pre: '#stockList .stock.open' });   // לחיצה אמיתית — לחיצה סינתטית לא נחשבת "קלט אחרון" וכל אנימציית הסגירה נספרת כקפיצה
    if (snapDiffs.length) results.push({ name: 'ext3: השוואה לצילומי הבסיס', ms: 0, cls: 0, clsMax: 0, shifts: [], longTasks: [], frameGaps: [], scrollJumps: [], heightChanges: 0, flash: 0, maxDiff: 0, frames: 0, flicker: 0, exited: false, err: 'שינוי חזותי: ' + snapDiffs.join(' · '), bad: true });
  }

  /* ---------- שלב 6 (v325, --only ext4): טפסים לעומק, רשימות מעקב, סקירה במגע, מטבע, לחץ מהיר, ספרייה — אסופות/הערה/תרגום/ציטוט, מקלדת ---------- */
  if (ONLY === 'ext4' || !ONLY) {
    const showChrome = async () => { for (let i = 0; i < 3; i++) { if (await page.$('.rd.chrome')) return; await page.touchscreen.tap(195, 420); await sleep(450); } };
    const setVal = (sel, v) => page.evaluate(([q, val]) => { const e = document.querySelector(q); if (!e) throw new Error('אין ' + q); e.value = val; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, [sel, v]);
    const clickText = (sel, re) => page.evaluate(([q, r]) => { const b = [...document.querySelectorAll(q)].find((x) => new RegExp(r).test(x.textContent.trim())); if (!b) throw new Error('אין ' + q + ' ~ ' + r); b.click(); }, [sel, re.source]);
    const selectText = () => page.evaluate(() => { const fv = document.querySelector('.rd foliate-view'); const c = fv.renderer.getContents(); const d = c[c.length - 1].doc; const p = d.querySelector('p') || d.body; const sel = d.getSelection(); sel.removeAllRanges(); const r = d.createRange(); r.setStart(p.firstChild || p, 0); r.setEnd(p.firstChild || p, Math.min(12, (p.firstChild && p.firstChild.length) || 1)); sel.addRange(r); d.dispatchEvent(new Event('selectionchange')); });
    const nodes = () => page.evaluate(() => document.querySelectorAll('*').length);
    await page.goto(BASE + '/index.html', { waitUntil: 'load' }); await sleep(2500);

    // --- מניה "לפי ממוצע": עריכה מהכרטיס ---
    await step('ext4: טאב מניות + כרטיס פתוח', async () => { await tapTab('stocks'); await sleep(600); await page.click('#stockList .stock >> nth=0 >> .stock-head'); await sleep(900); }, { scroll: true, settle: 1200, expect: '#stockList .stock.open' });
    await step('ext4: ערוך (מהכרטיס) → טופס', () => page.click('#stockList .stock.open .stock-edit .chip-btn'), { pre: '#stockList .stock.open .stock-edit', settle: 900, cls: 1, scroll: true, expect: '#ep-shares' });
    await step('ext4: שינוי כמות + שמירה', async () => { const sym = await page.evaluate(() => document.querySelector('#stockList .stock.open').dataset.sym); const before = await page.evaluate((s) => DB.positions.find((p) => p.sym === s).shares, sym); await setVal('#ep-shares', String(before + 1)); await jsClick('#ep-save'); await sleep(700); const after = await page.evaluate((s) => DB.positions.find((p) => p.sym === s).shares, sym); if (after !== before + 1) throw new Error('הכמות לא נשמרה: ' + before + ' → ' + after); }, { settle: 1200, cls: 1, scroll: true, expect: '#stockList .stock' });
    await step('ext4: רענון — הכמות נשמרה', async () => { const s = await page.evaluate(() => JSON.stringify(DB.positions.map((p) => [p.sym, p.shares]))); await reload(2500); const s2 = await page.evaluate(() => JSON.stringify(DB.positions.map((p) => [p.sym, p.shares]))); if (s !== s2) throw new Error('אחרי רענון: ' + s2); }, { scroll: true, settle: 1500, cls: 1, exitOk: true });

    // --- עסקאות ידניות: ולידציה, עריכה, מחיקה ---
    await step('ext4: טאב עסקאות', () => tapTab('trades'), { scroll: true, expect: '#tab-trades.active' });
    await step('ext4: עסקה ידנית — טופס', () => page.click('#addManualTradeBtn'), { pre: '#addManualTradeBtn', settle: 900, cls: 1, expect: '.mt-form' });
    await step('ext4: מכירה בלי אחזקה → שגיאת ולידציה', async () => { await page.click('.mt-form [data-side="SELL"]'); await setVal('.mt-form .mt-sym', 'QAT'); await setVal('.mt-form .mt-qty', '5'); await setVal('.mt-form .mt-price', '10'); await jsClick('.mt-form .mt-save'); }, { pre: '.mt-form .mt-save', settle: 600, cls: 1, expect: '.mt-form .form-err:not(.hidden)' });
    await step('ext4: קנייה נשמרת (פוזיציה לפי עסקאות)', async () => { await page.click('.mt-form [data-side="BUY"]'); await jsClick('.mt-form .mt-save'); await sleep(800); const r = await page.evaluate(() => ({ n: (DB.manualTrades || []).length, pos: !!DB.positions.find((p) => p.sym === 'QAT' && p.fromTrades && p.shares === 5) })); if (r.n !== 1 || !r.pos) throw new Error('עסקה/פוזיציה: ' + JSON.stringify(r)); }, { pre: '.mt-form .mt-save', settle: 1200, cls: 1, scroll: true, expect: '#tradeList .rows > li, #tradeList li' });
    await step('ext4: מכירת יתר → שגיאה', async () => { await page.click('#addManualTradeBtn'); await sleep(400); await page.click('.mt-form [data-side="SELL"]'); await setVal('.mt-form .mt-sym', 'QAT'); await setVal('.mt-form .mt-qty', '10'); await setVal('.mt-form .mt-price', '11'); await jsClick('.mt-form .mt-save'); }, { pre: '#addManualTradeBtn', settle: 600, cls: 1, scroll: true, expect: '.mt-form .form-err:not(.hidden)' });
    await step('ext4: ביטול הטופס', () => jsClick('.mt-form .mt-cancel'), { settle: 600, cls: 1, scroll: true, expect: '#tab-trades:not(:has(.mt-form))' });
    await step('ext4: עריכת העסקה (שורה) → כמות 7', async () => { await page.click('#tradeList .mini-btn:not(.danger) >> nth=0'); await sleep(500); await setVal('.mt-form .mt-qty', '7'); await jsClick('.mt-form .mt-save'); await sleep(800); const q = await page.evaluate(() => (DB.manualTrades[0] || {}).qty); if (q !== 7) throw new Error('כמות אחרי עריכה: ' + q); }, { pre: '#tradeList .mini-btn', settle: 1200, cls: 1, scroll: true, expect: '#tab-trades:not(:has(.mt-form))' });
    await step('ext4: מחיקת העסקה (אישור)', async () => { await page.click('#tradeList .mini-btn.danger >> nth=0'); await sleep(400); await page.click('.dlg-ok'); await sleep(700); const r = await page.evaluate(() => ({ n: (DB.manualTrades || []).length, pos: !!DB.positions.find((p) => p.sym === 'QAT') })); if (r.n !== 0 || r.pos) throw new Error('אחרי מחיקה: ' + JSON.stringify(r)); }, { pre: '#tradeList .mini-btn.danger', settle: 1200, cls: 1, scroll: true, expect: '#tab-trades.active' });

    // --- הפקדות: עריכה ומחיקה בשורה ---
    await step('ext4: טאב הפקדות + עריכה', async () => { await tapTab('deposits'); await sleep(500); await page.click('#editDepositsBtn'); }, { scroll: true, expect: '#depositList .mini-btn' });
    await step('ext4: עריכת הפקדה (שורה) → סכום +1', async () => { const before = await page.evaluate(() => DEPOSITS.length); await page.click('#depositList .mini-btn:not(.danger) >> nth=0'); await sleep(500); const amt = await page.evaluate(() => { const i = document.querySelector('#depositList [id$="-amt"]'); return i ? +i.value : NaN; }); if (!(amt > 0)) throw new Error('שדה סכום: ' + amt); await setVal('#depositList [id$="-amt"]', String(amt + 1)); await jsClick('#depositList [id$="-save"]'); await sleep(700); const n = await page.evaluate(() => DEPOSITS.length); if (n !== before) throw new Error('מספר ההפקדות השתנה: ' + before + ' → ' + n); const saved = await page.evaluate((a) => DEPOSITS.some((d) => Math.abs(d.amount) === a), amt + 1); if (!saved) throw new Error('הסכום החדש לא נשמר'); }, { pre: '#depositList .mini-btn', settle: 1200, cls: 1, scroll: true, expect: '#depositList:not(:has(.form-li))' });
    await step('ext4: מחיקת הפקדה (אישור)', async () => { const before = await page.evaluate(() => DEPOSITS.length); await page.click('#depositList .mini-btn.danger >> nth=0'); await sleep(400); await page.click('.dlg-ok'); await sleep(700); const n = await page.evaluate(() => DEPOSITS.length); if (n !== before - 1) throw new Error('הפקדות: ' + before + ' → ' + n); }, { pre: '#depositList .mini-btn.danger', settle: 1200, cls: 1, scroll: true, expect: '#tab-deposits.active' });
    await step('ext4: יציאה ממצב עריכה (הפקדות)', () => page.click('#editDepositsBtn'), { pre: '#editDepositsBtn', settle: 900, cls: 1, scroll: true, expect: '#depositList:not(:has(.mini-btn))' });

    // --- רשימות מעקב: יצירה, הוספה, מעבר, שינוי שם, מחיקה בלחיצה ארוכה ---
    await step('ext4: מעקב → רשימה חדשה "QA"', async () => { await tapTab('wishlist'); await sleep(600); await page.click('.wl-title-btn'); await sleep(350); await page.click('.wl-pop [data-act="new"]'); await sleep(500); await setVal('#wlNameInp', 'QA'); await page.click('#wlNameOk'); }, { scroll: true, settle: 1200, cls: 1, expect: '.wl-title-txt:has-text("QA")' });
    await step('ext4: הוספת KO לרשימה החדשה', async () => { await page.evaluate(() => { const i = document.getElementById('wlSearchInput'); i.value = 'KO'; i.dispatchEvent(new Event('input', { bubbles: true })); }); await sleep(900); await clickText('#wlSearchResults .stock-search-item', /Coca-Cola/); }, { pre: '#wlSearchInput', scroll: true, settle: 1500, cls: 1, expect: '#wishlistList .stock[data-sym="KO"]' });
    await step('ext4: טאב הרשימה הראשית', () => page.click('#wlTabs .wl-tab:not(.add) >> nth=0'), { pre: '#wlTabs', settle: 1000, cls: 1, scroll: true, expect: '#tab-wishlist:not(:has(.wl-title-txt:has-text("QA")))' });
    await step('ext4: חזרה לרשימת QA', () => clickText('#wlTabs .wl-tab:not(.add)', /QA/), { pre: '#wlTabs', settle: 1000, cls: 1, scroll: true, expect: '.wl-title-txt:has-text("QA")' });
    await step('ext4: שינוי שם → QA2', async () => { await page.click('.wl-title-btn'); await sleep(350); await page.click('.wl-pop [data-act="rename"]'); await sleep(500); await setVal('#wlNameInp', 'QA2'); await page.click('#wlNameOk'); }, { pre: '.wl-title-btn', settle: 1200, cls: 1, scroll: true, expect: '.wl-title-txt:has-text("QA2")' });
    await step('ext4: לחיצה ארוכה על הטאב → מחיקת הרשימה (אישור)', async () => { const id = await page.evaluate(() => wlActiveId()); await hold('#wlTabs .wl-tab[data-wl="' + id + '"]'); await sleep(400); await page.click('.item-acts .act-del'); await sleep(400); if (await page.$('.dlg-veil')) await page.click('.dlg-ok'); await sleep(600); const left = await page.evaluate(() => (DB.wlExtra || []).some((l) => l.name === 'QA2')); if (left) throw new Error('הרשימה לא נמחקה'); }, { pre: '#wlTabs', settle: 1200, cls: 1, scroll: true, expect: '#tab-wishlist:not(:has(.wl-title-txt:has-text("QA2")))' });
    await step('ext4: רענון — הרשימות נשמרו', async () => { await reload(2500); const r = await page.evaluate(() => ({ extra: (DB.wlExtra || []).length, qa: (DB.wlExtra || []).some((l) => /^QA/.test(l.name)) })); if (r.qa) throw new Error('QA חזרה אחרי רענון: ' + JSON.stringify(r)); }, { scroll: true, settle: 1500, cls: 1, exitOk: true });

    // --- סקירה: עוגה וגרף רווח במגע ---
    await step('ext4: סקירה — נגיעה בעוגה (הרמת פרוסה)', async () => { await tapTab('overview'); await sleep(800); await page.locator('#pieChart').evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' })); await sleep(300); /* מעבר טאב = ראש העמוד (v284) — העוגה שוב מחוץ למסך אחרי ה־pre */ const hit = await page.evaluate(() => { const c = document.getElementById('pieChart'); const g = state.pieGeom; if (!c || !g) return null; const r = c.getBoundingClientRect(); const mid = (g.r + g.R) / 2; return { x: r.left + g.cx + mid, y: r.top + g.cy, keys: Object.keys(g) }; }); /* אמצע הטבעת (r פנימי, R חיצוני), מימין למרכז */ if (!hit) throw new Error('אין גאומטריית עוגה'); await page.touchscreen.tap(hit.x, hit.y); await sleep(700); const a = await page.evaluate(() => state.pieActive || null); if (!a) { const d = await page.evaluate(([x, y]) => { const c = document.getElementById('pieChart'); const r = c.getBoundingClientRect(); const e = document.elementFromPoint(x, y); return { hit: pieHitSym(state.pieGeom, x - r.left, y - r.top), el: e && (e.id || e.className), acts: document.querySelectorAll('.item-acts').length, modal: JSON.stringify(history.state) }; }, [hit.x, hit.y]); throw new Error('לא הורמה פרוסה: ' + JSON.stringify(d)); } }, { pre: '#pieChart', settle: 1000, cls: 0.1, scroll: true });
    await step('ext4: נגיעה שנייה — הפרוסה יורדת', async () => { await page.evaluate(() => { state.pieActive = null; pieAnimateLift(null); }); }, { settle: 900, cls: 0.1 });
    await step('ext4: גרף רווח — נגיעה בפס', async () => { if (!(await page.$('#gainBars .gb-row'))) throw new Error('אין פסי רווח'); await page.click('#gainBars .gb-row >> nth=0'); await sleep(500); }, { pre: '#gainBars', settle: 1000, cls: 0.1, scroll: true, expect: '#gainBars .gb-row.active' });
    await step('ext4: גרף רווח — נגיעה בחוץ מורידה', async () => { await page.evaluate(() => document.body.click()); }, { pre: '#gainBars', settle: 800, cls: 0.1, expect: '#gainBars:not(:has(.gb-row.active))' });

    // --- מטבע ₪ בכל המסכים ---
    await step('ext4: מטבע → ₪', async () => { await jsClick('#menuBtn'); await sleep(300); await jsClick('#langBtn'); await sleep(700); await page.click('#curILS'); }, { pre: '#curILS', cls: 1, scroll: true, settle: 1200 });
    await step('ext4: ₪ בסקירה ובמניות', async () => { await tapTab('overview'); await sleep(700); const ov = await page.evaluate(() => document.querySelector('.cards-3').textContent); if (!/₪/.test(ov)) throw new Error('סקירה בלי ₪: ' + ov.slice(0, 60)); await tapTab('stocks'); await sleep(700); const st = await page.evaluate(() => document.querySelector('#stockList').textContent); if (!/₪/.test(st)) throw new Error('מניות בלי ₪'); }, { scroll: true, settle: 800, cls: 1 });
    await step('ext4: מטבע → $', async () => { await jsClick('#menuBtn'); await sleep(300); await jsClick('#langBtn'); await sleep(700); await page.click('#curUSD'); await sleep(400); await tapTab('overview'); await sleep(600); const ov = await page.evaluate(() => document.querySelector('.cards-3').textContent); if (!/\$/.test(ov)) throw new Error('סקירה בלי $'); }, { pre: '#curUSD', cls: 1, scroll: true, settle: 1200 });

    // --- לחץ מהיר ויציבות ---
    await step('ext4: 20 טאבים ב־80ms', async () => { const order = ['stocks', 'trades', 'deposits', 'pension', 'wishlist', 'overview']; for (let i = 0; i < 20; i++) { await page.evaluate((t) => document.querySelector('.tab[data-tab="' + t + '"]').click(), order[i % order.length]); await sleep(80); } await sleep(900); const r = await page.evaluate(() => ({ active: document.querySelectorAll('.tabpage.active').length, acts: document.querySelectorAll('.item-acts').length, anims: document.getAnimations().filter((a) => a.playState === 'running').length })); if (r.active !== 1 || r.acts) throw new Error('מצב אחרי לחץ: ' + JSON.stringify(r)); }, { scroll: true, settle: 1200, cls: 1, flickerOk: true, gap: 600 });
    await step('ext4: כרטיס פתוח + 10 שניות חיים — צמתי DOM יציבים', async () => { await tapTab('stocks'); await sleep(700); await page.click('#stockList .stock >> nth=1 >> .stock-head'); await sleep(1200); const n0 = await nodes(); await sleep(10000); const n1 = await nodes(); if (Math.abs(n1 - n0) > 40) throw new Error('צמתים: ' + n0 + ' → ' + n1); }, { scroll: true, settle: 1200, cls: 1, pre: '#stockList .stock >> nth=1', expect: '#stockList .stock.open' });
    await step('ext4: סגירה', () => page.click('#stockList .stock.open .stock-head'), { scroll: true, settle: 1200, cls: 1 });

    // --- ספרייה: אסופות, הערה, תרגום (סטאב), ציטוט, "מה למדתי" ---
    await step('ext4: ספרייה → הספרייה שלי → הכל', async () => { await jsClick('#menuBtn'); await sleep(300); await jsClick('#menuLibraryBtn'); await sleep(1500); await ensureLibSeeded(); if (!(await page.$('.lib-root'))) { await jsClick('#menuBtn'); await sleep(300); await jsClick('#menuLibraryBtn'); await sleep(1500); } await page.click('.lib-seg-b:nth-child(2)'); await sleep(500); await page.click('.lib-chip:nth-child(2)'); await sleep(500); }, { settle: 1500, cls: 1, scroll: true, expect: '.lib-grid .lib-item' });
    await step('ext4: לחיצה ארוכה → אסופה חדשה "אסופת QA"', async () => { await hold('.lib-grid .lib-item >> nth=0'); await sleep(400); await page.click('.item-acts .act-coll'); await sleep(700); await page.click('.lib-veil .lib-row.act'); await sleep(700); await setVal('.lib-veil .col-in', 'אסופת QA'); await page.click('.lib-veil .bk-cta'); await sleep(900); }, { pre: '.lib-grid .lib-item >> nth=0', settle: 1500, cls: 1, scroll: true, expect: '.lib-root:not(:has(.lib-veil:not(.out)))' });
    await step('ext4: מדף — האסופה מופיעה', () => page.click('.lib-chip:nth-child(1)'), { pre: '.lib-chip:nth-child(1)', settle: 1500, cls: 1, scroll: true, expect: '.col-card.mine:has-text("אסופת QA")' });
    await step('ext4: דף האסופה', () => clickText('.col-card.mine', /אסופת QA/), { pre: '.col-card.mine', settle: 1500, cls: 1, scroll: true, expect: '.col-hero' });
    await step('ext4: ⋯ → מחיקת האסופה (אישור)', async () => { await page.click('.lib-top .lib-round'); await sleep(600); await page.click('.lib-veil .lib-row.danger'); await sleep(600); if (await page.$('.dlg-veil')) await page.click('.dlg-ok'); await sleep(900); const left = await page.evaluate(() => !![...document.querySelectorAll('.col-card')].find((c) => /אסופת QA/.test(c.textContent))); if (left) throw new Error('האסופה עדיין מוצגת'); }, { pre: '.lib-top .lib-round', settle: 1500, cls: 1, scroll: true, expect: '.lib-root:not(:has(.col-hero))' });
    await step('ext4: הכל → ספר → קריאה', async () => { await page.click('.lib-chip:nth-child(2)'); await sleep(500); await jsClick('.lib-item'); await sleep(1000); await page.click('.bk-cta'); await sleep(2500); }, { settle: 1500, cls: 1, scroll: true, expect: '.rd' });
    await step('ext4: סימון → הערה (גיליון) → שמירה', async () => { await selectText(); await sleep(800); await clickText('.rd-pop .rd-txt', /^(הערה|Note)$/); await sleep(700); await setVal('.lib-veil .hl-ta', 'הערת QA'); await page.click('.lib-veil .bk-cta'); await sleep(700); const ok = await page.evaluate(() => new Promise((res) => { const q = indexedDB.open('snb-library'); q.onsuccess = () => { const g = q.result.transaction('books').objectStore('books').get('id-qa-m6'); g.onsuccess = () => res(((g.result || {}).ann || []).some((a) => !a.d && a.n === 'הערת QA')); }; q.onerror = () => res(false); })); if (!ok) throw new Error('ההערה לא נשמרה ב־IndexedDB'); }, { settle: 1200, cls: 1, expect: '.rd:not(:has(.lib-veil:not(.out)))' });
    await step('ext4: סימון → תרגום (סטאב) → תוצאה', async () => { await selectText(); await sleep(800); await clickText('.rd-pop .rd-txt', /^(תרגום|Translate)$/); for (let i = 0; i < 20; i++) { await sleep(300); const t = await page.evaluate(() => (document.querySelector('.lib-veil .tr-out') || {}).textContent || ''); if (/תרגום בדיקה/.test(t)) break; } const t = await page.evaluate(() => (document.querySelector('.lib-veil .tr-out') || {}).textContent || ''); if (!/תרגום בדיקה/.test(t)) throw new Error('תרגום: ' + t); }, { settle: 1000, cls: 1, expect: '.lib-veil .tr-out' });
    await step('ext4: Escape סוגר את גיליון התרגום', () => page.keyboard.press('Escape'), { settle: 900, cls: 1, expect: '.rd:not(:has(.lib-veil:not(.out)))' });
    await step('ext4: סימון → ציטוט (כרטיס תמונה)', async () => { await selectText(); await sleep(800); await clickText('.rd-pop .rd-txt', /^(ציטוט|Quote)$/); }, { settle: 2500, cls: 1, expect: '.lib-veil .q-img' });
    await step('ext4: Escape סוגר את הציטוט', () => page.keyboard.press('Escape'), { settle: 900, cls: 1, expect: '.rd:not(:has(.lib-veil:not(.out)))' });
    await step('ext4: ✕ מהקורא', async () => { await page.evaluate(() => { const b = [...document.querySelectorAll('.rd-topbar .rd-ic')].find((x) => /סגירה|Close/.test(x.getAttribute('aria-label') || '')); if (b) b.click(); }); }, { settle: 1300, cls: 1, expect: '.bk-cta' });
    await step('ext4: חזור ← הכל', back, { settle: 1200, cls: 1, expect: '.lib-grid' });
    await step('ext4: "מה למדתי" מציג את ההערה', async () => { await page.click('.lib-tr .lib-round[aria-label="מה למדתי"], .lib-tr .lib-round[aria-label="What I learned"]'); await sleep(900); const t = await page.evaluate(() => (document.querySelector('.lib-home') || {}).textContent || ''); if (!/הערת QA/.test(t)) throw new Error('ההערה לא בדף'); }, { pre: '.lib-tr', settle: 1500, cls: 1, scroll: true, expect: '.learn-sec' });
    await step('ext4: חזור ← הכל (2)', back, { settle: 1200, cls: 1, expect: '.lib-grid' });
    await step('ext4: חזור ← יציאה מהספרייה', back, { settle: 1200, cls: 1, expect: '.tab.active' });

    // --- מקלדת: Tab עד "אפשרויות מתקדמות" ואז Enter ---
    await step('ext4: הגדרות — ניווט במקלדת (Tab) → Enter על "מתקדמות"', async () => { await jsClick('#menuBtn'); await sleep(300); await jsClick('#langBtn'); await sleep(900); await page.evaluate(() => { document.getElementById('advancedOpen').focus(); }); const f = await page.evaluate(() => document.activeElement && document.activeElement.id); if (f !== 'advancedOpen') throw new Error('פוקוס: ' + f); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab'); const f2 = await page.evaluate(() => document.activeElement && document.activeElement.id); if (f2 !== 'advancedOpen') throw new Error('פוקוס אחרי Tab/Shift+Tab: ' + f2); await page.keyboard.press('Enter'); }, { settle: 1200, cls: 1, scroll: true, expect: '#tab-advanced.active' });
    await step('ext4: Escape/חזור ← הגדרות', back, { settle: 1200, cls: 1, scroll: true, expect: '#tab-settings.active' });
    await step('ext4: חזור ← סקירה', back, { settle: 1200, cls: 1, scroll: true, expect: '#tab-overview.active' });
  }

  /* ---------- מצב "קוף": פעולות אקראיות עם בדיקות שלמות אחרי כל אחת ---------- */
  if (MONKEY > 0) {
    let seed = SEED; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const SAFE_SKIP = '.dlg-ok.danger, #resetData, #resetManual, #resetIbkr, .reset-opt, #ibkrDisconnect, #ibkrSync, input[type=file], label:has(input[type=file]), #menuDemoBtn, .lib-row.danger, [data-act="del"], .act-del, .lib-admin-link, .bk-danger, #themeDark, #themeLight, #themeSystem, #langHe, #langEn, #langSystem';
    const pick = () => page.evaluate((skip) => {
      const vis = (e) => { const r = e.getBoundingClientRect(); if (r.width < 8 || r.height < 8 || r.bottom < 0 || r.top > innerHeight) return false; const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.pointerEvents === 'none' || +cs.opacity < .2) return false; const c = document.elementFromPoint(r.left + r.width / 2, Math.min(innerHeight - 1, r.top + r.height / 2)); return !!c && (c === e || e.contains(c) || c.contains(e)); };
      const els = [...document.querySelectorAll('button, .tab, .lib-item, .lib-chip, .col-card, .stock-head, .lib-row, .src-opt, .lib-seg-b, .range-btn, .chip-btn, .lib-round, .bk-cta, .rd-ic, .col-pill, [role=button]')].filter((e) => !e.disabled && !e.closest(skip) && !e.matches(skip) && vis(e));
      if (!els.length) return null;
      const e = els[Math.floor(Math.random() * els.length)]; const r = e.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: Math.min(innerHeight - 2, r.top + r.height / 2), d: (e.tagName + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/)[0] : '') + ' ' + (e.textContent || '').trim().slice(0, 18)).replace(/\s+/g, ' ') };
    }, SAFE_SKIP);
    if (!page.url().startsWith(BASE)) { await page.goto(BASE + '/index.html', { waitUntil: 'load' }); await sleep(2000); }
    for (let i = 1; i <= MONKEY; i++) {
      let r = rnd();
      // "חזור" בשורש (בלי חלון/ספרייה/עמוד משנה) יוצא מהאפליקציה — זו ההתנהגות הנכונה, לא באג; אז במקום זה נוגעים
      const canBack = await page.evaluate(() => { const st = history.state || {}; return !!(st.modal || st.lib || st.snb || st.sheet || (typeof _modals !== 'undefined' && _modals.length)); }).catch(() => false);
      if (r >= 0.62 && r < 0.84 && !canBack) r = 0.3;
      let name, fn;
      if (r < 0.62) { const t = await pick(); if (!t) { name = 'קוף ' + i + ': (אין מה ללחוץ) Escape'; fn = () => page.keyboard.press('Escape'); } else { name = 'קוף ' + i + ': נגיעה ' + t.d; fn = () => page.touchscreen.tap(t.x, t.y); } }
      else if (r < 0.84) { name = 'קוף ' + i + ': חזור'; fn = back; }
      else if (r < 0.92) { const y = Math.floor(rnd() * 900); name = 'קוף ' + i + ': גלילה ' + y; fn = async () => { await page.evaluate((y) => { const r = document.querySelector('.lib-root'); if (r) r.scrollTop = y; else window.scrollTo(0, y); }, y); }; }
      else if (r < 0.96) { name = 'קוף ' + i + ': Escape'; fn = () => page.keyboard.press('Escape'); }
      else { name = 'קוף ' + i + ': רענון'; fn = () => reload(2500); }
      const isScroll = /גלילה|רענון/.test(name);
      await step(name, fn, { settle: 700, scroll: isScroll, cls: /נגיעה|רענון/.test(name) ? 0.5 : 0.02, flickerOk: /רענון/.test(name) });   // רענון: ה־screencast מערבב פריימים של המסמך הישן והחדש (ישן→חדש→ישן) — לא ריצוד של האפליקציה; הרענונים הייעודיים ב־app/lib נבדקים בלי ההקלה
      if (!page.url().startsWith(BASE)) { results[results.length - 1].err = (results[results.length - 1].err || '') + ' [יצא מהאפליקציה]'; results[results.length - 1].bad = true; await page.goto(BASE + '/index.html', { waitUntil: 'load' }); await sleep(2000); }
    }
  }

  const bad = results.filter((r) => r.bad);
  const md = ['# QA תנועה — ' + new Date().toISOString().slice(0, 16) + '  (' + [THEME, WIDTH + 'px', RM ? 'reduced-motion' : '', LANG, CPU > 1 ? 'cpu×' + CPU : '', NET].filter(Boolean).join(' · ') + ')', '',
    '| צעד | CLS | קפיצות גלילה | הבהוב | פריים ארוך | משימות | הערה |', '|---|---|---|---|---|---|---|']
    .concat(results.map((r) => '| ' + (r.bad ? '**' : '') + r.name + (r.bad ? '**' : '') + ' | ' + r.cls + (r.shifts.length ? ' (' + r.shifts[0].src.join(',') + ')' : '') + ' | ' + r.scrollJumps.map((j) => j.el + ' ' + j.from + '→' + j.to).join(', ') + ' | ' + (r.flash || '') + ' | ' + r.frameGaps.join('/') + ' | ' + r.longTasks.filter((x) => x > 80).join('/') + ' | ' + r.err + ' |'))
    .concat(['', '**' + bad.length + ' צעדים בעייתיים מתוך ' + results.length + '**', errors.length ? '\nשגיאות דף: ' + errors.join(' · ') : '']);
  fs.writeFileSync(path.join(OUT, 'report.md'), md.join('\n'));
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ cfg: { THEME, WIDTH, RM, LANG, CPU, NET }, results, errors }, null, 1));
  console.log('\n' + bad.length + ' בעייתיים מתוך ' + results.length + (errors.length ? ' · שגיאות דף: ' + errors.length : '') + ' → ' + path.join(OUT, 'report.md'));
  await browser.close();
  process.exit(bad.length ? 2 : 0);
})().catch((e) => { console.error('QA נכשל:', e); process.exit(1); });
