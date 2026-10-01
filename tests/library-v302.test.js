// v302 — האקדמיה, שלב 1: הספרייה והקורא (library.js) — פונקציות טהורות, עיצוב הספר, אבטחה ושילוב באפליקציה
const fs = require('fs');
const path = require('path');
const vm = require('vm');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const lib = fs.readFileSync(path.join(root, 'library.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

// library.js הוא ES module שמייבא את המנוע (דורש DOM) — מריצים את הקוד בלי שורת ה־import
const src = lib.replace(/^import .*$/m, '').replace(/^export (async )?(function|const|let)/gm, '$1$2')
  + '\n;globalThis.__L = { bookYear, sortBooks, langText, contextFor, _test };';
const store = {};
const sb = { document: { baseURI: 'https://example.test/portfolio-pwa/' }, URL, localStorage: { getItem: (k) => store[k] || null, setItem: (k, v) => { store[k] = v; } }, console };
vm.createContext(sb);
vm.runInContext(src, sb, { filename: 'library.js' });
const L = sb.__L;

ok(L.bookYear('מכתב באפט 2023', '2024-02-24') === 2023, 'שנת המכתב מהכותרת (לא תאריך הפרסום)');
ok(L.bookYear('Annual Letter', '1999-03-01') === 1999 && L.bookYear('בלי שנה', '') === 0, 'בלי שנה בכותרת — מתאריך הפרסום; בלי כלום — 0');
const books = [{ title: 'א', year: 2021, lastRead: 5 }, { title: 'ב', year: 2023, lastRead: 1 }, { title: 'ג', year: 2022, lastRead: 9 }];
ok(L.sortBooks(books, 'new').map((b) => b.year).join() === '2023,2022,2021', 'מיון ברירת מחדל: לפי שנה מהחדש');
ok(L.sortBooks(books, 'old').map((b) => b.year).join() === '2021,2022,2023', 'מיון לפי שנה מהישן');
ok(L.sortBooks(books, 'recent').map((b) => b.year).join() === '2022,2021,2023', 'מיון: נקראו לאחרונה');
ok(L.langText({ he: 'באפט', en: 'Buffett' }) === 'באפט' && L.langText([{ name: 'A' }, 'B']) === 'A, B' && L.langText(null) === '', 'שמות/כותבים במבנים של המנוע');
const long = 'x '.repeat(2000) + 'THE MOAT' + ' y'.repeat(2000);
const ctx = L.contextFor('THE MOAT', long);
ok(ctx.length <= 1500 && ctx.includes('THE MOAT'), 'הקשר לתרגום: עד 1500 תווים וסביב הקטע שסומן');

L._test.setSettings({});
let css = L._test.bookCSS();
ok(/font-weight: 100 900/.test(css) && /"SNB Noto"/.test(css), 'הפונט המשתנה עם טווח משקלים (ברירת המחדל שלו Thin — חובה)');
ok(/html, body \{[^}]*font-weight: 400;/.test(css), 'עובי 1 = Regular (400), כמו בקינדל');
ok(/p, li, blockquote, dd \{[^}]*text-align: start;/.test(css), 'יישור לימין (לתחילת השורה) כברירת מחדל — באנגלית זה שמאל');
L._test.setSettings({ justify: true, weight: 2, theme: 'black', font: 'book' });
css = L._test.bookCSS();
ok(/p, li, blockquote, dd \{[^}]*text-align: justify;/.test(css) && /font-weight: 540/.test(css), 'יישור לשני הצדדים ועובי 3 לפי הבחירה');
ok(/html \{ background: #000000 !important; \}/.test(css) && /color: inherit !important/.test(css), 'ערכה שחורה: רקע הספר לא שקוף וצבעים קבועים של הקובץ נדרסים');
ok(!/font-family: "SNB Noto", sans-serif !important/.test(css), '"הגופן של הקובץ" — בלי דריסת גופן');

// אבטחה: סקריפט בתוך ספר חסום ע"י ה־CSP (המסמכים מ־blob יורשים אותו)
const csp = (html.match(/Content-Security-Policy" content="([^"]+)"/) || [])[1] || '';
const dir = (name) => (csp.split(';').map((x) => x.trim()).find((x) => x.startsWith(name + ' ')) || '');
ok(!/blob:|'unsafe-inline'|'unsafe-eval'/.test(dir('script-src')), 'CSP: אין blob/inline ב־script-src — סקריפט בספר לא ירוץ');
ok(/blob:/.test(dir('frame-src')) && /blob:/.test(dir('font-src')) && /blob:/.test(dir('style-src')), 'CSP: מסגרות, פונטים וסגנונות של הספר מ־blob');

// שילוב: שורה בתפריט + טעינה דינמית בלבד
ok(/id="menuLibraryBtn"/.test(html) && /import\('\.\/library\.js'\)\.then\(\(m\) => m\.openLibrary\(\)\)/.test(app), 'שורת "ספרייה" בתפריט טוענת את המודול רק בלחיצה');
ok(!/<script[^>]+library\.js/.test(html), 'library.js לא נטען בפתיחת האפליקציה');

// כל מחרוזת גלויה בעברית ובאנגלית
const keys = [...new Set([...lib.matchAll(/\bT\('([A-Za-z0-9]+)'/g)].map((m) => m[1]))];
const heBlock = app.slice(app.indexOf('const STRINGS'), app.indexOf('\nen: {'));
const enBlock = app.slice(app.indexOf('\nen: {'), app.indexOf('\nen: {') + 200000);
const missing = keys.filter((k) => !new RegExp('\\b' + k + ':').test(heBlock) || !new RegExp('\\b' + k + ':').test(enBlock));
ok(keys.length > 30 && !missing.length, 'כל ' + keys.length + ' המחרוזות של הספרייה קיימות בעברית ובאנגלית' + (missing.length ? ' (חסר: ' + missing + ')' : ''));

// המנוע והפונט — עם רישיון, בגרסה קבועה
ok(/^[0-9a-f]{40}\s*$/.test(fs.readFileSync(path.join(root, 'vendor/foliate-js/COMMIT'), 'utf8')) && /MIT License/.test(fs.readFileSync(path.join(root, 'vendor/foliate-js/LICENSE'), 'utf8')),
  'foliate-js מקובע לקומיט עם רישיון MIT');
ok(fs.existsSync(path.join(root, 'fonts/NotoSansHebrew-VF.woff2')) && /Open Font License/.test(fs.readFileSync(path.join(root, 'fonts/OFL.txt'), 'utf8')), 'הפונט עם רישיון OFL');
console.log('# ' + n + ' בדיקות עברו');
