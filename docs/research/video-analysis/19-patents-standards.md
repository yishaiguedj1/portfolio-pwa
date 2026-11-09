# פטנטים, קניין רוחני ותקנים ללשונית Video Analysis — מפה אינפורמטיבית (מצב 9/11/2026)

> הערות מחקר ללשונית "Video Analysis" של THE SNOWBALL Studio. הלשונית כוללת:
> - ניתוח מלא של הרצאות, וובינרים וקורסים — מהשמע וגם ממה שעל המסך.
> - כל נקודה לחיצה ומובילה לרגע המדויק.
> - גלריית שקופיות וסינתזה עמוקה.
> - כרטיסיות ומבחנים.
> - ייצוא ל־Markdown, ‏PDF, ‏DOCX ו־Anki, וגם לקורא ה־EPUB של Academy (בנוי על foliate-js).
>
> **מידע כללי בלבד — לא ייעוץ משפטי ולא חוות דעת חופש פעולה (FTO).**
> - מצב פטנט = מה שמוצג ב־Google Patents ב־9/11/2026. האתר עצמו מסייג: "The status is an assumption and is not a legal conclusion".
> - פטנט הוא טריטוריאלי. המיפוי כאן נוגע בעיקר לפטנטים אמריקאיים ולבני המשפחה שמופיעים באותו דף.
>
> **מגבלות המחקר:**
> 1. תקציב החיפוש ברשת של הסבב (משותף לכל הסוכנים) נגמר באמצע העבודה. מאותו רגע אומתו עובדות רק בשליפה ישירה של מקורות ראשוניים: דפי Google Patents, מפרטים, ריפו, קבצי raw ותיעוד רשמי.
> 2. התביעות סוכמו מהנוסח שב־Google Patents. כשהדף נקטע לפני פרק התביעות, זה כתוב במפורש ומתואר רק התקציר או התיאור.
> 3. "תקציר חיפוש" = עובדה שנראתה רק בתקציר של תוצאת חיפוש, כי הדף עצמו חסום או נפל. כל עובדה כזאת מסומנת.
> 4. לא נעשה חיפוש שיטתי של אמנות קודמת, ולא חיפוש בפטנטים ישראליים או אירופיים מעבר לבני המשפחה שבדפים. זו מפה של "מי בשטח", לא רשימה סגורה.
> 5. הבדיקות בקוד שלנו (foliate-js, ‏CSP של Academy) נעשו מקומית בריפו, בלי לשנות קבצים.

## 1. חילוץ שקופיות מווידאו של הרצאה — מה פקע, מה בתוקף ואיך להתרחק

### שורה תחתונה (Takeaway)
הטכניקה הבסיסית — דגימת פריימים, זיהוי שינוי ושמירת פריים מייצג עם חותמת זמן — מתוארת בפטנטים מ־1998–2010. כל הפטנטים האלה פקעו (Webex/Cisco, ‏NewsTakes, ‏Sonic Foundry, ‏Fuji Xerox).

הפטנט הפעיל הרלוונטי היחיד שנמצא הוא HP ‏US10007848B2 "Keyframe annotation", בתוקף עד 2035. הוא דורש שילוב של שני דברים: בחירת תת־קבוצה לפי העדפת המשתמש, **וגם** הערות מותאמות אישית. גלריית שקופיות רגילה לא נכנסת לשילוב הזה. צריך זהירות רק בשכבה של "חוברת לימוד מותאמת אישית".

### ממצאים מתועדים (Cited Findings)
**אמנות קודמת שפקעה**
- **US6646655B1** "Extracting a time-sequence of slides from video" — [Google Patents](https://patents.google.com/patent/US6646655B1/en)
  - בעלים: Webex Communications. כבעלים נוכחיים רשומות Cisco Technology ו־SOFTVIDEO (Google מסייג שרשימת הבעלים עשויה להיות לא מדויקת).
  - הוגש 9/3/1999, ניתן 11/11/2003.
  - מצב: **Expired - Lifetime**, תום תוקף משוער 9/3/2019.
  - פרק התביעות נקטע בשליפה. לפי התקציר: נבחר לפחות פריים וידאו אחד כשקופית, ומשויך אליו ערך שמציין מתי הוא מופיע בווידאו.
- **US6342904B1** "Creating a slide presentation from full motion video" — [Google Patents](https://patents.google.com/patent/US6342904B1/en)
  - בעלים: NewsTakes. הוגש 17/12/1998, ניתן 29/1/2002.
  - מצב: **Expired - Fee Related**.
  - התביעות לא נשלפו.
- **US7149973B2** "Rich media event production system and method including the capturing, indexing, and synchronizing of RGB-based graphic content" — [Google Patents](https://patents.google.com/patent/US7149973B2/en)
  - בעלים: Sonic Foundry. הוגש 5/11/2003, ניתן 12/12/2006.
  - מצב: **Expired - Lifetime**, פקע 9/5/2025.
  - התיאור: לכידת פלט ה־RGB/VGA של מחשב המרצה בכרטיס לכידה, אינדוקס וסנכרון שלו עם השמע והווידאו של האירוע.
  - הודעת החברה מ־2006 נקבה בתוקף עד 11/5/2025 — פער של יומיים, בלי השפעה — [WisBusiness](https://www.wisbusiness.com/?p=1331348).
  - המוצר (Mediasite) יוצר שקופית חדשה כשהשינוי במסך עובר סף — [Stanford Open Source Lab](https://opensourcelab.stanford.edu/classroom-capture-using-mediasite).
- **US8280158B2** "Systems and methods for indexing presentation videos" — [Google Patents](https://patents.google.com/patent/US8280158B2/en)
  - בעלים: Fuji Xerox (היום Fujifilm Business Innovation).
  - קדימות 5/10/2009, הוגש 14/1/2010, ניתן 2/10/2012.
  - מצב: **Expired - Fee Related**. התוקף המלא היה מגיע עד 1/4/2031.
  - תביעות עצמאיות: 1 (שיטה), 32 (מערכת), 33 (מדיום). הרכיבים:
    1. דוגמים פריימים.
    2. משווים שינויי פיקסלים בין פריימים עוקבים.
    3. מקבצים רצפים "נייחים".
    4. בוחרים פריים מייצג מכל קבוצה.
    5. שומרים את הפריימים שיש בהם תוכן מידעי (שקופית עם טקסט או איור).
    6. מציגים אותם.

**בתוקף — דורש זהירות**
- **US10007848B2** "Keyframe annotation" — [Google Patents](https://patents.google.com/patent/US10007848B2/en)
  - פרסום US20180082124A1; ‏PCT ‏WO2016195659A1.
  - בעלים: HP. הוגש 2/6/2015, ניתן 26/6/2018.
  - מצב: **Active** עד 2/6/2035 (משוער). האגרות שולמו בנובמבר 2021 ובנובמבר 2025.
  - לפי התיאור: המערכת בונה עזרי לימוד מותאמים מסרטוני שקופיות. פריימי המפתח נלקחים בדרך כלל רגע לפני המעבר לשקופית הבאה.
  - התביעות בעברית פשוטה:
    - **תביעה 1:** מחלצים פריימי מפתח ממצגת וידאו ← בוחרים מתוכם תת־קבוצה לפי העדפת משתמש ← מצרפים הערות מותאמות אישית ← מציגים.
    - **תביעה 9:** מסווגים אזורי תוכן בפריים, חותכים "נקי" את אזור השקופית ומחילים העדפות. ההערות נקבעות לפי ההתנהגות הקודמת של המשתמש.
    - **תביעה 13:** פריימי "capstone".
    - תביעות תלויות: הימנעות מפריים שמופיע בו אדם (2, 15); מספר או צפיפות פריימים (5); מקור ההערות (7, 14); הפניות לחלקי הווידאו (8); היפר־קישורים (10); קוד QR בגרסה מודפסת (11).

### היסקים (Inferences)
- **אמנות קודמת חזקה:** גלריית שקופיות שבנויה על זיהוי שינוי, פריים מייצג וחותמת זמן נשענת על טכניקה שתוארה ב־1998–2010 ופקעה. זו אמנות קודמת חזקה נגד תביעה רחבה חדשה. היא לא מגינה מתביעה צרה שמשלבת כמה רכיבים.
- **איך להתרחק מ־HP:** הפרה מילולית דורשת את **כל** הרכיבים של תביעה עצמאית. מספיק שאחד חסר:
  1. הגלריה מציגה את כל השקופיות שזוהו, בלי שלב מובנה של "תת־קבוצה לפי העדפת משתמש".
  2. ההערות שה־AI מוסיף הן תוכן כללי של ההרצאה, לא "מותאמות" לפי היסטוריית המשתמש.
  3. "חוברת לימוד אישית" שמשלבת בחירה לפי העדפות עם הערות לפי התנהגות — רק אחרי בדיקה של עורך פטנטים.
- **סינון פריימים שיש בהם אדם** (התביעות התלויות 2 ו־15) לא מפר לבדו. תביעה תלויה כוללת את כל הרכיבים של התביעה שהיא נשענת עליה.

### פערים (Gaps)
- פרק התביעות של US6646655B1 ושל US6342904B1 לא נשלף.
- לא נמצאו פטנטים פעילים של פלטפורמות ההרצאות (Panopto, ‏Kaltura, ‏Echo360) על זיהוי שקופיות. דפי ה־assignee ב־Justia החזירו 403.
- לא נבדק אם WO2016195659A1 של HP נכנס לשלב לאומי מחוץ לארה״ב.

## 2. אינדוקס הרצאות מבוסס OCR ו־ASR, וחיפוש בתוך הווידאו

### שורה תחתונה (Takeaway)
חיפוש בתמליל ובטקסט שעל המסך, עם קפיצה לרגע, הוא תחום עשיר באמנות קודמת:
- Informedia של CMU — הוגש 1994, ‏ASR עם חותמות זמן, פקע 2015.
- AltaVista — 1998, פקע 2018.
- מוצרים מסחריים עם ASR ו־OCR על כל מילה — מ־2013–2014.

הסיכון שנמצא בפועל הוא תביעות של NPE על פטנטים ישנים. ‏Eureka Database Solutions תבעה ב־2017 את Panopto, את Kaltura ואת Nexidia על פטנטי AltaVista, והתביעה נגד Panopto הסתיימה בפשרה.

פטנט שפקע לא מאפשר לתבוע על שימוש שאחרי הפקיעה. לא נמצא פטנט פעיל רחב על "OCR של שקופיות + חיפוש עם קפיצה לזמן".

### ממצאים מתועדים (Cited Findings)
- **US5835667A** "Method and apparatus for creating a searchable digital video library and a system and method of using such a library" — [Google Patents](https://patents.google.com/patent/US5835667A/en)
  - בעלים: Carnegie Mellon University (פרויקט Informedia).
  - הוגש 14/10/1994. פקע (לפי Google: 10/11/2015).
  - התיאור:
    - תמלול אוטומטי בזיהוי דיבור (Sphinx-II), או לחלופין תמלול אנושי או כתוביות.
    - "marking the transcribed audio data with a first set of time-stamps".
    - אינדוקס התמליל, ויישור שלו לווידאו שגם הוא מסומן בזמן.
    - ניתוח התמונה: DCT, היסטוגרמות צבע ותנועה.
  - **OCR לא מוזכר בחלק שנשלף.**
  - פטנט נלווה של CMU — [uspto.report, 5,664,227](https://uspto.report/patent/grant/5,664,227) (לא נבדק לעומק).
- **US6311189B1** "Technique for matching a query to a portion of media" — [Google Patents](https://patents.google.com/patent/US6311189B1/en)
  - בעלים מקוריים: AltaVista. הבעלים הרשומים היום: Eureka Database Solutions, לצד Altaba (Google מסייג שהרשימה עשויה להיות לא מדויקת).
  - קדימות 11/3/1998, ניתן 30/10/2001.
  - פקע (לפי Google: 11/3/2018).
- **Eureka Database Solutions v. Panopto** — D. Del. ‏1:17-cv-01530 — [Patexia](https://services.patexia.com/lawsuits/Eureka-Database-Solutions-LLC-v-Panopto-Inc-id-110061)
  - הוגשה 27/10/2017. הסתיימה 26/4/2018 ("Dismissed, settled"). השופט: Richard G. Andrews.
  - הפטנטים:
    - 6,311,189.
    - 6,243,708 "Technique for accessing an item of interest within a stored representation of data".
    - 6,173,287 "Technique for ranking multimedia annotations of interest".
  - לפי תקציר חיפוש, התביעה כוונה ליכולת החיפוש של Panopto שמחזירה תוצאות עם חותמות זמן.
- **תביעות מקבילות של Eureka:**
  - נגד Kaltura ‏(D. Del. ‏1:17-cv-01529) — [RPX](https://insight.rpxcorp.com/lit/dedce-63551-eureka-database-solutions-v-kaltura).
  - נגד Nexidia ‏(W.D. Tex.) — [RPX](https://insight.rpxcorp.com/lit/txwdce-1092536-eureka-database-solutions-v-nexidia).
- **המוצר של Panopto:**
  - החברה מתארת חיפוש בכל מילה שנאמרת (ASR) או שמופיעה על המסך (OCR) — [Panopto](https://www.panopto.com/features/video-search/).
  - היכולת הוצגה בגרסה 4.6 — [Streaming Media](https://www.streamingmedia.com/Articles/News/Online-Video-News/Panopto-Greatly-Enhances-Video-Search-Capabilities-in-Version-4.6-95968.aspx); [Campus Technology, 25/3/2014](https://campustechnology.com/articles/2014/03/25/panopto-adds-video-content-search-to-lecture-capture-platform.aspx).
- **פטנטים של Panopto עצמה:** הופיעו רק בתוצאות חיפוש, למשל US10043549B2 — [9235.net](https://www.9235.net/patent/US10043549B2.html); [Trea](https://trea.com/person/eric-burns/information/beb03462-9bf4-4b50-a079-7428847b9af5). לא נמצא ביניהם פטנט על OCR או ASR.

### היסקים (Inferences)
- **הטכניקה ותיקה:** אינדוקס ASR ו־OCR עם קפיצה לזמן הוא פרקטיקה בת כ־30 שנה, והפטנטים המרכזיים שנמצאו פקעו.
- **הסיכון השיורי:** NPE שמחזיק פטנט ישן או צר. הוא מכוון בעיקר נגד מי שיש לו הכנסות ונראות בארה״ב. הדפוס של Eureka הוא תביעה במקביל נגד כמה פלטפורמות, ואחריה פשרה מהירה.

### פערים (Gaps)
- התביעות של US5835667A ושל US6311189B1 לא נקראו. הסיכום מבוסס על התיאור.
- לא נבדק אם ל־Eureka או לממשיכים שלה יש פטנטים פעילים בתחום.

## 3. ניווט שמסנכרן תמליל ווידאו, וסיכום עם טקסט שמקושר לחותמות זמן

### שורה תחתונה (Takeaway)
טקסט שמסונכרן לזמן מדיה — הדגשה בזמן הניגון ולחיצה שמזיזה את הנגן — הוא רעיון ותיק ומתוקנן:
- SMIL 1.0 ‏(1998), ‏DAISY ו־EPUB 3 Media Overlays.
- ‏W3C WAI מתאר "interactive transcripts" כיכולת רגילה של נגן, שמשתמשת בקובץ הכתוביות.

הפטנט הפעיל הקרוב ביותר שנמצא הוא 3Play ‏US8930308B1, בתוקף עד 29/9/2032. הוא צר: metadata נפרד (לא התמליל ולא מידע הסנכרון), שמשויך לחלק ממידע הסנכרון ומוצג בסנכרון בזמן הניגון.

בסיכום עם חותמות זמן, הפטנט הפעיל שנמצא (IBM ‏US12131115B2) צר מאוד: הערות של שני משתמשים משני כלים, והדגשה של החפיפה ביניהן בזמן.

### ממצאים מתועדים (Cited Findings)
- **US8930308B1** "Methods and systems of associating metadata with media" — [Google Patents](https://patents.google.com/patent/US8930308B1/en)
  - בעלים: 3Play Media. הוגש 20/8/2012, ניתן 6/1/2015.
  - מצב: **Active** עד 29/9/2032 (משוער).
  - תביעות עצמאיות 1, 10 ו־19, בעברית פשוטה:
    1. שומרים תמליל ומידע סנכרון בין התמליל למדיה.
    2. משייכים metadata — נפרד מהתמליל וממידע הסנכרון — לחלק ממידע הסנכרון.
    3. בזמן הניגון מציגים את ה־metadata בסנכרון עם המדיה.
- **3Play:**
  - מפרסמת רשימת פטנטים לסימון וירטואלי — [3Play Media, Patents](https://www.3playmedia.com/patents/).
  - מתארת תמליל אינטראקטיבי שבו לחיצה על מילה מנגנת מאותה נקודה — [3Play Media, Transcript Alignment](https://3playmedia.com/services/features/transcript-alignment).
- **SMIL 1.0** — המלצת W3C מ־15/6/1998 לסנכרון מולטימדיה (טקסט, תמונה, שמע ווידאו על ציר זמן) — [W3C](https://www.w3.org/TR/1998/REC-smil-19980615/).
- **DAISY 3** (2005) — ספרים מדברים עם טקסט שמסונכרן לשמע — [DAISY Consortium](https://daisy.org/activities/standards/daisy/).
- **W3C WAI על תמלילים** — [W3C WAI, Transcripts (עודכן 17/9/2024)](https://www.w3.org/WAI/media/av/transcripts/):
  - "Interactive transcripts highlight text phrases as they are spoken".
  - המשתמש יכול לבחור טקסט ולקפוץ לאותה נקודה.
  - זו "a feature of the media player", שה־"uses the captions file".
- **US12131115B2** "Summarization method for recorded audio" — [Google Patents](https://patents.google.com/patent/US12131115B2/en)
  - בעלים: IBM. קדימות 29/8/2016, הוגש 23/9/2021, ניתן 29/10/2024.
  - מצב: **Active** עד 29/8/2036 (משוער).
  - תביעה 1:
    1. אוספים הערות של משתמש אחד מכלי רישום ראשון, ושל משתמש שני מכלי שני. שתיהן קשורות להקלטת שמע של פגישה.
    2. מפיקים סיכום של ההערות המשולבות, בסדר שנקבע לפי אותות מהכלים.
    3. מדגישים בציר הזמן של השמע נקודה שבה ההערות של שני המשתמשים חופפות בזמן.
- **פרקטיקה בשוק:**
  - ה־intelligent recap של Teams Premium מציג סיכום AI עם פרקים וסמנים על ציר ההקלטה — [Microsoft Tech Community](https://techcommunity.microsoft.com/t5/microsoft-teams-blog/intelligent-meeting-recap-in-teams-premium-now-available/ba-p/3832541); [Microsoft Support](https://support.microsoft.com/office/meeting-recap-in-microsoft-teams-c2e3a0fe-504f-4b2c-bf85-504938f110ef).

### היסקים (Inferences)
- **תמליל אינטראקטיבי בסיסי** (הדגשה, ולחיצה שקופצת לזמן) הוא שטח פתוח. יש לו SMIL ו־DAISY משנות התשעים, ‏EPUB 3 ו־WAI. התביעות של 3Play דורשות metadata נוסף, נפרד מהתמליל ומהסנכרון, שמוצג בסנכרון — ולכן הן לא תופסות את הבסיס.
- **איפה כן צריך זהירות:** שכבה של "הערות צד" (כרטיסיות, מושגים, תגים) ששויכו לטווחי הסנכרון של התמליל ו"קופצות" אוטומטית כשהניגון מגיע לרגע. זה קרוב לשלושת הרכיבים של 3Play. שתי עקיפות הנדסיות פשוטות (לא קביעה משפטית):
  1. לשמור להערות חותמת זמן משלהן, ולא לשייך אותן דרך מבנה הסנכרון של התמליל.
  2. להציג אותן כרשימה סטטית עם קישורי זמן, במקום שיקפצו בזמן הניגון.
- **סיכום עם קישורי זמן:** הפטנט של IBM דורש שני משתמשים, שני כלי הערות וחפיפה ביניהם. סיכום AI למשתמש יחיד רחוק ממנו.

### פערים (Gaps)
- לא נעשה חיפוש ממצה לפטנטים על "סיכום שהנקודות שלו מקושרות לחותמות זמן". החיפוש עבר בעיקר דרך חברות (Otter, ‏Gong, ‏Zoom, ‏Microsoft). ייתכנו פטנטים פעילים שלא אותרו אצל חברות סיכום פגישות אחרות.
- הפטנטים האחרים ברשימה של 3Play לא נבדקו אחד־אחד.

## 4. פרקים ו"רגעי מפתח" שנוצרים ב־AI

### שורה תחתונה (Takeaway)
זה התחום הצפוף ביותר בפטנטים פעילים וחדשים:
- **Google** — המשפחות "Video timed anchors" ו־"Video anchors", בתוקף עד 2039–2042.
- **Zoom** — שני פטנטים שניתנו ביוני 2026, בתוקף עד 2044. שניהם מוגבלים ל־"communication session".
- **Adobe** — חלון נע עם מודל cross-modal. ניתן במרץ 2026.
- **Gong** — מודל נושאים לא מפוקח לשיחות.

כל אחד מהם תובע שילוב ספציפי, ולכן אפשר לתכנן מסביב:
- קובץ שהועלה, ולא סשן תקשורת.
- בלי מחווני רלוונטיות לשאילתה בסרגל.
- בלי OCR בשתי רזולוציות.
- בלי תוויות קטגוריה מרשימה סגורה.
- פרקים מ־LLM שקורא את התמליל, ולא מסווג גבולות לכל משפט עם cross-modal attention.

ובכל זאת, כאן כדאי בדיקה של עורך פטנטים לפני השקה מסחרית.

### ממצאים מתועדים (Cited Findings)
**Google**
- **US11823716B2** "Video timed anchors" — [Google Patents](https://patents.google.com/patent/US11823716B2/en)
  - קדימות 4/4/2019 (PCT/GR2019/000029). ניתן 21/11/2023. **Active** עד 9/4/2039.
  - תביעה 1, בעברית פשוטה:
    1. מקבלים מזהי "key moments" בווידאו.
    2. לכל רגע מגדירים תת־קטע קצר, מהרגע עד הרגע הבא.
    3. יוצרים תווית טקסט ובוחרים פריים.
    4. יוצרים "עוגן" עם הוראת ניגון מהרגע.
    5. מציגים בסרגל ההתקדמות מחווני רלוונטיות, רק כשהרלוונטיות עוברת סף.
    6. כשבוחרים עוגן — מנגנים מהרגע.
  - תביעה 10: הפריים נבחר לפי מדד גיוון (diversity), בלי תנאי הסף בסרגל.
- **US12451164B2** (continuation) — [Google Patents](https://patents.google.com/patent/US12451164B2/en)
  - הוגש 17/10/2023, ניתן 21/10/2025. **Active** עד 4/4/2039.
  - עוגנים שמוצגים בסרגל אחרי שאילתת חיפוש, לצד תוצאות חיפוש אחרות.
- **US11720793B2** "Video anchors" — [Google Patents](https://patents.google.com/patent/US11720793B2/en)
  - קדימות 14/10/2019. ניתן 8/8/2023. **Active** עד 19/1/2042.
  - הרכיבים: ישויות מתמליל ה־ASR; ציוני חשיבות ממודל שפה; נתונים ממדרגים אנושיים; אימון "מודל עוגנים".
- **US12393839B2** "Video anchors" (continuation) — [Google Patents](https://patents.google.com/patent/US12393839B2/en)
  - הוגש 14/6/2023. ניתן 19/8/2025. **Active** עד 13/10/2040.
  - מודל עוגנים שאומן עם hypernyms ואשכולות.
  - בהקדמת התביעה מופיע, באופן חריג, "augmented reality imagery".
  - לפי אותו דף, בקשת ההמשך US20250348735A1 ממתינה.
- **רקע מוצרי:**
  - פרקים בתיאור סרטון ב־YouTube: מתחילים ב־00:00, לפחות שלוש חותמות זמן, כל פרק באורך 10 שניות לפחות — [YouTube Help](https://support.google.com/youtube/answer/9884579).
  - key moments בתוצאות החיפוש מוגדרים דרך Clip או SeekToAction (סעיף 7) — [Google Search Central](https://developers.google.com/search/docs/appearance/structured-data/video).

**Zoom**
- **US12646506B2** "Dynamic chapter generation for a communication session using an overall score and a chapter score" — [Google Patents](https://patents.google.com/patent/US12646506B2/en)
  - פרסום: US20230326454A1, "Dynamic chapter generation for a communication session" — [Google Patents](https://patents.google.com/patent/US20230326454A1/en).
  - קדימות 12/4/2022. **ניתן 2/6/2026.** **Active** עד 20/5/2044.
  - תביעה 1:
    1. **מתחברים לסשן תקשורת** עם משתתפים.
    2. מקבלים תמליל עם זמנים ודוברים.
    3. מנקדים מקטעים מועמדים, ומחשבים ציון כולל (overall) וציון פרק (chapter).
    4. קובעים כותרת לפי מיקום ודירוג ביטויים.
    5. שולחים ללקוחות.
  - בן המשפחה האירופי EP4508545A1 ממתין — [Google Patents](https://patents.google.com/patent/EP4508545A1/en).
- **US12664798B2** "Video-based chapter generation for a communication session" — [Google Patents](https://patents.google.com/patent/US12664798B2/en)
  - קדימות 4/6/2022. **ניתן 23/6/2026.** **Active** עד 19/5/2044.
  - תביעה 1:
    1. מקבלים תמליל ווידאו של הסשן.
    2. מפיקים פריימים בשתי רזולוציות.
    3. מזהים טקסט ברזולוציה הנמוכה ומחלצים אותו ברזולוציה הגבוהה.
    4. מבצעים סגמנטציה עם content vector scoring ו־utterance embeddings.
    5. קובעים כותרת מהתמליל ו/או מהטקסט שעל המסך.
    6. מצמידים תווית קטגוריה מרשימה שנקבעה מראש.
  - בני משפחה: US20230394854A1, ‏EP4537541A1, ‏WO2023235580A1.
- **US12,323,264** "Dynamic communication session topic generation" — [USPTO Official Gazette](https://patentsgazette.uspto.gov/week22/OG/html/1535-1/US12323264-20250603.html)
  - ניתן 3/6/2025. ‏continuation של 11,876,633.
  - תקציר חיפוש בלבד; התביעות לא נבדקו.

**Adobe**
- **US12580003B1** "Determining topic chapters for digital videos utilizing a sliding window and video segmentation machine learning models" — [Google Patents](https://patents.google.com/patent/US12580003B1/en)
  - הוגש 26/11/2024. **ניתן 17/3/2026.** **Active** עד 26/11/2044.
  - תביעה 1:
    1. חלון נע על הווידאו, עם מקטעים חופפים.
    2. מקודד טקסט ומקודד פריימים.
    3. מודל cross-modal attention שחוזה לכל משפט אם הוא גבול.
    4. צבירת התחזיות לכל משפט.
  - תביעה 8: אימון עם contrastive losses.
  - המילה "chapters" לא מופיעה במפורש בתביעות העצמאיות.

**Gong**
- **US10642889B2** "Unsupervised automated topic detection, segmentation and labeling of conversations" — [Google Patents](https://patents.google.com/patent/US10642889B2/en)
  - בעלים: Gong.io. קדימות 20/2/2017. ניתן 5/5/2020. **Active** עד 27/12/2038.
  - תביעה 1:
    1. מקבלים אוסף שיחות מוקלטות עם שני דוברים או יותר.
    2. סופרים תדירויות מילים בקטעים קצרים.
    3. גוזרים אוטומטית, בלי תיוג, קבוצת נושאים שמסבירה את הקטעים בצורה הטובה ביותר (likelihood).
    4. מחלקים לפי נושא ומציגים יחד עם הדוברים.
- הודעת הסימון של Gong מונה גם את 9,699,409 ואת 9,992,448 — [Gong](https://www.gong.io/legal/notice-of-trademark-patent-rights).

**Microsoft**
- פרקים שנוצרים אוטומטית בהקלטות של פגישות Teams — [Microsoft Support](https://support.microsoft.com/office/auto-generated-chapters-on-teams-meeting-videos-7af781d3-ed33-4aae-bb66-0abd4c6c4c98). פטנט ספציפי לא נמצא.

### היסקים (Inferences)
- **כל פטנט פעיל תובע מנגנון ספציפי**, לא "פרקים מ־AI" באופן כללי:
  - Zoom — סשן תקשורת, ציונים כפולים, ‏OCR בשתי רזולוציות ותוויות קטגוריה.
  - Google — key moments עם מחווני רלוונטיות בסרגל מעל סף, או מודל עוגנים שאומן עם מדרגים, ‏hypernyms או אשכולות.
  - Adobe — מסווג גבולות לכל משפט, בחלון נע עם cross-modal attention.
  - Gong — מודל נושאים לא מפוקח על אוסף שיחות.
- **תכנון מוצע ללשונית** (הנדסי, לא משפטי):
  1. מייצרים פרקים על **קובץ שהועלה**, ולא תוך "התחברות לסשן".
  2. הפרקים נגזרים מ־LLM שקורא תמליל עם חותמות זמן ומחזיר רשימה. אין "מודל עוגנים" שאומן במיוחד, ואין מסווג גבולות לכל משפט.
  3. ‏OCR רץ על השקופיות שחולצו, ברזולוציה אחת. לא במבנה של "זיהוי ברזולוציה נמוכה וחילוץ בגבוהה".
  4. בלי תוויות קטגוריה מרשימה סגורה לכל פרק.
  5. בלי "מחווני רלוונטיות לשאילתה" בסרגל ההתקדמות. סימון גבולות פרקים בסרגל לפי זמן — כן. זו פרקטיקה מתוקננת (WebVTT chapters, סעיף 8).
- **התחום ימשיך להתמלא:** ‏Recentive (2025) מחליש תביעות של "generic machine learning" על נתונים חדשים, אבל Desjardins (סוף 2025) מקל בבחינה במשרד הפטנטים (סעיף 6). ההענקות של Zoom ושל Adobe ב־2026 מתאימות לכיוון הזה.

### פערים (Gaps)
- לא נמצא פטנט של Microsoft על פרקים אוטומטיים. לא נבדקו פטנטים של Vimeo, ‏Descript, ‏Loom, ‏Riverside, ‏Kaltura ו־Panopto בתחום.
- התביעות של US12,323,264 (Zoom) לא נבדקו.
- מעבר ל"ממתין" שבדף, הסטטוס של EP4508545A1 ושל EP4537541A1 לא נבדק.

## 5. שאלות ותשובות על וידאו עם הפניות מעוגנות לזמן

### שורה תחתונה (Takeaway)
הפטנט הפעיל הממוקד ביותר שנמצא הוא CurioXR ‏US12524465B2 — ניתן 13/1/2026, בתוקף עד 2043. הוא תובע שילוב של שלושה דברים:
- חותמת הזמן שבה נשאלה השאלה קובעת קטע תמליל ראשון.
- המודל נותן משקל גבוה יותר לתוכן שקרוב לזמן הזה.
- כשהביטחון נמוך מסף, עוברים לקטע מידע שני.

‏Adobe ‏(US11615308B2) ו־Twelve Labs ‏(US12079273B2) מכסים מנגנונים כלליים יותר של רשת עצבית ואחזור וקטורי. את התביעות שלהם לא היה אפשר לקרוא.

‏RAG רגיל על כל התמליל, שמחזיר ציטוטים עם חותמות זמן, לא נראה נופל לתביעות של CurioXR. עדיף להימנע מהשילוב "משקל לפי הקרבה לנקודת הצפייה + נפילה לפי סף ביטחון".

### ממצאים מתועדים (Cited Findings)
- **US12524465B2** "Systems and methods for browser extensions and large language models for interacting with video streams" — [Google Patents](https://patents.google.com/patent/US12524465B2/en)
  - בעלים: CurioXR (לשעבר VR-EDU). הממציא: Ethan Fieldman.
  - הוגש 26/10/2023. ניתן 13/1/2026. **Active** עד 26/10/2043.
  - תביעות עצמאיות 1, 10 ו־19, בעברית פשוטה:
    1. מקבלים שאלה יחד עם חותמת הזמן בהקלטה שבה היא נשאלה, ומשיגים תמליל.
    2. בוחרים מהתמליל "data domain" ראשון לפי חותמת הזמן.
    3. שולחים את השאלה, את התמליל ואת הקטע למודל ML נפרד.
    4. בתשובה, תוכן קרוב לחותמת הזמן מקבל משקל גבוה יותר מתוכן רחוק.
    5. אם ציון הביטחון נמוך מסף — המודל ניגש ל־data domain שני ומפיק תשובה מעודכנת.
  - למרות הכותרת, התביעות העצמאיות לא מזכירות תוסף דפדפן.
- **US11615308B2** "Generating responses to queries about videos utilizing a multi-modal neural network with attention" — [Google Patents](https://patents.google.com/patent/US11615308B2/en)
  - בעלים: Adobe. קדימות 6/2/2020. הוגש 28/12/2021. ניתן 28/3/2023. **Active** עד 6/2/2040.
  - התביעות לא היו בטקסט שנשלף.
  - לפי התיאור, המערכת "may" לאתר את חלק הווידאו שקשור לשאלה ולנגן אותו.
- **US12079273B2** "Video retrieval method and apparatus using post processing on segmented videos" — [Google Patents](https://patents.google.com/patent/US12079273B2/en)
  - בעלים: Twelve Labs. קדימות 7/3/2022. הוגש 8/8/2022. ניתן 3/9/2024. **Active** עד 8/8/2042.
  - התביעות לא נשלפו. לפי התיאור:
    1. מחלקים את הווידאו למקטעים לפי key frames, ולכל מקטע וקטור.
    2. מקודד שאילתות מבוסס ML ממיר את השאילתה לווקטור ומשווה.
    3. בוחרים את המקטע המתאים, ואפשר לצרף מקטעים סמוכים בזמן שעוברים סף.
    4. מזהים את זמני ההתחלה והסיום.
  - פטנטים נוספים של Twelve Labs: 12,045,281 ו־12,222,985 — [Justia](https://patents.justia.com/assignee/twelve-labs-inc) (תקציר חיפוש).
- **תיאור מקרה:** מערכת שאלות ותשובות על וידאו מבוססת RAG, עם זיהוי דוברים — [ZenML LLMOps Database](https://www.zenml.io/llmops-database/building-a-video-q-a-system-with-rag-and-speaker-detection) (מקור משני).

### היסקים (Inferences)
- **תכנון מוצע:** ‏RAG על כל התמליל ועל הטקסט של השקופיות, שמחזיר תשובה עם ציטוטים (חותמות זמן לחיצות). שני דברים להשאיר בחוץ:
  1. לא לתת לנקודת הצפייה הנוכחית משקל מובנה באחזור.
  2. לא לבנות מנגנון של "נפילה לתחום שני לפי סף ביטחון".

  כך חסר לפחות רכיב אחד מכל תביעה עצמאית של CurioXR.
- **"שאל על מה שרואים עכשיו"** הוא בדיוק התחום של CurioXR. אם רוצים את זה, יש שתי דרכים:
  1. בדיקה משפטית.
  2. מימוש שבו המשתמש בוחר טווח במפורש, בלי שקלול אוטומטי לפי מרחק ובלי נפילה לפי ביטחון.
- **‏Adobe ו־Twelve Labs:** התביעות שלהם לא נקראו, ולכן אי אפשר להסיק מהם עקיפה. ‏RAG עם אחזור וקטורי על מקטעי תמליל נפוץ מאוד, אבל "נפוץ" אינו הגנה משפטית.

### פערים (Gaps)
- התביעות של US11615308B2 ושל US12079273B2 לא נקראו — הדפים נקטעו לפני פרק התביעות.
- לא נבדקו פטנטים של Google, ‏Meta, ‏Amazon ו־Microsoft על שאלות ותשובות בווידאו.

## 6. התדיינויות בולטות 2015–2026 והסביבה המשפטית

### שורה תחתונה (Takeaway)
בעשור האחרון, ההתדיינות סביב לכידת הרצאות וווידאו ארגוני הייתה משלושה סוגים:
1. **‏NPE עם פטנטים ישנים:**
   - Eureka נגד Panopto, ‏Kaltura ו־Nexidia (2017–2018, פשרה).
   - Webcon Vectors נגד Kaltura (2025, נמחקה).
   - CoolTVNetwork נגד Kaltura (2025, הפטנט נפסל).
2. **מתחרים:**
   - Sonic Foundry נגד Astute (2013–2014, הסדר עם רישיון צולב).
   - Gong נגד Recall.ai (2025, נמחקה; תביעות 1–12 with prejudice).
3. **פרטיות, לא פטנטים — הגל של 2025–2026:** תביעות ייצוגיות נגד בוטים שמקליטים פגישות (Otter), ונגד טביעות קול לפי BIPA ‏(Fireflies, ‏Zoom).

ברמת הדוקטרינה:
- Recentive v. Fox (אפריל 2025) קבע ש־"generic machine learning" על סביבת נתונים חדשה אינו כשיר לפטנט.
- Ex parte Desjardins (מחייב מנובמבר 2025) ריכך את הבחינה במשרד הפטנטים.
- בישראל, הנחיות 2012 דורשות תרומה "טכנולוגית".

### ממצאים מתועדים (Cited Findings)
**פטנטים**
- **Sonic Foundry v. Astute Technology:**
  - ‏W.D. Wis. ‏3:13-cv-00087 נדחתה בנובמבר 2013 מטעמי סמכות שיפוט — [Justia Dockets](https://docs.justia.com/cases/federal/district-courts/wisconsin/wiwdc/3:2013cv00087/33170/31).
  - ההליך עבר ל־E.D. Va. ‏2:13-cv-00681 — [Patexia](https://services.patexia.com/lawsuits/Sonic-Foundry-Inc-v-Astute-Technology-LLC-id-45785).
  - הסדר: רישיון, רישיון צולב, והוצאה של 400 אלף דולר — [Sonic Foundry, Q2 FY2014](https://sonicfoundry.com/newsroom/sonic-foundry-reports-second-quarter-fiscal-2014-results). **תקציר חיפוש בלבד; הדף החזיר שגיאה 522.**
- **Astute** תבעה גם את Multi-View ואת Blue Sky ב־E.D. Tex. ‏(2015–2016) — [RPX](https://search.rpxcorp.com/lit/txedce-163097-astute-technology-v-multi-view); [Stanford NPE Litigation Database](https://npe.law.stanford.edu/node/47419).
- **Eureka Database Solutions** נגד Panopto, ‏Kaltura ו־Nexidia (2017) — ראו סעיף 2.
- **Gong.io v. Hyperdoc** (Hyperdoc פועלת בשם Recall.ai) — N.D. Cal. ‏5:25-cv-01026 — [PatSnap Eureka](https://eureka.patsnap.com/resources/blog/litigation/gong-io-v-hyperdoc-ai-recording-bot-patent-case-dismissed-patsnap-eureka/); [GreyB IPverse](https://ipverse.greyb.com/litigations/gong-io-inc-v-hyperdoc-inc--cand--5-25-cv-01026)
  - הוגשה 31/1/2025.
  - הפטנט: US 9,699,409 B1, ‏"Recording web conferences".
  - בקשה לדחייה התקבלה, עם רשות לתקן.
  - נסגרה 27/10/2025 בהסכמה (Rule 41(a)(2)): תביעות 1–12 with prejudice, ו־13–23 without prejudice.
  - לא ידוע אם היה הסדר.
- **Webcon Vectors v. Kaltura** — S.D.N.Y. ‏1:25-cv-01792 — [PatSnap Eureka](https://eureka.patsnap.com/resources/blog/litigation/webcon-vectors-v-kaltura-patent-infringement-case-patsnap/)
  - הוגשה 3/3/2025.
  - הפטנט: US 11,290,428 B2, ‏"Telecommunication method and system for simplifying communication such as conference calls".
  - נמחקה מרצון, without prejudice, ב־17/10/2025.
- **CoolTVNetwork.com v. Kaltura** — Fed. Cir. ‏24-2033 — [PatSnap Eureka](https://eureka.patsnap.com/resources/blog/litigation/cooltvnetwork-v-kaltura-streaming-patent-affirmed-unpatentable-patsnap/)
  - הפטנט: US7162696B2, פטנט סטרימינג בזמן אמת.
  - ב־23/4/2025 אושרה הקביעה שהפטנט אינו כשיר ("AFFIRMED").
  - המקור הוא בלוג. לא אומת מול פסק הדין.
- **Ricoh v. Zoom** — D. Del. — [Law360, 4/5/2026](https://law360.com/articles/2473196)
  - בקשה של Zoom לדחייה לפי Alice נדחתה "for now".
  - בית המשפט מצא שהפטנטים עוסקים ברעיון מופשט, אבל Ricoh הראתה די כדי לטעון ל־inventive concept.
  - בין הפטנטים הקשורים בדף: 10,904,487, ‏"Integration of videoconferencing with interactive electronic whiteboard appliances".

**פרטיות (לא פטנטים, אבל צמוד לתחום)**
- **Brewer v. Otter.ai** — N.D. Cal., אוגוסט 2025. הטענה: הבוט מקליט שיחות עבודה בלי הסכמת כל המשתתפים — [NHPR](https://www.nhpr.org/2025-08-15/class-action-suit-claims-otter-ai-secretly-records-private-work-conversations).
  - לפי תקציר חיפוש, אוחדה ב־22/10/2025 ל־In re Otter.AI Privacy Litigation ‏(5:25-cv-06911-EKL) — [National Law Review](https://natlawreview.com/article/ai-notetaking-tools-under-fire-lessons-otterai-class-action-complaint); [MLex](https://www.mlex.com/mlex/articles/2379449/us-class-action-accuses-otter-of-illegally-recording-virtual-meetings).
- **Cruz v. Fireflies.AI** — דצמבר 2025. הטענה: איסוף נתונים ביומטריים (טביעות קול) של משתתפי פגישות בניגוד ל־BIPA — [Data Privacy + Security Insider](https://www.dataprivacyandsecurityinsider.com/2025/12/lawsuit-alleges-fireflies-ai-corp-illegally-collects-biometric-data-from-virtual-meetings/).
- **Fricker v. Fireflies** — N.D. Ill. ‏1:26-cv-02675 — [Top Class Actions](https://topclassactions.com/lawsuit-settlements/lawsuit-news/fireflies-ai-sued-over-alleged-unlawful-data-collection-from-meeting-participants).
- **Sheldon v. Zoom** — N.D. Cal. ‏3:26-cv-10962, הוגשה 25/9/2026. הטענה: ‏AI Companion אסף טביעות קול של משתמשים מאילינוי בלי הסכמה — [ClaimDepot](https://www.claimdepot.com/cases/zoom-class-action-alleges-ai-companion-collected-biometric-voiceprints-without-illinois-users-consent).

**דוקטרינה**
- **Recentive Analytics v. Fox Corp.** — Fed. Cir., ‏18/4/2025: "patents that do no more than claim the application of generic machine learning to new data environments… are patent ineligible" — [Greenberg Traurig](https://www.gtlaw.com/en/insights/2025/4/federal-circuit-machine-learning-patents-ineligible-in-recentive-analytics-inc-v-fox-corp).
- **Ex parte Desjardins:**
  - החלטת ה־Appeals Review Panel מ־26/9/2025 נקבעה מחייבת ב־4/11/2025 — [USPTO](https://www.uspto.gov/subscription-center/2025/ptab-designates-precedential-appeals-review-panel-decision).
  - בעקבותיה יצאו תזכירים לבוחנים ב־4–5/12/2025 על בחינה מקלה יותר של שיפורי ML לפי §101 — [Pearl Cohen](https://www.pearlcohen.com/a-new-era-in-ai-patent-eligibility-in-view-of-ex-parte-desjardins/).
- **ישראל:** הנחיות רשם הפטנטים מ־15/3/2012 על המצאות תוכנה בוחנות תרומה "טכנולוגית" — [law.co.il](https://www.law.co.il/en/news/2012/03/29/new-israeli-guidelines-on-patentability-of-software/).

**שוק ובעלות**
- **Mediasite:** ‏Enghouse רכשה אותה מ־Sonic Foundry בהסכם מ־4/1/2024, בכ־15.5 מיליון דולר — [CX Today](https://www.cxtoday.com/contact-centre/enghouse-acquires-mediasite-from-sonic-foundry/); [SEC, Exhibit](https://www.sec.gov/Archives/edgar/data/1029744/000143774924000618/ex_612247.htm).
- **Otter:**
  - לפי CB Insights, החברה מחזיקה 28 פטנטים — [CB Insights](https://www.cbinsights.com/company/aisense).
  - US11431517B1 "Systems and methods for team cooperation with real-time recording and transcription of conversations and/or speeches" — קדימות 17/10/2018, ניתן 30/8/2022, **Active** עד 24/1/2040. בתיאור: סביבת עבודה צוותית עם הקלטה ותמלול בזמן אמת — [Google Patents](https://patents.google.com/patent/US11431517B1/en).
  - פטנטים נוספים:
    - 12,080,299.
    - 12,462,808 (4/11/2025) — [USPTO Official Gazette](https://patentsgazette.uspto.gov/week44/OG/html/1540-1/US12462808-20251104.html).
    - 12,236,972, הצטרפות אוטומטית לפגישות (25/2/2025) — [USPTO Official Gazette](https://patentsgazette.uspto.gov/week08/OG/html/1531-4/US12236972-20250225.html).
- **Verbit:** פטנטים על תמלול היברידי (ASR ואדם) מ־2019–2021 — [Patent Leaderboard](https://www.patentleaderboard.com/verbit-software/eric-shellef/1030301); [US10665241B1](https://www.9235.net/patent/US10665241B1.html).
- **Echo360:**
  - US7720251B2 "Embedded appliance for multimedia capture" — הוגש 23/6/2006, ניתן 18/5/2010, **Active** עד 24/10/2027. מכשיר לכידה — [Google Patents](https://patents.google.com/patent/US7720251B2/en).
  - הודעה מ־2011 על פטנט ל־SafeCapture HD — [GlobeNewswire](https://rss.globenewswire.com/news-release/2011/06/03/1108912/0/en/echo360-awarded-patent-for-safecapture-hd.html).
  - פטנטים חדשים, למשל 12,206,939 (2025) — [Justia](https://patents.justia.com/assignee/echo360-inc) (תקציר חיפוש).

### היסקים (Inferences)
- **הדפוס בפטנטים:** פלטפורמות וידאו בארה״ב סופגות תביעות NPE על פטנטים ישנים ורחבים ("query → media portion", סטרימינג, שיחות ועידה).
  - חלקן נגמרות במהירות בפשרה או במחיקה (Eureka, ‏Webcon).
  - חלקן נופלות על §101 (CoolTVNetwork).
  - ל־PWA קטן הסיכון המעשי נמוך יותר, אבל לא אפס. ‏NPE בוחר נתבעים לפי הכנסות ונראות בארה״ב.
- **הסיכון המשפטי הקרוב ביותר ללשונית הוא פרטיות, לא פטנטים.** התביעות של 2025–2026 נגד בוטי סיכום נשענות על הקלטה בלי הסכמת כל המשתתפים, ועל טביעות קול (BIPA). מכאן:
  1. לא בוט שמצטרף לפגישות.
  2. לא שומרים לאורך זמן embeddings קוליים שמזהים אדם (diarization לצורך התמליל בלבד).
  3. מעבדים רק קבצים שהמשתמש העלה בעצמו.
- **סריקה תקופתית:** ‏Desjardins, וההענקות של Zoom ושל Adobe ב־2026, מצביעים על כך שפטנטים בתחום ימשיכו להינתן. סריקה רבעונית של "chapter generation", ‏"video question answering" ו־"slide extraction" תהיה זולה ושימושית.

### פערים (Gaps)
- בתביעת Ricoh נגד Zoom לא נבדק אילו פטנטים נטענו בפועל. הדף מאחורי חומת תשלום.
- לא אומתה טענה (מוויקיפדיה, בתוצאת חיפוש) ש־Sonic Foundry חוסלה בדצמבר 2025.
- מקור מצרף אחד ציין 16 מיליון דולר לעסקת Mediasite, מול 15.5 מיליון במקורות שלמעלה. לא אומת.
- לא נמצאה התדיינות פטנטים בישראל בתחום.

## 7. קישור עמוק לזמן: Media Fragments, פרמטרי YouTube ו־IFrame API, ‏Schema.org (Clip, ‏SeekToAction, ‏HyperTocEntry), ‏Text Fragments, ‏Web Annotation, ‏EPUB CFI

### שורה תחתונה (Takeaway)
- **הבסיס לקישור לרגע:** Media Fragments בצורת `#t=start,end` — המלצת W3C מ־2012, ‏npt בשניות, טווח חצי־פתוח. ה־fragment לא נשלח לשרת, והנגן שלנו מפרש אותו בעצמו.
- **סרטון YouTube מוטמע (התנהגות בלבד):** `start` ו־`end` בשניות שלמות (הקפיצה היא לפריים מפתח קרוב), ‏`seekTo` ב־IFrame API, ובלי שכבות מעל הנגן (RMF).
- **מנועי חיפוש:** ‏`Clip` לכל השפות, או `SeekToAction` — אבל עברית לא ברשימת השפות שלו.
- **הערות על תמליל או מדיה:** ‏Web Annotation עם `FragmentSelector` לפי media-frags.
- **עיגון בתוך EPUB:** ‏EPUB CFI, כולל היסט זמני.

### ממצאים מתועדים (Cited Findings)
- **Media Fragments URI 1.0 (basic)** — המלצת W3C מ־25/9/2012 — [W3C](https://www.w3.org/TR/media-frags/):
  - `t=10,20` מסמן טווח חצי־פתוח. ברירת המחדל היא npt (שניות).
  - fragment מול query: "URI fragments are resolved from the primary resource without another retrieval action".
- **פרמטרי הנגן של YouTube** — [YouTube Player Parameters](https://developers.google.com/youtube/player_parameters):
  - `start` ו־`end` הם מספרים שלמים של שניות.
  - הנגן קופץ לפריים המפתח הקרוב, ולכן הנגינה עשויה להתחיל עד כשתי שניות לפני הזמן שביקשו.
  - `enablejsapi` ו־`origin` נדרשים לשליטה דרך ה־API.
  - `modestbranding` הוצא משימוש ב־15/8/2023.
- **IFrame API** — `seekTo(seconds, allowSeekAhead)`, מצבי נגן, ונגן בגודל מינימלי של 200×200 — [YouTube IFrame Player API](https://developers.google.com/youtube/iframe_api_reference).
- **Required Minimum Functionality** — [YouTube API Services, RMF](https://developers.google.com/youtube/terms/required-minimum-functionality):
  - "You must not display overlays… in front of any part of a YouTube embedded player".
  - "must not make changes to the YouTube player…".
- **קישור לזמן בשיתוף:** בשיתוף סרטון אפשר לסמן "Start at" — [YouTube Help](https://support.google.com/youtube/answer/57741).
- **Google Search Central — key moments** — [Video structured data](https://developers.google.com/search/docs/appearance/structured-data/video):
  - `Clip`: שדות `name`, ‏`startOffset` ו־`url`. זמין בכל השפות.
  - `SeekToAction`: תבנית `{seek_to_second_number}` בכתובת. כאן הרגעים מזוהים אוטומטית. **עברית לא מופיעה** ברשימת השפות.
  - הסרטון חייב להיות באורך 30 שניות לפחות. ‏`nosnippet` מבטל את התכונה.
- **Schema.org:**
  - `Clip` — [schema.org/Clip](https://schema.org/Clip).
  - `HyperTocEntry` — רשומת תוכן עניינים למדיה, עם `utterances` ו־`tocContinuation`. נמצא באזור "new" של Schema.org, כלומר לא יציב — [schema.org/HyperTocEntry](https://schema.org/HyperTocEntry).
- **Text Fragments** (`#:~:text=`) — דוח של WICG Community Group מ־13/12/2023, לא המלצת W3C — [WICG](https://wicg.github.io/scroll-to-text-fragment/); [MDN](https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Fragment/Text_fragments).
- **Web Annotation Data Model** — המלצת W3C מ־23/2/2017. ‏`FragmentSelector` שתואם ל־Media Fragments (למשל `t=30,60`) מעגן הערה לטווח זמן. ‏`TextQuoteSelector` מעגן הערה לציטוט בטקסט — [W3C](https://www.w3.org/TR/annotation-model/).
- **EPUB CFI** — גרסה 1.1 מ־5/1/2017, ‏ISO/IEC 23736-6:2020. כולל היסט זמני למדיה — [IDPF](https://idpf.org/epub/linking/cfi); [W3C, טיוטה](https://w3c.github.io/epub-specs/epub33/epubcfi/).
- **IIIF Presentation 3.0** — [IIIF](https://iiif.io/api/presentation/3.0/):
  - ‏Canvas עם `duration`.
  - ‏`PointSelector` עם `t`.
  - ‏`timeMode` (trim/scale/loop).
  - המוטיבציה `supplementing` מיועדת לכתוביות ולתמלילים.

### היסקים (Inferences)
- **מבנה הקישור הפנימי:** `https://studio.thesnowball.app/…/<id>#t=754.2` (שניות עשרוניות).
  - כש־`t=` נמצא ב־fragment, הוא לא משנה את הבקשה לשרת. לכן הוא לא שובר כתובות חתומות (R2), ולא מייצר החטאת מטמון.
  - הנגן מנתח את `t=` בעצמו, גם בניווט פנימי של האפליקציה.
- **סרטון YouTube:**
  - בתוך הנגן שלנו מתרגמים ל־`seekTo(754.2, true)`.
  - בקישור החוצה: `?t=754` או `start=754`, בשניות שלמות.
- **Clip ו־SeekToAction** רלוונטיים רק לדפים ציבוריים שמנועי חיפוש סורקים. הניתוחים אצלנו פרטיים, ולכן זה לא בעדיפות.
- **Web Annotation** הוא פורמט חליפין טוב להדגשות ולהערות על התמליל ועל השקופיות. במודל אחד אפשר לייצא ולייבא גם ב־Academy, שכבר מחזיקה הדגשות, וגם ב־Studio.

### פערים (Gaps)
- גרסאות הדפדפנים שתומכים ב־Text Fragments לא אומתו מול טבלת התאימות.
- לא נבדק אם Safari ב־iOS מכבד `#t=` ב־`<video>` שהמקור שלו blob או R2.

## 8. פרקים וכתוביות: WebVTT (chapters/metadata), ‏TTML/IMSC, ‏SRT, ‏HLS/DASH ופורמטי פרקים נוספים

### שורה תחתונה (Takeaway)
- **WebVTT** הוא הפורמט היחיד שמכסה את שלושת הצרכים:
  - כתוביות — `kind="subtitles"`.
  - פרקים — `kind="chapters"`: כל קיו הוא כותרת, בלי חפיפות.
  - ‏metadata — `kind="metadata"`, למשל JSON לכל שקופית.
- המפרט (CR Draft מ־20/5/2026) כולל סימוני כיוון (`&lrm;`/`&rlm;`) ו־`<lang>`.
- **SRT** — לתאימות בלבד: אין לו מפרט רשמי, ואין בו הצהרת קידוד.
- **IMSC** — רק לשידור.
- **HLS** — אין תג פרקים רשמי.
- **פורמטים נוספים לייצוא:** ‏JSON Chapters (פודקאסטים), ‏ID3 CHAP, ‏FFMETADATA ו־Matroska.

### ממצאים מתועדים (Cited Findings)
- **WebVTT** — W3C Candidate Recommendation Draft מ־20/5/2026 — [W3C](https://www.w3.org/TR/webvtt1/):
  - בקובץ פרקים, הטקסט של כל קיו הוא כותרת הפרק, והקיוים מכסים קטעי זמן בלי חפיפה.
  - בקובץ metadata הטקסט חופשי (למשל JSON).
  - מוגדרים `&lrm;` ו־`&rlm;`, ותו בידוד אפשר לכתוב כ־`&#x2068;` / `&#x2069;`.
  - יש תג `<lang>` לשפה בתוך קיו.
- **MDN על `<track>`:** הסוגים הם subtitles, ‏captions, ‏chapters ו־metadata. ‏"Chapter titles are intended to be used when the user is navigating the media resource" — [MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/track).
- **IMSC 1.2 (TTML)** — המלצת W3C מ־4/8/2020. בפרופיל הטקסט מותרים `tts:direction` ו־`tts:unicodeBidi` — [W3C](https://www.w3.org/TR/ttml-imsc1.2/).
- **HLS:**
  - ה־HLS Authoring Specification של Apple מתירה כתוביות ב־WebVTT או ב־IMSC1, ולא מגדירה פרקים — [Apple Developer](https://developer.apple.com/documentation/http-live-streaming/hls-authoring-specification-for-apple-devices).
  - בטיוטה rfc8216bis-22 (1/5/2026) יש `EXT-X-SESSION-DATA` ו־`EXT-X-DATERANGE`, אבל אין DATA-ID מוגדר לפרקים — [IETF Datatracker](https://datatracker.ietf.org/doc/html/draft-pantos-hls-rfc8216bis).
- **SRT** — אין מפרט רשמי. ברירת המחדל ההיסטורית של הקידוד היא Windows-1252 — [Library of Congress, FDD](https://www.loc.gov/preservation/digital/formats/fdd/fdd000569.shtml).
- **פורמטי פרקים נוספים:**
  - **JSON Chapters 1.2 (Podcasting 2.0)** — סוג MIME ‏`application/json+chapters` — [Podcast Index](https://github.com/Podcastindex-org/podcast-namespace/blob/main/docs/examples/chapters/jsonChapters.md).
  - **ID3v2 Chapters 1.0** — מסגרות CHAP ו־CTOC לפרקים בקובצי שמע (2/12/2005) — [id3.org](https://id3.org/id3v2-chapters-1.0).
  - **FFMETADATA** — ffmpeg קורא ומטמיע פרקים (`[CHAPTER]` עם TIMEBASE, ‏START, ‏END ו־title) — [FFmpeg, metadata.texi](https://raw.githubusercontent.com/FFmpeg/FFmpeg/master/doc/metadata.texi).
  - **Matroska** — מבנה Chapters/EditionEntry/ChapterAtom — [Matroska](https://www.matroska.org/technical/chapters.html).
- **נגנים:** ‏Video.js תומך בחמשת הסוגים — [Video.js Guides](https://legacy.videojs.org/guides/text-tracks):
  - "Timed text requires a text file in WebVTT format".
  - "For chapters, `default` is required if you want the chapters menu to show".

### היסקים (Inferences)
- **מקור אמת אחד, הרבה ייצואים.** שומרים מבנה פנימי של פרקים, קיוים ו־metadata של שקופיות, ומפיקים ממנו:
  - WebVTT (כתוביות, פרקים, metadata) לנגן שלנו.
  - SRT ב־UTF-8 לתאימות.
  - FFMETADATA להטמעת פרקים ב־MP4 שמורד.
  - JSON Chapters למי שמפרסם כפודקאסט.
  - טקסט בצורה "00:00 כותרת", למשתמש שמעלה את הסרטון בעצמו.
- **גלריית השקופיות מסתנכרנת לנגן** דרך track מסוג metadata: קיו לכל שקופית, עם JSON (מזהה, טקסט OCR). כך הנגן יודע איזו שקופית "פעילה" בלי לוגיקה כפולה.
- **עברית ב־WebVTT:** לבודד מספרים, מילים באנגלית וטווחי זמן בתוך קיו, עם `&lrm;` או עם תווי בידוד (סעיף 12).
- **HLS ו־DASH:** אין צורך בפרקים בתוך המניפסט. מספיק track נפרד של WebVTT.

### פערים (Gaps)
- לא נמצא מקור על פרקים ב־DASH.
- לא נבדק אילו דפדפנים מציגים פרקים בבקרות המקוריות שלהם.
- לא נבדק התיעוד של ספריות נגן נוספות, למשל רכיב סרגל הזמן של Media Chrome — השליפה לא הושלמה.

## 9. טקסט מסונכרן במסמכים: EPUB 3 Media Overlays, ‏DAISY, ‏Readium, ‏foliate-js, ‏Apple Books, ‏Thorium, וקישור מ־EPUB לנגן חיצוני

### שורה תחתונה (Takeaway)
- **EPUB 3 Media Overlays מסנכרן רק שמע.** ב־EPUB 3.3: "supports only synchronizing audio media", ו־`par` מכיל טקסט אחד ולכל היותר שמע אחד. וידאו מסונכרן בתוך EPUB לא מתוקנן.
- **foliate-js שלנו** (commit ‏`78914ae`) כולל מחלקה `MediaOverlay` לשמע בלבד. היא טוענת את השמע מתוך הספר כ־Blob. ‏Academy לא מחברת אותה היום.
- **ה־CSP של Academy חוסם** וידאו או שמע מכתובת חיצונית, וגם הטמעת YouTube בתוך ספר.
- **ההמלצה:** ספר ניתוח ב־EPUB 3.3 עם קישורים רגילים לנגן של Studio (`#t=`). ‏foliate-js פותח קישור חיצוני בחלון חדש כברירת מחדל, ושולח אירוע `external-link` שאפשר ליירט.
- **אופציונלי:** Media Overlays עם קטעי שמע מההרצאה.

### ממצאים מתועדים (Cited Findings)
- **EPUB 3.3** — המלצת W3C, הגרסה מ־13/1/2026 — [W3C](https://www.w3.org/TR/epub-33/):
  - ‏Media Overlays "supports only synchronizing audio media". הוא מבוסס על תת־קבוצה של SMIL 3.0.
  - `par` מכיל `text` אחד ו־`audio` אחד לכל היותר.
  - `media:duration` חייב להתאים לסכום הקליפים, בסבולת של ±1 שנייה.
  - מותר להפנות למשאבי שמע ווידאו מרוחקים.
- **EPUB 3.4** — ‏Candidate Recommendation Draft מ־2/11/2026. מוסיף AVIF, ‏JPEG XL ו־Opus — [W3C](https://www.w3.org/TR/epub-34/).
- **foliate-js upstream** — [GitHub](https://github.com/johnfactotum/foliate-js); [epub.js](https://raw.githubusercontent.com/johnfactotum/foliate-js/main/epub.js); [view.js](https://raw.githubusercontent.com/johnfactotum/foliate-js/main/view.js):
  - ה־README לא מזכיר Media Overlays, אבל בקוד יש מחלקה `MediaOverlay` לשמע.
  - לפי ה־README, תוכן EPUB עם סקריפטים לא נתמך.
  - מודול ה־TTS לא מפיק דיבור בעצמו, אלא מחזיר SSML לסינתיסייזר.
- **foliate-js אצלנו** — `vendor/foliate-js`, ‏commit ‏`78914aef` — [ריפו](https://github.com/yishaiguedj1/portfolio-pwa/tree/main/vendor/foliate-js). בדיקה מקומית:
  - **epub.js, שורות 395–455:** ‏`class MediaOverlay` עובר על אלמנטי `par` ב־SMIL ולוקח `text` ו־`audio` עם `clipBegin`/`clipEnd`. השמע נטען מתוך הספר (`URL.createObjectURL(await this.book.loadBlob(src))`) ומנוגן ב־`new Audio(url)`. כלומר: שמע בלבד, ורק מתוך ה־EPUB.
  - **view.js, שורות 270–290:** מכין overlay עם `activeClass`. ב־591 נמצא `startMediaOverlay()`.
  - **view.js, שורה 279:** ‏`.find(x => x.index = resolved.index)` — השמה במקום השוואה. כנראה באג, וקיים גם ב־upstream.
  - **view.js, שורות 359–361:** קישור חיצוני שולח `external-link`. אם האירוע לא בוטל, נקרא `globalThis.open(href, '_blank')`.
  - **paginator.js, שורה 244, ו־fixed-layout.js, שורה 86:** ה־iframe של הספר מקבל `sandbox="allow-same-origin allow-scripts"`.
  - **library.js:** ‏grep לא מוצא שימוש ב־`mediaOverlay`, ב־`startMediaOverlay` או ב־`external-link`.
  - **עוד בתיקייה:** `epubcfi.js` (תמיכה ב־CFI).
- **ה־CSP של Academy** (`academy.html`, בדיקה מקומית):
  - `media-src 'self' blob:`.
  - `frame-src` מתיר רק `blob:` ואת שירותי ההתחברות של Firebase ו־Google.
  - `script-src` מתיר את `'self'`, ‏hashes ושני דומיינים של Google, בלי `blob:`.
- **DAISY** — ספרים מדברים עם טקסט מסונכרן — [DAISY Consortium](https://daisy.org/activities/standards/daisy/).
- **Readium Guided Navigation** — פורמט JSON ‏(`application/guided-navigation+json`) לניווט מונחה, שיש בו גם הפניה לווידאו (`videoref`). זה מסמך של Readium, לא המלצת W3C — [Readium](https://readium.org/guided-navigation).
- **Apple Books:**
  - לפי מדריך הנכסים, Media Overlays "supported only in fixed-layout books". ההדגשה יכולה להיות לפי מילה, לפי משפט, או בלי הדגשה — [Apple Books Asset Guide](https://help.apple.com/itc/booksassetguide/en.lproj/itc6db639756.html).
  - פוסט של משתמש בפורום המפתחים של Apple טוען ש־Thorium Reader תומך ב־Media Overlays גם בספר reflowable, ו־Apple Books רק ב־pre-paginated. זה מקור חלש — [Apple Developer Forums](https://developer.apple.com/forums/thread/772291).
- **Thorium Reader:** לא נמצא תיעוד רשמי של התמיכה ב־Media Overlays. הערות הגרסה v3.1.0 הופיעו בתוצאות חיפוש ולא נשלפו — [newreleases.io](https://newreleases.io/project/github/edrlab/thorium-reader/release/v3.1.0).
- **מחקר:** ‏Calliope (arXiv 2602.10735, ‏11/2/2026) מייצר ספרים מוקראים בפורמט "EPUB 3 Media Overlay". לפי המאמר, יישור כפוי (forced alignment) "introduces drift between the audio and text highlighting" — [arXiv](https://arxiv.org/abs/2602.10735).
  - **סתירה:** תקציר חיפוש קשר את המאמר ל־Thorium, אבל בתקציר שנשלף אין אזכור של קורא ספציפי.

### היסקים (Inferences)
- **"ייצוא לקורא שלנו" = EPUB 3.3 רגיל (reflowable):**
  - פרק לכל פרק בהרצאה.
  - תמונות השקופיות ארוזות בתוך הספר.
  - לכל נקודה קישור `<a href="https://studio.thesnowball.app/…#t=…">`.
  - ב־Academy: ליירט את `external-link` ולפתוח את הנגן של Studio בתוך המערכת, במקום כרטיסייה חדשה.
  - להחזרת מיקום והדגשות: ‏EPUB CFI ‏(`epubcfi.js` כבר קיים) או Web Annotation.
- **EPUB מתיר שמע ווידאו מרוחקים, אבל ה־CSP של Academy חוסם אותם.** ספר עם `<video src="https://…">` לא יתנגן ב־Academy. הדרך הנכונה היא קישור החוצה, לא הטמעה. שינוי CSP דורש עדכון בכל הדפים.
- **בנוגע לסקריפטים:** ‏CSP3 קובע שמסמך blob יורש את המדיניות של המסמך שיצר אותו. לכן ה־`script-src` של Academy (בלי `blob:`) כנראה חוסם סקריפטים בתוך הספר. זה מתיישב עם ה־README של foliate-js. (היסק: מפרט CSP3 לא נשלף.)
- **Media Overlays עם שמע ההרצאה — אפשרי ותקני,** עם `clipBegin`/`clipEnd` על קובץ שמע שארוז בספר. המחירים:
  - הספר גדל.
  - צריך לחבר את `startMediaOverlay` ב־Academy ולתקן את באג ההשמה.
  - ב־Apple Books זה יעבוד רק ב־fixed-layout.
- **וידאו מסונכרן בתוך EPUB לא מתוקנן.** הדרך התקנית היא קישור החוצה. ‏Readium Guided Navigation מתאר `videoref`, אבל לא נמצא סימן שהוא נתמך ב־foliate-js.

### פערים (Gaps)
- לא אומת מה Thorium תומך בפועל — אין תיעוד רשמי.
- לא נבדק מימוש כלשהו של Readium Guided Navigation.
- לא נבדק אם הקורא של Academy מכבד `media:active-class` מתוך ספר שאנחנו מייצרים.

## 10. ייצוא: Markdown, ‏Anki, ‏OPML/FreeMind/Mermaid/JSON Canvas, ‏DOCX עם RTL, ‏PDF/UA לעברית, ‏Notion, ‏Obsidian

### שורה תחתונה (Takeaway)
- **Markdown:** ‏CommonMark 0.31.2, עם קישורי זמן כ־URL רגילים. ‏Obsidian לא מרנדר Markdown בתוך HTML, ולכן עטיפה ב־`<div dir="rtl">` שוברת את העיצוב שבפנים.
- **Anki — שני מסלולים:**
  1. קובץ טקסט עם כותרות ייבוא (`#separator`, ‏`#html`, ‏`#guid column`). הכי פשוט, ומאפשר עדכון חוזר.
  2. ‏`.apkg` דרך genanki ‏(MIT), עם מדיה. ‏Image Occlusion (מ־23.10) מתאים לשקופיות. בלי iframe — היה תיקון אבטחה ב־26.09.4.
- **מפות חשיבה:** ‏Mermaid ‏`mindmap` ו־JSON Canvas 1.0. ל־OPML ול־FreeMind לא נמצאו מקורות.
- **DOCX בעברית:** ‏`w:bidi` בפסקה ו־`w:rtl` בריצה. בספריית docx ב־npm: ‏`bidirectional`, ‏`rightToLeft` ו־`*ComplexScript`.
- **PDF:** ‏Chromium ו־Puppeteer מייצרים PDF מתויג כברירת מחדל (‏`outline` כבוי כברירת מחדל). היעד: PDF/UA-1, עם סדר לוגי לעברית.
- **Notion:** ייבוא Markdown, ‏DOCX או HTML (עד 5MB לקובץ בחינם), או API עם בלוק `video`.

### ממצאים מתועדים (Cited Findings)
**Markdown ו־Obsidian**
- **CommonMark 0.31.2** (28/1/2024) — [CommonMark](https://spec.commonmark.org/).
- **Obsidian Flavored Markdown:** ‏wikilinks, ‏callouts ו־embeds. ‏Markdown בתוך בלוק HTML לא מרונדר — [Obsidian Help](https://obsidian.md/help/Editing+and+formatting/Obsidian+Flavored+Markdown).
- **Media Extended:** תוסף שמאפשר קישורי זמן לווידאו בתוך Obsidian — [Obsidian Community Plugins](https://community.obsidian.md/plugins/media-extended).
- **JSON Canvas 1.0** (11/3/2024): פורמט פתוח של צמתים וקשתות לקנבס — [jsoncanvas.org](https://jsoncanvas.org/spec/1.0/).

**Notion** — [Notion Help, Import](https://www.notion.com/help/import-data-into-notion)
- **ייבוא:** ‏Markdown, ‏Word, ‏HTML, ‏CSV ו־PDF.
- **גודל קובץ:** 5MB בחינם ו־50MB בתשלום. ל־PDF: ‏5MB בחינם ו־20MB בתשלום.
- **ZIP:** יכול לכלול גם EPUB ו־OPML.
- **קישורים:** קישורי עוגן ("Anchor links") לא מיובאים נקי.
- **API** — [Notion API, Block](https://developers.notion.com/reference/block):
  - בלוק `video` מקבל קישור לקובץ (mp4, ‏mov ועוד), או קישור YouTube עם "embed" או "watch".
  - בגרסת ה־API מ־2026-03-11 השדה `transcription` שונה ל־`meeting_notes`.

**מפות חשיבה**
- **Mermaid** ‏`mindmap` — היררכיה לפי הזחה — [Mermaid](https://mermaid.js.org/syntax/mindmap.html).
- **OPML** — דף המפרט ב־opml.org החזיר רק ניווט וקישור ל־"OPML 2.0 spec", בלי תוכן — [opml.org](https://opml.org/spec2.opml).
- **FreeMind** — הדף החזיר 403.

**Anki**
- **קובצי טקסט** — [Anki Manual, Text Files](https://docs.ankiweb.net/importing/text-files.html):
  - כותרות ייבוא (מגרסה 2.1.54): `#separator`, ‏`#html`, ‏`#notetype`, ‏`#deck`, ‏`#tags column` ו־`#guid column`.
  - עמודת GUID מאפשרת לעדכן הערה קיימת במקום לשכפל אותה.
- **ייצוא חבילות** ותאימות לגרסאות ישנות — [Anki Manual, Exporting](https://docs.ankiweb.net/exporting.html).
- **פורמטי המסד בחבילה:** `collection.anki2` (ישן), ‏`collection.anki21` ו־`collection.anki21b` (‏zstd) — [Anki source, meta.rs](https://raw.githubusercontent.com/ankitects/anki/main/rslib/src/import_export/package/meta.rs).
- **מבנה המסד:** השדות מופרדים בתו 0x1f, ו־`csum` משמש לזיהוי כפילויות — [AnkiDroid Wiki](https://github.com/ankidroid/Anki-Android/wiki/Database-Structure).
- **Image Occlusion** מובנה מגרסה 23.10 — [Anki Manual, Editing](https://docs.ankiweb.net/editing.html).
- **Anki 26.09.4** (4/11/2026) — עדכון אבטחה — [Anki Releases](https://github.com/ankitects/anki/releases/latest):
  - חבילות משותפות יכלו להריץ קוד דרך iframe בעורך (GHSA-j9v5-m549-cg6c).
  - ב־macOS יכלו להריץ פקודות דרך שמות קבצים של תמונות.
- **genanki** ‏(MIT) — ספריית Python ליצירת `.apkg` — [GitHub](https://github.com/kerrickstaley/genanki).
- **CrowdAnki** — ייצוא וייבוא של חבילות ב־JSON, לשיתוף דרך git — [GitHub](https://github.com/Stvad/CrowdAnki).

**DOCX**
- `w:bidi` — מאפיין פסקה מימין לשמאל — [Microsoft Learn](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.wordprocessing.bidi).
- `w:rtl` — מאפיין ריצה מימין לשמאל (ECMA-376) — [docx4java, ECMA-376](https://webapp.docx4java.org/OnlineDemo/ecma376/WordML/rtl.html).
- **ספריית docx ב־npm:**
  - `bidirectional` לפסקה — [paragraph/properties.ts](https://raw.githubusercontent.com/dolanmiu/docx/master/src/file/paragraph/properties.ts).
  - `rightToLeft`, ‏`boldComplexScript` ו־`sizeComplexScript` לריצה — [run/properties.ts](https://raw.githubusercontent.com/dolanmiu/docx/master/src/file/paragraph/run/properties.ts).
  - דיון פתוח על RTL — [docx issue #3419](https://github.com/dolanmiu/docx/issues/3419).

**PDF**
- **PDF/UA-2** ‏(ISO 14289-2:2024): פורסם במרץ 2024, מבוסס PDF 2.0, ולא מחליף את PDF/UA-1. לפי ההודעה, זמין בחינם מאוגוסט 2024 — [PR Newswire, PDF Association](https://prnewswire.com/news-releases/the-pdf-associations-specification-for-reuse-and-accessibility-is-now-an-iso-standard-302104750.html).
- **Puppeteer** ‏`page.pdf()`: ‏`tagged` כברירת מחדל true, ו־`outline` כברירת מחדל false — [Puppeteer, PDFOptions](https://pptr.dev/api/puppeteer.pdfoptions).
- **Chrome 85** הוסיף יצירה של PDF מתויג — [Search Engine Journal](https://www.searchenginejournal.com/chrome-85-tagged-pdf/376157/).
- **WeasyPrint** — תמיכה ניסיונית ב־`pdf/ua-1` — [pandoc.org, דוגמה](https://pandoc.org/demo/example33/19.3-weasyprint.html).
- **עברית ב־PDF:** כשהטקסט נשמר בסדר חזותי, העתקה וקורא מסך מקבלים סדר הפוך. הפתרון: סדר לוגי, או `ActualText` — [pdf_oxide, bidi.rs](https://docs.rs/crate/pdf_oxide/0.3.57/source/src/text/bidi.rs); [PDF Association, PDFest 2020 — complex scripts](https://pdfa.org/wp-content/uploads/2020/06/OctoberPDFest-2020-Support-of-complex-scripts-in-PDF-Alexey-Subach.pdf).

### היסקים (Inferences)
- **Markdown:** קישור זמן נכתב כ־`[12:34](https://…#t=754)`. לא עוטפים ב־HTML עם `dir`, כי זה שובר את Obsidian. ב־Notion הקישורים האלה הם כתובות חיצוניות, לא עוגנים, ולכן אמורים לשרוד ייבוא. (היסק — לא נבדק.)
- **Anki — בשני שלבים:**
  1. קובץ טקסט עם `#guid column`. ‏GUID יציב לכל כרטיס (למשל hash של מזהה הניתוח ומזהה הכרטיס) מאפשר לייצא שוב בלי כפילויות.
  2. ‏`.apkg` בשרת דרך genanki, עם תמונות של שקופיות. כרטיס Image Occlusion על שקופית מתאים במיוחד להרצאות.

  ובשני השלבים: בלי iframe ובלי סקריפט בכרטיסים. קישור זמן = `<a href>` רגיל.
- **DOCX:** ספריית docx עם `bidirectional: true` ו־`rightToLeft: true`, וגופן עברי שמוגדר גם ל־complex script.
- **PDF:** יוצרים בשרת דרך Chromium עם `tagged: true` ו־`outline: true`, ובודקים בכלי ולידציה ל־PDF/UA. (לא נבדק כמה זה מצליח עם עברית.)
- **Notion:** קודם קובץ Markdown או DOCX שהמשתמש מייבא בעצמו. ה־API דורש OAuth ושירות נוסף — לא לשלב הראשון.

### פערים (Gaps)
- המפרטים של OPML 2.0 ושל FreeMind לא נשלפו.
- לא נבדק RTL ב־Mermaid ‏`mindmap` ובקנבס של JSON Canvas.
- לא נבדק בפועל עד כמה Chromium מגיע ל־PDF/UA-1 עם טקסט עברי.
- סכמות JSON של אפליקציות פתקים אחרות (מעבר ל־Notion, ‏JSON Canvas ו־CrowdAnki) לא נבדקו.

## 11. תקני למידה: xAPI, ‏cmi5, ‏LTI 1.3, ‏QTI 3.0, ‏Common Cartridge — האם לייצא QTI או להתחבר ב־LTI

### שורה תחתונה (Takeaway)
- **LTI 1.3 לא משתלם ללשונית שלנו** (PWA אישי, לא מערכת לניהול למידה). הוא דורש OIDC ו־JWT, רישום מול כל LMS, ואבטחה של כלי חיצוני.
- **QTI 3.0 עוד לא נתמך ב־Canvas**, ו־Moodle ממליץ על Moodle XML. לכן ייצוא מבחנים יעיל הוא:
  - **Moodle XML**.
  - **GIFT**.
  - אולי **QTI 1.2** ל־Canvas.
- **Common Cartridge 1.4** עדיין "Candidate Final".
- **xAPI** ‏(IEEE 9274.1.1-2023, ‏ISO/IEC/IEEE 39274-1-1:2025) ופרופיל הווידאו שלו (played, ‏paused, ‏seeked, ‏played-segments) — מודל טוב לרישום פנימי של התקדמות צפייה, בלי LRS חיצוני.

### ממצאים מתועדים (Cited Findings)
- **xAPI** — ‏IEEE 9274.1.1-2023, פורסם 6/10/2023. אומץ כ־ISO/IEC/IEEE 39274-1-1:2025 — [IEEE SA](https://standards.ieee.org/ieee/9274.1.1/7321/).
- **xAPI Video Profile** v1.0.2 — [ADL, video.jsonld](https://raw.githubusercontent.com/adlnet/xapi-authored-profiles/master/video/video.jsonld):
  - פעלים: played, ‏paused, ‏seeked ועוד.
  - הרחבות: time, ‏time-from, ‏time-to, ‏progress, ‏played-segments ו־length.
- **cmi5** — מהדורת Quartz (יוני 2016). פרופיל xAPI להפעלת תוכן מתוך LMS — [AICC, cmi5](https://aicc.github.io/CMI-5_Spec_Current/).
- **LTI 1.3** — 16/4/2019, מבוסס OIDC ו־JWT — [1EdTech](https://www.imsglobal.org/spec/lti/v1p3).
- **QTI 3.0** — 11/5/2022. ההסמכות ל־QTI 2.1 פגו בסוף 2024 — [1EdTech](https://www.1edtech.org/standards/qti/index).
- **Common Cartridge 1.4** — "Candidate Final", כולל QTI 3 ו־OpenVideo — [1EdTech](https://www.1edtech.org/standards/cc).
- **Moodle 5.3** — ייבוא שאלות: Moodle XML (המומלץ), ‏GIFT, ‏Aiken ועוד — [MoodleDocs](https://docs.moodle.org/en/Import_questions).
- **Canvas** — ייבוא QTI 1.2 ו־2.x; ‏QTI 3 לא מופיע — [Canvas Community](https://community.canvaslms.com/docs/DOC-2868); [Canvas Community](https://community.canvaslms.com/docs/DOC-26303).
- **H5P Interactive Video** — שאלות שמשובצות בנקודות זמן בתוך וידאו (חבילת ‏.h5p) — [H5P](https://h5p.org/interactive-video).

### היסקים (Inferences)
- **ייצוא מבחנים בפורמטים טקסטואליים פשוטים** מכסה את רוב המרצים:
  - Moodle XML — כולל משוב ותמונות.
  - GIFT — טקסט קריא.
  - QTI 1.2 ב־ZIP ל־Canvas — רק אם יש ביקוש.
  - QTI 3.0 — כשתהיה תמיכה רחבה.
- **xAPI כמודל, לא כאינטגרציה.** אם שומרים באפליקציה "מקטעים שנצפו" עם אותה סמנטיקה של played-segments, ייצוא עתידי ל־LRS יהיה פשוט.
- **H5P Interactive Video** ("מבחן בתוך הווידאו") הוא כיוון ייצוא מעניין, אבל מורכב. לא בשלב הראשון.

### פערים (Gaps)
- לא נבדק באילו גרסאות Moodle משתמשים המוסדות בישראל.
- לא נבדקה התמיכה של Blackboard ושל D2L ב־QTI 3.

## 12. נגישות ו־RTL: WCAG 2.2, ‏ARIA לתמליל ולנגן, ‏Unicode Bidi, ‏CSS Logical — ומה מחייב בישראל

### שורה תחתונה (Takeaway)
- **בישראל החובה החוקית היא IS 5568** — מבוסס WCAG 2.0 AA, בתוקף מאוקטובר 2017.
- **היעד המקצועי הוא WCAG 2.2 AA** — ‏ISO/IEC 40500:2025, ו־EN 301 549 V4.1.1 מ־2026.
- **וידאו:**
  - כתוביות (1.2.2).
  - תיאור שמע או חלופת מדיה (1.2.3/1.2.5).
  - תמליל — רצוי "descriptive transcript" מתחת לנגן.
- **נגן:**
  - slider לפי APG: ‏`aria-valuetext` בניסוח של זמן, ו־Page Up/Down = ‏15 צעדים.
  - יעדי מגע בגודל 24×24 לפחות (2.5.8).
  - חלופה לגרירה (2.5.7).
- **RTL:**
  - לבודד חותמות זמן ותוויות באנגלית.
  - ‏U+2013 (en dash) נייטרלי (ON). לכן טווח "12:30–14:05" מתהפך בהקשר עברי, ואילו מקף ASCII ‏(ES) לא מתהפך.
  - CSS Logical בכל מקום.

### ממצאים מתועדים (Cited Findings)
- **WCAG 2.2** — המלצת W3C, הגרסה מ־12/12/2024 — [W3C](https://www.w3.org/TR/WCAG22/):
  - **מדיה מבוססת זמן:**
    - 1.2.1 Audio-only and Video-only (Prerecorded) — A.
    - 1.2.2 Captions (Prerecorded) — A.
    - 1.2.3 Audio Description or Media Alternative (Prerecorded) — A.
    - 1.2.4 Captions (Live) — AA.
    - 1.2.5 Audio Description (Prerecorded) — AA.
    - 1.2.6–1.2.9 — AAA.
  - **חדש ב־2.2 ורלוונטי לנגן:**
    - 2.4.11 Focus Not Obscured (Minimum) — AA.
    - 2.5.7 Dragging Movements — AA.
    - 2.5.8 Target Size (Minimum) — AA, ‏24×24 פיקסלי CSS.
- **WCAG 2.2 אומץ כ־ISO/IEC 40500:2025** — הודעת W3C מ־21/10/2025 — [W3C WAI](https://www.w3.org/WAI/news/2025-10-21/wcag22-iso).
- **EN 301 549 V4.1.1** — פורסם 2/9/2026, ומאמץ את WCAG 2.2 AA. ציטוט ב־OJEU צפוי בסביבות 30/11/2026 — [Deque](https://www.deque.com/fr/blog/en-301-549-v4-1-1-is-final-what-changed-what-it-means-and-what-you-should-do/).
  - **סתירה:** לפי DWT, התקן אומץ ב־24/8/2026 — [DWT](https://www.dwt.com/insights/2026/09/european-accessibility-act-ict-standards-update).
- **ישראל — IS 5568:** מבוסס WCAG 2.0 AA, בתוקף מאוקטובר 2017. פיצוי של עד 50 אלף ₪ — [BOIA](https://www.boia.org/blog/israels-digital-accessibility-laws-an-overview) (מקור משני).
  - יש טענות סותרות על עדכון התקן לגרסה חדשה של WCAG — [user-a](https://user-a.co.il/en/standards/israeli-accessibility-standards-vs-wcag).
- **W3C WAI — Transcripts** (17/9/2024) — [W3C WAI](https://www.w3.org/WAI/media/av/transcripts/):
  - תמליל הוא "a text version of the speech and non-speech audio information needed to understand the content".
  - "Transcripts should include important visual information". צריך גם זיהוי דוברים וטקסט שמופיע בווידאו.
  - מיקום: "put the transcript itself or a link to the transcript right under the video".
  - "Descriptive transcripts are required to provide video content to people who are both Deaf and blind".
- **APG — Media Seek Slider** — [W3C APG](https://www.w3.org/WAI/ARIA/apg/patterns/slider/examples/slider-seek/):
  - `role="slider"`, ‏`aria-valuemin`/`aria-valuemax`/`aria-valuenow`, ו־`aria-valuetext` בניסוח של זמן. דוגמה: 243 שניות מוקראות "4 minutes, 3 seconds".
  - מקלדת: חצים = צעד אחד; Page Up/Down = ‏15 צעדים; Home/End = התחלה וסוף.
  - האורך הכולל מוקרא באתחול ובפוקוס, ולא בכל שינוי, כדי למנוע חזרות. בדף עצמו יש סתירה פנימית: "receives" או "loses" focus.
- **MAUR — Media Accessibility User Requirements** (W3C Working Group Note, ‏3/12/2015) — [W3C](https://www.w3.org/TR/media-accessibility-reqs/):
  - CN-1–CN-10: ניווט לפי מבנה, כמו "track" של תוכן עניינים, עם גישה ישירה דרך URI (CN-6).
  - T-1–T-3: תמליל מלא במשאב נפרד ומקושר, בתצוגה גוללת או סטטית ליד הווידאו או מתחתיו.
  - TSM-1–TSM-5: מהירות 50%–250% בלי שינוי גובה צליל, ואיפוס ל־100%.
- **Unicode Bidi — UAX #9** (גרסה 52, ‏Unicode 18.0, ‏1/9/2026), כולל הכללים W4 ו־N1 — [Unicode](https://www.unicode.org/reports/tr9/):
  - U+002D (hyphen-minus) הוא ES — [FileFormat, U+002D](https://www.fileformat.info/info/unicode/char/002d/index.htm).
  - U+2013 (en dash) הוא ON — [FileFormat, U+2013](https://www.fileformat.info/info/unicode/char/2013/index.htm).
- **W3C i18n:** בידוד בעזרת `dir` ו־`<bdi>` עדיף על תווי בקרה, כשאפשר — [W3C Internationalization](https://www.w3.org/International/articles/inline-bidi-markup/).
- **CSS Logical Properties and Values Level 1** — ‏Working Draft מ־4/12/2025 — [W3C](https://www.w3.org/TR/css-logical-1/).
- **Hebrew Gap Analysis** (Group Draft Note, ‏31/5/2025) — [W3C](https://www.w3.org/TR/hebr-gap/):
  - #26 "Logical CSS shorthands needed" — פתוח, בעדיפות he 1.
  - #30 ‏(`:dir`) ו־#27 ‏(`dirname`) — מסומנים כתוקנו.

### היסקים (Inferences)
- **למה טווח זמנים מתהפך:**
  - לפי W4, ‏ES בודד בין שני מספרים אירופיים הופך למספר. לכן `12:30-14:05` עם מקף ASCII נשאר רצף LTR אחד (גם `:`, ‏CS בודד, נבלע).
  - en dash הוא ON. לפי N1, מספרים נחשבים R לצורך נייטרלים, ולכן בפסקה עברית ה־ON נפתר ל־R. הטווח מוצג הפוך: "14:05–12:30".
  - **מסקנה:** כל טווח זמנים — בתוך `<bdi dir="ltr">` או `<span dir="ltr">`. בקבצי טקסט (VTT, ‏SRT, ‏Markdown, ‏CSV ל־Anki): תווי בידוד (U+2066 LRI … U+2069 PDI), או מקף ASCII.
- **תמליל אינטראקטיבי נגיש** (היסק שמשלב את WAI ואת APG; אין דפוס APG ייעודי):
  - רשימה של קיוים. כל קיו הוא `<button>` או `<a href="#t=…">`, עם חותמת זמן גלויה.
  - הקיו הפעיל מסומן ב־`aria-current="true"` ובסגנון.
  - **בלי** `aria-live` על כל החלפת קיו — זה מציף את קורא המסך.
  - גלילה אוטומטית שאפשר לכבות (2.2.2 Pause, Stop, Hide חל על תוכן שזז אוטומטית).
  - התמליל מתחת לנגן, או קישור אליו מתחת לנגן (WAI).
- **סרגל הזמן:**
  - slider לפי APG, עם `aria-valuetext` בעברית ("4 דקות ו־3 שניות מתוך 52 דקות").
  - Page Up/Down לקפיצה גדולה.
  - לחיצה על המסילה כחלופה לגרירה (2.5.7).
  - סימוני פרקים על הסרגל — רכיבים נגישים בפני עצמם, לא רק צבע (1.4.1).
- **מהירות ניגון** 0.5×–2.5× עם שמירה על גובה הצליל (MAUR ‏TSM) — `playbackRate` עם `preservesPitch`.
- **תאימות לחוק:** ‏IS 5568 ‏(WCAG 2.0 AA) הוא הרצפה. ‏WCAG 2.2 AA מכסה אותו ועוד, ולכן מספיק לכוון ליעד אחד.

### פערים (Gaps)
- הנוסח העדכני של התקנות הישראליות לא נבדק — רק מקורות משניים. יש סתירה לגבי עדכון IS 5568.
- אין דפוס APG ייעודי לתמליל אינטראקטיבי. ההמלצה למעלה היא היסק.

## 13. סיכום מעשי ללשונית — סיכון IP לפי יכולת, ותקן מומלץ לכל יכולת

### שורה תחתונה (Takeaway)
רוב היכולות בלשונית יושבות על אמנות קודמת שפקעה או על תקנים פתוחים, ולכן הסיכון בהן נמוך.

שלוש נקודות דורשות זהירות בעיצוב:
1. **פרקים ורגעי מפתח** — Google, ‏Zoom, ‏Adobe ו־Gong, עם פטנטים מ־2023–2026.
2. **שאלות ותשובות שמשוקללות לפי נקודת הצפייה** — CurioXR.
3. **שכבות משולבות:** "הערות שקופצות בזמן הניגון" (3Play) ו"חוברת לימוד מותאמת אישית" (HP).

הסיכון המשפטי הדחוף יותר הוא בכלל פרטיות: לא בוט שמקליט פגישות של אחרים, ולא שומרים טביעות קול.

הייצוא:
- WebVTT כמקור אמת לזמנים, ו־`#t=` לקישורים.
- EPUB 3.3 עם קישורים (Media Overlays — שמע בלבד).
- Anki: קודם קובץ טקסט עם GUID, אחר כך apkg.
- DOCX עם `w:bidi`, ‏PDF מתויג, ‏Moodle XML ו־GIFT.
- בלי LTI ובלי QTI 3 בשלב הזה.

### ממצאים מתועדים (Cited Findings)
הטבלאות נשענות על הממצאים בסעיפים 1–12. העיקריים:
- **HP:** [US10007848B2](https://patents.google.com/patent/US10007848B2/en).
- **3Play:** [US8930308B1](https://patents.google.com/patent/US8930308B1/en).
- **IBM:** [US12131115B2](https://patents.google.com/patent/US12131115B2/en).
- **Google:** [US11823716B2](https://patents.google.com/patent/US11823716B2/en); [US11720793B2](https://patents.google.com/patent/US11720793B2/en).
- **Zoom:** [US12646506B2](https://patents.google.com/patent/US12646506B2/en); [US12664798B2](https://patents.google.com/patent/US12664798B2/en).
- **Adobe:** [US12580003B1](https://patents.google.com/patent/US12580003B1/en).
- **Gong:** [US10642889B2](https://patents.google.com/patent/US10642889B2/en).
- **CurioXR:** [US12524465B2](https://patents.google.com/patent/US12524465B2/en).
- **אמנות קודמת שפקעה:** [US6646655B1](https://patents.google.com/patent/US6646655B1/en); [US8280158B2](https://patents.google.com/patent/US8280158B2/en); [US5835667A](https://patents.google.com/patent/US5835667A/en); [US6311189B1](https://patents.google.com/patent/US6311189B1/en).
- **תקנים:** [Media Fragments](https://www.w3.org/TR/media-frags/); [WebVTT](https://www.w3.org/TR/webvtt1/); [EPUB 3.3](https://www.w3.org/TR/epub-33/); [WCAG 2.2](https://www.w3.org/TR/WCAG22/); [UAX #9](https://www.unicode.org/reports/tr9/).

### פערים (Gaps)
- זו לא חוות דעת FTO. לפני השקה מסחרית בארה״ב כדאי שעורך פטנטים יבדוק לפחות את:
  - שתי המשפחות של Zoom (2026).
  - "Video timed anchors" ו־"Video anchors" של Google.
  - ‏US12580003B1 של Adobe.
  - ‏US12524465B2 של CurioXR.
- כרטיסיות ומבחנים שנוצרים מהתוכן — לא נעשה חיפוש פטנטים ייעודי.
- לא נעשה חיפוש בפטנטים ישראליים או אירופיים, מעבר לבני המשפחה שבדפים.

### היסקים (Inferences) — טבלה 1: "features with low IP risk / need care"
הערכה הנדסית ראשונית, לא ייעוץ משפטי. מצב הפטנטים לפי Google Patents ב־9/11/2026.

| יכולת בלשונית | סיכון IP (הערכה) | פטנטים רלוונטיים ומצב | מה בדיוק דורש זהירות | עיצוב מומלץ |
|---|---|---|---|---|
| גלריית שקופיות (זיהוי שינוי, פריים מייצג, חותמת זמן) | נמוך | US6646655B1, ‏US6342904B1, ‏US7149973B2, ‏US8280158B2 — פקעו. ‏HP ‏US10007848B2 — בתוקף עד 2035 | השילוב של HP: תת־קבוצה לפי העדפת משתמש, יחד עם הערות מותאמות לפי התנהגות | להציג את כל השקופיות שזוהו. הערות AI כלליות, לא לפי היסטוריית המשתמש |
| OCR של שקופיות וחיפוש בתוך הווידאו עם קפיצה לזמן | נמוך | US5835667A ‏(CMU) ו־US6311189B1 ‏(AltaVista) — פקעו. מוצרים כאלה קיימים מ־2013 | סיכון שיורי של NPE על פטנטים ישנים (Eureka 2017) | אין הגבלה מיוחדת |
| תמליל אינטראקטיבי (הדגשה, ולחיצה שקופצת לזמן) | נמוך | אמנות קודמת: SMIL ‏1998, ‏DAISY, ‏EPUB MO, ‏WAI. ‏3Play ‏US8930308B1 — בתוקף עד 2032, צר | metadata נפרד שמשויך למידע הסנכרון ומוצג בסנכרון בזמן הניגון | הערות וכרטיסיות עם חותמת זמן משלהן, ברשימה סטטית עם קישורים, בלי "קפיצה" בזמן הניגון |
| סיכום וסינתזה עם נקודות שמקושרות לזמן | נמוך | IBM ‏US12131115B2 — בתוקף עד 2036, צר | שני משתמשים, שני כלי הערות והדגשת חפיפה | סיכום AI למשתמש יחיד; לא סיכום משותף שמדגיש חפיפה בין הערות של כמה משתמשים |
| פרקים ורגעי מפתח ב־AI | בינוני — דורש זהירות | Google ‏US11823716B2/US12451164B2 (עד 2039), ‏US11720793B2 (עד 2042), ‏US12393839B2 (עד 2040). ‏Zoom ‏US12646506B2 ו־US12664798B2 (ניתנו ביוני 2026, עד 2044). ‏Adobe ‏US12580003B1 (עד 2044). ‏Gong ‏US10642889B2 (עד 2038) | התחום הצפוף ביותר, עם פטנטים חדשים. ‏Zoom ו־Google פעילות גם בהתדיינות | קובץ שהועלה, לא סשן תקשורת. ‏LLM על התמליל, בלי מודל עוגנים מאומן ובלי מסווג גבולות למשפט בחלון נע. ‏OCR ברזולוציה אחת. בלי תווית קטגוריה מרשימה סגורה. בלי מחווני רלוונטיות לשאילתה בסרגל |
| שאלות ותשובות עם ציטוטי זמן | בינוני (בעיצוב הנכון — נמוך) | CurioXR ‏US12524465B2 (עד 2043). ‏Adobe ‏US11615308B2 (עד 2040). ‏Twelve Labs ‏US12079273B2 (עד 2042) — התביעות של שני האחרונים לא נקראו | שקלול לפי הקרבה לזמן השאלה, יחד עם נפילה לתחום שני לפי סף ביטחון | ‏RAG על כל התמליל והשקופיות, עם ציטוטים לחיצים. בלי שקלול אוטומטי לפי נקודת הצפייה, ובלי fallback לפי ביטחון |
| כרטיסיות ומבחנים מהתוכן | לא נבדק | לא נעשה חיפוש ייעודי | — | לבדוק לפני השקה מסחרית |
| ייצוא (Markdown, ‏PDF, ‏DOCX, ‏Anki, ‏EPUB) | נמוך | פורמטים פתוחים ומתועדים | — | ספריות ברישיון מתירני (genanki: ‏MIT) |
| בוט שמצטרף לפגישות, וזיהוי דוברים לפי טביעת קול | פרטיות — גבוה (לא פטנטים) | In re Otter.AI; ‏Cruz ו־Fricker נגד Fireflies; ‏Sheldon נגד Zoom (‏BIPA, ‏2025–2026) | הקלטה בלי הסכמת כל המשתתפים, ושמירת טביעות קול | לא בוט. רק קבצים שהמשתמש העלה. ‏diarization בלי לשמור embeddings מזהים |

### היסקים (Inferences) — טבלה 2: "recommended standards per feature of our tab"

| יכולת בלשונית | תקן או פורמט מומלץ | לא עכשיו | הערות יישום (עברית, foliate-js, ‏CSP) |
|---|---|---|---|
| קישור לרגע (כל נקודה לחיצה) | Media Fragments ‏`#t=` (npt, שניות עשרוניות). ב־YouTube: ‏`seekTo` או `start` | Text Fragments (לא תקן W3C) | ‏`#t=` לא נשלח לשרת ולא שובר כתובות חתומות. ב־YouTube: שניות שלמות, בלי שכבה מעל הנגן (RMF) |
| פרקים | WebVTT ‏`kind="chapters"` כמקור אמת. ייצוא: FFMETADATA ‏(MP4), ‏JSON Chapters 1.2, טקסט "00:00 כותרת" | פרקים בתוך מניפסט HLS או DASH | פרקים רצופים בלי חפיפה. זמנים מבודדים בתוך כותרות בעברית |
| כתוביות ותמליל | WebVTT (subtitles/captions). ‏SRT ב־UTF-8 לתאימות | IMSC 1.2 — רק לשידור | ‏`&lrm;` או תווי בידוד. זיהוי דוברים. מידע חזותי חשוב בתמליל |
| סנכרון גלריית השקופיות לנגן | WebVTT ‏`kind="metadata"`, עם JSON בכל קיו | — | נגן אחד שמניע גם תמליל, גם גלריה וגם פרקים |
| תמליל אינטראקטיבי | WAI Transcripts; ‏WCAG 2.2 ‏(1.2.x) | — | ‏`<a href="#t=">` או `<button>`, ‏`aria-current`, בלי `aria-live` לכל קיו, גלילה אוטומטית שאפשר לכבות |
| נגן וסרגל זמן | APG Media Seek Slider; ‏WCAG 2.2 AA ‏(2.4.11, ‏2.5.7, ‏2.5.8); ‏MAUR ‏(TSM) | — | ‏`aria-valuetext` בעברית. ‏Page Up/Down. חלופה לגרירה. מהירות 0.5×–2.5× עם `preservesPitch` |
| הדגשות והערות (חליפין) | W3C Web Annotation: ‏`FragmentSelector` (media-frags) לזמן, ‏`TextQuoteSelector` לתמליל | — | אותו מודל ל־Studio ול־Academy |
| ייצוא לקורא שלנו (Academy) | EPUB 3.3 reflowable, עם קישורי `<a>` לנגן של Studio (`#t=`). ‏EPUB CFI להחזרת מיקום | וידאו מוטמע בספר; ‏Readium Guided Navigation | ליירט `external-link` ב־foliate-js. ה־CSP של Academy חוסם מדיה מרוחקת ו־iframe. ‏Media Overlays (שמע בלבד) — אופציונלי, אחרי חיבור `startMediaOverlay` ותיקון באג ההשמה |
| Markdown | CommonMark 0.31.2 | עטיפת HTML עם `dir` | קישורי זמן כ־URL רגילים |
| מפת חשיבה | Mermaid ‏`mindmap`; ‏JSON Canvas 1.0 | OPML ו־FreeMind (לא אומתו) | לבדוק RTL לפני שחרור |
| Anki | קובץ טקסט עם כותרות (`#guid column`), ואחר כך ‏`.apkg` דרך genanki. ‏Image Occlusion לשקופיות | — | בלי iframe ובלי סקריפטים בכרטיסים. ‏GUID יציב לייצוא חוזר |
| DOCX | OOXML ‏`w:bidi` ו־`w:rtl`; ספריית docx ‏(`bidirectional`, ‏`rightToLeft`, ‏`*ComplexScript`) | — | גופן עברי שמוגדר ל־complex script |
| PDF | PDF מתויג (Chromium/Puppeteer ‏`tagged: true`, ‏`outline: true`); יעד PDF/UA-1 | PDF/UA-2 (דורש PDF 2.0) | עברית בסדר לוגי (או `ActualText`). בדיקה בכלי ולידציה |
| Notion ו־Obsidian | ייבוא Markdown או DOCX (‏Notion: עד 5MB בחינם). ‏Obsidian: ‏Markdown ו־JSON Canvas | Notion API (‏OAuth) | קישורי עוגן לא נשמרים בייבוא ל־Notion. קישורים חיצוניים כן |
| מבחנים ל־LMS | Moodle XML ו־GIFT; ‏QTI 1.2 ל־Canvas לפי ביקוש | QTI 3.0, ‏LTI 1.3, ‏Common Cartridge 1.4 | — |
| מעקב התקדמות למידה | סמנטיקה של xAPI Video Profile ‏(played-segments, ‏progress), פנימית | LRS חיצוני, ‏cmi5 | — |
| RTL בכל השכבות | UAX #9 (בידוד); ‏`<bdi>` ו־`dir`; ‏CSS Logical | — | טווח זמנים עם en dash — חובה לבודד |
| תאימות לחוק | IS 5568 ‏(WCAG 2.0 AA) כרצפה; יעד WCAG 2.2 AA ‏(ISO/IEC 40500:2025, ‏EN 301 549 V4.1.1) | — | — |
