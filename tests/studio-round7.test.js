// סבב 7: עורך הווידאו ג׳ — ניקוי רעש, צבע ומסננים, טשטוש אזור, מעברים, תמונה ממוזערת, כותרת ולוגו.
// אותה רשימת עריכות (EDL) ואותו normOv בטלפון, בשרתון ובעובד; ffmpeg אמיתי כשיש. הרצה: node tests/studio-round7.test.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const VPY = fs.existsSync('/tmp/vtv/bin/python') ? '/tmp/vtv/bin/python' : 'python3';
const pyj = (code, input, bin = 'python3') => JSON.parse(execFileSync(bin, ['-c', 'import sys, json; sys.path.insert(0, "translator"); import edl as E\n' + code], { cwd: root, encoding: 'utf8', input: input || '' }));
let FF = true;
try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); } catch (e) { FF = false; }

(async () => {
  const ED = await import(path.join(root, 'studioedl.js'));
  const S = require(path.join(root, 'ibkr-proxy/lib/studio.js'));

  /* ---------- 1. רשימת העריכות — השדות החדשים, זהה בשלושה מקומות ---------- */
  ok(JSON.stringify(ED.normEdl({ dn: 2, br: 12, ct: -7.5, sa: -55, fx: 'warm', bl: [0.123, 0.456, 0.3, 0.2], tr: true, th: 3.25 }, 30))
    === '{"k":[],"ar":"src","x":0.5,"dn":2,"br":10,"ct":-5,"sa":-50,"fx":"warm","bl":[0.12,0.46,0.3,0.2],"tr":true,"th":3.3}', 'normEdl: עיגול לצעדים, ובסדר קבוע');
  ok(ED.normEdl({ dn: 3, br: 40, sa: 101, fx: 'x', bl: [0.9, 0.9, 0.2, 0.2], tr: 1, th: -1 }, 30) === null, 'מחוץ לטווח / קוד לא מוכר / מלבן שיוצא מהתמונה — בחוץ (וכשלא נשאר כלום — null)');
  ok(ED.normEdl({ mu: true, dn: 1 }, 30).dn === undefined, 'השתקה — בלי ניקוי רעש');
  ok(ED.edlPre(ED.normEdl({ k: [[1, 5]], br: 10, tr: true, th: 2 }, 30)).br === undefined, 'לפני התרגום — רק חיתוך ויחס (edlPre)');
  let seed = 19;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const cases = Array.from({ length: 400 }, () => ({ k: rnd() < 0.5 ? [[1, 5], [6, 9]] : [], ar: pick(['src', '9:16']), dn: pick([0, 1, 2, 3, true, '1']), br: pick([0, 5, -7.5, 12.4, 31, -30, 'x']),
    ct: pick([0, 2.5, -2.5, 30, 40]), sa: pick([0, -55, 100, -101, 45]), fx: pick(['bw', 'warm', 'cool', 'vint', 'x', null]),
    bl: pick([null, [0.1, 0.2, 0.3, 0.4], [0.9, 0.9, 0.2, 0.2], [0, 0, 0.04, 0.5], [0.123, 0.456, 0.5, 0.5], ['a', 0, 1, 1]]), tr: pick([true, false, 1]), th: pick([undefined, 0, 3.25, -1, 12.05, 1e9]), mu: rnd() < 0.1 }));
  const js = cases.map((e) => ED.normEdl(e, 30));
  ok(cases.every((e, i) => JSON.stringify(js[i]) === JSON.stringify(S.normEdl(e, 30))), 'normEdl: הטלפון = השרתון (400 עריכות)');
  const py = pyj('print(json.dumps([E.norm_edl(e, 30) for e in json.loads(sys.stdin.read())]))', JSON.stringify(cases));
  const badPy = cases.findIndex((e, i) => JSON.stringify(py[i]) !== JSON.stringify(js[i]) && JSON.stringify(py[i]).replace(/\.0(?=[,\]])/g, '') !== JSON.stringify(js[i]));
  ok(badPy < 0, 'norm_edl בעובד = הטלפון (400 עריכות)' + (badPy >= 0 ? ' — ' + JSON.stringify(cases[badPy]) : ''));
  const c3 = ED.composeEdl(ED.normEdl({ k: [[10, 30]] }, 90), ED.normEdl({ k: [[0, 10]], fx: 'bw', tr: true, th: 4 }, 20));
  ok(c3.fx === 'bw' && c3.tr === true && c3.th === 4, 'composeEdl: השדות החדשים — מהעריכה שאחרי התרגום');

  /* ---------- 2. כותרת ולוגו — normOv ---------- */
  const OVS = [{ t: '  שלום {עולם}\\ \u202bא\u0000  ', ta: 5 }, { t: 'x'.repeat(80), ta: true }, { lg: 'data:image/png;base64,AAAA', lp: 'bl', ls: 21 }, { lg: 'data:image/gif;base64,AA' },
    { lg: 'data:image/png;base64,AA==', ls: 99 }, { lg: 'data:image/svg+xml;base64,AA==' }, { lg: 'data:image/png;base64,AA==\n' }, { t: '{\\fs200}' }, null, 'x', { t: '' }];
  const ovj = OVS.map((o) => ED.normOv(o));
  ok(OVS.every((o, i) => JSON.stringify(ovj[i]) === JSON.stringify(S.normOv(o))), 'normOv: הטלפון = השרתון');
  let vt = true;
  try { execFileSync(VPY, ['-c', 'import sys; sys.path.insert(0, "translator"); import rerender'], { cwd: root, stdio: 'ignore' }); } catch (e) { vt = false; }
  const ovp = JSON.parse(execFileSync('python3', ['-c', 'import sys, json; sys.path.insert(0, "translator"); import rerender as R; print(json.dumps([R.norm_ov(o) for o in json.loads(sys.stdin.read())]))'],
    { cwd: root, encoding: 'utf8', input: JSON.stringify(OVS) }));
  ok(OVS.every((o, i) => JSON.stringify(ovp[i]) === JSON.stringify(ovj[i])), 'norm_ov בעובד = הטלפון');
  ok(ovj[0].t === 'שלום עולם א' && ovj[7].t === 'fs200' && ovj[1].ta === undefined && ovj[3] === null && ovj[5] === null && ovj[6] === null,
    'כותרת: בלי { } \\ ותווי בקרה / כיווניות (ASS לא יכול לקבל פקודות מהטקסט); לוגו: רק PNG / JPEG / WebP כ־data URL תקין');
  const par = { id: 'jX', spec: { name: 'a.mp4', dur: 60, style: 'bold' }, fo: [{ k: 'cues', id: 'cue1234567890', size: 5 }], folder: 'fold1234567890' };
  ok(JSON.stringify(S.rrSpec(par, { out: ['compact'], ov: { t: 'כותרת' } }).ov) === '{"t":"כותרת"}', 'rrSpec: כותרת ולוגו נשמרים בעבודת ההפקה');

  /* ---------- 3. ffmpeg ---------- */
  const args = pyj(`i = {"w": 640, "h": 360, "v": True, "a": True, "dur": 12}
e = E.norm_edl({"k": [[0, 4], [5, 9]], "ar": "9:16", "x": 0.3, "dn": 2, "br": 10, "ct": 15, "sa": -30, "fx": "warm", "bl": [0.1, 0.1, 0.4, 0.2], "tr": True}, 12)
print(json.dumps([E.ffmpeg_args("s", "o", e, i, ov={"lp": "bl", "ls": 20}, logo="l.png"), E.ffmpeg_args("s", "o", E.norm_edl({"fx": "bw"}, 12), i)]))`);
  const a0 = args[0].join(' ');
  ok(/-i s -i l\.png -filter_complex/.test(a0) && /eq=brightness=0\.10:contrast=1\.15:saturation=0\.70,colorbalance=/.test(a0) && /afftdn=nr=24:nf=-35,highpass=f=80/.test(a0),
    'ffmpeg: הלוגו = קלט שני; צבע (eq) ומסנן אחרי החיתוך; ניקוי רעש לפני הכל');
  ok(/fade=t=in:st=0:d=0\.25,fade=t=out:st=3\.750:d=0\.25/.test(a0) && /afade=t=in:d=0\.25/.test(a0) && /split=2\[bla\]\[blb\];\[blb\]crop=/.test(a0) && /gblur=sigma=/.test(a0)
    && /\[1:v\]scale=40:-2,format=rgba\[lgo\];\[vbl\]\[lgo\]overlay=6:main_h-overlay_h-6\[vlg\]/.test(a0), 'מעברים בכל תפר (בלי לשנות אורך), טשטוש אזור, לוגו בפינה שנבחרה');
  ok(!/-i l\.png/.test(args[1].join(' ')) && /hue=s=0/.test(args[1].join(' ')), 'בלי לוגו — קלט אחד; שחור־לבן');
  if (FF) {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'r7-'));
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=size=640x360:rate=25:duration=12', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=12', '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac', '-shortest', path.join(d, 's.mp4')]);
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=red:s=60x30', '-frames:v', '1', path.join(d, 'l.png')]);
    const r = pyj(`d = sys.argv[1] if len(sys.argv) > 1 else ''
import os
d = ${JSON.stringify(d)}
e = E.norm_edl({"k": [[0, 4], [5, 9]], "ar": "9:16", "x": 0.3, "dn": 2, "br": 10, "ct": 15, "sa": -30, "fx": "vint", "bl": [0.1, 0.1, 0.4, 0.2], "tr": True}, 12)
E.apply(os.path.join(d, "s.mp4"), os.path.join(d, "o.mp4"), e, ov={"lp": "tr", "ls": 20}, logo=os.path.join(d, "l.png"))
print(json.dumps(E.probe(os.path.join(d, "o.mp4"))))`);
    ok(r.w === 202 && r.h === 360 && Math.abs(r.dur - 8) < 0.2 && r.a, 'ffmpeg אמיתי: כל המסננים יחד — המידות והאורך כמו בעריכה (המעברים לא מקצרים)');
    fs.rmSync(d, { recursive: true, force: true });
  } else console.log('# (בלי ffmpeg — דילגנו על ההרצה האמיתית)');

  /* ---------- 4. העובד: כותרת ב־ASS, תמונה ממוזערת, לוגו מה־spec ---------- */
  const rp = read('translator/rerender.py'), jp = read('translator/job.py');
  ok(/def title_event\(/.test(rp) && /_ass_escape\(rtl\(ov\['t'\]\)\)/.test(rp) && /\{\\\\an8\\\\pos/.test(rp), 'הכותרת: שורת ASS נפרדת בראש התמונה (libass — עברית נכונה), מנוקה ומוסלשת');
  ok(/\('thumb', '\{n\}\.thumb\.jpg', ' \(תמונה\)\.jpg', 'image\/jpeg'\)/.test(jp) && /k == 'thumb' and \(od \/ fn\.format\(n=ctx\.name\)\)\.exists\(\)/.test(jp), 'התמונה הממוזערת עולה כשנוצרה');
  ok(/OV_LG_RE\.match\(lg\) if isinstance\(lg, str\) and len\(lg\) <= 65536/.test(jp) && /k != 'lg'/.test(jp), 'job.py: הלוגו לקובץ (רק data URL תקין), ול־rerender.py בלי התמונה');
  ok(S.OUT_KINDS.includes('thumb') && /'meta', 'thumb'\]/.test(read('studio.js')), 'thumb = סוג תוצר מוכר');
  if (vt && FF) {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'r7-'));
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=size=320x180:rate=25:duration=10', '-f', 'lavfi', '-i', 'sine=duration=10', '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac', '-shortest', path.join(d, 's.mp4')]);
    fs.writeFileSync(path.join(d, 'c.json'), JSON.stringify([{ start: 0.5, end: 3, lines: ['שלום'] }, { start: 5.2, end: 8, lines: ['שניה'] }]));
    execFileSync(VPY, [path.join(root, 'translator', 'rerender.py'), '--src', path.join(d, 's.mp4'), '--cues', path.join(d, 'c.json'), '--out', path.join(d, 'o'), '--name', 't', '--want', 'mkv',
      '--edl', '{"k":[[0,4],[5,9]],"th":1.5}', '--ov', '{"t":"כותרת {x} 2026","ta":5}'], { cwd: path.join(root, 'translator'), stdio: 'ignore' });
    const ass = fs.readFileSync(path.join(d, 'o', 'he.ass'), 'utf8');
    ok(/Dialogue: 2,0:00:00\.00,0:00:05\.00,Main,title,0,0,0,,\{\\an8\\pos\([\d.]+,[\d.]+\)\\fs[\d.]+\}.*כותרת x 2026/.test(ass) && fs.existsSync(path.join(d, 'o', 't.thumb.jpg')),
      'rerender.py: הכותרת ל־5 שניות (בלי הסוגריים), והתמונה הממוזערת נוצרה');
    fs.rmSync(d, { recursive: true, force: true });
  } else console.log('# (בלי סביבת vt — דילגנו על rerender.py)');

  /* ---------- 5. הטלפון ---------- */
  ok(ED.cssFilter({ br: 10, ct: -10, sa: 20, fx: 'bw' }) === 'brightness(1.1) contrast(0.9) saturate(1.2) grayscale(1)' && ED.cssFilter(null) === '', 'cssFilter: תצוגה מקדימה של הצבע');
  const sj = read('studio.js');
  ok(/ov: rrOv\(rec\.id\) \}/.test(sj) && /else if \(ui\.view === 'ov'\) pageOv\(p\);/.test(sj) && /x === 'ov' \? \['rr', y\]/.test(sj), 'הפקה מחדש: "כותרת ולוגו" → הדף; נשלח עם ההפקה');
  ok(/d\.length <= OV_LG_MAX && normOv\(\{ lg: d \}\)/.test(sj) && /store\.settings\.lg = \{ d, p:/.test(sj), 'הלוגו מוקטן בטלפון עד שנכנס, ונשמר בהגדרות (המותג שלך)');
  ok(/ovT\.set\(rec\.id, Object\.assign\(\{\}, ovT\.get\(rec\.id\) \|\| \{\}, patch\)\)/.test(sj), 'הכותרת מתעדכנת מהמצב העדכני (באג שנמצא ב־QA: בחירת משך מחקה את הטקסט)');
  const es = read('studioedl.js');
  ok(/blr\.addEventListener\('pointerdown'/.test(es) && /v\.style\.filter = cssFilter\(ex\)/.test(es) && /blr\.remove\(\)/.test(es), 'העורך: מלבן טשטוש שגוררים, תצוגה מקדימה של הצבע, ניקוי ביציאה');
  console.log('# ' + n + ' בדיקות עברו');
})().catch((e) => { console.error('FAIL - ' + (e && e.stack || e)); process.exit(1); });
