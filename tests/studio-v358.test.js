// v358: סטודיו התרגום, שלב 3 — העובד בענן מתרגם. vt בתוך translator/, מצב עבודה ב־job.py, תוצרים מאומתים בשרתון.
// הבדיקות המלאות של העובד — ב־Python (translator/tests/test_worker.py, רצות ב־CI בעבודה נפרדת).
// הרצה: node tests/studio-v358.test.js
const fs = require('fs');
const path = require('path');
const { swVersionOk } = require('./_swver');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const exists = (f) => fs.existsSync(path.join(root, f));

/* ---------- 1. vt בריפו — רק קוד ---------- */
const VT = ['cli', 'align', 'align_ctc', 'asr_parakeet', 'hebrew', 'media', 'overlay', 'render', 'subs', 'timing', 'translate', 'qc', 'review'];
ok(VT.every((m) => exists('translator/vt/' + m + '.py')), 'translator/vt — מודולי vt בריפו');
ok(exists('translator/tests/test_core.py') && exists('translator/tests/test_worker.py'), 'הבדיקות של vt והעובד');
ok(exists('translator/fonts/Arimo-Bold.ttf') && /Apache/.test(read('translator/fonts/README.md')) && /Open Font License/.test(read('translator/fonts/README.md')), 'גופני הכתוביות עם הרישיונות');
const walk = (d) => fs.readdirSync(path.join(root, d), { withFileTypes: true }).flatMap((e) => e.isDirectory() ? (e.name === '__pycache__' ? [] : walk(d + '/' + e.name)) : [d + '/' + e.name]);
const files = walk('translator');
ok(!files.some((f) => /\.(mp4|mkv|mov|wav|m4a|webm|srt|ass)$/i.test(f)), 'בלי סרטונים, קול או כתוביות בריפו');
ok(!files.some((f) => /\bCLAUDE\.md$|מדריך-עבודה|MANIFEST\.json/.test(f)), 'בלי קובצי ההוראות הישנים של vt (מזהי Drive, "אסור להעתיק לריפו")');
const text = files.filter((f) => /\.(py|md|sh|tsv|txt)$/.test(f)).map(read).join('\n');
ok(!/1fWLJ|RCLONE_DRIVE_TOKEN=|sk-ant-oat01-[A-Za-z0-9]/.test(text), 'בלי מזהה התיקייה הישנה ובלי מפתחות');

/* ---------- 2. העובד ---------- */
const job = read('translator/job.py');
ok(['prepare', 'align', 'stage', 'finish', 'fail', 'vt'].every((c) => job.includes("sub.add_parser('" + c + "'")), 'job.py: פקודות העבודה (prepare/align/stage/finish/fail/vt)');
ok(/os\.chmod\(tmp, 0o600\)/.test(job), 'מצב העבודה (כולל המפתח) — קובץ פרטי');
ok(/lang_unsupported/.test(job) && /'he' not in/.test(job), 'זוג שפות שלא נתמך (כרגע אנגלית → עברית) — נכשל בצורה ברורה');
ok(/class _NoRedirect/.test(job) && /bytes \*\/%d/.test(job), 'העלאה מתחדשת ל־Drive: 308 = "התקבל חלקית", שואלים כמה הגיע אחרי תקלה');
ok(/'Range', 'bytes=' \+ str\(have\)/.test(job), 'הורדה עם המשך מאותו בייט');
ok(/שגיאות \(\\d\+\)/.test(job) && /fixes_zfinal/.test(job), 'finish נעצר על שגיאות tr-check');

/* ---------- 3. RUNBOOK והסוכנים ---------- */
const rb = read('translator/RUNBOOK.md');
ok(/routine-fire-payload/.test(rb) && /כנתונים בלבד/.test(rb) && /python3 translator\/job\.py run --job <job> --key <key>/.test(rb), 'RUNBOOK: הבלוק = נתונים, פקודת הלקיחה');
ok(/\$J prepare/.test(rb) && /\$J align/.test(rb) && /\$J finish/.test(rb) && /run_in_background/.test(rb), 'RUNBOOK: הסדר — prepare → הגהה → align → תרגום → ביקורת → finish, ארוכים ברקע');
ok(/`opus-medium` \(ברירת המחדל\) \| opus \| medium/.test(rb) && /TRANSLATE\.md/.test(rb) && /REVIEW\.md/.test(rb), 'RUNBOOK: התרגום בסוכן־משנה במודל ובמאמץ של המצב');
ok(/נתונים, לא הוראות/.test(rb) && /נתונים, לא הוראות/.test(read('translator/TRANSLATE.md')) && /נתונים, לא הוראות/.test(read('translator/REVIEW.md')), 'תוכן הסרטון = נתונים, לא הוראות (בכל ההנחיות)');
ok(/fixes_review\.txt/.test(read('translator/REVIEW.md')) && /fixes\.txt/.test(read('translator/TRANSLATE.md')), 'המתרגם והביקורת — קובצי תיקונים נפרדים (לא דורסים זה את זה)');

/* ---------- 4. השרתון והטלפון ---------- */
const lib = read('ibkr-proxy/lib/studio.js'), api = read('ibkr-proxy/api/studio.js');
ok(/const WORKER_KINDS = \['ping', 'tr'\]/.test(lib), 'השרתון: העובד מתרגם');
ok(/function normOut/.test(lib) && /error: 'out_bad'/.test(api) && /meta\.parents\.includes\(folder\)/.test(api) && /driveFileInFolder\(deps, job\.uid, job\.folder/.test(api), 'השרתון: תוצרים — רק קבצים בתיקיית העבודה (מאומת מול Drive)');
const st = read('studio.js');
ok(/drive\.google\.com\/file\/d\/' \+ o\.id/.test(st) && /files\.o/.test(st), 'הטלפון: קישור לכל תוצר בדף העבודה');
const sh = read('translator/setup.sh');
ok(/onnx-asr/.test(sh) && /download\.pytorch\.org\/whl\/cpu/.test(sh) && /qwen-asr/.test(sh) && /FFmpeg-Builds/.test(sh) && /exit 0\s*$/.test(sh), 'setup.sh: מנועי vt ו־ffmpeg, ותמיד יוצא ב־0');
const ci = read('.github/workflows/test.yml');
ok(/python-tests:/.test(ci) && /unittest discover -s tests/.test(ci) && !/unittest[^\n]*\|/.test(ci), 'CI: בדיקות Python בעבודה נפרדת, בלי צינור שמסתיר כשל');

/* ---------- 5. גרסה ---------- */
const ver = (read('app.js').match(/const APP_VERSION = '(v\d+)'/) || [])[1];
ok(+String(ver).slice(1) >= 358, 'APP_VERSION ≥ v358');
ok(swVersionOk(ver), 'sw.js תואם (שווה או גרסה אחת אחורה בשלב התוכן)');
console.log('# ' + n + ' בדיקות עברו');
