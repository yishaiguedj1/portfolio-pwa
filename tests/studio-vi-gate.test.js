// 10/11/2026: הניתוח עם Claude סגור בעובד (SNB_VI_LIVE כבוי = analyze.live_ok) — העובד מדווח hb.vx, והשרתון דוחה ניתוח
// לא יבש כבר ביצירה (vi_off), לפני שהטלפון מעלה את כל הסרטון. בלי שרת שמדווח — לא חוסם (העובד נשאר השער).
// הרצה: node tests/studio-vi-gate.test.js
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const S = require(path.join(root, 'ibkr-proxy/lib/studio.js'));

ok(S.normHb({ vx: 1 }).vx === 1 && S.normHb({}).vx === 0 && S.normHb({ vx: '1' }).vx === 0, 'normHb: vx — רק 1 מספרי');

const srv = (hb, o) => Object.assign({ online: true, paused: false, hb: S.normHb(hb) }, o || {});
ok(S.viClosed([srv({ vi: 1, vx: 1 })]) === true, 'viClosed: העובד היחיד סגור — סגור');
ok(S.viClosed([srv({ vi: 1, vx: 1 }), srv({ vi: 1 })]) === false, 'viClosed: עובד אחד פתוח — לא סגור');
ok(S.viClosed([srv({ vi: 1, vx: 1 }), srv({ vi: 1 }, { online: false })]) === true, 'viClosed: עובד פתוח שלא מחובר — לא נחשב');
ok(S.viClosed([srv({ vi: 1, vx: 1 }), srv({ vi: 1 }, { paused: true })]) === true, 'viClosed: עובד פתוח מושהה — לא נחשב');
ok(S.viClosed([srv({ vi: 1 })]) === false, 'viClosed: עובד בלי vx (פתוח, או ישן) — לא סגור');
ok(S.viClosed([srv({ vx: 1 })]) === false && S.viClosed([]) === false && S.viClosed(null) === false,
  'viClosed: אין עובד שמכיר ניתוח — לא חוסם (העבודה מחכה בתור כמו קודם)');
ok(S.viClosed([{ online: true, paused: false, hb: null }]) === false, 'viClosed: שרת בלי דופק — לא חוסם');

const api = read('ibkr-proxy/api/studio.js');
ok(/VI\.viTooLong\(spec\) \? \[400, 'vi_long'\][\s\S]{0,300}: !spec\.dry && S\.viClosed\(await servers\(\)\.catch\(\(\) => \[\]\)\) \? \[409, 'vi_off'\]/.test(api),
  'create: ניתוח לא יבש כשהעובדים סגורים — vi_off לפני ההעלאה (גם למנהל); הרצה יבשה עוברת');

// התאום מול העובד: vx נשלח בדיוק כש־live_ok כבוי. שינוי ב־live_ok (פתיחת השער / הסרתו) — לעדכן גם את host_info
const ag = read('translator/agent.py'), an = read('translator/analyze.py');
ok(/if os\.environ\.get\('SNB_VI_LIVE'\) != '1':[^\n]*\n\s+hb\['vx'\] = 1/.test(ag), 'agent.py: ‏hb.vx כש־SNB_VI_LIVE כבוי');
ok(/def live_ok\(\)[\s\S]{0,400}return os\.environ\.get\('SNB_VI_LIVE'\) == '1'/.test(an),
  'analyze.live_ok = אותו תנאי — שינוי בשער מחייב לעדכן גם את vx ב־agent.py host_info');

console.log(`---- studio-vi-gate: ${n} בדיקות, הכל תקין`);
