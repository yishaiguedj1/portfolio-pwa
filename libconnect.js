/* Academy Pro גל 6 (03/11/2026): חיבורים — מאמר מקישור (C10), עיתון בוקר (C11), תיבת הדואר: הרצאה מ־Studio (C12) ושליחה
   למכשיר אחר (G4), ייבוא הדגשות מקובץ הקטעים של הקורא האלקטרוני (G2), גיבוי מלא לקובץ ושחזור (G6).
   נטען רק כשנכנסים לאחד מהם. הדפים והפידים עוברים דרך השרתון (op:'webGet' — הגנה מכתובות פנימיות), הניתוח כאן (DOMParser). */

const fold = (s) => String(s || '').toLowerCase().normalize('NFKC').replace(/[֑-ׇ]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- G2: קובץ הקטעים (טהורות) ---------- */
export function parseClippings(text) {
  const out = [];
  for (const blk of String(text || '').replace(/^﻿/, '').replace(/\r/g, '').split(/\n={5,}\s*(?:\n|$)/)) {
    const lines = blk.split('\n'); while (lines.length && !lines[0].trim()) lines.shift();
    if (lines.length < 2) continue;
    const head = lines[0].replace(/^﻿/, '').trim(), meta = lines[1].trim();
    if (!/^-\s/.test(meta)) continue;
    const body = lines.slice(2).join('\n').trim();
    const am = /^(.*?)\s*\(([^()]*)\)\s*$/.exec(head);
    const title = (am ? am[1] : head).trim(), author = am ? am[2].trim() : '';
    const kind = /bookmark|סימני|lesezeichen|marcador|signet|segnalibro/i.test(meta) ? 'bm' : /\bnote\b|הערה|notiz|\bnota\b|remarque/i.test(meta) ? 'note' : 'hl';
    const lm = /(?:location|מיקום|position|posición|emplacement|posizione|pos\.)\s*([\d,]+)(?:\s*-\s*([\d,]+))?/i.exec(meta) || /(\d+)(?:-(\d+))?/.exec(meta.replace(/page\s*\d+|עמוד\s*\d+/i, ''));
    const n = (x) => (x ? parseInt(String(x).replace(/,/g, ''), 10) || 0 : 0);
    const loc = lm ? n(lm[1]) : 0, end = lm ? n(lm[2]) || loc : 0;
    if (!title || (kind !== 'bm' && !body)) continue;
    out.push({ title, author, kind, loc, end, text: body });
  }
  return out;
}
export function groupClips(list) {   // לפי ספר: הדגשות (בלי כפילויות של עריכה — אותו מיקום, הארוכה נשארת) + הערות שנצמדות להדגשה שלהן
  const by = new Map();
  for (const c of list) {
    if (c.kind === 'bm') continue;
    const k = fold(c.title); if (!by.has(k)) by.set(k, { title: c.title, author: c.author, hl: [], notes: [] });
    const g = by.get(k);
    if (c.kind === 'note') { g.notes.push(c); continue; }
    const same = g.hl.findIndex((x) => x.loc === c.loc || (fold(x.text).includes(fold(c.text)) || fold(c.text).includes(fold(x.text))) && Math.abs(x.loc - c.loc) < 20);
    if (same >= 0) { if (c.text.length > g.hl[same].text.length) g.hl[same] = Object.assign({}, c, { note: g.hl[same].note }); }
    else g.hl.push(Object.assign({ note: '' }, c));
  }
  for (const g of by.values()) {
    for (const nt of g.notes) {
      const h = g.hl.find((x) => nt.loc >= x.loc && nt.loc <= x.end + 1);
      if (h) h.note = h.note ? h.note + '\n' + nt.text : nt.text;
      else g.hl.push({ title: g.title, kind: 'note', loc: nt.loc, end: nt.loc, text: '', note: nt.text });
    }
    g.hl.sort((a, b) => a.loc - b.loc);
    delete g.notes;
  }
  return [...by.values()].filter((g) => g.hl.length);
}
export function matchBook(title, author, books) {   // ספר בספרייה לפי שם (ומחבר כשיש כמה)
  const t = fold(title).replace(/\s*(a novel|רומן)$/, ''), a = fold(author);
  if (!t) return null;
  const score = (b) => {
    const bt = fold(b.title);
    if (!bt) return 0;
    let s = bt === t ? 3 : (bt.length >= 5 && t.length >= 5 && (bt.startsWith(t) || t.startsWith(bt))) ? 2 : 0;
    if (s && a && fold(b.author) && (fold(b.author).includes(a.split(' ').pop()) || a.includes(fold(b.author).split(' ').pop()))) s += 1;
    return s;
  };
  let best = null, bs = 0;
  for (const b of books) { const s = score(b); if (s > bs) { bs = s; best = b; } }
  return best;
}
export function clipQueue(g, existing, queued) {   // הדגשות לתור של הספר (בלי מה שכבר יש — לפי הטקסט); המיקום נמצא בפתיחה
  const have = new Set((existing || []).filter((a) => !a.d && !a.b).map((a) => fold(a.x)).concat((queued || []).map((a) => fold(a.x))));
  const out = [];
  for (const c of g.hl) {
    const x = String(c.text || '').slice(0, 600), n = String(c.note || '').slice(0, 4000);
    if (!x || have.has(fold(x))) continue;
    have.add(fold(x));
    out.push({ x, n, t: 0 });
  }
  return out;
}
export function searchQuery(x) {   // קטע לחיפוש בספר: עד 60 תווים, בלי לחתוך מילה באמצע
  const s = String(x || '').replace(/\s+/g, ' ').trim();
  if (s.length <= 60) return s;
  const cut = s.slice(0, 60), sp = cut.lastIndexOf(' ');
  return sp > 20 ? cut.slice(0, sp) : cut;
}

/* ---------- C10/C11: מאמר מדף ופריטים מפיד (טהורות על Document) ---------- */
const DROP = 'script,style,noscript,iframe,form,nav,header,footer,aside,button,svg,canvas,video,audio,select,input,textarea,template,dialog,[role=navigation],[role=banner],[role=contentinfo],[aria-hidden=true],[hidden]';
const NOISE = /(^|[\s_-])(comment|share|social|related|promo|subscribe|newsletter|sidebar|menu|breadcrumb|cookie|banner|advert|ads?|sponsor|outbrain|taboola|popup|modal|footer|nav|tags?)([\s_-]|$)/i;
const BLOCKS = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'FIGCAPTION', 'TABLE', 'DIV', 'SECTION', 'ARTICLE', 'MAIN', 'DL', 'DT', 'DD', 'FIGURE', 'HR']);
function inline(n) {
  let s = '';
  for (const c of n.childNodes) {
    if (c.nodeType === 3) s += esc(c.nodeValue.replace(/\s+/g, ' '));
    else if (c.nodeType === 1) {
      const t = c.tagName;
      if (t === 'BR') s += '<br/>';
      else if (t === 'EM' || t === 'I') s += '<em>' + inline(c) + '</em>';
      else if (t === 'STRONG' || t === 'B') s += '<strong>' + inline(c) + '</strong>';
      else if (t === 'SUP' || t === 'SUB') s += '<' + t.toLowerCase() + '>' + inline(c) + '</' + t.toLowerCase() + '>';
      else if (!BLOCKS.has(t)) s += inline(c);
    }
  }
  return s;
}
function blocks(n, out, depth) {
  for (const c of n.childNodes) {
    if (c.nodeType === 3) { const t = c.nodeValue.replace(/\s+/g, ' ').trim(); if (t.length > 1) out.push('<p>' + esc(t) + '</p>'); continue; }
    if (c.nodeType !== 1) continue;
    const t = c.tagName;
    if (/^H[1-6]$/.test(t)) { const x = inline(c).trim(); if (x) out.push('<h' + Math.min(4, Math.max(2, +t[1])) + '>' + x + '</h' + Math.min(4, Math.max(2, +t[1])) + '>'); }
    else if (t === 'P' || t === 'FIGCAPTION' || t === 'DT' || t === 'DD') { const x = inline(c).trim(); if (x.replace(/<[^>]+>/g, '').trim()) out.push('<p>' + x + '</p>'); }
    else if (t === 'UL' || t === 'OL') { const li = [...c.children].filter((x) => x.tagName === 'LI').map((x) => inline(x).trim()).filter(Boolean); if (li.length) out.push('<' + t.toLowerCase() + '>' + li.map((x) => '<li>' + x + '</li>').join('') + '</' + t.toLowerCase() + '>'); }
    else if (t === 'BLOCKQUOTE') { const sub = []; blocks(c, sub, depth + 1); if (sub.length) out.push('<blockquote>' + sub.join('') + '</blockquote>'); }
    else if (t === 'PRE') out.push('<pre>' + esc(c.textContent) + '</pre>');
    else if (t === 'HR') out.push('<hr/>');
    else if (t === 'TABLE') { const x = esc(c.textContent.replace(/\s+/g, ' ').trim()); if (x) out.push('<p>' + x + '</p>'); }
    else if (depth < 40) {
      const hasBlock = [...c.children].some((x) => BLOCKS.has(x.tagName));
      if (hasBlock) blocks(c, out, depth + 1);
      else { const x = inline(c).trim(); if (x.replace(/<[^>]+>/g, '').trim().length > 1) out.push('<p>' + x + '</p>'); }
    }
  }
}
const meta = (doc, sel) => { const m = doc.querySelector(sel); return m ? String(m.getAttribute('content') || '').trim() : ''; };
export function extractArticle(doc, url) {
  const site = meta(doc, 'meta[property="og:site_name"]') || (() => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return ''; } })();
  let title = meta(doc, 'meta[property="og:title"]') || meta(doc, 'meta[name="twitter:title"]') || (doc.querySelector('h1') ? doc.querySelector('h1').textContent : '') || (doc.title || '');
  title = title.replace(/\s+/g, ' ').trim().replace(/\s+[|·•–—-]\s+[^|·•–—-]{2,40}$/, '').slice(0, 200);
  const byline = meta(doc, 'meta[name="author"]') || meta(doc, 'meta[property="article:author"]').replace(/^https?:\/\/\S+$/, '');
  const lang = (doc.documentElement.getAttribute('lang') || '').slice(0, 2).toLowerCase();
  const body = doc.body; if (!body) return null;
  body.querySelectorAll(DROP).forEach((x) => x.remove());
  body.querySelectorAll('[class],[id]').forEach((x) => { const s = (x.getAttribute('class') || '') + ' ' + (x.getAttribute('id') || ''); if (NOISE.test(s) && x.textContent.length < 4000 && !x.querySelector('article')) x.remove(); });
  let root = null, best = 0;
  const arts = [...body.querySelectorAll('article,[itemprop=articleBody],main')];
  for (const a of arts) { const n = a.querySelectorAll('p').length; const L = a.textContent.length; if (n >= 2 && L > best) { best = L; root = a; } }
  if (!root) {
    const sc = new Map();
    for (const p of body.querySelectorAll('p')) {
      const L = p.textContent.trim().length; if (L < 40) continue;
      const a = p.parentElement, b = a && a.parentElement;
      if (a) sc.set(a, (sc.get(a) || 0) + L);
      if (b) sc.set(b, (sc.get(b) || 0) + L / 2);
    }
    for (const [el, s] of sc) if (s > best) { best = s; root = el; }
  }
  root = root || body;
  const out = []; blocks(root, out, 0);
  const tnorm = fold(title);
  while (out.length && /^<h\d>/.test(out[0]) && fold(out[0].replace(/<[^>]+>/g, '')) === tnorm) out.shift();   // הכותרת — רק פעם אחת
  const html = out.join('\n');
  const words = html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  return words >= 20 ? { title: title || site, byline, site, lang, html, words } : null;
}
export function parseFeed(doc) {     // RSS 2.0 / Atom → [{title, link, at, html}]
  const tx = (el, sel) => { const x = el.getElementsByTagName(sel)[0]; return x ? x.textContent.trim() : ''; };
  const items = [...doc.getElementsByTagName('item')], entries = [...doc.getElementsByTagName('entry')];
  const out = [];
  for (const it of items) out.push({ title: tx(it, 'title'), link: tx(it, 'link') || tx(it, 'guid'), at: Date.parse(tx(it, 'pubDate') || tx(it, 'dc:date')) || 0, html: tx(it, 'content:encoded') || tx(it, 'description') });
  for (const it of entries) {
    const ln = [...it.getElementsByTagName('link')].find((l) => !l.getAttribute('rel') || l.getAttribute('rel') === 'alternate');
    out.push({ title: tx(it, 'title'), link: ln ? ln.getAttribute('href') || '' : '', at: Date.parse(tx(it, 'published') || tx(it, 'updated')) || 0, html: tx(it, 'content') || tx(it, 'summary') });
  }
  const ch = doc.getElementsByTagName('channel')[0] || doc.getElementsByTagName('feed')[0];
  const title = ch ? (tx(ch, 'title') || '') : '';
  return { title, items: out.filter((x) => x.title && /^https?:\/\//.test(x.link)) };
}
export function pickItems(feeds, now, perFeed, max) {   // הפריטים של היום: עד 36 שעות (בלי תאריך — הראשונים), לסירוגין בין הפידים
  const lists = feeds.map((f) => { const fresh = f.items.filter((x) => x.at && now - x.at < 36 * 36e5); return (fresh.length || f.items.some((x) => x.at) ? fresh : f.items).slice(0, perFeed).map((x) => Object.assign({ feed: f.title }, x)); });
  const out = [], seen = new Set();
  for (let i = 0; out.length < max && lists.some((l) => l[i]); i++) for (const l of lists) { const x = l[i]; if (x && !seen.has(x.link) && out.length < max) { seen.add(x.link); out.push(x); } }
  return out;
}
export function feedLinkOf(doc, base) {   // דף רגיל → הפיד שהוא מכריז עליו
  const l = doc.querySelector('link[rel=alternate][type="application/rss+xml"],link[rel=alternate][type="application/atom+xml"]');
  if (!l) return '';
  try { return new URL(l.getAttribute('href'), base).href; } catch (e) { return ''; }
}

/* ---------- G6: ZIP בלי דחיסה (store), כ־Blob מחלקים — בלי להעתיק את כל הספרים לזיכרון אחד ---------- */
export function zipParts(entries, crc32, now) {   // entries: [{name, data: Uint8Array | {blob, crc, size}}]
  const enc = new TextEncoder(), d = now || new Date();
  const dt = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xffff, dd = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff;
  const parts = [], cen = []; let off = 0;
  for (const e of entries) {
    const nm = enc.encode(e.name), isU8 = e.data instanceof Uint8Array;
    const size = isU8 ? e.data.length : e.data.size, crc = isU8 ? crc32(e.data) >>> 0 : e.data.crc >>> 0;
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
    h.setUint16(10, dt, true); h.setUint16(12, dd, true); h.setUint32(14, crc, true); h.setUint32(18, size, true); h.setUint32(22, size, true);
    h.setUint16(26, nm.length, true); h.setUint16(28, 0, true);
    parts.push(new Uint8Array(h.buffer), nm, isU8 ? e.data : e.data.blob);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
    c.setUint16(12, dt, true); c.setUint16(14, dd, true); c.setUint32(16, crc, true); c.setUint32(20, size, true); c.setUint32(24, size, true);
    c.setUint16(28, nm.length, true); c.setUint32(42, off, true);
    cen.push(new Uint8Array(c.buffer), nm);
    off += 30 + nm.length + size;
  }
  const cdSize = cen.reduce((a, x) => a + x.length, 0);
  const z = new DataView(new ArrayBuffer(22));
  z.setUint32(0, 0x06054b50, true); z.setUint16(8, entries.length, true); z.setUint16(10, entries.length, true); z.setUint32(12, cdSize, true); z.setUint32(16, off, true);
  return parts.concat(cen, [new Uint8Array(z.buffer)]);
}
export function mergeRec(cur, b) {   // שחזור לספר שכבר קיים: איחוד הסימונים (החדש לפי u גובר), ההתקדמות הגבוהה
  const m = new Map((cur.ann || []).map((a) => [a.id, a]));
  for (const a of b.ann || []) { const x = m.get(a.id); if (!x || (a.u || 0) > (x.u || 0)) m.set(a.id, a); }
  const out = Object.assign({}, cur, { ann: [...m.values()] });
  if ((b.fraction || 0) > (cur.fraction || 0)) { out.fraction = b.fraction; if (b.cfi) out.cfi = b.cfi; }
  if (b.done) out.done = b.done;
  return out;
}
export const paperDay = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

const LS_FEEDS = 'pwa_libfeeds_v1', LS_SENT = 'pwa_libsent_v1';
const BACKUP_LS = ['pwa_libstats_v1', 'pwa_libq_v1', 'pwa_libcoll_v1', 'pwa_libpace_v1', 'pwa_libfeeds_v1', 'pwa_reader_v1', 'pwa_libtts_v1', 'pwa_hlcolor_v1', 'pwa_liblayout_v1'];

export function createConnect(E) {
  const { h, T } = E;
  const flash = (m) => E.flash(m);
  const lsGet = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || '') || d; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const btn = (cls, txt, fn) => { const b = h('button', cls, txt); b.type = 'button'; if (fn) b.addEventListener('click', fn); return b; };
  const rowL = (t, s) => { const l = h('span', 'pl-rl'); const a = h('span', 'pl-rt', t); a.dir = 'auto'; l.append(a); if (s) { const b = h('span', 'pl-rs', s); b.dir = 'auto'; l.append(b); } return l; };
  const errOf = (e) => {
    const m = e && e.message;
    if (m === 'signin') return T('aiSignin');
    if (m === 'bad_url' || m === 'bad_host') return T('cnBadUrl');
    if (m === 'bad_type') return T('cnBadType');
    if (m === 'too_big') return T('cnTooBig');
    if (m === 'rate_limited') return T('aiLimit');
    if (m === 'inbox_full') return T('cnInboxFull');
    return T('cnNetErr');
  };
  const parse = (text, type) => new DOMParser().parseFromString(text, /xml/.test(type) && !/xhtml/.test(type) ? 'application/xml' : 'text/html');

  async function fetchArticle(url) {
    const j = await E.api('webGet', { url });
    const doc = parse(j.text, j.type);
    const a = extractArticle(doc, j.url);
    if (!a) throw new Error('no_article');
    return Object.assign(a, { url: j.url });
  }
  const chapterOf = (a) => ({ title: a.title, body: '<h1>' + esc(a.title) + '</h1>\n' + (a.byline || a.site ? '<p class="byline"><em>' + esc([a.byline, a.site].filter(Boolean).join(' · ')) + '</em></p>\n' : '') + a.html, lvl: 1 });

  /* ---------- C10: מאמר מהרשת ---------- */
  function openArticle() {
    E.sheet(T('cnArt'), (sh, close) => {
      const box = h('div', 'pl'); sh.append(box);
      box.append(h('p', 'pl-note', T('cnArtS')));
      const inp = h('input', 'cv-field'); inp.type = 'url'; inp.dir = 'ltr'; inp.placeholder = 'https://'; inp.inputMode = 'url'; inp.setAttribute('aria-label', T('cnUrl'));
      const go = btn('bk-cta', T('cnFetch'));
      const out = h('div', 'cn-out');
      box.append(inp, go, out);
      setTimeout(() => { try { inp.focus(); } catch (e) {} }, 250);
      const run = async () => {
        const url = inp.value.trim(); if (!url) return;
        go.disabled = true; go.textContent = T('cnFetching'); out.textContent = '';
        try {
          const a = await fetchArticle(url);
          go.remove();
          const card = h('div', 'lib-ios pl-card'); const r = h('div', 'lib-row pl-row'); r.append(rowL(a.title, [a.site, T('beWords', { n: a.words.toLocaleString() })].filter(Boolean).join(' · '))); card.append(r);
          const add = btn('bk-cta', T('cnAddBook'), async () => {
            add.disabled = true; add.textContent = T('cvBuilding');
            try { const n = await E.buildBook({ title: a.title, author: a.byline || a.site, chapters: [chapterOf(a)] }); if (n) { close(); flash(T('cvDone', { n })); } else add.disabled = false; }
            catch (e) { add.disabled = false; add.textContent = T('cnAddBook'); flash(T('cvFailAll')); }
          });
          out.append(card, add);
        } catch (e) { go.disabled = false; go.textContent = T('cnFetch'); out.append(h('p', 'lib-empty', e.message === 'no_article' ? T('cnNoArt') : errOf(e))); }
      };
      go.addEventListener('click', run);
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); run(); } });
    });
  }

  /* ---------- C11: עיתון בוקר — הפידים שלך, ספר אחד עם המאמרים של היום ---------- */
  async function loadFeed(url) {
    let j = await E.api('webGet', { url });
    let doc = parse(j.text, j.type);
    if (!doc.getElementsByTagName('item').length && !doc.getElementsByTagName('entry').length) {
      const fl = /html/.test(j.type) ? feedLinkOf(doc, j.url) : '';
      if (!fl) throw new Error('no_feed');
      j = await E.api('webGet', { url: fl }); doc = parse(j.text, j.type);
    }
    const f = parseFeed(doc);
    if (!f.items.length) throw new Error('no_feed');
    return Object.assign(f, { url: j.url });
  }
  function openPaper() {
    const st = lsGet(LS_FEEDS, { feeds: [] });
    E.sheet(T('cnPaper'), (sh, close) => {
      const box = h('div', 'pl'); sh.append(box);
      box.append(h('p', 'pl-note', T('cnPaperS')));
      const card = h('div', 'lib-ios pl-card'); box.append(card);
      const inp = h('input', 'cv-field'); inp.type = 'url'; inp.dir = 'ltr'; inp.placeholder = T('cnFeedPh'); inp.setAttribute('aria-label', T('cnFeedPh'));
      const add = btn('bk-cta cv-ghost', T('cnFeedAdd'));
      const make = btn('bk-cta', T('cnMake'));
      const prog = h('p', 'pl-note cn-prog');
      box.append(inp, add, make, prog);
      const paint = () => {
        card.replaceChildren();
        if (!st.feeds.length) card.append(h('p', 'lib-empty', T('cnNoFeeds')));
        st.feeds.forEach((f, i) => {
          const r = h('div', 'lib-row pl-row'); r.append(rowL(f.title || f.url, f.title ? f.url.replace(/^https?:\/\//, '').slice(0, 60) : ''));
          const rm = btn('cv-mini', '×', () => { st.feeds.splice(i, 1); lsSet(LS_FEEDS, st); paint(); }); rm.setAttribute('aria-label', T('cvRemove'));
          r.append(rm); card.append(r);
        });
        make.disabled = !st.feeds.length;
      };
      add.addEventListener('click', async () => {
        const u = inp.value.trim(); if (!u) return;
        add.disabled = true; add.textContent = T('cnFetching');
        try {
          const f = await loadFeed(/^https?:\/\//i.test(u) ? u : 'https://' + u);
          if (!st.feeds.some((x) => x.url === f.url)) st.feeds.push({ url: f.url, title: f.title.slice(0, 80) });
          if (st.feeds.length > 12) st.feeds.length = 12;
          lsSet(LS_FEEDS, st); inp.value = ''; paint();
        } catch (e) { flash(e.message === 'no_feed' ? T('cnNoFeed') : errOf(e)); }
        add.disabled = false; add.textContent = T('cnFeedAdd');
      });
      make.addEventListener('click', async () => {
        make.disabled = true; add.disabled = true;
        try {
          const feeds = [];
          for (const [i, f] of st.feeds.entries()) {
            prog.textContent = T('cnReadFeeds', { i: i + 1, n: st.feeds.length });
            try { const x = await loadFeed(f.url); feeds.push(Object.assign(x, { title: f.title || x.title })); } catch (e) {}
          }
          const items = pickItems(feeds, Date.now(), 6, 24);
          if (!items.length) { prog.textContent = T('cnNothing'); make.disabled = false; add.disabled = false; return; }
          const chapters = []; let done = 0;
          const one = async (it) => {
            let a = null;
            const inFeed = it.html && it.html.replace(/<[^>]+>/g, '').length > 1500 ? extractArticle(parse('<html><body><article>' + it.html + '</article></body></html>', 'text/html'), it.link) : null;
            try { a = inFeed || await fetchArticle(it.link); } catch (e) { a = null; }
            done++; prog.textContent = T('cnReadArts', { i: done, n: items.length });
            if (a) chapters[items.indexOf(it)] = chapterOf(Object.assign(a, { title: it.title || a.title, site: it.feed || a.site }));
          };
          const q = items.slice();
          await Promise.all([0, 1, 2].map(async () => { while (q.length) await one(q.shift()); }));
          const ch = chapters.filter(Boolean);
          if (!ch.length) { prog.textContent = T('cnNothing'); make.disabled = false; add.disabled = false; return; }
          prog.textContent = T('cvBuilding');
          const d = new Date(), title = T('cnPaperTitle', { d: d.toLocaleDateString(E.uiLang() === 'en' ? 'en-GB' : 'he-IL', { day: 'numeric', month: 'long', year: 'numeric' }) });
          const n = await E.buildBook({ title, author: T('cnPaper'), chapters: ch, tocPage: true });
          st.last = paperDay(d); lsSet(LS_FEEDS, st);
          if (n) { close(); flash(T('cnPaperDone', { n: ch.length })); }
        } catch (e) { prog.textContent = T('cvFailAll'); }
        make.disabled = false; add.disabled = false;
      });
      paint();
    });
  }

  /* ---------- G4: שליחה למכשיר אחר (דרך תיבת הדואר) + שיתוף הקובץ ---------- */
  function openSend(b) {
    E.sheet(T('cnSend'), (sh, close) => {
      const box = h('div', 'pl'); sh.append(box);
      box.append(h('p', 'pl-note', T('cnSendS')));
      const go = btn('bk-cta', T('cnSendGo'));
      go.addEventListener('click', async () => {
        go.disabled = true; go.textContent = T('cnSending');
        try {
          const f = await E.getFile(b.id); if (!f) throw new Error('nofile');
          const id = await upload(f, 'epub', b.title || 'book');
          const sent = lsGet(LS_SENT, []); sent.push(id); lsSet(LS_SENT, sent.slice(-60));
          close(); flash(T('cnSent'));
        } catch (e) { go.disabled = false; go.textContent = T('cnSendGo'); flash(errOf(e)); }
      });
      box.append(go);
      if (typeof navigator !== 'undefined' && navigator.canShare) {
        const sb = btn('bk-cta cv-ghost', T('cnShare'), async () => {
          try {
            const f = await E.getFile(b.id); const file = new File([f], E.fileName(b), { type: 'application/epub+zip' });
            if (navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: b.title || '' }); else E.saveBlob(file, file.name);
          } catch (e) { if (!(e && e.name === 'AbortError')) flash(T('cnNetErr')); }
        });
        box.append(sb);
      }
    });
  }
  async function upload(blob, ext, name) {
    const j = await E.api('inbox', { act: 'put', ext, size: blob.size, name, from: 'academy' });
    const r = await fetch(j.url, { method: 'PUT', body: blob, headers: { 'Content-Type': j.type } });
    if (!r.ok) throw new Error('upload');
    return j.id;
  }
  /* תיבת הדואר: מה שנשלח מ־Studio או ממכשיר אחר — נכנס לספרייה ונמחק מהתיבה */
  async function pullInbox(items) {
    const sent = new Set(lsGet(LS_SENT, []));
    let n = 0;
    for (const it of items || []) {
      if (sent.has(it.id)) continue;
      try {
        const g = await E.api('inbox', { act: 'get', id: it.id });
        const r = await fetch(g.url); if (!r.ok) continue;
        const blob = await r.blob();
        const base = (it.name || 'book').replace(/[\\/:*?"<>|]/g, ' ').trim().slice(0, 80) || 'book';
        const got = it.ext === 'md' ? await E.mdBook(await blob.text(), base) : await E.importFiles([new File([blob], base + '.epub', { type: 'application/epub+zip' })]);
        if (got) { n += got; await E.api('inbox', { act: 'del', id: it.id }).catch(() => {}); flash(it.from === 'studio' ? T('cnGotStudio', { t: base }) : T('cnGot', { t: base })); }
      } catch (e) {}
    }
    if (n) E.afterImport(n);
    return n;
  }

  /* ---------- G2: ייבוא הדגשות ---------- */
  function openClips() {
    E.sheet(T('cnClips'), (sh, close) => {
      const box = h('div', 'pl'); sh.append(box);
      box.append(h('p', 'pl-note', T('cnClipsS')));
      const lab = h('label', 'bk-cta cn-file'); lab.append(document.createTextNode(T('cnClipsPick')));
      const inp = h('input'); inp.type = 'file'; inp.accept = '.txt,text/plain'; inp.hidden = true; lab.append(inp);
      const out = h('div', 'cn-out');
      box.append(lab, out);
      inp.addEventListener('change', async () => {
        const f = inp.files && inp.files[0]; if (!f) return;
        const groups = groupClips(parseClippings(await f.text()));
        const books = await E.allBooks();
        out.replaceChildren();
        if (!groups.length) { out.append(h('p', 'lib-empty', T('cnClipsNone'))); return; }
        const card = h('div', 'lib-ios pl-card'); out.append(card);
        const plan = groups.map((g) => ({ g, b: matchBook(g.title, g.author, books) }));
        let total = 0;
        for (const p of plan) {
          const r = h('div', 'lib-row pl-row' + (p.b ? '' : ' cn-miss'));
          r.append(rowL(p.g.title, p.b ? T('cnClipsTo', { n: p.g.hl.length, t: p.b.title }) : T('cnClipsMiss', { n: p.g.hl.length })));
          card.append(r); if (p.b) total += p.g.hl.length;
        }
        lab.remove();
        const go = btn('bk-cta', T('cnClipsGo', { n: total }), async () => {
          go.disabled = true;
          let n = 0;
          for (const p of plan) if (p.b) n += await E.queueAnns(p.b.id, (rec) => clipQueue(p.g, rec.ann, rec.annQ));
          close(); flash(T('cnClipsDone', { n }));
        });
        go.disabled = !total;
        out.append(go);
      });
    });
  }
  async function resolveAnn(view, rec) {   // הדגשות שיובאו — מוצאות את מקומן בספר בפתיחה (עד 25 בכל פעם, 3 ניסיונות לכל אחת)
    const q = Array.isArray(rec.annQ) ? rec.annQ : [];
    const todo = q.filter((a) => (a.t || 0) < 3).slice(0, 25);
    if (!todo.length) return 0;
    const total = (view.book && view.book.sections && view.book.sections.length) || 1;
    let found = 0;
    for (const a of todo) {
      if (!E.stillOpen(rec)) break;
      const query = searchQuery(a.x); let cfi = '';
      if (query.length >= 4) {
        try { for await (const r of view.search({ query })) { const c = r && (r.cfi || (r.subitems && r.subitems[0] && r.subitems[0].cfi)); if (c) { cfi = c; break; } } } catch (e) {}
        try { view.clearSearch(); } catch (e) {}
      }
      if (cfi) {
        let f = 0; try { const rs = await view.resolveCFI(cfi); f = rs && typeof rs.index === 'number' ? rs.index / total : 0; } catch (e) {}
        E.addHl(rec, { c: cfi, x: a.x, n: a.n || '', k: 'y', f, ch: '' });
        q.splice(q.indexOf(a), 1); found++;
      } else a.t = (a.t || 0) + 1;
    }
    rec.annQ = q;
    if (!q.length) delete rec.annQ;
    await E.putRec(rec);
    if (found) flash(T('cnClipsPlaced', { n: found }));
    return found;
  }

  /* ---------- G6: גיבוי מלא לקובץ, ושחזור ---------- */
  function openFull() {
    E.sheet(T('cnFull'), (sh, close) => {
      const box = h('div', 'pl'); sh.append(box);
      box.append(h('p', 'pl-note', T('cnFullS')));
      const prog = h('p', 'pl-note cn-prog');
      const mk = btn('bk-cta', T('cnFullMake'), async () => {
        mk.disabled = true;
        try { const r = await makeBackup((i, n) => { prog.textContent = T('cnFullProg', { i, n }); }); prog.textContent = T('cnFullDone', { n: r.n, s: r.size }); }
        catch (e) { prog.textContent = T('cvFailAll'); }
        mk.disabled = false;
      });
      const lab = h('label', 'bk-cta cv-ghost cn-file'); lab.append(document.createTextNode(T('cnFullRestore')));
      const inp = h('input'); inp.type = 'file'; inp.accept = '.zip,application/zip'; inp.hidden = true; lab.append(inp);
      inp.addEventListener('change', async () => {
        const f = inp.files && inp.files[0]; if (!f) return;
        prog.textContent = T('cnFullReading');
        try { const r = await restoreBackup(f, (i, n) => { prog.textContent = T('cnFullProg', { i, n }); }); close(); flash(T('cnFullRestored', { a: r.added, m: r.merged })); E.afterImport(0); }
        catch (e) { prog.textContent = e && e.message === 'not_backup' ? T('cnFullBad') : T('cvFailAll'); }
      });
      box.append(mk, lab, prog);
    });
  }
  async function makeBackup(onProg) {
    const EK = await E.kit();
    const books = await E.allBooksRaw(), entries = [], recs = [];
    let i = 0;
    for (const b of books) {
      onProg(++i, books.length);
      const r = {}, blobs = {};
      for (const [k, v] of Object.entries(b)) {
        if (typeof Blob !== 'undefined' && v instanceof Blob) {
          const name = 'blobs/' + b.id + '/' + k;
          const u8 = new Uint8Array(await v.arrayBuffer());
          entries.push({ name, data: { blob: v, crc: EK.crc32(u8), size: v.size } }); blobs[k] = { name, type: v.type };
        } else r[k] = v;
      }
      if (E.isMine(b)) {
        const f = await E.getFile(b.id);
        if (f) { const name = 'books/' + b.id; const u8 = new Uint8Array(await f.arrayBuffer()); entries.push({ name, data: { blob: f, crc: EK.crc32(u8), size: f.size } }); r._file = { name, type: f.type || 'application/epub+zip', fname: f.name || '' }; }
      }
      if (Object.keys(blobs).length) r._blobs = blobs;
      recs.push(r);
    }
    const ls = {}; for (const k of BACKUP_LS) { try { const v = localStorage.getItem(k); if (v != null) ls[k] = v; } catch (e) {} }
    const man = { v: 1, app: 'academy', at: Date.now(), books: recs, ls };
    entries.unshift({ name: 'academy-backup.json', data: new TextEncoder().encode(JSON.stringify(man)) });
    const blob = new Blob(zipParts(entries, EK.crc32, new Date()), { type: 'application/zip' });
    E.saveBlob(blob, 'academy-backup-' + paperDay(new Date()) + '.zip');
    return { n: recs.length, size: blob.size < 1048576 ? Math.max(1, Math.round(blob.size / 1024)) + 'KB' : (blob.size / 1048576).toFixed(1) + 'MB' };
  }
  async function restoreBackup(file, onProg) {
    const EK = await E.kit();
    const zip = await EK.readZip(file);
    const byName = new Map(zip.entries.map((e) => [e.name, e]));
    const me = byName.get('academy-backup.json'); if (!me) throw new Error('not_backup');
    const man = JSON.parse(new TextDecoder().decode(await EK.readEntry(file, me)));
    if (!man || man.app !== 'academy' || !Array.isArray(man.books)) throw new Error('not_backup');
    const cur = new Map((await E.allBooksRaw()).map((b) => [b.id, b]));
    let added = 0, merged = 0, i = 0;
    let skipped = 0;
    for (const r of man.books) {
      onProg(++i, man.books.length);
      if (!r || typeof r.id !== 'string') continue;
      const have = cur.get(r.id);
      if (have) { await E.putRec(mergeRec(have, r)); merged++; continue; }
      if (!r._file || !byName.get(r._file.name)) { skipped++; continue; }   // ספר מהמדף המשותף — חוזר מהמדף; הסימונים שלו בענן
      const rec = Object.assign({}, r); delete rec._blobs; delete rec._file;
      for (const [k, x] of Object.entries(r._blobs || {})) { const e = byName.get(x.name); if (e) rec[k] = new Blob([await EK.readEntry(file, e, { max: 64 << 20 })], { type: x.type || '' }); }
      const fe = byName.get(r._file.name);
      const f = new File([await EK.readEntry(file, fe, { max: 512 << 20 })], r._file.fname || (r.id + '.epub'), { type: r._file.type || 'application/epub+zip' });
      if (await E.restoreBook(f, rec)) added++;
    }
    for (const [k, v] of Object.entries(man.ls || {})) { try { if (BACKUP_LS.includes(k) && localStorage.getItem(k) == null) localStorage.setItem(k, v); } catch (e) {} }
    return { added, merged, skipped };
  }

  return { openArticle, fetchArticle, openPaper, openSend, pullInbox, openClips, resolveAnn, openFull, makeBackup, restoreBackup };
}
