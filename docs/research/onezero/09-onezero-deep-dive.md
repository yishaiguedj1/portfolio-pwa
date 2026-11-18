# One Zero — סבב השלמה: דוחות ני"ע, ViewTrade, בנקאות פתוחה (מצב ל־18/11/2026)

> סבב ממוקד (כ־15 קריאות). מסקנה עיקרית: גם בסבב ההשלמה **לא נמצאה אף ראיה פומבית** לדוחות ני"ע, ל־867 או לייצוא של One Zero. הממצא החדש החשוב: ViewTrade היא ברוקר מציג (introducing) שמשתמש ב־Apex לסליקה ולמשמורת; ובתעריפון המצומצם של הבנק (7/2025) מופיעים "פירוט תיק ני"ע" ו"שחזור תנועות ני"ע" כשירותי מסמך — כלומר קיימים מסמכים כאלה לפחות בהפקה לפי בקשה.

## 1. חיפושי 867 / דוחות / ייצוא / חוויות משתמשים

### Takeaway
לא נמצא אזכור ל־867, דוח שנתי, אקסל או אישור ביצוע של One Zero בשום מקור פומבי נגיש (חיפושים בעברית ובאנגלית, hasolidit, Reddit). הוכחה בהיעדר — לא ראיה שאין.

### Cited Findings
- חיפוש "וואן זירו טופס 867" החזיר רק דיוני 867 כלליים ב־hasolidit ומדריך כללי; אף אחד לא מזכיר One Zero (מאומת כהיעדר תוצאות, 18/11/2026) — [hon.co.il](https://www.hon.co.il/?p=285345), [hasolidit](https://www.hasolidit.com/kehila/threads/%D7%98%D7%95%D7%A4%D7%A1-867-%D7%95%D7%94%D7%A6%D7%94%D7%A8%D7%AA-%D7%94%D7%95%D7%9F.19898/latest)
- כלל כללי: 867 מופק לרוב עד סוף מרץ, כל גוף מנפיק בנפרד, והוא סיכום מס ולא יומן עסקאות — [hon.co.il](https://www.hon.co.il/?p=285345)
- חיפוש Reddit/r/IsraelFinance על One Zero + 867 לא החזיר שרשור רלוונטי (החיפוש אינו מאנדקס Reddit היטב — לא ודאי) — חיפוש WebSearch, 18/11/2026
- מקורות כלליים על דיווח למס ברוקר זר (טפסים 1322/1325) — לא קשורים ל־One Zero — [hasolidit](https://www.hasolidit.com/kehila/threads/%D7%94%D7%92%D7%A9%D7%AA-%D7%93%D7%95%D7%97-%D7%A9%D7%A0%D7%AA%D7%99-%D7%A8%D7%95%D7%95%D7%97%D7%99-%D7%94%D7%95%D7%9F-%D7%90%D7%A6%D7%9C-%D7%91%D7%A8%D7%95%D7%A7%D7%A8-%D7%96%D7%A8-ib.20859/)

### Inferences
- שום ראיה שהבנק מנפיק 867 אוטומטית; בהינתן שהוא בנק ישראלי שמנכה מס במקור (לא אומת), הוא כנראה חייב להנפיק — אך זו הנחה.

### Gaps
- אין דוגמת דוח, אין תיאור שדות, אין ביקורות שמתארות ייצוא. נדרש אימות מול הבנק/משתמש.

## 2. דף האפליקציה (App Store / Google Play)

### Takeaway
היסטוריית הגרסאות מזכירה ני"ע רק כיכולת מסחר; אין אזכור לדוחות, מסמכים, 867 או ייצוא. Google Play לא נבדק (אין גישה).

### Cited Findings
- גרסאות 4.2.0–4.2.2: "השדרוגים האחרונים … ניירות ערך"; 4.1.1: מניות כחול לבן, מסחר בני"ע ישראלים; 4.5.0/4.5.1: קרנות איריות ופתיחת מסחר 11:00; 3.12–3.13: מסך "ההון שלי" מציג מידע מחשבון One Zero. אין אזכור דוחות/ייצוא — [App Store](https://apps.apple.com/il/app/one-zero/id1554109300?l=he)
- ביקורת מ־15.10.2024: בקשה לגישה לפורטל דרך דפדפן רגיל והעתקת ערכים; אין אזכור דוחות — [App Store](https://apps.apple.com/il/app/one-zero/id1554109300?l=he)

### Gaps
- Google Play לא נבדק; "מה חדש" באנדרואיד עשוי להיות שונה.

## 3. ViewTrade — מבנה חשבונות ודוחות

### Takeaway
ViewTrade Securities היא ברוקר מציג שאינו סולק; הסליקה והמשמורת אצל Apex Clearing. מי הלקוח של ViewTrade (הבנק מול הלקוח הקצה) לא תועד פומבית, ולכן גם מי שולח 10b-10/דף חשבון/1099 לא ידוע.

### Cited Findings
- ViewTrade נבחרה במאי 2023 כשותפת ברוקר וטכנולוגיה; One Zero משתמש ב־API וב־FIX של ViewTrade לאפליקציה; מסחר ב־NYSE/NASDAQ בחשבון מט"ח או שקל — [viewtrade.com](https://www.viewtrade.com/?p=909), [Mondo Visione](https://mondovisione.com/news/viewtrade-chosen-by-israels-one-zero-digital-bank-as-technology-partner-for-sec-202358)
- בתיעוד הרגולטורי של ViewTrade: חברה מציגה שאינה מבצעת סליקה; חברת הסליקה Apex Clearing Corporation (דאלאס) מנהלת את חשבונות הלקוחות ומשמורת — [ViewTrade](https://viewtrade.com/?p=327), [BrokerCheck CRD 46987](https://brokercheck.finra.org/firm/46987), [Groww](https://groww.in/help/us-stocks/my-us-stocks-account/where-is-my-us-stocks-account-held--who-is-responsible-for-custody-and-clearing--91) (המקור של Groww נוגע ללקוח אחר של ViewTrade — אינדיקציה לדגם בלבד)
- הודעת FINRA SD-2432 (ספטמבר 2025) בעניין המשך חברותה של Apex לאחר צו SEC מ־14/8/2024 — [FINRA](https://www.finra.org/sites/default/files/2025-09/SD-2432_Apex-Clearing-Corporation_20250903.pdf)

### Inferences
- כנראה שרשרת: לקוח One Zero ← One Zero ← ViewTrade (מציג) ← Apex (סליקה/משמורת). אם ה־omnibus ברמת הבנק, דפי חשבון/1099 של Apex יופנו לבנק ולא ללקוח קצה (לא ודאי). לכן הדוחות שהלקוח רואה מפיק הבנק עצמו.

### Gaps
- לא נמצא: fully disclosed או omnibus; פורטל/API דוחות לשותפים של ViewTrade (Orbis וכו'); האם נשלחים 10b-10/FINRA 2231/1099/1042-S ללקוח קצה; האם Apex הוא עדיין הסולק ב־2026.

## 4. בנקאות פתוחה

### Takeaway
לא נמצא פורטל מפתחים ציבורי נגיש עם API ני"ע. קיים דף "פורטל מפתחים" באתר הבנק (חסום לבוט). בנקאות פתוחה בישראל ממילא מוסדרת בהוראה 368 ובחוק שירות מידע פיננסי 2021, והגישה למורשים בלבד.

### Cited Findings
- דף פורטל מפתחים: `https://www.onezerobank.com/lp/one_zero_dev_portal/` (אינדקס API Evangelist; הדף עצמו החזיר 403 ולא נקרא) — [API Evangelist](https://providers.apievangelist.com/providers/one-zero/)
- באינדקס לא נמצאה מפרט API (OpenAPI); גישה ל־API חשבונות לספקי שירות מידע מורשים בלבד — [API Evangelist](https://providers.apievangelist.com/providers/one-zero/)
- Open Banking Tracker: לא רשומים מוצרי API ל־One Zero (לפי תקציר החיפוש, הדף עצמו נחסם 429) — [openbankingtracker](https://openbankingtracker.com/provider/one-zero-digital-bank-ltd-il)
- הוראה 368 בתוקף מ־14/6/2022, מבוססת API — [בנק ישראל](https://boi.org.il/media/cstjoh2y/h2739.pdf)

### Gaps
- אילו API (חשבונות/כרטיסים/ני"ע), מי מחובר, הכללה ברשימת מקורות מידע של ספקי שירות מידע — לא נמצא.

## 5. Riseup ואגרגטורים

### Takeaway
אין ראיה לתמיכה של Riseup או של אגרגטור אחר ב־One Zero.

### Cited Findings
- חיפושים לא מצאו קשר בין Riseup ל־One Zero; ההודעה היחידה של Riseup היא שותפות עם Yapily (בנקאות פתוחה) — [Yapily](https://www.yapily.com/blog/riseup-partners-with-yapily/)
- חיפוש ריפו `riseup-oss` לא החזיר תוצאה; לא נבדק ישירות ב־GitHub בסבב הזה — חיפוש רשת, 18/11/2026

### Gaps
- רשימת הבנקים הנתמכים של Riseup, פיננדה ואחרים — לא נבדקה (דפי תמיכה לא אותרו). מומלץ לבדוק ישירות ריפו ב־GitHub.

## 6. דיווחים כספיים

### Takeaway
נמצאו רק כתבות עיתונאיות; לא אותרו דוחות מאיה/בנק ישראל עם תיאור שירות ני"ע.

### Cited Findings
- הכנסות 109 מיליון ₪ (+100%), 200 אלף לקוחות, תיקי ני"ע +151% — [Bizportal](https://www.bizportal.co.il/capitalmarket/news/article/20039704), [ICE](https://www.ice.co.il/finance/news/article/1107960)
- מסלול One+: 10 פעולות ני"ע בחודש (Globes, 17/12/2024) — [Globes](https://en.globes.co.il/en/article-one-zero-offers-forex-securities-commissions-exemption-1001496952)

### Gaps
- הדוחות הרשמיים והתיאור של שותפים/משמורן — לא נקראו.

## 7. תעריפון

### Takeaway
בתעריפון המצומצם (בתוקף 1/7/2025) מופיעים כשירותי מסמך: אישור יתרה, פירוט פרעון הלוואה, **פירוט תיק ניירות ערך**, **שחזור תנועות ניירות ערך**, אישור בעלות; הפקה/הדפסה ממאגר ממוחשב; חיפוש מסמך כפריט נפרד. סכומים לא נקראו (הקובץ מחזיר 403; לא עוקפים).

### Cited Findings
- (תקציר חיפוש בלבד, לא קריאת הקובץ) — [תעריפון מצומצם](https://www.onezerobank.com/warehouse/userUploadFiles/Image/%D7%AA%D7%A2%D7%A8%D7%99%D7%A4%D7%95%D7%9F%20%D7%A2%D7%9E%D7%9C%D7%95%D7%AA%20%D7%9E%D7%A6%D7%95%D7%9E%D7%A6%D7%9D_announcement.pdf), [תנאי מסלולים](https://www.onezerobank.com/warehouse/userUploadFiles/Image/%D7%AA%D7%A0%D7%90%D7%99%D7%9D%20%D7%9E%D7%A9%D7%A4%D7%98%D7%99%D7%99%D7%9D-%D7%A2%D7%9E%D7%9C%D7%95%D7%AA%20%D7%95%D7%9E%D7%A1%D7%9C%D7%95%D7%9C%D7%99%D7%9D_announcement.pdf)

### Inferences
- הבנק מנפיק "שחזור תנועות ני"ע" כמסמך לפי בקשה (אולי בתשלום) — כנראה מקור הנתונים האמין ההיסטורי. מאומת רק ברמת רשימת שירות, לא תוכן/פורמט.

### Gaps
- סכומים; האם 867 מופיע בתעריפון; תעריפון ני"ע מלא; לא ודא קריאת הקובץ המלא.

## המלצה
לבקש מהמשתמש (בלי להעלות לריפו): PDF לתנועות/אחזקות/שחזור תנועות ני"ע מהאפליקציה, ו־867, ולשאול בצ'אט על ייצוא ועל מי מנפיק 10b-10/1099.
