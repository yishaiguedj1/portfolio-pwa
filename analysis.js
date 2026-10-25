/* מנתח החברות (25/10/2026, בקשת המשתמש — "מערכת לניתוח השקעות ערך", לפי תצוגה מקדימה 2 שאושרה).
   שכבה במסך מלא מעל Invest: תמונת מצב · דוחות · שווי. הנתונים מהשרתון בלבד (op:'fund' / op:'macro' ב־/api/history —
   SEC EDGAR לחברות אמריקאיות, Yahoo לת״א, אומדנים מ־Yahoo ו־Nasdaq/Zacks, ריבית מ־Treasury/FRED, ענפים מ־Damodaran).
   הכל מחושב בטלפון מהדוחות — בלי הזנה ידנית. השינויים של המשתמש בהנחות — בזיכרון בלבד (לא נשמרים, לא נתון אישי).
   נטען רק בלחיצה על "ניתוח" בכרטיס המניה (import דינמי מ־app.js). התלויות מוזרקות (env) — בלי ייבוא ובלי DOM בטעינה,
   כך שהפונקציות הטהורות נבדקות ב־node (tests/analysis.test.js). כל מחרוזת גלויה = T('an…') מ־STRINGS של app.js. */

let E = { t: (k) => k };
const T = (k, v) => (E && typeof E.t === 'function' ? E.t(k, v) : k);

/* ---------- מספרים ---------- */
const LRI = '⁦', PDI = '⁩', MINUS = '−';
const iso = (s) => LRI + s + PDI;
const strip = (s) => String(s).replace(/[⁦⁩]/g, '');
const curSym = (c) => (c === 'ILS' ? '₪' : c === 'EUR' ? '€' : c === 'GBP' ? '£' : '$');
function short(v, d) {
  const a = Math.abs(v);
  if (a >= 1e12) return (v / 1e12).toFixed(d ?? 2) + 'T';
  if (a >= 1e9) return (v / 1e9).toFixed(d ?? (a >= 1e11 ? 0 : a >= 1e10 ? 1 : 2)) + 'B';
  if (a >= 1e6) return (v / 1e6).toFixed(d ?? (a >= 1e8 ? 0 : 1)) + 'M';
  if (a >= 1e3) return (v / 1e3).toFixed(1) + 'K';
  return v.toFixed(d ?? 2);
}
function fmt(v, unit, co, d) {
  if (v == null || !isFinite(v)) return '—';
  const s = v < 0 ? MINUS : '', a = Math.abs(v);
  if (unit === 'money') return iso(s + curSym(co && co.cur) + short(a, d));
  if (unit === 'ps') return iso(s + curSym(co && co.cur) + a.toFixed(d ?? 2));
  if (unit === 'shares') return iso(s + short(a, d));
  if (unit === 'pct') return iso(s + (a * 100).toFixed(d ?? 1) + '%');
  if (unit === 'x') return iso(s + a.toFixed(d ?? 1) + '×');
  return iso(s + a.toFixed(d ?? 2));
}
const pct = (v, d = 1) => fmt(v, 'pct', null, d);
const sgn = (v, d = 1) => (v == null || !isFinite(v) ? '—' : iso((v >= 0 ? '+' : MINUS) + Math.abs(v * 100).toFixed(d) + '%'));
const clamp = (x, a, b) => Math.min(Math.max(x, a), b);
const fin = (a) => a.filter((x) => x != null && isFinite(x));
const median = (a) => { const v = fin(a).sort((x, y) => x - y); if (!v.length) return null; const m = v.length >> 1; return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };
const mean = (a) => { const v = fin(a); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
const quant = (a, q) => { const v = fin(a).sort((x, y) => x - y); if (!v.length) return null; const p = (v.length - 1) * q, i = Math.floor(p); return v[i] + (v[Math.min(i + 1, v.length - 1)] - v[i]) * (p - i); };
const stdev = (a) => { const m = mean(a), v = fin(a); return v.length > 1 ? Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / (v.length - 1)) : null; };
const cagr = (a, b, n) => (a > 0 && b > 0 && n > 0 ? (b / a) ** (1 / n) - 1 : null);
const dmy = (s) => (s ? s.slice(0, 10).split('-').reverse().join('/') : '');

/* ---------- הכנת התשובה של השרתון ---------- */
const MAX_FY = 12; // עד 12 שנים מוצגות (מעבר לזה — פיצולים ישנים שעוד לא מטופלים בכל המקרים, וגם לא נחוץ)
/* d = תשובת op:'fund', q = הציטוט החי מהאפליקציה (מחיר עדכני יותר), fx = דולר בשקלים */
function prep(d, q, fx) {
  const co = { ...d };
  const k = Math.max(0, d.fy.length - MAX_FY);
  co.fyE = d.fy.slice(k);
  co.years = co.fyE.map((e) => +e.slice(0, 4));
  co.A = {}; for (const m in d.A) co.A[m] = (d.A[m] || []).slice(k);
  const q0 = k > 0 ? d.fy[k - 1] : '0000';
  let j = d.q.findIndex((e) => e > q0); if (j < 0) j = d.q.length;
  co.q = d.q.slice(j); co.Q = {}; for (const m in d.Q) co.Q[m] = (d.Q[m] || []).slice(j);
  const p = d.prof || {};
  co.name = p.name || d.sym; co.exch = p.exch || ''; co.sector = p.sector || ''; co.industry = p.industry || '';
  co.ind = d.indData || {}; co.indName = d.ind || '';
  // מחיר: הציטוט החי של האפליקציה כשיש (השרתון שומר במטמון עד 12 שעות)
  if (q && q.close > 0) { co.price = q.close; if (q.prev > 0) co.prev = q.prev; else if (q.regClose > 0 && q.regCh != null) co.prev = q.regClose - q.regCh; }
  // מניה בת״א שמדווחת בדולרים (או ההפך) — המחיר מומר למטבע הדוחות, כדי שהמכפילים והשווי יהיו באותו מטבע
  const pxCur = /\.TA$/.test(d.sym) ? 'ILS' : 'USD';
  co.pxCur = pxCur; co.fxNote = false;
  if (co.cur !== pxCur && fx > 0 && (co.cur === 'USD' || co.cur === 'ILS')) {
    const r = pxCur === 'ILS' ? 1 / fx : fx;
    if (co.price) co.price *= r; if (co.prev) co.prev *= r;
    if (co.px) co.px = { t: co.px.t, c: co.px.c.map((x) => (x == null ? null : x * r)) };
    co.fxNote = true;
  }
  const keep = new Set(co.fyE);
  co.flags = (d.checks || []).filter((c) => keep.has(c.p));
  // ריט (SIC 6798) — לפי FFO; בנקים, ביטוח והשקעות — לפי ההון והתשואה עליו (עודף תשואה), לא לפי תזרים חופשי
  co.reit = d.sic === 6798 || /R\.E\.I\.T|REIT/i.test(co.indName);
  co.fin = !co.reit && ((d.sic >= 6000 && d.sic < 6500) || /Bank|Insurance|Financial Svcs|Brokerage|Invest|Reinsurance/i.test(co.indName));
  return co;
}

/* ענף עם מעט חברות אצל Damodaran (פחות מ־15) — הממוצעים שלו רועשים מדי; משווים לשוק כולו (בלי פיננסים) */
const MARKET_IND = 'Total Market (without financials)';
function indFix(co, mac) {
  const all = mac && mac.ind;
  if (co.ind && co.ind.n >= 15) return co;
  const mk = co.fin || co.reit ? 'Total Market' : MARKET_IND; // בנק/ריט — מול השוק כולו, לא "בלי פיננסים"
  if (all && all[mk]) { co.ind = all[mk]; co.indName = T('anIndMarket'); }
  return co;
}

/* ---------- תקופות ומדדים בסיסיים ---------- */
const INST = new Set(['cash', 'msec', 'debt', 'eq', 'ta', 'tl', 'ca', 'cl', 're', 'ppe']);
const SUMQ = (k) => !INST.has(k) && k !== 'sh'; // זרימה (כולל רווח למניה) = סכום 4 רבעונים; מאזן ומניות = הרבעון האחרון
const hasTTM = (co) => co.q.length >= 4 && co.q[co.q.length - 1] > co.fyE[co.fyE.length - 1];
function raw(co, k, p, back = 0) {
  if (p.kind === 'fy') { const i = p.i - back; return i >= 0 ? co.A[k]?.[i] ?? null : null; }
  const Q = co.Q[k] || [];
  if (p.kind === 'q') { const i = p.i - back * 4; return i >= 0 ? Q[i] ?? null : null; }
  if (!back && co.T && co.T[k] != null) return co.T[k];
  const end = co.q.length - 1 - back * 4;
  if (end < 0) return null;
  if (!SUMQ(k)) return Q[end] ?? null;
  if (end < 3) return null;
  let s = 0; for (let j = end - 3; j <= end; j++) { if (Q[j] == null) return null; s += Q[j]; }
  return s;
}
const qLabel = (e) => 'Q' + Math.ceil(+e.slice(5, 7) / 3) + '·' + e.slice(2, 4);
function periodList(co, mode) {
  if (mode === 'q') return co.q.map((e, i) => ({ kind: 'q', i, label: qLabel(e), end: e }));
  const l = co.fyE.map((e, i) => ({ kind: 'fy', i, label: String(co.years[i]), end: e }));
  if (hasTTM(co)) l.push({ kind: 'ttm', i: co.q.length - 1, label: 'TTM', end: co.q[co.q.length - 1] });
  return l;
}
const fyList = (co) => periodList(co, 'fy').filter((p) => p.kind === 'fy');
const nowP = (co) => { const l = periodList(co, 'fy'); return l[l.length - 1]; };
function ctx(co, p, back = 0) {
  const v = (k) => raw(co, k, p, back);
  const ann = p.kind === 'q' ? 4 : 1;
  const o = {};
  o.rev = v('rev'); o.gp = v('gp') ?? (o.rev != null && v('cogs') != null ? o.rev - v('cogs') : null);
  o.op = v('op'); o.ni = v('ni'); o.eps = v('eps'); o.sh = v('sh');
  o.ocf = v('ocf'); o.capex = v('capex'); o.sbc = v('sbc'); o.dep = v('dep'); o.int = v('int');
  o.fcf = o.ocf != null && o.capex != null ? o.ocf - o.capex : null;
  o.fcfsbc = o.fcf != null ? o.fcf - (o.sbc || 0) : null;
  o.cashT = v('cash') != null ? v('cash') + (v('msec') || 0) : null;
  o.debt = v('debt') ?? 0; o.eq = v('eq'); o.ta = v('ta'); o.tl = v('tl') ?? (o.ta != null && o.eq != null ? o.ta - o.eq : null);
  o.ca = v('ca'); o.cl = v('cl'); o.re = v('re'); o.ppe = v('ppe');
  o.netcash = o.cashT != null ? o.cashT - o.debt : null;
  o.ebitda = o.op != null && o.dep != null ? o.op + o.dep : null;
  o.ffo = o.ni != null && o.dep != null ? o.ni + o.dep : null; // FFO בקירוב (ריט): רווח נקי + פחת והפחתות, בלי ניכוי רווחים ממכירת נכסים
  o.dps = v('dps') ?? (v('divp') != null && o.sh ? v('divp') / o.sh : null);
  o.buy = v('buy');
  const pt = v('pretax'), tx = v('tax');
  o.t = pt > 0 && tx != null ? clamp(tx / pt, 0.1, 0.35) : 0.21;
  const ic = o.eq != null && o.cashT != null ? o.eq + o.debt - o.cashT : null;
  o.roic = o.op != null && ic > 0 ? o.op * (1 - o.t) * ann / ic : null;
  o.roe = o.ni != null && o.eq > 0 ? o.ni * ann / o.eq : null;
  const r = (x) => (x != null && o.rev ? x / o.rev : null);
  o.gm = r(o.gp); o.om = r(o.op); o.nm = r(o.ni); o.fcfm = r(o.fcf); o.ofm = r(o.fcfsbc);
  o.cr = o.ca && o.cl ? o.ca / o.cl : null;
  o.de = o.eq > 0 ? o.debt / o.eq : null;
  o.cov = o.op != null && o.int > 0 ? o.op / o.int : null;
  o.conv = o.fcf != null && o.ni > 0 ? o.fcf / o.ni : null;
  return o;
}
const growthOf = (co, p, k) => { const a = ctx(co, p)[k], b = ctx(co, p, 1)[k]; return a != null && b != null && b > 0 ? a / b - 1 : null; };
const fyVals = (co, k, n) => fyList(co).slice(-n).map((p) => ctx(co, p)[k]);
function cagrN(co, k, n) {
  const fy = fyList(co); if (fy.length <= n) n = fy.length - 1;
  if (n < 1) return [null, 0];
  return [cagr(ctx(co, fy[fy.length - 1 - n])[k], ctx(co, fy[fy.length - 1])[k], n), n];
}

/* ---------- היסטוריה חודשית של מכפילים (10 שנים) ---------- */
function ttmPoints(co, k) {
  const pts = [];
  co.fyE.forEach((e, i) => { const v = co.A[k]?.[i]; if (v != null) pts.push([e, v]); });
  const Q = co.Q[k] || [];
  for (let j = 3; j < co.q.length; j++) {
    if (co.T && j === co.q.length - 1 && co.T[k] != null) { pts.push([co.q[j], co.T[k]]); continue; }
    if (!SUMQ(k)) { if (Q[j] != null) pts.push([co.q[j], Q[j]]); continue; }
    let s = 0, ok = true; for (let x = j - 3; x <= j; x++) { if (Q[x] == null) { ok = false; break; } s += Q[x]; }
    if (ok) pts.push([co.q[j], s]);
  }
  return pts.sort((a, b) => (a[0] < b[0] ? -1 : 1));
}
function addMonths(ym, n) { let y = +ym.slice(0, 4), m = +ym.slice(5, 7) + n; while (m > 12) { m -= 12; y++; } while (m < 1) { m += 12; y--; } return y + '-' + String(m).padStart(2, '0'); }
function atMonth(pts, ym) { // מה שכבר פורסם באותו חודש (הדוח יוצא כחודש וחצי אחרי סוף התקופה)
  let v = null; for (const [e, x] of pts) { if (addMonths(e.slice(0, 7), 2) <= ym) v = x; else break; } return v;
}
function multHist(co) {
  if (co._mh) return co._mh;
  const out = { t: [], pe: [], pfcf: [], ps: [], evebit: [], pb: [], pffo: [] };
  if (!co.px || !co.px.t || !co.px.t.length) return (co._mh = out);
  const P = {}; for (const k of ['eps', 'rev', 'ocf', 'capex', 'op', 'sh', 'cash', 'msec', 'debt', 'eq', 'ni', 'dep']) P[k] = ttmPoints(co, k);
  const last = co.px.t[co.px.t.length - 1], first = addMonths(last, -120);
  co.px.t.forEach((ym, i) => {
    const c = co.px.c[i]; if (ym < first || c == null) return;
    const eps = atMonth(P.eps, ym), sh = atMonth(P.sh, ym), rev = atMonth(P.rev, ym), ocf = atMonth(P.ocf, ym), cx = atMonth(P.capex, ym), op = atMonth(P.op, ym);
    const cash = (atMonth(P.cash, ym) || 0) + (atMonth(P.msec, ym) || 0), debt = atMonth(P.debt, ym) || 0;
    const mc = sh ? c * sh : null, fcf = ocf != null && cx != null ? ocf - cx : null;
    out.t.push(ym);
    out.pe.push(eps > 0 ? c / eps : null);
    out.pfcf.push(mc && fcf > 0 ? mc / fcf : null);
    out.ps.push(mc && rev > 0 ? mc / rev : null);
    out.evebit.push(mc && op > 0 ? (mc + debt - cash) / op : null);
    const eq = atMonth(P.eq, ym), ni = atMonth(P.ni, ym), dep = atMonth(P.dep, ym), ffo = ni != null && dep != null ? ni + dep : null;
    out.pb.push(mc && eq > 0 ? mc / eq : null);
    out.pffo.push(mc && ffo > 0 ? mc / ffo : null);
  });
  // הנקודה האחרונה = היום: המחיר החי ו־12 החודשים האחרונים (כמו בראש המסך)
  const c = ctx(co, nowP(co)), mc = co.price * co.sharesOut, i = out.t.length - 1;
  if (i >= 0 && co.price > 0) {
    out.pe[i] = c.eps > 0 ? co.price / c.eps : null; out.pfcf[i] = c.fcf > 0 && mc ? mc / c.fcf : null; out.ps[i] = c.rev > 0 && mc ? mc / c.rev : null;
    out.evebit[i] = c.op > 0 && mc ? (mc + c.debt - (c.cashT || 0)) / c.op : null;
    out.pb[i] = c.eq > 0 && mc ? mc / c.eq : null; out.pffo[i] = c.ffo > 0 && mc ? mc / c.ffo : null;
  }
  return (co._mh = out);
}

/* ---------- הערכת שווי אוטומטית ---------- */
const DEF_RF = 0.042, DEF_ERP = 0.042;
function autoInputs(co, mac) {
  mac = mac || {};
  const P = nowP(co), c = ctx(co, P), fy = fyList(co), ind = co.ind || {};
  const il = /\.TA$/.test(co.sym), src = {}, val = {};
  // בסיס: תזרים לבעלים (FCF − SBC) ב־12 החודשים האחרונים — מנורמל כשהם חריגים
  const om5 = fy.slice(-5).map((p) => ctx(co, p).ofm), mMed = median(om5), nY = fin(om5).length;
  const normBase = mMed != null && c.rev ? c.rev * mMed : null, base = c.fcfsbc;
  if (normBase > 0 && (!(base > 0) || Math.abs(base / normBase - 1) > 0.5)) { val.base = normBase; src.base = T('anSrcBaseNorm', { m: strip(pct(mMed)), n: nY }); }
  else if (base > 0) { val.base = base; src.base = normBase > 0 ? T('anSrcBase') : T('anSrcBaseNeg', { n: nY }); }
  else { val.base = null; src.base = T('anSrcBaseNone'); }
  // צמיחה בשנים 1–2: קונצנזוס ההכנסות כשיש לפחות 3 אנליסטים
  const est = co.est || [], e0 = est.find((e) => e.p === '0y'), e1 = est.find((e) => e.p === '+1y');
  const revA = co.A.rev || [], lastRev = revA[revA.length - 1];
  const [c5, n5] = cagrN(co, 'rev', 5), [c3] = cagrN(co, 'rev', 3);
  const hist = clamp(Math.min(c5 ?? c3 ?? 0.05, c3 ?? c5 ?? 0.05), -0.05, 0.2);
  if (e0 && e0.rev && e0.rn >= 3 && lastRev) {
    val.g1 = clamp(e0.rev / lastRev - 1, -0.3, 0.6); val.g2 = e1 && e1.rev ? clamp(e1.rev / e0.rev - 1, -0.3, 0.6) : val.g1;
    src.g1 = T('anSrcCons', { n: e0.rn }); src.g2 = e1 && e1.rev ? T('anSrcCons', { n: e1.rn || e0.rn }) : src.g1;
  } else { val.g1 = val.g2 = hist; src.g1 = src.g2 = T('anSrcHist', { n: n5 }); }
  // מחיר ההון: CAPM עם בטא ענפית ממונפת מחדש (Damodaran), בין 0.8 ל־2
  const mcap = co.price * co.sharesOut, t = il ? (mac.taxIL || 0.23) : 0.25;
  const bu = ind.bu ?? 1, bl = clamp(bu * (1 + (1 - t) * (c.debt || 0) / (mcap || 1)), 0.8, 2);
  const rf = il ? (mac.rfIL || 0.0407) : (mac.rf || DEF_RF), erp = mac.erp || DEF_ERP, crp = il ? (mac.crpIL || 0) : 0;
  val.ke = rf + bl * erp + crp;
  src.ke = il ? T('anSrcKeIL', { rf: strip(pct(rf, 2)), b: bl.toFixed(2), erp: strip(pct(erp, 1)), crp: strip(pct(crp, 2)) })
    : T('anSrcKe', { rf: strip(pct(rf, 2)), b: bl.toFixed(2), erp: strip(pct(erp, 1)) });
  val.tg = Math.min(rf, 0.03); src.tg = T('anSrcTg');
  // מכפיל יציאה: אחוזונים של מכפיל הרווח של החברה עצמה ב־10 שנים
  const H = multHist(co), pes = H.pe.filter((x) => x > 0 && x < 150);
  val.peLo = quant(pes, 0.25); val.peMid = quant(pes, 0.5); val.peHi = quant(pes, 0.75);
  src.pe = pes.length >= 36 ? T('anSrcPe', { n: Math.round(pes.length / 12) }) : T('anSrcPeInd');
  if (pes.length < 36 && ind.fpe) { val.peLo = ind.fpe * 0.8; val.peMid = ind.fpe; val.peHi = ind.fpe * 1.2; }
  // תקרה למכפיל היציאה: חברה שנסחרה שנים במכפיל חריג (צמיחה מהירה) לא תישאר שם לנצח — עד פי 1.5 מהענף (או 40 בלי נתון ענפי)
  const cap = ind.fpe > 0 ? Math.max(ind.fpe * 1.5, 15) : 40;
  if (val.peMid > cap) { val.peLo = Math.min(val.peLo, cap * 0.8); val.peMid = cap; val.peHi = Math.min(val.peHi, cap * 1.2); src.pe = T('anSrcPeCap', { v: Math.round(cap) }); }
  val.epsPath = epsPath(co);
  val.netcash = c.netcash || 0; val.sh = co.sharesOut;
  val.marg = [quant(om5, 0.25), mMed, quant(om5, 0.75)];
  return { val, src, bl, rf };
}
function epsPath(co) {
  const est = co.est || [], eps0 = ctx(co, nowP(co)).eps, fy0 = co.years[co.years.length - 1];
  const pts = [];
  const e0 = est.find((e) => e.p === '0y'), e1 = est.find((e) => e.p === '+1y');
  if (e0 && e0.eps && e0.n >= 3) pts.push([fy0 + 1, e0.eps]);
  if (e1 && e1.eps && e1.n >= 3) pts.push([fy0 + 2, e1.eps]);
  for (const r of co.nq || []) { const y = +String(r.fy).slice(-4); if (y > fy0 + 2 && r.n >= 5 && r.eps > 0) pts.push([y, r.eps]); }
  return { eps0, fy0, pts };
}
const msOf = (v, i) => { const r = v.marg[1] > 0 ? v.marg[i] / v.marg[1] : null; return r > 0 ? clamp(r, i ? 1 : 0.5, i ? 1.6 : 1) : (i ? 1.2 : 0.8); };
function fadeGrowth(g0, gT, n) { const out = []; let g = g0; for (let i = 0; i < n; i++) { out.push(g); g = gT + (g - gT) * 0.7; } return out; }
function dcf(inp, over = {}) {
  const v = { ...inp, ...over };
  const g = [v.g1, v.g2, ...fadeGrowth(v.g2, v.tg, 9).slice(1)].slice(0, 10).map((x) => x * (v.gs ?? 1));
  let cf = v.base * (v.ms ?? 1), pv = 0;
  const rows = [];
  for (let i = 0; i < 10; i++) { cf *= 1 + g[i]; pv += cf / (1 + v.ke) ** (i + 1); rows.push(cf); }
  const tv = cf * (1 + v.tg) / (v.ke - v.tg) / (1 + v.ke) ** 10;
  const eq = pv + tv + v.netcash;
  return { ps: eq / v.sh, tvShare: tv / (pv + tv), rows, g, eq };
}
const scenarios = (V) => ({ base: dcf(V), bear: dcf(V, { gs: 0.6, ms: msOf(V, 0) }), bull: dcf(V, { gs: 1.3, ms: msOf(V, 2) }) });
function reverseG(inp, target) { // צמיחה בשנתיים הראשונות (ואז דעיכה) שמסבירה את המחיר של היום
  if (!(inp.base > 0) || !(target > 0)) return null;
  let lo = -0.3, hi = 0.8;
  if (dcf(inp, { g1: hi, g2: hi, gs: 1 }).ps < target) return null; // אפילו 80% בשנה לא מסביר את המחיר
  if (dcf(inp, { g1: lo, g2: lo, gs: 1 }).ps > target) return null; // גם ירידה של 30% בשנה שווה יותר מהמחיר
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (dcf(inp, { g1: m, g2: m, gs: 1 }).ps < target) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
function multModel(co, inp, scen) {
  const { eps0, fy0, pts } = inp.epsPath, H = 5;
  if (!(eps0 > 0) || !(inp.peMid > 0) || !(co.price > 0)) return null;
  const k = { lo: 0.75, mid: 1, hi: 1.2 }[scen];
  let prev = eps0, lastG = inp.g2;
  const path = [];
  for (let y = fy0 + 1; y <= fy0 + H; y++) {
    const p = pts.find((x) => x[0] === y);
    if (p) { lastG = p[1] / prev - 1; prev = p[1]; } else { lastG = 0.06 + (lastG - 0.06) * 0.7; prev *= 1 + lastG; }
    path.push(prev);
  }
  const eps5 = eps0 + (path[path.length - 1] - eps0) * k;
  const pe = { lo: inp.peLo, mid: inp.peMid, hi: inp.peHi }[scen];
  const tgt = eps5 * pe;
  const fyEnd = new Date(co.fyE[co.fyE.length - 1]); fyEnd.setUTCFullYear(fyEnd.getUTCFullYear() + H);
  const yrs = Math.max(0.5, (fyEnd - new Date(co.asOf)) / 31557600000);
  const cNow = ctx(co, nowP(co)), dy = cNow.dps ? cNow.dps / co.price : 0;
  return { eps5, pe, tgt, yrs, ret: tgt > 0 ? (tgt / co.price) ** (1 / yrs) - 1 + dy : null, year: fy0 + H };
}
function uncertainty(co) {
  // בנק/ביטוח — תנודתיות ה־ROE (אין להם "שולי רווח תפעולי"), והחוב הוא חומר הגלם ולא מינוף
  const om = fyVals(co, co.fin ? 'roe' : 'om', 10), s = stdev(om) ?? (co.fin ? 0.03 : 0.05), c = ctx(co, nowP(co)), th = co.fin ? 0.6 : 1;
  const lev = !co.fin && c.ebitda > 0 ? Math.max(0, -(c.netcash || 0)) / c.ebitda : 0;
  const e1 = (co.est || []).find((e) => e.p === '+1y');
  let sc = 0; if (s > 0.05 * th) sc++; if (s > 0.1 * th) sc++; if (lev > 2) sc++; if ((e1 && e1.n || 0) < 3) sc++; if (co.years.length < 6) sc++;
  const lv = Math.min(3, sc);
  return { lv, band: [[0.8, 1.25], [0.7, 1.35], [0.6, 1.55], [0.5, 1.75]][lv], s };
}
/* --- בנקים, ביטוח וחברות השקעה: עודף תשואה (Residual Income) ---
   שווי למניה = ההון למניה × (ROE − g) ÷ (Ke − g) = ההון + ההון × (ROE − Ke) ÷ (Ke − g). ‏ROE מתמשך = חציון 5 שנים (+12 החודשים האחרונים),
   דוב ושור = רבעון תחתון ועליון של 10 שנים. בטא = הממונפת של הענף (Damodaran) — בבנק החוב הוא חומר הגלם, ומינוף מחדש מנפח אותה */
function finInputs(co, mac) {
  mac = mac || {};
  const c = ctx(co, nowP(co)), ind = co.ind || {}, il = /\.TA$/.test(co.sym), src = {}, val = {};
  const sh = co.sharesOut || c.sh;
  val.bv = c.eq > 0 && sh ? c.eq / sh : null; src.bv = T('anSrcBv');
  const rf = il ? (mac.rfIL || 0.0407) : (mac.rf || DEF_RF), erp = mac.erp || DEF_ERP, crp = il ? (mac.crpIL || 0) : 0;
  const b = clamp(ind.bl ?? ind.bu ?? 1, 0.8, 2);
  val.ke = rf + b * erp + crp;
  src.ke = T(il ? 'anSrcKeFinIL' : 'anSrcKeFin', { rf: strip(pct(rf, 2)), b: b.toFixed(2), erp: strip(pct(erp, 1)), crp: strip(pct(crp, 2)) });
  val.tg = Math.min(rf, 0.03); src.tg = T('anSrcTg');
  const ttm = hasTTM(co) ? [c.roe] : [], r5 = fin([...fyVals(co, 'roe', 5), ...ttm]), r10 = fin([...fyVals(co, 'roe', 10), ...ttm]);
  // תקרה: ROE מתמשך לא יותר מפי 1.5 מהענף (ולפחות מחיר ההון + 4 נק׳) — שנה חריגה לא נמשכת לנצח
  const cap = ind.roe > 0 ? Math.max(ind.roe * 1.5, val.ke + 0.04) : 0.35, cl = (x) => (x == null ? null : clamp(x, -0.05, cap));
  const raw5 = median(r5);
  val.roe = cl(raw5); val.roe5 = raw5;
  // דוב ושור: רבעון תחתון ועליון של 10 שנים, ולפחות 2 נק׳ מה־ROE המתמשך (גם כשהוא בתקרה)
  val.roeLo = val.roe == null ? null : Math.min(cl(quant(r10, 0.25)) ?? val.roe, val.roe - 0.02);
  val.roeHi = val.roe == null ? null : Math.max(cl(quant(r10, 0.75)) ?? val.roe, val.roe + 0.02);
  const n5 = r5.length - ttm.filter((x) => x != null).length;
  src.roe = raw5 != null && raw5 > cap ? T('anSrcRoeCap', { n: n5, v: strip(pct(cap, 0)) }) : T('anSrcRoe', { n: n5 });
  return { val, src, b, rf };
}
function riValue(v, over = {}) {
  const x = { ...v, ...over };
  if (!(x.bv > 0) || x.roe == null || x.roe <= x.tg) return null; // ROE מתחת לצמיחה — אין שווי חיובי במודל
  const pb = (x.roe - x.tg) / Math.max(x.ke - x.tg, 0.01);
  return { pb, ps: x.bv * pb };
}
const impliedRoe = (v, price) => (v.bv > 0 && price > 0 ? v.tg + price / v.bv * (v.ke - v.tg) : null);

/* --- ריט: FFO למניה × מחיר ל־FFO של החברה עצמה (אחוזונים של 10 שנים חודשיות) --- */
function reitInputs(co) {
  const c = ctx(co, nowP(co)), sh = co.sharesOut || c.sh, H = multHist(co);
  const ffops = c.ffo > 0 && sh ? c.ffo / sh : null, a = H.pffo.filter((x) => x > 0 && x < 100);
  const fy = fyList(co), fps = fy.map((p) => { const x = ctx(co, p); return x.ffo != null && x.sh ? x.ffo / x.sh : null; });
  const nf = Math.min(5, fps.length - 1), g = nf > 0 ? cagr(fps[fps.length - 1 - nf], fps[fps.length - 1], nf) : null;
  return { ffops, m: a.length >= 36 ? [quant(a, 0.25), quant(a, 0.5), quant(a, 0.75)] : null, years: Math.round(a.length / 12),
    pay: ffops && c.dps ? c.dps / ffops : null, g, nf, now: ffops && co.price ? co.price / ffops : null };
}

/* --- השווי לפי סוג החברה: DCF / עודף תשואה / FFO — אותם שלושה תרחישים בכל המסכים --- */
function fairOf(co, mac) {
  if (co.reit) {
    const R = reitInputs(co);
    return R.ffops > 0 && R.m ? { kind: 'ffo', bear: { ps: R.ffops * R.m[0] }, base: { ps: R.ffops * R.m[1] }, bull: { ps: R.ffops * R.m[2] } } : null;
  }
  if (co.fin) {
    const V = finInputs(co, mac).val, base = riValue(V);
    return base ? { kind: 'ri', base, bear: riValue(V, { roe: V.roeLo }) || { ps: 0 }, bull: riValue(V, { roe: V.roeHi }) || base } : null;
  }
  const V = autoInputs(co, mac).val;
  return V.base > 0 ? { kind: 'dcf', ...scenarios(V) } : null;
}

/* --- חברה בלי תזרים חיובי לבעלים: מה שכן אפשר למדוד --- */
function lossView(co) {
  const c = ctx(co, nowP(co)), H = multHist(co), ps = H.ps.filter((x) => x > 0 && x < 300);
  const g = growthOf(co, nowP(co), 'rev');
  const f = c.fcf ?? c.ocf, m = f != null && c.rev > 0 ? (f - (c.sbc || 0)) / c.rev : null, r40 = g != null && m != null ? g + m : null;
  const burn = f != null && f < 0 ? -f : null, runway = burn && c.cashT != null ? c.cashT / burn : null;
  return { psNow: fin(H.ps).pop() ?? null, psMed: ps.length >= 12 ? median(ps) : null, years: Math.round(ps.length / 12), g, m, r40, burn, cash: c.cashT, runway };
}
const uncName = (lv) => [T('anUnc0'), T('anUnc1'), T('anUnc2'), T('anUnc3')][lv];

/* ---------- בדיקות הבריאות (4 × 6) ---------- */
function piotroski(co) {
  const fy = fyList(co); if (fy.length < 3) return null;
  const a = ctx(co, fy[fy.length - 1]), b = ctx(co, fy[fy.length - 2]), b0 = ctx(co, fy[fy.length - 3]);
  const roa = (x, y) => (x.ni != null && y.ta ? x.ni / y.ta : null);
  const lev = (x, y) => (x.debt != null && x.ta && y.ta ? x.debt / ((x.ta + y.ta) / 2) : null);
  const list = [[T('anPf1'), roa(a, b) > 0], [T('anPf2'), a.ocf > 0], [T('anPf3'), roa(a, b) > roa(b, b0)], [T('anPf4'), a.ocf > a.ni],
    [T('anPf5'), lev(a, b) != null && lev(b, b0) != null ? lev(a, b) <= lev(b, b0) : null], [T('anPf6'), a.cr != null && b.cr != null ? a.cr > b.cr : null],
    [T('anPf7'), a.sh && b.sh ? a.sh <= b.sh * 1.005 : null], [T('anPf8'), a.gm != null && b.gm != null ? a.gm > b.gm : null],
    [T('anPf9'), a.rev && b.ta && b.rev && b0.ta ? a.rev / b.ta > b.rev / b0.ta : null]];
  return { f: list.filter((x) => x[1] === true).length, list };
}
function altman(co) {
  const a = ctx(co, fyList(co)[fyList(co).length - 1]);
  if (!a.ta || a.ca == null || a.cl == null || a.re == null || !a.tl || a.op == null) return null;
  // Z'' — לחברות שאינן מפעלי ייצור (טכנולוגיה ושירותים): בלי מכירות/נכסים, עם הון בספרים
  const z = 6.56 * (a.ca - a.cl) / a.ta + 3.26 * a.re / a.ta + 6.72 * a.op / a.ta + 1.05 * (a.eq || 0) / a.tl;
  return { z, safe: z > 2.6 };
}
function checks(co, mac) {
  const P = nowP(co), c = ctx(co, P), fy = fyList(co), ind = co.ind || {}, H = multHist(co), I = autoInputs(co, mac), V = I.val;
  const mcap = co.price * co.sharesOut, ev = mcap + c.debt - (c.cashT || 0);
  const pe = c.eps > 0 ? co.price / c.eps : null, pfcf = c.fcf > 0 ? mcap / c.fcf : null;
  const peMed = median(H.pe.filter((x) => x > 0 && x < 150)), pfMed = median(H.pfcf.filter((x) => x > 0 && x < 300));
  const ey = c.op > 0 && ev > 0 ? c.op / ev : null, FV = fairOf(co, mac), fair = FV && FV.base.ps > 0 ? FV.base.ps : null;
  const e1 = (co.est || []).find((e) => e.p === '+1y'), e0 = (co.est || []).find((e) => e.p === '0y');
  const fpe = co.fpe, epsG = e0 && e0.eps && e1 && e1.eps ? e1.eps / e0.eps - 1 : null, peg = fpe && epsG > 0 ? fpe / (epsG * 100) : null;
  const [r5, nr] = cagrN(co, 'rev', 5), [eg, ne] = cagrN(co, 'eps', 5);
  const fps = fy.map((p) => { const x = ctx(co, p); return x.fcf != null && x.sh ? x.fcf / x.sh : null; });
  const nf = Math.min(5, fps.length - 1), fpsG = nf > 0 ? cagr(fps[fps.length - 1 - nf], fps[fps.length - 1], nf) : null;
  const revG = growthOf(co, P, 'rev');
  const sh3 = fy.length > 3 && c.sh && ctx(co, fy[fy.length - 4]).sh ? c.sh / ctx(co, fy[fy.length - 4]).sh - 1 : null;
  const roic5 = mean(fyVals(co, 'roic', 5)), gmS = stdev(fyVals(co, 'gm', 5)), conv3 = mean(fyVals(co, 'conv', 3)), fcfPos = fin(fyVals(co, 'fcf', 5));
  const lev = c.ebitda > 0 && c.netcash != null ? -c.netcash / c.ebitda : null;
  const f = piotroski(co), z = altman(co), iname = co.indName || T('anIndustry');
  const X = (q, v, thr, pass, ex) => ({ q, v, thr, pass, ex });
  return {
    value: { n: T('anGValue'), chk: [
      X(T('anCv1'), fmt(pe, 'x', co, 1), T('anCv1t', { v: strip(fmt(peMed, 'x', co, 1)) }), pe && peMed ? pe < peMed : null, T('anCv1x')),
      X(T('anCv2'), fmt(pfcf, 'x', co, 1), T('anCv2t', { v: strip(fmt(pfMed, 'x', co, 1)) }), pfcf && pfMed ? pfcf < pfMed : null, T('anCv2x')),
      X(T('anCv3'), pct(ey), T('anCv3t', { v: strip(pct(I.rf, 2)) }), ey != null ? ey > I.rf : null, T('anCv3x')),
      X(T('anCv4'), fmt(co.price, 'ps', co), T('anCv4t', { v: strip(fmt(fair, 'ps', co)) }), fair > 0 ? co.price < fair : null, T('anCv4x')),
      X(T('anCv5'), peg ? iso(peg.toFixed(2)) : '—', T('anCv5t'), peg ? peg < 1.5 : null, T('anCv5x')),
      X(T('anCv6'), fmt(fpe, 'x', co, 1), iname + ' ' + strip(fmt(ind.fpe, 'x', co, 1)), fpe && ind.fpe ? fpe < ind.fpe : null, T('anCv6x')),
    ] },
    growth: { n: T('anGGrowth'), chk: [
      X(T('anCg1'), sgn(r5), T('anCagrN', { n: nr }), r5 != null ? r5 > 0.08 : null, T('anCg1x')),
      X(T('anCg2'), sgn(revG), T('anCg2t'), revG != null ? revG > 0 : null, T('anCg2x')),
      X(T('anCg3'), sgn(eg), T('anCagrN', { n: ne }), eg != null ? eg > 0.08 : null, T('anCg3x')),
      X(T('anCg4'), sgn(fpsG), T('anCagrN', { n: nf }), fpsG != null ? fpsG > 0.05 : null, T('anCg4x')),
      X(T('anCg5'), sgn(epsG), T('anCg5t'), epsG != null ? epsG > 0 : null, T('anCg5x')),
      X(T('anCg6'), sgn(sh3), T('anYears3'), sh3 != null ? sh3 <= 0.01 : null, T('anCg6x')),
    ] },
    profit: { n: T('anGProfit'), chk: [
      X(T('anCp1'), pct(c.roic), T('anCp1t'), c.roic != null ? c.roic > 0.15 : null, T('anCp1x')),
      X(T('anCp2'), pct(roic5), T('anAvg5'), roic5 != null ? roic5 > 0.12 : null, T('anCp2x')),
      X(T('anCp3'), pct(c.om), iname + ' ' + strip(pct(ind.om)), c.om != null && ind.om != null ? c.om > ind.om : null, T('anCp3x')),
      X(T('anCp4'), gmS != null ? iso((gmS * 100).toFixed(1)) + ' ' + T('anPts') : '—', T('anCp4t'), gmS != null ? gmS < 0.05 : null, T('anCp4x')),
      X(T('anCp5'), pct(conv3, 0), T('anCp5t'), conv3 != null ? conv3 > 0.8 : null, T('anCp5x')),
      X(T('anCp6'), iso(fcfPos.filter((x) => x > 0).length + '/' + fcfPos.length), T('anCp6t'), fcfPos.length ? fcfPos.every((x) => x > 0) : null, T('anCp6x')),
    ] },
    safe: { n: T('anGSafe'), chk: [
      X(T('anCs1'), c.netcash >= 0 ? T('anNetCash') : lev != null ? iso(lev.toFixed(1) + '×') : '—', T('anCs1t'), c.netcash >= 0 || (lev != null && lev < 1), T('anCs1x')),
      X(T('anCs2'), c.cov ? iso(c.cov.toFixed(0) + '×') : '—', T('anCs2t'), c.cov != null ? c.cov > 8 : c.debt ? null : true, T('anCs2x')),
      X(T('anCs3'), c.cr ? iso(c.cr.toFixed(2)) : '—', T('anCs3t'), c.cr != null ? c.cr > 1 : null, T('anCs3x')),
      X(T('anCs4'), z ? iso(z.z.toFixed(1)) : '—', T('anCs4t'), z ? z.safe : null, T('anCs4x')),
      X(T('anCs5'), f ? iso(f.f + '/9') : '—', T('anCs5t'), f ? f.f >= 6 : null, f ? f.list.map(([tt, ok]) => (ok ? '✓ ' : ok === false ? '✕ ' : '– ') + tt).join(' · ') : ''),
      X(T('anCs6'), c.de != null ? iso(c.de.toFixed(2)) : '—', T('anCs6t'), c.de != null ? c.de < 0.5 : null, T('anCs6x')),
    ] },
  };
}
const passN = (g) => g.chk.filter((x) => x.pass === true).length;

/* ---------- ציור (SVG) ---------- */
const NS = 'http://www.w3.org/2000/svg';
const sv = (tg, a = {}, p) => { const e = document.createElementNS(NS, tg); for (const k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
let ROOT = null;
const cssv = (n) => (ROOT ? getComputedStyle(ROOT).getPropertyValue('--an-' + n).trim() : '');
function nice(lo, hi, n = 4) {
  if (lo === hi) hi = lo + 1;
  const step0 = (hi - lo) / n, mag = 10 ** Math.floor(Math.log10(step0)), f = step0 / mag;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag;
  return { lo: Math.floor(lo / step) * step, hi: Math.ceil(hi / step) * step, step };
}
function axisLabel(v, sc, u, co) {
  const m = Math.max(Math.abs(sc.lo), Math.abs(sc.hi)), dec = (st) => (st >= 1 ? 0 : st >= 0.1 ? 1 : 2);
  if (u === 'pct') return fmt(v, 'pct', null, dec(sc.step * 100));
  if (u === 'x') return fmt(v, 'x', null, dec(sc.step));
  if (u === 'ps') return fmt(v, 'ps', co, dec(sc.step));
  if (u === 'num') return iso(v.toFixed(dec(sc.step)));
  const div = m >= 1e12 ? 1e12 : m >= 1e9 ? 1e9 : m >= 1e6 ? 1e6 : m >= 1e3 ? 1e3 : 1, suf = { 1e12: 'T', 1e9: 'B', 1e6: 'M', 1e3: 'K', 1: '' }[div];
  return iso((v < 0 ? MINUS : '') + (u === 'money' ? curSym(co.cur) : '') + (Math.abs(v) / div).toFixed(dec(sc.step / div)) + (v ? suf : ''));
}
/* גרף עמודות או קו. opt: {labels, tipLabels, series:[{name,color,vals}], unit, co, h, avg, avgName, line, tipHost} */
function drawChart(host, opt) {
  host.textContent = '';
  const W = Math.max(host.clientWidth, 120), H = opt.h, yW = 48, padT = 8, padB = 22;
  const svg = sv('svg', { viewBox: `0 0 ${W} ${H}`, height: H, role: 'img', 'aria-label': opt.title || '' }, host);
  const all = fin(opt.series.flatMap((s) => s.vals));
  if (!all.length) { sv('text', { x: W / 2, y: H / 2, 'text-anchor': 'middle' }, svg).textContent = T('anNoData'); return; }
  const lo0 = Math.min(...all), hi0 = Math.max(...all);
  const sc = nice(opt.line ? Math.min(lo0, opt.avg ?? lo0) * (lo0 > 0 ? 0.9 : 1) : Math.min(0, lo0), Math.max(opt.line ? hi0 : Math.max(0, hi0), opt.avg ?? -Infinity), 4);
  const y = (v) => padT + (sc.hi - v) / (sc.hi - sc.lo) * (H - padT - padB);
  const x0 = yW, plotW = W - yW - 4, n = opt.labels.length, band = plotW / n;
  for (let v = sc.lo; v <= sc.hi + sc.step / 2; v += sc.step) {
    sv('line', { x1: x0, x2: x0 + plotW, y1: y(v), y2: y(v), stroke: cssv(Math.abs(v) < sc.step / 1e6 ? 'ink3' : 'grid') }, svg);
    sv('text', { x: x0 - 6, y: y(v) + 4, 'text-anchor': 'end' }, svg).textContent = strip(axisLabel(v, sc, opt.unit, opt.co));
  }
  const hl = sv('rect', { x: 0, y: padT, width: band, height: H - padT - padB, fill: cssv('band'), rx: 6, opacity: 0 }, svg);
  const k = opt.series.length;
  if (opt.line) {
    opt.series.forEach((s) => {
      let d = '', pen = false;
      s.vals.forEach((v, i) => { if (v == null) { pen = false; return; } d += (pen ? 'L' : 'M') + (x0 + i * band + band / 2).toFixed(1) + ',' + y(v).toFixed(1); pen = true; });
      sv('path', { d, fill: 'none', stroke: s.color, 'stroke-width': 2, 'stroke-linejoin': 'round' }, svg);
      const li = s.vals.length - 1;
      if (s.vals[li] != null) sv('circle', { cx: x0 + li * band + band / 2, cy: y(s.vals[li]), r: 4, fill: s.color, stroke: cssv('card'), 'stroke-width': 2 }, svg);
    });
  } else {
    const gap = Math.max(2, band * (k > 1 ? 0.18 : 0.28)), bw = Math.max(2, (band - gap) / k - (k > 1 ? 1.5 : 0));
    opt.series.forEach((s, j) => s.vals.forEach((v, i) => {
      if (v == null || !isFinite(v)) return;
      const bx = x0 + i * band + gap / 2 + j * (bw + (k > 1 ? 1.5 : 0)), y1 = y(Math.max(v, 0)), y2 = y(Math.min(v, 0)), hh = Math.max(1, y2 - y1), r = Math.min(4, bw / 2, hh);
      const d = v >= 0 ? `M${bx},${y2} V${y1 + r} Q${bx},${y1} ${bx + r},${y1} H${bx + bw - r} Q${bx + bw},${y1} ${bx + bw},${y1 + r} V${y2} Z`
        : `M${bx},${y1} V${y2 - r} Q${bx},${y2} ${bx + r},${y2} H${bx + bw - r} Q${bx + bw},${y2} ${bx + bw},${y2 - r} V${y1} Z`;
      sv('path', { d, fill: s.color }, svg);
    }));
  }
  if (opt.avg != null && isFinite(opt.avg)) {
    sv('line', { x1: x0, x2: x0 + plotW, y1: y(opt.avg), y2: y(opt.avg), stroke: cssv('ink2'), 'stroke-width': 1.5, 'stroke-dasharray': '5 4' }, svg);
    const tx = sv('text', { x: x0 + 4, y: y(opt.avg) - 6, 'text-anchor': 'start', class: 'an-avg' }, svg);
    tx.textContent = strip(fmt(opt.avg, opt.unit, opt.co)) + '  ' + (opt.avgName || T('anAvg')); // הערך ראשון — ה־SVG ב־LTR, וכך המילה העברית לא מפרקת את המספר
  }
  if (opt.line) {
    let lx = -1e9;
    opt.labels.forEach((l, i) => { const xx = x0 + i * band + band / 2; if (!l || xx - lx < 40) return; lx = xx; sv('text', { x: xx, y: H - 5, 'text-anchor': 'middle' }, svg).textContent = l; });
  } else {
    const every = Math.ceil(n / Math.max(1, Math.floor(plotW / 44)));
    opt.labels.forEach((l, i) => { if ((n - 1 - i) % every) return; sv('text', { x: x0 + i * band + band / 2, y: H - 5, 'text-anchor': 'middle' }, svg).textContent = l; });
  }
  const tip = opt.tipHost;
  const show = (i) => {
    if (i < 0 || i >= n || !tip) return;
    hl.setAttribute('x', x0 + i * band); hl.setAttribute('opacity', 1);
    tip.textContent = '';
    tip.append(h('div', { class: 'an-tip-h' }, (opt.tipLabels || opt.labels)[i]));
    for (const s of opt.series) {
      const nm = h('span', {}, k > 1 ? h('i', { style: `background:${s.color}` }) : null, s.name);
      tip.append(h('div', { class: 'an-tip-r' }, nm, h('b', {}, fmt(s.vals[i], opt.unit, opt.co))));
    }
    tip.hidden = false;
  };
  const idx = (e) => { const r = svg.getBoundingClientRect(); return Math.floor(((e.clientX - r.left) * W / r.width - x0) / band); };
  let cur = -1, shut = false;
  svg.addEventListener('pointerdown', (e) => {
    const i = idx(e);
    // נגיעה חוזרת באותה עמודה סוגרת
    shut = !!tip && !tip.hidden && i === cur;
    if (shut) { tip._hide(); cur = -1; } else { show(i); cur = i; }
  });
  svg.addEventListener('pointermove', (e) => {
    if (shut || !(e.pointerType === 'mouse' || e.buttons)) return;
    const i = idx(e); if (i !== cur) { show(i); cur = i; }
  });
  const hide = () => { hl.setAttribute('opacity', 0); cur = -1; if (tip) tip.hidden = true; };
  svg.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') hide(); });
  if (!tip) return;
  // נגיעה בכל מקום מחוץ לגרף סוגרת את הבועה — שלא תסתיר את שאר העמודות
  tip._svg = svg; tip._hide = hide;
  if (!tip._wired) {
    tip._wired = true;
    const off = (e) => {
      if (!tip.isConnected) { document.removeEventListener('pointerdown', off, true); return; }
      if (!tip.hidden && !tip._svg.contains(e.target)) tip._hide();
    };
    document.addEventListener('pointerdown', off, true);
  }
}
function spark(host, vals, color, line) {
  const W = 112, H = 44, v = vals.map((x) => (x == null || !isFinite(x) ? null : x)), ok = fin(v);
  host.textContent = ''; if (!ok.length) return;
  const svg = sv('svg', { viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true' }, host);
  const lo = line ? Math.min(...ok) : Math.min(0, ...ok), hi = line ? Math.max(...ok) : Math.max(0, ...ok), span = hi - lo || 1;
  const y = (x) => 2 + (hi - x) / span * (H - 4), n = v.length, band = W / n;
  if (line) {
    let d = ''; v.forEach((x, i) => { if (x != null) d += (d ? 'L' : 'M') + (i * band + band / 2).toFixed(1) + ',' + y(x).toFixed(1); });
    sv('path', { d, fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linejoin': 'round' }, svg);
    return;
  }
  const bw = band * 0.64;
  v.forEach((x, i) => { if (x == null) return; const y1 = y(Math.max(x, 0)), y2 = y(Math.min(x, 0)); sv('rect', { x: i * band + (band - bw) / 2, y: y1, width: bw, height: Math.max(1.5, y2 - y1), rx: 2.5, fill: color, opacity: i === n - 1 ? 1 : 0.55 }, svg); });
}
function ring(host, score, max, color) {
  const r = 26, c = 2 * Math.PI * r, f = max ? score / max : 0;
  const svg = sv('svg', { viewBox: '0 0 64 64', 'aria-hidden': 'true' }, host);
  sv('circle', { cx: 32, cy: 32, r, fill: 'none', stroke: 'var(--an-fill)', 'stroke-width': 7 }, svg);
  sv('circle', { cx: 32, cy: 32, r, fill: 'none', stroke: color, 'stroke-width': 7, 'stroke-linecap': 'round', 'stroke-dasharray': (c * f).toFixed(1) + ' ' + c.toFixed(1), transform: 'rotate(-90 32 32)' }, svg);
  sv('text', { x: 32, y: 38, 'text-anchor': 'middle', class: 'an-ring-n' }, svg).textContent = String(score);
}

/* ---------- עזרי DOM ---------- */
function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const k in attrs) {
    const v = attrs[k];
    if (k === 'on') { for (const ev in v) e.addEventListener(ev, v[ev]); } else if (k === 'text') e.textContent = v; else if (v != null && v !== false) e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c);
  return e;
}
const tone = (s, max) => (s / max >= 0.66 ? 'good' : s / max >= 0.34 ? 'mid' : 'bad');
const card = (...kids) => h('section', { class: 'an-card' }, ...kids);
const sub = (txt) => h('p', { class: 'an-sub' }, txt);

/* ---------- הגדרות המדדים בלשונית "דוחות" ---------- */
const M = {
  rev: { n: 'anMRev', u: 'money', c: 'c1', q: 'anQRev', g: 1 },
  gp: { n: 'anMGp', u: 'money', c: 'c1', q: 'anQGp', g: 1 },
  op: { n: 'anMOp', u: 'money', c: 'c2', q: 'anQOp', g: 1 },
  ni: { n: 'anMNi', u: 'money', c: 'c2', q: 'anQNi', g: 1 },
  eps: { n: 'anMEps', u: 'ps', c: 'c2', q: 'anQEps', g: 1, noPct: 1 },
  sh: { n: 'anMSh', u: 'shares', c: 'c3', q: 'anQSh', g: 1, noPct: 1 },
  gm: { n: 'anMGm', u: 'pct', c: 'c1', ratio: 1 }, om: { n: 'anMOm', u: 'pct', c: 'c2', ratio: 1 }, nm: { n: 'anMNm', u: 'pct', c: 'c3', ratio: 1 },
  r40: { n: 'anMR40', u: 'pct', c: 'c3', ratio: 1, q: 'anQR40', f: (co, p) => { const g = growthOf(co, p, 'rev'), m = ctx(co, p).fcfm; return g != null && m != null ? g + m : null; } },
  cashT: { n: 'anMCash', u: 'money', c: 'c1', noPct: 1 }, debt: { n: 'anMDebt', u: 'money', c: 'c4', noPct: 1 },
  eq: { n: 'anMEq', u: 'money', c: 'c1', noPct: 1, q: 'anQEq' },
  ta: { n: 'anMTa', u: 'money', c: 'c1', noPct: 1 }, tl: { n: 'anMTl', u: 'money', c: 'c4', noPct: 1 },
  cr: { n: 'anMCr', u: 'num', c: 'c1', ratio: 1, q: 'anQCr' },
  de: { n: 'anMDe', u: 'num', c: 'c4', ratio: 1, q: 'anQDe' },
  ocf: { n: 'anMOcf', u: 'money', c: 'c1', g: 1 },
  fcf: { n: 'anMFcf', u: 'money', c: 'c2', q: 'anQFcf', g: 1 },
  fcfsbc: { n: 'anMOwn', u: 'money', c: 'c2', q: 'anQOwn', g: 1 },
  sbcN: { n: 'anMSbc', u: 'money', c: 'c3', f: (co, p) => { const s = ctx(co, p).sbc; return s == null ? null : -s; } },
  capexN: { n: 'anMCapex', u: 'money', c: 'c4', f: (co, p) => { const s = ctx(co, p).capex; return s == null ? null : -s; } },
  buy: { n: 'anMBuy', u: 'money', c: 'c3', q: 'anQBuy' },
  dps: { n: 'anMDps', u: 'ps', c: 'c3', noPct: 1 },
  roic: { n: 'anMRoic', u: 'pct', c: 'c2', ratio: 1, q: 'anQRoic' },
  roe: { n: 'anMRoe', u: 'pct', c: 'c1', ratio: 1, q: 'anQRoe' },
};
const mval = (co, k, p) => (M[k].f ? M[k].f(co, p) : ctx(co, p)[k]);
const ROWS = {
  is: [['rev'], ['gp'], ['op'], ['ni'], ['eps'], ['sh'], ['margins', 'anRMargins', ['gm', 'om', 'nm']], ['r40']],
  bs: [['cvd', 'anRCashDebt', ['cashT', 'debt']], ['eq'], ['struct', 'anRStruct', ['ta', 'tl']], ['cr'], ['de']],
  cf: [['cfb', 'anRCfb', ['ocf', 'fcf', 'sbcN', 'capexN']], ['fcf'], ['fcfsbc'], ['ocfni', 'anROcfNi', ['ocf', 'ni']], ['buy'], ['dps']],
  rt: [['pe~'], ['pfcf~'], ['ps~'], ['evebit~'], ['roic'], ['roe']],
};
const LINES = { 'pe~': ['anLPe', 'pe', 'c1', 'anXPe'], 'pfcf~': ['anLPfcf', 'pfcf', 'c2', 'anXPfcf'], 'ps~': ['anLPs', 'ps', 'c3', 'anXPs'], 'evebit~': ['anLEv', 'evebit', 'c4', 'anXEv'] };
const rowDef = (r) => (r.length > 1 ? { id: r[0], n: T(r[1]), s: r[2] } : LINES[r[0]] ? { id: r[0], n: T(LINES[r[0]][0]), line: LINES[r[0]] } : { id: r[0], n: T(M[r[0]].n), s: [r[0]] });
function seriesFor(co, def, st) {
  let per = periodList(co, st.mode);
  if (st.range !== 'all') per = per.slice(-(st.mode === 'q' ? +st.range * 4 : +st.range + (hasTTM(co) ? 1 : 0)));
  const keys = def.s.filter((k) => !st.hide || !st.hide.has(k));
  const series = keys.map((k) => ({ key: k, name: T(M[k].n), color: cssv(M[k].c), vals: per.map((p) => {
    const v = mval(co, k, p);
    if (st.view === 'g') { const b = M[k].f ? null : ctx(co, p, 1)[k]; return v != null && b != null && b > 0 ? v / b - 1 : null; }
    if (st.view === 'r') { const r = ctx(co, p).rev; return v != null && r ? v / r : null; }
    return v;
  }) }));
  const unit = st.view !== 'v' ? 'pct' : M[def.s[0]].u;
  const tipLabels = per.map((p) => (p.kind === 'ttm' ? T('anTtm') : p.kind === 'q' ? T('anQuarterOf', { q: Math.ceil(+p.end.slice(5, 7) / 3), y: p.end.slice(0, 4) }) : T('anYearOf', { y: p.label })));
  return { per, series, unit, labels: per.map((p) => p.label), tipLabels };
}
function rowSummary(co, def) {
  if (def.line) {
    const a = multHist(co)[def.line[1]], now = fin(a).pop(), md = median(a.filter((x) => x > 0 && x < 300));
    return { v: fmt(now, 'x', co, 1), s: md ? T(now > md ? 'anMedAbove' : 'anMedBelow', { v: strip(fmt(md, 'x', co, 1)) }) : '' };
  }
  const k = def.s[0], m = M[k], per = periodList(co, 'fy'), last = mval(co, k, per[per.length - 1]);
  if (def.s.length > 1) return { v: '', s: def.s.map((x) => T(M[x].n)).join(' · ') };
  if (m.ratio) { const a = mean(fyList(co).slice(-5).map((p) => mval(co, k, p))); return { v: fmt(last, m.u, co), s: a != null ? T('anAvg5v', { v: strip(fmt(a, m.u, co)) }) : '' }; }
  const [g, n] = cagrN(co, k, 5);
  return { v: fmt(last, m.u, co), s: g != null ? T('anCagrRow', { n, v: strip(sgn(g)) }) : m.q ? T(m.q) : '' };
}

/* ---------- המסך ---------- */
const S = { co: null, mac: null, sym: '', tab: 'snap', rsub: 'is', ed: {}, open: null, err: null, modal: null, sheet: null, after: [], seq: 0, peers: null, peerBusy: false, peerAdd: [], peerDrop: new Set() };
const CACHE = new Map();   // בזיכרון בלבד, לכל ריצה (השרתון שומר במטמון 12 שעות)
let MAC = null;
const TABS = ['snap', 'rep', 'val', 'cmp'];

async function load(sym, force) {
  if (!force && CACHE.has(sym)) return CACHE.get(sym);
  const [d, m] = await Promise.all([E.api({ op: 'fund', sym }), MAC && !force ? MAC : E.api({ op: 'macro' }).catch(() => null)]);
  if (m && m.ok) MAC = m;
  if (!d || !d.ok) { const e = new Error((d && d.error) || 'fail'); e.code = (d && d.error) || 'fail'; throw e; }
  CACHE.set(sym, d);
  return d;
}
function ensureCss() {
  if (document.getElementById('anCss')) return Promise.resolve();
  const l = document.createElement('link'); l.id = 'anCss'; l.rel = 'stylesheet'; l.href = 'analysis.css';
  // מחכים לעיצוב (עד שנייה) — אחרת השכבה מופיעה לרגע בלי עיצוב
  const p = new Promise((res) => { l.addEventListener('load', res); l.addEventListener('error', res); setTimeout(res, 1000); });
  document.head.appendChild(l);
  return p;
}
export async function openAnalysis(sym, env) {
  E = env || E;
  await ensureCss();
  if (ROOT) closeAnalysis(true);
  S.sym = sym; S.tab = 'snap'; S.rsub = 'is'; S.ed = {}; S.open = null; S.err = null; S.co = null; S.peers = null; S.peerBusy = false; S.peerAdd = []; S.peerDrop = new Set(); const seq = ++S.seq;
  ROOT = h('div', { class: 'an-root no-swipe', role: 'dialog', 'aria-modal': 'true', 'aria-label': T('anTitle') });
  ROOT.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); if (S.sheet) closeSheet(); else closeAnalysis(); } });
  document.body.appendChild(ROOT);
  document.documentElement.classList.add('an-open');
  S.modal = E.modalPush ? E.modalPush(() => closeAnalysis(true)) : null;
  render();
  load(sym).then((d) => { if (seq !== S.seq) return; S.co = indFix(prep(d, E.quote && E.quote(sym), E.fx && E.fx()), MAC); render(); })
    .catch((e) => { if (seq !== S.seq) return; S.err = e.code || 'fail'; render(); });
}
function closeAnalysis(fromPop) {
  if (!ROOT) return;
  if (S.sheet) closeSheet(true);
  const r = ROOT; ROOT = null; S.seq++;
  document.documentElement.classList.remove('an-open');
  const m = S.modal; S.modal = null;
  if (!fromPop && m && E.modalDone) E.modalDone(m);
  if (typeof r.animate === 'function' && !(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)) {
    r.style.pointerEvents = 'none';
    const a = r.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(28px)' }], { duration: 220, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' });
    a.onfinish = () => r.remove();
  } else r.remove();
  if (E.onClose) E.onClose();
}

function render(dir) {
  if (!ROOT) return;
  const y = ROOT.scrollTop;
  ROOT.textContent = '';
  S.after = [];
  ROOT.append(navBar());
  const co = S.co;
  if (!co) {
    const body = h('div', { class: 'an-wrap' });
    if (S.err) body.append(card(h('p', { class: 'an-verdict' }, S.err === 'no_data' ? T('anErrNoData') : T('anErrLoad')),
      S.err === 'no_data' ? null : h('button', { class: 'an-btn', type: 'button', on: { click: () => { S.err = null; render(); const seq = ++S.seq; load(S.sym, true).then((d) => { if (seq === S.seq) { S.co = indFix(prep(d, E.quote && E.quote(S.sym), E.fx && E.fx()), MAC); render(); } }).catch((e) => { if (seq === S.seq) { S.err = e.code || 'fail'; render(); } }); } } }, T('anRetry'))));
    else body.append(h('div', { class: 'an-skel an-skel-h' }), h('div', { class: 'an-skel' }), h('div', { class: 'an-skel' }), h('p', { class: 'an-src' }, T('anLoading')));
    ROOT.append(body);
    return;
  }
  const wrap = h('div', { class: 'an-wrap' });
  wrap.append(header(co));
  const pg = h('div', { class: 'an-page' + (dir ? ' in' : ''), style: dir ? `--an-dx:${dir * 24}px` : null });
  ({ snap: pageSnap, rep: pageRep, val: pageVal, cmp: pageCmp })[S.tab](co, pg);
  wrap.append(pg, footer(co));
  ROOT.append(wrap);
  if (!dir) ROOT.scrollTop = y;
  requestAnimationFrame(() => S.after.forEach((f) => f()));
}
function navBar() {
  const back = h('button', { class: 'an-back', type: 'button', 'aria-label': T('anClose'), on: { click: () => closeAnalysis() } }, h('span', { class: 'an-chev', 'aria-hidden': 'true' }), T('anBack'));
  const logo = h('span', { class: 'an-logo' });
  if (E.logoHTML) logo.innerHTML = E.logoHTML(S.sym);
  const nm = S.co ? S.co.name : (E.name && E.name(S.sym)) || S.sym;
  return h('div', { class: 'an-nav' }, back, h('div', { class: 'an-nav-t' }, logo, h('b', { dir: 'auto' }, nm)));
}
function header(co) {
  const c = ctx(co, nowP(co)), mcap = co.price * co.sharesOut, ch = co.prev ? co.price / co.prev - 1 : null;
  const pe = c.eps > 0 ? co.price / c.eps : null, fy = c.fcf != null && mcap ? c.fcf / mcap : null;
  const fact = (tt, v, key) => h('button', { class: 'an-fact', type: 'button', on: { click: () => factSheet(key) } }, h('span', {}, tt), h('b', {}, v));
  const meta = [co.sym.replace(/\.TA$/, ''), co.exch, co.sector].filter(Boolean).join(' · ');
  return h('div', { class: 'an-head' },
    h('div', { class: 'an-idrow' },
      h('div', { class: 'an-idn' }, h('span', { dir: 'auto' }, meta)),
      h('div', { class: 'an-px' }, h('b', {}, fmt(co.price, 'ps', co)), ch != null ? h('span', { class: ch >= 0 ? 'an-up' : 'an-down' }, sgn(ch, 2)) : null)),
    h('div', { class: 'an-facts' }, fact(T('anFMcap'), fmt(mcap, 'money', co), 'mcap'), fact(T('anFPe'), fmt(pe, 'x', co, 1), 'pe'),
      fact(T('anFFpe'), fmt(co.fpe, 'x', co, 1), 'fpe'), fact(T('anFFy'), pct(fy), 'fy'),
      fact(c.netcash >= 0 ? T('anNetCash') : T('anNetDebt'), fmt(Math.abs(c.netcash || 0), 'money', co), 'nc')),
    h('div', { class: 'an-seg', role: 'tablist' }, ...[['snap', T('anTabSnap')], ['rep', T('anTabRep')], ['val', T('anTabVal')], ['cmp', T('anTabCmp')]].map(([k, tt]) =>
      h('button', { type: 'button', role: 'tab', 'aria-selected': String(S.tab === k), 'aria-pressed': String(S.tab === k), on: { click: () => go(k) } }, tt))));
}
function go(k) {
  if (k === S.tab) return;
  const d = TABS.indexOf(k) > TABS.indexOf(S.tab) ? -1 : 1;
  S.tab = k; render(d);
  if (ROOT) ROOT.scrollTop = 0;
}
/* שם של שדה גולמי מהשרתון (co.fill, co.tags) — מדד מוכר לפי M, השאר לפי שם משלו */
function rawName(k) {
  if (M[k]) return T(M[k].n);
  switch (k) {
    case 'cogs': return T('anKCogs'); case 'msec': return T('anKMsec'); case 'cash': return T('anMCash'); case 'debt': case 'debtNc': case 'debtC': case 'stb': return T('anMDebt');
    case 'capex': return T('anMCapex'); case 'sbc': return T('anMSbc'); case 'dep': return T('anKDep'); case 'int': return T('anKInt'); case 'tax': case 'pretax': return T('anKTax');
    case 'ca': case 'cl': return T('anKCur'); case 'ppe': return T('anKPpe'); case 're': return T('anKRe'); case 'divp': return T('anMDps');
    default: return T('anKOther');
  }
}
function footer(co) {
  const src = [co.src === 'sec' ? 'SEC EDGAR' : 'Yahoo', 'Yahoo', co.nq ? 'Nasdaq/Zacks' : null, MAC && MAC.src && MAC.src.rf, 'Damodaran'].filter((x, i, a) => x && a.indexOf(x) === i).join(' · ');
  const extra = [];
  if (co.fill && co.fill.length) extra.push(T('anFillNote', { k: [...new Set(co.fill.map(rawName))].join(', ') }));
  if (co.fxNote) extra.push(T('anFxNote', { c: co.cur }));
  return h('p', { class: 'an-src' }, T('anSources', { s: src, d: dmy(co.asOf) }), extra.length ? h('br') : null, extra.join(' · '));
}

/* --- תמונת מצב --- */
function pageSnap(co, pg) {
  const C = checks(co, MAC), I = autoInputs(co, MAC);
  const sc = { value: passN(C.value), growth: passN(C.growth), profit: passN(C.profit), safe: passN(C.safe) };
  const sens = fairOf(co, MAC);
  let verdict;
  const parts = [sc.profit >= 4 ? T('anVProfHi') : sc.profit >= 3 ? T('anVProf') : T('anVProfLo'),
    sc.growth >= 4 ? T('anVGrowHi') : sc.growth >= 3 ? T('anVGrow') : T('anVGrowLo'),
    sc.safe >= 4 ? T('anVSafeHi') : sc.safe >= 3 ? T('anVSafe') : T('anVSafeLo')].join(T('anComma'));
  const U = uncertainty(co);
  if (sens && sens.base.ps > 0) {
    const ratio = co.price / sens.base.ps;
    verdict = parts + '. ' + (ratio <= U.band[0] ? T('anVCheap') : ratio >= U.band[1] ? T('anVDear') : T('anVFair'));
  } else verdict = parts + '.';
  const gauges = h('div', { class: 'an-gauges' });
  for (const k of ['value', 'growth', 'profit', 'safe']) {
    const b = h('button', { class: 'an-gauge', type: 'button', 'aria-label': T('anGaugeAria', { n: C[k].n, s: sc[k] }), on: { click: () => checkSheet(k) } });
    ring(b, sc[k], 6, `var(--an-${tone(sc[k], 6)})`);
    b.append(h('span', { class: 'an-gl' }, C[k].n), h('span', { class: 'an-gs' }, T('anOf6')));
    gauges.append(b);
  }
  pg.append(card(h('p', { class: 'an-verdict' }, verdict), gauges));
  // שווי מול מחיר
  if (sens && sens.base.ps > 0) {
    const { bear, base, bull } = sens;
    const lo = Math.min(bear.ps, co.price) * 0.85, hi = Math.max(bull.ps, co.price) * 1.1, X = (v) => ((v - lo) / (hi - lo) * 100).toFixed(1) + '%';
    const mos = 1 - co.price / base.ps;
    const tk = (lbl, v) => h('div', { class: 'an-tk', style: `left:${X(v)}` }, lbl, h('b', {}, strip(fmt(v, 'ps', co, 0))));
    const vbar = h('div', { class: 'an-vbar' }, h('div', { class: 'an-track' }), h('div', { class: 'an-rng', style: `left:${X(bear.ps)};width:calc(${X(bull.ps)} - ${X(bear.ps)})` }),
      tk(T('anBear'), bear.ps), tk(T('anBase'), base.ps), tk(T('anBull'), bull.ps),
      h('div', { class: 'an-me', style: `left:${X(co.price)}` }), h('div', { class: 'an-mel', style: `left:${X(co.price)}` }, T('anToday') + ' ' + strip(fmt(co.price, 'ps', co, 0))));
    pg.append(card(h('div', { class: 'an-h2row' }, h('h2', {}, T('anFairVsPrice')), h('button', { class: 'an-link', type: 'button', on: { click: () => go('val') } }, T('anToCalc'))),
      vbar, h('p', { class: 'an-legend' }, T(mos >= 0 ? 'anMosBelow' : 'anMosAbove'), h('b', { class: mos >= 0 ? 'an-up' : 'an-down' }, pct(Math.abs(mos), 0)), '. ',
        T('anUncLine', { u: uncName(U.lv), b: strip(pct(U.band[0], 0)) }))));
  } else pg.append(card(h('h2', {}, T('anFairVsPrice')), sub(noFair(co, I))));
  // מה חדש
  const hist = (co.hist || []).filter((x) => x.a != null && x.e != null), lh = hist[hist.length - 1];
  const e0 = (co.est || []).find((e) => e.p === '0y'), e1 = (co.est || []).find((e) => e.p === '+1y');
  const rows = [];
  const row = (tt, st, right, on) => h(on ? 'button' : 'div', { class: 'an-row', type: on ? 'button' : null, on: on ? { click: on } : null }, h('div', { class: 'an-rt' }, h('b', {}, tt), h('span', {}, st)), right);
  if (lh) { const s = lh.e ? lh.a / lh.e - 1 : 0, beat = lh.a >= lh.e; rows.push(row(T('anLastRep'), T('anLastRepS', { a: strip(fmt(lh.a, 'ps', co)), e: strip(fmt(lh.e, 'ps', co)) }), h('span', { class: 'an-pill ' + (beat ? 'good' : 'bad') }, T(beat ? 'anBeat' : 'anMiss', { v: strip(pct(Math.abs(s), 0)) })))); }
  const estRow = (e, key) => row(T(key), T('anEstS', { n: e.n || '?', r: strip(fmt(e.rev, 'money', co)) }), h('div', { class: 'an-rv' }, fmt(e.eps, 'ps', co), e.g != null ? h('small', { class: e.g >= 0 ? 'an-up' : 'an-down' }, sgn(e.g)) : null));
  if (e0 && e0.eps) rows.push(estRow(e0, 'anEst0'));
  if (e1 && e1.eps) rows.push(estRow(e1, 'anEst1'));
  if (co.nq && co.nq.length) rows.push(row(T('anEstTo', { y: String(co.nq[co.nq.length - 1].fy).slice(-4) }), T('anEstToS'), h('span', { class: 'an-chev' }), estSheet));
  if (co.nextEarn && co.nextEarn >= co.asOf) rows.push(row(T('anNextRep'), dmy(co.nextEarn), h('span', { class: 'an-pill neu' }, daysTo(co.nextEarn, co.asOf))));
  if (!(e0 && e0.eps)) rows.push(row(T('anNoEst'), T('anNoEstS'), null));
  pg.append(card(h('h2', {}, T('anWhatsNew')), h('div', { class: 'an-list' }, ...rows)));
  if (co.years.length < 6) pg.append(h('div', { class: 'an-note' }, T(/\.TA$/.test(co.sym) ? 'anShortTA' : 'anShort', { n: co.years.length })));
}
function daysTo(d, asOf) {
  const n = Math.round((new Date(d) - new Date(asOf || Date.now())) / 864e5);
  return n > 1 ? T('earnInDays', { n }) : n === 1 ? T('earnTomorrow') : n === 0 ? T('earnToday') : T('anDaysAgo', { n: -n });
}

/* --- דוחות --- */
function pageRep(co, pg) {
  pg.append(h('div', { class: 'an-seg sm', role: 'group', 'aria-label': T('anTabRep') }, ...[['is', T('anRIs')], ['bs', T('anRBs')], ['cf', T('anRCf')], ['rt', T('anRRt')]].map(([k, tt]) =>
    h('button', { type: 'button', 'aria-pressed': String(S.rsub === k), on: { click: () => { S.rsub = k; render(); } } }, tt))));
  if (co.flags.some((f) => !FL_INFO.has(f.k))) pg.append(h('button', { class: 'an-note an-note-btn', type: 'button', on: { click: flagSheet } }, T('anFlags', { n: new Set(co.flags.filter((f) => !FL_INFO.has(f.k)).map((f) => f.p)).size }), h('span', { class: 'an-chev' })));
  const list = h('div', { class: 'an-list' });
  for (const r of ROWS[S.rsub]) {
    const def = rowDef(r), sm = rowSummary(co, def), sp = h('div', { class: 'an-spark' });
    list.append(h('button', { class: 'an-mrow', type: 'button', on: { click: () => chartSheet(def) } },
      h('div', { class: 'an-mt' }, h('b', {}, def.n), sm.v ? h('span', { class: 'an-v' }, sm.v) : null, h('span', {}, sm.s)), sp));
    S.after.push(() => {
      if (def.line) { spark(sp, multHist(co)[def.line[1]].slice(-60), cssv(def.line[2]), true); return; }
      const d = seriesFor(co, def, { mode: 'fy', range: '5', view: 'v' });
      spark(sp, d.series[0].vals, d.series[0].color, false);
    });
  }
  pg.append(h('section', { class: 'an-card an-card-list' }, list));
}

/* --- שווי --- */
/* חלקים משותפים לשלושת המודלים: תרחישים, כוכבים, הנחות עם מחוון, ושורות בדיקה */
const scenEl = (co, list) => h('div', { class: 'an-scen' }, ...list.map(([tt, v, small, cls, i]) => h('div', { class: i === 1 ? 'base' : '' }, h('span', {}, tt), h('b', {}, fmt(v, 'ps', co, 0)), h('small', { class: cls }, small))));
const vsPrice = (co, v) => [sgn(v / co.price - 1, 0), v >= co.price ? 'an-up' : 'an-down'];
function fairCard(co, F, tag, subTxt, extra, labels) {
  const { bear, base, bull } = F, U = uncertainty(co), mos = 1 - co.price / base.ps, ratio = co.price / base.ps;
  const stars = ratio <= U.band[0] ? 5 : ratio <= (U.band[0] + 1) / 2 ? 4 : ratio < (1 + U.band[1]) / 2 ? 3 : ratio < U.band[1] ? 2 : 1;
  const L = labels || [T('anBear'), T('anBase'), T('anBull')];
  return card(
    h('div', { class: 'an-h2row' }, h('h2', {}, T('anFair')), h('span', { class: 'an-pill neu' }, tag)),
    sub(subTxt),
    scenEl(co, [[L[0], bear.ps, ...vsPrice(co, bear.ps), 0], [L[1], base.ps, ...vsPrice(co, base.ps), 1], [L[2], bull.ps, ...vsPrice(co, bull.ps), 2]]),
    h('p', { class: 'an-big' }, h('span', { class: 'an-stars', 'aria-label': T('anStars', { n: stars }) }, '★'.repeat(stars), h('span', { class: 'an-dim' }, '★'.repeat(5 - stars))), ' ',
      T(mos >= 0 ? 'anMosBelow' : 'anMosAbove'), h('strong', { class: mos >= 0 ? 'an-up' : 'an-down' }, pct(Math.abs(mos), 0))),
    sub(T(co.fin ? 'anUncLongFin' : 'anUncLong', { u: uncName(U.lv), b: strip(pct(U.band[0], 0)) })),
    ...(extra || []));
}
function assumeCard(fields, V, ed, extra) {
  const inp = h('div', { class: 'an-inp' });
  for (const [k, tt, f, s, [mn, mx, st]] of fields) {
    const edited = ed[k] != null, lab = h('b', {}, f(V[k]));
    const slider = h('input', { type: 'range', min: mn, max: mx, step: st, value: V[k], hidden: S.open === k ? null : true, 'aria-label': tt, on: {
      input: (e) => { lab.textContent = f(+e.target.value); },
      change: (e) => { ed[k] = +e.target.value; S.open = k; render(); } } });
    const btn = h('button', { class: 'an-l', type: 'button', 'aria-expanded': String(S.open === k), on: { click: (e) => { slider.hidden = !slider.hidden; S.open = slider.hidden ? null : k; e.currentTarget.setAttribute('aria-expanded', String(!slider.hidden)); } } }, h('span', {}, tt), lab);
    inp.append(h('div', { class: 'an-inr' + (edited ? ' ed' : '') }, btn, h('span', { class: 'an-srcline' }, edited ? T('anEdited') : s), slider));
  }
  for (const [tt, v, s] of extra || []) inp.append(h('div', { class: 'an-inr' }, h('div', { class: 'an-l an-l-static' }, h('span', {}, tt), h('b', {}, v)), h('span', { class: 'an-srcline' }, s)));
  return card(h('div', { class: 'an-h2row' }, h('h2', {}, T('anAssume')), Object.keys(ed).length ? h('button', { class: 'an-link', type: 'button', on: { click: () => { S.ed = {}; S.open = null; render(); } } }, T('anReset')) : null),
    sub(T('anAssumeSub')), inp);
}
const chkRows = (list) => h('div', { class: 'an-list' }, ...list.map(([tt, v, k, s]) =>
  h('div', { class: 'an-row' }, h('span', { class: 'an-ic ' + (k === 'good' ? 'y' : k === 'bad' ? 'n' : 'na') }, k === 'good' ? '✓' : k === 'bad' ? '!' : '–'), h('div', { class: 'an-rt' }, h('b', {}, tt), h('span', {}, s)), h('div', { class: 'an-rv' }, v))));
/* למה אין שווי — לפי סוג החברה */
function noFair(co, I) {
  if (co.reit) return T(reitInputs(co).ffops > 0 ? 'anFfoNone' : 'anFfoNo');
  if (co.fin) return T(finInputs(co, MAC).val.bv > 0 ? 'anRiNone' : 'anRiNoBv');
  return (I || autoInputs(co, MAC)).src.base;
}

function pageVal(co, pg) {
  if (co.fin) { pageValFin(co, pg); return; }
  if (co.reit) { pageValReit(co, pg); return; }
  const I = autoInputs(co, MAC), ed = S.ed, V = { ...I.val, ...ed };
  multCard(co, pg);
  if (!(V.base > 0)) { lossCard(co, pg, I); return; }
  const { base, bear, bull } = scenarios(V);
  const rev = reverseG(V, co.price), scen = (list) => scenEl(co, list);
  pg.append(fairCard(co, { bear, base, bull }, T('anDcfTag'), T('anFairSub'),
    [rev == null ? null : h('p', { class: 'an-big an-big-sm' }, T('anImplied1'), h('strong', {}, pct(rev)), T('anImplied2'))]));
  // ההנחות
  const fields = [
    ['base', T('anInBase'), (x) => fmt(x, 'money', co), I.src.base, [I.val.base * 0.3, I.val.base * 2, I.val.base / 100]],
    ['g1', T('anInG1'), (x) => pct(x), I.src.g1, [-0.2, 0.6, 0.005]],
    ['g2', T('anInG2'), (x) => pct(x), I.src.g2, [-0.2, 0.6, 0.005]],
    ['ke', T('anInKe'), (x) => pct(x, 2), I.src.ke, [0.05, 0.16, 0.0025]],
    ['tg', T('anInTg'), (x) => pct(x, 1), I.src.tg, [0, 0.04, 0.0025]],
  ];
  pg.append(assumeCard(fields, V, ed, [[T('anIn310'), iso(strip(pct(base.g[2])) + ' → ' + strip(pct(base.g[9]))), T('anIn310s')]]));
  // בדיקות שפיות
  const cNow = ctx(co, nowP(co)), nopat = cNow.op != null ? cNow.op * (1 - cNow.t) : null;
  const reinv = cNow.capex != null && cNow.dep != null && nopat > 0 ? (cNow.capex - cNow.dep) / nopat : null;
  const gAvg = mean(base.g.slice(0, 5)), impROIC = reinv > 0 ? gAvg / reinv : null;
  const [hc] = cagrN(co, 'rev', 5), rev10 = base.rows[9] / V.base;
  const san = [
    [T('anS1'), pct(base.tvShare, 0), base.tvShare > 0.75 ? 'bad' : 'good', T(base.tvShare > 0.75 ? 'anS1b' : 'anS1g')],
    reinv != null && reinv < 0.05 // השקעה נטו כמעט אפסית — היחס מתפוצץ ולא אומר כלום
      ? [T('anS2'), '—', 'neu', T('anS2low')]
      : [T('anS2'), impROIC ? pct(impROIC, 0) : '—', impROIC == null ? 'neu' : impROIC > Math.max(cNow.roic || 0, 0.3) ? 'bad' : 'good', reinv != null ? T('anS2s', { g: strip(pct(gAvg, 0)), r: strip(pct(reinv, 0)), n: strip(pct(cNow.roic, 0)) }) : T('anS2n')],
    [T('anS3'), rev == null ? '—' : pct(rev), rev != null && hc != null && rev > hc * 1.3 ? 'bad' : 'good', T('anS3s', { v: strip(sgn(hc)) })],
    [T('anS4'), iso('×' + rev10.toFixed(1)), rev10 > 8 ? 'mid' : 'good', T('anS4s')],
  ];
  pg.append(card(h('h2', {}, T('anSanity')), chkRows(san)));
  // רגישות
  const kes = [-0.02, -0.01, 0, 0.01, 0.02].map((d) => V.ke + d), gss = [0.6, 0.8, 1, 1.2, 1.4];
  const tb = h('table', { class: 'an-sens' });
  const thr = h('tr', {}, h('th', {}, T('anSensCorner')), ...kes.map((k) => h('th', {}, strip(pct(k, 1)))));
  tb.append(h('thead', {}, thr), h('tbody', {}, ...gss.map((g) => h('tr', {}, h('th', {}, '×' + g), ...kes.map((k) => {
    const p = dcf(V, { ke: k, gs: g }).ps;
    return h('td', { class: (p >= co.price ? 'g' : 'b') + (g === 1 && k === V.ke ? ' cur' : '') }, strip(fmt(p, 'ps', co, 0)));
  })))));
  pg.append(card(h('h2', {}, T('anSens')), sub(T('anSensSub')), h('div', { class: 'an-tblw' }, tb)));
  // יעד לפי מכפיל (כמו iCharts, עם מכפיל היסטורי של החברה עצמה)
  const mm = ['lo', 'mid', 'hi'].map((s) => multModel(co, V, s));
  if (mm[1] && mm[0] && mm[2]) {
    pg.append(card(h('div', { class: 'an-h2row' }, h('h2', {}, T('anTgt', { y: mm[1].year })), h('span', { class: 'an-pill neu' }, T('anTgtTag'))),
      sub(T('anTgtSub', { s: I.src.pe })),
      scen([[T('anBear') + ' · ' + fmt(mm[0].pe, 'x', co, 0), mm[0].tgt, mm[0].ret == null ? '—' : T('anPerYear', { v: strip(sgn(mm[0].ret)) }), mm[0].ret >= V.ke ? 'an-up' : mm[0].ret >= 0 ? '' : 'an-down', 0],
        [T('anBase') + ' · ' + fmt(mm[1].pe, 'x', co, 0), mm[1].tgt, mm[1].ret == null ? '—' : T('anPerYear', { v: strip(sgn(mm[1].ret)) }), mm[1].ret >= V.ke ? 'an-up' : mm[1].ret >= 0 ? '' : 'an-down', 1],
        [T('anBull') + ' · ' + fmt(mm[2].pe, 'x', co, 0), mm[2].tgt, mm[2].ret == null ? '—' : T('anPerYear', { v: strip(sgn(mm[2].ret)) }), mm[2].ret >= V.ke ? 'an-up' : mm[2].ret >= 0 ? '' : 'an-down', 2]]),
      whyDiff(co, V, base, mm[1]),
      sub(T('anTgtFoot', { y: mm[1].year, e: strip(fmt(mm[1].eps5, 'ps', co)), how: V.epsPath.pts.length ? T('anTgtCons', { y: V.epsPath.pts[V.epsPath.pts.length - 1][0] }) : T('anTgtHist'), k: strip(pct(V.ke, 1)) }))));
  }
}
/* --- בנקים, ביטוח והשקעות --- */
function pageValFin(co, pg) {
  const I = finInputs(co, MAC), ed = S.ed, V = { ...I.val, ...ed };
  multCard(co, pg);
  const base = riValue(V);
  if (!base) { pg.append(card(h('h2', {}, T('anFair')), sub(T(V.bv > 0 ? 'anRiNone' : 'anRiNoBv')))); return; }
  // דוב ושור זזים יחד עם ה־ROE שנבחר (אותו מרחק כמו בהיסטוריה)
  const dLo = I.val.roe - I.val.roeLo, dHi = I.val.roeHi - I.val.roe;
  const bear = riValue(V, { roe: V.roe - dLo }) || { ps: 0 }, bull = riValue(V, { roe: V.roe + dHi }) || base;
  const imp = impliedRoe(V, co.price);
  pg.append(fairCard(co, { bear, base, bull }, T('anRiTag'), T('anRiSub'),
    [imp == null ? null : h('p', { class: 'an-big an-big-sm' }, T('anRiImp1'), h('strong', {}, pct(imp)), T('anRiImp2', { v: strip(pct(I.val.roe5)) }))]));
  pg.append(assumeCard([
    ['roe', T('anInRoe'), (x) => pct(x), I.src.roe, [-0.05, 0.4, 0.0025]],
    ['ke', T('anInKe'), (x) => pct(x, 2), I.src.ke, [0.05, 0.16, 0.0025]],
    ['tg', T('anInTg'), (x) => pct(x, 1), I.src.tg, [0, 0.04, 0.0025]],
  ], V, ed, [[T('anInBv'), fmt(V.bv, 'ps', co), I.src.bv], [T('anInPb'), iso(base.pb.toFixed(2) + '×'), T('anInPbs')]]));
  const c = ctx(co, nowP(co)), ind = co.ind || {}, iname = co.indName || T('anIndustry'), pbNow = co.price / V.bv;
  pg.append(card(h('h2', {}, T('anSanity')), chkRows([
    [T('anRiS1'), pct(V.roe), ind.roe > 0 ? (V.roe <= ind.roe * 1.5 ? 'good' : 'bad') : 'neu', ind.roe > 0 ? T('anRiS1s', { i: iso(iname), v: strip(pct(ind.roe)) }) : T('anRiS1n')],
    [T('anRiS2'), iso(pbNow.toFixed(2) + '×'), 'neu', ind.pbv > 0 ? T('anRiS2s', { i: iso(iname), v: iso(ind.pbv.toFixed(2) + '×') }) : T('anRiS2n')],
    [T('anRiS3'), pct(c.roe), c.roe == null ? 'neu' : Math.abs(c.roe - V.roe) <= Math.max(0.03, V.roe * 0.3) ? 'good' : 'mid', T('anRiS3s', { v: strip(pct(V.roe)) })],
  ])));
  // רגישות: ROE מתמשך × מחיר ההון
  const kes = [-0.02, -0.01, 0, 0.01, 0.02].map((d) => V.ke + d), roes = [-0.04, -0.02, 0, 0.02, 0.04].map((d) => V.roe + d);
  const tb = h('table', { class: 'an-sens' });
  tb.append(h('thead', {}, h('tr', {}, h('th', {}, T('anSensRoe')), ...kes.map((k) => h('th', {}, strip(pct(k, 1)))))), h('tbody', {}, ...roes.map((r, ri) => h('tr', {}, h('th', {}, strip(pct(r, 0))), ...kes.map((k, ki) => {
    const v = riValue(V, { roe: r, ke: k }), p = v ? v.ps : null;
    return h('td', { class: (p != null && p >= co.price ? 'g' : 'b') + (ri === 2 && ki === 2 ? ' cur' : '') }, p == null ? '—' : strip(fmt(p, 'ps', co, 0)));
  })))));
  pg.append(card(h('h2', {}, T('anSens')), sub(T('anSensRiSub')), h('div', { class: 'an-tblw' }, tb)));
}

/* --- ריט --- */
function pageValReit(co, pg) {
  const R = reitInputs(co);
  multCard(co, pg);
  if (!(R.ffops > 0) || !R.m) { pg.append(card(h('h2', {}, T('anFair')), sub(T(R.ffops > 0 ? 'anFfoNone' : 'anFfoNo')))); if (!(R.ffops > 0)) return; }
  else {
    const F = { bear: { ps: R.ffops * R.m[0] }, base: { ps: R.ffops * R.m[1] }, bull: { ps: R.ffops * R.m[2] } };
    const lbl = (t, i) => t + ' · ' + iso(R.m[i].toFixed(0) + '×');
    pg.append(fairCard(co, F, T('anFfoTag'), T('anFfoSub', { n: R.years }), null, [lbl(T('anBear'), 0), lbl(T('anBase'), 1), lbl(T('anBull'), 2)]));
  }
  pg.append(card(h('h2', {}, T('anFfoData')), chkRows([
    [T('anFfoPs'), fmt(R.ffops, 'ps', co), 'neu', T('anFfoPsS')],
    [T('anLPffo'), R.now ? iso(R.now.toFixed(1) + '×') : '—', R.now && R.m ? (R.now < R.m[0] ? 'good' : R.now > R.m[2] ? 'bad' : 'neu') : 'neu', R.m ? T('anFfoNowS', { v: iso(R.m[1].toFixed(1) + '×'), n: R.years }) : T('anFfoNone')],
    [T('anFfoPay'), R.pay != null ? pct(R.pay, 0) : '—', R.pay == null ? 'neu' : R.pay <= 0.9 ? 'good' : 'bad', T(R.pay == null ? 'anFfoPayN' : R.pay <= 0.9 ? 'anFfoPayG' : 'anFfoPayB')],
    [T('anFfoG'), sgn(R.g), R.g == null ? 'neu' : R.g > 0.03 ? 'good' : R.g >= 0 ? 'mid' : 'bad', T('anCagrN', { n: R.nf })],
  ])));
}

/* --- חברה שעוד לא מרוויחה --- */
function lossCard(co, pg, I) {
  const L = lossView(co), yrs = (x) => iso(x.toFixed(1)) + ' ' + T('anYrs');
  pg.append(card(h('h2', {}, T('anLossT')), sub(I.src.base), chkRows([
    [T('anLPs'), L.psNow ? iso(L.psNow.toFixed(1) + '×') : '—', L.psNow && L.psMed ? (L.psNow < L.psMed ? 'good' : 'bad') : 'neu', L.psMed ? T('anLs1s', { n: L.years, v: iso(L.psMed.toFixed(1) + '×') }) : T('anLs1n')],
    [T('anLs2'), L.r40 != null ? pct(L.r40, 0) : '—', L.r40 == null ? 'neu' : L.r40 >= 0.4 ? 'good' : L.r40 >= 0 ? 'mid' : 'bad', L.r40 != null ? T('anLs2s', { g: iso(strip(sgn(L.g, 0))), m: iso(strip(sgn(L.m, 0))) }) : T('anLs2n')],
    [T('anLs3'), L.runway != null ? yrs(L.runway) : '—', L.runway == null ? (L.burn ? 'neu' : 'good') : L.runway >= 3 ? 'good' : L.runway >= 1.5 ? 'mid' : 'bad',
      L.burn ? T('anLs3s', { c: iso(strip(fmt(L.cash, 'money', co))), b: iso(strip(fmt(L.burn, 'money', co))) }) : T('anLs3pos')],
  ])));
}

const MULT_SET = { def: [['pe', 'anLPe'], ['pfcf', 'anLPfcf'], ['ps', 'anLPs'], ['evebit', 'anLEv']], fin: [['pb', 'anLPb'], ['pe', 'anLPe']], reit: [['pffo', 'anLPffo'], ['pb', 'anLPb'], ['ps', 'anLPs']] };
function multCard(co, pg) {
  const Hh = multHist(co), mc = h('div', { class: 'an-list' });
  for (const [k, n] of MULT_SET[co.fin ? 'fin' : co.reit ? 'reit' : 'def']) {
    const a = Hh[k].filter((x) => x > 0 && x < 300); if (a.length < 6) continue;
    const now = fin(Hh[k]).pop(), mn = Math.min(...a), mx = Math.max(...a), q1 = quant(a, 0.25), q3 = quant(a, 0.75), md = quant(a, 0.5);
    const P = (v) => ((clamp(v, mn, mx) - mn) / (mx - mn || 1) * 100).toFixed(1) + '%';
    const where = now > q3 ? ['anDear', 'bad'] : now < q1 ? ['anCheap', 'good'] : ['anNormal', 'neu'];
    mc.append(h('div', { class: 'an-mult' }, h('div', { class: 'an-mult-t' }, h('b', {}, T(n)), h('span', {}, fmt(now, 'x', co, 1), ' ', h('span', { class: 'an-pill ' + where[1] }, T(where[0])))),
      h('div', { class: 'an-rbar' }, h('div', { class: 'an-tr' }), h('div', { class: 'an-iq', style: `left:${P(q1)};width:calc(${P(q3)} - ${P(q1)})` }), h('div', { class: 'an-md', style: `left:${P(md)}` }), h('div', { class: 'an-nw', style: `left:${P(now)}` })),
      h('div', { class: 'an-lb' }, h('span', {}, strip(fmt(mn, 'x', co, 1))), h('span', {}, T('anMedian') + ' ' + strip(fmt(md, 'x', co, 1))), h('span', {}, strip(fmt(mx, 'x', co, 1))))));
  }
  if (!mc.children.length) return;
  pg.append(card(h('h2', {}, T('anMultHist')), sub(T('anMultHistSub', { n: Math.round(Hh.t.length / 12) })), mc));
}
function whyDiff(co, V, base, m) {
  if (m.ret == null) return null;
  const dcfUp = base.ps >= co.price, multUp = m.ret >= V.ke;
  if (dcfUp === multUp) return null;
  const c = ctx(co, nowP(co)), mcap = co.price * co.sharesOut, fcfY = V.base / mcap, ey = c.ni > 0 ? c.ni / mcap : null;
  return h('p', { class: 'an-sub an-warn' }, multUp ? T('anWhyA', { f: strip(pct(fcfY)), e: strip(pct(ey)) }) : T('anWhyB'));
}

/* --- השוואה: עמיתים = המניות ש־Yahoo מציג כדומות, מסוננות לפי ענף/סקטור, ומה שהמשתמש הוסיף --- */
const PEER_MAX = 4;
const prepFor = (d) => indFix(prep(d, E.quote && E.quote(d.sym), E.fx && E.fx()), MAC);
/* דירוג טהור: מה שהמשתמש הוסיף (3) > אותו ענף (2) > אותו סקטור (1). "דומה" ב־Yahoo = מי שצפה בזו צפה גם בזו —
   בלי אותו סקטור זה לא עמית (בנק ליד חברת מזון מטעה), אז לא מוצג; כשנמצאו מעט — מציעים להוסיף */
function pickPeers(co, list, added) {
  const rank = (p) => (added.includes(p.sym) ? 3 : p.industry && p.industry === co.industry ? 2 : p.sector && p.sector === co.sector ? 1 : 0);
  const rows = list.map((p, i) => ({ p, r: rank(p), i })).filter((x) => x.r > 0).sort((a, b) => b.r - a.r || a.i - b.i);
  return { list: rows.slice(0, PEER_MAX).map((x) => x.p), loose: rows.length < 2 };
}
function peerRow(c) {
  const x = ctx(c, nowP(c)), mc = c.price * c.sharesOut, [g] = cagrN(c, 'rev', 5), C = checks(c, MAC);
  const fy = fyList(c), old = fy.length > 3 ? ctx(c, fy[fy.length - 4]).sh : null;
  return { sym: c.sym, g, om: x.om, roic: x.roic, fy: x.fcf != null && mc ? x.fcf / mc : null, pe: x.eps > 0 ? c.price / x.eps : null, fpe: c.fpe,
    sh3: old && x.sh ? x.sh / old - 1 : null, q: Object.values(C).reduce((a, k) => a + passN(k), 0) };
}
async function loadPeers() {
  if (S.peerBusy || !S.co) return;
  S.peerBusy = true;
  const seq = S.seq, want = [...(S.co.peers || []), ...S.peerAdd].filter((x, i, a) => a.indexOf(x) === i && x !== S.sym && !S.peerDrop.has(x));
  const got = await Promise.all(want.map((x) => load(x).then(prepFor).catch(() => null)));
  if (seq !== S.seq) return;
  S.peers = got.filter((c) => c && c.price > 0 && c.sharesOut > 0);
  S.peerBusy = false;
  if (S.tab === 'cmp') render();
}
const CMP_MET = [['q', 'anMQ', 'anMQs', 'num', 1], ['g', 'anMGrowth', 'anCagr5', 'pct', 1], ['om', 'anMOm', 'anTtm12', 'pct', 1], ['roic', 'anMRoic', 'anTtm12', 'pct', 1],
  ['fy', 'anMFy', 'anHiCheap', 'pct', 1], ['pe', 'anLPe', 'anLoCheap', 'x', -1], ['fpe', 'anFFpe', 'anLoCheap', 'x', -1], ['sh3', 'anMSh3', 'anMSh3s', 'pct', -1]];
function pageCmp(co, pg) {
  if (!S.peers) {
    pg.append(card(h('h2', {}, T('anCmpTitle')), h('div', { class: 'an-skel an-skel-in' }), sub(T('anCmpLoading'))));
    loadPeers();
    return;
  }
  const pool = S.peers.filter((p) => !S.peerDrop.has(p.sym));
  const { list, loose } = pickPeers(co, pool, S.peerAdd);
  const chips = h('div', { class: 'an-chips' }, ...list.map((p) => h('button', { class: 'an-chip an-chip-x', type: 'button', 'aria-label': T('anCmpRemove', { s: p.sym }),
    on: { click: () => { S.peerDrop.add(p.sym); S.peerAdd = S.peerAdd.filter((x) => x !== p.sym); render(); } } }, h('bdi', {}, p.sym.replace(/\.TA$/, '')), h('span', { 'aria-hidden': 'true' }, '×'))),
    h('button', { class: 'an-chip an-chip-add', type: 'button', on: { click: addPeerSheet } }, T('anCmpAdd')));
  if (!list.length) { pg.append(card(h('h2', {}, T('anCmpTitle')), sub(T('anCmpNone')), chips)); return; }
  const rows = [co, ...list].map(peerRow);
  const out = h('div', { class: 'an-list' });
  for (const [k, n, st, u, dirn] of CMP_MET) {
    const vs = rows.map((r) => r[k]), ok = fin(vs), mx = Math.max(...ok.map(Math.abs), 1e-9);
    const best = ok.length > 1 && Math.max(...ok) !== Math.min(...ok) ? (dirn > 0 ? Math.max(...ok) : Math.min(...ok)) : null; // כולם שווים — בלי כוכב
    out.append(h('div', { class: 'an-cmp' }, h('div', { class: 'an-cmp-t' }, T(n), h('span', {}, T(st, { n: 5 }))),
      ...rows.map((r) => h('div', { class: 'an-cbar' + (r.sym === co.sym ? ' me' : '') + (r[k] != null && r[k] === best ? ' best' : '') },
        h('bdi', { class: 'an-cnm' }, r.sym.replace(/\.TA$/, '')),
        h('div', { class: 'an-bb' }, r[k] == null ? null : h('i', { style: `width:${(Math.abs(r[k]) / mx * 100).toFixed(0)}%` })),
        h('span', { class: 'an-vv' }, r[k] == null ? '—' : k === 'q' ? iso(String(r[k])) : fmt(r[k], u, null, 1))))));
  }
  pg.append(card(h('h2', {}, T('anCmpTitle')), sub(T(loose ? 'anCmpSubAny' : 'anCmpSub')), chips, out));
}
function addPeerSheet() {
  openSheet(T('anCmpAddTitle'), (b) => {
    const inp = h('input', { class: 'an-in', type: 'text', inputmode: 'text', autocapitalize: 'characters', autocomplete: 'off', spellcheck: 'false', dir: 'ltr', placeholder: T('anCmpAddPh'), 'aria-label': T('anCmpAddTitle') });
    const msg = h('p', { class: 'an-ex an-err', hidden: true });
    const go = h('button', { class: 'an-btn', type: 'submit' }, T('anCmpAddBtn'));
    const form = h('form', { class: 'an-addf', on: { submit: (e) => {
      e.preventDefault();
      const sym = String(inp.value || '').trim().toUpperCase();
      if (!/^[A-Z0-9][A-Z0-9.\-]{0,15}$/.test(sym) || sym === S.sym) { msg.textContent = T('anCmpAddErr'); msg.hidden = false; return; }
      go.disabled = true;
      load(sym).then((d) => {
        const c = prepFor(d);
        if (!(c.price > 0 && c.sharesOut > 0)) throw new Error('x');
        S.peerDrop.delete(sym);
        if (!S.peerAdd.includes(sym)) S.peerAdd.push(sym);
        S.peers = (S.peers || []).filter((p) => p.sym !== sym).concat(c);
        closeSheet(); render();
      }).catch(() => { go.disabled = false; msg.textContent = T('anCmpAddErr'); msg.hidden = false; });
    } } }, inp, go);
    b.append(form, msg);
    setTimeout(() => inp.focus(), 50);
  }, { small: true });
}

/* ---------- גיליונות ---------- */
function openSheet(title, build, opt = {}) {
  if (S.sheet) closeSheet(true, true);
  const veil = h('div', { class: 'an-veil', on: { click: () => closeSheet() } });
  const body = h('div', { class: 'an-sh-b' });
  const grab = h('button', { class: 'an-grab', type: 'button', 'aria-label': T('anExpand') });
  const sh = h('div', { class: 'an-sheet' + (opt.small ? ' small' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    grab, h('div', { class: 'an-sh-h' }, h('h2', {}, title), h('button', { class: 'an-x', type: 'button', 'aria-label': T('anClose'), on: { click: () => closeSheet() } }, '✕')), body);
  ROOT.append(veil, sh);
  const rec = { veil, sh, draw: null, last: document.activeElement, modal: null };
  S.sheet = rec;
  rec.modal = E.modalPush ? E.modalPush(() => closeSheet(true)) : null;
  let y0 = null;
  grab.addEventListener('pointerdown', (e) => { y0 = e.clientY; try { grab.setPointerCapture(e.pointerId); } catch (x) {} });
  grab.addEventListener('pointerup', (e) => {
    if (y0 == null) return; const dy = e.clientY - y0; y0 = null;
    if (dy < -30) sh.classList.add('full'); else if (dy > 60) { if (sh.classList.contains('full')) sh.classList.remove('full'); else closeSheet(); } else sh.classList.toggle('full');
    setTimeout(() => rec.draw && rec.draw(), 300);
  });
  build(body, rec);
  requestAnimationFrame(() => { if (rec.draw) rec.draw(); const x = sh.querySelector('.an-x'); if (x) x.focus({ preventScroll: true }); });
}
function closeSheet(fromPop, quiet) {
  const r = S.sheet; if (!r) return;
  S.sheet = null;
  r.veil.remove(); r.sh.remove();
  if (!fromPop && r.modal && E.modalDone) E.modalDone(r.modal);
  else if (quiet && r.modal && E.modalDone) E.modalDone(r.modal);
  if (r.last && r.last.focus && r.last.isConnected) r.last.focus({ preventScroll: true });
}
function segCtl(label, opts, cur, on) {
  const s = h('div', { class: 'an-seg sm', role: 'group', 'aria-label': label }, ...opts.map(([v, tt, dis]) =>
    h('button', { type: 'button', 'aria-pressed': String(cur === v), disabled: dis ? true : null, on: { click: () => { [...s.children].forEach((b, i) => b.setAttribute('aria-pressed', String(opts[i][0] === v))); on(v); } } }, tt)));
  return h('div', { class: 'an-ctl' }, h('span', {}, label), s);
}
function chartSheet(def) {
  const co = S.co;
  if (def.line) {
    openSheet(def.n, (b, rec) => {
      const Hh = multHist(co), a = Hh[def.line[1]], ok = a.filter((x) => x > 0 && x < 300), md = median(ok);
      const host = h('div', { class: 'an-chart' }), tip = h('div', { class: 'an-tip', hidden: true });
      const stat = (tt, v) => h('div', {}, h('span', {}, tt), h('b', {}, v));
      b.append(h('p', { class: 'an-ex' }, T(def.line[3])), h('div', { class: 'an-chartw' }, tip, host),
        h('div', { class: 'an-stats' }, stat(T('anToday'), fmt(fin(a).pop(), 'x', co, 1)), stat(T('anMed10'), fmt(md, 'x', co, 1)),
          stat(T('anRange'), ok.length ? iso(Math.min(...ok).toFixed(0) + '–' + Math.max(...ok).toFixed(0) + '×') : '—')));
      rec.draw = () => drawChart(host, { labels: Hh.t.map((x) => (x.slice(5) === '01' ? x.slice(0, 4) : '')), tipLabels: Hh.t.map((x) => x.slice(5) + '/' + x.slice(0, 4)),
        series: [{ name: def.n, color: cssv(def.line[2]), vals: a.map((x) => (x > 0 && x < 300 ? x : null)) }], unit: 'x', co, h: 260, line: true, avg: md, avgName: T('anMedian'), tipHost: tip, title: def.n });
    });
    return;
  }
  const long = co.years.length > 6;
  const st = { mode: 'fy', range: long ? '10' : 'all', view: 'v', hide: new Set() };
  const ratio = def.s.every((k) => M[k].ratio), noPct = def.s.some((k) => M[k].noPct || M[k].ratio), noG = def.s.length > 1 && def.s.some((k) => M[k].f);
  openSheet(def.n, (b, rec) => {
    const host = h('div', { class: 'an-chart' }), tip = h('div', { class: 'an-tip', hidden: true }), stats = h('div', { class: 'an-stats' }), tbl = h('div', { class: 'an-tblw', hidden: true });
    const chartW = h('div', { class: 'an-chartw' }, tip, host);
    const q = def.s.length === 1 && M[def.s[0]].q;
    b.append(...[q ? h('p', { class: 'an-ex' }, T(q)) : null,
      def.s.length > 1 ? h('div', { class: 'an-chips' }, ...def.s.map((k) => h('button', { class: 'an-chip', type: 'button', 'aria-pressed': 'true', on: { click: (e) => {
        if (st.hide.has(k)) st.hide.delete(k); else if (st.hide.size < def.s.length - 1) st.hide.add(k); else return;
        e.currentTarget.setAttribute('aria-pressed', String(!st.hide.has(k))); draw(); } } }, h('i', { style: `background:${cssv(M[k].c)}` }), T(M[k].n)))) : null,
      chartW, tbl, stats,
      long ? segCtl(T('anCRange'), [['5', T('anC5')], ['10', T('anC10')], ['all', T('anCAll')]], st.range, (v) => { st.range = v; draw(); }) : null,
      ratio ? null : segCtl(T('anCView'), [['v', T('anCVal')], ['g', T('anCGrowth'), noG], ['r', T('anCPctRev'), noPct]], 'v', (v) => { st.view = v; draw(); }),
      segCtl(T('anCPeriod'), [['fy', T('anCAnnual')], ['q', T('anCQuarter')]], 'fy', (v) => { st.mode = v; draw(); }),
      segCtl(T('anCShow'), [['c', T('anCChart')], ['t', T('anCTable')]], 'c', (v) => { chartW.hidden = v === 't'; tbl.hidden = v !== 't'; }),
      srcBlock(co, def.s),
    ].filter(Boolean));
    function draw() {
      const d = seriesFor(co, def, st), one = d.series.length === 1 ? d.series[0].vals : null, avg = one ? mean(one) : null;
      // שכבה 6: ערך שהבדיקות סימנו — מסומן בבועה ובטבלה
      const fl = d.per.map((p) => flagsAt(co, def.s, p));
      d.tipLabels = d.tipLabels.map((l, i) => (fl[i] ? l + ' · ' + T('anFlagTip') : l));
      drawChart(host, { ...d, co, h: 240, avg, tipHost: tip, title: def.n });
      stats.textContent = ''; stats.hidden = !one;
      if (one) {
        const fyv = d.per.map((p, i) => [p, one[i]]).filter(([p, v]) => p.kind !== 'ttm' && v != null);
        const n = fyv.length > 1 ? (st.mode === 'q' ? (fyv.length - 1) / 4 : fyv.length - 1) : 0;
        const g = st.view === 'v' && !M[def.s[0]].ratio && n ? cagr(fyv[0][1], fyv[fyv.length - 1][1], n) : null;
        const stat = (tt, v) => h('div', {}, h('span', {}, tt), h('b', {}, v));
        stats.append(stat(T('anAvg'), fmt(avg, d.unit, co)), stat(T('anGrowthYr'), g == null ? '—' : sgn(g)), stat(T('anLast'), fmt(one[one.length - 1], d.unit, co)));
      }
      tbl.textContent = '';
      const t = h('table', { class: 'an-tbl' });
      t.append(h('thead', {}, h('tr', {}, h('th', {}), ...d.labels.map((l) => h('th', {}, l)))),
        h('tbody', {}, ...d.series.map((s) => h('tr', {}, h('td', {}, s.name), ...s.vals.map((v, i) => h('td', fl[i] ? { class: 'an-flagc', title: T('anFlagTip') } : {}, strip(fmt(v, d.unit, co))))))));
      tbl.append(t);
      requestAnimationFrame(() => { tbl.scrollLeft = -tbl.scrollWidth; });
    }
    rec.draw = draw;
  });
}
/* ---------- שכבה 6 (25/10/2026): מאיפה כל מספר ----------
   לכל מדד: השורה בדוח (התגית שהחברה עצמה מציגה — co.tags) או איך הוא מחושב; הדוח ב־SEC וכמה ערכים נבדקו מולו (co.face);
   ושנים שהבדיקות סימנו (co.flags). רק מה שכבר בתשובה — בלי פנייה לרשת */
const RAWK = { rev: ['rev'], gp: ['gp', 'cogs'], op: ['op'], ni: ['ni'], eps: ['eps'], sh: ['sh'], ocf: ['ocf'], buy: ['buy'], dps: ['dps', 'divp'], eq: ['eq'], ta: ['ta'], tl: ['tl'],
  cashT: ['cash', 'msec'], debt: ['debt', 'debtNc', 'debtC', 'stb'], capexN: ['capex'], sbcN: ['sbc'], fcf: ['ocf', 'capex'], fcfsbc: ['ocf', 'capex', 'sbc'],
  gm: ['gp', 'rev'], om: ['op', 'rev'], nm: ['ni', 'rev'], cr: ['ca', 'cl'], de: ['debt', 'eq'], roe: ['ni', 'eq'], roic: ['op', 'eq', 'debt', 'cash'], r40: ['rev', 'ocf', 'capex'] };
function srcDef(co, k) {
  switch (k) {
    case 'gp': return co.tags && co.tags.gp ? null : T('anDefGp');
    case 'tl': return co.tags && co.tags.tl ? null : T('anDefTl');
    case 'dps': return co.tags && co.tags.dps ? null : T('anDefDps');
    case 'cashT': return T('anDefCash');
    case 'debt': return T('anDefDebt');
    case 'fcf': return T('anDefFcf');
    case 'fcfsbc': return T('anDefOwn');
    case 'capexN': return co.tags && /\+/.test(co.tags.capex || '') ? T('anDefCapex') : null;
    case 'gm': case 'om': case 'nm': return T('anDefMargin');
    case 'cr': return T('anDefCr');
    case 'de': return T('anDefDe');
    case 'roe': return T('anDefRoe');
    case 'roic': return T('anDefRoic');
    case 'r40': return T('anDefR40');
    default: return null;
  }
}
const OWN_TAG = { rev: 'rev', op: 'op', ni: 'ni', eps: 'eps', sh: 'sh', ocf: 'ocf', buy: 'buy', dps: 'dps', eq: 'eq', ta: 'ta', tl: 'tl', gp: 'gp', capexN: 'capex', sbcN: 'sbc', cashT: 'cash', debt: 'debt' };
const flagMs = (f) => (f.m ? [f.m] : f.k === 'bal' ? ['ta', 'tl', 'eq'] : []);   // מאזן שלא מתאזן — שייך לשלושתם
// תיקון אוטומטי והשלמה מהדוח עצמו — מידע, לא "לבדוק": הערך כמו שהודפס
const FL_INFO = new Set(['fix', 'ffill', 'ffix']);
const flagOn = (f, raw) => !FL_INFO.has(f.k) && flagMs(f).some((m) => raw.has(m));
function flagsAt(co, keys, p) {
  if (!p || p.kind !== 'fy' || !co.flags.length) return null;
  const raw = new Set(keys.flatMap((k) => RAWK[k] || [k]));
  return co.flags.find((f) => f.p === p.end && flagOn(f, raw)) || null;
}
function srcBlock(co, keys) {
  const rows = [];
  const f = co.face;
  if (co.src === 'sec' && f) {
    const link = /^https:\/\/www\.sec\.gov\//.test(f.url || '') ? h('a', { href: f.url, target: '_blank', rel: 'noopener noreferrer', class: 'an-link' }, T('anSrcLink')) : null;
    rows.push(h('div', { class: 'an-row' }, h('span', { class: 'an-ic ' + (f.n && f.ok === f.n ? 'y' : 'na') }, f.n && f.ok === f.n ? '✓' : '!'),
      h('div', { class: 'an-rt' }, h('b', {}, T('anSrcSec', { f: iso(f.form || '10-K'), d: iso(dmy(f.filed)) })), h('span', {}, f.n ? T('anSrcOk', { ok: f.ok, n: f.n }) : T('anSrcNoChk'))), link));
  } else rows.push(h('div', { class: 'an-row' }, h('span', { class: 'an-ic na' }, 'i'), h('div', { class: 'an-rt' }, h('b', {}, T(co.src === 'sec' ? 'anSrcSecOnly' : 'anSrcYahoo')))));
  for (const k of keys) {
    const tg = co.tags && OWN_TAG[k] && co.tags[OWN_TAG[k]], def = srcDef(co, k);
    const sub = [];
    if (def) sub.push(h('span', {}, def));
    if (tg && (!def || k === 'capexN')) sub.push(h('span', { class: 'an-tag' }, h('bdi', {}, String(tg).split('+').join(' + '))));
    if (k === 'debt' && co.tags && co.tags.debt) sub.push(h('span', { class: 'an-tag' }, h('bdi', {}, ['debt', 'debtNc', 'debtC', 'stb'].map((x) => co.tags[x]).filter(Boolean).join(' · '))));
    if (!sub.length) continue;
    rows.push(h('div', { class: 'an-row' }, h('div', { class: 'an-rt' }, h('b', {}, T(M[k].n)), ...sub)));
  }
  const raw = new Set(keys.flatMap((k) => RAWK[k] || [k]));
  const yrs = [...new Set(co.flags.filter((x) => flagOn(x, raw)).map((x) => x.p.slice(0, 4)))].sort();
  const fixed = co.flags.some((x) => x.k === 'fix' && x.m && raw.has(x.m));
  const fromRep = (kk) => [...new Set(co.flags.filter((x) => x.k === kk && x.m && raw.has(x.m)).map((x) => x.p.slice(0, 4)))].sort();
  if (yrs.length) rows.push(h('button', { class: 'an-row', type: 'button', on: { click: flagSheet } }, h('span', { class: 'an-ic na' }, '!'),
    h('div', { class: 'an-rt' }, h('b', {}, T('anSrcFlag', { y: iso(yrs.join(', ')) })), h('span', {}, T('anSrcFlagS'))), h('span', { class: 'an-chev' })));
  if (fixed) rows.push(h('div', { class: 'an-row' }, h('span', { class: 'an-ic y' }, '✓'), h('div', { class: 'an-rt' }, h('b', {}, T('anFlFix')))));
  for (const [kk, lb] of [['ffill', 'anFlFill'], ['ffix', 'anFlFfix']]) {
    const ys = fromRep(kk);
    if (ys.length) rows.push(h('div', { class: 'an-row' }, h('span', { class: 'an-ic y' }, '✓'), h('div', { class: 'an-rt' }, h('b', {}, T(lb)), h('span', {}, iso(ys.join(', '))))));
  }
  if (co.derived && keys.some((k) => (RAWK[k] || [k]).some((x) => (co.derived[x] || []).length))) rows.push(h('div', { class: 'an-row' }, h('div', { class: 'an-rt' }, h('span', {}, T('anSrcQ4')))));
  return h('details', { class: 'an-prov' }, h('summary', {}, T('anSrcT'), h('span', { class: 'an-chev' })), h('div', { class: 'an-list' }, ...rows));
}
function checkSheet(k) {
  const C = checks(S.co, MAC)[k];
  openSheet(C.n, (b) => {
    b.append(h('p', { class: 'an-ex' }, T('anChkSub', { n: passN(C) })));
    const list = h('div', { class: 'an-list' });
    for (const x of C.chk) {
      const exp = h('p', { class: 'an-ex an-exp', hidden: true }, x.ex);
      list.append(h('div', {}, h('button', { class: 'an-row', type: 'button', 'aria-expanded': 'false', on: { click: (e) => { exp.hidden = !exp.hidden; e.currentTarget.setAttribute('aria-expanded', String(!exp.hidden)); } } },
        h('span', { class: 'an-ic ' + (x.pass === true ? 'y' : x.pass === false ? 'n' : 'na') }, x.pass === true ? '✓' : x.pass === false ? '✕' : '–'),
        h('div', { class: 'an-rt' }, h('b', {}, x.q), h('span', {}, x.thr)), h('div', { class: 'an-rv' }, x.v)), exp));
    }
    b.append(list);
  });
}
function factSheet(key) {
  const co = S.co, c = ctx(co, nowP(co));
  const X = { mcap: [T('anFMcap'), T('anXMcap', { s: strip(fmt(co.sharesOut, 'shares', co)) })],
    pe: [T('anFPe'), T('anXPeF', { e: strip(fmt(c.eps, 'ps', co)) })],
    fpe: [T('anFFpe'), T('anXFpe')],
    fy: [T('anFFy'), T('anXFy', { f: strip(fmt(c.fcf, 'money', co)) })],
    nc: [c.netcash >= 0 ? T('anNetCash') : T('anNetDebt'), T(c.netcash >= 0 ? 'anXNc' : 'anXNd', { c: strip(fmt(c.cashT, 'money', co)), d: strip(fmt(c.debt, 'money', co)) })] }[key];
  openSheet(X[0], (b) => b.append(h('p', { class: 'an-ex an-ex-lg' }, X[1])), { small: true });
}
function estSheet() {
  const co = S.co;
  openSheet(T('anEstTitle'), (b) => {
    const fy0 = co.years[co.years.length - 1], eps = co.A.eps || [], base = eps[eps.length - 1];
    let prev = base;
    const rows = [[T('anActual', { y: fy0 }), base, null, null]].concat(co.nq.map((r) => { const g = prev ? r.eps / prev - 1 : null; prev = r.eps; return [String(r.fy).slice(-4), r.eps, g, r.n]; }));
    b.append(h('p', { class: 'an-ex' }, T('anEstEx')), h('div', { class: 'an-list' }, ...rows.map(([y, e, g, n]) => h('div', { class: 'an-row' },
      h('div', { class: 'an-rt' }, h('b', {}, String(y)), h('span', {}, n ? T('anNAnalysts', { n }) : T('anAnnualRep'))),
      h('div', { class: 'an-rv' }, fmt(e, 'ps', co), g != null ? h('small', { class: g >= 0 ? 'an-up' : 'an-down' }, sgn(g)) : null)))));
  });
}
const FLAG_KEYS = { bal: 'anFlBal', eps: 'anFlEps', neg: 'anFlNeg', scale: 'anFlScale', q4: 'anFlQ4', xy: 'anFlXy', face: 'anFlFace', fix: 'anFlFix', ffill: 'anFlFill', ffix: 'anFlFfix', gp: 'anFlGp', part: 'anFlPart' };
const flagUnit = (m) => (m === 'eps' ? 'ps' : m === 'sh' ? 'shares' : (M[m] && M[m].u) || 'money');
function flagSheet() {
  const co = S.co;
  openSheet(T('anFlTitle'), (b) => {
    b.append(h('p', { class: 'an-ex' }, T('anFlEx')), h('div', { class: 'an-list' }, ...co.flags.map((f) => h('div', { class: 'an-row' },
      FL_INFO.has(f.k) ? h('span', { class: 'an-ic y' }, '✓') : h('span', { class: 'an-ic na' }, '!'), h('div', { class: 'an-rt' }, h('b', {}, T(FLAG_KEYS[f.k] || 'anFlOther')), h('span', {}, T('anYearOf', { y: f.p.slice(0, 4) }) + (f.m && M[f.m] ? ' · ' + T(M[f.m].n) : '')
        + (f.k === 'face' && f.f != null ? ' · ' + T('anFlFaceV', { f: fmt(f.f, flagUnit(f.m), co), v: fmt(f.v, flagUnit(f.m), co) }) : '')))))));
  });
}

/* בדיקות (node) — הפונקציות הטהורות */
export const _test = { finInputs, riValue, impliedRoe, reitInputs, lossView, fairOf, flagsAt, srcDef, rawName, RAWK, OWN_TAG, prep, indFix, pickPeers, peerRow, ctx, periodList, hasTTM, raw, multHist, autoInputs, dcf, scenarios, reverseG, multModel, uncertainty, checks, piotroski, altman, fmt, sgn, cagrN, epsPath,
  setEnv: (e) => { E = e; } };
