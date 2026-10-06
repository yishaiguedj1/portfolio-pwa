// v321: הספרייה נפתחת ב"מדף ספרים"; "חזור" בקורא — בלי pushState בתוך popstate (Chrome מדלג על רשומות כאלה ויוצא מהאפליקציה)
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const lib = fs.readFileSync(path.join(__dirname, '..', 'library.js'), 'utf8');
const pop = lib.slice(lib.indexOf('function onPop'), lib.indexOf('/* v315: מיקום הגלילה'));
ok(/author: '\\u0001shelf'/.test(lib) && /if \(!restore\) \{ ui\.author = SHELF;/.test(lib) && /ui\.shelf = v; ui\.author = SHELF;/.test(lib), 'כל כניסה לספרייה וכל מעבר בין הספריות — "מדף ספרים"');
ok(!/pushState/.test(pop), 'אין pushState בתוך popstate (רשומה בלי הפעלת משתמש = Chrome מדלג עליה)');
ok(/history\.pushState\(Object\.assign\(\{\}, st, \{ guard: 1 \}\), ''\);\s+history\.pushState\(Object\.assign\(\{\}, st, \{ guard: 0 \}\), ''\);/.test(lib), 'פתיחת ספר: רשומת שומר + רשומת קורא, בתוך הלחיצה');
ok(/if \(lvl === 2 && rd && !rd\.closing\)/.test(pop) && /rdBackTwice/.test(pop), '"חזור" ראשון — נוחת על השומר: הודעה (או סגירת גיליון/בועה)');
ok(/if \(lvl < 2 && rd\) closeReader\(\);/.test(pop), '"חזור" שני — סוגר את הקורא ומציג את הדף הקודם (דף הספר)');
ok(/function readerExit\(\)[\s\S]{0,1200}readerLeaveHistory\(\)/.test(lib) && /if \(!rd && \(\(history\.state \|\| \{\}\)\.lib \|\| 0\) === 2\)/.test(lib) && /xBtn\.addEventListener\('click', \(\) => readerExit\(\)\)/.test(lib), '✕ — ישר לדף הספר, מדלג גם על השומר (v349: בלי ספירה — רשומות הקורא מדולגות)');
ok(/function readerRearm\(\)[\s\S]{0,500}userActivation\.isActive/.test(lib) && /addEventListener\('pointerup', readerRearm, true\)/.test(lib), 'נגיעה בתוך הספר אחרי "חזור" — השומר חוזר (רק עם הפעלת משתמש)');
ok(/function safeGoView\(v\)[\s\S]{0,200}ua\.isActive/.test(lib) && /if \(open\) safeGoView\(\{ book: b\.id \}\)/.test(lib), 'מעבר דף אחרי הורדה ארוכה — רק עם הפעלת משתמש');
console.log('# ' + n + ' בדיקות עברו');
