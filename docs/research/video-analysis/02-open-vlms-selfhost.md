# מודלי ראייה ווידאו פתוחים לאירוח עצמי לניתוח הרצאות — מודלים, חומרה (CPU מול GPU), מחירי GPU והטמעות לחיפוש (מצב 9/11/2026)

> **ההקשר**: ניתוח הרצאות ווובינרים ב־THE SNOWBALL Studio. השרת שלנו הוא Hetzner CX53: ‏x86, ‏16 vCPU משותפים, 32GB, בלי GPU. הוא כבר עסוק בעבודות תרגום (yt-dlp, ‏faster-whisper/ivrit-ai, ‏Parakeet ONNX, ‏ffmpeg), שרצות ב־Docker תחת gVisor.
>
> **מגבלות המחקר:**
> 1. **תקציב החיפוש נגמר באמצע.** תקציב החיפוש ברשת של הסבב משותף לכל הסוכנים, והוא נגמר באמצע העבודה. מאותו רגע אימתתי עובדות רק בשליפה ישירה של מקורות ראשוניים:
>    - כרטיסי המודלים וה־API ב־Hugging Face.
>    - תיעוד גולמי מ־GitHub.
>    - דפי המחירים של הספקים.
>    - ה־API של OpenRouter ושל Vast.ai.
>    - קובצי התוצאות הגולמיים של MTEB.
> 2. **אין מדידת CPU אמיתית.** ניסיתי להריץ מודל ראייה על CPU כאן, ומערכת ההרשאות חסמה את בניית llama.cpp מקוד חיצוני. לא עקפתי את החסימה. לכן כל זמני ה־CPU בהערות הם **הערכה מחושבת** (החישוב מפורט), לא מדידה.
> 3. **הציונים הם של היצרנים.** ציון בנצ'מרק הוא מה שהיצרן מדווח בכרטיס, אלא אם נכתב אחרת. יצרנים שונים מודדים בתשתיות הערכה שונות, ולכן הטבלאות שלהם לא תמיד ברות השוואה.
> 4. **"נוצר" הוא תאריך המאגר.** זה ה־`createdAt` של המאגר ב־HF API, כפי שבדקתי ב־9/11/2026.
> 5. **מחירים** הם כפי שהופיעו בדף ב־9/11/2026, בלי מע"מ אלא אם צוין אחרת.
> 6. **"לא אומת"** פירושו שהמידע בא מתקציר חיפוש או מאתר שמרכז מידע ממקורות אחרים, בלי מקור ראשוני.

## 1. שקפים ומסכים (טקסט צפוף, גרפים, קוד, דיאגרמות): אילו מודלים פתוחים הכי טובים, כולל OCR ייעודי?

### שורה תחתונה (Takeaway)
בנובמבר 2026 משפחת Qwen3.5/3.6 מובילה במסמכים ובגרפים בין המודלים הכלליים הפתוחים: Apache-2.0, שוחררה בפברואר–אפריל 2026.
- **4B–9B**: ‏Qwen3.5-9B מדווח OCRBench 89.2, ‏OmniDocBench 87.7 ו־CharXiv 73.0. זה מעל Qwen3-VL-30B-A3B מ־2025. גם Qwen3.5-4B כמעט משתווה לו.
- **פענוח מבני של שקף** (טבלאות, נתוני גרף, סדר קריאה): יש מודלי OCR ייעודיים זעירים, 0.6–1.3B, ברישיון מתירני — Nemotron 3.5 Parse, ‏LightOnOCR-3, ‏PaddleOCR-VL-1.6, ‏GLM-OCR.
- **הפער**: אף אחד מהם לא נבדק בפומבי על שקפים אמיתיים בעברית.

### ממצאים מתועדים (Cited Findings)

#### מודלים כלליים — מסמכים, גרפים ו־OCR (ציוני היצרן)
- **Qwen3.5 בגדלים הקטנים.** כל המודלים ב־Apache-2.0. Qwen3.5-0.8B (‏0.87B) ו־Qwen3.5-2B (‏2.27B) נוצרו ב־28/2/2026, ‏Qwen3.5-4B (‏4.66B) ו־Qwen3.5-9B (‏9.65B) ב־27/2/2026 — [HF API](https://huggingface.co/api/models?author=Qwen&search=Qwen3.5); [כרטיס Qwen3.5-9B](https://huggingface.co/Qwen/Qwen3.5-9B). ציונים (ב־0.8B וב־2B: חשיבה / בלי חשיבה):

| מודל | OCRBench | OmniDocBench1.5 | CharXiv(RQ) | CC-OCR | MMLongBench-Doc | MMMU | מקור |
|---|---|---|---|---|---|---|---|
| Qwen3.5-0.8B | 74.5 / 79.1 | 61.0 / 70.6 | 41.3 / 38.2 | 63.2 / 66.7 | 33.6 / 28.1 | 49 / 47.4 | [כרטיס Qwen3.5-2B](https://huggingface.co/Qwen/Qwen3.5-2B) |
| Qwen3.5-2B | 84.5 / 85.4 | 79.8 / 80.9 | 58.8 / 52.6 | 72.9 / 75.8 | 45.4 / 38.8 | 64.2 / 64.2 | [כרטיס Qwen3.5-2B](https://huggingface.co/Qwen/Qwen3.5-2B) |
| Qwen3-VL-2B (נוצר 19/10/2025) | 79.2 | 65.9 | 37.1 | 68.3 | 33.8 | 61.4 | [כרטיס Qwen3.5-2B](https://huggingface.co/Qwen/Qwen3.5-2B) |
| Qwen3-VL-4B (נוצר 11/10/2025) | 80.8 | 80.0 | 50.3 | 73.8 | 44.4 | 70.8 | [כרטיס Qwen3.5-2B](https://huggingface.co/Qwen/Qwen3.5-2B) |
| Qwen3.5-4B | 85.0 | 86.2 | 70.8 | 76.7 | 54.2 | 77.6 | [כרטיס Qwen3.5-9B](https://huggingface.co/Qwen/Qwen3.5-9B) |
| Qwen3.5-9B | 89.2 | 87.7 | 73.0 | 79.3 | 57.7 | 78.4 | [כרטיס Qwen3.5-9B](https://huggingface.co/Qwen/Qwen3.5-9B) |
| Qwen3-VL-30B-A3B (נוצר 30/9/2025) | 83.9 | 86.8 | 56.6 | 77.8 | 47.4 | 76.0 | [כרטיס Qwen3.5-9B](https://huggingface.co/Qwen/Qwen3.5-9B) |

- **Qwen3.5 בגדלים הגדולים** (כולם נוצרו ב־24/2/2026) — [כרטיס Qwen3.5-27B](https://huggingface.co/Qwen/Qwen3.5-27B):
  - Qwen3.5-27B: ‏OCRBench 89.4, ‏OmniDocBench 88.9, ‏CharXiv 79.5, ‏MMLongBench-Doc 60.2, ‏CC-OCR 81.0, ‏MMMU 82.3.
  - Qwen3.5-35B-A3B: ‏91.0 / 89.3 / 77.5 / 59.5 / 80.7 / 81.4.
  - Qwen3.5-122B-A10B: ‏92.1 / 89.8 / 77.2 / 59.0 / 81.8 / 83.9.
  - לשם השוואה, Qwen3-VL-235B-A22B (נוצר 22/9/2025): ‏87.5 / 84.5 / 66.1 / 56.2 / 81.5 / 80.6.
- **Qwen3.6-35B-A3B** (‏35.95B בסך הכל, Apache-2.0, נוצר 15/4/2026): ‏OCRBench 90.0, ‏CC-OCR 81.9, ‏CharXiv 78.0, ‏MMMU 81.7, ‏OmniDocBench1.5 89.9 — [כרטיס Qwen3.6-27B](https://huggingface.co/Qwen/Qwen3.6-27B); [כרטיס Qwen3.6-35B-A3B](https://huggingface.co/Qwen/Qwen3.6-35B-A3B).
  - באותן טבלאות, Gemma4-31B: ‏OCRBench 86.1, ‏CC-OCR 75.7, ‏CharXiv 67.9, ‏OmniDocBench 80.1, ‏MMMU 80.4.
  - Gemma4-26B-A4B: ‏CC-OCR 74.5, ‏CharXiv 69.0, ‏OmniDocBench 74.4, ‏MMMU 78.4.
- **Qwen3.6-27B** (נוצר 21/4/2026): ‏OCRBench 89.4, ‏CC-OCR 81.2, ‏CharXiv 78.4, ‏MMMU 82.9 — [כרטיס Qwen3.6-27B](https://huggingface.co/Qwen/Qwen3.6-27B).
- **Qwen3.8-27B** (Apache-2.0, נוצר 5/8/2026):
  - ‏OmniDocBench 91.1. ‏CharXiv(RQ) 83.7, או 90.2 עם code interpreter.
  - הבנת תמונה ווידאו מובנית: "from STEM diagrams and documents to hour-scale videos".
  - החשיבה פועלת כברירת מחדל.
  - מקור: [כרטיס Qwen3.8-27B](https://huggingface.co/Qwen/Qwen3.8-27B).
  - **שימו לב**: Qwen3.8-Flash-Next (נוצר 24/8/2026) הוא ברישיון `qwen-community-1.0`, לא Apache — [HF API](https://huggingface.co/api/models/Qwen/Qwen3.8-Flash-Next).
- **Gemma 4** (Apache-2.0) — [כרטיס gemma-4-31B-it](https://huggingface.co/google/gemma-4-31B-it); [HF API](https://huggingface.co/api/models?author=google&search=gemma-4):
  - תאריכים: E2B/E4B נוצרו ב־2/3/2026, ‏26B-A4B ו־31B ב־11/3/2026, ‏12B ב־23/5/2026.
  - MMMU Pro: ‏76.9 (31B), ‏73.8 (26B A4B), ‏69.1 (12B), ‏52.6 (E4B), ‏44.2 (E2B).
  - OmniDocBench (מרחק עריכה, נמוך יותר עדיף): ‏0.131 / 0.149 / 0.164 / 0.181 / 0.290, מול 0.365 של Gemma 3 27B.
  - תקציב טוקנים חזותי לכל תמונה: 70, 140, 280, 560 או 1120. הכרטיס ממליץ על תקציב גבוה "for tasks like OCR, document parsing, or reading small text".
- **השוואה בתשתית הבדיקה של Liquid** (מתוך כרטיס LFM3-VL-2B, ‏10/2026; ‏OCRBench v1 / ‏DocVQA / ‏ChartQA / ‏CharXiv-R / ‏MMMU) — [כרטיס LFM3-VL-2B](https://huggingface.co/LiquidAI/LFM3-VL-2B):
  - LFM3-VL-2B, עם חשיבה: ‏86.3 / 96.7 / 92.7 / 70.2 / 55.7. בלי חשיבה: ‏82.2 / 94.9 / 81.4 / 44.5 / 48.6.
  - Qwen3.5-2B: ‏83.6 / 95.6 / 85.2 / 58.1 / 58.1.
  - Qwen3.5-4B: ‏86.0 / 97.1 / 85.8 / 68.6 / 74.6.
  - MiniCPM-V4.7-1B: ‏82.1 / 91.8 / 88.8 / 44.5 / 51.0.
  - InternVL3.5-4B: ‏83.5 / 90.9 / 86.0 / 46.5 / 57.8.
  - Gemma4-E2B: ‏71.8 / 90.4 / 82.3 / 46.3 / 57.3.
  - Gemma4-12B: ‏81.1 / 97.0 / 89.4 / 77.1 / 76.7.
  - **סתירה**: כאן Qwen3.5-2B מקבל OCRBench 83.6, ואילו כרטיס Qwen מדווח 84.5 / 85.4 — [כרטיס Qwen3.5-2B](https://huggingface.co/Qwen/Qwen3.5-2B).
- **MiniCPM-V 4.6** (‏1.3B, ‏Apache-2.0, נוצר 13/4/2026) — [כרטיס MiniCPM-V-4.6](https://huggingface.co/openbmb/MiniCPM-V-4.6):
  - בנוי מ־SigLIP2-400M ומ־Qwen3.5-0.8B.
  - מקצץ את חישוב קידוד התמונה ביותר מ־50%.
  - לפי הכרטיס הוא "reaches Qwen3.5 2B-level capability on many benchmarks including … OCRBench".
- **MiniCPM-V 4.7** (‏1B: ‏1.55B, נוצר 6/10/2026; גם 35B-A3B, נוצר 7/10/2026; Apache-2.0) — [כרטיס MiniCPM-V-4.7-1B](https://huggingface.co/openbmb/MiniCPM-V-4.7-1B):
  - ברירת המחדל היא דחיסת טוקנים `downsample_mode` "16x". המצב "4x" שומר פי 4 טוקנים "for finer detail".
  - ‏`max_slice_nums` הוא 9 כברירת מחדל, והכרטיס ממליץ על 36 לתמונות.
- **מודלים ותיקים יותר, לייחוס** (2025):
  - Qwen2.5-VL-7B (נוצר 1/2025): ‏DocVQA 95.7, ‏InfoVQA 82.6, ‏ChartQA 87.3, ‏OCRBench 864 — [כרטיס](https://huggingface.co/Qwen/Qwen2.5-VL-7B-Instruct).
  - Qwen2.5-VL-72B: ‏OCRBench 885, ‏DocVQA 96.4, ‏ChartQA 89.5 — [כרטיס](https://huggingface.co/Qwen/Qwen2.5-VL-72B-Instruct).
  - LLaVA-OneVision-1.5-8B (‏Apache, נוצר 16/9/2025): ‏DocVQA 95.0, ‏ChartQA 86.48, ‏OCRBench 82.9 — [כרטיס](https://huggingface.co/lmms-lab/LLaVA-OneVision-1.5-8B-Instruct).
  - Kimi-VL-A3B-Thinking-2506 (‏MIT, ‏16.4B, נוצר 21/6/2025): ‏OCRBench 869, ‏MMMU 64.0 — [כרטיס](https://huggingface.co/moonshotai/Kimi-VL-A3B-Thinking-2506).
  - Phi-4-multimodal (‏MIT, ‏2/2025): ‏DocVQA 93.2, ‏ChartQA 81.4, ‏MMMU 55.1 — [כרטיס](https://huggingface.co/microsoft/Phi-4-multimodal-instruct).
- **Step3-VL-10B** (‏Apache-2.0, ‏10.17B, נוצר 13/1/2026): ‏MMMU 78.11, ‏OCRBench 86.75 — [כרטיס](https://huggingface.co/stepfun-ai/Step3-VL-10B).
- **GLM-4.6V** (‏106B, ‏MIT, נוצר 7/12/2025) ו־GLM-4.6V-Flash (‏9B): הקשר 128K, וקריאה לפונקציות מתוך קלט חזותי — [כרטיס GLM-4.6V](https://huggingface.co/zai-org/GLM-4.6V); [כרטיס GLM-4.6V-Flash](https://huggingface.co/zai-org/GLM-4.6V-Flash).
- **Qwen3-VL ודיאגרמות/קוד**: "Generates Draw.io/HTML/CSS/JS from images/videos" — [כרטיס Qwen3-VL-8B](https://huggingface.co/Qwen/Qwen3-VL-8B-Instruct).
- **granite-vision-4.1-4b** (‏Apache-2.0, נוצר 16/4/2026): מתמחה ב־chart2csv, ב־chart2code ובטבלאות כ־JSON/HTML. הכרטיס מזהיר: "trained on English instructions only and may produce degraded results for documents in other languages" — [כרטיס](https://huggingface.co/ibm-granite/granite-vision-4.1-4b).

#### מודלי OCR ופענוח מסמכים ייעודיים
- **Nemotron 3.5 Parse** (‏0.63B, ‏OpenMDW-1.1, נוצר 3/9/2026) — [כרטיס Nemotron-3.5-Parse](https://huggingface.co/nvidia/Nemotron-3.5-Parse):
  - מחזיר טקסט, טבלאות, נתוני גרפים, סדר קריאה, סיווגים ותיבות. הכרטיס מציין במפורש "scans, rendered PDFs, slides, forms…".
  - ב־4/11/2026 נוסף מודל טיוטה DFlash2 לפענוח ספקולטיבי ב־vLLM.
  - ParseBench (‏2,078 עמודים, H200, ‏BF16): שלושה מעברים — 75.20 ב־13.49 עמודים לשנייה; שני מעברים — 74.92 ב־14.60; מעבר אחד — 72.74 ב־18.57.
- **השוואה ב־ParseBench** (מאותו כרטיס; ציון שפורסם ועמודים לשנייה שנמדדו) — [כרטיס Nemotron-3.5-Parse](https://huggingface.co/nvidia/Nemotron-3.5-Parse):
  - LightOnOCR-3-4B: ‏75.10 (‏2.76 עמודים לשנייה).
  - LightOnOCR-3-0.8B: ‏74.60 (‏5.69).
  - Infinity-Parser2-Flash: ‏73.25 (‏3.06).
  - MinerU2.5-Pro-2605-1.2B: ‏72.78 (‏4.13).
  - LightOnOCR-3-1B: ‏71.40 (‏2.44).
  - Chandra-ocr-2: ‏70.10 (‏2.01).
  - PaddleOCR-VL-1.6: ‏67.43 (‏3.11).
  - Nemotron Parse 2.0: ‏63.91 (‏3.95).
- **LightOnOCR-3** (‏Apache-2.0; הגרסה של 1B נוצרה ב־7/10/2026) — [כרטיס LightOnOCR-3-1B](https://huggingface.co/lightonai/LightOnOCR-3-1B):
  - שלושה גדלים: 0.8B, ‏1B ו־4B. הגרסאות של 0.8B ושל 4B עברו לארכיטקטורה של Qwen3.5.
  - מצב עיגון למיקום בעמוד (grounding) מוסיף כ־25% טוקני פלט: 1,433 מול 1,158 לעמוד.
- **PaddleOCR-VL-1.6** (‏0.96B, ‏Apache-2.0, נוצר 27/5/2026; הכרטיס מציין שחרור ב־28/5): ‏OmniDocBench v1.6 ‏96.33% — [כרטיס](https://huggingface.co/PaddlePaddle/PaddleOCR-VL-1.6).
- **GLM-OCR** (‏0.9B, ‏MIT, נוצר 30/1/2026): ‏OmniDocBench V1.5 ‏94.62. השפות בכרטיס: zh, ‏en, ‏fr, ‏es, ‏ru, ‏de, ‏ja, ‏ko — [כרטיס](https://huggingface.co/zai-org/GLM-OCR).
- **MiniCPM-OCR 1.0** (‏1.3B, ‏Apache-2.0, נוצר 21/10/2026): ‏1.2 עמודים לשנייה. בטבלת הכרטיס, בשורה "Primary languages": ‏"Chinese and English". נתמך "from day one" ב־vLLM, ‏SGLang, ‏llama.cpp ו־Ollama. השרשרת: מודל הפריסה PP-DocLayoutV3 חותך אזורים, וכל אזור נשלח ב־HTTP לשירות הזיהוי — [כרטיס](https://huggingface.co/openbmb/MiniCPM-OCR-1.0).
- **DeepSeek-OCR-2** (‏3.39B, ‏Apache-2.0, נוצר 27/1/2026): מספר הטוקנים החזותיים הוא (0–6)×144+256 — [כרטיס](https://huggingface.co/deepseek-ai/DeepSeek-OCR-2).
- **WeVisOne-VL-2B** (‏Tencent, ‏Apache-2.0, ‏2.44B, נוצר 22/10/2026): בנוי על Qwen3-VL; זיהוי עצמים, עיגון, OCR וחיתוך רקע — [כרטיס](https://huggingface.co/tencent/WeVisOne-VL-2B).
- **אזהרת llama.cpp**: מודלי OCR "are trained with specific prompt and input structure". התיעוד מפנה לדיונים ייעודיים עבור PaddleOCR-VL, ‏GLM-OCR, ‏DeepSeek-OCR, ‏Dots.OCR ו־HunyuanOCR — [llama.cpp docs/multimodal.md](https://github.com/ggml-org/llama.cpp/blob/master/docs/multimodal.md).

### היסקים (Inferences)
- **שני מסלולים לשקף.** מודל פענוח ייעודי (Nemotron 3.5 Parse / ‏LightOnOCR-3 / ‏PaddleOCR-VL) מחלץ טקסט, טבלאות ונתוני גרף לפלט מובנה. מודל כללי (Qwen3.5-4B/9B או Qwen3.6) מסביר דיאגרמות, קוד ומשמעות. הפלט המובנה הוא קלט טקסט זול ל־Claude במקום תמונה.
- **4B הוא נקודת המתיקות.** לפי מספרי היצרן, Qwen3.5-4B כמעט משתווה ל־Qwen3-VL-30B-A3B במסמכים (OmniDocBench 86.2 מול 86.8) ועוקף אותו ב־CharXiv (‏70.8 מול 56.6). לכן מחלקת 4B היא כנראה האיזון הטוב בין איכות לחישוב.
- **צריך בדיקה משלנו.** מספרים של יצרנים שונים לא תמיד מתיישבים (סעיף הסתירה למעלה). לכן לפני בחירה סופית צריך מבחן קטן על 50–100 פריימים אמיתיים מהרצאות, בעברית ובאנגלית, עם קוד ועם גרפים.
- **רזולוציה קובעת לשקפים.** ב־Qwen3.x כל טוקן חזותי מכסה 32×32 פיקסלים (patch 16 ואיחוד 2×2) — [preprocessor_config.json](https://huggingface.co/Qwen/Qwen3.5-2B/raw/main/preprocessor_config.json). מכאן:
  - פריים 720p ≈ ‏900 טוקנים.
  - פריים 1080p ≈ ‏2,040 טוקנים.
  - פריים 768×432 ≈ ‏324 טוקנים.

  טקסט קטן בשקף דורש 720p לפחות. בדחיסה 16x של MiniCPM (ברירת המחדל) ובתקציב נמוך של Gemma 4 כנראה יאבד פרט.

### פערים (Gaps)
- **אין בדיקה על הרצאות.** לא מצאתי בנצ'מרק פומבי של המודלים האלה על פריימים מהרצאות מוקלטות (הקלטת מסך עם דחיסת וידאו), ולא על שקפים בעברית.
- **חסרים ציוני OCR ל־Qwen3.8-27B.** ‏OCRBench ו־CC-OCR לא חולצו; יש רק OmniDocBench ו־CharXiv.
- **חסרים ציונים בטקסט.** של MiniCPM-V 4.7 ושל Molmo2 הציונים מופיעים בכרטיס רק כתמונות.
- **ParseBench בודק מסמכים, לא שקפים.** אין מדד ייעודי לשקפים.
- **Muse-Glimmer-30B לא נבדק.** הוא מופיע ב־[vLLM](https://github.com/vllm-project/vllm/blob/main/docs/models/supported_models.md) (`meta-models/Muse-Glimmer-30B`, ‏T+I+V), ברשימת OpenVINO ובמחירון Together, אבל לא בדקתי את הכרטיס שלו. אתר מרכז אחד טוען Apache ו־MMMU Pro 74 — [xigh/open-weight-models](https://github.com/xigh/open-weight-models) (לא אומת).

## 2. אילו מודלים פתוחים מבינים וידאו ארוך ומחזירים חותמות זמן?

### שורה תחתונה (Takeaway)
**Qwen3-VL ו־Qwen3.5 ומעלה** היא המשפחה הפתוחה היחידה עם יישור מתועד בין טקסט לחותמת זמן: חותמת "<3.0 seconds>" לפני כל קבוצת פריימים, הקשר מובנה של 256K ותמיכה מלאה ב־vLLM.
- ב"מחט בערימת שחת" הדיוק 100% בסרטונים עד 30 דקות, ב־1 fps.
- **הרצאה של שעה — שתי דרכים:**
  - להעלות את תקציב הווידאו ל־224K טוקנים, כפי ש־Qwen ממליצה. זה דורש GPU גדול.
  - **עדיף לשקפים**: לדגום פריימים מרכזיים ברזולוציה גבוהה ולהזין כל אחד עם חותמת זמן טקסטואלית מפורשת.
- **Keye-VL-2.0** (‏Apache, ‏5/2026) מוביל בעיגון זמני, אבל דורש ענף מותאם של SGLang.
- **מגבלות של אחרים**: Gemma 4 מוגבל ל־60 שניות וידאו, ו־Nemotron 3.5 Bolt ל־2 דקות.

### ממצאים מתועדים (Cited Findings)
- **ארכיטקטורת Qwen3-VL**: ‏Interleaved-MRoPE, ‏DeepStack ו־"Text–Timestamp Alignment… for stronger video temporal modeling" — [Qwen3-VL README](https://github.com/QwenLM/Qwen3-VL).
- **מהמאמר** (גרסה 2, ‏27/11/2025) — [arXiv 2511.21631](https://arxiv.org/html/2511.21631):
  - לפני כל קבוצת פריימים בזמן נוספת חותמת טקסט, למשל "<3.0 seconds>". האימון היה בשני פורמטים: שניות ו־HMS.
  - עד 2,048 פריימים, ותקרת וידאו של כ־224K טוקנים.
  - ‏2 fps ברוב הבנצ'מרקים (4 fps ב־Charades-STA). עד 640 טוקנים לפריים (768 ב־VideoMMMU/MMVU).
  - הקשר מובנה של 256K.
  - מחט בערימת שחת: "a perfect 100% accuracy on videos up to 30 minutes" ב־1 FPS (הקשר 256K); 99.5% בהרחבת YaRN לכ־1M.
- **כרטיס Qwen3-VL**: "Native 256K context, expandable to 1M; handles books and hours-long video with full recall and second-level indexing" — [כרטיס Qwen3-VL-8B](https://huggingface.co/Qwen/Qwen3-VL-8B-Instruct).
- **הזנת רשימת פריימים**: אפשר להזין רשימת תמונות כ"וידאו" עם `sample_fps`, שמשמש "to determine timestamps for each frame". ‏`total_pixels` מומלץ מתחת ל־24576×32×32 — [Qwen3-VL README](https://github.com/QwenLM/Qwen3-VL).
- **תקציב ברירת המחדל לווידאו** הוא `longest_edge` 25,165,824 פיקסלים (patch 16, איחוד 2, שני פריימים לקבוצה), כלומר כ־12K טוקנים — [video_preprocessor_config.json](https://huggingface.co/Qwen/Qwen3.5-2B/raw/main/video_preprocessor_config.json). לסרטונים באורך שעות הכרטיס ממליץ על 469,762,048 ("corresponding to 224k video tokens") — [כרטיס Qwen3.5-9B](https://huggingface.co/Qwen/Qwen3.5-9B).
- **ב־vLLM**: מפעילים עם `--media-io-kwargs '{"video": {"num_frames": -1}}'` ומעבירים fps בכל בקשה. ברירת המחדל fps=2 — [כרטיס Qwen3.5-9B](https://huggingface.co/Qwen/Qwen3.5-9B).
- **ציוני וידאו** (היצרן; VideoMME עם / בלי כתוביות · ‏VideoMMMU · ‏MLVU · ‏LVBench):

| מודל | VideoMME | VideoMMMU | MLVU | LVBench | מקור |
|---|---|---|---|---|---|
| Qwen3.5-0.8B | 63.8 / 57.7 | 44.3 | 65.6 | 45.1 | [כרטיס Qwen3.5-2B](https://huggingface.co/Qwen/Qwen3.5-2B) |
| Qwen3.5-2B | 75.6 / 69.0 | 62.1 | 76.2 | 57.1 | [כרטיס Qwen3.5-2B](https://huggingface.co/Qwen/Qwen3.5-2B) |
| Qwen3-VL-4B | 76.0 / 68.9 | 69.4 | 75.7 | 53.5 | [כרטיס Qwen3.5-2B](https://huggingface.co/Qwen/Qwen3.5-2B) |
| Qwen3.5-4B | 83.5 / 76.9 | 74.1 | 82.8 | 66.4 | [כרטיס Qwen3.5-9B](https://huggingface.co/Qwen/Qwen3.5-9B) |
| Qwen3.5-9B | 84.5 / 78.4 | 78.9 | 84.4 | 70.0 | [כרטיס Qwen3.5-9B](https://huggingface.co/Qwen/Qwen3.5-9B) |
| Qwen3-VL-30B-A3B | 79.9 / 73.3 | 75.0 | 78.9 | 59.2 | [כרטיס Qwen3.5-9B](https://huggingface.co/Qwen/Qwen3.5-9B) |
| Qwen3.5-27B | 87.0 / 82.8 | 82.3 | 85.9 | 73.6 | [כרטיס Qwen3.5-27B](https://huggingface.co/Qwen/Qwen3.5-27B) |
| Qwen3.5-122B-A10B | 87.3 / 83.9 | 82.0 | 87.3 | 74.4 | [כרטיס Qwen3.5-27B](https://huggingface.co/Qwen/Qwen3.5-27B) |
| Qwen3.6-35B-A3B | 86.6 / 82.5 | 83.7 | 86.2 | 71.4 | [כרטיס Qwen3.6-35B-A3B](https://huggingface.co/Qwen/Qwen3.6-35B-A3B) |
| Qwen3.6-27B | 87.7 / — | 84.4 | 86.6 | — | [כרטיס Qwen3.6-27B](https://huggingface.co/Qwen/Qwen3.6-27B) |
| Qwen3.8-27B · Qwen3.8-Flash-Next | — | — | — | 72.4 · 76.6 | [כרטיס Qwen3.8-Flash-Next](https://huggingface.co/Qwen/Qwen3.8-Flash-Next) |

- **Keye-VL-2.0-30B-A3B** (‏31.12B, ‏Apache-2.0, נוצר 25/5/2026) — [כרטיס](https://huggingface.co/Kwai-Keye/Keye-VL-2.0-30B-A3B):
  - עיגון זמני: Charades-TimeLens ‏58.4 mIoU (‏Gemini 3 Flash: ‏61.19); ‏ActivityNet-TimeLens ‏58.5 (מול 56.95); ‏QVHighlights-TimeLens ‏70.1 (מול 49.45).
  - ב־VideoMME V2 הציון עולה מ־35.3% ב־64 פריימים ל־42.4% ב־512 פריימים. ‏LongVideoBench ‏74.1.
  - קשב דליל (DSA) והקשר של 256K.
  - ההגשה דרך ענף מותאם של SGLang; ברירת המחדל fps 2.0.
- **MiniCPM-V 4.5** (‏8.7B, נוצר 24/8/2025): ‏Video-MME ‏73.5 בזמן הסקה כולל של 0.26 שעות ו־28GB. לשם השוואה, Qwen2.5-VL-7B: ‏71.6 ב־3 שעות; ‏GLM-4.1V: ‏73.6 ב־2.63 שעות. ה־3D-Resampler דוחס 6 פריימים ל־64 טוקנים — [כרטיס](https://huggingface.co/openbmb/MiniCPM-V-4_5).
- **MiniCPM-V 4.6**: עד 128 פריימים. סרטון של עד 128 שניות נדגם ב־1 fps, ארוך יותר נדגם באחידות. ‏`stack_frames` מאפשר תת־פריימים בגריד — [כרטיס](https://huggingface.co/openbmb/MiniCPM-V-4.6).
- **LFM3-VL-2B** (‏1.92B, רישיון LFM Open v1.0, נוצר 19/10/2026) — [כרטיס](https://huggingface.co/LiquidAI/LFM3-VL-2B):
  - וידאו ב־2 fps, ‏4–768 פריימים, הקשר של 256K. ב־llama.cpp הוא תמיד דוגם 2 fps, ו־`--video-fps` לא משפיע.
  - הכרטיס מציין במפורש "Ask questions about a recorded lecture".
  - ציונים עם חשיבה: Video-MME בלי כתוביות 62.8, ‏MLVU ‏71.3, ‏Video-MMMU ‏49.6.
  - **סתירת תאריך**: לפי HF API נוצר ב־19/10; תקציר חיפוש טען שחרור ב־27/10 (לא אומת).
- **Gemma 4**: "Video supports a maximum of 60 seconds assuming the images are processed at one frame per second" — [כרטיס gemma-4-31B-it](https://huggingface.co/google/gemma-4-31B-it).
- **Nemotron 3.5 Bolt** (‏74.89B בסך הכל, ‏9B פעילים, ‏OpenMDW-1.1, נוצר 9/10/2026) — [כרטיס](https://huggingface.co/nvidia/NVIDIA-Nemotron-3.5-Bolt-74B-A9B-BF16):
  - mp4 עד 2 דקות: ‏1080p ב־1 FPS עד 128 פריימים, או 720p ב־2 FPS עד 256 פריימים.
  - ‏10 שפות. ב־vLLM יש `--video-pruning-rate 0.5`.
  - **סתירת תאריך**: תקציר חיפוש ציין 15/10 (לא אומת).
- **Nemotron Nano 12B v2 VL** (‏NVIDIA Open Model License, נוצר 21/10/2025): ‏2 FPS, ‏8–128 פריימים — [כרטיס](https://huggingface.co/nvidia/NVIDIA-Nemotron-Nano-12B-v2-VL-BF16).
- **Molmo2-8B/4B** (‏Apache-2.0, נוצר 14/12/2025): הבנה ועיגון של תמונה, וידאו וריבוי תמונות, כולל מאגרי VideoPoint ו־VideoTrack. "competitive on long-videos" — [כרטיס](https://huggingface.co/allenai/Molmo2-8B).
- **Qwen3-Omni-30B-A3B** (‏Apache-2.0, נוצר 20/9/2025): ‏Video-MME ‏70.5, ‏MLVU ‏75.2, ‏LVBench ‏50.2. קלט דיבור ב־19 שפות, בלי עברית — [כרטיס](https://huggingface.co/Qwen/Qwen3-Omni-30B-A3B-Instruct).
- **VideoLLaMA3-7B/2B** (‏Apache-2.0, נוצר 21/1/2025, מבוסס Qwen2.5): קו בסיס ותיק — [כרטיס](https://huggingface.co/DAMO-NLP-SG/VideoLLaMA3-7B).
- **SmolVLM2** (‏2/2025): ‏Video-MME — ‏2.2B: ‏52.1 (MLVU ‏55.2), ‏500M: ‏42.2, ‏256M: ‏33.7 — [בלוג SmolVLM2, ‏20/2/2025](https://huggingface.co/blog/smolvlm2).
- **llama.cpp** (המקור כפי שנכלל ב־llama-cpp-python 0.3.36 מ־1/10/2026) — [PyPI llama-cpp-python 0.3.36](https://pypi.org/project/llama-cpp-python/0.3.36/); [tools/mtmd](https://github.com/ggml-org/llama.cpp/tree/master/tools/mtmd):
  - פענוח וידאו דרך ffmpeg (`MTMD_VIDEO`, "requires ffmpeg binary in PATH").
  - ‏`--video-fps` ברירת מחדל 4.0. ‏`--video-timestamp-interval` ברירת מחדל 5000ms, ומוסיף טקסט בצורת "[10m50.5s]".
  - בכותרת: "for now, video input is only supported via C++ helper functions".
  - llama-server מקבל חלקי `video_url`/`input_video`.

### היסקים (Inferences)
- **חשבון להרצאה של שעה** (הערכה, מבוססת על 32×32 פיקסלים לטוקן ושני פריימים לקבוצה):
  - **ב־2 fps**: ‏7,200 פריימים הם 3,600 קבוצות. בתקציב של 224K יוצא כ־62 טוקנים לקבוצה, כלומר כ־336×190 פיקסלים לפריים — קטן מדי לקריאת שקף.
  - **ב־0.5 fps**: ‏900 קבוצות × ‏~220 טוקנים ≈ ‏198K טוקנים, כלומר כ־640×352 פיקסלים.
  - **המסקנה**: "כל הסרטון למודל" מתאים ל"מה קורה מתי" — מבנה, הדגמות, מעברים. לא מתאים לקריאת שקפים צפופים. את השקפים מטפלים כפריימים מרכזיים ברזולוציה גבוהה.
- **חותמות זמן לפריימים לא אחידים.** פריימים שנבחרו לפי שינוי סצנה שוברים את המיפוי `sample_fps` → חותמת זמן. לכן עדיף להזין כל פריים מרכזי כתמונה, עם קידומת זמן טקסטואלית מפורשת — אותו מנגנון ש־llama.cpp מזריק. ציר הזמן העיקרי יבוא מהתמלול שכבר יש לנו (ASR עם חותמות זמן).
- **מפת פרקים.** כנראה תמלול עם חותמות זמן ועוד טקסט השקפים מספיקים. הבנת וידאו של מודל ראייה נחוצה בעיקר להדגמות, להקלטות מסך ולכתיבה על לוח.
- **Keye-VL-2.0 לאיתור רגעים מדויק.** מבטיח, אבל דורש ענף SGLang מותאם, ו־31B ב־BF16 הם כ־62GB משקלים. לכן צריך GPU של 80–96GB (הערכה).

### פערים (Gaps)
- **אין הערכה על הרצאות.** לא מצאתי הערכה פומבית של המודלים על הרצאות או וובינרים, ובטח לא על הרצאות בעברית.
- **ציוני Charades-STA חסרים.** של Qwen3-VL/3.5 הם לא חולצו, כי שליפת המאמר נקטעה.
- **לא ידוע אם חותמות הזמן של Qwen3.5 נכונות דרך llama.cpp**, שמזריק טקסט "[10m50.5s]" משלו (לא אומת).
- **של Molmo2 אין ציוני וידאו בטקסט** — רק תמונות.

## 3. אילו מודלים זעירים רצים על CPU למיון פריימים ולתיאור קצר?

### שורה תחתונה (Takeaway)
המועמדים הזעירים הטובים (עד ~2.5B; ‏GGUF עם mmproj בסביבות 1.3–2 GB):

| מודל | גודל | רישיון ותאריך | הערה |
|---|---|---|---|
| Qwen3.5-0.8B / 2B | 0.87B / 2.27B | Apache, ‏2/2026 | |
| MiniCPM-V 4.6 | 1.3B | Apache, ‏4/2026 | |
| MiniCPM-V 4.7-1B | 1.55B | Apache, ‏10/2026 | |
| LFM3-VL-2B | 1.92B | LFM Open, ‏10/2026 | חזק, אבל הרישיון מוגבל להכנסה של עד $10M ואין בו עברית |

- SmolVLM2 (‏2/2025) חלש בבירור.
- Moondream 3.1 הוא MoE של 9B שמכוון ל־GPU.
- **למיון "האם זה שקף חדש?" לא צריך מודל ראייה בכלל.** שינוי סצנה והשוואת תמונות ב־ffmpeg זולים יותר. תפקיד המודל הזעיר הוא לסווג את סוג הפריים (שקף / קוד / פנים / הדגמה) ולתת תיאור קצר.

### ממצאים מתועדים (Cited Findings)
- **גדלי GGUF** (המודל ב־Q4_K_M אלא אם צוין, ועוד mmproj; סכום קבצים בלי זיכרון הקשר) — [ggml-org](https://huggingface.co/ggml-org); [Qwen GGUF](https://huggingface.co/Qwen/Qwen3-VL-2B-Instruct-GGUF); [unsloth/Qwen3.5-2B-GGUF](https://huggingface.co/unsloth/Qwen3.5-2B-GGUF); [openbmb/MiniCPM-V-4.7-1B-gguf](https://huggingface.co/openbmb/MiniCPM-V-4.7-1B-gguf); [LiquidAI/LFM3-VL-2B-GGUF](https://huggingface.co/LiquidAI/LFM3-VL-2B-GGUF):

| מודל | קובץ המודל | mmproj | סך הכל |
|---|---|---|---|
| SmolVLM2-500M-Video | Q8 ‏0.44GB | Q8 ‏0.11GB | ‏~0.55GB |
| MiniCPM-V-4.6 | ‏0.53GB | Q8 ‏0.73GB | ‏~1.26GB |
| GLM-OCR | Q8 ‏0.95GB | Q8 ‏0.48GB | ‏~1.43GB |
| LFM3-VL-2B | ‏1.10GB | ‏0.38GB | ‏~1.48GB |
| Qwen3-VL-2B | ‏1.11GB | Q8 ‏0.45 / F16 ‏0.82GB | ‏~1.56–1.93GB |
| SmolVLM2-2.2B | ‏1.11GB | Q8 ‏0.59GB | ‏~1.70GB |
| MiniCPM-V-4.7-1B | ‏0.67GB | f16 ‏1.11GB (קיים גם mmproj של 4x, ‏0.90GB) | ‏~1.57–1.78GB |
| Qwen3.5-2B | ‏1.28GB | F16 ‏0.67GB | ‏~1.95GB |
| LFM2.5-VL-3B | ‏1.67GB | ‏0.85GB | ‏~2.52GB |
| Qwen3-VL-4B | ‏2.50GB | F16 ‏0.84GB | ‏~3.34GB |
| gemma-4-E2B | Q4_0 ‏2.84GB | Q8 ‏0.56GB | ‏~3.40GB |
| Qwen3.5-4B | ‏2.74GB | F16 ‏0.67GB | ‏~3.41GB |
| gemma-4-E4B | Q4_0 ‏4.59GB | Q8 ‏0.56GB | ‏~5.15GB |
| Qwen3-VL-8B | ‏5.03GB | F16 ‏1.16GB | ‏~6.19GB |
| Qwen3.5-9B | ‏5.68GB | F16 ‏0.92GB | ‏~6.60GB |
| gemma-4-26B-A4B | Q4_0 ‏14.62GB | BF16 ‏1.19GB | ‏~15.8GB |
| Qwen3.6-35B-A3B | ‏20.54GB | BF16 ‏0.90GB | ‏~21.4GB |

- **Qwen3.5-2B ו־0.8B**:
  - ‏Qwen3.5-2B עובד בלי חשיבה כברירת מחדל ("operates in non-thinking mode by default"). שני הגדלים "more prone to entering thinking loops" במצב חשיבה — [כרטיס Qwen3.5-2B](https://huggingface.co/Qwen/Qwen3.5-2B); [כרטיס Qwen3.5-0.8B](https://huggingface.co/Qwen/Qwen3.5-0.8B).
  - פרמטרי הדגימה המומלצים לראייה בלי חשיבה: temperature 0.7, ‏top_p 0.8, ‏top_k 20, ‏presence_penalty 1.5.
- **MiniCPM-V 4.6**: מקצץ את חישוב קידוד התמונה ביותר מ־50%, ומשיג "~1.5x token throughput" לעומת Qwen3.5-0.8B. במדד Artificial Analysis Intelligence Index הוא מקבל 13, מול 10 של Qwen3.5-0.8B. נתמך ב־vLLM, ‏SGLang, ‏llama.cpp ו־Ollama — [כרטיס](https://huggingface.co/openbmb/MiniCPM-V-4.6).
- **MiniCPM-V 4.7**: "GGUF weights support CPU inference". יש תמיכת OpenVINO מהיום הראשון "on Intel CPU/GPU/NPU platforms", וגם ראשי DSpark לפענוח ספקולטיבי — [כרטיס MiniCPM-V-4.7-1B](https://huggingface.co/openbmb/MiniCPM-V-4.7-1B).
- **LFM3-VL-2B** — [כרטיס](https://huggingface.co/LiquidAI/LFM3-VL-2B):
  - מבנה: ‏1.73B מודל שפה, ‏164M מקודד חזותי ו־25M מקרין.
  - ‏16 שפות, בלי עברית. דורש llama.cpp ‏b11960 ומעלה.
  - **ממוצע 62 מבחנים** (בתשתית של Liquid):

| מודל | ממוצע |
|---|---|
| LFM3-VL-2B עם חשיבה | 71.4 |
| LFM3-VL-2B בלי חשיבה | 62.1 |
| Qwen3.5-2B | 64.0 |
| MiniCPM-V4.7-1B | 57.5 |
| Gemma4-E2B | 53.6 |
| Qwen3.5-4B | 73.4 |

- **LFM2.5-VL-3B**: "228 tok/s on an Apple M5 Max and 116 tok/s on an AMD Ryzen AI Max+ 395, in under 3.3 GB", וכ־11K טוקנים לשנייה על H100 אחד בעומס גבוה — [כרטיס](https://huggingface.co/LiquidAI/LFM2.5-VL-3B). ‏LFM2.5-VL-450M נוצר ב־8/4/2026 — [HF API](https://huggingface.co/api/models/LiquidAI/LFM2.5-VL-450M).
- **SmolVLM2-2.2B** (‏Apache-2.0): ‏OCRBench ‏72.9, ‏DocVQA ‏79.98 — [כרטיס](https://huggingface.co/HuggingFaceTB/SmolVLM2-2.2B-Instruct). ב־vLLM הוא רשום כטקסט+תמונה בלבד — [vLLM supported_models](https://github.com/vllm-project/vllm/blob/main/docs/models/supported_models.md).
- **מדידה יחידה שמצאתי על CPU** — [בלוג OpenVINO-VLM, ‏15/10/2025](https://huggingface.co/blog/openvino-vlm):
  - המערכת: SmolVLM2-256M על Core Ultra 7 265K (מעבד שולחני), תמונה אחת.
  - PyTorch: זמן לטוקן ראשון 5.150 שניות, ‏0.722 טוקנים לשנייה.
  - OpenVINO: ‏0.420 שניות, ‏47.24 טוקנים לשנייה.
  - OpenVINO עם קוונטיזציה של 8 ביט למשקלים בלבד: ‏0.247 שניות, ‏63.93 טוקנים לשנייה.
- **Gemma 4 E2B**: ‏2.3B אפקטיבי (5.1B עם ההטמעות), מקודד חזותי של כ־150M, הקשר 128K — [כרטיס gemma-4-E2B-it](https://huggingface.co/google/gemma-4-E2B-it).
- **moondream3.1-9B-A2B** (‏Moondream Model License 1.0, נוצר 30/6/2026): תיאור, שאילתה, זיהוי והצבעה. רץ על NVIDIA Ampere או Apple Silicon — [כרטיס](https://huggingface.co/moondream/moondream3.1-9B-A2B).

### היסקים (Inferences)
- **ב־CX53 הבעיה היא זמן מעבד, לא זיכרון.** מודל זעיר של עד 2GB נכנס בנוחות בזיכרון, אבל הזמן הוא האילוץ (סעיף 5).
- **שרשרת מיון מומלצת:**
  1. זיהוי שינוי סצנה והסרת כפילויות ב־ffmpeg.
  2. מודל זעיר רק על הפריימים המועמדים — עשרות, לא אלפים — ברזולוציה מוקטנת.
  3. פלט JSON קצר: סוג, יש טקסט / קוד / גרף, ותיאור של שורה אחת.
- **סדר העדפה**: ‏Qwen3.5-0.8B/2B או MiniCPM-V 4.6/4.7-1B (‏Apache). אחריהם LFM3-VL-2B (מגבלת רישיון ואין עברית), ובסוף SmolVLM2 (חלש).
- **הממצא של OpenVINO** מראה שההבדל בין מנועים הוא בסדר גודל (PyTorch מול OpenVINO). על CPU לא להריץ ב־PyTorch גולמי.

### פערים (Gaps)
- **אין מדידות זמן על מעבדי שרת x86** לאף אחד מהמודלים האלה (כולל llama.cpp).
- **איכות תיאור בעברית לא נבדקה** באף מודל זעיר.
- **לא מצאתי כרטיס GGUF רשמי עם mmproj ל־Qwen3.5-0.8B** (ב־ggml-org יש רק את קובץ המודל).

## 4. רישיונות ועברית/RTL: מה מותר מסחרית, ומה ידוע על עברית?

### שורה תחתונה (Takeaway)
**מתירני** (שימוש מסחרי בלי ספי הכנסה):
- **Apache-2.0**: ‏Qwen3-VL (כל הגדלים), ‏Qwen3.5/3.6, ‏Qwen3.8-27B, ‏Gemma 4, ‏MiniCPM-V 4.5–4.7, ‏MiniCPM-OCR, ‏InternVL3.5, ‏Keye-VL-2.0, ‏Molmo2, ‏LightOnOCR-3, ‏PaddleOCR-VL-1.6, ‏DeepSeek-OCR-2, ‏Ovis2.5, ‏granite-vision-4.1, ‏Step3-VL.
- **MIT**: ‏GLM-4.6V, ‏GLM-OCR, ‏Phi-4-mm, ‏Kimi-VL, ‏DeepSeek-OCR.
- **OpenMDW-1.1**: משפחת Nemotron 3.5.

**מוגבל:**
- LFM Open — חינם רק מתחת להכנסה של $10M.
- Qwen Research — ‏Qwen2.5-VL-3B ו־jina-embeddings-v4.
- ‏`qwen-community-1.0` — ‏Qwen3.8-Flash-Next.
- NVIDIA Open Model License.
- **לא מסחרי**: NSCL ו־CC-BY-NC.

**עברית**: אף כרטיס של מודל ראייה כללי לא מתחייב לעברית בתמונה. הנתון המדוד היחיד הוא של Nemotron 3.5 Parse, על 100 עמודים סינתטיים: ‏CER ‏4.16%, מול 0.79% בלטינית.

### ממצאים מתועדים (Cited Findings)
- **רישיונות לפי HF API** (נבדק 9/11/2026) — [HF API](https://huggingface.co/api/models?search=Qwen3-VL):
  - Qwen3-VL ‏2B/4B/8B/30B-A3B/32B/235B-A22B: ‏Apache-2.0.
  - ‏Qwen2.5-VL-3B: ‏`qwen-research`. ‏Qwen2.5-VL-72B: רישיון `qwen`. ‏Qwen2.5-VL-7B ו־32B: ‏Apache-2.0.
  - ‏Eagle2.5-8B: ‏`nsclv1` (לא מסחרי).
  - ‏Nemotron-Nano-12B-v2-VL: ‏NVIDIA Open Model License.
  - ‏Llama-4-Scout: ‏`llama4`, מוגבל בהרשמה.
  - ‏LFM2.5/LFM3: ‏`lfm1.0`.
  - ‏moondream3.1: ‏`moondream-model-license-1.0`.
- **OpenMDW-1.1** (עודכן לאחרונה 27/5/2026): מתיר שימוש מסחרי בלי ספים, וייחוס נדרש רק בהפצה — [OpenMDW-1.1](https://openmdw.ai/license/1-1/).
- **רישיון LFM**: שימוש מסחרי חינם רק לגוף שהכנסתו השנתית מתחת ל־$10,000,000 — [LFM license](https://www.liquid.ai/lfm-license).
- **jina-embeddings-v4**: "This model was initially released under cc-by-nc-4.0 due to an error. The correct license is the Qwen Research License" — [כרטיס](https://huggingface.co/jinaai/jina-embeddings-v4).
- **ColQwen2.5**: עמוד השדרה (Qwen2.5-VL) תחת "Qwen RESEARCH LICENSE AGREEMENT", והמתאמים תחת MIT. סט האימון "fully English by design" — [כרטיס colqwen2.5-v0.2](https://huggingface.co/vidore/colqwen2.5-v0.2).
- **Llama 4**: אתר מרכז טוען ש־Llama 4 ו־Llama 3.2 Vision נפסלים בגלל החרגה של שימוש מולטימודלי באיחוד האירופי — [xigh/open-weight-models](https://github.com/xigh/open-weight-models) (מקור משני, לא אומת).
- **עדויות על עברית:**
  - **Qwen3.5**: "Expanded support to 201 languages and dialects" (טקסט). ‏MMMLU: ‏81.2 ל־9B, ‏76.1 ל־4B — [כרטיס Qwen3.5-9B](https://huggingface.co/Qwen/Qwen3.5-9B).
  - **שפות ה־OCR של Qwen3-VL — סתירה בין המקורות**:
    - ה־README: "Supports 32 languages (up from 10)" — [Qwen3-VL README](https://github.com/QwenLM/Qwen3-VL).
    - כרטיס HF: "32 languages (up from 19)" — [כרטיס Qwen3-VL-8B](https://huggingface.co/Qwen/Qwen3-VL-8B-Instruct).
    - המאמר: 39 שפות, עם דיוק מעל 70% ב־32 מהן — [arXiv 2511.21631](https://arxiv.org/html/2511.21631).
    - אף מקור שקראתי לא מפרט אם עברית ברשימה.
  - **Gemma 4**: "Out-of-the-box support for 35+ languages, pre-trained on 140+ languages" — [כרטיס gemma-4-31B-it](https://huggingface.co/google/gemma-4-31B-it).
  - **Nemotron 3.5 Parse — עברית** (‏100 עמודים סינתטיים) — [כרטיס](https://huggingface.co/nvidia/Nemotron-3.5-Parse):
    - BoC F1 ‏99.79 ו־CER ‏4.16%. בגרסה 2.0: ‏97.62 ו־5.79%.
    - לשם השוואה, CER כללי 1.35%, לטינית 0.79%, ערבית 5.80%.
    - הכרטיס מסייג: "These results do not guarantee accuracy on complex scanned documents, handwriting, degraded images, or other real-world variations".
  - **מודלים בלי עברית:**
    - Nemotron 3.5 Bolt — ‏10 שפות — [כרטיס](https://huggingface.co/nvidia/NVIDIA-Nemotron-3.5-Bolt-74B-A9B-BF16).
    - LFM3-VL-2B — ‏16 שפות — [כרטיס](https://huggingface.co/LiquidAI/LFM3-VL-2B).
    - Qwen3-Omni — אין עברית בקלט דיבור — [כרטיס](https://huggingface.co/Qwen/Qwen3-Omni-30B-A3B-Instruct).
  - **Phi-4-multimodal**: עברית ברשימת שפות הטקסט, אבל הראייה באנגלית בלבד — [כרטיס](https://huggingface.co/microsoft/Phi-4-multimodal-instruct).
  - **Ministral-3**: הכרטיס מונה "English, French, Spanish, German, Italian, Portuguese, Dutch, Chinese, Japanese, Korean, Arabic" — [כרטיס Ministral-3-3B](https://huggingface.co/mistralai/Ministral-3-3B-Instruct-2512).
  - **granite-vision-4.1**: אנגלית בלבד — [כרטיס](https://huggingface.co/ibm-granite/granite-vision-4.1-4b).
  - **MiniCPM-OCR 1.0**: סינית ואנגלית — [כרטיס](https://huggingface.co/openbmb/MiniCPM-OCR-1.0).

### היסקים (Inferences)
- **סדר התווים בעברית הוא החשד המרכזי.** ב־Nemotron 3.5 Parse ‏BoC F1 של 99.79% עם CER של 4.16% מעידים שהתווים מזוהים, אבל הסדר שגוי. CER רגיש לסדר; BoC לא. זה דפוס אופייני לבעיית RTL/bidi — היסק, לא נבדק.
- **הסיכון הגבוה ביותר הוא שקף מעורב**: עברית עם קוד או נוסחאות באנגלית.
- **לשקפים בעברית — שלושה בלמים:**
  1. מודל כללי עם בסיס רב־לשוני חזק (Qwen3.5/3.6).
  2. אימות מול התמלול — טקסט ה־ASR כבר בעברית ומכיל את המונחים.
  3. מעבר הסופי של Claude בשרשרת הקיימת.

  לא לסמוך על OCR ייעודי בעברית בלי מבחן משלנו.
- **החלטת רישיון פשוטה.** כל המועמדים המובילים (Qwen3.5/3.6, ‏MiniCPM-V, ‏Gemma 4, ‏Nemotron Parse, ‏LightOnOCR-3, ‏PaddleOCR-VL) מתירניים. אין סיבה לבחור במודל מוגבל.

### פערים (Gaps)
- **אין בנצ'מרק OCR פומבי בעברית** למודלי ראייה כלליים, וסדר קריאה RTL בשקפים לא נחקר.
- **רשימת 32/39 שפות ה־OCR של Qwen3-VL לא נבדקה** לגבי עברית.
- **תנאי Llama 4** לגבי משתמש ישראלי עם שרת באיחוד האירופי — לא נבדקו במקור.

## 5. מה המציאות של הרצה על CPU ב־CX53 (מנועים, קוונטיזציה, זיכרון, זמן ל־100 פריימים)?

### שורה תחתונה (Takeaway)
**טכנית אפשרי.** מודלים קטנים (עד 4B ב־Q4/Q8, כלומר 1.3–3.4GB זיכרון) רצים בשלושה מנועים:
- **llama.cpp**: ‏libmtmd, ו־llama-server עם API תואם OpenAI.
- **OpenVINO GenAI**: רשימת מודלי הראייה החדשים הרחבה ביותר על CPU.
- **vLLM על CPU**: נבדק עם Gemma 4 ועם Qwen3-VL-30B-A3B על Xeon 6.

CTranslate2 לא תומך במודלי ראייה, ו־TGI במצב תחזוקה.

**זמנים**: לא מצאתי מדידה פומבית על שרת x86. ההערכה שלי: מודל של 2B ב־720p ≈ ‏15–35 שניות לפריים, כלומר כ־25–60 דקות לכל 16 הליבות ל־100 פריימים. ברזולוציה מוקטנת ועם הדחיסה של MiniCPM — הרבה פחות.

**מה זה אומר ל־CX53**: השרת כבר מריץ תרגום — 12–53% מזמן העבודה הוא מעבד, הזיכרון מוגבל ל־19.75GiB, ו־gVisor מוסיף קנס. לכן ה־CPU מתאים רק למיון זעיר של כמה עשרות פריימים בזמנים פנויים. לא ל"קריאת שקפים באיכות הכי גבוהה".

### ממצאים מתועדים (Cited Findings)
- **llama.cpp** — [docs/multimodal.md](https://github.com/ggml-org/llama.cpp/blob/master/docs/multimodal.md):
  - "llama.cpp supports multimodal input via `libmtmd`".
  - llama-server חושף `/chat/completions` תואם OpenAI. ‏`--no-mmproj-offload` משאיר את המקרין על ה־CPU.
  - יש GGUF מוכנים ב־ggml-org: Gemma 4 ‏E2B/E4B/26B-A4B/31B, ‏Qwen2.5-VL, ‏InternVL3, ‏SmolVLM2 ועוד.
- **וידאו ב־llama.cpp** מחייב `MTMD_VIDEO` ו־ffmpeg ב־PATH (פירוט ברירות המחדל בסעיף 2) — [tools/mtmd](https://github.com/ggml-org/llama.cpp/tree/master/tools/mtmd); [llama-cpp-python 0.3.36](https://pypi.org/project/llama-cpp-python/0.3.36/).
- **vLLM על CPU** — [vLLM CPU installation](https://github.com/vllm-project/vllm/blob/main/docs/getting_started/installation/cpu.md):
  - תומך ב־x86 וב־ARM. מומלץ `dtype=bfloat16` "due to unstable float16 support in torch CPU".
  - קוונטיזציה: AWQ, ‏GPTQ ו־INT8 W8A8 (ב־x86).
  - ב־Docker צריך `--cap-add SYS_NICE --security-opt seccomp=unconfined`, בגלל קריאות מערכת של NUMA שנחסמות. משתנים רלוונטיים: `VLLM_CPU_KVCACHE_SPACE` ו־`VLLM_CPU_OMP_THREADS_BIND`.
  - במעבדי AMD Zen, ‏float16 דורש AVX512-FP16, שקיים רק מ־Venice ואילך.
- **מודלים מולטימודליים שנבדקו על vLLM CPU** (מתכונים ל־Xeon 6): ‏Llama-4-Scout, ‏gemma-3-4b/12b, ‏gemma-4-E2B/E4B/26B-A4B, ‏Phi-4-multimodal, ‏Qwen2.5-VL-7B, ‏Qwen3-VL-30B-A3B — [vLLM CPU models](https://github.com/vllm-project/vllm/blob/main/docs/models/hardware_supported_models/cpu.md).
- **OpenVINO GenAI** — [OpenVINO GenAI SUPPORTED_MODELS](https://github.com/openvinotoolkit/openvino.genai/blob/master/SUPPORTED_MODELS.md):
  - טבלת מודלי הראייה: Qwen2-VL, ‏Qwen2.5-VL, ‏Qwen3-VL, ‏Qwen3.5/3.6/3.8, ‏MiniCPM-V 4.5/4.6/4.7, ‏MiniCPM-OCR-1.0, ‏LFM3-VL, ‏InternVL, ‏Gemma 3/3n/4/4-unified, ‏Phi-4-mm, ‏DeepSeek-OCR-2, ‏LLaVA-NeXT-Video, ‏VideoChat-Flash, ‏Muse-Glimmer.
  - **שימו לב**: ברשימה רק LLaVA-NeXT-Video ו־VideoChat-Flash מסומנים כמודלי וידאו.
- **ONNX Runtime GenAI**: ‏"Qwen (language + vision)", ‏"Phi (language + vision)", ‏"LFM2 (language + vision + speech input)" — [onnxruntime-genai](https://github.com/microsoft/onnxruntime-genai).
- **CTranslate2**: רק מודלי מקודד־מפענח (כולל Whisper), מפענח בלבד (Llama, ‏Gemma, ‏Qwen2 ועוד) ומקודד בלבד (BERT, ‏XLM-RoBERTa). אין מודלי ראייה — [CTranslate2](https://github.com/OpenNMT/CTranslate2).
- **TGI**: "text-generation-inference is now in maintenance mode", וממליצים על vLLM ו־SGLang — [TGI](https://github.com/huggingface/text-generation-inference).
- **Ollama**: ‏qwen3-vl ב־2b/4b/8b/30b — ‏1.9/3.3/6.2/20GB. הקשר של 256K, קלט טקסט ותמונה בלבד, דורש Ollama 0.12.7 — [ollama qwen3-vl](https://ollama.com/library/qwen3-vl).
- **הקשר פנימי של ה־CX53** — [studio-parallel-plan.md](../../studio-parallel-plan.md):
  - `mem_fit` = תקרה של 19.75GiB פחות 10% ו־400MB, כלומר ≈17.8GB.
  - חלק המעבד מזמן עבודה: 12% (סרטון של 5 דקות), 46% (60 דקות), 53% (120 דקות). השאר הוא המתנה ל־Claude והעברת קבצים.
  - תחת gVisor חריגת זיכרון מפילה את כל הקונטיינר.
  - ויתור על gVisor היה מאיץ את שלב היישור (CPU) ב־20–28% — כלומר זה הקנס של gVisor על השלב הזה.
  - ‏vCPU משותף משתנה פי 1.6 בין מדידות.
- **מכסת החשבון ב־Hetzner Cloud היא 20 vCPU** (‏23/10/2026) — [studio-server.md](../../studio-server.md).

### היסקים (Inferences)
- **הערכת זמן לפריים על 16 ה־vCPU** — חישוב בלבד, לא מדידה:
  - **הנחות**:
    - חישוב ≈ 2 × פרמטרים × טוקנים, ועוד קשב במקודד החזותי.
    - תפוקה אפקטיבית של 0.3–0.8 TFLOPS בעיבוד הפרומפט, ‏15–30 טוקנים לשנייה בפענוח — ההנחה הזו לא נבדקה.

| תרחיש | חישוב לפריים (TFLOP) | שניות לפריים | ‏100 פריימים |
|---|---|---|---|
| Qwen3.5-2B ב־720p (‏900 טוקנים; מקודד של כ־0.33B לפי גודל ה־mmproj ב־F16, ‏0.67GB, על כ־3,600 טלאים של 16 פיקסלים) | ≈7 | 15–35 (כולל ~150 טוקני פלט) | 25–60 דקות |
| Qwen3.5-2B ב־768×432 (‏324 טוקנים) | ≈2.3 | 5–15 (עם פלט JSON קצר של 30–50 טוקנים) | 8–25 דקות |
| MiniCPM-V 4.6 בתצורת מיון (`max_slice_nums=1`, דחיסה 16x; ‏0.8B LM; קידוד חזותי מקוצץ ב־50%+) | ≈0.5–1 | 2–5 | 3–8 דקות |

  - **MiniCPM בקריאת שקפים מלאה** (ברירת המחדל 9 פרוסות, ו־36 מומלץ לתמונות): החישוב גדל בערך לפי מספר הפרוסות. לכן במצב הזה הוא לא בהכרח זול מ־Qwen3.5-2B ב־720p (הערכה; גודל הפרוסה לא מופיע בכרטיס).
  - **Qwen3.5-9B**: פי 4–5 יותר — לא מעשי ב־CX53 לצד תרגום.
- **זיכרון**:
  - מודלים קטנים (1.3–3.4GB, ועוד הקשר קטן) נכנסים בתקציב לצד העבודות.
  - Qwen3.5-9B ב־Q4 (‏6.6GB) צמוד.
  - Gemma-4-26B-A4B (‏~15.8GB) ו־Qwen3.6-35B-A3B (‏~21.4GB) לא נכנסים לצד עבודות תרגום.
- **הזמן הפנוי**: עבודות ארוכות ממתינות ל־Claude כמחצית מהזמן. מיון זעיר בעדיפות נמוכה (`nice`) יכול לנצל את הזמן הזה.
- **התנאים ל־CPU**:
  - להגדיר את שלב הניתוח ב־perf.py ובתוכנית השלבים, אחרת הקבלה החזויה תטעה (ראו [00-internal-infrastructure.md](00-internal-infrastructure.md)).
  - להשאיר הזמנת זיכרון מלאה בגלל gVisor.
- **הבחירה בין המנועים** (שלושתם מתאימים):
  - **llama.cpp**: הכי פשוט — בינארי אחד, GGUF ושרת תואם OpenAI. כבר יש ffmpeg בתמונה.
  - **OpenVINO**: הקפיצה הגדולה בבלוג נמדדה על מעבד Intel. ב־AMD — לא נבדק.
  - **vLLM CPU**: דורש הרשאות Docker (`seccomp=unconfined`), שמתנגשות עם מדיניות ה־gVisor שלנו (היסק).

### פערים (Gaps)
- **מדידה אמיתית חסרה**: זמן לפריים ב־llama.cpp/OpenVINO על ה־CX53 עצמו. ניסיתי למדוד בסביבת המחקר והבנייה נחסמה.
- **פרוטוקול המדידה המומלץ:**
  - הכלים: `llama-mtmd-cli` או `llama-server`.
  - המודלים: MiniCPM-V-4.6 ‏Q4_K_M ו־Qwen3.5-2B ‏Q4_K_M.
  - הקלט: 20 פריימים אמיתיים, ב־720p וב־432p.
  - התנאים: `-t 8` ו־`-t 16`, פעם עם עבודת תרגום ברקע ופעם בלעדיה, ופעם תחת gVisor ופעם בלעדיו.
- **דגם המעבד של ה־CX53 לא מתועד.** לא ידוע אם הוא Intel או AMD, ואם יש AVX-512/AMX. הבדיקה: `lscpu`.
- **לא ידוע אם OpenVINO GenAI תומך בקלט וידאו** ל־Qwen3.5 או רק בתמונות.

## 6. אפשרויות GPU ומחירים, ועלות להרצאה של שעה: אירוח עצמי מול API

### שורה תחתונה (Takeaway)
בהיקף שלנו (עשרות עד מאות הרצאות בחודש), **API של מודל פתוח הוא הזול ביותר**: כ־$0.005–0.05 להרצאה על 100 פריימים מרכזיים.
- **GPU לפי שנייה**: Modal ‏L4 ב־$0.80 לשעה ($30 קרדיטים חינם בחודש), או RunPod ‏L4 קהילתי ב־$0.44 לשעה. העלות המוערכת היא $0.02–0.07 להרצאה, כולל הפעלה קרה.
- **שרת GPU ייעודי**: Hetzner GEX45 ‏(RTX PRO 4000, ‏24GB) עולה €214 לחודש ועוד €209 הקמה. מצדיק את עצמו רק באלפי הרצאות בחודש, או אם מעבירים אליו גם את התמלול והיישור.
- **הכל דורש אישור מפורש של המשתמש על המחיר.**

### ממצאים מתועדים (Cited Findings)
- **Hetzner, שרתי GPU ייעודיים** (אירו, בלי מע"מ, נבדק 9/11/2026) — [Hetzner GPU matrix](https://www.hetzner.com/dedicated-rootserver/matrix-gpu):

| שרת | GPU | חודשי | לשעה | הקמה |
|---|---|---|---|---|
| GEX45 | RTX PRO 4000 Blackwell SFF, ‏24GB, ‏i5-13500, ‏64GB | €214.00 | €0.3429 | €209.00 |
| GEX63 | RTX PRO 6000 Blackwell Max-Q, ‏96GB | €999.00 | €1.6009 | €999.00 |
| GEX131 | RTX PRO 6000 Max-Q, ‏Xeon Gold 5412U | מ־€1,499.00 | €2.4022 | €1,499.00 |
| GEX430 | ‏4× RTX PRO 6000 | €3,599.00 | €5.7676 | €3,599.00 |

- **GEX44 לא מופיע עוד** בדף המטריצה. דף התיעוד (עודכן 21/10/2026) מונה את GEX44 ו־GEX130 בלי מחירים — [Hetzner docs gpu-server](https://docs.hetzner.com/robot/dedicated-server/server-lines/gpu-server/); [GEX44](https://www.hetzner.com/dedicated-rootserver/gex44/).
- **מחירים היסטוריים** (לא אומת: מתקצירי חיפוש בלבד, כי דף התאמות המחיר הרשמי החזיר 404) — [הכרזת GEX44](https://www.hetzner.com/news/new-gpu-server); [השוואה צד שלישי](https://www.centron.de/en/vergleich/gpu-hetzner):
  - ‏GEX44 הושק ב־€184 לחודש ועוד €79 הקמה. בטבלת התאמת מחירים מאוחרת יותר: ‏€232.30 בלי IPv4, ועוד €114 הקמה. ההשוואה של צד שלישי מביאה €234 ועוד €114.
  - ‏GEX131 הוכרז בדצמבר 2025 בלי דמי הקמה. לפי מאמר השוואה, אחר כך נקבעו €159 הקמה, ובמחירון של יוני 2026: ‏€1,197.30 בלי IPv4 ועוד €599 הקמה.
  - **סתירה ומגמה**: היום הדף הרשמי מציג ל־GEX131 ‏€1,499 לחודש ו־€1,499 הקמה. כלומר דמי ההקמה עלו בחדות בתוך שנה — לבדוק את המחיר בדף ביום ההזמנה.
- **Modal** (דולר, חיוב לפי שנייה, נבדק 9/11/2026) — [Modal pricing](https://modal.com/pricing):
  - לשעה: ‏T4 ‏$0.59, ‏L4 ‏$0.80 ($0.000222 לשנייה), ‏A10 ‏$1.10, ‏L40S ‏$1.95, ‏A100-40GB ‏$2.10, ‏A100-80GB ‏$2.50, ‏RTX PRO 6000 ‏$3.03, ‏H100 ‏$3.95, ‏H200 ‏$4.54, ‏B200 ‏$6.25.
  - מעבד: כ־$0.0472 לליבה פיזית לשעה. זיכרון: כ־$0.008 ל־GiB לשעה.
  - תוכנית Starter: ‏$30 קרדיטים בחודש.
  - מכפילים: בחירת אזור ×1.15–1.75; ריצה שלא ניתנת להפקעה ×3.
- **RunPod** (דולר לשעה, "Updated November 4, 2026"; ענן מאובטח / ענן קהילתי) — [RunPod pricing](https://www.runpod.io/pricing):
  - ‏L4 ‏$0.59/$0.44; ‏RTX 4090 ‏$0.89/$0.34; ‏RTX 5090 ‏$1.19/$0.69; ‏A40 ‏$0.59/$0.35; ‏L40S ‏$1.09/$0.79; ‏A100 80GB ‏$1.79/$1.19; ‏H100 PCIe ‏$2.89/$1.99; ‏RTX PRO 6000 ‏$2.49/$1.69.
  - Serverless (לשעה): מחלקת 24GB ‏$0.75, ‏4090 ‏$1.34, ‏L40S ‏$1.75, ‏A100 ‏$2.72, ‏RTX PRO 6000 ‏$3.49, ‏H100 ‏$5.39.
- **Vast.ai** (שוק; מחירים חיים מה־API ב־9/11/2026, לפי דרישה, GPU אחד; חציון ובסוגריים מינימום) — [Vast.ai API bundles](https://console.vast.ai/api/v0/bundles/); [Vast.ai pricing](https://vast.ai/pricing):
  - ‏RTX 3090 ‏$0.202 ($0.098); ‏RTX 4090 ‏$0.437 ($0.136); ‏RTX 5090 ‏$0.601; ‏L4 ‏$0.321 ($0.104); ‏RTX A6000 ‏$0.457; ‏L40S ‏$0.802; ‏A100 PCIe ‏$0.736; ‏A100 SXM4 ‏$0.845; ‏RTX PRO 6000 WS ‏$1.470; ‏H100 SXM ‏$2.501.
  - מכונות שניתן להפקיע: "50%+ cheaper".
- **Scaleway**: ‏L4-1-24G ב־€0.79 לשעה (כ־€574.87 לחודש, לפני מס). ל־L40S/H100 לא הוצג מחיר באזור PAR-1 — [Scaleway GPU pricing](https://www.scaleway.com/en/pricing/gpu/).
- **OVHcloud** (דולר, מחירי "From" לשעה): ‏L4 ‏$1, ‏A10 ‏$1, ‏L40S ‏$1.80, ‏H100 ‏$2.99, ‏V100S ‏$0.88 — [OVHcloud GPU](https://www.ovhcloud.com/en/public-cloud/gpu/).
- **Lambda** (בתוקף מ־16/11/2026, לפני מס, ל־GPU לשעה): ‏A6000 ‏$1.09, ‏A10 ‏$1.29, ‏A100 40GB ‏$1.99, ‏GH200 ‏$2.59, ‏H100 PCIe ‏$3.79, ‏H100 SXM ‏$4.89, ‏B200 ‏$7.99 — [Lambda pricing](https://lambda.com/pricing).
- **Replicate** (דולר לשעה): ‏CPU ‏$0.36, ‏T4 ‏$0.81, ‏L40S ‏$3.51, ‏A100-80GB ‏$5.04, ‏H100 ‏$5.49. במודל פרטי מחויבים גם על זמן ההקמה וזמן ההמתנה — [Replicate pricing](https://replicate.com/pricing).
- **Together** (דולר ל־1M טוקנים, קלט/פלט): ‏Qwen3.5 9B ‏$0.17/$0.25; ‏Nemotron 3.5 Super VL ‏$0.15/$0.50; ‏Qwen3.8 Flash ‏$0.15/$0.47; ‏GLM-5.3-Flash ‏$0.15/$0.50. ‏GPU ייעודי: ‏H100 ‏$5.49 לשעה, ‏B200 ‏$8.99 — [Together pricing](https://www.together.ai/pricing).
- **DeepInfra** (דולר ל־1M טוקנים, קלט/פלט) — [DeepInfra pricing](https://deepinfra.com/pricing):
  - ‏Qwen3.5-9B ‏$0.10/$0.15; ‏Qwen3.5-35B-A3B ‏$0.14/$1.00; ‏Qwen3.6-35B-A3B ‏$0.10/$0.95; ‏Qwen3.6-27B ‏$0.32/$3.20; ‏Qwen3-VL-30B-A3B ‏$0.15/$0.60.
  - ‏gemma-4-26B-A4B ‏$0.07/$0.34; ‏gemma-4-31B ‏$0.20/$0.40; ‏Nemotron-3.5-Super-VL ‏$0.15/$0.50.
  - הטמעות: bge-m3 ו־multilingual-e5-large ב־$0.01.
  - ‏GPU ייעודי: ‏A100 ‏$1.49 לשעה, ‏H100 ‏$2.90.
- **Fireworks** — [Fireworks pricing](https://fireworks.ai/pricing):
  - ‏GLM 5.3 Flash ‏$0.15/$0.50.
  - הטמעות: ‏$0.008 ל־1M (עד 150M פרמטרים), ‏$0.016 (‏150–350M), ‏Qwen3 8B ‏$0.10.
  - ‏H100/H200 ‏$8.00 לשעה. אין בדף מחיר לקלט תמונה.
- **Alibaba Model Studio** (סינגפור, המסמך עודכן 7/11/2026, "$" בלי קוד מטבע; ל־1M, קלט/פלט) — [Model Studio pricing](https://www.alibabacloud.com/help/en/model-studio/model-pricing):
  - ‏qwen3-vl-plus ‏$0.2/$1.6 (הקשר 0–32K); ‏qwen3.8-flash ‏$0.15/$0.47; ‏qwen3.7-flash ‏$0.03/$0.13 (הקשר 0–32K); ‏qwen3.5-flash ‏$0.1/$0.4.
  - מודלים פתוחים: ‏qwen3.8-27b ‏$0.5/$3; ‏qwen3.6-35b-a3b ‏$0.375/$2.25.
  - המסמך לא מסביר איך נספרים טוקני תמונה.
- **OpenRouter** (‏461 מודלים, נבדק 9/11/2026; ל־1M, קלט/פלט; אין שדה מחיר נפרד לתמונה) — [OpenRouter models API](https://openrouter.ai/api/v1/models):
  - ‏z-ai/glm-5.3-flash ‏$0.0335/$0.083 (קלט טקסט, תמונה ווידאו); ‏qwen/qwen3.7-flash ‏$0.03/$0.13.
  - ‏qwen/qwen3.5-9b ‏$0.17/$0.25; ‏qwen/qwen3.6-35b-a3b ‏$0.10/$0.90; ‏qwen/qwen3.8-27b ‏$0.15/$1.875; ‏qwen/qwen3.8-flash ‏$0.15/$0.47.
  - ‏google/gemma-4-26b-a4b-it ‏$0.09/$0.30 (קיימת גרסה חינמית); ‏google/gemma-4-31b-it ‏$0.20/$0.40.
  - ‏nvidia/nemotron-3.5-super-vl ‏$0.15/$0.50 (קיימת גרסה חינמית); ‏qwen/qwen3-vl-8b-instruct ‏$0.25/$0.75; ‏moondream3.1 ‏$0.30/$2.50.
- **GLM-5.3-Flash** הוא מודל פתוח (‏MIT) של 321B — [HF API](https://huggingface.co/api/models/zai-org/GLM-5.3-Flash).
- **Baseten**: דף המחירים לא החזיר מחירים — [Baseten pricing](https://www.baseten.co/pricing/).
- **הקשר פנימי**: עלות Claude לפרק של 22 דקות היא $0.084–0.112 (medium) ו־$0.14–0.19 (high). בפרק כזה כ־2,800 מילים — [studio-learning.md](../../studio-learning.md).

### היסקים (Inferences)
- **עלות להרצאה דרך API של מודל פתוח** (הערכה):
  - **הנחות**: ‏100 פריימים מרכזיים ב־720p ≈ ‏90K טוקני תמונה + פרומפטים ≈ ‏100K קלט, ועוד ~150 טוקני פלט לפריים ≈ ‏15K פלט. בלי חשיבה (ב־Qwen3.5-9B ו־Qwen3.8 החשיבה פועלת כברירת מחדל וצריך לכבות אותה). בהנחה שהספק סופר טוקני תמונה לפי החישוב של המודל עצמו — לא אומת.

| מודל / ספק | קלט/פלט ל־1M | עלות להרצאה |
|---|---|---|
| GLM-5.3-Flash / OpenRouter | $0.0335 / $0.083 | ≈ $0.005 |
| qwen3.7-flash / Alibaba | $0.03 / $0.13 | ≈ $0.005 |
| gemma-4-26B-A4B / DeepInfra | $0.07 / $0.34 | ≈ $0.012 |
| Qwen3.5-9B / DeepInfra | $0.10 / $0.15 | ≈ $0.012 |
| Qwen3.5-9B / OpenRouter, Together | $0.17 / $0.25 | ≈ $0.021 |
| Qwen3.8-Flash / OpenRouter, Together, Alibaba | $0.15 / $0.47 | ≈ $0.022 |
| Nemotron 3.5 Super VL / DeepInfra, Together | $0.15 / $0.50 | ≈ $0.023 |
| Qwen3.6-35B-A3B / OpenRouter | $0.10 / $0.90 | ≈ $0.024 |
| Qwen3-VL-30B-A3B / DeepInfra | $0.15 / $0.60 | ≈ $0.024 |
| Qwen3.8-27B / OpenRouter | $0.15 / $1.875 | ≈ $0.043 |
| qwen3.8-27b / Alibaba | $0.5 / $3 | ≈ $0.095 |

  - **"כל הסרטון"**: ב־0.5 fps זה ≈198K טוקנים. ב־Qwen3.5-9B או Qwen3.6-35B-A3B יוצא כ־$0.02–0.04 להרצאה של שעה.
  - **לשם השוואה**: Claude עולה היום $0.084–0.112 לפרק של 22 דקות (medium), רובו על תרגום — [studio-learning.md](../../studio-learning.md). עלות שליחת אותם פריימים ל־Claude לא חושבה כאן.
- **GPU לפי שנייה** (הערכה גסה):
  - ‏Qwen3.5-9B ב־FP8 (≈10GB) על L4/4090 בשרשרת vLLM.
  - עיבוד מוקדם של 100K טוקנים ≈ ‏2×9.65e9×1e5 ≈ ‏1.9 PFLOP. בתפוקה אפקטיבית של עשרות TFLOPS זה עשרות שניות.
  - פענוח 15K טוקנים באצוות, ועוד הפעלה קרה וטעינת משקלים של 1–3 דקות, נותנים כ־3–5 דקות GPU.
  - **עלות**:
    - Modal ‏L4: ‏GPU בלבד ≈ ‏$0.04–0.07. ‏Modal גובה בנוסף על ליבות וזיכרון. בתצורה של 2–4 ליבות פיזיות ו־16–32GiB זה עוד כ־$0.22–0.45 לשעה, ולכן ≈ ‏$0.05–0.10 להרצאה.
    - RunPod Serverless (מחלקת 24GB, ‏$0.75 לשעה) ≈ ‏$0.04–0.06.
    - ‏RunPod ‏L4 קהילתי / ‏Vast 4090 (שרת שמדליקים ומכבים) ≈ ‏$0.02–0.04.
  - **קרדיטים**: ‏$30 בחודש ב־Modal ≈ ‏24–37 שעות L4 (עם או בלי תוספת המעבד והזיכרון) ≈ כמה מאות הרצאות בחודש בלי תשלום. בתנאי שהקרדיטים לא דורשים אמצעי תשלום — לא נבדק.
- **שרת GEX45 ייעודי**:
  - שנה ראשונה: €214×12+€209 ≈ €2,777, כלומר כ־€231 לחודש.
  - מול API ב־~$0.02 להרצאה, נקודת האיזון היא כ־12,700 הרצאות בחודש (‏€231×1.1 ÷ ‏$0.02; שער של כ־1.1 דולר לאירו — הנחה).
  - **מתי כן**: הוא משתלם רק אם מעבירים אליו גם את faster-whisper והיישור, שיתקצרו מאוד על GPU. זו החלטה נפרדת.
  - **24GB מספיקים** ל־Qwen3.5-9B ב־FP8, ול־Qwen3.6-35B-A3B ב־Q4 עם הקשר קטן (היסק לפי גודלי הקבצים).
  - ‏"מחיר לשעה" של GEX עם €209 הקמה לא מתאים להשכרה קצרה.
- **פרטיות**: שליחת פריימים להרצאות של המשתמש לספק API חיצוני מחייבת בדיקת מדיניות שמירת נתונים לפני הפעלה. GPU שלנו (ב־Modal או ב־RunPod) משאיר שליטה רבה יותר במודל ובנתונים.

### פערים (Gaps)
- **ספירת טוקני תמונה**: לא ידוע איך OpenRouter, ‏DeepInfra ו־Together סופרים טוקני תמונה, ואם הם מקטינים תמונות.
- **מדיניות שמירת נתונים** של ספקי ה־API לא נבדקה.
- **אין מדידת תפוקה פומבית** של Qwen3.5-9B על L4 או 4090 עם קלט תמונה. העלויות ל־GPU הן הערכה.
- **מחירי Baseten ו־fal** לא התקבלו. מחירי OVHcloud הם "From" בלי מועד.
- **תנאי הקרדיטים של Modal** (אמצעי תשלום, תוקף) לא נבדקו.

## 7. מחסניות הגשה: תמיכה בווידאו וריבוי תמונות, וטיפים לתפוקה

### שורה תחתונה (Takeaway)
**vLLM** הוא ברירת המחדל ל־GPU. הוא תומך בטקסט, ריבוי תמונות ווידאו ב־Qwen3.5, ‏Qwen3-VL, ‏MiniCPM-V 4.5–4.7, ‏Gemma 4, ‏Molmo2, ‏LFM3-VL ו־Nemotron 3.5 Super VL, ובמודלי ה־OCR החדשים.
- **SGLang** נדרש ל־Keye-VL-2.0 (ענף מותאם), ומופיע בכרטיסי Qwen ו־MiniCPM.
- **llama.cpp** הוא האפשרות ל־CPU ולהתקנה פשוטה.
- **LMDeploy** תומך ב־Qwen3.5 רק במנוע PyTorch.
- **TGI** במצב תחזוקה.
- **Ollama** מסתפק בתמונות.

### ממצאים מתועדים (Cited Findings)
- **טבלת vLLM** (ענף main, נבדק 9/11/2026) — [vLLM supported_models](https://github.com/vllm-project/vllm/blob/main/docs/models/supported_models.md):
  - **טקסט, ריבוי תמונות ווידאו**, עם אפשרות להזין הטמעות מחושבות מראש: ‏Qwen3.5, ‏Qwen3.5-MoE, ‏Qwen3-VL, ‏Qwen3-VL-MoE, ‏MiniCPM-V (4_5/4_6/4_7), ‏LFM3-VL, ‏InternVL3.5 (וידאו), ‏GLM-4.1V ו־4.5V.
  - **Gemma 4** גם אודיו, בחלק מהגרסאות.
  - **ריבוי תמונות ווידאו**: Nemotron 3.5 Super VL.
  - **תמונה או וידאו** (לא שניהם יחד): Molmo2.
  - **טקסט ותמונה בלבד**: Nemotron Parse 3.5, ‏PaddleOCR-VL, ‏GLM-OCR, ‏DeepSeek-OCR/OCR-2, ‏LightOnOCR, ‏Kimi-VL, ‏Step3-VL-10B.
  - **Muse Glimmer** (`meta-models/Muse-Glimmer-30B`): טקסט, ריבוי תמונות וריבוי סרטונים.
- **הערות vLLM** — [vLLM supported_models](https://github.com/vllm-project/vllm/blob/main/docs/models/supported_models.md):
  - "`Qwen*-VL` officially uses `qwen_vl_utils` for image preprocessing, while vLLM uses `transformers`' `video_processing_qwen*`, which leads to slightly different results".
  - ב־Qwen-3.5 אפשר `--language-model-only` כדי לא לטעון את מודולי הראייה.
- **Qwen3-VL ב־vLLM** — מתוך ה־README — [Qwen3-VL README](https://github.com/QwenLM/Qwen3-VL):
  - דורש vLLM 0.11.0 ומעלה.
  - ‏`min_pixels`, ‏`max_pixels` ו־`total_pixels` שולטים בתקציב לכל פריים ולכל סרטון.
- **Nemotron 3.5 Parse** — [כרטיס](https://huggingface.co/nvidia/Nemotron-3.5-Parse):
  - רץ ב־vLLM עם `--speculative-config '{"method":"dflash",…,"num_speculative_tokens":32}'`.
  - במצב שני מעברים, אזורי טבלה וגרף נחתכים ומפוענחים שוב ברזולוציה גבוהה.
- **LMDeploy** — [LMDeploy supported models](https://github.com/InternLM/lmdeploy/blob/main/docs/en/supported_models/supported_models.md):
  - "TurboMind does not currently support the vision encoder for the Qwen3.5 series".
  - מנוע PyTorch תומך ב־Qwen3-VL ‏2B–235B וב־Qwen3.5 ‏0.8B–397B.
- **SGLang**:
  - הוא דרך ההגשה של Keye-VL-2.0 (ענף `keye-vl-v2-30b-release`) — [כרטיס Keye](https://huggingface.co/Kwai-Keye/Keye-VL-2.0-30B-A3B).
  - כרטיס Qwen3.5 מביא פקודת `sglang.launch_server` עם `--context-length 262144` ו־`--reasoning-parser qwen3` — [כרטיס Qwen3.5-9B](https://huggingface.co/Qwen/Qwen3.5-9B).
  - ‏MiniCPM-V 4.6 מתעד SGLang — [כרטיס](https://huggingface.co/openbmb/MiniCPM-V-4.6).
- **הרחבת תקציב הווידאו של Qwen3.5** דרך פרמטרים של המנוע מתועדת ב־PR של vLLM (#34330) ושל SGLang (#18467) — [כרטיס Qwen3.5-9B](https://huggingface.co/Qwen/Qwen3.5-9B).
- **llama.cpp**:
  - שרת תואם OpenAI עם תמונה, אודיו ווידאו.
  - מודלי OCR דורשים פרומפט ייעודי.
  - ב־ggml-org יש לצד המודל קובצי `dflash-*.gguf` (‏Qwen3.6-35B-A3B, ‏gemma-4-26B-A4B) ו־`mtp-*.gguf` (‏gemma-4-E2B/E4B) — [docs/multimodal.md](https://github.com/ggml-org/llama.cpp/blob/master/docs/multimodal.md); [ggml-org/Qwen3.6-35B-A3B-GGUF](https://huggingface.co/ggml-org/Qwen3.6-35B-A3B-GGUF); [ggml-org/gemma-4-E2B-it-GGUF](https://huggingface.co/ggml-org/gemma-4-E2B-it-GGUF).
- **Ollama qwen3-vl**: קלט טקסט ותמונה בלבד — [ollama](https://ollama.com/library/qwen3-vl).
- **TGI**: במצב תחזוקה — [TGI](https://github.com/huggingface/text-generation-inference).
- **פלט מהיר במודל זעיר**: LFM2.5-VL-3B על H100 עם vLLM מגיע ל־"about 11K tokens per second at high concurrency", ו־"about 34 ms" לטוקן ראשון על קטע של 5 פריימים — [כרטיס LFM2.5-VL-3B](https://huggingface.co/LiquidAI/LFM2.5-VL-3B).

### היסקים (Inferences)
- **טיפים לתפוקה**:
  - לשלוח את 100 הפריימים כבקשות מקבילות. vLLM מאגד אותן לאצווה — מהיר בהרבה מבקשה אחת עם 100 תמונות, ושומר על חותמת זמן נפרדת לכל פריים.
  - לכבות חשיבה.
  - להגביל `max_tokens` ולבקש פלט JSON קצר.
  - לקבע `max_pixels` לפי מטרה: ‏720p לשקפים, נמוך יותר למיון.
  - להשתמש בפענוח ספקולטיבי כשיש (DFlash, ‏MTP, ‏DSpark).
  - ב־Nemotron Parse — מעבר אחד למהירות, שני מעברים לשקפים עם טבלאות וגרפים.
- **פער בין קדם־עיבוד vLLM לרשמי**: כדאי לבנות את המבחן שלנו באותו מנוע שבו נריץ בייצור.

### פערים (Gaps)
- **תיעוד SGLang** — דף המודלים המולטימודליים מחזיר 404, כך שהתמיכה מתועדת רק דרך הכרטיסים.
- **אין השוואת תפוקה פומבית** בין vLLM ל־SGLang למודלי ראייה עם הרבה תמונות.

## 8. הטמעות ו־rerankers לחיפוש סמנטי בעברית ובאנגלית (תמלולים ושקפים)

### שורה תחתונה (Takeaway)
**חיפוש בתמלולים (טקסט)** — ניתוח שלי של תוצאות MTEB הגולמיות, ‏BelebeleRetrieval בעברית:

| מודל | ציון עברית–עברית | רישיון | הערה |
|---|---|---|---|
| geevec-embeddings-1.0 | 97.17 | Apache | 8B |
| Qwen3-Embedding-8B | 96.86 | Apache | |
| multilingual-e5-large | 92.54 | MIT | 0.56B, רץ טוב על CPU |
| Qwen3-Embedding-4B | 91.94 | Apache | |
| bge-m3 | 91.11 | MIT | צפוף, דליל ו־multi-vector |

- **Reranker מומלץ**: Qwen3-Reranker-0.6B או 4B (‏Apache). bge-reranker-v2-m3 חלש יותר לפי Qwen.

**חיפוש בשקפים לפי טקסט בעברית** (טקסט→תמונה, ‏XM3600 בעברית):

| מודל | ציון | רישיון | הערה |
|---|---|---|---|
| e5-omni-7B | 77.74 | MIT | |
| DNA-VL-STEER-2B | 75.27 | Apache | כויל במפורש גם לעברית |
| EmbeddingGemma 2 | 67.42 | Apache | |
| siglip-base-patch16-256-multilingual | 66.72 | Apache | 0.37B, מ־2024 |

- **מודלי CLIP באנגלית בלבד נכשלים לגמרי בעברית** (≈0.3).
- **מודלי Jina הם CC-BY-NC.** ‏ColQwen2.5 נשען על רישיון Qwen Research ואומן באנגלית.

### ממצאים מתועדים (Cited Findings)

#### עברית ב־MTEB — ניתוח מקורי של קובצי התוצאות (CC0)
מקור הנתונים לכל השורות בתת־סעיף הזה: [mteb/results](https://huggingface.co/datasets/mteb/results). שלפתי את קובצי ה־parquet ב־9/11/2026 וסיננתי את השורות בעברית.

- **BelebeleRetrieval** (‏194 מודלים; nDCG@10, הציון הראשי של המשימה, מוכפל ב־100). כיוון העמודות לפי קוד המשימה: בתת־קבוצה "X-Y" המסמכים בשפה X והשאילתות בשפה Y — [קוד המשימה ב־MTEB](https://github.com/embeddings-benchmark/mteb/blob/main/mteb/tasks/retrieval/multilingual/belebele_retrieval.py). לכן:
  - **he→he**: שאילתה ומסמך בעברית.
  - **en→he**: שאילתה באנגלית, מסמך בעברית (תת־הקבוצה `heb_Hebr-eng_Latn`).
  - **he→en**: שאילתה בעברית, מסמך באנגלית (`eng_Latn-heb_Hebr`) — המקרה של שאילתה עברית מול שקף באנגלית.

| מודל | he→he | en→he | he→en |
|---|---|---|---|
| geevec-embeddings-1.0 | 97.17 | 98.54 | 95.15 |
| Qwen3-Embedding-8B | 96.86 | 98.78 | 95.98 |
| gemini-embedding-001 (API) | 95.76 | 96.37 | 94.28 |
| harrier-oss-v1-27b | 94.97 | 95.79 | 92.54 |
| llama-embed-nemotron-8b (NSCL) | 94.85 | 96.75 | 93.61 |
| multilingual-e5-large | 92.54 | 92.04 | 83.82 |
| Qwen3-Embedding-4B | 91.94 | 95.27 | 87.19 |
| multilingual-e5-large-instruct | 91.54 | 91.91 | 82.21 |
| bge-m3 | 91.11 | 89.39 | 85.89 |
| mSlideOn (דליל) | 90.90 | 85.99 | 73.07 |
| nomic-embed-text-v2-moe | 90.36 | 84.29 | 74.75 |
| snowflake-arctic-embed-l-v2.0 | 89.76 | 86.64 | 82.16 |
| jina-embeddings-v5-text-small (NC) | 89.44 | 93.26 | 85.35 |
| jina-embeddings-v3 (NC) | 88.84 | 89.77 | 81.95 |
| multilingual-e5-small | 85.91 | 76.44 | 63.26 |
| harrier-oss-v1-0.6b | 84.21 | 89.58 | 72.58 |
| F2LLM-v2-0.6B | 83.23 | 87.77 | 76.72 |
| Qwen3-Embedding-0.6B | 82.31 | 84.04 | 67.74 |
| granite-embedding-311m-multilingual-r2 | 81.08 | 79.06 | 58.09 |
| text-embedding-3-large (API) | 79.84 | 91.16 | 70.02 |
| embeddinggemma-2 | 79.72 | 85.12 | 75.24 |
| embeddinggemma-300m | 73.96 | 84.45 | 62.43 |
| LaBSE | 68.87 | 73.71 | 63.00 |

- **XM3600T2IRetrieval בעברית** (טקסט עברי → תמונה):

| מודל | ציון |
|---|---|
| e5-omni-7B | 77.74 |
| DNA-VL-STEER-2B | 75.27 |
| e5-v | 69.73 |
| OmniEmbed-v0.1 | 67.86 |
| embeddinggemma-2 | 67.42 |
| siglip-base-patch16-256-multilingual | 66.72 |
| LCO-Embedding-Omni-7B | 65.15 |
| jina-embeddings-v5-omni-small | 52.37 |
| bge-visualized-m3 | 41.54 |
| siglip-large-patch16-384 | 31.82 |
| siglip-so400m-patch14-384 (SigLIP 1) | 4.09 |

  - **נכשלים** (‏0.1–0.4): כל מודלי CLIP של OpenAI ו־LAION, ‏EVA02-CLIP, ‏nomic-embed-vision-v1.5 ו־BLIP. גם SigLIP-base באנגלית (גרסאות 2024) מקבל רק 12.8–13.5.
- **WebFAQRetrieval בעברית**: ‏jina-embeddings-v3 ‏86.80; ‏F2LLM-v2-0.6B ‏85.85; ‏multilingual-e5-large ‏84.29; ‏multilingual-e5-large-instruct ‏83.58; ‏multilingual-e5-small ‏74.74; ‏gte-multilingual-base ‏66.08.
- **חסרים בתוצאות העבריות**: SigLIP 2, ‏jina-clip-v2, ‏jina-embeddings-v4, ‏Qwen3-VL-Embedding ו־Nemotron-3.5-Embed.

#### כרטיסי המודלים
- **EmbeddingGemma 2** (‏Apache-2.0, ‏0.74B, נוצר 14/9/2026) — [כרטיס](https://huggingface.co/google/embeddinggemma-2):
  - מבנה: ‏270M לטקסט (‏130M טרנספורמר + ‏140M טבלת הטמעה), מקודד חזותי של 170M ומקודד אודיו של 300M. אפשר לטעון רק את מה שצריך — טקסט בלבד הוא 270M.
  - מרחב אחד של 768 ממדים לטקסט, תמונה, וידאו ואודיו. מעל 100 שפות. הקשר 8K. ‏MRL ל־128/256/512.
  - ציונים: MTEB רב־לשוני v2 ‏61.36; ‏MMEB v2 VisDoc ‏67.84; וידאו ‏50.67.
- **DNA-VL-STEER-2B** (‏Apache-2.0, ‏2.13B, נוצר 15/7/2026) — [כרטיס](https://huggingface.co/dnotitia/DNA-VL-STEER-2B); [HF API](https://huggingface.co/api/models/dnotitia/DNA-VL-STEER-2B):
  - גרסה מכוילת של Qwen3-VL-Embedding-2B, עם אותו מרחב של 2048 ממדים לתמונה, טקסט, וידאו וצילום מסך.
  - כוילה על 36 השפות של XM3600, ו־`he` ברשימה. ב־XM3600, טקסט→תמונה עולה מ־48.7 ל־59.5 בממוצע.
  - **מלכודת**: ב־`transformers` ‏4.57.x ומטה "zero keys match and the model is randomly initialized" — רק אזהרה, בלי שגיאה. זה נכון גם למודל הבסיס.
- **e5-omni-7B** (‏MIT, ‏8.93B, מבוסס Qwen2.5-Omni-7B, נוצר 6/1/2026) — [HF API](https://huggingface.co/api/models/Haon-Chen/e5-omni-7B).
- **geevec-embeddings-1.0** (‏Apache-2.0, נוצר 31/3/2026): ‏"8B activated parameters", ארכיטקטורת PseudoMoE על מודל בסיס במבנה Qwen3 (קובץ המודל: `modeling_qwen3_pseudo_moe.py`), ממד 4096, הקשר 32,768. דורש `trust_remote_code` (קובצי מודל מותאמים) — [כרטיס](https://huggingface.co/geevec-ai/geevec-embeddings-1.0).
- **Qwen3-VL-Embedding 2B/8B** (‏Apache-2.0, נוצרו 7/1/2026): ‏MMEB-V2 ‏73.2/77.8; ‏MMTEB ‏63.87/67.88; מעל 30 שפות; הקשר 32K; ממדים 64–2048. יש גם Qwen3-VL-Reranker 2B/8B — [כרטיס Qwen3-VL-Embedding-2B](https://huggingface.co/Qwen/Qwen3-VL-Embedding-2B); [כרטיס Qwen3-VL-Reranker-2B](https://huggingface.co/Qwen/Qwen3-VL-Reranker-2B).
- **Qwen3-Embedding 0.6B/4B/8B** (‏Apache-2.0, נוצרו 3/6/2025): ‏MMTEB ‏64.33/69.45/70.58; ממדים 1024/2560/4096; מעל 100 שפות; הקשר 32K; תומכים בהוראות — [כרטיס Qwen3-Embedding-0.6B](https://huggingface.co/Qwen/Qwen3-Embedding-0.6B).
- **Rerankers** (‏MMTEB-R על 100 התוצאות הראשונות של Qwen3-Embedding-0.6B, שמקבל לבדו 64.64) — [כרטיס Qwen3-Reranker-0.6B](https://huggingface.co/Qwen/Qwen3-Reranker-0.6B):

| מודל | MMTEB-R |
|---|---|
| Qwen3-Reranker-0.6B | 66.36 |
| Qwen3-Reranker-4B | 72.74 |
| Qwen3-Reranker-8B | 72.94 |
| Jina-multilingual-reranker-v2-base | 63.73 |
| gte-multilingual-reranker-base | 59.44 |
| BGE-reranker-v2-m3 | 58.36 — מתחת לבסיס בלי reranker |

- **bge-m3** (‏MIT): צפוף, multi-vector ודליל במודל אחד; מעל 100 שפות; עד 8192 טוקנים — [כרטיס](https://huggingface.co/BAAI/bge-m3). ‏bge-reranker-v2-m3 ב־Apache-2.0 — [כרטיס](https://huggingface.co/BAAI/bge-reranker-v2-m3).
- **multilingual-e5-large** (‏MIT, ‏0.56B): ‏24 שכבות, ממד 1024, קידומות "query: "/"passage: ", חיתוך ב־512 טוקנים — [כרטיס](https://huggingface.co/intfloat/multilingual-e5-large). ב־HF יש לו תגיות `onnx` ו־`openvino` — [HF API](https://huggingface.co/api/models/intfloat/multilingual-e5-large).
- **harrier-oss-v1** (‏MIT, נוצר 30/3/2026): ‏MTEB v2 ‏66.5 (‏270m), ‏69.0 (‏0.6b), ‏74.3 (‏27b); הקשר 32,768; עברית ברשימת השפות — [כרטיס harrier-oss-v1-0.6b](https://huggingface.co/microsoft/harrier-oss-v1-0.6b).
- **granite-embedding-311m-multilingual-r2** (‏Apache-2.0, נוצר 20/4/2026): ‏ModernBERT במקום XLM-RoBERTa; הקשר 32,768; ממד 768; "Released with ONNX and OpenVINO models; compatible with vLLM and llama.cpp (GGUF)" — [כרטיס](https://huggingface.co/ibm-granite/granite-embedding-311m-multilingual-r2).
- **mSlideOn** (‏Apache-2.0, ‏0.34B, נוצר 13/10/2026): מודל אחזור דליל (sparse retrieval). עברית לא בין שפות אימון האחזור (אנגלית, צרפתית, גרמנית, איטלקית, ספרדית, פורטוגזית, שוודית, נורווגית, ערבית וקוד), ובכל זאת הציון ב־Belebele עברית–עברית הוא 90.90 (למעלה) — [כרטיס](https://huggingface.co/lightonai/mSlideOn).
- **Nemotron-3.5-Embed-1B** (‏OpenMDW-1.1, ‏1.55B, נוצר 7/10/2026): מטמיע עמוד כתמונה, כטקסט או כשניהם; עברית לא בין 34 תגיות השפה שלו ב־HF — [כרטיס](https://huggingface.co/nvidia/Nemotron-3.5-Embed-1B-BF16). ‏Nemotron-3.5-Rerank-8B — [כרטיס](https://huggingface.co/nvidia/Nemotron-3.5-Rerank-8B-BF16).
- **SigLIP 2** (‏Apache-2.0, נוצר 17/2/2025): המאמר נקרא "SigLIP 2: Multilingual Vision-Language Encoders…" — [כרטיס siglip2-so400m-patch14-384](https://huggingface.co/google/siglip2-so400m-patch14-384).
- **TIPSv2** (‏Apache-2.0, נוצר 9/4/2026): תכונות מרחביות לכל טלאי, 412M לראייה ו־448M לטקסט — [כרטיס](https://huggingface.co/google/tipsv2-so400m14).
- **EVIE-4.5B** (‏Apache-2.0, נוצר 4/9/2026): אחזור מסמכים חזותי — [HF API](https://huggingface.co/api/models/tencent/EVIE-4.5B).
- **להימנע במוצר מסחרי:**
  - jina-clip-v2: ‏CC-BY-NC-4.0, ‏89 שפות — [כרטיס](https://huggingface.co/jinaai/jina-clip-v2).
  - jina-embeddings-v3 ו־v5, ומודלי jina-reranker: ‏CC-BY-NC — [HF API](https://huggingface.co/api/models?author=jinaai).
  - llama-embed-nemotron-8b: ‏NSCL.
  - ColQwen2.5: עמוד השדרה ברישיון Qwen Research, אימון באנגלית בלבד — [כרטיס](https://huggingface.co/vidore/colqwen2.5-v0.2).
- **מחירי API להטמעות**:
  - DeepInfra: ‏bge-m3 ו־multilingual-e5-large ב־$0.01 ל־1M טוקנים — [DeepInfra](https://deepinfra.com/pricing).
  - Fireworks: ‏$0.008–0.016 ל־1M, ו־Qwen3 8B ב־$0.10 — [Fireworks](https://fireworks.ai/pricing).

### היסקים (Inferences)
- **ההמלצה לטקסט על ה־CX53**:
  - **ראשית**: multilingual-e5-large (‏MIT, ‏0.56B, יש ONNX/OpenVINO) או bge-m3 (‏MIT). שניהם ~91–92.5 בעברית–עברית.
  - **שאילתה בעברית מול טקסט באנגלית** (he→en, למשל שקפים באנגלית): bge-m3 ‏85.89 עדיף על multilingual-e5-large ‏83.82. ‏Qwen3-Embedding-4B מקבל 87.19; ‏Qwen3-Embedding-8B ‏95.98 ו־geevec ‏95.15 — קפיצה של כ־10 נקודות.
  - **חשבון זמן**: הרצאה של שעה ≈ ‏7,600 מילים, לפי כ־2,800 מילים ל־22 דקות ([studio-learning.md](../../studio-learning.md)). זה ≈ ‏11–15 אלף טוקנים (הנחה של 1.5–2 טוקנים למילה), כלומר ≈ ‏25–35 קטעים של 512 טוקנים עם חפיפה. בערך 0.6 TFLOP לקטע, כלומר פחות מדקה עד דקה מעבד להרצאה (הערכה).
  - **בדרך כלל עדיף bge-m3**: הוא חזק יותר בכיוון he→en, ומוסיף ייצוג דליל לחיפוש מונחים מדויק (שמות, קוד) בלי מודל נוסף.
- **שדרוג איכות**: Qwen3-Embedding-4B או 8B (‏Apache) — ‏91.9 עד 96.9 בעברית. דרך GPU, או דרך API בכ־$0.10 ל־1M ב־Fireworks לגרסת 8B.
- **Reranker**: Qwen3-Reranker-0.6B על CPU ל־20–50 מועמדים בשאילתה.
- **שקפים — שני ערוצים:**
  1. הטקסט שחולץ (OCR/VLM) נכנס לאותו אינדקס טקסט כמו התמלול — הערוץ החזק, כי שאילתה עברית פוגשת טקסט עברי.
  2. הטמעת תמונה לשאילתות חזותיות ("השקף עם הגרף הכחול"):
     - על CPU: siglip-base-patch16-256-multilingual (‏0.37B) או EmbeddingGemma 2 (‏270M+170M).
     - באיכות גבוהה יותר: DNA-VL-STEER-2B (‏2.13B, ‏Apache) — עדיף על GPU או לאינדוקס בזמן פנוי.
- **לא להשתמש** במודלי CLIP באנגלית בלבד (‏SigLIP 1 so400m קיבל 4.09!) או במודלי Jina (רישיון).

### פערים (Gaps)
- **חסרים בתוצאות העבריות**: SigLIP 2, ‏jina-v4, ‏Qwen3-VL-Embedding ו־Nemotron-3.5-Embed לא הוערכו בעברית ב־MTEB.
- **XM3600 הוא תמונות כלליות, לא שקפים** — אין מבחן אחזור שקפים בעברית.
- **Belebele בנוי על קטעי FLORES** (טקסט כתוב וערוך), לא על תמלול דיבור עם שגיאות ASR — [קוד המשימה ב־MTEB](https://github.com/embeddings-benchmark/mteb/blob/main/mteb/tasks/retrieval/multilingual/belebele_retrieval.py). הדירוג על תמלולי הרצאות אמיתיים עשוי להיות שונה.
- **מספר שלב ה־reranker בעברית** לא נמדד (‏MMTEB-R הוא ממוצע רב־לשוני).
- **זמני הטמעה על ה־CX53 לא נמדדו** — הערכה בלבד.
- **מספר הפרמטרים של geevec** לא מופיע ב־HF API. הכרטיס אומר "8B activated".
