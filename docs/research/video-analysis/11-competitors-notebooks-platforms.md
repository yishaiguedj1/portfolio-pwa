# מתחרים: מחברות AI, עוזרים כלליים ויכולות ה־AI של פלטפורמות הווידאו והקורסים — פירוק עומק של ניתוח סרטוני הרצאות, וובינרים וקורסים (מצב 9/11/2026)

> מחקר 9/11/2026 עבור לשונית "ניתוח וידאו" ב־THE SNOWBALL Studio. ממשיך ומעמיק את סעיפים 1א ו־1ח ב־`06-market-features-ux.md`.
> **שיטה:** כ־53 חיפושי WebSearch, ואחריהם כ־100 קריאות WebFetch ישירות: מרכזי עזרה, בלוגים רשמיים, עמודי מחירים, הודעות Message Center, עיתונות טכנולוגית ובדיקות עצמאיות. **תקציב החיפוש המשותף (200 לכל הסוכנים) נגמר באמצע העבודה**, ומאז נקראו רק כתובות ידועות. לא נעשה שימוש בעמודי תוצאות של מנועי חיפוש או בשירותי ארכיון/מראה.
> **סימונים:** "(תקציר חיפוש)" = הטענה נלקחה מתקציר של תוצאת חיפוש ולא מקריאת העמוד. "(בלוג מתחרה)" = המקור מוכר מוצר מתחרה. "(לא אומת)" = לא נמצא מקור ראשוני. תאריכים בפורמט יום/חודש/שנה; "נבדק 9/11/2026" = העמוד נקרא היום.
> **עמודים שנחסמו לקריאה:** help.openai.com ו־openai.com (403); support.udemy.com, business-support.udemy.com, teach.udemy.com, about.udemy.com (403); androidauthority.com (403); wired.com (חסום); עמודי המחירים של microsoft.com (503). לכן חלק מהטענות על ChatGPT ו־Udemy נשענות על תקצירי חיפוש ועל צד שלישי, וזה מסומן.
> **כלל ניסוח (בנייה נקייה):** תיאור עובדתי של התנהגות ויכולות בלבד ("X מציע Y"), ציטוטים קצרים בלבד, בלי ניסוחי השוואה או חיקוי. ההזדמנויות שלנו מנוסחות באופן כללי.

---

## 1. מחברות AI ועוזרים כלליים — מה כל אחד עושה בפועל עם סרטון הרצאה (כרטיס מוצר)

### Takeaway
בין העוזרים הכלליים, רק משפחת Gemini מעבדת את התמונה של הסרטון באופן מובנה: העלאת קובץ עד שעה במסלול בתשלום, ו־"agentic video" שזמין ב־API מ־1/9/2026 ומגיע לאפליקציה "בקרוב". כל השאר עובדים מתמליל (Gemini Notebook, Perplexity, Copilot ב־Clipchamp/Stream וב־Edge) או לא מקבלים וידאו בכלל (Claude, Meta AI, Le Chat). ChatGPT נמצא במעבר: קבצי וידאו מתקבלים אבל מנותחים "בכלים", ולפי OpenAI הניתוח לא תמיד מכסה את כל הסרטון. Grok טוען ל־"any video" בלי מגבלות מפורסמות. בעברית: Gemini Notebook מפיק סקירות קוליות ווידאו בעברית ו־Copilot תומך בעברית, אבל Gemini in Chrome בישראל פועל באנגלית בלבד.

### Cited Findings

#### 1.1 Gemini Notebook (לשעבר NotebookLM)
- **מה זה ואיך מגיעים ליכולת הווידאו:** NotebookLM שונה ל־Gemini Notebook ב־16/7/2026. Google מגדירה אותו "the same standalone product with deeper Google integration and a secure cloud computer". יש לו יותר מ־30 מיליון משתמשים ו־600 אלף ארגונים — [Google Blog, 16/7/2026](https://blog.google/innovation-and-ai/products/gemini-notebook/notebooklm-gemini-notebook/). את הווידאו מוסיפים כמקור במחברת: מדביקים קישור YouTube, או מעלים קובץ שמתקבל במסלול האודיו — [Gemini Notebook Help, נבדק 9/11/2026](https://support.google.com/gemininotebook/answer/16215270?hl=en). כתובות הכניסה: notebooklm.google.com ו־notebook.google.com — [Google one-pager לחינוך, 2026](https://services.google.com/fh/files/misc/gemininotebook_gfe_one_pager.pdf).
- **קהל:** סטודנטים, מורים, חוקרים וארגונים. משתמשי Google Workspace for Education מכל הגילים מקבלים אותו "free of charge" — [one-pager](https://services.google.com/fh/files/misc/gemininotebook_gfe_one_pager.pdf).
- **קלט — YouTube:** רק סרטונים ציבוריים עם כתוביות (של היוצר או אוטומטיות). מיובא רק תמליל הטקסט. סרטון שהועלה לפני פחות מ־72 שעות עלול לא להיות זמין, וסרטון בלי דיבור לא נתמך. אין מגבלת אורך, אלא אם קובץ הכתוביות עובר 500 אלף מילים. אם הסרטון נמחק או הופך לפרטי, המקור נמחק אוטומטית תוך 30 יום. סיבות כשל מוכרות: קישור לא תקין, סרטון "potentially unsafe", היעדר קובץ כתוביות, או שפת סרטון שלא נתמכת — [Help, נבדק 9/11/2026](https://support.google.com/gemininotebook/answer/16215270?hl=en).
- **קלט — קובץ מקומי:** אין סוג מקור "וידאו". mp4, avi ו־mpeg מופיעים ברשימת קובצי **האודיו**, שמתומללים בעת הייבוא ונשמרים כטקסט. mov, webm ו־mkv לא מופיעים. התמלול תומך בכ־70 שפות, **כולל עברית**. אודיו בלי דיבור לא נתמך, ואודיו באיכות נמוכה עלול להיכשל — [Help, נבדק 9/11/2026](https://support.google.com/gemininotebook/answer/16215270?hl=en). מגבלה לכל מקור: עד 500 אלף מילים או 200MB — [Help](https://support.google.com/gemininotebook/answer/16215270?hl=en).
- **קלט — שקופיות ותמונות:** Google Slides עד 100 שקופיות, PowerPoint ‏(pptx), ותמונות (jpg, png, heic, webp ועוד), עם אזהרה ש־"certain types of images may not work as well". מעמוד אינטרנט מיובא רק הטקסט, בלי תמונות ובלי סרטונים מוטמעים — [Help](https://support.google.com/gemininotebook/answer/16215270?hl=en).
- **עיבוד — תמליל בלבד:** מרכז העזרה כותב במפורש "only the text transcript" על YouTube — [Help](https://support.google.com/gemininotebook/answer/16215270?hl=en). בדיקות עצמאיות מגיעות לאותה מסקנה: "the AI tool doesn't actually watch the entire video" — [XDA, 15/7/2026](https://www.xda-developers.com/i-dont-watch-youtube-videos-anymore-i-consume-them-using-notebooklm/). הכלי "not suited to videos where visuals are the main content" — [Lifehacker Japan, 8/6/2026](https://www.lifehacker.jp/article/2606notebooklm-youtube-videos-as-sources/). חומר השיווק לחינוך טוען שהוא "can quickly summarize videos, slides, charts" — [one-pager](https://services.google.com/fh/files/misc/gemininotebook_gfe_one_pager.pdf). בפועל, הסיכום של סרטון מבוסס על התמליל.
- **סרטון בלי כתוביות או עם שקופיות בלבד:** סרטון YouTube בלי כתוביות או בלי דיבור לא ייובא — [Help](https://support.google.com/gemininotebook/answer/16215270?hl=en). כשההסבר נמצא ב־"imagens, gráficos ou demonstrações" שלא נאמרים בקול, הכלי עלול להחטיא אותו. הדוגמה: מדריך שמציג פקודות על המסך בלי להקריא אותן — [Canaltech, 31/10/2026](https://canaltech.com.br/inteligencia-artificial/como-usar-youtube-com-gemini-notebook-para-estudar/).
- **פלטים (Studio):** Audio Overviews, Video Overviews, Infographics, Mind Maps, Flashcards, Quizzes, Reports, Slide Decks ו־Data Tables — [nlmtools, אומת 28/9/2026](https://www.nlmtools.com/blog/gemini-notebook-vs-notebooks-in-gemini). ה־one-pager מוסיף study guides, ‏"interactive learning overviews", מפות חשיבה שאפשר למקד בפרומפט, מקליט אודיו ושיחה קולית — [one-pager](https://services.google.com/fh/files/misc/gemininotebook_gfe_one_pager.pdf).
- **Audio Overviews:** ארבעה פורמטים: Deep Dive (ברירת המחדל, שני מנחים), The Brief (דובר אחד), The Critique (משוב של שני מנחים) ו־The Debate. שלושה אורכים: Shorter, Default ו־Longer, כש־Longer באנגלית בלבד. אפשר לכוון בפרומפט "to focus on specific topics or adjust the expertise level". מצב אינטראקטיבי (Join) מאפשר לשאול את המנחים בקול, באנגלית בלבד. יש יותר מ־80 שפות, **כולל עברית**. אפשר להוריד או לשתף, ויש אזהרה ש־"may contain inaccuracies or audio glitches" — [Help, נבדק 9/11/2026](https://support.google.com/gemininotebook/answer/16212820?hl=en).
- **Video Overviews:** שלושה פורמטים. Cinematic זמין מגיל 18 ו**באנגלית בלבד**. Explainer מסכם "connects ideas across your sources". Short הוא סרטון של כ־60 שניות. יש שמונה סגנונות חזותיים (מגיל 18), פרומפט מכוון, ו־producer notes שאפשר לערוך לפני הרינדור. היצירה "may take a while" ולפעמים נמשכת יותר מ־30 דקות. אפשר להוריד. שיתוף ציבורי זמין רק בחשבונות צרכן. **עברית מופיעה** ברשימת השפות של Explainer ושל Short — [Help, נבדק 9/11/2026](https://support.google.com/gemininotebook/answer/16454555?hl=en). Cinematic הושק ב־4/3/2026 — [9to5Google](https://9to5google.com/guides/notebooklm). בהשקה הוא היה למנויי AI Ultra בלבד, וב־Gemini 3, Nano Banana Pro ו־Veo 3 (תקציר חיפוש) — [Google Blog](https://blog.google/innovation%2Dand%2Dai/products/notebooklm/generate%2Dyour%2Down%2Dcinematic%2Dvideo%2Doverviews%2Din%2Dnotebooklm/).
- **צ'אט ושאלות:** הצ'אט מעוגן רק במקורות, עם "in-line citations". מאוקטובר 2025 יש לו חלון הקשר של מיליון טוקנים והיסטוריה שנשמרת — [one-pager](https://services.google.com/fh/files/misc/gemininotebook_gfe_one_pager.pdf); [9to5Google](https://9to5google.com/guides/notebooklm).
- **כלי למידה:** כרטיסיות ומבחנים מספטמבר 2025, ובאפליקציית הטלפון מ־6/11/2025. מבחן הוא "editable practice quiz that provides feedback" — [9to5Google](https://9to5google.com/guides/notebooklm); [one-pager](https://services.google.com/fh/files/misc/gemininotebook_gfe_one_pager.pdf).
- **עיגון וחותמות זמן:** במקור YouTube, הציטוטים הם "inline citations linked directly to the video's transcript", ויש נגן YouTube מוטמע במחברת — [Google Blog, 26/9/2024](https://blog.google/innovation-and-ai/products/notebooklm-audio-video-sources/). כדי לאמת טענה, מרחפים מעל הציטוט שליד כל טענה — [XDA](https://www.xda-developers.com/i-dont-watch-youtube-videos-anymore-i-consume-them-using-notebooklm/). **לא נמצא תיעוד** לכך שלחיצה על ציטוט מריצה את הנגן לשנייה המדויקת. הציטוט מוביל לקטע בתמליל.
- **ייצוא ושיתוף:** אפשר להוריד Audio ו־Video Overviews לשימוש בלי רשת — [nlmtools](https://www.nlmtools.com/blog/gemini-notebook-vs-notebooks-in-gemini). קישור לסרטון עובד רק אם המחברת משותפת או ציבורית. כשהמקור הוא ספר מ־Play Books, ההורדה עלולה להיות מוגבלת — [Help](https://support.google.com/gemininotebook/answer/16454555?hl=en).
- **מחירים ומכסות (נבדק 9/11/2026):**

  | מסלול | מחברות | מקורות במחברת |
  |---|---|---|
  | חינם | 100 | 50 |
  | AI Plus | 200 | 100 |
  | AI Pro | 500 | 300 |
  | Ultra 20TB | 500 | 500 |
  | Ultra 30TB | 500 | 600 |

  מקור: [Help](https://support.google.com/gemininotebook/answer/16213268?hl=en). המחירים בארה"ב: AI Plus ‏$4.99, AI Pro ‏$19.99, AI Ultra החל מ־$99.99 (ויש מדרגה של $199.99) — [gemini.google](https://gemini.google/subscriptions/). מסלולי חינוך (מכסה יומית):

  | מסלול | שאלות צ'אט | Audio Overviews | Video Overviews | כרטיסיות | מבחנים | Deep Research |
  |---|---|---|---|---|---|---|
  | Education Fundamentals (חינם) | 50 | 3 | 3 | 10 | 10 | 10 בחודש |
  | Education Plus | 200 | 6 | 6 | 20 | 20 | 3 ביום |
  | AI Pro for Education | 500 | 20 | 20 | 100 | 100 | 20 ביום |

  מקור: [one-pager](https://services.google.com/fh/files/misc/gemininotebook_gfe_one_pager.pdf).
- **זמינות בישראל ועברית/RTL:** ישראל ברשימת המדינות הנתמכות. המוצר תומך ב־"80+ languages" — [Help, נבדק 9/11/2026](https://support.google.com/gemininotebook/answer/16164461?hl=en). עברית מופיעה ב־Audio Overviews, ב־Video Overviews (Explainer ו־Short) ובתמלול אודיו (המקורות לעיל). **לא נמצא תיעוד** לאיכות ממשק RTL, ולא לרשימת השפות הנתמכות בייבוא מ־YouTube.
- **פרטיות:** "not used to train Gemini Notebook unless you provide feedback". אצל Workspace ו־Workspace for Education הנתונים לא משמשים לאימון — [Help](https://support.google.com/gemininotebook/answer/16164461?hl=en). בחינוך הנתונים גם "not human reviewed" — [one-pager](https://services.google.com/fh/files/misc/gemininotebook_gfe_one_pager.pdf).
- **השקות 2025–2026** — [9to5Google](https://9to5google.com/guides/notebooklm):

  | תאריך | השקה |
  |---|---|
  | 29/7/2025 | Video Overviews |
  | 2/9/2025 | פורמטים של Audio Overviews |
  | 8/9/2025 | כרטיסיות ומבחנים |
  | 13/10/2025 | סגנונות וידאו |
  | 29/10/2025 | צ'אט עם מיליון טוקנים |
  | 13/11/2025 | Deep Research |
  | 19/12/2025 | Gemini 3 ו־Data Tables |
  | 20/2/2026 | Gemini 3.1 Pro |
  | 4/3/2026 | Cinematic |
  | 8/4/2026 | מחברות באפליקציית Gemini (לחינמיים מ־17/4/2026) |
  | 8/6/2026 | Gemini 3.5 ו־Antigravity |
  | 30/6/2026 | Short Video Overviews |
  | 16/7/2026 | שינוי השם |

  מאוגוסט 2026 המחברות מסונכרנות גם עם AI Mode בחיפוש, אבל שם אי אפשר ליצור Audio Overviews, Video Overviews, אינפוגרפיקה או מצגות — [nlmtools](https://www.nlmtools.com/blog/gemini-notebook-vs-notebooks-in-gemini).
- **ביקורות ותלונות:**
  - שבחים: "I don't 'watch' YouTube videos anymore". הכותבת צורכת הרצאות דרך צ'אט, Audio Overviews ומפות חשיבה — [XDA, 15/7/2026](https://www.xda-developers.com/i-dont-watch-youtube-videos-anymore-i-consume-them-using-notebooklm/).
  - ביקורת: "não substitui completamente a experiência de assistir ao vídeo", ויש "risco de erros nas respostas", למשל השמטה של הסתייגות — [Canaltech, 31/10/2026](https://canaltech.com.br/inteligencia-artificial/como-usar-youtube-com-gemini-notebook-para-estudar/).
  - כשלים: ייבוא מ־YouTube נתקע בלי הודעת שגיאה ("the progress bar freezes"). קובץ של 20 דקות עובר בקלות 300MB — [35gan Substack, 29/5/2026](https://35gan.substack.com/p/notebooklm-youtube-source-upload). רשימת כשלים מסודרת — [fast.io, 16/10/2026](https://fast.io/resources/notebooklm-upload-failed/).
  - קורסים מאחורי התחברות (Udemy, Coursera) אי אפשר להוסיף, כי "The video sits behind a login" — [HoverNotes, 30/10/2026 (בלוג מתחרה)](https://hovernotes.io/en/blog/add-any-video-to-notebooklm-with-hovernotes).
  - בסקירה: חסרונות — "Requires captions for YouTube", וייבוא של סרטון חדש עלול להיכשל — [Scrimba, 11/8/2026](https://scrimba.com/articles/best-ai-video-summarizers-2026/).
- **חוזקות:** סינתזה על פני הרבה מקורות במחברת אחת. מגוון תוצרי למידה עשיר. עברית בסקירות האודיו והווידאו. מסלול חינמי נדיב, במיוחד לחינוך.
- **חולשות:** תמליל בלבד, בלי הבנה של מה שעל המסך. תלות בכתוביות של YouTube. ציטוט שמוביל לטקסט ולא לרגע בסרטון. הפורמטים המתקדמים (Cinematic, Longer, Join) באנגלית בלבד.
- **מה לומדים (כללי):** משתמשים מעריכים "מחברת" שמחזיקה כמה הרצאות יחד עם תוצרי למידה. ציטוט שאפשר לאמת ליד כל טענה בונה אמון. יש ביקוש לקליטה בכמות (פלייליסטים).

#### 1.2 אפליקציית Gemini (העלאת וידאו, קישורי YouTube, agentic video)
- **מה זה ואיך מגיעים:** מעלים קובץ וידאו בצ'אט (ב־web וב־Gemini in Chrome), או מדביקים או מחפשים סרטון YouTube דרך "YouTube app" המחוברת — [Help: העלאת קבצים, נבדק 9/11/2026](https://support.google.com/gemini/answer/14903178?hl=en); [Help: YouTube, נבדק 9/11/2026](https://support.google.com/gemini/answer/16622858?hl=en). העלאת וידאו הושקה קודם בטלפון (iOS ו־Android), ובאותו זמן ה־web החזיר "File type unsupported" — [Free Press Journal, 19/6/2025, על פי The Verge](https://www.freepressjournal.in/amp/business/google-gemini-now-supports-video-uploads-for-ai-powered-analysis-on-mobile-apps).
- **קלט ומגבלות (נבדק 9/11/2026):**
  - וידאו: "Total video length can be up to 5 minutes". עם AI Pro או Ultra — עד שעה. כל סרטון עד 2GB. עד 10 קבצים בפרומפט.
  - אודיו: 10 דקות, או 3 שעות במסלול בתשלום.
  - קבצים אחרים: עד 100MB.
  - מקור: [Help](https://support.google.com/gemini/answer/14903178?hl=en).
- **YouTube:** Gemini עוזר "understand a video's content and answer questions about it" על בסיס מידע ציבורי של YouTube. התנאים: חובה להיות מחובר וש־Keep Activity יהיה דלוק. התכונה לא זמינה ב־Live ולא ב־Google Messages, ואין לה גישה להיסטוריית הצפייה — [Help](https://support.google.com/gemini/answer/16622858?hl=en).
- **עיבוד — תמונה ושמע:** ב־API, וידאו "static" נדגם כברירת מחדל ב־1 FPS. מצב "agentic" מחליט לבד מה לראות, באיזו מהירות, ובאיזה ערוץ: פריימים, אודיו או תמליל. הוא חוזר לקטעים "interesting time windows". לפי Google: עד 88% פחות טוקנים, עד 66% פחות עלות ועד 7% יותר דיוק. הוא זמין ב־API וב־AI Studio מ־1/9/2026, יגיע לאפליקציה "soon", ול־Ask בעמוד הצפייה ב־YouTube "in the coming months" — [Google Blog, 1/9/2026](https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-agentic-video-in-gemini/). מרכז העזרה של האפליקציה **לא מתעד** איך קובץ מועלה מעובד.
- **בדיקה עצמאית (ישנה):** בסרטוני YouTube, Gemini "excels at processing the audio component… but falls short with visual information". בראיונות הוא הוסיף חותמות זמן מועילות — [WIRED דרך CO/AI, 29/4/2025](https://getcoai.com/news/4-tips-on-using-gemini-ai-to-summarize-youtube-videos). דיווחים מ־2026 על כך שהאפליקציה "רואה" סרטוני YouTube ולא רק קוראת כתוביות — (תקציר חיפוש, לא אומת).
- **חותמות זמן:** דיווחים על קישורים לרגעים מסוימים בתשובות (תקציר חיפוש, Android Authority; לא אומת, העמוד חסום).
- **מחירים:**

  | מסלול | מחיר (ארה"ב) | מכסת שימוש |
  |---|---|---|
  | חינם | $0 | בסיסית |
  | AI Plus | $4.99 | פי 2 מהחינמי |
  | AI Pro | $19.99 | פי 4 מהחינמי |
  | Ultra | מ־$99.99 | פי 5 עד פי 20 מ־Pro |

  המכסות מתחדשות כל 5 שעות, עד גבול שבועי — [gemini.google, נבדק 9/11/2026](https://gemini.google/subscriptions/). שנה חינם של AI Pro לסטודנטים מוגבלת לסטודנטים בקולג' בארה"ב מגיל 18, וצריך לממש עד 31/12/2026 — [gemini.google/students](https://gemini.google/students/).
- **ישראל ועברית:** עברית ברשימת השפות הנתמכות, וישראל ברשימת המדינות — [Help, נבדק 9/11/2026](https://support.google.com/gemini/answer/13575153?hl=en).
- **פרטיות:** חיבור ל־YouTube מאפשר התאמה אישית לפי היסטוריית YouTube, והפירוט נמצא ב־Gemini Apps Privacy Notice — [Help](https://support.google.com/gemini/answer/16622858?hl=en).
- **חוזקות:** קלט וידאו אמיתי (תמונה ושמע). מנוע agentic שמכוון לסרטונים ארוכים. עברית וישראל נתמכות.
- **חולשות:** 5 דקות בחינם ושעה במסלול בתשלום — מעט מדי להרצאה של שעתיים. אין תוצר "מסמך" מובנה. ההתנהגות על קישורי YouTube לא מתועדת.
- **מה לומדים:** המגמה היא "צפייה סוכנית" שחוזרת רק לקטעים הרלוונטיים — חיסכון גדול בעלות לסרטון ארוך.

#### 1.3 Gemini in Chrome
- **מה זה:** עוזר בחלונית צד בדפדפן. הוא משתמש בתוכן הכרטיסייה הנוכחית כברירת מחדל, ואפשר לשתף עד 10 כרטיסיות. הוא לא פועל במצב Incognito — [Help, נבדק 9/11/2026](https://support.google.com/gemini/answer/16283624?hl=en).
- **וידאו ואודיו:** "Media understanding" מאפשר לשאול על אודיו ווידאו "you already played on media websites", לקבל סיכום ולשלוף פרטים. ההגדרה דלוקה כברירת מחדל ב־chrome://settings/ai/gemini — [Help](https://support.google.com/gemini/answer/16283624?hl=en). ב־25/9/2026 הורחב הניתוח לפודקאסטים ולסרטונים באתרים אחרים מלבד YouTube ("Play a lecture recording…"). באותו עדכון נוסף חידון מהכרטיסיות (כולל "lecture video"), באנגלית, במחשב, בארה"ב ובהודו — [Gagadget, 25/9/2026](https://gagadget.com/en/727536-google-chrome-gets-gemini-quizzes-cross-device-sync-and-podcast-summaries/).
- **ישראל ועברית:** בישראל הושק ב־10/6/2026 בחינם על Gemini 3.1, במחשב וב־iOS, **באנגלית בלבד**. היכולות כוללות שאלות על סרטוני YouTube ויצירת סימוני פרקים. ה־auto browse נשאר למנויים בארה"ב — [גאדג'טי, 10/6/2026](https://www.gadgety.co.il/363773/chrome-gemini-israel/). ישראל ברשימת האזורים למשתמשים מגיל 18, אבל **עברית לא ברשימת השפות** הנתמכות — [Help](https://support.google.com/gemini/answer/16283624?hl=en). עמוד המוצר בעברית מתאר השקה "בהדרגה באזורים נבחרים" — [gemini.google/il](https://gemini.google/il/overview/gemini-in-chrome/?hl=iw).
- **התרחבות:** ב־11/3/2026 נוספו הודו, ניו זילנד וקנדה, ועוד 50 שפות (תקציר חיפוש) — [Google Blog](https://blog.google/products-and-platforms/products/chrome/chrome-expands-india-new-zealand-canada/); [Workspace Updates](https://workspaceupdates.googleblog.com/2026/03/gemini-in-chrome-expands-to-more-countries-and-languages.html?hl=en).
- **ביקורות:** בבדיקה מול תוסף ChatGPT, ה־Ask Gemini של Chrome סיכם סרטון "almost twice as fast and with more detail" — [PiunikaWeb, 31/7/2026](https://piunikaweb.com/2026/07/31/chatgpt-chrome-extension-youtube-tab-support/). משתמש ב־Reddit דיווח שחותמות הזמן טובות לאורך חודשים, לצד תשובות עם שמות שגויים (תקציר חיפוש, לא אומת).
- **חוזקות:** חינם. נמצא "על" כל אתר וידאו. מבין גם מדיה שאינה YouTube.
- **חולשות:** בישראל רק באנגלית. מדיה מחוץ ל־YouTube צריך לנגן לפני שאפשר לשאול עליה. בלי מסמך מובנה ובלי ייצוא.
- **מה לומדים:** הדפדפן הופך לשכבת ניתוח אוניברסלית. ערך הבידול עובר לעומק, לשפה ולתוצר הכתוב.

#### 1.4 ChatGPT (צ'אט, תוסף Chrome, Record mode, Study mode)
- **קובצי וידאו — מצב סותר:**
  - לפי מרכז העזרה (תקציר חיפוש, סביב אוקטובר 2026): ChatGPT "can accept video files as attachments… including on Free plans", אבל "may use tools to analyze uploaded videos". הניתוח "can be incomplete or inaccurate" ו־"may not analyze the entire video or accurately interpret its audio" — [OpenAI Help](https://help.openai.com/en/articles/8400551).
  - מנגד, בהשוואות: "Video/Audio: No" — [OneFile, 28/2/2026](https://onefileapp.com/blog/ai-file-upload-limits-compared). "Not a core feature" — [Tech Insider, 20/9/2026](https://tech-insider.org/ie/chatgpt-vs-claude-vs-gemini-file-upload-2026/).
  - בקשת פיצ'ר ל־"Native Video Upload Support" ב־25/6/2026. תשובת התמיכה: "I can't share a timeline right now". שרשור קשור: "New ChatGPT .mp3 and .mp4 file support" (13/7/2026) — [OpenAI Community](https://community.openai.com/t/feature-request-native-video-upload-support/1384775).
- **מגבלות קבצים:** 512MB לקובץ. כ־80 קבצים ל־3 שעות ב־Plus. התקרה להודעה עלתה מ־10 ל־20 ב־17/9/2026. ב־Projects יש 20 קבצים (Plus) או 40 (Pro, Business ו־Enterprise) — [Tech Insider](https://tech-insider.org/ie/chatgpt-vs-claude-vs-gemini-file-upload-2026/).
- **קישורי YouTube:** בבדיקה, o3 לא הצליח לקרוא תמליל, כי "caption route is being blocked upstream". הפתרון היה להדביק את התמליל ידנית — [BGR, 12/5/2025](https://bgr.com/tech/how-i-watch-youtube-with-chatgpt-even-though-it-cant-stream-videos). סיכום ישיר של קישור YouTube ב־ChatGPT או ב־Claude "not reliable" — [Scrimba, 11/8/2026](https://scrimba.com/articles/best-ai-video-summarizers-2026/). ChatGPT "often can't actually watch" סרטון YouTube — [ScreenApp, 17/7/2026 (בלוג מתחרה)](https://screenapp.io/blog/ask-youtube).
- **תוסף Chrome (30/7/2026):** ב־Side Chat אפשר "ask about a YouTube video, reference your open tabs, or highlight text". בבדיקה, סיכום לקח יותר מדקה והיה פחות מפורט מ־Ask Gemini של Chrome. במסלול Go, בקשה אחת צרכה כ־2% מהמכסה החודשית (לפי התקציר) — [PiunikaWeb, 31/7/2026](https://piunikaweb.com/2026/07/31/chatgpt-chrome-extension-youtube-tab-support/).
- **סגירת Atlas:** הוכרזה ב־9/7/2026. היכולות עוברות לתוסף Chrome, לאפליקציית שולחן עבודה עם דפדפן מובנה, ול־ChatGPT Work (סוכן בענן) — [PPC Land](https://ppc.land/openai-kills-atlas-browser-folds-it-into-new-chatgpt-work-agent/). תאריך הסגירה: 9/8/2026 (תקציר חיפוש) — [SEO-Day](https://www.seo-day.de/news/article/openai-sets-aug-9-end-date-for-chatgpt-atlas?lang=en).
- **Record mode (הקלטת פגישות והרצאות):** זמין באפליקציית Mac בלבד, ב־Pro, Team ו־Enterprise לפי הבודק. בבדיקה של שיחה בת כשעה ורבע:
  - הסיכום הגיע תוך 34 שניות.
  - "Timestamps did not work" — לחיצה על חותמת לא עשתה כלום.
  - קובץ התמליל שהורד הכיל רק 3 שורות מההתחלה ו־3 מהסוף.
  - אין זיהוי דוברים, וההקלטה לא נשמרת.
  - מקור: [Avoma, 7/6/2026 (בלוג מתחרה)](https://www.avoma.com/blog/chatgpt-record-mode).
  - רשימת המסלולים שונה במקורות אחרים (Plus, Pro, Business, Enterprise ו־Edu). בתקציר חיפוש: תמלולים של Plus/Pro "used for model training" (לא אומת) — [OpenAI Help](https://help.openai.com/en/articles/11487532-record-mode).
- **Study mode:** הושק ב־29/7/2025 ב־Free, Plus, Pro ו־Team, ו־Edu הצטרף אחר כך. הוא נותן רמזים, בדיקות הבנה ושיעורים מובנים. נבדק עם סטודנטים בהודו ותומך ב־11 שפות הודיות — [MultiLingual, 30/7/2025](https://multilingual.com/openais-study-mode/). בטבלת המסלולים, Study mode ו־Projects מופיעים בכל המסלולים. "Voice with video" (מצלמה חיה) מופיע ב־Go, Plus ו־Pro. המחירים לא הוצגו בעמוד — [chatgpt.com/pricing, נבדק 9/11/2026](https://chatgpt.com/pricing). Plus עולה $20 לחודש — [OneFile](https://onefileapp.com/blog/ai-file-upload-limits-compared).
- **ישראל ועברית:** לא אומת בסבב זה (מרכז העזרה חסום).
- **חוזקות:** בסיס משתמשים ענק, Study mode, ותוסף דפדפן שקורא את הכרטיסייה.
- **חולשות:** אין הבנת וידאו מובנית ומתועדת. חסימת תמלילי YouTube לצד שלישי. חותמות זמן ותמליל שכשלו ב־Record mode.
- **מה לומדים:** כשהעוזר הכללי לא "רואה" את הסרטון, המשתמשים מדביקים תמלילים ידנית. זה כאב שמוצר ייעודי פותר מקצה לקצה.

#### 1.5 Claude (claude.ai, Claude in Chrome, Cowork, מחבר Panopto)
- **קלט:** ב־claude.ai מעלים מסמכים (PDF, DOCX, CSV, TXT, HTML, ODT, RTF, EPUB, JSON, XLSX) ותמונות (JPEG, PNG, GIF, WebP). **אין אודיו ואין וידאו.** המגבלות: 500MB לקובץ בצ'אט, 30MB לקובץ בפרויקט, ועד 20 קבצים לצ'אט. העמוד עודכן ב־23/7/2026 — [Claude Help, נבדק 9/11/2026](https://support.claude.com/en/articles/8241126-how-can-i-upload-files-to-claude-ai). ב־API יש עד 600 תמונות לבקשה (100 במודלים עם 200K טוקנים), עד 20 תמונות להודעה ב־claude.ai, ועד 8000×8000 פיקסלים. עמוד ה־vision לא מזכיר וידאו כלל — [Claude Docs, נבדק 9/11/2026](https://platform.claude.com/docs/en/build-with-claude/vision).
- **YouTube:** Claude לבדו "Reads the page text where it can open it". הדרך לסקור סרטון היא לתת פריימים ותמליל — [Creative Claw, 18/10/2026 (ספק כלי)](https://creativeclaw.co/claude/watch-videos/). מדריך נוסף ממליץ על תמליל עם חותמות זמן וצילומי מסך — [VOMO (ספק כלי)](https://vomo.ai/guide/can-claude-analyze-video).
- **טענה סותרת:** אתר לא רשמי טען ב־23/7/2026 ש־Claude "can now accept video files as input", בלי מקור של Anthropic — [Claude AI News](https://www.claudeainews.com/news/claude-watch-video-learn-your-job). מרכז העזרה הרשמי עודכן באותו יום ולא מזכיר וידאו. ההסבר הסביר הוא "Record a Skill" (הסעיף הבא).
- **Cowork — Record a Skill (21/7/2026):** "Record your screen while you do a task, talk through it as you go". מהקלטה כזו Claude בונה מיומנות שאפשר להריץ שוב. זמין באפליקציית שולחן העבודה, ב־Pro, Max ו־Team — [SEJ, 22/7/2026](https://www.searchenginejournal.com/anthropics-claude-can-now-watch-a-video-and-learn-your-job/583053/); [Let's Data Science](https://letsdatascience.com/blog/claude-cowork-record-a-skill-teach-ai-by-demonstration). זה לא ניתוח של הרצאות. ל־OpenAI Codex יש "Record and Replay" מ־18/6, ב־Mac בלבד, בלי EEA, שווייץ ובריטניה — [SEJ](https://www.searchenginejournal.com/anthropics-claude-can-now-watch-a-video-and-learn-your-job/583053/).
- **Claude in Chrome:** זמין לכלל המשתמשים מ־26/8/2026, בכל המסלולים בתשלום. הוא קורא את הדף, מקליד, לוחץ ומנווט. לא פועל בדפדפני Chromium אחרים ולא בטלפון. במאמר יש התייחסות להגנות מפני prompt injection, ואין אזכור של וידאו — [Claude Blog, 26/8/2026](https://claude.com/blog/claude-in-chrome-generally-available).
- **מחבר Panopto (חינוך):** אפשר "reference lecture transcripts from Panopto" דרך שרת MCP. יש גם Canvas LTI ו־Wiley. השיחות "private by default" ולא משמשות לאימון — [Anthropic, 9/7/2025](https://anthropic.com/news/advancing-claude-for-education). ‏Coursera פרסמה "Coursera Connector for Claude" ב־17/6/2026 — [Coursera Blog](https://blog.coursera.org/category/product-news/).
- **Learning mode:** מופיע בעמוד המחירים רק במסלול Education ("Academic research and learning mode") — [claude.com/pricing, נבדק 9/11/2026](https://claude.com/pricing).
- **מחירים (נבדק 9/11/2026):**

  | מסלול | מחיר |
  |---|---|
  | Free | חינם |
  | Pro | $17 לחודש בחיוב שנתי, או $20 בחודשי |
  | Max | $100 |
  | Ultra | $200 |
  | Team (Standard) | $20 בשנתי, או $25 בחודשי |
  | Team (Premium) | $100 בשנתי, או $125 בחודשי |
  | Enterprise | $20 למושב, לפחות 20 מושבים, ועוד שימוש לפי תעריפי ה־API |

  Claude in Chrome כלול מ־Pro ומעלה — [claude.com/pricing](https://claude.com/pricing).
- **ישראל ועברית:** ישראל ברשימת המדינות הנתמכות (בתוקף מ־12/11/2026) — [Anthropic](https://www.anthropic.com/supported-countries). עברית לא נמצאת בטבלת הביצועים (Global-MMLU), אבל לפי התיעוד Claude "processes input and generates output in most world languages" — [Claude Docs](https://platform.claude.com/docs/en/build-with-claude/multilingual-support).
- **חוזקות:** קריאה של עד 600 תמונות בבקשת API, שמתאימה לפריימים או לשקופיות שחולצו מראש. מחבר Panopto לתמלילי הרצאות במוסדות.
- **חולשות:** אין וידאו ואין אודיו בצרכן. YouTube לא אמין. אין תוצרי למידה ייעודיים לסרטון.
- **מה לומדים:** כשבונים על Claude, כל עבודת הווידאו (תמלול, חילוץ פריימים, OCR ותזמון) צריכה לקרות לפני המודל, אצלנו בשרת.

#### 1.6 Perplexity (כולל Comet)
- **קלט ועיבוד:**
  - אודיו: MPEG, WAV, AIFF, OGG, FLAC, MP3.
  - וידאו: MP4, MPEG, MOV, AVI, FLV, MPG, WebM, WMV, 3GPP.
  - הכל עד **40MB**. המערכת "automatically transcribe the spoken content" ומתייגת דוברים.
  - "visual scenes from video files aren't indexed or searchable at this time".
  - מכסה שבועית מתגלגלת בכל המסלולים, גבוהה יותר ב־Max.
  - מקור: [Perplexity Help Center, נבדק 9/11/2026](https://www.perplexity.ai/help-center/en/articles/10354807-file-uploads).
  - בקבצים ארוכים נשלפים "the most important parts" (תקציר חיפוש).
- **Comet:** הושק ביולי 2025 למנויי Max, ונפתח בחינם לכולם ב־2/10/2025. גרסת Android יצאה ב־20/11/2025 ו־iOS ב־18/3/2026 (תקציר חיפוש) — [Thurrott, 18/3/2026](https://www.thurrott.com/mobile/333936/perplexity-launches-its-comet-browser-on-ios-and-ipados). בעמוד המוצר יש Mac, Windows, iOS ו־Android, ואין אזכור של YouTube — [perplexity.ai/comet, נבדק 9/11/2026](https://www.perplexity.ai/comet).
- **YouTube ב־Comet:** הפרומפט "Summarize the last video I watched" נותן "A quick skim of key points and timestamps" — [AI Spotlight, 19/10/2025](https://ai-spotlight.beehiiv.com/p/stop-clicking-let-your-browser-work-for-you). המנכ"ל קידם שימוש ב־Comet Assistant כדי לדלג לחלקים מרכזיים בסרטונים ארוכים (תקציר חיפוש; עמוד המקור לא זמין).
- **מחירים:** Pro ‏$20 לחודש — [OneFile](https://onefileapp.com/blog/ai-file-upload-limits-compared). ‏Comet Plus ‏$5 לחודש, כלול ב־Pro וב־Max (תקציר חיפוש).
- **ישראל ועברית:** לא אומת.
- **חוזקות:** מקבל הרבה פורמטים של וידאו ומתייג דוברים. דפדפן חינמי עם עוזר.
- **חולשות:** 40MB הוא כמה דקות של הרצאה. אין הבנה חזותית. תיעוד דל של יכולות ה־YouTube.

#### 1.7 Microsoft Copilot — Edge, Clipchamp/Stream, Video recap, OneDrive
- **Edge (צרכני):** Copilot מסכם סרטוני YouTube ("Turn any YouTube video into instant insights") — [Microsoft Edge, נבדק 9/11/2026](https://explore.microsoft.com/en-us/edge/features/video-highlights). ‏"Video Highlights" יוצר "time-stamped outline" עם נקודות מפתח, ל־YouTube ול־Vimeo, ורק לסרטונים עם תמליל או כתוביות — [Techlicious, 14/3/2024](http://www.techlicious.com/blog/copilot-for-edge-video-highlights-feature/). בהשקה ב־2023 נדרש עיבוד מוקדם או כתוביות, והוערך דיוק של 63%–74% (תקציר חיפוש, הערכת צד שלישי). Copilot Mode הושק ב־28/7/2025 בחינם ב־Windows וב־Mac. ב־"Video summary" לפני צפייה היה אז "under testing" — [SEJ, 29/7/2025](https://www.searchenginejournal.com/microsoft-adds-copilot-mode-to-edge-with-multi-tab-ai-analysis/552441/).
- **Edge for Business:** אפשר לעגן Microsoft 365 Copilot Chat בסרטוני YouTube פתוחים. התכונה במצב Launched, ‏GA בפברואר 2026 — [RM499424](https://mc.merill.net/message/RM499424). סיכום כרטיסיות וסרטוני YouTube: כבוי כברירת מחדל, דורש Entra ID ורישיון M365 Copilot. ההודעה עודכנה ב־30/10/2026 — [MC1187682](https://mc.merill.net/message/MC1187682).
- **Copilot בנגן Clipchamp (לשעבר Stream):**
  - מסכם ועונה "for any video with a transcript", עם "linked timestamps" שקופצים לנקודה בסרטון.
  - מאתר מתי מדברים על אנשים או נושאים, ומזהה קריאות לפעולה.
  - דורש תמליל של **יותר מ־100 מילים**, וקורא רק את התמליל הראשון (לא תרגומים).
  - דורש רישיון Microsoft 365 Copilot ותוכנית שירות SharePoint.
  - מקור: [Microsoft Support, נבדק 9/11/2026](https://support.microsoft.com/en-us/office/0b531ea9-2d9d-4830-97e4-2c1b2b8ca31d).
  - המותג Stream עובר ל־Clipchamp (תקציר חיפוש) — [MC1088176](https://mc.merill.net/message/MC1088176).
- **Video recap (M365 Copilot):** מקליטת Teams של **10 דקות לפחות בדרך כלל** נוצר סרטון קצר. הוא בנוי מקטעים של 20–40 שניות מהקלטה, עם קריינות AI וכתוביות. Copilot קורא את התמליל כדי לבחור נושאים. **אנגלית בלבד**, "aren't editable" ו־"can't be shared". זמין ב־Mac, ב־Windows ובדפדפן — [Microsoft Support, נבדק 9/11/2026](https://support.microsoft.com/en-us/microsoft-365-copilot/how-video-recap-in-microsoft-365-copilot-works).
- **OneDrive:** "Copilot in OneDrive does not support videos and images" לסיכום קבצים — [Microsoft Support](https://support.microsoft.com/en-US/onedrive/summarize-your-files-with-copilot). סיכום של הקלטות פגישה וסימון האזכורים שלך מיועד לבעלי רישיון — [OneDrive Blog, 8/10/2025](https://techcommunity.microsoft.com/blog/OneDriveBlog/copilot--onedrive-intelligence-in-every-click-inspiration-in-every-memory/4458882).
- **עברית:** עברית נתמכת לשאלות ולתשובות, כולל Copilot Chat החינמי. העמוד עודכן בספטמבר 2026 — [Microsoft Support](https://support.microsoft.com/en-us/topic/supported-languages-for-microsoft-copilot-94518d61-644b-4118-9492-617eea4801d8).
- **מחירים:** מחיר רישיון M365 Copilot לא אומת (עמודי המחירים החזירו 503).
- **חוזקות:** חותמות זמן לחיצות בנגן הארגוני. עברית בצ'אט.
- **חולשות:** תמליל בלבד בכל הנתיבים. דורש רישיון ארגוני. Video recap באנגלית בלבד ולא ניתן לשיתוף.
- **מה לומדים:** בארגון, "קפיצה לרגע" מהתשובה היא סטנדרט. משתמשים עסקיים יצפו לזה.

#### 1.8 Grok (xAI)
- **הכרזה:** ב־2/8/2026 Musk כתב ב־X ש־Grok יכול "analyze videos from across the web" או "any video". לא פורסמו מגבלות קובץ, אתרים נתמכים, קצב דגימה או מדיניות שמירה. כרטיס המערכת מזכיר ניתוח של סרטונים שפורסמו ב־X — [remio, 3/8/2026 (בלוג מתחרה)](https://www.remio.ai/post/grok-can-analyze-any-video-but-the-hard-part-is-proving-it-understands-one); [ToolNavs](https://toolnavs.com/article/1926-grok-opens-up-arbitrary-video-analysis-moving-from-understanding-visuals-to-cros).
- **פרטים מצד שלישי:** MP4, WebM או MOV. עד 150MB בצ'אט ו־48MB ב־API. קישור YouTube מושך רק כותרת, תיאור ותגובות. ה־vision בשל יותר לתמונות מאשר לווידאו. יש תקלות העלאה — [Atlas Cloud, 16/8/2026 (ספק)](https://www.atlascloud.ai/blog/guides/how-to-upload-video-to-grok-xai-chat). השוואה מפברואר 2026 קבעה "Video/Audio: No", עם מסלול בתשלום החל מ־$8 — [OneFile](https://onefileapp.com/blog/ai-file-upload-limits-compared).
- **הערכה:** יכולת מוכרזת בלי תיעוד רשמי. לא נמצאו בדיקות עצמאיות על הרצאות.

#### 1.9 Meta AI
- עמוד העזרה מתאר רק **עריכה** של סרטונים שהועלו ("maximum length… 10 seconds") ויצירה ב־Vibes. אין אזכור של הבנה, שאלות או סיכום. "not yet available everywhere" — [Meta Help, נבדק 9/11/2026](https://www.meta.com/help/artificial-intelligence/996454095987249/). העוזר ב־Edits מנתח מדדי חשבון של יוצרים בארה"ב, לא את תוכן הסרטון (מ־30/9/2026, תקציר חיפוש).
- **הערכה:** לא נמצאה יכולת לניתוח הרצאות.

#### 1.10 Le Chat (Mistral)
- Voxtral ב־voice mode של Le Chat: מקליטים או מעלים **אודיו** ומקבלים תמלול, שאלות וסיכומים. המודל מוגבל ל־30 דקות לתמלול ו־40 דקות להבנה. השפות שמוזכרות הן "to name a few" (אנגלית, ספרדית, צרפתית, פורטוגזית, הינדי, גרמנית, הולנדית, איטלקית), ועברית לא מוזכרת — [Mistral, 15/7/2025](https://mistral.ai/news/voxtral).
- סוגי הקבצים ב־Le Chat הם מסמכים ותמונות בלבד (תקציר חיפוש) — [Mistral Help](https://help.mistral.ai/en/articles/347521-how-do-i-upload-images-or-documents-to-le-chat). ‏Voxtral Transcribe 2 (פברואר 2026) מוסיף זיהוי דוברים וחותמות זמן (תקציר חיפוש) — [Mistral](https://mistral.ai/news/voxtral-transcribe-2).
- **הערכה:** אין וידאו.

### Inferences
- רוב העוזרים "מבינים" סרטון דרך התמליל, גם כשהשיווק מדבר על "videos". ההבנה החזותית בפועל נמצאת היום כמעט רק אצל Gemini, ובמסלול הצרכני היא מוגבלת לשעה של העלאה.
- Google סוגרת את הפער החזותי בשלבים: agentic video ב־API (9/2026), אחר כך באפליקציה וב־Ask של YouTube. כדאי להניח שבתוך 6–12 חודשים "Gemini רואה את הסרטון" יהיה זמין לכולם בחינם, ולבנות בידול שלא תלוי רק בזה.
- חותמות זמן לחיצות שעובדות קיימות בעיקר בסביבות סגורות (נגן Clipchamp הארגוני, Ask בעמוד הצפייה). במחברות ובצ'אטים הכלליים הציטוט מוביל לטקסט, או שהחותמות מקורבות או לא עובדות.
- הערוצים המרכזיים לניתוח סרטון עוברים לדפדפן: Gemini in Chrome, תוסף ChatGPT, Comet ו־Edge. מוצר ייעודי צריך להציע משהו שהחלונית בצד לא נותנת: מסמך מלא, שפה ועומק.

### Gaps
- הטקסט המלא של מרכז העזרה של OpenAI על קובצי וידאו, Record mode ותוסף Chrome לא נקרא (403). לא ידוע בוודאות אם ChatGPT דוגם פריימים או רק מתמלל.
- לא נמצא תיעוד רשמי לאופן שבו אפליקציית Gemini מעבדת קישור YouTube: תמליל, או גם פריימים.
- לא אומתו זמינות ועברית ב־ChatGPT ו־Perplexity בישראל, ולא מחיר רישיון M365 Copilot.
- Grok: אין תיעוד רשמי למגבלות. Meta AI ו־Le Chat: לא נמצאה יכולת וידאו, והחיפוש הופסק לפני בדיקה מעמיקה.
- לא נבדקה בפועל איכות ה־RTL והעברית בממשקי Gemini Notebook ו־Copilot.

---

## 2. יכולות ה־AI של פלטפורמות הווידאו והקורסים — מה הן עושות עם תוכן ההרצאה

### Takeaway
YouTube הוא השחקן החזק: כפתור Ask בעמוד הצפייה זמין בישראל ובעברית, עם יותר מ־20 מיליון משתמשים בדצמבר 2025, רשימות צעדים וחותמות זמן לחיצות (מקורבות). Ask YouTube (חיפוש שיחתי) עדיין בארה"ב ובאנגלית בלבד. פלטפורמות הקורסים (Coursera Coach, Udemy AI Assistant, LinkedIn Learning, Pluralsight Iris, DataCamp) מציעות עוזר שמעוגן בקורס ובתמליל שלו, אבל רק לקורסים נבחרים, בשפות נבחרות, ובתוך הקטלוג שלהן. אף אחת מהן לא מתעדת ניתוח של מה שמוצג על המסך. ב־11/5/2026 הושלם מיזוג Coursera ו־Udemy.

### Cited Findings

#### 2.1 YouTube — Ask בעמוד הצפייה, Ask YouTube, פרקים, חידונים ו־Courses
- **Ask בעמוד הצפייה — מה ואיך:** אפשר לשאול שאלות על הסרטון או לבחור פרומפט מוצע, "without leaving the video". הכפתור מופיע "on select videos". הוא זמין ב־Android, ב־iOS, בדפדפן במחשב ובטלוויזיות וקונסולות (עם קול). הוא למחוברים מגיל 13, ולא לחשבונות ילדים. התשובות "may sometimes produce inaccurate or offensive information". התכונה נפרדת מאפליקציית Gemini, אבל שתיהן משתמשות ב־Gemini — [YouTube Help, נבדק 9/11/2026](https://support.google.com/youtube/answer/14110396?hl=en).
- **שפות ומדינות:** ברשימה כ־77 שפות, **כולל עברית** (ספירה שלנו של הרשימה שחולצה). המדינות כוללות את **ישראל**, אבל לא את גרמניה, צרפת ואוסטרליה — [YouTube Help](https://support.google.com/youtube/answer/14110396?hl=en).
- **היסטוריה:**

  | תקופה | שלב |
  |---|---|
  | 2023 | ניסוי |
  | 2024 | מנויי Premium בטלפון וב־web |
  | 2025 | כל המשתמשים |
  | 4/2026 | טלוויזיות |

  מקור: [BGR, 1/4/2026](https://www.bgr.com/2137910/how-use-youtube-tv-ask-button/). בנובמבר 2025 הכפתור היה זמין בארה"ב, קנדה, ניו זילנד והודו, מגיל 18 ובאנגלית — [Dataconomy, 12/11/2025](https://dataconomy.com/2025/11/12/youtube-launches-on-screen-ai-chat-that-explains-videos-in-real-time/).
- **שימוש בלמידה:** יותר מ־20 מיליון משתמשים השתמשו ב־Ask בדצמבר 2025 כדי לפשט מונחים או לסכם — [YouTube Blog, 28/4/2026](https://blog.youtube/news-and-events/youtube-empowering-learning-tools/).
- **חותמות זמן:** הבקשה "the steps outlined in the video" החזירה רשימת צעדים "with clickable timestamps". הכפתור לא קיים בנגן המוטמע. הכותב מזהיר ש־"LLMs can make up details" ושהכלי עלול לדלג על אזהרות עדינות — [How-To Geek, 24/4/2026](https://www.howtogeek.com/youtubes-ask-button-just-solved-the-tutorial-problemand-i-wasnt-expecting-to-say-that/). בסרטון בלי פרקים, Gemini מחזיר מתווה עם זמנים "rough" ו־"approximate", ולחיצה קופצת לנקודה — [Android Police, 9/8/2026](https://www.androidpolice.com/ai-in-youtube-useful-for-this-one-feature/). קישור עמוק שמתחיל אחרי ההקשר הדרוש מכריח לגלול אחורה (תקציר חיפוש, לא אומת).
- **מה יגיע:** Ask בעמוד הצפייה צפוי לעבור ל־agentic video understanding "in the coming months" — [Google Blog, 1/9/2026](https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-agentic-video-in-gemini/).
- **פרטיות:** שיחות שמקושרות לחשבון נמחקות אחרי 45 יום. בודקים אנושיים עשויים לקרוא שיחות, אחרי ניתוק מהחשבון והסרה אוטומטית של פרטים אישיים, ושיחות שנבדקו נשמרות עד 3 שנים. השיחות לא משמשות לפרסום — [YouTube Help](https://support.google.com/youtube/answer/14110396?hl=en).
- **Ask YouTube (חיפוש שיחתי):** ניסוי למנויי Premium בארה"ב מגיל 18 — [Digital Trends, 27/4/2026](https://www.digitaltrends.com/computing/youtube-is-turning-into-an-answer-engine-with-a-new-conversational-search-feature/). לפי מרכז העזרה היום:
  - זמין ב־"United States" בלבד, ובאנגלית.
  - במחשב, בטלפון ובטלוויזיה (לא ב־Apple TV).
  - התשובות משלבות סרטונים ארוכים, Shorts וטקסט. קטעים מתנגנים במעבר עכבר, "starting at the timestamp most relevant to your question".
  - פלייליסטים ותוכן Premium לא נכללים. יש בדיקה אנושית ושמירה עד 3 שנים.
  - מקור: [YouTube Help, נבדק 9/11/2026](https://support.google.com/youtube/answer/16943763?hl=en).
  - הכלי "not built to sit inside one two-hour lecture" — [ScreenApp, 17/7/2026 (בלוג מתחרה)](https://screenapp.io/blog/ask-youtube).
- **פרקים (Chapters):** צריך לפחות 3 חותמות, הראשונה ב־00:00, וכל פרק לפחות 10 שניות. Automatic Chapters מסומן כברירת מחדל, ופרקים ידניים גוברים — [YouTube Help (אומת בקובץ 06)](https://support.google.com/youtube/answer/9884579?hl=en).
- **חידונים ו־Courses:** יוצרים מוסיפים חידונים לחוויית הצפייה, ובתחילת 2025 נענו בממוצע 3.5 מיליון חידונים בחודש. ‏Courses מארגן סרטונים לתוכנית לימודים מדורגת, והוא לא מתואר כתכונת AI — [YouTube Blog, 28/4/2026](https://blog.youtube/news-and-events/youtube-empowering-learning-tools/). ב־I/O 2024 הוצג ניסוי של חידונים שנוצרים ב־AI, גם להרצאות ארוכות (תקציר חיפוש) — [TechCrunch, 14/5/2024](https://techcrunch.com/2024/05/14/google-ai-generated-quizzes-academic-videos-youtube).
- **ניסויי סיכום:** ב־2023 נבדקו סיכומי AI קצרים מתחת לכותרת, על מעט סרטונים באנגלית (תקציר חיפוש) — [Search Engine Land](https://searchengineland.com/youtube-ai-generated-summaries-search-watch-pages-430103). בסוף 2025 דווח על ניסוי של "video overviews" שמבוססים על שמע ותמונה (תקציר חיפוש; עמוד המקור החזיר 404).
- **חוזקות:** חינם. עברית. נמצא בתוך הנגן. חותמות זמן לחיצות.
- **חולשות:** רק בסרטונים נבחרים. חותמות מקורבות. אין ייצוא ("Exports nothing") — [Scrimba](https://scrimba.com/articles/best-ai-video-summarizers-2026/). צ'אט ולא מסמך. השיחות נשמרות ועשויות להיבדק בידי אדם.
- **מה לומדים:** המשתמשים כבר רגילים לשאול סרטון שאלות בעברית. הבידול צריך להיות במסמך מלא ומדויק, לא בצ'אט.

#### 2.2 Coursera Coach (והמיזוג עם Udemy)
- **מה זה:** "AI-powered personal tutor" שמעוגן בחומר הקורס. הוא הושק בבטא באפריל 2023. ב־2024 הממשק כוון ל־"video explanations, practice questions, pre-quiz prep, and course navigation". עד 23/6/2025: יותר מ־2.4 מיליון לומדים, 34 מיליון הודעות, ו־"26 different languages" — [Coursera Blog, 23/6/2025](https://blog.coursera.org/coach-wins-newsweek-ai-impact-award).
- **וידאו:** בהכרזה המקורית: "quick video lecture summaries and resources" ו־"a recommended clip" — [Coursera Blog, 13/4/2023](https://blog.coursera.org/new-products-tools-and-features-2023). **לא נמצא תיעוד רשמי עדכני** לחותמות זמן לחיצות. סקירה של צד שלישי מתארת "Instant lecture and slide summaries" ו־"Grounded references", אבל רק "for select courses" ובלי מקור רשמי — [Build Fast with AI](https://buildfastwithai.com/ai-tools/coursera-coach).
- **תוצאות:**
  - יותר ממיליון לומדים, "9.5% higher" הצלחה בניסיון הראשון בחידון, ו־11.6% יותר שיעורים בשעה — [Coursera Blog, 17/9/2024](https://blog.coursera.org/announcing-ai-powered-capabilities-enabling-educators-to-use-coursera-coach-to-deliver-interactive-personalized-instruction).
  - נשים, לומדים בתחילת הקריירה ולומדים בלי תואר משתמשים יותר — [Coursera Blog, 18/12/2024](https://blog.coursera.org/coursera-coach-providing-essential-learner-support).
- **השקות 2024–2026:**

  | תאריך | השקה |
  |---|---|
  | 9/2024 | Socratic dialogue למרצים, ו־Gemini כמודל הראשון ([Coursera Blog](https://blog.coursera.org/announcing-ai-powered-capabilities-enabling-educators-to-use-coursera-coach-to-deliver-interactive-personalized-instruction)) |
  | 6/10/2025 | אפליקציה בתוך ChatGPT ([Coursera Blog](https://blog.coursera.org/category/product-news/)) |
  | 23/3/2026 | סוכן למידה ב־Microsoft 365 Copilot ([Coursera Blog](https://blog.coursera.org/category/product-news/)) |
  | 3/6/2026 | אפליקציית מיקרו־למידה Ollie ([Coursera Blog](https://blog.coursera.org/category/product-news/)) |
  | 17/6/2026 | מחבר ל־Claude ([Coursera Blog](https://blog.coursera.org/category/product-news/)) |
  | 8/7/2026 | פיילוט Graded Labs ו־Role Play, קלט קולי ב־Role Play וב־Dialogue, "Audio Mode for Readings", MCP לארגונים ([Coursera Blog](https://blog.coursera.org/accelerating-product-and-platform-innovations-across-coursera-and-udemy/)) |
  | 9/9/2026 | Project Helix — פלטפורמת כישורים "AI-native" לארגונים, זמינות רחבה במחצית הראשונה של 2027 ([Coursera Blog](https://blog.coursera.org/announcing-project-helix/)) |

- **המיזוג:** הוכרז ב־17/12/2025 והושלם ב־11/5/2026 (תקציר חיפוש). המקור הראשוני הוא דוח ה־10-Q, שמתאר את חשבונאות המיזוג עם Udemy — [SEC 10-Q, 30/9/2026](https://www.sec.gov/Archives/edgar/data/0001651562/000165156226000072/cour-20260930.htm).
- **מחיר:** Coursera Plus ‏$239 לשנה — [Coursera, נבדק 9/11/2026](https://www.coursera.org/explore/coach).
- **עברית:** לא אומת (26 השפות לא פורטו). תרגומי מכונה של כתוביות ומבחנים ב־2023 היו בשבע שפות, בלי עברית — [Coursera Blog, 2023](https://blog.coursera.org/new-products-tools-and-features-2023).
- **ביקורות:** לא נמצאו תלונות עצמאיות. המספרים מגיעים מ־Coursera.
- **מה לומדים:** עוזר שמעוגן בקורס משפר מדדי השלמה, לפי החברה. ההפצה עוברת לתוך עוזרים כלליים (ChatGPT, Copilot, Claude).

#### 2.3 Udemy AI Assistant
- **מה זה:** בנגן הקורס לוחצים על אייקון AI למעלה מימין ושואלים "any questions you have about the course". יש פרומפט שמסכם את ההרצאה או את הקורס. אפשר להעלות תמונות (תקציר חיפוש) — [Udemy Support](https://support.udemy.com/hc/articles/27554582323863-Udemy-AI-Assistant-Frequently-Asked-Questions).
- **זמינות:**
  - רק בקורסים שהמרצים שלהם משתתפים ב־"GenAI program".
  - רק בשפות נבחרות, ושפת החשבון חייבת להתאים. המלצות הקורסים באנגלית.
  - כלול ב־Enterprise וב־Team בלי תוספת.
  - מקור: תקציר חיפוש — [Udemy Support](https://support.udemy.com/hc/articles/27554582323863-Udemy-AI-Assistant-Frequently-Asked-Questions).
  - הסיכומים עוזרים "navigate to the most relevant content quickly", והעוזר עונה רק על הקורס (תקציר חיפוש, אומת בקובץ 06) — [Udemy Business Support](https://business-support.udemy.com/hc/articles/26247590042647).
- **2026:** Role Play ב־Udemy Business קיבל יכולות וידאו ("Enhanced Role Play… video capabilities"), ולצוותים נוספו מסלולי למידה שנוצרים ב־AI — [Coursera Blog, 8/7/2026](https://blog.coursera.org/accelerating-product-and-platform-innovations-across-coursera-and-udemy/).
- **ביקורות:** לומד ב־Personal Plan כתב שהתכונות "still in beta" (תקציר חיפוש, קהילת Udemy).
- **פערי מידע:** עמודי Udemy חסומים לקריאה. לא אומתו חותמות זמן, עברית ומחיר.

#### 2.4 LinkedIn Learning — AI-powered coaching ו־Role Play
- **בנגן הקורס:** מפעילים מאייקון ניצוץ בפינה הימנית התחתונה של הנגן. הפרומפטים לדוגמה: "Summarize this lesson" ו־"What are the key takeaways?". לפי המדריך, "The AI uses course transcript information and learning context". זמין רק בקורסים נתמכים. בטלפון — רק ממסך הבית — [University of Arkansas KB](https://uark.teamdynamix.com/TDClient/33/Portal/KB/Article/1452/LinkedIn-Learning-How-to-Access-AI-Coaching-Chat).
- **עיגון:** התשובות נשענות על הספרייה, "even providing a link to the course", ומותאמות לתפקיד. העיבוד דרך Azure OpenAI. השיחות נשמרות שנה ולא משותפות עם המעסיק — [LinkedIn, נבדק 9/11/2026](https://business.linkedin.com/learn/resources/learning-tech/linkedin-learning-ai-powered-coaching). **לא נמצאו** חותמות זמן.
- **עדכונים:** "instant explanations and key takeaways" בקורס. כתוביות בתרגום מכונה ב־22 שפות חדשות, 46 בסך הכל. תרחישי Role Play של הארגון מספטמבר 2025 — [LinkedIn Product Updates](https://business.linkedin.com/learn/customer-success-center/product-updates/all-updates/q1-26).
- **Role Play ומחיר:**
  - מגבלות: 20 שיחות ביום, 10 בשעה, 5 בכל 5 דקות.
  - 5 שפות תרגול, בלי עברית. התרחישים מופיעים ב־M365 Copilot מיוני 2026.
  - מחיר ליחיד: כ־$39.99 לחודש, או $239.88 לשנה.
  - מקור: [Outdoo, 9–10/2026 (בלוג מתחרה)](https://www.outdoo.ai/blog/linkedin-learning-review-and-pricing).
- **ביקורות:** תלונות ב־G2 על מחיר ועומק התוכן, לא על ה־AI — [Outdoo](https://www.outdoo.ai/blog/linkedin-learning-review-and-pricing).

#### 2.5 Pluralsight Iris
- "Chat with Iris anytime". יש "knowledge checks embedded in course videos", ועזרה ב־"finding just the right moment within a course". סיכומי קורס מיועדים בעיקר למנהלים. "available as part of all individual and business plans". אין תאריך בעמוד — [Pluralsight, נבדק 9/11/2026](https://www.pluralsight.com/product/iris).

#### 2.6 DataCamp
- בשיעורי וידאו יש פאנל צד עם שתי לשוניות. Transcript: מקטעים שאפשר לקפוץ אליהם. Summary: "a concise note about the topic covered in the lesson" להעתקה למחברת. הסיכום זמין "in some of our courses" — [DataCamp Support](https://support.datacamp.com/hc/en-us/articles/38381206241175-What-is-the-AI-Coach-in-Video-lessons).

#### 2.7 Khan Academy — Khanmigo
- מורה ועוזר הוראה שלא נותן תשובות ישירות. **אין בעמוד המוצר אף יכולת שקשורה לסרטונים.** ההרשמה ללומדים ולהורים מוגבלת לגיל 18 ומעלה ולתושבי ארה"ב. למורים — חינם, במדינות זכאיות ובאנגלית — [khanmigo.ai, נבדק 9/11/2026](https://www.khanmigo.ai/). המחיר: $4 לחודש או $44 לשנה — [khanmigo.ai/pricing](https://www.khanmigo.ai/pricing). בבלוג של ספטמבר–אוקטובר 2026 אין עדכונים על Khanmigo — [Khan Academy Blog](https://blog.khanacademy.org/).

#### 2.8 edX — Xpert
- הושק ב־12/5/2023 על ChatGPT API. הוא יודע "generate brief, helpful summaries of video lectures and text material", אבל בפיילוט רק בתוכנית אחת של MITx — [edX Press, 12/5/2023](https://press.edx.org/edx-debuts-two-ai-powered-learning-assistants-built-on-chatgpt). **המצב ב־2026 לא נמצא.**

#### 2.9 MasterClass — On Call
- "roleplay and coaching from the AI of the world's best". לא מפורט אם התשובות מעוגנות בשיעורי הווידאו, ולא מצוינים מחיר או תאריך — [MasterClass On Call, נבדק 9/11/2026](https://oncall.masterclass.com/).

#### 2.10 Skillshare, Domestika, Codecademy, Brilliant
- **לא נמצא.** תקציב החיפוש נגמר לפני הבדיקה, וכתובות שנוחשו החזירו 404. לגבי Codecademy ו־Brilliant: הלמידה שם בעיקר אינטראקטיבית ולא בווידאו (הנחה, לא אומת).

### Inferences
- כל פלטפורמות הקורסים עובדות מתמליל ומחומרי הקורס, אצל אף אחת לא נמצא תיעוד לקריאת שקופיות או קוד מהמסך. העוזר שלהן נעול לקטלוג, לקורסים נבחרים ולשפות נבחרות. דובר עברית שלומד קורס באנגלית לא מקבל ניתוח בעברית.
- YouTube היא היחידה שמציעה עברית ואת ישראל רשמית, אבל בצורת צ'אט על סרטון אחד, עם חותמות מקורבות ובלי ייצוא.
- ההפצה של פלטפורמות הקורסים עוברת לעוזרים הכלליים (Coursera ב־ChatGPT, ב־Copilot וב־Claude). הלומד יעבוד יותר ויותר מתוך העוזר שלו, לא מתוך הנגן.

### Gaps
- Udemy: הטקסט המלא של עמודי העזרה (שפות, חותמות זמן, מגבלות) לא נקרא (403).
- Coursera Coach: אין תיעוד רשמי עדכני לסיכום וידאו או לחותמות זמן, ולא לרשימת 26 השפות.
- לא נבדקו Skillshare, Domestika, Codecademy, Brilliant ו־FutureLearn, ולא נבדק המצב הנוכחי של Xpert ב־edX.
- לא נמצאו ביקורות עצמאיות (Reddit, G2) על עוזרי ה־AI של Coursera, Udemy ו־LinkedIn: העמודים נטענים ב־JS, ותקציב החיפוש נגמר.

---

## 3. מטריצת השוואה — 24 מוצרים × 23 יכולות

### Takeaway
בטבלה רואים שהשורות "חזותי: כן" ו־"חותמת לחיצה ומדויקת" כמעט לא נפגשות. גם "עברית מלאה" נדירה בשילוב עם אחת מהן. אף שורה לא משלבת: ניתוח חזותי, עיגון לשנייה מדויקת, מסמך מלא, עברית מלאה, הרצאות ארוכות וקלט מכל מקור.

### Cited Findings
מקרא: ✓ = קיים ומתועד; ~ = חלקי, מותנה או מדווח רק בצד שלישי; ✗ = לא קיים לפי התיעוד; ? = לא נמצא. המקורות בעמודה האחרונה של כל שורה. אלה הסעיפים 1–2, וכל טענה מקושרת שם.

**טבלה א — קלט ועיבוד**

| מוצר | קלט וידאו | העלאת קובץ | אורך/גודל מרבי | עיבוד: תמליל או תמונה | בלי דיבור / שקופיות בלבד | תמלול עצמאי מול כתוביות קיימות | מקורות |
|---|---|---|---|---|---|---|---|
| Gemini Notebook | YouTube ציבורי עם כתוביות | ~ (mp4/avi/mpeg כאודיו) | 500 אלף מילים או 200MB למקור | תמליל בלבד | ✗ נכשל | כתוביות YouTube, ASR לקבצים | [Help](https://support.google.com/gemininotebook/answer/16215270?hl=en) |
| Gemini app | קובץ ו־YouTube | ✓ | 5 דק' חינם, שעה ב־Pro/Ultra, 2GB | תמונה ושמע (API: ‏1 FPS, ובקרוב agentic) | ~ (תמונה נקלטת) | מודל רב־אופני | [Help](https://support.google.com/gemini/answer/14903178?hl=en), [Blog](https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-agentic-video-in-gemini/) |
| Gemini in Chrome | כל מדיה שניגנה בדף | ✗ | ? | ? (לא מתועד) | ? | ? | [Help](https://support.google.com/gemini/answer/16283624?hl=en) |
| YouTube Ask (עמוד צפייה) | סרטוני YouTube נבחרים | ✗ | ? | ? (בקרוב agentic) | ? | ? | [Help](https://support.google.com/youtube/answer/14110396?hl=en) |
| Ask YouTube (חיפוש) | כל YouTube | ✗ | לא מיועד לסרטון יחיד | ? | ? | ? | [Help](https://support.google.com/youtube/answer/16943763?hl=en) |
| ChatGPT (צ'אט) | קובץ; YouTube לא אמין | ~ | 512MB לקובץ; "may not analyze the entire video" | "tools" (לא מתועד) | ? | ? | [Help (תקציר)](https://help.openai.com/en/articles/8400551), [BGR](https://bgr.com/tech/how-i-watch-youtube-with-chatgpt-even-though-it-cant-stream-videos) |
| ChatGPT — תוסף Chrome | דף YouTube פתוח | ✗ | ? | ? | ? | ? | [PiunikaWeb](https://piunikaweb.com/2026/07/31/chatgpt-chrome-extension-youtube-tab-support/) |
| ChatGPT Record mode | הקלטת שמע (Mac) | ✗ | ? (נבדק שעה ורבע) | שמע בלבד | ✗ | ASR | [Avoma](https://www.avoma.com/blog/chatgpt-record-mode) |
| Claude (claude.ai) | ✗ | ✗ (רק מסמכים ותמונות) | — | — | — | — | [Help](https://support.claude.com/en/articles/8241126-how-can-i-upload-files-to-claude-ai) |
| Claude in Chrome / Cowork | דף פתוח; הקלטת מסך משלך | ✗ | ? | ? | ? | ? | [Blog](https://claude.com/blog/claude-in-chrome-generally-available), [SEJ](https://www.searchenginejournal.com/anthropics-claude-can-now-watch-a-video-and-learn-your-job/583053/) |
| Perplexity (+Comet) | קובץ; YouTube ב־Comet | ✓ | 40MB | תמליל ותיוג דוברים, "visual… aren't indexed" | ✗ | ASR | [Help](https://www.perplexity.ai/help-center/en/articles/10354807-file-uploads) |
| Edge Copilot | YouTube ו־Vimeo | ✗ | ? | תמליל | ✗ (דורש כתוביות) | כתוביות קיימות | [Techlicious](http://www.techlicious.com/blog/copilot-for-edge-video-highlights-feature/) |
| Copilot ב־Clipchamp/Stream | וידאו ארגוני | ✓ (בפלטפורמה) | ? | תמליל, יותר מ־100 מילים | ✗ | תמליל שנוצר בפלטפורמה | [Support](https://support.microsoft.com/en-us/office/0b531ea9-2d9d-4830-97e4-2c1b2b8ca31d) |
| M365 Video recap | הקלטת Teams | ✗ | 10 דק' ומעלה | תמליל לבחירת קטעים | ✗ | תמליל Teams | [Support](https://support.microsoft.com/en-us/microsoft-365-copilot/how-video-recap-in-microsoft-365-copilot-works) |
| Grok | קובץ; "any video" | ~ | 150MB בצ'אט (צד שלישי) | ? (מוכרז) | ? | ? | [remio](https://www.remio.ai/post/grok-can-analyze-any-video-but-the-hard-part-is-proving-it-understands-one), [Atlas Cloud](https://www.atlascloud.ai/blog/guides/how-to-upload-video-to-grok-xai-chat) |
| Meta AI | עריכה בלבד | ~ (10 שנ') | 10 שנ' | ✗ ניתוח | — | — | [Meta Help](https://www.meta.com/help/artificial-intelligence/996454095987249/) |
| Le Chat | אודיו בלבד | ✗ | 30–40 דק' אודיו | שמע | — | ASR | [Mistral](https://mistral.ai/news/voxtral) |
| Coursera Coach | קורסי Coursera | ✗ | — | חומרי קורס | ? | — | [Blog](https://blog.coursera.org/coach-wins-newsweek-ai-impact-award) |
| Udemy AI Assistant | קורסים משתתפים | ✗ | — | חומרי קורס | ? | — | [Support (תקציר)](https://support.udemy.com/hc/articles/27554582323863-Udemy-AI-Assistant-Frequently-Asked-Questions) |
| LinkedIn Learning | קורסים נתמכים | ✗ | — | "course transcript" | ? | — | [UArk KB](https://uark.teamdynamix.com/TDClient/33/Portal/KB/Article/1452/LinkedIn-Learning-How-to-Access-AI-Coaching-Chat) |
| Pluralsight Iris | קורסי Pluralsight | ✗ | — | ? | ? | — | [Pluralsight](https://www.pluralsight.com/product/iris) |
| DataCamp | שיעורי וידאו | ✗ | — | תמליל וסיכום מוכן | ? | — | [Support](https://support.datacamp.com/hc/en-us/articles/38381206241175-What-is-the-AI-Coach-in-Video-lessons) |
| Khanmigo | ✗ (לא מתועד) | ✗ | — | — | — | — | [khanmigo.ai](https://www.khanmigo.ai/) |
| edX Xpert | קורסי edX (פיילוט 2023) | ✗ | — | ? | ? | — | [edX Press](https://press.edx.org/edx-debuts-two-ai-powered-learning-assistants-built-on-chatgpt) |

**טבלה ב — פלטים, עיגון ולמידה**

| מוצר | סיכום/דוח | צ'אט | ציטוט לקטע | חותמת לחיצה בנגן | דיוק חותמות מדווח | כלי למידה | Audio/Video overview | סינתזה בין סרטונים | ייצוא | מקורות |
|---|---|---|---|---|---|---|---|---|---|---|
| Gemini Notebook | ✓ דוחות ו־study guide | ✓ | ✓ לתמליל | ✗ לא מתועד | — | ✓ כרטיסיות, מבחנים, מפות | ✓ שניהם | ✓ עד 50–600 מקורות | ~ הורדת אודיו ווידאו | [Help](https://support.google.com/gemininotebook/answer/16454555?hl=en), [Blog 2024](https://blog.google/innovation-and-ai/products/notebooklm-audio-video-sources/) |
| Gemini app | ~ בצ'אט | ✓ | ? | ~ מדווח | ? | ~ Guided/Study (לא נבדק) | ✗ | ~ עד 10 קבצים | ? | [Help](https://support.google.com/gemini/answer/14903178?hl=en) |
| Gemini in Chrome | ✓ | ✓ | ? | ~ (פרקים ב־YouTube) | ~ "good" (Reddit, לא אומת) | ~ חידון מכרטיסיות (ארה"ב והודו) | ✗ | ~ עד 10 כרטיסיות | ✗ | [Gadgety](https://www.gadgety.co.il/363773/chrome-gemini-israel/), [Gagadget](https://gagadget.com/en/727536-google-chrome-gets-gemini-quizzes-cross-device-sync-and-podcast-summaries/) |
| YouTube Ask | ~ בצ'אט | ✓ | — | ✓ | "rough/approximate" | ✗ (חידונים — של היוצר) | ✗ | ✗ | ✗ | [How-To Geek](https://www.howtogeek.com/youtubes-ask-button-just-solved-the-tutorial-problemand-i-wasnt-expecting-to-say-that/), [Android Police](https://www.androidpolice.com/ai-in-youtube-useful-for-this-one-feature/) |
| Ask YouTube | ✓ סקירת נושא | ✓ | קטעים | ✓ בתחילת הקטע הרלוונטי | ? | ✗ | ✗ | ✓ בין סרטונים | ✗ | [Help](https://support.google.com/youtube/answer/16943763?hl=en) |
| ChatGPT (צ'אט) | ✓ | ✓ | ? | ✗ | — | ✓ Study mode | ✗ | ~ Projects | ~ | [MultiLingual](https://multilingual.com/openais-study-mode/) |
| ChatGPT — תוסף Chrome | ✓ | ✓ | ? | ? | — | ✗ | ✗ | ~ כרטיסיות | ✗ | [PiunikaWeb](https://piunikaweb.com/2026/07/31/chatgpt-chrome-extension-youtube-tab-support/) |
| ChatGPT Record mode | ✓ החלטות ומשימות | ✓ | ✗ | ✗ | "did not work" | ✗ | ✗ | ✗ | ~ תמליל חלקי | [Avoma](https://www.avoma.com/blog/chatgpt-record-mode) |
| Claude (claude.ai) | ✓ מטקסט ותמונות | ✓ | ? | ✗ | — | ~ Learning mode (Education) | ✗ | ✓ במסמכים | ✓ קבצים | [Pricing](https://claude.com/pricing) |
| Perplexity (+Comet) | ✓ | ✓ | ✓ מקורות רשת | ~ ב־Comet | ? | ✗ | ✗ | ? | ? | [AI Spotlight](https://ai-spotlight.beehiiv.com/p/stop-clicking-let-your-browser-work-for-you) |
| Edge Copilot | ✓ ו־outline | ✓ | — | ✓ outline לחיץ | 63–74% (2023, צד שלישי) | ✗ | ✗ | ✗ | ✗ | [Techlicious](http://www.techlicious.com/blog/copilot-for-edge-video-highlights-feature/) |
| Copilot ב־Clipchamp/Stream | ✓ | ✓ | ✓ | ✓ "linked timestamps" | ? | ✗ | ✗ | ✗ | ? | [Support](https://support.microsoft.com/en-us/office/0b531ea9-2d9d-4830-97e4-2c1b2b8ca31d) |
| M365 Video recap | ✓ סרטון של קטעים | ✗ | — | ~ קטעים מקוריים | ? | ✗ | ~ וידאו | ✗ | ✗ ("can't be shared") | [Support](https://support.microsoft.com/en-us/microsoft-365-copilot/how-video-recap-in-microsoft-365-copilot-works) |
| Grok | ? | ✓ | ? | ? | ? | ✗ | ✗ | ? | ? | [remio](https://www.remio.ai/post/grok-can-analyze-any-video-but-the-hard-part-is-proving-it-understands-one) |
| Meta AI | ✗ | — | — | — | — | — | — | — | — | [Meta Help](https://www.meta.com/help/artificial-intelligence/996454095987249/) |
| Le Chat | ✓ מאודיו | ✓ | ? | ✗ | — | ✗ | ✗ | ? | ? | [Mistral](https://mistral.ai/news/voxtral) |
| Coursera Coach | ~ (הובטח ב־2023) | ✓ | ~ "recommended clip" (2023) | ? | ? | ✓ תרגול ודיאלוג | ✗ | ✗ | ✗ | [2023](https://blog.coursera.org/new-products-tools-and-features-2023) |
| Udemy AI Assistant | ✓ הרצאה וקורס | ✓ | ? | ? | ? | ✗ (Role Play ב־Business) | ✗ | ✗ | ✗ | [Support (תקציר)](https://support.udemy.com/hc/articles/27554582323863-Udemy-AI-Assistant-Frequently-Asked-Questions) |
| LinkedIn Learning | ✓ שיעור ו־takeaways | ✓ | קישור לקורס | ✗ | — | ✓ Role Play | ✗ | ~ בספרייה | ✗ | [LinkedIn](https://business.linkedin.com/learn/resources/learning-tech/linkedin-learning-ai-powered-coaching) |
| Pluralsight Iris | ~ (למנהלים) | ✓ | "the right moment" | ? | ? | ✓ knowledge checks | ✗ | ? | ✗ | [Pluralsight](https://www.pluralsight.com/product/iris) |
| DataCamp | ✓ סיכום שיעור | ? | — | ✓ מקטעי תמליל | ? | ✗ | ✗ | ✗ | ~ העתקה | [Support](https://support.datacamp.com/hc/en-us/articles/38381206241175-What-is-the-AI-Coach-in-Video-lessons) |
| Khanmigo | ✗ (וידאו) | ✓ | — | — | — | ✓ | ✗ | ✗ | ✗ | [khanmigo.ai](https://www.khanmigo.ai/) |
| edX Xpert | ~ (פיילוט) | ✓ | ? | ? | ? | ✓ חידון | ✗ | ✗ | ✗ | [edX Press](https://press.edx.org/edx-debuts-two-ai-powered-learning-assistants-built-on-chatgpt) |
| MasterClass On Call | ? | ✓ | ? | ? | ? | ✓ Role Play | ✗ | ✗ | ✗ | [On Call](https://oncall.masterclass.com/) |

**טבלה ג — שפה, זמינות, מחיר, פרטיות והשקות**

| מוצר | עברית | ישראל | מחיר כניסה (נבדק) | חינמי שימושי | פרטיות/אימון | השקה מרכזית 2026 | מקורות |
|---|---|---|---|---|---|---|---|
| Gemini Notebook | ✓ אודיו, וידאו ותמלול; Cinematic ו־Join רק באנגלית | ✓ | חינם; AI Plus ‏$4.99 | ✓ 50 מקורות; בחינוך 3 סקירות וידאו ביום | לא לאימון בלי משוב; Edu בלי בדיקה אנושית | Cinematic ‏(3/2026), שם חדש (7/2026) | [Help](https://support.google.com/gemininotebook/answer/16164461?hl=en), [Plans](https://gemini.google/subscriptions/) |
| Gemini app | ✓ | ✓ | חינם; Pro ‏$19.99 | ~ 5 דק' וידאו | Privacy Notice | agentic video (API ‏9/2026) | [Help](https://support.google.com/gemini/answer/13575153?hl=en) |
| Gemini in Chrome | ✗ (אנגלית בישראל) | ✓ מ־6/2026 | חינם | ✓ | שיתוף כרטיסייה כברירת מחדל | מדיה מכל אתר (9/2026) | [Help](https://support.google.com/gemini/answer/16283624?hl=en), [Gadgety](https://www.gadgety.co.il/363773/chrome-gemini-israel/) |
| YouTube Ask | ✓ | ✓ | חינם | ✓ | 45 יום; בדיקה אנושית עד 3 שנים | טלוויזיות (4/2026) | [Help](https://support.google.com/youtube/answer/14110396?hl=en) |
| Ask YouTube | ✗ (אנגלית) | ✗ (ארה"ב) | חינם | — | בדיקה אנושית, 3 שנים | הרחבה בארה"ב (7/2026) | [Help](https://support.google.com/youtube/answer/16943763?hl=en) |
| ChatGPT | ? | ? | Plus ‏$20 | ~ | Record mode: אימון ב־Plus/Pro (תקציר) | תוסף Chrome; סגירת Atlas (7–8/2026) | [PPC Land](https://ppc.land/openai-kills-atlas-browser-folds-it-into-new-chatgpt-work-agent/) |
| Claude | ~ (לא בטבלת הביצועים) | ✓ | Pro ‏$17–$20 | ✗ (אין וידאו) | Education: לא לאימון | Claude in Chrome GA ‏(8/2026), Record a Skill ‏(7/2026) | [Countries](https://www.anthropic.com/supported-countries), [Pricing](https://claude.com/pricing) |
| Perplexity | ? | ? | Pro ‏$20 | ~ מכסה שבועית | ? | Comet ל־iOS ‏(3/2026) | [Help](https://www.perplexity.ai/help-center/en/articles/10354807-file-uploads) |
| Copilot (Edge, Clipchamp, recap) | ✓ בצ'אט; recap באנגלית | ? | רישיון M365 (לא אומת) | ~ Edge חינם | DLP; recap בלי שכפול הסרטון | Edge for Business עם YouTube ‏(GA ‏2/2026) | [Languages](https://support.microsoft.com/en-us/topic/supported-languages-for-microsoft-copilot-94518d61-644b-4118-9492-617eea4801d8) |
| Grok | ? | ? | מ־$8 | ? | ? | "any video" ‏(8/2026) | [OneFile](https://onefileapp.com/blog/ai-file-upload-limits-compared) |
| Meta AI | ? | ? | — | — | ? | — | [Meta Help](https://www.meta.com/help/artificial-intelligence/996454095987249/) |
| Le Chat | ✗ (לא מוזכרת) | ? | ? | ? | ? | Voxtral Transcribe 2 ‏(2/2026) | [Mistral](https://mistral.ai/news/voxtral) |
| Coursera Coach | ? (26 שפות) | ? | Plus ‏$239 לשנה | ✗ | ? | Role Play קולי, Helix ‏(2026) | [Coursera](https://www.coursera.org/explore/coach) |
| Udemy AI Assistant | ? (שפות נבחרות) | ? | ? | ✗ | ? | Role Play עם וידאו ‏(7/2026) | [Coursera Blog](https://blog.coursera.org/accelerating-product-and-platform-innovations-across-coursera-and-udemy/) |
| LinkedIn Learning | ? (46 שפות כתוביות) | ? | כ־$39.99 לחודש | ✗ | שמירה שנה; לא למעסיק | Role Play ב־M365 ‏(6/2026) | [Outdoo](https://www.outdoo.ai/blog/linkedin-learning-review-and-pricing) |
| Pluralsight Iris | ? | ? | ? | ✗ | ? | ? | [Pluralsight](https://www.pluralsight.com/product/iris) |
| Khanmigo | ✗ | ✗ ללומדים (ארה"ב) | $4 לחודש | מורים חינם | ? | — | [Pricing](https://www.khanmigo.ai/pricing) |

### Inferences
- שלוש העמודות "חזותי", "חותמת לחיצה מדויקת" ו־"עברית מלאה" לא מתקיימות יחד באף שורה. זה הבסיס להזדמנות (סעיף 4).
- "ייצוא" כמעט ריק בכל הטבלה. התוצרים נשארים בתוך הכלי (צ'אט, מחברת, נגן).
- המחיר אינו המחסום: מסלולים חינמיים נדיבים כבר קיימים (YouTube Ask, Gemini Notebook, Gemini in Chrome). הערך צריך לבוא מהאיכות והשלמות של התוצר.

### Gaps
- תאים רבים מסומנים "?" כי התיעוד לא מתאר את התכונה. הם לא אומתו בבדיקה מעשית, ובדיקה ידנית מול סרטון הרצאה אחד בכל מוצר הייתה משלימה אותם.
- הדיוק של חותמות הזמן לא נמדד באף מוצר. יש רק התרשמויות ("rough", "did not work") והערכה ישנה של צד שלישי (63–74%).

---

## 4. השטח הלבן — מה הענקיות עדיין עושות רע עבור סטודנט או איש עסקים שרוצים לקרוא ניתוח מלא במקום לצפות בהרצאה

### Takeaway
הענקיות בנו כלים לשאלה מהירה על סרטון: צ'אט, סיכום קצר, חידון וסקירה קולית. אף אחת מהן לא מציעה מסמך שלם ונאמן של הרצאה ארוכה, שכולל גם את מה שמוצג על המסך, מעוגן לשנייה מדויקת בכל טענה, ונכתב בעברית מלאה. החלון הזה עלול להצטמצם: Google מביאה "צפייה סוכנית" לאפליקציה ול־YouTube. לכן הבידול צריך להישען על כמה צירים יחד: עומק, שלמות, עברית, עיגון וייצוא.

### Cited Findings
**א. מה שעל המסך לא נכנס לניתוח**
- Gemini Notebook מייבא "only the text transcript". קובץ וידאו מתקבל כאודיו בלבד, וסרטון בלי דיבור לא נתמך — [Help](https://support.google.com/gemininotebook/answer/16215270?hl=en).
- ב־Perplexity: "visual scenes from video files aren't indexed" — [Help](https://www.perplexity.ai/help-center/en/articles/10354807-file-uploads).
- Copilot ב־Clipchamp עונה רק "for any video with a transcript" — [Support](https://support.microsoft.com/en-us/office/0b531ea9-2d9d-4830-97e4-2c1b2b8ca31d).
- ב־Edge, ה־outline דורש כתוביות — [Techlicious](http://www.techlicious.com/blog/copilot-for-edge-video-highlights-feature/).
- ב־LinkedIn Learning העוזר נשען על "course transcript" — [UArk KB](https://uark.teamdynamix.com/TDClient/33/Portal/KB/Article/1452/LinkedIn-Learning-How-to-Access-AI-Coaching-Chat).
- בבדיקות עצמאיות: הסבר שנמצא ב־"imagens, gráficos ou demonstrações" שלא נאמרים בקול הולך לאיבוד — [Canaltech, 31/10/2026](https://canaltech.com.br/inteligencia-artificial/como-usar-youtube-com-gemini-notebook-para-estudar/). גם Gemini עצמו "falls short with visual information" (2025) — [WIRED דרך CO/AI](https://getcoai.com/news/4-tips-on-using-gemini-ai-to-summarize-youtube-videos).

**ב. העיגון לזמן מקורב, מוביל לטקסט, או לא עובד**
- ב־Gemini Notebook הציטוט מקושר לתמליל — [Blog](https://blog.google/innovation-and-ai/products/notebooklm-audio-video-sources/).
- ב־YouTube Ask הזמנים "rough"/"approximate" — [Android Police](https://www.androidpolice.com/ai-in-youtube-useful-for-this-one-feature/).
- ב־Record mode: "Timestamps did not work" — [Avoma](https://www.avoma.com/blog/chatgpt-record-mode).
- המשתמשים מעריכים את אפשרות האימות: "hovering over the citation next to each claim" — [XDA](https://www.xda-developers.com/i-dont-watch-youtube-videos-anymore-i-consume-them-using-notebooklm/).

**ג. שלמות ונאמנות — הכלים לא מבטיחים שלא הושמט דבר**
- "não substitui completamente" ו־"risco de erros", כולל השמטה של הסתייגות — [Canaltech](https://canaltech.com.br/inteligencia-artificial/como-usar-youtube-com-gemini-notebook-para-estudar/).
- חשש מדילוג על "subtle bits of knowledge or warnings" — [How-To Geek](https://www.howtogeek.com/youtubes-ask-button-just-solved-the-tutorial-problemand-i-wasnt-expecting-to-say-that/).
- ChatGPT "may not analyze the entire video" (תקציר חיפוש) — [OpenAI Help](https://help.openai.com/en/articles/8400551).
- Ask YouTube "not built to sit inside one two-hour lecture" — [ScreenApp (בלוג מתחרה)](https://screenapp.io/blog/ask-youtube).

**ד. עברית — היכולות המתקדמות באנגלית בלבד**
- Cinematic Video Overviews באנגלית בלבד — [Help](https://support.google.com/gemininotebook/answer/16454555?hl=en).
- ב־Audio Overviews, האורך Longer והמצב האינטראקטיבי באנגלית בלבד — [Help](https://support.google.com/gemininotebook/answer/16212820?hl=en).
- Gemini in Chrome בישראל באנגלית בלבד — [גאדג'טי](https://www.gadgety.co.il/363773/chrome-gemini-israel/); [Help](https://support.google.com/gemini/answer/16283624?hl=en).
- Ask YouTube באנגלית ובארה"ב — [Help](https://support.google.com/youtube/answer/16943763?hl=en).
- Video recap באנגלית — [Support](https://support.microsoft.com/en-us/microsoft-365-copilot/how-video-recap-in-microsoft-365-copilot-works).
- Role Play של LinkedIn ב־5 שפות — [Outdoo](https://www.outdoo.ai/blog/linkedin-learning-review-and-pricing).
- ‏Udemy רק "in select languages" (תקציר חיפוש) — [Udemy Support](https://support.udemy.com/hc/articles/27554582323863-Udemy-AI-Assistant-Frequently-Asked-Questions).
- עברית מלאה מאומתת רק ב־YouTube Ask, באפליקציית Gemini, בסקירות של Gemini Notebook ובצ'אט של Copilot (סעיפים 1–2).

**ה. גישה למקור — קשה להכניס את הסרטון לכלי**
- YouTube: רק סרטונים ציבוריים עם כתוביות. סרטון חדש עלול להיכשל ב־72 השעות הראשונות. "unsupported video language" — [Help](https://support.google.com/gemininotebook/answer/16215270?hl=en).
- ייבוא שנתקע בלי שגיאה — [35gan](https://35gan.substack.com/p/notebooklm-youtube-source-upload).
- קורסים מאחורי התחברות לא נקלטים — [HoverNotes (בלוג מתחרה)](https://hovernotes.io/en/blog/add-any-video-to-notebooklm-with-hovernotes).
- התמלילים של YouTube חסומים לעוזרים של צד שלישי — [BGR](https://bgr.com/tech/how-i-watch-youtube-with-chatgpt-even-though-it-cant-stream-videos).

**ו. אורך וגודל**
- Gemini app: 5 דקות בחינם ושעה במסלול בתשלום — [Help](https://support.google.com/gemini/answer/14903178?hl=en).
- Perplexity: ‏40MB — [Help](https://www.perplexity.ai/help-center/en/articles/10354807-file-uploads).
- Grok: ‏150MB (צד שלישי) — [Atlas Cloud](https://www.atlascloud.ai/blog/guides/how-to-upload-video-to-grok-xai-chat).
- Claude: אין וידאו בכלל — [Help](https://support.claude.com/en/articles/8241126-how-can-i-upload-files-to-claude-ai).

**ז. התוצר נשאר בתוך הכלי**
- ‏YouTube Ask "Exports nothing" — [Scrimba](https://scrimba.com/articles/best-ai-video-summarizers-2026/).
- Video recap: "aren't editable" ו־"can't be shared" — [Support](https://support.microsoft.com/en-us/microsoft-365-copilot/how-video-recap-in-microsoft-365-copilot-works).
- מעבר ידני לתמליל מאבד את חותמות הזמן הלחיצות — [Scrimba](https://scrimba.com/articles/best-ai-video-summarizers-2026/).

**ח. פרטיות, זכאות ועלות לישראלים**
- שיחות YouTube עשויות להיבדק בידי אדם ונשמרות עד 3 שנים — [Help](https://support.google.com/youtube/answer/14110396?hl=en).
- ההטבה ל־AI Pro מוגבלת לסטודנטים בארה"ב — [gemini.google/students](https://gemini.google/students/).
- Khanmigo ללומדים בארה"ב בלבד — [khanmigo.ai](https://www.khanmigo.ai/).

**ט. עומק — סינתזה וביקורת**
- הביקורת קיימת בעיקר כפורמט קולי ("The Critique": משוב של שני מנחים) — [Help](https://support.google.com/gemininotebook/answer/16212820?hl=en).
- התוצרים הכתובים הם דוחות, study guides וכרטיסיות — [one-pager](https://services.google.com/fh/files/misc/gemininotebook_gfe_one_pager.pdf).
- לא נמצא בסקירה מוצר שמפיק בכתב עקרונות, "תמונה גדולה" וביקורת מנומקת על הטיעון של ההרצאה, עם הפניה לרגע המדויק בכל טענה.

**י. המגמה — היכן הפער ייסגר**
- Google: ‏agentic video ב־API מ־1/9/2026, באפליקציה "soon", וב־Ask של YouTube "in the coming months" — [Google Blog](https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-agentic-video-in-gemini/).
- Chrome: הבנת מדיה מכל אתר מ־9/2026 — [Gagadget](https://gagadget.com/en/727536-google-chrome-gets-gemini-quizzes-cross-device-sync-and-podcast-summaries/).
- Grok: "any video" ‏(8/2026) — [remio](https://www.remio.ai/post/grok-can-analyze-any-video-but-the-hard-part-is-proving-it-understands-one).

### Inferences
ההקשר שלנו: THE SNOWBALL Studio — PWA בעברית. ניתוח מאודיו ומהמסך (OCR של שקופיות, גרפים וקוד), חותמות זמן מדויקות מתזמון ברמת המילה, מודלי Claude בלבד, וחילוץ בשרת CPU שלנו.

**ההזדמנויות (ניסוח כללי):**
1. **"קריאה במקום צפייה" כתוצר הראשי, לא צ'אט.** מסמך שלם ומחולק לפי מהלך ההרצאה, עם סימון כיסוי ("כל הקטעים נותחו", ואילו קטעים דלים). זה עונה על "לא הושמט דבר", שאף אחד מהמוצרים לא מבטיח.
2. **הערוץ החזותי כשווה ערך לשמע.** OCR של שקופיות, נוסחאות, טבלאות, גרפים וקוד, משולבים בטקסט עם ציון "מוצג על המסך" לעומת "נאמר". זה הפער הבולט בכל המוצרים שמבוססים על תמליל. Claude מקבל עד 600 תמונות לבקשת API, כך שפריימים ושקופיות שחולצו בשרת נכנסים ישירות — [Claude Docs](https://platform.claude.com/docs/en/build-with-claude/vision).
3. **עיגון לשנייה, ובלחיצה.** כל טענה מקושרת לרגע שבו נאמרה או הוצגה, לפי תזמון המילים, ולא לקטע תמליל או לזמן מקורב. כדאי להראות את השורה המקורית בריחוף, כי המשתמשים מעריכים אימות מהיר.
4. **עברית מלאה מקצה לקצה.** הרצאה באנגלית הופכת לניתוח בעברית תקנית, ב־RTL, עם מונחים מקצועיים כפולים (עברית ואנגלית). זה במיוחד במקומות שבהם הענקיות נשארות באנגלית בישראל.
5. **קליטה מכל מקור.** קובץ, קישור, הקלטת Zoom או וובינר, וגם סרטון בלי כתוביות, בזכות תמלול משלנו, בגבולות החוק (קובץ 07). הרצאות של 2–3 שעות בלי מגבלת 5 דקות, שעה או 40MB.
6. **ייצוא ובעלות.** ייצוא לקורא EPUB (Academy), ל־PDF ול־Markdown, עם הקישורים לזמן. החומר נשמר אצל המשתמש, ובשפה ברורה על שמירה ופרטיות.
7. **עומק אנליטי בכתב.** עקרונות, מודל מנטלי, ביקורת מנומקת, נקודות עיוורות ושאלות פתוחות, ולכל אחד הפניה לרגע. זה המקום שבו מודל חזק תורם יותר מהיכולת "לראות".
8. **תמחור לישראלים.** ההטבות לסטודנטים של הענקיות מוגבלות לארה"ב. מסלול סטודנטים מקומי יכול להוות יתרון, וזו החלטה עסקית שדורשת אישור.

**סיכון:** אם צפייה סוכנית חינמית תגיע ל־YouTube Ask ולאפליקציית Gemini בעברית, הבידול בשורות 2 ו־5 יצטמצם. שורות 1, 3, 4, 6 ו־7 נשארות.

### Gaps
- לא נבדק בפועל (hands-on) מוצר אחד מול הרצאה מלאה עם שקופיות, ולכן אין מדד אובייקטיבי לשלמות או לדיוק העיגון.
- לא ידוע מתי בדיוק agentic video יגיע לאפליקציה ול־YouTube Ask, והאם גם בעברית.
- לא נמצאו מתחרים ישראליים או כלים ייעודיים לעברית בקטגוריה. תקציב החיפוש נגמר לפני הבדיקה.

---

## 5. זנב ארוך — עוזרים ותכונות נוספים שנתקלנו בהם

### Takeaway
מסביב לענקיות יש שכבה של כלים קטנים שסוגרים את הפערים שלהן: צילומי מסך עם זמן, תמלול לפני שליחה ל־Claude, ושאלות על סרטון בודד עם חותמות. זה אות לביקוש לאותם צירים: מה שעל המסך, עיגון וקליטה.

### Cited Findings
- **Notebooks in Gemini:** מחברות בתוך אפליקציית Gemini, עם סנכרון מלא למוצר העצמאי. בלי סקירות וידאו — [nlmtools](https://www.nlmtools.com/blog/gemini-notebook-vs-notebooks-in-gemini).
- **AI Mode בחיפוש (מחברות):** מסונכרן ממחברות מאוגוסט 2026. בלי Audio/Video Overviews — [nlmtools](https://www.nlmtools.com/blog/gemini-notebook-vs-notebooks-in-gemini).
- **Gemini API ‏agentic video:** חזרה סוכנית לקטעים, קצב פריימים משתנה, אודיו ותמליל. מיועד למפתחים — [Google Blog, 1/9/2026](https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-agentic-video-in-gemini/).
- **ChatGPT Work:** סוכן ענן שמחליף חלק מ־Atlas (מ־9/7/2026) — [PPC Land](https://ppc.land/openai-kills-atlas-browser-folds-it-into-new-chatgpt-work-agent/).
- **OpenAI Codex "Record and Replay":** הקלטת מסך הופכת לפעולה חוזרת. ב־Mac, מ־18/6/2026 — [SEJ](https://www.searchenginejournal.com/anthropics-claude-can-now-watch-a-video-and-learn-your-job/583053/).
- **Claude Cowork "Record a Skill":** הקלטת מסך עם קריינות הופכת למיומנות (21/7/2026) — [Let's Data Science](https://letsdatascience.com/blog/claude-cowork-record-a-skill-teach-ai-by-demonstration).
- **Claude Motion (beta):** מופיע במסלולי Team/Enterprise. לפי צד שלישי, אנימציות מקוד (8/10/2026, תקציר חיפוש) — [claude.com/pricing](https://claude.com/pricing).
- **מחבר Panopto ל־Claude:** תמלילי הרצאות של המוסד בתוך Claude — [Anthropic, 9/7/2025](https://anthropic.com/news/advancing-claude-for-education).
- **Coursera בתוך עוזרים:** ‏ChatGPT ‏(10/2025), Microsoft 365 Copilot ‏(3/2026), Claude ‏(6/2026) — [Coursera Blog](https://blog.coursera.org/category/product-news/).
- **Coursera Ollie:** אפליקציית מיקרו־למידה ל־Coursera Plus (3/6/2026) — [Coursera Blog](https://blog.coursera.org/category/product-news/).
- **Project Helix (Coursera ו־Udemy):** פלטפורמת כישורים AI לארגונים, במחצית הראשונה של 2027 — [Coursera Blog](https://blog.coursera.org/announcing-project-helix/).
- **Edge for Business:** Copilot Chat מעוגן בסרטוני YouTube פתוחים (GA ‏2/2026) — [RM499424](https://mc.merill.net/message/RM499424).
- **Copilot בהקלטות OneDrive:** תקציר של הקלטת פגישה וסימון אזכורים — [OneDrive Blog](https://techcommunity.microsoft.com/blog/OneDriveBlog/copilot--onedrive-intelligence-in-every-click-inspiration-in-every-memory/4458882).
- **Voxtral Transcribe 2 (Mistral):** תמלול עם זיהוי דוברים וחותמות זמן (2/2026, תקציר חיפוש) — [Mistral](https://mistral.ai/news/voxtral-transcribe-2).
- **HoverNotes:** הערות וצילומי מסך עם חותמת זמן בזמן הצפייה, וייצוא ל־Markdown ל־Gemini Notebook — [HoverNotes (בלוג מתחרה)](https://hovernotes.io/en/blog/add-any-video-to-notebooklm-with-hovernotes).
- **ScreenApp:** שאלות על סרטון בודד עם חותמות זמן לחיצות, וגם על קבצים וקישורים לא רשומים — [ScreenApp (בלוג מתחרה)](https://screenapp.io/blog/ask-youtube).
- **Creative Claw:** כלי ל־Claude שבונה גיליון פריימים עם זמנים ותמלול ברמת מילה, בתשלום לפי קרדיטים — [Creative Claw](https://creativeclaw.co/claude/watch-videos/).
- **VOMO:** תמליל עם חותמות זמן מקישור, בלי צורך בכתוביות, להדבקה ב־Claude — [VOMO](https://vomo.ai/guide/can-claude-analyze-video).
- **YouTube-to-NotebookLM (תוסף Chrome):** פלייליסט או ערוץ שלם למחברת. כ־500 אלף משתמשים (אומת בקובץ 06) — [Chrome Web Store](https://chromewebstore.google.com/detail/youtube-to-notebooklm-you/kobncfkmjelbefaoohoblamnbackjggk).
- **צינור מקומי (Downloader → Buzz → NotebookLM):** פתרון של משתמשים לכשלי ייבוא ולמגבלת 200MB — [35gan](https://35gan.substack.com/p/notebooklm-youtube-source-upload).
- **צ'אטבוט YouTube עצמאי על GPT-5.4 mini:** פוסט ב־r/ChatGPT. המגיבים ענו ש־Gemini ו־YouTube כבר עושים את זה (27/3/2026, תקציר חיפוש).
- **Meta Edits assistant:** ניתוח מדדי חשבון ליוצרים בארה"ב, לא של תוכן הסרטון (30/9/2026, תקציר חיפוש).
- **Gemini Live על סרטוני YouTube:** דווח על ניסוי (כותרת בלבד, Android Central; לא אומת).

### Inferences
- רוב הכלים הקטנים בנויים כ"תוסף" לענקיות: הם מזינים את Gemini Notebook או את Claude. מוצר שעושה את כל השרשרת בעצמו (קליטה, תמלול, מסך, ניתוח וקורא) חוסך למשתמש את ההרכבה.
- הביקוש לקליטה בכמות (פלייליסטים) ולצילומי מסך עם זמן חוזר שוב ושוב. אלה יכולות פשוטות יחסית לצינור שכבר קיים אצלנו.

### Gaps
- הזנב הארוך חלקי: תקציב החיפוש נגמר לפני מיפוי של Qwen Chat, Kimi, Brave Leo, Opera, Dia, Vimeo AI ו־Google Classroom. לא נמצאו מתחרים ישראליים.
