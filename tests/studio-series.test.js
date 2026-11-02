// 28/10/2026: זיכרון הסדרה — השרתון (lib/studio.js): מפתח הסדרה משם הקובץ, ניקוי, מיזוג (הראשון גובר), מה שהעובד מקבל;
// החיבור ב־api/studio.js (לקיחה + smPut), הגיבוי, וזהות הניקוי מול sm_valid בעובד (translator/tests/test_series_memory.py).
// הרצה: node tests/studio-series.test.js
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const S = require(path.join(root, 'ibkr-proxy/lib/studio.js'));

// 1. מפתח הסדרה
const k = (x) => (S.seriesOf(x) || {}).k || null;
ok(k('How.I.Met.Your.Mother.S01E02.720p.BluRay.x264.mkv') === 'how i met your mother', 'SxxEyy עם נקודות');
ok(k('How I Met Your Mother - 1x05 - Okay Awesome.avi') === 'how i met your mother', '1x05 — אותה סדרה');
ok(k('The.Office.US.2005.S02E01.mp4') === 'the office us', 'שנה לפני הפרק יוצאת');
ok(k('Lost Season 2 - S02E04.mkv') === 'lost' && k('איך פגשתי את אמא עונה 1 S01E03.mp4') === 'איך פגשתי את אמא', '"Season N" / "עונה N" יוצאים');
ok(k('interview.mp4') === null && k('S01E01.mkv') === null && k('Messier 45 overview.mp4') === null, 'בלי פרק / בלי שם — אין סדרה');
ok(S.jobSeries({ fv: { name: 'HIMYM.S01E01.mkv' } }).k === 'himym' && S.jobSeries({}) === null, 'jobSeries — משם הסרטון');
ok(S.smKey('abcdef12') === 'sm/abcdef12.json' && S.smKey('../x') === '', 'smKey רק ל־uid תקין');

// 2. ניקוי ומיזוג (שמות בדויים). 02/11/2026 (PR2): שורה [en, he, n, l, f] / [שם, g, תפקיד, n, l, f]
const RAW = { gl: [['Vexley', 'וקסלי'], ['bad'], ['x://y', 'z'], ['vexley', 'כפול'], ['Pell', 'פל (לא ודאי)', 3, 2, 1]],
  ch: [['נעמה', 'f', 'כתבת'], ['אורן', '?'], ['<b>דנה</b>', 'm'], ['נעמה וקסלי', 'f'], ['אישה נוספת', 'f'], ['לא ודאי', 'm'], ['אורי — לא ודאי', 'm', '', 2], ['מר כהן', 'm'], ['מר לוי', 'm']] };
const a = S.normSm(RAW);
ok(JSON.stringify(a) === JSON.stringify({ gl: [['Vexley', 'וקסלי', 1, 0, 0], ['Pell', 'פל', 3, 2, S.SM_LOCK | S.SM_UNSURE]],
  ch: [['נעמה', 'f', 'כתבת', 1, 0, 0], ['b דנה /b', 'm', '', 1, 0, 0], ['אורי', 'm', '', 2, 0, S.SM_UNSURE], ['מר כהן', 'm', '', 1, 0, 0], ['מר לוי', 'm', '', 1, 0, 0]] }),
  'normSm — שורות לא תקינות, כפולים (דמות לפי השם הפרטי / תואר+שם), תגיות, תוויות כלליות ו"לא ודאי"');
ok(S.normSm({ gl: [['A', 'א', 1, 0, 7]] }, S.SM_WORKER).gl[0][4] === (S.SM_UNSURE | S.SM_FIX), 'מהעובד — בלי "נעול"');
const ser = S.seriesOf('Fake.Show.S01E01.mkv');
ok(ser.s === 1 && ser.e === 1, 'seriesOf — גם העונה (ל־done)');
let st = {};
let d = S.smMerge({}, ser, { gl: [['Vexley', 'וקסלי']], ch: [['נעמה', 'f', '']] }, 10, st);
d = S.smMerge(d, S.seriesOf('fake show s01e02.mp4'), { gl: [['VEXLEY', 'וקסלה'], ['Quorra News 4', 'קורה ניוז 4']], ch: [['נעמה', 'm', '']] }, 20, st);
const x = d.s['fake show'];
ok(x.gl.length === 2 && x.gl[0][1] === 'וקסלי' && x.ch.length === 1 && x.ch[0][1] === 'f', 'שורה ודאית — הכתיב והמגדר נשארים');
ok(x.gl[0][2] === 2 && x.gl[0][3] === 2 && x.gl[1][2] === 1 && JSON.stringify(x.done) === '[1001,1002]', 'n = בכמה פרקים, l = הפרק האחרון, done');
ok(x.ep === 2 && x.at === 20 && st.gl.hit === 1 && st.gl.add === 1 && st.ng === 2 && st.fresh === 1, 'מונה פרקים, תאריך ומונים ליומן');
d = S.smMerge(d, S.seriesOf('Fake.Show.S01E02.mkv'), { gl: [['Vexley', 'וקסלי']] }, 30, st);
ok(d.s['fake show'].gl[0][2] === 2 && d.s['fake show'].ep === 2 && st.fresh === 0, 'done — אותו פרק שוב (הרצה חוזרת) לא נספר פעמיים');
d = S.smMerge(d, S.seriesOf('Fake.Show.S01E03.mkv'), { gl: [['Lumo', 'לומו (לא ודאי)']] }, 40);
d = S.smMerge(d, S.seriesOf('Fake.Show.S01E04.mkv'), { gl: [['Lumo', 'לומי']] }, 50);
ok(d.s['fake show'].gl.find((r) => r[0] === 'Lumo').join() === 'Lumo,לומי,2,4,0', '"לא ודאי" — שורה ודאית מחליפה אותה');
d = S.smMerge(d, S.seriesOf('Fake.Show.S01E05.mkv'), { gl: [['Lumo', 'לומה', 1, 0, S.SM_FIX]] }, 60);
ok(d.s['fake show'].gl.find((r) => r[0] === 'Lumo')[1] === 'לומה', 'SM_FIX מהעובד — מחליף כתיב');
const w = S.smForWorker(S.smParse(JSON.stringify(d)), S.seriesOf('Fake Show S01E06.mkv'));
ok(w && w.n === 'Fake Show' && w.gl.length === 3 && w.gl[0][2] >= w.gl[2][2] && S.smForWorker(d, S.seriesOf('Other.S01E01.mkv')) === null, 'לעובד — רק הסדרה של העבודה, השכיחות קודם');
// 2.2 פינוי במקום הקפאה: מעל התקרה — n הנמוך, מונח לפני שם, l הישן; נעול ושם עם n≥2 לא יוצאים; חדשים ממשיכים להיכנס
{
  let m = {};
  const full = Array.from({ length: S.SM_GL }, (_, i) => ['term number ' + i, 'מונח ' + i]);
  m = S.smMerge(m, S.seriesOf('Fake.S01E01.mkv'), { gl: full.slice(0, S.SM_NEW) }, 1);
  for (let e = 2; e <= 5; e++) m = S.smMerge(m, S.seriesOf('Fake.S01E0' + e + '.mkv'), { gl: full.slice((e - 1) * S.SM_NEW, e * S.SM_NEW).concat([['Vexley', 'וקסלי']]) }, e);
  ok(m.s.fake.gl.length <= S.SM_GL, 'עד SM_GL');
  const st2 = {};
  m = S.smMerge(m, S.seriesOf('Fake.S01E06.mkv'), { gl: [['Brandnew', 'ברנדניו'], ['Another Term', 'מונח אחר']] }, 6, st2);
  const g6 = m.s.fake.gl;
  ok(g6.some((r) => r[0] === 'Brandnew') && g6.some((r) => r[0] === 'Another Term') && g6.length === S.SM_GL, 'מלא — חדשים עדיין נכנסים (עד היום: 0 מאז שהתמלא)');
  ok(g6.some((r) => r[0] === 'Vexley') && !g6.some((r) => r[0] === 'term number 0') && st2.gl.out === 2, 'יצאו המונחים הישנים עם n 1, השם שחזר נשאר');
  const locked = S.smEvict([['A', 'א', 1, 1, S.SM_LOCK], ['Bob', 'בוב', 2, 1, 0], ['c term', 'ג', 1, 1, 0], ['Dan', 'דן', 1, 0, 0]], 2, 2, (r) => S.smIsName(r[0]), null);
  ok(locked.map((r) => r[0]).join() === 'A,Bob', 'פינוי: נעול ושם עם n≥2 מוגנים; מונח לפני שם');
}
// גודל: מעל SM_BYTES — סדרות ישנות יוצאות, לא הנוכחית
{
  let m = {};
  const long = (i, j) => ['Term ' + i + ' ' + j + ' ' + 'x'.repeat(40), 'מ'.repeat(70)];
  for (let i = 0; i < 40; i++) for (let e = 1; e <= 3; e++) m = S.smMerge(m, { k: 'show ' + i, n: 'Show ' + i, s: 1, e }, { gl: Array.from({ length: S.SM_NEW }, (_, j) => long(i, e * 100 + j)) }, i * 3 + e);
  ok(Buffer.byteLength(JSON.stringify(m)) <= S.SM_BYTES && m.s['show 39'] && !m.s['show 0'], 'הקובץ נשאר עד SM_BYTES — הישנות יוצאות');
}
let big = {};
for (let i = 0; i < 70; i++) big = S.smMerge(big, { k: 'show ' + i, n: 'Show ' + i }, { gl: [['A', 'א']] }, i + 1);
ok(Object.keys(big.s).length === 60 && !big.s['show 0'] && big.s['show 69'], 'עד 60 סדרות — הישנות יוצאות');
ok(Object.keys(S.smParse('{"s":{"../x":{"gl":[["a","b"]]}}}').s).length === 0 && Object.keys(S.smParse('not json').s).length === 0, 'smParse — מפתח לא תקין / קובץ פגום');
// 2.9 כינויי מפתח: איחוד שתי סדרות (פעולת מנהל) — n מצטבר, נעול נשמר, הכינוי מצביע
{
  let m = S.smMerge({}, S.seriesOf('Fake.Show.S01E01.mkv'), { gl: [['Vexley', 'וקסלי']] }, 1);
  m = S.smMerge(m, S.seriesOf('Fake.Show.S01E02.mkv'), { gl: [['Vexley', 'וקסלי']] }, 2);
  m = S.smMerge(m, S.seriesOf('Fake.Show.US.S01E03.mkv'), { gl: [['Vexley', 'וקסלה'], ['Pell', 'פל']] }, 3);
  const j = S.smAlias(m, 'fake show us', 'fake show', 4);
  ok(j && !j.s['fake show us'] && j.al['fake show us'] === 'fake show' && j.s['fake show'].gl.find((r) => r[0] === 'Vexley').join() === 'Vexley,וקסלי,3,2,0'
    && j.s['fake show'].done.length === 3, 'smAlias — השורות מתאחדות, n מצטבר, done מאוחד');
  const j2 = S.smMerge(j, S.seriesOf('Fake.Show.US.S01E04.mkv'), { gl: [['Pell', 'פל']] }, 5);
  ok(!j2.s['fake show us'] && j2.s['fake show'].gl.find((r) => r[0] === 'Pell')[2] === 2, 'אחרי האיחוד — הפרק הבא מהמפתח השני נכתב למפתח המאוחד');
  ok(S.smForWorker(S.smParse(JSON.stringify(j2)), S.seriesOf('Fake.Show.US.S01E05.mkv')).gl.length === 2, 'הכינוי נשמר בקובץ ונקרא לעובד');
  ok(S.smAlias(m, 'nope', 'fake show', 4) === null && S.smAlias(m, 'fake show', 'fake show', 4) === null, 'smAlias — בלי שתי סדרות — null');
}

// 3. החיבור בשרתון
const api = fs.readFileSync(path.join(root, 'ibkr-proxy/api/studio.js'), 'utf8');
ok(/WORKER_OPS = new Set\([^)]*'smPut'/.test(api), 'smPut — פעולה של העובד');
ok(/const wj = S\.workerJob[^\n]*\n\s*if \(job\.kind === 'tr'\) \{ const sm = await smRead\(deps, job\)/.test(api), 'בלקיחה — הזיכרון של הסדרה');
ok(/async function smPut[\s\S]{0,200}S\.jobSeries\(job\)/.test(api), 'המפתח — משם הקובץ שבעבודה, לא מהעובד');
ok(/const smWrites = \(job\) => !!job && job\.kind === 'tr' && !job\.gs && !\(job\.spec && \(job\.spec\.xf \|\| job\.spec\.xe \|\| job\.spec\.xg\)\)/.test(api)
  && /if \(!smWrites\(job\) \|\| !ser\) return false;/.test(api), '2.4: עבודת זהב / ניסוי (xf, xe, xg) לא כותבת לזיכרון');
ok(!/S\.smKey[^\n]*\n[^\n]*getText\([^)]*\)\.catch\(\(\) => null\)/.test(api) && !/R2\.putText\(c, rd, key, JSON\.stringify\(S\.sm/.test(api), '2.3: אין כתיבה לזיכרון בלי If-Match, ואין "קריאה כושלת = קובץ ריק"');
ok(/ifMatch: g\.etag \|\| undefined, ifNoneMatch: g\.etag \? undefined : '\*'/.test(api) && /R2\.getCond\(c, rd, key, S\.SM_READ\)/.test(api), 'smUpdate — getCond + putCond עם If-Match');
ok(/r2\.list\('sm\/'\)/.test(fs.readFileSync(path.join(root, 'ibkr-proxy/lib/offsite.js'), 'utf8')), 'נכלל בגיבוי היומי');

// 4. אותו ניקוי בעובד (sm_valid) ואותם קבועים
let py = null;
try {
  py = JSON.parse(execFileSync('python3', ['-c', 'import sys,json;sys.path.insert(0,"translator");import job;v=job.sm_valid(json.loads(sys.argv[1]));print(json.dumps({"gl":v["gl"],"ch":v["ch"],"k":[job.SM_GL,job.SM_CH,job.SM_LOCK,job.SM_UNSURE,job.SM_FIX]},ensure_ascii=False))',
    JSON.stringify(RAW)], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().split('\n').pop());
} catch (e) { py = null; }
if (py) {
  ok(JSON.stringify({ gl: py.gl, ch: py.ch }) === JSON.stringify(a), 'sm_valid בעובד = normSm בשרתון');
  ok(JSON.stringify(py.k) === JSON.stringify([S.SM_GL, S.SM_CH, S.SM_LOCK, S.SM_UNSURE, S.SM_FIX]), 'SM_GL/SM_CH והדגלים — זהים בעובד');
} else console.log('# python3 / job.py לא זמינים — דילוג על ההשוואה');

// 5. "טיוטה אחת" (28/10/2026): הניסוי הסתיים בערב (ניתוח פרקים 16–20 מול האדם) — xd = 1 לכל עבודה
{
  const t = Date.UTC(2026, 9, 28);
  ok([8, 9, 10, 11].every((e) => S.dualAb({ fv: { name: 'Show.S01E' + String(e).padStart(2, '0') + '.mkv' } }, t) === 1)
    && S.dualAb({ fv: { name: 'interview.mp4' } }, t + 1e10) === 1, 'טיוטה אחת לכל עבודה — סדרה או לא, גם אחרי סוף הניסוי');
  ok(/if \(job\.kind === 'tr' && !job\.c0 && S\.dualAb\(job, now\)\) patch\.xd = 1;/.test(api) && /if \(job\.xd === 1 \|\| patch\.xd === 1\) wj\.xd = 1;/.test(api), 'נקבע בלקיחה הראשונה ונשלח לעובד');
  ok(/xd: job\.xd === 1 \? 1 : 0/.test(fs.readFileSync(path.join(root, 'ibkr-proxy/lib/studiolearn.js'), 'utf8')), 'נרשם במאגר הלמידה');
}
// 6. ניסוי "ביקורת ב־medium גם במצב high" (28/10–30/11/2026): פרק שמספרו 0/1 מודולו 4 — מוצלב עם medium (אי־זוגי) / high (זוגי)
{
  const t = Date.UTC(2026, 9, 29), ab = (n) => S.rvAb({ fv: { name: 'Show.S01E' + String(n).padStart(2, '0') + '.mkv' } }, t);
  const on = [21, 22, 23, 24, 25, 26, 27, 28].filter((e) => ab(e) === 1);
  ok(JSON.stringify(on) === '[21,24,25,28]', 'פרקים 21–28: ביקורת medium ב־21, 24, 25, 28');
  ok(on.filter((e) => !(e % 2)).length === 2, 'בפרקי high (זוגיים) — חצי עם וחצי בלי');
  ok(S.rvAb({ fv: { name: 'X.S01E24.mkv' } }, S.RV_AB_UNTIL) === 0, 'אחרי סוף הניסוי — רגיל');
  const ids = ['a', 'b', 'c', 'd'].map((x) => S.rvAb({ id: 'job' + x, fv: { name: 'interview.mp4' } }, t));
  ok(ids.filter(Boolean).length === 2, 'לא סדרה — לפי זוגיות המזהה, חצי וחצי');
  ok(/if \(job\.kind === 'tr' && !job\.c0 && S\.rvAb\(job, now\)\) patch\.xr = 1;/.test(api) && /if \(job\.xr === 1 \|\| patch\.xr === 1\) wj\.xr = 1;/.test(api), 'נקבע בלקיחה הראשונה ונשלח לעובד');
  ok(/xr: job\.xr === 1 \? 1 : 0/.test(fs.readFileSync(path.join(root, 'ibkr-proxy/lib/studiolearn.js'), 'utf8')), 'נרשם במאגר הלמידה');
}
console.log('# ' + n + ' בדיקות עברו (כולל הניסוי)');
