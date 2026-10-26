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
const code = [act, ui, store, R(B + 'BrTab.kt'), R(B + 'BrIcons.kt')];
for (const s of code) ok(!/thesnowball\.app|vercel\.app|workers\.dev|\/api\//.test(s), 'בלי השרת שלנו בקוד של הדפדפן');

const used = new Set([...code.join('\n').matchAll(/R\.string\.(br\w+)/g)].map((m) => m[1]));
const he = R('android/app/src/browser/res/values/br.xml'), en = R('android/app/src/browser/res/values-en/br.xml');
const names = (x) => new Set([...x.matchAll(/<string name="(\w+)"/g)].map((m) => m[1]));
const H = names(he), E = names(en);
for (const k of used) ok(H.has(k) && E.has(k), 'מחרוזת בעברית ובאנגלית: ' + k);
ok([...H].every((k) => E.has(k)), 'כל מחרוזת עברית — גם באנגלית');
ok(fs.existsSync(path.join(ROOT, 'android/app/src/browser/res/mipmap-xxxhdpi/br_launcher.png')), 'אייקון משלו');

console.log('studio-browser: ' + n + ' בדיקות עברו');
