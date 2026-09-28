#!/usr/bin/env node
/* QA מול Google (v230) — תשואת הטווחים בגרף המניה מול Google Finance, לכל מניה ולכל טווח.
   Google: הסדרה של כל טווח מ־batchexecute (rpcid AiCwsd, חלון 1=1D 2=5D 3=1M 4=6M 5=YTD 6=1Y 7=5Y 8=MAX) —
   הנקודה הראשונה = הבסיס שלהם (ב־YTD המספר שהם מציגים = מסגירת יום המסחר הראשון בשנה, לא מ־31/12).
   אנחנו: הפונקציות של app.js עצמן (stockRangeRows / intraSessionRows / exchangeTodayIso) על נתוני Yahoo.
   שימוש: node tools/qa-google-ranges.js NOW:NYSE AAPL:NASDAQ KO:NYSE TEVA:TLV …
   כלי פיתוח — פונה לרשת, לא ב־CI. להריץ אחרי כל שינוי בחישוב טווחים/תשואות (בקשת המשתמש, 28/09/2026). */
'use strict';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36';
const TOL = 0.15; // נקודות אחוז

/* טהורה: טקסט התשובה של batchexecute → [{ y, m, d, h, mi, p }] */
function googleSeries(text) {
  const body = String(text).replace(/^\)\]\}'\s*/, '');
  const line = body.split('\n').find((l) => l.startsWith('[["wrb.fr"'));
  if (!line) return null;
  const outer = JSON.parse(line);
  const inner = JSON.parse(outer[0][2]);
  const out = [];
  const walk = (a) => {
    if (!Array.isArray(a)) return;
    if (a.length >= 2 && Array.isArray(a[0]) && typeof a[0][0] === 'number' && a[0][0] > 1990 && a[0][0] < 2100 &&
        Array.isArray(a[1]) && typeof a[1][0] === 'number') {
      out.push({ y: a[0][0], m: a[0][1], d: a[0][2], h: a[0][3] || 0, mi: a[0][4] || 0, p: a[1][0] });
      return;
    }
    for (const x of a) walk(x);
  };
  walk(inner);
  return out.length ? out : null;
}
async function google(sym, ex, win) {
  const req = JSON.stringify([[['AiCwsd', JSON.stringify([[[null, [sym, ex]]], win]), null, 'generic']]]);
  const r = await fetch('https://www.google.com/finance/_/GoogleFinanceUi/data/batchexecute?rpcids=AiCwsd&hl=en', {
    method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: 'f.req=' + encodeURIComponent(req) });
  return googleSeries(await r.text());
}
async function yahoo(ysym, q) {
  const r = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(ysym) + '?' + q, { headers: { 'User-Agent': UA } });
  return (await r.json()).chart.result[0];
}
function rowsOf(res, withTime) {
  const off = res.meta.gmtoffset || 0, k = String(res.meta.currency).toUpperCase() === 'ILA' ? 0.01 : 1, out = [];
  (res.timestamp || []).forEach((t, i) => {
    const c = res.indicators.quote[0].close[i];
    if (!(c > 0)) return;
    const iso = new Date((t + off) * 1000).toISOString();
    out.push({ date: iso.slice(0, 10), time: withTime ? iso.slice(11, 16) : null, close: c * k });
  });
  return out;
}

async function main() {
  const vm = require('vm'), fs = require('fs'), path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const sb = { localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    document: { addEventListener() {}, getElementById: () => null, querySelectorAll: () => [], querySelector: () => null, createElement: () => ({ classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {} }) },
    window: {}, navigator: {}, location: {}, AbortController, fetch: () => Promise.reject(new Error('no net')), setTimeout, clearTimeout, console };
  vm.createContext(sb); vm.runInContext(src, sb);
  const A = (k) => vm.runInContext(k, sb);
  const rangeRows = A('stockRangeRows'), sessionRows = A('intraSessionRows'), todayOf = A('exchangeTodayIso');
  let bad = 0, n = 0;
  const line = (ok, a, w, g, o, gb, ob, soft) => {
    n++; if (!ok && !soft) bad++;
    console.log((ok ? 'ok   ' : soft ? '≈    ' : 'BAD  ') + a.padEnd(13) + w.padEnd(5) + 'Google ' + g.toFixed(2).padStart(8) + '%   אצלנו ' + o.toFixed(2).padStart(8) + '%' + (gb ? '   (בסיס: Google ' + gb + ' · אצלנו ' + ob + ')' : ''));
  };
  for (const a of process.argv.slice(2).length ? process.argv.slice(2) : ['NOW:NYSE']) {
    const [sym, ex] = a.split(':');
    const ysym = ex === 'TLV' ? sym + '.TA' : sym.replace('.', '-');
    const daily = rowsOf(await yahoo(ysym, 'interval=1d&period1=0&period2=' + Math.floor(Date.now() / 1000)), false); // כל ההיסטוריה (כמו "מקסימום" באפליקציה)
    const lastClose = daily[daily.length - 1].close;
    const today = todayOf(ysym);
    // 1D: המקור האמיתי של האפליקציה (השרתון: x.reg.pct מ־v7 של Yahoo) מול השינוי היומי שמוצג בדף של Google
    try {
      const html = await (await fetch('https://www.google.com/finance/quote/' + sym + ':' + ex + '?hl=en', { headers: { 'User-Agent': UA } })).text();
      const m = html.match(new RegExp('\\["' + sym.replace('.', '\\.') + '","' + ex + '"\\],"[^"]*",\\d+,"[A-Z]+",\\[(-?[\\d.]+),(-?[\\d.e-]+),(-?[\\d.e-]+)'));
      const pr = await (await fetch('https://ibkr-proxy-wine.vercel.app/api/quotes', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://yishaiguedj1.github.io' }, body: JSON.stringify({ syms: [ysym] }) })).json();
      const x = pr && pr.data && pr.data[ysym] && pr.data[ysym].x;
      if (m && x && x.reg) line(Math.abs(Number(m[3]) - x.reg.pct) < TOL, a, '1D', Number(m[3]), x.reg.pct); // Google כבר באחוזים
      else console.log('--   ' + a.padEnd(13) + '1D  אין נתון (' + (m ? '' : 'Google ') + (x ? '' : 'שרתון') + ')');
    } catch (e) { console.log('--   ' + a.padEnd(13) + '1D  ' + e.message); }
    const g5 = await google(sym, ex, 2);
    // 5D: נרות 30 דקות, הנר הראשון של חמשת ימי המסחר האחרונים
    if (g5) {
      const y30 = await yahoo(ysym, 'interval=30m&range=5d');
      const r30 = rowsOf(y30, true);
      r30.forEach((r, i) => { const oi = y30.timestamp.findIndex((t) => new Date((t + (y30.meta.gmtoffset || 0)) * 1000).toISOString().slice(0, 16) === r.date + 'T' + r.time); r.open = oi >= 0 ? y30.indicators.quote[0].open[oi] * (String(y30.meta.currency).toUpperCase() === 'ILA' ? 0.01 : 1) : null; });
      const intra = sessionRows(r30, '5d', ysym);
      const gRet = (g5[g5.length - 1].p / g5[0].p - 1) * 100, oRet = (lastClose / intra[0].close - 1) * 100;
      /* 5D: הבסיס = מחיר הפתיחה של היום הראשון. Google ו־Yahoo מקבלים את הפתיחה מספקים שונים (NOW: 138.00 מול 136.82),
         ובת״א ל־Google אין את יום שישי (מסחר מ־01/2026) — אז החלון שלהם מתחיל יום אחד קודם. ≈ = הבדל ספק, לא באג. */
      const d5 = Math.abs(gRet - oRet);
      line(d5 < 0.2, a, '5D', gRet, oRet, g5[0].p.toFixed(2), intra[0].close.toFixed(2), d5 < 2);
    }
    for (const [w, win, key] of [['1M', 3, 'month'], ['6M', 4, '6m'], ['YTD', 5, 'ytd'], ['1Y', 6, 'year'], ['5Y', 7, '5y'], ['MAX', 8, 'max']]) {
      const g = await google(sym, ex, win);
      if (!g) { console.log('--   ' + a.padEnd(13) + w + ' Google: אין סדרה'); continue; }
      let gb = g[0];
      if (w === 'YTD') gb = g.find((p) => p.y === g[g.length - 1].y) || gb; // Google מציג YTD מיום המסחר הראשון בשנה
      const ours = rangeRows(daily, key, null, today);
      const ymd = (p) => p.y + '-' + String(p.m).padStart(2, '0') + '-' + String(p.d).padStart(2, '0');
      const gRet = (g[g.length - 1].p / gb.p - 1) * 100, oRet = (lastClose / ours[0].close - 1) * 100;
      // MAX: ל־Google אין היסטוריה לפני 1991 (AAPL/KO/MSFT) — שם הבסיס שונה בכוונה; משווים רק כשהתאריך זהה
      const sameStart = ymd(gb) === ours[0].date;
      // בסיס זהה (תאריך + מחיר; ת״א אצל Google באגורות) = תקין גם כשהמחיר החי נדגם ברגע אחר (בורסה פתוחה)
      const sameBase = sameStart && [1, 100].some((k) => Math.abs(gb.p / (ours[0].close * k) - 1) < 0.001);
      line(w === 'MAX' ? (!sameStart || Math.abs(gRet / oRet - 1) < 0.03) : (Math.abs(gRet - oRet) < TOL || sameBase), a, w + (w === 'MAX' && !sameStart ? '*' : ''), gRet, oRet, ymd(gb) + ' ' + gb.p.toFixed(2), ours[0].date + ' ' + ours[0].close.toFixed(2));
    }
  }
  console.log('\n' + (n - bad) + '/' + n + ' תואמים ל־Google' + (bad ? ' — ' + bad + ' לא תואמים' : '') + '\n* MAX: ל־Google אין נתונים לפני 1991 — אצלנו כל ההיסטוריה (Yahoo)\n≈ 5D: מחיר פתיחה מספק אחר / יום שישי בת״א — הבדל נתונים, לא באג');
  process.exit(bad ? 1 : 0);
}
if (require.main === module) main().catch((e) => { console.error(e); process.exit(2); });
module.exports = { googleSeries };
