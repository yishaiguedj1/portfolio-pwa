// 20/10/2026 (בקשת המשתמש): שאלה מ־Claude לא מעכבת את העבודה בשום צורה. העובד ממשיך עם ברירת המחדל,
// ותשובה שהגיעה אחרי שהתרגום התחיל = הצעה בסוף העבודה לתקן את הכתוביות לפיה (גיליון ה־AI, באישור).
// הרצה: node tests/studio-asknb.test.js
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

(async () => {
  global.document = { documentElement: { lang: 'he' } };
  global.t = (k, v) => (v ? k + ':' + JSON.stringify(v) : k);
  const st = await import(path.join(root, 'studio.js'));
  const q = (x) => st.normQa(Object.assign({ id: 'qab1', q: 'מגדר המרואיינת?', o: ['אישה', 'איש'], d: 0, nb: 1, at: 1 }, x));

  ok(q({}).nb === 1 && q({ u: 1 }).u === 1 && q({ u: 9 }).u === undefined && st.normQa({ id: 'qab1', q: 'x', o: [] }).nb === undefined,
    'normQa: nb ו־u (לפי מה התרגום נעשה) — מספר מחוץ לרשימה נזרק, שאלה רגילה בלי nb');
  ok(!st.qaPending({ srv: { state: 'running', qa: q({}) } }) && st.qaPending({ srv: { state: 'running', qa: st.normQa({ id: 'qab1', q: 'x', o: ['a'], d: 0 }) } }),
    'qaPending: שאלה שלא עוצרת לא "מחכה לך" (העבודה ממשיכה)');
  ok(!st.askFixDue(q({})) && !st.askFixDue(q({ u: 0, a: { i: 0, t: 'אישה' } })) && st.askFixDue(q({ u: 0, a: { i: 1, t: 'איש' } })),
    'askFixDue: מציעים תיקון רק כשענית אחרת ממה שהתרגום הניח');
  ok(st.askFixDue(q({ a: { i: 1, t: 'איש' } })) && !st.askFixDue(q({ a: { i: 0, t: 'אישה' } })), 'askFixDue: בלי דיווח (u) — לפי ברירת המחדל');
  ok(!st.askFixDue(q({ u: 1, a: { i: 1, t: 'איש' } })), 'askFixDue: התשובה הגיעה לפני התרגום ונכנסה אליו — אין מה לתקן');
  ok(!st.askFixDue(q({ u: 0, a: { i: 0, t: 'אישה', auto: true } })), 'askFixDue: ברירת מחדל אוטומטית היא לא תשובה');
  const free = (x) => st.normQa(Object.assign({ id: 'qab2', q: 'מי הדובר?', o: [], nb: 1, at: 1 }, x));
  ok(st.askFixDue(free({ u: -1, a: { i: -1, t: 'ריד' } })) && !st.askFixDue(free({ u: -2, a: { i: -1, t: 'ריד' } })),
    'askFixDue: שאלה פתוחה — מציעים אם התרגום נעשה בלי התשובה (‎-1), לא אם היא נכנסה (‎-2)');
  const done = (qa) => ({ srv: { state: 'done', kind: 'tr', qa, out: [] } });
  ok(st.afterAdvice(done(q({ u: 0, a: { i: 1, t: 'איש' } })))[0].k === 'ask' && !st.afterAdvice(done(q({ u: 0, a: { i: 0, t: 'אישה' } }))).length,
    'afterAdvice: "לתקן לפי התשובה שלך" בסוף העבודה — רק כשצריך');
  const note = st.askFixNote(q({ q: 'א'.repeat(400), a: { i: 1, t: 'איש' } }));
  ok(note.length <= 300 && note.includes('איש'), 'askFixNote: ההוראה לגיליון ה־AI — מקוצרת לגבול של הוראה חופשית');

  const sj = read('studio.js');
  ok(/aiPreset = \{ id: rec\.id, free: askFixNote\(rec\.srv\.qa\), run: true \}/.test(sj) && /aiScopeRows\(cues, 'all', -1\)/.test(sj),
    'ההצעה פותחת את גיליון ה־AI עם הבקשה מוכנה על כל הכתוביות — האומדן והאישור כרגיל');
  const pl = read('translator/pipeline.py');
  ok(/def ask_late/.test(pl) && !/self\.J\.ask_user\(/.test(pl) && /pl\.ask_late\(\)\n\s+try:\n\s+pl\.translate\(fix=False/.test(pl),
    'העובד (מצב השרת) לא מחכה לתשובה — רק מציץ רגע לפני התרגום');
  const api = read('ibkr-proxy/api/studio.js');
  ok(/job\.qa\.nb === 1 && job\.kind === 'tr'/.test(api) && /body\.askUsed != null/.test(api), 'השרתון: תשובה אחרי הסוף ודיווח לפי מה התרגום נעשה');
  console.log(`\n${n} בדיקות עברו`);
})().catch((e) => { console.error(e); process.exit(1); });
