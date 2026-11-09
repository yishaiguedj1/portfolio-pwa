# מאגר הלמידה של "ניתוח וידאו": אותות משוב, עקבות צנרת, לולאת שיפור, כלים ופרטיות (מחקר, 9/11/2026)

> **הקשר:** לשונית "ניתוח וידאו" בסטודיו של THE SNOWBALL מפיקה ניתוח עומק של הרצאה, וובינר או קורס. המתודולוגיה מתוארת ב־`09-analysis-methodology.md`.
>
> לתרגום כבר פועל מאגר למידה (`docs/studio-learning.md`, שורות 6–12, 15/10–26/10/2026):
> - **קורפוס טקסט מוצפן.**
>   - ההצפנה: `vault` עם ‏AAD `learn|<lid>`, בדלי נפרד `snb-learn`.
>   - רשימת שדות מותרת זהה בשני הצדדים: `learn_corpus` בעובד ו־`normCorpus` בשרתון, עם אותו `LC_V`.
>   - דוברים נשמרים כ־S1/S2, בלי קובץ, סרטון, תיקייה או uid.
>   - `scrub` מחליף מיילים, קישורים, טלפונים ומספרים של 9 ספרות.
> - **מדיה:** Opus 32kbps ו־240p, מוצפנים בזמן הקידוד. מפתח לכל קובץ, עטוף בכספת (`m/<חודש>/<lid>.<a|v>.key`).
> - **אותות אחרי העבודה:**
>   - `learnUx`, שבו `UX_SHAPE` זהה בטלפון ובשרתון: כיסוי צפייה, הורדה, שיתוף, הצעות שהתקבלו או נדחו;
>   - מרחקי עריכה (`editDiff`);
>   - ביטחון התמלול ו־`audio_stats`;
>   - קודי בודק לכל שלב (`Pipeline.check`) ותשובות שנזרקו עם סיבה (`rej_record`).
> - **הסכמות:** `lrt` לטקסט, `lrm` למדיה, `lc` לכל עבודה. המחיקה: אחרי 24 חודשים, או מיד דרך "מחק את התרומות שלי".
> - **שער השיפור:**
>   - זוגות עיוורים בשני הסדרים;
>   - גבול Wilson תחתון מעל 0.5;
>   - בלי נסיגה בקטגוריה;
>   - עלות עד ‎+10%‎ וזמן עד ‎+5%‎;
>   - חלונות השפעה של 28 יום.
>
> לפי `00-internal-infrastructure.md` (C8), ניתוח חדש לא נאסף בלי החלטה. הקובץ הזה בוחן איך לבנות את המאגר המקביל לניתוח: אילו אותות לאסוף, מה לרשום בכל ריצה, איך הופכים את זה לשיפור מדיד, אילו כלים קיימים ואילו כללי פרטיות חלים.
>
> **שיטה:** חיפושים ושליפות ממקורות ראשוניים, ברוב המקרים טקסט מלא:
> - מאמרים: SIGIR, ‏WSDM, ‏CIKM, ‏L@S, ‏ACL, ‏NAACL, ‏EMNLP, ‏ICLR, ‏NeurIPS ו־arXiv. חלק מה־PDF חולצו עם pdftotext.
> - מפרט OTel GenAI ו־OpenInference, מתוך המאגרים עצמם.
> - קובצי LICENSE של כל הכלים, שנשלפו ב־9/11/2026, ותיעוד האירוח העצמי שלהם.
> - מסמכי EDPB ו־NIST, ומסמכי רשות הגנת הפרטיות דרך סיכומי משרדי עורכי דין.
> - פוסטים הנדסיים של Anthropic, ‏Microsoft, ‏Cursor ואחרים.
>
> מקורות שהיו חסומים בסשן:
> - openai.com (שגיאת 403): הציטוטים נלקחו דרך Simon Willison.
> - דף ההסכמה של ICO: אתגר Cloudflare.
> - PNAS ו־Royal Society: נלקחו דרך SSRN ו־arXiv.
> - ה־API של GitHub: הקבצים נשלפו דרך raw.
> - מאגר Lunary: לא נמצא.
>
> **סימונים:**
> - **(משני)**: סיכום או מקור משני.
> - **(לא אומת ישירות)**: פרט מתקציר חיפוש שלא נקרא במקור.
> - **(ותיק, שנה)**: מחקר יסוד ישן. הממצא עדיין מצוטט, אבל נמדד על חיפוש ברשת ולא על סיכומי LLM.
> - **(דיווח עצמי)**: נתון שחברה מפרסמת על המוצר שלה.
> - **(סתירה)**: המקורות חלוקים.

## 1. אותות משוב, מפורשים ומשתמעים: מה מנבא איכות ואיפה המלכודות

### Takeaway
- **אותות משתמעים** הם קליק, זמן שהייה, חזרה אחורה בסרטון והעתקה. הם נושאים מידע אמיתי, אבל מוטים בכמה דרכים:
  - הטיית אמון ומיקום;
  - הטיית הצגה;
  - תלות חזקה במשימה, במשתמש, באורך ובקריאוּת.
  
  הם אמינים בעיקר כ**השוואה יחסית** (גרסה מול גרסה, באותו מיקום), ואחרי כיול מול סקר קטן ואקראי.
- **משוב מפורש** נדיר ומוטה:
  - הוא נוטה לבעיות חמורות ולקצוות (התפלגות J, ‏MNAR).
  - הוא סובל מהטיית שורדים (survivorship): מי שנטש אחרי ניתוח גרוע לא משאיר אות, ובעיות שאיש לא דיווח עליהן לא מתגלות.
  - אופטימיזציה ישירה על אגודלים גרמה לחנפנות (sycophancy) במוצר צ'אט מרכזי באפריל 2025.
- **האותות המבטיחים לניתוח הרצאה:**
  - "שגוי" או "חסר" עם זמן וקוד סיבה;
  - "בדק ודחה": לחיצה על שבב זמן ואחריה "שגוי";
  - העתקה או ייצוא;
  - הרצה מחדש במודל אחר.
  
  בסרטון עצמו, שיאי צפייה חוזרת מסמנים נקודות של עניין או בלבול, ו־61% מהשיאים צמודים למעבר חזותי.

### Cited Findings

**קליקים, מיקום והצגה (מחקר יסוד מתחום החיפוש)**
- Joachims et al. ‏(SIGIR 2005, **ותיק, 2005**) בדקו עם מעקב עיניים, ומצאו שקליקים "informative but biased".
  - יש הטיית אמון (trust bias): המשתמשים לוחצים על התוצאה העליונה גם כשהיא פחות טובה.
  - יש גם הטיה של איכות ההקשר: ההחלטה תלויה בשאר התוצאות.
  - העדפות יחסיות שנגזרות מקליקים ("Click > Skip Above") מדויקות למדי.
  
  [SIGIR 2005](https://www.sigir.org/wp-content/uploads/2017/06/p003.pdf).
- **התיקון המקובל להטיית מיקום** הוא שקלול בהופכי של הסתברות החשיפה (IPS):
  - Joachims, Swaminathan ו־Schnabel ‏(WSDM 2017) ל־learning-to-rank — [arXiv 1608.04468](https://arxiv.org/abs/1608.04468);
  - Schnabel et al. ‏(ICML 2016) לדירוגים שחסרים שלא באקראי (MNAR) — [arXiv 1602.05352](https://arxiv.org/abs/1602.05352).
- **הטיית הצגה:** כותרת או תקציר אטרקטיביים מושכים קליקים בלי קשר לרלוונטיות. Yue, Patel ו־Roehrig ‏(WWW 2010, **ותיק, 2010**) — [WWW 2010](https://ir.webis.de/anthology/2010.wwwconf_conference-2010.102).
- **Interleaving:** שוזרים שתי גרסאות ברשימה אחת ומשווים קליקים. השיטה תוארה אצל Chapelle et al. ‏(TOIS 2012) — [Microsoft Research](https://www.microsoft.com/en-us/research/?p=162219). הטענה שהיא רגישה פי 10–100 ממבחן A/B מצוטטת במאמר של Amazon Search — [Amazon Science](https://cdn.amazon.science/a9/c8/c9016a1c47caac6a634768e7491d/debiased-balanced-interleaving-at-amazon-search.pdf) **(משני)**.

**זמן שהייה, גלילה ונטישה**
- Kelly ו־Belkin ‏(SIGIR 2004, **ותיק, 2004**): "no general, direct relationship between display time and usefulness". זמן התצוגה משתנה לפי המשימה ולפי המשתמש — [dblp](https://dblp.org/rec/conf/sigir/KellyB04.html).
- White ו־Kelly ‏(CIKM 2006, **ותיק, 2006**): סף זמן לפי **משימה** משפר את ניבוי השימושיות, וסף לפי **משתמש** פוגע בו — [CIKM 2006](https://microsoft.com/en-us/research/wp-content/uploads/2017/01/WhiteCIKM2006.pdf).
- Fox et al. ‏(TOIS 2005, **ותיק, 2005**): שילוב של clickthrough, זמן ואופן היציאה מהדף ניבא שביעות רצון — [Microsoft Research](https://www.microsoft.com/en-us/research/publication/evaluating-implicit-measures-improve-web-search/).
- Kim, Hassan, White ו־Zitouni ‏(WSDM 2014):
  - זמן השהייה שנדרש כדי לקבוע שביעות רצון תלוי בנושא, באורך ובקריאוּת של המסמך.
  - סף קבוע של 30 שניות, שהוא הנוהג הנפוץ, לא מתאים לכל המקרים.
  
  [WSDM 2014](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/02/KimWSDM2014.pdf).
- Lagun et al. ‏(SIGIR 2014), חיפוש בטלפון — [Google Research](https://research.google/pubs/towards-better-measurement-of-attention-and-satisfaction-in-mobile-search/):
  - הזמן שבו רכיב נמצא בתוך המסך (viewport time) מתואם עם מבט העיניים.
  - הקשב מרוכז בחצי העליון של המסך.
  - גלילה אל מעבר לתשובה, וזמן רב מתחתיה, מסמנים חוסר שביעות רצון.
- **"Good abandonment"**: נטישה בלי קליק, כי התשובה כבר נראתה בדף. התופעה שכיחה יותר בטלפון. Li et al. ‏(SIGIR 2009, **ותיק, 2009**) — [Google Research](https://research.google/pubs/good-abandonment-in-mobile-and-pc-internet-search/).
- **ניסוח מחדש של שאילתה** (reformulation) מנבא שביעות רצון טוב יותר מקליקים. Hassan et al. ‏(CIKM 2013) — [CIKM 2013](https://microsoft.com/en-us/research/wp-content/uploads/2016/02/Hassan_CIKM13a.pdf).
- NN/g ‏(15/4/2018, **ותיק, 2018**), מעקב עיניים, 120 משתתפים — [NN/g](https://www.nngroup.com/articles/scrolling-and-attention/):
  - 57% מזמן הצפייה מעל קו הקיפול (80% במדידה של 2010);
  - 74% בשני המסכים הראשונים;
  - 81% בשלושת המסכים הראשונים.

**וידאו של הרצאות**
- Kim et al. ‏(L@S 2014, **ותיק, 2014**) ניתחו נתוני אינטראקציה שנייה־שנייה מ־862 סרטונים בארבעה קורסי edX — [L@S 2014](https://www.eecs.harvard.edu/~kgajos/papers/2014/kim14video.pdf):
  - **נטישה:**
    - בממוצע כ־55.2% מסשני הצפייה ננטשו לפני הסוף (סטיית תקן 14.7).
    - 36.6% מהנטישות קרו ב־3% הראשונים של הסרטון.
    - הנטישה גבוהה יותר בסרטונים ארוכים, בצפייה חוזרת ובמדריכים (tutorials).
  - **שיאים:** "Peaks in rewatching sessions and play events indicate points of interest and confusion".
  - **סוגי השיאים** (שם, ‏80 סרטונים מתויגים). 61% מהשיאים צמודים למעבר חזותי:

    | סוג | חלק מהשיאים | פירוש |
    |---|---|---|
    | חזרה לתחילת נושא חדש | 25% | מושג, דוגמה או משפט חדש |
    | חזרה לתוכן שנעלם מהר מהמסך | 23% | שקופית, קוד או לוח; החוקרים מפרשים זאת כבעיית קצב |
    | מעקב אחרי צעד במדריך | 7% | |
    | מעבר חזותי לפני השיא ואחריו | 6% | |
    | חזרה על הסבר מילולי בלי מעבר חזותי | 39% | מושג חשוב, הדגשה או בדיחה |
- YouTube ‏(15/9/2021, פוסט של Cristos Goodrow) — [YouTube Blog](https://blog.youtube/inside-youtube/on-youtubes-recommendation-system/):
  - "valued watchtime" נמדד בסקרים של 1–5 כוכבים, ונספר רק זמן צפייה שקיבל 4 או 5.
  - מודל ML מנבא את תשובת הסקר לכל המשתמשים, ונבדק מול תשובות שהוחזקו בצד.

**משוב מפורש: נדיר, מוטה, וחסר שלא באקראי**
- **התפלגות J:** הרבה 5, מעט 1 וכמעט כלום באמצע. Hu, Pavlou ו־Zhang ‏(CACM 2009, **ותיק, 2009**) — [CACM](https://cacm.acm.org/magazines/2009/10/42353-overcoming-the-j-shaped-distribution-of-product-reviews):
  - ההתפלגות נובעת משתי הטיות:
    - הטיית רכישה: מדרגים רק מי שבחר במוצר מלכתחילה.
    - הטיית דיווח־חסר: בעיקר המרוצים מאוד והכועסים טורחים לכתוב.
  - כשמחייבים את כולם לדרג, ההתפלגות קרובה לנורמלית.
- Marlin ו־Zemel הראו שדירוגים חסרים שלא באקראי (MNAR), בסקר של Yahoo! עם יותר מ־35 אלף משתמשים — [arXiv 1206.5267](https://arxiv.org/pdf/1206.5267.pdf) **(לא אומת ישירות)**.
- Don-Yehiya, Choshen ו־Abend ‏(2024): עד 30% משיחות הצ'אט מכילות משוב מפורש בשפה טבעית, ונכרו יותר ממיליון שיחות — [arXiv 2407.10944](https://arxiv.org/abs/2407.10944).
- כריית שביעות רצון מתוך שיחות:
  - WildFeedback ‏(ACL 2026) — [arXiv 2408.15549](https://arxiv.org/abs/2408.15549);
  - SPUR ‏(2024) — [arXiv 2403.12388](https://arxiv.org/abs/2403.12388).
- Anthropic ‏(9/1/2026): משוב המשתמשים "sparse and skews toward severe issues" — [Anthropic Engineering](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents).
- Hamel Husain ו־Shreya Shankar (שאלות נפוצות, עדכון 21/9/2026): דגימת עקבות רק לפי משוב מחמיצה בעיות שאיש לא דיווח עליהן — [hamel.dev](https://hamel.dev/blog/posts/evals-faq/).

**כשהאות הופך ליעד (חוק Goodhart)**
- OpenAI ‏(2/5/2025), ניתוח אירוע החנפנות של GPT-4o אחרי עדכון של סוף אפריל 2025. הציטוטים דרך [Simon Willison](https://simonwillison.net/2025/May/2/what-we-missed-with-sycophancy/), כי המקור חסום בסשן:
  - העדכון הוסיף "additional reward signal based on user feedback—thumbs-up and thumbs-down data from ChatGPT".
  - "This signal is often useful; a thumbs-down usually means something went wrong".
  - אבל השילוב "weakened the influence of our primary reward signal, which had been holding sycophancy in check".
  - "User feedback in particular can sometimes favor more agreeable responses".
  - הלקח: "treat model behavior issues as launch-blocking".
- Pang et al. ‏(EACL 2024): אימון על נתוני פריסה, עם אורך השיחה כאות־מחליף (proxy), הגדיל תשובות שנויות במחלוקת או לא ידידותיות. אות־מחליף של סנטימנט או של תגובת המשתמש צמצם את התופעה — [ACL Anthology](https://aclanthology.org/2024.eacl-short.8).
- Stiennon et al. ‏(NeurIPS 2020) — [arXiv 2009.01325](https://arxiv.org/abs/2009.01325):
  - "Optimizing against the reward model initially improves summaries, but eventually overfits".
  - בסוף "the reward model becomes anti-correlated with human preferences".
  - ‏ROUGE מסכים עם המתייגים בכ־57% בלבד.
- Gao, Schulman ו־Hilton ‏(2022): חוקי קנה מידה לאופטימיזציית־יתר מול reward model — [arXiv 2210.10760](https://arxiv.org/abs/2210.10760).

**אותות התנהגות במוצרי LLM**
- Microsoft ExP ‏(27/9/2023): מסגרת מדדים למוצרי LLM — [Microsoft Research](https://www.microsoft.com/en-us/research/group/experimentation-platform-exp/articles/how-to-evaluate-llms-a-complete-metric-framework/):
  - **תפעול:** שגיאות 429, טוקנים, קטיעה (truncation), ‏content_filter, זמן עד הטוקן הראשון, בקשות לשנייה.
  - **משפך:** נראה ← התקבל ← נשמר (seen, accepted, retained), ומרחק העריכה עד הטקסט שנשמר.
  - **משוב:** ספירת אגודלים.
  - **שימור משתמשים.**
- Ziegler et al. ‏(MAPS 2022), השלמת קוד: **שיעור הקבלה** מנבא פרודוקטיביות נתפסת טוב יותר ממדדים של התמדת הקוד (persistence) — [arXiv 2205.06537](https://arxiv.org/abs/2205.06537).
- Cursor ‏(12/9/2025, **דיווח עצמי**): RL מקוון על השלמות Tab — [Cursor](https://cursor.com/blog/tab-rl).
  - דוגמת התגמול: ‎+0.75 לקבלה, ‎−0.25 לדחייה, ו־0 כשלא מוצגת הצעה.
  - כמה מחזורים ביום, כ־1.5–2 שעות למחזור.
  - התוצאה: 21% פחות הצעות, ושיעור קבלה גבוה ב־28%.
- Eugene Yan ‏(אוגוסט 2023) — [eugeneyan.com](https://eugeneyan.com/writing/llm-patterns/):
  - **Midjourney:** יצירה מחדש היא אות שלילי, וריאציה היא אות חיובי, והגדלה או הורדה הן אות חיובי חזק.
  - **GitHub Copilot:** קבלה היא אות חיובי חזק, קבלה עם עריכה חיובית, והתעלמות ניטרלית או שלילית.
  - אורך שיחה הוא אות דו־משמעי.
- Ding et al. ‏(AAAI 2025): ציטוטים מעלים אמון גם כשהם אקראיים, והאמון יורד כשהמשתמשים בודקים אותם — [arXiv 2501.01303](https://arxiv.org/abs/2501.01303).
- Pew ‏(22/7/2025): כשמוצג סיכום AI בתוצאות החיפוש — [Pew Research](https://www.pewresearch.org/short-reads/2025/07/22/google-users-are-less-likely-to-click-on-links-when-an-ai-summary-appears-in-the-results/):
  - 8% לוחצים על תוצאה רגילה, לעומת 15% בלי סיכום;
  - רק 1% לוחצים על קישור בתוך הסיכום;
  - הסשן מסתיים ב־26% מהמקרים, לעומת 16% בלי סיכום.
- Liu, Zhang ו־Liang ‏(2023), מנועי חיפוש גנרטיביים: רק 51.5% מהמשפטים נתמכים במלואם בציטוטים, ו־74.5% מהציטוטים תומכים במשפט שלהם — [arXiv 2304.09848](https://arxiv.org/abs/2304.09848).
- ALCE ‏(2023): ב־ELI5, כמחצית מהיצירות חסרות תמיכה מלאה בציטוטים — [arXiv 2305.14627](https://arxiv.org/abs/2305.14627).

**אותות למידה: כרטיסיות, בחנים ושאלות בלי מענה**
- Anki (נבדק 9/11/2026) מסמן כרטיס כ־"leech" אחרי 8 שכחות, כברירת מחדל. ההמלצה: "The most efficient method to deal with leeches is to change how the information is presented" — [Anki Manual](https://docs.ankiweb.net/leeches.html).
- FSRS ממדל לכל כרטיס קושי, יציבות וסבירות שליפה (difficulty, stability, retrievability). הרישיון MIT — [fsrs4anki](https://github.com/open-spaced-repetition/fsrs4anki) **(משני)**.
- **ניתוח פריטים:** מקדם point-biserial שלילי מעיד על פריט עמום או על מפתח תשובות שגוי — [Penn State, Schreyer Institute](https://www.schreyerinstitute.psu.edu/scanning/UnderstandingExamAnalysisReport); [University of Washington](https://www.washington.edu/assessment/scanning-scoring/scoring/item-analysis/).
- **שאלות רב־ברירה שנוצרו ב־AI** — [PMC11806894](https://pmc.ncbi.nlm.nih.gov/articles/PMC11806894/) **(לא אומת ישירות)**:
  - הן יצאו קלות יותר: מדד קושי 0.78 לעומת 0.69;
  - כושר ההבחנה שלהן דומה;
  - רובן ברמות חשיבה נמוכות.
- Duolingo Birdbrain מעריך יחד את יכולת הלומד ואת קושי התרגיל — [Duolingo Blog](https://blog.duolingo.com/learning-how-to-help-you-learn-introducing-birdbrain) (תאריך הפוסט לא נבדק).
- Bastani et al. ‏(PNAS 2025), ניסוי שדה בבית ספר תיכון:
  - גישה ל־GPT בסיסי שיפרה את התרגול.
  - אחרי שהגישה הוסרה, הציונים ירדו ב־17%.
  - מורה פרטי מוגבל (guardrails) מנע את רוב הנזק.
  
  [SSRN](https://papers.ssrn.com/abstract=4895486); [Knowledge at Wharton](https://knowledge.wharton.upenn.edu/article/without-guardrails-generative-ai-can-harm-education/).
- **זיהוי שאלה שאין לה תשובה במקור** עדיין בעיה פתוחה — [arXiv 2401.11452](https://arxiv.org/pdf/2401.11452). יש דוגמה מעשית לשימוש בשאלות בלי מענה כ"ביקורת ידע" שמגלה פערי תיעוד — [ClickHelp](https://clickhelp.com/clickhelp-technical-writing-blog/how-an-ai-bot-became-a-knowledge-audit-tool-rather-than-an-answer-engine/) **(משני)**.

### Inferences
- **סדר עדיפויות לאותות של הניתוח, מהחזק לחלש:**
  1. **"שגוי" או "חסר"** על טענה או פרק, עם זמן וקוד סיבה. הדיוק גבוה והכיסוי נמוך. מתאים לטריאז' ולבניית מקרי רגרסיה, לא כמדד איכות כללי.
  2. **"בדק ודחה":** לחיצה על שבב זמן, צפייה בקטע, ואז "שגוי" בתוך דקות. זה התרגום שלנו לממצא של Ding et al.: מי שבודק את הציטוט מגלה אם הוא נכון.
  3. **העתקה, ייצוא ושיתוף** של פרק. אות חיובי חזק, לפי הממצאים על קבלה, הורדה ושמירה (Eugene Yan, ‏Microsoft ExP).
  4. **הרצה מחדש במודל אחר.** אות שלילי לפלט הראשון. אם המשתמש בוחר בסוף בין שתי הגרסאות, מתקבל זוג מוכן; הוא לא עיוור, כי המשתמש יודע איזה מודל הפיק כל גרסה.
  5. **לחיצה על שבב זמן וצפייה של N שניות ומעלה.** אות של עניין או אימות, לא של איכות.
  6. **זמן שהייה בפרק.** רק מנורמל לאורך הפרק ולמיקומו, ורק כהשוואה בין גרסאות באותו מיקום (Kelly ו־Belkin, ‏Kim et al. 2014 ב־WSDM).
  7. **שגיאות בבוחן ודירוגי כרטיסיות.** רק דרך ניתוח פריטים, כדי להפריד בין פריט פגום לבין תוכן קשה.
  8. **שאלות בצ'אט שלא נענו.** אשכולות של פערי כיסוי.
- **הטיית מיקום אצלנו:**
  - הניתוח מסודר לפי זמן ההרצאה, ולכן אי אפשר לערבב את סדר הפרקים כדי לבטל את ההטיה.
  - ההשוואה צריכה להיות בין גרסאות של הצנרת באותו פרק ובאותו מיקום (A/B לפי גרסה), עם נרמול לזמן החשיפה בתוך המסך.
  - ההטיה צפויה להיות חזקה: 57% מזמן הצפייה מעל הקיפול (NN/g).
- **הטיית שורדים:**
  - אצלנו נרשמים בעיקר מי שנשארו וחזרו. מי שנטש ניתוח גרוע לא משאיר אות, וגם עבודה שנכשלה לא מגיעה לרשומות האינטראקציה.
  - לכן צריך לרשום גם נטישה: פתח את הניתוח ולא גלל מעבר לפרק הראשון.
  - צריך לרשום גם כישלון עבודה, כרשומת עבודה עם `error.type`.
- **אסור לאמן מודל או לבחור פרומפט ישירות לפי אגודלים.**
  - מקרה החנפנות ו־Stiennon מראים מה קורה כשעושים זאת.
  - האגודלים משמשים לטריאז', לדגימת עקבות לניתוח שגיאות, וכמדד שמירה (guardrail) בלבד.
  - השער המרכזי נשאר סט זהב וזוגות עיוורים.
- **תיקון MNAR:**
  - מיקרו־סקר אקראי ונדיר, למשל אחד מכל 20 ניתוחים, עם שאלה אחת: "האם יכולת לוותר על הצפייה?" (1–5).
  - זה העיקרון שמאחורי "valued watchtime": סקר אקראי משמש עוגן, ולפיו מכיילים את האותות המשתמעים.
- **בסיס משתמשים קטן:** האותות המשתמעים יהיו דלילים. רוב האות יגיע מרישום מפורט לכל עבודה ומהערכה לא מקוונת (offline), לא מסטטיסטיקה של התנהגות.
- **שיאי הצפייה של Kim et al. 2014**, אם המשתמש צופה בסרטון דרכנו:
  - חזרה לתוכן שנעלם מהמסך (23%) מרמזת שבנקודה הזו הניתוח צריך להציג את השקופית או הקוד במלואם.
  - ריכוז של חזרות על הסבר מילולי (39%) מרמז על מושג חשוב שחייב להופיע בניתוח.

### Gaps
- **אין אימות לסיכומי LLM:** לא נמצא מחקר שמאמת אותות משתמעים (זמן שהייה, העתקה, קליק על ציטוט) מול איכות של **סיכומי LLM להרצאות**. כל המחקר על זמן שהייה הוא מתחום החיפוש ברשת, משנים 2004–2014.
- **שיעור הלחיצה על אגודלים** במוצרי AI: נמצאו רק טענות של ספקים ובלוגים, בלי מקור ראשוני. הטווח שנטען: מתחת ל־1% ועד כ־10%, ובמקור אחר 1–3%.
- **קודי הסיבה לאגודל למטה** שמוצרים אחרים מציגים לא אומתו.
- **פוסטים הנדסיים:** לא נמצא פוסט ציבורי של מוצר ייעודי לסיכום פגישות או הרצאות שמתאר את לולאת המשוב שלו.

## 2. עקבות הצנרת (traces): מה לשמור בכל שלב, ומה התקן אומר

### Takeaway
- **מוסכמות OTel ל־GenAI** (מאגר נפרד, סטטוס Development, נכון ל־9/11/2026) נותנות אוצר מילים מוכן:
  - **span לכל קריאה:**
    - ספק, מודל ופעולה;
    - טוקנים, כולל קריאה וכתיבה ל־cache וטוקני חשיבה;
    - שם הפרומפט והגרסה שלו;
    - רמת המאמץ (effort);
    - זמן עד החלק הראשון.
  - **אירוע הערכה:** `gen_ai.evaluation.result`.
  - **מדדי זמנים.**
- **תוכן:** התקן קובע שפרומפטים ופלטים **לא נלכדים כברירת מחדל**. בייצור הוא ממליץ לשמור את התוכן מחוץ למערכת העקבות ולשים על ה־span רק הפניה (`*_ref`), כדי לאפשר הרשאות גישה נפרדות. זה בדיוק המבנה שלנו: מטא־דאטה במסד, תוכן מוצפן ב־R2.
- **אפשר לאמץ את שמות השדות בלי לאמץ כלי.**

### Cited Findings
- **המאגר:** המוסכמות עברו למאגר נפרד, `semantic-conventions-genai`, ומפנות לגרסה v1.45.0 של המוסכמות הכלליות. הסטטוס: "Development" — [GitHub](https://github.com/open-telemetry/semantic-conventions-genai).
- **לכידת תוכן** — [gen-ai-spans.md](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-spans.md):
  - "OpenTelemetry instrumentations SHOULD NOT capture them by default, but SHOULD provide an option for users to opt in".
  - שלוש תבניות:
    1. ברירת המחדל: לא רושמים את התוכן.
    2. רושמים אותו על ה־span. מתאים "in pre-production environments".
    3. "Store content externally and record references on the spans", כי "This pattern is recommended in production environments where telemetry volume is a concern or sensitive data needs to be handled securely. Using external storage enables separate access controls".
  - שדות ההפניה:
    - `gen_ai.input.messages_ref`
    - `gen_ai.output.messages_ref`
    - `gen_ai.system_instructions_ref`
    - `gen_ai.tool.definitions_ref`
  - התקן "does not prescribe the URI scheme, object layout, serialization format, retention policy, or access mechanism".
  - מותר להשתמש במזהים שנגזרים מהתוכן כדי לחסוך כפילויות, למשל בהוראות מערכת שחוזרות.
  - הגדרות ה־hook:
    - `OTEL_INSTRUMENTATION_GENAI_CONTENT_HOOK`;
    - `OTEL_INSTRUMENTATION_GENAI_UPLOAD_BASE_PATH`: תיקייה מקומית או `s3://`;
    - `OTEL_INSTRUMENTATION_GENAI_UPLOAD_FORMAT`: ‏`json` (ברירת המחדל) או `jsonl`;
    - `OTEL_INSTRUMENTATION_GENAI_UPLOAD_MAX_QUEUE_SIZE`: ברירת מחדל 20.
  - **שדות שמחייבים opt-in:**
    - `gen_ai.input.messages`, ‏`gen_ai.output.messages`, ‏`gen_ai.system_instructions`;
    - `gen_ai.tool.call.arguments` ו־`gen_ai.tool.call.result`;
    - `gen_ai.retrieval.query.text`;
    - `gen_ai.prompt.variable.*`;
    - שדות הזיכרון.
- **הפרופיל של Anthropic** — [anthropic.md](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/anthropic.md):
  - **פרומפט:**
    - `gen_ai.prompt.name`: חובה כשמשתמשים בתבנית בעלת שם.
    - `gen_ai.prompt.version`: כל סכמת גרסאות, למשל `1.0.0`, ‏`2025-05-01`, ‏`prod` או `v2`.
  - **מאמץ:** `gen_ai.request.reasoning.level`, שממופה ל־`output_config.effort`.
  - **טוקנים:** `gen_ai.usage.input_tokens`, ‏`output_tokens`, ‏`cache_read.input_tokens`, ‏`cache_write.input_tokens` ו־`reasoning.output_tokens`, עם פיצול לטקסט, תמונה ושמע.
  - **תגובה:**
    - `gen_ai.response.time_to_first_chunk`;
    - `gen_ai.response.finish_reasons`;
    - `gen_ai.conversation.compacted` (האם ההקשר נדחס);
    - `error.type`.
- **אירוע ההערכה `gen_ai.evaluation.result`** — [gen-ai-events.md](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-events.md):
  - `gen_ai.evaluation.name`: חובה, למשל `Relevance`.
  - `gen_ai.evaluation.score.value`.
  - `gen_ai.evaluation.score.label`, למשל `pass`/`fail` או `correct`/`incorrect`.
  - `gen_ai.evaluation.explanation`.
  - `gen_ai.response.id` ו־`error.type`.
  
  האירוע צריך להיות משויך ל־span שהוערך.
- **מדדים** — [gen-ai-metrics.md](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-metrics.md):
  - `gen_ai.client.operation.duration`
  - `gen_ai.server.request.duration`
  - `gen_ai.server.time_per_output_token`
  - `gen_ai.server.time_to_first_token`
  - `gen_ai.invoke_agent.duration`, ‏`inference_calls` ו־`tool_calls`
- **OpenInference**, המוסכמה של Arize ו־Phoenix — [configuration.md](https://github.com/Arize-ai/openinference/blob/main/spec/configuration.md):
  - משתני הסתרה: `OPENINFERENCE_HIDE_INPUTS`, ‏`_OUTPUTS`, ‏`_INPUT_MESSAGES`, ‏`_OUTPUT_MESSAGES`, ‏`_INPUT_IMAGES`, ‏`_INPUT_TEXT`, ‏`_OUTPUT_TEXT`, ‏`_PROMPTS`, ‏`_EMBEDDINGS_*` ו־`_RETRIEVAL_DOCUMENTS`.
  - `OPENINFERENCE_BASE64_IMAGE_MAX_LENGTH`: ברירת מחדל 32,000 תווים. ערך ארוך יותר מועלה או מושחר.
  - `OPENINFERENCE_BLOB_UPLOADER`: מעלה את התמונות הגדולות לאחסון חיצוני.
- **Langfuse** מציע מיסוך בצד הלקוח (`mask`), כולל ל־spans של OTel — [Langfuse Docs](https://langfuse.com/docs/observability/features/masking).
- **Anthropic ‏(19/11/2024):** סטטיסטיקה להערכות — [Anthropic Research](https://www.anthropic.com/research/statistical-approach-to-model-evals); [arXiv 2411.00640](https://arxiv.org/abs/2411.00640):
  - לדווח טעות תקן (SEM).
  - להשתמש בטעויות תקן מקובצות (clustered) כשהשאלות מקובצות. במבחנים פופולריים הן יכולות להיות גדולות "more than 3×" מהנאיביות.
  - להשוות **הפרשים מזווגים**, כי ציוני מודלים על אותן שאלות מתואמים (0.3–0.7).
  - המשמעות לרישום: לשמור ציון **לכל פריט**, לא רק ממוצע.
- **Hamel Husain ‏(24/3/2025):** מציג מותאם (custom viewer) לעקבות הוא "the most important AI investment" — [hamel.dev](https://hamel.dev/blog/posts/field-guide/).
- **אימות טענות כחלק מהעקבה:**
  - **אימות מפורק** (factored verification), סיכומי מאמרים, 2023 — [arXiv 2310.10627](https://arxiv.org/abs/2310.10627):
    - תפס 76.2% מההזיות ב־HaluEval לסיכום.
    - בממוצע מצא 0.62 הזיות לסיכום ב־ChatGPT, ‏0.84 ב־GPT-4 ו־1.55 ב־Claude 2.
  - **MiniCheck ‏(2024):** מודל של 770M פרמטרים מגיע לרמה של GPT-4 בבדיקת עיגון עובדתי, בעלות נמוכה פי 400 — [arXiv 2404.10774](https://arxiv.org/abs/2404.10774).

### Inferences
- **span לכל שלב** בצנרת: ASR, ‏OCR, חלוקה לפרקים, טיוטה, אימות, תיקון, בוחן וצ'אט.
  - כל רשומה במבנה של OTel, עם `gen_ai.prompt.name`, ‏`gen_ai.prompt.version` ו־`gen_ai.request.reasoning.level`.
  - כך הנתונים ניידים לכל כלי עתידי, בלי להתחייב לכלי עכשיו.
- **התוכן עצמו** (הפרומפט המלא, הפלט, התמליל) נשמר באותה שיטה של היום: אובייקט מוצפן ב־R2, עם `*_ref` ברשומה. ההפרדה מאפשרת לחלון הניהול לראות מטא־דאטה בלי לפענח תוכן.
- **פסקי האימות לכל טענה** נשמרים כאירועי `gen_ai.evaluation.result`:
  - name: `claim_support`;
  - label: `supported`, ‏`partial`, ‏`unsupported` או `unknown`;
  - explanation: הנימוק.
  
  כך מחשבים מדדים מצטברים בלי לקרוא תוכן.
- **פלטים שנדחו:** טיוטה שהבודק פסל, עם קוד הסיבה. אצלנו `rej_record` ו־`REJ_W` כבר קיימים בתרגום. זה הנתון הכי שימושי לניתוח שגיאות, כי הוא מראה את סוג הכשל לפני התיקון.
- **אמת מידה (MiniCheck):**
  - מודל קטן לבדיקת עיגון יכול לרוץ על ה־CPU בשרת, וכך לבדוק את **כל** הטענות בכל ניתוח במקום מדגם.
  - את השופט היקר נשמור לזוגות עיוורים ולסט הזהב.

### Gaps
- **שדות מדיה:** אין במוסכמות OTel שדות לביטחון ASR או OCR, או לסטטיסטיקות מדיה. אלה יהיו שדות פרטיים שלנו, ומומלץ לתת להם קידומת, למשל `snb.*`.
- **יציבות:** המוסכמות עדיין בסטטוס Development, ושמות השדות עלולים להשתנות.
- **פרופילים אחרים:** `gen_ai.prompt.name` ו־`gen_ai.prompt.version` נבדקו רק בפרופיל של Anthropic. `gen_ai.prompt.variable.*` מופיע גם במסמך הכללי. בפרופילים של ספקים אחרים לא בדקתי.
- **MiniCheck:** לא נבדק על עברית ולא על תמלילי הרצאות.

## 3. מנתונים לשיפור: טקסונומיית שגיאות, שופטי LLM, סטטיסטיקה, אופטימיזציית פרומפטים ושערי רגרסיה

### Takeaway
- **הסדר שעובד:**
  1. ניתוח שגיאות ידני על 100 עקבות לפחות.
  2. טקסונומיה, עם תווית בינארית לכל סוג כשל.
  3. שופט LLM נפרד לכל ממד, מכויל מול תיוג אנושי (TPR/TNR).
  4. שער רגרסיה עם סטטיסטיקה מזווגת, מקובצת לפי סרטון.
- **הכשלים העיקריים בסיכום ארוך:**
  - **השמטה**, במיוחד באמצע הקלט;
  - **הכללת־יתר**: ב־26–73% מהסיכומים המדעיים;
  - **טענות לא נתמכות.**
  
  שופט הוליסטי מזהה אותם רע. שופט ייעודי לכל סוג שגיאה טוב יותר.
- **אופטימיזציה אוטומטית של פרומפטים** (GEPA, ‏MIPROv2) נותנת שיפור של כמה אחוזים ועד עשרות אחוזים. אבל היא נוטה להתאמת־יתר (overfitting) לסט האימון: ב־OPRO הפער היה 5–20 נקודות. לכן להריץ אותה רק במצב לא מקוון, עם סט מבחן נפרד, ולהעביר את התוצאה דרך השער הקיים.

### Cited Findings

**טקסונומיות שגיאה בסיכום**
- **TofuEval** ‏(NAACL 2024), סיכום דיאלוג ממוקד נושא — [arXiv 2402.13249](https://arxiv.org/abs/2402.13249):
  - הקטגוריות: Extrinsic Information, ‏Misreferencing, ‏Stating Opinion-as-Fact, ‏Reasoning Error, ‏Tense/Aspect/Modality, ‏Contradiction, ‏Nuanced Meaning Shift, ‏Others.
  - בנושאים שוליים (marginal) יש יותר שגיאות.
  - 40–50% מהסיכומים מכילים לפחות שגיאה אחת.
  - מעריכים בינאריים מבוססי LLM חלשים בזיהוי.
- **Kirstein et al.** ‏(EMNLP Findings 2024), סיכום פגישות — [arXiv 2404.11124](https://arxiv.org/abs/2404.11124):
  - הקטגוריות: missing information, ‏redundancy, ‏wrong references, ‏incorrect reasoning, ‏hallucination, ‏incoherence, ‏linguistic inaccuracy, ‏structural disorganization.
  - בכשליש מצירופי המדד והשגיאה, המדד מתעלם מהשגיאה או אפילו מתגמל אותה.
- **MESA** ‏(2024) — [arXiv 2411.18444](https://arxiv.org/abs/2411.18444):
  - שמונה סוגי שגיאה.
  - תהליך בשלושה שלבים: זיהוי, חומרה, והשפעה בסולם 0–5. בנוסף, דיון בין סוכנים.
  - ההסכמה בין מתייגים אנושיים (alpha): השמטה 0.832, הזיה 0.820.
  - שיפוט לפי סוג שגיאה טוב משיפוט הוליסטי.
- **P-MESA** ‏(2025): שבעה ממדים של התאמה לקורא, ודיוק מאוזן של 89% ומעלה מול בני אדם — [arXiv 2509.15901](https://arxiv.org/abs/2509.15901).
- **הכללת־יתר:** Peters ו־Chin-Yee ‏(2025), ‏10 מודלים, ‏4,900 סיכומים מדעיים — [arXiv 2504.00025](https://arxiv.org/abs/2504.00025); [Utrecht University](https://www.uu.nl/en/news/most-leading-chatbots-routinely-exaggerate-science-findings):
  - הכללת־יתר ב־26–73% מהמקרים.
  - בקשה מפורשת לדיוק **הגבירה** אותה, ומודלים חדשים יותר היו גרועים יותר.
  - יחס הסיכויים מול סיכומים שכתבו בני אדם: 4.85.
  - ההמלצות: טמפרטורה נמוכה, ובנצ'מרק שמודד הכללה.
- **הטיית מיקום בצורת U:** מודלים מכסים פחות את אמצע הקלט. Ravaut et al. ‏(ACL 2024) בנו בשביל זה את הבנצ'מרק MiddleSum — [arXiv 2310.10570](https://arxiv.org/abs/2310.10570).
- **FABLES** ‏(COLM 2024), סיכום ספרים — [arXiv 2404.01261](https://arxiv.org/abs/2404.01261):
  - 3,158 טענות מ־26 ספרים, בעלות של כ־5.2 אלף דולר.
  - ‏Claude-3-Opus היה הנאמן ביותר.
  - מעריכים אוטומטיים היו חלשים.
  - השמטות היו שכיחות, וסוף הספר קיבל הדגשת־יתר.
- **SummHay** ‏(2024): ציון משולב של 56% לבני אדם, ומתחת ל־20% למודלים להקשר ארוך בלי retriever — [arXiv 2407.01370](https://arxiv.org/abs/2407.01370).
- **שלמות לפי יחידות תוכן:**
  - ACU ו־RoSE ‏(2022): ‏22 אלף תיוגים. המדדים והמעריכים נגועים ב־"prior, input-agnostic preferences" — [arXiv 2212.07981](https://arxiv.org/abs/2212.07981).
  - FineSurE ‏(ACL 2024): נאמנות, שלמות ותמציתיות, לפי עובדות מפתח (key facts) — [arXiv 2407.00908](https://arxiv.org/abs/2407.00908).
- **משוב מפורט:**
  - Fine-grained RLHF ‏(2023): משוב לכל מקטע לפי סוג: שגיאה עובדתית, חוסר רלוונטיות, חוסר שלמות — [arXiv 2306.01693](https://arxiv.org/abs/2306.01693).
  - ILF ‏(2023): למידה ממשוב בשפה טבעית — [arXiv 2303.16755](https://arxiv.org/abs/2303.16755).
- **HeSum** ‏(2024): ‏10 אלף זוגות לסיכום בעברית. המורפולוגיה היא אתגר מרכזי — [arXiv 2406.03897](https://arxiv.org/abs/2406.03897).
- **משקלי חומרה של MQM:**
  - GEMBA-MQM ‏(2023): קריטי 25, מהותי 5, קל 1 — [arXiv 2308.07286](https://arxiv.org/pdf/2308.07286).
  - WMT22: ‏major ‏‎−5, ‏minor ‏‎−1, ‏non-translation ‏‎−25 — [WMT22](https://aclanthology.org/2022.wmt-1.51.pdf).

**שופט LLM: הטיות ובקרות**
- Zheng et al. ‏(2023, MT-Bench): הטיות מיקום, אורך (verbosity) והעדפה עצמית. ‏GPT-4 הגיע ליותר מ־80% הסכמה עם בני אדם, רמה שמשתווה להסכמה בין בני אדם — [arXiv 2306.05685](https://arxiv.org/abs/2306.05685).
- Wang et al. ‏(2023): רק שינוי הסדר גרם ל־Vicuna "לנצח" את ChatGPT ב־66 מתוך 80 שאלות. הפתרונות שהוצעו: Multiple Evidence Calibration, ‏Balanced Position Calibration וכיול אנושי — [arXiv 2305.17926](https://arxiv.org/abs/2305.17926).
- Panickssery et al. ‏(2024): ההעדפה העצמית עולה באופן ליניארי עם היכולת של המודל לזהות את הטקסט שלו — [arXiv 2404.13076](https://arxiv.org/abs/2404.13076).
- Stureborg et al. ‏(2024) — [arXiv 2405.01724](https://arxiv.org/abs/2405.01724):
  - הטיית היכרות (familiarity bias): העדפה לטקסט עם perplexity נמוך;
  - התפלגות ציונים מוטה;
  - עיגון (anchoring) כשמבקשים כמה ציונים בבת אחת;
  - חוסר עקביות.
- G-Eval ‏(2023): מתאם Spearman של 0.514 מול בני אדם בסיכום, ונטייה להעדיף טקסט שכתב LLM — [arXiv 2303.16634](https://arxiv.org/abs/2303.16634).
- **בקרת אורך וסגנון:**
  - AlpacaEval עם בקרת אורך ‏(2024): המתאם עם Chatbot Arena עלה מ־0.94 ל־0.98 — [arXiv 2404.04475](https://arxiv.org/abs/2404.04475).
  - LMSYS ‏(29/8/2024): בקרת סגנון במודל Bradley-Terry, עם משתנים לאורך, כותרות, הדגשות ורשימות. מקדם האורך כ־0.249 — [LMSYS](https://lmsys.org/blog/2024-08-28-style-control/).
  - Chatbot Arena ‏(2024): ‏240 אלף הצבעות — [arXiv 2403.04132](https://arxiv.org/abs/2403.04132).
- Eugene Yan ‏(אוגוסט 2024) — [eugeneyan.com](https://eugeneyan.com/writing/llm-evaluators/):
  - ציון ישיר לבדיקות אובייקטיביות, השוואה בזוגות לשיפוטים סובייקטיביים.
  - הטיה עצמית של כ־10% ב־GPT-4 וכ־25% ב־Claude-v1.
  - להעדיף פלט בינארי ולמדוד Cohen's kappa.
- Shankar et al. ‏(2024), "criteria drift": "users need criteria to grade outputs, but grading outputs helps users define criteria" — [arXiv 2404.12272](https://arxiv.org/abs/2404.12272).
- Hamel Husain ‏(24/3/2025): תיוג בינארי (עבר/נכשל). אחרי שלוש איטרציות השופט מגיע ליותר מ־90% הסכמה עם המומחה — [hamel.dev](https://hamel.dev/blog/posts/field-guide/).
- Hamel Husain ו־Shreya Shankar (שאלות נפוצות, עדכון 21/9/2026) — [hamel.dev](https://hamel.dev/blog/posts/evals-faq/):
  - לסקור לפחות 100 עקבות, ולהמשיך עד רוויה.
  - למדוד לשופט TPR ו־TNR, לא רק הסכמה כללית.
  - לחלק את התיוגים לאימון, פיתוח ומבחן ביחס של כ־10–20 / 40–45 / 40–45.
  - שופט מאותו מודל שמייצר את הפלט בדרך כלל בסדר, אם מאמתים אותו.
- Anthropic ‏(9/1/2026) — [Anthropic Engineering](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents):
  - להתחיל ב־20–50 משימות שנלקחו מכשלים אמיתיים.
  - שלושה סוגי מדרגים: קוד, מודל ואדם.
  - לכייל שופטי LLM מול מומחים.
  - לתת לשופט אפשרות "Unknown", ולהפעיל שופט נפרד לכל ממד.
  - לקרוא את התמלילים עצמם.
  - להפריד סוויטת יכולות מסוויטת רגרסיה, שבה ההצלחה קרובה ל־100%. משימות שהגיעו לרוויה עוברות מסוויטת היכולות לסוויטת הרגרסיה ("graduation").
  - לבנות מדרגים שקשה לרמות.
- RLAIF ‏(2023): משוב AI לעומת משוב אנושי באימון — [arXiv 2309.00267](https://arxiv.org/abs/2309.00267).
- Stiennon et al. ‏(2020) — [arXiv 2009.01325](https://arxiv.org/abs/2009.01325):
  - 64,832 השוואות.
  - ההסכמה בין מתייגים לחוקרים: 77% ± 2%. בין חוקרים: 73% ± 4%. בין מתייגים: 66.9%.

**סטטיסטיקה לשער**
- Anthropic ‏(19/11/2024) — [Anthropic Research](https://www.anthropic.com/research/statistical-approach-to-model-evals):
  - טעות תקן לפי משפט הגבול המרכזי (CLT);
  - טעויות תקן מקובצות, שבמבחנים פופולריים גדולות פי 3 ויותר מהנאיביות;
  - דגימה חוזרת בתוך כל שאלה;
  - הפרשים מזווגים;
  - ניתוח עוצמה (power analysis).
- **Bootstrap מזווג:** Koehn ‏(EMNLP 2004, **ותיק, 2004**). עובד כבר עם כ־300 משפטים — [EMNLP 2004](https://aclanthology.org/www.mt-archive.info/EMNLP-2004-Koehn.pdf).
- **CUPED** ‏(WSDM 2013, **ותיק, 2013**): הפחתת שונות בניסויים בעזרת משתנה מהתקופה שלפני הניסוי — [exp-platform.com](https://exp-platform.com/cuped/).
- **Inspect** (UK AISI): ‏stderr וטעויות תקן מקובצות מובנים בכלי — [Inspect Docs](https://inspect.aisi.org.uk/scorers.html).

**אופטימיזציה אוטומטית של פרומפטים**
- **MIPROv2** ‏(EMNLP 2024): ניצח ב־5 מתוך 7 תוכניות, עם שיפור של עד 13% — [arXiv 2406.11695](https://arxiv.org/abs/2406.11695).
  - התיעוד מתאר שלושה שלבים: bootstrap של דוגמאות, הצעת הוראות, ואופטימיזציה בייסיאנית — [DSPy](https://dspy.ai/current/api/optimizers/MIPROv2/).
  - הגדרות: ‏`minibatch_size` 35, עד 4 דוגמאות מבוטסטרפ ו־4 מתויגות, ו־`auto` = light, ‏medium או heavy.
- **GEPA** ‏(ICLR 2026 oral; גרסה 2 של המאמר מפברואר 2026) — [arXiv 2507.19457](https://arxiv.org/abs/2507.19457):
  - שיפור ממוצע של כ־6% ועד 20% מעל GRPO, עם עד פי 35 פחות rollouts.
  - יותר מ־10% מעל MIPROv2.
  - גרסה 1 של התקציר דיברה על 10% בממוצע **(סתירה בין הגרסאות)**.
  - בתיעוד: המדד מחזיר `dspy.Prediction(score, feedback)`, כלומר משוב טקסטואלי ולא רק ציון. המועמדים נשמרים בחזית Pareto — [DSPy GEPA](https://dspy.ai/current/api/optimizers/GEPA/overview/).
- **TextGrad** ‏(2024): ‏GPQA עלה מ־51% ל־55%, ו־LeetCode-Hard השתפר ב־20% יחסית — [arXiv 2406.07496](https://arxiv.org/abs/2406.07496). הפרסום ב־Nature לא אומת: הקישור הפנה לדף התחברות.
- **OPRO** ‏(ICLR 2024) — [arXiv 2309.03409](https://arxiv.org/abs/2309.03409):
  - עד ‎+8%‎ ב־GSM8K ועד ‎+50%‎ ב־Big-Bench Hard.
  - אבל "training accuracies are often 5%-20% higher than our test accuracies".
  - ההמלצות: סט אימון גדול יותר ועצירה מוקדמת.
- **PromptWizard** ‏(Microsoft, 2024): נבדק על 45 משימות — [arXiv 2405.18369](https://arxiv.org/abs/2405.18369).
- **משפר הפרומפטים של Anthropic** — [Claude Blog](https://claude.com/blog/prompt-improver):
  - מה הוא עושה: מוסיף שלב חשיבה (CoT), מסדר דוגמאות ב־XML, מעשיר דוגמאות, כותב מחדש ומוסיף prefill.
  - יש עמודה של "פלט אידיאלי" ודירוג 1–5.
  - הדיווח: ‎+30%‎ בסיווג רב־תוויות (Haiku), ו־100% עמידה במספר המילים בסיכום.
  - **(סתירה)** בתאריך: הבלוג מציין 14/10/2024, וידיעה חדשותית מציינת 14/11/2024 — [Dataconomy](https://dataconomy.com/2024/11/15/anthropic-introduces-prompt-improver-for-ai-developers).
- **TextReg** ‏(NeurIPS 2026): מגדיר "prompt distributional overfitting", ומשפר עד 11.8% מחוץ להתפלגות לעומת TextGrad — [NeurIPS 2026](https://neurips.cc/virtual/2026/164764).
- **Sclar et al.** ‏(2023): שינוי בעיצוב הפרומפט בלבד מזיז את הדיוק בעד 76 נקודות. הדירוג של העיצובים כמעט לא עובר ממודל למודל — [arXiv 2310.11324](https://arxiv.org/abs/2310.11324).
- **MLflow `optimize_prompts`** (מגרסה 3.5.0): ‏GEPA ו־Metaprompting, חלק מרשם הפרומפטים (Prompt Registry). ההמלצה: כ־50–100 דוגמאות מתויגות — [MLflow Docs](https://mlflow.org/docs/latest/genai/prompt-registry/optimize-prompts.html).
- **NVIDIA Data Flywheel Blueprint** ‏(2025, **דיווח עצמי**): זיקוק למודל קטן מלוגים של ייצור, עם חיסכון מדווח של עד כ־98% בעלות — [NVIDIA](https://developer.nvidia.com/blog/build-efficient-ai-agents-through-model-distillation-with-nvidias-data-flywheel-blueprint).

**שערי רגרסיה ופרומפטים עם גרסאות**
- **הפרדת סוויטות:** סוויטת רגרסיה, שבה ההצלחה קרובה ל־100%, נפרדת מסוויטת יכולות. משימות שהגיעו לרוויה עוברות לרגרסיה — [Anthropic Engineering](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents).
- **בעיות התנהגות:** אחרי אירוע החנפנות, OpenAI החליטה לטפל בהן כ־"launch-blocking" — [Simon Willison](https://simonwillison.net/2025/May/2/what-we-missed-with-sycophancy/).
- **גרסת פרומפט בכל קריאה:** `gen_ai.prompt.version` מאפשר לשייך כל קריאה לגרסת הפרומפט שלה — [anthropic.md](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/anthropic.md).
- **promptfoo:** התיעוד של מבדקים שמדורגים בידי מודל מזהיר מהגדרת ספק ברירת מחדל (`defaultTest.provider`). לפי סיכום המחקר, ההגדרה עלולה להפוך בשקט את מודל המטרה לשופט של עצמו — [promptfoo Docs](https://www.promptfoo.dev/docs/configuration/expected-outputs/model-graded/) **(לא אומת ישירות)**.
- **DeepEval:** ‏`SummarizationMetric` = ‏min(alignment, coverage), עם 5 שאלות כברירת מחדל וסף 0.5 — [DeepEval Docs](https://deepeval.com/docs/metrics-summarization).

### Inferences
- **טקסונומיה מוצעת לניתוח הרצאה.** היא מאחדת את TofuEval, ‏Kirstein, ‏MESA ו־Peters:

  | קוד | סוג | הערה |
  |---|---|---|
  | `om` | השמטה (omission) | כולל השמטה באמצע ההרצאה (Ravaut) |
  | `ha` | הזיה או מידע חיצוני (extrinsic) | |
  | `ma` | ייחוס שגוי | דובר, שקופית או מקור |
  | `ts` | חותמת זמן שגויה | הטענה נכונה, הזמן לא |
  | `og` | הכללת־יתר | אובדן הסתייגות, מודליות או היקף |
  | `of` | דעה שמוצגת כעובדה | |
  | `re` | שגיאת היסק | |
  | `sh` | סינתזה רדודה | חזרה במקום הסבר, בלי "למה זה חשוב" |
  | `as` | שגיאת OCR או ASR שחלחלה | מונח, שם או מספר שגוי |
  | `st` | מבנה וקריאוּת | |

  לכל סוג יש חומרה בשלוש דרגות, עם משקלי MQM של 25/5/1.
- **שיפוט:**
  - שופט ייעודי לכל סוג שגיאה, בפלט בינארי עם אפשרות "Unknown".
  - כיול מול 100–200 תיוגים שלנו, עם מדידה של TPR ו־TNR.
  - זוגות עיוורים בשני הסדרים, עם בקרת אורך. התשתית כבר קיימת בתרגום: `quality-bench.py pairs --both-orders`.
- **השער:** משאירים את הכלל הקיים:
  - גבול Wilson תחתון מעל 0.5;
  - בלי נסיגה בקטגוריה מעבר ל־max(0.5, פעמיים הרעש);
  - עלות עד ‎+10%‎ וזמן עד ‎+5%‎.
  
  ומוסיפים:
  - **bootstrap מזווג, מקובץ לפי סרטון.** טענות מאותו סרטון אינן בלתי תלויות.
  - **שער קשיח** על טענות לא נתמכות (`unsupported`), על חותמות זמן שגויות ועל הכללת־יתר. כל עלייה מובהקת חוסמת.
  - **יחס הכיסוי באמצע:** השלמות בשליש האמצעי של ההרצאה, ביחס לשני השלישים האחרים.
- **אופטימיזציית פרומפטים:**
  - רק במצב לא מקוון, על סט אימון נפרד מסט הזהב, עם עצירה מוקדמת ובדיקה של אורך הפרומפט.
  - הפרומפט שנבחר עובר את השער, בדיוק כמו כל שינוי אחר.
  - GEPA מתאים במיוחד: הוא מקבל משוב טקסטואלי מהבודק (קודי הסיבה), ולא רק ציון.
- **עלות:** ריצת GEPA או MIPROv2 על סרטונים ארוכים יקרה. לפי הכלל הקיים ("הרץ גל" רק באישור, עם הצעת מחיר), כל ריצה כזו דורשת הצעת מחיר מראש.

### Gaps
- **שופטים בעברית:** אין נתונים על TPR ו־TNR של שופטי LLM **בעברית** בסיכומי הרצאות. HeSum הוא הסט היחיד בעברית שנמצא, והוא בנוי מחדשות.
- **סיכום ארוך:** לא נמצאו תוצאות של GEPA או MIPROv2 על משימות סיכום ארוך, של שעה ומעלה.
- **טענות שהגיעו רק מתקצירי חיפוש ולא נקראו:**
  - SAGE ‏(arXiv 2606.18902);
  - Hyperband BO לבחירת פרומפטים ‏(arXiv 2412.07820);
  - arXiv 2608.06714: לפי התקציר, פרומפט לא מאומת קיבל 52.0%, לעומת 49.3% לפרומפט "המאומת" הטוב ביותר.

## 4. כלים לאירוח עצמי: רישיון, התאמה לשרת המשותף, פרטיות, ולאמץ או לא

### Takeaway
- **השוק התגבש ב־2026 סביב רכישות:**
  - Langfuse נרכשה בידי ClickHouse (ינואר).
  - Helicone נרכשה בידי Mintlify (מרץ), ועברה למצב תחזוקה.
  - OpenAI הודיעה על רכישת promptfoo (מרץ).
  - ServiceNow רכשה את Traceloop, שמפתחת את OpenLLMetry (מרץ–מאי).
- **הכלים המלאים כבדים לשרת המשותף:**
  - Langfuse דורש Postgres, ‏ClickHouse, ‏Redis ו־S3, ולפחות 4 ליבות ו־16 GiB רק להתקנת docker compose, בלי זמינות גבוהה ובלי גיבוי.
  - Opik מריץ MySQL, ‏Redis, ‏ClickHouse, ‏ZooKeeper ו־MinIO.
  - Phoenix הוא הקל ביותר (SQLite או Postgres), אבל ברישיון ELv2 ועם tenant אחד בלבד.
- **ההמלצה: להמשיך במאגר שלנו** (ldb/SQLite ו־R2 מוצפן). מאמצים רק את **אוצר המילים** של OTel GenAI, ומשתמשים בכלי ההערכה כספריות (Inspect, ‏DSPy/GEPA), בלי שרת נוסף.

### Cited Findings

**טבלת הכלים** (הרישיונות נבדקו בקובץ LICENSE של כל מאגר, 9/11/2026)

| כלי | רישיון | רכיבים ומשאבים | פרטיות | מצב ב־2026 |
|---|---|---|---|---|
| Langfuse | MIT מחוץ ל־`ee/` ([LICENSE](https://github.com/langfuse/langfuse/blob/main/LICENSE)) | Postgres, ‏ClickHouse, ‏Redis, ‏S3; compose: "at least 4 cores and 16 GiB" ([Docker Compose](https://langfuse.com/self-hosting/deployment/docker-compose)) | מיסוך בצד הלקוח ([Masking](https://langfuse.com/docs/observability/features/masking)); מדיניות שמירה רק בגרסה הארגונית | נרכשה בידי ClickHouse ב־16/1/2026 ([Langfuse Blog](https://langfuse.com/blog/joining-clickhouse)) |
| Arize Phoenix | ELv2 ([LICENSE](https://github.com/Arize-ai/phoenix/blob/main/LICENSE)) | SQLite כברירת מחדל, Postgres 14 ומעלה לייצור, tenant אחד ([Architecture](https://arize.com/docs/phoenix/self-hosting/architecture)) | משתני הסתרה של OpenInference ([configuration.md](https://github.com/Arize-ai/openinference/blob/main/spec/configuration.md)); OAuth2, ‏LDAP, הרשאות לפי תפקיד ([Self-hosting](https://arize.com/docs/phoenix/self-hosting)) | פעיל |
| Opik | Apache 2.0 ([LICENSE](https://github.com/comet-ml/opik/blob/main/LICENSE)) | MySQL, ‏Redis, ‏ClickHouse, ‏ZooKeeper, ‏MinIO; compose "is not meant for production deployments" ([Local deployment](https://www.comet.com/docs/opik/self-host/local_deployment)) | אירוח עצמי "without user management features" ([Self-host](https://www.comet.com/docs/opik/self-host/overview)) | פעיל |
| Helicone | Apache 2.0 ([LICENSE](https://github.com/Helicone/helicone/blob/main/LICENSE)) | AI Gateway ופרוקסי לרישום; Supabase, ‏ClickHouse, ‏MinIO ([README](https://github.com/Helicone/helicone/blob/main/README.md)) | הרישום עובר דרך הפרוקסי, כלומר כל התוכן עובר דרכו | Mintlify רכשה אותו ב־3/3/2026, ועבר למצב תחזוקה ([Helicone Blog](https://helicone.ai/blog/joining-mintlify)) |
| OpenLLMetry | Apache 2.0 ([LICENSE](https://github.com/traceloop/openllmetry/blob/main/LICENSE)) | "a set of extensions built on top of OpenTelemetry"; מוציאה "standard OpenTelemetry data" ([README](https://github.com/traceloop/openllmetry/blob/main/README.md)) | תלוי ביעד הייצוא | ServiceNow רכשה את Traceloop; ההשלמה דווחה ב־5/5/2026 ([Calcalist](https://www.calcalistech.com/ctechnews/article/sjghwiqf11e)) |
| Lunary | Apache 2.0, לפי דף הפרויקט | — | — | הדחיפה האחרונה ב־26/4/2025 ([ecosyste.ms](https://awesome.ecosyste.ms/projects/github.com%2Flunary-ai%2Flunary)); קובץ LICENSE לא נמצא במאגר ב־9/11/2026 |
| promptfoo | MIT ([LICENSE](https://github.com/promptfoo/promptfoo/blob/main/LICENSE)) | CLI וספרייה, בלי שרת | רץ מקומית | OpenAI הודיעה על רכישה ב־9/3/2026, ואמרה שהפרויקט הפתוח יימשך ([OpenAI](https://openai.com/index/openai-to-acquire-promptfoo/)) **(לא אומת ישירות)** |
| Inspect | MIT ([LICENSE](https://github.com/UKGovernmentBEIS/inspect_ai/blob/main/LICENSE)) | ספריית פייתון | רץ מקומית | פעיל; stderr מקובץ מובנה ([Inspect](https://inspect.aisi.org.uk/scorers.html)) |
| DeepEval | Apache 2.0 ([LICENSE.md](https://github.com/confident-ai/deepeval/blob/main/LICENSE.md)) | ספריית פייתון | רץ מקומית, השופט חיצוני | פעיל ([Docs](https://deepeval.com/docs/metrics-summarization)) |
| RAGAS | Apache 2.0 ([LICENSE](https://github.com/explodinggradients/ragas/blob/main/LICENSE)) | ספריית פייתון | רץ מקומית, השופט חיצוני | פעיל |

**פרטים נוספים**
- **Langfuse:**
  - **רישיון:** "MIT Expat" לכל מה שמחוץ לתיקיית `ee/`. זכויות היוצרים כיום של ClickHouse, Inc. — [LICENSE](https://github.com/langfuse/langfuse/blob/main/LICENSE).
  - **פתיחת היכולות (4/6/2025):** כל יכולות המוצר עברו ל־MIT. נשארו בגרסה הארגונית SCIM, יומני ביקורת **ומדיניות שמירת נתונים (data retention)** — [Langfuse Blog](https://langfuse.com/blog/2025-06-04-open-sourcing-langfuse-product).
  - **הרכישה (16/1/2026):** "no planned changes to licensing", ‏"Self‑hosting is a first‑class path" — [Langfuse Blog](https://langfuse.com/blog/joining-clickhouse); [SiliconANGLE](https://siliconangle.com/2026/01/16/database-maker-clickhouse-raises-400m-acquires-ai-observability-startup-langfuse/).
  - **ארכיטקטורה:** שירותי web ו־worker, ‏Postgres, ‏ClickHouse, ‏Redis ואחסון S3 — [Self-hosting](https://langfuse.com/self-hosting).
  - **התקנת compose:** כ־100 GiB דיסק, בלי זמינות גבוהה ובלי גיבוי — [Docker Compose](https://langfuse.com/self-hosting/deployment/docker-compose).
  - **מינימום לכל רכיב** — [Scaling](https://langfuse.com/self-hosting/scaling):
    - web, ‏worker ו־Postgres: ‏2 CPU ו־4 GiB כל אחד;
    - Redis: ‏1 CPU ו־1.5 GiB;
    - ClickHouse: ‏2 CPU ו־8 GiB, ומומלץ 16 GiB ומעלה;
    - אחסון blob: ‏2 CPU ו־4 GiB.
  - **v4 (17/8/2026):** טבלת observations לא מנורמלת, ודרישה ל־ClickHouse 25.12 ומעלה. ‏v3 יקבל תיקוני אבטחה עד ינואר 2027 — [Changelog](https://langfuse.com/changelog/2026-08-17-langfuse-v4).
- **Phoenix:** "free to self-host with no feature limitations". הדף מזכיר גם מדיניות שמירת עקבות, בלי פרטים — [Self-hosting](https://arize.com/docs/phoenix/self-hosting).
- **Opik:** התקנה מקומית עם `./opik.sh`, ‏"not production-ready". לייצור: Kubernetes עם Helm — [Self-host](https://www.comet.com/docs/opik/self-host/overview).
- **רישיונות נוספים שנבדקו (9/11/2026):**
  - **Apache 2.0:**
    - [MLflow](https://github.com/mlflow/mlflow/blob/master/LICENSE.txt) (Databricks);
    - [OpenLIT](https://github.com/openlit/openlit/blob/main/LICENSE);
    - [Laminar](https://github.com/lmnr-ai/lmnr/blob/main/LICENSE.md);
    - [Argilla](https://github.com/argilla-io/argilla/blob/main/LICENSE);
    - [Label Studio](https://github.com/HumanSignal/label-studio/blob/master/LICENSE);
    - [Evidently](https://github.com/evidentlyai/evidently/blob/main/LICENSE);
    - [W&B Weave](https://github.com/wandb/weave/blob/master/LICENSE).
  - **MIT:**
    - [TruLens](https://github.com/truera/trulens/blob/main/LICENSE);
    - [DSPy](https://github.com/stanfordnlp/dspy/blob/main/LICENSE);
    - [GEPA](https://github.com/gepa-ai/gepa/blob/main/LICENSE);
    - [TextGrad](https://github.com/zou-group/textgrad/blob/main/LICENSE);
    - [PromptWizard](https://github.com/microsoft/PromptWizard/blob/main/LICENSE).
  - **מעורב:** [Agenta](https://github.com/Agenta-AI/agenta/blob/main/LICENSE): חלקים בגרסה הארגונית תחת רישיון אחר.
  - **AGPL-3.0:** [Langtrace](https://github.com/Scale3-Labs/langtrace/blob/main/LICENSE).
- **סקירה משנית של ההתגבשות** — [Developers Digest](https://www.developersdigest.tech/blog/llm-observability-acquisitions-2026) **(משני)**:
  - Galileo נרכשה בידי Cisco.
  - Humanloop נסגרה, והצוות עבר ל־Anthropic.
  - העצה: לעבוד עם OTel/OTLP, להחזיק עותק עקבות משלך, ולשמור את ההערכות בריפו.

### Inferences
- **השרת המשותף (16 vCPU, ‏32 GB)** כבר מריץ את עובד התרגום (Docker), את חדר האפליקציה ואת ldb.
  - Langfuse דורש לפחות 4 ליבות ו־16 GiB ל־compose, ו־ClickHouse לבדו 8–16 GiB.
  - כלומר חצי מהזיכרון, על חשבון התרגום, ועדיין בלי גיבוי.
- **Phoenix** קל יותר (SQLite), אבל יש לו שלוש בעיות:
  - **הרישיון:** ELv2 אוסר להציע את הכלי כשירות מנוהל. זה לא מפריע לשימוש פנימי, אבל זה לא קוד פתוח.
  - **tenant אחד בלבד.**
  - **הצפנה ומחיקה:** הנתונים שלו לא עוברים דרך ההצפנה לרשומה ודרך "מחק את התרומות שלי" שלנו, כך שאת שתיהן צריך לממש פעמיים.
- **סיכון ספקים:** ארבעה מהכלים המרכזיים החליפו בעלים ב־2026, ו־Helicone כבר במצב תחזוקה. מאגר משלנו בפורמט OTel מבטל את התלות.
- **מה כן לאמץ:**
  - את שמות השדות של OTel GenAI;
  - את Inspect או DSPy/GEPA, כספריות פייתון שרצות בעובד, לסטטיסטיקה ולאופטימיזציה;
  - promptfoo: אופציונלי, כ־CLI בריפו (MIT), בלי שרת.
- **ממשק לעקבות, אם נרצה בעתיד:**
  - אפשרות אחת: Phoenix על מכונה נפרדת או מקומית, עם ייצוא מסונן בלי תוכן.
  - אפשרות שנייה: להרחיב את המציג הקיים במעבדת השיפור (`versionsView`).
  
  המלצתו של Hamel Husain על מציג מותאם תומכת באפשרות השנייה.

### Gaps
- **משאבים:** דרישות המשאבים של Phoenix ו־Opik לא מפורסמות בדפים שנבדקו.
- **Phoenix:** דף מדיניות השמירה החזיר 404, וברירת המחדל לא ידועה.
- **Lunary:** לא ברור אם הפרויקט פעיל, ומאגר הקוד לא נמצא.
- **promptfoo:** לא אומת אם עסקת הרכישה הושלמה. אתר אחד טוען 16/3/2026.
- **ביצועים:** לא נבדקו תפוקה וזמני שאילתה של אף כלי על שרת בגודל שלנו.

## 5. פרטיות והסכמה: נוסחים וגרנולריות, PII ופנים, הצפנה לרשומה, 24 חודשים ו"מחק את התרומות שלי", GDPR ותיקון 13, צבירה ו־DP

### Takeaway
- **הסכמה גרנולרית:** נוסח נפרד לכל מטרה, עם גרסה.
  - לפי EDPB, "שיפור חוויית המשתמש" לא מספיק ספציפי, וביטול ההסכמה צריך להיות קל כמו מתן ההסכמה.
  - בישראל, נייר העמדה של הרשות (25/2/2026) מעדיף opt-in אקטיבי לשימוש שאינו הכרחי לשירות, ושוקל הסכמה נפרדת לשימוש משני.
- **טלמטריה מהדפדפן:** באיחוד האירופי היא בתחולת סעיף 5(3) של ePrivacy, ולכן דורשת הסכמה אם אינה פטורה.
- **פסאודונים:** נתונים בפסאודונים הם עדיין מידע אישי. ‏HMAC עם מפתח עדיף על hash.
- **מחיקה:** מפתח DEK לכל רשומה, עטוף ב־KEK של ה־vault, הופך את "מחק את התרומות שלי" למחיקה קריפטוגרפית, גם בגיבויים.
- **24 חודשים** הם בטווח המקובל:
  - ב־Gemini, ‏18 חודשים כברירת מחדל;
  - ב־Copilot, ‏24 חודשים לנתוני מעורבות;
  - ב־Anthropic, ‏5 שנים למשוב אגודל.
- **צבירה:** דיווח רק על אשכולות שעוברים סף גודל מינימלי, העיקרון של Clio, מתאים לנו. ‏DP מקומי לא מעשי בבסיס משתמשים קטן.

### Cited Findings

**הסכמה: EDPB ו־GDPR**
- **סיכום ההסכמה של EDPB** (אפריל 2026) — [EDPB](https://www.edpb.europa.eu/system/files/2026-04/edpb-summary-consent_en.pdf):
  - "Consent must be granular. If you process data for multiple purposes, you should propose separate consents as individuals should be free to choose which purpose they accept. Vague purposes like “improving user experience” are not specific enough".
  - **מידע לפני ההסכמה:** זהות הבקר, המטרה, סוג המידע, והזכות לבטל.
  - **לא נחשבים הסכמה:** שתיקה, תיבה מסומנת מראש וחוסר פעולה.
  - **ביטול:** "Withdrawing consent must be as easy as giving it".
  - **הסכמה מפורשת** (explicit) נדרשת למידע רגיש, כמו בריאות, דת ומידע ביומטרי.
- **הנחיות EDPB 2/2023** (גרסה 2.0, ‏7/10/2024) — [EDPB](https://www.edpb.europa.eu/system/files/2024-10/edpb_guidelines_202302_technical_scope_art_53_eprivacydirective_v2_en.pdf):
  - **סעיף 33:** "JavaScript code, where the accessing entity instructs the browser of the user to send asynchronous requests with the targeted information. Such access clearly falls within the scope of Article 5(3) ePD".
  - **סעיף 53:** גם תוצאה של עיבוד מקומי שנשלחת לשרת נחשבת "gaining of access".
  - **חריגים:** ההנחיות לא מנתחות אותם, והקורא מופנה לבחון בכל מקרה אם נדרשת הסכמה או שחל חריג (שם, סעיף 56).
- **חוות דעת EDPB 28/2024** על מודלי AI ומידע אישי, מדצמבר 2024. היא עוסקת:
  - באנונימיות של מודלים;
  - בבסיס של "אינטרס לגיטימי";
  - בהשלכות של עיבוד לא חוקי בשלב הפיתוח.
  
  [CMS](https://cms.law/en/int/legal-updates/edpb-opinion-28-2024-key-takeaways-on-processing-personal-data-in-the-context-of-ai-models) **(משני)**.
- **הנחיות EDPB לפסאודונימיזציה 01/2025** (ינואר 2025) — [EDPB](https://edpb.europa.eu/system/files/2025-02/edpb_summary_202501_pseudonymisation_en.pdf); [Stibbe](https://stibbe.com/publications-and-insights/key-takeaways-and-insights-from-the-edpb-pseudonymisation-guidelines) **(משני)**:
  - מידע בפסאודונים עדיין מידע אישי.
  - קוד אימות עם מפתח (keyed MAC) חזק יותר מ־hash רגיל.
  - ההנחיות מגדירות "pseudonymisation domain": התחום שבו המיפוי חסום.

**ישראל**
- **תיקון 13 לחוק הגנת הפרטיות:** אושר ב־5/8/2024 ונכנס לתוקף ב־14/8/2025. הוא מוסיף:
  - קטגוריה של "מידע בעל רגישות מיוחדת";
  - חובה למנות ממונה הגנת פרטיות (DPO) בחלק מהמקרים;
  - עיצומים כספיים;
  - פיצוי בלי הוכחת נזק.
  
  [Pearl Cohen](https://www.pearlcohen.com/major-amendment-to-israeli-privacy-law-set-to-take-effect/); [Vixio](https://www.vixio.com/insights/pc-regulatory-influencer-israel-modernises-privacy-law-comprehensive); [JDPP](https://econpapers.repec.org/RePEc:aza:jdpp00:y:2025:v:8:i:1:p:39-53).
- **IAPP** ‏(13/8/2025, Dan Or-Hof) — [IAPP](https://iapp.org/news/a/israel-marks-a-new-era-in-privacy-law-amendment-13-ushers-in-sweeping-reform):
  - "Fines can reach millions of shekels, with multipliers for large-scale databases or sensitive data processing".
  - הרשות מתכוונת לאכוף את ההנחיות שלה "as if they were binding law".
- **נייר העמדה של הרשות על הסכמה** (פורסם 25/2/2026), לפי סיכום של Gornitzky — [Gornitzky](https://www.gornitzky.com/israeli-privacy-protection-authority-publishes-new-guidance-on-obtaining-consent/) **(משני)**:
  - **הסכמה מדעת:**
    - ניסוח עמום, למשל "including" ברשימת סוגי מידע או מטרות, עלול לא להספיק.
    - יש לפרט את סוגי הנמענים.
  - **שימוש משני** שחורג מהמטרה המקורית דורש גילוי בולט יותר, ולעתים הסכמה נפרדת, למשל הודעה ייעודית בהרשמה. יש לחדש את ההסכמה כשהמטרות משתנות.
  - **opt-in אקטיבי** עדיף כשהשימוש אינו הכרחי לשירות או שונה ממנו מהותית.
  - **התניית שירות:**
    - התניה באיסוף מידע לא הכרחי היא גורם סיכון.
    - מומלץ להציע חלופות סבירות ולאפשר בחירה בסוגי המידע.
    - נטל ההוכחה שההסכמה ניתנה מרצון עשוי לעבור למבקש ההסכמה.
  - **ביטול:**
    - החוק לא קובע במפורש זכות לבטל הסכמה, אבל הרשות מכירה בכך שביטול יכול להיות חלק מההסכמה.
    - הרשות ממליצה על מנגנון ביטול ועל בחינת בקשות להפסיק שימוש.
  - **אופן ההצגה:** "the validity of consent depends on the information actually provided and how it is presented". יש להימנע מ־dark patterns ולתעד את ההסכמה.
  - ההודעה לפי סעיף 11 לחוק היא רק דרישת מינימום.
  
  חיבור נוסף לאותו נייר: [Pearl Cohen](https://www.pearlcohen.com/israeli-privacy-regulator-issues-position-paper-on-valid-consent/) **(לא נקרא)**.
- **טיוטת ההנחיה של הרשות ל־AI** (אפריל 2025; ההערות נסגרו ב־5/6/2025; עדיין טיוטה לפי המקורות שנבדקו) — [Gornitzky](https://www.gornitzky.com/privacy-in-artificial-intelligence-systems-guidelines-of-the-israeli-privacy-protection-authority/) **(משני)**:
  - הסכמה מדעת צריכה לפרט מטרות, נמענים, סוגי מידע, סיכונים, ואיך מערכת ה־AI מעבדת את המידע.
  - ממונה הגנת פרטיות "very likely" נדרש בארגון שמאמן AI.
  - מומלץ תסקיר השפעה (DPIA).
  - זכויות המחיקה והתיקון ייאכפו בקפדנות.
  - איסוף (scraping) בלי הסכמה אינו חוקי.
- **מדריך הרשות ל־PETs במערכות AI** (דצמבר 2025): ממליץ לשלב כמה טכנולוגיות להגנת פרטיות בשכבות — [Pearl Cohen](https://www.pearlcohen.com/israeli-privacy-regulator-issues-guidelines-on-privacy-enhancing-technologies-in-ai-systems/) **(משני)**.
- **תקנות אבטחת מידע** (2017) — [law.co.il](https://www.law.co.il/en/articles/2017/03/26/dramatic-overhaul-israeli-data-security-regulations/) **(ותיק, 2017; הפרטים לא אומתו)**.

**תקופות שמירה אצל אחרים** (נבדק 9/11/2026)

| ספק | מה | כמה זמן | מקור |
|---|---|---|---|
| Anthropic (דף מעודכן ל־1/7/2026) | קלט ופלט של ה־API | נמחקים תוך 30 יום | [Privacy Center](https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data) |
| Anthropic | הפרות של מדיניות השימוש | עד שנתיים | שם |
| Anthropic | ציוני מסווגי בטיחות | 7 שנים | שם |
| Anthropic | משוב אגודל | 5 שנים | שם |
| Gemini Apps | פעילות | 18 חודשים כברירת מחדל (אפשר 3 או 36) | [Gemini Help](https://support.google.com/gemini/answer/13594961) |
| Gemini Apps | שיחות כשהפעילות כבויה | 72 שעות | שם |
| Gemini Apps | שיחות שנסקרו בידי בני אדם | עד 3 שנים, מנותקות מהחשבון | שם |
| GitHub Copilot | נתוני מעורבות (user engagement data) | 24 חודשים | [Copilot Trust Center](https://resources.github.com/copilot-trust-center) |
| GitHub Copilot | פרומפטים מחוץ ל־IDE | 28 יום | [Microsoft Tech Community](https://techcommunity.microsoft.com/blog/azuredevcommunityblog/-/4468193) |

- **Microsoft 365:**
  - יש מתג נפרד ל־"include log files and relevant content samples" בתוך המשוב.
  - בדיירים של ממשל ארה"ב קיים "restricted feedback": אגודל וסוגי בעיה מוגדרים מראש בלבד.
  
  [Microsoft Learn](https://learn.microsoft.com/en-us/microsoft-365/admin/manage/manage-feedback-ms-org).

**הצפנה ומחיקה קריפטוגרפית**
- **NIST SP 800-88 Rev. 2** (ספטמבר 2025): מחיקה קריפטוגרפית (cryptographic erase) היא שיטת סניטציה מוכרת — [NIST](https://csrc.nist.gov/pubs/sp/800/88/r2/final).
- **הצפנת מעטפה** (envelope encryption) — [Google Cloud KMS](https://docs.cloud.google.com/kms/docs/envelope-encryption):
  - "Generate a new DEK every time you write the data".
  - "Do not use the same DEK to encrypt data from two different users".

**הסרת PII ופנים**
- **Presidio** (MIT): מזהים מותאמים עם regex ו־checksum. האזהרה בתיעוד: "no guarantee that Presidio will find all sensitive information" — [GitHub](https://github.com/microsoft/presidio).
- **deface** (MIT): טשטוש פנים עם CenterFace על CPU, סף ברירת מחדל 0.2, ותמיכה בווידאו — [GitHub](https://github.com/ORB-HD/deface).

**צבירה ופרטיות דיפרנציאלית**
- **Clio** (Anthropic, ‏12/12/2024) — [Anthropic](https://www.anthropic.com/research/clio); [arXiv 2412.13678](https://arxiv.org/abs/2412.13678):
  - ארבע שכבות פרטיות, וסף מינימלי לגודל אשכול לפי מספר החשבונות והשיחות הייחודיים.
  - דיוק של 94% בשחזור התפלגות הנושאים.
  - בביקורת של 5,000 שיחות לא נמצאו אשכולות עם מידע פרטי.
  - מתאם r=0.71 עם מסווגי הבטיחות.
- **OpenAI, "How People Use ChatGPT"** (NBER WP 34255, ‏2025): סיווג הודעות במסווגים אוטומטיים אחרי מסנן פרטיות — [NBER](https://www.nber.org/papers/w34255).
- **TnT-LLM** (Microsoft, 2024): בניית טקסונומיה וסיווג בעזרת LLM בקנה מידה — [arXiv 2403.12173](https://arxiv.org/abs/2403.12173).
- **DP מקומי:**
  - נפרס בטלמטריה של Windows על מיליוני מכשירים (NeurIPS 2017) — [arXiv 1712.01524](https://arxiv.org/abs/1712.01524).
  - במודל המקומי השגיאה גדלה כ־Ω(√n/ε), לעומת O(1/ε) במודל המרכזי, ולכן נדרש n גדול מאוד — [arXiv 1908.11358](https://arxiv.org/pdf/1908.11358).

### Inferences
- **מפתחות הסכמה לניתוח**, בהמשך לתבנית `lrt`/`lrm`. השמות לדוגמה בלבד:

  | מפתח | מה נשמר | הערה |
  |---|---|---|
  | `lat` | טקסט הניתוח והעקבות | |
  | `lam` | מדיה: קטעי שמע ופריימים | |
  | `lau` | טלמטריית שימוש (אירועי UX) | |
  | `lc` לכל עבודה | — | אותו מנגנון שקיים |
  | `lrf` | יומן הפיתוח המלא | נשאר רק למצב מפתח |

  - לכל מפתח נוסח ספציפי עם גרסה. דוגמה ל־`lat`: "נשמור את התמליל, הניתוח והסימונים שלך כדי לבדוק ולשפר את איכות הניתוח. מוצפן, נמחק אחרי 24 חודשים, ואפשר למחוק בכל רגע". לא "שיפור החוויה".
  - ברירת המחדל: כבוי. השירות לא מותנה בהסכמה.
- **אירועי UX נשלחים רק אחרי `lau`:**
  - אם יש משתמשים באיחוד האירופי, ePrivacy 5(3) חל.
  - בישראל, לפי נייר העמדה, נדרש opt-in לשימוש שאינו הכרחי לשירות.
  - בלי הסכמה יישארו רק מונים מצטברים בצד השרת, למשל "כמה עבודות הסתיימו". זו הסקה שלנו, שדורשת אישור משפטי.
- **מזהים:**
  - HMAC עם מפתח סודי שנשמר ב־vault, כי לפי EDPB זה חזק יותר מ־hash.
  - מפתח נפרד לתחום הניתוח (pseudonymisation domain), כדי שאי אפשר יהיה לחבר בין רשומות התרגום לרשומות הניתוח.
- **מחיקה:**
  - DEK לכל רשומה, ולכל אצוות אירועים של משתמש, עטוף ב־KEK של ה־vault. המפתח העטוף נשמר במסד.
  - "מחק את התרומות שלי" = מחיקת ה־DEK ומחיקת האובייקטים. עותקים בגיבוי או בתמונת מצב של ldb ב־R2 הופכים לבלתי קריאים (NIST 800-88).
  - כך גם מקיימים את 24 החודשים בגיבויים.
  - במדיה המנגנון כבר קיים: מפתח לכל קובץ, עטוף בכספת.
- **מסנן PII לפני השמירה:** מרחיבים את `scrub` הקיים:
  - מספרי תעודת זהות ישראלית עם ספרת ביקורת;
  - מספרי כרטיסים לפי Luhn;
  - IBAN.
  
  המסנן חל על התמליל, על טקסט ה־OCR (בשקופיות מופיעים שמות, מיילים וטלפונים), על הצ'אט ועל הערות חופשיות. Presidio שימושי לאנגלית, ובעברית צריך לבדוק.
- **פנים:**
  - פריימים נשמרים רק עם `lam`, אחרי deface על ה־CPU, וברזולוציה נמוכה.
  - עדיף לשמור חיתוכים של השקופית בלבד, בלי פנים.
  - טשטוש מקטין את הסיכון שפריים ייחשב מידע ביומטרי. זו הסקה שלנו: ההגדרה תלויה בשימוש לזיהוי, וזה לא נבדק מול תיקון 13.
- **צבירה:** דוחות של "שאלות בלי מענה" ו"אשכולות תלונות" יוצגו רק כשבאשכול יש לפחות k משתמשים שונים. ‏k=5 היא הצעה שלנו; הספים של Clio לא פורסמו במקורות שנבדקו.
- **אין DP מקומי:** בבסיס של עשרות עד מאות משתמשים, הרעש יבלע את האות.
- **ספקים במדיניות הפרטיות:** Anthropic שומרת קלט ופלט של ה־API עד 30 יום, ולכן היא צריכה להופיע במדיניות הפרטיות ובנוסח ההסכמה כנמען. כך גם R2.
- **לפני הפעלה:** תסקיר השפעה קצר (DPIA), ובדיקה אם תיקון 13 מחייב למנות DPO. גם טיוטת ה־AI של הרשות ממליצה על תסקיר.

### Gaps
- **ICO:** ההנחיה על תיעוד הסכמה לא נשלפה (אתגר Cloudflare).
- **נייר העמדה בעברית:** הנוסח עצמו לא נקרא, רק סיכומים של משרדי עורכי דין. גם לא נבדק אם המונח "final" מתאים: Gornitzky כותבים "position paper", ומקור אחר כותב "final version".
- **Clio:** הספים המדויקים לגודל אשכול לא פורסמו במקורות שנבדקו.
- **סכומי העיצומים והפיצוי בתיקון 13 שנויים במחלוקת:**
  - עיצום: 3.2 מיליון ש"ח ועוד 64 אלף ליום; עד 5% מהמחזור; 150–300 אלף; 640 אלף.
  - פיצוי בלי הוכחת נזק: 10 אלף, 65 אלף או 100 אלף.
  
  הסכומים הגיעו מתקצירי חיפוש ולא אומתו מול נוסח החוק.
- **"מידע בעל רגישות מיוחדת":** הרשימות שונות ממקור למקור, ולא נבדק אם הקלטת קול או תמונת פנים נכללות.
- **Presidio בעברית:** לא נבדק אם יש מזהים מובנים.

## 6. איך מוצרים בולטים מתארים את לולאת המשוב שלהם

### Takeaway
- **הדפוס החוזר בתיאורים:**
  - אות מפורש דליל: אגודל עם סיבות;
  - אות התנהגותי: קבלה, עריכה, שימור;
  - הערכה לא מקוונת עם שופטים מכוילים.
  
  אחרי אירוע החנפנות, אף מוצר גדול לא מתאר תגמול ישיר על אגודלים.
- **במוצרי סיכום** (Teams, ‏Google Docs):
  - מציגים סיכום רק כשהמודל בטוח;
  - מאפשרים לאמת מול ההקלטה;
  - מודדים דיוק, שלמות ובהירות.
- **בחינוך** (Khan Academy, ‏Duolingo):
  - רובריקה עם יעד הסכמה, ושופט שרץ כל לילה;
  - מודל משותף לקושי וליכולת.

### Cited Findings
- **Microsoft Teams, ‏Audio Recap** (נבדק 9/11/2026) — [Microsoft Support](https://support.microsoft.com/en-us/teams/meetings-events/frequently-asked-questions-about-meeting-audio-recap):
  - מדדים מעוגנים: "accuracy, comprehensiveness, inclusion, clarity".
  - המערכת "continuously evaluated with user online feedback".
  - המשתמש יכול לאמת מול ההקלטה והתמליל.
- **Google Docs** (23/3/2022, **ותיק, 2022**) — [Google Research](https://research.google/blog/auto-generated-summaries-in-google-docs/):
  - סט נתונים קטן ואיכותי ניצח סט גדול.
  - התקציר מוצג רק כשהמודל בטוח.
  - המשתמש יכול לקבל אותו, לערוך או להתעלם.
  - "user feedback and usage statistics will be critical".
- **YouTube** (15/9/2021): סקרי "valued watchtime", ומודל שמנבא את תשובותיהם לכל המשתמשים — [YouTube Blog](https://blog.youtube/inside-youtube/on-youtubes-recommendation-system/).
- **OpenAI** (2/5/2025): אגודלים ששימשו כאות תגמול נוסף החלישו את הבקרה על חנפנות. המסקנה: בדיקות התנהגות יחסמו שחרור — [Simon Willison](https://simonwillison.net/2025/May/2/what-we-missed-with-sycophancy/).
- **Cursor** (12/9/2025, **דיווח עצמי**): RL מקוון ממשוב של קבלה ודחייה, עם כמה עדכוני מדיניות ביום — [Cursor](https://cursor.com/blog/tab-rl).
- **Anthropic:**
  - Clio: תובנות מצטברות ששומרות על פרטיות (12/12/2024) — [Anthropic](https://www.anthropic.com/research/clio).
  - שמירת משוב אגודל למשך 5 שנים — [Privacy Center](https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data).
  - שיטת ההערכה לסוכנים (9/1/2026) — [Anthropic Engineering](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents).
- **Microsoft 365:** משוב עם או בלי דוגמאות תוכן, לפי בחירת מנהל הארגון — [Microsoft Learn](https://learn.microsoft.com/en-us/microsoft-365/admin/manage/manage-feedback-ms-org).
- **Gemini Apps:** בני אדם סוקרים חלק מהשיחות. השיחות שנסקרו מנותקות מהחשבון ונשמרות עד 3 שנים — [Gemini Help](https://support.google.com/gemini/answer/13594961).
- **Khan Academy:**
  - רובריקה עם יעד של 85% הסכמה בין מתייגים, ואחריה שופט LLM שרץ כל לילה **(משני)**.
  - מאמר ב־AIED 2026 — [arXiv 2608.11259](https://arxiv.org/abs/2608.11259) **(לא אומת ישירות)**.
  - עדכוני Khanmigo — [Khan Academy Blog](https://blog.khanacademy.org/khanmigo-math-computation-and-tutoring-updates/).
- **Duolingo Birdbrain:** הערכה משותפת של יכולת הלומד ושל קושי התרגיל — [Duolingo Blog](https://blog.duolingo.com/learning-how-to-help-you-learn-introducing-birdbrain).
- **Midjourney ו־GitHub Copilot:** פירוש של האותות המשתמעים לפי Eugene Yan (אוגוסט 2023) — [eugeneyan.com](https://eugeneyan.com/writing/llm-patterns/).
- **NVIDIA:** blueprint לזיקוק מלוגים של ייצור (2025, **דיווח עצמי**) — [NVIDIA](https://developer.nvidia.com/blog/build-efficient-ai-agents-through-model-distillation-with-nvidias-data-flywheel-blueprint).

### Inferences
- **הדפוס שמתאים לנו**, וכל חלקיו כבר קיימים בחלקם בתרגום:
  - אגודל עם סיבות ← טריאז';
  - סקר אקראי ונדיר ← כיול;
  - סט זהב וזוגות עיוורים ← שער;
  - צבירה עם ספים ← תובנות.
- **"להציג רק כשבטוח"** (Google Docs) מתאים אצלנו יותר כ**סימון** מאשר כהסתרה: טענה שקיבלה `unknown`, או שנשענת על ASR בביטחון נמוך, מסומנת "לא אומת", עם שבב זמן לבדיקה.
- **התיאורים של Teams ו־Google Docs** מדגישים שהמשתמש יכול לאמת מול המקור. אצלנו לחיצה על שבב זמן היא נקודת האימות, ולכן היא גם אות (סעיף 1).

### Gaps
- **מוצרי סיכום ייעודיים:** לא נמצאו פוסטים הנדסיים ציבוריים של מוצרים ייעודיים לסיכום פגישות או הרצאות.
- **Khan Academy:** הפרטים (יעד 85%, שופט לילי) הגיעו ממקור משני.
- **קודי סיבה:** קודי הסיבה לאגודל למטה במוצרים הגדולים לא אומתו.

## 7. הסכמה המומלצת (schema): חמישה חלקים

### Takeaway
- **רשומה אחת לכל עבודת ניתוח:**
  - מטא־דאטה במסד, בלי תוכן, עם שמות שדות לפי OTel GenAI;
  - תוכן מוצפן ב־R2, עם הפניות `*_ref`.
- **אירועי UX:** דלילים, ונשלחים רק בהסכמה.
- **מדדים:** מחושבים בצד השרת, ומנורמלים לחשיפה.
- **לולאת שיפור:** לא מקוונת, עם השער הקיים ועם תוספות.
- **פרטיות:** מבוססת על DEK לכל רשומה.
- **בהמשך ישיר למאגר התרגום:** אותו דלי, אותו vault, אותה רשימת שדות מותרת בשני הצדדים, ואותו שער. ההבדל: מפתחות הסכמה נפרדים ותחום פסאודונים נפרד.

### Cited Findings
- **שמות השדות** לשלבים, לטוקנים ולהערכות — [anthropic.md](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/anthropic.md), [gen-ai-events.md](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-events.md).
- **תוכן מחוץ ל־span**, עם הפניות והרשאות נפרדות — [gen-ai-spans.md](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-spans.md).
- **ציון לכל פריט**, טעויות תקן מקובצות והפרשים מזווגים — [Anthropic Research](https://www.anthropic.com/research/statistical-approach-to-model-evals).
- **זמן בתוך המסך כמדד חשיפה** — [Lagun et al.](https://research.google/pubs/towards-better-measurement-of-attention-and-satisfaction-in-mobile-search/). הטיית הקיפול — [NN/g](https://www.nngroup.com/articles/scrolling-and-attention/).
- **שיאי צפייה חוזרת** — [Kim et al. 2014](https://www.eecs.harvard.edu/~kgajos/papers/2014/kim14video.pdf).
- **טקסונומיה וחומרה** — [MESA](https://arxiv.org/abs/2411.18444), [TofuEval](https://arxiv.org/abs/2402.13249), [GEMBA-MQM](https://arxiv.org/pdf/2308.07286). הכללת־יתר — [Peters ו־Chin-Yee](https://arxiv.org/abs/2504.00025). השמטה באמצע — [Ravaut et al.](https://arxiv.org/abs/2310.10570).
- **שופטים מכוילים** — [Hamel ו־Shreya](https://hamel.dev/blog/posts/evals-faq/), [Anthropic Engineering](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents).
- **אופטימיזציה והתאמת־יתר** — [OPRO](https://arxiv.org/abs/2309.03409), [GEPA](https://arxiv.org/abs/2507.19457), [TextReg](https://neurips.cc/virtual/2026/164764).
- **לא לתגמל על אגודלים** — [Simon Willison](https://simonwillison.net/2025/May/2/what-we-missed-with-sycophancy/), [Stiennon et al.](https://arxiv.org/abs/2009.01325).
- **הסכמה גרנולרית וביטול** — [EDPB](https://www.edpb.europa.eu/system/files/2026-04/edpb-summary-consent_en.pdf). בישראל — [Gornitzky](https://www.gornitzky.com/israeli-privacy-protection-authority-publishes-new-guidance-on-obtaining-consent/).
- **DEK לכל רשומה ומחיקה קריפטוגרפית** — [Google Cloud KMS](https://docs.cloud.google.com/kms/docs/envelope-encryption), [NIST](https://csrc.nist.gov/pubs/sp/800/88/r2/final).
- **צבירה עם ספים** — [Clio](https://www.anthropic.com/research/clio).

### Inferences

#### 7.1 רשומת עבודה (per-job)
מבנה מוצע:
- **מטא־דאטה:** שורה במסד ldb, בלי תוכן.
- **תוכן:** אובייקט מוצפן בדלי `snb-learn`, במסלול `aq/<lid>.bin`. האצווה היומית מעבירה אותו ל־`ac/<YYYY-MM>/<lid>.bin`, באותה שיטה של `q/` ו־`c/` בתרגום. שמות הקידומות הם הצעה.
- **רשימת שדות מותרת זהה** בעובד ובשרתון, עם `AL_V` משותף. שדה חדש לא נכנס בלי שינוי בשני הצדדים.

```yaml
# ── מטא־דאטה (ldb, בלי תוכן) ──
v: 1                          # AL_V
lid: "<HMAC בתחום ana>"       # בלי uid, שם קובץ או קישור
ts: "2026-11-09T08:00:00Z"    # UTC במסד; תצוגה בשעון ישראל
consent: {lat: 3, lam: 0, lau: 2, at: "..."}   # גרסת הנוסח שהייתה בתוקף; 0 = לא ניתנה
build: {app: "vNNN", worker: "…", xf: ["…"]}   # גרסת בנייה, עובד, דגלי ניסוי פעילים
mode: "deep"                  # מצב הניתוח
lang: {src: "en", out: "he"}
outcome: {status: "ok", error.type: null}      # ok | failed | cancelled — גם כישלון נרשם (הטיית שורדים)
media:                        # snb.* — אין מקבילה ב־OTel
  dur_s: 3720
  kind: "lecture"             # lecture | webinar | course | panel
  n_spk: 2
  asr: {model: "…", conf_mean: 0.91, low_conf_share: 0.06}   # conf כמו ב־tokens_to_words
  audio: {snr: 18, wpm: 152}                                 # מ־audio_stats
  screen: {n_slides: 48, ocr_conf_mean: 0.88, screen_only_share: 0.21, n_cuts: 61}
stages:                       # שלב = span; שמות לפי OTel GenAI
  - name: "draft"             # asr|ocr|segment|outline|draft|verify|repair|quiz|cards|chat
    gen_ai.provider.name: "anthropic"
    gen_ai.request.model: "…"
    gen_ai.prompt.name: "ana.draft"
    gen_ai.prompt.version: "2026-11-09.1"
    gen_ai.request.reasoning.level: "high"
    usage: {input: 0, output: 0, cache_read: 0, cache_write: 0, reasoning: 0}
    cost_usd: 0.0
    dur_ms: 0
    ttfc_ms: 0                # gen_ai.response.time_to_first_chunk
    finish_reasons: ["end_turn"]
    retries: 0
    checks: {fx: 0, kp: 0, nw: 0}   # קודי בודק לשלב (בדומה ל־Pipeline.check)
    in_ref: "ac/2026-11/<lid>.bin#s3.in"    # gen_ai.input.messages_ref
    out_ref: "ac/2026-11/<lid>.bin#s3.out"  # gen_ai.output.messages_ref
    sys_hash: "sha256:…"      # מזהה מהתוכן להוראות מערכת חוזרות
evals:                        # gen_ai.evaluation.result — ציון לכל פריט
  - {name: "claim_support", label: "unsupported", value: 0, item: "c17", by: "verify@v3"}
  - {name: "err.og", label: "fail", value: 5, item: "c22", by: "judge.og@v2"}   # value = משקל MQM
counts:                       # תקציר למדדים בלי פענוח
  claims: 140; supported: 121; partial: 11; unsupported: 5; unknown: 3
  ts_off: 4; rejected: 7; kf_total: 60; kf_used: 51
  cov_thirds: [0.90, 0.78, 0.88]   # כיסוי עובדות מפתח: התחלה / אמצע / סוף
cost: {usd: 0.0, usd_per_min: 0.0, wall_s: 0}

# ── תוכן (מוצפן ב־R2, אחרי scrub) ──
transcript: [{t0, t1, spk: "S1", text, conf}]   # שמות הדוברים בטבלת sp נפרדת
screen: [{t, slide, text, conf}]                # OCR
outline: [{sec: "s3", title, t0, t1}]
claims:
  - {id: "c17", sec: "s3", text, kind: "fact|number|quote|definition|opinion|recommendation",
     ts: [1312.4], src: "audio|screen|both",
     verdict: "supported|partial|unsupported|unknown", by: "verify@v3", why: "…"}
ledger:                       # מאזן הכיסוי
  - {kf: "k09", t: 1290, text, used_in: ["c17"], status: "used|omitted",
     reason: "budget|dup|low_salience|unverified|asr_noise"}
rejected: [{stage: "draft", code: "ts_out_of_range", excerpt}]   # בדומה ל־rej_record
quiz: [{q: "q4", sec, stem, key, distractors: [], level: "recall|apply|analyze", src_ts: []}]
cards: [{c: "k12", front, back, src_ts: []}]
chat: [{q, a, cites: [], unanswerable: false}]
```

#### 7.2 אירועי אינטראקציה (per-interaction)
**המעטפה:** `{e, lid, s, at, v}`:
- `s`: ‏HMAC של הסשן;
- `at`: הזמן, מעוגל לדקה;
- `v`: גרסת הצורה.

**האיסוף והשליחה:**
- נאסף ב־`uxAdd` ונשלח באצווה: אחרי 8 שניות שקט, או כשהאפליקציה יורדת לרקע. זה המנגנון של `learnUx`.
- `UX_SHAPE` זהה בטלפון ובשרתון.
- הכל נשלח **רק עם `lau`**.

| אירוע | שדות | מה הוא אומר | מלכודת |
|---|---|---|---|
| `open` | ‏from: ‏list, ‏notif או share | חשיפה; המכנה של כל השיעורים | — |
| `sec_vis` | ‏sec, ‏ms (גלוי לפחות ב־50%, לשונית פעילה), ‏max_pct | זמן חשיפה לפרק; מצטבר, אירוע אחד לסשן | הטיית מיקום; לנרמל לאורך הפרק |
| `chip` | ‏sec, ‏claim, ‏t | לחיצה על שבב זמן | עניין, לא איכות |
| `seg` | ‏t, ‏watched_ms, ‏back (חזר לניתוח תוך 60 שנ׳) | צפייה בסרטון אחרי שבב | — |
| `copy` / `export` / `share` | ‏sec, ‏claim?, ‏n_chars / ‏fmt / ‏kind | שימור; אות חיובי חזק | — |
| `thumb` | ‏target (sec או claim), ‏id, ‏val ‎+1 או ‎−1, ‏why[] | שיפוט מפורש | J-shape ו־MNAR |
| `flag` | ‏kind (wrong או missing), ‏sec, ‏claim?, ‏t_video? | "זה שגוי" או "חסר כאן משהו", עם זמן | — |
| `note` | ‏ref, ‏text_ref | טקסט חופשי; רק אם המשתמש כתב; עובר scrub | PII |
| `card` | ‏c, ‏grade 1–4 | דירוג FSRS | — |
| `quiz` | ‏q, ‏choice, ‏ok, ‏ms | תשובה בבוחן | פריט פגום מול תוכן קשה |
| `ask` | ‏qh (hash), ‏answered, ‏rephrase, ‏left | שאלה בצ'אט | — |
| `rerun` / `pick` | ‏model, ‏mode / ‏winner (a, b או none) | הרצה מחדש ובחירה בין גרסאות | — |
| `survey` | ‏val 1–5 | מיקרו־סקר במדגם אקראי | — |
| `leave` | ‏max_sec | עד איפה הגיע; מתעד נטישה | הטיית שורדים |

**קודי הסיבה ל־`why`:**
- `wrong`: עובדה שגויה;
- `ts`: זמן שגוי;
- `missing`: חסר;
- `attrib`: ייחוס או דובר שגוי;
- `overgen`: הכללת־יתר;
- `shallow`: רדוד;
- `unclear`: לא ברור;
- `long`: ארוך מדי;
- `other`: אחר.

הקודים ממופים לטקסונומיה בסעיף 3.

#### 7.3 מדדים ותובנות
המדדים מחושבים פעם ביום בשרת, לטבלה מצטברת בלי תוכן.

**איכות** (מסט הזהב, ומהמאמת בכל עבודה):
- `support_rate`: supported חלקי (claims − unknown). בנוסף: `unsupported_per_1k` ו־`unknown_rate`.
- `ts_acc`: שיעור שבבי הזמן שסוטים ב־10 שניות לכל היותר מהזמן הנכון. נמדד בסט הזהב. הסף הוא הצעה.
- `kf_cov`: ‏kf_used חלקי kf_total.
- `mid_ratio`: הכיסוי באמצע, חלקי ממוצע הכיסוי בהתחלה ובסוף.
- `err_per_1k[type][sev]`: שגיאות לכל אלף טענות, לפי סוג וחומרה.
- `mqm`: סכום המשקלים חלקי מספר הטענות.
- **בריאות השופטים:** ‏`tpr`, ‏`tnr` ו־`kappa` לכל שופט, מול התיוג האנושי, עם מעקב סחיפה.

**התנהגות** (בהסכמה, מנורמל לחשיפה):
- `down_rate`: אגודלים למטה לכל 100 דקות־פרק גלויות, ותמהיל הסיבות.
- `vtr` (בדק ודחה): ‏`flag` בתוך 5 דקות אחרי `chip`, חלקי מספר ה־`chip`.
- `keep_rate`: עבודות עם העתקה, ייצוא או שיתוף, חלקי עבודות שנפתחו.
- `rerun_rate`, ‏`survey` (ממוצע והתפלגות), ו־`abandon_rate`: פתח ולא עבר את הפרק הראשון.
- `unans_clusters`: אשכולות של שאלות בלי מענה, רק עם 5 משתמשים שונים ומעלה.
- **ניתוח פריטים:** ‏p (קושי) ו־point-biserial לכל שאלה; `leech_rate` לכרטיסיות עם 8 שכחות ומעלה.

**תפעול:**
- `usd_per_min` ו־`wall_per_min`;
- שיעור הקריאה מ־cache;
- ניסיונות חוזרים;
- פלטים שנדחו בכל שלב;
- שיעור הכישלונות לפי `error.type`.

**תובנות:**
- **שיעורי שגיאה לפי תנאי המדיה:**
  - ביטחון ASR נמוך;
  - חלק גבוה של תוכן שמופיע רק במסך;
  - אורך;
  - שפה.
  
  זה מראה איפה להשקיע: OCR, ‏ASR או הפרומפט.
- **פרק שמסומן כבעייתי:** זמן שהייה גבוה, הרבה שבבים ו־`flag` באותו פרק מסמנים בלבול.

#### 7.4 לולאת השיפור והשערים
1. **איסוף בהסכמה** ← אצווה לילית, בשיטה של `learnBatch`.
2. **טריאז' שבועי:**
   - 30 עקבות אקראיות, 20 שסומנו ו־10 בביטחון הנמוך ביותר, לניתוח שגיאות ידני.
   - סוג כשל חדש מקבל שורה בטקסונומיה ושופט.
   - כל כשל מאומת הופך למקרה בסט הזהב, אם ההסכמה מאפשרת.
3. **סט זהב:**
   - מתחילים ב־20–50 סרטונים מגוונים: אורך, שפה, ריבוי תוכן במסך.
   - סוויטת יכולות נפרדת מסוויטת רגרסיה. מקרה שהגיע לרוויה עובר לרגרסיה.
4. **שופטים:**
   - אחד לכל סוג שגיאה, בינארי עם "Unknown".
   - כיול מול 100 תיוגים לפחות, עם יעדי TPR ו־TNR.
   - כיול מחדש בכל החלפה של מודל השופט.
   - בזוגות: שני הסדרים, ובקרת אורך.
5. **מועמדים:**
   - גרסת פרומפט (`gen_ai.prompt.version`);
   - מודל או רמת מאמץ;
   - דגל `xf`.
6. **אופטימיזציה לא מקוונת:**
   - GEPA, עם הנימוקים והקודים של המאמת כמשוב טקסטואלי.
   - סט אימון שונה מסט הזהב, עצירה מוקדמת, ותקרה לאורך הפרומפט.
   - הצעת מחיר לפני כל ריצה.
7. **השער:**
   - הכלל הקיים: גבול Wilson תחתון מעל 0.5, בלי נסיגה בקטגוריה, עלות עד ‎+10%‎ וזמן עד ‎+5%‎.
   - **בתוספת:**
     - bootstrap מזווג ומקובץ לפי סרטון;
     - עצירה קשיחה על עלייה ב־`unsupported` או ב־`og`, או על ירידה ב־`ts_acc`;
     - דיווח של טעות התקן.
8. **השקה:**
   - `xf` ← `XF_DEFAULT`.
   - חלון השפעה של 28 יום על המדדים המקוונים (`learnimpact.js`), עם CUPED לפי המדדים של אותו משתמש לפני השינוי.
   - נסיגה התנהגותית חוסמת. החזרה לאחור = כיבוי הדגל.
9. **אף פעם לא:**
   - אגודלים כתגמול;
   - אופטימיזציה על סט הזהב;
   - מדדים מקוונים כשער היחיד.

#### 7.5 בקרות פרטיות

| בקרה | ההצעה |
|---|---|
| הסכמה | `lat`/`lam`/`lau` (שמות לדוגמה), ו־`lc` לכל עבודה. נוסח ספציפי עם גרסה, שנשמרת ברשומה. כבוי כברירת מחדל. השירות לא מותנה בהסכמה. ביטול בלחיצה אחת עוצר את האיסוף ומציע מחיקה |
| טלמטריה | רק עם `lau` |
| מזהים | ‏HMAC בתחום `ana`, מפתח ב־vault. טבלת מיפוי uid ← lid: מוצפנת, נפרדת, ומשמשת רק את פעולת המחיקה. בלי uid, שם קובץ או קישור ברשומה |
| ניקוי | הרחבת `scrub` לתמליל, ל־OCR, לצ'אט ולהערות: מיילים, קישורים, טלפונים, ת"ז עם ספרת ביקורת, Luhn, ‏IBAN. שמות הדוברים בטבלת `sp` נפרדת |
| פנים ומדיה | רק עם `lam`. ‏deface לפני ההצפנה, רזולוציה נמוכה, ועדיפות לחיתוך השקופית בלבד |
| הצפנה | DEK ‏(AES-256-GCM) לכל רשומה ולכל אצוות אירועים. עטוף ב־KEK של ה־vault, עם ‏AAD `ana|<lid>`. המפתח העטוף נשמר במסד |
| מחיקה | "מחק את התרומות שלי" = מחיקת ה־DEK, האובייקטים והשורות. גיבויים ותמונות מצב הופכים לבלתי קריאים. מחיקה אוטומטית אחרי 24 חודשים, בעבודה יומית. יומן מחיקות בלי תוכן |
| גישה | חלון הניהול מציג מדדים מצטברים בלבד. פענוח של עקבה נרשם ביומן: מי, מתי ולמה. מצב האיסוף המלא כבוי כשיש משתמשים אמיתיים |
| צבירה | דוחות על אשכולות רק עם 5 משתמשים שונים ומעלה (הצעה). בלי DP מקומי |
| משפטי | מדיניות הפרטיות מפרטת את הנמענים: Anthropic, עם שמירה של 30 יום, ו־R2. לפני ההפעלה: תסקיר השפעה קצר, בדיקת חובת DPO לפי תיקון 13, והסכמה ל־ePrivacy אם יש משתמשים באיחוד. אין סיווג של משתמשים לפי נושא רגיש |

### Gaps
- **ספים:** ‏k, יעדי TPR ו־TNR, וסף הסטייה של 10 שניות לחותמת זמן הם הצעות שלנו, בלי מקור חיצוני. צריך לכייל אותם על הנתונים הראשונים.
- **רגישות מיוחדת:** לא ידוע אם הקלטת קול או פריים עם פנים נחשבים "מידע בעל רגישות מיוחדת" לפי תיקון 13. נדרשת בדיקה משפטית.
- **נפח:** כמות האירועים למשתמש לא ידועה עד ההשקה. גם לא ידוע אם האצווה היומית מספיקה, או שצריך דחיסה של `sec_vis`.
- **סט זהב:** לא נבדק אם אפשר להשתמש בהרצאות ציבוריות (רישיון CC) כסט זהב בלי הסכמה של משתמש. ראו `07-ingestion-legal.md`.
