# 05 · תאימות למערכות הפעלה — קיצורים, זיהוי ורינדור (11/11/2026)

משלים את `03-keyboard-mouse-a11y.md` (Mac ו־Windows). כאן: Linux, ChromeOS, Googlebook, ופערים. מה שלא אומת — **[לבדוק]**. מקורות בסוף ([מס׳]).

## 1. המערכת החדשה של Google ("google books os")
| פריט | ממצא |
|---|---|
| שם רשמי | **Googlebook** = קטגוריית המכשירים; המערכת נקראת **Googlebook OS** (בסקירות [2][3]). **Aluminium** = שם קוד (פנימי, דלף בינואר 2026 [8]); בדפי ההשקעה של Google השם לא מופיע [1]. בדף המפתחים של Chrome — "Googlebooks" [5] |
| מצב | הוכרזה במאי 2026; הושקה באוקטובר 2026 [3]; סקירת ידיים ב־21/9 [2]. מכשירים: Acer, Dell, HP, ASUS (+Lenovo כשותף) [1][3]. עדכוני מערכת רבעוניים כמו QPR של אנדרואיד [2] |
| טכנולוגיה | "מבוססת Android, עם יסודות שולחן־עבודה מ־ChromeOS" [5]. אפליקציות אנדרואיד נפתחות בחלון עצמאי בגודל משתנה [3] |
| דפדפן | Chrome "בעל מחלקת מחשב": הרחבות, רשימת לשוניות אנכית [2]. אפליקציות Workspace מגיעות כ־TWA מהחנות [2] |
| PWA | בהשקה **אי אפשר היה להתקין אתר כחלון עצמאי**; תוקן בעדכון Chrome מאוחר [3]. תהליך התקנה רב־שלבי חדש ב־ChromeOS (9/11/2026) [9] — **[לבדוק]** אם זהה ב־Googlebook |
| **User-Agent** | **ה־UA של ChromeOS** (מחשב, "X11; CrOS…") — אין מזהה ייחודי [5] |
| `navigator.userAgentData` | `platform === "Android"`, `mobile === false` (נמוכי־אנטרופיה). קוד רשמי: `ua?.platform==='Android' && ua?.mobile===false` [5] |
| `navigator.platform` | תמיד `"Linux x86_64"` בלי קשר לחומרה [5] |
| `Sec-CH-UA-Form-Factors` | זמין (אנטרופיה גבוהה, דורש `Accept-CH`) [5] |
| מקשי מערכת | מקש **G** הוא מקש־העל של Google (כמו Meta): G+`?`/`/` = חלון קיצורים, G+V = הצגת שולחן־העבודה, G+Ctrl+`[`/`]` = מעבר שולחנות; קיצורים ניתנים להתאמה; ספריית הקיצורים "שונה ממה שמכירים מ־ChromeOS" [6]. Meta+G = Magic Pointer [7]. מקש Quick Insert במקום Caps Lock [2][3] |
| קיצורי Chrome | לא נמצא מסמך. הקוד של Chromium: טבלת `Alt+1–9 = מעבר ללשונית` מוגדרת ל־**Linux ול־Android** (לא ל־ChromeOS) [10]. אם Chrome ב־Googlebook הוא בנייה אנדרואידית — `Alt+1–9` תפוס אצל Chrome; אם הבנייה נשענת על יסודות ChromeOS — Alt+1–8 תופס הדוקים/מדף. **[לבדוק במכשיר]** |
| גודל חלון/אפליקציות | Android 16: ב־targetSdk 36, במסך עם sw ≥ 600dp המערכת **מתעלמת** מ־`screenOrientation` ו־`resizeableActivity` (אפליקציה ניתנת לשינוי גודל). ביטול (opt-out) קיים ל־36 בלבד דרך `PROPERTY_COMPAT_ALLOW_RESTRICTED_RESIZABILITY`; ב־37 אין. Play דורשת 36 מאוגוסט 2026 [11]. משמעות: מעטפות TWA/נייטיב שלנו ייפתחו בחלונות משתנים — להסיר נעילת כיוון ולבדוק פריסה רחבה |
| מגע/עט/עכבר, גלילה | **לא נמצא** (מה `pointer`/`hover`/`any-pointer` מחזירים, פסי גלילה). להניח מחשב נייד עם משטח מגע + אולי מסך מגע → כללי "לפי קלט" (`any-pointer`) ולא לפי מערכת |

### Chrome באנדרואיד במצב "אתר מחשב" (טאבלט/טלפון)
UA: `Mozilla/5.0 (X11; Linux x86_64) … Chrome/…`; `Sec-CH-UA-Platform` = `Linux`; model ריק [4]. כלומר `userAgentData.platform === "Linux"` (לא "Android"), ו־`mobile` — **[לבדוק]** (צפוי false). בטאבלטים פרימיום (≥10", 8GB) זו ברירת המחדל [4]. מקרה זה **נראה כמו Linux רגיל** — אין דרך לאבחן אנדרואיד לפי UA.

## 2. ChromeOS
- Alt+1–8 = לחיצה על סמל 1–8 במדף, Alt+9 = האחרון [12]. מטופלים ב־Ash (מנהל החלונות) **לפני** הדף → **אינם זמינים לדף**. [לבדוק במכשיר, אבל להניח שלא].
- ב־Chromium: מקשי החלק העליון (אחורה/קדימה/רענון) שמורים לדפדפן ואי אפשר לבטל [10]. `Ctrl+K` = חיפוש בשורת הכתובת (לא Mac) [10] — לא שמור, ניתן ל־`preventDefault` (ראו §3). ב־**חלון PWA** (display-mode: standalone) `IsReservedCommandOrKey` מחזיר false: **אף מקש אינו שמור** [10].
- מקש Search/Launcher = Meta — אל תשתמשו בו כמודיפייר.

## 3. Linux (Chrome / Firefox) ושמירת קיצורים
**Chrome/Chromium** (קוד המקור [10]): אם הפקודה *לא* ברשימת "שמורים", האירוע מגיע קודם לדף, ו־`preventDefault` על `keydown` מבטל את הפעולה. הרשימה ההיסטורית: חלון/לשונית חדשים, סגירת לשונית/חלון, אינקוגניטו, שחזור לשונית, לשונית הבאה/קודמת, יציאה [13]. **בחירת לשונית לפי מספר (Ctrl/Alt+ספרה) ו־Ctrl+K אינן ברשימה → ניתנות לביטול.** בבנייה של Linux יש חריג: מקש שהמשתמש רשם כ"עריכת טקסט" לא שמור [10]. במסך מלא כמעט הכול עובר לדף [10]. **[לבדוק חי]** — רשימת `IsReservedCommand` הנוכחית לא נקראה.
- קיצורי לשונית ב־Chrome: Windows/Linux — `Ctrl+1–8`, `Ctrl+9`=אחרונה [14]; **נוסף ב־Linux (ו־Android): `Alt+1–9`** [10]. Mac — `⌘+1–8/9` [14].
- `Ctrl+K`/`Ctrl+E` = חיפוש ב־omnibox (Windows/Linux/ChromeOS) [10][14].

**Firefox:** `Alt+1–8` = לשונית ב־Linux (Ctrl ב־Windows, ⌘ ב־Mac) [בדוק בדף התמיכה — לא נטען]. דפים *יכולים* לתפוס Alt+1 ב־Linux (באג 1475551, פתוח) — והמשתמש יכול להחזיר ידנית דרך "Override Keyboard Shortcuts" בהרשאות האתר; ההעדפה `permissions.default.shortcuts` (0 ברירת מחדל, 2 = חסימה) [15][16]. כלומר: ב־Firefox דף שתופס Alt+1 **נוטל** אותו מהדפדפן — לא מוסכם מה "מוגן" (מטא־באג 1052569) [15]. `Ctrl+K` ב־Firefox: דיווחים מעורבים (בחלק מהמקרים נשמר ומתמקד בשורת הכתובת גם כשהדף פותח לוח) [17]. **[לבדוק ב־Firefox נוכחי]**.
- מנהלי חלונות ב־Linux (GNOME/KDE) עשויים לתפוס `Alt+ספרה`/`Super+ספרה` לפני הדפדפן — תלוי בהגדרות; **[לבדוק]**.

## 4. Windows / Mac — פערים
| נושא | ממצא |
|---|---|
| Alt+ספרה ב־Windows | `Alt` + ספרות ב־**numpad** מזין קוד תו; בשורה העליונה — אין משמעות מערכתית. Chrome/Edge בוחרים לשונית ב־Ctrl+ספרה, לא Alt (ב־Windows) [14]. **[לבדוק ב־Edge/Firefox]** אם Alt+ספרה פותח תפריט. משתמשים ב־`e.code` (`Digit1`), לא `e.key`, ולא ב־`Numpad1` |
| ⌥+ספרה ב־Mac | `⌥` משנה את התו (¡™£), אך זה קורה ב־`keypress`/הזנה; `preventDefault` על `keydown` מספיק למנוע הכנסת התו בשדה־טקסט **[לבדוק ב־Safari]**. יש לדלג כשפוקוס בשדה קלט. `e.code` נשאר `Digit1` |
| Ctrl+K ב־Firefox | ראו §3 |
| `Alt+ספרה` ב־Windows PWA | בחלון מותקן אף מקש לא שמור ב־Chromium [10] — `Mod+1–9` בטוח שם |

## 5. המלצה — מפת קיצורים לכל מערכת
| מערכת | פלטפורמה (זיהוי) | פלטת פקודות | הגדרות | מעבר בין עמודים | חיפוש | להציג בחלון קיצורים |
|---|---|---|---|---|---|---|
| Mac / iPad+מקלדת | `Mac*` או `MacIntel` עם `maxTouchPoints>1` | ⌘K | ⌘, | **⌥1–9**; ⌘1–9 רק ב־standalone | `/` | סמלי ⌘ ⌥ ⇧ |
| Windows | `Win*` | Ctrl+K | Ctrl+, | **Alt+1–9**; Ctrl+1–9 רק standalone | `/` | "Ctrl", "Alt" |
| Linux | `Linux*` ו־UA בלי Android/CrOS | Ctrl+K | Ctrl+, | **Ctrl+Alt+1–9** מומלץ (Alt+1–9 תפוס בדפדפן ובחלק ממנהלי החלונות; ב־Firefox נוטלים אותו מהמשתמש); Alt+1–9 רק ב־standalone | `/` | להסביר שבלשונית Firefox Alt+1 משמש גם לדפדפן |
| ChromeOS | UA `CrOS` | Ctrl+K | Ctrl+, | **Ctrl+Alt+1–9** (Alt+1–9 שמור למדף ולא מגיע לדף) | `/` | לא להציג Alt+1–9 כקיצור |
| Googlebook | `userAgentData.platform==='Android' && mobile===false` | Ctrl+K | Ctrl+, | **Ctrl+Alt+1–9** (Alt+1–9 צפוי תפוס; אל תסתמכו על מקש G/Meta) | `/` | אותה מפה של ChromeOS; לא להציג Meta/G |
| אנדרואיד "אתר מחשב" | נראה כ־Linux | כמו Linux | כמו Linux | כמו Linux | `/` | כמו Linux |

הערות:
1. **ברירת מחדל אחידה לשאר המערכות שאינן Mac**: להחליף את מעבר העמודים ל־`Ctrl+Alt+1–9` (לא ל־Alt+1–9) בכל Linux / ChromeOS / Googlebook, ולהשאיר `Alt+1–9` ל־Windows בלבד (במקום שבו אין התנגשות מוכחת). `Ctrl+Alt+ספרה` ב־Windows בלבד — **[לבדוק]** (AltGr = Ctrl+Alt במקלדות אירופיות; במקלדת עברית אין AltGr לספרות, אך זה מסכן מקלדות לועזיות — להימנע ב־Windows).
2. במצב standalone (`matchMedia('(display-mode: standalone)')`): `Mod+1–9` בטוח בכל המערכות (Chromium לא שומר מקשים ב־app windows [10]).
3. מקש Meta/Search/G — לא משתמשים כמודיפייר בשום מקרה.
4. תמיד לבדוק `e.defaultPrevented`/פוקוס בשדה קלט/`isComposing` לפני טיפול, ולקרוא `preventDefault` רק כשהקיצור בוצע.

### זיהוי אמין (קוד מומלץ)
```js
function deskOS() {
  const u = navigator.userAgentData, ua = navigator.userAgent || '';
  const p = (u && u.platform) || navigator.platform || '';
  if (u && u.platform === 'Android' && u.mobile === false) return 'googlebook';   // [5]
  if (/CrOS/.test(ua)) return 'chromeos';
  if (/Mac/i.test(p)) {                       // כולל iPad שמדווח MacIntel
    return (navigator.maxTouchPoints > 1) ? 'ipad' : 'mac';
  }
  if (/iPhone|iPad|iPod/.test(ua + p)) return 'ipad';
  if (/Win/i.test(p)) return 'windows';
  if (/Android/i.test(ua) || p === 'Android') return 'android';  // טלפון/טאבלט במצב נייד
  if (/Linux|X11/i.test(p + ua)) return 'linux';  // כולל אנדרואיד במצב "אתר מחשב"
  return 'other';
}
```
- iPad עם מקלדת: `navigator.platform` = `MacIntel` ו־`maxTouchPoints>1` → להתייחס כ־Mac (⌘/⌥) — הקיצורים נשלחים רגיל. **[לבדוק]** אם בספארי ב־iPadOS ⌥+ספרה עובד.
- הקוד הקיים `deskIsMac()` בליבה בודק `userAgentData.platform` ואז `navigator.platform`: ב־Googlebook מחזיר "Android" ← לא Mac (נכון); אך ב־Windows/Linux אינו מבדיל בין מערכות — להרחיב ל־`deskOS()`.
- ב־Chrome במצב "אתר מחשב" באנדרואיד `platform==="Linux"` — אי אפשר להבדיל מ־Linux אמיתי [4]. לא נדרש — ההתנהגות זהה.

## 6. רינדור לפי מערכת
| נושא | ממצא / המלצה |
|---|---|
| **פס גלילה קלאסי (Windows, רוב Linux)** | תופס מקום (~15–17px ב־Windows, **[לבדוק]** המידה המדויקת). `100vw` **כולל** את הפס כשה־root גולל → גלילה אופקית [18]. להשתמש ב־`100%`/`stretch` ולא ב־`100vw` לרוחב; `scrollbar-gutter: stable` מונע קפיצה בעת הופעת הפס (Baseline 2024, אין השפעה על פסי overlay של Mac/ChromeOS/Android) [19]. בסרגל הצד/פאנלים: `scrollbar-gutter: stable` + `scrollbar-width: thin`. ב־`desktop.css` אין כיום `100vw` (נבדק) |
| **סקלת תצוגה ב־Windows** | רוחב CSS = רוחב פיזי ÷ סקלה: מסך 1920 ב־125% → 1536; ב־150% → 1280; ב־175% → ~1097; ב־200% → 960 (חשבון). הסף 1024 מספיק ל־150% במסך FHD, אך ב־175%+ או במסך 1366×768 ב־125% (~1093) מגיעים לרוחב צר. לכן: לא להניח 1920; לבדוק 1280 ו־1024 במבחני הצילום, וסרגל הצד בעל מצב מכווץ |
| **גופנים עבריים** | Windows: Segoe UI כולל עברית, Arial; Mac/iOS: SF מציג עברית דרך חלופה (Arial Hebrew/SF Hebrew) **[לבדוק שמות מדויקים]**; Android/ChromeOS: Roboto **אין** עברית [20] → נפילה ל־Noto Sans Hebrew (קיים באנדרואיד) ‏[20]; Heebo = הרחבת Roboto עם עברית [20]. **המלצה:** `font-family: system-ui, "Segoe UI", "Noto Sans Hebrew", "Arial Hebrew", Arial, sans-serif` — לוודא שה־`--font` הקיים מכיל `"Noto Sans Hebrew"` ו־`Arial` לפני ה־generic. לא לטעון גופן רשת רק בשביל זה; אם נטען Heebo — בתת־קבוצת עברית בלבד ו־`font-display: swap` |
| **backdrop-filter** | עלות גבוהה על GPU חלש/אנדרואיד; רדיוס גדול ומספר אלמנטים מוגדלים את העלות; הנחיות נפוצות: 8–16px, לא באנימציה, מעט אלמנטים בו־זמנית [21] (מקור משני + באגים של Mozilla; **לא נמדד** אצלנו). Linux בלי האצת GPU — איטי [22]. **המלצה:** לשים על 2–3 משטחים (סרגל צד, לוח פקודות) ולא על רשימות; `@supports not (backdrop-filter: blur(1px))` → רקע אטום; `prefers-reduced-transparency` → אטום; לא להנפיש `blur()` |

## 7. שלושת הסיכונים העיקריים
1. **התנגשות Alt+1–9**: תפוס אצל Chrome ב־Linux (והאנדרואיד), אצל ChromeOS (מדף), כנראה ב־Googlebook, ו־Firefox ב־Linux; הדף "גונב" אותו מהמשתמש ב־Firefox. → `Ctrl+Alt+1–9` מחוץ ל־Windows/Mac.
2. **פס גלילה קלאסי + `100vw` + תצוגה מוגדלת**: גלילה אופקית וקפיצות רוחב; 1024–1280px אפקטיביים ב־Windows.
3. **זיהוי מערכת**: Googlebook מדווח ב־UA את ChromeOS ו־`navigator.platform` תמיד Linux; iPad = MacIntel; אנדרואיד "אתר מחשב" = Linux. זיהוי לפי `userAgentData` + `maxTouchPoints`, והתנהגות לפי קלט (`any-pointer`) ולא לפי מערכת.

## מקורות
[1] https://pasqualepillitteri.it/en/news/2454/googlebook-google-laptop-gemini-intelligence-2026 · https://tbreak.com/google-googlebook-chromebook-successor-2026/
[2] https://9to5google.com/2026/09/21/googlebook-os-hands-on/
[3] https://www.engadget.com/2302681/everything-you-need-to-know-about-googlebooks/
[4] https://developer.chrome.com/blog/desktop-mode
[5] https://developer.chrome.com/docs/android/identify-googlebooks
[6] https://chromeunboxed.com/master-your-new-googlebook-with-this-simple-keyboard-shortcut-trick/
[7] https://chromeunboxed.com/googlebooks-magic-pointer-app-teardown-gives-us-a-glimpse-under-the-hood/
[8] https://www.privacyguides.org/news/2026/01/29/google-accidentally-leaks-upcoming-aluminiumos-desktop-interface/
[9] https://chromeunboxed.com/google-is-rolling-out-a-much-cleaner-multi-step-pwa-install-flow-on-chromebooks/
[10] https://chromium.googlesource.com/chromium/src/+/main/chrome/browser/ui/accelerator_table.cc · https://chromium.googlesource.com/chromium/src/+/main/chrome/browser/ui/browser_command_controller.cc (`IsReservedCommandOrKey`)
[11] https://android-developers.googleblog.com/2025/01/orientation-and-resizability-changes-in-android-16.html · https://developer.android.com/develop/adaptive-apps/guides/app-orientation-aspect-ratio-resizability
[12] https://support.google.com/chromebook/answer/183101
[13] https://codereview.chromium.org/2698013004/patch/40001/50002 (רשימת שמורים היסטורית)
[14] https://support.google.com/chrome/answer/157179
[15] https://bugzilla.mozilla.org/show_bug.cgi?id=1475551 · https://bugzil.la/1052569
[16] https://support.mozilla.org/en-US/questions/1241294 · https://bugzilla.mozilla.org/show_bug.cgi?id=1445942
[17] https://github.com/vueuse/vueuse/discussions/2636 · https://bugzilla.mozilla.org/show_bug.cgi?id=380637
[18] https://polypane.app/blog/strategies-for-dealing-with-horizontal-overflows/ · https://phpfashion.com/en/how-to-fix-100vw-scrollbar
[19] https://developer.mozilla.org/en-US/docs/Web/CSS/scrollbar-gutter
[20] https://en.wikipedia.org/wiki/Roboto · https://m1.material.io/resources/roboto-noto-fonts.html · https://bugzilla.mozilla.org/show_bug.cgi?id=1484899
[21] https://bugzilla.mozilla.org/show_bug.cgi?id=1732817 · https://bugzilla.mozilla.org/show_bug.cgi?id=1828248
[22] https://bugzilla.redhat.com/show_bug.cgi?id=2395768
