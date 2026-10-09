// v373: סטודיו התרגום — מגדל הפיקוח 2.0, סבב "מלאי סוכנים ועקיבה" (ServiceNow AI Control Tower: Discover · Inventory,
// Observe · Traces, Secure · הרשאות). מלאי: מי עבד, באיזה מודל ומאמץ, באיזו גרסת הנחיות, כמה עלה, אחוז הצלחה;
// עקיבה מהיומנים (פעולות, שגיאות, משך — בלי טוקנים); הרשאות ורדיוס פגיעה — ומה שמוצג נאכף בקוד.
// הבדיקות המלאות: ibkr-proxy/tests/run.js (בלוק v373), translator/tests/test_worker.py (test_trace).
// הרצה: node tests/studio-v373.test.js
const fs = require('fs');
const path = require('path');
const { swVersionOk } = require('./_swver');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

(async () => {
  /* ---------- 1. העובד ---------- */
  const job = read('translator/job.py');
  ok(/def trace\(root=None\):/.test(job) && /def prompt_versions\(\):/.test(job) && /c\.call\('claim', ev=env_version\(\), pv=prompt_versions\(\)\)/.test(job), 'job.py: עקיבה מהיומנים וגרסאות ההנחיות ב־claim');
  ok((job.match(/usage=usage_safe\(\), trace=trace_safe\(\)(?:, quality=q)?\)/g) || []).length === 4, 'job.py: כל דיווח סיום / כישלון שולח גם עקיבה');

  /* ---------- 2. השרתון — טהור ---------- */
  const S = require(path.join(root, 'ibkr-proxy/lib/studio.js'));
  const A = require(path.join(root, 'ibkr-proxy/lib/studioagents.js'));
  ok(S.normTrace({ a: { main: { n: 3, e: 1, s: 9 } }, g: [['vt:tr-check', 3, 1]] }).g[0][0] === 'vt:tr-check' && S.normTrace({ a: { main: { n: 1, e: 0, s: 0 } }, g: [['a b', 1, 0]] }) === null, 'normTrace: רק מפתחות בצורה קבועה');
  ok(A.effortOf('opus-medium') === 'medium' && A.effortOf('sonnet-high') === 'high' && A.effortOf('x') === '', 'המאמץ מהמצב');
  const api = read('ibkr-proxy/api/studio.js');
  ok(/ag: A\.agentsView\(list, now\)/.test(api) && /const pv = S\.normPv\(body\.pv\)/.test(api) && /const tr = S\.normTrace\(body\.trace\)/.test(api), 'השרתון: מלאי מאותה רשימה של op jobs, גרסאות מ־claim, עקיבה מהדיווח');
  ok(/'tr', 'pv'(, 'q', 'ij')?\]/.test(read('ibkr-proxy/lib/studio.js')), 'עקיבה וגרסאות נשמרות כ־JSON');

  /* ---------- 3. ההרשאות שמוצגות = מה שנאכף ---------- */
  const setup = read('translator/setup.sh');
  for (const r of ["'Bash(git push *)'", "'PushNotification'", "'CronCreate'", "'ScheduleWakeup'", "'mcp__claude-code-remote'"]) ok(setup.includes(r), 'setup.sh חוסם ' + r + ' (מוצג ב"הרשאות")');
  ok(/const KEY_TTL = 48 \* 3600e3;/.test(read('ibkr-proxy/lib/studio.js')), 'מפתח לעבודה אחת · 48 שעות');
  ok(/SCOPE_FILE = 'https:\/\/www\.googleapis\.com\/auth\/drive\.file'/.test(read('ibkr-proxy/lib/gdrive.js')), 'Drive — drive.file בלבד (רק מה שהאפליקציה יצרה)');

  /* ---------- 4. הטלפון ---------- */
  const st = await import(path.join(root, 'studio.js'));
  const v = st.normAgents({ jobs: 3, agents: [{ k: 'tl', m: 'claude-opus-5-5', ef: 'medium', jobs: 3, usd: 12.5, ok: 67, n: 10, e: 1, s: 900, pv: 'abcdef01', pvs: 2, pvNew: true },
    { k: 'evil', m: 'x' }, { k: 'main', m: '<b>', ef: 'huge', jobs: 2, usd: 1 }], ev: { v: 'abcdef012345', n: 2 } });
  ok(v.agents.length === 2 && v.agents[0].pvNew && v.agents[1].m === '' && v.agents[1].ef === '' && v.ev.n === 2, 'normAgents: רק סוכנים מוכרים, מודל ומאמץ תקינים');
  const t = st.normTrace({ a: { main: { n: 5, e: 9, s: 1 } }, g: [['vt:align', 2, 0], ['<x>', 1, 0]] });
  ok(t.a.main.e === 5 && t.g.length === 1, 'normTrace בטלפון: שגיאות ≤ פעולות, מפתח לא תקין נזרק');
  ok(st.chainFor('agents').map((x) => x.v).join() === 'home,settings,tower,agents', 'רענון במסך המלאי — חוזר דרך המגדל');
  const sj = read('studio.js');
  ok(/p\.append\(\.\.\.agentsSection\(\)\)/.test(sj) && /else if \(ui\.view === 'agents'\) pageAgents\(p\)/.test(sj), 'מגדל: מקטע הסוכנים ומסך המלאי');
  ok(/costCard\(cv, rec\.srv\.tr\)/.test(sj) && !/function traceCard/.test(sj), 'דף העבודה: העקיבה בתוך כרטיס העלות (בלי כרטיס כפול)');
  ok(!/innerHTML/.test(sj.slice(sj.indexOf('function agentName'), sj.indexOf('function fbWhy'))), 'המלאי נבנה בלי innerHTML');
  const app = read('app.js');
  for (const k of ['studioTrActs', 'studioTrT', 'studioTrErrs', 'studioTrErr1', 'studioAgMain', 'studioAgTl', 'studioAgRv', 'studioAgMainA', 'studioAgTlA', 'studioAgRvA', 'studioAgSec', 'studioAgJobs',
    'studioAgPvNew', 'studioAgT', 'studioAgLede', 'studioAgNone', 'studioAgJobsK', 'studioAgCost', 'studioAgOk', 'studioAgActs', 'studioAgTime', 'studioAgPv', 'studioPermT',
    'studioPermDrive', 'studioPermKey', 'studioPermPush', 'studioPermNotify', 'studioPermSessions', 'studioPermBlast', 'studioAgEnv'])
    ok((app.match(new RegExp('\\b' + k + ': "', 'g')) || []).length === 2, 'מחרוזת ' + k + ' בעברית ובאנגלית');

  /* ---------- 5. גרסה ---------- */
  const ver = (app.match(/const APP_VERSION = '(v\d+)'/) || [])[1];
  const sw = (read('sw.js').match(/CACHE_NAME = '[^']*-(v\d+)'/) || [])[1];
  ok(+ver.slice(1) >= 373 && swVersionOk(ver, sw), 'APP_VERSION ≥ v373 ו־sw.js תואם או גרסה אחת אחורה');
  console.log('\nכל ' + n + ' הבדיקות עברו ✓');
})().catch((e) => { console.error(e); process.exit(1); });
