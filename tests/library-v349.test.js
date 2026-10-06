// v349 (באג חמור שהמשתמש דיווח 06/10/2026): "חזור" כפול / ✕ לא מוציאים מהספר — לסירוגין.
// שוחזר ב־Playwright (פעולות אקראיות בקורא ואז יציאה): ✕ מיד אחרי סגירת גיליון / רשומה כפולה מ־readerRearm —
// readerExit חישב go(-2) מהרשומה הלא נכונה, ו־rd.closing נשאר דלוק לתמיד: ה־✕ נחסם וכל "חזור" בקורא התעלם.
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const lib = fs.readFileSync(path.join(__dirname, '..', 'library.js'), 'utf8');
const tex = fs.readFileSync(path.join(__dirname, '..', 'pagetex.js'), 'utf8');
const body = (name) => { const i = lib.indexOf('function ' + name + '('); return lib.slice(i, lib.indexOf('\n}\n', i)); };
const ex = body('readerExit'), pop = body('onPop'), leave = body('readerLeaveHistory'), rearm = body('readerRearm');
ok(!/history\.go\(/.test(ex) && /closeReader\(\)/.test(ex) && /readerLeaveHistory\(\)/.test(ex), 'יציאה בלי ספירת רשומות: הקורא נסגר מיד ואז חוזרים אחורה');
ok(/if \(lvl === 2 && !rd\) \{[^\n]*\n\s+try \{ history\.back\(\); \}/.test(pop), 'רשומת קורא שהקורא שלה סגור — מדלגים עליה (לא נתקעים ברשומה כפולה)');
ok(/Date\.now\(\) - \(rd\.backAt \|\| 0\) < BACK_TWICE_MS\) readerExit\(\)/.test(pop) && /BACK_TWICE_MS = 2000/.test(lib), '"חזור" שני תוך 2 שנ׳ — יוצא תמיד, על כל רשומה');
ok(/if \(exitSkip && lvl < 2\)/.test(pop), 'היציאה הגיעה לדף הספר — בלי ציור/מעבר כפול');
ok(/setTimeout\(\(\) => \{ if \(!rd && exitSkip/.test(leave) && /< 3000/.test(leave), 'חזרה שנבלעה (חזרה פנימית באותו רגע) — מנסים שוב עד 3 שנ׳');
ok(/\|\| st\.sheet\) return;/.test(rearm), 'readerRearm לא דוחף רשומה מעל רשומת גיליון');
ok(/sheetSkip--; if \(!sheetSkip\) sheetClosed = null;/.test(lib), 'החזרה של גיליון נחתה — sheetClosed מתאפס');
ok(/if \(!rd\) return;\s+\/\/ v349: relocate מאוחר/.test(lib), 'relocate שמגיע אחרי סגירת הקורא — לא זורק שגיאה');
ok(/if \(!top\) \{ ctx\.restore\(\); return cv; \}/.test(tex), 'ציור גב הדף על מסמך שנפרק — לא זורק שגיאה');
console.log(n + ' בדיקות עברו');
