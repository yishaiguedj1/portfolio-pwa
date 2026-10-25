// 25/10/2026: עבודה חיכתה כ־10 דק׳ "בתור לשרת" אחרי worker-image — חלון העדכון (השרתון לא נותן עבודה חדשה לעובד
// בגרסה הישנה) נמשך עד הבדיקה הבאה של snb-update, שרצה כל רבע שעה. עכשיו: כל 2 דקות, והדף אומר "השרת מתעדכן"
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
let n = 0;
const ok = (c, m) => { if (!c) { console.error('✗ ' + m); process.exit(1); } n++; console.log('✓ ' + m); };

const timer = fs.readFileSync(path.join(root, 'infra/host/snb-update.timer'), 'utf8');
ok(/^OnUnitActiveSec=2min$/m.test(timer) && !/15min/.test(timer), 'הטיימר: כל 2 דקות (שרת חדש)');
const upd = fs.readFileSync(path.join(root, 'infra/host/snb-update'), 'utf8');
ok(/snb-update\.timer\.d/.test(upd) && /OnUnitActiveSec=\\nOnUnitActiveSec=2min/.test(upd) && /systemctl daemon-reload/.test(upd),
  'שרת קיים: snb-update כותב קובץ השלמה לטיימר (איפוס ואז 2 דקות) וטוען מחדש');
const apply = fs.readFileSync(path.join(root, 'infra/worker/snb-host-apply'), 'utf8');
ok(/snb-update:usr\/local\/sbin\/snb-update:755/.test(apply), 'snb-update מגיע לשרת קיים דרך snb-host-apply');
ok(upd.indexOf('snb-update.timer.d') < upd.indexOf('umask 022'), 'הטיימר מתעדכן לפני המשיכות (גם כשמשיכה נכשלת)');

const A = require(path.join(root, 'ibkr-proxy/api/studio.js'));
const now = 2e12;
const job = (o) => Object.assign({ kind: 'tr', state: 'queued', sid: '', spec: { eng: 'api' } }, o);
ok(A._updWaiting(job({}), now, now - 30e3) === true, 'שרת קיבל "חלון עדכון" לפני חצי דקה — עבודה בתור מסומנת');
ok(A._updWaiting(job({}), now, now - 120e3) === false, 'לפני 2 דקות — כבר לא (העדכון כנראה הסתיים)');
ok(A._updWaiting(job({ sid: 'abc' }), now, now) === false && A._updWaiting(job({ state: 'running' }), now, now) === false, 'עבודה שנלקחה / רצה — לא');
ok(A._updWaiting(job({ vw: 1 }), now, now) === false, 'מחכה לסרטון — ההודעה שלה, לא של העדכון');
ok(A._updWaiting(job({ spec: { eng: 'sub' } }), now, now) === false, 'Routine — לא תלוי בשרת');
const api = fs.readFileSync(path.join(root, 'ibkr-proxy/api/studio.js'), 'utf8');
ok(/updWaitAt = now;[^\n]*\n\s*await patchDoc\(deps, 'studioServers', p\.sid, seen\);\n\s*return res\.status\(200\)\.json\(\{ ok: true, job: null, upd: true/.test(api), 'הסימון נכתב בענף "חלון העדכון" של poll');
ok(/const view = \(j\) => Object\.assign\(S\.publicJob\(j, now\), updWaiting\(j, now\) \? \{ uw: 1 \} : \{\}\)/.test(api), 'job / jobs מחזירים uw');

const st = fs.readFileSync(path.join(root, 'studio.js'), 'utf8');
ok(/uw: s\.uw === 1,/.test(st), 'הטלפון: normJob שומר uw');
ok(/rec\.srv && rec\.srv\.uw \? T\('studioNowSrvUpd'\)/.test(st), 'הטלפון: "השרת מתעדכן" במקום "בתור לשרת"');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
ok((app.match(/studioNowSrvUpd: "/g) || []).length === 2, 'המחרוזת בעברית ובאנגלית');
console.log('\nכל ' + n + ' הבדיקות עברו ✓');
