/* שכבה 8 בבקרת הדיוק של מנתח החברות (26/10/2026): כל ערך מול כמה מקורות בלתי תלויים.
   טהור — בלי רשת. tools/fund-xcheck.js מביא את המקורות ומריץ.
   המקורות: (1) SEC גולמי — אותה תגית, ההגשה האחרונה, חישוב נפרד ופשוט של הרבעון (שנה פחות 9 חודשים);
   כשהערך שלנו מחושב (רווח גולמי = הכנסות − עלות, סך התחייבויות = סך התחייבויות והון − הון, השקעות הוניות = סכום תגיות,
   רבעון רביעי = שנה − שלושה רבעונים) — אותה נוסחה מחדש מהערכים הגולמיים של SEC (rf);
   (2) הדוח כפי שהודפס (faceCheck — הסימון 'face' ב־checks; ו־opt.face = הדוח השנתי האחרון עצמו, לשנים שבו); (3) Yahoo (כולל שדות חלופיים — "מילון ההגדרות"); (4) Nasdaq (EDGAR Online).
   הכרעה לכל ערך:
     ok   — תואם את כל המקורות שיש;
     okd  — שונה ממקור חיצוני בהגדרה ידועה שלו (DEFS), ותואם את הגדרת החלופה שלו — לא טעות של אף אחד (why = מזהה ההגדרה);
            why 'face' = בשנה שבדוח המודפס: הערך שלנו הוא השורה שהחברה הדפיסה, והמקור לא = אנחנו ± שורה אחרת — המקור טועה / מגדיר אחרת;
     est  — ערך שאין לו מקור (רבעון רביעי של רווח למניה / ממוצע מניות) ותואם את האומדן מ־SEC (שנה פחות שלושה רבעונים);
     estx — כמו est, אבל רחוק מהאומדן — לבדוק;
     def  — תואם את SEC (או מקור חיצוני אחד), ומקור חיצוני אחר שונה בגלל בחירה שלנו (why תמיד — DEFS בלי ok, או 'est');
     odd  — תואם את SEC, ומקור חיצוני שונה בלי שום הסבר ידוע — בעיה לבדוק (סבב 2, 26/10/2026: עד אז "def" בלי why — 1,788 ב־517 חברות).
            why: fline = המקור = אנחנו ± שורה אחרת שמודפסת בדוח (אולי חסרה לנו שורה — Host, Zimmer); nf = התגית שלנו לא מודפסת בדוח;
            a:<הסבר> = רמז — באותו מדד הוסבר כך בשנים שבדוח (ברבעונים / בשנים ישנות אין דוח לבדוק מולו);
     ext  — שני המקורות החיצוניים קרובים זה לזה (עד 5%) ורחוקים מאיתנו, ואנחנו = SEC — לבדוק את בחירת התגית;
     spl  — מניות / רווח למניה ביחס של פיצול שמופיע ברשימת הפיצולים — לא הוחל אצלנו (או הוחל פעמיים);
     bug  — שונה מ־SEC הגולמי של אותה תגית / מאותה נוסחה, או שהדוח המודפס שונה, או "שנה" שהיא לא שנה (ttm);
     one  — רק מקור אחד, ושונה — לבדוק;
     yfill — שורה שאין ב־SEC ו־fundamentals השלים מ־Yahoo: Yahoo הוא המקור, לא בדיקה (nd = Nasdaq שונה);
     none — אין אף מקור ואין נוסחה לבדוק. */

const SF = require('./secface');
const DAY = 864e5;
const day = (e) => Date.parse(e + 'T00:00:00Z') / DAY;
const nearEnd = (list, e, tol = 20) => { let b = -1, bd = 1e9; (list || []).forEach((x, i) => { const d = Math.abs(day(x) - day(e)); if (d < bd) { bd = d; b = i; } }); return bd <= tol ? b : -1; };
const nearKey = (o, e, tol = 20) => { if (!o) return null; let b = null, bd = 1e9; for (const k of Object.keys(o)) { const d = Math.abs(day(k) - day(e)); if (d < bd) { bd = d; b = k; } } return bd <= tol ? o[b] : null; };

const PER_SHARE = new Set(['eps', 'dps']);
const NOSUM = new Set(['eps', 'dps', 'sh']);
// סטייה מותרת: 0.5% (נבדק 26/10/2026 על 30 חברות: Yahoo ו־Nasdaq מדויקים עד הדולר / האלף — 92% מההתאמות זהות לגמרי,
// ואין def שנובע מעיגול; בין 0.1% ל־0.5% יש הבדלי הגדרה קטנים אמיתיים — מסומנים near), למניה — סנט;
// ערכים קטנים מאוד (מתחת ל־0.1% מההכנסות) — עד ‎$2M
function same(m, a, b, scale) {
  if (a == null || b == null) return null;
  if (PER_SHARE.has(m)) return Math.abs(a - b) <= 0.011 + 0.002 * Math.abs(b);
  const d = Math.abs(a - b), mx = Math.max(Math.abs(a), Math.abs(b));
  return d <= 0.005 * mx || d <= Math.max(2e6, 1e-3 * (scale || 0));
}
const relDiff = (a, b) => { const mx = Math.max(Math.abs(a), Math.abs(b)); return mx ? Math.abs(a - b) / mx : 0; };
// מול שורה בדוח המודפס — סטייה צרה (0.2%, בלי סף מוחלט לפי גודל החברה): בדוח יש עשרות שורות, וסף רחב מוצא צירוף מקרי
const fsame = (a, b) => a != null && b != null && Math.abs(a - b) <= 0.002 * Math.max(Math.abs(a), Math.abs(b), 1);

/* ---------- Nasdaq: api.nasdaq.com/api/company/<SYM>/financials?frequency=1|2 (ערכים באלפים) ---------- */
const NQ_ROWS = {
  incomeStatementTable: { 'Total Revenue': 'rev', 'Cost of Revenue': 'cogs', 'Gross Profit': 'gp', 'Research and Development': 'rnd', 'Operating Income': 'op',
    'Earnings Before Tax': 'pretax', 'Income Tax': 'tax', 'Net Income': 'ni', 'Net Income Applicable to Common Shareholders': 'nic' },
  balanceSheetTable: { 'Cash and Cash Equivalents': 'cash', 'Short-Term Investments': 'sti', 'Total Current Assets': 'ca', 'Total Assets': 'ta', 'Total Current Liabilities': 'cl', 'Total Liabilities': 'tl',
    'Stock Holders Equity': 'eq', 'Total Equity': 'teq', 'Minority Interest': 'mi', 'Retained Earnings': 're', 'Fixed Assets': 'ppe' },
  cashFlowTable: { 'Net Cash Flow-Operating': 'ocf', 'Capital Expenditures': 'capex', 'Depreciation': 'dep' },
};
const NQ_ABS = new Set(['capex', 'cogs', 'tax', 'rnd']);
function nqNum(s) {
  if (s == null) return null;
  const t = String(s).replace(/[$,\s]/g, '');
  if (!t || t === '--') return null;
  const neg = /^-|^\(.*\)$/.test(t), v = parseFloat(t.replace(/[()-]/g, ''));
  return Number.isFinite(v) ? (neg ? -v : v) * 1000 : null;
}
function nqDate(s) { const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(s || '').trim()); return m ? m[3] + '-' + m[1].padStart(2, '0') + '-' + m[2].padStart(2, '0') : null; }
function parseNasdaq(j) {
  const d = j && j.data; if (!d) return null;
  const out = { ends: [], v: {} };
  for (const [tb, map] of Object.entries(NQ_ROWS)) {
    const t = d[tb]; if (!t || !t.headers || !t.rows) continue;
    const cols = Object.keys(t.headers).filter((k) => k !== 'value1');
    const ends = cols.map((c) => nqDate(t.headers[c]));
    for (const r of t.rows) {
      const k = map[String(r.value1 || '').trim()]; if (!k) continue;
      cols.forEach((c, i) => {
        const e = ends[i]; if (!e) return;
        let v = nqNum(r[c]); if (v == null) return;
        if (NQ_ABS.has(k)) v = Math.abs(v);
        (out.v[k] = out.v[k] || {})[e] = v;
        if (!out.ends.includes(e)) out.ends.push(e);
      });
    }
  }
  out.ends.sort();
  return out;
}

/* ---------- Yahoo: השדות הגולמיים (בלי השלמת רבעון רביעי) — להגדרות החלופיות ולזיהוי ערך ש־parseYahooTs חישב ---------- */
// השדה הראשי לכל מדד (= YMAP של fundamentals) — ערך של parseYahooTs שאין לו שדה גולמי בתאריך = רבעון רביעי ש־Yahoo לא פרסם וחושב
const YPRIM = { rev: 'TotalRevenue', gp: 'GrossProfit', op: 'OperatingIncome', ni: 'NetIncomeCommonStockholders', eps: 'DilutedEPS', sh: 'DilutedAverageShares',
  ocf: 'OperatingCashFlow', capex: 'CapitalExpenditure', cash: 'CashAndCashEquivalents', ta: 'TotalAssets', tl: 'TotalLiabilitiesNetMinorityInterest',
  eq: 'StockholdersEquity', ca: 'CurrentAssets', cl: 'CurrentLiabilities' };
// השדות החלופיים שהכלי מבקש בנוסף (tools/fund-xcheck.js)
const YALT_TYPES = ['TotalOperatingIncomeAsReported', 'OperatingRevenue', 'NetIncome', 'NetIncomeFromContinuingOperationNetMinorityInterest', 'BasicEPS', 'BasicAverageShares',
  'PurchaseOfPPE', 'CapitalExpenditureReported', 'NetPPEPurchaseAndSale', 'CashFinancial', 'CashCashEquivalentsAndFederalFundsSold',
  'CashCashEquivalentsAndShortTermInvestments', 'TotalEquityGrossMinorityInterest', 'CommonStockEquity'];
function parseYahooAlt(j) {
  const o = { A: {}, Q: {} };
  for (const r of (j && j.timeseries && j.timeseries.result) || []) {
    const t = r.meta && r.meta.type && r.meta.type[0]; if (!t) continue;
    const p = t.startsWith('annual') ? 'A' : t.startsWith('quarterly') ? 'Q' : null; if (!p) continue;
    const k = t.slice(p === 'A' ? 6 : 9);
    for (const x of r[t] || []) if (x && x.reportedValue && x.reportedValue.raw != null) (o[p][k] = o[p][k] || {})[x.asOfDate] = x.reportedValue.raw;
  }
  return o;
}

/* ---------- מילון ההגדרות: הבדל ידוע בין ההגדרה של מקור חיצוני לשלנו ----------
   לכל מדד — רשימת הסברים. הסבר "מתאים" כשהערך שלנו שווה לשדה החלופי של אותו מקור (y), או כשהמקור שווה לתגית SEC אחרת (sec),
   או לערך שלנו ועוד תגית SEC (plus). ok:true = הגדרה של המקור בלבד → okd; בלי ok = הבחירה שלנו (התגית) — נשאר def/ext עם why, כדי שיראו.
   lim = יחס מרבי בין הערכים (בלי — כל יחס), כדי שהסבר לא יכסה ערך שרחוק פי כמה (AEP: ההשקעות ההוניות שלנו 2% מהאמת). */
const DEFS = {
  op: [{ id: 'y_op_asrep', s: 'y', y: ['TotalOperatingIncomeAsReported'], ok: true }, // Yahoo "OperatingIncome" = בלי פריטים חריגים (ארגון מחדש, ירידת ערך, IPR&D)
    { id: 'n_op_int', s: 'n', minus: ['InterestExpenseNonoperating', 'InterestAndDebtExpense', 'InterestExpense', 'InterestExpenseDebt', 'InterestExpenseOperating'], ok: true }, // Nasdaq: רווח תפעולי אחרי הוצאות ריבית (בורסות, מנהלי השקעות)
    { id: 'n_op_inv', s: 'n', plus: ['InvestmentIncomeNonoperating', 'NetInvestmentIncome', 'InvestmentIncomeInterestAndDividend', 'NetInvestmentIncomeAndIncomeLossFromEquityMethodInvestments'], ok: true }, // Nasdaq: כולל הכנסות השקעה (Erie)
    { id: 'n_op_other', s: 'n', flab: /^other (income|\(income\)|expense)|derivative/i, fsub: true, ok: true }, // Nasdaq מזיז "הכנסות אחרות" / רווחי נגזרים אל הרווח התפעולי או ממנו (Otis, EQT)
    { id: 'y_op_unusual', s: 'y', flab: /^other\b|restructur|impairment|acquisition|litigation|transaction/i, ok: true }], // Yahoo בלי פריטים חריגים שמודפסים בדוח (Qualcomm "Other", ICE)
  ni: [{ id: 'y_ni_total', s: 'y', y: ['NetIncome', 'NetIncomeFromContinuingOperationNetMinorityInterest'], ok: true }, // Yahoo "לבעלי המניות" מנכה ניירות משתתפים / בכורה
    { id: 'n_ni_total', s: 'n', n: ['ni'], ok: true }],
  rev: [{ id: 'y_rev_op', s: 'y', y: ['OperatingRevenue'], ok: true }, // Yahoo TotalRevenue כולל רווחי השקעות (מבטחים) / ההפך
    { id: 'n_rev_gross', s: 'n', plus: ['InterestExpense', 'InterestExpenseOperating'], ok: true }, // Nasdaq בבנקים: הכנסות ריבית ברוטו
    { id: 'fin_rev', s: 'yn', when: (c) => c.fin },
    { id: 'n_rev_int', s: 'n', flab: /interest|income from loans|financial services|fees$/i, fsub: true, ok: true }, // Nasdaq בלי הכנסות ריבית / מימון שבתוך סך ההכנסות (Paccar, Healthpeak, Welltower) // בנק/מבטח: הכנסות נטו מול ברוטו, רווחי השקעות — כל מקור אחרת
    { id: 'rev_ctr', s: 'yn', sec: ['RevenueFromContractWithCustomerExcludingAssessedTax', 'RevenueFromContractWithCustomerIncludingAssessedTax'], lim: 1.25 }], // אנחנו "Revenues" (כולל הכנסות אחרות) — בחירה
  cash: [{ id: 'y_cash_fin', s: 'y', y: ['CashFinancial', 'CashCashEquivalentsAndFederalFundsSold'], ok: true }, // בנקים: Yahoo כולל פיקדונות בבנק המרכזי
    { id: 'n_cash_restr', s: 'n', sec: ['CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents', 'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalentsIncludingDisposalGroupAndDiscontinuedOperations'], ok: true, // Nasdaq = כולל מזומן מוגבל / מופרד
      plus: ['RestrictedCashAndCashEquivalentsAtCarryingValue', 'RestrictedCash', 'RestrictedCashCurrent', 'RestrictedCashAndCashEquivalentsCurrent', 'RestrictedCashAndCashEquivalents',
        'RestrictedCashAndInvestmentsCurrent', 'CashAndSecuritiesSegregatedUnderFederalAndOtherRegulations', 'CashSegregatedUnderOtherRegulations'] },
    { id: 'y_cash_sti', s: 'y', y: ['CashCashEquivalentsAndShortTermInvestments'] },
    { id: 'fin_cash', s: 'yn', when: (c) => c.fin, ok: true }, // בנק: "מזומן" = מזומן ופיקדונות בבנקים — כל מקור כולל רכיבים אחרים, ולא משמש בניתוח בנק
    { id: 'y_cash_cust', s: 'y', flab: /customer funds/i, ok: true }, // Yahoo כולל כספי לקוחות (Block)
    // Yahoo מפריד את המזומן המוגבל: שלנו = המזומן של Yahoo + המוגבל שלו (NXPI, Fiserv), או ההפך — Yahoo = השורה המשולבת במאזן (Devon)
    { id: 'y_cash_restr', s: 'y', y: ['EndCashPosition'], ysum: [['CashAndCashEquivalents', 'RestrictedCash']], ok: true,
      sec: ['CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents', 'RestrictedCashAndCashEquivalents'],
      plus: ['RestrictedCashAndCashEquivalentsAtCarryingValue', 'RestrictedCash', 'RestrictedCashCurrent', 'RestrictedCashAndCashEquivalentsCurrent'] }], // בנק: "מזומן" = מזומן ופיקדונות בבנקים — כל מקור כולל רכיבים אחרים, ולא משמש בניתוח בנק
  capex: [{ id: 'y_capex_ppe', s: 'y', y: ['PurchaseOfPPE', 'CapitalExpenditureReported', 'NetPPEPurchaseAndSale'], abs: true, ok: true }, // Yahoo CapitalExpenditure כולל נכסים בלתי מוחשיים
    { id: 'capex_intang', s: 'yn', plus: ['PaymentsToAcquireIntangibleAssets', 'PaymentsToAcquireSoftware', 'PaymentsForSoftware', 'PaymentsToDevelopSoftware', 'PaymentsForNuclearFuel',
      'PurchaseOfIntangibleAssetsClassifiedAsInvestingActivities'], flab: /software|intangible|enterprise resource/i, lim: 3 }, // תוכנה שהוונה / דלק גרעיני — בחירה שלנו
    { id: 'capex_part', s: 'yn', part: true }, // אנחנו = רכוש קבוע + תוכנה (שתי שורות בתזרים), המקור רק את שורת הרכוש הקבוע — בחירה שלנו
    { id: 'capex_acq', s: 'yn', flab: /\bacqui|\bpurchases? of (businesses|oil and gas|leasehold)/i, plus: ['PaymentsToPropertyAndEquipmentAcquisition', 'PaymentsToAcquireBusinessesNetOfCashAcquired', 'PaymentsToAcquireRealEstate', 'PaymentsToAcquireProperty',
      'PaymentsToAcquireOilAndGasProperty', 'PaymentsToAcquireOilAndGasPropertyAndEquipment', 'PaymentsToAcquireBusinessesGross', 'PaymentForAcquisitionCryptoAsset'] }, // המקור כולל רכישות (נכסים, עסקים, נדל"ן) — אצלנו רק השקעה הונית
    // קרן ריט: המקור = השקעה בנדל"ן (רכישות / פיתוח), אצלנו = שיפורים בנכסים קיימים (Realty Income: ‏Nasdaq ‏$4.6B "Investment in real estate" מול ‏$132M)
    { id: 'capex_re', s: 'yn', when0: (c) => c.reit, sec: ['PaymentsToAcquireCommercialRealEstate', 'PaymentsToAcquireRealEstate', 'PaymentsToDevelopRealEstateAssets', 'PaymentsToAcquireAndDevelopRealEstate'],
      flab: /acqui|investments? in real estate|development|construction/i, fone: true }, // לא "Improvements" — זו השקעה הונית (Kimco: אצלנו תגית אחרת, כמעט אפס)
    { id: 'n_scale', s: 'n', scale: true, ok: true }, // Nasdaq פי אלף (PulteGroup: 25,000 במקום ‏$25M)
    { id: 'n_abs', s: 'n', abs1: true, ok: true }], // השקעה נטו שלילית (מכירות > קניות — Hartford): Nasdaq מציג ערך מוחלט
  eq: [{ id: 'y_eq_nci', s: 'y', y: ['TotalEquityGrossMinorityInterest'], minus: ['MinorityInterest'], flab: /noncontrolling|minority/i, fsub: true }, // ההון שלנו כולל זכויות מיעוט — בחירה (לתשואה על ההון עדיף בלי)
    { id: 'y_eq_common', s: 'y', y: ['CommonStockEquity'] }],
  sh: [{ id: 'y_sh_basic', s: 'y', y: ['BasicAverageShares'] },
    { id: 'y_unit', s: 'y', unit: true, ok: true }], // Yahoo ביחידה אחרת (ADS = 4 מניות ב־PDD) או מוכפל במספר שלם
  // תזרים: אצלנו מפעילות נמשכת (כמו בדוח), המקור — כולל הפעילות שהופסקה
  ocf: [{ id: 'y_ocf_cont', s: 'y', y: ['CashFlowFromContinuingOperatingActivities'], ok: true },
    { id: 'ocf_disc', s: 'yn', plus: ['CashProvidedByUsedInOperatingActivitiesDiscontinuedOperations'], minus: ['CashProvidedByUsedInOperatingActivitiesDiscontinuedOperations'], ok: true }],
  gp: [{ id: 'gp_calc', s: 'yn', when: (c) => c.gpc },
    { id: 'n_op_int', s: 'n', minus: ['InterestExpenseNonoperating', 'InterestAndDebtExpense', 'InterestExpense'], ok: true }], // Nasdaq מנכה הוצאות ריבית גם מהרווח הגולמי (Nasdaq Inc.) // אין שורת רווח גולמי בדוח — כל מקור מחשב אחרת (Chevron, Honeywell, UnitedHealth) — בחירה: אולי לא להציג
  eps: [{ id: 'y_eps_basic', s: 'y', y: ['BasicEPS'] },
    { id: 'y_unit', s: 'y', unit: true, ok: true }, // Yahoo ביחידה אחרת (למניית ADS) או מחולק במספר שלם (Digital Realty, FirstEnergy: ‏÷4)
    { id: 'y_eps_isbasic', s: 'y', sec: ['EarningsPerShareBasic'], ok: true }, // Yahoo "מדולל" = הבסיסי שבדוח
    { id: 'y_eps_cont', s: 'y', sec: ['IncomeLossFromContinuingOperationsPerDilutedShare', 'IncomeLossFromContinuingOperationsPerBasicAndDilutedShare', 'DilutedEarningsLossPerShareFromContinuingOperations'], flab: /discontinued/i, fsub: true, ok: true }], // Yahoo = מפעילות נמשכת
};
// לכל המדדים: הבדלים מכניים שמאומתים מ־SEC עצמו
const DEFS_ALL = [
  // המקור = השורה שלנו פחות אחד הרכיבים שלה שמודפסים באותו דוח באותה תגית (Deere: Yahoo בלי "Other income" שבתוך "Net sales and revenues")
  { id: 'face_sub', s: 'yn', own: true, ok: true },
  { id: 'n_fx', s: 'n', fx: true, ok: true }, // Nasdaq מתרגם לדולרים (חברה שמדווחת באירו / ביואן): אותו יחס בכל המדדים של התקופה
  { id: 'restated', s: 'yn', orig: true, ok: true }, // המקור = מה שהוגש לראשונה; אנחנו = ההגשה האחרונה (הצגה מחדש)
  { id: 'n_ytd', s: 'n', ytd: true, ok: true }, // Nasdaq ברבעון = המצטבר מתחילת השנה
];

/* ---------- SEC גולמי: אותה תגית, חישוב נפרד ---------- */
// companyfacts → לכל תקופה (start|end או end) הערך מההגשה האחרונה (10-K/10-Q/20-F/40-F ותיקוניהם)
const FORMS = /^(10-K|10-Q|20-F|40-F|10-KT|10-QT)(\/A)?$/;
// adj = { splits, ps } — למניות / רווח למניה: ערך מהגשה שלפני פיצול מוכפל (מניות) / מחולק (רווח למניה) ביחס הפיצול,
// כדי ש־SEC הגולמי יהיה באותו בסיס כמו הערך שלנו אחרי הפיצול (Netflix 10:1 בנובמבר 2025: 2022 מופיע רק בהגשות שלפניו)
function adjFactor(adj, filed) { if (!adj || !adj.splits) return 1; let r = 1; for (const [sd, x] of adj.splits) if (sd > filed && Math.abs(Math.log(x)) > Math.log(1.3)) r *= x; return adj.ps ? 1 / r : r; }
function rawSeries(facts, tag, adj, cur) {
  if (!facts || !tag) return null;
  if (/-/.test(tag)) { // הפרש תגיות (רווח כולל פחות זכויות מיעוט — fundamentals: diffFacts) — כל תקופה ששתיהן קיימות בה
    const [a, b] = tag.split('-').map((t) => rawSeries(facts, t, adj, cur));
    if (!a || !b) return null;
    const dif = (k) => { const M = new Map(); for (const [key, h] of a[k]) { const x = b[k].get(key); if (x) M.set(key, { v: h.v - x.v, filed: h.filed > x.filed ? h.filed : x.filed, v0: h.v0 != null && x.v0 != null ? h.v0 - x.v0 : null }); } return M; };
    return { dur: dif('dur'), inst: new Map(), neg: false };
  }
  if (/\+/.test(tag)) { // סכום תגיות (השקעות הוניות בחלקים) — כל תקופה שכל החלקים קיימים בה
    const parts = tag.split('+').map((t) => rawSeries(facts, t, adj, cur));
    if (parts.some((p) => !p)) return null;
    const sum = (k) => { const M = new Map(); for (const [key, h] of parts[0][k]) { let v = h.v, f = h.filed, okk = true; for (const p of parts.slice(1)) { const x = p[k].get(key); if (!x) { okk = false; break; } v += x.v; if (x.filed > f) f = x.filed; } if (okk) M.set(key, { v, filed: f }); } return M; };
    return { dur: sum('dur'), inst: sum('inst'), neg: parts[0].neg };
  }
  for (const ns of ['us-gaap', 'ifrs-full']) {
    const g = facts.facts && facts.facts[ns] && facts.facts[ns][tag]; if (!g) continue;
    const dur = new Map(), inst = new Map();
    // רק מטבע הדיווח (Nebius: רובל ואחר כך דולר באותה תגית — בלי זה הייחוס מערבב מטבעות)
    const us = Object.keys(g.units || {}), pick = cur ? us.filter((u) => u === cur || u === cur + '/shares') : [];
    // סוף התקופה של כל הגשה בתגית הזו — במאזן, הערך מהדוח השנתי שבמאזן שלו מופיע התאריך (השנה או השנה שלפניה) גובר על
    // דוח שנתי מאוחר בשנתיים (יתרת פתיחה בתזרים / בדוח ההון אחרי הצגה מחדש) — כמו tagFacts ב־fundamentals
    const accEnd = new Map(), accK = (x) => x.accn || x.form + '|' + x.filed;
    for (const u of pick.length ? pick : us) for (const x of g.units[u]) { const a = accK(x), e = accEnd.get(a); if (!e || x.end > e) accEnd.set(a, x.end); }
    for (const u of pick.length ? pick : us) for (const x of g.units[u]) {
      if (!FORMS.test(x.form || '') || x.val == null) continue;
      const key = x.start ? x.start + '|' + x.end : x.end, M = x.start ? dur : inst, h = M.get(key);
      const v = x.val * adjFactor(adj, x.filed);
      // שנה שלמה: דוח שנתי גובר על 10-Q מאוחר שתייג "שנה" עם ערכי רבעון (Comfort Systems 2025: ‏$403M במקום ‏$2.2B; Axon 2021) —
      // אותו כלל של tagFacts בשרתון, אחרת ההשוואה מסמנת "bug" על הערך הנכון (וגם על הרבעון הרביעי שנגזר ממנו)
      const ann = !/^10-Q/.test(x.form), yr = !!x.start && day(x.end) - day(x.start) >= 350;
      // v0/f0 = הערך שהוגש ראשון (בשנה — מדוח שנתי) — "כפי שדווח לראשונה", להשוואה למקור חיצוני שלא עדכן הצגה מחדש
      const first = !h || ((!yr || ann) && (h.f0 == null || x.filed < h.f0));
      if (!h || (yr && h.ann !== ann ? ann : x.filed > h.filed)) M.set(key, { v, filed: x.filed, ann, vk: h && h.vk, fk: h && h.fk, nr: h && h.nr, v0: h && h.v0, f0: h && h.f0 });
      if (first && (!yr || ann)) { const g = M.get(key); g.v0 = v; g.f0 = x.filed; }
      // הערך מהדוח השנתי האחרון — במאזן 10-K גובר על 10-Q מאוחר (המדיניות של fundamentals; Honeywell: 10-Q של 2026 הציג מחדש את 31/12/2025)
      const g2 = M.get(key);
      if (/^(10-K|20-F|40-F|10-KT)/.test(x.form)) {
        const nr = x.start ? 1 : day(accEnd.get(accK(x))) - day(x.end) <= 400 ? 1 : 0;
        if (!g2.fk || (nr !== g2.nr ? nr > g2.nr : x.filed > g2.fk)) { g2.vk = v; g2.fk = x.filed; g2.nr = nr; }
      }
    }
    // סימן התגית: רוב הערכים שליליים (השקעות הוניות שמדווחות במינוס) — לא Math.abs לכל ערך (רבעון "נטו" שלילי אמיתי)
    let n = 0, ng = 0; for (const h of dur.values()) { n++; if (h.v < 0) ng++; }
    return { dur, inst, neg: n > 0 && ng > n / 2 };
  }
  return null;
}
// ערך לתקופה: שנה (s..e ‏~365), רבעון — ישיר (~91) או מצטבר שנה פחות מצטבר קודם (חישוב משלו, בלי לגעת בקוד של השרתון);
// ובסוף שנה בלי מצטבר (חברה שמדווחת רבעונים ישירים): השנה פחות שלושת הרבעונים הישירים שבתוכה
// orig: true = כפי שדווח לראשונה (v0 — השנה מהדוח השנתי הראשון, החלקים מהדוח הראשון שלהם); 'der' = כנ״ל, ורבעון רק מחיסור
// (גם כשיש רבעון ישיר שהוצג מחדש בדוח השנתי — Lennox 2025). למקור חיצוני שלא עדכן הצגה מחדש של החברה.
// 'cum' = הערכים האחרונים, רבעון רק מחיסור (Tractor Supply 2025: "הרבעון הרביעי" ב־10-K תויג עם הרווח של כל השנה)
function rawAt(rs, e, kind, fyStart, k10, orig) {
  if (!rs) return null;
  const V = (h) => (orig && orig !== 'cum' && h.v0 != null ? h.v0 : h.v);
  if (rs.inst.size && !rs.dur.size) { for (const [k, h] of rs.inst) if (Math.abs(day(k) - day(e)) <= 3) return k10 ? (h.vk != null ? h.vk : null) : h.v; return null; }
  const pick = (lo, hi, end) => { let best = null; for (const [k, h] of rs.dur) { const [s, en] = k.split('|'); if (Math.abs(day(en) - day(end)) > 3) continue; const L = day(en) - day(s); if (L >= lo && L <= hi && (!best || h.filed > best.filed)) best = h; } return best; };
  const best = kind === 'A' ? pick(350, 380, e) : orig === 'der' || orig === 'cum' ? null : pick(80, 100, e);
  if (best || kind === 'A' || !fyStart) return best ? V(best) : null;
  // רבעון בלי ערך ישיר: המצטבר עד e פחות המצטבר עד הרבעון הקודם — שניהם מתחילים בתחילת אותה שנה
  let cum = null, prev = null;
  for (const [k, h] of rs.dur) {
    const [s, en] = k.split('|'); if (Math.abs(day(s) - day(fyStart)) > 3) continue;
    const off = day(e) - day(en);
    if (Math.abs(off) <= 3) cum = V(h);
    else if (off >= 80 && off <= 100 && (!prev || h.filed > prev.filed)) prev = { v: V(h), filed: h.filed };
  }
  if (cum != null && day(e) - day(fyStart) < 100) return cum;
  if (cum != null && prev) return cum - prev.v;
  // סוף שנה, רבעונים ישירים בלבד: השנה פחות שלושה רבעונים (כל אחד ~91 יום, בתוך השנה)
  const yr = pick(350, 380, e);
  if (!yr) return null;
  const qs = [];
  for (const [k, h] of rs.dur) { const [s, en] = k.split('|'), L = day(en) - day(s); if (L >= 80 && L <= 100 && day(s) >= day(fyStart) - 3 && day(e) - day(en) >= 80) qs.push([en, h]); }
  const by = new Map(); for (const [en, h] of qs) { const b = by.get(en); if (!b || h.filed > b.filed) by.set(en, h); }
  return by.size === 3 ? V(yr) - [...by.values()].reduce((t, h) => t + V(h), 0) : null;
}
// סכום הרבעונים בתוך השנה (ממוצע מניות / רווח למניה — רק ישירים)
function rawQuarters(rs, e, fyStart, orig) {
  if (!rs || !fyStart) return null;
  const by = new Map();
  for (const [k, h] of rs.dur) { const [s, en] = k.split('|'), L = day(en) - day(s); if (L >= 80 && L <= 100 && day(s) >= day(fyStart) - 3 && day(e) - day(en) >= 80) { const b = by.get(en); if (!b || h.filed > b.filed) by.set(en, h); } }
  return by.size === 3 ? [...by.values()].map((h) => (orig && h.v0 != null ? h.v0 : h.v)) : null;
}

// כל הערכים שהוגשו לתקופה בתגית אחת (כל ההגשות, במטבע הדיווח): שנה ~365 יום, רבעון ~91, מאזן — נקודה; cum = מצטבר 6/9 חודשים
function rawAll(facts, tag, e, kind, cur, bal, cum) {
  const out = [];
  if (!facts || !tag || /\+/.test(tag)) return out;
  for (const ns of ['us-gaap', 'ifrs-full']) {
    const g = facts.facts && facts.facts[ns] && facts.facts[ns][tag]; if (!g) continue;
    const us = Object.keys(g.units || {}), pick = cur ? us.filter((u) => u === cur || u === cur + '/shares') : [];
    for (const u of pick.length ? pick : us) for (const x of g.units[u]) {
      if (!FORMS.test(x.form || '') || x.val == null || Math.abs(day(x.end) - day(e)) > 3) continue;
      if (bal) { if (!x.start) out.push({ v: x.val, f: x.filed }); continue; }
      if (!x.start) continue;
      const L = day(x.end) - day(x.start);
      if (cum ? L >= 170 && L <= 290 : kind === 'A' ? L >= 350 && L <= 380 : L >= 80 && L <= 100) out.push({ v: x.val, f: x.filed });
    }
    break;
  }
  return out;
}

/* "הוצג מחדש": הערכים מהגשות שקדמו להגשה שממנה הערך שלנו. רק כשההגשה שלנו היא דוח שבו התקופה מופיעה כעמודת השוואה
   (שנה — עד שלוש שנים בדוח השנתי; רבעון / מאזן — שנה אחת): ערך של תקופה ישנה מהגשה מאוחרת בהרבה הוא מבאור (טבלת 5 שנים,
   באור חכירות) — AvalonBay 2022: ‏"OperatingLeaseLeaseIncome" ‏$3.09B מהדוח של 2025, במקום ההכנסות של 2022 */
function origVals(all, ours, e, kind, bal, m) {
  let f0 = null; for (const x of all) if (same(m, x.v, ours, 0) && (!f0 || x.f > f0)) f0 = x.f;
  if (!f0 || day(f0) - day(e) > (kind === 'A' && !bal ? 2 * 366 + 130 : 366 + 130)) return [];
  return all.filter((x) => x.f < f0).map((x) => x.v);
}

/* ---------- ההשוואה ---------- */
// המזומן המוגבל שמחוסר מהסך הכולל כשאין שורת מאזן (RCASH ב־fundamentals.js — אותן קבוצות, אותו סדר)
const CASH_RESTR = [['RestrictedCashCurrent', 'RestrictedCashNoncurrent'], ['RestrictedCashAndCashEquivalentsCurrent', 'RestrictedCashAndCashEquivalentsNoncurrent'],
  ['RestrictedCash'], ['RestrictedCashAndCashEquivalentsAtCarryingValue']];
const XK = ['rev', 'gp', 'op', 'ni', 'eps', 'sh', 'ocf', 'capex', 'cash', 'ta', 'tl', 'eq', 'ca', 'cl'];
const BAL = new Set(['cash', 'ta', 'tl', 'eq', 'ca', 'cl']);
// כותרת שורה בדוח שמתאימה למדד (לזיהוי הערך שלנו כשהחברה הדפיסה אותו בתגית אחרת)
const FLAB = { rev: /revenue|sales/i, gp: /gross/i, op: /operat|income from/i, ni: /net (income|earnings|loss)|profit/i, eps: /per share|diluted/i, sh: /shares|diluted/i,
  ocf: /operating/i, capex: /property|capital|equipment|plant|additions/i, cash: /^cash/i, ta: /^total assets|^assets$/i, tl: /^total liabilities|^liabilities$/i,
  eq: /equity/i, ca: /current assets/i, cl: /current liabilities/i };
const FST = { rev: 'is', gp: 'is', op: 'is', ni: 'is', eps: 'is', sh: 'is', ocf: 'cf', capex: 'cf', cash: 'bs', ta: 'bs', tl: 'bs', eq: 'bs', ca: 'bs', cl: 'bs' };
const YK = { ni: 'ni' }; // Yahoo: NetIncomeCommonStockholders — מול nic כשיש
// ערך שלנו שמחושב בנוסחה (לא תגית אחת) — אותה נוסחה מ־SEC הגולמי
// (כמו "שורות מחושבות" ב־normalizeSec; ההון — כולל זכויות מיעוט כשיש לתקופה, אחרת של בעלי המניות)
function rawFormula(m, d, at) {
  const t = d.tags || {};
  if (m === 'gp' && t.rev && t.cogs) { const a = at(t.rev), b = at(t.cogs); return a != null && b != null ? { v: a - b, rf: 'rev-cogs' } : null; }
  if (m === 'tl' && t.tle && (t.eqt || t.eq)) {
    const a = at(t.tle), b = (t.eqt && at(t.eqt)) ?? (t.eq ? at(t.eq) : null), c = t.tmp ? at(t.tmp) : 0;
    return a != null && b != null ? { v: a - b - (c || 0), rf: 'tle-eq' } : null;
  }
  return null;
}
// הפיצולים שהשרתון החיל (splitsUsed: מ־Yahoo אחרי הוכחה + מה ש־SEC עצמו מראה — Honeywell 1:2) — לא כל הרשימה של
// Yahoo: פיצול חברה (DuPont/Qnity 2.39) היה "מתקן" את SEC הגולמי ומסמן את הערך הנכון שלנו כ־bug
const splitsOf = (d) => d.splitsUsed || d.splits;
// פיצולים אחרי התקופה (יחס מצטבר) — לזיהוי spl
function splitRatioAfter(splits, e) { let r = 1; for (const [sd, x] of splits || []) if (sd > e && Math.abs(Math.log(x)) > Math.log(1.3)) r *= x; return r; }
// הסבר מהמילון: האם ההבדל מול המקור s ידוע. ctx = { ya (Yahoo גולמי לתקופה), nq (Nasdaq לתקופה), sec(tag) → ערך גולמי }
function explain(m, s, ours, ext, ctx, sc) {
  for (const D of (DEFS[m] || []).concat(DEFS_ALL)) {
    if (!D.s.includes(s)) continue;
    if (D.when) { if (D.when(ctx)) return D; continue; }
    if (D.when0 && !D.when0(ctx)) continue;
    if (D.lim && ours && ext && Math.max(Math.abs(ours / ext), Math.abs(ext / ours)) > D.lim) continue;
    let hit = false;
    if (s === 'y' && D.y) for (const ty of D.y) { const v = ctx.ya && ctx.ya[ty]; if (v != null && same(m, ours, D.abs ? Math.abs(v) : v, sc)) hit = true; }
    if (s === 'n' && D.n) for (const k of D.n) { const v = ctx.nq && ctx.nq[k]; if (v != null && same(m, ours, v, sc)) hit = true; }
    if (!hit && D.sec) for (const tag of D.sec) { const v = ctx.sec(tag); if (v != null && same(m, Math.abs(ext), Math.abs(v), sc)) hit = true; }
    if (!hit && D.plus) {
      const vs = D.plus.map((tag) => ctx.sec(tag)).filter((v) => v != null);
      if (vs.some((v) => same(m, Math.abs(ext), Math.abs(ours) + Math.abs(v), sc)) || (vs.length > 1 && same(m, Math.abs(ext), Math.abs(ours) + vs.reduce((t, v) => t + Math.abs(v), 0), sc))) hit = true;
    }
    // המקור = אנחנו פחות תגית (Nasdaq: רווח תפעולי אחרי הוצאות ריבית)
    if (!hit && D.minus) for (const tag of D.minus) { const v = ctx.sec(tag); if (v != null && v !== 0 && same(m, ext, ours - Math.abs(v), sc)) hit = true; }
    // המקור = חלק מהסכום שלנו (השקעות הוניות: רכוש קבוע + תוכנה — המקור רק את השורה הראשונה)
    if (!hit && D.part && ctx.parts && ctx.parts.length > 1) {
      const pv = ctx.parts.map((t) => ctx.sec(t));
      if (pv.every((v) => v != null)) for (let b = 1; b < (1 << pv.length) - 1 && !hit; b++) { let t = 0; pv.forEach((v, i) => { if (b & (1 << i)) t += Math.abs(v); }); if (same(m, Math.abs(ext), t, sc)) hit = true; }
    }
    // המקור = מה שהוגש לראשונה, לפני הצגה מחדש (אותה תגית, אותה תקופה, הגשה מוקדמת יותר)
    if (!hit && D.orig && ctx.orig) for (const v of ctx.orig()) if (same(m, ext, v, sc) && !same(m, ours, v, sc)) hit = true;
    // Nasdaq בדולרים (חברה שמדווחת במטבע אחר): היחס = שער ההמרה של התקופה, אותו יחס כמו בשאר המדדים
    if (!hit && D.fx && ctx.fx && ours && Math.abs(ext / ours / ctx.fx - 1) <= 0.015) hit = true;
    // יחידה אחרת למניה (ADS = כמה מניות, או Yahoo שמחלק / מכפיל במספר שלם): היחס מספר שלם 2–20
    if (!hit && D.unit && ours && ext && Math.sign(ours) === Math.sign(ext)) {
      const q = m === 'sh' ? ext / ours : ours / ext, k = q >= 1 ? q : 1 / q, kr = Math.round(k);
      if (kr >= 2 && kr <= 20 && Math.abs(k / kr - 1) <= 0.01) hit = true;
    }
    // Yahoo: הערך שלנו = סכום של שני שדות שלו (מזומן + מזומן מוגבל — Yahoo מפריד את המוגבל מהשורה שבמאזן)
    if (!hit && s === 'y' && D.ysum && ctx.ya) for (const fl of D.ysum) { const vs = fl.map((f) => ctx.ya[f]); if (vs.every((v) => v != null) && same(m, Math.abs(ours), vs.reduce((t, v) => t + Math.abs(v), 0), sc)) hit = true; }
    // המקור = הערך שלנו ועוד / פחות שורה שמודפסת באותו דוח שהכותרת שלה מתאימה (תגית פרטית של החברה — אין אותה ב־companyfacts)
    if (!hit && D.flab && ctx.face) for (const fr of ctx.face.rows) { if (!D.flab.test(fr.label) || fr.mine || Math.abs(fr.v) < 0.002 * Math.abs(ours)) continue; if (fsame(Math.abs(ext), Math.abs(ours) + Math.abs(fr.v)) || (D.fsub && fsame(Math.abs(ext), Math.abs(ours) - Math.abs(fr.v))) || (D.fone && fsame(Math.abs(ext), Math.abs(fr.v)))) hit = true; }
    if (!hit && D.own && ctx.face) { const mine = ctx.face.rows.filter((fr) => fr.mine && !fsame(Math.abs(fr.v), Math.abs(ours))); if (mine.some((fr) => fsame(Math.abs(ext), Math.abs(ours) - Math.abs(fr.v)))) hit = true; }
    // Nasdaq בקנה מידה שגוי (פי אלף) / ערך מוחלט של השקעה נטו שלילית
    if (!hit && D.scale && ours && ext) { const q = Math.abs(ext / ours); if ([1e3, 1e-3, 1e6, 1e-6].some((f) => Math.abs(q / f - 1) <= 0.03)) hit = true; }
    if (!hit && D.abs1 && ours < 0 && ext > 0 && same(m, -ours, ext, sc)) hit = true;
    // Nasdaq ברבעון = המצטבר מתחילת השנה (6 / 9 חודשים) של אותה תגית
    if (!hit && D.ytd && ctx.cum) for (const v of ctx.cum()) if (same(m, Math.abs(ext), Math.abs(v), sc) && !same(m, ours, v, sc)) hit = true;
    if (hit) return D;
  }
  return null;
}

// אומדן לערך שאין לו מקור — רק למניות ולרווח למניה (לא מצטברים, אז SEC לא מדווח רבעון רביעי):
// רבעון רביעי = השנה פחות שלושה רבעונים (מניות: 4 × ממוצע השנה פחות שלושה); אחרת רווח למניה = רווח (לבעלי המניות) ÷ מניות, מ־SEC
// ממוצע מניות שהחברה הגישה בקנה מידה שגוי (McDonald's: ‏"721.9"; EchoStar: רבעונים באלפים והשנה ביחידות) — באותו קנה מידה
// כמו הממוצע השנתי שלנו (שתוקן — fixes) לפני החישוב, אחרת האומדן הוא ‏720 מניות או ערבוב של שני קני מידה
function shScale(v, ref) {
  if (!(v > 0) || !(ref > 0)) return v;
  let b = 1; for (const f of [1e-6, 1e-3, 1, 1e3, 1e6]) if (Math.abs(Math.log(v * f / ref)) < Math.abs(Math.log(v * b / ref))) b = f;
  return Math.abs(Math.log(v * b / ref)) < Math.log(1.5) ? v * b : v;
}
const shRef = (d, e) => { const i = d.fy ? d.fy.indexOf(e) : -1; return i >= 0 && d.A && d.A.sh ? d.A.sh[i] : null; };
// orig — השנה והרבעונים כפי שדווחו לראשונה (International Flavors 2024: השנה הוצגה מחדש בדוח של 2025 — ‎−0.18 כמו שפורסם, לא ‎−0.08)
function estimate(m, kind, e, rs, d, facts, adj, fyS, fs0, secAt, orig) {
  if (!NOSUM.has(m) || m === 'dps') return null;
  if (kind === 'Q' && rs && d.fy.includes(e)) {
    let a = rawAt(rs, e, 'A', null, null, orig), qs = rawQuarters(rs, e, fyS(e), orig);
    if (m === 'sh' && a != null && qs) { const ref = shRef(d, e); a = shScale(a, ref); qs = qs.map((x) => shScale(x, ref)); }
    if (a != null && qs) return m === 'sh' ? 4 * a - qs.reduce((t, x) => t + x, 0) : a - qs.reduce((t, x) => t + x, 0);
  }
  if (m !== 'eps' || !facts) return null;
  const t = d.tags || {};
  const ni = (t.nic && secAt(t.nic, e, kind, fs0)) ?? (t.ni ? secAt(t.ni, e, kind, fs0) : null);
  const shr = t.sh ? rawSeries(facts, t.sh, { splits: splitsOf(d) }) : null;
  const ref = shRef(d, (d.fy || []).find((x) => day(x) >= day(e) - 1 && day(x) - day(e) < 366) || e);
  let sh = shr ? shScale(rawAt(shr, e, kind), ref) : null;
  if (sh == null && kind === 'Q' && shr && d.fy.includes(e)) { const a = shScale(rawAt(shr, e, 'A'), ref), qs = rawQuarters(shr, e, fyS(e)); if (a != null && qs) sh = 4 * a - qs.reduce((x, y) => x + shScale(y, ref), 0); }
  return ni != null && sh ? ni / sh : null;
}

// רבעון רביעי של ממוצע מניות כשיש הפסד באחד הרבעונים (fundamentals: q4Shares): המדולל לא מצטבר, אז fundamentals מחשב
// מהבסיסי — 4 × השנה פחות שלושה — ועוד עד 4 × הדילול של השנה. הטווח הזה מ־SEC הגולמי (Uber, DoorDash, IBM 2024: בתוכו
// ותואם להודעה לעיתונות; האומדן המדולל רחוק ממנה ב־3%–10%)
function shBand(e, d, facts, adj, fyS) {
  const rb = rawSeries(facts, 'WeightedAverageNumberOfSharesOutstandingBasic', adj) || rawSeries(facts, 'WeightedAverageShares', adj);
  const rd = d.tags && d.tags.sh ? rawSeries(facts, d.tags.sh, adj) : null;
  if (!rb || !rd) return null;
  const ref = shRef(d, e), ab = shScale(rawAt(rb, e, 'A'), ref), qb0 = rawQuarters(rb, e, fyS(e)), ad = shScale(rawAt(rd, e, 'A'), ref);
  if (ab == null || !qb0 || ad == null) return null;
  const qb = qb0.map((x) => shScale(x, ref));
  const b4 = 4 * ab - qb.reduce((t, x) => t + x, 0);
  return b4 > 0 ? [b4, b4 + Math.max(0, 4 * (ad - ab))] : null;
}
/* d = תשובת fundamentals (src sec), facts = companyfacts, y = parseYahooTs, nq = { A: parseNasdaq(שנתי), Q: parseNasdaq(רבעוני) },
   opt.cand = { m: [תגיות מועמדות] } (רשות — F.TAGS; בלעדיו רק התגית הראשית), opt.ya = parseYahooAlt (רשות — בלעדיו אין הגדרות Yahoo חלופיות ואין זיהוי של רבעון רביעי ש־Yahoo לא פרסם)
   מחזיר רשימת ערכים: { m, k:'A'|'Q', p, v, raw, y, n, face, c, why?, rf?, est?, yd?, yf?, near? } — c = ההכרעה */
function xcheck(d, facts, y, nq, opt = {}) {
  const out = [];
  if (!d || !d.ok || !d.tags) return out;
  const nA = opt.nA || 5, nQ = opt.nQ || 8, YA = opt.ya || null;
  const faceBad = new Set((d.checks || []).filter((c) => c.k === 'face').map((c) => c.m + '|' + c.p));
  // השנה הפתוחה (אחרי השנה האחרונה) מתחילה ביום שאחרי סוף השנה האחרונה — אחרת לרבעונים שלה אין ייחוס מ־SEC
  const nextD = (e) => new Date((day(e) + 1) * DAY).toISOString().slice(0, 10);
  const fyS = (e) => { if (e === 'open') return nextD(d.fy[d.fy.length - 1]); const i = d.fy.indexOf(e); return i > 0 ? nextD(d.fy[i - 1]) : null; };
  const fyOf = (qe) => d.fy.find((e) => day(e) >= day(qe) - 1 && day(e) - day(qe) < 366) || (d.fy.length && day(qe) > day(d.fy[d.fy.length - 1]) ? 'open' : undefined);
  const scaleA = (i) => Math.abs((d.A.rev && d.A.rev[i]) || 0);
  const fin = d.sic >= 6000 && d.sic < 6500; // בנקים, ברוקרים, ביטוח — Yahoo/Nasdaq מתקננים את הדוחות שלהם אחרת
  const fill = new Set(d.fill || []); // שורות שהושלמו מ־Yahoo (אין ב־SEC) — Yahoo הוא המקור שלהן, לא בדיקה
  // "שנים" שהן לא שנה (Amazon: דוחות רבעוניים עם 12 חודשים אחרונים — כל רבעון נראה כסוף שנה)
  const ttm = new Set(d.fy.filter((e, i) => i > 0 && day(e) - day(d.fy[i - 1]) < 300));
  const rsCache = {}, secAt = (tag, e, kind, fs) => { if (!(tag in rsCache)) rsCache[tag] = rawSeries(facts, tag, null, d.cur); return rawAt(rsCache[tag], e, kind, fs); };
  // הדוח השנתי האחרון כפי שהודפס (opt.face = secFace): לכל מדד ושנה — השורות של אותו דוח באותה עמודה
  const faceAt = (m, e) => {
    const S = opt.face && opt.face[FST[m]]; if (!S || !S.cols || !S.rows) return null;
    const bal = FST[m] === 'bs', i = S.cols.findIndex((c) => Math.abs(day(c.end) - day(e)) <= 8 && (bal || c.months == null || c.months === 12) && SF.colOk(c, d.cur));
    if (i < 0) return null;
    const rows = []; for (const r of S.rows) { const v = SF.rowVals(S, r)[i]; if (v != null) rows.push({ tag: r.tag, label: r.label || '', v }); }
    return rows.length ? { rows } : null;
  };
  // Nasdaq בדולרים לחברה שמדווחת במטבע אחר (ASML, CCEP, PDD): לכל תקופה — היחס החציוני Nasdaq ÷ שלנו על פני כל המדדים (= שער ההמרה)
  const fxAt = { A: {}, Q: {} };
  if (d.cur && d.cur !== 'USD' && nq) for (const kind of ['A', 'Q']) {
    const N = nq[kind], ends = kind === 'A' ? d.fy : d.q, D = kind === 'A' ? d.A : d.Q; if (!N) continue;
    ends.forEach((e, i) => {
      const ni = nearEnd(N.ends, e, 20); if (ni < 0) return;
      const rs = [];
      for (const m of XK) { if (NOSUM.has(m) || !D[m] || !D[m][i]) continue; const v = (N.v[m === 'ni' ? 'nic' : m] || {})[N.ends[ni]]; if (v) rs.push(v / D[m][i]); }
      rs.sort((a, b) => a - b);
      if (rs.length >= 3) { const md = rs[rs.length >> 1]; if (Math.abs(md - 1) > 0.02 && rs.filter((x) => Math.abs(x / md - 1) <= 0.015).length >= rs.length / 2) fxAt[kind][e] = md; }
    });
  }
  for (const kind of ['A', 'Q']) {
    const ends = kind === 'A' ? d.fy : d.q, D = kind === 'A' ? d.A : d.Q;
    const from = Math.max(0, ends.length - (kind === 'A' ? nA : nQ));
    for (const m of XK) {
      if (!D[m]) continue;
      const adj = NOSUM.has(m) ? { splits: splitsOf(d), ps: PER_SHARE.has(m) } : null;
      // שורה שהשרתון הוריד בכוונה (opx / gpx: לא בדוח רווח והפסד, או עלות מכר חלקית) — התגית לא מקור אמת להשוואה
      const dropped = (m === 'op' && d.opx === 'off') || (m === 'gp' && (d.gpx === 'part' || d.gpx === 'off'));
      const cur = m === 'sh' ? null : d.cur, tag = d.tags[m], rs = dropped ? null : rawSeries(facts, tag, adj, cur);
      // תגיות חלופיות (מועמדות ב־fundamentals — mergeTags משלים מהן תקופות שאין בתגית הראשית)
      const alts = dropped ? [] : ((opt.cand && opt.cand[m]) || []).filter((t) => t !== tag).map((t) => [t, rawSeries(facts, t, adj, cur)]).filter(([, x]) => x);
      for (let i = from; i < ends.length; i++) {
        const e = ends[i];
        let v = D[m][i]; if (v == null) continue;
        if (m === 'ni' && D.nic && D.nic[i] != null) v = { v, c: D.nic[i] }; // רווח לבעלי המניות — מול Yahoo/Nasdaq
        const vv = typeof v === 'object' ? v.v : v, vc = typeof v === 'object' ? v.c : v;
        const sc = kind === 'A' ? scaleA(i) : scaleA(d.fy.length - 1) / 4;
        const fs0 = kind === 'A' || BAL.has(m) ? null : fyS(fyOf(e)) || null;
        let raw = null, rf = null;
        // רווח למניה וממוצע מניות לא מצטברים — רק ערך ישיר (בלי שנה פחות 9 חודשים)
        const fsr = NOSUM.has(m) ? null : fs0;
        let rsU = rs;
        if (rs) raw = rawAt(rs, e, kind, fsr);
        // תגית משלימה: זו שתואמת אותנו (mergeTags בוחר לפי ההתאמה לראשית — CME: ‏ProfitLoss לפני הרווח לבעלי המניות), אחרת הראשונה שיש לה ערך
        if (raw == null) {
          const cs = alts.map(([t, x]) => [t, x, rawAt(x, e, kind, fsr)]).filter((c) => c[2] != null);
          const c = cs.find((c2) => same(m, vv, c2[2], sc)) || cs[0];
          if (c) { rf = c[0]; rsU = c[1]; raw = c[2]; }
        }
        // ערך שחושב מכמה הגשות (רבעון = שנה פחות תשעה חודשים) כשהחברה הציגה מחדש רק חלק מהן: fundamentals לוקח את שניהם
        // כפי שדווחו לראשונה (subPick — International Flavors 2024: ‎−46, כמו בהודעה לעיתונות; החישוב הפשוט: ‎−26)
        if (raw != null && rsU && !NOSUM.has(m) && m !== 'capex' && kind === 'Q' && !same(m, vv, raw, sc)) {
          const ro = ['cum', true].map((o) => [o, rawAt(rsU, e, kind, fsr, null, o)]).find(([, x]) => x != null && same(m, vv, x, sc));
          if (ro) { raw = ro[1]; rf = (rf ? rf + '·' : '') + (ro[0] === 'cum' ? 'cum' : 'orig'); }
        }
        if (raw == null && facts && !dropped) { const f = rawFormula(m, d, (t) => secAt(t, e, kind, BAL.has(m) ? null : fs0)); if (f) { raw = f.v; rf = f.rf; } }
        if (raw != null && m === 'capex' && rs && rs.neg && !rf) raw = -raw;
        else if (raw != null && m === 'capex' && rf) raw = Math.abs(raw);
        // רבעון מחושב שלילי של השקעה ברוטו (שנה פחות 9 חודשים מבסיסים שונים) — לא ייחוס
        if (raw != null && m === 'capex' && kind === 'Q' && raw < 0 && vv >= 0) raw = null;
        const rawK = BAL.has(m) && rs && !rf ? rawAt(rs, e, kind, null, true) : null;
        const yi = y && nearEnd(kind === 'A' ? y.fy : y.q, e, 20), ys = y && (kind === 'A' ? y.A : y.Q);
        let yv = yi >= 0 && ys && ys[YK[m] || m] ? ys[YK[m] || m][yi] : null;
        const ya = YA ? Object.fromEntries(Object.entries(YA[kind]).map(([t, o]) => [t, nearKey(o, e)]).filter(([, x]) => x != null)) : null;
        // רבעון רביעי ש־Yahoo לא פרסם וחושב ב־parseYahooTs (שנה − 3 רבעונים; למניות — ממוצע שלושת האחרים): לא מקור למניות / רווח למניה
        const yd = !!(ya && yv != null && kind === 'Q' && ya[YPRIM[m]] == null);
        if (yd && NOSUM.has(m)) yv = null;
        const yf = kind === 'A' && fill.has(m) && raw == null;
        const N = nq && nq[kind], ni = N ? nearEnd(N.ends, e, 20) : -1;
        const nk = m === 'ni' ? 'nic' : m;
        let nv = ni >= 0 && N.v[nk] ? N.v[nk][N.ends[ni]] ?? null : null;
        const nqAt = ni >= 0 ? Object.fromEntries(Object.entries(N.v).map(([k, o]) => [k, o[N.ends[ni]]]).filter(([, x]) => x != null)) : null;
        const face = faceBad.has(m + '|' + e) ? false : null;
        // derived = רבעונים מחושבים (גם רבעון רביעי, שמסתיים בסוף השנה) — לא השנה עצמה
        const r = { m, k: kind, p: e, v: vv, raw, y: yv, n: nv, face, der: kind === 'Q' && !!(d.derived && d.derived[m] && d.derived[m].includes(e)) };
        if (rf) r.rf = rf; if (yd) r.yd = 1; if (yf) r.yf = 1;
        // ni: מול Yahoo/Nasdaq גם הרווח הכולל וגם הרווח לבעלי המניות — Nasdaq ‏"Applicable to Common" לפעמים = הכולל
        const sm = (a) => (a == null ? null : same(m, vc, a, sc) || (m === 'ni' && same(m, vv, a, sc)) ? true : false);
        const srMain = same(m, vv, raw, sc), srK = rawK != null ? same(m, vv, rawK, sc) : null;
        let sr = srMain === true || srK === true ? true : srMain;
        // מאזן: הערך שלנו נבחר לכל תאריך מכמה תגיות (מזומן — cashMerge): תואם דוח שנתי של תגית מועמדת אחרת, או את הסך הכולל
        // מזומן מוגבל פחות המזומן המוגבל (Chevron) — SEC מאשר
        if (sr === false && BAL.has(m)) {
          // ישירות מ־inst (rawAt מדלג על inst כשלתגית יש גם ערכי תקופה — Zoetis); רק ערך מדוח שנתי
          const k10 = (x) => { for (const [kk, h] of x.inst) if (Math.abs(day(kk) - day(e)) <= 3) return h.vk != null ? h.vk : null; return null; };
          const hit = alts.find(([, x]) => same(m, vv, k10(x), sc));
          if (hit) { sr = true; r.rf = hit[0]; }
          else if (m === 'cash') {
            const tot = secAt('CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents', e, kind, null);
            for (const grp of CASH_RESTR) {
              const xs = grp.map((t) => secAt(t, e, kind, null)).filter((x) => x != null);
              if (!xs.length) continue;
              if (tot != null && same(m, vv, tot - xs.reduce((a, b) => a + b, 0), sc)) { sr = true; r.rf = 'cash-restr'; }
              break;
            }
          }
        }
        const sn = sm(nv), syRaw = sm(yv), sy = yf ? null : syRaw, yn = same(m, yv, nv, sc);
        // השנה בדוח המודפס: השורות שלנו (לפי התגית) מסומנות mine; printed = הערך שלנו הוא בדיוק השורה (או סכום השורות) שהחברה הדפיסה
        // רווח נקי: מול המקורות משווים את הרווח לבעלי המניות (nic) — אז גם בדוח בודקים אותו (PNC: ‏"לבעלי המניות" המודפס ≠ התגית המדוללת שלנו)
        const useNic = m === 'ni' && vc !== vv && d.tags.nic, ftag = useNic ? d.tags.nic : tag, fval = useNic ? vc : vv;
        const parts = ftag ? ftag.split('+') : [], fc = kind === 'A' && !rf && ftag && !dropped ? faceAt(m, e) : null;
        let printed = false;
        if (fc) {
          for (const fr of fc.rows) if (parts.includes(fr.tag)) fr.mine = true;
          const pv = parts.map((t) => { const fr = fc.rows.find((x) => x.tag === t); return fr ? fr.v : null; });
          printed = pv.every((v) => v != null) && (PER_SHARE.has(m) ? same(m, fval, pv[0], 0) : fsame(Math.abs(fval), pv.reduce((t, v) => t + Math.abs(v), 0)));
          // אותו ערך בשורה אחרת של הדוח שהכותרת שלה מתאימה למדד (ASML: המזומן מודפס בתגית של "כולל מוגבל", אצלנו מהבאור באותו סכום)
          if (!printed && parts.length === 1) printed = fc.rows.some((fr) => FLAB[m] && FLAB[m].test(fr.label) && (PER_SHARE.has(m) ? same(m, fval, fr.v, 0) : fsame(Math.abs(fval), Math.abs(fr.v))));
        }
        const ctx = { ya, nq: nqAt, face: fc, sec: (t) => secAt(t, e, kind, BAL.has(m) ? null : fs0), fin, gpc: m === 'gp' && (rf === 'rev-cogs' || !d.tags.gp),
          reit: d.sic === 6798, parts: tag && /\+/.test(tag) ? tag.split('+') : null, fx: fxAt[kind][e] || null,
          orig: () => origVals(rawAll(facts, rf ? null : tag, e, kind, cur, BAL.has(m)), vv, e, kind, BAL.has(m), m),
          cum: () => (kind === 'Q' && !BAL.has(m) && !NOSUM.has(m) ? rawAll(facts, tag, e, kind, cur, false, true).map((x) => x.v) : []) };
        // מספר מניות שהחברה הגישה בקנה מידה שגוי ותוקן אצלנו (fixes) — SEC הגולמי פי אלף / מיליון קטן
        const fixd = sr === false && m === 'sh' && raw > 0 && [1e3, 1e6, 1e-3, 1e-6].some((f) => Math.abs(vv / raw / f - 1) < 0.02); // Waters: SEC הגולמי פי אלף גדול
        // חברה זרה (20-F/40-F): Yahoo לפי ADS — מספר מניות רגילות שלם לכל ADS (PDD: 4) — מניות חלקי היחס, רווח למניה כפול היחס
        const adsR = NOSUM.has(m) && yv && vv && d.face && /^(20-F|40-F)/.test(d.face.form || '') ? (m === 'sh' ? vv / yv : yv / vv) : 0;
        const ads = adsR >= 1.9 && sn !== true && Math.abs(adsR / Math.round(adsR) - 1) < 0.01 && (sr !== false || fixd);
        // פיצול: היחס מול מקור חיצוני = הפיצולים שאחרי התקופה (או ההפך) — אנחנו לא החלנו / החלנו פעמיים
        const spr = NOSUM.has(m) ? splitRatioAfter(splitsOf(d), e) : 1;
        const splitOff = (x) => { if (spr === 1 || x == null || !vv || !x) return false; const q = m === 'sh' ? x / vv : vv / x; return Math.abs(q / spr - 1) < 0.03 || Math.abs(q * spr - 1) < 0.03; };
        // ההסבר לכל מקור שונה
        const ex = {};
        for (const [s, ok, val] of [['y', sy, yv], ['n', sn, nv]]) if (ok === false) ex[s] = explain(m, s, m === 'ni' ? vv : vc, val, ctx, sc);
        const okS = (s, ok) => ok !== false || (ex[s] && ex[s].ok);
        if (ttm.has(e) && kind === 'A') { r.c = 'bug'; r.why = 'ttm'; }
        // שורה שהושלמה מ־Yahoo (אין ב־SEC): Yahoo הוא המקור שלה — רק Nasdaq יכול לאשר
        else if (yf && sn !== true) { r.c = 'yfill'; if (sn === false) r.nd = 1; }
        else if (ads) { r.c = 'okd'; r.why = 'y_ads'; }
        else if (fixd) r.c = sy === false || sn === false ? 'one' : 'fix';
        else if (splitOff(raw) || splitOff(yv) || splitOff(nv)) { r.c = 'spl'; r.why = 'split_' + Math.round(spr * 1000) / 1000; }
        else if (sr === false || face === false) r.c = 'bug';
        else if (okS('y', sy) && okS('n', sn)) {
          if (sy == null && sn == null && sr == null) {
            // אין מקור: רבעון רביעי של רווח למניה / ממוצע מניות — אומדן מ־SEC: השנה פחות שלושה רבעונים
            let est = estimate(m, kind, e, rs, d, facts, adj, fyS, fs0, secAt);
            if (est != null) {
              // רווח למניה: סכום רבעונים ≠ שנה כשמספר המניות זז / יש הפסד ברבעון — עד 5 סנט או 5%; מניות — 1%
              const near = (x) => x != null && (m === 'sh' ? relDiff(vv, x) <= 0.01 : Math.abs(vv - x) <= Math.max(0.05, 0.05 * Math.abs(vv)));
              let okE = near(est);
              if (!okE) { const eo = estimate(m, kind, e, rs, d, facts, adj, fyS, fs0, secAt, true); if (near(eo)) { okE = true; est = eo; r.why = 'est_orig'; } }
              r.est = m === 'sh' ? Math.round(est) : Math.round(est * 1000) / 1000;
              const band = !okE && kind === 'Q' && d.fy.includes(e) ? shBand(e, d, facts, { splits: splitsOf(d) }, fyS) : null;
              if (band) {
                if (m === 'sh') okE = vv >= band[0] * 0.99 && vv <= band[1] * 1.01;
                else {
                  const t = d.tags || {}, ni = (t.nic && secAt(t.nic, e, kind, fs0)) ?? (t.ni ? secAt(t.ni, e, kind, fs0) : null), tol = Math.max(0.05, 0.05 * Math.abs(vv));
                  if (ni != null) { const xs = band.map((b) => ni / b); okE = vv >= Math.min(...xs) - tol && vv <= Math.max(...xs) + tol; }
                }
                if (okE) r.why = 'q4_basic';
              }
              r.c = okE ? 'est' : 'estx';
            } else r.c = 'none';
          } else {
            const exp = Object.values(ex).find((x) => x && x.ok);
            if (exp) { r.c = 'okd'; r.why = exp.id; } else r.c = 'ok';
          }
        } else {
          const fy = sy === false && !(ex.y && ex.y.ok), fn = sn === false && !(ex.n && ex.n.ok);
          const why = (fy && ex.y && ex.y.id) || (fn && ex.n && ex.n.id) || null;
          // שני המקורות החיצוניים קרובים זה לזה (עד 5%), באותו צד שלנו, ורחוקים מאיתנו פי 2 מהמרחק ביניהם — לא "הגדרה" של אחד מהם
          const close = fy && fn && yv != null && nv != null && (yn === true || (relDiff(yv, nv) <= 0.05 && Math.sign(yv - vc) === Math.sign(nv - vc) &&
            Math.abs(vc - (yv + nv) / 2) > 2 * Math.abs(yv - nv)));
          // המקור החיצוני = הרבעון כפי שדווח לראשונה, והחברה הציגה אותו מחדש מאז (בדרך כלל בדוח השנתי — Alnylam, Lennox,
          // Monolithic Power 2025: תשעה חודשים מתוקנים ב־10-K, וההודעה לעיתונות של Alnylam = אנחנו). אנחנו = ההגשה האחרונה
          const orig = sr === true && kind === 'Q' && rsU && !NOSUM.has(m) && m !== 'capex' ? [true, 'der'].map((o) => rawAt(rsU, e, kind, fsr, null, o)).filter((x) => x != null && !same(m, vv, x, sc)) : [];
          if ((fy || fn) && orig.some((x) => (fy && same(m, yv, x, sc)) || (fn && same(m, nv, x, sc)))) { r.c = 'okd'; r.why = 'q_orig'; }
          else if (close) { r.c = sr === true ? 'ext' : 'one'; if (yn !== true) r.xl = 1; }
          else if (sr === true || sy === true || sn === true || (ex.y && ex.y.ok) || (ex.n && ex.n.ok)) r.c = 'def'; // SEC או מקור חיצוני אחר מאשר אותנו
          else {
            // מקור אחד ושונה, בלי SEC: האומדן מ־SEC (רבעון רביעי של מניות / רווח למניה) מכריע
            const est = sr == null ? estimate(m, kind, e, rs, d, facts, adj, fyS, fs0, secAt) : null;
            if (est != null) r.est = m === 'sh' ? Math.round(est) : Math.round(est * 1000) / 1000;
            let okE = est != null && (m === 'sh' ? relDiff(vv, est) <= 0.01 : Math.abs(vv - est) <= Math.max(0.05, 0.05 * Math.abs(vv)));
            // ממוצע מניות ברבעון רביעי עם הפסד באחד הרבעונים — הטווח מהבסיסי (shBand), כמו בענף בלי מקור חיצוני
            if (!okE && m === 'sh' && kind === 'Q' && d.fy.includes(e)) { const band = shBand(e, d, facts, { splits: splitsOf(d) }, fyS); if (band && vv >= band[0] * 0.99 && vv <= band[1] * 1.01) { okE = true; r.why = 'q4_basic'; } }
            r.c = okE ? 'def' : 'one';
            if (r.c === 'def') r.why = r.why || 'est';
          }
          if (why && r.c !== 'okd') r.why = why;
          // אנחנו = SEC ומקור חיצוני שונה בלי שום הסבר ידוע — לא "הגדרה" עד שהוכח: לבדוק (odd).
          // בשנה שבדוח המודפס: הערך שלנו הוא השורה שהחברה הדפיסה, והמקור לא = אנחנו ± שורה אחרת בדוח → המקור טועה / מגדיר אחרת (okd face);
          // המקור = אנחנו ± שורה מודפסת (fline — אולי חסרה לנו שורה: Host, Zimmer); התגית שלנו לא מודפסת בדוח (nf)
          if (r.c === 'def' && !r.why) {
            r.c = 'odd';
            if (fc) {
              const un = [['y', sy, yv], ['n', sn, nv]].filter(([s, okk]) => okk === false && !ex[s]).map(([, , x]) => x);
              const fl = !NOSUM.has(m) && un.some((x) => fc.rows.some((fr) => !fr.mine && Math.abs(fr.v) >= 0.005 * Math.abs(fval) &&
                (fsame(Math.abs(x), Math.abs(fval) + Math.abs(fr.v)) || fsame(Math.abs(x), Math.abs(fval) - Math.abs(fr.v)))));
              if (fl) r.why = 'fline';
              else if (printed) { r.c = 'okd'; r.why = 'face'; }
              else r.why = 'nf';
            }
          }
        }
        if (opt.debug) r.ex = Object.fromEntries(Object.entries(ex).map(([k, x]) => [k, x ? x.id : null]));
        // הבדל קטן (0.1%–0.5%) שעבר כ־ok — לסטטיסטיקה (הגדרה קטנה, לא עיגול)
        if (r.c === 'ok' || r.c === 'okd') for (const x of [r.y, r.n]) if (x != null && !PER_SHARE.has(m) && relDiff(vc, x) > 1e-3 && relDiff(vc, x) <= 5e-3) r.near = 1;
        out.push(r);
      }
    }
  }
  // רבעון / שנה ישנה בלי הסבר (אין דוח מודפס לבדוק מולו): אותו מקור באותו מדד הוסבר בשנים שבדוח — רמז (a:<הסבר>), עדיין odd
  const yrEx = {};
  for (const r of out) if (r.k === 'A' && (r.c === 'okd' || r.c === 'def') && r.why) (yrEx[r.m] = yrEx[r.m] || new Set()).add(r.why);
  for (const r of out) if (r.c === 'odd' && !r.why && yrEx[r.m]) r.why = 'a:' + [...yrEx[r.m]].sort()[0];
  return out;
}

/* סיכום: לכל הכרעה, לכל מדד ולכל חברה; ולכל הסבר (why) */
const PROBLEM = new Set(['bug', 'ext', 'one', 'spl', 'estx', 'odd']); // לא בעיה: ok, okd, est, def (עם הסבר), yfill, fix, none
function summarizeX(rows) {
  const S = { n: 0, c: {}, byM: {}, why: {}, cos: {} };
  for (const { sym, x } of rows) {
    for (const r of x) {
      S.n++; S.c[r.c] = (S.c[r.c] || 0) + 1;
      const b = (S.byM[r.k + ':' + r.m] = S.byM[r.k + ':' + r.m] || {}); b[r.c] = (b[r.c] || 0) + 1;
      if (r.why) { const w = (S.why[r.c + ':' + r.why] = S.why[r.c + ':' + r.why] || 0); S.why[r.c + ':' + r.why] = w + 1; }
      if (PROBLEM.has(r.c)) (S.cos[sym] = S.cos[sym] || []).push(r);
    }
  }
  return S;
}

module.exports = { xcheck, summarizeX, parseNasdaq, parseYahooAlt, rawSeries, rawAt, rawQuarters, estimate, same, explain, XK, DEFS, DEFS_ALL, YALT_TYPES, YPRIM, PROBLEM };
