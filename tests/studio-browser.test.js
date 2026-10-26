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
ok(/app-browser-release\.apk the-snowball-browser\.apk/.test(yml) && /the-snowball-browser\.apk( studio-browser-chrome\.zip)? --clobber/.test(yml), 'APK בקישור הקבוע');

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
const sync = R(B + 'BrSync.kt');
ok(/fun importAll\(r: BrImport\.Result\)/.test(store) && /BrSync\.planMarks\(marks, r\.marks, gone/.test(store) && /BrSync\.planVisits/.test(store), 'ייבוא: רק מה שחדש, דרך BrSync');
ok(/fun key\(url: String\)/.test(sync) && /utm_/.test(sync) && /removePrefix\("www\."\)/.test(sync), 'זהות סימנייה: מתעלמת מ־www, ‏utm ו־"/" בסוף');
ok(/k in gone -> dead\+\+/.test(sync) && /gone\.json/.test(store) && /private fun forget\(m: BrMark\)/.test(store), 'סימנייה שנמחקה כאן לא חוזרת בייבוא');
ok(/!it\.imp && \(all \|\| it\.x == 0L\)/.test(sync) && /BrStore\.markExported\(list\)/.test(R(B + 'BrowserActivity.kt')), 'ייצוא: רק מה ש־Chrome עוד לא קיבל, ומסומן אחרי שנשמר');
ok(/distinctBy \{ BrSync\.key\(it\.url\) \}/.test(imp), 'בתוך קובץ אחד — בלי כפולים לפי המפתח');
ok(fs.existsSync(path.join(ROOT, 'android/app/src/testBrowser/java/io/github/yishaiguedj1/snowball/br/BrSyncTest.kt')), 'בדיקת JVM לכפילויות');
const chr = R(B + 'BrChrome.kt');
ok(/drive\.appdata/.test(chr) && /appDataFolder/.test(chr) && !/thesnowball\.app|vercel/i.test(chr), 'סנכרון עם Chrome: רק appDataFolder ב־Drive של המשתמש, לא השרת שלנו');
ok(/write\(t, "ops\.json"/.test(chr) && !/write\(t, "state\.json"/.test(chr), 'הטלפון כותב רק ops.json — state.json רק התוסף');
ok(/BrSync\.applyState\(/.test(chr) && /fun applyState\(/.test(sync), 'הסימניות אחרי סנכרון — דרך applyState (נבדק ב־JVM)');
ok(/Screen\.CHROME -> ChromeScreen\(a\)/.test(R(B + 'BrUi.kt')) && /Screen\.IMPORT, Screen\.CHROME[,)]/.test(R(B + 'BrowserActivity.kt')), 'מסך "סנכרון עם Chrome" בהגדרות');
ok(/studio-browser-chrome\.zip/.test(chr), 'הקישור לתוסף');
ok(/testBrowserReleaseUnitTest/.test(R('.github/workflows/android.yml')) && fs.existsSync(path.join(ROOT, 'android/app/src/testBrowser/java/io/github/yishaiguedj1/snowball/br/BrImportTest.kt')), 'בדיקת JVM לייבוא ב־CI');

// 26/10/2026 (בקשת המשתמש: "יותר זהה ל־Chrome במראה, יותר Apple בעיצוב", לפי התצוגה המקדימה שאושרה)
ok(/tint = Color\(0xFF1A73E8\)|Color\(0xFF1A73E8\), Color\(0xFFC7C7CC\)/.test(ui) && /private fun Toolbar\(a: BrowserActivity\)/.test(ui), 'הכחול של Chrome לפעולות, וסרגל כלים למטה כמו ב־Chrome לאייפון');
ok(/private fun MenuSheet\(a: BrowserActivity\)/.test(ui) && /ModalBottomSheet/.test(ui) && /private fun Dest\(/.test(ui), 'התפריט ⋯ = גיליון עם שורת יעדים');
ok(/val Grid = BrC\(/.test(ui) && /BrowserActivity\.Screen\.SWITCHER -> Grid/.test(ui), 'מסך הטאבים תמיד כהה');
for (const s of ['ENGINE', 'PASSWORDS', 'PRIVACY', 'BARPOS', 'IMPORT'])
  ok(new RegExp('Screen\\.' + s + ' -> ').test(ui) && new RegExp('Screen\\.' + s).test(act), 'עמוד הגדרות: ' + s);
ok(/screen in settingsSubs -> screen = Screen\.SETTINGS/.test(act), '"חזור" מעמוד משנה של ההגדרות חוזר להגדרות');
// הצעות חיפוש: רק כשהמתג פועל, בלי עוגיות, בלי הפניות; הקישור שהעתקת — בלי לקרוא את הלוח עד הנגיעה
ok(/if \(!suggestOn \|\|/.test(act) && /instanceFollowRedirects = false/.test(act) && /setRequestProperty\("Cookie", ""\)/.test(act), 'הצעות חיפוש: רק עם המתג, בלי עוגיות');
ok(/primaryClipDescription/.test(act) && /getConfidenceScore\(TextClassifier\.TYPE_URL\)/.test(act), 'הקישור שהעתקת: לפי הסיווג של המערכת, בלי לקרוא את הלוח');
ok(/fun pasteGo\(\)/.test(act) && !/fun clipHasUrl\(\)[\s\S]{0,400}primaryClip\?\./.test(act), 'הלוח נקרא רק בנגיעה');
// סנכרון עם Chrome: סיסמאות — דרך Google; סימניות — ייבוא וייצוא בקובץ (Chrome Sync סגור)
ok(/fun exportHtml\(list: List<BrMark>, folder: String\)/.test(sync) && /NETSCAPE-Bookmark-file-1/.test(sync) && /replace\("<", "&lt;"\)/.test(sync), 'ייצוא סימניות בפורמט של הדפדפנים, עם בריחה');
ok(/CreateDocument\("text\/html"\)/.test(act), 'הייצוא נשמר במקום שבוחרים');
ok(/private fun PasswordsScreen/.test(ui) && /fillSettings\(\)/.test(ui) && /openPasswords\(\)/.test(ui), 'מנהל הסיסמאות: Google ממלא, והרשימה אצל Google');
ok(/fun clearSite\(t: BrTab\)/.test(act) && /deleteOrigin/.test(act), 'מחיקת הנתונים של אתר אחד (גם בפרופיל הפרטי)');

// 26/10/2026 — שלב 3: פרטיות ווידאו
const sh = R(B + 'BrShield.kt'), med = R(B + 'BrMedia.kt');
const adsList = sh.split('val ADS')[1].split('.split(Regex')[0];
ok(/if \(!req\.isForMainFrame && blockReq\(t, req\.url\.host\)\) return EMPTY\(\)/.test(act), 'חסימה: אף פעם לא הדף הראשי של טאב');
ok(/site\(h\) == site\(pageHost\)/.test(sh) && !/googletagmanager\.com/.test(adsList) && !/connect\.facebook\.net/.test(adsList), 'חסימה: רק צד שלישי, בלי googletagmanager ו־connect.facebook.net');
ok(!/youtube|googlevideo|ytimg/.test(adsList), 'חסימה: שום שרת של יוטיוב');
ok(/fun shieldOn\(host: String\) = shield && rules\[/.test(act) && /fun toggleSiteShield\(t: BrTab\)/.test(act), 'הגנה לכל אתר — אפשר לכבות באתר שנשבר');
ok(/onetrust-reject-all-handler/.test(sh) && !/accept-all|AcceptAll|accept_all/i.test(sh.split('COOKIE_JS')[1].split('PLAY_JS')[0]), 'הודעות עוגיות: דחייה, אף פעם לא הסכמה');
ok(/if \(known == -1\) \{ then\(false\); return \}/.test(act) && /val known = if \(private \|\| r == null\) 0/.test(act), 'הרשאות לאתר נזכרות — לא בטאב פרטי');
ok(/fun encode\(rules: Collection<SiteRule>\)/.test(sh) && !/org\.json/.test(sh), 'הגדרות אתרים בלי JSON (נבדק ב־JVM)');
ok(/<service\s+android:name="\.br\.BrMediaService"\s+android:exported="false"\s+android:foregroundServiceType="mediaPlayback"/.test(man) && /FOREGROUND_SERVICE_MEDIA_PLAYBACK/.test(man), 'ניגון ברקע: שירות mediaPlayback לא מיוצא');
ok(/android:supportsPictureInPicture="true"/.test(man) && /setAutoEnterEnabled/.test(act), 'תמונה בתוך תמונה');
ok(/MediaSession\(/.test(med) && /setDeleteIntent/.test(med) && !/https?:\/\//.test(med), 'ההתראה: MediaSession של המערכת, בלי רשת');
ok(/isInPictureInPictureMode -> \{\}/.test(act) && /bgPlay && t != null && t\.playing/.test(act) && /BrMedia\.stop\(this\)/.test(act), 'הדף לא מושהה רק כשמשהו מתנגן ובחרת ניגון ברקע; חזרה — השירות נעצר');
ok(/USE_BIOMETRIC/.test(man) && /BIOMETRIC_WEAK or BiometricManager\.Authenticators\.DEVICE_CREDENTIAL/.test(act) && /isDeviceSecure/.test(act), 'נעילת הטאבים הפרטיים: טביעת אצבע או קוד המסך');
ok(/FLAG_SECURE/.test(act) && /LaunchedEffect\(a\.screen, a\.cur\?\.private, a\.swPrivate, a\.privLocked\) \{ a\.applySecure\(\) \}/.test(ui), 'טאב פרטי — בלי צילומי מסך');
ok(/if \(!t\.private\) BrPics\.saveThumb/.test(act) && /if \(!t\.private\) BrPics\.saveIcon/.test(act) && /BrPics\.clear\(\)/.test(act), 'תמונות וסמלים נשמרים רק לטאבים רגילים, ונמחקים עם הנתונים');
ok(/createWithAdaptiveBitmap\(BrPics\.shortcutIcon/.test(act), 'קיצור דרך במסך הבית: סמל אדפטיבי בגודל אפליקציה');
for (const sc of ['SITES', 'SITE', 'VIDEO']) ok(new RegExp('Screen\\.' + sc + ' -> ').test(ui), 'מסך: ' + sc);
const he3 = R('android/app/src/browser/res/values/br.xml'), en3 = R('android/app/src/browser/res/values-en/br.xml');
for (const k of ['brShield', 'brCookies', 'brLockPriv', 'brSites', 'brSpeed', 'brBgPlay', 'brPip', 'brChMedia', 'brUnlock'])
  ok(he3.includes(`name="${k}"`) && en3.includes(`name="${k}"`), 'מחרוזת בשתי השפות: ' + k);
ok(fs.existsSync(path.join(ROOT, 'android/app/src/testBrowser/java/io/github/yishaiguedj1/snowball/br/BrShieldTest.kt')), 'בדיקת JVM לחסימה ולהגדרות האתרים');

console.log('studio-browser: ' + n + ' בדיקות עברו');
