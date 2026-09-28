// pf-v134.test.js — תשואת גרף המניה לפי טווח.
// דיווח (24/09/2026): NOW בטווח "שנה" הראה כ־−25.4% כשהמספר האמיתי ~−26–28%.
// שורשים: (1) filterRange ספר שורות (שנה = 252, שבוע = 5 → 4 ימי שינוי בלבד,
// YTD מהסגירה של יום המסחר הראשון במקום 31/12); (2) הגרף נגמר בשורה האחרונה
// של היסטוריה שמורה (מטמון עד 24 שעות / בזיכרון ללא הגבלה) ולא במחיר החי.
// נתונים סינתטיים בלבד.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
/* v231: טשטוש בסגנון Apple כשהתפריט פתוח + כרטיסי מניה נסגרים (פתיחת אחר / מעבר טאב / רקע) */
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
let n = 0;
function ok(cond, name) { n++; if (!cond) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const fn = (name) => { const i = src.indexOf('function ' + name + '('); return src.slice(i, src.indexOf('\n}\n', i)); };
ok(/document\.body\.classList\.toggle\('menu-blur', open\)/.test(fn('setMainMenuOpen')), 'setMainMenuOpen מדליק/מכבה את הטשטוש (כל דרך סגירה עוברת דרכה)');
ok(/veil\.id = 'menuVeil'/.test(fn('initMainMenu')) && /touchmove/.test(fn('initMainMenu')), 'שכבת טשטוש על העמוד, בלי גלילה מאחוריה');
ok(/\.menu-veil \{[^}]*z-index: 19;[^}]*backdrop-filter: blur\(18px\)/.test(css), 'שכבת העמוד מתחת להדר (z 19) עם blur');
ok(/body\.menu-blur \.appbar \.brand, body\.menu-blur \.appbar-sub, body\.menu-blur \.appbar \.fx-pill \{ filter: blur/.test(css), 'בהדר: הלוגו/המקור/השער מטושטשים, הכפתורים לא');
ok(/prefers-reduced-motion: reduce\) \{\s*\.menu-veil/.test(css), 'מכבד "הפחת תנועה"');
ok(/if \(!state\.open\[sym\]\) closeStockCards\(sym, card\);/.test(fn('toggleStock')), 'פתיחת כרטיס סוגרת את האחרים');
ok(/prev === 'stocks' && name !== 'stocks'\) \{ try \{ closeStockCards\(\)/.test(fn('switchTab')), 'יציאה מטאב המניות סוגרת הכל');
ok(/if \(document\.hidden\) \{[\s\S]*?closeStockCards\(\);/.test(src), 'יציאה מהאפליקציה (רקע) סוגרת הכל');
ok(/window\.scrollBy\(0, after - before\)/.test(fn('closeStockCards')), 'הכרטיס שנגעת בו לא קופץ (פיצוי גלילה)');
// v233: פתיחת כרטיס מעלה את ראשו לראש המסך (מתחת להדר), גם אחרי שהאנימציה הגדילה את הדף
ok(/scrollCardToTop\(card\);/.test(fn('toggleStock')) && /if \(opening && state\.open\[sym\]\) \{[\s\S]*?scrollCardToTop\(card\)/.test(fn('toggleStock')), 'v233: פתיחת כרטיס גוללת את ראשו לראש המסך (מיד + בסוף האנימציה)');
ok(/\.appbar'\);[\s\S]*?getBoundingClientRect\(\)\.height : 0\) \+ 10/.test(fn('scrollCardToTop')), 'v233: מתחת להדר הדביק');
// v234: נתוני הכרטיס — בלי בועות: קו אופקי דק בין השורות + קווים אנכיים קצרים, אחוז קטן ורגיל
ok(/\.kv \{ position: relative; background: none;/.test(css) && /\.kv::before \{[^}]*top: 22%; bottom: 22%; width: \.5px/.test(css) && /\.kv:nth-child\(n\+4\) \{ border-top: \.5px solid var\(--outline\)/.test(css), 'v234: נתוני הכרטיס — בלי בועות, קווים דקים (הצעה ה׳)');
ok(/\.kv \.v2 \{ font-size: 11px; font-weight: 500;/.test(css), 'v234: האחוז קטן ורגיל');
// v235: אריחי הסקירה — כרטיס אחד עם קווים אנכיים קצרים (כמו נתוני כרטיס המניה)
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
ok(/<div class="cards-3 ov-stats card">/.test(html) && !/<div class="card stat">\s*<div class="stat-label" data-i18n="ovStocksValue">/.test(html), 'v235: הסקירה — כרטיס אחד במקום שלושה');
ok(/\.ov-stats \.stat \+ \.stat::before \{[^}]*width: \.5px/.test(css), 'v235: קווים אנכיים קצרים בין הנתונים');
// v236: כרטיס מניה פתוח נכנס במסך אחד — בלי כפתור "מדידה", בלי שורת legend כפולה, גרף 170
const body = fn('buildStockBody');
ok(!/t\('measure'\)/.test(body) && !/measure-chip/.test(body) && !/sleg-/.test(body), 'v236: בלי כפתור מדידה ובלי שורת legend בכרטיס המניה');
ok(/\.stock-body \.chart-wrap canvas \{ height: 170px; \}/.test(css) && /h = canvas\.clientHeight \|\| 170/.test(src), 'v236: גובה הגרף מה־CSS (170)');
ok(/class="rs-sym"><span class="dot"/.test(fn('renderStockRangeSummary')), 'v236/v238: סמן ● סימבול מימין לשורת התשואה (אושר)');
ok(/function fitCardToScreen/.test(src) && /fitCardToScreen\(sym, card\);\n    ensureChartData\(sym\);/.test(fn('toggleStock')) && /ResizeObserver/.test(fn('fitCardToScreen')), 'v238: הכרטיס הפתוח = גובה המסך מתחת להדר (הגרף משלים, מתעדכן כשהתוכן משתנה)');
ok(/foot\.appendChild\(sret\)/.test(fn('buildStockBody')) && /foot\.appendChild\(actions\)/.test(fn('buildStockBody')), 'v237: "ערוך" באותה שורה עם התשואה');
ok(/\.stock-foot \.pf-range-summary \{ flex: 1 1 auto; min-width: 0;/.test(css) && /\.edit-actions\.stock-edit \{ flex: none;/.test(css), 'v237: התשואה מתכווצת, הכפתור קבוע — בלי חפיפה');
ok(/fitStockFoot\(box\)/.test(fn('renderStockRangeSummary')) && /classList\.add\('no-lbl'\)/.test(fn('fitStockFoot')), 'v237: מה שלא נכנס שלם מוסתר (בלי חיתוך)');
console.log('\n' + n + ' בדיקות עברו');
