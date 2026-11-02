// Academy Pro, גל 2 (02/11/2026): עורך הספר — epubkit סעיף 14 (חיפוש והחלפה, החלפה מחושבת, עריכה בדף, סידור קוד, השוואה,
// קישורים, פיצול/מיזוג, תוכן עניינים, הערות שוליים, גופנים) ו־bookedit.js (הפרויקט: שם, פיצול, שמירה), והחיבור מ־library.js.
// הרצה: node tests/academy-edit.test.js
const fs = require('fs');
const path = require('path');
const assert = require('assert');
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; console.log('ok - ' + m); };
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

const CH = '<?xml version="1.0" encoding="utf-8"?>\n<html xmlns="http://www.w3.org/1999/xhtml"><head><title>פרק 3</title></head><body>\n'
  + '<h1>פרק 1: מכתב</h1>\n<p class="a">ב־1965 קנתה &amp; <b>ברקשייר</b> את החברה.<sup>[4]</sup></p>\n<p>ראו פרק 3 ו־פרק 12.<sup>[7]</sup></p>\n'
  + '<h2 id="x">ביטוח</h2>\n<pre>[9] פרק 2</pre>\n<p>הערה<sup>[9]</sup></p>\n</body></html>';

(async () => {
  const EK = await import(path.join(root, 'epubkit.js'));
  const docs = [{ p: 'OEBPS/Text/ch01.xhtml', src: CH }];

  /* A3 — חיפוש בטקסט בלבד */
  let hits = EK.bookFind(docs, EK.makeFindRe('פרק'));
  ok(hits.length === 3, 'חיפוש בטקסט: לא בכותרת head ולא ב־pre (3)');
  ok(EK.bookFind(docs, EK.makeFindRe('class')).length === 0 && EK.bookFind(docs, EK.makeFindRe('class'), { code: true }).length === 1, 'תגיות — רק במצב קוד');
  ok(EK.bookFind(docs, EK.makeFindRe('קנתה &'))[0].m === 'קנתה &', 'ישויות מפוענחות בחיפוש');
  ok(EK.bookFind(docs, EK.makeFindRe('פרק 1', { word: true })).length === 1, 'מילה שלמה: "פרק 1" לא תופס "פרק 12"');
  assert.throws(() => EK.makeFindRe('(', { mode: 'regex' })); n++; console.log('ok - ביטוי לא תקין זורק (הממשק מציג)');

  /* A4 — החלפה מחושבת */
  hits = EK.bookFind(docs, EK.makeFindRe(EK.CALC.renum.q, { mode: 'regex' }));
  ok(hits.length === 3, 'מספור: [4] [7] [9] בטקסט, [9] שב־pre לא נתפס');
  const all9 = EK.bookFind(docs, EK.makeFindRe('\\[(\\d+)\\]', { mode: 'regex' }));
  let r = EK.bookReplace(docs, all9, (h, k) => EK.CALC.renum.f(h.m, k));
  ok(r.n === all9.length && /\[1\][\s\S]*\[2\]/.test(r.put.get(docs[0].p)) && r.put.get(docs[0].p).includes('<pre>[9] פרק 2</pre>'), 'מספור מחדש 1,2… ו־pre לא נגוע');
  hits = EK.bookFind(docs, EK.makeFindRe(EK.CALC.hebnum.q, { mode: 'regex' })); hits[0].skip = true;
  r = EK.bookReplace(docs, hits, (h) => EK.CALC.hebnum.f(h.m));
  ok(r.n === 2 && r.put.get(docs[0].p).includes('ראו פרק ג׳ ו־פרק י״ב') && r.put.get(docs[0].p).includes('פרק 1: מכתב'), 'פרק 3 → פרק ג׳, ודילוג נשמר');
  ok([1, 15, 16, 42, 115, 300, 999].map(EK.hebNumeral).join(' ') === 'א׳ ט״ו ט״ז מ״ב קט״ו ש׳ תתקצ״ט', 'מספרים עבריים');
  ok(EK.expandRep({ m: 'ב־37%', g: ['37'] }, '$1 אחוז ($n) $$', 5) === '37 אחוז (5) $', 'החלפה עם $1 $n $$');
  r = EK.bookReplace(docs, EK.bookFind(docs, EK.makeFindRe('החברה')), () => 'ה<חברה>&');
  ok(r.put.get(docs[0].p).includes('את ה&lt;חברה&gt;&amp;.'), 'טקסט מוחלף מקודד (לא שובר XHTML)');

  /* A2 — עריכה בדף */
  const e1 = EK.editText(CH, 'ב־1965 קנתה & ברקשייר את החברה.[4]', 'ב־1965 קנתה & ברקשייר את העסק.[4]');
  ok(e1 && e1.includes('<b>ברקשייר</b> את העסק.<sup>[4]</sup>'), 'עריכה בדף: רק ההפרש, התגיות נשארות');
  const e2 = EK.editText(CH, 'ב־1965 קנתה & ברקשייר', 'ב־1965 רכשה & ברקשייר');
  ok(e2 && e2.includes('ב־1965 רכשה &amp; <b>'), 'ישות נשמרת מקודדת');
  const e3 = EK.editText(CH, 'קנתה & ברקשייר את', 'קנתה את');
  ok(e3 && e3.includes('קנתה <b></b>את') || e3.includes('קנתה <b></b> את') || /קנתה (<b><\/b>)? ?את/.test(e3), 'מחיקה על פני כמה צמתים — התגיות נשארות');
  ok(EK.editText(CH, 'טקסט שלא קיים', 'x') === null, 'טקסט שלא נמצא → null');
  const IND = '<html><body>\n  <p>\n    שורה <i>ראשונה</i>\n    ושנייה.\n  </p>\n<p>אחרת</p></body></html>';
  const e4 = EK.editText(IND, 'שורה ראשונה ושנייה.', 'שורה ראשונה ושלישית.');
  ok(e4 && e4.includes('שורה <i>ראשונה</i>\n    ושלישית.\n  </p>'), 'פסקה עם הזחה: רק המילה שהשתנתה, ההזחה והתגיות נשארות');
  ok(EK.editText('<html><body><p>אותו</p><p>אותו</p></body></html>', 'אותו', 'אחר') === null, 'טקסט שמופיע פעמיים — לא מנחשים');
  const sc = EK.spliceCollapsed('a\n  b c', 'a b c', 'a x c'); ok(sc && 'a\n  b c'.slice(sc.a, sc.b) === 'b' && sc.ins === 'x', 'מיפוי מטקסט מכווץ למקור');
  ok(EK.editText(CH, 'ב־1965   קנתה', 'ב־1966 קנתה') !== null, 'רווחים מכווצים (כמו בקורא)');

  /* A16 — סידור */
  const messy = '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>t</title></head><body><h1>א</h1><p>ב<br>ג</p><pre>x  <b>y</b>\n z</pre><p>ד</p></body></html>';
  const t1 = EK.tidyXhtml(messy, { DOMParserImpl: null });
  ok(t1.ok === false || t1.src.includes('<br/>'), 'בלי מנתח — לא נוגעים או רק תיקונים בטוחים');
  ok(EK.closeInlines('<body><p>a <b>bold</p><p>c</p><p>x</i>y</p><p><a href="#"><em>z</a></p></body>') === '<body><p>a <b>bold</b></p><p>c</p><p>xy</p><p><a href="#"><em>z</em></a></p></body>',
    'תג עיצוב פתוח נסגר בסוף הפסקה שלו (לא נמרח על כל הפסקאות שאחריה), תג סוגר יתום נמחק');
  ok(EK.closeInlines('<?xml version="1.0"?><!-- <b> --><p>a<br/><span class="x">b</span></p>') === '<?xml version="1.0"?><!-- <b> --><p>a<br/><span class="x">b</span></p>', 'קוד תקין, הערות והצהרות — בלי שינוי');
  const fm = EK.formatMarkup('<body><h1>א</h1><p>ב <b>ג</b> ד</p><pre><p>x</p>   </pre></body>');
  ok(fm.includes('</h1>\n<p>ב <b>ג</b> ד</p>') && fm.includes('<pre><p>x</p>   </pre>'), 'שורה לכל בלוק, pre ושורות טקסט כמו שהם');
  const tc = EK.tidyCss('a{color:red;margin:0}/* x */b , c{x:"a;b"}');
  ok(tc.includes('a {\n  color: red;\n  margin: 0;\n}') && tc.includes('/* x */') && tc.includes('x: "a;b";'), 'CSS מסודר, מחרוזות והערות נשמרות');

  /* A7 — השוואה */
  const d = EK.diffLines('a\nb\nc\nd', 'a\nB\nc\nd\ne');
  ok(JSON.stringify(d) === JSON.stringify([['c', 'a'], ['r', 'b'], ['a', 'B'], ['c', 'c'], ['c', 'd'], ['a', 'e']]), 'השוואת שורות');
  ok(EK.diffLines('x\n'.repeat(3000), 'y\n'.repeat(3000), { maxCells: 1000 }).filter((x) => x[0] === 'r').length === 3000, 'קובץ ענק — בלי טבלה ריבועית');

  /* קישורים */
  const rr = EK.rewriteRefs('<a href="ch02.xhtml#x">a</a><img src="../Images/a%20b.jpg"/><a href="http://e.com">e</a><a href="#y">y</a>', 'OEBPS/Text/ch01.xhtml',
    (p, f) => p === 'OEBPS/Text/ch02.xhtml' ? { p: 'OEBPS/Text/new.xhtml', f } : p === 'OEBPS/Images/a b.jpg' ? { p: 'OEBPS/img/c.jpg', f } : null);
  ok(rr.includes('href="new.xhtml#x"') && rr.includes('src="../img/c.jpg"') && rr.includes('http://e.com') && rr.includes('href="#y"'), 'שינוי שם מעדכן קישורים יחסיים');
  ok(EK.rewriteRefs('a{background:url("../f/x.ttf")}', 'O/css/s.css', () => ({ p: 'O/fonts/y.ttf' }), { css: true }).includes('url("../fonts/y.ttf")'), 'url() ב־CSS');

  /* A9 — פיצול ומיזוג */
  const at = EK.splitPoints(CH, [1, 2]);
  ok(at.length === 1, 'נקודת פיצול: h2 בלבד (h1 בתחילה)');
  const parts = EK.splitDoc(CH, at);
  ok(parts.length === 2 && parts[1].startsWith('<?xml') && /<body>\n<h2 id="x">/.test(parts[1]) && parts[0].includes('[7]') && !parts[0].includes('ביטוח'), 'פיצול: שני מסמכים שלמים');
  const mg = EK.mergeDocs(parts);
  ok(mg.includes('[7]') && mg.includes('ביטוח') && (mg.match(/<body>/g) || []).length === 1, 'מיזוג חזרה');

  /* A8 — תוכן עניינים */
  const tf = EK.tocFromHeadings(docs, [1, 2]);
  ok(tf.items.length === 2 && tf.items[0].f === 'toc-1' && tf.items[1].f === 'x' && tf.items[1].lvl === 2 && tf.put.get(docs[0].p).includes('<h1 id="toc-1">'), 'תוכן עניינים מהכותרות, id למי שאין');
  const ts = EK.tocFromSelector([{ p: 'a.xhtml', src: '<html><body><p class="x chapter-title">פתיחה</p><p class="chapter-titles">לא</p><div class="chapter-title" id="d">שני</div></body></html>' }], 'p.chapter-title');
  ok(ts.items.length === 1 && ts.items[0].t === 'פתיחה' && ts.put.get('a.xhtml').includes('<p id="toc-1" class="x chapter-title">'), 'תוכן עניינים מאלמנט שבוחרים (p.class)');
  ok(EK.tocFromSelector([{ p: 'a.xhtml', src: '<html><body><div class="chapter-title" id="d">שני</div></body></html>' }], '.chapter-title').items[0].f === 'd', 'רק מחלקה (.class), id קיים נשמר');
  const NAV = '<html xmlns:epub="http://www.idpf.org/2007/ops"><body><nav epub:type="toc"><h2>תוכן</h2><ol><li><a href="Text/ch01.xhtml">א</a><ol><li><a href="Text/ch01.xhtml#x">ב &amp; ג</a></li></ol></li><li><a href="Text/ch02.xhtml">ד</a></li></ol></nav><nav epub:type="landmarks"><ol><li><a href="Text/ch01.xhtml">L</a></li></ol></nav></body></html>';
  const ni = EK.readNav(NAV, 'OEBPS/nav.xhtml');
  ok(ni.length === 3 && ni[1].lvl === 2 && ni[1].t === 'ב & ג' && ni[1].p === 'OEBPS/Text/ch01.xhtml' && ni[1].f === 'x' && ni[2].lvl === 1, 'קריאת nav');
  const nw = EK.writeNav(NAV, ni, 'OEBPS/nav.xhtml');
  ok(JSON.stringify(EK.readNav(nw, 'OEBPS/nav.xhtml')) === JSON.stringify(ni) && nw.includes('<h2>תוכן</h2>') && nw.includes('epub:type="landmarks"'), 'כתיבת nav — הלוך ושוב, landmarks נשאר');
  const NCX = '<ncx><head><meta name="dtb:depth" content="1"/></head><docTitle><text>t</text></docTitle><navMap><navPoint id="a" playOrder="1"><navLabel><text>א</text></navLabel><content src="Text/ch01.xhtml"/></navPoint></navMap></ncx>';
  const nx = EK.writeNcx(NCX, ni, 'OEBPS/toc.ncx');
  const back = EK.readNcx(nx, 'OEBPS/toc.ncx');
  ok(back.length === 3 && back[1].lvl === 2 && back[1].f === 'x' && nx.includes('content="2"') && nx.includes('<docTitle><text>t</text>'), 'כתיבת ncx — רמות, עומק, הכותר נשאר');

  /* A15 */
  const fnr = EK.addFootnote(CH, CH.indexOf('</p>'), 'מקור: <דוח>');
  ok(fnr.n === 1 && fnr.src.includes('xmlns:epub=') && fnr.src.includes('href="#fn1" id="fnref1">1</a></sup></p>') && fnr.src.includes('id="fn1"><p><a href="#fnref1">1</a> מקור: &lt;דוח&gt;</p></aside>\n</body>'), 'הערת שוליים: הפניה, הערה בסוף, namespace');
  ok(EK.addFootnote(fnr.src, 10, 'b').n === 2, 'הערה שנייה — מספר 2');
  ok(EK.newChapter('פרק <חדש>', { css: ['../Styles/s.css'] }).includes('<title>פרק &lt;חדש&gt;</title>') && EK.newChapter('x').includes('dir="rtl"'), 'פרק חדש');

  /* A13 — גופנים */
  const css = '@font-face{font-family:"Frank Ruhl";src:url(../Fonts/fr.ttf)} @font-face{font-family:Unused;src:url("../Fonts/u.otf")} body{font-family:"Frank Ruhl",serif} h1{font:bold 2em/1.2 Georgia, serif}';
  const ff = EK.fontFaces(css, 'OEBPS/Styles/s.css');
  ok(ff.length === 2 && ff[0].family === 'frank ruhl' && ff[0].srcs[0] === 'OEBPS/Fonts/fr.ttf', 'הגדרות @font-face');
  const used = EK.familiesUsed([css, '<p style="font-family: Arial">']);
  ok(used.has('frank ruhl') && used.has('georgia') && used.has('arial') && !used.has('unused'), 'אילו גופנים בשימוש (גם font: ו־style)');
  ok(EK.replaceFamily(css, 'Georgia', 'David Libre') === css && EK.replaceFamily('p{font-family:Georgia, serif}', 'georgia', 'David Libre') === 'p{font-family:"David Libre", serif}', 'החלפת משפחה');

  /* subsetTtf על גופן סינתטי: 4 גליפים, cmap format 4 ל־A,B,C */
  const ttf = makeTtf();
  const sub = EK.subsetTtf(ttf, new Set([0x41]));
  ok(sub && sub.kept === 2 && sub.of === 4 && sub.u8.length < ttf.length, 'הקטנה: נשארים .notdef ו־A');
  const subC = EK.subsetTtf(ttf, new Set([0x43]));
  ok(subC && subC.kept === 3, 'גליף מורכב (C) — גם הרכיב שלו (B) נשמר');
  ok(EK.codepointsOf(['שלום']).has(0x5e9) && EK.codepointsOf([]).has(0x30), 'התווים של הספר + ASCII');
  const sv = new DataView(sub.u8.buffer); let sum = 0; for (let i = 0; i < sub.u8.length; i += 4) sum = (sum + sv.getUint32(i)) >>> 0;
  ok(sum === 0xB1B0AFBA, 'checkSumAdjustment תקין');
  ok(EK.subsetTtf(new Uint8Array([0x77, 0x4f, 0x46, 0x46, 0, 0, 0, 0, 0, 0, 0, 0])) === null, 'WOFF → לא נוגעים');

  /* bookedit.js — חיבורים וכללים */
  const be = read('bookedit.js'), lib = read('library.js');
  ok(/import\('\.\/bookedit\.js'\)/.test(lib) && !/^import .*bookedit/m.test(lib), 'bookedit נטען בעצלות');
  ok(/CP\s*=\s*'cp:'/.test(lib) && /delFiles\(/.test(lib) && !/st\.delete\((?:b\.)?id\); st\.delete\(PREV/.test(lib.replace(/function delFiles[\s\S]*?\n}/, '')) && (lib.match(/delFiles\(st, (?:b\.)?id\)/g) || []).length === 6, 'מחיקת ספר מוחקת גם את נקודות השמירה (פונקציה אחת)');
  ok(/E\.isMine\(b\)/.test(be) && /E\.saveEdited\(/.test(be) && /function saveEdited[\s\S]{0,200}cpAdd\(/.test(lib), 'רק ספר של המשתמש; נקודת שמירה לפני כל שמירה');
  ok(/sandbox', 'allow-same-origin'\)/.test(be) && !/allow-scripts/.test(be), 'התצוגה בלי סקריפטים');
  const BE = await import(path.join(root, 'bookedit.js'));
  ok(BE.openTagAt('<body><p>שלום <b>x</b> ', 25) === 'p' && BE.openTagAt('<p><br/><img src="a"/>', 22) === 'p', 'סגירת תגית אוטומטית: התגית הפתוחה');
  ok(BE.hlLines('<!-- a\nb -->\n<p class="x">', false).split('be-ln').length === 4 && BE.hlXml('<p class="x">&amp;</p>').includes('<span class="tk-a">class</span>'), 'הדגשת תחביר לפי שורות');
  ok(BE.hlCss('a { color: red; }').includes('<span class="tk-a">color</span>'), 'הדגשת CSS');
  ok(/edHere/.test(lib) && /isMineBook\(/.test(lib.slice(lib.indexOf('edHere') - 400, lib.indexOf('edHere') + 400)), 'ערוך כאן — רק בספר של המשתמש');
  const app = read('app.js');
  { const m = /const BLOCK_RE = (\/.*\/i);/.exec(lib); const re = m && eval(m[1]);
    ok(!!re && re.test('p') && re.test('P') && re.test('h2') && !re.test('html') && !re.test('body'), 'blockOf: תגים באותיות קטנות (XHTML), ולא עולה עד html'); }
  for (const k of ['beTitle', 'beFind', 'beVersions', 'beToc', 'beFiles', 'edHere']) ok(new RegExp('\\b' + k + ':').test(app), 'מחרוזת ' + k);
  console.log('\n' + n + ' בדיקות עברו');
})().catch((e) => { console.error(e); process.exit(1); });

function makeTtf() {
  // גליפים: 0 ריק(4 בתים), 1=A (12), 2=B (12), 3=C מורכב מ־2 (16). cmap format 4: A→1 B→2 C→3
  const glyphs = [new Uint8Array(4), new Uint8Array(12).fill(1), new Uint8Array(12).fill(2), (() => { const g = new Uint8Array(16); const v = new DataView(g.buffer); v.setInt16(0, -1); v.setUint16(10, 0); v.setUint16(12, 2); return g; })()];
  glyphs[1][0] = 0; glyphs[1][1] = 1; glyphs[2][0] = 0; glyphs[2][1] = 1;
  const glyf = new Uint8Array(glyphs.reduce((a, g) => a + g.length, 0)); let o = 0; const offs = [];
  glyphs.forEach((g) => { offs.push(o); glyf.set(g, o); o += g.length; }); offs.push(o);
  const loca = new Uint8Array(offs.length * 4); offs.forEach((x, i) => new DataView(loca.buffer).setUint32(i * 4, x));
  const head = new Uint8Array(54); new DataView(head.buffer).setInt16(50, 1);
  const maxp = new Uint8Array(6); new DataView(maxp.buffer).setUint16(4, 4);
  const segs = [[0x41, 0x43, 1 - 0x41], [0xffff, 0xffff, 1]];
  const sc = segs.length, cmap = new Uint8Array(12 + 16 + sc * 8); const cv = new DataView(cmap.buffer);
  cv.setUint16(2, 1); cv.setUint16(4, 3); cv.setUint16(6, 1); cv.setUint32(8, 12);
  cv.setUint16(12, 4); cv.setUint16(14, 16 + sc * 8); cv.setUint16(18, sc * 2);
  segs.forEach((s, i) => { cv.setUint16(26 + i * 2, s[1]); cv.setUint16(28 + sc * 2 + i * 2, s[0]); cv.setInt16(28 + sc * 4 + i * 2, s[2]); cv.setUint16(28 + sc * 6 + i * 2, 0); });
  const T = [['cmap', cmap], ['glyf', glyf], ['head', head], ['loca', loca], ['maxp', maxp]];
  let total = 12 + T.length * 16; T.forEach(([, d]) => { total += (d.length + 3) & ~3; });
  const out = new Uint8Array(total), v = new DataView(out.buffer); v.setUint32(0, 0x00010000); v.setUint16(4, T.length);
  let at = 12 + T.length * 16;
  T.forEach(([tag, d], i) => { for (let k = 0; k < 4; k++) out[12 + i * 16 + k] = tag.charCodeAt(k); v.setUint32(12 + i * 16 + 8, at); v.setUint32(12 + i * 16 + 12, d.length); out.set(d, at); at += (d.length + 3) & ~3; });
  return out;
}
