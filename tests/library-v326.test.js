// v326: הסרת הדגשה (כמו קינדל, בעיצוב Apple), בלי עותקים כפולים, ומחברת "מה למדתי" עם סינון/עריכה/ייצוא
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const lib = fs.readFileSync(path.join(root, 'library.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'library.css'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

// הפונקציות הטהורות — נשלפות מהקובץ ומורצות כאן
const grab = (name) => { const i = lib.indexOf('export function ' + name + '('); let d = 0, j = lib.indexOf('{', i); for (; j < lib.length; j++) { if (lib[j] === '{') d++; else if (lib[j] === '}' && --d === 0) break; } return lib.slice(i + 7, j + 1); };
const fn = new Function(grab('annDupes') + '\n' + grab('annFilter') + '\n' + grab('annExportText') + '\nreturn { annDupes, annFilter, annExportText };')();

const A = [
  { id: 'a1', c: 'cfi1', x: 'able', k: 'y', u: 1 },
  { id: 'a2', c: 'cfi1', x: 'able', k: 'y', u: 3 },
  { id: 'a3', c: 'cfi1', x: 'able', k: 'p', u: 2 },
  { id: 'a4', c: 'cfi2', x: 'he', k: 'b', n: 'הערה', u: 1, f: 0.5 },
  { id: 'a5', c: 'cfi3', x: 'was', k: 'y', d: 1, u: 9 },
  { id: 'b1', c: 'cfi1', x: 'עמוד', b: 1, u: 5, f: 0.1 },
];
const dup = fn.annDupes(A);
ok(dup.length === 2 && dup.includes('a1') && dup.includes('a3') && !dup.includes('a2'), 'כפילויות באותו CFI: העדכני נשאר, השאר מסומנים למחיקה');
ok(!dup.includes('b1') && !dup.includes('a5'), 'סימנייה ומחוק — לא נחשבים כפילות');
ok(fn.annDupes([]).length === 0 && fn.annDupes(null).length === 0, 'רשימה ריקה/חסרה');

const ids = (l) => l.map((a) => a.id).join(',');
ok(ids(fn.annFilter(A, { t: 'all' })) === 'a1,a2,a3,b1,a4' || fn.annFilter(A, { t: 'all' }).length === 5, 'הכל: הדגשות + סימניות, בלי מחוקים');
ok(ids(fn.annFilter(A, { t: 'bm' })) === 'b1', 'סימניות בלבד');
ok(ids(fn.annFilter(A, { t: 'note' })) === 'a4', 'הערות בלבד (הדגשות עם הערה)');
ok(ids(fn.annFilter(A, { t: 'hl', k: 'p' })) === 'a3', 'סינון לפי צבע');
ok(!fn.annFilter(A, { t: 'all', k: 'y' }).some((a) => a.b), 'סינון צבע מסתיר סימניות');
const fs_ = fn.annFilter(A, { t: 'all' }).map((a) => a.f || 0);
ok(fs_.every((v, i) => i === 0 || v >= fs_[i - 1]), 'ממוין לפי מיקום בספר');

const ex = fn.annExportText('The Snowball', 'Alice Schroeder', A.filter((a) => a.id === 'a4' || a.id === 'b1'));
ok(/^The Snowball — Alice Schroeder/.test(ex) && /“he”/.test(ex) && /✎ הערה/.test(ex) && /50%/.test(ex) && !/עמוד/.test(ex), 'ייצוא: כותרת, ציטוט, הערה ומיקום — בלי סימניות');

// הקורא: סימון על הדגשה קיימת = הבועה של הקיימת (לא עותק חדש), עם כפתור הסרה
ok(/function annOverlapping\(doc, range\)/.test(lib) && /compareBoundaryPoints\(Range\.START_TO_END, ar\) > 0 && range\.compareBoundaryPoints\(Range\.END_TO_START, ar\) < 0/.test(lib), 'זיהוי חפיפה בין הסימון להדגשה קיימת');
ok(/const hit = annOverlapping\(doc, range\);[\s\S]{0,120}if \(hit\) buildPop\(\{ text: hit\.x, cfi: hit\.c, ann: hit/.test(lib), 'סימון חוזר פותח את ההדגשה הקיימת');
ok(/rd-dot rd-clear[\s\S]{0,200}ICON\.unmark[\s\S]{0,300}annRemove\(rd\.rec, ann\)/.test(lib), 'בועה: כפתור "הסרת הסימון" (עיגול עם קו)');
ok(/annRemove[\s\S]{0,300}askConfirm\(T\('hlRemoveNoteQ'\)/.test(lib), 'הדגשה עם הערה — אישור לפני הסרה');
ok(/annCleanDupes\(rec\);/.test(lib) && /all\.forEach\(\(b\) => annCleanDupes\(b\)\)/.test(lib), 'ניקוי כפילויות קיימות — בפתיחת ספר ובמחברת');
ok(/function annTouch\(rec, a, patch\)[\s\S]{0,500}pushAnn\(rec, a\)[\s\S]{0,400}deleteAnnotation/.test(lib), 'עדכון אחד לכל המקומות: שמירה, ענן, ציור מחדש בקורא');
// המחברת: סינון, פעולות, ייצוא
ok(/const learnF = \{ t: 'all', k: null \};/.test(lib) && /annFilter\(b\.ann, learnF\)/.test(lib), 'מחברת: סינון הכל/הדגשות/הערות/סימניות + צבע');
ok(/function annActions\(rec, a, opt\)/.test(lib) && /T\('annOpen'\)/.test(lib) && /T\('annCopy'\)/.test(lib) && /T\('annShareQuote'\)/.test(lib) && /ann-colors/.test(lib), 'גיליון פעולות: צבע, הערה, העתקה, ציטוט, מעבר, הסרה');
ok(/annRow\(a, \(\) => openReader\(b\.id, \{ cfi: a\.c \}\),\s*\(\) => annActions\(b, a/.test(lib), 'שורה במחברת: לחיצה = מעבר, ⋯ = פעולות');
ok(/wireHold\(r, onMore\)/.test(lib), 'לחיצה ארוכה על שורה = פעולות');
ok(/annRow\(a, \(\) => go\(a\.c\), \(\) => closeSheetThen\(sh\.parentNode, \(\) => annActions\(rd\.rec, a/.test(lib), 'גם בתוכן העניינים של הקורא');
ok(/annExportText\(b\.title, b\.author/.test(lib), 'שיתוף כל ההדגשות של ספר');
ok(/async function quoteCard\(text, recIn\)/.test(lib), 'כרטיס ציטוט גם מחוץ לקורא');
ok(!/const r = h\('button', 'ann-row'\)/.test(lib), 'השורה לא כפתור (בתוכה כפתור ⋯ — כפתור בתוך כפתור לא תקין)');
// עיצוב
ok(/\.rd-pop \.rd-clear \{/.test(css) && /\.ann-colors button\.on::after/.test(css) && /\.ann-more \{/.test(css) && /\.learn-colors button\.on/.test(css), 'עיצוב: כפתור הסרה, צבעים עם ✓, ⋯, סינון צבע');
ok(/prefers-reduced-motion: reduce\) \{ \.ann-row, \.ann-colors button/.test(css), 'reduced-motion');
// מחרוזות בשתי השפות
['hlRemove', 'hlRemoved', 'hlRemoveNoteQ', 'hlEditNote', 'hlAddNote', 'annOpen', 'annCopy', 'annShareQuote', 'annDeleteBm', 'annMore', 'learnAll', 'learnNotes', 'learnColor', 'learnNoMatch', 'learnExport']
  .forEach((k) => ok((app.match(new RegExp('\\b' + k + ": '", 'g')) || []).length === 2, 'מחרוזת בעברית ובאנגלית: ' + k));
console.log('# ' + n + ' בדיקות עברו');
