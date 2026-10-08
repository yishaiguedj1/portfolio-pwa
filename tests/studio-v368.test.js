// v368: סטודיו התרגום — מגדל הפיקוח 2.0, סבב "התראות חכמות ושקט" (ServiceNow: Flapping, Alert Priority Score, Exception rules, Email digests,
// Respond automations, Blackout): מהבהבת, ציון עדיפות, השתקה עם תפוגה, דחופות מיד והקלות בסיכום 24 שעות, המתנה לפני כישלון
// (תקלה חולפת → "המשך" אוטומטי אחד), ובלי רענון גרסה באמצע העלאה.
// הבדיקות המלאות של השרתון: ibkr-proxy/tests/run.js (בלוק v368).
// הרצה: node tests/studio-v368.test.js
const fs = require('fs');
const path = require('path');
const { swVersionOk } = require('./_swver');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

(async () => {
  /* ---------- 1. השרתון — טהור ---------- */
  const O = require(path.join(root, 'ibkr-proxy/lib/studioops.js'));
  const S = require(path.join(root, 'ibkr-proxy/lib/studio.js'));
  const J = 'j' + 'x'.repeat(20);
  let t = 7e12, al = O.opsApply([], [{ c: 'drive', k: 'up_retry' }], J, t);
  for (let i = 0; i < 2; i++) { t += 60e3; al = O.opsApply(al, [{ c: 'drive', k: 'up_retry', ok: true }], J, t); t += 60e3; al = O.opsApply(al, [{ c: 'drive', k: 'up_retry' }], J, t); }
  ok(al.length === 1 && al[0].fl === 1 && al[0].r === 2, 'מהבהבת — אותה רשומה נפתחת שוב (לא התראה חדשה בכל פעם)');
  ok(O.priScore(2, 4, 'drive', 1) > O.priScore(1, 2, 'routine', 1) && O.priScore(1, 2, 'routine', 1) > O.priScore(1, 2, 'vt', 50), 'ציון עדיפות — עבודות שנפגעו › חומרה › משקל רכיב › מופעים');
  ok(O.MUTE_H.join() === '1,4,24' && O.muteSet({}, 'drive', 'up_retry', 48, t) === null, 'השתקה — רק שעה / 4 שעות / יום');
  ok(O.KINDS['claude:auto'] === 4, 'קטלוג: "המשכנו לבד" — מידע (P4), רק בסיכום');
  ok(S.RECOVER_WAIT === 3 * 60e3 && S.AUTO_RESUME_MAX === 1, 'המתנה לפני כישלון — 3 דקות, ו"המשך" אוטומטי אחד לעבודה');
  ok(S.isTransient('net', []) && S.isTransient('worker', ['drive:dl_fail']) && !S.isTransient('tower_stop', ['drive:dl_fail']) && !S.isTransient('worker', []), 'תקלה חולפת — Drive / רשת בלבד, אף פעם לא עצירה מכוונת');
  const api = read('ibkr-proxy/api/studio.js');
  ok(/op === 'mute'/.test(api) && /async function autoRecover/.test(api) && /if \(auto\) patch\.ar = /.test(api), 'השרתון: השתקה, והמשך אוטומטי שנרשם לפני ההפעלה (בלי כפילות)');
  ok(/'rl', 'mu'\]/.test(read('ibkr-proxy/lib/studio.js')), 'השתקות נשמרות כ־JSON (mu)');
  ok(/\$J fail --err <קוד>/.test(read('translator/RUNBOOK.md')) && /`--err net`/.test(read('translator/RUNBOOK.md')), 'RUNBOOK: תקלת Drive / רשת חוזרת → --err net (האפליקציה ממשיכה לבד)');

  /* ---------- 2. הטלפון ---------- */
  const st = await import(path.join(root, 'studio.js'));
  const o = st.normOps({ score: 90, avail: 99, comp: {}, open: [{ id: 'abcdef012345', c: 'drive', k: 'up_retry', s: 4, j: J, n: 3, f: 1, l: 2, fl: 1, r: 2, nj: 2, ps: 2140003, m: 9 }],
    digest: { hi: 1, lo: 3, top: [{ c: 'drive', k: 'up_retry', n: 3 }, { c: 'evil', k: 'x', n: 1 }] }, mu: [{ c: 'drive', k: 'up_retry', until: 9 }, { c: 'vt', k: '<b>', until: 9 }] });
  ok(o.open[0].fl && o.open[0].nj === 2 && o.open[0].ps === 2140003 && o.open[0].m === 9 && o.digest.lo === 3 && o.digest.top.length === 1 && o.mu.length === 1,
    'normOps: מהבהבת, ציון, השתקה, סיכום — רק סוגים תקינים');
  const rec = { srv: { state: 'failed', rw: Date.now() + 60e3 } };
  ok(st.recovering(rec) && !st.recovering({ srv: { state: 'failed', rw: 0 } }) && !st.recovering({ srv: { state: 'running', rw: 5 } }), 'recovering — רק עבודה שנכשלה בתקלה חולפת');
  const sj = read('studio.js');
  ok(/const urgent = o\.open\.filter\(\(a\) => a\.s <= 2 && !a\.m\)/.test(sj) && /T\('studioOpsDigestT'/.test(sj) && /T\('studioOpsMutedT'/.test(sj), 'מסך המגדל: דחופות מיד, קלות בסיכום 24 שעות, מושתקות מקופלות');
  ok(/const ub = urgentBanner\(\)/.test(sj), 'בית: באנר להתראה דחופה בלבד (P1–P2 שלא הושתקו)');
  ok(/rw: num\(s\.rec\)/.test(sj) && /T\('studioRecGo'\)/.test(sj) && /net\.api\('cancel'/.test(sj), 'עבודה מתאוששת: ספירה לאחור, "להמשיך עכשיו" ו"לא להמשיך לבד"');
  ok(/window\.snbStudioBusy = /.test(sj) && /window\.snbStudioBusy\(\)/.test(read('app.js')), 'חלון חסימה: גרסה חדשה לא מרעננת באמצע העלאה');
  ok(/case 'claude:auto': return T\('studioAlClaudeAuto'\)/.test(sj), 'תווית ל"המשכנו לבד"');
  const app = read('app.js');
  for (const k of ['studioAlClaudeAuto', 'studioRecBig', 'studioRecSoon', 'studioRecLine', 'studioBRecover', 'studioRecGo', 'studioRecStop', 'studioMutedOk', 'studioUnmutedOk',
    'studioOpsDigestT', 'studioOpsDigestTop', 'studioOpsMutedT', 'studioMutedUntil', 'studioUnmute', 'studioOpsFlap', 'studioOpsFlapS', 'studioAlOpened', 'studioAlJobs', 'studioAlScore',
    'studioAlToJob', 'studioMuteL', 'studioMute1', 'studioMute4', 'studioMute24', 'studioUrgent1', 'studioUrgentN'])
    ok((app.match(new RegExp('\\b' + k + ': "', 'g')) || []).length === 2, 'מחרוזת ' + k + ' בעברית ובאנגלית');

  /* ---------- 3. גרסה ---------- */
  const ver = (app.match(/const APP_VERSION = '(v\d+)'/) || [])[1];
  const sw = (read('sw.js').match(/CACHE_NAME = '[^']*-(v\d+)'/) || [])[1];
  ok(+ver.slice(1) >= 368 && swVersionOk(ver, sw), 'APP_VERSION ≥ v368 ו־sw.js תואם או גרסה אחת אחורה');
  console.log('\nכל ' + n + ' הבדיקות עברו ✓');
})().catch((e) => { console.error(e); process.exit(1); });
