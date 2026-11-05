// 01/11/2026 (סבב 3, I3): רשימת עבודה וחצי מחיר — הצד של הטלפון.
// הבדיקות המלאות: ibkr-proxy/tests/run.js (בלוק "חצי מחיר") ו־translator/tests/test_batch.py.
// הרצה: node tests/studio-batch.test.js
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

(async () => {
  const st = await import(path.join(root, 'studio.js'));
  const S = require(path.join(root, 'ibkr-proxy/lib/studio.js'));
  ok(String(st.WL_RE) === String(S.WL_RE), 'WL_RE זהה בטלפון ובשרתון');
  ok(st.LIST_MAX === 5 && /MAX_ACTIVE = 5\b/.test(read('ibkr-proxy/lib/studio.js')), 'LIST_MAX = MAX_ACTIVE של השרתון');
  const ids = new Set(Array.from({ length: 50 }, () => st.wlNew()));
  ok([...ids].every((x) => st.WL_RE.test(x)) && ids.size === 50, 'wlNew: מזהה תקין וייחודי');
  ok(st.BT_EST > 0.5 && st.BT_EST < 1, 'BT_EST: שמרני — מעל ההנחה של התור');
  const j = st.normJob({ id: 'jAAAAAAAAAAAAAAAAAAAA', spec: { name: 'a.mp4', bt: 1, wl: 'ab12cd34ef' }, srv: { id: 'jAAAAAAAAAAAAAAAAAAAA', state: 'queued', bw: 1 } });
  ok(j && j.spec.bt === 1 && j.spec.wl === 'ab12cd34ef' && j.srv.bw === true, 'normJob: bt, wl ו־bw נשמרים אחרי רענון');
  const j2 = st.normJob({ id: 'jAAAAAAAAAAAAAAAAAAAA', spec: { bt: 2, wl: 'X!' }, srv: { id: 'jAAAAAAAAAAAAAAAAAAAA', bw: 0 } });
  ok(j2 && !j2.spec.bt && !j2.spec.wl && !j2.srv.bw, 'normJob: ערכים לא תקינים — נזרקים');
  const sj = read('studio.js');
  ok(/net\.api\('btNow', \{ job: id, src: 'job' \}\)/.test(sj) && /askConfirm\(T\('studioBtNowQ'\)/.test(sj), 'להמשיך עכשיו — רק אחרי אישור');
  ok(/est\.usd = Math\.round\(est\.usd \* BT_EST \* 100\) \/ 100/.test(sj), 'האומדן בחצי מחיר — לפני ההתחלה, עם הסכום');
  // 02/11/2026: גם דרך Studio לאנדרואיד (ph.nu) — "מתי" מוצג, והחצי מחיר נכנס למפרט ולאומדן
  ok(/\(f\.ph && f\.ph\.nu\)\) && !f\.link && !f\.ka && !\(f\.ph && !f\.ph\.nu\)/.test(sj) && /P\.nu && btOk\(f\) && f\.bt\) spec\.bt = 1/.test(sj)
    && (sj.match(/est\.usd = Math\.round\(est\.usd \* BT_EST \* 100\) \/ 100/g) || []).length === 2, 'חצי מחיר גם בבחירה דרך האפליקציה');
  const S2 = S.normSpec({ name: 'a.mp4', size: 1, dur: 60, from: 'en', to: ['he'], eng: 'api', nu: 1, bt: 1 });
  ok(S2 && S2.bt === 1, 'השרתון: עבודת nu עם חצי מחיר — נשמר');
  // 2/11/2026 (בקשת המשתמש: "לוודא שהעבודה באמת מחכה בתור ושאין באג שתוקע"): מצב התור מהשרת, והשלב שמחכה בלי "לוקח יותר מהרגיל"
  const jq = st.normJob({ id: 'jAAAAAAAAAAAAAAAAAAAA', spec: { name: 'a.mp4', bt: 1 }, srv: { id: 'jAAAAAAAAAAAAAAAAAAAA', state: 'queued', bw: 1, bq: { s: 's', t: 1793610400000 } } });
  ok(jq.srv.bq && jq.srv.bq.s === 's' && jq.srv.bq.t === 1793610400000, 'normJob: מצב התור (bq) נשמר');
  const jq2 = st.normJob({ id: 'jAAAAAAAAAAAAAAAAAAAA', spec: { name: 'a.mp4' }, srv: { id: 'jAAAAAAAAAAAAAAAAAAAA', bq: { s: 'zz', t: 5 } } });
  ok(jq2.srv.bq === null, 'normJob: מצב תור לא תקין — נזרק');
  const N = await import(path.join(root, 'studionet.js'));
  const now = Date.now(), prog = { st: 'tl', p: 0, stg: { tr: { s: now - 7e6, e: now - 6.5e6 }, al: { s: now - 6.5e6, e: now - 6e6 }, tl: { s: now - 6e6, e: 0 } } };
  const est = { tr: 300, al: 200, tl: 60, rv: 240, bn: 240, sv: 60 };
  const mOver = N.progressModel({ state: 'queued', prog }, est, { done: true }, now);
  const mBw = N.progressModel({ state: 'queued', prog, bw: true }, est, { done: true }, now);
  const rO = mOver.stages.find((x) => x.id === 'tl'), rB = mBw.stages.find((x) => x.id === 'tl');
  ok(rO.over === true && rB.state === 'now' && rB.bw === true && rB.over === false && rB.left === rB.est, 'progressModel: בתור החיסכון — לא "לוקח יותר מהרגיל", והצפי = השלב כולו');
  ok(/mm\.bw \? T\('studioBwShort'\)/.test(sj) && /return bwLine\(rec\)/.test(sj) && /bw: !!\(rec\.srv && rec\.srv\.bw\)/.test(sj), 'המסך: שורת התור ותא הזמן של השלב שמחכה');
  const app = read('app.js');
  for (const k of ['studioNowBwS', 'studioNowBwG', 'studioNowBwE', 'studioNowBwN', 'studioSrvEvBt', 'admSvBt', 'admSvBtP', 'admSvBtF', 'admSvBtErr'])
    ok((app.match(new RegExp('\\b' + k + ': "', 'g')) || []).length === 2, 'מחרוזת בעברית ובאנגלית: ' + k);
  const agent = read('translator/agent.py');
  ok(/BT_ERRS = \('auth', 'bad', 'rate', 'srv', 'net', 'other'\)/.test(agent) && JSON.stringify(S.BT_ERRS) === JSON.stringify(['auth', 'bad', 'rate', 'srv', 'net', 'other']), 'BT_ERRS זהה בסוכן ובשרתון');
  console.log(n + ' בדיקות עברו');
})().catch((e) => { console.error(e); process.exit(1); });
