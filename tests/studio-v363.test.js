// v363: סטודיו התרגום — מגדל הפיקוח לומד "רגיל" מהעבודות של המשתמש (החציון לשעת סרטון, לכל מצב), ומסך "מגדל הפיקוח".
// הבדיקות המלאות: ibkr-proxy/tests/run.js (הדגימות, הלקיחה, status), translator/tests/test_tower.py (הספים וה־Hook).
// הרצה: node tests/studio-v363.test.js
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
  const tw = read('translator/tower.py');
  const ph = (tw.match(/^PER_HOUR = (\{[^\n]+\})/m) || [])[1];
  ok(ph && JSON.stringify(JSON.parse(ph.replace(/'/g, '"'))) === JSON.stringify(S.NORM_DEF), 'ברירת המחדל לשעת סרטון — זהה בשרתון ובמגדל (PER_HOUR)');
  ok(new RegExp('^FIXED = ' + S.NORM_FIXED + '$', 'm').test(tw), 'עלות הפתיחה — זהה (FIXED)');
  ok(/^NORM_MIN, NORM_DUR_MIN = 3, 600/m.test(tw) && S.NORM_MIN === 3 && /NORM_DUR_MIN = 600/.test(read('ibkr-proxy/lib/studio.js')), 'מ־3 עבודות, סרטון קצר = 10 דק׳ — זהה');

  /* ---------- 2. השרתון — טהור ---------- */
  const SPEC = { mode: 'opus-medium', dur: 3600 };
  const smp = S.normSample({ kind: 'tr', fires: 1, spec: SPEC }, [{ usd: 4.004 }, { usd: 1 }], 7);
  ok(smp && smp.m === 'opus-medium' && smp.d === 3600 && smp.u === 5 && smp.at === 7 && Object.keys(smp).length === 4, 'דגימה = מצב, אורך, עלות וזמן — בלי שום דבר אחר');
  const L = [5, 9, 6].map((u) => ({ m: 'opus-medium', d: 3600, u }));
  const nm = S.learnedNorm(L, 'opus-medium');
  ok(nm.ph === 6 && nm.mx === 9 && nm.n === 3 && S.learnedNorm(L.slice(0, 2), 'opus-medium') === null && S.learnedNorm(L, 'opus-high') === null, 'החציון והכבדה ביותר — מ־3 עבודות, לכל מצב בנפרד');
  const V = S.normsView(L);
  ok(V['opus-medium'].ph === 6 && !V['opus-medium'].d && V['sonnet-medium'].d === true && V['sonnet-medium'].ph === 3 && Object.keys(V).length === 5, 'לטלפון: לכל מצב — הנלמד או ברירת המחדל');
  ok(S.workerJob({ id: 'j', kind: 'tr' }, nm).nm === nm && S.workerJob({ id: 'j', kind: 'tr' }).nm === null, 'העובד מקבל את "הרגיל" בלקיחה');
  const api = read('ibkr-proxy/api/studio.js');
  ok(/'studioStats'/.test(api) && /S\.normSample\(job, up\.use \|\| job\.use, now\)/.test(api) && /norm: S\.normsView/.test(api), 'השרתון: דגימה בסוף עבודה, "רגיל" בלקיחה וב־status');
  ok(/\.catch\(\(\) => \{\}\)/.test(api.slice(api.indexOf("'studioStats', job.uid"), api.indexOf("'studioStats', job.uid") + 200)), 'השרתון: תקלה בשמירת הדגימה לא מפילה את סוף העבודה');

  /* ---------- 3. העובד והמגדל ---------- */
  ok(/'nm': job\.get\('nm'\) if isinstance\(job\.get\('nm'\), dict\) else None/.test(read('translator/job.py')), 'job.py: "הרגיל" נשמר בקובץ המצב');
  ok(/def thresholds\(nm=None\)/.test(tw) && /2\.0 \* nm\['mx'\] \/ nm\['ph'\]/.test(tw) && /expected_usd\((st\.get\('spec'\)|spec), nm\)/.test(tw), 'tower.py: הצפוי לפי החציון שלך, והסף האדום לפחות פי 2 מהכבדה ביותר');

  /* ---------- 4. הטלפון ---------- */
  const M = await import(path.join(root, 'studio.js'));
  ok(M.normTw({ lv: 'ok', x: 1, b: 'u', nj: 4 }).nj === 4 && M.normTw({ lv: 'ok', x: 1, nj: 4 }).nj === 0, 'טלפון: normTw — "לפי N העבודות שלך" רק כשנלמד');
  const NN = M.normNorms({ 'opus-medium': { ph: 6, mx: 9, n: 3 }, 'sonnet-high': { ph: 4.2, n: 1, d: true }, evil: { ph: 1 }, 'opus-max': { ph: -1 } });
  ok(NN['opus-medium'].ph === 6 && NN['sonnet-high'].d === true && !NN.evil && !NN['opus-max'] && M.normNorms('x') === null, 'טלפון: normNorms — מצבים מוכרים ומספרים תקינים בלבד');
  ok(M.chainFor('tower', null).map((x) => x.v).join() === 'home,settings,tower', 'טלפון: רענון במסך המגדל — חוזר אליו (דרך ההגדרות)');
  const st = read('studio.js');
  ok(/function pageTower\(p\)/.test(st) && /ui\.view === 'tower'\) pageTower\(p\)/.test(st) && /go\('tower'\)/.test(st), 'טלפון: מסך "מגדל הפיקוח" — מההגדרות, משורת המגדל ומכרטיס העצירה');
  ok(/const c = btn\('st-tower ' \+ tw\.lv/.test(st), 'טלפון: שורת המגדל בדף העבודה = כפתור');
  const app = read('app.js');
  for (const k of ['studioTwT', 'studioTwSecNorm', 'studioTwNormU', 'studioTwNormD', 'studioTwNormLeft', 'studioTwNormLeft1', 'studioTwR1', 'studioTwR1U', 'studioTwRulesNote', 'studioTwHow', 'studioSecSafety', 'studioBack'])
    ok((app.match(new RegExp(k + ': "', 'g')) || []).length === 2, 'טלפון: ' + k + ' — עברית ואנגלית');

  /* ---------- 5. גרסה ---------- */
  const ver = (app.match(/const APP_VERSION = '(v\d+)'/) || [])[1];
  ok(+String(ver).slice(1) >= 363, 'APP_VERSION ≥ v363');
  ok(swVersionOk(ver), 'sw.js תואם (שווה או גרסה אחת אחורה בשלב התוכן)');
  console.log('# ' + n + ' בדיקות עברו');
})().catch((e) => { console.error('FAIL -', e && e.stack || e); process.exit(1); });
