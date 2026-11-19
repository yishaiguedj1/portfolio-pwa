# מסלולים טכניים לא־רשמיים לנתוני ני"ע מ־One Zero ומבנקים ישראליים (נכון ל־18/11/2026)

הערת שיטה: קריאת קוד וסוכמי עמודים בלבד, בלי התחברות לשום שירות. חלק מהעמודים (הקוד המלא, ה־issues) נקראו דרך סיכום אוטומטי של הדף ולא בקריאה ישירה של הקוד, לכן רמת הוודאות מסומנת. לא נמצאו מקורות לכל השאלות; החסר מפורט ב"פערים".

## 1. israeli-bank-scrapers ו־One Zero

### Takeaway
סקרייפר One Zero קיים (מסומן "Experimental"), מאמת ב־SMS OTP ואז טוקן ארוך טווח, פונה ל־GraphQL, אבל מחזיר רק תנועות עו"ש ויתרה. אין בו שום תמיכה בני"ע. תמיכה בני"ע (לאומי־טרייד, בינלאומי) קיימת רק ב־PRs פתוחים שלא מוזגו. הסקרייפר שבור/לא יציב מול חסימת Cloudflare בשל טביעת TLS.

### Cited Findings
- README של הספרייה מונה את One Zero כ"OneZero (Experimental)", כסקרייפר עם אימות דו־שלבי, עם `triggerTwoFactorAuth(phoneNumber)` ואז `getLongTermTwoFactorToken(otpCode)`. סכמת התוצאה: חשבונות, יתרה (לא בכל החשבונות) ותנועות; אין שדות אחזקות — מאומת (סיכום README) — [README](https://github.com/eshaham/israeli-bank-scrapers)
- אימות בקוד `one-zero.ts`: שרת זהות `https://identity.tfd-bank.com/v1/`; `POST /devices/token` (extClientId `mobile`, os `Android`) מחזיר deviceToken; `POST /otp/prepare` (otpChannel `SMS_OTP`) מחזיר otpContext; `POST /otp/verify` מחזיר `otpToken` (הטוקן הארוך); `POST /getIdToken` (otpSmsToken, email, pass) מחזיר idToken; `POST /sessions/token` מחזיר accessToken — מאומת (סיכום קוד, לא ציטוט מילולי) — [one-zero.ts](https://raw.githubusercontent.com/eshaham/israeli-bank-scrapers/master/src/scrapers/one-zero.ts)
- נקודת הקצה לנתונים: GraphQL ב־`https://mobile.tfd-bank.com/mobile-graph/graphql` עם Bearer. שתי שאילתות: `GET_CUSTOMER` (portfolios → accounts) ו־`GET_MOVEMENTS` (portfolioId, accountId, language HEBREW, pagination cursor/limit 50) — מאומת (אותו מקור)
- שדות תנועה גולמיים: movementId, movementTimestamp, valueDate, bookingDate, movementAmount, movementCurrency, bankCurrencyAmount, conversionRate, creditDebit, description, runningBalance, isReversed, movementReversedId, movementType, וכן transaction.enrichment (קטגוריות, הוראות קבע) — מאומת (אותו מקור)
- "portfolio" בקוד הוא רק מיכל של חשבונות בנק; נעשה שימוש ב־`portfolio.accounts[0]` בלבד; אין שאילתת אחזקות/ני"ע — מאומת (אותו מקור)
- ה־issue #1081 "In-Bank Credit Cards, Other currencies and Investments" (נפתח 26/3/2026, לגבי לאומי) נסגר "not planned" ע"י בוט ב־10/6/2026 בלי תגובת מתחזקים; One Zero לא נדון — [issue](https://github.com/eshaham/israeli-bank-scrapers/issues/1081)
- יציבות One Zero: Cloudflare חוסם (403) את `https.request` של Node גם עם תעודת mTLS, לפי טביעת TLS (JA4 `t13d1513h1_8daaf6152771_eca864cca44a`, תואם Conscrypt של אנדרואיד) ו־User-Agent. PR #1209 (נפתח 23/10/2026) מחקה את הטביעה, משתמש בתעודת לקוח שחולצה מאפליקציית One Zero לאנדרואיד 4.7.0 ומחזיר idToken בתוקף 10 שנים כ"persistentOtpToken" — לפי טענות ה־PR עצמו, לא אומת מול השירות — [PR #1209](https://github.com/eshaham/israeli-bank-scrapers/pull/1209)
- סטטוס סותר של #1209: דף ה־PR והחיפוש מציגים אותו פתוח; דף issue #1158 מציין שהוא סגור כ"not planned" — [PR #1209](https://github.com/eshaham/israeli-bank-scrapers/pull/1209) מול [issue #1158](https://github.com/eshaham/israeli-bank-scrapers/issues/1158) — סותר
- issue #1158 (נפתח 20/8/2026, נסגר "not planned" 3/11/2026): הטוקן הנשמר (תיעוד מקורי: ~45 דקות, PR #760) מחזיר 401 לא ברור — [issue #1158](https://github.com/eshaham/israeli-bank-scrapers/issues/1158). סותר חלקית את הטענה ב־#1209 ל־idToken בן 10 שנים (שני טוקנים שונים: otpToken לעומת idToken) — לא ודאי
- issue #1144 (18/7/2026, פתוח): כשל אימות One Zero עם 403 של Cloudflare ב־fetch/Undici; PRs #1126/#1127/#1128 (תיקוני Cloudflare והוספת כרטיסי אשראי) נסגרו בלי מיזוג; #1172 (mTLS) ו־#1177 (idToken ארוך) פתוחים — [issues](https://github.com/eshaham/israeli-bank-scrapers/issues?q=securities+OR+investments+OR+portfolio+OR+%22one+zero%22+OR+onezero)
- ני"ע בבנקים אחרים בספרייה (כולם PRs פתוחים, לא ממוזגים, מבוססי נקודות קצה פנימיות של אתר הבנק):
  - לאומי־טרייד, PR #1166 (נפתח 10/9/2026): `GET /lti/lti-app/api/config` (רשימת תיקים), `GET /lti/lti-app/api/Trade/Statement?PortfolioIndex=…&ViewDate=…` (אחזקות ושווי תיק, `data.UserStatement`, `PortfolioValue`), `GET /lti/lti-app/api/Trade/GetOrdersHistory?portfolioIndex=&FromDate=&Todate=` (שדות: BasicReferenceNo, TypeOfOperation 1=קנייה 2=מכירה, ExecutableTotal, QuantityExecutionNominalVal). הכותב בדק על חשבונו — [PR #1166](https://github.com/eshaham/israeli-bank-scrapers/pull/1166)
  - הבינלאומי, PR #1190 (4/10/2026): תמונות מצב של מט"ח וני"ע מ־`online.fibi.co.il` / `apps.fibi.co.il`; שדות: כמות, מטבע, שווי שוק, מספר נייר בבנק, ISIN/סימול אופציונלי, מחירי יחידה ועלות מתואמת; ללא עלות כוללת. ה־PR מציין שאין חוזה API ציבורי — [PR #1190](https://github.com/eshaham/israeli-bank-scrapers/pull/1190)
  - אקסלנס Extrade Pro, PR #1131 (29/6/2026, פתוח) — כותרת בלבד; לא נקרא
  - לאומי, PR #1174 (10/9/2026) נסגר בלי מיזוג — כותרת בלבד
- RFC #1213 (25/10/2026): סקרייפרים HTTP טהורים בלי דפדפן ל־Cal, Max, Isracard, Amex, Pepper ו־OneZero — כותרת בלבד, לא נקרא

### Inferences
- סקרייפר One Zero מספק היום רק מה שה־GraphQL של האפליקציה מחזיר בשאילתת התנועות; האם ה־GraphQL הפנימי כולל שדות/שאילתות ני"ע (אפליקציית One Zero מציעה מסחר בני"ע בארה"ב לפי Globes) אינו ידוע — צריך עיון בשאילתות האפליקציה, שאסור לנו לבצע.
- התלות בתעודת mTLS שחולצה מה־APK, בזיוף טביעת TLS ובטוקן שפג היא ברמת ערעור גבוהה: שבירה צפויה בכל גרסת אפליקציה, והשימוש בתעודה עצמה מעלה סיכון משפטי נוסף (עקיפת מנגנון הגנה).
- המסלול של לאומי־טרייד/הבינלאומי מראה שני דפוסים אפשריים (REST פנימי עם סשן דפדפן), אך שניהם בני־יום ולא ממוזגים.

### Gaps
- הקוד של שאילתות GraphQL (`one-zero-queries`) לא נקרא; לא נבדק אם One Zero חושף ני"ע.
- לא נבדקו RFC #1213, PR #1131, #1174 במלואם.
- לא נבדק תאריך commit אחרון של הספרייה (README לא הציג).

## 2. פרויקטים פתוחים נוספים

### Takeaway
הפרויקטים שנמצאו (moneyman ואחרים) הם מעטפות סביב israeli-bank-scrapers ולכן יורשים אותה — אין בהם מסלול ני"ע עצמאי. לא נמצא פרויקט שנבדק שתומך בני"ע של One Zero.

### Cited Findings
- moneyman שואב נתונים דרך israeli-bank-scrapers, ושולח את הנתונים לגליון/יעדים אחרים; תומך ב־OTP דרך טלגרם — [moneyman](https://github.com/daniel-hauser/moneyman); תיעוד חיפוש: [תוצאות](https://github.com/shayki5/moneyman)
- חבילה אחרת (orla-il-banks) מסירה את One Zero מהתמיכה כי היא דורשת קוד בכל התחברות — מצוין בתוצאת חיפוש בלבד, דף החבילה לא נקרא — [socket.dev](https://socket.dev/npm/package/orla-il-banks) — לא ודאי
- פורקים/עטיפות נוספים קיימים (@accounter-toolkit/modern-israeli-bank-scrapers, KolShek, israeli-bank-mcp ועוד) — רק שמות מתוצאות חיפוש, לא נבדקו — [תוצאות חיפוש](https://www.jsdelivr.com/package/npm/@accounter-toolkit/modern-israeli-bank-scrapers)

### Inferences
- מי שרוצה ני"ע בישראל כיום תלוי בפורק/PR לא ממוזג, או בפענוח קבצים.

### Gaps
- לא נבדקו caspion, israeli-ynab-updater, יבואנים ל־actual/firefly, ו־Home Assistant — לא הספקתי; אין מידע.

## 3. סיכונים משפטיים

### Takeaway
חוק שירות מידע פיננסי (פורסם 18/11/2021, בתוקף מ־14/6/2022) מחייב רישיון של רשות ני"ע למי שמספק שירות מידע פיננסי, ולפי סיכומים משפטיים אוסר גישה באמצעות פרטי הגישה של הלקוח בידי מי שאינו בעל רישיון. נוסח הסעיף המדויק לא אומת. ההבחנה בין כלי מקומי אצל המשתמש לשרת שלנו שמחזיק פרטי גישה לא נמצאה במקור כתוב; ניתוח משפטי נדרש.

### Cited Findings
- החוק הסמיך את רשות ני"ע לתת רישיונות; פורסם 18/11/2021, תחילה 14/6/2022 (עם חריגים) — [המכלול](https://www.hamichlol.org.il/%D7%97%D7%95%D7%A7_%D7%A9%D7%99%D7%A8%D7%95%D7%AA_%D7%9E%D7%99%D7%93%D7%A2_%D7%A4%D7%99%D7%A0%D7%A0%D7%A1%D7%99) (דרך תוצאת חיפוש; העמוד עצמו החזיר 403), ו־[Funder](https://www.funder.co.il/article/126171)
- איסוף מידע לפי החוק נעשה דרך ממשק מקוון שמקור המידע חייב לספק, בהסכמת הלקוח — [גורניצקי](https://gornitzky.co.il/wp-content/uploads/pdf/post/20904_----------.pdf) (לפי סיכום חיפוש)
- תזכיר חוק (תיקון מס' 3, פברואר 2025) מתאר: החוק אוסר גישה באמצעות פרטי הגישה של הלקוח (שם משתמש וסיסמה) לצורך איסוף מידע על הלקוח, אלא אם נעשתה בידי בעל רישיון; ומציע תקופת מעבר של שנתיים שבה בעלי רישיון יוכלו לגשת גם בדרכים אחרות — [גורניצקי](https://www.gornitzky.co.il/wp-content/uploads/pdf/post/26877_----------.pdf) (מקור: סיכום חיפוש; ה־PDF עצמו לא נקרא, התוכן דחוס) — לא ודאי
- קטגוריית מעבר: גופים שלפני 18/11/2021 קיבלו מידע דרך גישה בפרטי לקוח — [Funder](https://www.funder.co.il/article/126171) (דרך סיכום חיפוש)
- לא ידוע אם תיקון 3 התקבל — לא ודאי

### Inferences
- כלי שרץ על המכשיר של המשתמש ומשתמש בפרטי הגישה שלו עצמו נראה קרוב יותר לשימוש אישי, אך נוסח האיסור ("לצורך איסוף מידע על הלקוח") עלול להיות רחב; לא אומת. שרת שלנו שמחזיק פרטי גישה של אחרים הוא הפעילות המסחרית שהחוק מכוון אליה ודורש רישיון ככל הנראה.
- עקיפת הגנות טכניות (תעודת mTLS מחולצת, זיוף טביעת TLS) מגדילה חשיפה מעבר לתנאי שימוש (חוק המחשבים 1995 — לא נבדק).

### Gaps
- נוסח סעיפי החוק לא נקרא בעצמו (נבו/רשומות). חוק המחשבים 1995, פסיקה על גרידה, ותנאי השימוש של One Zero — לא נמצאו; החיפוש החזיר תנאים של גורמים אחרים. יש להזמין חוות דעת משפטית.

## 4. פענוח קבצים (PDF, Excel)

### Takeaway
נמצא מעט: ל־pdf.js קיים באג פתוח על סדר מילים הפוך בעברית; מפענחי PDF ישראליים ב־Portfolio Performance לא נמצאו. SheetJS: מידע סותר על גרסה ורישיון.

### Cited Findings
- pdf.js issue #20097 "Hebrew word order is reversed" (נפתח 16/7/2025, תווית text-selection, 5 תגובות); פרטים לא נראו — [pdf.js](https://github.com/mozilla/pdf.js/issues?q=hebrew+rtl+text+order)
- Portfolio Performance מפעיל מפענח PDF נפרד לכל מוסד, 90+ מוסדות; מי שחסר מתבקש לספק דוגמאות — [תיעוד](https://help.portfolio-performance.info/en/reference/file/import/pdf-import/)
- לא נמצא מפענח ישראלי ב־Portfolio Performance — חיפוש בלבד, לא אומת בפורום — לא ודאי
- לאומי מציע הפקת אישור ניכוי מס (867) אונליין — [לאומי](https://www.leumi.co.il/he/Articles/43316)
- SheetJS: מקורות חיפוש מציגים npm `xlsx` ב־0.18.5 ("פורסם לפני 3 שנים", Apache-2.0) ואילו CDN רשמי של SheetJS מציג 0.18.7+; חבילת npm לא מעודכנת — [Snyk](https://snyk.io/advisor/npm-package/xlsx), [depscope](https://depscope.dev/api/check/npm/xlsx) — סותר/לא ודאי; יש לבדוק `npm view xlsx` וה־CDN

### Inferences
- נדרש טיפול מותאם לבעיית סדר ה־RTL בקוד שלנו (מיון לפי קואורדינטות x, הפיכת רצפי עברית) ובדיקה על דוגמאות סינתטיות בלבד.

### Gaps
- אין מקורות על מבנה טופס 867, אישורי ביצוע, דפי חשבון של One Zero; אין מידע על OCR עברי (Tesseract) בדפדפן.

## 5. תוסף דפדפן על סשן מחובר

### Takeaway
לא נמצא תקדים ישראלי. לא נמצא אם ל־One Zero יש אתר למחשב.

### Cited Findings
- חיפוש על אתר/כניסה למחשב ב־One Zero החזיר רק בנקים אחרים; אין מידע — [חיפוש](https://www.onezerobank.com/warehouse/userUploadFiles/Image/One%20Zero%202025%20FS%20-%20Translated.pdf) (דוח כספי בלבד, לא רלוונטי)
- הסקרייפר של One Zero מזהה את עצמו כלקוח אנדרואיד (`os: 'Android'`, תעודת mTLS של האפליקציה) — מאומת — [one-zero.ts](https://raw.githubusercontent.com/eshaham/israeli-bank-scrapers/master/src/scrapers/one-zero.ts); ו־[PR #1209](https://github.com/eshaham/israeli-bank-scrapers/pull/1209)

### Inferences
- הממשק הנחשף לסקרייפר הוא של אפליקציית המובייל, מה שמרמז שאין אתר אינטרנט שאפשר לתוסף לעבוד עליו — מסקנה לא מאומתת.

### Gaps
- אין מידע על אתר One Zero; אין תקדימי תוספים לבנקים ישראליים בנתוני החיפוש.

## 6. קבלת קובץ בנייד

### Takeaway
Web Share Target עם POST ו־multipart עובד ב־PWA מותקן; תמיכה ב־iOS לא אומתה.

### Cited Findings
- `share_target` דורש method POST, enctype `multipart/form-data` ו־`params.files` (name, accept עם סוג MIME וסיומת); ה־PWA חייב להיות מותקן; יש לקבל ב־service worker, לענות ב־303 ולאמת קלט; לשמור זמנית ב־Cache API/IndexedDB — [MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/share_target). MDN מסמן "ניסיוני, זמינות מוגבלת"

### Inferences
- תמיכה בכרום באנדרואיד ידועה לי מידע כללי, ולא ממקור שנבדק כאן. iOS Safari — לא ידוע לי על תמיכה; יש לאמת בטבלת התאימות. כסיבה חלופית: בחירת קובץ ידנית או Drive.

### Gaps
- קבלה מ־Drive/מייל לא נבדקה.
