// v316: לחיצה ארוכה על ספר = עריכה/מחיקה (כמו במניות), עריכת כל פרטי הספר, משיכת פרטים מ־4 מאגרים, הסתרת מכתב מ־Drive
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const lib = fs.readFileSync(path.join(root, 'library.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'library.css'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const pure = (name) => new Function((lib.match(new RegExp('export function ' + name + '[\\s\\S]*?\\n}\\n')) || [''])[0].replace('export ', '') + '; return ' + name + ';');

// פונקציות טהורות מהטקסט (library.js מייבא את המנוע ודורש DOM)
const bookYear = pure('bookYear')();
const EDIT_FIELDS = JSON.parse(lib.match(/export const EDIT_FIELDS = (\[[^\]]+\])/)[1].replace(/'/g, '"'));
const applyEdit = new Function('bookYear', 'EDIT_FIELDS', lib.match(/export function applyEdit[\s\S]*?\n}\n/)[0].replace('export ', '') + '; return applyEdit;')(bookYear, EDIT_FIELDS);
const driveSyncPlan = pure('driveSyncPlan')();

ok(EDIT_FIELDS.join() === 'title,subtitle,author,authorSort,pub,date,lang,series,seriesIdx,isbn,tags,desc', 'שדות העריכה — כמו ב־Calibre: כותר, משנה, כותב + מיון, הוצאה, תאריך, שפה, סדרה + מספר, ISBN, נושאים, תקציר');
const r = applyEdit({ title: 'מכתב באפט 1987', year: 1987 }, { title: ' The Intelligent Investor ', author: 'Benjamin Graham', date: '1949', isbn: '9780060555665' });
ok(r.title === 'The Intelligent Investor' && r.author === 'Benjamin Graham' && r.year === 1949 && r.isbn === '9780060555665', 'עריכה: הערכים מוחלים, השנה מהתאריך (לא מהכותר)');
ok(applyEdit({ title: 'x' }, { title: '' }).title === '—', 'כותר ריק — לא נשאר ספר בלי שם');
ok(applyEdit({ title: '1984', date: '' }, { title: '1984' }).year === 1984 && applyEdit({ title: 'Book' }, { title: 'Book', date: '2003-05-01' }).year === 2003, 'שנה: מהתאריך, ואם אין — מהכותר');

const plan = driveSyncPlan([{ id: 'a', driveId: 'D1', md5: 'old', hidden: 1 }, { id: 'b', driveId: 'D2', md5: 'old' }], [{ id: 'D1', md5: 'new' }, { id: 'D2', md5: 'new' }]);
ok(plan.fetch.length === 1 && plan.fetch[0].id === 'D2', 'מכתב מוסתר לא יורד שוב גם כשהקובץ התעדכן');

ok(/wireHold\(it, \(\) => bookActions\(it, b\)\)/.test(lib) && /showItemActions\(host, acts\)/.test(lib) && /kind: 'edit'[\s\S]{0,80}kind: 'del'/.test(lib), 'לחיצה ארוכה → אותם כפתורים של המניות (showItemActions: עט + X)');
ok(/html\.lib-open \.item-acts\.floating \{ z-index: (\d+)/.test(css) && +css.match(/html\.lib-open \.item-acts\.floating \{ z-index: (\d+)/)[1] > 900, 'הכפתורים מעל שכבת הספרייה');
ok(/root\.addEventListener\('contextmenu'/.test(lib) && /-webkit-touch-callout: none/.test(css) && /\.lib-cover img[^{]*\{[^}]*pointer-events: none/.test(css), 'בלי תפריט הדפדפן "הורדת תמונה" בלחיצה ארוכה על כריכה');
ok(/if \(old\.edit\) \{ rec\.edit = old\.edit; applyEdit\(rec, old\.edit\); \}/.test(lib) && /if \(old\.coverCustom\)/.test(lib) && /if \(old\.hidden\) rec\.hidden = 1;/.test(lib), 'העריכה, הכריכה שנבחרה וההסתרה שורדות עדכון של הקובץ');
ok(/const drive = b\.src === 'drive';[\s\S]{0,300}cur\.hidden = 1/.test(lib) && /delete cur\.hidden; cur\.md5 = ''/.test(lib), 'מכתב מ־Drive מוסתר (לא נמחק לתמיד) ואפשר להחזיר אותו');
ok(/'\/api\/bookmeta'/.test(lib) && /op: 'cover', url/.test(lib), 'משיכת פרטים וכריכות — רק דרך השרתון');
ok(/if \(coverJob\) \{ save\.disabled = true; await Promise\.race/.test(lib), 'שמירה מחכה לכריכה מהרשת שעוד בדרך');
['edTitleT', 'edFetch', 'edSave', 'libHideQ', 'libHidden', 'srcNli', 'edCoverOnly', 'edAuthorSort'].forEach((k) => {
  ok((app.match(new RegExp('\\b' + k + ': \'', 'g')) || []).length >= 2, 'מחרוזת ' + k + ' בעברית ובאנגלית');
});
console.log('# ' + n + ' בדיקות עברו');
