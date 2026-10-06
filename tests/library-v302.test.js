// v302 — האקדמיה, שלב 1: הספרייה והקורא (library.js) — פונקציות טהורות, עיצוב הספר, אבטחה ושילוב באפליקציה
const fs = require('fs');
const path = require('path');
const vm = require('vm');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const lib = fs.readFileSync(path.join(root, 'library.js'), 'utf8');
const acad = fs.readFileSync(path.join(root, 'academy-data.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

// library.js הוא ES module שמייבא את המנוע (דורש DOM) — מריצים את הקוד בלי שורת ה־import
const bkSrc = fs.readFileSync(path.join(root, 'libbackup.js'), 'utf8').replace(/^export (async )?(function|const|let)/gm, '$1$2');   // v318: מנוע הגיבוי (מיובא ב־library.js)
const src = acad.replace(/^export const/gm, 'const') + '\n' + bkSrc + '\n' + lib.replace(/^import .*$/mg, '').replace(/^export (async )?(function|const|let)/gm, '$1$2')
  + '\n;globalThis.__L = { bookYear, sortBooks, langText, contextFor, driveSyncPlan, readMinutes, plainText, cloudKey, mergeProgress, mergeAnn, liveAnn, wrapQuote, trackLetter, trackSteps, glossaryMatch, THINKERS, GLOSSARY, TRACKS, searchKey, searchHit, searchScore, swapLayout, editDist, foldMap, foldQuick, ftFind, snippet, scopeBook, bookVisible, _test };';
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

// v303 — דפדוף בהחלקה בלבד (נגיעה ליד הקצה לתרגום העבירה עמוד), "חזור" כפול ליציאה מהספר
const wire = lib.slice(lib.indexOf('function wireDoc'), lib.indexOf('/* ---------------- בועת סימון'));
ok(!/goLeft|goRight|0\.3|0\.7/.test(wire), 'v303: נגיעה בתוך הספר לא מדפדפת — רק מציגה/מסתירה סרגלים (הדפדוף בהחלקה של המנוע)');
const pop = lib.slice(lib.indexOf('function onPop'), lib.indexOf('export async function openLibrary'));
// v321: "חזור" אחד נוחת על רשומת שומר (הודעה), השני — לדף הספר; בלי pushState בתוך popstate (Chrome מדלג על רשומות כאלה ויוצא מהאפליקציה)
ok(!/pushState/.test(pop) && /BACK_TWICE_MS/.test(pop) && /rdBackTwice/.test(pop) && /rd\.closing/.test(pop), 'v303→v321: "חזור" אחד בקורא — הודעה (רשומת שומר), שני — לדף הספר; ✕ יוצא מיד');

// שלב 2 — הספרייה המשותפת מה־Drive: מה להוריד ומה להסיר
const local = [{ id: 'a', driveId: 'D1', md5: 'x' }, { id: 'b', driveId: 'D2', md5: 'y' }, { id: 'c' }];
const plan = L.driveSyncPlan(local, [{ id: 'D1', md5: 'x' }, { id: 'D3', md5: 'z' }, { id: 'D2', md5: 'y2' }]);
ok(plan.fetch.map((x) => x.id).join() === 'D3,D2' && plan.remove.length === 0, 'Drive: מורידים רק חדש/שהשתנה (md5), מה שכבר בטלפון — לא');
const plan2 = L.driveSyncPlan(local, [{ id: 'D1', md5: 'x' }]);
ok(plan2.remove.map((b) => b.id).join() === 'b', 'Drive: מכתב שהוסר מהתיקייה מוסר; ספר שיובא ידנית נשאר');
ok(/idToken/.test(lib) && /\/api\/library/.test(lib) && !/GDRIVE|private_key/.test(lib), 'Drive: הטלפון שולח רק את אסימון ההתחברות — בלי מפתחות');

// שלב 3 (v305) — דף מכתב + התקדמות בין מכשירים
ok(L.readMinutes([{ size: 16000 }, { size: 16000, linear: 'no' }, { size: 3200 }]) === 12 && L.readMinutes([]) === 0, 'זמן קריאה כמו במנוע: 1600 תווים לדקה, בלי פרקים לא־ליניאריים');
ok(L.plainText('<p>מכתב &amp; <b>תקציר</b></p>') === 'מכתב & תקציר', 'תקציר מ־dc:description — טקסט נקי בלי תגיות');
ok(L.cloudKey('id-urn:uuid:12.34/x') === 'kid-urn_uuid_12_34_x', 'מפתח בענן בלי תווים בעייתיים');
const loc = { lastRead: 100, cfi: 'a', fraction: 0.2, done: false };
ok(L.mergeProgress(loc, { t: 50, c: 'b', f: 0.9 }) === null && L.mergeProgress(loc, null) === null, 'התקדמות ישנה מהענן לא דורסת את המקומית');
const m = L.mergeProgress(loc, { t: 200, c: 'b', f: 0.9, d: true });
ok(m && m.cfi === 'b' && m.fraction === 0.9 && m.done && m.lastRead === 200, 'התקדמות חדשה ממכשיר אחר — נכנסת');
ok(/\.set\(\{ lib(: \{ [ps] \})? \}, \{ merge: true \}\)/.test(lib) && !/set\(\{[^}]*\bdb\b/.test(lib), 'הענן: שדה lib נפרד עם merge — לא נוגע בתיק (db)');
ok(/goView\(\{ book: b\.id \}\)/.test(lib) && /lv: v/.test(lib) && /history\.state\.lv/.test(lib), 'כריכה פותחת דף מכתב, ו"חזור" מחזיר ממנו לספרייה');

// שלב 4 (v306) — הדגשות, הערות, סימניות, כרטיס ציטוט
const loc2 = [{ id: 'a', c: 'x', k: 'y', u: 10 }, { id: 'b', c: 'y', k: 'g', u: 10 }];
const mm = L.mergeAnn(loc2, { a: { c: 'x', k: 'p', u: 20 }, b: { c: 'y', k: 'b', u: 5 }, c: { c: 'z', k: 'y', u: 30 } });
ok(mm && mm.find((x) => x.id === 'a').k === 'p' && mm.find((x) => x.id === 'b').k === 'g' && mm.length === 3, 'הדגשות: מיזוג לפי id — העדכון האחרון מנצח, חדשות ממכשיר אחר נוספות');
const del = L.mergeAnn(loc2, { a: { c: 'x', d: 1, u: 99 } });
ok(del && L.liveAnn(del).map((x) => x.id).join() === 'b', 'מחיקה במכשיר אחר (מצבה) מוחקת גם כאן');
ok(L.mergeAnn(loc2, { a: { c: 'x', k: 'y', u: 10 } }) === null && L.mergeAnn(loc2, null) === null, 'בלי שינוי — לא כותבים');
ok(L.liveAnn([{ id: 1, f: .5 }, { id: 2, b: 1, f: .2 }, { id: 3, f: .1 }]).map((x) => x.id).join() === '3,1' && L.liveAnn([{ id: 2, b: 1 }], 'bm').length === 1, 'הדגשות וסימניות בנפרד, לפי מיקום בספר');
const ql = L.wrapQuote('אחת שתיים שלוש ארבע חמש שש', 10, (t) => t.length, 2);
ok(ql.length === 2 && ql[1].endsWith('…') && L.wrapQuote('קצר', 100, (t) => t.length, 3).join() === 'קצר', 'כרטיס ציטוט: שבירת שורות וקיצור עם …');
const keys4 = ['hlNote', 'hlQuote', 'hlRemove', 'bmAdd', 'tabHl', 'tabBm', 'learnTitle', 'qShare'];   // v326: "מחיקה" בבועה הוחלף בכפתור "הסרת הסימון" (hlRemove)
ok(keys4.every((k) => lib.includes("'" + k + "'")), 'כל הפעולות של שלב 4 מחוברות בממשק');
ok(/set\(\{ lib \}, \{ merge: true \}\)/.test(lib) && /lib\.a/.test(lib), 'הדגשות בענן: lib.a עם merge (לא נוגע בתיק)');

// שלב 5 (v307) — שכבת האקדמיה
const lib5 = [{ id: 'a', year: 1987, author: 'וורן א. באפט', title: 'מכתב באפט 1987' }, { id: 'p', year: 1965, author: 'וורן באפט', title: 'מכתב לשותפות 1965' },
  { id: 'b', year: 1965, author: 'וורן באפט', title: 'מכתב באפט 1965' }, { id: 'c', year: 1992, author: 'Warren Buffett', title: 'Letter 1992' }];
ok(L.trackLetter(lib5, 1965).id === 'b' && L.trackLetter(lib5, 1987).id === 'a' && L.trackLetter(lib5, 2001) === null, 'מסלול: מכתב לבעלי המניות קודם למכתב שותפות באותה שנה');
const st = L.trackSteps(L.TRACKS.find((t) => t.id === 'basics'), lib5);
ok(st.map((x) => x.y).join() === '1987,1992', 'מסלול: מוצגים רק שלבים שיש להם מכתב בספרייה');
ok(L.TRACKS.every((t) => t.steps.every(([y, w]) => y >= 1957 && y <= 2030 && w)) && L.THINKERS.length >= 5, 'מסלולים והוגים תקינים');
const ids = new Set(L.THINKERS.map((p) => p.id));
ok(['graham', 'fisher', 'buffett', 'munger', 'ackman'].every((x) => ids.has(x)) && L.GLOSSARY.every((g) => g.length === 4 && g[0] && g[2] && ids.has(g[3])), 'כל ההוגים שהמשתמש ביקש + כל מונח משויך להוגה קיים');
ok(L.glossaryMatch('מרווח ביטחון')[1] === 'Margin of safety' && L.glossaryMatch('the float')[0] === 'פלוט' && L.glossaryMatch('ה"מר שוק"') && L.glossaryMatch('שלום עולם') === null, 'זיהוי מונח בטקסט שסומן (עברית/אנגלית, עם ניקוד ומירכאות)');
ok(/op: 'insight'/.test(lib) && /acAiNote/.test(lib) && !/GEMINI/.test(lib), 'ניתוח המכתב מגיע מהשרתון, עם ציון שנכתב בעזרת AI');

// חיפוש בספרייה
const k1 = L.searchKey({ title: 'מכתב באפט 2023', author: 'וורן א. באפט', year: 2023, desc: 'צ׳רלי מאנגר — האדריכל' });
ok(L.searchHit(k1, '2023') && L.searchHit(k1, 'באפט מאנגר') && L.searchHit(k1, 'צ\'רלי') && !L.searchHit(k1, '1987') && L.searchHit(k1, ''), 'חיפוש: שם/כותב/שנה/תקציר, כמה מילים יחד, בלי תלות בגרש');
ok(/lib-search/.test(lib) && /searching/.test(lib), 'שורת החיפוש מסננת במקום (בלי לבנות מחדש את המסך)');
const k87 = L.searchKey({ title: 'מכתב באפט 1987', author: 'וורן א. באפט', year: 1987 });
const k23 = L.searchKey({ title: 'מכתב באפט 2023', author: 'וורן א. באפט', year: 2023, desc: 'צ׳רלי מאנגר — האדריכל של ברקשייר' });
const fz = [['באפת', k87], ['בופט 1987', k87], ['מכתוב באפט', k87], ['1897', k87], ['buffett 2023', k23], ['נוככקאא', k87], ['מנגר', k23], ['ברקשיר', k23], ['berkshre', k23], ['baffet', k87]];
fz.forEach(([q, k]) => ok(L.searchHit(k, q), 'חיפוש סלחני: "' + q + '" נמצא'));
ok(!L.searchHit(L.searchKey({ title: 'מכתב באפט 1986', author: 'וורן באפט', year: 1986 }), '1987') && !L.searchHit(k87, 'מאנגר') && !L.searchHit(k87, '2023') && !L.searchHit(k23, 'קוקה קולה'), 'חיפוש סלחני: לא מוצא מה שבאמת לא שם');
ok(L.searchScore(k87, 'באפט') > L.searchScore(k87, 'באפת') && L.editDist('1987', '1897', 2) === 1 && L.swapLayout('נוככקאא') === 'buffett', 'דירוג: התאמה מדויקת לפני התאמה עם טעות; החלפת סדר = טעות אחת; מקלדת הפוכה');

// שלב 6 (v309) — חיפוש בתוך המכתבים + ניהול
const txt = 'פרק ראשון\nבַּאפֶט כתב על מרווח ביטחון ועל "מר שוק".\nמרווח הביטחון הוא כרית. ושוב: מרווח ביטחון!';
let fh = L.ftFind(txt, 'מרווח ביטחון');
ok(fh.length === 2 && txt.slice(fh[0].pos, fh[0].pos + fh[0].len) === 'מרווח ביטחון', 'חיפוש בטקסט: ביטוי מדויק, כל המופעים, מיקום במקור');
fh = L.ftFind(txt, 'באפט');
ok(fh.length === 1 && txt.slice(fh[0].pos, fh[0].pos + fh[0].len) === 'בַּאפֶט', 'חיפוש בטקסט: בלי תלות בניקוד — ההתאמה מסומנת במקור עם הניקוד');
ok(L.ftFind(txt, 'מר שוק').length === 1 && L.ftFind(txt, 'מרווח כרית').length === 1 && L.ftFind(txt, 'מרווח כרית')[0].loose, 'חיפוש בטקסט: גרשיים, וכל המילים באותה פסקה כשאין ביטוי');
ok(L.ftFind(txt, 'ק').length === 0 && L.ftFind(txt, 'קוקה קולה').length === 0, 'חיפוש בטקסט: אות אחת / מה שלא קיים — כלום');
const sn = L.snippet('א'.repeat(200) + ' מילה חשובה כאן ' + 'ב'.repeat(200), 201, 4);
ok(sn.hit === 'מילה' && sn.pre.startsWith('…') && sn.post.endsWith('…') && !/\n/.test(sn.pre), 'קטע תוצאה: סביב ההתאמה, עם …');
ok(/op: 'me'/.test(lib) && /removeReader/.test(lib) && /ui\.admin/.test(lib), 'ניהול: מוצג רק כשהשרתון אומר שזה מנהל');
ok(/view\.search\(\{ query: opt\.find\.q, index: opt\.find\.sec/.test(lib), 'נגיעה בתוצאה פותחת את הקורא בפרק ובמופע הנכון');

// שלב 8: חיפוש מהיר — הקיפול המהיר זהה לקיפול עם המפה, והמיקומים נכונים עם ניקוד ובלעדיו
const fsamp = 'בַּאפֶט אָמַר: "מרווח ביטחון" — ‘Margin’ של ברקשייר״ם ן־ץ';
ok(L.foldQuick(fsamp) === L.foldMap(fsamp).f, 'קיפול מהיר = הקיפול המלא (ניקוד, סופיות, גרשיים, מקפים)');
const plainTxt = 'פסקה ראשונה\nכאן כתוב מרווח ביטחון ואז שוב מרווח ביטחון';
const fq1 = L.ftFind(plainTxt, 'מרווח ביטחון', 40, L.foldQuick(plainTxt));
ok(fq1.length === 2 && fq1.every((m) => plainTxt.slice(m.pos, m.pos + m.len) === 'מרווח ביטחון'), 'חיפוש בטקסט בלי ניקוד — מיקומים ישירים (בלי מפה) ונכונים');
ok(/sec\._f \|\| \(sec\._f = foldQuick/.test(lib) && /const cache = ftCache \|\|/.test(lib), 'חיפוש בטקסט: סינון מוקדם על קיפול שמור, ובלי מרוץ עם בניית האינדקס');

// שלב 8: אופליין — כל קבצי הספרייה והקורא בטעינה מראש של ה־SW, וכולם קיימים
const swSrc = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const appV = +(fs.readFileSync(path.join(root, 'app.js'), 'utf8').match(/APP_VERSION = 'v(\d+)'/) || [])[1];
const swV = +(swSrc.match(/CACHE_NAME = 'portfolio-pwa-v(\d+)'/) || [])[1];
// שלב התוכן של הפריסה הדו־שלבית (sw.js גרסה אחת אחורה, לפני v310) — sw.js החדש עוד לא נדחף
const swPending = !/const LIB_SHELL/.test(swSrc) && swV === appV - 1 && appV <= 310;
if (swPending) console.log('# דילוג על בדיקות ה־SW של הספרייה — שלב התוכן, sw.js נדחף בנפרד');
else {
const libShell = (swSrc.match(/const LIB_SHELL = \[([\s\S]*?)\];/) || [, ''])[1].match(/'\.\/[^']+'/g).map((x) => x.slice(3, -1));
const needed = ['library.js', 'library.css', 'academy-data.js', 'fonts/NotoSansHebrew-VF.woff2'];
const walk = (f, seen) => {                      // ייבואים סטטיים מ־library.js לעומק (בלי pdf/tts — הוסרו)
  if (seen.has(f)) return; seen.add(f);
  const src = fs.readFileSync(path.join(root, f), 'utf8');
  for (const m of src.matchAll(/(?:from\s+|import\()\s*'(\.\/[^']+\.js)'/g)) {
    const t = path.posix.normalize(path.posix.join(path.posix.dirname(f), m[1]));
    if (fs.existsSync(path.join(root, t))) walk(t, seen);
  }
};
const deps = new Set(); walk('library.js', deps);
const missShell = needed.concat(Array.from(deps)).filter((f) => !libShell.includes(f));
// שלב התוכן של הפריסה הדו־שלבית (sw.js גרסה אחת אחורה): קובץ ספרייה חדש עוד לא ברשימה — נכנס עם sw.js (v318)
const contentPhase = swV === appV - 1;
if (contentPhase && missShell.length) console.log('# שלב התוכן — ' + missShell + ' ייכנס ל־LIB_SHELL עם sw.js');
ok((!missShell.length || contentPhase) && libShell.every((f) => fs.existsSync(path.join(root, f))), 'SW: כל ' + libShell.length + ' קבצי הספרייה נטענים מראש וקיימים' + (missShell.length && !contentPhase ? ' (חסר: ' + missShell + ')' : ''));
ok(/caches\.match\('\.\/library\.js'\)/.test(swSrc) && /cache\.addAll\(LIB_SHELL\)\.catch/.test(swSrc), 'SW: רק למי שכבר השתמש בספרייה, וכשל לא מפיל את ההתקנה');
}

// שלב 8: נגישות
ok(/setAttribute\('role', 'dialog'\); sh\.setAttribute\('aria-modal', 'true'\)/.test(lib) && /back\.focus/.test(lib), 'נגישות: גיליון = דיאלוג, הפוקוס חוזר למקומו בסגירה');
ok(/e\.key === 'Escape'/.test(lib) && /function onEscape/.test(lib), 'נגישות: Escape = חזור (גם בתוך מסמך הספר)');
ok(/it\.setAttribute\('aria-label', b\.title/.test(lib) && /'ac-ring'\); svg\.setAttribute\('aria-hidden'/.test(lib), 'נגישות: כריכה עם שם ומצב, טבעות דקורטיביות מוסתרות');
ok(/:focus-visible/.test(fs.readFileSync(path.join(root, 'library.css'), 'utf8')), 'נגישות: טבעת פוקוס למקלדת');

// v313: הפרדת חשבונות במכשיר אחד — התקדמות/הדגשות וספרים שיובאו ביד שייכים לחשבון
{
  const b = { id: 'x', src: 'drive', pOwner: 'A', cfi: 'c1', fraction: 0.5, done: false, lastRead: 9, ann: [{ id: 'h1' }] };
  ok(L.scopeBook(b, 'B', '') && b.fraction === 0 && !b.cfi && b.ann.length === 0 && b.byOwner.A.fraction === 0.5 && b.byOwner.A.ann[0].id === 'h1', 'מכתב משותף: חשבון אחר לא רואה את ההתקדמות וההדגשות של הראשון');
  b.fraction = 0.2; b.ann = [{ id: 'hB' }];
  ok(L.scopeBook(b, 'A', '') && b.fraction === 0.5 && b.ann[0].id === 'h1' && b.byOwner.B.ann[0].id === 'hB', 'חזרה לחשבון הראשון — ההתקדמות שלו חוזרת, והשני נשמר בצד');
  ok(L.scopeBook(b, 'A', '') === false, 'אותו חשבון — בלי שינוי');
  const m = { id: 'm', src: '', owner: 'A', pOwner: 'A' };
  ok(L.bookVisible(m, 'A') && !L.bookVisible(m, 'B') && L.bookVisible({ src: 'drive' }, 'B'), 'ספר שיובא ביד — רק לחשבון שייבא; מכתבי ה־Drive — לכולם');
  const old = { id: 'o', fraction: 0.7, ann: [{ id: 'z' }] };   // מכשיר ותיק (בלי בעלים)
  L.scopeBook(old, 'NEW', '');
  ok(old.owner === 'legacy' && old.fraction === 0 && old.byOwner.legacy.fraction === 0.7 && !L.bookVisible(old, 'NEW'), 'מכשיר ותיק + חשבון שלא אומץ — לא רואה ספרים/התקדמות ישנים');
  const old2 = { id: 'o2', fraction: 0.7 };
  L.scopeBook(old2, 'U', 'U');
  ok(old2.owner === 'U' && old2.fraction === 0.7 && L.bookVisible(old2, 'U'), 'מכשיר ותיק + החשבון שאומץ — הכל נשאר');
  ok(/if \(u && libOwner\(\) !== u\.uid\) return null;/.test(lib) && /await scopeLibrary\(\)/.test(lib), 'הספרייה לא כותבת לענן התקדמות של חשבון אחר, ומתאימה את הרשומות לפני הכל');
}

// המנוע והפונט — עם רישיון, בגרסה קבועה
ok(/^[0-9a-f]{40}\s*$/.test(fs.readFileSync(path.join(root, 'vendor/foliate-js/COMMIT'), 'utf8')) && /MIT License/.test(fs.readFileSync(path.join(root, 'vendor/foliate-js/LICENSE'), 'utf8')),
  'foliate-js מקובע לקומיט עם רישיון MIT');
ok(fs.existsSync(path.join(root, 'fonts/NotoSansHebrew-VF.woff2')) && /Open Font License/.test(fs.readFileSync(path.join(root, 'fonts/OFL.txt'), 'utf8')), 'הפונט עם רישיון OFL');
console.log('# ' + n + ' בדיקות עברו');
