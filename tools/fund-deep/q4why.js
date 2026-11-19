#!/usr/bin/env node
// בדיקת העומק, גל 7 — למה הרבעון הרביעי לא נלקח מההודעה לעיתונות (המטמון <w>/pr של q4pr.js; ‏fundamentals.js ‏q4Press, ‏secpr.js ‏q4From).
// לכל שנה שהרבעון הרביעי שלה מוערך, יש לה הודעה, ו־q4Press לא שינה אותה — השורש:
//   noEps / noSh / diffTable (רווח למניה ומניות בטבלאות שונות) / shFar (אין מניות עד 25% מההערכה) / shMid (המכפלה = הרווח, אבל המניות
//   10%–25% מההערכה בלי אישור השנה) / keepSh (נמצא, ונשאר — שורת "מדולל" על בסיס אחר בשנת הפסד) / bGate (שורות "רווח למניה" בלי
//   "מדולל" ושנה לא ב־noDil) / adj (רק שורות מתואמות) / annOk (השנה בהודעה = השנה שלנו, הרבעון לא) / annDiff (גם השנה בהודעה שונה) /
//   qOnly (אין עמודת שנה); ‏qSame / noQ — ראו why; ‏sign — המכפלה = מינוס הרווח (הסוגריים אבדו בפענוח); ‏crossOk — הזיווג בין
//   טבלאות מוצא (בטבלה של המניות רווח למניה מתואם, FFO).
// ובנוסף — "זיווג בין טבלאות" (‎--cross‎): רווח למניה מטבלה אחת ומניות מאחרת, רק כששתי השורות באותו מבנה עמודות וגם עמודת השנה
// מאומתת (מניות עד 2% מהשנתיות, מכפלה = הרווח השנתי). הדיוק נמדד ברבעונים הרביעיים ש־XBRL כן מתייג (האמת).
// נתונים ציבוריים של SEC בלבד.
//   node tools/fund-deep/q4why.js --w <dir> [--only AJG,MET] [--fs <fundamentals.js>] [--out <קובץ>]
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const ROOT = path.resolve(__dirname, '../..');
const argv = process.argv.slice(2), o = {};
for (let i = 0; i < argv.length; i++) {
  if (!argv[i].startsWith('--')) continue;
  const k = argv[i].slice(2), v = argv[i + 1] != null && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  o[k] = v;
}
if (!o.w) { console.error('שימוש: --w <תיקיית עבודה>'); process.exit(2); }
const W = path.resolve(o.w), DD = path.join(W, 'debt'), PD = path.join(W, 'pr');
const F = require(path.resolve(o.fs || path.join(ROOT, 'ibkr-proxy/lib/fundamentals.js')));
const P = require(path.join(ROOT, 'ibkr-proxy/lib/secpr.js'));
const pad = (c) => String(c).padStart(10, '0');
const gz = (f) => JSON.parse(zlib.gunzipSync(fs.readFileSync(f)).toString());
const day = (s) => Date.parse(s + 'T00:00:00Z') / 864e5;
const only = o.only && o.only !== true ? new Set(String(o.only).split(',')) : null;
const rows = fs.readFileSync(path.join(__dirname, 'ciks.tsv'), 'utf8').split('\n').map((l) => l.split(/\s+/)).filter((p) => p[1] && /^\d+$/.test(p[1]));

const isEps = (r) => r.v.every((x) => x == null || Math.abs(x) < 5000) && r.v.some((x) => x != null && Math.round(x) !== x);
const ADJ = /adjust|non-?gaap|operating|excluding|ex\.|core|underlying|comparable|normali[sz]ed|recurring|pro ?forma|cash|ffo|funds from|distributable|economic|before (special|notable|unusual)|ongoing|organic/i;
const okN = (x, n, s) => Math.abs(x - n) <= 0.0051 * s + 0.02 * Math.abs(n);
// שנה מאומתת באותן שתי שורות (כמו annOk של secpr, עמודה אחרת מ־i)
const annCol = (re, rs, i, f, pf, ann) => !!ann && ann.sh > 0 && re.v.some((e0, j) => {
  if (j === i || e0 == null || !(rs.v[j] > 0)) return false;
  const s = rs.v[j] * f * pf, e = e0 / pf;
  return Math.abs(s / ann.sh - 1) <= 0.02 && (ann.ni || []).some((n) => Number.isFinite(n) && okN(e * s, n, s));
});
// עמודת שנה כלשהי (מניות עד 2% מהשנתיות) — קיימת? ‏(null — אין)
const annAny = (re, rs, i, f, pf, ann) => !!ann && ann.sh > 0 && re.v.some((e0, j) => j !== i && e0 != null && rs.v[j] > 0 && Math.abs(rs.v[j] * f * pf / ann.sh - 1) <= 0.02);

/* כל הזוגות (רווח למניה, מניות) של עמודה אחת, עם המניות עד 25% מההערכה. same — אותה טבלה (true) / טבלאות שונות באותו מבנה (false) */
function pairs(rws, est, post, same) {
  const pfs = [...new Set([1].concat(post || []).filter((x) => x > 0))], out = [];
  for (const re of rws) {
    if (!isEps(re)) continue;
    for (const rs of rws) {
      if (rs === re || (same ? rs.t !== re.t : rs.t === re.t || rs.v.length !== re.v.length || isEps(rs))) continue;
      for (let i = 0; i < Math.min(re.v.length, rs.v.length); i++) for (const pf of pfs) {
        if (re.v[i] == null || !(rs.v[i] > 0)) continue;
        for (const f of [1, 1e3, 1e6]) {
          const s = rs.v[i] * pf * f, dv = Math.abs(s / est - 1);
          if (dv <= 0.25) out.push({ re, rs, i, pf, f, s, e: re.v[i] / pf, dv });
        }
      }
    }
  }
  return out;
}

/* זיווג בין טבלאות (המועמד לכלל): מניות עד 10% מההערכה, מכפלה = הרווח, עמודת השנה מאומתת באותן שתי שורות; כמה תוצאות שונות — אין */
function cross(rws, ns, est, post, ann) {
  const got = [];
  for (const c of pairs(rws, est, post, false)) {
    if (c.dv > 0.1 || !annCol(c.re, c.rs, c.i, c.f, c.pf, ann)) continue;
    if (!ns.some((n) => okN(c.e * c.s, n, c.s))) continue;
    if (!got.some((g) => Math.abs(g.e - c.e) < 0.005 && Math.abs(g.s / c.s - 1) < 0.002)) got.push(c);
  }
  return got.length === 1 ? { eps: Math.round(got[0].e * 1e4) / 1e4, sh: got[0].s, lab: got[0].re.label } : got.length ? { amb: got.length } : null;
}

/* השורש. imp — ההשפעה: same — הרווח למניה שלנו לרבעון מודפס באחת השורות שאינן מתואמות (רק המניות נשארות הערכה); ann — רק
   הרווח למניה השנתי שלנו מודפס; diff — אף אחד מהם */
function why(r, ns, est, post, ann, noDilYr, eps0, epsA) {
  const rw = r.rows, gaapR = rw.filter((x) => isEps(x) && !ADJ.test(x.label + ' ' + (x.ctx || '')));
  const pfs = [...new Set([1].concat(post || []).filter((x) => x > 0))];
  const has = (v) => v != null && gaapR.some((x) => x.v.some((y) => y != null && pfs.some((pf) => Math.abs(y / pf - v) < 0.005)));
  const imp = has(eps0) ? 'same' : has(epsA) ? 'ann' : 'diff';
  const w = cls();
  // המכפלה שונה מהרווח, אבל הרווח למניה שלנו לרבעון מודפס (עמודות לפי מגזר, NextEra) — qSame; רק השנתי מודפס (טבלת שנים בלבד או
  // חודש — Live Nation, ‏Progressive) — noQ
  if (['annOk', 'annDiff', 'qOnly'].includes(w.c) && imp !== 'diff') w.c = imp === 'same' ? 'qSame' : 'noQ';
  return { ...w, imp };
  function cls() {
    if (rw.some((x) => x.b) && !noDilYr) return { c: 'bGate' };
    if (!rw.some(isEps)) return { c: 'noEps' };
    // שורת מניות של ממש: תווית של מניות (לא "per … share") עם ערך שלם, או ערך של אלף ומעלה
    const shReal = (x) => x.v.some((y) => y != null && y > 0) && ((/weighted|average|outstanding|shares|equivalent/i.test(x.label + ' ' + (x.ctx || '')) && !/per (basic |diluted |common |and )*share|earnings per|income per|loss per|\beps\b/i.test(x.label)) || x.v.some((y) => y != null && Math.abs(y) >= 1000));
    if (!rw.some(shReal)) return { c: 'noSh' };
    const anySame = rw.some((re) => isEps(re) && rw.some((rs) => rs !== re && rs.t === re.t && shReal(rs)));
    if (!anySame) return { c: 'diffTable' };
    const sp = pairs(rw, est, post, true);
    if (!sp.length) return { c: 'shFar' };
    const hit = sp.filter((c) => ns.some((n) => okN(c.e * c.s, n, c.s)));
    if (hit.length) return hit.some((c) => c.dv <= 0.1 || annCol(c.re, c.rs, c.i, c.f, c.pf, ann)) ? { c: 'keepSh' } : { c: 'shMid', dv: Math.min(...hit.map((c) => c.dv)) };
    if (sp.some((c) => ns.some((n) => okN(-c.e * c.s, n, c.s)))) return { c: 'sign' };
    const gaap = sp.filter((c) => !ADJ.test(c.re.label + ' ' + (c.re.ctx || '')));
    if (!gaap.length) return { c: 'adj', lab: sp[0].re.label };
    const m = cross(rw, ns, est, post, ann);
    if (m && !m.amb) return { c: 'crossOk', cross: [m.eps, m.sh], lab: m.lab };
    const n0 = ns[0];
    const b = gaap.reduce((a, c) => (Math.abs(c.e * c.s - n0) < Math.abs(a.e * a.s - n0) ? c : a));
    const X = b.e * b.s, rel = n0 ? (X - n0) / Math.abs(n0) : null;
    const k = annCol(b.re, b.rs, b.i, b.f, b.pf, ann) ? 'annOk' : annAny(b.re, b.rs, b.i, b.f, b.pf, ann) ? 'annDiff' : 'qOnly';
    return { c: k, lab: b.re.label, X: Math.round(X), n: Math.round(n0), rel: rel == null ? null : Math.round(rel * 1e4) / 1e4, cont: /continuing/i.test(b.re.label) };
  }
}

const res = [], tag = { n: 0, found: 0, ok: 0, bad: [], amb: 0 };
const seen = new Set();
for (const [sym, c0] of rows) {
  const cik = pad(c0);
  if (seen.has(cik) || (only && !only.has(sym))) continue;
  seen.add(cik);
  const pf = path.join(PD, cik + '.p.json'), cf = path.join(DD, cik + '.cf.json.gz');
  if (!fs.existsSync(pf) || !fs.existsSync(cf)) continue;
  const p = JSON.parse(fs.readFileSync(pf, 'utf8'));
  const ff = path.join(DD, cik + '.face.json'), f0 = fs.existsSync(ff) ? JSON.parse(fs.readFileSync(ff, 'utf8')) : null;
  let s; try { s = F.normalizeSec(gz(cf), [], f0 && !f0.err ? f0 : null); } catch (e) { continue; }
  if (!s || !s.Q || !s.Q.eps || !s.q) continue;
  const est0 = (s.shEst || []).slice(), sh0 = (s.Q.sh || []).slice(), eps0 = s.Q.eps.slice();
  const at = (e) => Object.values(p).find((r) => r && r.rows && Math.abs(day(r.end) - day(e)) <= 5);
  const sp = (s.splitsUsed || []).slice().sort((a, b) => (a[0] < b[0] ? -1 : 1)), post = sp.map((_, j) => sp.slice(j).reduce((t, [, x]) => t * x, 1));
  const A = s.A || {};
  const ctx = (e, i) => {
    const fi = s.fy.findIndex((f) => Math.abs(day(f) - day(e)) <= 5);
    return {
      fi, ns: [s.epsNum && s.epsNum[e], s.Q.nic && s.Q.nic[i], s.Q.ni && s.Q.ni[i]].filter((x) => Number.isFinite(x) && x !== 0),
      ann: { sh: A.sh && A.sh[fi], ni: [A.nic && A.nic[fi], A.ni && A.ni[fi]].filter((x) => Number.isFinite(x) && x !== 0) },
    };
  };
  // הדיוק של הזיווג בין טבלאות — ברבעונים הרביעיים המתויגים
  s.q.forEach((e, i) => {
    if (est0.includes(e) || !s.fy.some((f) => Math.abs(day(f) - day(e)) <= 5)) return;
    const r = at(e); if (!r || !(sh0[i] > 0) || s.Q.eps[i] == null) return;
    const { ns, ann } = ctx(e, i); if (!ns.length) return;
    tag.n++;
    const m = cross(r.rows, ns, sh0[i], post, ann);
    if (!m) return;
    if (m.amb) { tag.amb++; return; }
    tag.found++;
    if (Math.abs(m.eps - s.Q.eps[i]) < 0.005 && Math.abs(m.sh / sh0[i] - 1) < 0.002) tag.ok++;
    else tag.bad.push([sym, e, [s.Q.eps[i], sh0[i]], [m.eps, m.sh], m.lab]);
  });
  const ch = F.q4Press(s, p), hit = new Set(ch.map((c) => c.p));
  for (const e of est0) {
    const i = s.q.indexOf(e); if (i < 0 || hit.has(e) || !s.fy.some((f) => Math.abs(day(f) - day(e)) <= 5)) continue;
    const r = at(e); if (!r || !(sh0[i] > 0)) continue;
    const { fi, ns, ann } = ctx(e, i);
    if (!ns.length) { res.push({ sym, e, c: 'noNi' }); continue; }
    const w = why(r, ns, sh0[i], post, ann, (s.noDil || []).includes(s.fy[fi]), eps0[i], A.eps && A.eps[fi]);
    if (w.c === 'diffTable') { const m = cross(r.rows, ns, sh0[i], post, ann); w.cross = m ? (m.amb ? 'amb' : [m.eps, m.sh]) : null; }
    res.push({ sym, e, ...w });
  }
}
const cnt = {}, mat = {}; for (const r of res) { cnt[r.c] = (cnt[r.c] || 0) + 1; mat[r.c] = mat[r.c] || {}; mat[r.c][r.imp] = (mat[r.c][r.imp] || 0) + 1; }
const sub = { cont: 0, rel: {} };
for (const r of res) if (['annOk', 'annDiff', 'qOnly'].includes(r.c)) {
  if (r.cont) sub.cont++;
  const a = r.rel == null ? 'na' : Math.abs(r.rel) <= 0.05 ? '≤5%' : Math.abs(r.rel) <= 0.2 ? '≤20%' : '>20%';
  sub.rel[r.c + ' ' + a] = (sub.rel[r.c + ' ' + a] || 0) + 1;
}
const dt = res.filter((r) => r.c === 'diffTable');
console.log('שנים:', res.length, JSON.stringify(cnt));
console.log('שורש × השפעה:', JSON.stringify(mat));
console.log('המכפלה ≠ הרווח (פירוט):', JSON.stringify(sub));
console.log('diffTable — הזיווג בין טבלאות:', JSON.stringify({ n: dt.length, found: dt.filter((r) => Array.isArray(r.cross)).length, amb: dt.filter((r) => r.cross === 'amb').length }));
console.log('הזיווג בין טבלאות מול XBRL (רבעון מתויג):', JSON.stringify({ n: tag.n, found: tag.found, ok: tag.ok, bad: tag.bad.length, amb: tag.amb }));
for (const b of tag.bad.slice(0, 30)) console.log('  ✗', JSON.stringify(b));
fs.writeFileSync(o.out || path.join(PD, '_why.json'), JSON.stringify({ res, tag }));
