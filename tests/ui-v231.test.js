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
console.log('\n' + n + ' בדיקות עברו');
