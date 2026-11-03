// Academy Pro, גל 4 (03/11/2026): ניהול וקורא — נטען רק כשנכנסים (כמו libconvert.js).
// D4 דפדפן תגיות · D9 ספרים דומים · D12 דף מחבר וסדרה · E3 חיפוש מתקדם בספר · E5 ייצוא הדגשות
// E9 תמונות וטבלאות במסך מלא · E12 סטטיסטיקות קריאה · E14 הדפסה של פרק או בחירה.
// שפת החיפוש (D2), המיון העברי (D7), הכתיב המלא/חסר (H5) ורישום זמן הקריאה — ב־library.js (רצים בכל הקשה / בכל דפדוף).
// הכל בטלפון, בלי שרת ובלי עלות. ויקיפדיה — רק בדף המחבר, ורק כשנפתח.
let EKP = null;
const kit = () => (EKP || (EKP = import('./epubkit.js')));

/* ---------- טהורות (נבדקות) ---------- */
const fold = (s) => String(s || '').replace(/[\u0591-\u05C7]/g, '').replace(/[םןץףך]/g, (c) => ({ 'ם': 'מ', 'ן': 'נ', 'ץ': 'צ', 'ף': 'פ', 'ך': 'כ' }[c])).toLowerCase().trim();
export const tagsOf = (b) => String((b && b.tags) || '').split(/\s*[,;،]\s*/).map((x) => x.trim()).filter(Boolean);
export const authorsOf = (b) => String((b && b.author) || '').split(/\s*[,;&]\s*/).map((x) => x.trim()).filter(Boolean);

/* D4: עץ השדות — מחברים, סדרות, תגיות, הוצאות, שפות, עשורים, מצב קריאה; לכל ערך מספר הספרים */
export function facets(books, liveHl) {
  const F = { author: new Map(), series: new Map(), tag: new Map(), pub: new Map(), lang: new Map(), year: new Map(), read: new Map(), hl: new Map() };
  const inc = (m, k) => { if (k) m.set(k, (m.get(k) || 0) + 1); };
  for (const b of books) {
    authorsOf(b).forEach((a) => inc(F.author, a));
    inc(F.series, String(b.series || '').trim());
    tagsOf(b).forEach((t) => inc(F.tag, t));
    inc(F.pub, String(b.pub || '').trim());
    inc(F.lang, String(b.lang || '').trim().slice(0, 2).toLowerCase());
    if (b.year) inc(F.year, Math.floor(b.year / 10) * 10);
    inc(F.read, b.done ? 'yes' : b.fraction > 0 ? 'part' : 'no');
    if ((liveHl ? liveHl(b) : []).length) inc(F.hl, 'yes');
  }
  const out = {};
  for (const k of Object.keys(F)) out[k] = [...F[k].entries()].sort((a, b) => k === 'year' ? b[0] - a[0] : b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), 'he'));
  return out;
}

/* D9: ספרים דומים — מחבר, סדרה, תגיות והוצאה, ודמיון בתוכן (מילים מובחנות מאינדקס החיפוש) */
const STOP = new Set('של את על עם זה זו גם כל לא אם כי הוא היא הם הן אני אתה אנחנו היה היו יש אין או אבל רק עוד כמו מה מי לו לה להם בין אחר אחרי לפני כאשר כך אשר שלא the and that with this from have were which their there would about into been more than when what they them will your also some only other then such these most over'.split(' '));
export function keywords(text, n = 60) {
  const freq = new Map();
  for (const w of String(text || '').slice(0, 80000).match(/[\p{L}][\p{L}\p{M}'׳״-]{3,}/gu) || []) {
    const f = fold(w).replace(/^[הובלמשכ](?=[\u05D0-\u05EA]{4})/, '');   // תחילית אחת בעברית ("והספר" → "ספר" בקירוב)
    if (f.length < 4 || STOP.has(f)) continue;
    freq.set(f, (freq.get(f) || 0) + 1);
  }
  return new Set([...freq.entries()].filter((x) => x[1] >= 2).sort((a, b) => b[1] - a[1]).slice(0, n).map((x) => x[0]));
}
export function similarBooks(b, all, kw, max = 8) {   // kw: Map(id → Set) או null; מחזיר [{ b, sc, why }]
  const A = new Set(authorsOf(b).map(fold)), Tg = new Set(tagsOf(b).map(fold)), S = fold(b.series), P = fold(b.pub), K = kw && kw.get(b.id);
  const out = [];
  for (const x of all) {
    if (!x || x.id === b.id) continue;
    let sc = 0, why = '';
    if (S && fold(x.series) === S) { sc += 5; why = 'series'; }
    if (authorsOf(x).some((a) => A.has(fold(a)))) { sc += 4; why = why || 'author'; }
    const shared = tagsOf(x).filter((t) => Tg.has(fold(t))).length;
    if (shared) { sc += 1.5 * shared; why = why || 'tags'; }
    if (P && fold(x.pub) === P) sc += 0.5;
    const K2 = K && kw.get(x.id);
    if (K && K2 && K.size && K2.size) {
      let inter = 0; K.forEach((w) => { if (K2.has(w)) inter++; });
      const j = inter / (K.size + K2.size - inter);
      if (j > 0.08) { sc += Math.min(6, j * 20); why = why || 'text'; }
    }
    if (sc >= 1.5) out.push({ b: x, sc, why });
  }
  return out.sort((p, q) => q.sc - p.sc).slice(0, max);
}

/* E12: סיכום הסטטיסטיקות (st מ־library.js: d דקות ליום, h 168 תאים, f מתי נגמר כל ספר) */
const dk = (t) => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
export function statsSummary(st, now, books) {
  st = st || {}; const D = st.d || {}, H = Array.isArray(st.h) && st.h.length === 168 ? st.h : new Array(168).fill(0);
  const day = (i) => dk(now - i * 864e5);
  const last30 = []; for (let i = 29; i >= 0; i--) last30.push({ day: day(i), min: D[day(i)] || 0 });
  let streak = 0; for (let i = (D[day(0)] >= 1 ? 0 : 1); i < 400 && (D[day(i)] || 0) >= 1; i++) streak++;
  let best = 0, run = 0; const keys = Object.keys(D).sort();
  for (let i = 0; i < keys.length; i++) {
    const ok = (D[keys[i]] || 0) >= 1, prev = i && Math.round((new Date(keys[i]) - new Date(keys[i - 1])) / 864e5) === 1;
    run = ok ? (prev && run ? run + 1 : 1) : 0; best = Math.max(best, run);
  }
  const week = last30.slice(-7).reduce((a, x) => a + x.min, 0), month = last30.reduce((a, x) => a + x.min, 0);
  const days30 = last30.filter((x) => x.min >= 1).length;
  const perYear = {};
  const fin = Object.assign({}, st.f || {});
  (books || []).forEach((b) => { if (b.done && !fin[b.id] && b.lastRead) fin[b.id] = b.lastRead; });
  Object.values(fin).forEach((t) => { const y = new Date(t).getFullYear(); if (y > 1990) perYear[y] = (perYear[y] || 0) + 1; });
  let peak = 0; for (let i = 1; i < 168; i++) if (H[i] > H[peak]) peak = i;
  return { today: D[day(0)] || 0, week, month, avg: days30 ? month / days30 : 0, streak, best: Math.max(best, streak), last30, perYear,
    heat: H, peak: H[peak] > 0 ? { dow: Math.floor(peak / 24), hour: peak % 24 } : null, total: Object.values(D).reduce((a, x) => a + x, 0) };
}

/* E5: ייצוא הדגשות — items = [{ b: {id,title,author,tags}, list: [ann] }] */
const mdEsc = (s) => String(s || '').replace(/\r/g, '').trim();
export function hlToMd(items, title) {
  const out = ['# ' + (title || 'Highlights'), ''];
  for (const { b, list } of items) {
    out.push('## ' + mdEsc(b.title) + (b.author ? ' — ' + mdEsc(b.author) : ''), '');
    for (const a of list) {
      out.push(mdEsc(a.x).split('\n').map((l) => '> ' + l).join('\n'));
      if (String(a.n || '').trim()) out.push('', mdEsc(a.n));
      const meta = [a.ch, Math.round((a.f || 0) * 100) + '%'].filter(Boolean).join(' · ');
      if (meta) out.push('', '— ' + meta);
      out.push('');
    }
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n') + '\n';
}
export function hlToObsidian(items, now) {   // קובץ לכל ספר, עם frontmatter ו־callout — נכנס ככה לכספת
  const ymd = dk(now || Date.now());
  return items.map(({ b, list }) => {
    const q = (s) => '"' + String(s || '').replace(/["\\]/g, '') + '"';
    const fm = ['---', 'title: ' + q(b.title), b.author ? 'author: ' + q(b.author) : '', tagsOf(b).length ? 'tags: [' + tagsOf(b).map((t) => q(t.replace(/\s+/g, '-'))).join(', ') + ']' : '', 'exported: ' + ymd, '---', ''].filter((x) => x !== '');
    const body = list.map((a) => {
      const kind = String(a.n || '').trim() ? 'note' : 'quote';
      const meta = [a.ch, Math.round((a.f || 0) * 100) + '%'].filter(Boolean).join(' · ');
      return '> [!' + kind + '] ' + (meta || '') + '\n' + mdEsc(a.x).split('\n').map((l) => '> ' + l).join('\n') + (String(a.n || '').trim() ? '\n>\n> ' + mdEsc(a.n).split('\n').join('\n> ') : '');
    });
    const name = String(b.title || 'book').replace(/[\\/:*?"<>|#^[\]]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'book';
    return { name: name + '.md', text: fm.join('\n') + '\n\n# ' + mdEsc(b.title) + '\n\n' + body.join('\n\n') + '\n' };
  });
}
export function hlToCsv(items) {   // UTF-8 עם BOM — עברית נפתחת נכון בגיליון אלקטרוני
  const cell = (v) => { const s = String(v == null ? '' : v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const rows = [['book', 'author', 'chapter', 'percent', 'color', 'text', 'note', 'date']];
  for (const { b, list } of items) for (const a of list) rows.push([b.title, b.author || '', a.ch || '', Math.round((a.f || 0) * 100), a.k || '', a.x || '', a.n || '', a.u ? new Date(a.u).toISOString().slice(0, 10) : '']);
  return '\uFEFF' + rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

/* E3: חיפוש מתקדם בספר — על הטקסט של הפרק. opts: { re, word, marks (רגיש לניקוד), plene } → [{ pos, len, hit }] */
const HEB = '\\u05D0-\\u05EA';
export function bookFind(text, q, opts = {}, max = 200) {
  text = String(text || ''); q = String(q || '');
  if (!q.trim()) return [];
  const strip = !opts.marks, out = [];
  // מפה מטקסט מנורמל למקור: בלי ניקוד (אם לא רגיש), ובכתיב מלא/חסר גם בלי ו/י באמצע מילה
  let f = '', map = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (strip && c >= '\u0591' && c <= '\u05C7' && c !== '\u05BE') continue;
    if (opts.plene && (c === 'ו' || c === 'י') && f && new RegExp('[' + HEB + ']').test(f[f.length - 1])) continue;
    f += c; map.push(i);
  }
  map.push(text.length);
  let nq = strip ? q.replace(/[\u0591-\u05BD\u05BF-\u05C7]/g, '') : q;
  if (opts.plene) nq = nq.replace(new RegExp('(?<=[' + HEB + '])[וי]+', 'g'), '');
  let re;
  try {
    const src = opts.re ? nq : nq.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    re = new RegExp(opts.word ? '(?<![\\p{L}\\p{N}])(?:' + src + ')(?![\\p{L}\\p{N}])' : src, 'giu');
  } catch (e) { return null; }   // ביטוי לא תקין
  let m;
  while ((m = re.exec(f)) && out.length < max) {
    if (!m[0]) { re.lastIndex++; continue; }
    const a = map[m.index], b = map[m.index + m[0].length - 1] + 1;
    out.push({ pos: a, len: b - a, hit: text.slice(a, b) });
  }
  return out;
}

/* ---------- הממשק ---------- */
const WHY = { series: 'pxWhy_series', author: 'pxWhy_author', tags: 'pxWhy_tags', text: 'pxWhy_text' };
const DOW = ['pxDow0', 'pxDow1', 'pxDow2', 'pxDow3', 'pxDow4', 'pxDow5', 'pxDow6'];
const DOWL = ['pxDowL0', 'pxDowL1', 'pxDowL2', 'pxDowL3', 'pxDowL4', 'pxDowL5', 'pxDowL6'];
export function createPro(E) {
  const { h, T } = E;
  const flash = (m) => E.flash && E.flash(m);
  const btn = (cls, txt, fn) => { const b = h('button', cls, txt); b.type = 'button'; if (fn) b.addEventListener('click', fn); return b; };
  const rowL = (t, s) => { const l = h('span', 'pl-rl'); l.append(h('span', 'pl-rt', t)); if (s) l.append(h('span', 'pl-rs', s)); return l; };
  const chevEl = () => { const c = h('span', 'pl-chev'); c.setAttribute('aria-hidden', 'true'); c.innerHTML = E.chev || ''; return c; };
  const group = (title, rows) => { const g = h('div', 'pl-g'); if (title) g.append(h('div', 'pl-gh', title)); const c = h('div', 'lib-ios pl-card'); rows.forEach((x) => x && c.append(x)); g.append(c); return g; };
  const navRow = (t, s, fn, end) => { const r = btn('lib-row pl-row', null, fn); r.append(rowL(t, s)); if (end != null) r.append(h('span', 'px-n', String(end))); r.append(chevEl()); return r; };
  const LANG_NAME = { he: 'עברית', en: 'English', fr: 'Français', de: 'Deutsch', es: 'Español', ru: 'Русский', ar: 'العربية', it: 'Italiano', yi: 'ייִדיש' };
  const quote = (v) => E.quoteVal(v);

  /* ---- D4: דפדפן תגיות ---- */
  async function openBrowser() {
    const books = await E.shelfBooks();
    const F = facets(books, E.liveHl);
    E.sheet(T('pxBrowse'), (sh, close) => {
      const box = h('div', 'pl px-br'); sh.append(box);
      const go = (q) => E.closeSheetThen(sh.parentNode, () => E.setQuery(q));
      const saved = E.qSaved();
      if (saved.length) {
        box.append(group(T('pxSaved'), saved.map((q) => {
          const r = btn('lib-row pl-row', null, () => go(q)); r.append(rowL(q));
          const x = btn('cv-mini', '×', (e) => { e.stopPropagation(); E.qSavedSet(E.qSaved().filter((y) => y !== q)); r.remove(); });
          x.setAttribute('aria-label', T('pxUnsave')); r.append(x); return r;
        })));
      }
      const sec = (key, title, label, qOf) => {
        const list = F[key]; if (!list || !list.length) return;
        const LIM = 6; let open = false;
        const g = group(title, []); const card = g.querySelector('.pl-card');
        const paint = () => {
          card.textContent = '';
          (open ? list : list.slice(0, LIM)).forEach(([v, n]) => card.append(navRow(label(v), '', () => go(qOf(v)), n)));
          if (list.length > LIM) card.append(btn('lib-row pl-row px-more', T(open ? 'pxLess' : 'pxMore', { n: list.length - LIM }), () => { open = !open; paint(); }));
        };
        paint(); box.append(g);
      };
      sec('author', T('pxAuthors'), (v) => v, (v) => 'מחבר:' + quote(v));
      sec('series', T('pxSeries'), (v) => v, (v) => 'סדרה:' + quote(v));
      sec('tag', T('pxTags'), (v) => v, (v) => 'תגית:' + quote(v));
      sec('pub', T('pxPubs'), (v) => v, (v) => 'הוצאה:' + quote(v));
      sec('lang', T('pxLangs'), (v) => LANG_NAME[v] || v, (v) => 'שפה:' + v);
      sec('year', T('pxYears'), (v) => v + '–' + (v + 9), (v) => 'שנה:' + v + '..' + (v + 9));
      sec('read', T('pxReadSt'), (v) => T(v === 'yes' ? 'pxReadYes' : v === 'part' ? 'pxReadPart' : 'pxReadNo'), (v) => 'נקרא:' + (v === 'yes' ? 'כן' : v === 'part' ? 'חלקית' : 'לא'));
      sec('hl', T('pxHlSt'), () => T('pxWithHl'), () => 'הדגשות:כן');
      box.append(h('p', 'cv-note px-syntax', T('pxSyntax')));
    });
  }

  /* ---- D9: ספרים דומים (מילות המפתח מאינדקס החיפוש — נבנות פעם אחת לפתיחה) ---- */
  let KW = null;
  async function kwMap() {
    if (KW) return KW;
    KW = new Map();
    try {   // 80 אלף התווים הראשונים של כל ספר; הפסקה קטנה כל כמה ספרים — לא חוסם את הממשק
      let n = 0;
      for (const [id, secs] of await E.ftTexts()) { let t = ''; for (const x of secs) { t += x.t + '\n'; if (t.length > 80000) break; } KW.set(id, keywords(t)); if (++n % 8 === 0) await new Promise((r) => setTimeout(r, 0)); }
    } catch (e) {}
    return KW;
  }
  async function similarOf(b) { const all = await E.shelfBooks(b); return similarBooks(b, all, await kwMap()); }
  function coverRow(list, onPick) {
    const row = h('div', 'px-covers no-swipe');
    list.forEach(({ b, why }) => {
      const c = btn('px-cv', null, () => onPick(b)); c.append(E.cover(b, true), h('span', 'px-cvt', b.title));
      if (why) c.append(h('span', 'px-cvw', T(WHY[why])));
      row.append(c);
    });
    return row;
  }
  async function similarInto(host, b) {
    const list = await similarOf(b);
    if (!list.length || !host.isConnected) return;
    host.append(h('div', 'pl-gh', T('pxSimilar')), coverRow(list, (x) => quickLook(x)));
  }

  /* ספר מתוך גיליון (דומים / מחבר / סדרה) — לדף הספר (סוגרים קודם את הגיליון) */
  const quickLook = (b) => E.openBook(b.id);

  /* ---- D12: דף מחבר / סדרה ---- */
  const LS_AUTH = 'pwa_libauth_v1';
  const noteGet = (k) => { try { return (JSON.parse(localStorage.getItem(LS_AUTH) || '{}') || {})[k] || ''; } catch (e) { return ''; } };
  const noteSet = (k, v) => { try { const o = JSON.parse(localStorage.getItem(LS_AUTH) || '{}') || {}; if (v) o[k] = v.slice(0, 4000); else delete o[k]; localStorage.setItem(LS_AUTH, JSON.stringify(o)); } catch (e) {} };
  function bookList(list) {
    const c = h('div', 'lib-ios pl-card');
    list.forEach((x) => {
      const r = btn('lib-row pl-row px-brow', null, () => quickLook(x));
      r.append(E.cover(x, true), rowL(x.title, [x.seriesIdx && x.series ? '#' + x.seriesIdx : '', x.year, x.done ? T('libRead') : x.fraction > 0 ? Math.round(x.fraction * 100) + '%' : ''].filter(Boolean).join(' · ')), chevEl());
      c.append(r);
    });
    return c;
  }
  function noteBox(key) {
    const ta = h('textarea', 'cv-field cv-ta px-note'); ta.dir = 'auto'; ta.placeholder = T('pxNotePh'); ta.value = noteGet(key); ta.setAttribute('aria-label', T('pxMyNote'));
    let t = 0; ta.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => noteSet(key, ta.value.trim()), 400); });
    const g = h('div', 'pl-g'); g.append(h('div', 'pl-gh', T('pxMyNote')), ta); return g;
  }
  async function authorPage(name) {
    const all = await E.shelfBooks();
    const list = all.filter((b) => authorsOf(b).some((a) => fold(a) === fold(name)));
    E.sheet(name, (sh) => {
      const box = h('div', 'pl px-auth'); sh.append(box);
      const wiki = h('div', 'px-wiki'); box.append(wiki);
      const lang = /[\u05D0-\u05EA]/.test(name) ? 'he' : 'en';
      wiki.append(h('p', 'cv-note', T('pxWikiLoad')));
      Promise.resolve(E.wikiSummary(lang, name)).then((w) => {
        wiki.textContent = '';
        if (!w || !w.extract) { wiki.append(h('p', 'cv-note', T('pxWikiNone'))); return; }
        if (w.desc) wiki.append(h('p', 'px-qls', w.desc));
        const p = h('p', 'px-desc open'); p.dir = 'auto'; p.textContent = w.extract; wiki.append(p);
        wiki.append(h('p', 'cv-note', T('pxWikiSrc')));
      }).catch(() => { wiki.textContent = ''; wiki.append(h('p', 'cv-note', T('pxWikiNone'))); });
      box.append(noteBox('a:' + fold(name)));
      const g = h('div', 'pl-g'); g.append(h('div', 'pl-gh', T('pxBooksN', { n: list.length })), bookList(E.sort(list, 'series'))); box.append(g);
    });
  }
  async function seriesPage(name) {
    const all = await E.shelfBooks();
    const list = E.sort(all.filter((b) => fold(b.series) === fold(name)), 'series');
    E.sheet(name, (sh) => {
      const box = h('div', 'pl'); sh.append(box);
      const read = list.filter((b) => b.done).length;
      box.append(h('p', 'cv-note', T('pxSeriesOf', { n: read, t: list.length })));
      box.append(noteBox('s:' + fold(name)));
      const g = h('div', 'pl-g'); g.append(h('div', 'pl-gh', T('pxBooksN', { n: list.length })), bookList(list)); box.append(g);
    });
  }

  /* ---- E12: סטטיסטיקות קריאה ---- */
  const fmtMin = (m) => m >= 60 ? Math.floor(m / 60) + ':' + String(Math.round(m % 60)).padStart(2, '0') : String(Math.round(m));
  async function openStats() {
    const S = statsSummary(E.statsGet(), Date.now(), await E.shelfBooks(null, true));
    E.sheet(T('pxStats'), (sh) => {
      const box = h('div', 'pl px-stats'); sh.append(box);
      if (!S.total) { box.append(h('p', 'cv-note', T('pxStatsEmpty'))); return; }
      const strip = h('div', 'pl-stats');
      const cell = (v, k) => { const c = h('div', 'pl-stat'); c.append(h('b', null, v), h('span', null, T(k))); strip.append(c); };
      cell(fmtMin(S.today), 'pxToday'); cell(String(S.streak), 'pxStreak'); cell(fmtMin(S.avg), 'pxAvg');
      box.append(strip);
      box.append(h('p', 'cv-note', T('pxStatsLine', { w: fmtMin(S.week), m: fmtMin(S.month), b: S.best })));
      // דקות ביום — 30 הימים האחרונים
      const max = Math.max(10, ...S.last30.map((x) => x.min));
      const bars = h('div', 'px-bars'); bars.setAttribute('role', 'img'); bars.setAttribute('aria-label', T('pxLast30'));
      S.last30.forEach((x) => { const i = h('i'); i.style.blockSize = Math.max(x.min ? 4 : 1, Math.round(x.min / max * 100)) + '%'; i.title = x.day + ' · ' + fmtMin(x.min); bars.append(i); });
      const g1 = h('div', 'pl-g'); g1.append(h('div', 'pl-gh', T('pxLast30')), bars); box.append(g1);
      // מפת חום: יום בשבוע × שעה
      const hmax = Math.max(1, ...S.heat);
      const heat = h('div', 'px-heat'); heat.setAttribute('role', 'img'); heat.setAttribute('aria-label', T('pxHeat'));
      for (let d = 0; d < 7; d++) {
        heat.append(h('span', 'px-hd', T(DOW[d])));
        for (let hr = 0; hr < 24; hr++) { const v = S.heat[d * 24 + hr]; const c = h('i'); c.style.setProperty('--a', v ? (0.18 + 0.82 * v / hmax).toFixed(2) : '0'); heat.append(c); }
      }
      const g2 = h('div', 'pl-g'); g2.append(h('div', 'pl-gh', T('pxHeat')), heat);
      if (S.peak) g2.append(h('p', 'cv-note', T('pxPeak', { d: T(DOWL[S.peak.dow]), h: String(S.peak.hour).padStart(2, '0') + ':00' })));
      box.append(g2);
      const years = Object.keys(S.perYear).sort().reverse();
      if (years.length) box.append(group(T('pxPerYear'), years.map((y) => { const r = h('div', 'lib-row pl-row'); r.append(rowL(y), h('span', 'px-n', T('pxBooksN', { n: S.perYear[y] }))); return r; })));
    });
  }

  /* ---- E5: ייצוא הדגשות (כל הספרייה או הסינון הנוכחי) ---- */
  function openHlExport(items, title) {
    const n = items.reduce((a, x) => a + x.list.length, 0);
    E.sheet(T('pxHlExp'), (sh, close) => {
      const box = h('div', 'pl'); sh.append(box);
      box.append(h('p', 'cv-sub', T('pxHlExpSub', { n, b: items.length })));
      const ymd = new Date().toISOString().slice(0, 10), base = T('learnTitle') + ' ' + ymd;
      const run = (fn) => async () => { try { await fn(); close(); } catch (e) { flash(T('cvExpFail')); } };
      const K = () => E.convertKit();
      const save = async (blob, name) => (await K()).saveBlob(blob, name);
      const row = (ic, t, s, fn) => { const r = btn('lib-row pl-row cv-pick', null, run(fn)); r.append(h('span', 'cv-ic', ic), rowL(t, s), chevEl()); return r; };
      box.append(group('', [
        row('MD', 'Markdown', T('pxMdS'), () => save(new Blob([hlToMd(items, T('learnTitle'))], { type: 'text/markdown' }), base + '.md')),
        row('OBS', 'Obsidian', T('pxObsS'), async () => {
          const EK = await kit(), files = hlToObsidian(items, Date.now()), seen = new Set();
          const zf = files.map((f) => { let nm = f.name; for (let i = 2; seen.has(nm); i++) nm = f.name.replace(/\.md$/, ' ' + i + '.md'); seen.add(nm); return { name: nm, data: new TextEncoder().encode(f.text) }; });
          await save(await EK.zipFiles(zf, { epub: false }), base + ' (Obsidian).zip');
        }),
        row('CSV', T('pxSheet'), T('pxSheetS'), () => save(new Blob([hlToCsv(items)], { type: 'text/csv' }), base + '.csv')),
        row('DOC', 'Word', T('pxWordS'), async () => {
          const EK = await kit();
          const chapters = items.map(({ b, list }) => ({ blocks: [{ k: 'h', l: 1, r: [{ t: b.title + (b.author ? ' — ' + b.author : '') }] }].concat(...list.map((a) => [
            { k: 'p', q: 1, r: [{ t: String(a.x || '').trim() }] },
            String(a.n || '').trim() ? { k: 'p', r: [{ t: '✎ ' + String(a.n).trim() }] } : null,
            { k: 'p', r: [{ t: [a.ch, Math.round((a.f || 0) * 100) + '%'].filter(Boolean).join(' · '), i: 1 }] }].filter(Boolean))) }));
          const parts = EK.docxParts(chapters, { title: T('learnTitle'), lang: 'he', images: new Map(), now: Date.now() });
          await save(await EK.zipFiles(parts, { epub: false }), base + '.docx');
        }),
        row('PDF', 'PDF', T('cvPdfS'), async () => {
          const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
          const body = '<h1>' + esc(T('learnTitle')) + '</h1>' + items.map(({ b, list }) => '<h2>' + esc(b.title) + (b.author ? ' — ' + esc(b.author) : '') + '</h2>'
            + list.map((a) => '<blockquote dir="auto">' + esc(a.x) + '</blockquote>' + (String(a.n || '').trim() ? '<p dir="auto">✎ ' + esc(a.n) + '</p>' : '') + '<p class="m">' + esc([a.ch, Math.round((a.f || 0) * 100) + '%'].filter(Boolean).join(' · ')) + '</p>').join('')).join('');
          await (await K()).printRaw({ title: T('learnTitle'), lang: 'he', body: '<style>blockquote{font-style:normal;border-inline-start:3px solid #999;padding-inline-start:10px;margin-inline:0}.m{color:#666;font-size:9pt}h2{break-before:auto;margin-top:1.4em}</style>' + body });
        }),
      ]));
    });
  }

  /* ---- E3: חיפוש מתקדם בספר (לשונית בתוכן העניינים) ---- */
  function findPane(R) {   // R: { secCount, secText(i), secLabel(i), go({ q, sec, k }) }
    const pane = h('div', 'rd-pane hidden px-find');
    const S = { re: false, word: false, marks: false, plene: false };
    const inp = h('input', 'cv-field'); inp.type = 'search'; inp.dir = 'auto'; inp.placeholder = T('pxFindPh'); inp.setAttribute('aria-label', T('pxFind')); inp.enterKeyHint = 'search';
    const opts = h('div', 'px-fopts');
    const chip = (k, label) => { const c = btn('px-chip', label, () => { S[k] = !S[k]; c.setAttribute('aria-pressed', String(S[k])); run(); }); c.setAttribute('aria-pressed', 'false'); opts.append(c); };
    chip('word', T('beWord')); chip('re', T('beMRegex')); chip('marks', T('pxMarks')); chip('plene', T('pxPlene'));
    const sum = h('p', 'cv-note'); const list = h('div', 'lib-ios px-fres');
    pane.append(inp, opts, sum, list);
    let t = 0, seq = 0;
    const run = () => {
      clearTimeout(t);
      t = setTimeout(async () => {
        const my = ++seq, q = inp.value;
        list.textContent = ''; sum.textContent = '';
        if (q.trim().length < (S.re ? 1 : 2)) return;
        let total = 0, bad = false;
        for (let i = 0; i < R.secCount && total < 300; i++) {
          const txt = await R.secText(i); if (my !== seq) return;
          if (!txt) continue;
          const hits = bookFind(txt, q, S, 300 - total);
          if (hits === null) { bad = true; break; }
          if (!hits.length) continue;
          hits.forEach((x) => {
            if (total++ >= 300) return;
            // המנוע מחפש את המחרוזת שנמצאה — k = כמה פעמים היא מופיעה לפניה בפרק (באותה התאמה: בלי ניקוד, מילה שלמה)
            const k0 = (bookFind(txt.slice(0, x.pos), x.hit, { word: S.word }, 9999) || []).length;
            const a = Math.max(0, x.pos - 60), b = Math.min(txt.length, x.pos + x.len + 60);
            const r = btn('ft-row', null, () => R.go({ q: x.hit, sec: i, k: k0, word: S.word })); r.dir = 'auto';
            r.append(h('span', 'px-fch', R.secLabel(i) || ''), document.createTextNode((a ? '…' : '') + txt.slice(a, x.pos)), h('mark', null, x.hit), document.createTextNode(txt.slice(x.pos + x.len, b) + (b < txt.length ? '…' : '')));
            list.append(r);
          });
        }
        if (my !== seq) return;
        sum.textContent = bad ? T('beBadRe') : total ? T('pxFindN', { n: total >= 300 ? '300+' : total }) : T('beNoHits');
      }, 260);
    };
    inp.addEventListener('input', run);
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') inp.blur(); });
    pane._focus = () => setTimeout(() => inp.focus(), 50);
    return pane;
  }

  /* ---- E9: תמונה או טבלה במסך מלא — זום (צביטה / שתי נגיעות / כפתורים) וסיבוב ---- */
  function viewer(node) {
    const ov = h('div', 'px-view'); ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', T('pxView'));
    const stage = h('div', 'px-stage'), inner = h('div', 'px-inner');
    let el;
    if (node.tagName && /^img$/i.test(node.tagName)) { el = h('img'); el.src = node.currentSrc || node.src; el.alt = node.alt || ''; }
    else if (node.tagName && /^image$/i.test(node.tagName)) { el = h('img'); el.src = node.getAttribute('href') || node.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || ''; }
    else { el = h('div', 'px-table'); el.dir = 'auto'; const clone = node.cloneNode(true); clone.querySelectorAll && clone.querySelectorAll('script,style').forEach((x) => x.remove()); el.append(document.importNode(clone, true)); }
    inner.append(el); stage.append(inner);
    let z = 1, rot = 0;
    const paint = () => { inner.style.transform = 'rotate(' + rot + 'deg)'; el.style.inlineSize = (z * 100) + '%'; el.style.maxInlineSize = z === 1 ? '100%' : 'none'; };
    const bar = h('div', 'px-vbar');
    const ib = (txt, label, fn) => { const b = btn('px-vb', txt, fn); b.setAttribute('aria-label', label); return b; };
    const close = () => { ov.remove(); document.removeEventListener('keydown', onKey, true); if (cw) try { cw.destroy(); } catch (e) {} };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    bar.append(ib('−', T('pxZoomOut'), () => { z = Math.max(1, z / 1.5); paint(); }), ib('+', T('pxZoomIn'), () => { z = Math.min(6, z * 1.5); paint(); }),
      ib('⟳', T('pxRotate'), () => { rot = (rot + 90) % 360; paint(); }), ib('×', T('cvClose'), close));
    let last = 0;
    stage.addEventListener('click', (e) => { const now = Date.now(); if (now - last < 320) { z = z > 1 ? 1 : 2.5; paint(); last = 0; } else last = now; });
    // צביטה בשתי אצבעות
    const pts = new Map(); let d0 = 0, z0 = 1;
    stage.addEventListener('pointerdown', (e) => { pts.set(e.pointerId, e); if (pts.size === 2) { const [a, b] = [...pts.values()]; d0 = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); z0 = z; } });
    stage.addEventListener('pointermove', (e) => { if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, e); if (pts.size === 2 && d0) { const [a, b] = [...pts.values()]; z = Math.min(6, Math.max(1, z0 * Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) / d0)); paint(); } });
    const up = (e) => { pts.delete(e.pointerId); if (pts.size < 2) d0 = 0; };
    stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
    ov.append(stage, bar); document.body.append(ov); paint();
    document.addEventListener('keydown', onKey, true);
    let cw = null; try { if (typeof CloseWatcher === 'function') { cw = new CloseWatcher(); cw.onclose = () => { cw = null; close(); }; } } catch (e) { cw = null; }
    bar.querySelector('.px-vb:last-child').focus({ preventScroll: true });
  }

  /* ---- E14: הדפסה של הפרק הנוכחי או של בחירה ---- */
  async function printChapter(doc, title, lang) {
    const K = await E.convertKit();
    const body = doc && doc.body ? doc.body.cloneNode(true) : null; if (!body) return;
    body.querySelectorAll('script,style,link,iframe,object,embed').forEach((x) => x.remove());
    body.querySelectorAll('*').forEach((x) => { [...x.attributes].forEach((a) => { if (/^on/i.test(a.name)) x.removeAttribute(a.name); }); });
    await K.printRaw({ title, lang, body: new XMLSerializer().serializeToString(body).replace(/^<body[^>]*>|<\/body>$/g, '') });
  }
  async function printText(text, title, src, lang) {
    const K = await E.convertKit();
    const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    await K.printRaw({ title, lang, body: String(text).split(/\n{2,}/).map((p) => '<p dir="auto">' + esc(p).replace(/\n/g, '<br>') + '</p>').join('') + '<p style="color:#666;font-size:9pt">— ' + esc(src) + '</p>' });
  }

  return { openBrowser, authorPage, seriesPage, similarInto, openStats, openHlExport, findPane, viewer, printChapter, printText };
}
