// Academy Pro, גל 6 (03/11/2026): חיבורים — libconnect.js (ייבוא הדגשות, ZIP של הגיבוי המלא, מיזוג בשחזור, עיתון בוקר),
// OCR בהמרת PDF (libconvert.js), הרצאה מ־Studio (toLectureMd ב־studiosubs.js) והחיבור. הניתוח של דפים ופידים (DOMParser) — ב־QA בדפדפן;
// השרתון (webGet, inbox, ocr) — ב־ibkr-proxy/tests/run.js. הרצה: node tests/academy-pro6.test.js
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const lib = read('library.js'), cn = read('libconnect.js'), cv = read('libconvert.js'), st = read('studio.js'), css = read('library.css');

(async () => {
  const X = await import(path.join(root, 'libconnect.js'));
  const EK = await import(path.join(root, 'epubkit.js'));
  const SS = await import(path.join(root, 'studiosubs.js'));
  const CV = await import(path.join(root, 'libconvert.js'));

  /* G2: קובץ הקטעים */
  const clip = '﻿The Long Road (Jane Doe)\r\n- Your Highlight on page 12 | Location 180-182 | Added on Monday, 3 November 2026 10:00:00\r\n\r\nThe road was long and the night was dark.\r\n==========\r\n' +
    'The Long Road (Jane Doe)\n- Your Note on page 12 | Location 182 | Added on Monday, 3 November 2026 10:01:00\n\nremember this\n==========\n' +
    'The Long Road (Jane Doe)\n- Your Highlight on page 12 | Location 180-183 | Added on Monday, 3 November 2026 10:02:00\n\nThe road was long and the night was dark. Very dark.\n==========\n' +
    'The Long Road (Jane Doe)\n- Your Bookmark on page 40 | Location 600 | Added on Monday, 3 November 2026 10:03:00\n\n\n==========\n' +
    'ספר עברי (ישראל ישראלי)\n- ההדגשה שלך במיקום 50-52 | נוסף ביום שני\n\nשורה מודגשת בעברית\n==========\n' +
    'garbage without meta\n==========\n';
  const cl = X.parseClippings(clip);
  ok(cl.length === 5 && cl[0].title === 'The Long Road' && cl[0].author === 'Jane Doe' && cl[0].loc === 180 && cl[0].end === 182, 'קובץ הקטעים: שם, מחבר ומיקום (עם BOM ו־CRLF)');
  ok(cl[1].kind === 'note' && cl[3].kind === 'bm' && cl[4].title === 'ספר עברי' && cl[4].loc === 50, 'קובץ הקטעים: הערה, סימנייה, ועברית');
  const g = X.groupClips(cl);
  ok(g.length === 2 && g[0].hl.length === 1 && /Very dark/.test(g[0].hl[0].text) && g[0].hl[0].note === 'remember this', 'קיבוץ: הדגשה שנערכה — הגרסה הארוכה; ההערה נצמדת להדגשה שלה; בלי סימניות');
  const books = [{ id: 'a', title: 'The Long Road: A Novel', author: 'Doe, Jane' }, { id: 'b', title: 'ספר עברי', author: 'ישראל ישראלי' }, { id: 'c', title: 'Other' }];
  ok(X.matchBook('The Long Road', 'Jane Doe', books).id === 'a' && X.matchBook('ספר עברי', '', books).id === 'b' && X.matchBook('Nothing Here', '', books) === null, 'התאמת ספר לפי שם (התחלה משותפת, עברית, בלי התאמה)');
  const q = X.clipQueue(g[0], [{ x: 'something else' }], []);
  ok(q.length === 1 && q[0].n === 'remember this' && q[0].t === 0, 'תור ההדגשות: טקסט והערה');
  ok(X.clipQueue(g[0], [{ x: g[0].hl[0].text }], []).length === 0 && X.clipQueue(g[0], [], q).length === 0, 'תור ההדגשות: בלי כפילות (מול הדגשות קיימות ומול התור)');
  ok(X.searchQuery('a '.repeat(10).trim()) === 'a '.repeat(10).trim() && X.searchQuery('word '.repeat(30)).length <= 60 && !/\s$/.test(X.searchQuery('word '.repeat(30))), 'חיפוש המקום: עד 60 תווים בלי לחתוך מילה');

  /* C11 */
  const now = Date.parse('2026-11-03T08:00:00Z');
  const feeds = [
    { title: 'A', items: [{ title: 'a1', link: 'https://a/1', at: now - 3600e3 }, { title: 'a2', link: 'https://a/2', at: now - 50 * 3600e3 }, { title: 'a3', link: 'https://a/3', at: now - 7200e3 }] },
    { title: 'B', items: [{ title: 'b1', link: 'https://b/1', at: 0 }, { title: 'b2', link: 'https://b/2', at: 0 }] },
  ];
  const pk = X.pickItems(feeds, now, 6, 3);
  ok(pk.map((x) => x.title).join() === 'a1,b1,a3' && pk[0].feed === 'A', 'עיתון: רק מהיממה וחצי האחרונות, לסירוגין בין המקורות, עד המגבלה');
  ok(X.paperDay(new Date(2026, 10, 3)) === '2026-11-03', 'עיתון: תאריך היום');

  /* G6: ZIP של הגיבוי — נקרא בחזרה עם הקורא של epubkit */
  const enc = new TextEncoder();
  const big = new Uint8Array(5000).map((_, i) => i % 251);
  const parts = X.zipParts([{ name: 'academy-backup.json', data: enc.encode('{"v":1}') }, { name: 'books/x', data: { blob: new Blob([big]), crc: EK.crc32(big), size: big.length } }], EK.crc32, new Date(2026, 10, 3, 9, 30));
  const zb = new Blob(parts);
  const z = await EK.readZip(zb);
  ok(z.entries.length === 2 && z.entries.map((e) => e.name).join() === 'academy-backup.json,books/x', 'גיבוי: ZIP תקין (שני קבצים, לפי הסדר)');
  const back = await EK.readEntry(zb, z.entries[1]);
  ok(back.length === 5000 && back[4999] === big[4999] && new TextDecoder().decode(await EK.readEntry(zb, z.entries[0])) === '{"v":1}', 'גיבוי: התוכן חוזר בדיוק (כולל בדיקת CRC)');
  const mr = X.mergeRec({ id: 'k', fraction: 0.5, cfi: 'c1', ann: [{ id: '1', x: 'a', u: 5 }, { id: '2', x: 'b', u: 9 }] }, { id: 'k', fraction: 0.7, cfi: 'c2', ann: [{ id: '1', x: 'A', u: 8 }, { id: '2', x: 'B', u: 1 }, { id: '3', x: 'c', u: 1 }] });
  ok(mr.fraction === 0.7 && mr.cfi === 'c2' && mr.ann.length === 3 && mr.ann.find((a) => a.id === '1').x === 'A' && mr.ann.find((a) => a.id === '2').x === 'b', 'שחזור: ההתקדמות הגבוהה, הסימון העדכני גובר, חדשים נוספים');
  ok(X.mergeRec({ id: 'k', fraction: 0.9, cfi: 'c9' }, { id: 'k', fraction: 0.2, cfi: 'c2' }).cfi === 'c9', 'שחזור: לא חוזרים אחורה בהתקדמות');

  /* C12 */
  const md = SS.toLectureMd([
    { start: 0, end: 2, lines: ['שלום לכולם,'] }, { start: 2.2, end: 4, lines: ['היום נדבר על <i>כלכלה</i>.'] },
    { start: 8, end: 10, lines: ['- נושא שני'] }, { start: 61, end: 63, lines: ['# פרק חדש בפנים'] },
  ], [{ t: 0, title: 'פתיחה' }, { t: 60, title: 'המשך' }], 'הרצאה 1');
  ok(md.startsWith('# הרצאה 1\n\n## פתיחה\n\nשלום לכולם, היום נדבר על כלכלה.\n\nנושא שני\n\n## המשך\n\nפרק חדש בפנים'), 'הרצאה: כותרת, פרקים, פסקה בשתיקה, בלי תגיות וסימני רשימה');
  ok(SS.toLectureMd([], [], '').startsWith('# Lecture'), 'הרצאה: בלי כתוביות — רק כותרת');

  /* C5 */
  ok(CV.b64(new Uint8Array([255, 216, 255])) === '/9j/' && CV.b64(new Uint8Array(70000)).length === Math.ceil(70000 / 3) * 4, 'OCR: base64 בחלקים (גם לתמונה גדולה)');
  ok(/E\.ocr\(b64\(data\), r\.lang\)/.test(cv) && /ocrHtml\.get\(\+n\) \|\| '<div class="pg"><img/.test(cv) && /catch \(e\) \{ ocrStop = true; \}/.test(cv), 'OCR: עמוד מזוהה — טקסט; כשל — התמונה, ועוצרים לשאר העמודים');
  ok(/swRow\(S, 'ocr', T\('cvOcr'\)/.test(cv) && /ocr: \(img, lang\) => aiCall\('ocr'/.test(lib), 'OCR: מתג בחלון ההמרה, דרך bookAi');

  /* החיבור */
  ok(/import\('\.\/libconnect\.js'\)/.test(lib) && /'libconnect\.js'/.test(read('tools/coregen.js')) && /'\.\/libconnect\.js'/.test(read('sw.js')), 'libconnect.js נטען רק כשנכנסים, ב־coregen וב־LIB_SHELL');
  ok(/C\.openSend\(b\)/.test(lib) && /C\.openClips\(\)/.test(lib) && /C\.openFull\(\)/.test(lib) && /E\.openArticle\(\)/.test(cv) && /E\.openPaper\(\)/.test(cv), 'נקודות הכניסה: שליחה (דף הספר), ייבוא הדגשות וגיבוי (הגדרות), מאמר ועיתון (הוספה)');
  ok(/checkInbox\(\);/.test(lib) && /600000/.test(lib) && /act: 'list'/.test(lib), 'תיבת הדואר נבדקת בכניסה (לכל היותר פעם ב־10 דקות)');
  ok(/rec\.annQ && rec\.annQ\.length\) setTimeout\(resolveQueued/.test(lib) && /view\.clearSearch\(\)/.test(cn), 'הדגשות שיובאו — נמצאות בפתיחת הספר (והחיפוש מנוקה)');
  ok(/path: '\/api\/library'/.test(st) && /from: 'studio'/.test(st) && /toLectureMd\(cues/.test(st) && /path \|\| '\/api\/studio'/.test(read('studionet.js')), 'Studio: שליחה לתיבת הדואר של Academy');
  ok(!/\b(confirm|alert|prompt)\(/.test(cn) && !/onclick=/.test(cn) && !/innerHTML/.test(cn) && !/localStorage\.setItem\('pwa_lib(?!feeds|sent)/.test(cn), 'libconnect: בלי confirm/alert/prompt, בלי onclick ובלי innerHTML');
  ok(!/border-radius: \d+px/.test(css.slice(css.indexOf('Academy Pro גל 6'))), 'CSS: עיגולי פינות רק במשתנים');
  const ak = read('app.js');
  ok(/'pwa_libfeeds_v1'/.test(ak) && /'pwa_libsent_v1'/.test(ak), 'מפתחות אישיים חדשים ב־ACCOUNT_KEYS');
  const strs = read('strings-academy.js'), sts = read('strings-studio.js');
  ['cnArt', 'cnPaper', 'cnSend', 'cnClips', 'cnFull', 'cnGotStudio', 'cnInboxFull', 'cvOcr', 'cvOcrOf'].forEach((k) => ok(strs.includes('"' + k + '"'), 'מחרוזת ב־strings-academy: ' + k));
  ['studioAcRow', 'studioAcSent', 'studioAcFail'].forEach((k) => ok(sts.includes('"' + k + '"'), 'מחרוזת ב־strings-studio: ' + k));
  console.log('\n' + n + ' בדיקות עברו');
})().catch((e) => { console.error('FAIL -', e); process.exit(1); });
