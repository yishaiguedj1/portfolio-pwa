// v359: סטודיו התרגום, שלב 3 סבב ב — עלות וטוקנים לכל עבודה, ותיקונים מההרצה האמיתית (torch של CPU, רשימת מודולים אחת,
// דומיינים באשף, בלי התראות). הבדיקות המלאות של usage() — ב־Python (translator/tests/test_worker.py).
// הרצה: node tests/studio-v359.test.js
const fs = require('fs');
const path = require('path');
const { swVersionOk } = require('./_swver');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

(async () => {
  /* ---------- 1. העובד: usage() ---------- */
  const job = read('translator/job.py');
  ok(/def usage\(root=None\)/.test(job) && /rglob\('\*\.jsonl'\)/.test(job) && /'subagents' in p\.parts/.test(job), 'job.py: usage() קורא את יומני הסשן, subagents/ = סוכן־משנה');
  ok(/calls\[m\['id'\]\] = m/.test(job), 'job.py: לכל message.id — רק הרשומה האחרונה');
  ok(/'TRANSLATE\.md' in prompt/.test(job) && /'REVIEW\.md' in prompt/.test(job), 'job.py: תרגום/ביקורת לפי ההנחיה הראשונה');
  ok(/'claude-opus-5-5': \(4\.0, 20\.0, 0\.20\)/.test(job) && /'claude-sonnet-5-5': \(2\.0, 10\.0, 0\.20\)/.test(job) && /'claude-haiku-4-5': \(1\.0, 5\.0, 0\.10\)/.test(job)
    && /c5 \* p\[0\] \* 1\.25 \+ c1 \* p\[0\] \* 2/.test(job), 'job.py: המחירון (קלט/פלט/מטמון; כתיבה ×1.25 ל־5 דק׳, ×2 לשעה)');
  ok(/fail=True, err=err, msg=args\.msg, force=True, usage=usage_safe\(\)/.test(job) && /done=True, out=out, [^\n]*usage=usage_safe\(\)/.test(job), 'job.py: finish וגם fail שולחים usage בדיווח האחרון');

  /* ---------- 2. השרתון ---------- */
  const lib = read('ibkr-proxy/lib/studio.js'), api = read('ibkr-proxy/api/studio.js');
  const S = require(path.join(root, 'ibkr-proxy/lib/studio.js'));
  const row = { k: 'tl', m: 'claude-opus-5-5', n: 3, i: 1, o: 2, cr: 3, c5: 4, c1: 5, usd: 1.23456, op: 4, oc: 0.5 };
  ok(S.normUsage([row])[0].usd === 1.2346 && S.normUsage([Object.assign({}, row, { m: 'claude-x"><img' })]) === null
    && S.normUsage(Array(7).fill(row)) === null && S.normUsage([Object.assign({}, row, { n: '3' })]) === null, 'השרתון: normUsage — עד 6 שורות, מספרים בלבד, מודל claude-[a-z0-9-]+');
  ok(/'use'\]/.test(lib) && /use: Array\.isArray\(job\.use\)/.test(lib), 'השרתון: נשמר בעבודה (JSON) ומוחזר ב־publicJob');
  ok(/S\.normUsage\(body\.usage\)/.test(api) && /use: null, updated: now/.test(api), 'השרתון: מהדיווח של העובד; הפעלה חוזרת מאפסת');

  /* ---------- 3. הטלפון ---------- */
  const st = read('studio.js');
  const M = await import(path.join(root, 'studio.js'));
  ok(M.modelLabel('claude-opus-5-5') === 'Opus 5.5' && M.modelLabel('claude-haiku-4-5') === 'Haiku 4.5' && M.fmtTok(1234567) === '1.2M' && M.fmtTok(85000) === '85K'
    && M.fmtUsd(2) === '$2.00' && M.fmtUsd(0.004) === '<$0.01', 'טלפון: שם מודל, טוקנים ודולרים');
  const USE = [
    { k: 'main', m: 'claude-sonnet-5-5', n: 40, i: 100, o: 9000, cr: 2400000, c5: 0, c1: 60000, usd: 0.71 },
    { k: 'tl', m: 'claude-opus-5-5', n: 12, i: 30, o: 52000, cr: 900000, c5: 130000, c1: 0, usd: 2.0, op: 126000, oc: 0.63 },
    { k: 'rv', m: 'claude-sonnet-5-5', n: 6, i: 10, o: 8000, cr: 400000, c5: 128000, c1: 0, usd: 0.5, op: 128000, oc: 0.32 },
  ];
  const cv = M.costView(USE, 'opus-medium');
  ok(cv.rows.length === 3 && Math.abs(cv.total - 3.21) < 1e-9 && !cv.partial, 'טלפון: שורה לכל שלב וסכום כולל');
  ok(cv.rows[0].open === null && cv.rows[1].open.usd === 0.63 && cv.rows[1].open.tok === 126000, 'טלפון: עלות הפתיחה — רק לסוכני־המשנה');
  ok(cv.warn.length === 1 && cv.warn[0].k === 'rv' && cv.warn[0].model === 'Sonnet 5.5' && cv.want === 'Opus 5.5', 'טלפון: אזהרה — הביקורת רצה על מודל אחר מהמצב שנבחר');
  ok(M.costView(USE, 'sonnet-high').warn.map((w) => w.k).join() === 'tl', 'טלפון: במצב Sonnet — אזהרה על תרגום ב־Opus (התיאום לא נבדק)');
  const cv2 = M.costView(USE.concat({ k: 'tl', m: 'claude-haiku-5-5', n: 1, i: 1, o: 1, cr: 0, c5: 10, c1: 0, usd: null, op: 10, oc: null }), 'opus-medium');
  ok(cv2.partial && cv2.rows[1].nth === 1 && cv2.rows[3].nth === 2 && cv2.rows[0].nth === 0 && cv2.rows[3].usd === null, 'טלפון: מודל בלי מחירון — "+" בסכום; שני מתרגמים ממוספרים');
  ok(M.costView(null, 'opus-medium') === null && M.costView([{ k: 'main', m: 'gpt-4' }], 'opus-medium') === null, 'טלפון: בלי נתונים / נתון זר — בלי כרטיס');
  ok(M.normJob({ id: 'jAbCdEfGhIjKlMnOpQrSt', spec: {}, srv: { state: 'done', use: USE } }).srv.use.length === 3, 'טלפון: normJob שומר את העלות מהשרתון');
  ok(/if \(cv\) p\.append\(\.\.\.costCard\(cv\)\)/.test(st) && /studioCostNote/.test(st) && /rec\.srv && rec\.srv\.use \? 'u' : ''/.test(st), 'טלפון: כרטיס "עלות" בדף העבודה (וציור מחדש כשהנתון מגיע)');
  const app = read('app.js');
  ok(/studioCostNote: "לפי מחירון ה־API — במנוי זה נספר במכסת השימוש ולא מחויב לפי טוקן"/.test(app) && /studioCostNote: "At API prices/.test(app), 'טלפון: ההערה על המנוי — עברית ואנגלית');

  /* ---------- 4. תיקונים מההרצה האמיתית ---------- */
  const sh = read('translator/setup.sh');
  ok(/^SNB_MODULES="numpy soundfile onnx_asr torch torchaudio qwen_asr"$/m.test(sh) && /def engine_modules\(\)/.test(job) && /SNB_MODULES=/.test(job), 'רשימת מודולים אחת — ב־setup.sh, ו־job.py קורא אותה');
  ok(!/import numpy, soundfile/.test(sh + job), 'בלי רשימה כפולה');
  const iTorch = sh.indexOf('torch torchaudio --index-url https://download.pytorch.org/whl/cpu'), iQwen = sh.indexOf('install -q qwen-asr');
  ok(iTorch > 0 && iQwen > iTorch && /if "\$VENV\/bin\/pip" install -q torch torchaudio/.test(sh), 'setup.sh: torch ו־torchaudio מאינדקס ה־CPU לפני qwen-asr (ו־qwen-asr רק אם הצליח)');
  ok(/>>"\$LOG" 2>&1/.test(sh) && !/pip" install[^\n]*>\/dev\/null/.test(sh) && /setup\.log/.test(sh), 'setup.sh: פלט pip נשמר ב־setup.log');
  ok(/חסרים: ' \+ ', '\.join\(miss\)/.test(job), 'job.py: הודעת השגיאה אומרת איזה מודול חסר');
  const hosts = (st.match(/const HOSTS_EXTRA = \[([^\]]*)\]/) || [])[1] || '';
  ok(['*.pytorch.org', 'github.com', '*.githubusercontent.com', 'dl.fbaipublicfiles.com', 'huggingface.co'].every((x) => hosts.includes("'" + x + "'")), 'האשף: הדומיינים לסביבה "סטודיו"');
  const rb = read('translator/RUNBOOK.md');
  ok(/בלי התראות ובלי בדיקות חוזרות מתוזמנות/.test(rb.slice(0, 600)) && /PushNotification/.test(rb) && /send_later/.test(rb), 'RUNBOOK: הכלל בראש המסמך ובפירוט');
  ok(/'PushNotification', 'CronCreate', 'ScheduleWakeup'/.test(sh), 'setup.sh: deny לכלי ההתראות והתזמון בסביבה');

  /* ---------- 5. גרסה ---------- */
  const ver = (app.match(/const APP_VERSION = '(v\d+)'/) || [])[1];
  ok(+String(ver).slice(1) >= 359, 'APP_VERSION ≥ v359');
  ok(swVersionOk(ver), 'sw.js תואם (שווה או גרסה אחת אחורה בשלב התוכן)');
  console.log('# ' + n + ' בדיקות עברו');
})().catch((e) => { console.error('FAIL -', e && e.stack || e); process.exit(1); });
