// סבב 9: מסגור אוטומטי לדובר (שורטס) — af בעריכה זהה בטלפון, בשרתון ובעובד; YuNet מצורף לעובד; הממשק.
// הבדיקות של הזיהוי וה־ffmpeg עצמם — translator/tests/test_frame.py. הרצה: node tests/studio-round9.test.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const J = JSON.stringify;

(async () => {
  const E = await import(path.join(root, 'studioedl.js'));
  const S = require(path.join(root, 'ibkr-proxy/lib/studio.js'));

  /* ---------- 1. המודל ---------- */
  ok(J(E.normEdl({ k: [], ar: '9:16', x: 0.5, af: true }, 10)) === '{"k":[],"ar":"9:16","x":0.5,"af":true}', 'af נשמר כשיש חיתוך ליחס');
  ok(J(E.normEdl({ k: [], ar: '9:16', x: 0.3, y: 0.2, af: true, z: 1.5 }, 10)) === '{"k":[],"ar":"9:16","x":0.3,"y":0.2,"af":true,"z":1.5}', 'הסדר: y → af → z (כמו בעובד)');
  ok(E.normEdl({ k: [[0, 5]], ar: 'src', af: true }, 10).af === undefined && E.normEdl({ k: [], ar: '1:1', af: 'yes' }, 10).af === undefined, 'בלי חיתוך / לא true — בלי af');
  ok(E.edlPre(E.normEdl({ k: [[1, 9]], ar: '9:16', af: true }, 10)).af === undefined, 'לפני התרגום — רק חיתוך ויחס (af בהפקה מחדש)');
  ok(E.composeEdl(E.normEdl({ k: [], ar: '9:16', af: true }, 10), E.normEdl({ k: [[1, 5]], sp: 2 }, 10)).af === true, 'הרכבה: af עם המיקום והזום (מהעריכה שקבעה את החיתוך)');

  /* ---------- 2. זהה בשלושה מקומות ---------- */
  let seed = 9;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const vecs = [];
  for (let i = 0; i < 300; i++) {
    const dur = Math.round(rnd() * 300 * 100) / 100;
    const e = { k: rnd() < 0.5 ? [] : [[Math.round(rnd() * 50), Math.round(50 + rnd() * 200)]], ar: pick(['src', '9:16', '1:1', '4:5']), x: Math.round(rnd() * 100) / 100 };
    if (rnd() < 0.8) e.af = pick([true, true, true, false, 1, 'x']);
    if (rnd() < 0.4) e.z = Math.round(rnd() * 300) / 100;
    if (rnd() < 0.4) e.y = Math.round(rnd() * 100) / 100;
    if (rnd() < 0.3) e.sp = pick([0.5, 1, 2]);
    vecs.push({ e, dur });
  }
  const js = vecs.map((v) => E.normEdl(v.e, v.dur)), sv = vecs.map((v) => S.normEdl(v.e, v.dur));
  ok(J(js) === J(sv), 'normEdl: הטלפון = השרתון (300, עם af)');
  ok(js.filter((e) => e && e.af).length > 40, 'הווקטורים מכסים af');
  const tmp = path.join(os.tmpdir(), 'snb-r9-' + process.pid + '.json');
  fs.writeFileSync(tmp, J(vecs));
  const py = spawnSync('python3', ['-c', `
import sys, json; sys.path.insert(0, sys.argv[1]); import edl as E
out = []
for v in json.load(open(sys.argv[2])):
    e = E.norm_edl(v['e'], v['dur'])
    out.append([e, E.pre(e), E.compose_edl(e, E.norm_edl({'k': [], 'sp': 2}, 0))])
print(json.dumps(out))`, path.join(root, 'translator'), tmp], { encoding: 'utf8' });
  fs.unlinkSync(tmp);
  ok(py.status === 0, 'python3' + (py.status ? ': ' + py.stderr : ''));
  const P = JSON.parse(py.stdout), Q = js.map((e) => [e, E.edlPre(e), E.composeEdl(e, E.normEdl({ k: [], sp: 2 }, 0))]);
  const bad = Q.findIndex((x, i) => J(x) !== J(P[i]));
  ok(bad < 0, 'הטלפון = העובד: normEdl, pre, composeEdl (300)' + (bad >= 0 ? ' — ' + J(Q[bad]) + ' / ' + J(P[bad]) : ''));

  /* ---------- 3. העובד ---------- */
  const fp = read('translator/frame.py');
  const sha = (fp.match(/MODEL_SHA256 = '([0-9a-f]{64})'/) || [])[1];
  const model = fs.readFileSync(path.join(root, 'translator/models/face_detection_yunet_2023mar.onnx'));
  ok(sha && crypto.createHash('sha256').update(model).digest('hex') === sha && model.length < 300000, 'YuNet בריפו (MIT, ‏~230KB) = ה־sha256 ב־frame.py');
  ok(fs.existsSync(path.join(root, 'translator/models/LICENSE-yunet')) && /MIT License/.test(read('translator/models/LICENSE-yunet')), 'הרישיון לצד המודל');
  ok(!/import cv2|requests|urllib/.test(fp) && /onnxruntime/.test(fp), 'בלי OpenCV ובלי רשת — onnxruntime בלבד (כבר בתמונה ובסביבת ה־Routine)');
  const ed = read('translator/edl.py');
  ok(/EXTRA_POS = \('y', 'af', 'z'\)/.test(ed) && /x='%s':y=%d" % \(cb\['w'\], cb\['h'\], F\.x_expr/.test(ed) && /except Exception as ex:\s+# noqa: BLE001 — המסגור לא מפיל הפקה/.test(ed),
    'edl.py: crop עם x לפי הזמן; תקלה במסגור — המיקום הקבוע, ההפקה ממשיכה');
  ok(/E\.apply\(src, cut, ec, ov=ov, logo=logo, auto_frame=True\)/.test(read('translator/rerender.py')), 'rerender.py: המסגור רק בהפקה מחדש');

  /* ---------- 4. הממשק ---------- */
  const st = read('studio.js'), sed = read('studioedl.js');
  ok(/'ed-af'/.test(sed) && /afRow\.hidden = !afB \|\| xRow\.hidden/.test(sed) && /opts\.full \? b\('sm', T\('studioEdAf'\)/.test(sed), 'בעורך: "מסגור לפי הדובר" רק בהפקה מחדש ורק כשיש חיתוך');
  ok(/ar: '9:16', x: 0\.5, af: true \}/.test(st), 'שורטס מ"רעיונות" — 9:16 עם מסגור לפי הדובר');
  ok(/if \(e\.af\) parts\.push\(T\('studioEdAfShort'\)\)/.test(st), 'בסיכום העריכה');
  console.log('# ' + n + ' בדיקות עברו');
})().catch((e) => { console.error('FAIL - ' + (e && e.stack || e)); process.exit(1); });
