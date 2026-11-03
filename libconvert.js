// Academy Pro, גל 3 (02/11/2026): המרות — נטען רק כשנכנסים (כמו libpolish.js / bookedit.js).
// C1 MOBI/AZW3 ו־C2 FB2 → EPUB (דרך foliate שכבר בקורא), C3 Word (mammoth, BSD-2), C4 PDF (pdf.js, Apache-2), C6 טקסט/Markdown/HTML,
// C9 קומיקס (CBZ / תמונות → EPUB בפריסה קבועה), C13 ספר מכמה מאמרים, C7 ייצוא ל־PDF (חלון ההדפסה), C8 ל־Word/Markdown/טקסט.
// הליבה הטהורה ב־epubkit.js סעיף 15. הספריות הכבדות ב־vendor/ ונטענות רק בהמרה (לא במטמון הפתיחה).
// כללים: הכל בטלפון, בלי שרת ובלי עלות; תוצאה = EPUB רגיל שנכנס ל"הספרייה שלי" (קורא, ליטוש ועורך עובדים עליו).
let EKP = null;
const kit = () => (EKP || (EKP = import('./epubkit.js')));
const OPF_NS = 'http://www.idpf.org/2007/opf';
const PDF_SRC = './vendor/pdfjs/pdf.min.mjs', PDF_WORKER = './vendor/pdfjs/pdf.worker.min.mjs', MAMMOTH_SRC = './vendor/mammoth/mammoth.browser.min.js';
export const DOC_ACCEPT = '.docx,.pdf,.txt,.text,.md,.markdown,.html,.htm,.xhtml,application/pdf,text/plain,text/markdown,text/html,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const COMIC_ACCEPT = '.cbz,image/jpeg,image/png,image/webp,image/gif';
export const ART_ACCEPT = '.docx,.txt,.text,.md,.markdown,.html,.htm,text/plain,text/markdown,text/html,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export function kindOf(name) {
  const e = String(name || '').toLowerCase().split('.').pop();
  return e === 'docx' ? 'docx' : e === 'pdf' ? 'pdf' : e === 'txt' || e === 'text' ? 'txt' : e === 'md' || e === 'markdown' ? 'md' : /^x?html?$/.test(e) ? 'html'
    : e === 'cbz' ? 'cbz' : /^(jpe?g|png|webp|gif)$/.test(e) ? 'img' : /^(epub|mobi|azw3?|kf8|fb2|fbz)$/.test(e) ? 'book' : '';
}
const baseName = (n) => String(n || '').replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim();
const wordsOf = (html) => (String(html).replace(/<[^>]*>/g, ' ').match(/[\p{L}\p{N}][\p{L}\p{N}\p{M}'׳״-]*/gu) || []).length;

export function createConvert(E) {
  const { h, T } = E;
  const flash = (m) => E.flash && E.flash(m);
  const btn = (cls, txt, fn) => { const b = h('button', cls, txt); b.type = 'button'; if (fn) b.addEventListener('click', fn); return b; };
  const rowL = (t, s) => { const l = h('span', 'pl-rl'); l.append(h('span', 'pl-rt', t)); if (s) l.append(h('span', 'pl-rs', s)); return l; };
  const badge = (txt) => h('span', 'cv-ic', txt);
  const swRow = (S, k, t, s) => { const r = h('div', 'lib-row pl-row'); r.append(rowL(t, s), E.swEl(!!S[k], (v) => { S[k] = v; }, t)); return r; };
  const group = (title, rows) => { const g = h('div', 'pl-g'); if (title) g.append(h('div', 'pl-gh', title)); const c = h('div', 'lib-ios pl-card'); rows.forEach((x) => x && c.append(x)); g.append(c); return g; };
  function seg(opts, cur, onPick) {                  // [[value, label]] — בורר מקטעים (ת־עיצוב: גלולה)
    const w = h('div', 'cv-seg'); w.setAttribute('role', 'radiogroup');
    const paint = () => [...w.children].forEach((b) => b.setAttribute('aria-checked', String(b.dataset.v === cur)));
    for (const [v, l] of opts) { const b = btn('cv-segb', l, () => { cur = v; paint(); onPick(v); }); b.dataset.v = v; b.setAttribute('role', 'radio'); w.append(b); }
    paint(); return w;
  }
  function fileInput(accept, multiple, onFiles) {
    const inp = h('input'); inp.type = 'file'; inp.accept = accept; inp.multiple = !!multiple; inp.hidden = true;
    inp.addEventListener('change', () => { const fs = Array.from(inp.files || []); inp.value = ''; if (fs.length) onFiles(fs); });
    return inp;
  }
  function pickRow(ic, t, s, accept, multiple, onFiles) {   // שורה = <label> עם קלט קובץ — הבורר נפתח בתוך הנגיעה
    const r = h('label', 'lib-row pl-row cv-pick'); r.append(badge(ic), rowL(t, s), fileInput(accept, multiple, onFiles));
    const ch = h('span', 'pl-chev'); ch.setAttribute('aria-hidden', 'true'); ch.innerHTML = E.chev || ''; r.append(ch);
    return r;
  }

  /* ---------- טעינת הספריות (רק בהמרה) ---------- */
  let PDFJS = null;
  async function pdfjs() {
    if (!PDFJS) {
      const m = await import(PDF_SRC);
      m.GlobalWorkerOptions.workerSrc = new URL(PDF_WORKER, import.meta.url).href;
      PDFJS = m;
    }
    return PDFJS;
  }
  let MAM = null;
  function mammoth() {
    if (MAM) return MAM;
    MAM = new Promise((res, rej) => {
      if (window.mammoth) return res(window.mammoth);
      const s = document.createElement('script'); s.src = new URL(MAMMOTH_SRC, import.meta.url).href;
      s.onload = () => (window.mammoth ? res(window.mammoth) : rej(new Error('mammoth')));
      s.onerror = () => { MAM = null; rej(new Error('mammoth')); };
      document.head.append(s);
    });
    return MAM;
  }

  /* ---------- מקור → { title, author, lang, chapters, images, cover, fixed } ---------- */
  async function decodeText(file) {
    const EK = await kit(), u8 = new Uint8Array(await file.arrayBuffer());
    if (EK.isUtf8(u8)) return new TextDecoder('utf-8').decode(u8);
    try { return new TextDecoder('windows-1255').decode(u8); } catch (e) { return new TextDecoder('utf-8').decode(u8); }   // טקסט עברי ישן — לרוב windows-1255
  }
  let imgN = 0;
  async function htmlToBody(html, images, prefix) {   // HTML (מ־mammoth / קובץ) → גוף XHTML; תמונות data: נכנסות לספר, מהרשת — לא
    const EK = await kit();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('script,style,link,meta,iframe,object,embed,form,input,button,noscript').forEach((x) => x.remove());
    for (const el of doc.querySelectorAll('*')) for (const a of [...el.attributes]) if (/^on/i.test(a.name) || a.name === 'style' || a.name === 'class') el.removeAttribute(a.name);
    for (const a of doc.querySelectorAll('a[href]')) if (!/^(https?:|#)/i.test(a.getAttribute('href'))) a.removeAttribute('href');
    for (const im of [...doc.querySelectorAll('img')]) {
      const src = im.getAttribute('src') || '';
      const m = /^data:(image\/[a-z0-9.+-]+);base64,(.*)$/i.exec(src);
      if (!m) { im.replaceWith(doc.createTextNode(im.getAttribute('alt') ? '[' + im.getAttribute('alt') + ']' : '')); continue; }
      const data = EK.b64ToBytes(m[2]), name = (prefix || 'img') + (++imgN) + '.' + EK.extOfMime(m[1]);
      images.push({ name, data, type: m[1] });
      for (const a of [...im.attributes]) if (a.name !== 'alt') im.removeAttribute(a.name);
      im.setAttribute('src', '../Images/' + name); if (!im.hasAttribute('alt')) im.setAttribute('alt', '');
    }
    const ser = new XMLSerializer();
    return [...doc.body.childNodes].map((n) => ser.serializeToString(n)).join('\n').replace(/ xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/g, '');
  }
  async function srcOf(file, opt, onProg) {
    const EK = await kit(), k = kindOf(file.name), title = baseName(file.name);
    if (k === 'txt') { const t = await decodeText(file); return { title, lang: EK.guessLang(t), chapters: EK.textToChapters(t, { title, headings: opt.headings }), images: [] }; }
    if (k === 'md') { const t = await decodeText(file); const body = EK.mdToHtml(t); const h1 = /^#\s+(.+)$/m.exec(t); return { title: (h1 && h1[1].trim()) || title, lang: EK.guessLang(t), chapters: opt.headings ? EK.splitBody(body, { title }) : [{ title, body }], images: [] }; }
    if (k === 'html') {
      const t = await decodeText(file), images = [], body = await htmlToBody(t, images);
      const tt = /<title[^>]*>([^<]*)<\/title>/i.exec(t);
      return { title: (tt && EK.decodeEnt(tt[1]).trim()) || title, lang: EK.guessLang(body.replace(/<[^>]*>/g, ' ')), chapters: opt.headings ? EK.splitBody(body, { title }) : [{ title, body }], images };
    }
    if (k === 'docx') {
      const M = await mammoth(); onProg && onProg(0.3);
      const r = await M.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
      const images = [], body = await htmlToBody(r.value || '', images);
      const plain = body.replace(/<[^>]*>/g, ' ');
      return { title, lang: EK.guessLang(plain), chapters: opt.headings ? EK.splitBody(body, { title }) : [{ title, body }], images };
    }
    if (k === 'pdf') return pdfSrc(file, opt, onProg);
    if (k === 'cbz' || k === 'img') return comicSrc([file], opt, onProg);
    throw Object.assign(new Error('type'), { msg: 'cvBadType' });
  }
  async function renderPage(page, maxW, q = 0.82) {
    const vp1 = page.getViewport({ scale: 1 }), scale = Math.min(2.5, maxW / vp1.width), vp = page.getViewport({ scale });
    const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', q));
    c.width = c.height = 0;
    return { data: new Uint8Array(await blob.arrayBuffer()), w: Math.round(vp.width), h: Math.round(vp.height) };
  }
  async function pdfInfo(file) {                      // מספר עמודים — לכותרת החלון
    const P = await pdfjs();
    const doc = await P.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false, disableFontFace: true, useSystemFonts: false }).promise;
    const n = doc.numPages; doc.destroy(); return { pages: n };
  }
  async function pdfSrc(file, opt, onProg) {
    const EK = await kit(), P = await pdfjs();
    const doc = await P.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false, disableFontFace: true, useSystemFonts: false }).promise;
    let meta = {}; try { meta = ((await doc.getMetadata()) || {}).info || {}; } catch (e) {}
    const title = String(meta.Title || '').trim() || baseName(file.name), author = String(meta.Author || '').trim();
    const N = doc.numPages, images = [];
    try {
      if (opt.pdfMode === 'img') {                    // תמונות עמודים: כל עמוד כמו שהוא, בפריסה קבועה
        const chapters = [];
        for (let i = 1; i <= N; i++) {
          const pg = await doc.getPage(i), im = await renderPage(pg, 1400); pg.cleanup();
          const name = 'p' + String(i).padStart(4, '0') + '.jpg'; images.push({ name, data: im.data, type: 'image/jpeg' });
          chapters.push({ title: i === 1 ? title : '', body: '<img src="../Images/' + name + '" alt=""/>', w: im.w, h: im.h });
          onProg && onProg(i / N, i, N);
        }
        return { title, author, lang: 'he', chapters, images, cover: { data: images[0].data, type: 'image/jpeg' }, fixed: { w: chapters[0].w, h: chapters[0].h }, pages: N, scanned: [] };
      }
      const pages = [];
      for (let i = 1; i <= N; i++) {
        const pg = await doc.getPage(i), vp = pg.getViewport({ scale: 1 }), tc = await pg.getTextContent();
        const items = [];
        for (const it of tc.items) {
          if (!it.str) continue;
          const t = P.Util.transform(vp.transform, it.transform), hh = Math.hypot(t[2], t[3]) || it.height;
          items.push({ s: it.str, x: t[4], y: t[5] - hh, h: hh, w: it.width * (vp.scale || 1) });
        }
        pages.push({ n: i, w: vp.width, h: vp.height, items });
        pg.cleanup();
        onProg && onProg(i / N * 0.8, i, N);
      }
      const r = EK.pdfToChapters(pages, { title, headings: opt.headings, strip: opt.strip });
      const scanImg = new Map();
      for (const n of r.scanned) {                     // עמוד סרוק — התמונה במקומו, כדי ששום דבר לא יאבד
        const pg = await doc.getPage(n), im = await renderPage(pg, 1200); pg.cleanup();
        const name = 'scan' + String(n).padStart(4, '0') + '.jpg'; images.push({ name, data: im.data, type: 'image/jpeg' }); scanImg.set(n, name);
      }
      const chapters = r.chapters.map((c) => Object.assign({}, c, { body: c.body.replace(/\u0001SCAN(\d+)\u0001/g, (m, n) => '<div class="pg"><img src="../Images/' + scanImg.get(+n) + '" alt=""/></div>') }));
      let cover = null;
      try { const pg = await doc.getPage(1), im = await renderPage(pg, 900, 0.85); pg.cleanup(); cover = { data: im.data, type: 'image/jpeg' }; } catch (e) {}
      return { title, author, lang: r.lang, chapters, images, cover, pages: N, scanned: r.scanned };
    } finally { try { doc.destroy(); } catch (e) {} }
  }
  async function comicSrc(files, opt, onProg) {       // CBZ אחד, או כמה תמונות → עמוד לכל תמונה
    const EK = await kit(), pics = [];
    for (const f of files) {
      if (kindOf(f.name) === 'cbz') {
        const z = await EK.readZip(f);
        const es = z.entries.filter((e) => /\.(jpe?g|png|webp|gif)$/i.test(e.name) && !/(^|\/)(__MACOSX|\.)/.test(e.name)).sort((a, b) => EK.natSort(a.name, b.name));
        for (const e of es) pics.push({ data: await EK.readEntry(f, e), name: e.name });
      } else if (kindOf(f.name) === 'img') pics.push({ data: new Uint8Array(await f.arrayBuffer()), name: f.name });
    }
    if (kindOf(files[0].name) === 'img') pics.sort((a, b) => EK.natSort(a.name, b.name));
    if (!pics.length) throw Object.assign(new Error('empty'), { msg: 'cvNoPages' });
    const images = [], chapters = [];
    pics.forEach((p, i) => {
      const ext = p.name.split('.').pop().toLowerCase().replace('jpeg', 'jpg'), name = 'p' + String(i + 1).padStart(4, '0') + '.' + ext;
      const sz = EK.imageSize(p.data) || { w: 1200, h: 1800 };
      images.push({ name, data: p.data, type: EK.mimeOfName(name) });
      chapters.push({ title: i === 0 ? baseName(files[0].name) : '', body: '<img src="../Images/' + name + '" alt=""/>', w: sz.w, h: sz.h });
      onProg && onProg((i + 1) / pics.length);
    });
    return { title: baseName(files[0].name), lang: 'he', dir: opt.dir || 'rtl', chapters, images, cover: { data: images[0].data, type: images[0].type }, fixed: { w: chapters[0].w, h: chapters[0].h } };
  }
  /* C1/C2: ספר שהקורא פותח (MOBI/AZW3/FB2/CBZ) → EPUB — הפרקים כמו שהקורא טוען אותם, התמונות והעיצוב נכנסים לספר */
  /* הקורא מחזיר כתובות blob: — וה־CSP (connect-src) חוסם fetch אליהן. לכן בזמן ההמרה שומרים את ה־Blob של כל כתובת שנוצרת,
     וקוראים ממנו ישירות (בלי רשת) */
  async function foliateSrc(file) {
    const blobs = new Map(), orig = URL.createObjectURL;
    URL.createObjectURL = function (o) { const u = orig.call(URL, o); if (o instanceof Blob) blobs.set(u, o); return u; };
    try { return await foliateSrcIn(file, async (u) => blobs.get(u) || (await fetch(u)).blob()); }
    finally { URL.createObjectURL = orig; }
  }
  async function foliateSrcIn(file, blobOf) {
    const EK = await kit(), book = await E.makeBook(file);
    const md = book.metadata || {}, lt = (x) => typeof x === 'string' ? x : x && typeof x === 'object' ? (x.name ? lt(x.name) : Object.values(x)[0] || '') : '';
    const title = lt(md.title) || baseName(file.name), author = Array.isArray(md.author) ? md.author.map(lt).filter(Boolean).join(', ') : lt(md.author);
    const lang = (Array.isArray(md.language) ? md.language[0] : md.language) || 'he';
    const images = [], fonts = [], css = [], seen = new Map();
    const grab = async (u, kind) => {                // blob: מהקורא → קובץ בספר (פעם אחת לכל כתובת)
      if (seen.has(u)) return seen.get(u);
      let rel = '';
      try {
        const b = await blobOf(u), t = b.type || '';
        if (kind === 'css' || /css/.test(t)) {
          let txt = await b.text();
          const urls = [...new Set([...txt.matchAll(/url\(\s*["']?(blob:[^"')\s]+)["']?\s*\)/g)].map((m) => m[1]))];
          for (const x of urls) { const rr = await grab(x, 'res'); txt = txt.split(x).join(rr ? '../' + rr.replace(/^\.\.\//, '') : ''); }
          css.push(txt); rel = ''; seen.set(u, ''); return '';
        }
        const data = new Uint8Array(await b.arrayBuffer());
        if (/font|woff|ttf|otf|opentype/.test(t)) { const name = 'f' + (fonts.length + 1) + '.' + (/woff2/.test(t) ? 'woff2' : /woff/.test(t) ? 'woff' : /otf|opentype/.test(t) ? 'otf' : 'ttf'); fonts.push({ name, data, type: t || EK.mimeOfName(name) }); rel = '../Fonts/' + name; }
        else { const sz = EK.imageSize(data); const ty = t || 'image/jpeg'; const name = 'i' + (images.length + 1) + '.' + EK.extOfMime(ty); images.push({ name, data, type: ty, w: sz && sz.w, h: sz && sz.h }); rel = '../Images/' + name; }
      } catch (e) { rel = ''; }
      seen.set(u, rel); return rel;
    };
    const chapters = [], ser = new XMLSerializer();
    const tocMap = new Map();
    const walk = (items, lvl) => (items || []).forEach((it) => { try { const r = book.resolveHref(it.href); if (r && r.index != null && !tocMap.has(r.index)) tocMap.set(r.index, { t: String(it.label || '').trim(), lvl }); } catch (e) {} walk(it.subitems, lvl + 1); });
    walk(book.toc, 1);
    const secs = (book.sections || []).filter((s) => s.linear !== 'no' || true);
    for (let i = 0; i < secs.length; i++) {
      const s = secs[i];
      let u = '';
      try { u = await s.load(); } catch (e) { continue; }
      if (!u) continue;
      let html = '';
      try { html = await (await blobOf(u)).text(); } catch (e) { continue; }
      const isComic = /^image\//.test(s.mediaType || '') || /\.(jpe?g|png|gif|webp)$/i.test(s.id || '');
      if (isComic) { const rel = await grab(u, 'img'); if (rel) chapters.push({ title: i === 0 ? title : '', body: '<div class="pg"><img src="' + rel + '" alt=""/></div>' }); continue; }
      const doc = new DOMParser().parseFromString(html, /<\?xml|xmlns=/.test(html.slice(0, 500)) ? 'application/xhtml+xml' : 'text/html');
      if (doc.getElementsByTagName('parsererror').length) continue;
      for (const l of [...doc.querySelectorAll('link[rel~="stylesheet"][href^="blob:"]')]) await grab(l.getAttribute('href'), 'css');
      for (const st of [...doc.querySelectorAll('style')]) css.push(st.textContent || '');
      for (const el of [...doc.querySelectorAll('img[src^="blob:"], image')]) {
        const a = el.tagName.toLowerCase() === 'image' ? (el.getAttribute('href') != null ? 'href' : 'xlink:href') : 'src';
        const v = el.getAttribute(a) || el.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || '';
        if (!/^blob:/.test(v)) continue;
        const rel = await grab(v, 'img');
        if (a === 'xlink:href') el.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', rel); else el.setAttribute(a, rel);
      }
      for (const el of [...doc.querySelectorAll('[src^="blob:"], [href^="blob:"]')]) { el.removeAttribute('src'); if (/^blob:/.test(el.getAttribute('href') || '')) el.removeAttribute('href'); }
      const body = doc.body || doc.querySelector('body');
      if (!body) continue;
      const inner = [...body.childNodes].map((n) => ser.serializeToString(n)).join('').replace(/ xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/g, '');
      const tc = tocMap.get(i);
      chapters.push({ title: tc ? tc.t : '', body: inner, lvl: tc ? tc.lvl : 1 });
      try { s.unload && s.unload(); } catch (e) {}
    }
    let cover = null;
    try { const cb = await book.getCover(); if (cb) cover = { data: new Uint8Array(await cb.arrayBuffer()), type: cb.type || 'image/jpeg' }; } catch (e) {}
    try { book.destroy && book.destroy(); } catch (e) {}
    if (!chapters.length) throw Object.assign(new Error('empty'), { msg: 'cvEmpty' });
    const fixedLayout = book.rendition && book.rendition.layout === 'pre-paginated';
    return { title, author, lang, dir: book.dir || '', chapters, images, fonts, css: css.join('\n'), cover, fixed: fixedLayout ? { w: 1200, h: 1800 } : null };
  }
  async function toEpubBlob(src, opt) {
    const EK = await kit();
    let blob = await EK.buildEpub({ title: src.title, author: src.author, lang: src.lang, dir: src.dir || EK.dirOf(src.lang), chapters: src.chapters, images: src.images, fonts: src.fonts, css: src.css,
      cover: src.cover, fixed: src.fixed, tocPage: opt.tocPage });
    if (opt.polish && src.lang === 'he' && !src.fixed) {
      try { blob = (await EK.polishBook(blob, { punct: true, bidi: true, forced: {} })).blob; } catch (e) {}
    }
    return new File([blob], EK.safeFileName(src.title, 'epub'), { type: 'application/epub+zip' });
  }

  /* ---------- החלון: הוספה לספרייה ---------- */
  function openAdd() {
    E.sheet(T('cvAddT'), (sh, close) => {
      const box = h('div', 'pl'); sh.append(box);
      const go = (fn) => (files) => E.closeSheetThen(sh.parentNode, () => fn(files));
      box.append(group('', [
        (() => { const r = h('label', 'lib-row pl-row cv-pick'); r.append(badge('EPUB'), rowL(T('cvBook'), T('cvBookS')), E.bookInput(close)); const ch = h('span', 'pl-chev'); ch.setAttribute('aria-hidden', 'true'); ch.innerHTML = E.chev || ''; r.append(ch); return r; })(),
        pickRow('DOC', T('cvDoc'), T('cvDocS'), DOC_ACCEPT, true, go((fs) => openConvert(fs, 'doc'))),
        pickRow('CBZ', T('cvComic'), T('cvComicS'), COMIC_ACCEPT, true, go((fs) => openConvert(fs, 'comic'))),
        (() => { const r = btn('lib-row pl-row cv-pick', null, () => E.closeSheetThen(sh.parentNode, () => openArticles())); r.append(badge('+N'), rowL(T('cvArts'), T('cvArtsS'))); const ch = h('span', 'pl-chev'); ch.setAttribute('aria-hidden', 'true'); ch.innerHTML = E.chev || ''; r.append(ch); return r; })(),
      ]));
      if (E.canFolder) box.append(btn('bk-cta cv-ghost', T('libAddFolder'), () => E.closeSheetThen(sh.parentNode, () => E.addFolder())));
    });
  }

  /* ---------- החלון: המרה בייבוא ---------- */
  async function openConvert(files, mode) {
    const EK = await kit();
    const comic = mode === 'comic' || files.every((f) => /^(cbz|img)$/.test(kindOf(f.name)));
    const bad = files.filter((f) => !kindOf(f.name) || kindOf(f.name) === 'book');
    if (!comic && bad.length === files.length) { flash(T('cvBadType')); return; }
    const list = comic ? files : files.filter((f) => !bad.includes(f));
    const pdf = !comic && list.some((f) => kindOf(f.name) === 'pdf');
    const S = { headings: true, strip: true, polish: true, pdfMode: 'text', dir: 'rtl', tocPage: false };
    E.sheet(T('cvConvT'), async (sh, close) => {
      const box = h('div', 'pl'); sh.append(box);
      const one = list.length === 1 || comic;
      const sub = h('p', 'cv-sub', one ? (comic && list.length > 1 ? T('cvNImages', { n: list.length }) : list[0].name) : T('cvNFiles', { n: list.length }));
      sub.dir = 'auto'; box.append(sub);
      if (pdf && one) pdfInfo(list[0]).then((x) => { if (sub.isConnected) sub.textContent = list[0].name + ' · ' + T('cvPages', { n: x.pages }); }).catch(() => {});
      if (comic) {
        box.append(h('div', 'pl-gh', T('cvDirQ')), seg([['rtl', T('cvDirRtl')], ['ltr', T('cvDirLtr')]], S.dir, (v) => { S.dir = v; }));
      } else {
        const rowsWrap = h('div');
        const paintRows = () => {
          rowsWrap.replaceChildren(group('', [
            S.pdfMode === 'text' ? swRow(S, 'headings', T('cvHeads'), pdf ? T('cvHeadsPdfS') : T('cvHeadsS')) : null,
            pdf && S.pdfMode === 'text' ? swRow(S, 'strip', T('cvStrip'), T('cvStripS')) : null,
            S.pdfMode === 'text' ? swRow(S, 'polish', T('cvPolish'), T('cvPolishS')) : null,
          ].filter(Boolean)));
          if (S.pdfMode === 'img') rowsWrap.append(h('p', 'cv-note', T('cvImgNote')));
        };
        if (pdf) box.append(h('div', 'pl-gh', T('cvPdfQ')), seg([['text', T('cvPdfText')], ['img', T('cvPdfImg')]], S.pdfMode, (v) => { S.pdfMode = v; paintRows(); }));
        paintRows(); box.append(rowsWrap);
      }
      const foot = h('div', 'pl-foot');
      const prog = h('div', 'cv-prog'); prog.hidden = true;
      const bar = h('div', 'lib-bar'); const fill = h('i'); fill.style.width = '0%'; bar.append(fill);
      const pl = h('div', 'cv-pl'), pt = h('span', 'cv-pt'), pw = h('span', 'cv-warn'); pl.append(pt, pw); prog.append(bar, pl);
      const cta = btn('bk-cta', T('cvGo'));
      foot.append(prog, cta); box.append(foot);
      cta.addEventListener('click', async () => {
        cta.disabled = true; prog.hidden = false; let added = 0, failed = 0;
        const jobs = comic ? [list] : list.map((f) => [f]);
        for (let j = 0; j < jobs.length; j++) {
          const fs = jobs[j];
          const onProg = (x, i, N) => { fill.style.width = Math.round(((j + Math.min(1, x || 0)) / jobs.length) * 100) + '%'; pt.textContent = N ? T('cvPageOf', { i, n: N }) : (jobs.length > 1 ? T('cvFileOf', { i: j + 1, n: jobs.length }) : T('cvWorking')); };
          onProg(0);
          try {
            const src = comic ? await comicSrc(fs, S, onProg) : await srcOf(fs[0], S, onProg);
            if (src.scanned && src.scanned.length) pw.textContent = T('cvScanned', { p: rangeText(src.scanned) });
            pt.textContent = T('cvBuilding');
            const f = await toEpubBlob(src, S);
            added += await E.importFiles([f]);
          } catch (e) { failed++; flash(T(e && e.msg ? e.msg : 'cvFail', { f: fs[0].name })); }
        }
        fill.style.width = '100%';
        if (added) { E.afterImport(added); flash(T('cvDone', { n: added })); if (!pw.textContent) close(); else { pt.textContent = T('cvDone', { n: added }); cta.textContent = T('cvClose'); cta.disabled = false; cta.onclick = close; } }
        else { cta.disabled = false; pt.textContent = failed ? T('cvFailAll') : ''; }
      });
    });
  }
  const rangeText = (ns) => {                          // [12,13,14,20] → "12–14, 20"
    const out = []; let a = null, b = null;
    for (const n of ns.concat([NaN])) { if (a != null && n === b + 1) { b = n; continue; } if (a != null) out.push(a === b ? String(a) : a + '–' + b); a = b = n; }
    return out.slice(0, 6).join(', ') + (out.length > 6 ? '…' : '');
  };

  /* ---------- C13: ספר מכמה מאמרים ---------- */
  function openArticles() {
    const S = { title: T('cvArtsDef', { m: new Date().toLocaleDateString(document.documentElement.lang === 'en' ? 'en-GB' : 'he-IL', { month: 'long', year: 'numeric' }) }), tocPage: true, polish: true };
    const A = [];                                      // { t, kind, body, images, words }
    E.sheet(T('cvArts'), (sh, close) => {
      const box = h('div', 'pl'); sh.append(box);
      const ti = h('input', 'cv-field'); ti.type = 'text'; ti.value = S.title; ti.dir = 'auto'; ti.setAttribute('aria-label', T('cvBookName')); ti.id = 'cv-arts-title';
      ti.addEventListener('input', () => { S.title = ti.value; });
      box.append(ti);
      const card = h('div', 'lib-ios pl-card cv-arts'); box.append(card);
      const paste = h('div', 'cv-paste'); paste.hidden = true;
      const ta = h('textarea', 'cv-field cv-ta'); ta.dir = 'auto'; ta.placeholder = T('cvPasteHint'); ta.id = 'cv-arts-paste';
      const pRow = h('div', 'pl-two');
      pRow.append(btn('bk-cta cv-ghost', T('cvCancel'), () => { paste.hidden = true; ta.value = ''; }), btn('bk-cta', T('cvAddArt'), async () => {
        const t = ta.value.trim(); if (!t) return;
        const EK = await kit(), first = t.split('\n')[0].replace(/^#+\s*/, '').trim().slice(0, 80);
        const md = /(^|\n)(#{1,6}\s|[-*]\s|\d+\.\s|>)/.test(t) || /\*\*|__/.test(t);
        const body = md ? EK.mdToHtml(t) : EK.textToChapters(t, { title: first, headings: false }).map((c) => c.body).join('\n');
        A.push({ t: first || T('cvArtN', { n: A.length + 1 }), kind: md ? 'Markdown' : T('cvKText'), body, images: [], words: wordsOf(body) });
        ta.value = ''; paste.hidden = true; paint();
      }));
      paste.append(ta, pRow); box.append(paste);
      box.append(group('', [swRow(S, 'tocPage', T('cvTocPage')), swRow(S, 'polish', T('cvPolish'), T('cvPolishS'))]));
      const foot = h('div', 'pl-foot'), cta = btn('bk-cta', ''); foot.append(cta); box.append(foot);
      const addFiles = async (fs) => {
        const EK = await kit();
        for (const f of fs) {
          try {
            const k = kindOf(f.name), src = await srcOf(f, { headings: false }), images = src.images || [];
            const body = src.chapters.map((c) => c.body).join('\n');
            A.push({ t: src.title, kind: { docx: 'Word', md: 'Markdown', txt: T('cvKText'), html: 'HTML' }[k] || k, body, images, words: wordsOf(body) });
          } catch (e) { flash(T('cvFail', { f: f.name })); }
          paint();
        }
        void EK;
      };
      function paint() {
        card.replaceChildren();
        A.forEach((a, i) => {
          const r = h('div', 'lib-row pl-row cv-art'); r.dataset.i = i;
          const hd = h('span', 'cv-drag', '⋮⋮'); hd.setAttribute('aria-hidden', 'true');
          const up = btn('cv-mini', '↑', () => { if (i > 0) { [A[i - 1], A[i]] = [A[i], A[i - 1]]; paint(); } }); up.setAttribute('aria-label', T('cvUp')); up.disabled = i === 0;
          const rm = btn('cv-mini', '×', () => { A.splice(i, 1); paint(); }); rm.setAttribute('aria-label', T('cvRemove'));
          const l = rowL(a.t, a.kind + ' · ' + T('beWords', { n: a.words.toLocaleString() })); l.querySelector('.pl-rt').dir = 'auto';
          r.append(hd, l, up, rm); card.append(r);
          dragRow(hd, r);
        });
        const add = h('label', 'lib-row pl-row cv-pick'); add.append(badge('+'), rowL(T('cvAddArt'), T('cvAddArtS')), fileInput(ART_ACCEPT, true, addFiles));
        const pb = btn('cv-mini cv-pastebtn', T('cvPaste'), (e) => { e.preventDefault(); e.stopPropagation(); paste.hidden = false; ta.focus(); });
        add.append(pb); card.append(add);
        cta.textContent = A.length ? T('cvMakeBook', { n: A.length }) : T('cvNeedArts'); cta.disabled = !A.length;
      }
      function dragRow(handle, row) {                  // גרירה לשינוי הסדר (ובנוסף ↑ לנגישות)
        handle.addEventListener('pointerdown', (e) => {
          e.preventDefault(); row.classList.add('cv-dragging');
          let from = +row.dataset.i;
          const move = (ev) => {
            const others = [...card.querySelectorAll('.cv-art')].filter((x) => x !== row);
            let dest = others.findIndex((x) => { const b = x.getBoundingClientRect(); return ev.clientY < b.top + b.height / 2; });
            if (dest < 0) dest = others.length;
            if (dest === from) return;
            const [x] = A.splice(from, 1); A.splice(dest, 0, x);
            card.insertBefore(row, others[dest] || card.querySelector('label.cv-pick')); from = dest;
          };
          // על window ולא על הידית: הזזת השורה ב־DOM משחררת את ה־pointer capture, והגרירה נעצרה אחרי צעד אחד
          const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); row.classList.remove('cv-dragging'); paint(); };
          window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
        });
      }
      cta.addEventListener('click', async () => {
        if (!A.length) return;
        cta.disabled = true; cta.textContent = T('cvBuilding');
        try {
          const EK = await kit(), images = [];
          const chapters = A.map((a, i) => {
            const pre = 'a' + (i + 1) + '_';
            let body = a.body;
            for (const im of a.images) { images.push(Object.assign({}, im, { name: pre + im.name })); body = body.split('../Images/' + im.name + '"').join('../Images/' + pre + im.name + '"'); }
            if (!/<h1\b/i.test(body)) body = '<h1>' + a.t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])) + '</h1>\n' + body;
            return { title: a.t, body, lvl: 1 };
          });
          const lang = EK.guessLang(A.map((a) => a.body.replace(/<[^>]*>/g, ' ')).join(' '));
          const f = await toEpubBlob({ title: (S.title || '').trim() || T('cvArts'), lang, chapters, images }, S);
          const n = await E.importFiles([f]);
          if (n) { E.afterImport(n); flash(T('cvDone', { n })); close(); } else { cta.disabled = false; paint(); }
        } catch (e) { flash(T('cvFailAll')); cta.disabled = false; paint(); }
      });
      paint();
    });
  }

  /* ---------- קריאת ספר EPUB לייצוא: פרקים לפי סדר הקריאה + התמונות ---------- */
  async function readBook(b) {
    const EK = await kit();
    let f = await E.getFile(b.id);
    if (!f) throw Object.assign(new Error('nofile'), { msg: 'plNoFile' });
    if (await EK.classify(f).catch(() => '') !== 'epub') { const src = await foliateSrc(f); f = await toEpubBlob(src, {}); }
    const rep = await EK.inspectEpub(f);
    if (!rep.ok) throw Object.assign(new Error('bad'), { msg: 'plBroken' });
    const items = Array.from(rep.opf.getElementsByTagNameNS(OPF_NS, 'item'));
    const byId = new Map(items.map((el) => [el.getAttribute('id'), el]));
    const docs = [];
    for (const r of Array.from(rep.opf.getElementsByTagNameNS(OPF_NS, 'itemref'))) {
      const el = byId.get(r.getAttribute('idref')); if (!el || !/html/.test(el.getAttribute('media-type') || '')) continue;
      if (/\bnav\b/.test(el.getAttribute('properties') || '')) continue;
      const p = EK.resolvePath(rep.opfPath, el.getAttribute('href') || ''), e = p && rep.zip.byName.get(p); if (!e) continue;
      try { docs.push({ p, src: await EK.readText(f, e, 16 << 20) }); } catch (er) {}
    }
    const img = async (docPath, src) => {
      const p = EK.resolvePath(docPath, String(src).split('#')[0]), e = p && rep.zip.byName.get(p); if (!e) return null;
      const data = await EK.readEntry(f, e), sz = EK.imageSize(data) || {};
      return { p, name: p.split('/').pop(), data, type: EK.mimeOfName(p), w: sz.w, h: sz.h };
    };
    return { file: f, docs, img };
  }
  function annBlocks(b) {                              // "כולל ההדגשות שלי" — פרק בסוף: הקטע, וההערה מתחתיו
    const list = (E.annOf && E.annOf(b)) || [];
    if (!list.length) return null;
    const blocks = [{ k: 'h', l: 1, r: [{ t: T('cvMyHl') }] }];
    for (const a of list) {
      blocks.push({ k: 'p', q: true, r: [{ t: String(a.x || '').trim() }] });
      if (String(a.n || '').trim()) blocks.push({ k: 'p', r: [{ t: '✎ ' + String(a.n).trim(), i: true }] });
    }
    return blocks;
  }
  function saveBlob(blob, name) {
    const u = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = u; a.download = name; a.rel = 'noopener'; a.hidden = true; document.body.append(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(u); a.remove(); }, 60000);
  }
  async function exportAs(b, fmt, S) {
    const EK = await kit(), B = await readBook(b);
    const title = b.title || 'book', author = b.author || '', lang = b.lang || EK.guessLang(B.docs.map((d) => EK.plainText(d.src)).join(' ').slice(0, 20000));
    if (fmt === 'epub') { saveBlob(B.file, EK.safeFileName(title, 'epub')); return; }
    const chapters = B.docs.map((d) => ({ p: d.p, blocks: EK.htmlBlocks(d.src) }));
    const extra = S.hl ? annBlocks(b) : null;
    if (fmt === 'txt') {
      const t = [title + (author ? '\n' + author : '')].concat(chapters.map((c) => EK.blocksToText(c.blocks))).concat(extra ? [EK.blocksToText(extra)] : []).join('\n\n');
      saveBlob(new Blob([t], { type: 'text/plain;charset=utf-8' }), EK.safeFileName(title, 'txt')); return;
    }
    if (fmt === 'md') {
      const files = [], used = new Map();
      let md = '# ' + title + '\n\n' + (author ? '*' + author + '*\n\n' : '');
      for (const c of chapters) {
        for (const bl of c.blocks) if (bl.k === 'img' && !used.has(c.p + '|' + bl.src)) { const im = await B.img(c.p, bl.src); if (im) { const nm = 'images/' + (used.size + 1) + '-' + im.name; used.set(c.p + '|' + bl.src, nm); files.push({ name: nm, data: im.data }); } }
        md += EK.blocksToMd(c.blocks, { img: (bl) => used.get(c.p + '|' + bl.src) || '' }) + '\n';
      }
      if (extra) md += EK.blocksToMd(extra);
      if (!files.length) { saveBlob(new Blob([md], { type: 'text/markdown;charset=utf-8' }), EK.safeFileName(title, 'md')); return; }
      files.unshift({ name: EK.safeFileName(title, 'md'), data: md });
      saveBlob(await EK.zipFiles(files), EK.safeFileName(title, 'zip')); return;
    }
    if (fmt === 'docx') {
      const images = new Map(), out = [];
      for (const c of chapters) {
        const blocks = [];
        for (const bl of c.blocks) {
          if (bl.k === 'img') { const key = c.p + '|' + bl.src; if (!images.has(key)) { const im = await B.img(c.p, bl.src); if (!im || /svg/.test(im.type)) continue; images.set(key, im); } blocks.push(Object.assign({}, bl, { src: key })); }
          else blocks.push(bl);
        }
        out.push({ blocks });
      }
      if (extra) out.push({ blocks: extra });
      const parts = EK.docxParts(out, { title, author, lang, images });
      const z = await EK.zipFiles(parts);
      saveBlob(new Blob([z], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), EK.safeFileName(title, 'docx')); return;
    }
    if (fmt === 'pdf') return printBook(B, { title, author, lang, extra });
  }
  /* C7: PDF דרך חלון ההדפסה — העברית, הכיווניות והגופנים יוצאים נכונים (ספריית PDF בדפדפן לא מעצבת עברית). שם בוחרים "שמירה כ־PDF" */
  async function printBook(B, { title, author, lang, extra }) {
    const EK = await kit(), dir = EK.dirOf(lang), urls = [];
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const fontUrl = new URL('fonts/NotoSansHebrew-VF.woff2', document.baseURI).href;
    let body = '<header class="t"><h1>' + esc(title) + '</h1>' + (author ? '<p>' + esc(author) + '</p>' : '') + '</header>';
    for (const d of B.docs) {
      let s = d.src; const bi = s.search(/<body\b/i); if (bi >= 0) s = s.slice(s.indexOf('>', bi) + 1); s = s.replace(/<\/body>[\s\S]*$/i, '');
      s = s.replace(/<(script|style|link|iframe|object|embed)\b[\s\S]*?(<\/\1>|\/>)/gi, '').replace(/\son\w+\s*=\s*(["'])[\s\S]*?\1/gi, '');
      const srcs = [...new Set([...s.matchAll(/<(?:img|image)\b[^>]*?\s(?:src|xlink:href|href)\s*=\s*(["'])([^"']+)\1/gi)].map((m) => m[2]))];
      for (const x of srcs) { const im = await B.img(d.p, EK.decodeEnt(x)); const u = im ? URL.createObjectURL(new Blob([im.data], { type: im.type })) : ''; if (u) urls.push(u); s = s.split('"' + x + '"').join('"' + u + '"').split("'" + x + "'").join("'" + u + "'"); }
      s = s.replace(/\s(?:src|href)\s*=\s*(["'])(?!blob:|#|https?:)[^"']*\1/gi, '');
      body += '<section class="ch">' + s + '</section>';
    }
    if (extra) body += '<section class="ch">' + extra.map((b) => b.k === 'h' ? '<h1>' + esc(b.r[0].t) + '</h1>' : b.q ? '<blockquote>' + esc(b.r[0].t) + '</blockquote>' : '<p><i>' + esc(b.r[0].t) + '</i></p>').join('') + '</section>';
    const css = '@font-face{font-family:"SNB P";src:url("' + fontUrl + '") format("woff2");font-weight:100 900}'
      + '@page{size:A4;margin:18mm 16mm}html{direction:' + dir + '}body{font-family:"SNB P","Noto Sans Hebrew",serif;font-size:11.5pt;line-height:1.6;color:#111;margin:0}'
      + 'h1,h2,h3{line-height:1.25;break-after:avoid}h1{font-size:20pt}h2{font-size:15pt}p{margin:0 0 .6em;orphans:2;widows:2}img,svg{max-width:100%;height:auto;break-inside:avoid}'
      + 'blockquote{margin:.6em 1.2em;font-style:italic}.ch{break-before:page}header.t{text-align:center;padding-top:30vh}header.t h1{font-size:28pt}pre{white-space:pre-wrap}a{color:inherit;text-decoration:none}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:2px 6px}';
    const html = '<!doctype html><html lang="' + esc(lang) + '" dir="' + dir + '"><head><meta charset="utf-8"><title>' + esc(title) + '</title><style>' + css + '</style></head><body>' + body + '</body></html>';
    const fr = document.createElement('iframe');
    fr.setAttribute('aria-hidden', 'true'); fr.tabIndex = -1;
    Object.assign(fr.style, { position: 'fixed', width: '0', height: '0', border: '0', insetInlineStart: '-10000px', top: '0', visibility: 'hidden' });
    const cleanup = () => { fr.remove(); urls.forEach((u) => URL.revokeObjectURL(u)); };
    await new Promise((res) => { fr.onload = res; fr.srcdoc = html; document.body.append(fr); });
    const w = fr.contentWindow, d = fr.contentDocument;
    try { await Promise.race([Promise.all([...d.images].map((im) => im.decode().catch(() => {}))).then(() => d.fonts && d.fonts.ready), new Promise((r) => setTimeout(r, 8000))]); } catch (e) {}
    w.addEventListener('afterprint', () => setTimeout(cleanup, 500));
    setTimeout(cleanup, 10 * 60 * 1000);
    w.focus(); w.print();
  }

  /* ---------- החלון: ייצוא מכרטיס הספר ---------- */
  function openExport(b) {
    const S = { hl: false };
    const hasHl = !!((E.annOf && E.annOf(b)) || []).length;
    E.sheet(T('cvExpT'), (sh, close) => {
      const box = h('div', 'pl'); sh.append(box);
      box.append(h('p', 'cv-sub', T('cvExpSub')));
      const busy = h('p', 'cv-note'); busy.hidden = true;
      const row = (fmt, ic, t, s) => {
        const r = btn('lib-row pl-row cv-pick', null, async () => {
          if (box.classList.contains('busy')) return;
          box.classList.add('busy'); busy.hidden = false; busy.textContent = T('cvExporting');
          try { await exportAs(b, fmt, S); if (fmt !== 'pdf') flash(T('cvSaved')); close(); }
          catch (e) { flash(T(e && e.msg ? e.msg : 'cvExpFail')); }
          box.classList.remove('busy'); busy.hidden = true;
        });
        r.append(badge(ic), rowL(t, s)); return r;
      };
      box.append(group('', [
        row('pdf', 'PDF', 'PDF', T('cvPdfS')),
        row('docx', 'DOC', 'Word', T('cvWordS')),
        row('md', 'MD', 'Markdown', T('cvMdS')),
        row('txt', 'TXT', T('cvTxt')),
        row('epub', 'EPUB', 'EPUB', T('cvEpubS')),
      ]));
      if (hasHl) box.append(group('', [swRow(S, 'hl', T('cvInclHl'), T('cvInclHlS'))]));
      box.append(busy);
    });
  }

  /* ---------- C1/C2: המרה במקום של ספר MOBI/AZW3/FB2 ל־EPUB (העורך, הליטוש והייצוא עובדים עליו) ---------- */
  async function toEpub(b) {
    const f = await E.getFile(b.id); if (!f) { flash(T('plNoFile')); return false; }
    try {
      const src = await foliateSrc(f);
      const nf = await toEpubBlob(src, {});
      await E.replaceFile(b.id, new File([nf], f.name.replace(/\.[^.]+$/, '') + '.epub', { type: 'application/epub+zip' }), f, T('cvCpConvert'));
      flash(T('cvConverted'));
      return true;
    } catch (e) { flash(T(e && e.msg ? e.msg : 'cvFailAll')); return false; }
  }

  return { openAdd, openConvert, openArticles, openExport, toEpub, exportAs, kindOf };
}
