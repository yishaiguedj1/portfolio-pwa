# קוד פתוח ודפוסי פרומפט לניתוח הרצאות, וובינרים וסרטונים: פייפליינים, רכיבים, ספריות פרומפטים וכלי הערכה (מחקר, 9/11/2026)

> **הקשר:** לשונית "ניתוח וידאו" בסטודיו של THE SNOWBALL. היא מנתחת הרצאות מהשמע ומהמסך, נותנת חותמות זמן לחיצות מתוך תזמון ברמת מילה, ומפיקה סינתזה עמוקה.
> - **העובד:** Python ב־Docker על Hetzner CX53: ‏16 vCPU, ‏32GB ובלי GPU. הכלים שכבר בו: yt-dlp, ‏ffmpeg, ‏Parakeet ONNX, ‏ivrit-ai whisper ו־RapidOCR.
> - **שלבי ה־LLM:** רק Claude, בלי Gemini.
> - **הממשק:** PWA ב־JS.
>
> **שיטה:**
> - **מקורות:** שליפות ישירות של דפי GitHub ודפי topic. קובצי LICENSE ו־README נקראו בגרסת raw, מתוך ענף ברירת המחדל (HEAD).
> - **נתוני חבילות:** JSON של PyPI ושל npm, ו־API של Hugging Face למודלים ול־Spaces.
> - **מסמכים:** תיעוד רשמי (Anthropic, ‏OpenAI, ‏Google Cloud, ‏Microsoft Learn, ‏LlamaIndex) ומחברות ה־cookbook עצמן.
> - **מכסת WebSearch:** נגמרה לקראת הסוף. מאותו רגע המשכתי רק בשליפה ישירה, בלי מנועי חיפוש.
> - **תאריך הנתונים:** הכוכבים, תאריכי העדכון והגרסאות נכונים ל־7–9/11/2026.
> - **מה לא נעשה:** לא הותקן ולא הורץ קוד של צד שלישי.
>
> **סימונים:**
> - ⚠️ = מלכודת רישיון.
> - 🪦 = פרויקט נטוש או קפוא. המשמעות: הודעה מפורשת בריפו, או שאין פעילות מעל שנה.
> - **(לפי המחבר)** = טענת איכות של המחבר, בלי מדידה בלתי תלויה.
>
> **קשר להערות אחרות בתיקייה:** את המספרים המחקריים לא חוזרים לפרט כאן. הם נמצאים בהערות האלה:
> - 03 (שקפים ו־OCR): המסווג של lecture2notes.
> - 04 (ASR): ‏WhisperX ויישור.
> - 05 (מחקר אקדמי): ‏MiniCheck, ‏AlignScore, ‏FineSurE, ‏VideoRAG, ‏DVD ו־MR. Video כמאמרים.
> - 09 (מתודולוגיה): ‏extract_wisdom, ‏STORM ו־Chain of Density כעקרונות.
>
> ההערה הזו מתמקדת בקוד, ברישיונות, בבשלות ובפרומפטים עצמם.

## 1. פייפליינים ואפליקציות שלמים בקוד פתוח: מה קיים, כמה הוא בשל, ומה אפשר לקחת

### Takeaway
הקוד הפתוח בתחום מתחלק לשלוש שכבות:

| שכבה | דוגמאות | מצב | הקשר אלינו |
|---|---|---|---|
| תמלול ורישום פגישות | Meetily ‏32.6k, ‏WhisperX ‏25.2k, ‏Buzz ‏22.6k | בשלה, ורובה ברישיון מתירני | מתמקדת בלכידה ובסיכום של שיחה, לא בניתוח הרצאה עם מסך |
| הרצאה→הערות | lecture-to-notes, ‏slidoc, ‏video-to-notes | צעירה (2026), מעט כוכבים, MIT | השכבה הקרובה ביותר למה שאנחנו בונים: עיגון שקף↔תמליל↔זמן וסינתזה מבוקרת |
| Video RAG וסוכני וידאו ארוך | VideoRAG, ‏DVD, ‏MR. Video, ‏VideoTree ועוד | חזקה בבנצ'מרקים | נשענת על GPU, על Gemini או OpenAI, או על רכיבים ברישיון NC |

באף אחת מהשכבות לא מצאתי פרויקט שמראה תמיכה מאומתת בעברית.

### Cited Findings

#### 1.1 הרצאה → הערות: הקבוצה הכי קרובה ללשונית שלנו

**drpwchen/lecture-to-notes** (MIT, ‏2026)

- **עיקרון התכנון:** "design goal is not "summarize a video". It is **traceability**: every claim in the finished note should be attachable to a moment in the transcript and to the slide that was on screen at that moment". מקורות: [README](https://github.com/drpwchen/lecture-to-notes) ו־[LICENSE](https://github.com/drpwchen/lecture-to-notes/blob/HEAD/LICENSE).
- **השלבים** ([README](https://github.com/drpwchen/lecture-to-notes)):
  1. route_inputs.
  2. faster-whisper.
  3. extract_slides: הסרת כפילויות perceptual. קלט חלופי: PDF של המצגת או תמונות.
  4. quick_ocr, מיון OCR זול (Stage B).
  5. dedup_semantic (Stage C).
  6. ocr_surya (Stage B2).
  7. vlm_signals, עם minicpm-v:8b אופציונלי (Stage D).
  8. ground_slides (Stage E).
  9. Stage F, סינתזה ב־LLM: ‏"tier pass, then write pass".
  10. render_embeds, ‏finalize_to_vault ו־audit_note.
  11. export_web.
  - "Stages A–E are plain Python and cost zero LLM tokens".
- **חוזה Stage F** ([stage-f-contract](https://github.com/drpwchen/lecture-to-notes/blob/HEAD/docs/stage-f-contract.md)):
  - החוזה ניטרלי לספק: "Claude, GPT, Gemini, or a local model behind ollama all fit".
  - הקלט `slides_grounded.json` מכיל לכל שקף קנוני את טקסט ה־OCR, אותות ה־VLM, חלון התמליל ואותות העיגון. החוזה קורא לו "the source of truth for slides".
  - **הפלט `slides_final.json`** מכיל רשומה לכל שקף. השדות:
    - `tier`: מספר שלם 1/2/3, ‏"Not `"T1"`".
    - `combined_score`.
    - `embed_width`.
    - `attachment_name`: ‏"one plain file name". הסקריפטים מסרבים לנתיב.
    - `section_suggestion`.
  - Stage F "never rewrites the transcript (HARD RULE 3)". מילה שלא נפתרה נשארת בצורתה הגולמית עם ⚠️.
  - מותר לחשב ניקוד בקוד: "A model that cannot follow arithmetic reliably may compute them in code; the contract is the output".
- **כללי התכנון** ([README](https://github.com/drpwchen/lecture-to-notes)):
  - **התמליל לא מתוקן:** "The transcript is never auto-corrected". מילים חשודות מסומנות ב־`asr_suspects.txt`. שני מעברים של תיקון אוטומטי "were built, measured, and retired".
  - **ה־VLM לא קורא טקסט:** "The VLM does not do OCR".
  - **תלות שחסרה מודיעה על עצמה:** "Optional dependencies degrade loudly". המערכת "never silently substitutes a worse method".
  - **שלבים מצטברים:** "Every stage output is a superset of the previous one".
  - **מקור לכל קובץ:** `provenance.json` לכל שלב, עם הפקודה `provenance.py verify`.
  - **שמות לא הופכים לנתיבים:** "Names from data files never become paths".
- **יישור בין כמה מכשירים:** "capture time is a hypothesis, cross-correlation is evidence". בפער של יותר מ־5 שניות המערכת מסמנת `"conflict": true` ועוצרת. מקור: [README](https://github.com/drpwchen/lecture-to-notes).
- **חומרה** ([README](https://github.com/drpwchen/lecture-to-notes)):
  - "An NVIDIA GPU (8 GB+) is the fast path, not a requirement". בלי GPU התמלול רץ ב־int8 על CPU.
  - "A small GPU (2–4 GB) counts as no GPU". על מכונה כזו מדלגים על minicpm-v ועל Surya.
  - "RapidOCR is CPU-only anyway".
- **ראיה לאיכות (לפי המחבר):** בקטעי בדיקה, נתיב ה־ASR של Gemini זיהה 97–100% ממונחי הייחוס. המודל המקומי הטוב ביותר זיהה 64–85%. מקור: [README](https://github.com/drpwchen/lecture-to-notes).
- **הנגן:** ‏`export_web.py` בונה "single self-contained HTML" שמסנכרן וידאו, תמליל וסיכום. ‏Stage F כותב קבצי L3 לכל מקטע, עם קודי זמן `(V1 MM:SS)`. מקורות: [README](https://github.com/drpwchen/lecture-to-notes) ו־[stage-f-contract](https://github.com/drpwchen/lecture-to-notes/blob/HEAD/docs/stage-f-contract.md).

**shyenx/slidoc** (MIT, ‏2026)

- **מה הוא עושה:** ‏"Turn lecture videos into Markdown that pairs every slide with its cleaned narration". מקורות: [README](https://github.com/shyenx/slidoc) ו־[LICENSE](https://github.com/shyenx/slidoc/blob/HEAD/LICENSE).
- **השלבים:**
  1. פריימים ב־ffmpeg, בזיהוי סצנה או במרווח קבוע.
  2. srt ב־whisper.cpp, עם quality gate.
  3. סוכן־משנה של LLM.
- **הכשלים שתיעד:**
  - "Whisper hallucinates on long audio — one line repeated 500 times, silently destroying 25 min of content".
  - "Scene detection breaks on Zoom recordings — chat sidebar movement → 194 false-positive frames".
  - "Cap LLM subagent concurrency at 2", כי שלושה סוכנים שקוראים 20+ תמונות כל אחד גרמו ל־OOM.
- **ניסיון (לפי המחבר):** ‏"battle-tested on **7.5 hours** of real-world training videos".
- **זיהוי פורמט:** הפקודה `slidoc inspect` מזהה את סוג הסרטון: PPT, ‏Zoom או talking-head.

**KIRVO-REPORTING/video-to-notes** (MIT)

- 113 כוכבים, עדכון אחרון 2/11/2026.
- הסיסמה: "Caption first. Local Whisper when needed. Clickable timestamps back to the source."
- מקורות: [GitHub](https://github.com/KIRVO-REPORTING/video-to-notes) ו־[LICENSE](https://github.com/KIRVO-REPORTING/video-to-notes/blob/HEAD/LICENSE).

**HHousen/lecture2notes** (⚠️ AGPL-3.0)

- **פעילות:** ‏67 כוכבים, ‏18 forks ו־235 commits. אין releases.
- **commit אחרון:** ‏26/5/2025, שעסק בנעיצת תלויות.
- **הפייפליין:**
  1. חילוץ פריימים.
  2. מסווג CNN.
  3. חיתוך פרספקטיבה.
  4. אשכולות לזיהוי כפילויות.
  5. OCR.
  6. חילוץ איורים.
  7. ASR.
  8. סיכום extractive או abstractive, דרך TransformerSum ו־BART/PEGASUS.
- **מקורות:** [GitHub](https://github.com/HHousen/lecture2notes), ‏[LICENSE](https://github.com/HHousen/lecture2notes/blob/HEAD/LICENSE) ו־[commits](https://github.com/HHousen/lecture2notes/commits).
- **תלות:** ‏TransformerSum עצמו ב־⚠️ GPL-3.0. מקור: [LICENSE](https://github.com/HHousen/TransformerSum/blob/HEAD/LICENSE).

**פרויקטים קטנים**

| פרויקט | פרטים | רישיון | מקור |
|---|---|---|---|
| nodeeeeee/Auto-Note | יישור לעמודי שקפים | ⚠️ אין LICENSE | [GitHub](https://github.com/nodeeeeee/Auto-Note) |
| EmptyBlueBox/Course2Note | | MIT | [LICENSE](https://github.com/EmptyBlueBox/Course2Note/blob/HEAD/LICENSE) |
| hongvin/gptlecture | | MIT | [LICENSE](https://github.com/hongvin/gptlecture/blob/HEAD/LICENSE) |
| wenbi | גרסה 0.142.11 מ־24/9/2026 | Apache-2.0 | [PyPI](https://pypi.org/project/wenbi/) |
| vidscript | גרסה 1.0.6 מ־3/3/2025 | MIT | [npm](https://www.npmjs.com/package/vidscript) |

**ClassTranscribe** (אוניברסיטת אילינוי)

- **רישיון:** מתירני בנוסח האוניברסיטה: ‏"to deal with the Software without restriction". מקור: [LICENSE](https://github.com/classtranscribe/WebAPI/blob/HEAD/LICENSE).
- **זיהוי הסצנות מושבת:** ב־PythonRpcServer הקריאה ל־`scenedetector.find_scenes` מוערת. ב־requirements כתוב "# No longer needed for remaning pythonrpcserver tasks", ומיד אחריו `#scenedetect==0.5.2`. מקור: [WebAPI/PythonRpcServer](https://github.com/classtranscribe/WebAPI/tree/HEAD/PythonRpcServer).

**Opencast** (ECL-2.0)

- **segment-video:** פותח מקטע חדש "when a major change in the video occurs". מקור: [segmentvideo-woh](https://docs.opencast.org/develop/admin/workflowoperationhandlers/segmentvideo-woh/).
- **extract-text:** משתמש ב־Tesseract OCR. מקור: [extracttext-woh](https://docs.opencast.org/develop/admin/workflowoperationhandlers/extracttext-woh/).
- **הרישיון:** ‏ECL-2.0 הוא Apache 2.0 "modified to change the scope of the patent grant". מקור: [LICENSE](https://github.com/opencast/opencast/blob/HEAD/LICENSE).

**נושא lecture-notes ב־GitHub:** ‏944 ריפו. אף אחד מ־20 הראשונים איננו כלי וידאו→הערות. רובם אוספי הערות קורס. מקור: [topic](https://github.com/topics/lecture-notes).

#### 1.2 מחלצי שקפים

**kaushikj/video2pdfslides** (🪦; הכתובת מפנה ל־kaushikj/video2pdf)

- **פעילות:** ‏227 כוכבים, ‏94 forks ו־14 commits. ⚠️ אין LICENSE.
- **commit אחרון:** ‏11/10/2021.
- **שיטה:** חיסור רקע עם הפרמטרים MIN_PERCENT, ‏MAX_PERCENT ו־FGBG_HISTORY. את הכפילויות מסירים ביד.
- **מקורות:** [GitHub](https://github.com/kaushikj/video2pdfslides) ו־[commits](https://github.com/kaushikj/video2pdf/commits).

**video2pdfslides-tddschn** (🪦)

- גרסה 0.2.2 מ־22/11/2022, ברישיון MIT לפי PyPI. בריפו עצמו (tddschn/video2pdfslides-tddschn) לא נמצא קובץ LICENSE.
- דורש Python ‏‎>=3.9,<3.10.
- מקור: [PyPI](https://pypi.org/project/video2pdfslides-tddschn/).

**רשימת awesome-video-to-slides** ([itsyujay/awesome-video-to-slides](https://github.com/itsyujay/awesome-video-to-slides))

| פרויקט | רישיון | push אחרון | הערה |
|---|---|---|---|
| larry-xue/video-slide-extractor | MIT | 28/8/2026 | |
| Wangxs404/video2ppt | MIT | 3/11/2025 | |
| binh234/video2slides | MIT | 14/3/2024 | |
| andererka/MaViLS | Apache-2.0 | 25/9/2024 | בנצ'מרק ליישור פריים↔שקף |

רישיונות: [video2ppt](https://github.com/Wangxs404/video2ppt/blob/HEAD/LICENSE), ‏[video2slides](https://github.com/binh234/video2slides/blob/HEAD/LICENSE), ‏[MaViLS](https://github.com/andererka/MaViLS/blob/HEAD/LICENSE).

**larry-xue/video-slide-extractor** (MIT)

- **מה הוא:** ‏"pure functions, zero dependencies". רץ בדפדפן וב־Node.
- **מה הוא לא:** המחבר מגדיר אותו "a change detector, not a complete converter".
- **טיפול באזורים זזים:** ‏"a region that never stops moving is dropped from the comparison". ה־README מונה במפורש את "the webcam bubble, the presenter tile, and the cursor".
- **ראיה לאיכות (לפי המחבר):**
  - 39 שקפים בהרצאה של 17 דקות מ־FOSDEM 2021: ‏"the difference between 39 slides and several hundred near-identical frames".
  - הכלי כוון ונבדק על "A 60-minute recorded class with 50-plus slides".
- **הקשר:** ‏"This is the open core of Video2Any", כלי שממיר בדפדפן סרטונים למצגות, ל־PDF ולכתוביות.
- **מקורות:** [README](https://github.com/larry-xue/video-slide-extractor) ו־[LICENSE](https://github.com/larry-xue/video-slide-extractor/blob/HEAD/LICENSE).

**נושא slide-extraction ב־GitHub:** ‏6 ריפו בלבד, עם 0–3 כוכבים כל אחד. מקור: [topic](https://github.com/topics/slide-extraction).

#### 1.3 כלי סיכום ל־YouTube, ותמלילים

**נושא youtube-summarizer ב־GitHub** ([topic](https://github.com/topics/youtube-summarizer))

- 59 ריפו, ורובם צעצועים.
- המוביל: Milkshiift/YouTubeTLDR. ‏254 כוכבים, כתוב ב־Rust, משתמש ב־Gemini, רישיון MIT. מקור: [LICENSE](https://github.com/Milkshiift/YouTubeTLDR/blob/HEAD/LICENSE).

**steipete/summarize** (MIT)

- **פעילות:** ‏6.8k כוכבים ו־2,276 commits.
- **גרסה:** ‏`@steipete/summarize` ‏0.26.0 מ־5/11/2026. דורש Node ≥24.
- **שקפים:**
  - `--slides`: המודל משבץ סמני `[slide:N]` לפי הסדר.
  - `--extract`: מוציא תמליל מתוזמן עם השקפים.
  - תקציב הטקסט לכל שקף מדורג: ‏120/200/320/480/700 תווים.
- **מקורות לכתוביות, לפי סדר הנסיגה:** youtubei, אחריו captionTracks, אחריו yt-dlp, ובסוף Apify.
- **תמלול מקומי:** ‏Parakeet-TDT 0.6B-v3 ו־Canary 1B-v2 ב־ONNX, דרך sherpa-onnx.
- **מקורות:** [README](https://github.com/steipete/summarize), ‏[docs/slides.md](https://github.com/steipete/summarize/blob/HEAD/docs/slides.md), ‏[docs/youtube.md](https://github.com/steipete/summarize/blob/HEAD/docs/youtube.md), ‏[docs/nvidia-onnx-transcription.md](https://github.com/steipete/summarize/blob/HEAD/docs/nvidia-onnx-transcription.md), ‏[npm](https://www.npmjs.com/package/@steipete/summarize) ו־[LICENSE](https://github.com/steipete/summarize/blob/HEAD/LICENSE).

**martinopiaggi/summarize** (MIT, ‏2026)

- מצבי פלט: "Q&A, fact-checks, tutorials, Mermaid diagrams, essays".
- זמין כ־CLI, ‏Streamlit, ‏API ו־Docker.
- מקורות: [GitHub](https://github.com/martinopiaggi/summarize) ו־[LICENSE](https://github.com/martinopiaggi/summarize/blob/HEAD/LICENSE).

**תוספי דפדפן**

- kazuki-sf/YouTube_Summary_with_ChatGPT: ‏MIT. מקור: [LICENSE](https://github.com/kazuki-sf/YouTube_Summary_with_ChatGPT/blob/HEAD/LICENSE).
- Glarity (sparticleinc/chatgpt-google-summary-extension): ‏⚠️ GPL-3.0. מקור: [LICENSE](https://github.com/sparticleinc/chatgpt-google-summary-extension/blob/HEAD/LICENSE).

**yuxino-labs/koma** (⚠️ אין LICENSE)

- **פעילות:** ‏299 כוכבים, עדכון אחרון 4/11/2026.
- **מה הוא מפיק:** סיכומים, פרקים, keyframes, וייצוא ל־SRT ול־JSON.
- **טכנולוגיה:** ‏TypeScript ו־Node 22.13+.
- **מגבלות ברירת מחדל:** ‏500MB ו־15 דקות.
- **אבטחה:** התיעוד שלו מזהיר שהגנת ייבוא ה־URL היא "not a complete SSRF defense".
- **מקורות:** [GitHub](https://github.com/yuxino-labs/koma) ו־[topic video-summarization](https://github.com/topics/video-summarization).

**נושא youtube-transcript ב־GitHub** ([topic](https://github.com/topics/youtube-transcript)): ‏417 ריפו. הבולטים:

| פרויקט | פרטים | רישיון | מקור |
|---|---|---|---|
| jdepoix/youtube-transcript-api | ‏8.6k כוכבים, גרסה 1.2.5 מ־5/11/2026 | MIT | [GitHub](https://github.com/jdepoix/youtube-transcript-api), ‏[PyPI](https://pypi.org/project/youtube-transcript-api/) |
| AeternaLabsHQ/pullmd | | ⚠️ AGPL-3.0 | [LICENSE](https://github.com/AeternaLabsHQ/pullmd/blob/HEAD/LICENSE) |
| JangHyuckYun/mcp-youtube-intelligence | דוחס בשרת כתוביות גולמיות של 2,000–30,000 טוקנים לכ־200–500 טוקנים לפני שהן מגיעות ל־LLM | Apache-2.0 | [README](https://github.com/JangHyuckYun/mcp-youtube-intelligence) |
| youtube-transcript (npm) | גרסה 1.3.1 | MIT | [npm](https://www.npmjs.com/package/youtube-transcript) |
| pytubefix | גרסה 11.2.1 מ־16/10/2026 | MIT | [PyPI](https://pypi.org/project/pytubefix/) |
| Panniantong/Agent-Reach | נותן לסוכן גישה לקריאה ולחיפוש באתרים, YouTube ביניהם | MIT | [GitHub](https://github.com/Panniantong/Agent-Reach), ‏[LICENSE](https://github.com/Panniantong/Agent-Reach/blob/HEAD/LICENSE) |

**נושא video-summarization ב־GitHub** ([topic](https://github.com/topics/video-summarization)): ‏252 ריפו.

| פרויקט | כוכבים | מה הוא | רישיון | מקור |
|---|---|---|---|---|
| NVIDIA VSS | 2k | Blueprint לחיפוש ולסיכום וידאו | Apache-2.0 | ראו להלן |
| zenstory-ai/video-recap-skills | 615 | מייצר סרטוני "סיכום־עלילה" בסינית דרך API חיצוני של MiMo. זה ייצור וידאו, לא ניתוח | MIT | [README](https://github.com/zenstory-ai/video-recap-skills), ‏[LICENSE](https://github.com/zenstory-ai/video-recap-skills/blob/HEAD/LICENSE) |
| pszemraj/vid2cleantxt | 229 | עדכון אחרון 10/2024 | Apache-2.0 | [LICENSE](https://github.com/pszemraj/vid2cleantxt/blob/HEAD/LICENSE) |
| NVIDIA/context-aware-rag | 93 | | Apache-2.0 | [LICENSE](https://github.com/NVIDIA/context-aware-rag/blob/HEAD/LICENSE) |
| grayhatdevelopers/vidxp | 59 | חיפוש מקומי לפי דיבור, צליל, סצנה ופעולה: ‏"Find the moment, not the timestamp" | MIT | [README](https://github.com/grayhatdevelopers/vidxp) |
| sidedwards/ai-video-summarizer | 65 | | ⚠️ אין LICENSE | [GitHub](https://github.com/sidedwards/ai-video-summarizer) |

**NVIDIA VSS** (video-search-and-summarization)

- **רישיון:** הריפו ב־Apache-2.0. אבל הרצת NIM מקומי דורשת "NVIDIA AI Enterprise developer licence".
- **שיטה:** סיכום ארוך נעשה "through chunking and aggregation of dense captions".
- **מודלים:** ‏Cosmos3 Nano Reasoner ו־Nemotron 3.5 Lightning 30B A3B.
- **חומרה:** דוגמת הפריסה היא 2×RTX PRO 6000. אין מצב CPU.
- **מקור:** [GitHub](https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization).

#### 1.4 רושמי פגישות ותמלול שולחני

**Zackriya-Solutions/meetily**

- **פעילות:** ‏32.6k כוכבים ו־3.6k forks. הגרסה האחרונה היא pre-release 0.4.1.
- **רישיון:** ‏MIT. מהדורת הקהילה "will remain free and open source (MIT)".
- **טכנולוגיה:** ‏Tauri, ‏Rust ו־Next.js.
- **ASR:** ‏whisper.cpp ו־Parakeet ONNX.
- **LLM:** ‏Ollama (המומלץ), ‏Claude, ‏Groq, ‏OpenRouter ו־OpenAI.
- **מהדורת PRO:** ‏$10 למשתמש לחודש. כוללת זיהוי דוברים, תבניות מותאמות ו־MCP.
- **מגבלות:** ייבוא קבצים (Import & Enhance) בבטא. נדרש מעבד עם AVX2.
- **מקורות:** [GitHub](https://github.com/Zackriya-Solutions/meetily), ‏[LICENSE.md](https://github.com/Zackriya-Solutions/meetily/blob/HEAD/LICENSE.md) ו־[topic meeting-notes](https://github.com/topics/meeting-notes).

**fastrepl/hyprnote**

- **מעבר:** הריפו מפנה ל־fastrepl/anarlog: ‏9.8k כוכבים, ‏MIT. ‏"The team is now building char".
- **ASR:** ‏Soniqo, מנוע הדיבור של macOS, ו־Soniox 5 בענן.
- **LLM:** ברירת המחדל היא "latest Claude Sonnet alias via OpenRouter".
- **מקורות:** [hyprnote](https://github.com/fastrepl/hyprnote) ו־[LICENSE של anarlog](https://github.com/fastrepl/anarlog/blob/HEAD/LICENSE).

**rishikanthc/Scriberr** (MIT)

- ‏3.1k כוכבים.
- ASR: ‏Parakeet, ‏Canary ו־Whisper/WhisperX. דיאריזציה ב־PyAnnote.
- יש תמונת CPU ותמונת CUDA. תזמון ברמת מילה.
- מקור: [GitHub](https://github.com/rishikanthc/Scriberr).

**kaixxx/noScribe** (⚠️ GPL-3.0)

- ‏2.2k כוכבים.
- faster-whisper ו־pyannote. יש Docker ל־CPU.
- מקורות: [GitHub](https://github.com/kaixxx/noScribe) ו־[LICENSE](https://github.com/kaixxx/noScribe/blob/HEAD/LICENSE.txt).

**thewh1teagle/vibe** (MIT)

- ‏8.0k כוכבים.
- מודלים: Whisper, ‏Nemotron 3.5 ו־Parakeet TDT v3.
- סיכומים דרך Claude API או Ollama. יש HTTP API.
- מקור: [GitHub](https://github.com/thewh1teagle/vibe).

**pluja/whishper** (⚠️ AGPL-3.0, 🪦)

- ‏3.1k כוכבים.
- הענף הנוכחי "will not receive any new releases or updates", כי מתבצע שכתוב ל־v4.
- commit אחרון ב־15/8/2025.
- מקורות: [GitHub](https://github.com/pluja/whishper) ו־[commits](https://github.com/pluja/whishper/commits).

**m-bain/whisperX** (BSD-2-Clause)

- **פעילות:** ‏25.2k כוכבים. גרסה 3.8.6 מ־25/5/2026.
- **דיאריזציה:** דרך `speaker-diarization-community-1` ‏(CC-BY-4.0). נדרש טוקן.
- **CPU:** ‏`--compute_type int8 --device cpu`.
- **מגבלה:** מילים עם תווים שאינם במילון, למשל "2014." או "£13.60", לא מקבלות תזמון.
- **מגבלת שפה:** ‏"Language specific wav2vec2 model is needed". עברית לא מופיעה ברשימת ברירת המחדל.
- **מקורות:** [GitHub](https://github.com/m-bain/whisperX) ו־[PyPI](https://pypi.org/project/whisperx/).

**chidiwilliams/buzz** (MIT)

- ‏22.6k כוכבים. גרסה 1.4.5 מ־23/8/2026.
- מקורות: [GitHub](https://github.com/chidiwilliams/buzz) ו־[PyPI buzz-captions](https://pypi.org/project/buzz-captions/).

**jhj0517/Whisper-WebUI** (Apache-2.0)

- ‏2.9k כוכבים.
- רכיבים: Silero VAD, ‏pyannote, ‏UVR להפרדת קול ו־NLLB לתרגום.
- ברירת המחדל: CUDA 12.8.
- מקור: [GitHub](https://github.com/jhj0517/Whisper-WebUI).

**murtaza-nasir/speakr** (⚠️ AGPL-3.0, עם רישיון מסחרי נפרד)

- ‏4.2k כוכבים. גרסה v0.10.19-alpha.
- פרומפטים לכל הקלטה, תגית או תיקייה, ותגיות נערמות.
- Inquire: סוכן שמצטט מקטעים.
- מקורות: [GitHub](https://github.com/murtaza-nasir/speakr) ו־[LICENSE](https://github.com/murtaza-nasir/speakr/blob/HEAD/LICENSE).

**mediar-ai/screenpipe** (⚠️ "Screenpipe Commercial License")

- הקוד לא בקוד פתוח, למרות שהוא גלוי.
- מקור: [LICENSE.md](https://github.com/mediar-ai/screenpipe/blob/HEAD/LICENSE.md).

**ריפו נוספים בנושא meeting-notes** ([topic](https://github.com/topics/meeting-notes), ‏1,185 ריפו):

| פרויקט | כוכבים | רישיון | פרטים | מקור |
|---|---|---|---|---|
| Vexa | 3k | Apache-2.0 | | [LICENSE](https://github.com/Vexa-ai/vexa/blob/HEAD/LICENSE) |
| video-db/call.md | 2.1k | ⚠️ אין LICENSE | | [README](https://github.com/video-db/call.md) |
| silverstein/minutes | | MIT | זיכרון שיחות מקומי שנחשף ללקוחות MCP | [README](https://github.com/silverstein/minutes) |
| stenolabs/stenoai | | MIT | עדכונים עד 29/10/2026 | [README](https://github.com/stenolabs/stenoai) |

#### 1.5 Video RAG וסוכני וידאו ארוך

**HKUDS/VideoRAG** (KDD 2026, ‏arXiv 2502.01549)

- **פעילות:** ‏3.5k כוכבים, עדכון אחרון 18/3/2026.
- **טענת קנה המידה:** ‏"Handle hundreds of hours on a single RTX 3090 (24GB)".
- **הבנצ'מרק LongerVideos:** ‏164 סרטונים, ‏602 שאילתות וכ־134.6 שעות. בקטגוריית ההרצאות: ‏135 סרטונים ו־376 שאילתות.
- **⚠️ רישיון כפול:** "Framework Architecture" ב־MIT. המימוש הנוכחי נשען על ImageBind ‏(CC BY-NC-SA 4.0, ‏"NonCommercial use only") ועל MiniCPM.
- **מקורות:** [GitHub](https://github.com/HKUDS/VideoRAG), ‏[LICENSE](https://github.com/HKUDS/VideoRAG/blob/HEAD/LICENSE) ו־[arXiv](https://arxiv.org/abs/2502.01549).

**Leon1207/Video-RAG-master** (NeurIPS 2025, ‏arXiv 2411.13093, ⚠️ אין LICENSE)

- **פעילות:** ‏466 כוכבים. commit אחרון 26/6/2026: הוספת backends אופציונליים.
- **שיטה:** ‏"three types of visually-aligned auxiliary texts (OCR, ASR, and object detection)".
- **רכיבים:** ‏EasyOCR, ‏APE, ‏Contriever ו־faiss-cpu.
- **מקורות:** [GitHub](https://github.com/Leon1207/Video-RAG-master), ‏[commits](https://github.com/Leon1207/Video-RAG-master/commits) ו־[arXiv](https://arxiv.org/abs/2411.13093).

**שלושה פרויקטים בשם VideoAgent**

1. **wxh1996/VideoAgent** (ECCV 2024): ⚠️ אין LICENSE. מקור: [GitHub](https://github.com/wxh1996/VideoAgent).
2. **YueFan1014/VideoAgent** (Apache-2.0): נבדק על RTX 4090, עם Video-LLaVA ו־OpenAI. מקור: [LICENSE](https://github.com/YueFan1014/VideoAgent/blob/HEAD/LICENSE).
3. **HKUDS/VideoAgent** (MIT, ‏EMNLP 2026)
   - ‏2.0k כוכבים. ‏"An All-in-One Framework for Understanding, Editing, and Generation".
   - "Claude is required as it powers the Agentic Graph Router".
   - Gemini לכתוביות. ‏ImageBind מקומי (⚠️). ‏"GPU Memory: 8GB".
   - מקורות: [README](https://github.com/HKUDS/VideoAgent) ו־[LICENSE](https://github.com/HKUDS/VideoAgent/blob/HEAD/LICENSE).

**VideoTree ו־LLoVi**

- VideoTree (CVPR 2025): ‏MIT. מקור: [LICENSE](https://github.com/Ziyang412/VideoTree/blob/HEAD/LICENSE).
- LLoVi: ‏MIT. השיטה: כתוביות קצרות לכל קליפ, ואחריהן LLM שמסכם ועונה. מקור: [LICENSE](https://github.com/CeeZh/LLoVi/blob/HEAD/LICENSE).

**microsoft/DeepVideoDiscovery** (MIT, ‏NeurIPS 2025)

- **פעילות:** ‏427 כוכבים, ‏20 forks ו־34 commits. החדשה האחרונה מ־15/10/2025: מדריך לשחזור תוצאות LVBench.
- **lite_mode:** ‏"Add `lite_mode` to enable a lightweight version of the agent that uses only subtitles" (16/7/2025).
- **כלים:** אחד הכלים הוא `global_browse_tool`, שנותן מבט־על על הווידאו מתיאורי טקסט של קליפים.
- **מודלים:** התוצאות הושגו עם o3. יש תמיכה ב־OpenAI וב־Azure OpenAI.
- **תוצאות:** ‏LVBench ‏74.2%, ועם תמלילים 76.0%.
- **מקורות:** [GitHub](https://github.com/microsoft/DeepVideoDiscovery) ו־[arXiv](https://arxiv.org/abs/2505.18079).

**ziqipang/MR-Video** (MIT, ‏NeurIPS 2025)

- **map:** תפיסה צפופה של קליפים קצרים.
- **reduce:** צבירה, עם שמות עקביים.
- **תוצאה:** ‏"over 10% accuracy improvement" ב־LVBench.
- **מגבלה:** דורש מפתחות OpenAI ו־Gemini.
- **מקורות:** [GitHub](https://github.com/ziqipang/MR-Video) ו־[arXiv](https://arxiv.org/abs/2504.16082).

**yeliudev/VideoMind** (BSD-3-Clause, ‏ICLR 2026)

- **שיטה:** Chain-of-LoRA על Qwen2-VL.
- **תוצאות (2B/7B):** ‏Video-MME long ‏46.3/49.2, ‏LVBench ‏35.4/40.8.
- **הדמו:** רץ על cpu-basic.
- **מקורות:** [GitHub](https://github.com/yeliudev/VideoMind) ו־[Space](https://huggingface.co/spaces/yeliudev/VideoMind-2B).

**LongVideoAgent** (ACL 2026)

- **שיטה:** ‏"a master LLM coordinates a grounding agent to localize question-relevant segments", יחד עם סוכן ראייה. המאסטר "is trained with reinforcement learning".
- **בנצ'מרקים:** ‏LongTVQA ו־LongTVQA+.
- **קוד:** בתקציר כתוב שהקוד והנתונים "will be shared" בדף הפרויקט. גרסה v1 מ־23/12/2025.
- **מקורות:** [arXiv](https://arxiv.org/abs/2512.20618) ו־[ACL](https://aclanthology.org/2026.acl-long.1876.pdf).

**om-ai-lab/OmAgent**

- **פעילות:** ‏2.7k כוכבים ו־534 commits. אין חדשות או releases מתוארכים בדף.
- **רישיון:** ‏Apache-2.0. אבל החבילה omagent_core 0.2.4 ב־PyPI (מ־24/2/2025) מסווגת MIT, וזו **סתירה**. בסך הכל יש לה 4 גרסאות.
- **מקורות:** [GitHub](https://github.com/om-ai-lab/OmAgent) ו־[PyPI](https://pypi.org/project/omagent-core/).

**video-db/Director** (MIT)

- **פעילות:** ‏1.6k כוכבים. יותר מ־20 סוכנים.
- **תלות:** תלוי ב־VideoDB, שמספק "cloud storage, indexing and streaming".
- **SDK:** ‏`videodb` ‏0.5.1 מ־24/7/2026, ‏Apache-2.0.
- **מקורות:** [GitHub](https://github.com/video-db/Director) ו־[PyPI](https://pypi.org/project/videodb/).

**נושא long-video-understanding ב־GitHub** ([topic](https://github.com/topics/long-video-understanding), ‏36 ריפו)

| פרויקט | כוכבים | הערה | רישיון | מקור |
|---|---|---|---|---|
| MOSS-VL | 825 | | Apache-2.0 | [LICENSE](https://github.com/OpenMOSS/MOSS-VL/blob/HEAD/LICENSE) |
| LongVT | 274 | CVPR 2026 | Apache-2.0 | [LICENSE](https://github.com/EvolvingLMMs-Lab/LongVT/blob/HEAD/LICENSE) |
| OmniAgent | | ICML 2026 | Apache-2.0 | [LICENSE](https://github.com/HarryHsing/OmniAgent/blob/HEAD/LICENSE) |

**נושא video-rag ב־GitHub** ([topic](https://github.com/topics/video-rag), ‏26 ריפו)

- **PixelML/av** (Apache-2.0)
  - "Video Memory — Ingest videos, search by natural language, ask questions with RAG citations".
  - מקור: [README](https://github.com/PixelML/av).
- **smallthinkingmachines/video-context-mcp** (MIT)
  - **הכלים:**
    - `ingest_video`.
    - `get_video_timeline`: מבט־על עם פרקים.
    - `search_videos`: ‏"Hybrid search (full-text + semantic, RRF-fused) over speech AND on-screen text".
    - `get_transcript`: לטווח זמן.
    - `peek_frame`: ‏"The keyframe image nearest a timestamp + its OCR text — *you* look at it".
    - `crop_region`: זום לאזור צפוף.
  - **הנחיה לסוכן:** "Answer with video_id and timestamps".
  - **נסיגה מקומית:** ‏Tesseract.js ו־Transformers.js.
  - מקורות: [README](https://github.com/smallthinkingmachines/video-context-mcp) ו־[LICENSE](https://github.com/smallthinkingmachines/video-context-mcp/blob/HEAD/LICENSE).

#### 1.6 חיפוש בתמלילים, פרקים, כרטיסיות ומפות חשיבה

**NotJoeMartinez/yt-fts** (Unlicense, 🪦)

- **פעילות:** ‏1.8k כוכבים. ‏PyPI 0.1.62 מ־4/7/2025.
- **סטטוס:** ה־README אומר: ‏"This project is **abandoned** until unemployment inevitably finds me again."
- **המנגנון:**
  - כתוביות של ערוץ שלם נשמרות ב־SQLite FTS.
  - התוצאה היא URL עם חותמת זמן.
  - חיפוש סמנטי דרך embeddings ו־Chroma.
  - `diagnose` מאבחן שגיאות 403.
- **מקורות:** [README](https://github.com/NotJoeMartinez/yt-fts), ‏[PyPI](https://pypi.org/project/yt-fts/) ו־[LICENSE](https://github.com/NotJoeMartinez/yt-fts/blob/HEAD/LICENSE).

**מחוללי פרקים**

הנושא youtube-chapters ב־GitHub מכיל 19 ריפו בלבד ([topic](https://github.com/topics/youtube-chapters)):

| פרויקט | כוכבים | מה הוא |
|---|---|---|
| ris58h/youtube-chapters-in-player | 57 | תוסף שמציג פרקים קיימים. לא מחולל |
| NotTwist/Timecode-Generator | 13 | זיהוי סצנות וכותב CLIP-GPT |
| jcspeegs/loups | 1 | התאמת תבניות ו־OCR |
| hhkaos/youtube-timestamp-validator | 0 | בודק פורמט, סדר ואורך של חותמות פרקים בדפדפן |
| Scempyyy/EchoPhalanx | 0 | מסכם הרצאות ופודקאסטים עם סמני פרקים |

**מחוללי כרטיסיות (Anki)**

- **הנושא flashcard-generator:** ‏64 ריפו. מקור: [topic](https://github.com/topics/flashcard-generator).
- **SYuan03/Skill-Anything** (MIT, ‏346 כוכבים). גרסה v0.4.1 מוסיפה:
  - "Every LLM-generated quiz question, flashcard, and exercise must include a verbatim source quote. Skill-Anything verifies the quote against the supplied text and rejects unsupported items".
  - "Oversized chapters are split into ordered prompt windows instead of silently discarding everything after the first 5–6K characters".
  - `sa audit pack.yaml --strict` כשער CI דטרמיניסטי.
  - מקורות: [README](https://github.com/SYuan03/Skill-Anything) ו־[LICENSE](https://github.com/SYuan03/Skill-Anything/blob/HEAD/LICENSE).
- **a-sinkevich/book2anki** (MIT, ‏2026): ‏Claude CLI (המומלץ) או Anthropic API, עם `--depth 0..2`. מקור: [LICENSE](https://github.com/a-sinkevich/book2anki/blob/HEAD/LICENSE).
- **yomazini/VidMind:** ⚠️ אין LICENSE. מקור: [GitHub](https://github.com/yomazini/VidMind).
- **genanki** (MIT): גרסה 0.13.1 מ־12/11/2023. מקור: [PyPI](https://pypi.org/project/genanki/).

**מפות חשיבה**

- **הנושא mindmap-generator:** ריפו אחד, עם 0 כוכבים. מקור: [topic](https://github.com/topics/mindmap-generator).
- **markmap** (MIT): ‏markmap-lib ‏0.18.13. מקורות: [LICENSE](https://github.com/markmap/markmap/blob/HEAD/LICENSE) ו־[npm](https://www.npmjs.com/package/markmap-lib).
- **תבניות Fabric:** ‏create_markmap_visualization ו־create_conceptmap (Vis.js) — ראו סעיף 2.
- **Co-STORM:** מפת חשיבה דינמית — ראו סעיף 2.

#### 1.7 "מחברות מחקר" ופלטפורמות ידע (נושא GitHub עם 803 ריפו: [topic](https://github.com/topics/notebooklm))

| פרויקט | כוכבים | רישיון | פרטים | מקור |
|---|---|---|---|---|
| MODSetter/SurfSense | 16.8k | Apache-2.0 | | [LICENSE](https://github.com/MODSetter/SurfSense/blob/HEAD/LICENSE) |
| souzatharsis/podcastfy | 6.8k | Apache-2.0 | | [LICENSE](https://github.com/souzatharsis/podcastfy/blob/HEAD/LICENSE) |
| CaviraOSS/PageLM | | ⚠️ "PageLM Community License" | רק "personal, educational, or non-commercial research purposes" | [LICENSE.md](https://github.com/CaviraOSS/PageLM/blob/HEAD/LICENSE.md) |
| rmusser01/tldw_server | 1.5k | ⚠️ ריבוי רישיונות | "ingesting media, transcribing, analyzing" | [LICENSE](https://github.com/rmusser01/tldw_server/blob/HEAD/LICENSE) |
| run-llama/notebookllama | | MIT | | [LICENSE](https://github.com/run-llama/notebookllama/blob/HEAD/LICENSE) |
| Cinnamon/kotaemon | | Apache-2.0 | | [LICENSE](https://github.com/Cinnamon/kotaemon/blob/HEAD/LICENSE.txt) |
| khoj-ai/khoj | | ⚠️ AGPL-3.0 | | [LICENSE](https://github.com/khoj-ai/khoj/blob/HEAD/LICENSE) |

**פירוט הרישיונות של tldw_server:** השרת ב־GPL-3.0-only. החזית ותוסף הדפדפן תחת "PolyForm Perimeter License 1.0.1". ה־OpenAPI ב־Apache.

**lfnovo/open-notebook** (MIT)

- **טרנספורמציות מובנות:** ‏Paper Analysis, ‏Key Insights, ‏Dense Summary, ‏Reflection Questions, ‏Table of Contents ו־Simple Summary.
- **הכלל:** ‏"One job per transformation. "Key arguments" and "Open questions" as two transformations give cleaner insights than one prompt asking for both."
- **מקורות:** [transformations.md](https://github.com/lfnovo/open-notebook/blob/HEAD/docs/3-USER-GUIDE/transformations.md) ו־[LICENSE](https://github.com/lfnovo/open-notebook/blob/HEAD/LICENSE).

#### 1.8 טבלת סיכום: הפרויקטים שהכי רלוונטיים לנו

מקורות הטבלה הם הקישורים בסעיפים 1.1–1.7.

| פרויקט | פעילות (11/2026) | רישיון | ארכיטקטורה ומודלים | CPU בלבד? | ראיות לאיכות | מה אפשר לקחת |
|---|---|---|---|---|---|---|
| lecture-to-notes | 2026, פעיל | MIT | שלבים דטרמיניסטיים A–E, ואחריהם סינתזה בחוזה. faster-whisper, ‏Surya, ‏RapidOCR, ‏minicpm-v | כן, כנסיגה ב־int8 | מדידת מונחים של המחבר | **העובד:** חוזה, provenance ורשימת חשודים. **ה־PWA:** נגן מסונכרן |
| slidoc | 2026 | MIT | ffmpeg, ‏whisper.cpp + שער איכות, סוכן־משנה | כן | 7.5 שעות (לפי המחבר) | **העובד:** שערי איכות לזיהוי לולאות הזיה ולמסכים זזים |
| video-slide-extractor | 28/8/2026 | MIT | גלאי שינוי טהור, בלי תלויות | כן, רץ בדפדפן | 39 שקפים ב־FOSDEM | **ה־PWA או העובד:** מסכת אזור זז |
| steipete/summarize | 0.26.0, ‏5/11/2026 | MIT | Node: סמני `[slide:N]`, ‏Parakeet/Canary ב־ONNX | כן | אין מדידה | שילוב שקפים בטקסט ותקציב לשקף |
| lecture2notes | 5/2025 | ⚠️ AGPL | CNN, ‏OCR, ‏BART/PEGASUS | חלקית | המסווג (הערה 03) | רעיונות בלבד |
| Meetily | 0.4.1 pre | MIT | Tauri, ‏whisper.cpp, ‏Parakeet | כן (AVX2) | אין מדידה | כמעט כלום. מתמקד בלכידה חיה |
| WhisperX | 3.8.6, ‏5/2026 | BSD-2 | faster-whisper, ‏wav2vec2, ‏pyannote | כן (int8) | מאמר | יישור, אבל אין מודל עברי מובנה |
| VideoRAG | 3/2026 | MIT + ⚠️ NC-SA | גרף ידע ו־ImageBind | לא (3090) | Video-MME long ‏60.2 | רק את המסגרת |
| DVD | 10/2025 | MIT | סוכן עם כלים, o3 | ה־LLM בענן | LVBench ‏74.2/76.0 | lite_mode עם כתוביות בלבד, מותאם ל־Claude |
| MR. Video | 2025 | MIT | map→reduce | לא (Gemini ו־OpenAI) | +10% ב־LVBench | התבנית בלבד |
| video-context-mcp | 2026 | MIT | MCP: חיפוש היברידי, ‏peek_frame | כן | אין מדידה | עיצוב הכלים לסוכן "שאל את ההרצאה" |
| yt-fts | 🪦 7/2025 | Unlicense | SQLite FTS ו־Chroma | כן | אין מדידה | FTS5 עם קישורי זמן (נחלת הכלל) |
| Skill-Anything | v0.4.1 | MIT | פלט מאומת בציטוט מילולי | כן | שער audit | אימות ציטוט וחלונות במקום קטיעה |

### Inferences

**1. ההתאמה הכי טובה לאילוצים שלנו: lecture-to-notes**

הוא מתאים לנו בשלושה מובנים: הוא מראה איך מחזיקים את כל שלבי הראיות בלי LLM, הוא רץ על CPU, וחוזה הסינתזה שלו ניטרלי לספק.

ההבדלים מאיתנו:
- הוא משתמש ב־faster-whisper ובכלי OCR אחרים. אצלנו: ‏Parakeet, ‏ivrit-ai ו־RapidOCR.
- נתיב ה־ASR "האיכותי" שלו הוא Gemini, שאסור אצלנו.
- את הניקוד וה־tiers הוא מבקש מה־LLM. אצלנו עדיף לחשב אותם בקוד, והחוזה שלו עצמו מתיר את זה.

**2. רוב מערכות ה־Video RAG והסוכנים לא ירוצו אצלנו כמו שהן**

הן תלויות ב־GPU, ב־Gemini או ב־OpenAI, או ב־ImageBind (NC). מה שכן ניתן להעברה הוא התבנית:
- סוכן מעל טקסט עזר מעוגן בזמן (OCR+ASR), שכבר יש לנו.
- כלי "הצצה לפריים" בזמן T.
- map-reduce עם שמות עקביים.

**3. אין בקוד הפתוח כלי בשל ליצירת פרקים או מפות חשיבה מהרצאה**

הקיים הוא תבניות פרומפט, או תוספים שמציגים פרקים קיימים. לכן את הפרקים כדאי לבנות אצלנו מגבולות נושא שמחושבים על התמליל והשקפים, ואת השמות לתת ל־Claude.

**4. הכשלים של slidoc הם בדיקות קבלה מוכנות לעובד שלנו**

- זיהוי שורה שחוזרת על עצמה בתמלול ארוך.
- מסכת אזור זז, למשל סרגל צ'אט או חלון מצלמה.
- הגבלת מקביליות של שלבי LLM שקוראים תמונות.

**5. "Caption first"**

ב־KIRVO, ב־steipete וב־yt-fts דפוס הפתיחה זהה: לנסות קודם כתוביות קיימות, ולתמלל רק כשאין. אצלנו זה רלוונטי רק אם המסלול המשפטי והטכני בהערה 07 מאשר משיכת כתוביות. ותזמון ברמת מילה ממילא דורש ASR או יישור משלנו.

### Gaps
- **כוכבים ותאריכים חסרים:** לא נאספו עבור lecture-to-notes, ‏slidoc, ‏video-slide-extractor, ‏martinopiaggi/summarize ועוד כמה. סרגל ה־Releases של GitHub לא נקלט בשליפה, ולכן התאריכים הם מ־PyPI/npm, מחדשות ב־README או מדף ה־commits.
- **מדידה בלתי תלויה:** לא נמצאה לאף פייפליין הרצאה→הערות. כל טענות האיכות הן של המחברים.
- **עברית:** לא נמצא אף פייפליין שבדק עברית. ‏WhisperX דורש מודל wav2vec2 לשפה, ועברית איננה בברירת המחדל.
- **LongVideoAgent:** מצב הקוד לא ברור. התקציר אומר רק "will be shared".
- **Director:** לא בדקתי את כל הסוכנים כדי להפריד בין מה שרץ מקומית לבין מה שתלוי בענן של VideoDB.

## 2. ספריות דפוסי פרומפט לחילוץ תובנות: המבנה, ומה מייצר עומק לעומת פלט גנרי

### Takeaway
הדפוסים הציבוריים נבדלים בעיקר במה שהם דורשים **כראיה**:

| מקור | מה הוא נותן | הבעיה |
|---|---|---|
| Fabric | טקסונומיה עשירה של סוגי ידע (רעיונות, תובנות, ציטוטים, הרגלים, עובדות, הפניות, המלצות) ועדשות ביקורת (טענות, ויכוח, הפרכה) | מכסות קבועות, ספירת מילים מדויקת וחותמות זמן שה־LLM כותב בעצמו: שלושה מקורות לריפוד ולשגיאות |
| Anthropic ו־OpenAI | המכניקה: מסמך בראש הפרומפט, ציטוטים לפני ניתוח, Citations, חלוקה עם `detail` | |
| STORM/Co-STORM ו־Chain of Density | מנועי העומק: שאלות לפי פרספקטיבה, מנחה שמעלה מידע שלא נוצל, וציפוף בלי לאבד ישויות | |

עומק נוצר מראיות מעוגנות ומשאלות ממוקדות, כל אחת במעבר משלה. גנריות נוצרת מ"סכם את זה" במעבר אחד, ממכסות ומפרסונות מנופחות.

### Cited Findings

#### 2.1 Fabric (danielmiessler/fabric)

**הפרויקט**

- **פעילות:** ‏44.6k כוכבים ו־4,555 commits. ‏MIT, כתוב ב־Go.
- **שחרור אחרון ברשימה:** ‏v1.4.447 מ־16/4/2026, ‏"Claude Opus 4.7". ייתכן שיש מאוחרים יותר, כי סרגל ה־Releases לא נקלט.
- **מקורות:** [README](https://github.com/danielmiessler/fabric) ו־[LICENSE](https://github.com/danielmiessler/fabric/blob/HEAD/LICENSE).

**התבניות**

- קובץ ההסברים מונה 265 תבניות. **אין בו `create_study_guide`.**
- תבניות רלוונטיות לסרטונים: summarize_lecture, ‏create_video_chapters, ‏youtube_summary, ‏extract_instructions, ‏summarize_meeting, ‏transcribe_minutes ו־concall_summary.
- **באג בקובץ ההסברים:** התיאורים של create_quiz ושל create_reading_plan הוחלפו זה בזה.
- מקור: [pattern_explanations.md](https://raw.githubusercontent.com/danielmiessler/fabric/main/data/patterns/pattern_explanations.md).

**קלט מ־YouTube** ([README](https://github.com/danielmiessler/fabric))

- `-y URL` עם `--transcript`, ‏`--transcript-with-timestamps`, ‏`--comments`, ‏`--metadata` ו־`--yt-dlp-args`.

**אסטרטגיות** ([README](https://github.com/danielmiessler/fabric))

אסטרטגיה היא תוספת לפרומפט המערכת, ונשמרת כקובץ JSON:

| שם | מה היא עושה |
|---|---|
| cot | חשיבה צעד־צעד |
| cod | Chain-of-Draft: ‏"5 words max per step" |
| tot | כמה מסלולי חשיבה ובחירת הטוב ביניהם |
| aot | פירוק לתת־בעיות אטומיות |
| ltm | מהקל לקשה |
| self-consistent | כמה מסלולים והכרעה ברוב |
| self-refine | תשובה, ביקורת, ליטוש |
| reflexion | תשובה, ביקורת קצרה, תשובה משופרת |
| standard | תשובה ישירה |

**extract_wisdom** ([system.md](https://raw.githubusercontent.com/danielmiessler/fabric/main/data/patterns/extract_wisdom/system.md))

| חלק | כמות | דרישה מיוחדת |
|---|---|---|
| SUMMARY | 25 מילה | כולל "who is presenting" |
| IDEAS | 20–50 | לפחות 25 |
| INSIGHTS | 10–20 | "fewer, more refined, more insightful, and more abstracted"; לפחות 10 |
| QUOTES | 15–30 | "Use the exact quote text from the input", עם שם הדובר |
| HABITS | 15–30 | |
| FACTS | 15–30 | "valid facts about the greater world" |
| REFERENCES | כולן | |
| ONE-SENTENCE TAKEAWAY | 15 מילה | |
| RECOMMENDATIONS | 15–30 | |

כללי הפלט:
- "Write the IDEAS bullets as exactly 16 words". אותו כלל חל על RECOMMENDATIONS, ‏HABITS, ‏FACTS ו־INSIGHTS.
- לפחות 20 פריטים בשאר החלקים.
- בלי חזרות.
- "Do not start items with the same opening words".

**extract_insights_dm** ([system.md](https://raw.githubusercontent.com/danielmiessler/fabric/main/data/patterns/extract_insights_dm/system.md))

- פרסונה של "4,312 IQ".
- המטרה: ‏"ensure that no single valuable point is missed".
- כולל דוגמת פלט ארוכה מפודקאסט.

**extract_wisdom_dm** ([system.md](https://raw.githubusercontent.com/danielmiessler/fabric/main/data/patterns/extract_wisdom_dm/system.md))

- משווה את הפלט ל־"reference solution" ומדרג לפי "creativity, elegance, comprehensiveness".

**extract_insights** ([system.md](https://raw.githubusercontent.com/danielmiessler/fabric/main/data/patterns/extract_insights/system.md))

- 10 תובנות, כ־"8 word bullets in order of surprise, novelty, and importance".
- מבקשת ניסוח פשוט ונגיש בקולו של מסאי מסוים, שאת שמו היא מציינת. לא נעתיק את הניסוח הזה.

**extract_alpha** ([system.md](https://raw.githubusercontent.com/danielmiessler/fabric/main/data/patterns/extract_alpha/system.md))

- נשען על תורת האינפורמציה: ‏"the only real information is the stuff that's different and anything that's the same as kind of background noise".
- מבקש 24 רעיונות.

**summarize_lecture** ([system.md](https://raw.githubusercontent.com/danielmiessler/fabric/main/data/patterns/summarize_lecture/system.md))

- **המבנה:**
  - כותרת לכל נושא, ותתי־כותרות לתתי־נושאים ולכלים.
  - "For each topic or subject provide the most accurate definition without making guesses".
  - SUMMARY של 25 מילה.
  - TOOLS: כל כלי שהוזכר, עם תיאור של שורה.
  - ONE-SENTENCE TAKEAWAY של 15 מילה.
- **קלט ופלט:** הקלט בפורמט `[HH:MM:SS.mmm --> …]`, והפלט `HH:MM:SS`.
- **כללים לחותמות הזמן:**
  - "Ensure all output timestamps are sequential and fall within the length of the content".
  - "ENSURE the output timestamps and topics are shown gradually and evenly incrementing".
- **הדוגמה סותרת את הכלל:** בדוגמת הפלט מופיע `01:29:06` ומיד אחריו `00:09:36`.

**create_video_chapters** ([system.md](https://raw.githubusercontent.com/danielmiessler/fabric/main/data/patterns/create_video_chapters/system.md))

- אותה דוגמה שבורה, אותה סתירה.
- שמות פרקים ב־"2-3 capitalized words".

**youtube_summary** ([system.md](https://raw.githubusercontent.com/danielmiessler/fabric/main/data/patterns/youtube_summary/system.md))

- "Account for possible transcription errors and typos by using context to infer intended meanings".
- חותמות `[HH:MM:SS]` לפני כל נקודה.

**analyze_presentation** ([system.md](https://raw.githubusercontent.com/danielmiessler/fabric/main/data/patterns/analyze_presentation/system.md))

- ציון 1–10 בשלושה צירים, ולכל אחד רשימת Instances:
  - **IDEAS:** חידוש.
  - **SELFLESSNESS:** תוכן מול עצמי. בדוגמה: ‏"referred to themselves 14 times".
  - **ENTERTAINMENT.**
- משווה בין המטרה המוצהרת למטרה בפועל.

**get_wow_per_minute** ([system.md](https://raw.githubusercontent.com/danielmiessler/fabric/main/data/patterns/get_wow_per_minute/system.md))

- "Wow is defined as: Surprise * Novelty * Insight * Value * Wisdom".
- ציון 0–10 לדקה, בפלט JSON.
- הוראות תיאטרליות: ‏"at least 319 times".
- ה־JSON בדוגמה פגום: אחרי כמה שדות מופיע `25` שלא במקומו.

**extract_instructions** ([system.md](https://raw.githubusercontent.com/danielmiessler/fabric/main/data/patterns/extract_instructions/system.md))

- Objectives: ‏3–10 תבליטים של 15 מילה.
- אחריהם רשימה ממוספרת של צעדים.
- "Include any crucial details or warnings mentioned in the video".
- "Maintain the original order of steps as presented in the video".

**explain_terms** ([system.md](https://raw.githubusercontent.com/danielmiessler/fabric/main/data/patterns/explain_terms/system.md))

- לכל מונח: הגדרה של 2 משפטים, ‏Analogy ו־Why It Matters.
- סדר המונחים נקבע לפי מה שהגיוני להסביר קודם.

**to_flashcards** ([system.md](https://raw.githubusercontent.com/danielmiessler/fabric/main/data/patterns/to_flashcards/system.md))

- **העקרונות:**
  - "Minimum information principle".
  - "Optimize wording".
  - "No external context": בלי "according to the text".
- **סתירה בפורמט:** פעם נדרשת טבלת Markdown ופעם CSV.
- **הדוגמה מעגלת מספרים:**
  - הטקסט: ‏"averaging 396 m below sea level", ‏"74 km long".
  - הכרטיסים: ‏"400 meters" ו־"70 km".

**create_flash_cards** ([system.md](https://raw.githubusercontent.com/danielmiessler/fabric/main/data/patterns/create_flash_cards/system.md))

- שאלה של 8–16 מילה ותשובה של עד 32 מילה.

**create_quiz** ([system.md](https://raw.githubusercontent.com/danielmiessler/fabric/main/data/patterns/create_quiz/system.md))

- עד שלוש שאלות לכל יעד למידה.
- ברירת מחדל: רמת סטודנט מתקדם.
- "Do not answer the questions".

**analyze_claims** ([system.md](https://raw.githubusercontent.com/danielmiessler/fabric/main/data/patterns/analyze_claims/system.md))

- ARGUMENT SUMMARY של פחות מ־30 מילה.
- לכל טענה:
  - CLAIM של פחות מ־16 מילה.
  - ראיות בעד ונגד עם הפניות: ‏"DO NOT make any of those up".
  - LOGICAL FALLACIES עם ציטוטים קצרים.
  - CLAIM RATING.
  - LABELS.
- בסוף: OVERALL ANALYSIS.

**summarize_debate** ([system.md](https://raw.githubusercontent.com/danielmiessler/fabric/main/data/patterns/summarize_debate/system.md))

- **המבנה:**
  - PRIMARY ARGUMENT, עד 24 מילה.
  - הטיעונים של כל צד.
  - MIND-CHANGING EVIDENCE לכל צד: ‏"what evidence each would accept to change their mind".
  - ARGUMENT STRENGTH ANALYSIS עם מנצח.
- **באגים של העתק־הדבק:** בחלק של הצד הראשון כתוב "arguments made by the second party".

**check_falsifiability** ([system.md](https://raw.githubusercontent.com/danielmiessler/fabric/main/data/patterns/check_falsifiability/system.md))

- לכל טענה שואלים: ‏"What observation or evidence would prove this wrong?"
- התוצאה אחת משלוש: FALSIFIABLE, ‏UNFALSIFIABLE או MOVING GOALPOSTS.
- בודקים גם "definitional escape hatches".

**extract_patterns** ([system.md](https://raw.githubusercontent.com/danielmiessler/fabric/main/data/patterns/extract_patterns/system.md))

- 20–50 דפוסים, משוקללים "most importantly how often they showed up in the data".
- META: מאיפה כל דפוס הגיע, למשל "The same idea was mentioned by both John and Jane".

**create_idea_compass** ([system.md](https://raw.githubusercontent.com/danielmiessler/fabric/main/data/patterns/create_idea_compass/system.md))

- רעיון → הגדרה → ראיות → מקור.
- ארבעה כיוונים:
  - West: דומה.
  - East: מנוגד.
  - North: השאלה שהולידה.
  - South: לאן זה מוביל.

**summarize_meeting ו־transcribe_minutes** ([summarize_meeting](https://raw.githubusercontent.com/danielmiessler/fabric/main/data/patterns/summarize_meeting/system.md), ‏[transcribe_minutes](https://raw.githubusercontent.com/danielmiessler/fabric/main/data/patterns/transcribe_minutes/system.md))

- **הכלל הטוב:** חלק שאין עליו מידע מסומן "No information available".
- **הכלל הבעייתי:** ‏"exactly 16 words".

**create_conceptmap** ([system.md](https://raw.githubusercontent.com/danielmiessler/fabric/main/data/patterns/create_conceptmap/system.md))

- מפה ב־Vis.js עם קשתות פעליות, למשל "causes" ו־"depends on".

#### 2.2 Semantic Kernel: ‏SummarizePlugin ‏(MIT)

**Summarize** ([skprompt.txt](https://raw.githubusercontent.com/microsoft/semantic-kernel/main/prompt_template_samples/SummarizePlugin/Summarize/skprompt.txt))

- **כללים:**
  - "DONT WASTE WORDS".
  - "USE SHORT, CLEAR, COMPLETE SENTENCES".
  - "DO NOT USE BULLET POINTS OR DASHES".
  - "USE ACTIVE VOICE".
  - "MAXIMIZE DETAIL, MEANING".
  - "FOCUS ON THE CONTENT".
- **[BANNED PHRASES]:** ‏"This article", ‏"This document", ‏"This page", ‏"This material".

**Notegen** ([skprompt.txt](https://raw.githubusercontent.com/microsoft/semantic-kernel/main/prompt_template_samples/SummarizePlugin/Notegen/skprompt.txt))

- "Produce key points for memory. Give memory a name. Extract only points worth remembering".
- "You will use this memory to analyze the rest of this document".
- כלומר: הערות מצטברות לאורך המסמך.

**Topics** ([skprompt.txt](https://raw.githubusercontent.com/microsoft/semantic-kernel/main/prompt_template_samples/SummarizePlugin/Topics/skprompt.txt))

- ביטויים קצרים, ‏"Return in JSON".

**רישיון:** [LICENSE](https://github.com/microsoft/semantic-kernel/blob/HEAD/LICENSE).

#### 2.3 Anthropic: ה־cookbook והתיעוד

**ה־cookbook**

- claude-cookbooks ו־anthropic-cookbook מכילים את אותו README, ברישיון MIT.
- מקורות: [LICENSE](https://github.com/anthropics/claude-cookbooks/blob/HEAD/LICENSE) ו־[anthropic-cookbook](https://github.com/anthropics/anthropic-cookbook/blob/HEAD/LICENSE).

**מדריך הסיכום** ([guide.ipynb](https://github.com/anthropics/claude-cookbooks/blob/HEAD/capabilities/summarization/guide.ipynb))

| טכניקה | מה היא עושה |
|---|---|
| basic | הסיכום עטוף ב־`<summary>`, עם stop sequence ו־"Do not preamble" |
| guided summarization | "explicitly define a framework for the model to abide by" |
| domain-specific | מסגרת לפי סוג המסמך. חלקי XML שמפוענחים בקוד |
| meta-summarization | ‏`chunk_size=2000` תווים. ‏`claude-haiku-5-5` מסכם כל חתיכה, ו־`claude-sonnet-5-5` מאחד |
| Summary Indexed Documents | RAG ברמת מסמך דרך סיכומים מדורגים |

- באיחוד של meta-summarization מופיע הכלל: ‏"If any information is not explicitly stated in the document, note it as "Not specified"".
- **הערכה ב־promptfoo:** ‏ROUGE, שופט LLM ו־contains. בריצה המתועדת 3.5 Sonnet הגיע ל־66% pass, עם 3 כשלים מתוך 45 בדיקות.

**מחברת הציטוטים** ([using_citations.ipynb](https://github.com/anthropics/claude-cookbooks/blob/HEAD/misc/using_citations.ipynb))

- שלושה סוגי מסמך, וסוג ציטוט לכל אחד:

  | סוג המסמך | פורמט הציטוט |
  |---|---|
  | טקסט רגיל | "char location", אחרי חלוקה אוטומטית למשפטים |
  | PDF | עמוד |
  | custom content | בלוק. ‏"complete control over citation granularity" |

**מחברת ההערכות** ([building_evals.ipynb](https://github.com/anthropics/claude-cookbooks/blob/HEAD/misc/building_evals.ipynb)) — פירוט בסעיף 3.

**Prompting best practices** ([התיעוד](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices))

- **סדר בפרומפט:**
  - "Put long-form data at the top".
  - "Queries at the end can improve response quality by up to 30 percent in tests, especially with complex, multidocument inputs".
- **מבנה מסמכים:** `<documents>/<document>/<document_content>/<source>`.
- **ציטוטים קודם:** ‏"Ground responses in quotes … quote relevant parts of the documents first".
- **דוגמאות:** 3–5 דוגמאות בתוך `<example>`.
- **אורך:**
  - הדגמים החדשים "Less verbose: Might skip detailed summaries for efficiency unless prompted otherwise".
  - Opus 5 הוא חריג שנוטה להאריך.
- **prefill:** לא נתמך מ־Claude 4.6 ומחזיר 400. החלופות: structured outputs או "Respond directly without preamble".

**ספריית הפרומפטים הישנה**

- הכתובות של `cite-your-sources` ו־`meeting-scribe` החזירו ב־9/11/2026 את דף ה־best practices.
- [cite-your-sources](https://platform.claude.com/docs/en/resources/prompt-library/cite-your-sources), ‏[meeting-scribe](https://platform.claude.com/docs/en/resources/prompt-library/meeting-scribe).

#### 2.4 OpenAI cookbook ‏(MIT, ‏[LICENSE](https://github.com/openai/openai-cookbook/blob/HEAD/LICENSE))

**Summarizing long documents** ([מתכון](https://developers.openai.com/cookbook/examples/summarizing_long_documents))

- **הבעיה:** ‏"If you give a GPT model the task of summarizing a long document (e.g. 10k or more tokens), you'll tend to get back a relatively short summary that isn't proportional to the length of the document".
- **הפתרון:** הפונקציה `summarize(text, detail=0..1, additional_instructions, minimum_chunk_size=500, chunk_delimiter=".", summarize_recursively)`. ‏`detail` קובע את מספר החתיכות.
- **ההשפעה:** במסמך של כ־15k טוקנים, ‏detail=1 הפיק סיכום ארוך כמעט פי 25.
- **סטטוס:** המתכון מסומן "archived".

**Introduction to GPT-4o** ([מחברת](https://github.com/openai/openai-cookbook/blob/HEAD/examples/gpt4o/introduction_to_gpt4o.ipynb))

- משווה סיכום ויזואלי בלבד, שמע בלבד ושילוב.
- "After combining both the video and audio, we're able to get a much more detailed and comprehensive summary".
- שמע בלבד הפיק "much less structure".

**GPT with vision for video understanding** ([מחברת](https://github.com/openai/openai-cookbook/blob/HEAD/examples/GPT_with_vision_for_video_understanding.ipynb))

- "we don't need to send every frame".

**Whisper prompting guide** ([מתכון](https://developers.openai.com/cookbook/examples/whisper_prompting_guide))

- **איך הוא עובד:** ‏Whisper הולך אחרי **הסגנון** של הפרומפט, לא אחרי ההוראות שבו: ‏"the model will not comply, as it follows the style of the prompt".
- **שמות:** רשימת שמות משפרת איות של שמות פרטיים, כי "Whisper may incorrectly transcribe uncommon proper nouns".
- **מגבלת אורך:** ‏"the prompt is limited to only 224 tokens".
- **אמינות:** הטכניקות "are not especially reliable, but can be useful in some situations".
- **סטטוס:** המתכון "archived".

**Structured Outputs** ([מתכון](https://developers.openai.com/cookbook/examples/structured_outputs_intro))

- "will always generate responses that adhere to your supplied JSON Schema".
- "Unlike JSON mode, Structured Outputs constrains the shape of the JSON, not only its validity".
- סירוב מגיע בשדה `refusal` נפרד.
- דוגמה רלוונטית: סיכום מאמר לסכמה קבועה.
- **סטטוס:** המתכון "archived".

#### 2.5 Google ו־Microsoft

**Vertex AI: אסטרטגיות לעיצוב פרומפט** ([תיעוד](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/prompts/prompt-design-strategies))

- "ordering, labeling, and the use of delimiters can all affect the quality".
- אילוץ מפורש של אורך: ‏"write a summary of 3 sentences or less".
- "Break the requests into separate prompts".
- חזרה על האילוצים בסוף הפרומפט, והגנה מקלט לא אמין.

**Gemini cookbook**

- Apache-2.0. לא רלוונטי לשימוש אצלנו, כי Gemini מחוץ לתמונה.
- מקור: [LICENSE](https://github.com/google-gemini/cookbook/blob/HEAD/LICENSE).

**Azure AI Language: summarization** ([סקירה](https://learn.microsoft.com/en-us/azure/ai-services/language-service/summarization/overview))

- **פרישה מתוכננת:** לפי הדף, השירות יפרוש ב־31/3/2029.
- **היבטים לשיחה:**
  - Recap.
  - Issue/resolution.
  - **Chapter title:** ‏"Segments a conversation into chapters…".
  - **Narrative:** לכל מקטע, ‏"usually cowork with chapterTitle".
- **סוגי סיכום:** ‏extractive עם rank ו־offsets, ו־abstractive עם "Contextual input range".
- **שמירה:** התוצאות נשמרות 24 שעות.

**GraphRAG** (MIT)

- גרסה 3.3.0 מ־8/10/2026.
- מקור: [PyPI](https://pypi.org/project/graphrag/).

#### 2.6 LangChain ו־LlamaIndex

**LangChain**

- **מדריך הסיכום הוסר:** הכתובת https://python.langchain.com/docs/tutorials/summarization/ מפנה היום ל־[docs.langchain.com/oss/python/langchain/rag](https://docs.langchain.com/oss/python/langchain/rag), שלא עוסק בסיכום. מקור: [הכתובת הישנה](https://python.langchain.com/docs/tutorials/summarization/).
- **YoutubeLoader** ([youtube.py](https://github.com/langchain-ai/langchain-community/blob/HEAD/libs/community/langchain_community/document_loaders/youtube.py)):
  - פרמטרים: add_video_info, ‏language, ‏translation, ‏`transcript_format` (TEXT/LINES/CHUNKS), ‏`chunk_size_seconds=120`.
  - בפורמט CHUNKS כל מסמך מקבל `start_seconds`, ‏`start_timestamp` וקישור `&t=Ns`.
  - מטא־דאטה של הסרטון (`add_video_info`) דורשת את החבילה pytube. מצב התחזוקה שלה לא נבדק כאן. ה־fork הפעיל pytubefix נמצא בגרסה 11.2.1 ([PyPI](https://pypi.org/project/pytubefix/)).
- **גרסאות:**
  - langchain ‏1.4.9 (4/11/2026): [PyPI](https://pypi.org/project/langchain/).
  - langgraph ‏1.2.20 (5/11/2026): [PyPI](https://pypi.org/project/langgraph/).
  - langchain-community ‏0.4.2 (22/5/2026): [PyPI](https://pypi.org/project/langchain-community/).

**LlamaIndex**

- **response synthesizers** ([תיעוד](https://developers.llamaindex.ai/python/framework/module_guides/querying/response_synthesizers/)):
  - `tree_summarize`: ‏"Good for summarization purposes".
  - `refine`: ‏"Good for more detailed answers".
  - `simple_summarize`: ‏"may lose detail due to truncation".
- **YoutubeTranscriptReader** (0.6.0, ‏31/8/2026):
  - מאחד את קטעי התמליל עם `"\n"` ושומר במטא־דאטה רק `video_id`. **חותמות הזמן הולכות לאיבוד.**
  - מקורות: [base.py](https://github.com/run-llama/llama_index/blob/HEAD/llama-index-integrations/readers/llama-index-readers-youtube-transcript/llama_index/readers/youtube_transcript/base.py) ו־[PyPI](https://pypi.org/project/llama-index-readers-youtube-transcript/).

#### 2.7 STORM ו־Co-STORM (stanford-oval/storm, ‏MIT)

**הפרויקט**

- **פעילות:** ‏31.8k כוכבים, ‏3.0k forks ו־238 commits.
- **חדשות אחרונות:** מ־2025/01: ‏"We add litellm integration … in knowledge-storm v1.1.0".
- **גרסה:** ‏knowledge-storm 1.1.1 מ־29/9/2025.
- **בשלות:** הריפו אומר שהוא "actively working on" מפת דרכים, אבל אין עדכוני חדשות מאז 2025.
- **מקורות:** [README](https://github.com/stanford-oval/storm), ‏[PyPI](https://pypi.org/project/knowledge-storm/) ו־[LICENSE](https://github.com/stanford-oval/storm/blob/HEAD/LICENSE).

**הממצא המרכזי** ([README](https://github.com/stanford-oval/storm); מאמר: [arXiv 2402.14207](https://arxiv.org/abs/2402.14207))

- "Directly prompting the language model to ask questions does not work well".
- שתי האסטרטגיות שלו:
  1. Perspective-Guided Question Asking.
  2. Simulated Conversation.
- שני שלבים: pre-writing, ואחריו writing עם ציטוטים.

**Co-STORM** ([README](https://github.com/stanford-oval/storm))

- **המנחה (Moderator):** שואל "questions inspired by information discovered by the retriever but not directly used in previous turns".
- **מפת חשיבה:** ‏"dynamic updated mind map … reduce the mental load".
- **שימוש:** ‏"More than 70,000 people have tried".

#### 2.8 Chain of Density (CoD)

**המאמר** ([arXiv 2309.04269](https://arxiv.org/abs/2309.04269))

- Adams, ‏Fabbri, ‏Ladhak, ‏Lehman ו־Elhadad, ‏8/9/2023.
- **הממצאים:**
  - בני אדם העדיפו סיכומים צפופים יותר מהבסיס, וקרובים לצפיפות של סיכום אנושי.
  - יש פשרה בין אינפורמטיביות לקריאוּת.
- **נתונים:** פורסמו 500 סיכומים מתויגים ו־5,000 לא מתויגים.

**מבנה הפרומפט** (לפי [המימוש ב־Outlines](https://dottxt-ai.github.io/outlines/cookbook/chain_of_density/))

- "Repeat the following 2 steps 5 times".
  1. לזהות 1–3 ישויות חסרות.
  2. לכתוב סיכום צפוף יותר באותו אורך.
- **ישות חסרה היא:** ‏Relevant, ‏Specific (עד 5 מילים), ‏Novel, ‏Faithful, ‏Anywhere.
- **כללים:**
  - הסיכום הראשון כ־80 מילה, עם מילוי.
  - "Never drop entities".
  - אותו מספר מילים בכל סבב.
- **פלט:** ‏JSON עם המפתחות `Missing_Entities` ו־`Denser_Summary`.
- **אכיפה:** ‏Outlines אוכף 5 שלבים דרך `conlist`, אבל לא אוכף את מספר המילים.

**מימושים נוספים**

- [richawo/chain-of-density](https://github.com/richawo/chain-of-density).
- Instructor, כולל distillation למודל קטן: [בלוג](https://python.useinstructor.com/blog/2023/11/05/chain-of-density/).
- W&B Weave עם Claude: [cookbook](https://docs.wandb.ai/weave/cookbooks/chain_of_density).

#### 2.9 דפוסים מתוך אפליקציות בקוד פתוח

| דפוס | מה הוא אומר | מקור |
|---|---|---|
| משימה אחת לכל טרנספורמציה | "One job per transformation" | [open-notebook](https://github.com/lfnovo/open-notebook/blob/HEAD/docs/3-USER-GUIDE/transformations.md) |
| ציטוט מילולי מאומת לכל פריט | הפריט נדחה אם הציטוט לא בטקסט | [Skill-Anything](https://github.com/SYuan03/Skill-Anything) |
| חוזה סינתזה עם בדיקה מכנית | "the contract is the output, not how it was reached" | [lecture-to-notes](https://github.com/drpwchen/lecture-to-notes/blob/HEAD/docs/stage-f-contract.md) |
| סמני שקף בתוך הטקסט | `[slide:N]` | [steipete/summarize](https://github.com/steipete/summarize/blob/HEAD/docs/slides.md) |
| דחיסה בשרת לפני ה־LLM | | [mcp-youtube-intelligence](https://github.com/JangHyuckYun/mcp-youtube-intelligence) |
| הסוכן "מסתכל בעצמו" על הפריים בזמן T | | [video-context-mcp](https://github.com/smallthinkingmachines/video-context-mcp) |

### Inferences — מה מייצר עומק ומה מייצר פלט גנרי

**מה מייצר עומק**

| רכיב | דוגמה במקורות | למה זה עובד | איך לממש אצלנו |
|---|---|---|---|
| טקסונומיה של סוגי ידע | Fabric: ‏IDEAS, ‏INSIGHTS, ‏QUOTES, ‏HABITS, ‏FACTS, ‏REFERENCES, ‏RECOMMENDATIONS | מכריח לחפש סוגים שונים של ערך במקום "נקודות עיקריות" | רשימת בדיקה של חלקים, עם "אין" לגיטימי לכל חלק (summarize_meeting: ‏"No information available") |
| סולם הפשטה | IDEAS → INSIGHTS: ‏"fewer, more refined … more abstracted" | תובנה נבנית מעל רעיונות, לא במקביל | מעבר שני שמקבל רק את הרעיונות עם המזהים שלהם, ומחזיר תובנות שמצביעות על כמה רעיונות |
| מסנן חידוש | extract_alpha: מה ששונה הוא האינפורמציה | מוריד את "ידע כללי" ש־LLM ממילא היה כותב | מעבר "מה כאן לא טריוויאלי", עם הצדקה מהמקור |
| עדשות ביקורת | analyze_claims, ‏summarize_debate (ראיות שישנו דעה), ‏check_falsifiability, ‏analyze_presentation (SELFLESSNESS) | מוציא את הניתוח מתיאור אל הערכה | כל עדשה במעבר נפרד. הראיות רק מתוך ההרצאה |
| ציטוט לפני ניתוח | Anthropic: ‏"quote relevant parts … first"; ‏Fabric QUOTES: ‏"exact quote text" | מעגן כל טענה ומקטין המצאה | ציטוט חייב להיות תת־מחרוזת של מקטע עם מזהה. בודקים בקוד |
| הגדרות בלי ניחוש | summarize_lecture: ‏"without making guesses"; ‏explain_terms: הגדרה, אנלוגיה ולמה זה חשוב | מילון מונחים הוא ערך ייחודי של הרצאה | מונח בלי הגדרה בהרצאה מסומן "לא הוגדר בהרצאה" |
| שאלות לפי פרספקטיבה, ומנחה | STORM: שאלה ישירה "does not work well"; ‏Co-STORM: מידע שנשלף ולא נוצל | מכסה זוויות שהמעבר הראשון פספס | מעבר כיסוי: אילו מקטעים לא צוטטו באף פריט? |
| ציפוף | CoD: ‏"Never drop entities" ואותו אורך | יותר ישויות לכל מילה, בלי לאבד את מה שכבר נכתב | לתקציר בלבד. שליטה באורך בקוד |
| אורך יחסי למקור | OpenAI `detail`: פי 25 באורך | נגד הסיכום הקצר שלא תלוי באורך המקור | עומק יחסי למשך ההרצאה ולמספר הנושאים |
| משימה אחת לכל פרומפט | open-notebook; ‏Vertex: ‏"Break the requests into separate prompts" | כל מעבר ממוקד | מעברים נפרדים לטיעונים, לשאלות פתוחות ולמונחים |
| ביטויים אסורים | Semantic Kernel: ‏[BANNED PHRASES] | מוריד מילוי מטא־טקסטואלי | רשימה בעברית, למשל "בהרצאה זו", ‏"הדובר מדבר על" |
| מסגרת תחום | Anthropic: ‏guided ו־domain-specific | מבנה קבוע לכל סוג תוכן | מסגרות לפי סוג: הרצאה, וובינר מכירתי, הדרכה מעשית (extract_instructions), דיון (summarize_debate) |

**מה מייצר פלט גנרי או שגוי**

1. **"סכם את זה" במעבר אחד על מסמך ארוך.** הסיכום יוצא קצר ולא יחסי לאורך המקור (OpenAI). הדגמים החדשים של Claude נוטים עוד יותר לקצר (התיעוד של Anthropic).
2. **מכסות קבועות.** "20–50 IDEAS", ‏"at least 20". הרצאה דלה תרופד בפריטים חלשים, והרצאה עשירה תיחתך.
3. **ספירת מילים מדויקת.** "exactly 16 words": המודל מוציא מאמץ על ספירה במקום על תוכן, ולא נאכף בקוד. גם ב־Outlines לא נאכף מספר המילים של CoD.
4. **פרסונות מנופחות והוראות תיאטרליות.** "4,312 IQ", ‏"at least 319 times": אין להן מנגנון מדיד.
5. **חותמות זמן שה־LLM כותב בעצמו.** הדוגמה של Fabric עצמה לא ממוינת, למרות הכלל "sequential".
6. **ראיות חיצוניות מזיכרון המודל.** analyze_claims מבקש הפניות חיצוניות עם "DO NOT make any of those up" — כלומר מזמין המצאה.
7. **"להסיק" במקום שגיאות תמלול.** youtube_summary: ‏"infer intended meanings". לסיכום זה סביר, אבל לציטוט זה פסול.
8. **דוגמאות לא נאמנות.** to_flashcards מעגל 396→400 ו־74→70. דוגמת few-shot מלמדת את המודל לעגל.
9. **קטיעה שקטה.** Skill-Anything גילה שהכל אחרי 5–6K התווים הראשונים הלך לאיבוד. ‏simple_summarize של LlamaIndex: ‏"may lose detail due to truncation".
10. **חתיכות לפי מספר תווים.** meta-summarization חותך כל 2000 תווים בלי קשר לגבולות נושא. בהרצאה זה חותך הסבר באמצע.

**המסקנה לחותמות זמן**

אסור לבקש מ־Claude לכתוב `HH:MM:SS`. במקום זה:
- כל פריט מפנה ל**מזהה מקטע**, עם ציטוט מילולי.
- הקוד מאמת שהציטוט נמצא במקטע, ומתרגם את המזהה לזמן המילה הראשונה של הציטוט, מתוך תזמון ברמת מילה.
- Citations של Anthropic עם custom content (בלוק לכל מקטע) נותן את אותה התוצאה ברמת ה־API.

### Gaps
- **ספריית הפרומפטים של Anthropic:** הכתובות הישנות מחזירות היום את דף ה־best practices. לא מצאתי עותק עדכני של ערכי "meeting scribe" ו־"cite your sources", ולא חיפשתי עותקי ארכיון.
- **Fabric:**
  - לא קראתי את כל 265 התבניות, אלא כ־37 שרלוונטיות לנושא.
  - אין במקורות ראיה כמותית לאיכות אף תבנית.
  - releases אחרי v1.4.447 לא נקלטו.
- **Co-STORM:** לא נקרא המאמר עצמו (EMNLP 2024). התיאור מה־README בלבד.
- **LangChain:** לא מצאתי מדריך סיכום עדכני בתיעוד החדש. ייתכן שהוא הועבר למקום שלא חיפשתי.
- **עברית:** לא נמצאה ספריית פרומפטים ציבורית לחילוץ תובנות בעברית, ולא מדידה של אף דפוס על תוכן עברי.

## 3. כלי הערכה: מה מתאים לסט זהב של צוות קטן

### Takeaway
לצוות קטן עם סט זהב מספיקים ארבעה רכיבים:

1. **רתמה פשוטה:** ‏Inspect ב־Python (MIT), או promptfoo (MIT, ב־Node) לרגרסיה של פרומפטים.
2. **בודק נאמנות זול על CPU** לטענות באנגלית: ‏MiniCheck-FT5, ‏AlignScore או HHEM-2.1-Open.
3. **מדד שלמות:** "עובדות מפתח" בשיטת FineSurE, או שאלות כיסוי בשיטת DeepEval.
4. **שופט Claude עם רובריקה,** שמכוילים מול תיוג אנושי.

לעברית אין בודק נאמנות מאומת. ‏LettuceDetect v2 mmBERT הוא המועמד הרב־לשוני היחיד שמצאתי, ועברית לא מופיעה בכרטיס שלו.

### Cited Findings

**עקרונות מ־Anthropic** ([building_evals.ipynb](https://github.com/anthropics/claude-cookbooks/blob/HEAD/misc/building_evals.ipynb))

- **ארבעת החלקים של הערכה:** קלט, פלט, "golden answer" (התאמה מדויקת או דוגמה לתשובה מושלמת), וציון.
- **שלוש שיטות ציון:**
  - קוד: ‏"by far the best grading method if you can design an eval that allows for it".
  - אדם: ‏"incredibly slow and expensive".
  - מודל.
- **עיקרון התכנון:** ‏"building evals that can be quickly and cheaply graded should be at the center of your design choices".
- **על שופט מודל:** ‏"The only way to know if a model-based grader can do a good job grading your task is to try".
- **כמות מול איכות:** ‏"your preference should be for higher volume and lower quality of questions over very low volume with high quality".

**MiniCheck** (Liyan06/MiniCheck)

- **הריפו:** ‏235 כוכבים ו־52 commits. העדכונים האחרונים בדף מ־2024/09: הוספה ל־ollama ול־Guardrails.
- **⚠️ סתירת רישיון:** הריפו ב־Apache-2.0, אבל `minicheck` ‏0.4.0 ב־PyPI (מ־30/7/2026) מצהיר MIT.
- **המודלים הקטנים:** ‏roberta-large, ‏deberta-v3-large ו־flan-t5-large ‏(770M), ברישיון MIT.
- **⚠️ Bespoke-MiniCheck-7B:** ‏"CC BY-NC 4.0". הדף מתאר אותו כ־"commercially useable" רק דרך פנייה לחברה.
- **ממשק:** ‏`MiniCheck(document, sentence) -> [0, 1]`, כלומר צריך לפצל לטענות לפני הבדיקה.
- **ביצועים:** ‏APC מקצר ריצה מ־55 ל־30 דקות. יש ollama ובנצ'מרק LLM-AggreFact.
- **שפה:** דף הריפו לא מזכיר שפות. כרטיסי שלושת המודלים הקטנים מסומנים `language: en`. ל־MiniCheck-Flan-T5-Large יש 27,058 הורדות, ועדכון אחרון ב־20/12/2024.
- **מקורות:** [GitHub](https://github.com/Liyan06/MiniCheck), ‏[PyPI](https://pypi.org/project/minicheck/), ‏[Bespoke-MiniCheck-7B](https://huggingface.co/bespokelabs/Bespoke-MiniCheck-7B), ‏[MiniCheck-Flan-T5-Large](https://huggingface.co/lytang/MiniCheck-Flan-T5-Large) ו־[arXiv 2404.10774](https://arxiv.org/abs/2404.10774).

**AlignScore** (MIT, 🪦)

- **מודל:** ‏RoBERTa ‏125M/355M, שאומן על 4.7M דוגמאות. מחלק את המקור לחתיכות של כ־350 טוקן.
- **תוצאות:** ממוצע 73.9 בטבלה, ו־Spearman ממוצע 59.3.
- **פעילות:** commit אחרון 11/3/2024. זה קוד מחקר קפוא.
- **מקורות:** [Hugging Face](https://huggingface.co/yzha/AlignScore/blob/main/README.md), ‏[commits](https://github.com/yuh-zha/AlignScore/commits) ו־[LICENSE](https://github.com/yuh-zha/AlignScore/blob/HEAD/LICENSE).

**FineSurE** (Apache-2.0, ‏ACL 2024, 🪦)

- **שלושה ממדים:** faithfulness, ‏completeness ו־conciseness.
- **שיטה:** בדיקת עובדות ב־9 קטגוריות שגיאה, ויישור "keyfacts" למשפטי הסיכום.
- **מודל:** מבוסס OpenAI.
- **פעילות:** commit אחרון 8/7/2024.
- **מקורות:** [commits](https://github.com/DISL-Lab/FineSurE-ACL24/commits) ו־[LICENSE](https://github.com/DISL-Lab/FineSurE-ACL24/blob/HEAD/LICENSE).

**FActScore** (MIT, 🪦)

- PyPI ‏0.2.0 מ־2023.
- commit אחרון 13/4/2025: עדכון הורדת נתונים.
- מקורות: [commits](https://github.com/shmsw25/FActScore/commits), ‏[PyPI](https://pypi.org/project/factscore/) ו־[LICENSE](https://github.com/shmsw25/FActScore/blob/HEAD/LICENSE).

**כלי מחקר נוספים**

| כלי | רישיון | הערה | מקור |
|---|---|---|---|
| VeriScore | Apache-2.0 | | [LICENSE](https://github.com/Yixiao-Song/VeriScore/blob/HEAD/LICENSE) |
| SAFE (long-form-factuality) | | הקבצים של FActScore בתוכו ב־MIT | [LICENSE](https://github.com/google-deepmind/long-form-factuality/blob/HEAD/LICENSE) |
| UniEval | MIT | | [LICENSE](https://github.com/maszhongming/UniEval/blob/HEAD/LICENSE) |
| G-Eval | MIT | | [LICENSE](https://github.com/nlpyang/geval/blob/HEAD/LICENSE) |
| BooookScore | MIT | | [LICENSE](https://github.com/lilakk/BooookScore/blob/HEAD/LICENSE) |
| SummaC 🪦 | Apache-2.0 | גרסה 0.0.4 מ־2023 | [LICENSE](https://github.com/tingofurro/summac/blob/HEAD/LICENSE), ‏[PyPI](https://pypi.org/project/summac/) |

**HHEM-2.1-Open** (Vectara, ‏Apache-2.0)

- **מודל:** מבוסס `google/flan-t5-base`. הכרטיס מסומן `language: en`.
- **שימוש:** ‏98,483 הורדות. עדכון אחרון 6/10/2026.
- **הקשר:** ‏"HHEM-2.1-Open has an unlimited context length, while HHEM-1.0 is capped at 512 tokens".
- **ביצועים על CPU (לפי Vectara):** ‏"occupying less than 600MB RAM space at 32-bit precision and elapsing around 1.5 second for a 2k-token input on a modern x86 CPU".
- **איכות (לפי Vectara):** ‏"outperforms both GPT-3.5-Turbo and GPT-4 in all three benchmarks" (AggreFact-SOTA, ‏RAGTruth-Summ, ‏RAGTruth-QA).
- **⚠️ הגרסה המסחרית:** ‏HHEM-2.3 זמינה רק בפלטפורמה של Vectara, ותומכת ב־11 שפות: ‏"English, German, French, Portuguese, Spanish, Arabic, Chinese-Simplified, Korean, Russian, Japanese, and Hindi". **אין עברית.**
- **הדמו:** רץ על cpu-basic.
- **מקורות:** [כרטיס](https://huggingface.co/vectara/hallucination_evaluation_model) ו־[Space](https://huggingface.co/spaces/vectara/hhem-2.1-open-demo).

**LettuceDetect** (KRLabsOrg)

- **הספרייה:** ‏MIT, ‏620 כוכבים, עדכון 9/11/2026.
- **גרסאות:**
  - 0.1.7: מודלי EuroBERT ל־7 שפות.
  - 0.2.0 (22/6/2026): ‏v2-qwen-2b ו־v2-mmbert-base.
  - 0.2.2 מ־5/7/2026.
- **תוצאות ב־README (span-F1):** ‏0.689/0.642, וב־RAGTruth ‏0.574/0.528.
- **המודלים:** v2 ב־Apache-2.0. מודלי v1 ו־EuroBERT ב־MIT. יש גם מודלים ייעודיים להונגרית ולגרמנית ועוד.
- **מקורות:** [LICENSE](https://github.com/KRLabsOrg/LettuceDetect/blob/HEAD/LICENSE), ‏[GitHub](https://github.com/KRLabsOrg/LettuceDetect), ‏[topic](https://github.com/topics/hallucination-detection), ‏[PyPI](https://pypi.org/project/lettucedetect/) ו־[רשימת המודלים](https://huggingface.co/api/models?author=KRLabsOrg&limit=50).

**lettucedect-v2-mmbert-base** ([כרטיס](https://huggingface.co/KRLabsOrg/lettucedect-v2-mmbert-base))

- **מודל:** כ־0.3B פרמטרים, מעל mmBERT-base.
- **קלט:** `[CLS] context [SEP] question [SEP] answer [SEP]`.
- **פלט:** זיהוי בינארי ברמת span, ללא קטגוריות.
- **תוצאות:**
  - span-F1 ‏0.642 על סט מאוחד של 10,698 דוגמאות.
  - RAGTruth ‏(example-F1) ‏74.3.
  - PsiloQA הרב־לשוני (14 שפות): ‏span-F1 ‏0.714.
- **שפות:** ‏"7 languages" במטא־דאטה, בלי שמות. **עברית לא מוזכרת.**
- **ביצועים על CPU:** אין מדידה.

**mmBERT-base** ([כרטיס](https://huggingface.co/jhu-clsp/mmBERT-base))

- ‏MIT, ‏307M פרמטרים.
- "Trained on over 1800 languages", אבל עברית לא מוזכרת במפורש.
- הקשר של 8192 טוקנים.

**מודלי שיפוט נוספים**

- Granite Guardian 3.3 8B: ‏Apache-2.0. מקור: [כרטיס](https://huggingface.co/ibm-granite/granite-guardian-3.3-8b).
- ⚠️ Lynx 8B: ‏CC-BY-NC. מקור: [כרטיס](https://huggingface.co/PatronusAI/Llama-3-Patronus-Lynx-8B-Instruct).

**RAGAS** (Apache-2.0)

- **פעילות:** ‏16.3k כוכבים ו־1,147 commits. הריפו עבר ל־vibrantlabsai.
- **גרסה:** ‏0.4.3 מ־13/1/2026.
- **SummaryScore:**
  - ציון QA = נכונות חלקי סך הכל.
  - conciseness = ‏1 − min(len_s, len_c)/(len_c + 1e-10).
  - ציון סופי = QA×(1−coeff) + conc×coeff, כאשר coeff=0.5.
  - המדד הישן deprecated מגרסה 0.4 ויוסר ב־1.0.
- **מקורות:** [GitHub](https://github.com/vibrantlabsai/ragas), ‏[PyPI](https://pypi.org/project/ragas/) ו־[summarization_score](https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/summarization_score/).

**DeepEval** (Apache-2.0)

- **פעילות:** ‏19.4k כוכבים. גרסה 4.3.3 מ־4/11/2026.
- **SummarizationMetric:**
  - הציון הוא min(alignment, coverage).
  - כיסוי נמדד ב־n=5 שאלות כן/לא, או ב־`assessment_questions` שלנו.
  - "the only default metric … not cacheable".
- **מקורות:** [topic llm-evaluation](https://github.com/topics/llm-evaluation), ‏[PyPI](https://pypi.org/project/deepeval/), ‏[תיעוד](https://deepeval.com/docs/metrics-summarization) ו־[LICENSE](https://github.com/confident-ai/deepeval/blob/HEAD/LICENSE.md).

**promptfoo** (MIT)

- **פעילות:** ‏27k כוכבים. ‏npm 0.125.1 מ־25/10/2026.
- **בעלות:** ‏"Promptfoo is now part of OpenAI. Promptfoo remains open source and MIT licensed".
- **הבלוג (9/3/2026):** ‏"agreed to be acquired by OpenAI", עם התחייבות ל־"continue to support a diverse range of providers".
- **מקורות:** [topic](https://github.com/topics/llm-evaluation), ‏[npm](https://www.npmjs.com/package/promptfoo), ‏[בלוג](https://www.promptfoo.dev/blog/promptfoo-joining-openai/) ו־[LICENSE](https://github.com/promptfoo/promptfoo/blob/HEAD/LICENSE).

**Inspect** (UK AISI, ‏MIT)

- **פעילות:** ‏3.2k כוכבים, ‏916 forks ו־8,301 commits. גרסה 0.3.288 מ־7/11/2026.
- **הערכות מוכנות:** ‏"over 200 pre-built evaluations".
- **מקורות:** [GitHub](https://github.com/UKGovernmentBEIS/inspect_ai), ‏[PyPI](https://pypi.org/project/inspect-ai/) ו־[LICENSE](https://github.com/UKGovernmentBEIS/inspect_ai/blob/HEAD/LICENSE).

**פלטפורמות תצפית והערכה**

| כלי | פרטים | רישיון | מקור |
|---|---|---|---|
| Phoenix | 12.2k כוכבים, גרסה 21.0.0 | ⚠️ Elastic-2.0, לא OSI | [PyPI](https://pypi.org/project/arize-phoenix/) |
| Opik | 23.3k | Apache | [PyPI](https://pypi.org/project/opik/) |
| Langfuse | 37.2k | MIT | [PyPI](https://pypi.org/project/langfuse/) |
| TruLens | 3.6k | MIT | [PyPI](https://pypi.org/project/trulens/) |
| giskard | 5.9k | Apache | [PyPI](https://pypi.org/project/giskard/) |
| UpTrain 🪦 | 2.4k כוכבים. עדכון אחרון 18/8/2024, ‏PyPI 0.7.1 מ־5/2024 | | [topic](https://github.com/topics/hallucination-detection), ‏[PyPI](https://pypi.org/project/uptrain/) |

מקור לכוכבים: [topic llm-evaluation](https://github.com/topics/llm-evaluation).

**ספריות לפלט מובנה**

| ספרייה | גרסה | רישיון | מקור |
|---|---|---|---|
| instructor | 1.17.0 | MIT | [PyPI](https://pypi.org/project/instructor/) |
| outlines | 1.3.3 | Apache-2.0 | [PyPI](https://pypi.org/project/outlines/) |
| dspy | 3.4.1 | MIT | [PyPI](https://pypi.org/project/dspy/) |
| baml-py | 0.226.3 | | [PyPI](https://pypi.org/project/baml-py/) |

### Inferences — מה מתאים לסט זהב של צוות קטן

| צורך | בחירה | למה | הסתייגות |
|---|---|---|---|
| רתמה ב־Python ליד העובד | **Inspect** (MIT) | פעיל מאוד, ‏200+ הערכות מוכנות, ובאותה שפה של העובד | צריך לכתוב ספק ל־Claude או להשתמש בקיים (לא נבדק) |
| רגרסיה של פרומפטים ב־CI | **promptfoo** (MIT) | בשל, ומחברת הסיכום של Anthropic כבר בנויה עליו | שייך היום ל־OpenAI. לעקוב אחרי הרישיון |
| נאמנות זולה על CPU, אנגלית | **MiniCheck-FT5** או **AlignScore** (MIT), ‏**HHEM-2.1-Open** (Apache) | מודלים קטנים, עד 770M. ל־HHEM יש מדידה של Vectara: כ־1.5 שניות לקלט של 2k טוקנים על CPU x86, ופחות מ־600MB RAM | אנגלית בלבד. ‏AlignScore קפוא. ‏MiniCheck דורש פיצול לטענות |
| נאמנות ברמת span, רב־לשוני | **LettuceDetect v2 mmBERT** (Apache) | המועמד היחיד שמצאתי שאולי יעבוד גם בעברית | עברית לא נבדקה. חובה לבדוק על סט הזהב שלנו |
| שלמות | שיטת **FineSurE** (keyfacts; ‏Apache) או **DeepEval** coverage עם `assessment_questions` משלנו | "עובדות מפתח" של ההרצאה הן בדיוק סט הזהב שצוות קטן יכול לכתוב | ב־FineSurE המימוש ל־OpenAI. מממשים את השיטה עם Claude |
| ציון בקוד | אימות ציטוט מילולי (Skill-Anything), חותמות זמן בתוך משך הסרטון, אורך יחסי | לפי Anthropic, ציון בקוד הוא "by far the best" | — |
| שופט LLM | Claude עם רובריקה | Anthropic: ‏"The only way to know … is to try" | לכייל מול תיוג אנושי של 20–50 דוגמאות |

**אסטרטגיה לעברית**

רוב סרטוני המקור באנגלית. אפשר לבדוק את טענות הניתוח **באנגלית, לפני התרגום**, מול התמליל האנגלי עם בודקי ה־CPU. את התרגום לעברית מעריכים בנפרד. לתוכן מקור בעברית, השופט הוא Claude, עד שתהיה מדידה של LettuceDetect בעברית.

**מה להימנע ממנו**

- Bespoke-MiniCheck-7B ו־Lynx (NC).
- Phoenix (Elastic-2.0), אם יש סיכוי שנציע אותו כשירות.
- UpTrain (קפוא).

### Gaps
- **ביצועים על CPU:** ל־HHEM יש רק המדידה של Vectara: כ־1.5 שניות ל־2k טוקנים, בלי פירוט של המעבד. ל־MiniCheck-FT5, ל־AlignScore ול־LettuceDetect לא נמצאה מדידה על CPU. צריך למדוד על CX53 בעצמנו.
- **עברית:** לא נמצאה הערכה של אף בודק נאמנות. גם רשימת 7 השפות של LettuceDetect v2 לא מופיעה בכרטיס.
- **סתירת הרישיון של MiniCheck:** ‏Apache-2.0 בריפו מול MIT ב־PyPI. לא נבדק מה כתוב בכרטיסי המודלים עצמם, מעבר ל־MIT שנאסף קודם.
- **Inspect:** לא בדקתי אילו scorers מובנים יש בו ואיך הוא מתממשק ל־Claude. דף הבית של הריפו לא מפרט.

## 4. Spaces ודמואים ב־Hugging Face ששווה לבדוק

### Takeaway
Spaces בנושא הרצאות ו־YouTube הם ברובם צעצועים: ‏0–25 לייקים, ונבנו ב־2022–2024. מה ששווה בדיקה:

| Space | למה |
|---|---|
| ivrit-ai/hebrew-transcription-leaderboard | השוואת ASR עברי |
| yeliudev/VideoMind-2B | רץ על cpu-basic |
| vectara/hhem-2.1-open-demo | בודק נאמנות, ‏cpu-basic |
| HappyPablo/marlin-2b-video-understanding | כתוביות צפופות וחיפוש בזמן |
| Qwen3-VL ו־PaddleOCR-VL | דמואים של מודלים פתוחים |

### Cited Findings

**חיפוש ב־API של ה־Spaces**

הנתונים מ־`huggingface.co/api/spaces?search=…&sort=likes`:

- **"lecture":** ‏12 תוצאות, בכל אחת 1–5 לייקים. מקור: [API](https://huggingface.co/api/spaces?search=lecture&sort=likes&direction=-1&limit=12&full=true).
- **"youtube summar":** המוביל ardha27/Youtube-AI-Summarizer, עם 25 לייקים ועדכון מ־2024. מקור: [API](https://huggingface.co/api/spaces?search=youtube%20summar&sort=likes&direction=-1&limit=12&full=true).
- **"video rag":** ‏0–3 לייקים. מקור: [API](https://huggingface.co/api/spaces?search=video%20rag&sort=likes&direction=-1&limit=12&full=true).
- **"lecture video":** ‏3 תוצאות, בכולן 0 לייקים. מקור: [API](https://huggingface.co/api/spaces?search=lecture%20video&sort=likes&direction=-1&limit=6).

**Spaces בודדים**

- **artificialguybr/Video-Transcription-Smart-Summary**
  - 375 לייקים. נוצר ב־4/7/2024, עדכון 7/4/2026.
  - מודלים: `openai/whisper-large-v3` ו־`Qwen/Qwen3.5-2B`. רץ על zero-a10g.
  - מקור: [Space](https://huggingface.co/spaces/artificialguybr/Video-Transcription-Smart-Summary).
- **HappyPablo/marlin-2b-video-understanding**
  - 54 לייקים. נוצר ב־26/5/2026.
  - "Dense video captions and timestamp search". המודל `NemoStation/Marlin-2B`, על zero-a10g.
  - מקור: [Space](https://huggingface.co/spaces/HappyPablo/marlin-2b-video-understanding).
- **yeliudev/VideoMind-2B**
  - 37 לייקים, ‏BSD-3.
  - "A Chain-of-LoRA Agent for Temporal-Grounded Video Reasoning". ‏RUNNING על **cpu-basic**.
  - מקור: [Space](https://huggingface.co/spaces/yeliudev/VideoMind-2B).
- **vectara/hhem-2.1-open-demo**
  - Apache-2.0. ‏"Is this LLM output faithful to its source?". ‏RUNNING על **cpu-basic**.
  - מקור: [Space](https://huggingface.co/spaces/vectara/hhem-2.1-open-demo).
- **ivrit-ai/hebrew-transcription-leaderboard**
  - 36 לייקים. ‏"Benchmarking Hebrew Speech-to-Text Models". עדכון 14/10/2026, ‏RUNNING.
  - מקור: [Space](https://huggingface.co/spaces/ivrit-ai/hebrew-transcription-leaderboard).
- **hebrew-llm-leaderboard/leaderboard**
  - 46 לייקים. עדכון 17/5/2026.
  - מקור: [Space](https://huggingface.co/spaces/hebrew-llm-leaderboard/leaderboard).

**דמואים של מודלי ראייה**

| Space | לייקים | מקור |
|---|---|---|
| Qwen/Qwen3-VL-Demo | 478 | [Space](https://huggingface.co/spaces/Qwen/Qwen3-VL-Demo) |
| Qwen/Qwen3-VL-30B-A3B-Demo | 115 | [Space](https://huggingface.co/spaces/Qwen/Qwen3-VL-30B-A3B-Demo) |
| lixin4ever/VideoLLaMA3 | 84 | [Space](https://huggingface.co/spaces/lixin4ever/VideoLLaMA3) |
| HuggingFaceTB/SmolVLM2 | 84 | [Space](https://huggingface.co/spaces/HuggingFaceTB/SmolVLM2) |
| PaddlePaddle/PaddleOCR-VL-1.6_Online_Demo | 52 | [Space](https://huggingface.co/spaces/PaddlePaddle/PaddleOCR-VL-1.6_Online_Demo) |

**Spaces שבורים או רדומים**

- **HuggingFaceTB/SmolVLM2-HighlightGenerator:** ‏BUILD_ERROR. מקור: [Space](https://huggingface.co/spaces/HuggingFaceTB/SmolVLM2-HighlightGenerator).
- **gabrielchua/open-notebooklm:** ‏1,089 לייקים, אבל BUILD_ERROR, ועדכון אחרון ב־12/2024. מקור: [Space](https://huggingface.co/spaces/gabrielchua/open-notebooklm).
- **gigant/slideshow_extraction:** ‏SLEEPING. נוצר ב־2022. מקור: [Space](https://huggingface.co/spaces/gigant/slideshow_extraction).

### Inferences
- **אין דמו שעושה את מה שאנחנו בונים.** אין Space שמשלב שקפים, תמליל וסינתזה עם חותמות זמן.
- **ה־Spaces שימושיים בעיקר לבדיקת רכיבים:**
  - VideoMind-2B על cpu-basic: אינדיקציה שעיגון זמני במודל קטן אפשרי בלי GPU. אבל זמן התגובה לא נמדד.
  - HHEM: לניסוי ידני בבודק נאמנות.
  - הלוח של ivrit-ai: לבחירת מודל ASR עברי. רלוונטי להערה 04.

### Gaps
- לא הרצתי אף Space. מצב RUNNING לא אומר כלום על איכות ועל מהירות.
- לא נבדקו Spaces של הערכת סיכום בעברית. בחיפוש "hebrew" לא הופיע אף אחד כזה.

## 5. מפת שימוש חוזר: לאמץ, להתאים או להימנע, ומלכודות הרישיון

### Takeaway
- **לאמץ:**
  - את **התבניות:** חוזה של שלבי ראיות דטרמיניסטיים וסינתזה מבוקרת, אימות ציטוט מילולי, ציטוטים לפי מזהה מקטע, כלי "הצצה לפריים" לסוכן, וחלונות במקום קטיעה.
  - את **הספריות המתירניות:** ‏PySceneDetect, ‏youtube-transcript-api, ‏Inspect, ‏promptfoo, ‏MiniCheck-FT5, ‏AlignScore, ‏HHEM ו־markmap.
- **להתאים ל־Claude:** את אלגוריתמי הסוכנים, ‏DVD lite, ‏MR. Video ו־VideoTree, ואת דפוסי הפרומפט: Fabric, ‏STORM ו־CoD.
- **להימנע:** מכל קוד AGPL, ‏GPL, ‏NC או בלי רישיון, ומתלות ב־GPU, ב־Gemini או בענן סגור.

### Cited Findings

**עובדות רישיון ותלות שקובעות את המפה** (הקישורים המלאים בסעיפים 1–3)

**AGPL-3.0**

- lecture2notes: [LICENSE](https://github.com/HHousen/lecture2notes/blob/HEAD/LICENSE).
- Whishper: [LICENSE](https://github.com/pluja/whishper/blob/HEAD/LICENSE).
- Speakr: [LICENSE](https://github.com/murtaza-nasir/speakr/blob/HEAD/LICENSE).
- khoj: [LICENSE](https://github.com/khoj-ai/khoj/blob/HEAD/LICENSE).
- pullmd: [LICENSE](https://github.com/AeternaLabsHQ/pullmd/blob/HEAD/LICENSE).

**GPL-3.0**

- noScribe: [LICENSE](https://github.com/kaixxx/noScribe/blob/HEAD/LICENSE.txt).
- TransformerSum: [LICENSE](https://github.com/HHousen/TransformerSum/blob/HEAD/LICENSE).
- Glarity: [LICENSE](https://github.com/sparticleinc/chatgpt-google-summary-extension/blob/HEAD/LICENSE).
- השרת של tldw_server: [LICENSE](https://github.com/rmusser01/tldw_server/blob/HEAD/LICENSE).

**לא מסחרי או גלוי בלבד**

- ImageBind בתוך VideoRAG: [LICENSE](https://github.com/HKUDS/VideoRAG/blob/HEAD/LICENSE).
- Bespoke-MiniCheck-7B: [כרטיס](https://huggingface.co/bespokelabs/Bespoke-MiniCheck-7B).
- Lynx: [כרטיס](https://huggingface.co/PatronusAI/Llama-3-Patronus-Lynx-8B-Instruct).
- PageLM: [LICENSE.md](https://github.com/CaviraOSS/PageLM/blob/HEAD/LICENSE.md).
- החזית של tldw (PolyForm Perimeter): [LICENSE](https://github.com/rmusser01/tldw_server/blob/HEAD/LICENSE).
- screenpipe: [LICENSE.md](https://github.com/mediar-ai/screenpipe/blob/HEAD/LICENSE.md).
- Phoenix (Elastic-2.0): [PyPI](https://pypi.org/project/arize-phoenix/).

**בלי LICENSE**

- [video2pdf](https://github.com/kaushikj/video2pdfslides)
- [koma](https://github.com/yuxino-labs/koma)
- [Video-RAG-master](https://github.com/Leon1207/Video-RAG-master)
- [wxh1996/VideoAgent](https://github.com/wxh1996/VideoAgent)
- [Auto-Note](https://github.com/nodeeeeee/Auto-Note)
- [VidMind](https://github.com/yomazini/VidMind)
- [ai-video-summarizer](https://github.com/sidedwards/ai-video-summarizer)
- [call.md](https://github.com/video-db/call.md)

**תלות בחומרה או בשירות**

- NVIDIA VSS: ‏NIM מקומי דורש "NVIDIA AI Enterprise developer licence", ודוגמת הפריסה היא 2×RTX PRO 6000. מקור: [GitHub](https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization).
- Director תלוי ב־VideoDB. מקור: [GitHub](https://github.com/video-db/Director).
- HKUDS/VideoAgent דורש Gemini ו־8GB GPU. מקור: [README](https://github.com/HKUDS/VideoAgent).
- MR. Video דורש OpenAI ו־Gemini. מקור: [GitHub](https://github.com/ziqipang/MR-Video).
- video-recap-skills רץ על API של MiMo. מקור: [README](https://github.com/zenstory-ai/video-recap-skills).

**ספריות מתירניות פעילות**

| ספרייה | גרסה ותאריך | רישיון | מקור |
|---|---|---|---|
| scenedetect | 0.7.3, ‏8/11/2026 | BSD-3-Clause | [PyPI](https://pypi.org/project/scenedetect/) |
| rapidocr | 3.10.0 | Apache-2.0 | [PyPI](https://pypi.org/project/rapidocr/) |
| faster-whisper | 1.2.1 | MIT | [PyPI](https://pypi.org/project/faster-whisper/) |
| stable-ts | 2.19.1 | MIT | [PyPI](https://pypi.org/project/stable-ts/) |
| yt-dlp | 2026.10.26 | Unlicense | [PyPI](https://pypi.org/project/yt-dlp/) |
| docling | 2.149.0 | MIT | [PyPI](https://pypi.org/project/docling/) |
| lightrag-hku | 1.5.7 | MIT | [PyPI](https://pypi.org/project/lightrag-hku/) |

### Inferences — המפה

**לאמץ (קוד או תבנית, בלי שינוי מהותי)**

| מה | מאיפה (רישיון) | לאן | למה |
|---|---|---|---|
| חוזה שלבים: ראיות בלי LLM ← סינתזה בחוזה JSON ← בדיקה מכנית (audit) | lecture-to-notes (MIT) | עובד | מפריד בין עלות ה־LLM לראיות, ומאפשר להריץ שוב שלב אחד |
| `provenance.json` לכל שלב, ושלבים מצטברים | lecture-to-notes (MIT) | עובד | דיבוג של החלטות ושל רגרסיות |
| לא מתקנים את התמליל. מילים חשודות נכנסות לרשימה, והמודל פותר אותן בניתוח עם ⚠️ | lecture-to-notes (MIT) | עובד | המחבר בנה, מדד ופירק שני מעברי תיקון אוטומטי. ציטוט מילולי חייב תמליל יציב |
| ה־VLM לא עושה OCR. ‏OCR רק מ־RapidOCR | lecture-to-notes (MIT) | עובד | הפרדה בין סמנטיקה לטקסט |
| תלות חסרה מודיעה בקול | lecture-to-notes (MIT) | עובד | "wrong output rather than less output" היה סוג הבאג היקר ביותר אצלם |
| ציטוט מילולי חובה, אימות בקוד ודחיית פריט לא נתמך, וחלונות במקום קטיעה | Skill-Anything (MIT) | עובד | המנגנון הבסיסי לנאמנות ולחותמות זמן |
| Citations עם custom content: בלוק לכל מקטע תמליל או שקף | Anthropic (תיעוד ו־cookbook, MIT) | עובד | שליטה בגרנולריות. הבלוק ממופה לזמן מילה בקוד |
| מסמך בראש הפרומפט, שאלה בסוף, ציטוטים קודם, `<documents>` | Anthropic | עובד | עד 30% שיפור לפי התיעוד |
| כלי הסוכן: ‏timeline, ‏search (FTS + סמנטי), ‏get_transcript(range), ‏peek_frame (הפריים הקרוב ו־OCR), ‏crop_region | video-context-mcp (MIT) | עובד, ובהמשך "שאל את ההרצאה" | עיצוב מוכן לסוכן Claude שמסתכל בעצמו |
| FTS5 על מקטעים, וקישור עם `t=` | yt-fts (Unlicense) | עובד או PWA | חיפוש זול ומדויק בזמן |
| גלאי שינוי עם מסכת אזור זז | video-slide-extractor (MIT, ‏JS) | PWA, תצוגה מקדימה, או עובד דרך מימוש מחדש | פותר את בעיית חלון המצלמה וסרגל הצ'אט (slidoc) |
| זיהוי סצנות | PySceneDetect (BSD-3) | עובד | פעיל, ספרייה ב־Python |
| בדיקות קבלה: לולאת הזיה, אזור זז, מקביליות של שלבי ראייה | slidoc (MIT) | בדיקות העובד | כשלים אמיתיים מ־7.5 שעות |
| רתמת הערכה | Inspect (MIT) ו/או promptfoo (MIT) | CI ו־tools | סט זהב עם ציון בקוד ושופט Claude |
| בודקי נאמנות על CPU לאנגלית | MiniCheck-FT5, ‏AlignScore (MIT), ‏HHEM-2.1-Open (Apache) | עובד, אופציונלי | זולים. בודקים טענות לפני התרגום |
| מפת חשיבה | markmap (MIT) | PWA | רינדור מ־Markdown. Claude מייצר את העץ |

**להתאים (רעיון או אלגוריתם, במימוש שלנו עם Claude)**

| מה | מאיפה (רישיון) | ההתאמה |
|---|---|---|
| סוכן מעל כתוביות בלבד, וכלי סקירה גלובלית | DVD lite_mode (MIT) | ‏Claude במקום o3. הכלים מעל OCR+ASR שכבר יש לנו |
| map→reduce עם שמות עקביים | MR. Video (MIT) | map לכל מקטע נושא (Haiku), ‏reduce עם מילון ישויות (Sonnet/Opus). בלי Gemini |
| עץ אדפטיבי, וכתוביות→LLM | VideoTree, ‏LLoVi (MIT) | במקום כתוביות VLM צפופות (יקר על CPU), טקסט OCR ותיאור שקף רק בשינוי |
| טקסט עזר מיושר לזמן (OCR/ASR/detection) | Video-RAG (בלי רישיון), רעיון בלבד | זה כבר התכנון שלנו. לא נוגעים בקוד |
| גרף ידע מעל וידאו | VideoRAG, רק "Framework Architecture" ב־MIT | מבנה בלבד. בלי ImageBind ובלי הקוד |
| סמני `[slide:N]` ותקציב טקסט לשקף | steipete/summarize (MIT) | מזהי שקף ומקטע בפלט ה־JSON |
| טקסונומיית חלקים ועדשות | Fabric (MIT) | בלי מכסות ובלי "exactly 16 words". "אין" לגיטימי. ציטוט ומזהה מקטע בכל פריט |
| פרקים | Fabric create_video_chapters; ‏Azure chapterTitle + narrative | גבולות מהקוד (שינוי שקף, נושא), ושם ותקציר מ־Claude. אף פעם לא זמן שנכתב בידי LLM |
| שאלות לפי פרספקטיבה, ומנחה | STORM/Co-STORM (MIT) | מעבר כיסוי על מקטעים שלא צוטטו, ועדשות: ספקן, מיישם, סטודנט, מומחה |
| ציפוף | Chain of Density (מאמר; מימושים ב־Apache/MIT) | לתקציר העליון בלבד. אורך ובדיקת "לא הושמטה ישות" בקוד |
| אורך יחסי | OpenAI `detail` (MIT) | "עומק" כפונקציה של משך ומספר נושאים |
| ביטויים אסורים | Semantic Kernel (MIT) | רשימה בעברית ובאנגלית, ובדיקה בקוד |
| משימה אחת לכל פרומפט | open-notebook (MIT) | טיעונים, שאלות פתוחות, מונחים ופעולות, כל אחד במעבר נפרד |
| meta-summarization | Anthropic cookbook (MIT) | חתיכות לפי נושא ולא כל 2000 תווים. ‏"Not specified" לכל חלק חסר |
| כרטיסיות | to_flashcards, ‏create_quiz (Fabric, ‏MIT) | העקרונות כן. הדוגמה המעוגלת לא. כל כרטיס עם ציטוט ומזהה |
| שליפת כתוביות קיימות | youtube-transcript-api (MIT); הסדר של steipete | רק אם הערה 07 מאשרת. בשרת, לא בטלפון |
| יישור מילים | WhisperX (BSD-2) | רק אם יחסר לנו תזמון מילה. צריך wav2vec2 עברי, שלא קיים כברירת מחדל |

**להימנע**

| מה | למה |
|---|---|
| lecture2notes, ‏Whishper, ‏Speakr, ‏khoj, ‏pullmd | ⚠️ AGPL-3.0. סעיף הרשת חל על שירות מקוון כמו שלנו. ‏Whishper גם קפוא |
| noScribe, ‏TransformerSum, ‏Glarity, השרת של tldw | ⚠️ GPL-3.0. שילוב בקוד שלנו מחייב GPL לכל הנגזרת |
| ImageBind (דרך VideoRAG ו־HKUDS/VideoAgent), ‏Bespoke-MiniCheck-7B, ‏Lynx, ‏PageLM | ⚠️ NC או NC-SA. השירות שלנו מסחרי |
| screenpipe, החזית של tldw, ‏Phoenix | קוד גלוי בלבד: רישיון מסחרי, ‏PolyForm או Elastic. ‏Phoenix אפשר לכל היותר לשימוש פנימי, אחרי בדיקה |
| video2pdf, ‏koma, ‏Video-RAG-master, ‏wxh1996/VideoAgent, ‏Auto-Note, ‏VidMind, ‏ai-video-summarizer, ‏call.md | ⚠️ בלי רישיון, כלומר כל הזכויות שמורות. רעיונות כן, קוד לא |
| NVIDIA VSS, ‏Director, ‏video-recap-skills | GPU ורישיון NVAIE, ענן VideoDB, או API חיצוני |
| כל מה שתלוי ב־Gemini (MR. Video, ‏HKUDS/VideoAgent, ‏YouTubeTLDR, נתיב ה־ASR של lecture-to-notes) | מנוגד להחלטה: Claude בלבד |
| YoutubeTranscriptReader של LlamaIndex | זורק את חותמות הזמן |
| YoutubeLoader של LangChain, כרכיב | שכבה מיותרת: נשען על pytube לנתוני הסרטון, ועל תלות כבדה ב־langchain-community. עדיף youtube-transcript-api ישירות, ואת החלוקה לחתיכות של 120 שניות לממש בעצמנו |
| yt-fts, ‏UpTrain, ‏AlignScore, ‏FineSurE ו־FActScore כתלויות ארוכות טווח | 🪦 נטושים או קפואים. מותר ללמוד, ולהשתמש בקוד מתירני בזהירות (AlignScore ב־MIT), אבל בלי לצפות לתחזוקה |

**הערת בנייה נקייה**

- **בקוד:** מותר להעתיק קוד MIT, ‏BSD, ‏Apache או Unlicense, עם שמירת הודעת הרישיון. ‏Apache דורש גם NOTICE כשיש.
- **בפרומפטים:** עדיף לכתוב פרומפטים משלנו, ולהשתמש בתבניות של Fabric כרשימת בדיקה. כך נמנעות גם הבעיות שלהן: מכסות, ספירת מילים ודוגמאות שגויות.
- **בתיעוד ובממשק:** אסור לנסח השוואה למוצר אחר. כותבים את המונח המקצועי.

### Gaps
- **רישיון המודלים:** לא בדקתי את רישיון המשקלים של Surya, שבה משתמש lecture-to-notes. לפי הערה 06 זה OpenRAIL-M מותאם. נתיב שמחליף אותה ב־RapidOCR נשאר בתוך רישיונות מתירניים.
- **בדיקה משפטית:** לא נבדקה תאימות בין ECL-2.0 (Opencast) לבין MIT ו־Apache בשילוב. הם לא בתוכנית לאימוץ, ולכן זה לא דחוף.
- **Spaces:** אין מידע על רישיון הקוד של רוב ה־Spaces. רבים לא מצהירים רישיון, ולכן אין להעתיק מהם.
- **סתירות פתוחות:**
  - OmAgent: ‏Apache-2.0 בריפו מול MIT ב־PyPI.
  - MiniCheck: ‏Apache-2.0 מול MIT.
  - לפני שימוש בקוד צריך להכריע לפי קובץ ה־LICENSE בריפו, ולשמור את שתי ההודעות אם יש ספק.
