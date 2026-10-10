// v367: סטודיו התרגום — מגדל הפיקוח 2.0, סבב "מתג חירום, חוקים ואישורים" (AI Control Tower — Govern / Secure):
// החוקים שלך (תקציב לעבודה, מצב מקסימלי, אישור לפני צריבה), "עצור את כל הסוכנים" + "להחזיר", ושערים — הפרה של חוק = העבודה מחכה לך בטלפון.
// הבדיקות המלאות: ibkr-proxy/tests/run.js (השרתון), translator/tests/test_tower.py (שער התקציב), test_worker.py (שער הצריבה, job.py gate).
// הרצה: node tests/studio-v367.test.js
const fs = require('fs');
const path = require('path');
const { swVersionOk } = require('./_swver');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

(async () => {
  /* ---------- 1. השרתון — טהור ---------- */
  const S = require(path.join(root, 'ibkr-proxy/lib/studio.js'));
  const O = require(path.join(root, 'ibkr-proxy/lib/studioops.js'));
  ok(JSON.stringify(S.normRules()) === '{"b":0,"mx":"","ab":false,"jx":false}', 'בלי חוקים כברירת מחדל');
  const order = Object.keys(S.NORM_DEF).sort((a, b) => S.NORM_DEF[a] - S.NORM_DEF[b]);
  ok(order.join() === 'haiku-medium,haiku-high,sonnet-medium,sonnet-high,opus-medium', '"מצב מקסימלי" — לפי הצפוי לשעה (NORM_DEF)');
  const g = S.normGate({ k: 'b', usd: 10.271, cap: 10 }, 'g000000000001');
  ok(g.g === 'b' && g.q === '' && g.o.join() === 'go,stop' && g.d === 1 && g.n.usd === 10.27, 'שער תקציב — בלי טקסט מ־Claude, ברירת המחדל "לעצור"');
  ok(S.normGate({ k: 'r', cues: [{ t: '1:00', x: 'א' }], cnt: 3 }, 'g1').d === 1 && S.normGate({ k: 'q' }, 'g1') === null, 'שער צריבה — ברירת המחדל "רק כתוביות"; סוג לא מוכר נזרק');
  const wj = S.workerJob({ id: 'j', kind: 'tr', bx: 2, use0: [{ usd: 3.5 }, { usd: null }, { usd: 1.25 }] }, null, [], 'suggest', { b: 10, ab: true });
  ok(wj.rl.b === 10 && wj.rl.ab === true && wj.bx === 2 && wj.u0 === 4.75, 'העובד מקבל את החוקים, את מספר האישורים ומה שכבר עלה');
  ok(O.KINDS['claude:budget'] === 3, 'התראה "הגענו לתקציב" בקטלוג (P3)');
  const api = read('ibkr-proxy/api/studio.js');
  ok(/op === 'rules'/.test(api) && /op === 'halt'/.test(api) && /kh: ''/.test(api) && /'halted'/.test(api), 'השרתון: חוקים, מתג החירום (מבטל את מפתחות העבודות), חסימת הפעלות');
  ok(/await ruleBlock\(deps, uid, job, body\)/.test(api) && /await ruleBlock\(deps, uid, job, auto \? \{ ov: true \} : body\)/.test(api) && /await doResume\(deps, uid, job, now, body, false\)/.test(api) && /body\.ov !== true/.test(api),
    'התחלה והמשך — מתג החירום ומצב מעל המקסימום (ov = "בכל זאת"; v368: ההמשך דרך doResume)');
  ok(/WORKER_OPS = new Set\(\['claim', 'token', 'report', 'qa'\]\)/.test(api), 'העובד בודק תשובה לשער בלי לבקש Drive');

  /* ---------- 2. העובד והמגדל ---------- */
  const job = read('translator/job.py');
  const tower = read('translator/tower.py');
  ok(/'rl': rules_valid\(job\.get\('rl'\)\)/.test(job) && /def gate_cmd/.test(job) && /approve_render\(ctx\)/.test(job), 'job.py: החוקים בקובץ המצב, job.py gate, ואישור לפני צריבה ב־finish');
  ok(/def gate_step/.test(tower) && /GATE_WAIT = 30 \* 60/.test(tower) && /'budget':/.test(tower), 'המגדל: שער תקציב — מחכה לך, ובלי תשובה בחצי שעה עוצר');
  ok(/GATE_WAIT = 30 \* 60/.test(read('ibkr-proxy/lib/studio.js')), 'חצי שעה — אותו זמן בשרתון ובמגדל');
  ok(/\$J gate/.test(read('translator/RUNBOOK.md')), 'RUNBOOK: מה עושים כשהמגדל עוצר בתקציב');

  /* ---------- 3. הטלפון ---------- */
  const st = await import(path.join(root, 'studio.js'));
  ok(JSON.stringify(st.normRules({ b: 12.5, mx: 'sonnet-high', ab: true, x: 1 })) === '{"b":12.5,"mx":"sonnet-high","ab":true,"jx":false}' && st.normRules({ b: 900, mx: 'evil' }).b === 500 && st.normRules({ b: 7.3 }).b === 7.5 && st.normRules({ b: 0.5 }).b === 0
    && [900, 7.3, 0.5, 12.5].every((b) => st.normRules({ b }).b === S.normRules({ b }).b), 'normRules בטלפון — כמו בשרתון (עיגול לחצי דולר, עד 500)');
  ok(order.slice(0, -1).every((id, i) => st.modeOverMax(order[i + 1], id) && !st.modeOverMax(id, order[i + 1])) && !st.modeOverMax('opus-max', ''), 'modeOverMax — אותו סדר כמו בשרתון');
  const q = st.normQa({ id: 'g000000000001', g: 'b', q: '<b>evil</b>', o: ['go', 'stop'], d: 1, w: 1800, n: { usd: 10.27, cap: 10 } });
  ok(q && q.g === 'b' && q.q === '' && q.n.cap === 10, 'normQa: שער תקציב (בלי טקסט חופשי)');
  const r = st.normQa({ id: 'g000000000002', g: 'r', o: ['go', 'stop'], d: 1, n: { cnt: 9, cues: [{ t: 'x', x: 'שלום' }, { x: 5 }, ...Array(9).fill({ t: '0:01', x: 'א'.repeat(300) })] } });
  ok(r.n.cues.length === 5 && r.n.cues[0].t === '' && r.n.cues[1].x.length === 140, 'normQa: עד 5 כתוביות לדוגמה, טקסט בלבד עד 140');
  ok(st.normQa({ id: 'q1', g: 'b', o: ['go', 'stop'] }) === null && st.normQa({ id: 'g1', g: 'b', o: ['go'] }) === null && st.normQa({ id: 'q1', q: 'שאלה' }).g === undefined,
    'normQa: שער בלי מזהה g / בלי שתי תשובות — נזרק; שאלה רגילה — כמו קודם');
  ok(st.chainFor('rules', null).map((x) => x.v).join() === 'home,settings,tower,rules', 'רענון במסך החוקים — חוזר אליו (דרך המגדל)');
  const sj = read('studio.js');
  ok(/function pageRules\(p\)/.test(sj) && /ui\.view === 'rules'\) pageRules\(p\)/.test(sj) && /go\('rules'\)/.test(sj), 'מסך "החוקים שלך" — מהמגדל');
  ok(/askConfirm\(q, \(\) => setHalt\(true\), \{ danger: true/.test(sj) && /net\.api\('halt'/.test(sj) && /net\.api\('rules'/.test(sj), 'מתג החירום — באישור (פעולה הרסנית), ונשמר בשרתון');
  ok((sj.match(/const hb = haltBanner\(\)/g) || []).length === 2, 'כשהסוכנים עצורים — באנר בבית ובמגדל');
  ok(/const x = h\('span', 'st-cue-x', cu\.x\); x\.dir = 'auto'/.test(sj) && !/innerHTML[^;]*cu\./.test(sj), 'הכתוביות לדוגמה — טקסט בלבד');
  ok(/case 'claude:budget': return T\('studioAlClaudeBudget'\)/.test(sj), 'תווית להתראה "הגענו לתקציב"');
  const app = read('app.js');
  for (const k of ['studioRlT', 'studioRlLede', 'studioRlUpTo', 'studioRlBudgetT', 'studioRlNoBudget', 'studioRlNoBudgetS',
    'studioRlBudgetNote', 'studioRlMaxT', 'studioRlAllModes', 'studioRlAbT', 'studioRlAb', 'studioRlAbS', 'studioRlOverForm', 'studioRuleModeQ', 'studioStartAnyway',
    'studioErrHalted', 'studioErrRuleMode', 'studioErrBudgetStop', 'studioAlClaudeBudget', 
    'studioHaltQ0', 'studioHaltQ1', 'studioHaltQN', 'studioHaltOk', 'studioHaltDone0', 'studioHaltDone1', 'studioHaltDoneN', 'studioHaltBack', 'studioHaltOnB', 'studioHaltBackBtn',
    'studioHaltGo', 'studioGateBT', 'studioGateBQ', 'studioGateBGoBtn', 'studioGateBStopBtn', 'studioGateBDef', 'studioGateBGo', 'studioGateBStop', 'studioGateBAuto',
    'studioGateRT', 'studioGateRQ', 'studioGateRGoBtn', 'studioGateRStopBtn', 'studioGateRDef', 'studioGateRGo', 'studioGateRStop', 'studioGateRAuto'])
    ok((app.match(new RegExp('\\b' + k + ': "', 'g')) || []).length === 2, 'מחרוזת ' + k + ' בעברית ובאנגלית');

  /* ---------- 4. גרסה ---------- */
  const ver = (app.match(/const APP_VERSION = '(v\d+)'/) || [])[1];
  const sw = (read('sw.js').match(/CACHE_NAME = '[^']*-(v\d+)'/) || [])[1];
  ok(+ver.slice(1) >= 367 && swVersionOk(ver, sw), 'APP_VERSION ≥ v367 ו־sw.js תואם או גרסה אחת אחורה');
  console.log('\nכל ' + n + ' הבדיקות עברו ✓');
})().catch((e) => { console.error(e); process.exit(1); });
