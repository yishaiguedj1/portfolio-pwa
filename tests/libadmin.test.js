// מנהל הספרייה, ס׳4–ס׳5 (11/10/2026): libadmin.js — MD5 (זיהוי קובץ שכבר במדף), סינון וצ׳יפים, עריכה יחד (ריק = ללא שינוי),
// בדיקה לפני הוספה, רשומות המעבר מ־Drive, והחיבור מ־library.js. הרצה: node tests/libadmin.test.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert');
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; console.log('ok - ' + m); };
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'libadmin.js'), 'utf8');
const lib = fs.readFileSync(path.join(root, 'library.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

(async () => {
  const M = await import(path.join(root, 'libadmin.js'));
  const T0 = Date.UTC(2026, 9, 11, 12);

  /* 1. MD5 = ה־ETag של R2 */
  let bad = 0;
  for (const len of [0, 1, 55, 56, 63, 64, 65, 119, 120, 1000, 70000]) { const b = crypto.randomBytes(len); if (M.md5Hex(b) !== crypto.createHash('md5').update(b).digest('hex')) bad++; }
  const big = crypto.randomBytes(300007), m = new M.Md5();
  for (let o = 0; o < big.length;) { const s = 1 + Math.floor(Math.random() * 70000); m.update(big.subarray(o, o + s)); o += s; }
  ok(!bad && m.hex() === crypto.createHash('md5').update(big).digest('hex'), 'MD5 זהה ל־node בכל אורך, גם בחתיכות בגודל אקראי');
  const blob = new Blob([big]);
  ok(await M.md5File({ size: blob.size, slice: (a, b) => blob.slice(a, b) }) === crypto.createHash('md5').update(big).digest('hex'), 'md5File — בחתיכות, בלי לטעון את כל הקובץ');

  /* 2. סינון וצ׳יפים */
  const B = (id, o) => Object.assign({ id, title: 'ספר ' + id, author: 'מחבר', lang: 'he', st: 'pub', cover: { h: 'a'.repeat(32) }, added: T0 - 30 * 86400000, files: [{ fmt: 'epub', md5: id.padEnd(32, '0').slice(0, 32), size: 10 }] }, o || {});
  const books = [B('a1'), B('a2', { cover: null, st: 'draft', added: T0 - 3600e3 }), B('a3', { author: '', st: 'hide' }), B('a4', { del: T0 - 1000 }), B('a5', { title: 'מכתב באפט 1987', isbn: '9780000000001', series: 'מכתבי באפט' })];
  const c = M.mgCounts(books, T0);
  ok(c.all === 4 && c.attn === 2 && c.nocover === 1 && c.recent === 1 && c.draft === 1 && c.hide === 1 && c.trash === 1, 'מונים: הכל בלי הסל, לטיפול = בלי כריכה או בלי מחבר');
  ok(M.mgFilter(books, 'trash', '', T0).map((b) => b.id).join() === 'a4' && !M.mgFilter(books, 'all', '', T0).some((b) => b.del), 'הסל רק בצ׳יפ שלו');
  ok(M.mgFilter(books, 'all', 'באפט 1987', T0).map((b) => b.id).join() === 'a5' && M.mgFilter(books, 'all', '9780000000001', T0).length === 1 && M.mgFilter(books, 'all', 'מכתבי', T0).length === 1, 'חיפוש: כותר, ISBN, סדרה; כמה מילים = כולן');
  ok(M.mgSort([B('x', { title: 'מכתב 1990' }), B('y', { title: 'מכתב 2001' }), B('z', { title: 'בלי שנה' })]).map((b) => b.id).join() === 'y,x,z', 'מיון: שנה מהחדש, ואז כותר');

  /* 3. עריכה יחד */
  const v = M.bulkView([B('b1', { author: 'וורן באפט', pub: 'ברקשייר', tags: 'מכתבים, השקעות' }), B('b2', { author: 'וורן באפט', pub: 'אחר', tags: 'מכתבים' }), B('b3', { author: '', pub: '', tags: 'מכתבים' })]);
  ok(v.f.author.v === 'וורן באפט' && v.f.author.miss === 1 && v.f.pub.n === 2 && v.f.pub.v === '' && v.tags[0].t === 'מכתבים' && v.tags[0].all && v.tags[1].c === 1, 'תצוגה: ערך זהה + חסר ב־1, ערך מעורב, תגית בכולם / בחלק');
  ok(!M.bulkOps(['b1', 'b2'], { f: { author: '   ', pub: '' }, clear: [], tagsAdd: [], tagsRm: [] }).length, 'ריק = ללא שינוי (לא מוחק — מלכודת Airtable)');
  const ops = M.bulkOps(['b1', 'b2'], { f: { series: 'מכתבי באפט', title: 'לא', isbn: '1' }, clear: ['pub'], tagsAdd: ['חדש'], tagsRm: ['השקעות'], num: { start: 1965, step: 1 } });
  ok(ops.length === 1 && ops[0].f.series === 'מכתבי באפט' && !('title' in ops[0].f) && !('isbn' in ops[0].f) && ops[0].clear.join() === 'pub' && ops[0].num.start === 1965 && ops[0].tagsAdd[0] === 'חדש', 'פעולה אחת: רק שדות משותפים, ניקוי מפורש, תגיות, מספור');
  ok(M.bulkOps(['b1'], { f: {}, num: 'clear' })[0].clear.join() === 'seriesIdx', 'ניקוי המספור');
  ok(M.bulkSummary({ f: { author: 'x' }, clear: ['lang'], num: 'clear', tagsAdd: ['a'], tagsRm: [] }).fields.join() === 'author,lang,seriesIdx', 'שורת הסיכום');

  /* 4. בדיקה לפני הוספה */
  const cat = [B('id-urn:1', { title: 'המשקיע הנבון', author: 'בנג׳מין גרהם', files: [{ fmt: 'epub', md5: 'f'.repeat(32), size: 1 }], prev: [{ fmt: 'epub', md5: 'e'.repeat(32), size: 1 }] })];
  const items = M.classify([
    { k: 0, ext: 'epub', id: 'id-urn:9', md5: '1'.repeat(32), title: 'חדש', author: 'א' },
    { k: 1, ext: 'epub', id: 'id-urn:8', md5: 'f'.repeat(32), title: 'x' },
    { k: 2, ext: 'epub', id: 'id-urn:7', md5: 'e'.repeat(32), title: 'x' },
    { k: 3, ext: 'epub', id: 'id-urn:1', md5: '2'.repeat(32), title: 'מהדורה אחרת' },
    { k: 4, ext: 'azw3', id: 'f-abc', md5: '3'.repeat(32), title: 'המשקיע הנבון.', author: 'בנג׳מין גרהם' },
    { k: 5, ext: 'pdf' }, { k: 6, ext: 'epub', err: 'open' },
    { k: 7, ext: 'epub', id: 'id-urn:6', md5: '1'.repeat(32), title: 'חדש' },
  ], cat);
  ok(items.map((x) => x.g).join() === 'new,same,same,maybe,maybe,bad,bad,same', 'חדש / זהה (גם לגרסה קודמת, גם פעמיים באותה בחירה) / אולי (מזהה או כותר+מחבר) / לא נתמך');
  ok(items[3].like === 'id-urn:1' && items[4].like === 'id-urn:1' && items[0].on && items[3].on && !items[1].on, 'אולי — מסומן כברירת מחדל ומפנה לספר שבמדף; זהה — לא מסומן');
  ok(M.freshId('id-urn:1', new Set(['id-urn:1', 'id-urn:1~2'])) === 'id-urn:1~3' && M.freshId('id-x', new Set()) === 'id-x', '"להוסיף בכל זאת" — מזהה נגזר, לא דריסה');

  /* 5. המעבר מ־Drive */
  const local = [
    { id: 'id-urn:a', src: 'drive', driveId: 'D1', title: 'מכתב 1990', author: 'וורן באפט', lang: 'he', desc: 'תקציר', edit: { title: 'מכתב 1990', series: 'מכתבים' }, series: 'מכתבים' },
    { id: 'id-urn:b', src: 'drive', driveId: 'D2', title: '—', hidden: 1 },
    { id: 'mine1', src: 'mine', driveId: 'D3', title: 'פרטי' },
  ];
  const mi = M.migrateItems(local, [{ id: 'D1', name: 'a.epub' }, { id: 'D2', name: 'שם הקובץ.epub' }, { id: 'D3' }, { id: 'D4' }, { id: 'D5', c: 'id-done' }], false);
  ok(mi.items.length === 2 && mi.items[0].d === 'D1' && mi.items[0].book.id === 'id-urn:a' && mi.items[0].book.desc === 'תקציר' && mi.items[0].book.lock.join() === 'title,series', 'רשומה = המזהה המקומי + הפרטים שהמנהל רואה; שדות שנערכו — נעולים');
  ok(mi.items[1].book.title === 'שם הקובץ' && mi.items[1].book.st === 'pub' && M.migrateItems(local, [{ id: 'D2' }], true).items[0].book.st === 'hide', 'בלי כותר — שם הקובץ; מוסתר אצלי: לכולם רק כשבחרתי');
  ok(mi.nolocal.join() === 'D3,D4', 'ספר פרטי עם אותו driveId לא נחשב; מה שלא בטלפון — מדווח; מה שכבר עבר — מדולג');
  ok(M.chunk([1, 2, 3, 4, 5], 2).length === 3 && /^[a-z0-9]{16}$/.test(M.rid()) && M.etaText(50, 100, 60000) === 1, 'עזרים');

  /* 6. החיבור והכללים */
  ok(!/^import /m.test(src) && !/^\s*(document|window)\./m.test(src.split('export function createAdmin')[0]), 'בלי ייבואים ובלי DOM בטעינה (נבדק ב־node)');
  ok(/import\('\.\/libadmin\.js'\)/.test(lib) && /ui\.view\.mgr\) return renderMgr/.test(lib) && /goView\(\{ mgr: 'home' \}\)/.test(lib), 'library.js: נטען רק כשהמנהל פותח "ניהול"');
  ok(/x\.send\(blob\.slice\(0, blob\.size\)\)/.test(src) && /r2\\\.cloudflarestorage\\\.com/.test(src), 'העלאה ישירה ל־R2 בלי כותרת Content-Type; הורדות רק מכתובת של R2');
  const inner = [...src.matchAll(/\.innerHTML = ([^;]+);/g)].map((x) => x[1].trim());
  ok(inner.length >= 4 && inner.every((x) => /^(ic|ICON\.[a-z]+( \|\| '')?)$/.test(x)), 'innerHTML רק לסמלים קבועים — טקסט מבחוץ תמיד textContent');
  const keys = new Set([...src.matchAll(/'(mg[A-Z][A-Za-z0-9]*)'/g)].map((x) => x[1]).filter((k) => !/^mg(B|F|Q|NumStart|TagIn)$/.test(k)));
  const heBlock = app.slice(app.indexOf("mgTitle: 'ניהול'"), app.indexOf("mgTitle: 'Manage'"));
  const enBlock = app.slice(app.indexOf("mgTitle: 'Manage'"));
  const miss = [...keys].filter((k) => !new RegExp('\\b' + k + ':').test(heBlock) || !new RegExp('\\b' + k + ':').test(enBlock));
  ok(keys.size > 150 && !miss.length, 'כל ' + keys.size + ' המחרוזות בעברית ובאנגלית' + (miss.length ? ' (חסר: ' + miss.join(',') + ')' : ''));
  const css = fs.readFileSync(path.join(root, 'library.css'), 'utf8');
  const blk = css.slice(css.indexOf('מנהל הספרייה (ס׳4'));
  const badSel = [];
  for (const line of blk.split('\n')) { const mm = /^([^{}\s/@][^{]*)\{/.exec(line); if (!mm) continue; for (const sel of mm[1].split(',')) { const x = sel.trim(); if (/\.mg-/.test(x) && !/\.lib-root/.test(x)) badSel.push(x); } }
  ok(!badSel.length, 'CSS: כל כלל של המנהל מתחיל ב־.lib-root (אחרת ".lib-root button" דורס גודל וצבע)' + (badSel.length ? ': ' + badSel.join(', ') : ''));
  ok(!/\b(left|right)\s*:/.test(blk), 'CSS: רק כיוונים לוגיים');
  console.log('# ' + n + ' בדיקות עברו');
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
