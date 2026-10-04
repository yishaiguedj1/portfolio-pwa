// v319: ספר שבגיבוי ולא בטלפון — מופיע ב"הספרייה שלי" דהוי, עם ענן וחץ הורדה; נגיעה = הורדה ופתיחה
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const lib = fs.readFileSync(path.join(root, 'library.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'library.css'), 'utf8');
const bk = fs.readFileSync(path.join(root, 'libbackup.js'), 'utf8');
ok(/const cloudOnly = mine && cloudBooks \? cloudBooks\.filter\(\(c\) => !have\.has\(c\.id\)\) : \[\]/.test(lib), 'רק ספרים שבגיבוי ולא בטלפון, ורק ב"הספרייה שלי"');
ok(/const listed = books\.concat\(cloudOnly\)/.test(lib) && /sortBooks\(listed\.filter/.test(lib), 'משולבים ברשת ובמיון יחד עם הספרים שבטלפון');
ok(/if \(b\.cloud\) return cloudItem\(b, idx\)/.test(lib) && /'lib-item cloud'/.test(lib), 'פריט נפרד לספר שבענן');
ok(/\.lib-item\.cloud \.lib-cover \{ opacity: \.42/.test(css), 'הכריכה דהויה');
ok(/cloudDown:/.test(lib) && /lib-cbadge/.test(lib) && /\.lib-cbadge \{/.test(css), 'סמל ענן עם חץ הורדה על הכריכה');
ok(/T\('libInCloud'\)/.test(lib), 'כיתוב "בגיבוי" + גודל מתחת לכריכה');
ok(/it\.addEventListener\('click', \(\) => downloadCloud\(b, it, true\)\)/.test(lib) && /if \(open\) goView\(\{ book: b\.id \}\)/.test(lib), 'נגיעה = הורדה, ואחריה דף הספר');
ok(/\.lib-item\.cloud\.loading \.lib-cbadge::after/.test(css), 'בזמן ההורדה — סימן טעינה במקום החץ');
ok(/libDlAll/.test(lib), 'כמה ספרים בגיבוי — "הורדת כל הספרים מהגיבוי"');
ok(/if \(books\.length \|\| cloudOnly\.length\) home\.append\(backupRow\(\)\)/.test(lib), 'גם כשכל הספרים בענן — שורת הגיבוי והחיפוש מוצגות');
ok(/cloudBooks = null;\s+\/\/ v319/.test(lib), 'אחרי איפוס — מה שנשאר בגיבוי מופיע להורדה');
ok(/let chain = Promise\.resolve\(\), pending = 0;/.test(bk) && !/if \(busy\) return busy;/.test(bk), 'פעולות הגיבוי בתור — הורדה בזמן גיבוי אוטומטי לא נבלעת');
ok(/year: \(e\.meta && e\.meta\.year\) \|\| 0/.test(bk), 'שנה ברשימת הגיבוי (למיון)');
ok(/\[data-theme="dark"\] \.lib-cbadge \{ background: #2C2C2E; \}/.test(css), 'במצב כהה — רקע אטום לסמל (ה־surface שקוף)');
console.log('# ' + n + ' בדיקות עברו');
