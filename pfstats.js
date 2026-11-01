/* pfstats.js — מנוע "ניתוח התיק" (גל 1 במחקר-שדרוג-Invest.md). טהור: בלי DOM, בלי רשת.
   קלטים — מה שכבר יש באפליקציה:
   - סדרת מדד TWR: [{date:'YYYY-MM-DD', value}] (rCombinedTwrSeries ב־returns.js)
   - תזרימי XIRR: [{d, amt}] — שלילי = כסף שנכנס לתיק (הפקדה), חיובי = יצא; האחרון = השווי היום (rXirrFlows)
   - היסטוריית מדד: [{date, close}] (getBenchHist)
   כל אחוז מוחזר כשבר עשרוני (0.184 = 18.4%), חוץ מ־Ulcer שהוא באחוזים לפי ההגדרה. */

const PS_YEAR_DAYS = 365.25;
const PS_TRADING_DAYS = 252;

function psFin(v) { return typeof v === 'number' && isFinite(v); }
function psDayNum(iso) {
  const p = String(iso).split('-');
  return Math.round(Date.UTC(+p[0], +p[1] - 1, +p[2]) / 86400000);
}
function psClean(rows) {
  return (rows || []).filter((r) => r && /^\d{4}-\d{2}-\d{2}$/.test(r.date || '') && psFin(Number(r.value)) && Number(r.value) > 0)
    .map((r) => ({ date: r.date, value: Number(r.value) }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/* הקטע היומי האחרון: rCombinedTwrSeries מחבר נקודות תקופה (חודשיות/שנתיות) לפני ה־NAV
   היומי. מדדי סיכון יומיים נכונים רק על הקטע הרציף — רווח של יותר מ־maxGap ימים חותך. */
function psDailySegment(rows, maxGap) {
  const r = psClean(rows), g = maxGap || 7;
  let start = 0;
  for (let i = 1; i < r.length; i++) if (psDayNum(r[i].date) - psDayNum(r[i - 1].date) > g) start = i;
  return r.slice(start);
}

/* חלון של N שנים שמסתיים בתאריך האחרון (null/0 = הכל) */
function psWindow(rows, years) {
  const r = psClean(rows);
  if (!years || !r.length) return r;
  const end = psDayNum(r[r.length - 1].date), from = end - Math.round(years * PS_YEAR_DAYS);
  return r.filter((x) => psDayNum(x.date) >= from);
}

function psReturns(rows) {
  const r = psClean(rows), out = [];
  for (let i = 1; i < r.length; i++) out.push({ date: r[i].date, r: r[i].value / r[i - 1].value - 1 });
  return out;
}

/* תשואה שנתית מסדרת מדד (CAGR לפי ימים קלנדריים) */
function psCagr(rows) {
  const r = psClean(rows);
  if (r.length < 2) return null;
  const days = psDayNum(r[r.length - 1].date) - psDayNum(r[0].date);
  if (days < 1) return null;
  return Math.pow(r[r.length - 1].value / r[0].value, PS_YEAR_DAYS / days) - 1;
}

function psMean(a) { return a.reduce((s, x) => s + x, 0) / a.length; }
function psStd(a) {
  if (a.length < 2) return null;
  const m = psMean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / (a.length - 1));
}
function psQuantile(sorted, q) {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/* ירידה מהשיא: הסדרה מתחת לשיא, הירידה הגדולה, תאריכי שיא/שפל/חזרה ו־Ulcer */
function psDrawdown(rows) {
  const r = psClean(rows);
  if (r.length < 2) return null;
  let peak = r[0].value, peakDate = r[0].date;
  let mdd = 0, mPeak = r[0].date, mTrough = r[0].date;
  const under = [];
  let sq = 0;
  for (const x of r) {
    if (x.value >= peak) { peak = x.value; peakDate = x.date; }
    const dd = x.value / peak - 1;
    under.push({ date: x.date, dd: dd });
    sq += (dd * 100) * (dd * 100);
    if (dd < mdd) { mdd = dd; mPeak = peakDate; mTrough = x.date; }
  }
  // חזרה לשיא: היום הראשון אחרי השפל שבו הערך הגיע לשיא שלפני הירידה
  let recover = null;
  if (mdd < 0) {
    const peakVal = r.find((x) => x.date === mPeak).value;
    for (const x of r) if (x.date > mTrough && x.value >= peakVal) { recover = x.date; break; }
  }
  return {
    mdd: mdd, peak: mPeak, trough: mTrough, recover: recover,
    // ימים מהשיא עד החזרה (או עד היום, אם עוד לא חזר)
    days: mdd < 0 ? psDayNum(recover || r[r.length - 1].date) - psDayNum(mPeak) : 0,
    ulcer: Math.sqrt(sq / r.length),
    under: under,
  };
}

/* כרטיס הסיכון. opts.rf = ריבית שנתית חסרת סיכון (שבר), opts.mar = תשואת מינימום יומית ל־Sortino (ברירת מחדל rf יומי) */
function psRisk(rows, opts) {
  const o = opts || {};
  const r = psClean(rows);
  const rets = psReturns(r).map((x) => x.r);
  if (rets.length < 20) return null;
  const rf = psFin(o.rf) ? o.rf : 0;
  const rfDay = Math.pow(1 + rf, 1 / PS_TRADING_DAYS) - 1;
  const mar = psFin(o.mar) ? o.mar : rfDay;
  const sd = psStd(rets);
  const vol = sd * Math.sqrt(PS_TRADING_DAYS);
  const cagr = psCagr(r);
  // Sharpe לפי תשואה עודפת ממוצעת יומית (המקובל), בשנתי
  const ex = rets.map((x) => x - rfDay);
  const sharpe = sd > 0 ? psMean(ex) / sd * Math.sqrt(PS_TRADING_DAYS) : null;
  // Sortino: סטיית הצד מטה — ממוצע על כל התצפיות (לא רק השליליות)
  const dd2 = rets.reduce((s, x) => s + Math.pow(Math.min(0, x - mar), 2), 0) / rets.length;
  const downDev = Math.sqrt(dd2) * Math.sqrt(PS_TRADING_DAYS);
  const sortino = downDev > 0 ? (psMean(rets) - mar) * PS_TRADING_DAYS / downDev : null;
  const sorted = rets.slice().sort((a, b) => a - b);
  const var95 = psQuantile(sorted, 0.05);
  const tail = sorted.filter((x) => x <= var95);
  const dd = psDrawdown(r);
  const martin = dd && dd.ulcer > 0 && psFin(cagr) ? ((cagr - rf) * 100) / dd.ulcer : null;
  return {
    n: rets.length, from: r[0].date, to: r[r.length - 1].date,
    cagr: cagr, vol: vol, sharpe: sharpe, sortino: sortino, downDev: downDev,
    var95: var95, cvar95: tail.length ? psMean(tail) : null,
    best: sorted[sorted.length - 1], worst: sorted[0],
    mdd: dd.mdd, mddPeak: dd.peak, mddTrough: dd.trough, mddRecover: dd.recover, mddDays: dd.days,
    ulcer: dd.ulcer, martin: martin,
  };
}

/* סגירה ביום נתון או ביום המסחר הקודם; hist = [{date, close}] ממוין */
function psCloseOn(hist, iso) {
  let lo = 0, hi = hist.length - 1, ans = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (hist[mid].date <= iso) { ans = hist[mid].close; lo = mid + 1; } else hi = mid - 1;
  }
  return ans;
}
function psHist(hist) {
  return (hist || []).filter((h) => h && /^\d{4}-\d{2}-\d{2}$/.test(h.date || '') && Number(h.close) > 0)
    .map((h) => ({ date: h.date, close: Number(h.close) }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/* המדד באותם תאריכים כמו התיק — סדרת {date,value} שמתאימה ל־psRisk */
function psBenchRows(rows, hist) {
  const h = psHist(hist), out = [];
  if (!h.length) return [];
  for (const x of psClean(rows)) {
    if (x.date < h[0].date) continue;
    const c = psCloseOn(h, x.date);
    if (c > 0) out.push({ date: x.date, value: c });
  }
  return out;
}

/* בטא ומתאם מול המדד, על תשואות שבועיות (שעות מסחר שונות בין ת״א לניו יורק
   מעוותות בטא יומית כלפי מטה). מחזיר גם טווח 95% מטעות התקן. */
function psBeta(rows, hist) {
  const r = psClean(rows), h = psHist(hist);
  if (r.length < 30 || h.length < 30) return null;
  // ערך אחרון בכל שבוע (שבוע = יום שני עד ראשון)
  const wk = new Map();
  for (const x of r) {
    const c = psCloseOn(h, x.date);
    if (!(c > 0) || x.date < h[0].date) continue;
    wk.set(Math.floor((psDayNum(x.date) + 3) / 7), { p: x.value, b: c });
  }
  const pts = [...wk.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1]);
  const xs = [], ys = [];
  for (let i = 1; i < pts.length; i++) {
    xs.push(pts[i].b / pts[i - 1].b - 1);
    ys.push(pts[i].p / pts[i - 1].p - 1);
  }
  const n = xs.length;
  if (n < 12) return null;
  const mx = psMean(xs), my = psMean(ys);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) * (xs[i] - mx); syy += (ys[i] - my) * (ys[i] - my);
  }
  if (!(sxx > 0) || !(syy > 0)) return null;
  const beta = sxy / sxx, corr = sxy / Math.sqrt(sxx * syy);
  const se = Math.sqrt(Math.max(0, 1 - corr * corr) / Math.max(1, n - 2)) * Math.sqrt(syy / sxx);
  return { beta: beta, corr: corr, lo: beta - 1.96 * se, hi: beta + 1.96 * se, n: n };
}

/* "אילו כל הפקדה הלכה למדד באותו יום" (PME).
   flows: מוסכמת XIRR — הראשון/השליליים = כסף שנכנס, חיוביים לפני האחרון = משיכות, האחרון = השווי היום.
   מחזיר: index — שווי המדד עם אותם תזרימים (LN-PME, יכול לצאת שלילי אחרי משיכות גדולות),
   ks — יחס Kaplan-Schoar (מעל 1 = התיק ניצח), plus — λ של PME+ (המשיכות מוקטנות כך שהמדד מסתיים בשווי התיק),
   curve — שווי המדד לאורך זמן לגרף. */
function psPme(flows, hist, nowDate) {
  const h = psHist(hist);
  const f = (flows || []).filter((x) => x && /^\d{4}-\d{2}-\d{2}/.test(x.d || '') && psFin(Number(x.amt)) && Number(x.amt) !== 0)
    .map((x) => ({ d: String(x.d).slice(0, 10), amt: Number(x.amt) }))
    .sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
  if (f.length < 2 || !h.length) return null;
  const last = f[f.length - 1];
  if (!(last.amt > 0)) return null;
  const end = nowDate || last.d;
  const nav = last.amt;
  const body = f.slice(0, -1);
  if (body[0].d < h[0].date) return null; // אין היסטוריית מדד מתחילת התיק — לא ממציאים
  const iT = psCloseOn(h, end);
  if (!(iT > 0)) return null;
  let callFV = 0, distFV = 0, contributed = 0, withdrawn = 0;
  for (const x of body) {
    const iS = psCloseOn(h, x.d);
    if (!(iS > 0)) return null;
    if (x.amt < 0) { callFV += -x.amt * iT / iS; contributed += -x.amt; }
    else { distFV += x.amt * iT / iS; withdrawn += x.amt; }
  }
  if (!(callFV > 0)) return null;
  const index = callFV - distFV;
  const ks = (distFV + nav) / callFV;
  const plus = distFV > 0 ? (callFV - nav) / distFV : null;
  // עקומה: שווי "התיק במדד" בכל נקודה במדד (יחידות מדד שנקנו פחות שנמכרו)
  const curve = [];
  let units = 0, k = 0;
  for (const p of h) {
    if (p.date < body[0].d || p.date > end) continue;
    while (k < body.length && body[k].d <= p.date) {
      const iS = psCloseOn(h, body[k].d);
      units += (-body[k].amt) / iS;
      k++;
    }
    curve.push({ date: p.date, value: units * p.close });
  }
  return { nav: nav, index: index, diff: nav - index, ks: ks, plus: plus,
    contributed: contributed, withdrawn: withdrawn, from: body[0].d, to: end, curve: curve };
}

/* ציון התזמון: XIRR (התשואה שלך בפועל) פחות TWR שנתי (תשואת התיק).
   חיובי = הכסף נכנס בזמנים טובים מהממוצע. פירוק לפי הפקדה: כמה כל הפקדה צמחה
   מאז שנכנסה, בשנתי, מול ה־TWR השנתי של כל התקופה, משוקלל במשקל ההפקדה. */
function psTiming(xirrPct, twrRows, flows) {
  const r = psClean(twrRows);
  const twrA = psCagr(r);
  const xirr = psFin(xirrPct) ? xirrPct / 100 : null;
  if (!psFin(twrA) || !psFin(xirr)) return null;
  const out = { twr: twrA, xirr: xirr, gap: xirr - twrA, items: [] };
  const f = (flows || []).slice(0, -1).filter((x) => x && Number(x.amt) < 0);
  if (r.length < 2 || !f.length) return out;
  const endV = r[r.length - 1].value, endD = psDayNum(r[r.length - 1].date);
  const valOn = (iso) => {
    let ans = null;
    for (const x of r) { if (x.date <= iso) ans = x.value; else break; }
    return ans;
  };
  const total = f.reduce((s, x) => s - Number(x.amt), 0);
  for (const x of f) {
    const d = String(x.d).slice(0, 10), v0 = valOn(d);
    const days = endD - psDayNum(d);
    if (!(v0 > 0) || days < 30) continue;
    const ann = Math.pow(endV / v0, PS_YEAR_DAYS / days) - 1;
    const w = -Number(x.amt) / total;
    out.items.push({ d: d, amt: -Number(x.amt), annual: ann, edge: ann - twrA, weight: w, score: (ann - twrA) * w });
  }
  out.items.sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
  return out;
}

/* איזון דרך הפקדה — בלי מכירות. holdings: [{key, value, price?}] באותו מטבע של cash;
   targets: {key: משקל} (מנורמל לסכום 1); opts.minTrade — קנייה קטנה מזה מדולגת;
   opts.whole — רק יחידות שלמות (לפי price). "מילוי מים": מעלים את הנכסים הכי
   מתחת ליעד עד שנגמר הכסף, כך שהסטייה המקסימלית יורדת כמה שאפשר. */
function psRebalance(holdings, targets, cash, opts) {
  const o = opts || {};
  const tsum = Object.values(targets || {}).reduce((s, w) => s + (Number(w) > 0 ? Number(w) : 0), 0);
  if (!(tsum > 0) || !(cash > 0)) return null;
  const keys = [...new Set([...Object.keys(targets), ...(holdings || []).map((h) => h.key)])];
  const val = {}, price = {};
  for (const k of keys) { val[k] = 0; }
  for (const h of (holdings || [])) { val[h.key] += Number(h.value) || 0; if (Number(h.price) > 0) price[h.key] = Number(h.price); }
  const w = {};
  for (const k of keys) w[k] = (Number(targets[k]) > 0 ? Number(targets[k]) : 0) / tsum;
  const before = Object.values(val).reduce((s, v) => s + v, 0);
  const T = before + cash;
  // חוסר לכל נכס ביחס ליעד בשווי הסופי
  const need = {};
  for (const k of keys) need[k] = Math.max(0, w[k] * T - val[k]);
  const needSum = Object.values(need).reduce((s, v) => s + v, 0);
  let buy = {};
  if (needSum <= cash) buy = Object.assign({}, need);
  else {
    // מילוי מים: מוצאים רמה L כך ש־Σ max(0, w_k·L − val_k) = cash (חיפוש בינארי על L)
    let lo = 0, hi = T;
    for (let i = 0; i < 100; i++) {
      const L = (lo + hi) / 2;
      const s = keys.reduce((a, k) => a + Math.max(0, w[k] * L - val[k]), 0);
      if (s > cash) hi = L; else lo = L;
    }
    for (const k of keys) buy[k] = Math.max(0, w[k] * lo - val[k]);
  }
  const lines = [];
  let spent = 0;
  for (const k of keys) {
    let amt = buy[k];
    if (!(amt > 0)) continue;
    let units = null;
    if (o.whole && price[k] > 0) { units = Math.floor(amt / price[k] + 1e-9); amt = units * price[k]; }
    if (!(amt > 0) || (o.minTrade && amt < o.minTrade)) continue;
    lines.push({ key: k, amount: amt, units: units });
    spent += amt;
  }
  lines.sort((a, b) => b.amount - a.amount);
  const after = Object.assign({}, val);
  for (const l of lines) after[l.key] += l.amount;
  const totAfter = before + spent;
  const wb = {}, wa = {};
  let devB = 0, devA = 0;
  for (const k of keys) {
    wb[k] = before > 0 ? val[k] / before : 0;
    wa[k] = totAfter > 0 ? after[k] / totAfter : 0;
    devB = Math.max(devB, Math.abs(wb[k] - w[k]));
    devA = Math.max(devA, Math.abs(wa[k] - w[k]));
  }
  return { lines: lines, spent: spent, leftover: cash - spent, before: wb, after: wa, target: w, maxDevBefore: devB, maxDevAfter: devA };
}

/* כלל 5/25: חריגה = סטייה של 5 נקודות או 25% מהיעד (המוקדם מביניהם) */
function psDrift(weights, targets) {
  const out = [];
  for (const k of Object.keys(targets || {})) {
    const t = Number(targets[k]) || 0, c = Number((weights || {})[k]) || 0;
    const dev = c - t;
    const lim = Math.min(0.05, t * 0.25);
    out.push({ key: k, cur: c, target: t, dev: dev, over: t > 0 ? Math.abs(dev) > lim + 1e-12 : c > 0 });
  }
  return out.sort((a, b) => Math.abs(b.dev) - Math.abs(a.dev));
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    psDailySegment, psWindow, psReturns, psCagr, psDrawdown, psRisk, psBenchRows, psBeta,
    psPme, psTiming, psRebalance, psDrift, psCloseOn,
  };
}
