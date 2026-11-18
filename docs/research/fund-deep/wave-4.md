# בדיקת העומק של מנתח החברות — גל 4 (18/11/2026)

> ההוראות: `wave-3-prompt.md`, ההיקף — `wave-3.md` §4. הרף כמו בגלים 2–3: כל פער מסווג (א מוצר / ב כלי / ג מקור / ד הגדרה),
> כל כלל — לפני/אחרי על כל היקום ושיפוט מול FSDS. הממצאים ממשיכים את המספור (מ־F17).
> לא מומש (מחכה למשתמש): F15, חוב בלי חזרה של ישויות מיוחדות (IP, ‏WY, ‏BEN), ו־0 במקום ריק לחברה בלי שורות חוב.

## 0. מצב פתיחה
- גל 2 (#678) מוזג ב־18/11 ‏09:49, גל 3 (#688) ב־13:10. הענף נפתח מ־main אחרי גל 3 (2.177.0, ‏823).
- תיקיית הטיוטה: FSDS כמו בגל 3; צילום הייצור — 525 חברות (XOM-OLD נכשלה כצפוי); ה־companyfacts, ה־submissions וה־bsf נקראו מחדש.

## 1. הייצור מול הטיוטה (סעיף 1)
- **הצילום נלקח ב־13:26** — 16 דקות אחרי המיזוג של גל 3 ו־~3.5 שעות אחרי גל 2.
- **התוצאה** (`report.py`): ‏749,193 ערכי בסיס, ‏696,755 אומתו, **29,354 פערים**, ‏23,084 הגדרה. בגל 2 היו בטיוטה 30,834 פערים.
- **הקוד של גל 2 חי**: דגלי `qsh` (ההודעה לעיתונות של הרבעון הרביעי) ב־430 חברות — 1,340 ערכי מניות ו־176 ערכי רווח למניה.
- **החוב בייצור עוד לא כמו בטיוטה**: ‏DIFF ‏2,330 (179 חברות), ‏MISS ‏1,091 (105 חברות). הכלי `$SCR/prodcmp.js` משווה את החוב
  בייצור ל־main עם המאזנים לפי הגשה (bsf) ובלעדיהם:

  | מצב החוב בייצור | חברות |
  |---|---|
  | כמו main **עם** bsf | 63 — A עד C, ועוד GEV, ‏HOOD, ‏META, ‏MRNA, ‏NTRS, ‏PSA (מניות שנפתחו) |
  | כמו main **בלי** bsf (המסלול הישן) | 103 — D עד Z |
  | שתי הגרסאות זהות | 210 |
  | מעורב / אף אחת / אין bsf בטיוטה | 19 / 20 / 84 |

  עבודת הרקע בשרת (`lib/bsfiled.js` ‏tick, כל 10 דקות, 2 בקשות לשנייה) מתקדמת לפי הסדר, ובזמן הצילום הגיעה בערך ל־C. היא לא תקועה:
  חברה שנכשלת לא עוצרת את הסבב, ומה שנשמר לא אובד בהפעלה מחדש. אבל פריסות תכופות של השרת מאטות אותה (8 מיזוגים בין שני
  הגלים, ובכל הפעלה הסבב הראשון מתחיל רק אחרי 3 דקות). **לגל 5**: למדוד שוב את החוב בייצור אחרי סבב מלא (בטיוטה זה ~11 אלף בקשות,
  כלומר ~1.5–2 שעות נטו).

## 2. F17 — שורות חוב בודדות (סעיף 3; א — תוקן)
המאזן המודפס של ~30 תאריכים, שבכל אחד שורה אחת שנקראה לא נכון:

| חברה | השורש | התיקון |
|---|---|---|
| LH (‏10-Q ‏2016–2024) | בדף ה־R התוויות זזו בשורה, ו־`LiabilitiesCurrent` (סך ההתחייבויות השוטפות) קיבלה את התווית "Long-term debt, less current portion" | `DEBT_NOTAG`: סכומי התחייבויות (`Liabilities…`) אינם חוב בשום תווית |
| MS | ‏`…NetOfCumulativeDebtValuationAdjustments` (רווח כולל אחר) שלילי, וכל העמודה נפסלה כשגיאת סימן | ‏`DEBT_NOTAG`: רווח כולל אחר |
| AIG ‏2015 | "(portion measured at fair value: 2015 - $4,844…)" הפעילה את מסנן השווי ההוגן | הערה בסוגריים עם סכום — גם `portion`/`measured` (כמו F16) |
| ED | ‏`ed:LongTermDebtExcludingHeldForSale` — ‏"Excluding Held For Sale" נראה כמו "held for sale" | בשם התגית — בלי סעיף `Excluding …` |
| VST ‏2018–2019 | ‏"Accounts receivable securitization program" (‏`ShortTermBorrowings`) לא זוהתה כחוב | ‏`DEBT_LAB`: ‏securitization — הלוואה מובטחת בחייבים |

- **לפני/אחרי בשש החברות**: ב־main ‏LH ‏27 שגויים, ‏ED ‏17, ‏VST ‏4, ‏MS ‏2, ועוד AIG ‏2 ו־AES ‏2 חסרים → **0 שגויים, 3 חסרים**.
  שלושת החסרים: AIG ‏2015-06-30 (אין FilingSummary בהגשה — ג), ‏AES ‏2024-06/09 (בדף ה־R של המאזן רק שורות עם ממדים — חוב עם
  חזרה, בלי חזרה, VIE — בלי השורה המאוחדת; ד).
- **על כל היקום** (`debt.js cmp --bsf-old`, המאזנים לשתי הגרסאות): ‹ממתין לסיום ה־bsf›.
- **בדיקה**: ‏`tests/fundamentals.test.js` ‏(30).

## 3. F18 — הרבעון הרביעי (סעיף 4; א — תוקן)
- **עקביות ברבעון מתויג (Sempra ‏2019)**: ‏XBRL מתייג רווח למניה ‏0.21 (לפני הפיצול), אבל הרווח ‏$447M חלקי המניות = ‏1.55. עכשיו
  `q4Press` בודק גם רבעון מתויג: כשרווח למניה × מניות רחוק מהרווח, ו־`q4From` מוצא בהודעה זוג שהמכפלה שלו היא הרווח — הזוג מההודעה.
  Sempra ‏2019: ‏0.105 → **0.775** (‏577.6M מניות). **על כל היקום — רבעון מתויג אחד בלבד השתנה** (Sempra).
- **רבעון הפסד**: בהפסד הממוצע המדולל = הבסיסי (אנטי־דילול). ההודעה מדפיסה לפעמים מדולל מלא או מותאם. עכשיו, כשהשנה הפסדית,
  `q4Press` משאיר את המניות המוערכות (הבסיסיות) ומחליף רק את הרווח למניה. **לפני/אחרי על כל היקום** (`q4pr.js --offline`, ‏main מול
  הענף): ‏**23 רבעונים** — רק המניות השתנו, והרווח למניה לא השתנה. למשל CRM ‏2015 (‏624.1M במקום 647.3M), ‏AXON ‏2021, ‏DVN
  ‏2015/2019/2020, ‏QCOM ‏2018, ‏T ‏2020, ‏TFC ‏2023, ‏TWLO ‏2022–2023. הרבעונים שההודעה החליפה: 4,169 → 4,151.
- **ההודעה מול XBRL ברבעונים מתויגים** (412 נבדקו, 329 תואמים): ב־61 המפענח לא מצא זוג שמכפלתו = הרווח, ולכן לא נוגעים. ‏22
  הפערים הם אותם 22 של גל 3:
  - Sempra ‏2019 — תוקן.
  - רבעוני הפסד (HIG, ‏VTR, ‏ALB, ‏FIS, ‏VRTX, ‏NRG ‏2015, ‏Sempra ‏2017) — ג. ברבעון מתויג לא נוגעים, וברבעון מוערך — הכלל למעלה.
  - Cintas ‏2015–2020 — שתי מחלקות, ג. מאז 2021 הרבעונים מוערכים, ומניות ההודעה = ההערכה עד 0.1% — אין בעיה.
  - Linde ‏2019 (מיזוג), ‏INVH ‏2022, ‏MPWR ‏2017 — ג.
  - הפרשי סנט: AMP ‏2017, ‏ECL ‏2017, ‏LHX ‏2019 — ג.
- **INVH ‏2020** (מוערך): ההערכה 566.14M מניות, ההודעה 584.51M, וההודעה גוברת. שנה רווחית, ולכן הכלל לא חל.
- **השנים בלי 8-K / בלי נספח 99** על כל היקום: ‏259 / ‏29. לא נבדקו לעומק (לגל 5).
- **בדיקה**: ‏`tests/fundamentals.test.js` ‏(29).

## 4. F19 — "חסר": תגיות במשמעות זהה (סעיף 2; א — תוקן חלקית, השאר ד)
**המיון** (הייצור, כל 525 החברות, בלי החוב — `$SCR/missroot3.py`, `$SCR/miss2.py`): ‏7,462 שורות "חסר" (מודפס, ואצלנו ריק).
‏4,300 בתגית שאינה ברשימה, ו־3,162 בתגית שכן ברשימה — בהן נדחתה (F15, ‏`opx`, ‏`cogsBasis`, ראשית מביאור) או שהיא אחת התגיות שנוספו
בגל הזה.

**נוספו** (US GAAP ו־IFRS, כל אחת אחרי הבדיקה ביקום; `tests/fundamentals.test.js` ‏(31)):
| מדד | תגיות | איפה |
|---|---|---|
| int | ‏`InterestAndDebtExpense` | ‏37 חברות — BA, ‏COP, ‏TXN, ‏HON, ‏NOC, ‏D, ‏CME, ‏GEN… |
| cogs | ‏`CostOfGoodsSoldExcludingDepreciation…`, ‏`CostOfServicesExcludingDepreciation…` | PPG, ‏SYY, ‏BALL, ‏HWM; ‏CTSH, ‏IQV, ‏IRM |
| msec | ‏`OtherShortTermInvestments`, ‏`DebtSecuritiesCurrent` | מבטחים (AIG, ‏CB, ‏HIG, ‏TRV…), ‏BDX, ‏PFE; ‏ADM |
| eps, sh | שותפויות: ‏`…PerOutstandingLimitedPartnershipUnitDiluted`, ‏`WeightedAverageLimitedPartnershipUnitsOutstandingDiluted` | ARES עד 2019, ‏KKR עד 2018 |
| IFRS | ‏buy, ‏rnd, ‏divp, ‏dep, ‏msec | SAP, ‏TSM, ‏NVO, ‏CCEP, ‏TRI, ‏FER |

**לפני/אחרי** (`allcmp.js` על 523): ‏2,630 ערכים השתנו — int ‏1,395, ‏msec ‏772, ‏cogs ‏138, ‏gp ‏121, ‏eps ‏49, ‏sh ‏53, ‏buy ‏39, ‏rnd
‏28, ‏divp ‏24, ‏dep ‏11. **השיפוט** (`judge.py`, מול השורה המודפסת בהגשה האחרונה ב־FSDS):
- **השתפרו**: int ‏976, ‏msec ‏636, ‏cogs ‏120, ‏eps ‏47, ‏sh ‏44, ‏buy ‏39, ‏rnd ‏28, ‏divp ‏24, ‏dep ‏11.
- **שתיהן מודפסות** 33 (KO: ‏"Marketable securities" ו־"Short-term investments" — שתי שורות, ואנחנו מציגים אחת).
- **"אף אחד"** 8: ‏PFE ‏msec ‏2016–2017 (החדש קרוב יותר), ‏HIG ‏2025, ‏DD ו־OXY ברבעון.
- **"nofsds"** 607: ‏2009–2011 לפני הכיסוי, רבעון רביעי נגזר, ‏gp נגזר.
- **הורעו 46**: ‏**Howmet ‏40** — ‏`InterestAndDebtExpense` בדוח האחרון ולכן הפכה לראשית; ב־2019–2023 הערכים שלה מביאור (371 מול 338
  המודפס), ו־`InterestExpense` נדחתה (F15) — 2007–2017 ריקים. זה F15 ושורות הרווח והפסד לפי הגשה — **לגל 5**. ועוד TRGP ‏2011–2012
  (F15), ‏HON (הפרש של מיליון), ‏PRU ‏2017 ‏msec (‏6,775 מול 6,800).

**נבדקו ביקום ונדחו (ד)**:
| תגית | מדד | למה |
|---|---|---|
| `InterestIncomeExpenseNet`, ‏`…NonoperatingNet` (1,187 שורות) | int | נטו — החלטה מגל 1 |
| `InterestExpenseOperating`, ‏`InterestAndDividendIncomeOperating`, ‏`CashAndDueFromBanks`, ‏`AvailableForSaleSecurities` | int, ‏rev, ‏cash, ‏msec | שורות של בנקים. ‏`CashAndDueFromBanks` ביקום: 239 השתפרו, אבל 67 "אף אחד" ו־11 הורעו (WFC ‏2015: ‏19.1B במקום 239.5B המודפס; ‏GS) |
| `MarketableSecurities` | msec | סך שוטף + לא שוטף. ביקום: 396 השתפרו, אבל 351 ערכים מביאורים שלא מודפסים במאזן (GD ‏47, ‏NOC ‏44, ‏NXPI, ‏MA) |
| `DepreciationNonproduction` | dep | רכיב. ביקום: 102 השתפרו (בנקים, ‏TROW), אבל ב־UDR היא מחליפה רק את Q2–Q3 — הרבעונים מערבבים שני מקורות |
| `IncomeLossAttributableToParent`, ‏`IncomeLossIncludingPortionAttributableToNoncontrollingInterest`, ‏`…BeforeIncomeTaxesDomestic` | pretax | שימוש שגוי בתגית (BR, ‏COST, ‏DECK) או רכיב (מקומי — PHM, ‏NVR) |
| `MarketableSecuritiesNoncurrent`, ‏`StockOptionPlanExpense`, ‏`PaymentsOfDividendsPreferredStock…`, ‏`PaymentsOfDividendsMinorityInterest`, ‏`PaymentsRelatedToTaxWithholdingForShareBasedCompensation`, ‏`InterestCostsIncurred`, ‏`InterestExpenseOther` | — | משמעות אחרת או רכיב |
| הכנסות ועלויות של ענף (`RealEstateRevenueNet`, ‏`OilAndGasRevenue`, ‏`RefiningAndMarketing…`, ‏`RevenueMineralSales`, ‏`FoodAndBeverageRevenue`…) | rev, ‏cogs | רכיב בהגדרה, גם כשאצל החברה הוא הסך |
| ‏`PaymentsForCapitalImprovements`, ‏`PaymentsToDevelopRealEstateAssets`, ‏`PaymentsToAcquireOtherProductiveAssets`, ‏`PaymentsForProceedsFromProductiveAssets` | capex | משמעות מעורבת, או נטו |
| תגיות פרטיות (BNY, ‏AON, ‏AMP, ‏ORCL, ‏MSFT, ‏WSM, ‏GOOG…) | — | לא ב־companyfacts ‏us-gaap — אפשר רק מהדוח לפי הגשה (גל 5) |

## 5. הכלים (ב)
- **`judge.py`** (חדש, במקום `$SCR/judgecf.py` של גל 3): השופט הכללי — כל מדד, לפי `STMT_OF` של המוצר.
- **`debt.js cmp --bsf-old`**: המאזנים לפי הגשה לשתי הגרסאות (בגל 3 — עותק בסקראצ'פד).
- **`verify.py`**: ‏`face_debt` — שורת "Face value" / ‏"Principal amount" אחרי השורה נטו, באותו סכום ±2%, לא נספרת פעמיים (Kroger).
  ‏`MET` — התגיות החדשות (שותפויות, ‏msec). ‏`debt_exp.py` (גל 3, סכום־ביניים) ביקום: 182 תאריכים צפויים השתנו (AWK ‏43, ‏SYF ‏35, ‏KMI
  ‏33, ‏LH ‏21, ‏DTE ‏20, ‏RF ‏11, ‏D ‏10, ‏CBRE ‏8).
- **`q4pr.js`**: שורת `tag` — רבעון מתויג שהרווח למניה שלו הוחלף.
- **RF ‏2012–2015**: הבודק לוקח את "Total short-term borrowings" (1,574), ואנחנו את "Total borrowed funds" (7,435, כולל ריפו). ב־FSDS
  חסרה שורה (ג). ‏"borrowed funds" של בנק — ד, כמו ההחלטה על PNC בגל 3.

## 6. לגל 5 (בסשן חדש)
- **החוב בייצור** — צילום ומדידה מחדש אחרי סבב מלא של ה־bsf בשרת (§1).
- **רווח והפסד לפי הגשה** (כמו F13 לתזרים): Howmet ‏(int), ‏`InterestAndDebtExpense` מביאור, ותגיות פרטיות בדוח (BNY, ‏ORCL, ‏MSFT).
- **השלמה בלי תקופה משותפת** — מתקבלת היום בלי בדיקה (HWM ‏2018 ‏int ‏=19 מ־`InterestExpenseDebt`).
- **הראשית מביאור** — BRO ‏msec.
- **259 שנים בלי 8-K בחלון ו־29 בלי נספח 99** (הרבעון הרביעי).
- השאלות שמחכות למשתמש — `docs/fund-deep-audit.md` §10.
