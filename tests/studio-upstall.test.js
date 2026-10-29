// 29/10/2026 (צילום של המשתמש: 1:20 ש׳ "מחכה שהסרטון יסיים לעלות"): ההעלאה של הסרטון — זיהוי עצירה בשרתון (upStallStep +
// התראה up_stall), מצב ההעלאה הנייטיב לענן מ־Studio לאנדרואיד (spec.vc, normVcp זהה בטלפון ובשרתון), ו־PhUpJob (UIDT).
// הרצה: node tests/studio-upstall.test.js
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }

(async () => {
  global.atob = global.atob || ((s) => Buffer.from(s, 'base64').toString('binary'));
  const S = require(path.join(root, 'ibkr-proxy/lib/studio.js'));
  const st = await import('../studio.js');
  const M = S.UP_STALL_MS, t0 = 1e12;

  /* ---------- 1. upStallStep ---------- */
  let r = S.upStallStep(null, 100, t0);
  ok(r.vst && r.vst.b === 100 && r.vst.at === t0 && r.vst.n === 0 && !r.push, 'פעם ראשונה — נרשם, בלי התראה');
  ok(S.upStallStep(r.vst, 100, t0 + M - 1).vst === null, 'לא זז פחות מ־10 דק׳ — בלי שינוי ובלי התראה');
  const s1 = S.upStallStep(r.vst, 100, t0 + M);
  ok(s1.push && s1.vst.n === 1 && s1.vst.at === t0, 'לא זז 10 דק׳ — התראה אחת');
  ok(!S.upStallStep(s1.vst, 100, t0 + 5 * M).push, 'אחרי ההתראה — לא שוב על אותה עצירה');
  const s2 = S.upStallStep(s1.vst, 200, t0 + 6 * M);
  ok(!s2.push && s2.vst.n === 0 && s2.vst.b === 200, 'זז שוב — מתאפס (עצירה נוספת = התראה נוספת)');
  ok(S.upStallStep(s2.vst, 200, t0 + 7 * M).push, 'נעצר שוב — התראה נוספת');
  ok(S.upStallStep('x', 'y', t0).vst.b === 0, 'קלט לא תקין — לא נכשל');
  ok(S.JSON_FIELDS.includes('vst') && S.JSON_FIELDS.includes('vcp'), 'vst ו־vcp נשמרים כ־JSON');

  /* ---------- 2. normVcp — זהה בשרתון ובטלפון ---------- */
  const cases = [null, 'x', {}, { p: -1 }, { p: 'a' }, { p: 0.12345 }, { p: 7 }, { p: 0.5, e: 'net' }, { p: 0.5, e: 'BAD CODE' }, { p: 1, e: 'x'.repeat(40) }];
  for (const c of cases) {
    const a = S.normVcp(c, 5), b = st.normVcp(c && typeof c === 'object' ? Object.assign({ at: 5 }, c) : c);
    ok(JSON.stringify(a) === JSON.stringify(b), 'normVcp זהה: ' + JSON.stringify(c));
  }
  ok(S.normVcp({ p: 0.12345 }, 1).p === 0.123 && S.normVcp({ p: 7 }, 1).p === 1, 'p בעיגול לאלפית, עד 1');
  const base = { name: 'talk.mp4', size: 900e6, type: 'video/mp4', dur: 3600, from: 'en', to: ['he'], mode: 'haiku-high', eng: 'api', cap: 5, ph: 1, pb: 'same' };
  const sv = S.normSpec(Object.assign({ vc: 1 }, base)), sn = S.normSpec(Object.assign({ vc: 2 }, base));
  ok(sv && sv.vc === 1 && sn && !('vc' in sn), 'spec.vc נשמר רק כ־1');
  ok(S.publicJob({ id: 'a', spec: { vc: 1 }, vcp: { p: 0.4, at: 9 } }).vcp.p === 0.4 && S.publicJob({ id: 'a', spec: {}, vcp: { p: 0.4 } }).vcp === null,
    'publicJob: vcp רק בעבודה עם vc');

  /* ---------- 3. השרתון וההתראה ---------- */
  const api = read('ibkr-proxy/api/studio.js');
  ok(/'phVp'/.test(api) && /async function upStallCheck\(deps, job, up, now\)/.test(api) && /notify\(deps, job\.uid, 'up_stall', job\.id, now\)/.test(api),
    'upStallCheck: מתריע up_stall לבעל העבודה');
  ok(/body\.wv === true && job\.kind === 'tr'/.test(api) && /await upStallCheck\(deps, job, up, now\)/.test(api), 'הבדיקה רצה בדיווח wv של העובד (פעם ב־5 דק׳ — בלי שאילתה בכל פנייה)');
  ok(/job\.spec\.vc === 1/.test(api) && /'file_size'/.test(api), 'העלאת הסרטון מהטלפון: רק עבודה עם vc, רק בגודל של spec.size');
  const WP = require(path.join(root, 'ibkr-proxy/lib/webpush.js'));
  ok(WP.KINDS.includes('up_stall') && WP.TEXT.he.up_stall && WP.TEXT.en.up_stall, 'up_stall — סוג התראה, בעברית ובאנגלית');
  ok(!/\.name|file/i.test(WP.TEXT.he.up_stall.join(' ')), 'בלי שם הקובץ בהתראה');

  /* ---------- 4. הדפדפן ---------- */
  const src = read('studio.js');
  ok(/api: typeof navigator !== 'undefined' && \/Android\/\.test\(navigator\.userAgent/.test(src), 'Background Fetch רק באנדרואיד (במחשב ובאייפון — ההעלאה הרגילה)');
  ok(/spec\.vc = 1/.test(src) && /vc: ?1/.test(src), 'עבודה מ־Studio לאנדרואיד מבקשת את הסרטון לענן (spec.vc + ב־intent)');
  ok(/rec\.srv && rec\.srv\.fv/.test(src), 'הנגן מקבל את הסרטון גם כשהוא עלה מהאפליקציה (srv.fv)');
  ok(read('studiostore.js').includes('export const R2_CONC = 4'), 'ארבעה חיבורים בהעלאה מהדפדפן');

  /* ---------- 5. אנדרואיד ---------- */
  const A = 'android/app/src/studio/';
  const man = read(A + 'AndroidManifest.xml'), job = read(A + 'java/io/github/yishaiguedj1/snowball/PhUpJob.kt');
  ok(/android:name="\.PhUpJob"/.test(man) && /BIND_JOB_SERVICE/.test(man.slice(man.indexOf('.PhUpJob') - 400, man.indexOf('.PhUpJob') + 400)), 'PhUpJob במניפסט, עם BIND_JOB_SERVICE');
  ok(/setUserInitiated\(true\)/.test(job) && /SDK_INT < 34/.test(job) && /return true\s*\/\/ לתזמן שוב/.test(job), 'UIDT מאנדרואיד 14, ממשיך אחרי עצירה');
  const act = read(A + 'java/io/github/yishaiguedj1/snowball/PhActivity.kt'), svc = read(A + 'java/io/github/yishaiguedj1/snowball/PhService.kt');
  ok(/"vc"/.test(act) && /PhUpJob\.schedule/.test(act), 'PhActivity קורא vc ומתזמן את ההעלאה');
  ok(/optBoolean\("vJob"\)/.test(svc) && /PhWork\.video\(/.test(svc), 'בלי UIDT — השירות מעלה את הסרטון אחרי הקול');
  const net = read(A + 'java/io/github/yishaiguedj1/snowball/PhNet.kt');
  ok(/const val CONC = 4/.test(net) && /fun uploadPar\(/.test(net), 'ארבעה חיבורים בהעלאה הנייטיב');
  const work = read(A + 'java/io/github/yishaiguedj1/snowball/PhWork.kt');
  ok(/ACT_VCANCEL\) \{ PhWork\.vCancel = true/.test(svc) && /setAction\(PhService\.ACT_VCANCEL\)/.test(work) && /it\.put\("vE", "cancel"\)/.test(work) && /put\("e", "cancel"\)/.test(work),
    'ביטול בהתראת הסרטון — עוצר רק את ההעלאה לענן, נרשם ולא חוזר');
  ok(/@Synchronized fun update/.test(read(A + 'java/io/github/yishaiguedj1/snowball/PhStore.kt')), 'PhStore.update מסונכרן (שני תהליכונים כותבים)');

  console.log('\nכל ' + n + ' הבדיקות עברו ✓');
})().catch((e) => { console.error(e); process.exit(1); });
