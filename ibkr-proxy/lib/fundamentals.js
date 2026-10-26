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
  rev: ['RevenuesNetOfInterestExpense', 'Revenues', 'RegulatedAndUnregulatedOperatingRevenue', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet', 'RevenueFromContractWithCustomerIncludingAssessedTax', 'SalesRevenueGoodsNet', 'RegulatedOperatingRevenue', 'OperatingLeaseLeaseIncome'],
  cogs: ['CostOfRevenue', 'CostOfGoodsAndServicesSold', 'CostOfGoodsSold', 'CostOfServices', 'CostOfGoodsAndServiceExcludingDepreciationDepletionAndAmortization'], // האחרונה: Uber, ‏Newmont ("Costs applicable to sales")
  gp: ['GrossProfit'],
  op: ['OperatingIncomeLoss'],
  // 'ProfitLoss-…NoncontrollingInterest' = הרווח הכולל פחות זכויות המיעוט (diffFacts) — הרווח לבעלי המניות כשהחברה לא מתייגת
  // NetIncomeLoss: ‏Bloom Energy (תגית פרטית לשורה), ‏Realty Income ‏2026 (רק ב־10-K). עד 26/10/2026 ‏ProfitLoss נכנס כמו שהוא — כולל זכויות המיעוט
  ni: ['NetIncomeLoss', 'NetIncomeLossAvailableToCommonStockholdersBasic', 'ProfitLoss-NetIncomeLossAttributableToNoncontrollingInterest', 'ProfitLoss'],
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
/* McKesson ‏"Redeemable noncontrolling interests" ‏$943M, ‏Omnicom ‏"Temporary Equity" ‏$363M — בלעדיהן נספרו בסך ההתחייבויות
   המחושב. רק כשהן שורה במאזן המודפס: NiSource מתייגת ‏$1.36B בביאור (זכויות המיעוט שלה בתוך ההון — חיסור כפול) */
const TMP_FACE = ['RedeemableNoncontrollingInterestEquityCommonCarryingAmount', 'RedeemableNoncontrollingInterestEquityFairValue', 'RedeemableNoncontrollingInterestEquityOtherCarryingAmount'];
const INST = {
  // מזומן = השורה במאזן. 'Cash' — מבטחים ושירותים (AIG, Hartford, Eversource מדפיסים "Cash"); הכולל מזומן מוגבל
  // (סך תזרים המזומנים — כולל מזומן של פעילות שנמכרה / מוחזקת למכירה) רק כשאין שורת מאזן לאותו תאריך (cashMerge)
  cash: ['CashAndCashEquivalentsAtCarryingValue', 'CashAndCashEquivalentsAtCarryingValueIncludingDiscontinuedOperations', 'Cash',
    'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents'],
  msec: ['MarketableSecuritiesCurrent', 'AvailableForSaleSecuritiesDebtSecuritiesCurrent', 'ShortTermInvestments'],
  debt: ['LongTermDebt'],
  debtNc: ['LongTermDebtNoncurrent'], debtC: ['LongTermDebtCurrent'], stb: ['ShortTermBorrowings', 'CommercialPaper'],
  eq: ['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'],
  eqt: ['StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'], // כולל זכויות מיעוט — לזהות המאזן
  // ADM: ‏…NoncontrollingInterests (ברבים) — בלעדיה ההון הזמני ($287M) נספר בסך ההתחייבויות המחושב
  tmp: ['TemporaryEquityCarryingAmountIncludingPortionAttributableToNoncontrollingInterest', 'TemporaryEquityCarryingAmountIncludingPortionAttributableToNoncontrollingInterests',
    'RedeemableNoncontrollingInterestEquityCarryingAmount', 'TemporaryEquityCarryingAmountAttributableToParent',
    ...TMP_FACE],
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
// זרימות שבהן אפשר לבדוק שהרבעונים מאותו בסיס כמו השנה (qmix)
const QPOS = ['cogs', 'dep', 'sbc', 'int']; // הכנסות, מחקר והשקעות הוניות — יכולים להיות מרוכזים ברבעון אחד בצדק
/* באיזה דוח מופיעה כל שורה (לבחירת התגית לפי הדוח שהחברה הגישה — lib/secface.js) */
const STMT_OF = { rev: ['is'], cogs: ['is'], gp: ['is'], op: ['is'], ni: ['is', 'cf'], pretax: ['is'], tax: ['is'], rnd: ['is'], int: ['is'], eps: ['is'], sh: ['is'],
  nic: ['is'], eqt: ['bs'], tmp: ['bs'], ocf: ['cf'], capex: ['cf'], sbc: ['cf'], dep: ['cf', 'is'], buy: ['cf'], divp: ['cf'],
  cash: ['bs'], msec: ['bs'], debtNc: ['bs'], debtC: ['bs'], stb: ['bs'], eq: ['bs'], ta: ['bs'], tl: ['bs'], tle: ['bs'], ca: ['bs'], cl: ['bs'], re: ['bs'], ppe: ['bs'] };
/* השקעות הוניות = כל השורות של רכישת נכסים קבועים שהחברה מציגה בתזרים (Mastercard: רכוש קבוע + תוכנה מהוונת;
   Caterpillar: + ציוד שמושכר ללקוחות). סכום רק כשיותר משורה אחת מופיעה בדוח, ורק בתקופות שבהן כל החלקים קיימים — אחרת קפיצה מדומה. */
const CAPEX_PARTS = ['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets', 'PaymentsToAcquireSoftware', 'PaymentsToDevelopSoftware',
  'PaymentsForSoftware', 'PaymentsToAcquireEquipmentOnLease', 'PaymentsToAcquireOtherPropertyPlantAndEquipment', 'PaymentsForCapitalImprovements',
  'PaymentsToAcquireOilAndGasPropertyAndEquipment', 'PaymentsToAcquireOilAndGasProperty', 'PaymentsToAcquireMiningAssets',
  // חברות חשמל: "Construction Expenditures" (AEP — עד 26/10/2026 נבחרה במקומה "Acquisitions of Generation Facilities", ‏$155M
  // במקום ‏$7.4B); Dow: "Capital expenditures" בתגית מכונות וציוד
  'PaymentsForConstructionInProcess', 'PaymentsToAcquireMachineryAndEquipment',
  // קידוח ופיתוח של נפט וגז (Diamondback: "Additions to oil and natural gas properties" — עד 26/10/2026 נבחרה במקומה
  // "Property acquisitions", ‏$5.9B במקום ‏$3.5B); ריט: פיתוח ושיפורים (Camden: "Development and capital improvements" — נבחרה
  // "Increase in non-real estate assets", ‏$2.4M במקום ‏$440M)
  'PaymentsToExploreAndDevelopOilAndGasProperties', 'PaymentsToDevelopRealEstateAssets',
  // Host Hotels: "Renewals and replacements" ‏+ "Return on investment" (נבחרה רק השנייה — ‏$282M מתוך ‏$644M); Extra Space:
  // "Purchase of equipment and fixtures" לצד הפיתוח
  'PaymentsToAcquireOtherProductiveAssets', 'PaymentsToAcquireFurnitureAndFixtures'];
const CAPEX_SOFT = ['PaymentsToAcquireSoftware', 'PaymentsToDevelopSoftware', 'PaymentsForSoftware']; // תוכנה לבד אינה כל ההשקעה ההונית
// קידוח ופיתוח של נפט וגז — רק כשאין שורת השקעות הוניות אחרת בדוח (Diamondback). לצד "Capital expenditures" זו השקעה נפרדת
// שהחברה לא סופרת בהשקעות ההוניות (Dow: ‏"Investment in gas field developments")
const CAPEX_LAST = ['PaymentsToExploreAndDevelopOilAndGasProperties'];
// רק לצד שורה אחרת של השקעות הוניות (סכום), לא לבד: פיתוח נדל"ן לבד הוא לרוב חלק (Essex, Ventas — שאר ההשקעות בתגית של החברה),
// ו־PaymentsToAcquireOtherProductiveAssets לבד היא לפעמים רק הקרקע (Delta: ‏"Ground property and equipment" ‏$1.0B מתוך ‏$4.5B)
const CAPEX_PAIR = ['PaymentsToDevelopRealEstateAssets', 'PaymentsToAcquireFurnitureAndFixtures', 'PaymentsToAcquireOtherProductiveAssets'];
// "Other productive assets" = כל דבר: רק כשהתווית אומרת השקעה הונית (Host: ‏"Renewals and replacements"), לא רכישת עסקים
// (McDonald's ‏"Purchases of restaurant businesses"), "Purchases of other assets" (Paychex), נכסים בלתי מוחשיים (Twilio)
const capexLabel = (t, lb) => t !== 'PaymentsToAcquireOtherProductiveAssets' ||
  (/capital expenditure|renewal|replacement|construction|propert|equipment/i.test(lb) && !/business|intangible|other assets|long-lived|software development/i.test(lb));
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
/* הפרש של שתי תגיות (רווח כולל פחות זכויות מיעוט): כל תקופה ששתיהן קיימות בה; לכל הגשה שבשתיהן — ההפרש באותה הגשה */
function diffFacts(a, b) {
  const out = { dur: new Map(), inst: new Map(), unit: a.unit };
  for (const [kk, h] of a.dur) {
    const x = b.dur.get(kk); if (!x) continue;
    const o = { v: h.v - x.v, filed: h.filed > x.filed ? h.filed : x.filed, ann: h.ann };
    if (h.all && x.all) { o.all = new Map(); for (const [f, v] of h.all) if (x.all.has(f)) o.all.set(f, v - x.all.get(f)); }
    out.dur.set(kk, o);
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

/* עלות המכר בכמה שורות בדוח (26/10/2026): חברה שלא מציגה רווח גולמי ומדפיסה כמה שורות "Cost of …" בתגיות שונות — EchoStar
   ("Cost of services" ‏9,445 + "Cost of sales - equipment and other" ‏1,685 ב־OtherCostOfOperatingRevenue), SBA ("Cost of site leasing"
   בתגית פרטית + "Cost of site development"; הסך ב־CostOfRevenue — לא בדוח), Alnylam ("Cost of collaborations and royalties" בתגית
   פרטית). עד היום נלקחה שורה אחת (התגית שבדוח גוברת), והרווח הגולמי כלל את שאר העלות (SBA ‏2025: ‏93% במקום 75%; Yahoo ו־Nasdaq —
   הכל). מחזיר null (שורה אחת), { tot } — תגית שאינה בדוח וערכה = סכום השורות בכל שנה מודפסת (גוברת), { parts } — כל השורות
   בתגיות של SEC (הסכום הוא מועמד, כמו בהשקעות ההוניות), או { ext } — שורה בתגית פרטית שאין ב־SEC ומעל 0.5% מההכנסות */
const COST_LAB = /^\s*(total\s+)?costs?\s+(of|applicable)\b/i;
function costRows(face, tax, list, unit, revTag) {
  const S = face && face.is; if (!S || !S.rows || S.rows.some((r) => r.tag === 'GrossProfit')) return null;
  const cr = S.rows.filter((r) => !r.total && COST_LAB.test(r.label || '')), ctags = [...new Set(cr.map((r) => r.tag))];
  if (ctags.length < 2) return null;
  const fv = faceYearVals(face, ['is'], unit), ends = [...new Set([...fv.keys()].map((kk) => kk.split('|')[1]))];
  const sumAt = (e) => { let t = 0; for (const g of ctags) { const v = fv.get(g + '|' + e); if (v == null) return null; t += Math.abs(v); } return t; };
  const ys = ends.map((e) => [e, sumAt(e)]).filter(([, v]) => v != null);
  if (!ys.length) return null;
  const at = (tag, e) => { const n = tax[tag]; if (!n) return null; let b = null; for (const x of (n.units && n.units[unit]) || []) if (x.end === e && x.start && day(e) - day(x.start) >= 350 && (!b || x.filed > b.filed)) b = x; return b ? Math.abs(b.val) : null; };
  const tot = list.concat(['CostOfRevenue', 'CostOfGoodsAndServicesSold', 'CostOfGoodsAndServiceExcludingDepreciationDepletionAndAmortization'])
    .find((t) => !ctags.includes(t) && ys.every(([e, v]) => { const x = at(t, e); return x != null && Math.abs(x - v) <= 0.005 * v; }));
  if (tot) return { tot };
  if (ctags.every((t) => tax[t] && cr.some((r) => r.tag === t && /^(us-gaap|ifrs-full)$/.test(r.ns)))) return { parts: ctags };
  // תגית פרטית: מהותי רק מעל 0.5% מההכנסות בשנה מודפסת כלשהי (הסטייה המותרת בבדיקות) — אחרת השורה הגדולה מספיקה
  const big = ctags.filter((t) => !tax[t] || !cr.some((r) => r.tag === t && /^(us-gaap|ifrs-full)$/.test(r.ns)));
  return ys.some(([e]) => { const rv = fv.get(revTag + '|' + e), x = big.reduce((t, g) => t + Math.abs(fv.get(g + '|' + e) || 0), 0); return !rv || x > 0.005 * Math.abs(rv); }) ? { ext: big } : null;
}

/* בסיס עלות המכר (26/10/2026): רווח גולמי = הכנסות − עלות המכר רק כשעלות המכר היא באמת עלות ההכנסות.
   חברה שלא מציגה רווח גולמי ומתייגת CostOfGoodsAndServicesSold על שורה אחת מתוך כמה עלויות ישירות — UnitedHealth
   ("Cost of products sold" ‏$50B מול "Medical costs" ‏$299B ⇒ "רווח גולמי" של 89%), Cigna, Crown Castle (שכירות האתרים
   בתגית אחרת), CenterPoint ו־Alliant (דלק וגז בתגיות של חברות חשמל), EQT (עלויות הפקה) — אצל Yahoo, ‏S&P ו־Nasdaq
   שלושה מספרים שונים, ו־S&P לא מציג בכלל ל־UnitedHealth. גם תגית שלא מופיעה בדוח השנתי (McDonald's: ב־10-Q בלבד, רכיב אחד)
   לא מגדירה עלות מכר. מחזיר: 'gp' (החברה מציגה רווח גולמי), 'ok', 'part' (שורה חלקית), 'off' (לא בדוח), 'sum' (עוד שורת "Cost of" בתגית
   פרטית שאין ב־SEC — costRows; Yahoo משלים את השנים), null (אין דוח לבדוק) */
const COST_SIB = /^(PolicyholderBenefitsAndClaimsIncurred|BenefitsLossesAndExpenses$|LiabilityForFuturePolicyBenefitsPeriodExpense|DirectCostsOfLeasedAndRentedPropertyOrEquipment|CostOfOtherPropertyOperatingExpense|UtilitiesOperatingExpense|CostOfPurchasedPower|FuelCosts|CostOfNaturalGasPurchases|ResultsOfOperations(ProductionOrLiftingCosts|ExpenseFromOilAndGasProducingActivities)|OilAndGasProductionExpense)/;
function cogsBasis(face, tags, cogsTags, cs) {
  const S = face && face.is; if (!S || !S.rows || !S.rows.length) return null;
  const rows = S.rows.filter((r) => /^(us-gaap|ifrs-full)$/.test(r.ns));
  if (rows.some((r) => r.tag === 'GrossProfit')) return 'gp';
  if (!rows.some((r) => r.tag === tags.rev || r.tag === tags.ni || r.tag === tags.op)) return null; // לא דוח רווח והפסד שזיהינו
  const c = tags.cogs; if (!c) return null;
  // עלות המכר בכמה שורות בדוח (costRows): הסכום / התגית הכוללת שנבחרו = כל השורות — 'ok'; שורה בתגית פרטית שאין ב־SEC — 'sum'
  if (cs && cs.pick && c === cs.pick) return 'ok';
  if (cs && cs.ext) return 'sum';
  const row = rows.find((r) => r.tag === c);
  if (!row) return 'off';
  if (c === 'CostOfRevenue' || c === 'CostOfSales' || row.total) return 'ok';
  return rows.some((r) => !r.total && r.tag !== c && (COST_SIB.test(r.tag) || cogsTags.includes(r.tag))) ? 'part' : 'ok';
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
  // סוף התקופה של כל הגשה (המאוחר ביותר שהיא מדווחת בתגית הזו) — ערך מאזן "קרוב" = מופיע במאזן של אותה הגשה
  // (השנה או השנה שלפניה); "רחוק" = שנתיים ויותר לפני (מתוך תזרים המזומנים / דוח ההון / ביאור — לרוב אחרי הצגה מחדש של פעילות שנמכרה)
  const accEnd = new Map(), accK = (x) => x.accn || x.form + '|' + x.filed;
  for (const x of node.units[unit] || []) { const a = accK(x), e = accEnd.get(a); if (!e || x.end > e) accEnd.set(a, x.end); }
  const accYr = new Map(); // לכל הגשה: [סוף, ערך] של השנים שבה (cmp)
  for (const x of node.units[unit] || []) if (x.start && day(x.end) - day(x.start) >= 350) { const a = accK(x); if (!accYr.has(a)) accYr.set(a, []); accYr.get(a).push([x.end, x.val]); }
  // עמודת המרה (convenience translation): דוח שבו התגית מדווחת ביותר ערכים במטבע אחר (השנה והשוואות) — הדוח הוגש במטבע
  // האחר, והעמודה במטבע הדיווח של היום היא תרגום בשער של סוף השנה (Nebius עד 2023: רובל, ולצידו דולר בשער 70.34) — לא נכנסת.
  // (Alibaba: יואן לכל השנים, דולר רק לשנה האחרונה — היואן נשאר)
  const conv = new Set();
  if (exact) {
    const cnt = new Map(), inc = (a, u) => { const o = cnt.get(a) || {}; o[u] = (o[u] || 0) + 1; cnt.set(a, o); };
    for (const u of units) if (/^[A-Z]{3}(\/shares)?$/.test(u)) for (const x of node.units[u]) inc(accK(x), u);
    for (const [a, o] of cnt) if (o[unit] && Object.entries(o).some(([u, n]) => u !== unit && n > o[unit])) conv.add(a);
  }
  const allv = new Map(); // לכל תקופה: כל הערכים לפי תאריך ההגשה — לצמיחה מול השנה הקודמת באותו דוח (comparable)
  for (const x of node.units[unit] || []) {
    if (!FORMS.test(x.form || '') || x.val == null || (conv.size && conv.has(accK(x)))) continue;
    if (x.start) {
      // תקופה של שנה שלמה: ערך מדוח שנתי גובר על ערך מדוח רבעוני גם כשהרבעוני הוגש אחריו
      // (Comfort Systems: 10-Q תייג "שנה" של $1.8B — במקום $9.1B של ה־10-K)
      const k = x.start + '|' + x.end, h = out.dur.get(k), ann = !/^10-Q/.test(x.form), yr = day(x.end) - day(x.start) >= 350;
      if (!yr || ann) { let a = allv.get(k); if (!a) allv.set(k, (a = new Map())); a.set(x.filed, x.val); }
      // שנה מדוח שנתי שבו היא כבר לא עמודת השוואה (יותר משנתיים לפני השנה האחרונה של אותה הגשה), וערכה = ערך של שנה אחרת באותה
      // הגשה — העתקה שגויה של החברה: נחותה מדוח שבו היא עמודה (AvalonBay: ה־10-K של 2025 תייג את 2022 בערך של 2025, ‏$3.09B; שלושת
      // הדוחות שבהם 2022 מודפסת: ‏$2.74B). הצגה מחדש אמיתית בטבלת חמש השנים (GE, CME) — נשארת, כמו קודם
      const cmp = yr && ann ? (day(accEnd.get(accK(x))) - day(x.end) <= 2 * 366 + 130 || !(accYr.get(accK(x)) || []).some(([e2, v2]) => e2 !== x.end && v2 === x.val) ? 1 : 0) : null;
      if (!h || (yr && h.ann !== ann ? ann : yr && ann && h.cmp !== cmp ? cmp > h.cmp : h.filed < x.filed)) out.dur.set(k, { v: x.val, filed: x.filed, ann, cmp });
    } else {
      // גם במאזן: ערך מדוח שנתי גובר על השוואה בדוח רבעוני מאוחר יותר (תיקון לאחור ב־10-Q — eBay: הון 2025
      // ‏$4.48B ב־10-Q של 2026 מול $4.62B שהודפס ב־10-K). דוח שנתי מאוחר יותר עדיין גובר לפי תאריך ההגשה
      // דירוג: דוח שנתי שבמאזן שלו מופיע התאריך (2) > דוח שנתי מאוחר בשנתיים ויותר (1) > דוח רבעוני (0); באותה דרגה — האחרון שהוגש.
      // (Baxter/Carrier/Leidos: מזומן 2022 מה־10-K של 2024 = יתרת פתיחה בתזרים אחרי הפרדת פעילות — לא מה שהודפס במאזן;
      // MicroStrategy: ההון של 2024 בדוח ההון של 2026 = אחרי אימוץ תקן. במדגם של 97 חברות: זהות המאזן נשברה ב־44 שנים, אחרי — ב־5)
      const h = out.inst.get(x.end), ann = !/^10-Q/.test(x.form);
      const q = ann ? (day(accEnd.get(accK(x))) - day(x.end) <= 400 ? 2 : 1) : 0;
      if (!h || (h.q !== q ? q > h.q : h.filed < x.filed)) out.inst.set(x.end, { v: x.val, filed: x.filed, ann, q });
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
function mergeTags(fs, lock, qclash, best) {
  const last = (f) => { let e = ''; for (const kk of f.dur.keys()) { const x = kk.split('|')[1]; if (x > e) e = x; } for (const x of f.inst.keys()) if (x > e) e = x; return e; };
  const has = fs.map((f) => f.dur.size + f.inst.size > 0);
  const m = { dur: new Map(), inst: new Map() };
  // הראשית = הראשונה בסדר העדיפות מבין התגיות שעדיין מדווחות (עד שנה מהתקופה המאוחרת ביותר)
  const top = Math.max(...fs.map((f, i) => (has[i] ? day(last(f)) : -Infinity)));
  if (!isFinite(top)) return m;
  const spine = fs.findIndex((f, i) => has[i] && day(last(f)) >= top - 400);
  m.spine = spine; m.fs = fs; // כל המועמדות — לזיהוי הצגה מחדש בכל תגית (subPick)
  // best (הרווח הנקי): התגיות המשלימות לפי ההתאמה לראשית — הקרובה קודם, לא לפי סדר העדיפות. ‏CME: ‏ProfitLoss = הרווח הנקי
  // בכל תקופה משותפת, והרווח "לבעלי המניות הרגילות" (אחרי ניירות משתתפים) נמוך ב־1.3% — עד 26/10/2026 הוא השלים את הרבעונים,
  // והרבעון הרביעי של 2024 יצא שנה (רווח נקי) פחות תשעה חודשים (לבעלי המניות) — ‏$908M במקום ‏$875M. ‏Southern: ההפך —
  // ‏ProfitLoss כולל זכויות מיעוט, והרווח לבעלי המניות זהה לרווח הנקי. שוויון — לפי סדר העדיפות; בלי תקופה משותפת — אחרונות
  const rest = fs.map((_, j) => j).filter((j) => j !== spine && has[j]);
  if (best) { const g = new Map(rest.map((j) => [j, tagGap(fs[spine], fs[j])])); rest.sort((a, b) => (g.get(a) ?? Infinity) - (g.get(b) ?? Infinity) || a - b); }
  const okAlt = [];
  for (const i of [spine, ...rest]) {
    const f = fs[i];
    if (i !== spine) {
      const g = tagGap(m, f);
      if (g != null && g > MERGE_TOL) {
        // השקעות הוניות (qclash): תגית שנדחתה בגלל שנים שלא מסכימות — המצטברים הרבעוניים שלה עדיין נכנסים בשנים שאין לה
        // בהן ערך שנתי משלה (אין עדות שהיא מודדת שם משהו אחר). WEC: ב־10-K ‏"Capital expenditures" עבר ל־
        // PaymentsToAcquireOtherPropertyPlantAndEquipment, וב־10-Q נשאר PaymentsToAcquirePropertyPlantAndEquipment
        // (רק תקופות של פחות משנה: שנים שלמות שלה ליד שנים של הסדרה = קפיצה, ו־fixRuns היה מחליף בהן את כל הסדרה)
        if (qclash) {
          const yrs = [...f.dur.keys()].map((k) => k.split('|')).filter(([a, b]) => day(b) - day(a) >= 350);
          for (const [kk, v] of f.dur) {
            const [a, b] = kk.split('|'); if (day(b) - day(a) >= 350 || m.dur.has(kk)) continue;
            if (!yrs.some(([ya, yb]) => ya <= a && yb >= b)) m.dur.set(kk, v);
          }
        }
        continue;
      }
    }
    // רבעון ישיר (3 חודשים) מתגית משלימה — לא כשהמצטבר של התגית עצמה (מתחילת השנה עד סוף הרבעון, או עד הרבעון שלפניו)
    // שונה מהמצטבר של הסדרה באותה תקופה: היא מודדת ברבעונים משהו אחר. Copart: ‏PaymentsToAcquireProductiveAssets מסכימה
    // בשנים, אבל חצי השנה שלה ‏$412M מול ‏$353M — הרבעון השני שלה ‏$174M נכנס במקום ‏$117M, והשלישי ‏$70M במקום ‏$128M.
    // מצטברים שווים (Fortive: אותו מדד בתגית של הדוח הרבעוני) — הרבעון הישיר נכנס (הוא על בסיס הדוח שבו הוא מופיע). רק בהשקעות הוניות (qclash)
    const clash = (kk) => {
      const [s, e] = kk.split('|'), L = day(e) - day(s); if (L < 80 || L > 100) return false;
      const diff = (k2) => { const h = f.dur.get(k2), x = m.dur.get(k2); return !!(h && x && x.v && Math.abs(h.v - x.v) > MERGE_TOL * Math.abs(x.v)); };
      for (const k2 of f.dur.keys()) {
        const [s2, e2] = k2.split('|'); if (e2 !== e || day(s) - day(s2) < 60) continue; // מצטבר מתחילת השנה עד סוף הרבעון
        if (diff(k2)) return true;
        for (const k1 of f.dur.keys()) { const [s1, e1] = k1.split('|'), g = day(e) - day(e1); if (s1 === s2 && g >= 80 && g <= 100 && diff(k1)) return true; }
      }
      // הרבעון הישיר מול המצטברים של הסדרה באותו דוח: כשהמצטבר עד סוף הרבעון הוגש באותו דוח כמו הרבעון הישיר, והוא עדיין
      // הערך הראשון שדווח (אין הצגה מחדש בדרך — המצטבר הקודם מאותו בסיס), ההפרש ביניהם הוא הרבעון שבתזרים. Republic Services:
      // ‏PaymentsToAcquireProductiveAssets ברבעון = ההשקעות לפי מגזר בביאור (‏$453.7M), בתזרים ‏$1,357.4M − ‏$917.9M = ‏$439.5M.
      // הוצג מחדש באותו דוח — המצטבר הזה או של השנה הקודמת שמוצג לצידו (Fortive אחרי Ralliant: תשעה חודשים של 2024
      // ‏$63.5M במקום ‏$83.4M, וחצי השנה מהבסיס החדש לא פורסם) — הרבעון הישיר נכנס: הוא היחיד מהבסיס של הדוח
      const fd = f.dur.get(kk).filed, near = (a, b) => Math.abs(a - b) <= MERGE_TOL * Math.max(Math.abs(a), Math.abs(b));
      const first = (h) => h.all.get([...h.all.keys()].sort()[0]);
      for (const [k2, c] of m.dur) {
        const [s2, e2] = k2.split('|'); if (e2 !== e || !c.all || !c.all.has(fd) || day(s) - day(s2) < 60) continue;
        if (!near(first(c), c.all.get(fd))) continue;
        let py = null; for (const [k3, h3] of m.dur) { const [s3, e3] = k3.split('|'); if (Math.abs(day(s3) - day(s2) + 365) <= 8 && Math.abs(day(e3) - day(e2) + 365) <= 8 && h3.all && h3.all.has(fd)) py = h3; }
        if (!py || !near(first(py), py.all.get(fd))) continue;
        for (const [k1, p] of m.dur) {
          const [s1, e1] = k1.split('|'), g = day(s) - day(e1); if (s1 !== s2 || g < 0 || g > 5) continue;
          const pf = p.all ? [...p.all.keys()].filter((x) => x <= fd).sort().pop() : null, pv = pf ? p.all.get(pf) : p.filed <= fd ? p.v : null;
          if (pv != null && !near(c.all.get(fd) - pv, f.dur.get(kk).v)) return true;
        }
      }
      return false;
    };
    for (const [kk, v] of f.dur) if (!m.dur.has(kk) && (i === spine || !qclash || !clash(kk))) m.dur.set(kk, v);
    for (const [kk, v] of f.inst) if (!m.inst.has(kk)) m.inst.set(kk, v);
    if (i !== spine) okAlt.push(f);
  }
  // השקעות הוניות (qclash): שורה בתזרים מוצגת תמיד מול אותה תקופה בשנה הקודמת, באותו דוח. ערך של הראשית שבדוח שלו אין לה
  // השוואה כזו, כשתגית משלימה (שמסכימה איתה בשנים) כן מציגה את שתיהן באותו דוח בערך אחר — הראשית שם היא ביאור, והמשלימה היא
  // השורה בתזרים. Fortinet 2026: ב־10-Q ‏"Purchases of property and equipment" עבר ל־PaymentsToAcquirePropertyPlantAndEquipment
  // (‏$70.6M), ו־PaymentsToAcquireProductiveAssets נשארה בביאור (‏$47.1M, בלי 2025 לצידה)
  if (qclash) {
    const cmpIn = (f, kk, fd) => { const [a, b] = kk.split('|'); for (const [k2, h] of f.dur) { const [a2, b2] = k2.split('|'); if (Math.abs(day(a2) - day(a) + 365) <= 8 && Math.abs(day(b2) - day(b) + 365) <= 8 && ((h.all && h.all.has(fd)) || h.filed === fd)) return true; } return false; };
    const sp = fs[spine];
    for (const [kk, h] of [...m.dur]) {
      if (sp.dur.get(kk) !== h || cmpIn(sp, kk, h.filed)) continue;
      const alt = okAlt.find((f) => { const x = f.dur.get(kk); return x && x.filed === h.filed && Math.abs(x.v - h.v) > MERGE_TOL * Math.abs(h.v) && cmpIn(f, kk, h.filed); });
      if (alt) m.dur.set(kk, alt.dur.get(kk));
    }
  }
  fixRuns(m, fs, lock && ((kk, v) => lock(spine, kk, v)));
  return m;
}
/* מזומן — לכל תאריך בנפרד: הערך הטוב ביותר (מאזן שנתי > שנתי רחוק > רבעוני), ובאותה דרגה — לפי סדר התגיות.
   כל התגיות הן אותה שורה במאזן בשמות שונים (Eversource: "Cash and cash equivalents" ב־2022, "Cash" מאז; Zoetis: התגית
   הכוללת ב־10-K ‏$2.31B, התגית הרגילה רק בהשוואה המוצגת מחדש ב־10-Q ‏$2.45B) — בלי דחיית תגית שלמה כמו ב־mergeTags.
   הראשית (לתצוגת "מאיפה המספרים") = התגית של התאריך האחרון.
   תאריך שיש לו רק את הסך הכולל מזומן מוגבל: פחות המזומן המוגבל שדווח לאותו תאריך באותה דרגה (Chevron: שורת המאזן בתגית
   של החברה ‏$6.29B = ‏$7.29B פחות ‏$0.17B + ‏$0.82B מזומן מוגבל) — rp = רשימות של תגיות מזומן מוגבל, החלופה הראשונה שקיימת */
const RCASH = [['RestrictedCashCurrent', 'RestrictedCashNoncurrent'], ['RestrictedCashAndCashEquivalentsCurrent', 'RestrictedCashAndCashEquivalentsNoncurrent'],
  ['RestrictedCash'], ['RestrictedCashAndCashEquivalentsAtCarryingValue']];
function cashMerge(fs, rp) {
  const m = { dur: new Map(), inst: new Map() }, from = new Map();
  fs.forEach((f, i) => { for (const [kk, v] of f.inst) { const h = m.inst.get(kk); if (!h || v.q > h.q) { m.inst.set(kk, v); from.set(kk, i); } } });
  const ri = fs.length - 1; // הכולל מזומן מוגבל — אחרון ברשימה
  if (rp) for (const [kk, v] of m.inst) {
    if (from.get(kk) !== ri) continue;
    for (const grp of rp) {
      const xs = grp.map((f) => f.inst.get(kk)).filter((x) => x && x.q === v.q);
      if (!xs.length) continue;
      const r = xs.reduce((t, x) => t + x.v, 0);
      if (r > 0 && r < v.v) m.inst.set(kk, { ...v, v: v.v - r });
      break;
    }
  }
  let last = null; for (const kk of m.inst.keys()) if (!last || kk > last) last = kk;
  if (last) m.spine = from.get(last);
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

/* הפיצולים שמחילים, ותאריך כל אחד. שני מקורות:
   (1) SEC עצמו — אותה תקופה בשתי הגשות עוקבות, ומספר המניות השתנה ביחס "נקי" (2, 3, 1.5, ½…) בשתי תקופות לפחות
       באותו חלון: זה פיצול, והחלון = בין ההגשה האחרונה שלפניו לראשונה שאחריו. Yahoo רושם פיצול הפוך שבא יחד עם פיצול
       חברה כיחס אחר (DuPont 2019: ‏1:3 + Corteva = ‏0.4725; Honeywell 2026: ‏1:2 נרשם כ־0.9535; Hilton, Motorola, Leidos),
       ולפעמים לא בכלל (Arconic 2016). התאריך: של Yahoo כשהוא בתוך החלון, אחרת ההגשה הראשונה שכבר מוצגת מחדש
       (A. O. Smith 2013: ‏10-Q הוגש עשרה ימים לפני הפיצול ש־Yahoo רושם, וכבר הוצג מחדש).
   (2) פיצול של Yahoo שאין לו חלון כזה — אמיתי רק כשהוא מוכח: תקופה שהוגשה לפניו ואחריו (מניות פי היחס, רווח למניה
       חלקי היחס, במרחק לוגריתמי עד 35%); בלי תקופה כזו — הקפיצה בין התקופה האחרונה שהוגשה לפניו לראשונה שאחריו;
       בלי תקופה אחריו — רק פיצול "נקי". פיצול חברה (GE Vernova 1.25, Western Digital 1.323, DuPont/Qnity 2.39) לא עובר */
const SPLIT_CLEAN = [1.5, 2, 3, 4, 5, 6, 7, 8, 10, 15, 20, 25, 50, 100];
function splitPairs(f, sgn) {
  const out = [];
  for (const [k, h] of (f && f.dur) || []) {
    if (!h.all || h.all.size < 2) continue;
    const v = [...h.all].filter(([, x]) => x).sort((p, q) => (p[0] < q[0] ? -1 : 1));
    for (let i = 1; i < v.length; i++) if (v[i][1] * v[i - 1][1] > 0) out.push({ k, a: v[i - 1][0], b: v[i][0], lr: sgn * Math.log(v[i][1] / v[i - 1][1]) });
  }
  return out;
}
function splitPlan(merged, splits) {
  const shp = splitPairs(merged.sh, 1), all = shp.concat(splitPairs(merged.eps, -1));
  // (1) חלונות מ־SEC
  const ev = [];
  for (const p of shp.slice().sort((x, y) => (x.b < y.b ? -1 : 1))) {
    const c = SPLIT_CLEAN.flatMap((x) => [x, 1 / x]).find((x) => Math.abs(p.lr - Math.log(x)) < 0.015); if (!c) continue;
    const o = ev.find((e) => Math.abs(Math.log(e.c / c)) < 0.02 && p.a < e.b && p.b > e.a);
    if (o) { if (p.a > o.a) o.a = p.a; if (p.b < o.b) o.b = p.b; o.n.add(p.k); } else ev.push({ c, a: p.a, b: p.b, n: new Set([p.k]) });
  }
  const used = [], wins = ev.filter((e) => e.n.size >= 2);
  for (const e of wins) {
    // תקופה שלא השתנתה בין שתי הגשות — אין פיצול ביניהן: מצמצם את החלון (DuPont: הרבעון הראשון של 2025 זהה במאי 2025
    // ובמאי 2026 — הפיצול ההפוך אחרי מאי 2026, לא פיצול החברה של נובמבר 2025)
    for (const p of shp) if (Math.abs(p.lr) < 0.015) { if (p.b > e.a && p.b < e.b) e.a = p.b; if (p.a > e.a && p.a < e.b && p.b >= e.b) e.b = p.a; }
    const ys = (splits || []).filter(([sd]) => sd > e.a && sd <= e.b), prod = ys.reduce((t, [, r]) => t * r, 1);
    if (ys.length && Math.abs(Math.log(prod / e.c)) < 0.02) { used.push(...ys); continue; }
    const y1 = ys.slice().sort((x, y) => Math.abs(Math.log(x[1] / e.c)) - Math.abs(Math.log(y[1] / e.c)))[0];
    used.push([ys.length === 1 || (y1 && Math.abs(Math.log(y1[1] / e.c)) < 0.02) ? (y1 || ys[0])[0] : e.b, e.c]);
  }
  // (2) פיצולים של Yahoo מחוץ לחלונות
  const inWin = (x, y) => wins.some((e) => x < e.b && y > e.a); // זוג / תאריך שחוצה חלון — לא ראיה לפיצול אחר
  // פיצול של Yahoo שהוא אותו אירוע כמו חלון (אותו יחס, עד 45 יום מהחלון — A. O. Smith: ‏10 ימים אחרי ההגשה שכבר הוצגה מחדש) — כבר נספר
  const sameEv = (sd, r) => wins.some((e) => Math.abs(Math.log(r / e.c)) < 0.02 && day(sd) > day(e.a) - 45 && day(sd) <= day(e.b) + 45);
  const cand = (splits || []).filter(([sd, r]) => r > 0 && Math.abs(Math.log(r)) > Math.log(1.3) && !wins.some((e) => sd > e.a && sd <= e.b) && !sameEv(sd, r));
  const fsh = merged.sh || { dur: new Map() };
  for (const [sd, ratio] of cand) {
    const lr = Math.log(ratio), clean = Math.abs(ratio - Math.round(ratio)) < 1e-6 && ratio >= 2 || Math.abs(1 / ratio - Math.round(1 / ratio)) < 1e-6 && ratio <= 0.5;
    const other = (a, b) => cand.some(([s2]) => s2 !== sd && s2 > a && s2 <= b) || inWin(a, b);
    const evd = all.filter((p) => p.a < sd && p.b >= sd && !other(p.a, p.b)).map((p) => p.lr).sort((a, b) => a - b);
    let real;
    if (evd.length) real = Math.abs(evd[Math.floor(evd.length / 2)] - lr) < 0.35 * Math.abs(lr);
    else {
      let jump = null;
      for (const want of [[350, 380], [80, 100]]) {
        let b = null, a = null;
        for (const [kk, h] of fsh.dur) {
          const [s0, e0] = kk.split('|'), L = day(e0) - day(s0); if (L < want[0] || L > want[1] || !(h.v > 0)) continue;
          if (h.filed < sd && (!b || e0 > b[0])) b = [e0, h.v]; else if (h.filed >= sd && (!a || e0 < a[0])) a = [e0, h.v];
        }
        if (b && a) { jump = Math.log(a[1] / b[1]); break; }
      }
      real = jump != null ? Math.abs(jump - lr) < 0.35 * Math.abs(lr) : clean;
    }
    if (real) used.push([sd, ratio]);
  }
  const seen = new Set();
  return used.filter(([sd]) => !seen.has(sd) && seen.add(sd)).sort((x, y) => (x[0] < y[0] ? -1 : 1));
}
/* ערכים של תגית (אחרי mergeTags) לבסיס של היום: ממוצע מניות × היחס, למניה ÷ היחס — לכל פיצול שאחרי תאריך ההגשה של הערך */
function splitAdj(f, used, isSh) {
  if (!used.length) return f;
  const fac = (fd) => used.reduce((t, [sd, r]) => (fd < sd ? t * r : t), 1);
  const adj = (v, fd) => { const x = fac(fd); return x === 1 || v == null ? v : isSh ? v * x : Math.round(v / x * 1e4) / 1e4; };
  const one = (h) => { const o = { ...h, v: adj(h.v, h.filed) }; if (h.all) o.all = new Map([...h.all].map(([fd, v]) => [fd, adj(v, fd)])); return o; };
  return { ...f, dur: new Map([...f.dur].map(([k, h]) => [k, one(h)])), inst: new Map([...f.inst].map(([k, h]) => [k, one(h)])) };
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
  let cur = null, cogsRows = null;
  for (const k of Object.keys(map)) {
    // הרווח הנקי — רק מדוח רווח והפסד: התזרים מתחיל ב"רווח נקי" כולל זכויות מיעוט (ProfitLoss), ובלי דוח רווח והפסד
    // שזוהה הוא קפץ לפני NetIncomeLoss (Devon 2024: ‏$2.94B במקום ‏$2.89B; Royal Caribbean, General Mills)
    const onFace0 = faceTagList(face, k === 'ni' ? (face && face.is ? ['is'] : []) : STMT_OF[k]), list = map[k].slice();
    // הפרש תגיות "בדוח" כששני החלקים בדוח (Bloom Energy: "Net loss" ו־"Net income attributable to noncontrolling interest")
    const onFace = onFace0.concat(list.filter((t) => /-/.test(t) && t.split('-').every((x) => onFace0.includes(x))));
    let order = list.filter((t) => onFace.includes(t)).concat(list.filter((t) => !onFace.includes(t))); // בין אלה שבדוח — סדר העדיפות שלנו (מדולל לפני בסיסי)
    // הכנסות: שורת הסיכום שהחברה עצמה מציגה ("Total operating revenues") — לפני שורת רכיב שקודמת לה ברשימה שלנו
    // (NiSource: ‏RegulatedOperatingRevenue ‏$6.64B הוא הסך, RevenueFromContract… ‏$6.52B רק "הכנסות מלקוחות");
    // בלי שורת סך — השורה הגדולה בדוח קודם (Camden: "Property revenues" ‏$1.57B בתגית OperatingLeaseLeaseIncome, ולא דמי ניהול ‏$13M)
    if (k === 'rev' && face && face.is) {
      const big = (t) => Math.max(0, ...face.is.rows.filter((r) => r.tag === t).map((r) => Math.abs(SECFACE.rowVals(face.is, r).find((x) => x != null) || 0)));
      // סך שהכותרת שלו "…and Other Income" (Chevron) נשאר ההכנסות — כפי שמודפס, כמו בסט הזהב וכמו ExxonMobil; שורת המכירות
      // קיימת אצל Chevron רק מ־2018 (8 שנים במקום 19). ההבדל מול Yahoo/Nasdaq (שורת המכירות) = הגדרה, rev_ctr ב־fundxcheck
      const oi = [];
      const tot = list.filter((t) => !oi.includes(t) && face.is.rows.some((r) => r.total && r.tag === t));
      const rest = list.filter((t) => onFace.includes(t) && !tot.includes(t) && !oi.includes(t)).sort((a, b) => big(b) - big(a));
      order = tot.concat(rest, oi, order.filter((t) => !tot.includes(t) && !rest.includes(t) && !oi.includes(t)));
    }
    // מזומן: סדר קבוע — הכולל מזומן מוגבל אחרון גם כשהוא השורה במאזן (בשנים קודמות הוא סך התזרים: IFF 2022 ‏$552M כולל
    // מזומן של פעילות מוחזקת למכירה, מול "מזומן ושווי מזומנים" ‏$483M שהודפס במאזן)
    // לפי המאזן המודפס: 'Cash' רק כשהיא השורה במאזן (או כשאף תגית מזומן לא בו) — Gen Digital: ‏"Cash" בביאור (‏$377M מתוך ‏$828M)
    // נבחרה ברבעונים שבהם המאזן בתגית הכוללת מזומן מוגבל; ‏3M: השורה במאזן בתגית שכוללת מזומן של פעילות שנמכרה
    // (2023 אחרי Solventum ‏$5.74B — הסך הכולל מזומן מוגבל ‏$5.93B הוא מהתזרים) — לפני הסך, כשהיא בדוח
    if (k === 'tmp') order = order.filter((t) => !TMP_FACE.includes(t) || onFace.includes(t));
    if (k === 'cash') {
      const bsT = faceTagList(face, ['bs']), DG = 'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalentsIncludingDisposalGroupAndDiscontinuedOperations';
      order = list.slice();
      if (bsT.includes(DG)) order.splice(order.length - 1, 0, DG);
      if (!bsT.includes('Cash') && order.some((t) => bsT.includes(t))) order = order.filter((t) => t !== 'Cash');
    }
    if (k === 'cogs') { cogsRows = costRows(face, tax, list, rc || cur || 'USD', tags.rev); if (cogsRows && cogsRows.tot) order = [cogsRows.tot, ...order.filter((t) => t !== cogsRows.tot)]; }
    let fs = order.map((tag) => (/-/.test(tag) ? diffFacts(...tag.split('-').map((t) => tagFacts(tax[t], unitOf(k)))) : tagFacts(tax[tag], unitOf(k)))), names = order;
    if (k === 'cogs' && cogsRows && cogsRows.parts) { fs = [sumFacts(cogsRows.parts.map((t) => tagFacts(tax[t], unitOf(k)))), ...fs]; names = [cogsRows.parts.join('+'), ...names]; }
    if (k === 'capex' && !isIfrs) {
      let parts = CAPEX_PARTS.filter((t) => onFace.includes(t) && tax[t]);
      // שורה שהתווית שלה "Acquisition(s) of …" לצד שורת השקעות הוניות אחרת = רכישת נכסים קיימים (תחנות כוח, AEP), לא השקעה הונית.
      // חוץ מציוד להשכרה ללקוחות (PACCAR: "Acquisitions of equipment for operating leases" — חלק מההשקעה, כמו ב־Caterpillar)
      const lab = (t) => { for (const r of (face && face.cf && face.cf.rows) || []) if (r.tag === t) return r.label || ''; return ''; };
      // גם "Property acquisitions" (Diamondback). ציוד שנקנה מחכירה שהחברה עצמה החזיקה ("Purchases of previously leased assets" —
      // Dow: ‏$694M ב־2021 לצד "Capital expenditures" ‏$1.5B) — רכישה חד־פעמית, לא ציוד להשכרה
      const acq = (t) => (t === 'PaymentsToAcquireEquipmentOnLease' ? /previously\s+leased/i : /^acquisitions?\s+of\b|\bacquisitions?\s*(\(|$)/i).test(lab(t));
      if (parts.length > 1) { const keep = parts.filter((t) => !acq(t)); if (keep.length) parts = keep; }
      if (parts.some((t) => !CAPEX_LAST.includes(t))) parts = parts.filter((t) => !CAPEX_LAST.includes(t));
      parts = parts.filter((t) => capexLabel(t, lab(t)));
      if (parts.length === 1 && CAPEX_PAIR.includes(parts[0])) parts = [];
      // הסכום הוא מועמד אחד לצד התגיות לחוד — mergeTags בוחר את הראשית מבין אלה שעדיין מדווחות
      // (Entergy: חברת בת הציגה PaymentsToAcquireProductiveAssets בעמוד, הסכום קיים רק ל־2023, ו־2024–2025 יצאו ריקות)
      if (parts.length > 1) {
        const pf = parts.map((t) => tagFacts(tax[t], unitOf(k))), sf = sumFacts(pf);
        // חלק שהוא כמעט כל הסכום (97% ומעלה בחמש השנים האחרונות) — גם מועמד לבד, להשלים רבעונים שבהם החלק הקטן לא דווח
        // (Camden: "Increase in non-real estate assets" ‏$2.4M רק בחלק מה־10-Q — בלעדיו לא היו רבעונים בכלל)
        const yrs = [...sf.dur.keys()].filter((kk) => { const [a, b] = kk.split('|'); return day(b) - day(a) >= 350; }).sort((a, b) => (a.split('|')[1] < b.split('|')[1] ? -1 : 1)).slice(-5);
        const big = parts.filter((t, i) => !list.includes(t) && yrs.length > 0 && yrs.every((kk) => { const x = pf[i].dur.get(kk), h = sf.dur.get(kk); return x && h.v > 0 && x.v / h.v >= 0.97; }));
        fs = [sf, ...fs, ...big.map((t) => pf[parts.indexOf(t)])]; names = [parts.join('+'), ...names, ...big];
      }
      // שורה אחת בדוח בתגית רכוש קבוע שאינה ברשימה הראשית (Eli Lilly, ADP: PaymentsToAcquireOtherPropertyPlantAndEquipment =
      // "Purchases of property and equipment" / "Capital expenditures") — היא ההשקעות ההוניות. עד 26/10/2026 נשאר ריק והושלם
      // מ־Yahoo, שמחבר גם רכישת מו"פ בתהליך (Lilly ‏$10.8B במקום ‏$7.8B) או תוספות לנכסים בלתי מוחשיים (ADP)
      else if (parts.length === 1 && !list.includes(parts[0]) && !CAPEX_SOFT.includes(parts[0])) { fs = [tagFacts(tax[parts[0]], unitOf(k)), ...fs]; names = [parts[0], ...names]; }
    }
    if (k === 'rev') { const f = fs.find((x) => x.unit && /^[A-Z]{3}$/.test(x.unit)); if (f) cur = f.unit; }
    if (rc) cur = rc;
    // ערך שהדוח המודפס מאשר (התגית שבדוח, אותה שנה, אותו ערך) — fixRuns לא מחליף את הרצף שלו
    // (Ares: ההכנסות באמת קופצות — דמי ביצוע; "Revenues" היא מדד אחר וחלק יותר)
    const fv = faceYearVals(face, STMT_OF[k], rc || cur);
    const lock = (si, kk, v) => { const t = names[si], e = kk.split('|')[1], x = t && fv.get(t + '|' + e); return x != null && Math.abs(Math.abs(x) - Math.abs(v)) <= 0.005 * Math.abs(x); };
    // מזומן: החיסור רק כשהסך הכולל אינו שורה במאזן של ה־10-K האחרון (Bank of America, GE, Erie: "Cash and cash equivalents"
    // במאזן בתגית הכוללת, והמזומן המוגבל — ביאור; חיסור שם = מספר שלא הודפס). בלי מאזן מודפס (לא נטען) — לא מחסרים
    const rsub = k === 'cash' && face && face.bs && face.bs.rows && !onFace.includes(list[list.length - 1]);
    merged[k] = k === 'cash' ? cashMerge(fs, rsub ? RCASH.map((g) => g.map((t) => tagFacts(tax[t], unitOf(k)))) : null) : mergeTags(fs, lock, k === 'capex', k === 'ni'); // רק בהשקעות הוניות: בהכנסות/תזרים התגית המשלימה היא לפעמים הרבעון היחיד (Dollar Tree)
    if (merged[k].spine != null) tags[k] = names[merged[k].spine];
  }
  // השקעות הוניות שבתזרים רק בתגית של החברה (Kimco: ‏"Improvements to operating real estate" ‏$347.6M; ‏Weyerhaeuser, Zimmer,
  // ‏United Rentals) והתגית שלנו אינה שורה בתזרים (ביאור, ‏$18.4M) — עדיף ריק (ומושלם מ־Yahoo) מחלק קטן. לא ב־companyfacts.
  if (!isIfrs && tags.capex && face && face.cf && face.cf.rows && face.cf.rows.length) {
    const rows = face.cf.rows, mine = tags.capex.split('+'), c0 = face.cf.cols && face.cf.cols[0];
    const own = rows.filter((r) => !/^(us-gaap|ifrs-full)$/.test(r.ns) && /capital expenditure|improvements? to|purchases? (of|for) (property|rental|non-rental|equipment)/i.test(r.label || '') && !/accru|incurred|not yet paid|payable|unpaid|non-?cash/i.test(r.label || ''));
    // רק כשהערך שלנו לשנה האחרונה שבדוח שונה מסכום השורות (ConocoPhillips: אותו סכום גם בביאור בתגית רגילה — נשאר)
    const tot = own.reduce((t, r) => t + Math.abs(SECFACE.rowVals(face.cf, r)[0] || 0), 0);
    let ours = null; for (const [kk, h] of merged.capex.dur) { const [a, b] = kk.split('|'); if (c0 && b === c0.end && day(b) - day(a) >= 350) ours = Math.abs(h.v); }
    if (own.length && !rows.some((r) => mine.includes(r.tag)) && !(ours != null && tot > 0 && Math.abs(ours - tot) <= MERGE_TOL * tot)) { merged.capex = { dur: new Map(), inst: new Map() }; delete tags.capex; }
  }
  // פיצולים לפי תאריך ההגשה (26/10/2026): ערך למניה / ממוצע מניות שהוגש לפני הפיצול — מותאם; שהוגש אחריו — החברה
  // כבר הציגה אותו מחדש (ASC 260: כל התקופות בדוח שהוגש אחרי הפיצול), גם כשהתקופה שלו לפני הפיצול. עד היום ההתאמה
  // הייתה לפי תאריך התקופה, וערך שהוצג מחדש (רבעון של שנה קודמת כהשוואה ב־10-Q שאחרי הפיצול — ServiceNow, Carvana,
  // Texas Pacific Land, DuPont בפיצול הפוך) הותאם פעם שנייה; ורבעון אחרון שכבר הוצג מחדש (Booking: ‏10-Q של מרץ
  // הוגש אחרי הפיצול של אפריל) "הוכיח" שאין קפיצה, וכל הרבעונים הישנים נשארו בלי התאמה. לפני כל חישוב — כך שהרבעון
  // הרביעי (4 × שנה פחות שלושה) והרווח למניה הנגזר מחושבים מאותו בסיס
  const splitsUsed = splitPlan(merged, splits);
  for (const k of ['sh', ...PER_SHARE]) if (merged[k]) merged[k] = splitAdj(merged[k], splitsUsed, k === 'sh');
  // ממוצע המניות הבסיסי — לרבעון הרביעי כשיש הפסד (q4Shares)
  const shB = { A: {}, Q: {} };
  { const fb = splitAdj(tagFacts(tax[isIfrs ? 'WeightedAverageShares' : 'WeightedAverageNumberOfSharesOutstandingBasic'], 'shares'), splitsUsed, true);
    for (const [kk, h] of fb.dur) { const [s0, e0] = kk.split('|'), L = day(e0) - day(s0); if (L >= 350 && L <= 380) shB.A[e0] = h.v; else if (L >= 80 && L <= 100) shB.Q[e0] = h.v; } }
  // שנים פיסקליות: תקופות של ~שנה בהכנסות או ברווח הנקי (52/53 שבועות נכללים) — רק מדוח שנתי.
  // Amazon מדפיסה ב־10-Q גם עמודה של 12 החודשים האחרונים: בלי התנאי כל רבעון נעשה "סוף שנה" והטבלה השנתית התערבבה
  const yearOf = new Map(); // end → start
  for (const k of ['rev', 'ni', 'op']) {
    for (const [kk, h] of merged[k] ? merged[k].dur : []) {
      const [s, e] = kk.split('|'), d = day(e) - day(s);
      if (d >= 350 && d <= 380 && h.ann !== false && !yearOf.has(e)) yearOf.set(e, s);
    }
  }
  const fyEnds = [...yearOf.keys()].sort();
  const nextDay = (e) => new Date(Date.parse(e + 'T00:00:00Z') + 864e5).toISOString().slice(0, 10);
  const yStarts = [...new Set(fyEnds.map((e) => yearOf.get(e)).concat(fyEnds.length ? [nextDay(fyEnds[fyEnds.length - 1])] : []))];
  const A = {}, Q = {}, derived = {};
  const qset = new Set();
  const dq = {}; // רבעונים מחושבים ממצטבר: מאילו תקופות ומאיזה דוח — להשוואה מול שנה קודם (cmpRatio)
  /* חיסור של תקופות (שנה פחות תשעה חודשים, או פחות שלושה רבעונים ישירים; חצי שנה פחות רבעון…) — רק מאותו בסיס (26/10/2026).
     לכל ערך: מתי הוגש לראשונה בערך שלו (firstOf), מה היה ידוע בתאריך (asOf). שתי אפשרויות, לפי הסדר:
     (1) הערכים העדכניים — כשהארוך הוגש אחרי שהחלקים קיבלו את ערכם, ואם הארוך הוצג מחדש — גם החלקים הוצגו מחדש אחריו.
         CrowdStrike 2025: השנה הוצגה מחדש בדוח השנתי של 2026 (‎−$19.3M → ‎−$15.2M), ותשעת החודשים לא — ‎−$88.3M במקום ‎−$92.3M שפורסם.
     (2) כפי שדווח בדוח הארוך הראשון (החלקים — כפי שהיו ידועים אז). International Flavors 2024: ‎−$46M, כמו בהודעה לעיתונות.
     הדוח הארוך שבו הוא עצמו שינה בסיס (הציג מחדש את השנה הקודמת) ואין בו את החלקים — לא מחסרים (CrowdStrike 2026: השנה
     בבסיס החדש מול תשעה חודשים בישן = ‎+$59M במקום ‎+$38.7M). כשהדוח השנתי עצמו מציג את החלקים מחדש (Alnylam, Lennox,
     Monolithic Power 2025: תשעה חודשים מתוקנים בתוך ה־10-K) — הם נכנסים, והרבעון הרביעי = כמו בהודעה לעיתונות */
  const firstOf = (h) => { let F = null; if (h.all) for (const [f, v] of h.all) if (Math.abs(v - h.v) <= 1e-9 * Math.max(1, Math.abs(h.v)) && (!F || f < F)) F = f; return F || h.filed; };
  // מתי הערך הנוכחי החליף ערך קודם (null — לא השתנה אף פעם באותה תגית)
  const changedAt = (h) => { const F = firstOf(h); if (h.all) for (const [f, v] of h.all) if (f < F && Math.abs(v - h.v) > 1e-9 * Math.max(1, Math.abs(h.v))) return F; return null; };
  const lastOf = (h) => { let F = h.filed; if (h.all) for (const f of h.all.keys()) if (f > F) F = f; return F; };
  const asOf = (h, T) => { if (!h.all || !h.all.size || changedAt(h) == null) return h.v; let F = null; for (const f of h.all.keys()) if (f <= T && (!F || f > F)) F = f; return F ? h.all.get(F) : null; };
  const moved = (a, b) => Math.abs(a - b) > 0.005 * Math.max(Math.abs(a), Math.abs(b));
  // כמה הדוח T שינה את אותה תקופה בשנה הקודמת (בכל אחת מהתגיות המועמדות; 0 — לא הציג מחדש) = הדוח הזה על בסיס חדש
  const restIn = (fsl, kk, T) => {
    const [s0, e0] = kk.split('|'), L = day(e0) - day(s0);
    let D = 0;
    for (const f of fsl) for (const [k2, p] of f.dur) {
      const [s2, e2] = k2.split('|');
      if (Math.abs(day(e2) - day(e0) + 365) > 10 || Math.abs(day(e2) - day(s2) - L) > 10 || !p.all || !p.all.has(T)) continue;
      let G = null; for (const g of p.all.keys()) if (g < T && (!G || g > G)) G = g;
      if (G && moved(p.all.get(T), p.all.get(G))) D = Math.max(D, Math.abs(p.all.get(T) - p.all.get(G)));
    }
    return D;
  };
  // ha = התקופה הארוכה (kk), comps = [[h, מפתח]] החלקים. חלק "בבסיס הישן" לדוח T = הוגש לפני T, והדוח שלו לא הציג מחדש את השנה
  // הקודמת. ההפרש נחשב רק כשהוא משמעותי: שלושה רבעים מהשינוי בשנה הקודמת מעל 2% מהתוצאה, והשינוי מעל 1% מהתקופה הארוכה
  // (תיקון קטן לאחור — לא; Arthur J. Gallagher: חצי שנה ‏445.7 → ‏448 — הרבעון השני של 2026 ‏$10M נשאר)
  const subPick = (mk, kk, ha, comps) => {
    const fsl = mk.fs || [mk], tot = (a, cs) => a - cs.reduce((t, x) => t + x, 0);
    const old = (T, v) => { const D = restIn(fsl, kk, T); return D * 0.75 > 0.02 * Math.abs(v) && D > 0.01 * Math.abs(ha.v) && comps.some(([h, kc]) => lastOf(h) < T && !restIn(fsl, kc, lastOf(h))); };
    const FL = ha.filed, F0 = ha.all && ha.all.size ? [...ha.all.keys()].sort()[0] : FL, a0 = ha.all && ha.all.has(F0) ? ha.all.get(F0) : ha.v;
    const ch = comps.map(([h]) => changedAt(h)).filter(Boolean), tC = ch.reduce((t, f) => (f > t ? f : t), ''), late = ch.some((f) => f > F0);
    const vL = tot(ha.v, comps.map(([h]) => h.v));
    if (FL >= tC && (moved(ha.v, a0) ? late : !old(FL, vL))) return { v: vL, F: null, same: true };
    const c0 = comps.map(([h]) => asOf(h, F0)), v0 = c0.some((x) => x == null) ? null : tot(a0, c0);
    if (v0 == null || old(F0, v0)) return null;
    return { v: v0, F: F0, same: comps.every(([h], i) => c0[i] === h.v) };
  };
  // השקעות הוניות כפי שמודפסות ("Capital expenditures", "Purchases of property…") לא שליליות. רבעון מחושב שיצא שלילי =
  // שני מצטברים מבסיסים שונים — הצגה מחדש אחרי פיצול/מכירה שנגעה רק באחד (DuPont: 2024 אחרי Qnity ‏$285M פחות תשעה חודשים
  // מהצגה מחדש אחרת ‏$376M; ‏Honeywell: תשעה חודשים אחרי הפרדת התעופה פחות חצי שנה לפניה). קודם — הזוג כפי שדווח במקור
  // (הדוח הראשון של המצטבר הארוך מול הקצר שהיה בתוקף אז), אחר כך — הקצר שהיה בתוקף כשהארוך האחרון הוגש; אין זוג לא שלילי —
  // הרבעון לא מוצג (qmix). תווית "net" בדוח (Hartford, Lennar: "Net additions of property") — נטו אחרי מכירות, שלילי בצדק
  const netCapex = !!(tags.capex && !/\+/.test(tags.capex) && ((face && face.cf && face.cf.rows) || []).some((r) => r.tag === tags.capex && /\bnet\b/i.test(r.label || '')));
  const qneg = [];
  const pairAt = (h2, h1, o) => { const g = o && h1.all ? [...h1.all.keys()].filter((f) => f <= o).sort().pop() : null; return g ? h2.all.get(o) - h1.all.get(g) : null; };
  const nonNegQ = (k, h2, h1, v) => {
    if (!(v < 0) || k !== 'capex' || netCapex) return v;
    const fs = h2.all ? [...h2.all.keys()].sort() : [];
    for (const x of [pairAt(h2, h1, fs[0]), pairAt(h2, h1, fs[fs.length - 1])]) if (x != null && x >= 0) return x;
    return null;
  };
  const FLOWK = Object.keys(map).filter((k) => !(k in INST) && !['cash', 'eq', 'ta', 'tl', 'ca', 'cl', 're', 'ppe'].includes(k));
  for (const k of Object.keys(map)) { A[k] = {}; Q[k] = {}; }
  for (const k of FLOWK) {
    const dur = merged[k].dur;
    for (const e of fyEnds) { const s = yearOf.get(e), h = dur.get(s + '|' + e); if (h) A[k][e] = h.v; }
    // רבעונים ישירים (~3 חודשים)
    for (const [kk, h] of dur) {
      const [s, e] = kk.split('|'), d = day(e) - day(s);
      if (d >= 80 && d <= 100) {
        // "רבעון" שערכו הוא השנה כולה, כשבאותה שנה יש כבר רבעונים / מצטבר — תיוג שגוי של החברה (Tractor Supply 2025: ההקשר
        // של הרבעון הרביעי ב־10-K קיבל את הרווח השנתי, ‏$1,096M במקום ‏$227M). לא נכנס — הרבעון מחושב משנה פחות תשעה חודשים
        const y0 = yearOf.get(e), av = A[k][e];
        if (k !== 'eps' && k !== 'sh' && y0 && av && Math.abs(h.v - av) <= 1e-3 * Math.abs(av) &&
          [...dur].some(([k2, h2]) => { const [a, b] = k2.split('|'); return a >= y0 && b > y0 && b < e && Math.abs(h2.v) > 0.01 * Math.abs(av); })) continue;
        Q[k][e] = h.v; qset.add(e);
      }
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
          const pk = subPick(merged[k], k2, h2, [[h1, k1]]), v0 = pk && pk.v, v = pk && nonNegQ(k, h2, h1, v0);
          if (v == null) { if (!qneg.some((x) => x.m === k && x.p === e2)) qneg.push({ k: 'qmix', m: k, p: e2, ...(pk ? {} : { x: 'rst' }) }); continue; }
          Q[k][e2] = v; qset.add(e2); (derived[k] = derived[k] || []).push(e2);
          if (v === v0 && pk.same) (dq[k] = dq[k] || {})[e2] = { k2, k1, F: pk.F };
        }
      }
    }
  }
  // רבעון רביעי כשהרבעונים מדווחים ישירות (בלי מצטבר): השנה פחות שלושת הרבעונים שבתוכה
  for (const k of FLOWK) {
    if (k === 'eps' || k === 'sh') continue;
    for (const e of fyEnds) {
      if (Q[k][e] != null || A[k][e] == null) continue;
      if (qneg.some((x) => x.m === k && x.p === e && x.x === 'rst')) continue; // המצטבר כבר הראה בסיסים שונים — לא מנסים מהרבעונים
      const s0 = yearOf.get(e), qs = Object.keys(Q[k]).filter((q) => q > s0 && q < e && day(e) - day(q) < 300);
      if (qs.length === 3) {
        // רבעונים ישירים — אותו כלל של בסיס אחד כמו במצטבר (subPick); רבעון שחושב בעצמו (אין לו תקופה ישירה) — כמו קודם
        const dur = merged[k].dur, ka = s0 + '|' + e, hs = qs.map((q) => { for (const [kk, h] of dur) { const [a, b] = kk.split('|'), L = day(b) - day(a); if (b === q && L >= 80 && L <= 100) return [h, kk]; } return null; });
        const pk = dur.has(ka) && hs.every((x, i) => x && x[0].v === Q[k][qs[i]]) ? subPick(merged[k], ka, dur.get(ka), hs) : { v: A[k][e] - qs.reduce((t, q) => t + Q[k][q], 0) };
        if (!pk) { if (!qneg.some((x) => x.m === k && x.p === e)) qneg.push({ k: 'qmix', m: k, p: e, x: 'rst' }); continue; }
        const v = pk.v;
        if (v < 0 && k === 'capex' && !netCapex) { if (!qneg.some((x) => x.m === k && x.p === e)) qneg.push({ k: 'qmix', m: k, p: e }); continue; }
        Q[k][e] = v; qset.add(e); (derived[k] = derived[k] || []).push(e);
      }
    }
  }
  // "רבעון רביעי" שהוא השנה — כשלשורה אין שנה בכלל (26/10/2026, L3Harris FY2025): בדוח השנתי החברה תייגה את ערכי השנה על הקשר של
  // רבעון; ברווח התפעולי יש גם שנה (‏2,110 בשניהם — הכלל של Tractor Supply למעלה מדלג על ה"רבעון"), אבל להכנסות ולעלות המכר יש רק
  // את ה"רבעון" (‏21,865, ותשעת החודשים ‏16,217) — אז הוא נכנס כרבעון והשנה נשארה ריקה. כשבאותו סוף שנה שורה אחרת מראה את התיוג
  // השגוי (רבעון ישיר = השנה שלה): "רבעון" גדול מתשעת החודשים שלפניו, בשורה בלי שנה, הוא השנה — והרבעון = השנה פחות תשעה חודשים
  {
    const KS = FLOWK.filter((k) => k !== 'eps' && k !== 'sh');
    const q4dir = (k, e) => [...merged[k].dur].find(([kk, h]) => { const [s0, e0] = kk.split('|'); return e0 === e && day(e) - day(s0) >= 80 && day(e) - day(s0) <= 100 && h.ann !== false; });
    for (const e of fyEnds) {
      const y0 = yearOf.get(e);
      if (!KS.some((k) => { const a = A[k][e], x = q4dir(k, e); return a && x && Math.abs(x[1].v - a) <= 1e-3 * Math.abs(a); })) continue;
      for (const k of KS) {
        const x = q4dir(k, e); if (A[k][e] != null || !x || Q[k][e] !== x[1].v) continue;
        let c9 = null;
        for (const [kk, h] of merged[k].dur) { const [s2, e2] = kk.split('|'), g = day(e) - day(e2); if (s2 === y0 && g >= 80 && g <= 100) c9 = h.v; }
        if (!(c9 > 0 && x[1].v > c9)) continue;
        A[k][e] = x[1].v; Q[k][e] = x[1].v - c9; (derived[k] = derived[k] || []).push(e);
      }
    }
  }
  for (const k of Object.keys(map).filter((x) => !FLOWK.includes(x))) {
    for (const [e, h] of merged[k].inst) { if (yearOf.has(e)) A[k][e] = h.v; Q[k][e] = h.v; }
  }
  // רבעונים: רק כאלה שיש להם הכנסות או רווח נקי, 48 האחרונים
  const qEnds = [...qset].filter((e) => Q.rev[e] != null || Q.ni[e] != null).sort().slice(-48);
  // רבעונים שהתגית שלהם אומרת משהו אחר מאשר בשנה: שלושת הרבעונים לא מאותו בסיס כמו השנה (עלות המכר ביחס להכנסות
  // של אותם רבעונים; פחת, תגמול במניות וריבית — 30%–120% מהשנה) — הרבעונים של השנה לא מוצגים (עדיף ריק משגוי). נרשם qmix.
  // (McDonald's, שהביאה את הכלל, מטופלת ב־cogsBasis: עלות המכר רק ב־10-Q ולא בדוח השנתי — 'off')
  const qmix = qneg;
  for (const k of QPOS) {
    if (!Q[k] || !A[k]) continue;
    let lastBad = false;
    for (const e of fyEnds) {
      const av = A[k][e], s0 = yearOf.get(e); if (!(av > 0)) continue;
      const qs = qEnds.filter((q) => q > s0 && q < e && day(e) - day(q) < 300 && Q[k][q] != null);
      if (qs.length !== 3) { if (e === fyEnds[fyEnds.length - 1]) lastBad = false; continue; }
      const s3 = qs.reduce((t, q) => t + Q[k][q], 0);
      // עלות המכר — ביחס להכנסות של אותם רבעונים (עסק עונתי: גם ההכנסות וגם העלות מרוכזות ברבעון הרביעי);
      // פחת, תגמול במניות וריבית — כמעט קבועים לאורך השנה: שלושה רבעונים = 30%–120% מהשנה
      let bad;
      if (k === 'cogs') {
        const rv = qs.map((q) => Q.rev[q]), ra = A.rev[e];
        if (!(ra > 0) || rv.some((x) => !(x > 0))) continue;
        const r = (s3 / rv.reduce((t, x) => t + x, 0)) / (av / ra);
        bad = r < 0.4 || r > 2.5;
      } else bad = s3 < 0.3 * av || s3 > 1.2 * av;
      if (e === fyEnds[fyEnds.length - 1]) lastBad = bad;
      if (bad) {
        qmix.push({ k: 'qmix', m: k, p: e });
        for (const q of qs.concat([e])) delete Q[k][q];
      }
    }
    // השנה הפתוחה — רק כשהשנה האחרונה עצמה הייתה על בסיס אחר (לא בגלל שנה ישנה)
    if (lastBad) for (const q of qEnds) if (q > fyEnds[fyEnds.length - 1]) delete Q[k][q];
  }
  // רווח למניה ברבעון רביעי = רווח לבעלי המניות ÷ ממוצע המניות של הרבעון (לא חיסור — רווח למניה לא מצטבר; מסומן כנגזר).
  // ממוצע המניות ברבעון הרביעי (26/10/2026): ממוצע השנה ≈ ממוצע ארבעת הרבעונים, כך שהרביעי ≈ 4 × השנה פחות שלושת
  // האחרים — חברה שקונה מניות חוזרות מקבלת ברבעון האחרון פחות מניות מהממוצע השנתי. רחוק מ־12% מהשנה = ממוצע השנה
  // מספר מניות שהוגש בקנה מידה שגוי (McDonald's: ‏716.4 "מניות" במקום 716.4 מיליון — טעות של החברה, מהסוג שחוקי DQC תופסים).
  // לפני חישוב הרבעון הרביעי — אחרת הוא נגזר מהשנה השגויה (רווח למניה של מיליונים):
  // רווח נקי ÷ רווח למניה = מספר המניות. פער של פי אלף / מיליון בדיוק (±15%) — מתקנים ורושמים.
  const fixes = [];
  for (const [D, ends] of [[A, fyEnds], [Q, qEnds]]) for (const e of ends) {
    const sh = D.sh[e], eps = D.eps[e], ni = (D.nic && D.nic[e] != null ? D.nic[e] : D.ni[e]);
    if (!(sh > 0) || !eps || !ni) continue;
    const r = Math.abs(ni / eps) / sh;
    for (const f of [1e3, 1e6]) if (Math.abs(r / f - 1) < 0.15) { D.sh[e] = sh * f; if (D === A) fixes.push({ m: 'sh', p: e, x: f }); }
  }
  // רשת ביטחון: ממוצע מניות ברבעון בקנה מידה אחר מהשנה (אחרי תיקון קנה המידה) — נזרק ומחושב כמו רבעון חסר
  const yearAt = (e) => [...yearOf].find(([e2, s2]) => e > s2 && e <= e2);
  for (const e of qEnds) {
    const y = yearAt(e), as = y && A.sh[y[0]];
    // רק בחתימה של טעות קנה מידה — פי אלף / מיליון (±20%); יחס אחר (פיצול הפוך 1:100, פיצול 50:1) = פיצול אמיתי שהלולאה שלו מתקנת
    const r = Q.sh[e] > 0 && as > 0 ? Math.max(Q.sh[e] / as, as / Q.sh[e]) : 0;
    if ([1e3, 1e6].some((f) => Math.abs(r / f - 1) < 0.2)) Q.sh[e] = null;
  }
  // ממוצע המניות ברבעון הרביעי (26/10/2026). המדולל לא מצטבר כשיש הפסד באחד הרבעונים או בשנה: ברבעון של הפסד המדולל
  // = הבסיסי (מניות שמדללות נשמטות), והשנה מחושבת לפי השנה כולה. Southwest 2025: הפסד ברבעון הראשון — 4 × ‏558 פחות
  // שלושת הרבעונים = ‏581, ההודעה: ‏521; Coinbase: הפסד ברבעון הרביעי — ‏307 מול ‏268. אז מהבסיסי (מצטבר — ממוצע ימים):
  // 4 × השנה פחות שלושה, ועוד הדילול כשהרביעי ברווח. ההערכה מתקבלת קרוב לשנה או לרבעון השלישי
  // (Capital One: רכישה באמצע השנה — הרבעון הרביעי ‏632 מול ממוצע שנתי ‏541; Omnicom, Synopsys — רכישה ברבעון הרביעי):
  // עד 50% מאחד מהם (נמדד על 512 רבעונים רביעיים מול ההודעות לעיתונות דרך Yahoo — בלי שגיאה חדשה; 12% דחה רכישות)
  const niOf = (D, e) => (D.nic && D.nic[e] != null ? D.nic[e] : D.ni[e]);
  const q4Shares = (e, y, as, qs) => {
    if (qs.length !== 3) return null;
    let est = 4 * as - qs.reduce((t, q) => t + Q.sh[q], 0);
    const loss = [...qs, e].some((q) => niOf(Q, q) < 0) || niOf(A, e) < 0;
    // הבסיסי ברבעונים בקנה המידה של השנה (EchoStar: רבעונים באלפים — 271,519 — והשנה ביחידות)
    const ba = shB.A[e], bq = qs.map((q) => { const x = shB.Q[q]; if (!(x > 0) || !(ba > 0)) return x; const f = [1e3, 1e6, 1e-3, 1e-6].find((g) => Math.abs(x * g / ba - 1) < 0.2); return f ? x * f : x; });
    if (loss && ba > 0 && bq.every((x) => x > 0)) {
      const b4 = 4 * ba - bq.reduce((t, x) => t + x, 0);
      // הדילול כשהרביעי ברווח: הקטן מבין הרבעון האחרון שהיה ברווח (מדולל פחות בסיסי) ו־4 × הדילול של השנה
      // (Lumentum: רק הרביעי ברווח — הדילול של השנה כולו ממנו; HPE: הרבעון השלישי כלל בכורה ניתנת להמרה — 96M, בפועל 29M)
      const pq = qs.filter((q) => niOf(Q, q) > 0).pop(), inc = [4 * (as - ba)];
      if (pq) inc.push(Q.sh[pq] - shB.Q[pq]);
      est = b4 + (niOf(Q, e) > 0 ? Math.max(0, Math.min(...inc)) : 0);
    }
    const q3 = Q.sh[qs[2]];
    return est > 0 && (Math.abs(est / as - 1) <= 0.5 || (q3 > 0 && Math.abs(est / q3 - 1) <= 0.5)) ? est : null;
  };
  // מה שדווח ישירות (לפני ההשלמות) — לרווח הגלום בשנה (רווח למניה × מניות) ולסימון הערכה (shEst)
  const shRep = new Set(qEnds.filter((e) => Q.sh[e] != null)), epsRep = new Set(qEnds.filter((e) => Q.eps[e] != null)), shEst = [], epsNum = {};
  for (const e of qEnds) {
    if (Q.sh[e] == null) {
      const s = yearAt(e), as = s && A.sh[s[0]];
      // ממוצע השנה במקום רבעון חסר — רק כשהוא על הבסיס של הרבעונים שדווחו באותה שנה (החציון שלהם עד 25% ממנו; Carvana: ‏EPS לסוג A מתויג לפי סוג
      // מניות, ובשנה המדולל כולל המרה של יחידות B — ‏1,121M מול ‏716M ברבעון השני; הרבעונים החסרים קיבלו את 1,121M,
      // ורווח למניה ‎0.13 במקום ‎0.21). בלי בסיס משותף — ריק
      const rep = s ? qEnds.filter((q) => q > s[1] && q <= s[0] && shRep.has(q)).map((q) => Q.sh[q]).sort((a, b) => a - b) : [];
      if (as != null && (!rep.length || Math.abs(rep[(rep.length - 1) >> 1] / as - 1) <= 0.25)) {
        const qs = s[0] === e ? qEnds.filter((q) => q > s[1] && q < e && Q.sh[q] > 0) : [];
        Q.sh[e] = q4Shares(e, s, as, qs) ?? as; shEst.push(e);
      }
    }
    // החלק של הרווח שבבסיס הרווח למניה (אחרי דיבידנד בכורה, התאמות דילול) — לפי השנה כפי שהחברה הציגה אותה:
    // רווח למניה × מניות ÷ רווח נקי. P&G: הרווח "לבעלי המניות" בתגית הוא הבסיסי, והמדולל מחזיר את הבכורה — 1.23 במקום 1.26
    // הבסיס = הרווח לבעלי המניות הרגילות כשיש (בנקים: אחרי דיבידנד בכורה שמשתנה מרבעון לרבעון — Bank of America), אחרת הרווח הנקי
    const nicq = Q.nic && Q.nic[e] != null, y = yearAt(e);
    let niq = nicq ? Q.nic[e] : Q.ni[e];
    const an = y && (nicq && A.nic && A.nic[y[0]] ? A.nic[y[0]] : A.ni[y[0]]), yr = y && an ? A.eps[y[0]] * A.sh[y[0]] / an : null;
    if (y && y[0] === e && niq != null && yr > 0.8 && yr < 1.2) {
      niq *= yr;
      // הרווח שבבסיס הרווח למניה — כמו שהחברה הציגה כל תקופה: השנה (רווח למניה × מניות) פחות שלושת הרבעונים (כנ״ל), כשהם
      // דווחו ישירות ועל בסיס הרווח של כל רבעון. ‏TransDigm: תשלומים במקום דיבידנד לבעלי אופציות ‏(dividend equivalents)
      // מנוכים ברבעון שבו שולם הדיבידנד המיוחד — היחס של השנה (0.90) נתן ‎9.42 במקום ‎7.75 שפורסם. רק כשהעיגול לסנט זניח (≤5%)
      const qs3 = qEnds.filter((q) => q > y[1] && q < e);
      const okQ = (q) => { const x = Q.eps[q] * Q.sh[q], n = niOf(Q, q); return epsRep.has(q) && shRep.has(q) && n != null && Math.abs(x - n) <= 0.3 * Math.max(Math.abs(x), Math.abs(n)) + 0.005 * Q.sh[q]; };
      // ושלושת הרבעונים = תשעת החודשים שממנו חישבנו את הרבעון (עד 0.5%) — Alnylam 2025: תשעת החודשים הוצגו מחדש ב־10-K
      // (‏$202M), והרבעונים לא (סכומם ‏$161M) — הרווח למניה שלהם לא על הבסיס של הרבעון הרביעי
      if (qs3.length === 3 && qs3.every(okQ)) {
        const e3 = qs3.reduce((t, q) => t + Q.eps[q] * Q.sh[q], 0), e4 = A.eps[e] * A.sh[e] - e3, err = 0.005 * (A.sh[e] + qs3.reduce((t, q) => t + Q.sh[q], 0));
        const n3 = niOf(A, e) != null && niOf(Q, e) != null ? niOf(A, e) - niOf(Q, e) : null, s3 = qs3.reduce((t, q) => t + niOf(Q, q), 0);
        if (Math.abs(e4) >= 20 * err && n3 != null && Math.abs(s3 - n3) <= 0.005 * Math.max(Math.abs(n3), Math.abs(s3))) niq = e4;
      }
    }
    if (Q.eps[e] == null && niq != null && Q.sh[e]) { Q.eps[e] = Math.round(niq / Q.sh[e] * 100) / 100; (derived.eps = derived.eps || []).push(e); epsNum[e] = niq; }
  }
  // מניות חסרות (דיווח לפי סוגי מניות): רווח נקי ÷ רווח למניה
  for (const [D, ends] of [[A, fyEnds], [Q, qEnds]]) for (const e of ends) {
    if (!D.sh[e] && D.eps[e] && D.ni[e]) D.sh[e] = Math.abs(D.ni[e] / D.eps[e]);
  }
  // עלות מכר שאינה עלות ההכנסות (cogsBasis) — בלי עלות המכר ובלי רווח גולמי מחושב; רווח גולמי שהחברה דיווחה נשאר
  // שורה שלא בדוח רווח והפסד (כשיש דוח שזיהינו) = מדד מהביאורים, לא השורה: Honeywell מתייגת OperatingIncomeLoss על
  // "Total Segment profit" בביאור המגזרים (2023: ‏$7.56B; הדוח לא מציג רווח תפעולי) — כמו Parker-Hannifin, ‏Rockwell, ‏Regency,
  // ‏Deere, ‏Disney; ‏GrossProfit של Oracle / Booking / CVS — מגזר או מוצר. לא מציגים (opx / gpOff); בלי דוח לבדוק — כמו קודם
  const isRows = face && face.is && face.is.rows ? face.is.rows.filter((r) => /^(us-gaap|ifrs-full)$/.test(r.ns)) : null;
  const realIs = !!isRows && isRows.some((r) => r.tag === tags.rev || r.tag === tags.ni);
  const opx = realIs && tags.op && !isRows.some((r) => (map.op || []).includes(r.tag)) ? 'off' : null;
  if (opx) { A.op = {}; Q.op = {}; delete tags.op; delete derived.op; }
  const gpx = A.cogs ? cogsBasis(face, tags, map.cogs || [], cogsRows && { pick: cogsRows.tot || (cogsRows.parts && cogsRows.parts.join('+')), ext: !!cogsRows.ext }) : null;
  // GrossProfit שלא בדוח נשאר רק כשהוא = הכנסות − עלות מכר תקינה ברוב השנים (Honeywell: מתויג, ותואם — כולל ברבעונים).
  // "שווה" = עד 0.1% מההכנסות (עד 26/10/2026 — 1%): Gartner מתייגת GrossProfit בביאור בלי OtherCostOfOperatingRevenue (‏$33M, ‏0.5%),
  // והוא גבר על ההכנסות פחות "Cost of services and product development" שבדוח (Yahoo ו־Nasdaq — הדוח)
  if (realIs && tags.gp && !isRows.some((r) => (map.gp || []).includes(r.tag))) {
    const ys = fyEnds.filter((e) => A.gp[e] != null && A.rev[e] != null && A.cogs && A.cogs[e] != null);
    const agree = gpx === 'ok' && ys.length && ys.filter((e) => Math.abs(A.rev[e] - A.cogs[e] - A.gp[e]) <= 0.001 * Math.abs(A.rev[e])).length * 2 > ys.length;
    if (!agree) { A.gp = {}; Q.gp = {}; delete tags.gp; delete derived.gp; }
  }
  if (gpx === 'part' || gpx === 'off' || gpx === 'sum') { A.cogs = {}; Q.cogs = {}; delete tags.cogs; delete derived.cogs; qmix.splice(0, qmix.length, ...qmix.filter((x) => x.m !== 'cogs')); }
  // שורות מחושבות
  const gpd = []; // שנים שבהן הרווח הגולמי מחושב (לא דווח) — derived.gp הוא של רבעונים
  for (const [D, ends] of [[A, fyEnds], [Q, qEnds]]) for (const e of ends) {
    if (D.gp && D.gp[e] == null && D.rev[e] != null && D.cogs && D.cogs[e] != null) { D.gp[e] = D.rev[e] - D.cogs[e]; if (D === A) gpd.push(e); }
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
  return { fy, q: qEnds, shEst: shEst.filter((e) => Q.sh[e] != null), epsNum, A: pack(A, fy), Q: pack(Q, qEnds), C: Object.keys(C.A).length || Object.keys(C.Q).length ? C : null, cur: cur || 'USD', ifrs: isIfrs, derived, tags, fixes, qmix, gpx, gpd, opx, splitsUsed };
}

/* ---------- בדיקות אימות — תג, לא תיקון ---------- */
function validate(d) {
  const out = (d.fixes || []).map((f) => ({ k: 'fix', m: f.m, p: f.p, x: f.x })).concat(d.qmix || []), A = d.A, Q = d.Q;
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

/* רווח למניה ברבעון מחושב (בעיקר הרביעי — אין לו 10-Q): ב־10-K אין את ממוצע המניות של הרבעון, והממוצע השנתי המדולל
   אינו ממוצע הרבעונים (Bank of America 2025: הערכה ‎0.94 מול ‎0.98 שהחברה פרסמה). המספר שהחברה פרסמה בהודעה לעיתונות
   (דרך Yahoo) גובר כשהוא קרוב לחישוב שלנו (עד 15% — אחרת לא אותו בסיס: פיצול, מניות בכורה); נרשם qeps (מידע) */
// רבעון ש־parseYahooTs חישב בעצמו (שנה פחות שלושה) — לא מה שהחברה פרסמה (EchoStar: ‎−4.269999 = ‎−50.41 פחות שלושה רבעונים)
// זרוע מימון בדוח רווח והפסד (שורה "Financial services/products", "Ford Credit", "GM Financial") — ראו finArm ב־fundamentals
const finArmOf = (rows) => !!rows && rows.some((r) => !/\btax/i.test(r.label || '') && /\b(financial (services|products)|financing|credit)\b|\b[A-Z]{2,4} Financial\b/i.test(r.label || ''));
function yQuarterFill(sec, y, grossOnFace, checks) {
  const qfill = {};
  if (y && y.q && y.Q) for (const k of Object.keys(YMAP)) {
    if (!y.Q[k] || !QFILL.has(k)) continue; // רק זרימות שההגדרה שלהן אצל Yahoo כמו שלנו (לא מאזן, ריבית, מניות, רווח למניה)
    if ((k === 'gp' || k === 'cogs') && sec.gpx !== 'fin' && (sec.gpx === 'part' || !grossOnFace)) continue;
    const fin = sec.gpx === 'fin' && (k === 'gp' || k === 'cogs');
    if ((k === 'gp' || k === 'cogs') && !fin) continue; // רווח גולמי: אצל Yahoo לעתים בסיס אחר מהשנה שלנו (Snap-on — כולל שירותי מימון) — לא מערבבים
    if (!fin && !(sec.Q[k] && sec.Q[k].some((v) => v != null))) continue; // מדד שאין לנו ברבעונים — לא ממציאים סדרה
    const Q = sec.Q[k] || (sec.Q[k] = sec.q.map(() => null));
    sec.q.forEach((e, i) => {
      if (Q[i] != null) return;
      const j = y.q.findIndex((x) => Math.abs(day(x) - day(e)) < 10);
      if (j < 0 || y.Q[k][j] == null || yComp(y, k, y.q[j])) return;
      Q[i] = y.Q[k][j]; (qfill[k] = qfill[k] || []).push(e); checks.push({ k: 'qfy', m: k, p: e });
    });
  }
  return qfill;
}
const QFILL = new Set(['rev', 'cogs', 'gp', 'op', 'ni', 'pretax', 'tax', 'ocf', 'capex', 'dep', 'sbc', 'rnd']);
const yComp = (y, k, e) => !!(y && y.qc && y.qc[k] && y.qc[k].includes(e));
function q4Eps(sec, y) {
  const out = [], der = (sec.derived && sec.derived.eps) || [];
  if (!y || !y.q || !y.Q || !y.Q.eps || !sec.Q.eps) return out;
  sec.q.forEach((e, i) => {
    if (!der.includes(e)) return;
    const j = y.q.findIndex((x) => Math.abs(day(x) - day(e)) < 10), v = j >= 0 && !yComp(y, 'eps', y.q[j]) ? y.Q.eps[j] : null, ours = sec.Q.eps[i];
    if (v == null || ours == null || !ours || Math.abs(v - ours) < 0.005) return;
    if (Math.sign(v) !== Math.sign(ours) || Math.abs(v / ours - 1) > 0.15) return;
    sec.Q.eps[i] = v; out.push({ k: 'qeps', m: 'eps', p: e, f: v, v: ours });
  });
  return out;
}

/* ממוצע המניות ברבעון שאין לו ערך מ־SEC (26/10/2026) — הרבעון הרביעי (אין לו 10-Q) או רבעון שדווח רק לפי סוג מניות.
   ההערכה שלנו (q4Shares, ממוצע השנה) לא יודעת כמה מניות מדללות נכללו ברבעון (CoStar: ‏421.9 מול ‏419.6 שפורסם; Hasbro:
   הפסד בשנה — דילול 0 מול ‏2.1M ברבעון; Invesco: ‏453.8 גם ברבעון של הפסד; HPE: ‏1,333 מול ‏1,361). מה שהחברה פרסמה (Yahoo,
   רק ערך שפורסם — לא מחושב) גובר: כשההערכה שלנו קרובה (עד 10%), או בלי הערכה — כשהוא על בסיס הרווח שלנו (רווח למניה ×
   מניות של Yahoo ≈ הרווח של הרבעון, עד 5%; Carvana). רבעון בלי רווח למניה — גם הרווח למניה (מסומן כנגזר). נרשם qsh */
function qShares(sec, y) {
  const out = [];
  if (!y || !y.q || !y.Q || !y.Q.sh || !sec.Q) return out;
  const est = sec.shEst || [], der = (sec.derived && sec.derived.eps) || [];
  sec.Q.sh = sec.Q.sh || sec.q.map(() => null); sec.Q.eps = sec.Q.eps || sec.q.map(() => null);
  sec.q.forEach((e, i) => {
    const ours = sec.Q.sh[i]; if (ours != null && !est.includes(e)) return;
    const j = y.q.findIndex((x) => Math.abs(day(x) - day(e)) < 10); if (j < 0 || yComp(y, 'sh', y.q[j])) return;
    const v = y.Q.sh[j], ye = y.Q.eps && !yComp(y, 'eps', y.q[j]) ? y.Q.eps[j] : null; if (!(v > 0)) return;
    const n = [sec.Q.nic && sec.Q.nic[i], sec.Q.ni && sec.Q.ni[i]].filter((x) => x != null);
    const sameBase = ye != null && n.some((x) => Math.abs(ye * v - x) <= 0.05 * Math.max(Math.abs(x), Math.abs(ye * v)) + 0.005 * v);
    if (ours != null ? Math.abs(v / ours - 1) > 0.1 || Math.abs(v - ours) < 0.5 : !sameBase) return;
    sec.Q.sh[i] = v; out.push({ k: 'qsh', m: 'sh', p: e, f: v, v: ours });
    // הרווח למניה שחישבנו מאותו רווח — לפי המניות החדשות (Invesco: ‎−1,186 ÷ 453.8 = ‎−2.61, כמו שפורסם)
    const num = sec.epsNum && sec.epsNum[e];
    if (der.includes(e) && num != null) sec.Q.eps[i] = Math.round(num / v * 100) / 100;
    else if (sec.Q.eps[i] == null && sameBase) { sec.Q.eps[i] = ye; (sec.derived.eps = sec.derived.eps || []).push(e); }
  });
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
  // רק פיצולים ש־normalizeSec הכיר כאמיתיים (splitsUsed) — פיצול חברה (DuPont/Qnity 2.39) לא מחלק את הדוח
  const post = (d.splitsUsed || (splits || []).filter(([, r]) => Math.abs(Math.log(r)) > Math.log(1.3))).filter(([sd]) => face.filed && sd > face.filed).reduce((t, [, r]) => t * r, 1);
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
  // רבעון 4 חסר = השנה פחות שלושה רבעונים (לא במאזן); qc = הרבעונים שחושבו כך — לא מה ש־Yahoo פרסם (q4Eps / qShares)
  const qc = {};
  for (const k of Object.keys(YMAP)) {
    if (YBAL.has(k)) continue;
    for (const [e, v] of Object.entries(ya[k])) {
      const qs = Object.keys(yq[k]).filter((q) => q < e && day(e) - day(q) < 290).sort();
      if (yq[k][e] == null && qs.length === 3) { yq[k][e] = k === 'sh' ? qs.reduce((s, q) => s + yq[k][q], 0) / 3 : v - qs.reduce((s, q) => s + yq[k][q], 0); (qc[k] = qc[k] || []).push(e); }
    }
  }
  const fy = Object.keys(ya.rev).sort(), q = Object.keys(yq.rev).sort();
  const pack = (D, ends) => { const o = {}; for (const k of Object.keys(YMAP)) { const a = ends.map((e) => (D[k][e] != null ? D[k][e] : null)); if (a.some((v) => v != null)) o[k] = a; } return o; };
  const last = q[q.length - 1], T = {};
  for (const k of Object.keys(YMAP)) if (last && yt[k][last] != null) T[k] = yt[k][last];
  const so = res.annualOrdinarySharesNumber || [];
  return { fy, q, A: pack(ya, fy), Q: pack(yq, q), qc, T, sharesOut: so.length ? so[so.length - 1].reportedValue.raw : null };
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
  // דוח "רווח כולל" שנבחר כי אין דוח רווח והפסד נפרד — רק אם יש בו רווח למניה (אחרת זה רק הרווח הכולל האחר)
  if (pick.isAlt && out.is && !out.is.rows.some((r) => /^EarningsPerShare|EarningsLossPerShare/.test(r.tag))) delete out.is;
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
    if ((f.m === 'rev' || f.m === 'cogs') && sec.A.gp && sec.A.rev[f.i] != null && sec.A.cogs && sec.A.cogs[f.i] != null && (sec.A.gp[f.i] == null || (sec.gpd || []).includes(sec.fy[f.i])))
      sec.A.gp[f.i] = sec.A.rev[f.i] - sec.A.cogs[f.i];
  }
  const qsh = useSec ? qShares(sec, y) : [];
  const qeps = useSec ? q4Eps(sec, y) : [];
  const checks = useSec ? validate(sec).concat(crossCheck(sec, y), fcRes.out, ffix, qsh, qeps) : [];
  // שורה שחסרה ב־SEC לגמרי (תגית פרטית של החברה, למשל השקעות הוניות ב־IFRS) — משלימים מ־Yahoo לפי תאריך, ומסמנים
  const fill = [];
  // רווח גולמי ועלות מכר — לא מ־Yahoo כשהחברה לא מציגה אותם: לרכבות, חברות תעופה, נפט וגז, ביטוח ומנהלי השקעות אין
  // "עלות המכר" בדוח, וכל ספק בונה אחת משלו (CSX 2025: ‏Yahoo ‏$4.69B, ‏S&P ‏$6.42B, ‏Nasdaq ‏$9.98B). משלימים רק כשבדוח
  // יש שורה כזו בתגית פרטית של החברה (הכותרת: "Gross profit" / "Cost of sales…"), או כשאין דוח לבדוק
  const isRows = (face && face.is && face.is.rows) || null;
  const grossOnFace = !isRows || isRows.some((r) => /gross (profit|margin)|\bcosts? of (sales|revenues?|goods|products|services)\b/i.test(r.label || ''));
  // חברה עם זרוע מימון (Ford Credit, ‏GM Financial, ‏Cat Financial, ‏Snap-on Credit): ההכנסות כוללות הכנסות מימון, ועלויות המימון
  // (ריבית, הפסדי אשראי — מתויגות עם ממד, לא ב־companyfacts) לא בעלות המכר — רווח גולמי מ־SEC מנופח (Ford ‏14% מול 8%).
  // כמו בממשקים שאנחנו משווים אליהם (Yahoo = Nasdaq בכל הארבע): רווח גולמי ועלות מכר מ־Yahoo, שנים ורבעונים (gpx 'fin')
  // (גם כשמודפס "רווח גולמי" — Snap-on מדפיסה אותו רק על המוצרים, וכל המקורות מוסיפים את שירותי המימון)
  const finArm = useSec && finArmOf(isRows);
  if (finArm && (sec.gpx === 'ok' || sec.gpx === 'gp') && y && y.A && y.A.gp) {
    for (const k of ['gp', 'cogs']) { delete sec.A[k]; delete sec.Q[k]; if (sec.derived) delete sec.derived[k]; }
    sec.gpx = 'fin';
  }
  if (useSec && y && y.fy) for (const k of Object.keys(YMAP)) {
    if (sec.A[k] || !y.A[k]) continue;
    if ((k === 'gp' || k === 'cogs') && sec.gpx !== 'fin' && (sec.gpx === 'part' || !grossOnFace)) continue; // 'off' עם שורת "Cost of…" בדוח (Thermo Fisher, Deere: לפי מוצרים ושירותים) — כן
    const a = sec.fy.map((e) => { const j = y.fy.findIndex((x) => Math.abs(day(x) - day(e)) < 20); return j >= 0 ? y.A[k][j] : null; });
    if (a.some((v) => v != null)) { sec.A[k] = a; fill.push(k); }
  }
  // רבעון ש־SEC לא מאפשר לחשב מאותו בסיס (שנה שהוצגה מחדש מול תשעה חודשים ישנים — Bank of America; רבעונים שאינם מאותו בסיס
  // כמו השנה; זרוע מימון) — כמו בממשקים שאנחנו משווים אליהם: המספר שהחברה פרסמה (Yahoo, רק רבעון שהוא דיווח ולא חישב בעצמו).
  // רק תאריך שכבר קיים אצלנו; נרשם qfy (מידע) ובתשובה qfill — כלי ההשוואה לא בודק אותו מול Yahoo
  const qfill = useSec ? yQuarterFill(sec, y, grossOnFace, checks) : {};
  if (sec.gpx === 'fin') checks.push({ k: 'gpfin', m: 'gp', p: sec.fy[sec.fy.length - 1] });
  // מניות לשווי השוק: בדילול מהדוח האחרון (ב־Yahoo "sharesOutstanding" הוא לפעמים רק סוג מניות אחד — Meta: 2.2B מתוך 2.57B)
  const lastSh = (D) => (D && D.sh ? D.sh.filter((v) => v > 0).pop() : null);
  const sharesOut = useSec ? (lastSh(sec.Q) || lastSh(sec.A)) : ((y && y.sharesOut) || lastSh(y && y.Q) || (s && s.sharesOut));
  const out = {
    ok: true, v: 1, sym, src: useSec ? 'sec' : 'yahoo', cik, asOf: new Date().toISOString().slice(0, 10),
    cur: (useSec ? sec.cur : (s && s.finCur)) || (ta ? 'ILS' : 'USD'),
    fy: base.fy, q: base.q, A: base.A, Q: base.Q, T: useSec ? null : (y && y.T) || null,
    derived: useSec ? sec.derived : null, gpx: useSec ? sec.gpx || null : null, opx: useSec ? sec.opx || null : null, C: useSec ? sec.C : null, ifrs: useSec ? !!sec.ifrs : false,
    sic: useSec ? sec.sic : null, sicDesc: useSec ? sec.sicDesc : null, fye: useSec ? sec.fye : null, lastFiled: useSec ? sec.lastFiled : null,
    prof: s ? s.prof : null, price: s ? s.price : null, prev: s ? s.prev : null,
    sharesOut: sharesOut || (s && s.sharesOut) || null, fill, qfill, fpe: s ? s.fpe : null, peg: s ? s.peg : null, beta: s ? s.beta : null,
    est: s ? s.est : [], hist: s ? s.hist : [], nextEarn: s ? s.nextEarn : null, nq: n || null,
    px: m ? m.px : null, splits: m ? m.splits : [], splitsUsed: useSec ? sec.splitsUsed || [] : [], peers: peers || [],
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
/* 26/10/2026 (בקשת המשתמש): אי־התאמה לא מוצגת למשתמש — נאספת אצלנו ומתוקנת בקוד.
   מניה שנפתחה ויש בה סימון שאינו תיקון/מידע → קובץ קטן ב־R2 (רק הסימבול וסוגי הבדיקה — מידע ציבורי, בלי שום פרט על מי פתח),
   והבקרה הלילית (tools/fund-audit.js --seen) בודקת גם אותה. פעם ביום למניה במופע; תקלה ב־R2 לא נוגעת בתשובה.
   CHECK_INFO = FL_INFO ב־analysis.js (tests/analysis.test.js משווה). */
const CHECK_INFO = new Set(['fix', 'ffill', 'ffix', 'rst', 'qeps', 'qmix', 'qfy', 'gpfin', 'qsh']);
const FLAG_PRE = 'fund/flag/';
const _noted = new Map();
const warnKinds = (v) => [...new Set((v.checks || []).map((c) => c.k).filter((k) => !CHECK_INFO.has(k)))].sort();
async function noteFlags(sym, v, deps = {}) {
  const ks = warnKinds(v); if (!ks.length) return false;
  const R2 = require('./r2'); const c = deps.r2c || R2.config(); if (!c.ok) return false;
  const now = typeof deps.now === 'function' ? deps.now() : Date.now();
  const day = new Date(now).toISOString().slice(0, 10), key = sym + '|' + ks.join(',');
  if (_noted.get(key) === day) return false;
  _noted.set(key, day); if (_noted.size > 2000) _noted.delete(_noted.keys().next().value);
  const body = JSON.stringify({ v: 1, sym, k: ks, at: new Date(now).toISOString() });
  await Promise.race([R2.putText(c, deps, FLAG_PRE + sym.replace(/[^A-Z0-9.\-]/g, '') + '.json', body, 'application/json').catch(() => {}),
    new Promise((r) => setTimeout(r, deps.wait || 1500))]);
  return true;
}
/* רשימת המניות שנרשמו ב־30 הימים האחרונים — לבקרה הלילית (ציבורי: רק סימבולים) */
async function flaggedSyms(deps = {}) {
  const R2 = require('./r2'); const c = deps.r2c || R2.config(); if (!c.ok) return null;
  const since = (typeof deps.now === 'function' ? deps.now() : Date.now()) - 30 * 864e5;
  return (await R2.list(c, deps, FLAG_PRE, 2000)).filter((o) => !o.at || o.at >= since)
    .map((o) => o.key.slice(FLAG_PRE.length).replace(/\.json$/, '')).filter((x) => SYM_RE.test(x)).sort().slice(0, 500);
}

async function handle(body, res) {
  if (body.op === 'fundFlags') {
    let syms = null; try { syms = await flaggedSyms(); } catch (e) { syms = null; }
    return res.status(200).json({ ok: syms != null, syms: syms || [] });
  }
  if (body.op === 'macro') {
    const v = await macro();
    return res.status(200).json({ ok: true, ...v, ind: DMD.ind });
  }
  const sym = String((body && body.sym) || '').trim().toUpperCase();
  if (!SYM_RE.test(sym)) return res.status(400).json({ ok: false, error: 'bad_params' });
  const v = await fundamentals(sym);
  if (!v.ok) return res.status(404).json(v);
  try { await noteFlags(sym, v); } catch (e) { /* האיסוף לא מפיל את התשובה */ }
  return res.status(200).json({ ...v, indData: industryData(v.ind) });
}

module.exports = { handle, fundamentals, noteFlags, flaggedSyms, warnKinds, CHECK_INFO, FLAG_PRE, q4Eps, finArmOf, yQuarterFill, qShares, macro, yahooMonthly, normalizeSec, mergeTags, fixRuns, faceCheck, secFace, cikMap, secSym, mergeFacts, CIK_PREV, validate, crossCheck, parseYahooTs, parseSummary, parseMonthly, parseNasdaq, parsePeers, parseFred, parseTreasury,
  industryFor, industryData, _cache: cache,
  // התגיות המועמדות לכל שורה — לכלי ההשוואה (fundxcheck: SEC גולמי גם לתקופות שהושלמו מתגית משנית). נשמט ב־f9db4c74 — tools/fund-xcheck.js מצפה לו
  TAGS: { gaap: { ...FLOW, ...INST }, ifrs: IFRS } };
