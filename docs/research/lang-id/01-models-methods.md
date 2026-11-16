# זיהוי שפה מדוברת (LID), פילוח שפות לאורך הקלטה ותמלול code-switching — מחקר עומק (מצב 16/11/2026)

> הקשר: עובד CPU בלבד (Hetzner, ‏16 vCPU). היום: whisper-small (faster-whisper 1.2.1, ‏int8) לזיהוי שפה, ivrit turbo לעברית, Parakeet TDT 0.6B v2 לאנגלית. לא חוזר על `docs/research/video-analysis/04-audio-asr.md` (סעיף 3: Nemotron 3.5 Transcribe, מודלי עירוב קהילתיים).
> ודאות: **[מאומת]** — נקרא במקור ראשוני (קוד/מאמר/כרטיס); **[מקור יחיד]** — מקור אחד או תקציר; **[הערכה]** — הסקה שלי, לכייל על סט הזהב. מספרים בסוגריים מרובעים = רשימת המקורות בסוף.

## תקציר
1. **אין קיצור דרך לקטעים קצרים**: Whisper בין כל השפות — 1 שנ׳: 18–68%, ‏2 שנ׳: 64–94%, ‏3 שנ׳: 83–98% (שפות אירופיות) [3]; עברית קשה יותר — אצלנו tiny ב־3 שנ׳: 55% (FLEURS), ‏38% (שיחה).
2. **המנוף הגדול: הגבלה לשפות מועמדות** — אצלנו +33–38 נק׳ בעברית ב־1.5–3 שנ׳; זו גם הארכיטקטורה של השירותים המסחריים [32].
3. **faster-whisper 1.2.1 לא נותן פילוח**: `detect_language` = 30 השניות הראשונות כברירת מחדל; `multilingual=True` = ‏top-1 לכל ~30 שנ׳ בלי שדה שפה; במודלי ivrit.ai ה־LID נפגע באימון [1][2].
4. **משלים ל־CPU: ECAPA VoxLingua107** (‏Apache-2.0, ‏21M, עברית כ־`iw`) — יציב באורך (BAC ‏60.0→59.4 בין 5 ל־30 שנ׳) [4], אבל חלש באנגלית במבטא ובשיחה (recall אנגלית 15% ב־DISPLACE 2024) [11].
5. **רישיונות**: MMS-LID ונגזרות ESPnet שלו — NC; ‏AmberNet/PearlNet — ‏NGC ToU; ‏Silero — בלי עברית; ‏OWSM v4 (‏CC-BY-4.0) חזק ב־FLEURS אבל בתוך התחום.
6. **פילוח שפות קשה בשיחה** (DISPLACE 2024: הזוכה 27.6% DER, "הכל שפה אחת" 44.4%) אבל קל בהרבה בסרטון חד־דוברי; ‏collar ‏±0.25 שנ׳ מוריד 7–11 נק׳ — הגבולות הם חלק גדול מהשגיאה [11][20].
7. **כפיית שפה אחת מוחקת את השנייה**: WER ‏93–97% לשפה הלא־מוצהרת [22]; ב־ArzEn (כתבים שונים, כמו עברית–אנגלית) כפיית שפת המטריצה מעלה את שגיאת המילים המשובצות ל־70.8% [23].
8. **עברית–אנגלית**: אין קורפוס ואין מדד ציבורי לעברית עם מונחים באנגלית; בכיוון ההפוך Parakeet v2 שלנו מזהה רק 32.6% מהמונחים העבריים במשפט אנגלי [29].
9. **ההמלצה**: פרופיל שפות לסרטון (VAD, דגימות מפוזרות, סכום log-prob) → LID מקומי במפל (זול על הכל, small בחשודים) מוגבל למועמדות → Viterbi עם משך מינימלי 2 שנ׳ → הצמדת גבולות → אישור ב־ASR ובכתב. עירוב בתוך משפט — בתמלול (מונחי שקופיות + LLM), לא בפילוח.

## 1. מודלי LID שרצים מקומית על CPU

### 1.1 Whisper ו־faster-whisper 1.2.x

**המנגנון** — נקרא בקוד של 1.2.1 (31/10/2025; עדיין האחרונה ב־PyPI ב־16/11/2026; ‏MIT) [1] [מאומת]:
- `detect_language()` (וגם `transcribe()` כש־`language=None`) לוקח את `language_detection_segments × 30` השניות הראשונות (ברירת מחדל 1 → רק 30 השניות הראשונות; עם `vad_filter=True` — אחרי הסרת שקט), מרפד כל חלון ל־30 שנ׳ ומקבל מ־CTranslate2 הסתברות לכל 99 השפות. אם המובילה > `language_detection_threshold` (ברירת מחדל 0.5) — עוצר; אחרת ממשיך לחלון הבא, ובסוף הצבעת רוב על המובילה בכל חלון. `all_language_probs` = של החלון האחרון בלבד.
- `multilingual=True` מזהה מחדש בכל חלון פענוח (~30 שנ׳), top-1, בלי מועמדים ובלי החלקה, ול־`Segment` אין שדה שפה — זה לא פילוח שפות.
- אין פרמטר להגבלת שפות: מגבילים בעצמנו — משאירים מ־`all_language_probs` את {he, en, …} ומנרמלים.
- כל קלט מרופד ל־30 שנ׳ ⇒ עלות קבועה לחלון בלי קשר לאורכו (מסביר את ~0.28/‏~1.05 שנ׳ לחלון שמדדנו ל־tiny/‏small). ב־CTranslate2 אי אפשר לקצר את הקשר המקודד [הערכה].
- **מודלי ivrit.ai לא מתאימים ל־LID**: "Language detection capability of this model has been degraded during training… Language token should be explicitly set to Hebrew" [2] [מאומת].

**דיוק לפי אורך קטע** (באחוזים):

| מקור · מודל | סט | 1 שנ׳ | 2 | 3 | 5 | 10 | 30 |
|---|---|---|---|---|---|---|---|
| [3] base, בין כל השפות | MLS / VoxLingua / CommonVoice (8 שפות אירופיות) | 47.5/49.5/18.3 | 83.4/78.5/64.4 | 92.9/87.6/83.2 | | | |
| [3] large-v2 | אותו | 61.7/68.0/23.5 | 93.5/90.3/79.9 | 98.0/95.4/93.1 | | | |
| [4] tiny/small/large-v3 (BAC) | 12 שפות הודיות, דוברים מבוגרים | | | | 21.2/36.6/43.9 | 29.9/51.6/57.0 | 41.1/60.7/63.5 |
| [4] ECAPA-VL107 (BAC) | אותו | | | | 60.0 | 59.8 | 59.4 |
| **שלנו** tiny, עברית FLEURS: כל השפות / רק he+en | 40 קטעים | 1.5 שנ׳: 40/73 | | 55/93 | 77/100 | 83/100 | |

- FLEURS (102 שפות, מבעים שלמים): Whisper large-v2 ‏64.5% (80.3% על 82 השפות שיש להן נתוני אימון) [5]; לפי OWSM v4: medium ‏54.8%, ‏large-v3 ‏58.9% [6] [מאומת].
- **אנגלית במבטא** (VoxPopuli L2, ‏15 מבטאים): large v1/v2 ‏72.65%, ‏v3 ‏94.52%, ‏MMS-LID-126 ‏11.10% [7] [מאומת].
- **עברית**: ~690 שעות עברית באימון Whisper המקורי (ערבית 739) [5]; אין טבלת LID לפי שפה בציבור [פער]. אצלנו, עברית שיחתית ב־3 שנ׳ (tiny): 38% בין כל השפות, 83% כשמגבילים ל־he+en. ב־5 שנ׳ tiny שלח 78% מקטעי שפה שלא אומן עליה (אודיה) לאנגלית/הינדית/ספרדית [4] — כך נראית "הטיה לשפות גדולות".
- **מסקנות**: מתחת ל־2 שנ׳ Whisper לא אמין גם ב־large (CommonVoice ב־1 שנ׳: 18–24%); הגבלה למועמדים היא המנוף הגדול ביותר (אצלנו +33–38 נק׳ בעברית ב־1.5–3 שנ׳); small עדיף מאוד על tiny בשפות קשות (+15–22 נק׳ BAC [4]); ECAPA כמעט לא תלוי באורך מ־5 שנ׳ ומעלה, Whisper כן.

### 1.2 SpeechBrain ECAPA-TDNN VoxLingua107
- **Apache-2.0**; ‏107 שפות כולל עברית — התווית היא `iw` המיושנת, לא `he` [8]. ‏`embedding_model.ckpt` ‏84.5MB (~21M פרמטרים), ‏60 mel, ‏16kHz, קלט בכל אורך, ומוציא גם embedding בן 256 ממדים (לאשכול) [8] [מאומת]. ‏speechbrain 1.1.2 (14/10/2026).
- שגיאה 6.7% ב־VoxLingua107 dev (33 שפות, 1,609 קטעים) [8]; לפי אורך: 11.9% ב־0–5 שנ׳ מול 6.7% ב־5–20 שנ׳ [9]. מחוץ לתחום: F1-micro ‏94.1% על 79 שפות (FLEURS test + VL dev ועוד) [10].
- **חולשות**: לפי הכרטיס "doesn't work well on speech with a foreign accent" וכנראה חלש בדיבור נשי [8]. ב־DISPLACE 2024 מודל שאומן על VL107 הגיע ל־95.4% ב־VL dev אבל 22.2% בשיחה הודית, ו־recall של אנגלית (במבטא) 15% [11] — **אנגלית במבטא ישראלי עלולה להיות מזוהה כעברית** [הערכה].
- **מהירות**: בלי ריפוד ל־30 שנ׳ — העלות יחסית לאורך החלון; אין מספרי CPU רשמיים [פער — המדידה שלנו].
- שימוש מוכח: OWSM v4 ניקה נתונים ע"י הסכמה של LID קולי (ECAPA הזה) + LID טקסטואלי (fastText) עם התווית [6].

### 1.3 MMS-LID (Meta)
- 126–4,017 שפות, ~1B פרמטרים, **CC-BY-NC-4.0 — אסור מסחרית** [12] [מאומת]. FLEURS ‏97.5% (בתוך התחום), VL ‏93.9%, ‏BABEL ‏84.1% [12]; אבל אנגלית במבטא 11.1% [7].
- `espnet/lid_voxlingua107_mms_ecapa` מסומן CC-BY-4.0 (FLEURS 95.8, VL 94.2) אבל בנוי על MMS-1B; ‏ESPnet תיקנו כרטיס אח: "The previous CC-BY-4.0 metadata was incorrect" → NC [13]. להתייחס כ־NC.

### 1.4 NVIDIA NeMo: AmberNet (TitaNet-LID) ו־PearlNet
- TitaNet-LID ‏29M: שגיאה 5.6% ב־VL (0–5 שנ׳ 7.5%, ‏5–20 שנ׳ 5.2%) מול ECAPA 7.5%; גרסת 12M ‏7.0%; אחרי כוונון ל־FLEURS ‏88.2% [9]. ‏`langid_ambernet` 1.12.0 (4/2023) ‏5.22%; ‏PearlNet (Conformer, ‏229MB) ‏5.34% [14].
- **רישיון: NGC Terms of Use** — לא רישיון פתוח; לשימוש מסחרי צריך בדיקה [מאומת: נוסח].

### 1.5 Silero
- Language Classifier 95 מסומן **DEPRECATED**, ‏85% דיוק אימות על 95 שפות [15]; **אין בו עברית** (יש יידיש וערבית) [15]. לא רלוונטי.

### 1.6 חדשים 2025–2026
- **OWSM v4** (CMU, Interspeech 2025, ‏CC-BY-4.0, ‏102M–1B): FLEURS LID — base ‏80.1, small ‏90.0, medium ‏95.6, ‏CTC v4 ‏93.6 (מול Whisper large-v3 ‏58.9) [6]; יש אסימון `<heb>` (נבדק ב־config). זהירות: FLEURS train בנתוני האימון של OWSM — תוצאה בתוך התחום, לא השוואה הוגנת [מאומת].
- **XLS-R-300M VoxLingua107** (TalTech, ‏CC-BY-4.0, ‏4/2022): 5.6% ב־VL dev [16] — מדויק מ־ECAPA, פי ~14 פרמטרים.
- **Omnilingual ASR** (Meta, ‏10/11/2025, ‏Apache-2.0) — אין מודל LID נפרד; ‏Parakeet TDT 0.6B v3 (8/2025, ‏25 שפות אירופיות) ו־Qwen3-ASR (1/2026, ‏30 שפות) מזהים שפה בעצמם — בלי עברית; ‏Canary-1b-v2 דורש `source_lang`.
- **לא מצאתי מודל LID פתוח מ־2026 עם עברית שעוקף את ECAPA/Whisper על CPU** [פער].

### 1.7 השוואה

| מודל | עברית | גודל | רישיון | דיוק מדווח | CPU |
|---|---|---|---|---|---|
| whisper-tiny / small | כן | 39M / 244M | MIT | טבלה 1.1 | 0.28 / 1.05 שנ׳ לחלון (שלנו, 4 ליבות) |
| ECAPA VL107 | כן (`iw`) | 21M | Apache-2.0 | VL ‏93.3%; ‏0–5 שנ׳ ‏88.1% | קל, אורך חלון חופשי |
| XLS-R-300M VL107 | כן | 300M | CC-BY-4.0 | VL ‏94.4% | כבד |
| AmberNet | כן | 29M | NGC ToU ⚠ | VL ‏94.8% | קל |
| OWSM v4 base/small | `<heb>` | 102M/370M | CC-BY-4.0 | FLEURS 80.1/90.0 (בתוך התחום) | לבדוק |
| MMS-LID | כן | 1B | **NC ✗** | FLEURS 97.5 | כבד, אסור |
| Silero 95 | **לא** | 17MB | MIT | 85% | — |

## 2. פילוח שפות לאורך זמן (language diarization)

**שיטות**: (1) חלונות חופפים → posteriors → החלקה (מסנן חציוני, משך מינימלי, או HMM/Viterbi עם הסתברות "להישאר" p — משך רצף צפוי = צעד/(1−p)); (2) גילוי נקודות מעבר ואז סיווג/אשכול של כל קטע; (3) אשכול embeddings (‏AHC/spectral) ועידון ב־VBx (‏HMM בייסיאני) — הגישה של ה־baseline והזוכים ב־DISPLACE 2024 [11][17]; (4) מקצה לקצה ברמת פריים [18][19].
**הפשרה המרכזית**: חלון ארוך מבחין טוב אבל "מוחק" קטעי שפה שנייה קצרים; חלון קצר מבחין חלש (אותו דובר בשתי השפות) [19].

**תחרויות ומספרים** (DER = ‏miss + FA + confusion על זמן, בלי collar):
- **DISPLACE 2023** (שיחות רב־דובריות, שפות הודיות + אנגלית, far-field): baseline ‏ECAPA-VL107 על חלונות 0.4 שנ׳/צעד 0.2 + אשכול — ‏41.7%; הזוכה: LID של Whisper בריבוי רזולוציות (חלונות 1–11 שנ׳, צעד 1) + ‏DOVER-Lap — ‏37.4–37.6%; עם collar ‏0.25 שנ׳ ובלי חפיפות — ‏26.6%. רוב השגיאה = confusion (24.4%), במיוחד בקטעי עירוב קצרים [20] [מאומת].
- **DISPLACE 2024**: baseline — posteriors של Whisper על חלונות 10 שנ׳/צעד 0.2 + ‏AHC + ‏VBx: ‏32.7%; הזוכה (TalTech-IRIT-LIS): ‏w2v-BERT 2.0 ‏(600M) + LoRA, חלונות 5 שנ׳/צעד 1, ‏AHC + ‏VBx, אימון על NIST LRE + כוונון: ‏27.6%. "הכל שפה אחת" נותן 44.4% ב־dev, וה־baseline של 2023 (48.6%) היה גרוע ממנו [11][17] [מאומת].
- **SAGE-LD** (10/2025, ‏72M, מקצה לקצה, אימון על עירוב מסונתז): ‏18.0% על DISPLACE-E — אבל בחלוקה 70/30 משלו, לא ניתן להשוואה ישירה; למאגר אין קובץ רישיון [18].
- **MERLIon CCS** (Interspeech 2023, אנגלית–מנדרינית לילדים, קטע חציוני 0.9–1.1 שנ׳): baseline ‏LDER ‏84–87%, ואף צוות לא הגיש לפילוח [21].
- **MSCS** (Gujarati/Tamil/Telugu–English): מקצה לקצה עם x-vector ‏DER/JER ‏22.3/60.4 → ‏11.2/21.8 עם ייצוג self-supervised [19] [מאומת].

**מדדים**: DER/LDER (בלי collar — מחמיר); JER; דיוק ברמת פריים; לגבולות — בפועל collar של ±0.25 שנ׳ [20]; לא מצאתי מדד F1 גבולות סטנדרטי בתחרויות [פער].
**דיוק גבול צפוי**: ב־DISPLACE ‏collar ‏±0.25 שנ׳ + התעלמות מחפיפה מורידים 7–11 נק׳ DER (החפיפה לבדה רק 1.3–1.7) — הרבה מהשגיאה יושבת על הגבולות [20]. עם צעד 0.5–1 שנ׳ — ~±0.5 שנ׳; הצמדה לשתיקת VAD או לגבול מילה מה־ASR — ~0.1–0.3 שנ׳ [הערכה].
**לגבינו**: סרטונים חד־דובריים, שפות ידועות מראש וקטעים של משפטים שלמים — קלים בהרבה מ־DISPLACE. הקושי שלנו הוא עירוב בתוך משפט (מונחים), שנפתר בתמלול (סעיף 3), לא בפילוח [הערכה].

## 3. תמלול code-switching

**סוגים**: בין משפטים — פילוח (סעיף 2) + מנוע לכל שפה; בתוך משפט (מונחים, שמות) — מודל אחד שכותב את שתי השפות; בתוך מילה (תחילית עברית על מילה אנגלית: "ב־deployment", "ה־API") — הקשה ביותר; גם PIER מראה שמעבר תוך־מילה קשה ממעבר בין מילים [23].

**מדדים**: MER — ‏WER למילים + CER לכתב בלי רווחים [25]; **PIER** (‏ICASSP 2025) — שיעור שגיאה רק על "נקודות עניין", בדרך כלל מילות שפת־השיבוץ; התיוג אוטומטי כשהכתבים שונים — בדיוק עברית/לטינית [23]; **CS-WER** — ‏1−N/M על המילים משני צידי נקודות המעבר [24] (ההגדרה משתנה בין מאמרים); מדדים שמתעתקים לכתב אחד כדי לא להעניש בחירת כתב [25]; ‏BERTScore כמדד משלים [28].

**ממצאים**:
- **כפיית אסימון שפה אחד הורסת את השנייה** [22] [מאומת]: Whisper Large עם `<|zh|>` — ‏WER אנגלית 93.1% (ASCEND) ו־97.4% (SEAME); עם `<|en|>` — ‏CER מנדרינית 90–99%. הנחיה עם שני אסימונים ("concat"): ‏SEAME val ‏MER ‏45.3→36.9, ‏ASCEND test ‏22.8→20.9 — אבל ב־SEAME עדיין רחוק ממודל מפוקח (32.7/47.6 מול 16.6/23.3).
- **ArzEn — ערבית מצרית–אנגלית, כתבים שונים (האנלוגיה הקרובה לעברית–אנגלית)** [23] [מאומת]: Whisper-large בזיהוי אוטומטי — ‏WER ‏52.8, ‏PIER ‏59.0; כפיית ערבית — ‏WER ‏53.9 אבל PIER ‏70.8 (המילים האנגליות אובדות); כפיית אנגלית — ‏PIER ‏38.8 אבל WER ‏103.8. ‏small גרוע יותר (PIER ‏80.7 בכפיית ערבית). כוונון על נתונים חד־לשוניים שיפר WER והחמיר PIER (Fisher: ‏WER ‏−5.1% יחסי, ‏PIER ‏+39.5%).
- **תיקון ב־LLM** [26][27]: GER (‏ASRU 2019, ‏zh-en) — Whisper ‏MER ‏11.0→8.6 (−20.9%), עם N-best מכמה מנועים 8.3; דרש כוונון LoRA של LLaMA-2 7B על 19 שעות. "רמז שפה" מהמערכת הוסיף 14.1% ב־ASRU אבל רק 5.5% ב־SEAME — התיקון עוזר בעיקר כשה־ASR כבר כמעט נכון.
- **מסחריים** (Perle, ‏5/2026; ערבית מצרית/סעודית, פרסית, גרמנית מול אנגלית; 300 מבעים לזוג, מוקראים מתמלילים): Scribe v2 ‏13.2% WER, ‏gpt-4o-transcribe ‏38.6%, ‏Chirp 3 ‏39.4%, ‏Azure (CLID) ‏43.6%; ‏WER מנפח פערים פי ~3 בגלל בחירות כתב/תעתיק [28] [מקור יחיד, ספק מסחרי].
- **סטי נתונים** [25]: ‏SEAME ‏192 ש׳ (zh-en), ‏ASCEND ‏10.6, ‏TALCS ‏587, ‏Miami Bangor ‏35.7 (es-en), ‏MUCS 2021 ‏600 (hi/bn-en), ‏ArzEn ‏12. מיטב התוצאות בסקירה: ‏SEAME MER ‏14.2/20.8, ‏ASCEND ‏17.9, ‏MUCS WER ‏22.0/27.8, ‏ArzEn ‏32.1, ‏Miami Bangor ‏48.4. **אין בסקירה קורפוס עברית–אנגלית.**

**עברית–אנגלית**:
- **אין מחקר שפיט ואין מדד ציבורי לעברית כשפת מטריצה עם מונחים באנגלית** (הרצאה טכנית); גם מאמר ivrit.ai (‏Interspeech 2025) לא עוסק בזה [30] [פער].
- **הכיוון ההפוך — אנגלית עם מילים עבריות בכתב לטיני** (פרויקט Hebrish, דובר אחד, 339 דק׳, ‏10/2026) [29] [מקור יחיד]: על המדד הציבורי שלו stock Parakeet TDT 0.6B v2 — **המנוע האנגלי שלנו** — מזהה נכון 32.6% מהמונחים העבריים, Whisper large-v3 ‏45.9%, והכוונון v1.0 (‏CC-BY-4.0, ‏19/10/2026) ‏73.3%. ה־stock מצליח בעיקר בשמות, מקומות ומילים שכבר באנגלית, ונכשל במונחים כמו "cheshbonit", ‏"osek patur".
- **איך מודלים עבריים כותבים אנגלית**: ivrit turbo — לפעמים בלטינית (ראשי תיבות; תצפית שלנו); ‏parakeet-v3-he — "English words come out in Hebrew letters" [31]; ‏Nemotron 3.5 Transcribe (‏GPU) — מונחה לכתוב אנגלית בלטינית (מחקר קודם). WER רגיל סופר כתב "לא נכון" כשגיאה מלאה — לכן למדוד גם PIER עם נרמול תעתיק [הערכה].

## 4. מתכון מעשי (ספים = [הערכה], לכייל על סט הזהב)

**שלב 0 — סינון**: ‏VAD (Silero, קיים) לפני כל LID — Whisper "ממציא" על לא־דיבור: ב־large-v3 ‏40.3% מקבצי לא־דיבור הפיקו טקסט [33]; ב־faster-whisper יש `detect_language(vad_filter=True)` [1]. מוזיקה: מסווג speech/music/noise על CPU (inaSpeechSegmenter 0.8.0, ‏MIT, ‏9/2025) [34] — לא להריץ LID על חלון שרובו מוזיקה/שירה, ולתייג "מוזיקה" בלי לשבור את רצף השפה. צחוק ומחיאות כפיים = לא־דיבור (כך גם ב־DISPLACE [20]).

**שלב 1 — פרופיל שפות לסרטון** (במקום 6 דגימות × 20 שנ׳ + הצבעה): 8–12 חלונות דיבור של 10–30 שנ׳ אחרי VAD, מפוזרים לאורך כל הסרטון; סכום log-probabilities של whisper-small (לא הצבעת רוב); ראשית = המובילה; **מועמדות** = הראשית + שפת המשתמש + כל שפה עם ≥0.8 בשני חלונות או ≥10% מהמסה — בדרך כלל 2–3. גם השירותים המסחריים בנויים על רשימת מועמדות: Azure — עד 10, ומחזיר תמיד אחת מהן גם אם אף אחת לא נאמרה; AWS — רשימה שגויה מובילה לזיהוי שגוי [32].

**שלב 2 — LID מקומי**: חלון 3 שנ׳ (לפחות 2 שנ׳ דיבור נטו), צעד 1 שנ׳; posteriors מוגבלים למועמדות ומנורמלים. **מפל עלויות**: מודל זול על הכל (ECAPA — בלי ריפוד, או whisper-tiny), ו־whisper-small רק באזורים חשודים (מועמדת משנית ≥0.3, ביטחון ASR נמוך) ובסביבת גבולות. חשבון: שעת דיבור בצעד 1 שנ׳ = 3,600 חלונות → ‏tiny ‏~17 דק׳ על 4 ליבות, ‏small ‏~63 דק׳ — לכן small לא על הכל.

**שלב 3 — החלקה**: Viterbi על HMM עם מצב לכל מועמדת; הסתברות להישאר 0.97–0.99 לצעד של 1 שנ׳ (רצף צפוי 33–100 שנ׳); משך מינימלי 2 שנ׳ לשפה משנית (שרשרת מצבים); prior של 0.8–0.9 לשפה שהמשתמש בחר. חלופה פשוטה: חציון על 5 חלונות + מיזוג קטעים קצרים מ־2 שנ׳ לשכן.

**שלב 4 — גבולות**: הצמדה לשתיקת VAD (≥200–300 מ״ש, עד ±1 שנ׳) או לגבול מילה מה־ASR; יעד ±0.3 שנ׳.

**שלב 5 — אישור ב־ASR ובכתב**: כל קטע משני מתומלל במנוע של שפתו, ובודקים: (א) ביטחון (avg_logprob של Whisper / ביטחון טוקנים של Parakeet) מול המנוע של שפת הסביבה; (ב) **כתב** — שיעור אותיות עבריות (U+0590–U+05FF) מול לטיניות: LID טקסטואלי כמעט חינמי לעברית/אנגלית, אבל לא לשתי שפות בכתב לטיני (שם — מסווג טקסט כמו fastText). אין הסכמה בין LID קולי, ASR וכתב → הקטע חוזר לשפת הסביבה. הסכמה קולי ∧ טקסטואלי היא גם שיטת הסינון של OWSM v4, ו־TalTech מציעים אותה לפילוח [6][11].

**מלכודות**:
- LID על פחות מ־2 שנ׳ — לא לסמוך (Whisper ב־1 שנ׳: 18–68% [3]; ‏MERLIon, קטעים של ~1 שנ׳: ‏LDER ‏84–87% [21]).
- שמות ומונחים בשפה אחרת בתוך משפט — לא לפצל; שינוי שפה רק אחרי ≥2 חלונות רצופים.
- אנגלית במבטא ישראלי עלולה להיראות "עברית" ל־ECAPA [8][11] — שם להכריע ב־Whisper/ASR.
- `multilingual=True` אינו פילוח (30 שנ׳, top-1, בלי שדה שפה) [1].
- "Parakeet לא בטוח" ≠ "שפה אחרת": חוסר ביטחון בא גם מרעש, מוזיקה ומבטא — צריך ראיה חיובית מ־LID.

**כשהמשתמש בחר שפה אחת ויש עוד**: לא לכפות אסימון שפה על כל הסרטון — זה מוחק את השפה השנייה (WER ‏93–97% לשפה הלא־מוצהרת; PIER ‏70.8 למילים המשובצות) [22][23]. במקום: שפת המשתמש = prior חזק; קטע שעבר את שלב 5 מתומלל במנוע שלו ומסומן; בתרגום לעברית קטע שכבר בעברית עובר כמו שהוא; הודעה שקטה ("זוהו 3:40 דק׳ באנגלית") [הערכה].

## מה זה אומר לנו
1. **שפה ראשית**: להשאיר whisper-small, אבל רק על דיבור (VAD), מפוזר לאורך הסרטון, עם סכום log-prob — והפלט הוא פרופיל של 2–3 מועמדות, לא שפה אחת.
2. **פילוח**: מפל — ECAPA (‏Apache-2.0, ‏21M) או tiny מוגבל למועמדות על כל הדיבור; small רק באזורים חשודים; Viterbi עם משך מינימלי 2 שנ׳; אישור ב־ASR ובכתב. ההכרעה בין ECAPA ל־tiny — לפי המדידה שלנו על עברית ואנגלית במבטא ישראלי (ECAPA חלש במבטא, Whisper חלש בקטעים קצרים).
3. **עירוב בתוך משפט** (הרצאה עברית עם מונחים): לא בפילוח — מנוע ivrit אחד + ‏hotwords/‏initial_prompt עם מונחי השקופיות בלטינית + LLM עם מילון מונחים; למדוד ב־PIER.
4. **סרטון אנגלי עם מילים עבריות**: Parakeet v2 מזהה ~1/3 מהמונחים העבריים [29]; לנסות את הכוונון הקהילתי (‏CC-BY-4.0, דובר אחד — לבדוק הכללה) או תיקון LLM עם הקשר.
5. **לא לאמץ**: MMS-LID ונגזרותיו (NC), ‏Silero (בלי עברית), ‏AmberNet/PearlNet (‏NGC ToU — רק אחרי בדיקה), ‏SAGE-LD (בלי רישיון).
6. **סט זהב**: 20–30 קטעים משלנו (עברית+אנגלית, הרצאות) עם תיוג שפה בזמן; מדדים: LDER בלי collar ועם ±0.25 שנ׳, ‏F1 גבולות ב־±0.5 שנ׳, ‏PIER על מונחים.

## מקורות (נבדקו 16/11/2026)

1. faster-whisper v1.2.1 — [transcribe.py](https://github.com/SYSTRAN/faster-whisper/blob/v1.2.1/faster_whisper/transcribe.py), [PyPI](https://pypi.org/project/faster-whisper/) (31/10/2025)
2. [ivrit-ai/whisper-large-v3-turbo — כרטיס](https://huggingface.co/ivrit-ai/whisper-large-v3-turbo)
3. Shen et al., ‏ICASSP 2024 — [arXiv 2312.10964](https://arxiv.org/abs/2312.10964) (12/2023)
4. Kommineni et al., ‏JASA Express Letters 5:095204 — [AIP](https://pubs.aip.org/asa/jel/article/5/9/095204/3362841) (9/2025)
5. Radford et al., Whisper — [arXiv 2212.04356](https://arxiv.org/abs/2212.04356) (12/2022)
6. OWSM v4, ‏Interspeech 2025 — [arXiv 2506.00338](https://arxiv.org/abs/2506.00338); [owsm_v4_medium_1B](https://huggingface.co/espnet/owsm_v4_medium_1B)
7. Sullivan & Abdul-Mageed — [arXiv 2507.08768](https://arxiv.org/abs/2507.08768) (7/2025)
8. [speechbrain/lang-id-voxlingua107-ecapa](https://huggingface.co/speechbrain/lang-id-voxlingua107-ecapa) (עודכן 11/2024)
9. Jia et al., ‏TitaNet-LID, ‏Interspeech 2023 — [arXiv 2210.15781](https://arxiv.org/abs/2210.15781)
10. SeamlessM4T — [arXiv 2308.11596](https://arxiv.org/abs/2308.11596) (8/2023)
11. Kalda et al., ‏TalTech-IRIT-LIS ל־DISPLACE 2024 — [arXiv 2407.12743](https://arxiv.org/abs/2407.12743)
12. Pratap et al., ‏MMS — [arXiv 2305.13516](https://arxiv.org/abs/2305.13516); רישיון: [mms-lid-126](https://huggingface.co/facebook/mms-lid-126)
13. ESPnet — [geolid (תיקון הרישיון)](https://huggingface.co/espnet/geolid_vl107only_shared_trainable), [lid_voxlingua107_mms_ecapa](https://huggingface.co/espnet/lid_voxlingua107_mms_ecapa)
14. NGC — [langid_ambernet](https://catalog.ngc.nvidia.com/orgs/nvidia/nemo/models/langid_ambernet), [langid_pearlnet](https://catalog.ngc.nvidia.com/orgs/nvidia/nemo/models/langid_pearlnet)
15. Silero — [Other Models](https://github.com/snakers4/silero-vad/wiki/Other-Models); רשימת התוויות: [מראה](https://huggingface.co/deepghs/silero-lang95-onnx)
16. [TalTechNLP/voxlingua107-xls-r-300m-wav2vec](https://huggingface.co/TalTechNLP/voxlingua107-xls-r-300m-wav2vec)
17. Kalluri et al., ‏DISPLACE 2024 — [arXiv 2406.09494](https://arxiv.org/abs/2406.09494)
18. SAGE-LD — [arXiv 2510.00582](https://arxiv.org/abs/2510.00582) (10/2025), [GitHub](https://github.com/sanghyang00/sage-ld)
19. Mishra & Prasanna — [arXiv 2308.10470](https://arxiv.org/abs/2308.10470) (8/2023)
20. DISPLACE 2023, סיכום — [arXiv 2311.12564](https://arxiv.org/abs/2311.12564)
21. MERLIon CCS, ‏Interspeech 2023 — [arXiv 2305.18881](https://arxiv.org/abs/2305.18881)
22. Peng et al., ‏Interspeech 2023 — [arXiv 2305.11095](https://arxiv.org/abs/2305.11095)
23. Ugan et al., ‏PIER, ‏ICASSP 2025 — [arXiv 2501.09512](https://arxiv.org/abs/2501.09512)
24. Sharma et al., ‏CS-WER — [arXiv 2010.05549](https://arxiv.org/abs/2010.05549) (2020)
25. Agro et al., סקירה שיטתית, ‏LREC 2026 — [arXiv 2507.07741](https://arxiv.org/abs/2507.07741)
26. Chen et al., ‏GER — [arXiv 2310.13013](https://arxiv.org/abs/2310.13013)
27. "Aligning Speech to Languages…" — [arXiv 2403.05887](https://arxiv.org/abs/2403.05887) (3/2024)
28. Abdoli et al. (Perle) — [arXiv 2605.19069](https://arxiv.org/abs/2605.19069) (5/2026)
29. Hebrish — [GitHub](https://github.com/Hebrish-ASR/English-Hebrew-Codeswitching-Parakeet-Finetune), [המודל](https://huggingface.co/danielrosehill/Parakeet-TDT-0.6B-v2-English-Hebrew-Codeswitching) (10/2026)
30. Marmor et al., ‏ivrit.ai, ‏Interspeech 2025 — [PDF](https://www.isca-archive.org/interspeech_2025/marmor25_interspeech.pdf)
31. [thewh1teagle/parakeet-tdt-0.6b-v3-he](https://huggingface.co/thewh1teagle/parakeet-tdt-0.6b-v3-he)
32. [Azure — language identification](https://learn.microsoft.com/azure/ai-services/speech-service/language-identification); [AWS Transcribe — lang-id batch](https://docs.aws.amazon.com/transcribe/latest/dg/lang-id-batch.html)
33. Barański et al., ‏ICASSP 2025 — [arXiv 2501.11378](https://arxiv.org/abs/2501.11378)
34. [inaSpeechSegmenter ב־PyPI](https://pypi.org/project/inaSpeechSegmenter/)
