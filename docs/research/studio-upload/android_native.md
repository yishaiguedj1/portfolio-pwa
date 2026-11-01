# אנדרואיד נייטיב — העלאה מהירה ואמינה של וידאו גדול ל־R2 ברקע (מצב נובמבר 2026, Android 14–16)

> הערות מחקר. כל טענה עם מקור. מה שלא נמצא לו מקור — תחת "פערים". מידע ישן מסומן בתאריך.

## שאלה 1 — UIDT (`JobInfo.Builder.setUserInitiated`, Android 14+): מגבלות, זמן, רשת, התראה, Doze, דליים, יצרנים, מדיניות Play

### תמצית (Takeaway)
UIDT הוא ה־API שגוגל ממליצה עליו במפורש להעלאה שהמשתמש התחיל. לפי קוד המקור של AOSP (main) מובטחות לו **6 שעות לפחות**, **תקרה 12 שעות** לריצה ו־**24 שעות מצטברות** לפני הורדת דרגה. הוא פטור מ־Doze, מחיסכון בסוללה ומ־App Standby Buckets, ומקבל עקיפה של הגבלות הרשת. מה שעוצר אותו בפועל: "עצור" במנהל המשימות, חום, זיכרון נמוך, קיצור ה־constraint, והיצרנים (Xiaomi בעיקר).

### ממצאים עם מקורות (Cited Findings)
- UIDT נוסף ב־Android 14 (API 34). צריך הרשאה `RUN_USER_INITIATED_JOBS` ו־`JobService` עם `BIND_JOB_SERVICE`. אין ספריית Jetpack שתומכת בו; בגרסאות ישנות יותר ממליצים לחזור ל־WorkManager עם foreground service — [Android Developers: UIDT](https://developer.android.com/develop/background-work/background-tasks/uidt)
- מיועד ל"העברות ארוכות שהמשתמש התחיל". דורש התראה, מתחיל מיד, "may be able to run for an extended period of time as system conditions allow". אפשר להריץ כמה UIDT במקביל — [UIDT](https://developer.android.com/develop/background-work/background-tasks/uidt)
- **תזמון**: חייבים לתזמן כשהאפליקציה גלויה, או כשהיא רשאית להפעיל Activity מהרקע. משימה ב־Recents לבדה לא מספיקה. התנאים **שונים** מהפטורים להפעלת FGS מהרקע. אם התנאים לא מתקיימים — `RESULT_FAILURE` — [UIDT](https://developer.android.com/develop/background-work/background-tasks/uidt)
- **אילוצים נתמכים**: `setRequiredNetwork`/`setRequiredNetworkType`, `setEstimatedNetworkBytes`, `setMinimumNetworkChunkBytes`, `setPersisted`, `setBackoffCriteria(EXPONENTIAL)`, `setRequiresCharging`/`BatteryNotLow`/`StorageNotLow`, `setClipData`, `setNamespace` — [UIDT](https://developer.android.com/develop/background-work/background-tasks/uidt)
- **התראה**: לקרוא ל־`setNotification(params, id, notification, JOB_END_NOTIFICATION_POLICY_DETACH)` בתוך `onStartJob()`. ההתראה מופיעה בשורת המצב ובמנהל המשימות. לעדכן אותה מדי פעם עם ההתקדמות. מומלץ להוסיף בה כפתורי עצירה וחידוש — [UIDT](https://developer.android.com/develop/background-work/background-tasks/uidt); [שינויי Android 14](https://developer.android.com/about/versions/14/changes/user-initiated-data-transfers)
- **Standby Buckets**: "Unlike regular jobs, user-initiated data transfer jobs are unaffected by App Standby Buckets quotas" — [UIDT](https://developer.android.com/develop/background-work/background-tasks/uidt)
- **מתי המערכת עוצרת**: constraint שהגדרת כבר לא מתקיים; "הג'וב רץ יותר מהנדרש להעברה"; מצב תרמי; זיכרון נמוך (במקרה הזה `onStopJob()` לא נקרא). בשאר המקרים `onStopJob()` נקרא והמערכת מנסה שוב "בזמן אופטימלי". לכן צריך לשמור את מצב ההעברה גם בלי `onStopJob` — [UIDT](https://developer.android.com/develop/background-work/background-tasks/uidt)
- **"עצור" במנהל המשימות**: התהליך נהרג מיד, כולל כל ה־jobs וה־FGS. `onStopJob` לא נקרא, והמערכת **לא מתזמנת מחדש** jobs שגלויים למשתמש — [Android 14 UIDT](https://developer.android.com/about/versions/14/changes/user-initiated-data-transfers)
- **תקציב זמן — קוד המקור (AOSP main, `JobSchedulerService.java`)**:
  - `DEFAULT_RUNTIME_MIN_UI_GUARANTEE_MS = max(6h, 10min)`: זמן מינימלי מובטח.
  - `DEFAULT_RUNTIME_UI_LIMIT_MS = max(12h, 30min)`: תקרת ריצה.
  - `DEFAULT_RUNTIME_CUMULATIVE_UI_LIMIT_MS = 24h`: "maximum cumulative time ... before downgrading it".
  - `DEFAULT_RUNTIME_USE_DATA_ESTIMATES_FOR_LIMITS = false`, כלומר כברירת מחדל הערכת הבתים **לא** משנה את הזמן המובטח. אם הדגל דולק: זמן ההעברה המוערך × 1.35, ולא פחות מ־`RUNTIME_MIN_UI_DATA_TRANSFER_GUARANTEE_MS`.
  - אפליקציה שחרגה ממכסת ה־timeouts (`QUOTA_TRACKER_TIMEOUT_UIJ_TAG`) יורדת לתקרה של 30 דקות (`RUNTIME_FREE_QUOTA_MAX_LIMIT_MS`).
  — [AOSP JobSchedulerService.java](https://android.googlesource.com/platform/frameworks/base/+/refs/heads/main/apex/jobscheduler/service/java/com/android/server/job/JobSchedulerService.java). הערכים ניתנים לשינוי ב־DeviceConfig, ויצרן או גוגל יכולים לשנות אותם מרחוק.
- **Doze וחיסכון בסוללה (קוד המקור)**: `JobStatus.canRunInDoze()` ו־`canRunInBatterySaver()` מחזירים true כש־`shouldTreatAsUserInitiatedJob()` — [AOSP JobStatus.java](https://android.googlesource.com/platform/frameworks/base/+/refs/heads/main/apex/jobscheduler/service/java/com/android/server/job/controllers/JobStatus.java)
- **רשת בזמן Doze/Data Saver (קוד המקור)**: UIDT עם אילוץ רשת, באפליקציה שהמשתמש לא הגביל ברקע, נקשר עם `BIND_ALMOST_PERCEPTIBLE | BIND_BYPASS_POWER_NETWORK_RESTRICTIONS | BIND_BYPASS_USER_NETWORK_RESTRICTIONS`, כלומר עוקף גם את הגבלות הרשת של חיסכון החשמל וגם את Data Saver. אם המשתמש **הגביל** את האפליקציה ברקע, מקבלים רק `BIND_BYPASS_POWER_NETWORK_RESTRICTIONS` ובלי עדיפות foreground ("the app is most likely in the foreground...") — [AOSP JobServiceContext.java](https://android.googlesource.com/platform/frameworks/base/+/refs/heads/main/apex/jobscheduler/service/java/com/android/server/job/JobServiceContext.java)
- **דיווח בתים**: `JobService.updateEstimatedNetworkBytes(params, down, up)` מעדכן את ההערכה אחרי שהג'וב התחיל. `updateTransferredNetworkBytes(params, down, up)` "Tell JobScheduler how much data has successfully been transferred". המערכת קוראת ל־`getTransferredUploadBytes()` כשיש הערכת העלאה חיובית ולא דווח לאחרונה ("This must be implemented for all data transfer jobs"; בענף main מסומן חלקית `@hide`) — [AOSP JobService.java](https://android.googlesource.com/platform/frameworks/base/+/refs/heads/main/apex/jobscheduler/framework/java/android/app/job/JobService.java)
- **Android 16**: מכסות זמן הריצה של jobs רגילים ומהירים (expedited) מוחמרות. גם בדלי active יש מכסה. ג'וב שהתחיל כשהאפליקציה גלויה כפוף למכסה אחרי שהיא נעלמת. ג'וב שרץ במקביל ל־FGS כפוף למכסה, ובמקרה כזה גוגל ממליצה במפורש לעבור ל־UIDT. נוספו `getPendingJobReasonsHistory` ו־`STOP_REASON_TIMEOUT_ABANDONED` (כש־`JobParameters` נאסף ב־GC בלי `jobFinished`); `setImportantWhileForeground` כבר לא עושה כלום — [Android 16 behavior changes](https://developer.android.com/about/versions/16/behavior-changes-all)
- **מדיניות Play**: לגבי העברות רשת שהמשתמש ביקש במפורש, הדף של Play כותב: "we recommend using the user-initiated data transfer job" (ולא FGS מסוג dataSync). הוא מתאר את UIDT כ־API שמנהל לבד את מעקב האילוצים ואת ה־wakelock. ל־dataSync צריך הצהרה ב־Play Console עם תיאור, השפעה על המשתמש וסרטון — [Play: FGS requirements](https://support.google.com/googleplay/android-developer/answer/13392821). לפי סיכום החיפוש, מדיניות ה־UIDT דורשת שהמשתמש יתחיל את ההעברה, שזו העברת נתונים ברשת, ושהג'וב ירוץ רק כמה שצריך; אין להפעיל העברות אוטומטית — [Play policy (סיכום חיפוש)](https://support.google.com/googleplay/android-developer/answer/16559646?hl=en)
- **Xiaomi (MIUI/HyperOS)**: dontkillmyapp מדרג אותה בין הגרועות: "with default settings background processing simply does not work right". מה שעוזר: Autostart, Battery saver במצב "No restrictions", נעילה ב־Recents. לבדיקת Autostart יש כלי קוד פתוח (XomaDev/MIUI-autostart). הדף לא מזכיר HyperOS, והגרסה האחרונה שמופיעה בו היא MIUI 14 — [dontkillmyapp/xiaomi](https://dontkillmyapp.com/xiaomi)
- **Samsung**: "Sleeping/Deep sleeping apps" ו־Adaptive battery אגרסיביים יותר מ־AOSP. עדכון מ־07/2024 אומר ש־Samsung התחייבה להסיר את האופטימיזציות הלא־סטנדרטיות ב־One UI 6 (Android 14), ושב־FGS תקין זה אמור לעבוד. אין שם מידע על One UI 7/8 — [dontkillmyapp/samsung](https://dontkillmyapp.com/samsung)

### הסקות (Inferences)
- 6 שעות מובטחות מספיקות לכמה GB גם ב־10 Mbps (בערך 4.5 GB לשעה). הסיכון האמיתי הוא לא תקציב הזמן, אלא עצירה בגלל רשת, חום או המשתמש. לכן חידוש מנקודת העצירה (שמירת ה־parts שהושלמו אחרי כל part) הוא הכרחי.
- `setEstimatedNetworkBytes` לא משפיע כברירת מחדל על משך הזמן (הדגל כבוי), אבל זה מה שהתיעוד מבקש, וזה עשוי להשפיע על הצגה או על Doze בעתיד. כדאי לתת ערך מדויק (גודל הקובץ) ולעדכן ב־`updateTransferredNetworkBytes` כל part.
- כדי לתזמן UIDT מה־PWA צריך שהאפליקציה הנייטיב תהיה גלויה ברגע ה־`schedule()`. כלומר העברה מה־TWA תעבוד, כי ה־TWA היא Activity של האפליקציה, אבל העברה מלשונית Chrome רגילה דורשת לפתוח Activity נייטיב לרגע.
- כדאי לבדוק את `JobParameters.getStopReason()` ואת `getPendingJobReasonsHistory` (Android 16) ולשלוח אותם לטלמטריה, כדי לדעת אם ה־job נעצר בגלל רשת, חום, משתמש או יצרן.

### פערים (Gaps)
- אין מסמך רשמי שמציין את 6/12/24 השעות. המספרים מקוד המקור של main, ויצרנים יכולים לשנות אותם ב־DeviceConfig.
- לא מצאתי מקור שמתעד אם התראת UIDT ניתנת להחלקה, ואם יצרנים (Xiaomi/HyperOS, Huawei) מכבדים UIDT. לא נמצא דף Huawei עדכני.
- לא נמצאו נתוני שטח (Reddit / issue tracker) על הצלחת UIDT ב־HyperOS או ב־One UI 7/8.

## שאלה 2 — Foreground Service (dataSync, shortService, mediaProcessing) ומה גוגל ממליצה היום

### תמצית (Takeaway)
ב־Android 15+ (באפליקציה שמכוונת ל־35+) ל־dataSync ול־mediaProcessing יש **6 שעות ב־24 שעות** כשהאפליקציה ברקע, ואחרי זה `onTimeout`. shortService מוגבל לכ־3 דקות. ההמלצה הרשמית להעלאה שהמשתמש התחיל היא UIDT; FGS מסוג dataSync הוא חלופה עם הצהרה ב־Play.

### ממצאים עם מקורות (Cited Findings)
- "The system permits dataSync and mediaProcessing foreground services to run for a total of 6 hours in a 24-hour period". המגבלה נספרת לכל סוג בנפרד, ומשותפת לכל השירותים מאותו סוג באפליקציה. האיפוס קורה כשהמשתמש מביא את האפליקציה לחזית. אחרי `onTimeout(int,int)` יש "a few seconds" ל־`stopSelf()`, ואחרת `RemoteServiceException` (קריסה). אחרי שהזמן נגמר, הפעלה חדשה זורקת `ForegroundServiceStartNotAllowedException` — [FGS timeout](https://developer.android.com/develop/background-work/services/fgs/timeout)
- בדיקה מקומית: `adb shell am compat enable FGS_INTRODUCE_TIME_LIMITS <pkg>` ו־`device_config put activity_manager data_sync_fgs_timeout_duration <ms>` — [FGS timeout](https://developer.android.com/develop/background-work/services/fgs/timeout)
- עץ ההחלטה של גוגל: ההעברה התחילה מהמשתמש, צריך להציג התקדמות, ועצירה פוגעת בחוויה → UIDT. אחרת → WorkManager. FGS רק ל"short, critical tasks"; shortService ל"file processing under 3 minutes"; mediaProcessing ל־transcoding ("roughly 6 hours") — [Data transfer options](https://developer.android.com/develop/background-work/background-tasks/data-transfer-options)
- dataSync ב־Play: מותר להעלאה או הורדה שהמשתמש התחיל. אסור לגיבוי אוטומטי מלא ברקע. נדרשת הצהרה ב־App content עם סרטון — [Play FGS](https://support.google.com/googleplay/android-developer/answer/13392821)
- מ־Android 14 חובה להצהיר על סוג לכל FGS, אחרת `startForeground()` זורק חריגה — [FGS types required](https://developer.android.com/about/versions/14/changes/fgs-types-required)

### הסקות (Inferences)
- לסרטון של כמה GB ב־mobile, 6 השעות של dataSync מספיקות בדרך כלל, אבל הן מצטברות לכל היום. כמה העלאות גדולות ברצף בלי לפתוח את האפליקציה עלולות למצות אותן. UIDT עדיף כי הוא עוקף את מכסת ה־FGS ומקבל 24 שעות מצטברות.
- mediaProcessing מתאים לשלב דחיסה או transcoding לפני ההעלאה (אם יתווסף), לא להעלאה עצמה.

### פערים (Gaps)
- דף ה־timeout לא מציין אם החלון של 24 השעות מתגלגל או קבוע.
- לא נמצאו שינויי FGS ספציפיים ב־Android 16 מעבר לנושא מכסות ה־jobs.

## שאלה 3 — WorkManager: workers ארוכים (`setForeground`), expedited, והשוואה ל־UIDT

### תמצית (Takeaway)
WorkManager עם `setForeground` מפעיל FGS בשבילך (צריך `foregroundServiceType` מ־Android 14), אבל ב־Android 16 workers ארוכים "can exhaust your app's job quota". expedited מקבל רק 3 דקות מובטחות. להעלאה שהמשתמש התחיל, גוגל עצמה מפנה ל־UIDT. WorkManager מתאים ל־fallback (API<34) ולהעלאות אוטומטיות קצרות.

### ממצאים עם מקורות (Cited Findings)
- "Under the hood, WorkManager manages and runs a foreground service on your behalf". `CoroutineWorker.setForeground()`; מ־Android 14 חובה סוג FGS (override ל־`SystemForegroundService` עם `tools:node="merge"`). `createCancelPendingIntent` לכפתור ביטול — [WorkManager long-running](https://developer.android.com/develop/background-work/background-tasks/persistent/how-to/long-running)
- "Starting with Android 16, long running workers (which use foreground services) can exhaust your app's job quota". להורדה או העלאה שהמשתמש התחיל מומלץ UIDT, "exempt from the ordinary job quotas" — [WorkManager long-running](https://developer.android.com/develop/background-work/background-tasks/persistent/how-to/long-running)
- WorkManager: "jobs taking longer than 10 minutes will be rescheduled"; "free to cancel and retry" — [Data transfer options](https://developer.android.com/develop/background-work/background-tasks/data-transfer-options)
- קוד המקור: ג'וב רגיל מקבל 10 דקות מובטחות (`DEFAULT_RUNTIME_MIN_GUARANTEE_MS`) ו־expedited מקבל 3 דקות (`DEFAULT_RUNTIME_MIN_EJ_GUARANTEE_MS`, ו־5 דקות לכל היותר בדלי RESTRICTED). EJ לא מקבל יותר מ־10 דקות ("There's little reason to let them run longer than the normal 10 minutes") — [AOSP JobSchedulerService.java](https://android.googlesource.com/platform/frameworks/base/+/refs/heads/main/apex/jobscheduler/service/java/com/android/server/job/JobSchedulerService.java)
- Dropbox (03/2022) כתבה מחדש את Camera Uploads ב־Kotlin עם WorkManager ו־Room: worker "scanner" ו־worker "uploader" שמעלה את התור באצוות. "The rewrite does not escape these background restrictions" — [Dropbox tech blog](https://dropbox.tech/mobile/making-camera-uploads-for-android-faster-and-more-reliable)

### הסקות (Inferences)
- הארכיטקטורה המומלצת: UIDT ב־API 34+, ו־WorkManager עם `setForeground(dataSync)` ב־API 26–33. את הלוגיקה (מנוע ה־multipart והמצב ב־Room/קובץ) כותבים פעם אחת, וכל אחת מהמעטפות מפעילה אותה.
- לא להריץ UIDT במקביל ל־FGS אחר של אותה אפליקציה בשביל ה"ביטחון": זה מיותר, ובשילוב עם jobs רגילים ב־Android 16 זה פוגע במכסה.

### פערים (Gaps)
- לא נמצאה השוואת ביצועים מדודה בין UIDT ל־WorkManager+FGS.

## שאלה 4 — כוונון קצב: OkHttp/Cronet, HTTP/2 מול כמה חיבורים, QUIC, WifiLock, WakeLock, באפרים, גודל part ומקביליות

### תמצית (Takeaway)
בהעלאה גדולה ל־S3/R2 מה שקובע הוא **כמה חיבורי TCP נפרדים** (לא כמה streams על חיבור HTTP/2 אחד) ו**גודל part** שמאזן בין overhead לעלות ניסיון חוזר. QUIC/Cronet לא מוכח כמהיר יותר בקבצים גדולים, ועולה יותר CPU. WifiLock מסוג HIGH_PERF הוצא משימוש ב־Android 14, ו־LOW_LATENCY פועל רק כשהמסך דולק והאפליקציה בחזית. UIDT כבר מנהל wakelock בעצמו.

### ממצאים עם מקורות (Cited Findings)
- **HTTP/2 בהעלאות**: Cloudflare מצאה שהעלאה ב־HTTP/2 יכולה להיות איטית בערך פי 2 מ־HTTP/1.1 בקווים מהירים, בגלל חלון flow control קבוע לכל stream בצד המקבל. ב־5 Mbps לא היה הבדל. autotuning של הבאפר תיקן את זה בשרתים שלהם — [Cloudflare blog: HTTP/2 upload speed](https://blog.cloudflare.com/delivering-http-2-upload-speed-improvements/)
- דיווח (פורום Apple): כמה העלאות על חיבור HTTP/2 אחד נשלחו כמעט בטור. לפי המדווח, OkHttp באנדרואיד משלב את הגוף ב־frames של 16KB — [Apple dev forums 839864](https://developer.apple.com/forums/thread/839864) (מקור משני, אנקדוטלי)
- **Cronet/QUIC**: גוגל מספקת שכבת Cronet ל־OkHttp, והיתרון המוצהר הוא "QUIC/HTTP3 support or features like connection migration", לא קצב — [Cronet integration](https://developer.android.com/develop/connectivity/cronet/integration)
- מחקר 2022 (Google Drive, לא אנדרואיד): TLS1.2/TCP נתן קצב **גבוה** יותר מ־QUIC בקבצים מעל 20MB (עד 2GB). QUIC צרך כמעט פי 2 CPU בהורדה של 200MB — [QUIC TNSM 2022](https://vaibhavbajpai.com/documents/papers/proceedings/quic-tnsm-2022.pdf)
- מבחן קטן (Android 8, 2017): Cronet/QUIC מול OkHttp/HTTP2 — בלי אובדן מנות כמעט אין הבדל ב־1MB — [Quic-Bench](https://github.com/GodRightHand/Quic-Bench) (אנקדוטלי)
- **WifiLock**: `WIFI_MODE_FULL_HIGH_PERF` מסומן deprecated ב־API diff של Android 14 (u-dp1) — [API diff u-dp1](https://developer.android.com/sdk/api_diff/u-dp1/changes/android.net.wifi.WifiManager). מצב low-latency נכנס לפעולה רק כש־"app holds a Wi-Fi lock while in the foreground, and the screen is on", ואז power save של ה־Wi‑Fi כבוי — [AOSP Wi‑Fi low latency](https://source.android.com/docs/core/connect/wifi-low-latency). דיווח משתמש: מ־Android 14 כל `createWifiLock(int,…)` מומר ל־LOW_LATENCY — [swiftp #222](https://github.com/ppareit/swiftp/issues/222) (לא רשמי)
- **WakeLock**: UIDT מנהל wakelock אוטומטית ("automatic wakelock management") — [Play FGS FAQ](https://support.google.com/googleplay/android-developer/answer/13392821). ב־Samsung עם Android 11, wake locks ב־FGS נחסמו כברירת מחדל (2021) — [dontkillmyapp/samsung](https://dontkillmyapp.com/samsung)
- **מגבלות R2**: אובייקט עד 5 TiB; single PUT עד 5 GiB; multipart עד 4.995 TiB; **10,000 parts**; "1 per second" כתיבה במקביל לאותו key (אחרת 429) — [R2 limits](https://developers.cloudflare.com/r2/platform/limits/). מינימום 5 MiB לכל part חוץ מהאחרון (מקורות משניים מסכימים); כל ה־parts חוץ מהאחרון **באותו גודל** (מקור משני); presigned עובד רק על נקודת הקצה S3 (`*.r2.cloudflarestorage.com`), לא על דומיין מותאם — [flaviocopes](https://flaviocopes.com/courses/cloudflare/design-browser-and-multipart-uploads/), [dev.to](https://dev.to/alexisfranorge/cloudflare-r2-in-net-without-the-aws-sdk-headaches-52a0). rclone של Cloudflare: "larger part sizes will use fewer operations, but might be costly to retry" — [Cloudflare rclone](https://developers.cloudflare.com/r2/examples/rclone)
- **Telegram (פרוטוקול רשמי)**: part עד 512KB, ו־512KB הוא הגודל המומלץ. מעלים X parts בבת אחת בתור מקומי, ולקצב גבוה יותר משתמשים ב־Y תורים על **חיבורי TCP נפרדים**, ב־sessions ייעודיים לקבצים — [core.telegram.org/api/files](https://core.telegram.org/api/files)
- **Firebase Storage**: לפי issue, `UPLOAD_POOL_SIZE` באנדרואיד הוא 2 — [firebase-android-sdk #6850](https://github.com/firebase/firebase-android-sdk/issues/6850). ב־Google APIs (Dart) ה־chunk ברירת מחדל 1MB, בכפולות של 256KB — [ResumableUploadOptions](https://pub.dev/documentation/firebaseapis/latest/storage_v1/ResumableUploadOptions-class.html) (לא אנדרואיד)

### הסקות (Inferences)
- R2 על `r2.cloudflarestorage.com` כנראה מנהל ALPN h2, ואז OkHttp יעביר את 4 ההעלאות **על חיבור TCP אחד** (connection pooling ב־HTTP/2). התוצאה: חלון גודש אחד, head-of-line, ו־flow control. כדי לקבל 4 חיבורים אמיתיים: `OkHttpClient.Builder().protocols(listOf(Protocol.HTTP_1_1))` ל־client של ההעלאה, ו־`ConnectionPool`/`Dispatcher.maxRequestsPerHost` ≥ מספר החיבורים. **זה הדבר הראשון לבדוק בקוד הקיים.**
- מקביליות: 4–6 חיבורים ב־Wi‑Fi/5G, 2–3 ב־LTE חלש. עדיף אדפטיבי לפי קצב מדוד (להוסיף חיבור כל עוד הקצב הכולל עולה ביותר מ־~10%).
- גודל part: 8–16 MiB הוא איזון טוב למובייל (הפסד קטן בניסיון חוזר, ו־10,000 parts × 16MiB = 156GiB, יותר ממספיק). מעל ~40GB צריך להגדיל. חובה גודל קבוע, וכל part נשמר בנפרד.
- לא להשתמש ב־Cronet רק בשביל הקצב. היתרון שלו (connection migration בין Wi‑Fi לסלולר) רלוונטי, אבל R2/S3 presigned לא בהכרח מדבר HTTP/3 (ראו פערים).
- WifiLock לא יעזור כשהמסך כבוי באנדרואיד 14+. המקור העיקרי לאיטיות במסך כבוי הוא כנראה Wi‑Fi power save ו־CPU, ו־UIDT כבר מחזיק את המעבד ער.
- לקרוא את הקובץ בבאפר גדול (למשל 256KB–1MB) ב־`RequestBody.writeTo` כדי לחסוך syscalls. לשקול `Content-MD5`/`x-amz-checksum` רק אם ה־CPU לא צוואר בקבוק.

### פערים (Gaps)
- לא מצאתי אישור רשמי אם נקודת הקצה S3 של R2 תומכת ב־HTTP/3 או רק ב־h2/http1.1.
- אין מקור על כוונון `SO_SNDBUF` באנדרואיד להעלאות. ל־OkHttp אין מקור רשמי ל־`socketFactory` עם באפר מותאם.
- לא נמצא benchmark מדוד של Cronet מול OkHttp בהעלאות גדולות באנדרואיד.
- גודל ה־part המינימלי של R2 (5MiB) וכלל הגודל הזהה מגיעים ממקורות משניים. דף ה־limits הרשמי לא מציין אותם.

## שאלה 5 — קריאת הקובץ: content URI מ־SAF/Photo Picker, הרשאות מתמשכות, קריאה ברקע, בלי העתקה

### תמצית (Takeaway)
URI מה־Photo Picker תקף כברירת מחדל רק עד אתחול המכשיר או עד שהאפליקציה נעצרת. להעלאה ארוכה ברקע גוגל ממליצה במפורש על `takePersistableUriPermission` (עד 5,000 הרשאות). קוראים ישירות דרך `ContentResolver.openInputStream`/`openFileDescriptor` עם seek לכל part, בלי להעתיק.

### ממצאים עם מקורות (Cited Findings)
- "By default, the system grants your app access to media files until the device is restarted or until your app stops". להעלאה ארוכה ("uploading a large file in the background") צריך `contentResolver.takePersistableUriPermission(uri, FLAG_GRANT_READ_URI_PERMISSION)`. יש תקרה של 5,000 media grants, ומעליה הישנה ביותר נמחקת. יש backport דרך Google Play services ל־API 19–29 — [Photo picker](https://developer.android.com/training/data-storage/shared/photo-picker)
- `setClipData()` הוא אילוץ נתמך ב־UIDT, כך שאפשר להצמיד URI עם הרשאה לג'וב — [UIDT](https://developer.android.com/develop/background-work/background-tasks/uidt)

### הסקות (Inferences)
- עדיף `openFileDescriptor(uri,"r")` → `FileInputStream.channel.position(offset)` (או `ParcelFileDescriptor` + `FileChannel`) לכל part, כך שכל חיבור קורא את הטווח שלו בלי העתקה. יש ספקים (cloud providers) שלא תומכים ב־seek, ולכן צריך fallback לקריאה רציפה.
- `setClipData(ClipData.newRawUri(...), FLAG_GRANT_READ_URI_PERMISSION)` מעביר את ההרשאה לג'וב, גם אם ההרשאה לא נשמרה כמתמשכת. זה חשוב ל־URI שמגיע משיתוף (ACTION_SEND), שלא תמיד ניתן להפוך למתמשך.
- לשמור במצב ה־multipart גם את `uri`, `size` ו־`lastModified`, כדי לזהות שהקובץ השתנה לפני חידוש.

### פערים (Gaps)
- לא נבדק במקור רשמי אם URI זמני (לא מתמשך) נשאר תקף ל־UIDT שרץ אחרי שה־Activity נסגר אבל התהליך חי.
- לא נבדק אם `takePersistableUriPermission` עובד על URI שמגיע מ־ACTION_SEND (בדרך כלל לא — רק מ־ACTION_OPEN_DOCUMENT/Photo Picker).

## שאלה 6 — העברה מדף ווב/TWA לאפליקציה הנייטיב, וחידוש מצב ה־multipart בין ווב לנייטיב

### תמצית (Takeaway)
מ־Chrome 115 יש ערוץ postMessage דו־כיווני בין TWA לאפליקציה המארחת, עם אימות מקור דרך Digital Asset Links (`use_as_origin`). הוא מעביר הודעות (מחרוזות), לא קבצים. לכן ההעברה צריכה להעביר **מזהי מצב** (`uploadId`, key, parts שהושלמו), והקובץ עצמו צריך להגיע לנייטיב כ־URI: שהנייטיב יבחר אותו בעצמו, או דרך שיתוף.

### ממצאים עם מקורות (Cited Findings)
- postMessage ב־TWA: Chrome 115.0.5790.13+, androidx.browser ≥ 1.6.0-alpha02. מצהירים על `PostMessageService` ב־manifest, ומ־`onNavigationEvent` קוראים ל־`requestPostMessageChannel(SOURCE_ORIGIN, TARGET_ORIGIN, Bundle())`. שולחים ב־`mSession.postMessage` ומקבלים ב־`onPostMessage(String, Bundle)`. בצד הווב: `event.ports[0]` ו־`port.postMessage`. האימות עובר דרך assetlinks עם `delegate_permission/common.use_as_origin`. חובה לבדוק את `event.origin` (עודכן 26/07/2023) — [Chrome: postMessage TWA](https://developer.chrome.com/docs/android/post-message-twa)
- הדף לא מזכיר העברת קבצים, וחתימת `onPostMessage` היא `String` — [Chrome: postMessage TWA](https://developer.chrome.com/docs/android/post-message-twa)

### הסקות (Inferences)
- זרימה מומלצת ב־TWA: המשתמש לוחץ "העלה" בדף, הדף שולח `{op:'native-upload?'}`, והנייטיב עונה `{capable:true}`. אז הנייטיב פותח Photo Picker משלו (Activity גלויה, ולכן מותר לתזמן UIDT), מקבל URI מתמשך, ומעלה. הדף מקבל התקדמות ב־postMessage כל עוד הוא פתוח, ובמקביל דרך השרת/Firestore כשהוא לא פתוח.
- חלופה: Web Share Target. הנייטיב מצהיר על intent-filter ל־`ACTION_SEND video/*`, והדף קורא ל־`navigator.share({files})`. ככה File מהווב מגיע לנייטיב כ־content URI. צריך לבדוק אם Chrome מעתיק את הקובץ לפני השיתוף (העתקה של GB).
- חידוש בין ווב לנייטיב: לשמור את מצב ה־multipart בשרת (השרתון): `uploadId`, key, גודל part קבוע ורשימת ETags. כל צד שואל `ListParts` (או את המצב בשרת) וממשיך. לא להחזיק את המצב רק ב־IndexedDB או ב־Room.
- מלשונית Chrome רגילה (לא TWA) אפשר רק intent:// או App Link לפתיחת הנייטיב. אי אפשר לתזמן UIDT בלי Activity גלויה.

### פערים (Gaps)
- לא נמצא מקור אם Chrome ב־Web Share מעתיק קבצים גדולים לקאש לפני השיתוף, ומה מגבלת הגודל.
- אין תיעוד רשמי לגודל מקסימלי של הודעת postMessage ב־TWA.

## שאלה 7 — ספריות: gotev android-upload-service, AWS TransferUtility, tus, Firebase Storage

### תמצית (Takeaway)
אף ספרייה מוכרת לא נמצאה כתומכת ב־UIDT. ה־SDK של AWS לאנדרואיד בתחזוקה בלבד (מ־08/2025) ו־end of support מתוכנן; gotev מתועד עד Android 14 בלבד; ל־Firebase יש pool של 2. מנוע multipart מותאם על OkHttp בתוך UIDT הוא כנראה הבחירה הנכונה, וזה מה שכבר קיים.

### ממצאים עם מקורות (Cited Findings)
- gotev: לפי מראה של ה־README (בערך 2023) הספרייה תומכת ב־API 21–34, ו־3.x לא נתמך ("use 4.x"). לא נמצא מידע על UIDT או סטטוס 2025–26 — [codekk mirror](https://p.codekk.com/detail/5c4193b2fd1c9b26e2fcc742)
- AWS TransferUtility: `TransferNetworkLossHandler` (v2.11.0) הוא BroadcastReceiver שעוצר וממשיך העברות לפי שינויי רשת. `TransferService` עובר ל־foreground מ־Android 8 ודורש התראה. multipart אוטומטי מעל 5MB — [release v2.11.0](https://github.com/aws-amplify/aws-sdk-android/releases/tag/release_v2.11.0), [Amplify Gen1 Transfer Utility](https://docs.amplify.aws/gen1/android/sdk/storage/transfer-utility/). ה־SDK בתחזוקה מ־1/8/2025, ו־end of support מוזכר ל־1/8/2026, אבל דף אחר מציין 1/5/2027 ל־Gen 1 (סתירה בין המקורות) — [Amplify Transfer Utility](https://docs.amplify.aws/android/sdk/storage/transfer-utility/)
- Firebase Storage Android: `UPLOAD_POOL_SIZE` = 2 (issue) — [#6850](https://github.com/firebase/firebase-android-sdk/issues/6850)

### הסקות (Inferences)
- הספריות האלה בנויות סביב Service/FGS ישן ולא מנצלות UIDT, ולכן לא שווה לעבור אליהן. מהן כדאי לקחת רק את הדפוסים: האזנה לשינויי רשת → pause/resume, ו־multipart קבוע עם מצב מתמשך.
- tus לא רלוונטי ל־R2, כי R2 לא מדבר tus בלי Worker מתווך.

### פערים (Gaps)
- לא נבדקו tus-android-client ו־Uppy Android (לא חיפשתי).
- לא אומת בקוד המקור ה־chunk size של Firebase Storage Android.

## שאלה 8 — איך Google Photos, YouTube, Dropbox, WhatsApp ו־Telegram עושים העלאה ברקע

### תמצית (Takeaway)
המקור הראשוני היחיד שנמצא הוא Dropbox (WorkManager + Room, 2022). ל־Telegram יש תיעוד פרוטוקול רשמי שממליץ על parts קבועים ועל כמה חיבורי TCP נפרדים. על Google Photos, YouTube ו־WhatsApp לא נמצא חומר הנדסי פומבי.

### ממצאים עם מקורות (Cited Findings)
- Dropbox Camera Uploads (03/2022): כתיבה מחדש מ־C++ משותף ל־Kotlin עם WorkManager ו־Room; scanner ו־uploader; "WorkManager ... guaranteeing that uploads are attempted if, and only if, network access becomes available" — [dropbox.tech](https://dropbox.tech/mobile/making-camera-uploads-for-android-faster-and-more-reliable)
- Telegram: parts קבועים (512KB מומלץ), כמה בקשות במקביל לכל תור, כמה תורים על חיבורי TCP נפרדים, ו־sessions ייעודיים לקבצים — [core.telegram.org/api/files](https://core.telegram.org/api/files)

### הסקות (Inferences)
- הדפוס המשותף: תור מתמשך ב־DB, parts קבועים, חידוש לפי part, ומקביליות על **חיבורים נפרדים**. בדיוק אותו מבנה כמו multipart ל־R2 עם 4 חיבורים.

### פערים (Gaps)
- לא נמצאו פוסטים הנדסיים או הנדסה הפוכה על Google Photos, YouTube או WhatsApp (אם הם משתמשים ב־UIDT, ב־FGS או ב־WorkManager).
- לא נבדק קוד המקור של Telegram-Android (`FileUploadOperation`) כדי לדעת את מספר החיבורים בפועל.
