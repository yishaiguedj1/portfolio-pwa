# מחקר HCI ו־UX: ניווט, רפרוף, קריאה ואמון בניתוח של סרטוני הרצאה ומידע — הבסיס לעיצוב לשונית "ניתוח וידאו" (מצב 9/11/2026)

> מחקר 9/11/2026 עבור לשונית "ניתוח וידאו" ב־THE SNOWBALL Studio. המוצר: PWA בעברית, טלפון תחילה, RTL, מצב בהיר וכהה, שפת עיצוב מינימלית. הקהל: סטודנטים ואנשי עסקים. כל נקודה בניתוח לחיצה, וקופצת לרגע המדויק בסרטון לפי תזמון ברמת המילה.
>
> **שיטה.** WebSearch, עד שתקציב החיפוש המשותף (200 לכל הסוכנים) נגמר באמצע העבודה. משם והלאה רק שליפה ישירה של כתובות ידועות (arXiv, דפי מחברים ומעבדות, W3C, NN/g, Baymard, Pew) ושליפת תקצירים לפי DOI מ־OpenAlex. לא נעשה שימוש במנועי חיפוש או בשירותי ביניים.
>
> **מה נקרא במלואו (22 מקורות, PDF דרך pdftotext):** התזה של Pavel (Video Digests ו־SceneSkim), LectureScape, Visual Transcripts, ToolScape, Swift, ElasticPlay, Papeos, Qlarify, Scim, SPICA, VideoMix, NoTeeline, Kim et al. L@S 2014, Goldenberg & Tractinsky, Spatharioti et al., Amershi et al., Bastani et al., Garcia et al., Gernsbacher, IReST, WCAG 2.2 וטיוטת WCAG 3.0.
>
> **חסימות וסימונים.** ACM DL ו־ScienceDirect חסמו קריאה (403). במקורות האלה הממצא מסומן:
> - **"(תקציר)":** נלקח מהתקציר הרשמי בלבד.
> - **"(תקציר חיפוש)":** נלקח מתקציר של תוצאת חיפוש, ולא מקריאת העמוד. ראיה חלשה יותר.
>
> **כללי כתיבה.** לכל מאמר מצוינים שנה ומקום פרסום. שמות מאמרים, מונחים טכניים וציטוטים קצרים נשארים באנגלית. מוצרים מסחריים מוזכרים רק כעובדה (מי מדד מה), לא כמודל לחיקוי.

## 1. מערכות לניווט ולקריאה של וידאו מידעי: מה נבנה ומה נמדד (זמן, הבנה, זכירה, העדפה)

### Takeaway
הראיה החזקה ביותר לתקציר טקסט מובנה שמוצמד לסרטון מגיעה מ־Video Digests (UIST 2014). המשתתפים ראו הרצאה של 15 דקות ונתנו להם 2–5 דקות בלבד. עם תקציר מובנה (פרקים, סיכומים ותמונות) הם זכרו עד פי 2 מנושאי המפתח לעומת נגן עם ציר זמן. כשהיה מספיק זמן (8 דקות), היתרון נעלם.

המערכות האחרות מראות בעיקר שיפור בהעדפה, בתחושת הקלות, בעומס ובכיסוי:
- **המערכות:** LectureScape, Visual Transcripts, Papeos, VideoMix, NoTeeline.
- **זמן משימה:** ההבדלים קטנים, ולרוב לא מובהקים.
- **זכירה לטווח ארוך:** כמעט לא נמדדה. הניסויים קטנים (n=9–16).

סיכום AI שמחליף צפייה מקצר את זמן הצפייה פי 3. המחיר נראה בפריטים מסדר גבוה ובמוטיבציה.

### Cited Findings

#### א. תקציר טקסט מובנה מעל ציר הזמן: הקו של Pavel ועמיתיה
- **Video Digests** (Pavel, Reed, Hartmann, Agrawala; UIST 2014) — פורמט "פרקים וסעיפים". לכל סעיף יש כותרת, סיכום קצר ותמונה ממוזערת, ולחיצה מנגנת מתחילת הסעיף — [דף הפרויקט](https://vis.berkeley.edu/papers/videodigests); [Pavel, "Navigating Video Using Structured Text", UC Berkeley EECS‑2019‑78, 2019](https://www2.eecs.berkeley.edu/Pubs/TechRpts/2019/EECS-2019-78.pdf).
- **מערך הניסוי** — [Pavel 2019](https://www2.eecs.berkeley.edu/Pubs/TechRpts/2019/EECS-2019-78.pdf):
  - ארבע תצורות: תקציר ידני, תקציר אוטומטי, נגן עם ציר זמן ונגן עם תמליל.
  - שלושה תקציבי זמן: 2, 5 ו־8 דקות להרצאה של כ־15 דקות.
  - סה"כ 192 סיכומים.
  - הציון הממוצע עלה עם הזמן: 0.408, 0.457 ו־0.530 (χ2(2)=9.92, p=0.007).
- **ההבדל בין התצורות** היה מובהק ב־2 דקות (χ2(3)=18.31, p<0.001) וב־5 דקות (χ2(3)=16.23, p=0.001). ב־8 דקות הוא לא היה מובהק (χ2(3)=6.77, p=0.080) — [Pavel 2019](https://www2.eecs.berkeley.edu/Pubs/TechRpts/2019/EECS-2019-78.pdf).
- **הממצא המרכזי:** משתמשי התקציר זכרו "up to twice as many of the key topics" — [Pavel 2019](https://www2.eecs.berkeley.edu/Pubs/TechRpts/2019/EECS-2019-78.pdf).
  - עם התקציר, זמן נוסף כמעט לא שיפר את הציון.
  - עם ציר הזמן, הביצוע ב־2 דקות היה נמוך והשתפר בהדרגה.
- **המגבלות שהכותבת עצמה ציינה:** חוסר עקביות בין סיכומים של עובדי המון, והשיטה לא נבדקה על תוכן טכני מאוד — [Pavel 2019](https://www2.eecs.berkeley.edu/Pubs/TechRpts/2019/EECS-2019-78.pdf).
- **שלוש הנחיות לטקסט מובנה** (פרק 2 בתזה, על בסיס ספרות הבנת הנקרא של Goldman & Rakestraw):
  - **Structure saliency:** הבלטת המבנה.
  - **Structure‑concept match:** התאמה בין מבנה הטקסט למבנה המושגים.
  - **Structure knowledge:** מוסכמות התחום.

  לפי הספרות שהתזה סוקרת, רמזים מבניים משפרים זיהוי וזכירה של רעיונות מרכזיים: כותרות, סקירות, מילות קישור ("Second", "however", "In summary") ורמזים טיפוגרפיים. חוסר התאמה בין המבנה למושגים פוגע בהבנה — [Pavel 2019](https://www2.eecs.berkeley.edu/Pubs/TechRpts/2019/EECS-2019-78.pdf).
- **SceneSkim** (Pavel, Goldman, Hartmann, Agrawala; UIST 2015) מסנכרן כתוביות, תסריט ותקציר עלילה בשלוש רמות פירוט. המשתמשים לחצו על תוצאה ברמה הגבוהה, ואז ירדו לתסריט או לכתוביות לניווט מדויק. בממוצע נצפו 5:09 דקות וידאו לשאילתה, ו־6:17 דקות עד סיום המשימה — [Pavel 2019](https://www2.eecs.berkeley.edu/Pubs/TechRpts/2019/EECS-2019-78.pdf).
- **Visual Transcripts** (Shin, Berthouzoz, Li, Durand; ACM TOG / SIGGRAPH Asia 2015) הופך הרצאת לוח למסמך קריא, שמשלב את השרטוטים בתוך פסקאות לפי נקודות. בניסוי (9 משתתפים, מול נגן עם תמליל ומול NoteVideo) — [Shin et al. 2015](https://people.csail.mit.edu/hishin/projects/visual_transcripts/paper.pdf):
  - **כיסוי הסיכום:** לא נבדל (נקודות עיקריות: F2,24=0.23, p=0.79).
  - **זמן חיפוש:** ההבדל לא היה מובהק (χ2=0.82, p=0.676).
  - **תועלת:** 6.3 מול 4.7 בבסיס, בסולם 1–7.
  - **העדפה ללמידה:** 7 מתוך 9 העדיפו אותו, מול 2 מתוך 9 שהעדיפו את NoteVideo.
  - **התמליל הגולמי:** 3 מתוך 9 אמרו שקשה לרפרף בו.
  - **ציטוטים:** "similar to a textbook"; "the paragraph structure corresponds to the main points".
  - **NoteVideo:** המשתמשים ערבבו את סדר הנקודות או פספסו נקודה עיקרית.
- **NoteVideo** (Monserrat, Zhao, McGee, Pandey; CHI 2013) — תמונת סיכום של הלוח, שבה כל רכיב לחיץ ומוביל לזמן שלו. לפי התקציר, הביצועים טובים יותר במובהק בכל ארבע המשימות (תקציר) — [DOI](https://doi.org/10.1145/2470654.2466147).
- **MixT** (Chi et al.; UIST 2012) משווה מדריך סטטי, וידאו ומדריך מעורב: שלבים סטטיים, ולכל שלב קטע וידאו קצר. 12 משתתפים (תקציר) — [Adobe Research](https://research.adobe.com/publication/mixt-automatic-generation-of-step-by-step-mixed-media-tutorials).

#### ב. תמליל אינטראקטיבי, נתוני צפייה ואיכות התמליל
- **LectureScape — "Data-Driven Interaction Techniques for Improving Navigation of Educational Videos"** (Kim, Guo, Cai, Li, Gajos, Miller; UIST 2014) — [Kim et al. 2014](https://www.cs.rochester.edu/hci/pubs/pdfs/data-driven-educational-video-navigation_UIST-2014.pdf):
  - **היכולות:** ציר זמן שמציג את "עקבות" הצפייה של כולם, והגלילה מואטת ליד שיאים. נוספו חיפוש בתמליל, ענן מילים, סיכום ויזואלי וסימניות.
  - **מערך הניסוי:** 12 משתתפים, within‑subjects, 75 דקות ו־8 משימות. הבסיס: נגן עם תמליל אינטראקטיבי ותמונות ממוזערות.
  - **זמני משימה — אין הבדל מובהק:**
    - חיפוש ויזואלי ליד שיא: 85 מול 80 שניות.
    - חיפוש ויזואלי מחוץ לשיא: 117 מול 90 שניות.
    - חיפוש בעיה: 96 מול 106 שניות (p=0.8).
- **דפוסי השימוש באותו ניסוי** — [Kim et al. 2014](https://www.cs.rochester.edu/hci/pubs/pdfs/data-driven-educational-video-navigation_UIST-2014.pdf):
  - **חיפוש בעיה, בבסיס:** חיפשו מילות מפתח (10/12) ולחצו על טקסט בתמליל (11/12).
  - **משימות סיכום:** כמעט לא השתמשו בחיפוש מילים (1/12 בשני התנאים), כי צריך לסרוק את כל הסרטון.
  - **שקופית הסיכום:** ב־LectureScape כל 6 המשתתפים הגיעו לשקופית שליד הסוף (6:35 מתוך 7:00). בבסיס הגיע אליה רק משתתף אחד.
- **תפיסה ועומס** — [Kim et al. 2014](https://www.cs.rochester.edu/hci/pubs/pdfs/data-driven-educational-video-navigation_UIST-2014.pdf):
  - **"כל הפונקציות שציפיתי להן":** LectureScape קיבל 6.4 מול 4.3 (p<0.001).
  - **קלות שימוש:** נמוכה יותר, 4.7 מול 6.3 (p<0.001). חלק מהמשתתפים אמרו שהוא "visually complex" ורצו להסתיר רכיבים שלא בשימוש.
  - **התאמת השיאים לעניין האישי:** 4.4. משתתף אחד אמר שמתסכל שהגלילה מואטת בנושא שהוא כבר מכיר.
- **"Understanding In-Video Dropouts and Interaction Peaks in Online Lecture Videos"** (Kim, Guo, Seaton, Mitros, Gajos, Miller; L@S 2014) — [Kim et al. 2014](https://www.eecs.harvard.edu/~kgajos/papers/2014/kim14video.pdf):
  - **הנתונים:** 862 סרטונים בארבעה קורסי MOOC.
  - **נשירה:** גבוהה יותר בסרטונים ארוכים, בצפייה חוזרת ובהדרכות.
  - **שיאים:** 61% מהשיאים (במדגם של 80 סרטונים) מלווים במעבר ויזואלי, למשל מהמצגת למרצה.
  - **חמישה סוגי שיאים:** התחלת חומר חדש, חזרה לתוכן שהוחמץ, שלב בהדרכה, ניגון חוזר של קטע, והסבר לא ויזואלי. רק הסוג האחרון לא כרוך במעבר ויזואלי.
- **השפעת ההפקה על המעורבות** (Guo, Kim, Rubin; L@S 2014): 6.9 מיליון סשנים. ההמלצה: קטעים קצרים מ־6 דקות — [Guo et al. 2014](https://www.cs.rochester.edu/hci/pubs/pdfs/edX-MOOC-video-production-and-engagement_LAS-2014.pdf).
- **הבדלים דמוגרפיים בניווט** (Guo & Reinecke; L@S 2014) — [Guo & Reinecke 2014](https://www.cs.rochester.edu/hci/pubs/pdfs/edX-MOOC-demographics-and-navigation_LAS-2014.pdf):
  - **הנתונים:** 140,546 סטודנטים.
  - **מקבלי תעודה:** דילגו על כ־22% מהתוכן.
  - **קפיצות:** יש קפיצות אחורה מהמבחנים אל ההרצאות.
  - **מבוגרים:** מנווטים פחות לינארית.
- **דיוק ה־ASR ותועלת התמליל** (Munteanu et al.; CHI 2006) — [DBLP](https://dblp.org/rec/conf/chi/MunteanuBPTJ06.html) (תקציר חיפוש; המאמר המלא לא נקרא):
  - **מערך:** 48 משתתפים. ארבעה תנאים: תמליל מושלם, WER של 25%, WER של 45%, ובלי תמליל.
  - **תוצאה:** הקשר בין ה־WER לתועלת ליניארי. 45% לא מספק; 25% ומטה שימושי.
- **"Browsing Digital Video"** (Li, Gupta, Sanocki, He, Rui; CHI 2000) — [Microsoft Research](https://www.microsoft.com/en-us/research/publication/browsing-digital-video/):
  - **היכולות הנפוצות ביותר:** דחיסת זמן (האצה), הסרת הפסקות וקפיצה בין שוטים.
  - **דפוס הרפרוף:** משתנה לפי סוג התוכן.
  - **מה העריכו המשתמשים:** חיסכון בזמן ותחושת שליטה.

#### ג. גלילה בציר הזמן, תמונות ממוזערות ותקציב זמן
- **"Swift: Reducing the Effects of Latency in Online Video Scrubbing"** (Matejka, Grossman, Fitzmaurice; CHI 2012) — [Autodesk Research](https://research.autodesk.com/publications/swift-reducing-the-effects-of-latency-in-online-video-scrubbing):
  - **הבעיה:** גם השהיה קטנה בגלילה ברשת פוגעת במובהק בניווט.
  - **הפתרון:** שכבת וידאו ברזולוציה נמוכה בזמן הגלילה.
  - **התוצאה:** זמן המשימה התקצר בעד 72%, בהשהיות של 220ms ושל 500ms.
- **Swifter** (Matejka et al.; CHI 2013) — רשת של תמונות ממוזערות בזמן הגלילה. הביצוע השתפר בעד 48% — [דף המחבר](https://justinmatejka.pages.dev/publication/swifter/).
- **"ElasticPlay: Interactive Video Summarization with Dynamic Time Budgets"** (Jin, Song, Yatani; ACM MM 2017) — [arXiv 1708.06858](https://arxiv.org/abs/1708.06858):
  - **הרעיון:** המשתמש קובע תקציב זמן, ואלגוריתם cut‑and‑forward מחליט מה לדלג ומה להריץ מהר.
  - **התגובות:** חיוביות, ב־22 משתתפים במעבדה ו־60 ב־MTurk.
  - **המגבלה:** נבדק רק על סרטונים קצרים.

#### ד. ניווט לפי שלבים, מושגים, שקופיות ובחנים
- **ToolScape — "Crowdsourcing Step-by-Step Information Extraction to Enhance Existing How-to Videos"** (Kim, Nguyen, Weir, Guo, Miller, Gajos; CHI 2014) — [Kim et al. 2014](https://www.eecs.harvard.edu/~kgajos/papers/2014/kim14crowdsourcing.shtml):
  - **מה מוצג:** תוויות שלבים ותמונות ביניים על ציר הזמן.
  - **התוצאות:** עלייה גדולה יותר במסוגלות העצמית ודירוג עצמי גבוה יותר. גם שופטים חיצוניים דירגו את התוצרים גבוה יותר.
  - **איכות התוויות:** תהליך Find‑Verify‑Expand של עובדי המון, על 75 סרטונים, הגיע ל־precision של 77% ול־recall של 81%.
- **Crowdy** (Weir, Kim, Gajos, Miller; CSCW 2015) — [Weir et al. 2015](https://www.eecs.harvard.edu/~kgajos/papers/2015/weir15learnersourcing.shtml); [MIT News](https://news.mit.edu/2015/better-how-to-videos-0211):
  - **תוויות הלומדים:** רוב תוויות השלבים שהלומדים כתבו היו שקולות לתוויות של מומחים. 14 מתוך 17 דורגו "שקולות" בידי לפחות שופט אחד.
  - **התחושה:** הלומדים אמרו שכתיבת התוויות עזרה להם לשים לב.
  - **ניסוי השטח:** 25 יום על 15 סרטונים. כחמישית מהצופים השתתפו, בממוצע 8 תוויות לסרטון.
- **ConceptScape** (Liu, Kim, Wang; CHI 2018) — מפת מושגים אינטראקטיבית להרצאה. לפי התקציר, היא כלי שימושי לניווט לפי מושג ולהבנה, ומפות שעובדי המון יצרו יחד הגיעו לאיכות של מפות מומחים (תקציר) — [DOI](https://doi.org/10.1145/3173574.3173961); [KAIST](https://koasas.kaist.ac.kr/handle/10203/246846).
- **DynamicSlide** (Jung, Shin, Kim; סדנה ב־ACM MM 2018) — מדגיש את פריט השקופית שמוסבר עכשיו, ומאפשר ניווט והערות לפי פריט. 79% מ־141 ההפניות זוהו נכון (תקציר) — [KAIST](https://dspace.kaist.ac.kr/handle/10203/246777).
- **"Slidecho: Flexible Non-Visual Exploration of Presentation Videos"** (Peng, Bigham, Pavel; ASSETS 2021) — [DOI](https://doi.org/10.1145/3441852.3471234); [דף הפרויקט](https://sayitall.github.io/slidecho):
  - **מה נוסף:** לעומת הדיבור לבדו, נחשפו עוד 20% מרכיבי הטקסט ו־30% מרכיבי התמונה בשקופיות, שהמרצה לא תיאר.
  - **משתמשים עיוורים ולקויי ראייה:** היה להם קל יותר לאתר רכיבים שלא תוארו, והם קראו פחות שקופיות שחזרו במלואן על הדיבור.
- **"SPICA: Interactive Video Content Exploration through Augmented Audio Descriptions for Blind or Low-Vision Viewers"** (Ning et al.; CHI 2024) — 14 משתמשים עיוורים ולקויי ראייה חקרו סרטון דרך תיאורי פריימים מעוגנים בזמן, בשכבות פירוט — [arXiv 2402.07300](https://arxiv.org/abs/2402.07300).
- **"Effects of In-Video Quizzes on MOOC Lecture Viewing"** (Kovacs; L@S 2016) — [DOI](https://doi.org/10.1145/2876034.2876041); [Stanford HCI](https://hci.stanford.edu/publications/paper.php?id=314):
  - **השתתפות:** 74% מהצופים שהתחילו סרטון ניסו את הבוחן שבתוכו.
  - **קפיצות:** שיא של קפיצות סביב הבחנים, במיוחד מהבוחן אחורה לקטע שלפניו.
  - **אסטרטגיה:** חלק מהמשתמשים ניווטו מבוחן לבוחן.
- **"QuizCram: A Question-Driven Video Studying Interface"** (Kovacs; 2015, מקום הפרסום לא אומת) — הצעד הבא באותו קו: ממשק לימוד וידאו שמונחה שאלות. נבנה בעקבות שיאי הקפיצות סביב הבחנים — [Stanford HCI](https://hci.stanford.edu/publications/paper.php?id=316).
- **"Chapter-Llama: Efficient Chaptering in Hour-Long Videos with LLMs"** (Ventura, Yang, Schmid, Varol; CVPR 2025) — F1 של 45.3 מול 26.7 ב־VidChapters‑7M. עבודה טכנית בלבד, בלי ניסוי משתמשים — [arXiv 2504.00072](https://arxiv.org/abs/2504.00072).

#### ה. מסמך מקושר לווידאו, ומערכות LLM עדכניות (2023–2026)
- **"Papeos: Augmenting Research Papers with Talk Videos"** (Kim, Latzke, Bragg, Zhang, Chang; UIST 2023) — מאמר מחקר שבשוליו הערות וידאו מעוגנות, עם קישור דו־כיווני. הניסוי: n=16, שלושה תנאים (מאמר; מאמר ועוד סרטון; Papeos) — [arXiv 2308.15224](https://arxiv.org/abs/2308.15224):
  - **קלות נתפסת:** הגבוהה ביותר (Q=6.982, p=0.030).
  - **עומס מנטלי:** הנמוך ביותר, 4.50 מול 5.50 ו־5.31 (Q=12.182, p=0.002).
  - **קלות ניווט במאמר:** Q=6.704, p=0.035.
  - **התמצאות בסרטון:** טובה יותר מתנאי "מאמר ועוד סרטון" (W=27, p=0.034).
  - **מקיפות הסיכומים:** הגבוהה ביותר (F=3.497, p=0.043), בלי פגיעה בפירוט או בקוהרנטיות.
  - **מעברים בין הפורמטים:** תכופים יותר.
  - **הציטוט המרכזי:** "the video supported navigation in the paper, and the paper supported orientation in the video".
- **"Qlarify: Bridging Scholarly Abstracts and Papers with Recursively Expandable Summaries"** (Fok et al.; UIST 2024) — תקציר שאפשר להרחיב שוב ושוב, עם פסקת ראיה מהמאמר לכל הרחבה. מחקרים בגדלים 9, 275 ו־12 — [Fok et al.](https://talaugust.github.io/assets/pdf/Fok2023Qlarify.pdf):
  - **שרשור:** 27.7% מהאינטראקציות שורשרו, עד עומק 5.
  - **צפייה בראיה:** רק ב־14.8% מההרחבות צפו בפסקת הראיה. בכ־60% מאלה הראיה הספיקה, ובכ־40% פתחו את ה־PDF.
  - **דיוק:** 105 מתוך 120 הרחבות (87.5%) היו מבוססות במלואן.
  - **שגיאות:** 5.8% כללו פרטים שגויים, בעיקר מספרים והפניות ניווט שגויות. 6.7% היו "חסר תוכן", כשהמידע ישב בטבלה.
  - **זיהוי:** "no scholars in our interview study surfaced any errors".
- **"Scim: Intelligent Skimming Support for Scientific Papers"** (Fok et al.; IUI 2023) — הדגשות לפי סוג (מטרה, שיטה, תוצאה) בצפיפות שאפשר לכוונן. במחקר היומן, ב־74 מתוך 105 תשובות (70.4%) נאמר שההדגשות עזרו לרפרף במאמר — [arXiv 2205.04561](https://arxiv.org/abs/2205.04561).
- **"VideoMix: Aggregating How-To Videos for Task-Oriented Learning"** (Yang, Truong, Kim, Li; IUI 2025) — [arXiv 2503.21130](https://arxiv.org/abs/2503.21130):
  - **היקף:** מאגד מידע מ־77.8 סרטונים בממוצע למשימה. בבסיס צפו ב־2.6 סרטונים.
  - **תועלת:** 6.08 מול 5.08 (p<0.05).
  - **העדפה:** 10 מתוך 12 העדיפו אותו.
- **"NoTeeline: Supporting Real-Time, Personalized Notetaking with LLM-Enhanced Micronotes"** (Huq, Samee, Lin ועוד; IUI 2025) — המשתמש רושם "מיקרו־הערות", וה־LLM מרחיב אותן לפי התמליל של אותו זמן — [arXiv 2409.16493](https://arxiv.org/abs/2409.16493):
  - **חיסכון:** 47.0% פחות טקסט ו־43.9% פחות זמן.
  - **נכונות עובדתית:** 93.2% (HHEM).
  - **עצירות וחזרות:** 0.56 מול 4.94.
  - **שאלות חזרה:** המערכת מייצרת גם שאלות חזרה.
- **AQuA** (Yang, Vermeulen, Fitzmaurice, Matejka; CHI 2024) — [arXiv 2403.05213](https://arxiv.org/abs/2403.05213):
  - **הנתונים:** 633 שאלות מתוך 5,944 תגובות על סרטוני הדרכה.
  - **הממצא:** משתמשים מצביעים על "visual anchors" בתוך הפריים.
  - **ההערכה:** n=16; התשובות היו טובות מהבסיס.
- **StopGap — "Exploring the Design Space of Real-time LLM Knowledge Support Systems: A Case Study of Jargon Explanations"** (Liu, Shah, Ackerman, Saha; CHI 2025) — הסבר ז'רגון בזמן אמת בתוך סרטון. מחקר design probe עם N=24 מצא הבדלים אישיים בייצוג המועדף. הדגשים: שליטה של המשתמש, התאמה אישית ויוזמה משותפת (תקציר) — [DOI](https://doi.org/10.1145/3706598.3714262).
- **"Generative Lecture: Making Lecture Videos Interactive with LLMs and AI Clone Instructors"** (Jo, Zhao, Liu, Suzuki; arXiv, דצמבר 2025) — n=12 — [arXiv 2512.21796](https://arxiv.org/html/2512.21796):
  - **תסכול:** 2.08 מול 5.00.
  - **SUS:** 84.38 מול 81.46.
  - **כוונת שימוש:** 4.25 מול 3.25.
  - **שביעות רצון:** 6.33 מול 4.33.
  - **למידה:** **אין הבדל** (p=.78).
  - **מה אהבו:** את ההדגשה האוטומטית.
  - **מה הדאיג:** הדיוק. 3 מתוך 5 מרצים לא רצו אווטאר ריאליסטי.
- **"StoryNavi: On-Demand Narrative-Driven Reconstruction of Video Play With Generative AI"** (arXiv 2410.03207, 2024) — קטעים נבחרים מסודרים לסיפור. הקוהרנטיות הגבירה מעורבות, וההעדפה תלויה בז'אנר. לא דווחו מספרים — [arXiv](https://arxiv.org/html/2410.03207v1).
- **"Cite or Decline: A Strict Course-Grounded Chatbot for STEM Lecture Videos"** (Ahmed & Subhlok, University of Houston; arXiv 2609.01846, ספטמבר 2026), שלב 1 — סקר של 128 סטודנטים — [arXiv](https://arxiv.org/html/2609.01846v1):
  - **"הסיכומים עוזרים לנווט":** 4.43 מתוך 5.
  - **"עוזרים לחזרה":** 4.42.
  - **אורך:** רבים ביקשו סיכום ארוך יותר לחזרה.
- **"Less Watching, Less Learning? Investigating the Immediate Effects of AI-Generated Summaries in Video-Based Learning"** (Garcia, Yousef, Happonen, Crompton; IEEE ICAITE 2025) — N=60. סרטון של 15 דקות לבד, או סרטון ועוד סיכום ChatGPT של 150–200 מילים — [Garcia et al.](https://manuelgarcia.info/publication/ai-video-summaries); [DOI](https://doi.org/10.1109/ICAITE68636.2025.11442516):
  - **זמן צפייה:** 9.1 מול 2.9 דקות (p<.001).
  - **הבנה:** 8.2 מול 7.6 (p=.087, d=0.45).
  - **פריטים מסדר גבוה:** פער של 11–15%. בזכירת עובדות הפער קטן מ־5%.
  - **מוטיבציה פנימית:** 5.8 מול 5.2 (p=.012, d=0.67).
  - **דילוג קדימה:** 42% מול 17%.
  - **צפייה חוזרת:** 20% מול 35%.
  - **סדר הפתיחה:** 68% פתחו את הסיכום לפני הסרטון. מהם, 51% עצרו בתוך 2 דקות או קפצו לסוף.

### Inferences
- **התקציר המובנה מנצח כשהזמן קצר.** זה בדיוק המצב של איש עסקים שרוצה לדעת "מה היה" בכמה דקות. כשיש זמן, הפער נסגר. לכן הלשונית צריכה להיות קודם כל מסמך לסריקה, ורק אחר כך שער לסרטון.
- **יכולות ניווט נוספות משפרות תחושה, לא מהירות.** ב־LectureScape הן שיפרו את תחושת השלמות, פגעו בקלות השימוש ולא קיצרו את זמני המשימה. לכן ברירת המחדל מינימלית, והשאר בחשיפה הדרגתית.
- **צריך להכניס את השקופית למבנה הניתוח.** הקשר בין שיאי הצפייה למעברים ויזואליים (61%), ומה שהמרצה לא אומר בקול (Slidecho), מראים שניתוח שמבוסס רק על התמליל יחמיץ חלק מהתוכן.
- **קישור דו־כיווני עדיף על חד־כיווני.** בכיוון אחד, הטקסט מוביל לרגע בסרטון. בכיוון השני, הסרטון מראה איפה הוא נמצא בטקסט. ב־Papeos זה הוריד עומס והגדיל כיסוי.
- **משתמשים לא מוצאים טעויות "קטנות" בעצמם.** ב־Qlarify אף משתתף לא זיהה שגיאה. השגיאות הנפוצות היו מספרים והפניות ניווט — בדיוק הסוג של "חותמת זמן שגויה". לכן צריך שכבת אימות אוטומטית, ולא להסתמך על המשתמש.
- **סיכום שזמין מראש הופך את הצפייה לאופציונלית.** זה טוב לקהל העסקי, ופחות טוב למי שלומד למבחן (Garcia).

### Gaps
- **פרקים ונקודות מ־LLM:** לא נמצא ניסוי HCI מבוקר על פרקים ונקודות שנוצרו ב־LLM ומעוגנים ברמת המילה, מול תמליל אינטראקטיבי בלבד, עם מדדי זכירה והבנה. Chapter‑Llama מודד רק התאמה טכנית.
- **הרצאות ארוכות:** אין מחקר משתמשים על הרצאות של 1–3 שעות. רוב הניסויים השתמשו בסרטונים של 5–15 דקות.
- **מספרים חסרים:** לא אומתו המספרים המלאים של MixT ו־NoteVideo (ACM חסום, רק תקציר), וגם לא הפרטים המלאים של Munteanu 2006.
- **עברית:** אין ניסוי על רמת הפירוט האופטימלית של תקציר בעברית.

## 2. אמון ואימות: צ'יפים של ציטוט, הדגשת מקור, תצוגה מקדימה של הרגע, מחווני ביטחון ולוח "הצג ראיות"

### Takeaway
רוב האנשים לא בודקים מקורות:
- בניסוי מ־CHI 2025, 189 מתוך 308 לא לחצו אף פעם על מקור.
- לפי Pew, לחצו בתוך סיכום AI רק ב־1% מהביקורים.

לכן קישור ציטוט לבדו מגדיל אמון בלי להגדיל בדיקה, גם כשהציטוט אקראי.

מה שכן עזר בניסויים מבוקרים:
- **מקורות גלויים מעל ההסבר.**
- **הדגשה בצבע של קטעים בביטחון נמוך:** הכפילה את הדיוק במשימה שמועדת לטעויות (26%→58%).
- **ניסוח מסויג בגוף ראשון.**
- **הוזלת האימות:** הראיה עצמה מוצגת במקום, ולא רק מקושרת.

הסברים ארוכים מגבירים אמון בלי קשר לנכונות. תווית "נוצר ב־AI" לבדה לא מגינה.

### Cited Findings

#### א. האם אנשים בודקים? עלות האימות היא צוואר הבקבוק
- **"Fostering Appropriate Reliance on Large Language Models: The Role of Explanations, Sources, and Inconsistencies"** (Kim, Vaughan, Liao, Lombrozo, Russakovsky; CHI 2025). N=308, תכנון 2×2×2. כ־61% (189 מתוך 308) לא לחצו אף פעם על מקור — [arXiv 2502.08554](https://arxiv.org/abs/2502.08554).
  - **דיוק:** מי שלחץ דייק יותר, 60.1% מול 49.2%.
  - **זמן:** מי שלחץ השקיע יותר, 2.11 מול 1.08 דקות.
- **Pew Research Center** (22.7.2025) — נתוני גלישה של 900 מבוגרים בארה"ב — [Pew](https://www.pewresearch.org/short-reads/2025/07/22/google-users-are-less-likely-to-click-on-links-when-an-ai-summary-appears-in-the-results/):
  - **לחיצה על קישור:** כשהופיע סיכום AI בתוצאות החיפוש, לחצו על קישור ב־8% מהביקורים, מול 15% בלעדיו.
  - **לחיצה בתוך הסיכום עצמו:** רק ב־1% מהביקורים.
  - **סיום הגלישה:** 26% סיימו את הגלישה אחרי עמוד עם סיכום, מול 16% בלעדיו.
- **Qlarify** — צפו בראיה רק ב־14.8% מההרחבות, ואף משתתף לא זיהה שגיאה — [Fok et al.](https://talaugust.github.io/assets/pdf/Fok2023Qlarify.pdf).
- **Cite or Decline** — 313 לחיצות על ציטוטים, ב־37.6% מההודעות — [arXiv 2609.01846](https://arxiv.org/html/2609.01846v1). בסקר (n=22):
  - **"קישורי הציטוט עוזרים":** 4.55, וכל המשיבים דירגו 4 או 5.
  - **אמון:** 4.27.
- **NN/g — "AI Chatbots Discourage Error Checking"** (Samsonov, 16.5.2025). מאמר ניתוחי, בלי מחקר משתמשים משלו — [NN/g](https://www.nngroup.com/articles/ai-chatbots-discourage-error-checking/):
  - **התיאור:** משתמשים בוטחים בפלט עד ש־"do not even read through it end to end".
  - **ההמלצות:** "a deep link to the referenced passage or showing it in a preview of the source".
  - **שאלות המשך:** במקום שאלות שדוחפות "להמשיך הלאה", שאלות שמזמינות בדיקה.
- **NN/g** על "Magic‑8‑ball thinking" (תקציר חיפוש) — [NN/g](https://www.nngroup.com/articles/ai-magic-8-ball/):
  - **ההגדרה:** המשתמש מפסיק לאמת.
  - **ציטוטים:** כמעט לא לוחצים עליהם.
  - **ההמלצה:** להצמיד את הציטוט למשפט שהוא תומך בו, עם תווית בעלת משמעות ולא תווית כללית.
- **"The Impact of Generative AI on Critical Thinking"** (Lee, Sarkar et al.; CHI 2025). סקר של 319 עובדי ידע — [PDF](https://advait.org/files/lee_2025_ai_critical_thinking_survey.pdf):
  - **אמון ב־AI:** יותר אמון קשור לפחות חשיבה ביקורתית.
  - **ביטחון עצמי:** יותר ביטחון עצמי קשור ליותר חשיבה ביקורתית.

#### ב. ציטוטים: איכות, ומה הם עושים לאמון
- **"Evaluating Verifiability in Generative Search Engines"** (Liu, Zhang, Liang; Findings of EMNLP 2023) — [arXiv 2304.09848](https://arxiv.org/abs/2304.09848):
  - **citation recall:** רק 51.5% מהמשפטים נתמכו במלואם בציטוטים שלהם.
  - **citation precision:** רק 74.5% מהציטוטים תמכו במשפט שלהם.
  - **קשר לשטף:** שני המדדים היו בקורלציה הפוכה לשטף ולתועלת הנתפסת.
- **"Citations and Trust in LLM Generated Responses"** (Ding et al.; AAAI 2025) — [arXiv 2501.01303](https://arxiv.org/abs/2501.01303):
  - **ציטוטים מעלים אמון:** באופן מובהק, גם כשהם אקראיים.
  - **בדיקת הציטוטים מורידה אמון:** באופן מובהק.
- **Kim et al.** (CHI 2025) — שיעורי קבלה של תשובה שגויה — [arXiv 2502.08554](https://arxiv.org/abs/2502.08554):
  - **בלי מקורות:** 78.2%, ו־82.8% כשהיה הסבר.
  - **מקורות בלבד:** הקבלה ירדה ל־68.2%. הדיוק בתשובות שגויות עלה ל־31.8%, מול 21.8% בלי כלום.
  - **הסבר ומקורות יחד:** הדיוק בתשובות שגויות היה 23.1% בלבד.
  - **סתירות פנימיות בהסבר:** הדיוק בתשובות השגויות עלה ל־30.3%, מול 16.7%.
  - **ההמלצה:** להבליט את המקורות ולשים אותם מעל ההסבר.
- **Cite or Decline** — צ'אטבוט שמוגבל לחומרי הקורס ומעוגן בזמנים של ההרצאות. 833 הודעות — [arXiv 2609.01846](https://arxiv.org/html/2609.01846v1):
  - **ציטוטים:** 70.5% מההודעות כללו ציטוט. 0 ציטוטים מקורס אחר, מתוך 4,109.
  - **סירוב:** 82.1% מההודעות בלי ציטוט היו סירוב מפורש.
  - **ביקורת אוטומטית:** 65.0% נתמכו במלואם; 86.3% במלואם או בחלקם; 11.3% לא נתמכו; 61.9% מהסירובים היו מוצדקים.
  - **המגבלות:** אין קבוצת ביקורת, ו־656 מתוך 833 ההודעות הגיעו מקורס אחד.
- **"Towards Verifiable Text Generation with Symbolic References" (SymGen)** (Hennigen et al.; arXiv 2023) — ציטוט סמלי לשדה במקור. זמן האימות ירד מ־2.50 ל־1.98 דקות, כ־20% — [arXiv 2311.09188](https://arxiv.org/abs/2311.09188).

#### ג. הסברים: מגדילים קבלה, לא בהכרח דיוק
- **"Does the Whole Exceed its Parts? The Effect of AI Explanations on Complementary Team Performance"** (Bansal et al.; CHI 2021) — הסברים הגדילו את הקבלה של המלצת ה־AI בלי קשר לנכונותה. הם לא שיפרו ביצועים יותר מהצגת ביטחון בלבד — [arXiv 2006.14779](https://arxiv.org/abs/2006.14779).
- **"Explanations Can Reduce Overreliance on AI Systems During Decision-Making"** (Vasconcelos et al.; CSCW 2023) — N=731. הסבר מפחית הסתמכות־יתר רק כשהוא מוזיל את עלות האימות בפועל, לעומת עלות פתרון המשימה לבד — [arXiv 2212.06823](https://arxiv.org/abs/2212.06823).
- **"Large Language Models Help Humans Verify Truthfulness — Except When They Are Convincingly Wrong"** (Si et al.; NAACL 2024) — 80 משתתפים בבדיקת עובדות. הסבר של LLM מהיר יותר מחיפוש עצמאי, אבל מוביל להסתמכות־יתר כשהוא שגוי. הסבר ניגודי (בעד ונגד) עזר רק חלקית — [ACL Anthology](https://aclanthology.org/2024.naacl-long.81).
- **"What Large Language Models Know and What People Think They Know"** (Steyvers et al.; Nature Machine Intelligence 2025) — [arXiv 2401.13835](https://arxiv.org/abs/2401.13835):
  - **אורך ההסבר:** הסבר ארוך יותר העלה את ביטחון המשתמשים בלי לשפר את הדיוק שלהם.
  - **התאמת הניסוח:** כשהניסוח הותאם לביטחון הפנימי של המודל, הפער בין ביטחון המשתמש לנכונות קטן.

#### ד. ביטחון ואי־ודאות: מה עובד בתצוגה
- **"'I'm Not Sure, But...': Examining the Impact of Large Language Models' Uncertainty Expression on User Reliance and Trust"** (Kim et al.; FAccT 2024) — N=404. ניסוח מסויג בגוף ראשון ("I'm not sure, but…") הוריד את ההסתמכות על תשובות שגויות והעלה את הדיוק. ניסוח כללי, לא בגוף ראשון, השפיע פחות ולא באופן מובהק — [arXiv 2405.00623](https://arxiv.org/abs/2405.00623).
- **"Effects of LLM-based Search on Decision Making: Speed, Accuracy, and Overreliance"** (Spatharioti, Rothschild, Goldstein, Hofman; CHI 2025) — [Spatharioti et al.](https://dangoldstein.com/papers/spatharioti_rothschild_goldstein_hofman_LLM_Search_CHI25.pdf):
  - **זמן החלטה:** 3.4 דקות בחיפוש רגיל, 1.6 דקות בחיפוש מבוסס LLM.
  - **דיוק במשימה שבה ה־LLM נוטה לטעות:**
    - בלי הדגשה: 26%.
    - הדגשה של קטעים בביטחון גבוה (ירוק) ונמוך (אדום): 58%.
    - הדגשה של קטעים בביטחון נמוך בלבד: 53%.
    - ההדגשה התבססה על הסתברות הטוקן, בסף של 50%.
  - **המנגנון:** מי שראה סימון אדום שאל שאלת המשך כדי לבדוק. זה עלה מעט זמן.
  - **דירוג החוויה:** ירד מעט, לא באופן מובהק (4.2 / 3.9 / 3.7).
  - **משוב חופשי:** משתמשי ההדגשה התלוננו יותר על היעדר מקורות לבדיקה.
- **"Generation Probabilities Are Not Enough: Uncertainty Highlighting in AI Code Completions"** (Vasconcelos et al.; ACM TOCHI 2025) — n=30 מתכנתים. הדגשה לפי הסבירות שהקטע ייערך בפועל עדיפה. הדגשה לפי הסתברויות הייצור של המודל לא עזרה — [arXiv 2302.07248](https://arxiv.org/abs/2302.07248).
- **"Facilitating Human-LLM Collaboration through Factuality Scores and Source Attributions"** (Do et al.; arXiv 2024) — N=104. המשתתפים העדיפו הדגשה צבעונית של אמינות ברמת הביטוי, יחד עם שיוך למקור — [arXiv 2405.20434](https://arxiv.org/abs/2405.20434).
- **"HILL: A Hallucination Identifier for Large Language Models"** (Leiser et al.; CHI 2024) — ממשק שמסמן חשד להזיה, ומציג ציון ביטחון וקישורי מקור — [arXiv 2403.06710](https://arxiv.org/abs/2403.06710).

#### ה. חיכוך מכוון (cognitive forcing)
- **"To Trust or to Think: Cognitive Forcing Functions Can Reduce Overreliance on AI in AI-assisted Decision-making"** (Buçinca, Malaya, Gajos; CSCW 2021) — 199 משתתפים. כפיית מחשבה (למשל: להחליט לפני שרואים את ההמלצה) הורידה הסתמכות־יתר יותר מהסברים רגילים. אבל המשתמשים אהבו את התנאים האלה פחות: טרייד־אוף מובנה בין שביעות רצון לביצוע — [Harvard](https://www.eecs.harvard.edu/~kgajos/papers/2021/bucinca2021trust.shtml).

#### ו. תוויות AI, גילוי ושקיפות
- **"People are skeptical of headlines labeled as AI-generated, even if true or human-made, because they assume full AI automation"** (Altay & Gilardi; PNAS Nexus 2024) — N=4,976 — [DOI](https://doi.org/10.1093/pnasnexus/pgae403):
  - **ההשפעה:** תווית "AI‑generated" הורידה את האמינות הנתפסת של כותרות, גם כשהן נכונות או נכתבו בידי אדם.
  - **גודל ההשפעה:** קטן בערך פי 3 מתווית "false".
  - **ההסבר:** אנשים מניחים אוטומציה מלאה.
  - **ההמלצה:** להסביר מה בדיוק התווית אומרת.
- **"AI-Enabled Human Memory Manipulation: Misleading AI-Generated Summaries Distort Human Memory"** (Sim, Kohno, Eiger; AIES 2026; arXiv 2609.28820) — [arXiv](https://arxiv.org/abs/2609.28820); [כתבה ב־News‑Medical](https://www.news-medical.net/news/20260925/AI-generated-video-summaries-can-reshape-peoples-memories-of-events.aspx):
  - **השמטות:** סיכומי וידאו של ChatGPT ו־Gemini השמיטו בממוצע 51.6% מהפרטים המרכזיים. כמעט כולם (95%) השמיטו את האירוע המרכזי, ההתנגשות.
  - **הניסוי (N=331):** 83.6% ענו נכון אחרי סיכום מדויק, מול 44.8% אחרי סיכום עם פרט אחד שגוי.
  - **תווית:** ההשפעה לא הייתה תלויה בשאלה אם נאמר שהסיכום נכתב בידי AI או בידי אדם.
  - **המגבלה:** סרטוני אנימציה, לא צילום אמיתי.
- **"Guidelines for Human-AI Interaction"** (Amershi et al.; CHI 2019) — 18 הנחיות, שנבדקו עם 49 מעצבים — [Microsoft Research](https://www.microsoft.com/en-us/research/publication/guidelines-for-human-ai-interaction/). הרלוונטיות ללשונית:
  - G1 "Make clear what the system can do"
  - G2 "Make clear how well the system can do what it can do"
  - G9 "Support efficient correction"
  - G10 "Scope services when in doubt"
  - G11 "Make clear why the system did what it did"
  - G12 "Remember recent interactions"
  - G15 "Encourage granular feedback"
  - G17 "Provide global controls"
  - G18 "Notify users about changes"
- **Generative Lecture** — הכותבים ממליצים על זהות AI מפורשת, ציטוטים ומחווני ביטחון, שליטה ידנית, וזהירות מעומס יכולות — [arXiv 2512.21796](https://arxiv.org/html/2512.21796).

### Inferences
- **הראיה צריכה להיות בתוך הקריאה.** הבעיה המרכזית אינה עיצוב הצ'יפ אלא עלות האימות. אם הראיה דורשת לחיצה ומעבר, כ־60% לא יראו אותה לעולם. לכן היא צריכה להופיע במקום: ציטוט קצר מהתמליל, עם זמן ופריים, שנפתח בתוך הטקסט. כך עולה מ־Kim 2025, Pew, Qlarify ו־Vasconcelos 2023.
- **ציטוט שלא נבדק מזיק יותר מהיעדר ציטוט.** הוא מגדיל אמון גם כשהוא שגוי (Ding). לכן כל קישור לזמן צריך לעבור בדיקת תמיכה אוטומטית: האם המשפט נתמך במילים שבחלון הזמן? אם לא, הקישור לא מוצג כראיה.
- **הדגשת נקודות חלשות היא הכלי הזול והחזק ביותר.** אבל היא עובדת רק כשהאות מתואם עם טעויות אמיתיות. אצלנו האות הטבעי הוא מידת התמיכה של המשפט בתמליל או בשקופית באותו זמן, ולא הסתברות הטוקן (Spatharioti מול Vasconcelos TOCHI).
- **נוסח הסיוג משנה.** "לא מצאתי את זה במפורש בהרצאה" בגוף ראשון עדיף על הערה כללית (Kim FAccT). אבל אם כל נקודה מסויגת, הסיוג מאבד ערך.
- **מקורות מעל ההסבר, והסבר קצר.** הסבר ארוך מנפח ביטחון (Steyvers, Bansal).
- **תווית AI כללית לא מספיקה.** היא לא מגינה מעיוות זיכרון (Sim et al.). צריך לסמן ספציפית מה הושמט ומה לא אומת.

### Gaps
- **תצוגה מקדימה של רגע:** לא נמצא מחקר מבוקר על תצוגה מקדימה של רגע בווידאו (פריים, נגן מיני או ציטוט עם זמן) ככלי אימות, מעבר לדירוגי תפיסה ב־Cite or Decline. גם לא נמצא מחקר שמשווה ציטוט־זמן לחיץ לציטוט טקסט שנפתח במקום.
- **סוג המשימה:** כל מחקרי ההסתמכות נעשו על שאלות ותשובות, חיפוש או קוד. אין מחקר על סיכום הרצאה ארוך כמסמך.
- **עברית:** לא נמצאו מחקרים על מחווני ביטחון או על ניסוח סיוג בעברית.
- **מקורות חלשים:** את המאמר של NN/g על "Magic 8‑ball" ראיתי רק דרך תקציר חיפוש. מקום הפרסום הסופי של SymGen ו־Do et al. לא אומת.

## 3. קריאה של ניתוח ארוך בטלפון: חשיפה הדרגתית, מתאר מתקפל, נגן דביק, זיכרון מיקום ו־bottom sheets

### Takeaway
בתוכן קל עד בינוני, ההבנה בטלפון לא נופלת מזו שבמחשב (n=276, 2016). תוכן קשה נקרא בטלפון לאט יותר. מטא־אנליזה מראה יתרון קטן לנייר על מסכים (g=−0.21), שגדל תחת לחץ זמן ובטקסט עיוני. גלילה פוגעת בעיקר בבעלי זיכרון עבודה נמוך.

הדפוסים הנתמכים בראיות:
- **כותרות:** בולטות, שמתאימות לסריקת layer‑cake.
- **קטעים מקופלים, לא לשוניות:** 8% מול 27% החמצה.
- **מצב פתוח:** כמה קטעים פתוחים יחד, והמצב נשמר.
- **"בעמוד הזה":** בראש העמוד.
- **כותרת דביקה:** רזה, ומופיעה בגלילה למעלה (300–400ms).
- **bottom sheet לא מודאלי:** עם Back וכפתור סגירה, בלי ערימה.
- **מיקום הגלילה:** נשמר בתוך הסשן (30–60 דקות).

אין ראיות אמפיריות על נגן מוקטן דביק בזמן קריאה.

### Cited Findings

#### א. האם קריאה בטלפון פוגעת בהבנה?
- **NN/g — "Reading Content on Mobile Devices"** (Moran, 11.12.2016). 276 משתתפים ו־1,629 מקרים של מאמר ובוחן — [NN/g](https://www.nngroup.com/articles/mobile-content/):
  - **הבנה:** בטלפון גבוהה בכ־3 נקודות אחוז (p=0.0006). הכותבים מגדירים את ההבדל "not practically significant".
  - **מהירות:** מאמרים קשים נקראו בטלפון לאט יותר, בכ־30 מילישניות למילה.
- **NN/g — "Mobile Content Is Twice as Difficult"** (Nielsen, 2011) — במבחן cloze ההבנה הייתה 39.18% במחשב מול 18.93% בטלפון. ממצא ישן, שהמחקר מ־2016 לא שחזר — [NN/g](https://nngroup.com/articles/mobile-content-is-twice-as-difficult-2011).
- **"Don't throw away your printed books: A meta-analysis on the effects of reading media on reading comprehension"** (Delgado, Vargas, Ackerman, Salmerón; Educational Research Review 2018) — 54 מחקרים ו־171,055 משתתפים — [DOI](https://doi.org/10.1016/j.edurev.2018.09.003); [PDF](https://www.uv.es/lasalgon/papers/Delgado%202018%20dont%20throw%20away%20your%20printed%20books.pdf):
  - **יתרון לנייר:** g=−0.21.
  - **מה מגדיל אותו:** קריאה בלחץ זמן, ושנות פרסום מאוחרות יותר (היתרון גדל עם השנים).
  - **סוג הטקסט:** עקבי בטקסטים עיוניים, לא בטקסטים סיפוריים בלבד.
- **"To Scroll or Not to Scroll: Scrolling, Working Memory Capacity, and Comprehending Complex Texts"** (Sanchez & Wiley; Human Factors 2009) — פורמט גלילה פגע בהבנה של נושאים מורכבים, במיוחד אצל בעלי יכולת זיכרון עבודה נמוכה — [DOI](https://doi.org/10.1177/0018720809352788).
- **"The effect of mobile screen size on video based learning"** (Maniar et al.; Journal of Software 2008) — מסך קטן פגע בלמידה מווידאו. יש סתירות בין גרסאות התקציר, ולכן זו ראיה חלשה — [University of Portsmouth](https://researchportal.port.ac.uk/en/publications/the-effect-of-mobile-screen-size-on-video-based-learning/).

#### ב. איך סורקים
- **NN/g — "The Layer-Cake Pattern of Scanning Content on the Web"** (Pernice, 2019) — [NN/g](https://www.nngroup.com/articles/layer-cake-pattern-scanning/):
  - **הדפוס:** הקיבוע נופל בעיקר על כותרות וכותרות משנה, עם קפיצות מכוונות לגוף הטקסט. לפי הכותבת, זו הדרך היעילה ביותר לסרוק, חוץ מקריאה מלאה.
  - **הנחיות:**
    - כותרות שבולטות באופן עקבי.
    - כל כותרת מתארת את כל התוכן שתחתיה, ורק אותו.
    - חלוקה לנתחים.
    - קירבה ברורה בין כותרת לגוף.
- **NN/g — "F-Shaped Pattern of Reading on the Web"** (Pernice, 2017; נסקר שוב 19.8.2026) — [NN/g](https://www.nngroup.com/articles/f-shaped-pattern-reading-web-content/):
  - **איפה:** הדפוס קיים גם בטלפון, ובערבית הוא מופיע הפוך ("flipped F").
  - **מתי הוא קורה:** כשהטקסט לא מעוצב, המשתמש רוצה להיות יעיל, ואין לו עניין לקרוא כל מילה.
  - **התרופות:**
    - הנקודות החשובות בשתי הפסקאות הראשונות.
    - כותרות שמתחילות במילים האינפורמטיביות.
    - הדגשת מילות מפתח.
    - תבליטים.
- **NN/g — "Text Scanning Patterns: Eyetracking Evidence"** (Pernice, 2019) — סקירה של כל דפוסי הסריקה שנמדדו — [NN/g](https://nngroup.com/articles/text-scanning-patterns-eyetracking/).

#### ג. חשיפה הדרגתית, אקורדיונים, קטעים מקופלים ולשוניות
- **NN/g — "Progressive Disclosure"** (Nielsen, 2006) — להציג קודם את מה שחשוב, ואת המתקדם לפי בקשה — [NN/g](https://www.nngroup.com/articles/progressive-disclosure/).
- **NN/g — "Accordions for Complex Website Content on Desktops"** (Loranger, 2014) — [NN/g](https://www.nngroup.com/articles/accordions-complex-content/):
  - **מתי הם עוזרים:** בטלפון אנשים מפסיקים לגלול לפני סוף עמוד ארוך. הכותרות משמשות "mini‑IA" של העמוד.
  - **מתי להימנע:** "Accordions should be avoided when your audience needs most or all of the content on the page".
  - **איך לבנות:**
    - לאפשר כמה קטעים פתוחים בבת אחת, ולשמור את מצבם.
    - הכותרות חייבות להיות מושכות מספיק כדי שילחצו עליהן.
- **Baymard** — קטעים מקופלים מול לשוניות אופקיות (תקציר חיפוש) — [Baymard](https://baymard.com/blog/avoid-horizontal-tabs):
  - **החמצת תוכן:** רק 8% החמיצו תוכן בקטעים מקופלים, מול 27% בלשוניות אופקיות.
  - **בטלפון:** חלק מהלשוניות עצמן מוסתרות.
  - **ההמלצה:** קטעים מקופלים מתפקדים הכי טוב באתרי מובייל.
- **NN/g** (Wang, 2023) — לשוניות "have low discoverability", ואקורדיונים "shine through in mobile usage" — [NN/g](https://www.nngroup.com/articles/in-page-links-content-navigation/).

#### ד. ניווט בעמוד ארוך: תוכן עניינים וכותרות דביקות
- **NN/g — "In-Page Links for Content Navigation"** (Wang, 1.10.2023) — [NN/g](https://www.nngroup.com/articles/in-page-links-content-navigation/):
  - **השימוש בפועל:** מתוך 11 משתתפים, רק 2 לא השתמשו בקישורים בעמוד. השתמשו בהם כשהיה צורך מוגדר, ודילגו עליהם בחקירה פתוחה.
  - **התועלת:** תוכן עניינים בראש העמוד נתן מתאר, שעזר להחליט אם העמוד מתאים.
  - **מתי מתאים:** לתוכן ארוך שמתחלק לקטעים עם כותרות.
  - **תווית:** מומלצת תווית "On This Page" או "Table of Contents".
  - **מה מבלבל:** קישור בעמוד שנראה כמו קישור רגיל.
- **NN/g — "Sticky Headers: 5 Ways to Make Them Better"** (Laubheimer, 2021) — [NN/g](https://www.nngroup.com/articles/sticky-headers/):
  - **יחס תוכן־למעטפת:** 13:1 סביר, 2:1 לא.
  - **מטרות מגע:** לפחות 1×1 ס"מ.
  - **כותרת שמופיעה בגלילה למעלה:** "most frequently seen on mobile sites". היא מופיעה אחרי גלילה קטנה למעלה, בהחלקה של "roughly 300–400ms".

#### ה. Bottom sheets
- **NN/g — "Bottom Sheets: Definition and UX Guidelines"** (Laubheimer, 11.6.2023) — [NN/g](https://www.nngroup.com/articles/bottom-sheet/):
  - **מה זה:** סוג של חשיפה הדרגתית. מתאים כשצריך להמשיך לראות את התוכן שמאחור.
  - **מודאלי מול לא מודאלי:** גיליון מודאלי חוסם את הרקע. גיליון לא מודאלי מאפשר להמשיך לעבוד עם הרקע.
  - **ההנחיות:**
    - "supporting the use of Back for dismissing the bottom sheet".
    - כפתור Close גלוי, ולא רק ידית גרירה.
    - לא לערום גיליונות.

#### ו. שמירת מיקום וחזרה למקום
- **NN/g — שמירת מיקום הגלילה** (Chan, 11.7.2025). המאמר לא מביא נתונים כמותיים — [NN/g](https://www.nngroup.com/articles/saving-scroll-position/):
  - **לשמור:** כשחוזרים באותו סשן, "roughly up to 30–60 minutes after the last user action".
  - **לאפס:** אחרי פער ארוך, או כשהתוכן השתנה, עם סימון ברור.
  - **כשהכוונה לא ברורה:** לשמור, ולתת דרך קלה לאפס.
- **Baymard** — 13% מהאתרים מחזירים את המשתמש לראש הרשימה כשהוא חוזר מעמוד מוצר. צורך כזה "למצוא שוב" נצפה כגורם ישיר לנטישה (תקציר חיפוש) — [Baymard](https://baymard.com/blog/return-same-place).

### Inferences
- **מבנה לסריקה.** הניתוח הוא מסמך ארוך, ולכן המבנה שלו צריך להתאים ל־layer‑cake: כותרות פרקים שמתארות את כל התוכן, והמסקנה בראש כל קטע. כך גם מי שרק סורק יוצא עם התמונה הכוללת.
- **פרקים מקופלים, עם מתג "פתח הכל".** בטלפון עדיף לקפל פרקים מאשר לפצל ללשוניות (תוצאות, ציטוטים, שאלות). אבל מי שצריך את רוב התוכן, למשל בחזרה למבחן, צריך מתג "פתח הכל", כי אקורדיונים מזיקים כשקוראים כמעט הכל.
- **שני מצבי שימוש, שתי תצוגות.** "קורא בלחץ זמן" ו"לומד בעיון" (Delgado: יתרון הנייר גדל בלחץ זמן). התקציר המובנה משרת את הראשון. המסמך המלא עם הקישורים משרת את השני.
- **חלוקה מפורשת היא גם נגישות קוגניטיבית.** גלילה ארוכה בלי מבנה פוגעת יותר בבעלי זיכרון עבודה נמוך (Sanchez & Wiley). פרקים מוגדרים וסימני מיקום ("פרק 3 מתוך 7") עוזרים בדיוק לקבוצה הזו.

### Gaps
- **נגן מוקטן דביק ו־PiP:** לא נמצא מחקר אמפירי על נגן מוקטן דביק או PiP בזמן קריאת טקסט מקושר, לא בטלפון ולא בכלל. זה פער מהותי, שכדאי לבדוק אצלנו.
- **bottom sheet מול הרחבה במקום:** לא נמצאו ראיות כמותיות לבחירה ביניהם לתצוגה מקדימה של ראיה.
- **Baymard:** הממצאים נלקחו מתקצירי חיפוש. גוף המחקר נמצא מאחורי חומת תשלום.

## 4. דו־לשוניות ו־RTL: עברית, ערבית וטקסט מעורב

### Takeaway
המחקר הישיר היחיד על דוברי עברית (Goldenberg & Tractinsky, CHI 2021, 234 משתתפים) מראה העדפה ל־LTR ברכיבים "מתמטיים":
- slider: 90%;
- ציר זמן: 69%;
- גרף מגמה: 91%;
- טווחי שעות ושנים: 80–87%;
- פס הגלילה של הדפדפן: 69%.

זה סותר חלק מההנחיות. ההנחיות תאמו את ההעדפות רק ב־3 מתוך 7 הרכיבים שהן מתייחסות אליהם.

ההנחיות גם סותרות זו את זו בנגן מדיה:
- **Material:** "Media controls for playback are always LTR".
- **Apple:** להפוך פקדים שמראים התקדמות.

הנתונים הקיימים על העברית נוטים לציר זמן LTR גם בנגן. אבל אף מחקר לא בדק פס ניגון של וידאו אצל דוברי עברית.

כללים שנתמכים בשני המקורות ובתקני W3C:
- לשקף את הממשק ואת הניווט;
- לא להפוך ספרות;
- לבודד טקסט מעורב עם `dir`, `dir=auto` ו־`<bdi>`;
- לסמן `lang` למקטעים בשפה אחרת.

### Cited Findings

#### א. מה דוברי עברית מעדיפים בפועל
- **"Towards the Right Direction in BiDirectional User Interfaces"** (Goldenberg & Tractinsky, אוניברסיטת בן־גוריון; CHI 2021). 234 משתתפים, 228 מהם דוברי עברית כשפת אם — [arXiv 2101.08070](https://arxiv.org/abs/2101.08070); [DOI](https://doi.org/10.1145/3411764.3445461):
  - **התפלגות ההעדפות:** מתוך 27 רכיבים, 13 הועדפו ב־LTR, 8 ב־RTL, ול־6 לא הייתה העדפה ברורה.
  - **העדפות LTR:**
    - Slider: 90% (z=12.09).
    - Trend graph: 91%.
    - Timeline: 69% (z=5.82).
    - Bar chart: 68%.
    - טווח שעות ("09:00 עד 21:00"): 80%.
    - טווח שנים: 87%.
    - פס הגלילה של הדפדפן: 69%.
  - **העדפות RTL:** Star rating הועדף ב־RTL (62%). פס גלילה פנימי באתר: אין העדפה (RTL 54%).
- **ההתאמה להנחיות** — [arXiv 2101.08070](https://arxiv.org/abs/2101.08070):
  - **רק 3 מתוך 7:** ההעדפות תאמו את הכיוון שההנחיות ממליצות עליו רק ב־3 מתוך 7 הרכיבים שההנחיות מזכירות.
  - **Timeline ו־slider:** ההנחיות של Apple ו־Google ממליצות RTL, וההעדפה בפועל הייתה LTR.
  - **20 מתוך 32:** ל־20 מתוך 32 הרכיבים שנמצאו לא עקביים באתרים, אין בכלל המלצה בהנחיות.
  - **רקע מהסקירה:** דפוס Z הפוך, העדפה לסקאדות לימין, ו"קפיצות" עיניים במעבר בין כיוונים באותו משפט.
- **"AmBiDiguity does exist: UI item Direction Interpretation by Bidirectional Users"** (Goldenberg & Tractinsky; CHI EA 2023). רכיבים עם מידע שאפשר לקרוא בשני הכיוונים חשופים לשימוש שגוי (תקציר) — [DOI](https://doi.org/10.1145/3544549.3585598).
- **"Exploring amBiDiguity: UI item direction interpretation by Arabic and Hebrew users"** (International Journal of Human-Computer Studies 2024) — 1,705 משתתפים (תקציר חיפוש) — [ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S1071581924001666):
  - **פירוש LTR:** 11 רכיבים בערבית ו־10 בעברית.
  - **undo/redo:** הפירוש היה חלוק.
  - **הסכמה:** רק ב־8 מתוך 32 השוואות הייתה הסכמה מעל 80%.
  - **הקשר:** יישור ההקשר יכול להפוך את הפירוש.

#### ב. הנחיות התעשייה, והסתירה ביניהן
- **Apple Human Interface Guidelines — "Right to left"** — [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/right-to-left):
  - **ספרות:** "Don't reverse the order of numerals in a specific number". העברית משתמשת בספרות מערביות.
  - **פקדי התקדמות:** "Flip controls that show progress from one value to another".
  - **ניווט:** "Flip controls that help people navigate or access items in a fixed order"; כפתור חזרה מצביע ימינה.
  - **כיוון ממשי:** לא להפוך פקד שמצביע על כיוון ממשי במסך.
  - **גופן:** "increase the RTL font size by about 2 points" ליד טקסט לטיני.
  - **יישור:** "Align a paragraph based on its language, not on the current context".
  - **נגן מדיה:** לא מוזכר במפורש.
- **Material Design (m1) — Bidirectionality** — [Material](https://m1.material.io/usability/bidirectionality.html):
  - **נגן מדיה:** "Do not mirror media playback buttons and the media progress indicator"; "Media controls for playback are always LTR".
  - **מה כן משקפים:** פס התקדמות רגיל מתחיל ב־0% מימין; "an action that happens over time should be mirrored"; חצים.
  - **מה לא משקפים:** שעונים מסתובבים עם כיוון השעון; מספרים, כולל שעון ומספרי טלפון.
  - **הסתירה:** Material מבחין בין פס התקדמות כללי (משוקף) לפס של נגן מדיה (LTR). Apple לא עושה את ההבחנה הזו.

#### ג. תקני רשת לטקסט מעורב
- **W3C — "Inline markup and bidirectional text in HTML"** — [W3C](https://www.w3.org/International/articles/inline-bidi-markup/):
  - **כיוון ידוע:** לעטוף בצמוד כל ביטוי בכיוון ההפוך, עם `dir`.
  - **טקסט שנכנס בזמן ריצה:** `dir="auto"`, או `<bdi>` כשאין עטיפה.
  - **"spillover":** תקלה כשביטוי הפוך צמוד למספר, או מתחיל או נגמר בסימני פיסוק.
  - **עדיפות:** markup עדיף על תווי בקרה, ותווי בקרה רק לביטויים ולא לפסקאות.
- **W3C — "Hebrew Layout Requirements" (hlreq, טיוטת עורך)** — [W3C](https://w3c.github.io/hlreq/):
  - **הדגשה:** בבולד נפוצה יותר מאיטליק. ריווח אותיות משמש להבלטת מונחים ושמות.
  - **ניקוד:** טקסט מנוקד אולי ידרוש גודל גדול יותר.
  - **מה לא מכוסה:** הטיוטה לא עוסקת במספרים, בזמנים או בבידוד דו־כיווני.
- **WCAG 2.2, SC 3.1.2 Language of Parts (AA)** — שפת כל מקטע צריכה להיות ניתנת לזיהוי תוכנתי. יוצאים מהכלל: שמות פרטיים, מונחים טכניים ומילים שהפכו לחלק מהשפה הסובבת — [W3C](https://www.w3.org/TR/WCAG22/).

#### ד. קוגניציה וקריאה בעברית
- **"Cross-cultural differences in mental representations of time: Evidence from an implicit nonlinguistic task"** (Fuhrman & Boroditsky; Cognitive Science 2010, 34(8)) — במשימה לא מילולית, דוברי עברית סידרו זמן מימין לשמאל, ודוברי אנגלית משמאל לימין — [PDF](https://escholarship.org/content/qt68k986hb/qt68k986hb.pdf).
- **Pollatsek, Bolozky, Well, Rayner** (Brain and Language 1981) — טווח הקליטה בקריאת עברית מורחב שמאלה, בכיוון הקריאה. מסוכם אצל Henderson & Ferreira (JEP:LMC 1990) — [PDF](https://ferreiralab.faculty.ucdavis.edu/wp-content/uploads/sites/222/2015/05/Henderson-Ferreira-1990_FovealProcessingDifficulty_JEPLMC.pdf).
- **"Standardized Assessment of Reading Performance: The New International Reading Speed Texts IReST"** (Trauzettel‑Klosinski & Dietz; IOVS 2012) — 17 שפות, 25 קוראים לכל שפה, קריאה בקול — [DOI](https://doi.org/10.1167/iovs.11-8284):
  - **מילים לדקה:** עברית 187 (SD 29), אנגלית 228, ערבית 138. הממוצע לכל השפות: 184.
  - **טקסטים לדקה:** דומה בין השפות (עברית 1.54, אנגלית 1.49), כי בטקסטים בעברית ובערבית יש פחות תווים ומילים.
- **NN/g** — דפוס F הפוך נצפה בקריאה בערבית — [NN/g](https://www.nngroup.com/articles/f-shaped-pattern-reading-web-content/).

### Inferences
- **ציר הזמן של הנגן: LTR, ולבדוק.** הראיה הטובה ביותר שיש (סקר העדפות בעברית, ציר זמן 69% LTR ו־slider 90%), יחד עם Material, תומכת בציר זמן ופקדי ניגון LTR גם בממשק RTL. אבל:
  - **עקומת הזמן המנטלית בעברית היא RTL** (Fuhrman & Boroditsky). זו סתירה בין קוגניציה מרומזת להעדפה מפורשת.
  - **"Timeline" בסקר** הוא ציר אירועים, לא בהכרח פס ניגון.
  
  לכן זו החלטה שכדאי לבדוק עם משתמשים שלנו.
- **חותמות זמן.** "12:34" הוא מספר LTR בתוך משפט עברי. צריך לעטוף אותו (`<bdi>` או `dir="ltr"`) כדי שלא "יזלוג" לסימני פיסוק ולמונחים באנגלית שלידו.
- **מונחים וציטוטים באנגלית.** מונח טכני בודד לא חייב `lang` (חריג ב־3.1.2). ציטוט שלם באנגלית מהתמליל כן: `lang="en"` ו־`dir="ltr"`, מיושר לפי השפה שלו.
- **הערכת זמן קריאה.** אי אפשר להעתיק נוסחת מילים לדקה מאנגלית. בעברית יש פחות מילים לאותו תוכן. אמת המידה ההוגנת היא "טקסטים לדקה", ושם השפות דומות.

### Gaps
- **טקסט מעורב:** לא נמצא מחקר מבוקר על עלות הקריאה של טקסט עברי־אנגלי מעורב (מהירות, הבנה, תנועות עיניים) בממשק טלפון.
- **נגן וידאו ב־RTL:** לא נמצא מחקר על כיוון ציר הזמן של נגן וידאו אצל דוברי עברית.
- **amBiDiguity:** לא ראיתי את הנתונים המלאים (ACM ו־ScienceDirect חסומים).
- **hlreq:** הטיוטה עדיין חלקית.

## 5. UX שמכוון ללמידה: שאלות לפני ואחרי, הנחיות להסבר עצמי, בחנים משובצים, ומה נמדד

### Takeaway
הראיה החזקה ביותר היא לתרגול שליפה, כלומר בחנים בתוך ההרצאה או אחריה:
- **מטא־אנליזה:** בחינה עדיפה על חזרה.
- **Szpunar (PNAS 2013):** נדידת המחשבה ירדה בחצי, היו פי 3 הערות, והזכירה השתפרה.

שאלות מקדימות עוזרות בהרצאות אמיתיות ארוכות רק למה שנשאל. הנחיות להסבר עצמי בווידאו, כשזמן הלמידה מבוקר, לא שיפרו ורק העלו עומס.

אינטראקטיביות ושליטה עוזרות, ו"עשייה" עדיפה על צפייה. AI בלי מעקות פוגע בלמידה העצמאית (−17%). AI שנותן רמזים ולא תשובות מנטרל את הנזק. סיכום שזמין מראש מצמצם צפייה ומוטיבציה.

### Cited Findings

#### א. בחנים משובצים ואפקט הבחינה
- **"Interpolated memory tests reduce mind wandering and improve learning of online lectures"** (Szpunar, Khan, Schacter; PNAS 2013) — הרצאת סטטיסטיקה של 21 דקות, ושני ניסויים — [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC3631699):
  - **נדידת מחשבה:** ירדה בערך בחצי, מכ־40% לכ־20%.
  - **הערות:** פי 3 הערות.
  - **זכירה וחרדה:** זכירה טובה יותר, ופחות חרדה מהמבחן המסכם.
- **"Rethinking the Use of Tests: A Meta-Analysis of Practice Testing"** (Adesope, Trevisan, Sundararajan; Review of Educational Research 2017) — "practice tests are more beneficial for learning than restudying and all other comparison conditions" — [DOI](https://doi.org/10.3102/0034654316689306).
- **"Effects of embedded questions in recorded lectures"** (van der Meij & Böckmann; Journal of Computing in Higher Education 2020) — N=40. שאלות פתוחות בלי משוב העלו את ציוני המבחן במובהק. המעורבות עלתה, אבל לא הייתה קשורה לציון — [DOI](https://doi.org/10.1007/s12528-020-09263-x).
- **"Evaluating the Impact of a Quiz Question within an Educational Video"** (Rice, Beeson, Blackmore‑Wright; TechTrends 2019) — n=102 ו־n=23. בחנים לאורך הסרטון שיפרו את ציוני המבחן במובהק. התפיסה של הסטודנטים לא הבחינה בהבדל, אבל ההערות החופשיות תמכו בבחנים — [DOI](https://doi.org/10.1007/s11528-019-00374-6).
- **"Improving the effectiveness of video-based flipped classrooms with question-embedding"** (Deng, Feng, Shen; Education and Information Technologies 2023) — 70 סטודנטים, שישה שבועות. שאלות משובצות שיפרו ביצוע. שביעות הרצון ומשך הצפייה לא השתנו — [DOI](https://doi.org/10.1007/s10639-023-12303-5).
- **Kovacs** (L@S 2016) — 74% מהצופים ניסו את הבוחן. הבחנים שימשו גם כעוגני ניווט: קפיצות מהבוחן לקטע שלפניו — [DOI](https://doi.org/10.1145/2876034.2876041).

#### ב. שאלות מקדימות
- **Carpenter & Toftness** (Journal of Applied Research in Memory and Cognition 2017) — 85 משתתפים, סרטון קצר. לשאלות המקדימות הייתה תועלת ספציפית (למה שנשאל) וגם כללית — [BPS Research Digest](https://www.bps.org.uk/research-digest/heres-simple-way-boost-your-learning-videos-prequestion).
- **"The limited effects of prequestions on learning from authentic lecture videos"** (Toftness, Carpenter, Lauber, Mickes; JARMAC 2018) — הרצאות אמיתיות של יותר מ־20 דקות — [DOI](https://doi.org/10.1016/j.jarmac.2018.06.003); [Royal Holloway](https://pure.royalholloway.ac.uk/en/publications/the-limited-effects-of-prequestions-on-learning-from-authentic-le/):
  - **מה שנשאל:** קבוצת השאלות המקדימות הצליחה יותר, בסך הכל ובמידע שנשאל עליו.
  - **מה שלא נשאל:** לא נבדל, או השתפר רק במעט.
  - **עניין:** התועלת לא הייתה תלויה בעניין בחומר.
- **פוסטר APS 2019** — התועלת הופיעה רק כשאותן שאלות הופיעו לפני ואחרי. ראיה חלשה (פוסטר) — [APS](https://www.psychologicalscience.org/conventions/archive/2019annual/paper/25415/).

#### ג. הסבר עצמי
- **Bisra, Liu, Nesbit, Salimi, Winne** (Educational Psychology Review 2018) — מטא־אנליזה של 69 אפקטים מ־64 דוחות. g=.55, רוב המחקרים על סטודנטים — [PDF](https://www.Gwern.net/doc/psychology/spaced-repetition/2018-bisra.pdf).
- **"Learning from interactive video: the influence of self-explanations, navigation, and cognitive load"** (Beege & Ploetzner; Instructional Science 2024) — N=128, זמן למידה מבוקר, תכנון 2×2 — [DOI](https://doi.org/10.1007/s11251-024-09693-5):
  - **למידה:** **לא הייתה השפעה** לניווט או להנחיות ההסבר העצמי.
  - **עומס:** ההנחיות העלו עומס פנימי ועומס חיצוני.
  - **איכות התשובות:** נמוכה בדרך כלל, אבל קשורה להבנה.

#### ד. אינטראקטיביות, שליטה ועשייה
- **"Instructional video in e-learning: Assessing the impact of interactive video on learning effectiveness"** (Zhang, Zhou, Briggs, Nunamaker; Information & Management 2006) — [Arizona](https://experts.arizona.edu/en/publications/instructional-video-in-e-learning-assessing-the-impact-of-interac/):
  - **וידאו אינטראקטיבי עם גישה אקראית לקטעים:** הביא ללמידה ולשביעות רצון גבוהות יותר.
  - **וידאו לא אינטראקטיבי:** לא היה טוב מהיעדר וידאו.
- **"Learning with videos vs. learning with print: The role of interactive features"** (Merkt, Weigand, Heier, Schwan; Learning and Instruction 2011) — וידאו עם יכולות אינטראקטיביות היה שקול לספר מאויר. הלומדים השתמשו ביכולות ביוזמתם (תקציר חיפוש) — [DOI](https://doi.org/10.1016/j.learninstruc.2011.03.004).
- **"Video Improves Learning in Higher Education: A Systematic Review"** (Noetel et al.; Review of Educational Research 2021) — 105 ניסויים, 7,776 סטודנטים — [AERA](https://www.aera.net/Newsroom/Video-Improves-Learning-in-Higher-Education-A-Systematic-Review):
  - **וידאו במקום הוראה קיימת:** g=0.28.
  - **וידאו בנוסף להוראה:** g=0.80.
- **Ibrahim, Antonenko, Greenwood, Wheeler** (Learning, Media and Technology 2012) — חלוקה, סימון וגיזום (segmenting, signaling, weeding) בווידאו שיפרו העברה וידע מבני, והורידו את הקושי הנתפס (תקציר חיפוש) — [Oklahoma State](https://scholars.okstate.edu/en/publications/effects-of-segmenting-signalling-and-weeding-on-learning-from-edu/).
- **"Learning is Not a Spectator Sport: Doing is Better than Watching for Learning from a MOOC"** (Koedinger, Kim, Jia, McLaughlin, Bier; L@S 2015) — [PDF](https://davis68.github.io/2016-12-12-ttt-uiuc/files/papers/koedinger-doing-watching-2015.pdf):
  - **ציונים:** סטודנטים שהוסיפו פעילויות אינטראקטיביות ל־MOOC קיבלו 66%, מול 57%.
  - **השפעה:** פעילות "עשייה" השפיעה על הלמידה יותר מצפייה.
  - **מגבלה:** הנתונים מתאמיים, עם שיטות להסקה סיבתית.
- **"An Active Viewing Framework for Video-Based Learning"** (Dodson, Roll, Fong, Yoon, Harandi, Fels; L@S 2018) — 460 סטודנטים. נגן שתומך בהדגשה, תגיות, הערות ותוכן עניינים (ViDeX) — [IUCC](https://cris.iucc.ac.il/en/publications/an-active-viewing-framework-for-video-based-learning/).

#### ה. AI ולמידה
- **"Generative AI without guardrails can harm learning: Evidence from high school mathematics"** (Bastani et al.; PNAS 2025) — ניסוי שטח עם כאלף תלמידים — [RePEc](https://ideas.repec.org/a/nas/journl/v122y2025pe2422633122.html):
  - **בתרגול עם GPT‑4:** GPT Base שיפר את הביצוע ב־48%, ו־GPT Tutor ב־127%. Tutor נותן רמזים, בלי לחשוף את הפתרון.
  - **במבחן בלי עזרה:** מי שהשתמש ב־GPT Base ירד ב־17% לעומת קבוצת ביקורת.
  - **המעקות:** של Tutor ביטלו כמעט את כל הנזק.
- **Garcia et al.** (ICAITE 2025) — כשהסיכום זמין לפני הצפייה, ירדו זמן הצפייה, ההבנה מסדר גבוה והמוטיבציה. הכותבים ממליצים להציג את הסיכום אחרי החשיפה, או בתוך תרגול שליפה — [Garcia et al.](https://manuelgarcia.info/publication/ai-video-summaries).
- **Generative Lecture** — שביעות רצון גבוהה, בלי הבדל בלמידה (p=.78) — [arXiv 2512.21796](https://arxiv.org/html/2512.21796).
- **Cite or Decline** — הסטודנטים רצו שאלות תרגול (4.59 מתוך 5) — [arXiv 2609.01846](https://arxiv.org/html/2609.01846v1).
- **"Is ChatGPT a good study companion?…"** (Computers and Education: Artificial Intelligence 2025) — לא נמצא הבדל בשימור ובהעברה (תקציר חיפוש בלבד; העמוד חסום) — [ScienceDirect](https://www.sciencedirect.com/science/article/pii/S2666920X25001523).

#### ו. מהירות ניגון
- **"Learning in double time: The effect of lecture video speed on immediate and delayed comprehension"** (Murphy, Hoover, Agadzhanyan, Kuehn, Castel; Applied Cognitive Psychology 2022) — יותר מ־200 סטודנטים — [PDF](https://castel.psych.ucla.edu/wp-content/uploads/sites/111/2022/03/Applied-Cognitive-Psychology-2021-Murphy-Learning-in-double-time-The-effect-of-lecture-video-speed-on-immediate-and.pdf):
  - **עד 2x:** כמעט בלי פגיעה בהבנה, מיידית ואחרי שבוע.
  - **ב־2.5x:** פגיעה ברורה.
  - **אמונות:** הסטודנטים האמינו שמהירות איטית עדיפה, בניגוד לתוצאות.

### Inferences
- **מצב לימוד = בחנים קצרים בין פרקים.** שאלה אחת עד שתיים בסוף כל פרק, שעונים עליהן לפני שרואים את התשובה. זה גם עוגן ניווט טבעי (Kovacs). התשובה מקושרת לרגע בסרטון.
- **שאלות מקדימות: במשורה.** רק כ"מה תדע אחרי הפרק", כי בהרצאה ארוכה הן עוזרות בעיקר למה שנשאל.
- **הסבר עצמי: רשות בלבד.** "הסבר במילים שלך" לא כברירת מחדל: בווידאו מבוקר זמן הוא מוסיף עומס בלי תועלת.
- **עוזר AI בלשונית: "רמז, לא פתרון".** במצב לימוד הוא לא נותן תשובות לבחנים, אלא רמזים והפניות לרגע בסרטון (Bastani).
- **סדר התצוגה לפי מטרה.**
  - **קורא עסקי:** הסיכום ראשון. זו המטרה שלו.
  - **סטודנט במצב לימוד:** אפשר להציע "צפה וענה, ואחר כך קרא את הסיכום". או לפחות להבליט את הבחנים לפני "התקציר המלא".

### Gaps
- **מדידה בממשקי ניתוח:** לא נמצא מחקר שבודק בחנים משובצים בתוך ממשק ניתוח טקסטואלי של הרצאה, ולא בתוך הנגן עצמו.
- **שאלות מ־LLM:** לא נמצא מחקר על איכות שאלות שנוצרו ב־LLM מהרצאה, ועל השפעתן על למידה.
- **מספרים חסרים:** גודל האפקט ב־Adesope וב־Ploetzner 2024 (g=0.52, דרך מקור משני) לא אומת מהטקסט המלא.

## 6. נגישות: WCAG 2.2 וטיוטת WCAG 3.0, חלופה למדיה מבוססת זמן, כתוביות ותמלילים, כשהניתוח מחליף את הסרטון

### Takeaway
אם הניתוח מחליף את הצפייה, הוא בעצם "alternative for time-based media". WCAG דורשת שמסמך כזה:
- יתאר את המידע החזותי והשמיעתי בסדר הנכון;
- יאפשר להשיג את תוצאות האינטראקציות שבזמן;
- יהיה צמוד למדיה.

טיוטת WCAG 3.0 (ספטמבר 2026) מוסיפה דרישות:
- **"Transcripts findable"** (ליבה): תמליל צמוד לסרטון.
- **תיאור מידע חזותי** בתמליל (ליבה).
- **"Media chapters available"** (משלים): פרקים לכל מדיה של 5 דקות ומעלה.
- **"Media alternatives searchable"** (משלים): חלופות שאפשר לחפש בהן.
- **"Summaries available"** (ליבה): תקציר לטקסט ארוך של 300 מילים ומעלה.

כלומר, הלשונית שאנחנו מתכננים היא כמעט תבנית של התקן.

הראיות על שימוש מראות שתמלילים משרתים את כולם:
- **רלוונטיות וזמן:** 25% קוראים בלי לצפות, 55% קוראים כדי לבדוק רלוונטיות, ו־46% כדי לחסוך זמן.
- **כתוביות:** 98.6% מהסטודנטים מוצאים אותן מועילות.

### Cited Findings

#### א. WCAG 2.2 (W3C Recommendation, 12.12.2024)
- **1.2.3 Audio Description or Media Alternative (Prerecorded)** (A): "An alternative for time-based media or audio description of the prerecorded video content is provided" — [WCAG 2.2](https://www.w3.org/TR/WCAG22/).
- **1.2.8 Media Alternative (Prerecorded)** (AAA): חלופה למדיה מבוססת זמן לכל מדיה מסונכרנת מוקלטת — [WCAG 2.2](https://www.w3.org/TR/WCAG22/).
- **3.1.2 Language of Parts** (AA) — שפת כל מקטע ניתנת לזיהוי תוכנתי, חוץ ממונחים טכניים ושמות — [WCAG 2.2](https://www.w3.org/TR/WCAG22/).
- **2.5.8 Target Size (Minimum)** (AA) — מטרה של לפחות 24×24 פיקסלי CSS, או ריווח מתאים — [WCAG 2.2](https://www.w3.org/TR/WCAG22/).
- **2.5.7 Dragging Movements** (AA) — כל פעולת גרירה ניתנת לביצוע גם בהצבעה אחת בלי גרירה. רלוונטי לגלילה בציר הזמן — [WCAG 2.2](https://www.w3.org/TR/WCAG22/).
- **2.4.11 Focus Not Obscured (Minimum)** (AA) — רכיב שמקבל פוקוס לא מוסתר לגמרי בתוכן של המחבר. רלוונטי לנגן דביק ולכותרת דביקה — [WCAG 2.2](https://www.w3.org/TR/WCAG22/).
- **1.4.10 Reflow** (AA) — בלי גלילה דו־ממדית ברוחב של 320 פיקסלי CSS — [WCAG 2.2](https://www.w3.org/TR/WCAG22/).
- **2.2.2 Pause, Stop, Hide** (A) — תוכן שזז או נגלל אוטומטית, נמשך יותר מ־5 שניות ומוצג לצד תוכן אחר, צריך מנגנון לעצור. רלוונטי לתמליל שנגלל אוטומטית — [WCAG 2.2](https://www.w3.org/TR/WCAG22/).
- **2.4.10 Section Headings** (AAA) — כותרות מארגנות את התוכן — [WCAG 2.2](https://www.w3.org/TR/WCAG22/).

#### ב. "Understanding 1.2.8": מהי חלופה למדיה מבוססת זמן
- **ההגדרה:** "document including correctly sequenced text descriptions of time-based visual and auditory information and providing a means for achieving the outcomes of any time-based interaction" — [W3C Understanding](https://www.w3.org/WAI/WCAG22/Understanding/media-alternative-prerecorded.html).
- **מה היא כוללת:** את כל המידע החזותי (פעולות, הבעות), צלילים שאינם דיבור, ותמליל דיאלוג, באותו סדר כמו במדיה. היא "reads something like a book" — [W3C Understanding](https://www.w3.org/WAI/WCAG22/Understanding/media-alternative-prerecorded.html).
- **טכניקות:**
  - G69 (חלופה למדיה) יחד עם G58 ("Placing a link to the alternative for time-based media immediately next to the non-text content").
  - כשל נפוץ: F74, חלופה שלא מסומנת ככזו.
  
  — [W3C Understanding](https://www.w3.org/WAI/WCAG22/Understanding/media-alternative-prerecorded.html).

#### ג. הנחיות WAI לתמלילים (עודכן 17.9.2024)
- **תמליל בסיסי מול תיאורי:**
  - **בסיסי:** דיבור וצלילים.
  - **תיאורי:** מוסיף את המידע החזותי.
  - **ההמלצה:** "Ideally you provide a descriptive transcript".
  
  — [WAI](https://www.w3.org/WAI/media/av/transcripts/).
- **תמליל אינטראקטיבי:** "highlight text phrases as they are spoken", וקפיצה לנקודה בווידאו בלחיצה על הטקסט — [WAI](https://www.w3.org/WAI/media/av/transcripts/).
- **מיקום:** "the transcript itself or a link to the transcript right under the video". באתר שלך, עדיף באותו עמוד — [WAI](https://www.w3.org/WAI/media/av/transcripts/).
- **מבנה:** פסקאות, רשימות וכותרות; זיהוי דוברים; טקסט מסך שלא הוקרא. חותמות זמן רק כשהן מועילות, כי לעיתים הן מוסיפות עומס — [WAI](https://www.w3.org/WAI/media/av/transcripts/).

#### ד. טיוטת WCAG 3.0 (Working Draft, 10.9.2026)
הסעיפים מתויגים "Developing", כלומר עדיין בשינוי — [WCAG 3.0](https://www.w3.org/TR/wcag-3.0/).
- **"Transcripts findable"** (Core): "A text transcript is adjacent to audio and video content".
- **תמליל תיאורי ומידע חזותי:**
  - "Descriptive transcripts are provided for prerecorded audio and video content" (Core).
  - "Visual information needed to understand the media is described in transcripts" (Core).
- **דוברים ושפות:**
  - זיהוי דוברים (Supplemental).
  - כשמדברים ביותר משפה אחת, מציינים את שפת כל דובר (Supplemental).
- **"Media alternatives searchable"** (Supplemental): "Alternatives for media can be searched and queried".
- **"Media chapters available"** (Supplemental): "Audio or video that lasts five minutes or longer can be navigated by chapters". הערת העורכים: צריך מחקר כדי לקבוע את סף הזמן.
- **"Summaries available"** (Core): תקציר לטקסט ארוך, שמזוהה חזותית ותוכנתית, בנוי ממשפטים קצרים ומסביר מילים נדירות. חל על עמוד עם 300 מילים ומעלה. הערת העורכים: הסף דורש מחקר.
- **בקרת מדיה:** "Page/view audio adjustable" (Core) — עצירה, הפסקה ושליטה בעוצמה של אודיו שמתנגן אוטומטית.

#### ה. ראיות על שימוש בתמלילים ובכתוביות
- **Linder, "Student Uses and Perceptions of Closed Captions and Transcripts"** (Oregon State Ecampus, 2016) — 2,124 סטודנטים ב־15 מוסדות — [WCET](https://wcet.wiche.edu/frontiers/2016/12/14/do-closed-captions-help-students-learn/):
  - **כתוביות:** 98.6% מוצאים אותן מועילות.
  - **תמלילים:** משמשים כמדריך ללימוד, ולמציאת מידע ושימורו.
  - **שומעים:** 71% מהסטודנטים בלי קושי שמיעה משתמשים בכתוביות לפחות לפעמים (מקור משני).
- **בלוג הנגישות של ממשלת בריטניה** (Walton, 13.3.2025) — סקר N=87 — [GOV.UK](https://accessibility.blog.gov.uk/2025/03/13/text-digitised-and-videotape-video-transcripts-help-everyone-not-just-people-with-access-needs/):
  - **התפלגות:** 28% צופים בלי תמליל; 25% קוראים בלי לצפות.
  - **סיבות לקריאה:** בדיקת רלוונטיות 55%; חיסכון בזמן 46%.
  - **סיבות לשילוב:** לא להחמיץ פרט 23%; העתקה למקום אחר 23%.
  - **ההמלצות:** לבדוק תמלילים אוטומטיים; לזהות דוברים; לתאר מידע חזותי חשוב.
- **"Video Captions Benefit Everyone"** (Gernsbacher; Policy Insights from the Behavioral and Brain Sciences 2015) — מעל 100 מחקרים: כתוביות משפרות הבנה, קשב וזיכרון — [PDF](https://successforkidswithhearingloss.com/wp-content/uploads/2020/04/Video-Captions-Benefit-Everyone_2015.pdf).
  - **ביקורת (Watson, Learning and the Brain):** הראיות חלשות יותר לתלמידים טיפוסיים עם כתוביות באותה שפה. חלק גדול מהמחקרים הם על שפה זרה, אוכלוסיות מיוחדות או דיווח עצמי. כדאי זהירות בגלל עקרון הכפילות (redundancy) של Mayer — [Learning and the Brain](https://www.learningandthebrain.com/blog/video-captions-benefit-everyone-an-investigation/).
- **Slidecho ו־SPICA** — מה שהמרצה לא אומר בקול (20% מהטקסט ו־30% מהתמונות בשקופיות) לא נגיש למשתמש עיוור בלי תיאור — [DOI](https://doi.org/10.1145/3441852.3471234); [arXiv 2402.07300](https://arxiv.org/abs/2402.07300).
- **Munteanu et al.** (CHI 2006) — תמליל עם WER של 45% לא מספק; עם 25% ומטה הוא שימושי (תקציר חיפוש) — [DBLP](https://dblp.org/rec/conf/chi/MunteanuBPTJ06.html).

### Inferences
- **הניתוח כחלופה מלאה למדיה.** אם הוא כולל תמליל תיאורי (כולל תוכן השקופיות), בסדר הנכון, צמוד לסרטון ומסומן ככזה, הוא עומד ב־1.2.3 ומתקרב ל־1.2.8. כך הנגישות הופכת ליתרון מוצר ולא לעלות.
- **ה"ניתוח" הוא לא תמליל.** סיכום AI עם השמטות (Sim et al.) הוא לא חלופה מלאה. לכן צריך גישה גם לתמליל המלא, התיאורי והאינטראקטיבי, מתוך הלשונית.
- **חובות שיחולו על נגן דביק:**
  - חלופה לגרירה בציר הזמן (2.5.7);
  - מטרות של 24px לפחות (2.5.8);
  - לא להסתיר פוקוס (2.4.11);
  - עצירת גלילה אוטומטית של התמליל (2.2.2).

### Gaps
- **אין עדיין תקן סופי.** WCAG 3.0 היא טיוטה, והספים (5 דקות, 300 מילים) מסומנים כ"דורשים מחקר".
- **משתמשי קורא מסך:** לא נמצא מחקר על ניתוח וידאו ארוך שנוצר ב־AI כחלופה למדיה.
- **כתוביות בשפה שנייה:** המטא־אנליזה של Montero Perez et al. (System 2013) לא נקראה, והמספרים שלה לא אומתו — [DOI](https://doi.org/10.1016/j.system.2013.07.013).

## 7. סינתזה: עקרונות ודפוסי UX ללשונית "ניתוח וידאו", כל אחד צמוד לראיה

### Takeaway
הלשונית צריכה להיות **מסמך לסריקה עם ראיות גלויות**, ולא נגן עם טקסט לצדו. הסדר המומלץ:
1. **תקציר מובנה בכמה רמות.**
2. **צ'יפי זמן מאומתים** שקופצים מיד.
3. **ראיה שנפתחת במקום:** ציטוט, פריים או שקופית.
4. **סימון בצבע** של מה שלא אומת ושל מה שהושמט.
5. **מצב לימוד אופציונלי** עם בחנים.
6. **RTL מלא,** חוץ מציר הזמן של הנגן.
7. **עמידה בהגדרה של WCAG** ל"חלופה למדיה מבוססת זמן".

חוזק הראיה מסומן לכל עיקרון:
- **חזקה:** מטא־אנליזה, או כמה ניסויים מבוקרים.
- **בינונית:** ניסוי מבוקר אחד או שניים, או סקר גדול.
- **חלשה:** ניסוי קטן, הנחיה מקצועית או הסקה.

### Cited Findings

**ע1. תקציר מובנה בכמה רמות בראש הלשונית.** חוזק: בינונית.
- **הדפוס:**
  - **שורה אחת:** "בשורה אחת".
  - **3–5 נקודות מפתח.**
  - **פרקים:** כל פרק עם כותרת תיאורית, משפט מסקנה, נקודות, וראיה לכל נקודה.
  - **הרחבה הדרגתית:** כל רמה נפתחת לרמה שמתחתיה.
- **הראיות:**
  - פי 2 בזכירת נושאי מפתח כשהזמן קצר — [Video Digests / Pavel 2019](https://www2.eecs.berkeley.edu/Pubs/TechRpts/2019/EECS-2019-78.pdf).
  - רמות פירוט מסונכרנות — [SceneSkim / Pavel 2019](https://www2.eecs.berkeley.edu/Pubs/TechRpts/2019/EECS-2019-78.pdf).
  - הרחבה רקורסיבית (27.7% שורשרו) — [Qlarify](https://talaugust.github.io/assets/pdf/Fok2023Qlarify.pdf).
  - מבנה "ספר לימוד" הועדף (7/9) — [Visual Transcripts](https://people.csail.mit.edu/hishin/projects/visual_transcripts/paper.pdf).
  - תקציר ופרקים מופיעים בטיוטת התקן — [WCAG 3.0](https://www.w3.org/TR/wcag-3.0/).

**ע2. כותרות שמתארות הכל, והמסקנה בראש.** חוזק: בינונית לסריקה, חלשה ללמידה.
- **הדפוס:** כותרת פרק שמתחילה במילה האינפורמטיבית ומכסה את כל התוכן שלה. משפט מסקנה ראשון. מילות מפתח מודגשות. תבליטים קצרים.
- **הראיות:**
  - סריקת layer‑cake — [NN/g](https://www.nngroup.com/articles/layer-cake-pattern-scanning/).
  - הנחיות דפוס F — [NN/g](https://www.nngroup.com/articles/f-shaped-pattern-reading-web-content/).
  - Structure saliency ו־structure‑concept match — [Pavel 2019](https://www2.eecs.berkeley.edu/Pubs/TechRpts/2019/EECS-2019-78.pdf).

**ע3. כל טענה מקושרת לרגע, והקישור עובד בשני הכיוונים.** חוזק: בינונית.
- **הדפוס:**
  - **מטקסט לווידאו:** צ'יפ זמן לחיץ בסוף כל נקודה.
  - **מווידאו לטקסט:** בזמן ניגון, הנקודה הפעילה מודגשת בעדינות. כפתור "חזור לטקסט" גולל אליה.
- **הראיות:**
  - עומס נמוך יותר, ניווט והתמצאות טובים יותר — [Papeos](https://arxiv.org/abs/2308.15224).
  - תמליל אינטראקטיבי — [WAI](https://www.w3.org/WAI/media/av/transcripts/).
  - לחיצה על טקסט בתמליל היא אסטרטגיית החיפוש העיקרית (11/12) — [LectureScape](https://www.cs.rochester.edu/hci/pubs/pdfs/data-driven-educational-video-navigation_UIST-2014.pdf).

**ע4. הקפיצה מיידית.** חוזק: בינונית־חזקה.
- **הדפוס:**
  - פריים מוכן מראש לכל צ'יפ, שמוצג מיד עם הלחיצה.
  - טעינה מראש של המקטע הקרוב.
  - בגלילה בציר הזמן: תצוגה מקדימה ברזולוציה נמוכה.
- **הראיות:**
  - שכבה ברזולוציה נמוכה קיצרה משימות בעד 72% — [Swift](https://research.autodesk.com/publications/swift-reducing-the-effects-of-latency-in-online-video-scrubbing).
  - רשת תמונות ממוזערות שיפרה בעד 48% — [Swifter](https://justinmatejka.pages.dev/publication/swifter/).

**ע5. הראיה גלויה וזולה, בתוך הטקסט.** חוזק: חזקה לכך שאנשים לא לוחצים; בינונית לכך שראיה במקום עדיפה.
- **הדפוס:**
  - לחיצה על "ראיה" פותחת במקום: ציטוט של 1–2 משפטים מהתמליל, עם המילים המדויקות מודגשות (תזמון ברמת המילה), פריים או שקופית, ו"נגן מכאן".
  - המקור מוצג לפני כל הסבר.
- **הראיות:**
  - 189/308 לא לחצו על מקור; מקורות מעל ההסבר — [Kim et al. CHI 2025](https://arxiv.org/abs/2502.08554).
  - 1% לחיצות בתוך סיכום — [Pew](https://www.pewresearch.org/short-reads/2025/07/22/google-users-are-less-likely-to-click-on-links-when-an-ai-summary-appears-in-the-results/).
  - צפייה בראיה ב־14.8% מההרחבות — [Qlarify](https://talaugust.github.io/assets/pdf/Fok2023Qlarify.pdf).
  - הסבר עוזר רק כשהוא מוזיל אימות — [Vasconcelos 2023](https://arxiv.org/abs/2212.06823).
  - "deep link… or preview of the source" — [NN/g](https://www.nngroup.com/articles/ai-chatbots-discourage-error-checking/).

**ע6. רק קישורים שנבדקו, וסירוב כשאין ראיה.** חוזק: חזקה.
- **הדפוס:** כל טענה עוברת בדיקת תמיכה אוטומטית מול המילים שבחלון הזמן ומול טקסט השקופית.
  - **נתמכת:** מקבלת צ'יפ.
  - **נתמכת חלקית:** מסומנת (ראו ע7).
  - **לא נתמכת:** יוצאת מהניתוח, או נכתבת במפורש "לא נאמר במפורש בהרצאה". בשאלות ותשובות על הסרטון: לסרב כשאין ראיה.
- **הראיות:**
  - רק 51.5% מהמשפטים נתמכים — [Liu et al. 2023](https://arxiv.org/abs/2304.09848).
  - ציטוט אקראי מעלה אמון — [Ding et al. 2025](https://arxiv.org/abs/2501.01303).
  - 65% נתמכים במלואם ו־11.3% לא נתמכים, וסירוב מפורש — [Cite or Decline](https://arxiv.org/html/2609.01846v1).
  - G10 "Scope services when in doubt" — [Amershi et al.](https://www.microsoft.com/en-us/research/publication/guidelines-for-human-ai-interaction/).

**ע7. סימון בצבע של מקומות חלשים, ברמת הביטוי, לפי אות אמיתי.** חוזק: בינונית־חזקה.
- **הדפוס:**
  - קו תחתון או רקע עדין רק על ביטויים בתמיכה נמוכה, לא על כל המסמך.
  - מקרא קצר.
  - ניסוח בגוף ראשון בלחיצה: "לא מצאתי את זה במפורש — כדאי לבדוק ב־‎12:34‎".
  - האות: ציון התמיכה מול התמליל והשקופית, ולא הסתברות הטוקן.
- **הראיות:**
  - הדיוק עלה מ־26% ל־58% ול־53% — [Spatharioti et al.](https://dangoldstein.com/papers/spatharioti_rothschild_goldstein_hofman_LLM_Search_CHI25.pdf).
  - הסתברות ייצור לא מספיקה — [Vasconcelos TOCHI 2025](https://arxiv.org/abs/2302.07248).
  - העדפה להדגשה ברמת הביטוי — [Do et al.](https://arxiv.org/abs/2405.20434).
  - [HILL](https://arxiv.org/abs/2403.06710).
  - גוף ראשון — [Kim et al. FAccT 2024](https://arxiv.org/abs/2405.00623).

**ע8. הסבר קצר, בלי מלל משכנע.** חוזק: בינונית.
- **הדפוס:** בלי פסקאות נימוק ארוכות על כל נקודה. "למה" — רק בלחיצה, ותמיד מתחת לראיה.
- **הראיות:**
  - הסבר ארוך מעלה ביטחון בלי דיוק — [Steyvers et al.](https://arxiv.org/abs/2401.13835).
  - הסבר מגדיל קבלה בלי קשר לנכונות — [Bansal et al.](https://arxiv.org/abs/2006.14779).
  - טון בטוח מדכא בדיקה — [NN/g](https://www.nngroup.com/articles/ai-chatbots-discourage-error-checking/).

**ע9. תווית AI ספציפית, שמסבירה מה נבדק.** חוזק: בינונית.
- **הדפוס:** במקום "נוצר ב־AI" כללי, שורה כמו: "ניתוח אוטומטי מהתמליל ומהשקופיות · 42 מתוך 45 נקודות אומתו מול התמליל · איכות תמלול: גבוהה". לחיצה מסבירה מה כל מספר אומר.
- **הראיות:**
  - תווית כללית מורידה אמינות, וצריך להסביר אותה — [Altay & Gilardi](https://doi.org/10.1093/pnasnexus/pgae403).
  - תווית לא מגינה מעיוות זיכרון — [Sim et al.](https://arxiv.org/abs/2609.28820).
  - G1, G2, G11 — [Amershi et al.](https://www.microsoft.com/en-us/research/publication/guidelines-for-human-ai-interaction/).
  - זהות AI מפורשת — [Generative Lecture](https://arxiv.org/html/2512.21796).

**ע10. לסמן מה הושמט ומה ויזואלי בלבד.** חוזק: בינונית.
- **הדפוס:**
  - קטע קצר "מה לא נכנס לניתוח" (נושאים שהוזכרו בקצרה), עם צ'יפים.
  - תג "רק בשקופית" לנקודות שמקורן בשקופית ולא בדיבור.
  - קישור לרגעי מעבר ויזואליים: גרף, הדגמה.
- **הראיות:**
  - 51.6% מהפרטים המרכזיים הושמטו, והסיכום עיוות זיכרון — [Sim et al.](https://arxiv.org/abs/2609.28820).
  - 20% מהטקסט ו־30% מהתמונות לא נאמרו — [Slidecho](https://doi.org/10.1145/3441852.3471234).
  - 61% מהשיאים במעבר ויזואלי — [Kim et al. L@S 2014](https://www.eecs.harvard.edu/~kgajos/papers/2014/kim14video.pdf).
  - "חסר תוכן" כשהמידע היה בטבלה — [Qlarify](https://talaugust.github.io/assets/pdf/Fok2023Qlarify.pdf).

**ע11. מצב לימוד אופציונלי: בחנים בין פרקים, רמזים ולא תשובות.** חוזק: חזקה לבחנים; חלשה או מעורבת לשאלות מקדימות ולהסבר עצמי.
- **הדפוס:**
  - מתג "מצב לימוד": שאלה אחת עד שתיים בסוף כל פרק, ותשובה עם צ'יפ לרגע.
  - "מה תדע אחרי הפרק" במקום שאלות מקדימות רבות.
  - "הסבר במילים שלך" כרשות.
  - עוזר שנותן רמז והפניה לזמן, לא פתרון.
  - במצב הזה, התקציר המלא מוצג אחרי הבחנים.
- **הראיות:**
  - [Szpunar et al.](https://pmc.ncbi.nlm.nih.gov/articles/PMC3631699)
  - [Adesope et al.](https://doi.org/10.3102/0034654316689306)
  - [van der Meij & Böckmann](https://doi.org/10.1007/s12528-020-09263-x)
  - [Rice et al.](https://doi.org/10.1007/s11528-019-00374-6)
  - [Deng et al.](https://doi.org/10.1007/s10639-023-12303-5)
  - [Kovacs](https://doi.org/10.1145/2876034.2876041)
  - שאלות מקדימות מוגבלות — [Toftness et al.](https://doi.org/10.1016/j.jarmac.2018.06.003)
  - הסבר עצמי בלי תועלת ועם עומס — [Beege & Ploetzner](https://doi.org/10.1007/s11251-024-09693-5); מול [Bisra et al.](https://www.Gwern.net/doc/psychology/spaced-repetition/2018-bisra.pdf)
  - מעקות — [Bastani et al.](https://ideas.repec.org/a/nas/journl/v122y2025pe2422633122.html)
  - סיכום מראש — [Garcia et al.](https://manuelgarcia.info/publication/ai-video-summaries)
  - עשייה — [Koedinger et al.](https://davis68.github.io/2016-12-12-ttt-uiuc/files/papers/koedinger-doing-watching-2015.pdf)

**ע12. בטלפון: קטעים מקופלים, לא לשוניות.** חוזק: בינונית (מחקר תעשייתי).
- **הדפוס:**
  - כל פרק הוא קטע מקופל עם כותרת־מסקנה.
  - אפשר לפתוח כמה קטעים יחד, ויש "פתח הכל" ו"קפל הכל".
  - המצב נשמר.
  - "בעמוד הזה" בראש: רשימת הפרקים עם זמנים.
- **הראיות:**
  - 8% מול 27% החמצה — [Baymard](https://baymard.com/blog/avoid-horizontal-tabs).
  - [NN/g — אקורדיונים](https://www.nngroup.com/articles/accordions-complex-content/).
  - [NN/g — קישורים בעמוד](https://www.nngroup.com/articles/in-page-links-content-navigation/).
  - [NN/g — חשיפה הדרגתית](https://www.nngroup.com/articles/progressive-disclosure/).

**ע13. נגן דביק — רק בתקציב קטן.** חוזק: חלשה (אין מחקר ישיר — לבדוק).
- **הדפוס:**
  - הנגן לא תופס מקום עד הלחיצה הראשונה על צ'יפ.
  - אחר כך מיני־נגן דביק ורזה (יחס תוכן־למעטפת גבוה) עם סגירה.
  - הוא נעלם בגלילה למטה ומופיע בגלילה למעלה (300–400ms).
  - הוא לא מכסה פוקוס.
  - יש חלופה לגרירה בציר הזמן.
- **הראיות:**
  - [NN/g — כותרות דביקות](https://www.nngroup.com/articles/sticky-headers/).
  - 2.4.11, 2.5.7 ו־2.5.8 — [WCAG 2.2](https://www.w3.org/TR/WCAG22/).

**ע14. תצוגה מקדימה ארוכה ב־bottom sheet לא מודאלי.** חוזק: בינונית (הנחיות).
- **הדפוס:** ראיה ארוכה, שקופית מוגדלת או קטע תמליל נפתחים בגיליון לא מודאלי, כך שהטקסט ממשיך להיראות. Back סוגר, יש כפתור סגירה, ובלי גיליון על גיליון. ראיה קצרה נפתחת במקום (ע5).
- **הראיות:** [NN/g — Bottom sheets](https://www.nngroup.com/articles/bottom-sheet/).

**ע15. זיכרון מקום כפול: גם בטקסט וגם בסרטון.** חוזק: בינונית.
- **הדפוס:**
  - נשמרים מיקום הגלילה, הקטעים הפתוחים וזמן הסרטון.
  - בחזרה בתוך 30–60 דקות: שחזור שקט.
  - אחרי פער ארוך: פתיחה בראש העמוד עם "המשך מ־‎23:10‎".
- **הראיות:**
  - [NN/g — שמירת מיקום](https://www.nngroup.com/articles/saving-scroll-position/).
  - 13% מחזירים לראש, מה שגורם לנטישה — [Baymard](https://baymard.com/blog/return-same-place).
  - G12 — [Amershi et al.](https://www.microsoft.com/en-us/research/publication/guidelines-for-human-ai-interaction/).

**ע16. RTL: הממשק משוקף, ציר הזמן של הנגן LTR, וזמנים ומונחים מבודדים.** חוזק: בינונית (סקר עברית ותקנים); הנגן — לבדוק.
- **הדפוס:**
  - הממשק והניווט RTL.
  - ציר הזמן ופקדי הניגון LTR.
  - חותמות זמן בתוך `<bdi>` או `dir="ltr"`.
  - מונחים באנגלית בתוך `<bdi>` או `dir="auto"`.
  - ציטוט שלם באנגלית עם `lang="en"`, מיושר לפי השפה שלו.
  - בלי היפוך ספרות.
  - הדגשה בבולד ולא באיטליק.
  - טקסט עברי ליד לטיני מוגדל מעט.
- **הראיות:**
  - ציר זמן 69% ו־slider 90% LTR — [Goldenberg & Tractinsky](https://arxiv.org/abs/2101.08070).
  - "Media controls for playback are always LTR" — [Material](https://m1.material.io/usability/bidirectionality.html).
  - הנחיה מנוגדת — [Apple HIG](https://developer.apple.com/design/human-interface-guidelines/right-to-left).
  - [W3C inline bidi](https://www.w3.org/International/articles/inline-bidi-markup/).
  - [hlreq](https://w3c.github.io/hlreq/).
  - 3.1.2 — [WCAG 2.2](https://www.w3.org/TR/WCAG22/).
  - הסתירה עם עקומת הזמן המנטלית — [Fuhrman & Boroditsky](https://escholarship.org/content/qt68k986hb/qt68k986hb.pdf).

**ע17. הניתוח הוא חלופה נגישה למדיה.** חוזק: תקן.
- **הדפוס:**
  - קישור "תמליל מלא" צמוד לסרטון.
  - תמליל תיאורי: כולל טקסט השקופיות, דוברים וצלילים חשובים, ומאפשר חיפוש.
  - פרקים לכל סרטון של 5 דקות ומעלה.
  - תקציר בראש.
  - כותרות אמיתיות (h2/h3).
  - Reflow ב־320.
  - תמליל שנגלל אוטומטית — עם עצירה.
- **הראיות:**
  - [Understanding 1.2.8](https://www.w3.org/WAI/WCAG22/Understanding/media-alternative-prerecorded.html).
  - [WAI — תמלילים](https://www.w3.org/WAI/media/av/transcripts/).
  - [WCAG 3.0](https://www.w3.org/TR/wcag-3.0/).
  - [WCAG 2.2](https://www.w3.org/TR/WCAG22/).
  - 25% קוראים בלי לצפות — [GOV.UK](https://accessibility.blog.gov.uk/2025/03/13/text-digitised-and-videotape-video-transcripts-help-everyone-not-just-people-with-access-needs/).
  - [Linder / WCET](https://wcet.wiche.edu/frontiers/2016/12/14/do-closed-captions-help-students-learn/).

**ע18. איכות התמלול גלויה.** חוזק: בינונית (ראיה ישנה).
- **הדפוס:** מחוון איכות תמלול: רמת ביטחון ה־ASR, ושפה מעורבת. כשהאיכות נמוכה, אזהרה ברמת הפרק והפניה לצפייה.
- **הראיות:**
  - WER של 25% ומטה שימושי, 45% לא — [Munteanu et al.](https://dblp.org/rec/conf/chi/MunteanuBPTJ06.html).
  - לבדוק תמלילים אוטומטיים — [GOV.UK](https://accessibility.blog.gov.uk/2025/03/13/text-digitised-and-videotape-video-transcripts-help-everyone-not-just-people-with-access-needs/).

**ע19. מינימליזם ושליטה.** חוזק: בינונית.
- **הדפוס:**
  - מעט רכיבים בברירת מחדל.
  - שקופיות, ענן מילים ושיאי צפייה נשארים מאחורי "עוד".
  - הגדרה גלובלית לצפיפות: "תמציתי" או "מפורט".
  - בלי האטות אוטומטיות של הגלילה בציר הזמן.
- **הראיות:**
  - קלות שימוש 4.7 מול 6.3, ורצון להסתיר רכיבים — [LectureScape](https://www.cs.rochester.edu/hci/pubs/pdfs/data-driven-educational-video-navigation_UIST-2014.pdf).
  - עומס יכולות — [Generative Lecture](https://arxiv.org/html/2512.21796).
  - שליטה של המשתמש — [StopGap](https://doi.org/10.1145/3706598.3714262).
  - G17 — [Amershi et al.](https://www.microsoft.com/en-us/research/publication/guidelines-for-human-ai-interaction/).
  - צפיפות הדגשה שאפשר לכוונן — [Scim](https://arxiv.org/abs/2205.04561).

**ע20. זמן כמשאב: זמן קריאה, תקציב ומהירות.** חוזק: בינונית.
- **הדפוס:**
  - "זמן קריאה משוער" לניתוח ולכל פרק, מכויל לעברית ולא לפי מילים לדקה באנגלית.
  - "צפה רק ברגעי המפתח" (רצף צ'יפים) במהירות 1.5x–2x.
  - בחירת תקציב: "יש לי 5 דקות".
- **הראיות:**
  - עד 2x בלי פגיעה — [Murphy et al.](https://castel.psych.ucla.edu/wp-content/uploads/sites/111/2022/03/Applied-Cognitive-Psychology-2021-Murphy-Learning-in-double-time-The-effect-of-lecture-video-speed-on-immediate-and.pdf).
  - דחיסת זמן היא היכולת הנפוצה — [Li et al. 2000](https://www.microsoft.com/en-us/research/publication/browsing-digital-video/).
  - תקציב זמן — [ElasticPlay](https://arxiv.org/abs/1708.06858).
  - עברית 187 מילים לדקה בקול, וטקסטים לדקה דומים בין השפות — [IReST](https://doi.org/10.1167/iovs.11-8284).

**ע21. משוב גרנולרי ותיקון.** חוזק: חלשה־בינונית.
- **הדפוס:** "דווח על טעות" לכל נקודה (תפריט ארוך), עם תיקון שמתעדכן בניתוח. זו שכבה משלימה, לא תחליף לאימות האוטומטי.
- **הראיות:**
  - G9 ו־G15 — [Amershi et al.](https://www.microsoft.com/en-us/research/publication/guidelines-for-human-ai-interaction/).
  - משתמשים לא מזהים שגיאות בעצמם — [Qlarify](https://talaugust.github.io/assets/pdf/Fok2023Qlarify.pdf).

### Inferences
- **פריסת ברירת מחדל מוצעת, מלמעלה למטה, בטלפון:**
  1. **כותרת רזה:** שם, משך, זמן קריאה ותווית AI ספציפית (ע9).
  2. **"בשורה אחת" ו־3–5 נקודות** עם צ'יפים (ע1, ע3).
  3. **"בעמוד הזה":** פרקים עם זמנים (ע12).
  4. **פרקים מקופלים:** כותרת־מסקנה; בפתיחה — נקודות עם צ'יפים, "ראיה" שנפתחת במקום (ע5) וסימון של מקומות חלשים (ע7).
  5. **בסוף כל פרק, במצב לימוד:** שאלה (ע11).
  6. **"מה לא נכנס" ו"רק בשקופית"** (ע10).
  7. **קישור לתמליל המלא** (ע17).
  
  הנגן מופיע רק אחרי הלחיצה הראשונה, כמיני־נגן דביק (ע13).
- **מה לבדוק בתוכנית הבדיקות הפנימית:**
  - **זכירה בלחץ זמן:** "כמה נושאי מפתח זכרת אחרי 2 או 5 דקות", בשיטת Video Digests.
  - **זיהוי שגיאות שתולות:** שיעור הזיהוי בניתוח, בשיטת Kim 2025 ו־Spatharioti.
  - **פתיחת ראיה:** שיעור הפתיחה של ראיה ושל צ'יפים.
  - **הבנה ומוטיבציה:** הבנה מסדר גבוה ומוטיבציה, במצב לימוד מול מצב רגיל (בשיטת Garcia).
  - **חוויה:** SUS ו־NASA‑TLX, כמו בניסויים של Papeos ו־VideoMix.

### Gaps
**מה צריך לבדוק בעצמנו (A/B או ניסוי קטן עם 12–16 משתמשים, הגודל המקובל בספרות):**
- **מיני־נגן:** דביק מול נגן קבוע מול בלי נגן.
- **כיוון ציר הזמן:** LTR מול משוקף, עם דוברי עברית.
- **ראיה:** במקום מול bottom sheet.
- **ניסוח הסיוג בעברית.**
- **מיקום הסיכום לסטודנטים:** לפני או אחרי הבחנים.
- **תדירות הבחנים.**
- **הרצאות של 1–3 שעות:** אין בספרות ניסוי על אורך כזה.
