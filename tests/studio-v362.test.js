// v362: סטודיו התרגום, שלב 3 סבב ו׳ — מגדל הפיקוח: Hook בסשן של העובד שעוצר עבודה שצורכת טוקנים בצורה לא סבירה,
// השרתון שומר את המצב, והטלפון מציג "הכל תקין / חריג" וכרטיס "עצרנו את העבודה".
// הבדיקות המלאות: translator/tests/test_tower.py (הכללים וה־Hook מקצה לקצה), ibkr-proxy/tests/run.js.
// הרצה: node tests/studio-v362.test.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { swVersionOk } = require('./_swver');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

(async () => {
  /* ---------- 1. ה־Hook — רק בסביבה "סטודיו", לא בריפו ---------- */
  const proj = JSON.parse(read('.claude/settings.json'));
  ok(!(proj.hooks && proj.hooks.PreToolUse), 'ה־Hook לא מוגדר בהגדרות הריפו (סשני הפיתוח לא מושפעים)');
  const sh = read('translator/setup.sh');
  ok(/tower-hook\.sh/.test(sh) && /'PreToolUse'/.test(sh) && /'timeout': 20/.test(sh), 'setup.sh: ה־Hook נכתב להגדרות של הסביבה "סטודיו"');
  const hk = read('translator/tower-hook.sh');
  ok(/\[ -f "\$S\/job\.json" \] \|\| exit 0/.test(hk) && /SNB_TOWER/.test(hk), 'tower-hook.sh: בלי עבודה פעילה — יוצא מיד, בלי Python');
  let ran = false;
  try {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'snbt-'));
    const envr = Object.assign({}, process.env, { HOME: home, SNB_SETUP_LITE: '1' });
    execFileSync('bash', [path.join(root, 'translator/setup.sh')], { env: envr, stdio: 'pipe' });
    execFileSync('bash', [path.join(root, 'translator/setup.sh')], { env: envr, stdio: 'pipe' });
    const cfg = JSON.parse(fs.readFileSync(path.join(home, '.claude/settings.json'), 'utf8'));
    const pre = cfg.hooks.PreToolUse;
    ok(pre.length === 1 && pre[0].matcher === '*' && pre[0].hooks[0].timeout === 20 && cfg.permissions.deny.length === 6 && cfg.claudeMdExcludes.length === 2,
      'setup.sh: Hook אחד לכל הכלים (גם בהרצה חוזרת), ושאר ההגדרות נשמרות');
    const out = execFileSync('sh', ['-c', pre[0].hooks[0].command], { env: Object.assign({}, envr, { CLAUDE_PROJECT_DIR: root }), input: '{"tool_name":"Bash"}' }).toString();
    ok(out === '', 'ה־Hook שנכתב רץ ושקט כשאין עבודה פעילה');
    const out2 = execFileSync('sh', ['-c', pre[0].hooks[0].command], { env: Object.assign({}, envr, { CLAUDE_PROJECT_DIR: '/nonexistent' }), input: '{}' }).toString();
    ok(out2 === '', 'ה־Hook בלי הריפו (נתיב שגוי) — לא נכשל');
    ran = true;
  } catch (e) { if (e.code !== 'ENOENT') throw e; }
  if (!ran) console.log('# אין bash/sh — דילוג על הרצת setup.sh');

  /* ---------- 2. המגדל (Python) ---------- */
  const tw = read('translator/tower.py');
  ok(/RED_X, WARN_X, CAP_X = 4\.0, 2\.0, 5\.0/.test(tw) && /LOOP_ERRS, LOOP_CALLS = 6, 10/.test(tw) && /IDLE_SEC, IDLE_USD = 20 \* 60, 1\.5/.test(tw),
    'tower.py: הספים מהתוכנית — פי 4 / פי 2 צהוב / פי 5 תמיד, 6 שגיאות, 20 דקות');
  ok(/'continue': False/.test(tw) && /'permissionDecision': 'deny'/.test(tw), 'tower.py: עצירה = continue:false + חסימת כל פעולה (גם של סוכן־משנה שעוד רץ)');
  ok(/except Exception:[^\n]*\n\s+return 0/.test(tw), 'tower.py: תקלה במגדל עצמו לא עוצרת עבודה');
  ok(/err='tower_stop'/.test(tw), 'tower.py: בעצירה — העבודה "נכשלה" עם tower_stop');
  const job = read('translator/job.py');
  ok(/def mirror_prog\(st, p\)/.test(job) && /'prog\.json', 'tower\.json'/.test(job), 'job.py: מראה של ההתקדמות למגדל, ומצב נקי בכל הפעלה');
  ok(/מגדל הפיקוח/.test(read('translator/RUNBOOK.md')), 'RUNBOOK: מה עושים כשהמגדל עצר');

  /* ---------- 3. השרתון ---------- */
  const S = require(path.join(root, 'ibkr-proxy/lib/studio.js'));
  ok(S.normTower({ lv: 'ok', x: 1.14, usd: 3.456 }).x === 1.1 && S.normTower({ lv: 'red', why: 'loop', n: 6 }).n === 6
    && S.normTower({ lv: 'red', why: 'evil' }) === null && S.normTower({ lv: 'x' }) === null && S.normTower({ lv: 'ok', x: 1e9 }).x === 1000,
  'השרתון: normTower — רמה וסיבה מוכרות, מספרים מוגבלים');
  ok(S.publicJob({ id: 'j', kind: 'tr', state: 'running', tw: { lv: 'warn', x: 2.3 } }, 0).tw.lv === 'warn', 'השרתון: הטלפון רואה את מצב המגדל');
  ok(/tw: null, updated: now/.test(read('ibkr-proxy/api/studio.js')), 'השרתון: הפעלה / המשך — המגדל מתחיל נקי');

  /* ---------- 4. הטלפון ---------- */
  const M = await import(path.join(root, 'studio.js'));
  ok(M.normTw({ lv: 'red', why: 'loop', n: 6, x: 2 }).why === 'loop' && M.normTw({ lv: 'evil' }) === null && M.normTw({ lv: 'ok', why: 'x' }).why === '', 'טלפון: normTw');
  const rec = (srv) => M.normJob({ id: 'jAbCdEfGhIjKlMnOpQrSt', spec: {}, srv });
  ok(M.towerStopped(rec({ state: 'failed', err: 'tower_stop', tw: { lv: 'red', why: 'cost', x: 4.2 } }))
    && !M.towerStopped(rec({ state: 'failed', err: 'worker', tw: { lv: 'red', why: 'cost' } }))
    && !M.towerStopped(rec({ state: 'running', tw: { lv: 'warn', x: 2 } })), 'טלפון: towerStopped — רק עצירה של המגדל');
  ok(M.canResume(M.normJob({ id: 'jAbCdEfGhIjKlMnOpQrSt', spec: {}, up: { a: { done: true } }, srv: { state: 'failed', err: 'tower_stop', tw: { lv: 'red', why: 'idle', min: 25 } } })),
    'טלפון: אחרי עצירה של המגדל — "להמשיך מאותה נקודה"');
  const st = read('studio.js');
  ok(/const tstop = towerStopCard\(rec\)/.test(st) && /&& !tstop\) p\.append\(nowc\)/.test(st) && /function towerLine\(rec\)/.test(st), 'טלפון: כרטיס העצירה (במקום "מה קורה עכשיו") ושורת המצב');
  const app = read('app.js');
  for (const k of ['studioTwOk', 'studioTwWarn', 'studioTwStopT', 'studioTwWhyCost', 'studioTwWhyLoop', 'studioTwWhyIdle', 'studioErrTower'])
    ok((app.match(new RegExp(k + ': "', 'g')) || []).length === 2, 'טלפון: ' + k + ' — עברית ואנגלית');

  /* ---------- 5. גרסה ---------- */
  const ver = (app.match(/const APP_VERSION = '(v\d+)'/) || [])[1];
  ok(+String(ver).slice(1) >= 362, 'APP_VERSION ≥ v362');
  ok(swVersionOk(ver), 'sw.js תואם (שווה או גרסה אחת אחורה בשלב התוכן)');
  console.log('# ' + n + ' בדיקות עברו');
})().catch((e) => { console.error('FAIL -', e && e.stack || e); process.exit(1); });
