# 02 — שפות מעורבות וסימון דוברים: שירותי התמלול, מדריכי הכתוביות וממשק התמליל (מצב 16/11/2026)

> **שיטה.** מחקר ב־16/11/2026 מתיעוד רשמי (דפי מפתחים, מדריכי סגנון, תקני נגישות). לכל טענה — מקור ותאריך הבדיקה; ודאות: **[ו]** = נבדק ישירות בתיעוד הרשמי, **[ח]** = חלקי/משני/לא מפורש, **[?]** = לא אומת. שמות מוצרים מוזכרים כעובדה בלבד.
> **פערים:** האתר של Paul Tol (פלטות צבע) לא נגיש מהסשן; כללי השידור הישראליים לזיהוי דובר לא נמצאו ברשת; עמוד OpenAI לא מזכיר עברית.

## תקציר
1. **התעשייה עוברת משפה לקובץ לשפה לקטע ולמילה.** במצב "שפה לקובץ", קטע בשפה אחרת "is transcribed incorrectly" (AWS).
2. **עירוב עברית–אנגלית בתוך קובץ אחד מתועד במפורש** ב־AssemblyAI Universal-3.5 Pro (18 שפות, כולל עברית), ‏Gladia Solaria-1 ו־AWS ‏IdentifyMultipleLanguages; ב־Deepgram ‏`multi` (55 שפות, מ־23/10/2026) — טעון בדיקה.
3. **לא מתועד**: המודל הרב־לשוני של Azure fast (בלי עברית), החבילות הדו־לשוניות של Speechmatics, ו־Google Chirp 3 (העברית ב־Preview).
4. **מצמצמים את השפות המועמדות** (AWS: ‏2–5), ורמז הוא לא מגבלה: הגבלה קשיחה כופה שפה שגויה (Azure, ‏AWS).
5. **סף ודאות, שפת גיבוי ומספיק דיבור**: AWS ‏≥30 שנ׳, ‏AssemblyAI ‏15–90, ‏Speechmatics ‏≥60.
6. **בכתוביות מתרגמים רק מה שהצופה אמור להבין**; שורות שכבר בשפת היעד לא מקבלות כתובית תרגום (Netflix).
7. **תגית שפה רק בכתובית הראשונה אחרי מעבר.** בעברית: `[בספרדית]`, ‏`[מדבר/מדברת ספרדית]`; ‏`[שפה זרה]` אסור.
8. **BBC — הצבע מועדף**: לבן ← צהוב ← ציאן ← ירוק על שחור, צבע קבוע לדובר, ומעל 4 דוברים תווית שם.
9. **Netflix בלי צבע** (מקף בלי רווח, מזהה בסוגריים רק כשאי אפשר לזהות); DCMP — מיקום, שם רק אחרי שהוצג, ניסוח ניטרלי מגדרית; WCAG ‏1.2.2 — "who is speaking".
10. **מגדר**: התעשייה מתרחקת מהסקת מגדר (Microsoft, ‏2022; ‏AWS — רף 99% ולא כזהות). אצלנו — נתון **דקדוקי לתרגום**, שדה ניתן לעריכה ולא תווית ליד השם.
11. **צבע**: בבהירות שווה (נדרש ל־4.5:1) רק **4** צבעים נבדלים בכל סוגי עיוורון הצבעים — לכן ראשי תיבות או שם תמיד; פלטה מחושבת של 6+1 בסעיף 4.3.
12. **זכוכית** (HIG): רק לשכבות הצפות — "Don't use Liquid Glass in the content layer"; מעל מדיה בהירה — עמעום של 35%.

## 1. שירותי תמלול מסחריים — זיהוי שפה ושפות מעורבות

**שלוש רמות בתעשייה** (הסיווג שלי מתוך התיעוד):
- **שפה אחת לקובץ** — מזהים את השפה הדומיננטית ומתמללים הכל בה. AWS כותב במפורש שבמצב הזה "any spoken language that is not the dominant language is transcribed incorrectly" [ו].
- **שפה לכל משפט/תור** — AWS ‏IdentifyMultipleLanguages, ‏Azure continuous ("doesn't support changing languages within the same sentence"), ‏Gladia (לכל utterance).
- **שפה לכל מילה, מעבר באמצע משפט** — Deepgram ‏`multi`, ‏Soniox, ‏AssemblyAI Universal-3.5 Pro, ‏ElevenLabs Scribe v3 Live.

| שירות | הפעלה | רזולוציה ושדה בפלט | מועמדות / הגבלה | עברית |
|---|---|---|---|---|
| **Google STT V2 — Chirp 3** | `language_codes=["auto"]` או רשימה | `result.language_code`; ב־auto "transcribes in the most prevalent language" | אפשר להגביל לרשימה; בדגמים הישנים (long/short/telephony) עד 3 שפות, Pre-GA | `iw-IL` — **Preview**; לא ברשימת הדיאריזציה. עירוב בתוך קובץ — לא מתועד [ו] |
| **AWS Transcribe** | `IdentifyLanguage` (דומיננטית) / `IdentifyMultipleLanguages` | Multi: תמליל רב־לשוני + סיכום `language_codes` עם `duration_in_seconds` | `LanguageOptions` ‏≥2, בלי תקרה, **מומלץ 2–5**; ≥30 שנ׳ דיבור; Multi בלי redaction ובלי מודל שפה מותאם | `he-IL` ברשימת ה־Multi [ו] |
| **Azure Speech** | at-start: **עד 4** מועמדות, שפה אחת תוך <5 שנ׳ · continuous: **עד 10** | `locale` ו־`speaker` לכל phrase (fast/batch) | תמיד מחזיר אחת מהמועמדות; לוקאל אחד לכל שפת בסיס; batch: `candidateLocales` + `locale` כגיבוי; continuous מחויב מעבר לאורך השמע | fast בלי `locales` = מודל רב־לשוני של 15 לוקאלים — **בלי עברית** [ו] |
| **Deepgram** | `language=multi` (Nova-3) | `language` **לכל מילה** + `languages` לערוץ | `language_hint` — "bias detection but don't restrict it"; ‏endpointing ‏100ms לעירוב | `he` ב־Nova-3; ‏`multi` הורחב ל־**55 שפות ב־23/10/2026** והעברית ברשימת ה־Multilingual — טעון בדיקה [ח] |
| **AssemblyAI** | `language_detection` → `language_code` + `language_confidence` ‏(0–1) | Universal-3.5 Pro: מעבר **באמצע משפט**, 18 שפות | `language_codes` (U-3.5 Pro) מגביל: "code-switches only among the languages you list"; ‏`expected_languages` "a hint, not a strict filter"; ‏`language_confidence_threshold` → שגיאה; 15–90 שנ׳ | **עברית בין ה־18** [ו] |
| **Speechmatics** | `language: "auto"` (batch בלבד) | `language` לכל מילה | `expected_languages` — שפה מחוץ לרשימה = דחיית העבודה; ‏`low_confidence_action`; ‏≥60 שנ׳ | `he` נתמכת; החבילות הדו־לשוניות (ar_en, ‏cmn_en, ‏en_ms, ‏en_ta, ‏es+en, ‏tl) — בלי עברית [ו] |
| **ElevenLabs Scribe v3** | `language_code` + `language_probability` | קובץ; v3 Live: מעבר באמצע משפט, "each language in its own script" | שפות משניות צפויות (v3, batch) | נתמכת; ב־v2 בדרגת "Good" ‏(WER ‏10–20%) [ו] |
| **Gladia** | `language_config: {languages, code_switching:true}` | `language` לכל utterance ולכל מילה; מעבר בין תורות | "small set"; **לא** להפעיל עם רשימה ריקה (100+ שפות → טעויות) | `he` — Solaria-1 כולל code-switch; לא ב־Solaria-3 [ו] |
| **Soniox** | `enable_language_identification` | `language` לכל טוקן, עקבי ברמת משפט (מילה זרה בתוך משפט נשארת בשפת המשפט) | `language_hints`; ‏`language_hints_strict` "most robust when only one language" | `he` נתמכת (60+ שפות) [ו] |
| **OpenAI** | `gpt-transcribe`: ‏`languages` (מחליף `language`) | מערך `languages` לקובץ; **ריק** כשאין ודאות | — | לא מוזכרת בעמוד [?]; ‏`whisper-1`/`gpt-4o-*` נסגרים 26/2/2027; דיאריזציה רק ב־`-diarize` הישן [ו] |

**מה כולם ממליצים (קונצנזוס):**
1. **להגביל מועמדות למינימום.** Google: ‏"constrain the language list to the bare minimum" · ‏AWS: ‏2–5 · ‏Azure: ‏"A smaller, accurate candidate set can improve detection, especially for short or noisy audio" · ‏Gladia: רשימה קצרה · ‏Soniox: שפה אחת היא היציבה ביותר.
2. **אבל הגבלה קשיחה מסוכנת**: Azure ‏"returns one of the candidate languages provided even if those languages weren't in the audio"; ‏AWS — שמע אנגלי עם מועמדות zh/fr/de "is likely to match… German"; ‏Speechmatics — דוחה. מכאן: רמז ≠ מגבלה, וצריך סף ודאות.
3. **מספיק דיבור**: AWS ‏≥30 שנ׳, ‏AssemblyAI ‏15–90, ‏Speechmatics ‏≥60 "in that language". קטע קצר בשפה שנייה לא יזוהה במצב "שפה לקובץ".
4. **ודאות וגיבוי**: ציון 0–1 (AssemblyAI, ‏ElevenLabs, ‏AWS), שפת גיבוי (`fallback_language`, ‏`default_language`, ‏`locale`), ותשובה ריקה כשלא בטוחים (OpenAI). Azure: אם הזיהוי לא יציב — לקבע לוקאל.

## 2. כתוביות ותמלול מקצועיים עם כמה שפות וזיהוי דוברים

### 2.1 דיבור בשפה זרה — ודיבור שכבר בשפת היעד
- **מתרגמים רק מה שהצופה אמור להבין.** Netflix (מדריכי העברית והאנגלית, עודכנו 28/4/2026): "Foreign dialogue should only be translated if the viewer was meant to understand it (i.e. if it was subtitled in the original version)" [ו].
- **קטע שכבר בשפת היעד — לא מקבל כתובית תרגום.** מדריך האנגלית: "When translating non-English language content, do not include subtitles for lines of English dialogue which may appear (e.g. in multilingual titles) unless instructed by Netflix" [ו]. אותו עיקרון בטקסט על המסך: "Forced narratives that are redundant (e.g. identical to onscreen text or covered in the dialogue) must be deleted", וכותרת שכבר בעברית — "Do not subtitle" (מדריך העברית) [ו]. ההחלה על עברית בתוך סרטון אנגלי היא **היקש שלי** מהכלל לאנגלית [ח].
- **Forced narrative** = כתוביות שמוצגות גם כשהכתוביות כבויות, לטקסט על המסך ולדיאלוג זר שתורגם במקור (ההגדרה המקובלת [ח]). בעברית: בתוך מקפים `- … -` "except for foreign dialogue"; ‏"Never combine a forced narrative with dialogue in the same subtitle" [ו].
- **תגית שפה בכתוביות נגישות (SDH):** מתורגם → `[in Spanish]`, לא אמור להיות מובן → `[speaking Spanish]`; ‏"[speaking foreign language] should never be used"; ומסמנים "every time the language changes, but only in the first subtitle after the language changes" [ו]. **בעברית**: `[בספרדית]`, ו־`[מדברת ספרדית]` / `[מדבר ספרדית]` — התגית **נוטה לפי מגדר הדובר**; ‏`[שפה זרה]` אסור [ו].
- **BBC** (גרסה 1.2.5, מרץ 2026): דובר בשפה זרה עם תרגום צרוב → תווית שפה "in white caps, ranged left above the in-vision subtitle, followed by a colon", רק בתחילת הרצף; אם השפה קשה לזיהוי ולא חשובה — `TRANSLATION:` [ו].
- **DCMP Captioning Key**: "If possible, caption the actual foreign words… use a description (e.g., [speaking French]). Never translate into English" [ו].
- **FCC** ‏(47 CFR 79.1(j)(2)): כתוביות "in the original language", והדיוק כולל מידע שלא נראה לעין "such as the identity of speakers" [ו].

### 2.2 זיהוי דוברים
- **BBC — צבע הוא השיטה המועדפת.** לפי סדר עדיפות: **לבן `#FFFFFF` ← צהוב `#FFFF00` ← ציאן `#00FFFF` ← ירוק `#00FF00`**, כולם על רקע שחור. "Once a speaker has a colour, they should keep that colour"; לא לחלוק צבע (חריג: ירוק כ"floater" לדמויות משניות שלא מופיעות יחד); המספר בצהוב; לבן לכל מספר דוברים. מעל 4 דוברים או עמימות → תווית `JAMES:` **בלבן**; שם לא ידוע → `MAN:` רק "if this is necessary for the viewer's understanding". מקפים ומיקום אופקי — "legacy"; גרש בודד לקול מחוץ לתמונה. ומטא־נתון `ttm:agent` לכל דובר — "useful for searching" [ו].
- **Netflix**: בלי צבעים (גופן לבן). שני דוברים בכתובית — מקף בלי רווח, שורה לכל דובר (בעברית — "to denote the second speaker only"). ב־SDH: מזהה בסוגריים מרובעים "Only… when they cannot be visually identified"; לא ידוע → `[man]`/`[woman]`/`[male voice]`, ובעברית `[גבר]`, `[אישה]`, `[קול גבר]` — ו־"Gender-neutral identifiers like [קריין.נית חדשות], [רופא.ה] or [מוכר.ת] can be used where appropriate"; מספור `[man 1]` [ו].
- **DCMP**: קודם מיקום מתחת לדובר; שם בסוגריים בשורה נפרדת `(Jack)` רק אחרי שהוצג; לא ידוע → "inclusive, non-gendered language", למשל `(speaker #1)`, `(narrator)` [ו].
- **WCAG 2.2**, ‏SC 1.2.2 (רמה A): כתוביות "identify who is speaking" (Understanding, עודכן 10/8/2026) [ו].
- **פורמטים**: WebVTT ‏(CRD ‏20/5/2026) — `<v Name>` לדובר, `<lang he>` לשפה (BCP 47), מחלקות צבע מובנות (`white`, ‏`lime`, ‏`cyan`, ‏`yellow`…) ובחירה ב־`::cue(v[voice="…"])`; TTML/EBU-TT — `ttm:agent` ו־`xml:lang`; ב־SRT אין מקום לזה [ו].

### 2.3 נורמות בעברית
מדריך Netflix לעברית (28/4/2026): 42 תווים בשורה, עד 17 תווים לשנייה (ילדים 13), "Do not use italics" (ולכן שפה זרה לא מסומנת בנטוי, בניגוד לאנגלית), מקף בלי רווח לדובר השני, FN בין מקפים [ו]. כללי השידור הישראליים לזיהוי דובר בצבע — לא נמצא מקור רשמי מקוון [?].

## 3. ממשק תמליל עם דוברים, מגדר, נגישות צבע וזכוכית

### 3.1 דפוסים במוצרי תמלול ופגישות (מהתיעוד הרשמי)
- **Pixel Recorder**: ‏"auto-detect different speakers and label them as Speaker 1, Speaker 2…"; שינוי שם מתפריט שליד התווית ("Rename", ‏"Create a new speaker"); שינוי בפסקה אחת "won't change" פסקאות אחרות, ואפשר לפצל פסקה; עיבוד במכשיר, ומודלי הקול "deleted within a few minutes after labeling"; תוויות דובר "only in US English" [ו].
- **Microsoft Teams**: התמליל "includes each speaker's name and time stamp"; ‏"Participants can choose to hide their identities in meeting captions and transcripts"; כולם רואים הודעה שהמפגש מתומלל; שפת הדיבור מוגדרת מראש ו־"Teams will detect the language mismatch" [ו].
- **המכנה המשותף**: תווית דובר אחת בראש כל תור/פסקה (לא בכל שורה) + חותמת זמן; שם ברירת מחדל ממוספר וניטרלי; שני היקפי עריכה (הדובר כולו / פסקה אחת); פרטיות — טביעות קול זמניות ואפשרות לא להיות מזוהה; שפה שנבחרה נבדקת מול השמע ולא נכפית.

### 3.2 מגדר — האם, מתי ואיך
- **התעשייה מתרחקת מהסקת מגדר כתכונת זהות.** Microsoft ‏(21/6/2022) פרשה מיכולות ש־"purport to infer… identity attributes such as gender and age" (לקוחות קיימים עד 30/6/2023), בנימוק הסיכון ל־"stereotyping, discrimination, or unfair denial of services" [ו]. AWS: חיזוי בינארי "doesn't indicate a person's gender identity", סף **99%** לשימושים רגישים, ולא להחלטות שנוגעות בזכויות או בפרטיות [ו].
- **מדריכי הכתוביות**: DCMP — לדובר לא ידוע "inclusive, non-gendered language"; ‏Netflix — ‏`[woman]` "so as not to provide information that is not yet present in the narrative", ובעברית גם `[רופא.ה]`; ‏BBC — מגדר או גיל רק "if this is necessary for the viewer's understanding" [ו].
- **בתרגום**: Google Translate מציג שתי צורות כשהמקור ניטרלי ("Translations are gender-specific"), מ־12/2018 [ו]. בעברית המגדר נדרש לפעלים בגוף ראשון ("אני חושב/חושבת") ולפנייה בגוף שני — כלומר **נתון דקדוקי לתרגום, לא זהות** (מסקנה שלי) [ח].

### 3.3 צבע ונגישות
- **WCAG 2.2** ‏(12/12/2024): ‏1.4.1 (A) — "Color is not used as the only visual means of conveying information"; ‏1.4.3 (AA) — טקסט **4.5:1**, טקסט גדול 3:1; ‏1.4.11 (AA) — רכיבים גרפיים **3:1** [ו]. ‏HIG ‏(Accessibility): אותם ספים (עד 17pt — ‏4.5:1), לבדוק "in both light and dark appearances", ו־"Convey information with more than color alone… red-green and blue-orange" [ו].
- **Okabe–Ito** ‏(2002, עודכן 2008): `#E69F00 #56B4E9 #009E73 #F0E442 #0072B2 #D55E00 #CC79A7` — פלטה שנבנתה לעיוורון צבעים [ו]. **אבל כטקסט על רקע בהיר היא נכשלת**: מול `#F2F2F7` רק הכחול עובר (4.65); הכתום 2.02, התכלת 2.07, הצהוב 1.19 [חישוב שלי].
- **מדידה שלי** (סימולציית Machado 2009 בעוצמה מלאה + ‏ΔE00): כשכל הצבעים באותה בהירות — מה שנדרש כדי שכולם יעברו 4.5:1 — רק **4 גוונים** נשארים נבדלים בכל סוגי העיוורון (‏ΔE00 מינימלי ≈ 9); בצבע החמישי הוא צונח ל־**2.2** בדויטרנופיה. גם ארבעת צבעי BBC על שחור: צהוב מול ירוק ‏ΔE00 ‏**4.1** בפרוטנופיה. ← צבע הוא רמז משני; שם או ראשי תיבות — תמיד.

### 3.4 זכוכית — העקרונות שפורסמו
HIG ‏Materials (עודכן 9/9/2025): ‏"Liquid Glass forms a distinct functional layer for controls and navigation elements… that floats above the content layer"; ‏"**Don't use Liquid Glass in the content layer**"; ‏"Use Liquid Glass effects sparingly"; הגרסה regular לרכיבים "with a significant amount of text, such as alerts, sidebars, or popovers"; הגרסה clear "Only… over visually rich backgrounds", ועם תוכן בהיר — "a dark dimming layer of **35%** opacity"; בשכבת התוכן — standard materials וצבעי vibrant מעליהם; חומר עבה = ניגודיות טובה יותר לטקסט; הכל מגיב ל־Reduce Transparency ו־Increase Contrast [ו]. מימוש ברשת: `docs/research/desktop/04-web-glass-layout-pwa.md`.

## 4. מה זה אומר לנו

### 4.1 זיהוי שפה (שדרוג א)
1. **שפה לכל קטע, ולכל מילה כשהמנוע נותן** — לא לקובץ. לקטע: `lang` ‏(BCP 47: ‏`he`/`en`/…), ‏`langConf` ‏(0–1), ‏`langSrc` ‏(`asr`/`user`/`smooth`).
2. **השפה שהמשתמש בחר היא רמז, לא מגבלה.** מועמדות מצומצמות: הנבחרת + עברית + אנגלית (2–3, לפי הקונצנזוס). קטע שזוהה בביטחון גבוה בשפה אחרת — מסמנים, ובפעם הראשונה מציעים בשורה אחת "נשמע כמו אנגלית — לעדכן?" (דפוס זיהוי אי־ההתאמה בפגישות). לא כופים, כי הגבלה קשיחה מייצרת תמליל בשפה הלא נכונה (Azure, ‏AWS).
3. **סף ודאות ושפת גיבוי**: מתחת לסף → `unknown` ושפת ברירת המחדל; לא מנחשים בשקט.
4. **החלקה**: קטע קצר או מילה זרה בודדת יורשים את שפת המשפט (Soniox מתייג "amigo" במשפט אנגלי כ־`en`; ‏Azure לא מחליף שפה בתוך משפט). הספים — לכיול על סט הזהב [הצעה].
5. **סט בדיקה**: קטעי עירוב עברית–אנגלית מתויגים ידנית; מדד — דיוק שפה לקטע ו־WER לפי שפה. מנועים שתיעודם מכסה עירוב עם עברית: AssemblyAI U-3.5 Pro, ‏Gladia Solaria-1, ‏AWS Multi, ‏Deepgram ‏`multi` — כולם בתשלום, ולכן רק באישור מפורש עם מחיר.

### 4.2 כתוביות התרגום לעברית
1. **קטע שנאמר בעברית — בלי כתובית** כברירת מחדל (הכלל לשורות בשפת היעד), עם מתג "הצג גם קטעי עברית". טקסט על המסך שכבר בעברית — לא מתורגם.
2. **שפה שלישית** (לא אנגלית ולא עברית): מתרגמים, ומוסיפים `[בספרדית]` **רק בכתובית הראשונה אחרי המעבר**. זו הצורה של "מתורגם" — והיא ניטרלית מגדרית. לעולם לא `[שפה זרה]`.
3. **שני דוברים בכתובית**: מקף בלי רווח לדובר השני, שורה לכל דובר; עד 42 תווים בשורה, ‏≤17 תווים לשנייה; בלי נטוי.
4. **צבע על הווידאו — כבוי כברירת מחדל** (גופן לבן לפי Netflix; אצלנו עם מתאר שחור). כשמדליקים: לבן ← צהוב ← ציאן ← ירוק, צבע קבוע לכל דובר, ומעל 4 דוברים — תווית שם (לפי BBC).
5. **ייצוא**: WebVTT עם `<v שם>` ו־`<lang en>`; ב־SRT המידע הזה הולך לאיבוד.

### 4.3 התמליל (בשתי המערכות)
- **דובר יחיד — בלי תוויות ובלי צבעים.** משני דוברים ומעלה: בראש כל תור — נקודה או עיגול צבעוני עם ראשי תיבות לבנים, שם בצבע הטקסט הרגיל, חותמת זמן, ו**תג שפה קטן (`EN`) רק כשהשפה משתנה** ביחס לתמליל או לתור הקודם. בתוך תור עברי — מילים באנגלית ב־`<bdi>` / ‏`dir="auto"` עם `lang` ‏(W3C i18n).
- **מקרא דוברים** בשורת צ'יפים: צבע, שם, זמן דיבור; הקשה מסננת. ברירת מחדל "דובר 1"; שם אמיתי רק כשהמשתמש נתן, או כשהשם נאמר או הופיע על המסך (DCMP: לא לפני שהדובר הוצג). שני היקפי עריכה: הדובר כולו / פסקה זו, ו"דובר חדש".
- **צבע לפי סדר ההופעה, קבוע לכל הסרטון.** ארבעת הראשונים בטוחים לעיוורון צבעים; 5–6 נשענים על ראשי התיבות; מעבר לזה — מחזור עם מספר.

**פלטה מומלצת** (מחושבת; גוונים במשפחות Okabe–Ito, בהירות שווה):

| # | גוון | בסיס — נקודה/עיגול בשתי הערכות + טקסט בבהיר | טקסט בכהה |
|---|---|---|---|
| 1 | כחול | `#016EBE` | `#4AA6FE` |
| 2 | כתום־אדום | `#B74A01` | `#FB7F40` |
| 3 | טורקיז | `#047B59` | `#0DB886` |
| 4 | מג'נטה | `#AF4191` | `#ED79CA` |
| 5 | ענבר | `#8E6502` | `#D39702` |
| 6 | סגול | `#904EBA` | `#C886F6` |
| — | לא ידוע | `#6C6C6C` | `#A2A2A2` |

ניגודיות — **בסיס**: מול `#F2F2F7` ‏4.70, מול `#FFFFFF` ‏5.25 (טקסט AA), מול `#1C1C1E` ‏3.24 ומול `#000` ‏4.00 (גרפי AA), ראשי תיבות לבנים עליו 5.25. **טקסט בכהה**: מול `#1C1C1E` ‏6.64, מול `#000` ‏8.20. הבחנה (‏ΔE00 מינימלי, הגרוע מבין ראייה רגילה, פרוטנופיה, דויטרנופיה וטריטנופיה): 4 ראשונים — **9.0** (בסיס) ו־**8.5** (כהה); עם החמישי והשישי — 2.2–3.3. הרקעים הם הטוקנים הקיימים (`styles.css`, ‏`studio.css`). לפני אימוץ — לאמת בכלי הצבע של המערכת.

### 4.4 מגדר באחריות
- **לא תווית זהות.** אין "גבר/אישה" ליד שם הדובר. שומרים `gram: m|f|unknown` עם `gramConf` ו־`gramSrc` ‏(`voice`/`text`/`user`) **כנתון לתרגום בלבד**.
- **מוצג רק בכרטיס הדובר**, בניסוח "צורת פנייה בתרגום: זכר / נקבה / לא ידוע", ניתן לעריכה; תיקון המשתמש גובר ומתפשט לכל התורים של הדובר.
- **ספים**: הסקה מהקול בלבד — רק בביטחון גבוה מאוד (רף AWS לשימושים רגישים: 99%), ועדיף רמז מהטקסט ("אני עייפה"). בלי ודאות → `unknown`, ניסוח ניטרלי בתרגום, ובתגיות — `[בספרדית]`, ‏`[קריין.נית]`.
- **פרטיות**: טביעות קול זמניות למשך העיבוד בלבד (דפוס "נמחק תוך דקות"); בלי זיהוי אנשים מול מאגר.

### 4.5 זכוכית
- זכוכית **רק בשכבות הצפות**: סרגל עליון, מקרא הדוברים, בקרי הנגן ותפריטים. שורות התמליל — על משטח אטום (`--surface`) בטקסט `--on-surface`.
- מעל וידאו — רק זכוכית שקופה עם עמעום כהה (35% על תמונה בהירה); כתוביות לא יושבות על זכוכית.
- ניגודיות נמדדת מול המשטח האטום שמתחת; ב־`prefers-reduced-transparency` ובניגודיות מוגברת — משטח אטום.

## מקורות
כולם נבדקו ב־16/11/2026; בסוגריים — תאריך העדכון שבעמוד, אם יש.

**שירותי תמלול**
- Google Cloud: [Chirp 3](https://docs.cloud.google.com/speech-to-text/docs/models/chirp-3) · [Multiple languages (V2)](https://docs.cloud.google.com/speech-to-text/v2/docs/multiple-languages) · [Release notes](https://docs.cloud.google.com/speech-to-text/docs/release-notes) (13/10/2025: זיהוי שפה ל־Chirp 3)
- AWS Transcribe: [Language identification](https://docs.aws.amazon.com/transcribe/latest/dg/lang-id.html) · [Batch](https://docs.aws.amazon.com/transcribe/latest/dg/lang-id-batch.html)
- Azure Speech: [Language identification](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-identification) (4/11/2026) · [LID + diarization](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/configure-language-identification-diarization) (10/8/2026) · [Fast transcription](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/fast-transcription-create) (19/10/2026)
- Deepgram: [Code-switching](https://developers.deepgram.com/docs/multilingual-code-switching) · [Models & languages](https://developers.deepgram.com/docs/models-languages-overview) · [Changelog](https://developers.deepgram.com/changelog/speech-to-text-changelog) (23/10/2026)
- AssemblyAI: [Language detection](https://www.assemblyai.com/docs/speech-to-text/pre-recorded-audio/automatic-language-detection) · [Code switching](https://www.assemblyai.com/docs/pre-recorded-audio/code-switching)
- Speechmatics: [Languages](https://docs.speechmatics.com/speech-to-text/languages) · [Language identification](https://docs.speechmatics.com/speech-to-text/batch/language-identification)
- ElevenLabs: [Speech to text](https://elevenlabs.io/docs/capabilities/speech-to-text)
- Gladia: [Code switching](https://docs.gladia.io/chapters/language/code-switching) · [Supported languages](https://docs.gladia.io/chapters/language/supported-languages)
- Soniox: [Language identification](https://docs.soniox.com/stt/concepts/language-identification) · [Language restrictions](https://docs.soniox.com/stt/concepts/language-restrictions) · [Supported languages](https://docs.soniox.com/stt/concepts/supported-languages)
- OpenAI: [Speech to text](https://developers.openai.com/api/docs/guides/speech-to-text)

**כתוביות**
- Netflix: [Hebrew TTSG](https://partnerhelp.netflixstudios.com/hc/en-us/articles/220636427-Hebrew-Timed-Text-Style-Guide) (28/4/2026) · [English (USA) TTSG](https://partnerhelp.netflixstudios.com/hc/en-us/articles/217350977-English-USA-Timed-Text-Style-Guide) (28/4/2026)
- [BBC Subtitle Guidelines](https://www.bbc.co.uk/accessibility/forproducts/guides/subtitles/) (גרסה 1.2.5, מרץ 2026)
- DCMP Captioning Key: [Speaker Identification](https://dcmp.org/learn/captioningkey/603) · [Special Considerations](https://dcmp.org/learn/captioningkey/604)
- FCC: [47 CFR 79.1(j)(2)](https://www.law.cornell.edu/cfr/text/47/79.1)
- W3C: [Understanding 1.2.2](https://www.w3.org/WAI/WCAG22/Understanding/captions-prerecorded.html) (10/8/2026) · [WebVTT](https://www.w3.org/TR/webvtt1/) (CRD 20/5/2026) · [WCAG 2.2](https://www.w3.org/TR/WCAG22/) (12/12/2024) · [Inline bidi markup](https://www.w3.org/International/articles/inline-bidi-markup/)

**ממשק, מגדר, צבע, זכוכית**
- [Pixel Recorder — speaker labels](https://support.google.com/pixelphone/answer/16269004) · [Teams — live transcription](https://support.microsoft.com/en-us/office/view-live-transcription-in-microsoft-teams-meetings-dc1a8f23-2e20-4684-885e-2152e06a4a8b)
- [Azure blog — facial recognition safeguards](https://azure.microsoft.com/en-us/blog/responsible-ai-investments-and-safeguards-for-facial-recognition/) (21/6/2022) · [AWS Rekognition — face attributes](https://docs.aws.amazon.com/rekognition/latest/dg/guidance-face-attributes.html)
- [Google Research — gender-specific translations](https://research.google/blog/providing-gender-specific-translations-in-google-translate/) (12/2018) · [Translate Help](https://support.google.com/translate/answer/9179237)- HIG: [Materials](https://developer.apple.com/design/human-interface-guidelines/materials) (9/9/2025) · [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)
- Okabe & Ito: [Color Universal Design](https://jfly.uni-koeln.de/color/) (2002, עודכן 2008); ערכי ה־hex — מתוך [R ‏`palette.colors`](https://github.com/wch/r-source/blob/trunk/src/library/grDevices/R/colorstuff.R)
- שיטת המדידה בסעיפים 3.3 ו־4.3: Machado, Oliveira & Fernandes, ‏*A Physiologically-based Model for Simulation of Color Vision Deficiency*, ‏IEEE TVCG 15(6), 2009; ‏ΔE00 — ‏CIE 142-2001. הניגודיות לפי נוסחת WCAG. [שיטה; החישוב שלי]
- פנימי: `docs/research/video-analysis/04-audio-asr.md` (מודלים פתוחים, עירוב בעברית) · `docs/research/desktop/04-web-glass-layout-pwa.md` (זכוכית ברשת)
