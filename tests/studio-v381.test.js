// v381: סטודיו התרגום — הערה לעובד (בהשראת "corrective input" של ServiceNow): טקסט שלך מהטלפון לעבודת תרגום שרצה.
// השרתון שומר אותה (nt) ומוסר בתשובה לדיווח הבא על נקודת שמירה → היסטוריה (nh, עם מתי נקראה). העובד מדפיס אותה ל־Claude
// ומכניס לתדריך של המתרגם (tr/brief.md, סעיף שנבנה מחדש). עד 5 לעבודה; הערה שעוד לא נקראה מתחלפת.
// הבדיקות המלאות: ibkr-proxy/tests/run.js (בלוק v381), translator/tests/test_worker.py (test_note).
// הרצה: node tests/studio-v381.test.js
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { swVersionOk } = require('./_swver');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

(async () => {
  const S = require(path.join(root, 'ibkr-proxy/lib/studio.js'));
  const st = await import(path.join(root, 'studio.js'));

  /* ---------- 1. ניקוי זהה בשרתון, בעובד ובטלפון ---------- */
  const SAMPLES = ['  שמות  פרטיים ', '<b>x</b>', 'a`b\tc\n\n  d', 'א', 'ב'.repeat(400), 'קו\u0007נטרול', ''];
  const py = JSON.parse(execFileSync('python3', ['-c', [
    'import sys, json; sys.path.insert(0, "translator"); import job',
    'print(json.dumps([job.note_clean(x) for x in json.loads(sys.stdin.read())], ensure_ascii=False))'].join('\n')],
  { cwd: root, input: JSON.stringify(SAMPLES) }).toString());
  ok(JSON.stringify(py) === JSON.stringify(SAMPLES.map(S.normNoteText)), 'note_clean בעובד = normNoteText בשרתון');
  for (const s of SAMPLES) {
    const v = st.normNote({ p: { t: s, at: 1 } });
    ok((v ? v.p.t : '') === S.normNoteText(s), 'ניקוי זהה בטלפון: ' + JSON.stringify(s).slice(0, 20));
  }
  ok(S.NOTE_MAX === 5 && /^NOTE_MAX, NOTE_LEN = 5, 300$/m.test(read('translator/job.py')) && /const NOTE_LEN = 300;/.test(read('studio.js')), 'אותה מגבלה בשלושת המקומות');

  /* ---------- 2. השרתון ---------- */
  const lib = read('ibkr-proxy/lib/studio.js'), api = read('ibkr-proxy/api/studio.js');
  ok(/'nt', 'nh'(, '[a-z]+')*\]/.test(lib) && /nt: noteView\(job\)/.test(lib) && /notes: \(Array\.isArray\(job\.nh\)/.test(lib), 'השרתון: נשמר, מוצג לטלפון, ולעובד — רק מה שנקרא');
  ok(/if \(op === 'note'\)/.test(api) && /error: 'note_limit'/.test(api) && /up\.nt = null;/.test(api) && /note \? \{ note \} : \{\}/.test(api), 'השרתון: פעולת note, מגבלה, ומסירה בנקודת השמירה');
  const nv = S.noteView({ nt: { t: 'חדש', at: 5 }, nh: [{ t: 'ישן', at: 1, d: 2 }], nn: 2 });
  ok(nv.p.t === 'חדש' && nv.h[0].d === 2 && nv.n === 2 && nv.max === 5, 'noteView: ממתינה + היסטוריה');

  /* ---------- 3. העובד ---------- */
  const job = read('translator/job.py');
  ok(/'notes': notes_valid\(job\.get\('notes'\)\)/.test(job) && /if isinstance\(r, dict\) and r\.get\('note'\):\n\s+note_receive\(ctx, r\['note'\]\)/.test(job), 'job.py: ההערות מהלקיחה, והחדשה מתשובת נקודת השמירה');
  ok((job.match(/gl_merge\(ctx\)[^\n]*\n    apply_notes\(ctx\)/g) || []).length === 2 && /apply_notes\(ctx\)[^\n]*\n    ctx\.refresh\(\)/.test(job), 'job.py: לתדריך — ב־align, ב־align_prep ובהמשך מנקודת שמירה');
  ok(/הערה מהמשתמש באמצע העבודה/.test(read('translator/RUNBOOK.md')), 'RUNBOOK: מה עושים עם הערה שהגיעה');

  /* ---------- 4. הטלפון ---------- */
  ok(st.normNote(null) === null && st.normNote({ h: [] }) === null, 'normNote: בלי הערות — כלום');
  const tn = st.normNote({ p: null, h: Array.from({ length: 8 }, (_, i) => ({ t: 'הערה ' + i, at: i, d: i })), n: 99, max: 5 });
  ok(tn.h.length === 5 && tn.n === 5 && tn.h[0].t === 'הערה 3', 'normNote: עד 5, המונה לא מעבר למקסימום');
  const sj = read('studio.js');
  ok(/nt: normNote\(s\.nt\)/.test(sj) && /net\.api\('note', \{ job: id, t \}\)/.test(sj), 'הטלפון: שומר ושולח דרך השרתון');
  const seg = sj.slice(sj.indexOf('function noteCard('), sj.indexOf('function noteCard(') + 4000);
  ok(!/innerHTML/.test(seg) && /tx\.dir = 'auto'/.test(seg), 'הטקסט שלך מוצג רק כטקסט, בכיוון שלו');
  ok(/const nc = noteCard\(rec\);/.test(sj) && /rec\.srv\.nt \? 'n' \+ rec\.srv\.nt\.h\.length/.test(sj), 'דף העבודה: הכרטיס, ומתעדכן כשהערה נקראת');
  ok(/\.st-ntr \{/.test(read('studio.css')) && /\.st-ntr\.wait/.test(read('studio.css')), 'עיצוב: שורת הערה וממתינה');
  const app = read('app.js');
  for (const k of (sj.match(/T\('studioNt[A-Za-z]+'/g) || []).map((x) => x.slice(3, -1)).filter((x, i, a) => a.indexOf(x) === i))
    ok((app.match(new RegExp('\\b' + k + ': "', 'g')) || []).length === 2, 'מחרוזת בעברית ובאנגלית: ' + k);

  /* ---------- 5. גרסה ---------- */
  const ver = (app.match(/APP_VERSION = '(v\d+)'/) || [])[1] || '';
  ok(+ver.slice(1) >= 381 && swVersionOk(ver), 'APP_VERSION ≥ v381 ו־sw.js תואם (או גרסה אחת אחורה)');
  console.log('\n' + n + ' passed');
})().catch((e) => { console.error(e); process.exit(1); });
