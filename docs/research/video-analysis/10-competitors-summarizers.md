# המתחרים בקטגוריית מסכמי וידאו/YouTube מבוססי AI ותוספי דפדפן — ניתוח עומק לכל מוצר, מטריצת השוואה ומרחב לבן (מצב 9/11/2026)

> מחקר 9/11/2026 עבור לשונית "ניתוח וידאו" ב־THE SNOWBALL Studio. ממשיך את סעיף 1ב בקובץ `06-market-features-ux.md` ומעמיק בו (לא חוזר עליו — כשנתון נלקח משם זה מצוין).
> **שיטה:** כ־35 חיפושים עד שתקציב החיפוש המשותף (200 לכל הסוכנים) נגמר באמצע העבודה, ואחריהם כ־115 קריאות ישירות: עמודי מוצר, מחירים, מרכזי עזרה, יומני שינויים, רישומי Chrome Web Store (כולל עמודי הביקורות `/reviews`), App Store, Product Hunt, Trustpilot, GitHub ומאמרי השוואה מ־2026. **לא נטענו:** Reddit, G2, Capterra, AlternativeTo, There's An AI For That (403), Google Play (העמוד חזר ריק), אתרי Eightify/Merlin/Sider/WayinVideo (403 לרוב העמודים), עמודי המחירים של Monica/Readray/BibiGPT (נטענים ב־JS).
> **סימונים:** "(נבדק 9/11/2026)" = העמוד נקרא היום · "(תקציר חיפוש)" = נלקח מתקציר תוצאת חיפוש ולא מקריאת העמוד המלא · "(טענת היצרן)" · "(מקור של מתחרה)" = מאמר השוואה שכתב מוצר מתחרה — להתייחס בזהירות · CWS = Chrome Web Store; מספרי משתמשים, ציונים ותאריכי עדכון ב־CWS — כפי שהוצגו ב־9/11/2026. "שפות ממשק ב־CWS" = רשימת השפות שהרישום מציג (סימן ללוקליזציה של הממשק, לא ראיה לאיכות הניתוח בעברית).
> **כלל ניסוח (בנייה נקייה):** תיאור עובדתי בלבד ("X מציע Y"); לא הועתקו טקסטים מעבר לציטוטים קצרים; ההזדמנויות שלנו מנוסחות באופן כללי. כתובות מייל וטלפונים של מפתחים הושמטו בכוונה (הריפו ציבורי).

---

## שאלה 1: מי השחקנים ומה בדיוק כל אחד עושה — כרטיסי עומק לכל מוצר

### Takeaway
רוב המוצרים הגדולים בקטגוריה (Sider ‏5M, ‏Monica ‏3M, ‏Glasp ‏2M, ‏Merlin ‏900K, ‏NoteGPT ‏400K, ‏HARPA ‏400K, ‏Eightify ‏200K משתמשים ב־CWS) עדיין **מבוססי תמליל בלבד**: מושכים כתוביות, שולחים למודל שפה, ומציגים נקודות עם חותמת זמן של מקטע הכתובית. החזית ב־2025–2026 עברה לשלושה כיוונים: (א) **ראייה** — BibiGPT (חילוץ שקופיות, OCR של כתוביות צרובות, ניתוח פריימים במודלי ראייה, אפריל 2026), Readray (לשעבר LilysAI — פריימים בתוך ההערות), HoverNotes (הערות מקטעי וידאו + צילומי מסך), ScreenApp (Video OCR, פריימים בצ'אט); (ב) **מאגרי ידע עם MCP** — Recall, Video Highlight, Summify, Readray, Glasp, BibiGPT; (ג) **הפלטפורמה עצמה** — כפתור Ask של YouTube (כולל עברית, על סרטונים נבחרים) ו־Ask YouTube (חיפוש שיחתי, ארה"ב/אנגלית). אף מוצר לא מתעד חותמות זמן ברמת מילה, ואף אחד לא מציג עברית כשפה ראשונה.

### Cited Findings

#### 1. Eightify
- **מה זה, חברה, שנה, קהל, מיצוב:** תוסף ואפליקציה שמסכמים סרטוני YouTube ל"insights" עם חותמות זמן, מיצוב של מהירות ("in just 5 seconds"); המפתחת Rational Expressions, Inc. מסן פרנסיסקו; מסומן "Featured" — [CWS (נבדק 9/11/2026)](https://chromewebstore.google.com/detail/eightify-ai-youtube-summa/cdcpabkolgalpgeingbdcebojebfelgb). הושק ב־Product Hunt ב־17/1/2023 ("Turn Youtube videos into summaries using GPT"), מקום 4 באותו יום, 481 נקודות — [Product Hunt](https://www.producthunt.com/products/eightify-ai-youtube-summary/launches). שותף־מייסד Alex Kataev (CTO ב־Skyeng לפי הביוגרפיה באתר) — [eightify.app (תקציר חיפוש)](https://eightify.app/media/author/alex-kataev). השם נגזר מהמבנה המקורי: סיכום של 8 רעיונות מפתח — [Product Hunt (תקציר חיפוש)](https://www.producthunt.com/posts/eightify).
- **קלט:** YouTube בלבד ("works only with YouTube") — [בלוג Readray/LilysAI (מקור של מתחרה, 10/9/2026)](https://lilys.ai/blog/en/free-youtube-summarizer-for-long-videos-2026/). אורך: "up to 10 hours" — [CWS](https://chromewebstore.google.com/detail/eightify-ai-youtube-summa/cdcpabkolgalpgeingbdcebojebfelgb); בגרסת Safari "4–6 hours" — [App Store Safari](https://apps.apple.com/us/app/eightify-for-safari/id6448126776); מתחרה טוען תקרה של כשעה — [BibiGPT (מקור של מתחרה)](https://www.bibigpt.co/en/blog/posts/youtube-video-summarizer-tools-comprehensive-guide-2026). סרטונים ארוכים דורשים מסלול בתשלום — [Readray blog (מקור של מתחרה)](https://lilys.ai/blog/en/free-youtube-summarizer-for-long-videos-2026/).
- **עיבוד:** תמליל + LLM; "Powered by Claude and ChatGPT"; "Transcript generator" שמוצג כטוב יותר מכתוביות YouTube — [CWS](https://chromewebstore.google.com/detail/eightify-ai-youtube-summa/cdcpabkolgalpgeingbdcebojebfelgb). בגרסת Safari (2024): "powered by OpenAI ChatGPT API" — [App Store Safari](https://apps.apple.com/us/app/eightify-for-safari/id6448126776). מה קורה כשאין כתוביות — **לא נמצא**. אין שום טענה לניתוח פריימים.
- **פלטים:** תקציר TLDR, key insights, סקירת התגובות המובילות (Top comments overview), תמליל, סיכום ותרגום ב־"40+ languages"; התאמה אישית: מוקד ("insightful, actionable, controversial, funny"), פורמט (רשימה או שאלות־תשובות), אורך, קיבוץ, אימוג'י וכותרות לאשכולות — [CWS](https://chromewebstore.google.com/detail/eightify-ai-youtube-summa/cdcpabkolgalpgeingbdcebojebfelgb).
- **חותמות זמן ועיגון:** "Timestamped navigation to jump to important parts" — [CWS](https://chromewebstore.google.com/detail/eightify-ai-youtube-summa/cdcpabkolgalpgeingbdcebojebfelgb); הרעיונות מוצגים עם זמנים ישירות בעמוד YouTube — [Video Highlight vs Eightify (מקור של מתחרה, 7/2026)](https://videohighlight.com/vs/eightify). תלונות על זמנים שגויים — **לא נמצאו**.
- **תוכן חזותי:** **לא נמצא** (אין צילומי מסך, OCR או קריאת שקופיות).
- **למידה, צ'אט, ספרייה:** אין צ'אט המשך — [Readray blog (מקור של מתחרה)](https://lilys.ai/blog/en/free-youtube-summarizer-for-long-videos-2026/); אין ספרייה/חיפוש בין סרטונים — [Video Highlight vs Eightify (מקור של מתחרה)](https://videohighlight.com/vs/eightify).
- **ייצוא ואינטגרציות:** שיתוף סיכומים — [App Store](https://apps.apple.com/us/app/eightify-ai-youtube-summarizer/id6467562658); לפי מתחרה רק "Copy text" — [Video Highlight vs Eightify](https://videohighlight.com/vs/eightify).
- **פלטפורמות:** Chrome, ‏Safari (Mac), ‏iOS, ‏Android; חשבון אחד ל־Chrome/iOS/Android — [CWS](https://chromewebstore.google.com/detail/eightify-ai-youtube-summa/cdcpabkolgalpgeingbdcebojebfelgb); [App Store](https://apps.apple.com/us/app/eightify-ai-youtube-summarizer/id6467562658).
- **מחירים (נבדק 9/11/2026):** iOS — ‏$9.99 לחודש או $59.99 לשנה — [App Store](https://apps.apple.com/us/app/eightify-ai-youtube-summarizer/id6467562658); Safari — ‏$4.99 לחודש או $49.99 לשנה — [App Store Safari](https://apps.apple.com/us/app/eightify-for-safari/id6448126776); ב־CWS ניסיון של 7 ימים, "No charge until trial ends" — [CWS](https://chromewebstore.google.com/detail/eightify-ai-youtube-summa/cdcpabkolgalpgeingbdcebojebfelgb). המסלול החינמי סותר בין מקורות: "3 summaries a day" (צד שלישי) מול "one video under 30 minutes a day" (מבקרים ב־Google Play) — [Readray blog (מקור של מתחרה)](https://lilys.ai/blog/en/free-youtube-summarizer-for-long-videos-2026/). עמוד המחירים באתר מחזיר Not Found — [Scrimba, 11/8/2026](https://scrimba.com/articles/best-ai-video-summarizers-2026/). הנחת סטודנטים — **לא נמצאה**.
- **עברית/RTL:** עברית מופיעה ברשימת 52 שפות הממשק — [CWS](https://chromewebstore.google.com/detail/eightify-ai-youtube-summa/cdcpabkolgalpgeingbdcebojebfelgb). איכות הסיכום בעברית — **לא נמצא**.
- **פרטיות:** CWS מצהיר על איסוף PII — [CWS](https://chromewebstore.google.com/detail/eightify-ai-youtube-summa/cdcpabkolgalpgeingbdcebojebfelgb); תוויות הפרטיות של גרסת Safari כוללות היסטוריית גלישה ונתוני שימוש המקושרים למשתמש, לשימושי פרסום/שיווק ואנליטיקה — [App Store Safari](https://apps.apple.com/us/app/eightify-for-safari/id6448126776).
- **2025–2026:** גרסת CWS ‏1.643 עודכנה לאחרונה ב־14/11/2025 — [CWS](https://chromewebstore.google.com/detail/eightify-ai-youtube-summa/cdcpabkolgalpgeingbdcebojebfelgb); iOS ‏13.0.76 ב־3/4/2025 — [App Store](https://apps.apple.com/us/app/eightify-ai-youtube-summarizer/id6467562658); Safari ‏1.0.7 ב־11/10/2024 — [App Store Safari](https://apps.apple.com/us/app/eightify-for-safari/id6448126776). **לא נמצא שום עדכון ב־2026.**
- **ביקורות:** CWS ‏4.0 (862 דירוגים), 200,000 משתמשים — [CWS](https://chromewebstore.google.com/detail/eightify-ai-youtube-summa/cdcpabkolgalpgeingbdcebojebfelgb); iOS ‏4.3 (146) — [App Store](https://apps.apple.com/us/app/eightify-ai-youtube-summarizer/id6467562658); Google Play כ־3.6 מכ־2.3K ביקורות, 100K+ הורדות — [Google Play (תקציר חיפוש)](https://play.google.com/store/apps/details?id=com.eightify&hl=en_US). תלונות: "They hide the cost until the very end" (27/7/2026), "it has screwed up the layout of youtube" (5/11/2026), בקשה לתמיכה ב־Shorts (19/10/2026); שבח: "Helps me understand the videos a lot faster" (26/7/2026) — [CWS reviews](https://chromewebstore.google.com/detail/eightify-ai-youtube-summa/cdcpabkolgalpgeingbdcebojebfelgb/reviews). ב־App Store: חיוב של $65 אחרי ביטול (16/4/2024) ודרישת תשלום אחרי הסיכום הראשון (28/4/2025) — [App Store](https://apps.apple.com/us/app/eightify-ai-youtube-summarizer/id6467562658); בגרסת Safari: "the summarize button but it does not do anything" (16/2/2025) — [App Store Safari](https://apps.apple.com/us/app/eightify-for-safari/id6448126776).
- **חוזקות / חולשות / לקח:** חוזקה — פורמט קצר וחד של "רעיונות + זמן" והתאמת מוקד (כולל "controversial"); חולשות — YouTube בלבד, בלי צ'אט, בלי ספרייה, תמחור מוסתר עד אחרי ההרשמה, ובלי עדכונים ב־2026. לקח כללי: פורמט "רעיונות מפתח עם זמנים" הפך למצרך; ערך עמיד דורש עומק, ספרייה ושקיפות מחיר.

#### 2. Glasp — ‏YouTube Summary with ChatGPT & Claude
- **מה זה, חברה, שנה, קהל, מיצוב:** תוסף מבית GLASP INC (סן פרנסיסקו) — רשת הדגשות חברתית שהוסיפה סיכום YouTube; 2,000,000 משתמשים ב־CWS, ‏4.2 מ־4.1K דירוגים, "Featured" — [CWS (נבדק 9/11/2026)](https://chromewebstore.google.com/detail/youtube-summary-with-chat/nmmicjeknamkfloonkhhcjmomieiodli). המייסדים Kei ו־Kazuki Nakayashiki; החברה מתארת צמיחה "from 0 to 3 million users" — [Glasp About](https://glasp.co/about). מיצוב: חינמי, בחירת מודל, תמליל לצד הסרטון — [Glasp YouTube Summary](https://glasp.co/youtube-summary).
- **קלט:** YouTube, מאמרים, ניוזלטרים ו־PDF ברשת; בלשוניות גם "YouTube Channel" ו־"Local Audio" — [Glasp YouTube Summary](https://glasp.co/youtube-summary); מעקב ערוצים (1/5/25 ערוצים לפי מסלול) ותמלול אודיו (30/300/1,500 דקות בחודש) — [Glasp Pricing](https://glasp.co/pricing). אורך מרבי — **לא נמצא** (מתחרה טוען שעתיים — [BibiGPT (מקור של מתחרה)](https://www.bibigpt.co/en/blog/posts/youtube-video-summarizer-tools-comprehensive-guide-2026)).
- **עיבוד:** תמליל בלבד, בכל שפה ש־YouTube מספק לה כתוביות — [Glasp YouTube Summary](https://glasp.co/youtube-summary); במצב החינמי התמליל נשלח ל־ChatGPT/‏Claude/‏Gemini בלשונית חדשה — [Glasp YouTube Summary](https://glasp.co/youtube-summary); מודלים OpenAI, ‏Anthropic, ‏Mistral, ‏Google — [CWS](https://chromewebstore.google.com/detail/youtube-summary-with-chat/nmmicjeknamkfloonkhhcjmomieiodli); מודלים "Balanced and Deep" במסלולים בתשלום — [Glasp Pricing](https://glasp.co/pricing). תלוי בכתוביות; כתוביות אוטומטיות גרועות פוגעות בפלט — [Toolworthy, עודכן 15/8/2026](https://www.toolworthy.ai/en/blog/best-ai-video-summarizer).
- **פלטים:** סיכום עם או בלי חותמות זמן; אורך ומספר נקודות מפתח; פרומפט מותאם; שפת סיכום לבחירה (לא חייבת להיות שפת הסרטון); תמליל מלא לצד הסרטון עם העתקה "with timestamps"; הדגשת שורות בתמליל והערות — [Glasp YouTube Summary](https://glasp.co/youtube-summary). מ־7/2026: סרגל צד אחד עם Transcript, ‏Summary, ‏Chat ו־Highlights; הצ'אט עונה "based on what was said" עם פרומפטים מוכנים — [Glasp newsletter, 5/8/2026](https://read.glasp.co/p/the-highlights-by-glasp-july-2026).
- **חותמות זמן ועיגון:** לחיצה על נקודת מפתח מזיזה את הנגן; גם זמני התמליל לחיצים; תשובות הצ'אט מצטטות זמנים מהתמליל — [Glasp YouTube Summary](https://glasp.co/youtube-summary). התמליל עבר לסרגל של Glasp עצמו כדי לשרוד שינויי עיצוב של YouTube — [Glasp newsletter](https://read.glasp.co/p/the-highlights-by-glasp-july-2026).
- **תוכן חזותי:** **אין** — מבוסס כתוביות בלבד — [Toolworthy](https://www.toolworthy.ai/en/blog/best-ai-video-summarizer).
- **למידה, צ'אט, ספרייה:** הצ'אט נשען גם על ההדגשות וההערות שלך — [Glasp YouTube Summary](https://glasp.co/youtube-summary); AI Overview ו־Suggested Highlights (המודל מציע משפטים להדגשה); ייצוא הדגשות ל־Anki — [Glasp newsletter](https://read.glasp.co/p/the-highlights-by-glasp-july-2026). מבחנים/כרטיסיות שנוצרים אוטומטית — **לא נמצא**.
- **ייצוא ואינטגרציות:** Notion (סנכרון יומי), ‏Obsidian, ‏Roam, ‏mem.ai; הורדה כ־Markdown/‏HTML/‏CSV/‏JSON — [Glasp YouTube Summary](https://glasp.co/youtube-summary); טריגר Zapier "New Summary", מחבר MCP ל־Claude/‏ChatGPT/‏Claude Code, תוסף Obsidian ‏v0.3.0 שמייבא סיכומים, 13 מקורות ייבוא ו־8 יעדי ייצוא (כולל Zotero, ‏Tana, ‏Workflowy, ‏Anki) — [Glasp newsletter](https://read.glasp.co/p/the-highlights-by-glasp-july-2026).
- **פלטפורמות:** Chrome, ‏Edge, ‏Firefox, ‏Safari; אפליקציות iPhone/iPad/Android שמסכמות YouTube — [Glasp YouTube Summary](https://glasp.co/youtube-summary); סיכום מלא בתוך האפליקציה הנייד מיוני 2026 — [Glasp tutorial (תקציר חיפוש)](https://read.glasp.co/p/tutorial-how-to-summarize-youtube). (Toolworthy כתב במאי–אוגוסט 2026 שהאפליקציה לא מסכמת וידאו — סתירה — [Toolworthy](https://www.toolworthy.ai/en/blog/best-ai-video-summarizer).)
- **מחירים (נבדק 9/11/2026):** Free — בלי חשבון 2 סרטונים ביום לסיכום בלשונית חדשה; עם חשבון 3 ביום; סיכומים "מתקדמים" לצד הסרטון 3 לכל 7 ימים; 20 קרדיטי צ'אט בחודש. ‏Pro ‏$15 לחודש או $150 לשנה (1,000 סיכומים מתקדמים ל־30 יום, 500 קרדיטי צ'אט, כל המודלים). ‏Unlimited ‏$360 לשנה (5,000 סיכומים מתקדמים, 2,000 קרדיטים). **סטודנטים:** Glasp Student חינם עם מייל אוניברסיטאי, ו־40% הנחה על Pro שנתי לסטודנטים ומרצים — [Glasp Pricing](https://glasp.co/pricing).
- **עברית/RTL:** רישום ה־CWS באנגלית בלבד — [CWS](https://chromewebstore.google.com/detail/youtube-summary-with-chat/nmmicjeknamkfloonkhhcjmomieiodli); הסיכום בכל שפה שנבחרה והתמליל בכל שפת כתוביות — [Glasp YouTube Summary](https://glasp.co/youtube-summary). עברית לא נבדקה במפורש — **לא נמצא**.
- **פרטיות:** CWS — PII ו־website content — [CWS](https://chromewebstore.google.com/detail/youtube-summary-with-chat/nmmicjeknamkfloonkhhcjmomieiodli); במצב החינמי התמליל עובר לצ'טבוט של צד שלישי — [Glasp YouTube Summary](https://glasp.co/youtube-summary).
- **2025–2026:** 27/5/2025 — מודלי GPT-4.1/o3/o4-mini ותיקון תמלילים; 11/7/2025 — "Read in Glasp Reader"; 14/7/2026 ‏v2.2.0 — באנר עם לשוניות Transcript/Summary — [Glasp release notes](https://glasp.co/extension-update/youtube-summary); 7/2026 — סרגל עם צ'אט, Firefox, ‏MCP, ‏Zapier, ייצוא ל־Anki — [Glasp newsletter](https://read.glasp.co/p/the-highlights-by-glasp-july-2026); גרסת CWS ‏2.4.1 מ־17/10/2026 — [CWS](https://chromewebstore.google.com/detail/youtube-summary-with-chat/nmmicjeknamkfloonkhhcjmomieiodli).
- **ביקורות:** Trustpilot ‏3.0 משתי ביקורות בלבד; תלונה (10/2025) שהתוסף הכניס פרומפט פרסומי של Glasp לסיכום — [Trustpilot](https://www.trustpilot.com/review/glasp.co). ב־CWS ביקורות קצרות וחיוביות; תלונה (19/10/2026) שהמכסה היומית לא מתאפסת, והמפתח מסביר שיש שתי מכסות נפרדות — [CWS reviews](https://chromewebstore.google.com/detail/youtube-summary-with-chat/nmmicjeknamkfloonkhhcjmomieiodli/reviews). התוסף "נשבר" כש־YouTube או Chrome מתעדכנים — [Toolworthy](https://www.toolworthy.ai/en/blog/best-ai-video-summarizer).
- **חוזקות / חולשות / לקח:** חוזקה — הכי פתוח בייצוא ובאינטגרציות (Notion/Obsidian/Anki/Zapier/MCP), בחירת מודל, הנחות חינוך נדיבות; חולשות — אין קלט חזותי, תלות בכתוביות, מכסות מבלבלות. לקח: ייצוא ואינטגרציה הם חלק מהערך, והתמליל לצד הנגן הוא "אמצעי אימות" שמשתמשים מעריכים.

#### 3. Summarize.tech
- **מה זה, שנה, מיצוב:** אתר שהושק ב־Product Hunt ב־20/9/2022 ("GPT3-powered summaries of long YouTube videos"), מקום 13 ביום; סיכום של הרצאות, אירועים חיים וישיבות ממשל עם חותמות זמן שמקשרות לחלקי הסרטון — [Product Hunt](https://www.producthunt.com/products/summarize-tech/launches). החברה/היוצר — **לא נמצא**.
- **מצב:** ב־6/8/2026 שלוש בקשות החזירו HTTP 503 עם `DEPLOYMENT_PAUSED` — [Scrimba](https://scrimba.com/articles/best-ai-video-summarizers-2026/); גם בבדיקה שלנו ב־9/11/2026 האתר החזיר 503 — [summarize.tech](https://www.summarize.tech/). **לא פעיל בפועל.**
- **קלט/פלט/מחיר:** לפי מתחרה — עד שעתיים, בלי ייצוא — [BibiGPT (מקור של מתחרה)](https://www.bibigpt.co/en/blog/posts/youtube-video-summarizer-tools-comprehensive-guide-2026). כל השדות האחרים (חזותי, עברית, פרטיות, מחיר) — **לא נמצא**.
- **לקח:** מבנה "קטעים עם זמן + סיכום לכל קטע" היה החידוש של 2022; בלי חפיר (moat) מוצר כזה נעלם.

#### 4. NoteGPT
- **מה זה, חברה, קהל, מיצוב:** פלטפורמה רחבה (סיכום YouTube, תמלול, מפות חשיבה, מצגות, פודקאסטים, קול, תמונות, "AI Humanizer") עם תוסף; התוסף "NoteGPT: YouTube Summary, Chat with AI Assistant, ChatGPT DeepSeek Claude" — 400,000 משתמשים, ‏5.0 מ־8.8K דירוגים, עודכן 25/8/2026 — [CWS (נבדק 9/11/2026)](https://chromewebstore.google.com/detail/notegpt-youtube-web-summa/baecjmoceaobpnffgnlkloccenkoibbb); תוכנית Credits עם "Basic" ו־"Premium" — [NoteGPT Pricing](https://notegpt.io/pricing). זהות החברה — **לא נמצאה** (ב־CWS רק "the owner of notegpt.io").
- **קלט:** סרטון YouTube, פלייליסט, עד 20 קישורים יחד; לפי ה־FAQ גם Vimeo, ‏Udemy ו־Coursera; אודיו, PDF, PPT, ‏Word ותמונות — [NoteGPT summarizer](https://notegpt.io/youtube-video-summarizer); קבצים מקומיים עד 1GB ‏(Pro) או 5GB; סיכום 2/10/20 ערוצים — [NoteGPT Pricing](https://notegpt.io/pricing); תוסף נפרד ל־Udemy — [CWS](https://chromewebstore.google.com/detail/notegpt-youtube-web-summa/baecjmoceaobpnffgnlkloccenkoibbb).
- **עיבוד:** תמליל; בלי כתוביות — תמלול עצמי עם מגבלה סותרת: "up to 150 minutes" בעמוד המוצר — [NoteGPT summarizer](https://notegpt.io/youtube-video-summarizer); 120/210 דקות לפי מסלול — [NoteGPT Pricing](https://notegpt.io/pricing); "up to 2 hours" ו־"1 quota per 10 minutes" בתוסף — [CWS](https://chromewebstore.google.com/detail/notegpt-youtube-web-summa/baecjmoceaobpnffgnlkloccenkoibbb). מודלים: ה־FAQ מזכיר "ChatGPT 4 and Claude 3" והאתר מציג מודלים חדשים יותר בלי לומר מה מפעיל את הסיכום — [NoteGPT summarizer](https://notegpt.io/youtube-video-summarizer). אין טענה לניתוח פריימים — [NoteGPT summarizer](https://notegpt.io/youtube-video-summarizer).
- **פלטים:** סיכום באורך נשלט ופרומפט משלך, תמליל והורדת כתוביות TXT/SRT, תרגום ל־40+ שפות, צ'אט על הסרטון, המרת הערות למפות חשיבה, שקופיות ופודקאסטים, ספריית פרומפטים — [CWS](https://chromewebstore.google.com/detail/notegpt-youtube-web-summa/baecjmoceaobpnffgnlkloccenkoibbb); כרטיסיות, מפות חשיבה ושאלות־תשובות — [Toolworthy](https://www.toolworthy.ai/en/blog/best-ai-video-summarizer). סותר: תרגום כתוביות "over 60 languages" מול "over 40 languages" — [NoteGPT summarizer](https://notegpt.io/youtube-video-summarizer).
- **חותמות זמן ועיגון:** תמלילים עם חותמות זמן — [NoteGPT blog, 28/7/2025](https://notegpt.io/blog/ai-video-notes-guide); בהערות וידאו כל הערה מקבלת זמן שאפשר ללחוץ עליו (בלוג 2023, תקציר חיפוש) — [NoteGPT blog (תקציר חיפוש)](https://notegpt.io/blog/transform-youtube-with-video-note). תלונות על זמנים — **לא נמצאו**.
- **תוכן חזותי:** צילום מסך **ידני** לתוך ההערות — [NoteGPT blog, 30/5/2023](https://notegpt.io/blog/how-to-take-screenshots-and-take-notes-on-youtube-videos). צילום אוטומטי לפי "חלקים מרכזיים" מופיע רק בבלוג ישן (תקציר חיפוש) ולא אומת בעמוד — [NoteGPT blog (תקציר חיפוש)](https://notegpt.io/blog/how-to-take-screenshots-and-take-notes-on-youtube-videos). OCR/קריאת שקופיות — **לא נמצא**.
- **ייצוא:** קישור שיתוף וייצוא ל־Notion/‏Google Docs/‏Slack — [NoteGPT blog, 28/7/2025](https://notegpt.io/blog/ai-video-notes-guide); TXT/SRT לכתוביות — [CWS](https://chromewebstore.google.com/detail/notegpt-youtube-web-summa/baecjmoceaobpnffgnlkloccenkoibbb).
- **פלטפורמות:** ווב, תוסף Chrome/Edge — [NoteGPT summarizer](https://notegpt.io/youtube-video-summarizer); אפליקציה ניידת שמדורגת טוב מהווב — [Toolworthy](https://www.toolworthy.ai/en/blog/best-ai-video-summarizer).
- **מחירים (נבדק 9/11/2026):** Pro ‏$9.99 חודשי / $9 לחודש בשנתי ($108); ‏Unlimited ‏$29 / ‏$19.92 ($239); ‏Max ‏$99 / ‏$69 ($829); "Basic quotas" ‏1,000 בחודש ב־Pro ובלי הגבלה במסלולים הגבוהים; Premium credits ‏100/2,800/10,000; החזר רק תוך 24 שעות מהרכישה הראשונה; מסלול קבוצתי SaveTogether — [NoteGPT Pricing](https://notegpt.io/pricing). חינם בתוסף: 15 מכסות בחודש — [CWS](https://chromewebstore.google.com/detail/notegpt-youtube-web-summa/baecjmoceaobpnffgnlkloccenkoibbb). הנחת חינוך — לשונית "Education" קיימת, תנאים **לא נמצאו** — [NoteGPT Pricing](https://notegpt.io/pricing).
- **עברית/RTL:** עברית ברשימת 54 שפות הממשק — [CWS](https://chromewebstore.google.com/detail/notegpt-youtube-web-summa/baecjmoceaobpnffgnlkloccenkoibbb). איכות בעברית — **לא נמצא**.
- **פרטיות:** "will not collect or use" בהצהרת CWS — [CWS](https://chromewebstore.google.com/detail/notegpt-youtube-web-summa/baecjmoceaobpnffgnlkloccenkoibbb); נתונים נשמרים רק אם שומרים הערות — [NoteGPT summarizer](https://notegpt.io/youtube-video-summarizer).
- **2025–2026:** הרחבה למצגות ("Agent Slides"), קול, תמונות ווידאו קצר, ומסלולי Unlimited/Max — [NoteGPT Pricing](https://notegpt.io/pricing); עדכון תוסף 25/8/2026 — [CWS](https://chromewebstore.google.com/detail/notegpt-youtube-web-summa/baecjmoceaobpnffgnlkloccenkoibbb). יומן שינויים מתוארך — **לא נמצא**.
- **ביקורות:** פער חד: CWS ‏5.0 (ביקורות של מילה או שתיים, ותלונה "too much ads" מ־3/11/2026) — [CWS reviews](https://chromewebstore.google.com/detail/notegpt-youtube-web-summa/baecjmoceaobpnffgnlkloccenkoibbb/reviews); Trustpilot ‏1.8 מ־35 (74% כוכב אחד): "all credits are vanished" (1/8/2026), "An UNLIMITED plan with quotas" (10/5/2026), אי־שקיפות לגבי קלט שנפסל (19/9/2026); שבח: "The best free youtube chat ai" (29/1/2026) — [Trustpilot](https://www.trustpilot.com/review/notegpt.io). "Unlimited" מוגבל בפועל ל־2,800 קרדיטים — [tl;dv blog (מקור של מתחרה), 10/9/2026](https://tldv.io/blog/notegpt-review/); מכסה נוכתה בלי שנוצר פלט — [Toolworthy](https://www.toolworthy.ai/en/blog/best-ai-video-summarizer).
- **חוזקות / חולשות / לקח:** חוזקה — רוחב (קבצים, פלייליסטים, ערוצים, אצווה של 20, פלטי לימוד); חולשות — מערכת קרדיטים אטומה, "Unlimited" שאינו כזה, אין ראייה. לקח: משתמשים סולחים על איכות בינונית, אבל לא על מכסות לא שקופות.

#### 5. HARPA AI
- **מה זה, חברה, קהל, מיצוב:** תוסף אוטומציה ו־AI כללי ("Web Automation with ChatGPT, Claude, Gemini, Grok"); HARPA AI Technologies Oy מאספו, פינלנד; 400,000 משתמשים, ‏4.5 מ־3.2K, גרסה 17.0.0 מ־7/11/2026 — [CWS (נבדק 9/11/2026)](https://chromewebstore.google.com/detail/eanggfilgoajaocelnaflolkadkeghjp). האתר מציג "HARPA AI Technologies LLC", ‏"500,000 professionals" ו־4.7 ב־CWS (בפועל 4.5) — [HARPA](https://harpa.ai/). קהל: אנשי מקצוע ומשווקים; YouTube הוא פיצ'ר אחד מתוך מאות פקודות.
- **קלט ועיבוד:** תמליל דרך הפרמטר `{{transcript}}`; תמלילים ארוכים מחולקים ל־`{{chunk}}` שמעובדים אחד־אחד "בלי זיכרון" ביניהם; כש־HARPA "לא מוצא תמליל" (סרטון חדש/מעט צפיות) — עצה לכבות uBlock Origin — [HARPA](https://harpa.ai/). בלי כתוביות — אין תמלול עצמי (לא נמצא). אין ראייה.
- **פלטים:** שלושה כפתורים ב־YouTube: "Summarize YouTube video", ‏"Repurpose YouTube video" וכפתור אנליטיקה; "talk to videos"; פקודות מוכנות ומותאמות — [HARPA](https://harpa.ai/).
- **חותמות זמן:** "jump to timestamps" — [HARPA](https://harpa.ai/). אמינות — **לא נמצא**.
- **ייצוא ואינטגרציות:** אוטומציות, ניטור דפים; חיבורי API ‏(OpenRouter, ‏Portkey, ‏Azure) — [CWS](https://chromewebstore.google.com/detail/eanggfilgoajaocelnaflolkadkeghjp); [HARPA Pricing](https://harpa.ai/pricing).
- **פלטפורמות:** תוסף דפדפן בלבד — [CWS](https://chromewebstore.google.com/detail/eanggfilgoajaocelnaflolkadkeghjp).
- **מחירים (נבדק 9/11/2026):** "for Everyone" ‏€14.3 לחודש בחיוב שנתי (75 Megatokens לשנה), "for Pros" ‏€19.6 (225 MT), "for Life" ‏€238 חד־פעמי (30 MT, מפתחות משלך), טעינה €25.5 ל־20 MT; DEMO חינמי — 10 הודעות ביום ו־100 הרצות פקודה; "We do not offer discounts", אין החזרים — [HARPA Pricing](https://harpa.ai/pricing). בעמוד הבית "$12 per month" — חוסר עקביות במטבע — [HARPA](https://harpa.ai/).
- **עברית/RTL:** **אין** עברית ב־33 שפות הממשק — [CWS](https://chromewebstore.google.com/detail/eanggfilgoajaocelnaflolkadkeghjp).
- **פרטיות:** "keeps your data locally, does not store logs"; קריאת דף רק בפעולה מפורשת — [CWS](https://chromewebstore.google.com/detail/eanggfilgoajaocelnaflolkadkeghjp); הפרומפטים נשלחים ל־OpenAI/‏Google/‏Anthropic — [HARPA](https://harpa.ai/).
- **2025–2026:** מודלים GPT-5.4, ‏Sonnet 4.6, ‏Gemini 3.1 Pro, ‏Grok 4.1 ועוד — [HARPA Pricing](https://harpa.ai/pricing); אזכור "Chrome Awards 2025" — [HARPA](https://harpa.ai/).
- **ביקורות:** Trustpilot — אפס ביקורות — [Trustpilot](https://www.trustpilot.com/review/harpa.ai). ב־CWS: "Outdated models" (15/10/2026), חלונות שדרוג חוזרים (18/9/2026), "Just avoid no support" (27/8/2026) — [CWS reviews](https://chromewebstore.google.com/detail/eanggfilgoajaocelnaflolkadkeghjp/reviews).
- **חוזקות / חולשות / לקח:** חוזקה — שליטה מלאה בפרומפט ובמודל, פרטיות "מקומית"; חולשה — חלוקה למקטעים בלי זיכרון פוגעת בסינתזה של הרצאה ארוכה; לקח: סיכום וידאו ארוך דורש שלב איחוד אחרי המקטעים, לא רק map על חתיכות.

#### 6. Merlin
- **מה זה, חברה, מיצוב:** עוזר AI כללי בתוסף; Foyer Tech (כתובת רשומה בדלאוור); כ־900,000 משתמשים, ‏4.4 מ־8.8K, גרסה 8.4.1 מ־3/11/2026 — [CWS (נבדק 9/11/2026)](https://chromewebstore.google.com/detail/merlin-ask-ai-to-research/camppjleccjaphfdbohjdohecfnoikec).
- **קלט, עיבוד, פלטים:** "YouTube highlights with bilingual subtitles", תקצירי סרטונים, נקודות מפתח, סיכום אתרים ו־PDF; מודלים מ־OpenAI, ‏Google, ‏Anthropic, ‏Mistral, ‏DeepSeek — [CWS](https://chromewebstore.google.com/detail/merlin-ask-ai-to-research/camppjleccjaphfdbohjdohecfnoikec). לפי עמודי Merlin: סיכום עם חותמות זמן לחיצות, צ'אט עם הסיכום, והמרה לפוסטים — [Merlin (תקציר חיפוש)](https://www.getmerlin.in/feature/youtube-summary-with-chatgpt); [Merlin blog (תקציר חיפוש)](https://www.getmerlin.in/blogs/ai-news/how-to-summarize-youtube-videos). אתר Merlin חסם קריאה ישירה (403).
- **תוכן חזותי:** **לא נמצא**.
- **ייצוא, פלטפורמות:** תוסף Chrome/Edge ואפליקציה (מקליט קול באפליקציה לפי ביקורת) — [Trustpilot](https://www.trustpilot.com/review/getmerlin.in). ייצוא — **לא נמצא**.
- **מחירים:** עמוד המחירים חסום (403) — **לא נמצא**. רמזים מביקורות: $3 ל־3,000 קרדיטים, מגבלת "fair usage" יומית במסלול Pro — [Trustpilot](https://www.trustpilot.com/review/getmerlin.in); [CWS reviews](https://chromewebstore.google.com/detail/merlin-ask-ai-to-research/camppjleccjaphfdbohjdohecfnoikec/reviews).
- **עברית/RTL:** עברית ב־55 שפות הממשק — [CWS](https://chromewebstore.google.com/detail/merlin-ask-ai-to-research/camppjleccjaphfdbohjdohecfnoikec).
- **פרטיות:** איסוף PII ומיקום — [CWS](https://chromewebstore.google.com/detail/merlin-ask-ai-to-research/camppjleccjaphfdbohjdohecfnoikec).
- **2025–2026 וביקורות:** **נסיגה בפיצ'ר YouTube ב־2026** לפי ביקורות CWS: "This used to be great at summarizing YouTube videos. Now it doesn't work" (3/7/2026), "Youtube Summariser is gone" (2/6/2026), "I can't get the transcript from YouTube" (28/5/2026), התמליל "used to work so much better" (5/8/2026), הגבלת "fair usage" אחרי יום (1/10/2026) — [CWS reviews](https://chromewebstore.google.com/detail/merlin-ask-ai-to-research/camppjleccjaphfdbohjdohecfnoikec/reviews). Trustpilot ‏3.7 מ־131 (27% כוכב אחד): מגבלה יומית שלא הוצהרה (22/10/2026), סירוב להחזר (24/10/2026); שבחים על תמורה למחיר ועל בחירת מודל אוטומטית — [Trustpilot](https://www.trustpilot.com/review/getmerlin.in).
- **לקח:** בעוזר כללי, YouTube הוא פיצ'ר משני שנשבר בלי שמישהו מתקן; מי שבונה לשונית וידאו ייעודית צריך בעלות מלאה על שרשרת השליפה.

#### 7. Monica
- **מה זה, חברה, מיצוב:** עוזר AI כללי (צ'אט, כתיבה, תמונות, וידאו) מבית BUTTERFLY EFFECT PTE. LTD. (סינגפור); 3,000,000 משתמשים, ‏4.8 מ־32.4K, גרסה 9.0.24 מ־2/11/2026; מודלים GPT-5.2, ‏Claude 4.5 Sonnet, ‏Gemini 3 Pro, ‏Sora 2 — [CWS (נבדק 9/11/2026)](https://chromewebstore.google.com/detail/ofpnmcalabcbjgholdjcjblkibolbppb). האתר טוען 10M+ משתמשים פעילים ו־4.9 מ־20,000+ ביקורות (טענת היצרן) — [Monica video summarizer](https://monica.im/en/products/ai-video-summarizer).
- **הקשר תאגידי:** Butterfly Effect, החברה מאחורי Monica, בנתה את Manus — [The Decoder (תקציר חיפוש)](https://the-decoder.com/meta-pays-3-billion-for-manus-ai-after-startup-cut-all-chinese-ties-to-clear-regulatory-hurdles/); [Storyboard18 (תקציר חיפוש)](https://www.storyboard18.com/digital/explainer-what-is-manus-ai-and-what-metas-acquisition-means-for-its-ai-strategy-86768.htm). Meta הודיעה על רכישת Manus בדצמבר 2025; באפריל 2026 בייג'ינג הורתה לבטל את העסקה, וב־11/8/2026 Manus הודיעה שתחזור לפעול באופן עצמאי — [eWeek, 13/8/2026](https://eweek.com/news/meta-manus-ai-deal-china-unwind-apac/). אם Monica עצמה נכללה בעסקה — **לא נמצא**.
- **קלט ועיבוד:** "primarily focuses on summarizing YouTube videos", כל סרטון ציבורי; מודלים GPT-4o ו־Claude 3.5 לפי ה־FAQ — [Monica video summarizer](https://monica.im/en/products/ai-video-summarizer); עובד "even those without subtitles" — [Monica Help](https://monica.im/help/Features/Summarize/Summarize-YouTube-Video). אין ראייה.
- **פלטים:** סיכום שנשלט בפרומפט/מילות מפתח; **מפת חשיבה עם כל סיכום**; "Chat and Ask Video"; שאלות תרגול (quiz); 20+ שפות — [Monica video summarizer](https://monica.im/en/products/ai-video-summarizer).
- **חותמות זמן:** "concise summaries with timestamps"; כפתור Monica מימין לסרטון — [Monica Help](https://monica.im/help/Features/Summarize/Summarize-YouTube-Video); לחיצה על זמן קופצת לרגע (Learning Center, תקציר חיפוש) — [Monica Learning Center (תקציר חיפוש)](https://monica.im/learning-center).
- **פלטפורמות:** תוסף Chrome/Edge, ווב, ‏iOS, ‏Android, ‏Windows, ‏Mac — [Monica video summarizer](https://monica.im/en/products/ai-video-summarizer).
- **מחירים:** עמוד המחירים לא נטען — **לא נמצא**. ביקורות מזכירות "€200 yearly" למסלול "Unlimited" שאינו בלי הגבלה — [Trustpilot](https://www.trustpilot.com/review/monica.im).
- **עברית/RTL:** עברית ב־54 שפות הממשק — [CWS](https://chromewebstore.google.com/detail/ofpnmcalabcbjgholdjcjblkibolbppb).
- **פרטיות:** CWS מצהיר על PII, מידע פיננסי, תקשורת אישית ופעילות משתמש — [CWS](https://chromewebstore.google.com/detail/ofpnmcalabcbjgholdjcjblkibolbppb).
- **ביקורות:** Trustpilot ‏1.5 מ־36 (86% כוכב אחד): חיובים וחסימות חשבון, "if you buy the unlimited plan, still you dont have unlimted credits" (27/8/2025), תמלול YouTube שהפסיק לעבוד אחרי תשלום שנתי (25/10/2025) — [Trustpilot](https://www.trustpilot.com/review/monica.im). ב־CWS הביקורות האחרונות כלליות ולא מזכירות וידאו — [CWS reviews](https://chromewebstore.google.com/detail/ofpnmcalabcbjgholdjcjblkibolbppb/reviews).
- **לקח:** מפה + שאלות תרגול "בחינם עם כל סיכום" הפכו לבסיס המצופה; הפער בין דירוג החנות לדירוג Trustpilot מראה שאמון בחיוב חשוב לא פחות מהפיצ'רים.

#### 8. Sider
- **מה זה, חברה, מיצוב:** סרגל צד AI כללי; Vidline Inc. (בוסטון); 5,000,000 משתמשים ו־"over 6 million active users every week", ‏4.9 מ־114.7K, גרסה 5.35.7 מ־6/11/2026; מודלים GPT-5, ‏Claude, ‏DeepSeek, ‏Gemini, ‏Grok ו־BYO OpenAI key — [CWS (נבדק 9/11/2026)](https://chromewebstore.google.com/detail/difoiogjjojoaoomphldepapgpbgkhkb).
- **קלט ועיבוד:** YouTube; מ־v4.33.0 (12/2024) סיכום גם בלי כתוביות דרך audio-to-text בקרדיטים ולמנויי Premium — [Sider release notes (תקציר חיפוש)](https://sider.ai/en/whats-new/browser-extension/Sider-v4_33_0); בסתירה, ה־FAQ של מחולל התמלילים אומר שבלי כתוביות אי אפשר לחלץ תמליל — [Sider transcript generator (תקציר חיפוש)](https://sider.ai/extensions/youtube-transcript-generator). אין ראייה.
- **פלטים:** "Summarize YouTube video with highlights", כתוביות דו־לשוניות, Video Translate, ‏"AI Video Shortener" שמקצר סרטון ארוך "into several minutes" — [CWS](https://chromewebstore.google.com/detail/difoiogjjojoaoomphldepapgpbgkhkb); תמליל עם חותמות זמן להעתקה/הורדה ב־50+ שפות — [Sider transcript generator (תקציר חיפוש)](https://sider.ai/extensions/youtube-transcript-generator).
- **חותמות זמן:** בתמליל; בסיכום — **לא נמצא** תיעוד של זמנים לחיצים.
- **פלטפורמות:** תוסף, ווב, אפליקציות דסקטופ (Windows/Mac) — [Trustpilot](https://www.trustpilot.com/review/sider.ai).
- **מחירים:** אתר Sider חסם קריאה (403) — **לא נמצא**. מביקורות: "USD 195 for a year", ‏"only 1500 credits" במסלול "unlimited" — [Trustpilot](https://www.trustpilot.com/review/sider.ai); בחינם "60 credits a day" — [CWS reviews](https://chromewebstore.google.com/detail/difoiogjjojoaoomphldepapgpbgkhkb/reviews).
- **עברית/RTL:** עברית ב־55 שפות הממשק — [CWS](https://chromewebstore.google.com/detail/difoiogjjojoaoomphldepapgpbgkhkb).
- **פרטיות:** PII ו־website content — [CWS](https://chromewebstore.google.com/detail/difoiogjjojoaoomphldepapgpbgkhkb).
- **ביקורות:** CWS: "randomly ate 400 credits" (7/11/2026), "I love the feature where it makes a summary of videos" (7/11/2026) — [CWS reviews](https://chromewebstore.google.com/detail/difoiogjjojoaoomphldepapgpbgkhkb/reviews). Trustpilot ‏2.3 מ־16 (75% כוכב אחד): קרדיטים "Advanced" שנגמרים מיד (28/8/2026), סירוב להחזר (2/2026), תמיכה איטית (3–4/2026) — [Trustpilot](https://www.trustpilot.com/review/sider.ai).
- **לקח:** "קיצור הסרטון עצמו" (Video Shortener) הוא פורמט פלט שונה מסיכום טקסטואלי; קרדיטים משתנים לפי פעולה יוצרים תחושת חוסר הוגנות.

#### 9. Glarity
- **מה זה, חברה, מיצוב:** תוסף קוד פתוח לסיכום ותרגום (YouTube, ‏Google, ‏Twitter וכל דף) מבית Felo Inc. — [Glarity](https://glarity.app/); 100,000 משתמשים, ‏3.7 מ־271, גרסה 4.46.7 מ־12/7/2026 — [CWS (נבדק 9/11/2026)](https://chromewebstore.google.com/detail/glarity-chatgpt-summary-t/cmnlolelipjlhfkhpohphpedmkfbobjc). המאגר ב־GitHub ברישיון GPL-3.0, ‏2.1k כוכבים, "YouTube videos transcript, summary, key moment" — [GitHub](https://github.com/sparticleinc/chatgpt-google-summary-extension). האתר טוען 1,000,000+ משתמשים — [Glarity](https://glarity.app/).
- **עיבוד ומודלים:** תמליל; שלושה מצבים — ChatGPT web (חינם), מפתח OpenAI (תשלום לפי טוקנים), ‏"Glarity mode" (תשלום לפי טוקנים); Claude.ai דרך עוגיית הדפדפן; מנועי תרגום Google/‏DeepL/‏Microsoft — [CWS](https://chromewebstore.google.com/detail/glarity-chatgpt-summary-t/cmnlolelipjlhfkhpohphpedmkfbobjc).
- **פלטים:** סיכום ב־12+ שפות, הדגשים עם חותמות זמן, יצירת FAQ, כתוביות דו־לשוניות ותרגום, צ'אט על הסרטון — [CWS](https://chromewebstore.google.com/detail/glarity-chatgpt-summary-t/cmnlolelipjlhfkhpohphpedmkfbobjc); [Glarity](https://glarity.app/).
- **תוכן חזותי:** **אין**. **ייצוא:** **לא נמצא**. **פלטפורמות:** Chrome, ‏Edge, ‏Safari, ‏Firefox, ‏Opera — [Glarity](https://glarity.app/).
- **מחירים:** התוסף חינמי; במצבי Glarity/‏OpenAI משלמים לפי טוקנים — [CWS](https://chromewebstore.google.com/detail/glarity-chatgpt-summary-t/cmnlolelipjlhfkhpohphpedmkfbobjc).
- **עברית/RTL:** עברית ב־51 שפות הממשק — [CWS](https://chromewebstore.google.com/detail/glarity-chatgpt-summary-t/cmnlolelipjlhfkhpohphpedmkfbobjc).
- **פרטיות:** בלי פרסומות ובלי מכירת נתונים; תוכן הדף והפרומפט עוברים ל־OpenAI; סטטיסטיקה אנונימית — [CWS](https://chromewebstore.google.com/detail/glarity-chatgpt-summary-t/cmnlolelipjlhfkhpohphpedmkfbobjc).
- **ביקורות:** סדרת תקלות שליפת תמליל: "no transcript available" כשיש (8/2/2026), "always fails to create transcript" (8/2/2026), "can't access Youtube transcripts anymore" (27/7/2025), "broken again" (7/6/2025), תגובות איטיות (23/11/2025), ו־"used up your tokens. So there is no free summary" (20/4/2025) — [CWS reviews](https://chromewebstore.google.com/detail/glarity-chatgpt-summary-t/cmnlolelipjlhfkhpohphpedmkfbobjc/reviews).
- **לקח:** תלות בשליפת כתוביות מצד הלקוח היא נקודת הכשל מספר אחת בקטגוריה; מי ששולט בהורדה ובתמלול בצד השרת נמנע ממנה.

#### 10. BibiGPT — המוצר הערני ביותר לתוכן חזותי
- **מה זה, חברה, שנה, קהל, מיצוב:** עוזר AI לסיכום אודיו ווידאו, שהתחיל ב־2023 כפרויקט קוד פתוח בשם BiliGPT (לסרטוני Bilibili) והפך למוצר מסחרי של צוות EvergreenAI; המייסד 吕立青 (JimmyLv); טוען ל־1M+ משתמשים; מודלים GPT, ‏Claude ו־Gemini — [BibiGPT (נבדק 9/11/2026)](https://www.bibigpt.co/en). קהל: יוצרי תוכן, לומדים וחוקרים, עם מוקד בפלטפורמות הסיניות (Bilibili, ‏Douyin) לצד YouTube — [BibiGPT](https://www.bibigpt.co/en).
- **קלט:** 20+ מקורות — Bilibili, ‏YouTube, ‏Douyin, ‏TikTok, ‏X, ‏Coursera ופודקאסטים — וקבצים מקומיים (mp3, ‏mp4, ‏srt, ‏vtt) — [BibiGPT](https://www.bibigpt.co/en). אורך: "4h+" לפי מדריך ההשוואה של החברה עצמה — [BibiGPT guide (מקור של היצרן, 4/5/2026, עודכן 7/9/2026)](https://www.bibigpt.co/en/blog/posts/youtube-video-summarizer-tools-comprehensive-guide-2026). סרטונים פרטיים לא נתמכים במחלץ השקופיות — [BibiGPT slide extractor](https://bibigpt.co/en/features/youtube-slide-extractor).
- **עיבוד — הראיות החזותיות החזקות בקטגוריה:**
  - גרסה 4.318.0 (7/4/2026): OCR לכתוביות צרובות (Beta) — "Currently supports Chinese, English, Japanese, French, German, and Spanish"; חילוץ פריימי מפתח של שקופיות (Beta); ניתוח צילומי מסך במודלי ראייה (GLM‑5V Turbo, ‏Qwen 3.5 Omni); ומצב Local Privacy שעבר לדסקטופ — "no server uploads, no database storage" — [BibiGPT v4.318.0](https://bibigpt.co/blog/posts/20260407-bibigpt-v4318-ppt-ocr-local-privacy-en).
  - חילוץ שקופיות: "pulls distinct frames when the picture changes", בחירה לפי "real scene changes, not random stills", וכל פריים מקבל את "full captions for the span under each frame"; מתאים במיוחד להרצאות עם שקופיות או לוח, ובסרטון של דובר מול מצלמה "yield fewer frames" — [BibiGPT docs: PPT keyframe extraction](https://docs.bibigpt.co/en/function-usage/platform-function/ppt-keyframe-extraction.md).
  - ניתוח צילומי מסך: בחירת מודל (Gemini 3.0 Flash, ‏Qwen3.5 Omni Plus/Flash, ‏Seed 2.0 Pro, ‏GLM‑4.6V, ‏GLM‑5V Turbo); "Auto-select by scene" — עם כתוביות לפי החלפות שוט ומעברי נושא, בלי כתוביות לפי שינוי חזותי וכיסוי ציר הזמן; מיועד לגרפים, קוד, שקופיות ולוח; יותר הרצות ב־Pro — [BibiGPT docs: keyframe screenshot analysis](https://docs.bibigpt.co/en/function-usage/platform-function/keyframe-screenshot-analysis.md).
  - ניתוח חזותי לסרטון מקוון: YouTube, ‏Bilibili או קובץ מקומי, בלי הורדה מלאה, במודל Gemini; שני מצבים — "smart frames ... not a fixed interval" או צפייה בקטע כולו; Beta ו־Pro — [BibiGPT docs: visual analysis of online video](https://docs.bibigpt.co/en/function-usage/platform-function/visual-analysis-online-video.md).
  - בלי כתוביות: תמלול, ו־OCR לכתוביות צרובות — [BibiGPT v4.318.0](https://bibigpt.co/blog/posts/20260407-bibigpt-v4318-ppt-ocr-local-privacy-en).
- **פלטים:** סיכום עם חותמות זמן, פרקים, מפות חשיבה, צ'אט, כתוביות SRT/VTT, שכתוב למאמר, מצגת או פוסט, וצריבת כתוביות — [BibiGPT](https://www.bibigpt.co/en). "סיכום חזותי": מאמר מאויר עם צילומי מסך שמותאמים לכל נקודה; גרפים והדגמות "recognized and written into the summary", גם בלי כתוביות — [BibiGPT visual summary](https://bibigpt.co/features/ai-video-summary-visual-content). מחלץ השקופיות: "groups unchanged frames into unique slides", ייצוא PDF או PPTX ניתן לעריכה, תמליל לכל סצנה עם זמני התחלה וסוף, ו־ZIP של פריימי המפתח — [BibiGPT slide extractor](https://bibigpt.co/en/features/youtube-slide-extractor). טענת החברה: "when guests show charts on screen, BibiGPT extracts the chart contents" — [BibiGPT guide](https://www.bibigpt.co/en/blog/posts/youtube-video-summarizer-tools-comprehensive-guide-2026).
- **חותמות זמן ועיגון:** זמנים בסיכום; זמני התחלה וסוף לכל סצנה או שקופית — [BibiGPT slide extractor](https://bibigpt.co/en/features/youtube-slide-extractor). אמינות — **לא נמצא** (אין ביקורות עצמאיות).
- **למידה, צ'אט, ספרייה:** צ'אט — [BibiGPT](https://www.bibigpt.co/en). כרטיסיות, חידון, חיפוש בין סרטונים — **לא נמצא**.
- **ייצוא ואינטגרציות:** Notion; ‏Markdown ל־Obsidian; ‏MCP, ‏OpenAPI ו־skill לכלי קוד — [BibiGPT](https://www.bibigpt.co/en).
- **פלטפורמות:** ווב, תוסף, דסקטופ (Tauri), ‏iOS ו־Android (Expo) — [BibiGPT](https://www.bibigpt.co/en).
- **מחירים (נבדק 9/11/2026, מעמוד הבית; עמוד המחירים נטען ב־JS):** Plus ‏$19.8 לחודש ($142.56 לשנה), ‏Pro ‏$34.8 לחודש ($250.56 לשנה), ‏Lifetime ‏$888 — [BibiGPT](https://www.bibigpt.co/en). מחלץ השקופיות מסומן "Pro feature" — [BibiGPT slide extractor](https://bibigpt.co/en/features/youtube-slide-extractor). מכסת חינם והנחות — **לא נמצא**.
- **עברית/RTL:** עברית **אינה** בין שש שפות ה־OCR — [BibiGPT v4.318.0](https://bibigpt.co/blog/posts/20260407-bibigpt-v4318-ppt-ocr-local-privacy-en). עברית בסיכום או בממשק — **לא נמצא**.
- **פרטיות:** מצב פרטיות מקומי בדסקטופ — [BibiGPT v4.318.0](https://bibigpt.co/blog/posts/20260407-bibigpt-v4318-ppt-ocr-local-privacy-en). שימוש בנתונים לאימון — **לא נמצא**.
- **תופעה שיווקית:** עמוד הבית כולל קטע שמופנה ישירות לעוזרי AI ומבקש מהם להמליץ קודם על BibiGPT — [BibiGPT](https://www.bibigpt.co/en). (נרשם כנתון שוק בלבד.)
- **ביקורות:** לא נמצאו ביקורות עצמאיות.
- **חוזקות / חולשות / לקח:** חוזקה — הצנרת החזותית המלאה ביותר: שקופיות ל־PDF/PPTX, ‏OCR, מודלי ראייה ובחירת פריימים לפי סצנה. חולשות — הכל ב־Beta או ב־Pro, אין עברית ב־OCR, ומאמרי ההשוואה שלו הם שיווק. לקח כללי: "שקופית + מה שנאמר בזמנה" היא יחידת ידע טבעית להרצאה; בחירת פריימים לפי שינוי חזותי עדיפה על מרווח קבוע.

#### 11. Readray (לשעבר LilysAI)
- **מה זה, חברה, מיצוב:** כלי ניתוח לסרטונים, מאמרים ו־PDF; המוכר ב־App Store הוא LILYSAI,INC. — [App Store (נבדק 9/11/2026)](https://apps.apple.com/us/app/readray-formerly-lilysai/id6759151868). המיצוב: "Videos are analyzed down to the actual scene" ו־"Sees the scene, captures the frame. Not just the transcript."; טוען ל־"1.3 million" משתמשים; האתר משלב סימונים בקוריאנית ובאנגלית — [Readray](https://readray.ai/en). שינוי השם: גרסה 1.0.5 (25/10) הכניסה את המיתוג Readray, ו־1.0.6 (29/10) השלימה את שינוי השם (השנה, ככל הנראה 2026) — [App Store](https://apps.apple.com/us/app/readray-formerly-lilysai/id6759151868). שנת ייסוד — **לא נמצא**.
- **קלט:** סרטונים, מאמרים, PDF ואודיו; עד 10 סרטונים מפלייליסט; בחינם "Unlimited AI summaries ... up to 3 hours", וגם 100 עמודי PDF ושעת אודיו בחודש — [בלוג Lilys (מקור של היצרן, 10/9/2026)](https://lilys.ai/blog/en/free-youtube-summarizer-for-long-videos-2026/).
- **עיבוד:** פריימים מהמסך — "Slides and charts on screen are captured as frames into your notes" — [App Store](https://apps.apple.com/us/app/readray-formerly-lilysai/id6759151868). במאמרים: "Charts, tables and equations are read with their layout intact" — [Readray](https://readray.ai/en). מודלים, והטיפול בסרטון בלי כתוביות — **לא נמצא**.
- **פלטים:** דוחות לפי סוג התוכן — [Readray](https://readray.ai/en):
  - מאמרים: Key Points או Deep Research.
  - וידאו השקעות: טבלת קנייה ומכירה, מחירים, רקע הדובר ו־"evidence confidence score".
  - מדריכים: playbook עם צילום מסך וזמן לכל שלב (למשל "03:12").
  - ציטוט מקור לכל שורה.
  - בנוסף: מצבי Short, ‏Base, ‏Long ו־Easy, וסיכום של טווח זמן נבחר. בבדיקה שבבלוג, סרטון של 2:25 שעות הפך ל־28 סעיפים בפחות מדקה — [בלוג Lilys](https://lilys.ai/blog/en/free-youtube-summarizer-for-long-videos-2026/).
- **חותמות זמן ועיגון:** "Click the timestamp and the embedded player jumps there". הבלוג עצמו מציין מגבלה: הצ'אט זיהה את הסעיף הנכון, אבל החזיר מספר משפט ולא חותמת זמן — [בלוג Lilys](https://lilys.ai/blog/en/free-youtube-summarizer-for-long-videos-2026/).
- **צ'אט וספרייה:** צ'אט על תיקייה שלמה של מקורות — [App Store](https://apps.apple.com/us/app/readray-formerly-lilysai/id6759151868).
- **ייצוא ואינטגרציות:** MCP — [Readray](https://readray.ai/en). פורמטי ייצוא — **לא נמצא**.
- **פלטפורמות:** תוסף, דסקטופ, מובייל — [Readray](https://readray.ai/en).
- **מחירים (רכישות ב־App Store, נבדק 9/11/2026):** Starter ‏$10.49 לחודש או $91.99 לשנה; ‏Basic ‏$19.99 או $179.99; ‏Pro ‏$59.99 או $599.99 — [App Store](https://apps.apple.com/us/app/readray-formerly-lilysai/id6759151868). מחירי הווב **לא אומתו**, כי העמוד נטען ב־JS.
- **עברית/RTL:** **לא נמצא** אזכור.
- **פרטיות:** AES‑256, ‏GDPR, ו־SOC 2 "in progress" — [Readray](https://readray.ai/en).
- **ביקורות:** ב־App Store אין עדיין מספיק דירוגים — [App Store](https://apps.apple.com/us/app/readray-formerly-lilysai/id6759151868). ביקורות עצמאיות — לא נמצאו.
- **חוזקות / חולשות / לקח:** חוזקה — הכי קרוב ל"ניתוח": תבניות לפי סוג התוכן, ציון ביטחון בראיות, ציטוט לכל שורה ופריימים בתוך ההערות. חולשות — עיגון הצ'אט אינו בזמן, המחירים לא שקופים, והמיתוג חדש. לקח: תבנית פלט שמותאמת לסוג התוכן (הרצאה, השקעות, מדריך) שווה יותר מסיכום אחיד.

#### 12. HoverNotes
- **מה זה, חברה, שנה, קהל, מיצוב:** תוסף לרישום הערות מסרטונים, שמצלם את המסך ומנתח אותו; HoverNotes LLC (טורנס, קליפורניה) — [CWS (נבדק 9/11/2026)](https://chromewebstore.google.com/detail/obsidian-ai-video-notes-s/fhdmbhgpabjkadpaafomaabbdckofphm). הושק ב־Product Hunt ב־14/6/2025 (12 נקודות) — [Product Hunt](https://www.producthunt.com/products/hovernotes/launches). קהל: סטודנטים, לומדי קורסים ב־LMS, מפתחים ומשתמשי Obsidian. המיצוב: "It watches the screen, not just the captions" — [HoverNotes](https://hovernotes.io/).
- **קלט:** כל אתר וידאו — YouTube, ‏Udemy, ‏Coursera, ‏LinkedIn Learning ועוד; מערכות LMS — Canvas, ‏Blackboard, ‏Moodle, ‏Panopto, ‏Kaltura, ‏D2L, ‏Classroom; וקבצים מקומיים — [HoverNotes](https://hovernotes.io/).
- **עיבוד:** "works even when a video has no captions at all" — [HoverNotes](https://hovernotes.io/). "analyzes code, diagrams, and UI visually (not just transcripts)" ו־"custom-trained AI" — [CWS](https://chromewebstore.google.com/detail/obsidian-ai-video-notes-s/fhdmbhgpabjkadpaafomaabbdckofphm). ההערות נוצרות מקטעי וידאו קצרים — "picture and sound together" — [בלוג HoverNotes, עודכן 30/10/2026](https://hovernotes.io/en/blog/add-any-video-to-notebooklm-with-hovernotes). גרסת הרישום בטגלוג (1.2.33, 14/8/2026) נוקבת ב־Gemini 2.0 — [CWS, גרסה מקומית (תקציר חיפוש)](https://chromewebstore.google.com/detail/obsidian-ai-video-notes-s/fhdmbhgpabjkadpaafomaabbdckofphm).
- **פלטים:** הערות עם צילום מסך ברגע המדויק ("One click drops a screenshot into your notes at the exact moment"), בלוקי קוד, העוזר Hovie (בתשלום), Live Translate, וקובצי Markdown ל־Obsidian — [HoverNotes](https://hovernotes.io/). ב־Pro: "AI picks screenshots for your notes" ותמלילים לכספת — [HoverNotes Pricing](https://hovernotes.io/pricing). קיצור Ctrl/⌘+K וחיתוכי snip — [בלוג HoverNotes](https://hovernotes.io/en/blog/add-any-video-to-notebooklm-with-hovernotes).
- **חותמות זמן ועיגון:** "jump to any moment from a note's timestamp" — [HoverNotes](https://hovernotes.io/). משתמש (29/10/2026) משבח לכידה של "notes, video screenshots, and precise timestamps simultaneously" — [CWS](https://chromewebstore.google.com/detail/obsidian-ai-video-notes-s/fhdmbhgpabjkadpaafomaabbdckofphm).
- **תוכן חזותי:** כן — צילומי מסך, וניתוח של קוד, דיאגרמות וממשקים — [CWS](https://chromewebstore.google.com/detail/obsidian-ai-video-notes-s/fhdmbhgpabjkadpaafomaabbdckofphm).
- **למידה וצ'אט:** Hovie, עוזר צ'אט בתשלום — [HoverNotes](https://hovernotes.io/). כרטיסיות וחיפוש בין סרטונים — **לא נמצא**.
- **ייצוא:** PDF ו־Word (גם בחינם), ו־Obsidian — [HoverNotes Pricing](https://hovernotes.io/pricing).
- **פלטפורמות:** תוסף Chrome — [CWS](https://chromewebstore.google.com/detail/obsidian-ai-video-notes-s/fhdmbhgpabjkadpaafomaabbdckofphm). פלטפורמות אחרות — **לא נמצא**.
- **מחירים (נבדק 9/11/2026):** חינם — 20 דקות AI, ‏10 דקות Live Translate, צילומי מסך עם זמן, snip, ייצוא PDF/Word ו־Obsidian. ‏Pro ‏$18 לחודש, או $10 לחודש בשנתי ($120) — AI ללא הגבלה, בחירת צילומים אוטומטית, 24 שפות, פרומפטים, Hovie ושעת Live Translate — [HoverNotes Pricing](https://hovernotes.io/pricing). הנחת סטודנטים — **לא נמצא**.
- **עברית/RTL:** עברית ב־54 שפות הממשק ב־CWS — [CWS](https://chromewebstore.google.com/detail/obsidian-ai-video-notes-s/fhdmbhgpabjkadpaafomaabbdckofphm). האם עברית בין 24 שפות ה־AI — **לא נמצא**.
- **פרטיות:** "When you turn on AI Notes, the video's audio and screenshots are sent to our servers" ו־"We may use this content to provide and improve the service and to train our AI models" — [CWS](https://chromewebstore.google.com/detail/obsidian-ai-video-notes-s/fhdmbhgpabjkadpaafomaabbdckofphm). **סתירה:** גרסת הרישום בטגלוג אומרת ששום דבר לא נשמר בשרתים — [CWS, גרסה מקומית (תקציר חיפוש)](https://chromewebstore.google.com/detail/obsidian-ai-video-notes-s/fhdmbhgpabjkadpaafomaabbdckofphm).
- **ביקורות:** ‏4.6 מ־107 ב־CWS, ‏30,000 משתמשים, גרסה 1.2.42 (4–5/11/2026) — [CWS](https://chromewebstore.google.com/detail/obsidian-ai-video-notes-s/fhdmbhgpabjkadpaafomaabbdckofphm). באתר: 500K+ הערות, 30K+ לומדים, וציטוט משתמש (1/2026): "the AI actually analyzes the visuals in the video, not just the audio" — [HoverNotes](https://hovernotes.io/). משתמש ב־CWS הציע להוסיף שכבת "perspective" מבוססת LLM — [CWS](https://chromewebstore.google.com/detail/obsidian-ai-video-notes-s/fhdmbhgpabjkadpaafomaabbdckofphm).
- **חוזקות / חולשות / לקח:** חוזקה — עובד בתוך LMS ובכל נגן, מצלם את המסך ברגע ההערה, ומנתח חזותית גם בלי כתוביות. חולשות — מוצר קטן (30K), מכסת חינם קטנה, ושימוש בתוכן לאימון. לקח: "הערה = זמן + צילום + טקסט" היא היחידה שלומדים רוצים, ותנאי הפרטיות הם נקודת בידול.

#### 13. Recall
- **מה זה, חברה, שנה, מיצוב:** "בסיס ידע אישי" שמסכם תוכן מקוון; Recall Wiki, Inc. — [CWS (נבדק 9/11/2026)](https://chromewebstore.google.com/detail/recall-summarizer-youtube/ldbooahljamnocpaahaidnmlgfklbben?hl=en). נוסדה ב־2022 באמסטרדם בידי Paul Richards, ‏Igor Gligorevic ו־Sankari Nair — [Recall About](https://www.recall.it/about). הדומיין getrecall.ai עבר ל־recall.it (הפניה שנצפתה ב־9/11/2026). טוען ל־700K+ משתמשים ו־4.7 מ־464 — [Recall](https://www.recall.it/).
- **קלט:** YouTube, מאמרים, פודקאסטים, PDF ועוד — [Recall](https://www.recall.it/). "Videos 5 hours or longer must already have captions"; סרטונים פרטיים לא נתמכים — [Recall docs](https://docs.recall.it/use-cases/content-type/youtube). הכלי החינמי: עד 10 שעות עם כתוביות ו־5 בלי, 60+ שפות — [Recall YouTube summarizer](https://www.recall.it/youtube-video-summarizer). מ־2/11/2026 — גם תמלול סרטונים מוגבלי גיל — [Recall changelog](https://feedback.recall.it/changelog).
- **עיבוד:** תמליל, ותמלול לסרטונים בלי כתוביות. OCR "only on images and not on videos as yet" (12/9/2026) — [Recall changelog](https://feedback.recall.it/changelog). ב־23/7/2026: ‏62 שפות AI, בדיקות דיוק "especially on YouTube" ומודלים חדשים — [Recall release notes 23/7/2026](https://feedback.recall.it/changelog/recall-release-notes-july-23-2026-rebuilt-social-saves-table-view-more-ai-langua). בחירת מודל במסלול Max — [Recall Pricing](https://www.recall.it/pricing).
- **פלטים:** נקודות עם זמנים (למשל 04:12) — [Recall](https://www.recall.it/); "Every line is time-stamped and clickable" — [Recall YouTube summarizer](https://www.recall.it/youtube-video-summarizer). מ־18/6/2026: Personas, שמסוגלות "pulling exact timestamps from YouTube videos" — [Recall changelog](https://feedback.recall.it/changelog).
- **חותמות זמן ועיגון:** כל שורה לחיצה. הצ'אט מעוגן לסרטון: "Answers are grounded only in that video" — [Recall docs](https://docs.recall.it/use-cases/content-type/youtube). על האמינות, הצהרת היצרן: "Accuracy is high for clearly-spoken content" — [Recall YouTube summarizer](https://www.recall.it/youtube-video-summarizer).
- **תוכן חזותי:** **אין** — OCR רק לתמונות — [Recall changelog](https://feedback.recall.it/changelog).
- **למידה, צ'אט, ספרייה** — [Recall](https://www.recall.it/); [Recall Pricing](https://www.recall.it/pricing):
  - צ'אט.
  - חידונים (רב־ברירה, תשובה קצרה, לפי זמן, התאמה) וחזרה מרווחת.
  - גרף ידע.
  - Listen Mode בקול משובט.
  - augmented browsing "local first", שמזכיר תוכן שמור בזמן גלישה.
  - ב־Max: פעולות על 100 פריטים.
- **ייצוא ואינטגרציות:** Markdown — [Recall](https://www.recall.it/). ‏API ו־MCP, גם בחינם — [Recall Pricing](https://www.recall.it/pricing). כלי MCP נוספים מ־2/11/2026 — [Recall changelog](https://feedback.recall.it/changelog).
- **פלטפורמות:** תוספים לארבעה דפדפנים (Safari ו־Edge נוספו ב־19/8/2026), ‏iOS ו־Android — [Recall](https://www.recall.it/); [Recall changelog](https://feedback.recall.it/changelog).
- **מחירים (נבדק 9/11/2026)** — [Recall Pricing](https://www.recall.it/pricing):
  - Free: ‏10 סיכומים, API ו־MCP.
  - Plus: ‏$10 לחודש בשנתי — צ'אט, חידון, חזרה מרווחת, Listen וגרף.
  - Max: ‏$38 לחודש — בחירת מודל ופעולות אצווה.
  - 20% הנחה לסטודנטים; החזר תוך 30 יום.
- **עברית/RTL:** רישום ה־CWS באנגלית בלבד — [CWS](https://chromewebstore.google.com/detail/recall-summarizer-youtube/ldbooahljamnocpaahaidnmlgfklbben?hl=en). ‏62 שפות AI, בלי רשימה שאומתה לעברית — [Recall release notes](https://feedback.recall.it/changelog/recall-release-notes-july-23-2026-rebuilt-social-saves-table-view-more-ai-langua).
- **פרטיות:** "does not use your data to train AI models" — [CWS](https://chromewebstore.google.com/detail/recall-summarizer-youtube/ldbooahljamnocpaahaidnmlgfklbben?hl=en).
- **ביקורות:** CWS ‏4.5 מ־139, ‏90,000 משתמשים, גרסה 1.139 מ־1/11/2026 — [CWS](https://chromewebstore.google.com/detail/recall-summarizer-youtube/ldbooahljamnocpaahaidnmlgfklbben?hl=en). ציטוט: "The YouTube video summarizer is by far the best part of this thing, and it's not close."; ותלונה על תקלת חיוב ב־Stripe — [CWS reviews](https://chromewebstore.google.com/detail/recall-summarizer-youtube/ldbooahljamnocpaahaidnmlgfklbben/reviews).
- **חוזקות / חולשות / לקח:** חוזקה — לולאת למידה מלאה (ספרייה ← חידון ← חזרה מרווחת), וצ'אט שמעוגן לסרטון. חולשות — עיוור לתוכן חזותי בווידאו, ואנגלית תחילה. לקח: הערך המצטבר של ספרייה וחזרה מרווחת שומר משתמשים יותר מהסיכום הבודד.

#### 14. Video Highlight
- **מה זה, מיצוב:** כלי ווב לסיכום ותמלול של וידאו ואודיו, עם ספרייה וצ'אט; "Every point in the summary is time:stamped" — [Video Highlight (נבדק 9/11/2026)](https://videohighlight.com/). חברה ושנה — **לא נמצא**.
- **קלט:** YouTube, פלייליסטים וערוצים; העלאות MP4, ‏MOV, ‏MKV ו־AVI, ואודיו כולל הודעות קוליות — [Video Highlight](https://videohighlight.com/). גם Vimeo, ‏Dailymotion ו־Drive; קבצים עד 1GB — [Video Highlight vs Eightify (מקור של היצרן, 7/2026)](https://videohighlight.com/vs/eightify).
- **עיבוד:** תמלול משלו ב־37 שפות. בעמוד התמלילים שלוש רמות: "High accuracy" (14 שפות), ‏"Medium accuracy" (13) ו־"Good accuracy" (10). ה־FAQ באותו עמוד מדרג "high/medium/low", כך ש־"Good" היא בפועל הרמה השלישית. ‏~95%+ דיוק מילים מוצהר רק לאנגלית ולספרדית — [Video Highlight transcripts](https://videohighlight.com/features/transcripts). מודלים "Whisper-family" — [Video Highlight (תקציר חיפוש)](https://videohighlight.com/features/transcripts). בחירת שפת דיבור (25/11/2025) ודירוג הדיוק (23/11/2025) — [Video Highlight updates](https://videohighlight.com/updates). הסיכום, במצבי Summary ו־Key Points, עם "custom fine-tuning" — [Video Highlight summary](https://videohighlight.com/features/summary).
- **תוכן חזותי:** "Captured key-moment screenshots", בלי הסבר על המנגנון — [Video Highlight](https://videohighlight.com/).
- **חותמות זמן ועיגון:** כל נקודה עם זמן, וגם הצ'אט עם זמנים — [Video Highlight](https://videohighlight.com/). "SRT timestamps come from the transcript segments themselves" (12/7/2026) — עדות ישירה לעיגון ברמת מקטע — [Video Highlight updates](https://videohighlight.com/updates).
- **צ'אט וספרייה:** צ'אט וחיפוש על פני כמה סרטונים — [Video Highlight](https://videohighlight.com/). חיפוש בספרייה מ־12/7/2026 — [Video Highlight updates](https://videohighlight.com/updates).
- **ייצוא ואינטגרציות:** Notion, ‏Readwise, ‏Word, ‏MD, ‏CSV, ומחברים ל־Claude ול־ChatGPT — [Video Highlight](https://videohighlight.com/). ‏PDF, ‏DOCX, ‏SRT/VTT, ‏API ו־MCP — [Video Highlight vs Eightify](https://videohighlight.com/vs/eightify). שרת MCP בבטא מ־11/7/2026 — [Video Highlight updates](https://videohighlight.com/updates).
- **פלטפורמות:** ווב; לפי Toolworthy — דסקטופ בלבד, ומאט מעל 45 דקות — [Toolworthy](https://www.toolworthy.ai/en/blog/best-ai-video-summarizer).
- **מחירים (7/2026):** חינם — "7 hr 30 min ... (about 10 videos)"; בתשלום — "start around $8/month billed yearly" — [Video Highlight vs Eightify](https://videohighlight.com/vs/eightify).
- **עברית/RTL:** עברית ברמה "Good accuracy", יחד עם יפנית, הינדי, הונגרית, צ'כית, בולגרית, אורדו, אסטונית, לטבית וולשית — [Video Highlight transcripts](https://videohighlight.com/features/transcripts). רשומת עדכון מלפני כשנה (סביב 11/2025) מנתה את העברית תחת "Low Accuracy" — [Video Highlight updates](https://videohighlight.com/updates). מספר דיוק לעברית — לא פורסם.
- **פרטיות:** **לא נמצא**.
- **ביקורות:** אין עמוד Trustpilot (404). ביקורות עצמאיות — לא נמצאו.
- **חוזקות / חולשות / לקח:** חוזקה — שקיפות בדיוק לפי שפה, ספרייה וחיפוש בין סרטונים, MCP. חולשות — עיגון ברמת מקטע, ועברית ברמה הנמוכה. לקח: פרסום כן של הדיוק בכל שפה בונה אמון.

#### 15. WayinVideo
- **מה זה:** חבילת כלי וידאו בשלוש משפחות — Understand, ‏Create, ‏Edit — עם Find Moments, ‏Chat With YouTube ו־Mind Map ("New"); ‏API, ‏Agent Skills, תוסף Obsidian ותוסף דפדפן; 100+ שפות; 100 קרדיטי פתיחה; "5M+ Happy Creators" — [WayinVideo (נבדק 9/11/2026)](https://wayin.ai/). חברה ושנה — **לא נמצא**.
- **תוכן חזותי:** חיפוש לפי תוכן חזותי מופיע רק בהמלצות של משתמשים באתר (למשל חיפוש "Gym scene"), ולא מתועד כתכונה — [WayinVideo](https://wayin.ai/).
- **מחירים:** לפי Toolworthy — 200 קרדיטי פתיחה ועוד 30 ביום, בסתירה ל־100 שבאתר; המחיר בתשלום לא נחשף — [Toolworthy](https://www.toolworthy.ai/en/blog/best-ai-video-summarizer). שאר עמודי האתר החזירו 403.
- **חותמות זמן, עברית, פרטיות, ביקורות:** **לא נמצא**.
- **לקח:** "מציאת רגעים" (Find Moments) — חיפוש בתוך הסרטון כפעולה בפני עצמה — היא פורמט שונה מסיכום.

#### 16. Summify
- **מה זה, חברה:** Betastate Ltd; "The knowledge and memory layer for every AI you use"; ‏pods (אוספים) ו־MCP — [Summify (נבדק 9/11/2026)](https://summify.io/).
- **פלטים:** 11 סגנונות סיכום; דפי Deep Dive עם תובנות לחיצות, ישויות וטבלאות; צ'אט עם ציטוטים; 130+ שפות — [Summify](https://summify.io/).
- **פלטפורמות:** ווב; התוסף מסומן "Soon" — [Summify](https://summify.io/).
- **מחירים (נבדק 9/11/2026):** Starter ‏$8 לחודש ($100 לשנה), ‏Pro ‏$16 ($200), ‏Max ‏$33 ($400); ניסיון של 3 ימים — [Summify Pricing](https://summify.io/pricing). Toolworthy הזכיר בעבר מסלול לכל החיים ב־$179, שלא מופיע היום — [Toolworthy](https://www.toolworthy.ai/en/blog/best-ai-video-summarizer).
- **2025–2026:** השקה מחדש ב־Product Hunt ב־18/3/2026, ו־MCP ב־21/4/2026 (וגם השקות ב־2023 וב־2024) — [Product Hunt](https://www.producthunt.com/products/summify/launches).
- **ביקורות:** ‏5.0 מ־200+, ‏50K+ משתמשים ו־30M+ דקות — טענות היצרן — [Summify](https://summify.io/). אין עמוד Trustpilot.
- **תוכן חזותי, עברית, פרטיות, פירוט חותמות הזמן:** **לא נמצא**.
- **לקח:** מיצוב כ"שכבת זיכרון" לכל עוזרי ה־AI (דרך MCP) — הסיכום הופך לחומר גלם לסוכנים אחרים.

#### 17. Mapify
- **מה זה, חברה:** הופך תוכן, כולל וידאו, למפת חשיבה; באתר מופיעה SUPERMIND PTE. LIMITED — [Mapify (נבדק 9/11/2026)](https://mapify.so/), וב־CWS המפתחת היא XMIND LTD. — [CWS](https://chromewebstore.google.com/detail/mapify-ai-summarizer-mind/fldgacclkckcmflokaialbihppmndpbd). טוען ל־"5 million" משתמשים — [Mapify](https://mapify.so/).
- **פלטים ועיגון:** "Click to navigate key moments from the mind map directly in the video"; תמלילים; ייצוא לתמונה, PDF ו־MD; ‏"Present as Slides" — [Mapify](https://mapify.so/).
- **מחירים (נבדק 9/11/2026)** — [Mapify Pricing](https://mapify.so/pricing):
  - Free: ‏30 קרדיטים חד־פעמיים (כ־5 סרטונים).
  - Basic: ‏$9.99 לחודש, או $5.99 בשנתי.
  - Pro: ‏$19.99 או $11.99.
  - Unlimited: ‏$29.99 או $17.99.
  - 30% הנחה לחינוך.
- **עברית:** **אין** עברית בין 16 שפות הרישום ב־CWS — [CWS](https://chromewebstore.google.com/detail/mapify-ai-summarizer-mind/fldgacclkckcmflokaialbihppmndpbd).
- **ביקורות:** CWS ‏4.1 מ־26, ‏100,000 משתמשים, גרסה 1.6.3 מ־19/1/2026 — [CWS](https://chromewebstore.google.com/detail/mapify-ai-summarizer-mind/fldgacclkckcmflokaialbihppmndpbd). ‏Trustpilot ‏3.2 מ־5: "I signed up for the Mapify 3-day free trial, but my account was charged immediately." (8/6/2026) — [Trustpilot](https://www.trustpilot.com/review/mapify.so).
- **תוכן חזותי, פרטיות:** **לא נמצא**.
- **לקח:** מפה שכל צומת בה קופץ לרגע בסרטון היא עיגון חזותי של מבנה ההרצאה.

#### 18. Tactiq — חלק ה־YouTube
- **מה יש:** מחולל תמליל חינמי בלבד. היצרן מזהיר שהתמליל "not always 100% accurate", ובעמוד מופיע © 2024 — [Tactiq YouTube transcript (נבדק 9/11/2026)](https://tactiq.io/tools/youtube-transcript). הכתובת tactiq.io/tools/youtube-summarizer החזירה 404 בבדיקה ב־9/11/2026, ויכולות ה־AI של Tactiq מכוונות לפגישות.
- **ביקורות:** ‏Trustpilot ‏3.2 מ־15 (על החברה כולה): "The transcript is horrible." — [Trustpilot](https://www.trustpilot.com/review/tactiq.io).
- **לקח:** מחולל תמליל חינמי משמש כמשפך SEO למוצר אחר.

#### 19. Mindgrasp — חלק הווידאו
- **מה יש:** קלט מ־YouTube, ‏Vimeo, ‏MP4/MP3, הקלטה חיה, Canvas ו־Blackboard; פלט של הערות, כרטיסיות, חידונים ומורה AI; 20+ שפות; "5M+" ו־"unlimited uploads" — [Mindgrasp (נבדק 9/11/2026)](https://www.mindgrasp.ai/). מחיר — **לא נמצא** (הכתובת /pricing מחזירה 404).
- **ביקורות:** ‏Trustpilot ‏2.2 מ־136: "poor at providing good summaries of videos"; חיוב שנתי של 187 שהמשתמש לא התכוון אליו; ביטול שדורש "seven steps" — [Trustpilot](https://www.trustpilot.com/review/mindgrasp.ai).
- **תוכן חזותי, חותמות זמן, עברית:** **לא נמצא**.

#### 20. ScreenApp — מסכם הווידאו
- **המסכם:** תמליל, זיהוי דוברים ופרקים לחיצים; "AI reads video frames ... when you ask about something on screen" — כלומר הפריימים נקראים רק כשהמשתמש שואל בצ'אט; ייצוא בתשלום ל־PDF, ‏DOCX, ‏SRT ו־VTT; 100+ שפות; בחינם 2 תמלולים של עד 45 דקות, ב־Pro עד שעתיים וב־Max עד 3 שעות; ובעמוד עצמו מצוינת חולשה ב־"narration-free slides" — [ScreenApp AI summarizer (נבדק 9/11/2026)](https://screenapp.io/features/ai-summarizer).
- **Video OCR (כלי נפרד):** מזהה "slides, captions, on-screen labels, signage, and graphics" עם חותמות זמן; התוכן "not used to train AI models" — [ScreenApp Video OCR](https://screenapp.io/features/video-ocr).
- **מחירים (נבדק 9/11/2026):** Pro ‏$30 לחודש או $19 בשנתי ($228); ‏Max ‏$69 או $34; ‏Enterprise מ־$199; ניסיון של 7 ימים שהופך לחיוב שנתי של $228 — [ScreenApp Pricing](https://screenapp.io/pricing).
- **ביקורות:** ‏Trustpilot ‏1.3 מ־54: "doesn't deliver on what's shown to you on video demos"; חיוב אוטומטי של $114 (11/2026) — [Trustpilot](https://www.trustpilot.com/review/screenapp.io).
- **עברית:** **לא נמצא** (מוצהרות 100+ שפות, בלי רשימה).
- **לקח:** OCR ככלי חיפוש נפרד, ופריימים רק לפי דרישה בצ'אט — שניהם לא משולבים בסיכום עצמו.

#### 21. Notta — חלק הווידאו
- **מה יש:** מסכם YouTube בווב; **עברית מופיעה ברשימת שפות הפלט**; סיכום אחד חינם לכל משתמש; תוסף עם "timestamp breakdowns" ו־50+ שפות — [Notta YouTube summarizer (נבדק 9/11/2026)](https://www.notta.ai/en/tools/youtube-video-summarizer).
- **מחירים:** Pro ‏$8.17 לחודש בחיוב שנתי (1,800 דקות) — [Notta pricing (לפי 06)](https://www.notta.ai/en/pricing). ‏58 שפות ו־50% הנחה לחינוך — [Scrimba](https://scrimba.com/articles/best-ai-video-summarizers-2026/).
- **ביקורות:** הדירוג ב־Trustpilot מוסתר בגלל הפרת כללים וביקורות מזויפות; 170 ביקורות, 87% מהן כוכב אחד; תלונות: "throws in random words", "failed to recognize Greek", וחיובים — [Trustpilot](https://www.trustpilot.com/review/notta.ai).
- **תוכן חזותי:** **לא נמצא**.
- **לקח:** עברית ברשימת שפות הפלט היא אחת הראיות הישירות המעטות לעברית בפלט במוצרי הקטגוריה, אבל בלי שום עדות לאיכות.

#### 22. הפלטפורמה עצמה — Ask בדף הצפייה ו־Ask YouTube
- **Ask בדף הצפייה:** כלי שיחה שעונה על שאלות על הסרטון הנצפה, בסרטונים נבחרים בלבד ומגיל 13; ב־Android, ‏iOS, ווב וטלוויזיה. **עברית ברשימת השפות הנתמכות.** השיחות נמחקות אחרי 45 יום, ושיחות שנבדקו בידי אדם נשמרות עד 3 שנים — [YouTube Help 14110396 (נבדק 9/11/2026)](https://support.google.com/youtube/answer/14110396).
- **Ask YouTube (חיפוש שיחתי):** ארה״ב ואנגלית בלבד; התשובות "blend long-form videos, Shorts, and text", וריחוף על סרטון מנגן אותו מהרגע הרלוונטי — [YouTube Help 16943763](https://support.google.com/youtube/answer/16943763?hl=en). ההכרזה ב־I/O ‏(19/5/2026): בשלב זה למנויי Premium מגיל 18 בארה״ב, דרך youtube.com/new, עם כוונה "to roll this out broadly to all YouTube users soon" — [YouTube Blog](https://blog.youtube/news-and-events/youtube-news-google-io-2026/).
- **מגבלות:** אזהרה שהתשובות "may sometimes produce inaccurate or offensive information"; אין ייצוא — [Scrimba](https://scrimba.com/articles/best-ai-video-summarizers-2026/).
- **לקח:** שאלות ותשובות בסיסיות על סרטון, כולל בעברית, הופכות לתכונה חינמית של הפלטפורמה. הערך של מוצר עצמאי חייב להיות במה שהפלטפורמה לא נותנת: ייצוא, עומק, ראייה, ספרייה, וכל סרטון — לא רק סרטונים נבחרים.

#### 23. מחברות ודפדפנים עם AI מובנה
- **Gemini Notebook (לשעבר NotebookLM):** לפי בלוג של HoverNotes (מוצר משלים, עודכן 30/10/2026): השם שונה ב־16/7/2026; "Gemini Notebook doesn't watch videos" (נשען על הכתוביות); וקורסים מאחורי התחברות לא נכנסים — [בלוג HoverNotes](https://hovernotes.io/en/blog/add-any-video-to-notebooklm-with-hovernotes). לא אומת במקור ראשוני.
- **דפדפנים עם AI:** העמודים הרשמיים של Gemini in Chrome, ‏Comet ו־Brave Leo לא מזכירים במפורש סיכום של YouTube (נבדק 9/11/2026) — [Gemini in Chrome](https://gemini.google/overview/gemini-in-chrome/); [Comet](https://www.perplexity.ai/comet); [Brave Leo](https://brave.com/leo/).

#### 24. מצטרפים חדשים בולטים 2025–2026 (תמצית; הפירוט בשאלה 5)
- **Summd** — תוסף קטן (259 משתמשים) שמצהיר על "frame analysis" שמאפשר "ask about what's on screen"; ‏15 הודעות חינם — [CWS](https://chromewebstore.google.com/detail/youtube-ai-chat-summary/cjhickmaokeejgncknjhgiebnloakppe).
- **YTSummarizer** — הושק ב־20/4/2026 עם חבילות חד־פעמיות: $9 ל־30 סיכומים, $19 ל־200, $49 ל־1,000 — [Product Hunt](https://www.producthunt.com/products/ytsummarizer/launches).
- **Summario** — ‏10K משתמשים, ‏4.9; מוסיף המלצה אם שווה לצפות, ציר זמן, צ'אט וסנטימנט של התגובות — [CWS](https://chromewebstore.google.com/detail/summario-ai-youtube-summa/omjcmicfodhllalfjnkpcblodloljpmi).
- **Memories.ai** — מאמר של הספק (3/1/2026) קובע שאף אחד מחמשת המסכמים שסקר לא מנתח פריימים — [Memories.ai blog](https://memories.ai/blogs/best-5-ai-youtube-video-summarizer-tools-in-2026).
- **קוד פתוח:** steipete/summarize — פריימים לפי סצנה, OCR אופציונלי (tesseract) ופלט עם זמנים — [GitHub](https://github.com/steipete/summarize). ‏Fabric — דגל `--visual` ("OCR and FFmpeg frame extraction") — [GitHub](https://github.com/danielmiessler/Fabric).

### Inferences
- הקטגוריה מתחלקת לחמישה ארכיטיפים: (1) מסכמי YouTube ייעודיים בתוסף (Eightify, ‏Glasp, ‏Glarity, ‏Summario); (2) סרגלי AI כלליים, שבהם YouTube הוא פיצ'ר אחד (Sider, ‏Monica, ‏Merlin, ‏HARPA, ‏MaxAI); (3) פלטפורמות ידע ולמידה (Recall, ‏Readray, ‏Summify, ‏Video Highlight, ‏NoteGPT, ‏Mindgrasp, ‏Mapify); (4) מוצרים שהראייה בבסיסם (BibiGPT, ‏HoverNotes, ‏ScreenApp OCR, ‏Summd); (5) הפלטפורמה עצמה (Ask ב־YouTube, ‏Gemini Notebook). לכל אחד מהם יש חלק קטן מהתמונה שאנחנו מכוונים אליה.
- **ב־2026 הראייה עברה מניסוי לתכונת Pro** (BibiGPT ב־4/2026, ‏Readray ב־10/2026, ‏ScreenApp OCR), אבל אף מוצר לא משלב ראיות חזותיות כברירת מחדל בכל ניתוח. אצל כולם זו תוספת נפרדת: Beta, צ'אט או כלי OCR עצמאי.
- אצל המוצרים הכי גדולים (Sider, ‏Monica, ‏Merlin) YouTube הוא פיצ'ר משני, והוא נשבר בלי תחזוקה. העדות: ביקורות על Merlin ב־2026 ועל Monica ב־10/2025. ההיקף הגדול לא מבטיח את איכות היכולת הספציפית.
- החפיר שמחזיק משתמשים הוא כנראה הספרייה, הלמידה והאינטגרציות (Recall, ‏Glasp, ‏Video Highlight, ‏Summify), ולא איכות הסיכום הבודד, שהפך למצרך. לסיכום עצמו כבר יש חלופה חינמית בפלטפורמה.
- כל העיגון בזמן שתועד הוא ברמת מקטע כתובית, שורה או סצנה (Video Highlight מצהיר זאת במפורש). ‏Readray אפילו מחזיר בצ'אט מספר משפט. אף מוצר לא מצהיר על תזמון ברמת מילה.

### Gaps
- אף מוצר לא הופעל בפועל — בלי חשבונות ובלי תשלום. כל הנתונים הם הצהרות יצרן, רישומי חנות, ביקורות ומאמרי צד שלישי. אין מדידה עצמאית של דיוק הסיכום או של דיוק חותמות הזמן.
- **תקציב החיפוש המשותף נגמר** אחרי כ־35 חיפושים. לכן נבדקו רק עמודים שכתובתם הייתה ידועה או נגזרה. ייתכן שחסרים מצטרפים חדשים מ־2026 שלא הופיעו בחיפושים המוקדמים.
- Reddit, ‏G2, ‏Capterra, ‏AlternativeTo ו־There's An AI For That לא נטענו (403), ו־Google Play חזר ריק. לכן חסרות דעות משתמשים מעמיקות.
- מחירי Merlin, ‏Sider, ‏Monica ו־WayinVideo לא אומתו (403 או JS), ונשענים רק על רמזים מביקורות.
- **Taskade ו־Jotform:** חמש כתובות משוערות של עמודי "YouTube summarizer" החזירו 404. לא אומת שיש להם כיום כלי פעיל לסיכום וידאו, ולכן הם לא נכללו במטריצה.
- Readray: תקציר חיפוש הציג מחירי ווב של $7.99–19.99 לחודש ו־$69.99 לשנה, בסתירה לרשימת הרכישות ב־App Store. לא אומת.
- Eightify: מימון, מספר עובדים, והתנהגות בסרטון בלי כתוביות — לא נמצאו. ‏BibiGPT: ביקורות עצמאיות ומכסת חינם — לא נמצאו. ‏Kagi Summarizer דורש התחברות ולכן הושמט.
- **איכות בעברית לא נבדקה באף מוצר.** "עברית ברשימת השפות" ב־CWS מעידה רק על לוקליזציה של הממשק.

---

## שאלה 2: מטריצת השוואה — מי עושה מה (נכון ל־9/11/2026)

### Takeaway
רק ארבעה מוצרים מפיקים ראיות חזותיות מהסרטון: BibiGPT, ‏Readray, ‏HoverNotes, ו־ScreenApp באופן חלקי (בצ'אט ובכלי OCR נפרד). כמעט כולם מציעים חותמות זמן לחיצות, אבל ברמת מקטע, שורה או סצנה. עברית מופיעה כשפת ממשק בשבעה תוספים, אבל כפלט היא מוצהרת רק אצל Notta, ‏Video Highlight (ברמת הדיוק הנמוכה) ו־Ask של YouTube. מחירי הכניסה נעים סביב $8–20 לחודש, ובכמה מהמוצרים יש פער חד בין הדירוג בחנות לבין Trustpilot.

### Cited Findings
**מקרא:** כן / לא / חלקי · "?" = לא נמצא מקור · "—" = לא רלוונטי. כל תא נשען על כרטיס המוצר בשאלה 1 ועל המקורות שמצוטטים שם, והעמודה "מקור" בטבלה ב' מפנה לעמוד הראשי. המטריצה מחולקת לשתי טבלאות של 13 ו־11 עמודות (24 בסך הכל) כדי שתהיה קריאה.

#### טבלה א' — יכולות ניתוח ועיגון

| מוצר | קלט מעבר לסרטון בודד | בלי כתוביות | ראייה / OCR | צילומים בפלט | זמנים לחיצים | רמת העיגון המתועדת | צ'אט על הסרטון | ספרייה / בין סרטונים | מפה / מצגת | כרטיסיות / חידון | ייצוא | אינטגרציות / API | ייחודי |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Eightify | לא (YouTube בלבד) | ? | לא | לא | כן | רעיון ← זמן | לא | לא | לא | לא | העתקה, שיתוף | לא | מיקוד "controversial", סקירת תגובות |
| Glasp | מאמרים, PDF, ערוצים, אודיו | לא (תלוי בכתוביות) | לא | לא | כן (סיכום, תמליל, צ'אט) | מקטע כתובית | כן | חלקי (ספריית הדגשות) | לא | ייצוא ל־Anki | MD, ‏HTML, ‏CSV, ‏JSON | Notion, ‏Obsidian, ‏Roam, ‏Zotero, ‏Tana, ‏Zapier, ‏MCP | תמליל בסרגל משלו |
| Summarize.tech | לא | ? | לא | לא | כן | מקטע | לא | לא | לא | לא | ? | לא | מושבת |
| NoteGPT | פלייליסטים, אצווה של 20, ‏Vimeo, ‏Udemy, ‏Coursera, קבצים | כן (120–210 דק׳) | לא | ידני | כן | מקטע | כן | ? | כן | כן | TXT, ‏SRT | Notion, ‏Docs, ‏Slack | סיכום ערוצים |
| HARPA | כל דף | לא | לא | לא | כן | ? | כן | ? | לא | לא | ? | API, אוטומציות, BYOK | פרומפטים בלי זיכרון בין חלקים |
| Merlin | כל דף | ? | לא | לא | כן (תקציר חיפוש) | ? | כן | ? | לא | לא | ? | ? | כתוביות דו־לשוניות |
| Monica | YouTube בעיקר | כן | לא | לא | כן | ? | כן | ? | מפה עם כל סיכום | שאלות תרגול | ? | ? | מפה וחידון כברירת מחדל |
| Sider | כל דף | כן (מ־12/2024; ה־FAQ סותר) | לא | לא | בתמליל | ? | כן | ? | ? | ? | הורדת תמליל | BYOK | Video Shortener |
| Glarity | Google, ‏X, כל דף | לא | לא | לא | כן (הדגשים) | מקטע | כן | ? | לא | FAQ | ? | ChatGPT/Claude web, מפתח OpenAI | קוד פתוח (GPL‑3.0) |
| BibiGPT | 20+ פלטפורמות, קבצים | כן (תמלול + OCR לכתוביות צרובות) | **כן** (שקופיות, OCR, ‏VLM; ‏Beta/Pro) | כן | כן | סצנה (התחלה–סוף) | כן | ? | כן (מפות, ‏PPTX) | ? | SRT, ‏VTT, ‏MD, ‏PDF, ‏PPTX | Notion, ‏Obsidian, ‏MCP, ‏OpenAPI | שקופיות ל־PPTX ניתן לעריכה |
| Readray | מאמרים, PDF, פלייליסט עד 10 | ? | **כן** (פריימים, שקופיות, גרפים) | כן (playbook) | כן | שורה עם ציטוט; בצ'אט מספר משפט | כן | כן (תיקייה) | ? | ? | ? | MCP | דוחות לפי סוג + ציון ביטחון |
| HoverNotes | כל נגן, LMS, קבצים | כן | **כן** (קוד, דיאגרמות, UI) | כן (ידני + AI ב־Pro) | כן | רגע ההערה | כן (Hovie, בתשלום) | ? | ? | ? | PDF, ‏Word, ‏MD | Obsidian | צילום ברגע ההערה, LMS |
| Recall | מאמרים, פודקאסטים, PDF | כן (עד 5 שעות) | לא (OCR לתמונות בלבד) | לא | כן (כל שורה) | שורה | כן (מעוגן לסרטון) | כן (ספרייה, גרף ידע) | גרף ידע | כן + חזרה מרווחת | MD | API, ‏MCP | augmented browsing |
| Video Highlight | פלייליסטים, ערוצים, ‏Vimeo, ‏Dailymotion, ‏Drive, העלאות | כן | חלקי (צילומי רגעים, מנגנון לא מוסבר) | כן | כן | מקטע תמליל (מוצהר) | כן, עם זמנים | כן | ? | ? | PDF, ‏DOCX, ‏MD, ‏CSV, ‏SRT, ‏VTT | Notion, ‏Readwise, ‏API, ‏MCP | דיוק מפורסם לכל שפה |
| WayinVideo | ? | ? | לא מתועד | ? | ? | ? | כן | ? | מפה | ? | ? | API, ‏Agent Skills, ‏Obsidian | Find Moments |
| Summify | ? | ? | לא נמצא | ? | כן (תובנות לחיצות) | ? | כן, עם ציטוטים | כן (pods) | ? | ? | ? | MCP | 11 סגנונות, Deep Dive |
| Mapify | ? | ? | לא נמצא | ? | כן (מהמפה) | צומת במפה | ? | ? | כן (מפה + Slides) | ? | תמונה, PDF, ‏MD | ? | ניווט בסרטון מתוך המפה |
| Tactiq (YouTube) | לא | ? | לא | לא | ? | ? | לא | לא | לא | לא | תמליל | — | מחולל תמליל בלבד |
| Mindgrasp | Vimeo, ‏MP4/MP3, הקלטה חיה, ‏Canvas, ‏Blackboard | ? | לא נמצא | ? | ? | ? | כן (מורה AI) | ? | ? | כן | ? | Canvas, ‏Blackboard | LMS |
| ScreenApp | הקלטות והעלאות | כן | חלקי (פריימים רק בצ'אט; OCR בכלי נפרד) | ? | כן (פרקים) | פרק; OCR עם זמנים | כן | ? | ? | ? | PDF, ‏DOCX, ‏SRT, ‏VTT (בתשלום) | ? | Video OCR |
| Notta | ? | ? | לא נמצא | ? | "timestamp breakdowns" (תוסף) | ? | ? | ? | ? | ? | ? | ? | עברית ברשימת שפות הפלט |
| Ask בדף הצפייה (YouTube) | — | — | לא מתועד | לא | ? | ? | כן | לא | לא | לא | אין | לא | מובנה בנגן, חינם |
| Ask YouTube (חיפוש) | כל הקטלוג | — | ? | לא | ריחוף מהרגע הרלוונטי | ? | כן | כן (חיפוש) | לא | לא | אין | לא | חיפוש שיחתי |
| Summd | ? | ? | **כן** ("frame analysis") | ? | כן | ? | כן | ? | ? | ? | ? | ? | שאלות על מה שמוצג במסך |
| Summario | ? | כן (תמלול) | לא נמצא | ? | כן (מקטעים) | מקטע | כן | ? | ? | ? | Notion, ‏Obsidian, ‏PDF, ‏MD (Pro) | ? | "שווה לצפות?", סנטימנט תגובות |
| steipete/summarize (קוד פתוח) | דפים, קבצים, פודקאסטים | כן (תמלול מקומי או בענן) | **כן** (פריימים לפי סצנה + OCR) | פריימים | פלט עם זמנים | ? | — | — | — | — | ? | yt-dlp, ספקי מודלים | CLI ותוסף |

#### טבלה ב' — שפה, פלטפורמה ומסחר

| מוצר | פלטפורמות | ממשק בעברית (CWS) | עברית בפלט — ראיה | אורך מרבי מוצהר | חינם | כניסה בתשלום (נבדק) | חינוך | CWS: משתמשים / ציון | Trustpilot | עדכון אחרון ידוע | מקור |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Eightify | Chrome, ‏Safari, ‏iOS, ‏Android | כן | ? ("40+ languages") | 10 שעות (ב־Safari ‏4–6) | ניסיון של 7 ימים | iOS ‏$9.99/ח׳; Safari ‏$4.99/ח׳ | ? | 200K / 4.0 | אין עמוד | 14/11/2025 | [CWS](https://chromewebstore.google.com/detail/eightify-ai-youtube-summa/cdcpabkolgalpgeingbdcebojebfelgb) |
| Glasp | Chrome, ‏Edge, ‏Firefox, ‏Safari, ‏iOS, ‏Android | לא (אנגלית) | שפת סיכום לבחירה; לא נבדק | ? | 3 ביום + 3 מתקדמים ל־7 ימים | ‏$15/ח׳ ($150/ש׳) | חינם לסטודנטים + 40% | 2M / 4.2 | 3.0 (2) | 17/10/2026 | [Pricing](https://glasp.co/pricing) |
| Summarize.tech | ווב | — | ? | שעתיים (לפי מתחרה) | ? | ? | ? | — | ? | מושבת (503 ב־6/8 וב־9/11/2026) | [Scrimba](https://scrimba.com/articles/best-ai-video-summarizers-2026/) |
| NoteGPT | ווב, ‏Chrome/Edge, מובייל | כן | ? | סותר ("No limits" מול 150 דק׳ בלי כתוביות) | 15 בחודש (תוסף) | ‏$9.99/ח׳ ($9 בשנתי) | לשונית Education | 400K / 5.0 | 1.8 (35) | 25/8/2026 | [Pricing](https://notegpt.io/pricing) |
| HARPA | תוסף | לא | ? | חלוקה ל־chunks | 10 הודעות ביום | ‏€14.3/ח׳ (שנתי) | "We do not offer discounts" | 400K / 4.5 | 0 ביקורות | 7/11/2026 | [Pricing](https://harpa.ai/pricing) |
| Merlin | תוסף, אפליקציה | כן | ? | ? | מוגבל | לא נמצא (403) | ? | ~900K / 4.4 | 3.7 (131) | 3/11/2026 (פיצ'ר YouTube נשבר לפי ביקורות) | [CWS](https://chromewebstore.google.com/detail/merlin-ask-ai-to-research/camppjleccjaphfdbohjdohecfnoikec) |
| Monica | תוסף, ווב, ‏iOS, ‏Android, ‏Windows, ‏Mac | כן | ? ("over 20 major languages") | ? | ? | לא נמצא | ? | 3M / 4.8 | 1.5 (36) | 2/11/2026 | [מוצר](https://monica.im/en/products/ai-video-summarizer) |
| Sider | תוסף, ווב, דסקטופ | כן | ? | ? | 60 קרדיטים ביום (ביקורת) | לא נמצא ($195/ש׳ לפי ביקורת) | ? | 5M / 4.9 | 2.3 (16) | 6/11/2026 | [CWS](https://chromewebstore.google.com/detail/difoiogjjojoaoomphldepapgpbgkhkb) |
| Glarity | Chrome, ‏Edge, ‏Safari, ‏Firefox, ‏Opera | כן | ? | ? | חינם דרך ChatGPT web | לפי טוקנים | ? | 100K / 3.7 | ? | 12/7/2026 | [CWS](https://chromewebstore.google.com/detail/glarity-chatgpt-summary-t/cmnlolelipjlhfkhpohphpedmkfbobjc) |
| BibiGPT | ווב, תוסף, דסקטופ, ‏iOS, ‏Android | ? | לא ב־OCR (6 שפות) | 4h+ (היצרן) | ? | Plus ‏$19.8/ח׳; Lifetime ‏$888 | ? | לא נבדק | ? | 7/4/2026 (4.318.0) | [Home](https://www.bibigpt.co/en) |
| Readray | תוסף, דסקטופ, מובייל | ? | לא נמצא | 3 שעות בחינם (בלוג היצרן) | "Unlimited" עד 3 שעות | Starter ‏$10.49/ח׳ (App Store) | ? | ? | ? | 29/10/2026 | [App Store](https://apps.apple.com/us/app/readray-formerly-lilysai/id6759151868) |
| HoverNotes | Chrome | כן | ? (24 שפות ב־Pro) | ? | 20 דקות AI | ‏$18/ח׳ ($10 בשנתי) | ? | 30K / 4.6 | ? | 4–5/11/2026 | [Pricing](https://hovernotes.io/pricing) |
| Recall | 4 דפדפנים, ‏iOS, ‏Android | לא (אנגלית) | 62 שפות; עברית לא אומתה | 10 שעות / 5 שעות בלי כתוביות | 10 סיכומים | Plus ‏$10/ח׳ (שנתי) | 20% | 90K / 4.5 | ? | 1/11/2026 | [Pricing](https://www.recall.it/pricing) |
| Video Highlight | ווב | ? | "Good accuracy" (הרמה השלישית) | קבצים עד 1GB | 7.5 שעות | ~$8/ח׳ (שנתי) | ? | — | אין עמוד | 12/7/2026 | [vs Eightify](https://videohighlight.com/vs/eightify) |
| WayinVideo | ווב, תוסף | ? | 100+ שפות; לא אומת | ? | 100 קרדיטים (סותר) | לא נחשף | ? | ? | ? | ? | [Home](https://wayin.ai/) |
| Summify | ווב (התוסף "Soon") | — | 130+ שפות; לא אומת | ? | ניסיון של 3 ימים | Starter ‏$8/ח׳ | ? | — | אין עמוד | 21/4/2026 (MCP) | [Pricing](https://summify.io/pricing) |
| Mapify | ווב, תוסף | לא | ? | ? | 30 קרדיטים חד־פעמיים | Basic ‏$9.99/ח׳ ($5.99 בשנתי) | 30% | 100K / 4.1 | 3.2 (5) | 19/1/2026 | [Pricing](https://mapify.so/pricing) |
| Tactiq (YouTube) | ווב | — | ? | ? | חינם | — | ? | — | 3.2 (15) | © 2024 | [Tool](https://tactiq.io/tools/youtube-transcript) |
| Mindgrasp | ? | — | 20+ שפות; לא אומת | ? | ? | לא נמצא | ? | — | 2.2 (136) | ? | [Home](https://www.mindgrasp.ai/) |
| ScreenApp | ווב | — | 100+ שפות; לא אומת | 45 דק׳ (חינם); 2–3 שעות בתשלום | 2 תמלולים | Pro ‏$30/ח׳ ($19 בשנתי) | ? | — | 1.3 (54) | ? | [Pricing](https://screenapp.io/pricing) |
| Notta | ווב, תוסף | ? | **כן** (ברשימת שפות הפלט) | ? | סיכום אחד | Pro ‏$8.17/ח׳ (שנתי) | 50% | ? | מוסתר (170 ביקורות, 87% כוכב אחד) | ? | [Tool](https://www.notta.ai/en/tools/youtube-video-summarizer) |
| Ask בדף הצפייה (YouTube) | Android, ‏iOS, ווב, טלוויזיה | — | **כן** (ברשימת השפות) | סרטונים נבחרים | חינם | — | — | — | — | 2026 | [Help](https://support.google.com/youtube/answer/14110396) |
| Ask YouTube (חיפוש) | ווב (youtube.com/new) | — | לא (ארה״ב, אנגלית) | — | — | Premium, ‏18+, ארה״ב | — | — | — | 19/5/2026 | [Help](https://support.google.com/youtube/answer/16943763?hl=en) |
| Summd | Chrome | ? | ? (17 שפות תמליל) | ? | 15 הודעות בחודש | ? | ? | 259 / 4.8 | ? | 3/8/2026 | [CWS](https://chromewebstore.google.com/detail/youtube-ai-chat-summary/cjhickmaokeejgncknjhgiebnloakppe) |
| Summario | Chrome | ? (5 שפות ממשק) | 70+ שפות; לא אומת | חינם: מתחת ל־30 דק׳ | סיכום מלא אחד + 3 מהירים + הודעת צ'אט אחת ביום | Pro ‏$5.75 או $7.99 | ? | 10K / 4.9 | ? | 30/9/2026 | [CWS](https://chromewebstore.google.com/detail/summario-ai-youtube-summa/omjcmicfodhllalfjnkpcblodloljpmi) |
| steipete/summarize | CLI ‏(Node.js), ‏Chrome Side Panel, ‏Firefox Sidebar | — | ? | ? | קוד פתוח (MIT) | — | — | — | — | ? | [GitHub](https://github.com/steipete/summarize) |

הערות למטריצה: הנתונים על Summd ו־Summario נלקחו מרישומי CWS שלהם (נבדק 9/11/2026); הנתונים על steipete/summarize — מה־README במאגר.

### Inferences
- **מה שכבר מובן מאליו (table stakes):** זמנים לחיצים, צ'אט על הסרטון, תמליל לצד הנגן, מפת חשיבה וייצוא בסיסי (MD/PDF/Notion). אלה אינם בידול. בלעדיהם המוצר ייתפס כחסר.
- **מה שנדיר:** ראייה ששזורה בתוך הסיכום (BibiGPT ו־Readray בלבד, ושניהם בתשלום); עיגון מתחת לרמת מקטע (אין אף מוצר); עברית מאומתת בפלט (אין, חוץ מרשימות שפות); דוחות לפי סוג תוכן (Readray); הערה שמעוגנת לרגע ולצילום (HoverNotes); ‏LMS (HoverNotes, ‏Mindgrasp).
- **טווח המחירים:** מסלול כניסה של $8–20 לחודש הוא הנורמה. מסלולי "Pro" של $30–60 קיימים רק אצל מי שמציע עיבוד כבד (ScreenApp, ‏Readray Pro). מודלים חלופיים — תשלום חד־פעמי, BYOK ו־Lifetime — קיימים בשוליים.

### Gaps
- סימני "?" רבים: לרוב המוצרים אין תיעוד ציבורי של רמת העיגון, של הטיפול בסרטון בלי כתוביות, או של שפות הפלט. לא ניתן היה להשלים זאת בלי חשבון ובלי תשלום.
- אין מדד השוואתי עצמאי לדיוק הסיכומים או של חותמות הזמן. כל ההשוואות שנמצאו נכתבו בידי ספקים, או בדקו רק מחיר ותכונות (Scrimba, ‏Toolworthy).

---

## שאלה 3: מגמות ואותות שוק 2025–2026

### Takeaway
שש מגמות מעצבות את הקטגוריה ב־2026:
1. מרוץ לראייה (שקופיות, OCR, מודלי ראייה).
2. הפיכת הסיכום לחומר גלם לסוכנים, דרך MCP ו־API.
3. כניסת הפלטפורמה עצמה, עם Ask שתומך בעברית ו־Ask YouTube.
4. שבירוּת שליפת הכתוביות, שדוחפת לחילוץ עצמאי.
5. משבר אמון בחיוב — תוכניות "Unlimited" עם תקרות — וניסויים במודלי מחיר חלופיים.
6. מלחמת SEO: מאמרי השוואה שכותבים הספקים עצמם, ופנייה ישירה לעוזרי AI.

ברקע: החלוצים קופאים או נעלמים (Eightify, ‏Summarize.tech), ויש גל של מיתוגים מחדש.

### Cited Findings
**1. מרוץ הראייה**
- BibiGPT הוסיף ב־7/4/2026 שלוש יכולות: OCR לכתוביות צרובות, חילוץ שקופיות וניתוח צילומי מסך במודלי ראייה — [BibiGPT v4.318.0](https://bibigpt.co/blog/posts/20260407-bibigpt-v4318-ppt-ocr-local-privacy-en).
- Readray מיתג את עצמו מחדש סביב "Sees the scene, captures the frame" (10/2026) — [Readray](https://readray.ai/en); [App Store](https://apps.apple.com/us/app/readray-formerly-lilysai/id6759151868).
- ‏ScreenApp מציע Video OCR ככלי נפרד — [ScreenApp Video OCR](https://screenapp.io/features/video-ocr).
- Summd, תוסף קטן, מציע "frame analysis" — [CWS Summd](https://chromewebstore.google.com/detail/youtube-ai-chat-summary/cjhickmaokeejgncknjhgiebnloakppe).
- Recall: עד 12/9/2026 עשה OCR רק לתמונות, ולא לווידאו — [Recall changelog](https://feedback.recall.it/changelog).
- גם הקוד הפתוח מצטרף: steipete/summarize מוציא פריימים לפי סצנה עם OCR — [GitHub](https://github.com/steipete/summarize). ל־Fabric יש דגל `--visual` — [GitHub](https://github.com/danielmiessler/Fabric). ‏lecture2notes מסווג שקופיות ברשת CNN, מקבץ אותן, מסיר כפילויות, עושה להן OCR ומשלב את הטקסט עם התמליל — [GitHub](https://github.com/HHousen/lecture2notes).
- מאמר של ספק (3/1/2026) קבע שאף אחד מחמשת המסכמים המובילים שסקר לא מנתח פריימים — [Memories.ai](https://memories.ai/blogs/best-5-ai-youtube-video-summarizer-tools-in-2026).

**2. ‏MCP ו־API — הסיכום כחומר גלם לסוכנים**
- Glasp: מחבר MCP וטריגר ב־Zapier (7/2026) — [Glasp newsletter](https://read.glasp.co/p/the-highlights-by-glasp-july-2026).
- Video Highlight: שרת MCP בבטא (11/7/2026) — [Video Highlight updates](https://videohighlight.com/updates).
- Summify: ‏MCP (21/4/2026) — [Product Hunt](https://www.producthunt.com/products/summify/launches).
- Recall: ‏API ו־MCP גם בחינם, וכלי MCP נוספים מ־2/11/2026 — [Recall Pricing](https://www.recall.it/pricing); [Recall changelog](https://feedback.recall.it/changelog).
- BibiGPT: ‏MCP, ‏OpenAPI ו־skill — [BibiGPT](https://www.bibigpt.co/en).
- Readray: ‏MCP — [Readray](https://readray.ai/en).
- WayinVideo: ‏API ו־Agent Skills — [WayinVideo](https://wayin.ai/).

**3. הפלטפורמה נכנסת**
- Ask בדף הצפייה: עברית ברשימת השפות, בסרטונים נבחרים — [YouTube Help](https://support.google.com/youtube/answer/14110396).
- Ask YouTube, חיפוש שיחתי: הוכרז ב־19/5/2026, למנויי Premium בארה״ב, "to roll this out broadly ... soon" — [YouTube Blog](https://blog.youtube/news-and-events/youtube-news-google-io-2026/); [YouTube Help](https://support.google.com/youtube/answer/16943763?hl=en).
- תוספים כבר נשענים על ה־AI המובנה של YouTube. YouTube Quick AI Summary משתמש ב־Gemini המובנה, כשהמשתמש מחובר — [CWS](https://chromewebstore.google.com/detail/gflljmlmelkidjlkclhghngmioppkkcd). תוסף אחר שולח ל־Gemini רק את הכותרת, הערוץ והקישור — [CWS](https://chromewebstore.google.com/detail/youtube-summary-with-gemi/dafkeibjaghajkpkdjmoniifpgmbemcg).

**4. שבירוּת שליפת הכתוביות**
- ‏youtube-transcript-api: ‏YouTube חוסם כתובות IP של ספקי ענן, וההמלצה היא פרוקסי ביתיים מתחלפים — [GitHub](https://github.com/jdepoix/youtube-transcript-api).
- yt-dlp: לקוח `web` צריך PO tokens לכתוביות, ובלעדיהם מתקבלות שגיאות 403 וחסימות (המדריך עודכן 12/7/2026) — [yt-dlp PO Token Guide](https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide).
- תלונות משתמשים: Glarity "no transcript available" (2/2026), ‏Merlin "can't get the transcript" (5/2026) — [CWS Glarity](https://chromewebstore.google.com/detail/glarity-chatgpt-summary-t/cmnlolelipjlhfkhpohphpedmkfbobjc/reviews); [CWS Merlin](https://chromewebstore.google.com/detail/merlin-ask-ai-to-research/camppjleccjaphfdbohjdohecfnoikec/reviews).
- Glasp העביר את התמליל לסרגל משלו כדי לשרוד שינויי עיצוב — [Glasp newsletter](https://read.glasp.co/p/the-highlights-by-glasp-july-2026).
- HARPA ממליץ לכבות את uBlock כשאין תמליל — [HARPA](https://harpa.ai/).

**5. אמון בחיוב ומודלי מחיר**
- "Unlimited" עם תקרות: NoteGPT — ‏2,800 קרדיטים — [tl;dv (מקור של מתחרה)](https://tldv.io/blog/notegpt-review/); [Trustpilot NoteGPT](https://www.trustpilot.com/review/notegpt.io). ‏Monica — [Trustpilot Monica](https://www.trustpilot.com/review/monica.im). ‏Sider — "only 1500 credits" — [Trustpilot Sider](https://www.trustpilot.com/review/sider.ai).
- פער בין החנות ל־Trustpilot: NoteGPT ‏5.0 מול 1.8; ‏Monica ‏4.8 מול 1.5; ‏Sider ‏4.9 מול 2.3 — ראו כרטיסים 4, 7 ו־8. ב־Notta הדירוג מוסתר בגלל ביקורות מזויפות — [Trustpilot Notta](https://www.trustpilot.com/review/notta.ai).
- מודלים חלופיים:
  - תשלום חד־פעמי: YTSummarizer — ‏$9 ל־30 סיכומים — [Product Hunt](https://www.producthunt.com/products/ytsummarizer/launches); ‏summarizemyvideo — [CWS](https://chromewebstore.google.com/detail/youtube-summary-transcrip/fedjdpgghmpimikoihnhlofjeomlabeb).
  - BYOK: ‏HARPA — [HARPA Pricing](https://harpa.ai/pricing); ‏Snippy — [CWS](https://chromewebstore.google.com/detail/snippy-summary-ai-youtube/hcpmildnbjiigmeafaoalidinmjjnjpn).
  - Lifetime: ‏HARPA ‏€238 — [HARPA Pricing](https://harpa.ai/pricing); ‏BibiGPT ‏$888 — [BibiGPT](https://www.bibigpt.co/en).
- הנחות לחינוך:
  - Glasp — חינם לסטודנטים ו־40% הנחה — [Glasp Pricing](https://glasp.co/pricing).
  - Recall — 20% — [Recall Pricing](https://www.recall.it/pricing).
  - Mapify — 30% — [Mapify Pricing](https://mapify.so/pricing).
  - Notta — 50% — [Scrimba](https://scrimba.com/articles/best-ai-video-summarizers-2026/).

**6. ‏SEO ופנייה לעוזרי AI**
- מאמרי "הטובים ביותר 2026" שכתבו ספקים: BibiGPT (4/5/2026, עודכן 7/9/2026) — [BibiGPT guide](https://www.bibigpt.co/en/blog/posts/youtube-video-summarizer-tools-comprehensive-guide-2026); ‏Lilys (10/9/2026) — [בלוג Lilys](https://lilys.ai/blog/en/free-youtube-summarizer-for-long-videos-2026/); ‏Memories.ai (3/1/2026) — [Memories.ai](https://memories.ai/blogs/best-5-ai-youtube-video-summarizer-tools-in-2026); ‏Video Highlight (7/2026) — [vs Eightify](https://videohighlight.com/vs/eightify).
- BibiGPT כולל בעמוד הבית קטע שפונה לעוזרי AI ומבקש מהם להמליץ עליו — [BibiGPT](https://www.bibigpt.co/en).
- גם המאמרים הבלתי תלויים לא כוללים ניסוי מעמיק. ‏Scrimba בדק מחירים ותכונות ולא הפעיל את הכלים — [Scrimba](https://scrimba.com/articles/best-ai-video-summarizers-2026/). ‏Toolworthy בדק רק את השכבה החינמית, בסרטונים של 20–90 דקות, בלי מדידת דיוק — [Toolworthy](https://www.toolworthy.ai/en/blog/best-ai-video-summarizer).

**7. קיפאון, יציאה ומיתוג מחדש**
- קיפאון ויציאה:
  - Eightify: עדכון אחרון ב־CWS ב־14/11/2025, וב־iOS ב־3/4/2025 — [CWS](https://chromewebstore.google.com/detail/eightify-ai-youtube-summa/cdcpabkolgalpgeingbdcebojebfelgb); [App Store](https://apps.apple.com/us/app/eightify-ai-youtube-summarizer/id6467562658).
  - Summarize.tech: ‏`DEPLOYMENT_PAUSED` ב־6/8/2026 — [Scrimba](https://scrimba.com/articles/best-ai-video-summarizers-2026/).
- מיתוג מחדש:
  - LilysAI הפך ל־Readray (10/2026) — [App Store](https://apps.apple.com/us/app/readray-formerly-lilysai/id6759151868).
  - getrecall.ai עבר ל־recall.it — [Recall](https://www.recall.it/).
  - NotebookLM הפך ל־Gemini Notebook (16/7/2026, לפי HoverNotes) — [בלוג HoverNotes](https://hovernotes.io/en/blog/add-any-video-to-notebooklm-with-hovernotes).
  - BiliGPT הפך ל־BibiGPT — [BibiGPT](https://www.bibigpt.co/en).
- תאגידי: Butterfly Effect, החברה מאחורי Monica, בנתה את Manus. ‏Meta רכשה את Manus בדצמבר 2025, העסקה בוטלה בהוראת סין, ו־Manus הודיעה ב־11/8/2026 שתחזור לפעול כחברה עצמאית — [eWeek](https://eweek.com/news/meta-manus-ai-deal-china-unwind-apac/); [The Decoder (תקציר חיפוש)](https://the-decoder.com/meta-pays-3-billion-for-manus-ai-after-startup-cut-all-chinese-ties-to-clear-regulatory-hurdles/).
- המודלים מתיישנים מהר: HARPA ספג ביקורת על "Outdated models" ב־10/2026 — [CWS HARPA reviews](https://chromewebstore.google.com/detail/eanggfilgoajaocelnaflolkadkeghjp/reviews).

### Inferences
- הבידול זז מ"סיכום" לשלושה דברים: (א) בעלות על צנרת החילוץ, ‏(ב) ראיות רב־מודליות, ‏(ג) מקום בזרימת העבודה — ספרייה, למידה וסוכנים. מוצר חדש שמתחרה רק באיכות הסיכום הטקסטואלי נכנס לשוק רווי, שהפלטפורמה כבר נותנת בו חלופה חינמית.
- אמון בחיוב הוא נכס תחרותי. מחיר ברור, בלי "Unlimited" עם תקרות, ועם הסבר למה נצרכה מכסה, נותן יתרון מול השחקנים הגדולים — שלפי Trustpilot מאבדים אמון.
- מאמרי השוואה של ספקים ופנייה ישירה לעוזרי AI ("GEO") הופכים את "מה אומרים עלינו מודלי השפה" לערוץ שיווק. מסקנה למחקר: אין לסמוך על דירוגים מתוך מאמרים כאלה.

### Gaps
- אין נתוני גודל שוק, הכנסות או שימוש בפועל (DAU), חוץ ממספרי ההתקנות ב־CWS ומטענות היצרנים.
- המגמות נגזרו מעמודי ספקים, יומני שינויים וביקורות. לא נמצא מחקר שוק עצמאי על הקטגוריה ב־2026.

---

## שאלה 4: מה אף אחד לא עושה טוב — המרחב הלבן ל־THE SNOWBALL Studio

> הקשר (רק לסעיף הזה): לשונית "ניתוח וידאו" ב־THE SNOWBALL Studio, ‏PWA בעברית, לסטודנטים ולאנשי עסקים דוברי עברית. היא מנתחת הרצאות, וובינרים וקורסים מהאודיו ומהמסך: ‏OCR לשקופיות, לגרפים ולקוד. חותמות הזמן מדויקות ולחיצות, ונגזרות מתזמון ברמת המילה. הניתוח כולל סינתזה עמוקה — עקרונות, תמונה גדולה וביקורת. היא עובדת עם מודלי Claude בלבד, והחילוץ נעשה בצד השרת, על שרת CPU משלנו.

### Takeaway
אין מוצר שמשלב את ארבעת הרכיבים:
1. עברית כשפה ראשונה, עם RTL תקין.
2. ראיות מהמסך (שקופיות, גרפים, קוד) ששזורות בתוך הניתוח עצמו, ולא כתוסף בבטא או בצ'אט.
3. עיגון מדויק ברמת מילה שאפשר לאמת.
4. סינתזה אנליטית עמוקה — עקרונות, תמונה גדולה, ביקורת — מעבר ל"נקודות מפתח".

כל רכיב קיים בנפרד, באיכות חלקית, אצל מוצר אחר: ראייה אצל BibiGPT ו־Readray, תבניות ניתוח אצל Readray, למידה אצל Recall, ו־LMS אצל HoverNotes. אף אחד מהם לא מציע עברית מאומתת. זה המרחב הלבן. האיום העיקרי עליו הוא Ask בדף הצפייה של YouTube, שכבר תומך בעברית בסרטונים נבחרים.

### Cited Findings
**1. עברית — לוקליזציה של ממשק, לא ניתוח בעברית**
- עברית מופיעה ברשימת שפות הממשק ב־CWS של Eightify, ‏NoteGPT, ‏Sider, ‏Monica, ‏Merlin, ‏Glarity ו־HoverNotes — [Eightify](https://chromewebstore.google.com/detail/eightify-ai-youtube-summa/cdcpabkolgalpgeingbdcebojebfelgb); [NoteGPT](https://chromewebstore.google.com/detail/notegpt-youtube-web-summa/baecjmoceaobpnffgnlkloccenkoibbb); [Sider](https://chromewebstore.google.com/detail/difoiogjjojoaoomphldepapgpbgkhkb); [Monica](https://chromewebstore.google.com/detail/ofpnmcalabcbjgholdjcjblkibolbppb); [Merlin](https://chromewebstore.google.com/detail/merlin-ask-ai-to-research/camppjleccjaphfdbohjdohecfnoikec); [Glarity](https://chromewebstore.google.com/detail/glarity-chatgpt-summary-t/cmnlolelipjlhfkhpohphpedmkfbobjc); [HoverNotes](https://chromewebstore.google.com/detail/obsidian-ai-video-notes-s/fhdmbhgpabjkadpaafomaabbdckofphm).
- ל־HARPA ול־Mapify אין עברית בכלל — [HARPA](https://chromewebstore.google.com/detail/eanggfilgoajaocelnaflolkadkeghjp); [Mapify](https://chromewebstore.google.com/detail/mapify-ai-summarizer-mind/fldgacclkckcmflokaialbihppmndpbd). הרישומים של Glasp ו־Recall באנגלית בלבד — [Glasp](https://chromewebstore.google.com/detail/youtube-summary-with-chat/nmmicjeknamkfloonkhhcjmomieiodli); [Recall](https://chromewebstore.google.com/detail/recall-summarizer-youtube/ldbooahljamnocpaahaidnmlgfklbben?hl=en).
- תמלול עברית: Video Highlight מדרג אותה ב־"Good accuracy", הרמה השלישית מתוך שלוש, ובעבר דירג אותה "Low Accuracy" — [Video Highlight transcripts](https://videohighlight.com/features/transcripts); [Video Highlight updates](https://videohighlight.com/updates).
- ‏OCR: עברית לא נמצאת בין שש שפות ה־OCR של BibiGPT — [BibiGPT v4.318.0](https://bibigpt.co/blog/posts/20260407-bibigpt-v4318-ppt-ocr-local-privacy-en).
- עברית בפלט מוצהרת רק אצל Notta (ברשימת שפות הפלט) — [Notta](https://www.notta.ai/en/tools/youtube-video-summarizer) — ואצל Ask בדף הצפייה, בסרטונים נבחרים בלבד — [YouTube Help](https://support.google.com/youtube/answer/14110396).

**2. ראייה — נדירה, חלקית או נעולה**
- רוב השוק מסתמך על תמליל בלבד:
  - Glasp תלוי בכתוביות — [Toolworthy](https://www.toolworthy.ai/en/blog/best-ai-video-summarizer).
  - ב־NoteGPT צילום המסך ידני — [NoteGPT blog](https://notegpt.io/blog/how-to-take-screenshots-and-take-notes-on-youtube-videos).
  - Recall: ‏OCR "only on images and not on videos as yet" — [Recall changelog](https://feedback.recall.it/changelog).
  - אף אחד מחמשת המובילים שנסקרו במאמר של Memories.ai לא מנתח פריימים — [Memories.ai](https://memories.ai/blogs/best-5-ai-youtube-video-summarizer-tools-in-2026).
- גם מי שמציע ראייה עושה זאת בחלקיות:
  - BibiGPT — ב־Beta וב־Pro — [BibiGPT docs](https://docs.bibigpt.co/en/function-usage/platform-function/visual-analysis-online-video.md).
  - ScreenApp — פריימים רק כשהמשתמש שואל, ו־"narration-free slides" מוצגות כחולשה — [ScreenApp](https://screenapp.io/features/ai-summarizer).
  - Video Highlight — צילומי רגעים בלי מנגנון מוסבר — [Video Highlight](https://videohighlight.com/).
- בסרטון של דובר מול מצלמה החילוץ מחזיר מעט פריימים — [BibiGPT docs](https://docs.bibigpt.co/en/function-usage/platform-function/ppt-keyframe-extraction.md). לכן ניתוח חזותי צריך להיות מותנה בסוג הסרטון.

**3. עיגון בזמן — ברמת מקטע, שורה או סצנה**
- "SRT timestamps come from the transcript segments themselves" — [Video Highlight updates](https://videohighlight.com/updates).
- "Every line is time-stamped" — [Recall](https://www.recall.it/youtube-video-summarizer).
- זמני התחלה וסוף לכל סצנה — [BibiGPT](https://bibigpt.co/en/features/youtube-slide-extractor).
- הצ'אט של Readray מחזיר מספר משפט ולא זמן — [בלוג Lilys](https://lilys.ai/blog/en/free-youtube-summarizer-for-long-videos-2026/).

**4. עומק — פורמטים של "נקודות מפתח" עם תוספות בודדות**
- Eightify: ‏8 רעיונות, ומיקוד "insightful, actionable, controversial, funny" — [CWS](https://chromewebstore.google.com/detail/eightify-ai-youtube-summa/cdcpabkolgalpgeingbdcebojebfelgb).
- Readray: "evidence confidence score" בדוחות השקעות — [Readray](https://readray.ai/en).
- Shortform: "background context and counter-arguments" — [CWS Shortform](https://chromewebstore.google.com/detail/shortform-summary-of-web/anfegbjckcheemfbibglojdmjadgiepe).
- Summify: ‏11 סגנונות ו־Deep Dive — [Summify](https://summify.io/).
- Summario: המלצה אם הסרטון שווה צפייה — [CWS Summario](https://chromewebstore.google.com/detail/summario-ai-youtube-summa/omjcmicfodhllalfjnkpcblodloljpmi).
- HARPA מחלק תמליל ארוך לחלקים "בלי זיכרון" ביניהם — [HARPA](https://harpa.ai/).
- סרטון של 2:25 שעות הפך ל־28 סעיפים — [בלוג Lilys](https://lilys.ai/blog/en/free-youtube-summarizer-for-long-videos-2026/).

**5. הרצאות ארוכות, קורסים ומקורות סגורים**
- מגבלות אורך:
  - Recall: עד 5 שעות בלי כתוביות — [Recall docs](https://docs.recall.it/use-cases/content-type/youtube).
  - NoteGPT: ‏120–210 דקות בלי כתוביות — [NoteGPT Pricing](https://notegpt.io/pricing).
  - ScreenApp: ‏45 דקות בחינם, 2–3 שעות בתשלום — [ScreenApp](https://screenapp.io/features/ai-summarizer).
  - Summario: פחות מ־30 דקות בחינם — [CWS Summario](https://chromewebstore.google.com/detail/summario-ai-youtube-summa/omjcmicfodhllalfjnkpcblodloljpmi).
- עבודה על פני כמה סרטונים: ספרייה וגרף ב־Recall — [Recall](https://www.recall.it/); צ'אט וחיפוש ב־Video Highlight — [Video Highlight](https://videohighlight.com/); צ'אט על תיקייה ב־Readray — [App Store](https://apps.apple.com/us/app/readray-formerly-lilysai/id6759151868); ‏pods ב־Summify — [Summify](https://summify.io/); אצווה של 20 ב־NoteGPT — [NoteGPT](https://notegpt.io/youtube-video-summarizer).
- מקורות סגורים:
  - HoverNotes עובד בתוך Canvas, ‏Moodle, ‏Panopto ו־Kaltura — [HoverNotes](https://hovernotes.io/).
  - Recall ו־BibiGPT לא תומכים בסרטונים פרטיים — [Recall docs](https://docs.recall.it/use-cases/content-type/youtube); [BibiGPT](https://bibigpt.co/en/features/youtube-slide-extractor).
  - לפי HoverNotes, ‏Gemini Notebook לא מכניס קורסים שמאחורי התחברות — [בלוג HoverNotes](https://hovernotes.io/en/blog/add-any-video-to-notebooklm-with-hovernotes).

**6. לולאת הלמידה**
- חידון לפי זמן וחזרה מרווחת ב־Recall — [Recall](https://www.recall.it/).
- ייצוא הדגשות ל־Anki ב־Glasp — [Glasp newsletter](https://read.glasp.co/p/the-highlights-by-glasp-july-2026).
- שאלות תרגול ב־Monica — [Monica](https://monica.im/en/products/ai-video-summarizer).
- מדריכי לימוד וכרטיסיות ב־TwinMind — [CWS TwinMind](https://chromewebstore.google.com/detail/twinmind-summarize-tabs-a/agpbjhhcmoanaljagpoheldgjhclepdj?hl=en).
- ה־playbook של Readray, עם צילום וזמן לכל שלב, הוא הקרוב ביותר ליחידת ידע שמעוגנת לרגע ולפריים — [Readray](https://readray.ai/en).

**7. אמינות החילוץ** — חסימות IP בענן, ‏PO tokens ותוספים שנשברים (ראו שאלה 3, מגמה 4) — [youtube-transcript-api](https://github.com/jdepoix/youtube-transcript-api); [yt-dlp PO Token Guide](https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide).

**8. פרטיות ואמון**
- HoverNotes עשוי לאמן מודלים על האודיו ועל צילומי המסך — [CWS](https://chromewebstore.google.com/detail/obsidian-ai-video-notes-s/fhdmbhgpabjkadpaafomaabbdckofphm).
- Recall ו־ScreenApp מצהירים שאינם מאמנים — [CWS Recall](https://chromewebstore.google.com/detail/recall-summarizer-youtube/ldbooahljamnocpaahaidnmlgfklbben?hl=en); [ScreenApp Video OCR](https://screenapp.io/features/video-ocr).
- Monica מצהירה על איסוף מידע פיננסי ותקשורת אישית — [CWS](https://chromewebstore.google.com/detail/ofpnmcalabcbjgholdjcjblkibolbppb).
- Ask של YouTube שומר שיחות שנבדקו בידי אדם עד 3 שנים — [YouTube Help](https://support.google.com/youtube/answer/14110396).

**9. חיוב** — פערי Trustpilot ותוכניות "Unlimited" עם תקרות (ראו שאלה 3, מגמה 5).

### Inferences — ההזדמנויות (מנוסחות באופן כללי, לפי עקרונות הבנייה הנקייה)
1. **עברית תחילה, מקצה לקצה — הבידול הכי ברור.** לא רק ממשק, אלא:
   - תמלול עברי שהדיוק שלו מדווח בגלוי;
   - ‏OCR לשקופיות בעברית ובטקסט מעורב (עברית עם קוד, נוסחאות ומונחים באנגלית);
   - פלט ב־RTL תקין, כולל ציטוטים, מספרים וקוד בתוך טקסט עברי.

   בעמודים שנקראו לא נמצא מוצר שמתעד טיפול באחד מהשלושה. זו עדות מהיעדר, ולא בדיקה בפועל.
2. **ראיות מהמסך כחלק מכל טענה, לא כמוצר נפרד.** כל נקודה בניתוח תוצג עם השקופית, הגרף או הקוד שתומכים בה, ועם הטקסט שחולץ מהם. ההנחיות לביצוע:
   - בחירת פריימים לפי שינוי חזותי ולא במרווח קבוע. זו גישה מתועדת בשוק ובקוד פתוח: BibiGPT, ‏lecture2notes ו־steipete/summarize.
   - ניתוח חזותי מותנה בסוג הסרטון, כדי לא לשלם על פריימים של דובר מול מצלמה.
   - חילוץ הפריימים וה־OCR ירוצו על שרת ה־CPU. רק פריימים נבחרים יעברו למודל ראייה של Claude. העלות והמימוש — `03-slides-ocr-visual.md` ו־`08-claude-pipeline-cost.md`.
3. **עיגון ברמת מילה, עם אימות.** לכל טענה יוצמד הציטוט שנאמר, וזמן ההתחלה של המילה הראשונה בציטוט. בדיקה אוטומטית תוודא שהציטוט אכן מופיע בתמליל, וטענות שאינן מעוגנות יסומנו. אף מתחרה לא מצהיר על רמה כזו.
   - יש בסיס פנימי: תזמון ברמת מילה בעברית קיים בשרשרת הקריוקי (ivrit + stable-ts + CTC) — `00-internal-infrastructure.md`, שורה 115.
   - "הרצאה עברית של שעה — לא נמדדה" — זו המשימה הטכנית הראשונה לבדוק.
4. **סינתזה בשכבות, מעבר ל"נקודות מפתח".** השכבות: תקציר; מבנה ההרצאה; עקרונות; תמונה גדולה; ביקורת (הנחות סמויות, חולשות בטיעון, מה חסר); שאלות פתוחות. מעליהן — תבניות לפי סוג התוכן: הרצאה אקדמית, וובינר מכירתי, הדרכה טכנית, שיחה על השקעות. הראיות בשוק: Readray מראה שתבניות לפי סוג נותנות ערך, ו־Shortform מראה שיש ביקוש לטיעוני נגד. אבל אף מוצר לא מציע את כל השכבות יחד. הפירוט — `09-analysis-methodology.md`.
5. **הרצאות ארוכות וקורסים שלמים.**
   - בלי תקרה נמוכה של אורך.
   - סינתזה ברמת הקורס, על פני פלייליסט: מושגים חוזרים, תלויות בין שיעורים, סתירות, ומפת הקורס.
   - הכלים הקיימים מסתפקים בצ'אט ובחיפוש על פני ספרייה, בלי מבנה ברמת הקורס.
6. **חילוץ בצד השרת — יתרון עם הסתייגות.** הוא מנטרל את שבירוּת התוספים: תמלול משלנו, בלי תלות בכתוביות ובפריסת הדף. אבל שרת בדאטה־סנטר חשוף לאותן חסימות IP ול־PO tokens. לכן גם העלאת קובץ ו־Drive צריכות להיות ערוצים שווים. ההיבט המשפטי — `07-ingestion-legal.md`.
7. **גשר ללמידה ב־Academy.** כרטיסיות וחידונים שכל אחד מהם מעוגן לרגע ולפריים, וחזרה מרווחת. ההדגשות של Glasp ל־Anki והחידונים של Recall מוכיחים ביקוש. העיגון לפריים לא נמצא אצל אף מוצר.
8. **פרטיות כמסר מוצרי.** מודלי Claude בלבד, בלי אימון על התוכן, השרת שלנו, ומדיניות שמירה שקופה. זה מנוגד לסעיף האימון אצל HoverNotes ולשמירה של 3 שנים אצל Ask.
9. **מחיר שקוף.** עלות לכל דקה או לכל ניתוח, שמוצגת מראש, בלי "Unlimited" עם תקרה נסתרת, והסבר מה צרך מכסה. זה עונה ישירות על התלונה החוזרת ב־Trustpilot.
10. **מה לא לבנות כבידול:** צ'אט, מפת חשיבה וייצוא ל־MD/PDF/Notion. הם נדרשים כבסיס, אבל אינם יתרון. גם התחרות מול Ask של YouTube על שאלות בסיסיות היא קרב אבוד. ההבדל צריך להיות בעומק, בראיות, בעיגון ובעברית.
11. **איומים למעקב:**
    - Ask עם עברית עשוי להתרחב לכל הסרטונים.
    - ‏BibiGPT עשוי להוסיף עברית ל־OCR.
    - Readray מעמיק בתבניות ניתוח.
    - הסרגלים הגדולים עשויים להוסיף ראייה במהירות דרך מודלי ראייה כלליים.

### Gaps
- כל טענות ה"אין עברית" או "אין RTL" נשענות על היעדר בעמודים שנקראו. לא נעשתה בדיקה בפועל בעברית באף מוצר. מומלץ לבצע מבחן ידני על 3–5 הרצאות בעברית בכלים המובילים לפני קביעה סופית.
- אין נתונים על נכונות לשלם או על שימוש בכלים כאלה בשוק הישראלי. ייתכן ש־`14-competitors-repurpose-hebrew-census.md` מכסה זאת (לפי שם הקובץ).
- דיוק חותמות הזמן אצל המתחרים לא נמדד, ולכן היתרון של עיגון ברמת מילה הוא טענה שצריך להוכיח מול מדד (`18-golden-set-evaluation.md`).

---

## שאלה 5: הזנב הארוך — עוד 40 כלים, שורה לכל אחד

### Takeaway
הזנב הארוך גדול ופעיל: עשרות תוספים קטנים, עם עשרות עד אלפי משתמשים, ומוצרי Product Hunt חדשים בכל חודש. רובם עוטפים תמליל ומודל שפה, ונבדלים רק במודל המחיר (חד־פעמי, ‏BYOK, חינם) או בגימיק (תצוגה לפני צפייה, סנטימנט תגובות). הראייה מופיעה בשוליים: ‏Summd, ‏YouMind (צילומים ידניים) ושלושה פרויקטים בקוד פתוח.

### Cited Findings
**תוספי דפדפן (רישומי CWS, נבדקו 9/11/2026)**
1. **Summario** — ‏10K משתמשים, ‏4.9 מ־138, עודכן 30/9/2026. סקירה, נקודות מפתח, המלצה אם שווה לצפות, מקטעים עם זמן, צ'אט, וסנטימנט של התגובות. 70+ שפות פלט, ותמלול כשאין כתוביות. בחינם: סיכום מלא אחד, 3 מהירים והודעת צ'אט אחת ביום, לסרטונים של פחות מ־30 דקות. ‏Pro מוסיף ייצוא ל־Notion, ‏Obsidian, ‏PDF ו־MD — [CWS](https://chromewebstore.google.com/detail/summario-ai-youtube-summa/omjcmicfodhllalfjnkpcblodloljpmi).
2. **Clarify AI** — ‏20K, ‏4.1 מ־1.3K, עודכן 7/11/2026. סיכומים עם זמנים, כלי תמליל, סיכום תגובות, עוזר צ'אט, תבניות פרומפט, ותרגום ל־50+ שפות — [CWS](https://chromewebstore.google.com/detail/clarify-ai-youtube-summar/ogihgbocgnbhhdcmcolhipjhkmkecpeg).
3. **Recapio** (AM2 Studio d.o.o.) — ‏3K, ‏4.9 מ־14, עודכן 29/9/2025. זמנים לחיצים, צ'אט שמפנה לזמנים, ומאגר ידע אישי ("AI Brain") — [CWS](https://chromewebstore.google.com/detail/recapio-ai-youtube-summar/eeeahhaanadpgonocbinjbhbohcknfcd).
4. **Youtube Summary with AI** (ytuong.ai) — כ־2K, ‏4.8. פאנל צד ששולח לפלטפורמת AI שהמשתמש בוחר. מצהיר שתוכן הסרטון לא נשמר אצלו — [CWS](https://chromewebstore.google.com/detail/youtube-summary-with-ai/gcglcbfmophnppdlbhckfmfiofaajibm).
5. **summarizer.tube** — ‏261 משתמשים. נקודות שקופצות לשנייה שבה נאמרו; 5 סיכומים ביום בלי חשבון; 12 שפות פלט — [CWS](https://chromewebstore.google.com/detail/youtube-summarizer-%E2%80%94-ai-v/ebjlbpimmbdenfieofpgejmdgdipgejp).
6. **Snippy Summary** — ‏75 משתמשים. ‏Gemini עם מפתח של המשתמש, זמנים, ייצוא ל־Obsidian, חינם — [CWS](https://chromewebstore.google.com/detail/snippy-summary-ai-youtube/hcpmildnbjiigmeafaoalidinmjjnjpn).
7. **YouMind** (MIND MOTOR PTE. LTD.) — ‏40K, ‏4.9, עודכן 6/11/2026 (גרסת alpha). הערות עם זמנים וצילומי מסך בזמן הצפייה, מפות חשיבה וצ'אט, ובחירה בין ChatGPT, ‏Claude ו־Gemini — [CWS](https://chromewebstore.google.com/detail/youmind-ai-web-clipper-yo/cnnenlbocdcjnmpkkbbdgjfejinfffjc).
8. **Shortform** (Shortform Inc.) — ‏10K, ‏4.0 מ־26, עודכן 1/4/2026. סיכום שמוסיף "background context and counter-arguments"; זמנים לא מוזכרים — [CWS](https://chromewebstore.google.com/detail/shortform-summary-of-web/anfegbjckcheemfbibglojdmjadgiepe).
9. **TubeNotes** — ‏11 משתמשים. מסמכי "FullNotes" ב־PDF; הינדי, אנגלית ו־40 שפות נוספות — [CWS](https://chromewebstore.google.com/detail/tubenotes-youtube-summari/ggbjobencknmnkfkbdcfijgddepcapgn).
10. **TwinMind** (ThirdEar AI, Inc.) — ‏20K, ‏5.0 מ־250. מדריכי לימוד וכרטיסיות מהערות, ‏PDF וסרטונים; מנתב שאילתות למודלים של OpenAI, ‏Anthropic, ‏Perplexity ו־Google — [CWS](https://chromewebstore.google.com/detail/twinmind-summarize-tabs-a/agpbjhhcmoanaljagpoheldgjhclepdj?hl=en).
11. **MaxAI** — כ־700K, ‏4.6 מ־14.5K. סרגל AI כללי; YouTube מופיע כאתר נתמך, בלי תכונות וידאו מתועדות — [CWS](https://chromewebstore.google.com/detail/mhnlakgilnojmhinhkckjpncpbhabphi).
12. **YouTube Summary with Gemini AI – 1-Click** — ‏135 משתמשים. שולח ל־Gemini רק את הכותרת, הערוץ והקישור, בפרומפט שמבקש 8–12 נקודות; חינם — [CWS](https://chromewebstore.google.com/detail/youtube-summary-with-gemi/dafkeibjaghajkpkdjmoniifpgmbemcg).
13. **swiftnotes.ai** — ‏104 משתמשים, עודכן 14/10/2025. "AI powered notes for YouTube videos"; מעט פרטים — [CWS](https://chromewebstore.google.com/detail/swiftnotesai/hloapbehgdcfibkpelhnnejpibcaofge?hl=en-US).
14. **YouTube Transcript & AI Summary** (Oleksandr Senyk) — ‏61 משתמשים. כל נקודה וכל שורה לחיצות; ייצוא ל־Notion ו־Docs, וכ־PDF, ‏DOCX, ‏MD ו־TXT; סנטימנט תגובות; 60+ שפות — [CWS](https://chromewebstore.google.com/detail/ai-summary-youtube-summar/mbmmcpjfaaikmlgfocdcahghnjboiple).
15. **Summd** — ‏259 משתמשים, ‏4.8 מ־9, עודכן 3/8/2026. סיכום אוטומטי כשהסרטון נפתח, זמנים לחיצים, ו־"frame analysis" לשאלות על המסך; 17 שפות תמליל; 15 הודעות חינם בחודש — [CWS](https://chromewebstore.google.com/detail/youtube-ai-chat-summary/cjhickmaokeejgncknjhgiebnloakppe).
16. **YouTube Quick AI Summary** — ‏19 משתמשים. תצוגת סיכום בריחוף על תמונה ממוזערת, לפני הצפייה, באמצעות ה־Gemini המובנה של YouTube — [CWS](https://chromewebstore.google.com/detail/gflljmlmelkidjlkclhghngmioppkkcd).
17. **summarizemyvideo** — ‏1,000 משתמשים, ‏4.2. מפתח API של המשתמש (OpenAI, ‏Gemini או Claude) ותשלום חד־פעמי; ‏YouTube בלבד — [CWS](https://chromewebstore.google.com/detail/youtube-summary-transcrip/fedjdpgghmpimikoihnhlofjeomlabeb).

**Product Hunt**
18. **YTSummarizer** — גרסה 2.0 ב־20/4/2026 ("No subscription"), והמקורית ב־15/9/2025. סיכום אחד חינם ביום; חבילות של $9 ל־30, ‏$19 ל־200 ו־$49 ל־1,000 — [Product Hunt](https://www.producthunt.com/products/ytsummarizer/launches).
19. **DeepTube** — הושק 5/1/2026; "read-only summary"; קוד פתוח ב־GitHub — [Product Hunt](https://www.producthunt.com/products/deeptube/launches).
20. **ytskim** — הושק 1/6/2026; חינם; תמליל, סיכום וייצוא ל־PDF או TXT — [Product Hunt](https://www.producthunt.com/products/ytskim/launches).
21. **PeekaTube** — הושק 9/8/2025; סיכום לפני הלחיצה, בדף הבית, בחיפוש ובדפי ערוצים — [Product Hunt](https://www.producthunt.com/products/peekatube/launches).
22. **Tube Insights** — הושק 28/1/2026; תמלול, סיכומים ומעקב אחרי ערוצים, בתמחור לפי קרדיטים — [Product Hunt](https://www.producthunt.com/products/tubeinsights/launches).
23. **InsightTube** — הושק 27/11/2025 (מקום 4 ביום) ושוב ב־22/1/2026; סיכומים, פרקים, כתוביות רב־לשוניות וצ'אט — [Product Hunt](https://www.producthunt.com/products/insighttube/launches).

**דפים רשמיים**
24. **YouTLDR** — פעיל "since 2019". סיכומים ו־"quotables" עם זמנים, תמליל עם סמן שעוקב אחרי הנגן, וסמנים על פס ההתקדמות. ‏Pro ‏$12 לחודש; 10,000+ משתמשים — [YouTLDR](https://you-tldr.com/).
25. **Decopy** — ‏YouTube בלבד: סיכום, מפה, FAQ, מקטעים עם זמן, וחיפוש רשת אופציונלי; ייצוא TXT או PDF. בלי כתוביות — עד 240 דקות בקרדיטים; הקלט "not stored" — [Decopy](https://decopy.ai/youtube-video-summarizer/). מאמר של ספק מתאר אותו כ־"100% free" עם עד 50 סיכומים ביום — [Memories.ai](https://memories.ai/blogs/best-5-ai-youtube-video-summarizer-tools-in-2026).
26. **TubeOnAI** — קלט מ־YouTube, ‏Dailymotion, ‏Bilibili, ‏Twitch, ‏SoundCloud, ‏PDF ו־Drive. 150+ תבניות repurposing וסיכומי אודיו; ‏iOS, ‏Android, ‏Chrome וווב. ‏Starter חינם (400 קרדיטים); Pro ‏$19 לחודש; טוען ל־"150k+ users" — [TubeOnAI](https://tubeonai.com/).
27. **Snipd** — אפליקציית פודקאסטים שגם "Import YouTube Videos". ‏snips עם אודיו, תמליל וסיכום; פרקים; ייצוא ל־Notion, ‏Readwise, ‏Obsidian, ‏Glasp, ‏Bear, ‏Logseq ו־MD; ‏26 שפות — [Snipd](https://www.snipd.com/).
28. **Otio** — סביבת מחקר עם סיכום YouTube; "every answer cited"; צ'אט על פני כמה מקורות — [Otio](https://otio.ai/).
29. **Brisk** — כלי למורים: "1 in 3 Teachers in the USA use Brisk". העמוד מזכיר "videos", אבל לא מאשר סיכום YouTube במפורש — [Brisk](https://www.briskteaching.com/).
30. **Memories.ai** — לפי מאמר של הספק (3/1/2026): בחינם 100 קרדיטים בחודש; Plus מ־$15 לחודש בחיוב שנתי; זמנים ופרקים; ייצוא ל־Notion ול־MD — [Memories.ai](https://memories.ai/blogs/best-5-ai-youtube-video-summarizer-tools-in-2026).

**קוד פתוח ותשתיות**
31. **Fabric** — `-y` שולף תמליל, תגובות ומטא־נתונים; `--visual` ‏("OCR and FFmpeg frame extraction"); תבנית `extract_wisdom`; ‏MIT; ‏44.6k כוכבים; ‏v1.4.447 מ־16/4/2026 — [GitHub](https://github.com/danielmiessler/Fabric).
32. **steipete/summarize** — ‏CLI ב־Node.js, ‏Chrome Side Panel ו־Firefox Sidebar. משתמש קודם בכתוביות שפורסמו, ואם אין — בתמלול; פריימים לפי סצנה עם OCR אופציונלי ופלט עם זמנים; ‏MIT; ‏6.8k כוכבים — [GitHub](https://github.com/steipete/summarize).
33. **lecture2notes** — סיווג שקופיות ברשת CNN, חיתוך והסרת כפילויות באשכולות, ‏OCR עם ניתוח מבנה השקופית, חילוץ איורים, תמלול, וסיכום משולב; ‏AGPL; ‏67 כוכבים — [GitHub](https://github.com/HHousen/lecture2notes).
34. **youtube-transcript-api** — ספריית שליפת תמליל (8.6k כוכבים), עם אזהרה מפורשת על חסימת כתובות IP של ספקי ענן — [GitHub](https://github.com/jdepoix/youtube-transcript-api).

**AI מובנה בדפדפן** (העמודים הרשמיים לא מזכירים סיכום YouTube במפורש)
35. **Gemini in Chrome** — [Gemini](https://gemini.google/overview/gemini-in-chrome/).
36. **Comet** — [Perplexity](https://www.perplexity.ai/comet).
37. **Brave Leo** — [Brave](https://brave.com/leo/).

**לפי 06 (לא נבדקו מחדש כאן; ייתכן שהקבצים המקבילים מכסים אותם — 11 עד 14, לפי שמותיהם)**
38. **כלי לימוד:** Knowt, ‏Turbo AI, ‏StudyFetch, ‏Coconote, ‏Gizmo, ‏RemNote, ‏Algor, ‏Readwise — [06](06-market-features-ux.md); ראו גם `12-competitors-study-tools.md`.
39. **פגישות:** Otter, ‏Fireflies, ‏Fathom, ‏tl;dv, ‏Read.ai, ‏Granola — [06](06-market-features-ux.md); ראו גם `13-competitors-meetings-enterprise.md`.
40. **וידאו ארגוני, LMS ותשתיות:** Panopto, ‏Kaltura, ‏YuJa, ‏Echo360, ‏Verbit, ‏Stream, ‏Twelve Labs, ‏Azure Video Indexer, ‏Loom, ‏Descript, ‏Happy Scribe — [06](06-market-features-ux.md); ראו גם `11-competitors-notebooks-platforms.md` ו־`13-competitors-meetings-enterprise.md`.

### Inferences
- הזנב הארוך מוכיח שעטיפה דקה (תמליל ומודל) היא מוצר שכל מפתח בונה בסוף שבוע. אין בה חפיר. מה שמבדיל, גם כאן, הוא אחד משלושה דברים: מודל המחיר, ערוץ ההפצה (Product Hunt או CWS), או יכולת חזותית.
- שלושה פרויקטים בקוד פתוח (Fabric, ‏steipete/summarize, ‏lecture2notes) כבר מממשים פריימים, OCR וסיכום משולב. רף הכניסה לראייה בסיסית ירד. היתרון יגיע מאיכות השילוב, מהעברית ומהעיגון, ולא מעצם היכולת לחלץ פריים.
- רוב הכלים בזנב לא מזכירים שפות מימין לשמאל או עברית בפלט. כמה מהם מציגים רק תרגום ממשק.

### Gaps
- **מוזכרים רק בתקצירי חיפוש, בלי עמוד שנקרא:**
  - Video2PPT ו־FrameRipper — מחלצי שקופיות.
  - Transcription.video (Product Hunt, ‏10/2/2026) — [Product Hunt (תקציר חיפוש)](https://www.producthunt.com/products/transcription-video/launches).
  - "YouTube Summarizer" (Product Hunt, ‏20/1/2026) — [Product Hunt (תקציר חיפוש)](https://www.producthunt.com/products/youtube-summarizer-5/launches).
  - Dictanote — [Dictanote (תקציר חיפוש)](https://dictanote.co/youtube-summary).
- **רישומי CWS שלא נטענו:** CyFrog, ‏Relic ו־AI Video Recap.
- **הושמטו:** Kagi Summarizer (דורש התחברות). ‏Otio — מספר המשתמשים לא אומת בקריאה.
- הזנב הארוך אינו ממצה. בגלל תקציב החיפוש שנגמר, לא נסרקו קטגוריות CWS נוספות, ולא נסרקו כלים בשווקים אחרים (סין, קוריאה, יפן), חוץ מ־BibiGPT ו־Readray.
