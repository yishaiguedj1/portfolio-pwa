# העלאת וידאו גדול ברקע מדף ווב / PWA / TWA ב־Chrome לאנדרואיד (מצב נובמבר 2026)

> הערת שיטה: רוב הממצאים הקשים כאן נלקחו **ישירות מקוד המקור של Chromium בענף `main`** (נשלף ב־01/11/2026 דרך `chromium.googlesource.com`), כי התיעוד הרשמי של Background Fetch לא עודכן מאז 2018. כל קבוע שמצוין ניתן לשינוי ב־Finch (ניסויי שרת של גוגל), כך שהערך בפועל במכשיר יכול להיות שונה מברירת המחדל שבקוד.

## 1. Background Fetch API — איך Chrome מתזמן, מגבלות, באגים, מסך כבוי

### Takeaway
ה־5x איטיות מוסברת ישירות מהקוד: Background Fetch מריץ **לכל היותר 2 בקשות במקביל בכל הדפדפן** (לא 4), **רישום אחד בלבד לכל origin בכל רגע** (רישומים נוספים מאותו origin עומדים בתור), בעדיפות `NORMAL` של שירות ההורדות ש"דורשת שהמכשיר במנוחה או ש־Chrome רץ", וכשה־Chrome לא רץ ההמשך נקבע ע"י משימת רקע של מערכת ההפעלה בחלון של 5 דקות עד 8 שעות — מה שמסביר "תקיעה" במסך כבוי. בנוסף: בקשה cross-origin שדורשת preflight (כמו `PUT` ל־presigned URL של R2) **נכשלת מיד** ב־Background Fetch.

### Cited Findings
- **מקביליות כוללת = 2**: `kMaxRunningDownloadsDefaultValue = 2` — "The maximum number of downloads the Download Service can process at the same time" (עם TODO לסנכרן עם ערך שירות ההורדות, crbug 40608586) — [background_fetch_scheduler.cc](https://chromium.googlesource.com/chromium/src/+/main/content/browser/background_fetch/background_fetch_scheduler.cc)
- **רישומים פעילים = 2, ממקורות שונים בלבד**: `kMaxActiveRegistrationsDefaultValue = 2` — "The active registrations are from distinct origins"; ב־`ScheduleDownload()` רישום חדש מופעל רק אם ה־storage key שלו **לא** כבר פעיל ("Make sure the storage key is not already active"). כלומר כמה רישומים מאותו אתר רצים **בזה אחר זה**, לא במקביל — [background_fetch_scheduler.cc](https://chromium.googlesource.com/chromium/src/+/main/content/browser/background_fetch/background_fetch_scheduler.cc)
- **בתוך רישום אחד**: המתזמן מוציא בקשה אחת בכל פעם מהרישום (LRU) ומגלגל בין הרישומים הפעילים, עד שמגיע לתקרת `max_running_downloads` (2). כלומר רישום אחד עם הרבה בקשות יכול להריץ עד 2 במקביל, ואם יש שני אתרים פעילים — כל אחד מקבל בערך אחת — [background_fetch_scheduler.cc](https://chromium.googlesource.com/chromium/src/+/main/content/browser/background_fetch/background_fetch_scheduler.cc)
- **שירות ההורדות עצמו (Download Service, משותף לכל הלקוחות ב־Chrome)**: `kDefaultMaxConcurrentDownloads = 4`, `kDefaultMaxRunningDownloads = 2`, `kDefaultMaxScheduledDownloads = 15`, `kDefaultMaxRetryCount = 5`, `kDefaultMaxResumptionCount = 15`, `kDefaultPendingUploadTimeoutDelay = 30s` ("The default timeout for a pending upload"), `kDefaultDownloadBatteryPercentage = 50`, `kDefaultNetworkStartupDelayBackgroundTask = 5s` — [download background_service config.cc](https://chromium.googlesource.com/chromium/src/+/main/components/download/internal/background_service/config.cc)
- **חלון משימת הרקע כש־Chrome לא רץ**: `kDefaultWindowStartTime = 5 דקות`, `kDefaultWindowEndTime = 8 שעות` (חלון התזמון של משימת הרקע שמעירה את שירות ההורדות) — [config.cc](https://chromium.googlesource.com/chromium/src/+/main/components/download/internal/background_service/config.cc)
- **עדיפות**: `BackgroundFetchDelegateBase` בונה `DownloadParams` **בלי לקבוע** `scheduling_params`, ולכן חלים ערכי ברירת המחדל: `priority = DEFAULT (= NORMAL)`, `network_requirements = NONE`, `battery_requirements = BATTERY_INSENSITIVE` — [background_fetch_delegate_base.cc](https://chromium.googlesource.com/chromium/src/+/main/components/background_fetch/background_fetch_delegate_base.cc), [download_params.cc](https://chromium.googlesource.com/chromium/src/+/main/components/download/public/background_service/download_params.cc)
- **משמעות NORMAL**: "The normal priority. Requires that the device is idle or Chrome is running. Gets paused or postponed during on-going navigation." לעומת `HIGH` ("Does not require the device to be idle") ו־`UI` ("act … as a user-initiated download") — [download_params.h](https://chromium.googlesource.com/chromium/src/+/main/components/download/public/background_service/download_params.h)
- **CORS preflight חסום**: `RequiresCorsPreflight()` — "Requests that require CORS preflights are temporarily blocked, because the browser side of Background Fetch doesn't yet support performing CORS checks. TODO(crbug.com/40515511)". בקשה cross-origin עם method שאינו safelisted (כל `PUT`) או header לא בטוח → `FETCH_ERROR` מיידי בלי לשלוח. בקשה same-origin פטורה — [background_fetch_job_controller.cc](https://chromium.googlesource.com/chromium/src/+/main/content/browser/background_fetch/background_fetch_job_controller.cc)
- **העלאות קיימות היום בקוד** (בניגוד לבלוג מ־2018): יש `has_request_body`, `GetUploadData()`, ספירת `uploaded`/`upload_total` והתקדמות העלאה לכל בקשה — [background_fetch_delegate_base.cc](https://chromium.googlesource.com/chromium/src/+/main/components/background_fetch/background_fetch_delegate_base.cc), [background_fetch_job_controller.cc](https://chromium.googlesource.com/chromium/src/+/main/content/browser/background_fetch/background_fetch_job_controller.cc)
- הבלוג הרשמי (עודכן לאחרונה 03/12/2018) עדיין אומר "Chrome's implementation currently only accepts requests without a body"; על אנדרואיד "the browser can close after the fetch starts because the OS can take over"; offline → מושהה וממשיך; ID ייחודי; "Requests that need a CORS preflight aren't supported"; חובה `downloadTotal` (חריגה = ביטול); אין גבול גודל מפורש, רק `quota-exceeded` — [Chrome for Developers: Introducing Background Fetch](https://developer.chrome.com/blog/background-fetch)
- דיווח מפתחים ב־Intent to Ship (2019): ניסיון העלאה החזיר `fetch-error`; ובמקור הניסוי "only downloads were supported" — [blink-dev Intent to Ship](https://groups.google.com/a/chromium.org/g/blink-dev/c/-iAATJCpcNY), [Intent to Experiment](https://groups.google.com/a/chromium.org/g/blink-dev/c/z5WX-2RMulo/m/JQqeF3XZAgAJ)
- הצעת WICG: על אנדרואיד צפויה התראה דביקה; אין מנגנון HTTP לחידוש העלאה — [WICG/background-fetch](https://github.com/WICG/background-fetch)
- אבטחה: CVE-2026-1504 ("inappropriate implementation in the Background Fetch API") תוקן ב־Chrome 144; דיווח מ־05/2026 על חולשה נוספת שטרם תוקנה (botnet דרך ה־API) ו־ungoogled-chromium שקלו לנטרל את ה־API — [Cybernews](https://cybernews.com/security/google-patch-high-severity-chrome-bug-background-fetch/), [AndroidHeadlines 05/2026](https://www.androidheadlines.com/2026/05/this-unpatched-chrome-flaw-could-be-secretly-turning-millions-of-phones-into-botnets.html), [ungoogled-chromium #3791](https://github.com/ungoogled-software/ungoogled-chromium/issues/3791)

### Inferences
- המדידה "~5x איטי, נראה כבקשה אחת בכל פעם" תואמת את הקוד: 4→2 מקביליות (פי 2), ובנוסף עדיפות NORMAL שנעצרת בזמן ניווט, ותור יחיד לכל origin. אם האפליקציה פותחת **רישום נפרד לכל חלק** — הם רצים אחד־אחד (רק רישום אחד פעיל לכל origin). **רישום אחד עם כל החלקים** עדיף: מאפשר 2 במקביל.
- אם ההעלאה ל־R2 עובדת בכלל ב־Background Fetch, סביר שהיא עוברת דרך נתיב same-origin (פרוקסי/Worker באותו דומיין) או בקשה "פשוטה" (POST עם content-type safelisted, בלי headers מותאמים). `PUT` ישיר ל־`*.r2.cloudflarestorage.com` אמור להיכשל ב־FETCH_ERROR. כדאי לוודא באפליקציה.
- ה"תקיעה" במסך כבוי מתיישבת עם: (א) NORMAL = "דורש מכשיר במנוחה או Chrome רץ"; (ב) כש־Chrome נהרג/מוקפא, ההמשך תלוי במשימת רקע עם חלון 5 דק׳–8 שעות + חלונות תחזוקה של Doze; (ג) `pending upload timeout` של 30 שניות — אם קריאת גוף הבקשה מהאחסון מתעכבת, הבקשה נכשלת ונכנסת ל־retry (עד 5).
- גוף ההעלאה נקרא דרך `GetUploadData` מהלקוח (האחסון של Background Fetch), כלומר ככל הנראה ה־Blob של כל חלק נשמר באחסון הדפדפן לפני השליחה — העתק נוסף על הדיסק ומשקל על ה־quota בקבצים של כמה GB (לא אומת בקוד ברמת השורה).
- אי אפשר לבקש עדיפות גבוהה יותר מה־API — אין פרמטר כזה בצד ה־Web.

### Gaps
- לא נמצא באג פתוח ב־issues.chromium.org שמתעד במפורש "Background Fetch upload slow/stall on screen off" (החיפוש לא העלה תוצאה רלוונטית; ה־tracker דורש JS). כדאי לפתוח באג עם מדידה.
- לא אומת האם שירות ההורדות מפעיל foreground service של אנדרואיד עבור Background Fetch (כמו בהורדות רגילות), ומה קורה בדיוק תחת Doze.
- ערכי Finch בפועל (ייתכן ש־`max_running_downloads` שונה בייצור) — לא ידוע.
- לא נמצא חסם גודל מפורש לבקשה בודדת; רק quota של האחסון.

## 2. הקפאת דפים והאטה ב־Chrome לאנדרואיד — מה קופא, מה מחזיק בחיים, ומה קורה ל־fetch באמצע

### Takeaway
באנדרואיד הפיצ'ר `StopInBackground` **מופעל כברירת מחדל**, ומקפיא דף מוסתר **דקה אחת** אחרי שהוסתר (ערך ברירת המחדל בקוד היום; בעבר דווח 5 דקות מ־M68). החריג היחיד במסלול הזה הוא **אודיו נשמע** (כולל 30 שניות אחרי שנפסק). רשימת החריגים העשירה (Web Locks, IndexedDB, WebRTC וכו׳) שייכת למדיניות ההקפאה של מנהל הביצועים (בעיקר דסקטופ) — לא נמצאה ראיה שהיא מגינה על דף באנדרואיד. בנוסף מעליו פועל ה־cached apps freezer של אנדרואיד על כל תהליכי Chrome כשהאפליקציה ברקע.

### Cited Findings
- `kStopInBackground` — `FEATURE_ENABLED_BY_DEFAULT` רק כש־`IS_ANDROID && !IS_CAST_ANDROID && !IS_DESKTOP_ANDROID`; בשאר הפלטפורמות כבוי — [blink/common/features.cc](https://chromium.googlesource.com/chromium/src/+/main/third_party/blink/common/features.cc)
- `kDefaultDelayForBackgroundTabFreezing = base::Minutes(1)` — "The amount of time to wait before suspending shared timers, and loading etc. after the renderer has been backgrounded"; ניתן לשינוי בפרמטר Finch `DelayForBackgroundTabFreezingMills` — [page_scheduler_impl.cc](https://chromium.googlesource.com/chromium/src/+/main/third_party/blink/renderer/platform/scheduler/main_thread/page_scheduler_impl.cc)
- זמן ההקפאה = `max(page_visibility_changed_time_, audio_state_changed_time_) + delay`; `IsBackgrounded()` = `!IsPageVisible() && !IsAudioPlaying()`; `kRecentAudioDelay = 30 שניות`; יש גם מסלול "Proactive" של הפחתת זיכרון שמקפיא **מיד** — [page_scheduler_impl.cc](https://chromium.googlesource.com/chromium/src/+/main/third_party/blink/renderer/platform/scheduler/main_thread/page_scheduler_impl.cc), [page_scheduler_impl.h](https://chromium.googlesource.com/chromium/src/+/main/third_party/blink/renderer/platform/scheduler/main_thread/page_scheduler_impl.h)
- האטה רגילה: `kThrottlingDelayAfterBackgrounding = 10 שניות` לפני האטה מלאה; תקציב רקע מקסימלי 3 שניות — [page_scheduler_impl.cc](https://chromium.googlesource.com/chromium/src/+/main/third_party/blink/renderer/platform/scheduler/main_thread/page_scheduler_impl.cc)
- היסטורי: "on Android, pages are frozen after 5 minutes in the background since M68" (דיון blink-dev) — [Page Lifecycle API](https://developer.chrome.com/docs/web-platform/page-lifecycle-api), [Intent to Prototype: Conservative page freezing on desktop](https://groups.google.com/a/chromium.org/g/blink-dev/c/NOhYFW0rifw)
- הקפאה = "suspends freezable tasks in the page's task queues"; טיימרים ו־callbacks של fetch לא רצים; האירועים `freeze`/`resume` על `document` (Chrome 68) — [Page Lifecycle API](https://developer.chrome.com/docs/web-platform/page-lifecycle-api)
- טיוטת WICG: ברשת "network activity will be disallowed, except for fetch keep-alive" — [WICG/web-lifecycle](https://github.com/WICG/web-lifecycle)
- רשימת `CannotFreezeReason` של מנהל הביצועים: `kVisible, kRecentlyVisible, kAudible, kRecentlyAudible, kFreezingOriginTrialOptOut, kHoldingWebLock, kHoldingIndexedDBLock, kHoldingBlockingIndexedDBLock, kConnectedToUsb/Bluetooth/Hid/Serial, kCapturingVideo/Audio, kBeingMirrored, kCapturingWindow/Display, kWebRTC, kLoading, kNotificationPermission, kOptedOut, kMostRecentlyUsed, kWebUI` — [cannot_freeze_reason.h](https://chromium.googlesource.com/chromium/src/+/main/components/performance_manager/public/freezing/cannot_freeze_reason.h)
- Intensive throttling (מ־Chrome 88): חל רק כשהדף מוסתר מעל 5 דקות, שרשרת טיימרים ≥5, שקט ≥30 שניות, ואין WebRTC; אז התעוררות פעם בדקה — [Heavy throttling of chained JS timers beginning in Chrome 88](https://developer.chrome.com/blog/timer-throttling-in-chrome-88)
- מדיניות ארגונית `TabFreezingEnabled`: הקפאת לשוניות שברקע לפחות 5 דקות (דסקטופ), נמנעת מלשוניות שמשמיעות אודיו — [Chrome Enterprise](https://chromeenterprise.google/policies/tab-freezing-enabled/)
- אנדרואיד 14: "background work is disallowed shortly after an app process enters a cached state"; לפי Mishaal Rahman זמן ההקפאה של אפליקציה ב־cache ירד מ־10 דקות ל־10 שניות — [Android 14 behavior changes](https://developer.android.com/about/versions/14/behavior-changes-all), [Threads: Mishaal Rahman](https://www.threads.com/@mishaal_rahman/post/Czcb2EMLNv0?hl=en)
- דיווח מפתח: foreground service בפיקסל עם אנדרואיד 14 נתקע אחרי ~30 שניות בגלל ה־freezer — [react-native-vision-camera #3005](https://github.com/margelo/react-native-vision-camera/issues/3005)
- Service Worker: `kRequestTimeout = 5 דקות` ("Timeout for a request to be handled", עם `KILL_ON_TIMEOUT`), `kTimeoutTimerDelay = 30 שניות`, `kStopWorkerTimeout = 5 שניות` — [service_worker_version.h](https://chromium.googlesource.com/chromium/src/+/main/content/browser/service_worker/service_worker_version.h)
- Wake Lock של המסך פועל רק כשהדף גלוי (מוזכר כמיטיגציה נפוצה, לא כפתרון רקע) — [דיון tus-js-client](https://github.com/tus/tus-js-client/issues/255) (המלצה כללית, לא מקור רשמי)

### Inferences
- באנדרואיד, דף שהוסתר מפסיק לתזמן את החלק הבא תוך ~דקה (ואולי מיד תחת לחץ זיכרון). XHR/fetch שכבר יצא — סביר שהבייטים ממשיכים לזרום בשירות הרשת (תהליך הדפדפן) כל עוד Chrome עצמו לא מוקפא ע"י אנדרואיד, אבל ה־callback (`onload`/resolve) לא ירוץ עד ה־resume, ולכן אין "חלק הבא". זה תואם "ההעלאה הרגילה קופאת".
- Web Locks / IndexedDB / WebRTC הם חריגים במדיניות מנהל הביצועים; מסלול `StopInBackground` באנדרואיד בודק רק נראות ואודיו — לכן אין לצפות שהם ישאירו את הדף ער באנדרואיד (לא נבדק במכשיר).
- גם אם הדף לא קפוא, כש־Chrome כולו ברקע ובמסך כבוי בלי foreground service, ה־cached apps freezer של אנדרואיד יכול להקפיא את כל התהליכים של Chrome (כולל ה־TWA, שרץ בתוך Chrome).
- fetch מתוך Service Worker לא פותר: עד 5 דקות לאירוע, וה־SW רץ בתהליך renderer בעדיפות נמוכה.

### Gaps
- לא נמצא מקור רשמי/מדידה שמאשרת מה קורה בדיוק לבקשת העלאה שכבר יצאה כשהדף קופא באנדרואיד (ממשיכה עד הסוף? נעצרת כשה־data pipe מתמלא?). גוף Blob נקרא ככל הנראה בצד הדפדפן — אבל לא אומת.
- האם Chrome לאנדרואיד מחזיק foreground service בזמן ניגון מדיה בלשונית (מה שמונע את ה־freezer של אנדרואיד) — יש רמז בדיווח מפתח (ראו סעיף 3), לא מקור רשמי.

## 3. טריק אודיו שקט / ניגון מדיה כדי להשאיר לשונית ערה

### Takeaway
אודיו **שקט** לא עובד: Chrome פוטר רק אודיו **נשמע** (מה שמציג את אייקון הרמקול, מעל סף עוצמה). אודיו נשמע רציף אכן מונע את ההקפאה בקוד (`IsAudioPlaying`) — אבל זה אומר להשמיע צליל אמיתי למשתמש במשך כל ההעלאה, עם סיכון להשתקה ע"י המשתמש/מערכת.

### Cited Findings
- "Audio is considered audible when and only when Chrome shows the audio icon. Silent audio streams do not grant exemptions." ופטור נמשך כמה שניות אחרי שהאודיו נפסק — [Background tabs in Chrome 57](https://developer.chrome.com/blog/background_tabs), [Chrome 88 timer throttling](https://developer.chrome.com/blog/timer-throttling-in-chrome-88)
- `AudioStreamMonitor` מודד עוצמה ו־"debounces" ל"נשמע לאחרונה"; `kHoldOnMilliseconds = 2000` — [audio_stream_monitor.h (main)](https://chromium.googlesource.com/chromium/src/+/main/content/browser/media/audio_stream_monitor.h), [audio_stream_monitor.h (ישן)](https://chromium.googlesource.com/chromium/src/+/304e59b/chrome/browser/media/audio_stream_monitor.h)
- מוזילה מציינת ש־Chrome פוטר רק לשוניות שמשמיעות מעל סף עוצמה, כדי למנוע עקיפה באודיו שקט — [Bugzilla 1336484](https://bugzilla.mozilla.org/show_bug.cgi?id=1336484)
- ספריית `silent-audio` ("Silent background audio to keep timers working") — וה־README שלה מציין שזה לא עוזר אם המשתמש משתיק את הלשונית — [t-mullen/silent-audio](https://github.com/t-mullen/silent-audio)
- דיווח מפתח (2026): באנדרואיד 17 לשונית Chrome ברקע מושתקת ברגע שה־media foreground service נופל, ו־Chrome מפיל אותו ברגע שאין אלמנט מנגן; התיקון — לא להשאיר רווח בין רצועות — [music-minion-cli PR #56](https://github.com/Andrewske/music-minion-cli/pull/56) (מקור יחיד, לא רשמי)

### Inferences
- טון בעוצמה נמוכה מאוד אך מעל הסף עשוי לעבוד טכנית, אבל: מחייב התחלה ב־user gesture, המשתמש שומע, הסטטוס בר מציג נגן, צריכת סוללה, ומדיניות Chrome יכולה להשתנות בכל גרסה. לא מומלץ כפתרון ייצור.
- ככל הנראה ניגון מדיה אמיתי גורם ל־Chrome להחזיק media foreground service — מה שגם מגן מפני ה־freezer של אנדרואיד; זו כנראה הסיבה שאודיו "עובד" בדיווחים (הסקה, לא מאומת).

### Gaps
- לא נמצאו מדידות עדכניות (2025–2026) של העלאה ארוכה עם מסך כבוי ואודיו נשמע ב־Chrome לאנדרואיד.
- ערך סף העוצמה המדויק (dBFS) לא אותר בקוד הנוכחי.

## 4. Background Sync / Periodic Background Sync

### Takeaway
לא מתאימים להעלאה של מאות MB–GB: אירוע `sync` הוא אירוע SW רגיל עם תקרת זמן (5 דקות לאירוע ב־SW; פרמטר נפרד ל־sync), מוגבל במספר ניסיונות, ונועד ל"שלח כשחוזרת הרשת". Periodic Sync — מינימום מרווחים של שעות ותלוי ב־engagement. מתאים רק כ"מנגנון התעוררות" לחידוש העלאה שנעצרה, חלק־חלק.

### Cited Findings
- כל אירוע SW כפוף ל־`kRequestTimeout = 5 דקות` עם `KILL_ON_TIMEOUT` — [service_worker_version.h](https://chromium.googlesource.com/chromium/src/+/main/content/browser/service_worker/service_worker_version.h)
- מנהל ה־sync קובע `max_attempts` מתוך `max_sync_attempts` ו־`max_sync_attempts_with_notification_permission` (יותר ניסיונות לאתר עם הרשאת התראות) — [background_sync_manager.cc](https://chromium.googlesource.com/chromium/src/+/main/content/browser/background_sync/background_sync_manager.cc)
- Background Sync מיועד ל"sending emails or uploading images when the client is back online"; תמיכה רק ב־Chromium — [Vaadin PWA: Background Sync](https://vaadin.com/pwa/learn/background-sync), [MDN: Offline and background operation](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation)

### Inferences
- שימוש אפשרי: לרשום `sync` אחרי `visibilitychange`→hidden, ובכל אירוע להעלות 1–2 חלקים (8–16MiB) מתוך IndexedDB/OPFS ולסיים בתוך דקות; אבל ה־sync נורה רק כשיש שינוי קישוריות/בזמן שהמערכת מחליטה, ולא בקצב קבוע — לא "מהיר".

### Gaps
- הקבוע המדויק של משך אירוע sync (`max_sync_event_duration`, ידוע מהעבר כ־3 דקות) ושל מספר הניסיונות — קובץ הפרמטרים לא נשלף בהצלחה; לא אומת למצב 2026.

## 5. fetch עם גוף זורם (`duplex: 'half'`) ו־HTTP/2

### Takeaway
לא פותר את בעיית הרקע (אותו renderer קופא), ומוסיף חסמים: חייב HTTP/2/3, תמיד preflight, ואין התקדמות העלאה. יתרונו היחיד — לא צריך לחתוך ל־Blob בזיכרון.

### Cited Findings
- זמין מ־Chromium 105; חובה `duplex: 'half'`; התגובה זמינה רק אחרי שכל הגוף נשלח; **נדחה ב־HTTP/1.x**; תמיד דורש CORS ו־preflight; redirect (חוץ מ־303) → כשל; CDN/פרוקסי שמאגר את הבקשה מבטל את התועלת — [Streaming requests with the fetch API](https://developer.chrome.com/docs/capabilities/web-apis/fetch-streaming-requests)
- תיקון ב־Chromium לטיפול ב־421 בבקשות העלאה זורמות — [commit c267fb2](https://chromium.googlesource.com/chromium/src/+/c267fb24d42508af138ae0640f753ec587c62f0c)

### Inferences
- עבור S3 multipart presigned PUT, גוף זורם דורש `Content-Length` ידוע לכל חלק או chunked — R2/S3 presigned PUT מצפה בדרך כלל ל־Content-Length; לכן Blob.slice() נשאר הדרך הפשוטה. אין תועלת לרקע.

### Gaps
- לא נמצא מידע על התנהגות חיבור HTTP/2 כשה־renderer קופא (האם הזרם נשאר פתוח, timeouts של R2).

## 6. TWA — הבדלים מלשונית Chrome, והעברה לשירות נייטיב

### Takeaway
TWA רץ **בתוך Chrome** (אותם תהליכים, אותה הקפאה, אותו Background Fetch) — אין יתרון רקע מובנה. הדרך שעובדת באמת היא להעביר את ההעלאה לאפליקציה המארחת (UIDT באנדרואיד 14+ / foreground service `dataSync` לפני כן). הבעיה היא העברת הקובץ: ערוץ postMessage של TWA הוא **מחרוזות בלבד**, ו־Web Share של קבצים מוגבל ל־**50MB ו־10 קבצים** — שניהם לא מעבירים וידאו של GB. לכן הנייטיב צריך **לבחור את הקובץ בעצמו** (content URI מ־SAF) ולקבל מהדף רק מטא־דאטה/URLs חתומים.

### Cited Findings
- postMessage ל־TWA: מ־Chrome 115.0.5790.13 + `androidx.browser 1.6.0-alpha02`; האפליקציה המארחת יוזמת; הדף מקבל `event.ports[0]` ושולח `port.postMessage`; Digital Asset Links (`use_as_origin`) נדרש לאימות המקור; הדוגמאות — מחרוזות בלבד, אין אזכור של binary/transferables/גבול גודל — [PostMessage for TWA](https://developer.chrome.com/docs/android/post-message-twa)
- Web Share: `kMaxSharedFileCount = 10`, `kMaxSharedFileBytes = 50 * 1024 * 1024`; הערה בקוד: בקבצים נייטיב בגודל לא ידוע הבדיקה מבוצעת במימוש הפלטפורמה — [share_service_impl.h](https://chromium.googlesource.com/chromium/src/+/main/chrome/browser/webshare/share_service_impl.h), [share_service_impl.cc](https://chromium.googlesource.com/chromium/src/+/main/chrome/browser/webshare/share_service_impl.cc)
- UIDT (אנדרואיד 14, API 34): הרשאה `RUN_USER_INITIATED_JOBS`, `setUserInitiated(true)`, `setEstimatedNetworkBytes()`, התראה חובה (`setNotification`); **חייב להיקבע כשהאפליקציה גלויה** (Recents לא נחשב; פטורי FGS לא חלים); אין זמן מקסימלי קבוע ("as system conditions allow"); לא כפוף ל־App Standby quotas; עצירה ע"י המשתמש ב־Task Manager הורגת את התהליך בלי `onStopJob`; לפני API 34 — WorkManager עם foreground service — [Android: User-initiated data transfer](https://developer.android.com/develop/background-work/background-tasks/uidt)
- foreground service `dataSync` באנדרואיד 15: מגבלת 6 שעות ב־24 שעות (לפי סיכום הכלי; יש לאמת בדף הרשמי) — [FGS timeout](https://developer.android.com/develop/background-work/services/fgs/timeout)
- דוגמת foreground service להעלאה — [gist](https://gist.github.com/piyush-malaviya/379c8f5d308a34aa80b6a32bf668f8bd); חבילת Flutter לאנדרואיד מציינת שבלי הרשאה מתאימה אנדרואיד עלול לעצור העלאות אחרי ~9 דקות ברקע — [tus_background_upload](https://pub.dev/packages/tus_background_upload)

### Inferences
- תכנון אפשרי לפרויקט: הדף (ב־TWA) שולח דרך postMessage בקשה "בחר קובץ והעלה" → הנייטיב פותח `ACTION_OPEN_DOCUMENT`, מקבל content URI עם הרשאת קריאה מתמשכת, מבקש מהדף (או ישירות מהשרתון) את ה־presigned URLs לכל חלק, ומריץ UIDT עם 4 חלקים במקביל ו־OkHttp; התקדמות חוזרת לדף ב־postMessage (מחרוזות JSON). כך הקובץ לא עובר דרך הדף בכלל.
- חלופה בלי TWA: custom scheme / `intent://` מהדף לאפליקציה נייטיב — מעביר רק מחרוזות, אותה בעיית קובץ.
- הבעיה: אם המשתמש כבר בחר את הקובץ ב־`<input type=file>` בדף — אין דרך לתת לנייטיב את ה־URI המקורי (הדף רואה רק File/Blob). צריך שהבחירה תהיה מלכתחילה בנייטיב.
- UIDT מחייב שהאפליקציה תהיה גלויה בזמן הקביעה — מתאים, כי המשתמש לוחץ "העלה" כשה־TWA בחזית.

### Gaps
- לא נמצא תיעוד רשמי לתבנית "TWA → foreground service להעלאה"; זו הרכבה של רכיבים מתועדים.
- האם `kMaxSharedFileBytes` נאכף בפועל בשיתוף ב־Android (ההערה אומרת שהמימוש הפלטפורמי מבצע את הבדיקה) — לא נבדק בקוד Java.
- האם ה־postMessage של TWA תומך ב־ArrayBuffer — לא מתועד; גם אם כן, העברת GB בהודעות לא מעשית.

## 7. המלצות של גוגל ואחרים להעלאה גדולה ברקע מהווב

### Takeaway
ההמלצה הרשמית היחידה היא Background Fetch (ותיעודו מ־2018 עדיין אומר שהעלאות לא נתמכות). אין מאמר web.dev/Chrome מ־2024–2026 שממליץ על דרך להעלאת GB ברקע מהווב. בפועל — מעבר לשכבה נייטיב, או העלאה בחזית עם Wake Lock + חידוש (tus/multipart) כשחוזרים.

### Cited Findings
- Background Fetch מוצג כפתרון ל"large uploads and downloads that continue without an open window"; חובה SW חי בכל משך Background Sync לעומת Background Fetch שמנוהל בדפדפן — [Chrome blog](https://developer.chrome.com/blog/background-fetch), [MDN Background Fetch API](https://developer.mozilla.org/docs/Web/API/Background_Fetch_API)
- tus: לעצור = לסגור את הבקשה הפתוחה; לחדש = `HEAD` לקבלת offset — עיצוב שמתאים להשהיה בכל רגע — [tus FAQ](https://tus.io/faq.html), [tus-js-client usage](https://github.com/tus/tus-js-client/blob/main/docs/usage.md)
- ההנחיה של גוגל על freeze: לעצור polling ולסגור WebSocket ב־`freeze` ולהתחיל מחדש ב־`resume` — [Page Lifecycle API](https://developer.chrome.com/docs/web-platform/page-lifecycle-api)

### Inferences — דירוג טכניקות לפי מה שהראיות תומכות בו
1. **נייטיב (UIDT / FGS dataSync) עם בחירת קובץ בנייטיב** — היחיד שמבטיח מהירות מלאה במסך כבוי (נשאר כפוף לעצירה ע"י משתמש/תרמי).
2. **Background Fetch — שיפורים**: רישום **אחד** עם כל החלקים שנותרו (לא רישום לחלק), חלקים גדולים יותר (פחות overhead לבקשה, כי המקביליות 2), יעד same-origin או בקשה "פשוטה" (בלי preflight), `downloadTotal` מוגדר. צפי: עד ~2 חלקים במקביל, עדיין NORMAL ועדיין עלול להיתקע במסך כבוי.
3. **השארת הדף בחזית**: Screen Wake Lock (רק כשגלוי) + הודעה "השאר פתוח"; מהיר אבל לא "ברקע".
4. **הקדמה**: להמשיך בדף עד ה־freeze (דקה), להשתמש ב־`freeze`/`resume`/`visibilitychange` כדי לשמור מצב multipart ולחדש מיד ב־resume.
5. **אודיו נשמע** — עובד טכנית בקוד, לא מקובל למוצר. אודיו שקט — לא עובד.
6. Background Sync / streaming fetch / SW fetch — לא פותרים.

### Gaps
- לא נמצאו מדידות עצמאיות עדכניות של קצב Background Fetch upload באנדרואיד (המדידה של הפרויקט — ~5x איטי — היא הראיה הישירה היחידה).
- לא נמצאו דיונים ב־Reddit/Stack Overflow מ־2025–2026 על הנושא בחיפושים שבוצעו.
