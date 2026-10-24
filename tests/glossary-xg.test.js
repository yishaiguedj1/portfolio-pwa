/* 24/10/2026: מילון המונחים (בקשת המשתמש אחרי עבודת TED — "כמה המילון באמת מועיל, והאם הוא יכול להזיק?"):
   (1) הבדיקה נאכפת רק למונחים ספציפיים (vt/translate.py gl_strict — הבדיקות ב־translator/tests/test_glossary.py),
   (2) הוראה מפורטת למתכנן, (3) ניסוי "בלי מילון" בסט הזהב (spec.xg) — כאן: השרתון ומרכז הניהול */
const fs = require('fs');
const path = require('path');
const S = require('../ibkr-proxy/lib/studio.js');
let n = 0, fail = 0;
const ok = (c, m) => { n++; if (c) console.log('ok - ' + m); else { fail++; console.log('FAIL - ' + m); } };
const R = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

const src = { id: 'jSRC' + '0'.repeat(17), spec: { name: 'a.mp4', size: 9, dur: 600, mode: 'haiku-high', out: ['compact'], eng: 'api', xg: 1 }, gd: { r: 'refs1234567890', n: 9 }, folder: 'R2_x' };
ok(S.goldClone(src, 'jA' + '0'.repeat(19), 'u', 1, 'sonnet-medium').spec.xg === undefined, 'goldClone — בלי ניסוי שלא נבחר (גם לא בירושה מהמקור)');
const c1 = S.goldClone(src, 'jB' + '0'.repeat(19), 'u', 1, 'sonnet-medium', { xe: null, xg: 1 });
ok(c1.spec.xg === 1 && c1.spec.xe === undefined, 'goldClone — בלי מילון בלבד');
const c2 = S.goldClone(src, 'jC' + '0'.repeat(19), 'u', 1, 'haiku-high', { xe: { main: 'medium', rv: 'medium' }, xg: 1 });
ok(c2.spec.xg === 1 && JSON.stringify(c2.spec.xe) === '{"main":"medium","rv":"medium"}', 'goldClone — שני הניסויים יחד, באותו וריאנט');
const c3 = S.goldClone(src, 'jD' + '0'.repeat(19), 'u', 1, 'haiku-high', { main: 'medium' });
ok(JSON.stringify(c3.spec.xe) === '{"main":"medium"}' && c3.spec.xg === undefined, 'goldClone — הצורה הישנה (מאמץ לבד) עדיין עובדת');
const done = { kind: 'tr', fires: 1, spec: { mode: 'haiku-high', dur: 600, xg: 1 }, eng: 'a' };
ok(S.normSample(done, [{ usd: 0.1 }], 1) === null, 'הרצה בלי מילון לא נלמדת ל"רגיל"');

const api = R('ibkr-proxy/api/studio.js'), adm = R('admin-app.js'), app = R('app.js');
ok(/const xg = body\.xg === true;/.test(api) && /if \(xg && !isAdmin\(user\)\) return res\.status\(403\)/.test(api), 'השרתון — בלי מילון רק למנהל');
ok(/const vx = xe \|\| xg \? \{ xe, xg: xg \? 1 : 0 \} : null;/.test(api) && /gsrc\.map\(\(j\) => \[j, null, vx\]\)/.test(api), 'השרתון — הווריאנט עובר לכל המסלולים');
ok(/t\('admGoldXg'\)/.test(adm) && /j\.spec\.xg \? ' · ' \+ t\('admGoldXgTag'\)/.test(adm), 'מרכז הניהול — הבחירה והתווית בתוצאות');
for (const k of ['admGoldXg', 'admGoldXgS', 'admGoldXgTag']) ok((app.match(new RegExp('\\b' + k + ': "', 'g')) || []).length === 2, 'מחרוזת ' + k + ' בעברית ובאנגלית');

const pl = R('translator/pipeline.py'), jb = R('translator/job.py');
ok((pl.match(/gl = write_glossary\(td, sec\.get\('GLOSSARY', ''\), ctx\.st\.get\('spec'\)\)/g) || []).length === 2, 'העובד — שני המסלולים (תמלול / קובץ כתוביות) כותבים את המילון דרך write_glossary');
ok(/\(ctx\.st\.get\('spec'\) or \{\}\)\.get\('xg'\) == 1:/.test(jb), 'העובד — gl_merge מדלג כש־xg (גם המילון שלך והעסקי)');
ok((pl.match(/Sub-Saharan Africa = אפריקה שמדרום לסהרה/g) || []).length === 2 && (pl.match(/מה לא נכנס: מילים כלליות/g) || []).length === 2, 'ההוראה למתכנן — בשני המסלולים');
console.log(`${n - fail}/${n}`);
process.exit(fail ? 1 : 0);
