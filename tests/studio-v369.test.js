// v369: סטודיו התרגום — מגדל הפיקוח בעיצוב התוכנית (המבנה של ServiceNow Horizon עם המראה של הסטודיו):
// בית המגדל (כותרת עם ברכה, אריחי "ציון יחיד" עם מגמה, התראות עם פס חומרה, פעולות מהירות) ורשומת התראה
// (מספר ALR, כרטיס כותרת עם תוויות, טאבים: פרטים · ציר · קשורות, השתקה ואישור). ותוצאת כל הפעלה של ה־Routine בעבודה.
// הבדיקות המלאות של השרתון: ibkr-proxy/tests/run.js (בלוק v369).
// הרצה: node tests/studio-v369.test.js
const fs = require('fs');
const path = require('path');
const { swVersionOk } = require('./_swver');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

(async () => {
  /* ---------- 1. השרתון ---------- */
  const O = require(path.join(root, 'ibkr-proxy/lib/studioops.js'));
  const J = 'j' + 'z'.repeat(20);
  let al = O.opsApply([], [{ c: 'drive', k: 'up_retry' }], J, 1e12);
  al = O.opsApply(al, [{ c: 'vt', k: 'asr' }], J, 1e12 + 1);
  ok(al.map((a) => a.no).join() === '1,2' && al[0].h[0][1] === 'o', 'מספר רץ לכל התראה וציר פעילות');
  ok(O.opsAck(al, 2, 1e12 + 2)[1].ak > 0 && O.opsAck(al, 7, 1e12) === null, '"אשר" — רק להתראה פתוחה שקיימת');
  const v = O.opsView(al, 1e12 + 3, null);
  ok(['score', 'avail', 'mttr'].every((k) => v.trend[k].length === 7), 'מגמה לשבוע לכל אחד משלושת הציונים');
  const api = read('ibkr-proxy/api/studio.js');
  ok(/op === 'ack'/.test(api) && /fr: \{ s: -1, ms: 0 \}/.test(api) && /if \(f\.fr\) await patchJob/.test(api), 'השרתון: אישור, ותוצאת ההפעלה נרשמת (גם "נקטע באמצע")');

  /* ---------- 2. הטלפון ---------- */
  const st = await import(path.join(root, 'studio.js'));
  const o = st.normOps({ score: 80, avail: 99, comp: {}, open: [{ id: 'abcdef012345', no: 42, c: 'routine', k: 'no_claim', s: 2, j: J, n: 1, l: 1, ak: 5, h: [[1, 'o'], [2, 'evil'], ['x', 'a']], sub: [{ no: 43, k: 'fire', s: 2, n: 1, l: 2 }, { k: '<b>', s: 1 }] }],
    trend: { score: [1, 2, 'x', 4, 5, 6, 7, 8], avail: [], mttr: [null, 3] } });
  const a = o.open[0];
  ok(a.no === 42 && a.ak === 5 && a.h.length === 1 && a.sub.length === 1 && o.trend.score.length === 7 && o.trend.score[1] === null,
    'normOps: מספר, אישור, ציר וקשורות — רק ערכים תקינים; מגמה עד 7 נקודות');
  ok(st.chainFor('alert', 42).map((x) => x.v).join() === 'home,settings,tower,alert', 'רענון ברשומת התראה — חוזר אליה (דרך המגדל)');
  const sj = read('studio.js');
  ok(/function pageAlert\(p\)/.test(sj) && /ui\.view === 'alert'\) pageAlert\(p\)/.test(sj) && /go\('alert', a\.no\)/.test(sj), 'רשומת התראה — מכל שורה במגדל');
  ok(/'altab:' \+ k/.test(sj) && /T\('studioAlTabT'/.test(sj) && /T\('studioAlTabR'/.test(sj), 'שלושה טאבים: פרטים · ציר · קשורות');
  ok(/net\.api\('ack'/.test(sj) && /!a\.m && !a\.ak/.test(sj), '"אשר" — ההתראה יורדת מהבאנר בבית');
  ok(/function scoreTile/.test(sj) && /function spark\(vals\)/.test(sj) && /createElementNS\(NS, 'svg'\)/.test(sj), 'אריחי "ציון יחיד" עם קו מגמה (SVG, בלי innerHTML)');
  ok(/'st-qa-b'/.test(sj) && /if \(!ui\.halt\) qa\.append/.test(sj), 'פעולות מהירות — "עצור הכל" רק כשהסוכנים לא עצורים ("להחזיר" בבאנר)');
  ok(!/function alertRows/.test(sj) && !/ui\.alOpen/.test(sj) && !/'st-health'/.test(sj), 'בלי כפילות: השורה הנפתחת של v368 וכרטיס הבריאות הישן הוסרו');
  ok(/T\('studioAlFire'\), fireTxt\(rec\.srv\.fr\)/.test(sj), 'רשומת התראה של ה־Routine — מה Anthropic ענה להפעלה');
  const app = read('app.js');
  for (const k of ['studioTwShort', 'studioTwHello', 'studioTwHello1', 'studioTwHelloN', 'studioTwScore', 'studioTwAvail', 'studioTwAll', 'studioTwLess', 'studioTwQuick', 'studioQaNew',
    'studioQaResume', 'studioQaHalt', 'studioSev1', 'studioSev2', 'studioSev3', 'studioSev4', 'studioAlOpen', 'studioAlAcked', 'studioAlMuted', 'studioAlKind', 'studioAlTabD',
    'studioAlTabT', 'studioAlTabR', 'studioAlComp', 'studioAlTimes', 'studioAlJob', 'studioAlFire', 'studioAlFireCut', 'studioAlFireNone', 'studioSecs', 'studioEvO', 'studioEvA',
    'studioEvX', 'studioEvR', 'studioEvK', 'studioAlNoRel', 'studioAlGone', 'studioAlMute', 'studioAlAck'])
    ok((app.match(new RegExp('\\b' + k + ': "', 'g')) || []).length === 2, 'מחרוזת ' + k + ' בעברית ובאנגלית');

  /* ---------- 3. גרסה ---------- */
  const ver = (app.match(/const APP_VERSION = '(v\d+)'/) || [])[1];
  const sw = (read('sw.js').match(/CACHE_NAME = '[^']*-(v\d+)'/) || [])[1];
  ok(+ver.slice(1) >= 369 && swVersionOk(ver, sw), 'APP_VERSION ≥ v369 ו־sw.js תואם או גרסה אחת אחורה');
  console.log('\nכל ' + n + ' הבדיקות עברו ✓');
})().catch((e) => { console.error(e); process.exit(1); });
