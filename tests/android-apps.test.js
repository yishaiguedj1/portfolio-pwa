// 14/10/2026 (בקשת המשתמש): שלוש אפליקציות אנדרואיד נפרדות — Invest, Academy, Studio (תוכנית-שלוש-אפליקציות.md, 4א).
// גרסאות (flavors) מאותו קוד, ווידג'ט רק ב־Invest, assetlinks לשלוש החבילות, ומעבר בתפריט = האפליקציה המותקנת.
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const R = (f) => fs.readFileSync(path.join(root, f), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('ok - ' + m); } else { fail++; console.log('FAIL - ' + m); } };

const PKGS = { invest: 'io.github.yishaiguedj1.snowball', academy: 'app.thesnowball.academy', studio: 'app.thesnowball.studio' };

// ---------- Gradle: שלוש גרסאות
const gr = R('android/app/build.gradle.kts');
for (const [k, id] of Object.entries(PKGS)) {
  ok(new RegExp('app\\("' + k + '", "' + id.replace(/\./g, '\\.') + '", "[A-Z][a-z]+", "' + k + '\\.thesnowball\\.app", "#[0-9A-F]{6}"\\)').test(gr), k + ': גרסה עם מזהה, שם, כתובת וצבע');
}
ok(/applicationId = "io\.github\.yishaiguedj1\.snowball"/.test(gr) && /app\("invest", "io\.github\.yishaiguedj1\.snowball"/.test(gr), 'Invest שומרת את המזהה הקיים — ההתקנה מתעדכנת במקום והווידג׳ט נשאר');
ok(/"investImplementation"\("androidx\.glance:glance-appwidget/.test(gr) && !/^\s*implementation\("androidx\.glance/m.test(gr), 'Glance רק ב־Invest');
// 22/10/2026: גם Studio Bubble (הבועה בדפדפן — APK נפרד) על src/lite; Studio והבועה חולקות את src/grab (VideoUrl)
ok(/getByName\("academy"\)\.java\.srcDir\("src\/lite\/java"\)/.test(gr) && /getByName\("studio"\)\.java\.srcDirs\("src\/lite\/java", "src\/grab\/java", "src\/ytdl\/java"\)/.test(gr) && /getByName\("bubble"\)\.java\.srcDirs\("src\/lite\/java", "src\/grab\/java"\)/.test(gr), 'Academy, Studio ו־Studio Bubble חולקות את src/lite (23/10/2026: ומנוע yt-dlp ב־src/ytdl — משותף עם Studio DM)');

// ---------- מבנה הקבצים
const P = 'io/github/yishaiguedj1/snowball/';
for (const f of ['SnowballWidget', 'WidgetData', 'WidgetRefresh', 'WidgetSyncActivity', 'WidgetValidate', 'LogoCache'])
  ok(fs.existsSync(path.join(root, 'android/app/src/invest/java', P + f + '.kt')) && !fs.existsSync(path.join(root, 'android/app/src/main/java', P + f + '.kt')), f + ' — רק ב־Invest');
const mainMf = R('android/app/src/main/AndroidManifest.xml'), invMf = R('android/app/src/invest/AndroidManifest.xml');
ok(!/Widget/.test(mainMf.replace(/<!--[\s\S]*?-->/g, '')) && /SnowballWidgetReceiver/.test(invMf) && /WidgetSyncActivity/.test(invMf), 'הווידג׳טים רשומים רק ב־manifest של Invest');
ok(/android:host="\$\{siteHost\}"/.test(mainMf) && /yishaiguedj1\.github\.io/.test(invMf) && !/github\.io/.test(mainMf.replace(/<!--[\s\S]*?-->/g, '')), 'כל אפליקציה פותחת רק את הכתובת שלה; הכתובת הישנה — Invest');
const ma = R('android/app/src/main/java/' + P + 'MainActivity.kt');
ok(!/WidgetStore|WidgetRefresh/.test(ma) && /Flavor\.appSig\(this\)/.test(ma) && /Flavor\.onReturn\(this\)/.test(ma), 'MainActivity בלי תלות בווידג׳ט (Flavor)');
ok(/WidgetStore\.sig\(c\)/.test(R('android/app/src/invest/java/' + P + 'Flavor.kt')) && /fun appSig\(c: Context\): String = "1"/.test(R('android/app/src/lite/java/' + P + 'Flavor.kt')), 'Flavor: Invest = חתימת הווידג׳ט, האחרות = ‎app=1');
ok(/R\.string\.barColor/.test(ma) && /APP_ORIGINS\.filter/.test(ma), 'צבע לכל אפליקציה; שתי האחרות מקורות מאומתים');
for (const k of ['academy', 'studio'])
  for (const d of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'])
    ok(fs.existsSync(path.join(root, 'android/app/src', k, 'res/mipmap-' + d, 'ic_launcher.png')) && fs.existsSync(path.join(root, 'android/app/src', k, 'res/mipmap-' + d, 'ic_launcher_foreground.png')), k + ': אייקון ' + d);

// ---------- assetlinks: שלוש החבילות, אותה טביעה
const al = JSON.parse(R('.well-known/assetlinks.json'));
const fps = new Set(al.map((x) => x.target.sha256_cert_fingerprints.join()));
ok(Object.values(PKGS).every((p) => al.some((x) => x.target.package_name === p)) && fps.size === 1, 'assetlinks: שלוש החבילות, אותו מפתח חתימה');

// ---------- CI: שלושה קבצים בקישורים קבועים
const aw = R('.github/workflows/android.yml');
ok(/gh release upload android-latest the-snowball\.apk the-snowball-academy\.apk the-snowball-studio\.apk the-snowball-bubble\.apk the-snowball-admin\.apk the-snowball-studio-dm\.apk the-snowball-lab\.apk --clobber/.test(aw), 'CI: ששת הקבצים ב־android-latest (Invest בקישור הישן, Studio Bubble, הניהול ו־Studio DM — 23/10/2026)');

// ---------- האתר: מעבר בתפריט = האפליקציה המותקנת
const core = R('core.js');
const pick = (src, name) => { const i = src.indexOf('function ' + name + '('); let d = 0, j = src.indexOf('{', i); for (; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && !--d) break; } return src.slice(i, j + 1); };
const store = {}, ctx = { sessionStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } }, location: { hash: '', pathname: '/', search: '', href: '' }, history: { state: null, replaceState: (s, _, u) => { const i = String(u).indexOf('#'); ctx.location.hash = i < 0 ? '' : String(u).slice(i); } } };
vm.createContext(ctx);
vm.runInContext('let _backPending = 0; const _afterBack = []; const setTimeout = (f) => { this.__t = f; };\n' + pick(core, 'afterBack') + '\n' + core.match(/const APK_PKGS = [^\n]+/)[0] + '\n' + core.match(/const SS_INAPK = [^\n]+/)[0] + '\n' + ['inApk', 'apkFromHash', 'apkIntentUrl', 'appGo'].map((n) => pick(core, n)).join('\n') + '\nthis.f={inApk,apkFromHash,apkIntentUrl,appGo,APK_PKGS};this.bp=(n)=>{_backPending=n;};this.flush=()=>{_backPending=0;_afterBack.splice(0).forEach((f)=>f());};', ctx);
const F = ctx.f;
ok(JSON.stringify(F.APK_PKGS) === JSON.stringify(PKGS), 'האתר מכיר את אותן שלוש חבילות');
ok(F.apkIntentUrl('https://academy.thesnowball.app/') === 'intent://academy.thesnowball.app/#Intent;scheme=https;package=app.thesnowball.academy;S.browser_fallback_url=' + encodeURIComponent('https://academy.thesnowball.app/') + ';end', 'intent עם החבילה + חזרה לאותה כתובת כשלא מותקנת');
ok(F.apkIntentUrl('https://academy-staging.thesnowball.app/') === '' && F.apkIntentUrl('academy.html') === '' && F.apkIntentUrl('https://evil.com/') === '', 'רק כתובות הייצור (יש APK רק להן)');
F.appGo('https://studio.thesnowball.app/');
ok(ctx.location.href === 'https://studio.thesnowball.app/', 'בדפדפן — מעבר רגיל');
ctx.location.hash = '#book=x&app=1&n=k2';
ok(F.apkFromHash() === true && F.inApk() && ctx.location.hash === '#book=x', 'פתיחה מהאפליקציה: סימן ללשונית, ‎app=/‎n= נמחקים, השאר נשאר');
F.appGo('https://studio.thesnowball.app/');
ok(/^intent:\/\/studio\.thesnowball\.app\/#Intent;scheme=https;package=app\.thesnowball\.studio;/.test(ctx.location.href), 'באפליקציה — פותחים את Studio המותקנת');
// סגירת התפריט עוד מחזירה את הרשומה שלו (history.back) — המעבר מחכה לה, אחרת ה"אחורה" רץ אחרי המעבר וחוזר ל־Invest
ctx.location.href = ''; ctx.bp(1); F.appGo('https://academy.thesnowball.app/');
ok(ctx.location.href === '', 'סרטון 15/10: המעבר לא מתחיל כל עוד "אחורה" של סגירת התפריט ממתין');
ctx.flush();
ok(/^intent:\/\/academy\.thesnowball\.app\//.test(ctx.location.href), '...ומתחיל מיד אחריו');
ctx.location.href = ''; ctx.bp(1); F.appGo('https://studio.thesnowball.app/'); ctx.__t();
ok(/studio/.test(ctx.location.href), 'רשת ביטחון: "אחורה" שלא נגמר — עוברים בכל זאת');
ctx.flush(); ctx.bp(0);
ok(/if \(inApk\(\)\) return;/.test(pick(core, 'appPrerender')), 'באפליקציה — בלי prerender (המעבר פותח אפליקציה אחרת)');
ok(/appGo\(APP_URL\[k\]\)/.test(R('shell.js')) && /appGo\(APP_PAGE\.academy\)/.test(R('app.js')) && /appGo\(APP_PAGE\.studio\)/.test(R('app.js')), 'התפריט בשלוש האפליקציות עובר דרך appGo');
ok(['academy-app.js', 'studio-app.js'].every((f) => /^apkFromHash\(\);/m.test(R(f))), 'Academy ו־Studio מזהות פתיחה מהאפליקציה');
ok(/sessionStorage\.setItem\(SS_INAPK, '1'\)/.test(pick(R('app.js'), 'appSessionFromHash')), 'Invest: הסימן נשמר יחד עם חתימת הווידג׳ט');
const sh = R('shell.js');
ok(/export function apkUrl\(app\)/.test(sh) && /apk\.href = apkUrl\(app\)/.test(sh), 'בהגדרות של כל אפליקציה — קובץ ההתקנה שלה');
console.log(`\n${pass} עברו, ${fail} נכשלו`);
process.exit(fail ? 1 : 0);
