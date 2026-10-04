// v320: "מדף ספרים" — אסופות (כמו אלבומים באייפון): אוטומטיות + שלי, בשתי הספריות
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const lib = fs.readFileSync(path.join(root, 'library.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'library.css'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const grab = (name) => lib.match(new RegExp('export function ' + name + '[\\s\\S]*?\\n}\\n'))[0].replace('export ', '');
const F = new Function(grab('mergeColls') + grab('autoColls') + 'return { mergeColls, autoColls };')();
// מיזוג מהענן: העדכון האחרון מנצח, כולל מחיקה
const loc = { a: { n: 'השקעות', b: ['1'], u: 5 }, b: { n: 'ישן', b: [], u: 1 } };
const m = F.mergeColls(loc, { a: { n: 'השקעות', b: ['1', '2'], u: 9 }, b: { n: 'ישן', b: [], u: 0, d: 1 }, c: { n: 'חדש', b: [], u: 3 } });
ok(m.a.b.length === 2 && !m.b.d && m.c.n === 'חדש', 'מיזוג אסופות: החדש מנצח, ישן לא דורס, אסופה ממכשיר אחר נוספת');
ok(F.mergeColls(loc, { a: { n: 'x', u: 1 } }) === null, 'בלי שינוי — null (בלי כתיבה מיותרת)');
// אוטומטיות
const isL = (b) => /באפט/.test(b.title);
const books = [
  { id: 'l1', title: 'מכתב באפט 1965', author: 'וורן א. באפט', year: 1965, done: true },
  { id: 'l2', title: 'מכתב באפט 1968', author: 'וורן א. באפט', year: 1968, fraction: 0.2, lastRead: 5 },
  { id: 'l3', title: 'מכתב באפט 1990', author: 'וורן א. באפט', year: 1990, series: 'מכתבי באפט', seriesIdx: '2' },
  { id: 'l4', title: 'מכתב באפט 1991', author: 'וורן א. באפט', year: 1991, series: 'מכתבי באפט', seriesIdx: '1' },
  { id: 'z1', title: 'מכתב בזוס 2020', author: 'ג׳ף בזוס', year: 2020 },
];
const a = F.autoColls(books, 'snb', isL);
const key = (k) => a.find((c) => c.key === k);
ok(key('reading').ids.join() === 'l2' && key('done').ids.join() === 'l1', 'אוטומטי: "בקריאה" ו"נקראו"');
ok(key('partnership').ids.join() === 'l1,l2', 'אוטומטי (THE SNOWBALL): שנות השותפות — מכתבי באפט עד 1969, לפי שנה');
ok(key('se:מכתבי באפט').ids.join() === 'l4,l3', 'אוטומטי: סדרה, לפי מספר בסדרה');
ok(key('au:וורן א. באפט') && !key('au:ג׳ף בזוס'), 'אוטומטי: כותב עם 2 ספרים לפחות');
ok(!F.autoColls(books, 'mine', isL).some((c) => c.key === 'partnership'), 'שנות השותפות — רק בספריית THE SNOWBALL');
// ממשק
ok(/const shelfChip = chip\(T\('colShelf'\), SHELF\);[\s\S]{0,200}chip\(T\('libAll'\), ''\);/.test(lib), 'הצ\'יפ "מדף ספרים" — לפני "הכל", בשתי הספריות');
ok(/if \(onShelf\) shelvesView\(home, listed\)/.test(lib) && /'lib-grid' \+ \(onShelf \? ' lib-only-q' : ''\)/.test(lib), 'במדף — כרטיסי אסופות; הרשת רק בחיפוש');
ok(/\.lib-home:not\(\.searching\) \.lib-only-q \{ display: none; \}/.test(css), 'חיפוש מתוך המדף מציג את הספרים שנמצאו');
ok(/\.col-stack \.c1 \{ order: 2/.test(css) && /\.col-card \{/.test(css), 'כרטיס אסופה עם שלוש כריכות בערימה');
ok(/function renderColl\(key\)/.test(lib) && /colAddBooks/.test(lib) && /function collNameSheet/.test(lib) && /function collDelete/.test(lib), 'דף אסופה: הוספת ספרים, שינוי שם ומחיקה');
ok(/\{ kind: 'coll', fn: \(\) => addToCollSheet\(b\) \}/.test(lib) && /a\.kind === 'coll' \? ICON_COLL/.test(app), 'לחיצה ארוכה על ספר — "הוספה לאסופה" ליד עריכה ומחיקה');
ok(/ref\.set\(\{ lib: \{ c: \{ \[id\]: c \} \} \}, \{ merge: true \}\)/.test(lib) && /mergeColls\(collAll\(\), lib\.c\)/.test(lib), 'האסופות נשמרות בענן ונמשכות במכשיר אחר');
ok(/'pwa_libcoll_v1'/.test(app.match(/const ACCOUNT_KEYS = \[[^\]]*\]/)[0]), 'מפתח האסופות ב־ACCOUNT_KEYS (הפרדת חשבונות)');
const keys = ['colReading', 'colDone', 'colPartnership'];
const he = app.slice(app.indexOf('he: {'), app.indexOf('en: {')), en = app.slice(app.indexOf('en: {'));
ok(keys.every((k) => new RegExp('\\b' + k + ':').test(he) && new RegExp('\\b' + k + ':').test(en)), 'שמות האסופות האוטומטיות — בעברית ובאנגלית');
console.log('# ' + n + ' בדיקות עברו');
