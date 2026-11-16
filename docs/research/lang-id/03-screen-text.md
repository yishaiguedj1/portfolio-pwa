# טקסט רב־לשוני על המסך: זיהוי שפה לשורה ולקטע, סדר קריאה דו־כיווני ו־OCR על CPU (מצב ל־16/11/2026)

> סטטוס: הושלם 16/11/2026.
> היקף: שקפים, וובינרים, שיתוף מסך וכתוביות צרובות, כשבאותו מסך (ולעתים באותה שורה) יש עברית, אנגלית ושפות נוספות.
> משלים את `docs/research/video-analysis/03-slides-ocr-visual.md` §3 (מנועים, דיוק ומהירות) — לא חוזר עליו.
> סימון ודאות: **[ודאי]** — נקרא במקור ראשוני (קוד, תקן, תיעוד רשמי) · **[סביר]** — מקור משני או דיווח עצמי · **[השערה]** — הסקה שלנו, דורשת מדידה.

## תקציר
1. **בשורה מעורבת, הבעיה היא הסדר ולא הזיהוי.**
   - על 209 שורות עברית+אנגלית: ‏14.3% CER עם סדר, ו־1.7% בלי סדר (heb_rivok 2.0, דיווח עצמי).
   - בסימולציה שלי, `ocr.py` נכשל ב־4 מתוך 14 שורות RTL: מספרים מופרדים ברווח, "C++", ופיסוק בקצה רצף. הוא נכשל גם בשורה אנגלית שיש בה מילה עברית.
2. **השורש ב־Tesseract** (`ResultIterator::CurrentParagraphIsLtr`): תיקו במספר המילים הופך את הפסקה ל־LTR ([#4680](https://github.com/tesseract-ocr/tesseract/issues/4680)).
   - **השפה הראשונה ב־`-l` קובעת את פריסת העמודות.** `heb+eng` היא RTL.
   - `script/Hebrew` ו־`eng+heb` פורסים LTR. בדקתי: ב־`script/Hebrew` יש 54 תווי L מול 30 תווי R.
3. **השפה נבחרת לכל קבוצת מילים.** הקבוצה רצה בכל מודל, ונבחרת התוצאה הטובה יותר. העלות כמעט פי 2.
   - **התג לכל מילה זמין ב־hOCR** (`lang`, ‏`dir`), אבל לא ב־TSV שאנחנו מפיקים.
4. **ל־bidi אין היפוך תקני.** המעבר מתצוגה ללוגי הוא "many-to-one".
   - **הפעלת UBA על סדר התצוגה, עם כיוון פסקה נכון, פתרה 14 מתוך 14 מקרים בסימולציה.** זו הגישה של Kraken.
   - כיוון הפסקה צריך לבוא מהפריסה (HL1): יישור, תבליט, רוב השקף.
5. **אין מנוע פתוח אחר שמחזיר שפה לכל מילה.**
   - PP-OCR, ‏EasyOCR ו־MMOCR בלי עברית.
   - paddleocr-hebrew (attention, סדר לוגי) הוא מועמד מעניין, אבל לא אומת.
   - VLM כבד מדי ל־CPU.
6. **שפה בתוך הכתב הלטיני על 1–3 מילים לא אמינה.** מילה אנגלית בודדת: ‏22–84%, תלוי בכלי.
   - ברירת המחדל לקטע לטיני בשקף עברי היא `en`, עם סיווג "לא לתרגם" לשמות ולקוד.
7. **בהמשך**:
   - מונחים מהשקף כ־prompt: ‏‎-11% עד ‎-14.3% WER ב־SlideAVSR, באנגלית ועם fine-tune.
   - שקף בעברית הוא זיכרון מונחים לתרגום.
   - לא נמצא סט ציבורי של עברית+אנגלית, ולכן בונים סט זהב משלנו.

## 1. Tesseract רב־לשוני: איך `heb+eng` עובד בפועל

**מקריאת הקוד** (ענף main, נקרא 16/11/2026) **[ודאי]**:

1. **השפה הראשונה ב־`-l` היא הראשית.** את השאר `init_tesseract` טוען ל־`sub_langs_`.
   - היא קובעת את **כיוון הפריסה**: `right_to_left_ = unicharset.major_right_to_left()`, כלומר ספירה של תווי R/AL/AN מול L.
   - בכיוון RTL, ‏`ColumnFinder::ReflectForRtl` משקף את התיבות "so that the blocks get created in the correct RTL order", ולכן העמודה הימנית נקראת ראשונה.
   - **`heb+eng` נותן פריסת RTL. ‏`eng+heb` נותן LTR.**
2. **השפה נבחרת לכל קבוצת מילים.**
   - במנוע LSTM, מילים סמוכות בשורה מתאחדות ל־combination. האיחוד נעצר כשהרווח גדול מפי 2 מגובה השורה, או כשהגובה חורג מפי 1.25.
   - `classify_word_and_language` מנסה קודם את השפה שניצחה בקבוצה הקודמת. אם הכל התקבל, הוא עוצר.
   - אחרת **כל הקבוצה רצה גם במודל השני**, ו־`SelectBestWords` בוחר לכל תת־רצף את הגרסה עם certainty ו־rating טובים יותר.
   - **המשמעות**: שורה מעורבת עולה בערך פי 2 בזמן, ולכל מילה נשמר המודל שזיהה אותה (`WordRecognitionLanguage()`).
   - **ב־hOCR יש `lang` ו־`dir`** לפסקה, ולמילה כשהם שונים מהפסקה. **ב־TSV, שבו אנחנו משתמשים, אין שפה.**
3. **הסדר בפלט נקבע ב־`ResultIterator`**, גם ב־TSV. ‏`CurrentParagraphIsLtr` מחליט את כיוון הפסקה:
   1. מילה RTL בקצה השמאלי של השורה הראשונה: הפסקה RTL.
   2. מילה LTR בקצה הימני: הפסקה LTR.
   3. אחרת, רוב המילים קובע. **בתיקו — LTR.** מספרים נחשבים נייטרליים.
   - **זה השורש של [#4680](https://github.com/tesseract-ocr/tesseract/issues/4680)** (פתוח מ־7/11/2026, תווית RTL מ־15/11):
     - "הרצאה על Machine Learning" הוא 2 מול 2, ולכן יוצא "Machine Learning הרצאה על".
     - גם כותרת "דוח שנתי Annual Report" מעל פסקה עברית נקראת הפוך ב־`--psm 3`. ב־`--psm 6` היא נקראת נכון, כי היא נבלעת בפסקה עברית.
   - `ocr.py` ממיין לפי x ולכן עוקף את הכלל. הקיבוץ לשורות עדיין של Tesseract.
4. **מודל כתב, `script/Hebrew`**: עברית ואנגלית במודל אחד, בריצה אחת ("Most of the script models include English training data").
   - **מלכודת שבדקתי** (`combine_tessdata -u`):

     | מודל | תווי L | תווי R | פריסה |
     |---|---|---|---|
     | `script/Hebrew` (fast) | 54 | 30 | **LTR** |
     | `heb` של Ubuntu | 1 | 27 | RTL |

   - heb_rivok ריפד את הרשימה ב־23 תווים עבריים.
   - [PR #4629](https://github.com/tesseract-ocr/tesseract/pull/4629) (פתוח, 26/9/2026) מציע `tessedit_right_to_left` עם הערכים ‎-1/0/1.
5. **heb_rivok 2.0** (13/11/2026, Apache-2.0, דיווח עצמי) — [README](https://github.com/RivoksLab/tesseract-heb-rivok):
   - עברית, אנגלית וספרות במודל אחד, **בלי** `+eng`.
   - על 209 שורות מעורבות: ‏14.3% CER, לעומת 19.3% ב־`heb` של Ubuntu. **"nearly all of … 14.3% is word order: counting characters regardless of order, 1.7%"**.
   - **בשורה מעורבת הזיהוי כמעט נקי, והבעיה היא הסדר.**
   - paddleocr-hebrew, שמרכיב את השורה בסדר עברי, מגיע ל־3.6% על אותן שורות.
   - זמן לעמוד עיתון: `heb` ‏2.4 שניות, ‏`heb+eng` ‏4.5 שניות, heb_rivok ‏3.5 שניות. **[סביר]**
6. **פרטים נוספים**:
   - **psm 7/13** וכותרת שהיא פסקה לבדה — חשופים לתיקו. ‏psm 11/12 פירקו אנגלית (18.2% במחקר הקודם).
   - **OSD** (`--psm 0`, ‏legacy) מזהה כתב **לעמוד**, עם `min_characters_to_try` ‏=50. לא מתאים לקטע בשורה.
   - **best מול fast**: בעברית יצא אותו CER במחקר הקודם. ‏`heb`: ‏0.96MB מול 3.7MB.
   - **`preserve_interword_spaces`** משפיע רק על רווחים בפלט טקסט.
   - **גרסה**: ‏5.5.4 (28/10, כנראה 2026) תיקנה "use-after-free in ReplaceCurrentWord with several languages" — המסלול של `heb+eng`. ב־Ubuntu 24.04 יש 5.3.4. **[סביר]**
   - **סוגריים**: '(' לוגי ברצף RTL מצויר ')' (UAX #9 L4). המודל צריך להוציא את התו הלוגי. זה לא נמדד, ולכן צריך מקרי בדיקה. **[השערה]**

## 2. מנועים חלופיים לשורות מעורבות

**ההבחנה המכרעת: CTC מול attention** **[ודאי]**:
- **מפענח CTC** (ה־LSTM של Tesseract, ה־rec של PP-OCR, ‏Kraken) מיושר מונוטונית לאורך התמונה, ולכן מוציא **סדר תצוגה**. סדר לוגי דורש שלב bidi.
  - Kraken מאמן על סדר תצוגה ומחזיר `logical_order(base_dir)`.
  - paddleocr-hebrew כותב ש־CTC רגיל "silently drops" רצפים לטיניים וספרות בתוך עברית. לכן הוא מנתב כ־10% מהחיתוכים ל־NRTR.
- **מפענח attention** (NRTR, ‏TrOCR, ‏VLM) מוציא **סדר לוגי ישירות**: "reads a whole line's BiDi in one pass".

| מנוע | עברית | שפה למילה | סדר הפלט | רישיון | הערה |
|---|---|---|---|---|---|
| Tesseract 5 ‏`heb+eng` | כן | כן (hOCR) | היוריסטיקה | Apache-2.0 | סעיף 1 |
| heb_rivok 2.0 | כן, עם אנגלית | לא | היוריסטיקה של Tesseract | Apache-2.0 | דיווח עצמי |
| paddleocr-hebrew 0.1.x | עברית, לטינית וספרות | לא | **לוגי** | Apache-2.0 | ‏ONNX, כ־370MB, ‏7.56% לעמוד. על גופן לא מוכר: "confident garbage — sometimes Latin characters" |
| PP-OCRv5/v6, ‏RapidOCR, ‏EasyOCR, ‏MMOCR 1.0.1 | **לא** | לא. ‏`lang` נבחר לכל מודל | תצוגה | Apache-2.0 | ‏MMOCR לא מתוחזק מ־2023 |
| docTR 1.1.0 (21/8/2026) | vocab בלבד, בלי מודל | לא | — | Apache-2.0 | |
| Surya 2.5 | 76.8% במבחן שלהם | לא (VLM אחד) | לוגי | קוד Apache. משקלים חינם עד $5M | ‏llama.cpp על CPU |
| Kraken (eScriptorium) | מודלים לכתבי יד ולדפוס היסטורי. לא נבדקו לטקסט מסך | לא | תצוגה, ואז UBA ללוגי | Apache-2.0 | הדפוס הרלוונטי לנו |
| GOT-OCR2 ‏(0.7B, ‏Apache-2.0), ‏Florence-2 ‏(0.77B, ‏MIT) | אין רשימת שפות בכרטיס המודל, ואין ראיה לעברית | לא | — | | |
| VLM (‏dots.ocr, ‏Qwen3-VL וכו') | ב־GlotOCR, ‏Acc@5: ‏55 / ‏33 | רק ב־JSON בפרומפט | לוגי | שונה לכל מודל | דקות לעמוד על CPU (המחקר הקודם §4) |

**מסקנה** **[סביר]**:
- רק Tesseract (ב־hOCR) מחזיר תג שפה למילה.
- זיהוי הכתב מהתווים מספיק, **בתנאי** שהמודל לא כתב את המילה בכתב הלא נכון. ‏`heb` לבדו הופך אנגלית לג'יבריש עברי, ו־paddleocr-hebrew מחזיר לפעמים לטינית.
- לכן התיוג צריך גם ביטחון ומקור, לא רק Unicode.

## 3. זיהוי כתב ושפה לכל מילה וקטע בשורה

**א. כתב לכל תו, אחרי ה־OCR** — טריוויאלי **[ודאי]**:
- לפי טווחי Unicode, או `\p{Script=Hebrew}` בחבילת `regex`.
- ספרות, פיסוק וסמלים הם Common, כלומר נייטרליים. גם ב־MLT יש להם מחלקה נפרדת, "Symbols" ("+ / >"), ועוד מחלקה "Mixed".
- **המלכודת**: מודל שכותב בכתב הלא נכון. ‏`heb` לבדו כתב "חסו03ו|8". לכן מצליבים עם `lang` ועם הביטחון.

**ב. כתב לכל קטע תמונה, לפני ה־OCR** — נחוץ רק לניתוב בין מנועים **[ודאי]**:
- **[RRC-MLT-2019](https://arxiv.org/abs/1907.00945)**:
  - 20,000 תמונות, ‏10 שפות ו־7 כתבים, ועוד Symbols. **אין עברית.**
  - כתב למילה חתוכה: **94.03%** (המקום הראשון). זיהוי וכתב יחד: ‏Hmean ‏80.84%. ‏end-to-end: ‏59.15%.
- **[Fujii et al. 2017](https://arxiv.org/abs/1708.04671)**: כתב **לשורה**, ‏30 כתבים ו־232 שפות.
  - פחות 16% שגיאות זיהוי כתב.
  - פחות 33% מה־CER שנבע מזיהוי כתב שגוי.
- **אצלנו**, בעברית מול לטינית, התחרות בין המודלים ב־`heb+eng` כבר עושה את זה.
  - מסווג נפרד יידרש רק אם ננתב שורות לטיניות למנוע אחר, למשל PP-OCRv6 (המחקר הקודם).

**ג. שפה בתוך אותו כתב** (אנגלית מול צרפתית) — קשה בטקסט קצר **[ודאי]**:
- **[lingua-py](https://github.com/pemistahl/lingua-py)** (Apache-2.0) — דיוק ממוצע על 75 שפות, כשכל השפות פעילות:

  | כלי | מילה בודדת (5 תווים ומעלה) | זוג מילים | משפט |
  |---|---|---|---|
  | Lingua high | 74% | 89% | 96% |
  | langdetect | 65% | 82% | 98% |
  | CLD3 | 48% | 67% | 93% |
  | langid | 48% | 65% | 90% |

  - **באנגלית, מילה בודדת**: 55% ב־Lingua, ‏84% ב־langid, ‏22% ב־CLD3. זוג מילים ב־Lingua: ‏88%.
  - **בעברית**: 100% בכל הכלים, כי הכתב ייחודי.
  - `detect_multiple_languages_of` מחזיר קטעים עם אינדקסים. הוא עדיין "experimental", ועובד הכי טוב "with multiple long words for each language".
- **[fastText lid.176](https://fasttext.cc/docs/en/language-identification.html)**:
  - 176 שפות. ‏`.bin` ‏126MB, ‏`.ftz` ‏917KB.
  - **רישיון CC-BY-SA-3.0.**
- **[GlotLID v4](https://huggingface.co/cis-lmu/glotlid)** (Apache-2.0 "plus notices"):
  - 2,060 תוויות שכוללות כתב.
  - אומן על "random short spans", ולכן "markedly better on short text and calibrated".
  - small: ‏131MB, ו־`.ftz` ‏35MB.
  - תומך ב־**MaskLID** לטקסט שמחליף שפות.

**ד. שמות, מותגים, קוד ומספרים בשורה עברית** **[השערה]**:
- רוב הקטעים הלטיניים בשקף עברי **אינם אנגלית לתרגום**: שם מוצר, ראשי תיבות, מזהה קוד, כתובת, יחידה או נוסחה.
- סיווג זול לפני LID:
  - regex לכתובות ולמיילים.
  - סימני קוד: camelCase, ‏snake_case, ‏`()` ‏`::` ‏`->` ‏`=`.
  - מספר עם יחידה.
  - אותיות רישיות בלבד.
  - אות גדולה באמצע משפט.
  - מילון תדירות אנגלי.
- **ברירת המחדל לקטע לטיני של 1–3 מילים היא `en`.** ‏LID מ־4 מילים, או כשיש סימנים מבחינים (é, ñ, ü).
- **כל מודל נוסף ב־`-l` מוסיף ריצה** על כל מילה שלא התקבלה.
  - לכן מוסיפים `ara` או `rus` רק אחרי שמעבר ראשון מרמז עליהם.
  - קירילית הוחרגה ממודלי ה־script בגלל "major ambiguity problem" עם לטינית.

## 4. סדר קריאה דו־כיווני (UAX #9): מתיבות ויזואליות לטקסט לוגי

**התקן** — [UAX #9](https://www.unicode.org/reports/tr9/), גרסה 52, ‏Unicode 18.0.0, ‏1/9/2026 **[ודאי]**:
- האלגוריתם מוגדר **רק מלוגי לתצוגה**.
- **P2/P3**: התו החזק הראשון קובע את כיוון הפסקה.
- **HL1**: מותר "set the paragraph embedding level explicitly". לכן מותר לנו לקבוע את הכיוון לפי הפריסה.
- **W7**: מספר שלפניו L הופך ל־L. לכן "Python 3" נשאר רצף אחד.
- **N1**: מספרים "act as if they were R" כלפי נייטרליים. לכן "10 - 20" בפסקה עברית מוצג כ־"20 - 10".
- **N0**: לזוג סוגריים כיוון אחד.
- **L4**: שיקוף רק לתו שהכיוון שלו נקבע R.

**אין היפוך תקני** **[ודאי]**:
- לפי [ICU](https://unicode-org.github.io/icu/userguide/transforms/bidi.html), המעבר מתצוגה ללוגי הוא "many-to-one", ומצב ה־inverse רק "approximate".
- ב־ICU4C 79 יש `UBIDI_REORDER_INVERSE_LIKE_DIRECT` ו־`…NUMBERS_AS_L`. מפייתון ניגשים אליהם דרך PyICU.
- **python-bidi 0.6.12** (20/10/2026, ‏LGPL):
  - יש בו רק `get_display` עם `base_dir`.
  - מימוש הפייתון ישן, "pre-6.3" לפי Kraken, כלומר בלי סוגריים זוגיים.
  - יש גם עטיפת Rust.
- **Kraken** (`kraken/lib/bidi`, ‏Unicode 17.0, ‏Apache-2.0, פייתון טהור):
  - מקבל סדר לוגי מ**הפעלת האלגוריתם הרגיל על מחרוזת התצוגה**.
  - `get_display_map` מחזיר גם את הפרמוטציה.

**בדיקה שלי** **[ודאי לסימולציה, השערה לתמונות אמיתיות]**:
- איך: מימוש מינימלי של UAX #9 שכתבתי (W1–W7, ‏N0–N2, ‏I1–I2, ‏L2, ‏L4) ייצר תצוגה ל־15 שורות.
- הנחה: מילה עברית יוצאת מה־OCR בסדר לוגי, ושאר המילים בסדר תצוגה.

| שורה (לוגי) | מה ה־OCR רואה | `ocr.py` היום | UBA(תצוגה, R) |
|---|---|---|---|
| בין 10 - 20 שנים | ה־20 משמאל ל־10 | ✗ "בין 20 - 10 שנים" | ✓ |
| שפת C++ | ה־"++" משמאל ל־C | ✗ "שפת ++C" | ✓ |
| המספרים 1, 2, 3 | הסדר 3, 2, 1, והפסיק משמאל לכל ספרה | ✗ | ✓ |
| פרק 3: מבוא | הנקודתיים משמאל ל־3 | ✗ "פרק :3 מבוא" | ✓ |
| The word שלום means peace (פסקה LTR) | זהה ללוגי | ✗ "means peace שלום The word" | ✗ ב־R, ✓ ב־L |
| עוד 10 שורות: "(AI)", ‏"Python 3", ‏"Windows 10", ‏"20%", ‏"a + b = c", ‏"90/100", ‏"16/11/2026", ‏"שאלה? כן.", ‏"GPT-4o (2024)", ‏"הרצאה על Machine Learning" | — | ✓ | ✓ |

- **התוצאה**:
  - `ocr.py` נכשל ב־4 מתוך 14 שורות RTL, ובשורת ה־LTR.
  - UBA צדק ב־14 מתוך 14, ובשורת ה־LTR כשהכיוון ניתן נכון.
  - גם גרסה ברמת מילה צלחה 9 מתוך 9 מקרים, מהם 6 חדשים: "ב-2026", ‏"הרצאה: Introduction", ‏"(שלום)", ‏"(עמ' 14)", ‏"3.5$", ‏"Python היא שפה". בגרסה הזו כל מילה עברית עוברת `uba(word, R)`, השורה מורכבת לפי x, ואז `uba(line, base)`.
- **שני מקורות שגיאה נשארים**:
  1. **כיוון הפסקה** — שאלה של ראיות.
  2. **סדר התווים בתוך מילה מעורבת** — `CalculateBlobOrder` של Tesseract כבר מסדר אותה לפי הכיוון שהוא החליט.
  - המדויק ביותר: תצוגה מ**תיבות תווים**, עם `-c hocr_char_boxes=1`, ואז `ocrx_cinfo`/`x_bboxes`.

**ראיות לכיוון הפסקה (HL1)** **[השערה]**:
- **קצוות השורה הם ראיה חלשה.** "Python היא שפה" בפסקה RTL נראה על המסך כ־"שפה היא Python".
- **הראיות החזקות**:
  1. יישור לקצה ימני משותף בבלוק.
  2. תבליט או מספור מימין.
  3. רוב הכתב בשקף.
  4. חלק האותיות העבריות.
  5. עקביות בין פריימים.
- **שתי עמודות**: ‏`heb+eng` כבר מסדר מימין לשמאל.
- **זוג מקביל**: שני בלוקים זה לצד זה, בשפות שונות ובמספר שורות דומה, הם כנראה אותו תוכן. זה **מילון מונחים חינמי**, ואין לתרגם אותו פעמיים.

## 5. איחוד לאורך זמן ושימוש בהמשך (תמלול ותרגום)

**הצבעה בין פריימים** **[השערה]** (ההצבעה הכללית — במחקר הקודם §6):
- מצביעים על **טקסט ותג שפה לכל מילה**, לפי מעקב תיבות.
- **לא מצביעים על הסדר.** הוא נגזר מהגאומטריה ומהכיוון.
- **על כיוון הבלוק כן מצביעים**, כדי שתיקו בפריים אחד לא יהפוך שורה.
- מילה שמופיעה בפחות מחצי מהפריימים (סמן, חלון קופץ) יורדת.

**השפה על המסך כרמז לשפה המדוברת** **[השערה]**:
- ב־faster-whisper 1.2.1 יש `language_detection_threshold` (ברירת מחדל 0.5) ו־`multilingual` לכל קטע.
- כשהזיהוי מהשמע מתחת לסף, מצמצמים את המועמדות לשפות שעל המסך.
- **אסור לגבור על זיהוי שמע בטוח.** הרצאה בעברית עם שקפים באנגלית שכיחה.

**מונחים מהשקף כאוצר מילים לתמלול**:
- **המגבלות** ([המדריך של Whisper](https://developers.openai.com/cookbook/examples/whisper_prompting_guide)) **[ודאי]**:
  - "only the final 224 tokens of the prompt will be considered".
  - "not especially reliable".
  - "will not override the model's comprehension of the audio".
  - ב־faster-whisper, ‏`hotwords` הם טוקני prompt שנחתכים ל־223, ואין להם השפעה כשיש `prefix`.
- **[SlideAVSR](https://aclanthology.org/2024.alvr-1.11.pdf)** (ALVR @ ACL, ‏16/8/2024) **[ודאי]**:
  - Whisper large-v3 עבר fine-tune עם טקסט ה־OCR של השקף כ־prompt.
  - WER ירד מ־8.07 ל־**6.91** (‏‎-14.3%) ב־TestA, ומ־11.25 ל־**10.01** (‏‎-11%) ב־TestB.
  - יותר מילים עזרו, עד 100.
  - מיון לפי נדירות עזר ב־25 מילים, והזיק מעל 50.
  - **הסתייגות**: אנגלית בלבד, ועם fine-tune.
- **ליישום** **[השערה, למדידה]**:
  - לכל חלון תמלול: המונחים הלטיניים והשמות מהשקפים שעל המסך באותו זמן, עד כ־50.
  - עדיף בתוך משפט עברי קצר, כדי לא לדחוף לפלט באנגלית.
  - עברית צורכת הרבה טוקנים מתוך ה־223.

**תרגום** **[השערה]**:
- שקף שכבר בשפת היעד לא מתרגמים. משתמשים בו כ־**זיכרון מונחים** לכתוביות: אם הדובר אומר "gradient descent" והשקף כותב "ירידה במורד הגרדיאנט", הולכים עם השקף.
- זוג בלוקים מקביל נותן זוגות מונחים.
- **כתוביות צרובות** — רצועה תחתונה יציבה שמתחלפת בקצב הדיבור:
  - בעברית: מסמנים, ולא מכסים אותן.
  - באנגלית: ייחוס לתיקון ה־ASR.
  - בשתי שפות: תג שפה לכל שורה מפריד ביניהן.

## 6. מדידה: מדדים וסטי בדיקה

**מדדים** — מספר נפרד לכל אחד, כדי לדעת איפה הכשל:
1. **CER/WER לפי שפה**: מחשבים בנפרד לקטעים עבריים, לקטעים לטיניים ולמספרים.
   - לפני כן: NFC, הסרת סימני bidi, ואיחוד ״/" ו־׳/'.
2. **זיהוי בלי סדר**: Flexible Character Accuracy (Clausner, Pletschacher, Antonacopoulos, *PRL* 131, 2020, [doi](https://doi.org/10.1016/j.patrec.2020.02.003)).
   - אפשר גם bag-of-words F1, או "regardless of order", המדד שבו השתמשה Rivok.
3. **שגיאת סדר**: CER עם סדר פחות CER בלי סדר. גם Kendall τ על סדר המילים בשורה.
4. **כיוון**: דיוק לשורה ולבלוק.
5. **תיוג שפה**: דיוק לטוקן, ו־F1 לקטע (גבולות ותווית). מטריצת בלבול he/en/other/neutral.
6. **סדר בלוקים**: מרחק עריכה מנורמל.
- **כלים**: `jiwer` ו־`dinglehopper` (OCR-D), שניהם Apache-2.0.

**סטים ציבוריים** — **לא נמצא סט ציבורי של שורות עברית+אנגלית** (חיפוש 16/11/2026) **[סביר]**:
- **Rivok, ‏209/233 שורות** — פרטי.
- **GlotOCR-bench** — עד 100 משפטים לכתב, ‏"evaluation-only". בלי ערבוב שפות.
- **HaZefira** — עברית היסטורית בלבד.
- **ICDAR MLT** — בלי עברית.
- **CAMIO** (‏LDC, ‏35 שפות) — לא ברור אם יש עברית.

**לכן: סט זהב משלנו** **[השערה]**:
- **סינתטי**:
  - שקפי HTML עם `dir="rtl"`, מצולמים בדפדפן headless. הדפדפן מריץ UBA ו־shaping אמיתיים, ולכן האמת הלוגית והתגים ידועים. ‏PIL בלי raqm לא עושה bidi נכון.
  - גופנים פתוחים: Rubik, ‏Assistant, ‏Heebo, ‏Alef, ‏Noto Sans Hebrew, ‏Frank Ruhl Libre.
  - המלכודות מסעיף 4, שתי עמודות, כתוביות דו־לשוניות, ערבית ורוסית.
  - 360p–1080p, עם דחיסה.
- **אמיתי**: 50–100 פריימים מהרצאות, בהרשאה, מתויגים ידנית.

## מה זה אומר לנו (עובד CPU שכבר מריץ Tesseract)

**ההחלטה**:
- נשארים עם **Tesseract `heb+eng`, העברית ראשונה** (פריסת RTL).
- **משפרים את הסידור והתיוג, לא את המנוע.** בשורה מעורבת רוב השגיאה היא סדר: 14.3% מול 1.7% בלי סדר.

**לפי סדר עדיפות:**

1. **סידור לפי UBA במקום היפוך רצפים** — בלי עלות CPU:
   - מילים לפי x. מילה עם עברית עוברת `uba(word, R)`. אחר כך `uba(line, base)`, ושומרים את הפרמוטציה לתיבות.
   - המימוש: UBA מינימלי משלנו (כ־100 שורות, עם 15 המקרים מסעיף 4 כ־unit tests), או המודול של Kraken (Apache-2.0) עם NOTICE.
   - שלב ב', רק אם נשארת שגיאה בתוך מילים: `hocr_char_boxes=1`.
2. **כיוון פסקה (HL1)**:
   - ברירת המחדל: שורה עם מילה עברית היא RTL. זה אומת: ‏19.8% ← 9.2% ב־#4680.
   - **LTR רק בהקשר LTR**, באחד משני מקרים:
     - (א) בלוק מיושר לשמאל, ורוב השקף LTR.
     - (ב) עברית של עד 2 מילים, לא בקצה, המילה החזקה השמאלית לטינית, ורוב השקף LTR.
   - הצבעה לבלוק, לאורך שורות ופריימים.
3. **שפה לכל קטע** — מעבר מ־TSV ל־**hOCR**, שנותן `lang` למילה ו־`dir` לפסקה.
   - הפלט: `spans: [{text, lang: he|en|ar|ru|num|sym, kind: word|name|code|url|num, box}]`.
   - `lang` של השורה נשאר לתאימות. מעלים `V` ל־2.
   - קטע לטיני הוא `en` כברירת מחדל. ‏LID רק מ־4 מילים: lingua מוגבל לשפות הצפויות, או GlotLID v4 small. לא fastText, בגלל CC-BY-SA.
   - `kind` שאינו word פירושו "לא לתרגם".
4. **ספים התחלתיים** **[השערה, לכיול]**:
   - `WORD_CONF` ‏30 ו־`LINE_CONF` ‏45 נשארים.
   - `lang_conf: low` כשיש אי־התאמה בין הכתב למודל, או ביטחון מתחת ל־60.
   - זוג מקביל: חפיפה אנכית של 50% ומעלה, יחס שורות 0.7–1.4, ושפה שונה.
   - `ara`/`rus` מתווספים מ־5 תווים בכתב הזה, או כשיותר מ־20% מהמילים מתחת ל־50.
5. **מנועים — למדוד, לא לאמץ**:
   - **heb_rivok 2.0**: לפי המספרים שלהם 3.5 מול 4.5 שניות לעמוד, וטוב יותר בעברית. להשוות על סט הזהב ולבדוק sha256.
   - **לא** `script/Hebrew` ו**לא** `eng+heb`, כי שניהם נותנים פריסת LTR.
   - **paddleocr-hebrew**: רק כדעה שנייה לשורות חלשות, ורק אחרי ארגז חול.
   - **VLM**: לא על CPU.
   - לבדוק `version()` ולשדרג ל־5.5.4 ומעלה.
6. **החוזה כלפי ההמשך** — לכל שקף:
   - התפלגות שפות.
   - `terms`: עד 50, ממוינים לפי נדירות, ל־prompt של חלון התמלול.
   - דגל "כבר בשפת היעד".
   - זוגות מקבילים.
   - דגל כתוביות צרובות, עם השפה שלהן.
7. **בדיקות**:
   - unit tests ל־bidi, כולל שורת ה־LTR.
   - על סט הזהב, המדדים מסעיף 6.

## מקורות
(נבדקו 16/11/2026, אלא אם צוין אחרת)
- Tesseract, קוד ראשי: [tessedit.cpp](https://github.com/tesseract-ocr/tesseract/blob/main/src/ccmain/tessedit.cpp) · [control.cpp](https://github.com/tesseract-ocr/tesseract/blob/main/src/ccmain/control.cpp) · [pageres.cpp](https://github.com/tesseract-ocr/tesseract/blob/main/src/ccstruct/pageres.cpp) · [resultiterator.cpp](https://github.com/tesseract-ocr/tesseract/blob/main/src/ccmain/resultiterator.cpp) · [ltrresultiterator.cpp](https://github.com/tesseract-ocr/tesseract/blob/main/src/ccmain/ltrresultiterator.cpp) · [hocrrenderer.cpp](https://github.com/tesseract-ocr/tesseract/blob/main/src/api/hocrrenderer.cpp) · [colfind.cpp](https://github.com/tesseract-ocr/tesseract/blob/main/src/textord/colfind.cpp) · [unicharset.cpp](https://github.com/tesseract-ocr/tesseract/blob/main/src/ccutil/unicharset.cpp)
- Tesseract: [issue #4680](https://github.com/tesseract-ocr/tesseract/issues/4680) · [PR #4629](https://github.com/tesseract-ocr/tesseract/pull/4629) · [5.5.4](https://github.com/tesseract-ocr/tesseract/releases/tag/5.5.4) · [tessdata_fast](https://github.com/tesseract-ocr/tessdata_fast) · [tessdata_best](https://github.com/tesseract-ocr/tessdata_best)
- Rivok Labs (דיווח עצמי): [tesseract-heb-rivok](https://github.com/RivoksLab/tesseract-heb-rivok) · [paddleocr-hebrew](https://github.com/RivoksLab/paddleocr-hebrew)
- bidi: [UAX #9](https://www.unicode.org/reports/tr9/) · [ICU BiDi](https://unicode-org.github.io/icu/userguide/transforms/bidi.html) · [ICU4C ubidi.h](https://unicode-org.github.io/icu-docs/apidoc/released/icu4c/ubidi_8h.html) · [python-bidi](https://pypi.org/project/python-bidi/) · [Kraken containers.py](https://github.com/mittagessen/kraken/blob/main/kraken/containers.py) · [Kraken lib/bidi](https://github.com/mittagessen/kraken/tree/main/kraken/lib/bidi)
- מנועים: [Surya](https://github.com/datalab-to/surya) · [python-doctr](https://pypi.org/project/python-doctr/) · [MMOCR](https://pypi.org/project/mmocr/) · המחקר הקודם: `docs/research/video-analysis/03-slides-ocr-visual.md` §3–§4 (‏PP-OCR, ‏EasyOCR, ‏GlotOCR, ‏VLM)
- זיהוי כתב ושפה: [RRC-MLT-2019](https://arxiv.org/abs/1907.00945) · [Fujii et al. 2017](https://arxiv.org/abs/1708.04671) · [CAMIO](https://aclanthology.org/2022.lrec-1.129/) · [lingua-py](https://github.com/pemistahl/lingua-py) ([טבלאות](https://github.com/pemistahl/lingua-py/tree/main/tables)) · [fastText LID](https://fasttext.cc/docs/en/language-identification.html) · [GlotLID](https://huggingface.co/cis-lmu/glotlid)
- תמלול: [faster-whisper transcribe.py](https://github.com/SYSTRAN/faster-whisper/blob/master/faster_whisper/transcribe.py) (1.2.1) · [Whisper prompting guide](https://developers.openai.com/cookbook/examples/whisper_prompting_guide) · [SlideAVSR](https://aclanthology.org/2024.alvr-1.11.pdf)
- מדידה: [Flexible Character Accuracy](https://doi.org/10.1016/j.patrec.2020.02.003) · [dinglehopper](https://github.com/qurator-spk/dinglehopper)
