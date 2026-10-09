// v379: סטודיו התרגום — מגדל הפיקוח 2.0, סבב "דוח אחרי תקלה" (ServiceNow: Post Incident Report · Major Incident Workbench):
// לתקלות P1–P2 שנפתרו — זמן לזיהוי, זמן לתיקון ומה עלה בטעות (בלי טוקנים), וסיכום של שלושה משפטים ש־Claude (Sonnet, הסשן של
// העבודה הבאה) כותב פעם אחת מעובדות מובנות בלבד. בטלפון: הסימן הסגול, המודל שכתב, האזהרה הסטנדרטית, 👍/👎.
// הבדיקות המלאות: ibkr-proxy/tests/run.js (בלוק v379), translator/tests/test_worker.py (test_pir).
// הרצה: node tests/studio-v379.test.js
const fs = require('fs');
const path = require('path');
const { swVersionOk } = require('./_swver');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

(async () => {
  /* ---------- 1. השרתון ---------- */
  const PIR = require(path.join(root, 'ibkr-proxy/lib/studiopir.js'));
  ok(PIR.PIR_SEV === 2 && PIR.PIR_ASK === 3 && PIR.SUM_MAX === 420, 'רק P1–P2 (החלטה 3); עד 3 בקשות לתקלה; סיכום עד 420 תווים');
  const fx = PIR.pirForWorker({ no: 1, c: 'routine', e: 'routine_down', s: 1, f: 6e5, rt: 2e6, n: 2, pr: { tti: 60, usd: 0.4 }, h: [[6e5, 'o'], [2e6, 'r']], rc: [{ t: 'wide', c: 'routine', k: 'routine_down', p: 70, x: 'evil' }] },
    [{ j: 'x', f: 1 }]);
  ok(Object.keys(fx).sort().join() === 'by,c,e,m,n,no,rc,s,st,tl,tti,ttr,usd' && !('x' in fx.rc[0]), 'העובדות לסשן — צורה קבועה, רק קודים, זמנים וסכומים');
  const inc = require(path.join(root, 'ibkr-proxy/lib/studioinc.js'));
  ok(/delete x\.pr; delete x\.ps; delete x\.pq;/.test(read('ibkr-proxy/lib/studioinc.js')) && typeof inc.incCloseJob === 'function', 'תקלה שנפתחה שוב — הדוח מתאפס (ייכתב על כל התקלה)');
  const api = read('ibkr-proxy/api/studio.js');
  ok(/PIR\.pirPending\(od\.inc, now\)/.test(api) && /pq: \(y\.pq \|\| 0\) \+ 1/.test(api), 'הלקיחה מבקשת סיכום ומונה את הבקשות');
  ok(/PIR\.pirSave\(od\.inc, Number\(body\.pir\.no\)/.test(api) && /op === 'pirVote'/.test(api), 'הסיכום נשמר מהדיווח; הצבעה מהטלפון');
  ok(/if \(job\.kind === 'tr'\) \{\s*try \{\s*const od = await readDoc\(deps, 'studioOps', job\.uid\);\s*const x = od && PIR\.pirPending/.test(api), 'רק לעבודת תרגום (לא בבדיקת חיבור)');

  /* ---------- 2. העובד ---------- */
  const job = read('translator/job.py');
  ok(/'pir': pir_valid\(got\.get\('pir'\)\)/.test(job) && /def pir\(args\)/.test(job) && /'pir': pir,/.test(job), 'job.py: העובדות נשמרות (רק בצורה הקבועה), פקודת pir');
  ok(/st\.pop\('pir', None\)/.test(job), 'job.py: פעם אחת — אחרי השליחה הבקשה נמחקת');
  const rb = read('translator/RUNBOOK.md');
  ok(/דוח אחרי תקלה/.test(rb) && /\$J pir --text/.test(rb) && /בלי אשמה/.test(rb), 'RUNBOOK: מתי ואיך כותבים את הסיכום');

  /* ---------- 3. הטלפון ---------- */
  const st = await import(path.join(root, 'studio.js'));
  const v = st.normPir({ tti: 120, ttr: 2040, usd: 0.42, ps: { t: 'שלב היישור נכשל פעם אחת והעבודה המשיכה.', m: 'claude-sonnet-5-5', at: 5, v: 1 } });
  ok(v && v.ps.m === 'claude-sonnet-5-5' && v.ps.v === 1 && v.tti === 120, 'normPir: תקין');
  ok(st.normPir({ ps: { t: 'קצר', m: 'evil' } }).ps === null && st.normPir({ ps: { t: 'מספיק ארוך בשביל להיות סיכום.', m: '<b>' } }).ps.m === '' && st.normPir(null) === null,
    'normPir: סיכום קצר / מודל לא תקין — נזרק');
  const sj = read('studio.js');
  ok(/const t = h\('p', null, r\.ps\.t\); t\.dir = 'auto';/.test(sj) && !/innerHTML\s*=\s*[^;]*ps\.t/.test(sj), 'הסיכום מ־Claude מוצג כטקסט בלבד');
  ok(/T\('studioPirBy', \{ m: r\.ps\.m \? modelLabel\(r\.ps\.m\)/.test(sj) && /T\('studioPirCheck'\)/.test(sj), 'מראים איזה מודל כתב, עם האזהרה הסטנדרטית');
  ok(/p\.append\(\.\.\.pirSection\(x\)\)/.test(sj) && sj.indexOf('...pirSection(x)') > sj.indexOf('function pageInc('), 'הדוח בדף התקלה (פרטים) — בלי מקום נוסף');
  ok(!/studioPirTtr/.test(sj), 'בלי כפילות: זמן התיקון כבר בשורה שבראש דף התקלה');
  const app = read('app.js');
  for (const k of ['studioPirT', 'studioPirTti', 'studioPirFails', 'studioPirUsd', 'studioPirNow', 'studioPirBy', 'studioPirCheck', 'studioPirUp', 'studioPirDown', 'studioPirWait', 'studioPirNone'])
    ok((app.match(new RegExp('\\b' + k + ': "', 'g')) || []).length === 2, 'מחרוזת ' + k + ' בעברית ובאנגלית');

  /* ---------- 4. גרסה ---------- */
  const ver = (app.match(/const APP_VERSION = '(v\d+)'/) || [])[1];
  const sw = (read('sw.js').match(/CACHE_NAME = '[^']*-(v\d+)'/) || [])[1];
  ok(+ver.slice(1) >= 379 && swVersionOk(ver, sw), 'APP_VERSION ≥ v379 ו־sw.js תואם או גרסה אחת אחורה');
  console.log('\nכל ' + n + ' הבדיקות עברו ✓');
})().catch((e) => { console.error(e); process.exit(1); });
