# בנקאות פתוחה / פיננסים פתוחים בישראל — חשבונות ני"ע (אחזקות ועסקאות), והאם אפשר לקבל כך נתוני לקוח One Zero

> נכון ל־18/11/2026. רמות ודאות: **מאומת** (מקור ראשוני שנקרא) / **סותר** / **לא ודאי**. לא נעשתה התחברות לשום חשבון. מחקר מוגבל ב־~15 קריאות; מה שלא נמצא — בסעיפי "פערים".

## 1. חוק שירות מידע פיננסי (התשפ"ב-2021): האם ני"ע מכוסה ומתי One Zero מחויב

### Takeaway
ני"ע הוא "סל מידע" בחוק ובהוראה 368, אך מועד החובה בפועל לגישה למידע ני"ע נדחה פעמים ותלוי בצו. לא נמצא מקור מפורש שקובע שחובה זו פועלת בפועל ל־One Zero, ולא נמצא תיעוד שהבנק חושף API לצד שלישי. **לא ודאי** שהמסלול זמין היום.

### Cited Findings
- החוק נכנס לתוקף ב־14/6/2022; הרישוי של נותני שירות מידע פיננסי ברשות ניירות ערך; בשלבים: עו"ש וכרטיסי חיוב ראשון, אשראי ופיקדונות שני, ואחר כך עסקים קטנים, ני"ע ואשראי חוץ־בנקאי (**לא ודאי** — סיכום חיפוש משני) — [המכלול](https://www.hamichlol.org.il/%D7%97%D7%95%D7%A7_%D7%A9%D7%99%D7%A8%D7%95%D7%AA_%D7%9E%D7%99%D7%93%D7%A2_%D7%A4%D7%99%D7%A0%D7%A0%D7%A1%D7%99)
- חוזר בנק ישראל 2658 (אפריל 2021): נדחו מועדי ההוראה, והתחלת הגישה למידע ני"ע נדחתה ללא מועד ("ייקבע בהמשך") — **מאומת (תקציר)** — [h2658](https://boi.org.il/media/j2amd45l/h2658.pdf), [h2658 en](https://boi.org.il/media/wwpckxlc/h2658_en.pdf)
- לפי פונדר: מועד חובת הגישה למידע פיננסי מסוג זה אצל בנק/תאגיד עזר נקבע בחוק ל־14/6/2023 (השר רשאי לדחות בהסכמת ועדת הכלכלה); ללקוח תאגיד שאינו קטן — 14/4/2024 מכוח "צו שירות מידע פיננסי (דחיית יום התחילה…) לעניין סל ני"ע וחשבונות של תאגידים, התשפ"ג-2023" — **לא ודאי** (מקור משני, לא נקרא במלואו; כתובת הכתבה נתקלה ב־403) — [פונדר](https://www.funder.co.il/article/141585)
- סיכום משפטי (גורניצקי): קטגוריות המידע כוללות ני"ע המוחזקים אצל הלקוח, פעילות בתיק ני"ע ועמלות — **לא ודאי** (תקציר חיפוש) — [גורניצקי](https://www.gornitzky.co.il/wp-content/uploads/pdf/post/26877_----------.pdf)
- תזכיר חוק תיקון מס' 3 (2/2/2025) — לא אומת אם התקבל — [המכלול/חיפוש](https://www.hamichlol.org.il/%D7%97%D7%95%D7%A7_%D7%A9%D7%99%D7%A8%D7%95%D7%AA_%D7%9E%D7%99%D7%93%D7%A2_%D7%A4%D7%99%D7%A0%D7%A0%D7%A1%D7%99)
- דף בנק ישראל "בנקאות פתוחה" (עודכן 18/11/2026) מאשר שהתקן מבוסס NextGenPSD2 ומפנה לרשימת גופים מפוקחים (PDF); אין בדף התייחסות לני"ע או ל־One Zero — **מאומת** — [boi.org.il](https://www.boi.org.il/roles/supervisionregulation/bank-sup/open-banking/)
- נאום המפקח על הבנקים (4/11/2025): בנקאות פתוחה "פלטפורמה מרכזית"; בלי מועדים חדשים ובלי כללי ני"ע — **מאומת** — [boi.org.il](https://boi.org.il/en/communication-and-publications/press-releases/4-11-25-ben/)

### Inferences
- One Zero הוא בנק ולכן "מקור מידע" לפי החוק, אך תחולה בפועל על חשבון ני"ע שלו תלויה בצו הדחייה ובמועד שלא אומתו. ייתכן שחשבונות ני"ע של יחידים כבר חייבים (לפי 14/6/2023) — אך זה לא אומת.

### Gaps
- נוסח הצו העדכני והמועד הסופי לני"ע; האם One Zero מימש בפועל; האם תיקון 3 התקבל.
- בדיקת תחולה על One Zero ספציפית — לא נמצא מקור.

## 2. הוראה 368 והתקן הישראלי — API ני"ע

### Takeaway
יש מפרט ציבורי של בנק ישראל: "AIS for Securities Accounts" גרסה 1.1 (מבוסס Berlin Group openFinance, נובמבר 2022) — חשבונות, אחזקות (positions), עסקאות והוראות (orders). **מאומת** שהמפרט קיים; **לא ודאי** מי מיישם אותו ומתי חובה.

### Cited Findings
- המסמך (89 עמ'): "AIS for Securities Accounts, Version 1.1"; בסיס Berlin Group 1.0 מ־21/11/2022; הערות BOI הוסיפו גרסה 1.1 — **מאומת** — [PDF](https://boi.org.il/media/u05dooa3/boi-implementation-guidelines-securities-ais-v11.pdf)
- נקודות קצה (מהמסמך): `GET /v1/securities-accounts` (רשימה), `/v1/securities-accounts/{id}` (פרטים), `.../positions`, `.../transactions`, פרטי עסקה, `.../orders` ופרטי הוראה — **מאומת**
- שדות Position (מתוך המסמך): `financialInstrument` (חובה; כולל `isin` או `other`), `identification`, `externalIdentifier`, `safekeepingPlace`, `safekeepingCountry`, `balanceType`, `averageBuyingPrice`, `averageSellingPrice`, צבירת ריבית (`daysAccrued`); ישויות נוספות: Securities Transaction, Account Fee, Fee Rule, Order (עם Order Side) — **מאומת**
- הסכמה מותנית: הבנק קובע אם לחשוף; רבים מהשדות Optional/Conditional — **מאומת**
- הוראה 368 קובעת את התקן; חוזר 2658 דחה את מועד ני"ע ללא תאריך (ראו סעיף 1) — [boi 368](https://boi.org.il/media/ilopt5b2/368.pdf)

### Inferences
- שדה ISIN אופציונלי ומותנה, ולכן שיוך נייר ערך ישראלי יצריך גם מספר ני"ע (TASE) — ראו Riseup שמעביר `externalIdentifier` = מספר ני"ע בבורסה רק בחלק מהבנקים.

### Gaps
- אין סטטוס יישום פר בנק; לא נבדק בפורטל מפתחים של בנק כלשהו (פועלים: poalimdev.co.il קיים).

## 3. רישוי וגישה דרך בעל רישיון (B2B)

### Takeaway
רישיון ברשות ני"ע נדרש; פטור לבעלי רישיון שוק ההון לאשראי/פיקדון באישור המפקח. רשימת בעלי הרישיון מתפרסמת במרשם הרשות — לא נשלפה. אין ממצאים מאומתים על ספקי "API כשירות" שחושפים ני"ע.

### Cited Findings
- הרשות מנהלת מרשם ומפרסמת באתרה; פטור לבעלי רישיון מסוימים באישור המפקח הרלוונטי — **לא ודאי** (תקציר) — [פונדר](https://www.funder.co.il/article/133399)
- הרשות הוציאה כ־8 רישיונות (ידיעה ישנה; כנראה הרבה יותר היום) — **לא ודאי** — [חיפוש](https://www.timesofisrael.com/israels-fintech-community-readies-for-dramatic-changes-in-banking-sector)
- הוראה לחברות תשלום (הרשות, פורסמה 7/6/2026; טיוטה 1/2026): מאמצת Berlin Group לפי גרסת בנק ישראל; חובות חברות תשלום מתחילות 3 שנים מקבלת רישיון (חוק ההסדרים 2026); אין ני"ע במסמך — **מאומת** — [הרצוג](https://herzoglaw.co.il/en/news-and-insights/israel-securities-authority-publishes-directive-for-payment-companies-regarding-the-implementation-of-an-open-banking-standard/)

### Gaps
- הון/ביטוח/אגרות/משך תהליך — לא נבדקו בנוסח. רשימת הרישיונות והמחירים של Finanda/Salt Edge/Kesher לא נבדקו (לא נמצאה כל תשובה בחיפוש).

## 4. רייזאפ — האם נתוני ני"ע זמינים

### Takeaway
כן, אחזקות בלבד (לא עסקאות): `get_investments_data`, scope `savings-investments:read`, נתוני scrape כללי (בדר"כ יומי); רשימת הבנקים בתיעוד: leumi, poalim, discount, benleumi, otsar — **One Zero לא מוזכר**. **מאומת** מהקוד/התיעוד.

### Cited Findings
- חבילה `@riseup-oss/mcp`, MIT, גרסה אחרונה 0.10.0 (17/11/2026), ראשונה 0.1.0 (24/6/2026) — **מאומת** — [npm registry](https://registry.npmjs.org/@riseup-oss%2Fmcp), [GitHub](https://github.com/riseup-oss/mcp)
- הכלי `get_investments_data`: חשבונות ני"ע עם אחזקות (מניות, קרנות, מחקות, אג"ח), יחידות, מחיר קנייה ממוצע, שווי נוכחי — [README](https://raw.githubusercontent.com/riseup-oss/mcp/master/README.md)
- נקודת קצה `GET https://input.riseup.co.il/api/external/investments`; שדות: `bankIdentifier`, `positions[]` (`name`, `unitsNumber`, `externalIdentifier`, `balanceType`, `averageBuyingPrice`, `estimatedCurrentValue`), `investmentAccount`, `createdAt`; מכסה: 60 לדקה, 1000 ליום — [תיעוד investments](https://raw.githubusercontent.com/riseup-oss/mcp/master/docs/reference/investments.md), [rate-limits](https://raw.githubusercontent.com/riseup-oss/mcp/master/docs/rate-limits.md)
- יחידות מחיר קנייה משתנות לפי בנק (אגורות בפועלים/דיסקונט/בינלאומי, שקלים בלאומי); שווי נוכחי חסר בלאומי; אין עסקאות; מכסה רק בנקים שחוברו; חסרים בתי השקעות וברוקרים — **מאומת**
- חיפוש על One Zero + רייזאפ לא העלה אישור חיבור — **לא ודאי**

### Inferences
- עבור One Zero אין לרייזאפ כיסוי מאומת; גם אם יש, זה אחזקות בלבד, בלי עסקאות — אינו מספיק ל"דיוק מלא" (TWR וכו').

### Gaps
- האם One Zero ברשימת הבנקים של רייזאפ (נדרש לבדוק באפליקציה/תמיכה).

## 5. פיננסים פתוחים לבתי השקעות/ברוקרים/מוסדיים
### Takeaway
לא נמצא מקור על החלטה או מועד להרחבה לבתי השקעות וברוקרים.
### Gaps
- חיפוש בעברית לא החזיר שום פרסום על "פיננסים פתוחים" כמושג רגולטורי בישראל; המפקח ציין (11/2025) מעבר כספים לבתי השקעות מחוץ למערכת הבנקאית, בלי החלטה — [boi](https://boi.org.il/en/communication-and-publications/press-releases/4-11-25-ben/).

## 6. פינטק ישראלי שצורך ני"ע דרך בנקאות פתוחה
### Takeaway
הדוגמה היחידה בפועל: רייזאפ (אחזקות, לבנקים הגדולים). One Zero עצמו מצוטט כמי שמאפשר חיבור סוכני AI (ChatGPT/Claude) בהסכמת לקוח — **לא ודאי** (תקציר חיפוש; יש לבדוק את כתבת פונדר 206347/178037).
### Gaps
- לא אומת כתבות 2025–2026 נוספות; לא נמצא תיעוד API פומבי של One Zero.

## מסקנה מעשית
1. API לנתוני ני"ע מלאים (עסקאות) מ־One Zero: לא מאומת כקיים. 2. רייזאפ: אחזקות בלבד ולא ידוע ל־One Zero. 3. מסלול ישיר דורש רישיון ברשות ני"ע. 4. לפני החלטה: לשאול את One Zero ישירות ולבדוק את הצו העדכני.
