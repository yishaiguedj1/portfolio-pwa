# מתודולוגיה לניתוח עומק של הרצאה / וובינר / קורס בווידאו — מה הניתוח מכיל ואיך מפיקים אותו (מחקר, 9/11/2026)

> **הקשר:** לשונית "ניתוח וידאו" בסטודיו של THE SNOWBALL. הקוראים: סטודנטים ואנשי עסקים דוברי עברית. הסרטונים: בעיקר הרצאות, וובינרים וקורסים באנגלית ובעברית. בשרת כבר מחלצים תמליל עם דוברים וחותמות זמן למילה, וגם תוכן מהמסך (OCR של שקופיות, גרפים וקוד). זמינים Claude (Haiku/Sonnet/Opus 5.5) ו־Gemini. כל נקודה בניתוח חייבת קישור לזמן המדויק בסרטון.
> **שיטה:** 64 חיפושים ו־50 שליפות ממקורות ראשוניים: מאמרי arXiv/ACL, תיעוד Anthropic ו־Gemini, תקני W3C ו־Unicode, מסמכי ODNI ו־CIA ומחקרי למידה. מכסת החיפוש המשותפת נגמרה באמצע המחקר, ולכן כמה נושאים לא נבדקו (Pirolli & Card 2005, Mueller & Oppenheimer 2014, מחירי Gemini).
> **סימונים:** **(משני)** = סיכום או מקור משני. **(לא אומת ישירות)** = פרט שהגיע מתקציר חיפוש ולא נקרא במקור עצמו.

## 1. מודל התוכן: אילו חלקים צריך ניתוח שקוראים "במקום לצפות"

### Takeaway
ניתוח שאפשר לקרוא במקום לצפות צריך לעמוד בשני רפים בבת אחת:
- **רף כיסוי:** כל מה שנאמר, וגם כל מה שהוצג רק על המסך, לפי סדר הזמן ועם זמן מדויק. זה בדיוק הרף שתקן הנגישות WCAG מציב ל"חלופת מדיה".
- **רף סינתזה:** תשובה אחת בראש (BLUF ופירמידת Minto), ומתחתיה עקרונות, משמעות, ביקורת, פעולות ושאלות לתרגול.

המקורות תומכים במבנה שכבות:
- **למעלה:** תקציר החלטה.
- **באמצע:** מפת הטיעון והמשמעות.
- **בגוף:** הערות פרק אחר פרק, עם כל שקופית משולבת במה שנאמר.
- **בסוף:** מאגרי עיון (מונחים, מספרים, מקורות) ותרגול.

### Cited Findings
**הרף "בלי לאבד כלום", כולל מה שהיה רק על המסך**
- תקן הנגישות מגדיר "חלופת מדיה" לסרטון מוקלט:
  - "Full descriptions are provided of all visual information".
  - "transcripts of all dialogue are included".
  - הסדר זהה לסדר בסרטון.
  - המטרה: שגם מי שאינו רואה ואינו שומע יקבל את המידע "at their own pace".
  - מקור: [W3C, Understanding SC 1.2.8, WCAG 2.2 (2023)](https://www.w3.org/WAI/WCAG22/Understanding/media-alternative-prerecorded.html).
- בהרצאות עם שקופיות, השקופית והדיבור מתאימים זה לזה רק חלקית:
  - במאגר LPM (יותר מ־180 שעות, יותר מ־9,000 שקופיות, 10 מרצים) המודלים התקשו ב־"weak crossmodal alignment between slides and spoken text", בשפה טכנית וברצפים ארוכים.
  - איור קשור לעיתים רק לחלק מהקטע המדובר.
  - מקור: [Lee et al., ICCV 2023](https://openaccess.thecvf.com/content/ICCV2023/html/Lee_Lecture_Presentations_Multimodal_Dataset_Towards_Understanding_Multimodality_in_Educational_Videos_ICCV_2023_paper.html).
- בסרטונים ארוכים, תמליל משפר את ההבנה יותר ככל שהסרטון ארוך יותר. ב־Video-MME, מודל Gemini 1.5 Pro עם פריימים בלבד:
  - הדיוק ירד מ־81.7% בסרטונים קצרים ל־74.3% בבינוניים ול־67.4% בארוכים (30–60 דק׳).
  - כתוביות הוסיפו 2.8+ נקודות בקצרים ו־10.1+ בארוכים.
  - אודיו הוסיף 6.2+ בארוכים.
  - מקור: [Fu et al., Video-MME (2024)](https://arxiv.org/html/2405.21075).
- מאגר VISTA מצמיד 18,599 הרצאות כנסים בתחום AI לתקצירי המאמרים שלהן:
  - מודלים שקיבלו וידאו עקפו בעקביות מודלים שקיבלו רק טקסט או רק אודיו.
  - התמליל תואר כקלט "long, noisy, and unstructured".
  - מקור: [Liu et al., ACL 2025](https://arxiv.org/html/2502.08279v4).

**תשובה בראש: BLUF ופירמידה**
- הגדרה ומקור:
  - BLUF פירושו "beginning a message with its key information".
  - מקורו בתקנת הצבא האמריקאי Army Regulation 25-50: "putting the main point at the beginning".
  - זה הפוך מהסגנון הישן, שבו המסקנות מגיעות בסוף.
  - משמש גם בתקצירי מנהלים ובדוחות.
  - מקור: [ויקיפדיה, BLUF (נגיש 2026)](https://en.wikipedia.org/wiki/BLUF_%28communication%29).
- לפי מאמר ב־HBR, פתיח ה־BLUF צריך:
  - לומר מה המטרה ומה הפעולה הנדרשת;
  - לענות על השאלות מי, מה, איפה, מתי ולמה.
  - מקורות: [HBR, How to Write Email with Military Precision (2016 — השנה לא אומתה ישירות), עותק ב־BusinessDay (משני)](https://businessday.ng/hbr/article/how-to-write-email-with-military-precision/); [העותק באתר המחבר (נגיש 2026)](https://kabir.cc/how-to-write-email-with-military-precision/).
- Minto:
  - חשיבה ברורה היא חשיבה "organized as a pyramid under a single point".
  - מסגרת Situation–Complication–Question משמשת "for identifying the question in your reader's mind".
  - מקור: [Barbara Minto, האתר הרשמי (הספר: 1987, מהדורות עד 2009; נגיש 2026)](https://www.barbaraminto.com/).

**הערות למידה: Cornell ו־Kiewra**
- שיטת Cornell (משני — מתקצירי חיפוש של דפי אוניברסיטאות):
  - עמודת "רמזים" עם שאלות או מילות מפתח, שנכתבת אחרי השיעור.
  - עמודת הערות.
  - פס סיכום של משפט או שניים בתחתית הדף.
  - החזרה: מכסים את ההערות ועונים על שאלות הרמזים מהזיכרון.
  - מקורות: [University of Manitoba (2020)](https://www.umanitoba.ca/sites/default/files/2020-07/the-cornell-note-taking-system.pdf); [University of Cincinnati (נגיש 2026)](https://www.uc.edu/campus-life/learning-commons/learning-resources/notetaking-resources/cornell-method-notes.html).
- Kiewra (1985, בסקירה):
  - גם הסטודנטים הטובים רשמו "fewer than three quarters of the critical ideas".
  - סטודנטים בשנה א׳ רשמו רק 11% מהרעיונות הקריטיים.
  - מי שחזר על הערות מפורטות שסיפק המרצה הצליח יותר במבחני עובדות.
  - הערות חלקיות (שלד, מטריצה, ראשי פרקים) הובילו לזכירה טובה יותר מהערות מלאות או מהיעדר הערות.
  - "Segmenting" פירושו הפסקה של 3–4 דקות על כל 6–7 דקות הרצאה.
  - מקור: [LD OnLine, Improving the Quality of Student Notes (סיכום Kiewra 1985 ואחרים)](https://ldonline.org/ld-topics/writing-spelling/improving-quality-student-notes).
- לפי מחקר של Kiewra, Benton & Lewis (1987), הסטודנטים רשמו:
  - 91% מהרעיונות ברמה העליונה;
  - 60% ברמה השנייה;
  - 35% ברמה השלישית;
  - רק 11% מהפרטים ברמה הנמוכה ביותר.
  - מקור: [Kiewra, Revising Lecture Notes (לא אומת ישירות — 403)](https://kiewra.unl.edu/sites/unl.edu.cehs.kiewra/files/media/file/Revising%20Lecture%20Notes.pdf).
- "הערות מטריצה" הן טבלה דו־ממדית שמאפשרת להשוות נושאים ומאפיינים — [IJI (2024)](https://e-iji.net/dosyalar/iji_2024_3_33.pdf).

**ידע שנבנה לאורך זמן**
- Progressive summarization (Forte, 2017). השכבות:
  - שכבה 0: המקור המלא.
  - שכבה 1: הקטעים שנשמרו.
  - שכבה 2: הדגשה מודגשת של המשפטים החזקים.
  - שכבה 3: סימון של הטוב שבמודגש.
  - שכבה 4: "executive summary" קצר במילים שלך, בראש הפתק.
  - מעבר לזה: "remix" — יצירה חדשה מהחומר.
  - העיקרון: "opportunistic compression" — לדחוס בהדרגה, ורק כמה שהחומר מצדיק.
  - מקור: [Forte Labs (2017, עודכן 2023)](https://fortelabs.com/blog/progressive-summarization-a-practical-technique-for-designing-discoverable-notes/).
- פתקי "evergreen" לפי Matuschak:
  - אטומיים (רעיון אחד בכל פתק).
  - מאורגנים סביב מושג ולא סביב מקור.
  - מקושרים בצפיפות זה לזה.
  - מעדיפים "associative ontologies to hierarchical taxonomies".
  - Ahrens, שמצוטטת שם, מבקרת הערות מפוזרות שמחייבות "rely heavily on your brain to remember".
  - מקורות: [Matuschak, Evergreen notes (~2020)](https://notes.andymatuschak.org/Evergreen_notes); [should be atomic](https://notes.andymatuschak.org/Evergreen_notes_should_be_atomic); [should be concept-oriented](https://notes.andymatuschak.org/Evergreen_notes_should_be_concept-oriented).
- Luhmann בנה Zettelkasten של כ־90,000 כרטיסים. הכרטיסים ממוספרים בהיררכיה, כך שאפשר להכניס כרטיס חדש במקום הנכון — [ויקיפדיה, Zettelkasten (נגיש 2026)](https://en.wikipedia.org/wiki/Zettelkasten).
- מפות מושגים (Novak & Cañas):
  - מושג הוא "a perceived regularity … designated by a label".
  - פסוקית (proposition) היא שני מושגים ומילת קישור ביניהם. אלה "units of meaning".
  - המפה נבנית ביחס ל־"focus question", ומסודרת בהיררכיה מהכללי (למעלה) לפרטני.
  - "cross-links" בין תחומים שונים במפה "often represent creative leaps".
  - אפשר להוסיף למפה דוגמאות.
  - מקור: [Novak & Cañas, IHMC (2008)](https://cmap.ihmc.us/Publications/ResearchPapers/TheoryUnderlyingConceptMaps.pdf).

**מבנה הטיעון**
- מודל Toulmin (1958):
  - שלושה חלקים יסודיים: claim, grounds, warrant.
  - שלושה חלקים נוספים: backing, qualifier, rebuttal.
  - ה־warrant מובלע לעיתים קרובות.
  - מקור: [Purdue OWL, Toulmin Argument (נגיש 2026)](https://owl.purdue.edu/owl/general_writing/academic_writing/historical_perspectives_on_argumentation/toulmin_argument.html).
- מיפוי טיעונים:
  - קורסים אינטנסיביים העלו את ציוני החשיבה הביקורתית בכ־0.8 סטיות תקן — יותר מכפול מהאפקט הרגיל — [Davies, Barnett & van Gelder (2015), פרק משוכפל](https://ecampusontario.pressbooks.pub/criticalthinking1234/chapter/introduction/).
  - קורסים רגילים לחשיבה ביקורתית: כ־0.34 סטיות תקן לפי מטה־אנליזה. שחזור של Twardy מצא שכ־90% מהשיפור נשמר גם בניכוי השפעת המורה — [ter Berg et al., INTED (2013)](https://www.reasoninglab.com/wp-content/uploads/2013/10/INTED2013-Ter-Berg_Van-der-Brugge.pdf).
  - מנגד, סקירה מ־2025 קובעת שראיות אמפיריות חזקות לכלים להמחשת טיעונים "remains scarce" — [Frontiers in Education (2025)](https://public-pages-files-2025.frontiersin.org/journals/education/articles/10.3389/feduc.2025.1672105/pdf).

**טקסונומיות של עומק**
- טקסונומיית Bloom המתוקנת:
  - ממד הידע כולל ארבעה סוגים: Factual, Conceptual, Procedural, Metacognitive. הם אינם מדורגים לפי חשיבות.
  - ממד התהליך הקוגניטיבי הוא היררכיה מפשוט למורכב (Remember עד Create).
  - מקור: [Krathwohl, Theory Into Practice (2002)](https://rvc-web-app01.live01.azure.rvc.ac.uk/Media/Default/About/Academic%20Quality,%20Regulations%20and%20Procedures/Academic%20Quality%20Assurance%20and%20Enhancement%20Procedures/Module%20Development%20and%20Approval/A%20Revision%20of%20Bloom's%20Taxonomy%20-%20An%20Overview.%20David%20R.%20Krathwohl.pdf).
- טקסונומיית SOLO, מהרמה הנמוכה לגבוהה:
  - unistructural: היבט אחד.
  - multistructural: כמה היבטים, אבל הקשרים ביניהם חסרים.
  - relational: החלקים משולבים לשלם אחד.
  - extended abstract: הכללה מעבר להקשר המקורי.
  - מקורות: [Biggs & Collis (1982), דרך CUHK](https://www.cuhk.edu.hk/policy/assessment/SOLO-description.pdf); [Pam Hook (נגיש 2026)](https://pamhook.com/solo-taxonomy/).

**מה באמת עוזר ללמוד**
- Dunlosky et al. (2013) דירגו טכניקות לימוד לפי תועלת:
  - תועלת גבוהה: practice testing, distributed practice.
  - תועלת בינונית: elaborative interrogation, self-explanation, interleaved practice.
  - תועלת נמוכה: summarization, highlighting, keyword mnemonic, imagery, rereading.
  - מקור: [APS (2013)](https://www.psychologicalscience.org/news/releases/which-study-strategies-make-the-grade.html).
- Roediger & Karpicke (2006):
  - במבחן מיידי, לימוד חוזר ניצח.
  - במבחנים אחרי יומיים ואחרי שבוע, מי שנבחן כבר בשלב הלמידה זכר יותר ("testing effect").
  - מקור: [Psychological Science (2006)](https://psychology.ecu.edu/wp-content/pv-uploads/sites/216/2019/03/Roediger-Karpicke-2006.pdf).
- עקרונות Mayer (המספרים משתנים בין מהדורות):
  - signaling (הדגשת העיקר): ‎d≈0.69, נמצא ב־15 מתוך 16 מבחנים.
  - segmenting (חלוקה לחלקים בקצב הלומד): ‎d≈0.77, נמצא ב־10 מתוך 10.
  - מקורות: [Mayer, פרק ב־Pressbooks (נגיש 2026)](https://pressbooks.pub/learningenvironmentsdesign/chapter/mayer-applying-the-science-of-learning-evidence-based-principles-for-the-design-of-multimedia-instruction/); [Chartered College (נגיש 2026) (משני)](https://my.chartered.college/impact_article/how-multimedia-can-improve-learning-and-instruction/).

**תבניות "חילוץ תובנות" של מתרגלים ומחקר**
- התבנית `extract_wisdom` בפרויקט הקוד הפתוח Fabric דורשת את החלקים הבאים:
  - SUMMARY של 25 מילים.
  - IDEAS: בין 20 ל־50, כל אחד "exactly 16 words".
  - INSIGHTS: בין 10 ל־20.
  - QUOTES: עם שם הדובר ו־"exact quote text".
  - HABITS ו־FACTS.
  - REFERENCES: "all mentions of writing, art, tools, projects".
  - ONE-SENTENCE TAKEAWAY ו־RECOMMENDATIONS.
  - כלל נוסף: "Do not repeat ideas".
  - מקור: [danielmiessler/fabric (2024–2026)](https://raw.githubusercontent.com/danielmiessler/fabric/main/data/patterns/extract_wisdom/system.md).
- SumCoT:
  - קודם מחלצים "אלמנטים" לפי מודל Lasswell (מי, מה, למי, איזו השפעה), ורק אז כותבים את הסיכום.
  - התוצאה שילבה יותר פרטים מהמקור, והשיגה ‎+4.33/+4.77 ב־ROUGE-L.
  - מקור: [Wang, Zhang & Wang, ACL (2023)](https://arxiv.org/abs/2305.13412).
- Key Point Analysis:
  - קומץ "key points" מכסה את רוב הטיעונים בנושא.
  - הבולטות של כל נקודה נמדדת לפי מספר הטיעונים שממופים אליה.
  - מקורות: [Bar-Haim et al., ACL (2020)](https://aclanthology.org/2020.acl-main.371); [EMNLP (2020)](https://aclanthology.org/2020.emnlp-main.3/).

### Inferences
- **הניתוח הוא שתי שכבות שונות, ולא "סיכום ארוך".**
  - **שכבת כיסוי:** נאמנה, בסדר הזמן, ומלאה עד רמת השקופית והמספר. היא הלקח מ־WCAG ומ־Kiewra.
  - **שכבת סינתזה:** BLUF, פירמידה, Toulmin, עקרונות וביקורת.
  - כל פריט בשתי השכבות מצביע על "יחידות ראיה" עם זמן. הקורא מטפס מהמסר לראיה בלחיצה אחת.
- **סולם דחיסה בהשראת Forte ו־CoD:**
  - משפט אחד
  - פסקת BLUF
  - 5–7 תובנות עם משקל
  - תקציר לכל פרק
  - הערות מלאות
  - יחידת הראיה (ציטוט, שקופית, זמן)
  - כל שלב בסולם נגזר מהשלב שמתחתיו, ולא נוצר מאפס.
- **חלקי הניתוח וההצדקה שלהם:**

| חלק | מה נכנס | הראיה שמצדיקה |
|---|---|---|
| שורה אחת + BLUF + SCQ | המסר, השאלה שההרצאה עונה עליה, מה לעשות | BLUF, Minto |
| 5–7 תובנות מפתח עם משקל | הנקודה, כמה זמן וחשיבות קיבלה, זמנים | KPA, Forte שכבה 4 |
| תזה ומפת טיעון | claim, grounds, warrant (גלוי/מובלע), qualifier, rebuttal | Toulmin, מיפוי טיעונים |
| עקרונות, מודלים ומסגרות | הניסוח, מתי חל, דוגמה מהסרטון, סוג ידע | Bloom (Conceptual/Procedural), SOLO relational |
| הערות פרק אחר פרק | כל שקופית משולבת במה שנאמר, עם סימון "רק על המסך" | WCAG 1.2.8, Kiewra, LPM |
| נתונים, מספרים וטבלאות | ערך, יחידה, מה נמדד, מועד, מקור (דיבור/שקופית) | Kiewra (פרטים נשמטים ראשונים) |
| מילון מונחים | עברית + מונח מקורי + הגדרה + זמן הופעה ראשון | Bloom Factual; מדריך הסגנון בעברית (סעיף 7) |
| דוגמאות ומקרי בוחן | מה כל אחד ממחיש | Novak & Cañas (דוגמאות במפה) |
| ציטוטים | מילה במילה בשפת המקור + תרגום + דובר + זמן | Fabric QUOTES; כשלי ייחוס (סעיף 6) |
| פעולות מומלצות | מה, למי, מתי, ומקורה (הדובר או המנתח) | BLUF ("required action"), ICD 203 |
| שאלות פתוחות | מה לא נענה, שאלות הקהל | Paul-Elder ("question at issue") |
| ביקורת | הנחות (ומה אם הן שגויות), מגבלות, מתחים, חידוש מול מקובל | ICD 203, Key Assumptions Check |
| קשרים | בין עקרונות, ולרעיונות אחרים | cross-links, פתקים מקושרים |
| מקורות שהוזכרו | ספרים, מאמרים, כלים, אנשים, קישורים | Fabric REFERENCES |
| תרגול | שאלות לפי רמות Bloom, כרטיסיות, שאלות רמז לכל פרק | Dunlosky, Roediger, Cornell |
| דוח איכות | כיסוי, אימות, אזהרות | סעיף 5 |

- **"תקציר" לבדו לא מספיק לסטודנט.** Dunlosky מדרג סיכום כטכניקה בתועלת נמוכה, ושאלות לתרגול בתועלת גבוהה. לכן מודל התוכן חייב לכלול שאלות לתרגול ושאלות רמז לכל פרק, ולא רק טקסט.
- **לא מספר קבוע של פריטים.**
  - Fabric קובע מכסות קבועות (למשל 20–50 רעיונות).
  - אצלנו המספר צריך לנבוע ממלאי התוכן של הסרטון (סעיף 5).
  - מכסה קבועה דוחפת לריפוד בסרטון דל, ולהשמטה בסרטון עשיר.
- **סימון המקור בכל הערה:** דיבור / רק על המסך / שניהם. זה מממש את דרישת WCAG ומתמודד עם ההתאמה החלקית בין שקופית לדיבור שנמדדה ב־LPM.

### Gaps
- לא נמצא מחקר שבודק אם קריאת ניתוח כזה מחליפה צפייה בקבלת החלטות עסקיות. אין גם תקן מוסכם ל"תקציר מנהלים של סרטון".
- גודל האפקט של "guided notes" במטה־אנליזה של Konrad et al. (2009) לא נשלף. נמצאו רק פרטי הפרסום: [Project MUSE (2009)](https://muse.jhu.edu/article/269661).
- הנתונים של Kiewra 1987 לא אומתו במקור (חסימה 403).
- הספר של Ahrens (2017) לא נקרא ישירות.
- הדף הרשמי של Cornell Learning Strategies Center לא נשלף.

## 2. "משמעות עמוקה" ותמונה כוללת

### Takeaway
"עומק" אינו אורך. עומק הוא מבנה מפורש שעונה על הנקודות הבאות:
- השאלה שההרצאה עונה עליה.
- התזה.
- שרשרת הטיעון, כולל warrant מובלע ו־qualifier.
- ההנחות (גלויות וסמויות), ומה קורה אם הן שגויות.
- המנגנון הסיבתי והמודלים המנטליים.
- ההשלכות.
- המתחים.
- מה חדש לעומת מה מקובל.

מסגרות החשיבה הביקורתית (Paul-Elder, Toulmin, ICD 203 ו־Key Assumptions Check) נותנות רשימת שאלות סגורה וניתנת לבדיקה.

טכניקות LLM שמייצרות עומק בפועל:
- תכנון בשאלות (blueprint / plan questions).
- הפשטה לעקרונות (step-back).
- עדשות פרספקטיבה (STORM).
- שלד קודם (Skeleton-of-Thought).
- ציפוף (Chain of Density).
- ביקורת ותיקון ואימות (Self-Refine, CoVe).

**הסיכון המרכזי:** "חיבורים מומצאים". לכן כל פריט סינתזה מסומן לפי מקורו: טענת הדובר, היסק של המנתח, או ידע חיצוני.

### Cited Findings
**מסגרות חשיבה ביקורתית**
- Paul & Elder:
  - שמונה רכיבי חשיבה: Purpose, Question at issue, Information, Interpretation & Inference, Concepts, Assumptions, Implications & Consequences, Point of View.
  - תקנים אינטלקטואליים: Clarity, Accuracy, Precision, Relevance, Depth, Breadth, Logic, Significance, Fairness.
  - הרשימה המלאה נלקחה מהמדריך המוכר; בקטעים שנשלפו נראו רק חלק מהרכיבים.
  - ההנחיה על הנחות: "all reasoning is based on assumptions. Clearly identify your assumptions and determine whether they are justifiable".
  - מקור: [Paul & Elder, The Miniature Guide to Critical Thinking Concepts & Tools (Foundation for Critical Thinking; עותק York University, 2020)](https://yorku.ca/laps/sosc/wp-content/uploads/sites/216/2020/12/CriticalThinkingConcepts_Tools.pdf).
- Data/Frame (Klein, Moon & Hoffman):
  - "frame" הוא מבנה מסביר שמסביר את הנתונים ומכוון את החיפוש אחרי נתונים נוספים.
  - Sensemaking הוא התאמת הנתונים למסגרת, והתאמת המסגרת סביב הנתונים.
  - מקור: [Gary Klein, Data/Frame theory (Klein, Moon & Hoffman, IEEE Intelligent Systems 2006)](https://www.gary-klein.com/data-frame).
- Russell et al. (1993) הגדירו sensemaking כך: "developing a representation and encoding data in that representation to answer questions specific to a task". כלומר: ייצוג שנבנה כדי לענות על שאלות המשימה — [ויקיפדיה, Sensemaking (information science) (נגיש 2026)](https://en.wikipedia.org/wiki/Sensemaking_%28information_science%29).
- תקן הניתוח של קהילת המודיעין האמריקאית (ICD 203):
  - להפריד בין המידע עצמו לבין ההנחות והשיפוטים של המנתח.
  - לכתוב הנחות במפורש "when they serve as the linchpin of an argument or when they bridge key information gaps".
  - "Products should explain the implications for judgments if assumptions prove to be incorrect".
  - לבטא ולהסביר אי־ודאות, ולציין סימנים שישנו את רמתה.
  - מקור: [ODNI, ICD 203 Analytic Standards (2015)](https://www.dni.gov/files/documents/ICD/ICD-203.pdf).
- A Tradecraft Primer (מרץ 2009):
  - Key Assumptions Check: "List and review the key working assumptions on which fundamental judgments rest".
  - הנחות סמויות "are seldom examined and almost never challenged".
  - טכניקות נוספות במסמך: Analysis of Competing Hypotheses, Devil's Advocacy, "What If?" Analysis, Outside-In Thinking.
  - מקור: [US Government, A Tradecraft Primer (2009)](https://www.cia.gov/resources/csi/static/Tradecraft-Primer-apr09.pdf).
- כלים נוספים מסעיף 1 שרלוונטיים לעומק:
  - רמת relational ב־SOLO: החלקים משולבים לשלם.
  - cross-links במפות מושגים: קפיצות יצירתיות בין תחומים.

**טכניקות LLM שמייצרות עומק**
- Step-back prompting:
  - קודם מפשטים את השאלה לעקרונות ומושגים כלליים, ורק אז פותרים.
  - תוצאות ב־PaLM-2L: ‎+7% ו־‎+11% ב־MMLU פיזיקה וכימיה; ‎+27% ב־TimeQA (בדף של DeepMind כתוב 34% — סתירה); ‎+7% ב־MuSiQue.
  - השיטה תיקנה עד כ־40% מטעויות המודל הבסיסי.
  - מקורות: [Zheng et al. (2023)](https://arxiv.org/abs/2310.06117); [Google DeepMind (2023)](https://deepmind.google/research/publications/step-back-prompting-enables-reasoning-via-abstraction-in-large-language-models/).
- QA blueprint: זוגות שאלה־תשובה כתוכנית ביניים לפני הכתיבה. המודלים שמשתמשים בתוכנית "more factual" ומאפשרים שליטה הדוקה יותר בפלט — [Narayan et al., TACL (2023)](https://aclanthology.org/2023.tacl-1.55).
- VISTA — תכנון בשאלות לסיכום הרצאות כנס:
  - כל משפט בסיכום עונה על "plan question", לדוגמה "What problem is being addressed?". הבסיס התיאורטי: Question Under Discussion.
  - המודל עם התוכנית היה טוב משמעותית ממודלים נוירוניים אחרים בנאמנות, בקוהרנטיות ובאינפורמטיביות.
  - אבל כל המודלים הזו (hallucinations), ובני אדם עדיפים בכל המדדים.
  - ציון FactVC: 88.54 לסיכום האנושי מול 75.41 למודל הטוב ביותר.
  - מקור: [Liu et al., ACL 2025](https://arxiv.org/html/2502.08279v4).
- STORM:
  - השיטה: מגלים פרספקטיבות שונות, מדמים שאלות של כותבים מכל פרספקטיבה, בונים שלד, וכותבים מאמר.
  - מאמרים מאורגנים יותר ב־25% וכיסוי רחב יותר ב־10%, לעומת בסיס שמבוסס שלד ואחזור.
  - עורכים מומחים הצביעו על הטיות מהרשת ועל "LLMs fabricating connections between unrelated facts".
  - מקור: [Shao et al., NAACL 2024](https://arxiv.org/abs/2402.14207).
- Skeleton-of-Thought:
  - קודם שלד של 3–10 נקודות, ואז הרחבה של כל נקודה במקביל.
  - האצה של עד פי 2.39, ולעיתים גם איכות טובה יותר בסוגי שאלות מסוימים.
  - מקור: [Ning et al. (2023/ICLR 2024)](https://arxiv.org/abs/2307.15337).
  - מדריך צד שלישי מזהיר מירידה באיכות כשהנקודות תלויות זו בזו — [Learn Prompting (נגיש 2026)](https://learnprompting.org/docs/advanced/decomposition/skeleton_of_thoughts).
- Chain of Density:
  - מתחילים מסיכום דליל ומוסיפים בכל סבב ישויות חשובות שחסרות, בלי להאריך.
  - הסיכומים יוצאים מופשטים יותר, עם יותר מיזוג ופחות הטיה לפתיח.
  - קוראים העדיפו סיכומים צפופים יותר מהפרומפט הרגיל, כמעט בצפיפות של סיכום אנושי.
  - יש מתח בין אינפורמטיביות לקריאוּת.
  - מקור: [Adams et al., NewSum (2023)](https://arxiv.org/abs/2309.04269).
- Self-Refine:
  - שיפור מוחלט ממוצע של כ־20% בשבע משימות.
  - במתמטיקה השיפור הגיע רק עם משוב חיצוני, כי המודל מתקשה למצוא את הטעויות של עצמו.
  - מקורות: [Madaan et al., NeurIPS 2023 (arXiv)](https://arxiv.org/abs/2303.17651); ההסבר על המתמטיקה — [שקפי NeurIPS (2023) (משני — דרך תקציר חיפוש)](https://nips.cc/media/neurips-2023/Slides/71632.pdf).
- Chain-of-Verification (CoVe):
  - שלבים: טיוטה → תכנון שאלות בדיקה → מענה על השאלות בנפרד מהטיוטה (כדי שהטיוטה לא תטה את הבדיקה) → גרסה מתוקנת.
  - השיטה הפחיתה המצאות, גם בטקסט ארוך.
  - מקור: [Dhuliawala et al. (2023)](https://arxiv.org/abs/2309.11495).
- דפוס evaluator-optimizer (מודל אחד כותב, אחר מעריך) "particularly effective when we have clear evaluation criteria". דפוס voting מתאים כשצריך "multiple perspectives" — [Anthropic, Building effective agents (2024)](https://www.anthropic.com/engineering/building-effective-agents).

### Inferences
- **פרוטוקול העומק — שמונה שאלות קבועות.** כל שאלה ממופה למקור ולשדה ב־JSON:
  1. איזו שאלה ההרצאה עונה עליה? (SCQ; "question at issue") → `briefing.scq`
  2. מה התזה במשפט אחד? → `thesis`
  3. איך התזה נתמכת? (עץ Toulmin, כולל warrant מובלע ו־qualifier) → `arguments[]`
  4. על אילו הנחות היא נשענת, גלויות וסמויות, ומה משתנה אם הן שגויות? (Key Assumptions Check, ICD 203) → `deep.assumptions[].if_wrong`
  5. מה המנגנון? (שרשראות סיבה־תוצאה, מודלים מנטליים, ה־frame) → `deep.causal_chains`, `deep.mental_models`
  6. מה ההשלכות — בכלל, ולקורא? → `deep.implications`
  7. איפה המתחים? (סתירות פנימיות, הסתייגויות, מה לא נאמר, הסברים מתחרים) → `deep.tensions`, `deep.limitations`
  8. מה חדש ומה מקובל? (דורש ידע חיצוני, ולכן מסומן) → `deep.novelty`
- **"התמונה הכוללת" נבדקת במבחן relational של SOLO:** האם הניתוח מסביר איך הפרקים בונים את התזה?
  - כל פרק מוסר "מה הוא מוסיף לשלם", בדומה להודעות בין השלבים ב־Chain of Agents (סעיף 6).
  - שלב הסינתזה כותב פסקת `big_picture` שמחברת את הפרקים.
  - בנוסף נבנית מפת מושגים עם cross-links.
- **סימון מקור ורמת ביטחון לכל פריט סינתזה.**
  - הערכים: `speaker` / `analyst_inference` / `external_knowledge`.
  - זו ההפרדה של ICD 203 בין מידע להנחות ולשיפוטים.
  - זו גם ההגנה מפני "חיבורים מומצאים" (STORM). היסק של המנתח לא יוצג כאילו הדובר אמר אותו.
- **עדשות כמעברי שאלות מפורשים, בהשראת STORM:** ספקן, מיישם, סטודנט, מומחה תחום. כל עדשה שואלת שאלות, וכל תשובה חייבת להצביע על יחידות ראיה.
- **שאלות התכנון לפי ז'אנר משמשות פעמיים** (VISTA, blueprint):
  - הן השלד של הסעיפים בניתוח.
  - הן גם סט השאלות להערכת הכיסוי בסעיף 5.
- **ציפוף (CoD) רק בשכבה העליונה** (BLUF ותובנות). בגוף הניתוח עדיפה קריאוּת, בגלל המתח בין צפיפות לקריאוּת שנמדד ב־CoD.
- **ביקורת ותיקון עם רובריקה חיצונית ושופט ממשפחת מודלים אחרת.** הרובריקה: תקני Paul-Elder, ספציפיות, כיסוי וייחוס. סבב אחד או שניים, כי מודל מתקשה למצוא את טעויותיו בלי משוב חיצוני (Self-Refine).

### Gaps
- לא נמצא מדד או benchmark ל"עומק ותובנה" בניתוח הרצאות.
- אין ראיה ישירה שמודלי שפה מזהים בעקביות הנחות *סמויות* בהרצאות.
- הערכת "חידוש" תלויה בידע חיצוני שעלול להיות מיושן.
- Pirolli & Card (2005) לא נבדק בגלל מכסת החיפוש.

## 3. תבניות לפי ז'אנר

### Takeaway
לכל ז'אנר יש "מרכז כובד" מידעי משלו, וגם רעש משלו.

המחקר נותן עוגנים לשישה ז'אנרים: הרצאת כנס מדעי, הרצאה עם שקופיות, שיחת משקיעים, פגישה ופאנל, פודקאסט, וסרטון קוד. לוובינר מכירתי, להדגמת מוצר ולסדנה נמצאו רק מקורות של מתרגלים, ולכן התבניות שם הן היסק.

הכלל המשותף: לפני הסינתזה מסווגים את הז'אנר ומתייגים כל קטע בסרטון:
- תוכן
- שאלות ותשובות
- הצעת מכר
- חסות
- קדימון או סיכום חוזר
- תזכורת אינטראקציה
- מילוי
- לוגיסטיקה

אחר כך כל סוג קטע מטופל לפי התבנית שלו.

### Cited Findings
- **הרצאת כנס מדעי:**
  - תקצירים מדעיים עוקבים אחר מבנה צפוי.
  - תכנון בשאלות ("What problem is being addressed?") שיפר נאמנות וקוהרנטיות.
  - מקור: [Liu et al., ACL 2025](https://arxiv.org/html/2502.08279v4).
- **הרצאה עם שקופיות:**
  - ההתאמה בין שקופית לדיבור חלשה.
  - המשימות שהוגדרו במאגר: איור לטקסט, טקסט לאיור, וייצור הסבר לשקופית.
  - מקור: [Lee et al., ICCV 2023](https://openaccess.thecvf.com/content/ICCV2023/html/Lee_Lecture_Presentations_Multimodal_Dataset_Towards_Understanding_Multimodality_in_Educational_Videos_ICCV_2023_paper.html).
- **מאקרו־סמנים:**
  - "explicit expressions of lecture planning" (למשל "היום נדבר על…") עזרו לזכירה יותר מ"מיקרו־סמנים" שמחברים בין משפטים.
  - הנבדקים היו לומדי שפה שנייה, ואין הסכמה מלאה על הממצא.
  - מקור: [Chaudron & Richards (1986)](https://scholarspace.manoa.hawaii.edu/items/cd3514b8-4bb9-4cb4-927f-8b119167c1bc).
- **חלוקה לפרקים:**
  - Chapter-Llama מחלק לפרקים מתוך תמליל (ASR) ותיאורים של פריימים נבחרים. הפריימים נבחרים לפי תוכן הדיבור.
  - הוא מעבד סרטון של שעה במעבר אחד.
  - שילוב שני המקורות נתן את התוצאה הטובה ביותר.
  - מקור: [Ventura et al., CVPR 2025](https://arxiv.org/abs/2504.00072).
- **שיחת משקיעים:**
  - מחקר על יותר מ־10,000 תמלילים מצא שחלק השאלות והתשובות מוסר יותר מידע מהמצגת המוכנה, במיוחד כשהביצועים חלשים — [Matsumoto, Pronk & Roelofsen, The Accounting Review (2011)](https://repub.eur.nl/pub/25721).
  - ECTSum: תקצירים כנקודות קצרות בסגנון מברק שכתבו מומחים (Reuters), ביחס דחיסה של 103.67. הבסיס שהוצע: חילוץ ואז ניסוח מחדש (ECT-BPS) — [Mukherjee et al., EMNLP 2022](https://aclanthology.org/2022.emnlp-main.748).
- **פגישה ופאנל:**
  - QMSum: 1,808 זוגות של שאילתה ותקציר מ־232 פגישות, בשיטת "locate-then-summarize" — [Zhong et al., NAACL 2021](https://aclanthology.org/2021.naacl-main.472).
  - DIAL-SUMMER:
    - תורות הדיבור באמצע השיחה נשמטות הכי הרבה.
    - המצאות חיצוניות מופיעות בעיקר בסוף התקציר.
    - יש "shift in narration viewpoint" מגוף ראשון ושני לגוף שלישי.
    - מקור: [DIAL-SUMMER (2026)](https://arxiv.org/abs/2602.08149).
  - בסקירת אתגרי CHiME-7/8:
    - תוויות הדוברים עלולות להיות לא מיושרות בין התמליל המקורי לתמליל האוטומטי.
    - סיכום של מודל שפה מפצה לפעמים על חלק משגיאות התמלול והייחוס.
    - מקור: [CHiME review (2025)](https://arxiv.org/pdf/2507.18161).
  - מדדים אוטומטיים לתקצירי פגישות "מתגמלים" לפעמים המצאות — [What's under the hood (2024)](https://arxiv.org/html/2404.11124v2).
- **פודקאסט:** TREC 2020 עבד על יותר מ־100,000 פרקים, וסיכם מתוך תמלילים אוטומטיים — [Jones et al. (2021)](https://arxiv.org/abs/2103.15953).
- **סרטון קוד (screencast):**
  - הבעיות: OCR רועש, פריימים שאינם קוד, ורכיבי ממשק שנכנסים לאזור הקוד.
  - psc2code סינן פריימים בסיווג (F1 0.88 על 1,142 סרטונים), חתך את אזור העורך, ותיקן 46% משגיאות ה־OCR בעזרת מודל שפה.
  - מקור: [Bao et al., TOSEM (2020)](https://arxiv.org/abs/2103.11610).
- **וובינר:**
  - לפי ON24, זמן הצפייה הממוצע בוובינר הוא כ־49 דקות (הדוח על נתוני 2025). בדוח הקודם: 51 דקות. התוויות של הדוחות לא עקביות. מקור: [ON24 (2025–2026) (משני)](https://www.on24.com/blog/key-takeaways-from-the-webinar-benchmarks-report/).
  - תסריט וובינר מכירתי נפוץ (מבוסס Brunson, Expert Secrets, 2017):
    - תוכן.
    - "the stack": כל רכיב בהצעה מוצג עם "ערך נתפס".
    - חשיפת מחיר נמוך בהרבה מסכום הערכים.
    - קריאה לפעולה וסיכום.
    - מקורות: [Apexure (נגיש 2026) (משני)](https://www.apexure.com/perfect-webinar-script); [GenPPT (נגיש 2026) (משני)](https://genppt.com/blog/perfect-webinar-script-russell-brunson).
- **חסויות ורעש:**
  - מאגר SponsorBlock מסווג קטעים בסרטונים (מקטלוג המתנדבים):
    - Sponsor: קידום בתשלום.
    - Unpaid/Self Promotion: מרצ'נדייז, תרומות, שיתופי פעולה.
    - Interaction Reminder: בקשה קצרה לעשות לייק או להירשם.
    - Intro/Outro.
    - Preview/Recap.
    - קטגוריות Filler ו־Music off-topic קיימות בכלים מסוימים.
  - קידום עצמי מופיע בדרך כלל בסוף הסרטון.
  - מקורות: [SponsorBlock Wiki, Guidelines (נגיש 2026)](https://wiki.sponsor.ajay.app/w/Guidelines); [Interaction Reminder (נגיש 2026)](https://wiki.sponsor.ajay.app/w/Interaction_Reminder_%28Subscribe%29).

### Inferences
**תבנית לכל ז'אנר.** היסק שמבוסס על הממצאים למעלה. בלי עוגן מחקרי ישיר — מסומן ב־*.

| ז'אנר | מה להבליט | מה להצניע או להפריד | חלקים מיוחדים | רמזים לזיהוי |
|---|---|---|---|---|
| הרצאה אקדמית | הגדרות, מושגים, גזירות ונוסחאות, דוגמאות, "זה יהיה במבחן", קשר לשיעורים קודמים | לוגיסטיקה, בדיחות, חזרות | מילון, נוסחאות מהשקופיות, שאלות תרגול לפי Bloom, מפת מושגים | מאקרו־סמנים, שקופיות כותרת |
| מודול בקורס (סדרה)* | מה נוסף ביחס למודולים קודמים, דרישות קדם | מה שכבר כוסה | מילון מצטבר ומפת מושגים לכל הקורס; "מה השתנה מאז מודול N" | רשימת השמעה ומטא־דאטה |
| וובינר עסקי* | התוכן המעשי: מסגרות, נתונים, צעדים | הצעת המכר בתיבה נפרדת וניטרלית (מה מוצע, מחיר, טענות לבדיקה); לא לערבב טענות שיווק בתזה | "פעולות שאפשר לעשות בלי לקנות", "טענות שדורשות אימות" | מעבר להצעה, "stack", מחירים, דחיפות, קריאה לפעולה |
| הרצאת כנס | הבעיה, החידוש הנטען, השיטה, התוצאות והמספרים, המגבלות | ברכות ותודות | קישור למאמר, "מול מה זה משתפר" | מבנה בעיה–שיטה–תוצאות (VISTA) |
| פאנל | עמדת כל דובר, הסכמות ומחלוקות, ייחוס מדויק | נימוסים, ניהול זמן | מטריצת עמדות (דובר × נושא, לפי Kiewra), ציטוט לכל עמדה | כמה דוברים, מנחה |
| ראיון ופודקאסט | טענות האורח, סיפורים כדוגמאות, המלצות (ספרים, כלים) | חסויות, פתיחים, תזכורות | שאלות המראיין כשלד, "מה ממליצים" | שני דוברים קבועים, פרסומות |
| מדריך תוכנה | דרישות קדם, גרסאות, פקודות, קוד מילה במילה מהמסך, צעדים ממוספרים, שגיאות ופתרונן, התוצאה הסופית | הקלדה חוזרת, המתנה להתקנה | "צעדים לשחזור", בלוקי קוד משמאל לימין, "מלכודות" | פריימים של עורך קוד (psc2code) |
| הדגמת מוצר* | מה הוצג בפועל מול מה שנטען, זרימת העבודה, מגבלות שנראו | שיווק כללי | טבלת "יכולת ← הוצגה? (זמן)" | ממשק מוצר על המסך |
| סדנה והדרכה* | ידע פרוצדורלי, תרגילים, תבניות, צ'קליסטים, טעויות נפוצות | המתנה לתרגול | "איך עושים", צ'קליסט, תרגילים לבית | הוראות "עכשיו נסו" |
| מצגת משקיעים ושיחת רבעון | מדדים ומספרים בטבלה, תחזית, שינוי מול תקופה קודמת, סיכונים, ובעיקר שאלות האנליסטים | הצהרות סטנדרטיות על "מבט צופה פני עתיד" | טבלת מספרים, "מה האנליסטים שאלו ומה נענה" | פתיח בהצהרת safe harbor, אנליסטים בשאלות |

- **הז'אנר קובע שלושה דברים:** (1) את רשימת שאלות התכנון (blueprint) של הניתוח; (2) את תוויות הרעש של הקטעים; (3) את סדר השכבות בתצוגה.
- **הצעת מכר לא נמחקת.** היא מתויגת, מסוכמת בניטרליות בתיבה נפרדת, ולא נכנסת לתזה, לעקרונות ולפעולות.
  - הקורא העסקי צריך לדעת מה הוצע ובכמה.
  - אבל טענות של "ערך נתפס" הן טענות שיווק, וצריך לסמן אותן כטענות לבדיקה.
- **בפאנל ובראיון, ייחוס הוא רכיב איכות ראשון במעלה.** כל עמדה תיקשר לדובר ולציטוט מילה במילה, בגלל כשלי הייחוס שנמצאו ב־DIAL-SUMMER וב־CHiME.

### Gaps
- לא נמצאו מאגרים מחקריים להדגמות מוצר, לסדנאות או לוובינרים מכירתיים. אין מדידה של דיוק זיהוי "הצעת מכר" בסרטון.
- נתוני ON24 ומבנה התסריט המכירתי מגיעים ממקורות שיווקיים או משניים.
- קטגוריות SponsorBlock מוגדרות על ידי מתנדבים ומותאמות לסרטוני רשת.
- לא נבדקו מוסכמות ז'אנר בהרצאות בעברית.

## 4. עדשות קהל והתאמה אישית

### Takeaway
אותו בסיס ראיות, אבל סדר, בחירה ועומק שונים לכל קורא:
- **לסטודנט:** הבנה וזכירה — שאלות לתרגול, כרטיסיות, רמות Bloom ו־SOLO, מילון ודרישות קדם.
- **לאיש עסקים:** החלטות, מספרים, סיכונים, פעולות ורמת ביטחון — לפי BLUF, Minto ו־ICD 203.
- **לחוקר:** טענות, ראיות, שיטה, מגבלות ומקורות.
- **מתחיל מול מומחה:** פועל "היפוך המומחיות" — הכוונה שעוזרת למתחיל מכבידה על מומחה.

התאמה לשאלה אישית של המשתמש היא בעצם "summarization מונחה שאילתה" (QMSum). במשימה הזו מודלים עדיין טועים, ולכן עדיף לבצע אותה מעל בסיס מאומת ולא מעל התמליל הגולמי.

### Cited Findings
- Expertise reversal (Kalyuga et al., 2003):
  - הכוונה שחיונית למתחילים עלולה לפגוע במומחים, כי היא מיותרת להם ומעמיסה.
  - לעיתים קרובות ההיפוך חלקי בלבד.
  - מקורות: [ויקיפדיה, Expertise reversal effect (נגיש 2026)](https://en.wikipedia.org/wiki/Expertise_reversal_effect); [Kalyuga (2007)](https://www.uky.edu/~gmswan3/EDC608/Kalyuga2007_Article_ExpertiseReversalEffectAndItsI.pdf).
- InstruSum — סיכום לפי דרישה בשפה טבעית:
  - כל מודלי השפה שנבדקו עדיין עשו טעויות עובדתיות וטעויות אחרות.
  - אף "שופט" מבוסס מודל שפה לא הסכים חזק עם בני אדם.
  - מקור: [Liu et al., NAACL Findings 2024](https://arxiv.org/abs/2311.09184).
- QMSum: "locate-then-summarize" — קודם מאתרים את הקטעים הרלוונטיים לשאילתה, ורק אז מסכמים — [Zhong et al., NAACL 2021](https://aclanthology.org/2021.naacl-main.472).
- לקורא העסקי: BLUF אומר מה המטרה ומה הפעולה הנדרשת — [HBR (2016) (משני)](https://businessday.ng/hbr/article/how-to-write-email-with-military-precision/). ICD 203 דורש לבטא אי־ודאות ורמת ביטחון למקבלי ההחלטות — [ODNI (2015)](https://www.dni.gov/files/documents/ICD/ICD-203.pdf).
- לקורא השקעות: חלק השאלות והתשובות מוסר יותר מידע — [Matsumoto et al. (2011)](https://repub.eur.nl/pub/25721).
- לסטודנט: שאלות תרגול ופיזור בזמן הן בתועלת הגבוהה ביותר — [Dunlosky et al. (2013)](https://www.psychologicalscience.org/news/releases/which-study-strategies-make-the-grade.html); [Roediger & Karpicke (2006)](https://psychology.ecu.edu/wp-content/pv-uploads/sites/216/2019/03/Roediger-Karpicke-2006.pdf). ממד הידע ב־Bloom מבחין בין ידע עובדתי, מושגי, פרוצדורלי ומטה־קוגניטיבי — [Krathwohl (2002)](https://rvc-web-app01.live01.azure.rvc.ac.uk/Media/Default/About/Academic%20Quality,%20Regulations%20and%20Procedures/Academic%20Quality%20Assurance%20and%20Enhancement%20Procedures/Module%20Development%20and%20Approval/A%20Revision%20of%20Bloom's%20Taxonomy%20-%20An%20Overview.%20David%20R.%20Krathwohl.pdf).
- כשהסרטון לא עונה על השאלה של המשתמש: לאפשר למודל לומר "I don't know", ולהגביל אותו למסמכים שסופקו — [Anthropic Docs, Reduce hallucinations (2026)](https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-hallucinations).

### Inferences
- **עדשה היא "תצוגה" מעל אותו JSON, ולא הפקה נפרדת.** היא קובעת סדר, סינון, עומק וחלקים נוספים.
  - כך הבסיס המאומת משותף לכל העדשות.
  - כך גם העלות נמוכה יותר, ואין סתירות בין העדשות.

| עדשה | מה בראש | מה מורחב | מה מקוצר | תוספות |
|---|---|---|---|---|
| סטודנט (הבנה ומבחן) | שורה אחת + "מה צריך לדעת" | עקרונות, הגדרות, דוגמאות, נוסחאות | ביקורת עסקית, הצעת מכר | שאלות לפי Bloom, כרטיסיות, שאלות רמז לכל פרק, דרישות קדם, "בלבולים נפוצים" |
| איש עסקים (החלטה) | BLUF + "מה זה אומר לי" + פעולות | מספרים, סיכונים והנחות (`if_wrong`), ישימות, מה לבדוק | גזירות תאורטיות | תזכיר החלטה; תיבת הצעת מכר; טענות לאימות |
| חוקר | תזה + חוזק הראיות | שיטה, מגבלות, מקורות, חידוש מול ספרות (מסומן כידע חיצוני) | פעולות | מפת טיעון מלאה, רשימת מקורות |
| מתחיל | מושגי יסוד | הגדרות בתוך הטקסט, דוגמאות מפורטות | ביקורת מתקדמת | דרישות קדם, מילון מורחב |
| מומחה | החידוש והביקורת | נתונים, הנחות, מתחים | יסודות והגדרות | השוואה למקובל |

- **שאלה אישית ("מה זה אומר לסטארט־אפ שלי?")** נענית בשלוש פעולות:
  1. איתור (locate) מעל יחידות הראיה וההערות.
  2. תשובה שמצטטת זמנים.
  3. אם הסרטון לא עונה — אומרים זאת במפורש, ומפרידים בין "מה נאמר" לבין "היסק".

### Gaps
- אין מחקר ישיר על החלקים שאנשי עסקים באמת משתמשים בהם.
- אין מחקר קהל לקוראי עברית.
- איכות ההתאמה האישית לא נמדדה.

## 5. הבטחת שלמות ומדידה

### Takeaway
פרומפט "מקיף" לא מבטיח שלמות. מודלים על קלט ארוך:
- משמיטים באופן שיטתי את האמצע;
- נותנים משקל יתר לסוף;
- דוחסים מעבר לנדרש;
- ותקציר במעבר אחד לא גדל עם אורך המקור.

לכן צריך חמישה מנגנונים:
1. **מלאים דטרמיניסטיים:** שקופיות, מספרים, ישויות, מונחים, מקורות, קוד ושאלות.
2. **חילוץ נפרד לכל קטע.**
3. **ספר חשבונות:** כל פריט במלאי הוא "שומש ב־X" או "הושמט כי Y".
4. **מעבר ביקורת כיסוי.**
5. **מדידה:**
   - יחידות תוכן מול שלד אנושי (בשיטת Pyramid).
   - ריקול מבוסס שאלות: שאלות מהמקור נענות מתוך הניתוח בלבד.
   - דיוק ברמת טענה (FActScore, MiniCheck).
   - איכות הציטוט (ALCE, SummHay).

שופט ממשפחת מודלים אחרת מצמצם את ההטיות של "שופט LLM".

### Cited Findings
**איפה מודלים מאבדים תוכן**
- "Lost in the middle": הביצועים הכי טובים כשהמידע בהתחלה או בסוף, ויורדים ככל שההקשר מתארך — [Liu et al., TACL 2024](https://aclanthology.org/2024.tacl-1.9/).
- בסיכום (6 מודלים, 10 מאגרים):
  - נמצא דפוס U — העדפה לפתיח, ובמידה פחותה לסוף.
  - נבנה מבחן MiddleSum.
  - סיכום היררכי וסיכום מצטבר הקלו על הבעיה רק חלקית.
  - מקור: [Ravaut et al., ACL 2024](https://aclanthology.org/2024.acl-long.153).
- FABLES — 3,158 טענות מסיכומים של 26 ספרים, בעלות של כ־$5.2K:
  - Claude 3 Opus היה הנאמן ביותר.
  - נבנתה טיפולוגיה של השמטות.
  - נמצאה "systematic over-emphasis on events occurring towards the end of the book".
  - שופטים אוטומטיים לא התאימו לבני אדם, "especially with regard to detecting unfaithful claims".
  - מקור: [Kim et al. (2024)](https://arxiv.org/abs/2404.01261).
- DIAL-SUMMER: תורות הדיבור באמצע נשמטות הכי הרבה — [DIAL-SUMMER (2026)](https://arxiv.org/abs/2602.08149).
- תקציר במעבר אחד לא גדל עם האורך:
  - מסמך של כמעט 15K טוקנים סוכם בפרמטר `detail` שקובע לכמה מקטעים לחלק.
  - detail=0 נתן 235 טוקנים; detail=1 נתן 6,742 — כמעט פי 25.
  - מקור: [OpenAI Cookbook, Summarizing long documents (2024, בארכיון)](https://developers.openai.com/cookbook/examples/summarizing_long_documents).
- SummHay:
  - הסיכום נמדד בשני צירים: Coverage של תובנות ו־Citation.
  - בני אדם קיבלו כ־56% ב־Joint Score. מערכות פיגרו ב־10 נקודות או יותר, גם עם אות רלוונטיות מושלם.
  - מודלים בעלי הקשר ארוך בלי אחזור קיבלו פחות מ־20%.
  - מקור: [Laban et al., EMNLP 2024](https://arxiv.org/abs/2407.01370).

**שיטות מדידה**
- Pyramid:
  - יחידות תוכן (SCU) באורך של עד פסוקית בערך, ממושקלות לפי מספר הסיכומים האנושיים שמכילים אותן — [Nenkova & Passonneau, NAACL 2004](https://aclanthology.org/N04-1019).
  - ארבעה עד חמישה סיכומי מודל הספיקו לדירוג יציב של מערכות — [מאמר DUC (2005)](https://corpora.tika.apache.org/base/docs/govdocs1/602/602471.pdf).
  - יש גרסאות אוטומטיות. למשל Lite3Pyramid מחליפה את יחידות התוכן שכתבו בני אדם ב"משולשות סמנטיות" (semantic triplets). המחקר שסוקר את תפקיד ה־SCU בהערכה: [Nawrath et al. (2024) (משני — דרך תקציר חיפוש)](https://arxiv.org/abs/2404.01701).
- הערכה מבוססת שאלות:
  - APES: עד כמה התקציר מאפשר לענות על "a set of manually created questions regarding central entities" — [Eyal, Baumel & Elhadad, NAACL 2019](https://aclanthology.org/N19-1395/).
  - QuestEval: "does not require any ground-truth reference", ומתאם עם בני אדם טוב יותר מ־ROUGE — [Scialom et al., EMNLP 2021](https://aclanthology.org/2021.emnlp-main.529/).
  - QAGS: שואלים את אותן שאלות על המקור ועל התקציר, ומשווים את התשובות — [Wang, Cho & Lewis, ACL 2020](https://aclanthology.org/2020.acl-main.450).
- FActScore:
  - מפרקים טקסט ל"עובדות אטומיות" ומודדים איזה אחוז מהן נתמך.
  - ChatGPT קיבל 58%.
  - המעריך האוטומטי טעה בפחות מ־2%.
  - מקור: [Min et al., EMNLP 2023](https://aclanthology.org/2023.emnlp-main.741).
- MiniCheck:
  - מודל קטן (770M) שבודק עובדות מול מסמך בדיוק ברמת GPT-4, בעלות נמוכה פי 400.
  - רוב הטענות נכונות, ולכן הבודק חייב שיעור נמוך של התראות שווא.
  - מקור: [Tang, Laban & Durrett, EMNLP 2024](https://arxiv.org/abs/2404.10774).
- ALCE: "even the best models lack complete citation support 50% of the time" (במאגר ELI5) — [Gao et al. (2023)](https://arxiv.org/abs/2305.14627).
- שופטי LLM:
  - G-Eval הגיע למתאם Spearman של 0.514 עם בני אדם בסיכום, אבל "a bias towards the LLM-generated texts" — [Liu et al. (2023)](https://arxiv.org/abs/2303.16634).
  - שופט חזק הגיע ליותר מ־80% הסכמה, כמו בין בני אדם, אבל עם הטיות "position, verbosity, and self-enhancement" — [Zheng et al. (2023)](https://arxiv.org/abs/2306.05685).

**מה שרק על המסך**
- Gemini דוגם וידאו בפריים אחד לשנייה כברירת מחדל, ו"may miss details in videos with rapid motion or quick scene changes" — [Google AI Studio, Video understanding (2026)](https://aistudio.google.com/docs/video-understanding).
- בסרטוני קוד, OCR "עיוור" רועש. סינון פריימים וחיתוך אזור העורך משפרים מאוד את התוצאה — [Bao et al. (2020)](https://arxiv.org/abs/2103.11610).
- תמליל ופריימים יחד עדיפים על כל אחד לבדו, במיוחד בסרטון ארוך — [Video-MME (2024)](https://arxiv.org/html/2405.21075).

### Inferences
**מנגנוני השלמות (בסדר הפעלה):**
1. **מלאים דטרמיניסטיים לפני כל LLM:**
   - רשימת שקופיות (שינוי שקופית לפי זיהוי סצנה, OCR לכל שקופית).
   - כל המספרים מהתמליל ומה־OCR (ביטוי רגולרי, נרמול "35%", "‎$4M", "1.2 מיליון").
   - ישויות ושמות.
   - מונחים.
   - הפניות (ספר, מאמר, כלי, קישור).
   - בלוקי קוד.
   - שאלות שנשאלו (סימן שאלה, מעבר דובר).
2. **זיהוי "רק על המסך":**
   - לכל בלוק OCR משווים את המילים לתמליל באותו חלון זמן (למשל ±30 שניות).
   - ביטויים, מספרים וסדרות בלי התאמה מסומנים `screen_only`, וחייבים להיכנס להערות או לטבלת הנתונים.
   - גרף או תרשים בלי טקסט: מבקשים תיאור ממודל ראייה (Gemini על קטע עם `fps` גבוה יותר, או Claude על הפריים).
3. **ספר חשבונות שנאכף בקוד:**
   - כל `slide.id`, כל מספר וכל ישות מופיעים בשדה `used_in` של פריט כלשהו, או ב־`dropped` עם סיבה מרשימה סגורה: `duplicate`, `decorative`, `agenda`, `title_only`, `sponsor`, `filler`.
   - הקוד חוסם פרסום ניתוח עם פריטים "תלויים באוויר".
4. **מעבר ביקורת כיסוי לכל פרק:** מודל זול משווה הערות פרק לתמליל ול־OCR של אותו פרק, ומחזיר רשימת חסרים. רק החסרים נשלחים לתיקון — לא כל הניתוח מחדש.
5. **מדידה על "סט זהב":**
   - כ־10 סרטונים לכל ז'אנר מרכזי: הרצאה באנגלית, הרצאה בעברית, וובינר, כנס, מדריך, פאנל.
   - שלד אנושי לכל סרטון, מפורק ליחידות תוכן ממושקלות.
   - בגלל העלות: 2–3 מסמנים ולא 4–5. הספרות מצביעה על 4–5 לדירוג יציב, ולכן זו פשרה.
   - המדד: אחוז משקל היחידות שנמצאו בניתוח.
6. **ריקול מבוסס שאלות (QA-recall):**
   - מודל ממשפחה אחרת (Gemini, שרואה גם את הווידאו) מנסח N שאלות לכל פרק. חלקן חייבות להיות על תוכן "רק על המסך".
   - מודל אחר עונה מתוך הניתוח בלבד.
   - מודדים ריקול כללי, וריקול נפרד ל"רק על המסך".
   - שאלות שלא נענו מצביעות בדיוק על החור בניתוח.
7. **דיוק ברמת טענה:**
   - מפרקים את הניתוח לטענות אטומיות (FActScore).
   - בודק זול (MiniCheck או Haiku) קובע לכל טענה: נתמכת / חלקית / לא נתמכת / סותרת.
   - ציטוטים ומספרים נבדקים בקוד בהתאמה מדויקת.
8. **שופט שאינו המחבר:**
   - Gemini שופט ניתוח של Claude, או להפך.
   - מחליפים את סדר ההצגה בהשוואות.
   - בני אדם בודקים מדגם של כ־10%.

**ספי קבלה (הצעה ראשונית, לכיול על סט הזהב):**
- 100% מהשקופיות מטופלות בספר החשבונות.
- 95% ומעלה מהמספרים משומשים או מוצדקים.
- ריקול שאלות של 0.9 ומעלה, ו־0.85 ומעלה לשאלות "רק על המסך".
- 0 טענות "לא נתמכות" בפלט הסופי.
- 100% מהציטוטים זהים למקור מילה במילה.

### Gaps
- אין benchmark ציבורי לשלמות ניתוח של הרצאות. הספים שלמעלה הם הצעה.
- עלות מעבר ה־QA לסרטון לא נמדדה.
- שיעורי השגיאה של OCR ושל ASR בעברית לא נבדקו במחקר הזה.
- עלות הכנת שלדי זהב אנושיים לא נבדקה.

## 6. פייפליין רב־שלבי לקלט ארוך: מבנה, תבניות פרומפט, סכמות, כשלים ותיקונים

### Takeaway
הראיות מתכנסות לרצף אחד:
1. פיצול לקטעים.
2. חילוץ מובנה לכל קטע, עם זמנים ומזהי ראיה (map).
3. מיזוג שמטפל במפורש בתלויות ובסתירות בין קטעים (reduce).
4. סינתזה מתוך ההערות המובנות, במודל החזק.
5. ביקורת ותיקון מול רובריקה, עם שופט אחר.
6. אימות טענה אחר טענה מול הראיה.
7. עיצוב הפלט.

הפשרה הידועה:
- מיזוג היררכי נותן קוהרנטיות אבל מאבד פרטים.
- עדכון מצטבר שומר פרטים אבל פחות קוהרנטי.
- לכן הפרטים נשמרים בשכבה המובנית (JSON), והפרוזה נכתבת מעליה.

ב־Claude ספציפית:
- הנתונים הארוכים בראש הפרומפט והשאלה בסוף (עד 30% שיפור).
- ציטוטים קודם (מעל 20K טוקנים).
- תגיות XML.
- ציטוטים דרך "custom content document": כל יחידת תמליל היא בלוק, ומספר הבלוק מתורגם לזמן מדויק.
- **אבל** Citations ו־Structured Outputs לא עובדים יחד באותה בקשה.

### Cited Findings
**ארכיטקטורה**
- BooookScore:
  - מיזוג היררכי נותן סיכומים קוהרנטיים יותר, עם פחות פרטים. עדכון מצטבר נותן יותר פרטים וציון קוהרנטיות נמוך יותר.
  - מודלים סגורים קיבלו ציון גבוה יותר ממודלים פתוחים.
  - מקור: [Chang et al., ICLR 2024](https://arxiv.org/abs/2310.00785).
- פירוק רקורסיבי של ספר עם משוב אנושי:
  - רק כ־5% מהסיכומים הגיעו לאיכות אנושית.
  - בני אדם יכלו לפקח על התהליך בלי לקרוא את הספר כולו.
  - מקור: [Wu et al. (2021)](https://arxiv.org/abs/2109.10862).
- Chain of Agents:
  - "עובדים" קוראים את הקטעים לפי הסדר, וכל אחד מעביר "communication unit" לבא אחריו. "מנהל" כותב את התשובה הסופית.
  - הקשר קצר לכל עובד מצמצם את בעיית האמצע.
  - דווח (משני) שהשיטה עדיפה על מיזוג ועל מבנה היררכי.
  - מקור: [Zhang et al., NeurIPS 2024](https://arxiv.org/abs/2406.02818).
- LLM×MapReduce מגדיר שתי בעיות שנוצרות מפיצול:
  - "inter-chunk dependency": ראיות שמפוזרות בין קטעים.
  - "inter-chunk conflict": ראיות סותרות בין קטעים.
  - הפתרון: "structured information protocol" (עובדות, נימוק, תשובה, ציון ביטחון), וכיול ביטחון בתוך ההקשר כדי ליישב סתירות.
  - מקור: [LLM×MapReduce (2024; ACL 2025)](https://arxiv.org/abs/2410.09342).
- Anthropic, Building effective agents:
  - דפוסים: prompt chaining עם "gates" בין השלבים; routing; parallelization (sectioning ו־voting); orchestrator-workers; evaluator-optimizer.
  - מקור: [Anthropic (2024)](https://www.anthropic.com/engineering/building-effective-agents).
- שרשור "self-correction": טיוטה, ביקורת מול קריטריונים, ואז שכתוב — כל אחד בקריאה נפרדת, כדי לתעד ולהעריך כל שלב — [Anthropic Docs, Prompting best practices (2026)](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices).

**תבניות פרומפט לקלט ארוך**
- Claude, מעל 20K טוקנים:
  - "Put long-form data at the top". לפי הבדיקות: "Queries at the end can improve response quality by up to 30 percent".
  - לעטוף כל מסמך בתגיות `<document>`, עם `<document_content>` ו־`<source>`.
  - "ask Claude to quote relevant parts of the documents first".
  - מקור: [Anthropic Docs (2026)](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices).
- הפחתת המצאות לפי Anthropic:
  - לאפשר למודל לומר "I don't know".
  - במסמכים ארוכים מ־20K טוקנים: לחלץ ציטוטים מילה במילה קודם.
  - אימות עם ציטוטים — "If it can't find a quote, it must retract the claim".
  - Best-of-N, ושכתוב איטרטיבי.
  - הגבלה למסמכים שסופקו בלבד.
  - מקור: [Anthropic Docs (2026)](https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-hallucinations).
- Gemini עם הקשר ארוך:
  - השאלה בסוף הפרומפט.
  - עם כמה "מחטים" (פרטים לאתר) בבת אחת, "the model does not perform with the same accuracy".
  - מטמון הקשר מוזיל שאלות חוזרות.
  - מקור: [Google AI Studio, Long context (2026)](https://aistudio.google.com/docs/long-context).
- Gemini עם וידאו:
  - הפניה לרגעים בפורמט `MM:SS`.
  - פריים אחד לשנייה כברירת מחדל.
  - כ־100 טוקנים לשנייה ברזולוציה נמוכה, וכ־300 ברזולוציה גבוהה. אודיו: 32 טוקנים לשנייה.
  - אפשר לקבוע `fps` משלכם ולחתוך קטע (`start_offset`/`end_offset`), במצב static.
  - מקור: [Google AI Studio, Video understanding (2026)](https://aistudio.google.com/docs/video-understanding).

**ציטוטים וסכמות**
- Citations ב־Claude:
  - "custom content" מתאים במיוחד ל־"Lists, transcripts". אין חלוקה נוספת למקטעים, והציטוט מוחזר כ"Block indices".
  - `cited_text` לא נספר בטוקני הפלט, וגם לא בטוקני הקלט כשמחזירים אותו בתור הבא.
  - הציטוטים "guaranteed to contain valid pointers".
  - "significantly more likely to cite the most relevant quotes" מאשר ציטוט שמבוקש בפרומפט.
  - **לא תואם** ל־Structured Outputs: השילוב מחזיר שגיאה 400.
  - מקור: [Anthropic Docs, Citations (2026)](https://platform.claude.com/docs/en/build-with-claude/citations).
- Structured Outputs ב־Claude:
  - פענוח מוגבל לפי הסכמה (constrained decoding).
  - לא נתמכים: סכמות רקורסיביות, `minimum`/`maximum`, `minLength`/`maxLength`, הפניות `$ref` חיצוניות, מגבלות מערך מעבר ל־`minItems` של 0 או 1, ו־`additionalProperties` שאינו `false`.
  - חריגים לתאימות לסכמה: סירוב, או עצירה ב־`max_tokens`.
  - מקורות: [Anthropic Docs, Structured outputs (2026)](https://platform.claude.com/docs/en/build-with-claude/structured-outputs); [הכרזה (14/11/2025)](https://claude.com/blog/structured-outputs-on-the-claude-developer-platform).
- Structured Output ב־Gemini:
  - נתמכת "a subset of the JSON Schema specification".
  - "Very large or deeply nested schemas may be rejected".
  - `minLength` ודומיו לא נאכפים. `minItems`/`maxItems` נאכפים.
  - ההמלצה: להעביר כללים שאינם מבניים לשדה `description`, ולבדוק אותם בקוד.
  - מקור: [Google AI Studio, Structured output (2026)](https://aistudio.google.com/docs/structured-output).

**כשלים מתועדים**
- **"גנרי ודליל":** סיכום של GPT-4 עם פרומפט רגיל היה פחות צפוף מכפי שקוראים העדיפו — [Adams et al. (2023)](https://arxiv.org/abs/2309.04269).
- **דחיסת יתר:** תקציר במעבר אחד לא גדל עם האורך — [OpenAI Cookbook (2024)](https://developers.openai.com/cookbook/examples/summarizing_long_documents).
- **השמטות ונטייה לסוף:** [FABLES (2024)](https://arxiv.org/abs/2404.01261). לפי תקציר חיפוש, רוב הטענות הלא נאמנות עסקו באירועים ובמצבים של דמויות ויחסים (לא אומת ישירות).
- **אובדן האמצע:** [Liu et al. (2024)](https://aclanthology.org/2024.tacl-1.9/); [Ravaut et al. (2024)](https://aclanthology.org/2024.acl-long.153); [DIAL-SUMMER (2026)](https://arxiv.org/abs/2602.08149).
- **חיבורים מומצאים בין עובדות לא קשורות:** [STORM (2024)](https://arxiv.org/abs/2402.14207).
- **ייחוס דוברים:**
  - "shift in narration viewpoint" — [DIAL-SUMMER (2026)](https://arxiv.org/abs/2602.08149).
  - תוויות דוברים לא מיושרות — [CHiME review (2025)](https://arxiv.org/pdf/2507.18161).
- **ציטוטים חסרים:** חצי מהתשובות בלי תמיכה מלאה — [ALCE (2023)](https://arxiv.org/abs/2305.14627).
- **ביקורת עצמית מוגבלת:** בלי משוב חיצוני המודל לא מוצא את הטעויות שלו — [Self-Refine (2023)](https://nips.cc/media/neurips-2023/Slides/71632.pdf).

### Inferences
**כשל, תיקון והשלב שבו מטפלים בו:**

| כשל | תיקון | שלב |
|---|---|---|
| קלישאות גנריות ("חשוב להתמיד", "המפתח הוא חדשנות") | כלל ספציפיות: כל נקודה מכילה ישות, מספר או דוגמה מהסרטון ומזהה ראיה; רשימת ביטויים אסורים; סבב ציפוף בסגנון CoD לשכבה העליונה | map, synthesis, critique |
| דחיסת יתר | אורך יחסי למלאי התוכן ולא למשך; פרק = קריאה נפרדת (בדומה לפרמטר `detail`); סולם דחיסה | map |
| מבנה מומצא | השלד נגזר רק מסמנים: מאקרו־סמנים, כותרות שקופיות, פרקים; לכל פרק שדה `boundary_cue` | segmentation |
| אובדן ניואנסים | שדה `qualifier` ב־Toulmin; העתקת מילות הסתייגות ("לרוב", "במדגם שלנו") כלשונן; בדיקת qualifier באימות | map, verify |
| ייחוס שגוי | מזהי דובר מה־diarization + שלב זיהוי שמות; ציטוט = מחרוזת מדויקת מהתמליל (נבדק בקוד); בפאנל — עמדה לכל דובר; איסור מעבר לגוף שלישי בלי שם | map, verify |
| אובדן אמצע ונטייה לסוף | map לכל פרק, כך שכל קטע מקבל קשב שווה; ביקורת כיסוי לכל פרק; ב־reduce סדר הפרקים מוצג עם המשקלות | map, audit, reduce |
| מספרים מומצאים | כל מספר בפלט חייב להופיע במלאי המספרים (השוואה מנורמלת בקוד) | verify |
| זיהום מהצעת המכר | תיוג קטעים לפני הסינתזה; הסינתזה מקבלת רק קטעי תוכן, וההצעה מסוכמת בנפרד | segmentation, synthesis |
| ידע חיצוני שמתחזה לתוכן | הגבלה למסמכים, חוץ מבשדות שמסומנים `external_knowledge` | synthesis |
| שופט מוטה | שופט ממשפחה אחרת; היפוך סדר; רובריקה סגורה | critique, eval |

**תבניות פרומפט (שלד; ההוראות באנגלית, הפלט בעברית בשלב העיצוב):**

```text
[MAP — one call per chapter; long data first, task last]
<global_outline>…chapter titles + one-line purposes…</global_outline>   ← cached
<glossary_so_far>…</glossary_so_far>                                       ← cached
<inventory chapter="c3">slides: sl7, sl8 · numbers: 35%, $4M · entities: … · terms: …</inventory>
<chapter id="c3" t0="300.0" t1="845.0">
  <unit id="e101" t="300.4-306.9" kind="speech" spk="S1">…</unit>
  <unit id="e102" t="300.0-372.0" kind="slide" slide="sl7">…OCR text…</unit>
</chapter>
Extract into the schema. Rules:
- Every item cites ≥1 unit id from THIS chapter. Quotes are exact substrings of one speech unit.
- Mark source: speech | screen_only | both. Integrate each slide with what was said about it.
- Use every inventory item, or list it under "dropped" with a reason from the allowed list.
- Keep qualifiers and hedges verbatim. Do not add knowledge that is not in the units.
- Finish with: what this chapter adds to the whole (≤2 sentences) + confidence (high|medium|low).
```

```text
[SYNTHESIS — strongest model; input = merged structured notes with unit ids]
Answer in order; for each item give evidence ids, provenance (speaker | analyst_inference |
external_knowledge) and confidence:
1 the question the talk answers (situation, complication, question) · 2 thesis in one sentence ·
3 argument tree (claim, grounds, warrant + stated?, qualifier, rebuttals) · 4 key assumptions,
stated or hidden, and what changes if each is wrong · 5 mechanisms, causal chains, mental models ·
6 implications (general; for the {lens} reader) · 7 tensions, contradictions, omissions, competing
explanations · 8 novel vs conventional (external knowledge allowed, labeled).
Then step back: 3–7 principles that generalize beyond this video — statement, when it applies,
one example from the video. No generic advice: every point names a concrete entity, number or
example from the notes.
```

```text
[VERIFY — cheap model, or the Citations API with transcript units as custom-content blocks]
For each atomic claim: find supporting unit(s) → supported | partial | unsupported | contradicted.
Unsupported → delete, or rewrite as analyst_inference; never keep it as a speaker claim.
Quotes and numbers are checked by code, not by you.
```

**עקרונות סכמה:**
- רשימות שטוחות עם מזהים והפניות (`parent`, `ev`) במקום עצים רקורסיביים, כי Claude לא תומך ברקורסיה בסכמה.
- `enum` לכל שדה סיווג.
- `additionalProperties: false` בכל אובייקט.
- ספירות ואורכים נבדקים בקוד.
- סכמה קטנה לכל שלב במקום סכמה ענקית אחת, כי Gemini עלול לדחות סכמה גדולה או עמוקה.
- שדה `description` לכל שדה, עם הכללים שאינם מבניים.

**ציטוטים מול JSON:**
- בשלבי ה־JSON המודל מחזיר מזהי ראיה (`ev`), והקוד בודק שכל מזהה קיים ושכל ציטוט הוא תת־מחרוזת של היחידה שלו.
- בשלב האימות, או בשלב פרוזה בלי סכמה, משתמשים ב־Citations API:
  - כל יחידת תמליל היא בלוק במסמך "custom content".
  - מספר הבלוק שמוחזר הוא מזהה היחידה, ומזהה היחידה הוא הזמן המדויק.
  - כך מקבלים קישור לזמן שמובטח שהוא תקף, בלי עלות טוקנים על הטקסט המצוטט.

### Gaps
- לא נמצאה השוואה ישירה של הפייפליינים האלה על סרטוני הרצאות עם הדור הנוכחי (Claude 5.5, Gemini העדכני).
- היתרונות של CoA ו־LLM×MapReduce מדווחים בידי מחבריהם בלבד.
- עלות וזמן לכל שעת וידאו לא נמדדו.
- לא ידוע אם סינתזה ב־Opus 5.5 עדיפה באופן מהותי על Sonnet 5.5 במשימה הזו. זה דורש הערכה על סט הזהב.

## 7. איכות העברית בפלט

### Takeaway
העקרונות לעברית מקצועית וברורה:
- **כותבים עברית "מקורית", לא תרגומית.** עדיף לייצר את העברית מנתונים מובנים ולא לתרגם פרוזה באנגלית.
- **פנייה ברבים וניטרלית מגדרית:** "תוכלו", "כדאי ל…".
- **מונחים באנגלית:** ראשי תיבות ושמות מוצרים נשארים באותיות לטיניות, אלא אם יש תרגום עברי מקובל. מילה שאולה ומושרשת נכתבת באותיות עבריות.
- **מספרים:** מספרים קטנים מ־10 נכתבים במילים בטקסט רגיל, חוץ מליד יחידות מידה.
- **פיסוק:** לא שמים פסיק לפני ו׳ החיבור, חוץ מבין שני משפטים שלמים.
- **טקסט מעורב:** כל רצף לטיני, קוד או זמן מבודד לכיוון (`dir="auto"` או `<bdi>`, או תווי isolate של Unicode — לא embeddings).

עברית היא שפה עשירה מורפולוגית ו"דלת משאבים" למודלי שפה. לכן כדאי לייעד מעבר עריכה עברי במודל חזק, עם מילון מונחים קבוע לכל סרטון וקורס.

### Cited Findings
- מדריך הלוקליזציה לעברית של Microsoft (2022). הכללים הרלוונטיים:
  - להימנע מתרגום מילה במילה ("stiff and unnatural"). מותר לפצל משפט ארוך לשניים.
  - ראשי תיבות נשארים באנגלית, אלא אם יש תרגום עברי מקובל — I/O ← "קלט/פלט", VAT ← "מע״מ". אז אפשר להוסיף את ראשי התיבות בסוגריים.
  - RAM, ROM ו־USB נשארים כמו שהם. אם בטקסט מופיע גם המונח המלא, מתרגמים אותו.
  - מילה שאולה ומושרשת עדיפה: "אינטרנט" (+) ולא "מרשתת" (−); "אוטומטי" ולא "ממוכן".
  - שמות מוצרים וסימנים מסחריים נשארים באנגלית.
  - מספרים קטנים מ־10 נכתבים במילים, חוץ מליד יחידת מידה ("3 MB").
  - לא שמים פסיק לפני ו׳ החיבור, חוץ מחיבור של שני משפטים שלמים. לא מחליפים פסיק בנקודתיים.
  - לא שמים מירכאות סביב פקודה שהמשתמש צריך להקליד.
  - ניטרליות מגדרית: פנייה ברבים ("תוכלו", "לחצו על"). בטקסט כללי — "אפשר ל…" או "יש ל…". צורות עם לוכסן — רק כמוצא אחרון.
  - מקור: [Microsoft, Hebrew Localization Style Guide (2022)](https://download.microsoft.com/download/a/2/f/a2ff07cc-afca-4db8-9ed7-fd1b706abf1c/heb-isr-StyleGuide.pdf).
- טקסט דו־כיווני ב־HTML:
  - W3C ממליץ לסמן בתגית כל מעבר כיוון.
  - לטקסט שהכיוון שלו לא ידוע מראש: `dir=auto`, או `<bdi>` כשאין תגית מתאימה. `<bdi>` "directionally isolates its content".
  - מקור: [W3C i18n, Inline markup and bidirectional text in HTML (נגיש 2026)](https://www.w3.org/International/articles/inline-bidi-markup/).
- `<bdi>` נתמך באופן רחב בדפדפנים מינואר 2020. כשיש תגית סמנטית מתאימה, עדיף להשתמש בה עם `dir="auto"` — [MDN (נגיש 2026)](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/bdi).
- Unicode UAX #9 (מהדורה 52, 1/9/2026):
  - "the use of the directional isolates instead of embeddings is encouraged in new documents".
  - תווי override "are to be avoided wherever possible, because of security concerns".
  - ב־HTML עדיף להשתמש בתגיות וב־CSS במקום בתווי עיצוב.
  - מקור: [Unicode (2026)](https://www.unicode.org/reports/tr9/).
- כללי התעתיק מלועזית לעברית של האקדמיה ללשון העברית:
  - אושרו ב־21/5/2007 ופורסמו ברשומות בספטמבר 2011. תוקנו ב־2017 וב־2020.
  - מיועדים לשמות של אנשים, מקומות ומוסדות.
  - מבוססים על ההגייה בעברית בת ימינו.
  - מקור: [האקדמיה ללשון העברית, התעתיק מלועזית לעברית (2020) (לא אומת ישירות — 403)](https://old.hebrew-academy.org.il/wp-content/uploads/taatik-loazit-2020.pdf).
- עברית במודלי שפה:
  - "Hebrew is a morphologically rich language", ו"considered a low-resource language".
  - שיטות פירוק לטוקנים שנבנו לשפות פשוטות יותר מבחינה מורפולוגית "ineffective" לעברית.
  - מקור: [Hugging Face, Open Leaderboard for Hebrew LLMs (5/5/2024)](https://huggingface.co/blog/leaderboard-hebrew).
- לשון פשוטה בעברית:
  - בניסוי, נוסחים בלשון פשוטה של טקסטים משפטיים שיפרו את ההבנה של מי שאינם משפטנים וקיצרו את זמן הקריאה — [Peer, TAU Law Review (שנה לא צוינה במקור שנבדק)](https://www.taulawreview.sites.tau.ac.il/_files/ugd/6a76e2_c80db95a10454d41b1d8199c02faa5c7.pdf).
  - משפטים קצרים (שורה עד שתיים), בלי סלנג — [מכללת ספיר, דגשים לכתיבה בהירה (2025)](https://it.sapir.ac.il/wp-content/uploads/2024/11/%D7%93%D7%92%D7%A9%D7%99%D7%9D-%D7%9C%D7%9B%D7%AA%D7%99%D7%91%D7%94-%D7%91%D7%94%D7%99%D7%A8%D7%94-2025.pdf).
  - חלוקה נכונה של המידע, הבלטת הרלוונטי, כתיבה למשתמש, ולשון תמציתית ופשוטה — [כל זכות, סגנון כתיבה (נגיש 2026)](https://www.kolzchut.org.il/he/%D7%A2%D7%96%D7%A8%D7%94:%D7%9E%D7%93%D7%A8%D7%99%D7%9A_%D7%9C%D7%A2%D7%95%D7%A8%D7%9A/%D7%A1%D7%92%D7%A0%D7%95%D7%9F_%D7%9B%D7%AA%D7%99%D7%91%D7%94).
  - ממשלת בריטניה מחייבת לשון פשוטה בכל התוכן שלה — [GOV.UK (נגיש 2026)](https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/tone-of-voice/clear-language).

### Inferences
**גיליון סגנון לניתוח בעברית (הצעה):**
1. **מייצרים מ־JSON, לא מתרגמים פרוזה.** שלב העיצוב כותב עברית ישירות מהשדות המובנים. כך נמנעים מעברית תרגומית, וזה מתאים להמלצת Microsoft נגד תרגום מילה במילה.
2. **מונחים:**
   - באזכור הראשון: "מונח עברי (English term)". אחר כך — העברי בלבד.
   - מילה שאולה ומושרשת: באותיות עבריות.
   - שמות מוצרים, ראשי תיבות וקוד: באותיות לטיניות.
   - מילון מונחים לכל סרטון וקורס נשמר ומוזרק לכל קריאה, כדי שהמונחים יהיו עקביים בין פרקים ובין מודולים.
3. **פנייה:** ברבים וניטרלית מגדרית ("תוכלו", "כדאי ל…", "אפשר ל…").
4. **מספרים:**
   - נתונים, יחידות ואחוזים — בספרות, כמו במקור.
   - מטבע ויחידות — כמו במקור, ובלי המרה. אם ממירים, ההמרה מסומנת.
   - תאריכים — בפורמט ישראלי.
   - חותמות זמן — שבב לחיץ בכיוון משמאל לימין ומבודד (`<bdi dir="ltr">12:34</bdi>`).
5. **ציטוטים:** המקור מילה במילה בשפת המקור, ותרגום עברי מתחת, עם שם הדובר וזמן. אף פעם לא "מתרגמים בתוך מירכאות" בלי לסמן.
6. **טקסט מעורב:**
   - כל רצף לטיני, URL או נוסחה בתוך `dir="auto"` או `<bdi>`.
   - קוד ונוסחאות — בבלוקים משמאל לימין.
   - בלי תווי embedding או override.
7. **משפטים:** קצרים (שורה עד שתיים), פעילים, רעיון אחד בכל נקודה.
8. **בדיקת עברית אוטומטית בקוד:**
   - כל מונח לטיני מופיע במילון.
   - אין מונח אחד בשני תרגומים שונים.
   - אין פסיק לפני ו׳ באמצע רשימה.
   - כל שבב זמן מבודד.
9. **מודל:** השכבה העליונה (BLUF ותובנות) נכתבת במודל החזק. איכות העברית נמדדת בנפרד מאיכות התוכן — ראו Gaps.

### Gaps
- לא נמצא מדריך ממשלתי ישראלי רשמי ללשון פשוטה.
- דפי הפיסוק והתעתיק של האקדמיה חסומים (403), ולכן לא אומתו ישירות.
- לא נמצאה מדידה של איכות כתיבת תקצירים בעברית ב־Claude או ב־Gemini.
- לא נמצא מחקר על העדפות קוראי עברית לגבי מונחים באנגלית בתוך הטקסט.

## 8. הסינתזה: מודל התוכן ב־JSON והפייפליין המוצע

### Takeaway
ההמלצה בקיצור:
- **JSON קנוני אחד** שכל פריט בו מעוגן ביחידות ראיה עם זמן. העדשות הן תצוגות שלו.
- **עשרה שלבים, ומודל לפי סוג העבודה:**
  - קוד ו־CPU למלאים וליישור.
  - Haiku 5.5 לתיוג, לחילוץ לכל פרק ולאימות.
  - Sonnet 5.5 למיזוג ולכתיבת גוף הניתוח בעברית.
  - Opus 5.5 לסינתזה, לתיקון ולשכבה העליונה בעברית.
  - Gemini לתוכן חזותי שה־OCR מפספס, כשופט ממשפחה אחרת, ולניסוח שאלות הבדיקה מתוך הווידאו.
- **Batch API** לניתוחים שלא דחופים (חצי מחיר).

### Cited Findings
- מחירים (לכל מיליון טוקנים):
  - Opus 5.5: ‏$4 קלט / $20 פלט. קריאה מהמטמון: $0.20.
  - Sonnet 5.5: ‏$2 / $10. קריאה מהמטמון: $0.10.
  - Haiku 5.5, פרומפט עד 100,000 טוקנים: ‏$0.10 / $0.50.
  - Haiku 5.5, פרומפט מעל 100,000 טוקנים: ‏$0.50 / $2.50 — והמחיר הגבוה חל על כל הבקשה.
  - אורך הפרומפט כולל גם קריאות וכתיבות למטמון. לכן בקשה מעל הסף משלמת את המחיר הגבוה גם כשחלק ממנה מגיע מהמטמון.
  - Batch API: הנחה של 50% על קלט ופלט. ההנחה מצטברת עם הנחת המטמון.
  - מודלים מדור 4.6 ואילך כוללים חלון של מיליון טוקנים במחיר הרגיל, חוץ מ־Haiku 5.5 שמתומחר לפי אורך.
  - מקור: [Anthropic, Pricing (2026)](https://platform.claude.com/docs/en/about-claude/pricing).
- נימוקים לבחירת המודלים:
  - המודל החזק ביותר היה הנאמן ביותר בסיכום ספרים: Claude 3 Opus ב־FABLES — [Kim et al. (2024)](https://arxiv.org/abs/2404.01261). הוא גם היה החזק ביותר ב־Coverage ב־SummHay, לפי סיכום משני — [Laban et al. (2024)](https://arxiv.org/abs/2407.01370).
  - מודלים סגורים קיבלו ציון קוהרנטיות גבוה יותר — [BooookScore (2024)](https://arxiv.org/abs/2310.00785).
  - מודל קטן יכול לבדוק עובדות ברמת GPT-4 בעלות נמוכה פי 400 — [MiniCheck (2024)](https://arxiv.org/abs/2404.10774). לכן אימות לא דורש את המודל היקר.
  - לשופט LLM יש הטיית "self-enhancement" — [Zheng et al. (2023)](https://arxiv.org/abs/2306.05685). לכן השופט ממשפחה אחרת.
  - Citations ו־Structured Outputs לא תואמים באותה בקשה — [Anthropic Docs (2026)](https://platform.claude.com/docs/en/build-with-claude/citations).
  - Gemini מקבל וידאו ישירות, עם חיתוך קטע ו־`fps` משלכם — [Google AI Studio (2026)](https://aistudio.google.com/docs/video-understanding).

### Inferences

#### מודל התוכן (JSON קנוני, גרסה 1)
עקרונות:
- כל פריט שמוצג לקורא נושא `ev`: רשימת מזהי יחידות ראיה. יחידת ראיה = טווח זמן + סוג (דיבור, שקופית, גרף, קוד, מסך הדגמה) + טקסט מילה במילה.
- הממשק מתרגם `ev[0].t0` לשבב זמן לחיץ.
- שדה `basis` מבחין בין דובר, היסק של המנתח וידע חיצוני (ICD 203).
- שדה `source` מבחין בין דיבור, "רק על המסך" ושניהם (WCAG).
- כל המבנים שטוחים, עם מזהים, כדי שיתאימו ל־Structured Outputs.

```json
{
  "schema": "snb.video-analysis/1",
  "video": {
    "id": "vid_x", "title": "…", "lang": "en", "duration_s": 3725,
    "genre": "business_webinar", "genre_confidence": "high", "default_lens": "business",
    "speakers": [{"id": "S1", "name": "…", "role": "host", "name_source": "slide"}]
  },
  "evidence": [
    {"id": "e101", "t0": 300.4, "t1": 306.9, "kind": "speech", "speaker": "S1", "text": "…"},
    {"id": "e102", "t0": 300.0, "t1": 372.0, "kind": "slide", "slide": "sl7", "text": "…OCR…"}
  ],
  "segments": [
    {"id": "g4", "t0": 300.0, "t1": 845.0, "type": "content", "boundary_cue": "macro_marker"},
    {"id": "g9", "t0": 2900.0, "t1": 3600.0, "type": "pitch", "boundary_cue": "offer_transition"}
  ],
  "slides": [
    {"id": "sl7", "t0": 300.0, "t1": 372.0, "title": "…", "screen_only_ev": ["e102"], "used_in": ["n31", "d1"]}
  ],
  "briefing": {
    "one_liner": "…",
    "bluf": "…",
    "scq": {"situation": "…", "complication": "…", "question": "…"},
    "takeaways": [{"id": "k1", "text": "…", "weight": "high", "ev": ["e101", "e102"]}],
    "so_what": {"student": "…", "business": "…"}
  },
  "thesis": {"text": "…", "basis": "speaker", "ev": ["e40"]},
  "arguments": [
    {"id": "a1", "claim": "…", "supports": "thesis",
     "grounds": [{"text": "…", "ev": ["e110"]}],
     "warrant": {"text": "…", "explicit": false},
     "qualifier": "…", "rebuttals": ["…"], "strength": "moderate", "ev": ["e111"]}
  ],
  "principles": [
    {"id": "p1", "statement": "…", "applies_when": "…", "knowledge_type": "conceptual",
     "basis": "speaker", "examples": ["x2"], "ev": ["e120"]}
  ],
  "frameworks": [
    {"id": "f1", "name": "…", "parts": [{"name": "…", "role": "…"}], "slide": "sl9", "ev": ["e130"]}
  ],
  "chapters": [
    {"id": "c3", "t0": 300.0, "t1": 845.0, "title": "…", "purpose": "…", "adds_to_whole": "…",
     "summary": "…", "cue_questions": ["…"]}
  ],
  "notes": [
    {"id": "n31", "chapter": "c3", "order": 1, "text": "…", "source": "screen_only", "ev": ["e102"]}
  ],
  "data": [
    {"id": "d1", "value": "35", "unit": "%", "measure": "…", "context": "…", "as_of": "2025",
     "source": "slide", "ev": ["e102"]}
  ],
  "tables": [{"id": "t1", "title": "…", "columns": ["…"], "rows": [["…"]], "ev": ["e102"]}],
  "code": [{"id": "cd1", "lang": "python", "text": "…", "ocr_confidence": "medium", "ev": ["e140"]}],
  "glossary": [{"term_he": "…", "term_orig": "…", "definition": "…", "ev": ["e105"]}],
  "examples": [{"id": "x2", "kind": "case_study", "text": "…", "illustrates": ["p1"], "ev": ["e150"]}],
  "quotes": [{"id": "q1", "speaker": "S1", "orig": "…", "he": "…", "why": "…", "ev": ["e101"]}],
  "deep": {
    "big_picture": {"text": "…", "ev": ["e40", "e300"]},
    "mental_models": [{"id": "mm1", "name": "…", "explanation": "…", "basis": "analyst_inference", "ev": ["e120"]}],
    "causal_chains": [{"id": "cc1", "steps": ["…", "…", "…"], "basis": "speaker", "ev": ["e121"]}],
    "assumptions": [{"id": "as1", "text": "…", "explicit": false, "if_wrong": "…", "basis": "analyst_inference", "ev": ["e110"]}],
    "implications": [{"id": "im1", "text": "…", "for": "business", "basis": "analyst_inference", "confidence": "medium", "ev": []}],
    "tensions": [{"id": "tn1", "text": "…", "ev": ["e200", "e510"]}],
    "limitations": [{"id": "lm1", "text": "…", "basis": "analyst_inference", "ev": []}],
    "novelty": [{"id": "nv1", "text": "…", "verdict": "conventional", "basis": "external_knowledge"}]
  },
  "connections": [{"from": "p1", "to": "f1", "relation": "is_applied_in", "ev": []}],
  "concept_map": {
    "focus_question": "…",
    "nodes": [{"id": "m1", "label": "…"}, {"id": "m2", "label": "…"}],
    "edges": [{"from": "m1", "to": "m2", "label": "…", "cross_link": false}]
  },
  "actions": [{"id": "r1", "text": "…", "who": "business", "effort": "low", "basis": "speaker", "ev": ["e600"]}],
  "open_questions": [{"text": "…", "kind": "unanswered_in_video", "ev": []}],
  "references": [{"kind": "book", "title": "…", "author": "…", "ev": ["e700"]}],
  "qa_session": [{"q": "…", "asker": "audience", "answer": "…", "ev": ["e800", "e801"]}],
  "pitch": {"present": true, "segment": "g9", "offer": "…", "price_said": "…", "claims_to_verify": ["…"], "ev": ["e900"]},
  "study": {
    "prerequisites": ["…"],
    "self_test": [{"q": "…", "a": "…", "bloom": "apply", "ev": ["e110"]}],
    "flashcards": [{"front": "…", "back": "…", "ev": ["e105"]}]
  },
  "quality": {
    "coverage": {"slides": [42, 42], "numbers": [29, 31], "entities": [55, 57],
                 "dropped": [{"id": "d7", "reason": "duplicate"}]},
    "verification": {"claims": 120, "removed_unsupported": 2, "quotes_exact": [18, 18]},
    "qa_recall": {"all": 0.93, "screen_only": 0.88, "questions": 40},
    "judge": "other-family model + 10% human sample",
    "warnings": ["…"]
  }
}
```

רשימות סגורות (`enum`):
- `segments.type`: `content | intro | qa | pitch | sponsor | self_promo | interaction_reminder | preview_recap | filler | logistics | demo | exercise`
- `source`: `speech | screen_only | both`
- `basis`: `speaker | analyst_inference | external_knowledge`
- `genre`: `academic_lecture | course_module | business_webinar | conference_talk | panel | interview_podcast | software_tutorial | product_demo | workshop | investor_presentation | other`
- `bloom`: `remember | understand | apply | analyze | evaluate | create`

בדיקות בקוד, ולא בסכמה:
- כל `ev` קיים ב־`evidence`.
- כל `quotes.orig` הוא תת־מחרוזת של היחידה שלו.
- כל `data.value` מופיע במלאי המספרים.
- כל שקופית מכוסה ב־`used_in` או מופיעה ב־`dropped`.

#### הפייפליין (שלבים, קלט ופלט, מודל)
| # | שלב | קלט ← פלט | מודל | למה (ראיה) |
|---|---|---|---|---|
| 0 | עיבוד מקדים (קיים בשרת) | וידאו ← יחידות ראיה: משפטים עם `t0/t1` ודובר; OCR לכל שקופית עם חלון זמן; בלוקי קוד | CPU | — |
| 1 | מלאים ויישור | יחידות ← מלאי שקופיות, מספרים, ישויות, מונחים והפניות; התאמת OCR לתמליל ← מועמדי `screen_only`; מאקרו־סמנים | קוד (Haiku 5.5 לזיהוי ישויות בלבד) | Video-MME, LPM, Chaudron & Richards |
| 2 | ז'אנר, תיוג קטעים ופרקים | תקציר תמליל + כותרות שקופיות ← `genre`, `segments`, `chapters` עם `boundary_cue` | Haiku 5.5 (Sonnet 5.5 בביטחון נמוך) | Chapter-Llama, SponsorBlock, routing |
| 3 | Map: חילוץ לכל פרק | יחידות הפרק + שלד גלובלי + מילון (במטמון) ← הערות, נתונים, ציטוטים, טענות Toulmin, מונחים, דוגמאות, הפניות, `adds_to_whole` וביטחון | Haiku 5.5; Sonnet 5.5 להרצאות טכניות צפופות | SumCoT, CoA, LLM×MapReduce, "lost in the middle" |
| 4 | ביקורת כיסוי | מלאים + JSON לכל פרק ← רשימת חסרים ← תיקון נקודתי | קוד + Haiku 5.5 | Kiewra, FABLES, DIAL-SUMMER |
| 5 | Reduce: מיזוג | JSON של כל הפרקים ← איחוד כפילויות, יישוב סתירות לפי ביטחון, מילון אחיד, קשרים בין פרקים, משקלות (KPA) | Sonnet 5.5 | BooookScore, LLM×MapReduce, KPA |
| 6 | סינתזה | הערות ממוזגות (עם מזהים) ← `briefing`, `thesis`, `arguments`, `principles`, `frameworks`, `deep`, `concept_map`, `actions`, `open_questions` | Opus 5.5 (effort גבוה) | FABLES, SummHay, step-back, STORM, blueprint, VISTA |
| 7 | ביקורת ותיקון (סבב אחד או שניים) | טיוטה + רובריקה (Paul-Elder, ספציפיות, כיסוי, ייחוס) ← רשימת הערות ← גרסה מתוקנת | שופט: Gemini או Sonnet 5.5; מתקן: Opus 5.5 | Self-Refine, evaluator-optimizer, הטיות שופט |
| 8 | אימות | טענות אטומיות + יחידות ← פסיקה לכל טענה; מחיקה או סימון מחדש כהיסק; ציטוטים ומספרים — בקוד | Haiku 5.5 או Sonnet 5.5, או Citations API עם יחידות כבלוקים | FActScore, MiniCheck, CoVe, Anthropic ("retract") |
| 9 | עברית ועדשות | JSON מאומת + מילון + עדשה ← תצוגה בעברית: גוף הניתוח, ותקציר עליון | Sonnet 5.5 לגוף; Opus 5.5 לשכבה העליונה; Haiku 5.5 לשאלות תרגול וכרטיסיות | מדריך Microsoft, Hebrew LLM leaderboard, לשון פשוטה |
| 10 | מדידה (מדגם או סט זהב) | וידאו + ניתוח ← שאלות (Gemini רואה את הווידאו) ← תשובות מהניתוח בלבד (Haiku 5.5) ← ריקול כללי ו"רק על המסך"; Pyramid מול שלד אנושי | Gemini + Haiku 5.5 + בני אדם | APES, QuestEval, QAGS, Pyramid |

- **מטמון:**
  - ההוראות, הסכמה, השלד הגלובלי והמילון קבועים בכל קריאות ה־map, ונשמרים במטמון.
  - ב־Opus 5.5 וב־Sonnet 5.5 קריאה מהמטמון עולה פי 0.05 ממחיר הקלט.
- **מחיר Haiku:** לשמור כל קריאת Haiku מתחת ל־100K טוקנים, כולל החלק שבמטמון — אחרת המחיר קופץ פי 5. גם "lost in the middle" מצדיק קריאות קצרות.
- **Batch:** ניתוח שהמשתמש לא מחכה לו (למשל ניתוח לילי של קורס שלם) נשלח ב־Batch, בחצי מחיר.
- **הערכת עלות לשעת הרצאה באנגלית** (היסק, לא נמדד):
  - **הנחות:**
    - כ־150 מילים לדקה, כלומר כ־9,000 מילים, שהן כ־12–15K טוקנים.
    - OCR: כ־5–10K טוקנים.
    - כ־8 פרקים.
  - **פירוק לפי שלבים (בערך):**

    | שלבים | מודל | עלות |
    |---|---|---|
    | 2–4 | Haiku | כ־$0.03 |
    | 5 | Sonnet | כ־$0.15 |
    | 6–7 | Opus + שופט | כ־$1–1.5, תלוי בכמות החשיבה |
    | 8 | Haiku | כ־$0.02 |
    | 9 | Sonnet + Opus | כ־$0.4 |

  - **סך הכול:** סדר גודל של **$1.5–2.5 לשעת וידאו** במחיר רגיל, וכחצי מזה ב־Batch.
  - **אי־ודאות:** פלט בעברית צפוי לצרוך יותר טוקנים (פירוק לטוקנים פחות יעיל). צריך למדוד עם `count_tokens` על 3 סרטונים לפני כל החלטת מחיר.
- **סדר בנייה מומלץ:**
  1. **MVP:** שלבים 0–3, 5, 6, 8 ו־9 בעדשה אחת. הספרות מצביעה על אלה כליבה: חילוץ לכל קטע, סינתזה במודל חזק ואימות.
  2. **אחר כך:** ביקורת כיסוי (4) ומדידה (10) על סט זהב קטן.
  3. **לבסוף:** ביקורת ותיקון (7), עדשות נוספות ומצב "סדרה/קורס" עם מילון ומפת מושגים מצטברים.

### Gaps
- מחירי Gemini והמודל המתאים ממנו לא נחקרו (מכסת החיפוש נגמרה). צריך לבדוק לפני החלטה.
- העלויות למעלה הן הערכה בלבד. מספרי הטוקנים בעברית לא נמדדו.
- אין עדיין הערכה (eval) שמראה אם Haiku 5.5 מספיק לחילוץ מהרצאות טכניות צפופות, ואם Opus 5.5 עדיף על Sonnet 5.5 בסינתזה.
- לא נבדקו מגבלות גודל הסכמה של Gemini בפועל.
- הספים בסעיף 5 טעונים כיול על סט הזהב.
