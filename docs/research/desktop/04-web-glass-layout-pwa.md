# 04 — זכוכית, פריסת מחשב ו־PWA במחשב: טכניקות הרשת (מצב הדפדפנים 11/11/2026)

> חלק ממחקר "תצוגה למחשב". כאן רק שכבת הרשת (CSS, HTML, JS, מניפסט); שפת העיצוב — בשאר המסמכים בתיקייה.
> **סימון**: **מאומת** = נבדק בסבב הזה מול מקור ראשי (webkit.org, developer.chrome.com, web.dev, MDN, טיוטות CSSWG) או נתוני BCD בחבילת `web-features` 3.45.0. **מוערך** = מקור משני, דיווחי משתמשים או ידע קודם.
> **הדפדפנים היום**: Chrome 157 (3/11/2026; מאז 153 גרסה כל שבועיים), Edge באותו קצב, Firefox 159 (27/10/2026), Safari 27.0 (14/9/2026) ו־27.1/27.2 (אוקטובר).

## תקציר מנהלים

- **זכוכית ברשת = `backdrop-filter` + שכבות ציור** (מילוי שקוף, קו אור, ברק, צל). Baseline בכל המנועים; Safari 18+ בלי קידומת. Safari 26/27 **לא** הוסיפו תכונת "חומר" ציבורית ל־CSS. `-apple-visual-effect` קיים רק ב־WKWebView עם דגל פרטי — לא לאתרים.
- **שבירת אור** (`backdrop-filter: url(#svg)` + `feDisplacementMap`) — Chromium בלבד. ב־Safari לא (באג WebKit 245510), ב־Firefox לא עקבי, בקשת התקינה פתוחה מיוני 2026. **לא בונים עליה.**
- **הסיכון הוא ביצועים וקריאות.** העלות = שטח × רדיוס × תדירות שינוי הרקע. עד 3–4 משטחים חיים במסך, לא על פריטי רשימה, לא מנפישים רדיוס.
- **בפריסת מחשב רוב המשטחים לא יושבים מעל תוכן שזז.** טשטוש חי רק היכן שתוכן עובר מתחת: כותרות דביקות, סרגלים צפים, תפריטים, נגן. סרגל צד ומפקח בעמודות — מילוי שקוף בלי טשטוש.
- **`prefers-reduced-transparency` — רק Chromium** (WebKit סירב מטעמי פרטיות). ב־Mac חובה `prefers-contrast: more` ו־`forced-colors`.
- **נקודות שבירה: 600 / 900 / 1280 / 1680** ועוד `height <= 760`. רכיבים לפי container queries, כי ב־iPadOS 26 ובחלונות מחשב הרוחב רציף.
- **בטוח בשלושת המנועים**: popover, ליבת anchor positioning (Baseline ינואר 2026), View Transitions בתוך מסמך, `@starting-style`, scroll-driven animations (Baseline 27/10/2026), container queries כולל style queries, `field-sizing`, `scrollbar-*`, `@scope`, `contrast-color()`, `light-dark()`, `:has()`, subgrid, `command`/`commandfor`.
- **בלי Safari**: `popover="hint"`, `closedby`, `interestfor`, `interpolate-size`, `corner-shape`, `focusgroup`, scroll-state queries, Window Controls Overlay, `file_handlers`, `launch_handler`.
- **PWA במחשב**: Chrome/Edge — חלון עצמאי, `shortcuts`, `launch_handler`, `file_handlers`, תג, WCO, ולכידת קישורים כברירת מחדל מ־140. Safari "הוסף ל־Dock" — SW, Web Push, תג, `shortcuts` (17.4), **אבל אחסון נפרד**: רק עוגיות מועתקות, וקישור כניסה במייל נפתח בדפדפן ולא מחבר את האפליקציה. נוגע ישירות ל־`acclink.js`.
- **ארכיטקטורה**: `desktop.css` משותף **מחוץ ל־`@layer`** (ה־CSS הקיים לא בשכבות, ושכבה תפסיד לו), הכל תחת `@media (width >= 600px)`, אותו DOM בסידור אחר. לצדו `desktop.js` שנטען רק במחשב: קיצורים לפי `e.code`, מיקוד, כרטיסי ריחוף, WCO, תג.

## 1. זכוכית ברשת

### 1.1 מה יש בפלטפורמה

| טכניקה | Chrome/Edge | Safari | Firefox | מצב |
|---|---|---|---|---|
| `backdrop-filter` | 76 | 18 בלי קידומת; 9–17 `-webkit-` | 103 | מאומת |
| `backdrop-filter: url(#svg)` | עובד, מחוץ לתקן | לא (באג 245510) | סותר | מאומת (C/S), מוערך (F) |
| `filter: url(#svg)` על האלמנט | כן | כן | כן | מאומת — מעוות את התוכן, לא את הרקע |
| `-apple-visual-effect` | — | רק WKWebView + דגל פרטי | — | מאומת — לא ב־Safari |
| HTML-in-Canvas (שבירה ב־WebGL) | ניסוי מקור 148–151 | — | — | מאומת — לא לייצור |

עברנו על רשימות התכונות המלאות של Safari 26.0, 26.2, 26.4 ו־27.0: אין glass/material ב־CSS. דווח באג ב־Safari 18.6 על Sonoma, שבו `backdrop-filter` בלי קידומת לא עובד — לכן משאירים גם `-webkit-backdrop-filter`.

### 1.2 האנטומיה: שש שכבות, מהזולה ליקרה

1. **מילוי שקוף** (אלפא 0.45–0.7) — בלעדיו הטקסט לא קריא מעל רקע משתנה.
2. **טשטוש + רוויה**: `blur(12–24px) saturate(140–180%)`; בבהיר `brightness(1.05)` מוסיף אור.
3. **קו אור**: `inset 0 1px 0` לבן־שקוף למעלה + קו שיער `inset 0 0 0 .5px`.
4. **ברק**: `linear-gradient` לבן־שקוף שדועך עד כ־40% מהגובה.
5. **צל הפרדה**: צל רחב ורך + קו כהה 0.5px.
6. **שבירה** — Chromium בלבד (1.3).

גוון צבעוני = שכבה 1 בצבע הגוון. `contrast-color()` לטקסט רק כשהמילוי כמעט אטום — הפונקציה לא יודעת מה מאחורי הזכוכית.

### 1.3 שבירת אור — איך, ולמה לא אצלנו

מחשבים מראש מפת הסטה (אדום = X, ירוק = Y, 128 = אפס) מפרופיל גובה של "עדשה" עם שפה מעוגלת לפי חוק סנל (מקדם ~1.5). טוענים ב־`feImage` ומעבירים ל־`feDisplacementMap` עם `scale` = ההסטה המרבית; ברק השפה מזווית הנורמל מול אור קבוע.

**מגבלות**: המפה תלויה בגודל האלמנט (שינוי גודל = בנייה מחדש); 8 ביט = הסטה עד כ־±127px; GPU כבד; תמונת `data:` דורשת `img-src data:`.

**מלכודת**: `@supports (backdrop-filter: url(#x))` מחזיר אמת גם ב־Safari (תחביר תקין), אבל שם לא מצויר דבר, ולפי דיווחים גם ה־`blur()` שבאותה רשימה נעלם. אין זיהוי אמין ב־CSS.

### 1.4 חוקי ציור שמפילים זכוכית

**Backdrop Root** (Filter Effects 2): הזכוכית רואה רקע רק עד האב הקרוב שיש לו `filter`, `opacity < 1`, `mask`/`clip-path`, `backdrop-filter`, `mix-blend-mode` או `will-change` של אחד מהם. `transform`, `sticky/fixed` ו־`z-index` **לא**. מכאן:
- **זכוכית בתוך זכוכית** רואה רק את מילוי ההורה. כפתור על סרגל זכוכית = מילוי בלבד (נכון וזול).
- **`opacity` על מכל** שמכיל זכוכית — הטשטוש "קופץ" בסוף האנימציה. מנפישים את ה־`opacity` של המשטח עצמו או `transform`.
- הטשטוש נחתך לגבול כולל `border-radius`; הקצוות במצב mirror.
- משטח מוסתר ב־`opacity: 0` — גם `visibility: hidden` (לקח קיים ב־`docs/ui.md`).
- **Safari 26 לא משתמש יותר ב־`theme-color`**: הוא דוגם את רקע `html`/`body` ואלמנטים קבועים או דביקים בקצה. כותרת זכוכית קבועה צובעת את סרגל הדפדפן — רקע מפורש ל־`html`/`body` בכל ערכה.

### 1.5 ביצועים

- **מה עולה**: מצייר את מה שמאחור עד שורש הרקע, מטשטש ומרכיב — בכל פריים שבו האלמנט או הרקע זזים. גלילה מתחת לכותרת זכוכית = טשטוש בכל פריים.
- **חשבון שלנו (5K ב־2× = 2560×1440 CSS)**: כותרת מלאה 56px ≈ ‏0.57M פיקסלים; סרגל צד 280px ≈ ‏1.6M; וילון מסך מלא ≈ ‏14.7M, פי 25. **וילון מודאלי במחשב = עמעום בלבד.**
- **כללי אצבע** (משני, בלי מדידות יצרן): 3–4 משטחים חיים; רדיוס עד ~20px במשטח גדול; `will-change` רק בזמן מעבר. דווח על מאות MB זיכרון GPU מטשטוש קבוע באפליקציית Chromium.
- **אצלנו היום**: הסרגלים והכפתורים מטושטשים (`--gl-fx` = `blur(28px)`), הכרטיסים (`--gl-card`) מילוי בלבד — החלוקה הנכונה. במחשב לבדוק 20–24px על סרגלים רחבים ולהוריד טשטוש מכפתורים על סרגל זכוכית.
- **למדוד**: Layer borders / Paint flashing ו־Performance בגלילה, על MacBook Air ועל Windows ב־1536×864.

### 1.6 נפילה חיננית ונגישות

- `@supports` על הטשטוש; בלעדיו מילוי כמעט אטום.
- `prefers-reduced-transparency` (Chrome/Edge בלבד) · `prefers-contrast: more` (כולם; ב־macOS "הגברת ניגודיות") · `forced-colors: active` (Windows): `Canvas`/`CanvasText`, בלי צללים וטשטוש.
- ניגודיות מול הרקע **הגרוע ביותר** שיכול לעבור מתחת, לא מול המוקאפ (WCAG AA ‏4.5:1). כשאין ודאות — מעלים אלפא של המילוי.
- macOS/iPadOS 27 הורידו את השקיפות בברירת המחדל והוסיפו מחוון "שקוף ↔ מגוון": הכיוון הוא פחות שקיפות, יותר קריאות.

### 1.7 מתכון זכוכית נקי וזול (קוד שלנו)

`--dg-*` להמחשה; במימוש ממזגים לאסימונים הקיימים (`--gl-fx`, `--gl-bar`, `--gl-panel`, `--gl-card`).

```css
:root {
  --dg-fill: rgb(255 255 255 / .58);  --dg-solid: rgb(246 248 250);
  --dg-rim: rgb(255 255 255 / .75);   --dg-hair: rgb(0 0 0 / .07);
  --dg-drop: 0 10px 28px -14px rgb(0 0 0 / .22);
  --dg-fx: blur(20px) saturate(170%);
}
[data-theme="dark"] {
  --dg-fill: rgb(30 33 40 / .55);  --dg-solid: rgb(30 33 40);
  --dg-rim: rgb(255 255 255 / .14); --dg-hair: rgb(0 0 0 / .45);
  --dg-drop: 0 10px 28px -14px rgb(0 0 0 / .6);
}
.dg-glass {                                   /* ברירת מחדל אטומה — בטוחה בכל דפדפן */
  background: var(--dg-solid); border-radius: var(--radius);
  box-shadow: 0 0 0 .5px var(--dg-hair), var(--dg-drop);
}
@supports ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .dg-glass {
    background: linear-gradient(to bottom, rgb(255 255 255 / .16), transparent 40%), var(--dg-fill);
    -webkit-backdrop-filter: var(--dg-fx); backdrop-filter: var(--dg-fx);
    box-shadow: inset 0 1px 0 var(--dg-rim), inset 0 0 0 .5px var(--dg-rim),
                0 0 0 .5px var(--dg-hair), var(--dg-drop);
  }
}
@media (prefers-reduced-transparency: reduce), (prefers-contrast: more) {
  .dg-glass { background: var(--dg-solid); -webkit-backdrop-filter: none; backdrop-filter: none; }
}
@media (forced-colors: active) {
  .dg-glass { background: Canvas; color: CanvasText; border: 1px solid CanvasText; box-shadow: none; }
}
```

**כותרת חלונית שהזכוכית שלה מופיעה רק כשיש תוכן מתחתיה** (scroll-driven, Baseline; רק `opacity` מונפש, על ה־compositor):

```css
.pane { overflow: auto; scroll-timeline: --pane block; }
.pane-head { position: sticky; inset-block-start: 0; isolation: isolate; }
.pane-head::before {
  content: ""; position: absolute; inset: 0; z-index: -1;
  background: var(--dg-fill); -webkit-backdrop-filter: var(--dg-fx); backdrop-filter: var(--dg-fx);
  box-shadow: 0 .5px 0 var(--dg-hair);
}
@supports (animation-timeline: scroll()) {
  .pane-head::before { animation: dg-head linear both; animation-timeline: --pane; animation-range: 0 40px; }
  @keyframes dg-head { from { opacity: 0; } }
}
```

## 2. פריסת מחשב

### 2.1 רזולוציות אמיתיות (יחידות CSS)

| מכשיר / מסך | רוחב × גובה | מצב |
|---|---|---|
| MacBook Neo 13" (2026) | פאנל 2408×1506; ב־2× ‏1204×753 (ברירת המחדל לא פורסמה) | מוערך |
| MacBook Air 13" (M2–M4) | 1470×956 מדווח / 1280×832 ב־2× (מקורות סותרים) | מוערך |
| MacBook Air 15" | 1710×1107 מדווח / 1440×932 ב־2× | מוערך |
| MacBook Pro 14" / 16" | 1512×982 / 1728×1117 | מאומת / מוערך |
| iMac 24" | 2240×1260; "יותר מקום" 2560×1440 | מוערך |
| 1920×1080 | 1920 ב־100%; 1536×864 ב־125%; 1280×720 ב־150%. ‏27.8% ו־9.1% מהמחשבים (StatCounter, אוק׳ 2026) | מאומת |
| 1366×768 · 2560×1440 | ‏7.5% · ‏3.8% | מאומת |
| 4K ב־200% · 5K ב־2× | 1920×1080 · 2560×1440 | מוערך |
| iPad mini (A17 Pro) | 744×1133 | מאומת |
| iPad (A16) / Air 11" · Pro 11" | 820×1180 · 834×1210 | מאומת |
| iPad Air 13" · Pro 13" | 1024×1366 · 1032×1376 | מאומת |

- **החלון קטן מהמסך**: ב־Mac לשוניות וסרגל ≈ 80–90px; ב־Windows ‏Chrome ושורת המשימות ≈ 130px — מסך 1536×864 נותן חלון ≈ 1536×730 (מוערך).
- **חצי מסך**: 735 (MBA 13), 768 (1536), 960 (1920), 1280 (2560).
- **iPadOS 26** החליף את Split View בחלונות שמשנים גודל בחופשיות — כל רוחב אפשרי; מתכננים עד 320px.

### 2.2 נקודות השבירה המומלצות

| טווח | מי כאן | פריסה |
|---|---|---|
| < 600 | טלפונים, חלון צר | בדיוק כמו היום |
| 600–899 | iPad לאורך (744–834), חצי מסך 1470/1536 | עמודה עד ~720px באמצע; ניווט כפס אייקונים או למטה; מפקח = גיליון |
| 900–1279 | iPad לרוחב (1133–1210), חצי 1920, חלון לא מוגדל | סרגל צד מתקפל + תוכן; מפקח צף מהצד |
| 1280–1679 | MacBook 13–14, ‏1536×864, iPad 13" לרוחב, חצי 2560 | סרגל צד + תוכן + מפקח |
| ≥ 1680 | MBA 15, MBP 16, iMac, 1920, 2560 | כנ"ל + עמודות בגרידים; התוכן עד ~1600–1760px |

900 = שני חלקים (260 + 640); 1280 = שלושה (260 + 640 + 340 + רווחים). iPad 11" לרוחב מקבל שניים, iPad 13" לרוחב — שלושה. `@media (height <= 760px)` דוחס כותרות ומרווחים (1366×768, 1536×864). כתיב: `@media (width >= 900px)` (Range syntax, Baseline 2023).

### 2.3 Container queries, גרידים, subgrid

החלונית היא ה־container; רכיב מגיב לרוחבה, לא לרוחב המסך:

```css
.pane { container: pane / inline-size; }
@container pane (inline-size >= 640px) { .kpis { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
.card-grid { display: grid; gap: 16px;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 15rem), 1fr)); }
.card-grid > .card { display: grid; grid-row: span 3; grid-template-rows: subgrid; } /* יישור כותרת/גוף/תחתית בין כרטיסים */
.pane-body { padding-inline: clamp(12px, 3cqi, 32px); }
```

`auto-fill` לכרטיסים (כרטיס בודד לא נמתח), `auto-fit` לשבבים. Style queries — Baseline מאי 2026; container בשם בלבד — Safari 26.4; Gap decorations — רק Chrome 149.

### 2.4 טיפוגרפיה ורוחב קריאה

```css
:root { --fs-body: clamp(1rem, .95rem + .25vw, 1.0625rem); --fs-h1: clamp(1.5rem, 1.2rem + 1.2vw, 2.25rem); }
.prose { max-inline-size: 68ch; text-wrap: pretty; }
:is(h1, h2, h3) { text-wrap: balance; }
```

ב־`clamp()` חייב רכיב `rem` — `vw` לבד לא גדל בזום (WCAG 1.4.4). `ch` = רוחב "0"; אותיות עבריות צרות מעט, כך ש־60–72ch ≈ ‏55–75 אותיות בשורה (מוערך). המשתמש מבקש טקסט מעט גדול: גוף 16–17px במחשב, קריאה ב־Academy ‏18–20px.

### 2.5 מעטפת: סרגל צד + תוכן + מפקח

```css
@media (width >= 900px) {
  .shell { display: grid; block-size: 100dvh;
    grid-template-columns: [nav] var(--nav-w, 248px) [main] minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr); }
  .shell[data-nav="rail"] { --nav-w: 72px; }
  .shell > :is(nav, main, aside) { overflow: auto; overscroll-behavior: contain; scrollbar-gutter: stable; }
}
@media (width >= 1280px) {
  .shell:has(> aside:not([hidden])) {
    grid-template-columns: [nav] var(--nav-w, 260px) [main] minmax(0, 1fr) [insp] clamp(300px, 24vw, 380px); }
}
```

- **RTL**: עמודות ה־grid עוקבות אחרי `direction` — ב־`dir="rtl"` הניווט מימין מעצמו. שוליים וגבולות לוגיים בלבד.
- **קיפול הסרגל**: ≥1280 קבוע (אפשר להסתיר בכפתור); 900–1279 פס אייקונים שנפתח כשכבה צפה עם `inert` על התוכן, סגירה ב־Esc ובלחיצה בחוץ; <900 מגירה. `nav.tabs` של היום הופך לסרגל ב־CSS בלבד.
- אנימציה של `grid-template-columns` נתמכת בכל המנועים (מוערך) אבל מחשבת פריסה בכל פריים — 200ms סביר; חלופה: `transform` על השכבה הצפה והחלפת עמודות בסוף.
- **המפקח**: ב־≥1280 עמודה; מתחת — אותו אלמנט צף (`position: fixed; inset-inline-end: 0`). CSS בלבד, בלי להזיז DOM.

### 2.6 גלילה וקלט

- **כל חלונית גוללת לבד.** מלכודת: קוד שמאזין ל־`window` scroll או משתמש ב־`scrollY`/`window.scrollTo` יישבר — סקירה לפני.
- `scrollbar-gutter: stable` נגד קפיצה כשמופיע פס (Windows; Mac עם עכבר). ב־RTL הפס משמאל ב־Chrome/Firefox; Safari לבדוק.
- `scrollbar-width: thin` + `scrollbar-color`. מ־Chrome 121, כשמגדירים אותם, `::-webkit-scrollbar` מפסיק לחול.
- `overscroll-behavior: contain` על חלוניות ותפריטים.

```css
@media (hover: hover) and (pointer: fine) { .row:hover { background: var(--hover); } .btn { min-block-size: 32px; } }
@media (any-pointer: coarse) { .btn { min-block-size: 44px; } }   /* iPad עם מקלדת, מחשב עם מגע */
```

iPad עם משטח מגע: הסמן הראשי `coarse` ו־`hover: none`, אבל `any-hover: hover` (מוערך) — ריחוף לפי `any-hover`, גודל מטרה לפי `any-pointer`. Pointer Events לכל קלט; `contextmenu` = אותו תפריט של לחיצה ארוכה; גרירת קבצים ל־Studio/Academy.

## 3. תכונות מודרניות: תמיכה והמלצה

גרסאות לפי BCD (`web-features` 3.45.0); **כל השורות מאומתות** חוץ ממה שמסומן. "Baseline" = התאריך שבו כל המנועים תמכו.

| תכונה | Chrome | Safari | Firefox | מצב | שימוש לנו |
|---|---|---|---|---|---|
| Popover API | 116 | 17 | 125 | Baseline 2025 | תפריטים, בוררים |
| `popover="hint"` | 151 (ניסיוני מ־133) | — | 153 | מוגבל | טולטיפים; נפילה ל־`manual` |
| `interestfor` | 149 (לראשונה 142) | — | — | Chromium | שיפור; ב־JS ריחוף + השהיה + מיקוד |
| Anchor positioning (ליבה) | 125 | 26 (מלא 27) | 147 | Baseline ינו׳ 2026 | תפריטים/טולטיפים, `position-area` לוגי |
| `<dialog closedby>` | 134 | — | 141 | מוגבל | נשארים עם `modalPush` |
| `requestClose()` / CloseWatcher | 134 / 126 | 18.4 / — | 139 / 149 | חלקי | ב־Safari מאזין Escape |
| `command`/`commandfor` | 135 | 26.2 | 144 | Baseline דצמ׳ 2025 | פתיחת חלונות בלי JS |
| View Transitions בתוך מסמך | 111 | 18 | 144 | Baseline אוק׳ 2025 | רשימה → פרטים |
| `@view-transition` בין מסמכים | 126 | 18.2 | — | מוגבל | לא חיוני (SPA) |
| `@starting-style` | 117 | 17.5 | 129 | Baseline | כניסת popover/תפריט |
| `interpolate-size` / `calc-size()` | 129 | — | — | Chromium | בכל המנועים: `grid-template-rows: 0fr→1fr` |
| `scrollbar-gutter` · `scrollbar-width` | 94 · 121 | 18.2 | 97 · 64 | Baseline | חלוניות |
| `scrollbar-color` | 121 | 26.2 | 64 | Baseline דצמ׳ 2025 | פס בצבעי הערכה |
| Scroll-driven animations | 115 | 26 | 159 | Baseline 27/10/2026 | זכוכית כותרת, התקדמות קריאה |
| Scroll-state queries | 144 | — | — | Chromium | שיפור בלבד |
| `field-sizing: content` | 123 | 26.2 | 152 | Baseline יוני 2026 | חיפוש, הערות |
| `text-wrap: balance` / `pretty` | 114 / 117 | 17.5 / 26 | 121 / — | balance Baseline | כותרות / פסקאות |
| `focusgroup` | 150 | — | — | Chromium | בינתיים roving tabindex |
| `@scope` | 143 | 26.4 | 146 | Baseline מרץ 2026 | שיפורים בלבד (Safari 26.0–26.3 מדלג על הבלוק) |
| Container queries: גודל / style | 105 / 111 | 16 / 18 | 110 / 151 | Baseline / מאי 2026 | רכיבים |
| `light-dark()` (עם תמונות) | 123 (150) | 17.5 (27) | 120 (150) | Baseline | דורש `color-scheme` לכל ערכה |
| `contrast-color()` | 147 | 26 | 146 | Baseline אפר׳ 2026 | טקסט על גוון אטום |
| `color-mix()` (יותר משני צבעים) | 111 (—) | 16.2 (27) | 113 (150) | Baseline | גוונים מאסימון |
| `content-visibility` | 108 | 26 | 130 | Baseline ספט׳ 2025 | רשימות ארוכות |
| `corner-shape` (squircle) | 139 | — | — | Chromium | פינות רציפות כשיפור |
| `text-box-trim` | 133 | 18.2 | — | מוגבל | יישור אופטי בכפתורים |
| `<select>` מותאם (`base-select`) | 135 | 27 | — | מוגבל | בורר בעיצוב שלנו + נפילה |
| `sizes="auto"` | 126 | 27 (לפי WebKit) | 150 | מוגבל | תמונות עצלות |
| `window-drag` / `app-region` | 152 | — | — | Chromium (מוערך) | אזור גרירה ב־WCO |

Baseline ותיקים לשימוש חופשי: nesting, `:has()`, subgrid, `:focus-visible`, `inert`, relative color, `@property`, `linear()`.

```js
// popover="hint" לפי יכולת, לא לפי דפדפן
const tip = document.createElement('div');
tip.popover = 'hint';
tip.popover = tip.popover === 'hint' ? 'hint' : 'manual';
```

Anchor positioning — עם `position-try-fallbacks: flip-block, flip-inline` בתוך `@supports (anchor-name: --a)`; הקוד הקיים ב־JS נשאר נפילה ל־Safari 18.

## 4. PWA במחשב

### 4.1 Chrome / Edge
- חלון עצמאי; שורת הכותרת בצבע `<meta name="theme-color">` (משתנה בזמן ריצה), אחרת המניפסט (מוערך).
- **גודל פתיחה ראשונה**: אחוז מהמסך עד 1920×1080, בפינה העליונה; אחר כך נזכר. **אין חבר מניפסט לגודל**; `resizeTo()` רק בחלון אפליקציה (מאומת).
- **Chrome 140**: לכידת קישורים כברירת מחדל ב־Windows/macOS/Linux — קישור ב־scope נפתח באפליקציה המותקנת; ניתן לכיבוי (מוערך).
- **Chrome 144**: עדכוני מניפסט בכל טעינה, רובם בשקט; שם/אייקון באישור (מוערך).
- **Chrome 152 (macOS)**: התראות עם שם ואייקון האפליקציה; **תג דורש הרשאת התראות** (מוערך).
- `navigator.install()`/`<install>` מתוכננים ל־Chrome 158 במחשב; WebKit מתנגד (מוערך).
- מסך ההתקנה המורחב משתמש ב־`screenshots` עם `form_factor: "wide"` (מוערך).

### 4.2 Safari — "הוסף ל־Dock" (macOS 14+)

| עובד | לא עובד / שונה |
|---|---|
| כל אתר, בלי מניפסט חובה; נקראים `name`, `display`, `theme_color`, `start_url`, `scope`, `id`, אייקונים (מאומת) | אין `display_override`, WCO, `file_handlers`, `protocol_handlers`, `launch_handler`, Window Management, API התקנה (מאומת) |
| `standalone` = בלי סרגל; אחרת חזרה/קדימה (מאומת) | **אחסון נפרד**: עוגיות מועתקות פעם אחת, localStorage/IndexedDB לא — מצב Firebase ב־IndexedDB = כניסה מחדש (מאומת + הסקה) |
| מחוץ ל־scope → דפדפן ברירת המחדל; `window.open` נשאר באפליקציה; היוריסטיקה ל־OAuth (מאומת) | **קישור כניסה במייל נפתח בדפדפן ולא מחבר את האפליקציה**; ההמלצה: קוד חד־פעמי או passkeys (מאומת) |
| Web Push; Declarative Web Push מ־macOS 15.5; תג אחרי הרשאת התראות **בתוך** האפליקציה (מאומת) | ציור הדף ~60fps כברירת מחדל גם ב־ProMotion (מוערך) |
| `shortcuts` מ־17.4, בתפריט ה־Dock (מאומת) | `display-mode` לא ב־BCD של Safari — לבדוק לפני שסומכים |

### 4.3 Firefox
אפליקציות בשורת המשימות של Windows מ־143 (`minimal-ui`, בלי `shortcuts` וקבצים); אין ב־macOS (מוערך).

### 4.4 חברי המניפסט — מה שווה לנו

| חבר | Chrome/Edge | Safari Dock | לנו |
|---|---|---|---|
| `id` | כן | כן | **חובה**, ייחודי לכל אפליקציה |
| `display_override: ["window-controls-overlay", …]` | 105 | — | שלב ב׳ |
| `"tabbed"` | ChromeOS בלבד | — | לא |
| `launch_handler` | 110 | — | כן: `focus-existing` + `launchQueue` (גם לקישור כניסה) |
| `shortcuts` | 96 | 17.4 | כן, 2–4 |
| `file_handlers` | 102 | — | Academy (`.epub`), Studio (`.srt`, `.vtt`, וידאו) |
| `protocol_handlers` · `share_target` | 96 · Android/ChromeOS | — | לא |
| `scope_extensions` | 139 | — | רק לחלון אחד לכמה תת־דומיינים — לא כרגע |
| Badging | 81 | 17 | כן (Studio: עבודות שהסתיימו) |
| Window Management | 111 | — | לא |
| `screenshots` (`wide` + `narrow`) | כן | — | כן |

```json
{
  "id": "/studio",
  "display": "standalone",
  "launch_handler": { "client_mode": ["focus-existing", "auto"] },
  "shortcuts": [{ "name": "תרגום חדש", "url": "./studio.html#new", "icons": [{ "src": "icon-new-96.png", "sizes": "96x96" }] }],
  "file_handlers": [{ "action": "./studio.html#open", "accept": { "text/vtt": [".vtt"], "application/x-subrip": [".srt"] } }],
  "screenshots": [{ "src": "shot-wide.png", "sizes": "2560x1600", "type": "image/png", "form_factor": "wide" }]
}
```

### 4.5 Window Controls Overlay ו־RTL

```css
@media (display-mode: window-controls-overlay) {
  .titlebar { position: fixed; top: env(titlebar-area-y, 0);
    left: env(titlebar-area-x, 0); width: env(titlebar-area-width, 100%);
    height: env(titlebar-area-height, 40px);
    -webkit-app-region: drag; app-region: drag; }
  .titlebar :is(button, input, a, select) { -webkit-app-region: no-drag; app-region: no-drag; }
}
```

משתני `env()` פיזיים — לכן `left`. כפתורי החלון משמאל ב־macOS ומימין ב־Windows. ב־RTL ‏Chrome מציג את המקור (origin) משמאל — להשאיר ריפוד, שאתר זדוני לא יצמיד טקסט שנראה כמו מקור מהימן. התאמה: `navigator.windowControlsOverlay.getTitlebarAreaRect()` + `geometrychange` (עם debounce). בלי תפריטים נפתחים בשורת הכותרת; במעבר למקור אחר חוזרת שורה רגילה.

### 4.6 צבע החלון לפי ערכה
במניפסט אין צבע לפי ערכה (בקשה פתוחה ב־Chromium). Chrome קורא את ה־meta שמתעדכן ב־JS — קיים אצלנו (`themeColorMeta`). Safari 26 מתעלם ממנו וצובע לפי הרקע — לכן רקע מפורש ל־`html`/`body` בכל ערכה, ו־meta מסונכרן איתו.

## 5. ביצועים במחשב

- **120Hz**: ‏Chrome מצייר עד 120Hz ב־ProMotion; Safari מגביל כברירת מחדל את ציור הדף לכ־60, הגלילה עצמה מערכתית (מוערך). **אנימציה ב־JS (הקובייה) לפי זמן** (הפרש `performance.now()`), לא קבוע לפריים. עדיף CSS/WAAPI על `transform`/`opacity`; מ־Safari 26.4 גם scroll-driven רצות ב־compositor.
- **שכבות**: כל משטח זכוכית = שכבה; `will-change` רק בזמן מעבר; `contain: layout paint` על חלוניות. שינוי גודל חלון רציף — בלי מדידות על `resize`; ResizeObserver + rAF, ופריסה ב־CSS.
- **`content-visibility: auto` + `contain-intrinsic-size: auto 480px`** על פריטי רשימות ארוכות (עבודות Studio, ספרייה, רשימות מעקב); לא על אלמנט עם ילדים דביקים.
- **5K**: ‏Mac הוא 2× בכל מקום — משטח מטושטש גדול עולה פי 4 ממסך 1× (החשבון ב־1.5).
- **תמונות**: לוגואים ואייקונים SVG; רסטר עם `srcset` של `1x, 2x`; `loading="lazy"` + `sizes="auto"`; AVIF/WebP Baseline.
- **גופן**: קובץ משתנה אחד (`NotoSansHebrew-VF.woff2`) — `preload` (`as="font" type="font/woff2" crossorigin`), `font-display: swap`, ו־`size-adjust` על גופן הנפילה נגד קפיצת פריסה (`ascent-override` לא ב־Safari, מוערך).

## 6. מה זה אומר ל־THE SNOWBALL

### 6.1 ארכיטקטורה — שכבת "מחשב" שלא נוגעת בטלפון

1. **`desktop.css` משותף לכל האפליקציות**, נטען אחרי ה־CSS של האפליקציה: `<link rel="stylesheet" href="desktop.css" media="(min-width: 600px)">`. בטלפון יורד בעדיפות נמוכה ולא חוסם ציור; בתוכו כל כלל שוב תחת `@media` — הגנה כפולה.
2. **לא `@layer`**: הצהרה שלא בשכבה גוברת על כל שכבה, וה־CSS הקיים לא בשכבות — שכבת desktop תפסיד. הקובץ מחוץ לשכבות, אחרון, וספציפיות מקידומת קבועה (מחלקת המעטפת). **חריג**: שינוי בכפתורי הזכוכית — **בתוך** `@layer glassbtn` (ב־`!important` בשכבה, שכבה מאוחרת מפסידה).
3. **אותו DOM, סידור אחר**: `nav.tabs` → סרגל צד; גיליונות "פרטים" → מפקח ב־≥1280; עטיפות חדשות (`.shell`, `main`, `aside`) רק כשאין ברירה.
4. **`desktop.js` משותף**, נטען דינמית כש־`matchMedia('(min-width: 900px), (any-hover: hover)')` תואם:
   - **קיצורים לפי `e.code`, לא `e.key`** — במקלדת עברית `e.key` של K הוא "ל". ‏Cmd ב־Mac, ‏Ctrl בשאר; לא דורסים W/T/N/Q/L.
   - roving tabindex בסרגלים ורשימות; כרטיסי ריחוף (`interestfor` כשיש); WCO; `setAppBadge`.
   - מצב סרגל הצד = מפתח localStorage חדש → לבדוק מול `ACCOUNT_KEYS`.
   - בלי זיהוי דפדפן לצורך פריסה.
5. **רכיבים לפי container queries**, לא `@media`.
6. **חובות הפרויקט**: קובץ חדש למטמון ה־SW (`node tools/swgen.js`); CSP `self` בלי שינוי; להרחיב את `qa-deep` ל־820×1180, ‏1180×820, ‏1280×800, ‏1470×956, ‏1536×730, ‏1920×1080 — בהיר, כהה ו־`prefers-contrast: more`.

### 6.2 נקודות שבירה
**600 / 900 / 1280 / 1680** + `height <= 760` (טבלה ב־2.2).

### 6.3 מתכון הזכוכית — שלוש דרגות

| דרגה | איפה | איך |
|---|---|---|
| **חיה** | כותרות דביקות מעל תוכן נגלל, סרגלים צפים, תפריטים/popover, בקרי נגן, מפקח צף (900–1279) | 1.7: `blur(20–24px) saturate(170%)`, קו אור, צל |
| **שקטה** | סרגל צד ומפקח בעמודות (אין תוכן מתחת), כרטיסים | מילוי שקוף מעל רקע האפליקציה (`--gl-ambient`) + קו שיער, **בלי** `backdrop-filter` |
| **אטומה** | `prefers-contrast: more`, `prefers-reduced-transparency`, `forced-colors`, בלי תמיכה | `--dg-solid` / `Canvas` |

עד 3–4 משטחים חיים בתצוגה; וילון מודאלי ב־≥900 = עמעום; כפתור על סרגל זכוכית = מילוי בלבד.

### 6.4 מה להוסיף למניפסט
לכל אפליקציה מניפסט משלה עם `id` ייחודי, `launch_handler` (`focus-existing`) + `launchQueue`, 2–4 `shortcuts`, `screenshots` רחב וצר, `file_handlers` ל־Academy ול־Studio, `theme_color` ו־`background_color` תואמים. `display_override: ["window-controls-overlay"]` — רק בשלב ב׳, אחרי כותרת עם אזורי גרירה ובדיקת RTL.

### 6.5 מה **לא** לעשות

1. לא לבנות על `backdrop-filter: url()` — ב־Safari לא מצויר כלום ו־`@supports` משקר.
2. לא `-apple-visual-effect` או כל מאפיין פרטי.
3. לא טשטוש חי על כרטיסים, פריטי רשימה או וילון מסך מלא.
4. לא להנפיש רדיוס טשטוש, ולא `opacity` של מכל שמכיל זכוכית.
5. לא זכוכית בתוך זכוכית.
6. לא לסמוך רק על `prefers-reduced-transparency` (אין ב־Safari/Firefox).
7. לא לעטוף את `desktop.css` ב־`@layer` מעל CSS שלא בשכבות.
8. לא קיצורים לפי `e.key`, ולא לדרוס קיצורי מערכת.
9. לא לעבור לגלילת חלוניות לפני סקירה של כל מאזין ל־`window` scroll.
10. לא `@scope` לפריסה קריטית.
11. לא `<dialog closedby>`/CloseWatcher בלי נפילה ב־JS ל־Safari.
12. לא לסמוך על `theme-color` ב־Safari 26, ולא על קישור כניסה במייל ב־Safari Dock.
13. לא `vw` בלבד ב־`clamp()`, ולא גובה קבוע — מחשבים ניידים נמוכים (~730px).
14. לא אנימציות JS לפי פריים (60Hz ב־Safari, 120Hz ב־Chrome).
15. לא לזהות "מחשב" לפי UA — לפי יכולות (`any-hover`, `any-pointer`) ורוחב.

## מקורות

- WebKit: Safari 26.0 https://webkit.org/blog/17333/webkit-features-in-safari-26-0/ · 26.2 https://webkit.org/blog/17640/webkit-features-for-safari-26-2/ · 26.4 https://webkit.org/blog/17862/webkit-features-for-safari-26-4/ · 27 בטא https://webkit.org/blog/17967/news-from-wwdc26-webkit-in-safari-27-beta/ · 27.0 https://webkit.org/blog/18325/webkit-features-for-safari-27-0/ · 27.1/27.2 https://web-standards.dev/news/2026/10/safari-27-1-and-27-2/
- Filter Effects 2 (Backdrop Root): https://drafts.csswg.org/filter-effects-2/ · בקשת התקינה: https://github.com/w3c/svgwg/issues/1142 · שבירה ב־SVG: https://kube.io/blog/liquid-glass-css-svg/
- המאפיין הפרטי: https://alastair.is/apple-has-a-private-css-property-to-add-liquid-glass-effects-to-web-content/ · https://github.com/lennondotw/macos-wkwebview-liquid-glass-demo
- Safari 26 וצבע הסרגל: https://arpit.blog/articles/2025/11/safari-drops-support-theme-color/ · https://1ar.io/updates/safari-26-liquid-glass-web/
- שקיפות ב־27: https://www.cultofmac.com/news/liquid-glass-changes-ios-27-macos-27
- תמיכה: https://web-platform-dx.github.io/web-features-explorer/ (+ `web-features` 3.45.0) · https://caniuse.com/css-anchor-positioning · https://caniuse.com/css-backdrop-filter
- web.dev: https://web.dev/blog/web-platform-10-2025 · https://web.dev/blog/web-platform-09-2026 · https://web.dev/blog/web-platform-10-2026 · https://web.dev/articles/window-controls-overlay · https://web.dev/learn/pwa/windows
- Chrome: https://developer.chrome.com/blog/chrome-two-week-release · https://developer.chrome.com/blog/chrome-156-beta · https://developer.chrome.com/blog/html-in-canvas-origin-trial
- Firefox: https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Releases/147 · https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Releases/148
- PWA (משני): https://progressivewebapps.com/blog/the-state-of-progressive-web-apps-in-2026/ · https://openpwa.net/reference/platforms/macos-safari/
- אפליקציות רשת ב־Mac: https://developer.apple.com/videos/play/wwdc2023/10120/ · https://support.apple.com/104996
- רזולוציות: https://gs.statcounter.com/screen-resolution-stats/desktop/worldwide · https://picturesizes-com.pages.dev/specs/devices/macbook · https://www.apple.com/ipad-pro/specs/ · https://support.apple.com/126322
- ProMotion ב־Safari: https://bugs.webkit.org/show_bug.cgi?id=173434
- ביצועים (משני): https://css-tricks.com/almanac/functions/b/blur/
