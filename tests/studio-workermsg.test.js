// הסיבה המדויקת לכישלון בטלפון (10/10/2026): העבודה הראשונה בשרת נכשלה ב"נגמר הזיכרון", ההודעה
// נשמרה בשרתון (prog.msg) — והטלפון הציג רק את ההוראה הכללית של קוד השגיאה. עכשיו: שורה בפרטים הטכניים.
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const src = fs.readFileSync(path.join(__dirname, '..', 'studio.js'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; console.log('ok - ' + m); };

const fn = src.slice(src.indexOf('function workerMsg('), src.indexOf('function kvRow('));
ok(fn.length > 0, 'workerMsg/workerMsgRow קיימות');
ok(/ph === 'failed' \|\| ph === 'stuck' \|\| ph === 'cancelled'/.test(fn), 'רק בעבודה שנעצרה — לא בעבודה רצה (שם prog.msg כבר בשורת "מה קורה עכשיו")');
ok(/textContent = m/.test(fn) && !/innerHTML/.test(fn), 'הטקסט מהעובד = טקסט בלבד, לא HTML');
ok(/dir = 'auto'/.test(fn), 'כיוון לפי התוכן (עברית / פלט לטיני של vt)');
ok(/slice\(0, 240\)/.test(fn), 'אורך חסום — כמו clean(r.msg, 240) בשרתון');
ok(/workerMsgRow\(rec, ph0\)/.test(src), 'השורה בפרטים הטכניים של דף העבודה');

// ההיגיון עצמו — מריצים את הפונקציה הטהורה
const workerMsg = new Function(fn.slice(0, fn.indexOf('function workerMsgRow(')) + '; return workerMsg;')();
const rec = (msg) => ({ srv: { prog: { msg } } });
ok(workerMsg(rec('✗ vt align נכשל (קוד -9 — נגמר הזיכרון).'), 'failed') === '✗ vt align נכשל (קוד -9 — נגמר הזיכרון).', 'עבודה שנכשלה — ההודעה מוצגת');
ok(workerMsg(rec('מתרגם חלק 2'), 'running') === '', 'עבודה רצה — בלי השורה');
ok(workerMsg(rec('   '), 'failed') === '', 'הודעה ריקה — בלי שורה');
ok(workerMsg({ srv: null }, 'failed') === '', 'בלי מידע מהשרתון — בלי שורה');
ok(workerMsg(rec('x'.repeat(500)), 'stuck').length === 240, 'הודעה ארוכה נחתכת');

for (const lang of ['studioWorkerMsgL: "מה העובד דיווח"', 'studioWorkerMsgL: "Worker\'s last message"']) {
  ok(app.includes(lang), 'מחרוזת בשתי השפות: ' + lang.split(': ')[1]);
}
console.log('# ' + n + ' בדיקות עברו');
