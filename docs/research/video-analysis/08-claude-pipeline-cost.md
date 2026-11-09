# צינור ניתוח הרצאות סביב Claude: מודל עלות ואיכות לשעת וידאו, השוואה ל־Gemini ועיגון לחותמות זמן (נכון ל־9 בנובמבר 2026)

> כל המחירים ב־USD למיליון טוקנים (MTok), כפי שהופיעו בדפים הרשמיים ב־9/11/2026, אלא אם צוין אחרת. חישובים שלי מסומנים כהסקה ומוצגים עם החשבון. מה שלא נמצא לו מקור עבר ל־Gaps. תקציב החיפוש ברשת (WebSearch) של הסבב נגמר באמצע העבודה, ולכן חלק מההשלמות נעשו רק דרך שליפה ישירה של דפים רשמיים ידועים.

## 1. אילו מודלים של Claude זמינים, כמה הם עולים, ומה המגבלות שלהם (הקשר, פלט, קצב)?

### Takeaway — השורה התחתונה
יש ארבעה מודלים נוכחיים, ולכולם חלון הקשר של 1M ופלט של 128K: Fable 5.1 ‏($10/$50), Opus 5.5 ‏($4/$20), Sonnet 5.5 ‏($2/$10) ו־Haiku 5.5 ‏($0.10/$0.50 עד 100K טוקני פרומפט, ופי 5 מעליהם). Batch מוריד 50% מכל טוקן, וקריאה מהמטמון עולה 5% ממחיר הקלט ב־Opus/Sonnet 5.5. פלט עולה פי 5 מקלט וטוקני thinking מחויבים כפלט, ולכן בניתוח הרצאה החשבון נקבע בעיקר על ידי אורך הפלט וה־effort, ופחות על ידי גודל התמלול.

### Cited Findings — ממצאים עם מקורות
- מחירים (קלט / כתיבה למטמון ל־5 דקות / כתיבה למטמון לשעה / קריאה מהמטמון / פלט): **Fable 5.1**: ‏$10 / $12.50 / $20 / $0.25 / $50. **Opus 5.5**: ‏$4 / $5 / $8 / $0.20 / $20. **Sonnet 5.5**: ‏$2 / $2.50 / $4 / $0.10 / $10. **Haiku 5.5** (פרומפט עד 100,000 טוקנים): ‏$0.10 / $0.125 / $0.20 / $0.01 / $0.50. **Haiku 5.5** (מעל 100,000): ‏$0.50 / $0.625 / $1 / $0.05 / $2.50. — [Pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- ב־Haiku 5.5 אורך הפרומפט כולל גם קריאות וכתיבות מטמון, וכל בקשה מתומחרת לבדה: בקשה מעל הסף משלמת את המחיר הגבוה גם אם חלק ממנה הגיע מהמטמון. — [Pricing, Long context pricing](https://platform.claude.com/docs/en/about-claude/pricing#long-context-pricing). בדף העלות: "every token of the request costs 5 times as much, output included". — [Optimizing for cost and intelligence](https://platform.claude.com/docs/en/about-claude/models/optimizing-for-cost-and-intelligence)
- מחירי Batch (קלט/פלט): Fable 5.1 ‏$5/$25, Opus 5.5 ‏$2/$10, Sonnet 5.5 ‏$1/$5, Haiku 5.5 ‏$0.05/$0.25 עד 100K ו־$0.25/$1.25 מעליהם. מכפילי המטמון מצטברים יחד עם הנחת ה־Batch ועם תמחור data residency. בחירה ב־`inference_geo` של ארה״ב בלבד מוסיפה מכפיל של 1.1 על כל רכיבי המחיר. — [Pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- חלון של 1M לכל ארבעת המודלים ופלט מרבי של 128K ב־Messages API. ב־Message Batches אפשר להגיע ל־300K טוקני פלט עם `output-300k-2026-03-24` ל־Opus 5.5, Sonnet 5.5 ו־Haiku 5.5 (Fable 5.1 לא ברשימה). — [Models overview](https://platform.claude.com/docs/en/about-claude/models/overview). ‏"A single 300k-token generation can take over an hour to complete". — [Batch processing](https://platform.claude.com/docs/en/build-with-claude/batch-processing)
- בטוקנייזר הנוכחי (מאז Opus 4.7), ‏1M טוקנים ≈ 555K מילים או 2.5M תווי Unicode. במודלים שלפניו נכנסו לאותו חלון כ־750K מילים. — [Models overview](https://platform.claude.com/docs/en/about-claude/models/overview)
- effort ברירת המחדל: Fable 5.1 `high`, Opus 5.5 `medium`, Sonnet 5.5 `high`, Haiku 5.5 `medium`. ה־thinking ב־Fable 5.1 וב־Opus 5.5 הוא "Adaptive (always on)". — [Models overview](https://platform.claude.com/docs/en/about-claude/models/overview)
- "the tokens Claude spends reasoning are billed as output tokens, even when the thinking text isn’t returned to you, and they count toward `max_tokens`". על `display: "omitted"`: ‏"Omitting reduces latency, not cost". — [Thinking](https://platform.claude.com/docs/en/build-with-claude/thinking)
- כיבוי thinking: ‏Opus 5.5 ו־Fable 5.1 מחזירים 400 גם על `disabled` וגם על `between_tools`. ‏Sonnet 5.5 דוחה `disabled` אבל מקבל `between_tools` ‏("Up-front thinking off at `high` effort or below"). ‏Haiku 5.5 מקבל `disabled` ב־effort `high` ומטה. — [Thinking](https://platform.claude.com/docs/en/build-with-claude/thinking)
- מדידות effort של Anthropic: ב־Opus 5.5 על SWE-bench Pro, ‏`low` פתר 87.4% ב־$0.11 למשימה, `medium` פתר 92.8% ב־$0.21, ו־`high` פתר 95.3% ב־$0.29. ב־Sonnet 5.5, ‏`medium` קיבל כ־7 נקודות פחות מ־`high` בכ־59% מהעלות. ב־GPQA Diamond, ‏Haiku 5.5 הגיע ל־85% (מול 91% ל־Opus ול־Sonnet 5.5) בכעשרים מעלות Opus 5.5 ובכעשירית מעלות Sonnet 5.5 לכל תשובה נכונה. — [Optimizing for cost and intelligence](https://platform.claude.com/docs/en/about-claude/models/optimizing-for-cost-and-intelligence)
- באותו דף: "Output tokens cost five times input tokens". בקשה לפורמט תשובה קומפקטי הורידה 39% מטוקני הפלט ו־13% מהעלות, בלי פגיעה באיכות במקרה שנמדד. ההמלצה היא `max_tokens` של 64,000 לעבודה סוכנית, וב־Haiku 5.5 ‏"thinking is on by default and counts toward the cap, so a response can end before any text". — [Optimizing for cost and intelligence](https://platform.claude.com/docs/en/about-claude/models/optimizing-for-cost-and-intelligence)
- Fast mode ל־Opus 5.5 עולה $8/$40 — [Pricing](https://platform.claude.com/docs/en/about-claude/pricing). הוא מוכפל במחיר ומגיע עד "2.5× higher output tokens per second". — [Optimizing for cost and intelligence](https://platform.claude.com/docs/en/about-claude/models/optimizing-for-cost-and-intelligence)
- שימוש בכלים מוסיף פרומפט מערכת: 286 טוקנים ל־Opus 5.5, ל־Sonnet 5.5 ול־Haiku 5.5 (‏`auto`/`none`), ו־406 ל־Haiku 5.5 ב־`any`/`tool`. — [Pricing, Tool use pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- מגבלות קצב ב־Start tier: ‏Opus 5.5, ‏Sonnet 5.5 ו־Haiku 5.5 מקבלים כל אחד 4,000 RPM, ‏2,000,000 ITPM ו־400,000 OTPM. ‏Fable 5.x מקבל 4,000 RPM, ‏500,000 ITPM ו־100,000 OTPM. "Claude’s default ITPM rate limits count only uncached input tokens". ארגונים חדשים עשויים להתחיל ב־Evaluation tier עם מגבלות נמוכות יותר. — [Rate limits](https://platform.claude.com/docs/en/api/rate-limits)
- מועדי פרישה: לא לפני 1/9/2027 ל־Fable 5.1, ‏22/9/2027 ל־Opus 5.5, ‏28/9/2027 ל־Sonnet 5.5 ו־7/10/2027 ל־Haiku 5.5. — [Models overview](https://platform.claude.com/docs/en/about-claude/models/overview)
- טבלת המחירים הקיימת בעובד (`'claude-sonnet-5-5': (2.0, 10.0, 0.10)` וכו׳) תואמת לדף החי. — [translator/llm.py](../../../translator/llm.py)

### Inferences — הסקות
- יחסי מחיר: ‏Sonnet 5.5 יקר פי 20 מ־Haiku 5.5 (מתחת ל־100K), ‏Opus 5.5 יקר פי 2 מ־Sonnet, ו־Fable 5.1 יקר פי 2.5 מ־Opus.
- בתמלול של שעה באנגלית (כ־20K טוקנים) עם פלט של 12K ועוד כ־5K טוקני thinking, הפלט הוא כ־79% מחשבון Sonnet 5.5 בקריאה בודדת (החישוב בסעיף 8). לכן המנופים הראשונים הם אורך הפלט, ה־effort וכיבוי ה־thinking במעברי החילוץ, ולא קיצוץ הקלט.
- ב־Haiku 5.5 כדאי לשמור כל בקשה מתחת ל־100K, כולל מה שמגיע מהמטמון. 60 שקופיות ב־1080p, או תמלול עברי יחד עם 60 שקופיות ב־720p, כבר חוצים את הסף (סעיף 8).
- Fable 5.1 לא מוצדק לסיכום הרצאה: הוא יקר פי 2.5 מ־Opus, מחייב שמירת נתונים ל־30 יום (סעיף 10), ואין לו פלט של 300K ב־Batches.
- מגבלות ה־Start tier גבוהות בסדרי גודל ממה שצוות קטן צריך. הרצאה אחת דורשת 50–200K טוקני קלט לכל ההרצה.

### Gaps — פערים
- אין נתון רשמי על כמה טוקני thinking מייצר כל מודל במשימת סיכום או חילוץ מהרצאה. ההנחה כאן (כ־5K לקריאה) צריכה מדידה מתוך `usage`.
- המגבלות של ה־Evaluation tier אינן מפורסמות.
- מסמך עזר מקומי (ה־claude-api skill שמגיע עם Claude Code) רשם $0.20 לקריאת מטמון ב־Sonnet 5.5, ואילו הדף החי רושם $0.10. הדף החי הוא הקובע.
- לא נמצא נתון רשמי על מהירות הפלט (טוקנים לשנייה) של כל מודל.

## 2. Vision: כמה תמונות, באילו מידות, כמה טוקנים, ומה הרזולוציה המיטבית לשקופיות?

### Takeaway — השורה התחתונה
תמונה עולה ⌈רוחב/28⌉×⌈גובה/28⌉ טוקנים, עד 4,784 טוקנים ו־2,576 פיקסלים בצלע הארוכה במודלי 4.7 ומעלה, כלומר בכל ארבעת המודלים הנוכחיים. שקופית ב־1280×720 עולה 1,196 טוקנים וב־1920×1080 עולה 2,691. שישים שקופיות ב־720p הן כ־72K טוקנים, כ־$0.14 ב־Sonnet 5.5. אפשר עד 600 תמונות בבקשה, אבל מעל 20 תמונות כל תמונה מוגבלת ל־3,000 פיקסלים בכל צד.

### Cited Findings — ממצאים עם מקורות
- "Each patch is a 28×28-pixel block ... An image, therefore, costs `⌈width / 28⌉ × ⌈height / 28⌉` visual tokens". — [Vision](https://platform.claude.com/docs/en/build-with-claude/vision)
- שתי דרגות רזולוציה: High-resolution ל־"Claude 4.7 and later models" (צלע ארוכה עד 2,576 פיקסלים, עד 4,784 טוקנים), ו־Standard לשאר המודלים (1,568 פיקסלים, 1,568 טוקנים). הדרגה הגבוהה אוטומטית ולא דורשת header. — [Vision](https://platform.claude.com/docs/en/build-with-claude/vision)
- דוגמאות מהטבלה הרשמית: 1000×1000 = 1,296 טוקנים. 1920×1080 = 2,691 בדרגה הגבוהה, ו־1,560 בדרגה הרגילה אחרי הקטנה ל־1456×819. ‏3840×2160 מוקטן ל־2576×1449 ועולה 4,784. — [Vision](https://platform.claude.com/docs/en/build-with-claude/vision)
- דוגמת מחיר רשמית: ב־Opus 5.5 ‏($4 למיליון, בדרגה הגבוהה), תמונה של 1000×1000 עולה כ־$5.18 לאלף תמונות, ותמונת 4K עולה כ־$19.14 לאלף. ‏"High-resolution images can use up to roughly three times more visual tokens", ולכן מומלץ להקטין כשלא צריך את הדיוק. — [Vision](https://platform.claude.com/docs/en/build-with-claude/vision)
- מגבלות: עד 600 תמונות בבקשה (100 במודלים עם הקשר של 200K), ומקסימום 8000×8000. מעל 20 תמונות בבקשה נכנסת מגבלה מחמירה: "resize each image so that neither dimension exceeds 3,000 px, or keep the request to 20 or fewer image and document blocks". גם תמונות מתורות קודמות וגם תמונות בתוך `tool_result` נספרות. — [Vision](https://platform.claude.com/docs/en/build-with-claude/vision)
- גודל מרבי לתמונה: 10MB ב־base64. בקשה מוגבלת ל־128MB, ולמספר גדול של תמונות מומלץ Files API. — [Vision](https://platform.claude.com/docs/en/build-with-claude/vision)
- פורמטים נתמכים: JPEG, ‏PNG, ‏GIF ו־WebP. ‏Claude לא קורא metadata של תמונות. — [Vision](https://platform.claude.com/docs/en/build-with-claude/vision)
- סדר ותיוג: "Claude works best when images come before text", ובכמה תמונות כדאי "introduce each one with a short text label (`Image 1:`, `Image 2:`...)". — [Vision](https://platform.claude.com/docs/en/build-with-claude/vision)
- מגבלות דיוק: "Claude might hallucinate or make mistakes when interpreting low-quality, rotated, or very small images under 200 pixels". דחיסת JPEG חזקה עלולה להפוך טקסט לקשה לקריאה. — [Vision](https://platform.claude.com/docs/en/build-with-claude/vision)
- `"oversized_image": "error"` גורם לדחיית תמונה גדולה מדי, במקום הקטנה שקטה שלה. — [Vision](https://platform.claude.com/docs/en/build-with-claude/vision)

### Inferences — הסקות
חישוב טוקנים לגדלים נפוצים של שקופית, לפי הנוסחה:
```
1920×1080: ⌈68.57⌉×⌈38.57⌉ = 69×39 = 2,691   (תואם לטבלה הרשמית)
1600×900 : ⌈57.14⌉×⌈32.14⌉ = 58×33 = 1,914
1344×756 : 48×27 = 1,296   (כפולות של 28, בלי טלאי חלקי)
1280×720 : ⌈45.71⌉×⌈25.71⌉ = 46×26 = 1,196
1024×576 : ⌈36.57⌉×⌈20.57⌉ = 37×21 = 777
960×540  : ⌈34.29⌉×⌈19.29⌉ = 35×20 = 700
896×504  : 32×18 = 576     (כפולות של 28)
800×450  : ⌈28.57⌉×⌈16.07⌉ = 29×17 = 493
```
- עלות 60 שקופיות: ב־720p זה 71,760 טוקנים, כלומר Haiku 5.5 ‏$0.0072, ‏Sonnet 5.5 ‏$0.144, ‏Opus 5.5 ‏$0.287 ו־Fable 5.1 ‏$0.718. ב־1080p זה 161,460 טוקנים: ‏Sonnet ‏$0.323 ו־Opus ‏$0.646. ב־540p זה 42,000 טוקנים: ‏Sonnet ‏$0.084.
- ברירת המחדל המומלצת: קודם להסיר כפילויות לפי החלפת סצנה (בדרך כלל כ־60 שקופיות ייחודיות), ואז לשלוח ב־1280×720 או ב־1344×756. ‏1920×1080, או חיתוך של אזור, רק לשקופיות צפופות (טבלה, קוד, נוסחה), שמזהים לפי צפיפות הטקסט ב־OCR. לא כדאי לרדת מתחת לכ־800 פיקסלים בצלע הארוכה כשיש טקסט קטן.
- כל השקופיות בבקשה אחת (יותר מ־20) מחייבות שכל תמונה תהיה עד 3,000 פיקסלים, וזה לא מגביל שקופיות ב־1080p.
- התמונות באות לפני התמלול וההוראות, כל אחת עם תווית קבועה (`Slide 17 [23:10–25:40]:`). התווית משמשת גם כעוגן זמן בתשובה.

### Gaps — פערים
- אין מדד רשמי לדיוק קריאת שקופיות כפונקציה של הרזולוציה, ובעברית בכלל לא. צריך eval פנימי (כ־30 שקופיות אמיתיות, בעברית ובאנגלית, בשלושה גדלים).
- לא נבדקה השפעת ה־padding והשינוי בגודל (דף vision-coordinates) על שקופיות שאינן 16:9.

## 3. PDF, ‏Files API ומטמון לתמונות ולמסמכים: כדאי לארוז את השקופיות ל־PDF?

### Takeaway — השורה התחתונה
PDF מעובד כתמונה של כל עמוד ועוד הטקסט שחולץ ממנו, כך שמשלמים על שניהם. הוא נותן citations ברמת עמוד, אבל לא citations לתמונות. כשאין דק מקורי, תמונות במידה שאנחנו קובעים ועוד טקסט OCR בבלוקים של `search_result` נותנים שליטה מלאה בעלות ו־citations ברמת קטע. ‏Files API חוסך בגודל הבקשה ולא בטוקנים, והוא לא מכוסה ב־ZDR.

### Cited Findings — ממצאים עם מקורות
- "The system converts each page of the document into an image. The text from each page is extracted and provided alongside each page’s image." — [PDF support](https://platform.claude.com/docs/en/build-with-claude/pdf-support)
- עלות: "Each page typically uses 1,500–3,000 tokens depending on content density", ובנוסף טוקני תמונה לפי נוסחת ה־vision. — [PDF support](https://platform.claude.com/docs/en/build-with-claude/pdf-support)
- מגבלות: עד 600 עמודים (100 כשחלון ההקשר קטן מ־1M), ‏128MB, ו־PDF רגיל בלי סיסמה. ‏PDF צפוף עלול למלא את ההקשר לפני מגבלת העמודים, ומומלץ להקטין תמונות מוטמעות. — [PDF support](https://platform.claude.com/docs/en/build-with-claude/pdf-support)
- ב־PDF ה־citations מחזירים טווח עמודים, ו־"Citing images from PDFs is not currently supported". — [Citations](https://platform.claude.com/docs/en/build-with-claude/citations)
- אפשר לשמור במטמון "Images and documents: Content blocks in the `messages.content` array, in user turns". יש עד 4 נקודות עצירה למטמון, וחלון ה־lookback הוא 20 בלוקים. — [Prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
- מה פוסל את המטמון: הוספה או הסרה של תמונות שומרת את מטמון ה־tools וה־system ופוסלת את מטמון ה־messages. הדלקה או כיבוי של citations פוסלים גם את מטמון ה־system וגם את מטמון ה־messages ("modifies the system prompt"). — [Prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
- Files API יציב ולא דורש header של beta. מגבלות: 500MB לקובץ ו־1TB לארגון. הפעולות עצמן חינמיות, ו־"File content used in Messages requests is priced as input tokens". הקצב מוגבל לכ־500 RPM. — [Files API](https://platform.claude.com/docs/en/build-with-claude/files)
- הקבצים משויכים ל־workspace, ו־"Any API key with access to a workspace can access any files uploaded to that workspace". אפשר לקבוע תפוגה (`expires_in_seconds`) בין שעה ל־90 יום. ה־API אינו מכוסה ב־ZDR, והקבצים נשמרים עד מחיקה או תפוגה. — [Files API](https://platform.claude.com/docs/en/build-with-claude/files)
- טקסט רגיל אפשר להעלות כ־`text/plain` ולהשתמש בו בבלוק `document`. ‏.docx ו־.xlsx לא נתמכים בבלוק כזה. — [PDF support](https://platform.claude.com/docs/en/build-with-claude/pdf-support)
- נקודת הקצה של ספירת הטוקנים לא מקבלת מקור מסוג `url` או `file`, ולכן סופרים ב־base64. — [Token counting](https://platform.claude.com/docs/en/build-with-claude/token-counting)

### Inferences — הסקות
- PDF שבנוי מפריימים בלי שכבת טקסט נותן פחות שליטה מתמונות, כי רזולוציית הרינדור של העמוד לא מתועדת, ואין בו טקסט לחלץ. אין בו יתרון.
- PDF עם שכבת OCR מקומית ייתן citations ברמת עמוד (עמוד, ממנו שקופית, ממנה זמן) בלי הנדסה נוספת. אבל אותו מיפוי מתקבל גם מ־`search_result` לכל שקופית, עם שליטה מלאה בגודל התמונה.
- כשהמרצה מספק דק מקורי (PDF, או PPTX שהומר ל־PDF), עדיף לשלוח PDF: הטקסט המקורי מדויק ממילא, ומקבלים citations ברמת עמוד. העלות לעמוד לא ידועה מראש, וכדאי למדוד אותה ב־count_tokens החינמי על דק לדוגמה.
- Files API שימושי רק כשהבקשה מתקרבת ל־128MB. לפרטיות: לקבוע `expires_in_seconds: 3600` ולמחוק בסוף העבודה.
- במטמון: לשים נקודת `cache_control` מפורשת על הבלוק האחרון בקידומת המשותפת, כי חלון ה־lookback הוא 20 בלוקים בלבד וקידומת עם 60 שקופיות ו־12 פרקים מכילה יותר מ־70 בלוקים.

### Gaps — פערים
- רזולוציית הרינדור של עמוד PDF, וכמה טוקני תמונה יש בעמוד, לא מתועדות.
- לא מתועד אם חילוץ הטקסט מ־PDF מטפל נכון בעברית ובכיווניות מימין לשמאל בשקופיות.

## 4. מנופי עלות: מטמון, ‏Batches, ספירת טוקנים, ‏structured outputs, ‏thinking/effort, לולאת "תסתכל בפריים בזמן T" ו־Agent SDK

### Takeaway — השורה התחתונה
המנופים הגדולים הם: Batch (‏50% על הכל), מטמון לקידומת המשותפת (קריאה ב־5% ב־Opus ו־Sonnet 5.5), פלט קצר, ו־effort או thinking מותאמים לכל מעבר. מלכודת חשובה: במטמון בתוך Batch, שבו הפגיעה במטמון היא best-effort ‏(30–98%), כתיבה לשעה (פי 2) משתלמת רק מעל כ־51% פגיעות. מתחת לזה היא יקרה יותר מ־Batch בלי מטמון. לולאת כלי "תסתכל בפריים" יקרה בערך פי 5 משליחת אותן תמונות מראש. ‏Agent SDK מיותר לצינור קבוע.

### Cited Findings — ממצאים עם מקורות
- מכפילי המטמון: כתיבה ל־5 דקות פי 1.25, כתיבה לשעה פי 2. קריאה פי 0.1, אבל פי 0.05 ב־Opus 5.5 וב־Sonnet 5.5 ופי 0.025 ב־Fable 5.1. המטמון משתלם אחרי קריאה אחת (5 דקות) או שתיים (שעה), והמכפילים "stack" עם Batch. — [Pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- קידומת מינימלית למטמון: "512 tokens for Claude Fable 5.1, ... Claude Opus 5.5, ... Claude Sonnet 5.5, ... and Claude Haiku 5.5". יש מטמון אוטומטי (`cache_control` אחד ברמה העליונה), ועד 4 נקודות מפורשות. — [Prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
- מדידות Anthropic: המטמון הוריד עלות פי 4.8–7.2 בסוכן מחקר ו־83–86% בסוכן מיון קטן. לולאות סוכנים קוראות מהמטמון חציון של 84% מהקלט, ו־"Below about 80%, look for something breaking the cache". עריכת system prompt בשיחה של כ־100K טוקנים עלתה עד $1.26, ושינוי effort עלה עד $1.02. — [Optimizing for cost and intelligence](https://platform.claude.com/docs/en/about-claude/models/optimizing-for-cost-and-intelligence)
- Message Batches: ‏"most batches finishing in less than 1 hour while reducing costs by 50 percent". עד 100,000 בקשות או 256MB ב־batch, ותפוגה אחרי 24 שעות. התוצאות זמינות 29 יום. ה־batch משויך ל־workspace ועלול לחרוג מעט ממגבלת ההוצאה. `max_tokens` חייב להיות לפחות 1, כלומר אין חימום מטמון בתוך batch. — [Batch processing](https://platform.claude.com/docs/en/build-with-claude/batch-processing)
- Batch ומטמון: ההנחות מצטברות, אבל "cache hits are provided on a best-effort basis. Users typically experience cache hit rates ranging from 30 percent to 98 percent". ההמלצות הן מטמון לשעה ובלוקי `cache_control` זהים בכל בקשה. — [Batch processing](https://platform.claude.com/docs/en/build-with-claude/batch-processing)
- הנחת ה־Batch לא מצטרפת ל־fast mode, ל־message threads או לסשנים של Managed Agents. — [Optimizing for cost and intelligence](https://platform.claude.com/docs/en/about-claude/models/optimizing-for-cost-and-intelligence)
- ספירת טוקנים: "free to use", עם 5,000 RPM ב־Start tier ‏(10,000 ב־Build, 20,000 ב־Scale). המספר הוא הערכה, והספירה לא משתמשת במטמון. "Claude 4.7 and later models ... produce approximately 30 percent more tokens than on earlier models". השירות מכוסה ב־ZDR. — [Token counting](https://platform.claude.com/docs/en/build-with-claude/token-counting)
- Structured outputs: ‏`output_config.format` עם `type: "json_schema"` או `strict: true` בכלים. מגבלות: 20 כלים strict, ‏24 פרמטרים אופציונליים ו־16 פרמטרים עם union. הדקדוק נשמר במטמון "24 hours from last use". השימוש מוסיף פרומפט מערכת ("input token count is slightly higher"), ושינוי `output_config.format` "will invalidate any prompt cache for that conversation thread". — [Structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)
- Citations ו־structured outputs לא מתאימים זה לזה: הפעלת citations על `document` או `search_result` יחד עם `output_config.format` מחזירה 400. — [Citations](https://platform.claude.com/docs/en/build-with-claude/citations)
- הרצה חוזרת של כישלונות ב־effort גבוה (Opus 5.5): ‏`low` עם הרצה חוזרת ב־`high` הגיע לכ־97% בכ־$0.17 למשימה, לעומת 95.3% ב־$0.29 כשהכל רץ ב־`high`. השיטה דורשת אות כישלון אמין. — [Optimizing for cost and intelligence](https://platform.claude.com/docs/en/about-claude/models/optimizing-for-cost-and-intelligence)
- שילוב מודלים: "Tune one model before you add a second". ‏Opus 5.5 עם סוכני־משנה של Sonnet 5.5 עלה כשליש פחות בחיפוש פגמים, באותו ציון. סוכני־משנה של Haiku 5.5 הורידו 32% מהעלות בקוד, ושיעור ההצלחה ירד בכ־4 נקודות. — [Optimizing for cost and intelligence](https://platform.claude.com/docs/en/about-claude/models/optimizing-for-cost-and-intelligence)
- Agent SDK: ‏"the same tools, agent loop, and context management that power Claude Code", ב־Python וב־TypeScript, עם כלים מובנים, hooks, סוכני־משנה, MCP ו־sessions. משפות אחרות מריצים את ה־CLI עם `-p --output-format json`. ‏"Unless previously approved, Anthropic does not allow third party developers to offer claude.ai login or rate limits for their products, including agents built on the Claude Agent SDK." — [Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview)
- בעובד שלנו כבר נמדד: מסלול ה־CLI עולה מעטפת של כ־1,400 טוקנים לקריאה, לעומת כ־127K לכל סוכן־משנה במסלול הישן. תשתית Message Batches ‏(`BatchWait`, ‏`batch_dir`) כבר קיימת. — [translator/llm.py](../../../translator/llm.py)

### Inferences — הסקות
- **נקודת האיזון של מטמון בתוך Batch.** בכל בקשה שצריכה את הקידומת P, ובהשוואה ל־Batch בלי מטמון (מקדם קלט 1.0; הנחת ה־50% זהה בשני הצדדים ומתבטלת), התוחלת היא `0.05·h + w·(1−h)`. ‏w הוא מכפיל הכתיבה, כי פספוס עם `cache_control` הוא כתיבה חדשה. נקודת האיזון: `h* = (w−1)/(w−r)`.
  - Opus או Sonnet 5.5 ‏(r=0.05): עם מטמון לשעה (w=2) ‏h* = 1/1.95 ≈ **51%**. עם מטמון ל־5 דקות (w=1.25) ‏h* = 0.25/1.2 ≈ **21%**.
  - Haiku 5.5 ‏(r=0.1): ‏52.6% לשעה ו־21.7% ל־5 דקות.
  - מסקנה: עם פגיעה במטמון של 30–98%, מטמון לשעה בתוך Batch עלול להפסיד. החלופות: (א) לאחד מעברים שחולקים קידומת לקריאה אחת עם פלט ארוך; (ב) להריץ את כל הבקשות של אותה קידומת באותו batch עם בלוקים זהים; (ג) למדוד את `cache_read_input_tokens` בכמה ריצות ולבחור TTL לפי שיעור הפגיעה בפועל.
- **לולאת "תסתכל בפריים בזמן T" ב־Sonnet 5.5,** לכל הצצה: קריאת קידומת של 49K מהמטמון (49,000×$0.10/M = $0.0049), ועוד תמונה ב־720p (1,196×$2/M = $0.0024), ועוד כ־500 טוקני פלט וקריאת כלי (‏$0.005). ביחד כ־**$0.012** להצצה, ו־15 הצצות הן כ־$0.18. ‏15 אותן תמונות שנשלחות מראש עולות 17,940×$2/M ≈ **$0.036**, כלומר הלולאה יקרה בערך פי 5 ומוסיפה זמן. עדיף לבחור את השקופיות "החשובות" באופן דטרמיניסטי (החלפת סצנה וצפיפות OCR), ולהשאיר כלי רק למקרי קצה.
- **Agent SDK:** בצינור קבוע (מתאר, פרקים, סינתזה, אימות) לולאת סוכן, כלים מובנים ופרומפט מערכת הם תקורה. ‏Messages API ישיר עם Batches הוא הזול ביותר, והתשתית כבר קיימת ב־`llm.py`.
- **thinking לפי מעבר:** במעברי חילוץ ומיפוי לנסות Haiku 5.5 עם `thinking: disabled` ‏(effort ≤ `high`), או Sonnet 5.5 עם `between_tools`. בסינתזה להשאיר את ברירת המחדל. איכות כל מעבר צריך למדוד מול סט זהב. את ה־effort וה־thinking לקבע לכל מסלול, כי שינוי שלהם פוסל את המטמון.
- **Structured outputs מול citations:** מעבר שצריך citations יחזיר טקסט בפורמט של שורה לכל פריט, והקוד יפרסר. מעבר שצריך JSON קשיח יעבוד בלי citations, עם מזהי קטעים בתוך הסכמה ובדיקה בקוד.

### Gaps — פערים
- שיעור הפגיעה במטמון בתוך Batch בתעבורה שלנו לא ידוע. צריך למדוד מ־`usage.cache_read_input_tokens`.
- כמה טוקני thinking מייצר כל מעבר לא ידוע.
- כמה טוקנים מוסיף פרומפט המערכת של structured outputs ושל citations ("slightly higher") לא מכומת.

## 5. ‏Citations ו־`search_result`: איך מגיעים למיפוי דטרמיניסטי לחותמות זמן?

### Takeaway — השורה התחתונה
אם מעבירים את התמלול כבלוקי `search_result` או כמסמך custom content, שבהם כל קטע כתובית הוא בלוק טקסט, ה־citations מחזירים אינדקסים של בלוקים, והקוד ממפה אותם למזהה הקטע ולזמני ההתחלה והסיום. המודל אף פעם לא "כותב" חותמת זמן. ‏`cited_text` לא נספר כפלט. הפשרות: אי אפשר לשלב את זה עם structured outputs, ובגרסת ה־API ‏2026-10-21 אסור להחזיר citations בתוך טקסט של user.

### Cited Findings — ממצאים עם מקורות
- תוכן המסמך "chunked" כדי לקבוע את רמת הפירוט המינימלית. ב־custom content ‏"Your provided content blocks are used as-is and no further chunking is done", וה־citations מחזירים "the content block index range (0-indexed)". בטקסט רגיל מקבלים טווח תווים, וב־PDF טווח עמודים. — [Citations](https://platform.claude.com/docs/en/build-with-claude/citations)
- התיעוד מציין במפורש: "If you need more control over citation granularity (for example, for bullet points or transcripts), use custom content documents instead." — [Citations](https://platform.claude.com/docs/en/build-with-claude/citations)
- "`cited_text` does not count toward your output tokens", וגם לא כקלט כשמחזירים אותו בתור הבא. ה־citations "guaranteed to contain valid pointers to the provided documents", ובהערכות של Anthropic הם "significantly more likely to cite the most relevant quotes" מגישה שמבוססת על פרומפט. — [Citations](https://platform.claude.com/docs/en/build-with-claude/citations)
- טענת הספק: citations מובנים "outperform most custom implementations, increasing recall accuracy by up to 15%". לקוח (Endex) דיווח על ירידה בהזיות מקור ובבעיות פורמט "from 10% to 0%". אלה נתונים פנימיים של הספק ושל הלקוח. — [Introducing Citations (Claude blog)](https://claude.com/blog/introducing-citations-api)
- `title` ו־`context` מועברים למודל אבל לא ניתנים לציטוט, ו־`context` מתאים ל־metadata כ־JSON. ‏Citations עובדים עם prompt caching, ספירת טוקנים ו־batch. בלוקי ה־citation בתשובה לא נשמרים במטמון, אבל מסמכי המקור כן. — [Citations](https://platform.claude.com/docs/en/build-with-claude/citations)
- ‏JSON עם citations: "prompt Claude to answer with one line per field. Then parse the lines into structured data in your code". פרומפט מסוג "Return only a JSON object" עלול להחזיר "few or no citations". — [Citations](https://platform.claude.com/docs/en/build-with-claude/citations)
- `search_result`: ‏`source` הוא "Any stable string ... a URL, or an internal identifier such as `kb://article-1234`", ו־`title` חובה. הציטוט מגיע כ־`search_result_location` עם `search_result_index`, ‏`start_block_index` ו־`end_block_index`. "The text block is the minimal citable unit: Claude cites whole blocks". — [Search results](https://platform.claude.com/docs/en/build-with-claude/search-results)
- ה־citations כבויים כברירת מחדל ו־"all-or-nothing" לכל תוצאות החיפוש בבקשה. תוצאת חיפוש מכילה טקסט בלבד, בלי תמונות. היא מותרת רק בהודעות user או בתוך `tool_result`, ו־`tool_result` שמכיל `search_result` חייב להכיל רק `search_result`. אפשר לשים `cache_control` על הבלוק. השירות מכוסה ב־ZDR, חוץ מ־Covered Models. — [Search results](https://platform.claude.com/docs/en/build-with-claude/search-results)
- גרסת ה־API ‏`2026-10-21`: ‏"Sending a `text` block with a non-empty `citations` array in a `user` message, directly or inside a `search_result` block, returns a 400 error". באותה גרסה הוסרו `temperature`, ‏`top_p` ו־`top_k`. — [Versions](https://platform.claude.com/docs/en/api/versioning)

### Inferences — הסקות
- **מבנה מומלץ:** ‏`search_result` לכל פרק (2–5 דקות), עם `source: "lec:<job>#ch03"` ו־`title: "פרק 3 · 12:00–17:00"`. ה־`content` הוא בלוק טקסט לכל כתובית או קטע ASR ‏(2–7 שניות). המיפוי `(search_result_index, start_block_index, end_block_index)` → מזהי קטעים → `(start, end)` נעשה מטבלה בקוד. ככה המודל לא יכול להמציא זמן.
- **שקופיות:** ‏`search_result` לכל שקופית, עם טקסט ה־OCR, ‏`source: "slide:17"` ו־`title` שמכיל את טווח ההצגה. מכיוון שאין citations לתמונות, מצטטים את טקסט השקופית ומקבלים את זמן ההצגה שלה.
- **צינור רב־מעברי:** פלט של מעבר עם citations שמועבר כקלט למעבר הבא צריך לעבור הסרה של מערך ה־`citations`, ולהשאיר רק את הטקסט ואת מזהי הקטעים שחולצו. אחרת מקבלים 400 בגרסה 2026-10-21.
- **מטמון:** לא להחליף את מצב ה־citations בין מעברים שחולקים קידומת, כי זה פוסל את מטמון ה־system וה־messages.
- **פלט "שורה לכל טענה":** בתבנית `טענה: … ` יש citation לכל שורה. הקוד מפרסר, ממפה לזמן, ומוריד טענה שאין לה citation.

### Gaps — פערים
- תקורת הטוקנים של citations ושל כל בלוק `search_result` (רק "slight increase") לא מכומתת. צריך למדוד ב־count_tokens.
- אין מדד מתועד לאיכות citations על טקסט בעברית.

## 6. טוקניזציה של עברית מול אנגלית

### Takeaway — השורה התחתונה
אין נתון מפורסם על כמה טוקנים למילה עברית יש בטוקנייזר של Claude. נתוני עקיפין מטוקנייזרים אחרים מראים 5.6–5.8 טוקנים למילה עברית בטוקנייזר כללי, וכ־2.7 בטוקנייזר מותאם לעברית, לעומת כ־1.8 טוקנים למילה אנגלית ב־Claude. לכן תמלול עברי של שעה צפוי לעלות פי 1.3–2.9 בטוקנים מתמלול אנגלי, וזה עדיין זניח בחשבון הכולל. כדאי למדוד בחינם עם count_tokens.

### Cited Findings — ממצאים עם מקורות
- ב־Claude: ‏1M טוקנים ≈ 555K מילים או 2.5M תווים בטוקנייזר הנוכחי. — [Models overview](https://platform.claude.com/docs/en/about-claude/models/overview). ‏"approximately 30 percent more tokens than on earlier models". — [Token counting](https://platform.claude.com/docs/en/build-with-claude/token-counting)
- Petrov ואחרים (NeurIPS 2023): אותו טקסט בשפות שונות מגיע להפרשים באורך הטוקניזציה של "up to 15 times in some cases", ובמודלים ברמת בייט של "over 4 times". — [arXiv 2305.15425](https://arxiv.org/abs/2305.15425)
- DictaLM 2.0: ‏"the Mistral tokenizer has a compression rate of 5.81 tokens per Hebrew word". קורפוס של 35 מיליארד מילים נותן כ־204B טוקנים ב־Mistral, כ־196B בטוקנייזר של GPT-4 וכ־95B בטוקנייזר המורחב. בחלוקה זה כ־5.8, כ־5.6 וכ־2.7 טוקנים למילה (החלוקה היא חישוב, לא נתון מפורש במאמר). — [arXiv 2407.07080](https://arxiv.org/html/2407.07080)
- ב־Gemini טוקן ≈ 4 תווים, ו־100 טוקנים ≈ 60–80 מילים באנגלית. — [Gemini Tokens](https://aistudio.google.com/docs/tokens). שמע עולה מספר קבוע של טוקנים לשנייה (25 ב־Gemini 4/3), בלי תלות בשפה. — [Gemini Media resolution](https://aistudio.google.com/docs/media-resolution)

### Inferences — הסקות
- אנגלית: 9,000 מילים × 1.80 (‏1M/555K) ≈ **16,200** טוקנים.
- עברית: בהנחה של 8,000 מילים בשעה (לא מאומת) ובטווח של 2.7–5.8 טוקנים למילה, מקבלים **21,600–46,400**. בטבלת העלות (סעיף 8) לקחתי את הקצה העליון, 46,400, כדי להיות שמרני.
- אפילו במקרה הגרוע תמלול עברי של 3 שעות (כ־140K) נכנס בחלון של 1M. אבל ב־Haiku 5.5 הוא חוצה את סף ה־100K, וזה פי 5.
- פלט בעברית: אותו תקציב טוקנים נותן פחות מילים. את התקציב מגדירים בטוקנים ומודדים.
- ב־Gemini, ‏90K טוקני שמע לשעה הם בלי תלות בשפה. תמלול עברי בטקסט (22–46K) עדיין זול יותר מהשמע.
- תוכנית מדידה: count_tokens (חינמי, ‏5,000 RPM) על 5 תמלולים בעברית ו־5 באנגלית מהסטודיו, לכל מודל, ואז להחליף את ההנחות בטבלה. אפשר להריץ את זה בשרת העובד, כי בסביבה הזו אין מפתח API.

### Gaps — פערים
- היחס האמיתי של טוקנים למילה עברית ב־Claude לא פורסם, ולא היה אפשר למדוד אותו כאן.
- קצב הדיבור בעברית בהרצאות שלנו (מילים לשעה) הוא הנחה.
- תקציב החיפוש ברשת נגמר, ולא נמצאה מדידה בלתי תלויה של עברית בטוקנייזר של Claude.

## 7. השוואה ל־Gemini: וידאו מקורי, מחירים, ‏Batch, מטמון, ‏YouTube, ‏Files ותנאי שימוש בנתונים

### Takeaway — השורה התחתונה
שעת וידאו במצב סטטי (1 FPS) היא כ־342–360K טוקנים, כ־100 טוקנים לשנייה. בקריאה אחת זה עולה כ־$0.13 ב־3.1 Flash-Lite, כ־$0.15 ב־3.5 Flash-Lite, כ־$0.32 ב־3.8 Flash (ו־$0.64 מ־1/1/2027), כ־$0.86 ב־4 Argon (ו־$1.72 מ־1/12/2026) וכ־$1.68 ב־3.1 Pro. ‏`low` לא מוזיל וידאו במודלי Gemini 3/4. המנוף האמיתי הוא FPS נמוך או מצב agentic. חותמות הזמן של Gemini נוצרות על ידי המודל, ולכן אינן דטרמיניסטיות.

### Cited Findings — ממצאים עם מקורות
- **Gemini 4 Argon:** ‏$2.00 קלט ו־$10.00 פלט עד 30/11/2026, ו־$4.00/$20.00 מ־1/12/2026. מטמון $0.10, ואחר כך $0.20 (רק "Implicit caching"). לא זמין ב־Free tier. ‏Batch ו־Flex בחצי מחיר. — [Gemini pricing](https://aistudio.google.com/docs/pricing)
- **Gemini 3.8 Flash:** ‏$0.75/$3.75 עד 31/12/2026, ו־$1.50/$7.50 מ־1/1/2027. מטמון $0.075 ועוד $0.50 למיליון טוקנים לשעה לאחסון, שמוכפלים ב־2027. ‏Batch בחצי. ב־Free tier הנתונים "Used to improve our products". — [Gemini pricing](https://aistudio.google.com/docs/pricing)
- **Gemini 3.6 Flash:** אותם מחירים כמו 3.8 Flash. — [Gemini pricing](https://aistudio.google.com/docs/pricing). (כאן "כמו" מתייחס למחיר שבדף, לא להשוואת מוצר.)
- **Gemini 3.5 Flash-Lite:** ‏$0.30 ‏(text / image / video / audio) ו־$2.50 פלט. מטמון $0.03 ועוד $1.00 למיליון לשעה. ‏Batch ‏$0.15/$1.25. — [Gemini pricing](https://aistudio.google.com/docs/pricing)
- **Gemini 3.1 Flash-Lite:** ‏$0.25 לטקסט, תמונה ווידאו, ‏$0.50 לשמע, ו־$1.50 פלט. ‏Batch ‏$0.125, ‏$0.25 לשמע ו־$0.75 פלט. — [Gemini pricing](https://aistudio.google.com/docs/pricing)
- **Gemini 3.1 Pro Preview:** קלט $2.00 עד 200K ו־$4.00 מעל. פלט $12.00 עד 200K ו־$18.00 מעל. מטמון $0.20 או $0.40 ועוד $4.50 למיליון לשעה. ‏Batch ‏$1.00 עד 200K. — [Gemini pricing](https://aistudio.google.com/docs/pricing)
- **Gemini 3.5 Transcribe:** ‏$2.00 למיליון טוקני שמע, "or $0.003/min", ו־$12.00 לטקסט, "or $0.002/min", לפי 25 טוקני שמע לשנייה. כולל diarization, ‏"word-level timestamps" והטיית אוצר מילים. — [Gemini pricing](https://aistudio.google.com/docs/pricing)
- הוצאות משימוש: מ־1/12/2026 ‏`gemini-2.5-pro` מנותב אוטומטית ל־3.8 Flash ומחויב במחיריו, ו־`gemini-2.5-flash` מנותב ל־3.5 Flash-Lite. — [Gemini pricing](https://aistudio.google.com/docs/pricing)
- טוקני וידאו ב־Gemini 4/3: ‏70 לפריים ב־`unspecified`, ‏`low` ו־`medium`, ו־280 ב־`high`. שמע 25 לשנייה בכל הרמות. ‏"For video, `low` and `medium` settings are treated identically (70 tokens)". ‏`high` ‏"Required only when the use case involves reading dense text (OCR)". — [Media resolution](https://aistudio.google.com/docs/media-resolution). **נסתר חלקית על ידי** דף הווידאו (66 או 258 לפריים ו־32 טוקני שמע לשנייה, "Approximately 100 tokens per second ... or approximately 300") — [Video understanding](https://aistudio.google.com/docs/video-understanding) — ועל ידי דף הטוקנים ("Video: 263 tokens per second", ‏"Audio: 32 tokens per second", ‏~6,000 או ~18,000 לדקה) — [Tokens](https://aistudio.google.com/docs/tokens).
- במצב סטטי: ‏1 FPS, ‏"Audio is processed at 1Kbps (single channel)", ו־"Timestamps are added every second". אפשר `fps` מותאם (למשל 0.5) וחיתוך עם `start_offset` ו־`end_offset`. מודל עם חלון של 1M מעבד "up to 3 hours long by default (at low media resolution), or up to 1 hour long at high media resolution". — [Video understanding](https://aistudio.google.com/docs/video-understanding)
- מצב agentic ‏(`"processing": "agentic"`) נתמך ב־Argon, ב־3.8 Flash, ב־3.6 Flash וב־3.5 Flash-Lite: ‏"Up to 88% more token-efficient and ~7% higher quality on long-form content". טוקני הניווט נספרים כ־thought tokens, והפריימים, השמע והתמלול שנטענים לפי דרישה נספרים כ־tool use tokens. המצב עלול להגדיל את זמן התגובה, ולכן מומלץ background execution. — [Video understanding](https://aistudio.google.com/docs/video-understanding). בווידאו של 60 שניות: ‏"Typically 1,500 to 3,000" טוקנים. — [Tokens](https://aistudio.google.com/docs/tokens)
- קלט: ‏Files API עד 20GB בתשלום ו־2GB בחינם, ונדרש מעל 20MB או לווידאו ארוך. ‏YouTube: ‏"in preview and is available at no charge. Pricing and rate limits are likely to change". רק סרטונים ציבוריים. ב־Free tier עד 8 שעות ביום, ועד 10 סרטונים לבקשה. — [Video understanding](https://aistudio.google.com/docs/video-understanding)
- מטמון: "Implicit caching is enabled by default for all Gemini 2.5 and newer models". המינימום הוא 4,096 טוקנים ב־Argon, ב־3.8 Flash, ב־3.6 Flash וב־3.1 Pro. ‏Interactions API תומך רק ב־implicit. מטמון מפורש זמין רק דרך generateContent במודלי 3.x ו־2.5, ולא מ־Argon והלאה. — [Gemini caching](https://aistudio.google.com/docs/caching)
- Batch: ‏"50% of the standard cost". זמן היעד 24 שעות, ו־"in majority of cases, it is much quicker". קובץ קלט עד 2GB, ומטמון נתמך. — [Gemini Batch API](https://aistudio.google.com/docs/batch-api)
- הגדרות מומלצות: לתמונות `high` ‏(1,120 טוקנים). ל־PDF ‏`medium` ‏(560), כי "quality typically saturates at `medium`". לווידאו כללי `low` ‏(70), ולווידאו עמוס טקסט `high` ‏(280). — [Media resolution](https://aistudio.google.com/docs/media-resolution)
- בלוג Google (מאי 2025, על 2.5 Pro): רזולוציה נמוכה מאפשרת "~6 hours of video with 2 million token context", ב־84.7% מול 85.2% ב־VideoMME. אין בו נתוני דיוק לחותמות זמן. — [Google Developers Blog](https://developers.googleblog.com/en/gemini-2-5-video-understanding/)
- שימוש בנתונים: ב־Unpaid Services ‏(Free tier ו־AI Studio) ‏Google משתמשת בתוכן "to provide, improve, and develop Google products", ו־"human reviewers may read, annotate, and process your API input and output", עם ההנחיה "Do not submit sensitive, confidential, or personal information". ב־Paid Services ‏"Google doesn't use your prompts ... or responses to improve our products", ושומרת יומנים "for a limited period of time" לניטור שימוש לרעה. משתמשים ב־EEA, בשווייץ ובבריטניה מקבלים רק Paid Services. — [Gemini API Terms](https://aistudio.google.com/docs/terms)
- יומני מפתח: "Logging is on by default for Interactions API calls, and for Generate Content API calls in projects created on or after October 26, 2026". היומנים נשמרים "default maximum period of 55 days", ואפשר לקבוע 7, ‏14, ‏28 או 55 יום. ב־Contributor Tier (בהזמנה בלבד) יש "up to 50% off", והנתונים מטופלים לפי תנאי ה־Unpaid. — [Data logging and sharing](https://aistudio.google.com/docs/logs-policy)
- מגבלות קצב מבוססות הוצאה: ב־Tier 1 ‏$10 לכל 10 דקות, ותקרת חיוב של $250 ב־Tier 1. — [Gemini rate limits](https://aistudio.google.com/docs/rate-limits)
- בעובד כבר יש קריאה ל־Gemini API ‏(`generativelanguage.googleapis.com/v1beta`, לפי `GEMINI_API_KEY`) לביקורת תרגום חיצונית. — [translator/vt/review.py](../../../translator/vt/review.py)

### Inferences — הסקות
- **בהרצאה עם שקופיות `low` לא חוסך כלום** ב־Gemini 3/4: כל רמה מתחת ל־`high` עולה 70 טוקנים לפריים. החיסכון מגיע מהורדת FPS. שקופית מתחלפת אחת לדקות, ולכן ‏0.2–0.5 FPS מספיקים לתוכן השקופיות.
- **`high` ב־1 FPS לא נכנס:** ‏3,600×(280+25) = 1,098,000 טוקנים, יותר מ־1M. לשקופיות בטקסט קטן צריך `high` עם `fps: 0.5`, שזה כ־596K טוקנים.
- **Gemini כקו בסיס של "קריאה אחת":** כ־$0.13–0.32 לשעה במחירי 2026, אבל חותמות הזמן הן טקסט שהמודל מייצר (MM:SS), ולכן חייבים לאמת אותן מול התמלול שלנו.
- **סיכון מחיר:** ‏Argon מוכפל מ־1/12/2026, ו־3.8 ו־3.6 Flash מוכפלים מ־1/1/2027. ‏Flash-Lite לא מסומן לשינוי. לתכנון כדאי להשתמש במחירי 2027.
- **פרטיות:** רק Paid tier. כדאי לבדוק או לכבות logging ב־AI Studio, או לקבוע 7 ימים. אסור לשלוח הרצאות של משתמשים ל־Free tier או ל־Contributor Tier.
- **אינטגרציה:** תשתית Gemini כבר קיימת בעובד (`vt/review.py`), ולכן אסטרטגיה F זולה לחיבור.

### Gaps — פערים
- אין חשבון טוקנים מדויק למצב agentic בהרצאה של שעה. יש רק "Typically 1,500 to 3,000" לדקה, וכמה thought tokens הניווט מייצר לא ידוע.
- לא נבדק אם הסרת ערוץ השמע (`ffmpeg -an`) מבטלת את 25 טוקני השמע לשנייה.
- התמיכה והאיכות בעברית של Gemini 3.5 Transcribe ושל הבנת דיבור עברי בווידאו לא נבדקו.
- לא ברור מה פירוש "available at no charge" ב־YouTube: אם הכוונה שטוקנים לא מחויבים בתקופת ה־preview.
- לא נמצאה מדידה בלתי תלויה של דיוק חותמות הזמן של Gemini בהרצאות (תקציב החיפוש נגמר).
- שלושת דפי Google סותרים זה את זה (70/280/25 מול 66/258/32 ו־263 לשנייה). ההכרעה צריכה לבוא מ־`usage` בפועל.

## 8. טבלת עלות להרצאה אחת של שעה: אסטרטגיות A–G, לפי מודל ולפי מבנה רב־מעברי

### Takeaway — השורה התחתונה
כל אסטרטגיה סבירה עולה בין כ־$0.01 (רק Haiku 5.5) לכ־$2.25 (Opus 5.5 רב־מעברי בלי מטמון ובלי Batch) לשעת הרצאה. המבנה המומלץ: תמלול מקומי, OCR מקומי ו־15 שקופיות מורכבות (D), עם Sonnet 5.5 בארבעה מעברים, אימות ב־Haiku 5.5, ‏Batch ומטמון. הוא עולה כ־**$0.29** באנגלית וכ־**$0.38** בעברית, לעומת Gemini מקורי בקריאה אחת שעולה כ־$0.13–0.32 (במחירי 2026). הפלט שולט בחשבון בכל האסטרטגיות של Claude.

### Cited Findings — ממצאים עם מקורות
- מחירי Claude בחישוב: [Pricing](https://platform.claude.com/docs/en/about-claude/pricing), סעיף 1. מחירי Gemini: [Gemini pricing](https://aistudio.google.com/docs/pricing), סעיף 7.
- טוקני תמונה ⌈w/28⌉×⌈h/28⌉: ‏[Vision](https://platform.claude.com/docs/en/build-with-claude/vision). ‏1.80 טוקנים למילה אנגלית (‏1M/555K): ‏[Models overview](https://platform.claude.com/docs/en/about-claude/models/overview). טווח העברית 2.7–5.8: ‏[arXiv 2407.07080](https://arxiv.org/html/2407.07080).
- thinking מחויב כפלט: [Thinking](https://platform.claude.com/docs/en/build-with-claude/thinking). ‏Batch ‏50% ופגיעה במטמון של 30–98%: ‏[Batch processing](https://platform.claude.com/docs/en/build-with-claude/batch-processing).
- טוקני וידאו ושמע ב־Gemini: ‏[Media resolution](https://aistudio.google.com/docs/media-resolution) ו־[Tokens](https://aistudio.google.com/docs/tokens).

### Inferences — הסקות

**הנחות (מסומנות. להחליף במדידה):**
```
T_en   = 9,000 מילים × 1.80 = 16,200 ; + מזהי קטעים וזמנים (~360 קטעים × ~10) ≈ 3,600  → ≈ 20,000
S      = system + הוראות ≈ 2,000                         → קלט B באנגלית = 22,000
T_he   = 8,000 מילים × 5.8 (קצה עליון) = 46,400 ; +3,600 +2,000 → קלט B בעברית ≈ 52,000
OUT    = 12,000 פלט גלוי (אמצע של 8–15K) + 5,000 thinking = 17,000 טוקני פלט מחויבים
IMG720 = 60 × 1,196 = 71,760 ; IMG1080 = 60 × 2,691 = 161,460 ; IMG540 = 60 × 700 = 42,000
OCR    = 60 × ~150 = 9,000 (עברית: ~18,000) ; IMG15 = 15 × 1,196 = 17,940 ; VLM = 60 × ~200 = 12,000
עלות OUT=17K:  Haiku 0.0085 (≤100K) / 0.0425 (>100K) · Sonnet 0.17 · Opus 0.34 · Fable 0.85
```

**A: ‏Gemini מקורי, קריאה אחת שמפיקה גם את הסיכום (קלט וידאו ועוד פרומפט של 2K, ‏17K פלט):**
```
A-static (ברירת מחדל = low): 3,600 × (70+25) = 342,000 + 2,000 = 344,000
  3.8 Flash (2026): 344,000×0.75 + 17,000×3.75 = 0.258 + 0.064 = $0.32  | 2027: $0.64 | Batch 2026: $0.16
  3.6 Flash: זהה ל־3.8 Flash
  3.5 Flash-Lite:   344,000×0.30 + 17,000×2.50 = 0.103 + 0.043 = $0.15  | Batch: $0.073
  3.1 Flash-Lite:   254,000×0.25 (וידאו+פרומפט) + 90,000×0.50 (שמע) + 17,000×1.50 = 0.064 + 0.045 + 0.026 = $0.13 | Batch: $0.067
  4 Argon (עד 30/11): 344,000×2 + 17,000×10 = 0.688 + 0.17 = $0.86 | מ־1/12: $1.72 | Batch: $0.43 / $0.86
  3.1 Pro (>200K):  344,000×4 + 17,000×18 = 1.376 + 0.306 = $1.68
A-low: זהה ל־A-static ב־Gemini 3/4 (70 טוקנים לפריים בכל רמה מתחת ל־high)
A-high @1 FPS: 3,600 × (280+25) = 1,098,000 > 1M → לא נכנס בקריאה אחת
A-high @0.5 FPS: 1,800×280 + 90,000 + 2,000 = 596,000
  3.8 Flash: 0.447 + 0.064 = $0.51 (2027: $1.02) · 3.5 Flash-Lite: 0.179 + 0.043 = $0.22
  3.1 Flash-Lite: 506,000×0.25 + 0.045 + 0.026 = $0.20 · Argon: 1.192 + 0.17 = $1.36 (מ־1/12: $2.72) · 3.1 Pro: 2.384 + 0.306 = $2.69
A-שקופיות @0.2 FPS: 720×70 + 90,000 + 2,000 = 142,400 → 3.8 Flash: 0.107 + 0.064 = $0.17 · 3.5 Flash-Lite: 0.043 + 0.043 = $0.085
A-agentic (אקסטרפולציה לינארית מ־"1,500–3,000 לדקה"): 90,000–180,000 + thought tokens של הניווט (לא ידוע)
  3.8 Flash: 0.068–0.135 + 0.064 = $0.13–0.20 + X
```

**B–F: ‏Claude בקריאה אחת (סינתזה מלאה בבקשה אחת):**

| אסטרטגיה | טוקני קלט | Haiku 5.5 | Sonnet 5.5 | Opus 5.5 | Fable 5.1 |
|---|---|---|---|---|---|
| B: תמלול בלבד (EN) | 22,000 | $0.011 | $0.21 | $0.43 | $1.07 |
| B: תמלול בלבד (HE) | 52,000 | $0.014 | $0.27 | $0.55 | $1.37 |
| C: ‏+60 שקופיות 720p ‏(EN) | 93,760 | $0.018 | $0.36 | $0.72 | $1.79 |
| C: ‏+60 שקופיות 1080p ‏(EN) | 183,460 | $0.134 (מעל 100K) | $0.54 | $1.07 | $2.68 |
| C: ‏+60 שקופיות 540p ‏(EN) | 64,000 | $0.015 | $0.30 | $0.60 | $1.49 |
| C: ‏+60 שקופיות 720p ‏(HE) | 123,760 | $0.104 (מעל 100K) | $0.42 | $0.84 | $2.09 |
| D: ‏+OCR של כל השקופיות ו־15 תמונות (EN) | 48,940 | $0.013 | $0.27 | $0.54 | $1.34 |
| D: ‏(HE) | 87,940 | $0.017 | $0.35 | $0.69 | $1.73 |
| E: ‏+כיתובי VLM מקומי (EN), בלי עלות CPU | 34,000 | $0.012 | $0.24 | $0.48 | $1.19 |
| F: ‏Gemini F1 ועוד Claude (EN) | 31,000 + Gemini | $0.030 | $0.25 | $0.48 | — |
| F: ‏Gemini F2 ועוד Claude (EN) | 31,000 + Gemini | $0.097 | $0.32 (2027: $0.40) | $0.55 | — |

```
B-EN : Haiku 22,000×0.10/M + 0.0085 = 0.0022+0.0085 | Sonnet 0.044+0.17 | Opus 0.088+0.34 | Fable 0.22+0.85
B-HE : Haiku 0.0052+0.0085 | Sonnet 0.104+0.17 | Opus 0.208+0.34 | Fable 0.52+0.85
C-720-EN : 22,000+71,760 = 93,760 → Haiku 0.0094+0.0085 | Sonnet 0.1875+0.17 | Opus 0.375+0.34 | Fable 0.938+0.85
C-1080-EN: 22,000+161,460 = 183,460 → Haiku(>100K) 183,460×0.50/M + 17,000×2.50/M = 0.0917+0.0425 | Sonnet 0.367+0.17 | Opus 0.734+0.34
C-720-HE : 52,000+71,760 = 123,760 → Haiku(>100K) 0.0619+0.0425 | Sonnet 0.2475+0.17 | Opus 0.495+0.34
D-EN : 22,000+9,000+17,940 = 48,940 → Haiku 0.0049+0.0085 | Sonnet 0.0979+0.17 | Opus 0.1958+0.34
D-HE : 52,000+18,000+17,940 = 87,940 → Haiku 0.0088+0.0085 | Sonnet 0.1759+0.17 | Opus 0.3518+0.34
E-EN : 22,000+12,000 = 34,000 → Haiku 0.0034+0.0085 | Sonnet 0.068+0.17 | Opus 0.136+0.34
F, החלק של Claude: 22,000 + 9,000 (טקסט מ־Gemini) = 31,000 → Haiku 0.0116 | Sonnet 0.232 | Opus 0.464
  F1 = 3.1 Flash-Lite, ‏60 פריימים מפתח כתמונות `low` ‏(280): 17,800×0.25/M + 9,000×1.50/M = 0.0045+0.0135 = $0.018
  F2 = 3.8 Flash, ‏60 פריימים כ־`high` ‏(1,120): 68,200×0.75/M + 9,000×3.75/M = 0.051+0.034 = $0.085 (2027: $0.17)
  F3 = 3.5 Flash-Lite, כל הווידאו סטטי: 344,000×0.30/M + 9,000×2.50/M = $0.126 → עם Sonnet: $0.36
```

**G: רב־מעברי (מיפוי, צמצום, סינתזה, אימות) עם מטמון ו־Batch.** הקידומת המשותפת P היא קלט D: באנגלית ‏48,940 ≈ 49,000, ובעברית ‏87,940 ≈ 88,000.
```
מעבר 1 (מתאר ופרקים):   P (כתיבה למטמון לשעה) + 500   → פלט 5,000
מעבר 2 (הערות לכל פרק): 6 קריאות × (P מהמטמון + 500) → פלט 6×3,000 = 18,000
מעבר 3 (סינתזה):        P מהמטמון + 12,500 (פלטי מעבר 2 בלי citations) → פלט 8,000
מעבר 4 (אימות, Haiku 5.5, מטמון נפרד כי המטמון תלוי במודל): קלט 25,000 → פלט 3,000 = 0.0025+0.0015 = $0.004
במודל הראשי: כתיבה 49,000 · קריאות 7×49,000 = 343,000 · קלט לא שמור 16,000 · פלט 31,000

Sonnet 5.5, סינכרוני עם מטמון לשעה: 49,000×4 + 343,000×0.10 + 16,000×2 + 31,000×10 = 0.196+0.034+0.032+0.31 = $0.572 → עם אימות $0.58
Sonnet 5.5, סינכרוני בלי מטמון: 408,000×2 + 31,000×10 = 0.816+0.31 = $1.126 → $1.13
Sonnet 5.5, Batch עם מטמון (100% פגיעה): $0.286 + $0.002 → $0.29
Sonnet 5.5, Batch בלי מטמון: $0.563 + $0.002 → $0.57
Sonnet 5.5, Batch עם מטמון לשעה ו־30% פגיעה: כתיבות (1+4.9)×49,000 = 289,100×4×0.5 = 0.578 ; קריאות 2.1×49,000×0.10×0.5 = 0.005 ;
              לא שמור 16,000×2×0.5 = 0.016 ; פלט 31,000×10×0.5 = 0.155 → $0.75  (יקר יותר מ־Batch בלי מטמון!)
Sonnet 5.5, Batch עם מטמון ל־5 דקות ו־30% פגיעה: כתיבות 289,100×2.50×0.5 = 0.361 → סה״כ $0.54
Opus 5.5, סינכרוני עם מטמון: 49,000×8 + 343,000×0.20 + 16,000×4 + 31,000×20 = 0.392+0.069+0.064+0.62 = $1.145 → $1.15 ; Batch → $0.57 ; סינכרוני בלי מטמון: 1.632+0.62 = $2.25
Haiku 5.5 בלבד, סינכרוני עם מטמון: 49,000×0.20 + 343,000×0.01 + 16,000×0.10 + 31,000×0.50 = 0.0098+0.0034+0.0016+0.0155 = $0.030 → $0.034 ; Batch → $0.017
עברית (P≈88,000): Sonnet: 88,000×4 + 616,000×0.10 + 16,000×2 + 31,000×10 = 0.352+0.062+0.032+0.31 = $0.756 → $0.76 ; Batch → $0.38
                  Opus: 0.704+0.123+0.064+0.62 = $1.51 ; Batch → $0.76
                  Haiku: במעבר 3 יש 88,000+12,500 = 100,500 > 100K → הקריאה הזו במחיר פי 5
```

**מה שמסתמן מהטבלאות:**
- **הפלט שולט:** ב־B עם Sonnet הפלט הוא 0.17 מתוך 0.214 ‏(79%), וב־G עם Sonnet ומטמון הוא 0.31 מתוך 0.572 ‏(54%). קיצור הפלט ב־39% (נתון Anthropic) יחסוך יותר מהורדת כל השקופיות.
- **D מול C:** ‏OCR מקומי ו־15 תמונות (‏$0.27 ב־Sonnet) זולים ב־25% מ־60 תמונות ב־720p ‏($0.36), ומחזיקים את Haiku מתחת ל־100K גם בעברית.
- **G עם Batch ומטמון ב־Sonnet ‏($0.29)** עולה בערך כמו D בקריאה סינכרונית אחת ‏($0.27), ונותן מתאר, הערות לכל פרק, סינתזה ואימות.
- **Gemini מקורי** זול יותר רק כשמסתפקים בקריאה אחת ובחותמות זמן שהמודל מייצר. מ־2027 ‏3.8 Flash עולה $0.64, יותר מ־G עם Sonnet ו־Batch.
- **אימות:** ב־Haiku 5.5 כ־$0.004. ב־Sonnet 5.5 זה 25,000×2/M + 3,000×10/M = $0.08.
- **שאלות על ההרצאה, לכל שאלה, על קידומת D מהמטמון:** ב־Sonnet 49,000×0.10/M + 2,000×10/M ≈ $0.025. ב־Haiku כ־$0.0015. ב־3.8 Flash עם implicit cache: ‏344,000×0.075/M + 2,000×3.75/M ≈ $0.033.
- **תחזית ל־100 הרצאות (אנגלית / עברית):** ‏A ב־3.8 Flash ‏$32 (ב־2027 ‏$64). ‏A ב־3.5 Flash-Lite ‏$15. ‏B ב־Sonnet ‏$21 / $27. ‏D ב־Sonnet ‏$27 / $35. ‏**G ב־Sonnet עם Batch ומטמון: $29 / $38**. ‏G ב־Opus עם Batch: ‏$57 / $76. ‏G ב־Haiku עם Batch: ‏$1.7.
- **E (VLM מקומי):** החלק של Claude הוא $0.24 ב־Sonnet. המחיר האמיתי הוא זמן CPU בשרת CX53, שכבר משולם חודשית. משפחת Qwen3-VL כוללת מודלים צפופים בגדלים 2B, ‏4B, ‏8B ו־32B ומודלי MoE ‏(30B-A3B ו־235B-A22B), עם OCR שהורחב ל־39 שפות ועם יותר מ־70% דיוק ב־32 מהן. — [arXiv 2511.21631](https://arxiv.org/abs/2511.21631)

### Gaps — פערים
- כמה טוקני thinking מייצר כל מעבר, ואורך הפלט בפועל: הנחות.
- כמה טוקנים יש באמת ב־OCR של שקופית, ובכיתוב של VLM: הנחות.
- זמן ה־CPU של VLM מקומי (אסטרטגיה E) בשרת CX53, ‏16 vCPU בלי GPU: לא נמדד. גם לא ידוע אם עברית נכללת ב־39 השפות של Qwen3-VL.
- חשבון הטוקנים של מצב agentic ב־Gemini, ושיעור הפגיעה במטמון בתוך Batch אצלנו: לא ידועים.

## 9. עיגון לחותמות זמן ועמידות בפני הזיות: טכניקות מוכחות

### Takeaway — השורה התחתונה
העיקרון: המודל אף פעם לא מייצר חותמת זמן. הוא מצטט מזהי קטעים, דרך citations או מזהים בסכמה, והקוד ממפה אותם לזמן. סביב זה בונים את המתכון: הנתונים בראש והשאלה בסוף, ציטוט לפני ניתוח, הקשר שלם במטמון ומשימה מחולקת לפרקים, אימות בשני שלבים (דטרמיניסטי ואחריו מודל זול), והסרה של טענה שאין לה ציטוט. מודלי וידאו עדיין חלשים בעיגון זמן מדויק.

### Cited Findings — ממצאים עם מקורות
- הנחיות Anthropic להקשר ארוך (20K ומעלה): "Put long-form data at the top", ו־"Queries at the end can improve response quality by up to 30 percent in tests". לעטוף כל מסמך ב־`<document>` עם `<source>` ו־`<document_content>`. ‏"Ground responses in quotes", כלומר לבקש ציטוטים לפני המשימה. — [Prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)
- צמצום הזיות: לאפשר "I don’t know". ‏"For tasks involving long documents (>20k tokens), ask Claude to extract word-for-word quotes first". אימות עם citations: ‏"If it can’t find a quote, it must retract the claim". עוד שיטות: Best-of-N, ‏iterative refinement ו־external knowledge restriction. — [Reduce hallucinations](https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-hallucinations)
- Lost in the Middle: הביצועים הטובים ביותר כשהמידע הרלוונטי בתחילת ההקשר או בסופו, והם יורדים כשהוא באמצע. — [arXiv 2307.03172](https://arxiv.org/abs/2307.03172)
- NoLiMa: ‏13 מודלים שטוענים להקשר של 128K לפחות. ב־32K, ‏11 מתוך 13 ירדו מתחת ל־50% מהביצוע שלהם בהקשר קצר, כשאין התאמה מילולית בין השאלה למחט. — [arXiv 2502.05167](https://arxiv.org/abs/2502.05167)
- Context Rot ‏(Chroma, יולי 2025, ‏18 מודלים): ‏"model performance consistently degrades with increasing input length". ‏"Even a single distractor reduces performance". ‏"structural coherence consistently hurts model performance". — [Context Rot](https://www.trychroma.com/research/context-rot)
- CoVe: טיוטה, אחריה תכנון שאלות אימות, מענה עליהן בנפרד, ותשובה מאומתת. השיטה מפחיתה הזיות במגוון משימות. — [arXiv 2309.11495](https://arxiv.org/abs/2309.11495)
- ALCE: ‏"even the best models lack complete citation support 50% of the time" ‏(ELI5, ‏2023). — [arXiv 2305.14627](https://arxiv.org/abs/2305.14627)
- Contextual Retrieval: ‏"If your knowledge base is smaller than 200,000 tokens ... you can just include the entire knowledge base in the prompt". שילוב Contextual Embeddings עם Contextual BM25 הוריד כשלי שליפה ב־49% (מ־5.7% ל־2.9%), ועם reranking ב־67% (ל־1.9%). — [Anthropic, Contextual Retrieval](https://www.anthropic.com/news/contextual-retrieval)
- E.T. Bench: מודלי וידאו "struggle to solve our fine-grained tasks, e.g., grounding event-of-interests within videos". הסיבות: הקשר וידאו קצר, ייצוג זמן לא מתאים, ומעט נתוני אימון עם כמה אירועים. — [arXiv 2409.18111](https://arxiv.org/abs/2409.18111). סקר VTG: ‏"standard MLLMs ... often struggle to capture fine-grained temporal dependencies". — [arXiv 2508.10922](https://arxiv.org/abs/2508.10922)
- Qwen3-VL: כל טלאי זמני מקבל קידומת של חותמת זמן כטקסט ("<3.0 seconds>"), "to perceive temporal information more effectively and precisely". — [arXiv 2511.21631](https://arxiv.org/abs/2511.21631)
- ב־Gemini: ‏"Timestamps are added every second", והפנייה לזמן היא בפורמט `MM:SS`. — [Video understanding](https://aistudio.google.com/docs/video-understanding). הבלוג על 2.5 לא מפרסם דיוק של חותמות זמן. — [Google Developers Blog](https://developers.googleblog.com/en/gemini-2-5-video-understanding/)
- Citations מבטיחים מצביעים תקינים, ו־`cited_text` לא נספר כפלט. — [Citations](https://platform.claude.com/docs/en/build-with-claude/citations)

### Inferences — הסקות
**מתכון מומלץ:**
1. **מזהים במקום זמנים:** כל כתובית או קטע ASR מקבל מזהה (`s0123`) וזמנים בטבלה בקוד. המודל מצטט דרך `search_result`, או כותב `[s0123–s0127]` כשאין citations. מזהה שלא קיים נדחה אוטומטית.
2. **הקשר שלם, משימה מחולקת:** תמלול של 1–3 שעות (כ־16–140K) קטן מ־200K, ולכן ההקשר כולו נכנס לקידומת אחת במטמון. החלוקה היא של המשימה: מעבר נפרד לכל פרק, עם כותרת הפרק וטווח הזמן ב־`title`. זה מקטין את "שטח החיפוש" לכל שאלה (לפי NoLiMa ו־Context Rot), וזה זול בזכות המטמון.
3. **סדר הפרומפט:** תמונות ואחריהן התמלול (בלוקים עם מזהים), ואחריהם ההוראות והשאלה בסוף. ההוראה "צטט קטעים לפני כל טענה" עוזרת כנגד Lost in the Middle.
4. **פלט "שורה לכל טענה" עם citation.** הקוד בונה JSON. טענה בלי citation מוסרת לפי מדיניות Anthropic.
5. **אימות דטרמיניסטי:** המזהה קיים. ‏`cited_text` או הציטוט תואם לתמלול בהתאמה עמומה מעל סף. הזמנים עולים בסדר. יש חפיפה לטווח ההצגה של השקופית כשמצוטטת שקופית.
6. **אימות במודל זול:** ‏Haiku 5.5 מקבל טענה יחד עם הקטעים המצוטטים ומחזיר "נתמכת", "חלקית" או "לא נתמכת", בשיטת CoVe (שאלות אימות שנענות בנפרד). עלות כ־$0.004 להרצאה. טענה שאינה נתמכת מוסרת או מסומנת.
7. **אורך הפלט:** תקציב טוקנים לכל חלק ופורמט קומפקטי. `max_tokens` גבוה (64K) כדי שהפלט לא ייחתך, כי ה־thinking נספר בתוכו.
8. **חותמות זמן מ־Gemini או מודל וידאו** משמשות לכל היותר רמז: לא מפרסמים אותן בלי יישור לקטע בתמלול, כלומר בלי מזהה.

### Gaps — פערים
- אין מדד מפורסם לדיוק citations של Claude על עברית או על תמלולי ASR רועשים.
- המספרים של CoVe ושל ALCE נמדדו על מודלים מ־2023. שיעור הטענות הלא נתמכות במודלי 5.5 על הרצאות לא נמדד, וצריך סט זהב פנימי.
- לא נמצאה מדידה בלתי תלויה של דיוק חותמות הזמן ב־Gemini 3.x/4 על הרצאות.

## 10. תפעול: זמני תגובה, מגבלות קצב לצוות קטן, שמירת נתונים ו־ZDR

### Takeaway — השורה התחתונה
המגבלות לא מגבילות צוות קטן. זמן התגובה ב־Batch הוא בדרך כלל פחות משעה (ועד 24 שעות). מבחינת פרטיות: ב־API, תוכן לא נשמר כברירת מחדל, חוץ מ־Fable 5.1 שנשמר 30 יום ואינו ZDR. ‏Batch שומר 29 יום, ו־Files API שומר עד מחיקה או תפוגה. ב־Gemini חובה Paid tier, ו־logging מופעל כברירת מחדל בפרויקטים חדשים ונשמר עד 55 יום.

### Cited Findings — ממצאים עם מקורות
- Batch: ‏"most batches completing within 1 hour". התוצאות זמינות כשהכל הסתיים או אחרי 24 שעות. בקשה שפג תוקפה לא מחויבת. — [Batch processing](https://platform.claude.com/docs/en/build-with-claude/batch-processing)
- מגבלות ב־Start tier: ‏Batch ‏1,000 RPM, ‏200,000 בקשות בתור ו־100,000 בקשות ב־batch. תקרת ההוצאה החודשית היא $500 ב־Start, ‏$1,000 ב־Build ו־$200,000 ב־Scale. "acceleration limits" חלות בעלייה חדה בשימוש. ‏`max_tokens` לא נכנס לחישוב ה־OTPM. — [Rate limits](https://platform.claude.com/docs/en/api/rate-limits)
- ספירת טוקנים: 5,000 RPM ב־Start. — [Token counting](https://platform.claude.com/docs/en/build-with-claude/token-counting). ‏Files: כ־500 RPM. — [Files API](https://platform.claude.com/docs/en/build-with-claude/files)
- שמירת נתונים ב־API: ‏"Conversation content (your prompts and Claude’s outputs) is not retained by default; the exception is Covered Models, which require 30-day retention". ‏Fable 5.1 (ו־Fable 5 ו־Mythos) "require 30-day data retention and are not available under ZDR unless expressly authorized". ‏"Retained data is never used for model training without your express permission". — [API and data retention](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention)
- לא ZDR: ‏Batch ("29-day retention; async storage required") ו־Files API ("retained until explicitly deleted or they reach their configured expiration"). ‏Prompt caching מכוסה ב־ZDR ("KV cache representations and cryptographic hashes are held in memory for the cache TTL"). — [API and data retention](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention)
- תוכן מסומן: "Anthropic may retain inputs and outputs for up to 2 years". מוצרי הצרכנים (Free, ‏Pro, ‏Max ו־Ultra), כולל Claude Code תחת מנויים אלה, אינם מכוסים ב־ZDR. — [API and data retention](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention)
- Structured outputs: ‏ZDR ‏"qualified", כי רק סכמת ה־JSON נשמרת במטמון עד 24 שעות. — [Structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)
- Gemini: ‏Paid לא משמש לשיפור מוצרים. ב־Unpaid יש שימוש בנתונים וקריאה אנושית. ‏logging מופעל כברירת מחדל ב־Interactions API ובפרויקטים שנוצרו מ־26/10/2026, ונשמר עד 55 יום (אפשר לבחור 7). — [Gemini API Terms](https://aistudio.google.com/docs/terms), [Data logging and sharing](https://aistudio.google.com/docs/logs-policy)
- Agent SDK: מוצרים של צד שלישי לא רשאים להציע התחברות ל־claude.ai או את מגבלות הקצב שלו. — [Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview)

### Inferences — הסקות
- **עומס:** גם 50 הרצאות ביום (כ־10M טוקני קלט ביום) רחוקות בסדרי גודל מ־2M ITPM. הצוואר האמיתי הוא תקרת ההוצאה ($500 בחודש ב־Start) ומגבלות ה־Evaluation tier בהתחלה.
- **זמן תגובה:** סינכרוני, הזמן נקבע בעיקר מייצור של כ־17–31K טוקני פלט. ב־Batch, בדרך כלל פחות משעה. ההצעה: מצב "עכשיו" (סינכרוני עם מטמון, Sonnet G ב־$0.58) ומצב "חצי מחיר" (Batch, ‏$0.29). זה תואם את ה־I3 הקיים ב־`llm.py`.
- **פרטיות:** לא להשתמש ב־Fable 5.1 לתוכן של משתמשים. להחליט במפורש אם 29 הימים של Batch מקובלים (אפשר "עכשיו" בלבד לתוכן רגיש). ב־Files API ‏`expires_in_seconds` ומחיקה בסוף. ב־Gemini רק Paid, עם יומן של 7 ימים או כבוי, ובלי Contributor Tier.
- **מסלול ה־CLI על מנוי Max** ‏(`SNB_LLM=cli`) כפוף לתנאי הצרכנים, בלי ZDR. ההנחיה ב־Agent SDK אוסרת להציע התחברות ל־claude.ai במוצרים של צד שלישי. זו החלטת מדיניות של המשתמש, ולא נבחנה כאן משפטית.

### Gaps — פערים
- מהירות הפלט (טוקנים לשנייה) לא מפורסמת, ולכן זמן התגובה הסינכרוני חייב מדידה.
- המגבלות של ה־Evaluation tier וקצב העלייה בין דרגות לא פורסמו.
- תקופת השמירה של יומני ניטור השימוש לרעה ב־Gemini Paid ("limited period") לא כמותית.
