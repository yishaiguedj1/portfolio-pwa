// Studio Browser (26/10/2026, בקשת המשתמש: "דפדפן שמחליף את Chrome — המבנה של Chrome אחד לאחד, בגימור של Apple").
// אפליקציה נפרדת על הקוד של Studio DM (src/dm): הצייד וההורדות — אותו קוד, בתוך התהליך. השומר:
// (1) אותו צייד ואותה מסירה של DmBrowser — לא העתק; (2) עוגיות/User-Agent לא עוברים ב־extras; (3) טאב פרטי לא נשמר;
// (4) בלי השרת שלנו בקוד של הדפדפן; (5) כל מחרוזת בעברית ובאנגלית; (6) נבנה ומתפרסם בקישור הקבוע.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const ROOT = path.join(__dirname, '..');
const R = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const B = 'android/app/src/browser/java/io/github/yishaiguedj1/snowball/br/';

const gradle = R('android/app/build.gradle.kts');
ok(/app\("browser", "app\.thesnowball\.browser", "Studio Browser"/.test(gradle), 'flavor browser עם מזהה משלו');
ok(/getByName\("browser"\)\.java\.srcDirs\([^)]*"src\/dm\/java"\)/.test(gradle), 'הדפדפן על הקוד של DM (ההורדות בתוך האפליקציה)');
ok(/getByName\("browser"\)\.res\.srcDir\("src\/dm\/res"\)/.test(gradle), 'המשאבים של DM (מחרוזות ההורדות)');
const yml = R('.github/workflows/android.yml');
ok(/app-browser-release\.apk the-snowball-browser\.apk/.test(yml) && /the-snowball-browser\.apk --clobber/.test(yml), 'APK בקישור הקבוע');

const man = R('android/app/src/browser/AndroidManifest.xml');
ok(/android:name="\.MainActivity" tools:node="remove"/.test(man), 'לא TWA');
ok(/\.br\.BrowserActivity"[\s\S]{0,900}android\.intent\.category\.APP_BROWSER/.test(man), 'אפשר להגדיר כדפדפן ברירת המחדל');
ok(/android:name="\.dm\.DmActivity"\s+android:exported="false"/.test(man), 'ההורדות — רק מתוך האפליקציה (המסירה בתוך התהליך)');
ok(/android:name="\.dm\.DmBrowser"\s+android:exported="false"/.test(man), 'הדפדפן הקטן של DM — לא מיוצא');
ok(!/DmSitesProvider/.test(man), 'בלי ספק האתרים של DM (אותה כתובת = התנגשות בהתקנה)');
ok(!/BIND_ACCESSIBILITY_SERVICE|accessibilityservice/i.test(man), 'אף פעם לא שירות נגישות');

const act = R(B + 'BrowserActivity.kt');
const ui = R(B + 'BrUi.kt');
const store = R(B + 'BrStore.kt');
ok(/DmBrowser\.hook/.test(act) && /DmBrowser\.headProbe\(/.test(act) && /DmBrowser\.handOff\(/.test(act), 'אותו צייד, אותה בדיקה ואותה מסירה של DM');
ok(!/HOOK = """/.test(act) && !/requestMethod = "HEAD"/.test(act), 'בלי עותק של הסקריפט או של בדיקת ה־HEAD');
ok(!/putExtra\([^)]*(ck|cookie|Cookie|ua|userAgent)/.test(act), 'עוגיות ו־User-Agent לא עוברים ב־extras');
ok(/filter \{ !it\.private && it\.url\.startsWith\("http"\) \}/.test(act), 'טאב פרטי לא נשמר בטאבים הפתוחים');
ok((act.match(/if \(!t\.private\) BrStore\.(visit|setTitle)/g) || []).length >= 2, 'טאב פרטי לא נכנס להיסטוריה');
ok(/deleteProfile\(PRIV\)/.test(act) && /WebViewCompat\.setProfile\(w, PRIV\)/.test(act), 'טאב פרטי = פרופיל נפרד שנמחק');
ok(/if \(!isUserGesture\) return false/.test(act), 'חלון קופץ בלי נגיעה — חסום');
ok(/component = null; selector = null/.test(act), 'קישור intent: — בלי רכיב מפורש (לא נפתח רכיב פנימי של אפליקציה אחרת)');
ok(/s\.allowFileAccess = false/.test(act) && /s\.allowContentAccess = false/.test(act), 'בלי גישה לקבצים מהדף');
const bub = R(B + 'BrBubble.kt');
const imp = R(B + 'BrImport.kt');
const code = [act, ui, store, bub, imp, R(B + 'BrTab.kt'), R(B + 'BrIcons.kt')];
for (const s of code) ok(!/thesnowball\.app|vercel\.app|workers\.dev|\/api\//.test(s), 'בלי השרת שלנו בקוד של הדפדפן');

const used = new Set([...code.join('\n').matchAll(/R\.string\.(br\w+)/g)].map((m) => m[1]));
const he = R('android/app/src/browser/res/values/br.xml'), en = R('android/app/src/browser/res/values-en/br.xml');
const names = (x) => new Set([...x.matchAll(/<string name="(\w+)"/g)].map((m) => m[1]));
const H = names(he), E = names(en);
for (const k of used) ok(H.has(k) && E.has(k), 'מחרוזת בעברית ובאנגלית: ' + k);
ok([...H].every((k) => E.has(k)), 'כל מחרוזת עברית — גם באנגלית');
ok(fs.existsSync(path.join(ROOT, 'android/app/src/browser/res/mipmap-xxxhdpi/br_launcher.png')), 'אייקון משלו');

// 26/10/2026 (בקשת המשתמש: "שהבועה מחוברת לדפדפן שלנו באופן מלא ועובדת ממש כמו הצייד", ואחר כך "צמודה לחלק העליון
// הימני של הנגן ונעלמת כשאין וידאו על המסך — כמו IDM"): בועה בתוך הדפדפן, מחוברת לצייד ולמיקום של הנגן
ok(/fun VideoBubble\(a: BrowserActivity, t: BrTab\)/.test(bub) && /t\.foundN > 0/.test(bub), 'הבועה מופיעה רק כשהצייד מצא משהו');
ok(/val show = canShow\(a, t\) && v != null/.test(bub), '...ורק כשיש נגן על המסך (אחרת נעלמת)');
ok(/val x = \(right - size - m\)/.test(bub) && /val y = maxOf\(top, 0f\) \+ m/.test(bub), 'בפינה העליונה הימנית של הנגן (או בראש החלק הגלוי שלו)');
ok(/WebHost\(a, t\); VideoBubble\(a, t\)/.test(ui) && /a\.customView\?\.let[\s\S]{0,600}FullBubble\(a\)/.test(ui), 'באותו אזור של הדף; במסך מלא — בפינה של המסך');
ok(/fun bubbleTap\(\)[\s\S]{0,200}if \(ps\.size == 1\) download\(ps\[0\]\) else if \(ps\.isNotEmpty\(\)\) pick = true/.test(act)
  && /if \(ps\.size == 1\) a\.download\(ps\[0\]\) else a\.pick = true/.test(ui), 'נגיעה בבועה = ⬇ בשורת הכתובת (אותה בחירה)');
ok(/onLongPress = \{[^}]*a\.pick = true/.test(bub), 'לחיצה ארוכה = כל האפשרויות');
ok(/var bubble: Boolean get\(\) = sp\.getBoolean\("bub", true\)/.test(store) && /pickBubble/.test(ui), 'אפשר לכבות בהגדרות; פועלת כברירת מחדל');
ok(/absoluteOffset/.test(bub) && !/\.offset \{/.test(bub), 'מיקום מוחלט — לא מתהפך בעברית');
const vid = R(B + 'BrVideo.kt');
ok(/if\(window\.top!==window/.test(vid) && /\{ _, msg, _, main, _ -> if \(main\) t\.vid = BrVideo\.parse\(msg\.data\) \}/.test(act), 'המיקום רק מהמסגרת הראשית (גם בסקריפט וגם בדפדפן)');
ok(/addDocumentStartJavaScript\(w, BrVideo\.JS/.test(act) && /t\.vid = null/.test(act), 'הסקריפט בכל דף; דף חדש — בלי מיקום ישן');
ok(/visualViewport/.test(vid) && /iy<40/.test(vid), 'יחסית לאזור הנראה (גם בהגדלה); נגן כמעט מחוץ למסך — לא נחשב');
{ // BrVideo.parse — כמו בקוטלין: ארבעה מספרים סבירים, אחרת "אין נגן"
  const parse = (s) => { const p = String(s ?? '').split(','); if (p.length !== 4) return null; const v = p.map(Number);
    if (v.some((x) => !isFinite(x) || x < -10 || x > 10) || v[2] <= 0 || v[3] <= 0) return null; return v; };
  ok(parse('0.0200,0.3850,0.9000,0.2500') && parse('') === null && parse(null) === null && parse('1,2,0,3') === null && parse('a,b,c,d') === null, 'פענוח המיקום');
  ok(/p\.size != 4/.test(vid) && /v\[2\] <= 0f \|\| v\[3\] <= 0f/.test(vid), 'אותם כללי פענוח בקוטלין'); }
// מהבועה ב־Chrome: הדף נפתח כאן, והרשימה נפתחת לבד כשנמצא משהו — בלי הורדה אוטומטית
ok(/getBooleanExtra\(AppRoute\.EXTRA_HUNT, false\)/.test(act), 'snb_hunt — מהבועה ב־Chrome');
const ap = (act.match(/private fun autoPick\(t: BrTab\) \{[\s\S]*?\n    \}/) || [''])[0];
ok(ap && /pick = true/.test(ap) && !/download|handOff|send\(/.test(ap), 'הציד האוטומטי רק פותח את הרשימה — לא מוריד');
ok(/HUNT_MS = 45_000L/.test(act), 'הציד האוטומטי מוגבל בזמן');
const route = R('android/app/src/grab/java/io/github/yishaiguedj1/snowball/AppRoute.kt');
ok(/const val BROWSER_PKG = "app\.thesnowball\.browser"/.test(route) && /fun toBrowser\([\s\S]{0,300}setPackage\(BROWSER_PKG\)/.test(route), 'AppRoute.toBrowser — רק לחבילה שלנו');
const gs = R('android/app/src/bubble/java/io/github/yishaiguedj1/snowball/GrabService.kt');
ok(/if \(isPage && AppRoute\.toBrowser\(this, url\)\) return/.test(gs), 'הבועה ב־Chrome: דף עם נגן → Studio Browser (ציד מלא)');
ok(/if \(toBr && AppRoute\.toBrowser\(this, url\)\) return/.test(gs) && /getLongPressTimeout/.test(gs), 'לחיצה ארוכה על הבועה ב־Chrome → Studio Browser');
ok(/<package android:name="app\.thesnowball\.browser" \/>/.test(R('android/app/src/bubble/AndroidManifest.xml')), 'Studio Bubble רואה את Studio Browser (queries)');
ok(!/app\.thesnowball\.browser/.test(R('android/app/src/bubble/res/xml/grab_service.xml')) && !/"app\.thesnowball\.browser" to/.test(gs), 'בלי שתי בועות: Studio Bubble לא פועלת בתוך Studio Browser');
// הבועה ב־Chrome: צמודה לנגן שנמצא בעץ הנגישות, וזזה איתו בגלילה
ok(/private fun place\(vn: AccessibilityNodeInfo, key: String\)/.test(gs) && /vn\.getBoundsInScreen\(b\)/.test(gs) && /val x = \(b\.right - box\)/.test(gs), 'Chrome: בפינה העליונה הימנית של הנגן');
ok(/!vn\.isVisibleToUser/.test(gs) && /hide\(keepAnchor = true\)/.test(gs), 'Chrome: הנגן יצא מהמסך — הבועה נעלמת, וחוזרת כשהוא חוזר');
ok(/typeViewScrolled/.test(R('android/app/src/bubble/res/xml/grab_service.xml')) && /h\.postDelayed\(follow, 16\)/.test(gs), 'Chrome: עוקבת אחרי הגלילה');
ok(/FALLBACK_TRIES = 2/.test(gs), 'Chrome: נגן שלא נמצא בעץ בדף של סרטון — בצד, כמו קודם');

// 26/10/2026 (בקשת המשתמש: "לא מצליח להתקין APK שהורדתי דרך מנהל ההורדות"): התקנה, תמיד באישור במסך של המערכת
const da = R('android/app/src/dm/java/io/github/yishaiguedj1/snowball/dm/DmActivity.kt');
for (const f of ['dm', 'browser'])
  ok(/android\.permission\.REQUEST_INSTALL_PACKAGES/.test(R('android/app/src/' + f + '/AndroidManifest.xml')), f + ': מבקש את ההרשאה להתקין');
for (const f of ['main', 'studio', 'invest', 'lite', 'bubble'])
  if (fs.existsSync(path.join(ROOT, 'android/app/src', f, 'AndroidManifest.xml')))
    ok(!/REQUEST_INSTALL_PACKAGES/.test(R('android/app/src/' + f + '/AndroidManifest.xml')), f + ': בלי הרשאת התקנה (רק מנהל ההורדות)');
ok(/if \(cat == DmName\.Cat\.APK && t\.uri\.startsWith\("content:\/\/"\)\) \{ install\(t\); return \}/.test(da), 'APK שירד → התקנה');
ok(/canRequestPackageInstalls\(\)/.test(da) && /ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri\.parse\("package:\$packageName"\)/.test(da), 'בלי אישור — מסך ההגדרה של DM עצמו, וחזרה ממשיכה');
ok(/ACTION_VIEW\)\.setDataAndType\(Uri\.parse\(t\.uri\), DmMedia\.APK\)/.test(da) && !/PackageInstaller|INSTALL_PACKAGES"\)|ACTION_INSTALL_PACKAGE/.test(da), 'מתקין החבילות של המערכת (תמיד באישור) — לא התקנה שקטה');
ok(/if \(DmName\.ext\(name\)\.equals\("apk", true\)\) APK/.test(R('android/app/src/dm/java/io/github/yishaiguedj1/snowball/dm/DmMedia.kt')), 'קובץ .apk = הסוג של חבילה גם כשהשרת שלח octet-stream');

// 26/10/2026 (בקשת המשתמש: "מנהל הסיסמאות של Google באופן מלא + סנכרון של המידע ב־Chrome"):
// סיסמאות = המילוי האוטומטי של אנדרואיד (Google ממלא ושומר) — הדפדפן לא שומר סיסמאות בעצמו לעולם
ok(/importantForAutofill = View\.IMPORTANT_FOR_AUTOFILL_YES/.test(act), 'סיסמאות: המילוי האוטומטי של המערכת פועל בדף');
ok(/autofillServiceComponentName/.test(act) && /Settings\.ACTION_CREDENTIAL_PROVIDER/.test(act) && /passwords\.google\.com/.test(act), 'סיסמאות: מי ממלא, הגדרת Google, והמנהל של Google');
ok(!/password|סיסמ/i.test(store) && !/getUsernamePassword|setHttpAuthUsernamePassword|savePassword/.test(act), 'הדפדפן לא שומר סיסמאות בעצמו');
// Chrome: אין ממשק פתוח לסנכרון — ייבוא מ־Google Takeout / מקובץ סימניות, מזוהה לפי התוכן
ok(/takeout\.google\.com\/settings\/takeout\/custom\/chrome/.test(act) && /OpenDocument\(\)/.test(act), 'ייבוא: Takeout של Chrome + בחירת הקובץ');
ok(/NETSCAPE-Bookmark-file/.test(imp) && /"Browser History"/.test(imp) && /ENTRY_MAX/.test(imp) && /TOTAL_MAX/.test(imp), 'ייבוא: לפי התוכן, עם תקרות גודל');
ok(/startsWith\("http:\/\/"\) && !url\.startsWith\("https:\/\/"\)/.test(imp), 'ייבוא: רק http/https (לא javascript:)');
ok(/fun importAll\(r: BrImport\.Result\)/.test(store) && /have\.add\(it\.url\)/.test(store), 'ייבוא: בלי כפולים');
ok(/testBrowserReleaseUnitTest/.test(R('.github/workflows/android.yml')) && fs.existsSync(path.join(ROOT, 'android/app/src/testBrowser/java/io/github/yishaiguedj1/snowball/br/BrImportTest.kt')), 'בדיקת JVM לייבוא ב־CI');

console.log('studio-browser: ' + n + ' בדיקות עברו');
