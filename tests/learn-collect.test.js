// 25/10/2026 — תיקוני האיסוף (מיפוי "מה עוד לא נאסף" של session_01UZAW):
// (1) שיתוף/הורדה נספרים רק אחרי הצלחה; (3) הצפייה נשלחת גם בירידה לרקע / pagehide, ונגני העורכים נמדדים;
// (2) upTel ו־phBurn שומרים את הרשומה במאגר כשהעבודה כבר הסתיימה; (4) המסלול (rt) ו־(6) מה קרה בטלפון (ph) ברשומה.
// הרצה: node tests/learn-collect.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const st = fs.readFileSync(path.join(root, 'studio.js'), 'utf8');
const api = fs.readFileSync(path.join(root, 'ibkr-proxy/api/studio.js'), 'utf8');
const net = fs.readFileSync(path.join(root, 'studionet.js'), 'utf8');

/* ---------- 1. שיתוף והורדה — רק אחרי הצלחה ---------- */
const fn = (name) => { const i = st.indexOf('function ' + name + '('); ok(i > 0, 'נמצאה ' + name); const j = st.indexOf('\n}\n', i); return st.slice(i, j); };
const so = fn('shareOut'), ss = fn('shareSmall'), dl = fn('downloadOut');
ok(!/uxAdd\(rec, 'o', 'sh'\);\s*\/\/ מ׳3\s*\n\s*if \(o\.k === 'small'\)/.test(so), "shareOut לא סופר 'sh' לפני השיתוף");
ok(/await navigator\.share\(\{ files: \[f\], title: name \}\); uxAdd\(rec, 'o', 'sh'\)/.test(so), "shareOut: 'sh' אחרי שהשיתוף הצליח");
ok(/await navigator\.share\(\{ files: \[f\], title: f\.name \}\); uxAdd\(rec, 'o', 'sh'\)/.test(ss), "shareSmall: 'sh' אחרי שהשיתוף הצליח");
ok(/AbortError'\) return;[\s\S]*uxAdd\(rec, 'o', 'dl'\)/.test(so) && /uxAdd\(rec, 'o', 'dl'\);\s*\/\/ בלי שיתוף/.test(ss), 'ביטול — לא נספר; בלי שיתוף (הורדה) — dl');
ok(dl.lastIndexOf("uxAdd(rec, 'o', 'dl')") > dl.indexOf('await net.r2Get') && /uxAdd\(rec, 'o', 'dl'\); window\.open/.test(dl), 'downloadOut: R2 — רק אחרי שהקישור הגיע');

/* ---------- 3. הצפייה ---------- */
const a = st.indexOf('const watchers = new Set();'), b = st.indexOf('/* סבב 1: שורת תוצר');
ok(a > 0 && b > a, 'נמצא קוד המעקב');
const sent = [];
const ctx = { uxAdd: (rec, g, k, v = 1) => sent.push([g, k, v]), Uint8Array, Math, isFinite };
vm.createContext(ctx);
vm.runInContext(st.slice(a, b).replace(/export function/g, 'function') + '\nthis.watchTrack = watchTrack; this.watchFlush = watchFlush; this.watchers = watchers;', ctx);
const ev = {};
const v = { duration: 100, currentTime: 0, paused: false, addEventListener: (k, f) => { ev[k] = f; }, removeEventListener: (k) => { delete ev[k]; } };
const stop = ctx.watchTrack({ id: 'x' }, v);
ev.play();
for (let t = 0; t < 30; t++) { v.currentTime = t; ev.timeupdate(); }
ctx.watchFlush();                                  // ירידה לרקע — מדווח בלי לעצור
const sum = (k) => sent.filter((x) => x[1] === k).reduce((s, x) => s + x[2], 0);
ok(sum('n') === 1 && sum('sec') === 30 && sent.some((x) => x[1] === 'cov' && x[2] === 0.3), 'watchFlush מדווח את מה שנצבר (n פעם אחת, 30 שנ׳, 30%)');
for (let t = 30; t < 50; t++) { v.currentTime = t; ev.timeupdate(); }
ctx.watchFlush();
ok(sum('n') === 1 && sum('sec') === 50, 'דיווח שני — רק ההפרש, n לא נספר שוב');
stop();
ok(sum('sec') === 50 && ctx.watchers.size === 0 && !ev.timeupdate, 'סגירה: בלי כפילות, המעקב משתחרר');
ctx.watchFlush();
ok(sum('sec') === 50, 'אחרי הסגירה — לא מדווח');
ok(/visibilityState === 'visible'[\s\S]{0,200}watchFlush\(\); uxFlush\(\)/.test(st) && /addEventListener\('pagehide', \(\) => \{ watchFlush\(\); uxFlush\(\);( fnlFlush\(\);)? \}\)/.test(st), 'ברקע וב־pagehide — watchFlush ואז uxFlush');
ok(/op === 'learnUx'( \|\| op === 'fnl')? \? \{ keepalive: true \}/.test(net), 'learnUx עם keepalive (לא מבוטל עם הדף)');
for (const [x, stop] of [['se', 'seStop'], ['ce', 'ceStop'], ['sy', 'syStop'], ['ovp', 'ovpStop']]) {
  ok(new RegExp(x + '\\.wt = watchTrack\\(rec, ' + x + '\\.ctl\\.video\\)').test(st), 'נגן ' + x + ' נמדד');
  ok(new RegExp('function ' + stop + '\\(\\) \\{[^\\n]*' + x + '\\.wt\\(\\)').test(st), stop + ' סוגר את המעקב');
}

/* ---------- 2. הרשומה במאגר אחרי הסוף ---------- */
const ut = api.slice(api.indexOf("if (op === 'upTel')"), api.indexOf("if (op === 'cancel')"));
ok(/if \(S\.FINAL\.includes\(st\)\) await learnSave\(deps, Object\.assign\(\{\}, job, \{ utl: tl \}\), now\)/.test(ut), 'upTel: עבודה שהסתיימה — הרשומה נשמרת עם המדידה');
const pb = api.slice(api.indexOf("if (op === 'phBurn')"), api.indexOf("if (op === 'phProg')"));
ok(/if \(pbn\.s !== 'run'\) await learnSave\(deps, Object\.assign\(\{\}, job, \{ pbn \}\), now\)/.test(pb), 'phBurn: בסוף הצריבה (לא בכל אחוז) — נשמר');

/* ---------- 4+6. rt ו־ph ברשומה ---------- */
const LR = require(path.join(root, 'ibkr-proxy/lib/studiolearn.js'));
const eff = () => ({ state: 'done' });
const base = { id: 'j' + 'a'.repeat(20), kind: 'tr', state: 'done', created: 1, ended: 2 };
let r = LR.learnRec(Object.assign({}, base, { spec: { mode: 'haiku-high', dur: 60, size: 1 } }), 3, eff);
ok(r.rt === null && r.ph === null, 'עבודה רגילה — בלי rt/ph');
r = LR.learnRec(Object.assign({}, base, { spec: { src: 'url', ry: 1 } }), 3, eff);
ok(JSON.stringify(r.rt) === '{"s":"url","ry":1}' && r.ph === null, 'קישור + המנוי — rt');
r = LR.learnRec(Object.assign({}, base, { spec: { ph: 1, pw: 1, pt: 1 }, fph: { id: 'x' }, fpw: { id: 'y' },
  ppr: { s: 'err', e: 'x_oom', p: -1 }, pbn: { s: 'done', p: 1, sz: 31457280, ms: 90500 } }), 3, eff);
ok(JSON.stringify(r.rt) === '{"ph":1,"pw":1,"pt":1}', 'הכל בטלפון — rt');
ok(JSON.stringify(r.ph) === '{"m":1,"w":1,"pr":"err","pe":"x_oom","pb":"done","mb":30,"bs":91}', 'ph: השלב, הצריבה, הקבצים — מספרים וקודים');
r = LR.learnRec(Object.assign({}, base, { spec: { ph: 1, src: '<script>' }, ppr: { s: 'Bad stage!' }, pbn: { s: 'run', e: 'A B' } }), 3, eff);
ok(r.rt.s === undefined && JSON.stringify(r.ph) === '{"m":0,"w":0,"pb":"run"}', 'ערכים לא תקינים לא נכנסים');
ok(r.rt && r.rt.ph === 1, 'ph בלבד — rt עם ph');

console.log('\nכל ' + n + ' הבדיקות עברו ✓');
