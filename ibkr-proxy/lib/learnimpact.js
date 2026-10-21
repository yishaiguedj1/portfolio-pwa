/* השפעת המאגר לאורך זמן (21/10/2026, בקשת המשתמש: "כמה השתפר מנקודה לנקודה רק בזכות המאגר — ובנפרד, מאיפה בדיוק").
   טהור — בלי רשת ובלי DOM (נבדק ב־tests/learn-impact.test.js). הקלט = רשומות מאגר הלמידה (lib/studiolearn.js learnRec)
   ויומן השיפורים (lib/improvements.js).

   השיטה:
   1. כל מדד מנורמל לדקת סרטון, ולכל עבודה ערך אחד (IMP_METRICS).
   2. השוואה בין שתי תקופות — רק בתוך שכבות (מצב · מנוע), ממוצע של ההפרשים בשכבות המשותפות במשקל min(nA, nB). בלי זה
      "שיפור" יכול להיות פשוט מודל זול יותר (הלקח של versionsView, 21/10).
   3. רווח סמך של 90% ב־bootstrap בתוך השכבות, עם זרע קבוע (אותה תשובה בכל טעינה). פסק: up / dn / eq / ? / few.
   4. "הבסיס" = כל מה שלפני השיפור הראשון שנפרס; "עכשיו" = טווח לבחירה (7/30/90 יום / הכל מאז / מותאם).
   5. לכל שיפור: 28 יום לפני מול 28 יום אחרי (או עד השיפור הבא שנוגע באותו מדד — כדי לא לייחס לו את של הבא).
   6. פירוק: השינוי הכולל בכל מדד ראשי = סכום ההשפעות שנמדדו לכל שיפור + "לא מוסבר" (שינויים אחרים / רעש / מעורבות).
   7. חיסכון בחודש: ההפרש × נפח החודש האחרון (דקות סרטון / עבודות) → דקות שלך ודולרים. */
'use strict';

const { IMPROVEMENTS } = require('./improvements');

const DAY = 86400e3;
const IMP_B = 400, IMP_MIN = 3, IMP_WIN = 28 * DAY;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const rnd = (v, d) => (isNum(v) ? Math.round(v * Math.pow(10, d || 0)) / Math.pow(10, d || 0) : null);
const mean = (a) => { const s = a.filter(isNum); return s.length ? s.reduce((x, y) => x + y, 0) / s.length : null; };
const mins = (r) => (r.dur > 0 ? r.dur / 60 : 0);
const done = (r) => r.st === 'done';
const fin = (r) => r.st === 'done' || r.st === 'failed';
const clean = (r) => (r.fires || 0) <= 1 && !(r.t && r.t.run > 0 && (r.t.pz || 0) / r.t.run > 0.2);
const CRASH = /^(worker_lost|worker_oom|worker_crash|worker_step)$/;
const stg = (k) => (r) => (done(r) && clean(r) && r.t && r.t.s && isNum(r.t.s[k]) && mins(r) > 0 ? r.t.s[k] / mins(r) : null);

/* [מפתח, משפחה, כיוון (1 = גבוה טוב), סובלנות ('r' = 5% יחסי), שכבות?, ערך לעבודה] */
const IMP_METRICS = [
  // מהירות — שניות לדקת סרטון
  ['tot', 'speed', -1, 'r', 1, (r) => (done(r) && r.t && isNum(r.t.run) && mins(r) > 0 ? r.t.run / mins(r) : null)],                      // כל הזמן שחיכית
  ['act', 'speed', -1, 'r', 1, (r) => (done(r) && r.t && isNum(r.t.run) && mins(r) > 0 ? Math.max(0, r.t.run - (r.t.pz || 0)) / mins(r) : null)],   // זמן עבודה בפועל
  ['up', 'speed', -1, 'r', 0, (r) => { const u = r.ut; if (!u || mins(r) <= 0) return null; const ms = u.vf ? u.v : (u.ex || 0) + (u.a || 0); return ms > 0 ? ms / 1000 / mins(r) : null; }],   // עד שהשרת יכול להתחיל
  // 21/10/2026: דיוק הצפי — כמה הזמן בפועל רחוק מהצפי שנקבע בלקיחה (ep.t), ביחס לצפי. "נשאר בערך 1 ש׳ 40 ד׳" שלא מתקיים = חוויה גרועה
  ['eta', 'speed', -1, 0.05, 1, (r) => (done(r) && r.ep && r.ep.t > 0 && r.t && isNum(r.t.run) && (r.fires || 0) <= 1 ? Math.abs(Math.max(0, r.t.run - (r.t.pz || 0)) - r.ep.t) / r.ep.t : null)],
  ['tr', 'speed', -1, 'r', 1, stg('tr')], ['al', 'speed', -1, 'r', 1, stg('al')], ['rv', 'speed', -1, 'r', 1, stg('rv')],
  ['bn', 'speed', -1, 'r', 1, stg('bn')], ['sv', 'speed', -1, 'r', 1, stg('sv')],
  // אמינות — חלק מהעבודות
  ['ok', 'rel', 1, 0.05, 1, (r) => (fin(r) ? ((r.st === 'done' && (r.fires || 0) <= 1 + (r.ar || 0)) ? 1 : 0) : null)],   // בלי "המשך" ידני
  ['crash', 'rel', -1, 0.05, 0, (r) => (fin(r) ? (((r.eh || []).some((x) => CRASH.test(x.e)) || CRASH.test(r.err || '')) ? 1 : 0) : null)],
  ['fail', 'rel', -1, 0.05, 1, (r) => (fin(r) ? (r.st === 'failed' ? 1 : 0) : null)],
  // עלות — לדקת סרטון
  ['cpm', 'cost', -1, 'r', 1, (r) => (done(r) && r.pr && mins(r) > 0 ? r.usd / mins(r) : null)],
  ['tpm', 'cost', -1, 'r', 1, (r) => { if (!done(r) || !Array.isArray(r.use) || mins(r) <= 0) return null; const t = r.use.reduce((s, u) => s + (u.i || 0) + (u.o || 0) + (u.cr || 0) + (u.c5 || 0) + (u.c1 || 0), 0); return t > 0 ? t / mins(r) : null; }],
  // איכות
  ['q', 'qual', 1, 1, 1, (r) => (done(r) && r.q && isNum(r.q.s) ? r.q.s : null)],
  ['jd', 'qual', 1, 2, 1, (r) => (done(r) && r.jd && isNum(r.jd.s) ? r.jd.s : null)],
  // 21/10/2026 (סבב הייעול, 18): צפית עד הסוף (‎≥90%) ולא תיקנת = אות חיובי חלש; 1/0 לכל עבודה שנצפתה כך
  ['wok', 'qual', 1, 0.1, 1, (r) => { const u = r.ux || {}; return done(r) && u.pl && u.pl.cov >= 0.9 ? ((u.e && u.e.s > 0) ? 0 : 1) : null; }],
  ['ht', 'qual', -1, 0.02, 1, (r) => { const e = r.ux && r.ux.e; return done(r) && e && e.s > 0 && e.wa > 0 ? e.wd / e.wa : null; }],   // העריכות שלך
  ['num', 'qual', -1, 0.02, 1, (r) => { const o = r.lx && r.lx.mx && r.lx.mx.om; return done(r) && o && o['num.n'] > 0 ? o['num.miss'] / o['num.n'] : null; }],
  ['glm', 'qual', -1, 0.02, 1, (r) => { const c = r.lx && r.lx.mx && r.lx.mx.cs; return done(r) && c && c['gl.n'] > 0 ? c['gl.miss'] / c['gl.n'] : null; }],
];
const MKEYS = IMP_METRICS.map((m) => m[0]);
const HEAD = ['tot', 'act', 'ok', 'crash', 'cpm', 'q', 'jd', 'ht'];
const metric = (k) => IMP_METRICS.find((m) => m[0] === k);
const strat = (r, on) => (on ? (r.mode || '?') + '|' + (r.eng || '?') : '*');

function seeded(s) {   // mulberry32 — אותה תשובה בכל טעינה
  let a = 0; for (const ch of String(s)) a = (Math.imul(a ^ ch.charCodeAt(0), 2654435761) >>> 0);
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function groups(rs, k) {
  const m = metric(k), out = {};
  for (const r of rs) { const v = m[5](r); if (isNum(v)) (out[strat(r, m[4])] = out[strat(r, m[4])] || []).push(v); }
  return out;
}
/* A = לפני / הבסיס, B = אחרי / עכשיו. d = B − A (ביחידות המדד), rel = d / A, good = d בכיוון "טוב" (חיובי = לטובה) */
function compare(A, B, k, seed) {
  const m = metric(k), ga = groups(A, k), gb = groups(B, k);
  const keys = Object.keys(ga).filter((s) => gb[s]);
  const na = keys.reduce((s, x) => s + ga[x].length, 0), nb = keys.reduce((s, x) => s + gb[x].length, 0);
  const all = (g) => [].concat(...Object.values(g));
  const out = { k, f: m[1], dir: m[2], na, nb, a0: rnd(mean(all(ga)), 4), b0: rnd(mean(all(gb)), 4), sk: keys.length };
  if (!keys.length || na < IMP_MIN || nb < IMP_MIN) return Object.assign(out, { v: 'few' });
  const w = keys.map((s) => Math.min(ga[s].length, gb[s].length)), W = w.reduce((x, y) => x + y, 0);
  const est = (fa, fb) => keys.reduce((s, x, i) => s + w[i] * (fb(x) - fa(x)), 0) / W;
  const base = keys.reduce((s, x, i) => s + w[i] * mean(ga[x]), 0) / W;
  const d = est((x) => mean(ga[x]), (x) => mean(gb[x]));
  const rr = seeded(seed + '|' + k), ds = new Array(IMP_B);
  const rs = (arr) => { let s = 0; for (let j = 0; j < arr.length; j++) s += arr[(rr() * arr.length) | 0]; return s / arr.length; };
  for (let i = 0; i < IMP_B; i++) { const ma = {}, mb = {}; for (const x of keys) { ma[x] = rs(ga[x]); mb[x] = rs(gb[x]); } ds[i] = est((x) => ma[x], (x) => mb[x]); }
  ds.sort((x, y) => x - y);
  const lo = ds[Math.floor(0.05 * IMP_B)], hi = ds[Math.ceil(0.95 * IMP_B) - 1];
  const tol = m[3] === 'r' ? 0.05 * Math.abs(base) : m[3];
  const glo = m[2] > 0 ? lo : -hi, ghi = m[2] > 0 ? hi : -lo;   // בכיוון "טוב"
  const v = glo > 0 && ghi > tol * 0.5 ? 'up' : ghi < 0 && glo < -tol * 0.5 ? 'dn' : glo >= -tol && ghi <= tol ? 'eq' : '?';
  return Object.assign(out, { a: rnd(base, 4), b: rnd(base + d, 4), d: rnd(d, 4), lo: rnd(lo, 4), hi: rnd(hi, 4),
    rel: base ? rnd(d / Math.abs(base), 4) : null, good: rnd(m[2] * d, 4), v });
}

/* נפח החודש האחרון — לחיסכון בחודש */
function volume(rs, now) {
  const last = rs.filter((r) => r.k === 'tr' && !r.gold && r.at >= now - 30 * DAY);
  return { min: rnd(last.filter(done).reduce((s, r) => s + mins(r), 0), 1), jobs: last.filter(fin).length };
}
/* חיסכון בחודש מהפרש d: זמן — דקות שלך (d שניות לדקת סרטון × דקות סרטון בחודש / 60); עלות — דולרים; אמינות — עבודות */
function saving(c, vol) {
  if (!c || c.v === 'few' || !isNum(c.good)) return null;
  const m = metric(c.k);
  if (m[1] === 'speed') return { u: 'min', v: rnd(c.good * vol.min / 60, 1) };
  if (c.k === 'cpm') return { u: 'usd', v: rnd(c.good * vol.min, 2) };
  if (m[1] === 'rel') return { u: 'jobs', v: rnd(c.good * vol.jobs, 1) };
  return null;
}
function weekly(rs, now, n) {
  const wk = Math.floor((now - 4 * DAY) / (7 * DAY));   // שבוע שמתחיל ביום שני (1/1/1970 = חמישי)
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const a = (wk - i) * 7 * DAY + 4 * DAY, b = a + 7 * DAY, l = rs.filter((r) => r.at >= a && r.at < b);
    const row = { at: a, n: l.filter((r) => r.k === 'tr').length };
    for (const k of MKEYS) { const v = mean(l.map(metric(k)[5])); row[k] = v == null ? null : rnd(v, 4); }
    out.push(row);
  }
  return out;
}

/* o = { from, to } (טווח "עכשיו" מותאם), imps = יומן השיפורים (בבדיקות — מוזרק) */
function impactView(records, now, o, imps) {
  const L = (imps || IMPROVEMENTS).map((x) => Object.assign({}, x, { t: x.at ? Date.parse(x.at) : 0 }));
  const rs = (Array.isArray(records) ? records : []).filter((r) => r && r.k === 'tr' && !r.gold && isNum(r.at));
  const live = L.filter((x) => x.t > 0 && x.t <= now).sort((a, b) => a.t - b.t);
  const start = live.length ? live[0].t : 0;
  const vol = volume(rs, now);
  const out = { v: 1, at: now, start, n: rs.length, vol, keys: MKEYS, head: HEAD,
    fam: Object.fromEntries(IMP_METRICS.map((m) => [m[0], m[1]])), dir: Object.fromEntries(IMP_METRICS.map((m) => [m[0], m[2]])),
    wk: weekly(rs, now, 12), imps: [], cmp: {}, dec: [] };
  // לכל שיפור: לפני מול אחרי (עד השיפור הבא שנוגע באותו מדד)
  for (const x of L) {
    const row = { id: x.id, at: x.t || 0, m: x.m, src: x.src, he: x.he, en: x.en, st: !x.t ? 'wait' : x.t > now ? 'soon' : 'live', c: [] };
    if (row.st === 'live') {
      for (const k of MKEYS) {
        const nxt = L.filter((y) => y.t > x.t && y.m.includes(k)).map((y) => y.t).sort((a, b) => a - b)[0] || Infinity;
        const A = rs.filter((r) => r.at >= x.t - IMP_WIN && r.at < x.t), B = rs.filter((r) => r.at >= x.t && r.at < Math.min(nxt, x.t + IMP_WIN, now + 1));
        const c = compare(A, B, k, x.id);
        if (c.na || c.nb) row.c.push(Object.assign(c, { tg: x.m.includes(k) ? 1 : 0, sv: saving(c, vol) }));
      }
      row.c.sort((a, b) => b.tg - a.tg);
    }
    out.imps.push(row);
  }
  if (!start) return out;
  // הבסיס מול "עכשיו" — כמה טווחים מוכנים, ועוד אחד מותאם
  const base = rs.filter((r) => r.at < start);
  const ranges = { d7: [now - 7 * DAY, now], d30: [now - 30 * DAY, now], d90: [now - 90 * DAY, now], all: [start, now] };
  if (o && isNum(o.from) && isNum(o.to) && o.to > o.from) ranges.cu = [Math.max(o.from, start), o.to];
  for (const [rk, [a, b]] of Object.entries(ranges)) {
    const B = rs.filter((r) => r.at >= Math.max(a, start) && r.at <= b);
    out.cmp[rk] = { from: Math.max(a, start), to: b, nb: B.length, m: MKEYS.map((k) => { const c = compare(base, B, k, 'base|' + rk); return Object.assign(c, { sv: saving(c, vol) }); }) };
  }
  // פירוק: השינוי הכולל (הבסיס מול "הכל מאז") = סכום מה שנמדד לכל שיפור + "לא מוסבר"
  for (const k of HEAD) {
    const tot = out.cmp.all.m.find((c) => c.k === k);
    if (!tot || tot.v === 'few') continue;
    const parts = out.imps.filter((x) => x.st === 'live').map((x) => { const c = x.c.find((y) => y.k === k); return c && c.v !== 'few' ? { id: x.id, d: c.d, tg: c.tg } : null; }).filter(Boolean);
    const sum = parts.reduce((s, x) => s + x.d, 0);
    out.dec.push({ k, d: tot.d, rel: tot.rel, parts, rest: rnd(tot.d - sum, 4) });
  }
  return out;
}

module.exports = { impactView, compare, IMP_METRICS, MKEYS, HEAD, IMP_WIN, IMP_MIN, saving, volume };
