/* 24/10/2026: ניסוי המאמץ בסט הזהב — הגהה וביקורת במאמץ בינוני, מול הרצה רגילה של אותו מצב על אותו סרטון.
   השרתון: normXe, goldClone (בלי ry/cp — ההשוואה על השרת של המערכת), לא נלמד ל"רגיל" ולצפי. מרכז הניהול: הבחירה והתווית */
const fs = require('fs');
const path = require('path');
const S = require('../ibkr-proxy/lib/studio.js');
let n = 0, fail = 0;
const ok = (c, m) => { n++; if (c) console.log('ok - ' + m); else { fail++; console.log('FAIL - ' + m); } };
const R = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

ok(JSON.stringify(S.normXe({ main: 'medium', rv: 'low', tl: 'huge', jg: 'low' })) === '{"main":"medium","rv":"low"}', 'normXe — רק תפקידים ומאמצים מוכרים');
ok(S.normXe({ jg: 'low' }) === null && S.normXe('medium') === null && S.normXe([1]) === null && S.normXe(null) === null, 'normXe — ריק / לא תקין = null');

const src = { id: 'jSRC' + '0'.repeat(17), spec: { name: 'a.mp4', size: 9, dur: 600, to: ['he'], mode: 'haiku-high', out: ['compact'], eng: 'api', cap: 3, ry: 1, cp: 1, xe: { tl: 'low' } }, gd: { r: 'refs1234567890', n: 9 }, folder: 'R2_x' };
const c0 = S.goldClone(src, 'jC0' + '0'.repeat(18), 'u', 1, 'sonnet-medium');
ok(c0.spec.ry === undefined && c0.spec.cp === undefined && c0.spec.xe === undefined && c0.spec.eng === 'api', 'goldClone — בלי ה־Routine, בלי העתק־הדבק, בלי ניסוי שלא נבחר');
ok(c0.spec.mode === 'sonnet-medium' && c0.spec.out.includes('srt') && c0.gs === src.id, 'goldClone — המצב שנבחר, עם SRT, מסומנת כהרצה של סט הזהב');
const c1 = S.goldClone(src, 'jC1' + '0'.repeat(18), 'u', 1, 'haiku-high', { main: 'medium', rv: 'medium' });
ok(JSON.stringify(c1.spec.xe) === '{"main":"medium","rv":"medium"}', 'goldClone — הניסוי נשמר בעבודה');
ok(src.spec.ry === 1 && src.spec.xe.tl === 'low', 'goldClone — לא נוגע בעבודת המקור');

const done = { kind: 'tr', fires: 1, spec: { mode: 'haiku-high', dur: 600 }, eng: 'a' }, use = [{ usd: 0.1 }];
ok(S.normSample(done, use, 1) && S.normSample(Object.assign({}, done, { spec: Object.assign({}, done.spec, { xe: { rv: 'medium' } }) }), use, 1) === null, 'הרצה בניסוי לא נלמדת ל"רגיל"');
const api = R('ibkr-proxy/api/studio.js');
ok(/job\.spec && job\.spec\.xe \? null : ETA\.etaSample/.test(api), 'הרצה בניסוי לא נלמדת לצפי הזמנים');
ok(/body\.xe != null && \(!xe \|\| !isAdmin\(user\)\)/.test(api), 'השרתון — ניסוי רק למנהל');

const adm = R('admin-app.js'), app = R('app.js');
const gm = /GOLD_XE = \{ main: 'medium', rv: 'medium' \}, GOLD_MAX = (\d+)/.exec(adm);
ok(gm && +gm[1] === S.GOLD_MAX, 'מרכז הניהול — GOLD_MAX זהה לשרתון');
ok(/D\.gXe \? \{ xe: GOLD_XE, both: true \}/.test(adm) && /t\('admGoldXeTag'\)/.test(adm), 'מרכז הניהול — הבחירה נשלחת, והרצה בניסוי מסומנת בתוצאות');
for (const k of ['admGoldXe', 'admGoldXeS', 'admGoldXeTag']) ok((app.match(new RegExp('\\b' + k + ': "', 'g')) || []).length === 2, 'מחרוזת ' + k + ' בעברית ובאנגלית');

console.log(`${n - fail}/${n}`);
process.exit(fail ? 1 : 0);
