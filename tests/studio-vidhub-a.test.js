// 26/10/2026 (בעקבות המחקר על Vid Hub, שלב א׳): עיצוב הכתוביות כבר בטופס ובזמן שהעבודה רצה — הצריבה הראשונה משתמשת בו;
// "קריוקי" יצא מהטופס; כמה זמן נשמר — באומדן; /healthz?v=1 = הגרסה. הרצה: node tests/studio-vidhub-a.test.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const VPY = fs.existsSync('/tmp/vtv/bin/python') ? '/tmp/vtv/bin/python' : 'python3';

(async () => {
  const S = require(path.join(root, 'ibkr-proxy/lib/studio.js'));
  const base = { name: 'a.mp4', size: 1000, to: ['he'], out: ['compact'], mode: 'haiku-medium' };

  /* ---------- 1. השרתון: העיצוב בטופס ---------- */
  const sp = S.normSpec(Object.assign({}, base, { sty: { k: 120, c: 'y', bx: true, y: 20, x: 'evil' } }));
  ok(sp && JSON.stringify(sp.sty) === '{"k":120,"c":"y","bx":1,"y":20}', 'normSpec: העיצוב נשמר מנורמל (רק מספרים וקודים)');
  ok(!('sty' in S.normSpec(Object.assign({}, base, { sty: { k: 100 } }))), 'עיצוב של ברירת המחדל — לא נשמר');
  ok(!('sty' in S.normSpec(Object.assign({}, base, { sty: 'x' }))), 'עיצוב לא תקין — בחוץ');
  const subs = S.normSpec(Object.assign({}, base, { src: 'subs', eng: 'api', size: 500, sty: { k: 120 } }));
  ok(subs && !('sty' in subs), 'קובץ כתוביות (בלי צריבה) — בלי עיצוב');

  /* ---------- 2. השרתון: שינוי בזמן העבודה, והעובד שואל ---------- */
  const api = read('ibkr-proxy/api/studio.js');
  ok(/if \(op === 'sty'\) \{[\s\S]{0,700}st !== 'new' && st !== 'queued' && st !== 'running'[\s\S]{0,400}S\.normSty\(body\.sty\)[\s\S]{0,300}patchJob\(deps, job\.id, \{ spec \}\)/.test(api),
    "op sty: רק לעבודת תרגום שעוד לא הסתיימה, מנורמל, בלי updated");
  ok(/body\.op === 'qa'\) return res\.status\(200\)\.json\(\{[^\n]*sty: S\.normSty\(job\.spec && job\.spec\.sty\)/.test(api), 'op qa של העובד מחזיר את העיצוב העדכני');
  ok(/kt: \{ s: SC\.SRC_TTL, j: SC\.jobTtl\(PROJECT\(\)\) \}/.test(api), 'status: כמה זמן נשמר (לאומדן)');

  /* ---------- 3. העובד: build מקבל את העיצוב, ולפני כל בנייה בודק מה נבחר עכשיו ---------- */
  const jp = read('translator/job.py'), pl = read('translator/pipeline.py'), cli = read('translator/vt/cli.py');
  ok(!/\['build', ctx\.name, '--style', vt_style/.test(jp) && (jp.match(/\['build', ctx\.name\] \+ build_args\(ctx\)/g) || []).length === 2, 'job.py: כל בנייה דרך build_args');
  ok(/def build_args\(ctx\):[\s\S]{0,200}sty_refresh\(ctx\)[\s\S]{0,300}'--sty', json\.dumps/.test(jp), 'build_args: שואל את השרתון ומעביר --sty');
  ok(/def sty_refresh\(ctx\):[\s\S]{0,500}ctx\.c\.call\('qa'\)[\s\S]{0,200}except \(SystemExit, Exception\):\s+return[\s\S]{0,120}if not isinstance\(j, dict\) or 'sty' not in j:\s+return/.test(jp),
    'sty_refresh: תקלה / שרתון ישן = מה שנשמר בלקיחה');
  ok(!/\['--style', sty\] if cmd == 'build'/.test(pl) && (pl.match(/self\.build_args\(sty\) if cmd == 'build'/g) || []).length === 3, 'pipeline.py: שלוש הבניות דרך build_args');
  ok(/p\.add_argument\("--sty"/.test(cli) && /style = apply_sty\(_style\(meta, style_name\), sty\)/.test(cli) && /fix\(write_ass\(final/.test(cli) && /fix\(write_ass_compat\(final/.test(cli),
    'vt build --sty: הסגנון לפני המדידה (שבירת השורות לפי הגודל), והרקע בשני קובצי ה־ASS');
  ok(/from vt\.sty import STY_ASS, norm_sty, apply_sty, box_ass/.test(read('translator/rerender.py')) && !/def norm_sty/.test(read('translator/rerender.py')),
    'rerender.py משתמש באותו קוד (vt/sty.py) — מקום אחד');

  // vt/sty.py = normSty של השרתון (300 קלטים)
  let seed = 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const cases = Array.from({ length: 300 }, () => ({ k: Math.round(rnd() * 200), c: ['w', 'y', 'c', 'x', ''][Math.floor(rnd() * 5)], bx: [true, false, 1, 0, 'x'][Math.floor(rnd() * 5)], y: Math.round(rnd() * 60 - 5) }));
  const pyr = JSON.parse(execFileSync('python3', ['-c', 'import sys, json; sys.path.insert(0, "translator"); from vt.sty import norm_sty\nprint(json.dumps([norm_sty(o) for o in json.loads(sys.argv[1])]))', JSON.stringify(cases)], { cwd: root, encoding: 'utf8' }));
  ok(cases.every((o, i) => JSON.stringify(pyr[i]) === JSON.stringify(S.normSty(o))), 'vt/sty.py = השרתון (300 קלטים)');

  // build_args מול שרתון מדומה (בלי vt): עיצוב שהשתנה בזמן העבודה נכנס, ושרתון שלא עונה — נשאר מה שהיה
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vhsty-'));
  const out = execFileSync('python3', ['-c', `
import sys, json, os
sys.path.insert(0, "translator")
os.environ["SNB_STATE"] = sys.argv[1]
import job
saved = []
job.save_state = lambda st: saved.append(json.dumps(st.get("spec", {}).get("sty")))
class C:
    def __init__(s, r): s.r = r
    def call(s, op, **k):
        if isinstance(s.r, BaseException): raise s.r
        return s.r
class X: pass
def run(resp, spec):
    x = X(); x.c = C(resp); x.st = {"spec": spec}
    return job.build_args(x)
print(json.dumps([
  run({"ok": True, "sty": {"k": 120, "bx": 1}}, {"style": "classic"}),
  run({"ok": True, "sty": None}, {"style": "bold", "sty": {"k": 90}}),
  run(SystemExit("x"), {"style": "karaoke", "sty": {"k": 90}}),
  run({"ok": True}, {"style": "bold", "sty": {"y": 10}}),
  saved]))
`, tmp], { cwd: root, encoding: 'utf8' });
  const r = JSON.parse(out.trim().split('\n').pop());
  ok(JSON.stringify(r[0]) === JSON.stringify(['--style', 'classic', '--sty', '{"k":120,"bx":1}']), 'עיצוב חדש מהשרתון — נכנס לבנייה');
  ok(JSON.stringify(r[1]) === JSON.stringify(['--style', 'bold']), 'העיצוב בוטל בזמן העבודה — ברירת המחדל');
  ok(JSON.stringify(r[2]) === JSON.stringify(['--style', 'bold', '--sty', '{"k":90}']), 'השרתון לא ענה — מה שנשמר בלקיחה; קריוקי ישן = מודגש');
  ok(JSON.stringify(r[3]) === JSON.stringify(['--style', 'bold', '--sty', '{"y":10}']), 'שרתון ישן (בלי sty בתשובה) — לא נוגעים');
  ok(r[4].length === 2, 'המצב נשמר רק כשהעיצוב השתנה');

  // vt build אמיתי (כשיש סביבת vt): הרקע = BorderStyle 3 בשני הקבצים, והגודל ×1.2
  let vtOk = true;
  try { execFileSync(VPY, ['-c', 'import sys; sys.path.insert(0, "translator"); import vt.cli'], { cwd: root, stdio: 'ignore' }); } catch (e) { vtOk = false; }
  if (vtOk) {
    const o = execFileSync(VPY, ['-c', `
import sys, json
sys.path.insert(0, "translator")
from vt import config as C
from vt.sty import apply_sty, box_ass, norm_sty
from vt.subs import write_ass, write_ass_compat
b = C.STYLES["bold"]
s = apply_sty(b, norm_sty({"k": 120, "bx": 1}))
cues = [{"id": 1, "start": 1.0, "end": 2.5, "lines": ["שלום"], "fi": 25, "fo": 62, "si": 25, "so": 62}]
try:
    a = box_ass(write_ass(cues, s, 1920, 1080, "t")); c = box_ass(write_ass_compat(cues, s, 1920, 1080, "t"))
    print(json.dumps([s.size / b.size, ",3," in a.split("Style: ")[1].split("\\n")[0] or ",3," in a, ",3," in c]))
except Exception as e:
    print(json.dumps([s.size / b.size, None, None]))
`], { cwd: root, encoding: 'utf8' });
    const v = JSON.parse(o.trim().split('\n').pop());
    ok(Math.abs(v[0] - 1.2) < 1e-9, 'apply_sty מ־vt/sty.py: גודל ×1.2');
    if (v[1] !== null) ok(v[1] && v[2], 'רקע: BorderStyle 3 גם ב־he.ass וגם ב־he.player.ass');
  } else console.log('# (בלי סביבת vt — דילגנו על הבנייה)');

  /* ---------- 4. הטלפון ---------- */
  const st = read('studio.js');
  ok(/for \(const k of STYLES\.filter\(\(x\) => x !== 'karaoke'\)\)/.test(st) && /style: s\.style === 'karaoke' \? 'bold' : s\.style/.test(st), 'קריוקי לא מוצע בטופס; טיוטה ישנה עם קריוקי = מודגש');
  ok(/sty: normSty\(store\.settings\.sty\)/.test(st), 'בטופס: העיצוב האחרון שבחרת = ברירת המחדל');
  ok((st.match(/\.\.\.\(f\.sty \? \{ sty: f\.sty \} : \{\}\)/g) || []).length === 3 && /sty: f\.sty \|\| null, terms/.test(st), 'העיצוב נשלח ביצירה (קובץ, קישור, הורדה בטלפון, ובחירה דרך האפליקציה — pu)');
  ok(/styFold\('form'/.test(st) && /if \(styEditable\(rec\) && !rec\.spec\.ka\) p\.append\(styFold\('job:'/.test(st), 'מקטע העיצוב בטופס ובדף העבודה');
  ok(/function styEditable\(rec\)[\s\S]{0,500}\['bn', 'sv'\]\.includes\(stg\)/.test(st), 'בדף העבודה — רק עד שהצריבה מתחילה');
  ok(/net\.api\('sty', \{ job: rec\.id, sty: rec\.spec\.sty \|\| null \}\)/.test(st) && /setTimeout\([\s\S]{0,300}, 600\)\);/.test(st), 'נשלח לשרתון אחרי 600ms בלי נגיעה (רק הבחירה האחרונה)');
  ok(/\+ keepLine\(\);/.test(st) && /function keepLine\(\)[\s\S]{0,200}if \(!k \|\| !ui\.r2\) return '';/.test(st), 'באומדן: כמה זמן נשמר (רק במצב השרת)');
  ok(/function pageSty\(p\)[\s\S]{0,2000}p\.append\(\.\.\.styControls\(st, stySet\)\)/.test(st), 'ההפקה מחדש משתמשת באותן בקרות');

  // מחרוזות בשתי השפות
  const app = read('app.js');
  for (const k of ['studioStySample1', 'studioStySample2', 'studioEstKeep', 'studioKeepDay', 'studioKeepHours'])
    ok((app.match(new RegExp('\\b' + k + ': "', 'g')) || []).length === 2, 'מחרוזת ' + k + ' בעברית ובאנגלית');
  ok(!/studioSampleK1/.test(app), 'מחרוזות הקריוקי הוסרו');

  /* ---------- 5. /healthz?v=1 ---------- */
  const sv = read('ibkr-proxy/server.js');
  ok(/url\.searchParams\.get\('v'\) === '1'[\s\S]{0,200}\/\^\[0-9a-f\]\{40\}\$\/\.test\(process\.env\.SNB_GIT_SHA[\s\S]{0,120}: res\.status\(200\)\.send\('ok'\)/.test(sv), '/healthz: בלי v — "ok" כמו תמיד; v=1 — ה־commit');
  ok(/ARG SNB_GIT_SHA=/.test(read('infra/app/Dockerfile')) && /--build-arg "SNB_GIT_SHA=\$\{GITHUB_SHA\}"/.test(read('.github/workflows/app-image.yml')), 'התמונה נבנית עם ה־commit');

  console.log('# ' + n + ' בדיקות עברו');
})().catch((e) => { console.error(e); process.exit(1); });
