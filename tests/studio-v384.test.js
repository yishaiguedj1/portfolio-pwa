// v384: סטודיו התרגום — מגדל 2.0, מתג חירום במצב אזהרה (ServiceNow: Kill switch · warn_only):
// (1) מצב צל — כש"הרגיל" משתנה משמעותית, הספים החדשים רק מזהירים 3 עבודות, והמגדל אוכף את הישנים;
// (2) "המשך" חוזר — השלישי ב־24 שעות לאותה עבודה = לולאה: ההמשך האוטומטי מוותר, ידני רק באישור.
// הבדיקות המלאות: ibkr-proxy/tests/run.js (בלוק v384), translator/tests/test_tower.py (test_shadow, test_shadow_hook).
// הרצה: node tests/studio-v384.test.js
const fs = require('fs');
const path = require('path');
const { swVersionOk } = require('./_swver');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

(async () => {
  /* ---------- 1. השרתון והמגדל — אותם קבועים ---------- */
  const S = require(path.join(root, 'ibkr-proxy/lib/studio.js'));
  const tower = read('translator/tower.py');
  ok(+((tower.match(/^RED_X, WARN_X, CAP_X = ([\d.]+)/m) || [])[1]) === S.RED_X, 'RED_X זהה בשרתון ובמגדל');
  ok(S.SHADOW_N === 3 && /if not 0 < n <= 3:/.test(tower), '3 עבודות בצל — זהה בשרתון ובמגדל');
  ok(/lv, why, info = shadow_assess\(/.test(tower) && /return 'warn', why, dict\(info, sh=1\)/.test(tower), 'המגדל: בצל — אוכף את הישנים, החדשים רק מזהירים');
  ok(/'sh': job\.get\('sh'\) if isinstance\(job\.get\('sh'\), dict\) else None/.test(read('translator/job.py')), 'העובד שומר את מצב הצל מהלקיחה');
  const api = read('ibkr-proxy/api/studio.js');
  ok(/const step = S\.thStep\(th\[m\], nm\);/.test(api) && /if \(job\.kind === 'tr' && job\.spec && !job\.c0\)/.test(api), 'השרתון: צעד הספים רק בלקיחה הראשונה (בהמשך — אותו צל)');
  ok(/rh\.length >= S\.LOOP_N - 1 && \(auto \|\| body\.lo !== true\)/.test(api) && /if \(f\.ok\) await patchJob\(deps, job\.id, \{ rh: rhNext \}\)/.test(api), 'השרתון: לולאה = השלישי ב־24 שעות; נספר רק "המשך" שהפעיל סשן');
  ok(/'claude:loop': 2/.test(read('ibkr-proxy/lib/studioops.js')), 'התראה claude:loop בקטלוג (P2)');
  ok(S.loopRecent({ rh: [1, 5, 'x', 9e15] }, 10).length === 2, 'loopRecent: רק זמנים תקינים מהעבר');

  /* ---------- 2. הטלפון ---------- */
  const st = await import(path.join(root, 'studio.js'));
  ok(JSON.stringify(st.normSh({ 'opus-medium': 2, 'opus-high': 0, evil: 1, 'sonnet-high': 7 })) === '{"opus-medium":2}' && JSON.stringify(st.normSh(null)) === '{}', 'normSh: רק מצבים מוכרים, 1–3');
  const tw = st.normTw({ lv: 'warn', x: 2.5, sh: 1, shn: 2 });
  ok(tw.sh === true && tw.shn === 2 && st.normTw({ lv: 'ok', x: 1, sh: 1 }).sh === false, 'normTw: "בספים החדשים היה נעצר" רק באזהרה');
  const sj = read('studio.js');
  ok(/t\.textContent = tw\.sh \? T\('studioShWarn'\)/.test(sj), 'דף העבודה: שורת המגדל אומרת "מצב צל"');
  ok(/const shn = ui\.sh && ui\.sh\[id\];/.test(sj), 'המגדל: "הרגיל שלך" — כמה עבודות עד אכיפה');
  ok(/j\.error === 'loop' && typeof askConfirm === 'function'\) askConfirm\(T\('studioLoopQ'/.test(sj) && /resumeSrv\(id, ov, mo, mode, true\), \{ ok: T\('studioLoopOk'\), danger: true \}/.test(sj), '"המשך" שלישי — שואלים, באישור הרסני');
  ok(/case 'claude:loop': return T\('studioAlClaudeLoop'\);/.test(sj), 'תווית להתראה החדשה');
  const app = read('app.js');
  for (const k of ['studioLoopQ', 'studioLoopOk', 'studioAlClaudeLoop', 'studioShWarn', 'studioShRow', 'studioShRow1'])
    ok((app.match(new RegExp('\\b' + k + ': "', 'g')) || []).length === 2, 'מחרוזת בעברית ובאנגלית: ' + k);

  /* ---------- 3. גרסה ---------- */
  const ver = (app.match(/APP_VERSION = '(v\d+)'/) || [])[1] || '';
  ok(+ver.slice(1) >= 384 && swVersionOk(ver), 'APP_VERSION ≥ v384 ו־sw.js תואם (או גרסה אחת אחורה)');
  console.log('\n' + n + ' passed');
})().catch((e) => { console.error(e); process.exit(1); });
