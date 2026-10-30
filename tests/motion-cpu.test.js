// 28/10/2026 (בקשת המשתמש: "אנימציה במעבד איטי"): נמדד ב־qa-deep --cpu 4 --prof —
// (1) הכנת הקיפול בקורא (WebGL + שכפול הפרק) רק אחרי שהעמוד הראשון דהה פנימה, לא באמצע הדהייה;
// (2) גלילה של ניווט בניתוח מסומנת data-nav-scroll (כמו בספרייה) — כלי המעברים לא סופר אותה כקפיצה;
// (3) כלי המדידה עצמו בלי קריאות פריסה בכל פריים (הוא הכביד על האנימציות שמדד).
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const rd = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; console.log('ok - ' + m); };

const lib = rd('library.js');
ok(/if \(rd\.curlFirst\) curlPrebuild\(\);/.test(lib.split('async function curlSetup')[1].split('\nfunction curlPrebuild')[0]), 'curlSetup: הכנה רק אם העמוד הראשון כבר הוצג');
ok(/if \(rd && !rd\.curlFirst\) \{ rd\.curlFirst = 1; setTimeout\(curlPrebuild, 350\); \}/.test(lib), 'relocate ראשון: הכנת הקיפול אחרי הדהייה (350ms)');
ok(/await new Promise\(\(res\) => setTimeout\(res, 900\)\)/.test(lib.split('async function ribbon3dSetup')[1].slice(0, 600)), 'הסימנייה התלת־ממדית — עדיין אחרי הכניסה');

const an = rd('analysis.js');
ok(/function navY\(v\) \{[\s\S]{0,200}ROOT\.dataset\.navScroll = '1'; ROOT\.scrollTop = v;/.test(an), 'navY מסמן data-nav-scroll');
ok(!/ROOT\.scrollTop = (y1|typeof y|0;)/.test(an), 'כל גלילות הניווט דרך navY');

for (const f of ['tools/qa-motion.js', 'tools/qa-deep.js']) {
  const s = rd(f), init = s.slice(s.indexOf('const INIT'), s.indexOf('})();`', s.indexOf('const INIT')));
  const tick = (init.match(/const tick = \(\) => \{[^\n]*/) || [''])[0];
  ok(!/const tick/.test(init) || (/requestAnimationFrame\(tick\); \};$/.test(tick) && !/scroll|querySelector|getBoundingClientRect/.test(tick)), f + ': לולאת הפריימים בשורה אחת, בלי קריאות פריסה');
  ok(/addEventListener\('scroll'/.test(init), f + ': קפיצות גלילה מאירועי scroll');
}
// אנדרואיד (ביקורת סטטית, docs/android-apps.md): בלי הבהוב לבן/אפור, מצב נשמר, הבועה לא מתפרקת, ווידג'ט בלי ספינר
const A = 'android/app/src/';
const man = rd(A + 'main/AndroidManifest.xml');
ok(/android:theme="@style\/SplashTheme"/.test(man) && /name="SplashTheme"[\s\S]{0,400}windowBackground">@color\/splash_bg/.test(rd(A + 'main/res/values/styles.xml')), 'מעטפת: SplashTheme בצבע הדף (splash_bg) עד הדף');
ok(!/text = "טוען…"/.test(rd(A + 'main/java/io/github/yishaiguedj1/snowball/MainActivity.kt')), 'מעטפת: בלי "טוען…" שמהבהב');
for (const f of ['browser/java/io/github/yishaiguedj1/snowball/br/BrowserActivity.kt', 'dm/java/io/github/yishaiguedj1/snowball/dm/DmBrowser.kt', 'studio/java/io/github/yishaiguedj1/snowball/HuntActivity.kt']) {
  const k = rd(A + f);
  ok(/setBackgroundColor\(/.test(k) && /override fun onPageCommitVisible\(/.test(k), f.split('/').pop() + ': WebView ברקע הנושא עד הציור הראשון');
}
const dmui = rd(A + 'dm/java/io/github/yishaiguedj1/snowball/dm/DmUi.kt');
ok(/var tab by rememberSaveable/.test(dmui) && (dmui.match(/keep\.SaveableStateProvider\("/g) || []).length === 3, 'DM: כל לשונית שומרת מצב (rememberSaveableStateHolder)');
ok(/var q by rememberSaveable/.test(dmui) && /var cat by rememberSaveable/.test(dmui), 'DM: חיפוש ומסנן נשמרים');
ok(/windowBackground">@color\/dm_win/.test(rd(A + 'dm/res/values/dm.xml')) && fs.existsSync(path.join(__dirname, '..', A + 'dm/res/values-night/dm_colors.xml')), 'DM: רקע חלון בהיר/כהה');
const grab = rd(A + 'bubble/java/io/github/yishaiguedj1/snowball/GrabService.kt');
ok(/if \(keepAnchor\) \{\s+if \(parked\) return/.test(grab) && /if \(parked\) \{\s+val p = lp/.test(grab), 'בועה: נגן שיצא מהמסך — הבועה שקופה במקום, לא נבנית מחדש');
ok(/box\.alpha = 0f;[^\n]*\n\s+try \{ w\.addView\(box, p\)/.test(grab), 'בועה: שקופה לפני addView');
for (const f of ['admin/res/xml/mon_widget_info.xml', 'invest/res/xml/snowball_widget_info.xml', 'invest/res/xml/snowball_watch_widget_info.xml']) ok(/initialLayout="@layout\/widget_blank"/.test(rd(A + f)), f + ': בלי ספינר ברירת מחדל');

console.log('\n' + n + ' בדיקות עברו');
