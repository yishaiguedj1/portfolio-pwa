# קטלוג מודלים פתוחים לדיבוב — רישיונות מאומתים (25/11/2026)

שיטה: רישיון משקולות = `cardData.license` ו־README ב־Hugging Face (`curl https://huggingface.co/api/models/<id>`); רישיון קוד = קובץ LICENSE ב־GitHub (`raw.githubusercontent.com/<o>/<r>/HEAD/LICENSE`). סימון: **[V]** אומת ממקור ראשוני בסשן זה · **[?]** לא אומת / מידע חלקי. אין כאן ייעוץ משפטי; לפני שימוש מסחרי בפועל לקרוא את הרישיון המלא.

**כלל החשוב ביותר:** רישיון הקוד לא קובע. כמעט כל מודל "MIT/Apache" על GitHub משוחרר עם משקולות CC-BY-NC בגלל נתוני Emilia (101 אלף שעות, CC BY-NC 4.0 [V: כרטיס הדאטהסט]). Emilia-YODAS (114 אלף שעות) הוא CC BY 4.0 [V].

## 1. TTS עם שיבוט zero-shot

| מודל | קוד | משקולות | מסחרי? | שפות (עברית?) | הערות מאומתות |
|---|---|---|---|---|---|
| **VoxCPM2** (OpenBMB, 04/2026) | Apache-2.0 [V] | Apache-2.0 [V] | **כן** | 30 שפות, **כולל עברית ואנגלית** [V] | 2B פרמטרים, 48kHz, אימון 2M+ שעות (מקור הנתונים לא פורט [?]); "Controllable Cloning" (הנחיית סגנון/קצב בטקסט בסוגריים) שומר גוון; RTF 0.30 על RTX 4090 (0.13 עם Nano-vLLM) [V]; מותר באיסור התחזות [V]. אין מידע על CPU [?] |
| **ZONOS3-Mini** (Zyphra, 17/11/2026) | Apache-2.0 [V: Zonos], ריפו ZONOS3-Mini [?] | Apache-2.0 [V] | **כן** | 43 שפות **כולל עברית ואנגלית** [V] | ~100M פרמטרים פעילים (800M סה"כ MoE), 44.1kHz, שיבוט מקליפ עד 60 שניות או מהטמעת דובר, **בקרת קצב דיבור (בתים לשנייה, 30 דליים)**, בקרת עוצמה, **היגוי מבטא ("Same speaker, three accents")** [V]; runtime ב־ggml ל־**CPU** [V]; זמן עד אודיו ראשון 80ms על H100 [V]. נתוני אימון ו־RTF על CPU [?] — דורש מדידה |
| **MOSS-TTS v1.5** (OpenMOSS) | Apache-2.0 [V: דף HF] | Apache-2.0 [V] | **כן** | 31 שפות, כולל עברית [V] | שיבוט zero-shot, **בקרת משך ברמת טוקן**, בקרת IPA [V]; נתוני אימון [?]. גרסת Nano-100M (Apache, 20 שפות כולל עברית) [V] — מועמד ל־CPU |
| **Chatterbox** (Resemble) | MIT [V] | MIT [V] | כן | Multilingual V3: 23 שפות **כולל עברית** [V]; Turbo/Nano: אנגלית | **"retired" מאוגוסט 2026, ללא תחזוקה** [V: README]; 0.5M שעות; **חותמת מים PerTh מובנית** (קוד MIT, ניתן להסרה טכנית; החלטה מוצרית) [V]; **דליפת מבטא מאומתת מ־README**: "language transfer outputs may inherit the accent of the reference clip's language; set cfg_weight to 0" [V]; Nano 110M ל־CPU: פי 3 מזמן אמת על 8 ליבות (אנגלית בלבד) [V]; בקרת רגש `exaggeration` [V] |
| **Qwen3-TTS** (Alibaba, 01/2026) | Apache-2.0 [V] | Apache-2.0 [V] | כן | 10 שפות: zh/en/ja/ko/de/fr/ru/pt/es/it — **אין עברית** [V] | שיבוט 3 שניות (דורש תמלול הרפרנס); שליטה בטון/קצב בהוראות [V]; **ב־Hebrew→English: ההפרדה בין רפרנס עברי ליעד אנגלי לא נבדקה [?]**; אין חוצה־שפות מפורש בכרטיס |
| **Fun-CosyVoice3-0.5B-2512** | Apache-2.0 [V] | Apache-2.0 [V] | כן | 9 שפות + ניבים סיניים, **אין עברית** [V] | יש `inference_cross_lingual` ו־`inference_vc` בקוד [V]; הוראות (רגש/קצב/עוצמה) [V]; CosyVoice2-0.5B: Apache [V]. נתוני אימון [?] |
| **IndexTTS-2** / **2.5** | bilibili Model Use License [V] | אותו רישיון [V] | **כן, בתנאים** | 2: en/zh; 2.5: zh/en/ja/es/ar [V]. אין עברית | מותר מסחרית אלא אם >100M משתמשים חודשיים או הכנסות >1 מיליארד RMB; **אסור להשתמש בפלט לשיפור/אימון מודל AI אחר** (חוץ מלא־מסחרי); ללא הגבלת תחום; **בקרת משך מפורשת** (`duration_factor`) ו־רגש מופרד מגוון (וקטור 8 רגשות) [V]; "cross-lingual voice transfer" [V] |
| **Higgs Audio v2** (Boson) | Apache-2.0 [V] (קוד) | Boson Higgs Audio 2 Community License (מבוסס Llama-3 Community) [V שם; תנאים מלאים [?]] | **[?]** — לקרוא את הסף | אנגלית בעיקר [?] | המזהה עבר ל־`bosonai/higgs-tts-2-3b-base` [V] |
| **Higgs TTS v3 (4B)** | — | **מחקר ולא־מסחרי בלבד** [V] | **לא** לשירות דיבוב: סעיף II-A.c.iii אוסר במפורש שילוב ב"dubbing product or service" גם ליוצרים; מותר ליוצר לפרסם תוכן שיצר בעצמו על ערוצים שלו עם ייחוס [V] | | |
| **Fish Speech / Drama-3** (Fish Audio) | Fish Audio Community License v1.0 (13/10/2026) [V] | Drama-3: אותו רישיון; **S2-Pro ו־s1-mini: Research/CC-BY-NC-SA — לא מסחרי** [V] | **מותנה**: מסחרי רק כל עוד הכנסה שנתית < **500,000 דולר**; אסור "Hosted Service" (שירות self-serve ללקוחות); **פטור מפורש**: סטודיו/סוכנות שמפעיל את המודל ומוסר ללקוח רק פלט מוגמר (דיבוב/ספר שמע) [V]; אסור לאמן/לזקק מודל אחר מהפלט; אסור לחקות אדם מזוהה בלי הסכמה | 80+ שפות כולל עברית (תגי HF) [V] | חריג שימושי רק לגרסת "שירות מנוהל" ולא כלי self-serve |
| **OmniVoice** (k2-fsa, 03/2026) | Apache-2.0 [V] | **CC-BY-NC** "בגלל Emilia" [V: README] | **לא** | 600+ שפות כולל עברית [V] | RTF עד 0.025 (GPU) [V]; מתאים למחקר/אב־טיפוס בלבד |
| **F5-TTS** / E2 | MIT [V] | **CC-BY-NC-4.0** (Emilia) [V] | **לא** | | |
| **MaskGCT**, **Vevo**, **Vevo1.5/2** (Amphion) | MIT (Amphion) [V] | MaskGCT/Vevo: CC-BY-NC-4.0; **Vevo1.5/Vevo2: CC-BY-NC-ND-4.0** [V] | **לא** | | |
| **ZipVoice** (k2-fsa) | Apache [V] | CC-BY-NC (Emilia) [V] | **לא** | | |
| **Spark-TTS** | Apache-2.0 [V] | **CC-BY-NC-SA-4.0** [V] | **לא** | en/zh | |
| **Llasa-3B** | אין LICENSE בריפו [V] | CC-BY-NC-4.0 [V] | **לא** | | |
| **XTTS-v2** | MPL-2.0 [V] | Coqui Public Model License (לא מסחרי) [V] | **לא** | 17 שפות כולל עברית | Coqui נסגרה |
| **Voxtral-4B-TTS** (Mistral) | — | CC-BY-NC-4.0 (בגלל קולות רפרנס) [V] | **לא** | 9 שפות | |
| **IndexTTS-1.5** | — | Apache-2.0 [V] | כן | en/zh [?] | ישן; לא חוצה־שפות לעברית |
| **Sesame CSM-1b** | Apache-2.0 [V] | Apache-2.0 [V] | כן | אנגלית [V] | שיבוט ע"י הקשר; בקרת משך חלשה [?] |
| **Dia-1.6B** | Apache-2.0 [V] | Apache-2.0 [V] | כן | **אנגלית בלבד** [V] | שיבוט דרך תמלול+אודיו; לא לדיבוב |
| **Orpheus-3B-ft** | Apache-2.0 [V] | Apache-2.0 [V] (בסיס Llama [?]) | כן [?] | אנגלית | שיבוט zero-shot לא מובנה בגרסת ft [?] |
| **Zonos-v0.1** (transformer/hybrid) | Apache-2.0 [V] | Apache-2.0 [V] | כן | en/fr/de/ja/zh [?]; 200k+ שעות | מוחלף ע"י ZONOS3-Mini |
| **VibeVoice-1.5B** | MIT [V] | MIT [V] | **טכנית כן, אך "מחקר בלבד, לא מומלץ לשימוש מסחרי"** [V: README] | en/zh בלבד | לא מתאים |
| **MegaTTS3** | Apache-2.0 [V] | Apache-2.0 [V] | כן | en/zh | **מקודד WaveVAE לא פורסם — אי אפשר לשבט קולות חדשים** [V] |
| **StyleTTS2** | MIT [V] | משקולות LibriTTS: רישיון לא מוצהר בכרטיס [?] | [?] | אנגלית | |
| **Kokoro-82M** | Apache [V] | Apache [V] | כן | אנגלית (+) | **אין שיבוט** [V]; מצוין ל־CPU; בסיס לשלב "אנגלית ילידית" ואז VC |
| **MeloTTS** | MIT [V] | MIT [V] | כן | en/es/fr/zh/ja/ko | אין שיבוט; בסיס של OpenVoice |
| **Step-Audio-EditX** (3B) | Apache-2.0 [V] | לא הוצהר ב־HF [?] | **[?]** | zh/en/ja/ko | עריכת רגש/סגנון של אודיו קיים [V] |
| **Ming-3.0-tts-0.5B** | — | MIT [V] | כן | zh/en/de/es/fr/ko/ja | לא נבדק שיבוט [?] |
| **Edge0/Audio8-TTS-Realistic-Air** | — | Apache-2.0 (תג HF) [V] | **[?]** — צד שלישי לא מוכר, יש לבדוק מקור | 22 שפות, אין עברית | |
| **Kani-TTS-2** | — | LFM 1.0 (Liquid AI) [V תג] | מותנה בסף הכנסה [?] | אנגלית | |
| **Breeze-TTS-2** | — | Research/Non-commercial [V] | **לא** | | |
| **Supertonic-3** | — | OpenRAIL [V תג] | [?] | 31 שפות, אין עברית; אין שיבוט [?] | |
| **Kyutai TTS 1.6B** | — | CC-BY-4.0 [V] | כן | en/fr | שיבוט הוסר מהמהדורה [?] |

## 2. המרת קול (VC)

| מודל | קוד | משקולות/תלויות | מסחרי? | הערות |
|---|---|---|---|---|
| **OpenVoice V2** (tone color converter) | MIT [V] | MIT [V] | **כן** ("Free commercial use" ב־README) [V] | חוצה־שפות, "הרפרנס לא צריך להיות בשפת הפלט" [V]; משמש להמרת גוון על פלט TTS אנגלי ילידי (מסלול ב). איכות שיבוט נמוכה יחסית לדור 2026 [?] |
| **Seed-VC** (Plachta) | אין קובץ LICENSE ב־raw [V]; תג HF = **GPL-3.0** [V] | | **GPL-3.0 — copyleft**: שימוש בשרת פנימי (בלי הפצה) בדרך כלל אפשרי, אך תלויות/משקולות לא נבדקו [?] | zero-shot, real-time, singing [?] |
| **RVC** | MIT [V] | דורש אימון לפי דובר (לא zero-shot); משקולות בסיס (HuBERT/RMVPE) [?] | כן (קוד) | לא מתאים לשיבוט מקליפ קצר |
| **so-vits-svc** | **AGPL-3.0** [V] | | AGPL — בעייתי לשירות רשת | |
| **FreeVC** | MIT [V] | WavLM [?] | כן [?] | איכות ישנה (2022) |
| **kNN-VC** | MIT [V] | WavLM+HiFiGAN; דאטה LibriSpeech [?] | כן | פשוט, CPU אפשרי [?] |
| **CosyVoice VC** | Apache [V] | Apache [V] | כן | `inference_vc(source, prompt)` [V] |
| **Chatterbox VC** | MIT [V] | MIT [V] | כן | `example_vc.py` [V]; פרויקט ארכיוני |
| **Vevo** | MIT | CC-BY-NC(-ND) [V] | **לא** | |

## 3. דיבור לדיבור

| מודל | קוד | משקולות | מסחרי? | הערות |
|---|---|---|---|---|
| **Hibiki (1B/2B)** | [?] | **CC-BY-4.0** [V] | כן | **FR→EN בלבד**, שימור קול [V] |
| **Hibiki-Zero (3B)** | MIT [V] | **CC BY-NC-SA 4.0** [V] | **לא** | fr/es/pt/de→en; אין עברית |
| **SeamlessExpressive** | CC-BY-NC [V] | Seamless License + AUP [V] | **לא** | en/es/it/de/zh (+fr) — אין עברית |
| **SeamlessM4T v2** | CC-BY-NC [V] | CC-BY-NC-4.0 [V] | **לא** | |
| **StreamSpeech** | MIT [V] | משקולות HF: רישיון לא נבדק [?] | [?] | fr/es/de→en, בלי שימור קול; נתוני CVSS |

הערה: אף מודל S2ST פתוח ומאומת מסחרית אינו מכסה עברית→אנגלית עם שימור קול; הצנרת המודולרית (ASR→MT→TTS→VC) נשארת הדרך.

## 4. סנכרון שפתיים

| מודל | קוד | משקולות | מסחרי? | הערות |
|---|---|---|---|---|
| **MuseTalk** | MIT [V] | MIT, "available for any purpose, even commercially" [V]; רכיבים חיצוניים (whisper, ft-mse-vae, dwpose, S3FD) לפי רישיונם [V]; **נתוני הבדיקה לא־מסחריים** [V] | **כן** | זמן אמת על GPU [?] |
| **LatentSync 1.5/1.6** | Apache-2.0 [V] | **OpenRAIL++** [V] | כן, עם הגבלות שימוש | InsightFace (זיהוי פנים) משמש בעיבוד מקדים [V]; רישיון משקולות InsightFace buffalo לא־מסחרי [?] — לבדוק לפני הפעלה |
| **Wav2Lip** | אין LICENSE [V] | "research/academic/personal only" [V] | **לא** (גרסה מסחרית בתשלום של היוצרים) | |
| **Diff2Lip** | אין LICENSE [V] | [?] | **לא** | |
| **VideoReTalking** | Apache-2.0 [V] | תלויות [?] | [?] | |
| **LivePortrait** | MIT [V] | משקולות HF לא נבדקו (שגיאת API) [?]; תלות InsightFace [?] | [?] | אנימציית פנים, לא סנכרון שפתיים אודיו |
| **Hallo3** | MIT [V] | MIT, **אך נגזרת CogVideoX-5B ותלויה ברישיונו** [V] | [?] | כבד, מחקרי |

## 5. הפרדת מקורות והצנרת

| רכיב | קוד | משקולות | מסחרי? |
|---|---|---|---|
| **Demucs / HTDemucs** (adefossez) | MIT [V] | MIT לפי הריפו (לא נבדק קובץ נפרד לצ'קפוינט) [?] | כן. SDR 9.00dB ב־MUSDB [V] |
| **BS-RoFormer** (lucidrains) | MIT [V] (ארכיטקטורה בלבד) | משקולות מקהילה — **כל צ'קפוינט שונה**: melbandroformer MIT [V]; `anvuew/BS-RoFormer` **GPL-3.0** [V]; אחרים (UVR/MVSEP) [?] | לבדוק צ'קפוינט־צ'קפוינט |
| **MelBand-RoFormer** (KimberleyJSN) | | MIT [V] | כן |
| **ZFTurbo/Music-Source-Separation-Training** | MIT [V] | לפי צ'קפוינט | |
| **Bandit** (cinematic: דיבוב/מוזיקה/אפקטים) | Apache-2.0 [V] | ב־Zenodo; רישיון לא אומת [?]; אימון על DnR | **[?]** |
| **pyannote** | MIT [V] | speaker-diarization-3.1 ו־segmentation-3.0: MIT [V]; **community-1: CC-BY-4.0** [V]; wespeaker: CC-BY-4.0 [V]; כולם gated (קבלת תנאים ב־HF) | כן |
| **WhisperX** | BSD-2 [V] | יישור עברית: `imvladikon/wav2vec2-xls-r-300m-hebrew` (WER 23.18, **רישיון לא מצוין בכרטיס [?]**) [V] | להחליף/לאמת |
| wav2vec2-xlsr-53-espeak-cv-ft (יישור פונמי) | | Apache-2.0 [V] | כן |

## 6. בנצ'מרקים ו־TTS Arena

- אומת רק: ארנה של Artificial Analysis מדרגת את **Fish Audio S2 Pro** כמודל open-weights הגבוה ביותר (Elo ~1121) — אך הוא **לא מסחרי** (חיפוש רשת, לא אומת בדף ישירות). Step-Audio-EditX ו־Voxtral TTS בדירוג גבוה [חיפוש רשת]; אף אחד מ־VoxCPM2, OmniVoice, Qwen3-TTS, ZONOS3, MOSS לא נמצא בלוח [לא אומת]. אין להסתמך על בלוגים מצטטים (נתונים סותרים).
- מספרי SIM/WER לא נאספו מכרטיסים (VoxCPM2 מפנה לטבלאות ב־GitHub; ZONOS3 מפנה ל־ZTTS2-Eval שבפוסט הבלוג). **נדרש מבחן פנימי** של Hebrew→English על 20 דוברים.

## 7. המועמדים הטובים ביותר שמותרים מסחרית

**(א) TTS חוצה־שפות ישיר (רפרנס עברי → פלט אנגלי):**
1. **VoxCPM2** (Apache/Apache, 2M שעות, עברית ואנגלית, שיבוט מבוקר) — מועמד ראשון למדידה.
2. **MOSS-TTS v1.5** (Apache/Apache, עברית, בקרת משך ברמת טוקן — קריטי לדיבוב).
3. **ZONOS3-Mini** (Apache/Apache, עברית, בקרת קצב ומבטא).
4. **Chatterbox Multilingual V3** (MIT/MIT; ארכיוני; יש דליפת מבטא מתועדת, פתרון `cfg_weight=0`; חותמת מים).
5. **IndexTTS-2/2.5** (בעל בקרת משך ורגש הטובה ביותר, מסחרי בתנאי bilibili, אך בלי עברית ועם איסור אימון מודלים מהפלט).
תנאי מקדים לכולם: למדוד דליפת מבטא עברי באנגלית ו־SIM מול הרפרנס.

**(ב) TTS אנגלי ילידי + המרת גוון:** Kokoro-82M (Apache, אין שיבוט) או כל TTS מסחרי מהרשימה בקול אנגלי ילידי ← **OpenVoice V2 TCC** (MIT, חוצה־שפות) או **CosyVoice `inference_vc`** (Apache) או **Chatterbox VC** (MIT). Seed-VC (GPL-3.0) ו־so-vits-svc (AGPL) — רק אחרי בדיקה משפטית. Vevo — אסור.

**(ג) CPU בחינם:** ZONOS3-Mini (ggml CPU, ~100M פעילים), Chatterbox-Nano (אנגלית, פי 3 מזמן אמת ב־8 ליבות), MOSS-TTS-Nano-100M (Apache), Kokoro-82M. כולם דורשים מדידת RTF אמיתית ב־CX53; לא נמדד כאן.

**אסורים/מוגבלים לשירות דיבוב:** OmniVoice, F5-TTS, MaskGCT/Vevo, Spark-TTS, Llasa, XTTS, ZipVoice, Voxtral (NC); Higgs v3 (אוסר מפורשות שירות דיבוב); Fish (רק מודל "שירות מנוהל" ומתחת ל־500K$ הכנסה); Hibiki-Zero, Seamless (NC); Wav2Lip (NC).

## 8. מה לא אומת
נתוני האימון של VoxCPM2/ZONOS3/MOSS/Qwen3/CosyVoice3; תנאי Higgs v2 המלאים; רישיון משקולות Step-Audio-EditX, StyleTTS2, StreamSpeech, Bandit, LivePortrait; RTF על CPU לכל מודל; SIM/WER מכרטיסים; מדידת דליפת מבטא עברי; חותמות מים מעבר ל־Chatterbox.

## מקורות
Hugging Face API/README: ResembleAI/chatterbox, openbmb/VoxCPM2, Zyphra/ZONOS3-Mini, OpenMOSS-Team/MOSS-TTS-v1.5, k2-fsa/OmniVoice, Qwen/Qwen3-TTS-12Hz-1.7B-Base, IndexTeam/IndexTTS-2.5, bosonai/higgs-tts-3-4b, fishaudio/s2-pro, kyutai/hibiki-zero-3b-pytorch-bf16, datasets/amphion/Emilia-Dataset. GitHub LICENSE/README: resemble-ai/chatterbox, fishaudio/fish-speech, index-tts/index-tts, myshell-ai/OpenVoice, FunAudioLLM/CosyVoice, TMElyralab/MuseTalk, bytedance/LatentSync, Rudrabha/Wav2Lip, facebookresearch/seamless_communication, adefossez/demucs, pyannote/pyannote-audio, m-bain/whisperX. דירוג: artificialanalysis.ai/text-to-speech/leaderboard/open-weights.
