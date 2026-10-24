// Studio Lab (24/10/2026, "תרגום סרטונים בטלפון" — שלב 0): כלי המדידה בטלפון.
// השומרים: אותם מודלים ואותה גרסת ONNX Runtime של השרת, רשת רק להורדת המודלים, ובלי לפרסם את MMS_FA (CC-BY-NC).
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const R = (f) => fs.readFileSync(path.join(root, f), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('ok - ' + m); } else { fail++; console.log('FAIL - ' + m); } };

const P = 'android/app/src/';
const files = [];
const walk = (d) => { for (const f of fs.readdirSync(path.join(root, d))) { const p = d + '/' + f; fs.statSync(path.join(root, p)).isDirectory() ? walk(p) : p.endsWith('.kt') && files.push(p); } };
walk(P + 'lab'); walk(P + 'labcore');
const all = files.map(R).join('\n');

// ---------- אותה גרסת ONNX Runtime של העובד בשרת
const lock = R('infra/worker/requirements.lock');
const srvOrt = (lock.match(/^onnxruntime==([\d.]+)/m) || [])[1];
const gr = R('android/app/build.gradle.kts');
const labOrt = (gr.match(/onnxruntime-android:([\d.]+)"/) || [])[1];
ok(srvOrt && srvOrt === labOrt, `ONNX Runtime בטלפון = בשרת (${labOrt} / ${srvOrt})`);
ok(/app\("lab", "app\.thesnowball\.lab", "Studio Lab"/.test(gr) && /getByName\("lab"\)\.java\.srcDirs\("src\/lite\/java", "src\/labcore\/java"\)/.test(gr), 'גרסה נפרדת (APK משלה), הליבה ב־labcore');

// ---------- רשת: רק להורדת המודלים (Hugging Face והגרפים שלנו ב־Release), אף פעם לא השרת שלנו
const urls = [...all.matchAll(/"(https?:\/\/[^"$]+)/g)].map((m) => m[1]);
ok(urls.length > 0 && urls.every((u) => u.startsWith('https://huggingface.co/istupakov/parakeet-tdt-0.6b-v2-onnx/') || u.startsWith('https://github.com/yishaiguedj1/portfolio-pwa/releases/download/lab-models/')),
  'רק Hugging Face (Parakeet) וה־Release ‏lab-models: ' + urls.join(', '));
ok(!/thesnowball\.app|ibkr-proxy|api\/studio/.test(all), 'בלי השרת שלנו');
ok(!/HttpURLConnection/.test(files.filter((f) => !/LabModels\.kt$/.test(f)).map(R).join('\n')), 'פנייה לרשת רק ב־LabModels (ההורדה)');

// ---------- המודלים: טביעות קבועות ל־Parakeet, ול־Qwen — מה־manifest של התמונה
const lm = R(P + 'lab/java/io/github/yishaiguedj1/snowball/lab/LabModels.kt');
for (const f of ['config.json', 'vocab.txt', 'nemo128.onnx', 'decoder_joint-model.int8.onnx', 'encoder-model.int8.onnx'])
  ok(new RegExp('F\\("' + f.replace(/\./g, '\\.') + '", HF \\+ "' + f.replace(/\./g, '\\.') + '", "[0-9a-f]{64}", \\d+\\)').test(lm), 'Parakeet: ' + f + ' עם sha256 וגודל');
ok(/sha\(part\) != f\.sha/.test(lm) && /getJSONObject\("sha256"\)/.test(lm), 'כל קובץ נבדק מול הטביעה לפני שהוא נכנס למקומו');
const asr = R('translator/vt/asr_parakeet.py');
ok(/MODEL = "nemo-parakeet-tdt-0\.6b-v2"/.test(asr) && /quantization: str \| None = "int8"/.test(asr), 'אותו מודל ואותה קוונטיזציה של השרת (int8)');

// ---------- ה־Release: בלי MMS_FA (‏CC-BY-NC) ועם בדיקת טביעה
const wf = R('.github/workflows/lab-models.yml');
ok(/gh release upload lab-models manifest\.json audio-conv\.onnx audio-encoder\.onnx text-decoder\.onnx embed\.npy pos\.npy --clobber/.test(wf) && !/ctc\.onnx[^\n]*--clobber/.test(wf), 'lab-models: רק גרפי Qwen — לא ctc.onnx');
ok(/sha256sum/.test(wf) && /\.sha256\[\$f\]/.test(wf), 'lab-models: כל קובץ נבדק מול ה־manifest לפני העלאה');
ok(!/uses:/.test(wf) && /permissions:\s*\n\s*contents: write/.test(wf), 'lab-models: בלי actions חיצוניים, הרשאה מינימלית');
const al = R(P + 'lab/java/io/github/yishaiguedj1/snowball/lab/LabModels.kt');
ok(/ALIGN_FILES = listOf\("audio-conv\.onnx", "audio-encoder\.onnx", "text-decoder\.onnx", "embed\.npy", "pos\.npy"\)/.test(al), 'Studio Lab מוריד בדיוק את מה שהועלה');

// ---------- הנכסים: מעבד המל (onnx_asr, MIT) עם הרישיון, והגופן של הכתוביות
ok(fs.existsSync(path.join(root, P + 'lab/assets/whisper128.onnx')) && /MIT License/.test(R(P + 'lab/assets/LICENSE-onnx-asr.txt')), 'whisper128.onnx עם רישיון MIT');
ok(fs.readFileSync(path.join(root, P + 'lab/assets/Assistant-SemiBold.ttf')).equals(fs.readFileSync(path.join(root, 'translator/fonts/Assistant-SemiBold.ttf'))), 'הגופן = הגופן של הכתוביות בשרת');

// ---------- CI: נבנה, נבדק (JVM) ומתפרסם
const aw = R('.github/workflows/android.yml');
ok(/testLabReleaseUnitTest/.test(aw) && /app-lab-release\.apk the-snowball-lab\.apk/.test(aw), 'android.yml: בדיקות הליבה וה־APK');

console.log(`\n${pass} עברו, ${fail} נכשלו`);
process.exit(fail ? 1 : 0);
