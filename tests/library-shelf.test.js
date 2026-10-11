// מנהל הספרייה, ס׳3 (11/10/2026): הטלפון של הקורא מסנכרן את המדף המשותף מהקטלוג (כשהמקור R2) — shelfSyncPlan טהורה,
// והחיבור ב־syncDrive: קודם op:'cat' עם הגרסה השמורה, Drive רק כשהמקור עדיין Drive.
// הרצה: node tests/library-shelf.test.js
const fs = require('fs');
const path = require('path');
const assert = require('assert');
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; console.log('ok - ' + m); };
const lib = fs.readFileSync(path.join(__dirname, '..', 'library.js'), 'utf8');
const pick = (re) => lib.match(re)[0].replace(/^export /, '');
const src = [pick(/export const EDIT_FIELDS = [^\n]+/), pick(/export function catFields[^\n]+/), pick(/export const catSigOf = [^\n]+/),
  pick(/export function shelfSyncPlan[\s\S]*?\n}\n/)].join('\n');
const { shelfSyncPlan, catFields, catSigOf } = new Function(src + '; return { shelfSyncPlan, catFields, catSigOf };')();

const B = (id, md5, extra) => Object.assign({ id, title: 'מכתב ' + id, author: 'וורן באפט', files: [{ fmt: 'epub', md5, size: 100 }] }, extra || {});
const L = (id, md5, extra) => Object.assign({ id, md5, src: 'drive', title: 'x' }, extra || {});

/* תמונה מלאה */
const full = { v: 7, full: { books: { a: B('a', '1'.repeat(32)), b: B('b', '2'.repeat(32)), c: B('c', '3'.repeat(32), { cover: { h: 'f'.repeat(32), r: 0.66 } }), d: B('d', '4'.repeat(32)) } } };
const local = [
  L('a', '1'.repeat(32), { catSig: catSigOf(full.full.books.a) }),   // זהה — כלום
  L('b', '9'.repeat(32)),                                                // קובץ אחר — להוריד
  L('c', '3'.repeat(32), { catSig: 'old' }),                             // רק פרטים/כריכה
  L('d', '4'.repeat(32), { hidden: 1 }),                                  // הוסתר אצלי — לא יורד
  L('gone', '5'.repeat(32)),                                              // לא בקטלוג — להסיר
  { id: 'mine1', src: 'mine', md5: '' },                                  // ספר פרטי — לא נוגעים
];
let p = shelfSyncPlan(local, full);
ok(p.fetch.map((b) => b.id).join() === 'b', 'מלא: מורידים רק ספר חדש או קובץ שהשתנה');
ok(p.meta.map((b) => b.id).join() === 'c', 'מלא: פרטים/כריכה שהשתנו — בלי הורדה');
ok(p.remove.map((b) => b.id).join() === 'gone', 'מלא: מה שירד מהקטלוג — מוסר; ספר פרטי ומוסתר — לא');
p = shelfSyncPlan([], full);
ok(p.fetch.length === 4 && !p.meta.length && !p.remove.length, 'טלפון חדש: הכל יורד');

/* הפרש */
p = shelfSyncPlan(local, { v: 8, up: [B('e', '6'.repeat(32)), B('a', '1'.repeat(32), { title: 'כותר חדש' })], rm: [{ id: 'b' }, { id: 'nope' }] });
ok(p.fetch.map((b) => b.id).join() === 'e' && p.meta.map((b) => b.id).join() === 'a', 'הפרש: חדש יורד, שינוי כותר = פרטים בלבד');
ok(p.remove.map((b) => b.id).join() === 'b', 'הפרש: הסרה רק למה שהוסר (ולא כל מה שלא ברשימה)');
ok(!shelfSyncPlan(local, { v: 8, up: [B('x', '7'.repeat(32), { files: [] })], rm: [] }).fetch.length, 'ספר בלי קובץ — מדולג');

/* הפרטים מהקטלוג */
const cf = catFields({ title: 'ת', tags: 'א, ב', isbn: 5 });
ok(Object.keys(cf).length === 12 && cf.title === 'ת' && cf.tags === 'א, ב' && cf.isbn === '' && cf.desc === '', '12 השדות, מחרוזות בלבד (ריק = ריק — הקטלוג קובע)');
ok(catSigOf(B('a', '1'.repeat(32))) !== catSigOf(B('a', '1'.repeat(32), { cover: { h: 'a'.repeat(32) } })), 'החתימה כוללת את הכריכה');

/* החיבור ב־library.js */
ok(/op: 'cat', idToken: tk, have: fresh \? -1 : st\.v/.test(lib) && /cj\.src === 'r2'/.test(lib), 'syncDrive שואל קודם את הקטלוג, עם הגרסה השמורה');
ok(/drv\.some\(\(b\) => !b\.md5 && !b\.hidden\)/.test(lib) && /st\.n !== drv\.length/.test(lib), 'ניקוי/החזרת מוסתר → תמונה מלאה (לא "אין שינוי")');
ok(/if \(!failed\) \{[\s\S]{0,200}LS_CATV/.test(lib), 'הגרסה נשמרת רק כשהכל ירד');
ok(/if \(rec\.cat\) \{ applyEdit\(rec, rec\.cat\); if \(rec\.edit\) applyEdit\(rec, rec\.edit\); \}/.test(lib), 'בייבוא: הקטלוג גובר על הקובץ, עריכה אישית — על שניהם');
ok(/R2_URL\.test\(String\(url \|\| ''\)\) \? await fetch\(url\)/.test(lib), 'מורידים רק מכתובת של R2');
ok(/id: b\.driveId \|\| b\.id/.test(lib), 'ניתוח AI גם לספר שאין לו driveId');

console.log('# ' + n + ' בדיקות עברו');
