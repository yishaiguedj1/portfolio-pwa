// v380: סטודיו התרגום — זיכרון המונחים (ServiceNow: LTM categories). מילון אחד לכל משתמש, קובץ TSV ב־Drive של הסטודיו
// (appProperties snbGloss=1, אותו פורמט של tr/glossary.tsv של vt). כל עבודה מקבלת רק את המונחים שמופיעים בסרטון, מתחת
// לשורת "מהמילון שלך" — המשתמש גובר. בסוף העבודה: מונחים חדשים שנקבעו בעבודה מוצעים בטלפון, ונכנסים למילון רק בלחיצה.
// הבדיקות המלאות של העובד: translator/tests/test_worker.py (test_glossary).
// הרצה: node tests/studio-v380.test.js
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { swVersionOk } = require('./_swver');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

(async () => {
  const net = await import(path.join(root, 'studionet.js'));
  const S = require(path.join(root, 'ibkr-proxy/lib/studio.js'));

  /* ---------- 1. פורמט אחד בשלושת המקומות ---------- */
  const SAMPLES = ['  Moat  ', '<b>Float</b>', 'see http://evil.example', 'a`b\tc\nd', 'x'.repeat(200), 'Free\u0007cash', '', null];
  for (const s of SAMPLES) ok(net.glClean(s, 60) === S.glClean(s, 60), 'glClean זהה בטלפון ובשרתון: ' + JSON.stringify(s).slice(0, 30));
  const py = execFileSync('python3', ['-c', [
    'import sys, json; sys.path.insert(0, "translator"); import job',
    'xs = json.loads(sys.stdin.read())',
    'print(json.dumps({"c": [job.gl_clean(x, 60) for x in xs["c"]], "p": [list(r) for r in job.gl_parse(xs["t"])]}, ensure_ascii=False))'].join('\n')],
  { cwd: root, input: JSON.stringify({ c: SAMPLES.map((s) => (s == null ? '' : s)), t: 'Moat\tחפיר\t<b>באפט</b>\n# הערה\nmoat\tכפול\nbad\nhttp://a\tb\nZ\tזד\n' }) }).toString();
  const pj = JSON.parse(py);
  ok(JSON.stringify(pj.c) === JSON.stringify(SAMPLES.map((s) => net.glClean(s, 60))), 'gl_clean בעובד = glClean בטלפון');
  ok(JSON.stringify(pj.p) === JSON.stringify(net.glParse('Moat\tחפיר\t<b>באפט</b>\n# הערה\nmoat\tכפול\nbad\nhttp://a\tb\nZ\tזד\n')), 'gl_parse בעובד = glParse בטלפון (כפולים, הערות, קישורים)');
  const rows = net.glParse('Moat\tחפיר\n');
  ok(rows.length === 1 && rows[0][2] === '', 'glParse: שורה בלי הערה');
  const up = net.glUpsert(rows, [['MOAT', 'חפיר כלכלי'], ['Float', 'צף', 'ביטוח'], ['', 'x']]);
  ok(up.length === 2 && up[0][0] === 'MOAT' && up[0][1] === 'חפיר כלכלי' && up[1][2] === 'ביטוח' && rows[0][1] === 'חפיר', 'glUpsert: אותו מונח מתעדכן (בלי תלות באותיות גדולות), ריק נזרק, המקור לא משתנה');
  const big = Array.from({ length: net.GL_MAX }, (_, i) => ['t' + i, 'מ' + i, '']);
  ok(net.glUpsert(big, [['new', 'חדש']]).length === net.GL_MAX, 'glUpsert: לא מעבר ל־GL_MAX');
  const f = net.glFormat(up);
  ok(f.startsWith('#') && f.includes('MOAT\tחפיר כלכלי\n') && f.includes('Float\tצף\tביטוח\n') && JSON.stringify(net.glParse(f)) === JSON.stringify(up), 'glFormat → glParse מחזיר את אותן שורות');

  /* ---------- 2. השרתון ---------- */
  ok(JSON.stringify(S.normGl({ u: 3, s: [['Moat', 'חפיר'], ['moat', 'x'], ['<b>a</b>', 'http://x'], ['Free cash flow', 'תזרים']] })) === JSON.stringify({ u: 3, s: [['Moat', 'חפיר'], ['Free cash flow', 'תזרים']] }),
    'normGl: כפולים וקישורים נזרקים, תגיות מנוקות');
  ok(S.normGl({ u: -1, s: 'x' }) === null && S.normGl(null) === null && S.normGl({ u: 2.5, s: [] }) === null, 'normGl: לא תקין — כלום');
  ok(S.normGl({ u: 0, s: Array.from({ length: 50 }, (_, i) => ['t' + i, 'מ']) }).s.length === 30, 'normGl: עד 30 הצעות');
  const api = read('ibkr-proxy/api/studio.js'), lib = read('ibkr-proxy/lib/studio.js');
  ok(/S\.normGl\(body\.gl\)/.test(api) && /'gl'(, '[a-z]+')*\]/.test(lib) && /gl: normGl\(job\.gl\)/.test(lib), 'השרתון: נשמר מהדיווח (JSON) ומוחזר בעבודה');

  /* ---------- 3. העובד ---------- */
  const job = read('translator/job.py');
  ok((job.match(/vt\(ctx, \['tr-prep', ctx\.name\]\)\n    gl_merge\(ctx\)/g) || []).length === 2, 'job.py: המילון נכנס אחרי tr-prep — גם ב־align וגם ב־align_prep (מצב API)');
  ok(/gl = gl_suggest\(ctx\)/.test(job) && /judge=ctx\.st\.get\('jd'\), gl=gl\)/.test(job), 'job.py: ההצעות נשלחות בסוף העבודה');
  ok(/def gl_load\(ctx\)[\s\S]*?except Exception:[\s\S]*?return None/.test(job), 'job.py: מילון שלא נטען לא מפיל עבודה');
  ok(/GL_MARK = '# — מהמילון שלך/.test(job) && /מהמילון שלך/.test(read('translator/RUNBOOK.md')) && /מהמילון שלך/.test(read('translator/TRANSLATE.md')),
    'RUNBOOK ו־TRANSLATE: השורות של המשתמש גוברות ולא משתנות');

  /* ---------- 4. הטלפון ---------- */
  const st = await import(path.join(root, 'studio.js'));
  ok(JSON.stringify(st.normGl({ u: 2, s: [['Moat', 'חפיר'], ['MOAT', 'x'], ['<i>', '']] })) === JSON.stringify({ u: 2, s: [['Moat', 'חפיר']] }) && st.normGl({}) === null, 'normGl בטלפון');
  ok(JSON.stringify(st.chainFor('gloss').map((x) => x.v)) === JSON.stringify(['home', 'settings', 'tower', 'rules', 'gloss']), 'חזור: מילון ← החוקים שלך ← המגדל');
  const sj = read('studio.js');
  ok(/gl: normGl\(s\.gl\)/.test(sj), 'העבודה בטלפון שומרת את ההצעות');
  ok(/function pageGloss\(p\)/.test(sj) && /else if \(ui\.view === 'gloss'\) pageGloss\(p\)/.test(sj) && /go\('gloss'\)/.test(sj), 'דף המילון — מהחוקים שלך (כל מה שקובעים לסוכנים במקום אחד)');
  ok(/function glossJobCard\(g\)/.test(sj) && /glossJobCard\(rec\.srv\.gl\)/.test(sj), 'דף העבודה: מונחים חדשים — להוספה במילון');
  ok(/glossWrite\(glUpsert\(gl\.rows, \[\[x\[0\], x\[1\], ''\]\]\)/.test(sj), 'הצעה נכנסת למילון רק בלחיצה (+ / להוסיף הכל)');
  ok(!/innerHTML/.test(sj.slice(sj.indexOf('/* ---- v380'), sj.indexOf('function qualityCard('))), 'הטקסט מהמילון ומההצעות — רק כטקסט');
  const nets = read('studionet.js');
  ok(/async function glossLoad\(\)/.test(nets) && /async function glossSave\(id, rows\)/.test(nets) && /appProperties: \{ snbGloss: '1' \}/.test(nets), 'studionet: קריאה ושמירה ב־Drive (קובץ אחד, בתיקיית הסטודיו)');
  const strs = read('app.js');
  for (const k of (sj.match(/T\('studioGl[A-Za-z]+'/g) || []).map((x) => x.slice(3, -1))) {
    ok((strs.match(new RegExp('\\b' + k + ': "', 'g')) || []).length === 2, 'מחרוזת בעברית ובאנגלית: ' + k);
  }

  /* ---------- 5. גרסה ---------- */
  const ver = (strs.match(/APP_VERSION = '(v\d+)'/) || [])[1] || '';
  ok(+ver.slice(1) >= 380 && swVersionOk(ver), 'APP_VERSION ≥ v380 ו־sw.js תואם (או גרסה אחת אחורה)');
  console.log('\n' + n + ' passed');
})().catch((e) => { console.error(e); process.exit(1); });
