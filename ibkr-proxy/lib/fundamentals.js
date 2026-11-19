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
  rev: ['RevenuesNetOfInterestExpense', 'Revenues', 'RegulatedAndUnregulatedOperatingRevenue', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet', 'RevenueFromContractWithCustomerIncludingAssessedTax', 'SalesRevenueGoodsNet', 'RegulatedOperatingRevenue', 'OperatingLeaseLeaseIncome', 'SalesRevenueServicesNet'],
  cogs: ['CostOfRevenue', 'CostOfGoodsAndServicesSold', 'CostOfGoodsSold', 'CostOfServices', 'CostOfGoodsAndServiceExcludingDepreciationDepletionAndAmortization',
    // גל 4: שתי האחיות של "בלי פחת" — ‏Ball, ‏PPG, ‏Sysco, ‏Howmet, ‏AMETEK (סחורות); ‏Cognizant, ‏IQVIA, ‏Iron Mountain, ‏GoDaddy (שירותים)
    'CostOfGoodsSoldExcludingDepreciationDepletionAndAmortization', 'CostOfServicesExcludingDepreciationDepletionAndAmortization'], // Uber, ‏Newmont ("Costs applicable to sales")
  gp: ['GrossProfit'],
  op: ['OperatingIncomeLoss'],
  // 'ProfitLoss-…NoncontrollingInterest' = הרווח הכולל פחות זכויות המיעוט (diffFacts) — הרווח לבעלי המניות כשהחברה לא מתייגת
  // NetIncomeLoss: ‏Bloom Energy (תגית פרטית לשורה), ‏Realty Income ‏2026 (רק ב־10-K). עד 26/10/2026 ‏ProfitLoss נכנס כמו שהוא — כולל זכויות המיעוט
  ni: ['NetIncomeLoss', 'NetIncomeLossAvailableToCommonStockholdersBasic', 'ProfitLoss-NetIncomeLossAttributableToNoncontrollingInterest', 'ProfitLoss'],
  nic: ['NetIncomeLossAvailableToCommonStockholdersDiluted', 'NetIncomeLossAvailableToCommonStockholdersBasic'], // לבעלי המניות הרגילות (אחרי דיבידנד בכורה) — לזהות EPS × מניות
  pretax: ['IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest', 'IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments'],
  // APA: בדוח הרווח שתי שורות, מס שוטף ומס נדחה, בלי סה"כ — ‏IncomeTaxExpenseBenefit רק בשנתי, והרבעונים נשארו בלי מס
  // (מחקר שיטת באפט §13.12). הסכום — רק בתקופה שבה שתי התגיות מדווחות (sumFacts)
  tax: ['IncomeTaxExpenseBenefit', 'CurrentIncomeTaxExpenseBenefit+DeferredIncomeTaxExpenseBenefit'],
  // גל 2 (F14): התגיות של השורה המודפסת — AbbVie, ‏Amgen, ‏Biogen ‏(בלי מו״פ שנרכש), ‏Adobe, ‏Cadence (תוכנה); עד אז בלי מו״פ בכלל
  rnd: ['ResearchAndDevelopmentExpense', 'ResearchAndDevelopmentExpenseExcludingAcquiredInProcessCost', 'ResearchAndDevelopmentExpenseSoftwareExcludingAcquiredInProcessCost'],
  // גל 4: ‏InterestAndDebtExpense — השורה המודפסת של 37 חברות (Boeing, ‏ConocoPhillips, ‏TI ‏"Interest and debt expense", ‏Honeywell, ‏Northrop).
  // לא InterestExpenseOperating — בבנקים זו הוצאת הריבית על הפיקדונות (החלטה מגל 1)
  int: ['InterestExpense', 'InterestExpenseNonoperating', 'InterestExpenseDebt', 'InterestAndDebtExpense'],
  // גל 4: ‏ARES ‏(עד 2019) ו־KKR ‏(עד 2018) היו שותפויות — "Diluted (in dollars per unit)": יחידת שותפות = מניה; עד אז בלי רווח למניה ומניות
  eps: ['EarningsPerShareDiluted', 'EarningsPerShareBasicAndDiluted', 'EarningsPerShareBasic', 'NetIncomeLossNetOfTaxPerOutstandingLimitedPartnershipUnitDiluted'],
  sh: ['WeightedAverageNumberOfDilutedSharesOutstanding', 'WeightedAverageNumberOfShareOutstandingBasicAndDiluted', 'WeightedAverageNumberOfSharesOutstandingBasic', 'WeightedAverageLimitedPartnershipUnitsOutstandingDiluted'],
  ocf: ['NetCashProvidedByUsedInOperatingActivities', 'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations'],
  capex: ['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets'],
  sbc: ['ShareBasedCompensation', 'AllocatedShareBasedCompensationExpense'],
  dep: ['DepreciationDepletionAndAmortization', 'DepreciationAndAmortization', 'DepreciationAmortizationAndAccretionNet', 'Depreciation'],
  buy: ['PaymentsForRepurchaseOfCommonStock', 'PaymentsForRepurchaseOfEquity'], // ‏GE, ‏Aon, ‏Invesco (F14)
  divp: ['PaymentsOfDividendsCommonStock', 'PaymentsOfDividends', 'PaymentsOfOrdinaryDividends'], // ‏Accenture, ‏Colgate (F14)
  dps: ['CommonStockDividendsPerShareDeclared', 'CommonStockDividendsPerShareCashPaid'],
  // "Other investing activities" — רק כגבול עליון להשקעה הונית שלא מוצגת בשורה נפרדת (capexNil); לא נשלח למסך
  oinv: ['PaymentsForProceedsFromOtherInvestingActivities'],
};
/* McKesson ‏"Redeemable noncontrolling interests" ‏$943M, ‏Omnicom ‏"Temporary Equity" ‏$363M — בלעדיהן נספרו בסך ההתחייבויות
   המחושב. רק כשהן שורה במאזן המודפס: NiSource מתייגת ‏$1.36B בביאור (זכויות המיעוט שלה בתוך ההון — חיסור כפול) */
const TMP_FACE = ['RedeemableNoncontrollingInterestEquityCommonCarryingAmount', 'RedeemableNoncontrollingInterestEquityFairValue', 'RedeemableNoncontrollingInterestEquityOtherCarryingAmount'];
const INST = {
  // מזומן = השורה במאזן. 'Cash' — מבטחים ושירותים (AIG, Hartford, Eversource מדפיסים "Cash"); הכולל מזומן מוגבל
  // (סך תזרים המזומנים — כולל מזומן של פעילות שנמכרה / מוחזקת למכירה) רק כשאין שורת מאזן לאותו תאריך (cashMerge)
  cash: ['CashAndCashEquivalentsAtCarryingValue', 'CashAndCashEquivalentsAtCarryingValueIncludingDiscontinuedOperations', 'Cash',
    'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents'],
  // AvailableForSaleSecuritiesCurrent — התגית לפני ASU 2016-01 (Apple 2015–2017: ‏"Short-term marketable securities" ‏$20.5B–$53.9B
  // יצאו ריקות והמזומן נטו ירד בהתאם; בדיקת העומק 16/11/2026)
  msec: ['MarketableSecuritiesCurrent', 'AvailableForSaleSecuritiesDebtSecuritiesCurrent', 'AvailableForSaleSecuritiesCurrent', 'ShortTermInvestments', 'DebtSecuritiesAvailableForSaleExcludingAccruedInterestCurrent',
    // גל 4: "Short-term investments" של מבטחים ‏(AIG, ‏Chubb, ‏Assurant), ‏BD, ‏Pfizer; ‏ADM ‏"Short-term marketable securities" — שתיהן לזמן קצר בהגדרה.
    // לא ‏AvailableForSaleSecurities: בבנקים היא כל תיק ני״ע זמינים למכירה (Truist, ‏State Street) — לא "לזמן קצר"
    'OtherShortTermInvestments', 'DebtSecuritiesCurrent'],
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
  ppe: ['PropertyPlantAndEquipmentNet', 'PropertyPlantAndEquipmentAndFinanceLeaseRightOfUseAssetAfterAccumulatedDepreciationAndAmortization', 'PublicUtilitiesPropertyPlantAndEquipmentNet'],
};
/* IFRS (20-F/40-F) — רק השורות המרכזיות; רבעונים לרוב לא קיימים (6-K בלי XBRL).
   גל 8 (F34): המניות המדוללות ב־ifrs-full הן AdjustedWeightedAverageShares ("…adjusted for the effects of all dilutive potential
   ordinary shares"). התגית שהייתה כאן לבד לא קיימת בטקסונומיה, ולכן בכל חברות ה־IFRS המניות היו הבסיסיות (SAP, ‏CCEP, ‏Ferrovial) */
const IFRS = {
  rev: ['Revenue', 'RevenueFromContractsWithCustomers'], cogs: ['CostOfSales'], gp: ['GrossProfit'], op: ['ProfitLossFromOperatingActivities'],
  ni: ['ProfitLossAttributableToOwnersOfParent', 'ProfitLoss'], pretax: ['ProfitLossBeforeTax'], tax: ['IncomeTaxExpenseContinuingOperations'],
  eps: ['DilutedEarningsLossPerShare', 'BasicEarningsLossPerShare'], sh: ['AdjustedWeightedAverageShares', 'WeightedAverageNumberOfSharesOutstandingDiluted', 'WeightedAverageShares'],
  ocf: ['CashFlowsFromUsedInOperatingActivities'], capex: ['PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities'],
  // גל 4: ‏CCEP, ‏Thomson Reuters, ‏CRH מדפיסים בתזרים "Depreciation" לבד (כמו Depreciation ב־US GAAP); דיבידנד "לבעלי המניות של החברה" — ‏SAP, ‏CRH, ‏Ferrovial
  dep: ['DepreciationAndAmortisationExpense', 'AdjustmentsForDepreciationAndAmortisationExpense', 'DepreciationExpense', 'AdjustmentsForDepreciationExpense'],
  divp: ['DividendsPaidClassifiedAsFinancingActivities', 'DividendsPaid', 'DividendsPaidToEquityHoldersOfParentClassifiedAsFinancingActivities'],
  // גל 4: לא היו בכלל ב־IFRS — רכישה חוזרת (Novo Nordisk, ‏SAP, ‏TSMC, ‏Thomson Reuters, ‏CCEP), מו״פ (Novo, ‏SAP, ‏TSMC), ני״ע לזמן קצר (CCEP, ‏Novo)
  buy: ['PaymentsToAcquireOrRedeemEntitysShares'], rnd: ['ResearchAndDevelopmentExpense'], msec: ['CurrentInvestments', 'ShorttermDepositsNotClassifiedAsCashEquivalents'],
  sbc: ['AdjustmentsForSharebasedPayments', 'ExpenseFromSharebasedPaymentTransactionsWithEmployees'], int: ['InterestExpense', 'InterestExpenseOnBorrowings'],
  debtNc: ['LongtermBorrowings', 'NoncurrentPortionOfNoncurrentBorrowings'], debtC: ['CurrentBorrowingsAndCurrentPortionOfNoncurrentBorrowings', 'ShorttermBorrowings'],
  cash: ['CashAndCashEquivalents'], eq: ['EquityAttributableToOwnersOfParent', 'Equity'], ta: ['Assets'], tl: ['Liabilities'],
  ca: ['CurrentAssets'], cl: ['CurrentLiabilities'], re: ['RetainedEarnings'], ppe: ['PropertyPlantAndEquipment'],
};
const FORMS = /^(10-K|10-Q|20-F|40-F)(\/A)?$/;
const NONNEG = ['rev', 'ta', 'tl', 'ca', 'cl', 'cash', 'sh', 'ppe'];
const day = (s) => Date.parse(s + 'T00:00:00Z') / 864e5;
// אורך של רבעון (בימים, סוף פחות התחלה): 12–14 שבועות, או רבעון של 16/17 שבועות בשנה של 52/53 שבועות (16/11/2026, בדיקת
// העומק: Kroger — הרבעון הראשון 16 שבועות, ‏111 יום, לא נכנס אף פעם; Costco, PepsiCo, Domino's, AutoZone — הרביעי)
const qLen = (d) => (d >= 80 && d <= 100) || (d >= 110 && d <= 119);
const PER_SHARE = new Set(['eps', 'dps']);
const F20_Q = true; // F20 ברבעונים — דולק מגל 7 (F32: ‏1,212 ערכים על כל היקום, ‏worse 0; בגל 6 — ‏worse ‏49, כבוי). ‏wave-7.md
// זרימות שבהן אפשר לבדוק שהרבעונים מאותו בסיס כמו השנה (qmix)
const QPOS = ['cogs', 'dep', 'sbc', 'int']; // הכנסות, מחקר והשקעות הוניות — יכולים להיות מרוכזים ברבעון אחד בצדק
/* באיזה דוח מופיעה כל שורה (לבחירת התגית לפי הדוח שהחברה הגישה — lib/secface.js) */
const STMT_OF = { rev: ['is'], cogs: ['is'], gp: ['is'], op: ['is'], ni: ['is', 'cf'], pretax: ['is'], tax: ['is'], rnd: ['is'], int: ['is'], eps: ['is'], sh: ['is'],
  nic: ['is'], eqt: ['bs'], tmp: ['bs'], ocf: ['cf'], capex: ['cf'], oinv: ['cf'], sbc: ['cf'], dep: ['cf', 'is'], buy: ['cf'], divp: ['cf'],
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
/* חוב כפי שהוא מודפס במאזן (16/11/2026, בדיקת העומק — F7). עד היום: LongTermDebt, או LongTermDebtNoncurrent + LongTermDebtCurrent,
   ועוד ShortTermBorrowings / CommercialPaper. במאזנים של 519 החברות (FSDS, הדוח השנתי האחרון) 128 מדפיסות את החוב לזמן ארוך
   בתגית LongTermDebtAndCapitalLeaseObligations, ‏81 את החלויות השוטפות ב־…Current ו־90 את החוב השוטף ב־DebtCurrent — אצלן החוב יצא
   חלקי (Coca-Cola 2025: ‏$1.5B — רק ניירות הערך המסחריים — מול ‏$45.5B במאזן; Chevron ‏$3.3B מול ‏$40.8B; Yum ‏$77M מול ‏$11.9B), וכך
   גם השווי הכולל, החוב נטו והמינוף. עכשיו: שורות החוב שבמאזן המודפס (הלוואות קצרות, חלויות, חוב לזמן ארוך, ובמאזן לא מסווג — כל
   שורת חוב: איגרות, משכנתאות, מסגרות אשראי), וההיסטוריה של כל שורה מהתגית שלה ב־companyfacts (ומחלופה מאותו סוג — לשנים שלפני
   שהחברה עברה לתגית של היום). בלי חכירה תפעולית, וחכירה מימונית רק כשהיא בתוך שורת החוב — כמו שמודפס */
const DEBT_CAT = {
  st: ['ShortTermBorrowings', 'CommercialPaper', 'OtherShortTermBorrowings', 'ShortTermBankLoansAndNotesPayable', 'ShortTermNonBankLoansAndNotesPayable',
    'NotesPayableCurrent', 'LoansPayableCurrent', 'LinesOfCreditCurrent', 'BankOverdrafts', 'NotesAndLoansPayableCurrent', 'LoansPayableToBankCurrent'],
  // חלויות שוטפות של מכשיר מסוים (Revvity: ‏OtherLongTermDebtCurrent "Current portion of long-term debt")
  c: ['LongTermDebtCurrent', 'LongTermDebtAndCapitalLeaseObligationsCurrent', 'OtherLongTermDebtCurrent', 'ConvertibleNotesPayableCurrent', 'ConvertibleDebtCurrent',
    'SeniorNotesCurrent', 'SecuredDebtCurrent', 'UnsecuredDebtCurrent'],
  dc: ['DebtCurrent'],
  nc: ['LongTermDebtNoncurrent', 'LongTermDebtAndCapitalLeaseObligations', 'OtherLongTermDebtNoncurrent', 'LongTermNotesPayable', 'ConvertibleDebtNoncurrent',
    'ConvertibleLongTermNotesPayable', 'SeniorLongTermNotes', 'LongTermLineOfCredit', 'UnsecuredLongTermDebt', 'LongTermLoansPayable', 'SecuredLongTermDebt',
    'JuniorSubordinatedLongTermNotes', 'LongTermNotesAndLoans', 'LongTermLoansFromBank'],
  // מאזן לא מסווג (נדל"ן, בנקים, ביטוח): השורה כוללת את החלק השוטף
  tot: ['LongTermDebt', 'DebtAndCapitalLeaseObligations', 'LongTermDebtAndCapitalLeaseObligationsIncludingCurrentMaturities', 'DebtLongtermAndShorttermCombinedAmount',
    'SecuredDebt', 'UnsecuredDebt', 'SeniorNotes', 'NotesPayable', 'LoansPayable', 'LineOfCredit', 'OtherBorrowings', 'ConvertibleDebt', 'ConvertibleNotesPayable',
    'SubordinatedDebt', 'JuniorSubordinatedNotes', 'AdvancesFromFederalHomeLoanBanks', 'NotesAndLoansPayable', 'SecuredDebtOther', 'LoansPayableToBank',
    'OtherNotesPayable', 'WarehouseAgreementBorrowings', 'LongtermBorrowings'],
};
// השנים שלפני המעבר לתגית של היום: חלופה מאותו סוג (רק לשורה הראשונה מכל סוג, וחלופה שאינה שורה בעצמה)
// (סך: רק לשורת סך כללית, לא לשורה של מכשיר)
const DEBT_ALT = { c: ['LongTermDebtCurrent', 'LongTermDebtAndCapitalLeaseObligationsCurrent'], nc: ['LongTermDebtNoncurrent', 'LongTermDebtAndCapitalLeaseObligations'],
  dc: ['LongTermDebtCurrent', 'LongTermDebtAndCapitalLeaseObligationsCurrent'], st: ['ShortTermBorrowings', 'CommercialPaper'], tot: ['LongTermDebt'] };
const DEBT_TOT_MAIN = new Set(['LongTermDebt', 'DebtAndCapitalLeaseObligations', 'LongTermDebtAndCapitalLeaseObligationsIncludingCurrentMaturities',
  'DebtLongtermAndShorttermCombinedAmount']);
// חלופה לפי המכשיר, לכל שורה (Welltower: "Secured debt" ב־SecuredDebtOther מ־2024, לפני כן SecuredDebt)
const DEBT_FAM = { SecuredDebtOther: ['SecuredDebt'], SecuredDebt: ['SecuredDebtOther'], UnsecuredDebt: ['UnsecuredLongTermDebt'], SeniorNotes: ['SeniorLongTermNotes'],
  ConvertibleDebt: ['ConvertibleNotesPayable'], ConvertibleNotesPayable: ['ConvertibleDebt'], LineOfCredit: ['LongTermLineOfCredit'], NotesPayable: ['LongTermNotesPayable'],
  LoansPayable: ['LongTermLoansPayable'] };
const DEBT_OF = new Map(Object.entries(DEBT_CAT).flatMap(([c, ts]) => ts.map((t) => [t, c])));
// "Accounts receivable securitization program" (Vistra ‏2018–2019, ‏ShortTermBorrowings) — הלוואה מובטחת בחייבים, חוב (גל 4)
const DEBT_LAB = /borrowing|commercial paper|notes? payable|\bdebt\b|loans? payable|bank loans?|credit facilit|senior (unsecured )?notes|convertible (senior )?notes|debentures|bonds payable|term loans?|mortgages? (payable|notes|loans)|lines? of credit|revolving|securitization (program|facilit\w*|bonds?|debt|notes|borrowings?|obligations?)/i;
// "Debt and other liabilities of CIP" (Invesco — קרנות מאוחדות, לא חוב של החברה) · "Notes Payable to Eversource Parent" — שורה של חברת־בת שהוצגה במאזן המאוחד של ‏10-Q ‏2018 (בתוך הקבוצה, מתקזזת; ‏wave-2.md ‏F12)
const DEBT_NOT = /operating lease|interest payable|accrued|accounts payable|deferred|debt securities|held.for.sale|derivative|guarantee|total liabilities|receivable|investment|due to (related|affiliat)|deposits?\b|repurchase|trading|capitalization|fair value|other than long.?term debt|\bto (\w+ )?parent\b|liabilities of/i;
// תגיות שאינן חוב גם כשהשם או התווית נשמעים כך: סך ההון והחוב, "התחייבויות לא שוטפות חוץ מחוב", רכיב ההון של אג"ח להמרה,
// ריבית לשלם, חובות לחברות קשורות, הנחות ועלויות הנפקה, נכסים. תגית מ־DEBT_CAT — תמיד חוב (Hershey: ‏LongTermDebtAndCapitalLeaseObligations)
// סך התחייבויות (LH ‏10-Q ‏2016–2024: בדף ה־R התוויות זזו בשורה, ו־LiabilitiesCurrent קיבלה את "Long-term debt, less current portion") ורווח כולל אחר
// (Morgan Stanley: ‏…NetOfCumulativeDebtValuationAdjustments — שלילי, וכל העמודה נפסלה כשגיאת סימן) — לא חוב בשום תווית (גל 4)
const DEBT_NOTAG = /OtherThanLong|^Capitalization|^EquityAndLongTermDebt|^TemporaryEquity|^ReserveForEsop|^InterestPayable|^DueTo(Affiliate|RelatedParties)|Receivable|DebtInstrumentInterestRate|^(\w*Instrument)?Unamortized|DebtFairValueAdjustment|^ConvertibleDebtEquity|^Liabilities(Current|Noncurrent)?$|^AccumulatedOtherComprehensive/;
// ...ואלה — רק כשהתווית היא של חוב (Con Edison מתייגת את "LONG-TERM DEBT" שבמאזן ב־LongTermDebtFairValue); חכירה לבדה — לא חוב
const DEBT_SOFT = /FairValue|^DebtInstrument(Face|Carrying)Amount$|Lease(s)?Liabilit|^(Finance|Operating|Capital)Lease\w*$|^CapitalLeaseObligations?\w*$/;
// "חוב לזמן ארוך כולל חלויות" — במאזן מסווג שיש בו גם שורת חלויות, השורה היא בפועל החלק הלא שוטף (Xcel)
const DEBT_TOT_LTD = new Set(['LongTermDebt', 'LongTermDebtAndCapitalLeaseObligationsIncludingCurrentMaturities']);
// שורות שאינן במאזן של היום (DEBT_IMPL): היו פעם (Microsoft: ניירות ערך מסחריים 2013–2018 ו־2023–2024), או מוצגות רק בפירוט עם
// ממד שלא נקרא (Exelon: החוב לזמן ארוך — לפי "צד קשור / לא קשור"). סדר: לא שוטף, חוב שוטף כולל (dc) לפני רכיביו; COVER — אילו
// סוגים של שורה קיימת באותו תאריך כבר כוללים אותה
// (חלויות של מכשיר מסוים — אחרונות: רק כשאין חוב שוטף כולל או חלויות באותו תאריך; Gen Digital ‏2013: ‏ConvertibleDebtCurrent; ‏WTW ‏2015:
// ‏SeniorNotesCurrent הוא חלק מ־DebtCurrent)
const DEBT_IMPL = [['nc', ['LongTermDebtNoncurrent', 'LongTermDebtAndCapitalLeaseObligations']], ['dc', ['DebtCurrent']],
  ['st', ['ShortTermBorrowings', 'CommercialPaper']], ['c', ['LongTermDebtCurrent', 'LongTermDebtAndCapitalLeaseObligationsCurrent']]];
// תווית של שורת חוב שוטף שכוללת גם הלוואות קצרות (לא "long-term borrowings" / "long-term notes payable")
const DEBT_STLAB = /short.?term|commercial paper|(?<!long.?term )(notes payable|borrowings)/i;
const DEBT_IMPL_C2 = ['ConvertibleDebtCurrent', 'ConvertibleNotesPayableCurrent', 'OtherLongTermDebtCurrent', 'SeniorNotesCurrent'];
// ltd — ערך מהתגית LongTermDebt ("חוב לזמן ארוך כולל חלויות"): כולל חלויות, לא הלוואות קצרות (Hartford: "Short-term debt" בשורה נפרדת עד
// 2019). כשההלוואות הקצרות כן בתוך LongTermDebt — הראיה בתגיות: סך החוב של החברה כבר שווה לסכום (AIG ‏2022), או ש־LongTermDebtNoncurrent
// ועוד ההלוואות שווה ל־LongTermDebt (KLA) — ראו בלולאת הרכיבים החסרים
const DEBT_COVER = { dc: ['st', 'c', 'dc', 'tot', 'ltd'], st: ['st', 'dc', 'tot'], c: ['c', 'dc', 'tot', 'ltd'], nc: ['nc', 'tot', 'ltd'] };
// החלויות של אותו מכשיר כמו שורה לא שוטפת במאזן (Palo Alto: ‏ConvertibleDebtNoncurrent ↔ ConvertibleDebtCurrent)
const DEBT_PAIR = { ConvertibleLongTermNotesPayable: 'ConvertibleNotesPayableCurrent', SeniorLongTermNotes: 'SeniorNotesCurrent', SecuredLongTermDebt: 'SecuredDebtCurrent',
  UnsecuredLongTermDebt: 'UnsecuredDebtCurrent', LongTermLoansPayable: 'LoansPayableCurrent', LongTermLineOfCredit: 'LinesOfCreditCurrent', LongTermNotesPayable: 'NotesPayableCurrent' };
// סוג השורה לפי התווית, בתגית של הלוואות קצרות: "הלוואות קצרות וחלויות" — חוב שוטף כולל; "חלויות" — חלויות (Tyler: ‏LoansPayableCurrent
// "Current portion of convertible senior notes"); ובתגית "רכה" — לפי התווית. שורת חלויות שהתווית שלה "…and notes payable" נשארת
// חלויות: התגית שלה בתאריכים אחרים היא רק החלויות (Nordson)
function debtCat(l) {
  const lab = l.label || '', cur = /current (portion|maturities)|due within one year|currently due/i.test(lab), st = /short.?term|commercial paper|notes payable|borrowings/i.test(lab);
  if (l.cat === 'st' && cur) return st ? 'dc' : 'c';
  if (!l.cat && DEBT_SOFT.test(l.tag)) return cur ? 'c' : st ? 'st' : 'nc';
  return l.cat;
}
const FIN_LEASE = /financ\w* leases?|capital leases?/i;
/* שורות החוב במאזן המודפס: [{tag, ns, cat, label, v}] ו־tot: סוף העמודה → הסכום שהודפס. רק בצד ההתחייבויות (אחרי סך הנכסים ועד
   "סך התחייבויות והון" — אחריו בא אצל בנקים פירוט הישויות המאוחדות, Bank of America: אותן שורות שוב). שורת "סך" של חוב — במקום
   השורות שלפניה (AEP: ‏"Total Short-term Debt"); "סך" בתגית פרטית ששווה לסכום — השורות נשארות. שורת חכירה מימונית לבדה — לא חוב */
function debtFace(face, cur) {
  const S = face && face.bs; if (!S || !S.rows || !S.cols) return null;
  const rows = S.rows, a0 = rows.findIndex((r) => r.tag === 'Assets');
  let stop = rows.findIndex((r) => r.tag === 'LiabilitiesAndStockholdersEquity'); if (stop < 0) stop = rows.length;
  const c0 = S.cols.findIndex((c) => SECFACE.colOk(c, cur));
  const lines = []; let grp = 0; // grp — מספר הקבוצה: מתחלף אחרי כל שורת "סך"
  for (let i = a0 + 1; i < stop; i++) {
    // הערה בסוגריים — "(includes $973 at fair value)" — לא חלק מהשם (גל 3: Goldman ‏"Unsecured short-term borrowings…", ‏JPMorgan ‏"Other
    // borrowed funds (included $13,306 … at fair value)" נפלו על "fair value"). רק הערה עם סכום — "(including current portion…)" נשארת (debtCat)
    // גל 4: גם "(portion measured at fair value: 2015 - $4,844…)" (AIG ‏2015). בשם התגית — בלי סעיף "Excluding …" (Con Edison: ‏ed:LongTermDebtExcludingHeldForSale —
    // "בלי המוחזק למכירה", נפסלה על "held for sale"; ‏2021–2024 בלי החוב לזמן ארוך)
    const r = rows[i], lab = (r.label || '').replace(/\s*\((includ|inclusive|of which|portion|measured)[^)]*\d[^)]*\)/ig, ''), txt = lab + ' ' + r.tag.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\s+Excluding\b.*$/, '');
    const cat = r.ns === 'us-gaap' ? DEBT_OF.get(r.tag) || null : null;
    const isTot = r.total || /^total\b/i.test(lab);
    const labD = DEBT_LAB.test(lab) && !DEBT_NOT.test(lab.replace(/,?\s*(measured |carried )?at fair value/ig, ''));
    const debt = (cat || !DEBT_NOTAG.test(r.tag)) && (cat ? !(DEBT_NOT.test(lab) && !DEBT_LAB.test(lab.replace(DEBT_NOT, '')))
      : DEBT_SOFT.test(r.tag) ? labD : !DEBT_NOT.test(txt) && DEBT_LAB.test(txt))
      && !(FIN_LEASE.test(lab) && !DEBT_LAB.test(lab.replace(/(financ\w*|capital) leases?( obligations?| liabilit\w*)?/ig, '')));
    if (!debt) { if (isTot) grp++; continue; }
    const v = SECFACE.rowVals(S, r);
    // אותה שורה פעמיים (Prologis ‏10-K ‏2023: שני רושמים, "Debt" חוזרת באותם ערכים) — פעם אחת (גל 2, ‏F12)
    if (lines.some((l) => l.tag === r.tag && l.v.length === v.length && l.v.every((x, i) => x === v[i]))) continue;
    // סכום־ביניים בלי "Total" (ICE ‏10-Q ‏2018: "Short-term debt" + "Long-term debt" ואחריהן "Long-term debt" ב־LongTermDebt = הסכום) —
    // שווה בכל עמודה לסכום שתיים או יותר מהשורות האחרונות שנספרו
    if (!isTot && lines.length >= 2) {
      const cs = v.map((x, i) => i).filter((i) => v[i] != null);
      let sub = false;
      for (let n = 2; n <= lines.length && !sub; n++) {
        const last = lines.slice(-n);
        sub = cs.length > 0 && cs.some((i) => v[i]) && cs.every((i) => Math.abs(last.reduce((t, l) => t + (l.v[i] || 0), 0) - v[i]) <= Math.max(1e-9, 1e-4 * Math.abs(v[i])));
      }
      if (sub) continue;
    }
    if (isTot) {
      const prev = lines.filter((l) => l.grp === grp), x = c0 >= 0 ? v[c0] : null;
      const sum = prev.reduce((t, l) => t + (c0 >= 0 && l.v[c0] != null ? l.v[c0] : 0), 0);
      if (prev.length && r.ns !== 'us-gaap' && x != null && Math.abs(sum - x) <= 0.01 * Math.abs(x)) { grp++; continue; }
      // "סך" של כל השורות שנספרו עד כאן, מכל הקבוצות (Regions: ‏"Total short-term borrowings" ‏1,574, ‏"Long-term borrowings" ‏5,861,
      // ‏"Total borrowed funds" ‏7,435) — במקום כולן, לא רק הקבוצה האחרונה (אחרת הקצרות נספרו פעמיים)
      const all = lines.reduce((t, l) => t + (c0 >= 0 && l.v[c0] != null ? l.v[c0] : 0), 0);
      if (r.ns === 'us-gaap' && x != null && lines.length > prev.length && prev.length && Math.abs(all - x) <= Math.max(1e-9, 1e-3 * Math.abs(x))) { lines.length = 0; lines.push({ tag: r.tag, ns: r.ns, cat, label: lab, v, grp }); grp++; continue; }
      // גל 8 (F38): "סך" קטן מהשורות שלפניו, ששווה בכל עמודה לרצף השורות שמעליו — גם שורות שאינן חוב (Capital One: ‏"Total other debt"
      // ‏36,833 = ריפו ‏880 + ‏18,684 + ‏17,269, בלי האיגוח ‏11,624 שמעליהן; ריפו אינו חוב) — סכום־ביניים של שורות שכבר טופלו. עד היום נספרו
      // גם השורות וגם הסך (84,410 במקום 47,577)
      if (prev.length && x != null && sum > 0 && x < sum - 0.01 * sum) {
        const cs = v.map((y, ci) => ci).filter((ci) => v[ci] != null), acc = v.map(() => 0);
        let run = false, n = 0, deb = false;
        for (let k = i - 1; k > a0 && !run; k--) {
          const rk = rows[k]; if (rk.total || /^total\b/i.test(rk.label || '')) break;
          SECFACE.rowVals(S, rk).forEach((y, ci) => { if (y != null && ci < acc.length) acc[ci] += y; });
          n++; deb = deb || prev.some((l) => l.tag === rk.tag);
          run = n >= 2 && deb && cs.some((ci) => v[ci]) && cs.every((ci) => Math.abs(acc[ci] - v[ci]) <= Math.max(1e-9, 1e-4 * Math.abs(v[ci])));
        }
        if (run) { grp++; continue; }
      }
      // "Total short-term debt" קטן מהשורות שלפניו (Vulcan ‏10-Q ‏2026: חלויות ‏400, ‏"Total short-term debt" ‏0) — הוא לא הסך שלהן
      if (!(x != null && sum > 0 && x < sum - 0.01 * sum)) for (const l of prev) lines.splice(lines.indexOf(l), 1);
    }
    lines.push({ tag: r.tag, ns: r.ns, cat, label: lab, v, grp });
    if (isTot) grp++;
  }
  // חלויות שוטפות שדף ה־R הציג אחרי סך ההתחייבויות וההון (Seagate ‏10-Q ‏2020: "Less: current portion of debt" ‏25 בשורה האחרונה) —
  // נספרות רק כשהן משלימות את "סך התחייבויות שוטפות" (השורות שלפניו + החלויות = הסך, בכל עמודה) — כלומר הן שורה של המאזן
  const lc = rows.findIndex((r, i) => i > a0 && i < stop && r.tag === 'LiabilitiesCurrent');
  if (lc > 0 && c0 >= 0) {
    const from = rows.slice(a0 + 1, lc).reduce((k, r, i) => (r.total || /^total\b/i.test(r.label || '') ? a0 + 1 + i : k), a0);
    const vLc = SECFACE.rowVals(S, rows[lc]);
    for (let i = stop + 1; i < rows.length; i++) {
      const r = rows[i]; if (r.ns !== 'us-gaap' || DEBT_OF.get(r.tag) !== 'c' || lines.some((l) => l.tag === r.tag)) continue;
      const v = SECFACE.rowVals(S, r);
      const fit = S.cols.every((c, ci) => {
        if (vLc[ci] == null || v[ci] == null) return true;
        let t = 0; for (let k = from + 1; k < lc; k++) { const x = SECFACE.rowVals(S, rows[k])[ci]; if (x != null) t += x; }
        return Math.abs(t + v[ci] - vLc[ci]) <= Math.max(1, 1e-4 * Math.abs(vLc[ci]));
      });
      if (fit && v[c0] != null) lines.push({ tag: r.tag, ns: r.ns, cat: 'c', label: r.label || '', v, grp: grp++ });
    }
  }
  const tot = new Map(), cols = [];
  S.cols.forEach((c, ci) => {
    if (!SECFACE.colOk(c, cur)) return;
    let s = 0, any = false; for (const l of lines) if (l.v[ci] != null) { s += l.v[ci]; any = true; }
    if (any && !tot.has(c.end)) { tot.set(c.end, s); cols.push([c.end, ci]); }
  });
  // מאזן מסווג — יש בו "סך התחייבויות שוטפות" (KLA: היום בלי שורת חלויות, ו־"Long-term debt" בתגית LongTermDebt היא הלא שוטף)
  return { lines, tot, cols, cls: rows.slice(a0 + 1, stop).some((r) => r.tag === 'LiabilitiesCurrent') };
}
/* החוב לפי המאזן המודפס של כל הגשה (17/11/2026, גל 2 — lib/bsfiled.js): {acc: {form, filed, bs}} → Map(סוף → {v, form, filed}).
   לכל תאריך — ההגשה השנתית האחרונה שמדפיסה אותו בעמודה של מאזן (יש בה סך נכסים), אחרת הרבעונית האחרונה — כמו הבודק
   (face_debt ב־tools/fund-deep/verify.py). רק כשיש שורות חוב במאזן של אותה הגשה (בלי שורות — לא "0", אלא הכלל של F7) */
function bsfDebt(have, cur) {
  const per = new Map();
  for (const x of Object.values(have || {})) {
    if (!x || !x.bs) continue;
    let dF = null; try { dF = debtFace({ bs: x.bs }, cur); } catch (e) { dF = null; }
    if (!dF || !dF.lines.length) continue;
    const a = x.bs.rows.find((r) => r.tag === 'Assets') || x.bs.rows.find((r) => r.tag === 'LiabilitiesAndStockholdersEquity');
    for (const [end, ci] of dF.cols) {
      // עמודה בלי סך נכסים — ביאור, לא מאזן (Welltower); ‏0 = עמודה ריקה (Albemarle ‏10-Q ‏2015: עמודות של 2014 עם אפסים בכל שורה)
      if (!a || !a.v[ci]) continue;
      // שורת חוב שלילית — שגיאת סימן בהגשה (Hartford ‏10-K ‏2016/2017: ‏"Long-term debt" ‏(5,084) — 2 מתוך 12,288 מאזנים; ‏wave-2.md ‏F12) — לא נספרת
      if (dF.lines.some((l) => l.v[ci] < 0)) continue;
      const ann = !/^10-Q/.test(x.form), b = per.get(end);
      if (!b || (ann && !b.ann) || (ann === b.ann && x.filed > b.filed)) per.set(end, { v: dF.tot.get(end), form: x.form, filed: x.filed, ann });
    }
  }
  return per;
}
/* פחת והשקעות הוניות לפי דף התזרים המודפס של כל 10-K (17/11/2026, גל 3 — F13; ‏lib/bsfiled.js שדה cf). companyfacts לא אומר באיזה דוח
   הופיע ערך: בשנים שבהן התזרים הדפיס את השורה בתגית אחרת מהיום, הסדרה לקחה ערך מביאור (Apple ‏2014–2015: ‏9.2B מביאור מול ‏11.26B
   בתזרים; Tesla, ‏Franklin, ‏RTX, ‏WEC). לכל סוף שנה — ה־10-K האחרון שמדפיס אותו בעמודה של 12 חודשים (ההצגה האחרונה, כמו בשאר
   הסדרות). רק כשבתזרים יש שורה אחת בלבד מהתגיות שלנו — גם ב־10-K האחרון וגם באותו דוח (כמה שורות פחת = סכום שאינו בדוח, ד);
   ובפחת — לא כשהשורה (או הסדרה היום) היא "Depreciation" בלבד (הסדרה עוקבת אחרי פחת בלי הפחתות — החלטה קיימת, ד).
   {have} → {dep: Map(סוף → {v, filed}), capex: …, last: התאריך של ה־10-K האחרון}. השער (הסדרה עוקבת היום אחרי השורה) — בהחלה */
function bsfCf(have, cur, tags) {
  const ann = Object.values(have || {}).filter((x) => x && x.cf && x.cf.rows && /^10-K/.test(x.form)).sort((a, b) => (a.filed < b.filed ? 1 : -1));
  const out = {};
  if (!ann.length) return out;
  for (const k of ['dep', 'capex']) {
    const list = tags[k] || [];
    const cand = (x) => x.cf.rows.filter((r) => r.ns === 'us-gaap' && list.includes(r.tag));
    const c0 = cand(ann[0]);
    if (c0.length !== 1 || (k === 'dep' && c0[0].tag === 'Depreciation')) continue;
    const M = new Map(), seen = new Set(), printed = new Map();
    for (const x of ann) {
      const c = cand(x), bad = c.length !== 1 || (k === 'dep' && c[0].tag === 'Depreciation');
      // כל ערך שהודפס בשורה מהתגיות שלנו, בכל 10-K (גם דו־משמעי) — ערך כזה בסדרה הוא הצגה מסוימת, לא ביאור
      for (const r of c) SECFACE.rowVals(x.cf, r).forEach((v, ci) => { const col = x.cf.cols[ci]; if (v == null || !col || col.months !== 12) return; if (!printed.has(col.end)) printed.set(col.end, []); printed.get(col.end).push(k === 'capex' ? Math.abs(v) : v); });
      const vals = bad ? [] : SECFACE.rowVals(x.cf, c[0]);
      x.cf.cols.forEach((col, ci) => {
        if (col.months !== 12 || !SECFACE.colOk(col, cur) || seen.has(col.end)) return;
        // השנה שייכת לדוח האחרון שמדפיס אותה — גם כשהוא דו־משמעי (שתי שורות: DHI, ‏Devon, ‏Edison) לא יורדים לדוח ישן יותר
        seen.add(col.end);
        // השקעה הונית מודפסת כתשלום (במינוס) — ערך מוחלט; פחת — כפי שהודפס (Allstate ‏2009: ‏(91) בשורה של פחת ושאר פריטים)
        if (!bad && vals[ci] != null) M.set(col.end, { v: k === 'capex' ? Math.abs(vals[ci]) : vals[ci], filed: x.filed });
      });
    }
    M.printed = printed;
    if (M.size) out[k] = M;
    out.last = ann[0].filed;
  }
  return out;
}
/* רווח והפסד לפי הגשה (18/11/2026, גל 5 — F20; ‏lib/bsfiled.js שדה is). כמו F13 בתזרים: companyfacts לא אומר באיזה דוח הופיע ערך,
   ובשנים שבהן השורה המודפסת הייתה בתגית אחרת (או פרטית של החברה — לא ב־companyfacts) הסדרה לקחה ערך מביאור או נשארה ריקה.
   Howmet: הריבית 2019–2023 מביאור (371 מול 338 המודפס); Ross: הרווח התפעולי 2013–2022 ריק; Williams-Sonoma: עלות המכר.
   השורה = "אותה שורה" בשרשור לפי חפיפה, לא לפי תגית: בדוח האחרון — השורה היחידה ששווה לסדרה שלנו בכל השנים שהוא מדפיס (לפחות
   שתיים; זה גם השער — הסדרה כבר עוקבת היום אחרי השורה); בכל 10-K ישן יותר — השורה היחידה שערכיה בשנים שכבר נקבעו שווים להם, והשנים
   החדשות שלה נקבעות (השנה שייכת ל־10-K האחרון שמדפיס אותה). ours: k → Map(סוף → ערך). abs — מדדים שמודפסים לפעמים במינוס.
   → {k: Map(סוף → {v, filed})}, ‏printed: Map(סוף → כל הערכים שהודפסו בדוח רווח והפסד בשנה הזו, בכל שורה), ‏own: השנה של כל 10-K */
const IS_KEYS = ['int', 'pretax', 'cogs', 'rnd', 'tax', 'op'], IS_ABS = new Set(['int', 'cogs', 'rnd']);
/* q (גל 6 — F20 ברבעונים): אותו שרשור על דפי רווח והפסד של 10-Q, בעמודות של 3 חודשים. כל 10-Q מדפיס את הרבעון ואת אותו רבעון
   בשנה הקודמת, ולכן השרשור הוא לכל רבעון פיסקלי לחוד — וכל שרשרת מתחילה בעוגן (שורה ששווה לסדרה שלנו בשני הרבעונים שלה) */
/* גל 7 (F32): ברבעונים גם 10-K שמדפיס עמודות של 3 חודשים בדף הרווח והפסד (Iron Mountain, ‏Baxter, ‏Eaton, ‏Kraft Heinz — שמונה
   רבעונים בדוח השנתי) — הוא ההגשה האחרונה שמדפיסה את הרבעונים האלה, אחרי ההצגה מחדש; ובלעדיו השרשור חזר לערך של ה־10-Q המקורי */
function bsfIs(have, cur, ours, q) {
  const MON = q ? 3 : 12, FORM = q ? /^10-[QK]/ : /^10-K/;
  let ann = Object.values(have || {}).filter((x) => x && x.is && x.is.rows && FORM.test(x.form)).sort((a, b) => (a.filed < b.filed ? 1 : -1));
  const out = {};
  if (!ann.length) return out;
  const near = (a, b) => Math.abs(a - b) <= Math.max(5e5, 5e-3 * Math.abs(b));
  // כל שורה: {סוף → ערך} בעמודות של 12 חודשים
  const yv = (x) => x.is.rows.map((r) => { const o = new Map(); SECFACE.rowVals(x.is, r).forEach((v, ci) => { const c = x.is.cols[ci]; if (v != null && c && c.months === MON && SECFACE.colOk(c, cur) && !o.has(c.end)) o.set(c.end, v); }); o.tag = r.ns + ':' + r.tag; return o; }).filter((o) => o.size);
  let Y = ann.map(yv);
  // הגשה בלי אף עמודה בתקופה הזו (10-K בלי רבעונים) — לא בשרשור
  if (q) { ann = ann.filter((_, i) => Y[i].length); Y = Y.filter((r) => r.length); if (!ann.length) return out; }
  const printed = new Map();
  for (const rows of Y) for (const o of rows) for (const [e, v] of o) { if (!printed.has(e)) printed.set(e, []); printed.get(e).push(Math.abs(v)); }
  out.printed = printed;
  // ההגשה האחרונה שמדפיסה כל תקופה, בשורה כלשהי (ann ממוין מהחדשה) — לשמירה של F32: ערך שנלקח מהגשה ישנה יותר אינו ההצגה האחרונה
  out.lastF = new Map(); Y.forEach((rows, i) => { for (const o of rows) for (const e of o.keys()) if (!out.lastF.has(e)) out.lastF.set(e, ann[i].filed); });
  // השנה של כל 10-K (סוף העמודה המאוחרת של 12 חודשים) — תיקון של ערך קיים רק כשהדוח של אותה שנה עצמה בחלון (AMD ‏2010,
  // ‏CCI ‏2009–2012: הדוח המקורי לפני החלון, והשנה הודפסה רק אחר כך — אחרי הצגה מחדש; הערך שלנו מהדוח המקורי ולא שגוי)
  out.own = Y.map((rows) => { let m = null; for (const o of rows) for (const e of o.keys()) if (!m || e > m) m = e; return m; }).filter(Boolean);
  const at = (M, e) => { if (M.has(e)) return M.get(e); for (const [k, v] of M) if (Math.abs(day(k) - day(e)) <= 7) return v; return null; };
  for (const k of IS_KEYS) {
    const S = ours[k]; if ((!S || !S.size) && (q || k !== 'pretax')) continue;
    const f = (v) => (IS_ABS.has(k) ? Math.abs(v) : v);
    const same = (o, est) => [...est.keys()].some((e) => o.has(e)) && [...o].every(([e, v]) => !est.has(e) || near(f(v), est.get(e)));
    // שתי שורות זהות (אותו מספר פעמיים בדוח) — אחת
    const uniq = (c) => c.filter((o, i) => !c.slice(0, i).some((p) => p.size === o.size && [...o].every(([e, v]) => p.get(e) === v)));
    // "עוגן": שורה ששווה לסדרה שלנו בכל השנים שהיא מדפיסה ושיש לנו בהן ערך — לפחות שתיים
    const anchor = (rows) => uniq(rows.filter((o) => { let n = 0; for (const [e, v] of o) { const x = at(S || new Map(), e); if (x == null) continue; if (!near(f(v), f(x))) return false; n++; } return n >= 2; }));
    let u0 = uniq(Y[0].filter((o) => o.size >= 2 && [...o].every(([e, v]) => { const x = at(S || new Map(), e); return x != null && near(f(v), f(x)); })));
    // F28 (גל 6) — עוגן חשבוני לרווח לפני מס, כשהסדרה שלנו ריקה בכל השנים של הדוח האחרון (התגית פרטית: BNY ‏bk:, ‏Oracle ‏orcl:):
    // השורה היחידה R שבכל שנה R − מס = רווח נקי, כשהמס (us-gaap ‏IncomeTaxExpenseBenefit) שווה לסדרת המס שלנו והרווח הנקי הוא שורה
    // של us-gaap ‏(ProfitLoss / ‏NetIncomeLoss / רווח מפעילות נמשכת). מבחן חשבוני, לא לפי השם (לקח גל 2)
    if (!u0.length && !q && k === 'pretax' && ours.tax && ![...Y[0]].some((o) => [...o.keys()].some((e) => S && at(S, e) != null))) {
      const T = Y[0].filter((o) => o.tag === 'us-gaap:IncomeTaxExpenseBenefit' && o.size >= 2 && [...o].every(([e, v]) => { const x = at(ours.tax, e); return x != null && near(v, x); }));
      const NI = Y[0].filter((o) => /^us-gaap:(ProfitLoss|NetIncomeLoss|IncomeLossFromContinuingOperations(IncludingPortionAttributableToNoncontrollingInterest)?)$/.test(o.tag));
      if (T.length && NI.length) u0 = uniq(Y[0].filter((o) => o.size >= 2 && !T.includes(o) && !NI.includes(o) && T.some((t) => NI.some((n) => [...o].every(([e, v]) => t.has(e) && n.has(e) && near(v - t.get(e), n.get(e)))))));
    }
    if (u0.length !== 1) continue;
    const est = new Map([...u0[0]].map(([e, v]) => [e, f(v)])), M = new Map([...est].map(([e, v]) => [e, { v, filed: ann[0].filed, tag: u0[0].tag }]));
    // ברבעונים (גל 7 — F32): התגית של השורה שקבעה כל רבעון. ב־10-Q יש רק עמודה חופפת אחת (אותו רבעון אשתקד), ושוויון בעמודה אחת
    // הוא לפעמים מקרי (Cardinal ‏op ← שורת המס, ‏AT&T ‏op ← "Broadcast, programming", ‏DaVita ‏pretax ← "Other revenues"). לכן:
    // שורה בתגית של הרבעון החופף גוברת; שורה בתגית אחרת — רק כשאין בהגשה שורה בתגית הזו (התגית הוחלפה); ואם השורה בתגית הזו
    // לא שווה (הצגה מחדש של הרבעון החופף) — ממשיכים בה: העמודה של אשתקד בהגשה הזו היא ההצגה האחרונה של אותו רבעון
    const eTag = new Map([...u0[0].keys()].map((e) => [e, u0[0].tag]));
    const put = (o, i) => { for (const [e, v] of o) if (!est.has(e)) { est.set(e, f(v)); eTag.set(e, o.tag); M.set(e, { v: f(v), filed: ann[i].filed, tag: o.tag }); } };
    for (let i = 1; i < ann.length; i++) {
      const u = uniq(Y[i].filter((o) => same(o, est)));
      if (q) {
        const t0 = new Set(); for (const o of Y[i]) for (const e of o.keys()) if (eTag.has(e)) t0.add(eTag.get(e));
        const fresh = (o) => [...o.keys()].some((e) => !est.has(e));
        const ut = u.filter((o) => t0.has(o.tag)), tr = uniq(Y[i].filter((o) => t0.has(o.tag)));
        if (ut.length === 1) { put(ut[0], i); continue; }
        if (!tr.length && u.length === 1) { put(u[0], i); continue; }
        if (tr.length === 1 && !u.length && fresh(tr[0])) { put(tr[0], i); continue; }
        if (tr.length || u.length) continue;
      }
      if (u.length === 1) { put(u[0], i); continue; }
      if (u.length) continue;
      // F28 (גל 6) — עוגן מחדש: השרשור נשבר (הדוח הזה הדפיס את השנים שכבר נקבעו על בסיס אחר — Ameriprise: ה־10-K של 2023 לפני
      // ההצגה מחדש של 2024), אבל שורה אחת בו שווה לסדרה שלנו בשתי שנים לפחות — זו השורה; השנים החדשות שלה נקבעות, והשרשור ממשיך ממנה
      const a = anchor(Y[i]).filter((o) => [...o.keys()].some((e) => !est.has(e)));
      if (a.length !== 1) continue;
      for (const [e, v] of a[0]) { if (!est.has(e)) M.set(e, { v: f(v), filed: ann[i].filed, tag: a[0].tag }); est.set(e, f(v)); eTag.set(e, a[0].tag); }
    }
    out[k] = M;
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

/* סדרה רבעונית מתגית אחת בלבד — למכפיל באפט (19/11/2026, גל 1 של שיטת באפט; docs/buffett-method-research.md §13.11). רבעון ישיר,
   מצטבר פחות המצטבר הקודם מאותה התחלה, או שנה פחות שלושה רבעונים ישירים — תמיד באותה תגית. "sbc" הכללי משלים תקופות מתגית אחרת
   (mergeTags: תזרים ‏ShareBasedCompensation לצד ההוצאה בדוח הרווח ‏AllocatedShareBasedCompensationExpense), ורבעון מאחת ליד רבעון
   מהשנייה הוא ערבוב — Palo Alto: ‏684 בדוח הרווח מול 517 בשורת התגמול בגישור. בלי הצגה מחדש (subPick) — זה גיבוי לסכום בהודעה */
function tagQ(f, ends) {
  const out = {};
  if (!f || !f.dur || !f.dur.size) return out;
  const byEnd = new Map();
  for (const [kk, h] of f.dur) { const [s, e] = kk.split('|'); if (!byEnd.has(e)) byEnd.set(e, []); byEnd.get(e).push([s, h.v]); }
  const direct = (e) => { const L = byEnd.get(e); if (L) for (const [s, v] of L) if (qLen(day(e) - day(s))) return v; return null; };
  for (const e of ends) {
    const L = byEnd.get(e);
    if (!L) continue;
    let v = direct(e);
    for (const [s, x] of v == null ? L : []) {
      if (day(e) - day(s) < 150) continue;
      for (const [e1, L1] of byEnd) { if (!qLen(day(e) - day(e1))) continue; const p = L1.find((y) => y[0] === s); if (p) { v = x - p[1]; break; } }
      if (v != null) break;
      if (day(e) - day(s) >= 350) { // שנה פחות שלושה רבעונים ישירים שבתוכה
        const qs = [...byEnd.keys()].filter((q) => q > s && q < e && direct(q) != null);
        if (qs.length === 3) { v = x - qs.reduce((t, q) => t + direct(q), 0); break; }
      }
    }
    if (v != null) out[e] = v;
  }
  return out;
}
/* 12 חודשים עד end מתגית אחת (גל 3 של מכפיל באפט — דרך ב): חברה שמתייגת רק בדוח השנתי (Emerson — ההפחתה רק ב־10-K) אין לה
   רבעונים. שנה שמסתיימת ב־end, ואחרת השנה הקודמת + המצטבר מתחילת השנה − המצטבר של התקופה המקבילה. null — אין */
function tagTTM(f, end) {
  if (!f || !f.dur || !f.dur.size || !end) return null;
  const ds = [...f.dur].map(([kk, h]) => { const [s, e] = kk.split('|'); return { s, e, n: day(e) - day(s), v: h.v }; });
  const yr = (x) => x.n >= 350 && x.n <= 380, de = day(end);
  const fy = ds.find((x) => x.e === end && yr(x)); if (fy) return fy.v;
  for (const ytd of ds.filter((x) => x.e === end && x.n > 60 && x.n < 300)) {
    const prev = ds.find((x) => yr(x) && Math.abs(day(x.e) - day(ytd.s)) <= 7);
    if (!prev) continue;
    const old = ds.find((x) => x.s === prev.s && Math.abs(day(x.e) - (de - 365)) <= 10 && Math.abs(x.n - ytd.n) <= 10);
    if (old) return prev.v + ytd.v - old.v;
  }
  return null;
}
// ההוצאה בדוח הרווח · התוספת בתזרים · הגידול בהון · הפחתת נכסים בלתי מוחשיים (שנרכשו) — סדר הנפילה של §13.11 ונוסחת §13.5
// גל 3 (דרך ב, §6.10): רווחי והפסדי השקעות — ני"ע הוניים בשווי הוגן, ואם אין — השקעות בכלל (רווח חיובי). הלקוח בוחר עמודה אחת לכל
// 4 הרבעונים, בלי ערבוב
const BX_TAGS = ['AllocatedShareBasedCompensationExpense', 'ShareBasedCompensation',
  'AdjustmentsToAdditionalPaidInCapitalSharebasedCompensationRequisiteServicePeriodRecognitionValue', 'AmortizationOfIntangibleAssets',
  'EquitySecuritiesFvNiGainLoss', 'GainLossOnInvestments'];

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
/* תגית משלימה שאין לה אף תקופה משותפת עם הסדרה: לכל תקופה שלה — התקופה הקרובה בסדרה באותו אורך (עד שנה וחצי לפני/אחרי), באותו
   סימן (רק במדדים של NB_KEYS). החציון של היחסים רחוק פי NB_FAR ויותר = מדד אחר (רכיב, ביאור) — לא משלימים. בלי שכן להשוואה — כמו היום (משלימים) */
const NB_FAR = 4;
// גל 8 (F34): תגיות המניות המדוללות, והתוספת המדוללת (הכוללת קודם) — לחברה בלי אף תגית מדוללת
const SH_DIL = ['WeightedAverageNumberOfDilutedSharesOutstanding', 'WeightedAverageNumberOfShareOutstandingBasicAndDiluted'];
const SH_INC = ['WeightedAverageNumberDilutedSharesOutstandingAdjustment', 'IncrementalCommonSharesAttributableToShareBasedPaymentArrangements'];
// רק מדדים יציבים משנה לשנה. לא רווחים (תנודתיים ומחליפים סימן — Viatris: רבעוני הרווח הנקי 2020–2026 בתגית משלימה, מול Mylan
// לפני המיזוג), לא דיבידנדים ורכישות (חד־פעמיים — HII ‏2011: ‏$1.43B ל־Northrop עם הפיצול, מודפס) ולא מניות (Viatris — חברת המעטפת)
const NB_KEYS = new Set(['int', 'cogs', 'rnd', 'dep', 'sbc', 'msec']);
function nbFar(m, f) {
  const r = [];
  for (const [kk, v] of f.dur) {
    const [s, e] = kk.split('|'), L = day(e) - day(s);
    let best = null, bd = 550;
    for (const [k2, h] of m.dur) {
      const [s2, e2] = k2.split('|'); if (Math.abs(day(e2) - day(s2) - L) > 20) continue;
      const d = Math.abs(day(e2) - day(e)); if (d < bd) { bd = d; best = h; }
    }
    if (best && best.v && v.v && Math.sign(best.v) === Math.sign(v.v)) r.push(Math.abs(Math.log(Math.abs(v.v) / Math.abs(best.v))));
  }
  for (const [e, v] of f.inst) {
    let best = null, bd = 550;
    for (const [e2, h] of m.inst) { const d = Math.abs(day(e2) - day(e)); if (d < bd) { bd = d; best = h; } }
    if (best && best.v && v.v && Math.sign(best.v) === Math.sign(v.v)) r.push(Math.abs(Math.log(Math.abs(v.v) / Math.abs(best.v))));
  }
  if (!r.length) return false;
  r.sort((a, b) => a - b);
  return r[(r.length - 1) >> 1] > Math.log(NB_FAR);
}
function mergeTags(fs, lock, qclash, best, nb, win) {
  const last = (f) => { let e = ''; for (const kk of f.dur.keys()) { const x = kk.split('|')[1]; if (x > e) e = x; } for (const x of f.inst.keys()) if (x > e) e = x; return e; };
  const has = fs.map((f) => f.dur.size + f.inst.size > 0);
  const m = { dur: new Map(), inst: new Map() };
  // הראשית = הראשונה בסדר העדיפות מבין התגיות שעדיין מדווחות (עד שנה מהתקופה המאוחרת ביותר)
  const top = Math.max(...fs.map((f, i) => (has[i] ? day(last(f)) : -Infinity)));
  if (!isFinite(top)) return m;
  // win: חלון קצר יותר כשאף מועמדת לא מודפסת במאזן של הדוח האחרון (גל 5, F22 — Brown & Brown: ‏ShortTermInvestments המודפסת עד
  // 12/2024, מול תגית מביאור שנעצרה ב־12/2023 ונבחרה כי קודמת ברשימה). לא ברכיבי החוב (Cintas ‏2016: ההלוואות לזמן קצר נעלמו)
  const spine = fs.findIndex((f, i) => has[i] && day(last(f)) >= top - (win || 400));
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
      // בלי תקופה משותפת אין עדות שזה אותו מדד — רק כשהיא סבירה מול השכנים (גל 5 בבדיקת העומק, F21): Howmet ‏2018 — ריבית 19
      // מ־InterestExpenseDebt (רכיב) מול ~300 בשנים הסמוכות
      if (g == null && nb && nbFar(m, f)) continue;
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
        for (const k1 of f.dur.keys()) { const [s1, e1] = k1.split('|'), g = day(e) - day(e1); if (s1 === s2 && qLen(g) && diff(k1)) return true; }
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
      // הסדרה היא סכום של שורות (השקעות הוניות: רכוש קבוע + תוכנה), והחלופה = אחד החלקים באותן שנים — היא חלק, לא תיקון
      // (Robinhood 2021–2022: ‏PaymentsToAcquireProductiveAssets ‏$63M/$28M = רק "Purchases of property, software, and equipment";
      // הסכום עם התוכנה שפותחה ‏$83M/$57M, כמו בדוח של 2022 ובשנים שאחריו)
      const sp = m.fs && m.fs[m.spine] && m.fs[m.spine].parts;
      if (sp && sp.length > 1) { let sub = true; for (let x = i; x <= j && sub; x++) { const fv = f.dur.get(ends[x]).v; sub = sp.some((p) => { const h = p.dur.get(ends[x]); return h && Math.abs(h.v - fv) <= MERGE_TOL * Math.abs(fv); }); } if (sub) { i = j; continue; } }
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
function normalizeSec(facts, splits = [], face = null, bsf = null) {
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
  let cur = null, cogsRows = null, capRows = [], capFace = null;
  for (const k of Object.keys(map)) {
    // הרווח הנקי — רק מדוח רווח והפסד: התזרים מתחיל ב"רווח נקי" כולל זכויות מיעוט (ProfitLoss), ובלי דוח רווח והפסד
    // שזוהה הוא קפץ לפני NetIncomeLoss (Devon 2024: ‏$2.94B במקום ‏$2.89B; Royal Caribbean, General Mills)
    const onFace0 = faceTagList(face, k === 'ni' ? (face && face.is ? ['is'] : []) : STMT_OF[k]), list = map[k].slice();
    // הפרש תגיות "בדוח" כששני החלקים בדוח (Bloom Energy: "Net loss" ו־"Net income attributable to noncontrolling interest")
    const onFace = onFace0.concat(list.filter((t) => /[-+]/.test(t) && t.split(/[-+]/).every((x) => onFace0.includes(x))));
    // בין אלה שבדוח — לפי סדר הדוחות (פחת: התזרים לפני רווח והפסד), ובתוך דוח — סדר העדיפות שלנו (מדולל לפני בסיסי).
    // McDonald's: ‏"Depreciation and amortization" בתזרים ב־DepreciationAndAmortization (‏$2.2B), ו־DepreciationDepletionAndAmortization
    // שורה של "הוצאות אחרות" ברווח והפסד (‏$457M) — עד 17/11/2026 הפחת יצא ‏$457M (בדיקת העומק, גל 2, ‏F13)
    const stOf = (t) => { const ss = k === 'ni' ? ['is'] : STMT_OF[k] || []; const i = ss.findIndex((st) => faceTagList(face, [st]).includes(t)); return i < 0 ? 0 : i; };
    let order = list.filter((t) => onFace.includes(t)).map((t, i) => [t, stOf(t), i]).sort((a, b) => a[1] - b[1] || a[2] - b[2]).map((x) => x[0])
      .concat(list.filter((t) => !onFace.includes(t)));
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
    let fs = order.map((tag) => (/-/.test(tag) ? diffFacts(...tag.split('-').map((t) => tagFacts(tax[t], unitOf(k)))) : /\+/.test(tag) ? sumFacts(tag.split('+').map((t) => tagFacts(tax[t], unitOf(k)))) : tagFacts(tax[tag], unitOf(k)))), names = order;
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
      capRows = parts.slice(); // השורות שבדוח (גם פיתוח נדל"ן לבד) — לסכום מול שורה בתגית פרטית של החברה (למטה)
      if (parts.length === 1 && CAPEX_PAIR.includes(parts[0])) parts = [];
      // הסכום הוא מועמד אחד לצד התגיות לחוד — mergeTags בוחר את הראשית מבין אלה שעדיין מדווחות
      // (Entergy: חברת בת הציגה PaymentsToAcquireProductiveAssets בעמוד, הסכום קיים רק ל־2023, ו־2024–2025 יצאו ריקות)
      if (parts.length > 1) {
        const pf = parts.map((t) => tagFacts(tax[t], unitOf(k))), sf = sumFacts(pf);
        sf.parts = pf; // fixRuns: תגית שהיא אחד החלקים — לא "תיקון" של הסכום
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
    merged[k] = k === 'cash' ? cashMerge(fs, rsub ? RCASH.map((g) => g.map((t) => tagFacts(tax[t], unitOf(k)))) : null) : mergeTags(fs, lock, k === 'capex', k === 'ni', NB_KEYS.has(k), INST[k] && !/^(debt|stb)/.test(k) && face && face.bs && face.bs.rows && !list.some((t) => onFace.includes(t)) ? 200 : 0); // רק בהשקעות הוניות: בהכנסות/תזרים התגית המשלימה היא לפעמים הרבעון היחיד (Dollar Tree)
    if (merged[k].spine != null) tags[k] = names[merged[k].spine];
  }
  // השקעות הוניות שבתזרים רק בתגית של החברה (Kimco: ‏"Improvements to operating real estate" ‏$347.6M; ‏Weyerhaeuser, Zimmer,
  // ‏United Rentals; ‏EQR/VMRK: ‏"Non-real estate capital additions" לצד "Capital expenditures to real estate" — לא "Interest capitalized") והתגית שלנו אינה שורה בתזרים (ביאור, ‏$18.4M) — עדיף ריק (ומושלם מ־Yahoo) מחלק קטן. לא ב־companyfacts.
  if (!isIfrs && tags.capex && face && face.cf && face.cf.rows && face.cf.rows.length) {
    const rows = face.cf.rows, mine = tags.capex.split('+'), c0 = face.cf.cols && face.cf.cols[0];
    const own = rows.filter((r) => !/^(us-gaap|ifrs-full)$/.test(r.ns) && /capital expenditure|capital additions?|improvements? to|purchases? (of|for) (property|rental|non-rental|equipment)/i.test(r.label || '') && !/accru|incurred|not yet paid|payable|unpaid|non-?cash/i.test(r.label || '')
      // לא תקבולים ולא שורות "קשורות" להשקעה (Dow: ‏"Proceeds from incentives related to…", ‏"Cash flow hedging related to capital expenditures")
      // ולא מקדמות ושורות מימון (Strategy: ‏"Advance deposits on purchases of property and equipment"; PG&E: ‏"…financed through…");
      // שורת תשלום — עם ערך שלילי בדוח (שינוי בהשקעות שלא שולמו — Exelon, ‏"…not paid")
      && !/proceeds|hedg|incentive|reimburs|related to|not paid|deposit|advance|financ/i.test(r.label || '') && SECFACE.rowVals(face.cf, r).some((v) => v != null && v < 0));
    // רק כשהערך שלנו לשנה האחרונה שבדוח שונה מסכום השורות (ConocoPhillips: אותו סכום גם בביאור בתגית רגילה — נשאר)
    const tot = own.reduce((t, r) => t + Math.abs(SECFACE.rowVals(face.cf, r)[0] || 0), 0);
    let ours = null; for (const [kk, h] of merged.capex.dur) { const [a, b] = kk.split('|'); if (c0 && b === c0.end && day(b) - day(a) >= 350) ours = Math.abs(h.v); }
    // (26/10/2026) גם כשהתגית שלנו בדוח, לצד שורה בתגית פרטית: CoStar — "Purchases of property, equipment, and other assets"
    // ‏$82M (פרטית) + "…for new campuses" ‏$307M (שלנו); ‏Weyerhaeuser — "Capital expenditures for property and equipment" ‏$423M
    // (פרטית) + "…for timberlands reforestation" ‏$51M (שלנו); ‏Ventas — "Capital expenditures" (פרטית) + "Development project
    // expenditures". ההשקעה ההונית = כל השורות שבדוח: בכל עמודה של 12 חודשים — השורות הפרטיות + שורות ההשקעה ההונית
    // הרגילות (capRows; כל תגית פעם אחת — Valero מדפיסה אותה תגית שוב לכל ישות). שורה פרטית שהיא כבר הסך ("Total …", או
    // שווה לסכום השורות האחרות) — היא לבד. capFace עובר ל־fundamentals: Yahoo רק כשהוא תואם לסכום בכל שנה שבדוח, אחרת הסכום
    const onF = mine.some((t) => rows.some((r) => r.tag === t));
    if (own.length) {
      const reg = [...new Set(capRows.concat(onF ? mine : []))].map((t) => rows.find((r) => r.tag === t)).filter(Boolean);
      const vals = [];
      (face.cf.cols || []).forEach((c, ci) => {
        if ((c.months != null && c.months !== 12) || !SECFACE.colOk(c, rc || cur || 'USD')) return; // לא עמודת המרה לדולר (PDD)
        const o = own.map((r) => Math.abs(SECFACE.rowVals(face.cf, r)[ci] || 0)), g = reg.map((r) => Math.abs(SECFACE.rowVals(face.cf, r)[ci] || 0));
        const so = o.reduce((t, v) => t + v, 0), sg = g.reduce((t, v) => t + v, 0);
        const ti = own.findIndex((r, i) => /\btotal\b/i.test(r.label || '') || (own.length + reg.length > 1 && Math.abs(o[i] - (so - o[i] + sg)) <= MERGE_TOL * o[i]));
        const v = ti >= 0 ? o[ti] : so + sg;
        if (v > 0) vals.push({ end: c.end, v });
      });
      const all = vals.length && c0 && vals[0].end === c0.end ? vals[0].v : null;
      const same = (x) => ours != null && x > 0 && Math.abs(ours - x) <= MERGE_TOL * x;
      if (!same(tot) && !same(all) && (onF ? all != null : !rows.some((r) => mine.includes(r.tag)))) {
        merged.capex = { dur: new Map(), inst: new Map() }; delete tags.capex;
        if (vals.length) capFace = vals;
      }
    }
  }
  // רווח למניה מפעילות נמשכת (16/11/2026, בדיקת העומק): אצל חלק מהחברות שורת ה־"Diluted" בדוח מתויגת
  // IncomeLossFromContinuingOperationsPerDilutedShare גם כשאין שום פעילות שהופסקה (Airbnb, Monster, VeriSign, Halliburton,
  // Freeport, Kimco, Regency, Exelon). עד היום התקופות האלה יצאו ריקות (Monster: מ־2011; VeriSign, Halliburton, Freeport,
  // Exelon: מ־2022), או הושלמו מ־Yahoo בלי בדיקה (Airbnb 2025: ‏1.03 במקום 4.03 שהודפס). משלימים רק תקופה שאין לה רווח
  // למניה: השורה מפעילות נמשכת + השורה מפעילות שהופסקה מאותו דוח (Exelon 2022: ‏2.08 + 0.12 — אין שורת סך), ורק כשהסכום
  // = הרווח לבעלי המניות / המניות המדוללות של אותה תקופה (עד 3%, ועיגול לסנט)
  if (merged.eps) {
    const CO = isIfrs ? ['DilutedEarningsLossPerShareFromContinuingOperations', 'BasicEarningsLossPerShareFromContinuingOperations']
      : ['IncomeLossFromContinuingOperationsPerDilutedShare', 'IncomeLossFromContinuingOperationsPerBasicAndDilutedShare', 'IncomeLossFromContinuingOperationsPerBasicShare'];
    const DISC = isIfrs ? ['DilutedEarningsLossPerShareFromDiscontinuedOperations', 'BasicEarningsLossPerShareFromDiscontinuedOperations']
      : ['IncomeLossFromDiscontinuedOperationsNetOfTaxPerDilutedShare', 'IncomeLossFromDiscontinuedOperationsNetOfTaxPerBasicAndDilutedShare', 'IncomeLossFromDiscontinuedOperationsNetOfTaxPerBasicShare'];
    const inFiling = (h, filed) => (!h ? null : h.filed === filed ? h.v : h.all && h.all.has(filed) ? h.all.get(filed) : null);
    let used = null;
    CO.forEach((t, i) => {
      const cf = tagFacts(tax[t], unitOf('eps')), df = tagFacts(tax[DISC[i]], unitOf('eps'));
      for (const [kk, h] of cf.dur) {
        if (merged.eps.dur.has(kk)) continue;
        const num = (merged.nic && merged.nic.dur.get(kk)) || (merged.ni && merged.ni.dur.get(kk)), sh = merged.sh && merged.sh.dur.get(kk);
        if (!num || !sh || !(sh.v > 0)) continue;
        // השורה מפעילות שהופסקה קיימת לתקופה רק בדוח אחר — לא יודעים מה הסכום בדוח הזה, לא משלימים
        const dh = df.dur.get(kk), d = inFiling(dh, h.filed);
        if (dh && d == null) continue;
        const v = Math.round((h.v + (d || 0)) * 1e4) / 1e4;
        // המניות מאותו דוח כשאפשר (פיצול בין שני הדוחות — אחד מותאם והשני לא)
        const s = inFiling(sh, h.filed) || sh.v;
        if (Math.abs(v * s - num.v) > 0.03 * Math.abs(num.v) + 0.006 * s) continue;
        merged.eps.dur.set(kk, { ...h, v, all: new Map([[h.filed, v]]) });
        used = used || t;
      }
    });
    if (used && merged.eps.spine == null) tags.eps = used;
  }
  // חוב כפי שמודפס במאזן (F7, ‏debtFace למעלה): הסכום של שורות החוב, כל אחת מההיסטוריה של התגית שלה — ובתאריכים שאין בה ערך,
  // מחלופה מאותו סוג (Coca-Cola: עד 2023 ‏LongTermDebtNoncurrent, מאז ‏…AndCapitalLeaseObligations; McDonald's: החלויות עד 2020
  // ב־LongTermDebtCurrent, מאז ב־DebtCurrent; Hershey: ברבעונים שאחרי הדוח השנתי). כל שורה חייבת להתאים למה שהודפס בכל עמודה של
  // המאזן — מהתגית שלה או מחלופה שתואמת (Xcel: ‏LongTermDebt כולל בביאורים הישנים את החלויות; ‏…AndCapitalLeaseObligations תואמת
  // ועקבית) — אחרת השיטה הקודמת. ובנוסף, שורות שהיו פעם במאזן ואינן בו היום (DEBT_IMPL), רק בתאריכים שאין בהם שורה קיימת מאותו
  // סוג, ורק מתגית שאין לה ערך בעמודות של היום (ערך בלי שורה = פירוט בביאור). שורה בתגית פרטית או אותה תגית פעמיים — השיטה
  // הקודמת; תאריך שחסר בו רכיב (חור בשורה, או חוב לזמן ארוך מלפני שהשורה התחילה) — גם הוא בשיטה הקודמת, לא סכום חלקי
  let debtLine = null;
  const dF = !isIfrs ? debtFace(face, rc || cur || 'USD') : null;
  const bsfM = !isIfrs && bsf ? bsfDebt(bsf, rc || cur || 'USD') : null; // המאזן של כל הגשה — גובר על הכלל של F7 (למטה)
  if (dF && dF.lines.length && dF.tot.size && dF.lines.every((l, i) => l.ns === 'us-gaap' && dF.lines.findIndex((x) => x.tag === l.tag) === i)) {
    const near = (a, b) => Math.abs(a - b) <= Math.max(1.5e6, 0.005 * Math.abs(b));
    // אותו סכום בדיוק = אותו חוב (Trimble: החלויות מתויגות גם ShortTermBorrowings; ‏CME: החלויות של האג"ח — UnsecuredDebtCurrent —
    // הן שורת "Short-term debt"; ‏UPS)
    const same = (a, b) => Math.abs(a - b) <= Math.max(5e5, 5e-4 * Math.abs(b));
    const faceTags = new Set(dF.lines.map((l) => l.tag)), lcat = dF.lines.map(debtCat), cats = new Set(lcat);
    const classified = dF.cls || cats.has('c') || cats.has('dc'), inst = (t) => tagFacts(tax[t], unitOf('debt')).inst;
    const fd = new Set(dF.cols.map(([e]) => e)), catUsed = new Set(), usedT = new Set(), ltdNcT = inst('LongTermDebtNoncurrent');
    let ser = [];
    const pre = [];
    for (const [i, l] of dF.lines.entries()) {
      // "חוב לזמן ארוך כולל חלויות" במאזן מסווג (יש גם שורת חלויות) — בפועל הלא שוטף (Xcel); במאזן לא מסווג — ltd (Hartford)
      const cat = lcat[i] === 'tot' && DEBT_TOT_LTD.has(l.tag) ? (classified ? 'nc' : 'ltd') : lcat[i];
      const ak = cat === 'ltd' || (cat === 'tot' && DEBT_TOT_MAIN.has(l.tag)) ? 'tot' : cat === 'tot' ? null : cat;
      const alts = [...(ak && !catUsed.has(ak) ? DEBT_ALT[ak] || [] : []), ...(DEBT_FAM[l.tag] || [])]
        .filter((t, j, a) => t !== l.tag && !faceTags.has(t) && a.indexOf(t) === j);
      if (ak) catUsed.add(ak);
      const cs = [l.tag, ...alts].map((t) => ({ t, m: inst(t) }));
      const good = cs.filter((c) => dF.cols.every(([e, ci]) => l.v[ci] == null || (c.m.has(e) ? near(c.m.get(e).v, l.v[ci]) : !l.v[ci])));
      if (!good.length) { ser = null; break; }
      if (cat === 'nc' && lcat[i] === 'tot') good.reverse();
      // תגית "רכה" (Con Edison: ‏LongTermDebtFairValue) — בשנים קודמות אותה תגית היא השווי ההוגן שבביאור: מחוץ לעמודות של
      // המאזן — החלופות קודם
      const soft = !l.cat && DEBT_SOFT.test(l.tag), own = cs[0];
      const order = soft ? [...cs.slice(1), own] : [...good, ...cs.filter((x) => !good.includes(x))];
      pre.push({ l, cat, soft, own, order });
    }
    if (ser) for (const p of pre) {
      const { l, cat, soft, own, order } = p;
      // הלוואות קצרות: חלופה לא ממלאת תאריך שבו שורה קצרה אחרת מדווחת בתגית שלה (Con Edison: ניירות הערך המסחריים הם הפירוט של
      // "Notes payable", לא ההיסטוריה של "Term loan")
      const busy = (e) => cat === 'st' && pre.some((q) => q !== p && q.cat === 'st' && q.own.m.has(e));
      const m = new Map(), src = new Map(), tg = new Map();
      if (soft) for (const [e, h] of own.m) if (fd.has(e)) { m.set(e, h); src.set(e, cat); tg.set(e, own.t); }
      for (const c of order) {
        usedT.add(c.t);
        for (const [e, h] of c.m) {
          if (m.has(e) || (c.t !== l.tag && busy(e))) continue;
          // ערך מ־LongTermDebt בשורה לא שוטפת: כולל חלויות (KLA ‏2015–2019: ‏3,190 = ‏3,173 + ‏17), חוץ מתאריך שבו הוא שווה ל־LongTermDebtNoncurrent
          // (KLA ‏2024: ‏5,880, והחלויות ‏750 בשורה נפרדת)
          const c0 = c.t === l.tag ? cat : DEBT_OF.get(c.t) || cat;
          const c1 = cat === 'nc' && DEBT_TOT_LTD.has(c.t) && !(ltdNcT.has(e) && same(ltdNcT.get(e).v, h.v)) ? 'ltd' : c0;
          m.set(e, h); src.set(e, c1 === 'tot' && cat === 'nc' ? 'nc' : c1); tg.set(e, c.t);
        }
      }
      ser.push({ l, cat, m, src, tg, ks: [...m.keys()] });
    }
    // תגית בלי שורה שיש לה ערך בעמודות של היום: בדרך כלל פירוט בביאור של שורה קיימת — לא נכנסת. חוץ מ: חוב לזמן ארוך כשאין
    // במאזן שורה שיכולה להכיל אותו (שורה שלא נקראה — כל התאריכים); ערך זניח היום (Nike: ‏5 מיליון בתוך ההתחייבויות לשלם — רק
    // השנים שלפני המאזן); וחלויות (McDonald's: היום בתוך "Long-term debt") — רק בתאריך שבו סך החוב לזמן ארוך (LongTermDebt,
    // כולל חלויות) שווה ללא שוטף + החלויות, כלומר הן לא היו בתוך השורה
    const f0 = dF.cols.map(([e]) => e).sort()[0], ltd = inst('LongTermDebt');
    // רכיב שיש לו ערך מהותי בעמודות של היום — בתוך שורה של המאזן שאינה החוב הלא שוטף; נכנס רק בתאריך שבו לשורות האלה אין ערך
    // (Otis ‏2019 ו־Cooper ‏2014: "Short-term debt" שבמאזן — בלי ערך, וההלוואות הקצרות בתגית שלהן)
    const nonNc = ser ? ser.filter((s) => s.cat !== 'nc') : [];
    // ‏LongTermDebt שווה לסכום שורות החוב בכל עמודות המאזן של היום — הוא סך החוב של החברה באותה הגדרה; בתאריך שבו הסכום קטן ממנו,
    // ויש ראיה שחסרה שורה: (א) מאזן לא מסווג שכל שורותיו "סך" של מכשיר — תגיות של מכשירי חוב שאינם במאזן של היום, שמשלימות בדיוק את
    // הפער באותו תאריך (Invitation Homes ‏2020–2023: אג"ח להמרה 339 והלוואה בנקאית 401 — שורות שנעלמו; Welltower ‏2022: ‏SeniorNotes ‏545 —
    // חלק מ־"Senior unsecured notes", לא משלים — לא);
    // (ב) חלויות + לא שוטף — ראיה: לשורה של המאזן אין ערך באותו תאריך (Veralto ‏10/2026: אחרי הדוח השנתי החלויות ב־DebtCurrent)
    const lFace = ser && !faceTags.has('LongTermDebt') && dF.cols.every(([e]) => ltd.has(e) && near(ltd.get(e).v, dF.tot.get(e)));
    const totL = lFace && !classified && [...cats].every((k) => k === 'tot');
    const clsL = lFace && !totL && [...cats].every((k) => k === 'c' || k === 'nc');
    const gone = totL ? DEBT_CAT.tot.filter((t) => !DEBT_TOT_MAIN.has(t) && !faceTags.has(t) && !usedT.has(t) && ![...faceTags].some((f) => (DEBT_FAM[f] || []).includes(t))).map(inst) : [];
    // סך החוב של החברה (קצר + ארוך) בתגית משלו — כשהסכום כבר שווה לו באותו תאריך, אין רכיב חסר (AIG ‏2022: ‏27,179 כולל ההלוואות
    // הקצרות). ‏DebtAndCapitalLeaseObligations — רק כששורת חוב שוטף במאזן מצהירה שהיא כוללת הלוואות קצרות (Cardinal: "...and other
    // short-term borrowings"): חברות רבות מדווחות בו חוב לזמן ארוך כולל חלויות בלבד (McKesson ‏2020–2024, ‏Lowe's ‏2014, ‏Western Digital
    // ‏2015 — ההלוואות הקצרות מחוץ לו)
    const stIn = dF.lines.some((l, i) => ['c', 'dc', 'st'].includes(lcat[i]) && DEBT_STLAB.test(l.label || '') && /long.?term|current/i.test(l.label || ''));
    const totT = ['DebtLongtermAndShorttermCombinedAmount', ...(stIn ? ['DebtAndCapitalLeaseObligations'] : [])].filter((t) => !faceTags.has(t)).map(inst);
    const unknown = dF.lines.some((l, i) => !lcat[i]);
    const pairs = dF.lines.map((l) => DEBT_PAIR[l.tag] || (/Noncurrent$/.test(l.tag) ? l.tag.replace(/Noncurrent$/, 'Current') : null)).filter((t) => t && !faceTags.has(t));
    // לכל סוג: התגיות לפי הסדר — בכל תאריך הראשונה שעוברת את כל הבדיקות (Otis ‏2020: ‏ShortTermBorrowings נחסמת, CommercialPaper נבדקת)
    const impl = !ser || unknown ? [] : DEBT_IMPL.map(([k, ts0]) => {
      const list = [];
      for (const t of k === 'c' ? [...new Set([...ts0, ...pairs, ...DEBT_IMPL_C2])] : ts0) {
        if (usedT.has(t)) continue;
        const x = inst(t), atF = dF.cols.map(([e]) => (x.has(e) ? x.get(e).v : 0));
        const big = dF.cols.some(([e], i) => Math.abs(atF[i]) > Math.max(1.5e6, 0.005 * Math.abs(dF.tot.get(e) || 0)));
        const mode = !atF.some(Boolean) || (k === 'nc' && !['nc', 'tot', 'ltd'].some((x) => cats.has(x))) ? 'all' : !big ? 'past' : k === 'c' ? 'check'
          : nonNc.length ? 'gap' : null;
        if (mode && x.size) list.push({ x, mode });
      }
      return { k, list };
    }).filter((g) => g.list.length);
    if (ser) {
      const ends = new Set(); for (const s of ser) for (const e of s.ks) ends.add(e);
      debtLine = new Map(); const faceSum = new Map();
      for (const e of [...ends].sort()) {
        let v = 0, ok = true, nc = 0, lt = 0; const have = new Set(), vals = [];
        for (const s of ser) {
          const h = s.m.get(e);
          if (h) {
            const c = s.src.get(e);
            v += h.v; vals.push(h.v); have.add(c);
            if (c === 'nc') nc += h.v;
            if (c === 'nc' || c === 'c') lt += h.v;
            continue;
          }
          const before = s.ks.some((x) => x < e), after = s.ks.some((x) => x > e);
          // חור בין שני ערכים — חסר; לפני שהשורה הופיעה: הלוואות קצרות / חלויות — 0, חוב לזמן ארוך — חסר; אחרי שנעלמה — 0
          if ((before && after) || (!before && !['st', 'c', 'dc'].includes(s.cat))) { ok = false; break; }
        }
        if (!ok) continue;
        faceSum.set(e, v);
        // מכשיר במאזן של היום, ובעבר סך החוב הלא שוטף בתגית הכללית (Tyler: עד 2023 ‏LongTermDebtNoncurrent = אג"ח להמרה + הלוואות; היום
        // רק אג"ח להמרה) — מחליפים רק כשסך החוב לזמן ארוך באותו תאריך (LongTermDebt, כולל חלויות) מאשר
        const L = ltd.get(e);
        if (L && e < f0 && !faceTags.has('LongTermDebt') && !near(lt, L.v)) {
          for (const s of ser) {
            const h = s.m.get(e);
            if (!h || s.cat !== 'nc' || s.src.get(e) !== 'nc' || DEBT_ALT.nc.includes(s.tg.get(e))) continue;
            const G = DEBT_ALT.nc.filter((g) => !faceTags.has(g)).map((g) => inst(g).get(e)).find((x) => x && x.v > h.v && near(lt - h.v + x.v, L.v));
            if (G) { v += G.v - h.v; nc += G.v - h.v; lt += G.v - h.v; }
          }
        }
        // הלוואות קצרות בתוך LongTermDebt באותו תאריך: ‏LongTermDebt = ‏LongTermDebtNoncurrent + ההלוואות (KLA ‏2020: ‏3,461 = ‏3,441 + ‏20)
        const lv = ser.map((s) => (s.tg.get(e) === 'LongTermDebt' ? s.m.get(e).v : null)).find((x) => x != null), ncv = ltdNcT.get(e);
        const T = totT.map((x) => x.get(e)).find(Boolean);
        for (const g of impl) {
          if (T && near(v, T.v)) break;
          if (DEBT_COVER[g.k].some((k) => have.has(k))) continue;
          for (const { x, mode } of g.list) {
            const h = x.get(e);
            if (!h || !h.v || (mode !== 'all' && e >= f0)) continue;
            if (vals.some((y) => same(h.v, y))) break; // אותו סכום כבר נספר — החוב הזה כבר בפנים
            if (g.k === 'st' && lv != null && ncv && near(ncv.v + h.v, lv)) break;
            // הרכיב בתוך שורה של המאזן של היום (gap): רק כשהשורה הזו לא מדווחת בתגית שלה באותו תאריך
            if (mode === 'gap' && nonNc.some((s) => s.tg.get(e) === s.l.tag)) continue;
            if (mode === 'check' && (!L || !near(nc + h.v, L.v) || Math.abs(nc + h.v - L.v) >= Math.abs(nc - L.v))) continue;
            v += h.v; vals.push(h.v); have.add(g.k); if (g.k === 'nc') nc += h.v; if (g.k === 'nc' || g.k === 'c') lt += h.v;
            break;
          }
        }
        if (totL && L && v < L.v && !near(v, L.v)) {
          const gs = []; for (const x of gone) { const h = x.get(e); if (h && h.v > 0 && !gs.some((y) => same(y, h.v))) gs.push(h.v); }
          const add = gs.reduce((a, b) => a + b, 0);
          if (add && near(v + add, L.v)) v += add;
        } else if (clsL && L && lt < L.v && !near(lt, L.v) && ser.some((s) => !s.m.has(e))) v += L.v - lt;
        debtLine.set(e, v);
      }
      if ([...dF.tot].every(([e, t]) => faceSum.has(e) && near(faceSum.get(e), t))) tags.debt = ser.map((s) => s.l.tag).join('+');
      else debtLine = null;
    }
  }
  // פיצולים לפי תאריך ההגשה (26/10/2026): ערך למניה / ממוצע מניות שהוגש לפני הפיצול — מותאם; שהוגש אחריו — החברה
  // כבר הציגה אותו מחדש (ASC 260: כל התקופות בדוח שהוגש אחרי הפיצול), גם כשהתקופה שלו לפני הפיצול. עד היום ההתאמה
  // הייתה לפי תאריך התקופה, וערך שהוצג מחדש (רבעון של שנה קודמת כהשוואה ב־10-Q שאחרי הפיצול — ServiceNow, Carvana,
  // Texas Pacific Land, DuPont בפיצול הפוך) הותאם פעם שנייה; ורבעון אחרון שכבר הוצג מחדש (Booking: ‏10-Q של מרץ
  // הוגש אחרי הפיצול של אפריל) "הוכיח" שאין קפיצה, וכל הרבעונים הישנים נשארו בלי התאמה. לפני כל חישוב — כך שהרבעון
  // הרביעי (4 × שנה פחות שלושה) והרווח למניה הנגזר מחושבים מאותו בסיס
  // גל 8 (F34): אין תגית מניות מדוללת בכלל (Gallagher) — הממוצע הבסיסי ועוד התוספת המדוללת מאותה הגשה (בסיסי + תוספת = מדולל,
  // ASC 260). AJG ‏2020: ‏191.0M בסיסי + ‏4.0M = ‏195.0M, כמו "Diluted" בדוח. רק כשהמכפלה עם הרווח למניה המדולל לא רחוקה יותר
  // מהרווח מאשר עם הבסיסי (בהפסד התוספת אנטי־מדללת ולא נכנסת). התגית הכוללת של ההתאמה קודמת לחלקים
  if (!isIfrs && merged.sh && tags.sh === 'WeightedAverageNumberOfSharesOutstandingBasic' && !SH_DIL.some((t) => tax[t])) {
    const it = SH_INC.find((t) => tax[t]), inc = it && tagFacts(tax[it], 'shares'), bas = tagFacts(tax.WeightedAverageNumberOfSharesOutstandingBasic, 'shares');
    const at = (h, F) => (h ? (h.all && h.all.has(F) ? h.all.get(F) : h.filed === F ? h.v : null) : null);
    let n = 0;
    if (inc) merged.sh = { ...merged.sh, dur: new Map([...merged.sh.dur].map(([kk, h]) => {
      const b = bas.dur.get(kk), x = at(inc.dur.get(kk), h.filed);
      if (!b || b.v !== h.v || !(x > 0)) return [kk, h];
      const e = merged.eps && merged.eps.dur.get(kk), ni = ((merged.nic && merged.nic.dur.get(kk)) || (merged.ni && merged.ni.dur.get(kk)) || {}).v;
      if (e && Number.isFinite(ni) && Math.abs(e.v * (h.v + x) - ni) > Math.abs(e.v * h.v - ni)) return [kk, h];
      n++;
      return [kk, { ...h, v: h.v + x, all: h.all ? new Map([...h.all].map(([F, v]) => { const y = at(inc.dur.get(kk), F); return [F, y > 0 ? v + y : v]; })) : h.all }];
    })) };
    if (n) tags.sh += '+' + it;
  }
  const splitsUsed = splitPlan(merged, splits);
  for (const k of ['sh', ...PER_SHARE]) if (merged[k]) merged[k] = splitAdj(merged[k], splitsUsed, k === 'sh');
  // ממוצע המניות הבסיסי — לרבעון הרביעי כשיש הפסד (q4Shares)
  const shB = { A: {}, Q: {} };
  { const fb = splitAdj(tagFacts(tax[isIfrs ? 'WeightedAverageShares' : 'WeightedAverageNumberOfSharesOutstandingBasic'], 'shares'), splitsUsed, true);
    for (const [kk, h] of fb.dur) { const [s0, e0] = kk.split('|'), L = day(e0) - day(s0); if (L >= 350 && L <= 380) shB.A[e0] = h.v; else if (qLen(L)) shB.Q[e0] = h.v; } }
  // שנים שתויגו "בסיסי ומדולל" במניות — בלי דילול (noDil, גל 6 — F30)
  // ורווח בסיסי שנתי (לבדוק שהוא = המדולל עד הסנט)
  const shBD = {}, epsBA = {};
  if (!isIfrs) {
    for (const [kk, h] of splitAdj(tagFacts(tax.WeightedAverageNumberOfShareOutstandingBasicAndDiluted, 'shares'), splitsUsed, true).dur) { const [s0, e0] = kk.split('|'), L = day(e0) - day(s0); if (L >= 350 && L <= 380) shBD[e0] = h.v; }
    for (const [kk, h] of splitAdj(tagFacts(tax.EarningsPerShareBasic, unitOf('eps')), splitsUsed, false).dur) { const [s0, e0] = kk.split('|'), L = day(e0) - day(s0); if (L >= 350 && L <= 380) epsBA[e0] = h.v; }
  }
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
      if (qLen(d)) {
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
        if (qLen(gap) && Q[k][e2] == null) {
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
        const dur = merged[k].dur, ka = s0 + '|' + e, hs = qs.map((q) => { for (const [kk, h] of dur) { const [a, b] = kk.split('|'), L = day(b) - day(a); if (b === q && qLen(L)) return [h, kk]; } return null; });
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
    const q4dir = (k, e) => [...merged[k].dur].find(([kk, h]) => { const [s0, e0] = kk.split('|'); return e0 === e && qLen(day(e) - day(s0)) && h.ann !== false; });
    for (const e of fyEnds) {
      const y0 = yearOf.get(e);
      if (!KS.some((k) => { const a = A[k][e], x = q4dir(k, e); return a && x && Math.abs(x[1].v - a) <= 1e-3 * Math.abs(a); })) continue;
      for (const k of KS) {
        const x = q4dir(k, e); if (A[k][e] != null || !x || Q[k][e] !== x[1].v) continue;
        let c9 = null;
        for (const [kk, h] of merged[k].dur) { const [s2, e2] = kk.split('|'), g = day(e) - day(e2); if (s2 === y0 && qLen(g)) c9 = h.v; }
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
        // רק כשהיחס של השנה לא מסביר את שלושת הרבעונים שהודפסו (TransDigm). כשהוא מסביר את כולם (כל אחד עד סנט) — הרווח × היחס
        // מדויק יותר: החיסור צובר את העיגול לסנט של ארבעה ערכים, עד ‎±0.02 (בדיקת העומק 16/11/2026: Apple רבעון 4 2021 ‎1.22
        // במקום ‎1.24 שפורסם; Airbnb רבעון 4 2024 ‎0.72 במקום ‎0.73)
        const fit = qs3.every((q) => Math.abs(Math.round(niOf(Q, q) * yr / Q.sh[q] * 100) / 100 - Q.eps[q]) <= 0.0101);
        if (!fit && Math.abs(e4) >= 20 * err && n3 != null && Math.abs(s3 - n3) <= 0.005 * Math.max(Math.abs(n3), Math.abs(s3))) niq = e4;
      }
    }
    if (Q.eps[e] == null && niq != null && Q.sh[e]) { Q.eps[e] = Math.round(niq / Q.sh[e] * 100) / 100; (derived.eps = derived.eps || []).push(e); epsNum[e] = niq; }
  }
  // מניות חסרות (דיווח לפי סוגי מניות): רווח נקי ÷ רווח למניה. ברבעון זו הערכה (shEst) — הרווח הנקי אינו המונה של הרווח למניה
  // (פעילות שהופסקה, ניירות משתתפים, דיבידנד לזכויות מיעוט) והרווח למניה מעוגל לסנט: LyondellBasell מתייגת את ממוצע המניות רק
  // עם ממד (נמשכת / הופסקה — אין ב־companyfacts), ורבעון 2 2025: ‏115 ÷ ‏0.34 = ‏338M מול ‏322M בביאור. qShares: מה שפורסם (Yahoo) גובר
  for (const [D, ends] of [[A, fyEnds], [Q, qEnds]]) for (const e of ends) {
    if (!D.sh[e] && D.eps[e] && D.ni[e]) { D.sh[e] = Math.abs(D.ni[e] / D.eps[e]); if (D === Q && !shEst.includes(e)) shEst.push(e); }
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
  // בסיס אחד לתקופה — הכנסות, עלות מכר ורווח גולמי מאותה הגשה (26/10/2026). כל שורה נבחרת לבד ("האחרון שהוגש"), וכשחברה
  // מציגה מחדש תקופות (פעילות שנפרדה) ולא מתייגת שוב את כל השלוש — מתערבבים בסיסים: Honeywell רבעון 3 2025 — הכנסות ועלות
  // מה־10-Q של 2026 (‏$4.93B/‏$3.16B), רווח גולמי מה־10-K (‏$3.23B, הבסיס הקודם); J&J 2022 — הכנסות ורווח גולמי מה־10-K של 2024,
  // עלות המכר מה־10-Q של 2023 (‏8%). ב־500 החברות: כ־95 תקופות. העוגן = ההגשה שממנה ההכנסות (הן לא משתנות לעולם): עלות המכר
  // והרווח הגולמי מאותה הגשה (‏h.all — הערך לפי תאריך הגשה), ומה שלא תויג בה = ההפרש. בלי אף אחד מהשניים בה — לא נוגעים.
  // כשכל השלוש מאותה הגשה ולא שוות (Altria — מס בלו, ‏LITE) — הגדרה של החברה, לא נוגעים
  const durOf = (k, e, ann) => { const d = merged[k] && merged[k].dur; if (!d) return null;
    if (ann) return d.get(yearOf.get(e) + '|' + e) || null;
    for (const [kk, h] of d) { const [s, e2] = kk.split('|'); if (e2 === e && qLen(day(e) - day(s))) return h; } return null; };
  const inB = (h, B) => (!h ? null : h.filed === B ? h.v : h.all && h.all.has(B) ? h.all.get(B) : null);
  if (tags.gp && tags.cogs && Object.keys(A.gp).length && Object.keys(A.cogs).length) for (const [D, ends, ann] of [[A, fyEnds, true], [Q, qEnds, false]]) for (const e of ends) {
    const rv = D.rev[e], hr = durOf('rev', e, ann); if (rv == null || D.gp[e] == null || D.cogs[e] == null || !hr || hr.v !== rv) continue;
    if (Math.abs(rv - Math.abs(D.cogs[e]) - D.gp[e]) <= 0.001 * Math.abs(rv)) continue;
    const hg = durOf('gp', e, ann), hc = durOf('cogs', e, ann); if (!hg || !hc || hg.v !== D.gp[e] || Math.abs(hc.v) !== Math.abs(D.cogs[e])) continue;
    const B = hr.filed, g = inB(hg, B), c = inB(hc, B);
    if (g == null && c == null) continue;
    const ng = g != null ? g : rv - Math.abs(c), nc = c != null ? Math.abs(c) : rv - g;
    if (ng === D.gp[e] && nc === Math.abs(D.cogs[e])) continue;
    if (ng !== D.gp[e]) fixes.push({ m: 'gp', p: e });
    if (nc !== Math.abs(D.cogs[e])) fixes.push({ m: 'cogs', p: e });
    D.gp[e] = ng; D.cogs[e] = nc;
  }
  let bsfN = 0;
  const bsfAt = (M, e) => { if (M.has(e)) return M.get(e); for (const [k, v] of M) if (Math.abs(day(k) - day(e)) <= 3) return v; return null; };
  // שורות מחושבות
  const gpd = []; // שנים שבהן הרווח הגולמי מחושב (לא דווח) — derived.gp הוא של רבעונים
  for (const [D, ends] of [[A, fyEnds], [Q, qEnds]]) for (const e of ends) {
    if (D.gp && D.gp[e] == null && D.rev[e] != null && D.cogs && D.cogs[e] != null) { D.gp[e] = D.rev[e] - D.cogs[e]; if (D === A) gpd.push(e); }
    // סך התחייבויות שלא דווח = סך התחייבויות והון פחות כל ההון (כולל זכויות מיעוט והון ביניים)
    if (D.tl && D.tl[e] == null && D.tle && D.tle[e] != null && D.eq[e] != null) D.tl[e] = D.tle[e] - (D.eqt && D.eqt[e] != null ? D.eqt[e] : D.eq[e]) - ((D.tmp && D.tmp[e]) || 0);
    if (D.debt && D.debt[e] == null) { const s = (D.debtNc[e] || 0) + (D.debtC[e] || 0); if (s) D.debt[e] = s; }
    if (D.debt && D.stb && D.stb[e]) D.debt[e] = (D.debt[e] || 0) + D.stb[e];
    if (debtLine && debtLine.has(e)) { if (!D.debt) D.debt = {}; D.debt[e] = debtLine.get(e); }
    // המאזן המודפס של ההגשה (bsfDebt) — אותו יום או עד 3 ימים (שנה של 52/53 שבועות: סוף העמודה מול סוף התקופה)
    if (bsfM && bsfM.size) { const p = bsfAt(bsfM, e); if (p && p.v != null) { if (!D.debt) D.debt = {}; D.debt[e] = p.v; bsfN++; } }
  }
  // פחת והשקעות הוניות של השנה — מדף התזרים המודפס (bsfCf, גל 3 F13). רק השנתי; הרבעונים נשארים מהסדרה (הרבעון הרביעי — מחושב)
  const cfy = [];
  if (!isIfrs && bsf) {
    const CF = bsfCf(bsf, rc || cur || 'USD', FLOW);
    for (const k of ['dep', 'capex']) {
      const M = CF[k]; if (!M) continue;
      // שער עקביות: הסדרה שלנו כבר עוקבת היום אחרי השורה הזו — בכל השנים שהדוח האחרון מדפיס, הערך שלנו = השורה (AEP: בתגית של
      // השקעה הונית מודפסת "Acquisitions of Assets", וההשקעה עצמה — ‏$8.5B — בתגית פרטית; בלי השער כל השנים היו מוחלפות ברכישות)
      const lastE = fyEnds.filter((e) => { const p = bsfAt(M, e); return p && p.filed === CF.last; });
      if (!lastE.length || !lastE.every((e) => A[k] && A[k][e] != null && Math.abs(A[k][e] - bsfAt(M, e).v) <= Math.max(5e5, 5e-3 * Math.abs(A[k][e])))) continue;
      for (const e of fyEnds) {
        const p = bsfAt(M, e); if (!p) continue;
        if (!A[k]) A[k] = {};
        const old = A[k][e], near = (a, b) => Math.abs(a - b) <= Math.max(5e5, 5e-3 * Math.abs(b));
        if (old != null && near(old, p.v)) continue;
        // הערך שלנו הודפס בתזרים של 10-K אחר — הצגה מחדש (ד), לא מחליפים (YUM ‏2014: ‏1,033 לפני הפיצול של Yum China, כמו ההכנסות
        // של אותה שנה ב־companyfacts; ‏508 — אחרי)
        if (old != null) { let pr = M.printed.get(e); if (!pr) for (const [k2, v2] of M.printed) if (Math.abs(day(k2) - day(e)) <= 3) { pr = v2; break; } if (pr && pr.some((v) => near(old, v))) continue; }
        A[k][e] = p.v; cfy.push({ k: old == null ? 'ffill' : 'ffix', m: k, p: e, f: p.v, v: old == null ? null : old });
      }
    }
  }
  // רווח והפסד לפי הגשה (bsfIs, גל 5 — F20). רק השנתי, כמו F13; ערך שלנו שמודפס בשורה כלשהי של רווח והפסד באותה שנה — לא מוחלף
  // (הצגה מחדש: פעילות שנמכרה — Agilent אחרי Keysight, ‏Exelon אחרי Constellation)
  if (!isIfrs && bsf) {
    const ours = {}, chg = {};
    for (const k of IS_KEYS) if (A[k]) ours[k] = new Map(fyEnds.filter((e) => A[k][e] != null).map((e) => [e, A[k][e]]));
    const IS = bsfIs(bsf, rc || cur || 'USD', ours);
    const near = (a, b) => Math.abs(a - b) <= Math.max(5e5, 5e-3 * Math.abs(b));
    for (const k of IS_KEYS) {
      const M = IS[k]; if (!M) continue;
      for (const e of fyEnds) {
        const p = bsfAt(M, e); if (!p) continue;
        const old = A[k] && A[k][e];
        if (old != null && near(IS_ABS.has(k) ? Math.abs(old) : old, p.v)) continue;
        if (old != null && !IS.own.some((x) => Math.abs(day(x) - day(e)) <= 7)) continue;
        if (old != null) { let pr = IS.printed.get(e); if (!pr) for (const [k2, v2] of IS.printed) if (Math.abs(day(k2) - day(e)) <= 7) { pr = v2; break; } if (pr && pr.some((v) => near(Math.abs(old), v))) continue; }
        if (!A[k]) A[k] = {};
        A[k][e] = p.v; cfy.push({ k: old == null ? 'ffill' : 'ffix', m: k, p: e, f: p.v, v: old == null ? null : old });
        (chg[k] = chg[k] || new Set()).add(e);
      }
    }
    // F20 ברבעונים (גל 6): אותו שרשור על דפי 10-Q, ואותן שמירות — ערך שמודפס בשורה כלשהי באותו רבעון לא מוחלף, ערך קיים מתוקן רק
    // כשה־10-Q של אותו רבעון בחלון. הסדרה שלנו לעוגן — בלי הרבעון הרביעי הנגזר (אינו מודפס ב־10-Q)
    const oq = {};
    for (const k of IS_KEYS) if (Q[k]) oq[k] = new Map(qEnds.filter((e) => Q[k][e] != null && !(derived[k] || []).includes(e)).map((e) => [e, Q[k][e]]));
    const ISQ = bsfIs(bsf, rc || cur || 'USD', oq, true);
    const prAt = (P, e) => { let pr = P.get(e); if (!pr) for (const [k2, v2] of P) if (Math.abs(day(k2) - day(e)) <= 7) { pr = v2; break; } return pr; };
    const fyOf = (e) => fyEnds.find((f) => { const s0 = yearOf.get(f); return s0 && e > s0 && e <= f; });
    // ההגשה האחרונה (companyfacts, כל התגיות של המדד) שדיווחה תקופה של פחות משנה שמסתיימת ברבעון הזה — רבעון או מצטבר
    // עלות מכר שתוקנה ב"בסיס אחד לתקופה" (fixes) היא ההכנסות פחות הרווח הגולמי של ההגשה של ההכנסות — גם התאריכים שלהן נחשבים
    // (Danaher ‏2018: ‏1,754.7 מה־10-K שהציג מחדש את הרבעונים אחרי Envista; ה־10-Q של 2019 מדפיס ‏2,051.8 על הבסיס הקודם)
    // עובדה של רבעון בודד נספרת רק כשהיא בערך שלנו (CoStar ‏2016-Q1: הערך שלנו ‏47.8M בתגית אחת מה־10-Q המקורי; ‏27.9M בתגית אחרת,
    // המודפס, תויג שוב ב־10-K של 2018 — זה לא "הערך שלנו הוגש מאוחר יותר"). מצטבר, ובסיס העלות (הכנסות ורווח גולמי) — כל ערך
    const lateOf = (k, e, old) => {
      let F = '';
      const fx = k === 'cogs' && fixes.some((x) => x.m === 'cogs' && x.p === e), ks = fx ? ['cogs', 'rev', 'gp'] : [k];
      const ours = (h) => fx || old == null || [h.v, ...(h.all ? h.all.values() : [])].some((v) => v != null && near(Math.abs(v), Math.abs(old)));
      for (const k2 of ks) for (const mk of (merged[k2] && (merged[k2].fs || [merged[k2]])) || []) for (const [kk, h] of mk.dur || []) { const [s2, e2] = kk.split('|'); if (Math.abs(day(e2) - day(e)) <= 7 && day(e2) - day(s2) < 300 && (day(e2) - day(s2) > 100 || ours(h))) { const L = lastOf(h); if (L > F) F = L; } }
      return F;
    };
    // גל 6: כבוי — ‏932 ערכים, ‏worse ‏49: כל 10-Q מדפיס רק שני רבעונים, והשרשור קפץ בכל הצגה מחדש לבסיס המקורי (Iron Mountain ‏pretax
    // ‏2015-Q1: ‏57.7M מה־10-Q המקורי במקום ‏41.1M שהוצג מחדש). גל 7 (F32): גם 10-K עם עמודות של 3 חודשים בשרשור, המשך לפי תגית,
    // ושתי השמירות של ההגשה המאוחרת למטה — ‏1,212 ערכים, ‏worse 0 (ה־49 נשארים כמו שהם). ‏wave-7.md §1
    if (F20_Q) for (const k of IS_KEYS) {
      const M = ISQ[k]; if (!M) continue;
      for (const e of qEnds) {
        if (fyEnds.some((f) => Math.abs(day(f) - day(e)) <= 7)) continue; // הרבעון הרביעי — לא ב־10-Q
        const p = bsfAt(M, e); if (!p) continue;
        const old = Q[k] && Q[k][e];
        if (old != null && near(IS_ABS.has(k) ? Math.abs(old) : old, p.v)) continue;
        if (old != null && !ISQ.own.some((x) => Math.abs(day(x) - day(e)) <= 7)) continue;
        if (old != null) { const pr = prAt(ISQ.printed, e); if (pr && pr.some((v) => near(Math.abs(old), v))) continue; }
        // גל 7 (F32): הערך שלנו הוגש אחרי ההגשה שממנה השרשור לקח את הרבעון — הצגה מאוחרת יותר (ביאור רבעוני מוצג מחדש ב־10-K:
        // Axon ‏2023-Q1, ‏Parker ‏2019-Q4, ‏Tyson ‏2019-Q3, ‏Live Nation; או 10-Q מאוחר שמדפיס רבעון ישן: Equinix, ‏HP) — לא מוחלף
        if (old != null && lateOf(k, e, old) > p.filed) continue;
        // הגשה מאוחרת יותר מדפיסה את הרבעון בשורות אחרות, ולא בשורה שלנו (Baxter ‏10-K ‏2025: הכנסות, רווח גולמי ורווח נקי ברבעונים
        // אחרי ההצגה מחדש של מכירת Kidney Care — עלות המכר שלנו ‏1,477 = ‏2,441 − ‏964 שם; ה־10-Q של 2024 מדפיס ‏2,238 על הבסיס הקודם)
        if (old != null && (bsfAt(ISQ.lastF, e) || '') > p.filed) continue;
        if (!Q[k]) Q[k] = {};
        Q[k][e] = p.v; cfy.push({ k: old == null ? 'ffill' : 'ffix', m: k, p: e, f: p.v, v: old == null ? null : old, q: 1 });
        const f = fyOf(e); if (f) (chg[k] = chg[k] || new Set()).add(f);
      }
    }
    // F29 (גל 6): הרבעון הרביעי נגזר (השנה פחות שלושה רבעונים) לפני התיקונים של F20 — בשנה שהשנתי או אחד הרבעונים בה השתנו
    // הוא נשאר מהערכים הישנים (Keysight ‏2015: השנה ‏388 המודפס, הרבעונים ‏124+154+124+157 = ‏559 הישן). גוזרים מחדש רק כששלושת
    // הרבעונים מודפסים ב־10-Q באותה סדרה (ISQ.printed); אחרת, כשהשנתי תוקן (ffix), הרבעון הרביעי הנגזר יורד — הוא מבסיס אחר
    // גל 7 (F33): השנתי שלנו מודפס ב־10-K הראשון שאחרי ההגשות האחרונות של שלושת הרבעונים — אותו בסיס. אחרת השנה הוצגה מחדש
    // מאוחר יותר והרבעונים לא (International Paper ‏2015: השנתי ‏14,313 מה־10-K של 2018, אחרי מכירת פעילות; הרבעונים מה־10-Q של
    // 2016 — ‏11,703; הרבעון הרביעי היה יוצא ‏2,610 במקום ~3,765)
    // אין עדיין 10-K אחרי ההצגה האחרונה של הרבעונים (Casey's ‏2026: הרבעון הראשון מודפס שוב ב־10-Q של השנה הבאה, ה־10-K הבא עוד לא
    // הוגש) — ה־10-K האחרון שמדפיס את השנה, וכל אחד משלושת הרבעונים שלנו כבר מודפס כך בהגשה האחרונה שלפניו (לא הוצג מחדש אחריו)
    const colsAt = (x, mon, e) => x.is.cols.map((c, ci) => [c, ci]).filter(([c]) => c && c.months === mon && Math.abs(day(c.end) - day(e)) <= 7).map(([, ci]) => ci);
    const prints = (x, cis, v) => x.is.rows.some((r) => { const w = SECFACE.rowVals(x.is, r); return cis.some((ci) => w[ci] != null && near(Math.abs(w[ci]), Math.abs(v))); });
    const pages = (re) => Object.values(bsf).filter((x) => x && x.is && x.is.rows && re.test(x.form)).sort((a, b) => (a.filed < b.filed ? -1 : 1));
    const annNext = (k, e, qs) => {
      const T = qs.reduce((m, x) => { const f = bsfAt(ISQ.lastF || new Map(), x) || ''; return f > m ? f : m; }, '');
      const K = pages(/^10-K/), after = K.filter((x) => x.filed > T);
      for (const x of after) { const cis = colsAt(x, 12, e); if (cis.length) return prints(x, cis, A[k][e]); }
      if (after.length) return false;
      const Kb = K.filter((x) => colsAt(x, 12, e).length).pop();
      if (!Kb || !prints(Kb, colsAt(Kb, 12, e), A[k][e])) return false;
      const P = pages(/^10-[QK]/).filter((x) => x.filed <= Kb.filed);
      return qs.every((q) => { const x = P.filter((y) => colsAt(y, 3, q).length).pop(); return !!x && prints(x, colsAt(x, 3, q), Q[k][q]); });
    };
    for (const k of IS_KEYS) {
      for (const e of chg[k] || []) {
        if (!Q[k] || A[k] == null || A[k][e] == null) continue;
        const der = (derived[k] || []).includes(e);
        if (Q[k][e] != null && !der) continue; // רבעון רביעי מדווח — לא נגזר
        const s0 = yearOf.get(e), qs = qEnds.filter((x) => x > s0 && x < e && day(e) - day(x) < 300);
        const ok = qs.length === 3 && qs.every((x) => Q[k][x] != null) && qs.every((x) => { const pr = prAt(ISQ.printed || new Map(), x); return pr && pr.some((v) => near(Math.abs(Q[k][x]), v)); }) && annNext(k, e, qs);
        const old = Q[k][e];
        if (ok) {
          const v = A[k][e] - qs.reduce((t, x) => t + Q[k][x], 0);
          if (old != null && near(old, v)) continue;
          Q[k][e] = v; if (!der) (derived[k] = derived[k] || []).push(e);
          cfy.push({ k: 'q4fix', m: k, p: e, f: v, v: old == null ? null : old });
        } else if (der && cfy.some((c) => c.k === 'ffix' && c.m === k && c.p === e && !c.q)) {
          Q[k][e] = null; derived[k] = derived[k].filter((x) => x !== e);
          cfy.push({ k: 'q4drop', m: k, p: e, f: null, v: old });
        }
      }
    }
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
      if (qLen(d0) && Q[k][e0] != null) { const r = cmpRatio(dur, kk); if (r != null) (GQ[k] = GQ[k] || {})[e0] = r; }
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
  const cx0 = isIfrs ? [] : capexNil(A, Q, fyEnds, qEnds, face, tags, capRows, capFace, derived);
  delete tags.oinv;
  const KEEP = ['rev', 'cogs', 'gp', 'op', 'ni', 'nic', 'eqt', 'tmp', 'tle', 'pretax', 'tax', 'rnd', 'int', 'eps', 'sh', 'ocf', 'capex', 'sbc', 'dep', 'buy', 'divp', 'dps',
    'cash', 'msec', 'debt', 'eq', 'ta', 'tl', 'ca', 'cl', 're', 'ppe'];
  const pack = (D, ends) => { const o = {}; for (const k of KEEP) { if (!D[k]) continue; const a = ends.map((e) => (D[k][e] != null ? D[k][e] : null)); if (a.some((v) => v != null)) o[k] = a; } return o; };
  const fy = fyEnds.filter((e) => A.rev[e] != null || A.ni[e] != null).slice(-20);
  const C = { A: pack(GA, fy), Q: pack(GQ, qEnds) };
  // שנים בלי דילול (גל 6 — F30): המניות הבסיסיות בדוח השנתי (או "בסיסי ומדולל") = המדוללות עד 0.1%, והרווח הבסיסי = המדולל עד
  // הסנט — שם "רווח למניה" בהודעה בלי המילה "מדולל" הוא גם המדולל (q4Press, שורות b). Loews ‏2025: המניות שונות ב־0.07% והרווח
  // ‏7.98 מול ‏7.97 — לא; Fox ‏2021: "בסיסי ומדולל" ‏621M (של שנה אחרת) מול ‏595M מדוללות — לא
  const noDil = fy.filter((e) => { const b = shBD[e] != null ? shBD[e] : shB.A[e];
    return b > 0 && A.sh[e] > 0 && Math.abs(b / A.sh[e] - 1) <= 0.001 && (epsBA[e] == null || A.eps[e] == null || Math.abs(epsBA[e] - A.eps[e]) < 0.005); });
  // מכפיל באפט: 12 הרבעונים האחרונים, לכל תגית לחוד — { 'YYYY-MM-DD': [Allocated, תזרים, הון, הפחתה] } (tagQ, BX_TAGS)
  let bx = null;
  if (!isIfrs) {
    const last = qEnds.slice(-12), cols = BX_TAGS.map((t) => tagQ(tagFacts(tax[t], unitOf('sbc')), last));
    for (const e of last) { const r = cols.map((c) => (c[e] != null ? c[e] : null)); if (r.some((x) => x != null)) (bx = bx || {})[e] = r; }
    // 12 החודשים לכל תגית (דרך ב — כשחסרים רבעונים): המפתח 'ttm'
    const t = BX_TAGS.map((tg) => tagTTM(tagFacts(tax[tg], unitOf('sbc')), last[last.length - 1]));
    if (t.some((x) => x != null)) (bx = bx || {}).ttm = t;
  }
  return { fy, q: qEnds, shEst: shEst.filter((e) => Q.sh[e] != null), epsNum, noDil, A: pack(A, fy), Q: pack(Q, qEnds), C: Object.keys(C.A).length || Object.keys(C.Q).length ? C : null, cur: cur || 'USD', ifrs: isIfrs, derived, tags, fixes, qmix, cx0, gpx, gpd, opx, splitsUsed, capFace, bsfN, cfy, bx };
}

/* השקעה הונית שהחברה לא מציגה בשורה נפרדת (5/11/2026, AppLovin). מ־2024 התזרים של AppLovin בלי "Purchase of property and
   equipment" — הסכום בתוך "Other investing activities" (רבעון 3 2026: ‏$7.5M מתוך ‏$17.7M, מול ‏$1.43B מפעילות; בהודעה לעיתונות
   התזרים החופשי ‏$1.42B). עד היום ההשקעות ההוניות נשארו ריקות → התזרים החופשי ריק בכל רבעון מ־2024 וב־2025 כולה, ו־Yahoo
   (בלי רבעונים) לא השלים. כשבתזרים של הדוח השנתי האחרון אין שום שורת השקעה הונית, ויש בו שורת "Other investing" (שם היא
   חבויה) — תקופה אחרי ההשקעה ההונית האחרונה שדווחה, שבה "Other investing" עד 5% מהתזרים מפעילות = השקעה זניחה, 0 (נרשם cx0,
   מידע). רבעון אחרון בשנה שיש לה ערך שנתי — השנה פחות שלושת הרבעונים. בלי דוח מודפס, ב־IFRS, או כשהשורה האחרת גדולה — ריק */
const CX_ROW = /capital expenditure|capital additions?|purchases? (of|for) (property|equipment|fixed assets|plant)|additions? (to|of) (property|equipment|plant|fixed assets)/i;
const CX_NIL_MAX = 0.05, CX_LAST_MAX = 0.02, CX_RECENT = 1100;
function capexNil(A, Q, fyEnds, qEnds, face, tags, capRows, capFace, derived) {
  const rows = (face && face.cf && face.cf.rows) || [], out = [];
  if (!rows.length || capRows.length || capFace || !A.capex || !A.ocf || !A.oinv) return out;
  const cxT = new Set(CAPEX_PARTS.concat(FLOW.capex, tags.capex ? tags.capex.split('+') : []));
  if (rows.some((r) => cxT.has(r.tag) || CX_ROW.test(r.label || ''))) return out;
  if (!rows.some((r) => r.tag === 'PaymentsForProceedsFromOtherInvestingActivities')) return out;
  if (!rows.some((r) => /^NetCashProvidedByUsedInInvestingActivities/.test(r.tag))) return out;
  // ההשקעה ההונית האחרונה שדווחה — זניחה (עד 2% מהתזרים מפעילות של אותה שנה) ובשלוש השנים האחרונות. בלי זה הכלל נגע ב־20
  // חברות: Dominion ‏(‏$4B ברבעון מ־Yahoo, השורה בתגית פרטית "Plant construction…") ‏ו־Cigna ‏(‏$322M) קיבלו 0, ובנקים ומבטחים
  // שמעולם לא דיווחו השקעה הונית — 0 בכל ההיסטוריה
  const ly = fyEnds.filter((e) => A.capex[e] != null).pop();
  if (!ly || !(A.ocf[ly] > 0) || A.capex[ly] > CX_LAST_MAX * A.ocf[ly]) return out;
  const fill = (D, ends, q) => {
    const last = ends.filter((e) => D.capex[e] != null).pop();
    if (!last || day(ends[ends.length - 1]) - day(last) > CX_RECENT) return;
    for (const e of ends) {
      if (e <= last || D.capex[e] != null) continue;
      const o = D.ocf[e], x = D.oinv[e];
      if (o == null || !o || x == null || Math.abs(x) > CX_NIL_MAX * Math.abs(o)) continue;
      D.capex[e] = 0; out.push({ k: 'cx0', m: 'capex', p: e, ...(q ? { q: 1 } : {}) });
    }
  };
  fill(A, fyEnds, false); fill(Q, qEnds, true);
  // רבעון אחרון בשנה עם ערך שנתי אמיתי (AppLovin ‏2024: ‏$4.8M בדוח השנתי, בלי 10-Q) — השנה פחות שלושת הרבעונים
  for (const c of out.filter((x) => x.q && A.capex[x.p] != null && !out.some((y) => !y.q && y.p === x.p))) {
    const i = fyEnds.indexOf(c.p), s0 = i > 0 ? fyEnds[i - 1] : null;
    const qs = qEnds.filter((q) => (s0 ? q > s0 : true) && q < c.p && day(c.p) - day(q) < 300);
    if (qs.length !== 3 || qs.some((q) => Q.capex[q] == null)) continue;
    const v = A.capex[c.p] - qs.reduce((t, q) => t + Q.capex[q], 0);
    if (v >= 0) { Q.capex[c.p] = v; (derived.capex = derived.capex || []).push(c.p); c.d = 1; }
  }
  return out.filter((c) => !c.d).map(({ q, ...c }) => c);
}

/* ---------- בדיקות אימות — תג, לא תיקון ---------- */
function validate(d) {
  const out = (d.fixes || []).map((f) => ({ k: 'fix', m: f.m, p: f.p, x: f.x })).concat(d.qmix || [], d.cx0 || []), A = d.A, Q = d.Q;
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
/* חור בסדרה (5/11/2026, AppLovin): מדד שדווח ברבעונים קודמים ונעלם בארבעת האחרונים, כשהבסיס שלו (הכנסות / תזרים מפעילות)
   ממשיך. כל שכבות הבקרה משוות רק ערכים שקיימים — ערך חסר מול Yahoo חסר לא נראה כאי־התאמה, והתזרים החופשי של AppLovin היה
   ריק שנתיים בלי סימון. אחרי כל ההשלמות (Yahoo); "לבדוק" — נרשם ומגיע לבקרה הלילית ולמרכז הניהול */
const HOLE_BASE = { capex: 'ocf', sbc: 'ocf', dep: 'ocf', ocf: 'rev', op: 'rev', ni: 'rev', eps: 'rev' };
function holes(d) {
  const out = [], n = (d.q || []).length;
  if (n < 8 || !d.Q) return out;
  for (const [m, b] of Object.entries(HOLE_BASE)) {
    const M = d.Q[m] || [], B = d.Q[b];
    if (!B) continue;
    const last = [n - 4, n - 3, n - 2, n - 1];
    if (!last.every((i) => M[i] == null && B[i] != null)) continue;
    if (M.slice(Math.max(0, n - 12), n - 4).filter((v) => v != null).length < 4) continue;
    out.push({ k: 'hole', m, p: d.q[n - 4] });
  }
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
// זרוע מימון בדוח רווח והפסד (שורה "Financial services/products", "Ford Credit", "GM Financial") — ראו finArm ב־fundamentals.
// גם בשורת הכותרת שמעל השורות (h, ‏secface): ב־Snap-on השורות של שירותי המימון הן "Net sales" / "Operating expenses" עם ממד,
// והזרוע מופיעה רק בכותרת "Financial Service" (יחיד). שם של זרוע — לא עלות מימון של החברה עצמה: "Write-off of financing costs"
// (CBRE), "Financing costs, net" (APA), "Provision for credit losses" (בנקים), "Principal Financial Group, Inc.", "Mark-to-Market Financial
// Commodity…" (EOG) — לא זרוע
const FIN_ARM = [/\bfinancial (services?|products?)\b/i, /\b[A-Z][A-Za-z&]+ (Credit|Financial)(?=\s*$|\s+[a-z]|,(?! Inc))/, /^financing (income|revenues?)\b|^financing cost$/i];
const FIN_NOT = /\btax|credit loss|write-?off|extinguish|attributable/i;
const finArmText = (t) => !!t && !FIN_NOT.test(t) && FIN_ARM.some((re) => re.test(t));
const finArmOf = (rows) => !!rows && rows.some((r) => finArmText(r.label) || finArmText(r.h));
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

/* הרבעון הרביעי מההודעה לעיתונות (17/11/2026, גל 2 — F2; ‏lib/secpr.js, ‏lib/bsfiled.js שדה p). ממוצע המניות המדולל של הרבעון
   הרביעי הוא הערכה (q4Shares: 4 × השנה פחות שלושה רבעונים) והרווח למניה נגזר ממנה — עד ‎±0.02 מהמודפס (Apple 2021: ‎1.23 במקום
   ‎1.24; P&G 2024: ‎1.26 במקום ‎1.27). ההודעה מדפיסה את שניהם: הזוג מאותה עמודה שמכפלתו = הרווח של הרבעון שלנו (הבסיס של הרווח
   למניה, לבעלי המניות או הנקי — Southwest 2022: הרווח לבעלי המניות נגזר משנה שתויגה שגוי, והנקי ‎−$220M = ‎−0.37 × 594M), והמניות
   עד 10% מההערכה (אחרי הפיצולים שאחרי ההודעה). המניות מחליפות את ההערכה, והרווח למניה — כשהוא נגזר. נרשם qsh (src 8k) */
function q4Press(sec, P) {
  const out = [];
  if (!P || !sec || !sec.Q || !sec.q) return out;
  const SECPR = require('./secpr');
  const est = sec.shEst || [], der = (sec.derived && sec.derived.eps) || [];
  const at = (e) => Object.values(P).find((r) => r && r.rows && Math.abs(day(r.end) - day(e)) <= 5);
  sec.q.forEach((e, i) => {
    if (!(sec.fy || []).some((f) => Math.abs(day(f) - day(e)) <= 5)) return;
    if (!est.includes(e)) return tagged(e, i);
    const r = at(e), sh = sec.Q.sh && sec.Q.sh[i]; if (!r || !(sh > 0)) return;
    // "רווח למניה" בלי "מדולל" (גל 6 — F30, שורות b): רק בשנה בלי דילול (noDil), וכשהשנה ברווח או הרבעון בהפסד — בשנת הפסד
    // (אנטי־דילול) רבעון רביעי ברווח כן מדלל, והבסיסי שלו שונה מהמדולל
    if (r.rows.some((x) => x.b) && !bOk(e, i)) return;
    // כל מקדמי הפיצול שאחרי תאריך כלשהו (התאריך שלנו הוא לפעמים ההגשה שאחרי הפיצול — Apple ‏4:1: אצלנו 30/10/2020, ההודעה 29/10)
    const sp = (sec.splitsUsed || []).slice().sort((a, b) => (a[0] < b[0] ? -1 : 1)), post = sp.map((_, j) => sp.slice(j).reduce((t, [, x]) => t * x, 1));
    const ns = [sec.epsNum && sec.epsNum[e], sec.Q.nic && sec.Q.nic[i], sec.Q.ni && sec.Q.ni[i]].filter((x) => Number.isFinite(x) && x !== 0);
    const fi = sec.fy.findIndex((f) => Math.abs(day(f) - day(e)) <= 5), A = sec.A || {};
    const ann = { sh: A.sh && A.sh[fi], ni: [A.nic && A.nic[fi], A.ni && A.ni[fi]].filter((x) => Number.isFinite(x) && x !== 0) };
    let m = null; for (const n of ns) { m = SECPR.q4From(r.rows, n, sh, post, ann); if (m) break; }
    if (!m) return;
    // רבעון הפסד (גל 4): המדולל = הבסיסי (אנטי־דילול), אבל יש הודעות שמדפיסות בשורה "Diluted" את המדוללות המלאות (Hartford ‏2016–2017:
    // ‏381.1 מול ‏376.6 המתויגות; ‏NRG, ‏Albemarle). כשבאותה שורה עמודת השנה קרובה למניות השנתיות שלנו (עד 3%) אבל לא שווה להן
    // (מעל 0.3%), והשנה היא שנת הפסד — השורה על בסיס אחר מהמתויג: המניות נשארות הערכה, רק הרווח למניה מההודעה. כשהשנה שווה
    // (Ventas: גם ה־XBRL השנתי מדולל מלא — ‏405.67) — המניות מההודעה, כמו ברווח
    const lossYr = (A.eps && A.eps[fi] < 0) || ann.ni.some((x) => x < 0);
    const yrSh = m.eps < 0 && lossYr && ann.sh > 0 ? (m.row || []).filter((x, j) => j !== m.col && x > 0 && Math.abs(x / ann.sh - 1) <= 0.03) : [];
    const keepSh = yrSh.length > 0 && !yrSh.some((x) => Math.abs(x / ann.sh - 1) <= 0.003);
    if (!keepSh) {
      sec.Q.sh[i] = m.sh; sec.shEst = (sec.shEst || []).filter((x) => x !== e);
      out.push({ k: 'qsh', m: 'sh', p: e, f: m.sh, v: sh, src: '8k' });
    }
    const ours = sec.Q.eps && sec.Q.eps[i];
    if (der.includes(e) && ours != null && Math.abs(ours - m.eps) >= 0.005) { sec.Q.eps[i] = m.eps; out.push({ k: 'qsh', m: 'eps', p: e, f: m.eps, v: ours, src: '8k' }); }
  });
  return out;
  /* רבעון רביעי מתויג (גל 4): הרווח למניה שתויג רחוק מהרווח של הרבעון — רווח למניה × מניות שונה מכל בסיס של הרווח ביותר
     מ־50% ובלפחות 5 סנט למניה. Sempra ‏2019: ‏XBRL מתייג 0.21 (‏0.105 אחרי הפיצול 2:1), והרווח ‏$447M חלקי ‏578M מניות = ‏0.77; בהודעה
     ‏1.55 ו־289M (‏0.775 אחרי הפיצול). מחליפים רק בזוג מההודעה שמכפלתו = הרווח והמניות שלו עד 2% מהמניות המתויגות — אותה טבלה ואותו
     רבעון; המניות המתויגות נשארות. רבעון עם רווח קטן, שבו המכפלה קרובה בסנטים — לא נוגעים */
  function bOk(e, i) {
    const fi = sec.fy.findIndex((f) => Math.abs(day(f) - day(e)) <= 5), A = sec.A || {}, f = sec.fy[fi];
    if (fi < 0 || !(sec.noDil || []).includes(f)) return false;
    const na = A.nic && A.nic[fi] != null ? A.nic[fi] : A.ni && A.ni[fi], nq = sec.Q.nic && sec.Q.nic[i] != null ? sec.Q.nic[i] : sec.Q.ni && sec.Q.ni[i];
    return na > 0 || nq < 0;
  }
  function tagged(e, i) {
    const r = at(e), sh = sec.Q.sh && sec.Q.sh[i], eps = sec.Q.eps && sec.Q.eps[i];
    if (!r || !(sh > 0) || eps == null || der.includes(e) || r.rows.some((x) => x.b)) return;
    const ns = [sec.epsNum && sec.epsNum[e], sec.Q.nic && sec.Q.nic[i], sec.Q.ni && sec.Q.ni[i]].filter((x) => Number.isFinite(x) && x !== 0);
    if (!ns.length || !ns.every((n) => Math.abs(eps * sh - n) > 0.5 * Math.abs(n) && Math.abs(eps - n / sh) >= 0.05)) return;
    const sp = (sec.splitsUsed || []).slice().sort((a, b) => (a[0] < b[0] ? -1 : 1)), post = sp.map((_, j) => sp.slice(j).reduce((t, [, x]) => t * x, 1));
    let m = null; for (const n of ns) { m = SECPR.q4From(r.rows, n, sh, post); if (m && Math.abs(m.sh / sh - 1) <= 0.02) break; m = null; }
    if (!m || Math.abs(m.eps - eps) < 0.005) return;
    sec.Q.eps[i] = m.eps; out.push({ k: 'qsh', m: 'eps', p: e, f: m.eps, v: eps, src: '8k' });
  }
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
    const n = [sec.Q.nic && sec.Q.nic[i], sec.Q.ni && sec.Q.ni[i]].filter((x) => Number.isFinite(x) && x !== 0);
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
        // רק העמודות שמושוות למטה (שנה שלמה, מטבע הדיווח) — עמודת המרה לדולר לא בוחרת שורה
        // (FMX ‏2025: שתי שורות ProfitLoss; עמודת ה־USD של הראשונה "הרחיקה" אותה, ונבחרה שורת הפעילות הנמשכת)
        const err = (vs) => vs.reduce((e, v, ci) => {
          const c = S.cols[ci]; if ((st !== 'bs' && c.months != null && c.months !== 12) || !SECFACE.colOk(c, d.cur)) return e;
          const i = d.fy.findIndex((x) => Math.abs(day(x) - day(c.end)) <= 8), o = i >= 0 ? d.A[k][i] : null;
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
    // למניות ADR: כל המניות במונחי ADR (Novo: ‏sharesOutstanding רק סוג B — ‏3.33B; ה־implied כולל את A — ‏4.41B) — ליחס ה־ADR
    adrSh: Math.max(raw(ks, 'sharesOutstanding') || 0, raw(ks, 'impliedSharesOutstanding') || 0) || null,
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
  // יום המסחר האחרון — מניה שהתמזגה/נמחקה (EQR → VMRK) נשארת ב־Yahoo עם מחיר ישן
  const lt = r.meta && r.meta.regularMarketTime, last = lt > 0 ? new Date(lt * 1000).toISOString().slice(0, 10) : null;
  return { px: t.length ? { t, c } : null, splits, div, last };
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

/* יום מסחר אחרון שעבר יותר מ־3 שבועות = המניה לא נסחרת (מיזוג, מחיקה, החלפת סימול) */
const GONE_DAYS = 21;
function goneSince(last, now = Date.now()) {
  return last && now - Date.parse(last) > GONE_DAYS * 864e5 ? last : null;
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
/* שער חודשי (H.10 של הפדרל ריזרב דרך FRED): ממוצע חודשי + השער היומי האחרון. דולר ליחידה של המטבע (17/11/2026, גל 2 — F6).
   הסדרות שמצוטטות "מטבע לדולר" (DKK, ‏TWD, ‏CNY…) — הופכים. מטבע שאין לו סדרה — null (המסך נשאר בלי מכפילים, fxMix) */
const FX_FRED = { EUR: ['EXUSEU', 1], GBP: ['EXUSUK', 1], AUD: ['EXUSAL', 1], NZD: ['EXUSNZ', 1], DKK: ['EXDNUS', -1], TWD: ['EXTAUS', -1],
  CNY: ['EXCHUS', -1], JPY: ['EXJPUS', -1], CAD: ['EXCAUS', -1], CHF: ['EXSZUS', -1], KRW: ['EXKOUS', -1], INR: ['EXINUS', -1], BRL: ['EXBZUS', -1],
  MXN: ['EXMXUS', -1], SEK: ['EXSDUS', -1], NOK: ['EXNOUS', -1], HKD: ['EXHKUS', -1], SGD: ['EXSIUS', -1], ZAR: ['EXSFUS', -1], THB: ['EXTHUS', -1] };
const fredRows = (csv) => String(csv).split(/\r?\n/).map((l) => l.split(',')).filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r[0]) && /^\d/.test(r[1] || '')).map((r) => [r[0], +r[1]]);
const FXC = new Map();
async function fxMonthly(cur, deps = {}) {
  const f = FX_FRED[cur]; if (!f) return null;
  const hit = FXC.get(cur); if (hit && Date.now() - hit.at < 12 * 3600e3) return hit.v;
  const get = deps.getText || ((u) => getText(u, { headers: { 'User-Agent': UA } }, 8000));
  const base = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=';
  const from = new Date(Date.now() - 40 * 864e5).toISOString().slice(0, 10);
  const [mc, dc] = await Promise.all([get(base + f[0]), get(base + 'D' + f[0] + '&cosd=' + from).catch(() => '')]);
  const inv = (x) => (f[1] < 0 ? 1 / x : x);
  const m = fredRows(mc).filter((r) => r[1] > 0).map((r) => [r[0].slice(0, 7), +inv(r[1]).toPrecision(6)]);
  if (!m.length) return null;
  const d = fredRows(dc).filter((r) => r[1] > 0), last = d.length ? d[d.length - 1] : null;
  const v = { cur, src: 'FRED ' + f[0], m, now: last ? +inv(last[1]).toPrecision(6) : m[m.length - 1][1], nowD: last ? last[0] : m[m.length - 1][0] };
  FXC.set(cur, { at: Date.now(), v });
  return v;
}
/* יחס ה־ADR: המניות הרגילות (מהדוח) ÷ כל המניות במונחי ADR (Yahoo). שלם, עד 5% (TSMC ‏25.93B ÷ 5.19B = 5.0; ‏Alibaba ‏19.24 ÷ 2.49
   = 7.7 → 8 — ממוצע מדולל של השנה מול היום); מניה שנסחרת ישירות (SAP, ‏ASML) — 1. אחר — null (בלי המרה, עדיף ריק משגוי) */
function adrRatio(ours, adrSh) {
  if (!(ours > 0) || !(adrSh > 0)) return null;
  const r = ours / adrSh, n = Math.round(r);
  return n >= 1 && Math.abs(r / n - 1) <= 0.05 ? n : null;
}

/* משרד האוצר האמריקאי — CSV שנתי של עקום התשואות; העמודה "10 Yr". גיבוי כש־FRED לא עונה */
function parseTreasury(csv, col = '10 Yr') {
  const lines = String(csv).trim().split(/\r?\n/), hdr = (lines[0] || '').split(',').map((x) => x.replace(/"/g, '').trim()), i = hdr.indexOf(col);
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
async function treasury30y() {
  const y = new Date().getUTCFullYear();
  const url = 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/' + y +
    '/all?type=daily_treasury_yield_curve&field_tdr_date_value=' + y + '&page&_format=csv';
  const all = parseTreasury(await getText(url, { headers: { 'User-Agent': UA } }, 8000), '30 Yr');
  return all.length ? { rf: all[all.length - 1][1] / 100, rfDate: all[all.length - 1][0] } : null;
}
async function macro() {
  const hit = cget('macro', 12 * H); if (hit) return hit;
  let fred = null;
  try { fred = parseFred(await getText('https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS10', { headers: { 'User-Agent': UA } }, 8000)); if (fred) fred.rfSrc = 'FRED DGS10'; } catch (e) { /* גיבוי למטה */ }
  if (!fred) { try { fred = await treasury10y(); } catch (e) { /* בלי ריבית חיה */ } }
  // האג"ח הארוך (30 שנה) — הריבית שבאפט משווה אליה את תשואת הרווח (מכתב 2000; גל 3 של מכפיל באפט). ‏FRED, ובגיבוי — משרד האוצר
  let l30 = null;
  try { l30 = parseFred(await getText('https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS30', { headers: { 'User-Agent': UA } }, 8000)); } catch (e) { /* גיבוי */ }
  if (!l30) { try { l30 = await treasury30y(); } catch (e) { /* בלי */ } }
  const v = { ...(fred || { rf: null, rfDate: null, rf5: null }), rf30: l30 ? l30.rf : null, rf30Date: l30 ? l30.rfDate : null, erp: DMD.erp, erpDate: DMD.erpDate, crpIL: DMD.crpIL, rfIL: DMD.rfIL, rfILDate: DMD.rfILDate,
    taxIL: DMD.taxIL, ratingIL: DMD.ratingIL, dmdAsOf: DMD.asOf, src: { rf: (fred && fred.rfSrc) || null, erp: DMD.src } };
  return fred ? cset('macro', v) : v;
}

/* ישות שמחליפה ישות קודמת (חברת אחזקות חדשה) — ב־SEC אין קישור ביניהן, ולכן טבלה מתועדת.
   הבדיקה הלילית (tools/fund-audit.js) מסמנת חברה עם פחות משנתיים היסטוריה — משם מוסיפים לכאן. */
const CIK_PREV = {
  '0002115436': '0000034088', // ExxonMobil Holdings Corp (2026) ← Exxon Mobil Corp
};
/* companyfacts + הדוחות שחסרים בו (lib/secxbrl.js) — לכלי הבקרה (tools/fund-audit.js, tools/fund-xcheck.js), כדי ש"SEC גולמי" יכלול אותם */
async function secFacts(cik) {
  const ck = String(cik).padStart(10, '0'), SH = { headers: { 'User-Agent': SEC_UA() } };
  const [facts, sub] = await Promise.all([getJson('https://data.sec.gov/api/xbrl/companyfacts/CIK' + ck + '.json', SH, 15000),
    getJson('https://data.sec.gov/submissions/CIK' + ck + '.json', SH, 8000).catch(() => null)]);
  if (!sub) return facts;
  return (await require('./secxbrl').patchFacts(facts, sub, ck, { merge: mergeFacts,
    getText: (u) => getText(u, SH, 12000), getJson: (u) => getJson(u, SH, 8000) }).catch(() => ({ facts }))).facts;
}
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
  let sec = null, cik = null, face = null, xbAdded = [], secPr = null, sbcX = null;
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
        // המאזן המודפס של כל הגשה (lib/bsfiled.js) — מ־R2, ועד 4 הגשות חדשות שחסרות; כל תקלה = null (החוב בכלל של F7)
        const bsfP = subP.then((sb) => (sb ? require('./bsfiled').load(cik, sb, { getText: (u) => getText(u, SH, 5000) }) : null)).catch(() => null);
        const prevP = prev ? getJson('https://data.sec.gov/api/xbrl/companyfacts/CIK' + prev + '.json', SH, 15000).catch(() => null) : null;
        const [facts1, sub, fc, pf, bsf] = await Promise.all([factsP, subP, faceP, prevP, bsfP]);
        // דוח שהוגש ואינו ב־companyfacts (5/11/2026: 56 דוחות של 42 חברות) — מקובץ ה־XBRL של ההגשה (lib/secxbrl.js)
        const xb = await require('./secxbrl').patchFacts(facts1, sub, cik, { merge: mergeFacts,
          getText: (u) => getText(u, SH, 12000), getJson: (u) => getJson(u, SH, 8000) }).catch(() => ({ facts: facts1, added: [] }));
        const facts0 = xb.facts; xbAdded = xb.added;
        const facts = pf ? mergeFacts(pf, facts0) : facts0;
        face = fc;
        const m = await monthly;
        sec = normalizeSec(facts, (m && m.splits) || [], face, bsf && bsf.f);
        secPr = bsf && bsf.p; // ההודעות לעיתונות (q4Press)
        sbcX = bsf && bsf.sx && bsf.sx.length ? bsf.sx : null; // מדיניות התגמול במניות לפי הודעות התוצאות (lib/secsbc.js) — "מכפיל באפט"

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
  const q4p = useSec ? q4Press(sec, secPr) : [];
  const qsh = useSec ? qShares(sec, y) : [];
  const qeps = useSec ? q4Eps(sec, y) : [];
  const checks = useSec ? validate(sec).concat(crossCheck(sec, y), fcRes.out, ffix, sec.cfy || [], q4p, qsh, qeps) : [];
  // מידע: דוח שהושלם מקובץ ה־XBRL של ההגשה (לא היה ב־companyfacts) — הבקרה הלילית סופרת אותם
  if (useSec) for (const a of xbAdded) checks.push({ k: 'xbrl', m: a.form, p: a.per || a.filed });
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
  // השקעות הוניות בשורות של תגית פרטית (capFace מ־normalizeSec — הסכום שהודפס בכל שנה שבדוח): Yahoo משלים רק כשהוא תואם
  // לסכום הזה בכל שנה שבדוח (CoStar, Ventas, United Rentals — Yahoo = הדוח, עם שנה רביעית). אחרת (Weyerhaeuser: Yahoo מוסיף
  // את רכישת היערות, ‏$943M מול ‏$474M) — השנים שבדוח מהסכום שהודפס, השאר ריק; נרשם ffill (מהדוח עצמו)
  if (useSec && sec.capFace && !sec.A.capex) {
    const ya = (e) => { const j = y && y.fy && y.A && y.A.capex ? y.fy.findIndex((x) => Math.abs(day(x) - day(e)) < 20) : -1; return j >= 0 ? y.A.capex[j] : null; };
    const yOk = sec.capFace.every((c) => { const v = ya(c.end); return v != null && Math.abs(Math.abs(v) - c.v) <= 0.01 * c.v; });
    if (!yOk) {
      const a = sec.fy.map((e) => { const c = sec.capFace.find((x) => Math.abs(day(x.end) - day(e)) <= 8); return c ? c.v : null; });
      if (a.some((v) => v != null)) { sec.A.capex = a; for (const c of sec.capFace) if (a.includes(c.v)) checks.push({ k: 'ffill', m: 'capex', p: c.end, f: c.v, v: null }); }
    }
  }
  if (useSec && y && y.fy) for (const k of Object.keys(YMAP)) {
    if (sec.A[k] || !y.A[k]) continue;
    if ((k === 'gp' || k === 'cogs') && sec.gpx !== 'fin' && (sec.gpx === 'part' || !grossOnFace)) continue; // 'off' עם שורת "Cost of…" בדוח (Thermo Fisher, Deere: לפי מוצרים ושירותים) — כן
    const a = sec.fy.map((e) => { const j = y.fy.findIndex((x) => Math.abs(day(x) - day(e)) < 20); return j >= 0 ? y.A[k][j] : null; });
    // רווח למניה מ־Yahoo — רק שנה שמתאימה לרווח לבעלי המניות / המניות המדוללות מ־SEC (עד 5%; Airbnb 2025 ב־Yahoo: ‏1.03 מול
    // 4.03 שהודפס, 16/11/2026). שנה בלי רווח או מניות מ־SEC — כמו שהיא
    if (k === 'eps') a.forEach((v, i) => {
      const n0 = sec.A.nic && sec.A.nic[i] != null ? sec.A.nic[i] : sec.A.ni ? sec.A.ni[i] : null, s0 = sec.A.sh ? sec.A.sh[i] : null;
      if (v != null && n0 != null && s0 > 0 && Math.abs(v - n0 / s0) > 0.05 * Math.abs(n0 / s0) + 0.01) a[i] = null;
    });
    if (a.some((v) => v != null)) { sec.A[k] = a; fill.push(k); }
  }
  // רבעון ש־SEC לא מאפשר לחשב מאותו בסיס (שנה שהוצגה מחדש מול תשעה חודשים ישנים — Bank of America; רבעונים שאינם מאותו בסיס
  // כמו השנה; זרוע מימון) — כמו בממשקים שאנחנו משווים אליהם: המספר שהחברה פרסמה (Yahoo, רק רבעון שהוא דיווח ולא חישב בעצמו).
  // רק תאריך שכבר קיים אצלנו; נרשם qfy (מידע) ובתשובה qfill — כלי ההשוואה לא בודק אותו מול Yahoo
  const qfill = useSec ? yQuarterFill(sec, y, grossOnFace, checks) : {};
  if (useSec && sec.gpx === 'fin') checks.push({ k: 'gpfin', m: 'gp', p: sec.fy[sec.fy.length - 1] });
  if (useSec) checks.push(...holes(sec));
  // מניות לשווי השוק: בדילול מהדוח האחרון (ב־Yahoo "sharesOutstanding" הוא לפעמים רק סוג מניות אחד — Meta: 2.2B מתוך 2.57B)
  const lastSh = (D) => (D && D.sh ? D.sh.filter((v) => v > 0).pop() : null);
  const sharesOut = useSec ? (lastSh(sec.Q) || lastSh(sec.A)) : ((y && y.sharesOut) || lastSh(y && y.Q) || (s && s.sharesOut));
  // דוחות במטבע שאינו דולר/שקל והמחיר בדולר (Novo — DKK, ‏TSMC — TWD, ‏Alibaba — CNY, ‏SAP/ASML — EUR): השער החודשי ויחס ה־ADR,
  // והמסך ממיר את המחיר למטבע הדוחות למניה רגילה (fxm; עד 17/11/2026 — co.fxMix, בלי מכפילים)
  const rcur = useSec ? sec.cur : null;
  const fxm = rcur && rcur !== 'USD' && rcur !== 'ILS' && !ta && s && (s.quoteCur || 'USD') === 'USD'
    ? await fxMonthly(rcur).then((f) => (f ? { ...f, adr: adrRatio(sharesOut, s.adrSh) } : null)).catch(() => null) : null;
  const out = {
    ok: true, v: 1, sym, src: useSec ? 'sec' : 'yahoo', cik, asOf: new Date().toISOString().slice(0, 10), gone: goneSince(m && m.last),
    cur: (useSec ? sec.cur : (s && s.finCur)) || (ta ? 'ILS' : 'USD'),
    fy: base.fy, q: base.q, A: base.A, Q: base.Q, T: useSec ? null : (y && y.T) || null,
    derived: useSec ? sec.derived : null, gpx: useSec ? sec.gpx || null : null, opx: useSec ? sec.opx || null : null, C: useSec ? sec.C : null, ifrs: useSec ? !!sec.ifrs : false,
    sic: useSec ? sec.sic : null, sicDesc: useSec ? sec.sicDesc : null, fye: useSec ? sec.fye : null, lastFiled: useSec ? sec.lastFiled : null,
    prof: s ? s.prof : null, price: s ? s.price : null, prev: s ? s.prev : null,
    sharesOut: sharesOut || (s && s.sharesOut) || null, fill, qfill, fpe: s ? s.fpe : null, peg: s ? s.peg : null, beta: s ? s.beta : null,
    est: s ? s.est : [], hist: s ? s.hist : [], nextEarn: s ? s.nextEarn : null, nq: n || null, sbcX, bx: useSec ? sec.bx || null : null,
    px: m ? m.px : null, fxm, splits: m ? m.splits : [], splitsUsed: useSec ? sec.splitsUsed || [] : [], peers: peers || [],
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
const CHECK_INFO = new Set(['fix', 'ffill', 'ffix', 'rst', 'qeps', 'qmix', 'qfy', 'gpfin', 'qsh', 'xbrl', 'cx0']);
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

// בקשה ל־SEC עם המזהה (עבודת הרקע של המאזנים — server.js → startBsf → lib/bsfiled.js)
const secText = (u) => getText(u, { headers: { 'User-Agent': SEC_UA() } }, 15000);
module.exports = { handle, fundamentals, tagQ, tagTTM, BX_TAGS, holes, q4Press, fxMonthly, adrRatio, FX_FRED, capexNil, debtFace, bsfDebt, bsfCf, bsfIs, secText, secFacts, goneSince, noteFlags, flaggedSyms, warnKinds, CHECK_INFO, FLAG_PRE, q4Eps, finArmOf, yQuarterFill, qShares, macro, yahooMonthly, normalizeSec, mergeTags, fixRuns, faceCheck, secFace, cikMap, secSym, mergeFacts, CIK_PREV, validate, crossCheck, parseYahooTs, parseSummary, parseMonthly, parseNasdaq, parsePeers, parseFred, parseTreasury,
  industryFor, industryData, _cache: cache,
  // התגיות המועמדות לכל שורה — לכלי ההשוואה (fundxcheck: SEC גולמי גם לתקופות שהושלמו מתגית משנית). נשמט ב־f9db4c74 — tools/fund-xcheck.js מצפה לו
  TAGS: { gaap: { ...FLOW, ...INST }, ifrs: IFRS } };
