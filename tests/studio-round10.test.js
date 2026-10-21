// סבב 10: צריבה לבדיקה (קטע קצר), "בדיקת משמעות אוטומטית" (כלל עם אומדן ואישור), והעתק־הדבק לעבודה מלאה.
// השרתון — ibkr-proxy/tests/run.js; העובד — translator/tests/test_cp.py. הרצה: node tests/studio-round10.test.js
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const J = JSON.stringify;

(async () => {
  const E = await import(path.join(root, 'studioedl.js'));
  const SB = await import(path.join(root, 'studiosubs.js'));
  const P = await import(path.join(root, 'studioplay.js'));
  const S = require(path.join(root, 'ibkr-proxy/lib/studio.js'));
  const st = read('studio.js');

  /* ---------- 1. צריבה לבדיקה ---------- */
  ok(J(E.previewEdl(null, 120, 30)) === '{"k":[[30,50]],"ar":"src","x":0.5}', 'בלי עריכה: 20 שניות מהמקום בעורך');
  const e2 = E.previewEdl(E.normEdl({ k: [[0, 40], [60, 100]], ar: '9:16', x: 0.3, th: 5, sp: 2 }, 120), 120, 35);
  ok(J(e2.k) === '[[35,40]]' && e2.ar === '9:16' && e2.x === 0.3 && e2.sp === 2 && e2.th === undefined, 'בתוך מה שנשאר (35–40 — עד 55 נחתך), אותו יחס, מהירות; בלי תמונה ממוזערת');
  ok(J(E.previewEdl(E.normEdl({ k: [[50, 100]] }, 120), 120, 10).k) === '[[50,70]]', 'המקום בעורך בחלק שנחתך — מתחילת מה שנשאר');
  ok(E.previewEdl(null, 15, 0) === null, 'סרטון קצר מ־20 שניות — כולו (null)');
  ok(E.PV_LEN === 20, 'PV_LEN = 20 שנ׳');
  ok(/previewEdl\(rrEdl\.get\(rec\.id\) \|\| null, rec\.spec\.dur \|\| 0, t0\)/.test(st) && /prv \? \{ prv: true \} : \{\}/.test(st) && /'rr-pv'\)\);/.test(st) && /else if \(!prv\) rrEdl\.delete\(rec\.id\)/.test(st),
    'בטלפון: "קודם 20 שניות לבדיקה" — מהמקום בעורך, prv לשרתון, העריכה השמורה לא נמחקת');
  ok(/\(sj\.spec && sj\.spec\.prv === 1 \? pv : rr\)\.set/.test(st) && /rrJobs = rr; rrPv = pv;/.test(st), 'הבדיקה נשמרת בנפרד מההפקה המלאה');
  ok(/' — קטע לבדיקה' if spec\.get\('prv'\) == 1/.test(read('translator/job.py')), 'העובד: שם התוצר מסומן "קטע לבדיקה"');

  /* ---------- 2. בדיקת משמעות אוטומטית ---------- */
  const STUBS = Object.assign({}, P, SB, E, { createNet: () => ({}), probeVideo: async () => ({}), extractAudio: async () => ({}), uploadBoth: async () => {}, stageEstimates: () => ({}),
    progressModel: () => ({ stages: [], left: 0, pct: 0 }), createBackup: () => ({}), waitOAuthCode: () => {} });
  const body = st.replace(/^export (const|function|async function) /gm, '$1 ').replace(/^import \{([^}]+)\} from '[^']+';$/gm, 'const {$1} = __stubs;')
    .replace(/^import \* as (\w+) from '[^']+';$/gm, 'const $1 = __stubs;');
  const X = new Function('t', '__stubs', body + '\nreturn { amDue, normCp, normRules, CP_TEXT_MAX, normJob };')(undefined, STUBS);
  const rec = { id: 'j' + 'A'.repeat(20), srv: { state: 'done', kind: 'tr', jd: { f: [3, 7] } } };
  ok(X.amDue(rec, { am: true }, []) && !X.amDue(rec, { am: false }, []) && !X.amDue(rec, { am: true }, [rec.id]), 'amDue: רק עם הכלל, פעם אחת לעבודה');
  ok(!X.amDue({ id: rec.id, srv: Object.assign({}, rec.srv, { jd: { f: [] } }) }, { am: true }, []) && !X.amDue({ id: rec.id, srv: Object.assign({}, rec.srv, { state: 'running' }) }, { am: true }, []),
    'רק אחרי שהעבודה הסתיימה ורק כשהשופט סימן כתוביות');
  ok(X.normRules({ am: true }).am === true && X.normRules({ am: 1 }).am === false && J(Object.keys(X.normRules({}))) === J(Object.keys(S.normRules({}))), 'normRules: am — זהה בטלפון ובשרתון');
  ok(/aiPreset = \{ id: rec\.id, ids: rec\.srv\.jd\.f, run: true \};/.test(st) && /if \(run && rows\.length && !ai\.items && !ai\.busy\) queueMicrotask\(\(\) => \{ if \(ui\.view === 'ai' && ai && ai\.id === rec\.id && !ai\.busy\) aiRunJob\(rec\); \}\);/.test(st),
    'הכלל: העורך → גיליון ה־AI עם הכתוביות שסומנו → aiRunJob (שמציג אומדן ומחכה לאישור)');
  ok(/const yes = typeof askConfirm === 'function' \? await new Promise\(\(ok\) => askConfirm\(T\('studioAiEstQ'/.test(st), 'האישור עם האומדן — לא מדלגים עליו');
  ok(/rowSwitch\(\{ label: T\('studioRlAm'\)/.test(st), 'בדף "החוקים שלך"');

  /* ---------- 3. העתק־הדבק ---------- */
  ok(J(X.normCp({ n: 2, r: 'tl', f: 'cpq11234567890', at: 5, a: false })) === '{"n":2,"r":"tl","f":"cpq11234567890","at":5,"a":false}' && X.normCp({ n: 0, r: 'tl', f: 'cpq11234567890' }) === null
    && X.normCp({ n: 1, r: 'evil', f: 'cpq11234567890' }) === null && X.normCp({ n: 1, r: 'tl', f: '../x' }) === null, 'normCp (= cpView בשרתון)');
  ok(J(S.CP_ROLES) === J(['main', 'tl', 'rv', 'jg']) && X.CP_TEXT_MAX === S.CP_FILE_MAX, 'תפקידים ותקרת גודל — זהים בטלפון ובשרתון');
  const jp = read('translator/job.py');
  ok(/CP_ROLES = \('main', 'tl', 'rv', 'jg'\)/.test(jp), 'ובעובד');
  ok(/rowRadio\(\{ label: T\('studioConnCopy'\), sub: T\('studioConnCopyS'\), on: cpMode\(\), onClick: pick\('copy'\), disabled: !ui\.api/.test(st), 'בהגדרות: "העתקה והדבקה" — פעיל כשיש שרת של המערכת');
  ok(/else if \(cpMode\(\)\) Object\.assign\(spec, \{ eng: 'api', cap: store\.settings\.cap, cp: 1 \}\)/.test(st), 'עבודה חדשה: השרת + cp');
  ok(/navigator\.clipboard\.writeText\(t\)/.test(st) && /net\.api\('cpAnswer', \{ job: rec\.id, n: cp\.n, f: fid \}\)/.test(st) && /'https:\/\/claude\.ai\/new'/.test(st), 'הכרטיס: העתקה, פתיחת Claude, הדבקה ושליחה (קובץ בתיקיית העבודה)');
  ok(/rec\.srv\.cp \? 'c' \+ rec\.srv\.cp\.n/.test(st), 'הדף מתעדכן כשמגיעה בקשה חדשה');
  ok(/case 'cp_timeout': case 'cp_empty': return T\('studioErrCp'\)/.test(st), 'טקסט לשגיאות העתק־הדבק');
  const wp = read('ibkr-proxy/lib/webpush.js');
  ok(/'cp'/.test(wp) && /cp: \['העתקה והדבקה ל־Claude'/.test(wp) && /cp: \['Copy & paste to Claude'/.test(wp), 'התראה לטלפון כשבקשה מחכה (בלי תוכן)');
  console.log('# ' + n + ' בדיקות עברו');
})().catch((e) => { console.error('FAIL - ' + (e && e.stack || e)); process.exit(1); });
