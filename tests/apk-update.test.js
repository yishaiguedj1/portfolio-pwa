// 08/11/2026 (בקשת המשתמש: "עדכון כמו עדכון המערכת במכשיר, ברקע, ורק הודעה בסיום"): העדכון העצמי השקט של האנדרואיד —
// latest.json (tools/apk-latest.js) תואם לחבילות ב־build.gradle.kts ולקבצים ב־android.yml, נכתב אחרי ה־APKים,
// המניפסט מצהיר על מה שהמנוע צריך, ושורת "עדכון תוכנה" בדף מופיעה רק באפליקציה ופותחת את המסך הנייטיב של אותה חבילה.
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm');
const root = path.join(__dirname, '..');
const R = (f) => fs.readFileSync(path.join(root, f), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('ok - ' + m); } else { fail++; console.log('FAIL - ' + m); } };

const { APKS, build } = require('../tools/apk-latest.js');
const gr = R('android/app/build.gradle.kts'), yml = R('.github/workflows/android.yml');

// ---------- כל flavor = שורה ב־APKS, וכל קובץ = הקובץ שה־workflow מעלה
const ids = [...gr.matchAll(/app\("(\w+)", "([a-z0-9_.]+)"/g)].map((m) => m[2]);
ok(ids.length === 7 && ids.every((id) => APKS[id]) && Object.keys(APKS).length === ids.length, 'כל שבע החבילות ב־apk-latest.js (' + ids.length + ')');
for (const f of Object.values(APKS)) ok(new RegExp('cp android/app/build/outputs/apk/\\w+/release/app-\\w+-release\\.apk ' + f.replace(/\./g, '\\.')).test(yml) && yml.includes(' ' + f + ' '), f + ' — נבנה ומועלה ב־android.yml');
const up = yml.indexOf('gh release upload android-latest the-snowball.apk'), lj = yml.indexOf('gh release upload android-latest latest.json');
ok(up > 0 && lj > up, 'latest.json עולה אחרי ה־APKים');
ok(/node tools\/apk-latest\.js \$\{\{ github\.run_number \}\}/.test(yml) && /SNOWBALL_VERSION_CODE: \$\{\{ github\.run_number \}\}/.test(yml), 'הגרסה ב־latest.json = versionCode של הבנייה');

// ---------- הצורה (אותה צורה ש־UpdCore.parse קורא)
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apkl-'));
fs.writeFileSync(path.join(dir, 'the-snowball-studio.apk'), 'hello');
const j = build(812, dir);
ok(j.v === 1 && j.code === 812 && j.name === '1.0.812', 'כותרת: v, code, name');
const s = j.apps['app.thesnowball.studio'];
ok(s && s.f === 'the-snowball-studio.apk' && s.n === 5 && s.h === '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824', 'לכל חבילה: f, n, h (sha256)');
ok(Object.keys(j.apps).length === 1, 'רק קבצים שקיימים');
let threw = false; try { build('x', dir); } catch (e) { threw = true; } ok(threw, 'versionCode לא תקין = שגיאה');
fs.rmSync(dir, { recursive: true, force: true });
const core = R('android/app/src/main/java/io/github/yishaiguedj1/snowball/upd/UpdCore.kt');
ok(/optLong\("code"/.test(core) && /optJSONObject\("apps"\)/.test(core) && /optString\("f"/.test(core) && /optLong\("n"/.test(core) && /optString\("h"/.test(core), 'UpdCore.parse קורא את אותם שדות');

// ---------- המנוע והמניפסט
const U = R('android/app/src/main/java/io/github/yishaiguedj1/snowball/upd/Upd.kt');
const mf = R('android/app/src/main/AndroidManifest.xml');
ok(/USER_ACTION_NOT_REQUIRED/.test(U) && /UPDATE_PACKAGES_WITHOUT_USER_ACTION/.test(mf) && /REQUEST_INSTALL_PACKAGES/.test(mf), 'התקנה בלי חלון אישור (אנדרואיד 12+)');
ok(/VISIBILITY_HIDDEN/.test(U) && /DOWNLOAD_WITHOUT_NOTIFICATION/.test(mf) && /setDestinationInExternalFilesDir\(c, "upd"/.test(U), 'הורדה מוסתרת לתיקייה הפרטית');
ok(/UpdCore\.verify\(f, r\)/.test(U) && /getPackageArchiveInfo/.test(U) && /info\?\.packageName != c\.packageName/.test(U), 'לפני התקנה: sha256 + חבילה + גרסה');
ok(/id != state\(c\)\.dlId/.test(U), 'DOWNLOAD_COMPLETE — רק ההורדה שלנו');
ok(/\.upd\.UpdStatus" android:exported="false"/.test(mf) && /\.upd\.UpdDone" android:exported="false"/.test(mf) && /MY_PACKAGE_REPLACED/.test(mf), 'הודעת סיום מהגרסה החדשה (MY_PACKAGE_REPLACED)');
ok(/android:scheme="snbupd"/.test(mf) && /BIND_JOB_SERVICE/.test(mf), 'המסך נפתח מהדף; הג׳וב מוגן');
for (const f of ['main/java/io/github/yishaiguedj1/snowball/MainActivity.kt', 'dm/java/io/github/yishaiguedj1/snowball/dm/DmActivity.kt', 'browser/java/io/github/yishaiguedj1/snowball/br/BrowserActivity.kt'])
  ok(/Upd\.schedule\(this\)/.test(R('android/app/src/' + f)), 'בדיקה יומית מתוזמנת: ' + path.basename(f));
ok(/UpdActivity::class\.java/.test(R('android/app/src/dm/java/io/github/yishaiguedj1/snowball/dm/DmUi.kt')) && /UpdActivity::class\.java/.test(R('android/app/src/browser/java/io/github/yishaiguedj1/snowball/br/BrUi.kt')), 'שורת "עדכון תוכנה" בהגדרות DM והדפדפן');
ok((R('android/app/src/main/java/io/github/yishaiguedj1/snowball/MainActivity.kt').match(/Upd\.hashParam\(this\)/g) || []).length === 2, 'TWA: ‎upd= בכתובת');
const sh = (f) => [...R(f).matchAll(/<string name="(upd\w+)"/g)].map((m) => m[1]).sort().join();
ok(sh('android/app/src/main/res/values/strings.xml') === sh('android/app/src/main/res/values-en/strings.xml') && sh('android/app/src/main/res/values/strings.xml').length > 0, 'מחרוזות המסך בעברית ובאנגלית');

// ---------- הדף: core (apkFromHash / apkUpdMount)
const coreJs = R('core.js');
const ctx = { console, JSON, RegExp, String, Number };
const store = {};
ctx.sessionStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
ctx.history = { state: null, replaceState: (s, t, u) => { ctx.location.hash = u.includes('#') ? u.slice(u.indexOf('#')) : ''; } };
ctx.location = { hash: '#book=x&app=1&upd=app.thesnowball.academy~812~1&n=abc', pathname: '/', search: '', href: '' };
vm.createContext(ctx);
const pick = (name) => { const m = new RegExp('function ' + name + '\\([\\s\\S]*?\\n}\\n').exec(coreJs); return m ? m[0] : ''; };
vm.runInContext("const SS_INAPK='pwa_in_apk';const SS_APKUPD='pwa_apk_upd';" + ['apkFromHash', 'apkUpdFromHash', 'apkUpdInfo'].map(pick).join('\n') + ';this.F={apkFromHash,apkUpdInfo};', ctx);
ok(ctx.F.apkFromHash() === true && ctx.location.hash === '#book=x', 'upd= נמחק מהכתובת יחד עם app=/n=');
const inf = ctx.F.apkUpdInfo();
ok(inf && inf.p === 'app.thesnowball.academy' && inf.c === 812 && inf.u === true, 'החבילה, הגרסה והדגל נשמרים ללשונית');
ok(/scheme=snbupd;package=' \+ info\.p/.test(coreJs) && /apkUpdLbl/.test(coreJs) && /info\.u/.test(coreJs), 'נגיעה = המסך הנייטיב של אותה חבילה; "עדכון זמין" רק כשיש');
ok(/apkUpdMount\(list\)/.test(R('shell.js')) && /apkUpdMount\(/.test(R('app.js').replace(/function apkUpdMount/, '')) && /apkFromHash\(\)/.test(R('admin-app.js')), 'השורה מחוברת: Invest, ‏shell (Academy/Studio/Admin), ‏Admin קורא את ה־hash');

console.log(`\n${pass} עברו, ${fail} נכשלו`);
process.exit(fail ? 1 : 0);
