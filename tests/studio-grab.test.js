// 22/10/2026 (שלב 1.5 של ההורדה מקישור): בועת ההורדה בדפדפן — האתר וה־APK מסכימים על הקישור שפותח את ההגדרות,
// השירות רק ב־Studio, ורשימת הדפדפנים של השירות זהה לטבלת שורות הכתובת (גם בבדיקת ה־JVM: VideoUrlTest).
const fs = require('fs'), path = require('path'), assert = require('assert');
const R = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };

const studio = R('studio.js'), man = R('android/app/src/studio/AndroidManifest.xml'), gradle = R('android/app/build.gradle.kts');
const pkg = /app\("studio", "([^"]+)"/.exec(gradle)[1];
ok(studio.includes("const GRAB_PKG = '" + pkg + "'"), 'החבילה בקישור = applicationId של Studio');
ok(/scheme=snbstudio;package=/.test(studio) && /android:scheme="snbstudio" android:host="grab"/.test(man), 'scheme/host זהים באתר וב־manifest');
ok(/s=' \+ s \+/.test(studio) && R('android/app/src/studio/java/io/github/yishaiguedj1/snowball/GrabSetupActivity.kt').includes('getQueryParameter("s") == "app"'), 'הפרמטר s');
ok(/BIND_ACCESSIBILITY_SERVICE/.test(man) && /BIND_QUICK_SETTINGS_TILE/.test(man), 'השירות והאריח מוגנים בהרשאת המערכת');
for (const f of ['main', 'invest', 'academy']) {
  const p = 'android/app/src/' + f + '/AndroidManifest.xml';
  if (fs.existsSync(path.join(__dirname, '..', p))) ok(!/Grab|ACCESSIBILITY/.test(R(p)), 'בלי שירות נגישות ב־' + f);
}
// הדפדפנים: packageNames ב־xml = המפתחות של URL_BAR
const xml = R('android/app/src/studio/res/xml/grab_service.xml');
const pk = /packageNames="([^"]+)"/.exec(xml)[1].split(',').map((s) => s.trim()).sort();
const svc = R('android/app/src/studio/java/io/github/yishaiguedj1/snowball/GrabService.kt');
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
assert.deepStrictEqual(keys('android/app/src/studio/res/values/strings.xml'), keys('android/app/src/studio/res/values-en/strings.xml')); n++;
console.log('studio-grab: ' + n + ' בדיקות עברו');
