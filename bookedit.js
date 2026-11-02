// Academy Pro, גל 2 (02/11/2026): עורך הספר ב"הספרייה שלי" — נטען רק כשנכנסים (כמו libpolish.js).
// A1 קוד ותצוגה, A2 עריכה בדף, A3 חפש והחלף, A4 החלפה מחושבת, A6 נקודות שמירה, A7 השוואת גרסאות, A8 תוכן עניינים,
// A9 פיצול ומיזוג, A13 גופנים, A14 הקבצים שבספר, A15 הוספת תוכן, A16 סידור קוד. תצוגה מקדימה שאושרה: claude.ai/artifact/B5NfGtGLAf4TQZzg9kFmiH
// הליבה (מחרוזות ובייטים) ב־epubkit.js סעיף 14; כאן הממשק והפרויקט (הספר הפתוח בזיכרון). כל מה שצריך מהספרייה מוזרק (E).
// כללים: רק ספרים של המשתמש (E.isMine); שינויים בזיכרון עד "שמור"; לפני כל שמירה — נקודת שמירה (E.saveEdited); המזהה לא משתנה.
// התצוגה: iframe מ־blob: עם sandbox בלי סקריפטים (ה־CSP מתיר frame-src blob:, כמו הקורא) — קוד בספר לא רץ.
let EKP = null;
const kit = () => (EKP || (EKP = import('./epubkit.js')));
const OPF_NS = 'http://www.idpf.org/2007/opf';
const HL_MAX = 160000;                 // מעל זה — בלי הדגשת תחביר (הקלדה חלקה בפרק ענק)
const UNDO_MAX = 20;
const LIST_MAX = 300;                  // התאמות שמוצגות ברשימה (כולן מוחלפות)
const GENERIC_FAM = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|inherit|initial|unset|ui-serif|ui-sans-serif|ui-monospace|emoji|math)$/;
const CHARS = [['״', 'beChGersh2'], ['׳', 'beChGersh'], ['־', 'beChMaqaf'], ['–', 'beChDash'], ['…', 'beChDots'], [' ', 'beChNbsp'],
  ['ָ', 'beNqKamatz'], ['ַ', 'beNqPatah'], ['ִ', 'beNqHiriq'], ['ֵ', 'beNqTsere'], ['ֶ', 'beNqSegol'], ['ְ', 'beNqShva'],
  ['ֹ', 'beNqHolam'], ['ֻ', 'beNqKubutz'], ['ּ', 'beNqDagesh'], ['ׁ', 'beNqShin'], ['ׂ', 'beNqSin'], ['ֲ', 'beNqHataf']];

/* ---------- הדגשת תחביר (טהור — נבדק) ---------- */
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export function hlXml(src) {
  let out = '', i = 0, m;
  const re = /(<!--[\s\S]*?-->)|(<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>)|(<\/?)([\w:.-]+)((?:\s+[\w:.-]+(?:\s*=\s*(?:"[^"]*"|'[^']*'))?)*)(\s*\/?>)|(&[#\w]+;)/g;
  while ((m = re.exec(src))) {
    out += esc(src.slice(i, m.index));
    if (m[1] || m[2]) out += '<span class="tk-c">' + esc(m[0]) + '</span>';
    else if (m[7]) out += '<span class="tk-e">' + esc(m[7]) + '</span>';
    else {
      const a = esc(m[5].replace(/([\w:.-]+)(\s*=\s*)("[^"]*"|'[^']*')/g, '\u0001$1\u0002$2\u0003$3\u0004'))
        .replace(/\u0001(.*?)\u0002(.*?)\u0003(.*?)\u0004/g, '<span class="tk-a">$1</span>$2<span class="tk-s">$3</span>');
      out += '<span class="tk-t">' + esc(m[3] + m[4]) + '</span>' + a + '<span class="tk-t">' + esc(m[6]) + '</span>';
    }
    i = re.lastIndex;
  }
  return out + esc(src.slice(i));
}
export function hlCss(src) {
  return esc(src).replace(/(\/\*[\s\S]*?\*\/)|([^{}\n;]+)(\{)|([\w-]+)(\s*:\s*)([^;}\n]+)/g, (m, c, sel, br, p, col, v) =>
    c ? '<span class="tk-c">' + c + '</span>' : sel != null ? '<span class="tk-t">' + sel + '</span>' + br : '<span class="tk-a">' + p + '</span>' + col + '<span class="tk-s">' + v + '</span>');
}
export function hlLines(src, css) {     // שורה = span עם מספר; תגית span שנפתחה בשורה אחת נסגרת ונפתחת מחדש בבאה
  const hh = css ? hlCss(src) : hlXml(src);
  let open = '';
  return hh.split('\n').map((ln, i) => {
    const row = open + ln, opens = row.match(/<span class="[^"]*">/g) || [], closes = (row.match(/<\/span>/g) || []).length;
    const pending = opens.slice(closes); open = pending.join('');
    return '<span class="be-ln" data-n="' + (i + 1) + '">' + row + '</span>'.repeat(pending.length) + (ln ? '' : '​') + '</span>';
  }).join('');
}
export function openTagAt(src, at) {     // התגית הפתוחה הפנימית לפני המיקום — ל"</" אוטומטי
  const st = [], re = /<(\/?)([\w:.-]+)(?:[^>"']|"[^"]*"|'[^']*')*?(\/?)>/g; let m;
  const s = src.slice(0, at);
  while ((m = re.exec(s))) { if (m[3]) continue; if (m[1]) { const k = st.lastIndexOf(m[2]); if (k >= 0) st.length = k; } else if (!/^(br|hr|img|meta|link|input)$/i.test(m[2])) st.push(m[2]); }
  return st.pop() || null;
}

export function createEditor(E) {
  const { h, T } = E;
  const flash = (m) => E.flash && E.flash(m);
  const ask = (msg, fn, o) => (E.askConfirm ? E.askConfirm(msg, fn, o) : fn());
  const DRAFTS = new Map();            // id → פרויקט עם שינויים שלא נשמרו (באותו סשן): חזרה לעורך ממשיכה מאותו מקום
  const btn = (cls, txt, fn) => { const b = h('button', cls, txt); b.type = 'button'; if (fn) b.addEventListener('click', fn); return b; };
  const chip = (txt, on, fn) => { const c = btn('be-chip', txt, fn); c.setAttribute('aria-pressed', String(!!on)); return c; };
  const fname = (p) => p.split('/').pop();

  /* ---------- הפרויקט: הספר בזיכרון ---------- */
  async function load(b) {
    const f = await E.getFile(b.id);
    if (!f) throw Object.assign(new Error('nofile'), { msg: 'plNoFile' });
    const EK = await kit();
    if (await EK.classify(f).catch(() => '') !== 'epub') throw Object.assign(new Error('type'), { msg: 'beOnlyEpub' });
    const rep = await EK.inspectEpub(f);
    if (!rep.ok) throw Object.assign(new Error('bad'), { msg: 'plBroken' });
    const P = { b, file: f, zip: rep.zip, opf: rep.opf, opfPath: rep.opfPath, ver: EK.opfVersion(rep.opf), text: new Map(), changed: new Set(), bin: new Map(), del: new Set(), dirty: false, undo: [], urls: new Map() };
    for (const it of items(P)) {
      if (!isTextItem(it)) continue;
      const e = P.zip.byName.get(it.p); if (!e) continue;
      try { P.text.set(it.p, await EK.readText(f, e, 16 << 20)); } catch (er) {}
    }
    return P;
  }
  const items = (P) => Array.from(P.opf.getElementsByTagNameNS(OPF_NS, 'item')).map((el) => {
    const href = el.getAttribute('href') || '', mt = el.getAttribute('media-type') || '';
    return { el, id: el.getAttribute('id') || '', href, mt, props: el.getAttribute('properties') || '', p: /^[a-z][a-z0-9+.-]*:/i.test(href) ? null : resolve(P.opfPath, href) };
  }).filter((x) => x.p);
  let resolve = (base, href) => href;   // מוחלף ב־EK.resolvePath אחרי טעינת הערכה
  let relPath = (a, b) => b;
  const kindOf = (it) => /\bnav\b/.test(it.props) ? 'nav' : /x-dtbncx/.test(it.mt) ? 'ncx' : /x?html/.test(it.mt) ? 'doc' : it.mt === 'text/css' || /\.css$/i.test(it.href) ? 'css'
    : /^image\//.test(it.mt) ? 'img' : /font|opentype|truetype|woff|sfnt/i.test(it.mt) || /\.(ttf|otf|woff2?)$/i.test(it.href) ? 'font' : 'other';
  const isTextItem = (it) => ['doc', 'css', 'nav', 'ncx'].includes(kindOf(it)) || /svg\+xml/.test(it.mt);
  const spineDocs = (P) => {
    const byId = new Map(items(P).map((it) => [it.id, it]));
    return Array.from(P.opf.getElementsByTagNameNS(OPF_NS, 'itemref')).map((r) => byId.get(r.getAttribute('idref'))).filter((it) => it && kindOf(it) === 'doc');
  };
  const docsFor = (P, only) => (only ? [only] : spineDocs(P).map((it) => it.p)).filter((p) => P.text.has(p)).map((p) => ({ p, src: P.text.get(p) }));
  const write = (P, p, s) => { if (P.text.get(p) === s) return; P.text.set(p, s); P.changed.add(p); P.dirty = true; };
  const snap = (P) => { P.undo.push({ text: new Map(P.text), changed: new Set(P.changed), bin: new Map(P.bin), del: new Set(P.del), opf: P.opf.cloneNode(true) }); if (P.undo.length > UNDO_MAX) P.undo.shift(); };
  const undo = (P) => { const u = P.undo.pop(); if (!u) return false; Object.assign(P, { text: u.text, changed: u.changed, bin: u.bin, del: u.del, opf: u.opf, dirty: true }); return true; };
  const opfDirty = (P) => { P.opfChanged = true; P.dirty = true; };
  const docTitle = (P, p) => { const s = P.text.get(p) || ''; const m = /<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i.exec(s) || /<title>([\s\S]*?)<\/title>/i.exec(s); return m ? m[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 60) : ''; };
  const sizeOf = (P, p) => P.bin.has(p) ? P.bin.get(p).length : P.text.has(p) && P.changed.has(p) ? new TextEncoder().encode(P.text.get(p)).length : (P.zip.byName.get(p) || {}).usize || 0;
  async function bytesOf(P, p) {
    if (P.bin.has(p)) return P.bin.get(p);
    if (P.text.has(p) && P.changed.has(p)) return new TextEncoder().encode(P.text.get(p));
    const e = P.zip.byName.get(p); if (!e) return null;
    return (await kit()).readEntry(P.file, e);
  }
  async function save(P, label) {
    const EK = await kit();
    const put = new Map();
    for (const p of P.changed) if (P.text.has(p) && !P.del.has(p)) put.set(p, new TextEncoder().encode(P.text.get(p)));
    for (const [p, u8] of P.bin) if (!P.del.has(p)) put.set(p, u8);
    if (P.ver === 3) EK.writeOpfMeta(P.opf, {}, {});                   // dcterms:modified
    let x = new XMLSerializer().serializeToString(P.opf); if (!/^<\?xml/.test(x)) x = '<?xml version="1.0" encoding="UTF-8"?>\n' + x;
    put.set(P.opfPath, new TextEncoder().encode(x));
    const del = new Set([...P.del].filter((p) => P.zip.byName.has(p) && !put.has(p)));
    const out = await EK.rewriteZip(P.file, P.zip, { put, del });
    const nf = new File([out], P.file.name || (P.b.id + '.epub'), { type: 'application/epub+zip' });
    await E.saveEdited(P.b.id, nf, P.file, label || T('beCpSave'));
    const rep = await EK.inspectEpub(nf);
    Object.assign(P, { file: nf, zip: rep.zip, opf: rep.opf, changed: new Set(), bin: new Map(), del: new Set(), dirty: false, opfChanged: false, undo: [] });
    DRAFTS.delete(P.b.id);
    return P;
  }
  // מנהל: הוספה, מחיקה ושינוי שם של פריטים, וקישורים בכל הספר
  const freshId = (P, base) => { const ids = new Set(items(P).map((x) => x.id)); let i = 1; while (ids.has(base + i)) i++; return base + i; };
  function addItem(P, p, mt, { after, spine, props } = {}) {
    const man = P.opf.getElementsByTagNameNS(OPF_NS, 'manifest')[0];
    const el = P.opf.createElementNS(OPF_NS, 'item');
    const id = freshId(P, /^image/.test(mt) ? 'img' : /css/.test(mt) ? 'css' : /font|ttf|otf|woff/.test(mt) ? 'font' : 'x');
    el.setAttribute('id', id); el.setAttribute('href', relPath(P.opfPath, p)); el.setAttribute('media-type', mt); if (props) el.setAttribute('properties', props);
    man.appendChild(P.opf.createTextNode('\n    ')); man.appendChild(el);
    if (spine) {
      const sp = P.opf.getElementsByTagNameNS(OPF_NS, 'spine')[0], ref = P.opf.createElementNS(OPF_NS, 'itemref'); ref.setAttribute('idref', id);
      const prev = after && Array.from(sp.getElementsByTagNameNS(OPF_NS, 'itemref')).find((r) => { const it = items(P).find((x) => x.id === r.getAttribute('idref')); return it && it.p === after; });
      if (prev && prev.nextSibling) sp.insertBefore(ref, prev.nextSibling); else sp.appendChild(ref);
      sp.insertBefore(P.opf.createTextNode('\n    '), ref);
    }
    P.del.delete(p); opfDirty(P);
    return id;
  }
  function removeItem(P, p) {
    const it = items(P).find((x) => x.p === p); if (!it) return;
    for (const r of Array.from(P.opf.getElementsByTagNameNS(OPF_NS, 'itemref'))) if (r.getAttribute('idref') === it.id) r.parentNode.removeChild(r);
    it.el.parentNode.removeChild(it.el);
    P.text.delete(p); P.bin.delete(p); P.changed.delete(p); P.del.add(p); opfDirty(P);
  }
  function fixRefsEverywhere(P, EK, fn) {          // כל הקבצים שיש בהם קישורים: פרקים, CSS, nav, ncx, ו־guide של ה־OPF
    for (const it of items(P)) {
      const k = kindOf(it); if (!P.text.has(it.p) || !['doc', 'css', 'nav', 'ncx'].includes(k)) continue;
      write(P, it.p, EK.rewriteRefs(P.text.get(it.p), it.p, fn, { css: k === 'css' }));
    }
    for (const r of Array.from(P.opf.getElementsByTagNameNS(OPF_NS, 'reference'))) {
      const nh = EK.rewriteRefs(' href="' + (r.getAttribute('href') || '') + '"', P.opfPath, fn);
      const m = /href="([^"]*)"/.exec(nh); if (m && m[1] !== r.getAttribute('href')) { r.setAttribute('href', m[1].replace(/&amp;/g, '&')); opfDirty(P); }
    }
  }
  async function renamePath(P, from, to) {
    const EK = await kit();
    const it = items(P).find((x) => x.p === from); if (!it || from === to || items(P).some((x) => x.p === to)) return false;
    snap(P);
    if (P.text.has(from)) { P.text.set(to, P.text.get(from)); P.text.delete(from); P.changed.delete(from); P.changed.add(to); }
    else { const u8 = await bytesOf(P, from); if (u8) P.bin.set(to, u8); P.bin.delete(from); }
    P.del.add(from); P.del.delete(to);
    it.el.setAttribute('href', relPath(P.opfPath, to)); opfDirty(P);
    fixRefsEverywhere(P, EK, (p, f) => p === from ? { p: to, f } : null);
    return true;
  }
  const refCount = (P, target) => { let n = 0; for (const [p, s] of P.text) if (p !== target) for (const m of s.matchAll(/\s(?:src|href|xlink:href)\s*=\s*["']([^"'#]+)|url\(\s*["']?([^"')#]+)/gi)) { if (resolve(p, (m[1] || m[2] || '').trim()) === target) n++; } return n; };
  async function splitAt(P, p, levels) {
    const EK = await kit();
    const src0 = P.text.get(p); const at = EK.splitPoints(src0, levels); if (!at.length) return 0;
    snap(P);
    const base = fname(p), src = src0.replace(/(\shref\s*=\s*["'])#/gi, '$1' + encodeURIComponent(base) + '#');   // קישורים פנימיים — מפורשים, כדי שיתעדכנו
    const parts = EK.splitDoc(src, EK.splitPoints(src, levels));
    const dir = p.slice(0, p.lastIndexOf('/') + 1), stem = base.replace(/\.[^.]+$/, ''), ext = (base.match(/\.[^.]+$/) || ['.xhtml'])[0];
    const it = items(P).find((x) => x.p === p), idMap = new Map(), names = [p];
    let after = p;
    for (let k = 1; k < parts.length; k++) {
      let nm, j = k; do { nm = dir + stem + '_' + j + ext; j++; } while (items(P).some((x) => x.p === nm) || P.text.has(nm));
      names.push(nm); P.text.set(nm, parts[k]); P.changed.add(nm);
      addItem(P, nm, it.mt, { after, spine: true }); after = nm;
      for (const id of EK.idsOf(parts[k])) idMap.set(id, nm);
    }
    P.text.set(p, parts[0]); P.changed.add(p);
    fixRefsEverywhere(P, EK, (q, f) => q === p && f && idMap.has(f) ? { p: idMap.get(f), f } : null);
    P.dirty = true;
    return parts.length;
  }
  async function mergeNext(P, p) {
    const EK = await kit(), sp = spineDocs(P), i = sp.findIndex((x) => x.p === p), nx = sp[i + 1];
    if (i < 0 || !nx) return false;
    const m = EK.mergeDocs([P.text.get(p), P.text.get(nx.p)]); if (!m) return false;
    snap(P);
    write(P, p, m); removeItem(P, nx.p);
    fixRefsEverywhere(P, EK, (q, f) => q === nx.p ? { p, f } : null);
    return true;
  }
  function moveInSpine(P, p, d) {
    const sp = P.opf.getElementsByTagNameNS(OPF_NS, 'spine')[0], refs = Array.from(sp.getElementsByTagNameNS(OPF_NS, 'itemref'));
    const it = items(P).find((x) => x.p === p), i = refs.findIndex((r) => it && r.getAttribute('idref') === it.id), j = i + d;
    if (i < 0 || j < 0 || j >= refs.length) return false;
    snap(P);
    if (d < 0) sp.insertBefore(refs[i], refs[j]); else sp.insertBefore(refs[i], refs[j].nextSibling);
    opfDirty(P); return true;
  }
  // תוכן העניינים: nav (EPUB 3) ו־ncx (EPUB 2) — נקרא מהראשון שיש, נכתב לשניהם
  const navItem = (P) => items(P).find((x) => kindOf(x) === 'nav');
  const ncxItem = (P) => items(P).find((x) => kindOf(x) === 'ncx');
  async function readToc(P) {
    const EK = await kit(), nv = navItem(P), nc = ncxItem(P);
    if (nv && P.text.has(nv.p)) { const r = EK.readNav(P.text.get(nv.p), nv.p); if (r && r.length) return r; }
    if (nc && P.text.has(nc.p)) return EK.readNcx(P.text.get(nc.p), nc.p);
    return [];
  }
  async function writeToc(P, list) {
    const EK = await kit(); let nv = navItem(P); const nc = ncxItem(P);
    snap(P);
    if (!nv && (P.ver === 3 || !nc)) {        // אין nav: יוצרים (EPUB 3), או ncx אם הספר EPUB 2 בלי כלום
      if (P.ver === 3) {
        const dir = P.opfPath.slice(0, P.opfPath.lastIndexOf('/') + 1); let p = dir + 'nav.xhtml', k = 1; while (items(P).some((x) => x.p === p)) p = dir + 'nav' + (k++) + '.xhtml';
        P.text.set(p, '<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>' + esc(T('beToc')) + '</title></head>\n<body><nav epub:type="toc" id="toc"></nav></body>\n</html>\n');
        addItem(P, p, 'application/xhtml+xml', { props: 'nav' }); nv = navItem(P);
      } else {
        const dir = P.opfPath.slice(0, P.opfPath.lastIndexOf('/') + 1), p = dir + 'toc.ncx';
        P.text.set(p, '<?xml version="1.0" encoding="UTF-8"?>\n<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head><meta name="dtb:depth" content="1"/></head><docTitle><text>' + esc(P.b.title || '') + '</text></docTitle><navMap></navMap></ncx>\n');
        const id = addItem(P, p, 'application/x-dtbncx+xml');
        P.opf.getElementsByTagNameNS(OPF_NS, 'spine')[0].setAttribute('toc', id);
      }
    }
    if (nv) write(P, nv.p, EK.writeNav(P.text.get(nv.p), list, nv.p));
    const nc2 = ncxItem(P); if (nc2) write(P, nc2.p, EK.writeNcx(P.text.get(nc2.p), list, nc2.p));
    P.dirty = true;
  }

  /* ---------- התצוגה (A1): ה־XHTML עם ה־CSS, התמונות והגופנים כ־blob: ---------- */
  async function urlOf(P, p) {
    if (P.urls.has(p)) return P.urls.get(p);
    const it = items(P).find((x) => x.p === p);
    let u = '';
    if (it && kindOf(it) === 'css' && P.text.has(p)) u = URL.createObjectURL(new Blob([await cssWithUrls(P, p, P.text.get(p))], { type: 'text/css' }));
    else { const b = await bytesOf(P, p); if (b) u = URL.createObjectURL(new Blob([b], { type: (it && it.mt) || 'application/octet-stream' })); }
    if (it && kindOf(it) !== 'css') P.urls.set(p, u);   // CSS משתנה בעריכה — לא נשמר במטמון
    return u;
  }
  async function cssWithUrls(P, p, css) {
    const parts = []; let last = 0;
    for (const m of css.matchAll(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi)) {
      parts.push(css.slice(last, m.index));
      const q = /^[a-z]+:/i.test(m[2]) ? null : resolve(p, m[2].trim());
      parts.push(q ? 'url("' + (await urlOf(P, q)) + '")' : m[0]); last = m.index + m[0].length;
    }
    return parts.join('') + css.slice(last);
  }
  async function previewUrl(P, p) {
    const src = P.text.get(p) || '', parts = []; let last = 0;
    for (const m of src.matchAll(/(\s(?:src|href|xlink:href)\s*=\s*)(["'])([^"']*)\2/gi)) {
      parts.push(src.slice(last, m.index)); last = m.index + m[0].length;
      const href = m[3].replace(/&amp;/g, '&');
      if (/^[a-z][a-z0-9+.-]*:|^#/i.test(href)) { parts.push(m[0]); continue; }
      const q = resolve(p, href.split('#')[0]), it = q && items(P).find((x) => x.p === q);
      parts.push(it && kindOf(it) !== 'doc' ? m[1] + m[2] + (await urlOf(P, q)) + m[2] : m[0]);
    }
    let x = parts.join('') + src.slice(last);
    x = x.replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi, (m, a, c) => m);   // style פנימי — כמו שהוא (‏url() יחסי בתוכו נדיר)
    const EK = await kit(); let type = 'application/xhtml+xml';
    try { EK.parseXml(x); } catch (e) { type = 'text/html'; }
    return URL.createObjectURL(new Blob([x], { type }));
  }
  const revokeAll = (P) => { for (const u of P.urls.values()) try { URL.revokeObjectURL(u); } catch (e) {} P.urls.clear(); };

  /* ---------- גיליון: שאלה עם שדה טקסט ---------- */
  function askText(title, value, okLabel, fn, { multi = false, dir = 'auto' } = {}) {
    E.sheet(title, (sh, close) => {
      const inp = h(multi ? 'textarea' : 'input', 'be-inp'); inp.value = value || ''; inp.dir = dir; if (multi) inp.rows = 6;
      const ok = btn('bk-cta', okLabel, () => { const v = inp.value; close(); fn(v); });
      inp.addEventListener('keydown', (e) => { if (!multi && e.key === 'Enter') ok.click(); });
      const box = h('div', 'be-ask'); box.append(inp, ok); sh.append(box);
      setTimeout(() => { try { inp.focus(); if (!multi) inp.select(); } catch (e) {} }, 60);
    });
  }

  /* ========== העורך (A1, A15, A16) ========== */
  async function open(b, at) {
    if (!E.isMine(b)) return;
    const EK = await kit(); resolve = EK.resolvePath; relPath = EK.relPath;
    E.sheet(T('beTitle'), async (sh, close) => {
      sh.classList.add('be-sheet');
      const box = h('div', 'be'); sh.append(box);
      box.append(h('p', 'lib-empty', T('plChecking')));
      await Promise.resolve();
      let P = DRAFTS.get(b.id);
      try {
        const cur = await E.getFile(b.id);
        if (P && P.file !== cur && (P.file.size !== (cur && cur.size) || P.file.lastModified !== (cur && cur.lastModified))) { DRAFTS.delete(b.id); P = null; flash(T('beDraftGone')); }
        if (!P) P = await load(b);
      } catch (e) { box.textContent = ''; box.append(h('p', 'lib-empty', T((e && e.msg) || 'plBroken'))); return; }
      if (!box.isConnected) return;
      const S = { p: (at && at.p) || (spineDocs(P)[0] || {}).p || [...P.text.keys()][0], view: 'code', hlT: 0, pvT: 0 };
      const watch = new MutationObserver(() => { if (!sh.isConnected) { watch.disconnect(); revokeAll(P); if (P.dirty) { DRAFTS.set(b.id, P); flash(T('beDraftKept')); } } });
      watch.observe(document.body, { childList: true, subtree: true });
      const isCss = () => /\.css$/i.test(S.p) || (items(P).find((x) => x.p === S.p) || {}).mt === 'text/css';
      const isDoc = () => { const it = items(P).find((x) => x.p === S.p); return !!it && ['doc', 'nav'].includes(kindOf(it)); };
      let ta = null, pre = null, frame = null, status = null;

      const paint = () => {
        box.textContent = '';
        const bar = h('div', 'be-bar');
        const fs = btn('be-file', '', () => pickFile());
        fs.append(h('span', 'be-mono', fname(S.p)), h('span', 'be-caret', '▾'));
        fs.setAttribute('aria-label', T('beFileSel'));
        const sv = btn('be-save', T('beSave'), doSave);
        bar.append(fs, sv);
        const tools = h('div', 'be-tools');
        const seg = h('div', 'be-seg');
        for (const [k, key] of [['code', 'beCode'], ['split', 'beBoth'], ['page', 'bePage']]) {
          const s = btn('', T(key), () => { S.view = k; paint(); }); s.setAttribute('aria-pressed', String(S.view === k)); seg.append(s);
        }
        tools.append(seg, chip(T('beFind'), false, () => openFind(P, S.p, refresh)));
        if (isDoc()) tools.append(chip(T('beAdd'), false, addMenu));
        tools.append(chip(T('beTidy'), false, tidy), chip(T('beUndo'), false, doUndo),
          chip(T('beFiles'), false, () => openFiles(P, refresh, (p) => { S.p = p; paint(); })), chip(T('beToc'), false, () => openToc(P, refresh)),
          chip(T('beVersions'), false, () => openVersions(P, refresh)));
        const body = h('div', 'be-body be-v-' + S.view);
        ta = pre = frame = null;
        if (S.view !== 'page' || !isDoc()) body.append(codeBlock());
        if (S.view !== 'code' && isDoc()) { frame = h('iframe', 'be-frame'); frame.setAttribute('sandbox', 'allow-same-origin'); frame.title = T('bePage'); body.append(frame); loadFrame(); }
        status = h('div', 'be-status');
        box.append(bar, tools, body, status); paintStatus();
      };
      const paintStatus = () => { if (status) status.textContent = P.dirty ? T('beUnsaved') : T('beSavedAll'); };
      const codeBlock = () => {
        const wrap = h('div', 'be-code');
        const src = P.text.get(S.p) || '';
        pre = h('pre', 'be-hl'); pre.setAttribute('aria-hidden', 'true');
        if (src.length <= HL_MAX) pre.innerHTML = hlLines(src, isCss()); else { pre.textContent = src; wrap.classList.add('plain'); }
        ta = h('textarea', 'be-ta'); ta.value = src; ta.spellcheck = false; ta.setAttribute('autocapitalize', 'off'); ta.setAttribute('autocomplete', 'off'); ta.dir = 'ltr';
        ta.setAttribute('aria-label', T('beCodeOf', { f: fname(S.p) }));
        ta.addEventListener('input', onType);
        wrap.append(pre, ta);
        requestAnimationFrame(fit);
        return wrap;
      };
      const fit = () => { if (!ta || !pre) return; ta.style.height = '0'; ta.style.height = Math.max(pre.offsetHeight, ta.scrollHeight) + 'px'; };
      function onType(e) {
        const v = ta.value;
        if (e && e.inputType === 'insertText' && e.data === '/' && v[ta.selectionStart - 2] === '<' && !isCss()) {   // "</" → סוגר את התגית הפתוחה
          const tg = openTagAt(v, ta.selectionStart - 2);
          if (tg) { insert(tg + '>'); return; }
        }
        write(P, S.p, v); paintStatus();
        clearTimeout(S.hlT); S.hlT = setTimeout(() => { if (pre && v.length <= HL_MAX) { pre.innerHTML = hlLines(ta.value, isCss()); fit(); } }, v.length > 40000 ? 300 : 90);
        if (frame) { clearTimeout(S.pvT); S.pvT = setTimeout(loadFrame, 600); }
        fit();
      }
      function insert(text) {             // דרך insertText — נשמר בביטול של המקלדת
        if (!ta) return;
        ta.focus();
        let ok = false; try { ok = document.execCommand('insertText', false, text); } catch (e) {}
        if (!ok) { ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, 'end'); onType(); }
      }
      async function loadFrame() {
        if (!frame) return;
        let y = 0; try { y = frame.contentWindow.scrollY; } catch (e) {}
        const old = frame.dataset.u;
        const u = await previewUrl(P, S.p); if (!frame) { URL.revokeObjectURL(u); return; }
        frame.dataset.u = u;
        frame.onload = () => { try { frame.contentWindow.scrollTo(0, y); } catch (e) {} if (old) URL.revokeObjectURL(old); };
        frame.src = u;
      }
      const refresh = () => { if (!P.text.has(S.p)) S.p = (spineDocs(P)[0] || {}).p || [...P.text.keys()][0]; paint(); };
      function pickFile() {
        E.sheet(T('beFileSel'), (s2, close2) => {
          const grp = (key, list) => {
            if (!list.length) return;
            const g = h('div', 'pl-g'); g.append(h('div', 'pl-gh', T(key)));
            const card = h('div', 'lib-ios pl-card');
            for (const it of list) {
              const r = btn('lib-row be-li' + (it.p === S.p ? ' cur' : ''), '', () => { close2(); S.p = it.p; paint(); });
              const l = h('span', 'pl-rl'); const n = h('span', 'pl-rt be-mono', fname(it.p)); l.append(n);
              const t = kindOf(it) === 'doc' ? docTitle(P, it.p) : ''; if (t) { const s = h('span', 'pl-rs', t); s.dir = 'auto'; l.append(s); }
              r.append(l); card.append(r);
            }
            g.append(card); s2.append(g);
          };
          const all = items(P).filter((x) => P.text.has(x.p));
          grp('beGDocs', spineDocs(P).filter((x) => P.text.has(x.p)));
          grp('beGStyle', all.filter((x) => kindOf(x) === 'css'));
          grp('beGOther', all.filter((x) => ['nav', 'ncx'].includes(kindOf(x)) || (kindOf(x) === 'doc' && !spineDocs(P).includes(x))));
        });
      }
      function addMenu() {
        E.sheet(T('beAdd'), (s2, close2) => {
          const card = h('div', 'lib-ios pl-card');
          const row = (ic, key, sub, fn) => { const r = btn('lib-row be-li', '', () => { close2(); fn(); }); const i = h('span', 'be-ic', ic); const l = h('span', 'pl-rl'); l.append(h('span', 'pl-rt', T(key)), h('span', 'pl-rs', T(sub))); r.append(i, l); card.append(r); };
          const pos = ta ? ta.selectionStart : null;
          row('¹', 'beAddNote', 'beAddNoteS', () => askText(T('beAddNote'), '', T('beInsert'), async (txt) => {
            const EK2 = await kit(); snap(P);
            const src = P.text.get(S.p), at2 = pos != null ? pos : src.search(/<\/body\s*>/i);
            const r = EK2.addFootnote(src, at2, txt); write(P, S.p, r.src); paint(); flash(T('beNoteAdded', { n: r.n }));
          }, { multi: true }));
          row('▣', 'beAddImg', 'beAddImgS', () => pickBlob('image/*', async (f) => { const p = await addImage(P, f, S.p); if (!p) return; const tag = '<img src="' + esc(relPath(S.p, p)) + '" alt=""/>'; if (pos != null && ta) { ta.setSelectionRange(pos, pos); insert(tag); } }));
          row('＋', 'beAddChap', 'beAddChapS', () => askText(T('beAddChap'), T('beNewChapT'), T('beCreate'), (t) => newChapterAfter(P, S.p, t).then((p) => { if (p) { S.p = p; paint(); } })));
          row('❝', 'beAddQuote', 'beAddQuoteS', () => insert('<blockquote><p></p></blockquote>'));
          s2.append(card);
          s2.append(h('div', 'pl-gh be-chars-h', T('beChars')));
          const grid = h('div', 'be-chars');
          for (const [c, key] of CHARS) { const b2 = btn('be-ch', '', () => { close2(); setTimeout(() => insert(c), 40); }); b2.setAttribute('aria-label', T(key)); b2.append(h('b', null, /[֑-ׇ]/.test(c) ? 'א' + c : c === ' ' ? '⍽' : c), h('small', null, T(key))); grid.append(b2); }
          s2.append(grid);
        });
      }
      async function tidy() {
        const EK2 = await kit(), src = P.text.get(S.p) || '';
        let out, fixed = 0;
        if (isCss()) out = EK2.tidyCss(src);
        else { const r = EK2.tidyXhtml(src); if (!r.ok) { flash(T('beTidyFail')); return; } out = r.src; fixed = r.fixed; }
        if (out === src) { flash(T('beTidyClean')); return; }
        snap(P); write(P, S.p, out); paint(); flash(T(fixed ? 'beTidyFixed' : 'beTidyDone'));
      }
      function doUndo() { if (undo(P)) { refresh(); flash(T('beUndone')); } else { try { if (ta) { ta.focus(); document.execCommand('undo'); } } catch (e) {} } }
      async function doSave() {
        if (!P.dirty) { flash(T('beNoChanges')); return; }
        const b2 = box.querySelector('.be-save'); if (b2) { b2.disabled = true; b2.textContent = T('beSaving'); }
        try { await save(P); flash(T('beSaved')); if (E.renderHome) E.renderHome(); } catch (e) { flash(T('beSaveErr')); }
        if (box.isConnected) paint();
      }
      paint();
    });
  }
  function pickBlob(accept, fn) {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = accept;
    inp.addEventListener('change', () => { const f = inp.files && inp.files[0]; if (f) fn(f); });
    inp.click();
  }
  const dirOfKind = (P, kind, fallback) => { const it = items(P).find((x) => kindOf(x) === kind); if (it) return it.p.slice(0, it.p.lastIndexOf('/') + 1); return P.opfPath.slice(0, P.opfPath.lastIndexOf('/') + 1) + fallback + '/'; };
  const freeName = (P, dir, name) => { let p = dir + name, k = 1; const stem = name.replace(/\.[^.]+$/, ''), ext = (name.match(/\.[^.]+$/) || [''])[0]; while (items(P).some((x) => x.p === p)) p = dir + stem + '_' + (k++) + ext; return p; };
  const safeName = (n, def) => (String(n || '').normalize('NFC').replace(/[^\p{L}\p{N}._-]+/gu, '_').replace(/^_+|_+$/g, '') || def);
  async function addImage(P, f, fromDoc) {
    const EK = await kit();
    let blob = f, mt = f.type || 'image/jpeg', name = safeName(f.name, 'image.jpg');
    if (!/svg|gif/.test(mt) && f.size > 400 << 10) { try { blob = await EK.imageTo(f, { type: 'image/jpeg', quality: 0.85, maxW: 1600, maxH: 2400 }); mt = 'image/jpeg'; name = name.replace(/\.[^.]+$/, '') + '.jpg'; } catch (e) {} }
    const p = freeName(P, dirOfKind(P, 'img', 'Images'), name);
    snap(P); P.bin.set(p, new Uint8Array(await blob.arrayBuffer())); addItem(P, p, mt);
    return p;
  }
  async function newChapterAfter(P, after, title) {
    const EK = await kit(), it = items(P).find((x) => x.p === after);
    const dir = after ? after.slice(0, after.lastIndexOf('/') + 1) : dirOfKind(P, 'doc', 'Text');
    const p = freeName(P, dir, safeName(title, 'chapter') .slice(0, 40) + '.xhtml');
    const src0 = after && P.text.get(after) || '';
    const css = [...src0.matchAll(/<link\b[^>]*rel\s*=\s*["']stylesheet["'][^>]*>/gi)].map((m) => (/href\s*=\s*["']([^"']+)/i.exec(m[0]) || [])[1]).filter(Boolean)
      .map((h2) => EK.relPath(p, EK.resolvePath(after, h2)));
    const lang = (/\sxml:lang\s*=\s*["']([^"']+)/i.exec(src0) || /\slang\s*=\s*["']([^"']+)/i.exec(src0) || [])[1] || (P.b.lang || 'he');
    const dir2 = (/\sdir\s*=\s*["'](rtl|ltr)/i.exec(src0) || [])[1] || (/^(he|iw|ar|fa|yi)/i.test(lang) ? 'rtl' : '');
    snap(P);
    P.text.set(p, EK.newChapter(title, { lang, dir: dir2, css })); P.changed.add(p);
    addItem(P, p, (it && it.mt) || 'application/xhtml+xml', { after, spine: true });
    return p;
  }

  /* ========== חפש והחלף (A3, A4) ========== */
  function openFind(P, curP, after) {
    E.sheet(T('beFindT'), (sh) => {
      sh.classList.add('be-sheet');
      const S = { q: '', r: '', mode: 'plain', calc: null, word: false, cs: false, code: false, all: true, skip: new Set(), n: 1 };
      const box = h('div', 'be be-find'); sh.append(box);
      const qi = h('input', 'be-inp be-mono'); qi.dir = 'auto'; qi.placeholder = T('beFindQ'); qi.setAttribute('aria-label', T('beFindQ'));
      const ri = h('input', 'be-inp be-mono'); ri.dir = 'auto'; ri.placeholder = T('beFindR'); ri.setAttribute('aria-label', T('beFindR'));
      const opts = h('div', 'be-opts'), calcBox = h('div', 'be-calc'), err = h('p', 'be-err'), list = h('div', 'be-hits'), foot = h('div', 'be-foot');
      let hits = [], tmr = 0;
      const top = h('div', 'be-fr'); top.append(qi, ri, calcBox, opts, err);
      box.append(top, list, foot);
      const paintOpts = () => {
        opts.textContent = '';
        for (const [k, key] of [['plain', 'beMPlain'], ['regex', 'beMRegex'], ['calc', 'beMCalc']]) opts.append(chip(T(key), S.mode === k, () => { S.mode = k; if (k === 'calc' && !S.calc) pickCalc('renum'); paintOpts(); run(); }));
        opts.append(h('span', 'be-sp'));
        opts.append(chip(T('beWord'), S.word, () => { S.word = !S.word; paintOpts(); run(); }), chip(T('beCase'), S.cs, () => { S.cs = !S.cs; paintOpts(); run(); }),
          chip(T('beInCode'), S.code, () => { S.code = !S.code; paintOpts(); run(); }), chip(T(S.all ? 'beAllBook' : 'beThisFile'), S.all, () => { S.all = !S.all; paintOpts(); run(); }));
        ri.hidden = S.mode === 'calc'; calcBox.hidden = S.mode !== 'calc';
        calcBox.textContent = '';
        if (S.mode === 'calc') for (const [k, key, sub] of [['renum', 'beCRenum', 'beCRenumS'], ['hebnum', 'beCHeb', 'beCHebS'], ['upper', 'beCUpper', 'beCUpperS'], ['title', 'beCTitle', 'beCTitleS']]) {   // מפתחות מלאים — coregen אוסף רק מחרוזות שכתובות בקוד
          const r = btn('lib-row be-li' + (S.calc === k ? ' cur' : ''), '', () => { pickCalc(k); paintOpts(); run(); });
          const l = h('span', 'pl-rl'); l.append(h('span', 'pl-rt', T(key)), h('span', 'pl-rs', T(sub))); r.append(h('span', 'be-ic', S.calc === k ? '✓' : 'ƒ'), l); calcBox.append(r);
        }
      };
      const pickCalc = (k) => { S.calc = k; kit().then((EK) => { qi.value = S.q = EK.CALC[k].q; run(); }); };
      const run = () => { clearTimeout(tmr); tmr = setTimeout(run0, 160); };
      async function run0() {
        const EK = await kit(); err.textContent = ''; S.skip.clear();
        let re = null;
        try { re = EK.makeFindRe(S.q, { mode: S.mode === 'plain' ? 'plain' : 'regex', cs: S.cs, word: S.word }); } catch (e) { err.textContent = T('beBadRe'); hits = []; paintHits(); return; }
        const docs = S.all ? [...docsFor(P), ...items(P).filter((x) => kindOf(x) === 'css' && S.code).map((x) => ({ p: x.p, src: P.text.get(x.p) || '' }))] : [{ p: curP, src: P.text.get(curP) || '' }];
        hits = EK.bookFind(docs, re, { code: S.code || /\.css$/i.test(curP) && !S.all });
        paintHits();
      }
      const repOf = (EK) => (hit, n) => S.mode === 'calc' ? EK.CALC[S.calc].f(hit.m, n) : S.mode === 'regex' ? EK.expandRep(hit, S.r, n) : S.r;
      async function paintHits() {
        const EK = await kit(), rep = repOf(EK);
        list.textContent = ''; let n = 0;
        hits.forEach((x, i) => {
          const on = !S.skip.has(i); if (on) n++;
          if (i >= LIST_MAX) return;
          const row = h('div', 'be-hit' + (on ? '' : ' skip'));
          const w = h('div', 'be-where'); w.append(h('span', null, (docTitle(P, x.p) || fname(x.p)).slice(0, 40)), btn('be-lnk', T(on ? 'beSkip' : 'beUnskip'), () => { if (on) S.skip.add(i); else S.skip.delete(i); paintHits(); }));
          const t = h('div', 'be-txt'); t.dir = 'auto';
          const del = h('del', null, x.m), ins = h('ins', null, rep(x, n));
          t.append(document.createTextNode(x.code ? '' : x.pre), del); if (on) t.append(ins); t.append(document.createTextNode(x.code ? '' : x.post));
          row.append(w, t); list.append(row);
        });
        if (hits.length > LIST_MAX) list.append(h('p', 'pl-note', T('beMoreHits', { n: hits.length - LIST_MAX })));
        if (!hits.length && S.q) list.append(h('p', 'lib-empty', T('beNoHits')));
        foot.textContent = '';
        foot.append(h('div', 'be-sum', hits.length ? T('beWillRep', { n, t: hits.length }) : ''));
        const go = btn('bk-cta', T('beReplaceN', { n }), async () => {
          hits.forEach((x, i) => { x.skip = S.skip.has(i); });
          const docs = [...new Set(hits.map((x) => x.p))].map((p) => ({ p, src: P.text.get(p) }));
          snap(P);
          const r = EK.bookReplace(docs, hits, repOf(EK));
          for (const [p, s] of r.put) write(P, p, s);
          flash(T('beReplaced', { n: r.n })); if (after) after(); run0();
        });
        go.disabled = !n; foot.append(go);
      }
      qi.addEventListener('input', () => { S.q = qi.value; run(); });
      ri.addEventListener('input', () => { S.r = ri.value; paintHits(); });
      paintOpts(); setTimeout(() => { try { qi.focus(); } catch (e) {} }, 80);
    });
  }

  /* ========== הקבצים (A14, A9) והגופנים (A13) ========== */
  function openFiles(P, after, openIn) {
    E.sheet(T('beFilesT'), (sh, close) => {
      sh.classList.add('be-sheet');
      const box = h('div', 'be be-files'); sh.append(box);
      const done = () => { paint(); if (after) after(); };
      const row = (it, sub, extra) => {
        const r = btn('lib-row be-li', '', () => actions(it));
        const ic = h('span', 'be-ic k', { doc: '¶', css: '#', img: '▣', font: 'Aa', nav: '≡', ncx: '≡' }[kindOf(it)] || '·');
        const l = h('span', 'pl-rl'); l.append(h('span', 'pl-rt be-mono', fname(it.p)));
        if (sub) { const s = h('span', 'pl-rs', sub); s.dir = 'auto'; l.append(s); }
        r.append(ic, l); if (extra) r.append(extra);
        return r;
      };
      const grp = (key, rows, note) => { if (!rows.length) return; const g = h('div', 'pl-g'); g.append(h('div', 'pl-gh', T(key))); const c = h('div', 'lib-ios pl-card'); rows.forEach((x) => c.append(x)); g.append(c); if (note) g.append(h('p', 'pl-note', note)); box.append(g); };
      async function paint() {
        const EK = await kit();
        box.textContent = '';
        const top = h('div', 'be-ftop');
        top.append(h('span', 'be-fsum', T('beFilesN', { n: items(P).length, x: E.fmtBytes(items(P).reduce((a, x) => a + sizeOf(P, x.p), 0)) })), btn('be-chip', T('beAddFile'), addFile));
        box.append(top);
        const docs = spineDocs(P);
        grp('beGDocs', docs.map((it) => {
          const words = P.text.has(it.p) ? (EK.plainText(P.text.get(it.p)).match(/[\p{L}\p{N}]+/gu) || []).length : 0;
          const big = sizeOf(P, it.p) > 300 << 10 && EK.splitPoints(P.text.get(it.p) || '', [1, 2]).length > 0;
          return row(it, [docTitle(P, it.p), T('beWords', { n: words.toLocaleString() })].filter(Boolean).join(' · '), big ? h('span', 'pl-tag warn', T('beSplitHint')) : null);
        }), T('beOrderNote'));
        const all = items(P);
        grp('beGStyleImg', all.filter((x) => ['css', 'img'].includes(kindOf(x))).map((it) => row(it, E.fmtBytes(sizeOf(P, it.p)), kindOf(it) === 'img' && sizeOf(P, it.p) > 600 << 10 ? h('span', 'pl-tag warn', T('beHeavy')) : null)));
        await fontsGroup(EK);
        grp('beGOther', all.filter((x) => ['nav', 'ncx', 'other'].includes(kindOf(x)) || (kindOf(x) === 'doc' && !docs.some((d) => d.p === x.p))).map((it) => row(it, E.fmtBytes(sizeOf(P, it.p)))));
        box.append(h('p', 'pl-note', T('beRenameNote')));
      }
      async function fontsGroup(EK) {
        const css = items(P).filter((x) => kindOf(x) === 'css' && P.text.has(x.p));
        const faces = css.flatMap((c) => EK.fontFaces(P.text.get(c.p), c.p).map((f) => Object.assign(f, { css: c.p })));
        const used = EK.familiesUsed([...css.map((c) => P.text.get(c.p)), ...spineDocs(P).map((d) => P.text.get(d.p) || '')]);
        const fonts = items(P).filter((x) => kindOf(x) === 'font');
        const rows = [];
        for (const it of fonts) {
          const fc = faces.find((f) => f.srcs.includes(it.p)), fam = fc ? fc.family : '', isUsed = !!fam && used.has(fam);
          const r = row(it, (fam || '') + ' · ' + E.fmtBytes(sizeOf(P, it.p)) + ' · ' + T(isUsed ? 'beFontUsed' : 'beFontUnused'));
          if (!isUsed) r.append(btn('be-mini', T('beDelete'), (e) => { e.stopPropagation(); delFont(it, faces); }));
          else {
            const u8 = await bytesOf(P, it.p);
            if (u8 && u8.length > 40 << 10 && (u8[0] === 0 && u8[1] === 1 || String.fromCharCode(u8[0], u8[1], u8[2], u8[3]) === 'true')) r.append(btn('be-mini', T('beShrink'), (e) => { e.stopPropagation(); shrink(it, u8); }));
          }
          rows.push(r);
        }
        const embedded = new Set(faces.map((f) => f.family));
        for (const fam of [...used].filter((f) => !embedded.has(f) && !GENERIC_FAM.test(f)).slice(0, 8)) {
          const r = h('div', 'lib-row be-li'); const l = h('span', 'pl-rl'); l.append(h('span', 'pl-rt', fam), h('span', 'pl-rs', T('beNotEmbedded')));
          r.append(h('span', 'be-ic k', 'Aa'), l, btn('be-mini', T('beEmbed'), () => pickBlob('.ttf,.otf,.woff,.woff2,font/*', (f) => embedFont(fam, f, null))));
          rows.push(r);
        }
        grp('beGFonts', rows, rows.length ? T('beFontsNote') : '');
      }
      async function shrink(it, u8) {
        const EK = await kit();
        const cps = EK.codepointsOf(spineDocs(P).map((d) => EK.plainText(P.text.get(d.p) || '')));
        const r = EK.subsetTtf(u8, cps);
        if (!r || r.u8.length >= u8.length * 0.95) { flash(T('beShrinkNo')); return; }
        snap(P); P.bin.set(it.p, r.u8); P.dirty = true; P.urls.delete(it.p);
        flash(T('beShrunk', { a: E.fmtBytes(u8.length), b: E.fmtBytes(r.u8.length) })); done();
      }
      function delFont(it, faces) {
        ask(T('beDelFontQ', { f: fname(it.p) }), () => {
          snap(P);
          for (const c of new Set(faces.filter((x) => x.srcs.includes(it.p)).map((x) => x.css))) {
            write(P, c, P.text.get(c).replace(/@font-face\s*\{[^}]*\}\s*/gi, (m) => [...m.matchAll(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi)].some((u) => resolve(c, u[2].trim()) === it.p) ? '' : m));
          }
          removeItem(P, it.p); flash(T('beDeleted')); done();
        }, { danger: true, ok: T('beDelete') });
      }
      async function embedFont(fam, f) {
        const EK = await kit();
        const name = safeName(f.name, 'font.ttf'), ext = (name.match(/\.(ttf|otf|woff2?)$/i) || [, 'ttf'])[1].toLowerCase();
        const mt = { ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2' }[ext];
        const p = freeName(P, dirOfKind(P, 'font', 'Fonts'), name);
        const css = items(P).find((x) => kindOf(x) === 'css' && P.text.has(x.p));
        if (!css) { flash(T('beNoCss')); return; }
        snap(P);
        P.bin.set(p, new Uint8Array(await f.arrayBuffer())); addItem(P, p, mt);
        write(P, css.p, '@font-face {\n  font-family: "' + fam.replace(/"/g, '') + '";\n  src: url("' + EK.relPath(css.p, p) + '");\n}\n' + P.text.get(css.p));
        flash(T('beEmbedded', { f: fam })); done();
      }
      function actions(it) {
        const k = kindOf(it), sp = spineDocs(P), si = sp.indexOf(sp.find((x) => x.p === it.p));
        E.sheet(fname(it.p), (s2, close2) => {
          const card = h('div', 'lib-ios pl-card');
          const a = (ic, key, sub, fn, cls) => { const r = btn('lib-row be-li' + (cls ? ' ' + cls : ''), '', () => { close2(); fn(); }); const l = h('span', 'pl-rl'); l.append(h('span', 'pl-rt', T(key))); if (sub) l.append(h('span', 'pl-rs', sub)); r.append(h('span', 'be-ic', ic), l); card.append(r); };
          if (P.text.has(it.p)) a('✎', 'beOpenEd', '', () => { close(); openIn(it.p); });
          a('Aa', 'beRename', T('beRenameS', { n: refCount(P, it.p) }), () => askText(T('beRename'), fname(it.p), T('beRename'), async (nm) => {
            const n2 = safeName(nm, ''); if (!n2) return;
            const to = it.p.slice(0, it.p.lastIndexOf('/') + 1) + n2;
            if (items(P).some((x) => x.p === to)) { flash(T('beNameTaken')); return; }
            if (await renamePath(P, it.p, to)) { flash(T('beRenamed')); done(); }
          }, { dir: 'ltr' }));
          if (k === 'doc' && si >= 0) {
            if (si > 0) a('↑', 'beMoveUp', '', () => { moveInSpine(P, it.p, -1); done(); });
            if (si < sp.length - 1) a('↓', 'beMoveDown', '', () => { moveInSpine(P, it.p, 1); done(); });
            kit().then((EK) => {
              const n1 = EK.splitPoints(P.text.get(it.p) || '', [1]).length, n2 = EK.splitPoints(P.text.get(it.p) || '', [1, 2]).length;
              const bef = card.querySelector('.be-del');
              const ins = (r) => (bef ? card.insertBefore(r, bef) : card.append(r));
              const mk = (key, sub, fn) => { const r = btn('lib-row be-li', '', () => { close2(); fn(); }); const l = h('span', 'pl-rl'); l.append(h('span', 'pl-rt', T(key)), h('span', 'pl-rs', sub)); r.append(h('span', 'be-ic', '⫽'), l); ins(r); };
              if (n2) mk('beSplitH2', T('beSplitS', { n: n2 + 1 }), async () => { const n = await splitAt(P, it.p, [1, 2]); flash(T('beSplitDone', { n })); done(); });
              if (n1 && n1 !== n2) mk('beSplitH1', T('beSplitS', { n: n1 + 1 }), async () => { const n = await splitAt(P, it.p, [1]); flash(T('beSplitDone', { n })); done(); });
              if (si < sp.length - 1) { const r = btn('lib-row be-li', '', () => { close2(); mergeNext(P, it.p).then((ok2) => { flash(T(ok2 ? 'beMerged' : 'beMergeFail')); done(); }); }); const l = h('span', 'pl-rl'); l.append(h('span', 'pl-rt', T('beMerge')), h('span', 'pl-rs', fname(sp[si + 1].p))); r.append(h('span', 'be-ic', '⊕'), l); ins(r); }
            });
          }
          if (k !== 'nav' && k !== 'ncx') {
            const n = refCount(P, it.p);
            a('⌫', 'beDelete', n ? T('beDelRefs', { n }) : '', () => ask(T('beDelQ', { f: fname(it.p) }) + (n ? ' ' + T('beDelRefs', { n }) : ''), () => { snap(P); removeItem(P, it.p); flash(T('beDeleted')); done(); }, { danger: true, ok: T('beDelete') }), 'be-del');
          }
          s2.append(card);
        });
      }
      function addFile() {
        E.sheet(T('beAddFile'), (s2, close2) => {
          const card = h('div', 'lib-ios pl-card');
          const a = (ic, key, fn) => { const r = btn('lib-row be-li', '', () => { close2(); fn(); }); const l = h('span', 'pl-rl'); l.append(h('span', 'pl-rt', T(key))); r.append(h('span', 'be-ic', ic), l); card.append(r); };
          a('＋', 'beAddChap', () => askText(T('beAddChap'), T('beNewChapT'), T('beCreate'), (t) => { const sp = spineDocs(P); newChapterAfter(P, (sp[sp.length - 1] || {}).p, t).then(done); }));
          a('▣', 'beAddImg', () => pickBlob('image/*', (f) => addImage(P, f).then(done)));
          a('Aa', 'beAddFont', () => pickBlob('.ttf,.otf,.woff,.woff2,font/*', (f) => askText(T('beFontFam'), safeName(f.name, 'Font').replace(/\.[^.]+$/, ''), T('beEmbed'), (fam) => fam && embedFont(fam.trim(), f), { dir: 'ltr' })));
          a('#', 'beAddCss', async () => { const p = freeName(P, dirOfKind(P, 'css', 'Styles'), 'style.css'); snap(P); P.text.set(p, '/* ' + T('beNewCss') + ' */\n'); P.changed.add(p); addItem(P, p, 'text/css'); done(); });
          s2.append(card);
        });
      }
      paint();
    });
  }

  /* ========== תוכן העניינים (A8) ========== */
  function openToc(P, after) {
    E.sheet(T('beTocT'), async (sh, close) => {
      sh.classList.add('be-sheet');
      const box = h('div', 'be be-toc'); sh.append(box);
      await Promise.resolve();
      const EK = await kit();
      let list = (await readToc(P)).map((x) => Object.assign({}, x)), sel = 0;
      const lv = h('div', 'be-tocl'), barB = h('div', 'be-tocbar');
      const paint = () => {
        lv.textContent = '';
        list.forEach((x, i) => {
          const r = h('div', 'be-ti' + (i === sel ? ' sel' : '')); r.style.marginInlineStart = (x.lvl - 1) * 20 + 'px';
          const inp = h('input', 'be-tin'); inp.value = x.t; inp.dir = 'auto'; inp.setAttribute('aria-label', T('beTocName'));
          inp.addEventListener('input', () => { x.t = inp.value; });
          inp.addEventListener('focus', () => { if (sel !== i) { sel = i; lv.querySelectorAll('.be-ti').forEach((y, k) => y.classList.toggle('sel', k === i)); } });
          const m = h('div', 'be-tm'); m.append(inp, h('span', 'be-tg be-mono', fname(x.p) + (x.f ? '#' + x.f : '')));
          r.append(h('span', 'be-lv', T('beLevel', { n: x.lvl })), m);
          r.addEventListener('click', (e) => { if (e.target === inp) return; sel = i; paint(); });
          lv.append(r);
        });
        if (!list.length) lv.append(h('p', 'lib-empty', T('beTocEmpty')));
      };
      const mv = (fn) => () => { if (!list[sel]) return; fn(); paint(); };
      barB.append(
        chip('↑', false, mv(() => { if (sel > 0) { [list[sel - 1], list[sel]] = [list[sel], list[sel - 1]]; sel--; } })),
        chip('↓', false, mv(() => { if (sel < list.length - 1) { [list[sel + 1], list[sel]] = [list[sel], list[sel + 1]]; sel++; } })),
        chip(T('beIn'), false, mv(() => { list[sel].lvl = Math.min(6, list[sel].lvl + 1); })),
        chip(T('beOut'), false, mv(() => { list[sel].lvl = Math.max(1, list[sel].lvl - 1); })),
        chip(T('beDelete'), false, mv(() => { list.splice(sel, 1); sel = Math.max(0, sel - 1); })));
      const gen = h('div', 'pl-g'); gen.append(h('div', 'pl-gh', T('beTocGen')));
      const card = h('div', 'lib-ios pl-card');
      const genRow = (key, levels, sub) => { const r = btn('lib-row be-li', '', () => { const res = EK.tocFromHeadings(docsFor(P), levels); if (!res.items.length) { flash(T('beTocNone')); return; } snap(P); for (const [p, s] of res.put) write(P, p, s); list = res.items; sel = 0; paint(); }); const l = h('span', 'pl-rl'); l.append(h('span', 'pl-rt', T(key)), h('span', 'pl-rs', sub)); r.append(h('span', 'be-ic', '↻'), l); card.append(r); };
      genRow('beTocH12', [1, 2], T('beTocN', { n: EK.tocFromHeadings(docsFor(P), [1, 2]).items.length }));
      genRow('beTocH1', [1], T('beTocN', { n: EK.tocFromHeadings(docsFor(P), [1]).items.length }));
      const selRow = btn('lib-row be-li', '', () => askText(T('beTocSel'), 'p.chapter', T('beCreate'), (q) => {
        const res = EK.tocFromSelector(docsFor(P), q); if (!res.items.length) { flash(T('beTocNone')); return; }
        snap(P); for (const [p, s] of res.put) write(P, p, s); list = res.items; sel = 0; paint();
      }, { dir: 'ltr' }));
      const l3 = h('span', 'pl-rl'); l3.append(h('span', 'pl-rt', T('beTocSel')), h('span', 'pl-rs be-mono', 'p.chapter-title')); selRow.append(h('span', 'be-ic', '◎'), l3); card.append(selRow);
      gen.append(card, h('p', 'pl-note', T('beTocNote')));
      const foot = h('div', 'be-foot');
      foot.append(btn('bk-cta', T('beApply'), async () => { await writeToc(P, list.filter((x) => x.t.trim())); flash(T('beTocSaved')); close(); if (after) after(); }));
      box.append(lv, barB, gen, foot);
      paint();
    });
  }

  /* ========== גרסאות: נקודות שמירה (A6) והשוואה (A7) ========== */
  async function textsOf(blob) {
    const EK = await kit(), rep = await EK.inspectEpub(blob), out = new Map();
    if (!rep.ok) return out;
    const P0 = { opf: rep.opf, opfPath: rep.opfPath };
    for (const it of items(P0)) { if (!isTextItem(it)) continue; const e = rep.zip.byName.get(it.p); if (e) try { out.set(it.p, await EK.readText(blob, e, 16 << 20)); } catch (er) {} }
    return out;
  }
  function openVersions(P, after) {
    E.sheet(T('beVerT'), async (sh, close) => {
      sh.classList.add('be-sheet');
      const box = h('div', 'be be-ver'); sh.append(box);
      await Promise.resolve();
      const EK = await kit(), cache = new Map();
      let cps = [], pick = [];
      const load2 = async () => { cps = (await E.cpList(P.b.id)).sort((a, b) => b.at - a.at); pick = cps.length ? ['now', cps[0].key] : []; };
      const label = (k) => k === 'now' ? T('beNow') : ((cps.find((c) => c.key === k) || {}).n || '');
      const texts = async (k) => { if (k === 'now') return P.text; if (!cache.has(k)) { const c = await E.cpGet(k); cache.set(k, c ? await textsOf(c.f) : new Map()); } return cache.get(k); };
      const when = (at) => new Date(at).toLocaleString(document.documentElement.lang === 'en' ? 'en-GB' : 'he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
      async function paint() {
        box.textContent = '';
        const top = h('div', 'be-ftop'); top.append(h('span', 'be-fsum', T('beVerHint')), btn('be-chip', T('beCpNew'), newCp)); box.append(top);
        const tl = h('div', 'be-tl');
        const node = (k, t, s, cls) => {
          const r = btn('be-cp' + (pick.includes(k) ? ' pk' : '') + (cls ? ' ' + cls : ''), '', () => { if (!pick.includes(k)) { pick = [pick[1] || pick[0], k].filter(Boolean); paint(); } });
          const m = h('span', 'pl-rl'); m.append(h('span', 'pl-rt', t), h('span', 'pl-rs', s)); r.append(h('i', 'be-dot'), m);
          if (pick.includes(k) && pick.length === 2) r.append(h('span', 'be-ab', T(older(k) ? 'beOlder' : 'beNewer')));
          tl.append(r);
        };
        const atOf = (k) => k === 'now' ? Infinity : (cps.find((c) => c.key === k) || {}).at || 0;
        const older = (k) => atOf(k) === Math.min(...pick.map(atOf));
        node('now', T('beNow'), P.dirty ? T('beNowDirty') : T('beNowSaved'), 'now');
        for (const c of cps) node(c.key, c.n, (c.kind === 'orig' ? T('beOrig') + ' · ' : c.kind === 'manual' ? T('beManual') + ' · ' : '') + when(c.at) + ' · ' + E.fmtBytes(c.f.size));
        box.append(tl);
        if (!cps.length) { box.append(h('p', 'lib-empty', T('beNoCps'))); return; }
        if (pick.length < 2) return;
        const [a, b] = pick.slice().sort((x, y) => atOf(x) - atOf(y));
        const diffBox = h('div', 'be-diffs'); box.append(diffBox);
        diffBox.append(h('p', 'lib-empty', T('beComparing')));
        const [A, B] = [await texts(a), await texts(b)];
        diffBox.textContent = '';
        let adds = 0, dels = 0, files = 0;
        const blocks = [];
        for (const p of [...new Set([...A.keys(), ...B.keys()])]) {
          const x = A.get(p) || '', y = B.get(p) || ''; if (x === y) continue;
          const d = EK.diffLines(x, y); files++;
          const keep = new Set(); d.forEach((z, k) => { if (z[0] !== 'c') for (let q = k - 2; q <= k + 2; q++) keep.add(q); });
          const blk = h('div', 'be-diff'); const hd = h('div', 'be-dh'); hd.append(h('b', 'be-mono', fname(p)), h('span', null, label(a) + ' ← ' + label(b))); blk.append(hd);
          let gap = false, shown = 0;
          d.forEach((z, k) => {
            if (z[0] === 'a') adds++; if (z[0] === 'r') dels++;
            if (!keep.has(k)) { if (!gap) blk.append(h('div', 'be-dsk', '⋯')); gap = true; return; }
            gap = false; if (++shown > 400) return;
            const ln = h('div', 'be-dl ' + z[0]); ln.append(h('i', null, z[0] === 'a' ? '+' : z[0] === 'r' ? '−' : ''), h('span', null, z[1].length > 600 ? z[1].slice(0, 600) + '…' : z[1])); blk.append(ln);
          });
          if (shown > 400) blk.append(h('div', 'be-dsk', T('beMoreLines', { n: shown - 400 })));
          blocks.push(blk);
        }
        const sum = h('div', 'pl-gh be-dsum'); sum.append(h('span', null, T('beChanged')), h('span', null, T('beDiffSum', { f: files, a: adds, r: dels })));
        diffBox.append(sum, ...blocks);
        if (!files) diffBox.append(h('p', 'lib-empty', T('beSame')));
        const old = cps.find((c) => c.key === a);
        if (old) {
          const foot = h('div', 'be-foot');
          foot.append(btn('ed-btn ghost', T('beRestore', { n: old.n }), () => ask(T('beRestoreQ', { n: old.n }) + (P.dirty ? ' ' + T('beRestoreDirty') : ''), async () => {
            try { await E.cpRestore(P.b.id, old.key); revokeAll(P); Object.assign(P, await load(P.b)); DRAFTS.delete(P.b.id); flash(T('beRestored', { n: old.n })); await load2(); cache.clear(); paint(); if (after) after(); } catch (e) { flash(T('beSaveErr')); }
          }, { ok: T('beRestoreOk') })));
          box.append(foot);
        }
      }
      function newCp() {
        askText(T('beCpNew'), T('beCpName'), T('beCpSaveBtn'), async (n) => {
          try { if (P.dirty) await save(P, T('beCpSave')); await E.cpAdd(P.b.id, P.file, (n || '').trim() || T('beCpName'), 'manual'); await load2(); paint(); flash(T('beCpAdded')); if (after) after(); } catch (e) { flash(T('beSaveErr')); }
        });
      }
      await load2(); paint();
    });
  }

  /* ========== עריכה בדף (A2): מהקורא, בלי קוד ========== */
  function openHere(b, { idx, block }) {
    if (!E.isMine(b) || !block) return;
    const oldText = block.textContent || '';
    E.sheet(T('edHere'), (sh, close) => {
      const box = h('div', 'be-ask');
      const inp = h('textarea', 'be-inp be-here'); inp.value = oldText.replace(/\s+/g, ' ').trim(); inp.dir = 'auto'; inp.rows = Math.min(12, Math.max(4, Math.ceil(inp.value.length / 38)));
      const note = h('p', 'pl-note', T('edHereNote'));
      const ok = btn('bk-cta', T('beSave'), async () => {
        const nv = inp.value; if (nv === inp.defaultValue || nv === oldText.replace(/\s+/g, ' ').trim()) { close(); return; }
        ok.disabled = true; ok.textContent = T('beSaving');
        try {
          const EK = await kit(); resolve = EK.resolvePath; relPath = EK.relPath;
          const P = await load(b);
          const it = spineAll(P)[idx]; if (!it || !P.text.has(it.p)) throw new Error('sec');
          const src = EK.editText(P.text.get(it.p), oldText, nv);
          if (src == null) { flash(T('edHereFail')); ok.disabled = false; ok.textContent = T('beSave'); return; }
          write(P, it.p, src); await save(P, T('beCpHere'));
          liveEdit(EK, block, oldText, nv);
          close(); flash(T('edHereDone'));
        } catch (e) { flash(T('beSaveErr')); ok.disabled = false; ok.textContent = T('beSave'); }
      });
      box.append(inp, note, ok); sh.append(box);
      setTimeout(() => { try { inp.focus(); } catch (e) {} }, 80);
    });
  }
  const spineAll = (P) => {                         // כל ה־spine (כמו foliate — גם linear="no"), לפי הסדר
    const byId = new Map(items(P).map((it) => [it.id, it]));
    return Array.from(P.opf.getElementsByTagNameNS(OPF_NS, 'itemref')).map((r) => byId.get(r.getAttribute('idref'))).filter(Boolean);
  };
  function liveEdit(EK, block, oldText, nv) {       // אותו שינוי בדף שמוצג — בלי לטעון את הקורא מחדש
    try {
      const w = block.ownerDocument.createTreeWalker(block, 4), nodes = []; let n; while ((n = w.nextNode())) nodes.push(n);
      const sp = EK.spliceCollapsed(nodes.map((x) => x.nodeValue).join(''), oldText, nv); if (!sp) return;
      const ed = EK.spliceRuns(nodes.map((x) => x.nodeValue.length), sp) || [];
      for (const x of ed) { const t = nodes[x.i]; t.nodeValue = t.nodeValue.slice(0, x.lo) + x.r + t.nodeValue.slice(x.hi); }
    } catch (e) {}
  }

  return { open, openHere };
}
