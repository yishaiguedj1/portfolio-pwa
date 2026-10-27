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
const pre = R('android/app/src/dm/java/io/github/yishaiguedj1/snowball/dm/DmPre.kt');
const imp = R(B + 'BrImport.kt');
const code = [act, ui, store, imp, R(B + 'BrTab.kt'), R(B + 'BrIcons.kt')];
for (const s of code) ok(!/thesnowball\.app|vercel\.app|workers\.dev|\/api\//.test(s), 'בלי השרת שלנו בקוד של הדפדפן');

const used = new Set([...code.join('\n').matchAll(/R\.string\.(br\w+)/g)].map((m) => m[1]));
const he = R('android/app/src/browser/res/values/br.xml'), en = R('android/app/src/browser/res/values-en/br.xml');
const names = (x) => new Set([...x.matchAll(/<string name="(\w+)"/g)].map((m) => m[1]));
const H = names(he), E = names(en);
for (const k of used) ok(H.has(k) && E.has(k), 'מחרוזת בעברית ובאנגלית: ' + k);
ok([...H].every((k) => E.has(k)), 'כל מחרוזת עברית — גם באנגלית');
ok(fs.existsSync(path.join(ROOT, 'android/app/src/browser/res/mipmap-xxxhdpi/br_launcher.png')), 'אייקון משלו');

// 26/10/2026 (בקשת המשתמש: "לא בועה מרחפת — תמיד צמוד לחלק העליון של הסרטון, ושרשימת האיכויות כבר תופיע כשלוחצים"):
// הבועה של Compose מעל ה־WebView לא הופיעה בטלפון — הכפתור בתוך הדף, והבדיקה של yt-dlp רצה מראש
const vjs = R(B + 'BrVideo.kt');
ok(!fs.existsSync(path.join(ROOT, B + 'BrBubble.kt')) && !/VideoBubble|FullBubble/.test(ui), 'בלי הבועה המרחפת של Compose');
ok(/attachShadow\(\{mode:'closed'\}\)/.test(vjs) && /position:fixed/.test(vjs) && /box\.left\+box\.width\/2/.test(vjs), 'הכפתור בתוך הדף: shadow DOM סגור, באמצע החלק העליון של הנגן');
ok(/if\(!box\|\|N<=0\)/.test(vjs) && /function up\(n,l,m,k\)\{N=\+n\|\|0/.test(vjs), 'מופיע רק כשיש נגן על המסך וגם הדפדפן מצא מה להוריד');
// 26/10/2026: התפריט שנפתח מהכפתור — האיכויות מהבדיקה ברקע, הבחירה עם המפתח של הטאב, ההורדה בלי לצאת מהדף
ok(/Object\.defineProperty\(window,'__snbUp',\{value:up,writable:false,configurable:false\}\)/.test(vjs), 'הדף לא יכול להחליף את __snbUp (ולגנוב את המפתח)');
ok(/if\(!M\)\{ch\.postMessage\('!dl'\);return;\}/.test(vjs), 'בלי תפריט מוכן — הנגיעה פותחת את מנהל ההורדות כמו קודם');
ok(/ch\.postMessage\('!q:'\+K\+':'\+k\)/.test(vjs) && /textContent/.test(vjs) && !/innerHTML/.test(vjs), 'בחירה עם המפתח; טקסט התפריט רק כטקסט');
ok(/BrVideo\.pickOf\(it, dlKey\)/.test(act) && /fun menuPick[\s\S]{0,400}DmPre\.choice\(info, k\) \?: return/.test(act) && /fun mainCands[^\n]*\{\s*if \(t\.private\) return emptyList\(\)/.test(act), 'רק בחירה שהתפריט הציע, לא בטאב פרטי');
// 26/10/2026: הסרטון הראשי = הדף או הזרם, מה שהצליח (ב־Vimeo הדף נכשל והזרם עבד); הרשימה כמו IDM — איכויות, ושאר הקבצים מקופלים
ok(/listOfNotNull\(ps\.firstOrNull \{ it\.page \}, ps\.firstOrNull \{ !it\.page && !it\.file \}\)/.test(act) && /mainCands\(t\)\.forEach \{ p -> DmPre\.start/.test(act), 'הדף והזרם נבדקים במקביל');
ok(/DmPre\.quals\(ctx, m\.info\)/.test(ui) && /brMoreFiles/.test(ui) && /a\.menuPick\(t, q\.k\)/.test(ui), 'רשימת ההורדה: שורה לכל איכות, בחירה מורידה מיד, שאר הקבצים מקופלים');
ok(/if \(ps\.size == 1 && ps\[0\]\.file\) a\.download\(ps\[0\]\)/.test(ui), '⬇ מוריד מיד רק קובץ ישיר יחיד');
ok(/DmPre\.enqueue\(this, p\.url, info, q, audio/.test(act) && /DmPre\.enqueue\(this, v\.url, v\.info/.test(R('android/app/src/dm/java/io/github/yishaiguedj1/snowball/dm/DmActivity.kt')), 'אותה הוספה מהתפריט ומהגיליון');
ok(/document\.fullscreenElement/.test(vjs), 'במסך מלא — בתוך האלמנט שבמסך מלא');
ok(/ch\.postMessage\('!dl'\)/.test(vjs) && /BrVideo\.TAP -> if \(cur === t && screen == Screen\.PAGE\) bubbleTap\(\)/.test(act), 'נגיעה בכפתור = ⬇ בשורת הכתובת');
ok(/ch\.postMessage\('!\?'\)/.test(vjs) && /BrVideo\.HELLO -> pushDl\(t\)/.test(act) && /if \(bubble\) t\.foundN else 0/.test(act), 'מסמך חדש מבקש את המצב; כבוי בהגדרות = בלי כפתור');
ok(/\+\+beat>=3/.test(vjs), 'מיקום הנגן נשלח שוב גם בלי שינוי (דיווח שאבד בטעינת הדף)');
ok(/web && \(t!!\.foundN > 0\) -> IBtn\(BrIcons\.Dl/.test(ui), '⬇ בשורת הכתובת כשיש מה להוריד');
ok(/fun bubbleTap\(\)[\s\S]{0,200}if \(ps\.size == 1 && ps\[0\]\.file\) download\(ps\[0\]\) else if \(ps\.isNotEmpty\(\)\) pick = true/.test(act)
  && /if \(ps\.size == 1 && ps\[0\]\.file\) a\.download\(ps\[0\]\) else a\.pick = true/.test(ui), 'הכפתור = ⬇ בשורת הכתובת (אותה בחירה)');
ok(/var bubble: Boolean get\(\) = sp\.getBoolean\("bub", true\)/.test(store) && /pickBubble/.test(ui) && /prefs\.bubble = b; cur\?\.let \{ pushDl\(it\) \}/.test(act), 'אפשר לכבות בהגדרות; פועל כברירת מחדל');
// האיכויות מוכנות מראש
ok(/LaunchedEffect\(t\.id, t\.foundN, a\.bubble, t\.web, t\.url\) \{\s*a\.pushDl\(t\)\s*if \(t\.foundN > 0\) \{\s*delay\(1500\); a\.prefetch\(t\); a\.pushDl\(t\)/.test(ui) && /if \(m != last\) \{ last = m; a\.pushDl\(t\) \}/.test(ui), 'הסרטון שעל המסך נבדק ברקע, והתפריט עובר לדף כשהבדיקה מסתיימת');
ok(/if \(t\.private \|\| cur !== t \|\| t\.foundN == 0\) return/.test(act) && /ps\.firstOrNull \{ !it\.page && !it\.file \}/.test(act), 'רק הטאב שעל המסך, לא פרטי, ורק מה שנבדק ב־yt-dlp');
ok(/DmPre\.await\(url\)\?\.let \{ return Found\.Video/.test(R('android/app/src/dm/java/io/github/yishaiguedj1/snowball/dm/DmActivity.kt')), 'מנהל ההורדות לוקח את התוצאה המוכנה');
ok(/if \(url in busy \|\| fresh\(done\[url\], now\)\) return/.test(pre) && /while \(url in busy\)/.test(pre) && /JSONObject\(e\.info\.toString\(\)\)/.test(pre), 'בדיקה אחת לכל כתובת, מחכים לבדיקה שרצה, ועותק לכל מי שמבקש');
ok(!/https?:\/\//.test(pre.replace(/^\s*(\/\/|\*).*$/mg, '')), 'הבדיקה מראש לא פונה לשום שרת שלנו');
const vid = R(B + 'BrVideo.kt');
ok(/if\(window\.top!==window/.test(vid) && /\{ _, msg, _, main, _ ->\s*if \(main\) when/.test(act) && /else if \(d\?\.startsWith\(BrVideo\.PICK\) != true\) t\.vid = BrVideo\.parse\(d\)/.test(act), 'המיקום רק מהמסגרת הראשית (גם בסקריפט וגם בדפדפן)');
ok(/addDocumentStartJavaScript\(w, BrVideo\.JS/.test(act) && /t\.vid = null/.test(act), 'הסקריפט בכל דף; דף חדש — בלי מיקום ישן');
ok(/visualViewport/.test(vid) && /iy<40/.test(vid), 'יחסית לאזור הנראה (גם בהגדלה); נגן כמעט מחוץ למסך — לא נחשב');
{ // BrVideo.pickOf — רק עם המפתח הנכון, ובחירה קצרה של אותיות וספרות
  const pickOf = (d, key) => { if (!d.startsWith('!q:') || !key) return null; const r = d.slice(3), i = r.indexOf(':'); if (i <= 0 || r.slice(0, i) !== key) return null; const v = r.slice(i + 1); return v.length >= 1 && v.length <= 8 && /^[\p{L}\p{N}]+$/u.test(v) ? v : null; };
  ok(pickOf('!q:k1:1080', 'k1') === '1080' && pickOf('!q:k1:t720', 'k1') === 't720' && pickOf('!q:k1:a', 'k1') === 'a', 'בחירה תקינה');
  ok(pickOf('!q:xx:1080', 'k1') === null && pickOf('!q::1080', 'k1') === null && pickOf('!q:k1:1080', '') === null && pickOf('!q:k1:a b', 'k1') === null, 'מפתח לא נכון / בחירה מוזרה — כלום');
  ok(/fun pickOf[\s\S]{0,400}r\.substring\(0, i\) != key[\s\S]{0,200}isLetterOrDigit/.test(vid), 'אותה בדיקה בקוטלין');
}
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
ok(/importantForAutofill = if \(t\.private\) View\.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS else View\.IMPORTANT_FOR_AUTOFILL_YES/.test(act), 'סיסמאות: המילוי האוטומטי של המערכת פועל בדף (בטאב פרטי — לא)');
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

// 27/10/2026 (בקשת המשתמש: "אחד לאחד כמו Chrome באנדרואיד" — המבנה; הצבעים והזכוכית של Apple, האדום של כפתור ההורדה)
ok(/private fun TopBar\(/.test(ui) && !/private fun Toolbar\(a: BrowserActivity\)/.test(ui) && /BrIcons\.CNewTab/.test(ui) && /private fun TabsBtn\(/.test(ui),
  'הסרגל של Chrome לאנדרואיד למעלה: דף הבית · הכתובת · כרטיסייה חדשה · כרטיסיות · ⋮ — בלי סרגל תחתון של אייפון');
ok(/private fun MenuSheet\(a: BrowserActivity\)/.test(ui) && /Dialog\(/.test(ui) && /PixelCopy\.request/.test(ui) && /boxBlur\(bmp/.test(ui) && !/setBackgroundBlurRadius/.test(ui) && /private fun RowScope\.MBtn\(/.test(ui) && !/private fun Dest\(/.test(ui),
  'התפריט ⋮ = החלון של Chrome מהפינה (שורת כפתורים ופריטים), זכוכית עם טשטוש');
ok(/private val Red = Color\(0xFFFF4656\)/.test(ui) && /Color\(0x4A3C3C43\), Red,/.test(ui) && !/0xFF1A73E8\)\)/.test(ui.replace(/FavPal[^\n]*/, '')),
  'צבע הפעולה = האדום של כפתור ההורדה, לא הכחול של Google');
ok(/private fun Modifier\.glass\(/.test(ui) && /private fun Modifier\.ambient\(/.test(ui), 'זכוכית ורקע רך (iOS 27)');
ok(/val GoogleLogo/.test(R(B + 'BrIcons.kt')) && /val CNewTab = cr\("ic_add_box_rounded_corner"/.test(R(B + 'BrIcons.kt')) && fs.existsSync(path.join(ROOT, 'android/app/src/browser/CHROMIUM_LICENSE.txt')),
  'האייקונים של Chrome עצמו, עם הרישיון של Chromium');
ok(/fun goBack\(\) \{[\s\S]*?t\.web\?\.canGoBack\(\) == true -> t\.web\?\.goBack\(\)\s*t\.ntpBack && !t\.isNtp -> [\s\S]*?t\.fromApp -> \{ close\(t\); moveTaskToBack\(true\) \}[\s\S]*?t\.parent >= 0[\s\S]*?else -> moveTaskToBack\(true\)/.test(act)
  && /nt\.parent = t\.id/.test(act) && /if \(t\.isNtp\) \{ t\.ntpBack = true/.test(act),
  '"חזור" כמו ב־Chrome: הדף הקודם → הכרטיסייה החדשה → הכרטיסייה שפתחה את הקישור → האפליקציה שפתחה → רקע');
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

// 26/10/2026: ביוטיוב — הרשימה מהנגן שבדף מיד (YtPage), גם במעבר לסרטון הבא בלי טעינת דף; המנוע מתחמם מההתחלה
{
  const yt = R('android/app/src/ytdl/java/io/github/yishaiguedj1/snowball/YtPage.kt');
  const pre = R('android/app/src/dm/java/io/github/yishaiguedj1/snowball/dm/DmPre.kt');
  const eng = R('android/app/src/ytdl/java/io/github/yishaiguedj1/snowball/DlEngine.kt');
  ok(/a\.ytSeed\(t\)/.test(ui) && /fun prefetch\(t: BrTab\) \{[^}]*ytSeed\(t\)/.test(act) && /YtPage\.toInfo\(raw, page\)/.test(act) && /DmPre\.seed\(page, info\)/.test(act), 'ביוטיוב: הרשימה מהנגן שבדף בלי לחכות ל־yt-dlp');
  ok(/if \(t\.private \|\| cur !== t\) return/.test(act.slice(act.indexOf('fun ytSeed'))), 'לא בטאב פרטי ורק בטאב שעל המסך');
  ok(!/url|signatureCipher/.test(yt.slice(yt.indexOf('const val JS'), yt.indexOf('"""', yt.indexOf('const val JS') + 20))), 'מהנגן רק מספרים וקודים — לא כתובות של קבצים');
  ok(/id != want/.test(yt), 'נגן שעוד מחזיק את הסרטון הקודם — לא נלקח');
  ok(/fun seed\(/.test(pre) && /seededInfo\(url, System\.currentTimeMillis\(\)\)\?\.let \{ return/.test(pre), 'מידע מהנגן לא מחכה לבדיקה המלאה');
  ok(/DlEngine\.prepare\(applicationContext\)/.test(act), 'המנוע מתחמם כשהדפדפן נפתח');
  ok(!/"--print"/.test(eng) && /"--newline"/.test(eng) && /DlProbe\.outFile\(dir\)/.test(eng), 'בלי ‎--print‎ (משתיק את ההתקדמות) — שורה לכל עדכון');
}

// 27/10/2026: סנכרון וגיבוי בחשבון Google בין כל המכשירים (BrCloud) — בלי השרת שלנו, קובץ לכל מכשיר, המשך מאותה נקודה
{
  const cl = R(B + 'BrCloud.kt');
  const core = R(B + 'BrCloudCore.kt');
  const cjs = R(B + 'BrCloudJs.kt');
  const chr = R(B + 'BrChrome.kt');
  const urls = (cl.match(/https:\/\/[a-z0-9.\-]+/g) || []);
  ok(urls.every(u => /^https:\/\/(www|identitytoolkit|securetoken)\.googleapis\.com$/.test(u)), 'הנתונים רק ב־Google Drive (והחשבון ב־Firebase) — לא בשרת שלנו: ' + urls.join(' '));
  ok(/"op", "brKey"/.test(cl) && /for \(u in DmSync\.API\)/.test(cl) && !/"op", "(?!brKey)/.test(cl), 'השרת שלנו נותן רק את המפתח (brKey) — לא רואה את הנתונים');
  ok(/put\(t, "\$\{PREFIX\}\$dev-d", sealFile\(/.test(cl) && /put\(t, "\$\{PREFIX\}\$dev-h", sealFile\(/.test(cl) && /put\(t, "\$\{PREFIX\}\$dev-s", sealFile\(/.test(cl), 'כל קובץ עולה מוצפן (AES-256-GCM, AAD = שם הקובץ)');
  ok(/AndroidKeyStore/.test(cl) && /putString\("kw", wrap\(k\)\)/.test(cl), 'המפתח בטלפון עטוף ב־Android Keystore');
  ok(/openFile\(n, raw\)\?\.let/.test(cl), 'קובץ שלא נפתח — מתעלמים, לא "נמחק"');
  ok(/const val SCOPE = "https:\/\/www\.googleapis\.com\/auth\/drive\.appdata"/.test(cl) && !/auth\/drive"/.test(cl) && !/drive\.file/.test(cl), 'הרשאה drive.appdata בלבד — התיקייה הפרטית של האפליקציה');
  ok(/spaces=appDataFolder/.test(cl) && /parents", JSONArray\(\)\.put\("appDataFolder"\)/.test(cl), 'הקבצים רק ב־appDataFolder');
  ok(/private fun mine\(n: String\) = n\.startsWith\("\$PREFIX\$dev-"\)/.test(cl) && /if \(!mine\(n\)\) downs \+= /.test(cl), 'כל מכשיר כותב רק את הקבצים שלו (ל־Drive v3 אין כתיבה מותנית)');
  ok(/WEB_CLIENT = "286578855160-a5kii0glss9b883glkr698frmvekpa67\.apps\.googleusercontent\.com"/.test(cl) && cl.includes(R('android/app/src/dm/java/io/github/yishaiguedj1/snowball/dm/DmSync.kt').match(/WEB_CLIENT = "[^"]+"/)[0]), 'אותו לקוח Web של DM (לקוח Android = Developer console is not set up)');
  ok(/getStringExtra\("snb_cloud"\)\?\.let \{ k -> BrCloud\.pendingOpen\.remove\(k\)/.test(act) && /val pendingOpen = HashMap<String, STab>\(\)/.test(cl), 'כרטיסייה מהתראה — רק מה שנשמר בתוך התהליך, לא extras מבחוץ');
  ok(/android:name="\.br\.BrCloudJob"[\s\S]{0,120}BIND_JOB_SERVICE/.test(man) && /class BrCloudJob : JobService/.test(cl), 'סבב ברקע כל 15 דק׳ (JobScheduler)');
  ok(/if \(prov == null && tTabs && ids\["\$\{PREFIX\}\$dev-s"\] != null\) null/.test(cl), 'ברקע לא מעלים "אין כרטיסיות" במקום הרשימה של המכשיר');
  ok(/BrCloud\.chromeOwner\(\)/.test(chr) && /BrCloud\.claimChrome\(\)/.test(chr), 'הגשר ל־Chrome (ops.json אחד) — רק מכשיר אחד בחשבון');
  ok(/fun takeHistDeleted\(\)/.test(store) && /histDel \+= BrSync\.visitKey/.test(store) && /k !in del/.test(cl), 'ביקור שיצא בגלל התקרה ≠ מחיקה — רק מה שמחקת נמחק בכל המכשירים');
  ok(/if \(BrStore\.rev != snapRev\)/.test(cl), 'הסימניות/ההיסטוריה מחושבות מחדש רק כשהשתנו');
  ok(/String\.format\(java\.util\.Locale\.ROOT/.test(core) && !/^import (android|org\.json)/m.test(core), 'הליבה טהורה (נבדקת ב־JVM), והשעון לא תלוי בשפת המכשיר');
  ok(/textContent\|\|''\)\.length<4000/.test(cjs) && /fun withTime\(/.test(cjs) && /createTreeWalker/.test(cjs), 'המקום בדף: המשפט שבראש המסך + החלק היחסי + הזמן בסרטון, בלי לקרוא דף ענק');
  ok(/Screen\.CLOUD -> CloudScreen\(a\)/.test(ui) && /Screen\.RECENT -> RecentScreen\(a\)/.test(ui) && /MItem\(R\.string\.brRecentTabs, BrIcons\.CDevices\)/.test(ui) && /ResumeCard\(a\)/.test(ui) && /SendSheet\(a\)/.test(ui), 'המסכים: סנכרון, כרטיסיות אחרונות, "המשך מ־", שליחה למכשירים');
}

// 27/10/2026: יעילות ואבטחה של הדפדפן (מחקר: מהירות, זיכרון, אבטחה)
{
  const dmb = R('android/app/src/dm/java/io/github/yishaiguedj1/snowball/dm/DmBrowser.kt');
  const tab = R(B + 'BrTab.kt');
  ok(/override fun onRenderProcessGone\(view: WebView, detail: android\.webkit\.RenderProcessGoneDetail\): Boolean \{ renderGone\(\); return true \}/.test(act), 'ה־renderer מת — הדפדפן לא נופל (בלי זה WebView מפיל את כל האפליקציה)');
  ok(/RENDERER_PRIORITY_BOUND, true/.test(act), 'עדיפות ה־renderer יורדת כשלא מוצג');
  ok(/private val liveMax: Int by lazy/.test(act) && /isLowRamDevice \|\| gb <= 4\.5 -> 2/.test(act) && /override fun onTrimMemory/.test(act), 'מספר הטאבים החיים לפי הזיכרון, ושחרור כשהמערכת מבקשת');
  ok(/pauseTimers\(\)/.test(act) && /resumeTimers\(\)/.test(act), 'JavaScript נעצר כשהדפדפן ברקע');
  ok(/private fun kill\(w: WebView\?\)/.test(act) && !/\.web\?\.destroy\(\)/.test(act), 'WebView נהרס בסדר הנכון (מהעץ, עצירה, destroy)');
  ok(/PixelCopy\.request\(window/.test(act), 'תמונת הטאב — העתקה מהמסך, לא ציור מחדש בתהליכון הראשי');
  ok(/t\.blkQ\.getAndIncrement\(\) == 0/.test(act) && /val blkQ = /.test(tab), 'מונה החסימות לא מצייר על כל בקשה');
  ok(/postDelayed\(\{ Thread \{ runCatching \{ DlEngine\.prepare/.test(act), 'מנוע ההורדות מתחמם אחרי שהמסך עלה');
  ok(/i\.flags = 0/.test(act) && /i\.clipData = null/.test(act) && /if \(i\.`package` == packageName\) return/.test(act) && /sch == "content"/.test(act), 'intent: מדף — בלי דגלים/הרשאות, לא אלינו, לא file/content');
  ok(/siteOf\(u\.host\) == refSite/.test(dmb) && /!priv && /.test(dmb) && /localHost\(u\.host\)\) return false/.test(dmb), 'בדיקת הקובץ: עוגיות רק לאותו אתר, לא מטאב פרטי, לא לרשת המקומית');
  ok(/android:dataExtractionRules="@xml\/br_extract"/.test(man) && /EnableSafeBrowsing" android:value="true"/.test(man), 'בלי העברה של הנתונים לטלפון אחר, Safe Browsing במפורש');
  ok(/setAcceptThirdPartyCookies\(w, !t\.private\)/.test(act), 'טאב פרטי: בלי עוגיות צד שלישי');
  ok(/putString\("rt", wrap\(/.test(R(B + 'BrCloud.kt')), 'אסימון החשבון עטוף ב־Keystore');
  ok(/fun engineOld\(\)/.test(act) && /market:\/\/details\?id=\$pkg/.test(act), 'מנוע הדפדפן לא מעודכן — התראה ועדכון מ־Play');
}

// 27/10/2026: כמה משתמשים בדפדפן (כמו פרופילים ב־Chrome) — לכל אחד אחסון, עוגיות וסנכרון משלו
{
  const us = R(B + 'BrUsers.kt'), rs = R(B + 'BrRestart.kt'), cl = R(B + 'BrCloud.kt'), ch = R(B + 'BrChrome.kt'), pics = R(B + 'BrPics.kt');
  const dmb = R('android/app/src/dm/java/io/github/yishaiguedj1/snowball/dm/DmBrowser.kt');
  ok(/dir = BrUsers\.dir\(ctx\)/.test(store) && /BrUsers\.prefs\(ctx, "br"\)/.test(store), 'הסימניות, ההיסטוריה, הכרטיסיות וההגדרות — לכל משתמש');
  ok(/BrUsers\.prefs\(app, "br_cloud"\)/.test(cl) && /File\(BrUsers\.dir\(app\), "cloud"\)/.test(cl) && (cl.match(/BrUsers\.keyAlias\(BrUsers\.cur\(app\)\)/g) || []).length === 2, 'הסנכרון בענן ומפתח העטיפה — לכל משתמש');
  ok(/BrUsers\.prefs\(ctx, "br_chrome"\)/.test(ch) && /BrUsers\.cacheDir\(ctx\)/.test(pics), 'הגשר ל־Chrome והתמונות — לכל משתמש');
  ok(/fun relDir\(id: String\) = if \(id == MAIN\) "br" else "br\/u\/\$id"/.test(us) && /fun keyAlias\(id: String\) = if \(id == MAIN\) "snb_br_sync"/.test(us), 'המשתמש הראשי נשאר במקום הישן — בלי העברה');
  ok(/fun validId\(id: String\)/.test(us) && /it in 'a'\.\.'z' \|\| it in '0'\.\.'9'/.test(us), 'מזהה משתמש = אותיות וספרות (נכנס לנתיב ולשם פרופיל)');
  ok(/else userProfile\(\)\?\.let \{ p -> runCatching \{ WebViewCompat\.setProfile\(w, p\.name\) \} \}/.test(act), 'כל WebView רגיל — בפרופיל של המשתמש (עוגיות נפרדות)');
  ok(/DmCookies\.cm = it\.cookieManager/.test(act) && (dmb.match(/DmCookies\.get\(\)/g) || []).length === 2 && !/CookieManager\.getInstance\(\)\.getCookie/.test(dmb), 'מה שעובר להורדה — העוגיות של המשתמש הפעיל');
  ok(/android:name="\.br\.BrRestart"[\s\S]{0,80}android:process=":br_restart"[\s\S]{0,40}android:exported="false"/.test(man) && /Process\.killProcess\(pid\)/.test(rs), 'מעבר משתמש = התחלה מחדש מתהליך נפרד, לא מיוצא');
  ok(/fun googleWeb\(auto: Boolean\)/.test(act) && /accounts\.google\.com\/AccountChooser\?Email=/.test(act) && /is BrCloud\.SignIn\.Ok -> googleWeb\(true\)/.test(act), 'כניסה לסנכרון = גם לאתרים של Google, אם עוד לא מחובר');
  ok(/BrowserActivity\.Screen\.USERS -> UsersScreen\(a\)/.test(ui) && /a\.switchUser\(u\.id\)/.test(ui) && /a\.addUser\(\)/.test(ui), 'מסך המשתמשים: מעבר, הוספה, הסרה');
  ok(/backdrop\(a\.window\) \{ back = it\.asImageBitmap\(\); ready = true \}/.test(ui) && /Color\(0xF7FFFFFF\)/.test(ui), 'ההצעות בשורת הכתובת — על חומר מטושטש ואטום, לא על הדף');
}

console.log('studio-browser: ' + n + ' בדיקות עברו');
