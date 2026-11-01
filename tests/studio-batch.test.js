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
  ok(/net\.api\('btNow', \{ job: id \}\)/.test(sj) && /askConfirm\(T\('studioBtNowQ'\)/.test(sj), 'להמשיך עכשיו — רק אחרי אישור');
  ok(/est\.usd = Math\.round\(est\.usd \* BT_EST \* 100\) \/ 100/.test(sj), 'האומדן בחצי מחיר — לפני ההתחלה, עם הסכום');
  console.log(n + ' בדיקות עברו');
})().catch((e) => { console.error(e); process.exit(1); });
