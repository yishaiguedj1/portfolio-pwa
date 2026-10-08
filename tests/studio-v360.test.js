// v360: סטודיו התרגום, שלב 3 סבב ד׳ — שאלות קצרות באמצע העבודה (העובד שואל, הטלפון עונה, ברירת מחדל כשלא עונים).
// הבדיקות המלאות: השרתון ב־ibkr-proxy/tests/run.js, העובד ב־translator/tests/test_worker.py (test_ask_*).
// הרצה: node tests/studio-v360.test.js
const fs = require('fs');
const path = require('path');
const { swVersionOk } = require('./_swver');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

(async () => {
  /* ---------- 1. השרתון ---------- */
  const S = require(path.join(root, 'ibkr-proxy/lib/studio.js'));
  const qa = S.normAsk({ id: 'q1', q: 'איך כותבים?', o: ['א', '', 'ב', 'ג', 'ד', 'ה'], d: 9, w: 5 });
  ok(qa && qa.o.length === 4 && qa.d === 0 && qa.w === 60, 'השרתון: normAsk — עד 4 תשובות, ברירת מחדל תקינה, המתנה 1–30 דק׳');
  ok(S.normAsk({ id: 'Q1', q: 'x' }) === null && S.normAsk({ id: 'q1', q: '   ' }) === null, 'השרתון: מזהה/שאלה לא תקינים — נדחים');
  const full = Object.assign({}, qa, { a: null });
  ok(S.normAnswer(full, { qid: 'q1', i: 2 }).t === 'ג' && S.normAnswer(full, { qid: 'q1', t: 'חופשי' }) === null
    && S.normAnswer(Object.assign({}, full, { a: { i: 0 } }), { qid: 'q1', i: 0 }) === null, 'השרתון: normAnswer — רק תשובה מוכנה כשיש, פעם אחת');
  const api = read('ibkr-proxy/api/studio.js');
  ok(/op === 'answer'/.test(api) && /ask_limit/.test(api) && /409\)\.json\(\{ ok: false, error: 'ask_limit' \}\)/.test(api) && /askTimeout/.test(api), 'השרתון: answer מהטלפון, תקרת שאלות (409 — לא 429), "לא ענית בזמן"');
  const wq = S.workerJob({ id: 'j', kind: 'tr', qa: { id: 'q1', q: 'שאלה', o: ['א'], a: { t: 'x' } } }).qa;
  ok(wq.a.t === 'x' && wq.o === undefined && wq.q === 'שאלה', 'השרתון: העובד מקבל את התשובה והשאלה (v361 — להמשך בסשן חדש), בלי רשימת התשובות');

  /* ---------- 2. הטלפון ---------- */
  const M = await import(path.join(root, 'studio.js'));
  const q = M.normQa({ id: 'q2', q: 'מה המגדר?', o: ['גבר', 7, 'אישה'], d: 1, w: 300, at: 5, a: null });
  ok(q && q.o.join() === 'גבר,אישה' && q.d === 1 && q.w === 300 && q.a === null, 'טלפון: normQa');
  ok(M.normQa({ id: 'bad', q: 'x' }) === null && M.normQa({ id: 'q1' }) === null, 'טלפון: שאלה לא תקינה — לא מוצגת');
  const rec = (state, a) => ({ srv: { state, qa: M.normQa({ id: 'q2', q: 'x', a }) } });
  ok(M.qaPending(rec('running', null)) && !M.qaPending(rec('running', { t: 'כן' })) && !M.qaPending(rec('done', null)), 'טלפון: qaPending — רק שאלה בלי תשובה בעבודה שרצה');
  ok(M.normJob({ id: 'jAbCdEfGhIjKlMnOpQrSt', spec: {}, srv: { state: 'running', qa: { id: 'q3', q: 'x', o: ['כן'] } } }).srv.qa.id === 'q3', 'טלפון: normJob שומר את השאלה');
  const st = read('studio.js');
  ok(/function askCard\(rec\)/.test(st) && /net\.api\('answer'/.test(st) && /const ask = askCard\(rec\)/.test(st), 'טלפון: כרטיס "Claude שואל" בדף העבודה ושליחת התשובה');
  ok(/qaPending\(rec\) \? \['amber', T\('studioBAsk'\)\]/.test(st) && /if \(!quiet && !qaPending\(rec\)( && [^)]+)?\) p\.append\(nowc\)/.test(st), 'טלפון: תג "שאלה" ברשימה; בשאלה פתוחה — בלי כרטיס "מה קורה עכשיו" כפול');
  ok(!/innerHTML\s*=\s*[^;]*qa\./.test(st) && /h\('p', 'st-ask-q', qa\.q\)/.test(st), 'טלפון: השאלה (טקסט מ־Claude) מוצגת כטקסט, לא כ־HTML');
  ok(/rec\.srv\.qa\.id \+ \(rec\.srv\.qa\.a \? 'a' : ''\)/.test(st), 'טלפון: הדף מצויר מחדש כשמגיעה שאלה או תשובה');
  const app = read('app.js');
  ok(/studioAskT: "Claude שואל"/.test(app) && /studioAskT: "Claude asks"/.test(app), 'טלפון: מחרוזות בעברית ובאנגלית');

  /* ---------- 3. העובד ---------- */
  const job = read('translator/job.py');
  ok(/sub\.add_parser\('ask'/.test(job) && /'ask': ask/.test(job) && /askTimeout=qid/.test(job), 'העובד: job.py ask — שולח, מחכה, וברירת מחדל בסוף הזמן');
  const rb = read('translator/RUNBOOK.md');
  ok(/\$J ask --q/.test(rb) && /לכל היותר 2 שאלות לעבודה/.test(rb) && /בחזית, לא ברקע/.test(rb), 'RUNBOOK: מתי שואלים, כמה, ואיך מחכים');

  /* ---------- 4. גרסה ---------- */
  const ver = (app.match(/const APP_VERSION = '(v\d+)'/) || [])[1];
  ok(+String(ver).slice(1) >= 360, 'APP_VERSION ≥ v360');
  ok(swVersionOk(ver), 'sw.js תואם (שווה או גרסה אחת אחורה בשלב התוכן)');
  console.log('# ' + n + ' בדיקות עברו');
})().catch((e) => { console.error('FAIL -', e && e.stack || e); process.exit(1); });
