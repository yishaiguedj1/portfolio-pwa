// מנהל הספרייה, ס׳1 (11/10/2026): הקטלוג של המדף המשותף — נרמול, פעולות, מבט קורא, הפרשים וביטול (lib/libcat.js, טהור).
// הרצה: node tests/libcat.test.js
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const C = require('../ibkr-proxy/lib/libcat.js');
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; console.log('ok - ' + m); };
const T0 = Date.UTC(2026, 9, 11, 10);

/* 1. השדות זהים לעורך בטלפון (EDIT_FIELDS) — כך הטלפון מחיל את הקטלוג כמו עריכה רגילה */
const lib = fs.readFileSync(path.join(__dirname, '..', 'library.js'), 'utf8');
const ef = JSON.parse(lib.match(/export const EDIT_FIELDS = (\[[^\]]+\])/)[1].replace(/'/g, '"'));
ok(JSON.stringify(ef) === JSON.stringify(C.FIELDS), 'השדות = EDIT_FIELDS ב־library.js, באותו סדר');

/* 2. נרמול */
const b0 = C.normBook({ id: 'id-urn:uuid:1', title: '  מכתב ‫באפט‬ 2023 ', author: 'וורן באפט', date: '2024-02-24', lang: 'he',
  seriesIdx: '007', tags: 'השקעות, השקעות, מכתבים,  ', desc: '<p>שורה</p>\n\n\n\nשתיים', isbn: '978-965-x-<b>', st: 'zzz',
  files: [{ fmt: 'epub', md5: 'A'.repeat(32), size: 1000 }, { fmt: 'pdf', md5: 'b'.repeat(32), size: 5 }], cover: { h: 'c'.repeat(20), r: 9, bg: '#ABCDEF' },
  lock: ['title', 'bogus'], prov: { title: 'nli', x: 'user', author: 'evil' }, legacy: { driveId: 'LETTER000001' }, __proto__x: 1 });
ok(b0.title === 'מכתב באפט 2023' && b0.seriesIdx === '7' && b0.tags === 'השקעות, מכתבים', 'שדות: רווחים, סימני כיווניות, אפסים מובילים, תגיות בלי כפולים');
ok(b0.desc === 'שורה \n\nשתיים' && b0.isbn === '978-965-x-' && b0.st === 'draft', 'תקציר בלי HTML ובלי שורות ריקות מרובות; מצב לא מוכר = טיוטה');
ok(b0.files.length === 1 && b0.files[0].md5 === 'a'.repeat(32) && b0.cover.r === 0.667 && b0.cover.bg === '#abcdef', 'קבצים: רק פורמט מוכר ו־md5 תקין; כריכה עם יחס סביר');
ok(JSON.stringify(b0.lock) === '["title"]' && JSON.stringify(b0.prov) === '{"title":"nli"}' && b0.legacy.driveId === 'LETTER000001', 'נעילות, מקורות ומיפוי ישן — רק ערכים מוכרים');
ok(C.normBook({ id: '__proto__', title: 'x' }) === null && C.normBook({ id: 'ab' }) === null && C.normBook({ id: 'a\nbc' }) === null, 'מזהה לא תקין = נדחה (כולל __proto__)');
ok(C.normField('date', '2024-2-1') === '' && C.normField('lang', 'עברית') === '' && C.normField('seriesIdx', '1.25') === '1.25', 'תאריך / שפה / מספר בסדרה — רק בצורה תקינה');

/* 3. קטלוג + פעולות */
let cat = C.emptyCatalog();
const add = (book) => C.applyOps(cat, [{ op: 'add', book }], { now: T0, by: 'admin@example.com', internal: true });
assert.throws(() => C.applyOps(cat, [{ op: 'add', book: { id: 'id-x1' } }], { now: T0 }), /bad_op/, 'הוספה רק מהשרתון');
n++; console.log('ok - הוספה ישירה מהטלפון (בלי internal) נדחית');
const F = (c) => ({ fmt: 'epub', md5: c.repeat(32), size: 1200 });
for (const [i, y] of [[1, 2021], [2, 2022], [3, 2023]]) {
  const r = add({ id: 'id-letter-' + y, title: 'מכתב באפט ' + y, author: 'וורן באפט', files: [F(String(i))], st: 'pub' });
  cat = r.cat;
}
ok(cat.v === 3 && Object.keys(cat.books).length === 3 && cat.hist.length === 3 && cat.hist[2].inv['id-letter-2023']._new === 1, 'שלוש הוספות = שלוש גרסאות, כל אחת עם "חדש" לביטול');

let r = C.applyOps(cat, [{ op: 'set', id: 'id-letter-2023', f: { title: 'מכתב 2023', desc: 'תקציר' } }], { now: T0 + 1, by: 'a' });
ok(r.n === 1 && r.cat.books['id-letter-2023'].title === 'מכתב 2023' && r.cat.books['id-letter-2023'].lock.includes('title') && r.cat.books['id-letter-2023'].prov.title === 'user', 'עריכה ביד: נשמר, ננעל, מקור "user"');
ok(r.cat.books['id-letter-2023'].updated === T0 + 1 && r.cat.books['id-letter-2023'].mt.desc === T0 + 1, 'עריכה מעדכנת זמנים לשדה ולספר');
const unchanged = C.applyOps(r.cat, [{ op: 'set', id: 'id-letter-2023', f: { title: 'מכתב 2023' } }], { now: T0 + 2 });
ok(unchanged.n === 0 && unchanged.cat === r.cat, 'בלי שינוי — בלי גרסה חדשה');
const cf = C.applyOps(r.cat, [{ op: 'set', id: 'id-letter-2023', f: { title: 'שלי' }, pv: { title: 'מה שראיתי' } }], { now: T0 + 3 });
ok(cf.conflicts.length === 1 && cf.conflicts[0].theirs === 'מכתב 2023' && cf.cat.books['id-letter-2023'].title === 'שלי', 'התנגשות: מדווחת, והעריכה האחרונה מנצחת');
const sug = C.applyOps(r.cat, [{ op: 'set', id: 'id-letter-2022', f: { pub: 'ברקשייר' }, src: 'nli' }], { now: T0 + 3 });
ok(sug.cat.books['id-letter-2022'].prov.pub === 'nli' && !(sug.cat.books['id-letter-2022'].lock || []).includes('pub'), 'הצעה ממאגר: מקור נשמר, בלי נעילה');
cat = r.cat;

/* עריכה מרובה */
r = C.applyOps(cat, [{ op: 'bulk', ids: ['id-letter-2021', 'id-letter-2022', 'id-letter-2023'], f: { series: 'מכתבי באפט', title: 'לא!' }, tagsAdd: ['מכתבים', 'השקעות'], num: { start: 2021, step: 1 } }], { now: T0 + 10, by: 'a' });
const bs = ['id-letter-2021', 'id-letter-2022', 'id-letter-2023'].map((id) => r.cat.books[id]);
ok(bs.every((b) => b.series === 'מכתבי באפט' && b.tags === 'מכתבים, השקעות') && bs.map((b) => b.seriesIdx).join() === '2021,2022,2023', 'מרובה: סדרה, תגיות ומספור לפי הסדר שנבחר');
ok(bs[2].title === 'מכתב 2023', 'מרובה: הכותר לא נערך (לפי ת־קורא)');
const rm = C.applyOps(r.cat, [{ op: 'bulk', ids: ['id-letter-2021'], tagsRm: ['השקעות'], clear: ['series'] }], { now: T0 + 11 });
ok(rm.cat.books['id-letter-2021'].tags === 'מכתבים' && !rm.cat.books['id-letter-2021'].series, 'מרובה: הסרת תגית וניקוי שדה');
assert.throws(() => C.applyOps(r.cat, [{ op: 'bulk', ids: ['id-letter-2021'] }], { now: 1 }), /bad_op/); n++; console.log('ok - מרובה בלי שום שינוי = שגיאה');
cat = r.cat;

/* מבט קורא והפרשים */
r = C.applyOps(cat, [{ op: 'state', ids: ['id-letter-2021'], st: 'draft' }], { now: T0 + 20 });
const pv = C.pubView(r.cat);
ok(!pv.books['id-letter-2021'] && pv.books['id-letter-2022'] && !('lock' in pv.books['id-letter-2022']) && !('prov' in pv.books['id-letter-2022']), 'מבט קורא: בלי טיוטות, בלי נעילות ומקורות');
const d = C.delta(r.cat, cat.v);
ok(d && d.up.length === 0 && d.rm.length === 1 && d.rm[0].id === 'id-letter-2021', 'הפרש: ספר שחזר לטיוטה = הסרה אצל הקורא');
ok(C.delta(r.cat, r.cat.v).same && C.delta(r.cat, 0) && C.delta(r.cat, r.cat.v + 1) === null, 'הפרש: אותה גרסה = "אין שינוי"; גרסה מהעתיד = תמונה מלאה');
cat = r.cat;

/* מחיקה רכה, מיזוג, ביטול */
r = C.applyOps(cat, [{ op: 'merge', keep: 'id-letter-2022', drop: 'id-letter-2023' }], { now: T0 + 30 });
const kept = r.cat.books['id-letter-2022'], dropped = r.cat.books['id-letter-2023'];
ok(kept.desc === 'תקציר' && dropped.del === T0 + 30 && dropped.to === 'id-letter-2022', 'מיזוג: השדות החסרים עוברים, השני לסל עם הפניה');
const d2 = C.delta(r.cat, cat.v);
ok(d2.rm.some((x) => x.id === 'id-letter-2023' && x.to === 'id-letter-2022'), 'הפרש: הקורא יודע להעביר התקדמות למזהה שנשאר');
const u = C.undo(r.cat, r.cat.v, { now: T0 + 31 });
ok(!u.cat.books['id-letter-2023'].del && !u.cat.books['id-letter-2023'].to && !u.cat.books['id-letter-2022'].desc && u.skipped.length === 0, 'ביטול מחזיר את שני הספרים');
const u2 = C.undo(u.cat, u.cat.v, { now: T0 + 32 });
ok(u2.cat.books['id-letter-2023'].del === T0 + 30, 'ביטול של ביטול = חזרה');
/* ספר ששונה אחרי הגרסה — לא מוחזר */
const later = C.applyOps(r.cat, [{ op: 'set', id: 'id-letter-2022', f: { pub: 'X' } }], { now: T0 + 40 });
const u3 = C.undo(later.cat, r.cat.v, { now: T0 + 41 });
ok(u3.skipped.includes('id-letter-2022') && !u3.cat.books['id-letter-2023'].del, 'ביטול מדלג על ספר ששונה אחר כך ומחזיר את השאר');
assert.throws(() => C.undo(cat, 999, { now: 1 }), /no_version/); n++; console.log('ok - ביטול של גרסה שלא קיימת = שגיאה');

/* מחיקה ושחזור, מחיקה לצמיתות רק מהסל */
r = C.applyOps(cat, [{ op: 'purge', ids: ['id-letter-2022'] }], { now: T0 + 50 });
ok(r.n === 0 && r.cat.books['id-letter-2022'], 'מחיקה לצמיתות של ספר שלא בסל — לא קורה');
r = C.applyOps(cat, [{ op: 'del', ids: ['id-letter-2022'] }, { op: 'purge', ids: ['id-letter-2022'] }], { now: T0 + 50 });
ok(!r.cat.books['id-letter-2022'] && r.cat.hist[r.cat.hist.length - 1].inv['id-letter-2022']._book, 'סל ואז מחיקה לצמיתות — עם עותק לביטול');
const back = C.undo(r.cat, r.cat.v, { now: T0 + 51 });
ok(back.cat.books['id-letter-2022'] && back.cat.books['id-letter-2022'].title === 'מכתב באפט 2022', 'ביטול מחיקה לצמיתות מחזיר את הספר');

/* שינוי שם בכל הספרייה */
r = C.applyOps(cat, [{ op: 'rename', k: 'author', from: 'וורן באפט', to: 'Warren Buffett' }, { op: 'rename', k: 'tag', from: 'השקעות', to: 'מכתבים' }], { now: T0 + 60 });
ok(Object.values(r.cat.books).every((b) => b.author === 'Warren Buffett') && r.cat.books['id-letter-2022'].tags === 'מכתבים', 'שינוי שם: מחבר בכל הספרים; תגית לתגית קיימת = מיזוג');
ok(r.cat.hist[r.cat.hist.length - 1].all === 1 && C.delta(r.cat, cat.v) === null, 'שינוי בכל הספרייה = הקורא מקבל תמונה מלאה');

/* פעולות פנימיות: קובץ חדש וכריכה */
r = C.applyOps(cat, [{ op: 'file', id: 'id-letter-2022', file: F('e') }], { now: T0 + 70, internal: true });
ok(r.cat.books['id-letter-2022'].files[0].md5 === 'e'.repeat(32) && r.cat.books['id-letter-2022'].prev[0].md5 === '2'.repeat(32), 'קובץ חדש: הקודם נשמר לביטול');
r = C.applyOps(cat, [{ op: 'cover', id: 'id-letter-2022', cover: { h: 'f'.repeat(16), r: 0.66 }, src: 'file' }], { now: T0 + 71, internal: true });
ok(r.cat.books['id-letter-2022'].cover.h === 'f'.repeat(16) && r.cat.books['id-letter-2022'].prov.cover === 'file', 'כריכה עם מקור');
assert.throws(() => C.applyOps(cat, [{ op: 'cover', id: 'id-letter-2022', cover: null }], { now: 1 }), /bad_op/); n++; console.log('ok - כריכה — רק מהשרתון');

/* קטלוג פגום חלקית לא מפיל */
const nc = C.normCatalog({ v: 5, books: { 'id-good': { title: 'x' }, '__proto__': { title: 'y' }, 'z': { title: 'q' } }, hist: [{ v: 5, ids: ['id-good'], inv: {} }], rids: { 'abcdef12': 5, 'bad id': 1 } });
ok(Object.keys(nc.books).join() === 'id-good' && nc.hist.length === 1 && Object.keys(nc.rids).join() === 'abcdef12', 'קטלוג פגום חלקית: רק הרשומות התקינות');

/* 4. זיהוי סוג לפי תוכן */
const zipHead = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(26), Buffer.from('mimetypeapplication/epub+zip')]);
const mobi = Buffer.concat([Buffer.alloc(60), Buffer.from('BOOKMOBI'), Buffer.alloc(20)]);
ok(C.sniff(zipHead) === 'epub' && C.sniff(mobi) === 'mobi' && C.sniff(Buffer.from('<?xml version="1.0"?><FictionBook>')) === 'fb2' && C.sniff(Buffer.from('%PDF-1.7 xxxxx')) === 'pdf', 'זיהוי: EPUB, MOBI/AZW3, FB2, PDF');
ok(C.fmtMatches('azw3', 'mobi') && !C.fmtMatches('epub', 'mobi') && !C.fmtMatches('epub', 'zip'), 'הסיומת חייבת להתאים לתוכן');
ok(C.KEYS.file({ fmt: 'epub', md5: 'a'.repeat(32) }) === 'lib/v2/f/' + 'a'.repeat(32) + '.epub' && C.KEYS.file({ fmt: 'exe', md5: 'a'.repeat(32) }) === '' && C.KEYS.tmp('../x') === '', 'מפתחות R2 — רק מערכים תקינים');

/* 5. יומן: גבולות */
let big = C.emptyCatalog();
for (let i = 0; i < 230; i++) big = C.applyOps(big, [{ op: 'add', book: { id: 'id-b' + i, title: 'ספר ' + i } }], { now: T0 + i, internal: true }).cat;
ok(big.hist.length === C.HIST_MAX && big.hist.filter((h) => h.inv).length === C.INV_KEEP, 'יומן: עד 200 גרסאות, ערכים קודמים רק ל־40 האחרונות');

console.log('# ' + n + ' בדיקות עברו');
