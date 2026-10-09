// v376: סטודיו התרגום — מגדל הפיקוח 2.0, סבב "בעיות וספרי הפעלה" (ServiceNow: Problem · KEDB · AIOps LEAP · Playbooks):
// ספר התיקונים הופך לניהול בעיות — מספר קבוע (B…), מצב נגזר (חדשה ← אובחנה ← עקיפה ידועה ← לא חזרה), התקלות שלה,
// ודירוג "שווה לתקן בקוד" (כמה פעמים × כמה עלתה). ספרי ההפעלה: מה רץ לבד ומה רק באישורך ("מצב זול יותר" אחרי עצירה על עלות).
// הבדיקות המלאות: ibkr-proxy/tests/run.js (בלוק v376).
// הרצה: node tests/studio-v376.test.js
const fs = require('fs');
const path = require('path');
const { swVersionOk } = require('./_swver');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

(async () => {
  /* ---------- 1. השרתון ---------- */
  const P = require(path.join(root, 'ibkr-proxy/lib/studioprob.js'));
  const S = require(path.join(root, 'ibkr-proxy/lib/studio.js'));
  ok(P.STATES.join() === 'n,d,w,f' && P.PRB_CLEAR === 3, 'מצבי בעיה קבועים; "לא חזרה" אחרי 3 עבודות שהצליחו');
  ok(P.RUNBOOKS.map((x) => x.join(':')).join() === 'net:s,known:s,cheap:c', 'ספרי הפעלה: שניים בטוחים, אחד באישור');
  const pv = P.problemsView([{ no: 1, fp: 'aaaaaaaaaaaa', why: 'loop', n: 2, fix: '<b>x</b>', at: 1 }], [], [], 10);
  ok(!/name|spec/.test(JSON.stringify(pv)) && pv.list[0].state === 'w', 'problemsView: בלי שמות קבצים; עקיפה ידועה');
  const api = read('ibkr-proxy/api/studio.js');
  ok(/pb: P\.problemsView\(S\.fbView\(ic\.fb\), ic\.inc, list, now\), rb: P\.runbooksView\(ic\.fb, list, now\)/.test(api), 'השרתון: הבעיות וספרי ההפעלה מגיעים עם רשימת העבודות (בלי קריאה נוספת)');
  ok(/if \(body\.mode != null && !auto\)/.test(api) && /S\.COST_STOP\(job\)/.test(api) && /S\.cheaperModes\(from\)\.includes\(body\.mode\)/.test(api),
    'השרתון: "מצב זול יותר" — רק בלחיצה (לא בהמשך האוטומטי), רק אחרי עצירה על עלות, ורק למצב זול יותר');
  ok(/v376/.test(read('ibkr-proxy/lib/studioinc.js')) && /if \(f\.fp\) x\.fp = f\.fp;/.test(read('ibkr-proxy/lib/studioinc.js')), 'תקלה זוכרת את הבעיה שלה (טביעת האצבע)');

  /* ---------- 2. הטלפון ---------- */
  const st = await import(path.join(root, 'studio.js'));
  const pb = st.normPb({ list: [{ no: 3, fp: 'aaaaaaaaaaaa', why: 'loop', state: 'w', n: 3, jobs: 2, usd: 7.2, fix: 'x'.repeat(400), inc: [7, 'x', 8] },
    { no: 4, fp: 'bad', why: 'loop', state: 'w' }, { no: 5, fp: 'bbbbbbbbbbbb', why: 'evil', state: 'n' }, { no: 6, fp: 'cccccccccccc', why: 'cost', state: 'zz' }] });
  ok(pb.list.length === 1 && pb.list[0].fix.length === 160 && pb.list[0].inc.join() === '7,8' && pb.open === 1, 'normPb: רק רשומות תקינות, תיקון מקוצר');
  ok(st.normRb([{ k: 'net', r: 's', n: 2 }, { k: 'evil', r: 's', n: 1 }, { k: 'cheap', r: 'x' }]).length === 1 && st.normRb('x') === null, 'normRb: רק ספרים מהקטלוג');
  ok(st.cheaperModes('opus-medium').join() === 'sonnet-high,sonnet-medium' && !st.cheaperModes('sonnet-medium').length, 'cheaperModes בטלפון = בשרתון');
  ok(st.costStop({ err: 'tower_stop', tw: { why: 'cap' } }) && !st.costStop({ err: 'tower_stop', tw: { why: 'idle' } }) && !st.costStop(null), 'costStop בטלפון = בשרתון');
  ok(st.chainFor('prob', 3).map((x) => x.v).join() === 'home,settings,tower,prob', 'רענון בדף בעיה — חוזר דרך המגדל');
  const sj = read('studio.js');
  ok(/p\.append\(\.\.\.pbSection\(\), \.\.\.rbSection\(\)\)/.test(sj) && !/secT\(T\('studioFbT'\)\)/.test(sj), 'מגדל: מקטע "בעיות" במקום ספר התיקונים (בלי כפילות) + ספרי הפעלה');
  ok(/function pageProb\(p\)/.test(sj) && /else if \(ui\.view === 'prob'\) pageProb\(p\)/.test(sj), 'דף בעיה');
  ok(/const pt = h\('small', null, x\.px\); pt\.dir = 'auto'/.test(sj) && !/innerHTML/.test(sj.slice(sj.indexOf('function pbRow'), sj.indexOf('function pageProb') + 2000)), 'ההצעה והתיקון — טקסט בלבד');
  ok(/costStop\(rec\.srv\) \? cheaperModes\(rec\.spec\.mode\)\[0\]/.test(sj) && /askConfirm\(T\('studioCheapQ'/.test(sj), 'דף העבודה: "להמשיך במצב זול יותר" — באישור');
  const app = read('app.js');
  for (const k of ['studioPbSec', 'studioPbStN', 'studioPbStD', 'studioPbStW', 'studioPbStF', 'studioPbJobs1', 'studioPbJobsN', 'studioPbCost', 'studioPbAfter', 'studioPbGone',
    'studioPbKind', 'studioPbStops', 'studioPbJobsK', 'studioPbCostK', 'studioPbAutoK', 'studioPbLastK', 'studioPbFixT', 'studioPbIncT', 'studioPbScoreN', 'studioRbSec', 'studioRbNet',
    'studioRbKnown', 'studioRbCheap', 'studioRbSafe', 'studioRbAsk', 'studioRbNote', 'studioCheapGo', 'studioCheapQ', 'studioCheapOk', 'studioErrMode'])
    ok((app.match(new RegExp('\\b' + k + ': "', 'g')) || []).length === 2, 'מחרוזת ' + k + ' בעברית ובאנגלית');

  /* ---------- 3. גרסה ---------- */
  const ver = (app.match(/const APP_VERSION = '(v\d+)'/) || [])[1];
  const sw = (read('sw.js').match(/CACHE_NAME = '[^']*-(v\d+)'/) || [])[1];
  ok(+ver.slice(1) >= 376 && swVersionOk(ver, sw), 'APP_VERSION ≥ v376 ו־sw.js תואם או גרסה אחת אחורה');
  console.log('\nכל ' + n + ' הבדיקות עברו ✓');
})().catch((e) => { console.error(e); process.exit(1); });
