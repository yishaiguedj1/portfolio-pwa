# 03 — הדוחות הכספיים של PSH: אחזקות, עמלות, מסים וגלגול NAV (2014–2026)

> מחקר 16/11/2026. זה המסלול "הדוחות הכספיים" במחקר על שחזור תיק פרשינג סקוור (Bill Ackman) כתיק הדמו של THE SNOWBALL. נקראו כל הדוחות השנתיים והחציוניים של PSH מאז ההנפקה: FY2014–FY2025, ‏H1 2015–H1 2026, ושני דוחות ביניים רבעוניים (IMS) מ־2015. נקראו גם ששה מסמכים של Pershing Square Inc. ב־SEC. הקובץ מתמקד בתיק המניות של הקרן, לא במניה של PS Inc.
>
> **סימוני ודאות:**
> - **[מאומת]**: מספר או משפט שנקראו בדוח עצמו (PDF או HTML). זו ברירת המחדל: מספר בלי סימון נלקח ישירות מהמסמך.
> - **[נגזר]**: חישוב שלי ממספרים מאומתים (סכום, חילוק, הפרש).
> - **[הסקה]**: זיהוי או מסקנה שלא כתובים במפורש בדוח.
>
> **שיטת העבודה:**
> - הדוחות הורדו מארבעה מקורות רשמיים:
>   - מאגר הדיווחים של הרגולטור הבריטי (FCA National Storage Mechanism);
>   - מרשם הדוחות הכספיים של הרגולטור ההולנדי (AFM);
>   - ארכיון annualreports.com;
>   - EDGAR של ה־SEC.
> - הטקסט חולץ מה־PDF פעמיים: פעם עם שמירת פריסה ופעם בלי. הטבלאות פוענחו בסקריפטים ונבדקו בסכומי ביקורת:
>   - סכום ה־SoCI;
>   - גלגול ההון (הפרש 0 בכל התקופות);
>   - NAV למניה, עד הסנט;
>   - סכומי הייחוס.
> - האתר pershingsquareholdings.com חסום באתגר בוטים של Cloudflare. לא ניסינו לעקוף אותו.
> - web.archive.org ניתק את החיבור. לא ניסינו לעקוף.
> - שום קוד שהורד לא הורץ.
>
> **מונחים:**
> - **PSH**: ‏Pershing Square Holdings, Ltd., הקרן הסגורה מגרנזי שנסחרת באמסטרדם ובלונדון.
> - **PSCM**: ‏Pershing Square Capital Management, L.P., מנהל ההשקעות.
> - **PS Inc.**: ‏Pershing Square Inc. ‏(NYSE: PS, ‏CIK 2026053). לפני כן נקראה Pershing Square Holdco, L.P. היא חברת האם של PSCM, והונפקה ב־04/2026.
> - **PSLP / PSINTL / PSUS**: הקרנות הפרטיות Pershing Square, L.P. ו־Pershing Square International, ‏והקרן האמריקאית Pershing Square USA, Ltd. ‏(מ־30/04/2026).
> - **CSOI**: ‏Condensed Schedule of Investments, רשימת ההשקעות המקוצרת בדוח השנתי.
> - **SoCI / SoFP / CF**: דוח רווח והפסד כולל / מאזן / תזרים מזומנים.
> - **FVTPL**: שווי הוגן דרך רווח והפסד.
> - **HWM**: ‏high water mark, רף השיא שמעליו נגבית עמלת ביצוע.
> - **PRA**: ‏Potential Reduction Amount, הקיזוז מעמלת הביצוע.
> - **FPAUM**: נכסים משלמי עמלות.
> - **HHH**: ‏Howard Hughes Holdings. לפני 2023 נקראה HHC.
> - **SEG**: ‏Seaport Entertainment Group.
> - **מזהי מקור**: ‏`PSH-FY2025`, ‏`PSH-H1_2026`, ‏`SEC-424B4` וכו׳. הכתובות וטביעות sha256 נמצאות ב־`sources.json` (סעיף 15).

## 0. תקציר מנהלים

### 0.1 התשובה: האם כמויות המניות של PSH ציבוריות?

**כן, אבל רק פעם בשנה ורק לפוזיציות הגדולות.**

**מה יש בדוח השנתי:**
- כל דוח שנתי מבוקר של PSH ‏(FY2014–FY2025) כולל טבלה בשם **"Condensed Schedule of Investments"**. היא נמצאת בפרק "Supplemental U.S. GAAP Disclosures", שהוא חלק מהדוח המבוקר. [מאומת]
- לכל פוזיציה בשם מופיעים:
  - המנפיק;
  - סוג המכשיר: מניה רגילה, מניית בכורה, אופציה, TRS, פורוורד, סוופציון, CDS וכו׳;
  - מדינה וענף;
  - **מספר המניות**, או הנומינלי בנגזרים;
  - השווי ההוגן בדולרים;
  - האחוז מהנכסים נטו.
- לכל קבוצה מופיעה גם **העלות** (cost), ובפוזיציות שורט התמורה (proceeds).

**דוגמה: FY2025, עמ׳ 116 ב־PDF, נכון ל־31/12/2025:**

| מנפיק | מניות |
|---|---|
| Brookfield | 54,984,738 |
| Uber | 27,127,458 |
| Fannie Mae | 96,702,880 |
| Freddie Mac | 90,166,769 |
| Alphabet C | 6,163,871 |
| Amazon | 8,661,904 |
| Meta | 2,409,391 |
| Universal Music | 74,120,204 |
| Restaurant Brands | 20,710,238 (ועוד 140,873 יחידות RBI LP) |
| Howard Hughes | 16,518,818 |
| Hilton | 2,751,081 |

בנוסף, 13 סדרות של מניות בכורה של Fannie/Freddie, עם כמות לכל סדרה.

**מה אין:**
1. **פוזיציות קטנות** מצטברות לפי מדינה, ענף ומכשיר, בלי שם ובלי כמות.
   - **[הסקה]** הסף הוא 5% מהנכסים נטו **למנפיק**, בצירוף כל המכשירים שלו.
   - הראיות:
     - שורה מצטברת אף פעם לא עוברת 4.89%.
     - כל מנפיק בשמו עובר 5% במצטבר.
     - גם שורות זעירות של מנפיק גדול מופיעות בשמן. למשל 2,184 מניות בכורה F של Fannie Mae, ששוות ‎$50,865‎.
   - הדוח לא מציין את הסף במפורש.
2. **בדוחות החציוניים אין CSOI בכלל.** יש בהם:
   - שמות ותרומות לתשואה;
   - שווי האחזקות ב־HHH וב־SEG;
   - רשימת החברות במכתב המנהל.
3. **אין עסקאות**: אין תאריכי קנייה ומכירה ואין מחירי ביצוע. יש רק תיאורים מילוליים של "נכנסנו/יצאנו", ומהם נבנה ציר הזמן בסעיף 9.4.

**ההיקף:** 12 תמונות מצב שנתיות, 278 שורות פוזיציה, מהן 184 בשם ו־94 מצטברות. הנתונים המלאים ב־`holdings_by_period.json`. הטבלה המלאה בסעיף 3.

### 0.2 התובנות החשובות לשחזור מדויק

1. **NAV למניה** = ה־NAV של המניות הציבוריות חלקי מספר המניות הציבוריות (בלי מניות אוצר). אומת עד הסנט בכל 24 התקופות: שנתיות וחציוניות, 2014–2026. [נגזר]
2. **דמי ניהול**:
   - 0.375% לרבעון, מראש, על הנכסים נטו של המניות משלמות העמלות לפני עמלת ביצוע נצברת, נכון לסוף הרבעון הקודם.
   - מ־05/05/2025 מנוכה מהם "הפחתת HHH".
   - הייתה גם הפחתה חד־פעמית: 14.4 מיליון ב־8 רבעונים מ־04/2018, בעקבות הסדר Allergan, ו־2.48 מיליון ב־03/2019 (IEX).
   - בבדיקה מול הנתונים הרבעוניים של PS Inc. נשארת סטייה קטנה, 0.1%–1.2% לרבעון. היא מתאימה להחזר יחסי על מניות שנרכשו בחזרה במהלך הרבעון. [הסקה]
3. **עמלת ביצוע**:
   - 16% מעליית ה־NAV מעל ה־HWM למניה.
   - מתגבשת ב־31/12 ובכל תשלום דיבידנד, באופן יחסי לגודל הדיבידנד.
   - מקוזזת ב־PRA: ‏20% מעמלות הביצוע של הקרנות האחרות, ומ־30/04/2026 גם 20% מדמי הניהול של PSUS.
   - **עד 07/02/2024 ה־PRA שימש קודם להחזר עלויות ההנפקה של PSCM**, ולכן PSH שילמה 16% מלאים.
   - העמלה השנתית נרשמת כזכאי ומשולמת בתחילת השנה הבאה.
4. **גידורים בשורות נפרדות**:
   - CDS על מדדים ב־2020, סוופציונים על ריבית ב־2021–2024 ואופציות מט״ח נרשמים בשורות **"commodity interests"** בדוח רווח והפסד, לא בשורת ה־FVTPL.
   - הסכום בשורות האלה שווה **בדיוק** לסכום אותם סוגי נגזרים בביאור הנגזרים. [נגזר]
   - הם לא מופיעים ב־13F.
   - ב־2020 ההכנסה מהם הייתה ‎+2.06‎ מיליארד דולר.
5. **מסים**:
   - PSH פטורה ממס בגרנזי.
   - על דיבידנדים מנוכה מס במקור. השיעור האפקטיבי היה 16%–28% בשנה. [נגזר]
   - מס נדחה של 21% (FIRPTA) נרשם על הרווח שלא מומש ב־HHH וב־SEG.
6. **מינוף**:
   - אג״ח בדולר ובאירו. ב־31/12/2025 הן עמדו על 3.67 מיליארד בספרים.
   - הפרשי השער על האג״ח באירו נרשמים ברווח והפסד. ב־2025 הם הורידו ‎−93.96‎ מיליון, כלומר ‎−0.52‎ דולר למניה.
7. **מניות**:
   - 210,956,750 מניות מונפקות מאז 10/2019, ציבוריות ואוצר יחד.
   - רכישות חוזרות בהנחה ל־NAV מוסיפות ל־NAV למניה. ב־2025 התוספת הייתה ‎+0.85‎.
8. **דיבידנד רבעוני לפי נוסחה**: ממוצע ה־NAV למניה בכל ימי המסחר של דצמבר הקודם × 0.25%. ב־2026 הוא ‎$0.1837‎.
9. **כניסות ויציאות**: הדוחות מתארים מתי נכנסו לפוזיציה ויצאו ממנה. כמה דוגמאות:
   - Hertz נקנתה בסוף 2024 ונמכרה ביולי 2026.
   - UMG ו־Alphabet נמכרו במחצית הראשונה של 2026.
   - Hilton נמכרה בתחילת 2026.
   - ציר הזמן המלא בסעיף 9.4.

### 0.3 הפערים העיקריים

- **אין כמויות בדוחות החציוניים.**
- **פוזיציות מתחת ל־5% מופיעות בלי שם.** זיהוי משוער שלהן בסעיף 2.6.
- **אין עסקאות, תאריכים ומחירים.**
- **עמלות התיווך** מדווחות רק על commodity interests. על מניות הן חלק מהעלות.
- **לא קראנו**:
  - את אתר החברה;
  - את דוחות ה־NAV השבועיים והחודשיים שבו.
- **אין דוח PSH לרבעון 3 של 2026.** יש רק נתונים מצרפיים של PS Inc.

## 1. מקורות וכיסוי

**26 תקופות של PSH:**
- 12 שנתיות;
- 12 חציוניות;
- 2 דוחות ביניים (IMS) של 2015, שיש בהם רק ייחוס.

**מקורות הדוחות:**
- 15 מ־FCA NSM;
- 8 מ־AFM;
- 3 מ־annualreports.com.

**עוד:**
- 40 עותקים חלופיים נשמרו לבדיקה צולבת.
- "ייחוס": טבלת התורמים והגורעים לתשואה, בסעיף 12.
- תאריך "פורסם" ברשומות data-migration של NSM ‏(H1 2018–H1 2019) הוא תאריך המסמך במאגר, ולא בהכרח תאריך הפרסום.

| תקופה | סוף תקופה | מקור | פורסם | CSOI | ייחוס | קובץ מקומי |
|---|---|---|---|---|---|---|
| FY2014 | 2014-12-31 | AFM register | 2015-03-25 | כן | כן | `raw/afm/afm_20150325_16454_16454.pdf` |
| IMS_Q1_2015 | 2015-03-31 | AFM register | 2015-05-18 |  | כן | `raw/afm/afm_20150518_17163_17163.pdf` |
| H1_2015 | 2015-06-30 | AFM register | 2015-09-08 |  | כן | `raw/afm/afm_20150908_18112_18112.pdf` |
| IMS_Q3_2015 | 2015-09-30 | AFM register | 2015-11-11 |  | כן | `raw/afm/afm_20151111_18445_18445.pdf` |
| FY2015 | 2015-12-31 | AFM register | 2016-03-24 | כן | כן | `raw/afm/afm_20160324_19212_19212.pdf` |
| H1_2016 | 2016-06-30 | AFM register | 2016-08-26 |  | כן | `raw/afm/afm_20160826_20854_20854.pdf` |
| FY2016 | 2016-12-31 | AFM register | 2017-03-29 | כן | כן | `raw/afm/afm_20170329_24725_24725.pdf` |
| H1_2017 | 2017-06-30 | AFM register | 2017-08-17 |  | כן | `raw/afm/afm_20170817_27625_27625.pdf` |
| FY2017 | 2017-12-31 | annualreports.com |  | כן | כן | `raw/annualreports_com/OTC_PSHZF_2017.pdf` |
| H1_2018 | 2018-06-30 | FCA National Storage Mechanism | 2018-06-30 |  | כן | `raw/reports/NSM_data-migration_180611177.pdf` |
| FY2018 | 2018-12-31 | FCA National Storage Mechanism | 2018-12-31 | כן | כן | `raw/reports/NSM_data-migration_215812084.pdf` |
| H1_2019 | 2019-06-30 | FCA National Storage Mechanism | 2019-06-30 |  | כן | `raw/reports/NSM_data-migration_239173272.pdf` |
| FY2019 | 2019-12-31 | FCA National Storage Mechanism | 2020-04-06 | כן | כן | `raw/reports/NSM_Portal_NI-000001859.pdf` |
| H1_2020 | 2020-06-30 | FCA National Storage Mechanism | 2020-08-28 |  | כן | `raw/reports/NSM_Portal_NI-000010204.pdf` |
| FY2020 | 2020-12-31 | FCA National Storage Mechanism | 2021-03-29 | כן | כן | `raw/reports/NSM_Portal_NI-000022373_NI-000022373.pdf` |
| H1_2021 | 2021-06-30 | FCA National Storage Mechanism | 2021-08-25 |  | כן | `raw/reports/NSM_Portal_NI-000031909_NI-000031909.pdf` |
| FY2021 | 2021-12-31 | FCA National Storage Mechanism | 2022-03-29 | כן | כן | `raw/reports/NSM_Portal_NI-000046439_NI-000046439.pdf` |
| H1_2022 | 2022-06-30 | FCA National Storage Mechanism | 2022-08-19 |  | כן | `raw/reports/NSM_Portal_NI-000058114_NI-000058114.pdf` |
| FY2022 | 2022-12-31 | FCA National Storage Mechanism | 2023-03-29 | כן | כן | `raw/reports/NSM_Portal_NI-000071649_NI-000071649.pdf` |
| H1_2023 | 2023-06-30 | FCA National Storage Mechanism | 2023-08-18 |  | כן | `raw/reports/NSM_Portal_NI-000081307_NI-000081307.pdf` |
| FY2023 | 2023-12-31 | annualreports.com |  | כן | כן | `raw/annualreports_com/OTC_PSH_2023.pdf` |
| H1_2024 | 2024-06-30 | FCA National Storage Mechanism | 2024-08-15 |  | כן | `raw/reports/NSM_Portal_NI-000102839_NI-000102839.pdf` |
| FY2024 | 2024-12-31 | FCA National Storage Mechanism | 2025-03-14 | כן | כן | `raw/reports/NSM_Portal_NI-000115169_NI-000115169.pdf` |
| H1_2025 | 2025-06-30 | FCA National Storage Mechanism | 2025-08-20 |  | כן | `raw/reports/NSM_Portal_NI-000127442_NI-000127442.pdf` |
| FY2025 | 2025-12-31 | annualreports.com |  | כן | כן | `raw/annualreports_com/OTC_PSH_2025.pdf` |
| H1_2026 | 2026-06-30 | FCA National Storage Mechanism | 2026-08-12 |  | כן | `raw/reports/NSM_DirectUpload_NI-000150208_NI-000150208.pdf` |

**מסמכי ה־SEC של PS Inc.:** כולם הורדו מ־sec.gov, ‏CIK 2026053.

| מזהה | מסמך | תאריך הגשה | מספר הגשה | מה שימושי בו |
|---|---|---|---|---|
| SEC-424B4 | תשקיף סופי של ה־IPO | 30/04/2026 | 0001140361-26-018103 | הנתונים לפי קרן: AUM, ‏FPAUM ו־HWM של PSH ‏(2019–2025); הקצאת עמלת הביצוע; ‏Performance fee offset; החזר העמלות למקורבים; תשואות ברוטו; ייחוס לפי קרן |
| SEC-10Q-2026Q1 | 10-Q ל־31/03/2026 | 04/06/2026 | 0001193125-26-257665 | דמי ניהול רבעוניים של PSH; גלגול AUM; ‏HWM; ייחוס של רבעון 1 |
| SEC-10Q-2026Q2 | 10-Q ל־30/06/2026 | 13/08/2026 | 0001193125-26-349628 | ‏HWM ל־30/06; עמלה מועדפת; ‏HHH Reduction; ייחוס מצרפי |
| SEC-10Q-2026Q3 | 10-Q ל־30/09/2026 | 06/11/2026 | 0001193125-26-450239 | ‏AUM/FPAUM ל־30/09; ‏HWM; מניות HHH של PS Inc. |
| SEC-8K-20260604-EX991 | נספח 99.1: "Q1 and April 2026 Financial Supplement" | 04/06/2026 | 0001193125-26-257657 | גלגול AUM של PSH לרבעון 1 ולאפריל 2026 |
| SEC-8K-20261102-EX991 | נספח 99.1: דוח רבעון 3 2026 | 02/11/2026 | 0001193125-26-443749 | "Fee Revenue by Fund" (דמי הניהול של PSH לפי רבעון); ‏AUM לפי קרן |

## 2. כמויות המניות: איפה הן ומה בדיוק מגלים

### 2.1 מבנה ה־CSOI

- **מיקום:** הטבלה נמצאת בסוף הדוח השנתי, אחרי הביאורים, בפרק "Supplemental U.S. GAAP Disclosures". הפרק כולל גם את ה־Financial Highlights, בסעיף 10.
- **מבנה:** הטבלה מסודרת בהיררכיה:

| רמה | ערכים |
|---|---|
| חלק | Investments in Securities ‏/ Securities Sold, Not Yet Purchased ‏(שורט) ‏/ Derivative Contracts (נכסים והתחייבויות) |
| מכשיר | Common Stock, ‏Preferred Stock, ‏Investment in Affiliated Entity, ‏Equity Options Purchased/Written, ‏Total Return Swaps, ‏Equity Forwards, ‏Currency Options, ‏Foreign Currency Forwards, ‏Interest Rate Swaptions, ‏Credit Default Swaps, ‏Forward Purchase Units, ‏Warrants |
| מדינה | — |
| ענף | — |
| שורה | — |

- **סכומי ביניים:** בסוף כל מדינה ומכשיר מופיע סכום (Total), ובו העלות. סכומים אלה נשמרו ב־JSON כרשומות `total`.
- **נגזרים בשם:** טווח המחיר והפקיעה מופיע בתוך השם. דוגמה מ־FY2015: ‏"Mondelez International, Inc., Call Options, $36.64 - $41.39, 03/03/2017 - 06/28/2017", על 20,314,596 מניות בסיס, בשווי ‎$176,184,080‎.
- **רכבים מסונפים** ("Investment in Affiliated Entity"): רכבי השקעה משותפים לקרנות של PSCM. ה־CSOI פורק אותם לאחזקות שבתוכם, לפי חלקה של PSH:

| רכב | אחזקה | תקופה |
|---|---|---|
| ‏PS Fund 1 | Allergan; שורט על Actavis | 2014 |
| ‏PS V International | Air Products | 2014–2015 |
| ‏Pershing Square VI | ADP | 2017–2018 |
| ‏PS VII Master | UMG | 2021–2023 |
| ‏PS TH Sponsor | ‏PSTH | 2020–2021 |
| ‏SPARC Sponsor | ‏SPARC | 2021–2025 |

- **בסיס האחוז:**
  - עד FY2019: "net assets attributable to all shareholders". הבסיס כולל את ה־Management Shares, שלפי IFRS מסווגות כהתחייבות.
  - מ־FY2020: סך ההון (total equity).
  - הבסיסים עד FY2019:

| שנה | בסיס ($) |
|---|---|
| FY2014 | 6,560,373,067 |
| FY2015 | 5,216,509,672 |
| FY2016 | 4,516,772,022 |
| FY2017 | 4,242,954,525 |
| FY2018 | 3,832,957,828 |
| FY2019 | 5,720,645,822 |

### 2.2 כלל הגילוי: 5% למנפיק [הסקה]

**ההשערה:** הדוחות לא מציינים את הכלל. ההשערה מבוססת על הנתונים ועל התקן האמריקאי לחברות השקעה (ASC 946). לפי התקן, כל מנפיק שההשקעה בו עולה על 5% מהנכסים נטו מופיע בשמו, וכל השאר מצטבר.

**הראיות מהנתונים:**
- הגבוהה מבין השורות המצטברות היא 4.89%: ‏"Financial Services", ‏FY2017.
- ב־FY2024 שורת "Financial Services" (מניות רגילות) עמדה על 4.70%, ושורת מניות הבכורה על 1.02%. שתיהן בלי שם.
  - **[הסקה]** אלה Fannie Mae ו־Freddie Mac.
  - יחד הן עוברות 5%, אבל כל אחת לבד מתחת. זה מתאים לסף **למנפיק**, לא לענף.
  - ב־FY2025 שתיהן מופיעות בשמן.
- כשמנפיק עובר את הסף, כל השורות שלו מופיעות בדרך כלל בשמן, גם הזעירות. למשל ב־FY2016 מופיעות 2,184 מניות בכורה F של Fannie Mae, בשווי ‎$28,348‎.
- הסף נבדק כנראה על החשיפה **ברוטו**, לונג ושורט יחד. דוגמה: ב־FY2014 ‏Actavis מופיעה בשמה עם לונג של 3.15% בלבד, ולצדה שורט של 3.80% דרך PS Fund 1.
- **חריג לא מוסבר**: ב־FY2015 ‏Valeant מופיעה בשמה (17.11% במניות ו־2.03% באופציות קול), אבל שורת "אופציות שנכתבו / קנדה / Healthcare" ‏(‎−1.01%‎) מופיעה בלי שם. ייתכן שזו אופציה על מנפיק אחר, או שבצד ההתחייבויות הכלל הופעל אחרת.
- נגזרי מט״ח וריבית ונגזרים על מדדים מופיעים לפי סוג ולא לפי מנפיק:
  - ‏"Various Currency Put Options"
  - ‏"U.S. Swaptions"
  - ‏"Index Credit Default Swaps"

**שורות של נגזרים "בלי מנפיק" (מאומת):**

| שנה | שורה | שווי | % |
|---|---|---|---|
| FY2020 | ‏Index CDS — אירופה | ‎−308.6m‎ | ‎−3.41%‎ |
| FY2020 | ‏Index CDS — ארה״ב | ‎−216.0m‎ | ‎−2.39%‎ |
| FY2021 | סוופציוני ריבית אמריקאיים לשנתיים, נומינלי 88,654,000,000 | 732.2m | 6.42% |
| FY2021 | סוופציון לעשר שנים, נומינלי 3,658,144,000 | 107.9m | — |
| FY2022 | ‏U.S. Swaptions | 330.7m | — |
| FY2022 | ‏JPY Swaptions | 170.4m | — |
| FY2023 | ‏U.S. Swaptions | 217.3m | — |

### 2.3 עמודי ה־CSOI בכל דוח

מספרי העמודים הם של קובץ ה־PDF, בספירה מ־1. הם אומתו לפי כותרת הטבלה.

| שנה | עמודים | שנה | עמודים |
|---|---|---|---|
| FY2014 | 72–74 | FY2020 | 105–106 |
| FY2015 | 73–75 | FY2021 | 114–115 |
| FY2016 | 70–71 | FY2022 | 112–113 |
| FY2017 | 77–78 | FY2023 | 117–118 |
| FY2018 | 94–95 | FY2024 | 120–121 |
| FY2019 | 91–92 | FY2025 | 116–117 |

### 2.4 הדוחות החציוניים: מה כן יש בהם

**בדוח H1 2026 (המאוחר ביותר):**
- **חברות כלולות** (Associates; ‏HHH ו־SEG נחשבות כלולות לפי IFRS 12), שמוצגות בשווי הוגן:

| תאריך | HHH | SEG |
|---|---|---|
| 31/12/2023 | 33.0%, ‎$1,413,184,880‎ | — |
| 31/12/2024 | 33.0%, ‎$1,270,627,481‎ | 34.6%, ‎$123,036,207‎ |
| 31/12/2025 | 27.8%, ‎$1,317,706,112‎ | 34.6%, ‎$87,027,757‎ |
| 30/06/2026 | 27.7%, ‎$1,180,930,299‎ | 34.4%, ‎$117,093,493‎ |

  - הירידה של PSH מ־33.0% ל־27.8% ב־HHH נובעת מכך ש־Pershing Square Holdco קנתה 9 מיליון מניות HHH חדשות ב־05/05/2025, תמורת 900 מיליון דולר. [מאומת]
  - ספין־אוף SEG: ב־31/07/2024 חולקה מניית SEG אחת לכל 9 מניות HHH. ‏PSH קיבלה 1,835,424 מניות SEG.
- **מניות בכורה של HHH ‏(HHH Preferred):**
  - עלות: 1,000,000,000 דולר. נרכשו ב־04/06/2026, במימון רכישת Vantage. ההתחייבות נחתמה ב־17/12/2025.
  - שווי ב־30/06/2026: ‎$1,018,329,200‎ (רמה 3).
  - ההחזקה דרך 14 חברות בנות לא מאוחדות באיי קיימן: ‏PSH HHH Preferred Holding I–XIV.
  - שיטת השווי: הגבוה מבין מחיר ההנפקה עם צבירה של 4% לשנה לבין 1.5 × ההון העצמי של חברת הביטוח לפי US GAAP. היוון ב־15.9%.
- **SPARC:**
  - ‏PSH מחזיקה 88% מהזכויות הכלכליות ב־SPARC Sponsor.
  - שווי ב־31/12/2025: ‎$38,876,792‎; ב־30/06/2026: ‎$38,682,718‎.
  - הסכם רכישה עתידי (FPA) בין 250 מיליון (ב־‎$10‎) למיליארד (ב־‎$40‎), עד 30/09/2033.
- **מדרג השווי ההוגן** (באלפי דולרים):

| תאריך | רמה 1, מניות רגילות | רמה 1, מניות בכורה | רמה 3 | התחייבויות רמה 2 |
|---|---|---|---|---|
| 30/06/2026 | 15,231,150 | 74,871 | ‏SPARC ‏38,683; ‏HHH Preferred ‏1,018,329 | ‏TRS ‏93,141; מט״ח 1,487 |
| 31/12/2025 | 17,839,973 | 110,620 | — | — |

  ב־31/12/2025 יש גם TRS כנכס ברמה 2 בסך 39,961.
- **פירוק הרווח ממכשירים פיננסיים, H1 2026 (מאומת):**

| רכיב | סכום ($) |
|---|---|
| ני״ע — ממומש | ‎+2,295,775,267‎ |
| ני״ע — לא ממומש | ‎−4,063,729,638‎ |
| נגזרים — ממומש | ‎−20,939,451‎ |
| נגזרים — לא ממומש | ‎−100,495,150‎ |

  **[הסקה]** המימוש הגבוה מתאים ליציאות מ־UMG ומ־Alphabet במחצית.
- **מכתב המנהל, H1 2026, טבלת החברות (עמ׳ 9):**
  - Uber, ‏Brookfield, ‏Microsoft, ‏Meta, ‏Restaurant Brands, ‏Amazon, ‏Howard Hughes, ‏Fannie Mae, ‏Freddie Mac, ‏Visa, ‏Mastercard, ‏Netflix, ‏S&P Global.
  - ‏Intercontinental Exchange ו־Alcon נבנו אחרי 30/06/2026.
  - בטבלה אין כמויות.
- **הייחוס:** טבלת התורמים והגורעים מופיעה בכל דוח חציוני ושנתי. היא בסעיף 12.

### 2.5 כמויות שאפשר לגזור (גם בלי CSOI)

**HHH:**
- 16,518,818 מניות. הכמות מופיעה ב־CSOI של FY2023, ‏FY2024 ו־FY2025.
- **[נגזר]** גם ב־30/06/2026: שווי האחזקה ב־HHH חלקי מחיר HHH, שנגזר מה־10-Q של PS Inc. ‏(9,000,000 מניות בשווי 643.41m, כלומר ‎$71.49‎), נותן אותה כמות.

**SEG:**
- הכמות אחרי הספין־אוף **לא ידועה**.
- שווי 31/12/2024 חלקי 1,835,424 מניות נותן ‎$67.0‎ למניה. זה גבוה בהרבה ממחיר המניה, ולכן ככל הנראה PSH השתתפה בהנפקת זכויות של SEG ב־2024. [הסקה]

**מניות PSH של מקורבים:**
- ‏"Subject PSH Shares": ‏46,265,743 מניות של Ackman, ‏Israel, עובד לשעבר וגופים קשורים. כ־27% מהמניות הציבוריות ב־30/09/2026. [SEC]
- לפי דוח FY2025: ‏28% ב־2025 ו־27% ב־2024.

### 2.6 זיהוי השורות המצטברות [הסקה]

**השיטה:** הענף של כל מנפיק בשם קבוע בין השנים. למשל: Platform = ‏"Chemicals", ‏Lowe's = ‏"Retail", ‏Agilent = ‏"Life Science Tools/Industrials", ‏Canadian Pacific = ‏"Transportation". לכן שורה מצטברת מאותו ענף ומאותה מדינה, בשנה שבה הדוחות מתארים אחזקה, מצביעה על המנפיק.

**רמת הביטחון:**
- **ודאי (נגזר)**: התאמה מספרית מדויקת.
- **גבוה**: ענף ומדינה ייחודיים, ותיאור מילולי בדוח של אותה תקופה.
- **בינוני**: יש מועמד סביר אחד.
- **נמוך**: ניחוש.

| שנה | שורה מצטברת (חלק / מכשיר / מדינה / ענף) | שווי $ | % | זיהוי | ביטחון |
|---|---|---|---|---|---|
| FY2014 | שורט / מניה רגילה / איי קיימן / Consumer Products | 184,447,439 | 2.81 | שורט Herbalife (+ אופציות על אותו ענף: 140.6m נקנו, ‎−16.1m‎ נכתבו) | גבוה |
| FY2014 | מניה רגילה / ארה״ב / Real Estate Dev. | 162,331,296 | 2.47 | Howard Hughes (+ כתבי אופציה 57.7m, ‏TRS ‎−2.4m‎) | גבוה |
| FY2014 | מניה רגילה / ארה״ב / Financial Services | 112,319,097 | 1.71 | Fannie Mae / Freddie Mac (+ בכורה 3.9m) | בינוני |
| FY2014 | כתבי אופציה / ארה״ב / Financial Services | 53,298,052 | 0.81 | לא מזוהה | — |
| FY2015 | מניה רגילה / BVI / Consumer Products | 156,243,398 | 3.00 | Nomad Foods (התאגדה ב־BVI; מופיעה בייחוס של H1 2015; נמכרה ב־2017) | גבוה |
| FY2015 | מניה רגילה / ארה״ב / Chemicals | 221,453,293 | 4.25 | Platform Specialty Products | גבוה |
| FY2015 | אופציות שנכתבו / קנדה / Healthcare | ‎−52,730,448‎ | ‎−1.01‎ | אופציות Valeant (Valeant בשמה באותה שנה) | בינוני |
| FY2015–FY2016 | מניה רגילה / ארה״ב / Real Estate Dev. | 140.8m / 142.0m | 2.70 / 3.14 | Howard Hughes (+ כתבי אופציה ו־TRS) | גבוה |
| FY2016 | מניה רגילה / קנדה / Healthcare | 127,487,488 | 2.82 | Valeant (+ אופציות שנכתבו ‎−190.7m‎) | גבוה |
| FY2016 | מניה רגילה / BVI / Consumer Products | 126,716,045 | 2.81 | Nomad Foods | גבוה |
| FY2016 | מניה רגילה / ארה״ב / Chemicals | 169,326,329 | 3.75 | Platform Specialty Products | גבוה |
| FY2016 | מניה רגילה / ארה״ב / Financial Services "Other" | 97,671,349 | 2.16 | Freddie Mac (Fannie Mae בשמה) | בינוני |
| FY2017 | מניה רגילה / ארה״ב / Chemicals | 171,224,993 | 4.04 | Platform Specialty Products | גבוה |
| FY2017 | מניה רגילה / ארה״ב / Consumer Products "Other" | 195,665,657 | 4.61 | Nike (נקנתה ב־2017, נמכרה ב־2018; הענף של Nike ב־FY2024) | בינוני |
| FY2017 | מניה רגילה / ארה״ב / Financial Services | 207,627,228 | 4.89 | Fannie Mae / Freddie Mac | בינוני |
| FY2017 | אופציות שנקנו / איי קיימן / Consumer Products | 174,663,891 | 4.12 | אופציות מכר על Herbalife | בינוני |
| FY2018 | מניה רגילה + בכורה / ארה״ב / Financial Services | 84.6m + 53.0m | 2.21 + 1.38 | Fannie Mae / Freddie Mac (+ TRS ‏‎−49.7m‎) | בינוני |
| FY2018 | TRS / ארה״ב / Real Estate Dev. | ‎−94,960,677‎ | ‎−2.48‎ | TRS על Howard Hughes | גבוה |
| FY2019 | מניה רגילה / ארה״ב / Life Science Tools | 116,508,294 | 2.04 | Agilent (+ פורוורדים 59.0m; בשמה ב־FY2020) | גבוה |
| FY2019 | מניה רגילה / ארה״ב / Real Estate Dev. | 221,782,330 | 3.88 | Howard Hughes (+ פורוורדים 43.0m) | גבוה |
| FY2019 | מניה רגילה / ארה״ב / Financial Services "Other" | 146,673,764 | 2.56 | Freddie Mac (Fannie Mae בשמה) | בינוני |
| FY2020 | מניה רגילה + בכורה / ארה״ב / Financial Services | 347.0m + 94.3m | 3.83 + 1.04 | Fannie Mae / Freddie Mac | בינוני |
| FY2021 | מניה רגילה / קנדה / Transportation | 100,420,327 | 0.88 | Canadian Pacific (נקנתה ב־2021; + פורוורדים ‎−12.5m‎) | גבוה |
| FY2021–FY2023 | מניה רגילה / ארה״ב / Financial Services | 154.1m / 66.0m / 180.1m | 1.35 / 0.67 / 1.49 | Fannie Mae / Freddie Mac | בינוני |
| FY2023 | מניה רגילה / ארה״ב / Retail | 242,826,085 | 2.01 | Lowe's (בדוח FY2023 נכתב שהפוזיציה נמכרה; לפי הניסוח, בתחילת 2024) | גבוה |
| FY2024 | מניה רגילה + בכורה / ארה״ב / Financial Services | 611.6m + 132.4m | 4.70 + 1.02 | Fannie Mae + Freddie Mac (בייחוס 2024: ‏+2.2 ו־+2.3) | גבוה |
| FY2024 | מניה רגילה / ארה״ב / Transportation | 41,716,900 | 0.32 | Hertz ("initiated a position in Hertz at the end of 2024", ‏PSH-H1_2025) | בינוני־גבוה |
| FY2024–FY2025 | מניה רגילה / ארה״ב / Leisure & Hospitality | 123,036,207 / 87,027,757 | 0.95 / 0.58 | **SEG**: שווה בדיוק לשווי SEG בביאור החברות הכלולות | ודאי (נגזר) |
| FY2025 | מניה רגילה / ארה״ב / Consumer Services "Other" | 70,189,342 | 0.47 | אולי Hertz (נמכרה ביולי 2026) | נמוך |
| FY2025 | TRS / ארה״ב / Consumer Services | ‎+39,960,965 / −34,093,323‎ | ‎+0.27 / −0.23‎ | לא מזוהה | — |

## 3. טבלת ה־CSOI המלאה: כל שורות הפוזיציה, FY2014–FY2025

**איך לקרוא את הטבלה:**
- הטבלה כוללת את כל 278 שורות הפוזיציה, כולל שורות מצטברות, בסימון "(מצטבר, ללא שם)".
- שורות הסיכום עם העלות לא נכללו כאן. הן מופיעות ב־`holdings_by_period.json` כרשומות `type: total`, עם השדות `cost_or_proceeds` ו־`cost_kind`.
- ערכי שורט ונגזרים בצד ההתחייבויות מוצגים בשלילי.
- "כמות / נומינלי": מספר מניות, מניות בסיס של אופציה, או נומינלי של אג״ח או סוופציון.
- הכמויות כאן הן של PSH בלבד. כמויות PSCM כולה (כל הקרנות) נמצאות ב־13F, במסלול אחר.

| שנה | מנפיק / שורה | מכשיר | מדינה/אזור | כמות / נומינלי | שווי הוגן $ | % מהנכסים נטו |
|---|---|---|---|---|---|---|
| FY2014 | Restaurant Brands International Inc. | Common Stock | Canada | 13,946,447 | 544,469,291 | 8.30 |
| FY2014 | Restaurant Brands International Limited Partnership | Common Stock | Canada | 140,873 | 5,315,093 | 0.08 |
| FY2014 | Canadian Pacific Railway Limited | Common Stock | Canada | 4,985,556 | 960,666,786 | 14.64 |
| FY2014 | Platform Specialty Products Corporation | Common Stock | United States | 15,785,226 | 366,532,948 | 5.59 |
| FY2014 | Financial Services (מצטבר, ללא שם) | Common Stock | United States |  | 112,319,097 | 1.71 |
| FY2014 | Zoetis Inc. | Common Stock | United States | 14,997,676 | 645,349,998 | 9.84 |
| FY2014 | Air Products and Chemicals, Inc. | Common Stock | United States | 5,547,537 | 800,121,262 | 12.20 |
| FY2014 | Real Estate Development and Operating (מצטבר, ללא שם) | Common Stock | United States |  | 162,331,296 | 2.47 |
| FY2014 | Financial Services (מצטבר, ללא שם) | Preferred Stock | United States |  | 3,899,346 | 0.06 |
| FY2014 | Allergan, Inc., Common Stock Purchased | Investments in Affiliated Entities | United States | 9,793,412 | 2,081,981,457 | 31.74 |
| FY2014 | Actavis plc, Common Stock Sold Short | Investments in Affiliated Entities | United States | 968,403 | -249,276,616 | -3.80 |
| FY2014 | Other assets and liabilities (מצטבר, ללא שם) | Investments in Affiliated Entities | United States |  | 266,856,374 | 4.07 |
| FY2014 | Air Products and Chemicals, Inc., Common Stock | Investments in Affiliated Entities | United States | 625,179 | 90,169,550 | 1.37 |
| FY2014 | Other assets and liabilities (מצטבר, ללא שם) | Investments in Affiliated Entities | United States |  | 451,901 | 0.01 |
| FY2014 | Consumer Products (מצטבר, ללא שם) | Common Stock | Cayman Islands |  | 184,447,439 | 2.81 |
| FY2014 | Actavis plc | Common Stock | Europe | 803,534 | 206,837,686 | 3.15 |
| FY2014 | Sovereign Debt (מצטבר, ללא שם) | Credit Default Swap Contracts, buy protection | Asia |  | -605,608 | -0.01 |
| FY2014 | Financial Services (מצטבר, ללא שם) | Credit Default Swap Contracts, buy protection | Europe |  | -215,913 | 0.00 |
| FY2014 | Various Currency Call Options, U.S. Dollar Put Options | Currency Call/Put Options Purchased |  |  | 5,943,842 | 0.09 |
| FY2014 | Consumer Products (מצטבר, ללא שם) | Equity Options Purchased | Cayman Islands |  | 140,574,953 | 2.14 |
| FY2014 | Consumer Products (מצטבר, ללא שם) | Equity Options Written | Cayman Islands |  | -16,071,113 | -0.24 |
| FY2014 | Buy U.S. Dollar, Sell Canadian Dollar | Foreign Currency Forward Contracts |  |  | 23,822,484 | 0.36 |
| FY2014 | Financial Services (מצטבר, ללא שם) | Total Return Swap Contracts, long exposure | United States |  | -981,281 | -0.01 |
| FY2014 | Zoetis Inc. | Total Return Swap Contracts, long exposure | United States | 354,939 | 976,337 | 0.01 |
| FY2014 | Real Estate Development and Operating (מצטבר, ללא שם) | Total Return Swap Contracts, long exposure | United States |  | -2,418,516 | -0.04 |
| FY2014 | Financial Services (מצטבר, ללא שם) | Warrants | United States |  | 53,298,052 | 0.81 |
| FY2014 | Real Estate Development and Operating (מצטבר, ללא שם) | Warrants | United States |  | 57,652,072 | 0.88 |
| FY2015 | Consumer Products (מצטבר, ללא שם) | Common Stock | British Virgin Islands |  | 156,243,398 | 3.00 |
| FY2015 | Valeant Pharmaceuticals International, Inc. | Common Stock | Canada | 8,780,130 | 892,500,214 | 17.11 |
| FY2015 | Restaurant Brands International Inc. | Common Stock | Canada | 15,346,143 | 573,331,902 | 10.99 |
| FY2015 | Restaurant Brands International Limited Partnership | Common Stock | Canada | 140,873 | 5,259,951 | 0.10 |
| FY2015 | Canadian Pacific Railway Limited | Common Stock | Canada | 5,663,590 | 722,674,084 | 13.85 |
| FY2015 | Chemicals (מצטבר, ללא שם) | Common Stock | United States |  | 221,453,293 | 4.25 |
| FY2015 | Mondelez International, Inc. | Common Stock | United States | 18,637,587 | 835,709,401 | 16.02 |
| FY2015 | Financial Services (מצטבר, ללא שם) | Common Stock | United States |  | 107,939,728 | 2.07 |
| FY2015 | Zoetis Inc. | Common Stock | United States | 16,929,202 | 811,247,360 | 15.55 |
| FY2015 | Air Products and Chemicals, Inc. | Common Stock | United States | 6,158,683 | 801,306,245 | 15.36 |
| FY2015 | Real Estate Development and Operating (מצטבר, ללא שם) | Common Stock | United States |  | 140,848,102 | 2.70 |
| FY2015 | Financial Services (מצטבר, ללא שם) | Preferred Stock | United States |  | 5,837,885 | 0.11 |
| FY2015 | Air Products and Chemicals, Inc., Common Stock | Investment in Affiliated Entity | United States | 626,137 | 81,466,685 | 1.56 |
| FY2015 | Other assets and liabilities (מצטבר, ללא שם) | Investment in Affiliated Entity | United States |  | 390,929 | 0.01 |
| FY2015 | Herbalife Ltd. | Common Stock | Cayman Islands | 7,218,484 | 387,055,112 | 7.42 |
| FY2015 | Sovereign Debt (מצטבר, ללא שם) | Credit Default Swap Contracts, buy protection | Asia |  | -366,977 | -0.01 |
| FY2015 | Financial Services (מצטבר, ללא שם) | Credit Default Swap Contracts, buy protection | Europe |  | -33,130 | 0.00 |
| FY2015 | Various Currency Call Options, U.S. Dollar Put Options | Currency Call/Put Options Purchased |  |  | 3,802,977 | 0.07 |
| FY2015 | Various Currency Put Options, U.S. Dollar Call Options | Currency Call/Put Options Purchased |  |  | 103,111,983 | 1.98 |
| FY2015 | Various Currency Put Options, U.S. Dollar Call Options | Currency Call/Put Options Written |  |  | -9,556,016 | -0.18 |
| FY2015 | Mondelez International, Inc., $38.33 - $39.58, 04/12/2017 - 05/05/2017 | Equity Forwards, long exposure | United States | 2,972,624 | 20,768,486 | 0.40 |
| FY2015 | Valeant Pharmaceuticals International, Inc., Call Options, $95, 01/20/2017 | Equity Options Purchased | Canada | 3,687,444 | 105,829,643 | 2.03 |
| FY2015 | Consumer Products (מצטבר, ללא שם) | Equity Options Purchased | Cayman Islands |  | 682,385 | 0.01 |
| FY2015 | Mondelez International, Inc., Call Options, $36.64 - $41.39, 03/03/2017 - 06/28/2017 | Equity Options Purchased | United States | 20,314,596 | 176,184,080 | 3.38 |
| FY2015 | Healthcare (מצטבר, ללא שם) | Equity Options Written | Canada |  | -52,730,448 | -1.01 |
| FY2015 | Currencies (מצטבר, ללא שם) | Foreign Currency Forward Contracts |  |  | 40,780,356 | 0.78 |
| FY2015 | Financial Services (מצטבר, ללא שם) | Total Return Swap Contracts, long exposure | United States |  | -13,608,041 | -0.26 |
| FY2015 | Zoetis Inc. | Total Return Swap Contracts, long exposure | United States | 354,939 | 2,664,152 | 0.05 |
| FY2015 | Real Estate Development and Operating (מצטבר, ללא שם) | Total Return Swap Contracts, long exposure | United States |  | -49,679,591 | -0.95 |
| FY2015 | Real Estate Development and Operating (מצטבר, ללא שם) | Warrants | United States |  | 45,561,789 | 0.87 |
| FY2016 | Consumer Products (מצטבר, ללא שם) | Common Stock | British Virgin Islands |  | 126,716,045 | 2.81 |
| FY2016 | Healthcare (מצטבר, ללא שם) | Common Stock | Canada |  | 127,487,488 | 2.82 |
| FY2016 | Restaurant Brands International Inc. | Common Stock | Canada | 15,878,681 | 756,777,936 | 16.76 |
| FY2016 | Restaurant Brands International Limited Partnership | Common Stock | Canada | 140,873 | 6,714,233 | 0.15 |
| FY2016 | Chemicals (מצטבר, ללא שם) | Common Stock | United States |  | 169,326,329 | 3.75 |
| FY2016 | Mondelez International, Inc. | Common Stock | United States | 9,780,707 | 433,578,741 | 9.60 |
| FY2016 | Federal National Mortgage Association | Common Stock | United States | 44,741,273 | 174,490,965 | 3.86 |
| FY2016 | Other (מצטבר, ללא שם) | Common Stock | United States |  | 97,671,349 | 2.16 |
| FY2016 | Air Products and Chemicals, Inc. | Common Stock | United States | 624,588 | 89,828,246 | 1.99 |
| FY2016 | Real Estate Development and Operating (מצטבר, ללא שם) | Common Stock | United States |  | 142,018,102 | 3.14 |
| FY2016 | Chipotle Mexican Grill, Inc. | Common Stock | United States | 1,329,537 | 501,660,901 | 11.11 |
| FY2016 | Federal National Mortgage Association Series T Preferred 8.25% | Preferred Stock | United States | 1,161,061 | 9,172,382 | 0.20 |
| FY2016 | Federal National Mortgage Association Series S Preferred 8.25% | Preferred Stock | United States | 83,349 | 666,792 | 0.02 |
| FY2016 | Federal National Mortgage Association Series F Preferred 0% | Preferred Stock | United States | 2,184 | 28,348 | 0.00 |
| FY2016 | Other (מצטבר, ללא שם) | Preferred Stock | United States |  | 629,316 | 0.01 |
| FY2016 | Herbalife Ltd. | Convertible Bonds | Cayman Islands | 29,616,000 | 27,154,022 | 0.60 |
| FY2016 | Herbalife Ltd. | Common Stock | Cayman Islands | 7,439,972 | 358,160,252 | 7.93 |
| FY2016 | Various Currency Put Options, U.S. Dollar Call Options | Currency Call/Put Options Purchased |  |  | 12,302,780 | 0.26 |
| FY2016 | Healthcare (מצטבר, ללא שם) | Equity Options Purchased | Canada |  | 4,112,928 | 0.09 |
| FY2016 | Consumer Products (מצטבר, ללא שם) | Equity Options Purchased | Cayman Islands |  | 9,186,811 | 0.21 |
| FY2016 | Mondelez International, Inc., Call Options, $30.00 - $41.39, 03/03/2017 - 01/19/2018 | Equity Options Purchased | United States | 31,451,985 | 275,505,450 | 6.10 |
| FY2016 | Air Products and Chemicals, Inc., Call Options, $62.04, 03/01/2018 - 03/15/2018 | Equity Options Purchased | United States |  | 530,830,524 | 11.75 |
| FY2016 | Healthcare (מצטבר, ללא שם) | Equity Options Written | Canada |  | -190,734,223 | -4.22 |
| FY2016 | Currencies (מצטבר, ללא שם) | Foreign Currency Forward Contracts |  |  | 5,329,195 | 0.12 |
| FY2016 | Federal National Mortgage Association | Total Return Swap Contracts, long exposure | United States | 25,136,078 | 55,452,738 | 1.23 |
| FY2016 | Other (מצטבר, ללא שם) | Total Return Swap Contracts, long exposure | United States |  | 31,180,050 | 0.69 |
| FY2016 | Real Estate Development and Operating (מצטבר, ללא שם) | Total Return Swap Contracts, long exposure | United States |  | 53,602,137 | 1.19 |
| FY2016 | Real Estate Development and Operating (מצטבר, ללא שם) | Warrants | United States |  | 44,660,268 | 0.99 |
| FY2017 | Restaurant Brands International Inc. | Common Stock | Canada | 14,263,243 | 876,904,180 | 20.67 |
| FY2017 | Restaurant Brands International Limited Partnership | Common Stock | Canada | 140,873 | 8,630,138 | 0.20 |
| FY2017 | Automatic Data Processing, Inc. | Common Stock | United States | 3,832,106 | 449,084,502 | 10.58 |
| FY2017 | Chemicals (מצטבר, ללא שם) | Common Stock | United States |  | 171,224,993 | 4.04 |
| FY2017 | Mondelez International, Inc. | Common Stock | United States | 7,200,229 | 308,169,801 | 7.26 |
| FY2017 | Other (מצטבר, ללא שם) | Common Stock | United States |  | 195,665,657 | 4.61 |
| FY2017 | Financial Services (מצטבר, ללא שם) | Common Stock | United States |  | 207,627,228 | 4.89 |
| FY2017 | The Howard Hughes Corporation | Common Stock | United States | 2,067,490 | 271,399,412 | 6.40 |
| FY2017 | Chipotle Mexican Grill, Inc. | Common Stock | United States | 1,329,537 | 384,276,079 | 9.06 |
| FY2017 | Financial Services (מצטבר, ללא שם) | Preferred Stock | United States |  | 11,012,767 | 0.26 |
| FY2017 | Automatic Data Processing, Inc., Common Stock | Investment in Affiliated Entity | United States | 1,009,174 | 118,265,101 | 2.79 |
| FY2017 | Automatic Data Processing, Inc., Equity Call Options Purchased, $55.50 - $87.93, 01/15/2021 | Investment in Affiliated Entity | United States | 2,447,111 | 136,147,787 | 3.21 |
| FY2017 | Other assets and liabilities (מצטבר, ללא שם) | Investment in Affiliated Entity | United States |  | 2,407,858 | 0.05 |
| FY2017 | Various Currency Put Options, U.S. Dollar Call Options | Currency Call/Put Options Purchased |  |  | 130,909 | 0.00 |
| FY2017 | Consumer Products (מצטבר, ללא שם) | Equity Options Purchased | Cayman Islands |  | 174,663,891 | 4.12 |
| FY2017 | Automatic Data Processing, Inc., Call Option, $76.06, 06/23/2020 | Equity Options Purchased | United States | 5,391,734 | 253,047,022 | 5.96 |
| FY2017 | Automatic Data Processing, Inc., Call Option, $63.00, 01/15/2021 | Equity Options Purchased | United States | 1,102,097 | 65,984,537 | 1.56 |
| FY2017 | Mondelez International, Inc., Call Option, $30.00, 01/26/2018 | Equity Options Purchased | United States | 15,000,000 | 192,532,245 | 4.54 |
| FY2017 | Currencies (מצטבר, ללא שם) | Foreign Currency Forward Contracts |  |  | -740,892 | -0.02 |
| FY2017 | Volatility Call Options | Index Options Purchased | United States |  | 401,528 | 0.01 |
| FY2017 | Mondelez International, Inc. | Total Return Swap Contracts, long exposure | United States | 7,006,417 | -487,538 | -0.01 |
| FY2017 | Financial Services (מצטבר, ללא שם) | Total Return Swap Contracts, long exposure | United States |  | 30,437,246 | 0.72 |
| FY2017 | The Howard Hughes Corporation | Total Return Swap Contracts, long exposure | United States | 3,467,149 | 22,293,578 | 0.52 |
| FY2018 | Restaurant Brands International Inc. | Common Stock | Canada | 14,129,498 | 738,972,745 | 19.28 |
| FY2018 | Restaurant Brands International Limited Partnership | Common Stock | Canada | 140,873 | 7,503,938 | 0.20 |
| FY2018 | Platform Specialty Products Corporation | Common Stock | United States | 27,228,888 | 281,274,413 | 7.34 |
| FY2018 | Financial Services (מצטבר, ללא שם) | Common Stock | United States |  | 84,555,564 | 2.21 |
| FY2018 | Hilton Worldwide Holdings Inc. | Common Stock | United States | 8,526,771 | 612,222,158 | 15.97 |
| FY2018 | United Technologies Corporation | Common Stock | United States | 3,907,331 | 416,052,605 | 10.85 |
| FY2018 | Chipotle Mexican Grill, Inc. | Common Stock | United States | 1,383,958 | 597,579,225 | 15.59 |
| FY2018 | Starbucks Corporation | Common Stock | United States | 9,648,467 | 621,361,275 | 16.21 |
| FY2018 | Lowe’s Companies Inc. | Common Stock | United States | 6,938,623 | 640,851,220 | 16.72 |
| FY2018 | Financial Services (מצטבר, ללא שם) | Preferred Stock | United States |  | 53,017,975 | 1.38 |
| FY2018 | Automatic Data Processing, Inc., Common Stock | Investment in Affiliated Entities | United States | 1,391,428 | 182,444,039 | 4.76 |
| FY2018 | Automatic Data Processing, Inc., Equity Call Options Purchased, $55.50 - $108.00, 01/15/2021 | Investment in Affiliated Entities | United States | 3,537,972 | 238,995,861 | 6.23 |
| FY2018 | Other assets and liabilities (מצטבר, ללא שם) | Investment in Affiliated Entities | United States |  | 209,053 | 0.01 |
| FY2018 | Automatic Data Processing, Inc., Call Options, $63.00 - $76.06, 06/23/2020–01/15/2021 | Equity Options Purchased | United States | 862,096 | 57,510,420 | 1.50 |
| FY2018 | Currencies (מצטבר, ללא שם) | Foreign Currency Forward Contracts |  |  | 4,403,525 | 0.12 |
| FY2018 | Financial Services (מצטבר, ללא שם) | Total Return Swap Contracts, long exposure | United States |  | -49,740,661 | -1.30 |
| FY2018 | Real Estate Development and Operating (מצטבר, ללא שם) | Total Return Swap Contracts, long exposure | United States |  | -94,960,677 | -2.48 |
| FY2019 | Restaurant Brands International Inc. | Common Stock | Canada | 12,350,929 | 787,618,742 | 13.77 |
| FY2019 | Restaurant Brands International Limited Partnership | Common Stock | Canada | 140,873 | 8,965,878 | 0.16 |
| FY2019 | Federal National Mortgage Association | Common Stock | United States | 80,982,640 | 252,665,837 | 4.42 |
| FY2019 | Other (מצטבר, ללא שם) | Common Stock | United States |  | 146,673,764 | 2.56 |
| FY2019 | Hilton Worldwide Holdings Inc. | Common Stock | United States | 8,526,771 | 945,704,172 | 16.53 |
| FY2019 | Berkshire Hathaway Inc. | Common Stock | United States | 3,243,410 | 734,632,365 | 12.84 |
| FY2019 | Life Science Tools/Industrials (מצטבר, ללא שם) | Common Stock | United States |  | 116,508,294 | 2.04 |
| FY2019 | Real Estate Development and Operating (מצטבר, ללא שם) | Common Stock | United States |  | 221,782,330 | 3.88 |
| FY2019 | Chipotle Mexican Grill, Inc. | Common Stock | United States | 1,383,958 | 1,158,525,081 | 20.25 |
| FY2019 | Starbucks Corporation | Common Stock | United States | 4,980,208 | 437,859,887 | 7.65 |
| FY2019 | Lowe’s Companies Inc. | Common Stock | United States | 6,956,923 | 833,161,098 | 14.56 |
| FY2019 | Federal National Mortgage Association Series S Preferred 8.25% | Preferred Stock | United States | 2,390,284 | 28,563,894 | 0.50 |
| FY2019 | Federal National Mortgage Association Series T Preferred 8.25% | Preferred Stock | United States | 1,161,061 | 13,154,821 | 0.23 |
| FY2019 | Federal National Mortgage Association Series F Preferred 0% | Preferred Stock | United States | 2,184 | 40,186 | 0.00 |
| FY2019 | Other (מצטבר, ללא שם) | Preferred Stock | United States |  | 48,479,676 | 0.85 |
| FY2019 | Restaurant Brands International Inc. | Equity Forward Contracts, long exposure | Canada | 947,817 | -2,180,511 | -0.04 |
| FY2019 | Life Science Tools/Industrials (מצטבר, ללא שם) | Equity Forward Contracts, long exposure | United States |  | 58,972,116 | 1.03 |
| FY2019 | Real Estate Development and Operating (מצטבר, ללא שם) | Equity Forward Contracts, long exposure | United States |  | 43,027,417 | 0.75 |
| FY2019 | Currencies (מצטבר, ללא שם) | Foreign Currency Forward Contracts |  |  | -5,426,904 | -0.09 |
| FY2019 | Federal National Mortgage Association | Total Return Swap Contracts, long exposure | United States | 20,211,102 | 19,043,034 | 0.33 |
| FY2019 | Other (מצטבר, ללא שם) | Total Return Swap Contracts, long exposure | United States |  | 9,818,236 | 0.17 |
| FY2020 | Restaurant Brands International Inc. | Common Stock | Canada | 21,389,922 | 1,307,138,133 | 14.44 |
| FY2020 | Restaurant Brands International Limited Partnership | Common Stock | Canada | 140,873 | 8,617,944 | 0.10 |
| FY2020 | Financial Services (מצטבר, ללא שם) | Common Stock | United States |  | 346,990,611 | 3.83 |
| FY2020 | Hilton Worldwide Holdings Inc. | Common Stock | United States | 11,407,293 | 1,269,175,419 | 14.02 |
| FY2020 | Agilent Technologies Inc. | Common Stock | United States | 10,455,906 | 1,238,920,302 | 13.69 |
| FY2020 | The Howard Hughes Corporation | Common Stock | United States | 8,632,800 | 681,386,904 | 7.53 |
| FY2020 | Chipotle Mexican Grill, Inc. | Common Stock | United States | 962,452 | 1,334,641,813 | 14.74 |
| FY2020 | Starbucks Corporation | Common Stock | United States | 8,369,971 | 895,419,498 | 9.89 |
| FY2020 | Lowe’s Companies Inc. | Common Stock | United States | 10,592,116 | 1,700,140,539 | 18.78 |
| FY2020 | Financial Services (מצטבר, ללא שם) | Preferred Stock | United States |  | 94,265,224 | 1.04 |
| FY2020 | Pershing Square TH Sponsor, LLC Sponsor Warrants(1) | Investment in Affiliated Entity | United States |  | 216,762,909 | 2.39 |
| FY2020 | Class B Common Stock(1) | Investment in Affiliated Entity | United States |  | 2,523 | 0.00 |
| FY2020 | Currency Put Options, U.S. Dollar Call Options | Currency Call/Put Options Purchased |  |  | 243,466 | 0.00 |
| FY2020 | Financial Services (מצטבר, ללא שם) | Credit Default Swaps, Buy Protection | United States |  | -1,260,780 | -0.01 |
| FY2020 | The Howard Hughes Corporation, Put Options, $75.08 - $91.63, 01/06/2021 - 08/11/2021 | Equity Options Written | United States | 6,925,000 | -47,711,572 | -0.53 |
| FY2020 | Currencies (מצטבר, ללא שם) | Foreign Currency Forwards |  |  | 222,752 | 0.00 |
| FY2020 | Pershing Square Tontine Holdings, Ltd. Committed Forward Purchase Units(2) | Forward Purchase Units | United States |  | 387,563,628 | 4.28 |
| FY2020 | Additional Forward Purchase Units | Forward Purchase Units | United States |  | 148,876,614 | 1.65 |
| FY2020 | Europe (מצטבר, ללא שם) | Index Credit Default Swaps, Buy Protection |  |  | -308,616,726 | -3.41 |
| FY2020 | United States (מצטבר, ללא שם) | Index Credit Default Swaps, Buy Protection |  |  | -216,001,684 | -2.39 |
| FY2020 | Interest Rate Swaptions | Interest Rate Swaptions Purchased |  |  | 61,101,294 | 0.68 |
| FY2020 | Financial Services (מצטבר, ללא שם) | Total Return Swaps, Long Exposure | United States |  | 5,556,245 | 0.06 |
| FY2021 | Restaurant Brands International Inc. | Common Stock | Canada | 21,389,922 | 1,297,940,467 | 11.38 |
| FY2021 | Restaurant Brands International Limited Partnership | Common Stock | Canada | 140,873 | 8,613,082 | 0.08 |
| FY2021 | Transportation (מצטבר, ללא שם) | Common Stock | Canada |  | 100,420,327 | 0.88 |
| FY2021 | Universal Music Group N.V. | Common Stock | Europe | 105,325,592 | 2,971,448,761 | 26.04 |
| FY2021 | Financial Services (מצטבר, ללא שם) | Common Stock | United States |  | 154,117,893 | 1.35 |
| FY2021 | Hilton Worldwide Holdings Inc. | Common Stock | United States | 11,407,293 | 1,779,423,635 | 15.60 |
| FY2021 | The Howard Hughes Corporation | Common Stock | United States | 11,759,646 | 1,196,896,770 | 10.49 |
| FY2021 | Chipotle Mexican Grill, Inc. | Common Stock | United States | 962,452 | 1,682,606,709 | 14.75 |
| FY2021 | Domino's Pizza, Inc. | Common Stock | United States | 1,806,402 | 1,019,406,841 | 8.93 |
| FY2021 | Lowe’s Companies Inc. | Common Stock | United States | 9,056,888 | 2,341,024,410 | 20.52 |
| FY2021 | Financial Services (מצטבר, ללא שם) | Preferred Stock | United States |  | 32,790,958 | 0.29 |
| FY2021 | PS VII Master, L.P. Universal Music Group N.V., Common Stock | Investment in Affiliated Entities | Europe | 9,551,416 | 269,464,835 | 2.36 |
| FY2021 | Foreign Currency Forwards | Investment in Affiliated Entities | Europe |  | 2,523,725 | 0.02 |
| FY2021 | Other Assets and Liabilities (מצטבר, ללא שם) | Investment in Affiliated Entities | Europe |  | 1,056,843 | 0.01 |
| FY2021 | Pershing Square TH Sponsor, LLC Sponsor Warrants(1) | Investment in Affiliated Entities | United States |  | 170,376,263 | 1.49 |
| FY2021 | Class B Common Stock(1) | Investment in Affiliated Entities | United States |  | 1,795 | 0.00 |
| FY2021 | Special Purpose Acquisition Rights Company(2) | Investment in Affiliated Entities | United States |  | 0 | 0.00 |
| FY2021 | Transportation (מצטבר, ללא שם) | Equity Forwards | Canada |  | -12,525,601 | -0.11 |
| FY2021 | Currencies (מצטבר, ללא שם) | Foreign Currency Forwards |  |  | -18,257,121 | -0.16 |
| FY2021 | Pershing Square Tontine Holdings, Ltd. Committed Forward Purchase Units(3) | Forward Purchase Units | United States |  | -5,923,858 | -0.05 |
| FY2021 | Additional Forward Purchase Units | Forward Purchase Units | United States |  | 1,524,055 | 0.01 |
| FY2021 | U.S. 10 Year Treasury Payer Swaption, 1.50%, 07/15/2022 | Interest Rate Swaptions Purchased |  | 3,658,144,000 | 107,888,637 | 0.95 |
| FY2021 | U.S. 2 Year Treasury Payer Swaptions, 0.925% - 1.425%, 07/20/2022 - 08/04/2022 | Interest Rate Swaptions Purchased |  | 88,654,000,000 | 732,212,727 | 6.42 |
| FY2022 | Restaurant Brands International Inc. | Common Stock | Canada | 21,389,922 | 1,383,286,256 | 14.00 |
| FY2022 | Restaurant Brands International Limited Partnership | Common Stock | Canada | 140,873 | 9,058,945 | 0.09 |
| FY2022 | Canadian Pacific Railway Limited | Common Stock | Canada | 13,266,340 | 989,536,301 | 10.02 |
| FY2022 | Universal Music Group N.V. | Common Stock | Europe | 105,325,592 | 2,537,907,507 | 25.69 |
| FY2022 | Financial Services (מצטבר, ללא שם) | Common Stock | United States |  | 66,030,717 | 0.67 |
| FY2022 | Hilton Worldwide Holdings Inc. | Common Stock | United States | 8,846,556 | 1,117,850,816 | 11.31 |
| FY2022 | The Howard Hughes Corporation | Common Stock | United States | 13,881,104 | 1,060,793,968 | 10.74 |
| FY2022 | Chipotle Mexican Grill, Inc. | Common Stock | United States | 962,452 | 1,335,392,525 | 13.52 |
| FY2022 | Lowe’s Companies Inc. | Common Stock | United States | 9,056,888 | 1,804,494,365 | 18.26 |
| FY2022 | Financial Services (מצטבר, ללא שם) | Preferred Stock | United States |  | 23,497,287 | 0.24 |
| FY2022 | PS VII Master, L.P. Universal Music Group N.V., Common Stock | Investment in Affiliated Entities | Europe | 10,405,273 | 250,723,684 | 2.54 |
| FY2022 | Other Assets and Liabilities (מצטבר, ללא שם) | Investment in Affiliated Entities | Europe |  | 211,821 | 0.00 |
| FY2022 | Special Purpose Acquisition Rights Company(1) | Investment in Affiliated Entities | United States |  | 0 | 0.00 |
| FY2022 | Various Currency Call Options, U.S. Dollar Put Options | Currency Call/Put Options Purchased |  |  | 11,323,089 | 0.11 |
| FY2022 | Currencies (מצטבר, ללא שם) | Currency Forwards |  |  | 7,403,795 | 0.07 |
| FY2022 | Energy | Equity Options Purchased | United States |  | 174,892,671 | 1.77 |
| FY2022 | JPY Swaptions | Interest Rate Swaptions Purchased |  |  | 170,367,376 | 1.72 |
| FY2022 | U.S. Swaptions | Interest Rate Swaptions Purchased |  |  | 330,721,975 | 3.35 |
| FY2023 | Restaurant Brands International Inc. | Common Stock | Canada | 20,710,238 | 1,618,090,895 | 13.41 |
| FY2023 | Restaurant Brands International Limited Partnership | Common Stock | Canada | 140,873 | 10,982,364 | 0.09 |
| FY2023 | Canadian Pacific Kansas City Limited | Common Stock | Canada | 13,267,340 | 1,048,915,900 | 8.70 |
| FY2023 | Universal Music Group N.V. | Common Stock | Europe | 105,325,592 | 3,001,036,774 | 24.88 |
| FY2023 | Financial Services (מצטבר, ללא שם) | Common Stock | United States |  | 180,113,835 | 1.49 |
| FY2023 | Hilton Worldwide Holdings Inc. | Common Stock | United States | 8,045,618 | 1,465,026,582 | 12.15 |
| FY2023 | Howard Hughes Holdings Inc. | Common Stock | United States | 16,518,818 | 1,413,184,880 | 11.72 |
| FY2023 | Chipotle Mexican Grill, Inc. | Common Stock | United States | 723,353 | 1,654,279,377 | 13.71 |
| FY2023 | Retail (מצטבר, ללא שם) | Common Stock | United States |  | 242,826,085 | 2.01 |
| FY2023 | Alphabet Inc. - Class A | Common Stock | United States | 2,842,193 | 397,025,940 | 3.29 |
| FY2023 | Alphabet Inc. - Class C | Common Stock | United States | 9,215,887 | 1,298,794,955 | 10.77 |
| FY2023 | Financial Services (מצטבר, ללא שם) | Preferred Stock | United States |  | 33,911,765 | 0.28 |
| FY2023 | PS VII Master, L.P. Universal Music Group N.V., Common Stock | Investment in Affiliated Entities | Europe | 10,621,861 | 302,648,149 | 2.51 |
| FY2023 | Currency Forwards | Investment in Affiliated Entities | Europe |  | -904,038 | -0.01 |
| FY2023 | Other Assets and Liabilities (מצטבר, ללא שם) | Investment in Affiliated Entities | Europe |  | 97,801 | 0.00 |
| FY2023 | Pershing Square SPARC Sponsor, LLC | Investment in Affiliated Entities | United States |  | 35,372,728 | 0.29 |
| FY2023 | Currencies (מצטבר, ללא שם) | Currency Forwards |  |  | -31,975,102 | -0.27 |
| FY2023 | Energy | Equity Options Purchased | United States |  | 57,510,370 | 0.48 |
| FY2023 | SPARC Committed FPA | Forward Purchase Agreement |  |  | 0 | 0.00 |
| FY2023 | U.S. Swaptions | Interest Rate Swaptions Purchased |  |  | 217,333,840 | 1.80 |
| FY2024 | Brookfield Corporation | Common Stock | Canada | 31,274,179 | 1,796,701,584 | 13.81 |
| FY2024 | Restaurant Brands International Inc. | Common Stock | Canada | 20,710,238 | 1,349,893,313 | 10.37 |
| FY2024 | Restaurant Brands International Limited Partnership | Common Stock | Canada | 140,873 | 9,137,708 | 0.07 |
| FY2024 | Canadian Pacific Kansas City Limited | Common Stock | Canada | 13,267,340 | 960,157,396 | 7.38 |
| FY2024 | Universal Music Group N.V. | Common Stock | Europe | 117,450,307 | 3,007,457,461 | 23.11 |
| FY2024 | Nike, Inc. | Common Stock | United States | 16,953,888 | 1,282,900,705 | 9.86 |
| FY2024 | Financial Services (מצטבר, ללא שם) | Common Stock | United States |  | 611,625,030 | 4.70 |
| FY2024 | Hilton Worldwide Holdings Inc. | Common Stock | United States | 4,847,110 | 1,198,011,708 | 9.21 |
| FY2024 | Leisure & Hospitality (מצטבר, ללא שם) = SEG (נגזר) | Common Stock | United States |  | 123,036,207 | 0.95 |
| FY2024 | Howard Hughes Holdings Inc. | Common Stock | United States | 16,518,818 | 1,270,627,481 | 9.77 |
| FY2024 | Chipotle Mexican Grill, Inc. | Common Stock | United States | 21,996,590 | 1,326,394,376 | 10.19 |
| FY2024 | Alphabet Inc. - Class A | Common Stock | United States | 2,798,051 | 529,671,054 | 4.07 |
| FY2024 | Alphabet Inc. - Class C | Common Stock | United States | 7,547,582 | 1,437,361,516 | 11.05 |
| FY2024 | Transportation (מצטבר, ללא שם) | Common Stock | United States |  | 41,716,900 | 0.32 |
| FY2024 | Financial Services (מצטבר, ללא שם) | Preferred Stock | United States |  | 132,373,682 | 1.02 |
| FY2024 | Pershing Square SPARC Sponsor, LLC | Investment in Affiliated Entity | United States |  | 37,540,131 | 0.29 |
| FY2024 | Currencies (מצטבר, ללא שם) | Currency Forwards |  |  | 51,380,344 | 0.39 |
| FY2024 | SPARC Committed FPA | Forward Purchase Agreement |  |  | 0 | 0.00 |
| FY2025 | Brookfield Corporation | Common Stock | Canada | 54,984,738 | 2,523,249,627 | 16.77 |
| FY2025 | Restaurant Brands International Inc. | Common Stock | Canada | 20,710,238 | 1,413,059,539 | 9.39 |
| FY2025 | Restaurant Brands International Limited Partnership | Common Stock | Canada | 140,873 | 9,648,808 | 0.06 |
| FY2025 | Universal Music Group N.V. | Common Stock | Netherlands | 74,120,204 | 1,936,367,797 | 12.87 |
| FY2025 | Uber Technologies, Inc. | Common Stock | United States | 27,127,458 | 2,216,584,593 | 14.73 |
| FY2025 | Other (מצטבר, ללא שם) | Common Stock | United States |  | 70,189,342 | 0.47 |
| FY2025 | Federal Home Loan Mortgage Corporation | Common Stock | United States | 90,166,769 | 914,291,038 | 6.08 |
| FY2025 | Federal National Mortgage Association | Common Stock | United States | 96,702,880 | 1,037,621,902 | 6.89 |
| FY2025 | Hilton Worldwide Holdings Inc. | Common Stock | United States | 2,751,081 | 790,248,017 | 5.25 |
| FY2025 | Leisure & Hospitality (מצטבר, ללא שם) = SEG (נגזר) | Common Stock | United States |  | 87,027,757 | 0.58 |
| FY2025 | Howard Hughes Holdings Inc. | Common Stock | United States | 16,518,818 | 1,317,706,112 | 8.76 |
| FY2025 | Alphabet Inc. - Class C | Common Stock | United States | 6,163,871 | 1,934,222,720 | 12.85 |
| FY2025 | Amazon.com, Inc. | Common Stock | United States | 8,661,904 | 1,999,340,681 | 13.29 |
| FY2025 | Meta Platforms, Inc. | Common Stock | United States | 2,409,391 | 1,590,414,905 | 10.57 |
| FY2025 | Federal Home Loan Mortgage Corporation Series B Preferred 0% | Preferred Stock | United States | 273,499 | 5,141,781 | 0.03 |
| FY2025 | Federal Home Loan Mortgage Corporation Series F Preferred 5% | Preferred Stock | United States | 3,167 | 71,226 | 0.00 |
| FY2025 | Federal Home Loan Mortgage Corporation Series M Preferred 0% | Preferred Stock | United States | 4,325 | 82,175 | 0.00 |
| FY2025 | Federal Home Loan Mortgage Corporation Series P Preferred 6% | Preferred Stock | United States | 11,481 | 276,922 | 0.00 |
| FY2025 | Federal Home Loan Mortgage Corporation Series Q Preferred 0% | Preferred Stock | United States | 364,253 | 7,066,508 | 0.05 |
| FY2025 | Federal Home Loan Mortgage Corporation Series W Preferred 5.66% | Preferred Stock | United States | 641,340 | 8,786,358 | 0.06 |
| FY2025 | Federal Home Loan Mortgage Corporation Series X Preferred 6.02% | Preferred Stock | United States | 24,812 | 317,594 | 0.00 |
| FY2025 | Federal Home Loan Mortgage Corporation Series Z Preferred 8.375% | Preferred Stock | United States | 3,683,188 | 53,037,907 | 0.35 |
| FY2025 | Federal National Mortgage Association Series F Preferred 0% | Preferred Stock | United States | 2,184 | 50,865 | 0.00 |
| FY2025 | Federal National Mortgage Association Series P Preferred Floating | Preferred Stock | United States | 240,600 | 3,130,206 | 0.02 |
| FY2025 | Federal National Mortgage Association Series Q Preferred 6.75% | Preferred Stock | United States | 716,918 | 9,499,164 | 0.06 |
| FY2025 | Federal National Mortgage Association Series S Preferred 8.25% | Preferred Stock | United States | 747,357 | 11,382,247 | 0.08 |
| FY2025 | Federal National Mortgage Association Series T Preferred 8.25% | Preferred Stock | United States | 844,244 | 11,777,204 | 0.08 |
| FY2025 | Pershing Square SPARC Sponsor, LLC | Investment in Affiliated Entity | United States |  | 38,876,792 | 0.26 |
| FY2025 | SPARC Committed FPA | Forward Purchase Agreement |  |  | 0 | 0.00 |
| FY2025 | Consumer Services (מצטבר, ללא שם) | Total Return Swaps | United States |  | 39,960,965 | 0.27 |
| FY2025 | Consumer Services (מצטבר, ללא שם) | Total Return Swaps | United States |  | -34,093,323 | -0.23 |

## 4. הדוחות הכספיים, שורה אחר שורה (24 תקופות)

**הערות לכל הטבלאות:**
- הסכומים בדולרים, כפי שהודפסו. הוצאה מופיעה בשלילי.
- תא ריק פירושו שהשורה לא קיימת בדוח של אותה תקופה. 0 פירושו שהדוח הדפיס "–" או 0.
- תקופה "H1_YYYY" מכסה ששה חודשים. FY2014 מכסה שנה שלמה, אבל הרווח "לבעלי ההון" בה הוא רק של 01/10–31/12/2014 (סעיף 4.3).
- כל הערכים, כולל העמוד ב־PDF של כל שורה, נמצאים ב־`financials_by_period.json`: ‏`periods.<תקופה>.statements.{sofp,soci,cf}.items` והשורות הגולמיות ב־`raw_rows`.

### 4.1 דוח רווח והפסד: הכנסות ורווח

| תקופה | הכנסות דיבידנד | הכנסות ריבית | רווח נטו FVTPL | הפרשי שער על האג״ח | רווח לבעלי ההון | EPS |
|---|---|---|---|---|---|---|
| FY2014 | 20,346,366 | 45,448 | 1,404,078,369 |  | 329,773,983 | 5.49 |
| H1_2015 | 17,314,215 | 71,400 | 313,225,056 |  | 204,892,075 | 0.85 |
| FY2015 | 43,129,139 | 179,462 | -1,210,007,639 |  | -1,300,005,639 |  |
| H1_2016 | 26,367,140 | 401,777 | -975,372,033 |  | -1,061,565,297 | -4.42 |
| FY2016 | 49,703,578 | 624,621 | -494,233,038 |  | -677,506,606 |  |
| H1_2017 | 26,720,018 | 491,147 | -41,014,177 |  | -100,484,505 | -0.42 |
| FY2017 | 59,962,586 | 1,140,593 | -35,276,471 |  | -192,617,895 | -0.81 |
| H1_2018 | 43,287,822 | 2,245,271 | 195,147,441 |  | 164,461,016 | 0.72 |
| FY2018 | 88,997,501 | 5,170,005 | -67,248,943 |  | -91,508,067 | -0.43 |
| H1_2019 | 41,669,235 | 2,220,515 | 1,760,281,806 |  | 1,693,351,562 | 7.82 |
| FY2019 | 84,148,405 | 3,033,126 | 2,274,474,001 |  | 2,097,641,304 | 9.78 |
| H1_2020 | 40,615,855 | 893,875 | -354,324,806 |  | 1,447,103,794 | 7.20 |
| FY2020 | 84,418,343 | 1,062,148 | 2,512,130,911 |  | 3,571,835,955 | 18.12 |
| H1_2021 | 45,908,527 | 61,584 | 760,705,653 |  | 657,653,563 | 3.30 |
| FY2021 | 114,730,177 | 117,359 | 2,553,059,056 | 10,633,330 | 2,436,309,642 | 12.23 |
| H1_2022 | 71,506,732 | 1,222,051 | -4,112,302,497 | 45,110,821 | -2,982,201,388 | -14.99 |
| FY2022 | 159,239,648 | 10,281,154 | -2,636,834,379 | 34,372,153 | -1,172,083,602 | -5.96 |
| H1_2023 | 91,177,188 | 9,753,922 | 1,444,194,629 | -10,356,339 | 952,793,421 | 5.01 |
| FY2023 | 183,123,339 | 19,710,258 | 3,026,677,414 | -16,482,623 | 2,486,054,201 | 13.17 |
| H1_2024 | 74,430,858 | 51,649,001 | 966,303,106 | 16,476,227 | 650,333,398 | 3.53 |
| FY2024 | 152,930,011 | 85,936,817 | 1,676,375,513 | 33,706,191 | 1,173,695,918 | 6.38 |
| H1_2025 | 62,429,011 | 14,283,142 | 2,435,600,016 | -96,990,518 | 1,917,635,458 | 10.60 |
| FY2025 | 121,175,185 | 45,604,029 | 3,307,266,164 | -93,964,036 | 2,525,375,901 | 14.08 |
| H1_2026 | 69,364,962 | 20,682,721 | -1,866,298,984 | 37,519,198 | -1,928,599,294 | -11.00 |

**הסבר העמודות:**
- **"רווח נטו FVTPL"**: השורה "Net gain/(loss) on financial assets and liabilities at fair value through profit or loss". היא כוללת ניירות ערך ואת רוב הנגזרים.
- **"הפרשי שער על האג״ח"**: ‏"Net gain/(loss) on currency translation of the Bonds". קיימת מ־FY2021, אחרי הנפקת האג״ח באירו.
- **"רווח לבעלי ההון"**: ‏"Profit/(loss) attributable to equity shareholders". עד 2020 מנוכה ממנו החלק של ה־Management Shares.
- **EPS**: למניה ציבורית.
  - FY2014: ‏5.49 לפי IFRS, עם שקלול זמן של 92/365. ה־EPS המתואם לרבעון 4 הוא 1.37.
  - FY2015 ו־FY2016 הודפסו בתוך שם השורה: ‏‎−5.41‎ ו־‎−2.82‎.

### 4.1א שורות ה־"commodity interests": שם נמצאים הגידורים

**מה יש בשורות:** בין שורת ה־FVTPL לבין ההכנסות יש בכל דוח שתי שורות נוספות:
- ‏"Net realized gain/(loss) on commodity interests";
- ‏"Net change in unrealized gain/(loss) on commodity interests".

הדוח מוסיף את שלושתן לסכום ביניים.

| תקופה | רווח FVTPL (ני"ע ונגזרים אחרים) | commodity interests — ממומש | commodity interests — לא ממומש | סה"כ (סכום ביניים בדוח) | בדיקה |
|---|---|---|---|---|---|
| FY2014 | 1,404,078,369 | -5,483,254 | -1,518,012 | 1,397,077,103 | תקין |
| H1_2015 | 313,225,056 | -1,062,782 | -1,747,612 | 310,414,662 | תקין |
| FY2015 | -1,210,007,639 | -12,907,441 | 5,515,589 | -1,217,399,491 | תקין |
| H1_2016 | -975,372,033 | -43,520,906 | -25,880,864 | -1,044,773,803 | תקין |
| FY2016 | -494,233,038 | -71,064,508 | -2,682,541 | -567,980,087 | תקין |
| H1_2017 | -41,014,177 | -12,717,493 | 419,293 | -53,312,377 | תקין |
| FY2017 | -35,276,471 | -14,319,885 | 1,270,848 | -48,325,508 | תקין |
| H1_2018 | 195,147,441 | -877,163 | 1,007,068 | 195,277,346 | תקין |
| FY2018 | -67,248,943 | -515,098 | 746,255 | -67,017,786 | תקין |
| H1_2019 | 1,760,281,806 | 0 | -1,012,310 | 1,759,269,496 | תקין |
| FY2019 | 2,274,474,001 | -1,732,785 | 0 | 2,272,741,216 | תקין |
| H1_2020 | -354,324,806 | 2,116,721,376 | 69,218,341 | 1,831,614,911 | תקין |
| FY2020 | 2,512,130,911 | 2,057,091,477 | -8,908,581 | 4,560,313,807 | תקין |
| H1_2021 | 760,705,653 | -109,129,995 | 273,603,218 | 925,178,876 | תקין |
| FY2021 | 2,553,059,056 | -109,129,995 | 692,360,520 | 3,136,289,581 | תקין |
| H1_2022 | -4,112,302,497 | 1,074,207,959 | 22,205,689 | -3,015,888,849 | תקין |
| FY2022 | -2,636,834,379 | 1,989,068,723 | -490,763,327 | -1,138,528,983 | תקין |
| H1_2023 | 1,444,194,629 | -177,559,948 | -244,583,790 | 1,022,050,891 | תקין |
| FY2023 | 3,026,677,414 | -24,866,851 | -63,136,160 | 2,938,674,403 | תקין |
| H1_2024 | 966,303,106 | -107,031,372 | -129,552,453 | 729,719,281 | תקין |
| FY2024 | 1,676,375,513 | -124,865,760 | -129,552,453 | 1,421,957,300 | תקין |
| H1_2025 | 2,435,600,016 | 0 | 0 | 2,435,600,016 | תקין |
| FY2025 | 3,307,266,164 | 0 | 0 | 3,307,266,164 | תקין |
| H1_2026 | -1,866,298,984 | -23,089,988 | 0 | -1,889,388,972 | תקין |

**[נגזר] מה נמצא בשורות האלה:** ביאור הנגזרים מפרק את הרווח לפי סוג מכשיר. הסכום בשורות ה־commodity interests שווה, בדיוק או בהפרש של דולר אחד מעיגול, לסכום הסוגים האלה:
- אופציות מט״ח;
- אופציות ריבית וסוופציונים;
- CDS על מדדים ואופציות עליהם;
- אופציות סחורות.

לעומת זאת, TRS, אופציות על מניות, פורוורדים, פורוורדי מט״ח, ‏FPU ו־CDS על מנפיק בודד נמצאים בשורת ה־FVTPL.

| שנה | commodity interests נטו | הרכיבים מביאור הנגזרים | סכום הרכיבים |
|---|---|---|---|
| 2014 | ‎−7,001,266‎ | אופציות מט״ח ‎−6,959,589‎; אופציות ריבית ‎−41,677‎ | ‎−7,001,266‎ |
| 2015 | ‎−7,391,852‎ | אופציות מט״ח ‎−5,423,008‎; אופציות על CDS מדדים ‎−1,984,186‎; ‏CDS מדדים ‎+15,341‎ | ‎−7,391,853‎ |
| 2016 | ‎−73,747,049‎ | אופציות מט״ח ‎−73,747,050‎ | ‎−73,747,050‎ |
| 2017 | ‎−13,049,037‎ | אופציות מט״ח ‎−13,049,037‎ | ‎−13,049,037‎ |
| 2018 | ‎+231,157‎ | אופציות מט״ח ‎+231,157‎ | ‎+231,157‎ |
| 2019 | ‎−1,732,785‎ | אופציות מט״ח ‎−1,732,784‎ | ‎−1,732,784‎ |
| 2020 | ‎+2,048,182,896‎ | ‏**CDS מדדים ‎+2,057,013,956‎** (גידור הקורונה); סוופציונים ‎−2,733,319‎; אופציות מט״ח ‎−6,097,741‎ | ‎+2,048,182,896‎ |
| 2021 | ‎+583,230,525‎ | סוופציונים ‎+686,185,259‎; ‏CDS מדדים ‎−102,711,268‎; אופציות מט״ח ‎−243,466‎ | ‎+583,230,525‎ |
| 2022 | ‎+1,498,305,396‎ | סוופציונים ‎+1,609,422,440‎; אופציות מט״ח ‎−89,346,695‎; אופציות סחורות ‎−21,770,349‎ | ‎+1,498,305,396‎ |
| 2023 | ‎−88,003,011‎ | סוופציונים ‎−58,729,625‎; אופציות מט״ח ‎−10,655,624‎; אופציות סחורות ‎−18,617,762‎ | ‎−88,003,011‎ |
| 2024 | ‎−254,418,213‎ | סוופציונים ‎−232,163,734‎; אופציות סחורות ‎−22,254,479‎ | ‎−254,418,213‎ |
| 2025 | 0 | — | — |
| H1 2026 | ‎−23,089,988‎ (ממומש) | לא פורק בדוח החציוני | — |

**המשמעות לשחזור:** הגידורים המאקרו של פרשינג לא מופיעים ב־13F, אבל לפעמים הם חלק גדול מהתשואה:
- ב־2020: ‏+2.06 מיליארד מ־CDS, מול רווח נקי של 3.57 מיליארד.
- ב־2022: ‏+1.5 מיליארד מסוופציונים.

**הסוופציונים והחוזים העתידיים מופיעים בשמם ב־CSOI:**

| שנה | נכס | שווי | % / נומינלי |
|---|---|---|---|
| FY2020 | ‏Interest Rate Swaptions | 61.1m | — |
| FY2021 | ‏Swaptions | 840.1m | — |
| FY2022 | ‏U.S. Swaptions + JPY Swaptions | 501.1m | — |
| FY2023 | ‏U.S. Swaptions | 217.3m | נומינלי 12,746,618,000 |
| FY2020 | ‏Index CDS (התחייבות) | ‎−524.6m‎ | — |
| FY2020 | ‏Forward Purchase Units של PSTH | 387.6m ועוד 148.9m | — |

### 4.2 דוח רווח והפסד: הוצאות ומסים

| תקופה | דמי ניהול | עמלת ביצוע | מקצועי | אחר | הוצאות ריבית | ניכוי במקור | מס נדחה |
|---|---|---|---|---|---|---|---|
| FY2014 | -52,019,094 | -206,545,813 | -20,944,610 | -2,087,341 | -5,845,829 | -5,728,408 |  |
| H1_2015 | -48,490,289 | -39,027,062 | -12,783,737 | -750,803 | -7,348,666 | -4,035,936 |  |
| FY2015 | -93,921,719 | 0 | -17,750,846 | -1,327,984 | -45,346,032 | -11,425,924 |  |
| H1_2016 | -32,918,265 | 0 | -6,325,700 | -489,472 | -34,033,199 | -7,292,282 |  |
| FY2016 | -63,143,490 |  | -10,661,364 | -1,107,012 | -64,812,601 | -13,256,001 |  |
| H1_2017 | -32,214,384 |  | -6,939,704 | -1,185,334 | -31,917,276 | -4,706,591 |  |
| FY2017 | -63,211,761 |  | -11,963,798 | -3,394,472 | -64,667,520 | -9,812,956 |  |
| H1_2018 | -26,790,210 |  | -3,396,214 | -807,187 | -30,185,704 | -6,833,852 |  |
| FY2018 | -52,391,923 |  | -6,452,737 | -1,551,689 | -60,285,416 | -15,625,914 |  |
| H1_2019 | -27,123,295 |  | -3,465,840 | -678,065 | -29,014,658 | -9,824,753 |  |
| FY2019 | -64,422,781 | -38,979,640 | -7,314,830 | -1,526,381 | -66,384,642 | -18,714,011 | -13,508,846 |
| H1_2020 | -39,498,506 | -290,250,644 | -5,149,393 | -1,144,345 | -39,350,285 | -9,855,080 | 9,973,714 |
| FY2020 | -95,794,204 | -695,694,558 | -9,186,732 | -2,028,302 | -83,482,818 | -21,794,811 | -38,938,005 |
| H1_2021 | -70,727,369 | -125,267,348 | -3,935,000 | -1,158,872 | -51,407,169 | -12,569,884 | -48,429,782 |
| FY2021 | -146,070,348 | -464,058,982 | -8,130,098 | -2,348,782 | -105,493,134 | -28,138,375 | -59,098,133 |
| H1_2022 | -84,640,227 | 0 | -3,621,219 | -1,348,718 | -56,291,283 | -15,734,044 | 77,446,189 |
| FY2022 | -148,482,762 | 0 | -9,247,770 | -2,939,617 | -103,420,537 | -32,721,100 | 59,327,053 |
| H1_2023 | -75,070,165 | -7,763,569 | -5,865,506 | -954,931 | -45,901,253 | -17,716,148 | -6,560,669 |
| FY2023 | -155,469,061 | -312,108,882 | -13,200,099 | -2,455,467 | -89,892,677 | -33,235,985 | -32,609,005 |
| H1_2024 | -93,302,970 | -125,012,534 | -5,532,241 | -1,043,734 | -39,542,774 | -14,505,248 | 56,997,532 |
| FY2024 | -188,818,228 | -226,588,185 | -10,056,040 | -3,031,876 | -77,292,603 | -32,025,140 | 16,941,739 |
| H1_2025 | -95,092,821 | -369,134,126 | -3,724,746 | -1,192,504 | -44,928,001 | -13,399,623 | 29,785,628 |
| FY2025 | -207,995,255 | -489,198,531 | -9,120,678 | -2,437,116 | -112,813,503 | -26,247,858 | -6,892,500 |
| H1_2026 | -99,927,410 | 0 | -5,366,835 | -1,349,396 | -69,316,658 | -15,438,852 | 24,621,948 |

**הסבר העמודות:**
- **"עמלת ביצוע"**: עד H1 2016 נקראה השורה "Incentive fees", ומ־FY2019 "Performance fees". בשנים 2016–2018 אין שורה, כי לא נגבתה עמלה. FY2022 ו־H1 2026: ‏0.
- **"מס נדחה"**: מספר חיובי הוא החזר (הקטנת ההתחייבות). פירוט בסעיף 6.

**שורות נוספות שמופיעות רק בחלק מהשנים:**

| שורה | תקופה | סכום ($) | מה זה |
|---|---|---|---|
| Dividend expense | FY2014 | ‎−844,628‎ | דיבידנד ששולם על מניות בשורט ("securities sold not yet purchased") |
| Legal reserve | FY2016 | ‎−29,176,480‎ | הפרשה לתביעה הייצוגית של Allergan. ההפרשה הכוללת, 75 מיליון, חולקה בין PSH לשלוש קרנות הליבה לפי NAV |
| Legal reserve | FY2017 | ‎−57,219,862‎ | חלק PSH בתוספת של 118.75 מיליון. ההסדר: 290 מיליון בסך הכל, מהם 193.75 מיליון על צד פרשינג. סך ההתחייבות של PSH: ‏86,396,342 |
| Bond extinguishment expense | FY2021 | ‎−12,122,953‎ | פדיון מוקדם, בהצעת רכש, של 369,377,000 מאג״ח 2022 (22/09/2021). בגלגול ה־NAV: ‏‎−0.06‎ למניה |
| Other income | FY2016–FY2024 | 5,693–71,186 לשנה | זניח |

### 4.3 חלוקת הרווח בין סוגי המניות (2014–2020)

**FY2014, שנת ההנפקה:**
- רווח לבעלי מניות פרטיות ומניות VoteCo, עד 30/09/2014 ‏("non-equity shareholders"): ‏754,637,680.
- רווח לבעלי Management Shares: ‏39,041,531.
- רווח לבעלי ההון, כלומר המניות הציבוריות ומניות Class B, מ־01/10/2014: ‏329,773,983.
- **[נגזר]** סכום שלושתם: 1,123,453,194 = רווח השנה כולה.

**2015–2020:** חלק ה־Management Shares, שלא שילמו דמי ניהול ועמלת ביצוע:

| שנה | סכום ($) |
|---|---|
| FY2015 | ‎−43,857,756‎ |
| FY2016 | ‎−22,231,044‎ |
| FY2017 | ‎−4,869,110‎ |
| FY2018 | ‎−17,628,856‎ |
| FY2019 | 51,430,312 |
| FY2020 | 127,038,913 |

ב־31/12/2020 כל ה־Management Shares הומרו למניות ציבוריות, ומ־2021 אין יותר חלוקה.

**Special Voting Share:**
- מניה אחת, שמחזיקה PS Holdings Independent Voting Company.
- מקבלת EPS משלה, למשל 88,762.34 דולר ב־FY2025.
- הסכום זניח ביחס ל־NAV.

### 4.4 המאזן

| תקופה | סך נכסים | השקעות בני"ע | נגזרים נכס | נגזרים התחייבות | מזומנים | אג״ח (ספרים) | מס נדחה לשלם | סך הון |
|---|---|---|---|---|---|---|---|---|
| FY2014 | 7,166,459,982 | 5,791,187,783 | 289,114,933 | 27,139,624 | 565,809,913 |  |  | 6,333,146,807 |
| H1_2015 | 8,152,705,163 | 5,534,157,215 | 242,800,032 | 21,272,358 | 1,752,264,874 | 986,611,653 |  | 6,538,038,882 |
| FY2015 | 6,879,303,733 | 5,356,209,177 | 499,385,851 | 125,974,203 | 420,414,449 | 1,014,688,599 |  | 5,033,141,168 |
| H1_2016 | 5,840,547,348 | 2,850,646,549 | 886,520,852 | 184,558,677 | 1,482,995,358 | 1,012,630,757 |  | 3,971,575,871 |
| FY2016 | 6,289,682,095 | 2,636,767,173 | 1,022,162,881 | 190,734,223 | 2,076,161,696 | 1,013,552,905 |  | 4,355,634,562 |
| H1_2017 | 6,441,681,977 | 3,003,754,988 | 974,085,207 | 21,157,838 | 1,695,924,045 | 1,014,441,181 |  | 4,238,801,853 |
| FY2017 | 5,696,490,710 | 3,140,815,503 | 744,454,840 | 6,192,314 | 1,082,102,874 | 1,015,427,736 |  | 4,086,686,175 |
| H1_2018 | 5,454,984,628 | 3,720,080,794 | 436,986,198 | 31,331,235 | 1,122,177,458 | 1,016,369,873 |  | 3,731,435,079 |
| FY2018 | 5,106,617,446 | 4,475,040,071 | 61,913,945 | 144,701,338 | 201,246,176 | 1,017,411,979 |  | 3,746,911,440 |
| H1_2019 | 6,664,911,692 | 5,767,407,179 | 132,508,982 | 5,124,287 | 619,598,064 | 1,018,411,121 |  | 5,388,690,567 |
| FY2019 | 7,210,142,961 | 5,734,336,025 | 130,860,803 | 7,607,415 | 1,222,846,586 | 1,422,883,554 | 13,508,846 | 5,568,280,913 |
| H1_2020 | 8,912,182,755 | 6,811,196,777 | 28,576,556 | 229,797,235 | 1,411,188,401 | 1,424,660,408 | 3,535,132 | 6,754,296,104 |
| FY2020 | 12,541,207,173 | 9,093,461,819 | 603,563,999 | 573,590,762 | 1,879,639,109 | 2,122,787,844 | 52,446,850 | 9,052,536,502 |
| H1_2021 | 12,412,136,793 | 9,906,009,098 | 708,621,915 | 0 | 1,786,427,253 | 2,124,504,084 | 100,876,632 | 9,670,364,617 |
| FY2021 | 15,808,369,764 | 13,028,113,314 | 843,764,884 | 38,846,045 | 1,767,776,549 | 3,009,416,881 | 111,544,983 | 11,409,195,248 |
| H1_2022 | 11,856,443,825 | 8,940,998,750 | 1,045,971,430 | 45,003,970 | 1,175,411,398 | 2,323,484,241 | 34,098,794 | 8,328,157,757 |
| FY2022 | 12,951,814,811 | 10,578,784,192 | 704,954,822 | 10,245,916 | 1,147,443,227 | 2,332,567,827 | 52,217,931 | 9,879,933,721 |
| H1_2023 | 13,336,806,728 | 12,236,501,224 | 200,906,123 | 11,027,283 | 450,179,827 | 2,347,806,897 | 58,778,599 | 10,727,598,425 |
| FY2023 | 15,128,600,308 | 12,701,403,992 | 274,844,210 | 31,975,102 | 1,928,920,630 | 2,351,915,264 | 84,826,934 | 12,062,607,027 |
| H1_2024 | 15,340,210,427 | 12,893,425,372 | 3,020,891 | 230,945,185 | 1,843,556,023 | 2,340,422,464 | 27,829,403 | 12,592,335,256 |
| FY2024 | 15,632,386,337 | 15,114,606,252 | 51,380,344 | 0 | 436,520,113 | 2,320,801,301 | 67,885,195 | 13,011,230,090 |
| H1_2025 | 18,701,878,265 | 16,538,431,985 | 631,189,726 |  | 1,403,502,468 | 3,159,222,273 | 38,099,568 | 14,714,588,587 |
| FY2025 | 19,361,495,613 | 17,989,469,787 | 39,960,965 | 34,093,323 | 1,141,502,364 | 3,669,110,397 | 74,777,696 | 15,049,406,887 |
| H1_2026 | 16,715,030,046 | 16,363,033,379 | 0 | 94,627,506 | 201,265,840 | 3,621,505,775 | 50,155,747 | 12,935,906,153 |

| תקופה | NAV מניות ציבוריות | מניות ציבוריות | NAV למניה | מניות אוצר | אוצר ($) | ממוצע משוקלל |
|---|---|---|---|---|---|---|
| FY2014 | 6,332,978,890 | 240,128,546 | 26.37 |  |  | 60,032,137 |
| H1_2015 | 6,537,865,532 | 240,128,546 | 27.23 |  |  |  |
| FY2015 | 5,033,007,719 | 240,128,546 | 20.96 |  |  | 240,128,546 |
| H1_2016 | 3,971,470,570 | 240,128,546 | 16.54 |  |  |  |
| FY2016 | 4,355,519,077 | 240,128,546 | 18.14 |  |  | 240,128,546 |
| H1_2017 | 4,238,689,052 | 239,086,229 | 17.73 |  |  | 239,947,210 |
| FY2017 | 4,086,575,831 | 234,716,810 | 17.41 |  |  | 238,676,380 |
| H1_2018 | 3,731,316,780 | 200,822,397 | 18.58 |  |  | 228,307,055 |
| FY2018 | 3,746,801,313 | 216,616,094 | 17.30 |  |  | 214,849,143 |
| H1_2019 | 5,388,531,881 | 216,197,854 | 24.92 |  |  | 216,612,759 |
| FY2019 | 5,568,109,388 | 206,677,784 | 26.94 | 4,278,966 | -80,153,606 | 214,402,994 |
| H1_2020 | 6,754,076,471 | 195,655,196 | 34.52 | 15,301,554 | -301,117,379 | 200,969,905 |
| FY2020 | 9,052,247,442 | 199,120,882 | 45.46 | 11,835,868 | -242,956,239 | 197,168,930 |
| H1_2021 | 9,670,055,829 | 199,120,882 | 48.56 | 11,835,868 | -242,956,239 | 199,120,882 |
| FY2021 | 11,408,830,936 | 199,120,882 | 57.30 | 11,835,868 | -242,956,239 | 199,120,882 |
| H1_2022 | 8,327,889,466 | 197,367,682 | 42.19 | 13,589,068 | -297,015,623 | 198,904,323 |
| FY2022 | 9,879,604,584 | 190,858,442 | 51.76 | 20,098,308 | -506,863,152 | 196,513,766 |
| H1_2023 | 10,727,238,027 | 189,257,179 | 56.68 | 21,699,571 | -562,273,922 | 190,120,424 |
| FY2023 | 12,062,193,559 | 185,461,146 | 65.04 | 25,495,604 | -711,462,770 | 188,818,790 |
| H1_2024 | 12,591,900,215 | 184,002,368 | 68.43 | 26,954,382 | -778,484,599 | 184,145,169 |
| FY2024 | 13,010,778,044 | 182,956,010 | 71.11 | 28,000,740 | -829,368,943 | 184,022,638 |
| H1_2025 | 14,714,068,801 | 179,929,593 | 81.78 | 31,027,157 | -984,109,903 | 180,876,432 |
| FY2025 | 15,048,864,858 | 176,382,491 | 85.32 | 34,574,259 | -1,198,448,246 |  |
| H1_2026 | 12,935,434,571 | 174,262,536 | 74.23 | 36,694,214 | -1,318,893,218 | 175,308,070 |

**הערות למאזן:**
- **"השקעות בני״ע"** ("Investments in securities, at fair value") כוללות מניות, מניות בכורה ורכבים מסונפים.
- **"אג״ח (ספרים)"**: עלות מופחתת. השווי ההוגן בסעיף 8.
- **NAV של המניות הציבוריות**: סך ההון פחות ה־NAV של Class B ‏(2014–2016) ושל ה־Special Voting Share.
  - דוגמה: FY2014: ‏6,333,146,807 − 6,332,978,890 = 167,917, וזה ה־NAV של 5,000,000,000 מניות Class B. [נגזר]
- **"מניות אוצר"**: קיימות מ־24/10/2019. לפני כן מניות שנרכשו בחזרה בוטלו.
- **"ממוצע משוקלל"**: משמש לחישוב ה־EPS. ב־FY2025 לא חולץ.
- **[נגזר]** NAV למניה = NAV המניות הציבוריות / מספר המניות הציבוריות. התוצאה מתאימה לעיגול המודפס בכל 24 התקופות. לדוגמה, ‏FY2025: ‏15,048,864,858 / 176,382,491 = 85.3195, והודפס 85.32.

**הון חוזר בסוף 2025 (מאומת):**

| סעיף | 2025 | 2024 |
|---|---|---|
| חייבים: דיבידנדים | 9,717,602 | 15,152,991 |
| חייבים: ריבית | 2,884,642 | 1,772,235 |
| חייבים: הוצאות מראש | 1,632,393 | 1,265,661 |
| חייבים: חוב של PS VII | — | 10,581,212 |
| **סך חייבים** | 14,234,637 | 28,772,099 |
| זכאים: עמלת ביצוע | 486,622,392 | 225,356,173 |
| זכאים: סליקת רכישות חוזרות | 2,363,439 | 4,409,741 |
| זכאים: אחר | 1,181,804 | 2,666,827 |
| זכאים: ריבית | 139,675 | 37,010 |
| **סך זכאים** | 490,307,310 | 232,469,751 |

**שווי מזומנים** (קרנות כספיות ואג״ח ממשלתיות קצרות):

| סעיף | 2025 | 2024 |
|---|---|---|
| סה״כ | 1,141,502,364 | 436,520,113 |
| קרנות כספיות | 1,104,637,085 | — |
| ‏T-bills | 36,865,279 | — |
| Goldman Sachs Financial Square Treasury Instruments Fund | 687,011,385 | 377,786,506 |
| BlackRock Liquidity Treasury Trust Fund | 417,625,700 | 58,733,607 |

### 4.5 תזרים המזומנים (שורות נבחרות)

| תקופה | רכישות חוזרות | דיבידנד ששולם | תמורת אג״ח | עלויות אג״ח | דיבידנד שהתקבל | ניכוי במקור | מזומן בסוף |
|---|---|---|---|---|---|---|---|
| FY2014 |  |  |  |  | 18,601,146 | 5,219,077 | 565,809,913 |
| H1_2015 |  |  | 1,000,000,000 | -10,863,610 | 15,738,937 | 3,631,022 | 1,752,264,874 |
| FY2015 |  |  | 1,000,000,000 | -14,502,328 | 37,299,255 | 9,774,187 | 420,414,449 |
| H1_2016 |  |  | 0 | 0 | 26,174,917 | 7,264,926 | 1,482,995,358 |
| FY2016 |  |  | 0 | 0 | 50,032,559 | 13,412,324 | 2,076,161,696 |
| H1_2017 | -16,348,204 |  |  |  | 27,543,710 | 4,977,818 | 1,695,924,045 |
| FY2017 | -74,827,774 |  |  |  | 56,062,606 | 9,839,294 | 1,082,102,874 |
| H1_2018 | -300,859,583 |  |  |  | 44,406,907 | 7,521,369 | 1,122,177,458 |
| FY2018 | -300,859,774 |  |  |  | 96,472,882 | 17,162,338 | 201,246,176 |
| H1_2019 | -4,898,667 | -44,322,213 |  |  | 42,480,090 | 9,870,455 | 619,598,064 |
| FY2019 | -168,305,743 | -87,746,208 | 400,000,000 | -5,140,756 | 83,410,482 | 18,271,732 | 1,222,846,586 |
| H1_2020 | -220,267,884 | -41,283,782 |  | -66,357 | 47,147,107 | -11,322,309 | 1,411,188,401 |
| FY2020 | -291,177,639 | -81,137,646 | 700,000,000 | -7,468,274 | 81,637,693 | 21,045,969 | 1,879,639,109 |
| H1_2021 | -573 | -39,825,448 |  | -481,446 | 45,700,659 | 12,516,409 | 1,786,427,253 |
| FY2021 | -573 | -79,650,896 | 1,276,892,792 | -13,313,881 | 113,093,212 | 27,850,156 | 1,767,776,549 |
| H1_2022 | -50,338,983 | -44,776,719 |  | -55,611 | 69,751,568 | 15,600,978 | 1,175,411,398 |
| FY2022 | -262,423,586 | -93,271,012 | 0 | -55,948 | 156,043,061 | 32,436,970 | 1,147,443,227 |
| H1_2023 | -54,019,964 | -49,717,947 |  | 0 | 92,798,158 | 17,745,818 | 450,179,827 |
| FY2023 | -199,956,134 | -98,781,277 |  | 0 | 180,957,411 | 33,265,763 | 1,928,920,630 |
| H1_2024 | -73,148,640 | -53,583,340 |  |  | 69,593,550 | 13,083,399 | 1,843,556,023 |
| FY2024 | -119,623,243 | -107,166,682 |  |  | 145,671,679 | 29,872,536 | 436,520,113 |
| H1_2025 | -155,298,188 | -59,536,001 | 738,983,723 | -7,194,244 | 70,130,179 | 15,665,401 | 1,403,502,468 |
| FY2025 | -371,125,605 | -118,118,040 | 1,238,008,723 | -14,060,942 | 128,876,353 | 28,513,636 | 1,141,502,364 |
| H1_2026 | -119,560,571 | -64,452,537 | 0 | 0 | 68,739,429 | 15,283,525 | 201,265,840 |

**הערות לתזרים:**
- **ניכוי במקור בתזרים**: מוצג כ"Cash deducted during the year for withholding taxes". בטבלה הוא בערך מוחלט.
- **H1 2020**: ‎−11,322,309‎ כפי שהודפס.
- **"תמורת אג״ח"** מוצגת בדולרים:
  - 2021 ו־2025 כוללות את המרת סדרות האירו;
  - 2015: אג״ח 2022;
  - 2019: אג״ח 2039;
  - 2020: אג״ח 2030 ו־2032;
  - 2021: ‏2027 EUR ו־2031;
  - 2025: ‏2030 EUR ו־2032.
  - הפירוט בסעיף 8.
- **הפרש בין התזרים להון בשנים 2018–2019**: רכישות חוזרות בתזרים שונות מאלה שבגלגול ההון. בתזרים ‎−300,859,774‎ מול ‎−304,782,267‎ בהון. **[הסקה]** ההפרש נובע מעלויות ההצעה ומעיתוי הסליקה.

### 4.6 גלגול ההון (Statement of Changes in Equity)

| תקופה | פתיחה | רווח | רכישות חוזרות | דיבידנדים | אחר (המרות/הנפקה) | סגירה | הפרש |
|---|---|---|---|---|---|---|---|
| FY2014 | 0 | 329,773,983 |  |  | 6,003,372,824 | 6,333,146,807 | 0 |
| H1_2015 | 6,333,146,807 | 204,892,075 |  |  |  | 6,538,038,882 | 0 |
| FY2015 | 6,333,146,807 | -1,300,005,639 |  |  |  | 5,033,141,168 | 0 |
| H1_2016 | 5,033,141,168 | -1,061,565,297 |  |  |  | 3,971,575,871 | 0 |
| FY2016 | 5,033,141,168 | -677,506,606 |  |  |  | 4,355,634,562 | 0 |
| H1_2017 | 4,355,634,562 | -100,484,505 | -16,348,204 |  |  | 4,238,801,853 | 0 |
| FY2017 | 4,355,634,562 | -192,617,895 | -76,330,492 |  |  | 4,086,686,175 | 0 |
| H1_2018 | 4,086,686,175 | 164,461,016 | -304,782,267 |  | -214,929,845 | 3,731,435,079 | 0 |
| FY2018 | 4,086,686,175 | -91,508,067 | -304,782,267 |  | 56,515,599 | 3,746,911,440 | 0 |
| H1_2019 | 3,746,911,440 | 1,693,351,562 | -4,944,623 | -43,310,704 | -3,317,108 | 5,388,690,567 | 0 |
| FY2019 | 3,746,911,440 | 2,097,641,304 | -175,266,965 | -85,703,100 | -15,301,766 | 5,568,280,913 | 0 |
| H1_2020 | 5,568,280,913 | 1,447,103,794 | -220,963,773 | -40,124,830 |  | 6,754,296,104 | 0 |
| FY2020 | 5,568,280,913 | 3,571,835,955 | -289,575,701 | -78,766,886 | 280,762,221 | 9,052,536,502 | 0 |
| H1_2021 | 9,052,536,502 | 657,653,563 |  | -39,825,448 |  | 9,670,364,617 | 0 |
| FY2021 | 9,052,536,502 | 2,436,309,642 |  | -79,650,896 |  | 11,409,195,248 | 0 |
| H1_2022 | 11,409,195,248 | -2,982,201,388 | -54,059,384 | -44,776,719 |  | 8,328,157,757 | 0 |
| FY2022 | 11,409,195,248 | -1,172,083,602 | -263,906,913 | -93,271,012 |  | 9,879,933,721 | 0 |
| H1_2023 | 9,879,933,721 | 952,793,421 | -55,410,770 | -49,717,947 |  | 10,727,598,425 | 0 |
| FY2023 | 9,879,933,721 | 2,486,054,201 | -204,599,618 | -98,781,277 |  | 12,062,607,027 | 0 |
| H1_2024 | 12,062,607,027 | 650,333,398 | -67,021,829 | -53,583,340 |  | 12,592,335,256 | 0 |
| FY2024 | 12,062,607,027 | 1,173,695,918 | -117,906,173 | -107,166,682 |  | 13,011,230,090 | 0 |
| H1_2025 | 13,011,230,090 | 1,917,635,458 | -154,740,960 | -59,536,001 |  | 14,714,588,587 | 0 |
| FY2025 | 13,011,230,090 | 2,525,375,901 | -369,079,303 | -118,119,801 |  | 15,049,406,887 | 0 |
| H1_2026 | 15,049,406,887 | -1,928,599,294 | -120,444,972 | -64,456,468 |  | 12,935,906,153 | 0 |

**הערות לגלגול:**
- **[נגזר]** הפרש 0 בכל 24 התקופות: פתיחה + רווח + רכישות + דיבידנדים + אחר = סגירה.
- **"אחר" כולל:**
  - FY2014: הנפקה בהנפקה ההתחלתית ‏(IPO), המרות ממניות פרטיות, וגלגול מ־PSINTL;
  - 2018–2020: המרות בין Management Shares למניות ציבוריות;
  - 2019: גם דיבידנד על Management Shares.
- **רכישות חוזרות:** הסכום בגלגול כולל עלויות.

## 5. עמלות: איך מחושבות, ומה שולם בפועל

### 5.1 דמי ניהול

**הכלל**, לפי ביאור 15 בדוח FY2025 ‏(PSH-FY2025, עמ׳ 102 בדוח):
> "a quarterly management fee payable in advance each quarter in an amount equal to 0.375% (1.5% per annum) of the net assets (before any accrued performance fee) attributable to fee-paying shares, subject to reduction by the HHH Reduction Amount"

**פרטי הכלל:**
- **מניות משלמות עמלות**: המניות הציבוריות ו־Special Voting Share.
- **Management Shares** (עד 2020) לא שילמו עמלות.
- **מניות של עובדי PSCM, שותפיה וגופים קשורים** משלמות, אבל המנהל מחזיר להן את העמלה (סעיף 5.4). ההחזר לא משפיע על ה־NAV של PSH.

**שינויים והפחתות לאורך השנים:**

| תאריך | אירוע | השפעה על PSH |
|---|---|---|
| לפני ההנפקה | דמי ניהול של הקרן הפרטית | FY2013: ‏33,738,961; ‏H1 2014: ‏18,399,558; ‏FY2014: ‏52,019,094 |
| 01/04/2018 – 8 רבעונים | הפחתה בעקבות הסדר Allergan: ‏32.2 מיליון לקרנות הליבה. זה הסכום שבו עמלות הביצוע היו קטנות, אילו הוצאות ההסדר היו נרשמות ב־2014, יחד עם הרווח מ־Allergan | ‏14.4 מיליון בסך הכל; עד סוף 2018 הוקצו 5.4 מיליון. **[נגזר]** ‏1.8 מיליון לרבעון |
| 01/03/2019 | הפחתה חד־פעמית מרווח מכירת ההשקעה של PSCM ב־IEX | ‏2,477,980 |
| 05/05/2025 (תיקון ההסכם מ־05/08/2025) | ‏**HHH Reduction**: דמי הניהול שמשלמת HHH ל־PSCM, לפי חלק PSH במניות HHH, מקוזזים מדמי הניהול של PSH | ‏FY2025: ‏3,834,708, מתוכם H1 2025: ‏653,314. ‏H1 2026: ‏3,029,569 |

**נוסחת דמי HHH**, לפי PSH-FY2025 ביאור 16 ו־SEC-10Q-2026Q3:
- **בסיס**: ‏3,750,000 לרבעון ב־2025, ו־3,786,000 ב־2026 אחרי הצמדה. משולם מראש.
- **משתנה**: ‏0.375% × (המחיר − מחיר הייחוס) × 59,393,938 מניות.
  - המחיר: ממוצע משוקלל בנפח (VWAP) של 15 ימי המסחר האחרונים ברבעון.
  - מחיר הייחוס: ‎$66.1453‎ ב־2025, ו־‎$67.6695‎ ב־2026.
- ב־30/09/2026 ה־VWAP היה ‎$65.4095‎, מתחת למחיר הייחוס, ולכן לא היה רכיב משתנה.
- **[נגזר]** הפחתת ה־HHH של כל הקרנות ברבעון 3 2026 הייתה 1,117,570. זה 29.5% מ־3,786,000, כלומר חלק הקרנות ב־HHH: ‏27.7% של PSH ועוד הקרנות הפרטיות.
- הפחתות של כל הקרנות לפי SEC: רבעון 1 2026: ‏2,108,668; ‏9 חודשים 2026: ‏4,328,480.

**בדיקה מול דמי הניהול הרבעוניים של PSH:** הסכומים מדוחות PS Inc.: ‏"Fee Revenue by Fund" ‏(SEC-8K-20261102) והביאורים ב־10-Q.

| רבעון | דמי ניהול בפועל ($) | בסיס (סוף הרבעון הקודם) | 0.375% מהבסיס | הפרש | הפרש % |
|---|---|---|---|---|---|
| 2025Q1 | 48,449,424 | 13,011.2m (הון 31/12/2024 (SoFP)) | 48,792,113 | -342,689 | -0.70% |
| 2025Q2 | 46,643,397 | 12,632.8m (FPAUM 31/03/2025) | 47,373,000 | -729,603 | -1.54% |
| 2025Q3 | 54,996,854 | 15,083.0m (FPAUM 30/06/2025) | 56,561,250 | -1,564,396 | -2.77% |
| 2025Q4 | 57,905,580 | 16,044.0m (FPAUM 30/09/2025) | 60,165,000 | -2,259,420 | -3.76% |
| 2026Q1 | 54,233,716 | 15,049.4m (הון 31/12/2025 (SoFP)) | 56,435,276 | -2,201,560 | -3.90% |
| 2026Q2 | 45,693,694 | 12,479.2m (FPAUM 31/03/2026) | 46,797,000 | -1,103,306 | -2.36% |
| 2026Q3 | 47,187,764 | 12,936.0m (FPAUM 30/06/2026) | 48,510,000 | -1,322,236 | -2.73% |

**[נגזר] התאמה לדוחות PSH:**
- ‏2025Q1 + Q2 = 95,092,821, בדיוק דמי הניהול ב־SoCI של H1 2025.
- ‏2026Q1 + Q2 = 99,927,410, בדיוק H1 2026.
- ‏2025Q4 = ‏207,995,255 − 150,089,675 = ‏57,905,580. ב־8-K מופיע 57,906k.

**ניתוח הפער** מול 0.375% מהנכסים בסוף הרבעון הקודם:

| תקופה | פער | הפחתת HHH | יתרה | רכישות חוזרות בתקופה |
|---|---|---|---|---|
| 2025Q1 | ‎−342,689‎ | אין (לפני 05/2025) | ‎−342,689‎ | 137.2m |
| 2025Q2 | ‎−729,603‎ | ‎−653,314‎ (כל ההפחתה של H1 2025 הייתה ברבעון 2) | ‎−76,289‎ | — |
| H2 2025 | ‎−3,823,816‎ | ‎−3,181,394‎ | ‎−642,422‎ | 214.3m |
| H1 2026 | ‎−3,304,866‎ | ‎−3,029,569‎ | ‎−275,297‎ | 120.4m |

**[הסקה]** היתרה גדלה עם היקף הרכישות החוזרות באותה תקופה. זה מתאים להחזר יחסי של דמי הניהול ששולמו מראש על מניות שנרכשו ובוטלו במהלך הרבעון. הדוחות לא מתארים מנגנון כזה.

**לשחזור:**
- דמי ניהול רבעוניים = 0.375% × FPAUM בסוף הרבעון הקודם − הפחתת HHH − תיקון קטן לרכישות חוזרות.
- הסכומים השנתיים המדויקים מופיעים בטבלה 4.2.

### 5.2 עמלת ביצוע

**הכלל**, לפי PSH-FY2025 ביאור 15:
> "16% of the NAV appreciation (before any accrued performance fees) attributable to the fee-paying shares of the Company above a high water mark ... minus the Additional Reduction"

**פרטי הכלל:**
- **מועדי התגבשות**: ב־31/12 של כל שנה, ובכל תשלום דיבידנד.
  - בדיבידנד, העמלה יחסית ליחס בין הדיבידנד ל־NAV.
  - הדיבידנד מוריד את ה־HWM באותו אחוז מה־NAV.
- **"Additional Reduction"** = הקטן מבין עמלת ה־16% לבין ה־**PRA**.
- **ה־PRA** כולל שלושה רכיבים:
  - (i) 20% מעמלות הביצוע וההקצאות של "הקרנות האחרות" (PSLP, ‏PSINTL ועוד) על אותה תקופה;
  - (ii) 20% מדמי הניהול של קרנות אחרות שאין להן עמלת ביצוע. בפועל מ־30/04/2026: ‏PSUS;
  - (iii) יתרה שעוברת מתקופה קודמת.
- **התגבשות בסיום ההסכם**: סיום ההסכם עם המנהל מגבש את העמלה מיד.
- **ההיסטוריה של "Potential Offset Amount"**: עד 07/02/2024, ה־PRA שימש קודם להחזר עלויות ההנפקה של 2014. ‏PSCM נשאה בעלויות האלה (placing fees). רק אחרי החזר מלא היה אמור ה־PRA להקטין את העמלה. התיקון ב־07/02/2024 ביטל את היתרה שנותרה, כ־36 מיליון.

| תאריך | Potential Offset Amount (מיליון $) | הערה |
|---|---|---|
| 01/10/2014 | 120.0 | בהנפקה |
| 31/12/2014 | 102.1 | אחרי ה־PRA של 2014, עם צבירה של 4.25% |
| 31/12/2015 | 106.4 → 100.8 | התיקון מ־01/12/2016 ביטל את הצבירה רטרואקטיבית |
| 31/12/2016–31/12/2018 | 100.8 | — |
| 31/12/2019 | 82.5 | — |
| 30/06/2020 | 81.6 | — |
| 31/12/2020 | 52.4 | ‏PRA של 30.1 נוצל |
| 31/12/2021 | 41.6 | ‏PRA של 10.8 נוצל |
| 31/12/2022 | 41.6 | אין עמלה |
| 31/12/2023 | 35.6 | — |
| 07/02/2024 | 0 | היתרה בוטלה |

**[נגזר] מה זה אומר לשחזור:** עד 2023 כולל, PSH שילמה 16% מלאים. מ־2024 העמלה נמוכה ב־PRA:
- 2024: ‏4,568,501;
- 2025: ‏8,577,759.

**רכיבי עמלת הביצוע לפי שנה (מאומת):**

| תקופה | בדיבידנדים | שנתית (31/12) או צבורה (H1) | סה״כ ב־SoCI | PRA שקוזז | לתשלום בסוף התקופה |
|---|---|---|---|---|---|
| FY2013 (פרטית) | — | — | 38,790,795 | — | — |
| FY2014 | — | מתוכה 137,753,373 התגבשו בהנפקה (30/09/2014) | 206,545,813 | — | — |
| H1 2015 | — | 39,027,062 (צבורה; בוטלה עד סוף השנה) | 39,027,062 | — | — |
| FY2015–FY2018 | — | — | 0 | — | — |
| FY2019 | 121,934 + 153,285 | 38,704,421 | 38,979,640 | — | — |
| H1 2020 | 857,361 | 289,393,283 | 290,250,644 | — | — |
| FY2020 | 3,522,993 | 692,171,565 | 695,694,558 | (30.1m לטובת Offset) | 692,206,795 |
| H1 2021 | 534,865 | 124,732,483 | 125,267,348 | — | — |
| FY2021 | 1,476,256 | 462,582,726 | 464,058,982 | (10.8m לטובת Offset) | 462,597,488 |
| FY2022 | 0 | 0 | 0 | — | — |
| H1 2023 | — | 7,763,569 | 7,763,569 | — | — |
| FY2023 | 758,352 | 311,350,530 | 312,108,882 | (6.0m לטובת Offset) | — |
| H1 2024 | 605,220 | 124,407,314 | 125,012,534 | 16,498 + 3,499,699 | — |
| FY2024 | 1,244,457 | 225,343,728 | 226,588,185 | 4,568,501 | 225,356,173 |
| H1 2025 | 552,270 | 368,581,856 | 369,134,126 | 11,009 + 6,367,129 | — |
| FY2025 | 2,602,160 | 486,596,371 | 489,198,531 | 8,577,759 | 486,622,392 |
| H1 2026 | 0 | 0 | 0 | ‏PRA זמין 3,307,457 | — |

**ה־HWM של 2014:** במכתב FY2017 נכתב שעמלת ביצוע לא תשולם עד ש־PSH תעלה מעל HWM של ‎$26.37‎ למניה. זה ה־NAV ב־31/12/2014. **[נגזר]** הוא נחצה ב־2019: ה־NAV בסוף 2019 היה 26.94, והעמלה הראשונה מאז 2014 נגבתה ב־2019.

**[נגזר] הצלבה מול ה־SEC:**
- ‏"Realized PSH Performance Fees" בטבלת הקצאת העמלות של PS Inc. ‏(SEC-424B4) שווה לעמלה ב־SoCI של PSH פחות ה־"Performance fee offset" (הערה 7 בהתאמת ה־DE).

| שנה | חישוב | התוצאה ב־SEC |
|---|---|---|
| 2020 | 695.7 − 30.1 | 665.6 |
| 2021 | 464.1 − 10.8 | 453.2 |
| 2023 | 312.1 − 6.0 | 306.2 |
| 2024 | זהה | 226.6 |
| 2025 | זהה | 489.2 |

- ה־PRA הוא 20% מסכום העמלות של PSLP ו־PSINTL באותה שנה. עד 2023 הוא הלך להחזר עלויות ההנפקה, וזה ה־offset. דוגמאות:
  - 2020: ‏(79.9 + 70.6) × 20% = 30.1 מיליון, כולו offset.
  - 2024: ‏(14.5 + 8.3) × 20% ≈ 4.57, כלומר 4,568,501, והוא קוזז מעמלת PSH.
  - 2025: ‏(29.7 + 13.1) × 20% ≈ 8.58, כלומר 8,577,759.
  - [נגזר] כל הסכומים במיליוני דולרים, מ־SEC-424B4.

**[נגזר] העמלה למניה ב־2025:**
- FH: ‏‎−2.72‎ למניה. יחס עמלת הביצוע: ‎−3.38%‎. התשואה: 24.78% לפני העמלה ו־20.90% אחריה.
- בדיקה גסה: ה־HWM בתחילת 2025 = ‎$71.11‎, מותאם לדיבידנדים ≈ 70.5. ה־NAV לפני העמלה ≈ 85.32 + 2.72 = 88.04.
- ‏16% × (88.04 − 70.5) ≈ 2.81, פחות PRA של כ־0.05 למניה ≈ 2.76. בקירוב ל־2.72.

### 5.3 תזמון התשלום

- **העמלה השנתית** מתגבשת ב־31/12 ונרשמת כזכאי ("performance fees payable"). דוגמאות: 486,622,392 ב־31/12/2025; ‏225,356,173 ב־31/12/2024.
- **[הסקה]** היא משולמת בתחילת השנה הבאה, ולכן במזומן היא יוצאת בינואר.
- **בחציונים** העמלה רק צבורה, ומקטינה את ה־NAV. ב־H1 2025, למשל, ‏368.6 מיליון. אם השנה מסתיימת מתחת ל־HWM, הצבירה מתבטלת. כך היה ב־2015: הצבירה של H1 בוטלה עד סוף השנה.
- **דמי הניהול** משולמים מראש בתחילת כל רבעון.

### 5.4 החזר העמלות למקורבים (לא משפיע על ה־NAV של PSH)

- PSCM מחזירה לעובדים, לשותפים ולגופים קשורים את דמי הניהול ועמלת הביצוע שהמניות שלהם ב־PSH שילמו.
- לפי SEC-424B4 ו־10-Q, ההחזר הסתיים ב־30/04/2026.

| תקופה | סכום ($) |
|---|---|
| 2020 | 164,037,000 |
| 2021 | 141,041,000 |
| 2022 | 34,849,000 |
| 2023 | 115,706,000 |
| 2024 | 69,300,950 |
| 2025 | 77,579,860 |
| 9 חודשים 2025 | 38,491,397 |
| 9 חודשים 2026 | 26,592,930 |

**לשחזור:** תיק "כמו מחזיק ציבורי" צריך לנכות את מלוא העמלות. ה־NAV שמתפרסם כבר מנוכה מהן.

### 5.5 בצד של PS Inc.: עמלה מועדפת ועמלה נחותה

**החלוקה** (SEC-424B4, ‏"Allocation of Performance Fee Revenue"):
- **Preferred Performance Fees**: העמלה על 5 נקודות האחוז הראשונות של תשואה, נטו מדמי ניהול. נשארת ב־PS Inc.
- **Subordinated Performance Fees**: היתרה. עוברת ל־CompCo.

**הטבלה של PSH (מיליון $):**

| שנה | Preferred שמגיע | עמלה ממומשת מ־PSH | מקוזז מ־PSINTL | זמין | Preferred ששולם | ל־CompCo |
|---|---|---|---|---|---|---|
| 2020 | 41.6 | 665.6 | 16.0 | 681.6 | 41.6 | 640.0 |
| 2021 | 72.4 | 453.2 | 3.6 | 456.9 | 72.4 | 384.5 |
| 2022 | 87.5 | 0 | 0 | 0 | 0 | 0 |
| 2023 | 84.2 | 306.2 | 2.1 | 308.2 | 171.7 | 136.5 |
| 2024 | 95.2 | 226.6 | 1.7 | 228.2 | 95.2 | 133.1 |
| 2025 | 100.4 | 489.2 | 2.6 | 491.8 | 100.4 | 391.5 |

**ב־2026:**
- HWM ל־30/06/2026: ‏14,868.5 מיליון.
- Preferred fee: ‏118.9.
- קיזוז דמי ניהול של PSUS: ‏‎−3.3‎. לכן מגיע 115.6.
- ל־30/09/2026: ‏HWM ‏14,764.3; קיזוז ‎−7.9‎; מגיע 110.2.
- זה לא משנה את העמלה ש־PSH משלמת. זו רק החלוקה בתוך הקבוצה.

## 6. מסים

**גרנזי:**
> "The Company is a tax-exempt Guernsey entity under The Income Tax (Exempt Bodies) (Guernsey) Ordinance 1989 ... subject to withholding taxes applicable to certain investment income, such as dividends." ‏(PSH-FY2025, עמ׳ 82)

**ניכוי במקור על דיבידנדים:**
- הדוח לא מציין שיעור.
- הכנסות הדיבידנד מוצגות ברוטו, והמס מוצג בשורה נפרדת.
- **[נגזר]** השיעור האפקטיבי:

| שנה | דיבידנד ברוטו | ניכוי במקור | שיעור |
|---|---|---|---|
| FY2014 | 20,346,366 | 5,728,408 | 28.2% |
| FY2015 | 43,129,139 | 11,425,924 | 26.5% |
| FY2016 | 49,703,578 | 13,256,001 | 26.7% |
| FY2017 | 59,962,586 | 9,812,956 | 16.4% |
| FY2018 | 88,997,501 | 15,625,914 | 17.6% |
| FY2019 | 84,148,405 | 18,714,011 | 22.2% |
| FY2020 | 84,418,343 | 21,794,811 | 25.8% |
| FY2021 | 114,730,177 | 28,138,375 | 24.5% |
| FY2022 | 159,239,648 | 32,721,100 | 20.5% |
| FY2023 | 183,123,339 | 33,235,985 | 18.1% |
| FY2024 | 152,930,011 | 32,025,140 | 20.9% |
| FY2025 | 121,175,185 | 26,247,858 | 21.7% |
| H1 2026 | 69,364,962 | 15,438,852 | 22.3% |

**[הסקה]** השיעור משתנה לפי תמהיל המדינות. יש דיבידנדים מארה״ב, מקנדה (RBI, ‏Brookfield, ‏CP) ומהולנד (UMG). לשחזור עדיף להשתמש בסכום בפועל לכל שנה.

**מס נדחה (FIRPTA):**
> "Foreign corporations purchasing U.S. real property interests are required to pay the U.S. corporate tax rate (currently 21%) on the gains realized upon disposition. The Company's investments in HHH and SEG are classified as U.S. real property interests. To accrue for this potential withholding, the Company assesses an expense equal to 21% of the unrealized gains on the stock of HHH and SEG." ‏(PSH-FY2025 ביאור 19)

**ההוצאה והיתרה לפי תקופה** (מספר חיובי בהוצאה = הקטנת ההתחייבות):

| תקופה | הוצאה/הכנסה במס נדחה | התחייבות בסוף התקופה |
|---|---|---|
| FY2019 | ‎−13,508,846‎ | 13,508,846 |
| H1 2020 | ‎+9,973,714‎ | 3,535,132 |
| FY2020 | ‎−38,938,005‎ | 52,446,850 |
| H1 2021 | ‎−48,429,782‎ | 100,876,632 |
| FY2021 | ‎−59,098,133‎ | 111,544,983 |
| H1 2022 | ‎+77,446,189‎ | 34,098,794 |
| FY2022 | ‎+59,327,053‎ | 52,217,931 |
| H1 2023 | ‎−6,560,669‎ | 58,778,599 |
| FY2023 | ‎−32,609,005‎ | 84,826,934 |
| H1 2024 | ‎+56,997,532‎ | 27,829,403 |
| FY2024 | ‎+16,941,739‎ | 67,885,195 |
| H1 2025 | ‎+29,785,628‎ | 38,099,568 |
| FY2025 | ‎−6,892,500‎ | 74,777,696 |
| H1 2026 | ‎+24,621,948‎ | 50,155,747 |

**הערות:**
- **[נגזר]** בכל שנה ההוצאה שווה בדיוק לשינוי בהתחייבות.
- **[נגזר]** ‏74,777,696 / 0.21 = 356.1 מיליון. זה הרווח הלא ממומש נטו ב־HHH וב־SEG ב־31/12/2025.
- ב־FH ההוצאה כלולה ב־"Net gain from investments and derivatives".
- **לשחזור:** במניות HHH ו־SEG צריך לנכות 21% מהרווח שלא מומש. זו לא הוצאה על כל התיק.

## 7. עלויות נוספות

**הגדרות** (PSH-FY2025):
- **"Professional fees"**: חשבונאות, הערכות שווי, שירותי מנהלה, ביקורת, מס, משפט, בנקאי השקעות, יועצים, יחסי ציבור ומחקר.
  > "but excluding investment transaction costs"
- **עלויות עסקה בהשקעות** אינן הוצאה נפרדת. הן חלק מהעלות ומהתמורה, ולכן נכללות ברווח ה־FVTPL.

**שכר הדירקטורים הבלתי תלויים** (ביאור הצדדים הקשורים; נכלל ב־"Other expenses"):

| שנה | $ | שנה | $ |
|---|---|---|---|
| FY2014 | 179,612 | FY2020 | 331,525 |
| FY2015 | 359,184 | FY2021 | 618,765 |
| FY2016 | 304,322 | FY2022 | 581,628 |
| FY2017 | 298,630 | FY2023 | 592,753 |
| FY2018 | 335,923 | FY2024 | 598,102 |
| FY2019 | 357,559 | FY2025 | 607,415 |
| H1 2025 | 296,399 | H1 2026 | 315,186 (מתוכם 3,543 לתשלום) |

**עמלות תיווך על commodity interests:** מנוכות מהשורה עצמה. אלה העמלות היחידות שהדוח מגלה.

| שנה | $ | שנה | $ |
|---|---|---|---|
| 2013 | 403,401 | 2019 | 521,138 |
| 2014 | 777,769 | 2020 | 1,305,482 |
| 2015 | 3,990,307 | 2021 | 652,636 |
| 2016 | 629,978 | 2022–2025 | 0 ("nil") |
| 2017 | 118,644 | H1 2026 | 31,906 |
| 2018 | 44,690 | — | — |

**הוצאות ריבית:**

| שנה | סה״כ | ריבית אג״ח | הפחתת עלויות | ריבית על ביטחונות | אחר |
|---|---|---|---|---|---|
| 2015 | 45,346,032 | — | — | — | ‏rebate על שורט 16,006,434 |
| 2016 | 64,812,601 | 54,696,150 | 2,047,992 | 591,275 | ‏rebate 7,366,549; ריבית שורט 258,156 |
| 2018 | 60,285,416 | — | — | 3,297,840 | — |
| 2019 | 66,384,642 | 63,592,033 | 2,173,643 | 618,641 | — |
| 2020 | 83,482,818 | — | — | 1,401,786 | — |
| 2021 | 105,493,134 | — | — | 1,588,710 | — |
| 2022 | 103,420,537 | — | — | 12,020,882 | — |
| 2023 | 89,892,677 | — | — | 14,926,735 | — |
| 2024 | 77,292,603 | — | — | 2,197,258 | יתרת חובה 7,402 |
| 2025 | 112,813,503 | — | — | 9,286,805 | יתרת חובה אצל ברוקר 257,883 |

עלות האג״ח המלאה לכל שנה בסעיף 8.

**הכנסות ריבית:**

| שנה | סה״כ | ‏T-bills | קרנות כספיות | ביטחונות | אחר |
|---|---|---|---|---|---|
| 2015 | 179,462 | — | — | 178,590 | — |
| 2016 | 624,621 | — | — | 603,412 | — |
| 2018 | 5,170,005 | 847,552 | — | 4,064,512 | מזומן 209,265 |
| 2019 | 3,033,126 | — | — | 2,828,170 | מזומן 204,956 |
| 2020 | 1,062,148 | — | — | 1,030,739 | — |
| 2021 | 117,359 | — | — | 85,136 | השאלת ני״ע 32,223 |
| 2022 | 10,281,154 | 9,471,750 | — | 766,030 | — |
| 2023 | 19,710,258 | 19,328,465 | — | 331,795 | — |
| 2024 | 85,936,817 | 29,162,532 | 49,732,982 | 6,920,485 | ברוקר 120,818 |
| 2025 | 45,604,029 | 23,980,563 | 20,605,679 | 1,004,913 | ברוקר 12,874 |

**שינוי סיווג ב־2023:** בדוח FY2024 הקרנות הכספיות סווגו מחדש כשווי מזומנים. לכן הכנסות הריבית של 2023 הוצגו מחדש כ־41,648,685, מתוכן 21,938,427 מקרנות כספיות. לפני כן הרווח מהן היה בשורת ה־FVTPL.

**עמלות ההנפקה ב־2014:**
- ‏PSCM נשאה בעמלות ההשמה ("Placing Fees") של ההנפקה.
- לפי FH של 2014, יחס ההוצאות של המניות הציבוריות היה גבוה ב־1.86%, אילו PSH הייתה נושאת בהן.
- זה המקור של ה־Potential Offset Amount ‏(120 מיליון).

## 8. אג״ח (המינוף של PSH)

| סדרה | מטבע | קרן | הונפקה | מחיר הנפקה | קופון | פדיון | פדיון מוקדם בערך נקוב (par call) | הערות |
|---|---|---|---|---|---|---|---|---|
| 2022 | USD | 1,000,000,000 | 26/06/2015 | — | 5.5% | 15/07/2022 | — | עלויות הנפקה 14.5m. בהצעת רכש ב־22/09/2021 בוטלו 369,377,000; היתרה, 630,623,000, נפדתה ב־2022 |
| 2039 | USD | 400,000,000 | 25/07/2019 | 100 | 4.95% | 15/07/2039 | 15/07/2034 | — |
| 2032 | USD | 200,000,000 | 26/08/2020 | 100 | 3.00% | 15/07/2032 | 15/07/2030 | — |
| 2030 | USD | 500,000,000 | 02/11/2020 | 100 | 3.25% חצי־שנתי | 15/11/2030 | 15/08/2030 | — |
| 2027 | EUR | 500,000,000 | 01/10/2021 | 99.869 | 1.375% שנתי | 01/10/2027 | 01/08/2027 | — |
| 2031 | USD | 700,000,000 | 01/10/2021 | 99.67 | 3.25% | 01/10/2031 | 01/07/2031 | — |
| 2030 EUR | EUR | 650,000,000 | 29/04/2025 | 99.89 | 4.25% שנתי | 29/04/2030 | 29/03/2030 | בדולרים: 739,797,500; עלויות 8,408,171 |
| 2032 (5.50%) | USD | 500,000,000 | 28/10/2025 | 99.805 | 5.50% | 28/10/2032 | 28/08/2032 | עלויות 5,662,624 |

**תנאים כלליים:**
- האג״ח רשומות ב־Euronext Dublin.
- **אמת מידה**: חוב להון עד 1:3, כלומר 33.3% מהחוב וההון יחד.
  - **אירוע איש מפתח** (Key Man Event: מוות, נכות קבועה או פרישה של Ackman) מוריד את היחס ל־1:4, כלומר 25%.
  - אם היחס גבוה מזה, PSH חייבת להקטין חוב או לגייס הון תוך 180 יום.
  - לצורך זה האג״ח ניתנות לפדיון ב־101% מהערך הנקוב בתוספת ריבית צבורה, בסכום הנדרש.
- **[SEC]** יחס החוב להון ב־31/12/2025: ‏19.5%. הממוצע מאז ההנפקה הראשונה: 18.3%. מעולם לא עבר 25%. המדיניות: עד 33%.
- **[מאומת]** מכתב FY2025: "We seek to maintain leverage generally between 15% and 20% of total assets".
- עלות החוב הממוצעת המשוקללת: 3.6%.

**עלות האג״ח לפי שנה** (ביאור האג״ח):

| שנה | סה״כ עלות | ריבית | הפחתת עלויות | הפחתת ניכיון | קופונים ששולמו | הפרשי שער | יתרה בספרים בסוף |
|---|---|---|---|---|---|---|---|
| 2015 | 29,213,871 | 28,171,374 | 1,042,497 | — | — | — | 1,014,688,599 |
| 2016 | 56,744,142 | 54,696,150 | 2,047,992 | — | 57,902,776 | — | 1,013,552,905 |
| 2017 | 56,874,831 | 54,823,788 | 2,051,043 | — | 55,000,000 | — | 1,015,427,736 |
| 2018 | 56,984,243 | 54,929,255 | 2,054,988 | — | 55,000,000 | — | 1,017,411,979 |
| 2019 | 65,765,676 | 63,592,033 | 2,173,643 | — | 55,000,000 | — | 1,422,883,554 |
| 2020 | 82,079,517 | 79,602,528 | 2,476,989 | — | 74,250,000 | — | 2,122,787,844 |
| 2021 | 103,900,095 | 99,901,785 | 3,908,950 | 89,360 | 101,411,647 | ‎−10,539,796‎ | 3,009,416,881 |
| 2022 | 91,383,448 | 87,734,757 | 3,304,217 | 344,474 | 103,219,692 | ‎−34,372,153‎ | 2,332,567,827 |
| 2023 | 74,907,654 | 71,935,256 | 2,625,012 | 347,386 | 72,042,840 | ‎+16,482,623‎ | 2,351,915,264 |
| 2024 | 75,087,943 | 72,106,453 | 2,632,775 | 348,715 | 72,495,715 | ‎−33,706,191‎ | 2,320,801,301 |
| 2025 | 103,268,815 | 98,809,410 | 3,969,451 | 489,954 | 72,871,536 | ‎+93,973,889‎ | 3,669,110,397 |
| H1 2026 | 68,413,344 | 65,495,218 | 2,590,263 | 327,863 | 78,498,768 | ‎−37,519,198‎ | 3,621,505,775 |

**הסבר עמודת הפרשי השער:** הסימן הוא מצד היתרה בספרים.
- חיובי: האירו התחזק, והחוב בדולרים גדל. ב־SoCI זה הפסד.
- שלילי: רווח ב־SoCI. ב־FY2025 ‏+93.97 מיליון ביתרה הם ‎−93.96‎ מיליון ב־SoCI. ההפרש נובע מעיגול.

**שווי הוגן של האג״ח** (ביאור השווי ההוגן; לא משפיע על ה־NAV, שנמדד בעלות מופחתת):

| תאריך | 2022 | 2027 EUR | 2030 EUR | 2030 USD | 2031 | 2032 ($200m) | 2032 ($500m) | 2039 | סה״כ |
|---|---|---|---|---|---|---|---|---|---|
| 31/12/2020 | 1,057,350,000 | — | — | 506,925,000 | — | 198,538,000 | — | 469,480,000 | 2,232,293,000 |
| 31/12/2021 | 641,520,165 | 559,919,993 | — | 503,642,500 | 700,889,000 | 193,938,000 | — | 453,416,000 | 3,053,325,658 |
| 31/12/2022 | — | 442,818,404 | — | 388,425,000 | 526,904,000 | 149,822,000 | — | 348,844,000 | 1,856,813,404 |
| 31/12/2023 | — | 490,393,909 | — | 409,310,000 | 555,128,000 | 146,832,000 | — | 322,436,000 | 1,924,099,909 |
| 31/12/2024 | — | 486,393,726 | — | 432,975,000 | 579,719,000 | 150,078,000 | — | 330,424,000 | 1,979,589,726 |
| 31/12/2025 | — | 572,739,596 | 775,254,173 | 464,310,000 | 633,514,000 | 171,496,000 | 500,655,000 | 361,244,000 | 3,479,212,769 |
| 30/06/2026 | — | 558,514,306 | 753,124,795 | 460,535,000 | 627,368,000 | 171,372,000 | 495,200,000 | 363,292,000 | 3,429,406,101 |

## 9. מניות, רכישות חוזרות, דיבידנדים וציר הכניסות והיציאות

### 9.1 סוגי המניות ותנועות

**הנפקה, 01/10/2014:**
- מניות פרטיות הומרו ל־121,753,991 מניות ציבוריות.
- הוקצו 109,875,195 מניות חדשות בהנפקה, ב־NAV פתיחה של ‎$25.00‎.
- 8,499,360 מניות נוספו בגלגול מ־PSINTL.
- סך המניות הציבוריות ב־31/12/2014: ‏240,128,546.
- מניות VoteCo הומרו ל־5,000,000,000 מניות Class B, עם NAV כולל של ‎$167,917‎.
- Management Shares: ‏8,500,796.

**2017:**
- רכישה חוזרת של 5,411,736 מניות תמורת ‎$76,330,492‎, במחיר ממוצע ‎$14.10‎.
- מניות Class B הוחלפו ב־Special Voting Share אחת, שמחזיקה VoteCo ‏(PS Holdings Independent Voting Company Limited).

**2018:**
- הצעת רכש עצמית ב־10/05/2018: ‏22,271,714 מניות ב־‎$13.47‎, בסך ‎$299,999,988‎. ההנחה ל־NAV הייתה 20.5%.
- באותה אסיפה בוטלה מגבלת הבעלות של 4.99%.
- סך הרכישות החוזרות בשנה: 22,334,151.
- המרות בין מניות ציבוריות ל־Management Shares: ‏25,960,460 יצאו ו־30,193,895 נכנסו.

**2019:**
- נרכשו 9,355,567 מניות: ‎$95,113,359‎ מהן בוטלו, ו־‎$80,153,606‎ הועברו לאוצר.
- מ־24/10/2019 מניות שנרכשות מוחזקות באוצר ולא מבוטלות.

**31/12/2020:**
- כל ה־Management Shares, ‏5,160,225, הומרו ל־6,175,883 מניות ציבוריות שהוקצו מהאוצר.
- **[נגזר]** האוצר בסוף 2020: ‏4,278,966 + 13,732,785 רכישות − 6,175,883 להמרה = 11,835,868.

**מאז 10/2019:**
- 210,956,750 מניות מונפקות, ציבוריות ואוצר יחד. **[נגזר]** נבדק בכל תקופה מ־FY2019.
- רכישות חוזרות לפי שנה:

| שנה | מניות |
|---|---|
| 2021 | 0 |
| 2022 | 8,262,440 |
| 2023 | 5,397,296 |
| 2024 | 2,505,136 |
| 2025 | 6,573,519 |
| H1 2026 | 2,119,955 |

**[נגזר]** מספר המניות הציבוריות בסוף כל תקופה = מספר קודם − רכישות + המרות. נבדק עד המניה.

**Management Shares** (מוצגות כהתחייבות לפי IFRS; לא שילמו עמלות):

| תקופה | NAV | מניות | NAV למניה |
|---|---|---|---|
| FY2014 | 227,226,260 | 8,500,796 | 26.73 |
| FY2015 | 183,368,504 | — | 21.57 |
| FY2016 | 161,137,460 | — | 18.96 |
| FY2017 | 156,268,350 | — | 18.38 |
| H1 2018 | 383,478,171 | 19,324,427 | — |
| FY2018 | 86,046,388 | 4,626,817 | 18.60 |
| H1 2019 | 128,099,016 | 4,754,338 | — |
| FY2019 | 152,364,909 | 5,160,225 | 29.53 |
| H1 2020 | 204,784,320 | — | 39.69 |
| FY2020 | 0 | 0 | — |

**[הסקה]** ה־NAV למניה שלהן גבוה מזה של המניות הציבוריות, כי הן לא נשאו בעמלות.

### 9.2 תוכניות הרכישה החוזרת

| תקופה | מניות | סכום | הנחה ממוצעת ל־NAV | מחיר ממוצע |
|---|---|---|---|---|
| 2017 | 5,411,736 | ‎$76.3m‎ | — | ‎$14.10‎ |
| 2018 (כולל הצעת הרכש) | 22,334,151 | ‎$304.8m‎ (בגלגול ההון) | 20.5% בהצעה | ‎$13.47‎ בהצעה |
| 2019 | 9,355,567 | ‎$174m‎ | 28.3% | — |
| 2020 | 13,732,785 | ‎$286m‎ | 32.0% | — |
| 2022 | 8,262,440 | ‎$263.9m‎ | 32.9% | — |
| 2023 | 5,397,296 | ‎$204.6m‎ | 34.3% | ‎$37.91‎ |
| 2024 | 2,505,136 | — | 30.6% | ‎$47.07‎ |
| תוכנית 2024 (הושלמה 04/04/2025) | 3,967,758 | ‎$200m‎ | 30.4% | — |
| תוכנית 2025 (הושלמה 24/03/2026) | 5,004,020 | ‎$300m‎ | 27.7% | — |
| תוכנית 2026 (עד 30/06/2026) | 768,054 | ‎$40.4m‎ | 31.7% | — |
| **מצטבר 05/2017–30/06/2026** | **75,692,585** | **‎$1.9bn‎** | **29.2%** | — |

- **סוכן הרכישות**: Jefferies (PSH-H1_2026 ביאור 6).
- **התוספת ל־NAV למניה מרכישות חוזרות:**

| תקופה | תוספת ($ למניה) |
|---|---|
| 2017 | 0.08 |
| 2018 (כולל ההצעה) | 0.35 |
| 2019 | 0.31 |
| 2020 | 0.66 |
| 2022 | 0.67 |
| 2023 | 0.57 |
| 2024 | 0.28 |
| 2025 | 0.85 |
| H1 2025 | 0.37 |
| H1 2026 | 0.25 |

  בייחוס היא מופיעה כ־"Share Buyback Accretion". ב־2025 התרומה הייתה ‎+1.2%‎.

### 9.3 דיבידנדים

**הנוסחה** (PSH-H1_2026 ביאור 6):
- דיבידנד רבעוני = ממוצע ה־NAV למניה בכל ימי המסחר של דצמבר הקודם × 0.25%.
- סך הדיבידנדים בשנה מוגבל ל־125% מממוצע סך הדיבידנדים בשלוש השנים הקודמות.

**הסכום למניה לרבעון:**

| תקופה | ‎$‎ למניה |
|---|---|
| 13/02/2019–28/03/2022 | 0.10 |
| מרבעון 2 2022 | 0.125 |
| 2023 | 0.1307 |
| 2024 | 0.1456 |
| 2025 | 0.1646 |
| 2026 | 0.1837 |

**[נגזר]** בדיקה מול ה־FH: ‏2023: ‏4 × 0.1307 = 0.52; ‏2024: ‏0.58; ‏2025: ‏0.66. מתאים.

**סך הדיבידנדים שהוכרזו** (גלגול ההון):

| שנה | H1 | שנה מלאה |
|---|---|---|
| 2019 | 43,310,704 | 85,703,100 (ועוד 2,043,108 ל־Management Shares) |
| 2020 | 40,124,830 | 78,766,886 (ועוד 2,370,760 ל־Management Shares) |
| 2021 | 39,825,448 | 79,650,896 |
| 2022 | 44,776,719 | 93,271,012 |
| 2023 | 49,717,947 | 98,781,277 |
| 2024 | 53,583,340 | 107,166,682 |
| 2025 | 59,536,001 | 118,119,801 |
| 2026 | 64,456,468 | — |

**לשחזור:**
- כל דיבידנד מגבש עמלת ביצוע יחסית (טבלה 5.2).
- כל דיבידנד מוריד את ה־HWM למניה באחוז הדיבידנד מתוך ה־NAV.

### 9.4 ציר הכניסות והיציאות, כפי שתואר בדוחות PSH

אלה משפטים מתוך מכתבי היו״ר והמנהל בדוחות. רוב התאריכים ברמת רבעון או שנה. הכמויות בנקודות הקצה נמצאות ב־CSOI (סעיף 3).

| מתי | אירוע | מקור |
|---|---|---|
| 2014 | יציאה מ־Beam (במכירה ל־Suntory), מ־General Growth Properties (מכירה לחברה) ומ־Procter & Gamble (בשוק) | PSH-FY2014 |
| 2015 | יציאה מ־Allergan במיזוג עם Actavis, בתמורה למזומן ומניות Actavis. מניות Actavis נמכרו בשוק | PSH-FY2015 |
| 04/08/2016 | מכירת יתרת 9.8 מיליון מניות Canadian Pacific | PSH-H1_2016 |
| H1 2017 | השקעה חדשה: ADP | PSH-H1_2017 |
| 2017 | ‏S&P Global: כניסה ויציאה באותה שנה. יציאות נוספות: Air Products, ‏Hilton, ‏Nomad Foods, ‏Valeant, ופוזיציה נוספת שלא נחשפה | PSH-FY2017 |
| H1 2018 | השקעות חדשות: United Technologies ו־Lowe's | PSH-H1_2018 |
| סוף 2018 | "השקעה חדשה גדולה" ב־Hilton בירידת השוק בסוף השנה | PSH-FY2018 |
| 2018 / 2019 | יציאה מ־Mondelez, ‏Nike ו־Herbalife ב־2018, ומ־Platform Specialty ב־2019 | PSH-FY2018 |
| 2019 | השקעה חדשה: Berkshire Hathaway. יציאה מ־ADP, ‏United Technologies ו־Platform | PSH-H1_2019, ‏PSH-FY2019 |
| סוף 02/2020 – 03/2020 | גידור CDS גדול, שפורק אחרי הירידה. הוספה ל־Restaurant Brands, ‏Lowe's, ‏Hilton ו־Berkshire. ‏432 מיליון בהנפקה המשנית של Howard Hughes. חזרה ל־Starbucks | PSH-FY2019 (מכתב 03/2020) |
| 2020 | יציאה מ־Berkshire Hathaway. התחלת גידור סוופציוני ריבית | PSH-FY2020, ‏PSH-FY2021 |
| 2021 | כניסה ל־UMG, ‏Domino's ו־Canadian Pacific. יציאה מ־Starbucks (H1) ומ־Agilent (אחרי H1) | PSH-H1_2021, ‏PSH-FY2021 |
| תחילת 2022 | כניסה ל־Netflix מתמורת גידור הסוופציונים, וסוופציון חדש | PSH-FY2021 |
| 2022 | יציאה מ־Netflix, ‏Domino's ו־PSTH | PSH-H1_2022, ‏PSH-FY2022 |
| תחילת 2023 | כניסה ל־Alphabet | PSH-H1_2023 |
| תחילת 2024 [הסקה לגבי המועד] | יציאה מ־Lowe's, "after a highly successful, nearly six-year holding period". ה־CSOI ל־31/12/2023 עדיין מראה את שורת Retail | PSH-FY2023 |
| רבעון 2 2024 | כניסה ל־Nike ול־Brookfield | PSH-H1_2024 |
| סוף 2024 | כניסה ל־Hertz (נחשף ב־04/2025) | PSH-H1_2025 |
| תחילת 2025 | כניסה ל־Uber | PSH-FY2024 |
| 04/2025 | יציאה מ־Canadian Pacific, וכניסה ל־Amazon מהתמורה | PSH-H1_2025 |
| 2025 | יציאה מ־Chipotle ו־Nike | PSH-FY2025 |
| 05/05/2025 | ‏Pershing Square Holdco קנתה 9 מיליון מניות HHH חדשות ב־900 מיליון. ‏PSH ירדה מ־33.0% ל־27.8% | PSH-FY2025 |
| סוף 2025 | כניסה "משמעותית" ל־Meta | PSH-FY2025 |
| תחילת 2026 | יציאה מ־Hilton | PSH-FY2025 |
| H1 2026 | כניסה ל־Visa, ‏Mastercard, ‏Netflix ו־S&P Global. ‏Microsoft נקנתה ב־2026: תרומה ברבעון 1 בייחוס של SEC, ו"ירידה של 8% מהעלות הממוצעת". יציאה מ־UMG ומ־Alphabet | PSH-H1_2026, ‏SEC-10Q-2026Q1 |
| 04/06/2026 | ‏1 מיליארד ב־HHH Preferred (רכישת Vantage) | PSH-H1_2026 |
| אחרי 30/06/2026 | כניסה ל־Intercontinental Exchange ול־Alcon | PSH-H1_2026 |
| 07/2026 | יציאה מ־Hertz | PSH-H1_2026 |

## 10. גלגול ה־NAV

### 10.1 גלגול ההון בדולרים

טבלה 4.6. סיכום:
- פתיחה + רווח לבעלי ההון − רכישות חוזרות − דיבידנדים ± המרות = סגירה.
- הפרש 0 בכל 24 התקופות.

### 10.2 גלגול ה־NAV למניה (Financial Highlights, מבוקר)

| שנה | פתיחה | הפרשי שער אג״ח | פדיון אג״ח מוקדם | תוספת מרכישות חוזרות | דיבידנד | הפסד השקעה נטו* | רווח מהשקעות ונגזרים** | עמלת ביצוע | סגירה | בדיקת סכום | תשואה לפני עמלת ביצוע % | תשואה אחרי % |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| FY2014 (1/10–31/12) | 25.00 |  |  |  |  | -0.39 | 1.76 |  | 26.37 | תקין | 6.54 | 5.49 |
| FY2015 | 26.37 |  |  |  |  | -0.52 | -4.89 |  | 20.96 | תקין | -20.53 | -20.53 |
| FY2016 | 20.96 |  |  |  |  | -0.54 | -2.28 |  | 18.14 | תקין | -13.46 | -13.46 |
| FY2017 | 18.14 |  |  | 0.08 |  | -0.61 | -0.20 |  | 17.41 | תקין | -4.01 | -4.01 |
| FY2018 | 17.41 |  |  | 0.35 |  | -0.20 | -0.26 |  | 17.30 | תקין | -0.65 | -0.65 |
| FY2019 | 17.30 |  |  | 0.31 | -0.40 | -0.59 | 10.32 |  | 26.94 | תקין | 59.15 | 58.07 |
| FY2020 | 26.94 |  |  | 0.66 | -0.40 | -4.19 | 22.45 |  | 45.46 | תקין | 83.54 | 70.23 |
| FY2021 | 45.46 | 0.05 | -0.06 |  | -0.40 | -3.21 | 15.46 |  | 57.30 | תקין | 32.02 | 26.91 |
| FY2022 | 57.30 | 0.17 |  | 0.67 | -0.48 | -0.65 | -5.25 |  | 51.76 | תקין | -8.83 | -8.83 |
| FY2023 | 51.76 | -0.09 |  | 0.57 | -0.52 | -0.48 | 15.47 | -1.67 | 65.04 | תקין | 29.90 | 26.65 |
| FY2024 | 65.04 | 0.18 |  | 0.28 | -0.58 | -0.39 | 7.81 | -1.23 | 71.11 | תקין | 12.13 | 10.24 |
| FY2025 | 71.11 | -0.52 |  | 0.85 | -0.66 | -1.07 | 18.33 | -2.72 | 85.32 | תקין | 24.78 | 20.90 |

**הסבר:**
- \* **"הפסד השקעה נטו"** (Net investment loss): דיבידנדים וריבית, פחות דמי ניהול, ריבית, הוצאות מקצועיות ואחרות, ומס במקור.
  - ב־FY2020–FY2022 הוא **כולל** גם את עמלת הביצוע.
  - מ־FY2023 עמלת הביצוע מוצגת בשורה נפרדת.
- \*\* **"רווח מהשקעות ונגזרים"** כולל את המס הנדחה.
- **עמודות התשואה** מתייחסות למניה הציבורית, כולל השקעה מחדש של הדיבידנדים.
- ב־FY2014 העמודה היא של המניות הציבוריות בלבד, מ־01/10/2014. התשואה "המשולבת" למחזיק מתחילת 2014 הייתה 48.49% לפני עמלה ו־40.39% אחריה.
- **[נגזר]** הבדיקה: פתיחה + כל הרכיבים = סגירה, בכל 12 השנים.

**יחסי הוצאות לנכסים הממוצעים** (מה־FH):

| שנה | הוצאות לפני עמלת ביצוע | עמלת ביצוע | הוצאות אחרי |
|---|---|---|---|
| 2015 | 2.52% | 0 | 2.52% |
| 2016 | 3.93% | 0 | 3.93% |
| 2017 | 4.59% | 0 | 4.59% |
| 2018 | 3.01% | 0 | 3.01% |
| 2019 | 2.68% | 0.76% | 3.44% |
| 2020 | 2.68% | 9.94% | 12.62% |
| 2021 | 2.70% | 4.58% | 7.28% |
| 2022 | 2.68% | — | 2.68% |
| 2023 | 2.45% | 2.93% | 5.38% |
| 2024 | 2.22% | 1.80% | 4.02% |
| 2025 | 2.30% | 3.38% | 5.68% |

**NAV למניה בסוף כל תקופה** (מודפס; טבלה 4.4):

| תקופה | NAV | תקופה | NAV | תקופה | NAV |
|---|---|---|---|---|---|
| 31/12/2014 | 26.37 | 31/12/2018 | 17.30 | 31/12/2022 | 51.76 |
| 30/06/2015 | 27.23 | 30/06/2019 | 24.92 | 30/06/2023 | 56.68 |
| 31/12/2015 | 20.96 | 31/12/2019 | 26.94 | 31/12/2023 | 65.04 |
| 30/06/2016 | 16.54 | 30/06/2020 | 34.52 | 30/06/2024 | 68.43 |
| 31/12/2016 | 18.14 | 31/12/2020 | 45.46 | 31/12/2024 | 71.11 |
| 30/06/2017 | 17.73 | 30/06/2021 | 48.56 | 30/06/2025 | 81.78 |
| 31/12/2017 | 17.41 | 31/12/2021 | 57.30 | 31/12/2025 | 85.32 |
| 30/06/2018 | 18.58 | 30/06/2022 | 42.19 | 30/06/2026 | 74.23 |

### 10.3 גלגול ה־AUM של PSH, מדוחות PS Inc. (מיליון $)

**ההגדרות:**
- **AUM** = הנכסים נטו + עמלת ביצוע צבורה + הקרן של האג״ח.
- **FPAUM** = הנכסים נטו של המניות משלמות העמלות + עמלת ביצוע צבורה, בלי אג״ח. ב־31/12 הוא שווה לסך ההון.
  - **[נגזר]** בדיקה ל־30/06/2025: ‏15,083 = ‏NAV ‏14,714.07 + עמלה צבורה 368.58.

| תקופה | פתיחה | דיבידנדים | רכישות חוזרות | דמי ניהול | עמלת ביצוע | שוק | הנפקת אג״ח | הפרשי שער אג״ח אירו | סגירה |
|---|---|---|---|---|---|---|---|---|---|
| 2024 | 14,414.6 | ‎−107.2‎ | ‎−117.9‎ | ‎−188.8‎ | ‎−226.6‎ | 1,589.1 | — | ‎−34.1‎ | 15,329.2 |
| 2025 | 15,329.2 | ‎−118.1‎ | ‎−369.1‎ | ‎−208.0‎ | ‎−489.2‎ | 3,222.6 | 1,235.5 | 98.0 | 18,700.9 |
| רבעון 1 2025 | 15,329.2 | ‎−29.9‎ | ‎−137.2‎ | ‎−48.4‎ | ‎−0.1‎ | ‎−162.9‎ | — | 22.7 | 14,973.4 |
| רבעון 1 2026 | 18,700.9 | ‎−32.3‎ | ‎−80.0‎ | ‎−54.2‎ | 0 | ‎−2,403.6‎ | — | ‎−22.3‎ | 16,108.4 |
| 04/2026 | 16,108.4 | — | — | ‎−15.2‎ | — | 1,690.2 | — | 20.5 | 17,803.8 |

**ההמשך** (סיווג מקוצר של PS Inc.):

| תקופה | פתיחה | שוק | יציאות | סגירה |
|---|---|---|---|---|
| רבעון 3 2026, ‏AUM | 16,550 | 417 | ‎−106‎ | 16,861 |
| רבעון 3 2026, ‏FPAUM | 12,936 | 417 | ‎−95‎ | 13,258 |
| 9 חודשים 2026, ‏AUM | 18,701 | ‎−1,512‎ | ‎−329‎ | 16,861 |
| 9 חודשים 2026, ‏FPAUM | 15,049 | ‎−1,512‎ | ‎−280‎ | 13,258 |

**[נגזר] ה־NAV למניה ב־30/09/2026:**
- FPAUM של 13,258 מיליון. ה־HWM המצרפי ל־30/09/2026: ‏14,764.3.
- ה־HWM למניה, ‎$85.32‎, לא השתנה מאז 31/12/2025, כי לא שולמה עמלה. לכן מספר המניות ≈ ‏14,764.3 / 85.3195 ≈ 173.05 מיליון.
- מכאן ה־NAV למניה ב־30/09/2026 ≈ 13,258 / 173.05 ≈ ‎$76.6‎.
- זו הערכה. אין דוח PSH לתאריך הזה.
