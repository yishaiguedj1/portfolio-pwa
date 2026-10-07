// v350 (סרטון המשתמש 07/10/2026): משיכה מצד המסך ("חזור" של Android/Chrome) — Chrome מציג צילום של הרשומה שחוזרים אליה.
// (1) צילום השומר היה דף הספר (שתי הרשומות נדחפו יחד, לפני שהקורא צויר) — "חזור" אחד הבזיק את דף הספר ("קפיצה").
// (2) "חזור" כפול: Chrome כבר הציג את דף הספר ואז הקורא שלנו דהה מעליו — שתי אנימציות.
// (3) "חזור" מהעמוד הראשי של הספרייה — לסקירה (לא לטאב שהיה פתוח).
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const lib = fs.readFileSync(path.join(__dirname, '..', 'library.js'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const body = (src, name) => { const i = src.indexOf('function ' + name + '('); return src.slice(i, src.indexOf('\n}\n', i)); };
const open = body(lib, 'openReader'), pop = body(lib, 'onPop'), cr = body(lib, 'closeReader'), cl = body(lib, 'closeLibrary');
ok(!/guard: 0 \}\), ''\)/.test(open), 'בפתיחה רק רשומת השומר — רשומת הקורא אחרי הציור');
ok(/if \(rd && !rd\.armed && !CW_OK\) \{ rd\.armed = 1; readerArm\(box\); \}/.test(lib), 'העמוד הראשון צויר → רשומת הקורא (צילום השומר = הקורא)');
ok(/const uaT = !!\(e && e\.hasUAVisualTransition\);/.test(pop), '"חזור" ש־Chrome כבר הנפיש מזוהה (hasUAVisualTransition)');
ok(/closeReader\(\{ instant: uaT \}\)/.test(pop) && /readerExit\(uaT\)/.test(pop) && /navigateTo\(uaT \? 'none' : 'pop'/.test(pop) && /closeLibrary\(uaT\)/.test(pop), 'אחרי אנימציה של Chrome — בלי אנימציה שנייה (קורא, דף, ספרייה)');
ok(/if \(!instant\) box\.classList\.add\('out'\);/.test(cr) && /const gone = instant \|\|/.test(cr), 'סגירה מיידית של הקורא — בלי דהייה');
ok(/if \(instant === true \|\| reduceMotion\(\)\) \{ r\.remove\(\); return; \}/.test(cl), 'סגירה מיידית של הספרייה');
ok(/closeLibrary\(uaT\); appToOverview\(\);/.test(pop) && /function appToOverview\(\)[\s\S]{0,200}switchTab\('overview'\)/.test(lib), '"חזור" מהספרייה — לסקירה');
ok(/navCurDepth\(\) === 0 && currentTabName\(\) !== 'overview'\) switchTab\('overview'\)/.test(app), 'פתיחה מטאב ראשי — הסקירה כבר מתחת לספרייה (גם בצילום של Chrome)');
console.log(n + ' בדיקות עברו');
// v351: משיכה מצד שמאל (Chrome מציג צילום) — הצילום של השומר רק כשהקורא מוצג במלואו
{
  const lib2 = require('fs').readFileSync(require('path').join(__dirname, '..', 'library.js'), 'utf8');
  const i = lib2.indexOf('function readerArm('), arm = lib2.slice(i, lib2.indexOf('\n}\n', i));
  if (!(/box\.classList\.contains\('loading'\)/.test(arm) && /getAnimations/.test(arm) && /READER_ARM_SETTLE_MS/.test(arm) && /READER_ARM_SETTLE_MS = 350/.test(lib2))) { console.error('FAIL - v351 readerArm'); process.exit(1); }
  console.log('ok - v351: רשומת הקורא אחרי סוף הטעינה + אנימציית הכניסה + מרווח (צילום השומר = קורא מלא)');
}
