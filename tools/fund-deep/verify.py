#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""בדיקת העומק של מנתח החברות (16/11/2026, docs/fund-deep-audit.md) — המאמת הבלתי תלוי.

לכל חברה: כל ערך שהמסך מציג (disp/<SYM>.json מ־snap.js) מול:
  1. הדוח המודפס — כל הגשה שבה התקופה מופיעה בדוחות עצמם (fsds.db מ־fsds.py): המקורית, האחרונה וכל הגרסאות.
  2. companyfacts של SEC (אותו XBRL, צנרת אחרת — כולל הביאורים).
  3. Nasdaq (ספק חיצוני: 4 שנים ו־4 רבעונים אחרונים).
ונגזרות (רבעון רביעי, 12 חודשים, יחסים, צמיחה) — מחושבות מחדש כאן, בקוד אחר ובשפה אחרת, מהערכים המודפסים.

המיפוי של כל מדד לשורה בדוח נכתב כאן מאפס (תגית + תווית מודפסת), בלי המיפוי של lib/fundamentals.js — כדי שטעות שם לא
תשוכפל לכאן. כשהמיפוי שלנו בוחר שורה אחרת מזו של השרתון — זה ממצא למיון, לא "טעות של המאמת" ולא "טעות של השרתון" מראש.

  python3 -I tools/fund-deep/verify.py --db <scratch>/fsds.db --w <scratch>/w1 --ciks <scratch>/sec/ciks.tsv [--syms AAPL,MSFT] [--no-net]

הפסקים (verdict) לכל ערך:
  V3 = שווה לדוח המודפס האחרון + עוד שני אישורים (הגשה נוספת שהדפיסה אותו ערך / companyfacts / Nasdaq)
  V2 / V1 = אישור אחד / בלי אישור נוסף      ALT = שווה לשורה אחרת מאותה משפחה (לא זו שהמאמת מעדיף) — למיון
  OLD = שווה לגרסה ישנה (הוצג מחדש מאז)      DER = נגזר (רבעון 4 / תזרים מצטבר) ושווה לחישוב מחדש מהמודפס
  NOFACE = אין בדוחות עצמם (ביאור) — נבדק מול companyfacts/Nasdaq בלבד     DIFF = אין התאמה — ממצא
  MISS = יש בדוח ואין במסך     EXTRA = יש במסך ואין בשום מקור
"""
import argparse
import calendar
import csv
import datetime as dt
import gzip
import json
import math
import os
import re
import sqlite3
import sys
import time
import urllib.request

UA_SEC = 'TheSnowball/1.0 data@thesnowball.app'
UA_WEB = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'

# ---------------------------------------------------------------- המדדים: משפחת תגיות + תווית מודפסת (נכתב מאפס)
# st = הדוחות שבהם מחפשים · kind = flow (תקופה) / inst (מאזן) · u = money / ps (למניה) / sh (מניות)
# tags = לפי סדר ההעדפה של המאמת (הסך הכולל לפני רכיבים) · lab = תווית מודפסת לתגיות מותאמות (custom)
MET = {
    'rev': dict(st=('IS',), kind='flow', u='money', tags=[
        'Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'RevenueFromContractWithCustomerIncludingAssessedTax',
        'SalesRevenueNet', 'RevenuesNetOfInterestExpense', 'TotalRevenuesAndOtherIncome', 'RegulatedAndUnregulatedOperatingRevenue',
        'ElectricUtilityRevenue', 'RealEstateRevenueNet', 'OperatingLeasesIncomeStatementLeaseRevenue', 'SalesRevenueGoodsNet',
        'SalesRevenueServicesNet', 'RevenueMineralSales', 'HealthCareOrganizationRevenue', 'FinancialServicesRevenue',
        'InterestAndDividendIncomeOperating', 'RevenuesExcludingInterestAndDividends', 'OilAndGasRevenue', 'Revenue'],
        lab=r'^(total )?(net )?(operating )?(revenues?|sales)\b|^total (net )?(revenues?|sales)|^net (sales|revenues?)|revenues?,? net\b|^total revenues? and other income',
        # "Sales and marketing" / "Selling, general…" הן הוצאות, לא הכנסות (AppLovin: נתפסה כהכנסה ורווח גולמי שגוי)
        nolab=r'marketing|administrative|selling|expense|commission|\bcosts?\b'),
    'cogs': dict(st=('IS',), kind='flow', u='money', tags=[
        'CostOfRevenue', 'CostOfGoodsAndServicesSold', 'CostOfGoodsSold', 'CostOfServices', 'CostOfGoodsAndServiceExcludingDepreciationDepletionAndAmortization',
        'CostOfGoodsSoldExcludingDepreciationDepletionAndAmortization', 'CostOfServicesExcludingDepreciationDepletionAndAmortization', 'CostDirectMaterial'],
        lab=r'^(total )?cost of (net )?(revenues?|sales|goods|products|services)'),
    'gp': dict(st=('IS',), kind='flow', u='money', tags=['GrossProfit'], lab=r'^gross (profit|margin)'),
    'op': dict(st=('IS',), kind='flow', u='money', tags=['OperatingIncomeLoss'], lab=r'^(total )?operating (income|profit|earnings|loss)|^(income|earnings|loss) from operations'),
    'ni': dict(st=('IS',), kind='flow', u='money', tags=['NetIncomeLoss', 'NetIncomeLossAvailableToCommonStockholdersBasic', 'ProfitLoss'],
               lab=r'^net (income|earnings|loss)'),
    'pretax': dict(st=('IS',), kind='flow', u='money', tags=[
        'IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest',
        'IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments',
        'IncomeLossFromContinuingOperationsBeforeIncomeTaxesDomestic', 'IncomeLossBeforeIncomeTaxes'],
        lab=r'(income|earnings|loss).{0,40}before (provision for |benefit from )?(income )?tax'),
    'tax': dict(st=('IS',), kind='flow', u='money', tags=['IncomeTaxExpenseBenefit', 'IncomeTaxExpenseBenefitContinuingOperations'],
                lab=r'(provision for|benefit from|expense).{0,20}income tax|^income tax(es)?\b'),
    'rnd': dict(st=('IS',), kind='flow', u='money', tags=['ResearchAndDevelopmentExpense', 'ResearchAndDevelopmentExpenseExcludingAcquiredInProcessCost',
                                                          'ResearchAndDevelopmentExpenseSoftwareExcludingAcquiredInProcessCost'],
                lab=r'research,? (and|&) development|^technology and development'),
    'int': dict(st=('IS',), kind='flow', u='money', tags=['InterestExpense', 'InterestExpenseNonoperating', 'InterestExpenseDebt', 'InterestAndDebtExpense',
                                                          'InterestExpenseOperating'],
                lab=r'^interest expense'),
    'eps': dict(st=('IS',), kind='flow', u='ps', tags=['EarningsPerShareDiluted', 'EarningsPerShareBasicAndDiluted'], lab=r'diluted'),
    'sh': dict(st=('IS',), kind='flow', u='sh', tags=['WeightedAverageNumberOfDilutedSharesOutstanding', 'WeightedAverageNumberOfShareOutstandingBasicAndDiluted'],
               lab=r'diluted'),
    'ocf': dict(st=('CF',), kind='flow', u='money', tags=['NetCashProvidedByUsedInOperatingActivities', 'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations'],
                lab=r'net cash.{0,30}operating activities|cash (generated|provided) by operating'),
    'capex': dict(st=('CF',), kind='flow', u='money', tags=[
        'PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets', 'PaymentsForCapitalImprovements',
        'PaymentsToAcquireOtherPropertyPlantAndEquipment', 'PaymentsToAcquireAndDevelopRealEstate', 'PaymentsToDevelopRealEstateAssets',
        'PaymentsForConstructionInProcess'],  # AEP: "Construction Expenditures"
        lab=r'(purchases?|acquisitions?|additions?|payments?) (of|to|for) (property|plant|premises|fixed assets)|capital expenditures|construction expenditures'),
    'sbc': dict(st=('CF',), kind='flow', u='money', tags=['ShareBasedCompensation', 'AllocatedShareBasedCompensationExpense'],
                lab=r'(share|stock|equity)[- ]based (compensation|awards)'),
    'dep': dict(st=('CF',), kind='flow', u='money', tags=['DepreciationDepletionAndAmortization', 'DepreciationAmortizationAndAccretionNet',
                                                          'DepreciationAndAmortization', 'Depreciation', 'DepreciationAndAmortizationExcludingNuclearFuel'],
                lab=r'^depreciation'),
    'buy': dict(st=('CF',), kind='flow', u='money', tags=['PaymentsForRepurchaseOfCommonStock', 'PaymentsForRepurchaseOfEquity'],
                lab=r'repurchases? of (common |ordinary )?(stock|shares)|purchases? of (treasury|common|ordinary) (stock|shares)|share repurchases?'),
    'divp': dict(st=('CF',), kind='flow', u='money', tags=['PaymentsOfDividends', 'PaymentsOfDividendsCommonStock', 'PaymentsOfOrdinaryDividends'],
                 lab=r'(cash )?dividends? paid|payments? (of|for) dividends'),
    'dps': dict(st=('IS', 'EQ', 'CF'), kind='flow', u='ps', tags=['CommonStockDividendsPerShareDeclared', 'CommonStockDividendsPerShareCashPaid'],
                lab=r'dividends? (declared )?per (common )?share|per share.{0,20}dividends?'),
    'cash': dict(st=('BS',), kind='inst', u='money', tags=['CashAndCashEquivalentsAtCarryingValue', 'CashAndDueFromBanks', 'Cash',
                                                           'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents'],
                 lab=r'^cash and (cash )?equivalents|^cash$|^cash and due from banks'),
    'msec': dict(st=('BS',), kind='inst', u='money', tags=['MarketableSecuritiesCurrent', 'ShortTermInvestments', 'AvailableForSaleSecuritiesDebtSecuritiesCurrent', 'AvailableForSaleSecuritiesCurrent'],
                 lab=r'^(short-term|current) (investments|marketable securities)|^marketable securities'),
    'eq': dict(st=('BS',), kind='inst', u='money', tags=['StockholdersEquity'],
               lab=r"^total .{0,30}(stockholders|shareholders|shareowners|share owners)'? (equity|deficit|investment)"),
    'ta': dict(st=('BS',), kind='inst', u='money', tags=['Assets'], lab=r'^total assets'),
    'tl': dict(st=('BS',), kind='inst', u='money', tags=['Liabilities'], lab=r'^total liabilities$'),
    'tle': dict(st=('BS',), kind='inst', u='money', tags=['LiabilitiesAndStockholdersEquity'], lab=r'^total liabilities(,| and)'),
    'ca': dict(st=('BS',), kind='inst', u='money', tags=['AssetsCurrent'], lab=r'^total current assets'),
    'cl': dict(st=('BS',), kind='inst', u='money', tags=['LiabilitiesCurrent'], lab=r'^total current liabilities'),
    're': dict(st=('BS',), kind='inst', u='money', tags=['RetainedEarningsAccumulatedDeficit'], lab=r'retained earnings|accumulated deficit|reinvested earnings'),
    'ppe': dict(st=('BS',), kind='inst', u='money', tags=['PropertyPlantAndEquipmentNet',
                                                          'PropertyPlantAndEquipmentAndFinanceLeaseRightOfUseAssetAfterAccumulatedDepreciationAndAmortization'],
                lab=r'property,? (plant )?(and|&) equipment.{0,20}net|^net property'),
}
# חוב (ההגדרה של המסך, סעיף 9 בתוכנית): חוב ארוך כולל חלויות + הלוואות קצרות / ניירות ערך מסחריים, בלי חכירות
DEBT_TOTAL = ['LongTermDebt', 'LongTermDebtAndCapitalLeaseObligations', 'DebtInstrumentCarryingAmount']
DEBT_NC = ['LongTermDebtNoncurrent', 'LongTermDebtAndCapitalLeaseObligationsNoncurrent' , 'OtherLongTermDebtNoncurrent', 'SeniorNotesNoncurrent',
           'ConvertibleNotesPayableNoncurrent', 'LongTermNotesPayableNoncurrent', 'UnsecuredLongTermDebt', 'SeniorLongTermNotes']
DEBT_C = ['LongTermDebtCurrent', 'LongTermDebtAndCapitalLeaseObligationsCurrent', 'DebtCurrent', 'OtherLongTermDebtCurrent',
          'ConvertibleNotesPayableCurrent', 'SeniorNotesCurrent', 'ConvertibleDebtCurrent']
DEBT_ST = ['CommercialPaper', 'ShortTermBorrowings', 'OtherShortTermBorrowings', 'ShortTermBankLoansAndNotesPayable', 'BankOverdrafts']
DEBT_RE = re.compile(r'borrowing|commercial paper|notes? payable|\bdebt\b|loans? payable|bank loans?|credit facilit|senior (unsecured )?notes|convertible (senior )?notes|debentures|bonds payable|term loan|current (portion|maturities) of long|mortgages? (payable|notes|loans)|lines? of credit|revolving|LongTermDebt|ShortTermBorrowings|CommercialPaper|NotesPayable|LinesOfCredit|LineOfCredit|Debt(Current|Noncurrent)|'
                     # "Unsecured notes" / "Long-term notes" / "Senior unsecured notes" (Invitation Homes, ‏Everest, ‏Welltower — 16/11/2026)
                     r'(long.term|unsecured|secured|subordinated|junior|senior|exchangeable|guaranteed|convertible)( senior| unsecured| subordinated)* notes|notes due|'
                     r'SeniorNotes|SubordinatedDebt|JuniorSubordinated|SecuredDebt|UnsecuredDebt|ConvertibleDebt|OtherBorrowings|LongtermBorrowings|AdvancesFromFederalHomeLoanBanks|LoansPayable', re.I)
# תגיות שאינן חוב גם כשהשם או התווית נשמעים כך (16/11/2026): "סך התחייבויות לא שוטפות חוץ מחוב" (Con Edison — נספר כחוב
# ו"הצפוי" יצא כפול), סך ההון והחוב, רכיב ההון של אג"ח להמרה, ריבית לשלם, הנחות/עלויות הנפקה, חובות לחברות קשורות, נכסים
NOT_DEBT_TAG = re.compile(r'OtherThanLong|^Capitalization|^EquityAndLongTermDebt|^TemporaryEquity|^ReserveForEsop|^DebtInstrumentInterestRate|'
                          r'UnamortizedLossReacquiredDebt|UnamortizedDebtIssuance|DebtInstrumentUnamortized|DebtFairValueAdjustment|^ConvertibleDebtEquity|'
                          r'^InterestPayable|^DueTo(Affiliate|RelatedParties)|Receivable|Investments?\b|Investments?[A-Z]|^MarketableSecurities|^AllowanceFor')
# פסוקית "including …" / "net of …" בסוף התווית — לא משנה את סוג השורה (VeriSign: "Convertible debentures, including contingent interest
# derivative" — חוב, לא נגזר)
INCL_RE = re.compile(r',?\s*\(?(including|includes|net of)\b.*$', re.I)
# תגית של חוב, אבל התווית — ספקים / מימון ספקים (Mosaic: ‏ShortTermBankLoansAndNotesPayable "Structured accounts payable arrangements")
# השאלת ניירות ערך / הסכמי רכש חוזר — לא חוב גם בתגית של secured borrowings (Aflac 2026: "Payables under securities lending and repurchase agreements")
# "Commercial paper and repurchase agreement" (Apple ‏10-Q ‏2020) — הלוואות לזמן קצר, חוב (גל 2, ‏F12)
CP_RE = re.compile(r'commercial paper', re.I)
PAYABLE_LAB = re.compile(r'accounts payable|structured payables?|supplier financ|trade payables?|securities lending|repurchase agreements?', re.I)
DEBT_EXCL = re.compile(r'operating lease|interest payable|accrued|accounts payable|deferred|debt securities|held.for.sale|derivative|due to (related|affiliat)|guarantee|total liabilities|liabilities of|customer|deposits|payable to|insurance|policy|unearned|pension|tax|dividend|issuance cost', re.I)
LEASE_RE = re.compile(r'finance lease|capital lease', re.I)
ST_RE = re.compile(r'short.?term (borrowings|debt|notes|loans)|commercial paper|notes payable|bank (loans|overdraft)|loans payable|(?<!long.term )borrowings(?! .*long)', re.I)
CUR_RE = re.compile(r'current (portion|maturities)|due within one year|currently due|current$|, current', re.I)
LEASE_FIN = ['FinanceLeaseLiabilityNoncurrent', 'FinanceLeaseLiabilityCurrent', 'FinanceLeaseLiability', 'CapitalLeaseObligationsNoncurrent', 'CapitalLeaseObligationsCurrent']

TOL_PS = 0.0051
SH_TAGS = ('WeightedAverageNumberOfDilutedSharesOutstanding', 'WeightedAverageNumberOfShareOutstandingBasicAndDiluted', 'WeightedAverageNumberOfSharesOutstandingBasic')
EPS_TAGS = ('EarningsPerShareDiluted', 'EarningsPerShareBasic', 'EarningsPerShareBasicAndDiluted')
PS_BAD = re.compile(r'per (common |ordinary |diluted |basic )?share|per unit', re.I)


def me(s):
    """תאריך סוף מדויק → סוף החודש הקרוב (כמו ddate ב־FSDS): יום 15 ומעלה → סוף אותו חודש, אחרת סוף החודש הקודם"""
    d = dt.date.fromisoformat(s[:10])
    if d.day < 15:
        d = d.replace(day=1) - dt.timedelta(days=1)
    return '%04d%02d%02d' % (d.year, d.month, calendar.monthrange(d.year, d.month)[1])


def fdate(s):
    """'20151028' / '2015-10-28' → '2015-10-28'"""
    s = str(s)
    return s if '-' in s else s[:4] + '-' + s[4:6] + '-' + s[6:8]


def same(a, b, u):
    if a is None or b is None:
        return False
    if u == 'ps':
        return abs(a - b) <= TOL_PS
    return abs(a - b) <= max(0.5, 1e-9 * max(abs(a), abs(b)))


def lab_ok(m, plabel):
    t = (plabel or '').strip().lower().replace('\u2019', "'").replace('\u2018', "'")
    if MET[m].get('nolab') and re.search(MET[m]['nolab'], t):
        return False
    return bool(MET[m].get('lab')) and re.search(MET[m]['lab'], t) is not None


def unit_ok(m, uom, cur):
    """FSDS: למניה = המטבע עצמו (USD), מניות = shares. companyfacts: למניה = USD/shares"""
    u = MET[m]['u']
    if u == 'sh':
        return uom == 'shares'
    if u == 'ps':
        return uom == cur or uom == (cur or '') + '/shares'
    return uom == cur


# ---------------------------------------------------------------- פיצולים — מתוך הדוחות עצמם (בלתי תלוי ב־Yahoo)
# יחסי פיצול אמיתיים בלבד: שלמים (2:1 … 50:1), איחוד (1:k) ושברים נפוצים (3:2, 5:4, 4:3). עד 16/11/2026 — כל שבר a/b עד 40,
# והצגה מחדש (רווח למניה אחרי פעילות שנמכרה, תקן חדש) זוהתה כ"פיצול": Salesforce 2018 ‏9/28, ‏GE ‏7/5 ו־29/17 — פערים מדומים
_K = (2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20, 25, 30, 40, 50)
SIMPLE = sorted({float(k) for k in _K} | {1 / k for k in _K} | {1.5, 2 / 3, 1.25, 0.8, 4 / 3, 0.75})


def near_simple(r):
    best = min(SIMPLE, key=lambda x: abs(math.log(r / x)))
    return best if abs(math.log(r / best)) < 0.006 else None


def splits_from(rows):
    """אותה תקופה הודפסה בשתי הגשות עם מניות×k ורווח למניה÷k → פיצול k בין שתי ההגשות.
       מחזיר [(אחרי_הגשה, לפני_הגשה, k)] — הפיצול קרה אחרי ההגשה הראשונה ולפני השנייה."""
    per = {}
    for r in rows:
        if r[3] != 'IS' or r[4]:
            continue
        if r[6] in SH_TAGS and r[10] == 'shares' or r[6] in EPS_TAGS:
            per.setdefault((r[6], r[8], r[9]), set()).add((r[2], r[11]))
    obs = []
    for (tag, _, _), vals in per.items():
        v = sorted(vals)
        for (f1, v1), (f2, v2) in zip(v, v[1:]):
            if not v1 or not v2 or f1 == f2 or (v1 < 0) != (v2 < 0):
                continue
            r = v2 / v1 if tag in SH_TAGS else v1 / v2
            k = near_simple(r) if (r > 1.3 or r < 0.77) else None
            if k:
                obs.append((f1, f2, k, tag in SH_TAGS))
    # אשכול: אותו k, חלונות חופפים
    out = []
    for f1, f2, k, sh in sorted(obs, key=lambda x: (x[1], x[0])):
        hit = next((o for o in out if o[2] == k and f1 < o[1] and f2 > o[0]), None)
        if hit:
            hit[0], hit[1] = max(hit[0], f1), min(hit[1], f2)
            hit[3] += 1
            hit[4] += sh
        else:
            out.append([f1, f2, k, 1, int(sh)])
    # מספר המניות — שתי תצפיות; רק מרווח למניה (GE: המניות לא בדוח הרווח) — שלוש, ויחס שלם בלבד: רווח למניה משתנה גם בהצגה
    # מחדש (פעילות שנמכרה, תקן חדש) ביחסים כמו 1/3 (Salesforce 2018) או 7/5 (GE)
    whole = {float(k) for k in _K} | {1 / k for k in _K}
    return [tuple(o[:4]) for o in out if o[4] >= 2 or (o[3] >= 3 and o[2] in whole)]


def factor_after(splits, filed):
    """כמה פעמים התרבו המניות מאז ההגשה (מכפלת הפיצולים שאחריה)"""
    f = 1.0
    for a, b, k, *_ in splits:
        if fdate(filed) <= fdate(a):
            f *= k
    return f


# ---------------------------------------------------------------- הדוח המודפס מ־FSDS
class Printed:
    """כל העובדות שבדוחות עצמם של החברה: (adsh, form, filed, stmt, inpth, line, tag, plabel, ddate, qtrs, uom, value, negating, period, report)"""

    def __init__(self, db, ciks):
        q = ('SELECT s.adsh, s.form, s.filed, p.stmt, p.inpth, p.line, p.tag, p.plabel, n.ddate, n.qtrs, n.uom, n.value, p.negating, s.period, p.report '
             'FROM sub s JOIN pre p ON p.adsh = s.adsh JOIN num n ON n.adsh = p.adsh AND n.tag = p.tag AND n.version = p.version '
             'WHERE s.cik IN (%s)' % ','.join('?' * len(ciks)))
        self.rows = db.execute(q, list(ciks)).fetchall()
        # שורות המאזן כפי שהוצגו (גם בלי ערך בלי ממד) — לזהות מאזן שהחוב בו מוצג רק בפירוט עם ממד (Exelon)
        self.bs_pre = {}
        for adsh, tag, lab, line in db.execute('SELECT p.adsh, p.tag, p.plabel, p.line FROM sub s JOIN pre p ON p.adsh = s.adsh '
                                               "WHERE s.cik IN (%s) AND p.stmt = 'BS' AND p.inpth = 0" % ','.join('?' * len(ciks)), list(ciks)):
            self.bs_pre.setdefault(adsh, []).append((tag, lab or '', line))
        self.by = {}  # (ddate, qtrs) → שורות
        for r in self.rows:
            self.by.setdefault((r[8], r[9]), []).append(r)
        self.splits = splits_from(self.rows)

    def debt_missing(self, adsh, rows):
        """שורות חוב במאזן של ההגשה (אחרי סך הנכסים) שאין להן ערך בלי ממד — החוב "המודפס" שנקרא חלקי"""
        have = {r[6] for r in rows}
        a0 = max([r[5] for r in rows if r[6] == 'Assets'] or [0])
        return [t for t, lab, line in self.bs_pre.get(adsh, []) if line > a0 and t not in have and debt_row(t, lab)]

    def adj(self, m, filed, v):
        u = MET[m]['u']
        if u == 'money' or not self.splits:
            return v
        f = factor_after(self.splits, filed)
        return v * f if u == 'sh' else v / f

    def cands(self, m, ddate, qtrs, cur):
        """כל השורות המודפסות של המדד לתקופה: [(rank, adsh, form, filed, tag, plabel, value, stmt)] — rank = מקום התגית ברשימה (99 = לפי תווית).
           ערכים למניה / מניות — מותאמים לפיצולים שאחרי ההגשה"""
        d = MET[m]
        out = []
        seen = set()
        for r in self.by.get((ddate, qtrs), []):
            adsh, form, filed, stmt, inp, line, tag, plabel, _, _, uom, val = r[:12]
            if stmt not in d['st'] or (inp and m != 'dps'):
                continue
            if not unit_ok(m, uom, cur):
                continue
            if d['u'] == 'money' and (PS_BAD.search(plabel or '') or 'PerShare' in tag):
                continue
            if tag in d['tags']:
                rank = d['tags'].index(tag)
            elif lab_ok(m, plabel) and not tag.startswith(('Increase', 'Decrease', 'ProceedsFrom')):
                rank = 99
            else:
                continue
            k = (adsh, tag, val)
            if k in seen:
                continue
            seen.add(k)
            out.append((rank, adsh, form, fdate(filed), tag, plabel, self.adj(m, filed, val), stmt))
        return out

    def bs_by_filing(self, tags, ddate, cur):
        """{adsh: (form, filed, {tag: value})} — שורות המאזן של כל הגשה בנפרד (לחוב)"""
        out = {}
        for r in self.by.get((ddate, 0), []):
            if r[3] == 'BS' and r[6] in tags and not r[4] and r[10] == cur:
                o = out.setdefault(r[0], (r[1], fdate(r[2]), {}))
                o[2][r[6]] = r[11]
        return out


def pick(cands, annual_first):
    """הערך "המצופה": שורה מועדפת (rank נמוך) מההגשה האחרונה (שנתית קודם כשמדובר בשנה/מאזן סוף שנה)"""
    if not cands:
        return None
    best_rank = min(c[0] for c in cands)
    pref = [c for c in cands if c[0] == best_rank]
    ann = [c for c in pref if not c[2].startswith('10-Q')]
    pool = ann if (annual_first and ann) else pref
    return max(pool, key=lambda c: c[3])


# ---------------------------------------------------------------- companyfacts (אישור שני) + Nasdaq (אישור חיצוני)
def get_json(url, ua, dest, max_age=86400 * 3):
    if dest and os.path.exists(dest) and time.time() - os.path.getmtime(dest) < max_age:
        with open(dest, 'rb') as f:
            b = f.read()
        return json.loads(gzip.decompress(b) if b[:2] == b'\x1f\x8b' else b)
    req = urllib.request.Request(url, headers={'User-Agent': ua, 'Accept': 'application/json, text/plain, */*', 'Accept-Encoding': 'gzip'})
    err = None
    for i in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                b = r.read()
                if r.headers.get('Content-Encoding') == 'gzip':
                    b = gzip.decompress(b)
            if dest:
                with open(dest, 'wb') as f:
                    f.write(b)
            return json.loads(b)
        except Exception as e:  # SEC: עד 10 בקשות בשנייה; Nasdaq: לאט
            err = e
            time.sleep(2 + 3 * i)
    raise RuntimeError('%s: %s' % (url, err))


def cf_index(cf):
    """companyfacts → {(tag, ddate_me, qtrs, unit): {value: [filed...]}}"""
    idx = {}
    for ns in ('us-gaap', 'ifrs-full', 'dei'):
        for tag, node in (cf.get('facts', {}).get(ns) or {}).items():
            for unit, arr in (node.get('units') or {}).items():
                for x in arr:
                    e = x.get('end')
                    if not e or x.get('val') is None:
                        continue
                    if x.get('start'):
                        days = (dt.date.fromisoformat(e) - dt.date.fromisoformat(x['start'])).days
                        qtrs = int(round(days / 91.3))
                    else:
                        qtrs = 0
                    idx.setdefault((tag, me(e), qtrs, unit), {}).setdefault(x['val'], []).append(x.get('filed'))
    return idx


def money_txt(s):
    """'$1,234,000' / '-$52,000' / '--' → מספר (Nasdaq מציג באלפים)"""
    if s is None:
        return None
    s = str(s).strip()
    if s in ('', '--', 'N/A'):
        return None
    neg = s.startswith('-') or s.startswith('(')
    t = re.sub(r'[^0-9.]', '', s)
    if not t:
        return None
    v = float(t)
    return -v if neg else v


NQ_ROWS = {  # שורות Nasdaq → המדדים שלנו (באלפים)
    'Total Revenue': 'rev', 'Cost of Revenue': 'cogs', 'Gross Profit': 'gp', 'Operating Income': 'op', 'Net Income': 'ni',
    'Earnings Before Tax': 'pretax', 'Income Tax': 'tax', 'Research and Development': 'rnd', 'Interest Expense': 'int',
    'Net Cash Flow-Operating': 'ocf', 'Capital Expenditures': 'capex', 'Depreciation': 'dep',
    'Cash and Cash Equivalents': 'cash', 'Short-Term Investments': 'msec', 'Total Assets': 'ta', 'Total Liabilities': 'tl',
    'Total Current Assets': 'ca', 'Total Current Liabilities': 'cl', 'Retained Earnings': 're', 'Fixed Assets': 'ppe',
    'Total Equity': 'eq', 'Long-Term Debt': 'ltd', 'Short-Term Debt / Current Portion of Long-Term Debt': 'std',
    'Sale and Purchase of Stock': 'stock', 'Dividends Paid': 'divp',
}


def nasdaq(sym, cache, freq):
    j = get_json('https://api.nasdaq.com/api/company/%s/financials?frequency=%d' % (sym.replace('-', '.'), freq), UA_WEB,
                 os.path.join(cache, '%s_%s.json' % (sym, 'a' if freq == 1 else 'q')))
    data = (j or {}).get('data') or {}
    out = {}
    for t in ('incomeStatementTable', 'balanceSheetTable', 'cashFlowTable'):
        tb = data.get(t) or {}
        hd = tb.get('headers') or {}
        cols = [(k, hd[k]) for k in sorted(hd) if k != 'value1']
        for r in tb.get('rows') or []:
            m = NQ_ROWS.get(r.get('value1'))
            if not m:
                continue
            for k, h in cols:
                try:
                    mm, dd, yy = h.split('/')
                    e = '%04d-%02d-%02d' % (int(yy), int(mm), int(dd))
                except Exception:
                    continue
                v = money_txt(r.get(k))
                if v is not None:
                    out.setdefault(m, {})[me(e)] = v * 1000
    return out


def nq_same(a, b):
    return a is not None and b is not None and abs(abs(a) - abs(b)) <= max(1000.0, 5e-4 * abs(b))


# ---------------------------------------------------------------- האימות עצמו
DEBT_ALL = set(DEBT_TOTAL + DEBT_NC + DEBT_C + DEBT_ST)


def debt_row(tag, lab):
    """שורת חוב במאזן (לא חכירה מימונית לבדה, לא כותרת) — אותה הגדרה כמו ב־face_debt"""
    if tag.endswith('Abstract') or NOT_DEBT_TAG.search(tag):
        return False
    lab = INCL_RE.sub('', lab)
    txt = tag + ' ' + lab
    if (DEBT_EXCL.search(txt) and tag not in DEBT_ALL) or (PAYABLE_LAB.search(lab) and not CP_RE.search(lab)):
        return False
    if tag in LEASE_FIN or (LEASE_RE.search(lab) and not DEBT_RE.search(LEASE_RE.sub('', lab))):
        return False
    return tag in DEBT_ALL or bool(DEBT_RE.search(txt))
LTD_NC_LAB = re.compile(r'less current|net of current|non-?current|excluding current|long-term portion', re.I)


class Co:
    def __init__(self, sym, disp, snap, pr, cfi, nq_a, nq_q):
        self.sym, self.d, self.s, self.pr, self.cfi = sym, disp, snap, pr, cfi
        self.nq = {'fy': nq_a or {}, 'q': nq_q or {}}
        self.cur = disp.get('cur') or 'USD'
        self.ends = {'fy': disp['raw']['fyE'], 'q': disp['raw']['q']}
        self.res = []
        # מה שהשרתון עצמו סימן לכל ערך (checks): cx0 = אין שורת השקעות הוניות בדוח (0 במכוון); qsh/qeps = רבעון שלא הודפס
        # ב־10-Q/10-K והוחלף במה שהחברה פרסמה (דרך Yahoo); fill = השלמה שנתית מ־Yahoo (כל המדד)
        self.flag = {}
        for c in (snap or {}).get('checks') or []:
            self.flag.setdefault((c.get('m'), c.get('p')), set()).add(c.get('k'))
        self.fill = set((snap or {}).get('fill') or [])

    def add(self, **k):
        self.res.append(k)

    # ---- companyfacts לתקופה (מותאם לפיצולים לפי תאריך ההגשה): {ערך: [הגשות]}
    def cf_vals(self, m, ddate, qtrs):
        u = MET[m]['u']
        units = [self.cur] if u == 'money' else ['shares'] if u == 'sh' else [self.cur + '/shares']
        out = {}
        for tag in MET[m]['tags'] + MET[m].get('cf_extra', []):
            for unit in units:
                for v, fl in (self.cfi.get((tag, ddate, qtrs, unit)) or {}).items():
                    for f in fl:
                        out.setdefault(round(self.pr.adj(m, f, v), 6), []).append(f)
        return out

    def capex_sums(self, ddate, qtrs):
        """השקעה הונית = כל שורות ההשקעה בתזרים של אותה הגשה (Mastercard: רכוש קבוע + תוכנה מהוונת; Deere/Caterpillar: + ציוד
        להשכרה) — כמו בשרתון. שורת "Acquisitions of …" (רכישת נכסים קיימים — AEP) רק כשאין שורה אחרת. [(filed, סכום, תגיות)]"""
        by = {}
        for c in self.pr.cands('capex', ddate, qtrs, self.cur):
            by.setdefault(c[1], {})[c[4]] = (c[3], abs(c[6]), c[5])
        out = []
        for adsh, d in by.items():
            if len(d) < 2:
                continue
            keep = {t: x for t, x in d.items() if not re.match(r'^\s*acquisitions?\s+of\b', x[2] or '', re.I)} or d
            for dd in ([keep, d] if len(keep) < len(d) else [d]):
                out.append((max(x[0] for x in dd.values()), sum(x[1] for x in dd.values()), '+'.join(sorted(dd))))
        return out

    def prev_q(self, j):
        """הרבעון הקודם ברשימה — רק כשהוא באמת 75–105 יום לפני"""
        q = self.ends['q']
        if j < 1:
            return None
        d = (dt.date.fromisoformat(q[j]) - dt.date.fromisoformat(q[j - 1])).days
        return q[j - 1] if 75 <= d <= 125 else None  # רבעון של 12–17 שבועות (Costco: רבעון רביעי של 16; Kroger: ראשון של 16)

    def ytd(self, m, j, src):
        """רבעון מתוך מצטברים: כל הזוגות (מצטבר k של הרבעון) − (מצטבר k−1 של הרבעון הקודם). [(ערך, הסבר)]
        סוף הרבעון הקודם: מהרשימה במסך, ואם אין (הרבעון הראשון בחלון / רבעון חסר) — סופי חודש 3–4 חודשים לפני (12–17 שבועות)"""
        e, pe = self.ends['q'][j], self.prev_q(j)
        ed = dt.date.fromisoformat(e)
        pes = [me(pe)] if pe else sorted({me((ed - dt.timedelta(days=d)).isoformat()) for d in (84, 91, 112, 119)})
        for k in (2, 3, 4):
            for pm in pes:
                if src == 'fs':
                    A = [(c[3], c[6], c[2]) for c in self.pr.cands(m, me(e), k, self.cur)]
                    B = [(c[3], c[6], c[2]) for c in self.pr.cands(m, pm, k - 1, self.cur)]
                else:
                    A = [(f, v, 'cf') for v, fl in self.cf_vals(m, me(e), k).items() for f in fl]
                    B = [(f, v, 'cf') for v, fl in self.cf_vals(m, pm, k - 1).items() for f in fl]
                if A and B:
                    out, seen = [], set()
                    for fa, va, ta in A:
                        for fb, vb, tb in B:
                            x = round(va - vb, 6)
                            if x not in seen:
                                seen.add(x)
                                out.append((x, 'מצטבר %d − %d (%s %s / %s %s)' % (k, k - 1, ta, fa, tb, fb)))
                    return out
        return []

    def gp_cands(self, mode, j, e, qtrs):
        """רווח גולמי = הכנסות − עלות המכר: מאותה הגשה (אותה תקופה), וברבעון — גם מהמצטברים של שתיהן"""
        out = []
        # לכל הגשה — השורה הטובה ביותר (התגית הראשונה ברשימה), לא האחרונה שנמצאה
        R = {}
        for c in sorted(self.pr.cands('rev', me(e), qtrs, self.cur), key=lambda c: c[0]):
            R.setdefault(c[1], c)
        for c in self.pr.cands('cogs', me(e), qtrs, self.cur):
            if c[1] in R:
                out.append((round(R[c[1]][6] - c[6], 6), 'הכנסות − עלות המכר (%s %s)' % (c[2], c[3])))
        if mode == 'q' and not out:
            for a, wa in self.ytd('rev', j, 'fs'):
                for b, wb in self.ytd('cogs', j, 'fs'):
                    out.append((round(a - b, 6), 'הכנסות − עלות המכר (מצטבר: %s)' % wa))
        return out

    def q4_ps(self, m, j, ours):
        """רווח למניה / מניות ברבעון שלא הודפס: לא נגזר בחיסור — מועמדים: רווח ÷ מניות, ו־4×שנה − 3×תשעה חודשים"""
        e, pe = self.ends['q'][j], self.prev_q(j)
        out = []
        if not pe:
            return out
        fy = [c[6] for c in self.pr.cands('sh', me(e), 4, self.cur)]
        n9 = [c[6] for c in self.pr.cands('sh', me(pe), 3, self.cur)]
        shq = sorted({round(4 * a - 3 * b) for a in fy for b in n9})
        if m == 'sh':
            return [(x, '4×שנה − 3×תשעה חודשים') for x in shq]
        niq = [x for x, _ in self.ytd('ni', j, 'fs')] or [x for x, _ in self.ytd('ni', j, 'cf')]
        oursh = (self.d['raw']['Q'].get('sh') or [None] * (j + 1))[j]
        for n in niq:
            for s in shq + ([oursh] if oursh else []):
                if s:
                    out.append((round(n / s, 6), 'רווח נקי ברבעון ÷ מניות (%s)' % ('שלנו' if s == oursh else 'נגזר')))
        return out

    def judge(self, m, mode, j, e, ours):
        kind, u = MET[m]['kind'], MET[m]['u']
        qtrs = 0 if kind == 'inst' else (4 if mode == 'fy' else 1)
        ddate = me(e)
        c = self.pr.cands(m, ddate, qtrs, self.cur)
        exp = pick(c, mode == 'fy' or kind == 'inst')
        cfv = self.cf_vals(m, ddate, qtrs)
        nqv = self.nq[mode].get(m, {}).get(ddate)
        rec = dict(m=m, mode=mode, end=e, me=ddate, ours=ours, nq=nqv, cf=sorted(cfv)[:6],
                   printed=[dict(form=x[2], filed=x[3], tag=x[4], lab=x[5], v=x[6], rank=x[0]) for x in sorted(c, key=lambda x: (x[0], x[3]))][:10])
        if exp:
            rec['exp'], rec['line'] = exp[6], exp[4]
        if ours is None:
            rec['verdict'] = 'MISS' if exp and exp[6] else 'NONE'
            return self.add(**rec)
        if exp and same(ours, exp[6], u):
            conf = 0
            conf += 1 if any(x[1] != exp[1] and x[0] == exp[0] and same(ours, x[6], u) for x in c) else 0
            conf += 1 if any(same(ours, v, u) for v in cfv) else 0
            conf += 1 if u == 'money' and nq_same(nqv, ours) else 0
            rec['verdict'] = 'V3' if conf >= 2 else 'V2' if conf == 1 else 'V1'
            return self.add(**rec)
        alt = [x for x in c if same(ours, x[6], u)]
        if alt:
            a = max(alt, key=lambda x: x[3])
            rec['verdict'] = 'OLD' if (exp and a[0] == exp[0] and exp[3] > a[3]) else 'ALT'
            rec['why'] = 'שווה ל־%s "%s" (%s %s)%s' % (a[4], a[5], a[2], a[3], '; המועדף: %s %s %s = %s' % (exp[4], exp[2], exp[3], exp[6]) if exp else '')
            return self.add(**rec)
        if m == 'capex':
            sm = self.capex_sums(ddate, qtrs)
            hit = next((w for f, x, w in sm if same(abs(ours), x, u)), None)
            if not hit and mode == 'q':
                pe = self.prev_q(j)
                for k in (2, 3, 4):
                    if hit or not pe:
                        break
                    A, B = self.capex_sums(ddate, k), self.capex_sums(me(pe), k - 1)
                    hit = next(('מצטבר %d − %d של %s' % (k, k - 1, wa) for fa, a, wa in A for fb, b, wb in B if wa == wb and same(abs(ours), a - b, u)), None)
            if hit:
                rec['verdict'], rec['why'] = 'DER', 'סכום שורות ההשקעה ההונית בתזרים: ' + hit
                return self.add(**rec)
        if mode == 'q' and kind == 'flow':
            for src, tagv in (('fs', 'DER'), ('cf', 'DERCF')):
                y = self.ytd(m, j, src)
                hit = next((w for x, w in y if same(ours, x, u)), None)
                if hit:
                    rec['verdict'], rec['why'] = tagv, hit
                    return self.add(**rec)
                if y and src == 'fs':
                    rec['ytd'] = [x for x, _ in y][:6]
            if m in ('eps', 'sh'):
                y = self.q4_ps(m, j, ours)
                tol = (lambda a, b: abs(a - b) <= TOL_PS) if m == 'eps' else (lambda a, b: abs(a - b) <= 5e-4 * abs(b))
                hit = next((w for x, w in y if tol(ours, x)), None)
                if hit:
                    rec['verdict'], rec['why'] = 'DERX', hit
                    return self.add(**rec)
                rec['cand'] = [x for x, _ in y][:6]
        if m == 'gp' and not c:
            # רווח גולמי שלא מודפס כשורה: הכנסות − עלות המכר, שניהם מאותה הגשה (או מאותו מצטבר ברבעון)
            fx = self.gp_cands(mode, j, e, qtrs)
            hit = next((w for x, w in fx if same(ours, x, u)), None)
            if hit:
                rec['verdict'], rec['why'] = 'DER', hit
                return self.add(**rec)
            if fx:
                rec['ytd'] = [x for x, _ in fx][:6]
        if any(same(ours, v, u) for v in cfv):
            # בדוחות מודפסת שורה אחרת למדד, ושלנו = תגית מהביאורים — ממצא למיון (מושג צר/רחב יותר?)
            rec['verdict'] = 'ALTCF' if c else 'NOFACE'
            rec['why'] = ('בדוח מודפס %s; שלנו = companyfacts (ביאור)' % (sorted({(x[4], x[6]) for x in c})[:3],)) if c else 'לא בדוחות עצמם; שווה ל־companyfacts'
            return self.add(**rec)
        fl = self.flag.get((m, e), set())
        if m == 'capex' and ours == 0 and 'cx0' in fl and not c:
            rec['verdict'], rec['why'] = 'CX0', 'השרתון: אין שורת השקעות הוניות בדוח (cx0) — ואכן אין בדוח המודפס'
            return self.add(**rec)
        if fl & {'qsh', 'qeps'} and not c:
            rec['verdict'], rec['why'] = 'PUB', 'רבעון שלא הודפס בדוח: הערך שהחברה פרסמה (השרתון, דרך Yahoo; %s) — לאימות מול ההודעה לעיתונות' % ','.join(sorted(fl))
            return self.add(**rec)
        if m in self.fill and mode == 'fy':
            rec['fill'] = 1  # השלמה שנתית מ־Yahoo
        if not c and not cfv and not rec.get('ytd'):
            rec['verdict'] = 'EXTRA'
            return self.add(**rec)
        rec['verdict'] = 'DIFF'
        rec['why'] = 'מודפס: %s · companyfacts: %s · מצטבר: %s' % (sorted({x[6] for x in c})[:4], sorted(cfv)[:4], rec.get('ytd', [])[:4])
        return self.add(**rec)

    def check_series(self, mode):
        arr = self.d['raw']['A'] if mode == 'fy' else self.d['raw']['Q']
        for m in MET:
            vals = arr.get(m)
            if vals is None:
                continue
            for j, e in enumerate(self.ends[mode]):
                self.judge(m, mode, j, e, vals[j] if j < len(vals) else None)

    def face_debt(self, rows):
        """החוב כפי שהוא במאזן המודפס של הגשה אחת — לפי השורות עצמן (גם תגיות של החברה: Caterpillar מפרידה מכונות/מימון).
        חוב = הלוואות קצרות / ניירות ערך מסחריים (st) + חלויות שוטפות (cur) + חוב לזמן ארוך (nc); חכירה מימונית בנפרד (lease).
        השורות: רק בצד ההתחייבויות (אחרי שורת סך הנכסים); שוטף/לא שוטף — לפי המיקום מול "סך התחייבויות שוטפות";
        שורת סכום־ביניים (שווה לסכום השורות שלפניה) — לא נספרת פעמיים. מחזיר (סכום, {סוג: סכום}, [(סוג, תווית, ערך)])"""
        rows = sorted(rows, key=lambda r: (r[14] or 0, r[5]))
        ln = {r[6]: (r[14] or 0, r[5]) for r in rows}
        a0 = ln.get('Assets')
        lc = ln.get('LiabilitiesCurrent')
        parts, used = [], []
        for r in rows:
            tag, lab, val, pos = r[6], INCL_RE.sub('', r[7] or ''), r[11], (r[14] or 0, r[5])
            if a0 and pos <= a0:
                continue
            txt = tag + ' ' + lab
            if NOT_DEBT_TAG.search(tag) or (DEBT_EXCL.search(txt) and tag not in DEBT_ALL) or (PAYABLE_LAB.search(lab) and not CP_RE.search(lab)):
                continue
            if tag in LEASE_FIN or (LEASE_RE.search(lab) and not DEBT_RE.search(re.sub(LEASE_RE, '', lab))):
                kind = 'lease'
            elif tag in DEBT_ALL or DEBT_RE.search(txt):
                if tag in DEBT_ST or ST_RE.search(lab):
                    kind = 'st'
                elif tag in DEBT_C or CUR_RE.search(lab):
                    kind = 'cur'
                elif lc and pos < lc:
                    kind = 'cur'  # בתוך ההתחייבויות השוטפות
                else:
                    kind = 'nc'
            else:
                continue
            # סכום־ביניים: שווה לסכום 2+ השורות האחרונות שנספרו
            acc, sub = 0, False
            for k in range(len(used) - 1, -1, -1):
                acc += used[k][2]
                if len(used) - k >= 2 and abs(acc - val) <= max(1e6, 1e-4 * abs(val)):
                    sub = True
                    break
            if sub:
                continue
            used.append((kind, lab, val))
        S = {}
        for kind, lab, val in used:
            S[kind] = S.get(kind, 0) + val
        tot = S.get('st', 0) + S.get('cur', 0) + S.get('nc', 0)
        return (tot if any(k in S for k in ('st', 'cur', 'nc')) else None), S, used

    def check_debt(self, mode):
        """חוב: מורכב משורות — מחושב מחדש מהמאזן המודפס של כל הגשה בנפרד (face_debt), ומאובחן: איזה צירוף של הרכיבים = שלנו"""
        arr = (self.d['raw']['A'] if mode == 'fy' else self.d['raw']['Q']).get('debt') or []
        for j, e in enumerate(self.ends[mode]):
            ours = arr[j] if j < len(arr) else None
            ddate = me(e)
            byf = {}
            for r in self.pr.by.get((ddate, 0), []):
                if r[3] == 'BS' and not r[4] and r[10] == self.cur:
                    byf.setdefault(r[0], [r[1], fdate(r[2]), []])[2].append(r)
            tots = []
            for adsh, (form, filed, rows) in byf.items():
                # עמודת מאזן = יש בה סך נכסים (Welltower: דוח 2017 מדווח ל־2015 רק ערך מביאור — לא המאזן של 2015)
                if not any(r[6] in ('Assets', 'LiabilitiesAndStockholdersEquity') for r in rows):
                    continue
                tot, S, used = self.face_debt(rows)
                if tot is None and 'lease' not in S:
                    continue
                tots.append(dict(form=form, filed=filed, total=tot or 0, S=S, used=used, adsh=adsh, rows=rows))
            rec = dict(m='debt', mode=mode, end=e, me=ddate, ours=ours)
            if not tots:
                if ours:
                    rec['verdict'] = 'NOFACE'
                    rec['why'] = 'אין שורות חוב במאזן המודפס'
                    self.add(**rec)
                continue
            ann = [t for t in tots if not t['form'].startswith('10-Q')]
            exp = max(ann or tots, key=lambda t: t['filed'])
            rec['exp'] = exp['total']
            rec['parts'] = [(k, l[:60], v) for k, l, v in exp['used']]
            rec['filings'] = [(t['form'], t['filed'], t['total']) for t in tots]
            miss = self.pr.debt_missing(exp['adsh'], exp['rows'])
            if ours is None:
                rec['verdict'] = 'MISS' if exp['total'] else 'NONE'
            elif same(ours, exp['total'], 'money'):
                rec['verdict'] = 'DER'
            elif miss:
                rec['verdict'] = 'PART'
                rec['why'] = 'במאזן שורות חוב שאין להן ערך בלי ממד (%s) — הצפוי חלקי; שלנו %s מול %s' % (', '.join(miss[:3]), ours, exp['total'])
            elif any(same(ours, t['total'], 'money') for t in tots):
                rec['verdict'] = 'OLD'
            else:
                S = exp['S']
                combos = {'בלי חלויות שוטפות': S.get('st', 0) + S.get('nc', 0), 'בלי הלוואות קצרות': S.get('cur', 0) + S.get('nc', 0),
                          'רק לזמן ארוך': S.get('nc', 0), 'כולל חכירה מימונית': exp['total'] + S.get('lease', 0),
                          'בלי הלוואות קצרות, כולל חכירה': S.get('cur', 0) + S.get('nc', 0) + S.get('lease', 0)}
                hit = next((k for k, v in combos.items() if v and same(ours, v, 'money')), None)
                rel = ours / exp['total'] - 1 if exp['total'] else None
                if hit == 'כולל חכירה מימונית':
                    rec['verdict'], rec['why'] = 'ALT', hit
                else:
                    rec['verdict'] = 'DIFF'
                    rec['why'] = '%sשלנו %s מול המאזן %s (%s %s; %s)' % ('[%s] ' % hit if hit else '', ours, exp['total'], exp['form'], exp['filed'],
                                                                      '%+.1f%%' % (rel * 100) if rel is not None else '')
            self.add(**rec)

    def run(self):
        for mode in ('fy', 'q'):
            self.check_series(mode)
            self.check_debt(mode)
        return self.res


# ---------------------------------------------------------------- שכבת הנגזרות: כל יחס במסך, מחושב מחדש (מימוש נפרד של ההגדרות)
INSTK = {'cash', 'msec', 'debt', 'eq', 'ta', 'tl', 'ca', 'cl', 're', 'ppe'}
CTX_KEYS = ['rev', 'gp', 'op', 'ni', 'eps', 'sh', 'ocf', 'capex', 'sbc', 'dep', 'int', 'fcf', 'fcfsbc', 'cashT', 'debt', 'eq', 'ta', 'tl', 'ca', 'cl', 're', 'ppe',
            'netcash', 'ebitda', 'ffo', 'dps', 'buy', 't', 'roic', 'roe', 'gm', 'om', 'nm', 'fcfm', 'ofm', 'cr', 'de', 'cov', 'conv']
UNIT = dict(rev='money', gp='money', op='money', ni='money', eps='ps', sh='sh', ocf='money', capex='money', sbc='money', dep='money', int='money',
            fcf='money', fcfsbc='money', cashT='money', debt='money', eq='money', ta='money', tl='money', ca='money', cl='money', re='money', ppe='money',
            netcash='money', ebitda='money', ffo='money', dps='ps', buy='money', t='pct', roic='pct', roe='pct', gm='pct', om='pct', nm='pct', fcfm='pct',
            ofm='pct', cr='num', de='num', cov='num', conv='pct')


def days(a, b):
    return (dt.date.fromisoformat(b) - dt.date.fromisoformat(a)).days


class Series:
    """הסדרות כמו שהמסך רואה אותן (A לפי שנים, Q לפי רבעונים, T = 12 חודשים מהשרתון) — עם אפשרות להחליף ערכים בערכי אמת"""

    def __init__(self, raw):
        self.fyE, self.q = raw['fyE'], raw['q']
        self.A = {k: list(v) for k, v in raw['A'].items()}
        self.Q = {k: list(v) for k, v in raw['Q'].items()}
        self.T = raw.get('T') or None
        self.C = raw.get('C')

    def qrun(self, a, b):
        if a < 0:
            return False
        return all(75 <= days(self.q[j - 1], self.q[j]) <= 105 for j in range(a + 1, b + 1))

    def qback(self, i, n=1):
        near = lambda j: 0 <= j < i and abs(days(self.q[j], self.q[i]) - 365.25 * n) <= 15 * n
        if near(i - 4 * n):
            return i - 4 * n
        for j in range(i - 1, -1, -1):
            if near(j):
                return j
        return -1

    def raw(self, k, kind, i, back=0):
        if kind == 'fy':
            j = i - back
            a = self.A.get(k) or []
            return a[j] if 0 <= j < len(a) else None
        Q = self.Q.get(k) or []
        if kind == 'q':
            j = self.qback(i, back) if back else i
            return Q[j] if 0 <= j < len(Q) else None
        if not back and self.T and self.T.get(k) is not None:
            return self.T[k]
        end = self.qback(len(self.q) - 1, back) if back else len(self.q) - 1
        if end < 0:
            return None
        if k in INSTK or k == 'sh':
            return Q[end] if end < len(Q) else None
        if not self.qrun(end - 3, end):
            return None
        xs = [Q[j] if j < len(Q) else None for j in range(end - 3, end + 1)]
        return None if any(x is None for x in xs) else sum(xs)

    def ctx(self, kind, i, back=0):
        v = lambda k: self.raw(k, kind, i, back)
        ann = 4 if kind == 'q' else 1
        o = {}
        o['rev'] = v('rev')
        o['gp'] = v('gp') if v('gp') is not None else (o['rev'] - v('cogs') if o['rev'] is not None and v('cogs') is not None else None)
        for k in ('op', 'ni', 'eps', 'sh', 'ocf', 'capex', 'sbc', 'dep', 'int'):
            o[k] = v(k)
        o['fcf'] = o['ocf'] - o['capex'] if o['ocf'] is not None and o['capex'] is not None else None
        o['fcfsbc'] = o['fcf'] - (o['sbc'] or 0) if o['fcf'] is not None else None
        o['cashT'] = v('cash') + (v('msec') or 0) if v('cash') is not None else None
        o['debt'] = v('debt') if v('debt') is not None else 0
        o['eq'], o['ta'] = v('eq'), v('ta')
        o['tl'] = v('tl') if v('tl') is not None else (o['ta'] - o['eq'] if o['ta'] is not None and o['eq'] is not None else None)
        for k in ('ca', 'cl', 're', 'ppe'):
            o[k] = v(k)
        o['netcash'] = o['cashT'] - o['debt'] if o['cashT'] is not None else None
        o['ebitda'] = o['op'] + o['dep'] if o['op'] is not None and o['dep'] is not None else None
        o['ffo'] = o['ni'] + o['dep'] if o['ni'] is not None and o['dep'] is not None else None
        o['dps'] = v('dps') if v('dps') is not None else (v('divp') / o['sh'] if v('divp') is not None and o['sh'] else None)
        o['buy'] = v('buy')
        pt, tx = v('pretax'), v('tax')
        o['t'] = min(max(tx / pt, 0.1), 0.35) if (pt is not None and pt > 0 and tx is not None) else 0.21
        ic = o['eq'] + o['debt'] - o['cashT'] if o['eq'] is not None and o['cashT'] is not None else None
        o['roic'] = o['op'] * (1 - o['t']) * ann / ic if o['op'] is not None and ic is not None and ic > 0 else None
        o['roe'] = o['ni'] * ann / o['eq'] if o['ni'] is not None and o['eq'] is not None and o['eq'] > 0 else None
        r = lambda x: x / o['rev'] if x is not None and o['rev'] else None
        o['gm'], o['om'], o['nm'], o['fcfm'], o['ofm'] = r(o['gp']), r(o['op']), r(o['ni']), r(o['fcf']), r(o['fcfsbc'])
        o['cr'] = o['ca'] / o['cl'] if o['ca'] and o['cl'] else None
        o['de'] = o['debt'] / o['eq'] if o['eq'] is not None and o['eq'] > 0 else None
        o['cov'] = o['op'] / o['int'] if o['op'] is not None and o['int'] is not None and o['int'] > 0 else None
        o['conv'] = o['fcf'] / o['ni'] if o['fcf'] is not None and o['ni'] is not None and o['ni'] > 0 else None
        return o


def visible(u, a, b):
    """הפער נראה במסך? (העיגול של התצוגה: אחוז — עשירית; כסף — 3 ספרות; מכפיל/יחס — עשירית/מאית; למניה — סנט)"""
    if a is None and b is None:
        return False
    if a is None or b is None:
        return True
    if u == 'pct':
        return abs(a - b) >= 0.0005
    if u == 'num':
        return abs(a - b) >= 0.005
    if u == 'ps':
        return abs(a - b) >= 0.005
    return abs(a - b) > max(0.5, 0.0005 * max(abs(a), abs(b)))


def truth_map(res):
    """(מדד, מצב, סוף) → ערך אמת: המאומת = שלנו; פער = הערך המודפס המועדף"""
    t = {}
    for r in res:
        v = r.get('verdict')
        if v in ('V3', 'V2', 'V1', 'DER', 'DERCF', 'DERX', 'NOFACE', 'NONE', 'EXTRA'):
            t[(r['m'], r['mode'], r['end'])] = r.get('ours')
        elif r.get('exp') is not None:
            t[(r['m'], r['mode'], r['end'])] = r['exp']
        else:
            t[(r['m'], r['mode'], r['end'])] = r.get('ours')
    return t


def check_derived(co):
    """(א) נוסחה: ctx מחושב כאן מהקלט שלנו = ctx במסך (עד 1e-9). (ב) השפעה: ctx מערכי האמת מול המסך — רק פער שנראה בעיגול של המסך."""
    d = co.d
    out = []
    ours = Series(d['raw'])
    tru = Series(d['raw'])
    tm = truth_map(co.res)
    for mode, S, ends in (('fy', tru.A, tru.fyE), ('q', tru.Q, tru.q)):
        for k, arr in S.items():
            for j, e in enumerate(ends):
                if j < len(arr) and (k, mode, e) in tm:
                    arr[j] = tm[(k, mode, e)]
    tru.T = None if d['raw'].get('T') is None else dict(d['raw']['T'])  # 12 החודשים מהשרתון — נבדקים בנפרד
    for mode in ('fy', 'q'):
        for pi, p in enumerate(d['per'][mode]):
            kind = p['kind']
            mine = d['ctx'][mode][pi]
            a = ours.ctx(kind, p['i'])
            b = tru.ctx(kind, p['i'])
            for k in CTX_KEYS:
                x, y, z = mine.get(k), a.get(k), b.get(k)
                if (x is None) != (y is None) or (x is not None and abs(x - y) > 1e-9 * max(1.0, abs(x))):
                    out.append(dict(layer='formula', mode=mode, per=p['label'], end=p['end'], k=k, screen=x, py=y))
                if visible(UNIT[k], x, z):
                    out.append(dict(layer='impact', mode=mode, per=p['label'], end=p['end'], k=k, screen=x, truth=z))
    return out


# ---------------------------------------------------------------- מחירים: הסגירה החודשית שלנו מול Nasdaq (יומי, 10 שנים, מותאם לפיצולים)
def nasdaq_daily(sym, cache):
    a = (dt.date.today() - dt.timedelta(days=3660)).isoformat()
    j = get_json('https://api.nasdaq.com/api/quote/%s/historical?assetclass=stocks&fromdate=%s&limit=9999&todate=%s' % (sym.replace('-', '.'), a, dt.date.today().isoformat()),
                 UA_WEB, os.path.join(cache, '%s_px.json' % sym))
    rows = (((j or {}).get('data') or {}).get('tradesTable') or {}).get('rows') or []
    out = {}
    for r in rows:
        try:
            mm, dd, yy = r['date'].split('/')
            out['%s-%s-%s' % (yy, mm, dd)] = money_txt(r['close'])
        except Exception:
            continue
    return out


def month_close(daily):
    m = {}
    for d in sorted(daily):
        if daily[d] is not None:
            m[d[:7]] = daily[d]
    return m


def add_months(ym, n):
    y, m = int(ym[:4]), int(ym[5:7]) + n
    while m > 12:
        m, y = m - 12, y + 1
    while m < 1:
        m, y = m + 12, y - 1
    return '%04d-%02d' % (y, m)


def ttm_points(S, k):
    """נקודות 12 חודשים לכל תאריך דיווח — מימוש נפרד של ההגדרה: שנה = המספר השנתי; בין שנים = 4 רבעונים רצופים; מאזן/מניות = הרבעון"""
    pts = []
    Q = S.Q.get(k) or []
    A = S.A.get(k) or []
    qat = {S.q[j] for j in range(len(S.q)) if j < len(Q) and Q[j] is not None} if k == 'sh' else set()
    for i, e in enumerate(S.fyE):
        if i < len(A) and A[i] is not None and e not in qat:
            pts.append((e, A[i]))
    fyat = {e for e, _ in pts}
    for j in range(3, len(S.q)):
        if S.q[j] in fyat:
            continue
        if S.T and j == len(S.q) - 1 and S.T.get(k) is not None:
            pts.append((S.q[j], S.T[k]))
            continue
        if k in INSTK or k == 'sh':
            if j < len(Q) and Q[j] is not None:
                pts.append((S.q[j], Q[j]))
            continue
        if not S.qrun(j - 3, j):
            continue
        xs = [Q[x] if x < len(Q) else None for x in range(j - 3, j + 1)]
        if all(x is not None for x in xs):
            pts.append((S.q[j], sum(xs)))
    return sorted(pts)


def at_month(pts, ym):
    v = None
    for e, x in pts:
        if add_months(e[:7], 2) <= ym:
            v = x
        else:
            break
    return v


def mult_hist(S, px_t, px_c):
    P = {k: ttm_points(S, k) for k in ('eps', 'rev', 'ocf', 'capex', 'sbc', 'op', 'sh', 'cash', 'msec', 'debt', 'eq', 'ni', 'dep')}
    out = {k: [] for k in ('t', 'pe', 'pfcf', 'pofcf', 'ps', 'evebit', 'pb', 'pffo')}
    if not px_t:
        return out
    first = add_months(px_t[-1], -120)
    for ym, c in zip(px_t, px_c):
        if ym < first or c is None:
            continue
        g = lambda k: at_month(P[k], ym)
        eps, sh, rev, ocf, cx, op = g('eps'), g('sh'), g('rev'), g('ocf'), g('capex'), g('op')
        cash = (g('cash') or 0) + (g('msec') or 0)
        debt = g('debt') or 0
        mc = c * sh if sh else None
        fcf = ocf - cx if ocf is not None and cx is not None else None
        out['t'].append(ym)
        out['pe'].append(c / eps if eps and eps > 0 else None)
        out['pfcf'].append(mc / fcf if mc and fcf and fcf > 0 else None)
        ofcf = fcf - (g('sbc') or 0) if fcf is not None else None
        out['pofcf'].append(mc / ofcf if mc and ofcf and ofcf > 0 else None)
        out['ps'].append(mc / rev if mc and rev and rev > 0 else None)
        out['evebit'].append((mc + debt - cash) / op if mc and op and op > 0 else None)
        eq, ni, dep = g('eq'), g('ni'), g('dep')
        ffo = ni + dep if ni is not None and dep is not None else None
        out['pb'].append(mc / eq if mc and eq and eq > 0 else None)
        out['pffo'].append(mc / ffo if mc and ffo and ffo > 0 else None)
    return out


def check_prices_mult(co, cache, net=True):
    """(1) מחירים חודשיים מול Nasdaq; (2) היסטוריית המכפילים: נוסחה (מהקלט שלנו) והשפעה (מערכי אמת + מחירי Nasdaq)"""
    d, s = co.d, co.s
    out = []
    px = s.get('px') or {}
    t, c = px.get('t') or [], px.get('c') or []
    mc = {}
    if net and not co.sym.endswith('.TA'):
        try:
            mc = month_close(nasdaq_daily(co.sym, cache))
        except Exception as e:
            out.append(dict(layer='px', err=str(e)[:200]))
    last_ym = t[-1] if t else None
    for ym, x in zip(t, c):
        if ym not in mc or ym == last_ym:  # החודש הנוכחי — עוד לא נסגר
            continue
        if x is None or abs(x - mc[ym]) > max(0.006, 5e-4 * mc[ym]):
            out.append(dict(layer='px', ym=ym, screen=x, nasdaq=mc[ym]))
    # הנקודה האחרונה בהיסטוריה = היום (המסך מחליף אותה במחיר החי וב־12 החודשים); משווים את כל השאר
    ours = Series(d['raw'])
    tru = Series(d['raw'])
    tm = truth_map(co.res)
    for mode, Sx, ends in (('fy', tru.A, tru.fyE), ('q', tru.Q, tru.q)):
        for k, arr in Sx.items():
            for j, e in enumerate(ends):
                if j < len(arr) and (k, mode, e) in tm:
                    arr[j] = tm[(k, mode, e)]
    # המסך מכפיל את המחירים לפי המטבע (prep) — כאן רק דולר/דולר
    H1 = mult_hist(ours, t, c)
    c2 = [mc.get(ym, x) if ym != last_ym else x for ym, x in zip(t, c)]
    H2 = mult_hist(tru, t, c2)
    M = d.get('mult') or {}
    n = len(M.get('t') or [])
    for k in ('pe', 'pfcf', 'pofcf', 'ps', 'evebit', 'pb', 'pffo'):
        scr = M.get(k) or []
        for i in range(max(0, n - 1)):
            a, b, z = scr[i], (H1[k][i] if i < len(H1[k]) else None), (H2[k][i] if i < len(H2[k]) else None)
            if (a is None) != (b is None) or (a is not None and abs(a - b) > 1e-6 * max(1, abs(a))):
                out.append(dict(layer='mformula', k=k, ym=M['t'][i], screen=a, py=b))
            if (a is None) != (z is None) or (a is not None and z is not None and abs(a - z) >= 0.05):
                out.append(dict(layer='mimpact', k=k, ym=M['t'][i], screen=a, truth=z))
    return out


# ---------------------------------------------------------------- צמיחה: מול השנה הקודמת כפי שהודפסה באותו דוח
GROW_K = ['rev', 'gp', 'op', 'ni', 'eps', 'sh', 'ocf']


def check_growth(co):
    """צמיחה שנה מול שנה. האמת = היחס בין התקופה למקבילה שלה כפי שהודפסו באותה הגשה (ההגשה האחרונה שהדפיסה את שתיהן —
    אותו בסיס חשבונאי). אין הגשה כזו (רבעון רביעי מחושב) → היחס בין ערכי האמת בסדרה, ברמת ביטחון נמוכה יותר.
    סוגים: DIFF (מול אותה הגשה) · DIFFS (מול הסדרה) · GAP (המסך ריק והחברה הדפיסה את שתיהן) · EXTRA (מספר בלי אמת)"""
    d = co.d
    out = []
    tru = Series(d['raw'])
    tm = truth_map(co.res)
    for mode, Sx, ends in (('fy', tru.A, tru.fyE), ('q', tru.Q, tru.q)):
        for k, arr in Sx.items():
            for j, e in enumerate(ends):
                if j < len(arr) and (k, mode, e) in tm:
                    arr[j] = tm[(k, mode, e)]
    S0 = Series(d['raw'])
    for mode in ('fy', 'q'):
        per = d['per'][mode]
        G = (d.get('views') or {}).get(mode, {}).get('g') or {}
        qtrs = 4 if mode == 'fy' else 1
        for pi, p in enumerate(per):
            if p['kind'] == 'ttm':
                continue
            e = p['end']
            if mode == 'fy':
                pe = d['raw']['fyE'][p['i'] - 1] if p['i'] > 0 else None
            else:
                jb = S0.qback(p['i'])
                pe = d['raw']['q'][jb] if jb is not None and jb >= 0 else None
            for k in GROW_K:
                if k not in MET:
                    continue
                scr = (G.get(k) or [None] * len(per))[pi]
                truth, src, cls = None, '', None
                if pe:
                    ca = co.pr.cands(k, me(e), qtrs, co.cur)
                    cb = co.pr.cands(k, me(pe), qtrs, co.cur)
                    both = {}
                    for x in ca:
                        for y in cb:
                            if x[1] == y[1] and x[4] == y[4] and y[6]:
                                both[x[1]] = (x[3], x[6], y[6], x[0])
                    if both:
                        f, va, vb, _ = max(both.values(), key=lambda v: (v[0], -v[3]))
                        truth = va / vb - 1 if vb > 0 else None
                        src, cls = 'אותה הגשה %s' % f, 'DIFF'
                if cls is None:
                    a = tru.ctx(p['kind'], p['i']).get(k)
                    b = tru.ctx(p['kind'], p['i'], 1).get(k)
                    truth = a / b - 1 if a is not None and b and b > 0 else None
                    src, cls = 'סדרה', 'DIFFS'
                if scr is None and truth is None:
                    continue
                if scr is None:
                    if cls == 'DIFF':  # החברה הדפיסה את שתי התקופות באותו דוח — אפשר היה להציג
                        out.append(dict(layer='growth', cls='GAP', mode=mode, per=p['label'], end=e, k=k, screen=None, truth=truth, src=src))
                    continue
                if truth is None:
                    out.append(dict(layer='growth', cls='EXTRA', mode=mode, per=p['label'], end=e, k=k, screen=scr, truth=None, src=src))
                    continue
                if visible('pct', scr, truth):
                    out.append(dict(layer='growth', cls=cls, mode=mode, per=p['label'], end=e, k=k, screen=scr, truth=truth, src=src))
    return out


# ---------------------------------------------------------------- תמונת מצב: שווי שוק, מכפיל, תשואת תזרים, מזומן נטו
_FX = {}


def fx_per_usd(cache):
    """שערי הייחוס של ה־ECB (יום העסקים האחרון) → כמה יחידות מטבע לדולר אחד. TWD לא מתפרסם שם (מ־2020) — חסר."""
    if _FX:
        return _FX
    path = os.path.join(cache, '_ecb.csv')
    if not os.path.exists(path) or time.time() - os.path.getmtime(path) > 86400:
        req = urllib.request.Request('https://data-api.ecb.europa.eu/service/data/EXR/D..EUR.SP00.A?lastNObservations=1&format=csvdata',
                                     headers={'User-Agent': UA_SEC})
        with urllib.request.urlopen(req, timeout=60) as r:
            open(path, 'wb').write(r.read())
    per_eur = {'EUR': 1.0}
    rows = list(csv.reader(open(path, encoding='utf-8')))
    h = {k: i for i, k in enumerate(rows[0])}
    for r in rows[1:]:
        if r[h['TIME_PERIOD']] >= (dt.date.today() - dt.timedelta(days=30)).isoformat():
            per_eur[r[h['CURRENCY']]] = float(r[h['OBS_VALUE']])
    usd = per_eur.get('USD')
    if usd:
        for k, v in per_eur.items():
            _FX[k] = v / usd
    return _FX


def check_facts(co, cache=None):
    d = co.d
    out = []
    # מטבע הדיווח ≠ מטבע המחיר (חברה זרה שמדווחת ב־DKK/EUR/CNY/TWD ונסחרת בדולר): המסך ממיר רק דולר↔שקל (prep)
    f0 = d.get('facts') or {}
    if d.get('cur') and d.get('pxCur') and d['cur'] != d['pxCur'] and not d.get('fxNote') and f0.get('pe'):
        rate = None
        try:
            rate = fx_per_usd(cache).get(d['cur']) if cache and d['pxCur'] == 'USD' else None
        except Exception as e:
            rate = None
        eps = d['price'] / f0['pe'] if d.get('price') else None
        out.append(dict(layer='def', k='fx_mix', cur=d['cur'], pxCur=d['pxCur'], screen=f0['pe'], rate=rate,
                        fixed=(d['price'] * rate / eps) if rate and eps else None,
                        note='מחיר ב־%s מחולק ברווח למניה ב־%s; בלי המרה ובלי יחס ADR' % (d['pxCur'], d['cur'])))
    f = d.get('facts') or {}
    price, sh = d.get('price'), d.get('sharesOut')
    # הגדרה: שווי שוק = מחיר × ממוצע המניות המדולל של הרבעון האחרון. החלופה המקובלת: המניות בפועל מעמוד השער (dei)
    best = None
    for (tag, ddate, qtrs, unit), vals in co.cfi.items():
        if tag == 'EntityCommonStockSharesOutstanding' and unit == 'shares':
            for v, fl in vals.items():
                for fd in fl:
                    if not best or fd > best[0]:
                        best = (fd, v, ddate)
    if best and price and sh:
        diff = sh / best[1] - 1
        out.append(dict(layer='def', k='mcap_shares', screen=sh, cover=best[1], cover_date=best[2], filed=best[0], diff=diff))
    return out


def summarize(res):
    out = {}
    for r in res:
        k = (r['m'], r['mode'])
        out.setdefault(k, {}).setdefault(r['verdict'], 0)
        out[k][r['verdict']] += 1
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--db', required=True)
    ap.add_argument('--w', required=True)
    ap.add_argument('--ciks', required=True)
    ap.add_argument('--syms', default='')
    ap.add_argument('--no-net', action='store_true', help='בלי companyfacts ו־Nasdaq (רק FSDS)')
    o = ap.parse_args()
    cik = {}
    for line in open(o.ciks, encoding='utf-8'):
        p = line.split()
        if len(p) >= 2:
            cik.setdefault(p[0].upper().replace('.', '-'), int(p[1]))
    prev = {34088: None}
    db = sqlite3.connect(o.db)
    dispd, snapd = os.path.join(o.w, 'disp'), os.path.join(o.w, 'snap')
    outd = os.path.join(o.w, 'out')
    cache = os.path.join(o.w, 'cache')
    os.makedirs(outd, exist_ok=True)
    os.makedirs(cache, exist_ok=True)
    syms = [s.strip().upper() for s in o.syms.split(',') if s.strip()] or sorted(f[:-5] for f in os.listdir(dispd) if f.endswith('.json'))
    tot = {}
    for s in syms:
        disp = json.load(open(os.path.join(dispd, s + '.json')))
        snap = json.load(open(os.path.join(snapd, s + '.json')))
        c = snap.get('cik')
        ck = int(c) if c else cik.get(s.replace('.', '-'))
        if not ck:
            print('%s: אין CIK' % s)
            continue
        cks = {ck}
        if ck == 2115436:
            cks.add(34088)  # Exxon: הישות הקודמת
        pr = Printed(db, cks)
        cfi, na, nqq = {}, {}, {}
        if not o.no_net:
            try:
                cf = get_json('https://data.sec.gov/api/xbrl/companyfacts/CIK%010d.json' % ck, UA_SEC, os.path.join(cache, 'cf_%d.json' % ck))
                cfi = cf_index(cf)
            except Exception as e:
                print('%s: companyfacts נכשל: %s' % (s, e))
            try:
                na = nasdaq(s, cache, 1)
                nqq = nasdaq(s, cache, 2)
            except Exception as e:
                print('%s: Nasdaq נכשל: %s' % (s, e))
        co = Co(s, disp, snap, pr, cfi, na, nqq)
        res = co.run()
        der = check_derived(co) + check_growth(co) + check_facts(co, cache) + check_prices_mult(co, cache, not o.no_net)
        json.dump(res, open(os.path.join(outd, s + '.json'), 'w'), ensure_ascii=False)
        json.dump(der, open(os.path.join(outd, s + '.der.json'), 'w'), ensure_ascii=False)
        json.dump(dict(splits=pr.splits, snap_splits=snap.get('splits'), used=snap.get('splitsUsed')), open(os.path.join(outd, s + '.meta.json'), 'w'))
        sm = {}
        for r in res:
            sm[r['verdict']] = sm.get(r['verdict'], 0) + 1
            tot[r['verdict']] = tot.get(r['verdict'], 0) + 1
        dl = {}
        for x in der:
            dl[x['layer']] = dl.get(x['layer'], 0) + 1
        print('%s: %d ערכים · %s · נגזרות: %s' % (s, len(res), ' '.join('%s=%d' % kv for kv in sorted(sm.items())), dl), flush=True)
    print('סה״כ: %s' % ' '.join('%s=%d' % kv for kv in sorted(tot.items())))


if __name__ == '__main__':
    sys.exit(main())
