// 23/10/2026: העלאה שנחסמת (CORS / קישור חתום / חיבור שנתקע) — אחרי כמה ניסיונות רצופים בלי התקדמות, הודעה ברורה בכרטיס
'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert');
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'studio.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };

const m = src.match(/export const UP_BLOCK_N[\s\S]*?\nexport function upBlocked[\s\S]*?\n}\n/);
ok(m, 'הפונקציות קיימות');
const S = new Function(m[0].replace(/^export /gm, '') + '\nreturn { UP_BLOCK_N, UP_BLOCK_MS, upBlockStep, upBlocked };')();

// ניסיונות רצופים בלי התקדמות → חסום רק אחרי N ניסיונות וגם אחרי UP_BLOCK_MS
let b = null, t = 1000;
b = S.upBlockStep(b, 500, 'net', t);
ok(b.n === 1 && b.t0 === t, 'ניסיון ראשון');
ok(S.upBlocked(b, 500, t + 10 * 60000) === '', 'ניסיון אחד — לא מספיק גם אחרי זמן');
b = S.upBlockStep(b, 500, 'net', t + 2000);
b = S.upBlockStep(b, 500, 'net', t + 6000);
ok(b.n === S.UP_BLOCK_N, 'נספרו ' + S.UP_BLOCK_N);
ok(S.upBlocked(b, 500, t + 6000) === '', 'עוד לא עבר מספיק זמן');
ok(S.upBlocked(b, 500, t + S.UP_BLOCK_MS) === 'net', 'חסום — net');
ok(S.upBlocked(b, 900, t + S.UP_BLOCK_MS) === '', 'בייטים התקדמו — לא חסום');

// התקדמות בין ניסיונות מאפסת
const b2 = S.upBlockStep(b, 900, 'net', t + 60000);
ok(b2.n === 1 && b2.t0 === t + 60000, 'התקדמות מאפסת את הספירה');

// חיבור שנתקע
let c = null;
for (let i = 0; i < 4; i++) c = S.upBlockStep(c, 0, 'stalled', i * 20000);
ok(S.upBlocked(c, 0, 60000) === 'stall', 'stalled → stall');
ok(S.upBlocked(null, 0, 1e9) === '', 'בלי מצב — לא חסום');

// החיבור בקוד: onWait מעדכן, הכרטיס מציג, מגדל הפיקוח מקבל אירוע פעם אחת
ok(/run\.blk = upBlockStep\(run\.blk, upFp\(\)/.test(src), 'onWait מעדכן את run.blk');
ok(/!run\.blkEv && upBlocked\(/.test(src) && /k: 'stall' \}\]\)/.test(src), 'אירוע phone:stall פעם אחת');
ok(/function nowLine[\s\S]{0,400}upBlocked\(run\.blk/.test(src), 'nowLine מציג את ההודעה');
for (const k of ['studioUpBlockNet', 'studioUpBlockStall']) {
  ok(app.split(k + ': "').length === 3, k + ' בעברית ובאנגלית');
}
console.log('studio-upblock: ' + n + ' בדיקות עברו');
