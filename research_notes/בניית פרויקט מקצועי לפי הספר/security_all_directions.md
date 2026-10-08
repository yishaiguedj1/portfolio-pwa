# אבטחה "מכל הכיוונים האחרים" — השלמה לחקר ארכיטקטורת האבטחה של THE SNOWBALL (08/10/2026)

> היקף: מה שהחקר המקביל **לא** מכסה (נכסים קריטיים, STRIDE ברמת מערכת, הקשחת חשבונות/זהות, הקשחת שרת ורשת, ניהול סודות, שרשרת אספקה, הזרקת פרומפטים לסוכן, משטח התקיפה של לוח הבקרה, מפת דרכים). כאן: 12 כיוונים + רשימת עדיפויות אחת.
> סימונים: **[קוד]** = נבדק בעיניים בקובץ בריפו (קריאה בלבד, קומיט `6a8cc98`). **[ראשי]** = מקור רשמי (MDN, RFC, Google, GitHub). **[משני]** = בלוג/ספק/סיכום — לאמת לפני הסתמכות. בלי מספרים אישיים, בלי סודות.
> לכל כיוון: מה הסיכון → איך זה אצלנו (ראיות) → מה עושים המקצוענים → התיקון בגודל הנכון → עדיפות (עכשיו / כשהשרת עולה / כשגדלים) + מי מבצע (**בעלים** = המשתמש בעצמו, **AI** = Claude יכול לממש).

## 1. אבטחת האפליקציה בדפדפן (XSS, CSP, Service Worker, אחסון, origin משותף, clickjacking, EPUB, OAuth)

### השורה התחתונה
הבסיס טוב מהממוצע (CSP בלי `unsafe-inline` לסקריפטים, hash לסקריפט המוטבע, `object-src 'none'`, שומר XSS ב־CI). החורים: אין הגנת clickjacking ואי אפשר להוסיף אותה ב־GitHub Pages דרך meta; `connect-src` כולל תווים כלליים רחבים (`*.vercel.app`); שומר ה־XSS לא סורק את `library.js`/`studio.js`; ה־iframe של קורא הספרים מבוטל־sandbox בפועל וההגנה נשענת רק על ה־CSP; ה־OAuth בלי PKCE ועם `Math.random`.

### ממצאים עם מקורות
- OWASP Top 10:2025 (סופי): A01 Broken Access Control (כולל עכשיו SSRF), A02 Security Misconfiguration, A03 Software Supply Chain Failures (חדש), A04 Cryptographic Failures, A05 Injection, A06 Insecure Design, A07 Authentication Failures, A08 Software or Data Integrity Failures, A09 Security Logging & Alerting Failures, A10 Mishandling of Exceptional Conditions (חדש) — [ראשי: OWASP Top 10:2025](https://owasp.org/Top10/2025/0x00_2025-Introduction/); [משני: Fastly](https://www.fastly.com/blog/new-2025-owasp-top-10-list-what-changed-what-you-need-to-know)
- **CSP אצלנו** [קוד: `index.html`]: `script-src 'self' 'sha256-…' https://www.gstatic.com https://apis.google.com` (בלי `unsafe-inline`/`unsafe-eval` — טוב); `style-src 'self' 'unsafe-inline' blob:` (חלש יותר, סיכון נמוך); `connect-src` כולל `https://*.vercel.app` ו־`https://*.googleapis.com`; `frame-src blob: …firebaseapp.com accounts.google.com …`; `object-src 'none'; base-uri 'self'; form-action 'self'`; **אין `frame-ancestors`**.
- `frame-ancestors` **לא נתמך** כשה־CSP מגיע ב־`<meta>`: "This directive is not supported in the `<meta>` element" — חייב כותרת HTTP — [ראשי: MDN frame-ancestors](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors)
- **sandbox של iframe**: MDN: כשהמסמך המוטמע מאותו origin, "strongly discouraged to use both `allow-scripts` and `allow-same-origin`… making it no more secure than not using the sandbox attribute at all" — [ראשי: MDN iframe](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe). אצלנו מנוע הקורא מגדיר בדיוק את זה: `iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts')` [קוד: `vendor/foliate-js/paginator.js:244`, `fixed-layout.js:86`]. ההגנה בפועל על סקריפט בתוך ספר = ה־CSP שעובר בירושה למסמכי blob (נאכף ב־`tests/library-v302.test.js` לפי CLAUDE.md §16).
- **שומר XSS** [קוד: `tests/xss-guard.test.js`]: סורק רק `app.js` ו־`cloud.js` (לולאה `for (const file of ['app.js', 'cloud.js'])`) בביטוי רגולרי היוריסטי לשדות "חיצוניים". ב־`app.js` יש 103 שימושים ב־`innerHTML`, ב־`library.js` 42, ב־`studio.js` 1 [קוד: ספירה ב־grep]. `library.js`/`studio.js` בונים רוב ה־DOM דרך עוזר `h()` עם `textContent` [קוד: `library.js:621`, `studio.js:822`] — בטוח מטבעו, אבל 42 ה־`innerHTML` בספרייה לא נבדקו בחקר זה ולא נסרקים ב־CI.
- **Service Worker** [קוד: `sw.js`]: בקשות לצד שלישי נשמרות במטמון רק ממארחים ברשימה `RT_HOSTS` עם תבנית נתיב (לוגואים, `www.gstatic.com/firebasejs/`) — זה מצמצם הרעלת מטמון; מטמון התוכן לפי `CACHE_NAME`. ה־SW יורש את היקף `/portfolio-pwa/`.
- **localStorage** [קוד: `app.js:1736`, `:4541`]: `pwa_ibkr_v1` (כולל token ה־IBKR לפי CLAUDE.md §3/§15) ותיק ההשקעות ב־localStorage; כל סקריפט שרץ על `yishaiguedj1.github.io` (כל ריפו Pages של אותו משתמש) קורא אותו — CLAUDE.md §15 כבר מזהה את זה.
- **OAuth של Drive** [קוד: `libbackup.js:133`, `oauth.js`]: `state = Math.random().toString(36)…` (לא `crypto.getRandomValues`); אין `code_challenge` (PKCE) בשום מקום (`grep -c code_challenge` = 0 ב־`libbackup.js` וב־`ibkr-proxy/lib/gdrive.js`); הקוד מועבר לחלון האפליקציה ב־`BroadcastChannel` ובגיבוי ב־`localStorage` (`pwa_oauth_v1`). ההחלפה לטוקן בשרתון עם client secret (לקוח "חסוי").
- RFC 9700 (BCP של OAuth 2.0): ללקוח ציבורי PKCE **חובה**; ללקוח חסוי PKCE **RECOMMENDED** נגד הזרקת/גניבת קוד הרשאה; שיטה `S256` — [ראשי: RFC 9700](https://www.rfc-editor.org/rfc/rfc9700.html)

### הסקות
- **Clickjacking**: אפשר להטמיע את האפליקציה בתוך iframe באתר זדוני ולגרום ללחיצה על "ניתוק"/"איפוס"/אישור Google. ב־GitHub Pages אין דרך לשלוח כותרות HTTP מותאמות (ידוע; **לא אומת בחיפוש זה**) — לכן עכשיו: סקריפט "frame-busting" קטן (`if (top !== self) …` + הסתרת הגוף עד בדיקה) + בדיקה ב־CI; כשהאתר עובר לשרת/Cloudflare — כותרת `Content-Security-Policy: frame-ancestors 'none'` (או `'self'`). עדיפות: **עכשיו, AI**.
- **צמצום `connect-src`**: `*.vercel.app` מאפשר לסקריפט מוזרק לשלוח נתונים לכל אפליקציה בוורסל — כולל של תוקף. להחליף בכתובת המדויקת של השרתון; `*.googleapis.com` → רשימת תת־מארחים בשימוש. זה לא מונע XSS, אבל סוגר את ערוץ ההוצאה. **עכשיו, AI** (+ עדכון `tests/csp.test.js`).
- **שומר XSS**: להרחיב ל־`library.js`, `studio.js`, `studionet.js`; טוב יותר — כלל: אסור `innerHTML` עם משתנה אלא דרך `esc()`/`h()` (בדיקה סטטית פשוטה), ובהמשך Trusted Types ב־CSP (`require-trusted-types-for 'script'`) — כבד יותר, רק אם הקוד מתאים. **עכשיו (הרחבה), כשגדלים (Trusted Types), AI**.
- **קורא EPUB**: שכבת הגנה שנייה: בעת ייבוא — ניקוי `<script>`, מאפייני `on*`, `javascript:` מהקובץ לפני שמירה (כך גם אם ה־CSP יוחלש פעם, הספר "נקי"). ובטווח הבינוני — כפי ש־CLAUDE.md §15 ממליץ — תוכן חיצוני על origin נפרד. **עכשיו (ניקוי), כשגדלים (origin נפרד), AI**.
- **OAuth**: `crypto.getRandomValues` ל־state + PKCE S256 (הלקוח שומר verifier, השרתון שולח אותו בהחלפה). שינוי קטן, עקבי עם RFC 9700. **עכשיו, AI**.
- **localStorage מול IndexedDB**: מבחינת XSS אין הבדל — שניהם נגישים לכל סקריפט באותו origin. ההגנה האמיתית = לא לשמור את ה־token בטלפון בכלל (הסנכרון ברקע כבר שומר אותו מוצפן בשרתון — v311) והפרדת origin. שווה לבחון: אחרי הפעלת "סנכרון אוטומטי" למחוק את ה־token מהטלפון. **כשגדלים, החלטת בעלים + AI**.

### פערים
- לא בדקתי אחד־אחד את 42 שימושי `innerHTML` ב־`library.js`.
- לא אימתתי במקור רשמי שב־GitHub Pages אי אפשר להגדיר כותרות (ידע כללי).
- OWASP ASVS 5.0 — לא נשלף בחקר זה; הפרקים הרלוונטיים (V3 Web Frontend, V10 OAuth) לא צוטטו.

## 2. חשבונות משתמשים והרשאות (Firebase Auth, כללי Firestore, בידוד בין משתמשים, מכשיר משותף, מנהלים)

### השורה התחתונה
בצד השרתון האימות טוב: חתימת ה־ID token נבדקת ו־`email_verified` נדרש לכל רשימת הרשאות. החולשה המרכזית: **כללי האבטחה של Firestore לא בריפו** — אין גרסאות, אין בדיקות, אין CI. ותפקיד "מנהל" מוגדר במשתמע (המייל הראשון ברשימה).

### ממצאים עם מקורות
- [קוד: `ibkr-proxy/lib/gauth.js:42,50,90`] `verifyIdToken` מחזיר `verified: !!claims.email_verified`; `readerAllowed` ו־`isAdmin` דורשים `verified`; `ibkr-sync.js:134` ו־`studio.js:36` גם כן.
- [קוד: `ibkr-proxy/lib/gauth.js:48`] "מנהלי הספרייה — `LIBRARY_ADMINS`, ואם לא הוגדר: המייל הראשון ב־`LIBRARY_READERS`".
- [קוד: שורש הריפו] אין `firestore.rules` ואין `firebase.json`. CLAUDE.md §14 עצמו מסמן "המלצה פתוחה: לוודא שבכללי Firestore הלקוח ניגש רק ל־`users/{uid}` — `studioJobs`/`studioVault` רק דרך חשבון השירות".
- [קוד: CLAUDE.md §3, v313] היסטוריית באג הפרדת חשבונות במכשיר אחד; תוקן ב־`accountSwitchTo` + `ACCOUNT_KEYS` + `tests/account-v313.test.js`.
- `@firebase/rules-unit-testing` + Emulator: `assertFails` מוודא שבקשה נדחית ב־permission denied; רק הספרייה הזו יודעת לדמות משתמש מחובר בתוך הכללים — [ראשי: Firebase rules-unit-testing](https://firebase.google.com/docs/reference/emulator-suite/rules-unit-testing/rules-unit-testing); [ראשי: Build unit tests](https://firebase.google.com/docs/rules/unit-tests)
- הגנת מניית מיילים (email enumeration protection) מופעלת כברירת מחדל רק בפרויקטים שנוצרו **ב־15/09/2023 ואילך**; ישנים — צריך להפעיל ידנית — [ראשי: Identity Platform](https://docs.cloud.google.com/identity-platform/docs/admin/email-enumeration-protection); [משני: Firebase ב־X](https://x.com/Firebase/status/1724128750491611144)
- App Check (reCAPTCHA Enterprise לווב): רושמים אפליקציה, מתחילים במעקב מדדים ורק אז אוכפים לכל מוצר; לשרת משלך — הלקוח שולח `X-Firebase-AppCheck` והשרת מאמת ב־Admin SDK — [ראשי: App Check custom backend](https://firebase.google.com/docs/app-check/custom-resource-backend); [ראשי: reCAPTCHA Enterprise provider](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider)

### הסקות
- **כללי Firestore כקוד**: להעתיק את הכללים מהמסוף ל־`firestore.rules` בריפו + בדיקות Emulator: משתמש A לא קורא/כותב את `users/B`; אף לקוח לא נוגע ב־`studioJobs`, `studioVault`, `ibkrVault`, `driveVault`, `studioDrive`, `aiCache`, `aiUse`, `academy/config`; שדה `lib` נכתב רק לבעליו. הרצה ב־CI (Emulator = Java + firebase-tools). **עכשיו: AI כותב קובץ+בדיקות; בעלים מעתיק את הכללים מהמסוף ומאשר פריסה** (הפריסה למסוף — ידנית או `firebase deploy --only firestore:rules` מטוקן נפרד).
- **אימות התחברות**: הכניסה היא Google בלבד (לפי הקוד) — מניית מיילים פחות רלוונטית, אבל לבדוק במסוף שאין ספק "סיסמה" פעיל שלא בשימוש, ושה־Authorized domains כוללים רק את הדומיין החי (+localhost לפיתוח). **עכשיו, בעלים (5 דק')**.
- **מנהל במפורש**: להגדיר `LIBRARY_ADMINS` ב־Vercel כדי שסדר רשימה לא יקבע הרשאות. **עכשיו, בעלים**.
- **מכשיר משותף**: הקוד כבר מפריד בעלים (v313). להוסיף: ביציאה מהחשבון — שאלה "למחוק את הנתונים מהמכשיר?" (כרגע הנתונים נשמרים במחסן מקומי `pwa_stash_v1:<uid>` — נוח לבעלים, אבל במכשיר שאול נשאר עותק). **כשגדלים, AI**.
- **App Check**: הדרך המקצועית לומר "רק האפליקציה שלי" במקום Origin (שמזויף בקלות מחוץ לדפדפן). לא חסין לגמרי, אבל מעלה את הרף. **כשגדלים / כשהשרת עולה, בעלים (מסוף) + AI (קוד)**.

### פערים
- לא ראיתי את הכללים בפועל במסוף — אי אפשר לקבוע אם הם תקינים.
- לא בדקתי אם `email_verified` של חשבונות Google תמיד true (בדרך כלל כן) — לא קריטי.

## 3. שימוש לרעה ב־API ובשרתון (ולידציה, הגבלת קצב, Origin, SSRF, הודעות שגיאה, לוגים)

### השורה התחתונה
ולידציה וגבולות גודל קיימים; הגבלת קצב היא "במאמץ הטוב" בזיכרון של כל מופע; בדיקת Origin היא הגנה מפני דפדפנים בלבד. נמצאו: SSRF "חצי פתוח" בהבאת כריכות (בדיקת היעד **אחרי** שההפניה כבר בוצעה), מצבי אבחון בתרגום שזמינים לכל מי שמזייף Origin, ושליפת IP שתהיה ניתנת לזיוף כשעוברים לשרת עצמאי.

### ממצאים עם מקורות
- [קוד: `ibkr-proxy/lib/ibkr.js:55-110`] `guard`: Origin מאושר (`https://yishaiguedj1.github.io` + localhost), POST בלבד, `X-App-Key` רק אם `APP_KEY` מוגדר, גוף ≤4096; ההערה בקוד עצמה: "Origin ניתן לזיוף מחוץ לדפדפן; המפתח לא". `X-Content-Type-Options: nosniff`, `Cache-Control: no-store`.
- [קוד: `ibkr.js:111-119`] `rateLimited`: מפה בזיכרון, 20 בקשות לדקה ל־IP, "best effort on serverless" (כל מופע סופר לבד; מתאפס בהפעלה קרה).
- [קוד: `api/translate.js`, `api/bookmeta.js`] ה־IP נלקח מהערך **השמאלי** של `x-forwarded-for`.
- Vercel מחליף את `x-forwarded-for` הנכנס (מונע זיוף) — אלא אם יש פרוקסי משלך לפניו; קיימת גם `x-vercel-forwarded-for` — [ראשי: Vercel request headers](https://vercel.com/docs/headers/request-headers); [משני: דיון קהילה](https://github.com/vercel/community/discussions/2484). הערך השמאלי הוא זה שהלקוח שולט בו כשאין מחליף — [משני: HTTP Toolkit](https://httptoolkit.com/blog/what-is-x-forwarded-for/)
- [קוד: `api/bookmeta.js` `op:'cover'`] `coverAllowed(url)` (https + רשימת מארחים) נבדק לפני הבקשה, אבל הבקשה רצה עם `redirect: 'follow'` ו־`r.url` נבדק **אחרי** — כלומר הבקשה ליעד ההפניה כבר נשלחה. יש בדיקת סוג תוכן (`image/*`) וגודל.
- [קוד: `api/translate.js:173-176`] `mode:'mistralProbe'` ו־`mode:'storeProbe'` מחזירים אבחון חשבון Mistral/מטמון — מוגנים רק ב־`guard` (Origin) והגבלת IP, בלי התחברות.
- [קוד: `api/translate.js:74,90`] שדה `diag` מחזיר עד 160 תווים מהודעת השגיאה של הספק.
- [קוד: grep] אין `console.log/error` ב־`ibkr-proxy/api` ו־`lib` — אין לוגים עם מידע אישי (טוב לפרטיות), אבל גם אין אות זיהוי (ראו §12).
- OWASP Top 10:2025 צירף את SSRF ל־A01 — [ראשי: OWASP](https://owasp.org/Top10/2025/0x00_2025-Introduction/)

### הסקות
- **Origin ≠ אימות**. ומפתח `APP_KEY` שיושב בקוד הלקוח הוא ציבורי מעצם הגדרתו (כל מי שפותח את האתר רואה אותו) — כלומר גם הוא לא היה אימות אמיתי. ההחלטה של 25/09/2026 לא להגדיר אותו סבירה; ההגנה האמיתית ל־endpoint יקר = התחברות (ID token) או App Check. endpoint ציבורי־מטבעו (מחירים, חיפוש) — מספיקה הגבלת קצב + מטמון.
- **SSRF בכריכות**: להחליף ל־`redirect: 'manual'` ולעקוב ידנית עד 3 הפניות, ולבדוק `coverAllowed` **לפני כל קפיצה**. ב־Vercel הנזק קטן; **בשרת עצמאי (Hetzner) זה קריטי** — שם יש שירותים פנימיים (לוח בקרה, Docker, ובענן של Hetzner שירות מטא־דאטה על `169.254.169.254` — **לא אומת בחקר זה**). אותו כלל לכל endpoint שמביא URL (`wordmark` מביא מ־Wikidata/Commons — לבדוק אותו דבר). **עכשיו, AI**.
- **מצבי אבחון**: להעביר מאחורי `isAdmin` (ID token) או להסיר. **עכשיו, AI**.
- **IP אמין בשרת חדש**: מאחורי Cloudflare — לקחת רק `CF-Connecting-IP`, ולחסום בחומת האש של השרת כל חיבור שלא מטווחי Cloudflare; אחרת כל אחד שולח `X-Forwarded-For` ועוקף את הגבלת הקצב ואת מכסות ה־AI לאנונימיים. ב־Vercel — להעדיף `x-vercel-forwarded-for`. **כשהשרת עולה, AI**.
- **הגבלת קצב אמיתית**: בשרת עם תהליך קבוע הזיכרון כבר משותף; אם יש כמה מופעים — Redis/Valkey. ב־Vercel אפשר להשתמש במונים ב־Firestore (כמו `aiUse`) רק ל־endpoint יקרים. **כשהשרת עולה**.
- **הודעות שגיאה**: `diag` עם טקסט ספק — לצמצם לקוד בלבד בתשובה ללקוח שאינו מנהל. **עכשיו, AI**.

### פערים
- לא קראתי את כל 12 ה־endpoint שורה־שורה (בדקתי guard, translate, bookmeta, widget, library חלקית).
- `api/widget.js` הוא GET בלי Origin (הווידג׳ט לא שולח) — מידע שוק ציבורי בלבד לפי הקוד; לא נבדק לעומק.
- OWASP API Security Top 10 2023 לא נשלף בחקר זה.

## 4. "שחיקת ארנק" (Denial of Wallet) — תוקף שמנפח חשבונות AI/ענן

### השורה התחתונה
יש כבר מפסק יומי מצוין ל־AI (`lib/aicache.js`): תקרה כוללת, לכל משתמש ולאנונימי. מה שחסר: תקציבים והתראות **בצד הספקים** (Google Cloud/Firebase, Vercel, Mistral, Anthropic), כי המפסק בקוד לא מגן אם המפתח עצמו דולף.

### ממצאים עם מקורות
- [קוד: `ibkr-proxy/lib/aicache.js:7,17,74-82`] תקרות ממשתני סביבה: `AI_DAILY_LIMIT` (ברירת מחדל 2000), `AI_USER_DAILY` (150), `AI_ANON_DAILY` (40), `AI_INSIGHT_DAILY` (100); אנונימי מזוהה לפי `ip:`; המונה ב־Firestore (`aiUse/{יום}`).
- [קוד: `api/translate.js`] התרגום "בהקשר" זמין גם בלי התחברות (נופל ל־`ip:`).
- [CLAUDE.md §15] Firebase Spark (חינמי) ו־Vercel Hobby — "חריגה מתמשכת → השהיה (אין חיוב)"; בחינם אין חיוב מפתיע, אבל ברגע שמוסיפים כרטיס אשראי (Gemini Tier 1, Blaze, שרת) — יש.
- תנאי Gemini: השימוש החינמי = "Unpaid Services" — [ראשי: Gemini API terms](https://ai.google.dev/gemini-api/terms) (ראו §11).

### הסקות
- **עכשיו (בחינם)**: ההגנה העיקרית היא שאין כרטיס אשראי — "הכי גרוע" = השירות נעצר. זה בעצמו סיכון זמינות (§5): תוקף שמכלה את המכסה היומית של Gemini/Vercel מפיל את התרגום לכולם. לכן: להוריד את `AI_ANON_DAILY` או לחייב התחברות ל־AI (התרגום המהיר דרך Google לא דורש AI). **עכשיו, החלטת בעלים + AI**.
- **ברגע שיש חיוב** (Gemini בתשלום, שרת, Anthropic API לסטודיו בשלב 7): לכל ספק — תקציב חודשי + התראה ב־50/90/100% (Google Cloud Budgets, Anthropic Console spend limit, Hetzner — מחיר קבוע), מפתח נפרד לכל שימוש כדי שאפשר יהיה לבטל אחד, ו"מתג חירום" = משתנה סביבה `AI_DAILY_LIMIT=0`. **כשגדלים, בעלים** (לא אומת בחקר זה איזה ספק תומך בתקרה קשיחה מול התראה בלבד — לבדוק לכל אחד).
- **הסטודיו**: Routine רץ על מכסת המנוי — השרתון כבר מגביל ל־20 הפעלות בשעה למשתמש (CLAUDE.md §18). זה בדיוק "תקרת ארנק"; לשמור.

### פערים
- לא נבדק אילו ספקים מאפשרים "עצירה קשיחה" אוטומטית בחריגה.

## 5. זמינות (DDoS, Cloudflare, ירידה חיננית, נפילת ספק, נקודות כשל יחידות)

### השורה התחתונה
היום הכל על פלטפורמות מנוהלות (Pages, Vercel, Firebase) שסופגות מתקפות בעצמן; נקודת התורפה היא **מכסות חינם** — מי שמציף את השרתון מפיל את המחירים לכולם. כשעוברים לשרת יחיד, הוא הופך לנקודת כשל יחידה.

### ממצאים עם מקורות
- [CLAUDE.md §15] Vercel Hobby: מיליון קריאות, 4 שעות CPU, 100GB תעבורה; חריגה → השהיה. השימוש הנוכחי מוערך 5–20% מהמיליון.
- [CLAUDE.md §5] יש כבר ירידה חיננית מצוינת: Yahoo חסום → CNBC; שרתון לא עונה → מטמון/ישיר; `LIVE_STALE_MS` מסמן "דיליי".
- [קוד: `ibkr.js`] הגבלת קצב לכל IP בזיכרון (§3) — לא עוצרת מתקפה מבוזרת (הרבה כתובות).

### הסקות
- **עכשיו**: מתקפה של כמה מאות אלפי בקשות ביום מספיקה כדי לשרוף את מכסת Vercel. הגנה פשוטה: Vercel Firewall (קיים גם ב־Hobby לפי מה שידוע לי — **לא אומת**) או תשובות מטמון בקצה (`Cache-Control: s-maxage` ל־quotes/search כשאפשר).
- **כשהשרת עולה**: Cloudflare (חינמי) מול השרת — מסתיר את ה־IP האמיתי, סופג DDoS, הגבלת קצב בקצה; חומת אש בשרת שמקבלת 80/443 רק מטווחי Cloudflare (ואז ה־IP האמיתי לא נחשף). **אף פעם לא לפרסם את ה־IP של השרת ב־DNS ישיר או בריפו הציבורי.**
- **נפילת ספק**: למפות "מה נשבר אם X נופל": Firebase נופל → אין התחברות, האפליקציה עובדת מהמקומי (קיים — v193); Vercel/שרת נופל → מחירים ישירים כגיבוי (קיים); GitHub Pages נופל → ה־SW מגיש מהמטמון (קיים). זה מצב טוב — לתעד ולבדוק פעם ברבעון.

### פערים
- לא נבדקו פרטי Vercel Firewall בתוכנית Hobby, ולא תיעוד Cloudflare.

## 6. אנדרואיד (מפתח החתימה, TWA/assetlinks, intents, MASVS, התקנה מחוץ לחנות)

### השורה התחתונה
ה־CI בונה APK חתום עם actions מקובעים ל־SHA — טוב. הסיכונים: (1) מפתח החתימה — אבד = אין עדכונים, דלף = עדכון זדוני שהטלפון יקבל; (2) `WidgetSyncActivity` חשופה לכל אפליקציה/אתר; (3) שינוי מדיניות של Google: אימות מפתחים גם לאפליקציות שמותקנות מחוץ לחנות — עולמי ב־2027.

### ממצאים עם מקורות
- [קוד: `.github/workflows/android.yml`] חתימה מהסודות `SNOWBALL_KEYSTORE_B64` + `SNOWBALL_KS_PASS`, נכתב ל־`$RUNNER_TEMP`; רץ רק על `push` לנתיבי android ו־`workflow_dispatch` (לא על PR מ־fork) — טוב.
- [קוד: `android/app/src/main/AndroidManifest.xml`] `MainActivity` exported עם App Link מאומת (`autoVerify`, `yishaiguedj1.github.io/portfolio-pwa`); `WidgetSyncActivity` **exported** עם סכמה `snowball://widget`; `allowBackup="true"`.
- [קוד: `WidgetSyncActivity.kt:17`] `WidgetStore.setItems(this, s, l, w)` מהפרמטרים בלי בדיקת אורך/תבנית נראית בשורה זו.
- אימות מפתחים של Android: נאכף מ־30/09/2026 בברזיל, אינדונזיה, סינגפור ותאילנד במכשירים מאושרים (Android 7+); הרחבה עולמית מתוכננת ל־2027; התקנה בלי אימות עדיין אפשרית דרך ADB או "מסלול מתקדם" — [ראשי: Android Developer Console Help](https://support.google.com/android-developer-console/answer/16561738?hl=en); [משני: Android Authority](https://www.androidauthority.com/android-developer-verification-rollout-sideloading-flow-3653395/); [משני: TechAiWire](https://techaiwire.com/articles/android-developer-verification-enforcement-four-countries/). פרטי "מסלול מתקדם" (מצב מפתח, אתחול, 24 שעות) — [משני בלבד](https://www.testerscommunity.com/blog/android-developer-verification-2026).

### הסקות
- **מפתח החתימה** (החשוב ביותר): עותק מוצפן **לא מקוון** (USB/מנהל סיסמאות) + הסיסמה במקום נפרד; מי שיש לו גישת כתיבה לריפו יכול לשנות workflow ולהוציא את הסוד — לכן הגנת ענף ו־environment עם אישור לבנייה (§9). **עכשיו, בעלים**.
- **אימות מפתחים 2027**: לפני ההרחבה העולמית — לרשום חשבון מפתח (ייתכן "הפצה מוגבלת" לתחביבים, לפי מקורות משניים) ולרשום את מפתח החתימה הקיים; אחרת משתמשים יצטרכו מסלול מסורבל. **כשגדלים (עד 2027), בעלים**.
- **WidgetSyncActivity**: כל אתר יכול לשלוח `intent://widget?s=…` ולשנות את רשימת הווידג׳ט (נזק: הטעיה/הצגת סימבולים שגויים, לא גניבה). תיקון קטן: ולידציה (אורך, תבנית סימבול) ב־Kotlin. **עכשיו (קטן), AI**.
- `allowBackup="true"`: הגיבוי של אנדרואיד כולל את נתוני הווידג׳ט (סימבולים, לא כמויות) — סיכון נמוך; לשקול `false` או כללי גיבוי. **כשגדלים, AI**.
- **Play Protect**: APK מחוץ לחנות עלול לקבל אזהרה; להנחות משתמשים להוריד רק מהקישור הקבוע ב־Releases ולפרסם את טביעת האצבע (SHA-256) של התעודה בדף ההורדה. **כשגדלים, AI**.

### פערים
- OWASP MASVS לא נשלף בחקר זה.
- לא נבדק איך `MainActivity` מטפלת בפרמטרים מקישור (`#app=`, `n=`).

## 7. פרטיות מובנית (צמצום, שמירה ומחיקה, הצפנה, זכויות משתמש, תיקון 13)

### השורה התחתונה
העיצוב כבר מצמצם יפה: נתונים אמיתיים רק בענן של המשתמש, סודות IBKR/Routine רק מוצפנים בשרתון, אין לוגים עם מידע אישי, `privacy-guard` ב־CI. מה שחסר: מדיניות פרטיות כתובה, כלי "ייצוא/מחיקת כל הנתונים שלי" אחד, ומיפוי לתקנות הישראליות כשיהיו משתמשים נוספים.

### ממצאים עם מקורות
- [קוד/CLAUDE.md §3] `lib/vault.js` AES-256-GCM, IV אקראי, AAD; `ack` מוחק דוחות מהענן אחרי ייבוא; ניתוק = מחיקת הרשומה. [קוד: grep] אין לוגים בשרתון.
- תיקון 13 לחוק הגנת הפרטיות נכנס לתוקף 14/08/2025 ונתן לרשות להגנת הפרטיות סמכות קנסות מנהליים — [משני: DLA Piper](https://www.dlapiperdataprotection.com/index.html?t=law&c=IL); [משני: Global Law Experts](https://globallawexperts.com/israels-privacy-protection-authority-3/). מקור אחד (Multilaw) נותן 15/08/2025.
- דיווח על "אירוע אבטחה חמור" לרשות — מיידי; רמת אבטחה בסיסית בדרך כלל פטורה מדיווח; בינונית — כשנפגע חלק מהותי; גבוהה — כל שימוש לא מורשה — [משני: DLA Piper](https://www.dlapiperdataprotection.com/index.html?t=law&c=IL). טענה על "72 שעות" (Kiteworks) **לא נמצאה במקור רשמי** — [משני, סותר](https://www.kiteworks.com/regulatory-compliance/israeli-breach-notification-amendment-13/).
- התקנות הרלוונטיות: תקנות הגנת הפרטיות (אבטחת מידע), התשע"ז-2017 — שלוש רמות (בסיסית/בינונית/גבוהה) — [משני: BigID](https://bigid.com/blog/what-israel-amendment-13-means-for-businesses-in-2025/) (תוכן ספק).

### הסקות
- **היום** האפליקציה משמשת את הבעלים, וייתכן שחלה הסתייגות "שימוש אישי" — **לא אומת** (פער משפטי). ברגע שמצטרפים קוראים לספרייה/משתמשים לסטודיו, נוצר "מאגר" (מיילים, התקדמות קריאה, הערות; ובתיק — נתונים פיננסיים, שעלולים להיחשב רגישים).
- מיפוי ראשוני לבקרות (רמה בסיסית, להערכתי): מסמך הגדרות מאגר (מה נאסף, למה, איפה) ← כבר קיים חלקית ב־CLAUDE.md §15; הרשאות גישה מינימליות ← כללי Firestore (§2); תיעוד אירועים ← לוג אבטחה בלי מידע אישי (§12); גיבוי ← Firestore export; סקירה תקופתית ← §10. **כשגדלים, AI כותב טיוטה; בעלים מאשר; עו"ד לפני מסחור**.
- **זכויות משתמש**: כפתור "ייצוא כל הנתונים שלי" (JSON מ־`users/{uid}` + IndexedDB) ו"מחיקת החשבון" שמוחק גם `ibkrVault`, `driveVault`, `studioVault`, `studioJobs`, מטמון. היום המחיקה מפוזרת (איפוס, ניתוק, ניתוק Drive). **כשגדלים, AI**.
- **שמירה**: לקבוע זמני מחיקה — `studioJobs` אחרי N ימים, `aiCache` (מכיל טקסטים מספרים — לא אישי ברובו), `aiUse` (מזהה hash של uid/IP — למחוק אחרי חודש). **כשגדלים, AI**.
- **מדיניות פרטיות** קצרה בעברית + `security.txt` (§10). **כשגדלים, AI טיוטה + בעלים**.

### פערים
- לא אומת בנוסח הרשמי (עברית) של החוק/התקנות; כל הפרטים ממקורות משניים — חובה בדיקה מול אתר הרשות להגנת הפרטיות או עו"ד.
- לא ברור אם תיק אישי + קוראים מוזמנים מחייב רישום/דיווח.

## 8. הגורם האנושי ואבטחת הבעלים (פישינג, החלפת SIM, מנהל סיסמאות, קודי שחזור, הטלפון כמסוף ניהול)

### השורה התחתונה
הבעלים הוא "המפתח הראשי": חשבון Google אחד שולט ב־Firebase, Drive, Gemini, OAuth, וכנראה גם בכניסה ל־GitHub/Vercel. הטלפון שלו הוא מסוף הניהול (ממזג PR, מאשר Routine). מתקפה נפוצה = מייל פישינג מזויף ("GitHub: פעילות חשודה", "Vercel: חיוב נכשל", "Google: אשר כניסה").

### ממצאים עם מקורות
- NIST SP 800-63B-4 (יולי 2025): SMS/קול = מאמת "מוגבל" (restricted) — מותר בתנאים, לא מומלץ; ב־AAL2 חייבת להיות אפשרות עמידה לפישינג; passkeys מסונכרנים מותרים ב־AAL2, לא ב־AAL3 — [משני: Patch & Proof](https://patchandproof.com/desk/nist-sp-800-63-4-digital-identity-2025/); [משני: TypingDNA](https://blog.typingdna.com/nist-sp-800-63b-rev-4-sms-otp-is-now-a-restricted-authenticator-but-we-have-the-fix/). (המקור הראשי ב־NIST לא נשלף.)
- [CLAUDE.md §12] עבודה מהטלפון: מיזוג PR מהטלפון; Claude app מחובר ל־GitHub עם הרשאות כתיבה.

### הסקות
- **עכשיו, בעלים** (חצי שעה):
  1. passkey (או מפתח חומרה) ב־Google, GitHub, Vercel; **להסיר SMS** כאמצעי 2FA/שחזור איפה שאפשר (החלפת SIM = השתלטות).
  2. קודי שחזור — מודפסים/במנהל סיסמאות, לא בצילום מסך בגלריה ולא בדרייב של אותו חשבון.
  3. מנהל סיסמאות (גם מזהה אתר מזויף — לא ממלא סיסמה בדומיין שגוי).
  4. כלל: **אף פעם לא ללחוץ על קישור במייל** של GitHub/Google/Vercel/Hetzner/Anthropic — להיכנס ידנית מהסימניה/האפליקציה.
  5. הטלפון: נעילת מסך חזקה, עדכונים, בלי APK ממקורות לא מוכרים, Google Play Protect פעיל.
  6. לבדוק פעם ברבעון: אפליקציות OAuth מחוברות לחשבון Google ול־GitHub (Settings → Applications), טוקנים אישיים (PAT) ישנים — למחוק.
- **כשגדלים**: חשבון Google נפרד לניהול (בעלות על פרויקט Firebase/Cloud) מול החשבון היומיומי — מצמצם נזק מפישינג על הדואר היומיומי. **בעלים**.

### פערים
- לא ידוע איזה 2FA מוגדר היום בחשבונות הבעלים (לא נבדק, ולא צריך להיבדק מכאן).

## 9. עוזר ה־AI כ"שחקן" (מניעת דחיפת קוד לא בטוח לייצור)

### השורה התחתונה
**ממצא חשוב**: `.claude/settings.json` בריפו **מאשר מראש** `Bash(git push origin HEAD:main)` — כלומר כל סשן Claude בריפו רשאי לדחוף ישר לייצור בלי לשאול, בניגוד לכלל ב־CLAUDE.md §8 ("לא לפרוס בלי אישור"). אין CODEOWNERS ואין (בריפו) עדות להגנת ענף. כלל כתוב ב־CLAUDE.md הוא "עצה" לסוכן, לא מחסום.

### ממצאים עם מקורות
- [קוד: `.claude/settings.json`] `"permissions": { "allow": ["Bash(git push origin HEAD:main)"] }` + hooks לכלל העברית.
- [קוד: שורש הריפו] אין `.github/CODEOWNERS`, אין `.github/dependabot.yml`, אין `SECURITY.md`.
- [CLAUDE.md §8] בסשן ענן במצב Auto מנגנון הבטיחות חוסם דחיפה ל־main; הפתרון שנקבע: שני PR שהבעלים ממזג מהטלפון. בסביבת הסטודיו: `permissions.deny` ל־`git push` (§18).
- ב־Claude Code: deny נבדק לפני allow ו"גובר"; deny/allow ל־Bash הם התאמת טקסט, ו־`git -C . push` עלול לא להיתפס; ההמלצה — הגנה בצד השרת (הגנת ענף) ו/או sandbox/hooks — [ראשי: Claude Code Security](https://code.claude.com/docs/en/security); [משני: claudefolio](https://claudefolio.com/blog/claude-code-permission-rules-allow-and-deny-syntax); [משני (ניסוי בודד): DEV](https://dev.to/rulestack/claude-code-permission-rules-bashgit-push-stopped-8-of-14-ways-to-push-and-5-reached-the-44kn)
- GitHub: rulesets/הגנת ענף כוללים "Require a pull request", "Require status checks", "Block force pushes"; הגנת ענף זמינה בריפו ציבורי ב־GitHub Free — [ראשי: About protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches); [ראשי: rulesets available rules](https://docs.github.com/en/enterprise-server@3.18/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets). בריפו אישי (לא ארגון) רשימת עקיפה מוגבלת — [משני](https://github.com/orgs/community/discussions/61107).

### הסקות
- **המחסום האמיתי = בצד GitHub, לא בצד הסוכן**: ruleset על `main`: חובת PR, חובת בדיקות ירוקות (`test.yml`), חסימת force push ומחיקה. כך גם סוכן שקיבל אישור דחיפה, גם טוקן שדלף, וגם טעות אנוש — לא יגיעו לייצור בלי CI ירוק. **עכשיו, בעלים (בהגדרות GitHub; 10 דק')**. שימו לב: זה ישנה את זרימת העבודה (דחיפה ישירה ל־main תיחסם גם לבעלים) — תואם את פרוטוקול "שני PR" שכבר נקבע.
- **`.claude/settings.json`**: להסיר את ה־allow לדחיפה ל־main ולהוסיף deny ל־`git push * main`/force — **רק בהחלטת הבעלים** (הסוכן לא משנה הגדרות הרשאה מיוזמתו). **עכשיו, בעלים מחליט; AI מבצע אחרי אישור**.
- **בדיקות אבטחה כשער**: `privacy-guard`, `xss-guard`, `csp.test` כבר ב־CI — להפוך ל־required check (לפי ה־ruleset). להוסיף בדיקה שמונעת שינוי ב־`.claude/settings.json`/`.github/workflows` בלי תווית אישור (או CODEOWNERS — אצל אדם אחד זה בעיקר "תזכורת", לא מחסום).
- **סקירת PR של AI**: לפני מיזוג מהטלפון — לעבור על רשימת הקבצים: אם נגעו `sw.js`, workflows, `vercel.json`, CSP, `lib/gauth.js`, `lib/vault.js` → לבקש סקירה ייעודית (`/security-review`). **שגרה, בעלים**.
- **סודות לעולם לא בצ'אט** — כבר כלל ב־CLAUDE.md §3; לחזק: אם סוד הודבק בטעות בצ'אט — רוטציה מיידית (§12).

### פערים
- לא בדקתי (ואין לי גישה מכאן) אם כבר מוגדר ruleset בצד GitHub.

## 10. אימות אבטחה (סריקות אוטומטיות, סקירה ידנית, בדיקת חדירות, security.txt)

### השורה התחתונה
יש בדיקות "בית" טובות (פרטיות, XSS, CSP, אבטחת השרתון — 88 בדיקות). חסרים הכלים הסטנדרטיים החינמיים לריפו ציבורי: סריקת סודות עם חסימת push, CodeQL, Dependabot, סריקת DAST בסיסית.

### ממצאים עם מקורות
- סריקת סודות + push protection — חינם לכל ריפו ציבורי; מפעילים ב־"Code security and analysis" — [ראשי: GitHub Changelog](https://github.blog/changelog/2023-05-09-secret-scannings-push-protection-is-available-on-public-repositories-for-free/). מגבלות (לא מזהה פורמטים מותאמים כמו token של IBKR; ניתן לעקיפה) — [משני: GitGuardian](https://blog.gitguardian.com/github-push-protection-enhancing-open-source-security-with-limitations-to-consider/)
- ZAP Baseline: סריקה פסיבית בלבד (בלי מתקפות), כמה דקות, `zaproxy/action-baseline` (גרסה אחרונה בשוק v0.15.0), `fail_action` כבוי כברירת מחדל — [ראשי: zaproxy/action-baseline](https://github.com/zaproxy/action-baseline)
- security.txt (RFC 9116): ב־`/.well-known/security.txt`, שדות חובה `Contact` (URI, למשל `mailto:`) ו־`Expires` (עד שנה קדימה) — [משני: cvdportal](https://cvdportal.com/security-txt) (RFC עצמו לא נשלף).
- [קוד] ה־workflows מקובעים ל־SHA, `permissions: contents: read` (CLAUDE.md §3) — שיטה מומלצת.
- [קוד: `tests/privacy-guard.test.js` לפי CLAUDE.md §3] מגן על מספר חשבון, טוקן, מפתח Google, מייל — מכסה גם את הפורמט המותאם שהסריקה של GitHub לא מכירה.

### הסקות
- **עכשיו, בעלים (לחיצות)**: Secret scanning + Push protection; Dependabot alerts (+ security updates).
- **עכשיו, AI**: `codeql.yml` (JavaScript + Python — `translator/`) עם actions מקובעים; `dependabot.yml` ל־github-actions, npm (אם יש), pip של `translator/`, gradle של `android/`; `pip-audit` לתלויות `SNB_MODULES`.
- **אחרי כל פריסה / שבועי, AI**: ZAP Baseline מול האתר החי (לא מול IBKR!) עם `fail_action: false` בהתחלה — דוח בלבד. יראה מיד: חסרות כותרות (frame-ancestors, HSTS) — צפוי ב־Pages.
- **security.txt** ב־`.well-known/` (קובץ סטטי ב־Pages; `.nojekyll` כבר קיים, כך שתיקיית נקודה תתפרסם — **לא אומת**) עם `mailto:` ייעודי (לא המייל האישי — כתובת כינוי). **עכשיו, AI + בעלים בוחר כתובת**.
- **סקירה ידנית**: פעם ברבעון `/security-review` על השינויים + מעבר על רשימת §13. **בדיקת חדירות חיצונית** — רק כשיש משתמשים משלמים/נתונים של אחרים. **Bug bounty** — לא לפני שיש מדיניות חשיפה ומישהו שעונה.
- Trivy (סריקת תמונות Docker) — **כשהשרת עולה**.

### פערים
- לא נבדק אם Dependabot/סריקת סודות כבר מופעלים בהגדרות הריפו.

## 11. משפט, ציות וצדדים שלישיים (DPA, סיכון ספקים, שמירת נתונים אצל ספקי AI, תנאי שימוש)

### השורה התחתונה
הממצא המהותי: **Gemini בחינם = "Unpaid Services"** — Google רשאית להשתמש בקלט ובפלט לשיפור מוצרים, בודקים אנושיים עשויים לקרוא, ו־Google עצמה מבקשת לא לשלוח מידע אישי/רגיש. אצלנו נשלחים ל־Gemini טקסטים מספרים (בעיקר פומביים) וקטעים שהמשתמש מסמן — בסדר כרגע, אבל לא לשלוח לשם שום נתון פיננסי/אישי.

### ממצאים עם מקורות
- תנאי Gemini API: שימוש חינמי (AI Studio, מכסה לא בתשלום) = Unpaid Services; "Google uses the content you submit… to provide, improve, and develop Google products… and machine learning technologies"; בודקים אנושיים (אחרי ניתוק מהחשבון); "Do not submit sensitive, confidential, or personal information to the Unpaid Services"; ב־EEA/שוויץ/בריטניה חלים תנאי ה־Paid גם בחינם — [ראשי: Gemini API Additional Terms](https://ai.google.dev/gemini-api/terms)
- [CLAUDE.md §15] Vercel Hobby ו־GitHub Pages — "לא מסחרי"; Firebase Spark.
- [קוד: `api/translate.js`, `lib/insight.js`, `lib/mistral.js`] ספקי AI: Gemini, Mistral (גיבוי), Google Translate (clients5), MyMemory; הסטודיו — Claude דרך Routine של המנוי.

### הסקות
- **רשימת ספקים (vendor register)** קצרה: לכל ספק — מה נשלח אליו, האם זה אישי, תנאי שמירה, האם מותר מסחרית. **כשגדלים, AI טיוטה**.
- **מסחור** = לעבור מ־Vercel Hobby (לא מסחרי) ומ־GitHub Pages לתנאים מתאימים, ול־Gemini בתשלום (כדי שהנתונים לא ישמשו לאימון). **כשגדלים, בעלים**.
- **DPA**: Google Cloud/Firebase ו־Vercel מציעים הסכמי עיבוד נתונים (ידוע — **לא אומת בחקר זה**); רלוונטי כשיש נתונים של משתמשים אחרים.
- **הסטודיו**: תמלילים/סרטונים של המשתמש עוברים דרך Claude במנוי הצרכני — תנאי השמירה/אימון של Anthropic לחשבונות צרכניים **לא נבדקו כאן** (פער); לבדוק את הגדרת "שימוש בנתונים לשיפור" בחשבון.

### פערים
- תנאי Mistral (חשבון Free), MyMemory, ו־Anthropic לצרכנים — לא נבדקו.
- דף התנאים של Gemini עשוי להשתנות — לקרוא את הגרסה החיה לפני החלטה.

## 12. תגובה לאירועים ותרגולי שחזור (אותות זיהוי, מי/מה/מתי, רוטציית מפתחות, תרגול שחזור, תקשורת)

### השורה התחתונה
יש יתרון: הרבה הגנות "מוכלות" (סודות מוצפנים, ניתוק = מחיקה). חסרים: אות זיהוי (אין לוגים בכלל — לא יודעים שמשהו קרה), ו"ספר מתכונים" לרוטציה לכל סוד.

### ממצאים עם מקורות
- [קוד: grep] אין לוגים בשרתון; [CLAUDE.md §8] יש מיילים אוטומטיים של Vercel/GitHub על כשלי פריסה/בדיקות.
- OWASP Top 10:2025 A09 = Security Logging & Alerting Failures — [ראשי: OWASP](https://owasp.org/Top10/2025/0x00_2025-Introduction/)
- דיווח לרשות על אירוע חמור — מיידי (מקורות משניים, §7).

### הסקות
- **אותות זיהוי בגודל הנכון** (בלי מידע אישי): מונים יומיים ב־Firestore (כמו `aiUse`) גם ל־401/403/429 ול־`bad_key` של הסטודיו; התראה למייל/טלפון כשמונה חורג פי 10 מהממוצע. התראות GitHub על push protection/Dependabot; התראות Google Cloud על שימוש חריג במפתחות. **כשהשרת עולה, AI**.
- **ספר מתכונים לרוטציה** (מסמך אחד, בלי ערכים): לכל סוד — איפה יושב, איך מחליפים, מה נשבר בזמן ההחלפה, איך מאמתים:
  `GDRIVE_SA_KEY` (חשבון שירות) · `GDRIVE_CLIENT_SECRET` / `STUDIO_GDRIVE_CLIENT_SECRET` · `IBKR_VAULT_KEY` (אם הוגדר; אחרת נגזר מהמפתח הפרטי של חשבון השירות → **רוטציה של חשבון השירות משנה את מפתח הכספת ומבטלת את כל הרשומות המוצפנות** — לתכנן) · `GEMINI_API_KEY`, `GOOGLE_BOOKS_KEY`, מפתח Mistral · `CRON_SECRET` · מפתח החתימה של האנדרואיד (אי אפשר להחליף בלי לשבור עדכונים — רק להגן) · token ה־IBKR של המשתמש (ב־IBKR Client Portal) · כתובת+מפתח ה־Routine. **עכשיו, AI כותב; בעלים מחזיק**.
- **תרגול שחזור** פעם ברבעון (שעה): ייצוא Firestore → שחזור לפרויקט בדיקה; התקנת APK מהקישור הקבוע; שחזור ספרייה פרטית מגיבוי Drive; פריסה מחדש של השרתון מקומיט ישן.
- **תקשורת למשתמשים**: תבנית הודעה קצרה ("מה קרה, מה עשינו, מה לעשות") + שורת `flash` באפליקציה. **כשגדלים**.

### פערים
- לא בדקתי אם Vercel Hobby שומר לוגי בקשות ולכמה זמן.

## 13. רשימת עדיפויות מאוחדת

### השורה התחתונה
שלושה צעדים עושים את רוב העבודה: **(1)** ruleset על `main` + push protection + 2FA עמיד לפישינג (בעלים, ~45 דק'); **(2)** הסרת האישור הקבוע לדחיפה ל־main מ־`.claude/settings.json` (החלטת בעלים); **(3)** כללי Firestore בריפו עם בדיקות (AI).

### ממצאים עם מקורות
- (סיכום של סעיפים 1–12; כל פריט מבוסס על הראיות שם.)

### הסקות
**עכשיו (לפני כל דבר אחר)**
| # | פעולה | מי | ראיה |
|---|---|---|---|
| 1 | Ruleset על `main`: חובת PR + בדיקות ירוקות + חסימת force push/מחיקה | בעלים | §9 |
| 2 | Secret scanning + Push protection + Dependabot alerts | בעלים | §10 |
| 3 | passkey/מפתח חומרה ב־Google/GitHub/Vercel, הסרת SMS, קודי שחזור במקום בטוח | בעלים | §8 |
| 4 | החלטה: להסיר `allow: git push origin HEAD:main` מ־`.claude/settings.json` (+deny לדחיפה ל־main) | בעלים מחליט, AI מבצע | §9 |
| 5 | גיבוי לא מקוון ומוצפן של מפתח החתימה + הסיסמה בנפרד | בעלים | §6 |
| 6 | `LIBRARY_ADMINS` מפורש ב־Vercel; בדיקת Authorized domains וספקי התחברות במסוף Firebase | בעלים | §2 |
| 7 | `firestore.rules` לריפו + בדיקות Emulator ב־CI | AI (+בעלים מעתיק מהמסוף) | §2 |
| 8 | frame-busting ב־JS; צמצום `connect-src` (`*.vercel.app` → כתובת מדויקת) | AI | §1 |
| 9 | הרחבת `xss-guard` ל־`library.js`/`studio.js`; ניקוי `<script>`/`on*` בייבוא EPUB | AI | §1 |
| 10 | OAuth: `crypto.getRandomValues` ל־state + PKCE S256 | AI | §1 |
| 11 | SSRF בכריכות: `redirect:'manual'` ובדיקה לכל קפיצה (וכנ"ל ב־wordmark) | AI | §3 |
| 12 | מצבי אבחון (`mistralProbe`/`storeProbe`) מאחורי מנהל; `diag` בלי טקסט ספק | AI | §3 |
| 13 | CodeQL + `dependabot.yml` + `pip-audit`; `security.txt` | AI | §10 |
| 14 | ולידציה ב־`WidgetSyncActivity` | AI | §6 |
| 15 | ספר מתכונים לרוטציית סודות (בלי ערכים) | AI כותב, בעלים מחזיק | §12 |
| 16 | לשקול הורדת `AI_ANON_DAILY` / AI רק למחוברים | בעלים מחליט | §4 |

**כשהשרת החדש עולה**
- Cloudflare מול השרת; חומת אש שמקבלת רק מטווחי Cloudflare; IP אמין רק מ־`CF-Connecting-IP` (לא XFF שמאלי) — §3, §5.
- כותרות HTTP אמיתיות: CSP ככותרת עם `frame-ancestors 'none'`, HSTS, `Referrer-Policy`, `Permissions-Policy` — §1.
- SSRF: חסימת יציאה לכתובות פנימיות/מטא־דאטה מהקונטיינרים — §3.
- הגבלת קצב משותפת (תהליך קבוע/Redis); מונים חריגים + התראות — §3, §12.
- ZAP Baseline שבועי מול האתר החי; Trivy לתמונות — §10.
- App Check לשרת (כותרת `X-Firebase-AppCheck`) — §2.

**כשגדלים (משתמשים נוספים / מסחור)**
- מדיניות פרטיות, רשימת ספקים, ייצוא/מחיקת חשבון בלחיצה, זמני שמירה — §7, §11 (AI טיוטה, בעלים + עו"ד).
- מיפוי לתקנות אבטחת מידע 2017 ותיקון 13; נוהל דיווח לרשות — §7 (בעלים + ייעוץ).
- Gemini/AI בתשלום (נתונים לא לאימון), תקציבים והתראות לכל ספק, מתג חירום — §4, §11.
- origin נפרד לתוכן חיצוני; מחיקת token IBKR מהטלפון כשהסנכרון ברקע פעיל — §1.
- רישום מפתח אנדרואיד לפני אימות המפתחים העולמי (2027); פרסום טביעת אצבע של התעודה — §6.
- חשבון ניהול נפרד; תרגולי שחזור רבעוניים; בדיקת חדירות חיצונית; ורק אחר כך bug bounty — §8, §10, §12.

### פערים
- כמה המלצות תלויות במצב הגדרות שלא ניתן לראות מהריפו (rulesets, 2FA, כללי Firestore במסוף, Dependabot) — ייתכן שחלקן כבר בוצעו.
