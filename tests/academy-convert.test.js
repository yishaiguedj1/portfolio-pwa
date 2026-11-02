// Academy Pro, גל 3 (02/11/2026): המרות — epubkit סעיף 15 (בניית EPUB, טקסט/Markdown/PDF → פרקים, ייצוא ל־Word/Markdown/טקסט)
// ו־libconvert.js (המסכים), והחיבור מ־library.js. הרצה: node tests/academy-convert.test.js
const fs = require('fs');
const path = require('path');
const assert = require('assert');
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; console.log('ok - ' + m); };
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

(async () => {
  const EK = await import(path.join(root, 'epubkit.js'));
  const NOW = new Date('2026-11-02T10:00:00Z');

  /* עזרים */
  ok(EK.guessLang('שלום עולם, this is') === 'he' && EK.guessLang('Hello world') === 'en', 'זיהוי שפה');
  ok(EK.dirOf('he') === 'rtl' && EK.dirOf('en-US') === 'ltr', 'כיוון לפי שפה');
  ok(EK.decodeEnt('&amp;&lt;&#1488;&#x5d1;&nbsp;&bogus;') === '&<אב &bogus;', 'פענוח ישויות');
  ok(EK.xmlSafe('a\u0001b\u000bc') === 'abc', 'תווים אסורים ב־XML מוסרים');
  ok(EK.bookUid('x') === EK.bookUid('x') && EK.bookUid('x') !== EK.bookUid('y') && /^urn:uuid:[0-9a-f-]{36}$/.test(EK.bookUid('x')), 'מזהה יציב');
  ok(['b2', 'a10', 'a2'].sort(EK.natSort).join() === 'a2,a10,b2', 'מיון טבעי (עמודי קומיקס)');
  ok(EK.safeFileName('a/b:c?', 'docx') === 'a b c.docx' && EK.safeFileName('', 'md') === 'book.md', 'שם קובץ בטוח');

  /* טקסט → פרקים */
  let ch = EK.textToChapters('פרק 1: התחלה\n\nפסקה ראשונה\nשל שתי שורות.\n\nפסקה שנייה.\n\nפרק 2\n\nעוד <טקסט> & סימנים.', { title: 'ספר' });
  ok(ch.length === 2 && ch[0].title === 'פרק 1: התחלה' && /<p>פסקה ראשונה של שתי שורות\.<\/p>/.test(ch[0].body), 'טקסט: פרקים לפי "פרק", שורות מתאחדות לפסקה');
  ok(/&lt;טקסט&gt; &amp;/.test(ch[1].body), 'טקסט: בריחה');
  ch = EK.textToChapters('שורה אחת\nשורה שתיים\nשורה שלוש', { title: 'ת' });
  ok(ch.length === 1 && (ch[0].body.match(/<p>/g) || []).length === 3, 'טקסט בלי שורות ריקות: כל שורה פסקה');
  ok(!EK.isHeadLine('פרק זה עוסק בהרבה דברים חשובים מאוד, ובפירוט רב.') && EK.isHeadLine('Chapter 12') && EK.isHeadLine('הקדמה'), 'כותרת = שורה קצרה בלי סוף משפט');
  ch = EK.textToChapters(Array.from({ length: 3000 }, (x, i) => 'פסקה ' + i + ' עם טקסט ארוך למדי כדי למלא.').join('\n\n'), { title: 'ארוך', headings: false });
  ok(ch.length >= 2 && ch[1].title === 'ארוך (2)', 'טקסט ארוך בלי כותרות — מפוצל לחלקים');

  /* Markdown */
  const md = '# כותרת\n\nפסקה עם **מודגש** ו־*נטוי* ו־`קוד` ו־[קישור](https://example.com).\n\n- א\n- ב\n\n1. אחד\n2. שתיים\n\n> ציטוט\n\n```\nx < 1\n```\n\n---\n\nכותרת שנייה\n-----------\n\n![תמונה](https://x/y.png)';
  const mh = EK.mdToHtml(md);
  ok(/<h1>כותרת<\/h1>/.test(mh) && /<b>מודגש<\/b>/.test(mh) && /<i>נטוי<\/i>/.test(mh) && /<code>קוד<\/code>/.test(mh) && /<a href="https:\/\/example.com">קישור<\/a>/.test(mh), 'Markdown: כותרת והדגשות');
  ok(/<ul><li>א<\/li><li>ב<\/li><\/ul>/.test(mh) && /<ol><li>אחד<\/li><li>שתיים<\/li><\/ol>/.test(mh) && /<blockquote><p>ציטוט<\/p><\/blockquote>/.test(mh), 'Markdown: רשימות וציטוט');
  ok(/<pre><code>x &lt; 1<\/code><\/pre>/.test(mh) && /<hr\/>/.test(mh) && /<h2>כותרת שנייה<\/h2>/.test(mh), 'Markdown: קוד, קו, כותרת בקו תחתון');
  ok(/<p>\[תמונה\]<\/p>/.test(mh) && !/<img/.test(mh), 'Markdown: תמונה מהרשת לא נכנסת (הספר עובד בלי רשת)');
  ok(!/<script/.test(EK.mdToHtml('<script>alert(1)</script>')), 'Markdown: HTML גולמי נבלע כטקסט');
  let sp = EK.splitBody('<p>הקדמה</p><h1>א</h1><p>1</p><h1>ב &amp; ג</h1><p>2</p>', { title: 'ספר' });
  ok(sp.length === 3 && sp[0].title === 'ספר' && sp[2].title === 'ב & ג', 'פיצול גוף לפי h1 (עם ההקדמה)');
  sp = EK.splitBody('<h2>א</h2><p>1</p><h2>ב</h2>', {});
  ok(sp.length === 2 && sp[0].title === 'א', 'בלי h1 — לפי h2');

  /* PDF → פרקים */
  const line = (s, y, h = 10, x = 50, w = 400) => ({ s, x, y, h, w });
  const pg = (nn, items) => ({ n: nn, w: 600, h: 800, items });
  const pages = [1, 2, 3, 4].map((i) => pg(i, [
    line('דוח שנתי 2025', 30, 9),                       // כותרת עליונה — חוזרת
    ...(i === 1 ? [line('מבוא', 100, 20)] : []),
    ...(i === 3 ? [line('פרק שני', 100, 20)] : []),
    line('זוהי שורה ראשונה של פסקה', 150), line('שממשיכה בשורה שנייה.', 163, 10, 150, 300),
    line('פסקה חדשה אחרי שורה קצרה.', 176),
    line(String(i), 770, 9, 290, 20),                    // מספר עמוד
  ]));
  pages.push(pg(5, []));                                 // סרוק
  const r = EK.pdfToChapters(pages, { title: 'דוח' });
  ok(r.scanned.length === 1 && r.scanned[0] === 5, 'PDF: עמוד בלי טקסט = סרוק');
  ok(r.removed >= 8 && !r.chapters.some((c) => /דוח שנתי 2025/.test(c.body)), 'PDF: כותרת עליונה ומספרי עמוד הוסרו');
  ok(r.chapters.length === 2 && r.chapters[0].title === 'מבוא' && r.chapters[1].title === 'פרק שני', 'PDF: פרקים לפי גופן גדול');
  ok(/<p>זוהי שורה ראשונה של פסקה שממשיכה בשורה שנייה\.<\/p>/.test(r.chapters[0].body) && /<p>פסקה חדשה אחרי שורה קצרה\.<\/p>/.test(r.chapters[0].body), 'PDF: שורות מתאחדות לפסקה, שורה קצרה בסוף משפט — פסקה חדשה');
  ok(/\u0001SCAN5\u0001/.test(r.chapters[1].body) && r.lang === 'he', 'PDF: סמן לעמוד הסרוק (התמונה נכנסת במקומו), שפה');
  const rtlL = EK.pdfLines(pg(1, [{ s: 'שלום', x: 300, y: 10, h: 10, w: 40 }, { s: 'עולם', x: 250, y: 10, h: 10, w: 40 }]));
  ok(rtlL[0].text === 'שלום עולם', 'PDF: סדר מימין לשמאל בשורה עברית');
  ok(EK.pdfLines(pg(1, [{ s: 'inter-', x: 10, y: 10, h: 10, w: 40 }])).length === 1 && EK.pdfToChapters([pg(1, [line('inter-', 10, 10, 10, 40), line('national trade', 23, 10, 10, 120)])]).chapters[0].body.includes('international trade'), 'PDF: מקף חיתוך באנגלית');

  /* בניית EPUB */
  const img = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]);
  const blob = await EK.buildEpub({ title: 'ספר <בדיקה>', author: 'מחבר', lang: 'he', chapters: [{ title: 'פרק 1', body: '<h1>פרק 1</h1><p>טקסט</p><img src="../Images/a.png" alt=""/>' }, { title: 'פרק 2', body: '<p>2</p>' }],
    images: [{ name: 'a.png', data: img, type: 'image/png' }], cover: { data: img, type: 'image/png' }, tocPage: true, now: NOW });
  const zip = await EK.readZip(blob);
  const names = zip.entries.map((e) => e.name);
  ok(names[0] === 'mimetype' && zip.entries[0].method === 0, 'EPUB: mimetype ראשון ולא דחוס');
  ok(['META-INF/container.xml', 'OEBPS/content.opf', 'OEBPS/nav.xhtml', 'OEBPS/toc.ncx', 'OEBPS/Styles/style.css', 'OEBPS/Text/ch001.xhtml', 'OEBPS/Text/ch002.xhtml', 'OEBPS/Images/a.png', 'OEBPS/Images/cover.png', 'OEBPS/Text/cover.xhtml'].every((x) => names.includes(x)), 'EPUB: כל הקבצים');
  const opf = await EK.readText(blob, zip.byName.get('OEBPS/content.opf'));
  ok(/<dc:title>ספר &lt;בדיקה&gt;<\/dc:title>/.test(opf) && /<dc:language>he<\/dc:language>/.test(opf) && /page-progression-direction="rtl"/.test(opf), 'EPUB: פרטים וכיוון מימין לשמאל');
  ok(/properties="cover-image"/.test(opf) && /properties="nav"/.test(opf) && /dcterms:modified">2026-11-02T10:00:00Z/.test(opf), 'EPUB 3: כריכה, nav, תאריך שינוי');
  ok(/<itemref idref="cover"\/>\n<itemref idref="nav"\/>/.test(opf), 'EPUB: תוכן עניינים בתחילת הספר (אחרי הכריכה)');
  const nav = await EK.readText(blob, zip.byName.get('OEBPS/nav.xhtml')), ncx = await EK.readText(blob, zip.byName.get('OEBPS/toc.ncx'));
  ok(/href="Text\/ch001.xhtml">פרק 1</.test(nav) && /<text>פרק 2<\/text><\/navLabel><content src="Text\/ch002.xhtml"/.test(ncx), 'EPUB: nav ו־ncx');
  const c1 = await EK.readText(blob, zip.byName.get('OEBPS/Text/ch001.xhtml'));
  ok(/dir="rtl"/.test(c1) && /lang="he"/.test(c1) && /href="..\/Styles\/style.css"/.test(c1), 'EPUB: פרק עם שפה, כיוון ועיצוב');
  ok(EK.zipKind(zip) === 'epub' || (await EK.classify(blob)) === 'epub', 'EPUB: מזוהה כספר');
  const fx = await EK.buildEpub({ title: 'קומיקס', lang: 'he', dir: 'rtl', fixed: { w: 800, h: 1200 }, chapters: [{ title: '', body: '<img src="../Images/p.png" alt=""/>' }], images: [{ name: 'p.png', data: img }], now: NOW });
  const fz = await EK.readZip(fx), fopf = await EK.readText(fx, fz.byName.get('OEBPS/content.opf')), fp = await EK.readText(fx, fz.byName.get('OEBPS/Text/ch001.xhtml'));
  ok(/rendition:layout">pre-paginated/.test(fopf) && /prefix="rendition:/.test(fopf) && /width=800, height=1200/.test(fp), 'EPUB בפריסה קבועה (קומיקס)');

  /* ייצוא */
  const blocks = EK.htmlBlocks('<html><head><style>p{}</style></head><body><h1>כותרת</h1><p>טקסט <b>מודגש</b> ו<i>נטוי</i><sup>1</sup> <a href="https://e.com">קישור</a></p><ul><li>א</li><li>ב</li></ul><blockquote><p>ציטוט</p></blockquote><img src="../Images/a.png" alt="תמונה"/><hr/><pre>a  b</pre></body></html>');
  ok(blocks[0].k === 'h' && blocks[0].l === 1 && blocks[1].r.some((x) => x.b && x.t === 'מודגש') && blocks[1].r.some((x) => x.sup) && blocks[1].r.some((x) => x.href === 'https://e.com'), 'בלוקים: כותרת, הדגשה, עילי, קישור');
  ok(blocks.filter((b) => b.li === 'ul').length === 2 && blocks.find((b) => b.q) && blocks.find((b) => b.k === 'img' && b.alt === 'תמונה') && blocks.find((b) => b.k === 'hr') && blocks.find((b) => b.pre && b.r[0].t === 'a  b'), 'בלוקים: רשימה, ציטוט, תמונה, קו, pre');
  ok(!blocks.some((b) => b.r && b.r.some((x) => /p\{\}/.test(x.t))), 'בלוקים: CSS לא נכנס לטקסט');
  const mdOut = EK.blocksToMd(blocks, { img: (b) => 'images/a.png' });
  ok(/^# כותרת/.test(mdOut) && /\*\*מודגש\*\*/.test(mdOut) && /\*נטוי\*/.test(mdOut) && /\[קישור\]\(https:\/\/e.com\)/.test(mdOut) && /- א\n- ב/.test(mdOut) && /> ציטוט/.test(mdOut) && /!\[תמונה\]\(images\/a.png\)/.test(mdOut) && /```\na  b\n```/.test(mdOut), 'Markdown מהספר');
  ok(EK.mdToHtml(mdOut).includes('<b>מודגש</b>'), 'Markdown הלוך־חזור');
  const tx = EK.blocksToText(blocks);
  ok(/^כותרת\n\nטקסט מודגש ונטוי1 קישור\n\n• א/.test(tx) && !/תמונה/.test(tx), 'טקסט מהספר — בלי תמונות');
  const parts = EK.docxParts([{ blocks }, { blocks: [{ k: 'p', r: [{ t: 'פרק <2> & ' }] }] }], { title: 'ספר', author: 'מחבר', lang: 'he', images: new Map([['../Images/a.png', { data: img, type: 'image/png', w: 1200, h: 600 }]]), now: NOW });
  const P = Object.fromEntries(parts.map((x) => [x.name, x.data]));
  ok(['[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'word/styles.xml', 'word/_rels/document.xml.rels', 'docProps/core.xml', 'word/media/image1.png'].every((k) => P[k]), 'Word: כל החלקים');
  const doc = P['word/document.xml'];
  ok(/<w:pStyle w:val="Heading1"\/><w:bidi\/>/.test(doc) && /<w:rtl\/><w:b\/>/.test(doc) && /<w:vertAlign w:val="superscript"\/>/.test(doc) && /<w:hyperlink r:id="rId\d+">/.test(doc), 'Word: כותרת, מימין לשמאל, הדגשה, עילי, קישור');
  ok(/<w:pageBreakBefore\/>/.test(doc) && /פרק &lt;2&gt; &amp; /.test(doc) && /<a:blip r:embed="rId\d+"\/>/.test(doc) && /cx="5943600" cy="2971800"/.test(doc), 'Word: מעבר עמוד בין פרקים, בריחה, תמונה בגודל הדף');
  ok(/Extension="png" ContentType="image\/png"/.test(P['[Content_Types].xml']) && /TargetMode="External"/.test(P['word/_rels/document.xml.rels']) && /w:outlineLvl w:val="0"/.test(P['word/styles.xml']), 'Word: סוגי תוכן, קשרים, סגנונות כותרת (ניווט ב־Word)');
  const dz = await EK.zipFiles(parts, { now: NOW }), dzz = await EK.readZip(dz);
  ok(dzz.entries[0].name === '[Content_Types].xml' && !dzz.byName.has('mimetype') && dz.type === 'application/zip', 'ZIP רגיל — בלי mimetype של EPUB');
  ok(UTF8(await EK.readEntry(dz, dzz.byName.get('word/document.xml'))) === doc, 'ZIP: התוכן נקרא בחזרה');

  /* libconvert.js — המסכים והחיבור */
  const lc = read('libconvert.js'), lib = read('library.js'), sw = read('sw.js');
  ok(/export function createConvert\(E\)/.test(lc) && /import\('\.\/libconvert\.js'\)/.test(lib), 'libconvert נטען רק כשנכנסים (import דינמי)');
  ok(!/^import /m.test(lc.replace(/^\s*\/\/.*$/gm, '')), 'libconvert בלי import סטטי — לא מכביד על פתיחת הספרייה');
  ok(/vendor\/pdfjs\/pdf\.min\.mjs/.test(lc) && /pdf\.worker\.min\.mjs/.test(lc) && /isEvalSupported:\s*false/.test(lc), 'pdf.js מה־vendor, בלי eval');
  ok(/vendor\/mammoth\/mammoth\.browser\.min\.js/.test(lc), 'mammoth מה־vendor');
  ok(fs.existsSync(path.join(root, 'vendor/pdfjs/LICENSE')) && /Apache License/.test(read('vendor/pdfjs/LICENSE')) && /BSD|Redistribution/.test(read('vendor/mammoth/LICENSE')), 'רישיונות הספריות בריפו (Apache-2, BSD-2)');
  ok(!/vendor\/pdfjs|vendor\/mammoth/.test(sw.match(/const LIB_SHELL = \[[\s\S]*?\];/)[0]), 'הספריות הכבדות לא במטמון הפתיחה (2MB) — רק כשממירים');
  ok(/'\.\/libconvert\.js'/.test(sw.match(/const LIB_SHELL = \[[\s\S]*?\];/)[0]), 'libconvert במטמון הספרייה');
  ok(!/innerHTML\s*=\s*[^'";]*\b(title|name|t\.|b\.title|txt|text)\b/.test(lc), 'בלי innerHTML עם שמות קבצים / טקסט מהמשתמש');
  ok(!/\b(confirm|alert|prompt)\(/.test(lc), 'בלי confirm/alert/prompt');
  ok(/convertKit\(\)/.test(lib) && /openAdd/.test(lib) && /openExport/.test(lib) && /toEpub/.test(lib), 'library: הוספה, ייצוא והמרה ל־EPUB מחוברים');
  ok(/\.cbz/.test(lc) && /\.docx/.test(lc) && /\.pdf/.test(lc) && /\.md/.test(lc) && /\.txt/.test(lc), 'סוגי הקבצים החדשים');
  ok(/'libconvert\.js'/.test(read('tools/coregen.js')) && /"cvBook": /.test(read('strings-academy.js')), 'coregen: המחרוזות של libconvert נכנסות ל־strings-academy (אחרת המסך מציג מפתחות)');
  ok(/blobs\.get\(u\)/.test(lc) && !/await fetch\(u\)\)\.text/.test(lc), 'המרת MOBI/FB2: קוראים את ה־blob מהזיכרון — CSP חוסם fetch ל־blob:');
  ok(/window\.addEventListener\('pointermove'/.test(lc), 'גרירת מאמרים על window — הזזה ב־DOM משחררת pointer capture');
  const css = read('library.css');
  ok(/html:has\(\.lib-veil\) \.lib-dial \{ visibility: hidden/.test(css) && /\.cv-paste\[hidden\]/.test(css), 'CSS: החוגה מוסתרת מתחת לגיליון, ו־hidden מנצח');
  console.log('# ' + n + ' בדיקות עברו');
})().catch((e) => { console.error(e); process.exit(1); });
function UTF8(u8) { return new TextDecoder().decode(u8); }
