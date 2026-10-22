// 22/10/2026 (שלב 1.5 של ההורדה מקישור): בועת ההורדה בדפדפן — האתר וה־APK מסכימים על הקישור שפותח את ההגדרות,
// השירות רק ב־Studio, ורשימת הדפדפנים של השירות זהה לטבלת שורות הכתובת (גם בבדיקת ה־JVM: VideoUrlTest).
const fs = require('fs'), path = require('path'), assert = require('assert');
const R = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };

const studio = R('studio.js'), man = R('android/app/src/bubble/AndroidManifest.xml'), sman = R('android/app/src/studio/AndroidManifest.xml'), gradle = R('android/app/build.gradle.kts');
const pkg = /app\("studio", "([^"]+)"/.exec(gradle)[1], bpkg = /app\("bubble", "([^"]+)"/.exec(gradle)[1];
// 22/10/2026: הבועה = APK נפרד (Studio Bubble) — Play Protect חסם את Studio כולו כשהשירות היה בתוכו
ok(studio.includes("const GRAB_PKG = '" + bpkg + "', HUNT_PKG = '" + pkg + "'"), 'החבילות בקישורים = applicationId של Bubble ושל Studio');
ok(/scheme=snbstudio;package=/.test(studio) && /android:scheme="snbstudio" android:host="grab"/.test(man), 'scheme/host זהים באתר וב־manifest');
ok(/S\.browser_fallback_url=' \+ encodeURIComponent\(BUBBLE_APK\)/.test(studio) && /the-snowball-bubble\.apk/.test(R('.github/workflows/android.yml')), 'לא מותקנת — ההורדה מהקישור הקבוע, שה־CI מפרסם');
ok(/s=' \+ s \+/.test(studio) && R('android/app/src/bubble/java/io/github/yishaiguedj1/snowball/GrabSetupActivity.kt').includes('getQueryParameter("s") == "app"'), 'הפרמטר s');
ok(/BIND_ACCESSIBILITY_SERVICE/.test(man) && /BIND_QUICK_SETTINGS_TILE/.test(man), 'השירות והאריח מוגנים בהרשאת המערכת');
ok(!/ACCESSIBILITY|GrabService/.test(sman), 'ב־Studio עצמו אין שירות נגישות (אחרת Play Protect חוסם את ההתקנה)');
ok(R('android/app/src/bubble/java/io/github/yishaiguedj1/snowball/GrabService.kt').includes('const val STUDIO_PKG = "' + pkg + '"'), 'הבועה שולחת ל־Studio');
for (const f of ['main', 'invest', 'academy', 'studio']) {
  const p = 'android/app/src/' + f + '/AndroidManifest.xml';
  if (fs.existsSync(path.join(__dirname, '..', p))) ok(!/Grab|ACCESSIBILITY/.test(R(p)), 'בלי שירות נגישות ב־' + f);
}
// הדפדפנים: packageNames ב־xml = המפתחות של URL_BAR
const xml = R('android/app/src/bubble/res/xml/grab_service.xml');
const pk = /packageNames="([^"]+)"/.exec(xml)[1].split(',').map((s) => s.trim()).sort();
const svc = R('android/app/src/bubble/java/io/github/yishaiguedj1/snowball/GrabService.kt');
const bar = [...svc.slice(svc.indexOf('URL_BAR: Map')).matchAll(/^\s+"([\w.]+)" to listOf\(/gm)].map((m) => m[1]).sort();
assert.deepStrictEqual(bar, pk); n++;
ok(/canRetrieveWindowContent="true"/.test(xml) && /isAccessibilityTool="false"/.test(xml), 'הגדרות השירות');
// העמוד באתר: רק באפליקציה לאנדרואיד, ובשתי השפות
ok(/function grabOk\(\)[\s\S]{0,200}inApk\(\)/.test(studio), 'רק באפליקציה');
ok(/v === 'grab'/.test(studio) && /'fmthelp', 'grab',/.test(studio) && /pageGrab\(p\)/.test(studio), 'ניווט');
const app = R('app.js');
for (const k of ['studioGrabT', 'studioGrabIntro', 'studioGrab1', 'studioGrabGreyS', 'studioGrabPriv2S'])
  ok((app.match(new RegExp('\\b' + k + ': "', 'g')) || []).length === 2, k + ' בעברית ובאנגלית');
// מחרוזות האנדרואיד: עברית ואנגלית עם אותם מפתחות
const keys = (p) => [...R(p).matchAll(/<string name="(\w+)"/g)].map((m) => m[1]).sort();
for (const f of ['studio', 'bubble']) { assert.deepStrictEqual(keys('android/app/src/' + f + '/res/values/strings.xml'), keys('android/app/src/' + f + '/res/values-en/strings.xml')); n++; }
// שלב 2 — דפדפן הציד: הקישור מהאתר, הפעילות ב־manifest, והדף שבו נמצא הקובץ (ref) עובר עד הבדיקה והעבודה
ok(/'intent:\/\/hunt' \+ q \+ '#Intent;scheme=snbstudio;package=' \+ HUNT_PKG/.test(studio) && /android:host="hunt"/.test(sman) && /\.HuntActivity/.test(sman), 'הקישור לדפדפן הציד');
const mainK = R('android/app/src/main/java/io/github/yishaiguedj1/snowball/MainActivity.kt');
ok(/"snb_ref"/.test(mainK) && /"extra_referer"/.test(mainK) && /"&ref=" \+ Uri\.encode\(ref\)/.test(mainK), 'MainActivity מעביר ref (גם extra_referer כמו ב־1DM)');
ok(R('android/app/src/studio/java/io/github/yishaiguedj1/snowball/HuntActivity.kt').includes('const val EXTRA_REF = "snb_ref"'), 'אותו שם extra בשני הצדדים');
const sapp = R('studio-app.js');
ok(/hashArg\('ref', 2048\)/.test(sapp) && /ref: shareRef/.test(sapp), 'studio-app קורא את ref');
// 22/10/2026: Studio כבר פתוחה — הקישור מהבועה מגיע כשינוי ב־hash, בלי טעינה; חייב להגיע לדף הקישור
ok(/addEventListener\('hashchange'[\s\S]{0,600}studioShare\(s, r\)/.test(sapp) && /import \{ studioShare[^}]*\} from '.\/studio.js'/.test(sapp), 'studio-app מאזין ל־hashchange');
ok(/export function studioShare\(text, ref\)[\s\S]{0,300}linkCheck\(form, shared, ref\)/.test(studio) && /studioShare\(opt\.share, opt\.ref\)/.test(studio) && /dlIntent\('probe', \{ u: L\.u, ref: L\.ref, n: L\.n \}\)/.test(studio) && /dlIntent\('dl', \{ u: L\.r\.u \|\| L\.u, ref: L\.ref,/.test(studio), 'ref → הבדיקה וההורדה בטלפון (22/10/2026: כל ההורדות מקומיות)');
ok(!/HuntActivity|snbstudio/.test(R('android/app/src/main/AndroidManifest.xml')), 'דפדפן הציד רק ב־Studio');
console.log('studio-grab: ' + n + ' בדיקות עברו');
