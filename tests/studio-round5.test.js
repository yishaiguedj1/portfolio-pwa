// סבב 5: עיצוב הכתוביות בהפקה מחדש — גודל, צבע, רקע כהה, גובה. אותו מודל בטלפון (תצוגה חיה על הנגן),
// בשרתון (rrSpec) ובעובד (rerender.py → ASS). הרצה: node tests/studio-round5.test.js
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const VPY = fs.existsSync('/tmp/vtv/bin/python') ? '/tmp/vtv/bin/python' : 'python3';
const py = (code, bin = 'python3') => execFileSync(bin, ['-c', 'import sys, json; sys.path.insert(0, "translator"); import rerender as R\n' + code], { cwd: root, encoding: 'utf8' });

(async () => {
  const P = await import(path.join(root, 'studioplay.js'));
  const S = require(path.join(root, 'ibkr-proxy/lib/studio.js'));

  /* ---------- 1. המודל — זהה בשלושה מקומות ---------- */
  ok(JSON.stringify(P.normSty({ k: 130, c: 'y', bx: true, y: 20 })) === '{"k":130,"c":"y","bx":1,"y":20}', 'normSty: כמו שהוא');
  ok(P.normSty({ k: 100, c: 'w', bx: false, y: 0 }) === null && P.normSty(null) === null && P.normSty('x') === null, 'הכל ברירת מחדל — null (לא נשמר כלום)');
  ok(JSON.stringify(P.normSty({ k: 134, c: 'red', bx: 'yes', y: 99 })) === '{"k":130}' && JSON.stringify(P.normSty({ k: 300, y: 12.6 })) === '{"y":13}',
    'גודל מעוגל ל־10 ובטווח; צבע / רקע / גובה לא מוכרים — בחוץ');
  let seed = 3;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const cases = Array.from({ length: 300 }, () => ({ k: Math.round(rnd() * 200), c: ['w', 'y', 'c', 'x', ''][Math.floor(rnd() * 5)], bx: [true, false, 1, 0, 'x'][Math.floor(rnd() * 5)], y: Math.round(rnd() * 60 - 5) }));
  const bad = cases.findIndex((o) => JSON.stringify(P.normSty(o)) !== JSON.stringify(S.normSty(o)));
  ok(bad < 0, 'normSty: הטלפון = השרתון (300 קלטים)' + (bad >= 0 ? ' — ' + JSON.stringify(cases[bad]) : ''));
  const pyr = JSON.parse(py('print(json.dumps([R.norm_sty(o) for o in json.loads(sys.stdin.read())]))'.replace('sys.stdin.read()', JSON.stringify(JSON.stringify(cases)))));
  const badPy = cases.findIndex((o, i) => JSON.stringify(P.normSty(o)) !== JSON.stringify(pyr[i]));
  ok(badPy < 0, 'norm_sty בעובד = הטלפון (300 קלטים)' + (badPy >= 0 ? ' — ' + JSON.stringify(cases[badPy]) : ''));
  ok(JSON.stringify(Object.keys(P.STY_COLORS)) === JSON.stringify(JSON.parse(py('print(json.dumps(list(R.STY_ASS)))'))), 'אותם צבעים בטלפון ובעובד');
  const asBgr = (hex) => '&H00' + hex.slice(5, 7) + hex.slice(3, 5) + hex.slice(1, 3);
  const ass = JSON.parse(py('print(json.dumps(R.STY_ASS))'));
  ok(Object.keys(P.STY_COLORS).every((c) => ass[c].toUpperCase() === asBgr(P.STY_COLORS[c]).toUpperCase()), 'הצבע בצריבה (ASS, BGR) = הצבע בתצוגה המקדימה');

  /* ---------- 2. השרתון ---------- */
  const parent = { id: 'jX', spec: { name: 'a.mp4', dur: 60, style: 'bold', mode: 'sonnet-medium' }, fo: [{ k: 'cues', id: 'cue1234567890', size: 5 }], folder: 'fold1234567890' };
  ok(JSON.stringify(S.rrSpec(parent, { out: ['compact'], sty: { k: 120, c: 'c' } }).sty) === '{"k":120,"c":"c"}' && !('sty' in S.rrSpec(parent, { out: ['compact'], sty: { k: 100 } })),
    'rrSpec: העיצוב נשמר בעבודת ההפקה (ברירת מחדל — בלי שדה)');

  /* ---------- 3. העובד: ASS ---------- */
  let vt = true;
  try { execFileSync(VPY, ['-c', 'import sys; sys.path.insert(0, "translator"); import vt.subs'], { cwd: root }); } catch (e) { vt = false; }
  if (vt) {
    const r = JSON.parse(py(`
from vt import config as C
from vt.subs import write_ass, write_ass_compat
cues = [{'id': 1, 'start': 0, 'end': 2, 'lines': ['שלום', 'עולם']}]
b = C.STYLES['bold']
s1 = R.apply_sty(b, R.norm_sty({'k': 120, 'c': 'y', 'y': 20}))
s2 = R.apply_sty(b, R.norm_sty({'bx': 1}))
a2 = R.box_ass(write_ass(cues, s2, 1920, 1080)); c2 = R.box_ass(write_ass_compat(cues, s2, 1920, 1080))
print(json.dumps([s1.size / b.size, s1.primary, b.bottom_y - s1.bottom_y, R.apply_sty(b, None) is b,
  [l for l in a2.split('\\n') if l.startswith('Style: Main')][0], [l for l in c2.split('\\n') if l.startswith('Style: Default')][0],
  s2.faux_bold, s2.line_pitch >= b.size * 1.22, 'Dialogue: 1' in a2]))`, VPY));
    ok(Math.abs(r[0] - 1.2) < 1e-9 && r[1] === '&H004DE1FF' && Math.abs(r[2] - 216) < 1e-9 && r[3] === true, 'apply_sty: גודל ×1.2, צבע צהוב, הרמה 20% (216 מתוך 1080); בלי עיצוב — אותו סגנון');
    ok(/,&H60000000,/.test(r[4]) && /,0,3,[\d.]+,/.test(r[4]) && /,0,3,[\d.]+,/.test(r[5]), 'רקע: BorderStyle 3 (קופסה) בצבע שחור שקוף למחצה — גם בכתוביות של ה־MKV');
    ok(r[6] === 0 && r[7] === true && r[8] === false, 'רקע: בלי שכבת ההעבה, ומרווח שורות בלי חפיפה של הקופסאות');
  } else console.log('# (בלי סביבת vt — דילגנו על בדיקת ה־ASS)');
  ok(/if isinstance\(spec\.get\('sty'\), dict\):[\s\S]{0,140}eds \+= \['--sty'/.test(read('translator/job.py')) && /p\.add_argument\('--sty'/.test(read('translator/rerender.py')),
    'job.py render מעביר את העיצוב ל־rerender.py (שמנרמל שוב)');
  ok(/fix = box_ass if sty and sty\.get\('bx'\)/.test(read('translator/rerender.py')), 'הרקע — רק כשביקשו');

  /* ---------- 4. הטלפון ---------- */
  const sj = read('studio.js');
  ok(/sty: rrSty\(\)[,} ]/.test(sj) && /go\('sty', rec\.id\)/.test(sj) && /else if \(ui\.view === 'sty'\) pageSty\(p\);/.test(sj), 'הפקה מחדש: שורה "עיצוב הכתוביות" → הדף; העיצוב נשלח עם ההפקה');
  ok(/x === 'cut' \|\| x === 'sty'( \|\| x === '[a-z]+')* \? \['rr', y\]/.test(sj) && /if \(ui\.view === 'sty'\) syStop\(\);/.test(sj), '"חזור" מהעיצוב → ההפקה מחדש; היציאה עוצרת את הנגן');
  ok(/const sty = normSty\(o\.sty\); if \(sty\) s\.sty = sty;/.test(sj), 'העיצוב האחרון נשמר בהגדרות (ברירת המחדל להפקה הבאה)');
  ok(/setStyle\(o\) \{/.test(read('studioplay.js')) && /--sub-k/.test(read('studio.css')) && /\.st-pl\.boxed \.st-pl-sub span/.test(read('studio.css')), 'הנגן: תצוגה חיה (גודל, צבע, רקע לכל שורה, גובה)');
  console.log('# ' + n + ' בדיקות עברו');
})().catch((e) => { console.error('FAIL - ' + (e && e.stack || e)); process.exit(1); });
