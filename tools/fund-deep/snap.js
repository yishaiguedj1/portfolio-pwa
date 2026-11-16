#!/usr/bin/env node
/* בדיקת העומק של מנתח החברות (16/11/2026, docs/fund-deep-audit.md) — "מה המשתמש רואה".
   שני שלבים:
   1. צילום: התשובה של השרתון בייצור (op:'fund' לכל חברה, op:'macro' פעם אחת) — בדיוק מה שהטלפון מקבל, כולל המטמון של 12 שעות.
      קצב: עד 6 בקשות בדקה כברירת מחדל (המגבלה של השרתון — 20 לדקה לכתובת; לא מעמיסים על SEC ו־Yahoo מהשרת).
   2. מודל התצוגה: הפונקציות הטהורות של analysis.js (אותו קוד שרץ בטלפון, ב־vm כמו tests/analysis.test.js) מפיקות כל מספר
      שמוצג — בכל לשונית, לכל תקופה (שנים, רבעונים, 12 חודשים), בכל תצוגה (ערך, צמיחה, אחוז מההכנסות), הכרטיסים, המכפילים,
      הבדיקות, מחשבון השווי וההשוואה. הפלט נקרא ב־verify.py (קוד אחר, שפה אחרת) מול המקורות.
   שימוש:
     node tools/fund-deep/snap.js --syms AAPL,MSFT --out <dir>        צילום + מודל
     node tools/fund-deep/snap.js --file <list> --out <dir> [--rate 6] [--refresh]
     node tools/fund-deep/snap.js --disp-only --out <dir>               רק מודל התצוגה מצילומים שכבר נשמרו
   הפלט (מספרים ציבוריים מ־SEC/Yahoo) נשאר מחוץ לריפו — בסקראצ'פד. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const API = 'https://api.thesnowball.app/api/history';
const ORIGIN = 'https://invest.thesnowball.app';
const ROOT = path.join(__dirname, '..', '..');

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true; };

/* ---------- טעינת analysis.js (כמו בבדיקות) ---------- */
function loadAnalysis() {
  const src = fs.readFileSync(path.join(ROOT, 'analysis.js'), 'utf8');
  const sb = { console, Date, Math, JSON };
  vm.createContext(sb);
  vm.runInContext(src.replace(/^export (async )?(function|const)/gm, '$1$2') +
    '\n;globalThis.A = _test; globalThis.__M = M; globalThis.__ROWS = ROWS; globalThis.__LINES = LINES; globalThis.__MULT_SET = MULT_SET; globalThis.__CMP = CMP_MET;' +
    'globalThis.__ctxN = (co) => ctx(co, nowP(co)); globalThis.__keyTiles = (co) => keyTiles(co); globalThis.__multClean = multClean; globalThis.__fyVals = fyVals;' +
    'globalThis.__mval = mval; globalThis.__seriesFor = seriesFor; globalThis.__growthOf = growthOf; globalThis.__multAvg = multAvg; globalThis.__quant = quant; globalThis.__median = median; globalThis.__mean = mean; globalThis.__stdev = stdev;', sb);
  // מחרוזות: המפתח עצמו + המשתנים — המספרים הם מה שנבדק, לא הנוסח
  sb.A.setEnv({ t: (k, v) => (v ? k + ' ' + JSON.stringify(v) : k) });
  return sb;
}

/* ---------- צילום ---------- */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function post(body, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(API, { method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (r.status === 429) { await sleep(65000); continue; }
      const t = await r.text();
      if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + t.slice(0, 200));
      return JSON.parse(t);
    } catch (e) {
      if (i === tries - 1) throw e;
      await sleep(5000 * (i + 1));
    }
  }
  throw new Error('429 חוזר');
}

/* ---------- מודל התצוגה ---------- */
const num = (x) => (x == null || !isFinite(x) ? null : +x);
const strip = (s) => (s == null ? s : String(s).replace(/[⁦⁩]/g, ''));
function display(sb, d, mac, fx) {
  const A = sb.A, M = sb.__M;
  const co = A.indFix(A.prep(d, null, fx), mac);
  const out = { sym: d.sym, v: d.v, asOf: d.asOf, src: d.src, cur: co.cur, pxCur: co.pxCur, fxNote: co.fxNote, fin: co.fin, reit: co.reit,
    price: num(co.price), prev: num(co.prev), sharesOut: num(co.sharesOut), fye: d.fye, ind: co.indName, gone: d.gone || null };
  // התקופות כפי שהמסך מציג (אחרי החיתוך ל־12 שנים)
  const per = { fy: A.periodList(co, 'fy'), q: A.periodList(co, 'q') };
  out.per = { fy: per.fy.map((p) => ({ kind: p.kind, i: p.i, label: p.label, end: p.end })), q: per.q.map((p) => ({ kind: p.kind, i: p.i, label: p.label, end: p.end })) };
  out.raw = { fyE: co.fyE, q: co.q, A: co.A, Q: co.Q, T: co.T || null, C: co.C };
  // כל השדות של ctx — לכל תקופה בשתי הרשימות
  const ctxRow = (p, back, cmp) => { const c = A.ctx(co, p, back || 0, !!cmp); const o = {}; for (const k in c) o[k] = num(c[k]); return o; };
  out.ctx = { fy: per.fy.map((p) => ctxRow(p)), q: per.q.map((p) => ctxRow(p)) };
  // ערך ההשוואה (שנה קודמת, כולל הצגה מחדש באותו דוח) — הבסיס לצמיחה
  out.cmp = { fy: per.fy.map((p) => ctxRow(p, 1, true)), q: per.q.map((p) => ctxRow(p, 1, true)) };
  // שלוש התצוגות בגיליון הגרף, לכל מדד שיש לו כרטיס
  const keys = Object.keys(M);
  const view = (mode, v) => { const o = {}; for (const k of keys) o[k] = per[mode].map((p) => {
    const x = sb.__mval(co, k, p);
    if (v === 'v') return num(x);
    if (v === 'g') { const b = M[k].f ? null : A.ctx(co, p, 1, true)[k]; return x != null && b != null && b > 0 ? num(x / b - 1) : null; }
    const r = A.ctx(co, p).rev; return x != null && r ? num(x / r) : null;
  }); return o; };
  out.views = { fy: { v: view('fy', 'v'), g: view('fy', 'g'), r: view('fy', 'r') }, q: { v: view('q', 'v'), g: view('q', 'g'), r: view('q', 'r') } };
  // הכרטיסים בלשונית "דוחות": הערך הגדול ושני הנתונים — כמו repCard (טווח 10 שנים + 12 חודשים)
  const nowP = per.fy[per.fy.length - 1], fyl = per.fy.filter((p) => p.kind === 'fy');
  const cards = {};
  for (const sub of Object.keys(sb.__ROWS)) cards[sub] = sb.__ROWS[sub].map((r) => {
    if (sb.__LINES[r[0]]) {
      const H = A.multHist(co), k = sb.__LINES[r[0]][1], a = sb.__multClean(H[k].slice(-120), k), ok = a.filter((x) => x != null && isFinite(x));
      const now = H[k].filter((x) => x != null && isFinite(x)).pop();
      return { id: r[0], k, now: num(now), avg10: num(sb.__multAvg(ok)), lo: ok.length ? Math.min(...ok) : null, hi: ok.length ? Math.max(...ok) : null, n: ok.length,
        txt: { now: strip(A.fmt(now, 'x', co, 1)), avg10: strip(A.fmt(sb.__multAvg(ok), 'x', co, 1)) } };
    }
    const s = r.length > 1 ? r[2] : [r[0]];
    return { id: r[0], s: s.map((k) => {
      const m = M[k], last = sb.__mval(co, k, nowP);
      const o = { k, last: num(last), lastTxt: strip(A.fmt(last, m.u === 'num' ? 'num' : m.u, co)), lastLabel: nowP.label };
      if (m.ratio) { const a5 = sb.__mean(fyl.slice(-5).map((p) => sb.__mval(co, k, p))); o.avg5 = num(a5); o.avg5Txt = strip(A.fmt(a5, m.u, co)); }
      else { const [g5, n5] = A.cagrN(co, k, 5); o.cagr5 = num(g5); o.cagrN = n5; o.cagrTxt = strip(A.sgn(g5)); const yoy = m.f ? null : sb.__growthOf(co, nowP, k); o.yoy = num(yoy); o.yoyTxt = strip(A.sgn(yoy)); }
      return o;
    }) };
  });
  out.cards = cards;
  // היסטוריית המכפילים (חודשית) — כל הסדרות, ותקציר לכל מכפיל כמו בכרטיס המכפילים בלשונית השווי
  const H = A.multHist(co);
  out.mult = { t: H.t };
  for (const k of ['pe', 'pfcf', 'pofcf', 'ps', 'evebit', 'pb', 'pffo']) {
    const a = H[k].filter((x) => x > 0 && x < 300);
    out.mult[k] = H[k].map(num);
    out.mult[k + 'Sum'] = a.length ? { now: num(H[k].filter((x) => x != null && isFinite(x)).pop()), mn: Math.min(...a), mx: Math.max(...a), q1: num(sb.__quant(a, 0.25)), q3: num(sb.__quant(a, 0.75)), mean: num(sb.__mean(a)), n: a.length } : null;
  }
  // תמונת מצב: העובדות, ארבעת האריחים, הבדיקות
  const c = sb.__ctxN(co), mcap = co.price * co.sharesOut;
  out.facts = { mcap: num(mcap), pe: c.eps > 0 ? num(co.price / c.eps) : null, fpe: num(co.fpe), fcfYield: c.fcf != null && mcap ? num(c.fcf / mcap) : null, netcash: num(c.netcash),
    txt: { mcap: strip(A.fmt(mcap, 'money', co)), pe: strip(A.fmt(c.eps > 0 ? co.price / c.eps : null, 'x', co, 1)), nc: strip(A.fmt(Math.abs(c.netcash || 0), 'money', co)) } };
  try { out.tiles = sb.__keyTiles(co).map(([k, col, v, hint, hist]) => ({ k, v: strip(v), hint: strip(hint), hist: (hist || []).map(num) })); } catch (e) { out.tiles = { err: String(e) }; }
  try {
    const C = A.checks(co, mac); out.checks = {};
    for (const g in C) out.checks[g] = C[g].chk.map((x) => ({ q: x.q, v: strip(x.v), thr: strip(x.thr), pass: x.pass }));
  } catch (e) { out.checks = { err: String(e) }; }
  try { out.piotroski = A.piotroski(co); } catch (e) { out.piotroski = { err: String(e) }; }
  try { out.altman = A.altman(co); } catch (e) { out.altman = { err: String(e) }; }
  // הדוח האחרון, הבא, התחזיות (כמו שמגיעים מהשרתון — נבדקים מול Nasdaq)
  out.est = d.est || []; out.hist = d.hist || []; out.nextEarn = d.nextEarn || null; out.nq = d.nq || null; out.fpe = num(d.fpe); out.peg = num(d.peg); out.beta = num(d.beta);
  // מחשבון השווי — שני הבסיסים, וההרצה בברירת המחדל
  out.calc = {};
  for (const b of ['ni', 'fcf']) {
    try { const D = A.calcDefaults(co, b); out.calc[b] = { basis: D.basis, mkey: D.mkey, val: D.val, src: D.src, shares: num(D.shares), run: A.calcRun(D.val, D.shares, co.price) }; }
    catch (e) { out.calc[b] = { err: String(e) }; }
  }
  try { out.auto = A.autoInputs(co, mac); } catch (e) { out.auto = { err: String(e) }; }
  try { out.fair = A.fairOf(co, mac); } catch (e) { out.fair = { err: String(e) }; }
  try { out.peerRow = A.peerRow(co); } catch (e) { out.peerRow = { err: String(e) }; }
  out.flags = co.flags || []; out.fill = d.fill || []; out.qfill = d.qfill || {}; out.tags = d.tags || {}; out.face = d.face || null; out.errs = d.errs || [];
  return out;
}

async function main() {
  const outDir = arg('out'); if (!outDir || outDir === true) { console.error('חסר --out'); process.exit(2); }
  const snapDir = path.join(outDir, 'snap'), dispDir = path.join(outDir, 'disp');
  fs.mkdirSync(snapDir, { recursive: true }); fs.mkdirSync(dispDir, { recursive: true });
  let syms = [];
  if (arg('syms')) syms = String(arg('syms')).split(',');
  if (arg('file')) syms = syms.concat(fs.readFileSync(arg('file'), 'utf8').split(/\s+/));
  syms = [...new Set(syms.map((s) => s.trim().toUpperCase()).filter(Boolean))];
  const gap = 60000 / +(arg('rate', 6)), refresh = !!arg('refresh');
  const macF = path.join(snapDir, '_macro.json');
  if (!arg('disp-only') && (refresh || !fs.existsSync(macF))) fs.writeFileSync(macF, JSON.stringify(await post({ op: 'macro' })));
  const mac = fs.existsSync(macF) ? JSON.parse(fs.readFileSync(macF, 'utf8')) : null;
  const fx = +(arg('fx', 0)) || null;
  if (arg('disp-only') && !syms.length) syms = fs.readdirSync(snapDir).filter((f) => !f.startsWith('_') && f.endsWith('.json')).map((f) => f.slice(0, -5));
  const sb = loadAnalysis();
  const errs = [];
  let n = 0, last = 0;
  for (const s of syms) {
    const f = path.join(snapDir, s + '.json');
    if (!arg('disp-only') && (refresh || !fs.existsSync(f))) {
      const wait = last + gap - Date.now(); if (wait > 0) await sleep(wait);
      last = Date.now();
      try {
        const d = await post({ op: 'fund', sym: s });
        if (!d || !d.ok) { errs.push([s, 'not ok', d && d.err]); fs.writeFileSync(f, JSON.stringify(d || {})); continue; }
        fs.writeFileSync(f, JSON.stringify(d));
      } catch (e) { errs.push([s, String(e.message || e)]); continue; }
    }
    if (!fs.existsSync(f)) continue;
    const d = JSON.parse(fs.readFileSync(f, 'utf8'));
    if (!d.ok) continue;
    try { fs.writeFileSync(path.join(dispDir, s + '.json'), JSON.stringify(display(sb, d, mac, fx))); n++; }
    catch (e) { errs.push([s, 'disp', String(e.stack || e).slice(0, 400)]); }
    if (n % 25 === 0) console.log('מודל התצוגה: ' + n + '/' + syms.length);
  }
  fs.writeFileSync(path.join(outDir, 'snap-errors.json'), JSON.stringify(errs, null, 1));
  console.log('סיום: ' + n + ' חברות · שגיאות: ' + errs.length + (errs.length ? ' — ' + errs.slice(0, 5).map((e) => e[0]).join(', ') : ''));
}
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
module.exports = { display, loadAnalysis };
