# השוק של ניתוח, סיכום ואינדוקס סרטוני הרצאות, וובינרים, קורסים ופגישות — מפת מוצרים, קטלוג יכולות מלא, דפוסי UX ואבני בניין בקוד פתוח (מצב 9/11/2026)

> מחקר 9/11/2026 עבור לשונית "ניתוח וידאו" ב־THE SNOWBALL Studio (קהל דובר עברית, סטודנטים ואנשי עסקים; סרטונים בעיקר באנגלית ובעברית; שימוש חוזר בהורדה מ־YouTube ובשרשרת התמלול הקיימת; אפליקציית Academy לקריאת EPUB; אפליקציות אנדרואיד).
> שיטה: כ־25 חיפושים ואחריהם כ־75 קריאות ישירות של עמודי מוצר, עמודי מחירים, מרכזי עזרה, יומני שינויים, Chrome Web Store, Trustpilot, מאמרי סקירה מ־2026, ורישומי npm/PyPI. **תקציב החיפוש המשותף (200 לכל הסוכנים) נגמר באמצע העבודה** — מכאן והלאה נקראו רק כתובות ידועות. סימון "(תקציר חיפוש)" = הטענה נלקחה מתקציר תוצאת החיפוש ולא מקריאת העמוד המלא. עמודים שנטענים ב־JavaScript (Reddit, G2, Material Design, Apple HIG, מרכז הידע של Kaltura) לא נקראו.
> נתוני npm/PyPI (רישיון, גרסה, תאריך, הורדות שבועיות) נשלפו מה־registry ב־9/11/2026.
> כלל ניסוח: תיאור עובדתי בלבד ("X מציע Y"); ההזדמנויות שלנו מנוסחות באופן כללי. מחירים בדולר אלא אם צוין אחרת, עם תאריך.

---

## 1. מפת המוצרים — 55 מוצרים ב־8 קטגוריות: יכולות, מחירים, מיצוב, עברית, ביקורות ותלונות

### Takeaway
הליבה של כמעט כל המוצרים זהה (סיכום, פרקים, צ'אט עם הסרטון, כרטיסיות/מבחנים, מפת חשיבה), והמחירים מתכנסים ל־$9–$18 לחודש לצרכן ול־$10–$40 למושב לחודש בעסקים. ההבדלים האמיתיים: כיסוי של מה שמוצג במסך, דיוק חותמות הזמן, סינתזה בין כמה סרטונים, שקיפות חיוב, ושפות. עברית מאומתת רשמית רק אצל מעטים (YouTube Ask, Azure AI Video Indexer); רושמי פגישות מובילים (Otter, Read.ai) מפרטים רשימת שפות בלי עברית.

### Cited Findings

#### 1א. מחברות AI ועוזרים שמקבלים וידאו כמקור
- **Gemini Notebook (לשעבר NotebookLM)** — שונה שמו ב־16/7/2026; "the same standalone product", עם הרצת קוד בענן וסנכרון מלא עם אפליקציית Gemini; בעתיד גם מחברות בתוך AI Mode בחיפוש. מעל 30 מיליון משתמשים ו־600 אלף ארגונים — [Google Blog, 16/7/2026](https://blog.google/innovation-and-ai/products/gemini-notebook/notebooklm-gemini-notebook/); [Workspace Updates](https://workspaceupdates.googleblog.com/2026/07/notebooklm-now-gemini-notebook.html).
- תוצרי Studio (מסמך רשמי לחינוך, 2026): flashcards ו־quizzes, study guides, Audio Overviews ("two AI hosts, where you can ask them to explain a concept differently"), Video Overviews ("short explainer videos with narration"), "in-line citations", "interactive learning overviews", אינפוגרפיקה, "PDF slide decks", "data tables", Mind Maps שאפשר למקד בנושא בפרומפט, Deep Research, מקליט אודיו ושיחה קולית — [Google one-pager](https://services.google.com/fh/files/misc/gemininotebook_gfe_one_pager.pdf).
- מכסות יומיות לפי מסלול חינוך: Fundamentals (חינם) — 50 שאלות צ'אט, 50 מקורות למחברת, 3 Audio + 3 Video Overviews, 10 סטים של כרטיסיות, 10 מבחנים, Deep Research 10 בחודש; Education Plus — 200/100/6/6/20/20, 3 Deep Research ביום; AI Pro for Education — 500/300/20/20/100/100, 20 ביום — [Google one-pager](https://services.google.com/fh/files/misc/gemininotebook_gfe_one_pager.pdf).
- מסלולי צרכן (צד שלישי, אומת 28/9/2026): 50 מקורות בחינם, 100 ב־AI Plus, 300 ב־Pro, 500–600 ב־Ultra; ה־Studio המלא רק באפליקציה העצמאית, "Notebooks in Gemini" הוא חזית צ'אט לאותן מחברות — [nlmtools](https://www.nlmtools.com/blog/gemini-notebook-vs-notebooks-in-gemini).
- מקור YouTube = תמליל בלבד: "Gemini Notebook doesn't watch videos"; סרטון בלי כתוביות או דיבור לא נכנס; סרטון פרטי נכשל; קובץ וידאו שמועלה "is treated as audio" עד 200MB; סרטונים בני פחות מ־72 שעות עלולים להיכשל; המקור נמחק תוך 30 יום אם הסרטון נמחק — [HoverNotes, בלוג של מתחרה, 30/10/2026](https://hovernotes.io/en/blog/add-any-video-to-notebooklm-with-hovernotes); [Scrimba, 11/8/2026](https://scrimba.com/articles/best-ai-video-summarizers-2026/); [XDA, 15/7/2026](https://www.xda-developers.com/i-dont-watch-youtube-videos-anymore-i-consume-them-using-notebooklm/).
- Video Overviews ב־80+ שפות (25/8/2025); מקורות: PDF, אתרים, YouTube, Docs, Slides; אפשר לכוון בפרומפט "expertise levels" ו־"learning objectives"; שומר ייחוס מקורות וציטוטים — [PPC Land](https://ppc.land/google-expands-notebooklm-video-overviews-to-80-languages-worldwide/).
- שפת הפלט נקבעת לכל מחברת (Settings > Output Language) — [Supademo (תקציר חיפוש)](https://supademo.com/blog/how-to-change-the-output-language-in-notebooklm). פורמטים של Audio Overview: Brief, Critique, Debate — [BibiGPT, מתחרה, 7/9/2026](https://www.bibigpt.co/en/blog/posts/youtube-video-summarizer-tools-comprehensive-guide-2026).
- ביקוש לקליטה בכמות: תוסף צד שלישי שמעביר פלייליסט, ערוץ או תוצאות חיפוש של YouTube למחברת — 500,000 משתמשים, 4.8 (968 דירוגים), עודכן 4/11/2026 — [Chrome Web Store](https://chromewebstore.google.com/detail/youtube-to-notebooklm-you/kobncfkmjelbefaoohoblamnbackjggk).
- **Gemini API (הבנת וידאו)** — דגימת פריימים ב־1 FPS כברירת מחדל (ניתן לשינוי), אודיו ב־1Kbps (32 טוקנים לשנייה); כ־100 טוקנים לשנייה ברזולוציה נמוכה וכ־300 ברגילה; עד 3 שעות (נמוכה) או שעה (רגילה) בהקשר של מיליון טוקנים; כתובות YouTube בתצוגה מקדימה: בחינם עד 8 שעות ביום, רק סרטונים ציבוריים, עד 10 סרטונים לבקשה; חותמות בפורמט MM:SS; חיתוך לפי start_offset/end_offset; "fast action sequences might lose detail due to the 1 FPS sampling rate"; קיים גם "agentic mode" במודלים חדשים — [Google AI Studio docs](https://aistudio.google.com/docs/video-understanding).
- **Recall** — Free: 10 סיכומים בחודש, API ו־MCP; Plus $10/חודש (שנתי): סיכומים בלי הגבלה "with timestamps", "Quiz and spaced repetition", צ'אט עם הידע שלך; Max $38/חודש: בחירת מודל ופעולה על 100 פריטים בבת אחת; 20% הנחה לסטודנטים (נבדק 9/11/2026) — [Recall pricing](https://www.recall.it/pricing). אורך עד 10 שעות (5 בלי כתוביות) — [BibiGPT](https://www.bibigpt.co/en/blog/posts/youtube-video-summarizer-tools-comprehensive-guide-2026).
- **Readwise Reader** — "Watch YouTube videos and highlight the transcript in Reader"; Ghostreader כעוזר קריאה; ייצוא ל־Obsidian, Notion, Logseq ועוד; $9.99 לחודש בשנתי או $12.99 חודשי; 50% הנחה לסטודנטים — [Readwise](https://readwise.io/read).

#### 1ב. תוספים ואפליקציות לסיכום וידאו/YouTube
- **Eightify** — $9.99 לחודש או $59.99 לשנה (לפי App Store; עמוד המחירים שלו לא עונה); נקודות מפתח עם חותמות זמן; 40+ שפות; תמליל בלבד — [Scrimba, 11/8/2026](https://scrimba.com/articles/best-ai-video-summarizers-2026/). תקרת אורך בערך שעה — [BibiGPT](https://www.bibigpt.co/en/blog/posts/youtube-video-summarizer-tools-comprehensive-guide-2026). מגבלות המסלול החינמי סותרות בין מקורות — [ToolDirectory (תקציר חיפוש)](https://tooldirectory.ai/tools/eightify-youtube-video-summaries).
- **Glasp YouTube Summary** — תמליל מלא לצד הסרטון; סיכום עם חותמות זמן שלחיצה עליהן מזיזה את הנגן; בחירת מודל (ChatGPT, Claude, Gemini, Mistral); "Custom prompt and summary length"; הדגשת שורות בתמליל וייצוא; "2,000,000+" משתמשים, 4.3 בחנות; חינם, Pro מ־$15 לחודש או $150 לשנה (נבדק 9/11/2026) — [Glasp](https://glasp.co/youtube-summary). תלוי בכתוביות ו"נשבר" כש־YouTube או הדפדפן מתעדכנים — [Toolworthy, עודכן 15/8/2026](https://www.toolworthy.ai/en/blog/best-ai-video-summarizer).
- **NoteGPT** — Pro $9 לחודש בשנתי ($9.99 חודשי), Unlimited $19.92/$29, Max $69/$99; 5/10/20 סרטוני YouTube במקביל; סיכום 2/10/20 ערוצים; סרטון בלי כתוביות עד 120/210 דקות; קבצים מקומיים עד 1GB/5GB; סיכום, מפת חשיבה ותרגום (נבדק 9/11/2026) — [NoteGPT pricing](https://notegpt.io/pricing). תוסף: 400,000 משתמשים, 5.0 מ־8.8K דירוגים, עודכן 25/8/2026; צ'אט על הסרטון; תרגום תמלילים ל־40+ שפות — [Chrome Web Store](https://chromewebstore.google.com/detail/notegpt-youtube-web-summa/baecjmoceaobpnffgnlkloccenkoibbb). Trustpilot: 1.8/5 מ־35 ביקורות, רובן על קרדיטים שנעלמו ועל "Unlimited" שאינו בלי הגבלה — [Trustpilot](https://www.trustpilot.com/review/notegpt.io). סקירה (של מתחרה): סיכומי YouTube "did the job", "wall of text", ו־Unlimited מוגבל ל־2,800 קרדיטים — [tl;dv blog, 10/9/2026](https://tldv.io/blog/notegpt-review/). מפות חשיבה גנריות שמפספסות פרטים — [Jamie (מתחרה, תקציר חיפוש)](https://www.meetjamie.ai/blog/notegpt).
- **HARPA AI** — מסכם YouTube, "talk to videos", קפיצה לחותמות זמן, משתנה {{transcript}}; מודלים GPT-5.4, Claude 4.6, Gemini 3.1 ועוד; מ־$12 לחודש בשנתי; "500.000 professionals" — [HARPA](https://harpa.ai/).
- **Summarize.tech** — לא זמין: HTTP 503 עם `DEPLOYMENT_PAUSED` ב־6/8/2026 — [Scrimba](https://scrimba.com/articles/best-ai-video-summarizers-2026/).
- **Video Highlight** — תמליל וסיכום זה לצד זה "for checking claims"; דסקטופ בלבד; איטי מעל 45 דקות — [Toolworthy](https://www.toolworthy.ai/en/blog/best-ai-video-summarizer).
- **Summify** — $10 לחודש או $8 בשנתי, Lifetime $179; 130+ שפות; בולטים מקושרים לזמן; המסלול החינמי נגמר אחרי 10–15 סיכומים — [Toolworthy](https://www.toolworthy.ai/en/blog/best-ai-video-summarizer).
- **WayinVideo** — חיפוש עם חותמות זמן על פני ספריית סרטונים; 200 קרדיטים בהצטרפות ו־30 ביום; המחיר בתשלום לא פומבי — [Toolworthy](https://www.toolworthy.ai/en/blog/best-ai-video-summarizer).
- **ScreenApp** — Growth $19, Business $34 לחודש בשנתי; פרקים עם זמנים; "transcript-first"; תלונות ב־Trustpilot על המרה אוטומטית של ניסיון למנוי שנתי — [Toolworthy](https://www.toolworthy.ai/en/blog/best-ai-video-summarizer). טוען שהוא מתמלל "on-screen text and speech included" ועונה עם חותמות זמן לחיצות, גם לקישורים לא רשומים ולקבצים — [ScreenApp blog (מוכר), 17/7/2026](https://screenapp.io/blog/ask-youtube).
- **HoverNotes** — צילומי מסך עם חותמת זמן בלחיצה; "It watches the screen, not just the captions" (קוד, דיאגרמות, נוסחאות); עובד על YouTube, Udemy, Coursera, LinkedIn Learning, Khan Academy, מערכות LMS וקבצים מקומיים; Markdown מקומי ל־Obsidian; חינם: הערות וצילומים בלי הגבלה + 20 דקות AI; Pro $18 לחודש — [HoverNotes](https://hovernotes.io/).
- **Mapify** — YouTube/PDF/קישור/פודקאסט/הקלטת פגישה → מפת חשיבה; "Jump with Timestamps" מצמתי המפה לסרטון; תמלול; מפה → מצגת; ייצוא לתמונה, PDF ו־Markdown וקישור שיתוף; 30+ שפות למסמכים — [Mapify](https://mapify.so/).
- **BibiGPT** — 30+ פלטפורמות (YouTube, Bilibili, TikTok, פודקאסטים); חותמת זמן לחיצה לכל נקודה; מפות חשיבה; טוען שהוא "extracts the chart contents" כשמוצגים גרפים; ייצוא ל־Notion, Obsidian ו־Readwise; תמלול עצמאי לסרטון בלי כתוביות; 4 שעות ומעלה — [BibiGPT (מוכר)](https://www.bibigpt.co/en/blog/posts/youtube-video-summarizer-tools-comprehensive-guide-2026).
- **Readray (לשעבר LilysAI)** — "Slides and charts on screen are captured as frames straight into your notes"; ניתוח "down to the actual scene"; דוחות לפי סוג סרטון (סרטון השקעות → טבלת המלצות קנייה/מכירה עם מחירי מניות; מדריך → playbook צעד־אחר־צעד); "1.3 million" משתמשים — [Readray](https://readray.ai/en).

#### 1ג. כלי לימוד (הרצאה/סרטון → הערות, כרטיסיות, מבחנים)
- **Knowt** — מסכם סרטוני YouTube; "Record live lectures and Knowt will create notes, flashcards, tests, and interactive games"; חידון קולי (Kai); learn mode בלי הגבלה בחינם ומצב חזרה מרווחת; "8,967,079 users"; "At least 700,000 of 1.3 million students used Knowt for the May 2025 AP season" — [Knowt](https://knowt.com/).
- **Turbo AI (לשעבר TurboLearn)** — הקלטות הרצאה, PDF, סרטונים ו־YouTube → הערות, כרטיסיות, מבחנים (רב־ברירה, השלמה, פתוחות), פודקאסטים; "handles math formulas, chemical equations, physics diagrams, and code snippets"; "10,000,000+ learners", 4.8 מ־300K+ ביקורות — [Turbo AI](https://www.turbo.ai/).
- **Coconote** — הקלטת הרצאות ופגישות והעלאות → הערות, כרטיסיות, מבחנים, פודקאסט, סרטונים, צ'אט; "100+ Languages"; מסלול Unlimited Pass — [Coconote](https://coconote.app/).
- **StudyFetch** — הקלטת הרצאות, קישורי YouTube, PDF ו־PowerPoint → הערות, כרטיסיות, מבחנים, מבחני תרגול, מורה AI ‏(Sparky), "audio recaps", סרטוני הסבר; "8M+" משתמשים; 92%/85% דיווחו על שיפור בציונים (סקר עצמי של 1,000 סטודנטים, דצמבר 2024) — [StudyFetch](https://www.studyfetch.com/).
- **Gizmo** — "YouTube to Flashcards", PDF ו־PowerPoint לכרטיסיות, "AI quizzes"; "Get addicted to learning" — [Gizmo](https://gizmo.ai/).
- **RemNote** — Free; Pro $8 לחודש ($96 לשנה); Pro with AI $18 לחודש ($216 לשנה) עם מקליט הרצאות; כרטיסיות AI מטקסט/PDF/מצגת; כלי YouTube-to-Cards/Quiz/Summary (נבדק 9/11/2026) — [RemNote pricing](https://www.remnote.com/pricing).
- **Algor Education** — קלט: PDF, Word, תמונות, טקסט, קישור אתר או YouTube; פלט: מפות מושגים, מפות חשיבה, כרטיסיות, מבחנים, סיכומים; בחירת "language, style and level of detail" — [Algor](https://www.algoreducation.com/en).

#### 1ד. רושמי פגישות וובינרים (כולל העלאת הקלטה)
- **Otter.ai** — Basic חינם: 300 דקות, 30 דקות לשיחה, 3 ייבואים לכל החיים; Pro $16.99 חודשי (בטבלה $8.33 בשנתי; העמוד לא עקבי); Business $30 חודשי / $19.99 שנתי; שפות התמלול בטבלה: אנגלית, ספרדית, צרפתית, גרמנית, יפנית, סינית; "automated slide capture"; צ'אט AI ‏20/50/200 שאלות בחודש; 20% הנחה ב־.edu ($79.99 לשנה) (נבדק 9/11/2026) — [Otter pricing](https://otter.ai/pricing). לכידת שקופיות מאז 2/2023 — [BusinessWire, 2023](https://www.businesswire.com/news/home/20230214005087/en). Trustpilot: ‏4.4 מ־886; תלונות חיוב, ו־"it doesn't have many languages" (5/11/2026) — [Trustpilot](https://www.trustpilot.com/review/otter.ai).
- **Fireflies.ai** — Free/Pro/Business/Enterprise; "Upload and transcribe audio & video files"; אנגלית + ספרדית/צרפתית/פורטוגזית/איטלקית + "100+ other languages in beta" (עברית לא מוזכרת); AskFred, soundbites, topic trackers; וידאו ב־Business (נבדק 9/11/2026) — [Fireflies pricing](https://fireflies.ai/pricing). Pro $10, Business $19, Enterprise $39 למושב בשנתי — [Scrimba](https://scrimba.com/articles/best-ai-video-summarizers-2026/). Trustpilot ‏4.5 מ־904; התלונה המרכזית חיוב אחרי ביטול — [Trustpilot](https://www.trustpilot.com/review/fireflies.ai).
- **Fathom** — חינם "Unlimited recordings + transcriptions"; Premium $20/$16; Team $19/$15; Business $34/$25 (סנכרון CRM, מדדי אימון); Ask Fathom בין שיחות; לכידה בלי בוט (בטא) (נבדק 9/11/2026) — [Fathom pricing](https://www.fathom.ai/pricing).
- **tl;dv** — Pro €29 חודשי / €18 בשנתי, Business €39/€29 למושב (נבדק 9/11/2026) — [tl;dv pricing](https://tldv.io/pricing/). במסלול החינמי, אחרי 10 פגישות "only the first 10 minutes of each meeting get AI notes" — [Toolworthy](https://www.toolworthy.ai/en/blog/best-ai-video-summarizer).
- **Read.ai** — Free (5 דוחות בחודש), Pro $19.75/$15, Enterprise $29.75/$22.50, Enterprise+ $39.75/$29.75; העלאת 100/200/300 דקות בחודש; דוחות ב־16+ שפות ברשימה, בלי עברית (ובמקום אחר באותו עמוד "20+ languages supported" — לא עקבי); מדדי מעורבות וסנטימנט; גישה ל־LLM ‏(Claude, GPT) בחיפוש רק מ־Pro; ב־Enterprise+ ‏HIPAA ואירוח באיחוד האירופי ובקנדה; "key questions" ו־action items (נבדק 9/11/2026) — [Read.ai pricing](https://www.read.ai/pricing).
- **Notta** — Free ‏120 דקות ו־3 דקות לשיחה; Pro $8.17 לחודש בשנתי (1,800 דקות); Business $16.67 (ללא הגבלה); עד 5 שעות להקלטה; Document Builder (PDF, Word, Excel, מצגות); שאלות על פני כל הפגישות; תוספי תרגום דו־לשוני (נבדק 9/11/2026) — [Notta pricing](https://www.notta.ai/en/pricing). 58 שפות ו־50% הנחה לחינוך — [Scrimba](https://scrimba.com/articles/best-ai-video-summarizers-2026/).
- **Granola** — Basic $0, Business $14, Enterprise $35 למשתמש; "Bot-free, device-audio capture"; האודיו נמחק אחרי התמלול; היסטוריה של 30 יום בחינם; API ו־MCP בתשלום (נבדק 9/11/2026) — [Granola pricing](https://www.granola.ai/pricing).
- **Zoom** — סיכומי AI Companion יכולים לכלול, כאופציה, הודעות צ'אט ותוכן ממסך משותף; יש הגדרת OCR למסך המשותף — [Brown IT (תקציר חיפוש)](https://ithelp.brown.edu/kb/articles/zoom-ai-companion-overview). ZoomMate הושק 24/6/2026 כתוסף בתשלום; יכולות הליבה נשארות במסלולים בתשלום — [Zoom blog](https://www.zoom.com/en/blog/zoom-ai-companion-zoommate/).
- **Microsoft Teams (Copilot intelligent recap)** — "will be able to incorporate content shared on screen into the AI-based summary"; זמינות כללית אמצע–סוף פברואר 2026 בדסקטופ ובווב, מובייל בהמשך; דורש רישיון Microsoft 365 Copilot; פעיל כברירת מחדל — [Message Center MC1115314](https://www.itelio.com/en/microsoft-message-center/MC1115314). ניתוח מסך כשההקלטה פעילה — [RM325873 (תקציר חיפוש)](https://mc.merill.net/message/RM325873).
- **Google Meet ("Take notes for me")** — מוסיף "screenshots of presented content directly in the meeting notes document"; התראה למציג ואפשרות לכבות; מנהל בוחר "always" או רק כשיש הקלטה; הפצה מ־3/8/2026 ל־Business Standard/Plus, Enterprise Standard/Plus ו־AI Pro for Education — [Workspace Updates, 3/8/2026](https://workspaceupdates.googleblog.com/2026/08/visual-screenshots-now-included-in-Google-Meet-meeting-notes.html). רישום הערות גם בפגישות פנים־אל־פנים מ־13/8/2026, תחילה באנדרואיד — [TechRepublic (תקציר חיפוש)](https://www.techrepublic.com/article/news-google-meet-in-person-meeting-notes/).
- **Happy Scribe** — Basic $17/$8.50, Pro $29/$19; 60+ שפות; DOCX, SRT, TXT; תמלול באימות אנושי; ייצוא חינמי עם סימן מים — [Toolworthy](https://www.toolworthy.ai/en/blog/best-ai-video-summarizer).
- **Descript** — Hobbyist $24/$16; פרקים שממופים לנקודות עריכה; קרדיטי AI נגמרים בסשן אחד; קריסות בפרויקטים מעל שעה — [Toolworthy](https://www.toolworthy.ai/en/blog/best-ai-video-summarizer).

#### 1ה. פלטפורמות לכידת הרצאות באוניברסיטאות
- **Panopto** — "indexes every spoken word, on-screen text, and slides in every recording"; AI Search ("Ask a question in plain language and jump straight to the exact moment"); פרקים ותוכן עניינים; "Conversational video search", "Multi-video synthesis"; תרגום ל־75+ שפות; תוסף Access AI — [Panopto AI capabilities](https://www.panopto.com/capabilities/ai-capabilities.md). Access AI: ‏AI Chapters, Key Points, ‏AI Recast — "created from a video's automatic captions", היוצר מפעיל ועורך — [Northwestern KB](https://services.northwestern.edu/TDClient/30/Portal/KB/Article/2960/Panopto-Access-AI-AI-Chapters-and-AI-Summaries). טקסט קריא שמופיע לפחות 10 שניות נכנס ל־OCR, גם כתב יד על לוח — [Cambridge](https://help.uis.cam.ac.uk/node/8292), [Oxford](https://help.it.ox.ac.uk/node/1231206) (תקציר חיפוש). מבחנים בתוך הווידאו שמתחברים ליומן הציונים ב־Canvas — [Stanford (תקציר חיפוש)](https://teachingcommons.stanford.edu/opportunities/panopto).
- **Kaltura (Genie)** — Genie לסרטון יחיד עונה "based only on that video"; תשובות ככרטיסיות עם key takeaways וקטעי וידאו, או כטקסט מובנה (סיכומים, שלבים, טבלאות); לא מופיע אם אין כתוביות; Class Genie על פני הקורס — [Kaltura Knowledge Center (תקציר חיפוש)](https://knowledge.kaltura.com/help/ai-genie). מבוסס AWS Bedrock ולא מאמן על תוכן לקוחות — [Kaltura AI principles (תקציר חיפוש)](https://corp.kaltura.com/kaltura-ai-principles/).
- **YuJa** — GenAI Video Chaptering ("automatically find natural breaks"); ‏PowerPack: תיאור קולי, "interactive Q&A during playback", דיבוב, Video Quizzes, Sentiment AI, ‏Ask YuJa AI — [YuJa](https://www.yuja.com/video-cms/generative-ai-video-chaptering/). שאלות שנוצרות אוטומטית וממוקמות בחותמות זמן — [YuJa GenAI Video Quizzes (תקציר חיפוש)](https://www.yuja.com/?p=174966).
- **Echo360 (AskEcho)** — summaries, FAQs, study cards, מבחני רב־ברירה ופרקים; "uses the recording transcript"; חלק מהכלים נפתחים רק אחרי צפייה בחלק מספיק מהסרטון (עודכן 8/7/2026) — [Echo360 Support](https://support.echo360.com/hc/en-us/articles/46417660105485-EchoVideo-Understanding-AskEcho). המרצה קובע אילו כלים הסטודנט רואה (ינואר 2026) — [Echo360 deployment notes (תקציר חיפוש)](https://support.echo360.com/hc/en-us/articles/43006248352909-EchoVideo-2026-Deployment-Notes-28-29-January). אוניברסיטה אחת דורשת צפייה ב־80% לפני הכלים, ומזהירה שהשאלות "aren't automatically aligned with your course objectives" — [Clarkson (תקציר חיפוש)](https://bookstack.clarkson.edu/books/instructor-guidebook-teaching-learning-at-clarkson-university/page/tips-for-using-ai-generated-study-aids).
- **Verbit** — כתוביות חיות ותמלילים להרצאות; ‏Gen.V: "automatic summaries, quizzes, chapters, headlines, and keywords" מתמלילים; Smart Player עם חיפוש בתמליל ושיתוף קטעים; תרגום ב־28+ שפות; אינטגרציות Canvas, Moodle, Panopto, Kaltura, Zoom, Teams — [Verbit Education](https://verbit.ai/education/).
- **Microsoft Stream (Copilot)** — מסכם ועונה, ומציג "linked timestamps so you can jump to the spot"; דורש תמליל של יותר מ־100 מילים; רישיון Microsoft 365 Copilot — [Microsoft Support](https://support.microsoft.com/en-us/office/0b531ea9-2d9d-4830-97e4-2c1b2b8ca31d).

#### 1ו. פלטפורמות ידע וידאו ארגוניות ו־API
- **Twelve Labs** — Marengo 3.0; פעולות Search, Embed, Analyze, ‏Segment ("timestamped metadata"), Jockey (מענה וחיפוש רגעים על פני ספרייה); Free ‏$0 (‏3GB), Plus $29, Pro $99 לחודש (נבדק 9/11/2026) — [Twelve Labs pricing](https://www.twelvelabs.io/pricing).
- **Azure AI Video Indexer** — עברית (he-IL) נתמכת כשפת מקור, בזיהוי שפה, בהתאמת מודל שפה ובתרגום האתר; בין התובנות המתורגמות "Frame patterns (Currently, only to Hebrew)" (עודכן 16/6/2026) — [Microsoft Learn](https://learn.microsoft.com/en-us/azure/azure-video-indexer/language-support).
- **Loom** — כותרות, סיכומים ופרקים אוטומטיים; וידאו → מסמך/SOP; טיקטים ל־Jira/Linear; הערות פגישה; 50+ שפות לשיפור אוטומטי, אבל "AI workflows currently generate documentation in English only" — [Loom AI](https://www.loom.com/ai).

#### 1ז. הסבת וידאו לתוכן (בלוג, קורס, קליפים)
- **Castmagic** — Hobby $19 לחודש ($239 לשנה, 30 שעות), Starter $48 (100 שעות), Team $139 (400 שעות); תוצרים: show notes עם זמנים, מאמרים, ניוזלטרים, ציטוטים, פוסטים, תיאורי YouTube; 60+ שפות (עברית לא ברשימה); ייבוא מ־YouTube/TikTok/Instagram; API ו־Claude MCP (נבדק 9/11/2026) — [Castmagic pricing](https://www.castmagic.io/pricing).
- **OpusClip** — Free, Starter $15, Pro $29; ב־Pro חיתוך לפי "spoken words, visual objects, sound, emotion"; ציון ויראליות; reframe; ‏B-roll (נבדק 9/11/2026) — [OpusClip pricing](https://www.opus.pro/pricing).

#### 1ח. יכולות ה־AI של פלטפורמות הווידאו והקורסים עצמן
- **YouTube — כפתור Ask בעמוד הצפייה** — שאלות על הסרטון והצעות פרומפט; Android, iOS, דפדפן וטלוויזיה; למחוברים בני 13+; רק בסרטונים נבחרים; **עברית ברשימת השפות**; "may sometimes produce inaccurate or offensive information"; שיחות נמחקות אחרי 45 יום — [YouTube Help](https://support.google.com/youtube/answer/14110396?hl=en). רשימות שלבים עם חותמות זמן לחיצות; לא קיים בנגן המוטמע — [How-To Geek, 24/4/2026](https://www.howtogeek.com/youtubes-ask-button-just-solved-the-tutorial-problemand-i-wasnt-expecting-to-say-that/). חותמות זמן לסרטון בלי פרקים יוצאות "approximate"/"rough" — [Android Police, 9/8/2026](https://www.androidpolice.com/ai-in-youtube-useful-for-this-one-feature/). 42 שפות (אוגוסט 2026) — [Scrimba](https://scrimba.com/articles/best-ai-video-summarizers-2026/).
- **Ask YouTube (חיפוש שיחתי)** — הוכרז ב־I/O מאי 2026 למנויי Premium בארה"ב — [Dataconomy (תקציר חיפוש)](https://dataconomy.com/2026/05/20/youtube-ask-youtube-gemini-omni-ai-google-io/); הורחב ב־6/7/2026 לכל המחוברים בארה"ב בדסקטופ — [Search Engine Land (תקציר חיפוש)](https://searchengineland.com/ask-youtube-expands-481906). "It is not built to sit inside one two-hour lecture" — [ScreenApp blog](https://screenapp.io/blog/ask-youtube).
- **YouTube Chapters** — לפחות 3 חותמות, הראשונה ב־00:00, כל פרק לפחות 10 שניות; Automatic Chapters מסומן כברירת מחדל; פרקים ידניים גוברים — [YouTube Help](https://support.google.com/youtube/answer/9884579?hl=en).
- **Google Search key moments** — זיהוי אוטומטי, או סימון Clip ‏(startOffset/endOffset/url) או SeekToAction עם `{seek_to_second_number}`; דרוש קישור עמוק לנקודה וסרטון של 30 שניות לפחות — [Google Search Central](https://developers.google.com/search/docs/appearance/structured-data/video).
- **Coursera Coach** — מיליון+ לומדים; "9.5% higher quiz pass rate on the first attempt" ו־"11.6% more lessons completed per hour"; דיאלוג סוקרטי מוטמע בקורסים (פיילוט, 9/2024) — [Coursera Blog](https://blog.coursera.org/announcing-ai-powered-capabilities-enabling-educators-to-use-coursera-coach-to-deliver-interactive-personalized-instruction); נשים ולומדים בלי תואר משתמשים יותר (12/2024) — [Coursera Blog](https://blog.coursera.org/coursera-coach-providing-essential-learner-support). Role-play עם משוב מיידי (ינואר 2026) — [Asia Education Review (תקציר חיפוש)](https://www.asiaeducationreview.com/technology/news/coursera-ceo-greg-hart-on-powering-an-aidriven-upskilling-era-nwid-5332.html). Coursera Plus ‏$239 לשנה — [Coursera](https://www.coursera.org/explore/coach).
- **Udemy AI Assistant** — סיכומי קורס והרצאה שעוזרים "navigate to the most relevant content quickly", עונה רק על הקורס, ב־Enterprise וב־Team — [Udemy Business Support (תקציר חיפוש)](https://business-support.udemy.com/hc/articles/26247590042647).
- **LinkedIn Learning AI-powered coaching** — מענה בזמן אמת על בסיס כל הספרייה, קישור לקורס להקשר מלא, התאמה לפי תפקיד — [LinkedIn Business](https://business.linkedin.com/learn/resources/learning-tech/linkedin-learning-ai-powered-coaching); חלונית בצד ימין בזמן הניגון, משתמשת בתמליל הקורס — [University of Arkansas KB (תקציר חיפוש)](https://uark.teamdynamix.com/TDClient/33/Portal/KB/Article/1452/LinkedIn-Learning-How-to-Access-AI-Coaching-Chat); המרצים מקבלים תשלום על שאלות שנשאלות בקורס — [TechRadar (תקציר חיפוש)](https://www.techradar.com/pro/linkedin-wants-you-to-use-ai-tools-to-find-your-next-job).

#### 1ט. עברית — מה אומת ומה לא
| מוצר / רכיב | עברית | מקור |
|---|---|---|
| YouTube Ask (עמוד צפייה) | כן, ברשימת השפות הרשמית | [YouTube Help](https://support.google.com/youtube/answer/14110396?hl=en) |
| Azure AI Video Indexer | כן: שפת מקור, זיהוי שפה, התאמה, תרגום | [Microsoft Learn](https://learn.microsoft.com/en-us/azure/azure-video-indexer/language-support) |
| Glasp | תמליל בכל שפה שיש לה כתוביות; סיכום בשפה שבוחרים | [Glasp](https://glasp.co/youtube-summary) |
| Gemini Notebook | "80+ שפות"; לא נמצאה רשימה רשמית שקראתי ובה עברית | [PPC Land](https://ppc.land/google-expands-notebooklm-video-overviews-to-80-languages-worldwide/) |
| Otter | לא: אנגלית, ספרדית, צרפתית, גרמנית, יפנית, סינית | [Otter pricing](https://otter.ai/pricing) |
| Read.ai | לא: 16+ שפות ברשימה, בלי עברית | [Read.ai pricing](https://www.read.ai/pricing) |
| Fireflies | לא מוזכרת ("100+ other languages in beta") | [Fireflies pricing](https://fireflies.ai/pricing) |
| Castmagic | לא ברשימה ("60+ ... many more") | [Castmagic pricing](https://www.castmagic.io/pricing) |
| Loom | שיפור אוטומטי ב־50+ שפות; מסמכים רק באנגלית | [Loom AI](https://www.loom.com/ai) |
| Panopto / Verbit | 75+ / 28+ שפות תרגום; עברית לא מוזכרת | [Panopto](https://www.panopto.com/capabilities/ai-capabilities.md), [Verbit](https://verbit.ai/education/) |
| Tesseract OCR | כן (`heb`, וגם `yid`) | [tessdoc](https://tesseract-ocr.github.io/tessdoc/Data-Files-in-different-versions.html) |
| FlexSearch | charset עברי ואפשרות `rtl: true` | [FlexSearch GitHub](https://github.com/nextapps-de/flexsearch) |
| Pagefind | ממשק בעברית, בלי stemming ("results won't match across root words") | [Pagefind docs](https://pagefind.app/docs/multilingual/) |

### Inferences
- רצועות מחיר: כלים צרכניים ולימודיים $8–$18 לחודש (NoteGPT, Eightify, Recall, Glasp, RemNote, HoverNotes); רושמי פגישות $10–$40 למושב; לכידת הרצאות נמכרת למוסד כתוספת (Panopto Access AI, YuJa PowerPack); הסבה לתוכן $15–$139 לחודש. מוצר לסטודנט ישראלי צריך מסלול חינמי שימושי באמת ותמחור שנתי בטווח התחתון.
- "צ'אט + פרקים + כרטיסיות" הפכו לבסיס שכולם מציעים; היתרון התחרותי עובר לשלושה צירים: (1) מה רואים על המסך, (2) עד כמה כל טענה מעוגנת לשנייה מדויקת, (3) סינתזה על פני קורס/פלייליסט.
- עבור דובר עברית שצופה בהרצאות באנגלית אין בסקירה מוצר אחד שמאומת גם כעברית מלאה, גם ככיסוי חזותי וגם כעיגון מדויק לזמן — זה הפער המרכזי שאפשר להיכנס אליו.
- כלים שתלויים בכתוביות של YouTube (Glasp, Gemini Notebook, Kaltura, Stream) נכשלים על סרטון בלי כתוביות; תמלול עצמאי (שכבר קיים אצלנו) הוא יתרון ממשי, במיוחד בעברית.

### Gaps
- לא נקראו Reddit (r/GetStudying, r/college, r/notebooklm), G2, Capterra ו־Product Hunt: תקציב החיפוש נגמר והעמודים חסומים או נטענים ב־JS. התלונות מבוססות על Trustpilot, Chrome Web Store וסקירות 2026.
- לא אומתו: Quizlet, Mindgrasp (עמוד המחירים 404), Vimeo, Wistia, Brightcove, Khanmigo, edX, ChatGPT/Claude/Perplexity (האם "רואים" סרטון ב־11/2026), Microsoft Edge Copilot.
- עמוד המחירים הרשמי של Eightify לא נגיש (403/404); המחיר מגיע מרישום App Store דרך Scrimba.
- תמיכה בעברית ב־Gemini Notebook, Notta, Coconote, Zoom, Teams Copilot ו־Meet לא אומתה ממקור רשמי.
- לא נמצאו (בגלל תקציב החיפוש) מתחרים ישראליים או כלים ייעודיים לעברית לסיכום הרצאות.

---

## 2. תוכן חזותי (שקופיות, OCR, גרפים, קוד) מול תמלול בלבד — לפי קטגוריה, ואיך המשתמשים מרגישים בפער

### Takeaway
כלי הסיכום הצרכניים ל־YouTube ומחברות ה־AI כמעט כולם "תמלול בלבד". התוכן החזותי נכנס ב־2023–2026 דווקא לפגישות חיות (Otter מ־2023, Zoom עם OCR, Teams בפברואר 2026, Meet באוגוסט 2026) ולחיפוש בפלטפורמות אקדמיות (Panopto) — אבל גם שם הסיכומים והפרקים נבנים בדרך כלל מהכתוביות. בקרב כלי YouTube רק מעטים טוענים ללכידת פריימים (Readray, HoverNotes, ScreenApp, BibiGPT — טענות של המוכרים). המשתמשים מגלים את הפער כשמספר מגיליון, גרף, קוד, נוסחה או אזהרה שהוצגו ולא הוקראו חסרים בסיכום.

### Cited Findings
**כלי סיכום צרכניים ומחברות AI — תמלול בלבד**
- רוב הכלים "never touch the video" ועובדים מתמלילים; ב־Gemini Notebook, ‏NoteGPT, ‏Eightify, ‏Notta ו־Fireflies מסומן "Transcript only" — [Scrimba, 11/8/2026](https://scrimba.com/articles/best-ai-video-summarizers-2026/).
- סקירה של עשרה כלים לא מצאה אף אחד שמנתח פריימים, שקופיות או OCR; ScreenApp מתאר את עצמו "transcript-first" — [Toolworthy](https://www.toolworthy.ai/en/blog/best-ai-video-summarizer).
- Gemini Notebook מייבא את תמליל YouTube בלבד; קובץ וידאו מועלה כאודיו; "slides, code and diagrams shown on screen are dropped" — [HoverNotes (מתחרה)](https://hovernotes.io/en/blog/add-any-video-to-notebooklm-with-hovernotes); גם [XDA](https://www.xda-developers.com/i-dont-watch-youtube-videos-anymore-i-consume-them-using-notebooklm/) ו־[LilysAI guide (תקציר חיפוש)](https://lilys.ai/en/notes/notebooklm-20251021/notebooklm-how-to-fix-youtube-transcript-error).

**חריגים בקרב כלי YouTube (טענות מוכרים)**
- Readray: "Slides and charts on screen are captured as frames straight into your notes" — [Readray](https://readray.ai/en).
- HoverNotes: "It watches the screen, not just the captions" — [HoverNotes](https://hovernotes.io/).
- ScreenApp: מתמלל "on-screen text and speech included" — [ScreenApp blog](https://screenapp.io/blog/ask-youtube).
- BibiGPT: "when guests show charts on screen, BibiGPT extracts the chart contents" — [BibiGPT](https://www.bibigpt.co/en/blog/posts/youtube-video-summarizer-tools-comprehensive-guide-2026).
- OpusClip Pro בוחר קליפים גם לפי "visual objects" — [OpusClip pricing](https://www.opus.pro/pricing).

**מודלים רב־אופניים ו־API**
- Gemini API רואה פריימים (1 FPS כברירת מחדל); הפרמטר `media_resolution` קובע כמה טוקנים לכל פריים — "Higher settings improve reading of fine text and small details" — במחיר כ־300 טוקנים לשנייה במקום כ־100 — [Google AI Studio docs](https://aistudio.google.com/docs/video-understanding).
- Twelve Labs מציע Segment ("timestamped metadata") ו־Search על הווידאו עצמו — [Twelve Labs](https://www.twelvelabs.io/pricing). Azure AI Video Indexer מפיק "Frame patterns" ומתרגם אותן לעברית — [Microsoft Learn](https://learn.microsoft.com/en-us/azure/azure-video-indexer/language-support).

**רושמי פגישות — המעבר לכיסוי חזותי**
- Otter: לכידת שקופיות אוטומטית מ־2/2023 — [BusinessWire](https://www.businesswire.com/news/home/20230214005087/en); מאפשרת לחפש מילים מהשקופיות "even if they weren't spoken aloud" — [ITPro (תקציר חיפוש)](https://www.itpro.com/technology/artificial-intelligence/otter-ai-wants-to-bring-agents-to-third-party-systems); עדיין ברשימת היכולות ב־11/2026 — [Otter pricing](https://otter.ai/pricing).
- Zoom: סיכום יכול לכלול תוכן מסך משותף דרך OCR, כהגדרה — [Brown IT (תקציר חיפוש)](https://ithelp.brown.edu/kb/articles/zoom-ai-companion-overview).
- Teams: הסיכום כולל תוכן מסך משותף מפברואר 2026 — [MC1115314](https://www.itelio.com/en/microsoft-message-center/MC1115314). אם הפגישה רק מתומללת, Copilot עובד "without screenshare data" — [Aldridge (תקציר חיפוש)](https://aldridge.com/5-new-ai-powered-features-coming-to-microsoft-teams-in-2026/).
- Meet: צילומי מסך של התוכן המוצג בתוך מסמך ההערות מ־3/8/2026 — [Workspace Updates](https://workspaceupdates.googleblog.com/2026/08/visual-screenshots-now-included-in-Google-Meet-meeting-notes.html).
- Fireflies, Fathom, Read.ai, tl;dv, Notta: עמודי המחירים לא מציינים לכידת שקופיות (Fireflies: לא כיכולת נפרדת) — [Fireflies](https://fireflies.ai/pricing), [Fathom](https://www.fathom.ai/pricing), [Read.ai](https://www.read.ai/pricing), [Notta](https://www.notta.ai/en/pricing). Granola לוכד אודיו בלבד ומוחק אותו אחרי התמלול — [Granola](https://www.granola.ai/pricing).

**לכידת הרצאות ופלטפורמות ארגוניות**
- Panopto מאנדקס דיבור, טקסט במסך ושקופיות לחיפוש — [Panopto](https://www.panopto.com/capabilities/ai-capabilities.md) — אבל AI Chapters ו־Key Points נוצרים "from a video's automatic captions" — [Northwestern](https://services.northwestern.edu/TDClient/30/Portal/KB/Article/2960/Panopto-Access-AI-AI-Chapters-and-AI-Summaries).
- Echo360 AskEcho "uses the recording transcript" — [Echo360](https://support.echo360.com/hc/en-us/articles/46417660105485-EchoVideo-Understanding-AskEcho); Kaltura Genie לא מופיע בלי כתוביות — [Kaltura (תקציר חיפוש)](https://knowledge.kaltura.com/help/ai-genie); Stream Copilot דורש תמליל של 100+ מילים — [Microsoft Support](https://support.microsoft.com/en-us/office/0b531ea9-2d9d-4830-97e4-2c1b2b8ca31d); Verbit Gen.V עובד מתמלילים — [Verbit](https://verbit.ai/education/); ב־YuJa ה־OCR שנמצא הוא למסמכי PDF ולא לווידאו — [YuJa release notes (תקציר חיפוש)](https://www.yuja.com/blog/yuja-lumina-video-platform-v26-3-0-release/).

**איך המשתמשים מרגישים בפער**
- לפני העדכון ב־Teams: "right now, the AI doesn't see the screen or have any context"; מה שחסר בסיכומים: מספרים מגיליונות שהניעו דיון תקציבי, שקופיות שעיצבו החלטות, גרפים, מסמכים שנסקרו, מדדי דשבורד "a presenter pointed to without reading aloud" — [UC Today, 3/6/2025](https://www.uctoday.com/collaboration/microsoft-just-fixed-a-glaring-blind-spot-thats-been-missing-in-your-meeting-summaries/).
- Google מנמקת את צילומי המסך בכך שתמלילים מפספסים תוכן חזותי "such as a chart or diagram" שהדובר מתייחס אליו — [Workspace Updates](https://workspaceupdates.googleblog.com/2026/08/visual-screenshots-now-included-in-Google-Meet-meeting-notes.html).
- כלי לימוד מבליטים טיפול ב"math formulas, chemical equations, physics diagrams, and code snippets" — סימן לצורך של סטודנטים — [Turbo AI](https://www.turbo.ai/).
- סיכומים של תוכן מורכב ועמוס נתונים יוצאים "oversimplified"; סיכום מצגת יצא "wall of text" — [tl;dv review](https://tldv.io/blog/notegpt-review/).
- מגיב ב־XDA: תמלילי YouTube יכולים להיות "highly inaccurate", וכל מה שנבנה עליהם יורש את הטעויות — [XDA](https://www.xda-developers.com/i-dont-watch-youtube-videos-anymore-i-consume-them-using-notebooklm/).
- בסיכום עלולות ליפול "subtle bits of knowledge or warnings" של המומחה — [How-To Geek](https://www.howtogeek.com/youtubes-ask-button-just-solved-the-tutorial-problemand-i-wasnt-expecting-to-say-that/).

### Inferences
- כיוון שאנחנו מורידים את קובץ הווידאו עצמו, אפשר לכסות את מה שרוב השוק לא רואה: זיהוי מעברי שקופית, OCR (עברית + אנגלית), חילוץ טבלאות, קוד ונוסחאות, ושיוך כל שקופית לטווח הזמן ולמשפטים שנאמרו עליה. זה הבידול הכי מוחשי מול הכלים הצרכניים.
- הרצאות ווובינרים מלאים בהפניות "כמו שרואים כאן" — בלי השקופית המשפט חסר משמעות. גלריית שקופיות עם OCR היא לא תוספת, היא תנאי לסיכום נכון.
- הפגישות כבר עברו ל"סיכום + צילום מסך במקום הנכון" (Meet, Teams, Otter) — המשתמשים העסקיים יצפו לאותה רמה גם בוובינר מוקלט.
- כדי לא לשלם 300 טוקנים לשנייה על כל הסרטון, עדיף לשלב: זיהוי מעברים ו־OCR מקומיים על המעבד, ומודל רב־אופני רק על פריימים מייצגים (שקופית חדשה, קוד, גרף).

### Gaps
- לא נמצא מבחן עצמאי שמודד כיסוי חזותי של כלי סיכום (כל הטענות של מוכרים או של Microsoft/Google על עצמן).
- לא נבדק אם ה־OCR של Zoom, Teams, Meet או Panopto קורא עברית.
- Twelve Labs ו־Azure AI Video Indexer: לא נבדקו איכות OCR בעברית ומחירים לדקה (עמוד מחירון נפרד לא נקרא).

---

## 3. קטלוג היכולות המלא ללשונית "ניתוח וידאו" — מי מציע מה היום, ומה לא נמצא בכלל

### Takeaway
כ־110 יכולות ב־8 קבוצות. נפוצות מאוד: סיכום, פרקים, צ'אט, כרטיסיות ומבחנים, מפת חשיבה, תמליל מסונכרן. נדירות: גלריית שקופיות עם OCR, חיפוש בספרייה עם קפיצה לרגע, סינתזה על פני כמה סרטונים. **לא נמצאו בכלל בסקירה**: ייצוא Anki או EPUB מכלי וידאו, מילון מונחים דו־לשוני, מסגרות/מודלים כתוצר, רשימת ספרים וקישורים שהוזכרו, הנחות וביקורת ושאלות פתוחות ככתוב, תצוגת עלות לפני עיבוד, השוואת סרטונים, "זמן קריאה מול זמן צפייה" והערות לכל שקופית.

### Cited Findings
(שכיחות: **נפוץ** = 5+ מוצרים בסקירה; **נדיר** = 1–4; **לא נמצא** — מופיע תחת Inferences)

#### 3.1 קליטה (Ingestion)
| יכולת | מי מציע (מקור) | שכיחות |
|---|---|---|
| קישור YouTube בודד | Gemini Notebook, Glasp, NoteGPT, Mapify, Knowt, Algor, Gizmo — [Glasp](https://glasp.co/youtube-summary), [NoteGPT](https://notegpt.io/pricing), [Mapify](https://mapify.so/), [Knowt](https://knowt.com/), [Algor](https://www.algoreducation.com/en), [Gizmo](https://gizmo.ai/) | נפוץ |
| סרטון בלי כתוביות (תמלול עצמאי) | NoteGPT עד 120/210 דקות — [NoteGPT](https://notegpt.io/pricing); BibiGPT — [BibiGPT](https://www.bibigpt.co/en/blog/posts/youtube-video-summarizer-tools-comprehensive-guide-2026); Recall עד 5 שעות — שם; לא נתמך ב־Gemini Notebook וב־Glasp — [HoverNotes](https://hovernotes.io/en/blog/add-any-video-to-notebooklm-with-hovernotes), [Toolworthy](https://www.toolworthy.ai/en/blog/best-ai-video-summarizer) | נדיר |
| קובץ מקומי / סרטון לא רשום | ScreenApp — [ScreenApp](https://screenapp.io/blog/ask-youtube); NoteGPT 1–5GB; OpusClip 10–30GB — [OpusClip](https://www.opus.pro/pricing); Castmagic 10GB לקובץ — [Castmagic](https://www.castmagic.io/pricing) | נפוץ |
| פלייליסט / ערוץ / תוצאות חיפוש | NoteGPT (2/10/20 ערוצים) — [NoteGPT](https://notegpt.io/pricing); תוסף צד שלישי ל־Gemini Notebook עם 500K משתמשים — [CWS](https://chromewebstore.google.com/detail/youtube-to-notebooklm-you/kobncfkmjelbefaoohoblamnbackjggk) | נדיר |
| אצווה | NoteGPT 5/10/20 במקביל; Recall Max ‏100 פריטים — [Recall](https://www.recall.it/pricing); Castmagic 50 העלאות במקביל; Gemini API עד 10 סרטונים לבקשה — [Gemini docs](https://aistudio.google.com/docs/video-understanding) | נדיר |
| קורס/אוסף כיחידה אחת | Gemini Notebook ‏50–600 מקורות למחברת — [nlmtools](https://www.nlmtools.com/blog/gemini-notebook-vs-notebooks-in-gemini); Panopto "Multi-video synthesis" — [Panopto](https://www.panopto.com/capabilities/ai-capabilities.md) | נדיר |
| פלטפורמות קורס (Udemy, Coursera, LMS) | HoverNotes — [HoverNotes](https://hovernotes.io/); BibiGPT ‏30+ פלטפורמות | נדיר |
| הקלטת הרצאה חיה | Knowt, Coconote, StudyFetch, RemNote, מקליט ב־Gemini Notebook — [Knowt](https://knowt.com/), [Coconote](https://coconote.app/), [StudyFetch](https://www.studyfetch.com/), [RemNote](https://www.remnote.com/pricing), [one-pager](https://services.google.com/fh/files/misc/gemininotebook_gfe_one_pager.pdf) | נפוץ |
| פגישה בלי בוט | Granola, Fathom (בטא) — [Granola](https://www.granola.ai/pricing), [Fathom](https://www.fathom.ai/pricing) | נדיר |
| תקרות אורך | Otter ‏30 דקות, 90 דקות ו־4 שעות לשיחה (Basic, Pro, Business) — [Otter](https://otter.ai/pricing); Notta 5 שעות — [Notta](https://www.notta.ai/en/pricing); Gemini 1–3 שעות להקשר — [Gemini docs](https://aistudio.google.com/docs/video-understanding); Eightify כשעה — [BibiGPT](https://www.bibigpt.co/en/blog/posts/youtube-video-summarizer-tools-comprehensive-guide-2026) | — |

#### 3.2 אפשרויות עיבוד
| יכולת | מי מציע (מקור) | שכיחות |
|---|---|---|
| רמות עומק | Panopto: ‏Key Points מול AI Recast — [Northwestern](https://services.northwestern.edu/TDClient/30/Portal/KB/Article/2960/Panopto-Access-AI-AI-Chapters-and-AI-Summaries); Glasp: אורך סיכום — [Glasp](https://glasp.co/youtube-summary); Algor: "level of detail" — [Algor](https://www.algoreducation.com/en); Audio Overview ‏Brief/Critique/Debate — [BibiGPT](https://www.bibigpt.co/en/blog/posts/youtube-video-summarizer-tools-comprehensive-guide-2026) | נפוץ |
| עדשת קהל / רמת מומחיות / מטרת למידה | Video Overviews: "expertise levels", "learning objectives" — [PPC Land](https://ppc.land/google-expands-notebooklm-video-overviews-to-80-languages-worldwide/); LinkedIn Learning לפי תפקיד — [LinkedIn](https://business.linkedin.com/learn/resources/learning-tech/linkedin-learning-ai-powered-coaching); Algor "style" | נדיר |
| ניתוח לפי סוג סרטון | Readray: סרטון השקעות → טבלת המלצות; מדריך → playbook — [Readray](https://readray.ai/en) | נדיר |
| בחירת מודל | Glasp, HARPA, Recall Max — [Glasp](https://glasp.co/youtube-summary), [HARPA](https://harpa.ai/), [Recall](https://www.recall.it/pricing) | נדיר |
| פרומפט / תבניות מותאמות | Glasp, Notta (תבניות), Granola (templates, recipes) — [Notta](https://www.notta.ai/en/pricing), [Granola](https://www.granola.ai/pricing) | נפוץ |
| שפת פלט נפרדת משפת הסרטון | Gemini Notebook — [Supademo (תקציר)](https://supademo.com/blog/how-to-change-the-output-language-in-notebooklm); Glasp; NoteGPT ‏40+ — [CWS](https://chromewebstore.google.com/detail/notegpt-youtube-web-summa/baecjmoceaobpnffgnlkloccenkoibbb); Panopto ‏75+; Notta דו־לשוני | נפוץ |
| כוונון עלות/דיוק (FPS, רזולוציה, חיתוך טווח) | Gemini API — [Gemini docs](https://aistudio.google.com/docs/video-understanding) | נדיר (API) |
| הודעה שקופה על מה נכשל ולמה | חסר ב־NoteGPT לפי ביקורות ("doesn't explain which input caused a failure") — [Trustpilot](https://www.trustpilot.com/review/notegpt.io) | — |

#### 3.3 תוצרים
| יכולת | מי מציע (מקור) | שכיחות |
|---|---|---|
| TL;DR / נקודות מפתח | Panopto Key Points; Eightify (עם זמנים) — [Scrimba](https://scrimba.com/articles/best-ai-video-summarizers-2026/); Castmagic "Summaries and takeaways" | נפוץ |
| סיכום מפורט / דוח / מדריך לימוד | Panopto AI Recast; Gemini Notebook reports ו־study guides — [one-pager](https://services.google.com/fh/files/misc/gemininotebook_gfe_one_pager.pdf), [nlmtools](https://www.nlmtools.com/blog/gemini-notebook-vs-notebooks-in-gemini) | נפוץ |
| פרקים | Panopto, YuJa, Echo360, Loom, Descript, ScreenApp, פרקים אוטומטיים ב־YouTube — [YuJa](https://www.yuja.com/video-cms/generative-ai-video-chaptering/), [Echo360](https://support.echo360.com/hc/en-us/articles/46417660105485-EchoVideo-Understanding-AskEcho), [Loom](https://www.loom.com/ai), [YouTube Help](https://support.google.com/youtube/answer/9884579?hl=en) | נפוץ |
| רגעי מפתח / קליפים | Fathom clips, Fireflies soundbites, Read video highlights, OpusClip, key moments בחיפוש — [Fathom](https://www.fathom.ai/pricing), [Fireflies](https://fireflies.ai/pricing), [Read.ai](https://www.read.ai/pricing), [Search Central](https://developers.google.com/search/docs/appearance/structured-data/video) | נפוץ |
| צילומי שקופיות/מסך בתוך ההערות | Otter, Meet, Teams, Readray, HoverNotes (ראו שאלה 2) | נדיר |
| חיפוש בטקסט שעל המסך (OCR) | Panopto, Otter, Zoom (ראו שאלה 2) | נדיר |
| טבלאות נתונים / מספרים | Gemini Notebook "data tables" — [one-pager](https://services.google.com/fh/files/misc/gemininotebook_gfe_one_pager.pdf); Readray טבלת המלצות — [Readray](https://readray.ai/en); Kaltura Genie תשובה כטבלה — [Kaltura (תקציר)](https://knowledge.kaltura.com/help/ai-genie) | נדיר |
| ציטוטים | Castmagic "Quotes and highlights" — [Castmagic](https://www.castmagic.io/pricing) | נדיר |
| משימות לביצוע (action items) | Otter, Fireflies, Fathom, Read.ai, Notta, Loom | נפוץ |
| שאלות ותשובות / FAQ | Echo360 FAQs; Read.ai "key questions" | נדיר |
| ביקורת / דיון | Audio Overview בפורמט Critique/Debate בלבד — [BibiGPT](https://www.bibigpt.co/en/blog/posts/youtube-video-summarizer-tools-comprehensive-guide-2026) | נדיר |
| שלבים (playbook) | YouTube Ask (רשימת שלבים עם זמנים) — [How-To Geek](https://www.howtogeek.com/youtubes-ask-button-just-solved-the-tutorial-problemand-i-wasnt-expecting-to-say-that/); Readray | נדיר |
| אינפוגרפיקה / מצגת | Gemini Notebook infographics ו־PDF slide decks; Mapify מפה→מצגת; Notta PPT — [Mapify](https://mapify.so/), [Notta](https://www.notta.ai/en/pricing) | נפוץ |
| סקירה קולית/וידאו (פודקאסט) | Gemini Notebook, Coconote, Turbo AI, StudyFetch — [Coconote](https://coconote.app/), [Turbo AI](https://www.turbo.ai/) | נפוץ |
| מסמכים עסקיים (SOP, מייל המשך, ניוזלטר, פוסט) | Loom, Granola, Notta, Castmagic | נפוץ |
| מדדי מעורבות/סנטימנט | Read.ai; YuJa Sentiment AI | נדיר |

#### 3.4 כלי למידה
| יכולת | מי מציע (מקור) | שכיחות |
|---|---|---|
| כרטיסיות | Gemini Notebook, Knowt, Turbo AI, Coconote, StudyFetch, Gizmo, RemNote, Algor, Echo360 (study cards), Kaltura Genie | נפוץ |
| חזרה מרווחת | Knowt — [Knowt](https://knowt.com/); Recall — [Recall](https://www.recall.it/pricing); RemNote; Anki עם FSRS — [Anki manual](https://docs.ankiweb.net/deck-options.html) | נדיר בכלי וידאו |
| מבחנים / מבחני תרגול | Gemini Notebook ("editable practice quiz that provides feedback"), Echo360 (רב־ברירה), Knowt, StudyFetch, Turbo AI (רב־ברירה, השלמה, פתוחות) | נפוץ |
| שאלות בתוך הווידאו בזמן הנכון | YuJa (בחותמות זמן), Panopto (ליומן הציונים) — [YuJa (תקציר)](https://www.yuja.com/?p=174966), [Stanford (תקציר)](https://teachingcommons.stanford.edu/opportunities/panopto) | נדיר |
| התאמת כרטיסיות/מבחנים לפי נושא, כמות וקושי | Gemini Notebook — [MasterConcept (תקציר)](https://masterconcept.ai/?p=64660) | נדיר |
| מפת חשיבה | Gemini Notebook, NoteGPT, Mapify, BibiGPT, Algor | נפוץ |
| מפת מושגים | Algor — [Algor](https://www.algoreducation.com/en) | נדיר |
| "הסבר אחרת" | Audio Overview: "ask them to explain a concept differently" — [one-pager](https://services.google.com/fh/files/misc/gemininotebook_gfe_one_pager.pdf) | נדיר |
| מורה/דיאלוג סוקרטי, role-play | Coursera Coach; StudyFetch Sparky; Knowt Kai (חידון קולי) | נדיר |
| משחקים | Knowt, StudyFetch, Gizmo | נדיר |

#### 3.5 אינטראקציה
| יכולת | מי מציע (מקור) | שכיחות |
|---|---|---|
| לחיצה על כל נקודה → קפיצה לזמן | Glasp, Mapify (מצמתי המפה), BibiGPT, HARPA, Stream, YouTube Ask | נפוץ |
| תמליל מסונכרן לצד הנגן | Glasp ("full transcript sits beside the video"), Readwise (הדגשה בתמליל), Verbit Smart Player | נפוץ |
| צ'אט עם הסרטון + ציטוטים/זמנים | YouTube Ask, Stream (linked timestamps), Kaltura (קטעי וידאו), Gemini Notebook (ציטוטים), NoteGPT, HARPA | נפוץ |
| חיפוש בספרייה עם קפיצה לרגע | Panopto AI Search, WayinVideo, Fathom (בין שיחות), Read.ai, Notta, Recall | נפוץ (בפגישות) |
| סינתזה על פני כמה סרטונים | Panopto "Multi-video synthesis", Gemini Notebook | נדיר |
| שיתוף קטע מדויק | hyperaudio-lite (בחירת טקסט → URL עם תזמון) — [npm](https://registry.npmjs.org/hyperaudio-lite); Verbit clip sharing; Fathom clips | נדיר |

#### 3.6 התאמה אישית
| יכולת | מי מציע (מקור) | שכיחות |
|---|---|---|
| ניתוח לפי מטרת למידה | Gemini Notebook (learning objectives) — [PPC Land](https://ppc.land/google-expands-notebooklm-video-overviews-to-80-languages-worldwide/) | נדיר |
| מיקוד בנושאים | Mind Maps "focus on specific topics ... using a simple prompt" — [one-pager](https://services.google.com/fh/files/misc/gemininotebook_gfe_one_pager.pdf) | נדיר |
| "מה כדאי לי לצפות" | Stream: "identify relevant points you need to watch" — [Microsoft Support](https://support.microsoft.com/en-us/office/0b531ea9-2d9d-4830-97e4-2c1b2b8ca31d); Udemy: ניווט לתוכן הרלוונטי — [Udemy (תקציר)](https://business-support.udemy.com/hc/articles/26247590042647) | נדיר |
| לפי תפקיד/רמה | LinkedIn Learning — [LinkedIn](https://business.linkedin.com/learn/resources/learning-tech/linkedin-learning-ai-powered-coaching) | נדיר |
| לפי היסטוריית החזרות | אופטימייזר FSRS — [Anki manual](https://docs.ankiweb.net/deck-options.html) | — |

#### 3.7 שיתוף וייצוא
| יעד | מי מציע (מקור) | שכיחות |
|---|---|---|
| Markdown / Obsidian | HoverNotes, Mapify, BibiGPT, Readwise | נפוץ |
| PDF | Mapify, Notta, Gemini Notebook (PDF slide decks) | נפוץ |
| DOCX / SRT / TXT | Happy Scribe, Notta | נדיר |
| Notion / Readwise | BibiGPT, Readwise | נדיר |
| Anki | לא נמצא בכלי וידאו; NoteGPT מייצא ל־Quizlet/Cram — [tl;dv review](https://tldv.io/blog/notegpt-review/) | לא נמצא |
| EPUB | לא נמצא | לא נמצא |
| קישור שיתוף / שיתוף מחברת עם מעקב מעורבות | Mapify; Gemini Notebook ("Share your notebook with students and view how they're engaging") — [one-pager](https://services.google.com/fh/files/misc/gemininotebook_gfe_one_pager.pdf) | נפוץ |
| Slack / CRM | Fathom, tl;dv, Granola | נפוץ (עסקים) |
| API / MCP | Recall (גם בחינם), Castmagic, Granola | נדיר |

#### 3.8 מובייל, נגן ו־RTL
- אפליקציות מובייל: YouTube Ask ב־Android/iOS/טלוויזיה — [YouTube Help](https://support.google.com/youtube/answer/14110396?hl=en); Granola ל־iOS, Android ו־Apple Watch — [Granola](https://www.granola.ai/pricing); Turbo AI ‏4.8 בשתי החנויות — [Turbo AI](https://www.turbo.ai/); StudyFetch ‏4.9 מ־10K ביקורות — [StudyFetch](https://www.studyfetch.com/).
- חלונית צ'אט בצד בזמן ניגון — LinkedIn Learning — [UArk (תקציר)](https://uark.teamdynamix.com/TDClient/33/Portal/KB/Article/1452/LinkedIn-Learning-How-to-Access-AI-Coaching-Chat).
- חלון "תמיד למעלה" עם HTML חופשי (נגן + הערות): Document Picture-in-Picture — "not Baseline", רק ב־HTTPS, חלון אחד ללשונית, לא שורד את החלון שפתח אותו — [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Document_Picture-in-Picture_API).
- תמונה מקדימה בריחוף על ציר הזמן מתוך קובץ VTT של storyboard — [Media Chrome](https://www.media-chrome.org/docs/en/components/media-preview-thumbnail).
- טקסט מעורב עברית/אנגלית: `dir="auto"` סביב כל קטע שכיוונו לא ידוע, ו־`<bdi>` לבידוד ערכים מוזרקים; סימני פיסוק ניטרליים בקצוות הם מקור הבעיות — [W3C i18n](https://www.w3.org/International/articles/inline-bidi-markup/).

### Inferences
**יכולות שלא נמצאו אצל אף מוצר בסקירה — הזדמנויות לבידול ברור:**
1. גלריית שקופיות עם OCR דו־לשוני **והערה לכל שקופית** (מה נאמר עליה, בטווח הזמן שלה).
2. **מילון מונחים דו־לשוני** (מונח באנגלית ↔ הסבר בעברית, עם הרגע הראשון שבו הוגדר) — קריטי לדובר עברית שלומד מהרצאה באנגלית.
3. **מסגרות ומודלים** שהמרצה הציג (שלבים, מטריצות, נוסחאות) כאובייקטים נפרדים.
4. **מספרים ונתונים** מהשקופיות ומהדיבור בטבלה אחת עם מקור לכל מספר.
5. **ספרים, מאמרים, כלים וקישורים שהוזכרו** — רשימה עם זמן ההזכרה.
6. **הנחות, ביקורת ונקודות חלשות** + **שאלות פתוחות** ככתוב (קיים רק כפורמט אודיו).
7. **השוואת שני סרטונים** ו**סינתזה של קורס/פלייליסט** עם "מה חוזר, מה סותר, מה חדש בכל פרק".
8. **תצוגת עלות וזמן לפני עיבוד** (אורך, עומק, האם לנתח פריימים) — התלונה הנפוצה ביותר בשוק היא חיוב לא שקוף.
9. **זמן קריאה מול זמן צפייה** ו"מה אפשר לדלג" לפי מטרה שהמשתמש הגדיר.
10. **ייצוא ל־Anki ול־EPUB** (ה־EPUB נפתח ישירות ב־Academy), ותזמון חזרות FSRS בתוך האפליקציה.
11. **ניתוח לפי ז'אנר** (הרצאה אקדמית / וובינר מכירות / שיחת משקיעים / מדריך טכני) עם מבנה תוצר שונה לכל אחד.

**הכי נפוץ = סף כניסה (חייבים, לא מבדלים):** סיכום בכמה עומקים, פרקים, צ'אט עם ציטוטים, כרטיסיות ומבחנים, מפת חשיבה, תמליל מסונכרן, ייצוא Markdown/PDF.

### Gaps
- הקטלוג נבנה מעמודי מוצר; לא נבדקה בפועל איכות כל יכולת (למשל אם "data tables" מחלץ מספרים נכון).
- לא נמצאו מקורות להנחיות bottom sheet ולהיפוך (או אי־היפוך) של ציר הזמן ב־RTL — העמודים של Material ו־Apple נטענים ב־JS ולא נקראו.

---

## 4. דפוסי UX שבונים אמון בחותמות זמן מעוגנות — ותלונות הכשל הנפוצות

### Takeaway
האמון נבנה מ"הוכחה מתחת לאצבע": ציטוט צמוד לכל טענה עם ריחוף או לחיצה, חותמות זמן לחיצות בתוך התשובה, קטע וידאו או צילום מסך מהרגע עצמו. התלונות: חותמות "משוערות" או מחוץ לאורך הסרטון, השמטת אזהרות דקות, תלות בכתוביות, סיכומים גנריים או "קיר טקסט" — ובעיקר חיוב וקרדיטים. מכיוון שגלאי הזיות מגיעים רק לכ־50% דיוק, העיגון צריך להיות מובנה (חותמת שנגזרת מהתמלול עצמו), לא בדיקה בדיעבד.

### Cited Findings
**דפוסים שעובדים**
- ציטוט צמוד לכל טענה, בדיקה בריחוף: "I can always quickly vet the information myself by hovering over the citation next to each claim" — [XDA](https://www.xda-developers.com/i-dont-watch-youtube-videos-anymore-i-consume-them-using-notebooklm/); "in-line citations to ensure accuracy" — [Google one-pager](https://services.google.com/fh/files/misc/gemininotebook_gfe_one_pager.pdf).
- חותמות זמן לחיצות בתוך רשימת שלבים; הכותב ממליץ להשתמש בהן לאימות — [How-To Geek](https://www.howtogeek.com/youtubes-ask-button-just-solved-the-tutorial-problemand-i-wasnt-expecting-to-say-that/).
- "linked timestamps so you can jump to the spot in the video where the information came from" — [Microsoft Support (Stream)](https://support.microsoft.com/en-us/office/0b531ea9-2d9d-4830-97e4-2c1b2b8ca31d).
- תשובה ככרטיסייה עם key takeaways **וקטע וידאו** — [Kaltura (תקציר חיפוש)](https://knowledge.kaltura.com/help/ai-genie).
- שאלה בשפה חופשית → "jump straight to the exact moment" — [Panopto](https://www.panopto.com/capabilities/ai-capabilities.md).
- צמתים במפת חשיבה שמקפיצים לרגע בסרטון — [Mapify](https://mapify.so/).
- תמליל וסיכום זה לצד זה "for checking claims" — [Toolworthy (Video Highlight)](https://www.toolworthy.ai/en/blog/best-ai-video-summarizer).
- צילום מסך בזמן מדויק בתוך ההערה — [HoverNotes](https://hovernotes.io/); צילומי התוכן המוצג בתוך מסמך ההערות — [Workspace Updates](https://workspaceupdates.googleblog.com/2026/08/visual-screenshots-now-included-in-Google-Meet-meeting-notes.html).
- תמונה מקדימה בריחוף על ציר הזמן (VTT thumbnails) — [Media Chrome](https://www.media-chrome.org/docs/en/components/media-preview-thumbnail).
- בחירת טקסט בתמליל יוצרת URL עם נתוני תזמון שמוביל בדיוק לרגע — [hyperaudio-lite README](https://registry.npmjs.org/hyperaudio-lite).
- אדם בלולאה: ב־Panopto היוצר מפעיל ועורך פרקים וסיכומים — [Northwestern](https://services.northwestern.edu/TDClient/30/Portal/KB/Article/2960/Panopto-Access-AI-AI-Chapters-and-AI-Summaries); ב־Echo360 המרצה עורך שאלות ותשובות נכונות — [Clarkson (תקציר)](https://bookstack.clarkson.edu/books/instructor-guidebook-teaching-learning-at-clarkson-university/page/tips-for-using-ai-generated-study-aids).
- הנחיות אמון (Google PAIR): להציג מאילו נתונים התשובה נבנתה; ביטחון קטגוריאלי (גבוה/בינוני/נמוך) עם פעולה ברורה לכל קטגוריה; N-best כשהביטחון נמוך; "Numeric confidence indicators are risky"; לבקש בדיקה כפולה כשהסיכון גבוה — [PAIR Guidebook](https://pair.withgoogle.com/chapter/explainability-trust/).

**תלונות כשל נפוצות**
- חותמות משוערות: Gemini ב־YouTube מייצר "approximate timestamps" לסרטון בלי פרקים — [Android Police](https://www.androidpolice.com/ai-in-youtube-useful-for-this-one-feature/).
- חותמות שקופצות או חורגות מאורך הסרטון ב־Gemini 2.5 Pro (פוסט מ־5/6/2025); המלצות: לחלק לקטעים קצרים ולבקש MM:SS ("The model seems to understand MM:SS best"); שאלה מ־15/6/2026 אם הבעיה נפתרה ב־Gemini 3/3.1/3.5 לא נענתה, ובתגובה מ־13/7/2026 דווח על קיטוע גם בסרטונים של 5 ו־10 דקות — [Google AI Forum](https://discuss.ai.google.dev/t/gemini-2-5-pro-severe-timestamp-timecode-jumping-issues-in-video-transcription-need-workarounds/87242).
- טענה הפוכה (בלי בדיקה): חותמות של Gemini מדויקות ל־5–10 שניות כשהן מגיעות מתמליל YouTube; הוא מטפל טוב בעד שעה — [Implicator, 24/7/2025](https://www.implicator.ai/why-gemini-beats-chatgpt-at-youtube-analysis-by-watching-the-video).
- גלאי הזיות בסיכומים: "even the best hallucination detection models have near 50% accuracies" — [FaithBench, arXiv 2410.13210](https://arxiv.org/abs/2410.13210).
- השמטת אזהרות דקות, ותלות באיכות הסרטון ("can only work with the content that's in the video") — [How-To Geek](https://www.howtogeek.com/youtubes-ask-button-just-solved-the-tutorial-problemand-i-wasnt-expecting-to-say-that/).
- תלות בכתוביות: Glasp, Gemini Notebook, Kaltura, Stream (ראו שאלה 2); Glasp נשבר כש־YouTube או הדפדפן מתעדכנים — [Toolworthy](https://www.toolworthy.ai/en/blog/best-ai-video-summarizer).
- סיכומים גנריים או עמוסים: "wall of text", מפשטים תוכן עמוס נתונים, הצ'אט "not much different from a general LLM" — [tl;dv review](https://tldv.io/blog/notegpt-review/).
- חיוב וקרדיטים: "all credits are vanished" (1/8/2026), "Insufficient Basic Quota" במסלול Unlimited (NoteGPT השיב שההגבלה נבעה מנפח בקשות חריג) — [Trustpilot NoteGPT](https://www.trustpilot.com/review/notegpt.io); חיוב אחרי ביטול — [Trustpilot Fireflies](https://www.trustpilot.com/review/fireflies.ai); חיוב על 8 מושבים וחידוש אחרי ניסיון — [Trustpilot Otter](https://www.trustpilot.com/review/otter.ai); מגבלת 10 הדקות של tl;dv, ניסיון שהופך לשנתי ב־ScreenApp, מכסה חינמית של Summify — [Toolworthy](https://www.toolworthy.ai/en/blog/best-ai-video-summarizer).
- מגבלת שפות: "it doesn't have many languages" — [Trustpilot Otter](https://www.trustpilot.com/review/otter.ai).
- ביקורות חשודות: שש ביקורות G2 באותו יום במבנה כמעט זהה, וכפילויות ב־Trustpilot — [tl;dv review](https://tldv.io/blog/notegpt-review/).
- סטודנטים: 51% נרתעים מ־AI בגלל "false results or hallucinations" — [HEPI 2025](https://www.hepi.ac.uk/2025/02/26/student-generative-ai-survey-2025/).

### Inferences
**כללי עיצוב מוצעים לעיגון (מבוססי ממצאים):**
1. **חותמת זמן אף פעם לא מומצאת על ידי המודל**: המודל מצטט משפט/מזהה קטע; את השנייה מוציאים מתזמון המילים בתמלול שלנו (ומצמידים לתחילת המשפט). כך נמנעות חותמות "משוערות" או חורגות.
2. **בדיקת תקינות אוטומטית לכל ציטוט**: הזמן בתוך אורך הסרטון; הטקסט המצוטט (או פרפרזה קרובה) נמצא בחלון של ±N שניות; אחרת — הטענה מסומנת "לא אומת" ולא מוצגת כעובדה.
3. **צ'יפ ציטוט** (זמן + אייקון מקור: דיבור/שקופית) ליד כל טענה; ריחוף/לחיצה ארוכה פותחת **חלונית ראיות**: המשפט המקורי, תמונה ממוזערת של הפריים באותה שנייה, וכפתור "נגן מכאן".
4. **סימון ברור בין מצוטט, מסוכם ומוסק**: "נאמר במפורש" מול "מסקנה של המערכת" (רלוונטי במיוחד לביקורת ולהנחות).
5. **ביטחון קטגוריאלי בלבד** (למשל "עוגן מלא / חלקי / לא נמצא"), לא אחוזים.
6. **כרטיסייה ומבחן עם מקור**: כל כרטיסייה מקושרת לרגע שממנו נוצרה ("איפה זה הוסבר?").
7. **שקיפות עלות לפני ההרצה** והודעה ברורה כשמשהו נכשל ולמה — נגד התלונה הנפוצה ביותר בשוק.

### Gaps
- לא נמצא מחקר משתמשים ישיר על "chips" של זמן מול קישורים רגילים, או על ריחוף תמונה ממוזערת בתוך תשובה.
- תלונות Reddit ו־G2 לא נקראו (ראו פערים בשאלה 1).
- אין נתון כמותי על שיעור חותמות שגויות בכל מוצר.

---

## 5. אבני בניין בקוד פתוח ל־PWA — רישיון ובשלות (נבדק 9/11/2026)

### Takeaway
כל אבני הבניין קיימות ברישיונות מתירניים ובפיתוח פעיל ב־2026: markmap ו־Mermaid ‏(MIT), ‏ts-fsrs ‏(MIT, ‏FSRS-7), ‏anki-apkg-export ‏(MIT, עובד בדפדפן), docx/pdfmake/jsPDF ‏(MIT), ‏FlexSearch ‏(Apache-2.0, ‏charset עברי ו־RTL), ‏media-chrome ו־Video.js 10, ‏hyperaudio-lite ‏(MIT), ‏Tesseract (עברית). להיזהר: Vidstack בתחזוקת אבטחה בלבד; Lunr, ‏Paged.js, ‏epub-gen ו־vtt.js לא מתעדכנים; EbookLib, ‏PyMuPDF ו־lecture2notes ב־AGPL; משקולות Surya ברישיון מוגבל; Mermaid mindmap עדיין ניסיוני. תמיכת RTL בייצוא PDF ו־DOCX לא אומתה ודורשת ניסוי.

### Cited Findings
הורדות שבועיות מ־[npm downloads API](https://api.npmjs.org/downloads/point/last-week/mermaid) (שבוע אחרון לפני 9/11/2026); רישיון/גרסה/תאריך מה־registry (קישור בכל שורה).

**מפות חשיבה ודיאגרמות**
| חבילה | רישיון | גרסה (תאריך) | הורדות/שבוע | הערות | מקור |
|---|---|---|---|---|---|
| markmap-lib / markmap-view | MIT | 0.18.13 (6/11/2026) | 138K / 145K | Markdown → מפה אינטראקטיבית; קיפול, זום; תוויות עם קוד, נוסחאות, תמונות; הערות בפופאובר; ייצוא SVG/PNG/HTML לא מקוון; קישורי שיתוף בלי שרת; autoloader ו־`<markmap-view>` | [npm](https://registry.npmjs.org/markmap-lib), [markmap.js.org](https://markmap.js.org/) |
| mermaid | MIT | 12.3.0 (3/11/2026) | 26.0M | mindmap מסומן "experimental"; `securityLevel` ברירת מחדל `strict` (מקודד HTML, בלי קליקים), `sandbox` ב־iframe; `mermaid.parse()` לבדיקת תחביר לפני רינדור | [npm](https://registry.npmjs.org/mermaid), [mindmap](https://mermaid.js.org/syntax/mindmap.html), [usage](https://mermaid.js.org/config/usage.html) |
| cytoscape | MIT | 3.34.4 (15/10/2026) | 26.1M | גרפים/מפות מושגים | [npm](https://registry.npmjs.org/cytoscape) |
| @xyflow/react | MIT | 12.12.1 (2/11/2026) | 20.6M | React בלבד | [npm](https://registry.npmjs.org/@xyflow%2Freact) |
| @excalidraw/excalidraw | MIT | 0.18.1 (20/4/2026) | 1.4M | React | [npm](https://registry.npmjs.org/@excalidraw%2Fexcalidraw) |

**חזרה מרווחת ו־Anki**
| חבילה | רישיון | גרסה (תאריך) | הורדות/שבוע | הערות | מקור |
|---|---|---|---|---|---|
| ts-fsrs | MIT | 6.0.0 (28/10/2026) | 409K | תומך FSRS-3 עד FSRS-7; `DefaultScheduler()` משתמש ב־FSRS-7; `desiredRetention`, `learningSteps`; ב־Node דורש ‎>=24 | [npm README](https://registry.npmjs.org/ts-fsrs) |
| fsrs (py-fsrs) | MIT | 6.3.2 (9/8/2026) | — | לשרת בפייתון | [PyPI](https://pypi.org/pypi/fsrs/json) |
| anki-apkg-export | MIT | 5.0.0 (5/10/2026) | 1.7K | יוצר `.apkg` **בדפדפן** (sql.js WASM); front/back, הפוך, cloze, מדיה, תתי־חפיסות; נבדק מול Anki 26.09.3 | [npm README](https://registry.npmjs.org/anki-apkg-export) |
| genanki | MIT | 0.13.1 (12/11/2023) | — | פייתון; GUID קבוע מעדכן כרטיס קיים בייבוא חוזר; 2.8K כוכבים | [GitHub](https://github.com/kerrickstaley/genanki), [PyPI](https://pypi.org/pypi/genanki/json) |
- Anki: ‏FSRS הוא חלופה ל־SM-2 שעוזרת "remember more material in the same amount of time"; ברירת מחדל desired retention ‏90%, לא מעל 97%; נתמך ב־Anki 23.10+, ‏AnkiDroid 2.17+ — [Anki manual](https://docs.ankiweb.net/deck-options.html).
- מבחן ההשוואה של FSRS (כ־10,000 אוספים): FSRS-7 ‏Log Loss ‏0.3370 מול FSRS-6 ‏0.3460 ו־FSRS v3 ‏0.4364 — [srs-benchmark](https://github.com/open-spaced-repetition/srs-benchmark).

**ייצוא PDF / DOCX / EPUB**
| חבילה | רישיון | גרסה (תאריך) | הורדות/שבוע | הערות | מקור |
|---|---|---|---|---|---|
| pdfmake | MIT | 0.3.14 (8/11/2026) | 4.6M | PDF בצד הלקוח | [npm](https://registry.npmjs.org/pdfmake) |
| jspdf | MIT | 4.2.1 (17/3/2026) | 22.1M | | [npm](https://registry.npmjs.org/jspdf) |
| html2pdf.js | MIT | 0.14.0 (12/1/2026) | 1.6M | | [npm](https://registry.npmjs.org/html2pdf.js) |
| pagedjs | MIT | 0.4.3 (6/7/2023) | 428K | לא עודכן מאז 2023 | [npm](https://registry.npmjs.org/pagedjs) |
| docx | MIT | 9.15.3 (6/11/2026) | 11.4M | DOCX בדפדפן/Node | [npm](https://registry.npmjs.org/docx) |
| epub-gen-memory | MIT | 1.1.2 (29/7/2024) | 188K | | [npm](https://registry.npmjs.org/epub-gen-memory) |
| epub-gen | MIT | 0.1.0 (7/1/2019) | 1.7K | נטוש | [npm](https://registry.npmjs.org/epub-gen) |
| jszip | MIT או GPL-3.0+ | 3.10.2 (8/9/2026) | 71.5M | לבחור MIT; שימושי לבניית EPUB/ZIP בעצמנו | [npm](https://registry.npmjs.org/jszip) |
| WeasyPrint (פייתון) | BSD | 70.0 (8/9/2026) | — | HTML/CSS → PDF בשרת | [PyPI](https://pypi.org/pypi/weasyprint/json) |
| typst (קישור פייתון) | לא צוין ב־PyPI | 0.15.2 (5/11/2026) | — | | [PyPI](https://pypi.org/pypi/typst/json) |
| python-docx | MIT | 1.2.0 (16/6/2025) | — | | [PyPI](https://pypi.org/pypi/python-docx/json) |
| reportlab | BSD | 5.1.0 (22/10/2026) | — | | [PyPI](https://pypi.org/pypi/reportlab/json) |
| fpdf2 | LGPL-3.0 | 2.9.0 (29/10/2026) | — | | [PyPI](https://pypi.org/pypi/fpdf2/json) |
| EbookLib | **AGPL-3.0+** | 0.21 (1/11/2026) | — | רישיון מחייב — להימנע בשרת סגור | [PyPI](https://pypi.org/pypi/ebooklib/json) |
| PyMuPDF | **AGPL** או מסחרי | 2.1 (2/11/2026) | — | | [PyPI](https://pypi.org/pypi/pymupdf/json) |
| pypandoc | MIT (עוטף את pandoc) | 1.17 (14/3/2026) | — | | [PyPI](https://pypi.org/pypi/pypandoc/json) |

**חיפוש בצד הלקוח (כולל עברית)**
| חבילה | רישיון | גרסה (תאריך) | הורדות/שבוע | הערות | מקור |
|---|---|---|---|---|---|
| flexsearch | Apache-2.0 | 0.8.212 (6/9/2025) | 1.28M | charset "Hebrew", ‏`rtl: true`, encoder מותאם (`addStemmer` ועוד), שמירה ב־IndexedDB, Worker, אינדקס מסמכים, הדגשת תוצאות | [GitHub](https://github.com/nextapps-de/flexsearch), [npm](https://registry.npmjs.org/flexsearch) |
| minisearch | MIT | 7.2.0 (16/9/2025) | 6.3M | `tokenize` ו־`processTerm` מותאמים; prefix ו־fuzzy; auto-suggest; ‏6.2K כוכבים | [GitHub](https://github.com/lucaong/minisearch), [npm](https://registry.npmjs.org/minisearch) |
| @orama/orama | Apache-2.0 | 3.1.18 (19/12/2025) | 1.78M | "Stemming and tokenization in 30 languages" (עברית לא אומתה) | [npm README](https://registry.npmjs.org/@orama%2Forama) |
| pagefind | MIT | 1.6.0 (1/11/2026) | 3.47M | לעברית אין stemming; לאתרים סטטיים | [Pagefind](https://pagefind.app/docs/multilingual/), [npm](https://registry.npmjs.org/pagefind) |
| fuse.js | Apache-2.0 | 7.5.0 (13/7/2026) | 19.8M | חיפוש fuzzy | [npm](https://registry.npmjs.org/fuse.js) |
| lunr | MIT | 2.3.9 (19/8/2020) | 9.6M | לא עודכן מאז 2020; 14 שפות | [npm](https://registry.npmjs.org/lunr) |
| sql.js | MIT | 1.15.2 (26/10/2026) | 6.3M | SQLite ב־WASM | [npm](https://registry.npmjs.org/sql.js) |
| dexie | Apache-2.0 | 4.4.7 (19/10/2026) | 3.38M | IndexedDB | [npm](https://registry.npmjs.org/dexie) |

**נגן, תמליל מסונכרן, פרקים ו־YouTube**
| חבילה / API | רישיון | גרסה (תאריך) | הורדות/שבוע | הערות | מקור |
|---|---|---|---|---|---|
| hyperaudio-lite | MIT | 2.6.4 (4/8/2026) | 76 | תמליל אינטראקטיבי ~10KB בלי תלויות; לחיצה על מילה → קפיצה; חיפוש; שיתוף בחירה כ־URL; אינטגרציה ל־YouTube, Vimeo, Video.js, Vidstack; פורמט `data-m`/`data-d` במילישניות | [npm README](https://registry.npmjs.org/hyperaudio-lite) |
| ableplayer | MIT | 5.0.0 (21/6/2026) | 1.0K | | [npm](https://registry.npmjs.org/ableplayer) |
| media-chrome | MIT | 4.19.4 (23/10/2026) | 5.65M | רכיבי web; תמונה ממוזערת בריחוף מ־VTT | [npm](https://registry.npmjs.org/media-chrome), [docs](https://www.media-chrome.org/docs/en/components/media-preview-thumbnail) |
| video.js | Apache-2.0 | 10.3.0 (4/11/2026) | 1.59M | v10 "complete ground-up rewrite"; ממשק מופרד מהמנוע | [npm](https://registry.npmjs.org/video.js), [videojs.org](https://videojs.org/) |
| vidstack | MIT | 1.15.7 (6/10/2026) | 241K | **"security-only maintenance until January 2028"**, ממליץ לעבור ל־Video.js 10 | [npm README](https://registry.npmjs.org/vidstack) |
| plyr | MIT | 3.8.5 (6/10/2026) | 612K | | [npm](https://registry.npmjs.org/plyr) |
| youtube-player | BSD-3-Clause | 5.6.0 (13/2/2023) | 1.04M | לא עודכן מאז 2023 | [npm](https://registry.npmjs.org/youtube-player) |
| react-youtube | MIT | 10.1.0 (22/11/2022) | 898K | לא עודכן מאז 2022 | [npm](https://registry.npmjs.org/react-youtube) |
| @bbc/react-transcript-editor | MIT | 1.4.4 (28/6/2021) | 631 | נטוש | [npm](https://registry.npmjs.org/@bbc%2Freact-transcript-editor) |
| webvtt-parser (W3C) | CC0-1.0 | 2.2.0 (17/8/2022) | 137K | | [npm](https://registry.npmjs.org/webvtt-parser) |
| subtitle | MIT | 4.2.2 (16/11/2025) | 78K | SRT/VTT | [npm](https://registry.npmjs.org/subtitle) |
| vtt.js (Mozilla) | Apache-2.0 | 0.13.0 (3/1/2017) | 14K | נטוש | [npm](https://registry.npmjs.org/vtt.js) |
- YouTube IFrame API: ‏`seekTo(seconds, allowSeekAhead)`, ‏`getCurrentTime()`, ‏`getDuration()` (מחזיר 0 עד שהמטא־דאטה נטען), `cueVideoById` עם `startSeconds`/`endSeconds` שמקבלים float; נגן מוטמע לפחות 200×200; `enablejsapi=1` ו־`origin`; אירוע `onAutoplayBlocked` — [IFrame API](https://developers.google.com/youtube/iframe_api_reference).
- פרמטרים בכתובת ההטמעה: `start`/`end` במספר שלם של שניות; `cc_load_policy`, ‏`cc_lang_pref`, ‏`hl`, ‏`playsinline`; ‏`rel=0` מאז 2018 מציג סרטונים מאותו ערוץ — [Player parameters](https://developers.google.com/youtube/player_parameters). כפתור Ask לא מופיע בנגן המוטמע — [How-To Geek](https://www.howtogeek.com/youtubes-ask-button-just-solved-the-tutorial-problemand-i-wasnt-expecting-to-say-that/).
- `<track kind="chapters">` — "Chapter titles are intended to be used when the user is navigating the media resource"; קבצי WebVTT; קובץ ממקור אחר דורש `crossorigin` על אלמנט הווידאו — [MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/track).
- פרקים ב־YouTube: לפחות 3, ראשון ב־00:00, לפחות 10 שניות — [YouTube Help](https://support.google.com/youtube/answer/9884579?hl=en); ‏key moments בחיפוש: Clip/SeekToAction — [Search Central](https://developers.google.com/search/docs/appearance/structured-data/video).

**Markdown, סניטציה ונוסחאות**
| חבילה | רישיון | גרסה (תאריך) | הורדות/שבוע | מקור |
|---|---|---|---|---|
| marked | MIT | 18.1.3 (2/11/2026) | 127M | [npm](https://registry.npmjs.org/marked) |
| markdown-it | MIT | 15.0.3 (16/10/2026) | 39.5M | [npm](https://registry.npmjs.org/markdown-it) |
| dompurify | MPL-2.0 או Apache-2.0 | 3.4.17 (12/10/2026) | 99.9M | [npm](https://registry.npmjs.org/dompurify) |
| katex | MIT | 0.19.1 (23/10/2026) | 43.0M | [npm](https://registry.npmjs.org/katex) |
| react-markdown | MIT | 10.1.0 (7/3/2025) | 56.3M | [npm](https://registry.npmjs.org/react-markdown) |
- RTL: ‏`dir="auto"` סביב כל בלוק שכיוונו לא ידוע ו־`<bdi>` לערכים מוזרקים — [W3C i18n](https://www.w3.org/International/articles/inline-bidi-markup/).

**עיבוד חזותי בשרת (שקופיות ו־OCR)**
| חבילה | רישיון | גרסה (תאריך) | הערות | מקור |
|---|---|---|---|---|
| tesseract.js | Apache-2.0 | 7.0.0 (15/12/2025), ‏5.9M/שבוע | Tesseract כולל `heb` ו־`yid` | [npm](https://registry.npmjs.org/tesseract.js), [tessdoc](https://tesseract-ocr.github.io/tessdoc/Data-Files-in-different-versions.html) |
| PySceneDetect | BSD-3-Clause | 0.7.3 (8/11/2026) | גלאים: Adaptive (ברירת מחדל), Content, Hash, Histogram, Threshold | [PyPI](https://pypi.org/pypi/scenedetect/json), [docs](https://www.scenedetect.com/docs/latest/) |
| PaddleOCR | Apache-2.0 | 3.7.0 (11/6/2026) | "100+ Languages"; ‏PP-OCRv6 ‏50 שפות במודל אחד (סינית, אנגלית, יפנית ו־46 בכתב לטיני) — עברית לא אומתה | [PyPI](https://pypi.org/pypi/paddleocr/json) |
| docTR | Apache-2.0 | 1.1.0 (21/8/2026), Beta | | [PyPI](https://pypi.org/pypi/python-doctr/json) |
| Surya | קוד Apache-2.0; **משקולות OpenRAIL-M מותאם** (חינם למחקר, אישי ולחברות מתחת ל־$5M) | 0.23.0 (29/10/2026) | 74.9% על 91 שפות במבחן פנימי | [PyPI](https://pypi.org/pypi/surya-ocr/json) |
| lecture2notes | **AGPL-3.0** | — | שרשרת מחקרית: חילוץ פריימים → סיווג שקופיות → חיתוך פרספקטיבה → אשכול כפילויות → OCR → חילוץ איורים → תמלול → סיכום; 67 כוכבים | [GitHub](https://github.com/HHousen/lecture2notes) |
| yt-dlp | Unlicense | 2026.10.26 | | [PyPI](https://pypi.org/pypi/yt-dlp/json) |
| faiss-cpu / sqlite-vec | MIT / MIT+Apache | 1.15.1 / 0.1.9 | חיפוש סמנטי | [PyPI](https://pypi.org/pypi/faiss-cpu/json), [PyPI](https://pypi.org/pypi/sqlite-vec/json) |

### Inferences
- **סט מומלץ ל־PWA בלי React** (האפליקציה שלנו vanilla JS): ‏markmap-view/autoloader למפות; Mermaid ב־`strict` או `sandbox` לדיאגרמות (הטקסט מגיע ממודל, לכן לא אמין); ‏ts-fsrs לתזמון חזרות; ‏anki-apkg-export לייצוא בדפדפן; ‏docx ל־DOCX; ‏EPUB נבנה בעצמנו עם jszip (עדיף על epub-gen הנטוש ועל EbookLib שב־AGPL) — כך גם Academy פותחת אותו ישירות; FlexSearch עם charset עברי, או MiniSearch עם `tokenize`/`processTerm` מותאמים שמאנדקסים כל מילה גם בצורתה המלאה וגם בלי אותיות השימוש (ו/ה/ב/ל/מ/ש/כ), כדי ש"בבית" ימצא "בית" — בלי הסרה עיוורת, שהופכת "ברק" ל"רק"; תמליל מסונכרן בתבנית של hyperaudio-lite (`data-m` לכל מילה) מעל ה־IFrame API; ‏media-chrome לתמונות ממוזערות על ציר הזמן.
- **PDF בעברית**: לא אומתה תמיכה ב־RTL בספריות הדפדפן. כדאי לבדוק מוקדם PDF בשרת (WeasyPrint או Typst) מול pdfmake — ולבחור לפי מבחן אמיתי עם עברית, אנגלית ומספרים באותה שורה.
- **שקופיות**: PySceneDetect (BSD) לגילוי מעברים + Tesseract (`heb+eng`) כ־OCR בסיסי במעבד; מודל רב־אופני רק לפריימים מייצגים. lecture2notes מתאר שרשרת שימושית אבל ב־AGPL — ללמוד מהשלבים, לא להעתיק קוד.
- **להימנע**: Vidstack (תחזוקת אבטחה בלבד), ‏react-transcript-editor, ‏vtt.js, ‏epub-gen ו־Lunr (נטושים), ‏Paged.js (לא עודכן מ־2023), רישיונות AGPL.
- ציר הזמן של `start` בכתובת ההטמעה הוא בשניות שלמות, ו־`seekTo` ב־API — לכן קפיצה מדויקת מתבצעת דרך ה־API ולא דרך הכתובת.

### Gaps
- לא נבדקה תמיכה בעברית/RTL ב־pdfmake, ‏jsPDF, ‏docx, ‏Typst ו־WeasyPrint.
- לא אומת אם Orama ו־PaddleOCR תומכים בעברית; איכות OCR עברית של Surya לא נבדקה.
- לא נקראו README של ableplayer ו־media-chrome על תמליל אינטראקטיבי; לא נבדק רכיב YouTube ל־media-chrome.
- נתוני GitHub (כוכבים, פעילות) לא זמינים בסשן הזה ל־API — הבשלות נמדדה בהורדות npm ובתאריכי גרסה.

---

## 6. מה סטודנטים רוצים מול מה אנשי עסקים רוצים — וכמה הם מוכנים לשלם

### Takeaway
סטודנטים: שימוש כמעט אוניברסלי ב־AI ‏(95% ב־HEPI 2026), עם חשש מהזיות (51% ב־2025) ומהאשמות בהעתקה (53%). הם רוצים הסבר מושגים, סיכומים ותרגול (כרטיסיות ומבחנים), ובוחרים חינם; מחירי היעד בשוק $8–$10 לחודש בשנתי, עם הנחות סטודנט של 20%–50%. עסקים: משלמים $15–$40 למושב לחודש על זרימות עבודה (משימות, סנכרון CRM, חיפוש בין פגישות, אבטחה וציות) ועל חיסכון בזמן בעולם של פגישות אד־הוק והפרעות. לא נמצא סקר ישיר על נכונות לשלם על ניתוח וידאו, ולא נתונים ישראליים.

### Cited Findings
**סטודנטים — שימוש, צרכים, חששות**
- HEPI 2025 (‏1,041 סטודנטים, דצמבר 2024): 92% משתמשים ב־AI ‏(66% שנה קודם), 88% לעבודות מוערכות; השימושים המובילים: הסבר מושגים, סיכום מאמרים והצעת רעיונות למחקר; חששות: האשמה בהעתקה 53%, תוצאות שגויות/הזיות 51% — [HEPI 2025](https://www.hepi.ac.uk/2025/02/26/student-generative-ai-survey-2025/).
- HEPI 2026 (‏1,054 סטודנטים, דצמבר 2025, פורסם 12/3/2026): 95% משתמשים; 94% לעבודות מוערכות; 12% מכניסים טקסט AI ישירות (8% ב־2025); 68% רואים במיומנות AI דבר חיוני אבל רק 48% מרגישים שהסגל עוזר; 38% מקבלים כלים מהמוסד — [HEPI 2026](https://www.hepi.ac.uk/reports/student-generative-ai-survey-2026/).
- Tyton Partners (יוני 2025, 3,300+ משיבים ב־900+ מוסדות בארה"ב): "Weekly GenAI use now spans 42% of students" — [Tyton](https://tytonpartners.com/time-for-class-2025/).
- Digital Education Council (אוגוסט 2024): 3,839 משיבים ב־16 מדינות; הנתונים עצמם רק בדוח שמחייב הרשמה — [DEC](https://www.digitaleducationcouncil.com/post/digital-education-council-global-ai-student-survey-2024).
- אימוץ כלים: "At least 700,000 of 1.3 million students used Knowt for the May 2025 AP season" — [Knowt](https://knowt.com/); Turbo AI ‏"10,000,000+ learners" — [Turbo AI](https://www.turbo.ai/); StudyFetch ‏8M+ — [StudyFetch](https://www.studyfetch.com/).
- ערך מוכח בפלטפורמה: Coursera Coach — "9.5% higher quiz pass rate on the first attempt" — [Coursera Blog](https://blog.coursera.org/announcing-ai-powered-capabilities-enabling-educators-to-use-coursera-coach-to-deliver-interactive-personalized-instruction).
- תרחיש חזק: מדריכים ארוכים ומרוחים — שואלים במקום לצפות, ומשתמשים בחותמות לבדיקה — [How-To Geek](https://www.howtogeek.com/youtubes-ask-button-just-solved-the-tutorial-problemand-i-wasnt-expecting-to-say-that/); "I don't need to worry about the AI hallucinating" כשהתשובה מוגבלת למקור — [XDA](https://www.xda-developers.com/i-dont-watch-youtube-videos-anymore-i-consume-them-using-notebooklm/).

**סטודנטים — מחיר**
- מחירים והנחות (נבדק 9/11/2026): Otter ל־.edu ‏$79.99 לשנה — [Otter](https://otter.ai/pricing); Readwise ‏50% הנחה — [Readwise](https://readwise.io/read); Recall ‏20% — [Recall](https://www.recall.it/pricing); Notta ‏50% לחינוך — [Scrimba](https://scrimba.com/articles/best-ai-video-summarizers-2026/); RemNote $8/$18 — [RemNote](https://www.remnote.com/pricing); NoteGPT מ־$9 — [NoteGPT](https://notegpt.io/pricing); Glasp מ־$15 — [Glasp](https://glasp.co/youtube-summary); HoverNotes ‏$18 — [HoverNotes](https://hovernotes.io/).
- Knowt מוכר את עצמו מול כלים בתשלום: כרטיסיות חינם ומבחני תרגול בלי הגבלה — [Knowt](https://knowt.com/).
- Gemini Notebook חינם ל־Google Workspace for Education "with enterprise-grade data protection", עם מכסות יומיות ושדרוג בתשלום — [Google one-pager](https://services.google.com/fh/files/misc/gemininotebook_gfe_one_pager.pdf).
- רגישות למחיר בביקורות: "US$9/month is a rip-off" על כלי סיכום YouTube — [Trustpilot NoteGPT](https://www.trustpilot.com/review/notegpt.io).

**אנשי עסקים — צרכים ומחיר**
- עומס פגישות: 57% מהפגישות אד־הוק בלי זימון; הפרעה כל 2 דקות (275 ביום); פגישות אחרי 20:00 עלו ב־16% — [Microsoft Work Trend Index, 17/6/2025](https://www.microsoft.com/en-us/worklab/work-trend-index/breaking-down-infinite-workday).
- על מה משלמים (עמודי מחירים, 9/11/2026): Fathom Business — סנכרון שדות CRM, ‏Deal View, מדדי אימון ו־AI scorecards; Enterprise — SSO/SCIM ו־BAA — [Fathom](https://www.fathom.ai/pricing); Read.ai — חיפוש עם LLM, אירוח באיחוד האירופי, HIPAA — [Read.ai](https://www.read.ai/pricing); Granola — סיכום לפני פגישה, מייל המשך, HubSpot/Salesforce, ‏API/MCP — [Granola](https://www.granola.ai/pricing); Loom — וידאו → SOP וטיקטים — [Loom](https://www.loom.com/ai).
- רצועת מחיר למושב לחודש: Fireflies ‏$10–$39 — [Scrimba](https://scrimba.com/articles/best-ai-video-summarizers-2026/); Otter ‏$8.33–$30 — [Otter](https://otter.ai/pricing); Fathom ‏$15–$35 — [Fathom](https://www.fathom.ai/pricing); Read.ai ‏$15–$39.75 — [Read.ai](https://www.read.ai/pricing); tl;dv ‏€18–€39 — [tl;dv](https://tldv.io/pricing/); Granola ‏$14–$35 — [Granola](https://www.granola.ai/pricing); Notta ‏$8.17–$16.67 — [Notta](https://www.notta.ai/en/pricing).
- יוצרי תוכן ומשווקים: Castmagic ‏$19–$139 לחודש — [Castmagic](https://www.castmagic.io/pricing); OpusClip ‏$15–$29 — [OpusClip](https://www.opus.pro/pricing); Descript ‏$16–$24 — [Toolworthy](https://www.toolworthy.ai/en/blog/best-ai-video-summarizer).
- אנשי עסקים מתלוננים בעיקר על חיוב ומושבים, פחות על איכות — [Trustpilot Otter](https://www.trustpilot.com/review/otter.ai), [Trustpilot Fireflies](https://www.trustpilot.com/review/fireflies.ai).

### Inferences
- **שני מצבי עבודה באותה לשונית**: "לימוד" (מושגים, מילון דו־לשוני, כרטיסיות FSRS, מבחן, ייצוא ל־Academy/Anki) ו"עסקים" (TL;DR, החלטות ומספרים, פעולות, ציטוטים לשיתוף, תשובה לשאלה "מה כדאי לי לצפות"). אותו ניתוח בסיס, תצוגה ותוצרים שונים.
- **מחיר**: לסטודנט — מסלול חינמי שימושי (למשל מספר סרטונים בחודש בעומק בסיסי) ושנתי בטווח $5–$9 לחודש; לעסק — לפי היקף שעות/עומק, עם תצוגת עלות מראש. זה ניחוש מבוסס מחירי השוק, לא נתון מסקר.
- **אמון ככסף**: 51% מהסטודנטים נרתעים בגלל הזיות; עיגון מוכח לכל טענה הוא גם יתרון שיווקי.
- **עברית**: הקהל שלנו צורך בעיקר הרצאות באנגלית — סיכום בעברית עם המונחים המקוריים באנגלית, וחיפוש בעברית על תוכן באנגלית, הם הצורך הייחודי.

### Gaps
- לא נמצא סקר שמודד נכונות לשלם על כלי סיכום/ניתוח וידאו (לסטודנטים או לעסקים); ההערכות מבוססות על מחירי מוצרים.
- אין נתונים על סטודנטים או עובדים בישראל; סקרי HEPI הם בריטניה, Tyton ארה"ב.
- נתוני DEC 2024 (שימושים מובילים, כלים) לא נגישים בלי הרשמה; סקרי Quizlet ו־Chegg לא נקראו (403 או כתובת לא ידועה).
- לא נמצא מחקר משתמשים על ההבדל בין צרכי סטודנטים וצרכי עסקים בכלי וידאו דווקא.
