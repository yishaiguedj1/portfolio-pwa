#!/usr/bin/env node
/* בדיקת העומק של גרף הנרות — גל 4: הרצת ההקלטה החיה (live.js) דרך הקוד של הגרף.
   מדמה את הטלפון: נרות הבסיס מהצילום הראשון, כל מחיר עובר את onQuote (chart.js) → applyTick (chartlib),
   וכל צילום נרות הוא reconcile → mergeBars. בודק:
   • איפוס (resetData): הנר האחרון שעל המסך לא קיים בנתונים אחרי הרענון — קפיצה של כל הגרף (chart.js pushLive).
   • תיקון ברענון: כמה הנר החי (שנבנה מהמחירים) זז כשהנתונים מהשרתון מחליפים אותו — מחיר ונפח.
   • הנר הסופי: נר שנסגר בזמן ההקלטה — הפתיחה/גבוה/נמוך/סגירה/נפח כפי שנבנו חי, מול הצילום האחרון.
   • הנפח החי: סכום ההפרשים של נפח היום (dayVol) בכל נר מול נפח הנר בשרתון.
   הרצה: node tools/chart-deep/livecheck.js --out <dir> [--syms AAPL,SPY] → <out>/live/check.json + שורת סיכום לכל סדרה. */
'use strict';
const fs = require('fs');
const path = require('path');
const { loadLib } = require('./model.js');

const BASESEC = { '1m': 60, '2m': 120, '5m': 300, '15m': 900, '30m': 1800, '60m': 3600, '1d': 86400, '1wk': 604800, '1mo': 2592000 };   // chart.js:989

/* chart.js:189 — היסט אזור הזמן ומפתח היום */
function tzOffset(tz, ms) {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(new Date(ms));
  const g = (t) => +p.find((x) => x.type === t).value;
  return Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute')) - Math.floor(ms / 60000) * 60000;
}
const dayKeyFor = (tz) => (ms) => Math.floor((ms + tzOffset(tz, ms)) / 86400000);

/* chart.js:1207 parseQuote — על הרשומה המצומצמת של live.js */
function parseQuote(d) {
  if (!d) return null;
  const m = d.m || {}, x = d.x || {}, st = String(x.st || '').toUpperCase();
  const k = String(m.cur || '').toUpperCase() === 'ILA' ? 100 : 1;
  const reg = x.reg || (m.p > 0 ? { p: m.p / k, t: m.t || 0 } : null);
  const ext = st === 'PRE' ? x.pre : st === 'POST' || st === 'POSTPOST' ? x.post : x.night && (st === 'OVERNIGHT' || st === 'CLOSED' || st === 'PREPRE') ? x.night : null;
  const extK = !ext ? '' : ext === x.pre ? 'pre' : ext === x.night ? 'night' : 'post';
  return { st, reg, ext, extK, dayVol: m.v || 0 };
}

/* chart.js:1218 onQuote — רק החלק שנוגע בנרות. מחזיר [סוג, dv] לסטטיסטיקה */
function onQuote(L, c, q) {
  const intra = /m$/.test(c.base), regular = q.st === 'REGULAR';
  let price = 0, time = 0;
  if (regular && q.reg) { price = q.reg.p; time = q.reg.t * 1000; } else if (intra && c.pre && q.ext && q.extK !== 'night') { price = q.ext.p; time = q.ext.t * 1000; } else if (q.reg && q.reg.p > 0 && q.reg.t > 0) {
    const b = c.raw[c.raw.length - 1], t = q.reg.t * 1000, p = q.reg.p;
    if (b && b.timestamp <= t && t <= b.timestamp + BASESEC[c.base] * 1000 && b.close !== p) {
      b.close = p; b.high = Math.max(b.high, p); b.low = Math.min(b.low, p);
      return ['close-fix', 0];
    }
    return ['idle', 0];
  }
  if (!(price > 0) || !(time > 0)) return ['none', 0];
  let dv = 0;
  if (regular && intra) { if (c.lastVol != null && q.dayVol >= c.lastVol) dv = q.dayVol - c.lastVol; c.lastVol = q.dayVol; }
  const r = L.applyTick(c.raw, { price, time, dv, regular, dayVol: q.dayVol }, { sec: BASESEC[c.base], intra, base: c.base, dayKey: dayKeyFor(c.tz) });
  return [r.added ? 'added' : r.changed ? 'tick' : 'skip', dv];
}

const cp = (b) => b && { t: b.timestamp / 1000, o: b.open, h: b.high, l: b.low, c: b.close, v: b.volume };
const rel = (a, b) => (b ? Math.abs(a - b) / Math.abs(b) : 0);
const q = (arr, p) => { if (!arr.length) return null; const s = arr.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };

function simulate(L, quotes, snaps, sym, iv, pre) {
  if (!snaps.length) return null;
  const tz = snaps[0].tz || 'America/New_York';
  const c = { base: iv, pre, tz, raw: L.fromColumns(snaps[0]), lastVol: null };
  const ev = [];
  for (const x of quotes) if (x.at > snaps[0].at && x.d[sym]) ev.push({ at: x.at, q: parseQuote(x.d[sym]) });
  for (const s of snaps.slice(1)) ev.push({ at: s.at, snap: s });
  ev.sort((a, b) => a.at - b.at);
  const st = { kinds: {}, resets: [], fix: { c: [], h: [], l: [], v: [], v0: 0 }, dvByBar: new Map(), liveBars: new Map() };
  for (const e of ev) {
    if (e.q) {
      const [k, dv] = onQuote(L, c, e.q);
      st.kinds[k] = (st.kinds[k] || 0) + 1;
      const last = c.raw[c.raw.length - 1];
      if (last && (k === 'tick' || k === 'added')) {
        st.dvByBar.set(last.timestamp, (st.dvByBar.get(last.timestamp) || 0) + dv);
        st.liveBars.set(last.timestamp, Object.assign(cp(last), { at: e.at, src: k === 'added' || st.liveBars.has(last.timestamp) && st.liveBars.get(last.timestamp).src === 'live' ? 'live' : 'srv' }));
      }
      continue;
    }
    // reconcile
    const before = c.raw[c.raw.length - 1];
    const fresh = L.fromColumns(e.snap);
    if (!fresh.length) continue;
    const merged = L.mergeBars(c.raw, fresh);
    const same = merged.find((b) => b.timestamp === before.timestamp);
    if (!same && before.timestamp > merged[0].timestamp) st.resets.push({ at: e.at, last: before.timestamp / 1000, near: cp(merged.filter((b) => b.timestamp < before.timestamp).pop()) });
    if (same && e.at < before.timestamp + BASESEC[iv] * 1000) {   // הנר החי בזמן הרענון: כמה הוא זז
      st.fix.c.push(rel(before.close, same.close)); st.fix.h.push(rel(before.high, same.high)); st.fix.l.push(rel(before.low, same.low));
      if (same.volume) st.fix.v.push(before.volume / same.volume);
      else if (before.volume > 0) st.fix.v0++;   // C-014: בשרתון לנר החי נפח 0 — עמודת הנפח נמחקת בכל רענון
    }
    c.raw = merged;
  }
  // הנר הסופי: מה שנבנה חי (נר שנפתח מהמחירים) מול הצילום האחרון
  const fin = new Map(c.raw.map((b) => [b.timestamp, b]));
  const lastSnapAt = snaps[snaps.length - 1].at;
  const cmp = { n: 0, o: 0, h: 0, l: 0, c: 0, vr: [], ex: [] };
  for (const [t, lb] of st.liveBars) {
    const f = fin.get(t);
    if (!f || lb.src !== 'live' || t + BASESEC[iv] * 1000 > lastSnapAt - 60000) continue;
    cmp.n++;
    const ok = (a, b) => rel(a, b) <= 0.0005;
    cmp.o += ok(lb.o, f.open); cmp.h += ok(lb.h, f.high); cmp.l += ok(lb.l, f.low); cmp.c += ok(lb.c, f.close);
    if (f.volume) cmp.vr.push(lb.v / f.volume);
    if (!ok(lb.o, f.open) && cmp.ex.length < 4) cmp.ex.push({ t: new Date(t).toISOString().slice(11, 16), live: lb, fin: cp(f) });
  }
  // נפח: סכום dv בכל נר מול הנפח הסופי
  const vr = [];
  for (const [t, dv] of st.dvByBar) { const f = fin.get(t); if (f && f.volume && dv && t + BASESEC[iv] * 1000 < lastSnapAt - 60000) vr.push(dv / f.volume); }
  const med = (a) => (a.length ? +q(a, 0.5).toFixed(4) : null);
  return {
    sym, iv, pre, quotes: ev.filter((e) => e.q).length, snaps: snaps.length, kinds: st.kinds,
    resets: st.resets.length, resetEx: st.resets.slice(0, 4),
    fixAtReconcile: { n: st.fix.c.length, c50: med(st.fix.c), c95: st.fix.c.length ? +q(st.fix.c, 0.95).toFixed(5) : null, h95: st.fix.h.length ? +q(st.fix.h, 0.95).toFixed(5) : null, v50: med(st.fix.v), v95: st.fix.v.length ? +q(st.fix.v, 0.95).toFixed(3) : null, v0: st.fix.v0 },
    final: { n: cmp.n, o: cmp.o, h: cmp.h, l: cmp.l, c: cmp.c, v50: med(cmp.vr), ex: cmp.ex },
    dvVsBar: { n: vr.length, p50: med(vr), p10: vr.length ? +q(vr, 0.1).toFixed(3) : null, p90: vr.length ? +q(vr, 0.9).toFixed(3) : null },
  };
}

function load(out) {
  const dir = path.join(out, 'live');
  const rd = (f) => fs.readFileSync(path.join(dir, f), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  return { quotes: rd('quotes.jsonl'), candles: rd('candles.jsonl') };
}

function main() {
  const argv = process.argv.slice(2);
  const arg = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1]; };
  const out = arg('out');
  if (!out) { console.error('שימוש: livecheck.js --out <dir> [--syms AAPL,SPY]'); process.exit(2); }
  const { L } = loadLib();
  const { quotes, candles } = load(out);
  const want = arg('syms') ? arg('syms').split(',') : null;
  const groups = new Map();
  for (const s of candles) { if (want && !want.includes(s.sym)) continue; const k = s.sym + '|' + s.iv + '|' + s.pre; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(s); }
  const res = [];
  for (const [k, snaps] of groups) {
    const [sym, iv, pre] = k.split('|');
    const r = simulate(L, quotes, snaps, sym, iv, +pre);
    if (!r) continue;
    res.push(r);
    console.log(`${sym.padEnd(8)} ${iv.padEnd(4)} ${pre} מחירים=${r.quotes} צילומים=${r.snaps} | איפוסים=${r.resets} | תיקון ברענון: סגירה50=${r.fixAtReconcile.c50} סגירה95=${r.fixAtReconcile.c95} נפח50=${r.fixAtReconcile.v50} נפח→0=${r.fixAtReconcile.v0} | סופי n=${r.final.n} פ=${r.final.o} ג=${r.final.h} נ=${r.final.l} ס=${r.final.c} נפח50=${r.final.v50} | dv/נר=${r.dvVsBar.p50} (${r.dvVsBar.p10}–${r.dvVsBar.p90})`);
  }
  fs.writeFileSync(path.join(out, 'live', 'check.json'), JSON.stringify(res, null, 1));
}

if (require.main === module) main();
module.exports = { parseQuote, onQuote, simulate, dayKeyFor, BASESEC };
