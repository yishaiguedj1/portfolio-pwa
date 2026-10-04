// v323: ציד באגים בניווט — רשומות רק עם הפעלת משתמש, שרידי modal/sheet אחרי רענון, מעבר טאב סוגר בועות, כלי המדידה המורחב
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const lib = fs.readFileSync(path.join(root, 'library.js'), 'utf8');
const qa = fs.readFileSync(path.join(root, 'tools', 'qa-motion.js'), 'utf8');
const fn = (src, name) => { const i = src.indexOf('function ' + name + '('); if (i < 0) return ''; let d = 0, j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && !--d) return src.slice(i, k + 1); } return ''; };
const mp = fn(app, 'modalPush');
ok(/navigator\.userActivation/.test(mp) && /if \(ua && !ua\.isActive\) return rec;/.test(mp), 'modalPush: רשומת היסטוריה רק עם הפעלת משתמש (pushState בלי נגיעה = רשומה "לדילוג" אצל Chrome)');
const wb = fn(app, 'wireBackNav');
ok(/if \(m\.pushed\) pushedClosed = true;/.test(wb) && /if \(pushedClosed\) \{[^\n]*modalPop[^\n]*return; \}/.test(wb), 'חלון בלי רשומה נסגר ב"חזור" בלי לבלוע את הניווט; חלון עם רשומה — ה"חזור" שלו');
ok(/delete c\.modal; delete c\.sheet; history\.replaceState\(c, ''\)/.test(app), 'אתחול: שרידי modal/sheet ברשומה אחרי רענון מנוקים');
ok(/if \(name !== prev\) \{ try \{ closeSrcPops\(\); clearItemActions\(\); \} catch \(e\) \{\} \}/.test(fn(app, 'switchTab')), 'מעבר טאב סוגר בועת סינון/כפתורי לחיצה ארוכה (רשומת החלון לא נשארת)');
ok(/function cleanState\(extra\)[^\n]*delete st\.sheet; delete st\.modal;/.test(lib) && /history\.pushState\(cleanState\(\{ lib: 1, lv: v \}\), ''\)/.test(lib) && /const st = cleanState\(\{ lib: 2, book: id \}\);/.test(lib), 'ספרייה: רשומה חדשה (דף/קורא) בלי שרידי sheet/modal');
const sh = fn(lib, 'sheet');
ok(/if \(!\(ua && !ua\.isActive\)\) afterBack/.test(sh) && /veil\._pushed = true/.test(sh), 'sheet(): רשומה רק עם הפעלת משתמש, מסומנת על הגיליון');
ok(/const own = !!v\._pushed;[^\n]*\n\s*if \(own\) return;/.test(fn(lib, 'onPop')), 'onPop: גיליון בלי רשומה נסגר וממשיכים בניווט');
ok(/state: \(\) => \(\{ sheetSkip, rd: !!rd, root: !!root/.test(lib), '_test.state חשוף לבדיקות השלמות');
ok(/col-card ' \+ \(c\.auto \? 'auto' : 'mine'\)/.test(lib), 'כרטיס אסופה מסומן auto/mine');
// כלי המדידה
ok(/M\.check = async \(\) => \{/.test(qa) && /modals=' \+ _modals\.length \+ ' state\.modal='/.test(qa) && /lib-restoring תקוע/.test(qa) && /גיליונות=' \+ L\.veils/.test(qa), 'כלי המדידה: בדיקות שלמות אחרי כל צעד');
ok(/page\.on\('console', \(m\) => \{ if \(m\.type\(\) !== 'error'\) return;/.test(qa) && /שגיאת דף: ' \+ errors\.slice\(nErr0\)/.test(qa), 'כלי המדידה: שגיאת קונסול/דף בצעד = צעד בעייתי');
ok(/const MONKEY = \+arg\('monkey', 0\)/.test(qa) && /SAFE_SKIP/.test(qa) && /canBack/.test(qa), 'כלי המדידה: מצב קוף אקראי עם רשימת פעולות אסורות ובלי "חזור" בשורש');
['בועת סינון', 'רשימה חדשה (גיליון)', 'לחיצה ארוכה → מחיקה (חלון אישור)', 'רענון עם תפריט פתוח', 'גיליון מתוך גיליון', 'חזור×2 מהר מהקורא', 'קריאה → ✕ מיד'].forEach((k) => ok(qa.includes(k), 'תרחיש: ' + k));
console.log('# ' + n + ' בדיקות עברו');
