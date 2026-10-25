/* נתוני דוחות כספיים לניתוח חברה (25/10/2026) — שכבת הנתונים של מסך "ניתוח" ב־Invest.
   מקור אמת: SEC EDGAR (companyfacts, XBRL) — חינם, רשמי, ומותר להציג אותו לאחרים.
   גיבוי ומניות ת״א: Yahoo fundamentals-timeseries (4 שנים, עם חורים). פרופיל ואומדנים: Yahoo quoteSummary.
   תחזיות רווח רב־שנתיות לארה״ב: Nasdaq (Zacks). ריבית: FRED (DGS10). ענפים: Damodaran (lib/damodaran.json).
   הכל מידע שוק ציבורי — אף נתון של המשתמש לא עובר כאן.

   הכללים (מהמחקר, והם הסיבה לרוב הקוד):
   1. fy/fp ב־companyfacts הם של הדוח שבו העובדה הוגשה, לא של התקופה — מסווגים רק לפי start/end.
   2. אותה תקופה מופיעה בכמה דוחות — לוקחים את מה שהוגש אחרון (כולל תיקונים לאחור).
   3. תגיות מתחלפות (Revenues → RevenueFromContract…) — רשימת עדיפויות, תגית מאוחרת משלימה רק תקופות חסרות,
      ורק כשהיא מסכימה עם מה שכבר נבחר בתקופות המשותפות (mergeTags). בלי זה ערבוב של ברוטו ונטו (Mastercard) יצר +74%.
   4. תזרים ב־10-Q מצטבר מתחילת השנה — רבעון = מצטבר פחות המצטבר הקודם; רבעון 4 = שנה פחות 9 חודשים.
   5. ערכים למניה כפי שדווחו — לפני פיצולים. מתקנים לפי אירועי הפיצול מ־Yahoo וקפיצה במספר המניות.
   6. כל ספק מקבל תג בדיקה (checks), לא תיקון שקט. */
const UA = 'Mozilla/5.0 (compatible; portfolio-pwa/1.0)';
const SEC_UA = () => process.env.SEC_UA || 'TheSnowball/1.0 data@thesnowball.app'; // SEC דורש מזהה עם כתובת
const DMD = require('./damodaran.json');

/* ---------- מטמון בזיכרון (מופע חם) ---------- */
const cache = new Map();
function cget(k, ttl) { const h = cache.get(k); return h && Date.now() - h.at < ttl ? h.v : null; }
function cset(k, v) { cache.set(k, { at: Date.now(), v }); if (cache.size > 300) cache.delete(cache.keys().next().value); return v; }
const H = 3600e3;

async function getJson(url, opts = {}, ms = 9000) {
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { ...opts, signal: ctl.signal });
    if (r.status !== 200) { const e = new Error('http_' + r.status); e.status = r.status; throw e; }
    return await r.json();
  } finally { clearTimeout(to); }
}
async function getText(url, opts = {}, ms = 9000) {
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(url, { ...opts, signal: ctl.signal }); if (r.status !== 200) throw new Error('http_' + r.status); return await r.text(); }
  finally { clearTimeout(to); }
}

/* ---------- SEC: מיפוי תגיות (סדר = עדיפות) ---------- */
const FLOW = {
  rev: ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet', 'RevenueFromContractWithCustomerIncludingAssessedTax', 'SalesRevenueGoodsNet'],
  cogs: ['CostOfRevenue', 'CostOfGoodsAndServicesSold', 'CostOfGoodsSold', 'CostOfServices'],
  gp: ['GrossProfit'],
  op: ['OperatingIncomeLoss'],
  ni: ['NetIncomeLoss', 'NetIncomeLossAvailableToCommonStockholdersBasic', 'ProfitLoss'],
  pretax: ['IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest', 'IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments'],
  tax: ['IncomeTaxExpenseBenefit'],
  rnd: ['ResearchAndDevelopmentExpense'],
  int: ['InterestExpense', 'InterestExpenseNonoperating', 'InterestExpenseDebt'],
  eps: ['EarningsPerShareDiluted', 'EarningsPerShareBasicAndDiluted', 'EarningsPerShareBasic'],
  sh: ['WeightedAverageNumberOfDilutedSharesOutstanding', 'WeightedAverageNumberOfShareOutstandingBasicAndDiluted', 'WeightedAverageNumberOfSharesOutstandingBasic'],
  ocf: ['NetCashProvidedByUsedInOperatingActivities', 'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations'],
  capex: ['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets'],
  sbc: ['ShareBasedCompensation', 'AllocatedShareBasedCompensationExpense'],
  dep: ['DepreciationDepletionAndAmortization', 'DepreciationAndAmortization', 'DepreciationAmortizationAndAccretionNet', 'Depreciation'],
  buy: ['PaymentsForRepurchaseOfCommonStock'],
  divp: ['PaymentsOfDividendsCommonStock', 'PaymentsOfDividends'],
  dps: ['CommonStockDividendsPerShareDeclared', 'CommonStockDividendsPerShareCashPaid'],
};
const INST = {
  cash: ['CashAndCashEquivalentsAtCarryingValue', 'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents'],
  msec: ['MarketableSecuritiesCurrent', 'AvailableForSaleSecuritiesDebtSecuritiesCurrent', 'ShortTermInvestments'],
  debt: ['LongTermDebt'],
  debtNc: ['LongTermDebtNoncurrent'], debtC: ['LongTermDebtCurrent'], stb: ['ShortTermBorrowings', 'CommercialPaper'],
  eq: ['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'],
  ta: ['Assets'], tl: ['Liabilities'], tle: ['LiabilitiesAndStockholdersEquity'],
  ca: ['AssetsCurrent'], cl: ['LiabilitiesCurrent'], re: ['RetainedEarningsAccumulatedDeficit'],
  ppe: ['PropertyPlantAndEquipmentNet', 'PropertyPlantAndEquipmentAndFinanceLeaseRightOfUseAssetAfterAccumulatedDepreciationAndAmortization'],
};
/* IFRS (20-F/40-F) — רק השורות המרכזיות; רבעונים לרוב לא קיימים (6-K בלי XBRL) */
const IFRS = {
  rev: ['Revenue', 'RevenueFromContractsWithCustomers'], cogs: ['CostOfSales'], gp: ['GrossProfit'], op: ['ProfitLossFromOperatingActivities'],
  ni: ['ProfitLossAttributableToOwnersOfParent', 'ProfitLoss'], pretax: ['ProfitLossBeforeTax'], tax: ['IncomeTaxExpenseContinuingOperations'],
  eps: ['DilutedEarningsLossPerShare', 'BasicEarningsLossPerShare'], sh: ['WeightedAverageNumberOfSharesOutstandingDiluted', 'WeightedAverageShares'],
  ocf: ['CashFlowsFromUsedInOperatingActivities'], capex: ['PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities'],
  dep: ['DepreciationAndAmortisationExpense', 'AdjustmentsForDepreciationAndAmortisationExpense', 'DepreciationExpense'], divp: ['DividendsPaidClassifiedAsFinancingActivities', 'DividendsPaid'],
  sbc: ['AdjustmentsForSharebasedPayments', 'ExpenseFromSharebasedPaymentTransactionsWithEmployees'], int: ['InterestExpense', 'InterestExpenseOnBorrowings'],
  debtNc: ['LongtermBorrowings', 'NoncurrentPortionOfNoncurrentBorrowings'], debtC: ['CurrentBorrowingsAndCurrentPortionOfNoncurrentBorrowings', 'ShorttermBorrowings'],
  cash: ['CashAndCashEquivalents'], eq: ['EquityAttributableToOwnersOfParent', 'Equity'], ta: ['Assets'], tl: ['Liabilities'],
  ca: ['CurrentAssets'], cl: ['CurrentLiabilities'], re: ['RetainedEarnings'], ppe: ['PropertyPlantAndEquipment'],
};
const FORMS = /^(10-K|10-Q|20-F|40-F)(\/A)?$/;
const day = (s) => Date.parse(s + 'T00:00:00Z') / 864e5;
const PER_SHARE = new Set(['eps', 'dps']);

/* ערכים של תגית אחת: { dur: Map("start|end" → {v, filed}), inst: Map(end → {v, filed}) } — האחרון שהוגש */
function tagFacts(node, unitPref) {
  const out = { dur: new Map(), inst: new Map(), unit: null };
  if (!node || !node.units) return out;
  const units = Object.keys(node.units);
  const unit = units.find((u) => u === unitPref) || units.find((u) => /^[A-Z]{3}$/.test(u) && unitPref === 'CUR') ||
    units.find((u) => unitPref === 'PS' && /\/shares$/.test(u)) || units.find((u) => unitPref === 'shares' && u === 'shares') || units[0];
  out.unit = unit;
  for (const x of node.units[unit] || []) {
    if (!FORMS.test(x.form || '') || x.val == null) continue;
    if (x.start) {
      const k = x.start + '|' + x.end, h = out.dur.get(k);
      if (!h || h.filed < x.filed) out.dur.set(k, { v: x.val, filed: x.filed });
    } else {
      const h = out.inst.get(x.end);
      if (!h || h.filed < x.filed) out.inst.set(x.end, { v: x.val, filed: x.filed });
    }
  }
  return out;
}

/* איחוד תגיות של אותו מדד: תגית ראשית, והשאר (לפי סדר העדיפות) משלימות תקופות חסרות.
   תגית משלימה נכנסת רק כשבתקופות המשותפות היא מסכימה עם מה שכבר נבחר (לפחות בחצי מהן — עד MERGE_TOL):
   תגית שמודדת דבר אחר (ברוטו מול נטו, רכיב מול סך) נדחית כולה — שנה חסרה עדיפה על קפיצה מדומה בגרף.
   הראשית = הראשונה בסדר העדיפות מבין התגיות שהחברה עדיין מדווחת (תגית שהפסיקה — לא ראשית).
   (Mastercard: RevenueFromContract… = ברוטו לפני הנחות ללקוחות רק ב־2018–2021, Revenues = נטו עד היום.) */
const MERGE_TOL = 0.025;
function tagGap(a, b) {
  const diffs = [];
  for (const [ma, mb] of [[a.dur, b.dur], [a.inst, b.inst]]) for (const [kk, v] of mb) {
    const h = ma.get(kk);
    if (h && h.v && v.v != null) diffs.push(Math.abs(v.v - h.v) / Math.abs(h.v));
  }
  if (!diffs.length) return null;
  diffs.sort((x, y) => x - y);
  return diffs[(diffs.length - 1) >> 1]; // מסכימה לפחות בחצי מהתקופות המשותפות = אותו מדד (עם תיקונים לאחור)
}
function mergeTags(fs) {
  const last = (f) => { let e = ''; for (const kk of f.dur.keys()) { const x = kk.split('|')[1]; if (x > e) e = x; } for (const x of f.inst.keys()) if (x > e) e = x; return e; };
  const has = fs.map((f) => f.dur.size + f.inst.size > 0);
  const m = { dur: new Map(), inst: new Map() };
  // הראשית = הראשונה בסדר העדיפות מבין התגיות שעדיין מדווחות (עד שנה מהתקופה המאוחרת ביותר)
  const top = Math.max(...fs.map((f, i) => (has[i] ? day(last(f)) : -Infinity)));
  if (!isFinite(top)) return m;
  const spine = fs.findIndex((f, i) => has[i] && day(last(f)) >= top - 400);
  for (const i of [spine, ...fs.map((_, j) => j).filter((j) => j !== spine && has[j])]) {
    const f = fs[i];
    if (i !== spine) { const g = tagGap(m, f); if (g != null && g > MERGE_TOL) continue; }
    for (const [kk, v] of f.dur) if (!m.dur.has(kk)) m.dur.set(kk, v);
    for (const [kk, v] of f.inst) if (!m.inst.has(kk)) m.inst.set(kk, v);
  }
  fixRuns(m, fs);
  return m;
}
/* רשת ביטחון שנייה — ערך שגוי בתוך התגית הנבחרת (Procter & Gamble: ‏Revenues = ‏$28B ב־2012–2014 במקום ‏$83B):
   רצף שנים שבו תגית אחרת נותנת ערך שונה, והחלפה שלו מעלימה קפיצה חדה מול השנה שלפניו ושאחריו — מוחלף.
   רק ערכים חיוביים, רק שנים שלמות, ורק כשהקפיצה גדולה (פי JUMP) וההחלפה מקטינה אותה לפחות בחצי ומתחת לסף. */
const JUMP = Math.log(1.6);
function fixRuns(m, fs) {
  const yr = (kk) => { const [a, b] = kk.split('|'); const d = day(b) - day(a); return d >= 350 && d <= 380; };
  const ends = [...m.dur.keys()].filter(yr).sort((a, b) => (a.split('|')[1] < b.split('|')[1] ? -1 : 1));
  if (ends.length < 3) return;
  const lg = (a, b) => (a > 0 && b > 0 ? Math.abs(Math.log(a / b)) : null);
  for (const f of fs) {
    const alt = (kk) => { const h = f.dur.get(kk), cur = m.dur.get(kk); return h && cur && h.v > 0 && cur.v > 0 && Math.abs(h.v - cur.v) / cur.v > MERGE_TOL ? h : null; };
    for (let i = 0; i < ends.length; i++) {
      if (!alt(ends[i])) continue;
      let j = i; while (j + 1 < ends.length && alt(ends[j + 1])) j++;
      const prev = i > 0 ? m.dur.get(ends[i - 1]).v : null, next = j + 1 < ends.length ? m.dur.get(ends[j + 1]).v : null;
      const was = [lg(prev, m.dur.get(ends[i]).v), lg(m.dur.get(ends[j]).v, next)].filter((x) => x != null);
      const now = [lg(prev, f.dur.get(ends[i]).v), lg(f.dur.get(ends[j]).v, next)].filter((x) => x != null);
      if (was.length && now.length === was.length) {
        const w = Math.max(...was), n = Math.max(...now);
        if (w > JUMP && n < JUMP && n < w / 2) for (let x = i; x <= j; x++) m.dur.set(ends[x], f.dur.get(ends[x]));
      }
      i = j;
    }
  }
}

/* נרמול companyfacts → { fy:[סופי שנים], q:[סופי רבעונים], A:{key:[...]}, Q:{key:[...]}, cur, derived } */
function normalizeSec(facts, splits = []) {
  const gaap = (facts && facts.facts && facts.facts['us-gaap']) || null;
  const ifrs = (facts && facts.facts && facts.facts['ifrs-full']) || null;
  const tax = gaap && Object.keys(gaap).length > 20 ? gaap : ifrs;
  if (!tax) return null;
  const isIfrs = tax === ifrs;
  const map = isIfrs ? IFRS : { ...FLOW, ...INST };
  const unitOf = (k) => (PER_SHARE.has(k) ? 'PS' : k === 'sh' ? 'shares' : 'CUR');
  // לכל מפתח: תגית ראשית אחת + השלמות שמסכימות איתה (mergeTags)
  const merged = {};
  let cur = null;
  for (const k of Object.keys(map)) {
    const fs = map[k].map((tag) => tagFacts(tax[tag], unitOf(k)));
    if (k === 'rev') { const f = fs.find((x) => x.unit && /^[A-Z]{3}$/.test(x.unit)); if (f) cur = f.unit; }
    merged[k] = mergeTags(fs);
  }
  // שנים פיסקליות: תקופות של ~שנה בהכנסות או ברווח הנקי (52/53 שבועות נכללים)
  const yearOf = new Map(); // end → start
  for (const k of ['rev', 'ni', 'op']) {
    for (const kk of merged[k] ? merged[k].dur.keys() : []) {
      const [s, e] = kk.split('|'), d = day(e) - day(s);
      if (d >= 350 && d <= 380 && !yearOf.has(e)) yearOf.set(e, s);
    }
  }
  const fyEnds = [...yearOf.keys()].sort();
  const nextDay = (e) => new Date(Date.parse(e + 'T00:00:00Z') + 864e5).toISOString().slice(0, 10);
  const yStarts = [...new Set(fyEnds.map((e) => yearOf.get(e)).concat(fyEnds.length ? [nextDay(fyEnds[fyEnds.length - 1])] : []))];
  const A = {}, Q = {}, derived = {};
  const qset = new Set();
  const FLOWK = Object.keys(map).filter((k) => !(k in INST) && !['cash', 'eq', 'ta', 'tl', 'ca', 'cl', 're', 'ppe'].includes(k));
  for (const k of Object.keys(map)) { A[k] = {}; Q[k] = {}; }
  for (const k of FLOWK) {
    const dur = merged[k].dur;
    for (const e of fyEnds) { const s = yearOf.get(e), h = dur.get(s + '|' + e); if (h) A[k][e] = h.v; }
    // רבעונים ישירים (~3 חודשים)
    for (const [kk, h] of dur) {
      const [s, e] = kk.split('|'), d = day(e) - day(s);
      if (d >= 80 && d <= 100) { Q[k][e] = h.v; qset.add(e); }
    }
    if (k === 'eps' || k === 'sh') continue; // אין חיסור לערכים למניה ולממוצע מניות
    // מצטבר מתחילת השנה → רבעונים חסרים (כולל השנה הפתוחה — מתחילה ביום שאחרי סוף השנה האחרונה)
    for (const s of yStarts) {
      const cum = [];
      for (const [kk, h] of dur) { const [s2, e2] = kk.split('|'); if (s2 === s && day(e2) - day(s) >= 80) cum.push([e2, h.v]); }
      cum.sort((a, b) => (a[0] < b[0] ? -1 : 1));
      for (let i = 1; i < cum.length; i++) {
        const [e2, v2] = cum[i], [e1, v1] = cum[i - 1], gap = day(e2) - day(e1);
        if (gap >= 80 && gap <= 100 && Q[k][e2] == null) { Q[k][e2] = v2 - v1; qset.add(e2); (derived[k] = derived[k] || []).push(e2); }
      }
    }
  }
  // רבעון רביעי כשהרבעונים מדווחים ישירות (בלי מצטבר): השנה פחות שלושת הרבעונים שבתוכה
  for (const k of FLOWK) {
    if (k === 'eps' || k === 'sh') continue;
    for (const e of fyEnds) {
      if (Q[k][e] != null || A[k][e] == null) continue;
      const s0 = yearOf.get(e), qs = Object.keys(Q[k]).filter((q) => q > s0 && q < e && day(e) - day(q) < 300);
      if (qs.length === 3) { Q[k][e] = A[k][e] - qs.reduce((t, q) => t + Q[k][q], 0); qset.add(e); (derived[k] = derived[k] || []).push(e); }
    }
  }
  for (const k of Object.keys(map).filter((x) => !FLOWK.includes(x))) {
    for (const [e, h] of merged[k].inst) { if (yearOf.has(e)) A[k][e] = h.v; Q[k][e] = h.v; }
  }
  // רבעונים: רק כאלה שיש להם הכנסות או רווח נקי, 48 האחרונים
  const qEnds = [...qset].filter((e) => Q.rev[e] != null || Q.ni[e] != null).sort().slice(-48);
  // רווח למניה ברבעון רביעי = רווח נקי ÷ ממוצע המניות של הרבעונים באותה שנה (לא חיסור — מסומן כנגזר)
  for (const e of qEnds) {
    if (Q.sh[e] == null) {
      const s = [...yearOf].find(([e2, s2]) => e > s2 && e <= e2);
      if (s && A.sh[s[0]] != null) Q.sh[e] = A.sh[s[0]];
    }
    if (Q.eps[e] == null && Q.ni[e] != null && Q.sh[e]) { Q.eps[e] = Math.round(Q.ni[e] / Q.sh[e] * 100) / 100; (derived.eps = derived.eps || []).push(e); }
  }
  // מניות חסרות (דיווח לפי סוגי מניות): רווח נקי ÷ רווח למניה
  for (const [D, ends] of [[A, fyEnds], [Q, qEnds]]) for (const e of ends) {
    if (!D.sh[e] && D.eps[e] && D.ni[e]) D.sh[e] = Math.abs(D.ni[e] / D.eps[e]);
  }
  // פיצולים: תקופות שדווחו רק לפני הפיצול — קפיצה במספר המניות פי היחס
  for (const [sd, ratio] of splits) {
    for (const [D, ends] of [[A, fyEnds], [Q, qEnds]]) {
      const ref = ends.filter((e) => e >= sd && D.sh[e]).map((e) => D.sh[e])[0];
      if (!ref) continue;
      for (const e of ends) {
        const v = D.sh[e];
        if (e < sd && v && v * ratio / 2 < ref && ref < v * ratio * 2) {
          D.sh[e] = v * ratio;
          for (const k of PER_SHARE) if (D[k][e] != null) D[k][e] = Math.round(D[k][e] / ratio * 1e4) / 1e4;
        }
      }
    }
  }
  // שורות מחושבות
  for (const [D, ends] of [[A, fyEnds], [Q, qEnds]]) for (const e of ends) {
    if (D.gp && D.gp[e] == null && D.rev[e] != null && D.cogs && D.cogs[e] != null) D.gp[e] = D.rev[e] - D.cogs[e];
    if (D.tl && D.tl[e] == null && D.tle && D.tle[e] != null && D.eq[e] != null) D.tl[e] = D.tle[e] - D.eq[e];
    if (D.debt && D.debt[e] == null) { const s = (D.debtNc[e] || 0) + (D.debtC[e] || 0); if (s) D.debt[e] = s; }
    if (D.debt && D.stb && D.stb[e]) D.debt[e] = (D.debt[e] || 0) + D.stb[e];
  }
  const KEEP = ['rev', 'cogs', 'gp', 'op', 'ni', 'pretax', 'tax', 'rnd', 'int', 'eps', 'sh', 'ocf', 'capex', 'sbc', 'dep', 'buy', 'divp', 'dps',
    'cash', 'msec', 'debt', 'eq', 'ta', 'tl', 'ca', 'cl', 're', 'ppe'];
  const pack = (D, ends) => { const o = {}; for (const k of KEEP) { if (!D[k]) continue; const a = ends.map((e) => (D[k][e] != null ? D[k][e] : null)); if (a.some((v) => v != null)) o[k] = a; } return o; };
  const fy = fyEnds.filter((e) => A.rev[e] != null || A.ni[e] != null).slice(-20);
  return { fy, q: qEnds, A: pack(A, fy), Q: pack(Q, qEnds), cur: cur || 'USD', ifrs: isIfrs, derived };
}

/* ---------- בדיקות אימות — תג, לא תיקון ---------- */
function validate(d) {
  const out = [], A = d.A, Q = d.Q;
  const near = (a, b, tol) => a != null && b != null && Math.abs(a - b) <= tol * Math.max(Math.abs(a), Math.abs(b), 1);
  d.fy.forEach((e, i) => {
    const ta = A.ta && A.ta[i], tl = A.tl && A.tl[i], eq = A.eq && A.eq[i];
    if (ta && tl != null && eq != null && !near(ta, tl + eq, 0.03)) out.push({ k: 'bal', p: e });          // נכסים ≈ התחייבויות + הון
    if (A.ni && A.eps && A.sh && A.ni[i] && A.eps[i] && A.sh[i] && !near(A.ni[i], A.eps[i] * A.sh[i], 0.06)) out.push({ k: 'eps', p: e }); // רווח ≈ EPS × מניות
    if (A.rev && A.rev[i] != null && A.rev[i] < 0) out.push({ k: 'neg', p: e });
    const pr = i > 0 && A.rev ? A.rev[i - 1] : null;
    if (pr > 0 && A.rev[i] > 0 && (A.rev[i] / pr > 8 || pr / A.rev[i] > 8)) out.push({ k: 'scale', p: e });   // קפיצה של סדר גודל
    // ארבעה רבעונים ישירים = השנה
    for (const k of ['rev', 'ni']) {
      if (!A[k] || !Q[k] || A[k][i] == null) continue;
      const qs = d.q.map((qe, j) => [qe, Q[k][j]]).filter(([qe]) => qe > (d.fy[i - 1] || '0000') && qe <= e);
      if (qs.length === 4 && qs.every(([, v]) => v != null) && !near(qs.reduce((s, [, v]) => s + v, 0), A[k][i], 0.01)) out.push({ k: 'q4', m: k, p: e });
    }
  });
  return out;
}
function crossCheck(d, y) { // מול Yahoo: הכנסות ורווח נקי בשתי השנים האחרונות, עד 2%
  const out = [];
  if (!y || !y.fy) return out;
  for (const k of ['rev', 'ni']) {
    for (let i = d.fy.length - 2; i < d.fy.length; i++) {
      if (i < 0) continue;
      const e = d.fy[i], j = y.fy.findIndex((x) => Math.abs(day(x) - day(e)) < 20);
      const a = d.A[k] && d.A[k][i], b = j >= 0 && y.A[k] ? y.A[k][j] : null;
      if (a != null && b != null && Math.abs(a - b) > 0.02 * Math.max(Math.abs(a), Math.abs(b))) out.push({ k: 'xy', m: k, p: e });
    }
  }
  return out;
}

/* ---------- Yahoo: דוחות (גיבוי ות״א) ---------- */
const YMAP = { rev: 'TotalRevenue', cogs: 'CostOfRevenue', gp: 'GrossProfit', op: 'OperatingIncome', ni: 'NetIncomeCommonStockholders', pretax: 'PretaxIncome',
  tax: 'TaxProvision', rnd: 'ResearchAndDevelopment', int: 'InterestExpense', eps: 'DilutedEPS', sh: 'DilutedAverageShares', ocf: 'OperatingCashFlow',
  capex: 'CapitalExpenditure', sbc: 'StockBasedCompensation', dep: 'ReconciledDepreciation', buy: 'RepurchaseOfCapitalStock', divp: 'CashDividendsPaid',
  cash: 'CashAndCashEquivalents', msec: 'OtherShortTermInvestments', debt: 'TotalDebt', eq: 'StockholdersEquity', ta: 'TotalAssets',
  tl: 'TotalLiabilitiesNetMinorityInterest', ca: 'CurrentAssets', cl: 'CurrentLiabilities', re: 'RetainedEarnings', ppe: 'NetPPE' };
const YNEG = new Set(['capex', 'buy', 'divp']); // ב־Yahoo שליליים; אצלנו כמו ב־SEC — סכום ששולם
const YBAL = new Set(['cash', 'msec', 'debt', 'eq', 'ta', 'tl', 'ca', 'cl', 're', 'ppe']);
function parseYahooTs(j) {
  const res = {};
  for (const r of (j && j.timeseries && j.timeseries.result) || []) { const t = r.meta && r.meta.type && r.meta.type[0]; if (t) res[t] = r[t] || []; }
  const ser = (p, k) => { const o = {}; for (const x of res[p + YMAP[k]] || []) { if (!x || !x.reportedValue) continue; const v = x.reportedValue.raw; o[x.asOfDate] = YNEG.has(k) ? -v : v; } return o; };
  const ya = {}, yq = {}, yt = {};
  for (const k of Object.keys(YMAP)) { ya[k] = ser('annual', k); yq[k] = ser('quarterly', k); yt[k] = ser('trailing', k); }
  // רבעון 4 חסר = השנה פחות שלושה רבעונים (לא במאזן)
  for (const k of Object.keys(YMAP)) {
    if (YBAL.has(k)) continue;
    for (const [e, v] of Object.entries(ya[k])) {
      const qs = Object.keys(yq[k]).filter((q) => q < e && day(e) - day(q) < 290).sort();
      if (yq[k][e] == null && qs.length === 3) yq[k][e] = k === 'sh' ? qs.reduce((s, q) => s + yq[k][q], 0) / 3 : v - qs.reduce((s, q) => s + yq[k][q], 0);
    }
  }
  const fy = Object.keys(ya.rev).sort(), q = Object.keys(yq.rev).sort();
  const pack = (D, ends) => { const o = {}; for (const k of Object.keys(YMAP)) { const a = ends.map((e) => (D[k][e] != null ? D[k][e] : null)); if (a.some((v) => v != null)) o[k] = a; } return o; };
  const last = q[q.length - 1], T = {};
  for (const k of Object.keys(YMAP)) if (last && yt[k][last] != null) T[k] = yt[k][last];
  const so = res.annualOrdinarySharesNumber || [];
  return { fy, q, A: pack(ya, fy), Q: pack(yq, q), T, sharesOut: so.length ? so[so.length - 1].reportedValue.raw : null };
}
async function yahooTs(sym) {
  const types = ['annual', 'quarterly', 'trailing'].flatMap((p) => Object.values(YMAP).map((t) => p + t)).concat(['annualOrdinarySharesNumber']).join(',');
  const url = 'https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/' + encodeURIComponent(sym) +
    '?type=' + types + '&period1=1262304000&period2=' + Math.floor(Date.now() / 1000 + 86400);
  return parseYahooTs(await getJson(url, { headers: { 'User-Agent': UA } }));
}

/* ---------- Yahoo: פרופיל, אומדנים, פיצולים ומחירים חודשיים ---------- */
function parseSummary(j, div) {
  const r = j && j.quoteSummary && j.quoteSummary.result && j.quoteSummary.result[0];
  if (!r) return null;
  const raw = (o, k) => (o && o[k] && typeof o[k] === 'object' && o[k].raw != null ? o[k].raw : null);
  const ap = r.assetProfile || {}, pr = r.price || {}, sd = r.summaryDetail || {}, ks = r.defaultKeyStatistics || {}, fd = r.financialData || {};
  const ceo = ((ap.companyOfficers || []).find((o) => /CEO|Chief Executive/.test(o.title || '')) || {}).name || null;
  const est = ((r.earningsTrend && r.earningsTrend.trend) || []).filter((t) => /^(0q|\+1q|0y|\+1y|\+5y)$/.test(t.period)).map((t) => {
    const ee = t.earningsEstimate || {}, rv = t.revenueEstimate || {};
    return { p: t.period, end: t.endDate || null, eps: raw(ee, 'avg'), lo: raw(ee, 'low'), hi: raw(ee, 'high'), n: raw(ee, 'numberOfAnalysts'),
      rev: raw(rv, 'avg'), rn: raw(rv, 'numberOfAnalysts'), g: raw(t, 'growth') };
  }).filter((e) => e.eps != null || e.rev != null || e.g != null); // מניה בלי כיסוי אנליסטים — רשימה ריקה, לא שורות ריקות
  const hist = ((r.earningsHistory && r.earningsHistory.history) || []).map((h) => ({ q: h.quarter && h.quarter.fmt, a: raw(h, 'epsActual'), e: raw(h, 'epsEstimate') }));
  const ed = ((r.calendarEvents && r.calendarEvents.earnings && r.calendarEvents.earnings.earningsDate) || []).map((x) => x.fmt).filter(Boolean);
  const px = raw(pr, 'regularMarketPrice');
  return {
    prof: { name: pr.longName || pr.shortName || null, exch: pr.exchangeName || null, sector: ap.sectorDisp || ap.sector || null,
      industry: ap.industryDisp || ap.industry || null, ceo: ceo ? ceo.replace(/^(Mr\.|Ms\.|Mrs\.|Dr\.)\s+/, '').replace(/\s+/g, ' ') : null,
      web: ap.website || null, emp: ap.fullTimeEmployees || null },
    price: px != null ? px / div : null, prev: raw(pr, 'regularMarketPreviousClose') != null ? raw(pr, 'regularMarketPreviousClose') / div : null,
    quoteCur: pr.currency || null, finCur: fd.financialCurrency || null,
    sharesOut: raw(ks, 'sharesOutstanding') || raw(ks, 'impliedSharesOutstanding'),
    fpe: raw(sd, 'forwardPE') || raw(ks, 'forwardPE'), peg: raw(ks, 'pegRatio'), beta: raw(sd, 'beta'),
    est, hist, nextEarn: ed[0] || null,
  };
}
async function yahooSummary(sym, div) {
  const { _getCrumb } = require('../api/quotes');
  for (let a = 0; a < 2; a++) {
    const cs = await _getCrumb(a > 0);
    const url = 'https://query2.finance.yahoo.com/v10/finance/quoteSummary/' + encodeURIComponent(sym) +
      '?modules=assetProfile,price,summaryDetail,defaultKeyStatistics,financialData,earningsTrend,earningsHistory,calendarEvents&crumb=' + encodeURIComponent(cs.crumb);
    try { return parseSummary(await getJson(url, { headers: { 'User-Agent': UA, Cookie: cs.cookie } }), div); }
    catch (e) { if (!(e.status === 401 || e.status === 403)) throw e; }
  }
  return null;
}
function parseMonthly(j) {
  const r = j && j.chart && j.chart.result && j.chart.result[0];
  if (!r) return { px: null, splits: [] };
  const div = String((r.meta && r.meta.currency) || '').toUpperCase() === 'ILA' ? 100 : 1;
  const close = (r.indicators && r.indicators.quote && r.indicators.quote[0] && r.indicators.quote[0].close) || [];
  const t = [], c = [];
  (r.timestamp || []).forEach((s, i) => { if (close[i] > 0) { const d = new Date(s * 1000).toISOString().slice(0, 7); if (t[t.length - 1] === d) c[c.length - 1] = Math.round(close[i] / div * 1e4) / 1e4; else { t.push(d); c.push(Math.round(close[i] / div * 1e4) / 1e4); } } });
  const splits = Object.values((r.events && r.events.splits) || {}).map((x) => [new Date(x.date * 1000).toISOString().slice(0, 10), x.numerator / x.denominator]).filter((x) => x[1] > 0 && x[1] !== 1).sort();
  return { px: t.length ? { t, c } : null, splits, div };
}
async function yahooMonthly(sym) {
  const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) + '?range=max&interval=1mo&events=split';
  return parseMonthly(await getJson(url, { headers: { 'User-Agent': UA } }));
}

/* ---------- Yahoo: מניות "דומות" (מי שצפה בזו צפה גם ב…) — מועמדים לעמיתים; הסינון לפי ענף/סקטור בטלפון ---------- */
function parsePeers(j, self) {
  const r = j && j.finance && j.finance.result && j.finance.result[0];
  const out = [];
  for (const x of (r && r.recommendedSymbols) || []) {
    const s = String((x && x.symbol) || '').toUpperCase();
    if (/^[A-Z0-9][A-Z0-9.\-]{0,15}$/.test(s) && s !== self && !out.includes(s)) out.push(s);
  }
  return out.slice(0, 6);
}
async function yahooPeers(sym) {
  const url = 'https://query2.finance.yahoo.com/v6/finance/recommendationsbysymbol/' + encodeURIComponent(sym);
  return parsePeers(await getJson(url, { headers: { 'User-Agent': UA } }, 6000), sym);
}

/* ---------- Nasdaq (Zacks): תחזיות רווח למניה לכמה שנים — לא מתועד, ולכן רשות בלבד ---------- */
function parseNasdaq(j) {
  const rows = (j && j.data && j.data.yearlyForecast && j.data.yearlyForecast.rows) || [];
  return rows.map((r) => ({ fy: String(r.fiscalEnd || ''), eps: typeof r.consensusEPSForecast === 'number' ? r.consensusEPSForecast : null,
    lo: r.lowEPSForecast ?? null, hi: r.highEPSForecast ?? null, n: r.noOfEstimates ?? null })).filter((r) => /^[A-Z][a-z]{2} \d{4}$/.test(r.fy) && r.eps != null);
}
async function nasdaqForecast(sym) {
  const url = 'https://api.nasdaq.com/api/analyst/' + encodeURIComponent(sym.replace('-', '.')) + '/earnings-forecast';
  return parseNasdaq(await getJson(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36', Accept: 'application/json' } }, 5000));
}

/* ---------- SEC: סימבול → CIK, וענף לפי SIC ---------- */
async function cikMap() {
  const hit = cget('sec:tickers', 24 * H); if (hit) return hit;
  const j = await getJson('https://www.sec.gov/files/company_tickers_exchange.json', { headers: { 'User-Agent': SEC_UA() } }, 12000);
  const m = new Map(), f = j.fields || [];
  const ic = f.indexOf('cik'), it = f.indexOf('ticker');
  for (const row of j.data || []) m.set(String(row[it]).toUpperCase(), String(row[ic]).padStart(10, '0'));
  return cset('sec:tickers', m);
}
const secSym = (sym) => sym.toUpperCase().replace(/\./g, '-'); // BRK.B → BRK-B (ב־SEC)

/* ---------- ענף של Damodaran: לפי הענף של Yahoo (גם לת״א), ואם אין — "Total Market" ---------- */
const IND = [
  [/internet content|interactive media|internet retail/i, 'Software (Internet)'], [/software.*infrastructure|software.*application|software/i, 'Software (System & Application)'],
  [/semiconductor equipment/i, 'Semiconductor Equip'], [/semiconductor/i, 'Semiconductor'], [/consumer electronics/i, 'Electronics (Consumer & Office)'],
  [/computer hardware/i, 'Computers/Peripherals'], [/communication equipment/i, 'Telecom. Equipment'], [/telecom/i, 'Telecom. Services'],
  [/information technology services/i, 'Computer Services'], [/electronic components|scientific & technical/i, 'Electronics (General)'],
  [/entertainment/i, 'Entertainment'], [/advertising/i, 'Advertising'], [/broadcasting/i, 'Broadcasting'], [/publishing/i, 'Publishing & Newspapers'],
  [/drug manufacturers/i, 'Drugs (Pharmaceutical)'], [/biotech/i, 'Drugs (Biotechnology)'], [/medical devices|medical instruments/i, 'Healthcare Products'],
  [/healthcare plans/i, 'Healthcare Support Services'], [/medical care facilities/i, 'Hospitals/Healthcare Facilities'], [/health information/i, 'Heathcare Information and Technology'],
  [/banks.*diversified/i, 'Bank (Money Center)'], [/banks/i, 'Banks (Regional)'], [/insurance.*life/i, 'Insurance (Life)'], [/insurance.*property/i, 'Insurance (Prop/Cas.)'],
  [/insurance/i, 'Insurance (General)'], [/asset management/i, 'Investments & Asset Management'], [/capital markets/i, 'Brokerage & Investment Banking'],
  [/credit services|financial/i, 'Financial Svcs. (Non-bank & Insurance)'], [/reit/i, 'R.E.I.T.'], [/real estate.*develop/i, 'Real Estate (Development)'], [/real estate/i, 'Real Estate (Operations & Services)'],
  [/packaged foods|confectioners|food distribution/i, 'Food Processing'], [/grocery/i, 'Retail (Grocery and Food)'], [/beverages.*non-alcoholic/i, 'Beverage (Soft)'],
  [/beverages/i, 'Beverage (Alcoholic)'], [/tobacco/i, 'Tobacco'], [/household/i, 'Household Products'], [/discount stores|department stores/i, 'Retail (General)'],
  [/specialty retail|apparel retail|home improvement/i, 'Retail (Special Lines)'], [/restaurants/i, 'Restaurant/Dining'], [/apparel|footwear/i, 'Apparel'],
  [/auto manufacturers/i, 'Auto & Truck'], [/auto parts/i, 'Auto Parts'], [/aerospace|defense/i, 'Aerospace/Defense'], [/airlines/i, 'Air Transport'],
  [/railroads/i, 'Transportation (Railroads)'], [/trucking/i, 'Trucking'], [/integrated freight|marine shipping/i, 'Transportation'],
  [/oil & gas integrated/i, 'Oil/Gas (Integrated)'], [/oil & gas e&p/i, 'Oil/Gas (Production and Exploration)'], [/oil & gas equipment/i, 'Oilfield Svcs/Equip.'],
  [/oil & gas midstream/i, 'Oil/Gas Distribution'], [/utilities.*renewable|solar/i, 'Green & Renewable Energy'], [/utilities/i, 'Utility (General)'],
  [/chemicals/i, 'Chemical (Specialty)'], [/agricultural inputs/i, 'Chemical (Basic)'], [/steel/i, 'Steel'], [/gold|silver|precious/i, 'Precious Metals'],
  [/metals|mining|copper|aluminum/i, 'Metals & Mining'], [/building materials/i, 'Building Materials'], [/engineering|construction/i, 'Engineering/Construction'],
  [/machinery|industrial distribution/i, 'Machinery'], [/electrical equipment/i, 'Electrical Equipment'], [/packaging/i, 'Packaging & Container'],
  [/travel|lodging|resorts|gambling/i, 'Hotel/Gaming'], [/education/i, 'Education'], [/staffing|consulting|specialty business/i, 'Business & Consumer Services'],
  [/waste management/i, 'Environmental & Waste Services'], [/homebuilding|residential construction/i, 'Homebuilding'], [/leisure/i, 'Recreation'],
];
function industryFor(yahooIndustry) {
  const s = String(yahooIndustry || '');
  for (const [re, n] of IND) if (re.test(s) && DMD.ind[n]) return n;
  return 'Total Market (without financials)';
}

/* ---------- מקרו: ריבית ופרמיות ---------- */
function parseFred(csv) {
  const rows = String(csv).split(/\r?\n/).map((l) => l.split(',')).filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r[0]) && /^\d/.test(r[1] || ''));
  if (!rows.length) return null;
  const last = rows[rows.length - 1], from = new Date(Date.parse(last[0]) - 5 * 365.25 * 864e5).toISOString().slice(0, 10);
  const r5 = rows.filter((r) => r[0] >= from).map((r) => +r[1]);
  return { rf: +last[1] / 100, rfDate: last[0], rf5: Math.round(r5.reduce((s, x) => s + x, 0) / r5.length * 100) / 1e4 };
}
/* משרד האוצר האמריקאי — CSV שנתי של עקום התשואות; העמודה "10 Yr". גיבוי כש־FRED לא עונה */
function parseTreasury(csv) {
  const lines = String(csv).trim().split(/\r?\n/), hdr = (lines[0] || '').split(',').map((x) => x.replace(/"/g, '').trim()), i = hdr.indexOf('10 Yr');
  if (i < 0) return [];
  return lines.slice(1).map((l) => l.split(',')).filter((r) => /^\d{2}\/\d{2}\/\d{4}$/.test(r[0]) && /^\d/.test(r[i] || ''))
    .map((r) => [r[0].slice(6) + '-' + r[0].slice(0, 2) + '-' + r[0].slice(3, 5), +r[i]]).sort((a, b) => (a[0] < b[0] ? -1 : 1));
}
async function treasury10y() {
  const y = new Date().getUTCFullYear(), years = [y, y - 1, y - 2, y - 3, y - 4, y - 5];
  const url = (yy) => 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/' + yy +
    '/all?type=daily_treasury_yield_curve&field_tdr_date_value=' + yy + '&page&_format=csv';
  const all = (await Promise.all(years.map((yy) => getText(url(yy), { headers: { 'User-Agent': UA } }, 8000).then(parseTreasury).catch(() => [])))).flat().sort((a, b) => (a[0] < b[0] ? -1 : 1));
  if (!all.length) return null;
  const last = all[all.length - 1], from = new Date(Date.parse(last[0]) - 5 * 365.25 * 864e5).toISOString().slice(0, 10), r5 = all.filter((r) => r[0] >= from).map((r) => r[1]);
  return { rf: last[1] / 100, rfDate: last[0], rf5: Math.round(r5.reduce((a, b) => a + b, 0) / r5.length * 100) / 1e4, rfSrc: 'US Treasury' };
}
async function macro() {
  const hit = cget('macro', 12 * H); if (hit) return hit;
  let fred = null;
  try { fred = parseFred(await getText('https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS10', { headers: { 'User-Agent': UA } }, 8000)); if (fred) fred.rfSrc = 'FRED DGS10'; } catch (e) { /* גיבוי למטה */ }
  if (!fred) { try { fred = await treasury10y(); } catch (e) { /* בלי ריבית חיה */ } }
  const v = { ...(fred || { rf: null, rfDate: null, rf5: null }), erp: DMD.erp, erpDate: DMD.erpDate, crpIL: DMD.crpIL, rfIL: DMD.rfIL, rfILDate: DMD.rfILDate,
    taxIL: DMD.taxIL, ratingIL: DMD.ratingIL, dmdAsOf: DMD.asOf, src: { rf: (fred && fred.rfSrc) || null, erp: DMD.src } };
  return fred ? cset('macro', v) : v;
}

/* ---------- הכל יחד ---------- */
const FUND_TTL = 12 * H;
async function fundamentals(sym0) {
  const sym = String(sym0 || '').trim().toUpperCase();
  const hit = cget('fund:' + sym, FUND_TTL); if (hit) return hit;
  const ta = /\.TA$/.test(sym);
  const errs = [];
  const safe = (p, code) => p.catch((e) => { errs.push(code + ':' + (e && e.message ? String(e.message).slice(0, 24) : 'x')); return null; });
  const monthly = safe(yahooMonthly(sym), 'px');
  const summary = safe(monthly.then((m) => yahooSummary(sym, (m && m.div) || (ta ? 100 : 1))), 'qs');
  const ysTs = safe(yahooTs(sym), 'yts');
  const nq = ta ? Promise.resolve(null) : safe(nasdaqForecast(sym), 'nq');
  const peersP = safe(yahooPeers(sym), 'peers');
  let sec = null, cik = null;
  if (!ta) {
    try {
      cik = (await cikMap()).get(secSym(sym)) || null;
      if (cik) {
        const [facts, sub] = await Promise.all([
          getJson('https://data.sec.gov/api/xbrl/companyfacts/CIK' + cik + '.json', { headers: { 'User-Agent': SEC_UA() } }, 15000),
          getJson('https://data.sec.gov/submissions/CIK' + cik + '.json', { headers: { 'User-Agent': SEC_UA() } }, 8000).catch(() => null),
        ]);
        const m = await monthly;
        sec = normalizeSec(facts, (m && m.splits) || []);
        if (sec && sub) { sec.sic = sub.sic || null; sec.sicDesc = sub.sicDescription || null; sec.fye = sub.fiscalYearEnd || null;
          const fl = ((sub.filings && sub.filings.recent && sub.filings.recent.filingDate) || [])[0]; sec.lastFiled = fl || null; }
      }
    } catch (e) { errs.push('sec:' + String(e.message || 'x').slice(0, 24)); }
  }
  const [m, s, y, n, peers] = await Promise.all([monthly, summary, ysTs, nq, peersP]);
  const useSec = sec && sec.fy.length >= 2;
  const base = useSec ? sec : y;
  if (!base || !base.fy || !base.fy.length) return { ok: false, error: 'no_data', errs };
  const checks = useSec ? validate(sec).concat(crossCheck(sec, y)) : [];
  // שורה שחסרה ב־SEC לגמרי (תגית פרטית של החברה, למשל השקעות הוניות ב־IFRS) — משלימים מ־Yahoo לפי תאריך, ומסמנים
  const fill = [];
  if (useSec && y && y.fy) for (const k of Object.keys(YMAP)) {
    if (sec.A[k] || !y.A[k]) continue;
    const a = sec.fy.map((e) => { const j = y.fy.findIndex((x) => Math.abs(day(x) - day(e)) < 20); return j >= 0 ? y.A[k][j] : null; });
    if (a.some((v) => v != null)) { sec.A[k] = a; fill.push(k); }
  }
  // מניות לשווי השוק: בדילול מהדוח האחרון (ב־Yahoo "sharesOutstanding" הוא לפעמים רק סוג מניות אחד — Meta: 2.2B מתוך 2.57B)
  const lastSh = (D) => (D && D.sh ? D.sh.filter((v) => v > 0).pop() : null);
  const sharesOut = useSec ? (lastSh(sec.Q) || lastSh(sec.A)) : ((y && y.sharesOut) || lastSh(y && y.Q) || (s && s.sharesOut));
  const out = {
    ok: true, v: 1, sym, src: useSec ? 'sec' : 'yahoo', cik, asOf: new Date().toISOString().slice(0, 10),
    cur: (useSec ? sec.cur : (s && s.finCur)) || (ta ? 'ILS' : 'USD'),
    fy: base.fy, q: base.q, A: base.A, Q: base.Q, T: useSec ? null : (y && y.T) || null,
    derived: useSec ? sec.derived : null, ifrs: useSec ? !!sec.ifrs : false,
    sic: useSec ? sec.sic : null, sicDesc: useSec ? sec.sicDesc : null, fye: useSec ? sec.fye : null, lastFiled: useSec ? sec.lastFiled : null,
    prof: s ? s.prof : null, price: s ? s.price : null, prev: s ? s.prev : null,
    sharesOut: sharesOut || (s && s.sharesOut) || null, fill, fpe: s ? s.fpe : null, peg: s ? s.peg : null, beta: s ? s.beta : null,
    est: s ? s.est : [], hist: s ? s.hist : [], nextEarn: s ? s.nextEarn : null, nq: n || null,
    px: m ? m.px : null, splits: m ? m.splits : [], peers: peers || [],
    ind: industryFor(s && s.prof && s.prof.industry), checks, errs,
  };
  return cset('fund:' + sym, out);
}
function industryData(name) { return DMD.ind[name] || DMD.ind['Total Market (without financials)'] || null; }

const SYM_RE = /^[A-Z0-9][A-Z0-9.\-]{0,15}$/;
/* op:'fund' {sym} | op:'macro' — מתוך /api/history (Vercel מלא: 12 מתוך 12 פונקציות) */
async function handle(body, res) {
  if (body.op === 'macro') {
    const v = await macro();
    return res.status(200).json({ ok: true, ...v, ind: DMD.ind });
  }
  const sym = String((body && body.sym) || '').trim().toUpperCase();
  if (!SYM_RE.test(sym)) return res.status(400).json({ ok: false, error: 'bad_params' });
  const v = await fundamentals(sym);
  if (!v.ok) return res.status(404).json(v);
  return res.status(200).json({ ...v, indData: industryData(v.ind) });
}

module.exports = { handle, fundamentals, macro, normalizeSec, mergeTags, fixRuns, validate, crossCheck, parseYahooTs, parseSummary, parseMonthly, parseNasdaq, parsePeers, parseFred, parseTreasury,
  industryFor, industryData, _cache: cache };
