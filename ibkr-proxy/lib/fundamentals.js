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
  rev: ['RevenuesNetOfInterestExpense', 'Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet', 'RevenueFromContractWithCustomerIncludingAssessedTax', 'SalesRevenueGoodsNet'],
  cogs: ['CostOfRevenue', 'CostOfGoodsAndServicesSold', 'CostOfGoodsSold', 'CostOfServices'],
  gp: ['GrossProfit'],
  op: ['OperatingIncomeLoss'],
  ni: ['NetIncomeLoss', 'NetIncomeLossAvailableToCommonStockholdersBasic', 'ProfitLoss'],
  nic: ['NetIncomeLossAvailableToCommonStockholdersDiluted', 'NetIncomeLossAvailableToCommonStockholdersBasic'], // לבעלי המניות הרגילות (אחרי דיבידנד בכורה) — לזהות EPS × מניות
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
  eqt: ['StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'], // כולל זכויות מיעוט — לזהות המאזן
  tmp: ['TemporaryEquityCarryingAmountIncludingPortionAttributableToNoncontrollingInterest', 'RedeemableNoncontrollingInterestEquityCarryingAmount', 'TemporaryEquityCarryingAmountAttributableToParent'],
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
const NONNEG = ['rev', 'ta', 'tl', 'ca', 'cl', 'cash', 'sh', 'ppe'];
const day = (s) => Date.parse(s + 'T00:00:00Z') / 864e5;
const PER_SHARE = new Set(['eps', 'dps']);
/* באיזה דוח מופיעה כל שורה (לבחירת התגית לפי הדוח שהחברה הגישה — lib/secface.js) */
const STMT_OF = { rev: ['is'], cogs: ['is'], gp: ['is'], op: ['is'], ni: ['is', 'cf'], pretax: ['is'], tax: ['is'], rnd: ['is'], int: ['is'], eps: ['is'], sh: ['is'],
  nic: ['is'], eqt: ['bs'], tmp: ['bs'], ocf: ['cf'], capex: ['cf'], sbc: ['cf'], dep: ['cf', 'is'], buy: ['cf'], divp: ['cf'],
  cash: ['bs', 'cf'], msec: ['bs'], debtNc: ['bs'], debtC: ['bs'], stb: ['bs'], eq: ['bs'], ta: ['bs'], tl: ['bs'], tle: ['bs'], ca: ['bs'], cl: ['bs'], re: ['bs'], ppe: ['bs'] };
/* השקעות הוניות = כל השורות של רכישת נכסים קבועים שהחברה מציגה בתזרים (Mastercard: רכוש קבוע + תוכנה מהוונת;
   Caterpillar: + ציוד שמושכר ללקוחות). סכום רק כשיותר משורה אחת מופיעה בדוח, ורק בתקופות שבהן כל החלקים קיימים — אחרת קפיצה מדומה. */
const CAPEX_PARTS = ['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets', 'PaymentsToAcquireSoftware', 'PaymentsToDevelopSoftware',
  'PaymentsForSoftware', 'PaymentsToAcquireEquipmentOnLease', 'PaymentsToAcquireOtherPropertyPlantAndEquipment', 'PaymentsForCapitalImprovements',
  'PaymentsToAcquireOilAndGasPropertyAndEquipment', 'PaymentsToAcquireOilAndGasProperty', 'PaymentsToAcquireMiningAssets'];
const faceTagList = (face, sts) => { const out = []; for (const st of sts || []) for (const r of (face && face[st] && face[st].rows) || []) if (/^(us-gaap|ifrs-full)$/.test(r.ns) && !out.includes(r.tag)) out.push(r.tag); return out; };
/* הערכים השנתיים שהודפסו בדוח, לפי תגית: "tag|end" → ערך (עמודות של 12 חודשים במטבע הדיווח; מאזן — כל עמודה) */
function faceYearVals(face, sts, cur) {
  const out = new Map();
  for (const st of sts || []) {
    const S = face && face[st]; if (!S) continue;
    for (const r of S.rows) {
      const v = SECFACE.rowVals(S, r);
      S.cols.forEach((c, i) => { if (v[i] == null || (st !== 'bs' && c.months != null && c.months !== 12) || !SECFACE.colOk(c, cur)) return; const kk = r.tag + '|' + c.end; if (!out.has(kk)) out.set(kk, v[i]); });
    }
  }
  return out;
}
function sumFacts(parts) {
  const out = { dur: new Map(), inst: new Map(), unit: parts[0] && parts[0].unit };
  for (const [kk, h] of parts[0].dur) {
    let v = h.v, filed = h.filed, all = true;
    for (const p of parts.slice(1)) { const x = p.dur.get(kk); if (!x) { all = false; break; } v += x.v; if (x.filed > filed) filed = x.filed; }
    if (all) out.dur.set(kk, { v, filed });
  }
  return out;
}

/* מטבע הדיווח: המטבע שבו הוגשה ההגשה האחרונה (בתגיות של הכנסות, רווח ונכסים); כשיש שניים באותה הגשה (עמודת המרה
   לדולר — Alibaba) — זה שיש בו יותר ערכים באותה הגשה. חברה שהחליפה מטבע (Nebius: רובל → דולר) — רק המטבע החדש */
function reportCur(tax, tags) {
  const last = {}, cnt = {};
  for (const t of tags) for (const [u, rows] of Object.entries((tax[t] && tax[t].units) || {})) {
    if (!/^[A-Z]{3}$/.test(u)) continue;
    for (const x of rows) {
      if (!FORMS.test(x.form || '')) continue;
      if (!last[u] || x.filed > last[u]) { last[u] = x.filed; cnt[u] = 0; }
      if (x.filed === last[u]) cnt[u]++;
    }
  }
  const us = Object.keys(last);
  if (us.length < 2) return us[0] || null;
  us.sort((a, b) => (last[b] > last[a] ? 1 : last[b] < last[a] ? -1 : cnt[b] - cnt[a]));
  return us[0];
}

/* ערכים של תגית אחת: { dur: Map("start|end" → {v, filed}), inst: Map(end → {v, filed}) } — האחרון שהוגש */
function tagFacts(node, unitPref) {
  const out = { dur: new Map(), inst: new Map(), unit: null };
  if (!node || !node.units) return out;
  const units = Object.keys(node.units);
  // מטבע דיווח ידוע ("USD", "EUR/shares") — רק הוא: ערכים במטבע אחר (חברה שהחליפה מטבע, עמודת המרה) לא מתערבבים
  const exact = unitPref !== 'CUR' && /^[A-Z]{3}(\/shares)?$/.test(unitPref || '');
  const unit = units.find((u) => u === unitPref) || (exact ? null : units.find((u) => /^[A-Z]{3}$/.test(u) && unitPref === 'CUR') ||
    units.find((u) => unitPref === 'PS' && /\/shares$/.test(u)) || units.find((u) => unitPref === 'shares' && u === 'shares') || units[0]);
  if (!unit) return out;
  out.unit = unit;
  const allv = new Map(); // לכל תקופה: כל הערכים לפי תאריך ההגשה — לצמיחה מול השנה הקודמת באותו דוח (comparable)
  for (const x of node.units[unit] || []) {
    if (!FORMS.test(x.form || '') || x.val == null) continue;
    if (x.start) {
      // תקופה של שנה שלמה: ערך מדוח שנתי גובר על ערך מדוח רבעוני גם כשהרבעוני הוגש אחריו
      // (Comfort Systems: 10-Q תייג "שנה" של $1.8B — במקום $9.1B של ה־10-K)
      const k = x.start + '|' + x.end, h = out.dur.get(k), ann = !/^10-Q/.test(x.form), yr = day(x.end) - day(x.start) >= 350;
      if (!yr || ann) { let a = allv.get(k); if (!a) allv.set(k, (a = new Map())); a.set(x.filed, x.val); }
      if (!h || (yr && h.ann !== ann ? ann : h.filed < x.filed)) out.dur.set(k, { v: x.val, filed: x.filed, ann });
    } else {
      // גם במאזן: ערך מדוח שנתי גובר על השוואה בדוח רבעוני מאוחר יותר (תיקון לאחור ב־10-Q — eBay: הון 2025
      // ‏$4.48B ב־10-Q של 2026 מול $4.62B שהודפס ב־10-K). דוח שנתי מאוחר יותר עדיין גובר לפי תאריך ההגשה
      const h = out.inst.get(x.end), ann = !/^10-Q/.test(x.form);
      if (!h || (h.ann !== ann ? ann : h.filed < x.filed)) out.inst.set(x.end, { v: x.val, filed: x.filed, ann });
    }
  }
  for (const [k, h] of out.dur) h.all = allv.get(k);
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
function mergeTags(fs, lock) {
  const last = (f) => { let e = ''; for (const kk of f.dur.keys()) { const x = kk.split('|')[1]; if (x > e) e = x; } for (const x of f.inst.keys()) if (x > e) e = x; return e; };
  const has = fs.map((f) => f.dur.size + f.inst.size > 0);
  const m = { dur: new Map(), inst: new Map() };
  // הראשית = הראשונה בסדר העדיפות מבין התגיות שעדיין מדווחות (עד שנה מהתקופה המאוחרת ביותר)
  const top = Math.max(...fs.map((f, i) => (has[i] ? day(last(f)) : -Infinity)));
  if (!isFinite(top)) return m;
  const spine = fs.findIndex((f, i) => has[i] && day(last(f)) >= top - 400);
  m.spine = spine;
  for (const i of [spine, ...fs.map((_, j) => j).filter((j) => j !== spine && has[j])]) {
    const f = fs[i];
    if (i !== spine) { const g = tagGap(m, f); if (g != null && g > MERGE_TOL) continue; }
    for (const [kk, v] of f.dur) if (!m.dur.has(kk)) m.dur.set(kk, v);
    for (const [kk, v] of f.inst) if (!m.inst.has(kk)) m.inst.set(kk, v);
  }
  fixRuns(m, fs, lock && ((kk, v) => lock(spine, kk, v)));
  return m;
}
/* רשת ביטחון שנייה — ערך שגוי בתוך התגית הנבחרת (Procter & Gamble: ‏Revenues = ‏$28B ב־2012–2014 במקום ‏$83B):
   רצף שנים שבו תגית אחרת נותנת ערך שונה, והחלפה שלו מעלימה קפיצה חדה מול השנה שלפניו ושאחריו — מוחלף.
   רק ערכים חיוביים, רק שנים שלמות, ורק כשהקפיצה גדולה (פי JUMP) וההחלפה מקטינה אותה לפחות בחצי ומתחת לסף. */
const JUMP = Math.log(1.6);
function fixRuns(m, fs, locked) {
  const yr = (kk) => { const [a, b] = kk.split('|'); const d = day(b) - day(a); return d >= 350 && d <= 380; };
  const ends = [...m.dur.keys()].filter(yr).sort((a, b) => (a.split('|')[1] < b.split('|')[1] ? -1 : 1));
  if (ends.length < 3) return;
  const lg = (a, b) => (a > 0 && b > 0 ? Math.abs(Math.log(a / b)) : null);
  for (const f of fs) {
    const alt = (kk) => { const h = f.dur.get(kk), cur = m.dur.get(kk); return h && cur && h.v > 0 && cur.v > 0 && Math.abs(h.v - cur.v) / cur.v > MERGE_TOL ? h : null; };
    for (let i = 0; i < ends.length; i++) {
      if (!alt(ends[i])) continue;
      let j = i; while (j + 1 < ends.length && alt(ends[j + 1])) j++;
      if (locked) { let ok = false; for (let x = i; x <= j; x++) if (locked(ends[x], m.dur.get(ends[x]).v)) ok = true; if (ok) { i = j; continue; } }
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
function normalizeSec(facts, splits = [], face = null) {
  const gaap = (facts && facts.facts && facts.facts['us-gaap']) || null;
  const ifrs = (facts && facts.facts && facts.facts['ifrs-full']) || null;
  const tax = gaap && Object.keys(gaap).length > 20 ? gaap : ifrs;
  if (!tax) return null;
  const isIfrs = tax === ifrs;
  const map = isIfrs ? IFRS : { ...FLOW, ...INST };
  const rc = reportCur(tax, [map.rev, map.ni, map.ta].flat().filter(Boolean));
  const unitOf = (k) => (PER_SHARE.has(k) ? (rc ? rc + '/shares' : 'PS') : k === 'sh' ? 'shares' : (rc || 'CUR'));
  // לכל מפתח: תגית ראשית אחת + השלמות שמסכימות איתה (mergeTags)
  // התגיות שמופיעות בדוח שהחברה הגישה (10-K האחרון) — ראשונות
  const merged = {}, tags = {};
  let cur = null;
  for (const k of Object.keys(map)) {
    const onFace = faceTagList(face, STMT_OF[k]), list = map[k].slice();
    const order = list.filter((t) => onFace.includes(t)).concat(list.filter((t) => !onFace.includes(t))); // בין אלה שבדוח — סדר העדיפות שלנו (מדולל לפני בסיסי)
    let fs = order.map((tag) => tagFacts(tax[tag], unitOf(k))), names = order;
    if (k === 'capex' && !isIfrs) {
      const parts = CAPEX_PARTS.filter((t) => onFace.includes(t) && tax[t]);
      // הסכום הוא מועמד אחד לצד התגיות לחוד — mergeTags בוחר את הראשית מבין אלה שעדיין מדווחות
      // (Entergy: חברת בת הציגה PaymentsToAcquireProductiveAssets בעמוד, הסכום קיים רק ל־2023, ו־2024–2025 יצאו ריקות)
      if (parts.length > 1) { fs = [sumFacts(parts.map((t) => tagFacts(tax[t], unitOf(k)))), ...fs]; names = [parts.join('+'), ...names]; }
    }
    if (k === 'rev') { const f = fs.find((x) => x.unit && /^[A-Z]{3}$/.test(x.unit)); if (f) cur = f.unit; }
    if (rc) cur = rc;
    // ערך שהדוח המודפס מאשר (התגית שבדוח, אותה שנה, אותו ערך) — fixRuns לא מחליף את הרצף שלו
    // (Ares: ההכנסות באמת קופצות — דמי ביצוע; "Revenues" היא מדד אחר וחלק יותר)
    const fv = faceYearVals(face, STMT_OF[k], rc || cur);
    const lock = (si, kk, v) => { const t = names[si], e = kk.split('|')[1], x = t && fv.get(t + '|' + e); return x != null && Math.abs(Math.abs(x) - Math.abs(v)) <= 0.005 * Math.abs(x); };
    merged[k] = mergeTags(fs, lock);
    if (merged[k].spine != null) tags[k] = names[merged[k].spine];
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
  const dq = {}; // רבעונים מחושבים ממצטבר: מאילו תקופות ומאיזה דוח — להשוואה מול שנה קודם (cmpRatio)
  const valAfter = (h, d) => { if (!h.all) return null; let F = null; for (const f of h.all.keys()) if (f >= d && (!F || f < F)) F = f; return F; };
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
      for (const [kk, h] of dur) { const [s2, e2] = kk.split('|'); if (s2 === s && day(e2) - day(s) >= 80) cum.push([e2, h, kk]); }
      cum.sort((a, b) => (a[0] < b[0] ? -1 : 1));
      for (let i = 1; i < cum.length; i++) {
        const [e2, h2, k2] = cum[i], [e1, h1, k1] = cum[i - 1], gap = day(e2) - day(e1);
        if (gap >= 80 && gap <= 100 && Q[k][e2] == null) {
          // השנה כפי שדווחה מול אותם תשעה חודשים — לא אחרי הצגה מחדש מאוחרת (AppLovin: 2023 אחרי ההצגה מחדש ‏$1.84B
          // פחות תשעה חודשים כפי שדווחו אז ‏$2.33B = רבעון שלילי). הדוח השנתי הראשון שהוגש אחרי החלק הקודם
          const F = valAfter(h2, h1.filed);
          Q[k][e2] = (F ? h2.all.get(F) : h2.v) - h1.v; qset.add(e2); (derived[k] = derived[k] || []).push(e2);
          (dq[k] = dq[k] || {})[e2] = { k2, k1, F };
        }
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
      // אין עדיין תקופה אחרי הפיצול (HDFC Bank: מניות הטבה בספטמבר, השנה נגמרה במרץ) — אין קפיצה לאמת מולה;
      // מחילים רק פיצול "נקי" (יחס שלם ≥2 או ההפך שלו), אחרת המחיר אחרי הפיצול מול רווח למניה לפניו = מכפיל כפול
      const clean = Math.abs(ratio - Math.round(ratio)) < 1e-6 && ratio >= 2 || Math.abs(1 / ratio - Math.round(1 / ratio)) < 1e-6 && ratio <= 0.5;
      if (!ref && !(clean && ends.some((e) => e < sd && D.sh[e]) && !ends.some((e) => e >= sd))) continue;
      // רק פיצול אמיתי: יחס רחוק מ־1, ומספר המניות קפץ בערך באותו יחס בין התקופה שלפני לזו שאחרי (במרחק לוגריתמי,
      // עד 35% מהיחס). Yahoo רושם גם פיצול חברה כ"ספליט" — GE Vernova 1.25, Western Digital/Sandisk 1.323 (מספר המניות
      // עלה רק ב־10%; עד 25/10/2026 עבר בבדיקה כל שנה לחוד מול טווח רחב, והרווח למניה של 2024 חולק ב־1.323).
      // החלטה אחת לכל התקופות שלפני — לא שנה ישנה (לפני רכישות חוזרות) שעוברת ושנה שלא
      const lr = Math.log(ratio), before = ends.filter((e) => e < sd && D.sh[e]).pop();
      const real = Math.abs(lr) > Math.log(1.3) && (ref ? before && Math.abs(Math.log(ref / D.sh[before]) - lr) < 0.35 * Math.abs(lr) : clean);
      if (!real) continue;
      for (const e of ends) {
        const v = D.sh[e];
        if (e < sd && v) {
          D.sh[e] = v * ratio;
          for (const k of PER_SHARE) if (D[k][e] != null) D[k][e] = Math.round(D[k][e] / ratio * 1e4) / 1e4;
        }
      }
    }
  }
  // מספר מניות שהוגש בקנה מידה שגוי (McDonald's: ‏716.4 "מניות" במקום 716.4 מיליון — טעות של החברה, מהסוג שחוקי DQC תופסים):
  // רווח נקי ÷ רווח למניה = מספר המניות. פער של פי אלף / מיליון בדיוק (±15%) — מתקנים ורושמים.
  const fixes = [];
  for (const [D, ends] of [[A, fyEnds], [Q, qEnds]]) for (const e of ends) {
    const sh = D.sh[e], eps = D.eps[e], ni = (D.nic && D.nic[e] != null ? D.nic[e] : D.ni[e]);
    if (!(sh > 0) || !eps || !ni) continue;
    const r = Math.abs(ni / eps) / sh;
    for (const f of [1e3, 1e6]) if (Math.abs(r / f - 1) < 0.15) { D.sh[e] = sh * f; if (D === A) fixes.push({ m: 'sh', p: e, x: f }); }
  }
  // שורות מחושבות
  for (const [D, ends] of [[A, fyEnds], [Q, qEnds]]) for (const e of ends) {
    if (D.gp && D.gp[e] == null && D.rev[e] != null && D.cogs && D.cogs[e] != null) D.gp[e] = D.rev[e] - D.cogs[e];
    // סך התחייבויות שלא דווח = סך התחייבויות והון פחות כל ההון (כולל זכויות מיעוט והון ביניים)
    if (D.tl && D.tl[e] == null && D.tle && D.tle[e] != null && D.eq[e] != null) D.tl[e] = D.tle[e] - (D.eqt && D.eqt[e] != null ? D.eqt[e] : D.eq[e]) - ((D.tmp && D.tmp[e]) || 0);
    if (D.debt && D.debt[e] == null) { const s = (D.debtNc[e] || 0) + (D.debtC[e] || 0); if (s) D.debt[e] = s; }
    if (D.debt && D.stb && D.stb[e]) D.debt[e] = (D.debt[e] || 0) + D.stb[e];
  }
  // צמיחה ברת השוואה (26/10/2026, AppLovin): חברה שהציגה מחדש שנים קודמות (פעילות שנמכרה, שינוי מדיניות) — הערך
  // האחרון של 2023 הוא אחרי ההצגה מחדש (‏$1.84B בלי עסק האפליקציות), ו־2022 נשאר כפי שדווח אז (‏$2.82B כולל אותו):
  // היחס ביניהם = צמיחה מדומה (‎−35% במקום ‎+16.5%). לכל תקופה: היחס מהדוח האחרון שמציג גם אותה וגם את התקופה
  // המקבילה שנה קודם — כמו שהחברה עצמה הציגה את ההשוואה. נשמר רק כשהוא שונה מהיחס בין הערכים שבסדרה.
  const CMP_TOL = 2e-4; // יחס שונה ב־0.02% ומעלה — נשמר (תיקון קטן לאחור משנה צמיחה ברבע נקודה — JPM 2018)
  const prevKey = (dur, kk) => {
    const [s0, e0] = kk.split('|'), L = day(e0) - day(s0), t = day(e0) - 365;
    let best = null, bd = 11;
    for (const k2 of dur.keys()) {
      const [s2, e2] = k2.split('|'), dd = Math.abs(day(e2) - t);
      if (dd < bd && Math.abs(day(e2) - day(s2) - L) <= 10) { best = k2; bd = dd; }
    }
    return best;
  };
  const cmpRatio = (dur, kk) => {
    const h = dur.get(kk), pk = h && h.all ? prevKey(dur, kk) : null, p = pk && dur.get(pk);
    if (!p || !p.all) return null;
    let F = null;
    for (const f of h.all.keys()) if (p.all.has(f) && (!F || f > F)) F = f;
    const a = F && h.all.get(F), b = F && p.all.get(F);
    if (!a || !b) return null;
    const r = a / b, naive = p.v ? h.v / p.v : null;
    return naive != null && Math.abs(r / naive - 1) <= CMP_TOL ? null : Math.round(r * 1e6) / 1e6;
  };
  const GA = {}, GQ = {};
  for (const k of FLOWK) {
    const dur = merged[k].dur;
    for (const e of fyEnds) { const r = cmpRatio(dur, yearOf.get(e) + '|' + e); if (r != null) (GA[k] = GA[k] || {})[e] = r; }
    for (const kk of dur.keys()) {
      const [s0, e0] = kk.split('|'), d0 = day(e0) - day(s0);
      if (d0 >= 80 && d0 <= 100 && Q[k][e0] != null) { const r = cmpRatio(dur, kk); if (r != null) (GQ[k] = GQ[k] || {})[e0] = r; }
    }
    // רבעון מחושב (שנה − תשעה חודשים): גם הרבעון של שנה קודם צריך להיות על אותו בסיס. מחשבים מהדוח השנתי שממנו
    // נלקחה השנה (שמציג גם את השנה הקודמת) ומהדוח הרבעוני של תשעת החודשים; אי אפשר ויש הצגה מחדש — 0 = לא ידוע
    for (const [e0, x] of Object.entries(dq[k] || {})) {
      const h2 = dur.get(x.k2), h1 = dur.get(x.k1), p2k = prevKey(dur, x.k2), p1k = prevKey(dur, x.k1);
      const p2 = p2k && dur.get(p2k), p1 = p1k && dur.get(p1k), pe = Object.keys(dq[k]).find((e) => Math.abs(day(e) - day(e0) + 365) <= 10);
      const qPrev = pe ? Q[k][pe] : null;
      if (!p2 || !p1 || qPrev == null) continue;
      const restat = (h) => { if (!h.all) return false; const v = [...h.all.values()]; return Math.max(...v) - Math.min(...v) > 0.005 * Math.max(...v.map(Math.abs)); };
      let G = null;
      if (h1.all && p1.all) for (const f of h1.all.keys()) if (p1.all.has(f) && h1.all.get(f) === h1.v && (!G || f > G)) G = f;
      const a2 = x.F ? h2.all.get(x.F) : h2.v, b2 = x.F && p2.all ? p2.all.get(x.F) : null, b1 = G ? p1.all.get(G) : null;
      let r = null;
      if (b2 != null && b1 != null && b2 - b1 > 0 && a2 - h1.v > 0) r = (a2 - h1.v) / (b2 - b1);
      else if (restat(h2) || restat(p2) || restat(h1) || restat(p1)) r = 0;
      if (r == null) continue;
      const naive = qPrev ? Q[k][e0] / qPrev : null;
      if (r && naive != null && Math.abs(r / naive - 1) <= CMP_TOL) continue;
      (GQ[k] = GQ[k] || {})[e0] = r ? Math.round(r * 1e6) / 1e6 : 0;
    }
  }
  const KEEP = ['rev', 'cogs', 'gp', 'op', 'ni', 'nic', 'eqt', 'tmp', 'tle', 'pretax', 'tax', 'rnd', 'int', 'eps', 'sh', 'ocf', 'capex', 'sbc', 'dep', 'buy', 'divp', 'dps',
    'cash', 'msec', 'debt', 'eq', 'ta', 'tl', 'ca', 'cl', 're', 'ppe'];
  const pack = (D, ends) => { const o = {}; for (const k of KEEP) { if (!D[k]) continue; const a = ends.map((e) => (D[k][e] != null ? D[k][e] : null)); if (a.some((v) => v != null)) o[k] = a; } return o; };
  const fy = fyEnds.filter((e) => A.rev[e] != null || A.ni[e] != null).slice(-20);
  const C = { A: pack(GA, fy), Q: pack(GQ, qEnds) };
  return { fy, q: qEnds, A: pack(A, fy), Q: pack(Q, qEnds), C: Object.keys(C.A).length || Object.keys(C.Q).length ? C : null, cur: cur || 'USD', ifrs: isIfrs, derived, tags, fixes };
}

/* ---------- בדיקות אימות — תג, לא תיקון ---------- */
function validate(d) {
  const out = (d.fixes || []).map((f) => ({ k: 'fix', m: f.m, p: f.p, x: f.x })), A = d.A, Q = d.Q;
  const near = (a, b, tol) => a != null && b != null && Math.abs(a - b) <= tol * Math.max(Math.abs(a), Math.abs(b), 1);
  d.fy.forEach((e, i) => {
    const g = (k) => (A[k] ? A[k][i] : null);
    // נכסים = התחייבויות + הון (כולל זכויות מיעוט והון ביניים); כשיש "סך התחייבויות והון" — גם מולו
    const ta = g('ta'), tl = g('tl'), eqx = g('eqt') != null ? g('eqt') : g('eq');
    if (ta && g('tle') != null) { if (!near(ta, g('tle'), 0.001)) out.push({ k: 'bal', p: e }); }
    else if (ta && tl != null && eqx != null && !near(ta, tl + eqx + (g('tmp') || 0), 0.01)) out.push({ k: 'bal', p: e });
    const nin = g('nic') != null ? g('nic') : g('ni');
    if (nin && g('eps') && g('sh') && !near(nin, g('eps') * g('sh'), 0.03)) out.push({ k: 'eps', p: e }); // רווח לבעלי המניות ≈ EPS × מניות
    // ערכים שלא יכולים להיות שליליים (ברוח DQC 0015)
    for (const k of NONNEG) if (g(k) != null && g(k) < 0) out.push({ k: 'neg', m: k, p: e });
    // קפיצה של סדר גודל (פי 8) — לרוב קנה מידה שגוי בדיווח
    for (const k of ['rev', 'ta', 'sh']) {
      const pr = i > 0 && A[k] ? A[k][i - 1] : null, v = g(k);
      if (pr > 0 && v > 0 && (v / pr > 8 || pr / v > 8)) out.push({ k: 'scale', m: k, p: e });
    }
    // רווח גולמי = הכנסות − עלות המכר (כשהשלושה דווחו); חלק ≤ שלם; רווח תפעולי ≤ הכנסות
    if (g('gp') != null && g('rev') && g('cogs') != null && !near(g('gp'), g('rev') - Math.abs(g('cogs')), 0.01)) out.push({ k: 'gp', p: e });
    if (g('ca') != null && g('ta') != null && g('ca') > g('ta') * 1.001) out.push({ k: 'part', m: 'ca', p: e });
    if (g('cl') != null && g('tl') != null && g('cl') > g('tl') * 1.001) out.push({ k: 'part', m: 'cl', p: e });
    if (g('op') != null && g('rev') > 0 && g('op') > g('rev') * 1.001) out.push({ k: 'part', m: 'op', p: e });
    // ארבעה רבעונים ישירים = השנה. שנה שהחברה הציגה מחדש (d.C — רבעונים על בסיס אחר) = מידע, לא "לבדוק"
    for (const k of ['rev', 'ni']) {
      const rst = d.C && ((d.C.A[k] && d.C.A[k][i] != null) || d.q.some((qe, j) => qe > (d.fy[i - 1] || '0000') && qe <= e && d.C.Q[k] && d.C.Q[k][j] != null));
      if (rst) { out.push({ k: 'rst', m: k, p: e }); continue; }
      if (!A[k] || !Q[k] || A[k][i] == null) continue;
      const qs = d.q.map((qe, j) => [qe, Q[k][j]]).filter(([qe]) => qe > (d.fy[i - 1] || '0000') && qe <= e);
      if (qs.length === 4 && qs.every(([, v]) => v != null) && !near(qs.reduce((s, [, v]) => s + v, 0), A[k][i], 0.01)) out.push({ k: 'q4', m: k, p: e });
    }
  });
  // רבעון עם הכנסות שליליות — כמעט תמיד רבעון 4 מחושב (שנה פחות 9 חודשים) מדוחות בגרסאות שונות
  d.q.forEach((e, j) => { if (Q.rev && Q.rev[j] != null && Q.rev[j] < 0) out.push({ k: 'qneg', m: 'rev', p: e }); });
  return out;
}
function crossCheck(d, y) { // מול Yahoo: הכנסות ורווח נקי בשתי השנים האחרונות, עד 2%
  const out = [];
  if (!y || !y.fy) return out;
  for (const k of ['rev', 'ni']) {
    for (let i = d.fy.length - 2; i < d.fy.length; i++) {
      if (i < 0) continue;
      const e = d.fy[i], j = y.fy.findIndex((x) => Math.abs(day(x) - day(e)) < 20);
      const kk = k === 'ni' && d.A.nic && d.A.nic[i] != null ? 'nic' : k; // Yahoo = רווח לבעלי המניות הרגילות
      const a = d.A[kk] && d.A[kk][i], b = j >= 0 && y.A[k] ? y.A[k][j] : null;
      if (a != null && b != null && Math.abs(a - b) > 0.02 * Math.max(Math.abs(a), Math.abs(b))) out.push({ k: 'xy', m: k, p: e });
    }
  }
  return out;
}

/* מול הדוח עצמו (שכבה 1): כל ערך שנתי שמופיע ב־10-K האחרון — מול מה שהחברה הדפיסה באותה שורה (אותה תגית).
   השקעות הוניות מורכבות — מול סכום השורות. עד 0.5% (עיגול לאלפים/מיליונים); למניה — עד 1 סנט. */
const FACE_KEYS = ['rev', 'cogs', 'gp', 'op', 'ni', 'pretax', 'tax', 'rnd', 'eps', 'sh', 'ocf', 'capex', 'sbc', 'dep', 'buy', 'divp', 'cash', 'eq', 'ta', 'tl', 'ca', 'cl', 're', 'ppe'];
const SECFACE = require('./secface');
const ABS_FACE = new Set(['cogs', 'tax', 'rnd', 'int', 'capex', 'buy', 'divp', 'dep', 'sbc', 'tl', 'cl']);   // התחייבויות — בבריטניה (IFRS) מודפסות במינוס
function faceCheck(d, face, splits = []) {
  const out = [], seen = { n: 0, ok: 0 }, fill = [];
  if (!face || !d || !d.tags) return { out, seen, fill };
  // פיצול שהיה אחרי הגשת הדוח (Booking 25:1, CrowdStrike 4:1): הדוח מודפס לפני הפיצול ואצלנו אחריו — משווים אחרי אותו פיצול
  const post = (splits || []).filter(([sd, r]) => face.filed && sd > face.filed && Math.abs(Math.log(r)) > Math.log(1.3)).reduce((t, [, r]) => t * r, 1);
  for (const k of FACE_KEYS) {
    const tag = d.tags[k]; if (!tag || !d.A[k]) continue;
    const parts = tag.split('+');
    for (const st of STMT_OF[k] || []) {
      const S = face[st]; if (!S) continue;
      // אותה תגית בכמה שורות — השורה שהכי קרובה לערכים שלנו, או סכום כל השורות כשהוא קרוב יותר.
      // (המזומן בתזרים: תחילת התקופה וסופה, ואצל KKR גם לכל מגזר — סוף התקופה המאוחד הוא הקרוב;
      // Diamondback: רכישות של חברת הבת בשורה נפרדת; Carrier: עלות המכר של מוצרים ושל שירותים, אותה תגית, והסך שלנו = שתיהן)
      const ab = ABS_FACE.has(k);
      const near = (t) => {
        const rs = S.rows.filter((r) => r.tag === t).map((r) => SECFACE.rowVals(S, r));
        if (rs.length < 2 || parts.length > 1) return rs[0] || null;
        rs.push(S.cols.map((c, ci) => rs.reduce((x, v) => (x == null || v[ci] == null ? null : x + (ab ? Math.abs(v[ci]) : v[ci])), 0)));
        const err = (vs) => vs.reduce((e, v, ci) => {
          const i = d.fy.findIndex((x) => Math.abs(day(x) - day(S.cols[ci].end)) <= 8), o = i >= 0 ? d.A[k][i] : null;
          return v == null || o == null ? e : e + Math.abs((ab ? Math.abs(v) : v) - (ab ? Math.abs(o) : o)) / Math.max(Math.abs(o), 1);
        }, 0);
        return rs.reduce((b, r) => (err(r) < err(b) ? r : b));
      };
      const vals = parts.map(near);
      if (vals.some((v) => !v)) continue;
      const cmp = [], gaps = [], uniq = parts.every((t) => S.rows.filter((r) => r.tag === t).length === 1);
      S.cols.forEach((c, ci) => {
        if (st !== 'bs' && c.months != null && c.months !== 12) return;
        if (!SECFACE.colOk(c, d.cur)) return;
        const i = d.fy.findIndex((e) => Math.abs(day(e) - day(c.end)) <= 8); if (i < 0) return;
        // הוצאות ותשלומים — לפי הערך המוחלט (בדוח הן לפעמים מודפסות במינוס)
        const fv0 = vals.reduce((t, v) => (t == null || v[ci] == null ? null : t + (ab ? Math.abs(v[ci]) : v[ci])), 0);
        const fv = fv0 == null || post === 1 ? fv0 : PER_SHARE.has(k) ? Math.round(fv0 / post * 1e4) / 1e4 : k === 'sh' ? fv0 * post : fv0;
        const ours = d.A[k][i]; if (fv == null) return;
        // מניות שתוקנו בקנה מידה (fixes) — הדוח מודפס באותה טעות; משווים אחרי אותו תיקון
        const fx = k === 'sh' ? (d.fixes || []).find((f) => f.m === 'sh') : null;
        if (ours == null) { if (!fx) gaps.push({ i, f: fv }); return; }
        const a = ab ? Math.abs(ours) : ours;
        if (fx && Math.abs(fv * fx.x - a) <= 0.005 * Math.abs(a)) { seen.n++; seen.ok++; return; }
        const tol = k === 'eps' ? 0.011 : 0.005 * Math.max(Math.abs(fv), 1);
        cmp.push({ ok: Math.abs(a - fv) <= tol, flip: Math.abs(a + fv) <= tol && Math.abs(fv) > tol, i, p: d.fy[i], f: fv, v: a });
      });
      // שורה שכולה הפוכה בסימן (ובכל העמודות) = תווית "הפוכה" בהצגה (negated label: Mettler מציגה את הרווח לפני מס
      // בסוגריים, והערך ב־XBRL חיובי) — זו בחירת תצוגה, לא טעות בנתון
      const flipped = cmp.length >= 2 && cmp.every((x) => x.flip);
      // ערך שמוחלף בזה שבדוח (למטה) נספר כתואם — הנתון שיוצא הוא מה שהודפס; ההחלפה נרשמת כ־ffix
      for (const x of cmp) { seen.n++; if (x.ok || flipped || uniq) seen.ok++; else out.push({ k: 'face', m: k, p: x.p, f: x.f, v: x.v }); }
      // השלמה מהדוח עצמו: שנה שחסרה אצלנו והדוח הדפיס אותה (‏SEC מחזיר רק ערכים בלי "ממד" — Carrier/Diamondback/
      // Restaurant Brands 2024–2025 מתויגים לפי מגזר או ישות), ושנה שהדוח האחרון הציג מחדש (Brookfield Asset Management:
      // הישות החדשה, 2023 על בסיס המבנה החדש). רק מהשורה של התגית שלנו, ורק כשהיא חד־משמעית: שורה אחת עם התגית,
      // או שורה שתאמה לנו בשנה אחרת. ערך שונה מוחלף רק כשיש שורה אחת. נרשם (ffill / ffix) — גלוי בבדיקה ובמסך
      const valid = uniq || cmp.some((x) => x.ok) || flipped, sg = flipped ? -1 : 1;
      if (valid) for (const g of gaps) fill.push({ m: k, i: g.i, v: (ab ? Math.abs(g.f) : g.f) * sg, old: null });
      if (uniq && !flipped) for (const x of cmp) if (!x.ok) fill.push({ m: k, i: x.i, v: x.f, old: x.v });
      break;
    }
  }
  return { out, seen, fill };
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
  const base = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym);
  const j = await getJson(base + '?range=max&interval=1mo&events=split', { headers: { 'User-Agent': UA } });
  const m = parseMonthly(j), r = j && j.chart && j.chart.result && j.chart.result[0];
  // היסטוריה ארוכה מאוד (JPM מ־1984, KO…): ב־range=max ‏Yahoo מוריד לנרות של 3 חודשים — מכפילי ה־10 שנים יוצאים דלים.
  // אז עוד בקשה ל־25 השנים האחרונות בחודשים; הפיצולים נשארים מהבקשה המלאה
  if (r && r.meta && r.meta.dataGranularity && r.meta.dataGranularity !== '1mo') {
    const now = Math.floor(Date.now() / 1000);
    try {
      const m2 = parseMonthly(await getJson(base + '?period1=' + (now - 25 * 31557600) + '&period2=' + now + '&interval=1mo', { headers: { 'User-Agent': UA } }));
      if (m2.px && m2.px.t.length > (m.px ? m.px.t.filter((x) => x >= m2.px.t[0]).length : 0)) m.px = m2.px;
    } catch (e) { /* נשארים עם הרבעוניים */ }
  }
  return m;
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
  [/packaged foods|confectioners|food distribution/i, 'Food Processing'], [/grocery/i, 'Retail (Grocery and Food)'], [/beverages.*non\s*-\s*alcoholic/i, 'Beverage (Soft)'],
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

/* ישות שמחליפה ישות קודמת (חברת אחזקות חדשה) — ב־SEC אין קישור ביניהן, ולכן טבלה מתועדת.
   הבדיקה הלילית (tools/fund-audit.js) מסמנת חברה עם פחות משנתיים היסטוריה — משם מוסיפים לכאן. */
const CIK_PREV = {
  '0002115436': '0000034088', // ExxonMobil Holdings Corp (2026) ← Exxon Mobil Corp
};
/* איחוד companyfacts של שתי ישויות: אותה תגית — כל הדיווחים יחד (האחרון שהוגש גובר בכל תקופה, כמו תמיד) */
function mergeFacts(a, b) {
  const out = { facts: {} };
  for (const ns of new Set([...Object.keys((a && a.facts) || {}), ...Object.keys((b && b.facts) || {})])) {
    const A = (a.facts && a.facts[ns]) || {}, B = (b.facts && b.facts[ns]) || {}, o = out.facts[ns] = {};
    for (const t of new Set([...Object.keys(A), ...Object.keys(B)])) {
      const units = {};
      for (const src of [A[t], B[t]]) for (const [u, rows] of Object.entries((src && src.units) || {})) units[u] = (units[u] || []).concat(rows);
      o[t] = { units };
    }
  }
  return out;
}

/* הדוח השנתי האחרון כפי שהוגש: FilingSummary.xml → דפי R של רווח והפסד, מאזן ותזרים (lib/secface.js) */
const ANNUAL = /^(10-K|20-F|40-F)$/;
async function secFace(cik, sub) {
  const r = sub && sub.filings && sub.filings.recent;
  if (!r || !r.form) return null;
  const i = r.form.findIndex((f) => ANNUAL.test(f));
  if (i < 0) return null;
  const acc = r.accessionNumber[i], key = 'face:' + acc;
  const hit = cget(key, 864e5); if (hit) return hit;
  const base = 'https://www.sec.gov/Archives/edgar/data/' + (+cik) + '/' + acc.replace(/-/g, '') + '/';
  const H = { headers: { 'User-Agent': SEC_UA() } };
  const pick = SECFACE.pickStatements(await getText(base + 'FilingSummary.xml', H, 7000));
  const out = { form: r.form[i], filed: r.filingDate[i], acc, url: base };
  await Promise.all(['is', 'bs', 'cf'].map(async (k) => { if (pick[k]) { try { out[k] = SECFACE.parseR(await getText(base + pick[k], H, 7000)); } catch (e) { /* דוח אחד חסר — השאר עדיין נבדקים */ } } }));
  if (!out.is && !out.bs && !out.cf) return null;
  return cset(key, out);
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
  let sec = null, cik = null, face = null;
  if (!ta) {
    try {
      cik = (await cikMap()).get(secSym(sym)) || null;
      if (cik) {
        const SH = { headers: { 'User-Agent': SEC_UA() } }, prev = CIK_PREV[cik];
        const subP = getJson('https://data.sec.gov/submissions/CIK' + cik + '.json', SH, 8000).catch(() => null);
        // חברת אחזקות חדשה בלי דוח שנתי עדיין — הדוח האחרון של הישות הקודמת
        const faceP = subP.then(async (sb) => (await secFace(cik, sb)) || (prev ? secFace(prev, await getJson('https://data.sec.gov/submissions/CIK' + prev + '.json', SH, 8000)) : null))
          .catch((e) => { errs.push('face:' + String((e && e.message) || 'x').slice(0, 24)); return null; });
        const factsP = getJson('https://data.sec.gov/api/xbrl/companyfacts/CIK' + cik + '.json', SH, 15000);
        const prevP = prev ? getJson('https://data.sec.gov/api/xbrl/companyfacts/CIK' + prev + '.json', SH, 15000).catch(() => null) : null;
        const [facts0, sub, fc, pf] = await Promise.all([factsP, subP, faceP, prevP]);
        const facts = pf ? mergeFacts(pf, facts0) : facts0;
        face = fc;
        const m = await monthly;
        sec = normalizeSec(facts, (m && m.splits) || [], face);
        if (sec && sub) { sec.sic = sub.sic || null; sec.sicDesc = sub.sicDescription || null; sec.fye = sub.fiscalYearEnd || null;
          const fl = ((sub.filings && sub.filings.recent && sub.filings.recent.filingDate) || [])[0]; sec.lastFiled = fl || null; }
      }
    } catch (e) { errs.push('sec:' + String(e.message || 'x').slice(0, 24)); }
  }
  const [m, s, y, n, peers] = await Promise.all([monthly, summary, ysTs, nq, peersP]);
  const useSec = sec && sec.fy.length >= 2;
  const base = useSec ? sec : y;
  if (!base || !base.fy || !base.fy.length) return { ok: false, error: 'no_data', errs };
  const fcRes = useSec ? faceCheck(sec, face, (m && m.splits) || []) : { out: [], seen: { n: 0, ok: 0 }, fill: [] };
  // מה שהדוח הדפיס ואין אצלנו / הוצג מחדש — נכנס לנתונים, ונרשם כבדיקה (לא כפער: הערך עכשיו כמו בדוח)
  const ffix = [];
  for (const f of fcRes.fill) {
    sec.A[f.m][f.i] = f.v;
    ffix.push({ k: f.old == null ? 'ffill' : 'ffix', m: f.m, p: sec.fy[f.i], f: f.v, v: f.old });
    if ((f.m === 'rev' || f.m === 'cogs') && sec.A.gp && sec.A.rev[f.i] != null && sec.A.cogs && sec.A.cogs[f.i] != null && (sec.A.gp[f.i] == null || (sec.derived && (sec.derived.gp || []).includes(sec.fy[f.i]))))
      sec.A.gp[f.i] = sec.A.rev[f.i] - sec.A.cogs[f.i];
  }
  const checks = useSec ? validate(sec).concat(crossCheck(sec, y), fcRes.out, ffix) : [];
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
    derived: useSec ? sec.derived : null, C: useSec ? sec.C : null, ifrs: useSec ? !!sec.ifrs : false,
    sic: useSec ? sec.sic : null, sicDesc: useSec ? sec.sicDesc : null, fye: useSec ? sec.fye : null, lastFiled: useSec ? sec.lastFiled : null,
    prof: s ? s.prof : null, price: s ? s.price : null, prev: s ? s.prev : null,
    sharesOut: sharesOut || (s && s.sharesOut) || null, fill, fpe: s ? s.fpe : null, peg: s ? s.peg : null, beta: s ? s.beta : null,
    est: s ? s.est : [], hist: s ? s.hist : [], nextEarn: s ? s.nextEarn : null, nq: n || null,
    px: m ? m.px : null, splits: m ? m.splits : [], peers: peers || [],
    ind: industryFor(s && s.prof && s.prof.industry), checks, errs,
    // מקור ושקיפות (שכבה 6): התגית שנבחרה לכל שורה, הדוח שמולו נבדקנו, וכמה ערכים תאמו לו
    tags: useSec ? sec.tags : null,
    face: useSec && face ? { form: face.form, filed: face.filed, acc: face.acc, url: face.url, n: fcRes.seen.n, ok: fcRes.seen.ok } : null,
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

module.exports = { handle, fundamentals, macro, yahooMonthly, normalizeSec, mergeTags, fixRuns, faceCheck, secFace, cikMap, secSym, mergeFacts, CIK_PREV, validate, crossCheck, parseYahooTs, parseSummary, parseMonthly, parseNasdaq, parsePeers, parseFred, parseTreasury,
  industryFor, industryData, _cache: cache };
