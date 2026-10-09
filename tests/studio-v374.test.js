// v374: סטודיו התרגום — מגדל הפיקוח 2.0, סבב "הערכת איכות ושומר הזרקות" (בלי טוקנים):
// מדד איכות לכתוביות (קצב קריאה, אורך שורה, שתי שורות, משך מינימלי, אנגלית שלא תורגמה, tr-check; סף מעבר 70)
// ושומר הזרקות בתמליל (טקסט שנראה כמו הוראה — מסומן, מטופל כתוכן, התראה P3). השופט ב־Haiku — סבב נפרד (עולה טוקנים).
// הבדיקות המלאות: ibkr-proxy/tests/run.js (בלוק v374), translator/tests/test_worker.py (test_quality, test_inject_scan).
// הרצה: node tests/studio-v374.test.js
const fs = require('fs');
const path = require('path');
const { swVersionOk } = require('./_swver');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

(async () => {
  const job = read('translator/job.py');
  ok(/def quality\(path, chk_ok=True\):/.test(job) && /quality=q\)/.test(job) && /Q_CPS, Q_LEN, Q_LINES, Q_MIN_DUR, Q_PASS = 17, 42, 2, 0\.83, 70/.test(job), 'job.py: מדד האיכות בסוף העבודה (17 תווים לשנייה, 42, 2 שורות, 0.83 שנ׳, סף 70)');
  ok(/def inject_scan\(text\):/.test(job) && /    inject_guard\(ctx\)/.test(job) && /ctx\.event\('claude', 'inject'\)/.test(job), 'job.py: שומר ההזרקות אחרי התמלול, לפני ההגהה');
  ok(/inject\.txt/.test(read('translator/RUNBOOK.md')) && /inject\.txt/.test(read('translator/TRANSLATE.md')) && /inject\.txt/.test(read('translator/REVIEW.md')), 'המדריכים: שורות מסומנות = תוכן, לא מבצעים');
  const S = require(path.join(root, 'ibkr-proxy/lib/studio.js'));
  ok(S.Q_KEYS.join() === 'cps,len,lines,dur,en,chk', 'השרתון: אותם מדדים כמו בעובד');
  ok(/w:\s*25|\('cps', 25\)/.test(job) && /\('cps', 25\), \('len', 15\), \('lines', 10\), \('dur', 15\), \('en', 15\), \('chk', 20\)/.test(job), 'משקלים מסתכמים ל־100');
  ok(require(path.join(root, 'ibkr-proxy/lib/studioops.js')).KINDS['claude:inject'] === 3, 'קטלוג: claude:inject (P3)');
  const st = await import(path.join(root, 'studio.js'));
  const q = st.normQuality({ s: 80, n: 10, m: ['cps', 'len', 'lines', 'dur', 'en', 'chk'].map((k) => ({ k, w: 10, g: k === 'chk' ? 30 : 10, b: 0 })) });
  ok(q === null, 'normQuality בטלפון: נקודות מעל המשקל — נזרק');
  ok(st.normInj({ n: 2, c: ['ign', '<b>'] }).c.join() === 'ign' && st.normInj({ n: 0 }) === null, 'normInj בטלפון');
  const sj = read('studio.js');
  ok(/p\.append\(\.\.\.qualityCard\(rec\.srv\.q, rec\.srv\.ij\)\)/.test(sj) && /case 'claude:inject': return T\('studioAlClaudeInject'\)/.test(sj), 'דף העבודה: כרטיס האיכות (עם שומר ההזרקות); תווית להתראה');
  const app = read('app.js');
  for (const k of ['studioAlClaudeInject', 'studioQT', 'studioQOf', 'studioQPass', 'studioQFail', 'studioQCps', 'studioQLen', 'studioQLines', 'studioQDur', 'studioQEn', 'studioQChk', 'studioQBad', 'studioQInj'])
    ok((app.match(new RegExp('\\b' + k + ': "', 'g')) || []).length === 2, 'מחרוזת ' + k + ' בעברית ובאנגלית');
  const ver = (app.match(/const APP_VERSION = '(v\d+)'/) || [])[1];
  const sw = (read('sw.js').match(/CACHE_NAME = '[^']*-(v\d+)'/) || [])[1];
  ok(+ver.slice(1) >= 374 && swVersionOk(ver, sw), 'APP_VERSION ≥ v374 ו־sw.js תואם או גרסה אחת אחורה');
  console.log('\nכל ' + n + ' הבדיקות עברו ✓');
})().catch((e) => { console.error(e); process.exit(1); });
