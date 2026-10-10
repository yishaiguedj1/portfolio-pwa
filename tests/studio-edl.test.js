// מ4–מ5 (10/10/2026): עורך הווידאו — רשימת העריכות (EDL): חיתוך ויחס תמונה, לפני התרגום ואחרי.
// אותה לוגיקה בשלושה מקומות — studioedl.js (טלפון), ibkr-proxy/lib/studio.js normEdl (שרתון), translator/edl.py (עובד):
// משווים על מאות עריכות אקראיות. ffmpeg בעובד — translator/tests/test_worker.py (test_edl_before, test_rerender_edl).
// הרצה: node tests/studio-edl.test.js
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

(async () => {
  const E = await import(path.join(root, 'studioedl.js'));
  const S = require(path.join(root, 'ibkr-proxy/lib/studio.js'));

  /* ---------- 1. normEdl ---------- */
  ok(E.normEdl(null) === null && E.normEdl({}) === null && E.normEdl({ k: [[0, 30]] }, 30) === null, 'בלי עריכה (הכל, יחס המקור) = null');
  ok(JSON.stringify(E.normEdl({ k: [[10, 20], [0, 5], [4.99, 6]] }, 30)) === '{"k":[[0,6],[10,20]],"ar":"src","x":0.5}', 'מיון ואיחוד קטעים צמודים/חופפים');
  ok(JSON.stringify(E.normEdl({ k: [[1, 1.2], [3, 40]] }, 30)) === '{"k":[[3,30]],"ar":"src","x":0.5}', 'קטע קצר מ־' + E.SEG_MIN + ' — בחוץ; עד סוף הסרטון');
  ok(JSON.stringify(E.normEdl({ ar: '9:16', x: 0.234 }, 30)) === '{"k":[],"ar":"9:16","x":0.23}', 'רק יחס תמונה — בלי קטעים');
  ok(E.normEdl({ k: [['a', 2], [1], 'x'], ar: 'bad' }, 30) === null, 'ערכים לא תקינים');
  ok(E.normEdl({ k: Array.from({ length: 70 }, (_, i) => [i * 2, i * 2 + 1]) }, 200) === null, 'יותר מ־' + E.SEG_MAX + ' קטעים — לא מנחשים');

  /* ---------- 2. זמנים, כתוביות, הרכבה ---------- */
  const e = E.normEdl({ k: [[2, 6], [10, 14]], ar: '9:16' }, 30);
  ok(E.edlDur(e, 30) === 8 && E.edlDur(null, 30) === 30, 'edlDur');
  ok(E.mapTime(e, 3) === 1 && E.mapTime(e, 12) === 6 && E.mapTime(e, 8) === null && E.mapTime(e, 1) === null && E.unmapTime(e, 6) === 12, 'mapTime / unmapTime');
  const mc = E.mapCues(e, [{ s: 2.5, e: 4 }, { s: 7, e: 9 }, { s: 5, e: 11.5 }, { s: 13.9, e: 15 }]);
  ok(JSON.stringify(mc.map((c) => [c.s, c.e])) === '[[0.5,2],[4,5.5]]', 'mapCues: נחתכה כולה — יוצאת; באמצע — החלק הארוך; פחות מ־0.2 — יוצאת');
  const c2 = E.composeEdl(E.normEdl({ k: [[10, 30], [40, 60]] }, 90), E.normEdl({ k: [[5, 25]], ar: '1:1' }, 40));
  ok(JSON.stringify(c2) === '{"k":[[15,30],[40,45]],"ar":"1:1","x":0.5}', 'composeEdl: חיתוך אחרי התרגום על ציר הזמן של החיתוך שלפניו');
  ok(E.composeEdl(null, null) === null && E.composeEdl(e, null).k.length === 2, 'composeEdl: חסרים');

  /* ---------- 3. פעולות העורך ---------- */
  let sg = E.segsOf(null, 30);
  sg = E.splitAt(sg, 10); ok(JSON.stringify(sg) === '[[0,10],[10,30]]', 'splitAt');
  ok(E.splitAt(sg, 10.2) === null, 'splitAt: קרוב מדי לקצה');
  sg = E.removeAt(sg, 5); ok(JSON.stringify(sg) === '[[10,30]]' && E.removeAt(sg, 15) === null, 'removeAt: לא את הקטע האחרון');
  sg = E.trimAt(sg, 12, 'a'); sg = E.trimAt(sg, 20, 'b'); ok(JSON.stringify(sg) === '[[12,20]]', 'trimAt: מתחיל כאן / נגמר כאן');
  ok(JSON.stringify(E.toEdl(sg, 'src', 0.5, 30)) === '{"k":[[12,20]],"ar":"src","x":0.5}', 'toEdl');
  ok(JSON.stringify(E.cropBox(1920, 1080, '9:16', 0.5)) === '{"w":606,"h":1080,"x":656,"y":0}' && JSON.stringify(E.cropBox(1080, 1920, '1:1', 0.5)) === '{"w":1080,"h":1080,"x":0,"y":420}', 'cropBox (כמו crop של ffmpeg, מספרים זוגיים)');

  /* ---------- 4. אותה לוגיקה בטלפון, בשרתון ובעובד ---------- */
  let seed = 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const vecs = [];
  for (let i = 0; i < 300; i++) {
    const dur = rnd() < 0.2 ? 0 : Math.round(rnd() * 600 * 100) / 100;
    const k = Array.from({ length: Math.floor(rnd() * 6) }, () => { const a = Math.round(rnd() * 650 * 1000) / 1000; return [a, Math.round((a + rnd() * 120 - 5) * 1000) / 1000]; });
    vecs.push({ e: { k, ar: E.ARS[Math.floor(rnd() * 5) % 5] || 'x', x: Math.round(rnd() * 130) / 100 - 0.15 }, dur });
  }
  const js = vecs.map((v) => E.normEdl(v.e, v.dur)), sv = vecs.map((v) => S.normEdl(v.e, v.dur));
  ok(JSON.stringify(js) === JSON.stringify(sv), 'normEdl: הטלפון = השרתון (300 עריכות)');
  ok(js.filter(Boolean).length > 100, 'רוב הווקטורים לא טריוויאליים (' + js.filter(Boolean).length + ')');
  const tmp = path.join(require('os').tmpdir(), 'snb-edl-' + process.pid + '.json');
  fs.writeFileSync(tmp, JSON.stringify(vecs));
  const py = spawnSync('python3', ['-c', `
import sys, json; sys.path.insert(0, sys.argv[1]); import edl as E
vs = json.load(open(sys.argv[2]))
out = []
for v in vs:
    e = E.norm_edl(v['e'], v['dur'])
    cues = [{'start': t, 'end': t + 2.5} for t in (0, 3, 50, 120, 333.3)]
    out.append([e, E.edl_dur(e, v['dur']), [E.map_time(e, t) for t in (0, 7.5, 61, 300)],
                [[c['start'], c['end']] for c in E.map_cues(e, cues)], E.compose_edl(e, E.norm_edl({'k': [[1, 20]], 'ar': 'src'}, 0)),
                E.crop_box(1920, 1080, e['ar'], e['x']) if e else None])
print(json.dumps(out))`, path.join(root, 'translator'), tmp], { encoding: 'utf8' });
  fs.unlinkSync(tmp);
  if (py.status === 0) {
    const P = JSON.parse(py.stdout);
    const J = vecs.map((v, i) => {
      const e2 = js[i], cues = [0, 3, 50, 120, 333.3].map((t) => ({ s: t, e: t + 2.5 }));
      return [e2, E.edlDur(e2, v.dur), [0, 7.5, 61, 300].map((t) => E.mapTime(e2, t)), E.mapCues(e2, cues).map((c) => [c.s, c.e]),
        E.composeEdl(e2, E.normEdl({ k: [[1, 20]], ar: 'src' }, 0)), e2 ? E.cropBox(1920, 1080, e2.ar, e2.x) : null];
    });
    const bad = J.findIndex((x, i) => JSON.stringify(x) !== JSON.stringify(P[i]));
    ok(bad < 0, 'הטלפון = העובד: normEdl, edlDur, mapTime, mapCues, composeEdl, cropBox (300 עריכות)' + (bad >= 0 ? ' — שונה ב־' + bad + ': ' + JSON.stringify(J[bad]) + ' / ' + JSON.stringify(P[bad]) : ''));
  } else console.log('# python3 לא זמין — בלי השוואה לעובד');

  /* ---------- 5. ffmpeg בעובד: רק מספרים מהעריכה נכנסים לפקודה ---------- */
  const ep = read('translator/edl.py');
  ok(/def ffmpeg_args\(src, out, e, info, audio_only=False\)/.test(ep) && /\[0:v\]trim%s,setpts=PTS-STARTPTS/.test(ep) && /crop=%d:%d:%d:%d/.test(ep) && !/shell=True/.test(ep), 'edl.py: trim/concat/crop, רשימת ארגומנטים בלי shell');
  const jp = read('translator/job.py');
  ok((jp.match(/src = edl_src\(ctx, src, /g) || []).length === 4, 'העובד חותך מיד אחרי כל הורדה של המקור (קול, סרטון, צירוף הסרטון, המשך)');
  ok(/for k in \('edl0', 'edl'\):/.test(jp) && /E\.compose_edl\(e0, e1\)/.test(read('translator/rerender.py')), 'הפקה מחדש: החיתוך שלפני התרגום + החיתוך החדש = עריכה אחת על המקור; הכתוביות זזות רק עם החדש');

  /* ---------- 6. השרתון ---------- */
  const sp = S.normSpec({ name: 'a.mp4', size: 5, to: ['he'], dur: 60, edl: { k: [[1, 5], [10, 20]], ar: '4:5', x: 0.2 } });
  ok(sp.edl && sp.edl.k.length === 2 && sp.edl.ar === '4:5', 'normSpec: חיתוך לפני התרגום נשמר במפרט');
  ok(!('edl' in S.normSpec({ name: 'a.mp4', size: 5, to: ['he'], edl: { k: [], ar: 'src' } })) && !('edl' in S.normSpec({ name: 'a.mp4', size: 5, to: ['he'] })), 'normSpec: בלי עריכה — בלי שדה');
  const rs = S.rrSpec({ spec: { name: 'a', size: 1, dur: 30, edl: { k: [[1, 9]] } } }, { edl: { k: [[0, 3]], ar: '9:16' } });
  ok(rs.edl0.k[0][1] === 9 && rs.edl.ar === '9:16' && !('edl' in S.rrSpec({ spec: { name: 'a', size: 1, dur: 30 } }, {})), 'rrSpec: edl0 (מהמקורית) + edl (החדש)');

  /* ---------- 7. הטלפון ---------- */
  const sj = read('studio.js');
  ok(/import \{ createEdlEditor, normEdl, edlDur \} from '\.\/studioedl\.js';/.test(sj) && /'\.\/studioedl\.js'/.test(read('sw.js')), 'studio.js מייבא את עורך הווידאו; sw.js שומר אותו לאופליין');
  ok(/dur: ed \? edlDur\(ed, pr\.dur \|\| 0\) : pr\.dur \|\| 0/.test(sj) && /if \(ed\) spec\.edl = ed;/.test(sj), 'טופס: האורך במפרט = אחרי החיתוך (ההערכות והעלות)');
  ok(/edl: rrEdl\.get\(rec\.id\) \|\| null/.test(sj) && /x === 'cut' \? \['rr', y\]/.test(sj) && /v === 'cutsrc'\) \{ v = 'new'/.test(sj), 'הפקה מחדש שולחת את החיתוך; "חזור" מהחיתוך — להפקה / לטופס');
  ok(/if \(ui\.view === 'cut' \|\| ui\.view === 'cutsrc'\) ceStop\(\)/.test(sj) && /URL\.revokeObjectURL\(ce\.url\)/.test(sj), 'יציאה מהחיתוך: הנגן נעצר וכתובת הקובץ המקומי משתחררת');
  const src = read('studioedl.js');
  ok(!/innerHTML|fetch\(/.test(src), 'עורך הווידאו: בלי innerHTML ובלי רשת');
  ok(/xr\.dir = 'ltr'; xr\.min = '0'; xr\.max = '1'; xr\.step = '0\.01';/.test(src), 'סליידר המיקום: 0–1, בכיוון התמונה (נמצא ב־QA: ההגדרות נבלעו בהערה)');
  const vm = require('vm');
  const sandbox = { localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, document: { addEventListener() {}, getElementById: () => null, querySelectorAll: () => [], createElement: () => ({ style: {}, classList: { add() {} }, setAttribute() {} }), documentElement: {} }, window: {}, navigator: {}, location: {}, setTimeout, clearTimeout, console };
  vm.createContext(sandbox);
  vm.runInContext(read('app.js') + '\n;globalThis.__S = STRINGS;', sandbox);
  const keys = [...src.matchAll(/(?<![A-Za-z0-9_$])T\(\s*'([A-Za-z0-9_]+)'/g)].map((m) => m[1]);
  const miss = keys.filter((k) => !sandbox.__S.he[k] || !sandbox.__S.en[k]);
  ok(keys.length > 10 && !miss.length && ![...src.matchAll(/(?<![A-Za-z0-9_$])T\(\s*([^'\s)][^,)]*)/g)].length, 'מחרוזות עורך הווידאו בשתי השפות, בלי T() דינמי' + (miss.length ? ': ' + miss.join(',') : ''));

  console.log(`\n${n} בדיקות עברו`);
})().catch((e) => { console.error(e); process.exit(1); });
