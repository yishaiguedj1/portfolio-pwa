// 03/11/2026 — סבב קפיצות 12 (Academy): זכוכית בתוך הדף בלי טשטוש, וההדר כבר בציור הראשון
const fs = require('fs'), path = require('path');
const R = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
let n = 0, bad = 0;
const ok = (c, m) => { n++; if (!c) { bad++; console.log('FAIL - ' + m); } else console.log('ok - ' + m); };
const gb = R('glass-btn.css'), lib = R('library.js'), html = R('academy.html'), qa = R('tools/qa-sweep.js');

// 1. בתוך הדף — בלי טשטוש; בתוך @layer glassbtn (רק שם !important גובר על החומר), אחרי החומר, וההחרגות של מה שצף
const layer = gb.slice(gb.indexOf('@layer glassbtn {'));
const at = layer.indexOf(':where(.lib-root) :not(:is(.appbar'), mat = layer.indexOf('-webkit-backdrop-filter: var(--gb-fx) !important');
ok(at > 0, 'סעיף 8: כלל ל־.lib-root בתוך השכבה');
ok(mat > 0 && at > mat, 'הכלל אחרי החומר');
const rule = layer.slice(at, layer.indexOf('}', at));
ok(/backdrop-filter: none !important/.test(rule), 'הכלל מכבה backdrop-filter');
for (const c of ['.appbar', '.lib-selbar', '.mg-fab', '.lib-sheet', '.rd', '.px-view']) ok(rule.includes(c), 'מה שצף נשאר עם טשטוש: ' + c);

// 2. ההדר המשותף לפני ה־await הראשון של openLibrary
const ol = lib.slice(lib.indexOf('export async function openLibrary('));
const pre = ol.indexOf("root.firstChild.prepend(SA.shell.el)"), aw = ol.search(/await [A-Za-z_(]/);
ok(pre > 0 && aw > pre, 'openLibrary: ההדר נכנס לדף לפני ה־await הראשון');
ok(/if \(SA && SA\.shell && !restore\)/.test(ol.slice(0, aw)), 'רק בפתיחה (לא בשחזור אחרי רענון)');

// 3. academy.html — הסקריפטים ב־head, המודול חוסם ציור
const head = html.slice(0, html.indexOf('</head>'));
ok(/<script type="module" src="academy-app\.js" blocking="render"><\/script>/.test(head), 'academy-app.js ב־head עם blocking="render"');
ok(['firebase-config.js', 'strings-academy.js', 'core.js', 'auth.js'].every((f) => head.includes('src="' + f + '" defer')), 'הסקריפטים הקלאסיים ב־head עם defer');
ok(head.indexOf('auth.js') < head.indexOf('academy-app.js'), 'הסדר נשמר');

// 4. הגלאי
ok(/L\.glass\.push/.test(qa), 'qa-sweep: שכבת טשטוש חדשה בתוך הדף בזמן מעבר');

// 5. ספרים דומים — מהזיכרון בכניסה חוזרת, דעיכה רכה בכניסה הראשונה
const pro = R('libpro.js'), css = R('library.css'), app = R('app.js');
ok(/function similarNow\(host, b\)/.test(pro) && /similarInto, similarNow,/.test(pro), 'libpro: similarNow מיוצא');
ok(/if \(!host\.isConnected \|\| host\._sim === simIds\(list\)\) return;/.test(pro), 'אותם ספרים — לא בונים מחדש');
const rb = lib.indexOf("const sim = h('div', 'bk-sim')");
ok(rb > 0 && lib.indexOf('PRK.similarNow(sim, b)', rb) > rb && lib.indexOf('PRK.similarNow(sim, b)', rb) < lib.indexOf('home.append(top, d)', rb), 'דף ספר: הדומים מהזיכרון לפני שהדף נכנס');
ok(/\.bk-sim\.in \{ animation: vtFadeIn/.test(css), 'דעיכה רכה בכניסה הראשונה');

// 6. החוגה של שלושה — מרווחים יותר (הכיתובים לא חופפים)
const ds = app.slice(app.indexOf('function dialStep('), app.indexOf('function dialRest('));
const dialStep = new Function('return ' + ds.replace(/\/\*[\s\S]*?\*\//g, ''))();
ok(dialStep(360, 3) >= 95 && dialStep(390, 3) >= 103 && dialStep(412, 3) <= 104, 'שלושה פריטים: ' + dialStep(360, 3).toFixed(1) + ' / ' + dialStep(390, 3).toFixed(1));
ok(dialStep(390, 4) === Math.max(66, Math.min(96, 390 / 4.8)) && dialStep(390, 7) < 70, 'ארבעה ושבעה — בלי שינוי');

console.log(n - bad + '/' + n + ' passed');
process.exit(bad ? 1 : 0);
