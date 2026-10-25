// 25/10/2026 (צילום מהטלפון): אחרי ש־Background Fetch סיים בלי הדף, הכרטיס "הסרטון המלא" נשאר על "עלו 38MB מתוך 90MB ·
// ממשיך כשההעלאה חוזרת" — המצב בטלפון לא ידע שה־service worker כבר רשם את הסרטון בשרתון. adoptSrv לוקח את זה מהשרתון.
'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert');
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'studio.js'), 'utf8');
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };

const i = src.indexOf('function adoptSrv(rec, sj) {');
ok(i > 0, 'adoptSrv קיימת');
const fn = src.slice(i, src.indexOf('\n}\n', i) + 2);
const mk = (runs, dels) => new Function('normJob', 'runs', 'num', 'FID_RE', 'bgStore', 'bgIdOf', fn + '\nreturn adoptSrv;')(
  (j) => ({ srv: { state: j.srv.state } }), runs, (x) => Math.max(0, Math.floor(Number(x) || 0)), /^[A-Za-z0-9_-]{10,80}$/,
  { del: (k) => { dels.push(k); return Promise.resolve(); } }, (id) => 'snbup-' + id);
const FID = 'R2_jAAAAAAAAAAAAAAAAAAAA_abcdefABCDEF';
const rec = () => ({ id: 'jAAAAAAAAAAAAAAAAAAAA', spec: { size: 90e6 }, up: { v: { done: false, id: '', size: 0, uri: '', sent: 38e6, r2: { id: FID, up: 'U', ps: 8 } } } });

{ const runs = new Map([['jAAAAAAAAAAAAAAAAAAAA', { active: false, need: true, phase: 'need' }]]), dels = [], r = rec();
  mk(runs, dels)(r, { state: 'running', files: { v: { id: FID, size: 90e6 } } });
  ok(r.srv.state === 'running', 'srv מתעדכן כמו קודם');
  ok(r.up.v.done && r.up.v.id === FID && r.up.v.sent === 90e6 && r.up.v.size === 90e6, 'הסרטון רשום בשרתון → עלה גם בטלפון (הכרטיס נעלם)');
  ok(!runs.has(r.id), '"בחרו שוב" / "ממשיך כשההעלאה חוזרת" — יורד');
  ok(dels[0] === 'snbup-' + r.id, 'הרשומה של Background Fetch נמחקת'); }
{ const runs = new Map([['jAAAAAAAAAAAAAAAAAAAA', { active: true, phase: 'video' }]]), r = rec();
  mk(runs, [])(r, { state: 'running', files: { v: { id: FID, size: 90e6 } } });
  ok(!r.up.v.done && runs.get(r.id).active, 'העלאה שרצה עכשיו בדף — לא נוגעים (היא נסגרת לבד)'); }
{ const r = rec(); mk(new Map(), [])(r, { state: 'running', files: { v: null } });
  ok(!r.up.v.done && r.up.v.sent === 38e6, 'השרתון עוד לא קיבל את הסרטון — בלי שינוי'); }
{ const r = rec(); mk(new Map(), [])(r, { state: 'running', files: { v: { id: '../x', size: 1 } } });
  ok(!r.up.v.done, 'מזהה לא תקין — לא נקלט'); }

ok(/if \(j\.ok && j\.job && r\) \{ adoptSrv\(r, j\.job\);/.test(src), 'המעקב בדף העבודה עובר דרך adoptSrv');
ok(/if \(loc\) adoptSrv\(loc, sj\);/.test(src), 'הרשימה מהשרתון עוברת דרך adoptSrv');
console.log('studio-bgadopt: ' + n + ' בדיקות עברו');
