// v349 (באג חמור שהמשתמש דיווח 06/10/2026): "חזור" כפול / ✕ לא מוציאים מהספר — לסירוגין.
// שוחזר ב־Playwright (פעולות אקראיות בקורא ואז יציאה): ✕ מיד אחרי סגירת גיליון / רשומה כפולה מ־readerRearm —
// readerExit חישב go(-2) מהרשומה הלא נכונה, ו־rd.closing נשאר דלוק לתמיד: ה־✕ נחסם וכל "חזור" בקורא התעלם.
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const lib = fs.readFileSync(path.join(__dirname, '..', 'library.js'), 'utf8');
const tex = fs.readFileSync(path.join(__dirname, '..', 'pagetex.js'), 'utf8');
const pc = fs.readFileSync(path.join(__dirname, '..', 'pagecurl.js'), 'utf8');
const body = (name) => { const i = lib.indexOf('function ' + name + '('); return lib.slice(i, lib.indexOf('\n}\n', i)); };
const ex = body('readerExit'), pop = body('onPop'), leave = body('readerLeaveHistory'), rearm = body('readerRearm');
ok(!/history\.go\(/.test(ex) && /closeReader\(\)/.test(ex) && /readerLeaveHistory\(\)/.test(ex), 'יציאה בלי ספירת רשומות: הקורא נסגר מיד ואז חוזרים אחורה');
ok(/^function onPop\(\) \{\n  staleBackAt = 0;[^\n]*\n  if \(!rd && \(\(history\.state \|\| \{\}\)\.lib \|\| 0\) === 2\)[\s\S]{0,260}skipStale\(\);/m.test(lib) && /function skipStale\(\) \{ setTimeout\(readerLeaveHistory, 0\); \}/.test(lib), 'רשומת קורא שהקורא שלה סגור — מדלגים עליה אחרי האירוע (back בתוך popstate לא מבוצע)');
ok(/Date\.now\(\) - \(rd\.backAt \|\| 0\) < BACK_TWICE_MS\) readerExit\(\)/.test(pop) && /BACK_TWICE_MS = 2000/.test(lib), '"חזור" שני תוך 2 שנ׳ — יוצא תמיד, על כל רשומה');
ok(/if \(exitSkip && lvl < 2\)/.test(pop), 'היציאה הגיעה לדף הספר — בלי ציור/מעבר כפול');
ok(/staleBackAt && Date\.now\(\) - staleBackAt < 1000\) \{ setTimeout\(readerLeaveHistory, 150\)/.test(leave), 'back אחד בכל פעם — הבא רק אחרי שהקודם נחת או שנייה בלי תגובה (כמה ממתינים = חזרה רחוקה מדי)');
ok(/\|\| st\.sheet\) return;/.test(rearm), 'readerRearm לא דוחף רשומה מעל רשומת גיליון');
ok(/sheetSkip--; if \(!sheetSkip\) sheetClosed = null;/.test(lib), 'החזרה של גיליון נחתה — sheetClosed מתאפס');
ok(/if \(!rd\) return;\s+\/\/ v349: relocate מאוחר/.test(lib), 'relocate שמגיע אחרי סגירת הקורא — לא זורק שגיאה');
ok(/if \(!top\) \{ ctx\.restore\(\); return cv; \}/.test(tex), 'ציור גב הדף על מסמך שנפרק — לא זורק שגיאה');
// הסיבה העיקרית (נמדד: history.length גדל בכל מעבר פרק): iframe קבוע של הפרק השכן נטען מחדש ב־src — כל טעינה = רשומה בהיסטוריה
ok(/function frameGo\(fr, url\) \{[\s\S]{0,200}contentWindow\.location\.replace\(url\)/.test(pc) && /frameGo\(c\.fr, url\)/.test(pc) && !/\.fr\.src = /.test(pc), 'הפרק השכן נטען ב־location.replace — בלי רשומות היסטוריה נסתרות ש"בולעות" את "חזור"');
console.log(n + ' בדיקות עברו');
