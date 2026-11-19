#!/usr/bin/env node
/* בדיקת העומק של מכפיל באפט (19/11/2026, docs/buffett-pe-audit.md) — "מה המערכת מחשבת", נתון נתון.
   קורא את הצילומים של השרתון בייצור (tools/fund-deep/snap.js — snap/<SYM>.json) ומריץ עליהם את analysis.js עצמו (ב־vm, כמו
   הבדיקות): prep ← bufCalc ← bpeOf/bfpeOf/isAdj ← הערה בגיליון. לכל רבעון מ־4 הרבעונים — כל רכיב בנפרד (רחוב, GAAP, תגמול,
   מניות, מס, המדיניות וההודעה שנבחרה, הניכוי), כדי שכל ערך ייכנס ליומן האימות בשורה משלו. השורות לפי רבעון מחושבות כאן מאותן
   פונקציות (sbcPol, ctx, nowP) ונבדקות מול הסכומים של bufCalc עצמו — אי־התאמה = שגיאה (agree:false), לא "עבר".
   שימוש:
     node tools/buffett-deep/model.js --snap <dir/snap> --out <file.jsonl> [--syms A,B] [--px 1.05]
       --px — מחיר "חי" מדומה (יחס למחיר של Yahoo), לבדיקת המעבר של המכפיל הצפוי למחיר החי
   הפלט (מספרים ציבוריים) — מחוץ לריפו, בסקראצ'פד. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { loadAnalysis } = require('../fund-deep/snap.js');

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true; };
const D864 = 864e5;
const num = (x) => (x == null || !isFinite(x) ? null : +x);

// הסיבה ל־null — אותו סדר בדיקות כמו ב־bufCalc (analysis.js), כדי שכל "—" יקבל סיבה מתועדת
function nullWhy(A, co) {
  if (!co || !co.q || !co.Q) return 'no-data';
  if (co.fxMix) return 'fxMix';
  if (co.fxNote) return 'fxNote';
  const n = co.q.length, L = n - 1, p = A.periodList(co, 'fy').slice(-1)[0];
  if (n < 4) return 'q<4';
  if (!p) return 'no-period';
  if (Math.abs(Date.parse(co.q[L]) - Date.parse(p.end)) > 5 * D864) return 'last-q-not-now';
  if (!A.qRun(co, L - 3, L)) return 'q-gap';
  const hist = (co.hist || []).filter((x) => x && x.q && x.a != null && isFinite(x.a));
  for (let i = L - 3; i <= L; i++) {
    const e = co.q[i];
    if (!hist.find((x) => Math.abs(Date.parse(x.q) - Date.parse(e)) <= 20 * D864)) return 'no-hist:' + e;
    const g = co.Q.eps ? co.Q.eps[i] : null, sh = co.Q.sh ? co.Q.sh[i] : null;
    if (g == null || !isFinite(g)) return 'no-gaap:' + e;
    if (!(sh > 0)) return 'no-sh:' + e;
  }
  return 'units';
}

// ההודעה שנבחרה לרבעון — אותו כלל כמו sbcPol, כדי לרשום *איזו* הודעה קבעה (התאריך והאורך), לא רק את התוצאה
function polRec(co, e) {
  const L = Array.isArray(co.sbcX) ? co.sbcX : [];
  if (!L.length) return null;
  const t = Date.parse(e), w = L.filter((r) => { const d = (Date.parse(r[0]) - t) / D864; return d > 0 && d <= 100; });
  if (w.length) return { how: 'win', r: w.reduce((a, b) => ((b[3] || 0) > (a[3] || 0) ? b : a)) };
  return { how: 'near45', r: L.reduce((a, b) => (Math.abs(Date.parse(b[0]) - t - 45 * D864) < Math.abs(Date.parse(a[0]) - t - 45 * D864) ? b : a)) };
}

function model(sb, d, mac, fx, pxk) {
  const A = sb.A;
  const q = pxk && d.price > 0 ? { close: d.price * pxk } : null;
  const co = A.indFix(A.prep(d, q, fx), mac);
  const b = A.bufCalc(co);
  const out = {
    sym: d.sym, asOf: d.asOf || null, v: d.v || null, cur: co.cur, pxCur: co.pxCur, fxNote: !!co.fxNote, fxMix: !!co.fxMix,
    pxY: num(co.pxY), px: num(co.price), fpeY: num(d.fpe), fpe: num(co.fpe), fe: num(co.fe),
    sbcX: co.sbcX || null, est1: (co.est || []).find((e) => e.p === '+1y') || null, hist: co.hist || [],
    buf: b ? JSON.parse(JSON.stringify(b)) : null, why: b ? null : nullWhy(A, co),
  };
  const p = A.periodList(co, 'fy').slice(-1)[0];
  out.now = p ? { kind: p.kind, end: p.end } : null;
  if (p) {
    const c = A.ctx(co, p);
    out.ttm = { eps: num(c.eps), sbc: num(c.sbc), rev: num(c.rev), t: num(c.t), pretax: num(A.raw(co, 'pretax', p)), tax: num(A.raw(co, 'tax', p)), sh: num(c.sh) };
  }
  // הערכים שבמסך (metNow — "בדיוק כמו במסך")
  out.tiles = { pe: num(A.metNow(co, 'pe')), fpe: num(A.metNow(co, 'fpe')), bpe: num(A.metNow(co, 'bpe')), bfpe: num(A.metNow(co, 'bfpe')) };
  out.isAdj = !!A.isAdj(co);
  // ההפיכה: מכפיל → מחיר → אותו מכפיל (עריכת המחיר)
  out.inv = {};
  for (const k of ['bpe', 'bfpe']) {
    const m = out.tiles[k];
    if (m > 0) { const px2 = A.pxFrom(co, k, m * 1.1); out.inv[k] = { m11: m * 1.1, px: num(px2), back: px2 ? num(px2 / (k === 'bpe' ? b.eps : b.f.eps)) : null }; }
  }
  if (!b) return out;
  // השורות לפי רבעון — מאותן פונקציות, ובדיקה מול הסכומים של bufCalc
  const n = co.q.length, L = n - 1, hist = (co.hist || []).filter((x) => x && x.q && x.a != null && isFinite(x.a)), t = b.t, rows = [];
  for (let i = L - 3; i <= L; i++) {
    const e = co.q[i], hq = hist.find((x) => Math.abs(Date.parse(x.q) - Date.parse(e)) <= 20 * D864);
    const g = co.Q.eps[i], sh = co.Q.sh[i], sbc = co.Q.sbc ? co.Q.sbc[i] : null, sbAt = sbc > 0 ? sbc * (1 - t) / sh : 0;
    const pol = A.sbcPol(co, e), pr = polRec(co, e);
    rows.push({ e, hq: hq ? { q: hq.q, a: hq.a, est: hq.e } : null, g, sbc, sh, sbAt, pol, polBy: pr ? { how: pr.how, filed: pr.r[0], ex: pr.r[1], fut: pr.r[2], n: pr.r[3] } : null });
  }
  for (const r of rows) r.ded = r.pol === 0 || b.yGaap ? 0 : r.pol === 1 ? r.sbAt : Math.min(Math.max(r.hq.a - r.g, 0), r.sbAt);
  out.rows = rows;
  const sum = (k) => rows.reduce((s, r) => s + (k === 'a' ? r.hq.a : r[k]), 0);
  const close = (x, y) => Math.abs(x - y) <= 1e-9 * Math.max(1, Math.abs(x), Math.abs(y));
  out.agree = close(sum('a'), b.st) && close(sum('g'), b.g) && close(sum('ded'), b.ded) && close(sum('sbAt'), b.sbcAt);
  // ההערה בגיליון (bufSheet)
  const same = Math.abs(b.gap) <= 0.02 * Math.max(Math.abs(b.st), 0.05);
  out.note = same ? 'anBPolGaap' : ({ ex: 'anBPolEx', in: 'anBPolIn', mix: 'anBPolMix' }[b.pol] || 'anBPolUnk');
  out.noteF = b.f ? (b.f.chg ? 'anBFutIn' : out.note) : null;
  out.qL = co.Q.sh[L];
  return out;
}

function main() {
  const snapDir = arg('snap'), outF = arg('out');
  if (!snapDir || !outF) { console.error('שימוש: --snap <dir> --out <file.jsonl>'); process.exit(2); }
  const sb = loadAnalysis();
  const macF = path.join(snapDir, '_macro.json'), mac = fs.existsSync(macF) ? JSON.parse(fs.readFileSync(macF, 'utf8')) : null;
  const fx = +(arg('fx', 0)) || null; // כמו snap.js: שער הדולר־שקל מהאפליקציה; בלעדיו — מניה בת״א בדולרים נשארת fxMix
  let syms = arg('syms') ? String(arg('syms')).split(',') : fs.readdirSync(snapDir).filter((f) => !f.startsWith('_') && f.endsWith('.json')).map((f) => f.slice(0, -5));
  const pxk = arg('px') ? +arg('px') : null, lines = [];
  let bad = 0;
  for (const s of syms.sort()) {
    let d;
    try { d = JSON.parse(fs.readFileSync(path.join(snapDir, s + '.json'), 'utf8')); } catch (e) { continue; }
    if (!d || !d.ok) { lines.push(JSON.stringify({ sym: s, why: 'snap-error', err: d && d.error })); continue; }
    try { const o = model(sb, d, mac, fx, pxk); if (o.buf && !o.agree) bad++; lines.push(JSON.stringify(o)); } catch (e) { bad++; lines.push(JSON.stringify({ sym: s, why: 'model-crash', err: String(e && e.stack || e).slice(0, 400) })); }
  }
  fs.writeFileSync(outF, lines.join('\n') + '\n');
  console.log('חברות: ' + lines.length + ' · אי־התאמה/קריסה: ' + bad);
  process.exit(bad ? 1 : 0);
}

if (require.main === module) main();
module.exports = { model, nullWhy, polRec };
