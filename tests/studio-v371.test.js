// v371: סטודיו התרגום — מגדל הפיקוח 2.0, סבב "תקלות, שורש סביר ותקלה רחבה" (ServiceNow: Incident, Probable Root Cause,
// Major Incident Management): כל עבודה שנכשלה או נתקעה = תקלה עם חומרה, מצב, מי טיפל וציר; 3 סיבות סבירות בלי טוקנים;
// אותה תקלה בשתי עבודות = תקלה רחבה, והפעלות חדשות מחכות (אפשר לעקוף). ותיקון ה־CI: כשל שלא הודפס, ו־EPIPE ב־Hook.
// הבדיקות המלאות של השרתון: ibkr-proxy/tests/run.js (בלוק v371).
// הרצה: node tests/studio-v371.test.js
const fs = require('fs');
const path = require('path');
const { swVersionOk } = require('./_swver');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

(async () => {
  /* ---------- 1. ה־CI ---------- */
  const yml = read('.github/workflows/test.yml');
  ok(/code=0; timeout 150 node "\$f" > "\/tmp\/test-\$f\.log" 2>&1 \|\| code=\$\?/.test(yml) && !/^\s*code=\$\?\s*$/m.test(yml),
    'CI: קוד היציאה נלכד בתוך הפקודה (תחת bash -e שורה נפרדת עצרה את הלולאה לפני שורת FAIL)');
  ok(/tail -40 "\/tmp\/test-\$f\.log"/.test(yml), 'CI: מספיק שורות מהיומן של בדיקה שנכשלה');
  ok(/\[ -f "\$S\/job\.json" \] \|\| \{ cat >\/dev\/null; exit 0; \}/.test(read('translator/tower-hook.sh')), 'tower-hook.sh: קורא את הקלט לפני יציאה מוקדמת (EPIPE)');

  /* ---------- 2. השרתון — טהור ---------- */
  const I = require(path.join(root, 'ibkr-proxy/lib/studioinc.js'));
  ok(I.errInfo('routine_auth')[1] === 1 && I.errInfo('no_claim')[0] === 'routine' && I.errInfo('net')[0] === 'drive' && I.errInfo('lang_unsupported')[1] === 4 && I.errInfo('xyz')[0] === 'claude',
    'חומרה ורכיב לפי הקוד — Routine שלא מאשר = P1, קוד לא מוכר = Claude P2');
  const J = 'j' + 'Q'.repeat(20);
  const f = I.jobFacts({ id: J, fires: 2, ar: 1, ended: 5, tw: { fp: 'abcdef012345' }, ev: 'nothex!' }, { state: 'failed', err: '' }, false);
  ok(f.err === 'worker' && f.bad && f.fp === 'abcdef012345' && f.ev === '' && !('spec' in f), 'jobFacts: רק מה שצריך, וגרסת סביבה לא תקינה נזרקת');
  ok(I.jobFacts({ id: J }, { state: 'running', err: '' }, true).err === 'stale', 'jobFacts: עבודה שנתקעה = "נתקעה"');
  const inc = I.incSync([], [Object.assign(f, { at: 1e12, fired: 1e12 - 1 })], [], [], 1e12 + 1);
  ok(inc.length === 1 && inc[0].st === 'o' && !JSON.stringify(inc).includes('nothex'), 'incSync: תקלה פתוחה, בלי טקסט חופשי');
  ok(I.majorActive({ at: 1, x: 0 }) && !I.majorActive({ at: 1, x: 2 }) && !I.majorActive(null), 'majorActive');
  const api = read('ibkr-proxy/api/studio.js');
  ok(/error: 'major'/.test(api) && /body\.mo !== true/.test(api) && /auto \|\| body\.mo !== true/.test(api), 'השרתון: התחלה ו"המשך" מחכים בתקלה רחבה; mo עוקף; ההמשך האוטומטי תמיד מחכה');
  ok(/mi\.c === 'routine' && apiJob\(job\)/.test(api), 'השרתון: תקלה רחבה ב־Routine לא עוצרת עבודות במצב API (ולהפך)');
  ok(/const ic = await syncInc\(deps, uid, list, now\)/.test(api) && /inc: await incFor\(uid\)/.test(api) && /I\.incCloseJob/.test(api), 'השרתון: סנכרון ברשימה, תצוגה במגדל, סגירה במחיקה');
  ok(/patch\.ev = body\.ev/.test(api) && /'inc', 'mi'(, 'tr', 'pv')?(, 'q', 'ij')?(, 'jd')?(, 'tg')?(, 'sc')?\]/.test(read('ibkr-proxy/lib/studio.js')), 'השרתון: גרסת הסביבה מה־claim; התקלות נשמרות כ־JSON');

  /* ---------- 3. העובד ---------- */
  const job = read('translator/job.py');
  ok(/def env_version\(\):/.test(job) && /c\.call\('claim', ev=env_version\(\)(?:, pv=prompt_versions\(\))?\)/.test(job) && /rel\.startswith\('tests\/'\)/.test(job), 'job.py: גרסת הסביבה (בלי הבדיקות) נשלחת ב־claim');

  /* ---------- 4. הטלפון ---------- */
  const st = await import(path.join(root, 'studio.js'));
  const raw = { open: 1, mi: { no: 2, c: 'routine', e: 'no_claim', at: 5, x: 0, n: 3 }, list: [
    { no: 7, j: J, c: 'claude', e: 'tower_stop', s: 2, st: 'o', by: 'z', f: 1, l: 2, rt: 0, n: 1, m: 0, ev: 1,
      rc: [{ t: 'up', c: 'drive', k: 'dl_fail', p: 60 }, { t: 'evil', c: 'drive', k: 'x', p: 40 }, { t: 'known', c: 'claude', k: 'abcdef012345', p: 40 }],
      tl: [[1, 'o'], [2, 'a', 'drive', 'dl_fail', 3], [3, 'a', 'evil', '<b>', 4], [4, 'zz']], sim: { no: 3, f: 0, by: 'c', min: 12 }, al: [{ no: 3, c: 'drive', k: 'dl_fail', s: 2, x: 0 }, { no: 4, c: 'x', k: 'y', s: 1 }] },
    { no: 8, j: 'bad', c: 'claude', e: 'worker', s: 2, st: 'o' }, { no: 9, j: J, c: 'claude', e: '<script>', s: 2, st: 'o' }] };
  const v = st.normInc(raw);
  ok(v.list.length === 1 && v.list[0].by === '' && v.list[0].rc.length === 2 && v.list[0].tl.length === 2 && v.list[0].al.length === 1 && v.list[0].sim.by === 'c',
    'normInc: רק רשומות, סיבות, אירועים והתראות מהקטלוג');
  ok(st.majorOn(v) && !st.majorOn(st.normInc({ list: [], mi: { no: 1, c: 'drive', e: 'auth', at: 1, x: 2 } })) && st.normInc(null) === null, 'majorOn: רק תקלה רחבה פעילה');
  ok(st.chainFor('inc', 7).map((x) => x.v).join() === 'home,settings,tower,inc', 'רענון בדף תקלה — חוזר דרך המגדל');
  const sj = read('studio.js');
  ok(/function pageInc\(p\)/.test(sj) && /else if \(ui\.view === 'inc'\) pageInc\(p\)/.test(sj) && /p\.append\(\.\.\.incSection\(\)\)/.test(sj), 'מגדל: מקטע תקלות ודף תקלה');
  ok(/const mb = majorBanner\(\); if \(mb\) p\.append\(mb\);   \/\/ v371: תקלה רחבה — במקום/.test(sj) && /const ub = mb \? null : urgentBanner\(\)/.test(sj), 'בית: באנר תקלה רחבה במקום באנר ההתראות (בלי כפילות)');
  ok(/rec\.up\.wait === 'major'\) acts\.push\(btn\('st-btn wide', T\('studioStartAnyway'\), \(\) => \{ rec\.up\.wait = ''; tryStart\(id, false, true\); \}/.test(sj)
    && /j\.error === 'major' && typeof askConfirm === 'function'\) askConfirm\(T\('studioMajorQ'/.test(sj) && /case 'major': return T\('studioErrMajor'\)/.test(sj),
  'עבודה שמחכה לתקלה רחבה: "להתחיל בכל זאת" בהתחלה ובהמשך');
  ok(/x\.up\.wait === 'major' && !x\.up\.started\)\) \{ r\.up\.wait = ''; tryStart\(r\.id\); \}/.test(sj), 'התקלה הרחבה עברה — עבודות שחיכו מתחילות לבד');
  ok(/if \(ix\) p\.append\(list\(incRow\(ix, true\)\)\)/.test(sj), 'דף העבודה: שורה אחת לתקלה שלה (הפרטים בדף התקלה — בלי כפילות)');
  ok(!/innerHTML/.test(sj.slice(sj.indexOf('function incTitle'), sj.indexOf('function fbWhy'))), 'התקלות נבנות בלי innerHTML');
  const app = read('app.js');
  const keys = ['studioIncNoClaim', 'studioIncRoutine', 'studioIncRate', 'studioIncServer', 'studioIncMonth', 'studioIncTower', 'studioIncBudget', 'studioIncStale', 'studioIncNet',
    'studioIncUpload', 'studioIncLang', 'studioIncRDown', 'studioIncWorker', 'studioIncStO', 'studioIncStW', 'studioIncStR', 'studioIncStX', 'studioIncByC', 'studioIncByU',
    'studioIncEvO', 'studioIncEvF', 'studioIncEvW', 'studioIncEvC', 'studioIncEvR', 'studioIncEvX', 'studioIncEvM', 'studioIncEvA', 'studioIncEvK',
    'studioRcT', 'studioRcKnown', 'studioRcWide', 'studioRcUp', 'studioRcSame', 'studioRcEnv', 'studioRcSelf', 'studioIncMajorTag', 'studioIncEnvTag', 'studioIncRowT',
    'studioMajorT', 'studioMajorS', 'studioMajorQ', 'studioErrMajor', 'studioIncSec', 'studioIncSecN', 'studioIncSumO', 'studioIncSumW', 'studioIncSumR', 'studioIncSumX',
    'studioIncGone', 'studioIncKind', 'studioIncHandled', 'studioIncClosedAt', 'studioIncFails', 'studioIncSimT', 'studioIncSim', 'studioIncSimHow', 'studioIncToJob', 'studioTwHelloMajor'];
  for (const k of keys) ok((app.match(new RegExp('\\b' + k + ': "', 'g')) || []).length === 2, 'מחרוזת ' + k + ' בעברית ובאנגלית');
  const css = read('studio.css');
  ok(/\.st-rc-r \{/.test(css) && /\.st-banner\.st-major/.test(css) && /\[data-theme="dark"\] \.st-root \.g/.test(css), 'עיצוב: שורש סביר, באנר תקלה רחבה, ירוק גם בכהה');

  /* ---------- 5. גרסה ---------- */
  const ver = (app.match(/const APP_VERSION = '(v\d+)'/) || [])[1];
  const sw = (read('sw.js').match(/CACHE_NAME = '[^']*-(v\d+)'/) || [])[1];
  ok(+ver.slice(1) >= 371 && swVersionOk(ver, sw), 'APP_VERSION ≥ v371 ו־sw.js תואם או גרסה אחת אחורה');
  console.log('\nכל ' + n + ' הבדיקות עברו ✓');
})().catch((e) => { console.error(e); process.exit(1); });
