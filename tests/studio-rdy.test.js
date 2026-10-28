// 28/10/2026 (בקשת המשתמש: "שומרים ושולחים אליך" לקח ~5 דק׳ אחרי שההעלאה נגמרה ב־13 שנ׳): העובד מדווח rd כשהתוצרים עלו,
// ובטלפון העבודה "הסתיימה" מיד — איכויות הצפייה והלמידה נגמרות ברקע (state נשאר running בשרתון, והעובד ממשיך).
// הרצה: node tests/studio-rdy.test.js
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const S = require(path.join(root, 'ibkr-proxy/lib/studio.js'));
const SLA = require(path.join(root, 'ibkr-proxy/lib/studiosla.js'));

const t0 = 1e12;
let job = { id: 'j1', kind: 'tr', state: 'running', c0: t0, claimed: t0, tg: { t: 1740 }, prog: null };
let r = S.applyReport(job, { st: 'sv', p: 1, msg: 'התוצרים מוכנים — משלימים ברקע', rd: true }, t0 + 1000e3);
ok(r.rdy === t0 + 1000e3 && r.ended === r.rdy && !r.state && r.prog.p === 1, 'rd: נרשם rdy + ended, והמצב עדיין running (העובד ממשיך)');
job = Object.assign({}, job, r, { prog: r.prog });
ok(S.publicJob(job, t0 + 1100e3).state === 'done' && S.publicJob(job, t0 + 1100e3).bg === 1, 'publicJob: בטלפון done עם bg=1 בזמן שהעובד משלים');
ok(S.publicJob(Object.assign({}, job, { rdy: 0 }), t0 + 1100e3).state === 'running' && S.publicJob(Object.assign({}, job, { rdy: 0 }), 1).bg === 0, 'publicJob: בלי rdy — running כמו קודם');

// דיווחים בזמן ההשלמה: רק ההודעה, השלב והאחוז לא זזים (לא "פותחים" את שלב sv מחדש)
const stg = JSON.stringify(job.prog.stg);
const m = S.applyReport(job, { st: 'sv', msg: 'מכינים איכויות צפייה' }, t0 + 1200e3);
ok(m.prog.msg === 'מכינים איכויות צפייה' && m.prog.p === 1 && JSON.stringify(m.prog.stg) === stg && !m.rdy && !m.ended && !m.state, 'אחרי rd: דיווח רגיל משנה הודעה בלבד');
const again = S.applyReport(job, { st: 'sv', p: 1, rd: true }, t0 + 1300e3);
ok(!again.rdy && !again.ended, 'rd כפול לא מזיז את זמן הסיום');

// הדיווח הסופי: done — אבל ended נשאר של rd (השעון, הצפי והלמידה לפי מה שהמשתמש חווה)
const fin = S.applyReport(job, { done: true }, t0 + 1500e3);
ok(fin.state === 'done' && fin.ended === undefined, 'done אחרי rd: state=done ו־ended לא נדרס');
ok(S.applyReport({ prog: null }, { done: true }, 777).ended === 777, 'done בלי rd — ended כרגיל');

// SLA: השעון עוצר ב־rd
const a = SLA.slaView(job, t0 + 1100e3), b = SLA.slaView(job, t0 + 5000e3);
ok(a.t.el === b.t.el && a.t.el === 1000 && a.t.lv !== 'over', 'SLA: הזמן קפוא ב־rdy (לא ממשיך לרוץ בזמן ההשלמות)');

// קוד: התראת "מוכן" פעם אחת, תוצרים לא נדרסים, ווילון ההתראות שקט
const api = fs.readFileSync(path.join(root, 'ibkr-proxy/api/studio.js'), 'utf8');
ok(/const kind = \(up\.state === 'done' && !job\.rdy\) \|\| up\.rdy \? 'done'/.test(api), 'התראת done: ב־rd, ולא שוב בדיווח הסופי');
ok(/if \(!job\.rdy\) up\.fo = outs/.test(api), 'הדיווח הסופי לא דורס תוצרים (עריכת כתוביות בזמן ההשלמה)');
ok(/!parked && !job\.rdy\)/.test(api) && /job\.state !== 'running' \|\| job\.rdy\) continue/.test(api), 'ווילון ההתראות: אין התקדמות אחרי rd');

// עובד וטלפון
const jb = fs.readFileSync(path.join(root, 'translator/job.py'), 'utf8');
ok(/ctx\.report\('sv', 1, 'התוצרים מוכנים — משלימים ברקע', out=out, force=True, rd=True\)/.test(jb), 'העובד: rd רק בדיווח שאחרי העלאת התוצרים');
const st = fs.readFileSync(path.join(root, 'studio.js'), 'utf8');
ok(/bg: s\.bg === 1 \? 1 : 0/.test(st) && /r\.srv\.bg\) \|\| phBurnLive/.test(st) && /r\.srv\.state === 'running' \|\| r\.srv\.bg\)/.test(st), 'טלפון: bg נשמר ומרענן (איכויות הצפייה מגיעות אחרי "הסתיימה")');
console.log('PASS ' + n);
