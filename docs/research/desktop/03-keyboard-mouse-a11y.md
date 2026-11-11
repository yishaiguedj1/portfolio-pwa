# תצוגה למחשב — מקלדת, עכבר, נגישות ודפוסי אפליקציית מחשב (מחקר 11/11/2026)

> חלק 03 במחקר "תצוגה למחשב". מקורות בסוף. מה שלא אומת במכשיר אמיתי מסומן **[לבדוק]**. Mod = ⌘ ב־Mac, Ctrl ב־Windows.

## תקציר מנהלים
1. **מה שמור ב־Chromium בלשונית רגילה**: רק צירופי לשונית וחלון — סגירה, חדש, גלישה פרטית, שחזור, לשונית הבאה/קודמת, יציאה. כל השאר (Mod+K, ⌘1–9, ⌘,) מגיע לדף. **בחלון PWA מותקן לא שמור כלום** — כך כתוב בקוד המקור. לכן ⌘1–4 ו־F6 נרשמים רק בחלון מותקן.
2. **בעברית מתאימים לפי `code`, לא לפי `key`.** ב־Windows ‏Ctrl+K נותן `key:"ל"`. ב־Mac ‏⌘K נותן "k", אבל ⌥K ו־"/" בלי מקש עזר נותנים תווים אחרים. חריג: type-ahead (קפיצה לפריט לפי אות) — לפי `key`.
3. **חצים ב־RTL זזים לכיוון החזותי של הרכיב**: בלשוניות ובגריד ← = הבא. ציר זמן של מדיה ושל גרף נשאר LTR (→ = קדימה). בקורא הספרים — לפי כיוון הספר. macOS 12+ מחליף ⌘[ ⌘] לבד בממשק RTL, ולכן לא רושמים אותם.
4. **פוקוס**: רק ב־`:focus-visible`. טבעת 2px, offset 2px, ניגוד 3:1 (2.4.13). ברשימות — הדגשת שורה. הפריט הממוקד לא מוסתר מתחת לכותרת דביקה (2.4.11, AA). מטרת לחיצה ≥24px (2.5.8, AA).
5. **קיצור של מקש אחד ("/", "?", J/K/L) צריך מתג כיבוי**, או לפעול רק כשהרכיב בפוקוס (2.1.4, רמה A).
6. **סמן היד = קישור** (HIG, Windows; Tailwind v4 חזר ל־`default` בכפתורים). ממליצים על טוקן אחד שאפשר להפוך.
7. **Tooltip**: מופיע אחרי 500ms, בין פקדים שכנים 100ms, נעלם אחרי 5 שניות (Windows). עד 60–75 תווים (HIG). מופיע גם בפוקוס, נסגר ב־Esc, ובתוכו הקיצור.
8. **גילוי קיצורים**: משתמשים לא עוברים לקיצורים מעצמם. מה שעובד: קיצור שמוצג ליד הפקודה, ותצוגה בהחזקת מקש עזר (ExposeHK, ‏CHI 2013). ב־iPadOS 26 Apple החליפה את חלון ⌘ בשורת תפריטים עם הקיצורים.
9. **חדש ב־2026**:
   - `focusgroup` (Chrome 150, ‏30/06).
   - anchor positioning הגיע ל־Baseline (Firefox 147).
   - Invoker Commands ב־Baseline (12/2025).
   - **MacBook Pro עם מסך מגע (28/10)**, ועדכון HIG לפקדים שנחשפים ב־hover. hover לבד לא מספיק גם ב־Mac.
10. **מצב הריפו**:
    - אין `metaKey`, ואין ניווט בחצים — גם לא בקורא ובנגן.
    - רק כמה כללי `:focus-visible`, ו־~80 כללי `cursor:pointer`.
    - בסטודיו Esc מבצע `back()`.
    - בספרייה לחיצה ימנית על כריכה רק נחסמת.

## 1. קיצורים סטנדרטיים ומה תפוס

### 1.1 מוסכמות (HIG Keyboards, ‏Apple 102650, ‏Microsoft)
| פעולה | macOS | Windows | ב־PWA |
|---|---|---|---|
| לוח פקודות | ⌘K | Ctrl+K | מוסכמה של כלים, לא של מערכת ההפעלה. Ctrl+K ב־Chrome/Win (חיפוש בשורת הכתובת) לא שמור |
| חיפוש בתוכן | ⌘F, ⌘G | Ctrl+F, F3 | דורסים רק כשהדפדפן לא רואה את התוכן (קורא מעומד, רשימה וירטואלית) |
| הגדרות | ⌘, | Ctrl+, (נפוץ) | לא שמור ב־Chrome |
| חזור / קדימה | ⌘[ ⌘] · ⌘← ⌘→ | Alt+← Alt+→ | של הדפדפן — עובדים דרך History API |
| חדש / סגור | ⌘N / ⌘W | Ctrl+N / Ctrl+W | **שמורים** |
| פריט 1–9 | ⌘1–9 | Ctrl+1–9 | בדפדפן = לשונית N |
| Quick Look | Space | — | בגריד: Space תצוגה מקדימה, Enter/⌘↓ פתיחה |
| תחילה / סוף | ⌘↑ ⌘↓ | Ctrl+Home/End | ב־Mac הדפדפן גולל איתם את הדף. לא לרשום גלובלית |
| Home/End/PgUp/PgDn | fn+חצים | מקשים ייעודיים | במחשבי Mac ניידים אין את המקשים. חלופה: ⌘↑↓ בתוך רשימה |
| Esc | ביטול | ביטול | Microsoft: ‏"Esc only affects transient UI" — לא חוזר אחורה |
| מעבר בין אזורים | ⌃F6 | F6 / ⇧F6 | ב־Chrome ‏F6 = שורת הכתובת |
| תפריט הקשר מהמקלדת | — | Shift+F10, מקש Menu | שולחים אירוע `contextmenu` |

**כללי צירוף** (HIG + APG + Microsoft):
- ⌘ ראשי, Shift משני, ⌥ לפקודות נדירות. **ב־Mac לא להשתמש ב־⌃**: ⌃-קליק = לחיצה ימנית.
- סדר התצוגה: ⌃⌥⇧⌘. במקש עם שני תווים מציגים את העליון (⌘?).
- לא מוסיפים מקש עזר לקיצור קיים בשביל פקודה לא קשורה.
- APG: לא לשלב מקש עזר עם Tab/Enter/Space/Esc. לא מקש Windows. לא ⌃⌥ ב־Mac (VoiceOver).
- Windows: ‏Alt+אות = תפריט הדפדפן. Ctrl+Alt = AltGr. שניהם בחוץ.
- **כל צירוף עם Space תפוס**: ⌘Space הוא Spotlight, ⌃Space מחליף שפה, Alt+Space פותח את תפריט החלון, ⌥Space נפוץ אצל משגרי יישומים.

### 1.2 תפוס — לא לדרוס
| צירוף | לשונית Chrome/Edge | Safari | Firefox | חלון PWA (Chromium) |
|---|---|---|---|---|
| Mod+W/T/N, ⇧N, ⇧T, ⇧W, ⌘Q | **שמור** | שמור (+⌘R, ⌘L) | שמור | לא שמור, אבל לא נוגעים (⌘W סוגר חלון) |
| Ctrl+Tab, Ctrl+PgUp/Dn, ⌘⌥←→ | **שמור** | שמור | שמור | לא שמור |
| Mod+1–9 | לא שמור (לשונית N) | לשונית N | לשונית N | **פנוי** |
| Mod+K/F/,/D/S | לא שמור | **[לבדוק]** | לא שמור | פנוי |
| F6, F10, Alt+אות | ממשק הדפדפן | — | — | פנוי |

- **מקור**: ב־Chromium main ‏`IsReservedCommandOrKey` מתחיל ב־"In Apps mode, no keys are reserved", ו־`kReservedCommandIds` מכיל רק לשוניות/חלונות. במסך מלא הכל מגיע לדף חוץ מיציאה.
- רשימת Safari היא מ־2016 (W3C) — **[לבדוק]**. ל"Add to Dock" יש שורת תפריטים משלו — **[לבדוק]** ⌘, ו־⌘1.
- **זיהוי חלון מותקן**: `matchMedia('(display-mode: standalone), (display-mode: window-controls-overlay)')`.

## 2. מקלדת עברית ו־RTL

### 2.1 `key` מול `code`
| מצב | `key` | `code` |
|---|---|---|
| Windows, עברית, Ctrl+K | "ל" | KeyK |
| Mac, עברית, ⌘K (Chromium/WebKit) | "k" — מצב Command של הפריסה (uievents #420) | KeyK |
| Mac, ⌃⌘K / ⌥K | תו עברי / "˚" | KeyK |
| "/" בלי מקש עזר, SI-1452 | "." (ו־Q מפיק "/") | Slash |
| פסיק / נקודה | "ת" / "ץ" | Comma / Period |
| ⇧9 | ")" — התו ההפוך, ו־bidi מציג אותו נכון | Digit9 |

- **ההחלטה**: `code` הוא מקור האמת. התאמה לפי `key` רק לאות לטינית (Dvorak/AZERTY).
- **התווית**: האות הלטינית מתוך `code`, כי במקלדות בישראל מודפסות שתי השפות. `getLayoutMap()` של Chromium יחזיר "ל".
- SI-1452-2 (2018) מחזירה פיסוק למקומות של QWERTY, אבל אין לה macOS.
- **מלכודות**:
  - מתעלמים מ־`isComposing` ומ־`keyCode 229`.
  - מתעלמים מ־`repeat` במתגים.
  - ב־Mac, בזמן ש־⌘ לחוץ, keyup לא אמין.

### 2.2 חצים ב־RTL — **החץ זז לכיוון החזותי של הרכיב**
APG כתוב ל־LTR בלבד (aria-practices #1437 פתוח). Firefox הפך סרגלי כלים ב־RTL. HIG: להפוך את "הבא/הקודם" ואת פסי ההתקדמות.

| רכיב | ← ב־RTL | → ב־RTL |
|---|---|---|
| לשוניות, סרגל, גריד, radio | הבא | הקודם |
| תפריט עם תת־תפריט | **פותח** תת־תפריט (נפתח שמאלה) | סוגר |
| עץ | פותח / ילד | סוגר / הורה |
| slider כללי | הידית שמאלה (↑/PgUp תמיד מגדילים) | ימינה |
| **ציר מדיה** | אחורה | **קדימה** (Material/Codex: מדיה לא מתהפכת) |
| **גרף / ציר זמן** | מוקדם | **מאוחר** |
| קורא | ספר עברי: הבא | ספר עברי: הקודם (לפי `page-progression-direction`) |
| בורר חודש ‹ › | הבא | הקודם. PgUp/PgDn = מוקדם/מאוחר |

- **macOS 12+**: ‏`allowsAutomaticKeyEquivalentMirroring` (ברירת מחדל true) מחליף בממשק RTL קיצורים עם `[] {} () <>` וחצים. ב־Finder בעברית ⌘] = חזור. **[לבדוק]** בדפדפנים.
- **סדר Tab** = סדר ה־DOM (2.4.3). לא `order` ולא `row-reverse` שסוטים ממנו. `reading-flow` קיים רק ב־Chromium 137.
- **Safari ב־Mac**: ברירת המחדל — Tab מדלג על קישורים וכפתורים, ⌥Tab מגיע אליהם. לכן חצים, קיצורים ולוח פקודות הם הדרך האמינה.
- **תצוגה**: `<kbd dir="ltr">` — אחרת "Ctrl+K" מתהפך. ב־Mac סמלים (⌘K), ב־Windows "Ctrl+K". את הפלטפורמה מזהים לפי `navigator.userAgentData?.platform`, ואם אין — `platform`.

## 3. דפוסי APG ותכונות הפלטפורמה
| דפוס | אצלנו | מקשים והחלטות (RTL לפי 2.2) |
|---|---|---|
| **Tabs** | לשוניות במסך | ←/→ עם גלישה, Home/End. **אוטומטי** כשהפאנל מיידי, **ידני** כשיש טעינה מהרשת. Ctrl+Tab תפוס — אין צירוף גלובלי |
| **Layout grid** | ספרייה, עבודות, מעקב | תחנת Tab אחת. 4 חצים לפי המיקום על המסך (מספר העמודות משתנה). גלישה מותרת. Home/End. Ctrl+Home/End (⌘↑↓). PgUp/PgDn |
| **Data grid** | אחזקות, עסקאות, תנועות, ניהול | חצים בלי גלישה. PgUp/PgDn חובה. Shift+חץ, Ctrl+A. בתא עם פקד: Enter/F2 נכנס, Esc יוצא |
| **Listbox** | בחירה, תוצאות בלוח | ↑↓, Home/End. **type-ahead לפי `key`**. מרובה: Shift+↑↓, Space |
| **Menu button** | "⋯", תפריט הקשר | ↓/Enter → הפריט הראשון, ↑ → האחרון. גלישה. type-ahead. Esc מחזיר את הפוקוס לפותח. מושבת: `aria-disabled` (בתפריט הקשר — מוסתר) |
| **Toolbar** | עורך, מסננים, טווחי גרף | תחנה אחת, roving, ←/→, Home/End |
| **Dialog** | `askConfirm`, טפסים | פוקוס ראשוני: השדה הראשון (באישור הרסני — הכפתור הבטוח). Tab כלוא. Esc. החזרת פוקוס לפותח |
| **Combobox** | חיפוש סימול, לוח פקודות | ↓, Alt+↓, Enter. Esc ראשון סוגר, שני מנקה. `aria-activedescendant`. live region למספר התוצאות |
| **Tree** | sidebar היררכי | ↑↓, →/← פותח/סוגר, Home/End, type-ahead |
| **Disclosure / Slider** | "עוד", עוצמה, מהירות | `aria-expanded`. ‏`aria-valuetext` בעברית ("1:05 מתוך 12:30") |
| **Window splitter** | sidebar / תוכן / מפקח | `role=separator`, חצים, Shift ×10, Home/End, Enter מכווץ, F6 בין חלוניות, דאבל־קליק = ברירת מחדל |

roving tabindex כשהדפדפן צריך לגלול לפריט. `aria-activedescendant` כשהפוקוס נשאר בשדה. Menubar ו־Feed — לא צריך: לוח הפקודות, ו־grid או עימוד.

| תכונה (11/2026) | מצב | שימוש |
|---|---|---|
| קישור דילוג + landmarks | — | "דלג לתוכן" ראשון. `header`/`nav[aria-label]`/`main`/`aside`, ‏`h1` למסך, `document.title` מתעדכן |
| `aria-keyshortcuts` | ARIA 1.2, לא מפעיל כלום | `"Meta+K Control+K"`. מקשי עזר תחילה, המקש ולא התו |
| `inert` | Baseline 2023 | שורש האפליקציה מתחת לשכבה מודלית (`modalPush`) |
| `<dialog>` + `showModal` | Baseline; פוקוס חוזר בסגירה | Esc דרך `cancel` |
| `closedby="any"` | Chrome 134+, **לא ב־Safari** | polyfill |
| Popover `auto` | Baseline 2024 | סגירה בלחיצה בחוץ + Esc. **לא** מנהל חצים ולא כולא פוקוס |
| `popover=hint`, `interestfor` | Chromium בלבד, WebKit התנגד | לא להסתמך |
| Invoker Commands | Baseline 12/2025 | פתיחת חלון/popover בלי JS |
| anchor positioning | Baseline 1/2026 | תפריט/tooltip + `position-try-fallbacks: flip-block, flip-inline` |
| `focusgroup` | **Chrome 150**; Firefox חיובי; WebKit בבדיקה | שיפור הדרגתי מעל roving ב־JS. זיהוי לפי מאפיין |
| גלילה בפוקוס | Chrome 130 | div שגולל צריך `tabindex=0` ושם, כדי שחצים/Space יגללו אותו |

## 4. נראות הפוקוס
| מערכת | הטבעת |
|---|---|
| macOS / Safari | בצבע ההדגשה של המערכת, מחוץ לפקד, עוטפת פינות מעוגלות. `outline:auto` מתעלם מ־color/width. HIG: ‏"focus ring for a text or search field, highlight in a list". פריט ממוקד = רקע בצבע ההדגשה + טקסט לבן. נבחר בלי פוקוס = אפור |
| Chrome / Edge (מגרסה 83) | ‏"thick dark ring with a thin white outline" |
| Windows | מסגרת 2px ראשית + 1px משנית מנוגדת |

| WCAG 2.2 | רמה | דרישה |
|---|---|---|
| 2.4.7 Focus Visible | AA | יש מחוון |
| **2.4.11 Focus Not Obscured** | AA | לא מוסתר **כולו** ע"י הדר/נגן דביק |
| **2.4.13 Focus Appearance** | AAA | שטח ≥ היקף ברוחב 2px, ניגוד 3:1 בין ממוקד ללא ממוקד. טבעת פנימית ≥3px. C40 (שני צבעים) |
| 1.4.11 | AA | 3:1 לגבולות ולמחוון |
| **2.5.8 Target Size** | AA | ≥24×24, או ריווח ששווה לזה |
| **2.1.4 Character Key Shortcuts** | A | קיצור מתו בלבד ("?" נחשב, גם עם Shift): כיבוי / שינוי למקש לא־תווי / פעיל רק בפוקוס |
| 1.4.13 | AA | Esc סוגר, אפשר לעבור על התוכן בעכבר, הוא נשאר |
| 2.5.7 Dragging | AA | לכל גרירה יש חלופה בקליק |

APG: הפוקוס חייב להיראות שונה מבחירה. **אסור שהפוקוס ייפול ל־`body`** אחרי סגירה או מחיקה.

## 5. עכבר

**Hover ו־tooltip**:
- **תזמון (Windows `TTM_SETDELAYTIME`)**: הופעה 500ms (= זמן דאבל־קליק), בין פקדים שכנים 100ms, הסתרה אחרי 5000ms. ב־macOS ‏`NSInitialToolTipDelay` מערכתי, ו־Apple לא פרסמה ברירת מחדל. במערכות עיצוב: 100–500ms ב־hover, מיידי בפוקוס.
- **NN/g**: גם hover וגם פוקוס. לא מידע חיוני. קצר. עקבי. לא בטאץ'.
- **Windows** מצרף את הקיצור לבד ("Save (Ctrl+S)").
- סגנונות hover רק תחת `(hover:hover) and (pointer:fine)`.
- **מגע ב־Mac** (HIG 28/10/2026): פקד שנחשף ב־hover צריך דרך נוספת. פקד חיוני מופיע גם בתפריט ההקשר. הקשה חושפת **בלי להפעיל**. אצלנו: מופיע גם ב־`:focus-within` ובתפריט.

**סמן**:
| סמן | מתי |
|---|---|
| `default` | כפתורים, לשוניות, תפריטים, שורות. HIG: ‏"standard pointer for… interface elements" |
| `pointer` | רק `<a href>`. HIG: ‏"content beneath the pointer is a URL link" |
| `text` / `grab`·`grabbing` | טקסט / הזזת גרף, ידית גרירה |
| `col-resize` | splitter |
| `not-allowed` | **רק** יעד שחרור לא חוקי בזמן גרירה |
| `copy` | ⌥ בזמן גרירה |
| `progress` | טעינה ברקע. אף פעם לא `wait` |

Tailwind v4 (PR #8962) הסיר את היד מכפתורים, וספריות רכיבים מחזירות אותה — זו מחלוקת. **המלצה**: טוקן `--cursor-action: default`, וה־affordance הוא רקע hover. ההחלטה למשתמש (7.7).

**תפריט הקשר**:
- אירוע `contextmenu`: לחיצה ימנית, ⌃-קליק, Shift+F10, מקש Menu. כשמגיע מהמקלדת — מעוגן לפריט הממוקד.
- HIG: רלוונטי, ~3 קבוצות לכל היותר, תת־תפריט ברמה אחת, הרסני אחרון. לא זמין — מוסתר. **בלי קיצורים**. כל פריט קיים גם ב־"⋯" / בלוח.
- בטקסט, בקישור ובתמונה — התפריט המקורי. Shift+לחיצה ימנית = מקורי.

**בחירה מרובה**:
- Mac: ⌘-קליק, Shift-קליק. Windows: Ctrl-קליק, Shift-קליק. **ב־Mac ‏ctrlKey+קליק = תפריט**, ולכן ההחלפה היא `metaKey`.
- מקלדת: Shift+חצים, Mod+A, Esc מנקה. סרגל פעולות עם מונה.

**גרירת קבצים** (וידאו לסטודיו, EPUB, CSV/Flex):
- שכבת שחרור על כל החלון, רק כש־`types` כולל `Files`. `preventDefault` ב־`dragover`. מונה נגד הבהוב. Esc מבטל.
- **תמיד גם כפתור "בחירת קובץ"** (2.5.7) **וגם הדבקה**.
- סידור מחדש: ידית + "הזז למעלה/למטה" (Mod+⇧+↑↓) + live region.

**דאבל־קליק**: פותח / מאפס זום / מאפס splitter. לעולם לא הדרך היחידה. לא מעכבים קליק בודד.

**גלילה**:
- macOS צף, Windows קבוע. `scrollbar-gutter: stable` בתוכן, `scrollbar-width: thin` בפאנלים, `overscroll-behavior: contain`.
- **לא חוטפים את הגלגל**. זום רק עם `ctrlKey` (צביטה ב־Chrome/Firefox = wheel+ctrlKey). `passive:false` רק בגרף. Shift+גלגל = אופקי.

**Splitter**: קו 1px, אזור לחיצה ≥8px. הרוחב נשמר ב־localStorage (נוחות). ב־RTL ה־sidebar מימין.

## 6. גילוי קיצורים למשתמש חדש
| ממצא | מקור |
|---|---|
| גם משתמשים מנוסים לא עוברים לקיצורים מעצמם | Lane et al., IJHCI 2005 |
| להבליט את הקיצור ברגע השימוש בעכבר מאיץ למידה | Grossman et al., CHI 2007 |
| **ExposeHK**: החזקת מקש עזר מציגה את הקיצורים על הפקדים. יותר שימוש, מהירות גבוהה יותר, העדפה ברורה | Malacria et al., CHI 2013 |
| iPadOS 26: שורת תפריטים עם קיצורים במקום החזקת ⌘ | Apple 102393, MacStories |
| Windows: קיצור בתוך ה־tooltip ובתפריט | Microsoft |
| לוח פקודות חלש למתחילים, חזק בחזרתיות. אסור שיכולת תהיה רק שם | uxpatterns (דעת מומחים) |

**סדר עדיפות**:
1. **כפתור "חיפוש ופקודות ⌘K" גלוי** בהדר. מתחיל לוחץ עליו ולומד מהתווית.
2. קיצור בכל tooltip ובכל פריט ב־"⋯".
3. קיצור בכל שורה של לוח הפקודות.
4. "?" — מקובץ לפי הקשר, עם חיפוש. מציג רק מה שפעיל עכשיו.
5. טיפ חד־פעמי בכניסה הראשונה מהמחשב. לא מודלי.
6. אחרי 3 פעולות בעכבר — טיפ **אחד** ("טיפ: ⌘K"), לכל היותר פעם בשבוע.
7. שלב 2: החזקת Mod במשך 1 שנייה מציגה תוויות. מתבטל בכל מקש או קליק.

## 7. מה זה אומר ל־THE SNOWBALL

### 7.1 מנוע קיצורים אחד (ב־`core`)
- **רישום אחד** `{id, code, mods, scope, when, labelKey, run}`. ממנו נבנים לוח הפקודות, "?", ה־tooltips ו־`aria-keyshortcuts`. המחרוזות ב־`STRINGS.he/en`.
- **מאזין `keydown` אחד**:
  - מכבד `defaultPrevented`.
  - מחסנית היקפים: חלון > תפריט > עורך > מסך > גלובלי, משולבת ב־CloseWatcher.
- **בשדה טקסט**: רק Mod מרשימה מותרת (⌘K, ⌘S, ⌘↩) ו־Esc. חד־מקשי — אף פעם.
- **ההתאמה**: `code` + קבוצת מקשי עזר **מדויקת**. ב־Mac ‏Mod=`metaKey`, ו־`ctrlKey` הוא לא ⌘.
- **הגדרה "קיצורים של מקש אחד"**, פעילה כברירת מחדל (2.1.4).
- **Esc** סוגר שכבה אחת בכל פעם: popover → תפריט → חלון → פאנל → ניקוי חיפוש → ביטול בחירה. **לא חוזר אחורה בין מסכים** — משנים את ה־`back()` של הסטודיו במחשב.

### 7.2 מפה משותפת
| פעולה | Mac | Windows | `code` | תנאי |
|---|---|---|---|---|
| לוח פקודות | ⌘K | Ctrl+K | KeyK+Mod | בכל מקום, גם בשדה. שוב = סגירה |
| חיפוש במסך | / | / | Slash | מחוץ לשדה, חד־מקשי |
| רשימת קיצורים | ? | ? | Slash+Shift | מחוץ לשדה, חד־מקשי, וגם בלוח |
| הגדרות | ⌘, | Ctrl+, | Comma+Mod | **[לבדוק]** Safari |
| הצגה/הסתרה של ה־sidebar | ⌘\ | Ctrl+\ | Backslash+Mod | **[לבדוק]** Safari |
| Invest / Academy / Studio / Cashflow | ⌘1–4 | Ctrl+1–4 | Digit1–4+Mod | **רק בחלון מותקן** |
| מעבר בין אזורים | F6 / ⇧F6 | F6 / ⇧F6 | F6 | רק בחלון מותקן |
| חזור / קדימה | ⌘[ ⌘] | Alt+← → | — | **לא נרשם**. History API + החזרת פוקוס לפריט |
| אישור חלון / טופס | ⌘↩ | Ctrl+Enter | Enter+Mod | חלונות ועורכים |
| שמירה | ⌘S | Ctrl+S | KeyS+Mod | עורכים |
| ביטול / חזרה על פעולה | ⌘Z / ⇧⌘Z | Ctrl+Z / Ctrl+Y | KeyZ / KeyY | מחוץ לשדה |
| בחר הכל | ⌘A | Ctrl+A | KeyA+Mod | ברשימה |
| מחיקה | ⌘⌫ | Delete | Backspace+Meta / Delete | עם Undo, או `askConfirm` |
| תצוגה מקדימה / פתיחה | Space / ↩ | Space / Enter | — | פריט ממוקד |
| ראשון / אחרון | ⌘↑ ⌘↓ | Ctrl+Home/End | — | בתוך רשימה |

**בחוץ בכוונה**: ⌘N/T/W/L/Q, Ctrl+Tab, ⌘?, ⌃+הכל ב־Mac, Alt+אות ו־Ctrl+Alt ב־Windows, צירופים עם Space, ⌘F גלובלי.

### 7.3 Invest
| פעולה | קיצור |
|---|---|
| מניה לפי סימול | ⌘K → "AAPL" ↩ — דרך השרתון, השהיה של 150ms |
| טבלאות | data grid. ↩ מניה, Space חלון מהיר (גרף קטן), ⌘C מעתיק שורות, ↩ על כותרת = מיון (`aria-sort`) |
| עסקה / הפקדה חדשה | N (חד־מקשי, במסך הרלוונטי) |
| **גרף נרות** (בפוקוס) | ←/→ נר, ⇧←/→ עשרה, Home/End, +/− זום זמן (בלי מקש עזר — ⌘± נשאר זום של הדפדפן), 1–7 טווחים, 0 איפוס, Esc מסתיר את הסמן. `aria-live` מכריז מחיר ותאריך |
| עכבר בגרף | גלגל = גלילת דף. ⌘/Ctrl+גלגל או צביטה = זום. גרירה = הזזה. דאבל־קליק = איפוס. לחיצה ימנית = מעקב / השוואה / העתקה |

### 7.4 Academy
| פעולה | קיצור |
|---|---|
| גריד הספרייה | ↩ פתיחה, Space פרטים, type-ahead לפי שם, ⌘⌫ מחיקה. **לחיצה ימנית = תפריט שלנו** (עריכה/מחיקה), במקום חסימה |
| עמוד הבא / קודם | ספר עברי ← / →, אנגלי → / ←. תמיד: Space ו־PgDn קדימה, ⇧Space ו־PgUp אחורה |
| פרק: תחילה / סוף | Home / End |
| חיפוש בספר | ⌘F — רק בקורא (חיפוש הדפדפן לא רואה עמודים אחרים) |
| גודל אות | ⌘= ⌘− ⌘0 — רק בקורא, ומופיע ב־"?" |
| סימנייה | ⌘D |
| תוכן עניינים / הערות | T / N (כשהקורא בפוקוס) |
| הדגשה | אחרי בחירה: סרגל צף, 1–5 צבע |
| Esc | סוגר פאנל, ואז מסך מלא. לא סוגר את הספר |

### 7.5 Studio
| פעולה | קיצור |
|---|---|
| ניגון / השהיה | Space (רק כשלא בכפתור או בשדה) או K |
| ‎±5 / ±10 שניות | ← → / J L — הציר LTR |
| פריים / מהירות | , . / < > (Comma/Period — בעברית ת/ץ, ו־`code` פותר) |
| עוצמה | ↑↓ רק כשהנגן בפוקוס |
| השתקה / כתוביות / מסך מלא | M / C / F |
| קפיצה ל־0–90% | 0–9 |
| עורך כתוביות | ↑↓ שורה, ↩ עריכה, Esc יציאה, ⌘↩ שמירה ומעבר לבאה, ⌘S, ⌘Z |
| ניגון מתוך שדה עריכה | **Esc ואז Space** (אין צירוף פנוי עם Space) |
| עבודות | grid. ↩ פתיחה, ⌘⌫ ביטול (עם אישור) |
| העלאה | גרירה לכל החלון + כפתור + הדבקה |
מקשים בודדים — רק בפוקוס על הנגן או העורך, וניתנים לכיבוי.

### 7.6 Cashflow ומרכז הניהול
- **חודש**: PgUp/PgDn. בבורר עצמו החצים לפי הכיוון החזותי.
- **חיפוש תנועות**: "/".
- **טבלאות**: data grid. Space פירוט, ⌘C העתקה.
- **מסננים**: toolbar.

### 7.7 דרישות לכל דפוס (ת־עיצוב)
- **פוקוס**:
  - `--focus-ring: 2px solid var(--focus-c)`, `--focus-offset: 2px`. `--focus-c` לכל ערכת צבעים, עם ניגוד 3:1 מול הרקע ומול הפקד.
  - רק ב־`:focus-visible`. **`outline`, לא `box-shadow`** — צל נעלם ב־`forced-colors`.
  - מיכל שחותך: טבעת פנימית 3px.
  - ברשימות: רקע הדגשה + טבעת. נבחר בלי פוקוס = אפור.
  - `scroll-padding-block` בגובה ההדר והנגן.
  - הפוקוס חוזר לפותח או לפריט הבא. בתחילת מסך — `h1` עם `tabindex=-1`.
- **לשוניות**: roving. אוטומטי או ידני לפי זמן הטעינה. חצים לפי RTL.
- **גריד כרטיסים**: תחנה אחת. ניווט לפי מיקום. זיכרון של הפריט האחרון. type-ahead. `focusgroup` כשיפור הדרגתי.
- **תפריטים**: Popover + anchor + מקלדת APG. ב־"⋯" עם קיצורים. בתפריט הקשר בלי קיצורים, ומה שלא זמין מוסתר.
- **חלונות**: `<dialog>`, `inert`, Esc דרך `cancel`. `closedby` + polyfill. משולב ב־`modalPush`/`modalDone`.
- **Tooltip**: 500 / 100ms, מיידי בפוקוס, Esc סוגר, אפשר לעבור עליו בעכבר. עד ~70 תווים. `<kbd dir=ltr>`.
- **מטרות**: ≥24px. אייקון בסרגל 28–32. שורה 32–40.
- **סמן — החלטה למשתמש**: `--cursor-action` = `default` (מוסכמת המערכות) או `pointer` (מוסכמת הרשת).

### 7.8 לוח הפקודות
- **ARIA**: `dialog` מודלי. בתוכו `input[role=combobox]` עם `aria-controls`/`aria-activedescendant` → `listbox` עם `group`ים. live region למספר התוצאות.
- **בלי שאילתה**: "אחרונים" (5), "מומלץ כאן" (לפי המסך), "מעבר אל".
- **עם שאילתה**:
  - הסדר: האפליקציה הנוכחית קודם. אחר כך ישויות (מניות, ספרים, עבודות, קטגוריות) → מסכים → פעולות → הגדרות → עזרה.
  - כל שורה: אייקון, כותרת עם הדגשת ההתאמה, תת־כותרת (איפה זה), קיצור בצד הסוף.
- **מקשים**: ↑↓ עם גלישה. ↩ מבצע. Esc מנקה, ואם השאילתה ריקה — סוגר. ⌫ על שאילתה ריקה חוזר לשורש. ⌘K שוב סוגר.
- **עברית**:
  - נרמול ניקוד, אותיות סופיות, גרש וגרשיים.
  - **תיקון פריסה שגויה** ("ehv" ↔ האותיות העבריות על אותם מקשים, לפי `code`).
  - כינויים בעברית ובאנגלית.
- **ביצועים**:
  - רוחב ~640px, ממוקם ב־15–20% מגובה החלון, ~8 שורות לקבוצה.
  - פתיחה מתחת ל־50ms (אינדקס טעון מראש). חיפוש מקומי בכל הקשה.
  - חיפוש מרוחק דרך השרתון. **בלי Firestore בכל הקשה**.
- **כלל**: אין יכולת שקיימת רק בלוח.

### 7.9 לבדוק במכשירים
1. Safari (לשונית + Dock): האם ⌘K, ⌘,, ⌘\ ו־⌘1 מגיעים לדף.
2. `key`/`code` בפריסה עברית ב־Chrome, Safari ו־Firefox, ב־Mac וב־Windows.
3. האם הדפדפנים מחליפים ⌘[ ⌘] בממשק macOS בעברית.
4. MacBook עם מגע: `(hover)`, `(pointer)`, `any-pointer`.
5. `focusgroup` מול roving ב־JS, גם ב־RTL.
6. Firefox: האם `preventDefault` על Mod+K עובד.

## מקורות
- Apple HIG: https://developer.apple.com/design/human-interface-guidelines/keyboards · /focus-and-selection · /pointing-devices · /menus · /context-menus · /right-to-left · /offering-help
- allowsAutomaticKeyEquivalentMirroring: https://developer.apple.com/documentation/appkit/nsmenuitem/allowsautomatickeyequivalentmirroring
- Apple Support: https://support.apple.com/en-us/102650 · https://support.apple.com/102393
- Chromium: https://chromium.googlesource.com/chromium/src/+/refs/heads/main/chrome/browser/ui/browser_command_controller.cc · https://chromium.googlesource.com/chromium/src/+/refs/heads/main/chrome/browser/ui/accelerator_table.cc
- Chrome shortcuts: https://support.google.com/chrome/answer/157179
- W3C — מקשים שמורים (2016): https://lists.w3.org/Archives/Public/public-webapps-github/2016Jan/0255.html · uievents #420: https://github.com/w3c/uievents/issues/420
- פריסות לא לטיניות: https://www.velopen.com/blog/keyboard-shortcuts-on-non-latin-alphabet-layouts/ · https://zed.dev/blog/keyboard-localization · https://en.wikipedia.org/wiki/Hebrew_keyboard
- APG: https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/ · /patterns/tabs/ · /patterns/grid/ · /patterns/windowsplitter/
- RTL ב־APG: https://lists.w3.org/Archives/Public/public-i18n-archive/2020JulSep/0030.html · Firefox: https://bugzilla.mozilla.org/show_bug.cgi?id=1538575
- WCAG 2.2: https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html · https://www.w3.org/WAI/WCAG22/Understanding/character-key-shortcuts.html
- MDN aria-keyshortcuts: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-keyshortcuts
- Microsoft: https://learn.microsoft.com/en-us/windows/apps/develop/input/keyboard-interactions · https://learn.microsoft.com/en-us/windows/apps/develop/input/keyboard-accelerators · https://learn.microsoft.com/en-us/windows/win32/controls/ttm-setdelaytime
- מדיה ב־RTL: https://m2.material.io/design/usability/bidirectionality.html · https://doc.wikimedia.org/codex/latest/style-guide/bidirectionality.html
- Chromium focus 2020: https://blog.chromium.org/2020/03/updates-to-form-controls-and-focus.html · גלילה בפוקוס: https://developer.chrome.com/blog/keyboard-focusable-scrollers
- focusgroup: https://developer.chrome.com/blog/new-in-chrome-150 · https://groups.google.com/a/chromium.org/g/blink-dev/c/53PP0LgddCQ
- anchor/closedby/interest: https://web.dev/blog/web-platform-01-2026 · https://caniuse.com/mdn-html_elements_dialog_closedby · https://developer.mozilla.org/en-US/docs/Web/API/Popover_API/Using_interest_invokers
- Tailwind PR #8962: https://github.com/tailwindlabs/tailwindcss/pull/8962 · NN/g: https://www.nngroup.com/articles/tooltip-guidelines/
- ExposeHK: https://hal.archives-ouvertes.fr/hal-01894253 · Grossman et al. CHI'07 (10.1145/1240624.1240865) · Lane et al. IJHCI 18(2) 2005
- Safari Tab: https://a11y-guidelines.freee.co.jp/en/faq/articles/p0009.html · Mac עם מגע: https://9to5mac.com/2026/10/31/macbook-pro-touch-optimizations-macos-27-golden-gate/ · iPadOS 26: https://www.macstories.net/stories/ios-and-ipados-26-the-macstories-review/11 · https://uxpatterns.dev/pattern-guide/search-field-vs-command-palette
