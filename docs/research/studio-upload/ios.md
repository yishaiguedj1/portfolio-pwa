# העלאת וידאו גדול ברקע באייפון (iOS) ל־Cloudflare R2 — מה אפשר: PWA, נייטיב, היברידי

> נכון ל־01/11/2026. מקורות עם תאריך מסומנים. מונחים טכניים (API, שמות מחלקות) נשארים באנגלית.

## 1. Safari / WebKit / PWA: מה קורה ל־fetch/XHR ברקע ובנעילת מסך

### Takeaway (שורה תחתונה)
אין כיום ב־iOS שום מנגנון ווב שממשיך העלאה אחרי שהדף/ה־PWA ירד לרקע או שהמסך ננעל: Background Fetch לא פעיל ב־Safari, ה־WebProcess מושהה כולו ברקע, ונעילת מסך "הורגת" העלאות. הדבר הכי טוב שאפשר בווב: להשאיר את האפליקציה בחזית עם Screen Wake Lock (נתמך גם ב־PWA מהמסך הבית מאז iOS 18.4 לפי MDN), ולהעלות ב־multipart עם המשך מנקודת העצירה כשחוזרים.

### Cited Findings
- Background Fetch: האתר whatpwacando.today מסמן אותו כ"implemented in Safari but not yet functional" (בלי תאריך עדכון) — [What PWA Can Do Today](https://whatpwacando.today/background-fetch). נתוני MDN (מראה ב־Chromium) מסמנים את `BackgroundFetchUpdateUIEvent` כלא נתמך ב־Safari וב־iOS Safari — [MDN BCD mirror](https://chromium.googlesource.com/external/github.com/mdn/browser-compat-data/+/73d346309ee9d8be7e32fda8ff574d4c79dd4c51/api/BackgroundFetchUpdateUIEvent.json). יש עבודה חלקית ב־WebKit (באג 253072 "Add API to trigger background fetch click event", נמזג), בלי ראיה שזה שוחרר — [WebKit 253072](https://bugs.webkit.org/show_bug.cgi?id=253072). לא נמצאה הכרזה של WebKit על Background Fetch ב־2025–2026.
- דיווחי מפתחים בבאג Wake Lock של WebKit: "whenever the screen goes to sleep the upload dies" (Henry, 19/07/2020; משתמש ב־NoSleep.js בהעלאות תמונות ארוכות); "The display must be kept on or the requests will fail" (01/03/2021); Thomas Steiner: "The data upload feature would ideally be solved with Background Fetch" (20/07/2020) — [WebKit 205104](https://bugs.webkit.org/show_bug.cgi?id=205104).
- Screen Wake Lock: עובד ב־Safari 16.4 בדפדפן אבל לא ב־PWA מהמסך הבית (אושר ע"י Marcos Caceres מ־Apple, 29/03/2023) — [WebKit 205104](https://bugs.webkit.org/show_bug.cgi?id=205104); הבאג הייעודי "New Wake Lock API does not work in Home Screen Web Apps" סגור RESOLVED FIXED — [WebKit 254545](https://bugs.webkit.org/show_bug.cgi?id=254545); MDN מציג תמיכה מלאה ב־iOS Safari מ־18.4, וההערה "לא עובד ב־standalone" חלה על 16.4–18.4 — [MDN WakeLock BCD](https://chromium.googlesource.com/external/github.com/mdn/browser-compat-data/+/73d346309ee9d8be7e32fda8ff574d4c79dd4c51/api/WakeLock.json). מקור שמבוסס על caniuse עדיין אומר "does not work in web app mode" (כנראה מיושן) — [w3cub wake-lock](https://docs.w3cub.com/browser_support_tables/wake-lock). Safari 18.4 הוסיף Declarative Web Push ו־Screen Wake Lock — לפי סיכום של [heise / WebKit](https://heise.de/-10749652).
- השהיה של כל ה־Safari ברקע: חומר הקורס של Maximiliano Firtman: "the whole Safari is suspended" (כל Safari מושהה — לא שהמערכת הורגת את הדף) — [Frontend Masters](https://frontendmasters.com/courses/background-javascript/observing-mobile-background-javascript).
- טריק האודיו: הערה ב־WebKit שה־web process נשאר חי בזמן ניגון אודיו — דרך תוצאת חיפוש [WebKit 198277](https://bugs.webkit.org/show_bug.cgi?id=198277); אבל אודיו ב־PWA לא אמין: דיווח מאפריל 2025 ש־Web Audio ב־PWA ב־iOS 26 עובד רק בהפעלה הראשונה, וגם `<audio>` שבור — [WebKit 291892](https://bugs.webkit.org/show_bug.cgi?id=291892); דיווח ישן יותר שאודיו נעצר כשיוצאים מ־PWA (בעוד שב־Safari ממשיך) — [WebKit 173332](https://bugs.webkit.org/show_bug.cgi?id=173332).
- באגים נוספים בהעלאות ב־Safari: רגרסיה ב־iOS 16.4 ש־XHR נתקע ונכשל לכל חיי הטאב — [WebKit 257965](https://bugs.webkit.org/show_bug.cgi?id=257965); אירועי upload progress לא סדירים ברשת איטית — [WebKit 277286](https://bugs.webkit.org/show_bug.cgi?id=277286).
- iOS 26: כל אתר שמתווסף למסך הבית נפתח כ־web app כברירת מחדל (מתג "Open as Web App"), ו־WebKit מציין שאין הסרה של יכולות web app קיימות — [WebKit WWDC25](https://webkit.org/?p=16993), [heise](https://heise.de/-10749652). אין שם יכולת רקע חדשה.
- אירופה: Apple ביטלה ב־01/03/2024 את התוכנית להסיר PWA ב־EU ב־iOS 17.4; היכולת נשארה כמו שהייתה (מבוססת WebKit) — [9to5Mac](https://9to5mac.com/2024/03/01/apple-home-screen-web-apps-ios-17-eu/), [Engadget](https://www.engadget.com/apple-backtracks-on-plans-to-get-rid-of-web-apps-on-iphones-in-the-eu-195232177.html). לא נמצא שינוי ב־EU שמוסיף רקע ל־PWA.
- Web API אחר מאופשר ל־web pages: `beginBackgroundTask` (חלון חסד של אפליקציה נייטיב) הוא API נייטיב ואינו חשוף לדפי ווב — לא נמצא מקור הפוך (תוצאת חיפוש בלבד).

### Inferences
- ל־PWA באייפון: העלאה רציפה מחייבת מסך דולק ואפליקציה בחזית. Wake Lock (iOS 18.4+) + UI שאומר "השאר את המסך פתוח" + הטענה/Wi‑Fi = המיטב. חובה לתכנן את ההעלאה כ־multipart עם שמירת מצב (uploadId, חלקים שהושלמו + ETag) ב־IndexedDB, כך שכשהמשתמש חוזר — ממשיכים מהחלק הבא ולא מאפס. חלקים קטנים יחסית (8–16MB) מצמצמים את האבדן בכל ניתוק.
- "כמה שניות אחרי מעבר לרקע" — בפועל הבקשה הפעילה עשויה להסתיים אם היא קצרה, אבל אין חלון מתועד; לכן לא לבנות על זה.
- טריק אודיו שקט ב־PWA: לא אמין (באגים ב־iOS 26) ועלול להיחשב שימוש לרעה; לא מומלץ.

### Gaps
- לא נמצא מקור רשמי ל־"timeout של ~30 שניות" ל־fetch/XHR ב־Safari ברקע; זה ידע שבטיפולוגיה, לא מתועד.
- לא נמצא בדיקה עצמאית שמאשרת ש־Wake Lock עובד ב־PWA מהמסך הבית ב־iOS 18.4+ (רק MDN + סגירת הבאג). צריך בדיקה על מכשיר.
- לא נמצא אם Service Worker מקבל זמן ריצה כלשהו ברקע ב־iOS להעלאות (אין Background Sync ב־Safari — לא נבדק במפורש בסבב הזה).

## 2. נייטיב: URLSession background sessions — מה מובטח ומה לא

### Takeaway (שורה תחתונה)
זה המנגנון היחיד ב־iOS שממשיך העלאה כשהאפליקציה מושהית/נסגרה ע"י המערכת ובמסך נעול: ההעברה רצה בתהליך מערכת נפרד (nsurlsessiond). מגבלות עיקריות: העלאה רק מקובץ, המשתמש שסוגר מה־app switcher מבטל הכל, הכל "discretionary" למעשה ברקע (המערכת מחליטה מתי), ויש rate limiter על השכמות. R2 multipart משתלב: כל חלק = upload task מקובץ־חלק עם presigned PUT (עד 7 ימים תוקף), ויוצרים את כל המשימות מראש כשהאפליקציה בחזית.

### Cited Findings
- הגדרת background: "hands control of the transfers over to the system, which handles the transfers in a separate process. In iOS, this configuration makes it possible for transfers to continue even when the app itself is suspended or terminated" — [Apple: background(withIdentifier:)](https://developer.apple.com/documentation/foundation/urlsessionconfiguration/background(withidentifier:)).
- כפייה ע"י המשתמש: "If the user terminates the app from the multitasking screen, the system cancels all of the session's background transfers. In addition, the system does not automatically relaunch apps that were force quit by the user" — [Apple: background(withIdentifier:)](https://developer.apple.com/documentation/foundation/urlsessionconfiguration/background(withidentifier:)); Quinn (Oct 2024): "it terminates most background activity related to the app, including any tasks in URLSession background sessions", ו־"Does Apple provide any additional APIs ... even if the user terminates the app? No." — [Forums 765196](https://developer.apple.com/forums/thread/765196); Quinn (נוסף 21/03/2024, עודכן 09/01/2026): force quit מציב דגל שמונע הפעלה ברקע עד שהמשתמש פותח ידנית; "In some circumstances iOS will not honour this flag" — [iOS Background Execution Limits](https://developer.apple.com/forums/thread/685525).
- רק מקובץ: "Only upload tasks from a file are supported (uploads from data instances or a stream fail after the app exits)"; redirects תמיד מבוצעים; חייב delegate — [Apple: Downloading files in the background](https://developer.apple.com/documentation/foundation/downloading-files-in-the-background).
- Discretionary: `isDiscretionary` ברירת מחדל false, אבל "For transfers started while your app is in the background, the system always starts transfers at its discretion—in other words, the system assumes this property is true" — [Apple: isDiscretionary](https://developer.apple.com/documentation/foundation/urlsessionconfiguration/isdiscretionary); Quinn (May 2024): "Background session transfers are (effectively) always considered discretionary", ואין דרך "to muscle through ... with the same reliability as a foreground session — No. That would burn through the user's battery"; קיצור `timeoutIntervalForResource` לא מאיץ, רק נכשל מוקדם — [Forums 751757](https://developer.apple.com/forums/thread/751757).
- Rate limiter: "When your app starts a new download task while in the background, the task doesn't begin until the delay expires. The delay increases each time the system resumes or relaunches your app ... use a small number of background sessions — ideally just one — and use these sessions to start many download tasks at once"; "If you find you need to launch thousands of download tasks, change your design to perform fewer, larger transfers"; העיכוב מתאפס כשהמשתמש מביא את האפליקציה לחזית — [Apple: Downloading files in the background](https://developer.apple.com/documentation/foundation/downloading-files-in-the-background). Quinn (Aug 2020): ה־rate limiter חל גם על uploads — "It does not distinguish between the various causes of those events" — [Forums 657683](https://developer.apple.com/forums/thread/657683).
- השכמה: המערכת קוראת ל־`application(_:handleEventsForBackgroundURLSession:completionHandler:)`, שומרים את ה־handler וקוראים לו אחרי `urlSessionDidFinishEvents(forBackgroundURLSession:)`; אם המערכת סיימה את האפליקציה — מפעילה מחדש ברקע וצריך ליצור מחדש את ה־session עם אותו מזהה — [Apple: Downloading files in the background](https://developer.apple.com/documentation/foundation/downloading-files-in-the-background).
- מקביליות: `httpMaximumConnectionsPerHost` ברירת מחדל 6, לכל session; "HTTP/2 and later run multiple requests over a single connection and thus ignore this property" — [Apple: httpMaximumConnectionsPerHost](https://developer.apple.com/documentation/foundation/urlsessionconfiguration/httpmaximumconnectionsperhost). דיווח פורום: עם `HTTPMaximumConnectionsPerHost = 1` "ALL tasks are being started immediately" (בגלל redirects ל־CDN) — [Forums 26390](https://developer.apple.com/forums/thread/26390); "dumping thousands of tasks on a background session does not end well" — [Forums 70682](https://developer.apple.com/forums/thread/70682).
- גודל: Quinn: "a URLSession background session should be able to deal with a 100 MB upload just fine" (Oct 2024) — [Forums 765196](https://developer.apple.com/forums/thread/765196); שאלת SO ישנה על כשלון העלאת 2GB ברקע (קבצים קטנים עברו) — [SO mirror](https://dev.library.kiwix.org/content/stackoverflow_en_nopic_2021-08/questions/26658491/nsurlsession-background-uploading-huge-files); דיווח watchOS ש־upload ברקע בוצע >100 פעמים לפני שהוחזר כהושלם (timeout בזמן שהשרת עדיין קולט) — דרך תוצאת חיפוש על [Forums threads](https://developer.apple.com/forums/thread/70682).
- iOS 17 Resumable uploads: "upload tasks are automatically resumable if the server supports the latest protocol draft"; זרימה: `Upload-Incomplete: ?0` → שרת מחזיר 104 עם `Location` → אחרי ניתוק HEAD לקבלת offset → PATCH; `cancelByProducingResumeData` + `uploadTask(withResumeData:)`; "background session will handle resumption automatically for both download and upload tasks, if the server supports it"; "If the task cannot be resumed, the system will automatically retry the task from the beginning"; "Background session always waits for connectivity" — [WWDC23 10006](https://developer.apple.com/videos/play/wwdc2023/10006/). `uploadTask(withResumeData:)` "Requires the server to support the latest resumable uploads Internet-Draft ... the file must still exist and be unmodified" — [Apple: URLSession](https://developer.apple.com/documentation/foundation/urlsession). Quinn: "My #1 suggestion is that you support resumable uploads" — [Forums 751757](https://developer.apple.com/forums/thread/751757).
- רשת ביטחון: Quinn ממליץ על `BGProcessingTaskRequest` ("typically overnight when the user charges their phone") כגיבוי — לבדוק מצב ה־session ולתזמן מחדש — [Forums 751757](https://developer.apple.com/forums/thread/751757), [Forums 765196](https://developer.apple.com/forums/thread/765196).
- R2 presigned: תוקף 1 שנייה עד 604,800 שניות (7 ימים); אותו URL ניתן לשימוש חוזר עד שפג — [Cloudflare R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/).
- בניית multipart/form-data בזיכרון לקובץ גדול בעייתית; צריך קובץ — [Forums 89044](https://developer.apple.com/forums/thread/89044).

### Inferences
- **R2 לא מדבר את פרוטוקול ה־IETF Resumable Upload** (אין 104) — לכן ה־resume האוטומטי של iOS 17 לא יחול על PUT ישיר ל־R2; ניתוק באמצע חלק = המערכת מתחילה את החלק מההתחלה. multipart של S3/R2 הוא ה־"resume" שלנו ברמת החלק. (לא אומת ישירות מול תיעוד R2 — ראו פערים.)
- **תכנון מומלץ ל־R2**: בחזית — CreateMultipartUpload בשרתון, לחתום מראש את כל ה־UploadPart URLs (תוקף 24–72 שעות, עד 7 ימים) → אין צורך לחתום מחדש ברקע; לחתוך את הקובץ ל־N קבצי־חלק (`FileHandle` + כתיבה, לא בזיכרון) ולהגיש את כל ה־upload tasks בבת אחת ל־session רקע אחד (כך עוקפים את ה־rate limiter שמעניש "משימה אחרי משימה"). בסוף, CompleteMultipartUpload — אפשר מהשרת (העובד יודע את ה־ETags? לא — הם מוחזרים ללקוח; לכן הלקוח מקבל אותם ב־delegate ברקע ושולח `complete` כשההשכמה האחרונה מגיעה, או שהשרת עושה ListParts ומשלים בעצמו).
- **עלות דיסק**: חיתוך מראש = עותק נוסף בגודל הקובץ (3GB וידאו → 3GB נוספים זמנית). חלופה: לחתוך בקבוצות (למשל 10 חלקים) וליצור את הבאים כשהמערכת מעירה — אבל אז ה־rate limiter מעכב את הקבוצות הבאות כשהאפליקציה ברקע. פשרה: לחתוך הכל מראש אם יש מקום פנוי (בדיקת `volumeAvailableCapacityForImportantUsage`), ולמחוק כל קובץ־חלק מיד כשהושלם.
- **ETag**: R2/S3 מחזיר ETag בכותרת התגובה של PUT; ב־background session ה־delegate מקבל את `HTTPURLResponse` ב־`didCompleteWithError`/`didReceive response`, כך שאפשר לאסוף אותם בהשכמות.
- **מקביליות**: אם R2 משרת HTTP/2 (סביר), `httpMaximumConnectionsPerHost` לא רלוונטי והמערכת מחליטה. אין מספרי throughput רשמיים — ברקע זה "discretionary" ויכול להיות איטי משמעותית מחזית.
- **מסך נעול**: background session ממשיך גם בנעילה (זה התכלית); כפייה ע"י המשתמש = ביטול — חובה UI שאומר "אל תסגור את האפליקציה מהמחליף".

### Gaps
- לא נמצא מדידת throughput אמיתית של background session להעלאות GB (מהירות מול foreground). צריך מדידה על מכשיר עם Background Networking Profile של Apple.
- לא אומת בתיעוד R2 שאין תמיכה ב־draft-ietf-httpbis-resumable-upload (סביר מאוד שאין, כי זה S3 API).
- לא נמצא מספר מקסימלי רשמי של משימות במקביל ב־background session.

## 3. BGContinuedProcessingTask (iOS 26), BGProcessingTask, ו־PhotoKit Background Upload (iOS 26.1)

### Takeaway (שורה תחתונה)
BGContinuedProcessingTask (iOS/iPadOS 26) הוא בדיוק "משימה ארוכה שהמשתמש התחיל, עם פס התקדמות ב־Live Activity": מותר לו להשתמש ברשת ולרוץ דקות ומעלה, אבל הוא נפגע בדיווחים ממסך נעול (iOS 26.1/26.2 beta, Dec 2025) ונבטל בסגירה מהמחליף. השילוב הנכון: ההעלאה עצמה ב־background URLSession, וה־continued task רק כדי להחזיק את האפליקציה חיה להכנת חלקים/השלמה ולהציג התקדמות. PhotoKit Background Resource Upload (iOS 26.1) מיועד לגיבוי ספריית תמונות, דורש גישה מלאה לספרייה ושרת עם פרוטוקול Resumable Upload — לא מתאים ל־R2 ישירות.

### Cited Findings
- הגדרה: "A task that starts in the foreground and can continue running in the background as needed"; מוצג ב־Live Activity והמשתמש יכול לבטל; "The system can terminate a continuous background task abruptly depending on run-time conditions"; המערכת מעדיפה לסיים משימות בלי התקדמות — [Apple: BGContinuedProcessingTask](https://developer.apple.com/documentation/backgroundtasks/bgcontinuedprocessingtask).
- רשת מותרת: "In the background, continuous background tasks can also use the network and perform intensive CPU-based operations"; דוגמאות: ייצוא וידאו, "Creating thumbnails for a new batch of photo uploads"; אסטרטגיית `.fail` נכשלת מיד "when the system reaches a maximum number of concurrent tasks"; "The system cancels any running tasks if a person closes the app in the app switcher, but the app doesn't receive an indication of cancellation" — [Apple: Performing long-running tasks](https://developer.apple.com/documentation/backgroundtasks/performing-long-running-tasks-on-ios-and-ipados).
- WWDC25 (session 227): "always start with an explicit action that someone performs in your app, like a button tap"; עבודה כמו "publishing social media content" מתאימה; "Avoid automatic workloads like maintenance, backups, or photo syncing"; "tasks that do not report any progress will be expired"; אם ההתקדמות איטית מהצפוי "the system will prompt the initiator, asking if they want the work to continue"; רישום דינמי ברגע הפעולה; ב־`.queue` נכנס לסוף התור — [WWDC25 227](https://developer.apple.com/videos/play/wwdc2025/227/).
- באג נעילה: Kevin Elliott (DTS, Aug 2025): "this is definitely a bug. The API was intended to keep the device awake..." — FB19916760, "should have been fixed" ב־26.1; אבל מפתח שמעלה מאות MB ל־S3 (AWS SDK) דיווח (Nov–Dec 2025, iOS 26.1 ו־26.2 beta 3): "Everything goes fine until we lock the screen, then the BGContinuedProcessingTask is expired even though the upload is still ongoing", רק במצב נעול באמת — FB21233240, בלי תשובה סופית — [Forums 796138](https://developer.apple.com/forums/thread/796138).
- דיווחים נוספים: עבד ב־26 RC ונשבר ב־26.0 הרשמי — [Forums 801126](https://developer.apple.com/forums/thread/801126); ה־expirationHandler לא מבחין בין ביטול משתמש לפקיעה — [Forums 818889](https://developer.apple.com/forums/thread/818889); משימה לא התחילה אחרי submit (שרשור עם אזכור API של iOS 27) — [Forums 838434](https://developer.apple.com/forums/thread/838434).
- BGProcessingTask: "typically delivered overnight when the user is asleep" — [Quinn, iOS Background Execution Limits](https://developer.apple.com/forums/thread/685525).
- PhotoKit Background Resource Upload: "The system manages uploads on your app's behalf, processing them in the background even when people switch to other apps or lock their devices"; iOS 26.1 דרך `PHBackgroundResourceUploadExtension` (deprecated ב־iOS 27, מוחלף ב־`PHBackgroundResourceUploadJobExtension`); דורש extension עם `com.apple.photos.background-upload`, `BackgroundUploadURLBase`, גישה מלאה לספרייה (`.readWrite` → `.authorized`); יעד = `URLRequest` (POST בדוגמה) עם כותרות אימות; מגבלת inflight jobs (`limitExceeded`); `retry(destination:)` מאפשר יעד חדש "with refreshed authorization"; השרת **חייב** לענות ל־OPTIONS עם `Upload-Limit` ולשלוח 104 עם `Location` ("Your API must include both") — [Apple: Uploading asset resources in the background](https://developer.apple.com/documentation/photokit/uploading-asset-resources-in-the-background.md). דיווחי מפתחים: `process()` לא נקרא בבדיקות, וקושי להפעיל ב־26.1 + שגיאת daemon ב־26.2 — [Forums 806834](https://developer.apple.com/forums/thread/806834), [Forums 806800](https://developer.apple.com/forums/thread/806800); Cult of Mac: "don't expect photo uploads to reliably work in the background right after updating to iOS 26.1" — [Cult of Mac](https://www.cultofmac.com/?p=914794).

### Inferences
- להעלאת וידאו לתרגום (פעולה יזומה, עם יעד מיידי) — BGContinuedProcessingTask עומד בכללי השימוש (בניגוד לגיבוי אוטומטי). כדאי לשלב: background URLSession מבצע, ה־continued task מחזיק את התהליך כדי לחתוך חלקים בהדרגה (חוסך דיסק), לקבל ETags, להשלים multipart ולהציג "מעלה 43%" ב־Live Activity. אם ה־continued task פג בנעילה — ה־URLSession ממשיך בכל זאת, וההשלמה תיעשה בהשכמה של `handleEventsForBackgroundURLSession` או בפתיחה הבאה.
- PhotoKit Upload: רלוונטי רק אם רוצים "גיבוי אוטומטי של כל הסרטונים", ודורש שרת שמממש את ה־IETF Resumable Upload (לא R2 ישירות — אפשר דרך Worker/שרתון שמתרגם ל־multipart). דרישת גישה מלאה לספרייה — מחסום פרטיות למשתמש. לא מומלץ לשלב ראשון.

### Gaps
- לא נמצא אישור שבאג הנעילה (FB21233240) תוקן ב־iOS 26.2+ או 27.
- לא נמצא מספר מקסימלי של continued tasks במקביל או זמן ריצה מרבי.

## 4. היברידי: Capacitor / Cordova / React Native / Expo / Flutter — מי באמת משתמש ב־background URLSession

### Takeaway (שורה תחתונה)
רוב התוספים הרציניים משתמשים ב־background URLSession ותומכים ב־PUT בינארי לכתובת presigned, אבל **אף אחד לא מממש S3 multipart מקבילי מובנה** — צריך לחתוך לחלקים בצד הנייטיב/JS ולהגיש כל חלק כמשימה. ההגבלה של force-quit חלה על כולם. מועמדים: Capawesome File Transfer (בתשלום, Capacitor 8), @capgo/capacitor-uploader (קוד פתוח), Flutter background_downloader, Expo FileSystem (background ברירת מחדל), react-native-background-upload (fork של openspacelabs).

### Cited Findings
- Capawesome File Transfer (הוכרז 27/08/2026, עודכן 19/10/2026): "Runs in the background URLSession"; הקובץ "streams straight from the file system into the request"; `uploadType: 'binary'` + `PUT` ל־S3 presigned; **"Uploads cannot be paused in this version"**; אחרי kill של מערכת — "Continued by the OS and delivered on relaunch"; אחרי force-quit — "restored as interrupted on relaunch, resumable"; "A force-quit canceling background work on iOS is an operating system rule that no plugin can bypass"; דורש Capacitor 8 ומנוי Capawesome Insiders; AppDelegate extension להעברת ה־completion handler — [Capawesome blog](https://capawesome.io/blog/announcing-the-capacitor-file-transfer-plugin/), [docs](https://capawesome.io/docs/sdks/capacitor/file-transfer/). "multipart" אצלם = multipart/form-data, לא S3 multipart.
- @capgo/capacitor-uploader (קוד פתוח): "upload files in the background with progress tracking, resumable uploads, and network-aware handling"; session רקע בשם `CapacitorUploaderBackgroundSession` — [README](https://unpkg.com/@capgo/capacitor-uploader@8.3.3/README.md); Capgo ממליצים: @capacitor/file-transfer להעברות קטנות, ה־uploader לתורי מדיה — [Capgo blog](https://capgo.app/blog/cordova-plugin-file-transfer-alternative/). (מקורות מטעם הספק.)
- @capacitor/background-runner: מבוסס BGTask; לפי Capgo — מוגבל לכ־30 שניות ב־iOS, ו־fetch מוגבל — [Capgo blog](https://capgo.app/blog/how-background-tasks-work-in-capacitor/); דורש Background Modes — [CocoaPods](https://cocoapods.org/pods/CapacitorBackgroundRunner). לא מתאים להעלאת GB.
- Expo FileSystem: `sessionType` ברירת מחדל background ב־iOS; בגרסאות חדשות: "its promise, progress callbacks, and cancellation state are only available while the original JS runtime is still alive" — [expo-file-system 57 types](https://app.unpkg.com/expo-file-system@57.0.1/files/src/NetworkTasks.types.ts); דיווח: העלאות עד 500MB נעצרו ברקע, תוקן עם BACKGROUND — [Expo forums](https://forums.expo.io/t/background-video-upload/46985); שגיאה -997 "Lost connection to background transfer service" — [Expo forums](https://forums.expo.dev/t/unable-to-upload-files-with-filesystem-uploadasync/55955).
- react-native-background-upload: ה־fork של openspacelabs "uses URLSession on iOS"; מצב `raw` מתאים ל־PUT presigned — [openspacelabs](https://github.com/openspacelabs/react-native-background-upload); forks אחרים תיקנו רק אנדרואיד — [cguino](https://github.com/cguino/react-native-background-upload).
- Flutter background_downloader: "Uses native URLSession on iOS"; "Uploads: Multipart, binary, and multi-file uploads"; parallel chunked רק להורדות; "Background transfers must complete within the system resource timeout" (ברירת מחדל 4 שעות, ניתן לשינוי) — [pub.dev](https://pub.dev/packages/background_downloader).
- cordova-plugin-background-upload: לא נבדק בסבב הזה.

### Inferences
- למוצר שלנו (PWA קיים), Capacitor הוא המסלול הקצר: ה־PWA רץ ב־WKWebView, ותוסף נייטיב קטן (או Capawesome/Capgo) מבצע PUT בינארי לכל חלק. סביר לכתוב תוסף Swift קטן משלנו (~300–500 שורות): חיתוך לחלקים, session רקע אחד, presigned URLs מהשרתון, איסוף ETags, ושמירת מצב — כי אף תוסף לא עושה S3 multipart.
- זמן מקסימלי של resource timeout (ברירת מחדל 7 ימים ב־URLSession; ב־background_downloader 4 שעות) — חשוב להגדיר ארוך כש־GB ברקע.

### Gaps
- לא נבדק cordova-plugin-background-upload ולא קוד המקור של התוספים (האם באמת `uploadTask(fromFile:)` ב־background config).
- מחיר מנוי Capawesome Insiders לא נמצא בעמוד.

## 5. עטיפת ה־PWA באפליקציית App Store (WKWebView) + גשר ל־URLSession; סיכוני ביקורת

### Takeaway (שורה תחתונה)
מעטפת WKWebView "ערומה" מסתכנת בדחייה לפי 4.2 ("repackaged website"); מעטפת עם יכולת נייטיב אמיתית (העלאה ברקע עם Live Activity, Push, קבצים מקומיים, Share Extension לקבלת וידאו מהגלריה) היא בדיוק הדבר שמצדיק אפליקציה. יש להשתמש ברקע רק לייעודו (2.5.4) — background URLSession הוא הייעוד הרשמי להעלאות גדולות.

### Cited Findings
- 4.2: "Your app should include features, content, and UI that elevate it beyond a repackaged website. If your app is not particularly useful, unique, or 'app-like,' it doesn't belong on the App Store"; 4.2.2: לא "web clippings, content aggregators, or a collection of links"; 2.5.6: דפדוף רק דרך WebKit; 2.5.4: "Multitasking apps may only use background services for their intended purposes: VoIP, audio playback, location, task completion, local notifications, etc." — [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/).
- Quinn: "Each of these mechanisms fulfils a specific purpose. Do not attempt to use them for some other purpose" + "To download or upload a large HTTP resource, use an URLSession background session" — [Forums 685525](https://developer.apple.com/forums/thread/685525).
- מקורות משניים (ספקים): מעטפת בלי אינטגרציה נייטיב היא סיבת הדחייה הנפוצה ב־4.2; Push, offline וניווט נייטיב מצוינים כפתרונות — [MobiLoud](https://www.mobiloud.com/blog/app-store-review-guidelines-webview-wrapper); שאלה בפורום Apple על PWA ארוז ב־WebView (בלי תשובה) — [Forums 829592](https://developer.apple.com/forums/thread/829592). 

### Inferences
- למעטפת THE SNOWBALL: להוסיף לפחות — העלאה ברקע נייטיב עם Live Activity (BGContinuedProcessingTask), Share Extension ("שתף ל־Studio" מאפליקציית התמונות/קבצים), Push נייטיב — זה מספיק כדי לעמוד ב־4.2 לפי ניסיון שוק (מקורות משניים).
- עלות: חשבון Apple Developer Program (תשלום שנתי) + Mac/Xcode או CI בענן לבנייה (לא אומת בסבב הזה — ראו פערים).
- PWABuilder iOS מייצר פרויקט Xcode של WKWebView — לא נבדק בסבב הזה אם כולל גשר להעלאות.

### Gaps
- מחיר Apple Developer Program לא נשלף בסבב הזה (ידוע כ־99$ לשנה — לא אומת כאן).
- PWABuilder iOS — לא נבדק.

## 6. איך אפליקציות גדולות עושות את זה (Google Photos, Dropbox, YouTube, WhatsApp, Telegram, Frame.io)

### Takeaway (שורה תחתונה)
לא נמצאו בלוגים הנדסיים פומביים של החברות האלה על העלאה ברקע ב־iOS. מה שמתועד: Google Photos ב־iOS היסטורית דרש להשאיר את האפליקציה פתוחה, וסגירה מהמחליף עוצרת גיבוי; ב־iOS 26.1 Apple הוסיפה הרחבת Background Resource Upload לאפליקציות גיבוי תמונות. גם אפליקציות גדולות כפופות לאותן מגבלות (force quit, discretionary).

### Cited Findings
- Google Photos (2019): "the iOS version of the app needs to remain open while backing up photos" — [9to5Google](https://9to5google.com/2019/06/04/google-photos-ios-13-background-api/); בלוג (02/05/2026): כשמחליקים את Google Photos מהמחליף "the app fully stops, and the backup goes with it" — [israynotarray](https://israynotarray.com/en/misc/2026/05/02/google-photos-backup-iphone-guide/); iOS 26.1 מוסיף Background Resource Upload לאפליקציות תמונות; לא ידוע אם Google Photos אימצה — [BGR](https://bgr.com/2008006/ios-26-1-background-upload-update/).
- ספקי ענן אחרים: "after closing the app, iOS typically allows around 30 seconds of background activity before suspending it"; "keep the app open and the phone connected to Wi‑Fi and power" — [Jottacloud help](https://docs.jottacloud.com/en/articles/2233504-background-uploads-on-ios), [Gigantti help](https://intercom.help/gigantticloud/en/articles/11737962-background-uploads-on-ios).
- WhatsApp: משתמש בפורום Apple טען שהוא ממשיך לסנכרן אחרי force-quit — טענת השואל בלבד, בלי הסבר DTS — [Forums 765196](https://developer.apple.com/forums/thread/765196).

### Inferences
- המסקנה המעשית שהשוק אימץ: UI שמבקש "השאר פתוח/מחובר לחשמל" + background session + השלמה בפתיחה הבאה. אין "קסם" נסתר זמין רק לגדולים מלבד PhotoKit (שזמין לכולם מ־26.1).

### Gaps
- לא נמצאו מקורות הנדסיים של Dropbox, YouTube, Telegram, Frame.io לגבי iOS. (Telegram משתמש ב־MTProto — לא אומת.) היה צורך בחיפושים ממוקדים נוספים.

## 7. חלופות למשתמש אייפון בלי אפליקציה

### Takeaway (שורה תחתונה)
הדרך הכי אמינה בלי אפליקציה שלנו: לתת לאפליקציה נייטיב קיימת שכבר עושה העלאה ברקע (Google Drive / iCloud Drive / Dropbox) להעלות, ואז השרת מושך מהענן (כבר יש לנו Drive). אחרת — PWA בחזית עם Wake Lock ו־multipart מתחדש.

### Cited Findings
- Wake Lock בדפדפן Safari 16.4+ ו־PWA מ־18.4 (ראו סעיף 1) — [WebKit 254545](https://bugs.webkit.org/show_bug.cgi?id=254545), [MDN BCD](https://chromium.googlesource.com/external/github.com/mdn/browser-compat-data/+/73d346309ee9d8be7e32fda8ff574d4c79dd4c51/api/WakeLock.json).
- אפליקציות הענן עצמן כפופות למגבלות iOS (Google Photos — סעיף 6), אבל הן נייטיב ולכן יכולות להשתמש ב־background session — [Apple: background(withIdentifier:)](https://developer.apple.com/documentation/foundation/urlsessionconfiguration/background(withidentifier:)).

### Inferences
- זרימה מומלצת ללא אפליקציה: בטלפון — "שתף → Google Drive" לתיקייה ייעודית (או בחירת קובץ שכבר ב־Drive מתוך ה־PWA דרך Google Picker), ואז השרתון/העובד מושך מ־Drive ישירות ל־R2 (שרת→שרת, מהיר, בלי הגבלות טלפון). זה מנצל את מנוע ההעלאה של אפליקציית Drive, שממשיך לפחות כמו אפליקציה נייטיב.
- Shortcuts (קיצורים): פעולת "Get Contents of URL" יכולה לבצע PUT של קובץ, אבל לא נמצא מקור שהיא רצה ברקע/בנעילה לקבצים של GB — סביר שלא אמין; לא לבנות עליו.
- iCloud Drive: אין API שרת־צד פשוט למשיכה מ־iCloud של משתמש (לא אומת) — Drive עדיף כי כבר מחובר אצלנו.

### Gaps
- לא נבדק בפועל אם Shortcuts ממשיך העלאה כשהמסך נעול.
- לא נבדק אם אפליקציית Google Drive ב־iOS ממשיכה העלאת GB ברקע/בנעילה (סביר, לא אומת).
