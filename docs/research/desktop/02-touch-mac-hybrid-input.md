# 02 — מחשב מגע וקלט היברידי (מחקר, 11/11/2026)

חלק מפרויקט "תצוגה למחשב": איך האפליקציות יעבדו נכון עם עכבר, משטח מגע, מקלדת **ומסך מגע** — כולל ה־MacBook Pro החדש עם מגע.
**סימון**: ✔ מאומת ממקור ראשוני (תיעוד/תמליל רשמי/קוד המנוע) · ≈ מוערך (מקור משני, הסקה מקוד, לא נבדק במכשיר).

## תקציר מנהלים

1. **המחשב קיים**: MacBook Pro עם מסך PROLED XDR (‏14″/16″, ‏OLED, ‏120Hz, ‏Dynamic Island), הוכרז 28/10/2026, נמכר מ־6/11. המגע = "קלט משני": macOS 27 **לא משנה פריסה ולא גודל פקדים** — רק שטח פגיעה בלתי־נראה של **36pt** (שווה פיזית ל־44pt בטלפון), שורות תפריט גדולות מעט כשנפתח במגע, ופקדים קטנים שמתרחבים זמנית.
2. **מה דף אינטרנט רואה ב־Safari במחשב כזה** (קוד WebKit שהועלה ב־9–10/11/2026; לא נבדק במכשיר): הקשה = `pointerdown → pointerup → mousedown → mouseup → click`, צפוי **`pointerType: "mouse"`**; גרירת אצבע על תוכן = **גלילה עם `wheel`**; אין Touch Events; `pointer: fine`, `hover: hover`, `any-pointer: fine`, ‏`maxTouchPoints = 0`. **אי אפשר לזהות את המחשב לפי יכולות — רק לפי התנהגות.**
3. **השלכה עלינו**: הקובייה, החוגה והגרירה ברשימות בנויות על `touchstart/move/end` — במחשב Mac עם מגע **לא יגיבו לאצבע**, ובמשטח מגע אין להן מסלול. צריך Pointer Events + מסלול `wheel`.
4. **hover נתקע** אחרי הקשה עד הקשה במקום אחר, והקשה על אלמנט שחושף תוכן ב־hover נחשבת hover בלי click (מנגנון הטלפון הועבר ל־Mac). כל `:hover` צריך שמירה.
5. **שאילתות מדיה = הקלט הראשי בלבד**: מחשב Windows עם מגע מחזיר `pointer: fine` ורק `any-pointer: coarse` מסגיר מגע; ב־Mac גם זה לא. ההמלצה: **מצב קלט דינמי לפי האירוע האחרון**, ניחוש פתיחה מהמדיה.
6. **כמה להגדיל**: Apple במחשב — 36pt בלי שינוי חזותי; Windows — ‏40 epx ‏(Standard) מול 32 ‏(Compact); Chromium במצב טאבלט — סרגל 34→48px, סגירת לשונית 16→24. כלל: **פגיעה 40px במגע במחשב, 44px בטאבלט/טלפון, 24px לעכבר (WCAG AA)**, שורות תפריט +8px רק כשנפתח במגע.
7. **לא לשנות פריסה בהחלפת קלט** (הנחיית Apple; מתאים ל"אפס קפיצות"): משתנים רק שטחי פגיעה, hover, ושורות של תפריט שנפתח עכשיו.
8. **החלקת עמודים**: עכבר — לא גוררים עמודים; משטח מגע — שתי אצבעות אופקי = `wheel` עם `deltaX`, אפשר לחבר לקובייה, אבל מתנגש ב"חזור" של הדפדפן: Chromium/Firefox חוסמים ב־`overscroll-behavior-x: none`, Safari **לא** (באג פתוח מ־2022) — רק `preventDefault` על `wheel`.

## 1. המחשב של Apple עם מסך מגע

### 1.1 מה הושק

| מאפיין | ערך | מקור | סטטוס |
|---|---|---|---|
| מוצר / תאריכים | MacBook Pro PROLED XDR ‏14″/16″; הכרזה 28/10, זמינות 6/11/2026 | MacRumors, CNN | ✔ |
| מסך / שבב | OLED טנדם עד 120Hz, מגע בפאנל, Dynamic Island; ‏M5 Pro/Max (דגם M6 ‏14″ — בלי מגע) | Engadget, CNN | ✔ |
| מחיר (ארה״ב) | ‎$2,899 / ‏$3,399 | MacRumors | ≈ |
| מערכת | macOS 27 ‏(Golden Gate), מגע במסך מ־27.2 | MacRumors, 9to5Mac | ✔ |
| Pencil / מקלדת על המסך / העתק־הדבק במגע | אין / אין / אין | The Verge (דרך MacRumors) | ✔ |
| כיבוי מגע | אפשרי בהגדרות | MacRumors | ≈ |
| Sidecar | iPad עם iPadOS 27 נותן מגע ישיר ל־macOS 27 | TN3212 | ✔ |

### 1.2 איך macOS 27 מתאים את הממשק

| מאפיין | ערך | מקור | סטטוס |
|---|---|---|---|
| פריסה | "לא נראה שונה" — חלונות, טקסט ופקדים זהים עם/בלי מגע, "by design" | Tech Talk "Design for touch on Mac" (תמליל) | ✔ |
| יעד מגע | **36pt**, "same physical size… as iOS's 44 points"; בלתי־נראה | שם | ✔ |
| HIG | "Make tap targets bigger, not the controls themselves"; "Keep the layout and size… the same" | HIG Gestures (עודכן 28/10) | ✔ |
| תפריטים | הפריסה לפי הקלט שפתח: במגע "slightly larger rows"; popover/תפריט מותאם — מותר | Tech Talk | ✔ |
| פקדים קטנים | stepper/dial/slider מתרחבים בהקשה (ההקשה לא משנה ערך), נסגרים לבד | Tech Talk, HIG | ✔ |
| hover | פקד נסתר מופיע בהקשה על האזור; tooltip לא חייב; חצי קרוסלה לא מוצגים במגע; נעלמים כשחוזרים לעכבר | HIG Pointing devices | ✔ |
| ארגונומיה | קצוות המסך = פעולות מדויקות (אגודל נשען); מרכז = מחוות גסות | Tech Talk | ✔ |
| שימוש בפועל | "brief, intentional interactions"; עייפות יד; יעדים קטנים מדי | HIG macOS, WSJ | ✔ |

**מחוות (HIG)**: בחירה = הקשה; פתיחה = הקשה כפולה; גלילה = **אצבע אחת** (בטרקפד שתיים); זום/סיבוב = צביטה/סיבוב; תפריט הקשר = **לחיצה ארוכה**; גרירה = **לחיצה ארוכה ואז גרירה**. **שמורות למערכת**: מחוות שלוש אצבעות, החלקה מהקצה הימני (התראות), מלמעלה (סרגל במסך מלא), מלמטה (Dock), מהפינה הימנית־עליונה (מרכז הבקרה), על ה־Dynamic Island.

### 1.3 מה דף אינטרנט רואה — Safari במחשב מגע

Apple לא פרסמה תיעוד ל־web (דף "Get ready for Touch on Mac" עוסק ב־AppKit). המקור: **קוד WebKit** — קומיטים `[macOS Touch] Upstream…` (‏9–10/11/2026), דגל `HAVE(APPKIT_GESTURES_SUPPORT)`, בדיקות `AppKit Gesture Tests`.

| מאפיין | ערך צפוי | מקור | סטטוס |
|---|---|---|---|
| `maxTouchPoints` | `0` (5 רק ב־`IOS_TOUCH_EVENTS`) | `Navigator.cpp` | ≈ |
| `pointer`/`any-pointer`/`hover`/`any-hover` | fine/fine/hover/hover — קבועים ב־`WebPageMac.mm` | קוד | ≈ |
| Touch Events | לא קיימים (ה־ENABLE לא הורחב ל־Mac) | `PlatformEnableCocoa.h` | ≈ |
| הקשה | `pointerdown, pointerup, mousedown, mouseup, click` | בדיקה `singleClickFiresPointerMouseAndClickEvents` | ✔ |
| `pointerType` בהקשה | `"mouse"` (הקליק הסינתטי עם `mousePointerID`) | `WKAppKitGestureController.mm` | ≈ |
| גרירת אצבע על תוכן | גלילה; הדף מקבל **`wheel`** עם תנופה | בדיקה `scrollAfterMomentum…` | ✔ |
| גרירה על `touch-action: none` | `pointerdown/move/up` (+`mousedown/up`) | בדיקות "manipulation surface" | ✔ |
| `touch-action`, ‏`-webkit-tap-highlight-color` | נאכפים (ENABLE הורחב ל־Mac) | קומיט 460b368 | ✔ |
| קליק בשני שלבים + Content Change Observer | אם ה־mousemove הסינתטי חשף תוכן — **hover בלי click** | שם, `WebPageCocoa.mm` | ✔ |
| hover נתקע | `pointerover/enter` בלי `out/leave` עד הקשה במקום אחר | בדיקה `pointerStaysOverReleased…` | ✔ |
| לחיצה ארוכה | טקסט — בחירת מילה; קישור/תמונה/וידאו — תפריט הקשר + `pointercancel` | בדיקות `pressAndHold…` | ✔ |
| הקשה כפולה | `dblclick`, בחירת מילה, זום חכם לעמודה | `DoubleClickGesturesTests` | ✔ |
| משיכה לרענון | קיימת | MacRumors | ✔ |
| החלקה אופקית בדף | "swipe through webpages" — לא ברור אם גלילה או חזור | MacRumors | ≈ |

**Chrome/Edge/Firefox ב־Mac עם מגע**: אין בקוד Chromium טיפול במגע ישיר ב־macOS. לפי TN3212 אפליקציה שאינה "touch native" מקבלת **הדמיית עכבר**: הקשה = mouse-down+up, נגיעה וגרירה = גלילת טרקפד, לחיצה ארוכה = לחיצה ימנית, צביטה = magnify. בדף: `pointerType: "mouse"`, `wheel`, `contextmenu`, צביטה = `wheel`+`ctrlKey`. ≈

### 1.4 שאר המכשירים ההיברידיים

| מכשיר | pointer | hover | any-pointer | any-hover | מקור | סטטוס |
|---|---|---|---|---|---|---|
| Windows עם מסך מגע + מקלדת (Chrome/Edge/Firefox) | fine | hover | coarse+fine | hover | Lauke 2020 | ✔ |
| אותו מחשב במצב טאבלט | coarse | none | coarse | none | שם | ✔ |
| טאבלט Windows + עכבר (Chromium) | coarse | none | coarse | none (העכבר נעלם) | באג Chromium 1088262 | ✔ |
| מסך מגע שולחני בלי חיישן סיבוב | תמיד fine | hover | — | — | MDN BCD #24451 | ≈ |
| iPad + Magic Keyboard | coarse | none | coarse+fine | hover | דיווח 2026 (t3code #14868) | ≈ |
| Android + עכבר (Chrome) | coarse | hover (שגוי) | coarse+fine | hover | באג 1028118 | ✔ |
| ChromeOS + עכבר | העכבר "ראשי" גם כשנוגעים; תלוי מצב טאבלט | | | | MDN BCD #24451 | ≈ |
| Mac עם מסך מגע (Safari) | fine | hover | fine | hover | קוד WebKit | ≈ |

Chrome ב־Windows חושף Touch Events כשמזוהה מסך מגע, ומ־Chrome 57 מאזיני `touchstart` פועלים גם בלי `ontouchstart` ✔ (blink-dev) — המנוע שלנו כנראה עובד במגע ב־Windows/ChromeOS, ולא ב־Mac.

## 2. הנחיות Apple לקלט היברידי

| מאפיין | ערך | מקור | סטטוס |
|---|---|---|---|
| גודל פקד | iOS/iPadOS ‏44×44pt (מינ׳ 28); macOS ‏28×28 (מינ׳ 20) + **יעד מגע 36pt**; visionOS ‏60 | HIG Accessibility, Tech Talk | ✔ |
| המרה ל־CSS | ב־Safari במחשב 1pt = ‏1px בזום 100% → 36pt ≈ ‏36px | הסקה | ≈ |
| iPadOS + מצביע | המצביע "תוספת", פקדים לא משנים גודל — הם בגודל מגע מראש | HIG Pointing devices | ✔ |
| אפקטים (iPadOS) | highlight (צורת זכוכית לסרגלים/לשוניות), lift (הגדלה+צל לפקד בודד), hover (scale/tint/shadow) | שם | ✔ |
| מגנטיות | המצביע משנה צורה כשנכנס לאזור הפגיעה; מ־iPadOS 26 חץ במקום עיגול | HIG, MacRumors 2025 | ✔ |
| ריפוד אזור פגיעה | ~12pt סביב פקד עם מסגרת, ~24pt בלי מסגרת; אזורים רציפים בין כפתורים צמודים | HIG Pointing devices | ✔ |
| להבדיל אצבע/מצביע | "רק אם זה נותן ערך" | שם | ✔ |
| Pencil hover | תצוגה מקדימה בלבד, **לא פעולה**; ב־web ‏`pointerType: "pen"` עם hover מ־Safari 16.1 | HIG Pencil, MacRumors | ✔/≈ |
| עקביות | כל פעולה במגע — גם במקלדת+עכבר, ולהפך; לא ללמד אינטראקציה שונה לכל קלט | HIG | ✔ |

## 3. Web — זיהוי קלט במכשיר היברידי

**Interaction Media Features**: `pointer`/`hover` = **רק הקלט הראשי**; `any-pointer`/`any-hover` = איחוד (כמה ערכים יכולים להתאים; `any-hover: none` כמעט חסר ערך); משתנים בזמן ריצה (מקלדת מתנתקת, מצב טאבלט) → להאזין ל־`change`. המלצות Lauke ✔: לא להניח קלט יחיד; להגדיל יעדים ב־`any-pointer: coarse`; לתת למשתמש לבחור פריסה.

**Pointer Events**: `pointerType` = ‏`mouse|pen|touch|""` (ריק = מקלדת/לא ידוע) ✔. **`click` ו־`contextmenu` הם PointerEvent** — Chrome 92, Firefox 129, Safari 18.2 ✔ caniuse: אפשר להחליט בקליק עצמו אם להציג תפריט קטן (עכבר) או שורות גדולות/גיליון (מגע). ב־iPad דווח trackpad שמסומן `touch` אחרי סגירת popover ≈ — לא לסמוך על אירוע בודד. `InputDeviceCapabilities` — Chromium בלבד.

**מצב דינמי (input modality)**: המודל של `:focus-visible` — מקלדת בלי מקש שינוי → מצב מקלדת, כל `pointerdown` יוצא ממנו. אותו רעיון לעכבר/מגע: **מצב = הקלט האחרון**, החלפה רק על אירוע אמיתי, ואירועי עכבר "תואמים" אחרי מגע (~700ms) לא מחליפים.

| CSS | מה עושה | במחשב |
|---|---|---|
| `touch-action` | `pan-y` = אנכי לדפדפן, אופקי ל־JS; `manipulation` = בלי זום בהקשה כפולה; `none` = הכל ל־JS | נאכף גם ב־Mac עם מגע ✔ |
| `user-select: none` | בלי בחירת טקסט בגרירה | רק על משטחי גרירה |
| `-webkit-touch-callout` | בועת לחיצה ארוכה ב־iOS | לא רלוונטי |
| `overscroll-behavior` | עוצר שרשור גלילה ו"חזור" בהחלקה | Chromium/Firefox ✔; Safari מתעלם ב"חזור" (WebKit 240183) |
| `inputmode` | סוג מקלדת וירטואלית | טאבלט Windows/ChromeOS; ב־Mac אין מקלדת על המסך |

| מחווה במשטח מגע | מה הדף מקבל | סטטוס |
|---|---|---|
| צביטה (Chromium/Firefox) | `wheel` עם `ctrlKey: true`, ‏`deltaY` = שינוי קנה מידה | ✔ |
| צביטה (Safari ב־Mac) | `gesturestart/change/end` עם `scale` מצטבר; וגם `wheel`+`ctrlKey` מ־Safari 15 (WebKit r277772) — דיווחים סותרים | ≈ |
| שתי אצבעות | `wheel` עם `deltaX/deltaY` ותנופה אחרי ההרמה | ✔ |
| החלקה אופקית בקצה | הדפדפן חוזר/מתקדם אם הדף לא צרך | ✔ |
| `ctrl`+גלגלת אמיתי | זהה לצביטה — אי אפשר להבדיל | ✔ |

`preventDefault` על `wheel` דורש `{ passive: false }`, ובאלמנט שמתחת לסמן כדי לחסום את "חזור" של Safari ≈.

**מלכודות**: (1) hover נתקע — לעטוף ב־`@media (hover: hover)` **וגם** `html:not([data-input=touch])` (ב־Mac עם מגע `hover: hover` תמיד אמת). (2) תפריט שנפתח ב־mouseover — במגע ההקשה הראשונה רק "מרחפת"; לפתוח בלחיצה. (3) הקשה כפולה ב־Mac = `dblclick` + זום חכם → `touch-action: manipulation` על פקדים. (4) `contextmenu` נורה בקליק ימני ובלחיצה ארוכה ב־Android/Windows/Mac עם מגע — **לא** ב־iPhone/iPad (טיימר). (5) גרירה: עכבר — מיד; מגע ב־Mac — לחיצה ארוכה ואז גרירה; תמיד חלופה בלי גרירה (WCAG 2.5.7). (6) מקלדת וירטואלית בטאבלט מכסה חצי מסך.

**"מחשב" או "טאבלט" בלי user-agent**: אין API אמין (`userAgentData.mobile` — Chromium בלבד). היוריסטיקת ה־iPad (`MacIntel && maxTouchPoints > 1`) שבירה: היום ב־Mac עם מגע צפוי 0, אבל אם ישתנה — כל Mac כזה יזוהה כ־iPad. **פריסה לפי רוחב, התנהגות לפי הקלט האחרון — לא "סוג מכשיר".**

## 4. דפוסים בתעשייה — כמה מגדילים במגע

| מערכת | עכבר | מגע | הפרש | מקור | סטטוס |
|---|---|---|---|---|---|
| macOS 27 | פקד 28pt | אותו פקד, פגיעה 36pt; שורות תפריט "מעט" גדלות | 0 חזותית | Tech Talk, HIG | ✔ |
| Windows (WinUI) | Compact: רשת 32 epx | Standard: ‏40 epx; יעד 7.5mm | +8 (‏+25%) | Microsoft Learn | ✔ |
| Windows 11 | Explorer compact | ריפוד נוסף כברירת מחדל, במצב טאבלט compact כבוי; שורת משימות למגע אוטומטית | — | elevenforum, Windows Central | ≈ |
| Office | Mouse mode | Touch mode **ידני** — רק מרווחים בסרגל | — | Microsoft Support | ✔ |
| Chromium (טאבלט) | סרגל 34, ‏bookmark ‏28, סגירת לשונית 16, אייקון 16, כפתורי חלון 34 | 48, ‏36, ‏24, ‏20, ‏41 | +7…+14px | `layout_constants.cc` | ✔ |
| Chromium — מתי | `touch_ui` אוטומטי = מצב טאבלט Windows/ChromeOS | | | `touch_ui_controller.cc` | ✔ |
| Material | צפיפות ‎-1…-3 (‏-4dp לצעד) | 0; יעד 48dp תמיד | 4–12dp | material.io | ✔ |
| WCAG 2.2 | 2.5.8 (AA) ‏24×24 | 2.5.5 (AAA) ‏44×44 | | W3C | ✔ |
| Figma / Notion / Google Docs (web) | אין מצב מגע מתועד; ב־Figma מבקשים מתג; Notion דווח מגיש גרסת טלפון למכשיר מגע | | | פורומים | ≈ |

**מסקנה**: שתי גישות — (א) בלי שינוי חזותי, רק שטח פגיעה ופקדים מתרחבים (Apple במחשב); (ב) צפיפות שנייה של ‎+8px **לפי מצב טאבלט** (Windows, Chromium). אף אחד לא מחליף צפיפות של כל הפריסה בכל הקשה — זה מקפיץ.

## 5. החלקות וגרירה במחשב

| קלט | החלקת עמוד (קובייה) | החוגה | הערה |
|---|---|---|---|
| עכבר | **לא** (גרירה על תוכן = בחירת טקסט) | גרירה כן, `cursor: grab` | ניווט בלחיצה ובמקלדת |
| משטח מגע | `wheel` אופקי בשתי אצבעות → התקדמות הקובייה | גלילה אופקית | מתנגש ב"חזור" |
| מגע Windows/ChromeOS | כמו בטלפון (`touch-action: pan-y`) | כן | קצה המסך שמור למערכת |
| מגע ב־Mac | היום **לא עובד**; גרירה מהירה = `wheel` → מסלול משטח המגע; או Pointer Events עם `touch-action` (≈) | עם `touch-action: none` — Pointer Events | קצה ימני/עליון שמורים |
| מקלדת | חצים ברשימת הלשוניות (ב־RTL שמאלה = הבא), ספרות 1–6 בלי שדה בפוקוס | — | לא `Alt+←`/`⌘[` (חזור של הדפדפן) |

## מה זה אומר ל־THE SNOWBALL

### א. ממצא בקוד (לפני "תצוגה למחשב")
- `snbSwipe`, גרירת החוגה (`nav.tabs`) ולחיצה ארוכה ברשימות ב־`app.js` — כ־20 מאזיני `touch*`. ב־Mac עם מגע לא יגיבו, ובעכבר/משטח מגע אין מסלול.
- `studio.js` (`isIOS`, ‏`devCodes`) — `MacIntel && maxTouchPoints > 1`. היום בטוח (≈ 0 ב־Mac); להוסיף תנאי שלילי (`!matchMedia('(hover: hover) and (pointer: fine)').matches`).

### ב. אלגוריתם מצב הקלט
1. `<html data-input="mouse|touch|pen">` + דגל נפרד `data-kbd="1"` (מקלדת רק מוסיפה טבעות פוקוס).
2. ניחוש פתיחה: `pointer: coarse` → touch, אחרת mouse.
3. `pointerdown` (capture, passive): `touch`/`pen` → מיד; `mouse` → רק ≥700ms אחרי מגע.
4. **"קפיצה" (ניסיוני, ל־Mac עם מגע)**: `pointermove` בודד שקפץ >48px אחרי ≥400ms שקט, ו־`pointerdown` תוך 150ms → כנראה אצבע. **לאמת במכשיר לפני הפעלה.**
5. חזרה לעכבר רק על תנועה רציפה (≥3 `pointermove` בלי כפתור, ≥8px, תוך 150ms) — אירוע סינתטי מגיע בודד.
6. `keydown` של Tab/חצים/Enter/רווח/Esc בלי מקש שינוי → `data-kbd`; `pointerdown` מוחק.
7. **אין שינוי פריסה במעבר** — רק משתנים בלתי־נראים, hover, ושורות של תפריט שנפתח עכשיו (לפי `e.pointerType` של הקליק).

```js
// מצב קלט: html[data-input] = mouse | touch | pen ; html[data-kbd] = 1 בזמן ניווט מקלדת
function snbInputInit(win) {
  if (typeof win === 'undefined' || !win || !win.document) return;
  const doc = win.document, html = doc.documentElement, now = () => win.performance.now();
  const HOLD = 700, JUMP = 48, QUIET = 400, NEAR = 150;
  const mq = (q) => { try { return win.matchMedia(q).matches; } catch (e) { return false; } };
  let mode = '', touchAt = -1e9, jumpAt = -1e9, last = { x: NaN, y: NaN, at: -1e9 }, run = { n: 0, d: 0, at: -1e9 };
  const set = (m) => {
    if (m === mode) return;
    mode = m; html.dataset.input = m;
    win.dispatchEvent(new CustomEvent('snb:input', { detail: m }));
  };
  set(mq('(pointer: coarse)') ? 'touch' : 'mouse');
  doc.addEventListener('pointerdown', (e) => {
    delete html.dataset.kbd;
    const t = now();
    if (e.pointerType === 'touch' || e.pointerType === 'pen') { touchAt = t; set(e.pointerType); return; }
    if (e.pointerType !== 'mouse' || t - touchAt < HOLD) return;
    if (t - jumpAt < NEAR) set('touch');                       // ניסיוני: אצבע שהומרה לעכבר
    last = { x: e.clientX, y: e.clientY, at: t };
  }, { capture: true, passive: true });
  doc.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || e.buttons) return;
    const t = now(), d = Math.hypot(e.clientX - last.x, e.clientY - last.y);
    if (t - last.at > QUIET && d > JUMP) jumpAt = t;            // קפיצה אחרי שקט — לא תנועת עכבר
    last = { x: e.clientX, y: e.clientY, at: t };
    if (t - run.at > NEAR) run = { n: 0, d: 0, at: t };
    run.n++; run.d += d > 0 && d < JUMP ? d : 0;
    if (run.n >= 3 && run.d >= 8 && t - touchAt > HOLD) set('mouse');
  }, { capture: true, passive: true });
  doc.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^(Tab|Enter|Escape|Home|End|PageUp|PageDown| )$/.test(e.key) || e.key.startsWith('Arrow')) html.dataset.kbd = '1';
  }, { capture: true });
}
```
(קוד מקורי; בהטמעה — בליבה (`<core>`), בדיקת vm עם `window` מדומה ורצפי אירועים: מגע → עכבר תואם → תנועה רציפה.)

### ג. מה משתנה ב־CSS

| רכיב | `mouse` | `touch` | הערה |
|---|---|---|---|
| שטח פגיעה `--hit` | 24px | 40px במחשב, 44px בפריסה צרה | `::after` שקוף — בלי שינוי פריסה |
| hover (רקע שורה) | פעיל | כבוי | מונע hover נתקע |
| פעולות שמופיעות ב־hover | ב־hover | בהקשה על השורה + תפריט הקשר | HIG: לא להשאיר גלויות תמיד |
| tooltip | כן | לא | מידע בלבד |
| תפריט/גיליון שנפתח | שורות 32–36px ליד הסמן | שורות 44px; בפריסה צרה — גיליון | נקבע בפתיחה |
| ידיות גרירה | ב־hover | לחיצה ארוכה; ידית במצב עריכה | |
| טבעת פוקוס | `:focus-visible` + `data-kbd` | — | |
| טקסט, צפיפות, מיקום רכיבים | **ללא שינוי** | **ללא שינוי** | "אפס קפיצות" |

```css
:root { --hit: 24px; }
html[data-input="touch"], html[data-input="pen"] { --hit: 44px; }
@media (hover: hover) and (min-width: 1024px) { html[data-input="touch"] { --hit: 40px; } }
.hit { position: relative; }
.hit::after { content: ''; position: absolute; inset: min(0px, calc((100% - var(--hit)) / 2)); }
@media (any-hover: hover) { html:not([data-input="touch"]) .row:hover { background: var(--row-hover); } }
```

### ד. גדלי יעד

| מצב | פקד גלוי | שטח פגיעה | מרווח | שורת תפריט |
|---|---|---|---|---|
| עכבר / משטח מגע | 28–32px (אייקון 16–20) | ≥24px | 4–8px | 32–36px |
| מגע במחשב | אותו פקד | ≥40px (Mac 36pt, Windows 40epx) | 8px | 44px |
| מגע בפריסה צרה | 44px | 44–48px | 8px | 48px |
| עט | כמו עכבר | ≥32px | 8px | 36px |

### ה. ההחלקות והחוגה במחשב
1. **להעביר את המנוע ל־Pointer Events** (`pointerdown/move/up/cancel` + `setPointerCapture`) עם `touch-action: pan-y` על שורש ההחלקה. עמוד — רק `touch`/`pen`; החוגה — גם `mouse`. אותם `pageSwipeDecide`/`swipeVelocity`, רק מקור אחר.
2. **מסלול `wheel`** (משטח מגע + אצבע ב־Mac): מחווה עם `|deltaX| > 1.5·|deltaY|` בהתחלה, מחוץ ל־canvas/גרף/גלילה אופקית → `tabCubeDrag` לפי סכום `deltaX`; סוף = 120ms בלי `wheel` או תנופה דועכת → `pageSwipeDecide`. מאזין `{ passive: false }` על שורש התוכן + `preventDefault`; `overscroll-behavior-x: none` על `html`. **מאחורי מתג בהגדרות** — יש מי שרגיל ל"חזור" בהחלקה.
3. **פריסה רחבה (≥1024px)**: סרגל ניווט בצד ההתחלה (ימין ב־RTL) במקום החוגה; הקובייה נשארת למעבר בלחיצה. בחלון צר — החוגה כמו היום.
4. **מקלדת**: `role="tablist"` עם roving tabindex (ב־RTL `ArrowLeft` = הבא), ספרות 1–6 בלי שדה בפוקוס, `Esc` = "חזור" בשכבות.
5. **אזור מת** 24px מקצה החלון (מחוות מערכת).
6. **WCAG 2.5.1/2.5.7**: כל החלקה — גם בלחיצה; גרירה ברשימה — גם בכפתורי הזזה.

### ו. בדיקות
- **אוטומטי**: Playwright במחשב — `hasTouch: true`, ‏`page.mouse` לעכבר אמיתי, ‏`page.mouse.wheel(dx, 0)` למסלול ה־wheel; vm לפונקציית המצב.
- **במכשיר אמיתי (Mac עם מגע)**: בקונסולה `[navigator.maxTouchPoints, 'ontouchstart' in window, ...['(pointer: coarse)','(any-pointer: coarse)','(hover: hover)'].map(q => matchMedia(q).matches)]`, ולוג `pointerdown/pointermove/wheel/contextmenu` עם `pointerType` בהקשה, גרירה אופקית, לחיצה ארוכה והחלקה בקצה (האם Safari חוזר). כל שורה ≈ בסעיף 1.3 מתעדכנת.

## מקורות

- MacRumors: https://www.macrumors.com/2026/10/27/14-inch-macbook-pro-with-m6-chip/ · https://www.macrumors.com/2026/11/06/oled-macbook-pro-hands-on/ · https://www.macrumors.com/2026/11/05/macbook-pro-proled-xdr-reviews/ · https://www.macrumors.com/2026/03/02/touchscreen-macbook-pro-touch-friendly/ · https://www.macrumors.com/2026/10/05/macos-27-2-touch-gestures/
- https://www.cnbc.com/2026/10/28/apple-touchscreen-macbook-pro-hands-on.html · https://www.cnn.com/2026/10/28/tech/apple-macbook-pro-touchscreen · https://engadget.com/2308988/apple-macbook-pro-proled-tops-out-at-15000 · https://gizmodo.com/macos-touchscreen-macbook-pro-2000831715 · https://www.macworld.com/article/3261748/safari-is-getting-ready-for-apples-first-touchscreen-macbook.html · https://9to5mac.com/2026/10/05/macos-27-2-reveals-new-clues-about-apples-touchscreen-macbook-pro/
- Apple Developer: https://developer.apple.com/touch-on-mac/ · https://developer.apple.com/videos/play/tech-talks/111456/ (תמליל דרך כתוביות הווידאו) · https://developer.apple.com/videos/play/tech-talks/111468/ · https://developer.apple.com/documentation/technotes/tn3212-adopting-gesture-recognizers-for-sidecar-touch-support
- HIG: https://developer.apple.com/design/human-interface-guidelines/gestures · /pointing-devices · /designing-for-macos · /accessibility · /apple-pencil-and-scribble
- WebKit: https://github.com/WebKit/WebKit/commit/460b368222ac905b38bc79d5b2f95b3ca0c753e0 · https://github.com/WebKit/WebKit/commit/376053e01c65bf83749725f41762e88a973b25af · https://github.com/WebKit/WebKit/commit/1aed72c928fe46a4b22c611e488df8c37b1ff744 · main: `Source/WebCore/page/Navigator.cpp`, `Source/WebKit/WebProcess/WebPage/mac/WebPageMac.mm`, `Source/WebKit/UIProcess/mac/AppKitGestures/WKAppKitGestureController.mm`, `Tools/TestWebKitAPI/Tests/WebKit/WebPage/AppKit Gesture Tests/` · באגים: https://bugs.webkit.org/show_bug.cgi?id=240183 · =225788 · =230545 · =209292 · =212580
- משני: https://blakecrosley.com/blog/touch-on-mac-for-developers · https://byteiota.com/apple-touchscreen-macbook-pro-developer-guide/ · https://www.merakit.co.id/en/blog/touchscreen-macbook-pro-web-app-readiness/
- Lauke: https://css-tricks.com/interaction-media-features-and-their-potential-for-incorrect-assumptions/ · https://patrickhlauke.github.io/touch/pointer-hover-any-pointer-any-hover/results/ · https://patrickhlauke.github.io/touch/touchscreen-detection/
- MDN: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/any-pointer · https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/pointerType · https://developer.mozilla.org/en-US/docs/Web/API/Navigator/maxTouchPoints · https://github.com/mdn/browser-compat-data/issues/24451 · caniuse: https://caniuse.com/mdn-api_element_click_event_type_pointerevent · https://caniuse.com/mdn-api_element_contextmenu_event_type_pointerevent
- תקנים: https://w3c.github.io/pointerevents/ · https://drafts.csswg.org/selectors/#the-focus-visible-pseudo · https://www.w3.org/TR/css-overscroll-1 · https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements · https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum
- מחוות: https://danburzo.ro/dom-gestures/ · https://github.com/amilajack/gesture-event-demo · https://developer.chrome.com/blog/overscroll-behavior · https://groups.google.com/a/chromium.org/g/blink-dev/c/KV6kqDJpYiE
- Chromium: https://chromium.googlesource.com/chromium/src/+/main/chrome/browser/ui/layout_constants.cc · https://chromium.googlesource.com/chromium/src/+/HEAD/ui/base/pointer/touch_ui_controller.cc
- Microsoft: https://learn.microsoft.com/en-us/windows/apps/design/input/guidelines-for-targeting · https://support.microsoft.com/en-us/office/turn-touch-mode-on-or-off-90e162b1-44f9-434f-bc2b-9321c989ea6e · https://www.windowscentral.com/software-apps/windows-11/windows-11-touch-optimized-taskbar-makes-its-way-to-more-insiders · https://www.elevenforum.com/t/turn-on-or-off-compact-view-in-file-explorer-in-windows-11.896/
- Material: https://material.io/design/layout/applying-density.html · iPad: https://www.macrumors.com/2025/06/09/windowing-menu-bar-and-pointer-come-to-ipados/ · https://github.com/tailwindlabs/tailwindcss/issues/11109 · https://github.com/pingdotgg/t3code/issues/14868 · Figma: https://forum.figma.com/suggest-a-feature-11/figma-touch-screen-compatibility-20698 · Notion: https://orionfeedback.org/d/7879-pull-native-desktop-pages-bypass-touchscreen-trigger
