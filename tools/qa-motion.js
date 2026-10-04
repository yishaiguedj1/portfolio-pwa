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
  const p = PX[sym] || 100;
  const now = Math.floor(Date.now() / 1000), day = now - (now % 86400);
  const ts = [], cl = [];
  for (let i = 0; i < 60; i++) { ts.push(day + 14.5 * 3600 + i * 60); cl.push(p * (1 + Math.sin(i / 7) * 0.004)); }
  return { chart: { result: [{ meta: { currency: sym.endsWith('.TA') ? 'ILA' : 'USD', regularMarketPrice: p, chartPreviousClose: p * 0.991, previousClose: p * 0.991, gmtoffset: -14400, regularMarketTime: ts[ts.length - 1], currentTradingPeriod: { regular: { start: day + 13.5 * 3600, end: day + 20 * 3600 }, pre: { start: day + 8 * 3600, end: day + 13.5 * 3600 }, post: { start: day + 20 * 3600, end: day + 24 * 3600 } }, longName: sym + ' Inc.' }, timestamp: ts, indicators: { quote: [{ close: cl }] } }], error: null }, x: { state: 'CLOSED', reg: { p: p, ch: p * 0.009, pct: 0.9 }, post: { p: p * 1.001, ch: p * 0.001, pct: 0.1, t: now } } };
}
function histJson(syms, range) {
  const out = {};
  const days = range === '1d' || range === '5d' ? 0 : range === 'max' ? 2600 : 1300;
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
  await ctx.route(/\/api\/quotes/, (r) => { const b = JSON.parse(r.request().postData() || '{}'); const data = {}; (b.syms || []).forEach((s) => { data[s] = quoteJson(s); }); setTimeout(() => J(r, { ok: true, data }), NET === 'slow' ? 900 : 40); });
  await ctx.route(/\/api\/history/, (r) => { const b = JSON.parse(r.request().postData() || '{}'); setTimeout(() => J(r, { ok: true, data: histJson(b.syms || [], b.range) }), NET === 'slow' ? 1400 : 60); });
  await ctx.route(/\/api\/wordmark/, (r) => J(r, { ok: true, data: {} }));
  await ctx.route(/\/api\/search/, (r) => J(r, { ok: true, results: [] }));
  await ctx.route(/\/api\/library/, (r) => { const b = JSON.parse(r.request().postData() || '{}'); if (b.op === 'gdConfig') return J(r, { ok: true, configured: false, clientId: '' }); if (b.op === 'me') return J(r, { ok: true, admin: false }); return J(r, { ok: false, error: 'not_configured' }, 503); });
  await ctx.route(/\/api\//, (r) => J(r, { ok: false }, 503));
  await ctx.route(/\/\.qa-books\/(.+)$/, (r) => { const n = decodeURIComponent(r.request().url().split('/.qa-books/')[1]); const f = BOOKS.find((x) => x.name === n); if (!f) return r.fulfill({ status: 404 }); r.fulfill({ status: 200, contentType: 'application/epub+zip', body: f.data }); });
}

/* ---------- מדידה בתוך הדף ---------- */
const INIT = `(() => {
  const M = window.__motion = { steps: [], cur: null, scrollLog: [], touching: 0 };
  const now = () => performance.now();
  M.mark = (name) => { M.flushStep(); M.cur = { name, t0: now(), cls: 0, clsMax: 0, shifts: [], longTasks: [], frameGaps: [], scrollJumps: [], heightChanges: 0 }; };
  M.flushStep = () => { if (M.cur) { M.cur.t1 = now(); M.steps.push(M.cur); M.cur = null; } };
  M.take = () => { M.flushStep(); const s = M.steps; M.steps = []; return s; };
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
      if (Math.abs(jw) > 120 && Math.abs(dW[1]) < 6 && Math.abs(dW[0]) < 6) M.cur.scrollJumps.push({ el: 'window', from: Math.round(lastY), to: Math.round(y), t: Math.round(t - M.cur.t0) });
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
prev = None; out = []
for f in files:
    im = Image.open(f).convert('RGB'); w, h = im.size
    im = im.crop((0, top, w, h)).resize((w // 2, (h - top) // 2))
    px = im.getdata(); n = len(px)
    blank = sum(1 for p in px if abs(p[0]-bg[0]) < 14 and abs(p[1]-bg[1]) < 14 and abs(p[2]-bg[2]) < 14) / n
    diff = 0.0
    if prev is not None:
        d = ImageChops.difference(im, prev).convert('L'); st = ImageStat.Stat(d); diff = st.mean[0]
    out.append({'blank': round(blank, 3), 'diff': round(diff, 2)})
    prev = im
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
    // ריצוד: קפיצה חדה (diff>18) ואז תוך 1–3 מסגרות עוד קפיצה חדה — תוכן שהוחלף פעמיים (ציור מחדש), לא אנימציה רציפה
    if (rows[i].diff > 18 && i + 3 < rows.length) { const nxt = rows.slice(i + 1, i + 4).map((r) => r.diff); if (Math.max(...nxt) > 18 && Math.min(rows[i + 1].diff, rows[i + 2].diff) < 2) flicker++; }
  }
  return { frames: rows.length, flash, flicker, maxDiff: +maxDiff.toFixed(1), blanks: rows.map((r) => r.blank), diffs: rows.map((r) => r.diff) };
}

/* ---------- הרצה ---------- */
// ייצוא לסקריפטי אבחון: require('./qa-motion.js') מחזיר את הקבצים בלי להריץ
if (require.main !== module) { module.exports = { BOOKS, epub, zipStore }; return; }
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
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 160)));
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
    if (opt.pre) { try { await page.locator(opt.pre).first().scrollIntoViewIfNeeded(); await sleep(250); } catch (e) {} }   // הגלילה האוטומטית של Playwright — מחוץ למדידה
    await page.evaluate((x) => { if (window.__motion) window.__motion.expectScroll = !!x; }, !!opt.scroll);
    const bg = await bgOf(), top = await topOf();
    await page.evaluate((n) => window.__motion.mark(n), name);
    await caster.start();
    const t0 = Date.now();
    let err = '';
    try { await fn(); } catch (e) { err = String(e.message).split('\n')[0].slice(0, 120) + ' @' + page.url().slice(BASE.length, BASE.length + 40); }
    await page.waitForTimeout(settle);
    const frames = await caster.stop();
    const exited = !page.url().startsWith(BASE);
    const [m] = exited ? [null] : await page.evaluate(() => window.__motion.take());
    const fr = analyzeFrames(frames, bg, top);
    if (!FRAMES && !opt.keep && !(fr.flash || fr.flicker || (m && m.scrollJumps.length))) frames.forEach((f) => { try { fs.unlinkSync(f.f); } catch (e) {} });
    else { const d = path.join(OUT, 'frames-' + name.replace(/[^\w֐-׿-]+/g, '_')); fs.mkdirSync(d, { recursive: true }); frames.forEach((f, i) => { try { fs.renameSync(f.f, path.join(d, 'f' + String(i).padStart(3, '0') + '.jpg')); } catch (e) {} }); }
    if (!err && opt.expect && !exited) { const okHere = await page.locator(opt.expect).first().count().catch(() => 0); if (!okHere) err = 'לא במקום הצפוי (' + opt.expect + ')'; }
    if (err && !exited) { try { err += ' · מצב: ' + await page.evaluate(() => { if (document.querySelector('.rd')) return 'קורא'; const r = document.querySelector('.lib-root'); if (r) { const on = r.querySelector('.lib-chip.on'); return 'ספרייה/' + (r.querySelector('.bk-cta') ? 'דף' : on ? on.textContent.trim() : (r.querySelector('.lib-large') || {}).textContent); } const t = document.querySelector('.tab.active'); return 'אפליקציה/' + (t ? t.dataset.tab : '?'); }); } catch (e) {} }
    const row = { name, ms: Date.now() - t0 - settle, cls: +(m ? m.cls : 0).toFixed(4), clsMax: +(m ? m.clsMax : 0).toFixed(4), shifts: m ? m.shifts.slice(0, 6) : [], longTasks: m ? m.longTasks : [], frameGaps: m ? m.frameGaps : [], scrollJumps: m ? m.scrollJumps : [], heightChanges: m ? m.heightChanges : 0, flash: fr.flash, maxDiff: fr.maxDiff, frames: fr.frames, flicker: fr.flicker || 0, exited, err, scrollLog: m && m.scrollLog ? m.scrollLog.slice(0, 40) : undefined };
    row.bad = row.cls > (opt.cls == null ? 0.02 : opt.cls) || row.scrollJumps.length > 0 || row.flash > 0 || row.flicker > 0 || row.frameGaps.some((g) => g > 250) || !!row.err || (exited && !opt.exitOk);
    results.push(row);
    if (DBG && row.scrollJumps.length && row.scrollLog) row.scrollLog.forEach((l) => process.stdout.write('    ' + l.join('  ') + '\n'));
    process.stdout.write((row.bad ? '✗ ' : '✓ ') + name + '  cls=' + row.cls + ' gaps=' + row.frameGaps.join('/') + ' jumps=' + row.scrollJumps.length + ' flash=' + row.flash + ' flicker=' + row.flicker + (row.exited ? ' [יצא מהאפליקציה]' : '') + (row.err ? '  ERR ' + row.err : '') + '\n');
  }
  const sleep = (ms) => page.waitForTimeout(ms);
  const tapTab = (t) => page.click('.tab[data-tab="' + t + '"]');
  const jsClick = (sel) => page.evaluate((q) => { const e = document.querySelector(q); if (!e) throw new Error('אין ' + q); e.click(); }, sel);   // בלי הגלילה האוטומטית של Playwright (scrollIntoViewIfNeeded)
  const back = () => page.goBack().catch(() => {});
  const scrollWin = (y) => page.evaluate((y) => window.scrollTo(0, y), y);
  const scrollLib = (y) => page.evaluate((y) => { const r = document.querySelector('.lib-root'); if (r) r.scrollTop = y; }, y);
  const reload = async (st) => { await page.reload({ waitUntil: 'load' }); await sleep(st || 2500); };

  /* ---------- האפליקציה ---------- */
  if (ONLY !== 'lib') {
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
  }

  /* ---------- הספרייה ---------- */
  if (ONLY !== 'app') {
    if (ONLY === 'lib') { await page.goto(BASE + '/index.html', { waitUntil: 'load' }); await sleep(2000); }
    await page.evaluate(() => { localStorage.setItem('pwa_libshelf_v1', 'mine'); });
    if (MAXSTEPS && nSteps >= MAXSTEPS) { /* מכסת צעדים */ }
    await step('lib: פתיחה מהתפריט', async () => { await jsClick('#menuBtn'); await sleep(300); await jsClick('#menuLibraryBtn'); await sleep(1200); }, { settle: 1200 });
    const seeded = await page.evaluate(() => localStorage.getItem('__qa_lib') === '1');
    if (!seeded) {
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
    await step('lib: מסך הגיבוי', async () => { await page.click('.lib-bkrow'); await sleep(600); }, { pre: '.lib-bkrow', expect: '.lib-bkpage' });
    await step('lib: חזור ← מגיבוי', back, { expect: '.lib-grid .lib-item' });
    await step('lib: חיפוש', async () => { await page.fill('.lib-search input', 'rich'); await sleep(600); }, { cls: 0.5 });   // התוצאות מתחת לשדה מסתדרות מחדש — מותר; השדה עצמו לא זז (v322)
    await step('lib: ניקוי חיפוש', async () => { await page.fill('.lib-search input', ''); await sleep(400); });
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
