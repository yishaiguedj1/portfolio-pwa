// הליבה labcore + ה־Release ‏lab-models (24/10/2026; האפליקציה Studio Lab — כלי המדידה של שלב 0 — נמחקה 27/10/2026).
// labcore = ONNX Runtime ו־Parakeet של התרגום בטלפון ב־Studio; lab-models = גרפי Qwen ש־PhModels מוריד.
// השומרים: אותה גרסת ONNX Runtime של השרת, הליבה בלי רשת, ובלי לפרסם את MMS_FA (CC-BY-NC).
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const R = (f) => fs.readFileSync(path.join(root, f), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('ok - ' + m); } else { fail++; console.log('FAIL - ' + m); } };

const P = 'android/app/src/';
const files = [];
const walk = (d) => { for (const f of fs.readdirSync(path.join(root, d))) { const p = d + '/' + f; fs.statSync(path.join(root, p)).isDirectory() ? walk(p) : p.endsWith('.kt') && files.push(p); } };
walk(P + 'labcore');
const all = files.map(R).join('\n');
const gr = R('android/app/build.gradle.kts');

// ---------- אותה גרסת ONNX Runtime של העובד בשרת
const srvOrt = (R('infra/worker/requirements.lock').match(/^onnxruntime==([\d.]+)/m) || [])[1];
const orts = [...gr.matchAll(/onnxruntime-android:([\d.]+)"/g)].map((m) => m[1]);
ok(srvOrt && orts.length > 0 && orts.every((v) => v === srvOrt), `ONNX Runtime בטלפון = בשרת (${orts.join(', ')} / ${srvOrt})`);

// ---------- האפליקציה נמחקה; הליבה ב־Studio ונבדקת שם
ok(!/app\("lab"/.test(gr) && !/labImplementation|getByName\("lab"\)|testLab/.test(gr) && !fs.existsSync(path.join(root, P + 'lab')), 'Studio Lab כבר לא נבנית');
ok(/getByName\("studio"\)\.java\.srcDirs\([^)]*"src\/labcore\/java"/.test(gr), 'labcore נבנית בתוך Studio');
ok(fs.existsSync(path.join(root, P + 'testStudio/java/io/github/yishaiguedj1/snowball/lab/LabCoreTest.kt')), 'בדיקות הליבה (JVM) עברו ל־testStudio');
const aw = R('.github/workflows/android.yml');
ok(/testStudioReleaseUnitTest/.test(aw) && !/testLabReleaseUnitTest|app-lab-release/.test(aw) && /delete-asset android-latest the-snowball-lab\.apk/.test(aw), 'android.yml: בלי ה־APK, והקובץ הישן יורד מהקישור הקבוע');

// ---------- הליבה בלי רשת ובלי השרת שלנו
ok(!/HttpURLConnection|https?:\/\//.test(all), 'labcore בלי פנייה לרשת');

// ---------- ה־Release: בלי MMS_FA (‏CC-BY-NC), עם בדיקת טביעה, ו־Studio מוריד בדיוק את מה שהועלה
const wf = R('.github/workflows/lab-models.yml');
ok(/gh release upload lab-models manifest\.json audio-conv\.onnx audio-encoder\.onnx text-decoder\.onnx embed\.npy pos\.npy --clobber/.test(wf) && !/ctc\.onnx[^\n]*--clobber/.test(wf), 'lab-models: רק גרפי Qwen — לא ctc.onnx');
ok(/sha256sum/.test(wf) && /\.sha256\[\$f\]/.test(wf), 'lab-models: כל קובץ נבדק מול ה־manifest לפני העלאה');
ok(!/uses:/.test(wf) && /permissions:\s*\n\s*contents: write/.test(wf), 'lab-models: בלי actions חיצוניים, הרשאה מינימלית');
const pm = R(P + 'studio/java/io/github/yishaiguedj1/snowball/PhModels.kt');
const fromGh = [...pm.matchAll(/GH \+ "([^"]+)"/g)].map((m) => m[1]).sort().join(' ');
ok(fromGh === 'audio-conv.onnx audio-encoder.onnx embed.npy pos.npy text-decoder.onnx', 'PhModels מוריד מ־lab-models בדיוק את גרפי Qwen: ' + fromGh);

console.log(`\n${pass} עברו, ${fail} נכשלו`);
process.exit(fail ? 1 : 0);
