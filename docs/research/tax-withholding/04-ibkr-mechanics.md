# מכניקת IBKR: מה צד שלישי רשאי לעשות בחשבון לקוח, דרך אילו תוכניות, ומה נדרש להצטרף (מצב ל־16/11/2026)

> העותק לריפו של מחקר 16/11/2026 — מחקר התנהגות בלבד, לא הועתקו טקסט, קוד או תבניות. שמות מסחריים הוחלפו בכינויים (שירות ה׳ = החברה שמנכה מס במקור ללקוחות IBKR; גוף ישראלי א׳ = הברוקר המציג הישראלי שהחשבונות יושבים תחתיו); מקורות מסחריים מצוטטים במזהה Wn, והמפה נשמרה מחוץ לריפו.

הערת שיטה: דפי התיעוד הרשמיים של IBKR (docs/web-api, ibkrcampus, ibkrguides) החזירו 403 ל־WebFetch ברוב המקרים; רק דף Flex ב־ibkrguides נטען במלואו. שאר הממצאים מבוססים על תקצירי חיפוש שמצטטים עמודי IBKR רשמיים (לא קראתי את העמודים עצמם), ולכן רובם מסומנים "מאומת (תקציר חיפוש)" ולא מאומת מלא. תאריכי הפרסום של הדפים לא נראו בתוצאות; יש לראות בהם "כפי שהוצגו ב־16/11/2026". לא בוצעה כל גישה לחשבון IBKR.

## 1. קריאת נתוני לקוח (Flex Web Service, Web API, הרשאות)

### Takeaway
אצלנו (Flex) הקריאה מבוססת טוקן+Query ID שהמשתמש יוצר; הטוקן תקף 6 שעות כברירת מחדל וניתן להאריכו (עד שנה לפי תקציר, לא ודאי), עם הגבלת IP אופציונלית. לצד שלישי מוסדר יש מסלול רשמי: Web API עם OAuth 1.0a בלבד, אחרי בדיקת נאותות של 3–6 שבועות והסכם חתום.

### Cited Findings
- מאומת: טוקן Flex תקף 6 שעות כברירת מחדל, ניתן לבחור תוקף אחר ברשימת "Should Expire After"; יצירת טוקן חדש מבטלת את הקיים; טוקן שפג מחזיר שגיאה 1012 "Token has expired." — [ibkrguides Flex Web Service](https://www.ibkrguides.com/advisorportal/ug/flex3.htm)
- מאומת: שדה "Valid For IP Address" מגביל את הטוקן לכתובת IP אחת; ריק = ללא הגבלה. בקשות תכנותיות חייבות לשלוח כותרת User-Agent; `v=3` בכתובת לגרסה 3 — [ibkrguides Flex](https://www.ibkrguides.com/advisorportal/ug/flex3.htm)
- לא ודאי: אורך תוקף מקסימלי של שנה (365 יום) — מופיע רק בעזרה של צד ג' (כלי דיווח זר 6) ובתקציר חיפוש — כלי דיווח זר 6 [W86]
- לא נמצא: מגבלות קצב (rate limits) של Flex ופירוט חשבונות מרובים/מאוחדים — הדף לא מציין; ראו Gaps — [ibkrguides Flex](https://www.ibkrguides.com/advisorportal/ug/flex3.htm)
- הערה: הגבלות IP של Web API (Settings → IP Restrictions) הן מנגנון נפרד מהטוקן של Flex — מאומת (תקציר חיפוש) — [IBKR Web API additional security features](https://www.interactivebrokers.com/docs/web-api/authentication/additional-security-features)
- מאומת (תקציר חיפוש): ספקי צד שלישי יכולים לבקש אישור רק ל־OAuth 1.0a; OAuth 2.0 מיועד למוסדות ולא זמין למבני חשבון Individual — [IBKR OAuth 1.0a third-party registration](https://www.interactivebrokers.com/docs/web-api/authentication/oauth-1a/third-party-oauth/registration-process), [OAuth 2.0 register](https://www.interactivebrokers.com/docs/web-api/authentication/oauth-2/register)
- מאומת (תקציר חיפוש): תהליך הרשמה: שאלון onboarding נשלח ל־webapionboarding@interactivebrokers.com; "enhanced due diligence" ואישור בשלוש שכבות, 3–6 שבועות; במקביל מפתחות ציבוריים ו־callback URL; אם Compliance מאשר, Legal מוציא "Web API agreement"; שינוי מהותי (למשל הוספת מסחר) דורש אישור מחדש — [Registration Process](https://www.interactivebrokers.com/docs/web-api/authentication/oauth-1a/third-party-oauth/registration-process)
- מאומת (תקציר חיפוש): IBKR מצפה מספקים של מסחר אוטומטי להחזיק רישום רגולטורי בכל אזור שבו הם משרתים (אלא אם יש חוות דעת משפטית) — [Trading Access for Third Parties](https://www.interactivebrokers.com/docs/web-api/trading/getting-started/trading-access-for-third-parties)
- לא נמצא: עלויות הצטרפות, scopes של "קריאה בלבד" ב־OAuth 1.0a, והאם מסלול קריאה-בלבד קל יותר מהמסלול הכולל מסחר.

### Inferences
- מסלול ה־Flex של המשתמש הוא הדרך היחידה שאינה דורשת אישור IBKR; אפליקציה שמבקשת טוקן ארוך תפעל, אך המשתמש צריך לחדשו (תוקף ו־IP נשלטים על ידו).
- חברה שמנכה מס במקור כנראה לא מסתמכת על Flex של הלקוח אלא על מסלול רשמי (IB/FA/OAuth) — ספקולציה.

### Gaps
- אין מקור על "Users & Access Rights" לקורא קריאה בלבד / גישת רואה חשבון, על כלי דיווח זר 19/כלי דיווח זר 20, ועל Flex ברמת master של IB/FA לכל תתי־החשבונות (נטען כי קיים, לא אומת). נדרש קריאה ישירה של ibkrguides.

## 2. חיוב כסף, העברת כסף ומכירת פוזיציות

### Takeaway
IB/FA יכולים לחייב עמלות בצורות מוגדרות (חיוב לפי חשבונית עם "invoice limit" שהלקוח מאשר, אחוז/סכום קבוע, markup), אך המסמכים שנבדקו לא הראו אפשרות לחיוב במטבע ILS ולא תיאור של שורה ב־Statement; משיכות לצד שלישי הן wire בלבד ובאישור IBKR.

### Cited Findings
- מאומת (תקציר): ניהול עמלות לקוח בלשונית Fee Administration; שיטות ל־IB: Invoicing, Fee Per Trade Unit, Interest Rate markups; תבניות ("templates") ניתנות להחלה לחשבון — [IBKR Campus: Introduction to Broker Client Fees](https://www.interactivebrokers.com/campus/trading-lessons/introduction-to-broker-client-fees/)
- מאומת (תקציר): חשבונית: לפני הגשה הלקוח חייב לאשר "invoice limit" (מקסימום לתקופה חודשית/רבעונית); חשבונית אחת ליום לחשבון לקוח; הסכום עובר מחשבון הלקוח לחשבון ה־master; אפשר CSV מרוכז — [IBKR Campus](https://www.interactivebrokers.com/campus/trading-lessons/introduction-to-broker-client-fees/)
- מאומת (תקציר): העלאת עמלה או שינוי סוג דורשים אישור הלקוח ב־Client Portal; הורדה מיידית; markup מוגבל לרוב ל־15 מכפלות עמלת IBKR (ניסוח שונה בעמוד אזורי — סותר חלקית) — [IBKR Campus](https://www.interactivebrokers.com/campus/trading-lessons/introduction-to-broker-client-fees/), [IBKR Ireland](https://www.interactivebrokers.ie/en/index.php?f=47977)
- מאומת (תקציר): אסטרטגיות עמלת יועץ (FA): אחוז שנתי מ־NLV, סכום שנתי קבוע, אחוז מרווח (P&L), חשבונית; Web API "Client Fees" ו־applyFeeTemplate — [Web API Client Fees](https://www.interactivebrokers.com/docs/web-api/account-management/account-information/client-fees)
- מאומת (תקציר): יועץ יכול לבחור לחייב עמלות עסקה בחשבון ה־master; אם יתרתו מתחת ל־1,000 USD החיוב חוזר ללקוח — [IBKR Campus](https://www.interactivebrokers.com/campus/trading-lessons/introduction-to-broker-client-fees/)
- מאומת (תקציר): "payment may be made in the form of check, or in the case of active accounts a debit to the account cash balance" (חיוב יתרת מזומן) — [IBKR Advisor Client Billing](https://www.interactivebrokers.ca/en/accounts/advisor-on-boarding.php)
- מאומת (תקציר): משיכה לצד שלישי: wire בלבד, דו־שלבית (אישור פרטי הנמען ואז בקשת משיכה, שניהם באישור IBKR); Registered Advisor יכול ליזום משיכה לצד שלישי על בסיס מידע שהלקוח הזין; IBKR בדרך כלל לא מאשרת השקעות פרטיות, פירעון הלוואות, תשלום עבור סחורות/שירותים — [IBKR KB: Withdraw Funds to a Third Party](https://ibkb.interactivebrokers.com/article/3475)
- מאומת (תקציר): Web API לצד שלישי כולל מסחר באישור נפרד ו־Compliance — [Trading Access for Third Parties](https://www.interactivebrokers.com/docs/web-api/trading/getting-started/trading-access-for-third-parties)
- ההשערה הקודמת "Other Fees ב־ILS" — לא אומתה ולא הופרכה: לא נמצא תיעוד על מטבע החיוב ועל הסיווג.

### Inferences
- חיוב ב־ILS בפועל כנראה דורש יתרת ILS או המרה; לא אומת. חיוב לפי חשבונית מתאים טכנית לניכוי חודשי (אך סכום מוגבל ב־invoice limit, חשבונית אחת ליום).
- מכירת פוזיציות לכיסוי מס דורשת הרשאת מסחר (FA/OAuth עם מסחר) — לא אומת במפורש.

### Gaps
- אין מקור על העברות פנימיות/Account Management API funds transfers, משיכה חוזרת קבועה, ועל הרשאת מסחר של צד שלישי בחשבון Individual קיים. IBKR מציינת הגבלות על Funding access right (לא אומת במפורש לקורא קריאה בלבד).

## 3. הופעת החיובים בדוחות ובשאילתות Flex

### Takeaway
לא אותר תיעוד שמגדיר את ערך Type/Description של עמלת יועץ או IB; רק שהקטע Cash Transactions הוא הכתובת וש־Cash Report כולל OtherFees. אין לאמת את "Other Fees ב־ILS".

### Cited Findings
- מאומת (תקציר): קטע Cash Transactions כולל Type, Symbol, Amount, DateTime, Description; Cash Report כולל שורת OtherFees — ib-flex FLEX_SETUP [W87], [Activity Flex Query Reference](https://guides.interactivebrokers.com/reportingreference/reportguide/activity%20flex%20query%20reference.htm)
- לא נמצא: ערכי Type מדויקים ל־Advisor/Client Fee ודוגמה פומבית מחשבון ישראלי.

### Inferences
- מומלץ לקרוא את העמוד הרשמי של Activity Flex Query Reference במלואו ולהשוות לדוגמת דוח אמיתית של משתמש (ללא פרסום נתונים).

### Gaps
- בדיקה מול Statement אמיתי עם ניכוי; אין עדות פומבית לתיאור ניכוי מס ישראלי בדוחות IBKR.

## 4. התאמת לוטים (FIFO)

### Takeaway
ברירת המחדל FIFO; ניתן לשנות ב־Tax Optimizer, השינוי חל על עסקאות עתידיות בלבד.

### Cited Findings
- מאומת (תקציר): "By default, the tax basis methodology is set to First In, First Out (FIFO)"; שינוי חל מיידית על עסקאות עתידיות בלבד — [IBKR KB: Cost Basis Reporting](https://ibkb.interactivebrokers.com/de/article/1448), [Tax Optimizer](https://www.interactivebrokers.co.uk/en/trading/tax-optimizer.php)
- מאומת (תקציר): קודים: HC=Highest Cost, LI=LIFO, ML=Maximize Losses, SL=Specific Lot (וכן MLG/MLL/MSG/MSL) — [IBKR codes](https://www.ibkrguides.com/reportingreference/reportguide/codes_default.htm)
- מאומת (תקציר): Specific Lot לא זמין כברירת מחדל לחשבון; מניות חלקיות חייבות בשיטת ברירת המחדל — [Tax Optimizer](https://www.interactivebrokers.co.uk/en/trading/tax-optimizer.php)
- סותר: דף KB ישן מונה רק FIFO/LIFO/Maximize Losses, ודפים עדכניים מונים יותר שיטות — [Cost Basis Reporting](https://ibkb.interactivebrokers.com/de/article/1448)

### Inferences
- זיהוי שיטה שאינה FIFO אפשרי בדוחות לפי הקודים; אכיפה ע"י IB/FA לא נבדקה.

### Gaps
- האם IB/FA יכול לנעול את השיטה ואילו שדות Flex מציגים אותה בדיוק — לא נבדק.

## 5. תוכניות והצטרפות (IB, FA, ספק) לישראלים

### Takeaway
IBKR מפעילה אתרי onboarding ל־Broker ול־Advisor; לא נמצאו דרישות רישוי ישראליות, הון מינימלי או חלוקת הכנסות. הדרישה שנמצאה: רישום רגולטורי לכל אזור שירות לספק מסחר אוטומטי.

### Cited Findings
- מאומת (תקציר): קיימים Broker Welcome Center ו־Advisor Welcome Center — [Broker onboarding](https://www.interactivebrokers.co.uk/en/accounts/broker-onboarding.php), [Advisor onboarding](https://www.interactivebrokers.ca/en/accounts/advisor-on-boarding.php)
- מאומת (תקציר): IBKR מצפה לרישום אצל רשויות פיננסיות בכל אזור שירות (או חוות דעת משפטית) — [Trading Access](https://www.interactivebrokers.com/docs/web-api/trading/getting-started/trading-access-for-third-parties)

### Gaps
- רישיון רשות ניירות ערך (ייעוץ/ניהול תיקים/שיווק), הון מינימלי, fully disclosed מול omnibus, מדריך שותפים — לא נמצאו מקורות.

## 6. ישראל: ישות, ILS ו־TASE

### Takeaway
הישות לפי תושבות; לא אומת איזו ישות משרתת תושבי ישראל. TASE: תושבי ישראל פרטיים כנראה אינם זכאים למסחר דרך IBKR.

### Cited Findings
- מאומת (תקציר): ישות החשבון נקבעת בדרך כלל לפי מדינת תושבות — [IBKR KB (Irish withholding)](https://ibkb.interactivebrokers.com/ja/node/4740); הטענה ש"ישראלים בישות האמריקאית" רק מפורום (לא ודאי)
- מאומת (תקציר, 2019): לקוחות מוסדיים בעולם ולקוחות פרטיים מחוץ לישראל יכולים לסחור ב־TASE; ישראלים רק תאגידים פטורי מס — [IBKR TASE KB](https://ibkb.interactivebrokers.com/ja/node/3382), [News @ IBKR 2019](https://www.interactivebrokers.com/en/general/communiques/2019/news-at-ibkr-02-2019-vol6.php) (ישן, יש לבדוק)
- לא ודאי: טענות ביחס לאמנות מס באתר תוכן 27 (אתר מסחרי).

### Gaps
- לא נמצאו הכרזות IBKR על ניכוי מס ישראלי או שותפים ישראליים; תמיכת ILS כמטבע מזומן והמרה לא אומתו בעמוד רשמי.

## 7. עדויות פומביות להופעת החיוב

### Takeaway
לא נמצאה.

### Gaps
- לא נמצאו פוסטים/צילומי מסך (פורום 2, פורום 4) על ניכוי מס ישראלי בדוחות. לא בוצע חיפוש ממוקד בפורומים בעברית (למשל כל־זכות / פורום 3).
