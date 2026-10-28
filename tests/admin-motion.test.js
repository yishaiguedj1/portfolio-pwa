// 28/10/2026 (בקשת המשתמש: "נכנסים לעמוד והכל סטטי, בלי טעינות וקפיצות") — מרכז הניהול:
// תת־עמוד נכנס מלא (מחכים לנתונים שלו עד 450ms), לשונית מתחלפת מיד (נטענה מראש), שורת משנה שמגיעה אחר כך — המקום שמור.
// בדפדפן: node tools/qa-deep.js --only adm --cpu 4 --rounds 2
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const src = fs.readFileSync(path.join(__dirname, '..', 'admin-app.js'), 'utf8');
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; console.log('ok - ' + m); };

const go = src.split('async function go(')[1].split('\n}\n')[0];
ok(/pending\(k\)/.test(go) && /Promise\.race\(\[Promise\.allSettled\(ps\), new Promise\(\(r\) => setTimeout\(r, 450\)\)\]\)/.test(go), 'go: מחכה לנתוני המסך החדש עד 450ms לפני הציור');
ok(/if \(tk !== goTok\) return;/.test(go) && go.indexOf('goTok') < go.indexOf('cur = k;'), 'go: לחיצה חדשה בזמן ההמתנה מבטלת את הישנה');
const pend = src.split('function pending(k)')[1].split('\n}\n')[0];
ok(/cur = k; track = \[\]/.test(pend) && /track = null; cur = was;/.test(pend), 'pending: טיוטה מנותקת, cur חוזר, האיסוף נסגר');
ok(/function api\(op, body\) \{ const p = api0\(op, body\); if \(track\) track\.push\(p\); return p; \}/.test(src), 'api: בקשות של הטיוטה נאספות');
ok(/go\(k, true, true\)\);   \/\/ לשונית מתחלפת מיד/.test(src), 'לשונית — בלי המתנה');
ok(/TABS\.forEach\(\(\[k\]\) => \{ if \(k !== cur && PAGES\[k\]\) pending\(k\); \}\)/.test(src.split('async function boot()')[1].split('\n}\n')[0]), 'boot: שאר הלשוניות נטענות מראש, פעם אחת');
ok(/else if \(o\.s === ''\) tx\.append\(h\('small', null, '\\u00a0'\)\)/.test(src), 'row: שורת משנה ריקה שומרת מקום');
ok(/await Promise\.race\(\[labP, new Promise\(\(r\) => setTimeout\(r, 400\)\)\]\)/.test(src), 'boot: אריחי המאגר — עד 400ms לפני הציור הראשון');
console.log('\n' + n + ' בדיקות עברו');
