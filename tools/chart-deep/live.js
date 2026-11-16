#!/usr/bin/env node
/* בדיקת העומק של גרף הנרות — גל 4: הקלטה חיה (docs/chart-deep-audit.md).
   מקליט את מה שהטלפון מקבל בזמן מסחר: מחיר חי מ־/api/quotes (כמו poll ב־chart.js, כל --every שניות)
   וצילומי נרות מהשרתון בקצב של reconcile (תוך־יומי כל 20–30 שנ׳, יומי כל כמה דקות).
   את ההקלטה מריצים אחר כך דרך applyTick/mergeBars של chartlib (livecheck.js) ומשווים לנרות הסופיים.
   הרצה: node tools/chart-deep/live.js --out <dir> --syms AAPL,SPY,BTC-USD --qsyms AAPL,SPY,NVDA,BTC-USD --until 16:15
   (--until בשעון ניו יורק). פלט: <out>/live/quotes.jsonl, <out>/live/candles.jsonl. נתוני שוק ציבוריים בלבד. */
'use strict';
const fs = require('fs');
const path = require('path');

const API = process.env.CHART_DEEP_API || 'https://api.thesnowball.app';
const H = { 'Content-Type': 'application/json', Origin: 'https://invest.thesnowball.app' };
// מרווח בסיס, מורחב, כל כמה שניות, כמה נרות אחרונים לשמור
const PLAN = [['1m', 0, 30, 60], ['1m', 1, 60, 60], ['5m', 0, 60, 40], ['60m', 0, 300, 12], ['1d', 0, 300, 5], ['1wk', 0, 1800, 3], ['1mo', 0, 1800, 3]];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* רק השדות ש־parseQuote (chart.js) קורא — מטא של הסשן הרגיל ו־x (מצב, רגיל, טרום, אחרי, לילי) */
function slimQuote(d) {
  const r = d && d.chart && d.chart.result && d.chart.result[0];
  if (!r) return null;
  const m = r.meta || {}, x = d.x || {};
  const pick = (o) => (o ? { p: o.p, t: o.t } : null);
  return {
    m: { p: m.regularMarketPrice, t: m.regularMarketTime, v: m.regularMarketVolume, cur: m.currency, pc: m.chartPreviousClose || m.previousClose || 0 },
    x: { st: x.state || '', reg: pick(x.reg), pre: pick(x.pre), post: pick(x.post), night: pick(x.night) },
  };
}

async function post(p, body) {
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(API + p, { method: 'POST', headers: H, body: JSON.stringify(body), signal: ctl.signal });
    return { status: r.status, j: await r.json().catch(() => null) };
  } catch (e) { return { status: 0, j: null }; } finally { clearTimeout(to); }
}

function nyHM(ms) {
  const s = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(ms));
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
}

function tailCols(r, n) {
  const k = Math.max(0, r.t.length - n), cut = (a) => (a || []).slice(k);
  return { t: cut(r.t), o: cut(r.o), h: cut(r.h), l: cut(r.l), c: cut(r.c), v: cut(r.v), more: r.more, tz: r.tz };
}

async function main(a) {
  const dir = path.join(a.out, 'live');
  fs.mkdirSync(dir, { recursive: true });
  const qf = path.join(dir, 'quotes.jsonl'), cf = path.join(dir, 'candles.jsonl');
  const [uh, um] = String(a.until || '16:15').split(':').map(Number);
  const until = uh * 60 + um, every = Math.max(1, +a.every || 2) * 1000;
  const last = new Map();
  let nq = 0, nc = 0, errs = 0;
  while (nyHM(Date.now()) < until) {
    const t0 = Date.now();
    const q = await post('/api/quotes', { syms: a.qsyms });
    if (q.j && q.j.ok && q.j.data) {
      const d = {};
      for (const s of Object.keys(q.j.data)) d[s] = slimQuote(q.j.data[s]);
      fs.appendFileSync(qf, JSON.stringify({ at: t0, d }) + '\n');
      nq++;
    } else errs++;
    for (const s of a.syms) for (const [iv, pre, ev, keep] of PLAN) {
      const k = s + iv + pre;
      if (Date.now() - (last.get(k) || 0) < ev * 1000) continue;
      if (pre && /-USD$|=X$|=F$|^\^/.test(s)) continue;   // מורחב — רק למניות
      last.set(k, Date.now());
      const at = Date.now();
      const r = await post('/api/history', { op: 'candles', sym: s, iv, pre: pre ? 1 : 0 });
      if (r.j && r.j.ok) { fs.appendFileSync(cf, JSON.stringify(Object.assign({ at, sym: s, iv, pre }, tailCols(r.j, keep))) + '\n'); nc++; } else errs++;
    }
    if (nq % 150 === 0) console.log(new Date().toISOString(), 'מחירים', nq, 'צילומי נרות', nc, 'שגיאות', errs);
    const wait = every - (Date.now() - t0);
    if (wait > 0) await sleep(wait);
  }
  console.log('סיום', 'מחירים', nq, 'צילומי נרות', nc, 'שגיאות', errs);
}

if (require.main === module) {
  const a = { syms: [], qsyms: [] };
  const v = process.argv.slice(2);
  for (let i = 0; i < v.length; i++) {
    const k = v[i].replace(/^--/, ''), x = v[++i];
    a[k] = /syms$/.test(k) ? x.split(',').filter(Boolean) : x;
  }
  if (!a.out || !a.syms.length) { console.error('שימוש: live.js --out <dir> --syms A,B --qsyms A,B,C [--until 16:15] [--every 2]'); process.exit(2); }
  if (!a.qsyms.length) a.qsyms = a.syms;
  main(a).catch((e) => { console.error(e); process.exit(1); });
}
module.exports = { slimQuote, tailCols, nyHM, PLAN };
