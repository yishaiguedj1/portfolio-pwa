// Academy Pro, גל 4 (03/11/2026): ניהול וקורא — שפת חיפוש, מיון עברי, כתיב מלא/חסר, סטטיסטיקות (library.js)
// ו־libpro.js (דפדפן תגיות, ספרים דומים, ייצוא הדגשות, חיפוש מתקדם בספר), והחיבור. הרצה: node tests/academy-pro4.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const lib = read('library.js'), app = read('app.js'), pro = read('libpro.js'), css = read('library.css');

// library.js — בלי ה־import (המנוע דורש DOM), כמו ב־library-v302
const acad = read('academy-data.js'), bk = read('libbackup.js').replace(/^export (async )?(function|const|let)/gm, '$1$2');
const src = acad.replace(/^export const/gm, 'const') + '\n' + bk + '\n' + lib.replace(/^import .*$/mg, '').replace(/^export (async )?(function|const|let)/gm, '$1$2')
  + '\n;globalThis.__L = { sortBooks, titleSortKey, authorSortKey, parseQuery, matchQuery, quoteVal, pleneKey, pleneFind, ftFind, statsAdd, statsFinish, normSettings };';
const store = {};
const sb = { document: { baseURI: 'https://example.test/' }, URL, localStorage: { getItem: (k) => store[k] || null, setItem: (k, v) => { store[k] = v; } }, console };
vm.createContext(sb); vm.runInContext(src, sb, { filename: 'library.js' });
const L = sb.__L;

(async () => {
  /* D7: מיון עברי */
  ok(L.titleSortKey('הספר הגדול') === 'ספר הגדול' && L.titleSortKey('The Hobbit') === 'hobbit' && L.titleSortKey('"ציטוט"').startsWith('ציטוט'), 'שם למיון: בלי ה׳ הידיעה / The / מרכאות');
  ok(L.titleSortKey('הר') === 'הר', 'מילה קצרה — ה׳ נשארת (הר, לא ר)');
  ok(L.authorSortKey({ author: 'עמוס עוז' }) === 'עוז עמוס' && L.authorSortKey({ author: 'X', authorSort: 'Y' }) === 'y', 'מחבר למיון: שם משפחה קודם, authorSort גובר');
  const bs = [{ id: 1, title: 'הנסיך הקטן', author: 'אנטואן דה סנט-אכזופרי' }, { id: 2, title: 'אלף לילה', author: 'אנונימי' }, { id: 3, title: 'בית', author: 'אבי ביטון', series: 'ס', seriesIdx: 2 }, { id: 4, title: 'גן', series: 'ס', seriesIdx: 1 }];
  ok(L.sortBooks(bs, 'title').map((b) => b.id).join() === '2,3,4,1', 'לפי שם: א־ב עברי, "הנסיך" תחת נ');
  ok(L.sortBooks(bs, 'series').map((b) => b.id).slice(0, 2).join() === '4,3', 'לפי סדרה: לפי המספר בסדרה, בלי סדרה בסוף');
  ok(L.sortBooks(bs, 'author').map((b) => b.id).join() === '2,3,1,4', 'לפי מחבר: לפי שם משפחה, בלי מחבר בסוף');

  /* D2: שפת חיפוש */
  let P = L.parseQuery('מחבר:"עמוס עוז" -תגית:רומן שנה:1990..2000 אהבה');
  ok(P.text === 'אהבה' && P.terms.length === 3, 'שאילתה: שדות + טקסט חופשי');
  ok(P.terms[0].k === 'author' && P.terms[0].v === 'עמוס עוז' && P.terms[1].neg && P.terms[1].k === 'tag' && P.terms[2].a === 1990 && P.terms[2].b === 2000, 'שאילתה: מרכאות, שלילה וטווח שנים');
  P = L.parseQuery('year:>=2001 read:no');
  ok(P.terms[0].a === 2001 && P.terms[0].b > 3000 && P.terms[1].k === 'read', 'שאילתה באנגלית + שנה מ־');
  const b1 = { title: 'סיפור על אהבה וחושך', author: 'עמוס עוז', tags: 'ממואר, ישראל', year: 2002, done: true, ann: [{ id: 'a', x: 'שורה', c: 'x' }] };
  ok(L.matchQuery(b1, L.parseQuery('מחבר:עוז תגית:ממואר').terms) && !L.matchQuery(b1, L.parseQuery('-תגית:ממואר').terms), 'התאמה: תגית / שלילה');
  ok(L.matchQuery(b1, L.parseQuery('נקרא:כן הדגשות:כן').terms, (b) => b.ann) && !L.matchQuery(b1, L.parseQuery('נקרא:לא').terms), 'התאמה: מצב קריאה והדגשות');
  ok(L.matchQuery(b1, L.parseQuery('שנה:2000..2009').terms) && !L.matchQuery(b1, L.parseQuery('שנה:<2000').terms), 'התאמה: שנה בטווח');
  ok(L.quoteVal('עמוס עוז') === '"עמוס עוז"' && L.quoteVal('רומן') === 'רומן', 'ערך עם רווח — במרכאות');

  /* H5: כתיב מלא/חסר */
  ok(L.pleneKey('שולחן') === L.pleneKey('שלחן') && L.pleneKey('מילון') === L.pleneKey('מלון'), 'מפתח כתיב: ו/י באמצע מילה');
  const hits = L.pleneFind('על השלחן היה ספר', 'שולחן', 5);
  ok(hits.length === 1 && hits[0].loose, 'כתיב חסר נמצא כשמחפשים בכתיב מלא (מסומן "קרוב")');

  /* E12: רישום זמן */
  const NOW = new Date(2026, 10, 3, 21, 30).getTime();
  let st = L.statsAdd({}, 120000, NOW); st = L.statsAdd(st, 60000, NOW);
  ok(Object.values(st.d)[0] === 3 && st.h.length === 168 && st.h[new Date(NOW).getDay() * 24 + 21] === 3, 'סטטיסטיקה: דקות ליום ותא בשבוע×שעה');
  st = L.statsFinish(st, 'b1', NOW); st = L.statsFinish(st, 'b1', NOW + 5);
  ok(st.f.b1 === NOW, 'סיום ספר נרשם פעם אחת');
  ok(L.normSettings({}).study === false && L.normSettings({}).eink === false, 'הגדרות: מצב עיון ומסך דיו כבויים כברירת מחדל');

  /* libpro.js — טהורות */
  const X = await import(path.join(root, 'libpro.js'));
  const books = [
    { id: 'a', title: 'א', author: 'דן', tags: 'היסטוריה, יוון', series: 'עולם', pub: 'עם עובד', lang: 'he', year: 1994, done: true },
    { id: 'b', title: 'ב', author: 'דן', tags: 'היסטוריה', series: 'עולם', lang: 'he', year: 1999, fraction: 0.4 },
    { id: 'c', title: 'ג', author: 'רות', tags: 'יוון', lang: 'en', year: 2011 },
    { id: 'd', title: 'ד', author: 'נעם', tags: 'בישול', lang: 'he' },
  ];
  const F = X.facets(books, (b) => b.id === 'a' ? [1] : []);
  ok(F.author[0][0] === 'דן' && F.author[0][1] === 2 && F.tag.find((x) => x[0] === 'היסטוריה')[1] === 2, 'דפדפן: מחברים ותגיות עם מספרים');
  ok(F.year[0][0] === 2010 && F.year.find((x) => x[0] === 1990)[1] === 2 && F.read.length === 3 && F.hl[0][1] === 1, 'דפדפן: עשורים, מצב קריאה והדגשות');
  const kw = new Map([['a', X.keywords('פילוסופיה יוונית עתיקה פילוסופיה יוונית סוקרטס סוקרטס אפלטון אפלטון')], ['c', X.keywords('פילוסופיה פילוסופיה סוקרטס סוקרטס אפלטון אפלטון')], ['d', X.keywords('מתכון מתכון עוגה עוגה')]]);
  ok(kw.get('a').has('פילוסופיה') && !kw.get('a').has('של'), 'מילות מפתח: מילים חוזרות, בלי מילות קישור');
  const sim = X.similarBooks(books[0], books, kw);
  ok(sim[0].b.id === 'b' && sim[0].why === 'series' && sim.some((x) => x.b.id === 'c') && !sim.some((x) => x.b.id === 'd'), 'דומים: סדרה ומחבר קודם, תגית/תוכן משותפים, בלי ספר לא קשור');
  const day = 864e5, D0 = new Date(2026, 10, 3, 12).getTime(), dk = (t) => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const d = {}; [0, 1, 2, 5, 6].forEach((i) => { d[dk(D0 - i * day)] = 10 + i; });
  const S = X.statsSummary({ d, h: new Array(168).fill(0).map((_, i) => i === 3 * 24 + 22 ? 9 : 0), f: { a: D0 } }, D0, books);
  ok(S.today === 10 && S.streak === 3 && S.best === 3 && S.last30.length === 30 && S.peak.dow === 3 && S.peak.hour === 22, 'סיכום: היום, רצף, מפת חום');
  ok(S.perYear[2026] === 1 && Math.round(S.week) === 10 + 11 + 12 + 15 + 16, 'סיכום: ספרים לפי שנה, דקות בשבוע');
  ok(X.statsSummary({}, D0, []).total === 0, 'סיכום ריק — בלי קריסה');

  /* E5: ייצוא הדגשות */
  const items = [{ b: { id: 'a', title: 'ספר "א"', author: 'דן', tags: 'היסטוריה, יוון העתיקה' }, list: [{ x: 'שורה ראשונה\nושנייה', n: 'הערה', ch: 'פרק 1', f: 0.25, k: 'y', u: Date.UTC(2026, 10, 1) }, { x: 'עם, פסיק', f: 0.5 }] }];
  const md = X.hlToMd(items, 'מה למדתי');
  ok(/^# מה למדתי/.test(md) && /## ספר "א" — דן/.test(md) && /> שורה ראשונה\n> ושנייה/.test(md) && /— פרק 1 · 25%/.test(md), 'Markdown: כותרת לספר, ציטוט, פרק ואחוז');
  const ob = X.hlToObsidian(items, Date.UTC(2026, 10, 3));
  ok(ob.length === 1 && ob[0].name === 'ספר א.md' && /^---\ntitle: "ספר א"\nauthor: "דן"\ntags: \["היסטוריה", "יוון-העתיקה"\]/.test(ob[0].text) && /> \[!note\] פרק 1 · 25%/.test(ob[0].text), 'Obsidian: קובץ לספר, frontmatter ו־callout');
  const csv = X.hlToCsv(items);
  ok(csv.charCodeAt(0) === 0xFEFF && /\r\n/.test(csv) && /"שורה ראשונה\nושנייה"/.test(csv) && /"עם, פסיק"/.test(csv) && /2026-11-01/.test(csv), 'CSV: BOM, שורות, מרכאות לתא עם פסיק/שורה');

  /* E3: חיפוש מתקדם בספר */
  const T1 = 'הַסֵּפֶר נִפְתַּח. ספרים רבים. הספר השני';
  ok(X.bookFind(T1, 'ספר').length === 3 && X.bookFind(T1, 'הספר').length === 2, 'בלי ניקוד: מוצא גם טקסט מנוקד');
  ok(X.bookFind(T1, 'ספר', { word: true }).length === 0 && X.bookFind(T1, 'הספר', { word: true }).length === 2, 'מילה שלמה');
  ok(X.bookFind(T1, 'הספר', { marks: true }).length === 1, 'רגיש לניקוד: רק הלא־מנוקד');
  const h1 = X.bookFind(T1, 'הספר')[0];
  ok(T1.slice(h1.pos, h1.pos + h1.len) === h1.hit && h1.hit === 'הַסֵּפֶר', 'המיקום במקור כולל את הניקוד');
  ok(X.bookFind(T1, 'ספר(ים)?', { re: true }).length === 3 && X.bookFind(T1, '([', { re: true }) === null, 'ביטוי רגולרי, ותקלה בביטוי = null');
  ok(X.bookFind('על השלחן', 'שולחן', { plene: true }).length === 1, 'כתיב מלא/חסר בחיפוש בספר');

  /* החיבור */
  ok(/'libpro\.js'/.test(read('tools/coregen.js')) && /'\.\/libpro\.js'/.test(read('sw.js')), 'libpro.js ב־coregen וב־LIB_SHELL');
  ok(/import\('\.\/libpro\.js'\)/.test(lib) && /async function proKit\(\)/.test(lib), 'נטען רק כשנכנסים (import דינמי)');
  ok(/\['title', 'pxSortTitle'\], \['author', 'pxSortAuthor'\], \['series', 'pxSortSeries'\]/.test(lib), 'מיון: שם / מחבר / סדרה בגיליון');
  ok(/lib-qsave/.test(lib) && /P\.openBrowser\(\)/.test(lib), 'שורת החיפוש: שמירה + דפדפן תגיות');
  ok(/P\.similarInto\(sim, b\)/.test(lib) && /P\.authorPage\(/.test(lib) && /P\.seriesPage\(/.test(lib), 'דף הספר: דומים, מחבר וסדרה');
  ok(/P\.openStats\(\)/.test(lib) && /P\.openHlExport\(items\)/.test(lib) && /learnF\.q/.test(lib), 'מה למדתי: סטטיסטיקות, ייצוא וחיפוש');
  ok(/tab\('find', T\('pxFind'\)\)/.test(lib) && /matchWholeWords: !!f\.word/.test(lib), 'תוכן העניינים: לשונית חיפוש בספר');
  ok(/S\.study \? `body \{ counter-reset: snbp; \}/.test(lib) && /S\.eink \? EINK/.test(lib) && /!!\(S && S\.eink\)/.test(lib), 'מצב עיון (מספרי פסקאות) ומסך דיו (בלי אנימציות)');
  ok(/zoomTarget\(e\.target\)/.test(lib) && /PRK\.viewer\(big\)/.test(lib), 'נגיעה בתמונה/טבלה — מסך מלא');
  ok(/P\.printChapter\(/.test(lib) && /P\.printText\(/.test(lib) && /printRaw, saveBlob/.test(read('libconvert.js')), 'הדפסה של פרק / בחירה');
  ok(/'pwa_libstats_v1'/.test(app.match(/const ACCOUNT_KEYS = \[[^\]]*\]/)[0]) && /'pwa_libq_v1'/.test(app.match(/const ACCOUNT_KEYS = \[[^\]]*\]/)[0]) && /'pwa_libauth_v1'/.test(app.match(/const ACCOUNT_KEYS = \[[^\]]*\]/)[0]), 'מפתחות אישיים ב־ACCOUNT_KEYS');
  ok(!/\b(confirm|alert|prompt)\(/.test(pro) && !/onclick=/.test(pro), 'בלי confirm/alert/prompt ובלי onclick');
  ok(!/border-radius: \d+px/.test(css.slice(css.indexOf('Academy Pro גל 4'))), 'CSS: עיגולי פינות רק במשתנים');
  const strs = read('strings-academy.js');
  ['pxBrowse', 'pxStats', 'pxHlExp', 'pxFind', 'pxStudy', 'pxEink', 'pxSortTitle', 'pxWhy_text', 'pxDowL6'].forEach((k) => ok(strs.includes('"' + k + '"'), 'מחרוזת ב־strings-academy: ' + k));
  console.log('\n' + n + ' בדיקות עברו');
})().catch((e) => { console.error('FAIL -', e); process.exit(1); });
