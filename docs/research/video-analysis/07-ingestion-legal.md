# קליטת סרטוני הרצאות, וובינרים וקורסים לניתוח בשרת — yt-dlp, אותות חינמיים, פלטפורמות, משפט ועלויות (מצב 9/11/2026)

> הערות מחקר לשכבת הקליטה של THE SNOWBALL Studio (שרת Hetzner CX53: x86, ‏16 vCPU משותפים, 32GB, בלי GPU, IP של דאטה־סנטר בגרמניה/פינלנד; yt-dlp עם עוגיות של חשבון ייעודי; האפליקציות בטלפון מעלות קבצים ל־R2).
> **מידע כללי בלבד — לא ייעוץ משפטי.**
> מגבלות המחקר: (1) תקציב החיפוש ברשת של הסבב (משותף לכל הסוכנים) נגמר באמצע העבודה. מאותו רגע אומתו עובדות רק בשליפה ישירה של מקורות ראשוניים — קוד ותיעוד yt-dlp מענף master כפי שהיה ב־9/11/2026 (גרסה אחרונה 2026.10.26), תיעוד רשמי, נוסחי חוק — ובמדידות מקומיות. (2) המדידות המקומיות נעשו בסביבת המחקר (Intel Xeon ‏2.1GHz, ‏4 vCPU, ffmpeg 6.1.1, Pillow 12.3) על תוכן **סינתטי** — לא על ה־CX53 ולא על סרטון אמיתי (לא הורד אף סרטון). (3) "מקור משני" = כתבה/בלוג שמסכמים מקור אחר; "לא אומת" = לא נמצא מקור ראשוני.

## 1. yt-dlp מול YouTube ב־2025–2026: מה עובד משרת דאטה־סנטר, חסימות, קצב, PO token, פרוקסי ובחירת פורמטים

### שורה תחתונה (Takeaway)
yt-dlp (גרסה 2026.10.26) עדיין המנוע המעשי, אבל מאז 12/11/2025 הוא **חייב** JS runtime חיצוני (Deno כברירת מחדל) וחבילת `yt-dlp-ejs`; לקוח `web` עבר ל־SABR בלבד, וההורדה נשענת על לקוחות אחרים (`tv_samsung`, `visionos`, `web_embedded`). מ־IP של דאטה־סנטר יוטיוב דורש "Sign in to confirm you're not a bot" — לפי המתחזקים זו חסימת אמון ב־IP שאי אפשר לתקן בצד yt-dlp; העוגיות של חשבון ייעודי עוקפות זאת לפעמים (בסיכון חסימת החשבון), ו־PO token לבד לא עוקף חסימת IP. האמין ביותר = IP ביתי/סלולרי (הורדה בטלפון והעלאה ל־R2, או פרוקסי ביתי ב־$1–8 ל־GB — רק באישור). ל־OCR: וידאו בלבד ב־1080p (H.264 או AV1 — במדידה שלנו עלות הפענוח כמעט זהה) + אודיו נפרד רק כשצריך, והורדת קטעים בלבד ב־`--download-sections`.

### ממצאים מתועדים (Cited Findings)
**מצב הכלי והחובה ל־JS runtime**
- הגרסה האחרונה היא 2026.10.26; היא מחייבת Python 3.11 ומעלה ("Python 3.10 has reached its end-of-life as of October 2026") — [yt-dlp Changelog](https://github.com/yt-dlp/yt-dlp/blob/master/Changelog.md).
- גרסה 2025.11.12: "An external JavaScript runtime is now required for full YouTube support" — [yt-dlp Changelog](https://github.com/yt-dlp/yt-dlp/blob/master/Changelog.md); ההודעה הרשמית: "Support for YouTube without a JavaScript runtime is now considered "deprecated"", זמינות הפורמטים בלעדיו "is expected to worsen", ו־"eventually, support for YouTube will not be possible at all without a JS runtime" — [yt-dlp issue #15012, 12/11/2025](https://github.com/yt-dlp/yt-dlp/issues/15012).
- מדריך EJS: Deno מומלץ ופעיל כברירת מחדל (מינימום 2.3.0), רץ "with restricted permissions (e.g, no file system or network access)"; Node (22+) רק עם `--js-runtimes node`; QuickJS נתמך (גרסאות ישנות איטיות "several minutes"); Bun deprecated (עד 1.3.14). הסקריפטים (`yt-dlp-ejs`) מגיעים בתוך הבינארי הרשמי; בהתקנת pip צריך `pip install -U "yt-dlp[default]"` או `--remote-components ejs:npm` / `ejs:github`; גרסת `yt-dlp-ejs` "MUST match" את זו שב־pyproject של yt-dlp — [yt-dlp wiki: EJS](https://github.com/yt-dlp/yt-dlp/wiki/EJS).
- 2026.06.09 העלתה את המינימום ל־Deno ‏2.3.0 ול־Node ‏22, ו־Bun נתמך רק בגרסאות 1.2.11–1.3.14 (ומסומן deprecated) — [yt-dlp Changelog](https://github.com/yt-dlp/yt-dlp/blob/master/Changelog.md).
- אצלנו כבר: Deno בתמונת העובד, בלי קיבוע `player_client`, ‏`--sleep-requests 1`, ועם עוגיות החשבון `--sleep-interval 5 --max-sleep-interval 10` — [translator/fetchurl.py](../../../translator/fetchurl.py); bgutil 2.0.2 במצב script-deno, ושתי חסימות ברצף מכבות את מצב "יוטיוב בשרת" — [docs/studio-server.md](../../studio-server.md).

**לקוחות (player clients), SABR ו־PO token**
- ברירת המחדל היום: `tv_samsung,visionos,web`; בלי JS runtime — `web` ו־`tv_samsung` נשמטים; עם עוגיות של חשבון רגיל — `web_embedded,tv_samsung,web`, ושל Premium — `web_creator,tv_samsung,web` — [yt-dlp README, extractor-args youtube](https://github.com/yt-dlp/yt-dlp/blob/master/README.md); אותו דבר בקוד (`_DEFAULT_CLIENTS`, `_DEFAULT_AUTHED_CLIENTS`) — [youtube/_video.py](https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/extractor/youtube/_video.py).
- `tv_samsung` נוסף והפך לברירת מחדל ב־2026.10.21; `android_vr` הוצא מברירת המחדל ב־2026.08.19; ‏`ios_downgraded` ו־`tv_embedded` הוסרו כשבורים ב־2026.01.31 — [yt-dlp Changelog](https://github.com/yt-dlp/yt-dlp/blob/master/Changelog.md). (הקצב: ברירת המחדל מתחלפת כל כמה חודשים.)
- SABR: ב־29/4/2025 "the web client has removed all https formats (adaptiveFormats) and only has SABR protocol streaming url"; מנוע הורדה ל־SABR היה "in development" והנושא ננעל ב־8/2025 — [yt-dlp issue #12482](https://github.com/yt-dlp/yt-dlp/issues/12482). בקוד של היום, לקוחות `web`/`web_safari` מדלגים על פורמטי https עם ההודעה "YouTube is forcing SABR streaming for this client" — [youtube/_video.py](https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/extractor/youtube/_video.py). אין ב־Changelog עד 2026.10.26 רשומה על תמיכה בהורדת SABR — [yt-dlp Changelog](https://github.com/yt-dlp/yt-dlp/blob/master/Changelog.md).
- מדריך PO Token (עריכה אחרונה 12/7/2026): בלי הטוקן בקשות "may return HTTP Error 403, or result in your account or IP address being blocked"; הקשרים: GVS, ‏Player, ‏Subs. טבלת הלקוחות: `web` — Subs+GVS, ורק פורמטי SABR; ‏`web_safari` — GVS, אבל פורמטי ה־HLS שלו לא צריכים טוקן לעת עתה; ‏`mweb` — GVS; ‏`tv` — בלי טוקן, אבל כל הפורמטים DRM בלי עוגיות; ‏`android_vr` — בלי טוקן, בלי סרטוני "made for kids"; מנויי Premium לא צריכים טוקן GVS; הטוקנים קשורים למזהה הסרטון ולכן "Manually extracting PO Tokens is no longer recommended"; תוספים מומלצים: bgutil-ytdlp-pot-provider ו־yt-dlp-getpot-wpc; תוקף הטוקן "may be" קצר עד 12 שעות — [yt-dlp wiki: PO Token Guide](https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide).
- הדגלים הרלוונטיים: `po_token` (בפורמט `CLIENT.CONTEXT+PO_TOKEN`), ‏`fetch_pot` (always/never/auto), ‏`formats=missing_pot`, ו־`use_ad_playback_context` לדילוג על המתנת פרסומת (רק `mweb`/`web_music`) — [yt-dlp README](https://github.com/yt-dlp/yt-dlp/blob/master/README.md).
- bgutil: מצב שרת HTTP (פורט 4416) מומלץ; מצב סקריפט "NOT recommended for high concurrency usage" (מטמון טוקנים ברירת מחדל 6 שעות); דורש Node 22+ או Deno 2.0+; הטוקן "does not guarantee bypassing 403 errors or bot checks" ו־"does not bypass IP-based login restrictions"; השרת לא מאומת — חשיפה בלי `127.0.0.1` "publishes the server on all host interfaces"; רישיון GPL-3.0 — [bgutil-ytdlp-pot-provider README](https://github.com/Brainicism/bgutil-ytdlp-pot-provider).
- ב־22/9/2024 מתחזק bgutil כתב ששינוי של יוטיוב "breaking this solution for most datacenter IP addresses" — [bgutil issue #37](https://github.com/Brainicism/bgutil-ytdlp-pot-provider/issues/37) (ישן — 2024).

**חסימת דאטה־סנטר, עוגיות וקצב**
- מתחזק yt-dlp, ‏25/2/2025: "Youtube blocked anonymous access from many datacenter IPs" ו־"IP blocks are nothing that can be affected from the yt-dlp side"; ‏12/2/2026: "If you are getting this error, it means that YT does not trust your IP address enough to allow anonymous access" — והפתרון: לכבות VPN או להעביר עוגיות של חשבון מחובר — [yt-dlp issue #12475](https://github.com/yt-dlp/yt-dlp/issues/12475).
- עוגיות מתחלפות: "As soon as you use YouTube in your browser the cookies rotate making your exported cookies invalid" (15/3/2025) — [yt-dlp issue #12475](https://github.com/yt-dlp/yt-dlp/issues/12475); הנוהל: לייצא מחלון פרטי אחרי ניווט ל־`robots.txt` ולסגור אותו מיד; התחברות OAuth "no longer works" — [yt-dlp wiki: Extractors](https://github.com/yt-dlp/yt-dlp/wiki/Extractors).
- אזהרה רשמית: "By using your account with yt-dlp, you run the risk of it being banned (temporarily or permanently)" — מומלץ חשבון זמני — [yt-dlp wiki: Extractors](https://github.com/yt-dlp/yt-dlp/wiki/Extractors).
- מגבלת קצב: השגיאה "This content isn't available, try again later" = חריגה; "the rate limit for guest sessions is ~300 videos/hour (~1000 webpage/player requests per hour). For accounts, it is ~2000 videos/hour"; מומלץ 5–10 שנ׳ בין הורדות — [yt-dlp wiki: Extractors](https://github.com/yt-dlp/yt-dlp/wiki/Extractors). הקביעה `-t sleep` = `--sleep-subtitles 5 --sleep-requests 0.75 --sleep-interval 10 --max-sleep-interval 20` — [yt-dlp README](https://github.com/yt-dlp/yt-dlp/blob/master/README.md).
- HTTP 429/402 = חסימה רכה של ה־IP; פותרים CAPTCHA בדפדפן ומעבירים עוגיות (ו־`--source-address` אם יש כמה כתובות) — [yt-dlp wiki: FAQ](https://github.com/yt-dlp/yt-dlp/wiki/FAQ).
- בתביעת היוצרים נגד ByteDance פורטו אמצעי ההגנה של יוטיוב: "rolling cipher", חסימה והגבלת קצב לפי IP, כתובות זרם קצרות־חיים וקשורות לסשן, CAPTCHA ו־PO tokens — [Trademark Lawyer Magazine, 10/2026](https://trademarklawyermagazine.com/bytedance-must-face-youtubers-ai-training-suit-over-alleged-youtube-scraping/) (תיאור טענות, לא ממצא).

**פרוקסי ביתי — מחירים (USD; ייתכן בלי מע"מ)**
- סקר מחירים (פורסם 3/8/2026, עודכן 6/11/2026; 57 ספקים, קריאות מחיר 26/9–22/10/2026): לרכישה של 10GB — Bright Data ‏$8.00/GB, ‏Oxylabs ‏$5.00, ‏Decodo ‏$3.50, ‏Webshare ‏$2.75, ‏DataImpulse ‏$1.00; ל־100GB — Oxylabs ‏$4.00, ‏Decodo ‏$2.75, ‏Webshare ‏$2.25, ‏DataImpulse ‏$1.00; זולים יותר (Proxiware Eco ‏$0.30, ‏Rainproxy ‏$0.60) — עם הסתייגות שחלק מהמחירים בלי מע"מ — [HProxy price study 2026](https://hproxy.com/blog/residential-proxy-price-study-2026) (פורסם בבלוג של hproxy.com — לאמת מחיר עדכני אצל הספק לפני כל רכישה).

**בחירת פורמטים והורדה חלקית**
- סדר המיון ברירת המחדל: `lang,quality,res,fps,hdr:12,vcodec,channels,acodec,size,br,asr,proto,ext,hasaud,source,id`; העדפת codec: `av01 > vp9.2 > vp9 > h265 > h264`; הקביעה `-t mp4` = `-S vcodec:h264,lang,quality,res,fps,hdr:12,acodec:aac` — [yt-dlp README, Format Selection](https://github.com/yt-dlp/yt-dlp/blob/master/README.md).
- `--download-sections "*10:15-inf"` מוריד טווח זמן (צריך ffmpeg; אפשר כמה פעמים), ו־`--force-keyframes-at-cuts` לחיתוך מדויק — [yt-dlp README](https://github.com/yt-dlp/yt-dlp/blob/master/README.md).
- יוטיוב ממליץ להעלאה ב־1080p ‏8 Mbps (24–30fps) וב־720p ‏5 Mbps, GOP סגור של חצי קצב הפריימים — אלה המלצות **העלאה**, לא מה שיוטיוב מגיש — [YouTube Help: upload encoding settings](https://support.google.com/youtube/answer/1722171).

### היסקים (Inferences)
- **מסלול מומלץ בשרת**: לא לקבע `player_client` (תואם את הקוד אצלנו); לעדכן yt-dlp ו־`yt-dlp-ejs` יחד (בדיקת התאמה ל־pyproject); לשמור Deno ≥2.3; קצב שמרני הרבה מתחת ל־2000 סרטונים/שעה (בפועל עשרות בודדות). אם יגדל מספר ההורדות במקביל — לעבור מ־bgutil script ל־bgutil HTTP server שמאזין רק ל־`127.0.0.1` (ההמלצה של bgutil עצמו).
- **"רוטציה" של כמה חשבונות** מגדילה את מספר החשבונות בסיכון ולא מתקנת את אמון ה־IP (ההודעה של המתחזקים היא על ה־IP) — לא כדאי; חשבון ייעודי אחד בקצב נמוך + נפילה מסודרת לטלפון.
- **IP ביתי**: הדרך הזולה והאמינה היא להוריד במכשיר של המשתמש (IP סלולרי/ביתי) ולהעלות ל־R2 — המערכת כבר יודעת "יוטיוב רק באנדרואיד". פרוקסי ביתי למדיה יקר: שעת הרצאה ב־1080p ‏(≈0.22–1.1GB בהנחת 0.5–2.5 Mbps, ראו סעיף 5) × ‏$1–8/GB ≈ ‏$0.2–9 לשעת וידאו — רק באישור מפורש עם מחיר.
- **הורדה דו־שלבית ל־OCR**: שלב 1 — מטא־דאטה, כתוביות, פרקים, heatmap ו־storyboard (בלי וידאו); שלב 2 — `--download-sections` של 1080p רק סביב נקודות החלפת שקופית/פרקים. חוסך תעבורה (קריטי אם יש פרוקסי בתשלום) וזמן.
- **פורמט**: `-S "res:1080,vcodec:h264"` (או `-f "bv*[height<=1080][vcodec^=avc1]+ba/bv*[height<=1080]+ba"`) כשמתכננים דגימת keyframes בלבד; AV1 קביל (עלות הפענוח ב־dav1d קרובה לזו של H.264 במדידה שלנו); **להימנע מ־VP9** כשרוצים `-skip_frame nokey` — המפענח המקורי של ffmpeg לא מכבד אותו (סעיף 5). אם יש כתוביות טובות — אפשר לוותר על האודיו לגמרי.
- `web_safari` (HLS בלי טוקן GVS לעת עתה) ו־Premium (בלי טוקן GVS) הם שני מסלולים לטוקנים פחותים — אבל אף אחד מהם לא פותר את אמון ה־IP.

### פערים (Gaps)
- אין נתון רשמי של יוטיוב על חסימת טווחי Hetzner, ואין לנו סטטיסטיקת הצלחה שלנו לפי IP — צריך טלמטריה מהשרת (שיעור `blocked` לפי שעה).
- לא ברור אם `tv_samsung`/`visionos` דורשים PO token (לא מופיעים בטבלת המדריך שנערכה לאחרונה ב־7/2026).
- לא אומת אם כתובות המדיה (googlevideo) קשורות ל־IP שביקש אותן — קובע אם אפשר להעביר בפרוקסי רק את בקשות ה־API ולהוריד את המדיה ישירות.
- מחיר YouTube Premium בישראל (מסלול בלי טוקן GVS) — לא נבדק.
- הקצב בפועל של מגבלות הכתוביות (429 על timedtext) — לא נמצא מקור.

## 2. אותות חינמיים מיוטיוב בלי AI — כתוביות, פרקים, "הכי נצפה שוב", תגובות, צ'אט חי, storyboards, פלייליסטים; ה־API הרשמי; Gemini עם קישור יוטיוב

### שורה תחתונה (Takeaway)
אפשר לקצור הרבה בלי לשלם על AI: כתוביות ידניות ואוטומטיות (כולל עברית, 67 שפות), תרגום אוטומטי, פרקים, heatmap של 100 נקודות מנורמלות, תגובות לפי "top" עם חותמות זמן, צ'אט חי של שידורים (כ"כתובית"), storyboards ופלייליסטים — הכל בפקודת yt-dlp אחת עם `--skip-download`. ה־API הרשמי זול ותקין לתגובות ולמטא־דאטה (1 יחידה לקריאה), אבל **לא מאפשר להוריד כתוביות של סרטון שאינו שלך**. Gemini מקבל קישור יוטיוב ציבורי בחינם (עד 8 שעות וידאו ביום בשכבה החינמית), אבל זה כבר AI, והנתונים בשכבה החינמית משמשים את גוגל.

### ממצאים מתועדים (Cited Findings)
**כתוביות ותרגום אוטומטי**
- פורמטי הכתוביות של יוטיוב ב־yt-dlp: `json3`, ‏`srv1`, ‏`srv2`, ‏`srv3`, ‏`ttml`, ‏`srt`, ‏`vtt` — [youtube/_video.py `_SUBTITLE_FORMATS`](https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/extractor/youtube/_video.py).
- כתוביות מתורגמות אוטומטית נבנות רק עם `--write-auto-subs` או `--list-subs`, ואפשר לדלג עליהן ב־`youtube:skip=translated_subs`; לפי הקוד "Only web/mweb clients provide translationLanguages" ו־"Setting tlang=lang returns damaged subtitles" — [youtube/_video.py](https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/extractor/youtube/_video.py); [yt-dlp README](https://github.com/yt-dlp/yt-dlp/blob/master/README.md).
- תמיכת PO token לכתוביות נוספה ב־2025.05.22 — [yt-dlp Changelog](https://github.com/yt-dlp/yt-dlp/blob/master/Changelog.md); לקוח `web` צריך טוקן Subs — [PO Token Guide](https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide).
- כתוביות אוטומטיות קיימות ב־67 שפות לסרטונים ארוכים ו־Shorts, **כולל עברית**; בשידור חי — אנגלית בלבד; האיכות "may vary"; סיבות להיעדר: סרטון ארוך מדי, שמע גרוע, שתיקה ארוכה בהתחלה, דוברים חופפים או כמה שפות — [YouTube Help: automatic captions](https://support.google.com/youtube/answer/6373554).

**פרקים ותיאור**
- פרקים מהתיאור: חותמת ראשונה `00:00`, לפחות שלוש בסדר עולה, פרק מינימלי 10 שנ׳; פרקים אוטומטיים מופעלים כברירת מחדל בהעלאות חדשות אבל לא מובטחים לכל סרטון — [YouTube Help: video chapters](https://support.google.com/youtube/answer/9884579).
- yt-dlp מחלץ פרקים מ־JSON, מפאנל ה־engagement ("macroMarkersListRenderer") ומהתיאור — [youtube/_video.py](https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/extractor/youtube/_video.py).

**heatmap ("Most replayed")**
- השדה `heatmap` ב־yt-dlp: רשימת `{start_time, end_time, value}` כש־value הוא "The normalized value of the data point (float between 0 and 1)" — [extractor/common.py](https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/extractor/common.py); מקורו ב־markers מסוג `MARKER_TYPE_HEATMAP` עם `intensityScoreNormalized`, ובדיקות היחידה מצפות ל־100 נקודות (`'heatmap': 'count:100'`) — [youtube/_video.py](https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/extractor/youtube/_video.py).
- הפיצ'ר ("Most replayed") הושק ב־18/5/2022 במחשב ובנייד — [9to5Google, 2022](https://9to5google.com/2022/05/18/youtube-most-replayed/) (ישן).
- הגרף מוצג רק אחרי מספיק נתוני צפייה (לפי המקור — בדרך כלל עשרות אלפי צפיות), והיוצר לא יכול להפעיל או לכבות אותו — [vidIQ](https://vidiq.com/es/blog/post/most-replayed-scenes-youtube-video/) (מקור משני, נקרא מתקציר חיפוש בלבד; אין דף רשמי עם סף).

**תגובות, צ'אט חי, storyboards ופלייליסטים**
- `--write-comments`; ‏`youtube:comment_sort=top|new` (ברירת מחדל `new`); ‏`max_comments=max-comments,max-parents,max-replies,max-replies-per-thread,max-depth` — [yt-dlp README](https://github.com/yt-dlp/yt-dlp/blob/master/README.md); תמיכה ב־subthreads נוספה ב־2026.01.29 — [yt-dlp Changelog](https://github.com/yt-dlp/yt-dlp/blob/master/Changelog.md).
- "Live chats (if available) are considered as subtitles" (`--sub-langs all,-live_chat` כדי לוותר) — [yt-dlp README](https://github.com/yt-dlp/yt-dlp/blob/master/README.md).
- storyboards: פורמטים `sb0`… מסוג `mhtml`; הרוחב, הגובה, השורות, העמודות ו"fps" נקראים מה־spec של הנגן (לא קבועים בקוד) — [youtube/_video.py `_extract_storyboard`](https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/extractor/youtube/_video.py); שינוי כללי ב־2025.08.20 (לא ייחודי ליוטיוב): "Extract avif storyboard formats from MPD manifests" — [yt-dlp Changelog](https://github.com/yt-dlp/yt-dlp/blob/master/Changelog.md).
- פלייליסט שלם של קורס: `--flat-playlist` (רשימה מהירה) ו־`-I/--playlist-items` — [yt-dlp README](https://github.com/yt-dlp/yt-dlp/blob/master/README.md).

**YouTube Data API v3 (הדרך הרשמית)**
- מכסה: 10,000 יחידות ביום + ‏100 קריאות `search.list` ביום; ‏`videos.list` = 1, ‏`commentThreads.list` = 1, ‏`captions.list` = 50 — [Quota calculator](https://developers.google.com/youtube/v3/determine_quota_cost).
- `captions.download`: ‏200 יחידות, OAuth (`youtube.force-ssl`/`youtubepartner`), ו־"This method requires the user to have permission to edit the video"; פורמטים `sbv/scc/srt/ttml/vtt` ו־`tlang` לתרגום מכונה — [captions.download](https://developers.google.com/youtube/v3/docs/captions/download).
- `commentThreads.list`: יחידה אחת, `maxResults` 1–100 (ברירת מחדל 20), `order=time|relevance`, ‏`textFormat=plainText`, ‏`searchTerms` — [commentThreads.list](https://developers.google.com/youtube/v3/docs/commentThreads/list).
- מדיניות המפתחים: אסור "download, import, backup, cache, or store copies of YouTube audiovisual content without YouTube's prior written approval"; אסור "separate, isolate, or modify the audio or video components"; אסור scraping; נתוני API שנשמרים חייבים ריענון או מחיקה בתוך 30 יום (III.E.4) — [YouTube API Developer Policies](https://developers.google.com/youtube/terms/developer-policies).

**Gemini עם קישור יוטיוב**
- "The YouTube URL feature is in preview and is available at no charge"; "You can only upload public videos (not private or unlisted videos)"; שכבה חינמית — עד 8 שעות וידאו יוטיוב ביום, בתשלום — בלי מגבלת אורך; Gemini 2.5 ומעלה — עד 10 סרטונים לבקשה; ‏~100 טוקנים לשנייה ברזולוציה נמוכה (ברירת מחדל) ו־~300 בגבוהה; דגימה 1 fps כברירת מחדל, `fps` מותאם, וחיתוך `start_offset`/`end_offset`; חלון 1M = עד 3 שעות (נמוכה) או שעה (גבוהה) — [Gemini API: video understanding](https://aistudio.google.com/docs/video-understanding).
- בשכבה החינמית גוגל משתמשת בתוכן "to provide, improve, and develop" ומבקרים אנושיים עשויים לקרוא; "Do not submit sensitive, confidential, or personal information to the Unpaid Services"; בשכבה בתשלום — "Google doesn't use your prompts... to improve our products" (תנאים בתוקף מ־23/3/2026) — [Gemini API Additional Terms](https://aistudio.google.com/docs/terms).

### היסקים (Inferences)
- **פקודת קציר אחת בלי וידאו** (טיוטה): `yt-dlp --skip-download --write-info-json --write-subs --write-auto-subs --sub-langs "en.*,he.*,live_chat" --sub-format "json3/vtt" --write-comments --extractor-args "youtube:comment_sort=top;max_comments=500,all,0" URL` — ה־info.json מכיל תיאור, פרקים, heatmap, תגיות וצפיות. כל זה עדיין "automated means" לפי תנאי יוטיוב (סעיף 4).
- **דירוג חשיבות**: לשלב גבולות פרקים + צבירי חותמות זמן בתגובות (regex ‏`\b\d{1,2}:\d{2}(:\d{2})?\b`) + צפיפות צ'אט חי + שיאי heatmap + אירועי החלפת שקופית. ה־heatmap גס (100 תאים: בהרצאה של 60 דק׳ — תא של 36 שנ׳), קיים רק בסרטונים נצפים, ומשקף "חזרות" — שיכולות להיות קטעים קשים/חשובים או דילוג מעל פתיח; לתת לו משקל של רמז חלש, לא אמת.
- **עברית**: כתוביות אוטומטיות בעברית קיימות אך האיכות משתנה — לשמש כעוגן יישור ומילות מפתח, לא כתמליל סופי.
- **storyboards** הם תמונות ממוזערות (sprite) — לא באיכות OCR, אבל זולים מאוד לגילוי החלפת שקופית לפני שמורידים 1080p.
- **מסלול "חוקי" חלקי**: תגובות, סטטיסטיקות ופרטי סרטון דרך ה־API הרשמי (בכפוף ל־30 יום ריענון); כתוביות של סרטונים לא שלנו — אין מסלול API רשמי.
- Gemini עם קישור הוא הדרך הזולה ביותר להבנת סרטון ציבורי בלי להוריד אותו (ובלי לעקוף שום דבר — גוגל עצמה מושכת), אבל לא לשלוח בשכבה החינמית תוכן עם מידע אישי, ולא עובד על unlisted/private.

### פערים (Gaps)
- הרזולוציה הממשית של storyboards (לפי הקוד היא נקבעת לכל סרטון) — צריך `yt-dlp -F` על כמה סרטונים בשרת.
- סף ההופעה של heatmap — אין מקור רשמי.
- האם `json3`/`srv3` של כתוביות אוטומטיות כוללים תזמון ברמת מילה — לא אומת במקור.
- האם קציר תגובות/צ'אט חי ב־yt-dlp דורש PO token, ומה מגבלת הקצב שלו — לא נמצא.

## 3. מקורות אחרים מהשרת: מה yt-dlp תומך, מה דורש עוגיות/סיסמה, מה חסום ב־DRM, וחלופות (העלאה, הקלטת מסך)

### שורה תחתונה (Takeaway)
רוב פלטפורמות ההרצאות והוובינרים נתמכות ב־yt-dlp עם קישור שיתוף: Zoom (כולל סיסמה ו־**תמליל/כתוביות/פרקים**), Loom (כולל **תמליל**), Google Drive, Dropbox, SharePoint, Vimeo (ציבורי, unlisted, עם סיסמה), Wistia, Vidyard, Kaltura, Panopto (כולל **תמונות שקופיות** וכתוביות), Brightcove, JW Player, Mediasite, Blackboard Collaborate, Webex, ON24, GoToStage, פודקאסטים ב־RSS. דורשות עוגיות: LinkedIn Learning, ‏Panopto מוסדי, אתרי קורסים (Teachable שבור), ולעתים קרובות Instagram/Facebook. לא אפשרי: פלטפורמות DRM (Spotify, קורסי Udemy מוצפנים) ופלטפורמות בלי extractor (Coursera, Skillshare, MasterClass, Thinkific, Kajabi, Podia, Livestorm, StreamYard, Riverside). Vimeo עלול לדרוש התחברות דווקא בגלל IP אירופי — רלוונטי לשרת שלנו. החלופה הכללית: הקובץ מהמשתמש (שיתוף/העלאה מהטלפון) או הקלטת מסך (MediaProjection באנדרואיד, tabCapture בתוסף כרום) — עם הסכמה בכל הקלטה, וחלונות מאובטחים יוצאים שחורים.

### ממצאים מתועדים (Cited Findings)
**רשימת התמיכה**
- ברשימת האתרים הנתמכים: `vimeo` (+`vimeo:pro`, ‏`:event`, ‏`:review`, ‏`:ondemand`, אלבומים), ‏`zoom`, ‏`zoom:clips`, ‏`GoogleDrive`, ‏`GoogleDrive:Folder`, ‏`Dropbox`, ‏`SharePoint`, ‏`Box`, ‏`loom` (`loom:folder` "Currently broken"), ‏`Wistia`, ‏`Vidyard`, ‏`Kaltura`, ‏`Panopto`, ‏`brightcove:new/legacy`, ‏`JWPlatform`, ‏`Mediasite`, ‏`BlackboardCollaborate`, ‏`ciscowebex`, ‏`on24`, ‏`GoToStage`, ‏`Teachable` ("Currently broken") ו־`TeachableCourse`, ‏`udemy`, ‏`linkedin:learning`, ‏`facebook`, ‏`Instagram` (`instagram:user` "Currently broken"), ‏`twitter` (+`spaces`), ‏`TikTok`, ‏`twitch:vod`, ‏`apple:podcasts`, ‏`CloudflareStream`, ‏`Mux`, ‏`BunnyCdn`, ‏`Substack`, ‏`patreon` — [supportedsites.md](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md).
- אין ברשימה: Coursera, ‏Skillshare, ‏MasterClass, ‏Thinkific, ‏Kajabi, ‏Podia, ‏OneDrive אישי (1drv.ms), ‏Livestorm, ‏StreamYard, ‏Riverside — [supportedsites.md](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md) (חיפוש בטקסט; היעדר ≠ חסימה).
- ברשימת "KnownDRM" (אתרים שכל הסרטונים שלהם ב־DRM): `open.spotify.com`, ‏`artstation.com/learning/courses` ועוד — [extractor/unsupported.py](https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/extractor/unsupported.py).
- ה־extractor הכללי מזהה פיד RSS ומחלץ את קובצי ה־enclosure (פודקאסטים) ב־`_extract_rss` — [extractor/generic.py](https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/extractor/generic.py).

**פלטפורמות הרצאה/וובינר — פרטים מהקוד**
- Zoom: קישורי `zoom.us/rec/play|share/...`; קוד גישה דרך `--video-password` ("This video is protected by a passcode"); כתוביות מסוג `transcript`, ‏`cc` ו־`chapter` ב־VTT — [extractor/zoom.py](https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/extractor/zoom.py); "Extract recordings with start times" (2026.01.29) ו־`zoom:clips` (2026.07.04) — [yt-dlp Changelog](https://github.com/yt-dlp/yt-dlp/blob/master/Changelog.md).
- Loom: קישורי `loom.com/share|embed`, סיסמה, ותמליל דרך GraphQL ‏`FetchVideoTranscript` (`source_url`/`captions_source_url`) — [extractor/loom.py](https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/extractor/loom.py); תוקן ב־2025.12.08 — [yt-dlp Changelog](https://github.com/yt-dlp/yt-dlp/blob/master/Changelog.md).
- Google Drive: מסלול אישור להורדת קובץ גדול (`confirm: t`), הודעות שגיאה מ־`uc-error-subcaption`, וכתוביות מ־`timedTextDetails` — [extractor/googledrive.py](https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/extractor/googledrive.py); תיקון כתוביות ב־2025.11.12 — [yt-dlp Changelog](https://github.com/yt-dlp/yt-dlp/blob/master/Changelog.md).
- Dropbox: "Support videos in folders" (2026.01.29) — [yt-dlp Changelog](https://github.com/yt-dlp/yt-dlp/blob/master/Changelog.md).
- Vimeo: סיסמה ב־`--video-password`; קישורי unlisted עם hash; ובשגיאה 5460: "Authentication may be needed due to your location. If your IP address is located in Europe you could try using a VPN/proxy" — [extractor/vimeo.py](https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/extractor/vimeo.py); שינויים ב־2025–2026: "Extract from mobile API" ‏(2025.04.30), "Fix login support and require authentication" ‏(2025.08.11), הוספת לקוח `macos` ‏(2026.01.29) והסרת `ios`/`macos` ‏(2026.08.19) — [yt-dlp Changelog](https://github.com/yt-dlp/yt-dlp/blob/master/Changelog.md).
- Panopto: מחלץ כתוביות ו**תמונות שקופיות** (אירועי `PowerPoint` → `Pages/Viewer/Image.aspx`), ובתוכן מוגבל `raise_login_required(method='cookies')` — [extractor/panopto.py](https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/extractor/panopto.py).
- Wistia: כתוביות VTT, וחלק מהסרטונים דורשים Referer נכון — [extractor/wistia.py](https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/extractor/wistia.py); ‏Teachable בנוי על הטמעות Wistia (`from .wistia import WistiaIE`) — [extractor/teachable.py](https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/extractor/teachable.py); ‏Vidyard: "Extract chapters" ‏(2025.10.14) — [yt-dlp Changelog](https://github.com/yt-dlp/yt-dlp/blob/master/Changelog.md).

**קורסים ורשתות חברתיות**
- Udemy: אם אין פורמטים והשדה `course_is_drmed` — ‏`report_drm` — [extractor/udemy.py](https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/extractor/udemy.py).
- LinkedIn Learning: דורש עוגיית `JSESSIONID` (`raise_login_required` בלעדיה) — [extractor/linkedin.py](https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/extractor/linkedin.py); "Remove broken login support" (2026.07.04) — כלומר עוגיות בלבד — [yt-dlp Changelog](https://github.com/yt-dlp/yt-dlp/blob/master/Changelog.md).
- תחזוקה שוטפת ב־2026: Instagram "Fix logged-in extraction" (2026.08.19), ‏TikTok "Fix challenge solving" (2026.03.13), ‏Twitch "Remove dead `rechat` subtitles" (2026.06.09, כלומר בלי צ'אט VOD) — [yt-dlp Changelog](https://github.com/yt-dlp/yt-dlp/blob/master/Changelog.md).
- Coursera (תנאים מ־1/1/2026): רישיון מוגבל, אישי ולא מסחרי; אסור "any form of content, data, or text scraping", אסור לשכפל תוכן, ואסור "text or data mining purposes" ואימון מודלים בלי הסכמה בכתב — [Coursera Terms](https://www.coursera.org/about/terms).

**חלופות: הקלטת מסך והעלאה**
- MediaProjection: חובה לבקש את הסכמת המשתמש לפני כל סשן הקלטה; ב־Android 14+ זריקת `SecurityException` אם משתמשים בטוקן פעמיים; שיתוף אפליקציה בודדת (Android 14); ‏foreground service מסוג `mediaProjection`; ב־Android 15 QPR1 — שבב בולט בשורת הסטטוס, וההקלטה נעצרת בנעילת מסך — [Android: Media projection](https://developer.android.com/media/grow/media-projection).
- הקלטת שמע מאפליקציה אחרת: `RECORD_AUDIO` + אישור המשתמש; רק נגנים עם `USAGE_MEDIA/GAME/UNKNOWN`; אפליקציות שמטרגטות API 29+ מאפשרות כברירת מחדל, ואפשר לחסום (`allowAudioPlaybackCapture="false"`) — [Android: Capture video and audio playback](https://developer.android.com/media/platform/av-capture).
- `FLAG_SECURE`: "preventing it from appearing in screenshots or from being viewed on non-secure displays", ותצוגות רגישות מסומנות כמאובטחות בזמן הקלטת מסך — [Android WindowManager.LayoutParams](https://developer.android.com/reference/android/view/WindowManager.LayoutParams#FLAG_SECURE).
- `chrome.tabCapture`: זרם וידאו+שמע של לשונית, רק אחרי פעולת משתמש בתוסף; השמע מושתק למשתמש אלא אם מנתבים דרך `AudioContext`; מזהה זרם שנוצר ב־service worker שמיש במסמך offscreen (Chrome 116+) ופג תוך שניות — [Chrome Extensions: tabCapture](https://developer.chrome.com/docs/extensions/reference/api/tabCapture).
- אצלנו: מסלול "יוטיוב רק באנדרואיד" כשמצב השרת כבוי, והעלאה ל־R2 מהאפליקציות — [docs/studio-server.md](../../studio-server.md).

### היסקים (Inferences)
- **מטריצת היתכנות מהשרת** (טיוטה):
  - בלי התחברות: YouTube (בכפוף לסעיף 1), ‏Vimeo ציבורי/unlisted (אולי חסום מ־IP אירופי — שגיאה 5460), ‏Zoom (+סיסמה), ‏Loom, ‏Drive/Dropbox/SharePoint ציבוריים, נגני Wistia/Vidyard/Kaltura/Brightcove/JW מוטמעים (לעתים צריך Referer), ‏ON24/GoToStage/Webex ציבוריים, ‏Panopto ציבורי, פודקאסטים (RSS, Apple Podcasts).
  - עם עוגיות/סיסמה של המשתמש: LinkedIn Learning, ‏Panopto/Kaltura מוסדי, Teachable וקורסים על Wistia, ‏Instagram/Facebook פרטיים, ‏Twitch למנויים.
  - לא אפשרי (DRM או בלי extractor): Spotify, קורסי Udemy מוצפנים, ‏Coursera/Skillshare/MasterClass/Thinkific/Kajabi/Podia, ‏Livestorm/StreamYard/Riverside (אלא אם יש קישור ישיר לקובץ/HLS שה־extractor הכללי מזהה).
- **הזהב בפלטפורמות הרצאה**: Zoom ו־Loom נותנים תמליל מוכן, ו־Panopto נותן תמונות שקופיות מקוריות — לנצל לפני OCR (חוסך גם AI וגם פענוח).
- **עוגיות של המשתמש לאתרים אחרים** = סוד רגיש (גישה לחשבון) — אם בכלל, רק מוצפן ולמשימה אחת (בדומה ל־`studioVault` של יוטיוב), ובכפוף לתנאי האתר (סעיף 4).
- **הקלטת מסך** היא נפילה אוניברסלית אבל איטית (בזמן אמת), דורשת הסכמה בכל פעם, ותוכן DRM/חלון מאובטח צפוי לצאת שחור (על סמך `FLAG_SECURE`; לנגני DRM עצמם — לא אומת). עדיף "שתף קובץ" מהטלפון או קישור הורדה של הבעלים (Zoom/Drive/Loom).

### פערים (Gaps)
- הגדרות Zoom הרשמיות (חסימת הורדה, אימות צופים, תמליל אודיו בענן) — לא נשלף דף העזרה; המידע מהקוד בלבד.
- האם Kajabi/Thinkific/Podia מטמיעים Wistia/Vimeo/Mux (ואז אפשר דרך ה־extractor שלהם) — לא אומת.
- מצב ה־DRM ב־Coursera/Skillshare/MasterClass/LinkedIn Learning — לא אומת (ידוע רק שאין extractor / שיש תנאים אוסרים).
- OneDrive אישי, Livestorm, StreamYard, Riverside, GoTo Webinar (לא GoToStage) — אין תמיכה מפורשת; האם קישור שיתוף מוביל לקובץ ישיר — לא נבדק.
- התנהגות נגני DRM (Widevine) בהקלטת MediaProjection/tabCapture — לא נמצא תיעוד רשמי.

## 4. משפט ותנאי שימוש לכלי ניתוח אישי (מידע כללי, לא ייעוץ משפטי)

### שורה תחתונה (Takeaway)
**זה לא ייעוץ משפטי.** החשיפה העיקרית אינה זכות היוצרים בניתוח עצמו, אלא (1) תנאי השימוש — יוטיוב אוסרת הורדה וגישה אוטומטית בלי היתר (הפרה חוזית: סיכון לחשבון/IP), ואתרי קורסים אוסרים scraping וכריית טקסט; ו־(2) איסורי עקיפה של אמצעי הגנה — בארה"ב (§1201: באוקטובר 2026 בית משפט פדרלי קבע, בשלב בקשת הסילוק, שהטענה שאמצעי יוטיוב — כולל ה־rolling cipher ו־PO tokens — הם "access controls" סבירה) ובגרמניה (§95a UrhG) שבה יושב השרת; בנוסח החוק הישראלי לא מצאנו איסור עקיפה. ניתוח אישי בישראל נשען היטב על "שימוש הוגן" לצורך "לימוד עצמי, מחקר" (ס' 19), העתקה זמנית (ס' 26) וחוות דעת משרד המשפטים (2022) על למידת מכונה. פרסום סיכומים לציבור מסוכן יותר: סיכום "מחליף" עלול להפר (Cohere, 2025), חובה לייחס (זכות מוסרית, ס' 46) ולצטט מעט. פרטיות: "אוסף לשימוש אישי שאינו למטרות עסק" מוחרג מהגדרת "מאגר מידע" — שימוש עסקי מכניס לחוק הגנת הפרטיות אחרי תיקון 13; לא לזהות פנים (מזהה ביומטרי = "מידע בעל רגישות מיוחדת"). ספקי AI: בשכבה החינמית של Gemini התוכן משמש את גוגל; ב־API בתשלום של Gemini, ‏OpenAI ו־Anthropic — לא לאימון.

### ממצאים מתועדים (Cited Findings)
**תנאי יוטיוב והמדיניות**
- תנאי השימוש (בתוקף מ־15/12/2023): אסור "access, reproduce, download, distribute, transmit, broadcast, display, sell, license, alter, modify or otherwise use" תוכן אלא אם השירות מתיר במפורש או בהיתר בכתב; אסור "access the Service using any automated means (such as robots, botnets or scrapers)" למעט מנועי חיפוש לפי robots.txt; אסור "circumvent, disable, fraudulently engage with, or otherwise interfere"; ומותר "view or listen to Content for your personal, non-commercial use" — [YouTube Terms of Service](https://www.youtube.com/static?template=terms).
- מדיניות המפתחים של ה־API (III.E.1, ‏III.I.7, ‏III.E.6) — אין הורדה/מטמון של אודיו־וידאו בלי אישור, אין הפרדת אודיו/וידאו, אין scraping — [YouTube API Developer Policies](https://developers.google.com/youtube/terms/developer-policies).

**ארה"ב — שימוש הוגן, סיכומים ועקיפה**
- שימוש הוגן נבחן "on a case-by-case basis" לפי ארבעה גורמים; "no formula" לכמות מותרת; שימוש טרנספורמטיבי "add something new, with a further purpose or different character" (העמוד עודכן 11/2026) — [U.S. Copyright Office, Fair Use Index](https://www.copyright.gov/fair-use/).
- Thomson Reuters v. ROSS (ערעורים, מחוז שלישי, No. 25-2153, ניתן 29/9/2026): ה־headnotes מוגנים, והשימוש של ROSS לאימון כלי חיפוש מתחרה "was not fair"; ההבחנה: "ROSS's AI was not a generative AI... it would only return text passages", ו־"Unlike the AI models in Bartz and In re: OpenAI, ROSS's AI platform cannot generate original expression" — [פסק הדין, CA3](https://www2.ca3.uscourts.gov/opinarch/252153p.pdf).
- Bartz v. Anthropic (23/6/2025): אימון על ספרים — שימוש הוגן, עותקים מאתרי פיראטיות — לא; פשרה של 1.5 מיליארד דולר, אישור סופי 20/7/2026; ‏Kadrey v. Meta (25/6/2025): הכרעה חלקית לטובת Meta — [The Rio Times, 5/11/2026](https://riotimesonline.com/us-courts-ai-training-copyright-where-things-stand) (מקור משני).
- Advance Local Media v. Cohere (S.D.N.Y., ‏13/11/2025, דחיית בקשה לסילוק): סיכומים "מחליפים" (substitutive summaries) עלולים להפר — בית המשפט התייחס ל־"lifting expression directly or parroting the piece's organization, writing style, and punctuation", וסירב לאמץ "bright-line test" לכמות — [Loeb & Loeb](https://www.loeb.com/en/insights/publications/2025/11/advanced-local-media-llc--v-cohere-inc); ההחלטה: [Doc. 59](https://www.newsmediaalliance.org/wp-content/uploads/2025/11/Doc-59-Decision-and-Order-Denying-Partial-Motion-to-Dismiss.pdf) (לא נקראה ישירות).
- Ted Entertainment v. ByteDance (N.D. Cal., השופטת Corley, ‏2/10/2026): נדחתה בקשת הסילוק; התובעים טענו באופן סביר שאמצעי יוטיוב שולטים ב**גישה** ("a technological protection measure can operate as both an access control and a copy control"); נטען ש־ByteDance השתמשה ב־yt-dlp; לא הוכרע אם הייתה עקיפה ואם האימון מפר — [Trademark Lawyer Magazine](https://trademarklawyermagazine.com/bytedance-must-face-youtubers-ai-training-suit-over-alleged-youtube-scraping/); [Bloomberg Law](https://news.bloomberglaw.com/ip-law/bytedance-fails-to-escape-youtubers-ai-training-copyright-suit) (מקורות משניים).
- תביעות יוצרי יוטיוב נוספות: נגד Snap (מחוז מרכז קליפורניה, 1/2026; מאגר HD-VILA-100M; טענה לעקיפת הגבלות טכנולוגיות ותנאי השימוש של יוטיוב), ולפני כן נגד Nvidia, ‏Meta ו־ByteDance — [TechCrunch, 26/1/2026](https://techcrunch.com/2026/01/26/youtubers-sue-snap-for-alleged-copyright-infringement-in-training-its-ai-models); נגד Apple (מ־4/2026), ש־Apple טוענת בה שהסרטונים ציבוריים, שה־DMCA ותנאי יוטיוב מתירים גישה אליהם, ושמנגנוני מניעת ההורדה אינם מגבילים גישה — [TUAW, 3/7/2026](https://www.tuaw.com/2026/07/03/apple-seeks-dismissal-of-youtube-ai-lawsuit) (מקור משני).
- Yout v. RIAA (ערעור, מחוז שני; השאלה: "whether YouTube's rolling cipher qualifies as a technological protection measure under Section 1201"): עדיין תלוי ועומד נכון ל־3/4/2026 — [TorrentFreak](https://torrentfreak.com/yout-com-hopes-supreme-courts-cox-ruling-helps-its-case-riaa-disagrees/).

**ישראל — זכות יוצרים**
- ס' 19(א): "שימוש הוגן ביצירה מותר למטרות כגון אלה: לימוד עצמי, מחקר, ביקורת, סקירה, דיווח עיתונאי, הבאת מובאות, או הוראה ובחינה על ידי מוסד חינוך"; ס' 19(ב) — ארבעה שיקולים (מטרה ואופי, אופי היצירה, היקף "מבחינה איכותית וכמותית", השפעה על השוק) — [חוק זכות יוצרים, התשס"ח–2007 (ויקיטקסט)](https://he.wikisource.org/wiki/חוק_זכות_יוצרים).
- ס' 26: "העתקה זמנית, לרבות העתקה כאמור שנעשתה בדרך אגבית, של יצירה, מותרת אם היא מהווה חלק בלתי נפרד מהליך טכנולוגי שמטרתו היחידה היא לאפשר... שימוש אחר כדין ביצירה, ובלבד שאין לעותק האמור ערך כלכלי משמעותי משל עצמו" — [חוק זכות יוצרים (ויקיטקסט)](https://he.wikisource.org/wiki/חוק_זכות_יוצרים).
- ס' 11(6) ו־16: עשיית "יצירה נגזרת" (למשל "תרגום או עיבוד") היא זכות בלעדית; ס' 46: זכות מוסרית — "כי שמו ייקרא על יצירתו בהיקף ובמידה הראויים" ו"כי לא יוטל פגם ביצירתו ולא ייעשה בה סילוף" — [חוק זכות יוצרים (ויקיטקסט)](https://he.wikisource.org/wiki/חוק_זכות_יוצרים).
- חוות דעת משרד המשפטים על למידת מכונה (12/2022): "apart from exceptional cases, the use of copyrighted materials for machine learning purposes is generally permitted" על בסיס ס' 19, 22 ו־26; "does not apply to the output"; "not binding on the courts" — [Herzog Fox & Neeman, 10/1/2023](https://herzoglaw.co.il/en/news-and-insights/ministry-of-justice-opinion-on-the-use-of-copyrighted-works-for-machine-learning-purposes/); [law.co.il, 22/12/2022](https://www.law.co.il/en/news/2022/12/22/fair-use-of-copyrighted-content-for-aiml-training/) (מקורות משניים לחוות הדעת).

**ישראל — פרטיות (אחרי תיקון 13, בתוקף מ־14/8/2025)**
- תיקון 13 נכנס לתוקף ב־14/8/2025; חובת ממונה הגנת פרטיות (DPO) בחלק מהמקרים, ואפשרות לבקש החלטה מקדמית מהרשות (מענה בתוך 60 יום) — [Pearl Cohen, 3/8/2025](https://www.pearlcohen.com/major-amendment-to-israeli-privacy-law-set-to-take-effect/).
- "מאגר מידע" — "אוסף פרטי מידע אישי המעובד באמצעי דיגיטלי, למעט... (1) אוסף לשימוש אישי שאינו למטרות עסק"; "מידע אישי" כולל אדם שניתן לזהותו "באמצעות פרט מזהה, כגון שם... מזהה ביומטרי... מזהה מקוון"; "מידע בעל רגישות מיוחדת" כולל "מזהה ביומטרי המשמש או המיועד לשמש לזיהוי אדם", דעות פוליטיות/אמונות דתיות ומידע בריאותי — [חוק הגנת הפרטיות (ויקיטקסט)](https://he.wikisource.org/wiki/חוק_הגנת_הפרטיות).
- סנקציות בנוסח הנוכחי: עיצומים כספיים (ס' 23כו ואילך; למשל 150,000 ו־200,000 ₪ לפי סוג ההפרה, וסכומים לפי מספר האנשים במאגר), תקרות מופחתות לעסק זעיר/קטן, "פיצויים לדוגמה" עד 10,000 ₪ בלי תלות בנזק על הפרות מסוימות של בעל שליטה או מחזיק במאגר (ס' 15א), ופיצוי עד 50,000 ₪ "בלא הוכחת נזק" בתביעה על פגיעה בפרטיות (ס' 29א) — [חוק הגנת הפרטיות (ויקיטקסט)](https://he.wikisource.org/wiki/חוק_הגנת_הפרטיות).

**האיחוד האירופי וגרמניה (מיקום השרת)**
- DSM ‏2019/790: ‏"‘text and data mining’ means any automated analytical technique aimed at analysing text and data in digital form in order to generate information"; ‏Art. 3 — ארגוני מחקר; ‏Art. 4 — חריג כללי ל־"lawfully accessible works", שמירה "for as long as is necessary", בכפוף לכך שלא "expressly reserved... such as machine-readable means" — [Directive (EU) 2019/790, Art. 2](https://www.legislation.gov.uk/eudr/2019/790/article/2); [Art. 3](https://www.legislation.gov.uk/eudr/2019/790/article/3); [Art. 4](https://www.legislation.gov.uk/eudr/2019/790/article/4).
- גרמניה §44b UrhG: מותרים עותקים של יצירות נגישות כדין ל־TDM; "Die Vervielfältigungen sind zu löschen, wenn sie für das Text und Data Mining nicht mehr erforderlich sind"; שמירת זכויות אונליין תקפה רק "in maschinenlesbarer Form" — [§44b UrhG](https://www.gesetze-im-internet.de/urhg/__44b.html).
- §53(1): העתקה פרטית בידי אדם טבעי מותרת "sofern sie weder unmittelbar noch mittelbar Erwerbszwecken dienen" ולא ממקור "offensichtlich rechtswidrig"; אחר רשאי להכין את העותק עבורו רק "sofern dies unentgeltlich geschieht" — [§53 UrhG](https://www.gesetze-im-internet.de/urhg/__53.html).
- §95a(1): "Wirksame technische Maßnahmen... dürfen ohne Zustimmung des Rechtsinhabers nicht umgangen werden" — [§95a UrhG](https://www.gesetze-im-internet.de/urhg/__95a.html).
- GDPR Art. 2(2)(c): הרגולציה לא חלה על עיבוד "by a natural person in the course of a purely personal or household activity" — [GDPR Art. 2](https://gdpr-info.eu/art-2-gdpr/).

**שליחת תוכן של צד שלישי ל־API של AI**
- Gemini: שכבה חינמית — התוכן משמש לשיפור, ייתכנו מבקרים אנושיים, ואסור לשלוח מידע אישי/רגיש; שכבה בתשלום — לא משמש לשיפור, נשמר זמן מוגבל לזיהוי הפרות — [Gemini API Additional Terms](https://aistudio.google.com/docs/terms).
- OpenAI: "As of March 1, 2023, data sent to the OpenAI API is not used to train or improve OpenAI models" (אלא אם בחרו לשתף); יומני ניטור "retained for up to 30 days"; ZDR באישור מראש — [OpenAI: Data controls](https://developers.openai.com/api/docs/guides/your-data).
- Anthropic (תנאים מסחריים בתוקף מ־17/6/2025): "Anthropic may not train models on Customer Content from Services"; והלקוח מצהיר שיש לו "all rights and permissions required to submit Inputs" — [Anthropic Commercial Terms](https://www.anthropic.com/legal/commercial-terms).

### היסקים (Inferences)
- **ישראל**: ניתוח פרטי של הרצאה (תמלול, OCR, סיכום לעצמי) נראה כ"לימוד עצמי/מחקר" עם תכלית טרנספורמטיבית; העותק הזמני של הסרטון בשרת נתמך בס' 26 ובחוות הדעת — בתנאי שנמחק בסיום. החוק הישראלי לא כולל איסור עקיפה (חיפוש בנוסח לא העלה הוראה על "אמצעי הגנה" — רק "הפרה עקיפה"), אבל ההורדה פיזית מתבצעת בשרת בגרמניה, ושם חל §95a, ושאלת "יעילות" אמצעי יוטיוב שם לא הוכרעה במקורות שנבדקו.
- **שימוש עסקי** מחליש את כל ההגנות: ס' 19(ב)(1) "מטרת השימוש ואופיו", §53 דורש מטרה לא־מסחרית, והחריג הביתי של GDPR וחריג "שימוש אישי" בחוק הפרטיות נעלמים.
- **פרסום סיכומים**: לסכם במילים שלנו את הרעיון ולא את ההבעה/המבנה, לצטט מעט ובמירכאות, לייחס ולקשר למקור, ולא לפרסם תמליל/שקופיות מלאים או תרגום מלא (יצירה נגזרת) — הלקח מ־Cohere ומס' 46.
- **מסלולים בלי עקיפה עדיפים**: קובץ שהמשתמש מעלה/משתף; הורדה של הבעלים (Zoom/Drive/Loom); ה־API הרשמי למטא־דאטה ותגובות; Gemini עם קישור (גוגל עצמה מושכת).
- **תנאי אתרי קורסים** (Coursera ודומיו) אוסרים במפורש scraping ו־TDM — הפרה עלולה לסגור את חשבון המשתמש; לכן ברירת המחדל לקורסים בתשלום: המשתמש מעלה/מקליט בעצמו לשימוש אישי, אנחנו לא מתחברים בשמו.
- **פרטיות**: מרצים ומשתתפים הם אנשים מזוהים; לא לבנות זיהוי פנים/דובר לפי שם (ביומטרי), לא לשמור צ'אט/רשימת משתתפים מ־Zoom מעבר לנדרש, למחוק וידאו גולמי אחרי החילוץ, ולשמור רק שקופיות/טקסט — מתיישב גם עם DSM Art. 4(2) ועם §44b(2).
- **AI**: לא לשלוח תוכן עם מידע אישי לשכבה חינמית של Gemini; להעדיף שכבות בתשלום/תנאים בלי אימון; ה־API של Anthropic מעביר אלינו את האחריות לזכויות בקלט.

### פערים (Gaps)
- לא נמצאה פסיקה (2023–2026) שעוסקת ישירות בסיכומי AI של **סרטונים/תמלילים** לשימוש אישי; הקרובים: Cohere (סיכומי כתבות) ותביעות יוצרי יוטיוב על אימון.
- מצב התיק הגרמני נגד המארח של youtube-dl (Uberspace) ושאלת "יעילות" ה־rolling cipher לפי §95a — לא נבדק (נגמר תקציב החיפוש).
- פסיקה ישראלית על אכיפת תנאי שימוש של פלטפורמה מול משתמש פרטי, ועל ס' 19 לסיכומים — לא נבדקה.
- תנאי Udemy (החזיר 403), ‏LinkedIn Learning, ‏Teachable, ‏Zoom — לא נקראו.
- המשמעות של חוק ה־AI האירופי לשימוש אישי — מחוץ לתחום, לא נבדק.
- תביעת Millette נגד OpenAI על תמלול סרטוני יוטיוב (עילות של עשיית עושר ותחרות לא הוגנת, לא זכות יוצרים; התאריך לא אומת) — מוכרת רק מתקציר חיפוש; הכתבה [The Hollywood Reporter](https://www.hollywoodreporter.com/business/business-news/youtube-creators-step-legal-battle-against-openai-class-action-lawsuit-1235968822/) חסומה בתשלום ולא נקראה.

## 5. עלויות: אחסון ב־R2 (וידאו זמני + ארכיון שקופיות), פורמט תמונה לשקופיות, ופענוח 1080p במעבד

### שורה תחתונה (Takeaway)
האחסון זניח: R2 ‏$0.015 ל־GB־חודש בלי עלות יציאה, ו־10GB־חודש חינם; שעת הרצאה ב־1080p (≈0.22–1.1GB בהנחת 0.5–2.5 Mbps) שנשמרת שבוע עולה פחות מחצי סנט, וארכיון שקופיות (≈3–6MB לשעת הרצאה) נכנס כולו לשכבה החינמית עד ~1,000 שעות. גם הפענוח זול: במדידה שלנו פענוח מלא של 1080p "הרצאתי" ≈ ‏3.5–4.1 דקות CPU לשעת וידאו (H.264/VP9/AV1 — כמעט זהה), תוכן תנועתי ≈ ‏9–12 דקות CPU; דגימת keyframes בלבד (`-skip_frame nokey`) זולה פי ~15 — אבל **לא עובדת ב־VP9** עם המפענח המקורי של ffmpeg, ו־`-vf fps=1` לא מקטין את עלות הפענוח. ההוצאה היחידה שעלולה להיות משמעותית היא תעבורה דרך פרוקסי ביתי ($1–8 ל־GB). לשקופיות: WebP lossless לשקופית "נקייה", ‏AVIF ‏4:4:4 ‏(q≈70) לפריים מתוך וידאו.

### ממצאים מתועדים (Cited Findings)
**Cloudflare R2 (עודכן 30/10/2026, USD)**
- Standard: ‏$0.015/GB־חודש, ‏Class A ‏$4.50 למיליון, ‏Class B ‏$0.36 למיליון; ‏Infrequent Access: ‏$0.01/GB־חודש, ‏$0.01/GB לשליפה, ‏Class A ‏$9.00, ‏Class B ‏$0.90, מינימום 30 יום; יציאה לאינטרנט חינם — [R2 pricing](https://developers.cloudflare.com/r2/pricing/).
- שכבה חינמית חודשית (Standard בלבד): ‏10GB־חודש, מיליון Class A, ‏10 מיליון Class B — [R2 pricing](https://developers.cloudflare.com/r2/pricing/).
- Class A כולל `PutObject`, ‏`CreateMultipartUpload`, ‏`UploadPart`, ‏`CompleteMultipartUpload`, ‏`ListObjects`; ‏Class B כולל `GetObject`, ‏`HeadObject`; ‏`DeleteObject` ו־`AbortMultipartUpload` חינם; האחסון מחושב לפי ממוצע שיא יומי על פני 30 יום; עיגול כלפי מעלה ("one million and one operations... billed for two million") — [R2 pricing](https://developers.cloudflare.com/r2/pricing/).

**מדידה מקומית — פענוח (ffmpeg 6.1.1, ‏Intel Xeon ‏2.1GHz, ‏4 vCPU; ‏AV1 דרך libdav1d, ‏H.264/VP9 במפענחים המקוריים; זמן CPU של משתמש, תהליכון אחד)**
- סרטון "הרצאה" סינתטי: 60 שנ׳, 1080p30, שקופית טקסט מתחלפת כל 10 שנ׳ + "מצלמה" נעה 320×180, keyframe כל 5 שנ׳ (`-g 150`); קצב סיביות: H.264 ‏(CRF 23) ‏≈427 kbps, ‏VP9 ‏(CRF 33) ‏≈504 kbps, ‏AV1 ‏(SVT-AV1 p8, CRF 35) ‏≈497 kbps.
  - H.264: פענוח מלא 3.68 שנ׳ (≈489 fps לליבה); עם `-vf fps=1` ‏3.81 שנ׳ (אין חיסכון); עם `-skip_frame nokey` ‏0.22 שנ׳ (12 פריימים).
  - VP9: מלא 4.08 שנ׳; עם `nokey` ‏4.24 שנ׳ ו־1800 פריימים — **הדגל לא כובד**.
  - AV1: מלא 3.46 שנ׳ (≈521 fps לליבה); עם `nokey` ‏0.28 שנ׳.
- תוכן תנועתי סינתטי (testsrc2), 30 שנ׳ 1080p30, ‏4–6 Mbps: ‏H.264 ‏4.62 שנ׳ (≈195 fps לליבה), ‏VP9 ‏5.94, ‏AV1 ‏5.12; עם `nokey`: ‏H.264 ‏0.11, ‏AV1 ‏0.054, ‏VP9 — שוב לא כובד.
- ריבוי תהליכונים (`-threads 0`) לא שיפר עקבית את זמן השעון בסביבה הזו (בין קיצור של 31% ב־VP9/AV1 "הרצאה" להארכה של 17% ב־AV1 "תנועה"), והעלה את סך זמן ה־CPU ‏(user+sys) ב־19–53%.
- לשעת וידאו (חישוב מהמדידה): "הרצאה" — H.264 ‏3.68, ‏VP9 ‏4.08, ‏AV1 ‏3.46 דקות CPU בפענוח מלא; keyframes בלבד — H.264 ‏0.22, ‏AV1 ‏0.28; "תנועה" — H.264 ‏9.2, ‏VP9 ‏11.9, ‏AV1 ‏10.2 דקות CPU.
- שיטה (לשחזור על השרת): קידוד — `libx264 -preset medium -crf 23 -g 150`; `libvpx-vp9 -b:v 0 -crf 33 -g 150 -deadline good -cpu-used 4 -row-mt 1`; `libsvtav1 -preset 8 -crf 35 -g 150`; פענוח — `ffmpeg -benchmark -threads 1 [-skip_frame nokey] [-c:v libdav1d] -i IN -an [-vf fps=1] -fps_mode passthrough -f null -`.
- הגדרת הדגל ב־ffmpeg: `-skip_frame nokey` = "discard all frames except keyframes" (מהעזרה המובנית `ffmpeg -h full` של ffmpeg 6.1.1 בסביבת המחקר); התיעוד המקוון: [FFmpeg codecs documentation](https://ffmpeg.org/ffmpeg-codecs.html) (לא נטען במחקר בגלל שגיאת רשת).
- השוואה: בהעלאה יוטיוב ממליץ 1080p ב־8 Mbps — [YouTube Help](https://support.google.com/youtube/answer/1722171); מה שיוטיוב מגיש בפועל להרצאות — לא נמדד (ראו פערים).

**מדידה מקומית — פורמט שקופיות (1920×1080; ‏Pillow 12.3 עם libwebp/libavif; ‏SSIM/PSNR מול המקור דרך ffmpeg)**
- שקופית "נקייה" מרונדרת (טקסט 14–54px + גרף): ‏PNG ממוטב 82.8KB; ‏**WebP lossless ‏32.6KB (זהה למקור)**; ‏WebP q75 ‏65.6KB ‏(SSIM 0.997); ‏AVIF q50 ‏4:2:0 ‏39.6KB ‏(0.998); ‏AVIF q70 ‏4:4:4 ‏49.6KB ‏(SSIM 0.9997, ‏PSNR 46.6dB); ‏JPEG q85 ‏178.6KB ‏(0.994).
- אותה שקופית כפריים מתוך קידוד H.264 (רעש דחיסה סביב הטקסט — המקרה האמיתי): ‏PNG ‏333KB; ‏WebP lossless ‏187KB; ‏WebP q75 ‏70KB ‏(SSIM 0.988, ‏38.1dB); ‏WebP q90 ‏98.5KB ‏(0.991); ‏AVIF q50 ‏4:2:0 ‏55KB ‏(0.990, ‏36.9dB); ‏AVIF q70 ‏4:2:0 ‏80KB ‏(0.992, ‏39.1dB); ‏**AVIF q70 ‏4:4:4 ‏82KB ‏(0.997, ‏44.5dB)**; ‏JPEG q85 ‏187KB ‏(0.986).
- ל־OCR: "Tesseract works best on images which have a DPI of at least 300 dpi" — [Tesseract: Improving the quality of the output](https://tesseract-ocr.github.io/tessdoc/ImproveQuality.html).

### היסקים (Inferences)
- **אומדן עלות לשעת הרצאה** (USD, נובמבר 2026; טווח הסיביות 0.5–2.5 Mbps הוא הנחה — לא נמדד על יוטיוב):

  | רכיב | כמות | עלות |
  |---|---|---|
  | וידאו זמני ב־R2, שבוע | ‏0.22–1.1GB ← ‏0.05–0.26GB־חודש | ‏$0.0008–0.004 (או חינם בתוך 10GB) |
  | העלאה multipart בחלקים של 16MB | ‏~15–70 פעולות A | ‏~$0.0003 (או חינם במיליון) |
  | ארכיון שקופיות (הנחה: ~60 שקופיות × 50–100KB) | ‏3–6MB לתמיד | ‏~$0.00005–0.0001 לחודש |
  | פענוח מלא במעבד (הרצאה) | ‏3.5–4.1 דקות CPU | בתוך מחיר השרת הקבוע |
  | פענוח keyframes בלבד (H.264/AV1) | ‏0.2–0.3 דקות CPU | בתוך מחיר השרת הקבוע |
  | פרוקסי ביתי (אם בכלל) | ‏0.22–1.1GB | ‏$0.22–8.8 — **ההוצאה הדומיננטית** |

- **1,000 שעות הרצאה בארכיון** ≈ ‏3–6GB שקופיות → בתוך 10GB החינמיים (אם אין צריכה אחרת בחשבון) או ~$0.05–0.09 לחודש.
- **CX53 לא צוואר בקבוק בפענוח**: גם בפענוח מלא, 16 vCPU מפענחים שעת הרצאה בפחות מדקה של זמן שעון (אם מפצלים לקטעים); ה־OCR/ה־ML יהיו העלות האמיתית (מחקר אחר). ה־vCPU המשותפים עלולים להיות איטיים מהמדידה כאן — לאמת בשרת.
- **אסטרטגיית דגימה**: (1) keyframes בלבד כסריקה ראשונה (H.264/AV1 — זול פי ~15); (2) פענוח מלא רק בחלונות סביב שינוי (או `select='gt(scene,…)'` שדורש פענוח מלא ממילא); ‏`fps=1` לבדו לא חוסך פענוח. כש־keyframe כל ~5 שנ׳, שקופיות שמתחלפות מהר (אנימציות, build) יכולות להתפספס — לכן שלב 2.
- **מקביליות**: במדידה `-threads 0` הוסיף 19–53% זמן CPU בלי שיפור עקבי בזמן השעון — לעיבוד אצווה עדיף תהליכון אחד לכל קטע/קובץ ומקביליות בין קטעים.
- **AV1 בלי חשש**: dav1d פענח AV1 מהר מעט מ־H.264 בתוכן הרצאתי (≈521 מול ≈489 פריימים לשנייה לליבה) ואיטי בכ־10% בתוכן תנועתי (≈176 מול ≈195); יתרון אפשרי — קובץ קטן יותר באותה איכות (חשוב אם התעבורה בתשלום), אבל זה לא נמדד כאן באיכות שווה: בהגדרות שלנו AV1 יצא גדול מ־H.264 ב־16% בתוכן "הרצאה" וקטן ב־22% בתוכן תנועתי. VP9 — רק אם אין ברירה, ואז בלי keyframe-skip.
- **פורמט ארכיון**: שקופית "נקייה" (ייצוא PDF/PPT, תמונות Panopto) → WebP lossless (מדויק וקטן מ־PNG פי ~2.5); פריים מתוך וידאו → AVIF ‏4:4:4 ‏q≈70 (הנאמנות הגבוהה ביותר לקצוות טקסט בכל ~80KB; ‏4:2:0 באותו גודל נותן PSNR נמוך ב־~5dB); ‏WebP q90 כשמהירות פענוח/תאימות חשובות; לא JPEG ‏4:2:0 לטקסט. את ה־OCR להריץ על הפריים המקורי לפני הדחיסה לארכיון.
- **IA ב־R2 לא משתלם** לווידאו זמני (מינימום 30 יום + עלות שליפה); רק לארכיון ישן שכמעט לא נקרא.

### פערים (Gaps)
- קצב הסיביות הממשי של הרצאות ביוטיוב ב־1080p (avc1/vp9/av01) — צריך `yt-dlp -F` (עמודת TBR) על מדגם בשרת; גם מרווח ה־keyframes שיוטיוב מגיש — לא נמצא מקור.
- דגם המעבד וה־steal בפועל ב־CX53 — לא נמדד; המדידה כאן בסביבה אחרת ועל תוכן סינתטי.
- דיוק OCR לפי פורמט/איכות (מדדנו SSIM/PSNR בלבד, בלי מנוע OCR) — ובמיוחד לעברית.
- האם `libvpx-vp9` (במקום המפענח המקורי) מכבד `skip_frame` — לא נבדק.
- סף גודל טקסט מינימלי לפיקסלים ל־OCR (גובה x) — לא נמצא בתיעוד Tesseract.
