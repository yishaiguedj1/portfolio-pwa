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
ok(/app-dm-release\.apk the-snowball-studio-dm\.apk/.test(yml) && /the-snowball-studio-dm\.apk --clobber/.test(yml), 'APK רביעי בקישור הקבוע');

const man = R('android/app/src/dm/AndroidManifest.xml');
ok(/android:name="\.MainActivity" tools:node="remove"/.test(man) && /DelegationService" tools:node="remove"/.test(man), 'לא TWA: MainActivity והשירות של TWA יוצאים');
ok(!/BIND_ACCESSIBILITY_SERVICE|accessibilityservice/i.test(man), 'אף פעם לא שירות נגישות (Play Protect)');
ok(/android:foregroundServiceType="dataSync"/.test(man) && /RUN_USER_INITIATED_JOBS/.test(man), 'UIDT + שירות בחזית');

// 0א — ניתוק מהשרת: שום כתובת שלנו בקוד של DM (גם לא במנוע המשותף)
const code = [...ls('android/app/src/dm/java'), ...ls('android/app/src/dmcore/java'), ...ls('android/app/src/ytdl/java')];
ok(code.length >= 8, 'קבצי הקוד נמצאו');
for (const f of code) {
  const s = R(f);
  ok(!/thesnowball\.app|vercel\.app|workers\.dev|\/api\/|snbstudio:\/\/|launchUrl/.test(s), 'בלי שרת/אתר שלנו: ' + path.basename(f));
}

// המנוע: הכללים מהמחקר
const fetch = R('android/app/src/dmcore/java/io/github/yishaiguedj1/snowball/dm/DmFetch.kt');
ok(/"Range", "bytes=0-0"/.test(fetch), 'בדיקה ב־GET עם Range: bytes=0-0 (לא HEAD)');
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

console.log('studio-dm: ' + n + ' בדיקות עברו');
