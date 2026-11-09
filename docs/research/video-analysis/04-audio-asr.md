# ניתוח הרצאות — צד השמע: ASR (עברית/אנגלית/עירוב), דיאריזציה ושמות דוברים, יישור מילים, VAD, הטיה הקשרית, אירועי שמע, פרוזודיה ו־Audio-LLMs (מצב 9/11/2026)

> **שיטה ומגבלות.** מחקר ב־9/11/2026. מקורות ראשוניים ככל האפשר (כרטיסי מודל, דפי מחיר רשמיים, ממשקי מחיר רשמיים של AWS/Azure, נתוני הגולמי של לוח התוצאות העברי של ivrit.ai, מאמרי arXiv). מכסת החיפוש ברשת (משותפת לכל הסוכנים) נגמרה באמצע המחקר — מאותה נקודה עבדתי רק בהבאה ישירה של עמודים ידועים, ולכן כמה נושאים (מחקר "הדגשה" בהרצאות, איכות כתוביות אוטומטיות ביוטיוב במספרים, שמות דוברים אוטומטיים) חלקיים ומסומנים כפער. נוסף על כך הרצתי **ניסוי CPU קטן בסשן** (סעיפים 1–3): ivrit-ai turbo ו־zipformer עברי על 5 דקות FLEURS עבריות, על 4 vCPU. WER באחוזים (נמוך = טוב). מחירים ב־USD/EUR כפי שהופיעו בדפים ב־9/11/2026, אלא אם צוין אחרת.

## 1. המטרה: מה איכות התמלול הטובה ביותר שאפשר להשיג להרצאות ארוכות (אנגלית, עברית, עירוב), מה רץ טוב על ה־CPU שלנו, ואיזה שירות בתשלום עדיף ובכמה

### Takeaway
בעברית — המודלים הפתוחים של ivrit.ai (whisper-large-v3 / turbo, גרסת 20250513) **שווים או טובים** מכל שירות מסחרי שנמדד בלוח העברי (ממוצע 8.8–9.1 מול 9.9 של Soniox, הטוב במסחריים), ולכן לעברית אין סיבת דיוק לשלם; הסיכון האמיתי הוא **השמטת משפטים בתמלול ארוך** (נמדד בניסוי שלנו) — צריך בדיקת כיסוי במנוע שני זול (zipformer עברי, ‏RTF‏ 0.087 על 4 vCPU). באנגלית — Parakeet TDT על CPU טוב מאוד (‏~6% ממוצע; long-form 6.9%), אך שירותים מסחריים מנצחים אותו בבירור (Scribe v1 long-form 4.33%), במחיר 0.10–0.30$ לשעה; המודל הפתוח המוביל (Nemotron 3.5 Transcribe, 28/10/2026) דורש GPU.

### Cited Findings
- **עברית, לוח ivrit.ai (עדכון אחרון של ה־Space ב־14/10/2026; הרצות מ־12/2024 עד 10/2026)** — ממוצע 5 סטים (eval-d1 פודקאסט ארוך, WhatsApp, ‏SASpeech, ‏FLEURS, ‏Kan): ivrit-ai/whisper-large-v3-ct2-20250513 ‏= 8.8; ivrit-ai/whisper-large-v3-turbo-ct2-20250513 ‏= 9.1; ‏Soniox (הרצה 3/5/2026) ‏= 9.9; ‏zipformer2-66m (sherpa-onnx int8, ‏14/10/2026) ‏= 11.1; ‏Amazon Transcribe batch ‏= 11.5; ‏Deepgram nova-3 (3/5/2026) ‏= 14.6; ‏whisper-large-v3 המקורי ‏= 14.4; ‏gpt-4o-transcribe (22/3/2025) ‏= 18.2; ‏Google speech (ישן) ‏= 28.6 — חישוב שלי מתוך [benchmark.csv של הלוח](https://huggingface.co/spaces/ivrit-ai/hebrew-transcription-leaderboard) ו[היסטוריית ה־commits שלו](https://huggingface.co/api/spaces/ivrit-ai/hebrew-transcription-leaderboard/commits/main).
- **אנגלית, Open ASR Leaderboard (תמונת מצב 28/10/2026, מקור משני)**: ‏NVIDIA Nemotron 3.5 Transcribe 30B-A4B ממוצע 5.33% (RTFx 462), ‏Qwen3-ASR-1.7B ‏5.40% (RTFx 819), ‏Granite Speech 5.0 2B ‏5.68%, ‏Cohere Transcribe (03-2026) ‏5.77%, ‏Canary-Qwen 2.5B ‏5.94%, ‏Parakeet TDT 0.6B ‏5.98–6.18%, ‏Whisper large-v3 ‏7.16% — [apidog, 29/10/2026](https://apidog.com/blog/best-open-source-speech-to-text-models/).
- **Long-form אנגלית (מאמר הלוח, 8/10/2025)**: ElevenLabs Scribe v1 ‏4.33%, ‏RevAI Fusion ‏5.04%, ‏Speechmatics Enhanced ‏5.08%, ‏Whisper large-v3 ‏6.43%, ‏Kyutai STT 2.6B ‏6.64%, ‏Parakeet CTC 1.1B ‏6.68%, ‏Parakeet TDT 0.6B v2 ‏6.91% — [arXiv 2510.06961](https://arxiv.org/html/2510.06961v1).
- **המודל הפתוח המוביל דורש GPU**: Nemotron 3.5 Transcribe (שוחרר 28/10/2026, רישיון OpenMDW-1.1) — "1× H100 80 GB" לפריסה, הקשר 65,536 טוקנים והקלטות עד שעה; עברית ברמת "Supported" (ASR, תרגום, code-switching — כן; ריבוי דוברים — לא) ו־WER ‏20.97 ב־FLEURS עברית — [כרטיס המודל](https://huggingface.co/nvidia/NVIDIA-Nemotron-3.5-Transcribe-30B-A4B).
- **מחירי שירותים עם עברית (9/11/2026)**: Soniox async ‏0.10$/שעה ([מחירון](https://soniox.com/pricing)); ‏MAI-Transcribe-2 ‏0.10$/שעה כמבצע ([כרטיס המודל](https://microsoft.ai/pdf/MAI-Transcribe-2-Model-Card.pdf)); ‏Azure Batch ‏0.18$/שעה ו־Fast ‏0.36$/שעה ([Azure Retail Prices API](https://prices.azure.com/api/retail/prices)); ‏ElevenLabs Scribe v2 ‏0.22$/שעה ([מחירון](https://elevenlabs.io/pricing/api)); ‏Deepgram Nova-3 multilingual ‏0.0052$/דקה = ‏0.312$/שעה ([מחירון](https://deepgram.com/pricing)); ‏AWS Transcribe ‏0.0001$/שנייה = ‏0.36$/שעה ([AWS Price List, פורסם 11/9/2026](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/transcribe/current/us-east-1/index.json)).
- **ניסוי שלנו (9/11/2026, ‏4 vCPU Intel Xeon 2.1GHz עם AVX-512, ‏15GB)**: 36 משפטי [FLEURS he_il dev](https://huggingface.co/datasets/google/fleurs) מחוברים לקובץ אחד של 303.7 שנ׳ (רווח 0.4 שנ׳). [ivrit-ai/whisper-large-v3-turbo-ct2](https://huggingface.co/ivrit-ai/whisper-large-v3-turbo-ct2) ב־faster-whisper ‏int8, ‏beam 5: **כל משפט לחוד — WER ‏17.3%** (תואם ל־18.1 של הלוח); **הקובץ הארוך ברצף — WER ‏48.6–49.2%, נשמטו משפטים שלמים** (חורים של 6–15 שנ׳ בציר הזמן; 350–358 מילים מתוך 543); ‏batched (8) — ‏43.5–47.5%; פיצול ב־Silero VAD (עד 20 שנ׳) ופענוח כל קטע לחוד — 37.0%. [zipformer2-66m-streaming-he](https://huggingface.co/ivrit-ai/zipformer2-66m-streaming-he) ‏int8 על אותו קובץ: **WER ‏27.8% בלי השמטות, RTF ‏0.087, זיכרון שיא 238MB**, ומוציא פיסוק. מהירות turbo: רציף RTF ‏0.45–0.55 (שיא 2.1GB), ‏batched RTF ‏0.19–0.35 (שיא 3.7GB).
- **בשרת שלנו היום**: אנגלית = Parakeet TDT 0.6B v2 דרך onnx-asr ‏int8 עם חיתוך Silero עד 40 שנ׳; עברית — רק בשרשרת הקריוקי (ivrit turbo ct2 + stable-ts + CTC עברי); "הרצאה עברית של שעה — לא נמדדה" — [00-internal-infrastructure.md](00-internal-infrastructure.md); ‏Parakeet בטלפון (SM8850) על הרצאה של 23 דק׳: ‏RTF ‏0.065, ותוצאה זהה לשרת "כולל טעויות השמות שההגהה מתקנת" — `יומן-עבודה.md` (24/10/2026).

### Inferences
- **השרשרת המומלצת לשרת (CPU בלבד):** (1) עברית — ivrit turbo (או large-v3 כשהזמן מאפשר; ‏+0.3 נק׳ ממוצע) **בפילוח של משפט/קטע קצר**, לא ברצף ארוך; (2) zipformer עברי כ"מנוע שני" זול לבדיקת כיסוי — כל דקה שבה למנוע הראשי יש הרבה פחות מילים מאשר ל־zipformer = חשד להשמטה → פענוח חוזר של הקטע; (3) אנגלית — Parakeet נשאר; לבדוק מול Granite Speech 5.0 470M TurboCTC (Apache-2.0, ‏5.51% ממוצע אנגלית, CTC מהיר) כחלופה בלי חובת ייחוס; (4) הטיה הקשרית ממונחי השקופיות (סעיף 7); (5) דיאריזציה ויישור (סעיפים 5–6); (6) מעבר הגהה ב־Claude שממזג שתי השערות ומתקן שמות (כבר קיים בעובד כ"הגהה").
- **מתי לשלם:** לאנגלית — שירות מסחרי מוריד בערך שליש מהשגיאות ב־long-form (4.33% מול 6.91%), בעלות של 0.10–0.30$ לשעה; לסטודיו עם עשרות שעות בחודש זה דולרים בודדים. לעברית — אין רווח דיוק מוכח; שירות בתשלום מצדיק את עצמו רק בתוספות (דיאריזציה, תגי אירועים, מילות מפתח) או כגיבוי.
- **בחירה זולה ל־A/B אם המשתמש מאשר תשלום**: Soniox (‏0.10$/שעה, הטוב בעברית בלוח, דיאריזציה כלולה) ו־MAI-Transcribe-2 (‏0.10$/שעה עד סוף 2026, עברית ברשימת השפות, בלי מספרי WER עבריים).

### Gaps
- אין מדידה ציבורית על **הרצאות** עבריות ארוכות (הלוח העברי: פודקאסט, WhatsApp, קריאה, חדשות). צריך סט בדיקה פנימי של 30–60 דק׳ הרצאות מתומללות ידנית (כולל עירוב אנגלית).
- הניסוי שלנו על 4 vCPU של סביבת הסשן, לא על CX53 (16 vCPU משותפים); היחס לא ליניארי ולא נמדד.
- ההשמטות בניסוי נמדדו על FLEURS מחובר (קריאה עם שקטים), לא על הרצאה טבעית; בלוח העברי, על eval-d1 (פודקאסט בחלקים של 5 דק׳), אותו מודל קיבל 5.3% — כלומר הבעיה תלויה בשקטים, והיקפה בהרצאות אמיתיות לא ידוע.

## 2. ASR פתוח — מצב האמנות (נובמבר 2026): Open ASR Leaderboard, long-form, הזיות על שקט/מוזיקה, ומהירות על CPU

### Takeaway
בצמרת הלוח האנגלי ב־11/2026 נמצאים מודלי LLM-ASR גדולים (Nemotron 3.5 Transcribe, ‏Qwen3-ASR-1.7B, ‏Granite 5.0 2B) — מדויקים אך כבדים ל־CPU; מודלי CTC/TDT קטנים (Parakeet 0.6B, ‏Granite 5.0 470M TurboCTC) מפסידים נקודה אחת לכל היותר ורצים פי עשרות מהר יותר — זה מה שמתאים לשרת בלי GPU. אף אחד מהמודלים הפתוחים המובילים החדשים (Qwen3-ASR, ‏Granite, ‏Voxtral, ‏Phi-4-MM, ‏VibeVoice, ‏Moonshine, ‏Parakeet v3, ‏Canary v2) **לא תומך בעברית**; היחידים עם עברית: Whisper ונגזרותיו, Omnilingual ASR של Meta, ו־Nemotron 3.5 (ברמת "Supported"/"adaptation-ready").

### Cited Findings
- **סדר הצמרת (28/10/2026)**: Nemotron 3.5 Transcribe ‏5.33% (RTFx 462; ‏long-form ‏10.98% מול 13.37% של Parakeet-TDT-0.6B-v3), ‏Qwen3-ASR-1.7B ‏5.40%, ‏Granite Speech 5.0 2B ‏5.68%, ‏Cohere Transcribe ‏5.77%, ‏TheStage Whisper large-v3 turbo ‏5.91% (RTFx 1,177), ‏Canary-Qwen 2.5B ‏5.94%, ‏Parakeet TDT 0.6B ‏5.98–6.18%, ‏Voxtral Small 24B ‏6.38%, ‏Whisper large-v3 ‏7.16% — [apidog](https://apidog.com/blog/best-open-source-speech-to-text-models/); בתמונת מצב קודמת (6/5/2026) מקום ראשון Granite Speech 4.1 2B ב־5.33% — [benchmarklist (משני)](https://benchmarklist.com/benchmarks/open_asr_leaderboard/).
- **סתירה**: כרטיס Nemotron מדווח ממוצע 4.71% על 9 הסטים הציבוריים (נמדד 12/10/2026) מול 4.94% ל־Qwen3-ASR-1.7B — [כרטיס Nemotron](https://huggingface.co/nvidia/NVIDIA-Nemotron-3.5-Transcribe-30B-A4B); הלוח עצמו מציג 5.33% — כנראה הרכב סטים/נרמול שונה.
- **Nemotron 3.5 Transcribe (28/10/2026)**: Mamba-2–Transformer MoE, ‏~4.3B פרמטרים פעילים; 40 שפות; תמלול עם הקשר, תמלול עם דוברים, חותמות זמן למילים (ראש CTC), תשובות על השמע (רק באנגלית); "This is an offline model"; ‏RTFx ‏260–410 על H100 — [כרטיס](https://huggingface.co/nvidia/NVIDIA-Nemotron-3.5-Transcribe-30B-A4B).
- **Qwen3-ASR-1.7B** (דוח טכני 29/1/2026, ‏Apache-2.0): 30 שפות + 22 דיאלקטים סיניים, **בלי עברית**; LibriSpeech ‏1.63/3.38, ‏TED-LIUM ‏4.50 — [כרטיס](https://huggingface.co/Qwen/Qwen3-ASR-1.7B).
- **Granite Speech 5.0** (IBM): ‏2B שוחרר 20/10/2026, ‏Apache-2.0, שש שפות (en/fr/de/es/pt/ja), ממליצים על קטעים של עד ~2 דק׳ — [כרטיס 2B](https://huggingface.co/ibm-granite/granite-speech-5.0-2b); ‏470M TurboCTC (21/10/2026, ‏Apache-2.0): שבע שפות (כולל איטלקית), פיסוק מובנה, ממוצע אנגלית 5.51% (לא רשמי), ‏GGUF ל־CPU — [כרטיס 470M](https://huggingface.co/ibm-granite/granite-speech-5.0-470m-turboctc).
- **Parakeet TDT 0.6B v3** (14/8/2025, ‏CC-BY-4.0): 25 שפות אירופיות, בלי עברית; עד 24 דק׳ ב־full attention (A100) או 3 שעות ב־local attention; חותמות זמן למילה/קטע; ‏Open ASR ‏6.34% — [כרטיס](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3).
- **Omnilingual ASR (Meta, ‏10/11/2025, ‏Apache-2.0)**: יותר מ־1,600 שפות, ‏CER<10 ב־78% מהן — [בלוג Meta](https://ai.meta.com/blog/omnilingual-asr-advancing-automatic-speech-recognition/); **עברית (heb_Hebr): ‏CER ‏6.7 עם 155.5 שעות אימון** במודל 7B LLM-ASR — [טבלת התוצאות לפי שפה](https://raw.githubusercontent.com/facebookresearch/omnilingual-asr/main/per_language_results_table_7B_llm_asr.csv); מגבלה: "only audio files shorter than 40 seconds" במודלי CTC/LLM (יש גרסאות "Unlimited") — [GitHub](https://github.com/facebookresearch/omnilingual-asr).
- **בלי עברית**: Phi-4-multimodal — 8 שפות שמע, ‏MIT, אורך מומלץ 40 שנ׳ ל־ASR — [כרטיס](https://huggingface.co/microsoft/Phi-4-multimodal-instruct); ‏Voxtral Mini Transcribe V2 — 13 שפות, עד 3 שעות, דיאריזציה והטיה הקשרית — [Mistral docs](https://docs.mistral.ai/capabilities/audio_transcription); ‏VibeVoice-ASR-Streaming — 10 שפות, ‏MIT, דוברים + hotwords — [כרטיס](https://huggingface.co/microsoft/VibeVoice-ASR-Streaming-7B); ‏Moonshine — 10 שפות STT, ‏MIT — [GitHub](https://github.com/moonshine-ai/moonshine); ‏SenseVoiceSmall — zh/yue/en/ja/ko — [GitHub](https://github.com/FunAudioLLM/SenseVoice); ‏Fun-ASR-MLT-Nano-2512 — 800M, ‏31 שפות בדגש מזרח/דרום־מזרח אסיה — [כרטיס](https://huggingface.co/FunAudioLLM/Fun-ASR-MLT-Nano-2512); ‏Kyutai STT — דגמי en ו־en_fr בלבד (6/2025) — [Hugging Face](https://huggingface.co/kyutai/stt-2.6b-en).
- **יחסי מהירות/דיוק**: במאמר הלוח (A100) — Canary-Qwen 2.5B ‏5.63% ב־RTFx ‏418 מול Parakeet TDT 0.6B v2 ‏6.05% ב־RTFx ‏3,386; ‏"CTC and TDT decoders" מהירים בהרבה — [arXiv 2510.06961](https://arxiv.org/html/2510.06961v1).
- **מהירות על CPU (מדידות מפורסמות)**: onnx-asr — ‏Parakeet v2/v3 ‏RTFx ‏36 ו־Canary v2 ‏RTFx ‏8 על Ryzen 9800X3D — [onnx-asr](https://github.com/istupakov/onnx-asr); ‏faster-whisper small על i7-12700K (8 threads, 13 דק׳ שמע): ‏int8 ‏1:42 דק׳, ‏int8 ‏batch 8 ‏51 שנ׳ — [faster-whisper README](https://github.com/SYSTRAN/faster-whisper); ועל Xeon Gold 6226R (8 threads): ‏int8 ‏2:04 דק׳ — [README v0.10.0](https://raw.githubusercontent.com/SYSTRAN/faster-whisper/v0.10.0/README.md).
- **whisper.cpp**: קוונטיזציה (Q5_0), ‏OpenVINO ו־BLAS ל־x86, ‏Silero VAD מובנה (`--vad`, ‏silero-v6.2.0), ודיאריזציה ניסיונית (tinydiarize) — [GitHub](https://github.com/ggml-org/whisper.cpp).
- **הזיות של Whisper**: כ־1% מהתמלולים הכילו משפטים מומצאים, ‏38% מהם מזיקים, ושכיחות גבוהה יותר אצל דוברים עם יותר הפסקות — [Careless Whisper, arXiv 2402.08021](https://arxiv.org/abs/2402.08021); סט הזיות חוזרות מרעשים לא־דיבוריים ו"Bag of Hallucinations" לסינון בדיעבד (ICASSP 2025) — [arXiv 2501.11378](https://arxiv.org/abs/2501.11378); כשלי long-form: "repeat loops", השמטת מילים בתחילת/סוף קטע, "complete hallucination" — [מאמר Whisper, arXiv 2212.04356](https://arxiv.org/pdf/2212.04356).
- **בלמים ב־faster-whisper**: `hallucination_silence_threshold` (מדלג על שקט ארוך כשיש חשד להזיה, דורש `word_timestamps`), ‏`compression_ratio_threshold`, ‏`log_prob_threshold`, ‏`no_speech_threshold`, ‏`condition_on_previous_text` (כיבוי = פחות "failure loops"); ב־`BatchedInferencePipeline` חלק מהם לא פעילים ו־VAD פעיל כברירת מחדל — [transcribe.py](https://raw.githubusercontent.com/SYSTRAN/faster-whisper/master/faster_whisper/transcribe.py).
- **השמטות (לא הזיות) — הניסוי שלנו (9/11/2026)**: אותו מודל עברי, אותו שמע: לפי משפט 17.3%, ברצף 48.6–49.2% עם חורים של 6–15 שנ׳ (פרטים בסעיף 1).

### Inferences
- ל־CPU בלי GPU, ההיררכיה המעשית: CTC/TDT קטנים (Parakeet, ‏Granite TurboCTC, ‏zipformer) → Whisper turbo ‏int8 → מודלי LLM-ASR (רק עם GPU או דרך API).
- **כשל long-form מרכזי אצלנו הוא השמטה**, לא רק הזיה: לכן מדד בקרה זול = מילים לדקת דיבור (לפי VAD) והשוואה למנוע שני; ובנוסף סינון "Bag of Hallucinations" בעברית (משפטי סיום אופייניים) — לבנות רשימה משלנו מתוך העבודות שנכשלו.
- Granite TurboCTC מעניין לאנגלית בגלל Apache-2.0 (הפרויקט כבר סימן ש־Parakeet CC-BY-4.0 "מחייב ייחוס במוצר") — אבל צריך מדידה על הרצאות ומהירות ב־CPU.

### Gaps
- לא מצאתי מדידה מפורסמת של Whisper large-v3/turbo ‏int8 על 16 vCPU x86 (רק small על 8 threads); המספר שלנו — 4 vCPU בלבד.
- RTFx של Granite TurboCTC על CPU — לא מצאתי (מספר של 21,222 באתר משני נראה חריג ולא אומת).
- FireRedASR, ‏Canary-1B-v2 ו־Kyutai — לא נבדקו לעומק (אין עברית בכולם לפי מה שנמצא).

## 3. עברית — ivrit.ai, הלוח העברי, מודלים חדשים (10/2026), עירוב עברית־אנגלית, מספרים, ראשי תיבות ופיסוק

### Takeaway
ivrit-ai/whisper-large-v3(-turbo) 20250513 הם עדיין הטובים בלוח העברי, וזה מה שהשרת כבר מריץ. חדשות 10/2026: zipformer עברי של 66M פרמטרים (CC-BY-4.0) שמתקרב אליהם בשיחה (5.1–5.3 / 8.8–8.9) ורץ כמעט בחינם על CPU; Parakeet-TDT-0.6B-v3 עברי (6.1 / 8.8) — אבל **כותב מילים אנגליות באותיות עבריות**, ולכן לא מתאים להרצאה טכנית מעורבת. Nemotron 3.5 streaming לא מוכן לעברית בלי אימון (17.1 / 36.5).

### Cited Findings
- **הלוח העברי — WER לפי סט** (eval-d1 / WhatsApp / SASpeech / FLEURS / Kan): ivrit large-v3 20250513 ‏5.1/7.2/6.4/17.4/8.1; ivrit turbo 20250513 ‏5.3/7.1/6.6/18.1/8.2; ‏Soniox ‏4.8/9.0/6.5/17.7/11.4; ‏zipformer2-66m ‏5.3/8.8/6.4/23.4/11.8; ‏Amazon batch ‏6.6/10.4/8.5/23.0/9.0; ‏Deepgram nova-3 ‏6.7/12.0/10.2/23.3/21.0; ‏gpt-4o-transcribe ‏7.3/12.6/10.9/21.0/39.4; ‏whisper-large-v3-turbo המקורי ‏8.4/12.8/10.4/28.9/15.6; ‏nemotron-3.5-asr-streaming-0.6b ‏17.1/36.5/24.2/46.0/54.2 — [benchmark.csv](https://huggingface.co/spaces/ivrit-ai/hebrew-transcription-leaderboard).
- **הסטים**: eval-d1 — פודקאסט של 2 שעות, שני דוברים, "segmented into approximately 5-minute chunks"; ‏eval-whatsapp — ‏1:10 שעות הקלטות מתנדבים; ‏SASpeech — 4 שעות פודקאסט כלכלי־פוליטי; ‏FLEURS — שעתיים קריאה; ‏Kan — ‏1.7 שעות מיוטיוב של כאן; נרמול ו־WER ב־jiwer — [about.py של הלוח](https://huggingface.co/spaces/ivrit-ai/hebrew-transcription-leaderboard).
- **פירוק שגיאות (חישוב שלי מקובצי התוצאות)**: ב־ElevenLabs scribe_v1 ‏(נוסף 20/5/2025) שיעור ההשמטות על eval-d1 ‏15.5% ועל WhatsApp ‏14.3% — ובאותו יום שאחרי (21/5/2025) "Update eval-d1, eval-whatsapp results to align with dataset modifications" — כלומר התוצאה כנראה לא תואמת לגרסת הסט ואינה הוגנת; ב־Kan: השמטות של 29.5% ל־gpt-4o-transcribe ו־16.2% ל־Deepgram — [קובצי results/accuracy של הלוח](https://huggingface.co/spaces/ivrit-ai/hebrew-transcription-leaderboard) ו[ה־commits](https://huggingface.co/api/spaces/ivrit-ai/hebrew-transcription-leaderboard/commits/main).
- **ivrit-ai/whisper-large-v3-turbo-ct2** (‏Apache-2.0): אומן על 295 שעות מ־crowd-transcribe-v5 ועוד 93 שעות תמלול מקצועי — [כרטיס](https://huggingface.co/ivrit-ai/whisper-large-v3-turbo-ct2); גרסאות נוספות של ivrit.ai: ONNX ‏(12/2025), ‏ggml, וסדרת yi-whisper ליידיש (עדכון 26/10/2026) — [רשימת המודלים](https://huggingface.co/ivrit-ai).
- **zipformer2-66m-streaming-he** (‏14/10/2026, ‏CC-BY-4.0, מאת Yakov Kolani; מראה ב־ivrit-ai): Zipformer2 transducer של 66M, מכוונן מהמודל האנגלי של icefall, מפענח בחלקים של 1.28 שנ׳; ‏eval-d1 ‏5.1, ‏WhatsApp ‏8.9 (int8: ‏5.3/8.8); משמש את live-transcribe.ivrit.ai — [כרטיס](https://huggingface.co/ivrit-ai/zipformer2-66m-streaming-he). בניסוי שלנו: ‏RTF ‏0.087 על 4 vCPU, ‏238MB, מוציא פסיקים ונקודות.
- **parakeet-tdt-0.6b-v3-he** (‏thewh1teagle, נוצר 1/10/2026, ‏CC-BY-4.0): ‏eval-d1 ‏6.1, ‏WhatsApp ‏8.8; מגבלות: "English words come out in Hebrew letters", חלש בטקסט אנציקלופדי (FLEURS), "Numbers are written as words or digits inconsistently"; יש GGUF ל־NeMo-Speech.cpp — [כרטיס](https://huggingface.co/thewh1teagle/parakeet-tdt-0.6b-v3-he).
- **Nemotron 3.5 ASR streaming 0.6B** (‏NVIDIA, נוצר 15/5/2026, ‏OpenMDW-1.1): עברית ב"Adaptation-ready" — "require fine-tuning on in-domain data" — [כרטיס](https://huggingface.co/nvidia/nemotron-3.5-asr-streaming-0.6b); כוונון עברי קהילתי (notmax123, ‏6/7/2026): ‏WER ‏17.41% על dev של VoxKnesset — [כרטיס](https://huggingface.co/notmax123/nemotron-3.5-asr-hebrew-streaming-0.6b).
- **עירוב שפות**: Nemotron 3.5 Transcribe — עברית "Code-switching ✓", והנחיה מוכנה: לכתוב כל שפה בכתב שלה ואנגלית "in Latin script"; ‏FLEURS עברית ‏20.97 — [כרטיס](https://huggingface.co/nvidia/NVIDIA-Nemotron-3.5-Transcribe-30B-A4B). בהיתר עירוב עברית־אנגלית יש מודלים קהילתיים מ־10/2026 (danielrosehill …English-Hebrew-Codeswitching, ‏Hebrish/*), כולם **מוגבלי גישה** ובלי מדידה ציבורית — [Hugging Face](https://huggingface.co/danielrosehill/Parakeet-TDT-0.6B-v2-English-Hebrew-Codeswitching).
- **בניסוי שלנו** ivrit turbo הוציא ראשי תיבות באותיות לטיניות בתוך עברית ("APS", ‏"FIC") ומספרים בספרות ("כ-40") — סימן שהמודל מסוגל לכתב מעורב (תצפית, לא מדידה).
- **דיאריזציה עברית**: ivrit.ai מחזיקים fork של pyannote/speaker-diarization-3.1 (‏MIT, ‏15/8/2025) בלי תיאור כוונון — [כרטיס](https://huggingface.co/ivrit-ai/pyannote-speaker-diarization-3.1); מאגרים חדשים (מוגבלי גישה): VoxKnesset (‏26/10/2026) ו־eval-forced-alignment (‏31/10/2026) — [ivrit-ai](https://huggingface.co/ivrit-ai/eval-forced-alignment).
- **מסחריים — דרגת העברית שהספקים מצהירים**: ElevenLabs Scribe — עברית ב־"Good" ‏(>10% עד ≤20% WER) — [docs](https://elevenlabs.io/docs/capabilities/speech-to-text); ‏AssemblyAI Universal-2 — עברית ב־"Good" ‏(>10% עד ≤25%) — [docs](https://www.assemblyai.com/docs/pre-recorded-audio/supported-languages).

### Inferences
- להרצאות עבריות: להישאר על ivrit turbo/large-v3, ולהוסיף zipformer כמנוע שני (בדיקת כיסוי + עוגנים + "הצבעה" ב־LLM). ‏large-v3 מול turbo — הפרש קטן (8.8 מול 9.1) תמורת פענוח איטי יותר; כדאי רק בשלב "תיקון" לקטעים חשודים.
- למונחים אנגליים בהרצאה עברית: Whisper/ivrit עדיף על parakeet-he (שמתעתק לעברית). שילוב hotwords/initial_prompt עם המונחים מהשקופיות באותיות לטיניות צפוי לעזור (סעיף 7) — לא נמדד בעברית.
- פיסוק: הנרמול בלוח מוחק פיסוק, לכן אין מדד איכות פיסוק עברי; שני המודלים מוציאים פיסוק, ו־Claude יכול לתקן פיסוק/פסקאות בשלב ההגהה.

### Gaps
- אין WER ציבורי ל־Scribe v2, ‏Soniox v6, ‏MAI-Transcribe-2, ‏Gemini 3.5 Transcribe, ‏Speechmatics או AssemblyAI על הסטים העבריים.
- אין מדד ציבורי לעירוב עברית־אנגלית, למספרים או לראשי תיבות בעברית.
- לא מצאתי מאמר עדכני של ivrit.ai (2025–2026) עם מתכון האימון של מודלי 2025 (רק המאמר המקורי מ־2023 מצוטט בלוח, arXiv 2307.08720).

## 4. ASR מסחרי — תמיכה בעברית, ראיות WER, דיאריזציה, חותמות זמן ומחיר לשעה (נובמבר 2026)

### Takeaway
לעברית, הראיה הבלתי־תלויה היחידה היא הלוח של ivrit.ai: Soniox (‏0.10$/שעה) הוא המסחרי הטוב ביותר, ושווה בערך ל־ivrit הפתוח; Amazon (‏0.36$/שעה) מאחור; Deepgram ו־OpenAI חלשים במיוחד בקטעים קצרים (השמטות). השירותים הזולים החדשים (MAI-Transcribe-2 ‏0.10$, ‏Gemini 3.5 Transcribe ~0.30$, ‏gpt-transcribe ‏0.27$) לא נמדדו בעברית. לאנגלית long-form — Scribe/Rev/Speechmatics מובילים.

### Cited Findings
- **Soniox**: async ‏0.10$/שעה, ‏real-time ‏0.12$/שעה; דיאריזציה, זיהוי שפה ועיצוב כלולים; הקשר מותאם מחויב כטוקני טקסט (‏3.50$ למיליון ב־async); "Updated June 2026" ל־stt-rt-v6 — [מחירון](https://soniox.com/pricing); עברית נתמכת (async ו־real-time, כולל תרגום) והאתר מכריז על STT v6 (עוגן 3/11/2026) — [docs](https://docs.soniox.com/stt/concepts/supported-languages). בלוח העברי נמדדה הרצה מ־3/5/2026 (גרסה קודמת).
- **ElevenLabs Scribe v2**: ‏0.22$/שעה; keyterm prompting ‏+0.05$/שעה; ‏Realtime ‏0.39$/שעה — [מחירון](https://elevenlabs.io/pricing/api); עד 32 דוברים, חותמות זמן למילה, תגי `audio_event` (צחוק, מחיאות כפיים), עד 1,000 keyterms של 50 תווים, עד 10 שעות ו־3GB — [docs](https://elevenlabs.io/docs/capabilities/speech-to-text); ‏Scribe v1 — הטוב ב־long-form אנגלית (4.33%) — [arXiv 2510.06961](https://arxiv.org/html/2510.06961v1).
- **Deepgram Nova-3**: ‏0.0043$/דקה (מונולינגואלי) / ‏0.0052$/דקה (רב־לשוני) ב־PAYG; דיאריזציה כלולה; keyterm ‏+0.0013$/דקה — [מחירון](https://deepgram.com/pricing); עברית `he` ברשימת nova-3 החד־לשונית והרב־לשונית — [docs](https://developers.deepgram.com/docs/models-languages-overview); keyterms: עד 100 מונחים / 500 טוקנים, מומלץ 20–50 — [docs](https://developers.deepgram.com/docs/keyterm).
- **AssemblyAI** (דף עודכן 27/10/2026): Universal-3.5 Pro ‏0.21$/שעה, ‏Universal-2 ‏0.15$/שעה; דיאריזציה ‏+0.02$ (ניסיונית ‏+0.065$), ‏keyterms ‏+0.05$, ‏Speaker Identification ‏+0.02$ לשעה — [מחירון](https://www.assemblyai.com/pricing); עברית רק ב־Universal-2 (דרגת "Good") — [docs](https://www.assemblyai.com/docs/pre-recorded-audio/supported-languages).
- **Speechmatics**: Melia 1 ‏0.24$/שעה, ‏Standard ‏0.45$, ‏Enhanced ‏0.75$ (ועם הסכמה לאימון ‏0.16/0.30/0.50$); דיאריזציה וחותמות זמן בכל הדגמים, מילון מותאם רק ב־Enhanced/Standard — [מחירון](https://www.speechmatics.com/pricing); עברית `he` ברשימת השפות — [docs](https://docs.speechmatics.com/speech-to-text/languages).
- **Microsoft**: MAI-Transcribe-2 — 60 שפות **כולל עברית**, דיאריזציה, חותמות זמן למילה, keyword biasing, ‏"1 hour of audio in about 10 secs", עד 300MB / שעתיים, ‏0.10$/שעה "limited-time" — [כרטיס המודל](https://microsoft.ai/pdf/MAI-Transcribe-2-Model-Card.pdf); ב־Azure: ‏Batch ‏0.18$/שעה (מ־1/5/2024), ‏Fast Transcription ‏0.36$/שעה, ‏"Fast Transcription Promo" ‏0.10$/שעה (מ־1/9/2026), ‏S1 real-time ‏1.00$/שעה — [Azure Retail Prices API](https://prices.azure.com/api/retail/prices); מקור משני: המבצע עד 31/12/2026 — [eesel](https://www.eesel.ai/blog/mai-transcribe-2).
- **AWS Transcribe**: ‏0.0001$ לשנייה (= ‏0.006$/דקה) ב־us-east-1, פרסום מחירון 11/9/2026 — [AWS Price List](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/transcribe/current/us-east-1/index.json); דיאריזציה, אוצר מילים מותאם וזיהוי שפה כלולים — [דף המחירים](https://aws.amazon.com/transcribe/pricing/).
- **OpenAI**: gpt-transcribe ‏0.0045$/דקה, ‏gpt-4o-transcribe ‏0.006$, ‏gpt-4o-mini-transcribe ‏0.003$, ‏gpt-4o-transcribe-diarize ‏0.006$ — [מחירון](https://developers.openai.com/api/docs/pricing); מקור משני טוען הוצאה משימוש של whisper-1/gpt-4o-transcribe ב־26/8/2026 (הסרה 26/2/2027) — לא אומת — [gradually.ai](https://www.gradually.ai/en/ai-models/gpt-transcribe/).
- **Google**: Gemini 3.5 Transcribe (26/8/2026, תצוגה מקדימה) — ‏~0.005$/דקה משוקלל (קלט ‏0.003$/דקה, פלט ‏0.002$/דקה) — [AI Studio pricing](https://aistudio.google.com/docs/pricing); 85+ שפות (עברית לא מוזכרת), דיאריזציה עד 3 דוברים ("3+ experimental"), אוצר מילים מותאם, הסרת מילות מילוי — [9to5Google](https://9to5google.com/2026/08/26/gemini-3-5-transcribe/); ‏Chirp 3 ‏0.016$/דקה — מקור משני בלבד — [OpenRouter](https://openrouter.ai/google/chirp-3).
- **Gladia** (עודכן 3/11/2026): Solaria-1 ‏0.27€/שעה (100+ שפות), ‏Solaria-3 ‏0.16€/שעה (5 שפות); דיאריזציה ואוצר מילים כלולים; עברית לא מאומתת בדף — [pricing.md](https://www.gladia.io/pricing.md).
- **Rev AI**: Reverb foreign ‏0.30$/שעה ("53 more" שפות; עברית לא מאומתת) — [מחירון](https://www.rev.ai/pricing).

### Inferences
- **סדר מומלץ אם יאושר תשלום** (לפי ראיה ועלות): עברית — Soniox (ראיה בלוח + הזול ביותר); שנייה — MAI-Transcribe-2 (זול, עברית, אבל בלי מספרים — חייב A/B על הסט שלנו). אנגלית — Scribe v2 (ראיית long-form חזקה, ‏0.22$) או Gemini 3.5 Transcribe (~0.30$).
- **עלות לדוגמה, 100 שעות בחודש** (חשבון שלי): Soniox ‏10$; ‏MAI ‏10$ (מבצע); ‏Azure Batch ‏18$; ‏Scribe v2 ‏22$ (+5$ ל־keyterms); ‏gpt-transcribe ‏27$; ‏Gemini 3.5 Transcribe ~30$; ‏Deepgram multi ~31$; ‏AWS ‏36$.
- בקטעים קצרים ורועשים (Kan) חלק מהשירותים **משמיטים** תוכן (29.5% אצל gpt-4o-transcribe) — לכן גם שירות בתשלום צריך את אותה בדיקת כיסוי.

### Gaps
- אין מספרי WER עבריים לשירותים שהתעדכנו ב־2026 (Scribe v2, ‏Soniox v6, ‏MAI-Transcribe-2, ‏Gemini 3.5 Transcribe, ‏gpt-transcribe, ‏Speechmatics Melia 1, ‏Gladia).
- המחיר הרשמי של Chirp 3 ושל MAI-Transcribe-2 אחרי 2026 — לא נמצא בדף רשמי.
- המרה לשקלים — לא בוצעה (אין שער מתועד בסשן).

## 5. דיאריזציה ושמות דוברים — pyannote, ‏NeMo Sortformer, ‏DiariZen, ‏WeSpeaker, ‏3D-Speaker; ומתן שמות אוטומטי

### Takeaway
הפתוח הטוב והמותר לשימוש מסחרי ב־CPU: pyannote **community-1** (‏CC-BY-4.0, מוגבל גישה) — טוב מ־3.1 ברוב הסטים, עם מצב "exclusive" שמקל על התאמה למילים. ‏DiariZen טוב יותר ב־DER אך משקולותיו **לא מסחריים**. ‏Nemotron-3-Diarization (‏23/9/2026) הוא הטוב ביותר ב־DER, מסחרי (OpenMDW) — אבל מתוכנן ל־GPU. לשמות דוברים אין מודל ייעודי פתוח שנבדק; הדרך המעשית: LLM על התמלול (הצגה עצמית, פנייה בשם) + כותרת השקופית + מטא־דאטה של הסרטון, ומאגר טביעות קול למרצים חוזרים.

### Cited Findings
- **pyannote community-1** (‏CC-BY-4.0, מוגבל; טבלה מ־9/2025) — DER ‏3.1 → community-1 → precision-2: ‏AMI IHM ‏18.8 → 17.0 → 12.9; ‏DIHARD 3 ‏21.4 → 20.2 → 14.7; ‏VoxConverse ‏11.2 → 11.2 → 8.5; ‏REPERE ‏7.9 → 8.9 → 7.4; פלט `exclusive_speaker_diarization`; רץ על CPU כברירת מחדל ועובד offline — [כרטיס](https://huggingface.co/pyannote/speaker-diarization-community-1).
- **pyannote 3.1** (‏MIT, מוגבל): DER ‏AMI SDM ‏22.4, ‏DIHARD 3 ‏21.7, ‏VoxConverse ‏11.3; הסירו את onnxruntime — "pure PyTorch" — [כרטיס](https://huggingface.co/pyannote/speaker-diarization-3.1).
- **pyannoteAI (דף מ־5/11/2026)**: Precision-3 ‏0.112€/שעה (Developer) / ‏0.096€ (Starter); ‏Community-1 מתארח ‏0.035€/שעה; תזמור STT ‏0.168€/0.144€ לשעה; זיהוי מול טביעות קול (voiceprints) — [מחירון](https://www.pyannote.ai/pricing).
- **Nemotron-3-Diarization** (‏23/9/2026, ‏OpenMDW-1.1, מסחרי): ~100M, נגזר מ־Sortformer, עד 8 דוברים, אורך בלתי מוגבל בחלוקה; DER ‏DIHARD III ‏12.73, ‏CALLHOME ‏9.10, ‏AMI SDM ‏11.14; ‏RTFx ‏1,340 (eager) על GPU; ‏NeMo-Speech.cpp כ־runtime מקומי, בלי מספרי CPU — [כרטיס](https://huggingface.co/nvidia/Nemotron-3-Diarization).
- **DiariZen** (BUT): ‏DER ‏AMI-SDM ‏13.9, ‏DIHARD3 ‏14.5, ‏VoxConverse ‏9.1 (Large-s80-v2, ‏12/2025) מול 22.4/21.7/11.3 ל־pyannote 3.1; קוד MIT, **משקולות CC BY-NC 4.0** — "research and academic purposes only" — [GitHub](https://github.com/BUTSpeechFIT/DiariZen).
- **3D-Speaker** (Apache-2.0): ‏DER ‏AISHELL-4 ‏10.30%, ‏AliMeeting ‏19.73%, ‏AMI_SDM ‏21.76%, ‏VoxConverse ‏11.75%; ‏CAM++ ‏7.2M פרמטרים; ‏ONNX Runtime — [GitHub](https://github.com/modelscope/3D-Speaker).
- **בעובד היום**: WeSpeaker ResNet34-LM ב־`vt/diarize.py` — [00-internal-infrastructure.md](00-internal-infrastructure.md); "גובה הקול = רמז בלבד" לקביעת מגדר — `docs/studio-worker.md`.
- **ASR עם דוברים מובנים**: Nemotron 3.5 Transcribe — cpWER ‏AMI IHM ‏10.29, ‏SDM ‏17.34; אבל "Multispeaker ASR" לעברית — לא; ו־"Speaker labels … do not establish real-world identity" — [כרטיס](https://huggingface.co/nvidia/NVIDIA-Nemotron-3.5-Transcribe-30B-A4B).
- **שמות דוברים**: AssemblyAI Speaker Identification "uses conversation content to infer who's speaking", דורש רשימת שמות/תפקידים, ו־"names cannot be synthesized from nothing" (השם חייב להיאמר); ‏+0.02$/שעה — [docs](https://www.assemblyai.com/docs/speech-understanding/speaker-identification), [מחירון](https://www.assemblyai.com/pricing).

### Inferences
- להרצאה/וובינר (דובר ראשי + שאלות קהל): DER של מסדי פגישות מגזים את הקושי; העיקר הוא **זיהוי מעברי דובר קצרים** (שאלה מהקהל) ולא ספירת דוברים. community-1 עם `min_speakers`/`max_speakers` ו־exclusive מתאים; WeSpeaker הקיים יכול להמשיך לשמש לטביעות קול.
- **מתן שמות** (מוצע): (1) מועמדים — שם המרצה מהכותרת/תיאור/ערוץ, שקופית הפתיחה (OCR), והצגה עצמית בדקה הראשונה; (2) Claude Haiku מקבל קטעי טקסט לכל `SPEAKER_xx` ומחזיר שם + ביטחון + ציטוט־ראיה; (3) מאגר embedding למרצים חוזרים (בפרטיות: רק אצל המשתמש). הכרעה "לא ודאי" כשאין ראיה — בהתאם לכלל הקיים "בלי שאלות למשתמש באמצע עבודה".
- Nemotron-3-Diarization שווה בדיקת CPU דרך NeMo-Speech.cpp (100M פרמטרים — קטן), כי הוא מסחרי וטוב בהרבה ב־DER.

### Gaps
- מהירות CPU של community-1/Nemotron-3-Diarization על 1–3 שעות שמע — לא נמצאה מדידה.
- לא נמצא מחקר (בגלל מגבלת החיפוש) על דיוק מתן שמות אוטומטי מ־LLM/שקופיות/מטא־דאטה.
- אין DER על עברית לאף מערכת (VoxKnesset של ivrit.ai עשוי לאפשר — מוגבל גישה).

## 6. יישור ברמת מילה, VAD, פילוח למשפטים/פסקאות ופיסוק

### Takeaway
Qwen3-ForcedAligner הוא המדויק ביותר שנמדד (AAS ‏42.9ms) — אבל **בלי עברית**; לעברית נשארים מיישרי CTC (wav2vec2 עברי של imvladikon — ברירת המחדל של WhisperX לעברית, או CTC משלנו). כלי MMS (ctc-forced-aligner, ‏torchaudio MMS_FA) הם **CC-BY-NC** — לא למסחרי. ‏stable-ts, שהעובד משתמש בו, **ארכיון מאז 30/5/2026**. ‏ivrit.ai פרסמו (31/10/2026) סט הערכה ליישור עברי — כדאי לבקש גישה.

### Cited Findings
- **Qwen3-ForcedAligner-0.6B**: חותמות זמן עד 5 דק׳ שמע; 11 שפות (בלי עברית); ‏AAS ממוצע ‏42.9ms מול ‏129.8 (NFA), ‏133.2 (WhisperX); על 300 שנ׳ מחוברים ‏52.9 מול 246.7 (NFA) ו־2,708.4 (WhisperX) — [כרטיס Qwen3-ASR](https://huggingface.co/Qwen/Qwen3-ASR-1.7B).
- **WhisperX**: עברית ממופה ל־`imvladikon/wav2vec2-xls-r-300m-hebrew`; תווים שלא באוצר (ספרות, סמלים, כתב זר) נשמרים כ"wildcard" — [alignment.py](https://raw.githubusercontent.com/m-bain/whisperX/main/whisperx/alignment.py).
- **ctc-forced-aligner**: ברירת מחדל MMS-300m ל־1,130 שפות, ‏`--romanize` לכתב לא־לטיני, ‏"Atleast 5X less memory" מ־torchaudio; קוד BSD-2, **המודל CC-BY-NC 4.0** — [GitHub](https://github.com/MahmoudAshraf97/ctc-forced-aligner); ‏torchaudio MMS_FA: ‏31K שעות ב־1,130 שפות, ‏CC-BY-NC 4.0 — [docs](https://docs.pytorch.org/audio/main/generated/torchaudio.pipelines.MMS_FA.html).
- **NeMo Forced Aligner**: Viterbi על מודלי CTC של NeMo, פלט CTM/ASS, יותר משעה שמע, ‏CPU נתמך; "only English has been tested" — [docs](https://docs.nvidia.com/nemo-framework/user-guide/latest/nemotoolkit/tools/nemo_forced_aligner.html).
- **stable-ts**: יישור טקסט קיים (`align`, ‏`align_words`), ‏`refine`, דיכוי שקט (Silero), חלוקה מחדש לפי פיסוק/רווחים; **"archived by its owner on May 30, 2026"**, הפיתוח "indefinitely paused" — [GitHub](https://github.com/jianfch/stable-ts).
- **Silero VAD**: פחות מ־1ms לחתיכה של 30ms על thread אחד, ~2MB, ‏8/16 kHz — [GitHub](https://github.com/snakers4/silero-vad); ‏whisper.cpp משלב silero-v6.2.0 — [GitHub](https://github.com/ggml-org/whisper.cpp).
- **חותמות זמן ו־verbatim**: CrisperWhisper (Interspeech 2024) — טוקנייזר מותאם לשיפור DTW, תמלול מילולי עם מילות מילוי, פחות הזיות — [arXiv 2408.16589](https://arxiv.org/abs/2408.16589).
- **סט הערכה עברי ליישור**: ivrit-ai/eval-forced-alignment (עדכון 31/10/2026, מוגבל גישה) — [Hugging Face](https://huggingface.co/datasets/ivrit-ai/eval-forced-alignment).
- **בעובד היום**: Qwen3-ForcedAligner ב־ONNX ‏INT8, ‏MMS_FA ("רישיון NC — פער ידוע") וחציון של שלושה מקורות; בעברית — ivrit turbo + stable-ts + CTC עברי (imvladikon) בחלונות — [00-internal-infrastructure.md](00-internal-infrastructure.md), ‏`docs/studio-karaoke-he.md`.
- **בניסוי שלנו**: Silero ב־faster-whisper זיהה 222.5 שנ׳ דיבור מתוך 303.7 (סף 0.5) ו־253.4 (סף 0.2); פיצול לקטעים עד 20 שנ׳ ופענוח לחוד הוריד את ה־WER מ־48.6% ל־37.0% (פענוח לפי משפט: 17.3%).

### Inferences
- **פילוח לפני תמלול** הוא החלק הקריטי לאיכות בעברית: קטעים קצרים (≤10–15 שנ׳, גבול בשקט) עדיפים על חלונות של 30 שנ׳; ובמקביל zipformer כרשת ביטחון להשמטות.
- להחליף בהדרגה את stable-ts (ארכיון) ביישור CTC ישיר (Viterbi ב־numpy כבר קיים בעובד) — ולמדוד על eval-forced-alignment.
- להסיר את MMS_FA מכל נתיב מסחרי (CC-BY-NC); להשאיר רק Qwen3 (אנגלית) + CTC עברי.
- פילוח לפסקאות ופיסוק בעברית — עדיף ב־LLM (Claude) מעל חותמות הזמן: שבירה בשקט ארוך + שינוי שקופית + שינוי נושא.

### Gaps
- אין מספרי דיוק פומביים ליישור עברי (ms) לאף כלי.
- לא נמצא מודל שחזור פיסוק עברי ייעודי ועדכני (נבדק רק מה שה־ASR מוציא).

## 7. הטיה הקשרית (contextual biasing) — מונחי שקופיות (OCR), כותרת ותיאור כ־prompt/hotwords

### Takeaway
הראיות עקביות: הטיה במילות מפתח כמעט לא משנה את ה־WER הכולל, אבל **משפרת מאוד את המונחים עצמם** — ב־Nemotron: ‏recall של מילות מפתח 58% → ‏90–96%; ב־SlideSpeech: ‏B-WER יורד ו־recall עולה ל־~91% עם 50 מילות מפתח מהשקופיות. ב־faster-whisper יש `hotwords` ו־`initial_prompt` (בלי אימון); כל השירותים המסחריים מציעים keyterms ‏(0.05–0.08$ לשעה).

### Cited Findings
- **Nemotron 3.5 Transcribe — Context ASR**: ‏Contextual Earnings22 ‏WER ‏12.54 (בלי) → ‏10.28 (הקשר גלובלי) → ‏9.58 (מקומי); ‏keyword recall ‏58.16% → ‏89.50% → ‏96.05%, ‏precision ~98%; ‏ContextASR-Bench ‏named-entity WER ‏12.21 → ‏2.20 עם הקשר "Fine" (הקשר "Coarse" — בלי שיפור) — [כרטיס](https://huggingface.co/nvidia/NVIDIA-Nemotron-3.5-Transcribe-30B-A4B).
- **SlideSpeech** (ICASSP 2024): ‏1,705 סרטונים, 1,000+ שעות, 473 שעות מתומללות, שקופיות מסונכרנות; ‏OCR + KeyBERT + contextual ASR; מבחן L95: ‏WER ‏12.89 → ‏12.38; עם 50 מילות מפתח — ‏B-WER ‏9.32 ו־recall ‏90.86% — [arXiv 2309.05396](https://arxiv.org/abs/2309.05396).
- **LCB-net** (ICASSP 2024): הטיה בהקשר ארוך משקופיות — ירידה יחסית של 9.4% ב־WER ו־10.9% ב־B-WER על SlideSpeech — [arXiv 2401.06390](https://arxiv.org/abs/2401.06390).
- **TCPGen ל־Whisper** (Interspeech 2023): רשימת הטיה של 1,000 מילים — "considerable reduction in errors on biasing words" בלי לשנות את Whisper — [arXiv 2306.01942](https://arxiv.org/abs/2306.01942).
- **faster-whisper**: ‏`hotwords` — "Hotwords/hint phrases … Has no effect if prefix is not None", מקודדים כ"previous context" ונחתכים לחצי מאורך ההקשר; ‏`initial_prompt` — לחלון הראשון בלבד (ב־batched: לכל חלון) — [transcribe.py](https://raw.githubusercontent.com/SYSTRAN/faster-whisper/master/faster_whisper/transcribe.py).
- **NeMo**: ‏GPU-PB phrase boosting ל־CTC/RNNT/TDT/AED בזמן פענוח (בלי אימון), ‏CTC-WS ל־CTC, ‏Flashlight boosting — [docs](https://docs.nvidia.com/nemo-framework/user-guide/latest/nemotoolkit/asr/asr_customization/word_boosting.html).
- **מסחריים**: Deepgram keyterms (עד 100 / ‏500 טוקנים; "Avoid generic common words") — [docs](https://developers.deepgram.com/docs/keyterm); ‏ElevenLabs (1,000 × 50 תווים, ‏+0.05$/שעה) — [docs](https://elevenlabs.io/docs/capabilities/speech-to-text); ‏AssemblyAI (עד 1,000 מונחים ב־Universal-3.5 Pro, ‏200 ב־Universal-2, ‏+0.05$/שעה) — [מחירון](https://www.assemblyai.com/pricing); ‏MAI-Transcribe-2 keyword biasing — [כרטיס](https://microsoft.ai/pdf/MAI-Transcribe-2-Model-Card.pdf); ‏Voxtral "context biasing" — [docs](https://docs.mistral.ai/capabilities/audio_transcription); ‏VibeVoice "Customized Hotwords" — [כרטיס](https://huggingface.co/microsoft/VibeVoice-ASR-Streaming-7B).
- **סיכון**: "When context is supplied, it can influence the output toward" ההקשר — [כרטיס Nemotron](https://huggingface.co/nvidia/NVIDIA-Nemotron-3.5-Transcribe-30B-A4B).

### Inferences
- **"הקשר מקומי" עדיף על גלובלי**: לכל קטע — המונחים של השקופית הנוכחית (לפי זמן השוט/OCR), לא רשימה אחת לכל ההרצאה (Nemotron: ‏9.58 מול 10.28).
- מימוש זול: `hotwords` ב־faster-whisper לכל קטע = 20–50 מונחים (שמות, ראשי תיבות, מונחים באנגלית באותיות לטיניות) מה־OCR ומהכותרת/תיאור; בדיקה על סט פנימי: WER כולל + recall מונחים + שיעור "הוספות" של מונחים שלא נאמרו.
- ב־Parakeet (אנגלית, ONNX) — אין hotwords מובנה ב־onnx-asr; החלופה: תיקון בדיעבד ב־Claude עם רשימת המונחים (כבר קורה ב"הגהה").

### Gaps
- אין מדידה של hotwords/initial_prompt בעברית או על מודלי ivrit.
- לא נמצא מחקר על הטיה מתיאור יוטיוב/כותרת (רק שקופיות).

## 8. תמלולים קיימים — כתוביות יוטיוב ידניות מול אוטומטיות: מתי לסמוך ומתי לתמלל מחדש

### Takeaway
יוטיוב מציע כתוביות אוטומטיות גם בעברית, ומצהיר בעצמו שהאיכות משתנה; אין לי מספרי WER עדכניים לכתוביות האוטומטיות (פער). כתוביות ידניות של היוצר הן מקור חזק (גם להטיה ולתיקון שמות), אוטומטיות — רמז חלש בלבד. הכלל המעשי: לתמלל תמיד בעצמנו, ולהשתמש בכתוביות קיימות להשוואה, לתיקון שמות ולמונחים.

### Cited Findings
- **עברית בכתוביות אוטומטיות של יוטיוב** — כן; האיכות "משתנה מסרטון לסרטון" ועשויה לא לשקף את הדיבור (מבטא, רעש, הגייה), ויוטיוב ממליץ לבדוק ולתקן — [YouTube Help (he)](https://support.google.com/youtube/answer/6373554?hl=iw).
- **זיהוי תמלול מכונה**: "Many transcripts on the internet are not actually human-generated"; כללי זיהוי: תמלול כולו באותיות גדולות/קטנות, בלי פסיקים — "never including commas" — [Whisper, arXiv 2212.04356](https://arxiv.org/pdf/2212.04356).
- **שימוש מחקרי**: SlideSpeech השתמשו בכתוביות יוטיוב ("generated or user-uploaded subtitle files") רק לאימות מועמדים, ותמללו בעצמם — [arXiv 2309.05396](https://arxiv.org/abs/2309.05396); ‏YODAS — 500K+ שעות ב־100+ שפות עם כתוביות ידניות או אוטומטיות — [arXiv 2406.00899](https://arxiv.org/abs/2406.00899).
- **סט Kan בלוח העברי** נבנה מכתוביות יוטיוב של כאן — ושם השירותים המסחריים הראו השמטות גבוהות (16–30%) — [benchmark.csv / about.py](https://huggingface.co/spaces/ivrit-ai/hebrew-transcription-leaderboard).

### Inferences
- **מדיניות מוצעת**: (1) ידניות באנגלית/עברית — לחשב WER בינן לבין התמלול שלנו; הסכמה גבוהה (נגיד <10%) → אמון גבוה בשני המקורות והשמות מהידניות; פער גדול → לבדוק השמטות שלנו; (2) אוטומטיות — רק מונחים/שמות, לא טקסט; (3) הבדלה ביניהן ב־yt-dlp (subtitles מול automatic_captions) — לשמור את סוג המקור במטא־דאטה.
- כתוביות ידניות הן גם "אמת קרקע" זולה לבניית סט בדיקה פנימי (אחרי האזנה מדגמית).

### Gaps
- לא נמצאו (מגבלת חיפוש) מספרי WER עדכניים (2025–2026) לכתוביות אוטומטיות של יוטיוב באנגלית או בעברית.

## 9. אירועי שמע ופרה־לשוניות לניתוח הרצאה — מחיאות כפיים, צחוק, מוזיקה, שקט, זיהוי Q&A, הדגשה/פרוזודיה, קצב דיבור, מילות מילוי

### Takeaway
אירועים (מחיאות כפיים, צחוק, מוזיקה) — זול ואמין על CPU עם מתייגי AudioSet קטנים (EfficientAT ‏mn10: ‏4.9M פרמטרים, ‏mAP ‏47.1, ‏MIT) או SenseVoice; קצב דיבור, הפסקות ומילות מילוי — נגזרים מחותמות הזמן שכבר יש לנו (כמעט בחינם); הדגשה/פרוזודיה — יש מסווגים מחקריים (EmphaClass, אנגלית) ותכונות גובה/עוצמה, אבל **אין מחקר ייעודי להרצאות שנמצא**; Q&A — הרכבה של דיאריזציה + שאלה + שינוי אקוסטי (היסק, לא מודל מוכן).

### Cited Findings
- **EfficientAT** (‏MIT): ‏mn04 ‏0.98M פרמטרים / ‏mAP ‏43.2; ‏mn10 ‏4.88M / ‏0.54 GMACs / ‏47.1; ‏dymn10 ‏10.57M / ‏47.7; ‏mn40 ‏68.43M / ‏48.4 — "competitive audio tagging performance on resource constrained platforms" — [GitHub](https://github.com/fschmid56/EfficientAT).
- **PANNs**: ‏mAP ‏0.439 ב־AudioSet (שיא קודם 0.392) — [arXiv 1912.10211](https://arxiv.org/abs/1912.10211).
- **Whisper-AT** (Interspeech 2023): תיוג אירועים על מקודד Whisper קפוא ב־"<1% extra computational cost"; ייצוג Whisper "highly correlated to non-speech sounds" — [arXiv 2307.03183](https://arxiv.org/abs/2307.03183).
- **SenseVoiceSmall**: זיהוי אירועים (BGM, ‏Applause, ‏Laughter, ‏Cry, ‏Cough, ‏Sneeze, ‏Breath) ורגש (7 מחלקות); "15 times faster than Whisper-Large"; קוד MIT, משקולות ברישיון FunASR; ‏ONNX/GGUF ל־CPU — [GitHub](https://github.com/FunAudioLLM/SenseVoice).
- **ElevenLabs Scribe**: תגי `audio_event` (צחוק, מחיאות כפיים) בפלט — [docs](https://elevenlabs.io/docs/capabilities/speech-to-text).
- **צחוק**: laughter-detection (‏MIT; ‏Switchboard; סף ו־min_length) — [GitHub](https://github.com/jrgillick/laughter-detection).
- **רגש**: emotion2vec — ייצוג רגש בדיבור, שיפור עקבי ב־10 שפות — [arXiv 2312.15185](https://arxiv.org/abs/2312.15185).
- **הדגשה**: EmphAssess (EMNLP 2024) ו־EmphaClass — מסווג הדגשה ברמת פריים/מילה — [arXiv 2312.14069](https://arxiv.org/abs/2312.14069).
- **תכונות פרוזודיה**: openSMILE — ב־open source "free for private, research, and educational use", מוצר מסחרי דורש רישיון — [GitHub](https://github.com/audeering/opensmile).
- **מילות מילוי**: CrisperWhisper — תמלול מילולי וזיהוי מילות מילוי עם זמנים — [arXiv 2408.16589](https://arxiv.org/abs/2408.16589); ‏Nemotron Transcribe — הנחיית "verbatim, including fillers and repetitions" — [כרטיס](https://huggingface.co/nvidia/NVIDIA-Nemotron-3.5-Transcribe-30B-A4B); לעומת זאת Gemini 3.5 Transcribe **מסיר** מילות מילוי — [9to5Google](https://9to5google.com/2026/08/26/gemini-3-5-transcribe/).
- **פרה־לשוניות ב־LLM שמע**: Step-Audio 2 mini (‏Apache-2.0, ‏8B) — רגש, גיל, מגדר, סגנון, גובה, קצב, מהירות; ‏StepEval-Audio-Paralinguistic ‏80.00 — [כרטיס](https://huggingface.co/stepfun-ai/Step-Audio-2-mini); ‏Gemini — "Emotion detection in speech and music" ו־"non-speech sounds" — [AI Studio audio](https://aistudio.google.com/docs/audio).

### Inferences
- **מה שווה לחלץ (יחס תועלת/עלות)**: (1) מחיאות כפיים/צחוק/מוזיקה — EfficientAT ‏mn10 על חלונות של 1 שנ׳ (עלות זניחה ב־CPU); (2) קצב דיבור (מילים/דקה), הפסקות ארוכות, מילות מילוי — מחותמות הזמן; (3) Q&A — דובר משני קצר + משפט שמסתיים בסימן שאלה/מילת שאלה + שינוי אקוסטי (ריחוק מיקרופון) + אחריו תור ארוך של הדובר הראשי; (4) הדגשה — z-score של גובה/עוצמה/האטה ברמת מילה מול הממוצע של הדובר, ואימות ב־LLM על הטקסט ("זה חשוב", "שימו לב") — הקריאה הטקסטואלית כנראה אמינה יותר מהאקוסטיקה בעברית.
- רגש/"טון" — רמז משני בלבד; להציג בזהירות (בדומה ל"גובה הקול = רמז בלבד" שכבר נקבע לגבי מגדר).
- openSMILE — לא לשימוש מסחרי בלי רישיון; עדיף חילוץ גובה/עוצמה בספריות פתוחות (לבדוק רישיון לפני שימוש).

### Gaps
- לא נמצא (מגבלת חיפוש) מחקר על זיהוי "נקודות חשובות" בהרצאות לפי פרוזודיה, ולא על זיהוי Q&A בהרצאות.
- אין מדידת CPU מפורסמת ל־EfficientAT/SenseVoice על שעה שמע; ואין בדיקה של מסווגי אירועים על הקלטות עבריות.

## 10. Audio-LLMs — מה הם מוסיפים מעבר למילים (טון, הדגשה, כוונת דובר), ובכמה

### Takeaway
LLM שמע מוסיף תיאור אירועים, טון ורגש, ותשובות על השמע — אבל רובם (Qwen3-Omni, ‏Step-Audio 2, ‏Kimi-Audio, ‏Audio Flamingo 3, ‏Voxtral) **בלי עברית**, דורשים GPU כבד, או לא מסחריים (AF3). הדרך המעשית אצלנו: Gemini (‏32 טוקנים לשנייה, עד 9.5 שעות לבקשה) על קטעים נבחרים — ‏Flash-Lite עולה ~0.035$ לשעת שמע בקלט; התמיכה בעברית בהבנת שמע לא אומתה.

### Cited Findings
- **Gemini API**: ‏32 טוקנים לשנייה (1,920 לדקה), עד 9.5 שעות שמע לבקשה; תמלול, תרגום, דיאריזציה, רגש, "non-speech sounds", הפניה בזמן MM:SS — [AI Studio audio](https://aistudio.google.com/docs/audio).
- **מחירי Gemini (9/11/2026)**: ‏3.5 Flash-Lite ‏0.30$ למיליון טוקני קלט (גם שמע), פלט ‏2.50$; ‏3.8 Flash / ‏3.6 Flash ‏0.75$ קלט עד 31/12/2026 (אחר כך 1.50$), פלט ‏3.75$; ‏3.1 Flash-Lite שמע ‏0.50$; ‏Batch = 50%; ‏2.5 Flash/Pro יופנו ב־1/12/2026 — [AI Studio pricing](https://aistudio.google.com/docs/pricing). חשבון שלי: שעת שמע = 115,200 טוקנים → Flash-Lite ~0.035$, ‏3.8 Flash ~0.086$ (קלט בלבד).
- **OpenAI**: ‏gpt-audio — שמע קלט ‏32$ / פלט ‏64$ למיליון טוקנים — [מחירון](https://developers.openai.com/api/docs/pricing).
- **Nemotron 3.5 Transcribe**: ‏MMAU-Pro (non-music, closed-form) ‏52.69; "Audio understanding … evaluated only in English" — [כרטיס](https://huggingface.co/nvidia/NVIDIA-Nemotron-3.5-Transcribe-30B-A4B).
- **Qwen3-Omni-30B-A3B** (‏Apache-2.0): ‏MMAU ‏77.5; 19 שפות קלט דיבור, **בלי עברית**; זיכרון BF16 מינימלי ‏88.52GB לווידאו של 30 שנ׳; קיים Qwen3-Omni-30B-A3B-Captioner לתיאור שמע "low-hallucination" — [כרטיס](https://huggingface.co/Qwen/Qwen3-Omni-30B-A3B-Instruct).
- **Audio Flamingo 3** (‏10/7/2025): "NVIDIA OneWay Noncommercial License", עד 10 דק׳ — [כרטיס](https://huggingface.co/nvidia/audio-flamingo-3).
- **Step-Audio 2 mini** (‏Apache-2.0, ‏8B): ‏MMAU ‏73.2, פרה־לשוניות ‏80.00; אנגלית וסינית — [כרטיס](https://huggingface.co/stepfun-ai/Step-Audio-2-mini).
- **Kimi-Audio** (‏25/4/2025, ‏Apache-2.0/MIT): ‏ASR, ‏AQA, ‏captioning, ‏SER, ‏SEC; ‏MMAU sound ‏73.27 / speech ‏60.66 — [GitHub](https://github.com/MoonshotAI/Kimi-Audio).

### Inferences
- **שימוש מומלץ**: לא להריץ LLM שמע על כל ההרצאה לתמלול; להריץ אותו על 10–20 קטעים נבחרים (פתיחה, מעברי נושא, שאלות קהל, רגעים עם אירועי שמע) ולבקש JSON: טון, התלהבות, הדגשה, האם שאלה מהקהל, תגובת קהל — בעלות של סנטים להרצאה. אפשר גם על ההרצאה כולה ב־Flash-Lite (~0.035$ לשעה) כשמטרתו "מפה אקוסטית", לא תמלול.
- המודלים הפתוחים (Qwen3-Omni, ‏Step-Audio 2, ‏Kimi-Audio) לא מתאימים ל־CX53 (GPU/זיכרון) וגם לא לעברית — לא להשקיע בהם עכשיו.

### Gaps
- אין מדידה של הבנת שמע **בעברית** ב־Gemini (טון/הדגשה/רגש) — צריך בדיקה קטנה על 5–10 קטעים.
- לא נמצא מחקר שמשווה LLM שמע מול פרוזודיה קלאסית לזיהוי הדגשה בהרצאות.
