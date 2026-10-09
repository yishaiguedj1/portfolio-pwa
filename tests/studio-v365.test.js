// v365: סטודיו התרגום — מגדל הפיקוח 2.0, שלב א׳ (בהשראת ServiceNow Event Management + Service Health):
// אירועים מכל המקורות → התראות (איחוד, קיבוץ, סגירה), מפת השירות, ובריאות הסטודיו (ציון, זמינות 30 יום, MTTR).
// הבדיקות המלאות: ibkr-proxy/tests/run.js (הזרימה מול שרתון מדומה), translator/tests/test_worker.py (test_ops_events).
// הרצה: node tests/studio-v365.test.js
const fs = require('fs');
const path = require('path');
const { swVersionOk } = require('./_swver');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

(async () => {
  /* ---------- 1. המנוע (טהור) ---------- */
  const O = require(path.join(root, 'ibkr-proxy/lib/studioops.js'));
  const J = 'jAAAAAAAAAAAAAAAAAAAA';
  ok(O.normEvents([{ c: 'vt', k: 'asr' }, { c: 'vt', k: 'evil' }, { c: 'x', k: 'asr' }, 'junk', { c: 'drive', k: 'full', ok: true, extra: '<b>' }]).length === 2
    && JSON.stringify(O.normEvents({ c: 'drive', k: 'full', ok: true, t: 'x' })) === '[{"c":"drive","k":"full","ok":true}]', 'אירועים — רק מהקטלוג, בלי שדות נוספים');
  let al = O.opsApply([], [{ c: 'drive', k: 'dl_retry' }, { c: 'drive', k: 'dl_retry' }], J, 0);
  ok(al.length === 1 && al[0].n === 2 && al[0].s === 4, 'אירועים זהים → התראה אחת עם מונה');
  ok(O.opsApply(al, [{ c: 'drive', k: 'dl_retry' }], J, 5, true) === null, 'once — צפייה חוזרת לא מגדילה את המונה');
  al = O.opsApply(al, [{ c: 'drive', k: 'dl_fail' }, { c: 'claude', k: 'tw_warn' }], J, 10);
  let v = O.opsView(al, 20);
  const g = v.open.find((x) => x.c === 'drive');
  ok(v.open.length === 2 && g.k === 'dl_fail' && g.rel === 1 && v.comp.drive === 2 && v.comp.claude === 3 && v.score === 100 - 20 - 2 - 8, 'קיבוץ לפי רכיב ועבודה (הראשית = החמורה), מצב לכל רכיב, ציון בריאות');
  al = O.opsApply(al, [{ c: 'claude', k: 'tw_warn', ok: true }], J, 60010);
  v = O.opsView(al, 60010);
  ok(v.comp.claude === 0 && v.mttr === 1, 'ok סוגר את ההתראה; זמן התיקון (דק׳) נכנס לממוצע');
  al = O.opsCloseJob(al, J, 3 * 3600e3);      // התראת P2 פתוחה 3 שעות → זמינות 99.6%
  v = O.opsView(al, 3 * 3600e3);
  ok(v.open.length === 0 && v.score === 100 && v.avail === 99.6, 'עבודה שהסתיימה סוגרת את ההתראות שלה; זמינות = הזמן בלי P1–P2');
  ok(JSON.stringify(O.towerEvents({ lv: 'red' })) === JSON.stringify([{ c: 'claude', k: 'tw_warn', ok: true }, { c: 'claude', k: 'tw_stop' }])
    && O.fireEvent('routine_rate').k === 'rate' && O.fireEvent('routine_down').k === 'unsure' && O.fireEvent('routine_auth').k === 'fire' && O.fireEvent('wait') === null,
    'המגדל וההפעלה → אירועים');
  ok(JSON.stringify(O.COMPONENTS) === JSON.stringify(['phone', 'drive', 'server', 'routine', 'claude', 'vt']), 'מפת השירות — השרשרת לפי הסדר');

  /* ---------- 2. השרתון והעובד ---------- */
  const api = read('ibkr-proxy/api/studio.js');
  ok(/async function raise\(/.test(api) && /O\.normEvents\(body\.ev\)/.test(api) && /O\.towerEvents\(up\.tw\)/.test(api) && /O\.fireEvent\(f\.error\)/.test(api)
    && /op === 'event'/.test(api) && /ops: O\.opsView/.test(api), 'השרתון: אירועים מהעובד, מהמגדל, מההפעלה ומהטלפון; status מחזיר את הבריאות');
  ok(/raise\(deps, uid, \[\{ c: 'claude', k: 'stale' \}\], j\.id, now, true\)/.test(api), 'השרתון: עבודה שנתקעה — התראה פעם אחת');
  ok((api.match(/closeJobOps\(deps/g) || []).length >= 3, 'השרתון: סוף / ביטול / מחיקה סוגרים את ההתראות של העבודה');
  ok(/\} catch \(e\) \{\}\n\}/.test(api.slice(api.indexOf('async function raise('), api.indexOf('async function raise(') + 500)), 'השרתון: תקלה ברישום אירוע לא מפילה את הפעולה');
  const job = read('translator/job.py');
  ok(/def event\(self, c, k, ok=False\)/.test(job) && /ctx\.event\('vt', VT_KIND\.get\(args\[0\], 'other'\)\)/.test(job) && /ctx\.event\('drive', 'dl_retry', ok=True\)/.test(job) && /ctx\.event\('vt', 'setup'\)/.test(job),
    'העובד: אירועים מ־vt, Drive, הרשת וההתקנה — ו־ok כשחוזר');
  ok(/if now - _EV_SENT\.get\(key, 0\) < 60/.test(job), 'העובד: אותו אירוע לכל היותר פעם בדקה');

  /* ---------- 3. הטלפון ---------- */
  const M = await import(path.join(root, 'studio.js'));
  const N = M.normOps({ score: 72, avail: 99.2, mttr: 11, comp: { drive: 3, claude: 9, evil: 1 }, open: [{ c: 'drive', k: 'up_retry', s: 3, j: J, n: 4, l: 5, rel: 1 }, { c: 'evil', k: 'x', s: 1 }, { c: 'vt', k: '<b>', s: 2 }] });
  ok(N.score === 72 && N.comp.drive === 3 && N.comp.claude === 0 && !('evil' in N.comp) && N.open.length === 1 && N.open[0].rel === 1 && M.normOps('x') === null,
    'טלפון: normOps — רכיבים וסוגים תקינים בלבד');
  const st = read('studio.js');
  ok(/if \(ui\.ops\) p\.append\(\.\.\.opsSection\(ui\.ops\)\)/.test(st) && /function opsAlert\(c, k\)/.test(st), 'טלפון: מסך המגדל — בריאות, מפת השירות והתראות פתוחות');
  ok(/opsEvent\(id, \[\{ c: k\[0\], k: k\[1\] \}\]\)/.test(st) && /run\.err === 'net' \? null/.test(st), 'טלפון: העלאה שנכשלה → אירוע ("אין רשת" בטלפון — לא תקלה של הסטודיו)');
  const app = read('app.js');
  const kinds = Object.keys(O.KINDS);
  ok(kinds.length === 26, 'הקטלוג: 26 סוגי אירועים (v367: claude:budget, v368: claude:auto, v374: claude:inject)');
  for (const k of ['studioAlDriveUpRetry', 'studioAlRoutineNoClaim', 'studioAlClaudeTwStop', 'studioAlVtAsr', 'studioOpsMap', 'studioCmpVt', 'studioAgoM'])
    ok((app.match(new RegExp(k + ': "', 'g')) || []).length === 2, 'טלפון: ' + k + ' — עברית ואנגלית');
  const cases = (st.match(/case '[a-z]+:[a-z_]+': return T\('studioAl/g) || []).length;
  ok(cases === kinds.length - 1, 'טלפון: לכל סוג בקטלוג יש תווית (vt:other — ברירת המחדל)');

  /* ---------- 4. גרסה ---------- */
  const ver = (app.match(/const APP_VERSION = '(v\d+)'/) || [])[1];
  ok(+String(ver).slice(1) >= 365, 'APP_VERSION ≥ v365');
  ok(swVersionOk(ver), 'sw.js תואם (שווה או גרסה אחת אחורה בשלב התוכן)');
  console.log('# ' + n + ' בדיקות עברו');
})().catch((e) => { console.error('FAIL -', e && e.stack || e); process.exit(1); });
