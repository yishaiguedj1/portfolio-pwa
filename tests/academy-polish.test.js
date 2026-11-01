// Academy Pro, גל 1 (01/11/2026): ליטוש ובדיקה — epubkit (hebrewPunct, bidiFix, mapText, cssTransform, selectorUsed, forcedFilter, relPath)
// ו־libpolish.js (שורות החלון, הערכה, פרטים לקובץ, משיכת פרטים, זמן קריאה), והחיבור מ־library.js.
// הליטוש המלא (polishBook על polish-he2.epub, ספר סינתטי) צריך DOMParser — רץ רק כשיש xmldom בסביבה (בפיתוח; ב־CI — מדלג).
// הרצה: node tests/academy-polish.test.js
const fs = require('fs');
const path = require('path');
const assert = require('assert');
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; console.log('ok - ' + m); };
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

(async () => {
  const EK = await import(path.join(root, 'epubkit.js'));
  const PL = await import(path.join(root, 'libpolish.js'));

  /* H3 — פיסוק עברי: תו אחד בתו אחד (ה־CFI לא זז) */
  const P = (t) => EK.hebrewPunct(t).text;
  ok(P('צה"ל, דו"ח, ארה"ב, תשפ"ו, רמב"ם, ש"ח') === 'צה״ל, דו״ח, ארה״ב, תשפ״ו, רמב״ם, ש״ח', 'גרשיים בראשי תיבות');
  ok(P("ג' ו-ה', עמ' 3, פרופ' לוי, וכו'.") === 'ג׳ ו־ה׳, עמ׳ 3, פרופ׳ לוי, וכו׳.', 'גרש אחרי אות ובקיצורים, מקף עברי');
  ok(P("ג'ורג' וצ'יפס, ז'קט") === 'ג׳ורג׳ וצ׳יפס, ז׳קט', 'גרש בתוך מילה לועזית');
  ok(P('ו"המכתב" ה"לא" "שלום"') === 'ו"המכתב" ה"לא" "שלום"', 'מירכאות של ציטוט — גם אחרי אות שימוש — לא משתנות');
  ok(P("'שלום', אמר. ו'לא'") === "'שלום', אמר. ו'לא'", 'ציטוט במירכאה בודדת — לא גרש');
  ok(P('ב-1965, בית-ספר, 3-5, a-b') === 'ב־1965, בית־ספר, 3-5, a-b', 'מקף עברי רק אחרי אות עברית');
  ok(P('צה”ל') === 'צה״ל', 'גרשיים מסולסלים בין אותיות');
  for (const t of ['צה"ל ג\' ב-1', "אמר 'כן' ו\"לא\" עמ' 4"]) ok(P(t).length === t.length, 'אותו אורך: ' + t);

  /* H4 — כיווניות */
  const B = (t) => EK.bidiFix(t);
  ok(B('לפי )עמ\' 42( כך').text === "לפי (עמ' 42) כך", 'סוגריים הפוכים מהמרה חזותית');
  ok(B('(עמ\' 42) ו)לא(').text === '(עמ\' 42) ו)לא(', 'יש סוגר פותח קודם — לא נוגעים');
  ok(B('‫שלום‬').text === 'שלום', 'תווי הטבעה ישנים נמחקים');
  ok(B('שלום‏‏ 23%').text === 'שלום 23%' && B('x ‏‏23').text === 'x ‏23', 'סימן מיותר ליד אות באותו כיוון / רצף → אחד');
  ok(B('abc‎def').text === 'abcdef' && B('שלום ‎23').text === 'שלום ‎23', 'LRM ליד לטינית נמחק, LRM לפני מספר נשאר');

  /* mapText — רק טקסט אחרי <body>, בלי code/pre/style, ישויות מירכאות */
  const doc = '<html><head><title>צה"ל</title><style>p{}</style></head><body><p class="a-b" title="צה&quot;ל">צה&quot;ל <code>ב-1</code> ב-1</p><pre>ב-2</pre></body></html>';
  const out = EK.mapText(doc, (t) => EK.hebrewPunct(t).text);
  ok(out.includes('<title>צה"ל</title>') && out.includes('title="צה&quot;ל"') && out.includes('class="a-b"'), 'head ומאפיינים לא משתנים');
  ok(out.includes('>צה״ל <code>ב-1</code> ב־1</p><pre>ב-2</pre>'), 'טקסט משתנה, code/pre לא');
  ok(EK.mapText('<p>x</p>', (t) => t + '!') === '<p>x</p>', 'בלי <body> — לא נוגעים');

  /* B3/B4 — CSS */
  const css = '/*c*/ .a{color:red;font-family:X} .zz, .b{margin:0} @media screen{ .zz{color:blue} } body{margin:2em;font-size:12pt} ' +
    '@font-face{font-family:F;src:url(f.ttf)} @page{margin:1in} .c{background:url("data:image/png;base64,AA;BB")} .d:not(.zz){top:0} @keyframes k{from{top:0}to{top:1px}}';
  const used = { cls: new Set(['a', 'b', 'c', 'd']), ids: new Set() };
  const u = EK.cssTransform(css, { keepSel: (s) => EK.selectorUsed(s, used) });
  ok(!u.includes('.zz,') && !u.includes('@media') && u.includes('.b {margin:0}') && u.includes('.d:not(.zz){top:0}') && u.includes('@keyframes k{from{top:0}to{top:1px}}') && u.includes('@font-face'), 'B3: בורר שלא בשימוש נמחק; :not, @keyframes ו־@font-face נשארים');
  const f = EK.cssTransform(css, { keepDecl: EK.forcedFilter({ font: 1, color: 1, size: 1, margin: 1 }), dropAt: (x) => x === 'page' });
  ok(!/\.a\{/.test(f) && !/body\{/.test(f) && !f.includes('@page') && f.includes('src:url(f.ttf)') && f.includes('base64,AA;BB'), 'B4: גופן/צבע/גודל/שוליי body נמחקים; @font-face ו־url עם ; נשארים');
  const f2 = EK.cssTransform('p{font-size:1.2em;font-size:14px;margin:1em}', { keepDecl: EK.forcedFilter({ size: 1, margin: 1 }) });
  ok(f2 === 'p{font-size:1.2em;margin:1em}', 'B4: גודל יחסי נשאר, שוליים רק ב־html/body');
  ok(EK.relPath('OEBPS/nav.xhtml', 'OEBPS/Text/c1.xhtml') === 'Text/c1.xhtml' && EK.relPath('OEBPS/nav.xhtml', 'img/a b.jpg') === '../img/a%20b.jpg', 'relPath');
  ok(EK.POLISH_DEFAULT.forced.font && !EK.POLISH_DEFAULT.forced.size && !EK.POLISH_DEFAULT.forced.margin, 'ברירת המחדל: גופנים וצבעים, בלי גדלים ושוליים');

  /* libpolish — החלון */
  const a = { info: { hebrew: true, version: 2, size: 5e6 }, stats: { punct: 3, bidi: 0, cssBytes: 1000, forcedBytes: 200, hyph: 1, fontBytes: 30000 }, issues: [{ code: 'container', fix: 'auto', n: 1 }, { code: 'unused_font', fix: 'kindle', n: 1 }, { code: 'missing_img', fix: null, n: 2 }] };
  ok(JSON.stringify(PL.polishRows(a, { edit: {} })) === JSON.stringify(['punct', 'css', 'forced', 'epub3', 'meta', 'kindle']), 'שורות רק למה שיש: בלי כיווניות (0), בלי חלוקת מילים בעברית');
  ok(!PL.polishRows(Object.assign({}, a, { info: { hebrew: false, version: 3, size: 1 } }), {}).some((k) => ['punct', 'epub3', 'meta'].includes(k)), 'אנגלית ב־EPUB 3 בלי עריכה — בלי פיסוק, שדרוג ופרטים');
  const e1 = PL.polishEstimate(a, { css: true, forced: true, kindle: true }), e0 = PL.polishEstimate(a, {});
  ok(PL.polishEstimate({ info: { size: 3000 }, stats: { cssBytes: 0, forcedBytes: 0, fontBytes: 9000 }, issues: [] }, { kindle: true }).after === 150, 'הערכה לא יורדת לאפס בקובץ קטן');
  ok(e1.after === 5e6 - 30360 && e1.left === 1 && e0.after === 5e6 && e0.left === 2, 'הערכה: משקל (CSS בערך שליש אחרי כיווץ) ובעיות לפי המתגים');
  const m = PL.recMeta({ title: 'ס', author: 'א, ב', authorSort: 'א, א', tags: 'x, y', isbn: '', edit: { series: 'ס1', seriesIdx: '2' } });
  ok(m.authors.length === 2 && m.authors[0].sort === 'א, א' && m.tags.join() === 'x,y' && m.series === 'ס1' && m.seriesIndex === '2' && m.isbn === '', 'B6: פרטי הספרייה → writeOpfMeta');
  const pr = PL.fetchProposal({ title: 'T', isbn: '123', desc: '' }, { title: 'T', isbn: '999', desc: 'תקציר', authors: ['A'], cover: 'u' });
  ok(pr.desc === 'תקציר' && pr.author === 'A' && pr.cover === 'u' && !('isbn' in pr), 'D14: רק שדות ריקים, אף פעם לא דורסים');
  ok(PL.sameBook({ title: 'המכתבים של באפט' }, { title: 'המכתבים של באפט: מהדורה' }) && !PL.sameBook({ title: 'אחר' }, { title: 'ספר אחר לגמרי' }), 'D14: רק תוצאה של אותו ספר');
  const s1 = PL.readingStats(25000, 0.5, null, 'he'), s2 = PL.readingStats(25000, 0, { ms: 3600000, w: 18000 }, 'en');
  ok(s1.pages === 100 && Math.round(s1.leftMin) === Math.round(25000 / 180 / 2) && !s1.mine && s2.mine && s2.wpm === 300, 'D13: עמודים, זמן, וקצב אישי אחרי 10 דקות');
  ok(PL.fmtHours(125) === '2:05' && PL.countWords([{ t: 'שלום עולם, hello' }, { t: 'צה״ל 1965' }]) === 5, 'שעות ומילים');

  /* החיבור */
  const lib = read('library.js'), sw = read('sw.js'), cg = read('tools/coregen.js'), app = read('app.js'), lp = read('libpolish.js');
  ok(/import\('\.\/libpolish\.js'\)/.test(lib) && !/^import .*libpolish/m.test(lib), 'libpolish נטען רק בלחיצה');
  ok(sw.includes("'./libpolish.js'") && cg.includes("'libpolish.js'"), 'במטמון הספרייה ובמחרוזות של Academy');
  ok(/isMine: isMineBook/.test(lib) && /if \(!isMineBook\(b\)\) return;/.test(lib) && /if \(!E\.isMine\(b\)\) return;/.test(lp), 'רק ספרים של המשתמש');
  ok(/st\.put\(prev, PREV \+ id\)/.test(lib) && /st\.delete\(PREV \+ b\.id\)/.test(lib), 'הגרסה הקודמת נשמרת לביטול ונמחקת עם הספר');
  ok(/'pwa_libpace_v1'/.test(app.match(/const ACCOUNT_KEYS = \[[^\]]*\]/)[0]), 'קצב הקריאה = מפתח אישי (ACCOUNT_KEYS)');
  ok(/FETCH_GAP_MS = 2\d{3}/.test(lp), 'משיכת פרטים: לא יותר מ־30 בקשות בדקה (השרתון מגביל ל־40)');
  ok(!/innerHTML\s*=\s*[^'"]*\b(b\.title|val|x\.p)/.test(lp), 'בלי innerHTML עם נתוני ספר');

  /* הליטוש המלא — רק כשיש xmldom */
  let X = null;
  try { X = require('@xmldom/xmldom'); } catch (e) { try { X = require(path.join(process.env.XMLDOM_DIR || '', '@xmldom/xmldom')); } catch (e2) { X = null; } }
  if (X) {
    const o = { DOMParserImpl: X.DOMParser, XMLSerializerImpl: X.XMLSerializer, now: new Date('2026-11-01T00:00:00Z') };
    const bl = new Blob([fs.readFileSync(path.join(__dirname, 'fixtures/books/polish-he2.epub'))]);
    const d = await EK.polishBook(bl, EK.POLISH_ALL, Object.assign({ dry: true }, o));
    ok(d.blob === bl && d.stats.punct >= 7 && d.stats.bidi >= 4 && d.stats.cssBytes > 0 && d.stats.fontsRemoved === 1 && d.info.version === 2 && d.info.hebrew, 'polishBook dry: ספירה בלי קובץ חדש');
    ok(['no_language', 'missing_file', 'missing_img', 'broken_toc', 'unused_font'].every((c) => d.issues.some((i) => i.code === c)) && d.issues.find((i) => i.code === 'missing_img').fix === null, 'A10: כל הבעיות, תמונה חסרה = ידני');
    ok(d.stats.sample && d.stats.sample.b.length === d.stats.sample.a.length && d.stats.sample.a.includes('־'), 'דוגמה ל"לפני/אחרי" מהספר');
    const r = await EK.polishBook(bl, EK.POLISH_ALL, o);
    const rep = await EK.inspectEpub(r.blob, o);
    const opf = await EK.readText(r.blob, rep.zip.byName.get(rep.opfPath));
    ok(rep.ok && rep.version === '3.0' && rep.uid === 'urn:uuid:7d3f0c1e-0000-4000-8000-000000000001' && !rep.warnings.length, 'אחרי: EPUB 3 תקין, אותו מזהה, בלי אזהרות');
    ok(/properties="nav"/.test(opf) && /page-progression-direction="rtl"/.test(opf) && /property="file-as"/.test(opf) && !/opf:role|opf:scheme|opf:event/.test(opf) && !/Unused\.ttf/.test(opf) && /<dc:language>he<\/dc:language>/.test(opf), 'OPF: nav, כיוון, refines, בלי מאפייני opf: ישנים, בלי הגופן המיותר');
    const again = await EK.polishBook(r.blob, EK.POLISH_ALL, Object.assign({ dry: true }, o));
    const s = again.stats;
    ok(!s.punct && !s.bidi && !s.cssBytes && !s.forcedBytes && !s.fontsRemoved && !s.upgraded && again.issues.map((i) => i.code).join() === 'missing_img', 'ליטוש שני — אין מה לעשות (חוץ מהתמונה החסרה)');
    const he3 = await EK.polishBook(new Blob([fs.readFileSync(path.join(__dirname, 'fixtures/books/he-plain.epub'))]), EK.POLISH_DEFAULT, Object.assign({ dry: true }, o));
    ok(he3.info.version === 3 && !he3.stats.upgraded, 'EPUB 3 — בלי שדרוג');
  } else console.log('# xmldom לא מותקן — הליטוש המלא מדולג (בפיתוח: XMLDOM_DIR=<תיקייה עם node_modules>)');
  console.log(`\n${n} בדיקות עברו`);
})().catch((e) => { console.error(e); process.exit(1); });
