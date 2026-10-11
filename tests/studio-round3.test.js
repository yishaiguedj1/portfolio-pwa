// סבב 3 (11/10/2026): עורך הווידאו ב׳ — מהירות, סיבוב והיפוך, זום ומיקום, שמע (עוצמה, השתקה, הדרגה, ‎−14 LUFS).
// אותה רשימת עריכות בטלפון (studioedl.js), בשרתון (normEdl) ובעובד (translator/edl.py) — משווים על מאות עריכות אקראיות.
// הרצה: node tests/studio-round3.test.js
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const J = (x) => JSON.stringify(x);

(async () => {
  const E = await import(path.join(root, 'studioedl.js'));
  const S = require(path.join(root, 'ibkr-proxy/lib/studio.js'));

  /* ---------- 1. נרמול השדות החדשים ---------- */
  ok(J(E.normEdl({ sp: 2, rt: 90, fh: true, vo: 150, fi: 1.2, fo: 3, ln: true, z: 1.53, y: 0.2 }, 30))
    === '{"k":[],"ar":"src","x":0.5,"y":0.2,"z":1.55,"sp":2,"rt":90,"fh":true,"vo":150,"fi":1,"fo":3,"ln":true}', 'כל השדות, בסדר קבוע, מעוגלים');
  ok(J(E.normEdl({ mu: true, vo: 50, fi: 2, ln: true }, 30)) === '{"k":[],"ar":"src","x":0.5,"mu":true}', 'השתקה מבטלת עוצמה, הדרגה והשוואת עוצמה');
  ok(E.normEdl({ sp: 1, rt: 0, vo: 100, fi: 0, z: 1, y: 0.5 }, 30) === null, 'ברירות המחדל = בלי עריכה');
  ok(E.normEdl({ sp: 1.1, rt: 45, vo: 300, fh: 'yes', z: 'x', fi: -2 }, 30) === null, 'ערכים לא תקינים — בחוץ');
  ok(J(E.normEdl({ z: 9 }, 30)) === '{"k":[],"ar":"src","x":0.5,"z":3}' && J(E.normEdl({ fo: 40 }, 30)) === '{"k":[],"ar":"src","x":0.5,"fo":10}', 'זום עד ' + E.Z_MAX + ', הדרגה עד ' + E.FADE_MAX + ' שנ׳');
  ok(!('y' in E.normEdl({ y: 0.2, sp: 2 }, 30)), 'מיקום אנכי — רק כשיש חיתוך (יחס או זום)');
  ok(J(E.normEdl({ k: [[2, 6]], ar: '9:16', x: 0.3 }, 30)) === '{"k":[[2,6]],"ar":"9:16","x":0.3}', 'עריכה ישנה — בדיוק כמו קודם');

  /* ---------- 2. לפני התרגום: רק חיתוך ויחס ---------- */
  const full = E.normEdl({ k: [[2, 6]], ar: '9:16', x: 0.3, sp: 2, vo: 50, z: 2 }, 30);
  ok(J(E.edlPre(full)) === '{"k":[[2,6]],"ar":"9:16","x":0.3}' && E.edlPre(E.normEdl({ sp: 2 }, 30)) === null && E.edlPre(null) === null, 'edlPre: מהירות/שמע/זום לא נכנסים לתמלול');
  ok(J(S.edlPre(S.normEdl({ k: [[2, 6]], ar: '9:16', x: 0.3, sp: 2 }, 30))) === '{"k":[[2,6]],"ar":"9:16","x":0.3}', 'השרתון: אותו edlPre');
  const sp = S.normSpec({ name: 'a.mp4', size: 5, to: ['he'], dur: 60, edl: { k: [[1, 5]], sp: 2, mu: true } });
  ok(J(sp.edl) === '{"k":[[1,5]],"ar":"src","x":0.5}' && !('edl' in S.normSpec({ name: 'a.mp4', size: 5, to: ['he'], edl: { sp: 2 } })), 'normSpec: חיתוך לפני התרגום בלי השדות החדשים');
  const rs = S.rrSpec({ spec: { name: 'a', size: 1, dur: 30, edl: { k: [[1, 9]] } } }, { edl: { k: [[0, 3]], sp: 0.5, rt: 270, vo: 120 } });
  ok(rs.edl.sp === 0.5 && rs.edl.rt === 270 && rs.edl.vo === 120 && J(rs.edl0) === '{"k":[[1,9]],"ar":"src","x":0.5}', 'הפקה מחדש: השדות החדשים עוברים לעובד');

  /* ---------- 3. אורך, מידות, חיתוך עם זום ---------- */
  ok(E.outDur(E.normEdl({ k: [[0, 10], [20, 30]], sp: 2 }, 60), 60) === 10 && E.outDur(E.normEdl({ sp: 0.5 }, 60), 60) === 120 && E.outDur(null, 60) === 60, 'outDur: אחרי חיתוך ומהירות');
  ok(J(E.rotDims(1920, 1080, 90)) === '[1080,1920]' && J(E.rotDims(1920, 1080, 180)) === '[1920,1080]', 'rotDims');
  ok(J(E.cropBox(1920, 1080, 'src', 0.5, 0.5, 2)) === '{"w":960,"h":540,"x":480,"y":270}', 'זום פי 2 במרכז');
  ok(J(E.cropBox(1920, 1080, 'src', 0, 1, 2)) === '{"w":960,"h":540,"x":0,"y":540}', 'זום בפינה — המיקום עד הקצה');
  ok(J(E.cropBox(1080, 1920, '1:1', 0.5, 0.1)) === '{"w":1080,"h":1080,"x":0,"y":84}', 'יחס 1:1 בסרטון אנכי — מיקום אנכי');
  ok(E.cropBox(1920, 1080, 'src', 0.5, 0.5, 1) === null, 'בלי יחס ובלי זום — בלי חיתוך');

  /* ---------- 4. הרכבה: שדות מהעריכה האחרונה ---------- */
  const c1 = E.composeEdl(E.normEdl({ k: [[10, 30]], ar: '9:16', x: 0.2 }, 90), E.normEdl({ k: [[0, 10]], sp: 2, rt: 90, z: 1.5, x: 0.7 }, 20));
  ok(J(c1) === '{"k":[[10,20]],"ar":"9:16","x":0.7,"z":1.5,"sp":2,"rt":90}', 'composeEdl: היחס מהראשונה, זום/מיקום/מהירות/סיבוב מהשנייה');
  const c2 = E.composeEdl(E.normEdl({ k: [[10, 30]], ar: '9:16', x: 0.2 }, 90), E.normEdl({ vo: 40 }, 20));
  ok(J(c2) === '{"k":[[10,30]],"ar":"9:16","x":0.2,"vo":40}', 'composeEdl: שמע בלבד — החיתוך והמיקום מהראשונה');

  /* ---------- 5. אותה לוגיקה בטלפון, בשרתון ובעובד ---------- */
  let seed = 11;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const vecs = [];
  for (let i = 0; i < 400; i++) {
    const dur = rnd() < 0.2 ? 0 : Math.round(rnd() * 600 * 100) / 100;
    const k = Array.from({ length: Math.floor(rnd() * 4) }, () => { const a = Math.round(rnd() * 650 * 1000) / 1000; return [a, Math.round((a + rnd() * 120 - 5) * 1000) / 1000]; });
    const e = { k, ar: pick(['src', 'src', '9:16', '1:1', '4:5', 'x']), x: Math.round(rnd() * 130) / 100 - 0.15 };
    if (rnd() < 0.5) e.y = Math.round(rnd() * 130) / 100 - 0.15;
    if (rnd() < 0.5) e.z = Math.round(rnd() * 400) / 100;
    if (rnd() < 0.5) e.sp = pick([0.25, 0.5, 1, 1.5, 2, 4, 3.3, -1]);
    if (rnd() < 0.5) e.rt = pick([0, 90, 180, 270, 45]);
    if (rnd() < 0.3) e.fh = pick([true, false, 1]);
    if (rnd() < 0.3) e.fv = pick([true, false]);
    if (rnd() < 0.5) e.vo = Math.round(rnd() * 2600) / 10 - 20;
    if (rnd() < 0.2) e.mu = pick([true, false]);
    if (rnd() < 0.4) e.fi = Math.round(rnd() * 140) / 10 - 1;
    if (rnd() < 0.4) e.fo = Math.round(rnd() * 140) / 10 - 1;
    if (rnd() < 0.3) e.ln = pick([true, 'y']);
    vecs.push({ e, dur });
  }
  const js = vecs.map((v) => E.normEdl(v.e, v.dur)), sv = vecs.map((v) => S.normEdl(v.e, v.dur));
  ok(J(js) === J(sv), 'normEdl: הטלפון = השרתון (400 עריכות עם השדות החדשים)');
  ok(js.filter((e) => e && e.sp).length > 50 && js.filter((e) => e && e.z).length > 50, 'הווקטורים מכסים מהירות וזום');
  const tmp = path.join(os.tmpdir(), 'snb-r3-' + process.pid + '.json');
  fs.writeFileSync(tmp, J(vecs));
  const py = spawnSync('python3', ['-c', `
import sys, json; sys.path.insert(0, sys.argv[1]); import edl as E
vs = json.load(open(sys.argv[2]))
out = []
for v in vs:
    e = E.norm_edl(v['e'], v['dur'])
    W, H = E.rot_dims(1920, 1080, (e or {}).get('rt', 0))
    out.append([e, E.out_dur(e, v['dur']), E.pre(e), E.compose_edl(E.norm_edl({'k': [[3, 400]], 'ar': '1:1', 'x': 0.4}, 0), e),
                E.crop_box(W, H, e['ar'], e['x'], e.get('y', 0.5), e.get('z', 1)) if e else None])
print(json.dumps(out))`, path.join(root, 'translator'), tmp], { encoding: 'utf8' });
  fs.unlinkSync(tmp);
  if (py.status === 0) {
    const P = JSON.parse(py.stdout);
    const Q = vecs.map((v, i) => {
      const e = js[i], [W, H] = E.rotDims(1920, 1080, (e || {}).rt || 0);
      return [e, E.outDur(e, v.dur), E.edlPre(e), E.composeEdl(E.normEdl({ k: [[3, 400]], ar: '1:1', x: 0.4 }, 0), e), e ? E.cropBox(W, H, e.ar, e.x, e.y, e.z) : null];
    });
    const bad = Q.findIndex((x, i) => J(x) !== J(P[i]));
    ok(bad < 0, 'הטלפון = העובד: normEdl, outDur, pre, composeEdl, cropBox עם סיבוב וזום (400)' + (bad >= 0 ? ' — שונה ב־' + bad + ': ' + J(Q[bad]) + ' / ' + J(P[bad]) : ''));
  } else { console.error(py.stderr); ok(false, 'python3'); }

  /* ---------- 6. ffmpeg: המסננים ---------- */
  const f = spawnSync('python3', ['-c', `
import sys, json; sys.path.insert(0, sys.argv[1]); import edl as E
def args(e, info):
    return E.ffmpeg_args('in.mp4', 'out.mp4', E.norm_edl(e, 60), info)
I = {'v': True, 'a': True, 'w': 1920, 'h': 1080, 'dur': 60.0}
print(json.dumps({
  'sp': args({'sp': 0.25}, I), 'rot': args({'rt': 90, 'fh': True, 'ar': '9:16'}, I), 'r180': args({'rt': 180, 'fh': True}, I),
  'zoom': args({'z': 2, 'x': 0, 'y': 1}, I), 'au': args({'k': [[0, 30]], 'sp': 2, 'vo': 150, 'fi': 1, 'fo': 2, 'ln': True}, I),
  'mu': args({'mu': True, 'rt': 270}, I), 'old': args({'k': [[2, 6]], 'ar': '9:16'}, I), 'tempo': [E.atempo(x) for x in (0.25, 0.5, 0.75, 3, 4)],
}))`, path.join(root, 'translator')], { encoding: 'utf8' });
  if (f.status !== 0) console.error(f.stderr);
  const F = JSON.parse(f.stdout), fc = (a) => a[a.indexOf('-filter_complex') + 1];
  ok(/setpts=4\.000000\*PTS/.test(fc(F.sp)) && /atempo=0\.5000,atempo=0\.5000\[ao\]/.test(fc(F.sp)), 'מהירות: setpts לתמונה, atempo בשרשרת לשמע (0.25 = 0.5×0.5)');
  ok(J(F.tempo) === '[["atempo=0.5000","atempo=0.5000"],["atempo=0.5000"],["atempo=0.7500"],["atempo=2.0000","atempo=1.5000"],["atempo=2.0000","atempo=2.0000"]]', 'atempo: כל מקטע בטווח 0.5–2');
  ok(/transpose=1,hflip,crop=1080:1920:0:0/.test(fc(F.rot)) || /transpose=1,hflip,crop=/.test(fc(F.rot)), 'סיבוב 90: transpose ואז היפוך ואז חיתוך על המידות המסובבות');
  ok(/\[vc\]vflip,setsar=1\[vo\]/.test(fc(F.r180)), '180° + היפוך אופקי = היפוך אנכי בלבד');
  ok(/crop=960:540:0:540,scale=1920:1080:flags=lanczos/.test(fc(F.zoom)), 'זום: חיתוך ואז חזרה לגודל המלא');
  ok(/atempo=2\.0000,loudnorm=I=-14:TP=-1\.5:LRA=11,aresample=48000,volume=1\.50,afade=t=in:st=0:d=1\.00,afade=t=out:st=13\.000:d=2\.00\[ao\]/.test(fc(F.au)),
    'שמע: מהירות → ‎−14 LUFS → עוצמה → הדרגה (בסוף — לפי האורך אחרי החיתוך והמהירות)');
  ok(!F.mu.includes('[ac]') && !/\[0:a\]/.test(fc(F.mu)) && !F.mu.includes('-c:a') && /transpose=2/.test(fc(F.mu)), 'השתקה: בלי שמע בכלל');
  ok(fc(F.old) === '[0:v]trim=start=2.000:end=6.000,setpts=PTS-STARTPTS[v0];[0:a]atrim=start=2.000:end=6.000,asetpts=PTS-STARTPTS[a0];[v0][a0]concat=n=1:v=1:a=1[vc][ac];[vc]crop=606:1080:656:0,setsar=1[vo]',
    'עריכה ישנה — אותה פקודה כמו קודם');
  ok(!/shell=True/.test(read('translator/edl.py')) && /'-show_format'/.test(read('translator/edl.py')) && /abs\(rot\) % 180 == 90/.test(read('translator/edl.py')), 'בלי shell; האורך מ־ffprobe; סרטון עם סימון סיבוב — המידות הנכונות');

  /* ---------- 7. העובד ---------- */
  const jp = read('translator/job.py'), rr = read('translator/rerender.py');
  ok(/e = E\.pre\(E\.norm_edl\(\(ctx\.st\.get\('spec'\) or \{\}\)\.get\('edl'\)\)\)/.test(jp), 'חיתוך לפני התרגום — רק pre (גם אם הגיע משהו אחר)');
  ok(/E\.speed_cues\(/.test(rr) && /if ec:\n/.test(rr), 'הפקה מחדש: הכתוביות זזות עם המהירות; כל עריכה מפעילה את ffmpeg');

  /* ---------- 8. הטלפון ---------- */
  const sj = read('studio.js'), src = read('studioedl.js'), css = read('studio.css');
  ok(/full: !before,/.test(sj), 'הפקדים החדשים — רק בהפקה מחדש (לא לפני התרגום)');
  ok(/edlPre\(normEdl\(sp\.edl\)\)/.test(sj) && /const ed = edlPre\(normEdl\(f\.edl, pr\.dur \|\| 0\)\);/.test(sj), 'הטופס: רק חיתוך ויחס במפרט');
  ok(/group\(T\('studioEdGrpSpeed'\), 'ed-g-sp'\)/.test(src) && /group\(T\('studioEdGrpFrame'\), 'ed-g-fr'\)/.test(src) && /group\(T\('studioEdGrpAudio'\), 'ed-g-au'\)/.test(src)
    && /el\('details', 'st-ed-grp'\)/.test(src), 'שלושה מקטעים מקופלים: מהירות וסיבוב · מסגור · שמע');
  ok(/v\.playbackRate = ex\.sp \|\| 1/.test(src) && /v\.style\.transform = videoTransform\(\)/.test(src) && /v\.muted = !!ex\.mu/.test(src) && /if \(key === pvKey\) return;/.test(src),
    'תצוגה מקדימה בנגן: מהירות, סיבוב והיפוך, עוצמה — רק כשמשהו השתנה');
  ok(/'scale\(' \+ sx \+ ', ' \+ sy \+ '\) rotate\(' \+ rt \+ 'deg\)'/.test(src), 'סדר ה־CSS = סדר ffmpeg (סיבוב ואז היפוך)');
  ok(/v\.style\.transform = '';( v\.style\.filter = '';)? try \{ v\.playbackRate = 1; v\.volume = 1; v\.muted = false; \}/.test(src), 'יציאה מהעורך — הנגן חוזר לרגיל');
  ok(/cropBox\(vw, vh, ar, x, ex\.y, ex\.z \|\| 1\)/.test(src) && /rotDims\(v \? v\.videoWidth : 0, v \? v\.videoHeight : 0, rt\)/.test(src), 'מסגרת החיתוך בנגן — אחרי סיבוב וזום');
  ok(/\.st-ed-grp > summary/.test(css) && /prefers-reduced-motion: reduce\) \{ \.st-pl video \{ transition: none; \}/.test(css), 'עיצוב המקטעים; בלי אנימציה למי שביקש');
  const vm = require('vm');
  const sandbox = { localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, document: { addEventListener() {}, getElementById: () => null, querySelectorAll: () => [], createElement: () => ({ style: {}, classList: { add() {} }, setAttribute() {} }), documentElement: {} }, window: {}, navigator: {}, location: {}, setTimeout, clearTimeout, console };
  vm.createContext(sandbox);
  vm.runInContext(read('app.js') + '\n;globalThis.__S = STRINGS;', sandbox);
  for (const k of ['studioEdGrpSpeed', 'studioEdRot', 'studioEdFlipH', 'studioEdFlipV', 'studioEdFlipped', 'studioEdGrpFrame', 'studioEdZoom', 'studioEdPosY', 'studioEdGrpAudio',
    'studioEdVol', 'studioEdMute', 'studioEdMuted', 'studioEdLoud', 'studioEdFadeIn', 'studioEdFadeOut', 'studioEdNoFade', 'studioEdSec', 'studioEdFades'])
    ok(sandbox.__S.he[k] && sandbox.__S.en[k], 'מחרוזת בשתי השפות: ' + k);
  console.log('# ' + n + ' בדיקות עברו');
})().catch((e) => { console.error('FAIL - ' + (e && e.stack || e)); process.exit(1); });
