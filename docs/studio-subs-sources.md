# Studio — מקורות כתוביות מהרשת: מחקר (01/11/2026)

רקע: לפרק Undercover Billionaire ‏S02E08 לא הוצעו כתוביות. הזיהוי היה נכון (`tt8417266:2:8` = "Cocktail of Chaos"), אבל אין לפרק כתוביות באף מקור. ב־OpenSubtitles יש לסדרה רק S01E01–04 ו־S02E01–02. ב־Wizdom אין לה כלום.
המצב היום (`studionet.js`, `subsFind`): זיהוי לפי טביעת אצבע (`rest.opensubtitles.org`), ואם אין — לפי השם מול Cinemeta. אחר כך חיפוש ב־OpenSubtitles דרך Stremio (v3) ובעברית ב־Wizdom.

## 1. בדיקה חיה של המקורות (01/11/2026, curl מהענן)
| מקור | מפתח | CORS (ישירות מהטלפון) | מה נמצא |
|---|---|---|---|
| `rest.opensubtitles.org` (ה־REST הישן) | לא | כן, `*`. GET פשוט בלי preflight | **מחזיר יותר מ־v3**: ב־Friends ‏S01E01 בעברית — 6 מול 3. נותן `SubLastTS`, `MovieFPS`, `SubAutoTranslation`, `SubFromTrusted`, `SubHearingImpaired`, `SubDownloadsCnt`. חיפוש לפי `imdbid` צריך 7 ספרות (`0108778`), אחרת מחזיר 302, והפרמטרים בסדר אלפביתי (`episode-/imdbid-/season-/sublanguageid-`). ⚠ מדריך אחד מ־2026 טוען שה־API הישן של ‎.org ייסגר ב־2026. היום הוא עובד |
| `opensubtitles-v3.strem.io` (בשימוש) | לא | כן | רק חלק מהתוצאות (גם לפי SubMaker). אין בו `SubLastTS` |
| `api.opensubtitles.com` (v1) | כן (Api-Key חינמי) | כן | בלי מפתח: 403. מכסת הורדות קטנה (בפורומים: 5 לכתובת IP ביום בלי התחברות, ויותר עם חשבון). נותן `moviehash_match`, `machine_translated`/`ai_translated` |
| Wizdom (בשימוש) | לא | כן | עברית בלבד. אין בו את Undercover Billionaire |
| **Gestdown** (`api.gestdown.info`, מראה ל־Addic7ed) | **לא** | **לא** (אין `Access-Control-Allow-Origin`) — רק דרך השרתון | סדרות בלבד, לפי TVDB/שם. ב־Friends יש אנגלית (גרסאות DVDRip/TvR). אין בו את Undercover Billionaire. חזק בסדרות אמריקאיות עכשוויות |
| **SubDL** (`api.subdl.com/api/v1/subtitles`) | כן (חינמי) | כן | בלי מפתח: 403. חיפוש לפי imdb/tmdb/שם קובץ, עונה ופרק ושפות. הדף שלהם חסום לסורקים (Cloudflare) — המכסות לא אומתו |
| **SubSource** (`api.subsource.net/api/v1`, היורש של Subscene) | כן (חינמי, `X-API-Key`) | לא נבדק | חינם: 60 בדקה / 7,200 ביום. ארכיון Subscene — **הרבה עברית** |
| **Wyzie Subs** (`sub.wyzie.io`) | כן (חינמי, `key=`) | כן | מאגד של OpenSubtitles, SubDL ו־Podnapisi, עם סינון לפי שם קובץ. הם עצמם ממליצים לשמור את המפתח בשרת |
| Podnapisi | לא (JSON עם `Accept: application/json`) | לא נבדק | הרשת של הענן החזירה 502. לבדוק מהשרתון |
| BetaSeries | כן | כן | צרפתית בעיקר |
| Ktuvit (עברית) | חשבון + עוגייה | לא | ה־API הרשמי נסגר. יש רק סורקים לא רשמיים. האתר לא ענה מהענן. **לא מומלץ** (תנאי שימוש) |
| Addic7ed, Subf2m, YIFY, TVsubtitles | — | — | דפי HTML בלבד (סריקה = תנאי שימוש — לא). Gestdown נותן את Addic7ed כ־API |
| Stremio Community Subtitles | חשבון | כן | תוסף שדורש הגדרה. בעצמו מאגד את OpenSubtitles, SubDL ו־SubSource עם מפתחות |

**מסקנה:** אין מקור נוסף שגם חינמי, גם בלי מפתח וגם פתוח לטלפון, חוץ מה־REST הישן של OpenSubtitles. הכי משתלם לפי הסדר:
1. **REST של OpenSubtitles.org לפי שפה (he, en, השפה המקורית)** — בלי מפתח, מהטלפון, ובערך פי 2 תוצאות מ־v3. עבודה של כמה שורות ב־`subsFind`.
2. **SubSource + SubDL** (הכי הרבה כיסוי, כולל עברית) — מפתח חינמי. המפתח לא נכנס לקוד (הריפו ציבורי). שתי אפשרויות: (א) המשתמש מדביק מפתח משלו בהגדרות, נשמר בחשבון שלו, והמכסה שלו — עקבי עם ההחלטה "שהמכסה תהיה למשתמש"; (ב) מפתח מוצפן בשרתון (`lib/vault.js`) ו־`op` בקובץ קיים (12/12 פונקציות).
3. **Gestdown** (Addic7ed) — בלי מפתח אבל בלי CORS, ולכן דרך `op` בשרתון. רק לסדרות.
4. Wyzie — רק אם רוצים מקור אחד שמאגד כמה. מוסיף תלות בצד שלישי שגם הוא סורק.

## 2. דיוק — שיהיה רק הפרק או הסרט הנכון
מה כבר יש: רמות h/r/n, לתרגום רק h, והעובד מאמת לפי טקסט (`subref_grade`). מה עוד אפשר להוסיף, לפי מה שמקובל בכלים המקצועיים (משקולות subliminal: טביעה 359, סדרה 180, שנה 90, עונה ופרק 30 כל אחד, קבוצת הוצאה 15):
1. **בחירת כותר מדויקת ב־Cinemeta**: היום `nsPickMeta` לוקח את התוצאה הראשונה. צריך להעדיף התאמה מלאה של השם המנורמל, למשל "Undercover Billionaire" ולא "…: Comeback City", ושנה תואמת. לא להחזיר זיהוי כשאין התאמה ברורה.
2. **שם הפרק כמאמת**: בשם הקובץ יש לפעמים את שם הפרק (`cocktail.of.chaos`), ול־Cinemeta יש `videos[].name`. התאמה ביניהם = אישור חזק, ואי־התאמה = דגל. כך תופסים "S01E07 שהוא בעצם פרק 8".
3. **SxxEyy בשם ההוצאה של הכתובית** — לדחות כשהעונה או הפרק שונים מהמבוקש. ב־zip של עונה זה כבר נעשה.
4. **אורך**: `SubLastTS` (REST) או הכתובית האחרונה, מול אורך הסרטון. הפרש של יותר מכמה אחוזים = גרסה אחרת או פרק אחר. נכון גם ל־FPS ‏(`MovieFPS` מול הסרטון, 23.976 מול 25 = היסט מצטבר).
5. **סינון תרגומי מכונה**: `SubAutoTranslation=1` (REST) / `machine_translated`/`ai_translated` (v1) — לזרוק. מקור אמין (`SubFromTrusted`) ומספר הורדות — רק לסדר בתוך אותה רמה.
6. **טביעת אצבע קודם, ושם רק כגיבוי** — כמו היום (סדר מקובל: טביעה, שם, IMDb). טביעה מתאימה רק ל־OpenSubtitles. במקורות האחרים ההתאמה הכי טובה היא קבוצת הוצאה + מקור (WEB/BluRay) + רזולוציה (`nsRelMatch`).
7. **אימות לפי הקול**: מסיכת הדיבור של הסרטון מול זמני הכתוביות (קורלציה, כמו ב־`docs/studio-learning.md`). זה המבחן הכי חזק, כי הוא לא תלוי בשמות, ומתאים לעובד.

מקורות: SubMaker (submaker.elfhosted.com), SubSource API docs (subsource.net/api-docs), Wyzie notice (sub.wyzie.io/notice), Gestdown (api.gestdown.info), subliminal score docs, Ktuvit-api (github.com/maormagori/Ktuvit-api), שרשורי Jellyfin/Emby/Firecore על מכסות OpenSubtitles.

## 3. מה יושם (2.99.0, 01/11/2026)
- `nsParseRest` — חיפוש ב־REST לפי מזהה ושפה (`heb`, `eng`; שפה אחת בכל בקשה — רשימה עם פסיק לא עובדת). ההורדה דרך `NS_DLF` (Stremio, UTF-8), כך שלא צריך מקור חדש ב־CSP. נזרקים: תרגום מכונה, `sub`/MicroDVD, כמה דיסקים.
- `nsPickMeta` — שם זהה (`nsNorm`), אחר כך מכיל/מוכל לפי ההפרש הקטן, ואז שנה. אין התאמה בשם = אין זיהוי.
- `nsGuess().et` + `nsEpFix` — שם הפרק מהקובץ מול `meta/series/<id>.json`. שם זהה גובר על מכיל ("Three Million Dollar Bet" ⊃ "Million Dollar Bet"). רק כשהזיהוי לפי השם — בזיהוי לפי טביעה לא פונים.
- `nsVerify` — כפולים לפי מזהה הקובץ (Stremio/REST), פרק/עונה/שנה אחרים בשם ההוצאה, אורך (`last` מול `opt.dur`). טביעה (h) לא נפסלת.
- בדיקה חיה: UB ‏S02E08 מזוהה נכון (ep:'ok'), ועדיין אין לו כתוביות — אין בשום מקור. "S02E05.Three.Million.Dollar.Bet" מתוקן ל־S02E01. ב־Friends ‏S01E01: 90 תוצאות, כולל מה־REST.
- עוד לא: SubSource/SubDL (מפתח), Gestdown (השרתון), השוואת FPS (אין FPS של הסרטון בטופס), אימות לפי הקול בעובד.
