# מהירות העלאה מהטלפון ל־R2 (multipart עם presigned URLs, פרוטוקול ותעבורה)

> נכון ל־01/11/2026. מידע ישן מסומן בתאריך. מה שלא אומת במקור נמצא תחת "Inferences" או "Gaps".

## 1. המגבלות וההתנהגות של R2

### Takeaway
גודל חלק 5MiB–5GiB, עד 10,000 חלקים, כל החלקים חוץ מהאחרון באותו גודל, העלאה חלקית נמחקת אחרי 7 ימים, ו־presigned URL תקף עד 7 ימים. השינוי הכי משמעותי לאחרונה הוא **Local Uploads** (בטא פתוחה מ־03/02/2026, בלי עלות נוספת): הוא חל על `UploadPart` וקוצר את משך הבקשה בעד 75% כשהלקוח רחוק מהדלי. הנקודה החלשה: נקודת הקצה של S3 ‏(`r2.cloudflarestorage.com`) היא כנראה **HTTP/1.1 בלבד**.

### Cited Findings
- גודל אובייקט מרבי 5TiB, העלאה ב־PUT אחד עד ~4.995GiB, ועד 10,000 חלקים. — [R2 limits](https://developers.cloudflare.com/r2/platform/limits/)
- **מותרת כתיבה אחת בשנייה לאותו מפתח**, ומעבר לזה מתקבל 429. המגבלה הזו היא על המפתח הסופי ולא על `UploadPart`. פעולות ניהול דלי מוגבלות ל־50 בשנייה. ב־`r2.dev` יש ויסות (throttling) כבר ממאות בקשות בשנייה. — [R2 limits](https://developers.cloudflare.com/r2/platform/limits/)
- כל חלק חייב להיות לפחות 5MiB (חוץ מהאחרון) ולכל היותר 5GiB. "All parts except the last must be the same size". ה־ETag של חלק הוא ה־MD5 שלו. העלאה שלא הושלמה מבוטלת אוטומטית אחרי 7 ימים כברירת מחדל, ואפשר לשנות את זה ב־lifecycle. — [R2 multipart objects](https://developers.cloudflare.com/r2/objects/multipart-objects/)
- תוקף presigned URL הוא בין שנייה אחת ל־604,800 שניות (7 ימים), לפי `X-Amz-Expires`. — [R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)
- המדינה (Jurisdiction) לא מופיעה בדפים, אבל Local Uploads **לא נתמך בדלי עם הגבלת jurisdiction** (EU, FedRAMP). — [Local uploads docs](https://developers.cloudflare.com/r2/buckets/local-uploads/)
- **Local Uploads**: הנתונים נכתבים קודם לאחסון קרוב ללקוח ומועתקים ברקע לאזור של הדלי. המטא־דאטה עדיין נכתב באזור הדלי. האובייקט קריא מיד ונשאר strongly consistent. חל על `PutObject` ועל `UploadPart`. בבדיקה סינתטית (לקוח במערב צפון אמריקה, דלי עם location hint ל־APAC, ‏~20 PUT בשנייה של 5MB במשך 30 דקות) ה־TTLB החציוני ירד מ־~2 שניות ל־~500ms, כלומר "עד 75%". מפעילים ב־`npx wrangler r2 bucket local-uploads enable <BUCKET>` או בכרטיס בהגדרות הדלי. אין עלות נוספת מעבר ל־Class A. — [Cloudflare blog](https://blog.cloudflare.com/r2-local-uploads), [changelog 2026-02-03](https://developers.cloudflare.com/changelog/2026-02-03-r2-local-uploads/), [InfoQ 02/2026](https://www.infoq.com/news/2026/02/cloudflare-local-uploads)
- המסמכים לא מזכירים presigned URLs בהקשר של Local Uploads. מוזכרות רק הפעולות `PutObject`/`UploadPart`. — [Local uploads docs](https://developers.cloudflare.com/r2/buckets/local-uploads/)
- **פרוטוקול**: לפי פוסט בפורום הקהילה (לא של צוות Cloudflare, בערך מאמצע 2025) ה־S3 API ‏(`r2.cloudflarestorage.com`) הוא HTTP/1.1 בלבד, ודומיין מותאם תומך עד HTTP/2. בשרשור אחר (בערך 2022) עובד Cloudflare כתב: "we've recently disabled http2, so clients should automatically use http1.1 now" ו־"HTTP/2 isn't something we'll put much effort into in the near future". — [Community: R2 HTTP/3](https://community.cloudflare.com/t/will-cloudflare-r2-support-http-3-or-not/798982), [Community: R2 HTTP/2 error](https://community.cloudflare.com/t/cloudflare-r2-http-2-error/441326) (קראתי את התקצירים מתוצאות החיפוש. הדף עצמו החזיר 403)
- לפי ה־issue, R2 לא מממש את S3 POST Object (העלאה בטופס), ומחזיר 501. — [Cap issue #1684](https://github.com/CapSoftware/cap/issues/1684)
- בפורום הקהילה יש שרשור "Slow R2 Put/Upload Speeds" (5 תגובות, 679 צפיות, פעילות אחרונה 17/02/2026). לא הצלחתי לקרוא את התוכן. — [Community R2 tag](https://community.cloudflare.com/tag/r2/457)
- מ־rclone: משתמש עם קו 10Gbps קיבל בהתחלה ~20MB/s. כיבוי checksum העלה ל־~30MB/s, וכוונון של multipart (גודל חלק ומקביליות) העלה ל־~110MB/s (ו־~250MB/s על קובץ 10GB). מגיב אחר כתב ש־"R2 has in the past been unhappy with large s3 upload concurrency". — [rclone forum: 10gbps](https://forum.rclone.org/t/slow-upload-speed-for-10gbps-connection/35350), [rclone forum: multipart](https://forum.rclone.org/t/rclone-fails-to-switch-to-multi-part-uploads-when-a-file-is-too-large/36259)

### Inferences
- **הפעולה הכי זולה והכי רלוונטית: להפעיל Local Uploads על דלי ההעלאות.** הדלי כנראה רשום ב־WEUR/EEUR, וטלפון בישראל פוגש את Cloudflare ב־PoP בתל אביב. בלי הפיצ'ר כל חלק נשלח מה־PoP לאזור הדלי לפני שמוחזר 200, ועם 4 חלקים במקביל כל ה־RTT לאזור "נבלע" בכל חלק. הפיצ'ר עובד ברמת השרת על `UploadPart`, ולכן הוא **אמור** לחול גם על presigned PUT, כי זו אותה פעולה. לא מצאתי אישור מפורש לכך, וצריך למדוד.
- בגלל ה־HTTP/1.1 כל חלק במקביל = חיבור TCP+TLS נפרד. בדפדפן זה נכנס למגבלה המוכרת של עד 6 חיבורים ל־host ב־HTTP/1.1 (Chromium/Firefox, ידע כללי שלא אימתתי בסשן הזה). עם 4 במקביל אנחנו מתחת למגבלה, אבל אם PUT של התקדמות, ListParts או בקשות אחרות יוצאים לאותו host, הן מתחרות על החיבורים.
- המגבלה של כתיבה אחת בשנייה לאותו מפתח לא רלוונטית ל־UploadPart, אבל היא כן רלוונטית אם "העלאת האודיו קודם" כותבת לאותו מפתח שוב ושוב.

### Gaps
- לא מצאתי תיעוד רשמי עדכני (2026) של Cloudflare על HTTP/2 או HTTP/3 ב־`<account>.r2.cloudflarestorage.com`. מהסביבה הזו לא היה אפשר לבדוק, כי לחיצת היד של TLS נכשלה דרך הפרוקסי. **צריך לבדוק מהטלפון או מהמחשב:** `curl -sv --http2 -o /dev/null https://<ACCOUNT>.r2.cloudflarestorage.com/ 2>&1 | grep ALPN`, ולבדוק אם יש כותרת `alt-svc`.
- לא מצאתי מקור שמאשר במפורש ש־Local Uploads חל על presigned URL או על דלי שמוגש דרך custom domain.
- לא מצאתי מגבלת rate ייעודית ל־UploadPart לדלי (מעבר למגבלה של כתיבה בשנייה למפתח).
- חשיפת ETag ב־CORS: ידוע (ולא אומת בסשן) שבכלל ה־CORS של R2 צריך `ExposeHeaders: ["ETag"]` כדי ש־XHR/fetch יוכלו לקרוא את ה־ETag של החלק. אצלנו ההתקדמות נמדדת ב־ListParts בשרת, כך שהשרת יכול להשלים את ההעלאה גם בלי ETag מהלקוח.

## 2. גודל חלק ומקביליות אופטימליים ברשת סלולרית וב־Wi-Fi

### Takeaway
בבקשה אחת התפוקה מוגבלת בגלל slow start, ה־RTT לאזור הדלי ותקורת TLS לכל חיבור HTTP/1.1. לכן חלקים של 8MiB עם 4 במקביל עלולים להיות מתחת לרוחב הפס בקו מהיר עם RTT גבוה. המלצה: חלקים של 16–32MiB ומקביליות 4–6, מותאמת לפי מדידה. ל־R2 אין צורך בחלקים זהים כשיש העלאה אחת לכל קובץ, אבל חובה שכל חלק חוץ מהאחרון יהיה באותו גודל, ולכן אי אפשר להגדיל חלקים באמצע העלאה.

### Cited Findings
- הנחיית AWS (מתוך הידע של הכלי, הדף עצמו לא נטען): חיבור אחד מגיע בערך ל־85–90MB/s, וממליצים על טווחים של 8–16MB ועל חיבורים מקבילים. — [AWS S3 performance whitepaper](https://docs.aws.amazon.com/whitepapers/latest/s3-optimizing-performance-best-practices/use-byte-range-fetches.html) (התוכן לא נטען. התקבל כסיכום. לסמן כמשני)
- ב־Uppy ברירת המחדל של `getChunkSize` היא `Math.ceil(file.size / 10000)`, עם מינימום 5MB ועד 10,000 חלקים. כלומר בברירת המחדל Uppy משתמש בחלק הכי קטן שמותר. — [@uppy/aws-s3 MultipartUploader.ts 4.3.2](https://app.unpkg.com/@uppy/aws-s3@4.3.2/files/src/MultipartUploader.ts), [Uppy docs](https://uppy.io/docs/aws-s3/)
- ה־`limit` של Uppy (ברירת מחדל 6) הוא מספר **קבצים** במקביל, וזה "not the same as the amount of concurrent connections". — [Uppy docs](https://uppy.io/docs/aws-s3/)
- HTTP/2 יכול להאט העלאות מאוד בגלל flow control עם חלון קטן. ב־Nextcloud/Apache ההעלאה הייתה ~1MB/s ב־h2, וכיבוי h2 שיפר פי 10 ויותר. Cloudflare עצמה תיקנה את זה ב־2020 עם autotuning לבאפר. — [Cloudflare blog 2020: HTTP/2 upload speed](https://blog.cloudflare.com/delivering-http-2-upload-speed-improvements/), [nextcloud#25297](https://github.com/nextcloud/server/issues/25297)
- ב־tusd דווח שהעלאות h2 איטיות מאחורי HAProxy, והכוונון של HAProxy ל־h2 עזר. — [tusd#1106](https://github.com/tus/tusd/issues/1106)
- HTTP/3 מול Cloudflare (שרת speed test, לא R2): העלאה ~200Mbps ב־h3 לעומת ~350Mbps ב־h2. — [Mozilla bug 2005518](https://bugzilla.mozilla.org/show_bug.cgi?id=2005518)
- ל־Cloudflare Stream ‏(tus) הם ממליצים על חלק של 50MiB ברשת אמינה, כי זה "better performance than the minimum". — [Stream resumable uploads](https://developers.cloudflare.com/stream/uploading-videos/resumable-uploads/)

### Inferences
- **חשבון מוערך (לא נמדד):** אם ה־RTT בין ה־PoP בתל אביב לאזור הדלי באירופה הוא ~60–80ms, ובחלק של 8MiB הלקוח מחכה גם לכתיבה באזור הדלי (שלפי הבלוג של Local Uploads יכולה להגיע לשנייות בין אזורים), אז בכל חלק יש "זמן מת" של מאות ms עד שנייה, שבו אין בייטים בצינור. עם 4 במקביל ובקו של 100Mbps ‏(~12MB/s), חלק של 8MiB לוקח ~2.7 שניות לשידור, ולכן זמן מת של 0.5–1 שנייה הוא איבוד של 15–30%. חלקים של 32MiB מצמצמים את האיבוד פי 4. Local Uploads מצמצם את הזמן המת עצמו.
- כל חיבור HTTP/1.1 חדש מתחיל ב־slow start. כשהדפדפן משתמש שוב בחיבור (keep-alive), החלון נשמר בחלקו. כדאי לא לפתוח יותר חיבורים ממה שצריך ולעבוד עם "בריכה" קבועה של 4–6 שמושכים חלקים מתור. ב־Android, ‏BBR של השרת (Cloudflare) קובע את הקצב בכיוון ההורדה בלבד. בהעלאה ה־congestion control הוא של **הטלפון** (ב־Android בדרך כלל CUBIC), כך שאין לנו שליטה מצד השרת.
- סלולר: ה־uplink בסלולר מוגבל בדרך כלל ל־5–50Mbps. שם מקביליות גבוהה מ־4 לא תוסיף הרבה, וחלקים גדולים מדי (מעל 64MiB) מגדילים את מחיר הכישלון: חלק שנכשל נשלח מחדש כולו. **המלצה מעשית:** גודל חלק לפי גודל הקובץ (`max(16MiB, ceil(size/9000))`), ואם הרשת נמדדה כאיטית או `navigator.connection.effectiveType` אינו `4g` אז 8–16MiB. כשהקו מהיר וה־RTT גבוה: 32MiB עם 6 במקביל.
- Retry על חלק: לא לחזור מיד על 4 חלקים יחד. backoff עם jitter, ולהוריד מקביליות זמנית כשמגיעים 429/503.
- חשוב: הקוד שלנו שולח לכל חלק `presigned PUT` חדש. אם השרת שלנו (Vercel) חותם כל חלק "בזמן אמת", ה־RTT לשרתון נוסף לכל חלק. לחתום מראש באצווה (למשל 20 חלקים קדימה) מסיר את זה.

### Gaps
- לא מצאתי benchmark פומבי של R2 מטלפון או מישראל, וגם לא מספרים עדכניים מ־s5cmd או מ־AWS Transfer Manager מול R2.
- לא נמצא ברירת המחדל הנוכחית של מקביליות החלקים בתוך קובץ אחד ב־@uppy/aws-s3 5.x.

## 3. ספריות ופרוטוקולים

### Takeaway
אף ספרייה נפוצה לא מכוונת מקביליות או גודל חלק אוטומטית לפי הרשת. Uppy/aws-s3 נותן `getChunkSize` ו־`limit`, ו־tus/RUFH מוסיפים בעיקר חידוש העלאה (resume), לא מהירות. עם presigned URLs ל־R2, ספרייה משלנו עם תור ומדידה היא הדרך היחידה ל־"adaptive".

### Cited Findings
- `@uppy/aws-s3`: האפשרות `shouldUseMultipart` (מגרסה 3.10.0) ו־`getChunkSize` מותאם אישית. מינימום 5MB ועד 10,000 חלקים. — [Uppy docs](https://uppy.io/docs/aws-s3/), [PR #4299/#4508](https://github.com/transloadit/uppy/pull/4508)
- IETF Resumable Uploads for HTTP ‏(RUFH): ‏`draft-ietf-httpbis-resumable-upload-12` מיולי 2026, Standards Track, ופג ב־07/01/2027. יש עותק עבודה מאוחר יותר מאוגוסט 2026. קוד הסטטוס הזמני 104 (Upload Resumption Supported) רשום ב־IANA עד 13/11/2026. — [draft-12](https://www.ietf.org/archive/id/draft-ietf-httpbis-resumable-upload-12.html), [http.dev/104](https://http.dev/104)
- tusd מול HTTP/2 מאחורי פרוקסי: דווחה איטיות. — [tusd#1106](https://github.com/tus/tusd/issues/1106)
- Cloudflare Stream: ‏POST בסיסי עד 200MB. מעל זה חובה tus. החלק בין 5MiB ל־200MiB, בכפולות של 256KiB, קבוע לכל ההעלאה, ומומלץ 50MiB. — [Stream direct creator uploads](https://developers.cloudflare.com/stream/uploading-videos/direct-creator-uploads/), [Stream resumable](https://developers.cloudflare.com/stream/uploading-videos/resumable-uploads/)

### Inferences
- tusd עם backend של S3/R2 מוסיף קפיצה (hop) דרך השרת שלנו (Hetzner). כל הבייטים עוברים דרכו, וזה רע לקצב ולעלויות התעבורה, אלא אם הוא יושב ליד המשתמש. לא מומלץ לנו.
- ל־RUFH עדיין אין תמיכה מובנית בדפדפנים ואין תמיכה ב־R2. אפשר לעקוב, אבל זה לא רלוונטי ל־2026.
- AWS SDK ‏`lib-storage Upload` (ידע כללי, לא אומת): `queueSize` ברירת מחדל 4 ו־`partSize` ‏5MB. הוא דורש מפתחות בצד הלקוח ולכן לא מתאים ל־presigned. Evaporate.js נטוש מזה שנים (ידע כללי, לא אומת).

### Gaps
- לא אומתו בסשן המספרים של lib-storage ומצב Evaporate.js.

## 4. הפחתת בייטים: טרנסקוד או remux בטלפון

### Takeaway
טרנסקוד בטלפון יכול לקצץ את הקובץ פי 3–10 (למשל 4K/HEVC ל־720p), אבל הוא עולה זמן וסוללה ויש מגבלות מקודד שתלויות במכשיר. להעלאה לתמלול, "אודיו קודם" (כבר קיים) הוא הניצחון העיקרי. וידאו מלא — רק אם המשתמש בחר.

### Cited Findings
- Mediabunny: עוטף WebCodecs בפענוח צינורי עם האצת חומרה, וכותב בהדרגה. ב־benchmark שלהם (המרה ל־WebM ‏320x180) קיבלו ~804 fps, לעומת 324 ב־@remotion/webcodecs ו־12 ב־ffmpeg.wasm. **המכונה: Ryzen 7600X + RTX 4070, לא טלפון.** — [mediabunny.dev](https://mediabunny.dev/), [Mediabunny guide](https://mediabunny.dev/guide/introduction)
- דיווח משתמש: ב־Chrome בחלק ממכשירי המובייל מקודד ה־AVC לא מקבל פלט מעל 720p, למרות שבמחשב זה עובד. צריך `canEncodeVideo` ונפילה (fallback) לרזולוציה נמוכה יותר. — [mediabunny discussion #238](https://github.com/Vanilagy/mediabunny/discussions/238)
- Remotion הכריזה על Mediabunny כמחליף לספרייה שלה (Media Parser deprecated). — [Remotion blog](https://www.remotion.dev/blog/mediabunny)

### Inferences
- remux בלבד (למשל להוציא את רצועת האודיו מ־MP4 בלי קידוד מחדש) מהיר כמעט כמו קריאת הקובץ, וזה מה שמאפשר "אודיו קודם". טרנסקוד מלא של וידאו בטלפון רץ בערך בזמן אמת עד פי כמה ממנו, תלוי במכשיר (לא מצאתי מספרים למובייל). בקו של 20Mbps כבר זה יכול להיות איטי יותר מהעלאה ישירה של קובץ 1GB.
- בנייטיב (MediaCodec/Media3 Transformer ב־Android, ‏AVAssetExportSession ב־iOS): קידוד חומרה מהיר יותר מ־WebCodecs בדפדפן, אבל זה מחוץ לתחום ה־PWA.

### Gaps
- לא נמצאו benchmarks של WebCodecs/Mediabunny על טלפון אנדרואיד או iPhone (fps, צריכת סוללה).

## 5. מדידת תפוקה אמיתית וזיהוי תקיעות

### Takeaway
מודדים בצד הלקוח: `xhr.upload.onprogress` לכל חלק (בייטים לשנייה בחלון של 2–5 שניות), ומצרפים לשרת את זמן ההתחלה והסיום של כל חלק. ‏`navigator.connection` נותן רק רמז גס.

### Cited Findings
- (לא נמצא מקור ספציפי בסשן הזה.)

### Inferences
- `navigator.connection` ‏(Network Information API) קיים ב־Chrome/Android ולא קיים ב־Safari/iOS. ‏`downlink` מוגבל לערכים מעוגלים ומתייחס להורדה, לא להעלאה (ידע כללי, לא אומת).
- ב־Resource Timing יש לבקשות XHR/fetch ‏`requestStart`/`responseStart`/`responseEnd`. עבור PUT, ההפרש `responseStart − requestStart` כולל את זמן שליחת הגוף ואת זמן הכתיבה בשרת. השוואה בין חלקים מגלה אם הזמן המת (TTLB בשרת) גבוה. ‏`nextHopProtocol` מראה אם החיבור היה `http/1.1`, `h2` או `h3`. **זו הדרך הכי פשוטה לאמת את שאלת הפרוטוקול מהטלפון עצמו.**
- זיהוי תקיעה: אם `onprogress` לא זז במשך X שניות (למשל 20 שניות בסלולר) — abort ו־retry לחלק, תוך שמירה על החלקים שהושלמו. ListParts בשרת מוסיף RTT, וכדאי רק לשחזור אחרי קריסה.

### Gaps
- לא נמצאו מקורות עם ספים מומלצים לזיהוי תקיעה במובייל.

## 6. השוואה: ‏R2 מול Google Drive resumable מול Cloudflare Stream ‏(tus)

### Takeaway
Drive resumable הוא סדרתי (חלק אחרי חלק) ולכן בדרך כלל לא מהיר יותר. Stream ‏(tus) גם הוא סדרתי, אבל עם חלקים גדולים (50MiB). ל־R2 עם multipart מקבילי ו־Local Uploads יש את הפוטנציאל הגבוה ביותר.

### Cited Findings
- Drive resumable: חלקים בכפולות של 256KB, "Keep the chunk size as large as possible", ה־session URI תקף שבוע, ומתקדמים לפי `Range` מהתגובה, כלומר סדרתי. המסמך לא אומר אם מותר להעלות במקביל. — [Drive manage uploads](https://developers.google.com/workspace/drive/api/guides/manage-uploads)
- Stream: ‏tus חובה מעל 200MB, חלק בין 5MiB ל־200MiB, מומלץ 50MiB. — [Stream resumable](https://developers.cloudflare.com/stream/uploading-videos/resumable-uploads/)

### Inferences
- Drive ו־Stream תלויים בחיבור יחיד, ולכן ב־RTT גבוה ועם slow start הם רגישים יותר. R2 במקביל מנצל את הקו טוב יותר. Stream גם מקודד מחדש ועולה כסף לפי דקות. לא מומלץ רק בשביל מהירות.

### Gaps
- לא נמצאו מדידות השוואתיות פומביות.

## המלצות לפי סדר עדיפות (מסקנות מהממצאים)
1. **להפעיל Local Uploads על דלי ההעלאות** (`npx wrangler r2 bucket local-uploads enable <BUCKET>`). חינם, ובלי שינוי קוד. לוודא קודם שלדלי אין jurisdiction (EU). למדוד לפני ואחרי: זמן לחלק ב־Resource Timing.
2. **חלקים גדולים יותר**: 16–32MiB (במקום 8MiB) כשהרשת טובה, וגודל קבוע שנקבע לפני ההתחלה.
3. **בריכה של 4–6 חיבורים שמושכים מתור**, וחתימה מראש של presigned URLs באצווה, בלי RTT לשרתון בכל חלק.
4. **לאמת את הפרוטוקול** ב־`performance.getEntriesByType('resource')[i].nextHopProtocol` מהטלפון. אם יוצא `http/1.1`, יש מגבלת 6 חיבורים לכל host, ולכן לא לשלוח בקשות אחרות לאותו host במהלך ההעלאה.
5. **לא לעבור ל־tus/Drive/Stream בשביל מהירות.** טרנסקוד בטלפון — רק כאפשרות, עם `canEncodeVideo` ו־fallback ל־720p.
