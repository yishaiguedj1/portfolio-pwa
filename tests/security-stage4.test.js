// שלב 4 (אבטחה) — שומרים שהתיקונים לא נעלמים בשינוי עתידי. הבדיקות ההתנהגותיות: השרתון (ibkr-proxy/tests/run.js —
// כריכות, אבחון, PKCE), tests/pkce.test.js, firestore/rules.test.mjs (אמולטור), ובדיקת WidgetValidate עם kotlinc.
// הרצה: node tests/security-stage4.test.js
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

const idx = read('index.html');
const firstScript = idx.slice(idx.indexOf('<script>'), idx.indexOf('</script>'));
ok(/if\(self!==top\)\{try\{top\.location\.replace\(self\.location\.href\);\}catch\(e\)\{\}document\.documentElement\.style\.display='none';\}/.test(firstScript),
  'clickjacking: האפליקציה לא מוצגת בתוך מסגרת של אתר זר (בסקריפט הראשון, לפני כל ציור)');
ok(/if \(self !== top\) \{ document\.documentElement\.style\.display = 'none'; return; \}/.test(read('oauth.js')), 'clickjacking: גם עמוד החזרה מ־Google');
const bm = read('ibkr-proxy/api/bookmeta.js');
ok(/await f\(cur, \{ redirect: 'manual'/.test(bm) && !/await f\([a-z]+, \{ redirect: 'follow'/.test(bm), 'SSRF: כריכות — הפניות ידניות, כל יעד נבדק לפני הבקשה');
ok(/diag: publicDiag\(diag\)/.test(read('ibkr-proxy/api/translate.js')), 'אבחון התרגום בתשובה — רק קודים ומספרים');
ok(/code_challenge_method', 'S256'/.test(read('libbackup.js')) && /code_verifier: verifier/.test(read('ibkr-proxy/lib/gdrive.js')), 'PKCE בחיבור ל־Drive');
const wd = read('android/app/src/main/java/io/github/yishaiguedj1/snowball/WidgetData.kt');
ok(/WidgetValidate\.items\(s\)/.test(wd) && /WidgetValidate\.list\(/.test(wd), 'ווידג׳ט: מה שמגיע מבחוץ נבדק בצורה המדויקת (WidgetValidate)');
ok(/android:allowBackup="false"/.test(read('android/app/src/main/AndroidManifest.xml')), 'אנדרואיד: בלי גיבוי אוטומטי של נתוני האפליקציה');
const aw = read('.github/workflows/android.yml');
ok(/pull_request:/.test(aw) && /if: github\.event_name != 'pull_request' && steps\.ks\.outputs\.signed == 'true'/.test(aw) && /persist-credentials: false/.test(aw),
  'אנדרואיד ב־CI: נבנה גם ב־PR, בלי מפתח ובלי פרסום; בלי טוקן כתיבה שמור');
ok(fs.existsSync(path.join(root, '.github/dependabot.yml')) && /security-extended/.test(read('.github/workflows/codeql.yml')), 'Dependabot ו־CodeQL');
const rules = read('firestore/firestore.rules');
ok(/match \/users\/\{uid\}/.test(rules) && /match \/\{document=\*\*\} \{\s*allow read, write: if false;/.test(rules), 'Firestore: רק המסמך של המשתמש; כל השאר סגור');
for (const f of fs.readdirSync(path.join(root, '.github/workflows'))) {
  const w = read('.github/workflows/' + f);
  for (const u of w.match(/uses:\s*\S+/g) || []) ok(/@[0-9a-f]{40}$/.test(u.split(/\s+/)[1]), 'action נעול ל־SHA: ' + f + ' · ' + u.split(/\s+/)[1].split('@')[0]);
}
console.log('# ' + n + ' בדיקות עברו');
