// vercel-backup.test.js — 5/11/2026 (ת3 שלב 4 בתוכנית השרת המאוחד): Vercel רק גיבוי. כל מי שפנה ישר ל־Vercel
// (העובד כל 20 שנ׳, שני הווידג'טים כל 15 דק׳, שני הקרונים היומיים) פונה קודם לשרתון שלנו, ו־Vercel רק כשהוא לא עונה.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
let n = 0;
function ok(cond, name) { n++; if (!cond) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const OURS = 'https://api.thesnowball.app', VERCEL = 'https://ibkr-proxy-wine.vercel.app';

// העובד
const job = read('translator/job.py');
ok(job.includes("SERVER = '" + OURS + "'") && job.includes("BACKUP = '" + VERCEL + "'"), 'העובד: הראשי = השרתון שלנו, Vercel = גיבוי');
ok(/def http\(method, url[^\n]*\n(?:[^\n]*\n){0,20}?\s+alt = BACKUP \+ url\[len\(SERVER\):\]/.test(job), 'העובד: כל בקשה לשרתון עוברת דרך http() עם המעבר לגיבוי');
ok(/r\[0\] < 500 and r\[0\] != 421/.test(job), 'העובד: 5xx ו־421 עוברים לגיבוי');

// השרתון: פעולות הלמידה של העובד בשרת בלי הדלי — 421 (העובד שולח לגיבוי), לפני שנשמר משהו
const api = read('ibkr-proxy/api/studio.js');
const i421 = api.indexOf("/^learn(Put|Media|MediaDone)$/.test(body.op) && learnRemote()");
ok(i421 > 0 && i421 < api.indexOf("if (body.op === 'learnPut') return res.status(200)"), 'learnPut/learnMedia/learnMediaDone: 421 בשרת בלי R2L_*');

// הווידג'טים
const wd = read('android/app/src/invest/java/io/github/yishaiguedj1/snowball/WidgetData.kt');
ok(wd.includes('val HOSTS = listOf("' + OURS + '", "' + VERCEL + '")') && !/const val PROXY/.test(wd), 'ווידג\'ט Invest: השרתון שלנו קודם');
ok(/WidgetStore\.HOSTS\.firstNotNullOfOrNull/.test(read('android/app/src/invest/java/io/github/yishaiguedj1/snowball/WidgetRefresh.kt')), 'ווידג\'ט Invest: הגיבוי רק כשהראשי לא החזיר 200');
const mon = read('android/app/src/admin/java/io/github/yishaiguedj1/snowball/MonData.kt');
ok(mon.includes('private val HOSTS = listOf("' + OURS + '", "' + VERCEL + '")') && /if \(last !is Res\.Fail\) return last/.test(mon), 'ווידג\'ט הניהול: השרתון שלנו קודם, 401 לא עובר לשרת אחר');

// הקרונים
ok(!JSON.parse(read('ibkr-proxy/vercel.json')).crons, 'vercel.json בלי קרונים');
ok(/let cronBusy = false;[\s\S]{0,600}if \(cronBusy\) return res\.status\(200\)\.json\(\{ ok: true, busy: true \}\);[\s\S]{0,120}finally \{ cronBusy = false; \}/.test(read('ibkr-proxy/api/ibkr-sync.js')),
  'הסנכרון היומי: ריצה אחת בכל פעם (הקרון של השרת + ה־Worker באותה דקה)');
ok(/if \(cronOn\(process\.env, unpacked\)\) startCron\(server, loadCrons\(__dirname\)\)/.test(read('ibkr-proxy/server.js')), 'השרתון שלנו מריץ את הקרונים');

console.log(`\n${n} בדיקות עברו`);
