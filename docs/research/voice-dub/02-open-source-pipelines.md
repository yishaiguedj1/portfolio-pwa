# מפקד פרויקטי קוד פתוח לדיבוב וידאו עם שיבוט קול

> נכתב 25/11/2026 · סוכן מחקר · מטרה: ללמוד **ארכיטקטורה**, לא להעתיק קוד.
> שיטה: `gh api search/repositories` (כוכבים/פעילות/רישיון נמשכו חיים בתאריך זה), קריאת README ו־docs גולמיים מ־raw.githubusercontent.com, קריאת קטעי קוד של מנגנוני התזמון (VideoLingo, open-dubbing), חיפוש issues, וחיפושי רשת.
> **מגבלה:** גישת `gh` לקריאת גוף של issue בודד חסומה בסשן (רק חיפוש), ולכן "לקחי ה־issues" מבוססים על כותרות, ספירת תגובות, ועל "Current Limitations" / "Known rough edges" שהמפתחים עצמם כותבים, ועל סקירות צד שלישי (מסומנות כ"משני"). איכות קול ובדיקות שמיעה לא נבדקו כאן — צריך מבחן שמיעה בעצמנו.
> רישיון = רישיון **הקוד** (SPDX מ־GitHub). רישיון **המשקולות** נפרד ולרוב מגביל יותר — ראו סעיף 7.

---

## 1. טבלה מסכמת

| פרויקט | ★ | פעילות אחרונה | רישיון קוד | שיבוט קול | התאמת משך | הפרדת רקע | דוברים | עברית | הערה |
|---|---|---|---|---|---|---|---|---|---|
| [pyVideoTrans](https://github.com/jianchang512/pyvideotrans) | 19.8K | 25/11/2026 | **GPL-3.0** | F5-TTS, CosyVoice, GPT-SoVITS, ChatTTS/Chatterbox ועוד | `SpeedRate`: האצת אודיו + האטת וידאו + הסרת שתיקות | UVR/Spleeter | diarization (ONNX/CAM++/pyannote) | ASR כן (Whisper), פלט תלוי מנוע TTS | הכי שלם ופעיל; מונוליט GUI |
| [VideoLingo](https://github.com/Huanshere/VideoLingo) | 19.4K | 13/11/2026 | Apache-2.0 | GPT-SoVITS, F5, CosyVoice2, Fish | LLM מקצר + `atempo` + מיזוג שורות | כן (רקע חוזר במיקס) | **לא** — קול אחד | קלט: לא ברשימה (אנגלית, רוסית, צרפתית, גרמנית, איטלקית, ספרדית, יפנית, סינית) | הכי טוב בפיצול כתוביות/מונחון |
| [KrillinAI → OpenCreator](https://github.com/krillinai/OpenCreator) | 14.5K | 25/11/2026 | Apache-2.0 | כן (ענן/מקומי) | לא מתועד ב־README | חלקי | לא ברור | 123 שפות מקור | הפך ל"סביבת יוצרים" רחבה; דיבוב הוא רק חלק |
| [VoiceStudio](https://github.com/debpalash/VoiceStudio) | ~118K (!) | 24/11/2026 | **AGPL-3.0** | OmniVoice (משקולות **NC**) ועוד | "speech timed to the original" | כן | כן | 646 שפות (טענה) | הספירה חריגה — לאמת; ראו אזהרה בסעיף 8 |
| [YouDub-Desktop / webui](https://github.com/liuzhao1225/YouDub-webui) | 5.9K | 23/11/2026 | Apache-2.0 | **שיבוט לכל משפט** מהקטע המקורי שלו | יישור כפוי אופציונלי | כן, שמירת רקע | — | לא (דגש סינית↔אנגלית) | רעיון ה"רפרנס פר־משפט" |
| [Linly-Dubbing](https://github.com/Kedreamix/Linly-Dubbing) | 3.4K | 05/03/2025 | Apache-2.0 | CosyVoice, XTTS, GPT-SoVITS | בסיסי | Demucs/UVR5 | WhisperX diarization | לא | נראה נטוש; הרבה issues התקנה |
| [SoniTranslate](https://github.com/R3gm/SoniTranslate) | 1.4K | 29/08/2026 | Apache-2.0 | XTTS, OpenVoiceV2, FreeVC, RVC, Piper | `accelerate_segments` (תקרת האצה) | כן | עד 12 דוברים (pyannote) | **כן** — `he` ברשימת השפות (מאז 08/2023) | נקודת ייחוס לעברית |
| [ThioJoe Auto-Synced-Translated-Dubs](https://github.com/ThioJoe/Auto-Synced-Translated-Dubs) | 1.8K | 11/05/2026 | **AGPL-3.0** | לא (TTS ענן) | **מעבר שני**: סינתוז מחדש בקצב מחושב; Azure — משך מראש | אין | אין | תלוי ספק | הצנרת הפשוטה והנקייה ביותר — כתוביות אנושיות כקלט |
| [Pandrator](https://github.com/lukaszliniewicz/Pandrator) | 651 | 21/11/2026 | MIT | Qwen3-TTS, Kokoro ועוד | — (ספרי שמע/כתוביות) | — | Cast per speaker | לא ברור | כלי קריינות; לא דיבוב וידאו אמיתי |
| [Voice-Pro](https://github.com/abus-aikorea/voice-pro) | 13.5K | 13/07/2026 | **GPL-3.0** (README: LGPL) | F5/E2/CosyVoice | ללא התאמה | Demucs/MDX | — | Whisper כן | אוסף כלים; whisperX הוסר |
| [open-dubbing](https://github.com/Softcatala/open-dubbing) | 441 | 08/07/2025 | Apache-2.0 | **לא** (קולות לפי מגדר) | חיתוך שתיקת סוף + מהירות | כן | pyannote + זיהוי מגדר | לא נבדק | ארכיטקטורה נקייה וקטנה (CLI) |
| [ViDubb](https://github.com/medahmedkrichen/ViDubb) | 139 | 23/07/2025 | Apache-2.0 | XTTS-דמוי + ניתוח רגש (SpeechBrain) | FFmpeg | כן | כן | MarianMT ⇒ תלוי זוג | יחיד עם Wav2Lip מובנה |
| [OpenDub (estebanstifli)](https://github.com/estebanstifli/OpenDub) | 24 | 10/10/2026 | MIT | IndexTTS2.5 + **רפרנס רגש נפרד** | ניסיונות סינתזה חוזרים + מתיחה מוגבלת; חפיפה מותרת | BS-RoFormer | Nemotron diarization | **לא** (zh/en/ja/es/ar) | הצנרת המודרנית ביותר, GGUF/audio.cpp |
| [Dub Studio](https://github.com/timoncool/dub-studio) | 312 | 24/11/2026 | לא מוגדר | Higgs Audio v3, Qwen3-TTS, Fish | עורך + התאמה | כן | Nemotron + קישור פנים↔דובר | Parakeet/CrisperWhisper (99 שפות) | Rust/C++ ללא פייתון; MCP; לוקליזציה של טקסט על המסך |
| [PersoDub](https://github.com/stronghamjji/PersoDub) | 53 | 24/11/2026 | **AGPL-3.0** | Qwen3-TTS / OmniVoice | **תרגום מותאם לחלון (±15%) + האצה עד 10%** | Mel-Band RoFormer / Demucs | CAM++ | Whisper | הכי רציני בנושא התאמת משך; סוכן עריכה (MCP) |
| [langswap](https://github.com/langswap-app/langswap) | 47 | 22/06/2026 | **AGPL-3.0** (+ מסחרי) | OmniVoice/XTTS/F5/Qwen3 | `speedup` / `stretch_whole` | — | — | — | קטן, ASR→LLM→TTS→dub |
| [SmartSub](https://github.com/buxuku/SmartSub) | 6.2K | 25/11/2026 | MIT | Kokoro/VITS/ZipVoice | — | — | — | whisper.cpp וכו׳ | כלי כתוביות עם דיבוב כתוספת |
| [Sosie](https://github.com/damienlaine/sosie) | 5 | 15/10/2026 | MIT | Chatterbox Multilingual V3 | WSOLA בלי שינוי גובה, "רצועת רית'מו" | — | — | **Chatterbox תומך `he`** | סטודיו קריינות ידני; רעיון בחירת טייק ב־Whisper |
| [InsiderX video-translator](https://github.com/InsiderX-Pro/video-translator) | 813 | 06/11/2026 | MIT | — | — | — | — | — | לא נבדק לעומק |
| [google/ai_video_dubbing](https://github.com/google/ai_video_dubbing) | 51 | 2024 (ארכיון) | Apache-2.0 | ענן Google | — | — | — | — | הוכחת־היתכנות ארכיונית, מקור השראה בלבד |

**פרויקטים שנבדקו ולא נכללו כצנרת מלאה:** MoneyPrinter-דומים (דיבוב אינו הליבה), "Clipchamp-alternatives" (אין מוצר OSS מקביל שמצאתי), ו־dubbing-engine/Dubby/AutoDub קטנים (פחות מ־35★, דמו אקדמי).

---

## 2. פרופיל לכל פרויקט — צנרת מדויקת ולקחים

### 2.1 pyVideoTrans — המתחרה הכי בשל
- **9 שלבים** ([docs/architecture.md](https://github.com/jianchang512/pyvideotrans/blob/main/docs/architecture.md)): הכנה (מונו 16k, הפרדת ווקאל UVR/Spleeter, הורדת רעש) → ASR (faster-whisper large-v3-turbo + 20 מנועים) → diarization → תרגום (20+ ערוצים: LLM, DeepL…) → **TTS** (34+ מנועים; שיבוט מקטע שנחתך מהמקור) → **`align()` / SpeedRate** (האצת דיבור, האטת וידאו, הסרת פערי שתיקה, יישור כפוי) → **recogn2pass** (ASR שני על הדיבוב כדי לקבל זמנים מדויקים לכתוביות) → ffmpeg → סיום.
- ארכיטקטורה: **תורים ו־workers** לכל שלב (producer/consumer), דגלי `should_recogn/trans/dubbing/hebing/separate` מרכיבים מצבים (תרגום כתוביות בלבד, דיבוב טקסט בלבד וכו'). עצירה ועריכה ידנית בין שלבים.
- **התאמת משך:** ללא תרגום-מודע-משך; מסתמך על האצה + האטת וידאו. זו הנקודה החלשה — issue [#129](https://github.com/jianchang512/pyvideotrans/issues/129) ("האטת וידאו אוטומטית לא עובדת") וכן [#636](https://github.com/jianchang512/pyvideotrans/issues/636) (F5-TTS מפיק דיבוב "נורא" בצנרת אך תקין בכלי עצמאי — כלומר הדבקת TTS חד-קטעי יוצרת חפצים).
- **עברית:** מקור — Whisper מכסה; issues ישנים על בחירת שפה ([#614](https://github.com/jianchang512/pyvideotrans/issues/614), [#365](https://github.com/jianchang512/pyvideotrans/issues/365)). אין תיעוד על RTL בכתוביות שרופות — לבדוק בעצמנו.
- **לקחים (משני):** [סקירה](https://www.promptquorum.com/power-local-llm/pyvideotrans-review) מזהירה שאין טיפול מתועד בחפיפת דוברים; ההמלצה הרווחת — pyVideoTrans לדיבוב, VideoLingo לכתוביות.
- **רישיון: GPL-3.0** — אסור לשלב קוד; מותר ללמוד.

### 2.2 VideoLingo — המצטיין בתרגום וזמנים ברמת מילה
- ASR: **Qwen3-ASR + Qwen3-ForcedAligner** (קודם WhisperX), פיצול כתוביות ב־NLP+LLM, **מונחון** אוטומטי, תרגום "translate → reflect → adapt".
- **התאמת משך (מה שקראתי בקוד):** `core/_8_1_audio_task.py` — `estimate_duration(text)` ÷ מקסימום speed_factor; אם חורג מהחלון → **LLM מקצר** (פרומפט `get_subtitle_trim_prompt` עם `duration`), עם fallback של הסרת פיסוק. `_8_2_dub_chunks.py` — מסווג כל שורה (מהיר מדי / טעון האצה / איטי מדי / תקין) **ומאחד עד 5 שורות סמוכות** כשאי אפשר להתאים. `_10_gen_audio.py` — `atempo` של ffmpeg, חיתוך לאורך הצפוי. `_11_merge_audio.py` — הדבקה עם שתיקות.
- **מגבלות שהמפתח מצהיר עליהן:** ללא קול נפרד לכל דובר; האצה "לא מבטיחה אמינות טבעית"; שפה אחת לכל קטע ASR. issue [#453](https://github.com/Huanshere/VideoLingo/issues/453): קטעים בודדים שבהם הדיבור המתורגם "מהיר מדי, כמעט לא נשמע" — התוצאה הקלאסית של תקרת האצה רופפת.
- רישיון Apache-2.0 — **הכי ידידותי** ללמידה ושילוב.

### 2.3 YouDub (webui → Desktop) — שיבוט פר־משפט
- ממשק workflow בצמתים; **כל משפט מתורגם משובט מקטע האודיו של משפט המקור המתאים** ("רפרנס אחד־לאחד"), שמירת רקע מופרד, יישור כפוי אופציונלי, כתוביות. תבנית רלוונטית לנו: רפרנס **צמוד־קונטקסט** (אותה אינטונציה/רגש) ולא רפרנס גלובלי לדובר. Linly-Dubbing נבנה כהשראה ממנו (נעצר ב־03/2025).

### 2.4 SoniTranslate — הפרויקט היחיד עם עברית מפורשת
- Whisper/WhisperX → pyannote (עד 12 דוברים) → תרגום (Google/MarianMT/GPT) → TTS: Edge, Piper, Bark, **Coqui XTTS**, VITS → **המרת קול**: OpenVoiceV2 / FreeVC / **RVC** (אחרי TTS, "החלפת גוף הקול") → `accelerate_segments` עם תקרה → מיקס. עברית נוספה ב־08/2023.
- הלקח האדריכלי: **TTS בסיסי + שכבת voice-conversion** מפרידה בין "מה נאמר ובאיזה מבטא" ל"קול של מי".

### 2.5 ThioJoe Auto-Synced-Translated-Dubs — הלקח הקלאסי של "מעבר שני"
- קלט: SRT אנושי. תרגום → חישוב משך לכל קליפ → TTS → **מתיחה/כיווץ**, או (ברירת מחדל) **סינתוז שני** עם קצב דיבור מחושב ממעבר ראשון (איכות טובה מ־stretch); ב־Azure אפשר להגדיר משך מראש. AGPL-3.0, בלי שיבוט.

### 2.6 open-dubbing (Softcatalà)
- CLI נקי: ffmpeg → הפרדה → Whisper (זיהוי שפה) → pyannote → **זיהוי מגדר** לבחירת קול → תרגום NLLB/Apertium → TTS (Coqui/MMS/Edge/OpenAI) → **הסרת שתיקת סוף של TTS** כדי שלא "ייבלע" בהאצה של השורה הבאה, יחס משך מקור/יעד → מיקס. אין שיבוט; מפתחו מגדיר אותו "ניסיוני". ארכיטקטורה קלה לקרוא.

### 2.7 ViDubb
- Whisper → NLTK → MarianMT / LLM להקשר → ניתוח רגש (SpeechBrain) → TTS עם התאמת רגש → סנכרון FFmpeg → **Wav2Lip** אופציונלי (רישיון Wav2Lip: ללא SPDX/מחקרי — ראו סעיף 7).

### 2.8 הדור החדש (2026) — OpenDub, Dub Studio, PersoDub, langswap
- **OpenDub:** ffmpeg → BS-RoFormer → Qwen3-ASR → Nemotron diarization → **Qwen3 forced aligner** → תרגום llama.cpp (Qwen3 4B) → **IndexTTS2.5** עם רפרנס **קול נפרד מרפרנס רגש** (מקור הדיבור משמש רגש) → fitting: ניסיונות סינתזה חוזרים + מתיחה מוגבלת; **חפיפה מותרת כברירת מחדל** ("Following segments never shift automatically"). חיסרון: IndexTTS2.5 לא כולל עברית/אנגלית-בלבד-הכוונה; לאנגלית כיעד מתאים.
- **Dub Studio:** צנרת native (Rust+C++/CUDA, בלי פייתון), Parakeet-TDT v3 / CrisperWhisper 2.0 turbo (99 שפות, זמני מילים), VoxLingua107 לזיהוי שפה, **Nemotron 3 Diarization (עד 8)**, Higgs Audio v3 לשיבוט, **הצמדת פנים↔דובר לפי הופעה משותפת**, לוקליזציה של טקסט על המסך, שרת MCP מקומי, ייצוא רב־שפתי עם ירושת עריכות. מעניין כמודל מוצר.
- **PersoDub** ([ארכיטקטורה](https://github.com/stronghamjji/PersoDub/blob/main/docs/architecture.md)) — ה**מפורט והבוגר ביותר** בנושא התאמה:
  1. הפרדה (Mel-Band RoFormer/Demucs) → 2. Whisper + CAM++ דוברים, **הזזת תחילת כל שורה לתחילת הדיבור האמיתי על רצועת הווקאל** → 3. תרגום LLM **עם כלל אורך ±15% לחלון** ושאילה מחדש לשורות שפספסו (`length_fit.py`) → 4. סינתזה: **רפרנס 4–7 שניות לדובר**, מצב מהיר (האזנה חוזרת ע"י ASR ו־retake) או איכות גבוהה (N טייקים וסקורר בוחר), **`pace_fit`** שמנסח מחדש שורות קצרות/ארוכות מדי לקצב הדיבור **הנמדד** של הדובר, התאמת עוצמה למקור, האצה עד 10% בשמירת גובה ואז **חיתוך** (נרשם) → 5. **שער זליגה (leakage gate)** שמודד קול מקורי שנשאר מתחת לדיבוב ומבטל הדהודים → 6. מוקס.
  - **הלקח הכי חשוב:** מטפלים בשלושת ה"חטאים": *נשימות/צחוק* (מוכנסים מהמקור רק אם Whisper מאשר שאין בהם מילים), *זליגת קול מקורי*, *קצב לפי דובר*.
- **langswap:** ASR → תרגום LLM → TTS משובט → `speedup` או `stretch_whole`. קטן ושקוף, AGPL.

### 2.9 האחרים
- **KrillinAI/OpenCreator:** README מציג דיבוב כחלק מ־Video Translation (תמלול ענן/מקומי, פיצול LLM, מונחון), ושאר ה"סביבה" (תמונות, אווטרים) — לא רלוונטי לליבה.
- **Voice-Pro:** אוסף Gradio — Whisper/Demucs/F5/E2/CosyVoice; בלי מנגנון משך. GPL-3.0.
- **Pandrator:** קריינות ספרים וכתוביות, "Cast" לדוברים — בעיקר השראה לממשק בדיקה.
- **Sosie:** סטודיו הקלטה וקריינות; רעיונות שימושיים: **כל משפט נדגם כמה פעמים ו־Whisper בודק, הטוב נשמר**; WSOLA לשינוי משך ללא שינוי גובה; "רצועת רית'מו" כממשק לדבבים אנושיים; תשלום `words.json` עם זמני מילים.
- **Wav2Lip / LatentSync / MuseTalk / video-retalking:** שפתיים — ראו סעיף 7.

---

## 3. תמיכה בעברית — מצב ה"קוד הפתוח הקיים"

| נושא | מצב |
|---|---|
| **קלט עברית (ASR)** | כל הכלים המבוססים Whisper מכסים בסיסית. **אף אחד** לא משלב ivrit-ai (אצלנו כבר קיים) או מודל עברי ייעודי — יתרון לנו. |
| **פלט עברית (TTS+שיבוט)** | רוב מנועי השיבוט המובילים **לא תומכים בעברית** (IndexTTS2.5: zh/en/ja/es/ar; CosyVoice: 9 שפות ללא עברית; Qwen3-TTS בסיס ללא עברית). יוצא דופן: **[Chatterbox Multilingual V3](https://github.com/resemble-ai/chatterbox) (MIT) — `he` ברשימת 23 השפות** (איכות שיבוט בעברית: [בדיקה חיצונית דירגה "Poor" בגרסה מארחת](https://github.com/danielrosehill/Hebrew-TTS-Providers) — לבדוק בעצמנו). פרויקטי ה־Hebrew: [Phonikud](https://phonikud.github.io/explore.html) (G2P עברי), [QwenTTS-he-1.7B](https://huggingface.co/notmax123/QwenTTS-he-1.7B) (LoRA על Qwen3-TTS, Apache), [NeuTTS-Air-he](https://huggingface.co/flowty1/neutts-air-he), [voxtream2-he](https://huggingface.co/flowty1/voxtream2-he). **לא רלוונטי לכיוון עברית→אנגלית**, אבל קריטי לכיוון ההפוך. |
| **RTL/ניקוד** | אין פרויקט שמתעד טיפול ב־RTL בכתוביות שרופות או בניקוד. Phonikud מוסיף ניקוד/G2P ל־TTS בלבד. |
| **כיוון עברית→אנגלית (שלנו)** | **לא קיים בשום פרויקט כזרימה מיוחדת.** המסלול: ASR עברי אצלנו (חזק מהקיים) ← תרגום Claude ← TTS אנגלי עם שיבוט. אנגלית נתמכת בכל המנועים — אין חסם. |

---

## 4. איך כל אחד מטפל בתזמון — מיון שיטות (מהחלשה לחזקה)

1. **האצה גסה** (`atempo`, WSOLA) ללא שינוי טקסט — SoniTranslate, Linly, pyVideoTrans, Voice-Pro. תוצאה: דיבור "מתנשף".
2. **האטת וידאו** להתאמה — pyVideoTrans (אופציה). פוגע בסנכרון שפתיים/מוזיקה.
3. **הסרת שתיקת סוף של TTS** + מגבלות האצה — open-dubbing.
4. **סינתזה בשני מעברים** (קצב מחושב) — ThioJoe.
5. **קיצור תרגום ב־LLM לפי הערכת משך + מיזוג שורות + האצה מוגבלת** — VideoLingo.
6. **תרגום עם יעד אורך ±15% ואימות חוזר + קצב לפי דובר + האצה מקסימלית 10% + חיתוך מתועד** — PersoDub.
7. **TTS עם שליטה מפורשת במשך** (IndexTTS2: מצב "מספר טוקנים" קבוע) — [המאמר](https://arxiv.org/abs/2506.21619) מתמקד בדיוק בבעיית הדיבוב; **נכון להיום רק OpenDub משתמש בו**, ובלי עברית. רישיון [bilibili](https://github.com/index-tts/index-tts/blob/main/LICENSE) (מסחרי דרך פנייה לחברה).
8. **ספרות אקדמית** שאף פרויקט אינו מיישם במלואו: [Isochrony-aware NMT](https://arxiv.org/pdf/2112.08548), [VideoDubber](https://arxiv.org/pdf/2211.16934) (אורך בדיבור לא בתווים), [תרגום מבוסס־משך עם LLM (EMNLP 2025 demo)](https://aclanthology.org/2025.emnlp-demos.37), [IsoChronoMeter](https://arxiv.org/html/2410.11127v1) (מדד).

---

## 5. הצנרת הטובה ביותר שאפשר להרכיב מחלקים פתוחים

עיקרון: **לא אימוץ פרויקט אחד — הרכבה של "הרעיון הטוב ביותר" מכל שלב**, כשאנחנו שומרים על מה שכבר קיים (ivrit-ai, ECAPA, Claude, הפרדת ווקאל, יישור זמנים).

| שלב | בחירה | מקור ההשראה | רישיון |
|---|---|---|---|
| 1. הפרדת רקע | MelBand-RoFormer / BS-RoFormer (+ Demucs כגיבוי), **שער זליגה** בסוף | PersoDub, OpenDub | MIT (python-audio-separator) / בדיקת משקולות |
| 2. ASR+יישור | **ivrit-ai whisper (קיים)** + יישור ברמת מילה (CTC עברי קיים) ; אופציה Qwen3-ForcedAligner לשפות אחרות | VideoLingo/OpenDub | MIT/Apache |
| 3. דוברים | pyannote 3.1 / Nemotron Diarization + **ECAPA (קיים)**; **הזזת תחילת שורה לתחילת הדיבור בפועל** | PersoDub (`onset`) | MIT (pyannote) |
| 4. תרגום | **Claude** עם: מונחון, "חלון ±15%" לפי הערכת משך **בקצב הדובר הנמדד**, reflect/adapt, שאילה חוזרת לשורות חורגות, מיזוג שורות סמוכות | VideoLingo + PersoDub + VideoDubber | שלנו |
| 5. רפרנס קול | **4–7 שניות לכל דובר** נקי (אחרי הפרדה) + **רפרנס רגש פר־משפט נפרד** | PersoDub + YouDub + OpenDub | — |
| 6. TTS/שיבוט | מנוע ראשי לאנגלית: **Chatterbox-Multilingual (MIT)** או **Qwen3-TTS/Higgs (Apache)**; רשימת מועמדים לבדיקת מבטא; IndexTTS2 כשצריך בקרת משך — **לאחר ביקור משפטי** | — | ראו סעיף 7 |
| 7. התאמת משך | (א) תרגום מקוצר, (ב) סינתזה עם בקרת קצב, (ג) **N טייקים + בחירה ע"י ASR/סקורר**, (ד) WSOLA/האצה **עד 8–10% בלבד** | PersoDub, Sosie, ThioJoe | — |
| 8. שכבת מבטא | TTS אנגלי "נקי" + אופציית **המרת קול** (OpenVoice-v2/Seed-VC/RVC) שמעבירה *רק* צבע קול, לא מבטא | SoniTranslate | MIT / GPL (Seed-VC) |
| 9. נשימות/צחוק | הכנסה מהמקור **רק** אחרי אימות Whisper שאין מילים; אחרת נשימות סינתטיות | PersoDub | — |
| 10. מיקס | רקע + דיבוב, התאמת LUFS לכל שורה למקור, ducking | PersoDub | — |
| 11. שפתיים (אופציונלי, פרימיום) | LatentSync (Apache) / MuseTalk (MIT) — רק בקלוז־אפ | ViDubb, Dub Studio | בדיקת משקולות |
| 12. עורך | עריכת שורה בודדת ("רק היא מתבצעת מחדש"), ציר זמן, סוכן עריכה (MCP) | PersoDub, Dub Studio, OpenDub | — |
| 13. QA אוטומטי | ASR על הדיבוב ← WER מול התרגום; זיהוי חיתוכים; דירוג התאמת משך ו"דמיון קול" (ECAPA כמדד) | PersoDub scorer | — |

---

## 6. בעיות שאף אחד לא פתר טוב — הזדמנות

1. **כיוון עברית↔אנגלית כמוצר:** ASR עברי טוב + תרגום מותאם־משך + TTS אנגלי עם **מבטא אנגלי תקין** לדובר עברי. אין שום כלי כזה. (בעיית ה"מבטא תואם לשפת היעד": כל המנועים משכפלים את הרפרנס כולל מבטא; פתרון = הפרדת *טימברה* מ*פרוזודיה/מבטא* — IndexTTS2 ו־Vevo/Amphion מתקרבים. נדרש מחקר נפרד.)
2. **דוברים חופפים / crosstalk** — כל ה־diarization מקצה דובר אחד לכל פרק זמן; אף כלי לא מפרק ורצועות חופפות או מייצר דיבוב חופף. (OpenDub מתיר חפיפה בפלט אך לא מטפל בקלט.)
3. **שימור רגש ואינטונציה** — YouDub/OpenDub/ViDubb מנסים; אין מדד איכות. רעיון: רפרנס רגש פר־משפט + מדד prosody.
4. **זליגת קול מקורי מתחת לדיבוב** ו**חפצים בהפרדה** — רק PersoDub מודד. נקודת איכות קריטית ליוצרי תוכן.
5. **נשימות, צחוק, "אממ", מילות מילוי** — כמעט כולם מוחקים או משאירים שתיקה; שימור לא־מילולי ממוקם נכון הוא פער.
6. **קצב לפי דובר + דינמיקת דיבור** (מהיר/לאט בהתלהבות) — pace_fit של PersoDub הוא ההתחלה היחידה.
7. **מספרים, שמות, מונחים וטקסט על המסך** — Dub Studio מתחיל בלוקליזציה של טקסט על המסך; בשאר — פער.
8. **איכות אמיתית מול תרגום אנושי** — אין בנצ'מרק פתוח לדיבוב; אנחנו כבר בונים כלי למידה מול תרגום אנושי (`learn-vs-human`) — אפשר להרחיב לדיבוב.
9. **ריבוי שפות יעד בבת אחת עם שימור עריכות** — Dub Studio בלבד.
10. **ממשק לקוח קצה/דפדפן** — כולם Electron/Gradio/CLI מקומיים; **אף אחד לא PWA/ענן רב־משתמשים עם תור ופיקוח** — מה שיש לנו (מגדל פיקוח).
11. **RTL וכתוביות עבריות** — לא מטופל ברצינות בשום כלי.
12. **סכנות משפטיות** (הסכמה לשיבוט קול, סימון מים) — Chatterbox מוסיף watermark (Perth); אצל כל השאר אין שכבת הסכמה. (ראו מסמך נפרד על זכויות.)

---

## 7. מה מותר לנו לשלב מסחרית — לפי רישיון

מקרא: ✅ מותר לשילוב/קריאה · ⚠️ בתנאים / לבדוק משפטית · ⛔ לא לשלב (למידה בלבד)

> כלל־אצבע: **אנחנו מפעילים שירות רשת (SaaS/PWA) על שרתים שלנו.** רישיון **AGPL** מחייב פרסום קוד גם לשירות רשת — ולכן ⛔ לשילוב קוד, ו־GPL חל על הפצת התוכנה (שירות שרת פחות מחייב, אך לא נסתכן; מיזוג עם קוד קנייני אסור). **משקולות** מוסדרות בנפרד.

### קוד פרויקטים (למידה בלבד לפי ההנחיה; סימון למקרה של שילוב עתידי)
| פרויקט | רישיון | סטטוס |
|---|---|---|
| VideoLingo, SoniTranslate, Linly, YouDub, open-dubbing, ViDubb, KrillinAI/OpenCreator | Apache-2.0 | ✅ (שומרים NOTICE; לבדוק שאין תלות GPL) |
| Pandrator, OpenDub, Sosie, SmartSub, video-translator | MIT | ✅ |
| pyVideoTrans, Voice-Pro | **GPL-3.0** | ⛔ לא לשלב קוד |
| ThioJoe, PersoDub, langswap, VoiceStudio | **AGPL-3.0** | ⛔ (langswap מציעה רישיון מסחרי בתשלום) |
| Dub Studio | לא מוגדר (NOASSERTION) | ⛔ עד הבהרה |

### רכיבים (מודלים/ספריות)
| רכיב | קוד | משקולות/מגבלה | סטטוס |
|---|---|---|---|
| faster-whisper, WhisperX | MIT / BSD-2 | MIT | ✅ |
| pyannote 3.1 | MIT | מודלים gated (קבלת תנאים, מותר) | ✅/⚠️ |
| python-audio-separator / UVR | MIT | משקולות מסוימות ב־UVR לא מסחריות — לבדוק כל מודל | ⚠️ |
| Demucs | MIT (ארכיון) | MIT | ✅ |
| **Chatterbox (+ Multilingual V3)** | MIT | MIT; מוסיף watermark | ✅ — **תומך עברית** |
| Qwen3-TTS, Higgs Audio, VoxCPM, Zonos, Kokoro, NeuTTS (בסיס) | Apache-2.0 | Apache; לוודא כל גרסת fine-tune | ✅ |
| CosyVoice 2/3 | Apache-2.0 | Apache (נבדק README) | ✅ |
| F5-TTS | MIT | **משקולות CC-BY-NC (Emilia)** | ⛔ משקולות רשמיות |
| XTTS (Coqui) | MPL-2.0 קוד | **CPML לא מסחרי**; החברה נסגרה | ⛔ |
| **IndexTTS2/2.5** | רישיון bilibili | מסחרי רק בפנייה לחברה; איסור שימוש ב־outputs לאימון מודלים אחרים | ⚠️ |
| **Fish-speech / OpenAudio** | Fish Audio Community License (15/10/2026) | חינם למחקר/אישי; **מסחרי רק מתחת לסף הכנסות/ בהסכם** | ⚠️ |
| OmniVoice | Apache | **משקולות NC** (לפי VoiceStudio ו־langswap) | ⛔ |
| GPT-SoVITS | MIT | משקולות על דאטה מעורב — לבדוק | ⚠️ |
| OpenVoice v2 | MIT | MIT | ✅ |
| RVC | MIT | מודלי בסיס — לבדוק | ⚠️ |
| Seed-VC | **GPL-3.0** (ארכיון) | — | ⛔ |
| ChatTTS | **AGPL-3.0** | משקולות NC | ⛔ |
| Amphion (Vevo וכו') | MIT | חלק מהמודלים NC — לבדוק מודל־מודל | ⚠️ |
| Seamless / Seamless Expressive (Meta) | רישיון Seamless | **מחקרי בלבד, לא מסחרי** ([פרטים](https://scancode-licensedb.aboutcode.org/seamless-2023.json)) | ⛔ |
| NVIDIA NeMo (Speech) | Apache-2.0 | Parakeet/Nemotron — רישיונות מודל נפרדים (CC-BY-4 / NVIDIA Open Model) | ⚠️ לבדוק |
| LatentSync | Apache-2.0 | Apache | ✅ |
| MuseTalk | MIT | MIT | ✅ |
| Wav2Lip | ללא רישיון ברור (מחקרי) | NC | ⛔ |
| ivrit-ai (מודלי Whisper עבריים) | MIT | לאמת לכל מודל | ✅/⚠️ |

---

## 8. הערות מתודולוגיות ואזהרות

- **VoiceStudio — 118K כוכבים:** נתון חריג מאוד לפרויקט כזה; ייתכן ניפוח/אנומליה או שינוי שם של פרויקט גדול. לא להסתמך עליו כאינדיקטור איכות; הרישיון AGPL ממילא חוסם שילוב.
- **YouDub-webui** כריפו ישן הוחלף ב־Desktop (אותו README); המספרים של Desktop.
- **KrillinAI** שונה ל־OpenCreator ומתרחב לתחומים אחרים — לא "פרויקט דיבוב" נקי.
- מספר "כוכבים" מדגים אימוץ, לא איכות. אין בנצ'מרק פתוח משווה — **ההמלצה: סט זהב קצר (5 קליפים עבריים ממגוון: דובר יחיד, שני דוברים, רקע מוזיקלי, מהיר, יוצר תוכן) והשוואת שמיעה עיוורת של 3 TTS מועמדים**.
- דבר שדורש אימות לפני החלטות: איכות Chatterbox-he בפועל, מבטא אנגלי של Chatterbox/Qwen3/Higgs ברפרנס עברי, משקולות מדויקות ורישיונות של כל מודל (בקובצי Hugging Face), וזמני ריצה על CPU של Hetzner (רוב המנועים החדשים דורשים GPU — ייתכן ספק GPU חיצוני לשלב ה־TTS).

## 9. מקורות עיקריים
[pyVideoTrans](https://github.com/jianchang512/pyvideotrans) · [VideoLingo](https://github.com/Huanshere/VideoLingo) · [OpenCreator/KrillinAI](https://github.com/krillinai/OpenCreator) · [SoniTranslate](https://github.com/R3gm/SoniTranslate) · [open-dubbing](https://github.com/Softcatala/open-dubbing) · [Linly-Dubbing](https://github.com/Kedreamix/Linly-Dubbing) · [ViDubb](https://github.com/medahmedkrichen/ViDubb) · [YouDub](https://github.com/liuzhao1225/YouDub-webui) · [Voice-Pro](https://github.com/abus-aikorea/voice-pro) · [ThioJoe](https://github.com/ThioJoe/Auto-Synced-Translated-Dubs) · [Pandrator](https://github.com/lukaszliniewicz/Pandrator) · [OpenDub](https://github.com/estebanstifli/OpenDub) · [Dub Studio](https://github.com/timoncool/dub-studio) · [PersoDub](https://github.com/stronghamjji/PersoDub) · [langswap](https://github.com/langswap-app/langswap) · [VoiceStudio](https://github.com/debpalash/VoiceStudio) · [Sosie](https://github.com/damienlaine/sosie) · [SmartSub](https://github.com/buxuku/SmartSub) · [Chatterbox](https://github.com/resemble-ai/chatterbox) · [IndexTTS](https://github.com/index-tts/index-tts) · [Fish-speech](https://github.com/fishaudio/fish-speech) · [F5-TTS](https://github.com/SWivid/F5-TTS) · [CosyVoice](https://github.com/FunAudioLLM/CosyVoice) · [סקירת pyVideoTrans](https://www.promptquorum.com/power-local-llm/pyvideotrans-review) · [IndexTTS2 (arXiv)](https://arxiv.org/abs/2506.21619) · [Hebrew TTS Providers](https://github.com/danielrosehill/Hebrew-TTS-Providers)
