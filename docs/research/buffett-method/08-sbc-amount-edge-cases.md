# 08 — איזה סכום SBC לנכות, ושלושה מקרי קצה (מחקר המשך, 19/11/2026)

> **ההיקף:** שאלת המשך למכפיל באפט (`docs/buffett-method-research.md` §13.1–13.3): איזה סכום תגמול במניות (SBC) לנכות מ"רווח הרחוב" כשההוצאה בדוח רווח והפסד שונה מהתוספת בדוח תזרים המזומנים. ובנוסף שלושה מקרי קצה שמצאה הבדיקה המקבילה: ‏τ לקרנות ריט ולחברות בלי שורת מס, ‏τ כשחסר רבעון של רווח לפני מס, וסדרת "רחוב" שכוללת רווחי השקעות.
> **מקרא:** רמה A = כתבי באפט, ‏FASB/SEC, דיווחי החברות ל־SEC · ‏B = באפט בעל פה · ‏C = ארבע הגדולות, אקדמיה · ‏D = פופולרי/ספקי נתונים. סטטוס: **אומת** = נשלף ונקרא · **קטע חיפוש** = נראה רק בתקציר של מנוע חיפוש · **מהזיכרון — לא אומת**.
> **מספרים** במיליוני דולר, אלא אם צוין אחרת. "רבעון" = הרבעון הפיסקלי של החברה. כל השליפות מ־EDGAR נעשו ב־19/11/2026 (קצב ≤ 4 בקשות לשנייה).

---

## 1. למה התוספת בתזרים (`ShareBasedCompensation`) שונה מההוצאה בדוח הרווח (`AllocatedShareBasedCompensationExpense`)?

### Takeaway
התגיות מודדות דברים שונים בהגדרה: תגית התזרים היא "הוצאה שאינה במזומן" כפי שהחברה בחרה להציג בשורה אחת בתזרים, ותגית ההוצאה היא "הוצאה על הענקה… **לא כולל הסכום שהוון**". הפער נובע משישה מנגנונים: היוון (מלאי, תוכנה, סרטים, נכסי נפט וגז), הענקות שמסווגות כהתחייבות (נפרעות במזומן או נמדדות מחדש), ‏SBC של חברה בת או של רכישות שמחוץ לטבלת הביאור, ‏SBC בשורות ארגון מחדש ורכישה, תגמול אחר שאינו במזומן שמצורף לשורה, וטעויות תיוג (סכום חלקי, סימן הפוך). במדגם של כל החברות ב־SEC לשנת 2024, ב־17% מהחברות הגדולות שמדווחות את שתי התגיות הן שונות ביותר מ־1%, ובשני הכיוונים. לכן אף אחת מהתגיות לבדה אינה "נכונה" בכל מקום.

### Cited Findings
**הגדרות התגיות (FASB, דרך ה־API של SEC)**
- `ShareBasedCompensation`: label "Share-based Payment Arrangement, Noncash Expense", הגדרה: "Amount of noncash expense for share-based payment arrangement." — [SEC XBRL API, CAH](https://data.sec.gov/api/xbrl/companyconcept/CIK0000721371/us-gaap/ShareBasedCompensation.json) · A · **אומת**.
- `AllocatedShareBasedCompensationExpense`: label "Share-based Payment Arrangement, Expense", הגדרה: "Amount of expense for award under share-based payment arrangement. **Excludes amount capitalized.**" — [SEC XBRL API, CAH](https://data.sec.gov/api/xbrl/companyconcept/CIK0000721371/us-gaap/AllocatedShareBasedCompensationExpense.json) · A · **אומת**.
  - בעברית: תגית התזרים = מה שלא יצא במזומן ונוסף חזרה בתזרים. תגית ההוצאה = מה שנרשם כהוצאה בתקופה, **בלי** מה שהוון לנכס.
- תגית ההיוון: `EmployeeServiceShareBasedCompensationAllocationOfRecognizedPeriodCostsCapitalizedAmount`, label "Share-based Payment Arrangement, Amount Capitalized", הגדרה: "Amount of cost capitalized for award under share-based payment arrangement." — [SEC frames API](https://data.sec.gov/api/xbrl/frames/us-gaap/EmployeeServiceShareBasedCompensationAllocationOfRecognizedPeriodCostsCapitalizedAmount/USD/CY2024.json) · A · **אומת**.
- תגית דוח השינויים בהון: `AdjustmentsToAdditionalPaidInCapitalSharebasedCompensationRequisiteServicePeriodRecognitionValue` — "Amount of increase to additional paid-in capital (APIC) for recognition of cost for award under share-based payment arrangement." — [SEC frames API](https://data.sec.gov/api/xbrl/frames/us-gaap/AdjustmentsToAdditionalPaidInCapitalSharebasedCompensationRequisiteServicePeriodRecognitionValue/USD/CY2024.json) · A · **אומת**. (רק הענקות שמסווגות כהון. הענקות שמסווגות כהתחייבות לא עוברות בהון.)
- קיום התגיות בטקסונומיה של 2025 (קובץ הסכמה הורד ונבדק): `ShareBasedCompensation`, `AllocatedShareBasedCompensationExpense`, `AllocatedShareBasedCompensationExpenseNetOfTax`, `EmployeeServiceShareBasedCompensationAllocationOfRecognizedPeriodCostsCapitalizedAmount`, `EmployeeBenefitsAndShareBasedCompensation`, `DeferredCompensationSharebasedArrangementsLiabilityClassifiedNoncurrent`, `ShareBasedCompensationArrangementByShareBasedPaymentAwardEquityInstrumentsOtherThanOptionsShareBasedLiabilitiesPaid`, `EmployeeServiceShareBasedCompensationTaxBenefitFromCompensationExpense`, `EquitySecuritiesFvNiGainLoss`, `EquitySecuritiesFvNiUnrealizedGainLoss`, `CurrentIncomeTaxExpenseBenefit`, `DeferredIncomeTaxExpenseBenefit` — [us-gaap-2025.xsd](https://xbrl.fasb.org/us-gaap/2025/elts/us-gaap-2025.xsd) · A · **אומת**. **אין** בטקסונומיה תגית בשם `ShareBasedPaymentArrangementExpense`.

**מנגנון 1 — היוון (מלאי ועלות המכר, תוכנה, סרטים, נכסי נפט וגז)**
- סגל ה־SEC, ‏SAB 107 (כיום Topic 14.I), 29/3/2005: "Company K has determined that the cost of the production employees' service is an inventoriable cost. As such, Company K is required to initially capitalize the cost of the share option grants to these production employees as inventory and later recognize the cost in the income statement when the inventory is consumed." — [SAB 107](https://www.sec.gov/interps/account/sab107.pdf) · A · **אומת**.
  - בעברית: התגמול של עובדי ייצור נכנס קודם למלאי, ויוצא כהוצאה (עלות המכר) רק כשהמלאי נמכר.
- Deloitte: ‏ASC 718 לא קובע שכל העלות נרשמת מיד כהוצאה, ומפנה למלאי (ASC 330), תוכנה מהוונת (ASC 350-40, ‏ASC 985-20) ורכוש קבוע (ASC 360); תוכנה מהוונת מופחתת אחר כך לפי ASC 350-40 — [Deloitte Roadmap, 3.13](https://dart.deloitte.com/USDART/home/codification/expenses/71x/asc718-10/roadmap-share-based-payments/chapter-3-recognition/3-13-capitalization-compensation-cost) · C · **קטע חיפוש** (העמוד נטען רק ב־JavaScript ולא נקרא).
- Deloitte, דוח תזרים: "An entity would present the compensation cost recognized in net income in each reporting period as a reconciling item in arriving at cash flows from operations." — [Deloitte Roadmap, תזרים 7.3](https://dart.deloitte.com/USDART/home/codification/presentation/asc230-10/roadmap-statement-cash-flow/chapter-7-common-issues-related-cash/7-3-stock-compensation) · C · **קטע חיפוש**.
  - בעברית: בתזרים מוסיפים חזרה את מה שנרשם **ברווח הנקי** בתקופה, לא את מה שהוון.
- **Disney, שנת 2024** (דוגמה מספרית): "Total equity-based compensation expense(1) 1,366 … Equity-based compensation expense capitalized during the period $201" · הערה (1): "Equity-based compensation expense is net of capitalized equity-based compensation and estimated forfeitures and excludes amortization of previously capitalized equity-based compensation costs." · בתזרים: "Equity-based compensation 1,366" — [Disney 10-K 2024](https://www.sec.gov/Archives/edgar/data/1744489/000174448924000276/dis-20240928.htm) · A · **אומת**.
  - בעברית: אצל Disney שתי התגיות שוות (1,366), שתיהן **בלי** 201 שהוונו (לעלויות סרטים), ובלי ההפחתה של מה שהוון בעבר. ההפחתה הזו יוצאת ברווח דרך הפחתת עלויות התוכן.
- **APA, שנת 2025**: "Total stock-settled and cash-settled compensation expensed 107 … Stock-settled and cash-settled compensation capitalized 15 … Total … costs $122" ו־"Costs related to the plans are capitalized or expensed to 'Lease operating expenses,' 'Exploration,' or 'General and administrative'" — [APA 10-K 2025](https://www.sec.gov/Archives/edgar/data/1841666/000184166626000015/apa-20251231.htm) · A · **אומת**.

**מנגנון 2 — הענקות שמסווגות כהתחייבות (נפרעות במזומן או נמדדות מחדש)**
- ‏**APA**: "The Company grants various types of stock-based awards including stock options, restricted stock, cash-settled restricted stock units, and performance-based awards… Cash-settled awards are recorded as a liability based on the Company's stock price and remeasured at the end of each reporting period" ו־"The restricted stock phantom unit awards represent a hypothetical interest in the Company's common stock, and, once vested, are settled in cash." — [APA 10-K 2025](https://www.sec.gov/Archives/edgar/data/1841666/000184166626000015/apa-20251231.htm) · A · **אומת**. ל־APA **אין** בכלל ערך `ShareBasedCompensation` ב־XBRL (רק `AllocatedShareBasedCompensationExpense` שנתי, 107 ב־2025) — [SEC companyfacts, APA](https://data.sec.gov/api/xbrl/companyfacts/CIK0001841666.json) · A · **אומת**.
- ‏**PANW**: שורת התזרים נקראת "Share-based compensation for equity-based awards", ובמדיניות החשבונאית: "Amounts diversified are accounted for as liability-classified awards… Liability-classified awards are measured at fair value on a recurring basis through distribution with changes in fair value recorded as share-based compensation." — [PANW 10-K 2026](https://www.sec.gov/Archives/edgar/data/1327567/000132756726000023/panw-20260731.htm) · A · **אומת**.

**מנגנון 3 — ‏SBC של חברה בת או של רכישות, מחוץ לטבלת הביאור**
- ‏**CAH**: שורת התזרים "Share-based compensation" ‏367 (שנה פיסקלית 2026) = ‏122 (התוכניות של Cardinal) + ‏245 (יחידות The Specialty Alliance, ‏"classified as liabilities under… ASC 718"). פירוט מלא בסעיף 2 — [CAH 10-K 2026](https://www.sec.gov/Archives/edgar/data/721371/000072137126000038/cah-20260630.htm) · A · **אומת**.

**מנגנון 4 — ‏SBC בשורות ארגון מחדש ורכישה**
- ‏CAH: "If awards are modified in connection with a restructuring activity, the incremental share-based compensation expense is classified in restructuring and employee severance." — [CAH 10-K 2026](https://www.sec.gov/Archives/edgar/data/721371/000072137126000038/cah-20260630.htm) · A · **אומת**.
- ‏PANW: האצת הבשלה בגלל רכישות CyberArk ו־Koi, ‏177 ברבעון שהסתיים ב־30/4/2026; בהודעה לעיתונות, "Acquisition-related costs" כוללים "share-based compensation related to the cash settlement of certain equity awards" — ראו סעיף 2 · A · **אומת**.

**מנגנון 5 — מה שהבדיקה רוצה לדעת ולא אומת כאן**
- פעילויות שהופסקו: התזרים מוצג לכל החברה, ולעיתים הביאור מתייחס לפעילות הנמשכת בלבד → תגית התזרים גדולה יותר — **מהזיכרון — לא אומת** (לא נמצאה כאן דוגמה בדיווח).
- ‏ESPP, התאמת 401(k) במניות, שכר דירקטורים במניות ותגמול נדחה במניות שמצורפים לשורת התזרים — **מהזיכרון — לא אומת** כדוגמה ספציפית. הדפוס הסטטיסטי למטה (37 חברות שבהן תגית התזרים = הגידול בהון) עקבי עם זה, אבל לא מוכיח אותו.

**כמה זה נפוץ — מדגם כל החברות ב־SEC, שנה קלנדרית 2024** (חישוב שלנו מה־frames API, ערכים בלי ממדים)
- 4,583 חברות מדווחות `ShareBasedCompensation`, ‏3,105 מדווחות `AllocatedShareBasedCompensationExpense`, ‏2,763 את שתיהן, 331 את תגית ההיוון — [frames ShareBasedCompensation](https://data.sec.gov/api/xbrl/frames/us-gaap/ShareBasedCompensation/USD/CY2024.json), ‏[frames Allocated](https://data.sec.gov/api/xbrl/frames/us-gaap/AllocatedShareBasedCompensationExpense/USD/CY2024.json) · A · **אומת** (החישוב שלנו).
- מתוך 593 חברות עם שתי התגיות ו־SBC של ‏$50M ומעלה: ‏**99 (17%) שונות ביותר מ־1%**. ב־49 תגית התזרים גדולה יותר, וב־50 תגית ההוצאה. 37 = תגית התזרים שווה לגידול בהון; 12 = תגית ההוצאה שווה לגידול בהון; 2 = ההוצאה = התזרים + ההיוון (Alexandria: ‏59.6 + ‏58.8 = ‏118.4); 1 = התזרים = ההוצאה + ההיוון (ICE); 47 ללא הסבר אוטומטי — אותו מקור · A · **אומת** (החישוב שלנו).
- דוגמאות לתיוג חלקי או שגוי: Fidelity National Information Services — תזרים 186 מול "הוצאה" 3; ‏Biogen — "הוצאה" שלילית (‎−301.5) מול תזרים 291.2 — אותו מקור · A · **אומת** (הנתון); הפרשנות "תיוג חלקי/שגוי" היא היסק.
- מתוך 51 חברות גדולות שמיוונות יותר מ־5% מה־SBC, ברוב המקרים שתי התגיות **שוות** (למשל Disney ‏1,366/1,366 עם 201 מהוונים; Tesla ‏1,999/1,999 עם 198; DoorDash ‏1,099/1,099 עם 165) — אותו מקור · A · **אומת** (הנתון).

### Inferences
- **ההיוון כמעט אף פעם אינו הסיבה לפער בין התגיות**: רוב החברות שמיוונות מדווחות בשתי התגיות את הסכום **נטו מההיוון** (Disney כתבה זאת במפורש). הפער האמיתי בא בעיקר מהענקות שמסווגות כהתחייבות, מ־SBC של חברות בנות ורכישות, ומתיוג. היוצא מן הכלל — Alexandria — מתייגת את ה"הוצאה" **כולל** ההיוון, בניגוד להגדרת התגית.
- הקשר בין המנגנון לכיוון הפער:

| מנגנון | איזו תגית גדולה יותר | דוגמה שאומתה |
|---|---|---|
| היוון (כשהחברה מוסיפה בתזרים את הכל) | תזרים | ‏ICE (2024): ‏231 מול 207 |
| היוון (כשה"הוצאה" מתויגת כולל ההיוון) | הוצאה | ‏Alexandria: ‏118 מול 60 |
| הענקות שמסווגות כהתחייבות, כשהתזרים "רק להענקות הוניות" | הוצאה | ‏PANW: ‏684 מול 643 |
| ‏SBC של חברה בת/רכישה מחוץ לטבלת הביאור | תזרים | ‏CAH: ‏367 מול 122 |
| תיוג חלקי/שגוי | כל כיוון | ‏FIS, ‏Biogen |

### Gaps
- המדריכים של PwC ו־KPMG לא נקראו (ה־Viewpoint והמדריך ב־PDF לא נשלפו). ‏Deloitte רק בקטעי חיפוש. הטענות העקרוניות נשענות על SAB 107 ועל הגדרות FASB (רמה A).
- הסיבה לפער של 13 אצל PANW בין דוח השינויים בהון (1,787) לבין התזרים (1,774) לא נמצאה בדוח.

---

## 2. אימות שני המקרים מהמקור: CAH ו־PANW

### Takeaway
**CAH**: ה־non-GAAP **אינו** מוציא את ה־SBC הרגיל (122 בשנה, 29 ברבעון), כך שעבור ה־SBC הרגיל השאלה "367 או 122" לא רלוונטית: הניכוי הנכון הוא 0. מה שמוצא הוא שורה אחת של תגמול שקשור לרכישות (תשלומים מותנים במזומן + יחידות של חברה בת), וזו שאלה של רכישה, לא של SBC רגיל. **PANW**: ההודעה מוציאה 517 בשורת ה־SBC (כולל מס מעסיק). את רוב ההפרש עד 684 (ההאצה של 177) היא מוציאה בשורת הרכישות. כלומר ה־non-GAAP מוציא את כל **684** (ההוצאה בדוח הרווח), לא את 643. הסכום שמתאים לניכוי "חוזר" הוא 517.

### Cited Findings — CAH (Cardinal Health, שנה פיסקלית שמסתיימת ב־30/6)
- תזרים, שנת 2026: "Share-based compensation | 367 | 244 | 121" (2026/2025/2024) — [CAH 10-K 2026](https://www.sec.gov/Archives/edgar/data/721371/000072137126000038/cah-20260630.htm) · A · **אומת**.
- הביאור: "Restricted share unit expense 72 … Performance share unit expense 50 … Total share-based compensation expense $122" ו־"Share-based compensation expense is included in selling, general, and administrative expenses" — שם · A · **אומת**. (תגית `AllocatedShareBasedCompensationExpense` = ‏122 — [SEC XBRL API](https://data.sec.gov/api/xbrl/companyconcept/CIK0000721371/us-gaap/AllocatedShareBasedCompensationExpense.json) · A · **אומת**.)
- היחידות של החברה הבת: "These Specialty Alliance Units are classified as liabilities under Accounting Standards Codification ("ASC") 718" · "The fair value of the Specialty Alliance Units is remeasured at each reporting period using a discounted cash flow method." · "Share-based compensation expense associated with these awards of $245 million and $123 million was recognized during fiscal 2026 and 2025, respectively. Of the expense recognized during fiscal 2026 and 2025, $238 million and $120 million is included in acquisition-related cash and share-based compensation costs and $7 million and $3 million is included in SG&A expenses" — שם · A · **אומת**.
  - בעברית: 367 = ‏122 (התוכניות של Cardinal, בהנהלה וכלליות) + ‏245 (יחידות של החברה הבת, התחייבות שנמדדת מחדש; 238 מהן בשורת הרכישות ו־7 בהנהלה וכלליות).
- רבעון 1 של שנת 2027 (עד 30/9/2026): תזרים "Share-based compensation | 109"; ביאור: "there was $80 million … of expense … for the Specialty Alliance Units… $78 million … is included in acquisition-related cash and share-based compensation costs… and $2 million is included in SG&A" — [CAH 10-Q](https://www.sec.gov/Archives/edgar/data/721371/000072137126000043/cah-20260930.htm) · A · **אומת**. (‏109 = ‏29 + ‏80; ‏XBRL: תזרים 109, הוצאה 29 — [SEC XBRL API](https://data.sec.gov/api/xbrl/companyconcept/CIK0000721371/us-gaap/ShareBasedCompensation.json).)
- הגדרת ה־non-GAAP (רשימה סגורה): "Non-GAAP operating earnings: operating earnings excluding (1) LIFO charges/(credits), (2) state opioid assessment related to prior fiscal years, (3) restructuring and employee severance, (4) amortization and other acquisition-related costs, (5) acquisition-related cash and share-based compensation costs, (6) impairments and (gain)/loss on disposal of assets, net, and (7) litigation (recoveries)/charges, net." — [CAH EX-99.1, 5/11/2026](https://www.sec.gov/Archives/edgar/data/721371/000072137126000042/a27q1_x093026xex991xnewsre.htm) · A · **אומת**.
- הנימוק של החברה: "Acquisition-related cash and share-based compensation costs are incurred in connection with contingent cash payments or the issuance of share-based payment awards, which include service requirements, as a part of certain physician practice acquisitions. These costs include fair value adjustments for liability-classified awards." — שם · A · **אומת**.
- הגישור ברבעון: "Acquisition-related cash & share-based compensation costs | 94 | 94 | 5 | 89 | 0.38" (לפני מס / מס / אחרי מס / למניה); ‏non-GAAP diluted EPS ‏$3.26; שיעור מס non-GAAP ‏18.5% — שם · A · **אומת**. מ־0.38 = ‏89 ÷ מניות → כ־234 מיליון מניות מדוללות (חישוב שלנו).
- היחידות לא מוכרות לצורכי מס: "Included in the effective tax rate for fiscal 2026 and 2025 were non-deductible share-based compensation costs for The Specialty Alliance" — [CAH 10-K 2026](https://www.sec.gov/Archives/edgar/data/721371/000072137126000038/cah-20260630.htm) · A · **אומת**. (לכן המס על השורה רק 5 מתוך 94.)
- ההיקף ממשיך: עלות שטרם הוכרה $407M על פני כ־4 שנים; ברכישת Solaris הונפקו יחידות בשווי של כ־$500M — שם ו־[CAH 10-Q](https://www.sec.gov/Archives/edgar/data/721371/000072137126000043/cah-20260930.htm) · A · **אומת**.

### Cited Findings — PANW (Palo Alto Networks, שנה פיסקלית שמסתיימת ב־31/7)
- הרבעון שהבדיקה קראה לו "Q4 2026" הוא **הרבעון השלישי של שנת 2026** (2/2026–4/2026). ‏XBRL: הוצאה 684 ברבעון; תזרים 1,314 (9 חודשים) פחות 671 (6 חודשים) = ‏643 — [SEC XBRL API, PANW](https://data.sec.gov/api/xbrl/companyconcept/CIK0001327567/us-gaap/AllocatedShareBasedCompensationExpense.json) · A · **אומת**.
- תזרים (9 חודשים): "Share-based compensation for equity-based awards | 1,314"; ביאור: "Total share-based compensation | $684 (3 months) | … | $1,355 (9 months)" — [PANW 10-Q, 30/4/2026](https://www.sec.gov/Archives/edgar/data/1327567/000132756726000015/panw-20260430.htm) · A · **אומת**.
- ההאצה: "During the three and nine months ended April 30, 2026, the vesting of certain equity awards was accelerated in connection with our acquisitions of CyberArk and Koi; as a result, we recorded share-based compensation of $177 million" — שם · A · **אומת**.
- שנה מלאה 2026: ביאור 1,815; תזרים 1,774; דוח השינויים בהון 1,787 — [PANW 10-K 2026](https://www.sec.gov/Archives/edgar/data/1327567/000132756726000023/panw-20260731.htm) · A · **אומת**.
- ההודעה לעיתונות של הרבעון: "Share-based compensation-related charges | 517 | 355 | 1,225 | 1,014" · "Acquisition-related costs(1) | 198 | 7 | 227 | 32" · ‏non-GAAP EPS ‏$0.85 על 807 מיליון מניות · הערה (1): "Consists of acquisition transaction costs, share-based compensation related to the cash settlement of certain equity awards, change in fair value of contingent consideration liability, and costs to terminate certain employment, operating lease, and other contracts of the acquired companies." · ההגדרה: "share-based compensation-related charges, including share-based payroll tax expense" — [PANW EX-99.1, 2/6/2026](https://www.sec.gov/Archives/edgar/data/1327567/000132756726000012/ex991q326earningsrelease.htm) · A · **אומת**.
- רבעון 4: השורה 487, ובשנה 1,712 — [PANW EX-99.1, 1/9/2026](https://www.sec.gov/Archives/edgar/data/1327567/000132756726000019/ex991q426earningsrelease.htm) · A · **אומת**. רבעון 1 של 2027 (עד 31/10/2026): השורה 622; דוח 10-Q לרבעון הזה עדיין לא הוגש ביום השליפה — [PANW EX-99.1, 18/11/2026](https://www.sec.gov/Archives/edgar/data/1327567/000132756726000030/ex991q127earningsrelease.htm) · A · **אומת**.

### Inferences
- **PANW — לאן הלכו 684**: השורה בהודעה (517) קטנה מההוצאה (684) ב־167, והיא כוללת גם מס מעסיק. מכאן שלפחות 167 מה־SBC יושבים בשורה אחרת בגישור. השורה היחידה שמתאימה היא "Acquisition-related costs" (198). זה מתאים בדיוק להאצה של 177: ‏684 − 177 = ‏507, ועוד מס מעסיק של כ־10 = ‏517. אותו חשבון ב־9 חודשים: ‏1,355 − 177 = ‏1,178, ומס מעסיק 47 → ‏1,225. ובשנה: ‏1,815 − 177 = ‏1,638, ומס מעסיק 74 → ‏1,712. (היסק. החברה לא מפרטת את מס המעסיק.)
- **מסקנה ל־PANW**: ה־non-GAAP הוציא את **כל 684** (ההוצאה בדוח הרווח), בשתי שורות. 643 (התזרים) מחסיר את ההענקות שמסווגות כהתחייבות, ולכן אינו מה שהוצא. לפי §13.3 (מס מעסיק מנוכה כשבאותה שורה; ‏SBC בשורת רכישה מטופל עם הרכישה), הניכוי החוזר הוא **517**, וההאצה (177) עוברת לכלל הרכישות/החד־פעמיים.
- **השפעה ברבעון** (τ = 21% לצורך ההמחשה, 807 מיליון מניות, רחוב $0.85): ‏517 → ניכוי ‏$0.506, ‏EPS באפט ‏$0.344 · ‏643 → ‏$0.629 / ‏$0.221 · ‏684 → ‏$0.670 / ‏$0.180. ברבעון בודד הבחירה משנה את הרווח פי 2. ב־12 חודשים ההשפעה קטנה בהרבה (הבדיקה המקבילה מדדה כ־1.45% באריח).
- **CAH**: עבור ה־SBC הרגיל השאלה לא רלוונטית: 29 ברבעון (122 בשנה) כבר מנוכים מהרחוב ($3.26). השורה שהוצאה (94 ברבעון: 78 יחידות + כ־16 מזומן מותנה, חישוב שלנו) היא תגמול שקשור לרכישות. אם המסווג של ההודעות מזהה ב־CAH "מוציאה SBC" בגלל המילים "share-based compensation" בשורה הזו, ומנכה 109 × (1 − 0.185) ÷ 234 = ‏**$0.38 (‏11.7%)**, הניכוי שגוי. גם ניכוי 29 (‏$0.10, ‏3.1%) שגוי, כי ה־29 כבר בפנים.
- **האם באפט היה מנכה את השורה של CAH?** בעד: זה תגמול (לפי GAAP, בגלל דרישת השירות), חוזר בכל רבעון מאז 2025 (לפי C&DI 100.01, הוצאה שחוזרת "repeatedly or occasionally" היא חוזרת), ו־$407M נוספים בדרך. נגד: זו חלק מהתמורה על רכישת מרפאות, ובאפט מחזיר לרווח חיובים חשבונאיים של רכישות (§13.2). לכן ההחלטה כאן היא של המשתמש: לטפל בשורה לפי כלל החזרה של §13.6 (3 מתוך 8 רבעונים ← לנכות אחרי המס **שלה**, 5/94 ≈ 5%). ב־CAH הניכוי היה ‏$0.38 (‏$3.26 → ‏$2.88).

### Gaps
- הפיצול המדויק של 198 ("Acquisition-related costs" של PANW) לא פורסם. ה־177 בשורה הזו הוא היסק חזק, לא ציטוט.
- הסיבה המדויקת לפער של 41 אצל PANW (684 − 643) לא מפורטת. היא עקבית עם הענקות שמסווגות כהתחייבות (תגמול נדחה שגוון, ו"cash settlement of certain equity awards"), אבל לא הוכחה.

---

## 3. איזה סכום נכון לנכות — הלוגיקה ובאפט

### Takeaway
לרווח של רבעון: לנכות **בדיוק את מה שהחברה הוציאה** בהודעה (השורה בגישור), כי רווח הרחוב בנוי על ההוצאה הזו. בלי הודעה — את **ההוצאה בדוח הרווח** (`AllocatedShareBasedCompensationExpense`, אחרי בדיקות שפיות), לא את התזרים. באפט מודד את העלות לפי **שווי ההענקות** (מה שהחברה הייתה מקבלת ממכירתן לציבור), בממוצע של 5 שנים. כלומר העלות נרשמת בעת ההענקה והשירות, בלי קשר להיוון. אבל בגלל שה־SBC שהוון כבר יוצא דרך ההפחתה בתוך רווח הרחוב, ניכוי שלו שוב ברווח הרבעוני הוא כפילות. אצלו יש לו מקום רק ב"רווח בעלים" (1986).

### Cited Findings
- באפט 1998, השיטה: "When we consider investing in an option-issuing company, we make an appropriate downward adjustment to reported earnings, simply subtracting an amount equal to what the company could have realized by publicly selling options of like quantity and structure. Similarly, if we contemplate an acquisition, we include in our evaluation the cost of replacing any option plan." — [1998](https://www.berkshirehathaway.com/letters/1998pdf.pdf) · A · **אומת** (הערה 01).
  - בעברית: מנכים את מה שהחברה הייתה מקבלת אילו מכרה את אותן אופציות לציבור. כלומר שווי ההענקה, לא הוצאה חשבונאית.
- באפט 1998, "מכונית חברה": "Giving an employee a company car that can only be used for certain purposes diminishes its value to the employee, but does not in the least diminish its cost to the employer." — [1998](https://www.berkshirehathaway.com/letters/1998pdf.pdf) · A · **אומת** (הערה 01).
- אסיפת 1999: "If we look at what a company issues in options over, say, a five-year period, and divide by fives, because the grants are irregular… how much could the company have received for those options if they sold them as warrants to the public?" — [תמליל 1999](https://www.good-investing.net/berkshire-hathaway-annual-meeting/transcripts/1999-transcript/) · B · **אומת** (הערה 07).
  - בעברית: ממוצע של 5 שנות הענקות, בתמחור של כתבי אופציה לציבור.
- באפט 2015: "If compensation isn't an expense, what is it? And, if real and recurring expenses don't belong in the calculation of earnings, where in the world do they belong?" — [2015](https://www.berkshirehathaway.com/letters/2015ltr.pdf) · A · **אומת** (הערה 01).
- באפט 1986, רכיב (c) ברווח הבעלים: "the average annual amount of capitalized expenditures for plant and equipment, etc. that the business requires to fully maintain its long-term competitive position and its unit volume." — [1986](https://www.berkshirehathaway.com/letters/1986.html) · A · **אומת** (הערה 05).
- ‏SAB 107, ‏Topic 14.G: מדד שמוציא את הוצאת התגמול במניות הוא non-GAAP כי "it excludes an amount (share-based payment expense) that is included in the most directly comparable measure calculated and presented in accordance with GAAP (net income)" — [SAB 107](https://www.sec.gov/interps/account/sab107.pdf) · A · **אומת**.
  - בעברית: מה שמוצא ב־non-GAAP הוא, לפי הגדרת הסגל, סכום **שכלול ברווח הנקי** בתקופה, כלומר ההוצאה בדוח הרווח, לא סכום שהוון.
- ‏Disney: ההוצאה "excludes amortization of previously capitalized equity-based compensation costs" — [Disney 10-K 2024](https://www.sec.gov/Archives/edgar/data/1744489/000174448924000276/dis-20240928.htm) · A · **אומת**.
- תגיות בטקסונומיה שמאפשרות "שווי הענקות" בנוסח באפט: `ShareBasedCompensationArrangementByShareBasedPaymentAwardEquityInstrumentsOtherThanOptionsGrantsInPeriod` × `…GrantsInPeriodWeightedAverageGrantDateFairValue`, ולאופציות `…OptionsGrantsInPeriodGross` × `…OptionsGrantsInPeriodWeightedAverageGrantDateFairValue` — [us-gaap-2025.xsd](https://xbrl.fasb.org/us-gaap/2025/elts/us-gaap-2025.xsd) · A · **אומת** (קיום התגיות; כיסוי בין החברות לא נבדק).

### Inferences
- **הכלל "לבטל בדיוק את מה שהוצא" נכון** לרווח רבעוני שנבנה מהרחוב. הרחוב (Yahoo "actual") הוא בדרך כלל ה־non-GAAP של החברה. כל סכום אחר מכניס טעות: ניכוי של מה שלא הוצא (CAH), או השארת חלק בחוץ.
- **בלי הודעה — ההוצאה בדוח הרווח עדיפה על התזרים**: (1) לפי SAB 107 וההגדרה של FASB, היא הסכום שכלול ברווח הנקי ובלי ההיוון. (2) שורת התזרים יכולה לכלול יחידות של חברות בנות ורכישות (CAH), או להחסיר הענקות שמסווגות כהתחייבות (PANW). (3) בבדיקה המקבילה, ב־44 מתוך 45 פערים הערך הנכון היה ההוצאה.
- **‏SBC שהוון — מתי באפט סופר אותו?** אין לבאפט ציטוט ישיר על היוון. לפי השיטה שלו (שווי ההענקה, ומכונית החברה — העלות למעביד), העלות נוצרת **בעת ההענקה והשירות**, בלי קשר לרישום החשבונאי. אבל ברווח רבעוני שמבוסס על רחוב, ההפחתה של מה שהוון בעבר כבר נמצאת בעלות המכר או בהפחתה (Disney: ההוצאה "excludes amortization of previously capitalized"), ובדרך כלל לא מוצאת. לכן הוספת הסכום שהוון היא כפילות במצב יציב. ההבדל היחיד הוא תזמון (מתי ההענקה נרשמת).
- **ברווח הבעלים (1986) זה הפוך**: רכיב (b) מחזיר את כל הפחת וההפחתה (כולל SBC שהוון והופחת), ורכיב (c) הוא השקעות **במזומן**. ‏SBC שהוון אינו מזומן, ולכן לא נכנס ל־(c). כך SBC שהוון לא היה מנוכה בכלל. בחישוב רווח הבעלים צריך לנכות את **כל** עלות ה־SBC בתקופה (מה שנרשם כהוצאה + מה שהוון).
- **הכיוון של באפט (שווי הענקה, 5 שנים)** קרוב בממוצע להוצאה החשבונאית במצב יציב (ההוצאה = שווי ההענקה, מפוזר על תקופת ההבשלה). הוא שונה כשההענקות קופצות (גיוס, רכישה, מחיר מניה שזינק). אפשר להשתמש בו כבדיקת סבירות שנתית, לא כמספר הרבעוני.

### Gaps
- לא נמצא ציטוט של באפט על SBC שמהוון למלאי או לתוכנה, ולא על הענקות שנפרעות במזומן (חוץ מ"מזומן מול אופציות — אותה כלכלה", ‏General Re ‏1998, הערה 01).
- לא נבדק כמה חברות מדווחות את תגיות שווי ההענקה ברמה שמאפשרת ממוצע של 5 שנים.

---

## 4. הנחיות הסגל של ה־SEC (C&DI / CFI) על non-GAAP

### Takeaway
ההנחיות לא אומרות כלום על SBC. הן לא מחייבות להוציא סכום מסוים, ולא אוסרות להוציא SBC. שלוש מהן רלוונטיות בעקיפין: 100.01 (הוצאה שחוזרת היא "חוזרת"), 100.02 (עקביות בין תקופות), ו־102.11 (המס על ההתאמות "commensurate"). הנחיה מפורשת על SBC יש רק ב־SAB 107 (2005): הוצאת SBC היא non-GAAP, והסכום הוא זה שכלול ברווח הנקי.

### Cited Findings
- הדף עבר לכתובת חדשה ושמו שונה ל־"Corporation Finance Interpretations" (CFIs). הכתובת הישנה (`…/compliance-disclosure-interpretations/non-gaap-financial-measures`) מחזירה 404. "Last Update: December 13, 2022" — [SEC CFIs, Non-GAAP](https://www.sec.gov/rules-regulations/staff-guidance/corporation-finance-interpretations/non-gaap-financial-measures) · A · **אומת**.
- **100.01** \[December 13, 2022\]: "Question: Can certain adjustments, although not explicitly prohibited, result in a non-GAAP measure that is misleading? Answer: Yes. Certain adjustments may violate Rule 100(b) of Regulation G because they cause the presentation of the non-GAAP measure to be misleading… Presenting a non-GAAP performance measure that excludes normal, recurring, cash operating expenses necessary to operate a registrant's business is one example of a measure that could be misleading… The staff would view an operating expense that occurs repeatedly or occasionally, including at irregular intervals, as recurring." — שם · A · **אומת**.
  - בעברית: הסגל מתריע רק על הוצאות **במזומן**. ‏SBC הוא לא במזומן, ולכן ההנחיה לא חוסמת את הוצאתו. אבל הגדרת "חוזר" (גם לסירוגין) רלוונטית לשורות רכישה וארגון מחדש (CAH).
- **100.02** \[May 17, 2016\]: "a non-GAAP measure that adjusts a particular charge or gain in the current period and for which other, similar charges or gains were not also adjusted in prior periods could violate Rule 100(b)… unless the change between periods is disclosed and the reasons for it explained." — שם · A · **אומת**.
  - בעברית: המדיניות של חברה יציבה בין רבעונים. זה מצדיק "להעביר" את המדיניות מההודעה הקרובה לרבעון בלי הודעה.
- **102.11** \[May 17, 2016\]: "If a measure is a performance measure, the registrant should include current and deferred income tax expense commensurate with the non-GAAP measure of profitability. In addition, adjustments to arrive at a non-GAAP measure should not be presented 'net of tax.' Rather, income taxes should be shown as a separate adjustment and clearly explained." — שם · A · **אומת**.
  - בעברית: המס על ה־non-GAAP צריך להתאים לרווח ה־non-GAAP. זה תומך ב־τ_ng (§13.1), ובמס הספציפי של השורה כשהחברה מציגה אותו (CAH: 5 על 94).
- חיפוש בטקסט המלא: אין "stock-based" ואין "share-based" בדף. "compensation" מופיע רק בסעיף 108 (דיון ותגמול בדוח לבעלי המניות) — שם · A · **אומת**.
- ‏SAB 107, ‏Topic 14.G, ‏29/3/2005 — ציטוט בסעיף 3 · A · **אומת**.

### Inferences
- אין מקור רגולטורי שקובע "איזה סכום SBC להוציא". הסכום נקבע בכל חברה בהגדרה שלה (PANW: כולל מס מעסיק; CAH: רק הקשור לרכישות). לכן המקור הנאמן הוא שורת הגישור בהודעה.

### Gaps
- לא נבדקו מכתבי הערות של הסגל (comment letters) על SBC בחברות ספציפיות.

---

## 5. מקרי קצה

### 5א. קרנות ריט וחברות בלי שורת מס (וגם APA)

#### Takeaway
בקרן ריט, ‏τ על SBC = **0**: הניכוי מקטין את ההכנסה החייבת שהקרן חייבת לחלק, לא מס. המס שמופיע אצל קרנות גדולות (PLD, ‏O, כ־4%–5% מהרווח לפני מס) הוא של חברות בנות חייבות במס (TRS), חו"ל ומדינות, ולא מגן מס על SBC ברמת הקרן. אצל APA השורה לא "חסרה": בדוח הרווח יש שתי שורות מס (שוטף ונדחה) בלי סה"כ. אבל ה־ETR שלה (~34%) מנופח במיסי מצרים וחו"ל. המגן על SBC הוא בארה"ב (21%), וממילא ה־non-GAAP של APA לא מוציא SBC.

#### Cited Findings
- ‏IRC §857(b)(2)(B), בחישוב ההכנסה החייבת של קרן ריט: "The deduction for dividends paid (as defined in section 561) shall be allowed" · ‏§857(b)(1): "There is hereby imposed for each taxable year on the real estate investment trust taxable income of every real estate investment trust a tax computed as provided in section 11" · ‏§857(a)(1): דרישת חלוקה של 90% מההכנסה החייבת — [26 U.S.C. 857](https://www.law.cornell.edu/uscode/text/26/857) · A · **אומת**.
  - בעברית: הקרן מנכה את הדיבידנדים שחילקה, והמס חל רק על מה שנשאר. קרן שמחלקת הכל לא משלמת מס פדרלי, ולכן ניכוי SBC לא חוסך לה מס.
- ‏IRC §856(l): "The term 'taxable REIT subsidiary' means, with respect to a real estate investment trust, a corporation (other than a real estate investment trust)…" — [26 U.S.C. 856](https://www.law.cornell.edu/uscode/text/26/856) · A · **אומת**. (‏TRS היא חברה רגילה שחייבת במס. ‏SBC של עובדים בה כן חוסך מס.)
- ‏Prologis ו־Realty Income: ‏SIC 6798 ("Real Estate Investment Trusts"). מס מול רווח לפני מס: ‏PLD, רבעון 1 של 2026 — ‏48.0 מול 1,092.8 (‏4.4%); ‏O, רבעון 3 של 2026 — ‏23.6 מול 455.7 (‏5.2%) — [SEC companyfacts PLD](https://data.sec.gov/api/xbrl/companyfacts/CIK0001045609.json), ‏[O](https://data.sec.gov/api/xbrl/companyfacts/CIK0000726728.json), ‏[submissions](https://data.sec.gov/submissions/CIK0001045609.json) · A · **אומת**.
- שהמס של PLD ו־O הוא בעיקר מס זר ומס של TRS — **מהזיכרון — לא אומת** (לא נקרא ביאור המס שלהן).
- **APA**: בדוח הרווח שתי שורות, "Current income tax provision | 338" ו־"Deferred income tax provision | 68" (רבעון 3 של 2026), בלי סה"כ. ב־XBRL הרבעוני יש רק `CurrentIncomeTaxExpenseBenefit` ו־`DeferredIncomeTaxExpenseBenefit`. ‏`IncomeTaxExpenseBenefit` מופיע רק בשנתי (1,099 ב־2025) — [APA 10-Q](https://www.sec.gov/Archives/edgar/data/1841666/000184166626000071/apa-20260930.htm), ‏[SEC companyfacts APA](https://data.sec.gov/api/xbrl/companyfacts/CIK0001841666.json) · A · **אומת**. ‏(338 + 68) ÷ 1,200 = ‏33.8% (חישוב שלנו).
- ‏APA: "The Company's effective income tax rate for the nine months ended September 30, 2026 differed from the U.S. federal statutory income tax rate of 21 percent due to taxes on foreign operations." · "Oil and gas production revenues include income taxes that will be paid to the Arab Republic of Egypt by the Egyptian General Petroleum Corporation (EGPC) on behalf of the Company. Revenue and associated expenses related to such tax volumes are recorded as… 'Current income tax provision'" — [APA 10-Q](https://www.sec.gov/Archives/edgar/data/1841666/000184166626000071/apa-20260930.htm) · A · **אומת**.
- ‏APA, ההודעה: ההתאמות ל־"Adjusted earnings" כוללות ירידות ערך, רווחי/הפסדי נגזרים שלא מומשו, עלויות עסקה וארגון מחדש ורווח ממכירות. המילים "stock-based"/"share-based" מופיעות בהודעה רק בתחזית עלויות ההפעלה ("higher stock-based compensation expense allocated to LOE") — [APA EX-99.1, 4/11/2026](https://www.sec.gov/Archives/edgar/data/1841666/000184166626000063/exhibit9913q26earningsrele.htm) · A · **אומת**.

#### Inferences
- **ריט**: τ = 0 נכון לרוב ה־SBC (הנהלת הקרן). חלק ה־SBC שיושב ב־TRS כן מקבל מגן, אבל החלק הזה לא מדווח. שורת המס של הקרן לא מאפשרת לחשב אותו (היא כוללת מס זר ומדינתי). הטעות ב־τ = 0 קטנה: לכל היותר 21% × (החלק ב־TRS).
- **‏APA**: ה־"שורה החסרה" היא בעיית חילוץ. הפתרון: סה"כ = שוטף + נדחה. אבל גם אז ה־ETR (33.8%) לא מתאים ל־SBC, כי הוא מנופח במס המצרי (שמשולם "בשמה" ונרשם גם כהכנסה) ובמיסי חו"ל. ה־SBC של APA הוא בעיקר בארה"ב, כך ש־21% מתאים. ובעיקר: ה־non-GAAP של APA **לא מוציא SBC**, ולכן אין מה לנכות. ה־τ חשוב רק בדרך בלי הודעות.
- הרחבה (ביטחון נמוך): שותפויות נסחרות (MLP) ומבנים שקופים אחרים — המס על הרווח מוטל על המשקיעים, ולכן גם בהן τ = 0 מתאים לרווח ברמת הישות. לא נבדק בדוגמה.

#### Gaps
- לא נקרא ביאור המס של PLD ו־O (כמה מהמס הוא TRS לעומת חו"ל).
- לא נבדק אם ה־SBC של APA נמצא בארה"ב בלבד, ואם יש לה הפרשה לפיחות על נכסי מס בארה"ב (שתאפס את המגן).

### 5ב. רבעון בלי רווח לפני מס (MRVL, ‏FLEX)

#### Takeaway
השיעור שהחברות **מצהירות**: ‏Marvell — **‏11.0%** (שנה קודם 10.0%); ‏Flex — **‏21%** (תחזית), ובפועל ברבעון 2 של 2027 כ־21.0%. כלומר ב־FLEX ברירת המחדל (0.21) נכונה, וב־MRVL היא גבוהה ב־10 נקודות. ה־"true" של הבדיקה (0.137 ו־0.2496) הם כנראה שיעורי GAAP, לא τ_ng.

#### Cited Findings
- ‏Marvell, רבעון 2 של שנת 2027 (עד 1/8/2026): "Other income tax effects and adjustments relate to tax provision based on a non-GAAP income tax rate of 11.0% for the three and six months ended August 1, 2026 and three months ended May 2, 2026. Other income tax effects and adjustments relate to tax provision based on a non-GAAP income tax rate of 10.0% for the three and six months ended August 2, 2025." · ‏SBC ברבעון 326.2; ‏non-GAAP EPS ‏$0.94 — [MRVL EX-99.1, 27/8/2026](https://www.sec.gov/Archives/edgar/data/1835632/000183563226000022/q227_8kx812026ex-991.htm) · A · **אומת**.
- ‏Marvell, ב־XBRL: הרווח לפני מס מתויג רק בשנתי (‏`IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest`: ‏3,046.6 לשנת 2026), ולא ברבעונים, אף שבהודעה הוא מופיע (378.3 ברבעון 2) — [SEC companyfacts MRVL](https://data.sec.gov/api/xbrl/companyfacts/CIK0001835632.json) · A · **אומת**. (8-K של Marvell מ־2/11/2026 הוא הודעה על מיזוג עם Lumentum, לא דוח רבעוני.)
- ‏Flex, רבעון 2 של שנת 2027 (עד 26/9/2026), תחזית: "Adjusted income tax rate: 21%*" (לרבעון 3 ולשנה) · בפועל: "Non-GAAP provision for income taxes | $118", ‏"Non-GAAP net income | $443"; ‏Flex מוציאה "Stock-based compensation | 43" — [FLEX EX-99.1, 28/10/2026](https://www.sec.gov/Archives/edgar/data/866374/000086637426000039/flexex991-9252026.htm) · A · **אומת**. ‏118 ÷ (443 + 118) = ‏21.0% (חישוב שלנו).
- ‏Flex, ב־XBRL: רווח לפני מס רבעוני חסר ברבעונים שהסתיימו ב־12/2025, ‏6/2026 ו־9/2026, אף שהמס הרבעוני קיים — [SEC companyfacts FLEX](https://data.sec.gov/api/xbrl/companyfacts/CIK0000866374.json) · A · **אומת**.

#### Inferences
- כשחסר רבעון, החלופה הכי טובה היא **τ_ng האחרון שהחברה הצהירה** (יציב: MRVL 11% בשלושה רבעונים רצופים; FLEX 21%), ולא 21%. זה גם עקבי עם C&DI 102.11 ("commensurate").
- רק אחר כך XBRL: רבעון = מצטבר פחות מצטבר קודם (6 חודשים − 3; שנה − 9 חודשים), ואם אין — 12 חודשים. אצל MRVL זה לא יעזור (אין רבעוני בכלל). לכן קודם ההודעה.
- גודל הטעות ב־MRVL: ‏326.2 × (0.21 − 0.11) = ‏$32.6M ברבעון (לפני חלוקה במניות), כלומר ניכוי גדול מדי. (מספר המניות של MRVL לא נשלף.)

#### Gaps
- לא נבדק מאיפה הגיעו 0.137 ו־0.2496 בבדיקה המקבילה (אילו תגיות ותקופות).

### 5ג. סדרת "רחוב" שכוללת רווחי השקעות (GOOGL מול GOOG)

#### Takeaway
**אומת.** ב־Yahoo, ‏GOOGL מציג "actual" = רווח GAAP (2.82, ‏5.11, ‏9.11, ‏2.12; סכום 19.16), ו־GOOG מציג רווח **בלי רווחי/הפסדי ניירות ערך הוניים** (2.82, ‏2.76, ‏2.85, ‏2.67; סכום 11.10). 19.16 ו־11.10 הם **סכומי ארבעה רבעונים**, ושניהם מתקבלים בדיוק מההודעות של Alphabet. אותה בעיה נראית ב־PLD (actual ≈ GAAP כולל רווחי מכירות, מול תחזיות נמוכות בהרבה). באפט מוציא רווחי השקעות מהרווח.

#### Cited Findings
- ‏Yahoo, ‏GOOGL, "Earnings History": ‏12/2025 — הערכה 2.64, ‏actual ‏2.82 · ‏3/2026 — ‏2.67 / ‏5.11 (+91.6%) · ‏6/2026 — ‏2.90 / ‏9.11 (+214.2%) · ‏9/2026 — ‏3.01 / ‏2.12 (‎−29.5%) — [Yahoo GOOGL](https://finance.yahoo.com/quote/GOOGL/analysis/) · D · **אומת** (דרך כלי שליפה שמסכם את הדף; המספרים תואמים את ה־XBRL).
- ‏Yahoo, ‏GOOG: ‏12/2025 — ‏2.64 / ‏2.82 · ‏3/2026 — ‏2.63 / ‏2.76 · ‏6/2026 — ‏2.91 / ‏2.85 · ‏9/2026 — ‏2.98 / ‏2.67 — [Yahoo GOOG](https://finance.yahoo.com/quote/GOOG/analysis/) · D · **אומת** (כנ"ל).
- ‏Alphabet, ‏GAAP diluted EPS (XBRL): ‏5.11 (רבעון 1 של 2026), ‏9.11 (רבעון 2), ‏2.12 (רבעון 3); שנת 2025 ‏10.81 ← רבעון 4 של 2025 = ‏10.81 − 2.81 − 2.31 − 2.87 = ‏2.82 · ‏`EquitySecuritiesFvNiGainLoss`: ‏36,915 / ‏99,031 / ‎−8,664 — [SEC companyfacts Alphabet](https://data.sec.gov/api/xbrl/companyfacts/CIK0001652044.json) · A · **אומת**.
- ההודעות של Alphabet, הערה (1) בכל רבעון: Q4 2025 — "the net effect of the gain on equity securities of $2.3 billion increased… diluted net income per share by… $0.15" — [EX-99.1](https://www.sec.gov/Archives/edgar/data/1652044/000165204426000012/googexhibit991q42025.htm) · Q1 2026 — "$36.9 billion … $2.35" — [EX-99.1](https://www.sec.gov/Archives/edgar/data/1652044/000165204426000043/googexhibit991q12026.htm) · Q2 2026 — "$99.0 billion … $6.26" — [EX-99.1](https://www.sec.gov/Archives/edgar/data/1652044/000165204426000066/googexhibit991q22026.htm) · Q3 2026 — "the net effect of the loss on equity securities of $8.7 billion decreased the provision for income tax, net income, and diluted net income per common share by $1.9 billion, $6.7 billion, and $0.55, respectively." — [EX-99.1](https://www.sec.gov/Archives/edgar/data/1652044/000165204426000080/googexhibit991q32026.htm) · A · **אומת**.
- החשבון: 5.11 − 2.35 = ‏**2.76**; ‏9.11 − 6.26 = ‏**2.85**; ‏2.12 + 0.55 = ‏**2.67** — בדיוק סדרת GOOG. ברבעון 4 של 2025 (השפעה של 0.15 בלבד) שתי הסדרות = ‏2.82 (GAAP). ‏2.82 + 2.76 + 2.85 + 2.67 = ‏**11.10**; ‏2.82 + 5.11 + 9.11 + 2.12 = ‏**19.16** (חישוב שלנו).
- ‏Prologis ב־Yahoo: ‏12/2025 — הערכה 0.68 / ‏actual ‏1.46 (+113.5%) · ‏3/2026 — ‏0.72 / ‏1.02 · ‏6/2026 — ‏0.75 / ‏1.11 · ‏9/2026 — ‏0.79 / ‏0.84 — [Yahoo PLD](https://finance.yahoo.com/quote/PLD/analysis/) · D · **אומת** (כנ"ל). ‏GAAP diluted EPS ב־XBRL: ‏1.49 (רבעון 4 של 2025), ‏1.05 (רבעון 1 של 2026) — [SEC companyfacts PLD](https://data.sec.gov/api/xbrl/companyfacts/CIK0001045609.json) · A · **אומת**.
- באפט: "Our measure excludes capital gains or losses on the stocks and bonds we own, whether realized or unrealized." — [2024](https://www.berkshirehathaway.com/letters/2024ltr.pdf) · ‏"For analytical purposes, Berkshire's 'bottom-line' will be useless." — [2017](https://www.berkshirehathaway.com/letters/2017ltr.pdf) · A · **אומת** (הערה 01).

#### Inferences
- **הסיבה**: ‏Yahoo מחזיק רשומת רווחים נפרדת לכל סימול. לשני הסוגים של Alphabet אותו רווח GAAP למניה, אז ההבדל הוא בספק הנתונים: ב־GOOGL נקלט הרווח המדווח (כולל רווחי ניירות ערך), וב־GOOG רווח על בסיס האנליסטים (בלי רווחי ניירות ערך). ההערכות זהות כמעט בשתי הסדרות. לכן ה"הפתעה" של GOOGL (+214%) היא סימן לבסיס לא תואם, לא הפתעה אמיתית.
- ‏**PLD**: ה־actual קרוב ל־GAAP (פער של 0.03, שלא הוסבר), וההערכות נמוכות ב־40%–114% בשלושה מארבעה רבעונים. כנראה ה־actual כולל רווחים ממכירת נדל"ן (סוג של רווח השקעה) והתחזית לא — **היסק, לא אומת** מול ההודעה של PLD. ‏(ל־PLD אין ב־XBRL רבעונים 2–3 של 2026 ביום השליפה.)
- **השפעה על מכפיל באפט** של Alphabet בסדרת GOOGL: רווח 12 חודשים 19.16 במקום 11.10 → המכפיל נמוך ב־42% (‏1 − 11.10/19.16), עוד לפני ה־SBC.

#### Gaps
- לא נבדק אם הבעיה קיימת גם בזוגות סימולים אחרים (BRK-A/B, ‏FOX/FOXA, ‏NWS/NWSA), ולא נבדקו ספקים אחרים.
- לא אומת מה בדיוק כלול ב־actual של PLD.

---

## מה זה אומר למערכת שלנו

> המלצות בלבד. כל שינוי בהגדרה של מכפיל באפט — באישור המשתמש (`docs/buffett-method-research.md` §13). ‏✓ = התגית אומתה בטקסונומיה של 2025, וגם בנתונים של חברה אחת לפחות.

### (1) איזה סכום SBC לנכות — הכלל וסדר הנפילה
**הכלל:** ניכוי = מה שהחברה הוציאה מה־non-GAAP **בשורת ה־SBC** בגישור (כולל מס מעסיק כשהוא באותה שורה, §13.3), × (1 − τ) ÷ המניות של ה־non-GAAP. ‏SBC ששורבב לשורת רכישה או ארגון מחדש (PANW ‏177, ‏CAH ‏78) **לא** נכנס לשורה הזו. הוא מטופל לפי כלל החזרה של §13.6 (3 מתוך 8 רבעונים ← לנכות אחרי המס של השורה עצמה), ומקבל סימון.

**סדר הנפילה כשאין שורה בהודעה לאותו רבעון:**
1. **המדיניות מההודעה הקרובה** (C&DI 100.02 — עקביות). אם ההודעות של החברה **לא** מוציאות SBC רגיל (CAH, ‏APA) → ניכוי **0**, גם בלי הודעה. **בלי** `clamp(street − GAAP, 0, SBC)` בחברות כאלה, כי הפער שם הוא LIFO, הפחתות ורכישות.
2. **‏`AllocatedShareBasedCompensationExpense`** ✓ (ההוצאה בדוח הרווח, בלי ההיוון), אחרי שלוש בדיקות:
   - אם יש `EmployeeServiceShareBasedCompensationAllocationOfRecognizedPeriodCostsCapitalizedAmount` ✓ ו־Allocated ≈ ‏`ShareBasedCompensation` + Capitalized (±2%) → Allocated כולל את ההיוון (הדפוס של Alexandria) → לקחת את `ShareBasedCompensation`.
   - אם Allocated ≤ 0, או Allocated < ‏0.5 × ‏`ShareBasedCompensation` → תיוג חלקי (FIS: ‏3 מול 186) → שלב 3, עם סימון.
   - רבעון מתוך מצטבר: רק בתוך אותה תגית (לא לערבב תגיות בין רבעונים — זה מה ש־`mergeTags` עושה היום).
3. **‏`ShareBasedCompensation`** ✓ (תוספת בתזרים), עם סימון "שורת תזרים — ייתכנו הענקות של חברה בת/רכישה או הענקות שמסווגות כהתחייבות".
4. **‏`AdjustmentsToAdditionalPaidInCapitalSharebasedCompensationRequisiteServicePeriodRecognitionValue`** ✓ (הגידול בהון, רק הענקות הוניות), עם סימון.
5. **לא** להשתמש ב־`EmployeeBenefitsAndShareBasedCompensation` (קיים בטקסונומיה, לא נבדק בנתונים), כי הוא כולל הטבות שאינן SBC.

**דגלים:** ‏max(Allocated, ‏`ShareBasedCompensation`) > ‏1.15 × השורה בהודעה → "SBC בשורות אחרות" (PANW ‏684/517 = ‏1.32 — היה נדלק). ‏Allocated ≠ ‏`ShareBasedCompensation` ביותר מ־10% → לציין במסך המקורות איזה נבחר ולמה.
**בדיקת סבירות בנוסח באפט (שנתית, לא במספר):** ממוצע 5 שנים של שווי ההענקות (`…EquityInstrumentsOtherThanOptionsGrantsInPeriod` × `…GrantsInPeriodWeightedAverageGrantDateFairValue`, ולאופציות `…OptionsGrantsInPeriodGross` × `…OptionsGrantsInPeriodWeightedAverageGrantDateFairValue` — קיימות בטקסונומיה, כיסוי לא נבדק) מול ‏SBC בשנה. פער > 30% → רמז.
**ברווח הבעלים (1986, §13.8):** לנכות את **כל** העלות (הוצאה + היוון), כי ה־SBC שהוון לא נכנס ל־capex במזומן.
**ביטחון:** גבוה לכלל ולשלב 1 (ראיות A: ‏SAB 107, הגדרת FASB, ‏CAH/PANW/Disney); בינוני לספים (2%, ‏0.5, ‏10%, ‏30%). **מה ישנה:** אם בבדיקה רחבה יימצא שב־Allocated יש יותר תיוג חלקי מאשר בתזרים — להפוך את סדר 2 ו־3. החלטת המשתמש על שורת הרכישות של CAH (לנכות לפי החזרה או רק לסמן) משנה את הניכוי שם מ־0 ל־‏$0.38 לרבעון.

### (2) τ לקרנות ריט ולחברות בלי שורת מס
- ‏**SIC 6798 → τ = 0** תמיד, גם כשיש שורת מס (PLD ‏4.4%, ‏O ‏5.2% — זה מס של TRS/חו"ל/מדינה). סימון "ריט: בלי מגן מס". ביטחון **גבוה** לעיקרון (IRC §857, A), **בינוני** לכך שהחלק ב־TRS זניח. **מה ישנה:** קרן שמדווחת שחלק גדול מה־SBC שלה ב־TRS → ‏τ = 0.21 × אותו חלק.
- **"אין שורת מס" בחברה רגילה**: קודם לסכם `CurrentIncomeTaxExpenseBenefit` ✓ + ‏`DeferredIncomeTaxExpenseBenefit` ✓ (APA). זה לא באג של שיעור — זה באג של חילוץ.
- ‏**APA וחברות שה־ETR שלהן מנופח במס זר**: τ = τ_ng אם יש; אחרת 21% (ארה"ב), לא ה־ETR (‏33.8%). ממילא ב־APA הניכוי = 0 (ה־non-GAAP לא מוציא SBC). ביטחון בינוני. **מה ישנה:** הפרשה לפיחות על נכסי המס בארה"ב → ‏τ = 0.
- הרחבה, ביטחון נמוך: ישויות שקופות (שותפויות) → ‏τ = 0.

### (3) חסר רבעון של רווח לפני מס
**סדר:** (א) ‏τ_ng מההודעה של אותו רבעון; (ב) ‏τ_ng האחרון שהחברה הצהירה, עד 4 רבעונים אחורה (MRVL ‏11.0%, ‏FLEX ‏21%); (ג) מס ÷ רווח לפני מס מ־XBRL, כולל השלמת רבעון ממצטבר (6 חודשים − 3; שנה − 9 חודשים) **באותה תגית**, ב־12 חודשים, בתחום [0, 35%]; (ד) רק אז 21%. **ביטחון:** גבוה ל־(א)–(ב) (שתי החברות מצהירות במפורש, ו־C&DI 102.11). **מה ישנה:** אם יימצא ש־τ_ng משתנה בין רבעונים ביותר מ־3 נקודות ביותר מ־20% מהחברות — לקצר את (ב) לרבעון אחד.

### (4) סדרת רחוב שכוללת רווחי השקעות
**זיהוי (כל אחד מספיק לסימון):**
1. **רחוב ≈ GAAP** (±‏$0.03) ברבעון שבו `EquitySecuritiesFvNiGainLoss` ✓ × (1 − τ) ÷ מניות ≥ 10% מהרחוב → הסדרה כוללת רווחי השקעות.
2. **הפתעה** |actual − הערכה| ÷ |הערכה| > 40% בשניים מתוך ארבעה רבעונים (GOOGL ‏+92%, ‏+214%; ‏PLD ‏+41% עד ‏+114%) → בסיס לא תואם.
3. **סימול אח** (אותו CIK: ‏GOOG/GOOGL, ‏FOX/FOXA, ‏NWS/NWSA; ‏BRK-A/BRK-B בהתאמת יחס המניות) — הסדרות שונות ביותר מ־5% ברבעון.

**טיפול:** לבחור את הסדרה הקרובה יותר ל־"GAAP פחות רווחי השקעות" (מסימול האח). אם אין — רחוב = GAAP − ההשפעה למניה, כשהחברה מפרסמת אותה (Alphabet: ‏+0.15, ‏+2.35, ‏+6.26, ‏‎−0.55), ואחרת `EquitySecuritiesFvNiGainLoss` × ‏(1 − 0.21) ÷ מניות. ולסמן "הרחוב תוקן: רווחי השקעות". זה עקבי עם באפט (2017, ‏2024) ועם §13.7. **ביטחון:** גבוה לזיהוי ב־Alphabet (החשבון יוצא מדויק); בינוני לספים; נמוך ל־PLD עד שתיבדק ההודעה. **מה ישנה:** אם הבדיקה של PLD תראה שה־actual הוא FFO או בסיס אחר → כלל נפרד לריט (רחוב = רווח GAAP בלי רווחים ממכירת נדל"ן).
