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
for (const c of ['.src-pop', '.menu-drop', '.stock-search-results', '.pf-pick-bubble']) ok(rule.includes(c), 'מה שצף ונפתח בלחיצה נשאר עם טשטוש: ' + c);
ok(!rule.includes('.pf-key'), 'המקרא הקבוע בגרף — בלי טשטוש (נכבה בכל מעבר = שכבה חדשה)');
// 2. העמודים באמת בתוך <main> (אחרת הכלל לא חל)
const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
for (const t of ['overview', 'stocks', 'trades', 'wishlist', 'deposits', 'pension']) ok(main.includes('id="tab-' + t + '" class="tabpage'), 'העמוד בתוך main: ' + t);
// 3. הגלאי ב־qa-sweep פעיל גם ל־Invest
ok(/app === 'academy' \|\| app === 'invest'\) \? S\.lt\.glass\.slice\(\)/.test(qa), 'qa-sweep: שכבת טשטוש חדשה בתוך הדף — גם ב־Invest');

// 4. (16/11/2026) הדף = שכבה אחת, בלי שכבות דחוסות: הקופסה ברוחב המסך עם חיתוך אופקי, והשורות הנגללות בסוף סדר הציור
const css = R('styles.css'), dk = R('desktop.css'), app = R('app.js');
ok(/main \.tabpage \{ margin-inline: -16px; padding-inline: 16px; overflow-x: clip; \}/.test(css), 'styles.css: הדף ברוחב המסך + overflow-x: clip');
ok(!/main \.tabpage \{[^}]*overflow-y/.test(css), 'בלי חיתוך אנכי (תפריטים נפתחים ותוצאות חיפוש)');
// 5. (16/11/2026, הקלטה שנייה) השורות שנגללות לרוחב — overflow: hidden (בלי שכבה משלהן), הגלילה באצבע ב־JS
const hr = css.match(/main \.tabpage :is\(([^)]*)\):not\(\.stock-chips\) \{ overflow: hidden; touch-action: pan-y; \}/);
ok(!!hr, 'styles.css: השורות הנגללות — overflow: hidden + touch-action: pan-y');
for (const c of ['.ranges', '.chip-row', '.stock-sort-row', '.wl-tabs', '.tx-years']) ok(hr && hr[1].includes(c), 'שורה נגללת: ' + c);
ok(!/position: relative; z-index: 1; \}/.test(css.slice(css.indexOf('main .tabpage {'), css.indexOf('main .tabpage {') + 600)), 'בלי z-index לשורות (אין להן שכבה)');
// כל שורה נגללת לרוחב בתוך דפי Invest — ברשימה (שורה חדשה שלא ברשימה = שכבה שנעלמת בנחיתה)
const scrollers = [...css.matchAll(/(^|\n)([^{}\n]+)\{[^}]*overflow-x: (auto|scroll)/g)].map((m) => m[2].trim()).filter((sel) => /^\.(ranges|chip-row|stock-sort-row|wl-tabs|tx-years)\b/.test(sel));
ok(scrollers.length >= 4, 'נמצאו השורות הנגללות ב־styles.css (' + scrollers.length + ')');
// אותה רשימה ב־JS (HS_ROWS) וב־CSS
const hs = app.match(/const HS_ROWS = '([^']*)'/);
ok(hs && hr && hs[1] === 'main .tabpage :is(' + hr[1] + '):not(.stock-chips)', 'HS_ROWS ב־app.js = הבורר ב־styles.css');
ok(/try \{ initHScroll\(\); \} catch/.test(app), 'initHScroll נקרא באתחול');
ok(/function initHScroll\(\)[\s\S]{0,1400}classList\.contains\('drag-active'\)\) \{ s = null; return; \}/.test(app), 'גרירת טאב רשימה (drag-active) — השורה לא נגללת עם האצבע (19/11/2026)');
ok((app.match(/\|\| (?:\(typeof hsRow === 'function' && )?hsRow\((el|n)\)/g) || []).length >= 3, 'החלקת הלשוניות (שני המנועים) וגלגלת המחשב מכירות את השורות');
const fl = app.match(/function hsFling\(v, dt\) \{[^}]*\}/);
const hsFling = fl && new Function(fl[0] + '; return hsFling;')();
ok(hsFling && hsFling(1, 0) === 1 && hsFling(1, 16) < 1 && hsFling(1, 16) > 0.9 && hsFling(-1, 500) > -0.2, 'תנופה דועכת לפי הזמן, בשני הכיוונים');
ok(/html\.dk main \.tabpage \{ margin-inline: -24px; padding-inline: 24px; \}/.test(dk), 'desktop.css: אותו דבר עם הריפוד של המחשב');
ok(/px;margin:0;visibility:hidden;pointer-events:none/.test(app), 'tabPrewarm: margin:0 בדף המחומם (מוצמד לפי הקופסה)');
const ts = R('tools/qa-sweep.js');
ok(/async function squashOf\(S\)/.test(ts) && /OverflowScroll/.test(ts), 'qa-sweep: גלאי שכבות נפרדות בדף שנחת (דחוסות ושורות גלילה)');

console.log('\n' + (n - bad) + '/' + n + ' passed');
if (bad) process.exit(1);
