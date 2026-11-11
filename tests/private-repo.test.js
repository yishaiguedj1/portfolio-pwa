// 11/11/2026 — הכנה להפיכת הריפו לפרטי (docs/private-repo-plan.md), גלים 1–2:
// כל הורדה ציבורית (APK, תוסף Chrome, מודלי Lab, fund-audit) מתפרסמת גם ב־R2 (https://dl.thesnowball.app) והצרכנים קוראים משם קודם,
// עם Releases כגיבוי; כל קריאה של השרתון ל־GitHub (API / raw) נושאת GITHUB_TOKEN כשמוגדר.
const fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os');
const root = path.join(__dirname, '..');
const R = (f) => fs.readFileSync(path.join(root, f), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('ok - ' + m); } else { fail++; console.log('FAIL - ' + m); } };

// ---------- tools/dl-put.sh: בלי מפתחות — אזהרה ויציאה 0 (Releases עדיין גיבוי); DL_REQUIRED=1 — כשל
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dlput-'));
fs.writeFileSync(path.join(tmp, 'a.json'), '{}');
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(DL_|CLOUDFLARE_ACCOUNT_ID$)/.test(k)));
const run = (args, extra = {}) => cp.spawnSync('bash', [path.join(root, 'tools/dl-put.sh'), ...args], { cwd: tmp, env: { ...env, ...extra }, encoding: 'utf8' });
let r = run(['android-latest', 'a.json']);
ok(r.status === 0 && /::warning::/.test(r.stdout), 'dl-put בלי מפתחות: אזהרה, יציאה 0');
r = run(['android-latest', 'a.json'], { DL_REQUIRED: '1' });
ok(r.status === 1 && /::error::/.test(r.stdout), 'dl-put עם DL_REQUIRED=1 בלי מפתחות: כשל');
ok(run(['Bad/../x', 'a.json']).status === 2, 'dl-put: שם תיקייה לא תקין נדחה');
ok(run([]).status === 2, 'dl-put: בלי ארגומנטים — שגיאת שימוש');
fs.rmSync(tmp, { recursive: true, force: true });
const sh = R('tools/dl-put.sh');
ok(/AWS_REQUEST_CHECKSUM_CALCULATION=when_required/.test(sh) && /snb-dl/.test(sh) && /https:\/\/dl\.thesnowball\.app\/\$dir\/\$n/.test(sh), 'dl-put: R2 (S3), הדלי snb-dl, אימות חי בכתובת הציבורית');
ok(!/set -x/.test(sh) && !/echo[^\n]*SECRET/.test(sh), 'dl-put: לא מדפיס מפתחות');

// ---------- הזרימות מעלות ל־R2 אחרי Releases (latest.json אחרון)
const wf = (f) => R('.github/workflows/' + f);
const and = wf('android.yml');
ok(/bash tools\/dl-put\.sh android-latest the-snowball\*\.apk studio-browser-chrome\.zip latest\.json/.test(and)
  && and.indexOf('Mirror (dl.thesnowball.app)') > and.indexOf('gh release upload android-latest latest.json'), 'android: APK + תוסף + latest.json (אחרון) ל־R2, אחרי Releases');
ok(/bash tools\/dl-put\.sh fund-audit "\$RUNNER_TEMP\/fa\/summary\.json"/.test(wf('fund-audit.yml')), 'fund-audit: הסיכום ל־R2 (job נפרד)');
const lab = wf('lab-models.yml');
ok(/dl-put\.sh" lab-models manifest\.json audio-conv\.onnx audio-encoder\.onnx text-decoder\.onnx embed\.npy pos\.npy/.test(lab) && /contents\/tools\/dl-put\.sh\?ref=\$GITHUB_SHA/.test(lab), 'lab-models: המודלים ל־R2 (הסקריפט מה־API, עובד בפרטי)');
for (const f of ['android.yml', 'fund-audit.yml', 'lab-models.yml'])
  ok(/DL_R2_ACCESS_KEY_ID: \$\{\{ secrets\.DL_R2_ACCESS_KEY_ID \}\}/.test(wf(f)) && /CLOUDFLARE_ACCOUNT_ID: \$\{\{ vars\.CLOUDFLARE_ACCOUNT_ID \}\}/.test(wf(f)), f + ': המפתחות מ־Secrets');

// ---------- הצרכנים: R2 קודם, Releases גיבוי
const U = R('android/app/src/main/java/io/github/yishaiguedj1/snowball/upd/Upd.kt');
ok(/const val BASE = "https:\/\/dl\.thesnowball\.app\/android-latest\/"/.test(U) && /val BASES = listOf\(BASE, BASE_GH\)/.test(U), 'העדכון העצמי: R2 ראשון, GitHub גיבוי');
ok(/putString\("base", from\)/.test(U) && /URL\(base\(c\) \+ r\.file\)/.test(U) && /takeIf \{ it in BASES \}/.test(U), 'העדכון העצמי: ההורדה מאותו מקור של latest.json (רק מהרשימה)');
const PM = R('android/app/src/studio/java/io/github/yishaiguedj1/snowball/PhModels.kt');
ok(/DL = "https:\/\/dl\.thesnowball\.app\/lab-models\/"/.test(PM) && /listOf\(DL \+ url\.removePrefix\(GH\), url\)/.test(PM), 'מודלי Lab: R2 ראשון, GitHub גיבוי (הטביעה מאמתת)');
const FA = require('../ibkr-proxy/lib/fundaudit.js');
ok(FA.SRCS[0] === 'https://dl.thesnowball.app/fund-audit/' && FA.SRCS[1] === FA.REL, 'fund-audit: R2 ראשון, Releases גיבוי');
const st = R('ibkr-proxy/api/studio.js');
ok(/for \(const b of FAU\.SRCS\)/.test(st) && !/FAU\.REL \+/.test(st), 'השרתון קורא את fund-audit דרך SRCS');

// ---------- השרתון: כל קריאה ל־GitHub עם הטוקן
const calls = [...st.matchAll(/fetch\)\('https:\/\/(api\.github\.com|raw\.githubusercontent\.com)[^\n]*\n?[^\n]*/g)].map((m) => m[0]);
ok(calls.length >= 2 && calls.every((c) => /ghHdr\(/.test(c)), 'studio.js: כל fetch ישיר ל־GitHub עובר ב־ghHdr (' + calls.length + ')');
ok(/const ghHdr = \(h\) => \(process\.env\.GITHUB_TOKEN \?/.test(st) && /const h = ghHdr\(/.test(st), 'aoJson ו־ghHdr: Authorization מ־GITHUB_TOKEN');
const ib = R('ibkr-proxy/ignore-build.sh');
ok(/process\.env\.GITHUB_TOKEN \? \{ Authorization: "Bearer " \+ process\.env\.GITHUB_TOKEN \}/.test(ib), 'ignore-build: compare עם הטוקן כשמוגדר');

console.log(`---- ${pass} עברו, ${fail} נכשלו ----`);
process.exit(fail ? 1 : 0);
