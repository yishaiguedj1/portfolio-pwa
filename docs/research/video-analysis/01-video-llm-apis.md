# ממשקי API מסחריים ומודלים רב־מודאליים ל"צפייה" בהרצאות ארוכות (30–180 דק׳) — מצב ל־9/11/2026

> היקף: מי מקבל וידאו (תמונה + פסקול) ואיך, טוקניזציה ומגבלות, דיוק (חותמות זמן, OCR, עברית), מחיר לשעת וידאו, פלטפורמות וידאו ייעודיות, טבלאות מובילים ומצבי כשל — כדי להחליט מה קוראים מהצינור של THE SNOWBALL Studio ומה מריצים בעצמנו (CX53 בלי GPU).
> כל המחירים בדולר ארה״ב (USD) כפי שהופיעו בדפים הרשמיים ב־9/11/2026, אלא אם צוין אחרת. חישובי "מחיר לשעה" הם חישוב שלי מתוך המחירים הרשמיים (המקור מצוין ליד כל מחיר).
> הערת שיטה: תקציב החיפוש ברשת של הסשן נגמר באמצע המחקר; ההשלמות נעשו בשליפה ישירה של דפים רשמיים ידועים. כמה דפי מחיר רשמיים לא נטענו (Google Video Intelligence, Azure Video Indexer, Amazon Nova 2, ערכי Azure Content Understanding) — מסומנים ב־Gaps.

## 1. אילו מודלים וממשקים מקבלים וידאו באופן טבעי (נכון ל־11/2026)

### Takeaway
משפחת Google Gemini (מ־3.1 Flash-Lite ועד Gemini 4 Argon) היא היחידה בין מודלי החזית שמקבלת קובץ וידאו שלם **כולל הפסקול** בקריאה אחת, עם הקשר של ~מיליון טוקנים ומצב "agentic" חדש לסרטונים ארוכים (GA מ־9–10/2026). החלופות המסחריות שמעבדות תמונה + קול יחד הן Twelve Labs Pegasus 1.6 (בלי עברית) ו־Qwen3.8-Omni-Flash (עברית בקלט לא אומתה); OpenAI (GPT-6.x) ו־Anthropic (Claude 5.5) מקבלים רק תמונות, ו־Amazon Nova 2 ו־Qwen-VL מקבלים וידאו אבל מתעלמים מהאודיו.

### Cited Findings

**Google Gemini (Gemini Developer API / AI Studio, וגם Vertex = "Gemini Enterprise Agent Platform")**
- דף המודלים מונה כיציבים: `gemini-4-argon`, `gemini-3.8-flash`, `gemini-3.6-flash`, `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`; `gemini-3.1-pro-preview` ו־`gemini-3-flash-preview` עדיין preview; `gemini-2.5-pro` ו־`gemini-2.5-flash` מסומנים deprecated ומנותבים ב־1/12/2026 ל־`gemini-3.8-flash` ול־`gemini-3.5-flash-lite` בהתאמה; `gemini-2.5-flash-lite` "is not deprecated and will continue to be served until further notice" — [Gemini models](https://aistudio.google.com/docs/models); [Gemini changelog](https://aistudio.google.com/docs/changelog).
- תאריכי GA לפי ה־changelog הרשמי: 3.1 Pro Preview — 19/2/2026; 3.1 Flash-Lite GA — 7/5/2026; 3.6 Flash ו־3.5 Flash-Lite GA — 21/7/2026; 3.7 Flash GA — 13/8/2026 (הוצא משימוש ונותב ב־8/10/2026); 3.8 Flash GA — 2/9/2026; Gemini 4 Argon GA — 13/10/2026 — [Gemini changelog](https://aistudio.google.com/docs/changelog).
- Gemini 4 Argon (`gemini-4-argon`): קלט "Text, Image, Video, Audio, and PDF", חלון 1,048,576 טוקנים, פלט 65,536 כברירת מחדל (עד 1,048,576 ב־long decode), "Agentic video understanding (defaults to static)", caching משתמע בלבד; "Latest update: October 2026" — [Gemini 4 Argon model page](https://aistudio.google.com/docs/models/gemini-4-argon). הוכרז 30/9/2026 בשחרור מוגבל ("rolling out to a set of trusted cyber defenders through our Fairwind Program") — [Google blog, 30/9/2026](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-4-argon/?hl=en); [VentureBeat](https://venturebeat.com/technology/google-unveils-gemini-4-argon-retaking-benchmark-lead-over-openai-and-anthropic-but-in-limited-release).
- Gemini 3.8 Flash (`gemini-3.8-flash`): קלט Text/Image/Video/Audio/PDF, 1,048,576 קלט / 65,536 פלט, thinking ברמות low/medium/high ("`minimal` is not supported and returns an error"), "Latest update: September 2026" — [Gemini 3.8 Flash page](https://aistudio.google.com/docs/models/gemini-3.8-flash).
- Gemini 3.5 Flash-Lite (`gemini-3.5-flash-lite`): אותן מודאליות ואותו חלון, "optimized for high-throughput, low-cost execution", "Latest update: July 2026" — [Gemini 3.5 Flash-Lite page](https://aistudio.google.com/docs/models/gemini-3.5-flash-lite).
- מצב **agentic**: "an opt-in mode where the model dynamically explores the video timeline", "selectively inspecting transcripts and adaptively adjusting frame rates and resolution on the fly"; נתמך ב־"Gemini 4 Argon, 3.8 Flash, 3.6 Flash, and 3.5 Flash Lite" — [Gemini video understanding](https://aistudio.google.com/docs/video-understanding). שוחרר 1/9/2026 (ל־3.7/3.6 Flash ו־3.5 Flash-Lite) — [Gemini changelog](https://aistudio.google.com/docs/changelog). ב־Google Cloud: "Generally available, and off by default"; מפעילים ב־`media_processing="agentic"` — [Gemini 4 Argon on Google Cloud](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/guides/gemini-4-argon).
- סתירה בתיעוד: דף המודל של 3.8 Flash לא מונה "agentic video understanding" ביכולות — [Gemini 3.8 Flash page](https://aistudio.google.com/docs/models/gemini-3.8-flash) — בעוד דף הווידאו והמחברת הרשמית משתמשים ב־3.8 Flash במצב agentic — [Gemini video understanding](https://aistudio.google.com/docs/video-understanding); [Gemini cookbook — Video_understanding.ipynb](https://raw.githubusercontent.com/google-gemini/cookbook/refs/heads/main/quickstarts/Video_understanding.ipynb).

**OpenAI**
- "All latest OpenAI models support text and image input, text output" — אף מודל ברשימה (כולל Realtime ו־Live) לא מתואר כמקבל וידאו — [OpenAI models](https://developers.openai.com/api/docs/models).
- GPT-6 Astra (`gpt-6-astra`): קלט text + image בלבד; נקודות הקצה Videos ו־Realtime "Not supported"; חלון 1,050,000, קלט מרבי 922,000, פלט 128,000; knowledge cutoff 30/4/2026 — [GPT-6 Astra](https://developers.openai.com/api/docs/models/gpt-6-astra). GPT-6.1 Sol ו־GPT-6 Luna — גם הם text + image בלבד — [GPT-6.1 Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol); [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna).
- בדיקה מעשית (11/9/2026): "The API rejects an mp4, whether sent as a video part or as a file" — הפתרון: פריימים כ־`input_image` עם חותמת זמן בטקסט שלפני כל פריים ("Frame at t=0.2s:") — [Roboflow](https://roboflow.com/blog/gpt6-astra-video-understanding).
- מודלי Realtime (`gpt-realtime-2.1` ואחרים) מתומחרים לקלט Image ($5.00 ל־1M) — אין סוג קלט וידאו — [OpenAI pricing](https://developers.openai.com/api/docs/pricing).

**Anthropic Claude**
- "All current models support text and image input, text output" — Fable 5.1, Opus 5.5, Sonnet 5.5, Haiku 5.5; כולם 1M הקשר, 128K פלט — [Claude models overview](https://platform.claude.com/docs/en/about-claude/models/overview). פורמטים: JPEG/PNG/GIF/WebP; "Animations are unsupported, and only the first frame is used" — [Claude vision](https://platform.claude.com/docs/en/build-with-claude/vision). כלומר אין קלט וידאו או אודיו.
- Claude Opus 5.5 שוחרר 22/9/2026 — [Anthropic news](https://www.anthropic.com/news/claude-opus-5-5).

**Amazon Nova (Bedrock)**
- Nova 2 Lite: "comprehend and analyze images, documents, videos, and speech", אבל בווידאו: "No audio support: ... Audio tracks in videos are not processed or analyzed." — [Nova 2 multimodal guide](https://docs.aws.amazon.com/nova/latest/nova2-userguide/using-multimodal-models.html). שוחרר 2/12/2025 עם חלון של מיליון טוקנים — [AWS blog, 2/12/2025](https://aws.amazon.com/blogs/aws/introducing-amazon-nova-2-lite-a-fast-cost-effective-reasoning-model/).
- דף המודלים מציג (11/2026) את Nova 2 Lite, Nova 2.5 Sonic (דיבור) ו־Nova Multimodal Embeddings (טקסט/מסמכים/תמונות/וידאו/אודיו) — בלי Nova 2 Pro/Omni/Premier — [Amazon Nova models](https://aws.amazon.com/nova/models/). בדור 1: Nova Premier דוגם 1 fps עד 3,200 פריימים — [Nova v1 video](https://docs.aws.amazon.com/nova/latest/userguide/modalities-video.html).

**Twelve Labs**
- Pegasus 1.6 (6/10/2026): "A video-to-text model that returns time-coded JSON", מעבד "visual and audio content" — [Twelve Labs release notes](https://docs.twelvelabs.io/docs/release-notes); [Pegasus 1.6 spec](https://docs.twelvelabs.io/v1.3/docs/concepts/models/pegasus/pegasus-1-6.md); [Pegasus page](https://www.twelvelabs.io/pegasus). Pegasus 1.2 הוסר 18/8/2026 ("Use Pegasus 1.5 for all video analysis"); Marengo 3.5 (31/8/2026) — הטמעות בלבד, "does not support search" (לחיפוש — Marengo 3.0) — [Twelve Labs release notes](https://docs.twelvelabs.io/docs/release-notes).

**Alibaba Qwen (Model Studio)**
- וידאו כקובץ (`video_url`) או כרשימת פריימים; סדרות Qwen3.6/3.7/3.8 ו־qwen3-vl-plus; "the model does not understand the video's audio track" — [Qwen vision](https://www.alibabacloud.com/help/en/model-studio/vision).
- Qwen-Omni: "supports audio in the video"; משך מרבי: Qwen3.8-Omni-Flash — שעתיים, Qwen3.5-Omni — שעה, Qwen3-Omni-Flash — 150 שניות — [Qwen-Omni](https://www.alibabacloud.com/help/en/model-studio/qwen-omni).

**ByteDance Seed**
- Seed2.1 (תאריך לא מצוין בדף): מטפל ב־"complex visual and video content" ומשפר "hour-long video processing"; API של גרסת Turbo (`dola-seed-2-1-turbo`) ב־BytePlus ARK; אודיו לא מוזכר; מחיר לא מוזכר — [Seed2.1](https://seed.bytedance.com/en/seed2_1). SeedRealtime ("Audio-Visual Full-Duplex LLM") פורסם 5/8/2026 — [Seed](https://seed.bytedance.com/en/). דוח Seed1.5-VL — 11/5/2025 — [arXiv 2505.07062](https://arxiv.org/abs/2505.07062).

**Zhipu (Z.ai)**
- GLM-4.6V: קלט "Video / Image / Text / File", חלון 128K, "a one-hour video in a single inference pass"; אודיו לא מוזכר — [GLM-4.6V](https://docs.z.ai/guides/vlm/glm-4.6v).

**Moonshot Kimi**
- `kimi-k3.1-pro` ו־`kimi-k3`: "native visual understanding", חלון 1M; קלט וידאו לא מצוין; `kimi-k2.5` מסומן Deprecated — [Kimi models](https://platform.kimi.ai/docs/models.md).

**xAI / Mistral / Reka**
- xAI: מודלי Grok 4.x עם קלט תמונה; אף מודל לא מוצהר כמקבל וידאו (מודלי הווידאו הם ליצירה — grok-imagine-video) — [xAI models](https://docs.x.ai/docs/models).
- Mistral: Vision רק לתמונות (Mistral Large 3, Medium 3.1, Small 3.2, Ministral 3) — [Mistral vision](https://docs.mistral.ai/capabilities/vision/).
- Reka: מודלים שמונים `video` ב־`input_modalities` מקבלים `video_url` (למשל `reka-edge-2603`, `qwen3.8-27b`); "The URL must be publicly downloadable; sites such as YouTube block direct downloads" — [Reka multimodal](https://docs.reka.ai/chat/multimodal); "Send images and short videos alongside text" — [Reka docs](https://docs.reka.ai/).

### Inferences
- לניתוח הרצאה שלמה בקריאה אחת עם תמונה + קול — Gemini הוא הספק החזיתי היחיד; כל השאר מחייבים לבנות "וידאו → פריימים + תמלול" בעצמנו. זה דווקא מתאים לשרת שלנו (ffmpeg + ivrit-ai/faster-whisper כבר רצים ב־CX53).
- Twelve Labs ו־Qwen-Omni הן חלופות משנה בלבד עבורנו: Pegasus לא תומך בעברית; ל־Qwen-Omni אין אימות לעברית בקלט.
- Nova 2 ו־Qwen-VL "רואים" בלי לשמוע — בהרצאה, שבה רוב המידע בדיבור, הם שימושיים רק בצירוף תמלול שלנו.
- ה־API של Gemini משתנה מהר (Interactions API, `processing`/`media_processing`, הוצאת 2.5 משימוש ב־1/12/2026) — כדאי לנעול מזהי מודל מפורשים ולבדוק את ה־changelog לפני כל פריסה.

### Gaps
- Meta (Llama API) לא נבדק — אין מקור.
- סטטוס Nova 2 Pro / Nova 2 Omni (הוכרז ב־preview ב־12/2025 לפי קישור בבלוג AWS) — לא נמצא דף עדכני.
- Seed2.1: תאריך שחרור, מחיר API ותמיכה באודיו — לא מצוינים.
- Kimi K3/K3.1: אין תיעוד שמאשר או שולל קלט וידאו.

## 2. טוקניזציה, מגבלות, דרכי קלט, אודיו + תמונה, חותמות זמן, OCR ועברית

### Takeaway
ב־Gemini 3/4 ברירת המחדל היא פריים לשנייה ב־70 טוקנים + 32 טוקני אודיו לשנייה (≈102 טוקנים לשנייה ≈ 367K לשעה ⇒ כ־2:50 שעות בחלון של 1,048,576 טוקנים; ב־high — 280 טוקנים לפריים — כ־56 דקות בלבד; חישוב שלי, בלי טוקני חותמות הזמן — ההצהרה הרשמית "3 שעות / שעה" מתאימה לערכי 66/258 של Gemini 2.5), עם fps וחיתוך שניתנים לשליטה (רק במצב static); YouTube ציבורי בלבד. ההנחיה הרשמית לטקסט צפוף על המסך היא `high` (280 טוקנים לפריים), ואצל ספקים אחרים הפריים מוקטן ל־512×512 (Azure) או 672×672 (Nova) — טקסט קטן הולך לאיבוד; לעברית יש תמיכה רשמית רק ב־Gemini וב־Azure Video Indexer, ואין מדד עברי ציבורי לאף מודל.

### Cited Findings

**Gemini — טוקניזציה**
- דף הווידאו: ברירת מחדל 1 FPS; "If `media_resolution` is set to low, frames are tokenized at 66 tokens per frame. Otherwise, frames are tokenized at 258 tokens per frame."; אודיו "32 tokens per second", "processed at 1Kbps (single channel)"; "Approximately 100 tokens per second of video at default (low) media resolution, or approximately 300 tokens per second ... at high"; "Timestamps are added every second" — [Gemini video understanding](https://aistudio.google.com/docs/video-understanding).
- **סתירה**: דף media resolution קובע ל־Gemini 4 ו־Gemini 3: וידאו `unspecified`/`low`/`medium` = 70 טוקנים לפריים, `high` = 280, `ultra_high` לא זמין לווידאו; "Use `high` (280 tokens per frame) only when reading dense text (OCR) or small details" — [Gemini media resolution](https://aistudio.google.com/docs/media-resolution). Vertex מאשר: Gemini 3 — 70/280; "Earlier models: Default is 258 tokens per frame, and low resolution is 66" — [Vertex video understanding](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/video-understanding). מסקנה: 66/258 הם ערכי Gemini 2.5; 70/280 — Gemini 3.x/4.
- דוח Gemini 2.5: המודלים אומנו לעבוד עם 66 במקום 258 טוקנים לפריים, "enabling using about 3 hours of video instead of 1h within a 1M tokens context window" — [Gemini 2.5 technical report](https://arxiv.org/html/2507.06261).
- אורך מרבי: "Models with a 1M context window can process videos up to 3 hours long by default (at low media resolution), or up to 1 hour long at high media resolution" — [Gemini video understanding](https://aistudio.google.com/docs/video-understanding). **סתירה**: ב־Vertex כתוב ל־Gemini 3.x/4 ול־2.5 "Video with audio is about 45 minutes and video without audio is about 1 hour", עד 10 סרטונים בבקשה — [Vertex video understanding](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/video-understanding).
- fps וחיתוך: `"processing": {"type": "static", "fps": 0.5}`; `start_offset`/`end_offset` כמחרוזות שניות ("1200s"); "Both customizations work only in static mode" — [Gemini video understanding](https://aistudio.google.com/docs/video-understanding). במחברת הרשמית: "Video metadata features (`fps` and clipping offsets) are not yet supported in the Interactions API" — שם עוברים ל־`generate_content` — [Gemini cookbook](https://raw.githubusercontent.com/google-gemini/cookbook/refs/heads/main/quickstarts/Video_understanding.ipynb).
- מצב agentic: "typically uses up to 88% fewer total tokens than static processing for long-form content"; "frames, audio, and transcript loaded on demand are accounted as tool use tokens (`total_tool_use_tokens`)"; "navigation may increase Time to First Token (TTFT) and total token usage on short clips (<5 minutes)" — [Gemini video understanding](https://aistudio.google.com/docs/video-understanding). המחברת: "Up to 88% more token-efficient and ~7% higher quality on long-form content" (טענת יצרן בלי שיטת מדידה) — [Gemini cookbook](https://raw.githubusercontent.com/google-gemini/cookbook/refs/heads/main/quickstarts/Video_understanding.ipynb).

**Gemini — דרכי קלט ומגבלות קבצים**
- טבלת הקלט: File API — "20GB (paid) / 2GB (free)"; Cloud Storage registration — 2GB לקובץ; inline — "< 100MB" (אבל בטקסט: "shorter videos under 20MB total request size"); YouTube URLs — [Gemini video understanding](https://aistudio.google.com/docs/video-understanding). **סתירה**: דף Files קובע "per-file maximum size of 2 GB", "store up to 20 GB of files per project", "Files are stored for 48 hours", חינם — [Gemini Files API](https://aistudio.google.com/docs/files). העלאת inline הוגדלה מ־20MB ל־100MB ב־8/1/2026 (כולל מקורות Cloud Storage ו־pre-signed URL) — [Gemini changelog](https://aistudio.google.com/docs/changelog).
- Vertex: קובץ מ־Cloud Storage עד "2 GiB minus 500 KiB"; URL ציבורי עד 15 MiB; inline עד 256 MB ב־Gemini 3+; מטען בקשה עד 500 MiB — [Vertex video understanding](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/video-understanding).
- YouTube (Developer API): "The YouTube URL feature is in preview and is available at no charge" + "Pricing and rate limits are likely to change"; בחינם עד 8 שעות וידאו YouTube ביום, בתשלום "no limit based on video length"; עד 10 סרטונים בבקשה מ־Gemini 2.5 והלאה; "You can only upload public videos (not private or unlisted videos)" — [Gemini video understanding](https://aistudio.google.com/docs/video-understanding). ב־Vertex: "Only one YouTube video URL is supported per request", ציבורי או בבעלות החשבון המחובר — [Vertex video understanding](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/video-understanding).
- פורמטים: mp4, mpeg, mov, avi, x-flv, mpg, webm, wmv, 3gpp — [Gemini video understanding](https://aistudio.google.com/docs/video-understanding). עיבוד אחרי העלאה: "This can take a couple of minutes as the videos will need to be processed and tokenized" — [Gemini cookbook](https://raw.githubusercontent.com/google-gemini/cookbook/refs/heads/main/quickstarts/Video_understanding.ipynb).

**Gemini — אודיו + תמונה וחותמות זמן**
- "Visual and audio content are both processed"; בהנחיה מפנים לרגע בפורמט `MM:SS` — [Gemini video understanding](https://aistudio.google.com/docs/video-understanding). Vertex: "`MM:SS` at 1 FPS or below, and `MM:SS.sss` above 1 FPS", ותחילית שעות מעל שעה — [Vertex video understanding](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/video-understanding).
- Gemini 2.5 Pro "is able to consistently recall a 1 second visual event out of a full 46-minute video"; QVHighlights (moment retrieval) — 2.5 Pro 75.0 מול GPT-4.1 71.4 (דוח 6–7/2025) — [Gemini 2.5 technical report](https://arxiv.org/html/2507.06261).
- במחברת הרשמית (3.8 Flash) אותו קטע מקבל גבולות שונים במצב static וב־agentic (למשל `03:22 - 04:22` מול `03:40 - 04:21`), וה־agentic מוצג כ־"sub-second accuracy" בלי מדידה — [Gemini cookbook](https://raw.githubusercontent.com/google-gemini/cookbook/refs/heads/main/quickstarts/Video_understanding.ipynb).

**OpenAI — פריימים כתמונות**
- עד "1,500 images per request", עד 512 MB למטען; טלאים של 32×32 פיקסלים כפול מכפיל 1.2 ל־`gpt-6-astra`/`gpt-5.6-*`/`gpt-5.5`/`gpt-5.4`; `high` ב־GPT-6 Astra עד 2,500 טלאים (1024×1024 ≈ 1,229 טוקנים); רמות `low`/`high`/`original`/`auto` — [OpenAI images & vision](https://developers.openai.com/api/docs/guides/images-vision).
- מגבלות מוצהרות: "Enlarge text within the image to improve readability", טקסט מסובב, "non-Latin text" — [OpenAI images & vision](https://developers.openai.com/api/docs/guides/images-vision).
- ניסוי Roboflow (11/9/2026): פריים 768×432 ≈ 425 טוקנים; זיהוי אירועים "all within 0.3 s of what we could see in the frames" ב־3 fps, אבל "Below 4 fps the model misses a point" בספורט; 112 פריימים ל־11 דקות בבקשה אחת — [Roboflow](https://roboflow.com/blog/gpt6-astra-video-understanding).

**Claude — פריימים כתמונות**
- עד 600 תמונות לבקשה (100 במודלים עם 200K הקשר), עד 8000×8000; מעל 20 תמונות חל סף מחמיר (לשמור ≤3,000 px לצלע); עד 10 MB לתמונה; בקשה עד 128 MB (Files API מומלץ) — [Claude vision](https://platform.claude.com/docs/en/build-with-claude/vision).
- עלות: `⌈width/28⌉ × ⌈height/28⌉` טוקנים; רמת High-resolution ("Claude 4.7 and later models") עד 2,576 px ו־4,784 טוקנים, Standard עד 1,568 px / 1,568 טוקנים; 1920×1080 = 2,691 טוקנים ב־high-res — [Claude vision](https://platform.claude.com/docs/en/build-with-claude/vision).
- "Text: If the image contains important text, make sure it's legible and not too small"; "heavy JPEG compression can make text difficult to read"; "might hallucinate ... very small images under 200 pixels" — [Claude vision](https://platform.claude.com/docs/en/build-with-claude/vision).

**Amazon Nova 2 Lite**
- כל פריים מוקטן "with distortion" ל־672×672; 1 FPS עד 16 דקות, ומעבר לכך "maintain a consistent 960 frames"; המלצה: פחות משעה לתנועה איטית, פחות מ־16 דק׳ לתנועה מהירה; 25 MB inline / 1 GB מ־S3, סרטון אחד בבקשה; 10 שניות ≈ 2,880 טוקנים (≈288 לפריים) — [Nova 2 multimodal guide](https://docs.aws.amazon.com/nova/latest/nova2-userguide/using-multimodal-models.html). **סתירה פנימית**: טבלת הטוקנים באותו דף מראה 1 fps גם ל־20/30/45 דקות (1,200/1,800/2,700 פריימים) — שם.
- מגבלות: "limited understanding of multilingual images and video frames and can struggle or hallucinate"; טקסט קטן — לחתוך ולהגדיל — [Nova 2 multimodal guide](https://docs.aws.amazon.com/nova/latest/nova2-userguide/using-multimodal-models.html).

**Qwen (Model Studio)**
- `fps` בטווח [0.1, 10], ברירת מחדל 2.0; גבולות: Qwen3.5–3.8 — 2 שנ׳ עד 2 שעות, עד 2 GB, 4–8,000 פריימים; qwen3-vl-plus — עד שעה, 4–2,000 פריימים; עד 64 סרטונים בבקשה; טוקן = 32×32 פיקסלים, פריימים בזוגות: `ceil(frames/2) × (h/32) × (w/32) + 2`; "Larger video files do not result in better understanding"; קריאה לא־זורמת נקטעת אחרי 300 שניות — [Qwen vision](https://www.alibabacloud.com/help/en/model-studio/vision).
- Qwen-Omni: אודיו 7 טוקנים לשנייה (3.8-Omni-Flash, 3.5-Omni); וידאו 2 fps עד 2,048 פריימים; "stable results with input sampled at up to 15 fps" — [Qwen-Omni](https://www.alibabacloud.com/help/en/model-studio/qwen-omni).
- Qwen3-VL (דוח 26/11/2025): מעבר מ־T-RoPE ל־"explicit textual timestamps" לעיגון זמן מדויק יותר; 100% ב־needle-in-a-haystack בווידאו עד 30 דקות (256K), 99.5% עד ~1M עם YaRN — [Qwen3-VL report](https://arxiv.org/abs/2511.21631); [PDF v2](https://arxiv.org/pdf/2511.21631v2).

**Twelve Labs Pegasus 1.6**
- עד שעתיים לניתוח ("up to 4 hours when you analyze only a portion"), עד 10 GB, רזולוציה 360×360–5184×2160; חלון 261,120 טוקנים שכולל וידאו, "audio transcription", הנחיה ופלט — [Pegasus 1.6 spec](https://docs.twelvelabs.io/v1.3/docs/concepts/models/pegasus/pegasus-1-6.md). ניתוח סינכרוני עד שעה; חלון ניתוח עד שעתיים (מ־10/9/2026); Marengo 3.5 בלי מגבלת משך, Marengo 3.0 עד 4 שעות — [Twelve Labs release notes](https://docs.twelvelabs.io/docs/release-notes).
- חותמות זמן: `analysis_mode: "time_based_metadata"` מחזיר `start_time`/`end_time`, `min_segment_duration`; פלט `segment_definitions` ב־JSON — [Pegasus concepts](https://docs.twelvelabs.io/docs/concepts/models/pegasus). כתובות URL: "Video hosting platforms and cloud storage sharing links are not supported" — [Pegasus 1.6 spec](https://docs.twelvelabs.io/v1.3/docs/concepts/models/pegasus/pegasus-1-6.md).

**OCR — מספרים השוואתיים (נובמבר 2025)**
- טבלת דוח Qwen3-VL: OCRBench — Qwen3-VL-235B 875 (thinking) / 920 (instruct); Gemini 2.5 Pro 866 / 872; GPT-5 810 (high) / 787 (minimal); Claude Opus 4.1 764 / 750. CC-OCR — 81.5/82.2; 77.2/76.8; 68.3/66.1; 69.1/66.0 — [Qwen3-VL report PDF](https://arxiv.org/pdf/2511.21631v2). (מדדי תמונה, לא וידאו; דור מודלים קודם.)
- בהערכת Gemini 3 Pro, Video-MMMU חושב "with the recommended setting using media_resolution=HIGH (280 tokens per frame)" — [Gemini 3 Pro evaluation methodology](https://storage.googleapis.com/deepmind-media/gemini/gemini_3_pro_model_evaluation.pdf).

**עברית**
- Gemini: "All Gemini models can understand the following languages" — הרשימה כוללת "Hebrew (`iw`)" — [Vertex models & languages](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/models).
- Claude: טבלת Global-MMLU (Opus 5.5 ואחרים) לא כוללת עברית; "Claude is capable in many languages beyond those benchmarked" — [Claude multilingual support](https://platform.claude.com/docs/en/build-with-claude/multilingual-support).
- Twelve Labs Pegasus 1.6: תמיכה מלאה — אנגלית; חלקית — 12 שפות (ערבית, סינית, צרפתית, גרמנית, איטלקית, יפנית, קוריאנית, פורטוגזית, רוסית, ספרדית, תאית, וייטנאמית); עברית לא ברשימה — [Pegasus 1.6 spec](https://docs.twelvelabs.io/v1.3/docs/concepts/models/pegasus/pegasus-1-6.md).
- Azure Video Indexer: עברית (`he-IL`) נתמכת כשפת מקור לתמלול/תרגום/חיפוש, בזיהוי שפה ובהתאמת מודל שפה — [Azure Video Indexer language support](https://learn.microsoft.com/en-us/azure/azure-video-indexer/language-support).
- Qwen-Omni: עברית מופיעה רק ברשימת שפות הפלט של Qwen3.5-Omni; לקלט אודיו ב־Qwen3.8-Omni-Flash מוזכרת רשימה של 113 שפות שלא הוצגה — [Qwen-Omni](https://www.alibabacloud.com/help/en/model-studio/qwen-omni).
- תצפית פנימית בריפו (10/2026): תשובות Gemini Flash-Lite בעברית הכילו לפעמים אותיות ערביות ("חפير"), ולכן נוסף מסנן `badScript` ותיקון `fixScript` — [ibkr-proxy/lib/gmodels.js](../../../ibkr-proxy/lib/gmodels.js).

### Inferences
- חשבון אצבע ל־Gemini 3/4 (static, 1 fps): 70+32 = 102 טוקנים לשנייה ⇒ שעה ≈ 367K, 3 שעות ≈ 1.1M (גבולי מול 1,048,576 — הרצאה של 180 דק׳ צריכה fps<1 או פיצול לשני חלקים). ב־`high`: 312 טוקנים לשנייה ⇒ שעה ≈ 1.12M — לא נכנס בבקשה אחת; לכן ל־OCR של שקפים עדיף `high` עם fps נמוך (0.2 ⇒ 88 טוקנים לשנייה ≈ 317K לשעה) או שקפים נבחרים כתמונות בודדות ב־`high` (1,120 טוקנים) — חישוב שלי מהנתונים לעיל.
- האודיו ב־Gemini מעובד ב־1Kbps ערוץ אחד — כמעט בוודאות פחות מדויק לתמלול עברית מ־ivrit-ai על האודיו המקורי; כדאי להעביר ל־Gemini גם את התמלול שלנו כטקסט (זול: שעה ≈ 10–15K טוקנים) ולבקש ממנו להיצמד אליו — הסקה, דורשת בדיקה.
- חותמות זמן: ב־static הדגימה היא 1 fps וחותמת לכל שנייה ⇒ דיוק תאורטי ±1 שנ׳; בפועל אין מדידה רשמית לדיוק ב־MM:SS לאורך 1–3 שעות. בצינור שלנו אפשר לעגן כל טענה לחותמות של התמלול (מילה־מילה מ־faster-whisper) ולשקף שנבחר — דטרמיניסטי ולא תלוי במודל.
- לצינור GPT/Claude: הזרקת חותמת זמן בטקסט לפני כל פריים היא השיטה המתועדת (Roboflow) — ומספרי פריים/זמן מפורשים משפרים עיגון זמן גם במחקר (ראו NumPro בסעיף 6).
- עברית על המסך (שקפים בעברית): אף ספק לא מפרסם מדד OCR עברי; OpenAI מזהיר במפורש על "non-Latin text", ו־Nova על "multilingual images". חובה סט בדיקה פנימי לפני בחירה.

### Gaps
- לא נמצא מדד רשמי לדיוק חותמות זמן (MM:SS) של Gemini 3.x/4 בהרצאות ארוכות, ולא מדידה בלתי תלויה לטענות "88% fewer tokens" ו־"~7% higher quality" של agentic.
- לא נמצא מדד ציבורי ל־OCR עברי (שקפים) או לתמלול עברי בתוך Gemini/Qwen-Omni.
- כמה טוקנים מוסיפה "המטא־דאטה" (חותמות הזמן) של Gemini לכל שנייה — לא מפורט.
- מגבלות בקשה/משך ב־GLM-4.6V (מעבר ל־"one-hour video") ומחיר טוקני וידאו בו — לא מפורטים.

## 3. מחיר לשעת וידאו, הנחות (Batch/Flex), מטמון, שכבות חינם, מגבלות קצב ותנאי פרטיות

### Takeaway
שעת הרצאה ב־Gemini 3.8 Flash ברזולוציית ברירת מחדל עולה כ־$0.28 קלט עד 31/12/2026 (וכ־$0.55 מ־1/1/2027), ב־3.5/3.1 Flash-Lite כ־$0.11–0.12, וב־Gemini 4 Argon כ־$0.73 עד 30/11/2026 (וכ־$1.47 מ־1/12/2026); Batch/Flex חוסכים 50%. מסלול "פריימים נבחרים + תמלול שלנו" ב־Claude/OpenAI זול מאוד כשהפריימים מצומצמים לשקפים (Haiku 5.5 ≈ $0.09, Sonnet 5.5 ≈ $0.35, GPT-6 Luna ≈ $0.01 לשעה), ו־Twelve Labs Pegasus 1.6 עולה $1.75 לשעה; בשכבה החינמית של Gemini התוכן משמש לשיפור מוצרי Google — לא מתאים לסרטוני משתמשים.

### Cited Findings

**מחירון Gemini Developer API (Standard, נבדק 9/11/2026)**
- `gemini-4-argon`: קלט "$2.00 through November 30, 2026" → "$4.00 starting December 1, 2026"; פלט $10.00 → $20.00; cached $0.10 → $0.20, "Implicit caching only"; "not available on the Free tier"; "Every token the model processes is counted and billed, including thinking tokens" — [Gemini pricing](https://aistudio.google.com/docs/pricing). התמחור ההיכרותי וה־95% הנחה על cached input — [Google blog, 30/9/2026](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-4-argon/?hl=en).
- `gemini-3.8-flash` ו־`gemini-3.6-flash`: קלט "$0.75 through December 31, 2026" → "$1.50 starting January 1, 2027"; פלט $3.75 → $7.50; Free tier: "Free of charge"; "Used to improve our products": Free — Yes, Paid — No — [Gemini pricing](https://aistudio.google.com/docs/pricing). Flex: קלט $0.375 → $0.75, פלט $1.875 → $3.75 — שם. caching $0.075 → $0.15 + אחסון $0.50 → $1.00 לשעה ל־1M טוקנים — שם.
- `gemini-3.5-flash-lite`: "$0.30 (text / image / video / audio)", פלט $2.50, Batch קלט $0.15 / פלט $1.25, Flex קלט $0.15 — [Gemini pricing](https://aistudio.google.com/docs/pricing).
- `gemini-3.1-flash-lite`: "$0.25 (text / image / video)" ו־"$0.50 (audio)", פלט $1.50; Batch/Flex חצי — [Gemini pricing](https://aistudio.google.com/docs/pricing).
- `gemini-3.1-pro-preview`: "$2.00, prompts <= 200k tokens" / "$4.00, prompts > 200k tokens"; פלט $12 / $18; אין Free tier — [Gemini pricing](https://aistudio.google.com/docs/pricing).
- `gemini-3-flash-preview` (שוחרר 17/12/2025): $0.50 קלט טקסט/תמונה/וידאו, $1.00 אודיו, $3 פלט — [Gemini pricing](https://aistudio.google.com/docs/pricing); [Google blog, 17/12/2025](https://blog.google/products/gemini/gemini-3-flash/).
- `gemini-2.5-flash-lite` (טוקניזציה 66/258): $0.10 טקסט/תמונה/וידאו, $0.30 אודיו, $0.40 פלט — [Gemini pricing](https://aistudio.google.com/docs/pricing).
- Live API (`gemini-3.8-live`): וידאו/תמונה "$1.00 or $0.002/min", אודיו "$3.00 or $0.005/min" — [Gemini pricing](https://aistudio.google.com/docs/pricing). שירות תמלול `gemini-3.5-transcribe`: "$0.003/min" אודיו + "$0.002/min" טקסט — שם.
- Gemini Embedding 2 לווידאו: $12.00 ל־1M (~$0.00079 לפריים), Batch $6.00 — [Gemini pricing](https://aistudio.google.com/docs/pricing).
- Flex ו־Priority הוכנסו ב־1/4/2026; לתמחור היכרותי של 3.7 Flash עד 31/12/2026 (הוכרז 13/8/2026) — [Gemini changelog](https://aistudio.google.com/docs/changelog).

**Batch, מטמון, Files, מגבלות קצב — Gemini**
- Batch: "50% of the standard cost", "target turnaround time is 24 hours", קובץ JSONL עד 2GB, מאפשר להפנות לקבצים שהועלו, "Context caching is supported for batch requests", משימות שממתינות מעל 48 שעות פגות — [Gemini Batch API](https://aistudio.google.com/docs/batch-mode).
- מטמון: "Implicit caching is enabled by default for all Gemini 2.5 and newer models"; explicit caching לא זמין ב־Interactions API ולא ב־Gemini 4 Argon; סף מינימום 4,096 טוקנים ל־Argon/3.8/3.6/3.1 Pro; "put large, common content at the start of the prompt" — [Gemini caching](https://aistudio.google.com/docs/caching).
- תורי Batch (enqueued tokens) ב־Tier 1: Argon 5M, 3.8/3.6 Flash 3M, 3.5/3.1 Flash-Lite 10M; Tier 2 = "Paid $100 + 3 days", Tier 3 = "Paid $1,000 + 30 days" — [Gemini rate limits](https://aistudio.google.com/docs/rate-limits).
- מדידה פנימית בריפו (10/2026): במכסה החינמית ~20 בקשות ביום ל־Flash ו־~500 ל־Flash-Lite — [ibkr-proxy/lib/gmodels.js](../../../ibkr-proxy/lib/gmodels.js).

**פרטיות — Gemini**
- Unpaid Services: "Google uses the content you submit to the Services and any generated responses to provide, improve, and develop..." ו־"human reviewers may read, annotate, and process your API input and output"; "Do not submit sensitive, confidential, or personal information to the Unpaid Services". Paid Services: "Google doesn't use your prompts ... or responses to improve our products", לוגים "for a limited period of time" לאיתור הפרות; בתוקף מ־23/3/2026 — [Gemini API terms](https://aistudio.google.com/docs/terms).

**OpenAI (נבדק 9/11/2026)**
- GPT-6 Astra: $10 קלט / $1 cached / $50 פלט; Batch ו־Flex — 50%; "Fast mode: 2x"; "Prompts over 272K input tokens: 2x input and cache rates, and 1.5x output for the full request" — [GPT-6 Astra](https://developers.openai.com/api/docs/models/gpt-6-astra). GPT-6.1 Sol: $2 / $0.10 / $10 — [GPT-6.1 Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol). GPT-6 Luna: $0.10 / $0.01 / $0.50, knowledge cutoff 18/5/2026 — [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna).
- "Priority processing was renamed Fast mode on July 30, 2026"; תמלול: `gpt-transcribe` $0.0045 לדקה, `gpt-4o-transcribe` $0.006 — [OpenAI pricing](https://developers.openai.com/api/docs/pricing).
- פרטיות: "data sent to the OpenAI API is not used to train or improve OpenAI models" (אלא אם בוחרים); לוגים "retained for up to 30 days"; ZDR "subject to prior approval" — [OpenAI your data](https://developers.openai.com/api/docs/guides/your-data).

**Anthropic Claude (נבדק 9/11/2026)**
- Opus 5.5: $4 / $20; Sonnet 5.5: $2 / $10; Haiku 5.5: $0.10 / $0.50 עד 100,000 טוקנים בהנחיה ו־$0.50 / $2.50 מעל 100,000 (המחיר הגבוה חל על כל הבקשה); Batch — 50%; cache hit ב־Opus/Sonnet 5.5 = 5% ממחיר הקלט — [Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing).
- דוגמה רשמית: תמונה 1000×1000 ב־Opus 5.5 ≈ $5.18 לאלף תמונות; 4K ≈ $19.14 לאלף — [Claude vision](https://platform.claude.com/docs/en/build-with-claude/vision).
- פרטיות: "Anthropic does not use uploaded images to train models" — [Claude vision](https://platform.claude.com/docs/en/build-with-claude/vision); "Retained data is never used for model training without your express permission"; תוכן השיחה "is not retained by default" (חריג: Covered Models — 30 יום); נתונים שסומנו ע״י מערכות האמון והבטיחות — עד שנתיים — [Claude API and data retention](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention).

**Twelve Labs / Bedrock / אחרים**
- Pegasus 1.6: "Video: $1.75/hour; Image: $3/1M tokens"; Jockey responses $2 ל־1M; חיפוש Marengo 3.0 "$4/1,000 queries"; אחסון "$0.065/GB/month" (פורסם 3/11/2026) — [Twelve Labs list price](https://www.twelvelabs.io/list-price).
- תוכניות: Free $0, Plus $29/חודש, Pro $99/חודש, Enterprise; "Customers will begin moving to the new pricing automatically on January 4, 2027"; Overage רק ב־Pro — [Twelve Labs pricing](https://www.twelvelabs.io/pricing).
- ב־Bedrock (דוגמת המחירון): Pegasus 1.2 — "$0.00049" לשנייה (≈$1.76 לשעה) + $0.0075 ל־1K טוקני פלט; Marengo Embed — "$0.00070" לשנייה (≈$2.52 לשעה) — [Amazon Bedrock pricing](https://aws.amazon.com/bedrock/pricing/).
- Qwen (Singapore): `qwen3.6-flash` $0.25 / $1.5 (≤256K; Batch 50%); `qwen3.6-plus` $0.5 / $3; `qwen3.7-plus` $0.4 / $1.6 (מסומן "Limited-time 20% off"); `qwen3-vl-plus` $0.2 / $1.6 (≤32K); `qwen3-omni-flash` אודיו $3.81, תמונה/וידאו $0.78 ל־1M קלט — [Model Studio pricing](https://www.alibabacloud.com/help/en/model-studio/model-pricing).
- Z.ai: GLM-4.6V $0.3 / $0.9; GLM-4.6V-FlashX $0.04 / $0.4; GLM-4.5V $0.6 / $1.8; GLM-4.6V-Flash — חינם — [Z.ai pricing](https://docs.z.ai/guides/overview/pricing).

**טבלת עלות לשעת וידאו (חישוב שלי, USD, לפי המחירים לעיל, ללא פלט)**
- הנחות: Gemini 3/4 static: 70 או 280 טוקנים לפריים + 32 טוקני אודיו לשנייה ([media resolution](https://aistudio.google.com/docs/media-resolution); [video understanding](https://aistudio.google.com/docs/video-understanding)); OpenAI: 768×432 ⇒ 404 טוקנים, 1280×720 ⇒ 1,104 ([images & vision](https://developers.openai.com/api/docs/guides/images-vision)); Claude: 1280×720 ⇒ 1,196, 1920×1080 ⇒ 2,691 ([Claude vision](https://platform.claude.com/docs/en/build-with-claude/vision)); תמלול שלנו כטקסט ≈ 12K טוקנים לשעה (הנחה).

| מסלול | טוקני קלט לשעה | מחיר קלט לשעה |
|---|---|---|
| Gemini 3.8 Flash, ברירת מחדל 1 fps | 367,200 | $0.275 (עד 31/12/2026) · $0.551 (מ־1/1/2027) |
| Gemini 3.8 Flash, `high` 1 fps (לא נכנס בבקשה אחת) | 1,123,200 | $0.842 · $1.685 |
| Gemini 3.8 Flash, ברירת מחדל 0.5 fps | 241,200 | $0.181 · $0.362 |
| Gemini 3.8 Flash, `high` 0.2 fps | 316,800 | $0.238 · $0.475 |
| Gemini 3.8 Flash Batch/Flex, ברירת מחדל | 367,200 | $0.138 · $0.275 |
| Gemini 3.5 Flash-Lite, ברירת מחדל / `high` | 367,200 / 1,123,200 | $0.110 / $0.337 |
| Gemini 3.1 Flash-Lite, ברירת מחדל / `high` | 367,200 / 1,123,200 | $0.121 / $0.310 |
| Gemini 4 Argon, ברירת מחדל | 367,200 | $0.734 (עד 30/11/2026) · $1.469 (מ־1/12/2026) |
| Gemini 3.1 Pro Preview, ברירת מחדל (>200K) | 367,200 | $1.469 |
| Gemini 2.5 Flash-Lite, low (66) | 352,800 | $0.058 |
| GPT-6 Astra, 720 פריימים 768×432 + תמלול, בקשה אחת (>272K ⇒ ×2) / בשני חלקים | 302,880 | $6.06 / $3.03 |
| GPT-6.1 Sol, אותו דבר | 302,880 | $1.21 / $0.61 |
| GPT-6 Luna, אותו דבר | 302,880 | $0.06 / $0.03 |
| GPT-6 Astra / 6.1 Sol / 6 Luna — 60 שקפים 1280×720 + תמלול | 78,240 | $0.78 / $0.16 / $0.008 |
| Claude Opus 5.5 / Sonnet 5.5 / Haiku 5.5 — 600 פריימים 1280×720 + תמלול | 729,600 | $2.92 / $1.46 / $0.36 |
| Claude Opus 5.5 / Sonnet 5.5 / Haiku 5.5 — 60 שקפים 1920×1080 + תמלול | 173,460 | $0.69 / $0.35 / $0.09 |
| Twelve Labs Pegasus 1.6 | — | $1.75 + טוקני פלט |
| Bedrock Pegasus 1.2 / Marengo Embed | — | $1.76 / $2.52 |
| Gemini Embedding 2 (וידאו, 1 fps / 0.2 fps) | — | $2.84 / $0.57 |

- עלות פלט לדוגמה (20K טוקני פלט+חשיבה): 3.8 Flash $0.075 (→$0.15), 3.5 Flash-Lite $0.05, Argon $0.20 (→$0.40), 3.1 Pro $0.36 — חישוב שלי מ־[Gemini pricing](https://aistudio.google.com/docs/pricing).

### Inferences
- הזול ביותר לניתוח "רואה ושומע" מלא הוא Gemini Flash-Lite (≈$0.11–0.12 לשעה), והאיכותי־בזול הוא 3.8 Flash (≈$0.28 עד סוף 2026, ≈$0.55 אחר כך); Batch/Flex מורידים לחצי — מתאים לעיבוד ברקע של הסטודיו (תור, לא זמן אמת).
- המחירים של Gemini 3.8 Flash ו־Argon הם תמחור היכרותי שמוכפל (Argon כבר ב־1/12/2026, 3.8/3.6 Flash ב־1/1/2027) — לתכנן תקציב לפי המחיר הכפול.
- שאלות המשך על אותו סרטון: במטמון של 3.8 Flash, 367K טוקנים עולים ≈$0.028 לשאלה (cached $0.075/1M) + אחסון ≈$0.18 לשעת שמירה — כדאי רק כשיש כמה שאלות בפרק זמן קצר; אחרת עדיף לשמור את "תמליל הניתוח" שלנו כטקסט ולשאול עליו — חישוב שלי.
- מסלול Claude (הכלי הקיים אצלנו, עם Message Batches ו־prompt caching): כשמצמצמים לשקפים ייחודיים (זיהוי החלפת שקף ב־ffmpeg אצלנו) העלות לשעה נמוכה מ־Gemini ב־3.8 Flash, אבל אין שמיעה — צריך תמלול שלנו (שכבר קיים). Haiku 5.5 מעל 100K טוקנים קופץ פי 5 — לחלק לבקשות של עד 100K או לצמצם שקפים.
- ב־OpenAI כל בקשה מעל 272K טוקנים מוכפלת — לפצל לחלקים.
- **פרטיות**: מפתח Gemini שבשכבה החינמית (כמו שנראה בריפו — מכסה של ~20/~500 בקשות ביום) אסור לסרטוני משתמשים: התוכן משמש לשיפור ונקרא ע״י בודקים אנושיים. לסטודיו — רק פרויקט עם חיוב (Paid). זה גם פותר את המכסה היומית.
- כסף: כל מעבר לשכבה בתשלום/ספק חדש מחייב אישור מפורש של המשתמש עם המחיר (כלל הפרויקט).

### Gaps
- מחירי Amazon Nova 2 Lite ב־Bedrock — הדפים לא הציגו ערכים.
- מחיר טוקני `total_tool_use_tokens` ו־thinking במצב agentic של Gemini, ומה העלות האמיתית לשעה במצב זה — לא מפורסם; צריך מדידה.
- מחירי Qwen3.8-Omni-Flash, Seed2.1 ו־Kimi K3.x — לא נמצאו.
- מגבלות RPM/TPM/RPD מספריות לשכבות של Gemini 3.x/4 — הדף מפנה לממשק AI Studio ולא מציג.
- מחיר פלט של Pegasus 1.6 (דף ה־list price מציג רק קלט).

## 4. טבלאות מובילים (Benchmarks) — מי מוביל בין המסחריים ובכמה

### Takeaway
טבלאות המובילים הרשמיות (Video-MME, LongVideoBench, MLVU, LVBench, VideoMMMU, CG-Bench, HourVideo) תקועות על מודלים של 2024–2025; המספרים העדכניים הם דיווחי יצרנים שאינם שקולים (מספר פריימים שונה לכל מתחרה). לפי מה שקיים: Gemini מוביל בעקביות בווידאו ארוך (2.5 Pro: LVBench 78.7, Video-MME 84.3/86.9 בדוח 6/2025; 3 Pro: Video-MMMU 87.6 ב־11/2025; 4 Argon: LVBench 91.7 מול 87.5 של GPT-6 Astra ו־83.7 של Claude Opus 5.5 — חישוב של Google, 30/9/2026), ו־Seed2.1 מדווח ש־Video-MME long שלו (89.2) עוקף את Gemini 3.5 Flash (87.2) ו־3.1 Pro (86.7).

### Cited Findings

**דיווחי יצרנים עדכניים (2025–2026)**
- LVBench (Google, 30/9/2026): Gemini 4 Argon 91.7%, GPT-6 Astra 87.5%, Claude Opus 5.5 83.7%, Claude Fable 5.1 79.7% — [DataCamp](https://www.datacamp.com/blog/gemini-4-argon); [Google blog](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-4-argon/?hl=en). שיטה: "Gemini sampled video at 1 FPS; Astra got 800 frames, Fable 5.1 300 and Opus 5.5 600, 'due to API limitations'", הגדרות חשיבה מרביות לכולם — [Apidog](https://apidog.com/blog/gemini-4-argon-benchmarks/). "no third party had reproduced them at launch" — [DataCamp](https://www.datacamp.com/blog/gemini-4-argon).
- Chartography (Google, 30/9/2026): Argon 71.6%, Astra 71.0%, Opus 5.5 66.3% (בטקסט של אותה כתבה: 64.4%), Fable 5.1 46.2% — [DataCamp](https://www.datacamp.com/blog/gemini-4-argon); לעומת זאת Anthropic מדווחת Opus 5.5 "89.0% with tools" — [Anthropic news](https://www.anthropic.com/news/claude-opus-5-5) (הגדרות שונות).
- Video-MMMU: Gemini 3 Pro 87.6% (18/11/2025) — [Google blog](https://blog.google/products/gemini/gemini-3/), מחושב ב־media_resolution=HIGH ו־temperature 0 — [Gemini 3 Pro evaluation](https://storage.googleapis.com/deepmind-media/gemini/gemini_3_pro_model_evaluation.pdf).
- דוח Gemini 2.5 (Table 6): 2.5 Pro / 2.5 Flash / GPT-4.1 — VideoMME (audio+visual) 84.3 / 75.5 / 72.0; VideoMME (audio+visual+subtitles) 86.9 / 81.5 / 79.6; LVBench 78.7 / 62.7 / 63.4; VideoMMMU 83.6 / 79.2 / 60.9; 1H-VideoQA 81.0 / 67.5 / 56.8; QVHighlights 75.0 / 52.4 / 71.4; YouCook2 CIDEr 188.3 / 177.6 / 127.6; Minerva 67.6 / 60.7 / 54.0 — [Gemini 2.5 technical report](https://arxiv.org/html/2507.06261). ברזולוציה נמוכה: Video-MME 84.7 מול 85.2 (9/5/2025) — [Google Developers blog](https://developers.googleblog.com/en/gemini-2-5-video-understanding/).
- דוח Qwen3-VL (26/11/2025), עמודות: Qwen3-VL-235B thinking/instruct · Gemini 2.5 Pro thinking/budget-128 · GPT-5 high/minimal · Claude Opus 4.1 thinking/non-thinking:
  - Video-MME w/o sub: 79.0/79.2 · 85.1/80.6 · 84.7/77.3 · 75.6/73.3
  - MLVU M-Avg: 83.8/84.3 · 85.6/81.2 · 86.2/78.3 · 73.5/71.2
  - LVBench: 63.6/67.7 · 73.0/69.0 · — · —
  - VideoMMMU: 80.0/74.7 · 83.6\*/79.4 · 84.6\*/61.6\* · 76.2/70.1 (\* = מדוח היצרן)
  - MMVU: 71.1/68.1 · 74.9/72.2 · 73.0/68.1 · 66.4/61.4
  - Charades-STA mIoU (עיגון זמן): Qwen3-VL 63.5/64.8; למסחריים אין ערך
  - הערה: "512 for Gemini 2.5 Pro, 256 for GPT-5, and 100 for Claude Opus 4.1" פריימים — "cannot guarantee full fairness" — [Qwen3-VL report PDF](https://arxiv.org/pdf/2511.21631v2).
- Seed2.1 (תאריך לא מצוין): Video-MME (long) — Seed2.1 Pro 89.2, Turbo 89, Gemini 3.5 Flash 87.2, Gemini 3.1 Pro 86.7; Minerva 70.7 / 65.9 / 68.6 / 63.5; TOMATO 79.5 / 56.8 / 71.9 / 60.4; VideoSimpleQA 76.4 / 71.4 / 76 / 70 — [Seed2.1](https://seed.bytedance.com/en/seed2_1).

**טבלאות מובילים רשמיות (מיושנות)**
- Video-MME: הרשומה האחרונה 28/9/2025; ראשון video-SALMONN 2+ (72B) 79.7 / 81.6 (בלי/עם כתוביות), ארוך 72.3 / 76.4; Gemini 1.5 Pro 75.0 / 81.3, ארוך 67.4 / 77.4; GPT-4o 71.9 / 77.2; Gemini 2.5/3.x ו־GPT-5 לא רשומים — [Video-MME](https://video-mme.github.io/home_page.html).
- VideoMMMU (אתר רשמי): Claude-3.5-Sonnet 65.78 (Δknowledge +11.4), Kimi-VL-A3B-Thinking-2506 65.22, GPT-4o 61.22 (+15.6), Gemini 1.5 Pro 53.89 — [VideoMMMU](https://videommmu.github.io/). אצל בני אדם Δknowledge = 33.1% מול 15.6% של GPT-4o — [VideoMMMU paper](https://arxiv.org/html/2501.13826).
- LongVideoBench: GPT-4o (0513) 66.7, Gemini-1.5-Pro 64.4 — [LongVideoBench](https://longvideobench.github.io/).
- MLVU: GPT-4o dev 64.6, test 54.9; LVAgent 83.9 (dev) — [MLVU](https://github.com/JUNJIE99/MLVU).
- LVBench (אתר רשמי, רשומה אחרונה 29/5/2025): Deep Video Discovery (Microsoft) 74.2; Seed1.5-VL-Thinking 64.6; GPT-4o-2024-11-20 48.9; Gemini 1.5 Pro 33.1 — [LVBench](https://lvbench.github.io/).
- HourVideo (סרטונים של 20–120 דק׳, 12,976 שאלות): Gemini 1.5 Pro 37.3% מול מומחים אנושיים 85.0% — [HourVideo](https://hourvideo.stanford.edu/).
- CG-Bench (עיגון "רמזים" בווידאו ארוך): GPT-4o long-acc 44.9, mIoU 5.73; Claude 3.5 Sonnet 40.3 / 4.17; Gemini 1.5 Pro 37.8 / 3.85 — [CG-Bench](https://cg-bench.github.io/leaderboard/).
- Video-MMLU (1,065 סרטוני הרצאה של 10–240 שנ׳, 15,746 שאלות; מתמטיקה/פיזיקה/כימיה): "accuracy lower than 50%" לרוב המודלים, יותר מ־90 מודלים נבדקו — [Video-MMLU](http://www.enxinsong.com/Video-MMLU-web/).
- MMVU: 3,000 שאלות ב־27 תחומים — הטבלה באתר לא נטענה — [MMVU](https://mmvu-benchmark.github.io/).
- TimeScope (23/7/2025): Gemini 2.5 Pro "is the only model that maintains strong accuracy on videos longer than one hour"; "hour-long video understanding" עדיין "more slogan than reality" — [Hugging Face blog](https://huggingface.co/blog/timescope-video-lmm-benchmark).
- מדדי עיגון זמן מקובלים: mIoU ו־R@1 ב־IoU=0.3/0.5/0.7 על Charades-STA, ActivityNet-Captions, QVHighlights — [סקירת VTG, arXiv 2508.10922](https://arxiv.org/abs/2508.10922).

### Inferences
- פער ההובלה של Gemini בווידאו ארוך עקבי לאורך שלושה דורות (2.5 → 3 → 4), אבל המספרים של 2026 הם של Google עצמה ועם פחות פריימים למתחרים — הפער האמיתי בתנאים שווים כנראה קטן מ־4–8 נקודות.
- Video-MMMU (ידע מסרטוני הרצאה) קרוב ל"תקרה" בשורה העליונה (87.6), אבל Video-MMLU ו־Δknowledge מראים שגם מודלים טובים לא "לומדים" מההרצאה במידה של אדם — לניתוח עומק כדאי שלב חשיבה נפרד על טקסט מובנה (תמלול + שקפים) ולא רק "צפייה".
- עיגון זמן מדויק (CG-Bench mIoU של 4–6 במודלים של 2024) היה נקודת התורפה; אין מדד עדכני למסחריים — לכן החותמות שלנו צריכות לבוא מהתמלול/זיהוי השקפים, לא מהמודל.

### Gaps
- אין טבלה רשמית עדכנית (2026) לאף מדד וידאו; אין ערכי Video-MME/LVBench/VideoMMMU ל־Gemini 3.8/3.6 Flash ו־3.5 Flash-Lite.
- אין ערכי Charades-STA/ActivityNet-Captions למסחריים; QVHighlights רק ל־Gemini 2.5/GPT-4.1.
- ערכי LongVideoBench/MLVU ל־2026 — לא נמצאו; ערכי TimeScope מספריים — לא נטענו.

## 5. פלטפורמות וידאו־AI ייעודיות — מה הן נותנות לניתוח הרצאה ובכמה

### Takeaway
הפלטפורמות הייעודיות נותנות "תשתית אינדוקס" (תמלול עם חותמות, שקפים/פריימי מפתח, OCR, פרקים, חיפוש) ולא ניתוח עומק; לעברית רק Azure Video Indexer תומך רשמית בתמלול, ו־Twelve Labs (הכי חזק בווידאו־לטקסט עם JSON מתוזמן, $1.75 לשעה) לא תומך בעברית. את רוב רכיבי האינדוקס (שקפים, OCR, תמלול, פרקים) אפשר להריץ אצלנו, ולשלוח ל־LLM רק את הטקסט המובנה.

### Cited Findings
- **Twelve Labs**: Pegasus — "video-to-text model that returns time-coded JSON", פלט segmentation עם `start_time`/`end_time`, in-segment events (1.6); Marengo — חיפוש והטמעות ("visual, audio, and text information"); Jockey (סוכן) GA ב־15/10/2026 — [Pegasus page](https://www.twelvelabs.io/pegasus); [Marengo concepts](https://docs.twelvelabs.io/docs/concepts/models/marengo); [Twelve Labs release notes](https://docs.twelvelabs.io/docs/release-notes). מחירים — סעיף 3 ([list price](https://www.twelvelabs.io/list-price)). יחידות חיוב: Pegasus לפי משך (מעוגל לשנייה) או טוקנים — [plans & allowances](https://docs.twelvelabs.io/v1.3/docs/get-started/plans-and-billing/plans-allowances-and-overage.md).
- **Azure Content Understanding (וידאו)**: `prebuilt-videoAnalysis` מחזיר תמלול WEBVTT, פריימי מפתח, תיאור לכל קטע ו־segmentation מותאם בשפה טבעית; "Education and e-Learning: Index and retrieve specific moments in educational videos or lectures"; מגבלות: "Frame sampling (~ 1 FPS)", "Frame resolution (512 × 512 px) ... Small text or distant objects can be lost", "Only spoken words are transcribed"; גרסת API `2026-06-01-preview` (public preview, בלי SLA); הדף עודכן 19/10/2026 — [Azure Content Understanding video](https://learn.microsoft.com/en-us/azure/ai-services/content-understanding/video/overview). בדף המחיר: שעת וידאו = 1,000,000 "context processing tokens" (הערכים הכספיים לא הוצגו) — [Azure Content Understanding pricing](https://azure.microsoft.com/en-us/pricing/details/content-understanding/).
- **Azure AI Video Indexer**: OCR, keyframes, זיהוי סצנות/שוטים, נושאים מתוך תמלול + OCR, מילות מפתח, תמלול ב־50+ שפות, כתוביות VTT/TTML/SRT, ניסיון חינם עד 2,400 דקות; הדף עודכן 11/9/2026 — [Azure Video Indexer overview](https://learn.microsoft.com/en-us/azure/azure-video-indexer/video-indexer-overview); עברית `he-IL` נתמכת — [language support](https://learn.microsoft.com/en-us/azure/azure-video-indexer/language-support). דף המחיר הציג "$-" בלבד — [Azure Video Indexer pricing](https://azure.microsoft.com/en-us/pricing/details/video-indexer/).
- **Amazon Bedrock Data Automation (וידאו)**: "Full Video Summary" (כולל שיוך שם דובר מקול או משקף), "Chapter Summaries" עם חותמות זמן, תמלול מלא עם זיהוי דוברים, "Text in Video" עם תיבות תוחמות, IAB, לוגו, מודרציה; "Only one audio track per video is supported. Subtitle file formats (e.g., SRT, VTT, etc.) are not supported." — [BDA video output](https://docs.aws.amazon.com/bedrock/latest/userguide/bda-ouput-video.html). מחיר לדקה — לא הוצג.
- **Amazon Rekognition Video**: Label Detection $0.10 לדקה, Shot Detection $0.05 לדקה, Content Moderation $0.10; שכבה חינמית של 60 דקות בחודש ל־12 חודשים — [Rekognition pricing](https://aws.amazon.com/rekognition/pricing/).
- **VideoDB**: אינדוקס ברמת סצנה עם מנתח VLM בהנחיה מותאמת, חיפוש סמנטי שמחזיר "timestamped moments with playable evidence" בהרצאות ופגישות — [VideoDB docs](https://docs.videodb.io/); מחיר לא פורסם, רק "$20 of free credits" — [VideoDB](https://videodb.io/pricing).
- **Memories.ai**: "Index to chat: $15 per 1,000 min" (≈$0.90 לשעה), הטמעת וידאו $0.002 לשנייה, "Split video and scene detection: $0.02/sec", תמלול Whisper $0.001 לשנייה, $100 קרדיט — [Memories.ai pricing](https://memories.ai/pricing); דף הבית מתמקד כעת בווידאו אגוצנטרי (פעולות ידיים) — [Memories.ai](https://memories.ai/).
- **Mux AI (`@mux/ai`, Apache 2.0)**: workflows של סיכום ותגיות, `generateChapters` "from transcripts", תרגום כתוביות, הטמעות; ספקים OpenAI/Anthropic/Google עם ברירות מחדל `gpt-5.6-luna`, `claude-sonnet-4-5`, `gemini-3-flash-preview`; "Many workflows rely on transcripts for best results", ו־storyboards לניתוח חזותי — [Mux AI GitHub](https://github.com/muxinc/ai).
- **Google Cloud Video Intelligence** — דף המחיר לא נטען — [Video Intelligence pricing](https://cloud.google.com/video-intelligence/pricing).

### Inferences
- לניתוח הרצאה בעברית אף פלטפורמה ייעודית לא מחליפה את מה שכבר יש לנו (ivrit-ai לתמלול) — היתרון שלהן הוא בעיקר אינדוקס/חיפוש בספרייה גדולה, שאינו המוצר שלנו כרגע.
- הדפוס החוזר בכל הפלטפורמות (Mux, Azure CU, BDA, VideoDB): תמלול + שקפים/פריימי מפתח + LLM על הטקסט. זה בדיוק מה שאפשר לבנות ב־CX53: `ffmpeg` לזיהוי שינוי סצנה/שקף, OCR מקומי לשקפים, תמלול מקומי, ואז קריאה אחת ל־LLM — חיסכון גדול בטוקנים לעומת שליחת כל הווידאו.
- Twelve Labs שווה בדיקה רק אם נרצה "חיפוש לפי מה שקורה" בספרייה גדולה של סרטונים באנגלית.

### Gaps
- מחירי Google Video Intelligence, Azure Video Indexer, Azure Content Understanding, BDA (לווידאו) ו־VideoDB — הדפים לא הציגו ערכים.
- איכות OCR עברי של Azure Video Indexer / BDA — לא נמצאה מדידה.

## 6. מצבי כשל ידועים, מיתון, והנחיות פרומפט רשמיות לווידאו

### Takeaway
מצבי הכשל המתועדים: דגימה של 1 fps שמפספסת שקף קצר/אירוע מהיר, הקטנת פריימים שמעלימה טקסט קטן (512/672 פיקסלים), "הקשר מוצהר מול אפקטיבי" בסרטונים של שעה+, עיגון זמן חלש וגבולות קטעים לא יציבים, והשוואות יצרן לא הוגנות. המיתון המוכח: להוסיף טקסט עזר (תמלול/OCR) לצד הפריימים, חיפוש סוכני על קטעים, מספור/חותמות מפורשים לפריימים, fps/רזולוציה גבוהים רק היכן שצריך, וחיתוך לקטעים — לפי ההנחיות הרשמיות של Google (וידאו לפני הטקסט, סרטון אחד בהנחיה, `MM:SS`).

### Cited Findings

**מצבי כשל**
- דגימה: "1 FPS sampling may miss details in fast motion or quick scene changes" — [Gemini video understanding](https://aistudio.google.com/docs/video-understanding); "fast action sequences might lose detail due to the 1 FPS sampling rate"; "might make mistakes recognizing sound that's not speech" — [Vertex video understanding](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/video-understanding); "Rapid motions or single-frame events might be missed" — [Azure Content Understanding](https://learn.microsoft.com/en-us/azure/ai-services/content-understanding/video/overview).
- רזולוציה/OCR: 512×512 ב־Azure CU ("Small text ... can be lost") — [Azure Content Understanding](https://learn.microsoft.com/en-us/azure/ai-services/content-understanding/video/overview); 672×672 "with distortion" ב־Nova, ובסרטון של שעה רק 960 פריימים (פריים כל ~3.75 שנ׳) — [Nova 2 guide](https://docs.aws.amazon.com/nova/latest/nova2-userguide/using-multimodal-models.html); [Nova v1 video](https://docs.aws.amazon.com/nova/latest/userguide/modalities-video.html); ב־LVBench "All the frames are resized to 512x512 resolution to fit within GPT-4o's max context length" — [LVBench](https://lvbench.github.io/).
- ארוך מול קצר: Gemini 1.5 Pro ב־Video-MME — 75.0 בכללי מול 67.4 בסרטונים הארוכים (בלי כתוביות) — [Video-MME](https://video-mme.github.io/home_page.html); "Models might claim to process 10,000+ frames, but training data often caps at 256 frames per clip" — [TimeScope](https://huggingface.co/blog/timescope-video-lmm-benchmark).
- עיגון זמן: CG-Bench mIoU של 3.85–5.73 למסחריים (דור 2024) — [CG-Bench](https://cg-bench.github.io/leaderboard/); גבולות קטע שונים בין static ל־agentic על אותו קטע — [Gemini cookbook](https://raw.githubusercontent.com/google-gemini/cookbook/refs/heads/main/quickstarts/Video_understanding.ipynb); "event times are only accurate to within a sampling step" (סיכום) ו־"Below 4 fps the model misses a point" — [Roboflow](https://roboflow.com/blog/gpt6-astra-video-understanding).
- למידה מהרצאה: ב־Video-MMMU, הוספת תמלול Whisper שיפרה Perception ו־Comprehension אבל "The Adaptation track, however, shows a decrease in performance"; ניתוח שגיאות Claude-3.5-Sonnet: Method Adaptation 64%, Question Misreading 15%, Method Selection 8% — [VideoMMMU paper](https://arxiv.org/html/2501.13826).
- agentic בסרטון קצר: "may increase Time to First Token (TTFT) and total token usage on short clips (<5 minutes)"; בקריאות ארוכות סינכרוניות — "unexpected `401 Unauthorized` or timeout errors" (להשתמש ב־streaming/background) — [Gemini video understanding](https://aistudio.google.com/docs/video-understanding). ב־Qwen קריאה לא־זורמת נקטעת אחרי 300 שנ׳ — [Qwen vision](https://www.alibabacloud.com/help/en/model-studio/vision).
- השוואות לא הוגנות: מתחרים קיבלו 300–800 פריימים מול 1 fps ל־Gemini — [Apidog](https://apidog.com/blog/gemini-4-argon-benchmarks/); בדוח Qwen3-VL — 512/256/100 פריימים — [Qwen3-VL report PDF](https://arxiv.org/pdf/2511.21631v2).
- עברית: אותיות ערביות בתוך תשובה בעברית (Gemini Flash-Lite, תצפית בריפו) — [ibkr-proxy/lib/gmodels.js](../../../ibkr-proxy/lib/gmodels.js); "limited understanding of multilingual images and video frames" — [Nova 2 guide](https://docs.aws.amazon.com/nova/latest/nova2-userguide/using-multimodal-models.html).

**מיתון מוכח במחקר**
- Video-RAG (NeurIPS 2025): טקסט עזר מ־Whisper (ASR), EasyOCR ו־APE (זיהוי עצמים) לצד הפריימים; עם LLaVA-Video-72B: Video-MME (עם כתוביות) 75.9 → 77.4, ארוך 72.2 → 73.1, LongVideoBench 61.9 → 65.4; תוספת ~2K טוקנים — [Video-RAG](https://arxiv.org/html/2411.13093).
- Deep Video Discovery (NeurIPS 2025): חיפוש סוכני עם כלים על קטעים — LVBench 74.2%, ו־76.0% "when transcripts are used" — [DVD](https://arxiv.org/abs/2505.18079).
- NumPro (CVPR 2025): מספור פריימים "like flipping manga" משפר עיגון זמן "without additional computational cost"; עם כוונון — עד +6.9% mIoU ב־moment retrieval — [NumPro](https://arxiv.org/abs/2411.10332).
- Gemini 2.5 ברזולוציה נמוכה כמעט בלי אובדן: Video-MME 84.7 מול 85.2 — [Google Developers blog](https://developers.googleblog.com/en/gemini-2-5-video-understanding/).

**הנחיות פרומפט רשמיות**
- Google (Vertex): "Use one video per prompt for optimal results"; "Place the video before the text prompt"; `MM:SS` עד 1 fps ו־`MM:SS.sss` מעל; fps נמוך (<1) לסרטונים ארוכים, fps גבוה לניתוח זמן עדין ב־Gemini 3; חיתוך עם `videoMetadata` start/end offsets — [Vertex video understanding](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/video-understanding).
- Google (Developer API): "place the text prompt after the video part"; agentic לסרטונים ארוכים ו־static לקצרים; streaming/background לבקשות ארוכות — [Gemini video understanding](https://aistudio.google.com/docs/video-understanding); `high` רק ל־OCR/פרטים קטנים — [Gemini media resolution](https://aistudio.google.com/docs/media-resolution); תוכן גדול ומשותף בתחילת ההנחיה לטובת מטמון — [Gemini caching](https://aistudio.google.com/docs/caching); לבקש פלט מובנה ולפרק משימה לשלבים — [Gemini Files API](https://aistudio.google.com/docs/files).
- Qwen: לדחוס (`-vcodec libx264 -crf 28 -preset slow`), להוריד `fps` ולא להעלות רזולוציה, `stream=True` למשימות ארוכות — [Qwen vision](https://www.alibabacloud.com/help/en/model-studio/vision).
- Claude: טקסט קריא ולא קטן, להימנע מדחיסת JPEG כבדה, לשקול חיתוך/שינוי גודל מראש — [Claude vision](https://platform.claude.com/docs/en/build-with-claude/vision). OpenAI: "Enlarge text within the image" — [OpenAI images & vision](https://developers.openai.com/api/docs/guides/images-vision).

### Inferences
- הארכיטקטורה המומלצת לסטודיו (הסקה מכל האמור): (1) ב־CX53 — הורדה (yt-dlp), תמלול ivrit-ai/Parakeet עם חותמות מילה, זיהוי החלפת שקף/סצנה ב־ffmpeg, OCR מקומי לשקפים שנבחרו; (2) "מעבר חזותי" זול ב־Gemini 3.5 Flash-Lite/3.8 Flash ברזולוציית ברירת מחדל ו־fps נמוך (תרשימים, הדגמות, מה שלא נאמר בקול), עם התמלול שלנו כטקסט מצורף; (3) שלב חשיבה עמוק על הטקסט המובנה (Claude Sonnet/Opus 5.5 ב־Batch, או Gemini) שמחזיר ניתוח עם חותמות שמעוגנות לתמלול ולשקפים. כך החותמות מדויקות (מהתמלול), העברית מדויקת (ASR שלנו), וה־LLM משלם רק על שקפים ייחודיים.
- לסרטוני YouTube ציבוריים אפשר לדלג על ההורדה ולשלוח URL ישירות ל־Gemini (בחינם עד 8 שעות ביום בשכבה החינמית — שאסורה לנו מטעמי פרטיות; בתשלום בלי מגבלת אורך) — אבל לא unlisted/private, ו־Vertex מגביל ל־URL אחד בבקשה; ההורדה שלנו נשארת נחוצה לתמלול העברי ממילא.
- לבחון את agentic מול static על סט זהב של 5–10 הרצאות (עברית/אנגלית/מעורב, 30–180 דק׳): איכות, דיוק MM:SS מול התמלול, וטוקנים בפועל (`total_tool_use_tokens`) — לפני שמאמצים.
- להפעיל fps גבוה/`high` רק בקטעים שזוהו כ"צפופי טקסט" (חיתוך `start_offset`/`end_offset`) במקום על כל הסרטון.

### Gaps
- לא נמצאו מדידות בלתי תלויות (2026) של "סחיפת חותמות" ב־Gemini לאורך 1–3 שעות, או של lost-in-the-middle בווידאו במודלי 2026.
- לא נמצאה הנחיה רשמית של Google לפיצול הרצאות של 2–3 שעות (מעבר ל־clipping ול־agentic).
- לא נמצאו נתוני איכות ל־OCR עברי על שקפים בשום מודל מסחרי.
