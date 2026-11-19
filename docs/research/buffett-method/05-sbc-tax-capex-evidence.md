# תגמול במניות, מס, השקעות הוני־תחזוקה והראיות על "רווח הרחוב" — איך מממשים את "רווח הבעלים" של באפט בתוכנה

> מחקר 19/11/2026 · לשאלות ההגדרה של "מכפיל באפט" (`docs/buffett-pe.md`) ובדיקת העומק המקבילה.
> **מקרא:** כל טענה נושאת מקור, שנה, קישור, דרג (A = כתבי באפט / תקן FASB / דיווחי חברה ל־SEC · B = באפט בעל פה / מאנגר · C = אקדמיה ומעשיים רציניים: Damodaran, Mauboussin, Greenwald, פרשנות Big-4 · D = אתרים פופולריים) ומצב: **אומת** (נשלף ונקרא בסשן הזה) או **מהזיכרון — לא אומת**. "לא אומת (קטע חיפוש)" = נראה רק בתקציר תוצאת חיפוש, לא במקור המלא.
> **שיטה:** הודעות לעיתונות (8-K, Exhibit 99.1) של שמונה חברות נשלפו ישירות מ־EDGAR (submissions API → index.json → המוצג), נתוני XBRL מ־`data.sec.gov/api/xbrl/companyconcept`, מכתבי ברקשייר מהאתר הרשמי, תקצירי מאמרים מ־IDEAS/RePEc. אתר Morgan Stanley (דוח Mauboussin) ו־GuruFocus חסמו את הסביבה (403 של Akamai/Cloudflare) — מסומן בהתאם.
> **שמות חברות** מופיעים כאן רק כדוגמאות לדיווח (מקור ראשוני), לא כהשוואת מוצר.

---

## שאלה 1 — שיעור המס על התגמול במניות (SBC)

### תמצית
המס "הנכון" על ניכוי SBC הוא **שיעור המס שבו מנורמל רווח הרחוב עצמו** — שיעור ה־non-GAAP הארוך־טווח שהחברה מצהירה עליו (כל ארבע החברות שבדקתי שמוציאות SBC מצהירות עליו במפורש: 18%–23%). שיעור המס האפקטיבי (GAAP) מעוות בגלל הטבות המס העודפות מ־SBC עצמו (ASU 2016-09), הפרשות לשווי וגורמים חד־פעמיים; ושורת "השפעת המס של ההתאמות" אינה מס על SBC אלא נרמול כולל — השיעור המשתמע ממנה נע בין 0.3% ל־95.8%.

### ממצאים מצוטטים

**התקן (ASC 718 / ASU 2016-09)**
- לפי ASC 718, הוצאת SBC בדוחות נמדדת לפי שווי הוגן ביום ההענקה, אבל ניכוי המס בפועל (אופציות לא־מוכרות ו־RSU) הוא לפי **השווי הפנימי ביום ההבשלה או המימוש**. נכס המס הנדחה נרשם לפי עלות ההוצאה בספרים ו**אינו מתעדכן** לפי מחיר המניה. ציטוט: "a deduction for tax purposes for the employer equal to the intrinsic value of the award at that date" ·  "The deferred tax asset related to compensation cost for financial reporting is not adjusted for changes in the intrinsic value of the award. Upon exercise or vesting of an award, the difference between the deduction for tax purposes and the compensation cost recognized for financial reporting creates an excess tax benefit (windfall) or tax deficiency (shortfall)." — [KPMG, Defining Issues, 2016](https://assets.kpmg.com/content/dam/kpmg/pdf/2016/05/tnf-wnit-stock-comp-may2-2016.pdf) · דרג C (פרשנות Big-4) · **אומת**.
  - בעברית: המס נחסך לפי מה שהמניות שוות כשהעובד מקבל אותן, לא לפי מה שנרשם כהוצאה. ההפרש (עודף או חוסר) הוא "הטבת מס עודפת" או "חוסר מס".
- מאז ASU 2016-09 ההפרש הזה עובר **דרך הוצאות המס בדוח רווח והפסד**, בתקופה שבה נוצר הניכוי: "The tax effect of the difference, if any, between the cumulative compensation cost of an award recognized for financial reporting purposes and the deduction for an award for tax purposes shall be recognized as income tax expense or benefit in the income statement. The tax effect shall be recognized in the period in which the tax deduction arises" (סעיף 718-740-35-2 בנוסחו המתוקן) — [FASB, ASU 2016-09, 2016](https://storage.fasb.org/ASU%202016-09.pdf) · דרג A · **אומת**.
- KPMG: "Greater volatility in reported earnings could occur because all effects associated with differences between the expenses and their income tax deduction will be recognized in the income statement. The volatility results from changes in the share price and the timing of exercise of share options and vesting of share awards." — [KPMG, 2016](https://assets.kpmg.com/content/dam/kpmg/pdf/2016/05/tnf-wnit-stock-comp-may2-2016.pdf) · C · **אומת**.
  - בעברית: שיעור המס האפקטיבי (מס חלקי רווח לפני מס) **כולל** את הטבות המס העודפות של ה־SBC עצמו ותלוי במחיר המניה — לכן הוא מדד רועש לשיעור המס "על" ה־SBC.
- אופציות מסוג ISO ו־ESPP מוכרות בד"כ אינן מזכות בניכוי (אלא במכירה פוסלת), ו־§162(m) מגביל את הניכוי לשכר בכירים מעל מיליון דולר — כך שההטבה בפועל על SBC יכולה להיות נמוכה משיעור המס הסטטוטורי — מהזיכרון — לא אומת (קוד המס האמריקאי, §83(h), §162(m), §421) · A.

**מה החברות עושות בפועל (הודעות 8-K, רבעון אחרון)**
- **ServiceNow** (Q3 2026): "We use a non-GAAP effective tax rate for evaluating our operating results to provide consistency across reporting periods. Based on our long-term projections, we are using a non-GAAP tax rate of 21% for the three and nine months ended September 30, 2026 and 20% for the three and nine months ended September 30, 2025." ההתאמות לפני מס ברבעון: SBC 633, הפחתת מוחשיים שנרכשו 198, צירופי עסקים 35, פיטורים 87, רווחי השקעות (7) = 946 מיליון; "Income tax effects and adjustments" (184) → **19.5% משתמע**. שיעור GAAP אפקטיבי: 93/370 = 25.1% — [ServiceNow 8-K Ex.99.1, 28/10/2026](https://www.sec.gov/Archives/edgar/data/1373715/000137371526000092/erq3fy26.htm) · A · **אומת**.
- **Salesforce** (Q2 FY27, תחזית Q3): "The Company's non-GAAP tax provision uses a long-term projected tax rate of 20.5%". בגשר התחזית למניה: הפחתה 0.57 + SBC 1.29 + ארגון מחדש 0.12 = 1.98$, ו־"Income tax effects and adjustments" (0.37) → **18.7% משתמע** (לשנה: 1.37/7.83 = 17.5%). שיעור GAAP צפוי ~21.8% — [Salesforce 8-K Ex.99.1, 26/8/2026](https://www.sec.gov/Archives/edgar/data/1108524/000110852426000187/crm-q2fy27xexhibit991.htm) · A · **אומת**.
- **Adobe** (Q3 FY26) — **הדוגמה החשובה**: טבלת גישור של שיעור המס: "GAAP effective income tax rate 22.5 % · Income tax adjustments (1.5) · Stock-based and deferred compensation expense (3.0) · Non-GAAP effective income tax rate (*) 18.0 %" עם ההערה "(*) Represents Adobe's fixed long-term non-GAAP tax rate based on projections and currently available information for fiscal 2026 through fiscal 2028". בגשר הרווח הנקי: 1,827 + SBC ופיצוי נדחה 544 + הפחתה 58 + רכישות 18 − רווחי השקעות 21 − "Income tax adjustments" **(2)** = 2,424. כלומר על 599 מיליון התאמות לפני מס נוכה מס של 2 מיליון בלבד → **0.3% משתמע**; הוצאת המס ב־non-GAAP (18% × 2,956 = 532) כמעט זהה להוצאת המס ב־GAAP (530) — [Adobe 8-K Ex.99.1, 10/9/2026](https://www.sec.gov/Archives/edgar/data/796343/000079634326000147/adbeex991q326.htm) · A · **אומת**.
  - בעברית: אצל Adobe, שיעור ה־non-GAAP הנמוך (18%) כבר "מכיל" את חיסכון המס מ־SBC. ה־SBC הוחזר לרווח כמעט בלי להוריד ממנו מס.
- **Palantir** (Q3 2026): "Less: income tax effects and adjustments (1) (327,660)" על SBC 318,889 + מס מעסיק על SBC 23,106 = 341,995 אלף → **95.8% משתמע**; ההערה: "(1) Income tax effect is based on an estimated long-term annual effective tax rate of 23.0% for the period presented." הוצאת המס ב־GAAP: 13,560 על רווח לפני מס 1,148,001 (שיעור **1.2%**). התוצאה: "GAAP EPS, Diluted $ 0.44 · Adjusted EPS, Diluted $ 0.44" — [Palantir 8-K Ex.99.1, 2/11/2026](https://www.sec.gov/Archives/edgar/data/1321655/000132165526000045/a2026q3ex991pressrelease.htm) · A · **אומת**.
  - בעברית: שורת "השפעת המס" כאן אינה מס על ה־SBC אלא נרמול של כל המס מ־1.2% ל־23%. מי שקורא אותה כ"מס על SBC" יקבל 96%.
- **Snowflake** (Q2 FY27): "Income tax effect related to the above adjustments and acquisitions (75,005)" על התאמות של 502,033 אלף → **14.9% משתמע**; לא מצוין שיעור non-GAAP — [Snowflake 8-K Ex.99.1, 2/9/2026](https://www.sec.gov/Archives/edgar/data/1640147/000164014726000033/fy2027q2earnings.htm) · A · **אומת**.
- **Meta ו־Alphabet**: ההודעות מציגות רווח למניה לפי GAAP בלבד; מדדי ה־non-GAAP בהן הם תזרים חופשי והכנסות במטבע קבוע (Meta הוציאה ברבעון רק את ההסדר המשפטי החד־פעמי: "Diluted EPS of $3.83 would have increased by $3.57 to $7.40") — [Meta 8-K, 21/10/2026](https://www.sec.gov/Archives/edgar/data/1326801/000162828026066700/meta-09302026xexhibit991.htm) · [Alphabet 8-K, 28/10/2026](https://www.sec.gov/Archives/edgar/data/1652044/000165204426000080/googexhibit991q32026.htm) · A · **אומת**.

**מקור חברה־ספציפי ב־XBRL**
- התגית `EmployeeServiceShareBasedCompensationTaxBenefitFromCompensationExpense` ("הטבת המס שהוכרה על הוצאת SBC") קיימת לחלק מהחברות: ServiceNow 2024 = 340 מתוך SBC 1,746 (19.5%), 2025 = 365 מתוך 1,955 (18.7%); Palantir 2024–2025 = **0**; Salesforce — רק עד 2018; Adobe, Snowflake — אין ערכים שנתיים — [SEC XBRL API, ServiceNow](https://data.sec.gov/api/xbrl/companyconcept/CIK0001373715/us-gaap/EmployeeServiceShareBasedCompensationTaxBenefitFromCompensationExpense.json) · [Palantir](https://data.sec.gov/api/xbrl/companyconcept/CIK0001321655/us-gaap/EmployeeServiceShareBasedCompensationTaxBenefitFromCompensationExpense.json) · A · **אומת** (נשלף 19/11/2026).
  - בעברית: כש־ServiceNow מדווחת על עצמה, 18.7%–19.5% — כמעט בדיוק השיעור המשתמע מגשר ה־non-GAAP שלה (19.5%). אצל Palantir אין כרגע שום הטבת מס על SBC (מה שמסביר את שיעור המס של 1.2%).

### הסקות
- **זהות מתמטית** (שלי): נסמן P = רווח לפני מס לפי הרחוב, S = SBC, τ_ng = שיעור המס שבו החברה מנרמלת את רווח הרחוב, τ_own = שיעור המס המתאים לדוח שבו SBC הוא הוצאה. אז:
  `רווח באפט = (P − S)·(1 − τ_own) = רחוב − S·(1 − τ_own) − P·(τ_own − τ_ng)`.
  כשהחברה מנכה את המס על התוספות בשיעור הרגיל שלה (ServiceNow, Salesforce: τ_ng ≈ τ_own), האיבר האחרון זניח ו־`רחוב − S·(1−τ_ng)` מדויק. כשהשיעור המנורמל נמוך כי כבר מכיל את חיסכון ה־SBC (Adobe), נשארת הטיה כלפי מעלה.
- **חישוב לדוגמה — Adobe, Q3 FY26** (מיליוני $, רבעון): הרווח העקבי (GAAP + ההתאמות שאינן SBC) ≈ 1,880. הנוסחה שלנו היום (t = 22.5%): 2,424 − 544×0.775 = **2,002 (+6.5%)**. עם τ_ng = 18%: **1,978 (+5.2%)**. עם 21%: 1,994 (+6.1%). כלומר ההבדל בין שלושת השיעורים קטן (≤1.3% מהרווח); ההטיה המבנית (~5%) נובעת מאופן הנרמול של Adobe.
- **חישוב לדוגמה — Palantir, Q3 2026** (אלפי $): הנוסחה שלנו (ETR 1.2% → מוגבל ל־10%): 1,142,347 − 341,995×0.9 = 834,551 (EPS ~0.32). עם τ_ng = 23%: 879,011 (~0.34). רווח GAAP: 1,128,012 (0.44). רווח באפט **נמוך** מ־GAAP — וזה עקבי: הרחוב מנרמל מס ל־23% בעוד ש־GAAP נהנה זמנית ממס של 1.2%. ההפרש בין 10% ל־23% = 44 מיליון ברבעון ≈ 5% מהתוצאה.
- **רגישות**: כל נקודת אחוז ב־t = 1% מה־SBC. כש־SBC הוא רבע מרווח הרחוב, ±5 נקודות = ±1.25% ברווח באפט. **העקביות עם הנרמול של הרחוב חשובה יותר מהדיוק בשיעור.**
- שיעור ה־GAAP האפקטיבי הוא הבחירה הגרועה מבין השלוש: הוא כולל את הטבות המס העודפות (שתלויות במחיר המניה), את ההפרשה לשווי (Palantir 1.2%) ואירועים חד־פעמיים; ההגבלה 10%–35% רק מסתירה את זה.
- שורת "השפעת המס של ההתאמות" **אינה שמישה** כמס על SBC (0.3%–95.8% בחמש חברות).

### פערים
- לא מצאתי הנחיה אקדמית או של CFA Institute שקובעת מפורשות איזה שיעור לקחת ל"רחוב פחות SBC אחרי מס". (החיפוש העלה רק קורס CFA ברמה 2 שלא נקרא.)
- לא נבדק מדגם רחב: חמש החברות הן כולן תוכנה/טכנולוגיה אמריקאיות. כמה מכלל החברות שמוציאות SBC מצהירות על שיעור non-GAAP — לא נמדד.

---

## שאלה 2 — האם ניכוי SBC יחד עם מניות מדוללות הוא ספירה כפולה?

### תמצית
לא — בתנאי שההוצאה מייצגת את ההענקות של התקופה והעתיד, והדילול מייצג רק הענקות **קודמות** שעדיין פתוחות. Damodaran אומר את זה במפורש. הספירה הכפולה האמיתית היא לנכות SBC **וגם** להגדיל את מספר המניות בגלל הענקות **עתידיות**, או לנכות SBC **וגם** את הרכישות העצמיות שמקזזות את הדילול. מה שבאמת שגוי ("רישול") הוא ההפך: להחזיר את ה־SBC לרווח ולהסתמך על המניות המדוללות שיתקנו.

### ממצאים מצוטטים
- Damodaran: "While it may seem like you are double counting options, by first reducing earnings for their grants, and then again reducing the overall value of equity for outstanding options from the past, you are not. In fact, if a company stops using equity-based compensation after years of option grants, the first effect (on earnings/cash flows) will stop but the second effect will continue until all of the options either expire or are exercised." — [Damodaran, "Stock-based Employee Compensation: Value and Pricing Effects", 13/2/2014](https://aswathdamodaran.blogspot.com/2014/02/stock-based-employee-compensation-value.html) · C · **אומת**.
  - בעברית: ההוצאה = עלות ההענקות של עכשיו; הדילול = תביעה של הענקות ישנות. אלה שני דברים שונים.
- אותו פוסט, על ההצדקה הנפוצה: "The other explanation is that the adjusted net income is being divided by the fully diluted number of shares outstanding, which includes the shares that are being offered as compensation. This 'consistency' argument is used by many analysts, and while it may offer the fig leaf of matching, it is an extremely sloppy way of dealing with stock-based compensation." וגם: "To those analysts who argue that using the diluted number of shares to compute per share numbers will take care of the problem, my response is that it will do so only by accident" — שם · C · **אומת**.
- המרשם שלו למכפילים: "First, stop adding back stock-based compensation to net income. There is no logical or financial rationale for doing so. Second, stop playing around with the denominator. If there are shares outstanding, restricted or not, count them. If there are options outstanding, value them and add them to the numerator (the market capitalization)… Option-adjusted PE = (Market capitalization + Estimated value of options outstanding)/ GAAP Net Income" — שם · C · **אומת**.
- בהערכת שווי (DCF): "Past option and share grants: In an intrinsic valuation, you should value these options first (using an option pricing model) and net the value out of the estimated value of equity, before dividing by the existing share count" · "Future grants: … the most logical way to deal with these grants is to treat them as expenses in future years, and reduce expected income and cash flows." ועל דילול עתידי: "But don't double count: You cannot do both, because you are then reducing value per share twice for the same phenomenon" — [Damodaran, "Dilution and Options: The Mystery of Share Count" (נתוני סוף 2017, ~2018)](https://pages.stern.nyu.edu/~adamodar/pdfiles/blog/TeslaDilution.pdf) · C · **אומת**.
  - שם גם: שיטת המניות המדוללות לבדה "counting in the dilution that will arise from option exercise but ignoring the cash that will come into the firm from the exercise" — ושיטת המניות האוצר (Treasury Stock) היא "A Sloppy Alternative" כי היא מעריכה אופציות לפי ערך המימוש בלבד · **אומת**.
- באפט, 1992: "If options aren't a form of compensation, what are they? If compensation isn't an expense, what is it? And, if expenses shouldn't go into the calculation of earnings, where in the world should they go?" — [מכתב ברקשייר 1992](https://www.berkshirehathaway.com/letters/1992.html) · A · **אומת**.
- באפט, 2015: "'Stock-based compensation' is the most egregious example. The very name says it all: 'compensation.' If compensation isn't an expense, what is it? And, if real and recurring expenses don't belong in the calculation of earnings, where in the world do they belong?" — [מכתב ברקשייר 2015](https://www.berkshirehathaway.com/letters/2015ltr.pdf) · A · **אומת**.
- ASU 2016-09 שינה את שיטת המניות האוצר: "The formula used for calculating diluted earnings per share under the treasury stock method no longer includes the estimated excess tax benefits and deficiencies that were recorded in APIC." — [KPMG, 2016](https://assets.kpmg.com/content/dam/kpmg/pdf/2016/05/tnf-wnit-stock-comp-may2-2016.pdf) · C · **אומת**.
- לפי ASC 260, "התמורה המשוערת" בשיטת המניות האוצר כוללת גם את עלות התגמול **שטרם הוכרה** (שירות עתידי) — ולכן המניות המדוללות מוסיפות רק את החלק "נטו" של הענקות קיימות — מהזיכרון — לא אומת (ASC 260-10-45-29) · A.
- הפער בין מניות בסיסיות למדוללות קטן בחברות הגדולות שנבדקו: Meta 2,552 מול 2,573 (0.8%), Adobe 395 מול 395, ServiceNow 1,035 (בסיסי) ורווח למניה זהה בסיסי/מדולל ($0.27) — [ההודעות לעיל](https://www.sec.gov/Archives/edgar/data/1326801/000162828026066700/meta-09302026xexhibit991.htm) · A · **אומת**.
- **Mauboussin & Callahan**, "Stock-Based Compensation: Unpacking the Issues", Counterpoint Global (Morgan Stanley IM), 18/4/2023: היקף SBC בארה"ב ~270 מיליארד $ ב־2022; כמעט כל העלייה ב־SBC החליפה שכר במזומן; IT = 4.0% מהמכירות מול 0.4% במוצרי צריכה בסיסיים — [Morgan Stanley IM](https://www.morganstanley.com/im/en-us/financial-advisor/insights/articles/stock-based-compensation.html) · C · **לא אומת (קטע חיפוש)** — האתר חסום מהסביבה (403).
  - עמדתם לגבי ספירה כפולה (מהזיכרון): SBC הוא הוצאה אמיתית; בהערכת שווי מנכים הענקות עתידיות בתזרים, ומטפלים בהענקות קיימות בנפרד — מהזיכרון — לא אומת. **לבדוק בדפדפן לפני שמצטטים.**
- Callahan & Mauboussin (2024, "Which One Is It? Equity Issuance and Retirement") — ולפי עבודה של Laurion (Columbia, 2026) שמצטטת אותם, כ־16% מהמזומן ששימש לרכישה עצמית קשור לקיזוז דילול מתגמול במניות — [מאמר העבודה של Laurion](https://business.columbia.edu/sites/default/files-efs/imce-uploads/ADP/Spring%202026/1.%20Henry%20Laurion.pdf) · C · **לא אומת (קטע חיפוש)**.

### הסקות
- **P/E**: רווח שמנכה את ה־SBC של 12 החודשים, חלקי מניות מדוללות לפי שיטת המניות האוצר = כמעט נקי. "הכפילות" לכל היותר בגודל פער בסיסי/מדולל (בד"כ <2% מהרווח למניה), וכנראה פחות, כי שיטת המניות האוצר כבר מקזזת את העלות שטרם הוכרה. Damodaran (2014) מעדיף מניות בסיסיות + שווי האופציות במונה — מדויק יותר, אבל דורש מודל אופציות לכל חברה.
- **DCF**: מנכים SBC עתידי בתזרים; מניות היום כוללות RSU שהוענקו; אופציות פתוחות — לפי שווי (או שיטת המניות האוצר כקירוב); **לא** מגדילים את מספר המניות בגלל הענקות עתידיות.
- **דילול נטו או רכישות לקיזוז?** הוצאת ה־SBC (שווי ביום ההענקה) היא המדד הטוב ביותר לעלות שוטפת: היא נצברת, יציבה ומתוקננת. דילול נטו מסתיר את העלות כשיש רכישות עצמיות; "רכישות לקיזוז" הן החלטת הקצאת הון ותלויות במחיר המניה. לנכות SBC **וגם** את הרכישות = ספירה כפולה. דילול ברוטו (מניות שהונפקו לעובדים × מחיר) שימושי כבדיקת שפיות בלבד.

### פערים
- לא אומת הנוסח המדויק של Mauboussin & Callahan (2023) — האתר חסום. לא נמצא מאמר של CFA Institute בנושא.
- אין מחקר שמודד אמפירית את גודל ה"כפילות" ב־P/E של מניות מדוללות מול בסיסיות.

---

## שאלה 3 — SBC חד־פעמי, במזומן, ומס מעסיק

### תמצית
החברות עצמן מערבבות: Adobe מוציאה "SBC ופיצוי נדחה" יחד; Palantir ו־Snowflake מוציאות גם את מס המעסיק על המניות; Salesforce ו־ServiceNow מעבירות SBC של ארגון מחדש ורכישות לשורות אחרות. ההמלצה: לנכות כל תגמול חוזר — כולל מס המעסיק ותגמול במזומן — ולהשאיר בחוץ (כמו שאר החד־פעמיים של הרחוב) רק SBC בשורת הארגון מחדש/הרכישה, עם דגל כשה"חד־פעמי" חוזר.

### ממצאים מצוטטים
- Palantir: "We exclude employer payroll taxes related to stock-based compensation as it is difficult to predict and outside of Palantir's control." ברבעון: SBC 318,889 + מס מעסיק 23,106 אלף — [Palantir 8-K, 2/11/2026](https://www.sec.gov/Archives/edgar/data/1321655/000132165526000045/a2026q3ex991pressrelease.htm) · A · **אומת**.
- Snowflake מוציאה "stock-based compensation-related charges, including employer payroll tax-related items on employee stock transactions"; ובתזרים: "Cash outflows for employee payroll tax items related to the net share settlement of equity awards are included in cash flow for financing activities and, as a result, do not have an effect on the calculation of free cash flow." — [Snowflake 8-K, 2/9/2026](https://www.sec.gov/Archives/edgar/data/1640147/000164014726000033/fy2027q2earnings.htm) · A · **אומת**.
  - בעברית: כשהחברה מעכבת מניות ומשלמת במזומן את מס העובד ("סילוק נטו"), התשלום הזה הוא בפועל רכישה עצמית — והוא יושב במימון, לא בתזרים מפעילות.
- Salesforce: "Stock-based compensation expense excludes stock-based compensation expense related to the Company's restructuring initiatives, which is included in the restructuring and acquisition-related costs line." — [Salesforce 8-K, 26/8/2026](https://www.sec.gov/Archives/edgar/data/1108524/000110852426000187/crm-q2fy27xexhibit991.htm) · A · **אומת**.
- ServiceNow מוציאה "business combination and other related costs including compensation expense" — [ServiceNow 8-K, 28/10/2026](https://www.sec.gov/Archives/edgar/data/1373715/000137371526000092/erq3fy26.htm) · A · **אומת**.
- Adobe מוציאה "Stock-based and deferred compensation expense" (544 מיליון ברבעון) — פיצוי נדחה הוא במהותו מזומן — [Adobe 8-K, 10/9/2026](https://www.sec.gov/Archives/edgar/data/796343/000079634326000147/adbeex991q326.htm) · A · **אומת**.
- פרסים המסולקים במזומן (liability awards) נמדדים מחדש לשווי הוגן בכל תקופה עד הסילוק (ASC 718-30) — מהזיכרון — לא אומת · A.
- פרסים חלופיים ברכישה: החלק המיוחס לשירות שאחרי הצירוף נרשם כהוצאה אחרי הרכישה (ASC 805-30) — מהזיכרון — לא אומת · A.
- הנתון ב־XBRL: `ShareBasedCompensation` (התוספת בתזרים) ו־`AllocatedShareBasedCompensationExpense` שווים זה לזה בחמש החברות שנבדקו (למשל ServiceNow 2025 = 1,955; Palantir 2025 = 684) — [SEC XBRL API](https://data.sec.gov/api/xbrl/companyconcept/CIK0001373715/us-gaap/ShareBasedCompensation.json) · A · **אומת**.

### הסקות
- **מס מעסיק על SBC** — הוצאה במזומן, חוזרת; לנכות (אחרי מס) כשהחברה מוציאה אותו.
- **פיצוי נדחה / פרסים במזומן** — שכר לכל דבר; לנכות כשמוחזרים.
- **SBC בשורת ארגון מחדש / רכישה** (האצת הבשלה, פרסים חלופיים) — חד־פעמי במהותו, כמו שאר החד־פעמיים שהרחוב מוציא. אבל פרסי שימור לעובדים שנרכשו נמשכים 3–4 שנים: אם ה־SBC הכולל ב־XBRL גבוה בעקביות מהשורה שנוכתה בהודעה — זה סימן לתגמול חוזר "מוסתר".
- **עיכוב מניות לתשלום מס העובד** (במימון) — **לא** לנכות בנוסף: ההוצאה לפי שווי ההענקה כבר מכסה את הערך שניתן.

### פערים
- לא נמצא מחקר שבודק אם SBC של רכישות "חד־פעמי" חוזר אצל רוכשים סדרתיים.
- לא נבדק כמה חברות מוציאות מס מעסיק על SBC (במדגם שלנו: שתיים מחמש).

---

## שאלה 4 — הערכת השקעות ההון לתחזוקה (maintenance capex)

### תמצית
באפט עצמו אומר שהפחת **נמוך** מהתחזוקה האמיתית (ברקשייר כולה, ובמיוחד הרכבת) — כך שפחת אינו רצפה בטוחה כלפי מטה, אבל הוא רצפה סבירה. השיטה של Greenwald (חלק ההשקעות שמממן צמיחה = יחס הרכוש הקבוע למכירות × גידול המכירות) ניתנת לחישוב אוטומטי מ־XBRL, אבל רועשת (שלילית בירידת מכירות, מעוותת ברכישות).

### ממצאים מצוטטים
- באפט, 1986 — ההגדרה (c): "the average annual amount of capitalized expenditures for plant and equipment, etc. that the business requires to fully maintain its long-term competitive position and its unit volume." ועוד: "Our owner-earnings equation does not yield the deceptively precise figures provided by GAAP, since (c) must be a guess - and one sometimes very difficult to make." — [מכתב ברקשייר 1986](https://www.berkshirehathaway.com/letters/1986.html) · A · **אומת**.
- באפט, 2015: "I wish we could keep our businesses competitive while spending less than our depreciation charge, but in 51 years I've yet to figure out how to do so. Indeed, the depreciation charge we record in our railroad business falls far short of the capital outlays needed to merely keep the railroad running properly, a mismatch that leads to GAAP earnings that are higher than true economic earnings. (This overstatement of earnings exists at all railroads.)" ו־"You should also subtract something to reflect BNSF's inadequate depreciation charge." — [מכתב 2015](https://www.berkshirehathaway.com/letters/2015ltr.pdf) · A · **אומת**.
- באפט, 2016: "At BNSF… our GAAP depreciation charge last year was $2.1 billion. But were we to spend that sum and no more annually, our railroad would soon deteriorate and become less competitive. The reality is that – simply to hold our own – we need to spend far more than the cost we show for depreciation. Moreover, a wide disparity will prevail for decades." והסיבה: "GAAP-prescribed depreciation charges, which are necessarily based on historical cost… in the railroad industry, where current costs for many depreciable items far outstrip historical costs." — [מכתב 2016](https://www.berkshirehathaway.com/letters/2016ltr.pdf) · A · **אומת**.
- באפט, 2018: "Berkshire's $8.4 billion depreciation charge understates our true economic cost. In fact, we need to spend more than this sum annually to simply remain competitive in our many operations. Beyond those 'maintenance' capital expenditures, we spend large sums in pursuit of growth." — [מכתב 2018](https://www.berkshirehathaway.com/letters/2018ltr.pdf) · A · **אומת**.
- באפט, 2014: החברות הבנות השקיעו "a record $15 billion on plant and equipment during 2014, well over twice their depreciation charges" (כולל צמיחה) — [מכתב 2014](https://www.berkshirehathaway.com/letters/2014ltr.pdf) · A · **אומת**.
- שיטת Greenwald (Value Investing: From Graham to Buffett and Beyond, 2001): יחס ממוצע של רכוש קבוע למכירות (5 שנים, יש שמשתמשים ב־7 ובברוטו) × גידול המכירות בשנה = השקעה לצמיחה; תחזוקה = סך ההשקעות פחות זה. מגבלות שתועדו: תוצאה שלילית כשהיחס גבוה והצמיחה מהירה, כישלון בעסקי סחורות, כשגידול המכירות × היחס עולה על ההשקעה — [ValueWalk](https://www.valuewalk.com/calculate-maintenance-capital-expenditure/) · [einvestingforbeginners](https://einvestingforbeginners.com/maintenance-vs-growth-capital-expenditures-a-quick-primer/) · D · **לא אומת (קטע חיפוש)**; הספר עצמו — מהזיכרון — לא אומת · C.
- Meta מגדירה את ההשקעות כ־"capital expenditures, including principal payments on finance leases" (תחזית 135–145 מיליארד $ ל־2026) — [Meta 8-K, 21/10/2026](https://www.sec.gov/Archives/edgar/data/1326801/000162828026066700/meta-09302026xexhibit991.htm) · A · **אומת**.
- גילוי של "maintenance capex" על ידי החברה עצמה: נפוץ בעיקר ברכבות, תשתיות ו־MLP, לא בתקן — מהזיכרון — לא אומת.

### הסקות
- **פחת כרצפה**: באפט מראה שפחת לפי עלות היסטורית **מתחת** לתחזוקה האמיתית בעסקים עתירי נכסים ובאינפלציה. לכן "תחזוקה = פחת" מטה את רווח הבעלים **כלפי מעלה**. רצפה = פחת (רק של רכוש קבוע — **בלי** הפחתת מוחשיים שנרכשו, שמטופלת בנפרד).
- **Greenwald כאומדן** מעל הרצפה, ותקרה = סך ההשקעות. בשנה של ירידת מכירות — השקעה לצמיחה = 0 (לא שלילית).
- **רכישות**: קפיצה ברכוש הקבוע מרכישה מנפחת את היחס — עדיף חציון 5 שנים ולא ממוצע.
- **חכירות מימוניות**: חלק מהחברות משקיעות דרך חכירה (Meta כוללת אותה בהגדרת ההשקעות שלה) — הקרן שמשולמת שייכת לסך ההשקעות.

### פערים
- לא נמצא מחקר אקדמי שבודק איזו שיטה (פחת / Greenwald / מגמה) מנבאת טוב יותר את ההשקעות העתידיות או את התשואות.
- לא נבדק על נתוני XBRL כמה פעמים שיטת Greenwald יוצאת מחוץ לטווח [פחת, סך השקעות].

---

## שאלה 5 — הון חוזר

### תמצית
באפט מכניס לרווח הבעלים רק את התוספת להון החוזר **שנדרשת כדי לשמור על היקף הפעילות** — לא את ההון החוזר של הצמיחה. התזרים מפעילות (OCF) כולל את כל השינויים בהון החוזר: צמיחה, תזמון ועונתיות. אין פתרון מוסכם; בפועל משתמשים ב־12 חודשים (מבטל עונתיות) או בממוצע רב־שנתי.

### ממצאים מצוטטים
- באפט, 1986: "(If the business requires additional working capital to maintain its competitive position and unit volume, the increment also should be included in (c). However, businesses following the LIFO inventory method usually do not require additional working capital if unit volume does not change.)" — [מכתב 1986](https://www.berkshirehathaway.com/letters/1986.html) · A · **אומת**.
  - בעברית: רק ההון החוזר הנוסף שנדרש בלי צמיחה בכמויות (בעיקר אינפלציה במלאי) נכנס. בשיטת LIFO כמעט אין כזה.
- ServiceNow, דוגמה לרעש: ברבעון אחד הכנסות נדחות (463) ועמלות נדחות (213) מיליון — תנודות עונתיות גדולות ביחס ל־OCF של 839 — [ServiceNow 8-K, 28/10/2026](https://www.sec.gov/Archives/edgar/data/1373715/000137371526000092/erq3fy26.htm) · A · **אומת**.
- GuruFocus לוקח את "Change In Working Capital" מדוח תזרים המזומנים בחישוב רווח הבעלים — [GuruFocus](https://www.gurufocus.com/term/price-to-owner-earnings/PIERF) · D · **לא אומת (קטע חיפוש)**.

### הסקות
- בעסק צומח OCF מעניש את הצמיחה (מלאי ולקוחות), ובעסק מנויים הוא **מתגמל** אותה (הכנסות נדחות). לכן "OCF − השקעות" אינו רווח הבעלים של באפט לא בכיוון אחד ולא בשני.
- המימוש הישים: OCF של 12 חודשים (לא רבעון), ובאופן אופציונלי ממוצע 3 שנים של השינוי בהון החוזר. הפרדה בין הון חוזר "לתחזוקה" לבין "לצמיחה" (למשל לפי שיעור צמיחת המכירות) אפשרית, אבל מוסיפה רעש ולא נמצאה לה תמיכה אמפירית.

### פערים
- לא נמצא מקור מעשי־רציני (דרג C) שמממש את ההון החוזר "לתחזוקה" בנוסחה.

---

## שאלה 6 — מי מפרסם "רווח בעלים" ו־GAAP בקונצנזוס (בקצרה)

### תמצית
GuruFocus מפרסם "Owner Earnings" ו־"Price-to-Owner-Earnings", **לא** מחזיר SBC ומשתמש בשינוי בהון החוזר מדוח התזרים; האתר חוסם גישה אוטומטית מהסביבה. קונצנזוס GAAP נפרד — במסדי נתונים בתשלום; לא נמצא מקור חינמי שאומת.

### ממצאים מצוטטים
- GuruFocus: מחיר חלקי רווח בעלים למניה (12 חודשים); "will not add Stock Based Compensation back to net income"; "Change In Working Capital is from cashflow statement"; לחברות עם היסטוריה קצרה — "latest 5 years data"; יש שיטה נפרדת להערכת התחזוקה — [GuruFocus Price-to-Owner-Earnings](https://www.gurufocus.com/term/price-to-owner-earnings/PIERF) · D · **לא אומת (קטע חיפוש)**.
- `curl` לעמוד Owner Earnings של GuruFocus החזיר **403** (חסימת בוטים) — [GuruFocus](https://www.gurufocus.com/term/owner-earnings/KO) · D · **אומת** (שהגישה חסומה). תנאי השימוש לא נבדקו.
- קונצנזוס GAAP: I/B/E/S (LSEG) מחזיק מדד רווח למניה לפי GAAP בנפרד מהמדד "הרחובי"; גם FactSet ו־S&P Capital IQ — כולם בתשלום — מהזיכרון — לא אומת.
- Bentley et al. (2018): נתוני I/B/E/S (רחוב) שונים באופן שיטתי מה־non-GAAP של המנהלים — I/B/E/S "excludes managers' lower quality non‐GAAP numbers and (2) sometimes provides higher quality non‐GAAP measures that managers do not explicitly disclose" — [JAR 56(4), 2018](https://ideas.repec.org/a/bla/joares/v56y2018i4p1039-1081.html) · C · **אומת** (תקציר).

### הסקות
- אין מקור חינמי לרווח בעלים שאפשר לשאוב בלי הרשמה; ממילא הנוסחה של GuruFocus אינה של באפט במדויק (OCF כולל הון חוזר של צמיחה).

### פערים
- המקורות לעומק — בסשן המקביל.

---

## שאלה 7 — הראיות האקדמיות: רווח "רחוב" מול GAAP, ו־SBC בפרט

### תמצית
ההוצאות שמוצאות מרווח ה־non-GAAP **אינן** זניחות: הן מנבאות תזרים עתידי נמוך יותר ותשואות נמוכות (Doyle et al. 2003). לגבי SBC: מנהלים מוציאים אותו בעיקר מאופורטוניזם (Barth, Gow & Taylor 2012); חברות עם SBC גבוה מתומחרות ביתר ומניבות תשואות נמוכות, ואנליסטים שמנכים SBC מדויקים יותר (Mohanram et al. 2020); המשקיעים מגיבים ל־SBC ולהפחתה **בלי קשר** להוצאתם, וההוצאה אינה מסמנת שהפריט ארעי (Griffin & McInnis 2025). בעשור האחרון ההוצאות עברו מחד־פעמיים לחוזרים, ואיכותן ירדה (Ashby et al. 2026).

### ממצאים מצוטטים
- Bradshaw & Sloan (2002): "over the past 20 years there has been a dramatic increase in the frequency and magnitude of cases where 'GAAP' and 'Street' earnings differ. Further, there is a very strong bias toward the reporting of a Street earnings number that exceeds the GAAP earnings number. We also show that the market response to the Street earnings number has displaced GAAP earnings as a primary determinant of stock prices." — [JAR 40(1), 2002](https://ideas.repec.org/a/bla/joares/v40y2002i1p41-66.html) · C · **אומת** (תקציר).
- Doyle, Lundholm & Soliman (2003): "Higher levels of exclusions lead to predictably lower future cash flows. We also find that investors do not fully appreciate the lower cash flow implications at the time of the earnings announcement. A trading strategy based on the excluded expenses yields a large positive abnormal return in the years following the announcement, and persists after controlling for various risk factors and other anomalies." — [RAST 8(2), 2003](https://ideas.repec.org/a/spr/reaccs/v8y2003i2d10.1023_a1024472210359.html) · C · **אומת** (תקציר).
- Bhattacharya, Black, Christensen & Larson (2003): רווח ה־pro forma אינפורמטיבי וקבוע יותר מרווח תפעולי לפי GAAP — [JAE 36, 2003](https://ideas.repec.org/a/eee/jaecon/v36y2003i1-3p285-319.html) · C · מהזיכרון — לא אומת (אין תקציר ב־IDEAS).
- Barth, Gow & Taylor (2012), על SFAS 123R: "We find evidence consistent with managers opportunistically excluding the expense to increase earnings, smooth earnings, and meet earnings benchmarks but no evidence that these exclusions result in an earnings measure that better predicts future firm performance. In contrast, we find that analysts exclude the expense from earnings forecasts when exclusion increases earnings' predictive ability for future performance" — [RAST 17(3), 2012](https://ideas.repec.org/a/spr/reaccs/v17y2012i3d10.1007_s11142-012-9192-9.html) · C · **אומת** (תקציר).
- Mohanram, White & Zhao (2020): "firms with higher SBC exhibit both higher valuation ratios and lower returns, suggesting overvaluation… analysts who ignore SBC in valuation derive optimistically biased price targets, whereas analysts who treat SBC as an expense are unbiased on average. Together, our evidence indicates that market participants' failure to account for stock-based compensation as an expense leads to the overvaluation of equity." — [RAST 25(3), 2020](https://ideas.repec.org/a/spr/reaccs/v25y2020i3d10.1007_s11142-020-09541-0.html) · C · **אומת** (תקציר).
- Bhojraj (2020), "Stock compensation expense, cash flows, and inflated valuations", RAST 25(3) — באותו גיליון; הממצאים לא נקראו — מהזיכרון — לא אומת.
- Griffin & McInnis (2025), "Gone but not forgotten: Investor reaction to 'excluded' recurring expenses": על SBC ועל הפחתת מוחשיים שנרכשו (AMT) — "investors react similarly to unexpected SBC/AMT, regardless of firms' exclusion reporting"; אצל המוציאים, רווח **הכולל** את הפריטים מסביר טוב יותר את תגובת השוק; ההוצאה אינה מלמדת על ארעיות — [JAE 80(1), 2025](https://ideas.repec.org/a/eee/jaecon/v80y2025i1s0165410125000357.html) · C · **אומת** (תקציר מסוכם).
- Ashby, Christensen, Davis & Whipple, "A Decade Later: The Changing Landscape of Non-GAAP Reporting" (אפריל 2026, מאמר עבודה): ההוצאות הנפוצות בשנים האחרונות — "amortization of intangible assets (38.5 percent), (2) restructuring charges (34.6 percent), (3) stock-based compensation (34.3 percent)"; "we find an increase in the persistence of non-GAAP exclusions in the recent decade, consistent with a decline in non-GAAP exclusion quality"; ההתאמות הגדולות עברו "from items that are more infrequent or volatile in nature" לפריטים חוזרים; האנליסטים "do not corroborate some of managers' most aggressive non-GAAP exclusions" — [GMU](https://webdocs.gmu.edu/wp-content/uploads/1-Changing-Non-GAAP-Landscape.pdf) · C · **אומת**.
- Kolev, Marquardt & McVay (2008, TAR): אחרי פיקוח ה־SEC איכות ההוצאות השתפרה, אבל הוצאת פריטים חוזרים נשארה בעייתית — מהזיכרון — לא אומת.
- Aboody, Barth & Kasznik (2004, TAR): השוק מתמחר את הוצאת ה־SBC (לפי SFAS 123) כהוצאה — מהזיכרון — לא אומת.
- Frazzini, Kabiller & Pedersen, "Buffett's Alpha" (FAJ 2018): התשואה של ברקשייר מוסברת במידה רבה בגורמי איכות, סיכון נמוך ומינוף זול — לא ב"רווח בעלים" — מהזיכרון — לא אומת.

### הסקות
- הראיות **תומכות** בניכוי SBC: הוצאתו מאופורטוניסטית (מנהלים), השוק מגיב אליו בכל מקרה, וחברות עם SBC גבוה מתומחרות ביתר.
- הראיות **לא תומכות** בטענה שהפחתת מוחשיים "ארעית" — היא קבועה (נמשכת שנים) והשוק מגיב אליה. אבל הטיעון של באפט אינו "ארעיות" אלא "אין צורך להחליף את הנכס" — שאלה כלכלית שהמחקרים האלה לא בודקים (ראו שאלה 8).
- לא נמצא מחקר שבודק "תשואת רווח בעלים" או "תשואת רווח אחרי SBC" כמנבאת תשואות.

### פערים
- תשואת "רווח בעלים" כמנבא — לא נמצא מחקר.
- לא נקרא טקסט מלא של Bentley et al. 2018 לגבי SBC בפרט.

---

## שאלה 8 — הפחתת מוחשיים שנרכשו

### תמצית
באפט מחזיר לרווח את רוב ההפחתה שנובעת מרכישות — אבל במפורש **לא** הפחתה של תוכנה, שהיא "very real". בברקשייר הוא הגדיר רק כ־20% מההפחתה כ"אמיתית". הראיות האקדמיות מראות שההפחתה קבועה והשוק מתמחר אותה, ולכן אינן מצדיקות את ההוצאה מטעמי ארעיות — אבל גם אינן סותרות את הטיעון הכלכלי.

### ממצאים מצוטטים
- באפט, 2014: "serious investors should understand the disparate nature of intangible assets. Some truly deplete over time, while others in no way lose value. For software, as a big example, amortization charges are very real expenses. The concept of making charges against other intangibles, such as the amortization of customer relationships, however, arises through purchase-accounting rules and clearly does not reflect reality." ו־"amortization charges of $1.15 billion have been deducted as expenses. We would call about 20% of these 'real,' the rest not." — [מכתב 2014](https://www.berkshirehathaway.com/letters/2014ltr.pdf) · A · **אומת**.
- באפט, 2015: "I suggest that you ignore a portion of GAAP amortization costs. But it is with some trepidation that I do that, knowing that it has become common for managers to tell their owners to ignore certain expense items that are all too real." ו־"you should remember to add back most of the amortization charges we report." — [מכתב 2015](https://www.berkshirehathaway.com/letters/2015ltr.pdf) · A · **אומת**.
- באפט, 2018: "our acquisition-related amortization expenses of $1.4 billion… are not a true economic cost. We add back such amortization 'costs' to GAAP earnings when we are evaluating both private businesses and marketable stocks." — [מכתב 2018](https://www.berkshirehathaway.com/letters/2018ltr.pdf) · A · **אומת**.
- Griffin & McInnis (2025): ההוצאה של AMT אינה מסמנת ארעיות; השוק מגיב אליה בלי קשר להוצאה — [JAE 2025](https://ideas.repec.org/a/eee/jaecon/v80y2025i1s0165410125000357.html) · C · **אומת** (תקציר).
- Ashby et al. (2026): הפחתת מוחשיים היא ההוצאה הנפוצה ביותר (38.5%) ואחת מארבע הגדולות בסכום — [GMU, 2026](https://webdocs.gmu.edu/wp-content/uploads/1-Changing-Non-GAAP-Landscape.pdf) · C · **אומת**.
- ההיקף משתנה מהר אחרי רכישה: ServiceNow — הפחתת מוחשיים שנרכשו 198 מיליון ברבעון לעומת 33 שנה קודם (5% מההכנסות לעומת 1%) — [ServiceNow 8-K, 28/10/2026](https://www.sec.gov/Archives/edgar/data/1373715/000137371526000092/erq3fy26.htm) · A · **אומת**.
- חברות שמוציאות הפחתה מה־non-GAAP מקצות יותר ממחיר הרכישה למוחשיים בעלי חיים מוגבל — לא אומת (קטע חיפוש, בלי שם מחברים).

### הסקות
- הקו של באפט: להחזיר הפחתה של קשרי לקוחות, מותגים וצבר הזמנות; **לנכות** הפחתה של טכנולוגיה ותוכנה שנרכשו — שם נדרשת השקעה מתמשכת (פיתוח) כדי לשמור על הערך.
- בחברות תוכנה, חלק גדול מהמוחשיים שנרכשו הוא "טכנולוגיה מפותחת" — ולכן החזרת **כל** ההפחתה שם נדיבה יותר ממה שבאפט עצמו עושה בברקשייר.

### פערים
- לא מצאתי מחקר שמפריד בין הפחתת טכנולוגיה להפחתת קשרי לקוחות ובודק מה מנבא השקעות עתידיות.
- לא נבדק אם XBRL מאפשר לפצל את הוצאת ההפחתה לפי סוג נכס (בדרך כלל מדווחת רק העלות הברוטו לפי סוג).

---

## מה זה אומר למערכת שלנו

### (א) שיעור המס על SBC — **לשנות** (ביטחון: בינוני)
**ההמלצה:** t = שיעור ה־non-GAAP שהחברה עצמה מצהירה עליו, מאותה הודעה שהמסווג כבר קורא. אם אין — **21%** (הסטטוטורי הפדרלי, וקרוב לחציון השיעורים שנמצאו: 18%, 20.5%, 21%, 23%). **לא** שיעור ה־GAAP האפקטיבי, ו**לא** שורת "השפעת המס".
```
t = τ_ng  (רג'קס בהודעה: "non-GAAP (effective )?tax rate of X%" | "long-term projected tax rate of X%" | "long-term annual effective tax rate of X%" | "Non-GAAP effective income tax rate X%")
    אחרת 21%
BuffettEPS_q = StreetEPS_q − (S_q + PT_q) × (1 − t) / D_q
```
S = ה־SBC שהחברה הוציאה בהודעה (חלופה: `ShareBasedCompensation` ב־XBRL), PT = מס המעסיק על SBC אם הוצא בנפרד, D = המניות המדוללות שבהן חושב רווח ה־non-GAAP.
**למה:** רווח הרחוב מנורמל לפי τ_ng; ניכוי S×(1−τ_ng) מחזיר את אותו רווח "כאילו SBC הוצאה" באותו נרמול. שיעור ה־GAAP כולל את הטבות המס העודפות (ASU 2016-09) ואת ההפרשות לשווי — אצל Palantir 1.2%, וההגבלה ל־10% עדיין מנכה 44 מיליון $ לרבעון (~5%) יותר מהנרמול שלה (23%). שורת "השפעת המס" משקפת נרמול כולל: 0.3% (Adobe) עד 95.8% (Palantir).
**מגבלה ידועה:** כשהשיעור המנורמל כבר כולל את חיסכון המס מ־SBC (Adobe: −3.0 נקודות בגישור), רווח באפט יוצא גבוה בכ־5%. אפשר לתקן אם הגישור מופיע (t_eff = τ_ng − Δpp_SBC × P_ng / S), אבל כדאי לסמן בלבד.
**בדיקת שפיות זולה:** היחס `EmployeeServiceShareBasedCompensationTaxBenefitFromCompensationExpense / ShareBasedCompensation` ב־XBRL (ServiceNow 18.7%, Palantir 0%) — אם הוא 0, החברה לא נהנית כרגע מחיסכון מס על SBC; לסמן, לא להחליף את t.

### (ב) הפחתת מוחשיים שנרכשו — **להשאיר בלי ניכוי** (ביטחון: בינוני־גבוה), עם שדרוג אופציונלי
זה הקו של באפט (2015, 2018) וזה מה שרווח הרחוב כבר עושה. **שדרוג (גל 2):** לנכות את החלק של **טכנולוגיה/תוכנה** שנרכשה — באפט: "For software… amortization charges are very real expenses":
```
Amort_tech_ttm ≈ AmortAcq_ttm × GrossTech / GrossFiniteIntangibles   (לפי IntangibleAssetsByMajorClassAxis; סוגים כמו DevelopedTechnology / TechnologyBased / ComputerSoftware)
BuffettEPS −= Amort_tech_ttm × (1 − t) / D
```
(שמות התגיות מהזיכרון — לאמת ב־XBRL לפני מימוש.) בנוסף: להציג דגל כשההפחתה גדולה מ־10% מרווח הרחוב (ServiceNow אחרי רכישה: 198 מיליון לרבעון לפני מס, כ־19% מרווח ה־non-GAAP).

### (ג) SBC במזומן וחד־פעמי (ביטחון: בינוני)
```
לנכות (×(1−t)): SBC חוזר + "deferred compensation" כשהוא באותה שורה + מס מעסיק על SBC (Palantir, Snowflake)
לא לנכות: SBC בשורות ארגון מחדש / צירוף עסקים (כמו שאר החד־פעמיים שהרחוב מוציא); מס עובד שנוכה במניות (סילוק נטו — במימון)
דגל: אם Σ4 ShareBasedCompensation (XBRL) > 1.15 × Σ4 שורת ה־SBC בהודעות — "תגמול במניות בשורות אחרות"
```

### (ד) דילול מול ניכוי — **אין ספירה כפולה; להשאיר** (ביטחון: גבוה)
הוצאת 12 חודשים = עלות ההענקות של עכשיו; המניות המדוללות (שיטת המניות האוצר) = הענקות קודמות שפתוחות, כבר בקיזוז עלות שטרם הוכרה. גודל ה"כפילות" לכל היותר בגובה הפער בין בסיסי למדולל (<1%–2% אצל הגדולות). מה **לא** לעשות: (1) להחזיר SBC ולהסתמך על המניות המדוללות ("sloppy" — Damodaran); (2) לנכות גם SBC וגם רכישות לקיזוז הדילול; (3) ב־DCF — להגדיל את מספר המניות בגלל הענקות עתידיות כשהן כבר מנוכות מהתזרים.

### (ה) חברות בלי הודעות (זרות) — **לתקן את הנוסחה** (ביטחון: נמוך־בינוני)
`clamp(רחוב − GAAP, 0, SBC)` הגיוני, אבל יש בו שתי בעיות: התקרה היא SBC **לפני** מס (ניכוי יתר עד 21%), וכל ההפרש מיוחס ל־SBC גם כשהוא בא מהפחתה או מחד־פעמי. ההמלצה:
```
gap   = Σ4(StreetEPS − GAAP_EPS)
deduct = clamp( gap − AmortAcq_ttm × (1 − 0.21) / D ,  0 ,  SBC_ttm × (1 − t) / D )
```
כלומר: קודם מייחסים את ההפרש להפחתה (שממילא לא מנכים), ורק את היתר ל־SBC — עד תקרה של SBC **אחרי מס**. אם אין נתון הפחתה — אותה נוסחה בלי האיבר. נשאר עיוורון: הפרש שנובע מחד־פעמי (ירידת ערך) ייוחס ל־SBC. Barth et al. (2012) ו־Bentley et al. (2018) מראים שהרחוב (אנליסטים) וההנהלה לא תמיד מוציאים אותו דבר — לכן גם כשיש הודעה כדאי לוודא ש־|רחוב בפועל − EPS non-GAAP של ההנהלה| ≤ 0.03$; אחרת לעבור לנוסחה הזאת.

### (ו) תזרים הבעלים — **להשאיר את הגרסה הנוכחית ל־DCF, ולהוסיף גרסת תחזוקה למכפיל** (ביטחון: בינוני)
- **בסיס ל־DCF** — להשאיר `OCF − סך ההשקעות − SBC`: כשה־DCF מגדיל את הבסיס בקצב g, ההשקעות לצמיחה חייבות להיות בפנים (אחרת הצמיחה "חינם"). להוסיף לסך ההשקעות את קרן החכירות המימוניות כשמדווחת.
- **למכפיל "מחיר לרווח בעלים"** (ההגדרה של באפט 1986) — גרסת תחזוקה:
```
g_capex      = max(0, Rev_ttm − Rev_ttm[−1y]) × median_5y(PPE_net / Rev)        (Greenwald)
Dep          = פחת רכוש קבוע בלבד (DepreciationDepletionAndAmortization − AmortizationOfIntangibleAssets)
Capex_maint  = min( Capex_total , max( Dep , Capex_total − g_capex ) )
OwnerCF_maint = OCF_ttm − Capex_maint − SBC_ttm
```
הרצפה = פחת, כי באפט עצמו אומר שהפחת **מתחת** לתחזוקה האמיתית (2015, 2016, 2018); התקרה = סך ההשקעות. ההון החוזר נשאר כפי שהוא ב־OCF של 12 חודשים (כולל הון חוזר של צמיחה — שמרני לעסק שצורך הון חוזר, נדיב לעסק מנויים); אם רוצים לצמצם רעש — ממוצע 3 שנים של השינוי בהון החוזר. **אם צריך רק אחד** (מינימליזם) — להשאיר את הגרסה הקיימת: היא שמרנית, פשוטה ועקבית עם ה־DCF.

### סיכום הביטחון
| שאלה | החלטה | ביטחון |
|---|---|---|
| (א) מס על SBC | τ_ng מההודעה, אחרת 21% (לא ETR) | בינוני |
| (ב) הפחתת מוחשיים | לא לנכות; גל 2 — לנכות חלק הטכנולוגיה | בינוני־גבוה |
| (ג) SBC במזומן/חד־פעמי | לנכות מס מעסיק ופיצוי נדחה; לא את שורות הרכישה + דגל | בינוני |
| (ד) דילול + ניכוי | לא כפילות — להשאיר | גבוה |
| (ה) בלי הודעות | gap פחות הפחתה, תקרה SBC אחרי מס | נמוך־בינוני |
| (ו) תזרים בעלים | DCF: להשאיר; מכפיל: גרסת תחזוקה עם רצפת פחת | בינוני |
