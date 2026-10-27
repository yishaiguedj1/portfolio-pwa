# מה floccus ו־Chromium כבר שילמו עליו בסנכרון

## 1. תקציר

אין היום פרויקט ציבורי שעושה בדיוק מה שאנחנו עושים: סנכרון דו־כיווני של סימניות **וגם של ביקורים בודדים** בין Chrome לבין מכשיר אחר, דרך `chrome.history`. הפרויקט הקרוב ביותר בסימניות הוא **floccus**: תוסף MV3 ואפליקציה לאנדרואיד, שמסנכרנים קובץ ב־Google Drive. ה־changelog שלו מגרסה 1.x עד 5.12 הוא קטלוג של כמעט כל באג שנכון גם לנו ([CHANGELOG](https://raw.githubusercontent.com/floccusaddon/floccus/develop/CHANGELOG.md)). בהיסטוריה, המודל הקרוב הוא הסנכרון של Chromium עצמו, שמזהה ביקור לפי הזמן שלו ומעביר מחיקות כ"הוראות" נפרדות ([history_sync_bridge.cc](https://github.com/chromium/chromium/blob/main/components/history/core/browser/sync/history_sync_bridge.cc)).

עשרה מקרים צריכים טיפול לפני שהתוסף יוצא לעוד משתמשים. חמישה מהם חמורים, והם עלולים לאבד או לשכפל נתונים בשקט:

1. **מספר רץ שמתאפס.** אם מתקינים את האפליקציה מחדש או מוחקים את הנתונים שלה, `seq` מתחיל שוב מ־1, אבל ה־`ack` ב־state.json גבוה. כל הפעולות החדשות נזרקות.
2. **יותר מעותק אחד של התוסף באותו חשבון** (שני מחשבים או שני פרופילים). אין כותב יחיד ל־state.json, וכל עותק מחיל את אותן פעולות.
3. **אחסון כפול של Chrome** (מיוני 2025). `mobileFolderId` נופל ל־`kids[2]` כשתיקיית הנייד ריקה ולכן מוסתרת, ו־`kids[2]` יכול להיות סרגל הסימניות של החשבון.
4. **התנתקות מ־Chrome מוחקת את כל תת־העץ של החשבון.** בצד הטלפון אין שום הגנה ממחיקה גדולה שמגיעה מ־Chrome.
5. **`deleteRange` של אלפית שנייה מוחק יותר מהביקור שבחרנו.** הוא מוחק כל ביקור באותה אלפית, בכל הכתובות, בכל המכשירים ובשרת של Google.

בנוסף: הקבצים נמצאים לפי שם ולא לפי מזהה, ההעלאה היא "פשוטה" (עד 5MB), ואין בדיקה של גרסת פורמט או של התאמת החשבון.

## 2. הפרויקטים

| פרויקט | מה הוא | למה הוא רלוונטי |
|---|---|---|
| [floccus](https://github.com/floccusaddon/floccus) | תוסף MV3 ואפליקציה לאנדרואיד/iOS; קובץ XBEL ב־Google Drive, WebDAV, Dropbox או Git, או שרת Nextcloud | הכי קרוב לתכנון שלנו. גם קנה המידה זהה: 4–5 אלף סימניות ב־Drive ([#2106](https://github.com/floccusaddon/floccus/issues/2106), [#2169](https://github.com/floccusaddon/floccus/issues/2169)). בגרסה 5.11.0 תוקנו כ־40–50 באגי נכונות ([#2362](https://github.com/floccusaddon/floccus/issues/2362)) |
| [xBrowserSync](https://github.com/xbrowsersync/app) | תוסף, אפליקציה לאנדרואיד ושרת API משלו | קטלוג של סימפטומים: אובדן נתונים, כפילויות, הוספות שלא הגיעו. רוב הבאגים פתוחים בלי תיקון ([#358](https://github.com/xbrowsersync/app/issues/358)) |
| [BookmarkHub](https://github.com/dudor/BookmarkHub) | העלאה והורדה ל־GitHub Gist | דוגמה למה שקורה כשהסנכרון "דורס" במקום למזג ([#5](https://github.com/dudor/BookmarkHub/issues/5)) |
| Chromium Sync (סימניות) | `BookmarkModelMerger` | הייחוס לכללי זהות: קודם UUID, ואחר כך כותרת **וגם** כתובת זהות ([bookmark_model_merger.cc](https://chromium.googlesource.com/chromium/src/+/refs/tags/145.0.7632.45/components/sync_bookmarks/bookmark_model_merger.cc)) |
| Chromium Sync (היסטוריה) | סוג נתונים HISTORY, מאז בערך Chrome 117 | ביקור מזוהה לפי הזמן שלו. מחיקה עוברת כ־HISTORY_DELETE_DIRECTIVE. התפוגה לא מסתנכרנת ([HSB](https://github.com/chromium/chromium/blob/main/components/history/core/browser/sync/history_sync_bridge.cc), [Brave community](https://community.brave.com/t/is-a-full-history-sync-in-the-pipeline/541326)) |
| Firefox Sync | מנוע היסטוריה וסימניות | הרשומות "לא מלאות", ולכן המיזוג רק מוסיף. אין דרך לייצג מחיקה של ביקור בודד ([Bug 1157553](https://bugzilla.mozilla.org/show_bug.cgi?id=1157553), [Bug 1598187](https://bugzilla.mozilla.org/show_bug.cgi?id=1598187)) |
| [Syncthing BEP](https://docs.syncthing.net/specs/bep-v1.html) | פרוטוקול סנכרון קבצים | זוג של מזהה אינדקס אקראי ומספר רץ: הפתרון הקלאסי למספר רץ שמתאפס |
| [History Trends Unlimited](https://chrome.google.com/webstore/detail/history-trends-unlimited/pnmchffiealhkdloeffcdnbgdnedheme) | העתקה חד־כיוונית של ההיסטוריה למסד נתונים משלו | מראה שאין תקדים לסנכרון היסטוריה דו־כיווני מתוך תוסף |

## 3. מקרי הקצה, לפי חומרה

העמודה "אצלנו" מבוססת על הקוד הנוכחי: `android/chrome-ext/core.js`, `sync.js` ו־`drive.js` בתוסף, ו־`BrChrome.kt` ו־`BrSync.kt` באפליקציה.

### חמור: עלול לאבד או לשכפל נתונים בשקט

**1. המספר הרץ מתאפס אחרי התקנה מחדש או מחיקת נתוני האפליקציה.**
- **מה קורה:** `nextSeq()` נשמר ב־SharedPreferences. אחרי התקנה מחדש הוא מתחיל שוב מ־1, בזמן ש־`state.ack` נשאר גבוה. האפליקציה מוחקת כל פעולה עם `s <= ack` (`ops.removeAll { it.s <= ack }`), והתוסף מסנן `o.s > ack`. התוצאה: סימניות ומחיקות חדשות מהטלפון נעלמות בלי הודעה.
- **איך אחרים פתרו:** Syncthing מצמיד לכל אינדקס Index ID אקראי, ו"איפוס מחייב מזהה חדש". המשך לפי מספר רץ תקף רק כשהמזהה זהה ([BEP v1](https://docs.syncthing.net/specs/bep-v1.html)). Firefox מחליף syncID כשהנתונים משתנים מהותית, וכל הלקוחות מסנכרנים מחדש ([StorageFormat](https://mozilla-services-docs.readthedocs.io/en/latest/sync/storageformats.html)).
- **אצלנו:** **חסר.**
- **מה לתקן:** להוסיף `ep` אקראי ל־ops.json, שנוצר יחד עם התור. התוסף שומר `ackEp` ב־state.json ומחיל `ack` רק כשהם שווים; `ep` חדש פירושו `ack = 0`. האפליקציה מוחקת פעולות רק כש־`ackEp == ep`.

**2. כמה עותקים של התוסף באותו חשבון Google.**
- **מה קורה:** ל־appDataFolder יש מקום אחד לחשבון. אם התוסף מותקן בשני מחשבים, או בשני פרופילים של Chrome באותו חשבון, כל עותק:
  - כותב state.json מעל השני בלי בדיקה;
  - מחיל את אותן פעולות `add` מהטלפון. אם ההוספה מהעותק השני קורית לפני ש־Chrome Sync מעביר את הראשונה, נוצרת כפילות;
  - שולח לטלפון ביקורי "הד" של העותק השני בזמן של Chrome, ולא בזמן של הטלפון.
- **איך אחרים פתרו:**
  - ל־Drive v3 אין כתיבה מותנית: `etag` הוסר, ו־If‑Match הוא "best effort" בלבד ([v2→v3](https://developers.google.com/workspace/drive/api/guides/v2-to-v3-reference), [hydra PR #6](https://github.com/nayan8teen/hydra/pull/6)). לכן כותב יחיד הוא הדפוס הבטוח היחיד.
  - floccus נתקל בפרופיל לא פעיל שהמשיך לסנכרן ומחק את הטאבים במכשיר השני. התיקון היה לא לסנכרן מפרופיל לא פעיל ([#1574](https://github.com/floccusaddon/floccus/issues/1574)).
- **אצלנו:** **חלקי.** בצד הטלפון יש בעלים יחיד לגשר (`BrCloud.chromeOwner`). בצד התוסף אין.
- **מה לתקן:**
  - מזהה התקנה (`wid`) בתוך state.json. עותק שרואה `wid` אחר לא כותב ולא מחיל פעולות, עד שהמשתמש מעביר אליו את הבעלות בחלון של התוסף.
  - כש־Chrome Sync פעיל, לבדוק לפני `create` שאין כבר סימנייה עם אותו מפתח (זה כבר נבדק). זה עדיין לא מספיק בלי בעלות.

**3. אחסון כפול ב־Chrome, ותיקיית "סימניות בנייד" מוסתרת.**
- **מה קורה:**
  - מאז יוני 2025, משתמש שמחובר ל־Chrome בלי Sync קלאסי יכול להחזיק שתי קבוצות של תיקיות שורש: אחת `syncing:true` ואחת `syncing:false`. המזהים של תיקיות החשבון חדשים, לא 1/2/3. Google מבקשת במפורש לא לזהות שורשים לפי מזהה או לפי שם, ולא להניח שיש רק אחת מכל סוג ([Chrome blog](https://developer.chrome.com/blog/bookmarks-sync-changes), [PSA](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/zlZaK0Omvu0)).
  - במחשב, תיקיית הנייד הריקה בלתי נראית. מאז `kEnforceBookmarkVisibilityOnExtensionsAPI` (פעיל כברירת מחדל ב־main) היא לא מופיעה ב־`getTree`, ו־`create` אליה נכשל עם "Can't find parent bookmark for id" ([bookmark_node.cc](https://chromium.googlesource.com/chromium/src/+/main/components/bookmarks/browser/bookmark_node.cc), [bookmarks_features.cc](https://chromium.googlesource.com/chromium/src/+/main/chrome/browser/extensions/bookmarks/bookmarks_features.cc)).
- **אצלנו:** **באג פעיל.**
  - `mobileFolderId` נופל ל־`kids[2]` ו־`flatten` נופל לסדר `['bookmarks-bar','other','mobile'][i]`. בחשבון עם אחסון כפול `kids[2]` יכול להיות סרגל הסימניות של החשבון, וסימניות מהטלפון ינחתו בסרגל.
  - שני השורשים מאותו סוג מקבלים אותו `r`, ולכן הנתיבים מתערבבים.
  - ההוספה הולכת לתיקיית הנייד הראשונה שנמצאה, שיכולה להיות המקומית שלא מסתנכרנת.
- **מה לתקן:**
  - רק `folderType`, בלי שום נפילה לפי מקום. להעלות `minimum_chrome_version` ל־134.
  - יעד ההוספה: תיקיית `mobile` עם `syncing:true`, ואחריה `mobile` מקומית. אם אין תיקיית נייד נראית, לבחור `other` עם `syncing:true`, ואחריה `other` מקומית. אף פעם לא `kids[i]`.
  - להוסיף ל־`r` את `syncing`, כדי שהנתיבים לא יתנגשו.

**4. התנתקות מ־Chrome, ושינוי מזהים, נראים כמחיקה של הכל.**
- **מה קורה:**
  - `RemoveAccountPermanentFolders()` מוחק את שלוש תיקיות החשבון ואת כל מה שבתוכן ([bookmark_model.cc](https://chromium.googlesource.com/chromium/src/+/main/components/bookmarks/browser/bookmark_model.cc)).
  - המיזוג של Chrome Sync מחליף UUID על ידי יצירת צומת חדש ומחיקת הישן, ולכן `id` חדש ([bookmark_specifics_conversions.cc](https://chromium.googlesource.com/chromium/src/+/main/components/sync_bookmarks/bookmark_specifics_conversions.cc)).
  - בטעינה מחדש Chrome יכול גם להקצות מזהים מחדש (`ids_reassigned`).
- **איך אחרים פתרו:**
  - floccus מפעיל failsafe לפני הביצוע, בשני הכיוונים: מעל 5 פריטים ו־20% שנמחקים, או מעל 1000 בכל מקרה. אותו failsafe חל גם על הוספות. הוא לא רץ על ריצה שחודשה אחרי הפסקה ([Default.ts](https://raw.githubusercontent.com/floccusaddon/floccus/develop/src/lib/strategies/Default.ts)).
  - floccus גם מזהה העברה "גם כשהמזהה השתנה" (4.4.3), ומנקה מיפויים יתומים (5.8.2).
- **אצלנו:** **חלקי.** יש שער למחיקות שמגיעות מהטלפון ל־Chrome (`DEL_HOLD_MIN`, רבע). אין שער לכיוון Chrome→טלפון: `BrStore.replaceMarks(BrSync.applyState(...))` מחליף בשקט. `n<id>` נשבר כשמזהה משתנה, והכינוי `a…` הולך לאיבוד (`buildState` מסנן כינויים שלא חיים).
- **מה לתקן:**
  - שער בטלפון: אם state.json חדש מוריד יותר מ־10 ויותר מרבע מהסימניות, או יותר מ־1000, לשמור את הקודם ולבקש אישור.
  - בתוסף: `onRemoved` של צומת עם `folderType` הוא שינוי נראות או התנתקות, לא פעולה של המשתמש. לעצור את הסנכרון באותה ריצה.
  - זוגות `onRemoved` ו־`onCreated` עם אותה כתובת, כותרת והורה בתוך חלון קצר: לטפל בהם כשכתוב מזהה ולעדכן את הכינוי.

**5. `deleteRange` של אלפית שנייה, ו־`addUrl` שמסתנכרן לכל המכשירים.**
- **מה קורה:**
  - `deleteRange` קורא ל־`DeleteLocalAndRemoteHistoryBetween` בלי סינון לפי כתובת. הוא:
    - מוחק **כל** ביקור בטווח, בכל הכתובות;
    - מוחק גם את הורי ההפניה של הביקור;
    - יוצר "הוראת מחיקה" שמסתנכרנת לכל המכשירים;
    - שולח בקשת מחיקה לשרת של Google.
    ([history_service.cc](https://github.com/chromium/chromium/blob/main/components/history/core/browser/history_service.cc), [expire_history_backend.cc](https://github.com/chromium/chromium/blob/main/components/history/core/browser/expire_history_backend.cc))
  - `addUrl` רושם ביקור בזמן "עכשיו", עם מעבר link ובלי כותרת. הביקור נשלח ל־Chrome Sync, ולכן יופיע בכל מחשבי ה־Chrome של המשתמש, ואולי ב־My Activity ([history_api.cc](https://github.com/chromium/chromium/blob/main/chrome/browser/extensions/api/history/history_api.cc)).
- **איך אחרים פתרו:** ל־Firefox אין בכלל מחיקה של ביקור בודד ([Bug 1598187](https://bugzilla.mozilla.org/show_bug.cgi?id=1598187)). Chromium שומר `originator_cache_guid` כדי לא לשלוח שוב ביקור שהגיע ממכשיר אחר, וזה שדה שתוסף לא יכול לכתוב.
- **אצלנו:** **חלקי.**
  - נכון: `Math.floor(echoChromeAt(...))` עם `+1`, ומחיקה רק בעקבות פעולת `hdel`.
  - חסר: בדיקה של מה עוד נמצא באותה אלפית שנייה.
  - חסרה: החלטת מוצר על ההד שמגיע לכל המכשירים.
- **מה לתקן:**
  - לפני `deleteRange`, לחפש ביקורים בטווח `[c, c+1)` בכל הכתובות שבמטמון `hv`, או עם `search` על אותה אלפית. אם יש יותר מביקור אחד, לא למחוק ולסמן "לא נמחק".
  - להציג למשתמש, פעם אחת, שביקורים מהטלפון יופיעו בכל מחשבי ה־Chrome שלו ובפעילות שלו ב־Google.

### בינוני: שגיאה גלויה, או נזק מוגבל

**6. מציאת קבצים לפי שם, ובלי זיהוי של קבצים כפולים.**
- **מה קורה:** ב־Drive מותר כמה קבצים באותו שם. בדיקה ויצירה הן שתי פעולות נפרדות, ולכן ניסיון חוזר או מרוץ יוצרים קובץ שני ([kuatsu](https://cloudstorage.kuatsu.de/docs/guides/google-drive-files-same-name), [FreeFileSync](https://freefilesync.org/forum/viewtopic.php?p=34718)). floccus נאלץ למיין לפי `modifiedTime` ולמחוק עודפים (5.3.0, 5.3.1). פעם אחת הוא מחק קבצים שלא שלו לפי התאמת שם ([#2383](https://github.com/floccusaddon/floccus/issues/2383)).
- **אצלנו:** **חסר.** `find()` לוקח את התוצאה הראשונה מתוך `pageSize=5` בלי מיון, בשני הצדדים. כל קריאה ל־`files.list` עולה 100 יחידות מכסה, לעומת 5 ל־get לפי מזהה ([limits](https://developers.google.com/workspace/drive/api/guides/limits)).
- **מה לתקן:**
  - לשמור את ה־fileId אחרי היצירה ולעבוד לפיו. להשתמש ב־`generateIds` ליצירה, כדי שניסיון חוזר לא ייצור קובץ שני.
  - כשיש יותר מקובץ אחד: לבחור לפי `rev`/`modifiedTime`. את המיותר מוחק רק הכותב של אותו קובץ.

**7. גודל הקובץ וקריאה שנקטעה.**
- **מה קורה:** העלאה פשוטה מוגבלת ל־5MB ([manage-uploads](https://developers.google.com/workspace/drive/api/guides/manage-uploads)). 20,000 ביקורים, יחד עם הסימניות, מתקרבים למגבלה הזו. floccus הוסיף "Verify file size" ב־5.9.2, ו־BookmarkHub סנכרן רק חלק מהסימניות ([#16](https://github.com/dudor/BookmarkHub/issues/16)).
- **אצלנו:** **חסר.** `uploadType=media` בלי דחיסה ובלי בדיקה של מה שעלה.
- **מה לתקן:** דחיסת gzip, או resumable כשהקובץ מעל 4MB. לבדוק `size`/`md5Checksum` מול מה שהורד. JSON שלא מתפענח הוא "לא קריא", לא "ריק".

**8. אין בדיקת שפיות ואין גרסת פורמט.**
- **מה קורה:** קובץ שנקטע או עץ ריק נקראים כ"Chrome מחק הכל". Firefox קובע: "לעולם לא לשנות נתונים בפורמט חדש ולא מוכר" ([storageformats](https://mozilla-services-docs.readthedocs.io/en/latest/sync/storageformats.html)). floccus מסרב לריצה שתמחק 100% (E029).
- **אצלנו:** **חלקי.** יש `v:1`, אבל אף צד לא בודק אותו. בצד התוסף, `readJson` שנכשל מחזיר `null`, ואז `prev` הוא null ו־`ack` מתאפס ל־0.
- **מה לתקן:**
  - להוסיף ל־state.json את מספר הסימניות ואת `v`. גרסה גבוהה מהמוכרת: לא לכתוב ולא למחוק, ולהציג "צריך לעדכן".
  - state.json שלא נקרא לא מאפס את `ack`. משתמשים בעותק האחרון ששמור מקומית.

**9. החשבון של התוסף שונה מהחשבון של הטלפון.**
- **מה קורה:** `getAuthToken` משתמש בחשבון ה־Sync של Chrome, ואם אין כזה, בחשבון הרשת הראשון ([identity](https://developer.chrome.com/docs/extensions/reference/api/identity)). זה יכול להיות חשבון עבודה. אז כל צד רואה appDataFolder אחר, והסנכרון "עובד" בלי לעשות כלום.
- **אצלנו:** **חסר.** התוסף מציג `getProfileUserInfo`, שהוא לא בהכרח החשבון של הטוקן.
- **מה לתקן:** לקרוא את `about.user.emailAddress` מ־Drive, לשמור אותו בשני הקבצים ולהציג אותו. אם החשבונות שונים, לעצור עם הודעה.

**10. ביקורים מוסתרים, ותפוגה של 90 יום.**
- **מה קורה:**
  - `getVisits` מחזיר **כל** ביקור שאינו 404: גם תת־מסגרות, דילוגי הפניה ו־keyword_generated, שלא מופיעים ב־chrome://history.
  - `onVisitRemoved` נקרא גם בתפוגה אוטומטית, עם `urls: []` ([history_api.cc](https://github.com/chromium/chromium/blob/main/chrome/browser/extensions/api/history/history_api.cc)). תת־מסגרות פגות כבר אחרי 3 ימים ([EHB](https://github.com/chromium/chromium/blob/main/components/history/core/browser/expire_history_backend.cc)).
- **אצלנו:** **חלקי.**
  - כלל "היה ועכשיו לא, ורק מעל `hfrom`" (`planChromeHist`) קיים ונכון.
  - חסר סינון לפי `transition` (auto_subframe, manual_subframe, keyword_generated).
  - `since` הוא בדיוק 90 יום, בלי מרווח. ביקור שפג אצל Chrome רגע לפני ש־`since` זז יעבור לטלפון כמחיקה.
- **מה לתקן:** לסנן את סוגי המעבר האלה. להשאיר מרווח של יומיים: ביקור שנעלם ונמצא ביומיים הכי ישנים של החלון נחשב תפוגה, לא מחיקה.

### נמוך: נוחות, ביצועים, או מקרים נדירים

| # | מקרה | איך אחרים / המקור | אצלנו | מה לתקן |
|---|---|---|---|---|
| 11 | שימוש חוזר בפעולה אחרי שהתוסף נעצר באמצע | floccus שומר "continuation" כדי להמשיך מאותה נקודה (5.0.12, 5.11.0) | סימניות: בסדר, כי `add` מתקשר למה שכבר קיים לפי מפתח. ביקורים: **חסר**. `vat` ו־`echo` נשמרים רק בסוף הריצה, ולכן `addUrl` חוזר ומכפיל את הביקור | לשמור `vat`/`echo` ב־`storage.local` מיד אחרי כל `addUrl` |
| 12 | שעון הטלפון זז אחורה | Syncthing ו־Firefox: לא לסדר לפי שעון קיר ([BEP](https://docs.syncthing.net/specs/bep-v1.html)) | `vat` הוא זמן הטלפון. ביקור חדש עם `at <= vat` נזרק (`vis.removeAll { it.at <= vat }`) | לתת לביקורים מספר רץ, כמו לפעולות |
| 13 | מחיקה לפי כתובת כשאין מזהה | floccus 4.12 הפסיק למחוק כפילויות עם אותה כתובת | `del` בלי `id` מוחק את הסימנייה הראשונה עם אותו מפתח, שיכולה להיות בתיקייה אחרת | `del` רק לפי מזהה. בלי מזהה — לא כלום |
| 14 | זהות שאגרסיבית יותר מ־Chromium | Chromium מזהה לפי כתובת **וגם** כותרת; floccus לפי `href` מדויק ([Tree.ts](https://raw.githubusercontent.com/floccusaddon/floccus/develop/src/lib/Tree.ts)) | המפתח משמש למניעת כפילויות בלבד, לא למחיקה (טוב). `key()` של `javascript:` הופך את כל הקוד לאותיות קטנות | לא לנרמל סכמות שאינן http/https |
| 15 | תיקיות אחיות באותו שם | floccus 5.4.0: "move stability with same-titled folders" | `dirs` עם אותו `p` מתנגשות | להוסיף את מזהה התיקייה ב־Chrome ל־`dirs` |
| 16 | סימניות מנוהלות ו־EditBookmarksEnabled | "Can't modify managed bookmarks." / "Bookmark editing is disabled." ([bookmarks_helpers.cc](https://chromium.googlesource.com/chromium/src/+/main/chrome/browser/extensions/bookmarks/bookmarks_helpers.cc)) | `managed` ממופה ל־`r='o'` ונראה כאילו אפשר למחוק אותו. מדיניות שחוסמת עריכה גורמת לשגיאה בכל ריצה | לדלג על `unmodifiable`. "editing disabled" = מצב קריאה בלבד |
| 17 | סערת אירועים בזמן ייבוא או מיזוג של Sync | "Expensive observers should ignore onCreated until onImportEnded" ([API](https://developer.chrome.com/docs/extensions/reference/api/bookmarks)) | יש השהיה של 30 שניות (`soon`). אין טיפול ב־`onImportBegan` | להשהות את הסנכרון בין `onImportBegan` ל־`onImportEnded` |
| 18 | מיון בתוך מנהל הסימניות | xBrowserSync דרס את המיון ([#365](https://github.com/xbrowsersync/app/issues/365)) | אנחנו לא דורסים, אבל לא מאזינים ל־`onChildrenReordered` (נתפס רק בריצה של כל 5 דקות) | להוסיף את המאזין |
| 19 | כתובות מסוכנות | floccus #2389: `javascript:`/`data:` מקובץ הסנכרון הועברו ישר ל־`create` ([#2389](https://github.com/floccusaddon/floccus/issues/2389)) | הוספות מהטלפון מסוננות ב־`isWeb` (טוב). מ־Chrome לטלפון עוברת כל סכמה | בטלפון לא לפתוח `javascript:`/`data:`/`file:`/`chrome:` מתוך state.json |
| 20 | גודל `storage.local` | 10MB בלי `unlimitedStorage` ([storage](https://developer.chrome.com/docs/extensions/reference/api/storage)) | `hv` עם 20,000 ביקורים הוא כמה MB | להוסיף `unlimitedStorage`, או לדחוס |
| 21 | שעון ההתראה ב־MV3 | `persistAcrossSessions` לא צפוי לפני Chrome 150. צריך לבדוק עם `alarms.get` בכל הפעלה ([alarms](https://developer.chrome.com/docs/extensions/reference/api/alarms)) | ה־alarm נוצר רק ב־`onInstalled`/`onStartup` | `alarms.get('sync')` ברמה העליונה של ה־service worker, ויצירה אם חסר |

## 4. תיקונים לפי עדיפות

| עדיפות | מה | איפה |
|---|---|---|
| 1 | `ep` ל־ops.json ו־`ackEp` ל־state.json, כדי שאיפוס של המספר הרץ לא יזרוק פעולות (מקרה 1) | `BrChrome.kt`, `core.js` (`planOps`, `buildState`) |
| 2 | שורשים רק לפי `folderType` ו־`syncing`. יעד ההוספה: mobile→other, עם עדיפות ל־syncing. בלי `kids[i]`. `minimum_chrome_version` 134 (מקרה 3) | `core.js` (`flatten`, `mobileFolderId`), `manifest.json` |
| 3 | בעלות על התוסף (`wid` ב־state.json), כדי שעותק שני לא יכתוב ולא יחיל פעולות (מקרה 2) | `sync.js`, popup |
| 4 | שער מחיקה גדולה בטלפון, לכיוון Chrome→טלפון. עצירה כשתיקיית שורש נעלמת או כשמזוהה התנתקות (מקרה 4) | `BrChrome.kt`, `sync.js` |
| 5 | בדיקה לפני `deleteRange` שהביקור לבד באותה אלפית. הודעה על ההד שמגיע לכל המכשירים (מקרה 5) | `sync.js` |
| 6 | fileId שמור, `generateIds`, ובחירה דטרמיניסטית כשיש כפילויות (מקרה 6) | `drive.js`, `BrChrome.kt` |
| 7 | gzip או resumable, בדיקת גודל ו־md5, בדיקת `v` ומספר הסימניות. כשל קריאה לא מאפס את `ack` (מקרים 7–8) | שני הצדדים |
| 8 | התאמת החשבון לפי `about.user` (מקרה 9) | שני הצדדים |
| 9 | סינון לפי `transition`, מרווח תפוגה של יומיים, שמירה מיידית של `vat`/`echo` (מקרים 10–11) | `sync.js`, `core.js` |
| 10 | שאר השורות בטבלת ה"נמוך" (12–21) | — |

כל תיקון צריך בדיקה ב־`tests/chrome-ext.test.js` שמשחזרת את המקרה: התקנה מחדש עם `seq=1`, עץ עם ארבעה שורשים מאחסון כפול, תיקיית נייד מוסתרת, state.json שנקטע, ושני עותקים של התוסף.

## 5. מה לא נמצא, או לא ודאי

- **"העלאת סימניות מקומיות לחשבון":** לא נמצא מקור שאומר אם המזהים נשמרים או שנוצרים צמתים חדשים. ממילא תיקיות החשבון מקבלות מזהים חדשים.
- **מאיזו גרסה של Chrome** `kEnforceBookmarkVisibilityOnExtensionsAPI` פעיל ב־Stable. גם הגרסה של `folderType` לא ודאית: 134 לפי ה־API, ו־138 Canary לפי הבלוג.
- **ספירת אירועים במיזוג ראשון של Chrome Sync:** כמה אירועים הוא שולח, והאם הוא מאגד אותם. לא תועד.
- **עיגול הזמן ב־`deleteRange`:** האם `deleteRange(t, t+1)` עם זמן שבור באלפיות מוחק בדיוק את הביקור, או צריך `+0.001`. לא נבדק בפועל.
- **זמנים כשהשעון קופץ:** איך מזהי ביקורים וזמנים מתנהגים, והאם שני ביקורים יכולים ליפול על אותה אלפית. לא נבדק.
- **כותרת לביקור מ־`addUrl`:** האם הכתובת מקבלת כותרת כשיש לה כבר ביקור אמיתי. משוער שכן, לא אומת.
- **Drive:**
  - האם `files.list` ב־appDataFolder רואה מיד קובץ שנוצר.
  - האם If‑Match עובד ב־v3.
  - האם כללי שמירת הגרסאות חלים על appDataFolder.
  
  אין מקור רשמי לאף אחד מהם.
- **appDataFolder משותף לשני לקוחות OAuth:** הלקוח של התוסף והלקוח של אנדרואיד חייבים להיות באותו פרויקט Google Cloud כדי לראות את אותו appDataFolder. זו הסקה מהתיעוד, לא ניסוח מפורש.
- **פרויקטים שלא נבדקו:** EverSync, Raindrop.io, Brave Sync, Vivaldi Sync, Promnesia, Memex. הם סגורים, או בלי מעקב באגים ציבורי, או לא נבדקו בזמן הזה.
