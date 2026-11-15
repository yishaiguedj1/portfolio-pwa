// 15/11/2026 — Invest: זכוכית בתוך הדף בלי טשטוש (בקשת המשתמש: "החיפוש, המיון והסינון כל הזמן נעלמים").
// כל גרירה/מעבר בקובייה הדליקה וכיבתה טשטוש לכפתורי הסרגל (.cube-flat → --gb-fx: none) — שכבה חדשה שבטלפון מוצגת לפני שנצבעה.
const fs = require('fs'), path = require('path');
const R = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
let n = 0, bad = 0;
const ok = (c, m) => { n++; if (!c) { bad++; console.log('FAIL - ' + m); } else console.log('ok - ' + m); };
const gb = R('glass-btn.css'), qa = R('tools/qa-sweep.js'), html = R('index.html');

// 1. הכלל בתוך @layer glassbtn (רק שם !important גובר על החומר), אחרי החומר
const layer = gb.slice(gb.indexOf('@layer glassbtn {'));
const at = layer.indexOf(':where(main .tabpage) :not('), mat = layer.indexOf('-webkit-backdrop-filter: var(--gb-fx) !important');
ok(at > 0, 'סעיף 9: כלל לעמודי Invest בתוך השכבה');
ok(mat > 0 && at > mat, 'הכלל אחרי החומר');
const rule = layer.slice(at, layer.indexOf('}', at));
ok(/-webkit-backdrop-filter: none !important; backdrop-filter: none !important/.test(rule), 'הכלל מכבה backdrop-filter');
// מה שצף מעל תוכן — נשאר עם טשטוש
for (const c of ['.src-pop', '.menu-drop', '.stock-search-results', '.pf-pick-bubble', '.pf-key']) ok(rule.includes(c), 'מה שצף נשאר עם טשטוש: ' + c);
// 2. העמודים באמת בתוך <main> (אחרת הכלל לא חל)
const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
for (const t of ['overview', 'stocks', 'trades', 'wishlist', 'deposits', 'pension']) ok(main.includes('id="tab-' + t + '" class="tabpage'), 'העמוד בתוך main: ' + t);
// 3. הגלאי ב־qa-sweep פעיל גם ל־Invest
ok(/app === 'academy' \|\| app === 'invest'\) \? S\.lt\.glass\.slice\(\)/.test(qa), 'qa-sweep: שכבת טשטוש חדשה בתוך הדף — גם ב־Invest');

console.log('\n' + (n - bad) + '/' + n + ' passed');
if (bad) process.exit(1);
