/* בקרת הדיוק של מנתח החברות (25/10/2026, שכבות 4–5) — טהור, בלי רשת.
   tools/fund-audit.js מריץ את fundamentals() על 500 החברות הגדולות ומסכם כאן; ה־workflow הלילי (fund-audit.yml)
   מפרסם את הסיכום כקובץ ב־Release הציבורי "fund-audit" (מספרים מ־SEC וסימבולים — מידע ציבורי בלבד),
   והשרתון קורא משם: מרכז הניהול (adminFund → auditView) והתראה למנהל (auditAlert).
   שכבה 8 (26/10/2026): res[i].x = השורות של fundxcheck.xcheck לחברה (S&P 500 ו־Nasdaq-100) → S.x = ההכרעות + רשימת הערכים לבדוק. */
const XC = require('./fundxcheck');

const REL = 'https://github.com/yishaiguedj1/portfolio-pwa/releases/download/fund-audit/';
const HIST_MAX = 60;
const ITEMS_MAX = 400;
const XITEMS_MAX = 400;   // שכבה 8: ערכים לבדוק שנשמרים בסיכום (הספירה — כולם)
const XWHY_MAX = 40;
// סדר החומרה של הבעיות: שונה מ־SEC / מהדוח, פיצול, רחוק מהאומדן, שני המקורות נגדנו, הבדל בלי הסבר, מקור אחד
const XSEV = { bug: 0, spl: 1, estx: 2, ext: 3, odd: 4, one: 5 };

/* סט הזהב: כל ערך מול מה שנשמר מהדוח (עד 0.5%; למניה — עד סנט). השוואה בערך מוחלט — הסימן נבדק ב־faceCheck */
function goldCheck(gold, sym, r) {
  const g = gold && gold.companies && gold.companies[sym];
  if (!g || !r || !r.A || !Array.isArray(r.fy)) return [];
  const bad = [];
  for (const [k, byYear] of Object.entries(g.v || {})) for (const [end, want] of Object.entries(byYear)) {
    const i = r.fy.findIndex((e) => Math.abs(Date.parse(e) - Date.parse(end)) < 9 * 864e5);
    const got = i >= 0 && r.A[k] ? r.A[k][i] : null;
    const tol = k === 'eps' ? 0.011 : 0.005 * Math.abs(want);
    if (got == null || Math.abs(Math.abs(got) - Math.abs(want)) > tol) bad.push({ sym, m: k, p: end, want, got: got == null ? null : got });
  }
  return bad;
}

/* שכבה 7 (26/10/2026, AppLovin — צמיחה של ‎−35% שלא הייתה): הצמיחה שהמסך מציג מול הדוחות עצמם, בחישוב נפרד ופשוט.
   לכל שנה: הדוח השנתי האחרון שמציג גם אותה וגם את השנה שלפניה (באותה תגית שהשרתון בחר) — היחס שהחברה עצמה הציגה.
   facts = companyfacts של SEC, tag = התגית (r.tags[k]), fy = סופי השנים, got = הצמיחה שהמסך חישב לכל שנה (null = לא מוצגת).
   מחזיר פערים מעל 0.1 נקודת אחוז: [{m, p, f: מהדוח, v: במסך}] */
const ANN_FORMS = /^(10-K|20-F|40-F)(\/A)?$/;
function growthAudit(facts, tag, fy, got, m) {
  const tx = facts && facts.facts && (facts.facts['us-gaap'] || {})[tag] || (facts && facts.facts && (facts.facts['ifrs-full'] || {})[tag]);
  if (!tx || !tx.units || !Array.isArray(fy)) return [];
  const rows = Object.entries(tx.units).filter(([u]) => /^[A-Z]{3}$/.test(u)).flatMap(([u, a]) => a.map((x) => ({ ...x, u })));
  const day = (d) => Date.parse(d + 'T00:00:00Z') / 864e5;
  const yr = rows.filter((x) => x.start && ANN_FORMS.test(x.form || '') && x.val != null && day(x.end) - day(x.start) >= 350 && day(x.end) - day(x.start) <= 380);
  const at = (e) => yr.filter((x) => Math.abs(day(x.end) - day(e)) <= 8);
  const out = [];
  for (let i = 1; i < fy.length; i++) {
    if (got[i] == null) continue;
    const cur = at(fy[i]), prv = at(fy[i - 1]);
    let best = null;
    for (const a of cur) for (const b of prv) if (a.accn === b.accn && a.u === b.u && (!best || a.filed > best.a.filed)) best = { a, b };
    if (!best || !(best.b.val > 0)) continue;
    const want = best.a.val / best.b.val - 1;
    if (Math.abs(want - got[i]) > 0.001) out.push({ m, p: fy[i], f: Math.round(want * 1e4) / 1e4, v: Math.round(got[i] * 1e4) / 1e4 });
  }
  return out;
}

/* שכבה 8: res = [{sym, x}] → { n ערכים, cos חברות, c לפי הכרעה, why לפי הכרעה·הסבר, p בעיות, b מתוכן bug, pc לפי סוג, items הבעיות } */
const xnum = (x) => (x == null || !Number.isFinite(+x) ? null : Math.round(+x * 1000) / 1000);
function xSummary(res, max = XITEMS_MAX) {   // max — הסיכום ב־Release ‏400; הדוח (report.md) — כולם
  const rows = res.filter((e) => Array.isArray(e.x)).map((e) => ({ sym: e.sym, x: e.x }));
  if (!rows.length) return null;
  const S8 = XC.summarizeX(rows), items = [];
  for (const [sym, xs] of Object.entries(S8.cos)) for (const r of xs) items.push({ sym, m: r.m, k: r.k, p: r.p, c: r.c, why: r.why || null, v: xnum(r.v), raw: xnum(r.raw), y: xnum(r.y), n: xnum(r.n) });
  items.sort((a, b) => (XSEV[a.c] ?? 9) - (XSEV[b.c] ?? 9) || a.sym.localeCompare(b.sym) || a.m.localeCompare(b.m) || a.k.localeCompare(b.k) || a.p.localeCompare(b.p));
  const pc = {}; for (const r of items) pc[r.c] = (pc[r.c] || 0) + 1;
  return { n: S8.n, cos: rows.filter((r) => r.x.length).length, c: S8.c, p: items.length, b: pc.bug || 0, pc,
    why: Object.fromEntries(Object.entries(S8.why).sort((a, b) => b[1] - a[1]).slice(0, XWHY_MAX)), items: items.slice(0, max) };
}

/* res = [{sym, r, x?, xo?}] (r = התשובה של fundamentals; x = שכבה 8; xo = רק לשכבה 8 — לא נספר בשכבות 1–7) → הסיכום שמתפרסם */
const KIND_W = { gold: 0, gr: 1, face: 1, fix: 2, bal: 3, neg: 4, scale: 5, eps: 6, gp: 7, part: 8, q4: 9, xy: 10 };
function summarize(res, gold, now, ms) {
  const S = { v: 1, at: new Date(now).toISOString(), n: res.length, sec: 0, yahoo: 0, fail: 0,
    face: { n: 0, ok: 0, cos: 0, coOk: 0 }, kinds: {}, gold: { n: 0, bad: 0 }, gr: { n: 0 }, cos: [], items: [], ms: ms || 0, ys: [], fs: [] };
  for (const { sym, r, xo } of res) {
    if (xo) continue;
    if (!r || !r.ok) { S.fail++; S.fs.push(sym); continue; }
    if (r.src !== 'sec') { S.yahoo++; S.ys.push(sym); continue; }
    S.sec++;
    if (r.face) {
      S.face.n += r.face.n; S.face.ok += r.face.ok; S.face.cos++;
      if (r.face.n && r.face.ok === r.face.n) S.face.coOk++;
      else if (r.face.n) S.cos.push({ sym, n: r.face.n, ok: r.face.ok, form: r.face.form || '', url: r.face.url || '' });
    }
    for (const c of r.checks || []) {
      S.kinds[c.k] = (S.kinds[c.k] || 0) + 1;
      S.items.push({ sym, k: c.k, m: c.m || null, p: c.p || null, f: c.f != null ? c.f : null, v: c.v != null ? c.v : null });
    }
    // שכבה 7: הצמיחה במסך מול הדוחות (r.gr — tools/fund-audit.js מחשב מול companyfacts)
    if (Array.isArray(r.gr)) {
      S.gr.n += r.grn || 0;
      for (const g of r.gr) { S.kinds.gr = (S.kinds.gr || 0) + 1; S.items.push({ sym, k: 'gr', m: g.m, p: g.p, f: g.f, v: g.v }); }
    }
    if (gold && gold.companies && gold.companies[sym]) {
      const gb = goldCheck(gold, sym, r); S.gold.n++; if (gb.length) S.gold.bad++;
      for (const b of gb) S.items.push({ sym, k: 'gold', m: b.m, p: b.p, f: b.want, v: b.got });
    }
  }
  S.cos.sort((a, b) => (a.ok / a.n) - (b.ok / b.n) || a.sym.localeCompare(b.sym));
  S.items.sort((a, b) => (KIND_W[a.k] ?? 20) - (KIND_W[b.k] ?? 20) || a.sym.localeCompare(b.sym));
  S.ni = S.items.length;
  S.items = S.items.slice(0, ITEMS_MAX);
  const X8 = xSummary(res); if (X8) S.x = X8;
  S.n = res.filter((e) => !e.xo).length;
  return S;
}

/* שורה בהיסטוריה (history.json באותו Release) */
function histEntry(S) {
  // xn/xp/xb (שכבה 8): null כשהריצה בלי שכבה 8 — כדי שהריצה הראשונה איתה לא תיראה כמו "קפיצה" מאפס
  return { at: S.at, n: S.n, sec: S.sec, y: S.yahoo, x: S.fail, fn: S.face.n, fo: S.face.ok, cos: S.face.cos, cok: S.face.coOk, gn: S.gold.n, gb: S.gold.bad, k: S.kinds,
    xn: S.x ? S.x.n : null, xp: S.x ? S.x.p : null, xb: S.x ? S.x.b : null };
}
function pushHist(hist, S) {
  const h = (Array.isArray(hist) ? hist : []).filter((x) => x && x.at && x.at !== S.at);
  h.push(histEntry(S));
  return h.slice(-HIST_MAX);
}

/* מה שמגיע מה־Release — מקור חיצוני מבחינת השרתון: רק הצורה הצפויה, טקסט קצר בלבד */
const SYM_RE = /^[A-Z0-9][A-Z0-9.\-]{0,11}$/;
const n0 = (x) => (Number.isFinite(+x) && +x >= 0 ? Math.round(+x) : 0);
const numOrNull = (x) => (x == null || !Number.isFinite(+x) ? null : +x);
const str = (x, n) => String(x == null ? '' : x).replace(/[^\x20-\x7e]/g, '').slice(0, n);
function normKinds(k, re = /^[a-z0-9]{1,8}$/) {
  const out = {};
  for (const [a, b] of Object.entries(k && typeof k === 'object' ? k : {})) if (re.test(a)) out[a] = n0(b);
  return out;
}
const nOrNull = (x) => (x == null ? null : n0(x));
/* שכבה 8 מה־Release: מדדים ידועים בלבד, הכרעה/הסבר בצורה קבועה, מספרים או null */
const XC_RE = /^[a-z]{2,6}$/, XWHY_RE = /^[a-z]{2,6}:[a-z0-9_.:]{1,24}$/, DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function normX(x) {
  if (!x || typeof x !== 'object') return null;
  return { n: n0(x.n), cos: n0(x.cos), p: n0(x.p), b: n0(x.b), c: normKinds(x.c, XC_RE), pc: normKinds(x.pc, XC_RE), why: normKinds(x.why, XWHY_RE),
    items: (Array.isArray(x.items) ? x.items : []).filter((r) => r && SYM_RE.test(str(r.sym, 12)) && XC.XK.includes(r.m) && (r.k === 'A' || r.k === 'Q') &&
      DATE_RE.test(String(r.p || '')) && XC_RE.test(String(r.c || ''))).slice(0, XITEMS_MAX)
      .map((r) => ({ sym: str(r.sym, 12), m: r.m, k: r.k, p: String(r.p), c: String(r.c), why: r.why && /^[a-z0-9_.:]{1,24}$/.test(String(r.why)) ? String(r.why) : null,
        v: numOrNull(r.v), raw: numOrNull(r.raw), y: numOrNull(r.y), n: numOrNull(r.n) })) };
}
function normAudit(o) {
  if (!o || typeof o !== 'object' || o.v !== 1 || !Date.parse(o.at)) return null;
  const f = o.face || {}, g = o.gold || {};
  const syms = (a, n) => (Array.isArray(a) ? a : []).map((s) => str(s, 12)).filter((s) => SYM_RE.test(s)).slice(0, n);
  return {
    at: new Date(Date.parse(o.at)).toISOString(), n: n0(o.n), sec: n0(o.sec), yahoo: n0(o.yahoo), fail: n0(o.fail), ms: n0(o.ms), ni: n0(o.ni),
    face: { n: n0(f.n), ok: n0(f.ok), cos: n0(f.cos), coOk: n0(f.coOk) },
    gold: { n: n0(g.n), bad: n0(g.bad) }, gr: { n: n0(o.gr && o.gr.n) }, kinds: normKinds(o.kinds), ys: syms(o.ys, 100), fs: syms(o.fs, 100),
    cos: (Array.isArray(o.cos) ? o.cos : []).filter((c) => c && SYM_RE.test(str(c.sym, 12))).slice(0, 200)
      .map((c) => ({ sym: str(c.sym, 12), n: n0(c.n), ok: n0(c.ok), form: str(c.form, 6), url: /^https:\/\/www\.sec\.gov\/Archives\//.test(String(c.url || '')) ? str(c.url, 200) : '' })),
    items: (Array.isArray(o.items) ? o.items : []).filter((x) => x && SYM_RE.test(str(x.sym, 12)) && /^[a-z0-9]{1,8}$/.test(str(x.k, 8))).slice(0, ITEMS_MAX)
      .map((x) => ({ sym: str(x.sym, 12), k: str(x.k, 8), m: x.m ? str(x.m, 8) : null, p: x.p ? str(x.p, 12) : null, f: numOrNull(x.f), v: numOrNull(x.v) })),
    x: normX(o.x),
  };
}
function normHist(h) {
  return (Array.isArray(h) ? h : []).filter((x) => x && Date.parse(x.at)).slice(-HIST_MAX).map((x) => ({
    at: new Date(Date.parse(x.at)).toISOString(), n: n0(x.n), sec: n0(x.sec), y: n0(x.y), x: n0(x.x), fn: n0(x.fn), fo: n0(x.fo),
    cos: n0(x.cos), cok: n0(x.cok), gn: n0(x.gn), gb: n0(x.gb), k: normKinds(x.k), xn: nOrNull(x.xn), xp: nOrNull(x.xp), xb: nOrNull(x.xb) }));
}

const pct = (a, b) => (b ? Math.round(a / b * 10000) / 100 : null);
// כמה ערכים לבדוק יכולים להתווסף בלי שזה אומר משהו: 5, או 2% מהריצה הקודמת
const xNoise = (p) => Math.max(5, Math.round(0.02 * (p || 0)));

/* ההתראה למנהל: רק מה שאומר שמשהו נשבר — סט הזהב זז, ההתאמה לדוח ירדה ביותר מ־0.5 נקודה, או ש־5% מהחברות נכשלו.
   prev = השורה הקודמת בהיסטוריה (לפני cur) */
function auditAlert(cur, prev) {
  if (!cur) return null;
  const why = [];
  if (cur.gold && cur.gold.bad) why.push('gold');
  const fp = pct(cur.face.ok, cur.face.n), pp = prev ? pct(prev.fo, prev.fn) : null;
  if (fp != null && pp != null && pp - fp > 0.5) why.push('face');
  if (cur.n && cur.fail / cur.n > 0.05) why.push('fail');
  // שכבה 7: צמיחה שלא תואמת לדוח — יותר מבריצה הקודמת (אמור להיות 0)
  if ((cur.kinds.gr || 0) > (prev ? (prev.k.gr || 0) : 0)) why.push('gr');
  // שכבה 8: עוד ערך שונה מ־SEC (bug), או שמספר הערכים לבדוק עלה מעבר לרעש של המקורות החיצוניים (Yahoo/Nasdaq מתעדכנים כל יום) —
  // רק מול ריצה קודמת שהייתה בה שכבה 8
  if (cur.x && prev && prev.xp != null && (cur.x.b > (prev.xb || 0) || cur.x.p > prev.xp + xNoise(prev.xp))) why.push('x');
  return why.length ? why : null;
}

/* מרכז הניהול ← מעבדת השיפור ← דיוק הנתונים */
function auditView(cur, hist, now) {
  if (!cur) return null;
  const h = normHist(hist).filter((x) => x.at !== cur.at);
  const prev = h.length ? h[h.length - 1] : null;
  const fp = pct(cur.face.ok, cur.face.n);
  return {
    at: cur.at, age: Math.max(0, Math.round((now - Date.parse(cur.at)) / 3600e3)), n: cur.n, sec: cur.sec, yahoo: cur.yahoo, fail: cur.fail,
    face: { n: cur.face.n, ok: cur.face.ok, pct: fp, cos: cur.face.cos, coOk: cur.face.coOk, coPct: pct(cur.face.coOk, cur.face.cos),
      d: prev && fp != null ? Math.round((fp - pct(prev.fo, prev.fn)) * 100) / 100 : null },
    gold: cur.gold, kinds: Object.entries(cur.kinds).sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ k, n, d: prev ? n - (prev.k[k] || 0) : null })),
    trend: h.concat([histEntry(cur)]).slice(-14).map((x) => pct(x.fo, x.fn)),
    cos: cur.cos.slice(0, 30), gi: cur.items.filter((x) => x.k === 'gold').slice(0, 30),
    items: cur.items.filter((x) => x.k !== 'gold').slice(0, 60), ni: cur.ni, ys: cur.ys, fs: cur.fs, alert: auditAlert(cur, prev),
    x: cur.x ? { n: cur.x.n, cos: cur.x.cos, p: cur.x.p, b: cur.x.b, d: prev && prev.xp != null ? cur.x.p - prev.xp : null,
      c: Object.entries(cur.x.c).sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ k, n })),
      pc: Object.entries(cur.x.pc).sort((a, b) => (XSEV[a[0]] ?? 9) - (XSEV[b[0]] ?? 9)).map(([k, n]) => ({ k, n })),
      why: Object.entries(cur.x.why).slice(0, 12).map(([k, n]) => ({ k, n })), items: cur.x.items.slice(0, 60),
      trend: h.concat([histEntry(cur)]).slice(-14).map((x) => x.xp).filter((v) => v != null) } : null,
  };
}

module.exports = { REL, growthAudit, goldCheck, summarize, xSummary, histEntry, pushHist, normAudit, normHist, auditAlert, auditView, HIST_MAX, ITEMS_MAX, XITEMS_MAX };
