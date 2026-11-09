# מסרטון הרצאה לסט נקי של יחידות ויזואליות: זיהוי שקפים, מסך ולוח, ‏OCR ו־VLM בשרת CPU (מצב ל־9/11/2026)

> **היקף.** המטרה היא להפוך סרטון הרצאה לרשימה נקייה, בלי כפילויות ועם חותמות זמן, של "יחידות ויזואליות": שקף, מצב מסך או מצב לוח. לכל יחידה מחלצים את הטקסט ואת המבנה במלואם. החילוץ צריך לרוץ בשרת THE SNOWBALL Studio: ‏Hetzner CX53 עם 16 vCPU משותפים, ‏32GB ובלי GPU. השרת משותף עם עבודות התרגום. במסמך מסומן איפה משתלם לשלם על VLM או על API.
>
> **שיטת המחקר.**
> - **תקציב החיפוש ברשת (WebSearch) של הסשן נגמר באמצע המחקר.** את החסר השלמתי בשליפה ישירה של דפים רשמיים שכתובתם ידועה. חלק מהדפים לא נטענו, והם מסומנים בסעיפי Gaps. אם צריך עוד חיפושים, אפשר לבקש המשך בהודעה נפרדת או להעלות את `CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION`.
> - בנוסף הרצתי **מדידות עצמיות בארגז חול**: ‏4 vCPU ‏Intel Xeon 2.1GHz, נתונים סינתטיים, 9/11/2026. השיטה מפורטת בסעיף 1, תחת "שיטת המדידה העצמית".
> - המדידות האלה מראות כיוון ואינן מחליפות מדידה על הרצאות אמיתיות.
>
> **מחירים.** כל המחירים בדולר ארה״ב (USD), לפי הדפים הרשמיים ב־9/11/2026, אלא אם צוין אחרת. חישובי "מחיר ל־1,000 שקפים" ו"מחיר לשעה" הם שלי, והנחות החישוב כתובות לידם. **כל שירות בתשלום דורש אישור מפורש של המשתמש.**

## 1. זיהוי מעברים של shot, סצנה ושקף (כולל חשיפה הדרגתית, fades, ‏PiP, סמן, שקף מוקרן, שיתוף מסך ולוח)

### Takeaway
גלאי סצנות כלליים בברירת המחדל שלהם פספסו את **כל** מעברי השקפים בסרטון הסינתטי. הכוונה ל־ffmpeg עם scene של 0.1 ומעלה, ול־PySceneDetect עם ContentDetector ‏27, ‏AdaptiveDetector, ‏HashDetector ו־HistogramDetector. הם מכוילים לחיתוכי מצלמה. מה שעבד הוא גלאי הפרשים ייעודי, שזיהה 47 מתוך 47 מעברים, בלי זיהויי שווא בתוך הסרטון, בכ־3ms לפריים. הוא רץ על דגימה מוקטנת (1fps, ‏640×360) ומשלב מסכת PiP שמתגלה אוטומטית, חציון זמני של 3 דגימות נגד סמן או לייזר, וכלל "תוספתי מול מחליף" שמבדיל בין חשיפה הדרגתית לשקף חדש. מודלים נלמדים (SliTraNet, ‏TransNetV2, ‏AutoShot) הם שכבה שנייה למקרים קשים, לא הכרח.

### Cited Findings

#### גלאי shot כלליים
- **PySceneDetect v0.7.3**. ברירות המחדל לפי [תיעוד ה־detectors](https://www.scenedetect.com/docs/latest/api/detectors.html):

  | גלאי | ברירות מחדל |
  |---|---|
  | `ContentDetector` (HSV) | threshold 27 |
  | `AdaptiveDetector` | adaptive_threshold 3.0, ‏min_content_val 15, ‏window_width 2 |
  | `ThresholdDetector` (מעברי fade לשחור ומשחור) | threshold 12 |
  | `HistogramDetector` | threshold 0.2, ‏bins 128 |
  | `HashDetector` | threshold 0.35, ‏size 8, ‏lowpass 2 |

  - `min_scene_len` הוא 15 פריימים, ובשורת הפקודה 0.6 שניות.
- **היסטוריית הגרסאות** לפי [ה־changelog](https://www.scenedetect.com/changelog/):

  | גרסה | תאריך | מה השתנה |
  |---|---|---|
  | 0.6 | 29/5/2022 | פענוח ב־thread רקע |
  | 0.6.4 | 10/6/2024 | נוספו גלאי hist ו־hash |
  | 0.7 | 3/5/2026 | תמיכה ב־VFR |
  | 0.7.1 | 21/7/2026 | — |
  | 0.7.2 | 11/10/2026 | ברירות מחדל חדשות: hist ‏0.05→0.20 ו־bins ‏256→128; ‏hash ‏0.395→0.35 ו־size ‏16→8 |
  | 0.7.3 | 8/11/2026 | `-d 0` מקטין רזולוציה אוטומטית |
- **TransNetV2** (arXiv, ‏11/8/2020; רישיון MIT; יש גרסת PyTorch) — [GitHub](https://github.com/soCzech/TransNetV2), [arXiv](https://arxiv.org/abs/2008.04838):
  - ‏F1: ‏ClipShots 77.9, ‏BBC 96.2, ‏RAI 93.9.
  - ב־RAI הגרסה הקודמת (TransNet) מדווחת 94.3.
  - אין במקור נתוני מהירות על CPU.
- **AutoShot** (CVPRW 2023) — [GitHub](https://github.com/wentaozhu/AutoShot), [arXiv](https://arxiv.org/abs/2304.06116v1), [CVPRW](https://openaccess.thecvf.com/content/CVPR2023W/NAS/html/Zhu_AutoShot_A_Short_Video_Dataset_and_State-of-the-Art_Shot_Boundary_Detection_CVPRW_2023_paper.html):
  - מערך SHOT: ‏853 סרטונים, ‏11,606 shots, ו־2,716 גבולות ב־200 סרטוני בדיקה.
  - המחברים מדווחים על שיפור ב־F1 לעומת TransNetV2:

    | מערך | שיפור ב־F1 |
    |---|---|
    | SHOT | ‎+4.2 |
    | ClipShots | ‎+1.1 |
    | BBC | ‎+0.9 |
    | RAI | ‎+1.2 |
- **ffmpeg 6.1.1**. דף התיעוד [ffmpeg-filters](https://ffmpeg.org/ffmpeg-filters.html) לא נטען (503), ולכן את ברירות המחדל לקחתי מהבינארי המקומי (`ffmpeg -h filter=…`):
  - `mpdecimate`: ‏hi=768, ‏lo=320, ‏frac=0.33, ‏max=0.
  - `scdet`: ‏threshold=10, בסקאלה 0–100.
  - `freezedetect`: ‏noise=0.001 (‎−60dB), ‏duration=2s.
- **GDELT** השתמשו בסף `scene` של 0.4 לסיכום shots של חדשות טלוויזיה — [GDELT](https://blog.gdeltproject.org/using-ffmpegs-scene-detection-to-generate-a-visual-shot-summary-of-television-news/).
- **ImageHash** (רישיון BSD-2) — [GitHub](https://github.com/JohannesBuchner/imagehash):
  - כולל average, ‏perceptual (pHash), ‏difference (dHash), ‏wavelet (wHash), ‏colorhash ו־crop-resistant hash.

#### כלים ומחקרים ייעודיים להרצאות
- **SliTraNet** (2022) — [ar5iv](https://ar5iv.labs.arxiv.org/html/2202.03540), [arXiv](https://arxiv.org/abs/2202.03540), [GitHub](https://github.com/asindel/SliTraNet):
  - סט הבדיקה: 14 סרטונים, 190 דקות, 380 מעברים, ‏FHD ב־25fps (הרצאות FAU).

    | שיטה | P | R | F1 |
    |---|---|---|---|
    | Diff-RGB-blur (baseline) | 36.79 | 96.05 | 53.21 |
    | Diff + 3D-ResNet50 | — | — | 89.33 |
    | SliTraNet gray-RGB | 86.76 | 93.16 | 89.85 |

  - הכשלים המדווחים: שקפים מונפשים עם שינוי קטן, ושקף סטטי שמוצג פחות מ־8 פריימים.
  - ה־baseline הוא slide-detector של Perelman.
- **lecture2notes** (רישיון AGPL-3.0) — [מסמך המסווג](https://lecture2notes.readthedocs.io/en/latest/models/slide-classifier.html), [GitHub](https://github.com/HHousen/lecture2notes):
  - מסווג פריימים מבוסס ResNet-34, שאומן על 15,599 פריימים.
  - הסרת כפילויות: clustering ואחריו keypoint matching.
  - פריים מסוג presenter_slide נחתך לשקף בעזרת התאמת features.
  - הדיוק המלא מופיע בסעיף 2.
- **AutoSlides-Extractor v2.0.0** (רישיון MIT) — [GitHub](https://github.com/bit-admin/AutoSlides-Extractor):
  - SSIM על 480×270, עם presets של 0.9990, ‏0.9985 ו־0.9980.
  - שלב "אימות יציבות".
  - הסרת כפילויות לפי pHash עם מרחק Hamming 10.
  - מסווג MobileNetV4 ב־ONNX עם ספים של 0.90 ו־0.75.
- **SlideSnap** (אין קובץ רישיון) — [GitHub](https://github.com/arjun-goel/slidesnap):
  - dHash של 64 ביט ועוד SSIM.
  - בוחר את הפריים החד ביותר לפי Variance of Laplacian על הפיקסלים שלא מוסתרים.
  - "RECONSTRUCTED SLIDE": חציון זמני עם מיסוך המרצה.
- **הפרדת רקע**:
  - video2slides משתמש ב־GMG/KNN — [GitHub](https://github.com/binh234/video2slides).
  - לפי LearnOpenCV, ‏GMG ו־KNN עדיפים על MOG2 לחילוץ שקפים — [LearnOpenCV](https://learnopencv.com/video-to-slides-converter-using-background-subtraction/).
- **כלים נוספים**:
  - [slide-detect](https://github.com/mizorewww/slide-detect)
  - [video-slide-extractor](https://github.com/itsyujay/video-slide-extractor): דיווח על 46 שקפים מהרצאת MIT.
  - [lecture-slide-notes](https://github.com/arjun-goel/lecture-slide-notes)
  - [video2pdfslides-tddschn](https://pypi.org/project/video2pdfslides-tddschn).
- **LVVO** (יוני 2025) — [arXiv](https://arxiv.org/abs/2506.13657):
  - ‏4,000 פריימים מ־245 הרצאות.
  - מחלקות: Table, ‏Chart-Graph, ‏Photographic-image, ‏Visual-illustration.
  - הסכמה בין מתייגים: F1 של 83.41%.
- **זיהוי תוכן ויזואלי בהרצאות עם YOLO** (‏MIPR 2025; גרסאות 27/6 ו־16/8/2025) — [arXiv](https://arxiv.org/abs/2506.21903).
- **שקפים שנוצרו ב־AI**: 1,050 שקפים (30/6/2025) — [arXiv](https://arxiv.org/abs/2506.23605v1).

#### שיטת המדידה העצמית (ארגז חול, 9/11/2026)
- **הנתונים**:
  - 6 שקפים בגודל 1920×1080, ברונדור Pillow עם raqm/fribidi.
  - גופני DejaVu: כותרת 64 bold על פס כחול, תבליטים 40, קוד DejaVuSansMono 36, ‏footer 24.
  - השפות: אנגלית, עברית, עברית־אנגלית מעורבת, קוד, אנגלית ועברית.
  - עברית רונדרה עם `direction="rtl"` ויושרה לימין.
  - לכל שקף 4 מצבי חשיפה הדרגתית. מצב ביניים מוצג 5 שניות ומצב סופי 10 שניות, בשתי לולאות.
  - בסך הכל 300 שניות: ‏48 מצבים ו־47 מעברים, מהם 11 החלפות שקף ו־36 חשיפות.
- **הקידוד**: ‏1080p25 עם libx264 ‏veryfast ‏crf 23.
- **הסימולציות**:
  - PiP בגודל 384×216 (testsrc2) בפינה הימנית התחתונה.
  - "סמן" אדום בגודל 14×14 שנע במסלול sin/cos.
- **תיקון חשוב לסימולציה**:
  - בגרסה הראשונה הסמן נוצר ב־`drawbox`, ושם המשתנה `t` הוא **עובי** ולא זמן, כך שהסמן עמד במקום.
  - בדקתי ומצאתי את זה בעצמי. אחר כך יצרתי את הסרטון מחדש עם `overlay … eval=frame`, והסמן זז באמת.
  - הבדיקות מול סמן נע נעשו על הגרסה המתוקנת.
  - ‏PySceneDetect רץ רק על הגרסה הראשונה, עם הסמן הסטטי. על ציוני `scene` של ffmpeg אין לזה השפעה מהותית: נבדקו מחדש וההבדל זניח.
- **סובלנות זיהוי**: ‏±0.25 שניות ל־ffmpeg ול־PySceneDetect, ‏±1 שנייה לגלאי שעובד ב־1fps.
- **הכלים**:
  - ffmpeg 6.1.1, ‏PySceneDetect 0.7.3, ‏opencv-python 5.0.0.93, ‏ImageHash 4.3.2.
  - Tesseract 5.3.4 עם מודלי fast של Ubuntu (eng, ‏heb).
  - RapidOCR 3.10.0 עם onnxruntime 1.31.1. מודלי ברירת המחדל שנטענו בפועל: `PP-OCRv6_det_small` ו־`PP-OCRv6_rec_small`.

#### מדידה עצמית: ציון `scene` של ffmpeg (480p, כל 7,500 הפריימים)
- **ציוני הרקע**, עם סמן נע ו־PiP: חציון 0.000034, ‏p99 ‏0.00038, מקסימום 0.00094.
- **החלפות שקף**: 0.023–0.051.
- **חשיפות**: 0.0020–0.0066.

| סף `scene` | החלפות שקף (11) | חשיפות (36) | שווא |
|---|---|---|---|
| 0.0015 | 11 | 36 | 0 |
| 0.002 | 11 | 34 | 0 |
| 0.004 | 11 | 16 | 0 |
| 0.006 | 11 | 2 | 0 |
| 0.01–0.02 | 11 | 0 | 0 |
| 0.05 | 2 | 0 | 0 |
| ‏0.1 ומעלה, כולל 0.3–0.4 המקובלים | 0 | 0 | 0 |

- **עלות**: ‏18.9 שניות קיר ו־34.5 שניות CPU ל־300 שניות וידאו (ב־480p).

#### מדידה עצמית: PySceneDetect 0.7.3 על אותו סרטון
- כל ריצה לקחה כ־19–26 שניות קיר ל־300 שניות וידאו.

| קונפיגורציה | החלפות שקף | חשיפות | שווא |
|---|---|---|---|
| ContentDetector ‏27 (ברירת מחדל) | 0/11 | 0/36 | 0 |
| ContentDetector ‏3 | 2/11 | 0/36 | 0 |
| ContentDetector ‏1 | 11/11 | 0/36 | 0 |
| AdaptiveDetector (ברירת מחדל) | 0/11 | 0/36 | 0 |
| HashDetector ‏0.35 / ‏0.1 | 0/11, ‏1/11 | 0/36 | 0 |
| HistogramDetector ‏0.2 / ‏0.01 | 0/11 | 0/36 | 0 |

#### מדידה עצמית: גלאי הפרשים ייעודי (1fps, ‏640×360, גווני אפור)
- **מסכת PiP**: פיקסל ש"זז" ביותר מ־30% מזוגות הדגימות נחשב חלק מה־PiP. המסכה מצאה לבד את תיבת ה־PiP, ‏x=491 ‏y=268 ‏w=143 ‏h=86, וכיסתה אותה.
- **גרסה 1: הפרש בין דגימות עוקבות**
  - סף 25, ‏dilation של 7×7, ‏connected components, ושטח מינימלי של 60px.
  - **בלי סמן נע**: ‏47/47 מעברים ו־0 שווא, כ־3.2ms לפריים כולל קריאת PNG.
  - **בלי dilation**: רק 28 מתוך 36 חשיפות.
  - **עם סמן שזז באמת**: הגלאי ירה על כל דגימה, 299 זיהויים ומהם 158 שווא. גרסה 1 **לא** עמידה לסמן.
- **גרסה 2: אותו גלאי על חציון זמני של 3 דגימות**
  - החציון הוא `median(f[i-1], f[i], f[i+1])`.
  - **עם הסמן הנע**: ‏49 זיהויים. כל 47 המעברים זוהו (11/11 החלפות ו־36/36 חשיפות).
  - שני זיהויי השווא נפלו בדגימה הראשונה ובאחרונה, שם החציון לא מוגדר. השטח שלהם היה 121–140px, לעומת 1,637px באירוע האמיתי הקטן ביותר.
  - **בלי סמן נע**: ‏47/47 מעברים ו־0 שווא.
  - **העלות**: כ־1.2–1.4ms לפריים לזיהוי, ועוד 1.5–1.8ms לקריאת PNG.
- **כלל "תוספתי מול מחליף"**
  - הספירה נעשית על ההפרש הגולמי, בלי dilation: "דיו שהופיע" הוא פיקסל שהתכהה ביותר מ־25, ו"דיו שנעלם" הוא פיקסל שהתבהר ביותר מ־25.
  - היחס נעלם/הופיע בחשיפות היה **0.000** בכולן. בהחלפות שקף הוא היה **‏1.346 לפחות**.
  - הספירה במסכה אחרי dilation נותנת תוצאה רועשת: היחס בחשיפות הגיע עד 0.80, בגלל רעש דחיסה בשולי האזור.
- **מרחק Hamming בין hashes של 64 ביט**, על מצבי ה־PNG:

  | | pHash | dHash | wHash |
  |---|---|---|---|
  | בין חשיפות עוקבות | 4–12 | 0–8 | 3–33 |
  | בין שקפים עוקבים | 16–36 | 14–16 | 26–34 |

### Inferences
- **ספי ברירת המחדל לא מתאימים לשקפים.**
  - ספים של 0.3–0.4 ב־ffmpeg, או 27 ב־PySceneDetect, לא יזהו החלפת שקף נקייה.
  - כדי לתפוס חשיפות צריך סף נמוך פי 100–200, למשל `scene` של כ־0.0015.
  - בסף כזה הרעש של סרטון אמיתי (מצלמה, דחיסה, ‏PiP של מרצה שמדבר) כמעט בוודאות יעבור את הסף.
  - לכן לא כדאי לבנות על ציון סצנה גלובלי. עדיף גלאי מקומי עם מסכה ורכיבים מחוברים.
- **צינור מומלץ ל־CX53**. כל הפרמטרים נקבעו על נתונים סינתטיים, וצריך לכייל אותם מחדש על 10–20 הרצאות אמיתיות.

```text
1. ffmpeg -vf fps=1,scale=640:-2,format=gray -f rawvideo -  (צינור ישיר בלי PNG; עדיף מזרם 360p/480p, ראו סעיף 7)
2. מסכת "תנועה מתמשכת": שבר הדגימות שבהן פיקסל השתנה > 0.3 → dilate 15×15 → תיבה = PiP/מצלמה/וידאו מוטמע
3. M[i] = median(f[i-1], f[i], f[i+1])        ← מעלים סמן/לייזר/עכבר שמופיע בדגימה אחת
4. d = dilate((|M[i]-M[i-1]| > 25) & mask, 7×7); אירוע אם רכיב מחובר ≥ 60px (לכייל לפי רעש הרקע: p99 של d)
5. appeared = #(M[i-1]-M[i] > 25) ; vanished = #(M[i]-M[i-1] > 25)   (לרקע כהה — להפוך סימן)
   vanished/appeared ≈ 0 → "חשיפה" (אותה יחידה, מצב שלם יותר) ; אחרת → "יחידה חדשה"
6. לכל יחידה: לשמור את המצב האחרון (השלם) ואת טווח היציבות שלו → חזרה לזרם המלא לבחירת הפריים החד (סעיף 6)
```

- **חשיפה הדרגתית**:
  - pHash מאחד חשיפות עוקבות (4–12) ומבדיל בין שקפים (16 ומעלה), אבל הפער צר.
  - הכלל התוספתי מבדיל ביניהם בבירור, ולכן הוא עדיף על סף hash.
  - בכל מקרה צריך לשמור את המצב **האחרון** של קבוצת החשיפות, ולא את הראשון.
- **fades ו־dissolve**:
  - מעבר של פחות משנייה משפיע על דגימה אחת לכל היותר ב־1fps, והחציון מעלים אותה.
  - מעבר ארוך יוצר כמה אירועים רצופים. כדאי לאחד אירועים רצופים ולקבוע את היחידה במצב היציב הראשון אחריהם.
  - fade לשחור (ThresholdDetector) מסמן גבול, לא יחידה.
- **אנימציות של שקף**: אובייקט שנכנס מייצר רצף אירועים. כלל "יציב לפחות 2 דגימות", שנובע מהחציון, יבחר את המצב הסופי. זה עקבי עם הכשל שדווח ב־SliTraNet בשקף שמוצג פחות מ־8 פריימים.
- **שקף מוקרן שצולם במצלמה**:
  - צריך לזהות את המרובע של המסך: המרובע הבהיר הגדול, או התאמת features מול פריים ייחוס, וזו הגישה של lecture2notes ל־presenter_slide.
  - אחר כך מיישרים עם homography (`cv2.findHomography`/`warpPerspective`) ומריצים את אותו גלאי על החיתוך.
  - הסף צריך להיות אדפטיבי, לפי רעש הרקע הנמדד, כי רעש המצלמה גבוה.
  - המרצה שעומד מול המסך: חציון זמני לאורך טווח היציבות, לפי הגישה של SlideSnap.
- **שיתוף מסך**:
  - הקלדה היא שינוי תוספתי.
  - גלילה היא הזזה גלובלית. אפשר לזהות אותה ב־phase correlation (`cv2.phaseCorrelate`) ולסמן "אותו מסמך, אזור חדש".
  - מעבר חלון או לשונית מחליף את רוב המסך, ולכן הוא יחידה חדשה.
  - לא נמצא מקור שמאמת את הכללים האלה. זו הסקה שצריך לבדוק.
- **לוח (לבן או ירוק)**:
  - כתיבה היא תוספתית ("הופיע" בלבד), ומחיקה היא "נעלם". לכן הגבול בין יחידות הוא **רגע המחיקה**.
  - שומרים את המצב המלא שלפני המחיקה. ההסתרה בגוף המרצה מטופלת בחציון זמני.
  - זו הסקה מהכלל התוספתי, ולא נבדקה על לוח אמיתי.
- **מודלים נלמדים**:
  - TransNetV2 ו־AutoShot מתאימים להפרדה בין shots בהקלטות רב־מצלמתיות, למשל מצלמה על המרצה מול שקף מלא.
  - SliTraNet מתאים לשקפים מונפשים.
  - כולם רלוונטיים רק אם הגלאי הייעודי נכשל על הסט האמיתי. אין להם נתוני CPU (ראו Gaps).

### Gaps
- **לא נבדקו הרצאות אמיתיות.** הספים והתוצאות סינתטיים: גופן אחד, רקע לבן, בלי רעש מצלמה, PiP סינתטי, סמן של 14px.
- **מהירות על CPU לא נמצאה** ל־TransNetV2, ‏AutoShot ו־SliTraNet. גם הרישיונות של AutoShot ו־SliTraNet לא אומתו.
- **psc2code** (חילוץ קוד מ־screencasts) נחסם ב־ACM ‏(403), ודף ה־homography של OpenCV (‏docs.opencv.org) החזיר 403.
- **לא נמצא מחקר ייעודי ללוחות** (למשל AccessMath או סיכום וידאו של לוח לבן), בגלל תקציב החיפוש שנגמר.
- **הכללים לגלילה, לשיתוף מסך ולמחיקת לוח** הם הסקה בלבד.

## 2. סיווג פריסה ואזורים (שקף, ראש מדבר, שיתוף מסך, לוח, הדגמה), חיתוך PiP ומודלי layout

### Takeaway
אין מודל פתוח ומוכן שמסווג פריים להרצאה (שקף, ראש מדבר, מסך, לוח, הדגמה) ברמה גבוהה:
- המסווג של lecture2notes (ResNet-34, ‏AGPL) מגיע ל־82.6% על 9 מחלקות, ונכשל בלוח (F1 0.52) ובהדגמה (0.10).
- גלאי layout של מסמכים חלשים על שקפים. בעמודת Slides של OmniDocBench הטוב ביותר מגיע ל־48.71, והוא DocLayout-YOLO ברישיון AGPL.

הדרך המעשית על CPU היא היוריסטיקות זולות: מסכת תנועה ל־PiP, ‏YuNet לפנים, צפיפות תיבות טקסט מגלאי טקסט, ורעש מצלמה. מקרים עמומים עוברים ל־VLM זול, פריים אחד לכל קטע.

### Cited Findings
- **lecture2notes** (ResNet-34, ‏15,599 פריימים, ‏AGPL-3.0) — [docs](https://lecture2notes.readthedocs.io/en/latest/models/slide-classifier.html):
  - 9 מחלקות: accuracy של 82.62%.

    | מחלקה | F1 |
    |---|---|
    | presenter | 0.92 |
    | presenter_slide | 0.82 |
    | presenter_whiteboard | 0.89 |
    | slide | 0.86 |
    | whiteboard | 0.52 |
    | demo | 0.10 |
    | audience | 0.00 |

  - 3 מחלקות: accuracy של 89.97%. ‏F1: ‏other 0.94, ‏presenter_slide 0.86, ‏slide 0.88.
- **AutoSlides-Extractor**: מסווג MobileNetV4 ב־ONNX עם ספים של 0.90 ו־0.75 — [GitHub](https://github.com/bit-admin/AutoSlides-Extractor).
- **YuNet** (רישיון MIT) — [opencv_zoo](https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet):
  - **סתירה במקור**: בטבלה מופיע WIDER Face easy/medium/hard של ‏0.8844/0.8656/0.7503, ובטקסט ‏0.834/0.824/0.708.
  - מזהה פנים בגודל 10×10 עד כ־300×300 פיקסלים.
  - יש מודל `2026may` עם קלט דינמי, ונוסחי int8 מ־2023mar.
- **MediaPipe Face Detector** (BlazeFace short-range): קלט 128×128, ‏2.94ms על CPU של Pixel 6. הדף עודכן ב־4/11/2026 — [MediaPipe](https://ai.google.dev/edge/mediapipe/solutions/vision/face_detector).
- **משפחת PP-DocLayout** (PaddleX). הזמנים נמדדו על Xeon Gold 6271C עם 8 threads, במצב רגיל ובמצב מואץ — [PaddleX layout](https://paddlepaddle.github.io/PaddleX/latest/en/module_usage/tutorials/ocr_modules/layout_detection.html):

  | מודל | mAP | CPU (ms) | גודל |
  |---|---|---|---|
  | PP-DocLayout-L | 90.4 | 503/251 | 123MB |
  | PP-DocLayout-M | 75.2 | 43/24 | — |
  | PP-DocLayout-S | 70.9 | 18.5/6.3 | 4.8MB |
  | PP-DocLayout_plus-L | 83.2 | 635/378 | — |
  | RT-DETR-H_17cls | 98.3 | 965 | — |

  - אין מחלקת "slide".
- **DocLayout-YOLO** (‏AGPL-3.0, מבוסס YOLO-v10/ultralytics) — [GitHub](https://github.com/opendatalab/DocLayout-YOLO):
  - DocLayNet: ‏93.4/79.7. ‏D4LA: ‏82.4/70.3 (AP50/mAP).
- **OmniDocBench v1.0, ‏layout בעמודת Slides** — [OmniDocBench](https://github.com/opendatalab/OmniDocBench):

  | מודל | ציון |
  |---|---|
  | DocLayout-YOLO | 48.71 |
  | SwinDocSegmenter | 28.20 |
  | GraphKD | 16.18 |
  | DiT-L | 13.72 |
  | LayoutLMv3 | 13.63 |

- **docling-layout-heron**: ‏RT-DETRv2, ‏42.9M פרמטרים, ‏Apache-2.0, ‏17 מחלקות. המאמר מ־15/9/2025 — [HF](https://huggingface.co/docling-project/docling-layout-heron).
- **Surya layout**: ‏18 מחלקות, כולל Diagram ו־Code. המשקלים ברישיון OpenRAIL-M מותאם, חינם מתחת ל־5M$ — [Surya](https://github.com/datalab-to/surya).
- **LVVO**: ארבע מחלקות תוכן ויזואלי בהרצאות (ראו סעיף 1) — [arXiv](https://arxiv.org/abs/2506.13657).
- **מדידה עצמית**:
  - מסכת "תנועה מתמשכת" מצאה את תיבת ה־PiP בדיוק בלי שום מודל (סעיף 1).
  - הגלאי של PP-OCRv6 (`det_small`) מצא את שורות הטקסט גם בשקף העברי, אף שהזיהוי עצמו יצא ג'יבריש (סעיף 3). המשמעות: גלאי הטקסט עובד גם על עברית, וזיהוי האותיות הוא שתלוי בשפה.

### Inferences
- **עץ החלטה זול לכל קטע יציב**. מריצים אותו על פריים אחד מכל קטע, לא על כל דגימה:
  1. **PiP**: מסכת תנועה מתמשכת. בתוך התיבה YuNet בודק פנים בגודל 10–300px, וזה מתאים ל־PiP של 384×216. אם יש פנים, התיבה היא "מצלמת מרצה" ומוסתרת.
  2. **ראש מדבר**: פנים גדולות (למשל מעל 5% מהפריים) וכמעט בלי תיבות טקסט.
  3. **שקף**: רקע אחיד ותיבות טקסט מסודרות בשורות. שינויים נדירים ובדידים (סעיף 1).
  4. **מסך או הדגמה**: סימני ממשק, כמו פסי חלון ושורת משימות. הרבה תיבות טקסט קטנות, וגלילה או שינויים תכופים.
  5. **לוח**: קווים בצבע אחד על רקע לבן או ירוק, ושינויים תוספתיים איטיים. רעש מצלמה גבוה.
  6. **מקרה עמום** (הסיווג מתחת לסף): פריים אחד ל־VLM (סעיף 4). עולה סנטים בודדים לשעת הרצאה.
- **חיתוך PiP שמסתיר שקף**: מה שמתחת ל־PiP אבוד. מחלצים רק את האזור הגלוי, או משלימים מ־PDF מקורי אם יש (סעיף 6).
- **רישיונות**:
  - lecture2notes, ‏DocLayout-YOLO ו־PyMuPDF הם AGPL. סעיף הרשת של AGPL חל גם על שירות רשת.
  - קיימות חלופות ברישיון Apache או MIT: ‏PP-DocLayout, ‏docling-heron, ‏YuNet ו־pypdfium2.
  - עדיף לבחור בהן גם אם הריפו ציבורי. זו לא ייעוץ משפטי.
- **מודל layout כן שווה הרצה** אחרי שזוהה שקף, וגם אז רק לסימון אזורים כמו טבלה, גרף, נוסחה, קוד ודיאגרמה. המטרה היא לנתב כל אזור למחלץ הנכון (סעיף 5).
  - PP-DocLayout-S לוקח 6–19ms על CPU.
  - בשקפים הדיוק נמוך, ולכן כדאי לאמת על הסט שלנו.

### Gaps
- **RetinaFace לא נבדק.** גם הרישיון של MediaPipe לא אומת בשליפה.
- **לא נמצא בנצ'מרק פתוח** לסיווג פריימים של הרצאות מעבר ל־lecture2notes. המשקלים והרישיון של מודלי LVVO לא נבדקו.
- **לא נמדד** PP-DocLayout על שקפים עבריים.

## 3. מנועי OCR: דיוק, מהירות CPU, עברית ו־RTL, רישיון, ו־OCR בענן

### Takeaway
בעברית הבחירה הפתוחה צרה:
- **אפשר**: Tesseract (heb, ‏heb_rivok) ו־Surya (ציון 76.8 לעברית).
- **אין עברית**: PP-OCRv5/v6, ‏PaddleOCR-VL, ‏EasyOCR, מודלי ברירת המחדל של RapidOCR ו־docTR הרב־לשוני.

**מדידה עצמית**:
- Tesseract ‏heb+eng הגיע ל־0% CER בשקף עברי ול־0.5% בשקף אנגלי, ב־1080p וב־720p.
- **בשקף מעורב שורות קצרות יצאו בסדר מילים הפוך (11%).** סידור מחדש של המילים לפי מיקום התיבות (TSV), בכ־20 שורות קוד, הוריד את השגיאה ל־0%.
- RapidOCR (PP-OCRv6 small) עמיד יותר באנגלית ברזולוציה נמוכה (0.5% ב־360p). בעברית הוא מחזיר ג'יבריש (77%), ועולה פי 4–13 בזמן CPU.

**OCR בענן עם עברית**: Google Vision, ‏Azure Read ו־Textract, כולם ‏$1.50 ל־1,000 תמונות. זה סנטים להרצאה.

### Cited Findings

#### Tesseract ועברית
- **[Tesseract #4680](https://github.com/tesseract-ocr/tesseract/issues/4680)** (נפתח 7/11/2026, פתוח):
  - שורות עבריות קצרות שמתחילות באנגלית יוצאות בסדר הפוך. הדוגמה במקור: "הרצאה על Machine Learning".
  - על 209 שורות מעורבות:

    | מודל | CER רגיל | עם הכלל "כל שורה עם מילה RTL היא RTL" |
    |---|---|---|
    | heb+eng fast | 19.8% | 9.2% |
    | heb_rivok | 14.2% | 4.9% |

- **[Tesseract #1102](https://github.com/tesseract-ocr/tesseract/issues/1102)** (issue ישן): לפי הכותרת, מספרים לא חולצו עם `-l heb+eng` אבל חולצו עם `-l eng` לבד. בבדיקה הסינתטית שלי המספרים "3" ו־"0.001" נקראו נכון.
- **heb_rivok** — [GitHub](https://github.com/RivoksLab/tesseract-heb-rivok), [HF](https://huggingface.co/Rivok/tesseract-heb-rivok):
  - Apache-2.0. גרסאות 1.0 ו־1.0.1 מ־7/11/2026. ב־HF יש גרסאות fast ו־best, ועוד `heb_rivok_lite`.
  - דיווח עצמי של המפתחים, CER מול heb של Ubuntu:

    | סט | heb של Ubuntu | heb_rivok |
    |---|---|---|
    | 403 שורות | 4.7% | 1.4% |
    | GlotOCR נקי | 21.2% | 18.5% |
    | HaZefira | 17.5% | 9.9% |
    | 209 שורות מעורבות | 19.3% | 14.0% |

  - זמן: 0.24 שניות לשורה לעומת 0.07, ו־6.4 שניות לעמוד לעומת 5.2.
- **paddleocr-hebrew** (Rivok Labs, ‏Apache-2.0) — [PyPI](https://pypi.org/project/paddleocr-hebrew/):
  - גרסאות 0.1.0 ו־0.1.1 מ־7/11/2026, בלי provenance.
  - דיווח עצמי, CER:

    | סט | Tesseract | cascade | NRTR |
    |---|---|---|---|
    | עברית נקייה | 1.34% | 0.76% | 0.35% |
    | שורות דו־לשוניות אמיתיות (n=233) | 16.14% | 2.33% | — |
    | ברמת עמוד (71 עמודים) | 14.20% | 7.56% | — |

  - ONNX מהיר פי 7.
  - אין ניקוד. הפלט בסדר לוגי. גופני display נכשלים, ושלטים מחוץ לתחום.
- **[HeOCR #53](https://github.com/HeOCR/heocr-engine/issues/53)** (6–7/11/2026): על 39 עמודי Wikisource, ‏Tesseract 5.5.3 ‏heb נתן CER של 0.216. ראו גם [hocrgen #149](https://github.com/HeOCR/hocrgen/issues/149).
- **[ImproveQuality](https://tesseract-ocr.github.io/tessdoc/ImproveQuality.html)**:
  - "Tesseract works best on images which have a DPI of at least 300 dpi"
  - ב־4.x: "use dark text on light background"
  - psm 11/12 ל־"Sparse text"
  - שוליים של כ־10px סביב הטקסט.
  - הדף **לא** מציין גובה אות מינימלי בפיקסלים, ומפנה לבדיקה חיצונית.

#### מנועים פתוחים נוספים
- **Surya 2.5** — [Surya](https://github.com/datalab-to/surya), [multilingual](https://github.com/datalab-to/surya/blob/master/static/docs/multilingual.md):
  - במבחן הרב־לשוני של Surya (91 שפות, 36,089 בדיקות, ממוצע 74.9%): עברית 75.0% ב־Surya 2 ו־**76.8%** ב־2.5. ערבית 45.4, פרסית 67.9, אנגלית 90.3.
  - olmOCR-bench: ‏83.7.
  - מהירות: ‏4.52 עמ'/ש' על H100, וכ־0.19 עמ'/ש' על M4 Max.
  - קוד Apache 2.0. המשקלים ב־OpenRAIL-M מותאם.
- **PaddleOCR**:
  - PP-OCRv5 הרב־לשוני: אין עברית. ‏`arabic_mobile_rec` מגיע ל־81.27% — [PP-OCRv5 languages](https://github.com/PaddlePaddle/PaddleOCR/blob/main/docs/version3.x/algorithm/PP-OCRv5/PP-OCRv5_multi_languages.en.md).
  - גרסאות לפי [releases](https://github.com/PaddlePaddle/PaddleOCR/releases):

    | גרסה | תאריך | מה חדש |
    |---|---|---|
    | v3.2.0 | 21/8/2025 | PP-Chart2Table |
    | v3.3.0 | 16/10/2025 | VL 0.9B ל־109 שפות |
    | v3.4.0 | 29/1/2026 | VL-1.5, ‏94.5 |
    | v3.4.1 | 14/4/2026 | backend של llama.cpp |
    | v3.6.0 | 28/5/2026 | PaddleOCR-VL-1.6, ‏96.33 ב־OmniDocBench v1.6 |
    | v3.7.0 | 11/6/2026 | PP-OCRv6 ל־50 שפות: לטיניות, סינית ויפנית |

  - **PP-OCRv6** ([HF blog](https://huggingface.co/blog/PaddlePaddle/pp-ocrv6), ‏22/6/2026):
    - גדלים: ‏1.5M, ‏7.7M, ‏34.5M פרמטרים.
    - medium: ‏det 86.2, ‏rec 83.2. כלומר ‎+4.6/+5.1 מעל PP-OCRv5_server.
    - לפי snippet מפוסט של PaddlePaddle ב־[X](https://x.com/PaddlePaddle/status/2065299834756902995), שלא נקרא במלואו: ‏Apache 2.0, ופי 5.2 מהר יותר ב־OpenVINO.
  - **PaddleOCR-VL**: רשימת 109 השפות **לא כוללת עברית** — [FAQ](https://www.paddleocr.ai/v3.3.2/en/version3.x/algorithm/PaddleOCR-VL/PaddleOCR-VL.html). יש תמיכה ב־CPU של x64 — [usage](https://www.paddleocr.ai/latest/en/version3.x/pipeline_usage/PaddleOCR-VL.html).
  - **זמני PaddleX** (‏8 threads, לכל חיתוך):
    - [rec](https://paddlepaddle.github.io/PaddleX/latest/en/module_usage/tutorials/ocr_modules/text_recognition.html):

      | מודל | דיוק | זמן / גודל |
      |---|---|---|
      | v5_server_rec | 86.38% | 31.2ms |
      | v5_mobile_rec | 81.29% | 21.2/5.3ms |
      | v6 rec ‏medium | 83.2 | 73.3MB |
      | v6 rec ‏small | 81.3 | 20.4MB |
      | v6 rec ‏tiny | 73.5 | 4.4MB |

    - [det](https://paddlepaddle.github.io/PaddleX/latest/en/module_usage/tutorials/ocr_modules/text_detection.html):

      | מודל | ציון | זמן |
      |---|---|---|
      | v5_server_det | 83.8 | 383ms |
      | v5_mobile_det | 79.0 | 57.8/28.2ms |
      | v6 det | 86.2/84.1/80.6 | — |

- **EasyOCR**: יותר מ־80 שפות, כולל ערבית, פרסית ואורדו. **אין עברית** ברשימה — [EasyOCR](https://www.jaided.ai/easyocr/) (נבדק 9/11/2026).
- **docTR**:
  - ב־v0.12.0 נוסף vocab עברי — [mirror](https://sourceforge.net/projects/doctr.mirror/files/v0.12.0).
  - המודל הרב־לשוני `parseq-multilingual-v1` מכסה 12 שפות לטיניות בלבד — [HF](https://huggingface.co/Felix92/doctr-torch-parseq-multilingual-v1).
- **OnnxTR v0.9.0**: שניות לעמוד על i7-14700K — [GitHub](https://github.com/felixdittrich92/OnnxTR):

  | מנוע | FUNSD | CORD |
  |---|---|---|
  | docTR | 1.29 | 0.60 |
  | OnnxTR | 0.57 | 0.25 |
  | OnnxTR 8bit | 0.38 | 0.14 |
  | OnnxTR OpenVINO | 0.15 | 0.14 |
  | EasyOCR | 1.96 | 1.75 |
  | PyTesseract | 0.50 | 0.52 |
  | Surya v0.4.4 | 48.8 | 35.5 |
  | PaddleOCR 2.7.3 | 1.27 | 0.38 |

- **Docling** (נכון ל־2026.07.28): ל־RapidOCR, ל־EasyOCR ול־Nemotron אין עברית — [Docling OCR](https://docling-project.github.io/docling/concepts/OCR_native/).

#### מדידה עצמית: דיוק (CER) ברזולוציות שונות
- **איך נמדד**:
  - CER הוא מרחק Levenshtein חלקי אורך האמת, על כל הטקסט. סדר הקריאה נכלל.
  - לפני המדידה הוסרו סימני bidi (U+200E/200F/202A–202E/2066–2069) ותבליטים בתחילת שורה או בסופה (•, ‏¢, ‏© וכו'), ורווחים אוחדו.
  - השקפים: הסופיים, מוקטנים ב־LANCZOS. ‏Tesseract הורץ ב־`--psm 3`, ‏single-thread.

| מנוע / שקף | 1080p | 720p | 480p | 360p |
|---|---|---|---|---|
| Tesseract eng — אנגלית | 0.5% | 0.5% | 3.2% | 16.6% |
| Tesseract eng — קוד | 0.8% | 1.6% | 1.6% | 23.8% |
| Tesseract heb+eng — עברית | 0.0% | 0.0% | 5.7% | 16.5% |
| Tesseract heb+eng — מעורב, פלט טקסט | 11.0% | 11.0% | 21.3% | 25.6% |
| **Tesseract heb+eng — מעורב, ‏TSV + סידור RTL** | **0.0%** | **0.0%** | 11.6% | 18.9% |
| Tesseract heb_rivok+eng (fast) — עברית | 0.0% | 0.0% | 5.7% | 15.8% |
| **Tesseract heb_rivok+eng — מעורב, ‏TSV + סידור RTL** | **0.0%** | **0.0%** | **0.6%** | 12.8% |
| Tesseract heb בלבד — מעורב | 37.8% | 36.0% | 37.8% | 39.0% |
| RapidOCR 3.10 (PP-OCRv6 small) — אנגלית | 0.5% | 0.5% | 0.5% | 0.5% |
| RapidOCR — קוד | 0.0% | 0.8% | 0.0% | 0.0% |
| RapidOCR — עברית | 76.6% | 76.6% | 76.6% | 77.2% |
| RapidOCR — מעורב | 62.8% | 64.0% | 62.8% | 65.2% |

- **הערות לטבלה**:
  - ב־`--psm 11` אנגלית נתנה 18.2% גם ב־1080p, כי הטקסט מתפרק. לכן `--psm 3` עדיף לשקפים.
  - heb בלבד הופך מילים באנגלית לג'יבריש עברי. דוגמה: "בדיקת דיוק על 56% חסו03ו|8\".
  - דוגמה לפלט של RapidOCR על המעורב: "chin Larning", ‏"AIAIL ε: NIGAIUIRIU CAILU WV".
- **השגיאה בשקף המעורב** היא סדר מילים, בלי טעויות אותיות:
  - הכותרת יצאה "Machine Learning ‏הרצאה על‎" (פלט טקסט, עם סימני bidi). זה ממצא issue #4680 שחזר אצלי.
  - שורות התבליטים, שהן פסקה אחת שרובה עברית, יצאו נכון.
- **הגרסה הטובה של המודל (`tessdata_best`)** של heb_rivok נתנה בדיוק אותם CER כמו גרסת ה־fast, והייתה איטית יותר.

#### מדידה עצמית: זמן CPU לשקף (single-thread אלא אם צוין)

| מנוע | זמן לשקף |
|---|---|
| Tesseract heb / eng ‏(fast) | 0.25–0.52 שניות. ב־multi-thread: ‏0.2–4.9 שניות, ולא יציב |
| Tesseract heb_rivok (fast) | 0.33–0.64 שניות |
| heb_rivok best | 0.45–0.93 שניות |
| RapidOCR ‏1 thread | ‏3.3 שניות CPU ב־1080p. ‏1.7 שניות ב־720p וגם ב־360p |
| RapidOCR ‏4 threads | ‏1.24 שניות קיר ו־4.5 שניות CPU ב־1080p |

- ב־RapidOCR, ‏720p ו־360p עולים אותו זמן כי הגלאי מגדיל לגודל קבוע.

#### OCR בענן
- **Google Cloud Vision** — [מחירים](https://cloud.google.com/vision/pricing) (נבדק 9/11/2026):
  - מחיר ל־`TEXT_DETECTION` ול־`DOCUMENT_TEXT_DETECTION`:

    | נפח | מחיר רגיל ל־1,000 | savings plan לשנה | savings plan ל־3 שנים |
    |---|---|---|---|
    | 1,000 יחידות ראשונות בחודש | חינם | — | — |
    | 1,001 עד 5 מיליון | $1.50 | $1.35 | $1.20 |
    | מעל 5 מיליון | $0.60 | $0.54 | $0.48 |

  - עברית (`iw`) נתמכת. כתב יד עברי לא מופיע ברשימה — [שפות](https://cloud.google.com/vision/docs/languages).
  - מומלץ 1024×768 ל־OCR, ומקסימום 75M פיקסלים — [גדלים](https://cloud.google.com/vision/docs/supported-files).
- **Azure Document Intelligence v4**:
  - עברית מודפסת נתמכת. כתב יד עברי לא נתמך — [שפות](https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/language-support/ocr) (עודכן 19/10/2026).
  - מחירים לפי [Retail Prices API](https://prices.azure.com/api/retail/prices) (‏eastus, נבדק 9/11/2026): ‏Read עולה $1.50 לאלף עמודים עד מיליון, ו־$0.60 מעבר לזה. ‏Prebuilt/Layout עולה $10 לאלף.
  - חינם עד 500 עמודים בחודש — [דף המחירים](https://azure.microsoft.com/en-us/pricing/details/ai-document-intelligence/).
  - ב־OCR של Vision: גובה טקסט מינימלי 12px ב־1024×768, ותמונה בין 50×50 ל־10,000×10,000 — [OCR overview](https://learn.microsoft.com/en-us/azure/ai-services/computer-vision/overview-ocr).
- **AWS Textract** — [limits](https://docs.aws.amazon.com/textract/latest/dg/limits-document.html):
  - `DetectDocumentText` ו־`StartDocumentTextDetection`/`GetDocumentTextDetection`: ‏"support all languages".
  - Forms מוגבל לאנגלית, ספרדית, איטלקית, פורטוגזית, צרפתית וגרמנית. כתב יד באנגלית בלבד.
  - "The minimum height for text to be detected is 15 pixels".
  - מחירים לפי [מחירון](https://aws.amazon.com/textract/pricing/) (‏US West):
    - DetectDocumentText: ‏$1.50 לאלף עמודים, ואז $0.60.
    - Tables: ‏$15 ו־$10.
    - שכבה חינמית: 1,000 עמודים בחודש, ל־3 חודשים.
- **Mistral OCR** — [הודעת השחרור](https://mistral.ai/news/mistral-ocr) (6/3/2025):
  - הדגם `2503` תומחר "1000 pages / $", ובערך פי 2 עמודים לדולר ב־batch.
  - הדף מציין שהדגם "no longer maintained", והוחלף.
  - עברית לא מוזכרת. בטבלה הרב־לשונית של הדף אין עברית.
  - הדגם הנוכחי (`mistral-ocr-latest`, ‏OCR 4) מתואר כ"40+ languages" — [docs](https://docs.mistral.ai/capabilities/document_ai/basic_ocr/). **המחיר הנוכחי לא נמצא** ב־[דף המחירים](https://mistral.ai/pricing).

### Inferences
- **מנוע ה־OCR המקומי המומלץ: Tesseract `heb+eng`**, בפלט TSV ועם **סידור מילים מחדש לפי RTL**.
  - שווה לבדוק את `heb_rivok` כתחליף ל־`heb`: באותה רזולוציה הוא שיפר משמעותית את 480p המעורב (11.6% ← 0.6%), במחיר של פי 1.5–2 בזמן.
  - אלגוריתם הסידור מחדש, כפי שנבדק:

```python
HEB = re.compile(r'[֐-׿]')
def reorder_line(words):  # words = [(left_x, text)] של שורה אחת מ־TSV (level 5), אחרי הסרת ‎‏
    if not any(HEB.search(t) for _, t in words):
        return ' '.join(t for _, t in sorted(words))            # שורה LTR
    out, run = [], []
    for x, t in sorted(words, key=lambda w: -w[0]):             # מימין לשמאל
        if HEB.search(t): out += reversed(run); run = []; out.append(t)
        else: run.append(t)                                     # רצף לא־עברי שומר על סדרו הפנימי
    return ' '.join(out + list(reversed(run)))
```

- **מקביליות**: להריץ כמה תהליכי Tesseract ב־single-thread (`OMP_THREAD_LIMIT=1`), ולא תהליך אחד עם threads. התזמון ב־multi-thread היה לא יציב (0.2–4.9 שניות).
- **שקפים באנגלית בלבד**, בעיקר ברזולוציה נמוכה או בשקף מצולם: RapidOCR/PP-OCRv6 עדיף בדיוק, אבל עולה פי 4–13 בזמן CPU.
  - אפשר מבנה היברידי: גלאי טקסט (PP-OCRv6 det, שמזהה גם שורות בעברית), זיהוי הכתב של כל שורה, ואז ניתוב. שורות עבריות ל־Tesseract (או ל־NRTR של paddleocr-hebrew אחרי אימות), ושורות לטיניות ל־PP-OCRv6 rec.
- **המוצרים העבריים החדשים לא אומתו.** paddleocr-hebrew ו־heb_rivok בני יומיים, המספרים שלהם מדווחים על ידי המפתחים עצמם, ואותה קבוצה פתחה את issue #4680. נדרש אימות עצמאי על שקפים אמיתיים לפני אימוץ.
  - הבדיקה שלי של heb_rivok אישרה את הכיוון ב־480p, רק על נתונים סינתטיים.
  - paddleocr-hebrew לא הורץ: זו חבילת Python חדשה בלי provenance, והרצת קוד לא מאומת בשרת היא סיכון.
- **OCR בענן זול אחרי הסרת כפילויות.**
  - ב־100 מצבים לשעת הרצאה: Google Vision, ‏Azure Read ו־Textract עולים כ־$0.15 לשעה.
  - השכבה החינמית של Google (1,000 יחידות בחודש) מכסה כ־10 שעות הרצאה בחודש.
  - אבל הפלט הוא טקסט ותיבות בלבד, בלי מבנה. LLM זול נותן מבנה באותו סדר גודל של מחיר (סעיף 4).
  - כל אחד מהשירותים דורש אישור תשלום מהמשתמש.

### Gaps
- **לא נבדק OCR עברי בענן** (Google, ‏Azure, ‏Textract) על שקפים. גם סדר הקריאה שלהם בשורות מעורבות לא נבדק.
- **לא נבדקו**:
  - Surya על CPU.
  - paddleocr-hebrew, מסיבות זהירות.
  - גופנים עבריים אמיתיים (David, ‏Narkisim, ‏Rubik, ‏Assistant), ניקוד, רקעים צבעוניים, טקסט לבן על רקע כהה (מלבד הכותרת), ותמונות דחוסות מ־YouTube.
- **המחיר הנוכחי של Mistral OCR** לא אומת.

## 4. מודלי VLM ל־OCR: בנצ'מרקים, היתכנות על CPU, ראיות לעברית ורישיונות

### Takeaway
טבלאות המובילים (OmniDocBench v1.6, ‏olmOCR-Bench) מובלות בידי מודלי OCR ייעודיים בגודל 0.9–7B. הם בנויים בעיקר לאנגלית ולסינית: ב־GlotOCR ‏(14/4/2026) העברית של PaddleOCR-VL-1.5 ו־GLM-OCR היא 0, וזה של Gemini 3.1 Flash-Lite הוא 61.0.

**על CPU, ‏VLM לוקח דקות לעמוד** (Phi-4: ‏1,176 שניות לעמוד), ולכן לא מעשי בכמות על CX53 משותף.

**ב־API זה זול אחרי הסרת כפילויות**:
- כ־$0.36–0.47 ל־1,000 שקפים ב־Haiku 5.5.
- כ־$0.74–0.88 ב־Gemini 3.1 Flash-Lite.
- בלי טוקני חשיבה.

**ההחלטה היא איכות בעברית**, ואותה צריך למדוד על סט הזהב שלנו.

### Cited Findings
- **OmniDocBench v1.6_full** — [GitHub](https://github.com/opendatalab/OmniDocBench):
  - הדירוג: OXR-1.0 97.03, ‏TeleOCR 96.91, ‏OvisOCR2 96.47, ‏PaddleOCR-VL-1.6 96.34, ‏MinerU2.5-Pro 95.75, ‏GLM-OCR 95.22, ‏PaddleOCR-VL-1.5 94.93, ‏PaddleOCR-VL 94.18, ‏Unlimited-OCR 94.00, ‏Qianfan 93.90, ‏MinerU-2.5 93.04, ‏Gemini 3 Pro 92.91, ‏Gemini 3 Flash 92.62, ‏MonkeyOCR V2 91.80, ‏dots.ocr 90.77, ‏DeepSeek-OCR 2 90.25, ‏HunyuanOCR 89.95, ‏Qwen3-VL-235B 89.78, ‏GPT-5.2 86.59, ‏olmOCR 85.74, ‏Marker 78.44.
  - גרסאות: v1.5 מ־25/9/2025, ‏v1.6 מ־10/4/2026.
  - יש סוג מסמך PPT2PDF.
- **Chandra OCR 2** (כ־5B) — [HF](https://huggingface.co/datalab-to/chandra-ocr-2):
  - קוד Apache. המשקלים ב־OpenRAIL-M: חינם מתחת ל־2M$, ולא לשימוש מתחרה.
  - olmOCR-Bench, לפי הדף:

    | מודל | ציון |
    |---|---|
    | Datalab API | 86.7 |
    | Chandra 2 | 85.8 |
    | dots.ocr 1.5 | 83.9 |
    | Chandra 1 | 83.1 |
    | olmOCR 2 | 82.4 |
    | dots.ocr | 79.1 |
    | Marker | 76.5 |
    | DeepSeek | 75.4 |
    | Mistral | 72.0 |
    | Qwen3-VL-8B | 64.6 |

  - **עברית** במבחן הרב־לשוני של Datalab (43 שפות):

    | מודל | ציון בעברית |
    |---|---|
    | Datalab API | 76.4 |
    | Chandra 2 | 70.4 |
    | Gemini 2.5 Flash | 50.9 |
    | Chandra 1 | 38.9 |
    | GPT-5 Mini | 22.3 |

  - מהירות: ‏1.44 עמ'/ש' על H100.
- **dots.ocr** — [GitHub](https://github.com/rednote-hilab/dots.ocr), [arXiv](https://arxiv.org/abs/2512.02498):
  - פורסם 30/7/2025, קוד MIT. המאמר מ־2/12/2025.
  - dots.mocr (‏3B, ‏19/3/2026): ‏TextEdit ‏0.048→0.031, ‏olmOCR ‏79.1→83.9.
  - **המרה ל־SVG**: ‏0.901, לעומת 0.839 של Gemini 3 Pro.
- **olmOCR 2** (21/10/2025, ‏7B) — [GitHub](https://github.com/allenai/olmocr):
  - ציון 82.4.
  - דורש GPU של 12GB ומעלה. פחות מ־$200 למיליון עמודים על GPU.
- **מודלים נוספים**:

  | מודל | תאריך | גודל | רישיון | נתונים |
  |---|---|---|---|---|
  | [DeepSeek-OCR-2](https://huggingface.co/deepseek-ai/DeepSeek-OCR-2) | 28/1/2026 | 3B | Apache | olmOCR 76.3 |
  | [LightOnOCR-2-1B](https://huggingface.co/lightonai/LightOnOCR-2-1B) | ינואר 2026 | 1B | Apache | 83.2; ‏5.71 עמ'/ש' על GPU |
  | [GLM-OCR](https://huggingface.co/zai-org/GLM-OCR) | 11/3/2026 | 0.9B | MIT | 94.62 לפי כרטיס המודל; ‏95.22 ב־OmniDocBench v1.6_full |
  | [HunyuanOCR-1.5](https://huggingface.co/tencent/HunyuanOCR) | 6/7/2026 | כ־1B | Hunyuan Community | יש GGUF ל־llama.cpp |

- **Granite-Docling-258M** (17/9/2025, ‏Apache) — [HF](https://huggingface.co/ibm-granite/granite-docling-258M):
  - אנגלית, ועוד יפנית, ערבית וסינית ניסיוניות.
  - מול SmolDocling:

    | מדד | Granite-Docling | SmolDocling |
    |---|---|---|
    | קוד | 0.013 | 0.114 |
    | משוואות | 0.073 | 0.119 |
    | TEDS | 0.97 | 0.82 |
    | OCRBench | 500 | 338 |

- **MinerU 4.1** (Apache 2.0 עם תנאים) — [GitHub](https://github.com/opendatalab/MinerU):
  - רץ על CPU דרך ONNX/llama.cpp, עם 8GB.
  - על GPU מהיר פי 2–3.
- **Qwen3-VL** (Apache, ‏2B–235B) — [GitHub](https://github.com/QwenLM/Qwen3-VL):
  - OCR ב־32 שפות. עברית לא מצוינת.
- **GOT-OCR2.0** — [HF](https://huggingface.co/stepfun-ai/GOT-OCR2_0):
  - ‏0.7B, ‏Apache-2.0. המאמר מ־3/9/2024.
  - "multilingual" בלי רשימת שפות.
  - הדוגמאות ל־GPU בלבד.
- **Nougat** — [GitHub](https://github.com/facebookresearch/nougat):
  - קוד MIT. המשקלים ב־**CC-BY-NC**, כלומר לא לשימוש מסחרי.
  - "Chinese, Russian, Japanese etc. will not work".
- **זמני VLM ב־Docling** — [Docling](https://docling-project.github.io/docling/usage/vision_models/):
  - על M3 Max:

    | מודל | הרצה | זמן |
    |---|---|---|
    | SmolDocling | MLX | 6.15 שניות |
    | SmolDocling | Transformers MPS | 102 שניות |
    | Qwen2.5-VL-3B | MLX | 23.5 שניות |

  - **על CPU**: ‏Phi-4 לקח **1,176 שניות לעמוד**, ו־Pixtral לקח **1,828 שניות לעמוד**.
- **GlotOCR Bench** (14/4/2026, ‏ICML 2026) — [html](https://arxiv.org/html/2604.12978v1), [abs](https://arxiv.org/abs/2604.12978), [ICML](https://icml.cc/virtual/2026/78339), [GitHub](https://github.com/cisnlp/glotocr-bench), [HF](https://huggingface.co/datasets/cis-lmu/GlotOCR-bench):
  - 158 כתבים, ‏16,375 תמונות, ו־14 מודלים.
  - **עברית**, ‏Acc@5 ו־ScriptAcc (נקי ופגום יחד):

    | מודל | Acc@5 | ScriptAcc |
    |---|---|---|
    | Gemini 3.1 Flash-Lite | 61.0 | 100 |
    | dots.ocr | 55.0 | 98 |
    | dots.mocr | 49.0 | 93 |
    | GPT-4.1 | 42.0 | 99 |
    | HunyuanOCR | 42.0 | 91 |
    | LightOnOCR-2 | 38.0 | 95 |
    | Qwen3-VL-8B | 33.0 | 99 |
    | olmOCR-2 | 9.0 | 97 |
    | DeepSeek-OCR-2 | 5.0 | 31 |
    | RolmOCR | 4.0 | 93 |
    | FireRed-OCR | 2.0 | 64 |
    | Nanonets-OCR2 | 1.0 | 92 |
    | GLM-OCR | 0.0 | 95 |
    | PaddleOCR-VL-1.5 | 0.0 | 0.0 |

  - **הדירוג הכללי** (ממוצע Acc@5): Gemini 3.1 Flash-Lite 61.9 (CER 27.7), ‏dots.mocr 59.6, ‏dots.ocr 59.3, ‏HunyuanOCR 54.2, ‏Qwen3-VL-8B 52.4, ‏olmOCR-2 51.5, ‏RolmOCR 50.6, ‏GPT-4.1 50.5, ‏LightOnOCR-2 47.4, ‏Nanonets-OCR2 46.6, ‏PaddleOCR-VL-1.5 43.5, ‏FireRed-OCR 43.4, ‏GLM-OCR 39.8, ‏DeepSeek-OCR-2 38.7.
  - בסעיף 5.3 המאמר מסביר שה־ScriptAcc של עברית "comparatively low" בגלל בלבול תכוף עם תאית.
  - **Claude לא נכלל.**
- **בנצ'מרקים נוספים**:
  - CC-OCR (26/12/2024): ‏7,058 תמונות. ‏Gemini-1.5-pro הגיע ל־72.97 — [GitHub](https://github.com/AlibabaResearch/AdvancedLiterateMachinery/tree/main/Benchmarks/CC-OCR).
  - OCRBench v2: ‏10,000 זוגות QA, עודכן ביוני 2026 — [GitHub](https://github.com/Yuliang-Liu/MultimodalOCR).
- **Claude: מחירים** — [pricing](https://platform.claude.com/docs/en/about-claude/pricing), נבדק 9/11/2026. המחירים ב־USD ל־MTok, קלט/פלט:

  | מודל | רגיל | Batch API (50% הנחה) |
  |---|---|---|
  | Opus 5.5 | $4/$20 | $2/$10 |
  | Sonnet 5.5 | $2/$10 | $1/$5 |
  | Haiku 5.5, בקשות עד 100K טוקני קלט | $0.10/$0.50 | $0.05/$0.25 |
  | Haiku 5.5, מעל 100K | $0.50/$2.50 | — |

  - ב־Haiku 5.5 החשיבה פעילה כברירת מחדל, ב־effort ‏medium.
- **Claude: תמונות** — [vision](https://platform.claude.com/docs/en/build-with-claude/vision):
  - כל פאץ' הוא 28×28, כלומר עלות של `⌈width/28⌉ × ⌈height/28⌉` טוקנים.
  - **High-resolution** (Claude 4.7 ומעלה): עד 2,576px ו־4,784 טוקנים. ‏1920×1080 נשאר בגודלו ועולה **2,691 טוקנים**.
  - **Standard**: אותה תמונה מוקטנת ל־1456×819 ועולה 1,560 טוקנים.
  - עד 600 תמונות לבקשה (100 במודלים עם הקשר של 200K).
  - מעל 20 תמונות בבקשה: כל תמונה עד 3,000px לממד.
  - "might hallucinate or make mistakes when interpreting low-quality, rotated, or very small images under 200 pixels"
- **Claude: שפות** — [multilingual](https://platform.claude.com/docs/en/build-with-claude/multilingual-support):
  - Global-MMLU ביחס לאנגלית: ערבית 99.3% ב־Opus 5.5 ו־96.6% ב־Haiku 5.5.
  - **עברית לא בטבלה.** הדף אומר ש־Claude "capable in many languages beyond those benchmarked".
  - זו הבנת טקסט, לא OCR.
- **Gemini: מחירים** — [pricing](https://ai.google.dev/gemini-api/docs/pricing), נבדק 9/11/2026. ‏USD ל־1M טוקנים:

  | מודל | קלט | פלט | batch (קלט/פלט) |
  |---|---|---|---|
  | 3.8 Flash ו־3.6 Flash | $0.75, ו־$1.50 מ־1/1/2027 | $3.75, ו־$7.50 מ־1/1/2027 | — |
  | 3.5 Flash-Lite | $0.30 | $2.50 | $0.15/$1.25 |
  | 3.1 Flash-Lite | $0.25 | $1.50 | $0.125/$0.75 |
  | 2.5 Flash-Lite | $0.10 | $0.40 | — |

- **Gemini: טוקני מדיה** — [media resolution](https://ai.google.dev/gemini-api/docs/media-resolution):
  - תמונה: low 280, ‏medium 560, ‏high 1,120 (ברירת המחדל), ‏ultra 2,240.
  - פריים וידאו: 70, או 280 ב־high לטקסט.
  - ב־PDF: ‏"quality typically saturates at medium".
- **Gemini: וידאו** — [video understanding](https://ai.google.dev/gemini-api/docs/video-understanding):
  - דגימה של 1fps.
  - כ־100 טוקנים לשנייה ב־low וכ־300 ב־high (66 או 258 לפריים).
  - **סתירה קטנה** מול דף media-resolution, שם 70/280.
  - ב־[image understanding](https://ai.google.dev/gemini-api/docs/image-understanding): ‏258 טוקנים לכל אריח 768×768.

### Inferences
- **VLM על ה־CPU שלנו: לא לכמויות.**
  - זמני Docling (דקות עד עשרות דקות לעמוד על CPU) ודרישת ה־GPU של olmOCR 2 ושל Chandra פוסלים הרצה רחבה על CX53 משותף.
  - מודלים קטנים (GLM-OCR ‏0.9B, ‏HunyuanOCR ‏GGUF, ‏Granite-Docling ‏258M) אולי ירוצו בזמן סביר.
  - **אבל בעברית הם חלשים או לא ידועים**: ‏GLM-OCR קיבל 0 ב־GlotOCR, ו־Granite-Docling בלי עברית. לכן אין טעם להשקיע בהם לעברית.
- **עלות ל־1,000 שקפים**. חישוב שלי, בהנחה של 400 טוקני פלט לשקף ובלי טוקני חשיבה:

  | מודל | איך מחושב | רגיל | batch |
  |---|---|---|---|
  | Haiku 5.5, ‏1080p | 2.691M × $0.10 + 0.4M × $0.50 | ≈ **$0.47** | ≈ $0.23 |
  | Haiku 5.5, מוקטן ל־1456×819 | 1.56M טוקני קלט | ≈ **$0.36** | — |
  | Sonnet 5.5 | | ≈ $9.4 | ≈ $4.7 |
  | Opus 5.5 | | ≈ $18.8 | ≈ $9.4 |
  | Gemini 3.1 Flash-Lite, ‏high (1,120) | | ≈ **$0.88** | ≈ $0.44 |
  | Gemini 3.1 Flash-Lite, ‏medium (560) | | ≈ $0.74 | — |
  | Gemini 3.5 Flash-Lite, ‏high | | ≈ $1.34 | — |

  - **במודלים הזולים הפלט הוא רוב העלות.** כדאי לבקש פלט תמציתי, למשל JSON של שורות ותאים בלבד, או "תיקונים בלבד" מול טקסט ה־OCR המקומי.
  - **לשעת הרצאה עם כ־100 מצבים**: ‏Haiku כ־$0.05, ‏Gemini 3.1 Flash-Lite כ־$0.09, ‏Sonnet כ־$0.94.
  - ב־Haiku כדאי לשלוח עד כ־35 שקפים של 1080p בבקשה (כ־94K טוקנים), כדי להישאר במדרגה של עד 100K.
- **סרטון שלם ל־Gemini** (בלי הסרת כפילויות):
  - ב־high שעה היא כ־1.08M טוקנים. זה **יותר מחלון ההקשר של 1,048,576**, ולכן שעה שלמה לא נכנסת בבקשה אחת ב־high.
  - ב־low זה כ־0.36M טוקנים.
  - המחיר: כ־$0.27 לשעה (high, ‏3.1 Flash-Lite, קלט בלבד) או כ־$0.09 (low).
  - החיסרון: אין שליטה על בחירת הפריים. דגימה של 1fps ברזולוציה של 70–280 טוקנים לפריים חלשה לטקסט קטן.
  - **הסרת כפילויות מקומית ואז תמונה אחת ברזולוציה מלאה לכל מצב** נותנת יותר איכות לכל טוקן.
- **מה לשלוח ל־VLM**:
  1. שקפים עם טבלה, גרף, דיאגרמה, נוסחה או כתב יד (סעיף 5).
  2. שקפים שבהם ה־OCR המקומי מסופק: confidence נמוך, הרבה תווים לא בעברית או באנגלית, או פער גדול בין מסגרות.
  3. סיווג פריימים עמומים (סעיף 2).

  שקף טקסט רגיל בעברית או באנגלית ב־720p ומעלה נקרא מקומית ברמה טובה (סעיף 3).
- **הצעד הבא**: השוואה קטנה ומבוקרת על 50 שקפים אמיתיים מסט הזהב, ב־Haiku 5.5, ‏Gemini 3.1 Flash-Lite ו־Sonnet 5.5.
  - מדדים: CER, סדר קריאה ומבנה.
  - העלות המשוערת **פחות מ־$1 בסך הכל**, אבל גם היא טעונה אישור מפורש של המשתמש.

### Gaps
- **לא נמצא בנצ'מרק OCR בעברית למודלי Claude**, וגם לא ל־Gemini 3.x מעבר ל־Flash-Lite של GlotOCR.
- **לא נמצאו זמני CPU על x86** למודלי OCR קטנים (GLM-OCR, ‏HunyuanOCR ‏GGUF, ‏Granite-Docling). לא הרצתי llama.cpp מקומית, מזהירות מהרצת בינארי שהורד.
- **לא אומת** אם Haiku 5.5 מאפשר לכבות חשיבה לגמרי, וכמה טוקני חשיבה נצרכים בפועל ל־OCR.

## 5. חילוץ ייעודי: טבלאות, גרפים לנתונים, נוסחאות ל־LaTeX, קוד, כתב יד ולוח, דיאגרמות ל־Mermaid, ו־super-resolution

### Takeaway
**CPU מקומי מספיק ל**:
- נוסחאות: PP-FormulaNet_plus-S, ‏88.71 ב־261ms.
- טבלאות פשוטות: SLANet_plus, ‏41.8ms.
- קוד: OCR ועוד Magika, כ־5ms.

**אין פתרון פתוח, אמין ומהיר על CPU ל**:
- גרף לנתונים.
- דיאגרמה ל־Mermaid.
- כתב יד או לוח בעברית. אף שירות ענן גדול לא תומך בכתב יד עברי.

שם הכי משתלם להוציא טוקני VLM.

**Super-resolution לא משתלם.**
- המודלים הזולים מוסיפים כ־0.5dB מעל bicubic.
- EDSR מוסיף כ־3dB, אבל לוקח 3.3 שניות לתמונה.
- עדיף להוריד זרם ברזולוציה גבוהה יותר.

### Cited Findings
- **נוסחאות** (PaddleX, זמני CPU) — [PaddleX formula](https://paddlepaddle.github.io/PaddleX/latest/en/module_usage/tutorials/ocr_modules/formula_recognition.html):

  | מודל | ציון | זמן | הערה |
  |---|---|---|---|
  | UniMERNet | 85.91 | 8,288ms | 1.5GB |
  | PP-FormulaNet-S | 87.0 | 254ms | |
  | PP-FormulaNet_plus-S | 88.71 | 261ms | |
  | PP-FormulaNet_plus-M | 91.45 | 1,616ms | |
  | PP-FormulaNet_plus-L | 92.22 | 3,126ms | |
  | LaTeX_OCR | 74.55 | — | |

- **pix2tex** (MIT): ‏BLEU 0.88 ו־edit distance 0.10 — [GitHub](https://github.com/lukas-blecher/LaTeX-OCR).
- **texify** — [GitHub](https://github.com/VikParuchuri/texify):
  - deprecated, עבר ל־Surya, ו־archived ב־29/1/2025.
  - קוד GPL-3, משקלים CC BY-SA.
  - BLEU בבנצ'מרק שלו: texify 0.842, ‏nougat 0.698, ‏pix2tex 0.383.
- **טבלאות**:
  - PaddleX — [table](https://paddlepaddle.github.io/PaddleX/latest/en/module_usage/tutorials/ocr_modules/table_structure_recognition.html):

    | מודל | דיוק | זמן |
    |---|---|---|
    | SLANet | 59.5% | 43ms |
    | SLANet_plus | 63.7% | 41.8ms |
    | SLANeXt_wired | 69.7% | 502ms |

  - **table-transformer** (MIT) — [GitHub](https://github.com/microsoft/table-transformer):
    - זיהוי DETR R18 על PubTables-1M: ‏AP 0.970.
    - מבנה TATR-v1.0: ‏GriTS_Con 0.9850, ‏AccCon 0.8243.
    - העדכון האחרון 22/8/2023, ו**הריפו archived ב־21/9/2026**.
  - Granite-Docling: ‏TEDS 0.97 (ראו סעיף 4).
- **גרפים**:
  - [PP-Chart2Table](https://www.paddleocr.ai/latest/en/version3.x/module_usage/chart_parsing.html): ‏0.58B, ‏12–18 שניות על A100, סינית ואנגלית.
  - [DePlot](https://huggingface.co/google/deplot): ‏0.3B, ‏Apache, ‏20/12/2022. שיפור של כ־24% בשילוב עם LLM.
  - [ChartGemma](https://huggingface.co/ahmed-masry/chartgemma): ‏3B, ‏MIT, ‏4/7/2024.
- **קוד**:
  - [Magika](https://github.com/google/magika): ‏Apache, יותר מ־200 סוגי תוכן, כ־99% דיוק, כ־5ms לקובץ.
  - מדידה עצמית: שקף קוד ב־Tesseract ‏0.8% CER ב־1080p. ב־RapidOCR ‏0.0%, גם ב־360p.
- **כתב יד**:
  - [TrOCR base handwritten](https://huggingface.co/microsoft/trocr-base-handwritten): ‏MIT, ‏0.3B, אנגלית (IAM), שורה בודדת.
  - כתב יד עברי: לא ברשימה של Google Vision ([שפות](https://cloud.google.com/vision/docs/languages)). לא נתמך ב־Azure ([שפות](https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/language-support/ocr)). ב־Textract כתב יד הוא אנגלית בלבד ([limits](https://docs.aws.amazon.com/textract/latest/dg/limits-document.html)).
- **דיאגרמות**:
  - dots.mocr מגיע ל־SVG ‏0.901, לעומת 0.839 של Gemini 3 Pro — [GitHub](https://github.com/rednote-hilab/dots.ocr).
  - ב־Surya layout יש מחלקת Diagram — [Surya](https://github.com/datalab-to/surya).
- **Super-resolution**:
  - **OpenCV dnn_superres**, הגדלה פי 4 של monarch.png ‏(768×512) — [opencv_contrib](https://github.com/opencv/opencv_contrib/tree/4.x/modules/dnn_superres):

    | שיטה | זמן | PSNR | SSIM |
    |---|---|---|---|
    | ESPCN | 0.0116 שניות | 26.55 | 0.881 |
    | FSRCNN | 0.0130 שניות | 26.56 | 0.881 |
    | LapSRN | 0.283 שניות | 26.73 | 0.886 |
    | EDSR | 3.27 שניות | 29.24 | 0.921 |
    | bicubic | 0.0003 שניות | 26.06 | 0.875 |

    - EDSR: "< 3 sec … on 256x256 images on an Intel i7-9700K CPU".
  - **Real-ESRGAN** (BSD-3): ‏ncnn-vulkan v0.2.5.0 מ־2022. אין נתוני CPU — [GitHub](https://github.com/xinntao/Real-ESRGAN).
  - **TextZoom** (ECCV 2020): ‏TSRN משפר זיהוי של טקסט ברזולוציה נמוכה ביותר מ־13% ל־CRNN, וב־כ־9% ל־ASTER ול־MORAN — [arXiv](https://arxiv.org/abs/2005.03341).

### Inferences
- **ניתוב לפי אזור.** גלאי layout (סעיף 2), או ה־VLM עצמו, מסמן אזורים, וכל אזור הולך למחלץ שלו:

  | אזור | מחלץ |
  |---|---|
  | **נוסחה** | מקומית PP-FormulaNet_plus-S, כ־0.26 שניות. ‏VLM רק כשהוא נכשל או כשהנוסחה מעורבת בעברית |
  | **טבלה** | מקומית SLANet_plus לטבלה פשוטה עם קווים, ‏OCR עברי לתאים, וסידור RTL של העמודות. לטבלה בלי קווים או מורכבת: VLM עם פלט JSON/Markdown |
  | **גרף ודיאגרמה** | VLM. מבקשים JSON של סדרות ותוויות לגרף, ו־Mermaid או רשימת צמתים וקשתות לדיאגרמה |
  | **כתב יד ולוח** | VLM, ובעברית אין חלופה בענן הגדול. Gemini 3.1 Flash-Lite הוביל בעברית מודפסת ב־GlotOCR, ועל כתב יד אין נתון |
  | **קוד** | OCR מקומי. ההזחה משוחזרת מקואורדינטת ה־x של כל שורה (`left`/רוחב תו ממוצע), כי פלט הטקסט מכווץ רווחים. אחר כך Magika לזיהוי השפה, ואופציונלית בדיקת תחביר |

  - שורות בפלט קוד יכולות להתחיל ב־"-". הנרמול של המדידה שלי הסיר תבליטים בתחילת שורה, ובקוד צריך לכבות את זה.
- **Super-resolution**: רק כשגובה x של הטקסט מתחת לכ־10px (סעיף 7) ואין זרם חד יותר. גם אז FSRCNN/ESPCN זולים, והתועלת שלהם ל־OCR לא הוכחה על שקפים. העדיפות היא תמיד להוריד את הזרם הגבוה (סעיף 7).

### Gaps
- **לא נמצאו**:
  - בנצ'מרק להמרת דיאגרמה ל־Mermaid.
  - OCR פתוח לכתב יד עברי.
  - חילוץ גרפים עם תוויות בעברית.
  - נתוני CPU ל־PP-Chart2Table, ‏DePlot ו־ChartGemma.
  - עדות לשיפור OCR משימוש ב־SR על שקפים.
- **ה־"+24%" של DePlot** נרשם מכרטיס המודל בלי ההקשר המדויק של הבנצ'מרק.

## 6. איחוד לאורך זמן: הצבעה בין פריימים, בחירת הפריים החד, מעקב אחרי screen-share, יישור ל־transcript והתאמה ל־PDF

### Takeaway
מכונת מצבים על אירועי הגלאי:
1. מאחדת חשיפות ליחידה אחת, ושומרת את **המצב האחרון והשלם**.
2. בוחרת בטווח היציבות שלו את הפריים החד ביותר ברזולוציה מלאה, לפי Variance of Laplacian.
3. מריצה OCR פעם אחת לכל מצב, ולא לכל פריים.
4. מיישרת לתמלול לפי זמן, ומזינה את טקסט השקף כהקשר ל־ASR ולמילון התרגום, לפי SlideSpeech.

כשיש PDF מקורי, מתאימים לפיו לפי דמיון טקסט ו־pHash, ולוקחים את הטקסט מה־PDF. ‏pypdfium2 ברישיון Apache/BSD, ו־PyMuPDF ב־AGPL.

### Cited Findings
- **SlideSnap**: בחירת הפריים החד לפי Laplacian variance על פיקסלים לא מוסתרים, וחציון זמני שממסך את המרצה — [GitHub](https://github.com/arjun-goel/slidesnap).
- **AutoSlides**: "אימות יציבות" לפני שמירה, ו־pHash עם Hamming 10 להסרת כפילויות — [GitHub](https://github.com/bit-admin/AutoSlides-Extractor).
- **lecture2notes**: הסרת כפילויות ב־clustering ואחריו keypoint matching, וחיתוך presenter_slide לפי features — [GitHub](https://github.com/HHousen/lecture2notes).
- **SliTraNet**: כשל בשקף שמוצג פחות מ־8 פריימים, ובשינויים קטנים מונפשים — [ar5iv](https://ar5iv.labs.arxiv.org/html/2202.03540).
- **SlideSpeech** (ICASSP 2024): ‏1,705 סרטונים, יותר מ־1,000 שעות, מהן 473 שעות מתומללות. טקסט השקף משמש הקשר לזיהוי דיבור — [arXiv](https://arxiv.org/abs/2309.05396).
- **LPM** (17/8/2022): יותר מ־180 שעות ויותר מ־9,000 שקפים — [arXiv](https://arxiv.org/abs/2208.08080).
- **pypdfium2**: ‏Apache-2.0 או BSD-3-Clause. מרנדר עמודים לתמונה ומחלץ טקסט לפי אזור — [GitHub](https://github.com/pypdfium2-team/pypdfium2).
- **PyMuPDF**: ‏GNU AGPL v3, או רישיון מסחרי מ־Artifex — [GitHub](https://github.com/pymupdf/PyMuPDF).
- **מדידה עצמית**:
  - **מרחקי hash**: pHash בין חשיפות 4–12 ובין שקפים 16–36 (פירוט בסעיף 1).
  - **שליפת פריים מדויקת** (`-ss` לפני `-i`) של 48 פריימים ב־1080p: ‏20.9 שניות קיר ו־37.8 שניות CPU, כלומר כ־0.79 שניות CPU לפריים. ה־GOP היה 10 שניות (keyframe כל 250 פריימים).

### Inferences
- **הפלט: רשומה לכל יחידה ויזואלית.** הצעה:
  - `id`, ‏`t_start`/`t_end`, ‏`kind` (slide / screen / board / camera-slide / talking-head).
  - `states[]`: רשימת החשיפות עם הזמנים שלהן.
  - `frame_t` של הפריים הנבחר, ו־`sharpness`.
  - `text`: בסדר לוגי, עם `lines[]` שכוללות תיבה, שפה ו־confidence.
  - `regions[]`: טבלה, גרף או נוסחה, עם הפלט המובנה של כל אחד.
  - `phash`, ‏`ocr_engine`, ‏`pdf_page` (אם הותאם).
  - קישור למקטעי התמלול.
- **בחירת הפריים החד**:
  - בתוך טווח היציבות של המצב השלם, מפענחים 2–3 פריימים ברזולוציה מלאה (למשל ב־25%, ‏50% ו־75% מהטווח).
  - בוחרים את זה עם ה־Laplacian variance הגבוה ביותר, מחוץ למסכת ה־PiP.
  - כשהמרצה מסתיר את השקף: חציון של כמה פריימים, לפי SlideSnap.
- **הצבעה בין פריימים**:
  - מריצים OCR על 2–3 הפריימים, ולכל שורה בוחרים את הגרסה שחוזרת, או זו עם ה־confidence הגבוה.
  - זה מכפיל את זמן ה־OCR, שממילא זניח (סעיף 7).
  - זו הסקה. לא מצאתי מקור שמודד את התועלת על שקפים.
- **screen-share**:
  - הגדרת יחידה: חלון או מסמך. גלילה מעדכנת את אותה יחידה, ומעבר חלון פותח יחידה חדשה (סעיף 1).
  - לשמור את "התמונה המלאה" כצירוף של אזורים שנראו. זו הסקה.
- **יישור לתמלול**:
  - כל מקטע ASR משויך ליחידה שנראית באמצע הזמן שלו.
  - מונחים מהשקף, בעיקר מונחים באנגלית בשקף עברי, מוזנים ל־ASR (‏initial prompt או hotwords של faster-whisper) ולמילון התרגום.
  - זה הכיוון של SlideSpeech. השיפור בעברית לא נמדד.
- **התאמה ל־PDF מקורי**:
  - מרנדרים עמודים ב־pypdfium2, מחשבים pHash, ומחלצים את טקסט העמוד.
  - מתאימים כל יחידה לפי ציון משולב של דמיון טקסט ו־pHash. המטרה היא עמידות לחשיפה הדרגתית: עמוד ה־PDF מכיל את המצב השלם.
  - ההתאמה היא בדרך כלל מונוטונית בזמן, ולכן יישור דינמי (DTW) עדיף על התאמה עצמאית לכל יחידה.
  - אחרי התאמה בטוחה: הטקסט מה־PDF מחליף את ה־OCR, ונשארים רק זמן היחידה והחשיפות.
  - **לא להשתמש ב־PyMuPDF (AGPL)** בלי החלטה מודעת.

### Gaps
- **לא נמצא מחקר** שמודד הצבעת OCR בין פריימים על שקפים.
- **לא נמצא מקור כמותי** לשיפור ASR בעברית מטקסט שקף.
- **שיטות היישור ל־PDF** בספרות (מעבר ל־lecture2notes) לא נבדקו, בגלל תקציב החיפוש.

## 7. מספרים מעשיים: שקפים לשעה, קצב דגימה, זמן CPU לשעת 1080p ב־16 vCPU, ורזולוציה מינימלית ל־OCR

### Takeaway
- **כמות**: כ־50 שקפים לשעה (LPM) וכ־120 מעברים לשעה (SliTraNet). כדאי לצפות ל־50–150 מצבים ויזואליים בשעת הרצאה.
- **קצב דגימה**: ‏1fps על 640×360 מספיק לזיהוי. עם החציון, המצב הקצר ביותר שנתפס הוא כ־2 שניות.
- **זמן CPU לשעת הרצאה**, אקסטרפולציה סינתטית:
  - כ־3 דקות CPU במסלול הזול: זרם 360p לזיהוי, שליפה מדויקת של פריים 1080p לכל מצב, ו־Tesseract.
  - כ־7–10 דקות במסלול הכבד: פענוח 1080p מלא ו־RapidOCR.
  - על 16 vCPU זה פחות מדקה בזמן קיר. הרצאות אמיתיות (רעש, ‏VP9/AV1) כנראה יעלו פי 2–4.
- **רזולוציה מינימלית ל־Tesseract**: ‏720p לטקסט גוף טיפוסי, כלומר גובה x של כ־13 פיקסלים ומעלה.
  - ב־480p (‏9–10px) הדיוק נפגע: 3–6% CER, ו־11.6% בשקף מעורב.
  - ב־360p (‏7px) הוא נכשל: 16–24%.
  - PP-OCRv6 עדיין קרא אנגלית ב־360p (0.5%).

### Cited Findings
- **כמה שקפים לשעה**:
  - LPM: יותר מ־9,000 שקפים ביותר מ־180 שעות, כלומר כ־50 לשעה (חישוב שלי) — [arXiv](https://arxiv.org/abs/2208.08080).
  - SliTraNet: ‏380 מעברים ב־190 דקות, כלומר כ־120 לשעה (חישוב שלי) — [ar5iv](https://ar5iv.labs.arxiv.org/html/2202.03540).
  - video-slide-extractor: ‏46 שקפים מהרצאת MIT. משך ההרצאה לא צוין — [GitHub](https://github.com/itsyujay/video-slide-extractor).
- **הנחיות רזולוציה של ספקים**:
  - Google: מומלץ 1024×768 — [Vision](https://cloud.google.com/vision/docs/supported-files).
  - Azure: טקסט של 12px לפחות ב־1024×768 — [Azure OCR](https://learn.microsoft.com/en-us/azure/ai-services/computer-vision/overview-ocr).
  - Textract: לפחות 15px — [Textract](https://docs.aws.amazon.com/textract/latest/dg/limits-document.html).
  - Claude: שגיאות מתחת ל־200px — [Claude vision](https://platform.claude.com/docs/en/build-with-claude/vision).
  - Tesseract: לפחות 300 DPI — [ImproveQuality](https://tesseract-ocr.github.io/tessdoc/ImproveQuality.html).
- **Gemini**: דוגם וידאו ב־1fps — [video](https://ai.google.dev/gemini-api/docs/video-understanding).

#### מדידה עצמית: פענוח וזיהוי
הנתונים: סרטון של 300 שניות ב־1080p25, ‏libx264, ‏GOP של 10 שניות, תוכן סינתטי ב־bitrate נמוך. ההכפלה לשעה היא ×12.

| פעולה | קיר | CPU | לשעת וידאו (CPU) |
|---|---|---|---|
| פענוח 1080p מלא, ‏multi-thread | 15.4 שניות (כ־487fps, פי 19.5 מזמן אמת) | — | — |
| `fps=1` מ־1080p, ‏thread אחד | 21.0 שניות | 20.2 שניות | **כ־242 שניות (4.0 דק׳)** |
| `fps=1` מזרם 360p, ‏thread אחד | 3.9 שניות | 3.4 שניות | **כ־41 שניות (0.7 דק׳)** |
| `fps=1` + ‏scale 640 ל־PNG, ‏multi-thread | 12.4 שניות | 28 שניות | כ־336 שניות |
| keyframes בלבד (`-skip_frame nokey`, ‏32 פריימים) | 1.0 שניות | — | — |
| ציון `scene` ב־480p לכל הפריימים | 18.9 שניות | 34.5 שניות | כ־414 שניות |
| PySceneDetect, ריצה אחת | 19–26 שניות | — | — |
| גלאי ההפרשים v2 (חציון, 640×360, ‏1fps) | 1.2–1.4ms לפריים, ועוד 1.5–1.8ms לקריאת PNG | | **כ־11 שניות** |
| שליפה מדויקת של פריים 1080p (‏`-ss` לכל זמן) | | כ־0.79 שניות לפריים | כ־79 שניות ל־100 מצבים |

#### מדידה עצמית: גובה האות לעומת רזולוציה
הנתונים: גופני DejaVu. "גובה x" הוא גובה ה־x הקטנה, וגובה האות ש׳ יצא זהה בגופן הגוף.

| טקסט (גודל ב־1080p) | 1080p | 720p | 480p | 360p |
|---|---|---|---|---|
| גוף 40px | 22px | 14.7px | 9.8px | 7.3px |
| קוד 36px (mono) | 20px | 13.3px | 8.9px | 6.7px |
| כותרת 64px (bold) | 35px | 23.3px | 15.6px | 11.7px |
| footer ‏24px | 13px | 8.7px | 5.8px | 4.3px |

- **Tesseract**:
  - CER של 0–1.6% כשגובה x הוא 13–22px.
  - 1.6–5.7% בכ־9–10px, ו־11.6–21.3% בשקף מעורב.
  - 16.5–23.8% בכ־7px (טבלה בסעיף 3).
- **RapidOCR** (PP-OCRv6): ‏0.5% באנגלית גם בכ־7px.

### Inferences
- **גודל טקסט טיפוסי**:
  - בשקף 16:9 ‏(13.33×7.5 אינץ׳), כל אינץ׳ שווה 144px ב־1080p.
  - גופן גוף של 18pt (0.25 אינץ׳) הוא em של כ־36px. גובה x הוא כ־18–20px ב־1080p, כ־12–13px ב־720p, כ־8–9px ב־480p וכ־6–7px ב־360p.
  - **מסקנה**: ‏720p הוא המינימום לטקסט גוף ב־Tesseract. ‏1080p נדרש לטקסט קטן (14pt ומטה, ‏footer, צירי גרף).
  - כשהשקף מצולם במצלמה ותופס כחצי מגובה הפריים, צריך לחלק את המספרים ב־2. זה מקרה ל־RapidOCR/PP-OCRv6 באנגלית, או ל־VLM בעברית.
- **אסטרטגיית הורדה**:
  - זרם וידאו־בלבד ברזולוציה נמוכה (360p/480p) לזיהוי. הוא זול פי כ־6 בפענוח.
  - בנוסף הזרם הגבוה ביותר (1080p ומעלה) לחילוץ, רק בזמני המצבים.
  - את ההורדה עצמה מכסה מחקר ההורדה המקביל.
- **שליפת פריימים**:
  - בכ־100 מצבים לשעה: שליפה מדויקת לכל מצב עולה כ־80 שניות CPU, לעומת כ־240 בפענוח 1080p מלא. לכן שליפה עדיפה כשה־GOP בינוני.
  - אם ה־GOP ארוך מאוד או שיש הרבה מצבים: מעבר אחד על הזרם הגבוה עם `select` לזמנים הנבחרים.
- **תקציב CPU לשעת הרצאה**, על בסיס המדידה הסינתטית:

  ההנחה: כ־100 מצבים בשעה.

  | שלב | מסלול זול | מסלול כבד |
  |---|---|---|
  | פענוח לזיהוי | כ־40 שניות (זרם 360p) | כ־240 שניות (פענוח 1080p מלא, שמשמש גם לשליפה) |
  | זיהוי | כ־11 שניות | כ־11 שניות |
  | שליפת פריים 1080p לכל מצב | כ־80 שניות (שליפה מדויקת) | 0 (באותו מעבר) |
  | OCR, פריים אחד לכל מצב | Tesseract: כ־40–60 שניות | RapidOCR: כ־170–330 שניות |
  | **סך הכל** | **כ־3 דקות CPU** | **כ־7–10 דקות CPU** |

  - הצבעה בין 2–3 פריימים לכל מצב (סעיף 6) מכפילה את שורת ה־OCR ואת שורת השליפה.
  - על 16 vCPU זה שניות עד דקה בזמן קיר.
  - **אבל השרת משותף עם התרגום.** כדאי להריץ ב־`nice`, עם מספר threads מוגבל (למשל 2–4 תהליכים), אחרי ה־ASR או לצידו לפי העומס.
  - ה־ASR על CPU כבד בהרבה מהעיבוד הוויזואלי. לא נמדד כאן, ונמצא במחקרים המקבילים.
- **קצב דגימה**:
  - 1fps כברירת מחדל. 2fps רק אם הסט האמיתי מראה אנימציות קצרות שהולכות לאיבוד.
  - עם חציון של 3 דגימות, מצב שמוצג פחות מכ־2 שניות (או 1 שנייה ב־2fps) נעלם. זה מכוון: מעברים חולפים אינם יחידות.

### Gaps
- **לא נמדד על הרצאות אמיתיות**:
  - ה־GOP של זרמים אמיתיים.
  - עלות הפענוח של VP9 ו־AV1.
  - CPU של CX53 (AMD EPYC משותף), שאינו ה־Xeon ‏2.1GHz של ארגז החול.
  - רעש של מצלמה ושל PiP אמיתי.
- **התפלגות מספר המצבים לשעה** בהרצאות בעברית לא ידועה. המספרים נגזרים ממאגרים אקדמיים באנגלית ובגרמנית.
- **תקציב החיפוש ברשת נגמר.** אם צריך עוד מקורות (למשל מחקר על לוחות, psc2code, או בנצ'מרק OCR עברי ל־Claude), אפשר לבקש המשך בהודעה נפרדת או להעלות את `CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION`.
