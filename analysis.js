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
  if (a >= 1e6) return (v / 1e6).toFixed(d ?? (a >= 1e8 ? 0 : a >= 1e7 ? 1 : 2)) + 'M';   // 16/11/2026: 3 ספרות משמעותיות, כמו בשאר האפליקציה
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
  co.C = null;
  if (d.C) { co.C = { A: {}, Q: {} }; for (const m in d.C.A || {}) co.C.A[m] = d.C.A[m].slice(k); for (const m in d.C.Q || {}) co.C.Q[m] = d.C.Q[m].slice(j); }
  const p = d.prof || {};
  co.name = p.name || d.sym; co.exch = p.exch || ''; co.sector = p.sector || ''; co.industry = p.industry || '';
  co.ind = d.indData || {}; co.indName = d.ind || '';
  // מחיר: הציטוט החי של האפליקציה כשיש (השרתון שומר במטמון עד 12 שעות)
  // המכפיל הצפוי של Yahoo מחושב מול המחיר שלו ברגע השליפה (עד 12 שעות במטמון). הרווח הצפוי שמאחוריו (fe) — קבוע; המכפיל
  // עובר למחיר החי, כמו שאר המכפילים, ומכפיל באפט הצפוי מחושב מאותו רווח (18/11/2026) — כך ששני המכפילים הצפויים נבדלים רק בתגמול
  co.pxY = co.price; co.fe = co.pxY > 0 && co.fpe > 0 ? co.pxY / co.fpe : null;
  if (q && q.close > 0) {
    co.price = q.close; if (q.prev > 0) co.prev = q.prev; else if (q.regClose > 0 && q.regCh != null) co.prev = q.regClose - q.regCh;
    const k = co.pxY > 0 ? q.close / co.pxY : 0;
    if (co.fe > 0 && k > 0.5 && k < 2) co.fpe = q.close / co.fe;   // יחס חריג (פיצול באמצע) — נשאר המכפיל של Yahoo
  }
  // מניה בת״א שמדווחת בדולרים (או ההפך) — המחיר מומר למטבע הדוחות, כדי שהמכפילים והשווי יהיו באותו מטבע
  const pxCur = /\.TA$/.test(d.sym) ? 'ILS' : 'USD';
  co.pxCur = pxCur; co.fxNote = false;
  if (co.cur !== pxCur && fx > 0 && (co.cur === 'USD' || co.cur === 'ILS')) {
    const r = pxCur === 'ILS' ? 1 / fx : fx;
    if (co.price) co.price *= r; if (co.prev) co.prev *= r;
    if (co.px) co.px = { t: co.px.t, c: co.px.c.map((x) => (x == null ? null : x * r)) };
    co.fxNote = true;
  }
  // דוחות במטבע אחר והמחיר בדולר (Novo Nordisk ב־DKK, TSMC ב־TWD, Alibaba ב־CNY, SAP ו־ASML ב־EUR; 17/11/2026, גל 2 — F6):
  // המחיר למניה רגילה במטבע הדוחות = מחיר ה־ADR ÷ יחס ה־ADR ÷ השער (היום — השער היומי האחרון; ההיסטוריה — הממוצע של אותו
  // חודש, H.10 דרך השרתון, d.fxm). עד 16/11/2026 המכפילים חילקו דולר בקרונות (P/E של Novo ‎1.8, של TSMC ‎8.9)
  const X = d.fxm;
  if (!co.fxNote && co.cur && co.cur !== pxCur && pxCur === 'USD' && X && X.cur === co.cur && X.now > 0 && X.adr > 0) {
    const M = new Map(X.m || []), k = 1 / X.adr;
    if (co.price) co.price *= k / X.now; if (co.prev) co.prev *= k / X.now;
    if (co.px) co.px = { t: co.px.t, c: co.px.c.map((x, i) => { const r = M.get(co.px.t[i]); return x == null || !(r > 0) ? null : x * k / r; }) };
    co.fxNote = true; co.fxAdr = X.adr;
  }
  // מטבע בלי שער או בלי יחס ADR ודאי — בלי מכפילים ובלי שווי שוק (pxF), עדיף ריק משגוי
  co.fxMix = !!co.cur && co.cur !== pxCur && !co.fxNote;
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
const hasTTM = (co) => co.q.length >= 4 && co.q[co.q.length - 1] > co.fyE[co.fyE.length - 1] && qRun(co, co.q.length - 4, co.q.length - 1); // בלי רצף — "עכשיו" = השנה האחרונה
/* רבעונים רצופים (26/10/2026): רבעון שחסר ברשימה (דוח שלא הוגש ב־XBRL / בלי הכנסות) לא נבלע — ארבע נקודות סמוכות ברשימה
   עם חור ביניהן הן 15 חודשים, לא 12. כל רבעון 75–105 יום אחרי הקודם, או 110–120 (רבעון של 16/17 שבועות בשנה של 52/53
   שבועות — Kroger, Costco, PepsiCo; עד 16/11/2026 שבר את הרצף וה־TTM חסר בשלושה רבעונים מכל ארבעה); "שנה קודם" = הרבעון שמסתיים 365±15 יום לפני
   (בדרך כלל 4 מקומות אחורה — כשחסר רבעון ביניהם, לפי התאריך) */
const qDays = (a, b) => (Date.parse(b) - Date.parse(a)) / 864e5;
// המחיר במטבע הדוחות — לכל חישוב מול נתוני הדוחות (מכפילים, שווי שוק, מחשבון). null כשהמטבעות שונים ואין המרה (fxMix)
const pxF = (co) => (co && !co.fxMix && co.price > 0 ? co.price : null);
/* מחיר לבדיקה (18/11/2026, בקשת המשתמש — "לערוך את המחיר ושזה ישפיע ישירות על שווי השוק, המכפילים, המכפילים העתידיים
   והמחשבון"; ולהפך — תשואה שנתית רצויה במחשבון קובעת את המחיר). co.price = המחיר שהוזן, co.price0 = האמיתי.
   מה שנמדד מול המחיר (שווי שוק, מכפילים, המכפיל הצפוי, תשואת התזרים, בדיקות התמחור, נקודת "היום" בהיסטוריית המכפילים,
   התשואה במחשבון) — לפי המחיר הערוך. מה שלא תלוי במחיר (הערכים המוצעים במחשבון, ההנחות, מחיר ההון, גרף המחיר) — תמיד
   לפי האמיתי (real), כדי שלא יזוזו כשמשנים מחיר. בזיכרון בלבד: כל פתיחה של הניתוח בונה את החברה מחדש מהתשובה,
   ולכן כל יציאה מחזירה את המחיר האמיתי */
function setPx(co, v) {
  if (!co) return co;
  if (!('price0' in co)) { co.price0 = co.price; co.fpe0 = co.fpe; }
  const on = v > 0 && co.price0 > 0 && Math.abs(v / co.price0 - 1) > 1e-9;
  co.price = on ? v : co.price0;
  // המכפיל הצפוי (Yahoo) = המחיר ÷ הרווח הצפוי למניה — זז ביחס ישר למחיר
  co.fpe = on && co.fpe0 > 0 ? co.fpe0 * v / co.price0 : co.fpe0;
  co.pxEd = on;
  co._mh = null;   // נקודת "היום" בהיסטוריית המכפילים
  return co;
}
const real = (co) => (co && co.pxEd ? co._real || (co._real = { ...co, price: co.price0, fpe: co.fpe0, pxEd: false, _mh: null, _real: null }) : co);
const pxReal = (co) => (co && co.pxEd ? co.price0 : co && co.price);
function qRun(co, a, b) {
  if (a < 0) return false;
  for (let j = a + 1; j <= b; j++) { const d = qDays(co.q[j - 1], co.q[j]); if (!((d >= 75 && d <= 105) || (d >= 110 && d <= 120))) return false; }
  return true;
}
function qBack(co, i, n = 1) {
  const near = (j) => j >= 0 && j < i && Math.abs(qDays(co.q[j], co.q[i]) - 365.25 * n) <= 15 * n;
  if (near(i - 4 * n)) return i - 4 * n;
  for (let j = i - 1; j >= 0; j--) if (near(j)) return j;
  return -1;
}
/* השנה הקודמת כפי שהוצגה באותו דוח (26/10/2026, AppLovin): co.C = יחסי הצמיחה מהשרתון — רק לתקופות שהחברה הציגה
   מחדש (פעילות שנמכרה, שינוי מדיניות). ערך ההשוואה = הערך ÷ היחס; undefined = אין הצגה מחדש (הערך הקודם בסדרה) */
const cmpDiv = (v, r) => (v != null && r ? v / r : null);
function cmpPrev(co, k, p) {
  const C = co.C; if (!C) return undefined;
  if (p.kind === 'fy') { const r = C.A[k]?.[p.i]; return r != null ? cmpDiv(co.A[k]?.[p.i], r) : undefined; }
  const Q = co.Q[k] || [], R = C.Q[k];
  if (!R) return undefined;
  if (p.kind === 'q') return R[p.i] != null ? cmpDiv(Q[p.i], R[p.i]) : undefined; // 0 = על בסיס אחר ואין דרך להשוות — בלי צמיחה
  // TTM: כל רבעון מול הרבעון שלו שנה קודם — מאותו דוח כשהוצג מחדש
  if (!SUMQ(k) || (co.T && co.T[k] != null)) return undefined;
  const end = co.q.length - 1; if (end < 7 || !qRun(co, end - 3, end)) return undefined;
  let s = 0, any = false;
  for (let j = end - 3; j <= end; j++) {
    const x = R[j] != null ? cmpDiv(Q[j], R[j]) : Q[qBack(co, j)] ?? null;
    if (x == null) return R[j] != null || any ? null : undefined;
    s += x; any = any || R[j] != null;
  }
  return any ? s : undefined;
}
const restated = (co, keys) => (co.C ? co.fyE.map((_, i) => i).filter((i) => keys.some((k) => co.C.A[k]?.[i] != null)) : []);
function raw(co, k, p, back = 0, cmp = false) {
  if (cmp && back === 1) { const c = cmpPrev(co, k, p); if (c !== undefined) return c; }
  if (p.kind === 'fy') { const i = p.i - back; return i >= 0 ? co.A[k]?.[i] ?? null : null; }
  const Q = co.Q[k] || [];
  if (p.kind === 'q') { const i = back ? qBack(co, p.i, back) : p.i; return i >= 0 ? Q[i] ?? null : null; }
  if (!back && co.T && co.T[k] != null) return co.T[k];
  const end = back ? qBack(co, co.q.length - 1, back) : co.q.length - 1;
  if (end < 0) return null;
  if (!SUMQ(k)) return Q[end] ?? null;
  if (!qRun(co, end - 3, end)) return null;
  let s = 0; for (let j = end - 3; j <= end; j++) { if (Q[j] == null) return null; s += Q[j]; }
  return s;
}
/* הרבעון הקלנדרי של סוף התקופה — לפי התאריך פחות 14 יום (16/11/2026, בדיקת העומק): שנה של 52/53 שבועות מסתיימת לפעמים
   ב־1–3 בחודש ("Q4" שנגמר ב־1 בינואר 2023 יצא Q1·23, ושוב Q4·23 בסוף השנה — שתי תוויות זהות ברשימה) */
const qOf = (e) => { const d = new Date(Date.parse(e.slice(0, 10) + 'T00:00:00Z') - 14 * 864e5); return { q: Math.floor(d.getUTCMonth() / 3) + 1, y: d.getUTCFullYear() }; };
const qLabel = (e) => { const o = qOf(e); return 'Q' + o.q + '·' + String(o.y).slice(2); };
function periodList(co, mode) {
  if (mode === 'q') return co.q.map((e, i) => ({ kind: 'q', i, label: qLabel(e), end: e }));
  const l = co.fyE.map((e, i) => ({ kind: 'fy', i, label: String(co.years[i]), end: e }));
  if (hasTTM(co)) l.push({ kind: 'ttm', i: co.q.length - 1, label: 'TTM', end: co.q[co.q.length - 1] });
  return l;
}
const fyList = (co) => periodList(co, 'fy').filter((p) => p.kind === 'fy');
const nowP = (co) => { const l = periodList(co, 'fy'); return l[l.length - 1]; };
function ctx(co, p, back = 0, cmp = false) {
  const v = (k) => raw(co, k, p, back, cmp);
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
/* 27/10/2026 (בקשת המשתמש — לפי ת־ניתוח): Rule of 40 = צמיחת ההכנסות + שולי הרווח התפעולי. פונקציה אחת לכל מקום שמציג
   אותו (הגיליון, כרטיס ההפסד) — עד היום שתי נוסחאות שונות: תזרים חופשי, ותזרים חופשי פחות תשלום במניות */
function r40Of(co, p) { const g = growthOf(co, p, 'rev'), m = ctx(co, p).om; return g != null && m != null ? g + m : null; }
/* מכפיל היסטורי — ממוצע (לפי ת־ניתוח) של הנקודות עם ערך בלבד: בלי רווח / שלילי / מעל 300 לא נספר כאפס */
const multAvg = (a) => mean(a.filter((x) => x > 0 && x < 300));
const growthOf = (co, p, k) => { const a = ctx(co, p)[k], b = ctx(co, p, 1, true)[k]; return a != null && b != null && b > 0 ? a / b - 1 : null; };
const fyVals = (co, k, n) => fyList(co).slice(-n).map((p) => ctx(co, p)[k]);
/* מכפיל באפט (18/11/2026, בקשת המשתמש; docs/buffett-pe.md). הרווח לפי באפט = "רווח הרחוב" (הרווח בפועל של Yahoo — אותו בסיס
   שעליו האנליסטים צופים) פחות התגמול במניות אחרי מס. מורידים רק ברבעון שבו הרווח המותאם של החברה מוציא את התגמול (sbcX — ההודעה
   לעיתונות של אותו רבעון, lib/secsbc.js בשרתון), ועד גובה הפער מול הרווח המדווח (רחוב = GAAP — התגמול כבר בפנים). הפחתת נכסים
   מרכישות לא יורדת: לפי באפט, לרוב לא עלות כלכלית. הצפוי: תחזית +1y פחות התגמול הצפוי — אותו שיעור מההכנסות × ההכנסות הצפויות,
   ורק כשההודעה האחרונה לא הודיעה שהרווח המותאם יכלול אותו (fut; NVDA, ‏INTU). הבסיס הצפוי = הרווח שעליו מחושב המכפיל הצפוי
   של Yahoo (המחיר שלו ÷ fpe; ב־META שונה מממוצע +1y), כדי ששני המכפילים הצפויים ייבדלו רק בתגמול. לא תלוי במחיר (מול pxF).
   ההודעה מאשרת שהתגמול הוצא — מורידים את כולו (QCOM: רווח חד־פעמי ב־GAAP באותו רבעון לא מקטין את הניכוי); אבל כשהסדרה של Yahoo
   היא בעצם GAAP (שווה לרווח המדווח ב־3 מ־4 הרבעונים — PLTR) — לא מורידים. מדיניות לא ידועה — עד גובה הפער מול הרווח המדווח.
   null: מטבע שונה, אין 4 רבעונים רצופים עד "עכשיו", חסר רווח בפועל של Yahoo לרבעון */
const D864 = 864e5;
/* ההודעה של הרבעון שהסתיים ב־e (רשומה של sbcX, או null — אין הודעות). כמה הודעות עד 100 יום אחרי הרבעון — הארוכה (ההודעה המלאה,
   לא הודעה מקדימה); אין בחלון — הקרובה ביותר ל־45 יום אחריו. הודעה שמדווחת על רבעון אחר (r[7] — סוף הרבעון שבה, מגרסה 3 של
   המסווג; Marvell ‏2/11/2026: הודעת מיזוג עם הכנסות מקדימות לרבעון הבא, 93 יום אחרי הרבעון שהסתיים ב־1/8) — לא בחלון. בתוך החלון —
   קודם זו שמזכירה את התגמול הכי הרבה פעמים (r[8]; הודעת תוצאות מלאה מזכירה אותו בתזרים או בגישור, והודעת המיזוג — אף פעם, אף
   שהיא ארוכה ממנה), ורק אחר כך הארוכה */
function sbcRel(co, e) {
  const L = Array.isArray(co.sbcX) ? co.sbcX : [];
  if (!L.length) return null;
  const t = Date.parse(e), w = L.filter((r) => { const d = (Date.parse(r[0]) - t) / D864; return d > 0 && d <= 100 && !(r[7] && Math.abs(Date.parse(r[7]) - t) > 10 * D864); });
  if (w.length) return w.reduce((a, b) => ((b[8] || 0) > (a[8] || 0) || ((b[8] || 0) === (a[8] || 0) && (b[3] || 0) > (a[3] || 0)) ? b : a));
  return L.reduce((a, b) => (Math.abs(Date.parse(b[0]) - t - 45 * D864) < Math.abs(Date.parse(a[0]) - t - 45 * D864) ? b : a));
}
// מדיניות הרבעון: 1 מוציא / 0 כולל / null (אין הודעות)
function sbcPol(co, e) { const r = sbcRel(co, e); return r ? (r[1] ? 1 : 0) : null; }
/* שיעור המס על התגמול ברבעון (19/11/2026, גל 1 של שיטת באפט; docs/buffett-method-research.md §6.4, §13.1, §13.12, §13.13). הרווח המותאם
   של הרחוב מחושב בשיעור ה־non-GAAP שהחברה מצהירה — ולכן הניכוי באותו שיעור, לא בשיעור האפקטיבי של הדוחות (מעוות בהטבות המס של
   התגמול עצמו: Palantir ‏1.2%). הסדר: ריט → 0 (מחלק את הרווח ולא משלם מס חברות — אין מגן מס); השיעור בהודעה של הרבעון; השיעור
   האחרון שהוצהר בהודעה קרובה (עד 400 יום — Marvell ‏11% כשלרבעון אין רווח לפני מס ב־XBRL); מס ÷ רווח לפני מס ב־12 החודשים, ואם
   חסר — בשנה האחרונה; אחרת 21% (השיעור הפדרלי). כל שיעור מחוץ ל־10%–30% — לא נלקח (האינווריאנט של §6.12; שיעור הדוחות של Meta
   ‏4.6% ושל Broadcom ‏5.4% — הטבות חד־פעמיות, לא המס על התגמול) */
const TAU_OK = (x) => x >= 0.1 && x <= 0.3;
function bufTau(co, rel, e, xt) {
  if (co.reit) return { t: 0, s: 'reit' };
  const L = Array.isArray(co.sbcX) ? co.sbcX : [], at = Date.parse(e) + 45 * D864;
  // המס של המדד המותאם כבר כולל את הטבת המס על התגמול (r[9], מנהלות השקעות) — הניכוי לפני מס, אחרת המגן נספר פעמיים
  if ((rel && rel[9]) || L.some((r) => r[9] && Math.abs(Date.parse(r[0]) - at) <= 400 * D864)) return { t: 0, s: 'tb' };
  if (rel && TAU_OK(rel[4])) return { t: rel[4], s: 'pr' };
  let best = null;
  for (const r of L) if (TAU_OK(r[4])) { const d = Math.abs(Date.parse(r[0]) - at); if (d <= 400 * D864 && (!best || d < best.d)) best = { d, t: r[4] }; }
  if (best) return { t: best.t, s: 'pr' };
  if (xt != null) return { t: xt, s: 'x' };
  return { t: 0.21, s: 'd' };
}
/* סכום התגמול ברבעון i (§13.11): השורה שהחברה הוציאה בגישור שבהודעה — הרחוב בנוי עליה, ולכן הניכוי הופך בדיוק אותה. תגמול שרשום
   בשורת רכישות או ארגון מחדש (Palo Alto: ‏684 בדוח הרווח, 517 בשורת התגמול) — לא כאן. המספרים בשורה גולמיים (מיליונים, אלפים, למניה),
   וסדר הגודל נקבע מול ה־XBRL של אותו רבעון (יחס 0.4–1.25). העמודה: הראשונה — לא "הקרובה ל־XBRL" (Salesforce: ‏805 ברבעון, ‏820 שנה
   קודם, וה־XBRL ‏819 כולל תגמול של ארגון מחדש); חוץ משורה של רבעוני השנה זה לצד זה וסך בסוף (Intuit: ‏543 521 485 ‏1,549 — הסך
   = סכום הקודמים, והרבעון = האחרון לפניו), ושנה קודמת בעמודה הראשונה (מתאימה ל־XBRL של לפני שנה, והשנייה — לרבעון). בלי שורה —
   XBRL מתגית אחת (co.bx, בלי ערבוב בין רבעונים): ההוצאה בדוח הרווח (חוץ מתיוג חלקי — פחות מחצי מהתזרים), התוספת בתזרים, הגידול
   בהון; ובתשובה ישנה — Q.sbc. oth — הדוחות גדולים ב־15% ומעלה מהשורה (תגמול בשורות אחרות) */
/* העמודה של הרבעון בשורה של כמה רבעונים (null — לא נקבע מהמבנה). (א) התזוזה מול השורה בהודעה של הרבעון הקודם: 5 רבעונים מהישן
   לחדש (Blackstone, ‏Carlyle: "301,562 358,364 561,217 353,753 329,217" — ברבעון הבא אותה שורה זזה שמאלה) → החמישית; מהחדש לישן
   (Blue Owl) → הראשונה. (ב) בלי הודעה קודמת: עמודה שהיא סכום של 2–4 רבעונים רצופים לפניה — המצטבר מתחילת השנה או 12 חודשים
   (Intuit ‏543 521 485 ‏1,549; ‏Apollo ‏… 156 129 145 ‏313 430; ‏Carlyle ‏… 121.8 117 102.3 ‏289.3 341.1). הכיוון — לפי היחס בין הרבעון
   לרבעון שלפניו, מול אותו יחס ב־XBRL (בלי XBRL — מהישן לחדש) */
function sbcCol(co, i, rel, vs, refOf) {
  const near = (a, b) => a > 0 && b > 0 && Math.abs(a / b - 1) <= 0.005;
  const rp = i > 0 ? sbcRel(co, co.q[i - 1]) : null, pv = rp && rp[0] !== rel[0] && Array.isArray(rp[5]) ? rp[5].filter((v) => v > 0) : null;
  if (pv && vs.length >= 5 && pv.length >= 5) {
    let o = 0, w = 0;
    for (let j = 0; j < 4; j++) { if (near(vs[j], pv[j + 1])) o++; if (near(vs[j + 1], pv[j])) w++; }
    if (o >= 3 && o > w) return vs[4];
    if (w >= 3 && w > o) return vs[0];
  }
  const dec = vs.some((v) => v % 1 !== 0), r0 = refOf(i), r1 = i > 0 ? refOf(i - 1) : 0;
  for (let k = 2; k < vs.length; k++) for (let j = k - 1; j >= 1; j--) for (let n = 2; n <= Math.min(4, j + 1); n++) {
    const sm = vs.slice(j - n + 1, j + 1).reduce((a, b) => a + b, 0);
    if (Math.abs(vs[k] - sm) > 0.002 * vs[k] + (dec ? 0.15 : 0)) continue;
    const a = j - n + 1;
    if ((a === 0 && j === k - 1) || !(r0 > 0 && r1 > 0)) return vs[j];
    const g = Math.log(r0 / r1), so = Math.abs(Math.log(vs[j] / vs[j - 1]) - g), sn = Math.abs(Math.log(vs[a] / vs[a + 1]) - g);
    return sn < so ? vs[a] : vs[j];
  }
  return null;
}
function sbcAmt(co, i, rel, t) {
  const e = co.q[i], x = (co.bx && co.bx[e]) || [], al = x[0], cf = x[1], ap = x[2], mq = co.Q.sbc ? co.Q.sbc[i] : null, sh = co.Q.sh ? co.Q.sh[i] : null;
  const refOf = (j) => { const y = (co.bx && co.bx[co.q[j]]) || []; return Math.max(y[0] > 0 ? y[0] : 0, y[1] > 0 ? y[1] : 0, y.length ? 0 : co.Q.sbc && co.Q.sbc[j] > 0 ? co.Q.sbc[j] : 0); };
  const ref = refOf(i);
  if (rel && Array.isArray(rel[5]) && ref > 0) {
    let vs = rel[5].filter((v) => v > 0);
    const one = sbcCol(co, i, rel, vs, refOf);
    if (one != null) vs = [one];
    // סדר הגודל: מיליונים, אלפים, יחידות, ולמניה (רק מספר עם נקודה עשרונית) × המניות
    const fit = (v0, R) => { for (const m of [1e6, 1e3, 1, v0 % 1 !== 0 && sh > 0 ? sh : 0]) { if (!m) continue; const v = rel[6] ? v0 * m / (1 - t) : v0 * m; if (v / R >= 0.4 && v / R <= 1.25) return v; } return null; };
    let pick = null;
    const r4 = i >= 4 ? refOf(i - 4) : 0, a = fit(vs[0], ref), b = vs.length > 1 ? fit(vs[1], ref) : null;
    if (a != null && b != null && r4 > 0 && Math.abs(a / r4 - 1) <= 0.01 && Math.abs(b / ref - 1) <= 0.01 && Math.abs(a / ref - 1) > 0.01) pick = b;
    else for (const v0 of vs) { const v = fit(v0, ref); if (v != null) { pick = v; break; } }
    if (pick != null) return { v: pick, s: 'pr', oth: ref > 1.15 * pick };
  }
  if (al > 0 && !(cf > 0 && al < 0.5 * cf)) return { v: al, s: 'al' };
  if (cf > 0) return { v: cf, s: 'cf' };
  if (ap > 0) return { v: ap, s: 'ap' };
  return mq > 0 ? { v: mq, s: 'q' } : { v: 0, s: null };
}
function bufCalc(co) {
  if (!co || co.fxMix || co.fxNote || !co.q || !co.Q) return null;
  const n = co.q.length, L = n - 1, p = nowP(co);
  if (n < 4 || !p || Math.abs(Date.parse(co.q[L]) - Date.parse(p.end)) > 5 * D864 || !qRun(co, L - 3, L)) return null;
  const hist = (co.hist || []).filter((x) => x && x.q && x.a != null && isFinite(x.a));
  const c = ctx(co, p), Q = co.Q;
  // שיעור המס בדוחות: 12 החודשים, ואם חסר רבעון — השנה האחרונה (§13.13), בתחום 10%–30%
  const fy = fyList(co).slice(-1)[0];
  let pt = raw(co, 'pretax', p), tx = raw(co, 'tax', p);
  if (!(pt > 0 && tx != null) && fy) { pt = raw(co, 'pretax', fy); tx = raw(co, 'tax', fy); }
  const xt = pt > 0 && tx != null && TAU_OK(tx / pt) ? tx / pt : null;
  const rows = [];
  for (let i = L - 3; i <= L; i++) {
    const e = co.q[i], hq = hist.find((x) => Math.abs(Date.parse(x.q) - Date.parse(e)) <= 20 * D864);
    const gi = Q.eps ? Q.eps[i] : null, sh = Q.sh ? Q.sh[i] : null;
    if (!hq || gi == null || !isFinite(gi) || !(sh > 0)) return null;
    const rel = sbcRel(co, e), tau = bufTau(co, rel, e, xt), am = sbcAmt(co, i, rel, tau.t), amz = (co.bx && co.bx[e] && co.bx[e][3]) || 0;
    // Up-C (Blackstone, ‏Blue Owl): המדד למניה של הרחוב מחולק על כל המניות והיחידות (r[10], מההודעה), לא על Class A שב־XBRL
    const ns = rel && rel[10] > 1.15 * sh && rel[10] < 4 * sh ? rel[10] : sh;
    rows.push({ s: hq.a, g: gi, sb: am.v * (1 - tau.t) / ns, pre: am.v / ns, pol: rel ? (rel[1] ? 1 : 0) : null, t: tau.t, ts: tau.s, as: am.s, oth: !!am.oth,
      amz: amz > 0 ? amz * (1 - 0.21) / sh : 0 });
  }
  const yGaap = rows.filter((r) => Math.abs(r.s - r.g) <= Math.max(0.02, 0.02 * Math.abs(r.s))).length >= 3;
  // סדרה מעורבת של Yahoo (B-028; TPG: ‏0.29 ו־0.39 = GAAP, ו־‎−0.05 ו־0.65 — לא GAAP ולא המדד של ההודעה): בדיוק שני רבעונים = GAAP, ובאחר
  // החברה מוציאה את התגמול — אין על מה לנכות (לא ידוע מה הרחוב), אין אריח
  const eqG = (r) => Math.abs(r.s - r.g) <= Math.max(0.005, 0.005 * Math.abs(r.s));
  if (!yGaap && rows.filter(eqG).length === 2 && rows.some((r) => r.pol === 1 && !eqG(r))) return null;
  let st = 0, g = 0, ded = 0, sbcAt = 0, pre = 0, exAt = 0, exDed = 0, p1 = 0, p0 = 0, amz = 0;
  for (const r of rows) {
    if (r.pol === 1) p1++; else if (r.pol === 0) p0++;
    // הרחוב של הרבעון = GAAP (סדרה מעורבת של Yahoo — TPG, ‏ARE, ‏B-028): התגמול כבר ירד בו
    const d = r.pol === 1 && !yGaap && !eqG(r) ? r.sb : 0;
    st += r.s; g += r.g; ded += d; sbcAt += r.sb; pre += r.pre; amz += r.amz;
    if (r.pol !== 0) { exAt += r.sb; exDed += d; }
  }
  // אין הודעות (חברה זרה): קודם מייחסים את הפער מול הרווח המדווח להפחתה מרכישות (שבאפט לא מוריד), ורק את היתר לתגמול — עד התגמול
  // אחרי מס (§6.9, §13.5)
  const unk = !p1 && !p0;
  if (unk && !yGaap) { ded = clamp(st - g - amz, 0, sbcAt); exDed = ded; }
  // יחידות שונות (אגורות מול שקלים, מניה מול ADR) — לא מחשבים. בסימנים הפוכים (רווח מותאם מול הפסד מדווח — SNOW) היחס לא אומר כלום
  if (st * g > 0 && Math.abs(st) > 0.05 && Math.abs(g) > 0.05 && (Math.abs(st / g) > 8 || Math.abs(st / g) < 0.125)) return null;
  const last = rows[rows.length - 1];
  // t — השיעור האפקטיבי על כל הניכוי (לתצוגה); ts — המקור ברבעון האחרון; asrc — מקור הסכום (pr: ההודעה); oth — תגמול בשורות אחרות
  const out = { st, g, gap: st - g, ded, eps: st - ded, sbcAt, t: pre > 0 ? 1 - sbcAt / pre : last.t, ts: last.ts, asrc: last.as, oth: rows.some((r) => r.oth && r.pol === 1),
    yGaap, pol: p1 && p0 ? 'mix' : p1 ? 'ex' : p0 ? 'in' : '?', f: null };
  const e1 = (co.est || []).find((e) => e.p === '+1y') || {};
  const fe = co.fe > 0 ? co.fe : e1.eps;
  if (fe != null && isFinite(fe)) {
    // fut — הרווח המותאם מוציא את התגמול גם מעכשיו; chg — ההודעה האחרונה מוציאה, אבל הודיעה שמעכשיו לא (INTU). מוציאה ממילא לא = לא שינוי
    const er = (Array.isArray(co.sbcX) ? co.sbcX : []).slice(-1)[0], fut = er ? !!er[2] : null, chg = !!er && !!er[1] && !er[2];
    const frac = exAt > 0 ? exDed / exAt : fut ? 1 : 0;
    // שיעור התגמול מההכנסות — מאותם סכומים שנוכו (לא Q.sbc המעורב)
    const rate = pre > 0 && c.rev > 0 ? rows.reduce((t, r, j) => t + r.pre * Q.sh[L - 3 + j], 0) / c.rev : null;
    const fs = rate != null ? rate * (e1.rev > 0 ? e1.rev : c.rev) : 0;
    const fd = fut === false ? 0 : frac * fs * (1 - last.t) / Q.sh[L];
    // השנה ומספר האנליסטים — רק כשהרווח של המכפיל הצפוי הוא ממוצע +1y (עד 1%)
    const same = e1.eps != null && Math.abs(fe - e1.eps) <= 0.01 * Math.max(Math.abs(e1.eps), 0.05);
    out.f = { base: fe, ded: fd, eps: fe - fd, end: same ? e1.end || null : null, n: same ? e1.n || null : null, rate, fut, chg, t: last.t };
  }
  return out;
}
const bufEps = (co) => (!co ? null : '_buf' in co ? co._buf : (co._buf = bufCalc(co)));
const bpeOf = (co) => { const b = bufEps(co), px = pxF(co); return b && px && b.eps > 0 ? px / b.eps : null; };
const bfpeOf = (co) => { const b = bufEps(co), px = pxF(co); return b && b.f && px && b.f.eps > 0 ? px / b.f.eps : null; };
// "רווח הרחוב" רחוק מהרווח המדווח — המכפיל הצפוי של Yahoo מחושב על רווח מותאם
const isAdj = (co) => { const b = bufEps(co); return !!b && Math.abs(b.gap) > 0.05 * Math.max(Math.abs(b.st), 0.05); };
// צמיחה שנתית ממוצעת בין שתי שנים: כשבדרך יש שנה שהוצגה מחדש — מכפלת הצמיחות שנה אחר שנה (כל אחת באותו דוח),
// לא הסוף מול ההתחלה (AppLovin: 2025 בלי עסק האפליקציות מול 2020 איתו)
function cagrBetween(co, k, fy, a, b) {
  const n = b - a;
  if (n < 1) return null;
  if (fy.slice(a + 1, b + 1).some((p) => co.C?.A[k]?.[p.i] != null)) {
    let m = 1;
    for (let i = a + 1; i <= b; i++) { const g = growthOf(co, fy[i], k); if (g == null) { m = null; break; } m *= 1 + g; }
    if (m > 0) return Math.pow(m, 1 / n) - 1;
  }
  return cagr(ctx(co, fy[a])[k], ctx(co, fy[b])[k], n);
}
function cagrN(co, k, n) {
  const fy = fyList(co); if (fy.length <= n) n = fy.length - 1;
  if (n < 1) return [null, 0];
  return [cagrBetween(co, k, fy, fy.length - 1 - n, fy.length - 1), n];
}

/* ---------- היסטוריה חודשית של מכפילים (10 שנים) ---------- */
function ttmPoints(co, k) {
  const pts = [], Q = co.Q[k] || [];
  // מספר מניות בסוף שנה — של הרבעון האחרון (קונה מניות חוזרות: הממוצע השנתי גבוה ממה שהיה בסוף השנה)
  const qAt = k === 'sh' ? new Set(co.q.filter((e, j) => Q[j] != null)) : new Set();
  co.fyE.forEach((e, i) => { const v = co.A[k]?.[i]; if (v != null && !qAt.has(e)) pts.push([e, v]); });
  const fyAt = new Set(pts.map((x) => x[0]));
  for (let j = 3; j < co.q.length; j++) {
    if (fyAt.has(co.q[j])) continue; // סוף שנה: המספר השנתי מהדוח, לא סכום רבעונים (רווח למניה לא מצטבר) — ולא שתי נקודות באותו תאריך
    if (co.T && j === co.q.length - 1 && co.T[k] != null) { pts.push([co.q[j], co.T[k]]); continue; }
    if (!SUMQ(k)) { if (Q[j] != null) pts.push([co.q[j], Q[j]]); continue; }
    if (!qRun(co, j - 3, j)) continue;
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
  const out = { t: [], pe: [], pfcf: [], pofcf: [], ps: [], evebit: [], pb: [], pffo: [] };
  if (co.fxMix || !co.px || !co.px.t || !co.px.t.length) return (co._mh = out);
  const P = {}; for (const k of ['eps', 'rev', 'ocf', 'capex', 'sbc', 'op', 'sh', 'cash', 'msec', 'debt', 'eq', 'ni', 'dep']) P[k] = ttmPoints(co, k);
  const last = co.px.t[co.px.t.length - 1], first = addMonths(last, -120);
  co.px.t.forEach((ym, i) => {
    const c = co.px.c[i]; if (ym < first || c == null) return;
    const eps = atMonth(P.eps, ym), sh = atMonth(P.sh, ym), rev = atMonth(P.rev, ym), ocf = atMonth(P.ocf, ym), cx = atMonth(P.capex, ym), op = atMonth(P.op, ym);
    const cash = (atMonth(P.cash, ym) || 0) + (atMonth(P.msec, ym) || 0), debt = atMonth(P.debt, ym) || 0;
    const mc = sh ? c * sh : null, fcf = ocf != null && cx != null ? ocf - cx : null;
    out.t.push(ym);
    out.pe.push(eps > 0 ? c / eps : null);
    out.pfcf.push(mc && fcf > 0 ? mc / fcf : null);
    // תזרים לבעלים = תזרים חופשי פחות התשלום במניות (המחשבון); בלי נתון תשלום במניות — אפס
    const ofcf = fcf != null ? fcf - (atMonth(P.sbc, ym) || 0) : null;
    out.pofcf.push(mc && ofcf > 0 ? mc / ofcf : null);
    out.ps.push(mc && rev > 0 ? mc / rev : null);
    out.evebit.push(mc && op > 0 ? (mc + debt - cash) / op : null);
    const eq = atMonth(P.eq, ym), ni = atMonth(P.ni, ym), dep = atMonth(P.dep, ym), ffo = ni != null && dep != null ? ni + dep : null;
    out.pb.push(mc && eq > 0 ? mc / eq : null);
    out.pffo.push(mc && ffo > 0 ? mc / ffo : null);
  });
  // הנקודה האחרונה = היום: המחיר החי ו־12 החודשים האחרונים (כמו בראש המסך)
  const c = ctx(co, nowP(co)), mc = co.price * co.sharesOut, i = out.t.length - 1;
  if (i >= 0 && co.price > 0) {
    out.pe[i] = c.eps > 0 ? co.price / c.eps : null; out.pfcf[i] = c.fcf > 0 && mc ? mc / c.fcf : null; out.pofcf[i] = c.fcfsbc > 0 && mc ? mc / c.fcfsbc : null; out.ps[i] = c.rev > 0 && mc ? mc / c.rev : null;
    out.evebit[i] = c.op > 0 && mc ? (mc + c.debt - (c.cashT || 0)) / c.op : null;
    out.pb[i] = c.eq > 0 && mc ? mc / c.eq : null; out.pffo[i] = c.ffo > 0 && mc ? mc / c.ffo : null;
  }
  return (co._mh = out);
}

/* ---------- הערכת שווי אוטומטית ---------- */
const DEF_RF = 0.042, DEF_ERP = 0.042;
/* שיעור ההיוון: הרף של באפט ומנגר — לפחות 10% בשנה (מה שאפשר לקבל במדד לאורך זמן). CAPM מוצג לידו לעיון,
   וכשהוא גבוה יותר (בטא גבוהה, סיכון מדינה) — הוא גובר */
const HURDLE = 0.10;
const hurdleKe = (capm, src) => (capm > HURDLE ? [capm, src] : [HURDLE, T('anSrcKeHurdle', { c: strip(pct(capm, 2)) })]);
function autoInputs(co, mac) {
  mac = mac || {}; co = real(co);   // ההנחות (ומחיר ההון) לא תלויות במחיר לבדיקה
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
  const mcap = (pxF(co) || 0) * (co.sharesOut || 0), t = il ? (mac.taxIL || 0.23) : 0.25;
  const bu = ind.bu ?? 1, bl = clamp(mcap > 0 ? bu * (1 + (1 - t) * (c.debt || 0) / mcap) : bu, 0.8, 2);
  const rf = il ? (mac.rfIL || 0.0407) : (mac.rf || DEF_RF), erp = mac.erp || DEF_ERP, crp = il ? (mac.crpIL || 0) : 0;
  val.capm = rf + bl * erp + crp;
  [val.ke, src.ke] = hurdleKe(val.capm, il ? T('anSrcKeIL', { rf: strip(pct(rf, 2)), b: bl.toFixed(2), erp: strip(pct(erp, 1)), crp: strip(pct(crp, 2)) })
    : T('anSrcKe', { rf: strip(pct(rf, 2)), b: bl.toFixed(2), erp: strip(pct(erp, 1)) }));
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
  if (!(eps0 > 0) || !(inp.peMid > 0) || !(pxF(co) > 0)) return null;
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
  const cNow = ctx(co, nowP(co)), dy = cNow.dps ? cNow.dps / pxF(co) : 0;
  return { eps5, pe, tgt, yrs, ret: tgt > 0 ? (tgt / pxF(co)) ** (1 / yrs) - 1 + dy : null, year: fy0 + H };
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
  val.capm = rf + b * erp + crp;
  [val.ke, src.ke] = hurdleKe(val.capm, T(il ? 'anSrcKeFinIL' : 'anSrcKeFin', { rf: strip(pct(rf, 2)), b: b.toFixed(2), erp: strip(pct(erp, 1)), crp: strip(pct(crp, 2)) }));
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
    pay: ffops && c.dps ? c.dps / ffops : null, g, nf, now: ffops && pxF(co) ? pxF(co) / ffops : null };
}

/* --- השווי לפי סוג החברה: DCF / עודף תשואה / FFO — אותם שלושה תרחישים בכל המסכים --- */
function fairOf(co, mac) {
  co = real(co);
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
  const f = c.fcf ?? c.ocf, m = c.om, r40 = r40Of(co, nowP(co));
  const burn = f != null && f < 0 ? -f : null, runway = burn && c.cashT != null ? c.cashT / burn : null;
  return { psNow: fin(H.ps).pop() ?? null, psMed: ps.length >= 12 ? median(ps) : null, years: Math.round(ps.length / 12), g, m, r40, burn, cash: c.cashT, runway };
}

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
  const mcap = pxF(co) && co.sharesOut ? pxF(co) * co.sharesOut : null, ev = mcap ? mcap + c.debt - (c.cashT || 0) : null;
  const pe = c.eps > 0 && pxF(co) ? pxF(co) / c.eps : null, pfcf = c.fcf > 0 && mcap ? mcap / c.fcf : null;
  const peMed = median(H.pe.filter((x) => x > 0 && x < 150)), pfMed = median(H.pfcf.filter((x) => x > 0 && x < 300));
  const ey = c.op > 0 && ev > 0 ? c.op / ev : null;
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
  const X = (q, v, thr, pass, ex, d) => ({ q, v, thr, pass, ex, d: !!d });   // d = מחושב מול המחיר
  return {
    value: { n: T('anGValue'), chk: [
      X(T('anCv1'), fmt(pe, 'x', co, 1), T('anCv1t', { v: strip(fmt(peMed, 'x', co, 1)) }), pe && peMed ? pe < peMed : null, T('anCv1x'), 1),
      X(T('anCv2'), fmt(pfcf, 'x', co, 1), T('anCv2t', { v: strip(fmt(pfMed, 'x', co, 1)) }), pfcf && pfMed ? pfcf < pfMed : null, T('anCv2x'), 1),
      X(T('anCv3'), pct(ey), T('anCv3t', { v: strip(pct(I.rf, 2)) }), ey != null ? ey > I.rf : null, T('anCv3x'), 1),
      X(T('anCv5'), peg ? iso(peg.toFixed(2)) : '—', T('anCv5t'), peg ? peg < 1.5 : null, T('anCv5x'), 1),
      X(T('anCv6'), fmt(fpe, 'x', co, 1), iname + ' ' + strip(fmt(ind.fpe, 'x', co, 1)), fpe && ind.fpe ? fpe < ind.fpe : null, T('anCv6x'), 1),
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
  /* 27/10/2026 (בקשת המשתמש — צילום מסך): הבועה צפה בשורה של ההסבר, מעל הגרף — אף פעם לא על העמודות.
     כמו קודם היא מופיעה רק בנגיעה בעמודה; המקום שלה שמור בשורה (tipBox), כך שהופעתה לא מזיזה כלום */
  const show = (i) => {
    if (i < 0 || i >= n || !tip) return;
    hl.setAttribute('x', x0 + i * band); hl.setAttribute('opacity', 1);
    tip.textContent = '';
    tip.append(h('div', { class: 'an-tip-h' }, (opt.tipLabels || opt.labels)[i]));
    // כמה סדרות: נקודה בצבע + הערך בשורה לכל סדרה — השמות כבר בשבבים שלצד הבועה (שמות מלאים לא נכנסים ברוחב שלה)
    if (k > 1) tip.append(h('div', { class: 'an-tip-g' }, ...opt.series.map((s) => h('div', { class: 'an-tip-c' }, h('i', { style: `background:${s.color}` }), h('b', {}, fmt(s.vals[i], opt.unit, opt.co))))));
    else tip.append(h('div', { class: 'an-tip-v' }, fmt(opt.series[0].vals[i], opt.unit, opt.co)));   // סדרה אחת — השם בכותרת העמוד, ושם מקוצר בבועה רק הפריע
    if (tip.hidden && typeof tip.animate === 'function' && !(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches))
      tip.animate([{ opacity: 0, transform: 'translateY(4px) scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 180, easing: 'cubic-bezier(.2, .9, .25, 1)' });
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
  // נגיעה בכל מקום מחוץ לגרף סוגרת את הבועה
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
let GID = 0;
function spark(host, vals, color, line, opt = {}) {
  const W = opt.w || 112, H = opt.h || 44, v = vals.map((x) => (x == null || !isFinite(x) ? null : x)), ok = fin(v);
  host.textContent = ''; if (!ok.length) return;
  const svg = sv('svg', { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none', 'aria-hidden': 'true' }, host);
  const lo = line ? Math.min(...ok) : Math.min(0, ...ok), hi = line ? Math.max(...ok) : Math.max(0, ...ok), span = hi - lo || 1;
  const pad = line ? 4 : 2, y = (x) => pad + (hi - x) / span * (H - pad * 2), n = v.length, band = W / n;
  if (line) {
    const ex = opt.px ?? 3, pts = []; v.forEach((x, i) => { if (x != null) pts.push([n > 1 ? i * (W - ex * 2) / (n - 1) + ex : W / 2, y(x)]); });
    const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('');
    const id = 'anG' + (++GID), g = sv('linearGradient', { id, x1: 0, y1: 0, x2: 0, y2: 1 }, sv('defs', {}, svg));
    sv('stop', { offset: 0, 'stop-color': color, 'stop-opacity': 0.28 }, g); sv('stop', { offset: 1, 'stop-color': color, 'stop-opacity': 0 }, g);
    const L = pts[pts.length - 1];
    sv('path', { d: d + `L${L[0].toFixed(1)},${H}L${pts[0][0].toFixed(1)},${H}Z`, fill: `url(#${id})`, class: 'an-area' }, svg);
    sv('path', { d, fill: 'none', stroke: color, 'stroke-width': opt.sw || 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'vector-effect': 'non-scaling-stroke', pathLength: 1, class: 'an-draw' }, svg);
    if (!opt.noDot) { const dot = h('i', { class: 'an-dot', style: `left:${(L[0] / W * 100).toFixed(1)}%;top:${(L[1] / H * 100).toFixed(1)}%;background:${color};--an-dc:${color}` }); host.append(dot); }
    if (opt.peak) { const P = pts.reduce((m, q) => (q[1] < m[1] ? q : m), pts[0]);   // השיא = ה־y הנמוך ביותר
      if (P !== L) host.append(h('span', { class: 'an-ptag', style: `left:${(P[0] / W * 100).toFixed(1)}%;top:${(P[1] / H * 100).toFixed(1)}%` }, opt.peak)); }
    if (opt.trough) { const B = pts.reduce((m, q) => (q[1] > m[1] ? q : m), pts[0]);   // השפל = ה־y הגבוה ביותר, התווית מתחת לנקודה
      if (B !== L && B !== pts.reduce((m, q) => (q[1] < m[1] ? q : m), pts[0])) { host.classList.add('an-pxc-lo'); host.append(h('span', { class: 'an-ptag an-ptag-lo', style: `left:${(B[0] / W * 100).toFixed(1)}%;top:${(B[1] / H * 100).toFixed(1)}%` }, opt.trough)); } }
    sparkAxis(host, opt, L[0] / W, L[1] / H);
    return;
  }
  const bw = band * 0.62;
  let last = null, first = null;
  v.forEach((x, i) => { if (x == null) return; const y1 = y(Math.max(x, 0)), y2 = y(Math.min(x, 0)); last = [i * band + band / 2, y1]; if (!first) first = last; sv('rect', { x: i * band + (band - bw) / 2, y: y1, width: bw, height: Math.max(1.5, y2 - y1), rx: Math.min(3, bw / 2), fill: color, opacity: i === n - 1 ? 1 : 0.4, class: 'an-bar', style: `--an-bi:${i}` }, svg); });
  if (first && opt.tag0 && first !== last) host.append(h('span', { class: 'an-vtag an-vtag0', style: `left:${(first[0] / W * 100).toFixed(1)}%;top:${(first[1] / H * 100).toFixed(1)}%` }, opt.tag0));
  if (last) sparkAxis(host, opt, last[0] / W, last[1] / H);
}
/* מתחת לגרף: השנה הראשונה והאחרונה; מעל הנקודה האחרונה — הערך שלה */
function sparkAxis(host, opt, fx, fy) {
  if (opt.tag) host.append(h('span', { class: 'an-vtag', style: `left:${(fx * 100).toFixed(1)}%;top:${(fy * 100).toFixed(1)}%` }, opt.tag));
  if (opt.labels) {
    const nx = host.nextElementSibling; if (nx && nx.classList.contains('an-axis')) nx.remove();
    host.after(h('div', { class: 'an-axis' }, h('span', {}, opt.labels[0]), h('span', {}, opt.labels[1])));
  }
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
  r40: { n: 'anMR40', u: 'pct', c: 'c3', ratio: 1, q: 'anQR40', f: r40Of },
  cashT: { n: 'anMCash', u: 'money', c: 'c1', noPct: 1 }, debt: { n: 'anMDebt', u: 'money', c: 'c4', noPct: 1 },
  eq: { n: 'anMEq', u: 'money', c: 'c1', noPct: 1, q: 'anQEq' },
  ta: { n: 'anMTa', u: 'money', c: 'c1', noPct: 1 }, tl: { n: 'anMTl', u: 'money', c: 'c4', noPct: 1 },
  cr: { n: 'anMCr', u: 'num', c: 'c1', ratio: 1, q: 'anQCr' },
  de: { n: 'anMDe', u: 'num', c: 'c4', ratio: 1, q: 'anQDe' },
  ocf: { n: 'anMOcf', u: 'money', c: 'c1', g: 1 },
  fcf: { n: 'anMFcf', u: 'money', c: 'c2', q: 'anQFcf', g: 1 },
  fcfsbc: { n: 'anMOwn', u: 'money', c: 'c5', q: 'anQOwn', g: 1 },
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
  cf: [['cfb', 'anRCfb', ['ocf', 'fcf', 'fcfsbc', 'sbcN', 'capexN']], ['fcf'], ['fcfsbc'], ['ocfni', 'anROcfNi', ['ocf', 'ni']], ['buy'], ['dps']],
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
    if (st.view === 'g') { const b = M[k].f ? null : ctx(co, p, 1, true)[k]; return v != null && b != null && b > 0 ? v / b - 1 : null; }
    if (st.view === 'r') { const r = ctx(co, p).rev; return v != null && r ? v / r : null; }
    return v;
  }) }));
  const unit = st.view !== 'v' ? 'pct' : M[def.s[0]].u;
  const tipLabels = per.map((p) => (p.kind === 'ttm' ? T('anTtm') : p.kind === 'q' ? T('anQuarterOf', qOf(p.end)) : T('anYearOf', { y: p.label })));
  return { per, series, unit, labels: per.map((p) => p.label), tipLabels };
}
const rowHint = (def) => (def.line ? T(def.line[3]) : def.s.length === 1 && M[def.s[0]].q ? T(M[def.s[0]].q) : '');
function rowSummary(co, def) {
  if (def.line) {
    const a = multHist(co)[def.line[1]], now = fin(a).pop(), md = multAvg(a);
    return { v: fmt(now, 'x', co, 1), s: md ? T(now > md ? 'anMedAbove' : 'anMedBelow', { v: strip(fmt(md, 'x', co, 1)) }) : '' };
  }
  const k = def.s[0], m = M[k], per = periodList(co, 'fy'), last = mval(co, k, per[per.length - 1]);
  if (def.s.length > 1) return { v: '', s: def.s.map((x) => T(M[x].n)).join(' · ') };
  if (m.ratio) { const a = mean(fyList(co).slice(-5).map((p) => mval(co, k, p))); return { v: fmt(last, m.u, co), s: a != null ? T('anAvg5v', { v: fmt(a, m.u, co) }) : '' }; }
  const [g, n] = cagrN(co, k, 5);
  return { v: fmt(last, m.u, co), s: g != null ? T('anCagrRow', { n, v: sgn(g) }) : '' };
}

/* ---------- המסך ---------- */
const S = { co: null, mac: null, sym: '', tab: 'snap', rsub: 'is', ed: {}, px: null, reqEd: null, pxHook: null, open: null, err: null, modal: null, sheet: null, after: [], seq: 0, peers: null, peerBusy: false, peerAdd: [], peerDrop: new Set() };
const CACHE = new Map();   // בזיכרון בלבד, לכל ריצה (השרתון שומר במטמון 12 שעות)
let MAC = null;
const TABS = ['snap', 'rep', 'val', 'cmp'];
const TAB_T = { snap: 'anTabSnap', rep: 'anTabRep', val: 'anTabVal', cmp: 'anTabCmp' };

const PEND = new Map();   // בקשה שכבר בדרך (טעינה מראש מכרטיס המניה) — לא שולחים שוב
function load(sym, force) {
  if (!force && CACHE.has(sym)) return Promise.resolve(CACHE.get(sym));
  if (!force && PEND.has(sym)) return PEND.get(sym);
  const p = load0(sym, force).finally(() => PEND.delete(sym));
  PEND.set(sym, p);
  return p;
}
async function load0(sym, force) {
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
  S.first = true; S.heroDone = false; S.hero = null; S.segX = null; S.sub = []; S.tabRec = null; S.seen = new Set();
  S.sym = sym; S.tab = 'snap'; S.rsub = 'is'; S.ed = {}; S.cv = {}; S.px = null; S.reqEd = null; S.pxHook = null; S.calcB = null; S.open = null; S.err = null; S.co = null; S.peers = null; S.peerBusy = false; S.peerAdd = []; S.peerDrop = new Set(); const seq = ++S.seq;
  ROOT = h('div', { class: 'an-root no-swipe', role: 'dialog', 'aria-modal': 'true', 'aria-label': T('anTitle') });
  document.addEventListener('keydown', onEsc, true);
  document.body.appendChild(ROOT);
  wireSwipe();
  document.documentElement.classList.add('an-open');
  S.modal = E.modalPush ? E.modalPush(() => closeAnalysis(true)) : null;
  // נטען מראש (כרטיס המניה נפתח) — המסך המלא כבר בציור הראשון, בלי שלד
  const ready = (d) => { S.co = indFix(prep(d, E.quote && E.quote(sym), E.fx && E.fx()), MAC); peersSoon(seq); };
  if (CACHE.has(sym)) { ready(CACHE.get(sym)); render(); return; }
  render();
  load(sym).then((d) => { if (seq !== S.seq) return; ready(d); render(); })
    .catch((e) => { if (seq !== S.seq) return; S.err = e.code || 'fail'; render(); });
}
/* העמיתים (לשונית "השוואה") נטענים ברקע מיד כשהמסך מוכן — כשעוברים ללשונית הנתונים כבר שם, בלי שלד */
function peersSoon(seq) {
  const go = () => { if (seq === S.seq && !S.peers) loadPeers(); };
  if (typeof requestIdleCallback === 'function') requestIdleCallback(go, { timeout: 1500 }); else setTimeout(go, 400);
}
/* טעינה מראש מכרטיס המניה (app.js): הנתונים מגיעים לפני הלחיצה על "ניתוח" — אותה בקשה, בלי כפילות */
export function prefetchAnalysis(sym, env) {
  E = env || E;
  ensureCss();
  load(sym).catch(() => {});
}
function onEsc(e) {
  if (e.key !== 'Escape' || !ROOT) return;
  e.stopPropagation(); e.preventDefault();
  if (S.sheet) closeSheet(); else if (S.sub.length) popSub(); else if (S.tab !== 'snap') go('snap'); else closeAnalysis();
}
/* "חזור" (26/10/2026, בקשת המשתמש — "חזור" יצא מכל לשונית ישר ל־Invest): כל רמה = רשומה בהיסטוריה —
   המסך, לשונית שאינה "תמונה" (אחת לכל הלשוניות — "חזור" מהן = "תמונה"), כל תת־עמוד וגיליון. */
function tabLevel() {
  if (S.tab !== 'snap' && !S.tabRec) S.tabRec = E.modalPush ? E.modalPush(() => tabPop()) || true : true;
  else if (S.tab === 'snap' && S.tabRec) { const r = S.tabRec; S.tabRec = null; if (r !== true && E.modalDone) E.modalDone(r); }
}
function tabPop() {
  S.tabRec = null;
  if (ROOT && S.co && S.tab !== 'snap') navTab('snap');
}
/* סגירה של כמה רמות בבת אחת (סגירת המסך): כל הרשומות יוצאות ב"חזור" אחד של כמה צעדים — modalDone לכל אחת
   בנפרד מחזיר רק את העליונה (בודק את הרשומה הנוכחית, וה"חזור" הקודם עוד לא נחת) ומשאיר רשומות יתומות */
function unwind(recs) {
  let n = 0;
  for (const r of recs) {
    if (!r || r === true || r.done) continue;
    if (r.pushed) n++;
    r.popping = true;
    if (E.modalDone) E.modalDone(r);
  }
  if (n && E.back) E.back(n);
  else if (n) { try { history.go(-n); } catch (e) {} }
}
function closeAnalysis(fromPop) {
  if (!ROOT) return;
  document.removeEventListener('keydown', onEsc, true);
  const sh = S.sheet;
  if (sh) closeSheet(true);
  const recs = [sh && sh.modal, ...S.sub.map((x) => x.modal).reverse(), S.tabRec, S.modal];
  S.sub = []; S.tabRec = null;
  S.px = null; S.reqEd = null; S.pxHook = null;   // מחיר לבדיקה — כל יציאה מהניתוח חוזרת לנתונים האמיתיים
  const r = ROOT; ROOT = null; S.seq++;
  document.documentElement.classList.remove('an-open');
  S.modal = null;
  if (!fromPop) unwind(recs);
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
  S.after = []; S.pxHook = null;
  if (S.co && S.px && S.px.k === 'ret') setPx(S.co, retPx(S.co));   // המחיר לפי התשואה הרצויה — לפני הציור (הסרגל והראש מציגים אותו)
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
  // עמוד שכבר הוצג — בלי אנימציות הכניסה (גרפים שמצטיירים, עמודות שגדלות): חוזרים אליו והוא פשוט שם
  const key = S.sub.length ? 'sub:' + S.sub[S.sub.length - 1].title : S.tab + ':' + S.rsub;
  // 27/10/2026 (בקשת המשתמש — "רענונים" במעבר בין העמודים): תנועת כניסה רק בעמוד הראשון שנפתח. כל עמוד אחר
  // (לשונית, תת־לשונית, תת־עמוד של מדד) מופיע כבר גמור — עמודה שגדלה וקו שמצטייר נראים כמו טעינה
  ROOT.classList.toggle('an-still', S.seen.size > 0);
  S.seen.add(key);
  if (S.sub.length) { renderSub(co); return; }
  const wrap = h('div', { class: 'an-wrap' });
  wrap.append(header(co), tabsBar());
  const pg = h('div', { class: 'an-page' + (dir ? ' in' : ''), style: dir ? `--an-dx:${dir * 24}px` : null });
  ({ snap: pageSnap, rep: pageRep, val: pageVal, cmp: pageCmp })[S.tab](co, pg);
  wrap.append(pg);
  ROOT.append(wrap);
  if (dir || S.first) { [...pg.children].forEach((el, i) => { el.classList.add('an-rise'); el.style.setProperty('--an-i', i); }); S.first = false; }
  if (!dir) ROOT.scrollTop = y;
  flushAfter();
}
/* 27/10/2026 (סרטון המשתמש): הגרפים מצוירים מיד אחרי הבנייה, באותו פריים — עד היום בפריים הבא, וכל מעבר
   (לשונית, תת־לשונית, חזרה) הראה לרגע כרטיסים בלי גרפים. המידות כבר ידועות: השכבה בדף */
function flushAfter() {
  const a = S.after; S.after = [];
  a.forEach((f) => f());
  settle();
}
/* 27/10/2026 (סרטון המשתמש — "רענונים" בגלילה): אנימציות הכניסה רק למה שעל המסך ברגע הציור. כרטיס מתחת למסך —
   בלי (Chrome באנדרואיד מריץ את האנימציות שלו רק כשהוא נגלל פנימה, והגרף "נבנה" מחדש מול העיניים בכל גלילה),
   ואחרי ~2 שניות העמוד כולו נעצר במצב הסופי (an-still) — גם אנימציה שנתקעה באמצע בזמן גלילה */
let settleT = 0;
function settle() {
  clearTimeout(settleT);
  const r = ROOT;
  if (!r || r.classList.contains('an-still')) return;
  const go = () => {
    if (ROOT !== r) return;
    const vb = r.getBoundingClientRect().bottom;
    r.querySelectorAll('.an-card, .an-rcard').forEach((c) => { if (c.getBoundingClientRect().top >= vb) c.classList.add('an-still'); });
  };
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(go); else go();
  settleT = setTimeout(() => { if (ROOT === r) r.classList.add('an-still'); }, 2200);
}
/* תת־עמוד: כותרת גדולה וכרטיס אחד. נבנה מחדש בכל ציור (כמו לשונית) — build(body, rec), rec.draw אחרי הציור */
function renderSub(co) {
  const s = S.sub[S.sub.length - 1], rec = { draw: null };
  const body = h('div', { class: 'an-sh-b an-subb' });
  s.build(body, rec);
  ROOT.append(h('div', { class: 'an-wrap an-subw' }, h('h1', { class: 'an-h1', dir: 'auto' }, s.title), edRow(co), body.childElementCount && !s.bare ? h('section', { class: 'an-card' }, body) : body, footer(co)));
  if (rec.draw) S.after.push(() => rec.draw());
  flushAfter();
}
/* מעבר בין עמודים בקובייה (המנוע של האפליקציה — env.cube). mutate משנה את המצב; y = הגלילה בעמוד החדש */
/* 28/10/2026: גלילה של ניווט (מאחורי רוח הקובייה, באותו פריים של הציור) מסומנת data-nav-scroll — כמו בספרייה (v325),
   כדי שכלי המעברים לא יספור אותה כקפיצה */
function navY(v) {
  if (!ROOT) return;
  ROOT.dataset.navScroll = '1'; ROOT.scrollTop = v;
  const r = ROOT; requestAnimationFrame(() => requestAnimationFrame(() => { delete r.dataset.navScroll; }));
}
function navTo(fwd, mutate, y, hold) {
  if (!ROOT) return;
  const C = E.cube, cube = C && C.clone && C.run && !(C.reduce && C.reduce());
  // 29/10/2026 (סבב קפיצות 4): ההעתק נצבע שני פריימים לפני הציור החדש (cubePre) — אחרת פריים שחור בכל לחיצה בטלפון.
  // המצב משתנה מיד (הקוראים — tabLevel — קוראים אותו מיד אחרי), ורק הציור מחכה
  if (cube && C.pre) { C.pre(ROOT, (ghost) => { if (ROOT) navGo(fwd, y, hold, ghost); else ghost.remove(); }); mutate(); return; }
  const ghost = cube ? C.clone(ROOT) : null;
  mutate();
  navGo(fwd, y, hold, ghost);
}
function navGo(fwd, y, hold, ghost) {
  const C = E.cube, cube = !!ghost;
  render(cube ? 0 : (fwd ? -1 : 1));
  if (ROOT) navY(typeof y === 'function' ? y() : y || 0);
  // הרצועה הקבועה היא העתק של העמוד החדש ברגע הזה — הגרף בראש (שמצויר בפריים הבא) חייב להיות בה כבר עכשיו
  if (ghost && hold) flushAfter();
  if (ghost) C.run(ROOT, ghost, C.side(fwd), hold ? { y: hold.y(), on: hold.on } : undefined);
}
/* מעבר בין הלשוניות: הראש והלשוניות זהים בכל הלשוניות — הם נשארים במקום (רצועה קבועה של המנוע, cubeHold),
   ורק מה שמתחתם מסתובב. הגלילה נשמרת עד הנקודה שבה הלשוניות נדבקות למעלה — בלי קפיצה של הראש */
function stickY() {
  const s0 = ROOT && ROOT.querySelector('.an-seg-main'), seg = s0 && (s0.closest('.an-tabbar') || s0);   // הדביק = הרצועה
  if (!seg) return 0;
  const prev = seg.previousElementSibling;   // הראש (לא דביק) — המקום הטבעי של הלשוניות בלי השפעת ההדבקה
  // לפי המיקום על המסך ולא offsetTop (שתלוי באיזה אב "ממוקם" — לא בהכרח השכבה)
  const nat = prev ? ROOT.scrollTop + prev.getBoundingClientRect().bottom - ROOT.getBoundingClientRect().top + (parseFloat(getComputedStyle(seg.parentElement).rowGap) || 0) : seg.offsetTop;
  return Math.max(0, nat - (parseFloat(getComputedStyle(seg).top) || 0));
}
function holdY() {
  const s0 = ROOT && ROOT.querySelector('.an-seg-main'), seg = s0 && (s0.closest('.an-tabbar') || s0);
  if (!seg) return 0;
  const b = seg.getBoundingClientRect();
  return b.bottom > 0 && b.bottom < innerHeight * 0.7 ? b.bottom : 0;
}
/* הסימון בלשוניות שברצועה הקבועה — זז עם האצבע, ובסוף משלים את התנועה (או חוזר בביטול) */
function holdOn(from, to) {
  return (el, p) => {
    const seg = el.querySelector('.an-seg-main'), th = seg && seg.querySelector('.an-seg-th');
    if (!th) return;
    const bs = [...seg.querySelectorAll('button')], a = bs[TABS.indexOf(from)], b = bs[TABS.indexOf(to)];
    if (!a || !b) return;
    const at = (q) => [a.offsetLeft + (b.offsetLeft - a.offsetLeft) * q, a.offsetWidth + (b.offsetWidth - a.offsetWidth) * q];
    const mark = (k) => bs.forEach((x, i) => { const on = TABS[i] === k; x.setAttribute('aria-pressed', String(on)); x.setAttribute('aria-selected', String(on)); });
    if (p === 'commit' || p === 'cancel') {
      const q = p === 'commit' ? 1 : 0, cur = th.style.transform, cw = th.style.width, [x, w] = at(q);
      th.style.transform = `translateX(${x}px)`; th.style.width = w + 'px';
      // גם הרוחב בתנועה — רוחב שקפץ ליעד בזמן שהמיקום עוד זז נראה כגלולה שנמתחת על שתי לשוניות
      const an = cur && typeof th.animate === 'function' ? th.animate([{ transform: cur, width: cw || w + 'px' }, { transform: `translateX(${x}px)`, width: w + 'px' }], { duration: 380, easing: 'cubic-bezier(.3, 1.3, .5, 1)' }) : null;
      const k = p === 'commit' ? to : from;
      if (!an) { mark(k); return; }
      // הצבע של התווית מתחלף כשהגלולה כבר מתחתיה — בצבע של הנבחרת על רקע הבורר (בעיקר בכהה) היא נעלמת עד שהגלולה מגיעה
      // לפי המקום של הגלולה עצמה (לא שעון): כשהיא עברה את חצי הדרך — היא כבר מתחת לתווית, גם כשהפריימים מתעכבים
      const x0 = new DOMMatrix(cur).m41, half = (x0 + x) / 2;
      const tick = () => {
        let xn = x; try { xn = new DOMMatrix(getComputedStyle(th).transform).m41; } catch (e) {}
        if ((x > x0 ? xn >= half : xn <= half) || an.playState === 'finished' || !el.isConnected) mark(k); else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      return;
    }
    const [x, w] = at(p);
    th.style.transform = `translateX(${x}px)`; th.style.width = w + 'px';
    mark(p > 0.5 ? to : from);
  };
}
function navTab(k) {
  if (!ROOT || k === S.tab) return;
  const from = S.tab, y = Math.min(ROOT.scrollTop, stickY());
  // הרצועה הקבועה מציגה את הסימון מהלשונית הקודמת וזזה ממנה; הלשוניות בעמוד עצמו כבר במקום (מוסתרות מתחת לרצועה)
  navTo(TABS.indexOf(k) > TABS.indexOf(from), () => { S.tab = k; S.segX = null; }, y, { y: holdY, on: (el, p) => { if (p === 0) holdOn(from, k)(el, 0); else if (p === 'commit') holdOn(from, k)(el, 'commit'); } });
  tabLevel();
}
function pushSub(title, build, opt = {}) {
  const rec = { title, build, bare: !!opt.bare, y: ROOT ? ROOT.scrollTop : 0, modal: null };
  rec.modal = E.modalPush ? E.modalPush(() => popSub(true)) : null;
  navTo(true, () => S.sub.push(rec), 0);
}
function popSub(fromPop) {
  if (!S.sub.length) return;
  const rec = S.sub[S.sub.length - 1];
  if (!fromPop && rec.modal && E.modalDone) E.modalDone(rec.modal);
  navTo(false, () => S.sub.pop(), rec.y);
}
/* החלקה: בין הלשוניות (קובייה), ובתת־עמוד — אחורה = חזרה */
function wireSwipe() {
  if (!E.cube || !E.cube.swipe) return;
  E.cube.swipe({ root: ROOT, ok: () => !!S.co && !S.sheet, page: (next) => {
    if (S.sub.length) {
      if (next) return null;
      let rec = null, y = 0;
      return { render: () => { rec = S.sub.pop(); y = rec.y; render(); navY(y); }, undo: () => { S.sub.push(rec); render(); navY(0); },
        commit: () => { if (rec.modal && E.modalDone) E.modalDone(rec.modal); } };
    }
    const i = TABS.indexOf(S.tab), j = i + (next ? 1 : -1);
    if (j < 0 || j >= TABS.length) return null;
    const prev = S.tab, to = TABS[j], y = ROOT.scrollTop, y1 = Math.min(y, stickY());
    return { render: () => { S.tab = to; S.segX = null; render(); navY(y1); }, undo: () => { S.tab = prev; S.segX = null; render(); navY(y); },
      hold: holdY, holdOn: holdOn(prev, to), commit: () => tabLevel() };
  } });
}
/* ---------- מחיר לבדיקה: הסימון, השורה "מה שונה", הגיליון והחזרה ---------- */
/* data-dep: ערך שנגזר מהמחיר הערוך — נקודה כתומה קטנה לידו; 'ed' — הנתון שהמשתמש ערך בעצמו (כתום מודגש, בלי נקודה) */
const DEP = (k) => (S.co && S.co.pxEd ? (k && S.px && S.px.k === 'm' && S.px.key === k ? 'ed' : '') : null);
const PX_FACT = new Set(['mcap', 'pe', 'fpe', 'bpe', 'bfpe', 'fy']), PX_CMP = new Set(['fy', 'pe', 'fpe', 'bpe', 'bfpe']);
/* המחיר שנותן את התשואה השנתית הרצויה בתרחיש הבסיס של המחשבון (null — אין מחיר כזה, למשל רווח שלילי) */
function retPx(co) {
  if (!co || S.reqEd == null || co.fxMix) return null;
  const D = calcDefaults(co, S.calcB), v = { ...D.val, ...((S.cv && S.cv[D.basis]) || {}), req: S.reqEd };
  const p = calcRun(v, D.shares, 1)[1].buy;
  return p > 0 && isFinite(p) ? p : null;
}
/* השורה בראש העמוד כשהמחיר נערך: מה שונה, המחיר האמיתי, וכפתור אחד שמחזיר הכל */
function edRow(co) {
  if (!co || !co.pxEd) return null;
  const p = strip(fmt(co.price, 'ps', co)), ret = S.px && S.px.k === 'ret' && S.reqEd != null, m = S.px && S.px.k === 'm' && MED[S.px.key] ? S.px : null;
  return h('div', { class: 'an-edrow', role: 'status' },
    h('span', { class: 'an-edrow-ic', 'aria-hidden': 'true' }, icon('pen')),
    h('div', { class: 'an-edrow-t' }, h('b', {}, m ? T('anMRowT', { n: T(MED_N[m.key]), v: strip(fmtM(co, m.key, m.v)) })
      : ret ? T('anPxRowR', { r: strip(pct(S.reqEd, Math.round(S.reqEd * 1000) % 10 ? 1 : 0)), p }) : T('anPxRowT', { p })),
      h('span', {}, m ? T('anMRowS', { p, r: strip(fmt(co.price0, 'ps', co)) }) : T('anPxRowS', { p: strip(fmt(co.price0, 'ps', co)) }))),
    h('button', { class: 'an-edrow-b', type: 'button', on: { click: pxReset } }, T('anPxBack')));
}
function pxReset() {
  S.px = null; S.reqEd = null;
  if (S.co) setPx(S.co, null);
  render();
}
/* המחיר זז עם המחשבון (תשואה רצויה) בזמן ההקלדה — מעדכנים במקום רק את מה שתלוי בו בעמוד (הסרגל, השורה, המכפילים),
   בלי לבנות את העמוד מחדש: המקלדת והשדה נשארים */
function pxLive(v) {
  const co = S.co; if (!co) return;
  const old = co.price, was = co.pxEd;
  setPx(co, v);
  if (!ROOT || (co.price === old && co.pxEd === was)) return;
  const nav = ROOT.querySelector('.an-nav'); if (nav) nav.replaceWith(navBar());
  const head = ROOT.querySelector('.an-head'), er = head && head.querySelector(':scope > .an-edrow'), nr = edRow(co);
  if (er) { if (nr) er.replaceWith(nr); else er.remove(); } else if (nr && head) head.prepend(nr);
  if (S.pxHook) S.pxHook();
}
function pxSheet() {
  const co = S.co; if (!co || !(co.price > 0) || co.fxMix) return;
  openSheet(T('anPxT'), (b) => {
    const inp = h('input', { class: 'an-in an-pxin', type: 'text', inputmode: 'decimal', autocomplete: 'off', spellcheck: 'false', dir: 'ltr', value: co.price.toFixed(2), 'aria-label': T('anPxT') });
    const msg = h('p', { class: 'an-ex an-err', hidden: true }, T('anPxErr'));
    const form = h('form', { class: 'an-addf an-pxf', on: { submit: (e) => {
      e.preventDefault();
      const v = parseFloat(String(inp.value).replace(/,/g, '').replace(/[^\d.]/g, ''));
      if (!(v > 0) || !isFinite(v)) { msg.hidden = false; return; }
      S.reqEd = null; setPx(S.co, v); S.px = S.co.pxEd ? { k: 'px' } : null;
      closeSheet(); render();
    } } }, h('label', { class: 'an-pxbox' }, h('span', { class: 'an-pxcur', 'aria-hidden': 'true' }, curSym(co.cur)), inp), h('button', { class: 'an-btn', type: 'submit' }, T('anPxApply')));
    b.append(...[h('p', { class: 'an-ex' }, T('anPxEx', { p: strip(fmt(pxReal(co), 'ps', co)) })), form, msg,
      co.pxEd ? h('div', { class: 'an-pxreal' }, h('button', { class: 'an-link', type: 'button', on: { click: () => { closeSheet(); pxReset(); } } }, T('anPxReal', { p: strip(fmt(co.price0, 'ps', co)) }))) : null].filter(Boolean));
    setTimeout(() => { try { inp.focus(); inp.select(); } catch (e) {} }, 60);
  }, { small: true });
}
/* ---------- עריכת נתון שנגזר מהמחיר (18/11/2026): שווי שוק, מכפילים ותשואת מזומן — כל ערך מחזיר מחיר, וממנו מתעדכן כל השאר.
   ההיפוך לפי אותן נוסחאות של התצוגה (factsEl, הנקודה של היום ב־multHist): c = ctx של השנה האחרונה (לא תלוי במחיר), sh = מניות,
   r = הנתונים במחיר האמיתי. null — אין מחיר כזה (למשל רווח שלילי), ואז אין עיפרון ---------- */
const MED = {
  mcap: { u: 'cap', inv: (v, c, sh) => v / sh },
  pe: { u: 'x', inv: (v, c) => (c.eps > 0 ? v * c.eps : null) },
  fpe: { u: 'x', inv: (v, c, sh, r) => (r.fpe > 0 && r.price > 0 ? v * r.price / r.fpe : null) },
  bpe: { u: 'x', inv: (v, c, sh, r) => { const b = bufEps(r); return b && b.eps > 0 ? v * b.eps : null; } },
  bfpe: { u: 'x', inv: (v, c, sh, r) => { const b = bufEps(r); return b && b.f && b.f.eps > 0 ? v * b.f.eps : null; } },
  fy: { u: '%', inv: (v, c, sh) => (c.fcf > 0 ? c.fcf / v / sh : null) },
  pfcf: { u: 'x', inv: (v, c, sh) => (c.fcf > 0 ? v * c.fcf / sh : null) },
  ps: { u: 'x', inv: (v, c, sh) => (c.rev > 0 ? v * c.rev / sh : null) },
  evebit: { u: 'x', inv: (v, c, sh) => (c.op > 0 ? (v * c.op - (c.debt || 0) + (c.cashT || 0)) / sh : null) },
  pb: { u: 'x', inv: (v, c, sh) => (c.eq > 0 ? v * c.eq / sh : null) },
  pffo: { u: 'x', inv: (v, c, sh) => (c.ffo > 0 ? v * c.ffo / sh : null) },
};
const MED_N = { mcap: 'anFMcap', pe: 'anFPe', fpe: 'anFFpe', bpe: 'anFBpe', bfpe: 'anFBfpe', fy: 'anFFy', pfcf: 'anLPfcf', ps: 'anLPs', evebit: 'anLEv', pb: 'anLPb', pffo: 'anLPffo' };
/* הערך של היום — בדיוק כמו במסך */
function metNow(co, key) {
  if (!co || !(co.price > 0) || co.fxMix) return null;
  const c = ctx(co, nowP(co)), mc = co.sharesOut ? co.price * co.sharesOut : null;
  if (key === 'mcap') return mc;
  if (key === 'fpe') return co.fpe > 0 ? co.fpe : null;
  if (key === 'bpe') return bpeOf(co);
  if (key === 'bfpe') return bfpeOf(co);
  if (key === 'fy') return c.fcf != null && mc ? c.fcf / mc : null;
  if (key === 'pe') return c.eps > 0 ? co.price / c.eps : null;
  const a = multHist(co)[key]; return a && a.length ? a[a.length - 1] : null;
}
function pxFrom(co, key, v) {
  const d = MED[key]; if (!d || !co || co.fxMix || !(co.sharesOut > 0) || !(v > 0) || !isFinite(v)) return null;
  const p = d.inv(v, ctx(co, nowP(co)), co.sharesOut, real(co));
  return p > 0 && isFinite(p) ? p : null;
}
const canEdM = (co, key) => { const m = MED[key] && metNow(real(co), key); return m > 0 && !!pxFrom(co, key, m); };
const fmtM = (co, key, v) => (MED[key].u === 'x' ? fmt(v, 'x', co, 1) : MED[key].u === '%' ? pct(v) : fmt(v, 'money', co));
/* שווי שוק נערך באותו סולם שמוצג באריח (T / B / M) */
const medScale = (co) => { const r = metNow(real(co), 'mcap') || 0; return r >= 1e12 ? [1e12, 'T'] : r >= 1e9 ? [1e9, 'B'] : [1e6, 'M']; };
function medTxt(co, key, v) {   // [הטקסט בשדה, לפני, אחרי]
  const u = MED[key].u;
  if (u === 'x') return [v.toFixed(1), '', '×'];
  if (u === '%') return [(v * 100).toFixed(1), '', '%'];
  const [k, s] = medScale(co); return [(v / k).toFixed(2), curSym(co.cur), s];
}
function medVal(co, key, txt) {
  const n = parseFloat(String(txt).replace(/,/g, '').replace(/[^\d.]/g, ''));
  if (!(n > 0) || !isFinite(n)) return null;
  const u = MED[key].u; return u === 'x' ? n : u === '%' ? n / 100 : n * medScale(co)[0];
}
/* קיצורים מההיסטוריה של המכפיל (כמו בכרטיס "מכפילים מול ההיסטוריה", במחיר האמיתי) */
function medHist(co, key) {
  if (!['pe', 'pfcf', 'ps', 'evebit', 'pb', 'pffo'].includes(key)) return null;
  const Hh = multHist(real(co)), a = (Hh[key] || []).filter((x) => x > 0 && x < 300);
  return a.length < 6 ? null : { lo: Math.min(...a), avg: mean(a), hi: Math.max(...a), n: Math.round(Hh.t.length / 12) };
}
const penI = () => h('i', { class: 'an-pen', 'aria-hidden': 'true' }, icon('pen'));
const FSZ = typeof CSS !== 'undefined' && !!CSS.supports && CSS.supports('field-sizing', 'content');
/* טופס העריכה בגיליון: מספר גדול, קיצורים, המחיר שיוצא (חי), "החל", ו"חזרה לנתון האמיתי" כשמשהו ערוך */
function medForm(b, key, rec) {
  const co = S.co; if (!co || !canEdM(co, key)) return;
  if (rec && rec.sh) rec.sh.classList.add('tall');
  const m0 = metNow(real(co), key), mine = S.px && S.px.k === 'm' && S.px.key === key, cur = mine ? S.px.v : metNow(co, key) || m0;
  const [t0, pre, suf] = medTxt(co, key, cur), pr = pxReal(co);
  let pick = { t: t0, v: cur };   // ערך מדויק (קיצור או הערך ההתחלתי) — כדי ש"היום" יחזיר בדיוק למחיר האמיתי
  const inp = h('input', { class: 'an-mfin', type: 'text', inputmode: 'decimal', autocomplete: 'off', spellcheck: 'false', dir: 'ltr', value: t0, 'aria-label': T(MED_N[key]) });
  const box = h('label', { class: 'an-mf' }, pre ? h('i', { 'aria-hidden': 'true' }, pre) : null, inp, h('i', { 'aria-hidden': 'true' }, suf));
  const val = () => (pick && inp.value === pick.t ? pick.v : medVal(co, key, inp.value));
  const H = medHist(co, key), chips = H ? [['anMNow', m0], ['anAvg', H.avg], ['anMLo', H.lo], ['anMHi', H.hi]].map(([s, x]) =>
    [h('button', { class: 'an-mchip', type: 'button', on: { click: () => { const t = medTxt(co, key, x)[0]; inp.value = t; pick = { t, v: x }; upd(); } } }, T(s), h('b', {}, fmtM(co, key, x))), x]) : [];
  const rb = h('b'), rs = h('small'), msg = h('p', { class: 'an-ex an-err', hidden: true }, T('anMErr'));
  function upd() {
    const v = val(), p = v && pxFrom(co, key, v);
    rb.textContent = p ? fmt(p, 'ps', co) : '—';
    rs.textContent = p ? T('anMWas', { r: fmt(pr, 'ps', co), d: iso((p >= pr ? '+' : '') + strip(pct(p / pr - 1))) }) : '';
    box.classList.toggle('ed', !!v && Math.abs(v / m0 - 1) > 1e-6);
    const tv = v ? medTxt(co, key, v)[0] : null;
    for (const [el, x] of chips) el.classList.toggle('on', tv === medTxt(co, key, x)[0]);
    if (!FSZ) inp.style.width = Math.max(1.5, inp.value.length - 0.55 * (inp.value.match(/[.,]/g) || []).length) + 0.3 + 'ch';   // בלי field-sizing — רוחב לפי התוכן
    msg.hidden = true;
  }
  inp.addEventListener('input', () => { if (pick && inp.value !== pick.t) pick = null; upd(); });
  const form = h('form', { class: 'an-mform', on: { submit: (e) => {
    e.preventDefault();
    const v = val(), p = v && pxFrom(co, key, v);
    if (!p) { msg.hidden = false; return; }
    S.reqEd = null; setPx(co, p); S.px = co.pxEd ? { k: 'm', key, v } : null;
    closeSheet(); render();
  } } }, box, chips.length ? h('div', { class: 'an-mchips' }, chips.map((x) => x[0])) : null, H ? h('p', { class: 'an-mcap' }, T('anMYrs', { n: H.n })) : null,
    h('div', { class: 'an-mres' }, h('span', {}, T('anMWill')), h('div', {}, rb, rs)), msg, h('button', { class: 'an-btn', type: 'submit' }, T('anPxApply')));
  b.append(form);
  if (co.pxEd) b.append(h('div', { class: 'an-pxreal' }, h('button', { class: 'an-link', type: 'button', on: { click: () => { closeSheet(); pxReset(); } } }, T('anMReal', { v: fmtM(co, key, m0) }))));
  upd();
}
/* מכפיל מכרטיס ההיסטוריה: מכפיל רווח — אותו גיליון כמו באריח למעלה; השאר — ההסבר הקצר והטופס */
function medSheet(key) {
  if (PX_FACT.has(key)) { factSheet(key); return; }
  openSheet(T(MED_N[key]), (b, rec) => { b.append(h('p', { class: 'an-ex an-ex-lg' }, T(MULT_HINT[key]))); medForm(b, key, rec); }, { small: true });
}
function navBar() {
  const inSub = S.sub && S.sub.length, parent = inSub > 1 ? S.sub[inSub - 2].title : inSub ? T(TAB_T[S.tab]) : T('anBack');
  const back = h('button', { class: 'an-back', type: 'button', 'aria-label': inSub ? parent : T('anClose'), on: { click: () => (inSub ? popSub() : closeAnalysis()) } }, h('span', { class: 'an-chev', 'aria-hidden': 'true' }), h('span', { class: 'an-back-t' }, parent));
  const logo = h('span', { class: 'an-logo' });
  if (E.logoHTML) logo.innerHTML = E.logoHTML(S.sym);
  const nm = S.co ? S.co.name : (E.name && E.name(S.sym)) || S.sym;
  // כמו בכותרת גרף הנרות: לוגו · סימבול ומתחתיו השם (בעמוד משנה — כותרת העמוד במקום השם)
  const sym = String(S.sym || '').replace(/\.TA$/, '');
  // המחיר בשורה העליונה, ליד החזרה — באותו מיקום כמו בגרף הנרות (במסך הראשי בלבד)
  const co = S.co, ed = !!(co && co.pxEd), ch = co && co.prev && !ed ? co.price / co.prev - 1 : null;
  /* מחיר לבדיקה (18/11/2026): עיגול זכוכית עם עיפרון ליד המחיר (נגיעה במחיר עצמו — אותו גיליון). מחיר ערוך — בכתום,
     העיגול מתמלא, ובמקום השינוי היומי — המחיר האמיתי */
  const canEd = !inSub && !!co && co.price > 0 && !co.fxMix;
  const q = !inSub && co && co.price > 0 ? h('div', { class: 'an-nav-q' + (ed ? ' ed' : ''), on: canEd ? { click: pxSheet } : {} },
    h('b', {}, ed ? h('i', { class: 'an-pxv' }, fmt(co.price, 'ps', co)) : fmt(co.price, 'ps', co)),
    ed ? h('em', { class: 'an-pxwas' }, T('anPxWas', { p: strip(fmt(co.price0, 'ps', co)) }))
      : ch != null ? h('span', { class: ch >= 0 ? 'an-up' : 'an-down' }, iso((ch >= 0 ? '+' : MINUS) + Math.abs(co.price - co.prev).toFixed(2) + ' (') , sgn(ch, 2), ')') : null) : null;
  const pen = canEd ? h('button', { class: 'an-pxed' + (ed ? ' on' : ''), type: 'button', 'aria-label': T('anPxEdit'), 'aria-pressed': String(ed), on: { click: pxSheet } }, icon('pen')) : null;
  return h('div', { class: 'an-nav' + (q ? ' has-q' : '') }, back, pen, q, h('div', { class: 'an-nav-t' }, logo, h('span', { class: 'an-nav-id' }, h('b', { dir: 'auto' }, inSub ? nm : sym), inSub ? null : h('small', { dir: 'auto' }, nm))));
}
function header(co) {
  const ch = co.prev ? co.price / co.prev - 1 : null;
  const meta = [co.sym.replace(/\.TA$/, ''), co.exch, co.sector].filter(Boolean).join(' · ');
  // 10 שנים של מחיר (חודשי) — רקע גרפי לראש המסך
  /* 28/10 (בקשת המשתמש): טווח לבחירה — 1Y/3Y/5Y/10Y/MAX, כפתורים כמו בכרטיס המניה. ברירת מחדל 5 שנים (בקשת המשתמש 28/10) */
  const rm = S.hr == null ? 60 : S.hr, cut = (a) => (rm ? a.slice(-(rm + 1)) : a.slice());
  const pr = pxReal(co);   // גרף המחיר = היסטוריה — תמיד לפי המחיר האמיתי, גם כשהמחיר נערך לבדיקה
  const px = co.px && co.px.c ? cut(co.px.c).filter((x) => x != null) : [], p0 = px[0], ch10 = p0 > 0 && px.length > 6 ? pr / p0 - 1 : null;
  const yrs = Math.round(px.length / 12), pt = co.px && co.px.t ? cut(co.px.t) : [];
  const rngLbl = rm === 12 ? T('anInYear') : !rm && pt.length ? T('anSince', { y: pt[0].slice(0, 4) }) : T('anInYears', { n: yrs });
  const rng = h('div', { class: 'chip-row stock-chips an-hrng' }, ...[[12, 'sr1Y'], [36, 'sr3Y'], [60, 'sr5Y'], [120, 'an10Y'], [0, 'srMax']].map(([m, k]) =>
    h('button', { class: 'range-btn' + (m === rm ? ' active' : ''), type: 'button', 'aria-pressed': String(m === rm), on: { click: () => { if (S.hr === m || (S.hr == null && m === 60)) return; S.hr = m; S.heroDone = false; render(); } } }, T(k))));
  /* 27/10/2026 (סרטון המשתמש — הגרף "מתרענן" בכל מעבר לשונית): אותו גרף בכל הלשוניות — האלמנט עצמו עובר מציור לציור,
     בלי לבנות ולצייר מחדש (עד היום: פריים ריק בכל מעבר, וברצועה הקבועה של הקובייה — בלי גרף בכלל) */
  const hk = co.sym + '|' + pr + '|' + rm + '|' + (document.documentElement.dataset.theme || '');
  let chart = S.hero && S.hero.co === co && S.hero.k === hk ? S.hero.el : null;
  if (chart) chart.firstChild.classList.add('an-still');   // אלמנט שנכנס שוב לדף מריץ את אנימציות ה־CSS שלו מההתחלה
  if (!chart) {
    const host = h('div', { class: 'an-pxc' + (S.heroDone ? ' an-still' : '') });
    chart = h('div', { class: 'an-pxw' }, host);   // display: contents — הציר נכנס אחרי הגרף בתוך העטיפה, ועובר איתו
    S.heroDone = true;   // הגרף בראש מצטייר פעם אחת — לא בכל מעבר לשונית
    const hiPx = px.length ? Math.max(...px, pr) : null, loPx = px.length ? Math.min(...px, pr) : null;
    if (ch10 != null) S.after.push(() => spark(host, px.concat(pr), ch10 >= 0 ? cssv('good') : cssv('bad'), true,
      { w: 340, h: 64, sw: 2, px: 10, labels: pt.length ? [pt[0].slice(0, 4), T('anToday')] : null, peak: hiPx ? T('anPeak', { v: strip(fmt(hiPx, 'ps', co, 0)) }) : null, trough: loPx ? T('anLow', { v: strip(fmt(loPx, 'ps', co, 0)) }) : null }));
    S.hero = { co, k: hk, el: chart };
  }
  return h('div', { class: 'an-head' }, edRow(co),
    h('div', { class: 'an-hero' },
      h('div', { class: 'an-idrow' },
        h('div', { class: 'an-px' }, h('b', {}, fmt(co.price, 'ps', co)), ch != null ? h('span', { class: ch >= 0 ? 'an-up' : 'an-down' }, sgn(ch, 2), h('small', {}, ' ' + T('anToday'))) : null),
        h('div', { class: 'an-idn' }, h('span', { dir: 'auto' }, meta), ch10 != null ? h('span', { class: 'an-ch10' }, rngLbl, ' ', h('b', { class: ch10 >= 0 ? 'an-up' : 'an-down' }, sgn(ch10, 0))) : null)),
      ch10 != null ? chart : null, co.px && co.px.c && co.px.c.length > 13 ? rng : null),
    co.gone ? h('p', { class: 'an-gone' }, T('anGone', { d: dmy(co.gone) })) : null);
}
/* הלשוניות — ילד ישיר של העמוד (לא של הראש), כדי שיישארו דבוקות מתחת לסרגל העליון לאורך כל הגלילה */
function tabsBar() {
  const seg = h('div', { class: 'an-seg an-seg-main', role: 'tablist' }, h('span', { class: 'an-seg-th', 'aria-hidden': 'true' }), ...TABS.map((k) =>
    h('button', { type: 'button', role: 'tab', 'data-k': k, 'aria-selected': String(S.tab === k), 'aria-pressed': String(S.tab === k), on: { click: () => go(k) } }, T(TAB_T[k]))));
  S.after.push(() => segThumb(seg));
  /* 27/10/2026 (צילום המשתמש — הסרגל "חתוך"): רצועה ברוחב מלא מאחורי הלשוניות, באותה זכוכית של הסרגל העליון —
     עד היום הכרטיסים נראו ברווח שמעל הלשוניות ומתחתיהן, והסרגל נראה כאילו הוא חלק מכרטיס */
  return h('div', { class: 'an-tabbar' }, seg);
}
/* לשונית הבורר מחליקה מהמקום הקודם (הבורר נבנה מחדש בכל ציור — FLIP לפי המיקום השמור) */
function segThumb(seg) {
  const th = seg.querySelector('.an-seg-th'), b = seg.querySelector('[aria-pressed="true"]');
  if (!th || !b) return;
  const x = b.offsetLeft, w = b.offsetWidth;
  th.style.transform = `translateX(${x}px)`; th.style.width = w + 'px';
  const from = S.segX, fw = S.segW;
  S.segX = x; S.segW = w;
  if (from == null || from === x || typeof th.animate !== 'function' || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
  th.animate([{ transform: `translateX(${from}px)`, width: (fw || w) + 'px' }, { transform: `translateX(${x}px)`, width: w + 'px' }], { duration: 380, easing: 'cubic-bezier(.3, 1.3, .5, 1)' });
}
function go(k) {
  if (k === S.tab) return;
  navTab(k);
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
  if (co.fxAdr > 1) extra.push(T('anFxAdr', { n: co.fxAdr }));
  if (co.fxMix) extra.push(T('anFxMix', { c: co.cur }));
  return h('p', { class: 'an-src' }, T('anSources', { s: src, d: dmy(co.asOf) }), extra.length ? h('br') : null, extra.join(' · '));
}

/* --- תמונת מצב: רק נתונים — ארבע הקבוצות כמספר מוביל (בלי ציון), ומה חדש בדוחות --- */
/* סמלים קטנים בסגנון SF Symbols (קווים בלבד) */
const ICONS = {
  pen: 'M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4',
  value: 'M4 18h16M7 15V9m5 6V5m5 10v-4',
  growth: 'M4 17l5-5 4 4 7-8M15 8h5v5',
  profit: 'M12 3v18M16.5 7.5c0-1.7-2-3-4.5-3s-4.5 1.3-4.5 3 2 2.6 4.5 3 4.5 1.3 4.5 3-2 3-4.5 3-4.5-1.3-4.5-3',
  safe: 'M12 3l7 3v6c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6z',
};
const multClean = (a, k) => a.map((x) => (x > 0 && x < (k === 'pe' ? 150 : 300) ? x : null));
const icon = (k) => { const s0 = sv('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }); sv('path', { d: ICONS[k], fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, s0); return s0; };
function keyTiles(co) {
  const c = ctx(co, nowP(co)), H = multHist(co), pe = c.eps > 0 && pxF(co) ? pxF(co) / c.eps : null, peMed = multAvg(H.pe.filter((x) => x < 150));
  const fyl = fyList(co).slice(-10), yr = fyl.length ? [fyl[0].label, fyl[fyl.length - 1].label] : null, ht = H.t.slice(-120), pyr = ht.length ? [ht[0].slice(0, 4), T('anToday')] : null;
  const [g5, n5] = cagrN(co, 'rev', 5), lev = c.ebitda > 0 && c.netcash != null ? -c.netcash / c.ebitda : null, cs = curSym(co.cur);
  return [
    ['value', 'c1', fmt(pe, 'x', co, 1), peMed ? T('anKHValue', { v: strip(fmt(peMed, 'x', co, 1)) }) : T('anKHValue0'), multClean(H.pe.slice(-120), 'pe'), true, pyr],
    ['growth', 'c1', sgn(g5), T('anKHGrowth', { n: n5 || 5 }), fyVals(co, 'rev', 10), false, yr],
    ['profit', 'c1', pct(c.roic, 0), c.roic != null ? T('anKHProfit', { v: iso(cs + Math.round(c.roic * 100)), c: iso(cs + '100') }) : T('anKHProfit0'), fyVals(co, 'roic', 10), true, yr],
    ['safe', lev != null && lev >= 3 ? 'c4' : 'c1', c.netcash >= 0 ? fmt(c.netcash, 'money', co) : lev != null ? iso(lev.toFixed(1) + '×') : '—',
      c.netcash >= 0 ? T('anKHCash') : T('anKHDebt'), fyVals(co, 'netcash', 10), false, yr],
  ];
}
function factsEl(co) {
  const c = ctx(co, nowP(co)), mcap = pxF(co) && co.sharesOut ? pxF(co) * co.sharesOut : null, pe = c.eps > 0 && pxF(co) ? pxF(co) / c.eps : null, fy = c.fcf != null && mcap ? c.fcf / mcap : null;
  const fact = (tt, v, hint, key) => { const ce = PX_FACT.has(key) && canEdM(co, key), d = PX_FACT.has(key) ? DEP(key) : null;
    return h('button', { class: 'an-fact' + (d === 'ed' ? ' ed' : ''), type: 'button', on: { click: () => factSheet(key) } }, h('span', {}, tt, ce ? penI() : null), h('b', { 'data-dep': d }, v), h('small', {}, hint)); };
  return h('div', { class: 'an-facts' }, fact(T('anFMcap'), fmt(mcap, 'money', co), T('anHMcap'), 'mcap'), fact(T('anFPe'), fmt(pe, 'x', co, 1), T('anHPe'), 'pe'),
    fact(T('anFFpe'), fmt(co.fpe, 'x', co, 1), T(isAdj(co) ? 'anHFpeAdj' : 'anHFpe'), 'fpe'),
    fact(T('anFBpe'), fmt(bpeOf(co), 'x', co, 1), T('anHBpe'), 'bpe'), fact(T('anFBfpe'), fmt(bfpeOf(co), 'x', co, 1), T('anHBfpe'), 'bfpe'),
    fact(T('anFFy'), pct(fy), T('anHFy'), 'fy'),
    fact(c.netcash >= 0 ? T('anNetCash') : T('anNetDebt'), fmt(Math.abs(c.netcash || 0), 'money', co), T('anHNc'), 'nc'));
}
/* שורת רשימה שפותחת תת־עמוד: שם, הסבר קטן, ערך וחץ */
const navRow = (tt, hint, v, on) => h('button', { class: 'an-row an-nrow', type: 'button', on: { click: on } },
  h('div', { class: 'an-rt' }, h('b', {}, tt), hint ? h('span', {}, hint) : null), v != null && v !== '' ? h('div', { class: 'an-rv' }, v) : null, h('span', { class: 'an-chev' }));
function pageSnap(co, pg) {
  const C = checks(co, MAC);
  pg.append(factsEl(co));
  const keys = h('div', { class: 'an-keys' });
  for (const [k, col, v, hint, hist, line, yl] of keyTiles(co)) {
    const sp = h('div', { class: 'an-key-sp' });
    keys.append(h('button', { class: 'an-key', type: 'button', style: `--an-k:var(--an-${col})`, 'aria-label': C[k].n + ' — ' + strip(v), on: { click: () => checkSheet(k) } },
      h('span', { class: 'an-key-l' }, h('span', { class: 'an-key-ic' }, icon(k)), C[k].n, h('span', { class: 'an-chev' })),
      h('b', { 'data-dep': k === 'value' ? DEP() : null }, v), h('span', { class: 'an-key-s' }, hint), sp));
    S.after.push(() => spark(sp, hist, cssv(col), line, { w: 140, h: 40, noDot: !line, px: 10, labels: yl }));
  }
  pg.append(keys);
  // הדוחות: האחרון, הבא, והתחזיות בתת־עמוד
  const hist = (co.hist || []).filter((x) => x.a != null && x.e != null), lh = hist[hist.length - 1];
  const e0 = (co.est || []).find((e) => e.p === '0y');
  const rows = [];
  if (lh) { const s0 = lh.e ? lh.a / lh.e - 1 : 0; rows.push(h('div', { class: 'an-row' }, h('div', { class: 'an-rt' }, h('b', {}, T('anLastRep')), h('span', {}, T('anLastRepS', { a: strip(fmt(lh.a, 'ps', co)), e: strip(fmt(lh.e, 'ps', co)) }))), h('div', { class: 'an-rv' }, fmt(lh.a, 'ps', co), h('small', { class: s0 >= 0 ? 'an-up' : 'an-down' }, sgn(s0, 0))))); }
  if (co.nextEarn && co.nextEarn >= co.asOf) rows.push(h('div', { class: 'an-row' }, h('div', { class: 'an-rt' }, h('b', {}, T('anNextRep')), h('span', {}, dmy(co.nextEarn))), h('span', { class: 'an-rv an-dim2' }, daysTo(co.nextEarn, co.asOf))));
  rows.push(e0 && e0.eps ? navRow(T('anEstAll'), T('anEstAllS', { n: e0.n || '?' }), fmt(e0.eps, 'ps', co), estSheet) : h('div', { class: 'an-row' }, h('div', { class: 'an-rt' }, h('b', {}, T('anNoEst')), h('span', {}, T('anNoEstS')))));
  pg.append(h('section', { class: 'an-card an-card-list' }, h('div', { class: 'an-list' }, ...rows)));
  if (co.years.length < 6) pg.append(h('div', { class: 'an-note' }, T(/\.TA$/.test(co.sym) ? 'anShortTA' : 'anShort', { n: co.years.length })));
}
function daysTo(d, asOf) {
  const n = Math.round((new Date(d) - new Date(asOf || Date.now())) / 864e5);
  return n > 1 ? T('earnInDays', { n }) : n === 1 ? T('earnTomorrow') : n === 0 ? T('earnToday') : T('anDaysAgo', { n: -n });
}

/* --- דוחות --- */
function pageRep(co, pg) {
  pg.append(h('div', { class: 'an-seg sm', role: 'group', 'aria-label': T('anTabRep') }, ...[['is', T('anRIs')], ['bs', T('anRBs')], ['cf', T('anRCf')], ['rt', T('anRRt')]].map(([k, tt]) =>
    h('button', { type: 'button', 'aria-pressed': String(S.rsub === k), on: { click: () => repSub(k) } }, tt))));
  // כרטיס לכל מדד ברוחב המסך: שם והסבר, ערך גדול ושני נתונים, וגרף של 10 שנים עם השנים, הערכים וקו ממוצע
  const list = h('div', { class: 'an-rcards' });
  for (const r of ROWS[S.rsub]) list.append(repCard(co, rowDef(r)));
  pg.append(list);
}
/* רווח והפסד / מאזן / תזרים / יחסים: הגלילה נשמרת עד הנקודה שבה הלשוניות נדבקות (בלי לקפוץ לראש העמוד או
   להישאר באמצע רשימה אחרת), והרשימה החדשה נכנסת מהצד */
function repSub(k) {
  if (!ROOT || k === S.rsub) return;
  const order = ['is', 'bs', 'cf', 'rt'], dir = order.indexOf(k) > order.indexOf(S.rsub) ? 1 : -1;
  const old = ROOT.querySelector('.an-rcards'), seg = ROOT.querySelector('.an-seg.sm');
  S.rsub = k;
  if (!old || !seg || !S.co) { render(); return; }
  /* 27/10/2026 (סרטון המשתמש — קפיצות במעבר בין תת־הלשוניות): רק הרשימה מתחלפת, במקום. עד היום כל העמוד נבנה
     מחדש (הראש, הלשוניות, הבורר), הגרפים הופיעו פריים אחד ריקים, והרשימה נעלמה לגמרי (שקיפות 0) לפני שנכנסה */
  const key = S.tab + ':' + k;
  ROOT.classList.add('an-still');
  S.seen.add(key);
  S.after = [];
  const list = h('div', { class: 'an-rcards' });
  for (const r of ROWS[k]) list.append(repCard(S.co, rowDef(r)));
  old.replaceWith(list);
  seg.querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-pressed', String(order[i] === k)));
  flushAfter();
  // גלול מתחת לתחילת הרשימה — חוזרים לתחילת הרשימה החדשה (הלשוניות דבוקות); גלילה בתנופה נעצרת קודם, אחרת היא ממשיכה מהמקום הישן
  const y = stickY();
  if (ROOT.scrollTop > y) {
    ROOT.style.overflowY = 'hidden';
    navY(y);
    requestAnimationFrame(() => { if (ROOT) ROOT.style.overflowY = ''; });
  }
  const rtl = document.documentElement.dir === 'rtl';
  if (typeof list.animate === 'function' && !(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches))
    list.animate([{ opacity: 0.4, transform: `translateX(${(rtl ? -24 : 24) * dir}px)` }, { opacity: 1, transform: 'none' }], { duration: 300, easing: 'cubic-bezier(.2, .9, .25, 1)' });
}
const stat = (label, v, cls) => h('div', { class: 'an-rstat' }, h('span', {}, label), h('b', { class: cls || null }, v));
const tone = (g) => (g == null ? null : g >= 0 ? 'an-up' : 'an-down');
/* 27/10/2026 (בקשת המשתמש — ServiceNow בלי דיבידנד): מדד שאין לו אף ערך / שכולו אפס = מצב שקט ומוסבר, לא גרף ריק עם "—".
   דיבידנד ורכישות חוזרות — "לא מחלקת" (אין תשלום בדוחות = אין חלוקה; תגית התשלום מדווחת תמיד כשיש), אחרים — "לא מופיע בדוחות" */
function emptyOf(def, series) {
  const f = fin(series.flatMap((s) => s.vals));
  if (f.length && f.some((v) => v !== 0)) return null;
  const k = def.s[0];
  if (k === 'dps') return [T('anNoDiv'), T('anNoDivS')];
  if (k === 'buy') return [T('anNoBuy'), T('anNoBuyS')];
  return f.length ? [T('anAllZero'), T('anAllZeroS')] : [T('anNoData'), T('anNoDataS')];
}
function emptyBlock(e) {
  return h('div', { class: 'an-empty' }, h('span', { class: 'an-empty-i', 'aria-hidden': 'true' }),
    h('div', {}, h('b', {}, e[0]), h('small', {}, e[1])));
}
function repCard(co, def) {
  const host = h('div', { class: 'an-mc' }), hint = rowHint(def), stats = h('div', { class: 'an-rstats' }), legend = h('div', { class: 'an-legend2' });
  let big = '', bigSub = '';
  if (def.line) {   // מכפיל — 10 שנים חודשי, חציון, טווח
    const Hh = multHist(co), k = def.line[1], a = multClean(Hh[k].slice(-120), k), ok = fin(a), md = multAvg(ok), now = fin(Hh[k]).pop();
    big = fmt(now, 'x', co, 1); bigSub = T('anToday');
    if (md != null) stats.append(stat(T('anAvg10'), fmt(md, 'x', co, 1)), stat(T('anRange'), iso(Math.min(...ok).toFixed(0) + '–' + Math.max(...ok).toFixed(0) + '×')));
    const t = Hh.t.slice(-120), labels = t.map((x, i) => (x.slice(5, 7) === '01' && (+x.slice(0, 4)) % 2 === 0 ? x.slice(0, 4) : ''));
    S.after.push(() => miniChart(host, { labels, series: [{ vals: a, color: cssv(def.line[2]) }], unit: 'x', co, line: true, avg: md, avgName: T('anAvg') }));
  } else {
    const d = seriesFor(co, def, { mode: 'fy', range: '10', view: 'v' }), one = d.series.length === 1, k0 = def.s[0], m = M[k0];
    const lastP = d.per[d.per.length - 1], empty = emptyOf(def, d.series);
    if (empty) return h('button', { class: 'an-rcard', type: 'button', on: { click: () => chartSheet(def) } },
      h('div', { class: 'an-rc-h' }, h('b', {}, def.n), h('span', { class: 'an-chev' })), hint ? h('span', { class: 'an-hint' }, hint) : null, emptyBlock(empty));
    if (one) {
      const vals = d.series[0].vals, last = vals[vals.length - 1];
      big = fmt(last, d.unit, co); bigSub = lastP && lastP.kind === 'ttm' ? T('anTtm12') : lastP ? lastP.label : '';
      if (m.ratio) {
        const a5 = mean(fyList(co).slice(-5).map((p) => mval(co, k0, p)));
        stats.append(stat(T('anAvg5'), fmt(a5, d.unit, co)), stat(T('anYearAgo'), fmt(vals.length > 1 ? vals[vals.length - 2] : null, d.unit, co)));
      } else {
        const [g5, n5] = cagrN(co, k0, 5), yoy = m.f ? null : growthOf(co, nowP(co), k0);
        stats.append(stat(T('anGrowthN', { n: n5 || 5 }), sgn(g5), tone(g5)), stat(T('anVsPrev'), sgn(yoy), tone(yoy)));
      }
    } else {
      for (const sr of d.series) { const v = sr.vals[sr.vals.length - 1]; legend.append(h('span', {}, h('i', { style: `background:${sr.color}` }), sr.name, ' ', h('b', {}, fmt(v, d.unit, co)))); }
    }
    S.after.push(() => miniChart(host, { labels: d.labels, series: d.series, unit: d.unit, co, line: !one, avg: one ? mean(d.series[0].vals) : null, avgName: T('anAvg') }));
  }
  return h('button', { class: 'an-rcard', type: 'button', on: { click: () => chartSheet(def) } },
    h('div', { class: 'an-rc-h' }, h('b', {}, def.n), h('span', { class: 'an-chev' })),
    hint ? h('span', { class: 'an-hint' }, hint) : null,
    big ? h('div', { class: 'an-rc-row' }, h('div', { class: 'an-rc-big' }, h('b', { 'data-dep': def.line ? DEP() : null }, big), h('small', {}, bigSub)), stats) : null,
    legend.childElementCount ? legend : null, host);
}
/* גרף ברוחב הכרטיס בפיקסלים אמיתיים (טקסט לא נמתח): עמודות לסדרה אחת, קווים לכמה; שנים למטה, ערך ראשון ואחרון, קו ממוצע */
function miniChart(host, o) {
  host.textContent = '';
  const W = Math.max(200, host.clientWidth || 320), H = o.h || 132, pT = 20, pB = 20;
  const all = fin(o.series.flatMap((s) => s.vals)); if (!all.length) return;
  let lo = o.line ? Math.min(...all) : Math.min(0, ...all), hi = o.line ? Math.max(...all) : Math.max(0, ...all);
  if (o.line && o.series.length === 1 && all.length > 20) { lo = quant(all, 0.03); hi = quant(all, 0.97); }   // קפיצה חד־פעמית לא מועכת את הגרף
  if (o.line) { const pd = (hi - lo) * 0.12 || 1; lo -= pd; hi += pd; }
  const n = o.labels.length, band = W / n, y = (v) => pT + (hi - clamp(v, lo, hi)) / (hi - lo || 1) * (H - pT - pB), cx = (i) => i * band + band / 2;
  const svg = sv('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, 'aria-hidden': 'true' }, host);
  const short = (v) => strip(fmt(v, o.unit, o.co, o.unit === 'x' ? 0 : undefined));
  const txt = (x, yy, t, cls, anchor) => { const e = sv('text', { x, y: yy, 'text-anchor': anchor || 'middle', class: cls }, svg); e.textContent = t; return e; };
  if (!o.line && lo < 0) sv('line', { x1: 0, x2: W, y1: y(0), y2: y(0), class: 'an-mc-zero' }, svg);
  if (o.avg != null && isFinite(o.avg)) {
    sv('line', { x1: 0, x2: W, y1: y(o.avg), y2: y(o.avg), class: 'an-mc-avg' }, svg);
    // בצד של השנים הישנות (לא על העמודה האחרונה); טקסט עברי + מספר — בכיוון של השפה, המספר מבודד
    const at = txt(2, y(o.avg) - 4, '', 'an-mc-avgt', 'end');
    at.setAttribute('direction', document.documentElement.dir === 'rtl' ? 'rtl' : 'ltr'); if (document.documentElement.dir !== 'rtl') at.setAttribute('text-anchor', 'start');
    at.textContent = o.avgName + ' ' + iso(short(o.avg));
  }
  if (!o.line) {
    const v = o.series[0].vals, bw = Math.min(28, band * 0.62);
    v.forEach((x, i) => { if (x == null) return; const y1 = y(Math.max(x, 0)), y2 = y(Math.min(x, 0));
      sv('rect', { x: cx(i) - bw / 2, y: y1, width: bw, height: Math.max(1.5, y2 - y1), rx: Math.min(5, bw / 2), fill: o.series[0].color, opacity: i === n - 1 ? 1 : 0.42, class: 'an-bar', style: `--an-bi:${i}` }, svg); });
    const idx = v.map((x, i) => (x == null ? -1 : i)).filter((i) => i >= 0), f = idx[0], l = idx[idx.length - 1];
    for (const i of f === l ? [l] : [f, l]) txt(i === l ? Math.min(cx(i), W - 18) : Math.max(cx(i), 18), v[i] >= 0 ? y(v[i]) - 5 : y(v[i]) + 12, short(v[i]), i === l ? 'an-mc-vl' : 'an-mc-v0');
  } else {
    for (const sr of o.series) {
      let d = ''; sr.vals.forEach((x, i) => { if (x != null) d += (d && sr.vals[i - 1] != null ? 'L' : 'M') + cx(i).toFixed(1) + ',' + y(x).toFixed(1); });
      sv('path', { d, fill: 'none', stroke: sr.color, 'stroke-width': 2.2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', pathLength: 1, class: 'an-draw' }, svg);
      const li = sr.vals.map((x, i) => (x == null ? -1 : i)).filter((i) => i >= 0).pop();
      if (li != null) sv('circle', { cx: cx(li), cy: y(sr.vals[li]), r: 3.5, fill: sr.color }, svg);
    }
    if (o.series.length === 1) { const v = o.series[0].vals, li = v.map((x, i) => (x == null ? -1 : i)).filter((i) => i >= 0).pop(); if (li != null) txt(cx(li) - 6, y(v[li]) - 8, short(v[li]), 'an-mc-vl', 'end'); }
  }
  // שנים: כל העמודות כשיש מקום, אחרת כל שנייה (האחרונה תמיד)
  const step = band >= 30 ? 1 : 2;
  o.labels.forEach((lb, i) => { if (!lb || ((n - 1 - i) % step && o.labels.some((x) => !x) === false)) return; txt(cx(i), H - 5, band >= 36 ? String(lb) : String(lb).replace(/^(19|20)(\d\d)$/, "'$2"), i === n - 1 ? 'an-mc-xl' : 'an-mc-x'); });
}

/* --- שווי --- */
const mark = (el, d) => { for (const k in d) if (d[k] != null && d[k] !== '') el.dataset[k] = d[k]; return el; };
/* ---------- עמוד השווי = מחשבון שהמשתמש ממלא (27/10/2026, בקשת המשתמש — לפי ת־ניתוח) ----------
   החישוב של iCharts: הכנסות בעוד N שנים = בסיס × (1+צמיחה)^N, רווח = הכנסות × שולי רווח, שווי = רווח × מכפיל
   (נמוך / בסיס / גבוה), תשואה שנתית ומחיר יעד. נוסף: שינוי במספר המניות בשנה (רכישות חוזרות / הנפקות) ומחיר היום
   שנותן את התשואה שהמשתמש רוצה. כל שדה מגיע עם ערך מוצע מהדוחות לפי סוג החברה ובגישה שמרנית של השקעות ערך
   (צמיחה — הנמוכה מבין ההיסטוריה והאנליסטים ועד 15%; מכפילים — מההיסטוריה של החברה עצמה; תשואה רצויה 10%).
   בלי "זול/יקר" ובלי צבעים — רק החישוב לפי מה שהוזן */
const CALC_G_MAX = 0.15, CALC_MULT_MAX = 40, CALC_YRS = 5;
const CALC_KEYS = ['base', 'g', 'm', 'yrs', 'sh', 'dv', 'lo', 'mid', 'hi', 'req'];
/* 27/10/2026 (בקשת המשתמש — "אותה חברה, פער פי 3 בין רווח לתזרים"): שלוש טעויות שתוקנו כאן.
   (1) כל מכפיל נחתך בנפרד ל־×40 — אצל חברה שההיסטוריה שלה כולה מעל 40 (ServiceNow: 87–153) שלושת התרחישים יצאו 40,
       ושני הבסיסים קיבלו אותו מכפיל למרות שמכפיל הרווח שלה כפול ממכפיל התזרים. עכשיו כל בסיס עם ההיסטוריה שלו,
       וכשהגבוה מעל התקרה — כל השלושה יורדים באותו יחס (המרווח ביניהם נשמר).
   (2) "בסיס" = ממוצע — שנה חריגה אחת משכה אותו מעל הרבע העליון (Coca‑Cola: 36.5 מול 31.5). עכשיו החציון.
   (3) תזרים חופשי לא מוריד את התשלום במניות, ואת הדילול שהוא יוצר מכסות רכישות חוזרות שמשולמות מאותו תזרים —
       כך הוא נספר פעמיים (אצל ServiceNow ‏15% מההכנסות). הבסיס הוא תזרים לבעלים = תזרים חופשי פחות תשלום במניות,
       כמו אצל באפט, והמכפיל שלו — מחיר לתזרים לבעלים מההיסטוריה של החברה.
   ועוד: שולי הרווח — חציון 5 השנים (שנה עם הטבת מס חד־פעמית לא מושכת), תחזית האנליסטים — מהשנה האחרונה שדווחה
   ועד שנתיים קדימה (שנה אחת רועשת), ודיבידנדים — חלק מהתשואה (בלעדיהם תשואת Coca‑Cola נמוכה בכ־3% בשנה). */
function calcMults(hist) {
  const t = [quant(hist, 0.25), median(hist), quant(hist, 0.75)];
  const k = t[2] > CALC_MULT_MAX ? CALC_MULT_MAX / t[2] : 1;
  // בכפולות של 5 (בקשת המשתמש) — ושלושה ערכים שונים: עיגול יכול לאחד שניים (25.5 / 28 / 31.5 → 25 / 30 / 30)
  const r5 = (x) => Math.round(x * k / 5) * 5, mid = clamp(r5(t[1]), 10, CALC_MULT_MAX - 5);
  const m = [clamp(Math.min(r5(t[0]), mid - 5), 5, mid - 5), mid, clamp(Math.max(r5(t[2]), mid + 5), mid + 5, CALC_MULT_MAX)];
  return { m, raw: t, k };
}
function calcDefaults(co, want) {
  co = real(co);   // הערכים המוצעים — מהדוחות ומההיסטוריה האמיתית, לא מהמחיר לבדיקה
  const c = ctx(co, nowP(co)), fy = fyList(co).slice(-5), ind = co.ind || {}, H = multHist(co);
  // בנק / ביטוח: תזרים חופשי לא מודד את העסק (הפקדות והלוואות הם התזרים) — רק רווח נקי
  const noRev = !(c.rev > 0), basis = co.reit ? 'ffo' : want === 'fcf' && !noRev && !co.fin ? 'fcf' : 'ni';
  const src = {}, val = { yrs: CALC_YRS, req: HURDLE };
  // בסיס: הכנסות 12 החודשים האחרונים; בלי הכנסות (חלק מהבנקים) — הרווח הנקי עצמו
  val.base = noRev ? c.ni : c.rev;
  src.base = T(noRev ? 'anCsBaseNi' : 'anCsBase');
  // צמיחה: הנמוכה מבין 5 השנים האחרונות ותחזית האנליסטים (מהשנה האחרונה שדווחה עד השנה הבאה), בין ‎−5%‎ ל־15%
  const [h5, n5] = cagrN(co, noRev ? 'ni' : 'rev', 5);
  const eg = noRev ? null : estGrowth(co);
  const cand = [h5, eg].filter((x) => x != null);
  val.g = clamp(cand.length ? Math.min(...cand) : 0.05, -0.05, CALC_G_MAX);
  src.g = cand.length ? T('anCsG', { h: h5 != null ? strip(pct(h5)) : '—', n: n5 || 5, e: eg != null ? strip(pct(eg)) : '—', m: strip(pct(CALC_G_MAX, 0)) }) : T('anCsGNone');
  // שולי רווח: חציון 5 השנים; בהפסד — שולי הרווח של הענף
  const prof = (x) => (basis === 'ffo' ? x.ffo : basis === 'fcf' ? x.fcfsbc : x.ni);
  if (noRev) { val.m = 1; src.m = ''; }
  else {
    const mv = fin(fy.map((p) => { const x = ctx(co, p), v = prof(x); return v != null && x.rev > 0 ? v / x.rev : null; }));
    const m = median(mv);
    if (m > 0) { val.m = m; src.m = T(basis === 'fcf' ? 'anCsMF' : basis === 'ffo' ? 'anCsMFfo' : 'anCsM', { n: mv.length }); }
    else if (ind.nm > 0 && basis === 'ni') { val.m = ind.nm; src.m = T('anCsMInd', { i: iso(co.indName || T('anIndustry')) }); }
    else { val.m = 0.1; src.m = T('anCsMNone'); }
  }
  // מכפילים: רבע תחתון / חציון / רבע עליון של 10 השנים של החברה, לפי אותו בסיס; בלי מספיק היסטוריה — הענף, ואז 15/20/25
  const mkey = basis === 'fcf' ? 'pofcf' : basis === 'ffo' ? 'pffo' : 'pe';
  const hist = H[mkey].slice(-120).filter((x) => x > 0 && x < 300);
  let M;
  if (hist.length >= 24) {
    M = calcMults(hist);
    const r = M.raw.map((x) => strip(fmt(x, 'x', co, 0))).join(' / ');
    src.mult = M.k < 1 ? T('anCsMultCut', { n: Math.round(hist.length / 12), r, m: CALC_MULT_MAX }) : T('anCsMult', { n: Math.round(hist.length / 12), r });
  } else if (mkey === 'pe' && ind.ape > 0) { M = calcMults([ind.ape * 0.8, ind.ape, ind.ape * 1.2]); src.mult = T('anCsMultInd', { i: iso(co.indName || T('anIndustry')) }); }
  else { M = calcMults([15, 20, 25]); src.mult = T('anCsMultStd'); }
  [val.lo, val.mid, val.hi] = M.m;
  // מניות: הקצב של 5 השנים האחרונות, בין ‎−5%‎ ל־5% בשנה
  const [shg] = cagrN(co, 'sh', 5);
  val.sh = shg == null ? 0 : clamp(shg, -0.05, 0.05);
  src.sh = shg == null ? T('anCsShNone') : T('anCsSh', { v: strip(sgn(shg)) });
  // דיבידנד: חציון 5 השנים של החלק מהרווח (לפי הבסיס) שחולק, 0–100%
  const dv = fin(fy.map((p) => { const x = ctx(co, p), v = prof(x); return x.dps > 0 && x.sh > 0 && v > 0 ? x.dps * x.sh / v : x.dps == null || x.dps === 0 ? 0 : null; }));
  const pay = dv.length ? clamp(median(dv), 0, 1) : 0;
  val.dv = pay; src.dv = pay > 0 ? T('anCsDv', { n: dv.length }) : T('anCsDvNone');
  src.yrs = T('anCsYrs'); src.req = T('anCsReq');
  return { basis, noRev, mkey, val, src, shares: co.sharesOut || c.sh };
}
/* תחזית האנליסטים כצמיחה שנתית: מהכנסות השנה האחרונה שדווחה עד השנה הבאה (+1y), רק כשיש לפחות 3 אנליסטים */
function estGrowth(co) {
  const est = co.est || [], e1 = est.find((e) => e.p === '+1y');
  if (!e1 || !(e1.rev > 0) || (e1.rn || 0) < 3 || !e1.end) return null;
  const last = fyList(co).filter((p) => p.end < e1.end).pop(); if (!last) return null;
  const r0 = ctx(co, last).rev, yrs = Math.round((Date.parse(e1.end) - Date.parse(last.end)) / 31557600000);
  return r0 > 0 && yrs >= 1 && yrs <= 3 ? (e1.rev / r0) ** (1 / yrs) - 1 : null;
}
/* תשואה שנתית פנימית: המחיר היום מול הדיבידנדים בכל שנה והמחיר בסוף (חיפוש בינארי — המונוטוניות מובטחת) */
function irr(price, flows) {
  const pv = (r) => flows.reduce((s, f, t) => s + f / (1 + r) ** (t + 1), 0);
  if (!(price > 0) || !(pv(-0.99) > price)) return null;
  let lo = -0.99, hi = 10;
  for (let i = 0; i < 100; i++) { const m = (lo + hi) / 2; if (pv(m) > price) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
/* החישוב עצמו — טהור (נבדק ב־analysis.test) */
function calcRun(V, shares0, price) {
  const N = V.yrs, dv = V.dv || 0, rev = V.base * (1 + V.g) ** N, prof = rev * V.m, sh = shares0 * (1 + V.sh) ** N;
  // דיבידנד למניה בכל שנה = הרווח של אותה שנה × החלק שמחולק ÷ מספר המניות אז
  const dps = []; for (let t = 1; t <= N; t++) { const s = shares0 * (1 + V.sh) ** t; dps.push(s > 0 ? V.base * (1 + V.g) ** t * V.m * dv / s : 0); }
  const divs = dps.reduce((a, b) => a + b, 0), pvDiv = dps.reduce((a, d, t) => a + d / (1 + V.req) ** (t + 1), 0);
  return ['lo', 'mid', 'hi'].map((k) => {
    const mcap = prof * V[k], ps = sh > 0 ? mcap / sh : null;
    const flows = ps > 0 ? dps.map((d, t) => d + (t === N - 1 ? ps : 0)) : null;
    return { mult: V[k], rev, prof, mcap, ps, divs, ret: flows ? irr(price, flows) : null, buy: ps > 0 ? pvDiv + ps / (1 + V.req) ** N : null };
  });
}
/* שדה: איך מוצג ונקרא — כסף במיליארדים/מיליונים, אחוזים, מכפיל, שנים */
function calcFields(co, D) {
  const big = Math.abs(D.val.base) >= 1e9, sc = big ? 1e9 : 1e6, cs = curSym(co.cur);
  const P = (d) => ({ show: (x) => (x * 100).toFixed(d), read: (s) => s / 100, unit: '%' });
  return [
    ['base', T(D.noRev ? 'anCiBaseNi' : 'anCiBase'), { show: (x) => (x / sc).toFixed(2), read: (s) => s * sc, unit: cs + ' ' + T(big ? 'anCuB' : 'anCuM') }],
    ['g', T(D.noRev ? 'anCiGNi' : 'anCiG'), P(1)],
    D.noRev ? null : ['m', T(D.basis === 'fcf' ? 'anCiMF' : D.basis === 'ffo' ? 'anCiMFfo' : 'anCiM'), P(1)],
    ['yrs', T('anCiYrs'), { show: (x) => String(x), read: (s) => Math.round(s), unit: T('anYrs'), min: 1, max: 15 }],
    ['sh', T('anCiSh'), P(1)],
    D.val.dv > 0 ? ['dv', T('anCiDv'), { ...P(0), min: 0, max: 1 }] : null,
    ['mult', T('anCiMult', { m: T(D.mkey === 'pofcf' ? 'anLPofcf' : D.mkey === 'pffo' ? 'anLPffo' : 'anLPe') }), { show: (x) => String(x), read: (s) => s, unit: '×', min: 0.5, keys: ['lo', 'mid', 'hi'], caps: [T('anCLo'), T('anCMid'), T('anCHi')] }],
    ['req', T('anCiReq'), P(1)],
  ].filter(Boolean);
}
/* התשואה השנתית הרצויה (req) משותפת לשני הבסיסים ונשמרת ב־S.reqEd: כשמשנים אותה — המחיר של המניה הופך למחיר שנותן
   בדיוק את התשואה הזו בתרחיש הבסיס (18/11/2026, בקשת המשתמש), וכל מה שנמדד מול המחיר מתעדכן */
function pageVal(co, pg) {
  if (!S.cv) S.cv = {};
  const D = calcDefaults(co, S.calcB), ed = S.cv[D.basis] || (S.cv[D.basis] = {}), V = () => ({ ...D.val, ...ed, ...(S.reqEd != null ? { req: S.reqEd } : {}) });
  const getE = (kk) => (kk === 'req' ? S.reqEd : ed[kk]), setE = (kk, x) => { if (kk === 'req') S.reqEd = x; else ed[kk] = x; };
  const delE = (kk) => { if (kk === 'req') S.reqEd = null; else delete ed[kk]; }, anyE = () => Object.keys(ed).length > 0 || S.reqEd != null;
  const unRet = () => { if (S.px && S.px.k === 'ret') { S.px = null; pxLive(null); } };
  const res = h('div', { class: 'an-cres' }), rows = h('div', { class: 'an-cin-list' });
  const resetBtn = h('button', { class: 'an-link', type: 'button', hidden: anyE() ? null : true, on: { click: () => {
    for (const k in ed) delete ed[k];
    const ret = S.reqEd != null && S.px && S.px.k === 'ret'; S.reqEd = null;
    if (ret) { S.px = null; setPx(co, null); }
    render(); } } }, T('anCReset'));
  const paint = () => {
    if (co.fxMix) { res.textContent = ''; res.append(h('p', { class: 'an-cnow' }, T('anFxMix', { c: co.cur }))); return; }
    if (S.px && S.px.k === 'ret') pxLive(retPx(co));
    const v = V(), R = calcRun(v, D.shares, co.price), cs = (x, d) => h('td', { 'data-dep': d ? DEP() : null }, x);
    const mcNow = co.price * D.shares;
    res.textContent = '';
    res.append(h('p', { class: 'an-cnow', 'data-dep': DEP() }, T('anCNow', { p: strip(fmt(co.price, 'ps', co)), m: strip(fmt(mcNow, 'money', co)) })),
      h('div', { class: 'an-tblw' }, h('table', { class: 'an-ctab' },
        h('thead', {}, h('tr', {}, h('th', {}), ...[T('anCLo'), T('anCMid'), T('anCHi')].map((t, i) => h('th', { class: i === 1 ? 'cur' : null }, t, h('small', {}, iso(String(R[i].mult) + '×')))))),
        h('tbody', {},
          h('tr', {}, h('th', {}, T('anCrMcap', { n: v.yrs })), ...R.map((r) => cs(strip(fmt(r.mcap, 'money', co))))),
          h('tr', {}, h('th', {}, T('anCrPs', { n: v.yrs })), ...R.map((r) => cs(strip(fmt(r.ps, 'ps', co))))),
          v.dv > 0 ? h('tr', {}, h('th', {}, T('anCrDv', { n: v.yrs })), ...R.map((r) => cs(strip(fmt(r.divs, 'ps', co))))) : null,
          h('tr', {}, h('th', {}, T('anCrRet')), ...R.map((r) => cs(r.ret == null ? '—' : sgn(r.ret), r.ret != null))),
          h('tr', {}, h('th', {}, T('anCrBuy', { r: strip(pct(v.req, 0)) })), ...R.map((r) => cs(r.buy == null ? '—' : strip(fmt(r.buy, 'ps', co)))))))),
      h('p', { class: 'an-src' }, T('anCFoot', { r: strip(fmt(R[1].rev, 'money', co)), p: strip(fmt(R[1].prof, 'money', co)), n: v.yrs })));
  };
  for (const [k, label, f] of calcFields(co, D)) {
    const keys = f.keys || [k], row = h('div', { class: 'an-cf' + (f.keys ? ' an-cf3' : '') }), inps = [];
    const sugTxt = () => keys.map((kk) => f.show(D.val[kk])).join(' / ') + (f.unit === '%' ? '%' : ' ' + f.unit);
    const hint = h('span', {}), sync = () => {
      const on = keys.some((kk) => getE(kk) != null);
      row.classList.toggle('ed', on); back.hidden = !on;
      hint.textContent = on ? T(k === 'req' ? 'anCReqPx' : 'anCSug', { v: sugTxt() }) : D.src[f.keys ? 'mult' : k] || '';
      resetBtn.hidden = !anyE();
    };
    const back = h('button', { class: 'an-cback', type: 'button', 'aria-label': T('anCBack'), on: { click: () => {
      keys.forEach((kk, i) => { delE(kk); inps[i].value = f.show(D.val[kk]); }); if (k === 'req') unRet(); sync(); paint(); } } }, '↺');
    keys.forEach((kk, i) => {
      const inp = h('input', { class: 'an-cin', type: 'text', inputmode: 'decimal', dir: 'ltr', value: f.show(getE(kk) ?? D.val[kk]), 'aria-label': f.caps ? label + ' — ' + f.caps[i] : label });
      inp.addEventListener('input', () => {
        const n = parseFloat(inp.value.replace(/[^\d.\-]/g, ''));
        if (!isFinite(n)) return;
        let x = f.read(n);
        if (f.min != null) x = Math.max(f.min, x); if (f.max != null) x = Math.min(f.max, x);
        setE(kk, x); if (kk === 'req') S.px = { k: 'ret' };
        paint(); sync();
      });
      inps.push(inp);
    });
    const field = f.caps ? h('div', { class: 'an-c3' }, ...inps.map((x, i) => h('label', {}, x, h('small', {}, f.caps[i])))) : inps[0];
    row.append(h('div', { class: 'an-cl' }, h('b', {}, label), hint), h('div', { class: 'an-cv' }, back, field, h('span', { class: 'an-cu' }, f.unit)));
    rows.append(row); sync();
  }
  paint();
  const basisSeg = co.reit || co.fin || D.noRev ? null : [segCtl(T('anCBasis'), [['ni', T('anCBNi')], ['fcf', T('anCBFcf')]], D.basis, (b) => { S.calcB = b; render(); }), h('p', { class: 'an-src' }, T('anCBNote'))];
  pg.append(card(h('div', { class: 'an-h2row' }, h('h2', {}, T('anCalc')), resetBtn), sub(T('anCalcSub')), basisSeg, rows), card(h('h2', {}, T('anCResT')), res));
  let mcEl = multCard(co, pg);
  // המחיר זז עם התשואה הרצויה — כרטיס המכפילים ("היום") נבנה מחדש במקום
  S.pxHook = () => { if (!mcEl || !mcEl.isConnected) return; const n = multCard(co, h('div')); if (n) { n.className = mcEl.className; mcEl.replaceWith(n); mcEl = n; } };
}

const MULT_SET = { def: [['pe', 'anLPe'], ['pfcf', 'anLPfcf'], ['ps', 'anLPs'], ['evebit', 'anLEv']], fin: [['pb', 'anLPb'], ['pe', 'anLPe']], reit: [['pffo', 'anLPffo'], ['pb', 'anLPb'], ['ps', 'anLPs']] };
const MULT_HINT = { pe: 'anHPe', pfcf: 'anHPfcf', ps: 'anHPs', evebit: 'anHEv', pb: 'anHPb', pffo: 'anHPffo' };
function multCard(co, pg) {
  const Hh = multHist(co), mc = h('div', { class: 'an-list' });
  for (const [k, n] of MULT_SET[co.fin ? 'fin' : co.reit ? 'reit' : 'def']) {
    const a = Hh[k].filter((x) => x > 0 && x < 300); if (a.length < 6) continue;
    const now = fin(Hh[k]).pop(), mn = Math.min(...a), mx = Math.max(...a), q1 = quant(a, 0.25), q3 = quant(a, 0.75), md = mean(a);
    const P = (v) => ((clamp(v, mn, mx) - mn) / (mx - mn || 1) * 100).toFixed(1) + '%';
    const ce = canEdM(co, k), go = () => medSheet(k);
    mc.append(h('div', { class: 'an-mult' + (ce ? ' tap' : ''), ...(ce ? { role: 'button', tabindex: '0', on: { click: go, keydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } } } } : {}) },
      h('div', { class: 'an-mult-t' }, h('span', { class: 'an-rt' }, h('b', {}, T(n)), h('span', { class: 'an-hint' }, T(MULT_HINT[k]))), h('span', { class: 'an-mv', 'data-dep': DEP(k) }, fmt(now, 'x', co, 1), ce ? penI() : null)),
      h('div', { class: 'an-rbar' }, h('div', { class: 'an-tr' }), h('div', { class: 'an-iq', style: `left:${P(q1)};width:calc(${P(q3)} - ${P(q1)})` }), h('div', { class: 'an-md', style: `left:${P(md)}` }), h('div', { class: 'an-nw', style: `left:${P(now)}` })),
      h('div', { class: 'an-lb' }, h('span', {}, strip(fmt(mn, 'x', co, 1))), h('span', {}, T('anAvg') + ' ' + strip(fmt(md, 'x', co, 1))), h('span', {}, strip(fmt(mx, 'x', co, 1))))));
  }
  if (!mc.children.length) return null;
  const el = mark(card(h('h2', {}, T('anMultHist')), sub(T('anMultHistSub', { n: Math.round(Hh.t.length / 12) })), mc), { hint: T('anHMult') });
  pg.append(el);
  return el;
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
  const x = ctx(c, nowP(c)), mc = pxF(c) && c.sharesOut ? pxF(c) * c.sharesOut : null, [g] = cagrN(c, 'rev', 5);
  const fy = fyList(c), old = fy.length > 3 ? ctx(c, fy[fy.length - 4]).sh : null;
  return { sym: c.sym, g, om: x.om, roic: x.roic, fy: x.fcf != null && mc ? x.fcf / mc : null, pe: x.eps > 0 && pxF(c) ? pxF(c) / x.eps : null, fpe: c.fpe,
    bpe: bpeOf(c), bfpe: bfpeOf(c),
    sh3: old && x.sh ? x.sh / old - 1 : null };
}
async function loadPeers() {
  if (S.peerBusy || !S.co) return;
  S.peerBusy = true;
  const seq = S.seq, want = [...(S.co.peers || []), ...S.peerAdd].filter((x, i, a) => a.indexOf(x) === i && x !== S.sym && !S.peerDrop.has(x));
  const got = await Promise.all(want.map((x) => load(x).then(prepFor).catch(() => null)));
  if (seq !== S.seq) return;
  S.peers = got.filter((c) => c && pxF(c) > 0 && c.sharesOut > 0);
  S.peerBusy = false;
  if (S.tab === 'cmp') render();
}
const CMP_MET = [['g', 'anMGrowth', 'anCagr5', 'pct', 1], ['om', 'anMOm', 'anTtm12', 'pct', 1], ['roic', 'anMRoic', 'anTtm12', 'pct', 1],
  ['fy', 'anMFy', 'anHiCheap', 'pct', 1], ['pe', 'anLPe', 'anLoCheap', 'x', -1], ['fpe', 'anFFpe', 'anCmpFwd', 'x', -1],
  ['bpe', 'anFBpe', 'anLoCheap', 'x', -1], ['bfpe', 'anFBfpe', 'anCmpFwd', 'x', -1], ['sh3', 'anMSh3', 'anMSh3s', 'pct', -1]];
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
  // טבלה אחת: מדד בכל שורה, חברה בכל עמודה (החברה שלך ראשונה ומודגשת). פס קטן מתחת לכל ערך — גודל יחסי בשורה
  const rows = [co, ...list].map(peerRow);
  const t = h('table', { class: 'an-ctbl' }, h('thead', {}, h('tr', {}, h('th', {}), ...rows.map((r, i) => h('th', { class: i ? null : 'me' }, h('bdi', {}, r.sym.replace(/\.TA$/, '')))))),
    h('tbody', {}, ...CMP_MET.map(([k, n, st, u]) => {
      const ok = fin(rows.map((r) => r[k])), mx = Math.max(...ok.map(Math.abs), 1e-9);
      return h('tr', {}, h('th', {}, T(n), h('small', {}, T(st, { n: 5 }))), ...rows.map((r, i) => h('td', { class: i ? null : 'me', 'data-dep': !i && PX_CMP.has(k) ? DEP(k) : null },
        r[k] == null ? '—' : fmt(r[k], u, null, 1), r[k] == null ? null : h('i', { style: `--an-w:${(Math.abs(r[k]) / mx * 100).toFixed(0)}%` }))));
    })));
  pg.append(card(h('h2', {}, T('anCmpTitle')), sub(T(loose ? 'anCmpSubAny' : 'anCmpSub')), chips, h('div', { class: 'an-tblw no-swipe' }, t)));
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
  if (!opt.small) { pushSub(title, build); return; }
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
    h('button', { type: 'button', 'aria-pressed': String(cur === v), disabled: dis ? true : null, on: { click: () => {
      [...s.children].forEach((b, i) => b.setAttribute('aria-pressed', String(opts[i][0] === v)));
      on(v);
    } } }, tt)));
  return h('div', { class: 'an-ctl' }, h('span', {}, label), s);
}
/* הבועה של הגרף בשורת ההסבר: מקום שמור בקצה השורה (גובה לפי מספר הסדרות — שורה לכל אחת + התקופה), והבועה
   צפה בתוכו רק בזמן נגיעה. השורה לא משנה גובה כשהיא מופיעה, וההסבר נשבר לצידה */
function tipBox(k) {
  const tip = h('div', { class: 'an-tip', 'aria-live': 'polite', hidden: true });
  const slot = h('div', { class: 'an-tipslot', style: `min-height:${26 + 19 * k}px` }, tip);
  slot.tip = tip;
  return slot;
}
/* 27/10/2026 (בקשת המשתמש): מדד שאתרים מחשבים בכמה דרכים — שורה גלויה איך הוא מחושב אצלנו ולמה במקום אחר המספר שונה */
const DEF_NOTE = { r40: 'anDnR40', eps: 'anDnEps', fcf: 'anDnFcf', fcfsbc: 'anDnOwn', debt: 'anDnDebt', de: 'anDnDebt', cr: 'anDnCr', roic: 'anDnRoic', roe: 'anDnRoe' };
/* 18/11/2026: בפירוק התזרים — הערה לכל מדד שיש לו (תזרים חופשי וגם מזומן לבעלים) */
const defNote = (keys) => { const n = [...new Set(keys.map((x) => DEF_NOTE[x]).filter(Boolean))]; return n.length ? h('p', { class: 'an-ex an-defn' }, n.map((x) => T(x)).join(' ')) : null; };
function chartSheet(def) {
  const co = S.co;
  if (def.line) {
    openSheet(def.n, (b, rec) => {
      const Hh = multHist(co), a = Hh[def.line[1]], ok = a.filter((x) => x > 0 && x < 300), md = multAvg(ok);
      const host = h('div', { class: 'an-chart no-swipe' }), slot = tipBox(1), tip = slot.tip;
      const stat = (tt, v, d) => h('div', {}, h('span', {}, tt), h('b', { 'data-dep': d ? DEP() : null }, v));
      b.append(h('div', { class: 'an-chead' }, h('p', { class: 'an-ex' }, T(def.line[3])), slot), h('div', { class: 'an-chartw' }, host), h('p', { class: 'an-ex an-defn' }, T('anDnMult')),
        h('div', { class: 'an-stats' }, stat(T('anToday'), fmt(fin(a).pop(), 'x', co, 1), 1), stat(T('anAvg10'), fmt(md, 'x', co, 1)),
          stat(T('anRange'), ok.length ? iso(Math.min(...ok).toFixed(0) + '–' + Math.max(...ok).toFixed(0) + '×') : '—')));
      rec.draw = () => drawChart(host, { labels: Hh.t.map((x) => (x.slice(5) === '01' ? x.slice(0, 4) : '')), tipLabels: Hh.t.map((x) => x.slice(5) + '/' + x.slice(0, 4)),
        series: [{ name: def.n, color: cssv(def.line[2]), vals: a.map((x) => (x > 0 && x < 300 ? x : null)) }], unit: 'x', co, h: 260, line: true, avg: md, avgName: T('anAvg'), tipHost: tip, title: def.n });
    });
    return;
  }
  const long = co.years.length > 6;
  const st = { mode: 'fy', range: long ? '10' : 'all', view: 'v', hide: new Set() };
  const ratio = def.s.every((k) => M[k].ratio), noPct = def.s.some((k) => M[k].noPct || M[k].ratio), noG = def.s.length > 1 && def.s.some((k) => M[k].f);
  openSheet(def.n, (b, rec) => {
    const host = h('div', { class: 'an-chart no-swipe' }), slot = tipBox(def.s.length), tip = slot.tip, stats = h('div', { class: 'an-stats' }), tbl = h('div', { class: 'an-tblw', hidden: true });
    const chartW = h('div', { class: 'an-chartw' }, host);
    const q = def.s.length === 1 && M[def.s[0]].q;
    const chips = def.s.length > 1 ? h('div', { class: 'an-chips' }, ...def.s.map((k) => h('button', { class: 'an-chip', type: 'button', 'aria-pressed': 'true', on: { click: (e) => {
        if (st.hide.has(k)) st.hide.delete(k); else if (st.hide.size < def.s.length - 1) st.hide.add(k); else return;
        e.currentTarget.setAttribute('aria-pressed', String(!st.hide.has(k))); draw(); } } }, h('i', { style: `background:${cssv(M[k].c)}` }), T(M[k].n)))) : null;
    // השורה שמעל הגרף: ההסבר (או שבבי הסדרות) ולצידם המקום של הבועה
    b.append(...[h('div', { class: 'an-chead' }, chips || (q ? h('p', { class: 'an-ex' }, T(q)) : h('span')), slot),
      chartW, tbl, stats, defNote(def.s), restNote(co, def.s),
      long ? segCtl(T('anCRange'), [['5', T('anC5')], ['10', T('anC10')], ['all', T('anCAll')]], st.range, (v) => { st.range = v; draw(); }) : null,
      ratio ? null : segCtl(T('anCView'), [['v', T('anCVal')], ['g', T('anCGrowth'), noG], ['r', T('anCPctRev'), noPct]], 'v', (v) => { st.view = v; draw(); }),
      segCtl(T('anCPeriod'), [['fy', T('anCAnnual')], ['q', T('anCQuarter')]], 'fy', (v) => { st.mode = v; draw(); }),
      segCtl(T('anCShow'), [['c', T('anCChart')], ['t', T('anCTable')]], 'c', (v) => { chartW.hidden = v === 't'; tbl.hidden = v !== 't'; }),
      srcBlock(co, def.s),
    ].filter(Boolean));
    const e0 = emptyOf(def, seriesFor(co, def, { mode: 'fy', range: 'all', view: 'v', hide: new Set() }).series);
    if (e0) { b.textContent = ''; b.append(...[emptyBlock(e0), srcBlock(co, def.s)].filter(Boolean)); return; }
    function draw() {
      const d = seriesFor(co, def, st), one = d.series.length === 1 ? d.series[0].vals : null, avg = one ? mean(one) : null;
      drawChart(host, { ...d, co, h: 240, avg, tipHost: tip, title: def.n });
      stats.textContent = ''; stats.hidden = !one;
      if (one) {
        const fyv = d.per.map((p, i) => [p, one[i]]).filter(([p, v]) => p.kind !== 'ttm' && v != null);
        const n = fyv.length > 1 ? (st.mode === 'q' ? (fyv.length - 1) / 4 : fyv.length - 1) : 0;
        const fyp = fyv.map(([p]) => p), cK = def.s[0];
        const g = st.view === 'v' && !M[cK].ratio && n ? (st.mode === 'fy' && !M[cK].f ? cagrBetween(co, cK, fyp, 0, fyp.length - 1) : cagr(fyv[0][1], fyv[fyv.length - 1][1], n)) : null;
        const stat = (tt, v) => h('div', {}, h('span', {}, tt), h('b', {}, v));
        stats.append(stat(T('anAvg'), fmt(avg, d.unit, co)), stat(T('anGrowthYr'), g == null ? '—' : sgn(g)), stat(T('anLast'), fmt(one[one.length - 1], d.unit, co)));
      }
      // טבלה לאורך (26/10/2026): שורה לכל תקופה, מהחדשה לישנה, ועמודה לכל סדרה — בלי גלילה הצידה
      // (עד היום שנה לכל עמודה: גלילה אופקית בתוך גלילה אנכית, והטבלה נפתחה דווקא בשנים הישנות)
      tbl.textContent = '';
      const t = h('table', { class: 'an-tbl an-vtbl' }), idx = d.labels.map((_, i) => i).reverse();
      t.append(h('thead', {}, h('tr', {}, h('th', {}), ...d.series.map((s) => h('th', { dir: 'auto' }, s.name)))),
        h('tbody', {}, ...idx.map((i) => h('tr', {}, h('th', { scope: 'row' }, d.labels[i]), ...d.series.map((s) => h('td', {}, strip(fmt(s.vals[i], d.unit, co))))))));
      tbl.append(t);
    }
    rec.draw = draw;
  });
}
// שנים שהוצגו מחדש (בגרף זה): מאיזו שנה המספרים לפי הדוח המעודכן, ואיך מחושבת הצמיחה
function restNote(co, keys) {
  const r = restated(co, keys.flatMap((k) => RAWK[k] || [k]));
  return r.length ? h('p', { class: 'an-ex an-rest' }, T('anRestated', { y: co.years[r[r.length - 1]] })) : null;
}
/* ---------- שכבה 6 (25/10/2026): מאיפה כל מספר ----------
   לכל מדד: השורה בדוח (התגית שהחברה עצמה מציגה — co.tags) או איך הוא מחושב; הדוח ב־SEC וכמה ערכים נבדקו מולו (co.face);
   ושנים שהבדיקות סימנו (co.flags). רק מה שכבר בתשובה — בלי פנייה לרשת */
const RAWK = { rev: ['rev'], gp: ['gp', 'cogs'], op: ['op'], ni: ['ni'], eps: ['eps'], sh: ['sh'], ocf: ['ocf'], buy: ['buy'], dps: ['dps', 'divp'], eq: ['eq'], ta: ['ta'], tl: ['tl'],
  cashT: ['cash', 'msec'], debt: ['debt', 'debtNc', 'debtC', 'stb'], capexN: ['capex'], sbcN: ['sbc'], fcf: ['ocf', 'capex'], fcfsbc: ['ocf', 'capex', 'sbc'],
  gm: ['gp', 'rev'], om: ['op', 'rev'], nm: ['ni', 'rev'], cr: ['ca', 'cl'], de: ['debt', 'eq'], roe: ['ni', 'eq'], roic: ['op', 'eq', 'debt', 'cash'], r40: ['rev', 'op'] };
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
const FL_INFO = new Set(['fix', 'ffill', 'ffix', 'rst', 'qeps', 'qmix', 'qfy', 'gpfin', 'qsh', 'xbrl', 'cx0']);
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
  const fixed = co.flags.some((x) => x.k === 'fix' && x.m && raw.has(x.m));
  const fromRep = (kk) => [...new Set(co.flags.filter((x) => x.k === kk && x.m && raw.has(x.m)).map((x) => x.p.slice(0, 4)))].sort();
  if (fixed) rows.push(h('div', { class: 'an-row' }, h('span', { class: 'an-ic y' }, '✓'), h('div', { class: 'an-rt' }, h('b', {}, T('anFlFix')))));
  for (const [kk, lb] of [['ffill', 'anFlFill'], ['ffix', 'anFlFfix'], ['qeps', 'anFlQeps'], ['qmix', 'anFlQmix'], ['qfy', 'anFlQfy'], ['cx0', 'anFlCx0'], ['gpfin', 'anFlGpfin']]) {
    const ys = fromRep(kk);
    if (ys.length) rows.push(h('div', { class: 'an-row' }, h('span', { class: 'an-ic y' }, '✓'), h('div', { class: 'an-rt' }, h('b', {}, T(lb)), h('span', {}, iso(ys.join(', '))))));
  }
  if (co.derived && keys.some((k) => (RAWK[k] || [k]).some((x) => (co.derived[x] || []).length))) rows.push(h('div', { class: 'an-row' }, h('div', { class: 'an-rt' }, h('span', {}, T('anSrcQ4')))));
  return h('details', { class: 'an-prov' }, h('summary', {}, T('anSrcT'), h('span', { class: 'an-chev' })), h('div', { class: 'an-list' }, ...rows));
}
function checkSheet(k) {
  const C = checks(S.co, MAC)[k];
  openSheet(C.n, (b) => {
    b.append(h('p', { class: 'an-ex' }, T('anChkSub')));
    b.append(h('div', { class: 'an-list' }, ...C.chk.map((x) => h('div', { class: 'an-row an-row-x' },
      h('div', { class: 'an-rt' }, h('b', {}, x.q), h('span', {}, x.thr), x.ex ? h('span', { class: 'an-hint' }, x.ex) : null), h('div', { class: 'an-rv', 'data-dep': x.d ? DEP() : null }, x.v)))));
  });
}
function factSheet(key) {
  if (key === 'bpe' || key === 'bfpe') { bufSheet(key); return; }
  const co = S.co, c = ctx(co, nowP(co));
  const X = { mcap: [T('anFMcap'), T('anXMcap', { s: strip(fmt(co.sharesOut, 'shares', co)) })],
    pe: [T('anFPe'), T('anXPeF', { e: strip(fmt(c.eps, 'ps', co)) })],
    fpe: [T('anFFpe'), T(isAdj(co) ? 'anXFpeAdj' : 'anXFpe')],
    fy: [T('anFFy'), T('anXFy', { f: strip(fmt(c.fcf, 'money', co)) })],
    nc: [c.netcash >= 0 ? T('anNetCash') : T('anNetDebt'), T(c.netcash >= 0 ? 'anXNc' : 'anXNd', { c: strip(fmt(c.cashT, 'money', co)), d: strip(fmt(c.debt, 'money', co)) })] }[key];
  openSheet(X[0], (b, rec) => { b.append(h('p', { class: 'an-ex an-ex-lg' }, X[1])); if (MED[key]) medForm(b, key, rec); }, { small: true });
}
/* מכפיל באפט — החישוב שורה אחר שורה, ומאיפה בא כל מספר (ההודעות לעיתונות, הדוחות, האנליסטים) */
function bufSheet(key) {
  const co = S.co, b = bufEps(co), fwd = key === 'bfpe', px = pxF(co), yr = b && b.f && b.f.end ? String(b.f.end).slice(0, 4) : '';
  openSheet(T(fwd ? 'anFBfpe' : 'anFBpe'), (bd, rec) => {
    bd.append(h('p', { class: 'an-ex an-ex-lg' }, T(fwd ? 'anXBfpe' : 'anXBpe')));
    if (!b || (fwd && !b.f)) { bd.append(h('p', { class: 'an-ex' }, T('anXBufNone'))); return; }
    const ps = (v) => fmt(v, 'ps', co), tx = pct(fwd ? b.f.t ?? b.t : b.t, 0), eps = fwd ? b.f.eps : b.eps, ded = fwd ? b.f.ded : b.ded;
    const row = (tt, s, v, strong) => h('div', { class: 'an-row' }, h('div', { class: 'an-rt' }, h('b', {}, tt), s ? h('span', {}, s) : null),
      h('div', { class: 'an-rv', style: strong ? 'font-weight:800' : null }, v));
    const rows = fwd
      ? [row(yr ? T('anBFwd', { y: yr }) : T('anBFwd0'), b.f.n ? T('anNAnalysts', { n: b.f.n }) : T('anBFwdY'), ps(b.f.base)),
        row(T('anBSbcF'), ded > 0 && b.f.rate != null ? T('anBSbcFS', { r: strip(pct(b.f.rate)), t: strip(tx) }) : null, ps(-ded))]
      : [row(T('anBStreet'), T('anBStreetS'), ps(b.st)), row(T('anBSbc'), ded > 0 ? T({ reit: 'anBSbcSR', tb: 'anBSbcSB', pr: 'anBSbcSP', d: 'anBSbcSD' }[b.ts] || 'anBSbcS', { t: strip(tx) }) : null, ps(-ded))];
    rows.push(row(T('anBEps'), null, ps(eps), true),
      row(T(fwd ? 'anFBfpe' : 'anFBpe'), px ? T('anBMultS', { p: strip(ps(px)) }) : null, eps > 0 && px ? fmt(px / eps, 'x', co, 1) : T('anBNeg'), true));
    if (!fwd) rows.push(row(T('anBGaap'), T('anBGaapS'), ps(b.g)));
    bd.append(h('div', { class: 'an-list' }, ...rows));
    const same = Math.abs(b.gap) <= 0.02 * Math.max(Math.abs(b.st), 0.05);
    const note = fwd && b.f.chg ? 'anBFutIn' : same ? 'anBPolGaap' : { ex: 'anBPolEx', in: 'anBPolIn', mix: 'anBPolMix' }[b.pol] || 'anBPolUnk';
    bd.append(h('p', { class: 'an-ex' }, T(note)));
    if (!fwd && b.oth && b.ded > 0) bd.append(h('p', { class: 'an-ex' }, T('anBOth')));
    if (MED[key] && canEdM(co, key)) medForm(bd, key, rec);
  }, { small: true });
}
function estSheet() {
  const co = S.co;
  openSheet(T('anEstTitle'), (b) => {
    const est = co.est || [], e0 = est.find((e) => e.p === '0y'), e1 = est.find((e) => e.p === '+1y');
    const er = (e, key) => h('div', { class: 'an-row' }, h('div', { class: 'an-rt' }, h('b', {}, T(key)), h('span', {}, T('anEstS', { n: e.n || '?', r: strip(fmt(e.rev, 'money', co)) }))),
      h('div', { class: 'an-rv' }, fmt(e.eps, 'ps', co), e.g != null ? h('small', { class: e.g >= 0 ? 'an-up' : 'an-down' }, sgn(e.g)) : null));
    const near = [e0 && e0.eps ? er(e0, 'anEst0') : null, e1 && e1.eps ? er(e1, 'anEst1') : null].filter(Boolean);
    if (near.length) b.append(h('div', { class: 'an-list' }, ...near));
    if (!(co.nq && co.nq.length)) return;
    const fy0 = co.years[co.years.length - 1], eps = co.A.eps || [], base = eps[eps.length - 1];
    let prev = base;
    const rows = [[T('anActual', { y: fy0 }), base, null, null]].concat(co.nq.map((r) => { const g = prev ? r.eps / prev - 1 : null; prev = r.eps; return [String(r.fy).slice(-4), r.eps, g, r.n]; }));
    b.append(h('p', { class: 'an-ex' }, T('anEstEx')), h('div', { class: 'an-list' }, ...rows.map(([y, e, g, n]) => h('div', { class: 'an-row' },
      h('div', { class: 'an-rt' }, h('b', {}, String(y)), h('span', {}, n ? T('anNAnalysts', { n }) : T('anAnnualRep'))),
      h('div', { class: 'an-rv' }, fmt(e, 'ps', co), g != null ? h('small', { class: g >= 0 ? 'an-up' : 'an-down' }, sgn(g)) : null)))));
  });
}

/* בדיקות (node) — הפונקציות הטהורות */
export const _test = { bufCalc, bufEps, bpeOf, bfpeOf, sbcPol, sbcRel, bufTau, sbcAmt, isAdj, r40Of, multAvg, calcDefaults, calcRun, calcMults, irr, estGrowth, qRun, qBack, ttmPoints, cmpPrev, restated, cagrBetween, growthOf, finInputs, riValue, impliedRoe, reitInputs, lossView, fairOf, flagsAt, srcDef, rawName, RAWK, OWN_TAG, prep, indFix, pickPeers, peerRow, ctx, periodList, hasTTM, raw, multHist, autoInputs, dcf, scenarios, reverseG, multModel, uncertainty, checks, piotroski, altman, fmt, sgn, cagrN, epsPath, setPx, real, pxReal, MED, metNow, pxFrom, canEdM, medTxt, medVal, medHist,
  setEnv: (e) => { E = e; } };
