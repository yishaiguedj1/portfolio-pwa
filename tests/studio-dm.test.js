// Studio DM (23/10/2026, בקשת המשתמש): מנהל הורדות נייטיב לאנדרואיד — הכל בטלפון, בלי השרת שלנו.
// השומר: (0א) אין בקוד של DM פנייה לשרתים שלנו; אין שירות נגישות; כל מחרוזת בעברית ובאנגלית;
// הכללים של המנוע מהמחקר (Range/If-Range, בלי דחיסה, UIDT, onTimeout, IS_PENDING); הבנייה והפרסום ב־android.yml.
// הבדיקה האמיתית של המנוע — JVM מול שרת שמנתק באמצע (android/app/src/testDm, ‏testDmReleaseUnitTest ב־android.yml).
const fs = require('fs');
const path = require('path');
const assert = require('assert');
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const ROOT = path.join(__dirname, '..');
const R = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const ls = (d) => fs.existsSync(path.join(ROOT, d)) ? fs.readdirSync(path.join(ROOT, d), { recursive: true }).filter((f) => f.endsWith('.kt')).map((f) => path.join(d, f)) : [];

const gradle = R('android/app/build.gradle.kts');
ok(/app\("dm", "app\.thesnowball\.studiodm", "Studio DM"/.test(gradle), 'flavor dm עם המזהה app.thesnowball.studiodm');
ok(/getByName\("dm"\)\.java\.srcDirs\([^)]*"src\/dmcore\/java"[^)]*"src\/ytdl\/java"/.test(gradle), 'dm = הליבה + מנוע yt-dlp המשותף');
ok(/getByName\("studio"\)\.java\.srcDirs\([^)]*"src\/ytdl\/java"/.test(gradle), 'Studio עדיין עם מנוע yt-dlp (src/ytdl)');
ok(!/material-icons-extended/.test(gradle), 'בלי material-icons-extended (‎+30MB) — DmIcons');

const yml = R('.github/workflows/android.yml');
ok(/testDmReleaseUnitTest/.test(yml), 'בדיקות הליבה רצות ב־CI');
ok(/app-dm-release\.apk the-snowball-studio-dm\.apk/.test(yml) && /the-snowball-studio-dm\.apk[^\n]*--clobber/.test(yml), 'APK רביעי בקישור הקבוע');

const man = R('android/app/src/dm/AndroidManifest.xml');
ok(/android:name="\.MainActivity" tools:node="remove"/.test(man) && /DelegationService" tools:node="remove"/.test(man), 'לא TWA: MainActivity והשירות של TWA יוצאים');
ok(!/BIND_ACCESSIBILITY_SERVICE|accessibilityservice/i.test(man), 'אף פעם לא שירות נגישות (Play Protect)');
ok(/android:foregroundServiceType="dataSync"/.test(man) && /RUN_USER_INITIATED_JOBS/.test(man), 'UIDT + שירות בחזית');

// 0א — ניתוק מהשרת: שום כתובת שלנו בקוד של DM (גם לא במנוע המשותף)
const code = [...ls('android/app/src/dm/java'), ...ls('android/app/src/dmcore/java'), ...ls('android/app/src/ytdl/java')];
ok(code.length >= 8, 'קבצי הקוד נמצאו');
// 24/10/2026: החריג היחיד — DmSync.kt (מאגר הנתונים, בקשת המשתמש): רק יומן ההורדות, רק אחרי כניסה עם Google והסכמה
for (const f of code) {
  const s = R(f);
  if (path.basename(f) === 'DmSync.kt') continue;
  ok(!/thesnowball\.app|vercel\.app|workers\.dev|\/api\/|snbstudio:\/\/|launchUrl/.test(s), 'בלי שרת/אתר שלנו: ' + path.basename(f));
}
{
  const sync = R('android/app/src/dm/java/io/github/yishaiguedj1/snowball/dm/DmSync.kt');
  const urls = (sync.match(/https:\/\/[^"\s]+/g) || []).sort();
  ok(JSON.stringify(urls) === JSON.stringify(['https://api.thesnowball.app/api/studio', 'https://ibkr-proxy-wine.vercel.app/api/studio',
    'https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=$FB_KEY', 'https://securetoken.googleapis.com/v1/token?key=$FB_KEY'].sort()),
    'DmSync: רק השרתון (ראשי + גיבוי) והכניסה של Google — שום כתובת אחרת');
  ok((sync.match(/put\("op", "(\w+)"\)/g) || []).map((x) => x.match(/"(\w+)"\)$/)[1]).sort().join() === 'dmForget,dmLog', 'DmSync: רק dmLog ו־dmForget');
  ok(/fun on\(ctx: Context\) = enabled\(ctx\) && signedIn\(ctx\)/.test(sync) && /if \(!on\(app\)\) return/.test(sync) && /if \(!on\(ctx\)\) return/.test(sync), 'DmSync: שולחים רק כשהשליחה דלוקה ומחוברים עם Google');
  // 24/10/2026 (החלטת המשתמש): בתקופת הפיתוח — דלוק כברירת מחדל. לפני משתמשים מבחוץ: false + מסך הסכמה (משימות-פתוחות.md)
  ok(/const val DEFAULT_ON = (true|false)/.test(sync) && /getBoolean\("en", DEFAULT_ON\)/.test(sync), 'DmSync: ברירת המחדל במקום אחד (DEFAULT_ON) ומתג כיבוי בהגדרות');
  const cv = +(sync.match(/const val CV = (\d+)/) || [])[1];
  ok(cv === require(path.join(ROOT, 'ibkr-proxy/lib/dmlog.js')).DMC_V, 'DmSync.CV = DMC_V בשרתון');
  // 24/10/2026: WEB_CLIENT חייב להיות לקוח ה־Web של Firebase (מ־accounts:createAuthUri) — עם מזהה הלקוח מסוג Android Google מחזיר [28444]
  ok(/WEB_CLIENT = "286578855160-a5kii0glss9b883glkr698frmvekpa67\.apps\.googleusercontent\.com"/.test(sync), 'DmSync: WEB_CLIENT = לקוח ה־Web של הפרויקט (לא לקוח ה־Android)');
  ok(/JSONArray\(evs\.map \{ it\.json\(\) \}\)/.test(sync) && !/\.url\b|cookie/i.test(sync.replace(/import java\.net\.URL\n/, '')), 'DmSync: נשלחים רק האירועים של DmLog — בלי כתובת ובלי עוגיות');
  const log = R('android/app/src/dmcore/java/io/github/yishaiguedj1/snowball/dm/DmLog.kt');
  ok(!/put\("url"|put\("ref"|put\("ck"|put\("ua"/.test(log), 'DmLog: אין שדה כתובת, Referer, עוגיות או User-Agent');
}

// המנוע: הכללים מהמחקר
const fetch = R('android/app/src/dmcore/java/io/github/yishaiguedj1/snowball/dm/DmFetch.kt');
ok(/"Range" to "bytes=0-0"/.test(fetch), 'בדיקה ב־GET עם Range: bytes=0-0 (לא HEAD)');
ok(/"If-Range"/.test(fetch) && /st == 200\) \{ restart = true/.test(fetch), 'If-Range: קובץ שהשתנה → מתחילים מחדש, לא מערבבים');
ok(/"Accept-Encoding", "identity"/.test(fetch), 'בלי דחיסה (הטווחים בבתים של הקובץ)');
ok(/DmSegs\.split\(task\.segs, minSeg\)/.test(fetch), 'חיבור שהתפנה חוצה את המקטע הגדול ביותר');
const run = R('android/app/src/dm/java/io/github/yishaiguedj1/snowball/dm/DmRun.kt');
ok(/setUserInitiated\(true\)/.test(run) && /override fun onStopJob[\s\S]{0,200}stopAllSystem\(\)[\s\S]{0,80}return true/.test(run), 'UIDT, וכשהמערכת עוצרת — חוזר לתור');
ok(/override fun onTimeout\(startId: Int, fgsType: Int\)/.test(run), 'onTimeout (אנדרואיד 15)');
ok(!/startForegroundService|startService/.test(run.split('class DmBoot')[1].split('object DmNotif')[0]), 'אחרי אתחול רק התראה (dataSync מ־BOOT אסור באנדרואיד 15)');
const media = R('android/app/src/dm/java/io/github/yishaiguedj1/snowball/dm/DmMedia.kt');
ok(/IS_PENDING, 1/.test(media) && /IS_PENDING, 0/.test(media), 'ישר ל־MediaStore עם IS_PENDING, בלי עותק כפול');
const store = R('android/app/src/dm/java/io/github/yishaiguedj1/snowball/dm/DmStore.kt');
ok(/renameTo\(f\)/.test(store), 'הרשימה נכתבת אטומית');
// 23/10 (אחרי ההתקנה הראשונה): הכתובת המקורית נשמרת (חתומה אחרי הפניה פגה תוך דקות), והלוח לא מציע קישור שכבר ירד
const act = R('android/app/src/dm/java/io/github/yishaiguedj1/snowball/dm/DmActivity.kt');
const eng = R('android/app/src/dm/java/io/github/yishaiguedj1/snowball/dm/DmEngine.kt');
ok(/return Found\.File\(url, /.test(act) && !/t\.url = p\.finalUrl/.test(eng), 'נשמרת הכתובת שהמשתמש נתן, לא זו שאחרי ההפניה');
ok(/!DmStore\.has\(u\)/.test(act) && /fun has\(url: String\)/.test(store), 'הלוח לא מציע קישור שכבר ברשימה');
// שפה: עברית כברירת מחדל (כמו בשאר האפליקציות), גם בהתראות
ok(/getString\("lang", "he"\)/.test(store) && /attachBaseContext[\s\S]{0,80}DmLang\.wrap/.test(act), 'עברית כברירת מחדל, בלי תלות בשפת הטלפון');
ok((run.match(/val ctx = DmLang\.wrap\(ctx0\)/g) || []).length === 4, 'כל ההתראות בשפה שנבחרה');
// שלב 2 (23/10): הדפדפן של DM, עוגיות, רענון קישור, מגבלות
const br = R('android/app/src/dm/java/io/github/yishaiguedj1/snowball/dm/DmBrowser.kt');
const hunt = R('android/app/src/studio/java/io/github/yishaiguedj1/snowball/HuntActivity.kt');
const Q3 = '"'.repeat(3);
const hook = (src) => { const i = src.indexOf('private const val HOOK = ' + Q3); if (i < 0) return ''; const a = i + 25 + 3; return src.slice(a, src.indexOf(Q3, a)); };
ok(hook(br) && hook(br) === hook(hunt), 'אותו סקריפט ציד בשני הדפדפנים (Studio ו־DM)');
ok(fs.existsSync(path.join(ROOT, 'android/app/src/grab/java/io/github/yishaiguedj1/snowball/HuntMedia.kt')) &&
  !fs.existsSync(path.join(ROOT, 'android/app/src/studio/java/io/github/yishaiguedj1/snowball/HuntMedia.kt')), 'HuntMedia משותף (src/grab)');
ok(/android:name="\.dm\.DmBrowser"\s+android:exported="false"/.test(man), 'הדפדפן לא נגיש לאפליקציות אחרות');
ok(/DmBrowser\.take\(i\.getStringExtra\(DmBrowser\.EXTRA_TOKEN\), u\)/.test(act) && !/getBooleanExtra\("?dm_ck/.test(act), 'עוגיות ו־User-Agent רק ממסירה בתוך התהליך — לא מ־extras');
ok(/token != h\.token \|\| url != h\.url/.test(br) && /handoff = null/.test(br), 'המסירה חד־פעמית, לאותו קישור');
ok(/setDownloadListener/.test(br), 'הורדה שהדף מתחיל — ל־DM');
ok(/instanceFollowRedirects = false/.test(fetch) && /cookies\?\.invoke\(u\.toString\(\)\)/.test(fetch) && /next\.protocol == "http"/.test(fetch), 'הפניות בתוך המנוע: עוגייה לכל קפיצה בנפרד, בלי ירידה ל־http');
ok(fetch.includes("'\\n' !in it && '\\r' !in it"), 'בלי הזרקת כותרות דרך העוגייה');
ok(/DmLimit\.take\(n\.toLong\(\), sleep\)/.test(fetch) && /DmLimit\.bytesPerSec = pr\.limit/.test(eng), 'מגבלת מהירות לכל ההורדות');
ok(/DmLink\.pickStart\(/.test(eng) && /const val PER_HOST = 2/.test(R('android/app/src/dmcore/java/io/github/yishaiguedj1/snowball/dm/DmCore.kt')), 'לכל היותר 2 הורדות במקביל מאותו אתר');
ok(/if \(t\.total > 0 && f\.size != t\.total\) return "refresh_size"/.test(act), 'רענון קישור רק לאותו קובץ (אותו גודל)');
ok(/fun cookiesOf\(t: DmTask\)[^\n]*if \(!t\.ck\) null/.test(eng), 'עוגיות רק להורדה שהתחילה בדפדפן');
ok(!/ck|\.ua/.test(store.split('fun exportJson')[1].split('\n}')[0]), 'הייצוא בלי עוגיות/User-Agent');
// שלב 3 (24/10): הרבה הורדות — רשימה, גיבוי, שלמות, כללים לפי אתר, אריח
const batch = R('android/app/src/dmcore/java/io/github/yishaiguedj1/snowball/dm/DmBatch.kt');
const ui = R('android/app/src/dm/java/io/github/yishaiguedj1/snowball/dm/DmUi.kt');
ok(/DmImport\.parse\(url\)/.test(ui) && /BatchBlock\(a, parsed, ref, onClose\)/.test(ui), 'הדבקה של כמה קישורים / גיבוי — באותו שדה');
ok(/fun fresh\(/.test(batch) && /DmImport\.fresh\(/.test(act), 'שחזור מגיבוי בלי כפולים');
ok(/MessageDigest\.getInstance\(algo\)/.test(batch) && /HashBlock\(a, t\)/.test(ui), 'בדיקת שלמות מול הסיכום של האתר');
ok(/busyHits\.incrementAndGet\(\)/.test(fetch) && /learnHost\(pr, host, conns, f\.throttled\)/.test(eng), 'אתר שמגביל — פחות חיבורים בפעם הבאה');
ok(/android:name="\.dm\.DmTile"[\s\S]{0,300}BIND_QUICK_SETTINGS_TILE/.test(man), 'אריח בהגדרות המהירות, מוגן על ידי המערכת');
ok(/DmTile\.ACTION_CLIP/.test(act) && /clipOnFocus/.test(act), 'האריח קורא את הלוח רק כשהחלון בפוקוס');
ok(/fun pauseAll/.test(eng) && /fun resumeAll/.test(eng) && /fun startFirst/.test(eng), 'עצירה/המשך של הכל ו"להוריד ראשון"');
ok(!/RECEIVE_BOOT|SCHEDULE_EXACT_ALARM|USE_EXACT_ALARM/.test(man.split('DmTile')[1] || ''), 'בלי הרשאות חדשות לשלב 3');
// 24/10: "מהרגע שמתקינים את Studio DM — כל ההורדות של המכשיר אליו" (בקשת המשתמש)
const route = R('android/app/src/grab/java/io/github/yishaiguedj1/snowball/AppRoute.kt');
const grab = R('android/app/src/bubble/java/io/github/yishaiguedj1/snowball/GrabService.kt');
const dla = R('android/app/src/studio/java/io/github/yishaiguedj1/snowball/DlActivity.kt');
ok(/const val DM_PKG = "app\.thesnowball\.studiodm"/.test(route) && /const val STUDIO_PKG = "app\.thesnowball\.studio"/.test(route), 'AppRoute: החבילות שלנו בלבד');
ok(/private fun open\(url: String\) \{\s*hide\(\)[\s\S]{0,200}if \(AppRoute\.toDm\(this, url\)\) return/.test(grab), 'הבועה → Studio DM כשמותקן (ברירת המחדל)');
ok(/getQueryParameter\("o"\) == "1" && DlState\.id != nonce && AppRoute\.toDm\(this, u, ref\)/.test(dla), '"רק להוריד לטלפון" ב־Studio → Studio DM כשמותקן');
for (const [m, pkg] of [['bubble', 'studiodm'], ['studio', 'studiodm'], ['dm', 'studio']])
  ok(new RegExp('<package android:name="app\\.thesnowball\\.' + pkg + '" />').test(R('android/app/src/' + m + '/AndroidManifest.xml')), 'queries ב־' + m + ' → ' + pkg);
ok(/StudioRow\(a, f\.url, ref, cloudOk\(info\)\)/.test(ui) && /a\.toCloud\(url, ref\)/.test(ui), 'DM: "להוריד ולתרגם" ו"ישר לענן של Studio"');
ok(/\^youtube/.test(ui) && /export const cloudBlocked = \(r\) => \/\^youtube\/i/.test(R('studio.js')), '"ישר לענן" לא מוצע ביוטיוב — אותו כלל של Studio');
ok(/snb_to"\) == "cloud"\) "&to=cloud"/.test(R('android/app/src/main/java/io/github/yishaiguedj1/snowball/MainActivity.kt')) &&
  /hashArg\('to', 10\) === 'cloud'/.test(R('studio-app.js')) && /want === 'cloud' && ui\.url \? 'cloud'/.test(R('studio.js')), 'to=cloud: מ־DM עד הבחירה בדף הקישור');
ok(/const val EXTRA_TO = "snb_to"/.test(route), 'אותו שם extra בשני הצדדים');
ok(/FLAG_GRANT_READ_URI_PERMISSION/.test(route) && /setPackage\(STUDIO_PKG\)/.test(route), 'הקובץ ל־Studio — רק לחבילה שלנו ורק עם הרשאת קריאה לקובץ הזה');
ok(fs.existsSync(path.join(ROOT, 'android/app/src/testDm/java/io/github/yishaiguedj1/snowball/dm/DmNetTest.kt')), 'בדיקת JVM לעוגיות בהפניה ולמגבלות');
ok(fs.existsSync(path.join(ROOT, 'android/app/src/testDm/java/io/github/yishaiguedj1/snowball/dm/DmFetchTest.kt')), 'בדיקת JVM מול שרת אמיתי קיימת');

// מחרוזות: כל R.string.dm* קיים, ובשתי השפות
const he = R('android/app/src/dm/res/values/dm.xml'), en = R('android/app/src/dm/res/values-en/dm.xml');
const keys = (s) => new Set([...s.matchAll(/<string name="(\w+)"/g)].map((m) => m[1]));
const kh = keys(he), ke = keys(en);
ok(kh.size > 50, 'יש מחרוזות');
for (const k of kh) ok(ke.has(k), 'באנגלית: ' + k);
for (const k of ke) ok(kh.has(k), 'בעברית: ' + k);
const used = new Set(code.flatMap((f) => [...R(f).matchAll(/R\.string\.(dm\w+)/g)].map((m) => m[1])));
for (const k of used) ok(kh.has(k), 'מחרוזת קיימת: ' + k);

// 26/10/2026 (שלב 1 בתוכנית הדפדפן): אתרים שבהם הורדת דרך הדפדפן — לבועה; בדיקת קובץ עם העוגיות של הדף
{
  const bman = R('android/app/src/bubble/AndroidManifest.xml');
  const prov = R('android/app/src/dm/java/io/github/yishaiguedj1/snowball/dm/DmSitesProvider.kt');
  const grab = R('android/app/src/bubble/java/io/github/yishaiguedj1/snowball/GrabService.kt');
  const brw = R('android/app/src/dm/java/io/github/yishaiguedj1/snowball/dm/DmBrowser.kt');
  const perm = /<permission android:name="app\.thesnowball\.permission\.DM_SITES" android:protectionLevel="signature" \/>/;
  ok(perm.test(man) && perm.test(bman), 'הרשאת האתרים — חתימה, מוגדרת בשתי האפליקציות (בלי תלות בסדר ההתקנה)');
  ok(/<provider[\s\S]{0,200}DmSitesProvider[\s\S]{0,200}android:permission="app\.thesnowball\.permission\.DM_SITES"/.test(man), 'הספק מוגן בהרשאה (קריאה וכתיבה)');
  ok(/fun insert[^\n]*= null/.test(prov) && /fun update[^\n]*= 0/.test(prov) && /fun delete[^\n]*= 0/.test(prov), 'הספק — קריאה בלבד');
  ok(/arrayOf\("h"\)/.test(prov) && !/brSites\s*=/.test(prov), 'הספק מגיש רק שמות אתרים');
  ok(/getBooleanExtra\(AppRoute\.EXTRA_BR, false\)\) \{ openBrowser\(u\); return \}/.test(act), 'בקשה לפתוח בדפדפן — רק פתיחת כתובת, בלי מסירה של עוגיות');
  ok(/private fun rememberSite[\s\S]{0,80}if \(!sheetCk\) return/.test(act), 'אתר נשמר רק כשההורדה הגיעה מהדפדפן של DM');
  ok(/if \(hitKnown && AppRoute\.toDmBrowser\(this, url\)\) return/.test(grab), 'הבועה באתר מהרשימה → הדפדפן של DM');
  ok(/instanceFollowRedirects = false/.test(brw) && /ck\(u\.toString\(\)\)/.test(brw) && /u\.protocol == "https" && next\.protocol == "http"/.test(brw), 'בדיקת הקובץ: עוגיות לכל קפיצה לפי הכתובת שלה, בלי ירידה ל־http');
  ok(/'\\n' !in it && '\\r' !in it/.test(brw), 'בלי הזרקת כותרות דרך העוגייה בבדיקה');
  ok(!/setRequestProperty\("Cookie"|getCookie\(/.test(R('android/app/src/studio/java/io/github/yishaiguedj1/snowball/HuntActivity.kt')), 'הדפדפן של Studio — לא שולח עוגיות');
}

console.log('studio-dm: ' + n + ' בדיקות עברו');
