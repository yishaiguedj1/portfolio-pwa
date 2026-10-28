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

// 2. ניקוי ומיזוג
const a = S.normSm({ gl: [['Scherbatsky', 'שרבצקי'], ['bad'], ['x://y', 'z'], ['scherbatsky', 'כפול']], ch: [['רובין', 'f', 'כתבת'], ['טד', '?'], ['<b>מרשל</b>', 'm']] });
ok(JSON.stringify(a) === JSON.stringify({ gl: [['Scherbatsky', 'שרבצקי']], ch: [['רובין', 'f', 'כתבת'], ['b מרשל /b', 'm', '']] }), 'normSm — שורות לא תקינות, כפולים ותגיות בחוץ');
const ser = S.seriesOf('HIMYM.S01E01.mkv');
let d = S.smMerge({}, ser, { gl: [['Scherbatsky', 'שרבצקי']], ch: [['רובין', 'f', '']] }, 10);
d = S.smMerge(d, S.seriesOf('himym s01e02.mp4'), { gl: [['SCHERBATSKY', 'שרבטסקי'], ['Metro News 1', 'מטרו ניוז 1']], ch: [['רובין', 'm', '']] }, 20);
const x = d.s.himym;
ok(x.gl.length === 2 && x.gl[0][1] === 'שרבצקי' && x.ch.length === 1 && x.ch[0][1] === 'f', 'הראשון שנקבע גובר (כתיב ומגדר)');
ok(x.ep === 2 && x.at === 20, 'מונה פרקים ותאריך');
const w = S.smForWorker(S.smParse(JSON.stringify(d)), S.seriesOf('HIMYM S01E03.mkv'));
ok(w && w.n === 'HIMYM' && w.gl.length === 2 && S.smForWorker(d, S.seriesOf('Other.S01E01.mkv')) === null, 'לעובד — רק הסדרה של העבודה');
let big = {};
for (let i = 0; i < 70; i++) big = S.smMerge(big, { k: 'show ' + i, n: 'Show ' + i }, { gl: [['A', 'א']] }, i + 1);
ok(Object.keys(big.s).length === 60 && !big.s['show 0'] && big.s['show 69'], 'עד 60 סדרות — הישנות יוצאות');
ok(Object.keys(S.smParse('{"s":{"../x":{"gl":[["a","b"]]}}}').s).length === 0 && Object.keys(S.smParse('not json').s).length === 0, 'smParse — מפתח לא תקין / קובץ פגום');

// 3. החיבור בשרתון
const api = fs.readFileSync(path.join(root, 'ibkr-proxy/api/studio.js'), 'utf8');
ok(/WORKER_OPS = new Set\([^)]*'smPut'/.test(api), 'smPut — פעולה של העובד');
ok(/const wj = S\.workerJob[^\n]*\n\s*if \(job\.kind === 'tr'\) \{ const sm = await smRead\(deps, job\)/.test(api), 'בלקיחה — הזיכרון של הסדרה');
ok(/async function smPut[\s\S]{0,200}S\.jobSeries\(job\)/.test(api), 'המפתח — משם הקובץ שבעבודה, לא מהעובד');
ok(/r2\.list\('sm\/'\)/.test(fs.readFileSync(path.join(root, 'ibkr-proxy/lib/offsite.js'), 'utf8')), 'נכלל בגיבוי היומי');

// 4. אותו ניקוי בעובד (sm_valid)
let py = null;
try {
  py = JSON.parse(execFileSync('python3', ['-c', 'import sys,json;sys.path.insert(0,"translator");import job;v=job.sm_valid(json.loads(sys.argv[1]));print(json.dumps({"gl":v["gl"],"ch":v["ch"]},ensure_ascii=False))',
    JSON.stringify({ gl: [['Scherbatsky', 'שרבצקי'], ['bad'], ['x://y', 'z'], ['scherbatsky', 'כפול']], ch: [['רובין', 'f', 'כתבת'], ['טד', '?'], ['<b>מרשל</b>', 'm']] })], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().split('\n').pop());
} catch (e) { py = null; }
if (py) ok(JSON.stringify(py) === JSON.stringify(a), 'sm_valid בעובד = normSm בשרתון');
else console.log('# python3 / job.py לא זמינים — דילוג על ההשוואה');

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
