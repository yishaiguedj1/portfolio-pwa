// מחקר 06 (11/10/2026): epubkit.js — זיהוי סוג לפי תוכן, תיקון מיכל (דגל UTF‑8 לשמות בעברית), MD5 = ETag של R2,
// ושמירה על הכללים שלו תחת ה־CSP (בלי Worker מ־blob:, בלי fetch, בלי eval). הבדיקות המלאות (167, עם xmldom) — במחקר.
// קבצי הבדיקה ב־tests/fixtures/books — סינתטיים (נוצרו במחקר), לא קבצים של המשתמש.
// הרצה: node tests/epubkit.test.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert');
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; console.log('ok - ' + m); };
const root = path.join(__dirname, '..');
const FX = path.join(__dirname, 'fixtures/books');
const blob = (f) => new Blob([fs.readFileSync(path.join(FX, f))]);

(async () => {
  const EK = await import(path.join(root, 'epubkit.js'));
  const src = fs.readFileSync(path.join(root, 'epubkit.js'), 'utf8');

  /* 1. סוג לפי תוכן */
  const kinds = {};
  for (const f of ['he-plain.epub', 'e3-calibre-series.epub', 'calibre.mobi', 'test.fb2', 'test.pdf', 'drm-adobe.epub']) kinds[f] = await EK.classify(blob(f));
  ok(kinds['he-plain.epub'] === 'epub' && kinds['calibre.mobi'] === 'mobi' && kinds['test.fb2'] === 'fb2' && kinds['test.pdf'] === 'pdf', 'classify: EPUB / MOBI / FB2 / PDF — לפי התוכן, לא לפי הסיומת');
  const renamed = new Blob([fs.readFileSync(path.join(FX, 'test.pdf'))]);
  ok(await EK.classify(renamed) === 'pdf', 'PDF ששמו שונה ל־.epub — עדיין PDF');

  /* 2. דגל UTF‑8: בלי הדגל foliate לא פותח את הספר; התיקון מדליק אותו ולא נוגע בתוכן */
  const nf = blob('he-names-noflag.epub');
  const z0 = await EK.readZip(nf);
  const hebrew = z0.entries.filter((e) => /[^\x00-\x7f]/.test(e.name));
  ok(hebrew.length > 0 && hebrew.every((e) => !(e.flags & 0x800)), 'הקובץ: שמות בעברית בלי דגל UTF‑8');
  const fixed = await EK.rewriteZip(nf, z0);
  const z1 = await EK.readZip(fixed);
  ok(z1.entries.filter((e) => /[^\x00-\x7f]/.test(e.name)).every((e) => e.flags & 0x800) && z1.entries[0].name === 'mimetype' && z1.entries[0].method === 0, 'אחרי התיקון: הדגל דולק, mimetype ראשון ולא דחוס');
  for (const e of z0.entries) {
    if (e.name.endsWith('/')) continue;
    const a = await EK.readEntry(nf, e), b = await EK.readEntry(fixed, z1.byName.get(e.name));
    if (Buffer.compare(Buffer.from(a), Buffer.from(b))) { ok(false, 'תוכן השתנה: ' + e.name); }
  }
  ok(true, 'התוכן של כל רשומה זהה לבייט');

  /* 3. MD5 = ETag של R2 / md5Checksum של Drive */
  const big = crypto.randomBytes(2.5 * 1024 * 1024 | 0);
  ok(await EK.md5Blob(new Blob([big])) === crypto.createHash('md5').update(big).digest('hex'), 'md5Blob זהה ל־node (בחתיכות של 1MB)');

  /* 4. ISBN */
  ok(EK.normIsbn('978-0-306-40615-7') === '9780306406157', 'ISBN עם ספרת ביקורת (גם עם מקפים)');
  ok(EK.normIsbn('9780306406158') === '', 'ISBN עם ספרת ביקורת שגויה — נזרק');
  ok(EK.isbn10to13('0306406152') === '9780306406157', 'ISBN‑10 → ISBN‑13');

  /* 5. כללי ה־CSP */
  ok(!/new Worker\(|\bfetch\(|\beval\(|new Function\(/.test(src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')), 'בלי Worker, בלי fetch ובלי eval (ה־CSP של האפליקציה)');
  ok(!/^import /m.test(src), 'בלי ייבואים — עצמאי');

  /* 6. החיבור */
  const adm = fs.readFileSync(path.join(root, 'libadmin.js'), 'utf8');
  const lib = fs.readFileSync(path.join(root, 'library.js'), 'utf8');
  ok(/import\('\.\/epubkit\.js'\)/.test(adm) && /EK\.inspectEpub/.test(adm) && /EK\.repairEpub/.test(adm) && /EK\.readOpfMeta/.test(adm) && /EK\.mobiInfo/.test(adm) && /EK\.fb2Meta/.test(adm), 'libadmin: סוג, תקינות ו־DRM, תיקון, פרטים מה־OPF, MOBI ו־FB2');
  ok(/async function fixEpub/.test(lib) && /rep\.repair\.includes\('utf8_flag'\)/.test(lib) && /export function mobiStableId/.test(lib), 'library.js: גם ייבוא פרטי — תיקון השמות, חסימת DRM ומזהה MOBI יציב');
  ok(/md\.altIdentifier/.test(lib) && /Number\.isFinite\(ser\.position\)/.test(lib), 'fileDefaults: ISBN מ־altIdentifier, ובלי "NaN" בסדרה');
  console.log('# ' + n + ' בדיקות עברו');
})().catch((e) => { console.error('FAIL', e && e.message); process.exit(1); });
