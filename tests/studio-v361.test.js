// v361: סטודיו התרגום, שלב 3 סבב ה׳ — נקודות שמירה ב־Drive ו"המשך מאותה נקודה" (עבודה שנכשלה / בוטלה / נתקעה).
// הבדיקות המלאות: השרתון ב־ibkr-proxy/tests/run.js, העובד ב־translator/tests/test_worker.py (test_checkpoints, test_resume_*).
// הרצה: node tests/studio-v361.test.js
const fs = require('fs');
const path = require('path');
const { swVersionOk } = require('./_swver');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

(async () => {
  /* ---------- 1. השרתון ---------- */
  const S = require(path.join(root, 'ibkr-proxy/lib/studio.js'));
  ok(S.CK_STAGES.join() === 'asr,al,tl,rv', 'השרתון: ארבע נקודות שמירה — תמלול, יישור, תרגום, ביקורת');
  ok(S.normCk({ s: 'al', id: 'ckal1234567890', size: 10 }).s === 'al' && S.normCk({ s: 'bn', id: 'ckal1234567890', size: 10 }) === null
    && S.normCk({ s: 'al', id: '../x', size: 10 }) === null && S.normCk({ s: 'al', id: 'ckal1234567890', size: 0 }) === null
    && S.normCk({ s: 'al', id: 'ckal1234567890', size: 600 * 1024 ** 2 }) === null, 'השרתון: normCk — שלב מוכר, מזהה Drive, גודל סביר');
  let L = S.addCk([], { s: 'al', id: 'a1', size: 1 }, 5);
  L = S.addCk(L, { s: 'asr', id: 'b1', size: 1 }, 6);
  L = S.addCk(L, { s: 'al', id: 'a2', size: 1 }, 7);
  ok(L.map((c) => c.s + c.id + c.at).join() === 'asrb16,ala27' && S.lastCk(L).id === 'a2', 'השרתון: אחת לכל שלב, לפי סדר השלבים, החדשה מחליפה');
  const base = { kind: 'tr', fa: { id: 'x' }, state: 'failed', fires: 1, updated: 0 };
  ok(S.canResume(base, 10) === '' && S.canResume(Object.assign({}, base, { state: 'cancelled' }), 10) === ''
    && S.canResume(Object.assign({}, base, { state: 'done' }), 10) === 'state' && S.canResume(Object.assign({}, base, { kind: 'ping' }), 10) === 'state'
    && S.canResume(Object.assign({}, base, { fa: null }), 10) === 'state' && S.canResume(Object.assign({}, base, { fires: 10 }), 10) === 'resume_limit',
  'השרתון: canResume — רק עבודת תרגום עם קבצים, שנכשלה/בוטלה, עד 10 הפעלות');
  const run = Object.assign({}, base, { state: 'running', updated: 1000 });
  ok(S.canResume(run, 1000 + S.STALE_MS - 1) === 'state' && S.canResume(run, 1000 + S.STALE_MS + 1) === '' && S.isStale(run, 1000 + S.STALE_MS + 1),
    'השרתון: עבודה "רצה" בלי דיווח שעתיים = נתקעה — אפשר להמשיך');
  const u = S.mergeUse([{ k: 'main', m: 'claude-sonnet-5-5', n: 1, i: 2, o: 3, cr: 4, c5: 5, c1: 6, usd: 0.5 }],
    [{ k: 'main', m: 'claude-sonnet-5-5', n: 1, i: 2, o: 3, cr: 4, c5: 5, c1: 6, usd: 0.25 }, { k: 'tl', m: 'claude-x', n: 1, i: 0, o: 0, cr: 0, c5: 0, c1: 0, usd: null, op: 9, oc: null }]);
  ok(u.length === 2 && u[0].n === 2 && u[0].o === 6 && u[0].usd === 0.75 && u[1].usd === null && u[1].op === 9 && S.mergeUse(null, null) === null,
    'השרתון: mergeUse — סכום לפי סוג ומודל; מודל בלי מחיר נשאר בלי מחיר');
  const pj = S.publicJob({ id: 'j', kind: 'tr', state: 'failed', ck: L, use0: u, use: null }, 10);
  ok(pj.ck.s === 'al' && pj.ck.at === 7 && !('id' in pj.ck) && pj.use === u && pj.stale === false, 'השרתון: הטלפון רואה אחרי איזה שלב נשמר (בלי מזהי קבצים), והעלות של סשנים קודמים');
  ok(S.workerJob({ id: 'j', kind: 'tr', ck: L }).ck.length === 2 && S.workerJob({ id: 'j', kind: 'tr' }).ck.length === 0, 'השרתון: העובד מקבל את רשימת נקודות השמירה');
  const api = read('ibkr-proxy/api/studio.js');
  ok(/op === 'resume'/.test(api) && /S\.canResume\(job, now\)/.test(api) && /fireJob\(deps, uid, v, job, now, true\)/.test(api) && /error: 'ck_bad'/.test(api)
    && /meta\.parents\.includes\(folder\)/.test(api) && /driveFileInFolder\(deps, job\.uid, job\.folder/.test(api), 'השרתון: resume + נקודת שמירה מאומתת מול Drive (בתיקיית העבודה)');

  /* ---------- 2. העובד ---------- */
  const job = read('translator/job.py');
  ok(/CK_STAGES = \('asr', 'al', 'tl', 'rv'\)/.test(job), 'העובד: אותם שלבים כמו בשרתון');
  ok(/save_ck\(ctx, 'asr'\)/.test(job) && /save_ck\(ctx, 'al'\)/.test(job) && /save_ck\(ctx, 'rv'\)/.test(job) && /sub\.add_parser\('save'/.test(job) && /sub\.add_parser\('restore'/.test(job),
    'העובד: נקודה אחרי prepare, align ו־finish (אחרי tr-check), save tl ידני, ו־restore');
  ok(job.indexOf("save_ck(ctx, 'rv')") > job.indexOf("tr-check מצא שגיאות") && job.indexOf("save_ck(ctx, 'rv')") < job.indexOf("vt(ctx, ['tr-merge'"),
    'העובד: נקודת הביקורת נשמרת רק אחרי tr-check נקי, לפני הצריבה');
  ok(!/'meta\.json'/.test(job) && /pd \/ 'project\.json'/.test(job), 'העובד: המקור של vt ב־project.json (באג v360: meta.json — vt האמיתי לא היה רואה את הסרטון)');
  ok(/CK_SKIP_EXT = \{[^}]*'\.mp4'[^}]*'\.wav'/.test(job) && /'out', '_dl', 'preview'/.test(job), 'העובד: בלי מדיה ובלי צריבות בארכיון');
  ok(/'\.\.' in parts/.test(job) && /m\.isfile\(\) or m\.isdir\(\)/.test(job), 'העובד: פתיחה בטוחה של הארכיון (בלי .. ובלי קישורים)');
  const rb = read('translator/RUNBOOK.md');
  ok(/job\.py restore/.test(rb) && /\$J save tl/.test(rb) && /לא\*\* מתחילים מ־prepare/.test(rb), 'RUNBOOK: המשך דרך restore, ו־save tl אחרי התרגום');

  /* ---------- 3. הטלפון ---------- */
  const M = await import(path.join(root, 'studio.js'));
  ok(M.normCk({ s: 'tl', at: 5 }).s === 'tl' && M.normCk({ s: 'bn' }) === null && M.normCk(null) === null, 'טלפון: normCk');
  const mk = (srv, up) => M.normJob({ id: 'jAbCdEfGhIjKlMnOpQrSt', spec: {}, up: up || { a: { done: true } }, srv });
  ok(M.normJob({ id: 'jAbCdEfGhIjKlMnOpQrSt', spec: {}, srv: { state: 'failed', ck: { s: 'al', at: 3 }, stale: true, fires: 2 } }).srv.ck.s === 'al', 'טלפון: normJob שומר את נקודת השמירה');
  ok(M.canResume(mk({ state: 'failed' })) && M.canResume(mk({ state: 'cancelled' })) && !M.canResume(mk({ state: 'done' }))
    && !M.canResume(mk({ state: 'running' })) && M.canResume(mk({ state: 'running', stale: true })) && !M.canResume(mk({ state: 'failed' }, { a: {}, v: {} })),
  'טלפון: "המשך" — נכשלה / בוטלה / נתקעה, ורק כשהקבצים עלו');
  ok(M.jobPhase(mk({ state: 'running', stale: true }), null) === 'stuck' && M.jobPhase(mk({ state: 'running' }), null) === 'running', 'טלפון: מצב "נעצרה"');
  const N = await import(path.join(root, 'studionet.js'));
  const fj = { state: 'failed', prog: { st: 'tl', p: 0.4, stg: { tr: { s: 1, e: 2 }, al: { s: 2, e: 3 }, tl: { s: 3, e: 4 } } } };
  ok(N.progressModel(fj, {}, { done: true }, 1e7).stages.map((x) => x.state[0]).join('') === 'dddwwww', 'טלפון: עבודה שנכשלה — השלב שבו נעצרה בלי ✓ (השרתון סגר אותו בכישלון)');
  const st = read('studio.js');
  ok(/net\.api\('resume', (?:ov \? \{ job: id, ov: true \} : )?(?:\{ job: id \}\)|Object\.assign\(\{ job: id \})/.test(st) && /T\('studioResumeCk'\)/.test(st) && /T\('studioCkSaved'/.test(st), 'טלפון: הכפתור ושורת "נשמר אחרי"');
  const app = read('app.js');
  for (const k of ['studioResumeCk', 'studioRetryAll', 'studioResuming', 'studioCkSaved', 'studioStuckBig', 'studioNowStuck', 'studioBStuck', 'studioErrResumeLimit', 'studioCkAsr', 'studioCkAl', 'studioCkTl', 'studioCkRv'])
    ok((app.match(new RegExp(k + ': "', 'g')) || []).length === 2, 'טלפון: ' + k + ' — עברית ואנגלית');

  /* ---------- 4. גרסה ---------- */
  const ver = (app.match(/const APP_VERSION = '(v\d+)'/) || [])[1];
  ok(+String(ver).slice(1) >= 361, 'APP_VERSION ≥ v361');
  ok(swVersionOk(ver), 'sw.js תואם (שווה או גרסה אחת אחורה בשלב התוכן)');
  console.log('# ' + n + ' בדיקות עברו');
})().catch((e) => { console.error('FAIL -', e && e.stack || e); process.exit(1); });
