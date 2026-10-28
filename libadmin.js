/* מנהל הספרייה (ס׳4–ס׳5, 11/10/2026) — מסכי הניהול של מדף THE SNOWBALL: רשימה וחיפוש, בחירה מרובה, הוספה בתור,
   עריכה יחד ואחד־אחד, סל, יומן שינויים עם ביטול, והמעבר מ־Drive.
   נטען רק כשהמנהל פותח "ניהול" (import('./libadmin.js') מתוך library.js). בלי ייבואים ובלי DOM בטעינה: כל מה שצריך
   מהספרייה מוזרק (createAdmin(env)), והחלקים הטהורים מיוצאים לבדיקות ב־node.
   מקור האמת = הקטלוג ב־R2 (השרתון, lib/libcat.js). כל שינוי = op אחד לשרתון = גרסה אחת = צעד ביטול אחד. */

/* ---------------------------------------------------------------- MD5 (זיהוי קובץ שכבר במדף לפני העלאה)
   R2 שומר ETag = MD5 של התוכן, והקטלוג מזהה קבצים לפיו. ב־WebCrypto אין MD5 — מימוש קצר, מצטבר (קובץ גדול בחתיכות) */
const MD5_S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
const MD5_K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) | 0);
export class Md5 {
  constructor() { this.h = [0x67452301, 0xefcdab89 | 0, 0x98badcfe | 0, 0x10325476]; this.buf = new Uint8Array(64); this.n = 0; this.len = 0; this.w = new Int32Array(16); }
  update(u8) {
    let i = 0;
    this.len += u8.length;
    if (this.n) {
      const take = Math.min(64 - this.n, u8.length);
      this.buf.set(u8.subarray(0, take), this.n); this.n += take; i = take;
      if (this.n === 64) { this.block(this.buf, 0); this.n = 0; }
    }
    for (; i + 64 <= u8.length; i += 64) this.block(u8, i);
    if (i < u8.length) { this.buf.set(u8.subarray(i), this.n); this.n += u8.length - i; }
    return this;
  }
  block(b, o) {
    const w = this.w;
    for (let j = 0; j < 16; j++) { const p = o + j * 4; w[j] = b[p] | (b[p + 1] << 8) | (b[p + 2] << 16) | (b[p + 3] << 24); }
    let a = this.h[0], x = this.h[1], c = this.h[2], d = this.h[3];
    for (let j = 0; j < 64; j++) {
      let f, g;
      if (j < 16) { f = (x & c) | (~x & d); g = j; }
      else if (j < 32) { f = (d & x) | (~d & c); g = (5 * j + 1) & 15; }
      else if (j < 48) { f = x ^ c ^ d; g = (3 * j + 5) & 15; }
      else { f = c ^ (x | ~d); g = (7 * j) & 15; }
      const s = MD5_S[(j >> 4) * 4 + (j & 3)];
      const t = (a + f + MD5_K[j] + w[g]) | 0;
      a = d; d = c; c = x;
      x = (x + ((t << s) | (t >>> (32 - s)))) | 0;
    }
    this.h[0] = (this.h[0] + a) | 0; this.h[1] = (this.h[1] + x) | 0; this.h[2] = (this.h[2] + c) | 0; this.h[3] = (this.h[3] + d) | 0;
  }
  hex() {
    const len = this.len;
    const pad = new Uint8Array((this.n < 56 ? 56 : 120) - this.n); pad[0] = 0x80;
    const bits = new Uint8Array(8);
    let lo = (len % 536870912) * 8, hi = Math.floor(len / 536870912);
    for (let i = 0; i < 4; i++) { bits[i] = lo & 255; lo = Math.floor(lo / 256); bits[4 + i] = hi & 255; hi = Math.floor(hi / 256); }
    this.update(pad); this.update(bits);
    let out = '';
    for (const v of this.h) for (let i = 0; i < 4; i++) out += ((v >>> (8 * i)) & 255).toString(16).padStart(2, '0');
    return out;
  }
}
export const md5Hex = (u8) => new Md5().update(u8 instanceof Uint8Array ? u8 : new Uint8Array(u8)).hex();
export async function md5File(file, onProg) {   // בחתיכות של 4MB — הקובץ אף פעם לא נטען כולו לזיכרון
  const m = new Md5(), step = 4 * 1024 * 1024;
  for (let o = 0; o < file.size; o += step) {
    m.update(new Uint8Array(await file.slice(o, Math.min(file.size, o + step)).arrayBuffer()));
    if (onProg) onProg(Math.min(1, (o + step) / file.size));
  }
  return m.hex();
}

/* ---------------------------------------------------------------- טהורות (נבדקות) */
export const MG_FIELDS = ['title', 'subtitle', 'author', 'authorSort', 'pub', 'date', 'lang', 'series', 'seriesIdx', 'isbn', 'tags', 'desc'];
export const BULK_FIELDS = ['author', 'lang', 'pub', 'series'];   // לפי ת־קורא: בעריכה יחד — לא כותר, לא ISBN, לא תקציר
export const BOOK_EXT = ['epub', 'azw3', 'azw', 'mobi', 'kf8', 'fb2'];
const RECENT_MS = 7 * 86400000;
export const normQ = (s) => String(s || '').toLowerCase().replace(/[֑-ׇ]/g, '').replace(/[״"׳'’.,:;!?()\[\]–—\-_/]/g, ' ').replace(/\s+/g, ' ').trim();
export const tagsOf = (b) => String((b && b.tags) || '').split(/\s*,\s*/).filter(Boolean);
export const extOf = (name) => { const m = /\.([a-z0-9]{2,5})$/i.exec(String(name || '')); return m ? m[1].toLowerCase() : ''; };

/* מה חסר בספר (לצ׳יפ "לטיפול" ולנקודה הכתומה בעריכה אחד־אחד) */
export function needs(b) {
  const out = [];
  if (!b.cover) out.push('cover');
  if (!b.author) out.push('author');
  if (!b.lang) out.push('lang');
  return out;
}
/* סינון הרשימה: צ׳יפ + חיפוש. הסל מוצג רק בצ׳יפ שלו */
export function mgFilter(books, chip, q, now) {
  const nq = normQ(q);
  return books.filter((b) => {
    if (chip === 'trash') { if (!b.del) return false; }
    else if (b.del) return false;
    if (chip === 'attn' && !needs(b).some((x) => x === 'cover' || x === 'author')) return false;
    if (chip === 'nocover' && b.cover) return false;
    if (chip === 'recent' && !(now - (b.added || 0) < RECENT_MS)) return false;
    if (chip === 'draft' && b.st !== 'draft') return false;
    if (chip === 'hide' && b.st !== 'hide') return false;
    if (nq) {
      const hay = normQ([b.title, b.subtitle, b.author, b.series, b.isbn, b.tags, b.pub].join(' '));
      if (!nq.split(' ').every((w) => hay.includes(w))) return false;
    }
    return true;
  });
}
export function mgCounts(books, now) {
  const live = books.filter((b) => !b.del);
  return { all: live.length, attn: mgFilter(live, 'attn', '', now).length, nocover: live.filter((b) => !b.cover).length,
    recent: mgFilter(live, 'recent', '', now).length, draft: live.filter((b) => b.st === 'draft').length,
    hide: live.filter((b) => b.st === 'hide').length, trash: books.length - live.length };
}
export function mgSort(books) {   // שנה (מהחדש), ואז כותר
  const yr = (b) => { const m = /\b(1[5-9]\d\d|20\d\d)\b/.exec(String(b.date || '') + ' ' + String(b.title || '')); return m ? +m[1] : 0; };
  return books.slice().sort((a, b) => yr(b) - yr(a) || String(a.title || '').localeCompare(String(b.title || ''), 'he'));
}

/* עריכה יחד: לכל שדה משותף — ערך זהה / מעורב (כמה ערכים) / חסר בכמה; ולכל תגית — בכמה ספרים */
export function bulkView(books) {
  const out = { n: books.length, f: {}, tags: [] };
  for (const k of BULK_FIELDS) {
    const vals = books.map((b) => String(b[k] || ''));
    const set = new Set(vals.filter(Boolean));
    out.f[k] = { v: set.size === 1 ? [...set][0] : '', n: set.size, miss: vals.filter((v) => !v).length };
  }
  const cnt = new Map();
  for (const b of books) for (const t of tagsOf(b)) cnt.set(t, (cnt.get(t) || 0) + 1);
  out.tags = [...cnt.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'he')).map(([t, c]) => ({ t, c, all: c === books.length }));
  return out;
}
/* הטיוטה של "עריכה יחד" → הפעולות לשרתון. ריק = ללא שינוי (לא מוחק!) — מחיקה רק בבחירה מפורשת (clear) */
export function bulkOps(ids, d) {
  if (!ids.length) return [];
  const f = {}, clear = [];
  for (const k of BULK_FIELDS) {
    if (d.clear && d.clear.includes(k)) clear.push(k);
    else if (d.f && typeof d.f[k] === 'string' && d.f[k].trim()) f[k] = d.f[k].trim();
  }
  if (d.num === 'clear') clear.push('seriesIdx');
  const op = { op: 'bulk', ids: ids.slice(0, 1000) };
  if (Object.keys(f).length) op.f = f;
  if (clear.length) op.clear = clear;
  if (d.tagsAdd && d.tagsAdd.length) op.tagsAdd = d.tagsAdd.slice(0, 30);
  if (d.tagsRm && d.tagsRm.length) op.tagsRm = d.tagsRm.slice(0, 30);
  if (d.num && typeof d.num === 'object') op.num = { start: Math.max(0, Math.round(+d.num.start || 1)), step: Math.max(1, Math.round(+d.num.step || 1)) };
  return Object.keys(op).length > 2 ? [op] : [];
}
/* מה ישתנה (שורת הסיכום מעל הכפתור) */
export function bulkSummary(d) {
  const out = [];
  for (const k of BULK_FIELDS) if ((d.clear && d.clear.includes(k)) || (d.f && typeof d.f[k] === 'string' && d.f[k].trim())) out.push(k);
  if (d.num) out.push('seriesIdx');
  const tags = (d.tagsAdd || []).length + (d.tagsRm || []).length;
  return { fields: out, tags };
}

/* בדיקה לפני הוספה: לכל קובץ שנקרא בטלפון — חדש / אולי כבר במדף / זהה / לא נתמך.
   זהה = אותו md5 (גם גרסה קודמת של ספר). אולי = אותו מזהה (dc:identifier) או אותו כותר+מחבר. כפול בתוך אותה הוספה = זהה */
export function classify(items, books) {
  const md5s = new Map(), ids = new Set(), names = new Map();
  for (const b of books) {
    if (b.del) continue;
    ids.add(b.id);
    for (const f of (b.files || []).concat(b.prev || [])) md5s.set(f.md5, b.id);
    const k = normQ(b.title) + '|' + normQ(b.author);
    if (normQ(b.title)) names.set(k, b.id);
  }
  const seen = new Set();
  return items.map((it) => {
    if (it.err || !BOOK_EXT.includes(it.ext)) return Object.assign({}, it, { g: 'bad', why: it.err || 'type' });
    if (it.md5 && (md5s.has(it.md5) || seen.has(it.md5))) return Object.assign({}, it, { g: 'same', like: md5s.get(it.md5) || '' });
    if (it.md5) seen.add(it.md5);
    if (ids.has(it.id)) return Object.assign({}, it, { g: 'maybe', like: it.id, on: true, act: 'replace' });   // אותו מזהה = כנראה גרסה חדשה — מחליפים קובץ (ההתקדמות נשמרת)
    const k = normQ(it.title) + '|' + normQ(it.author);
    if (normQ(it.title) && names.has(k)) return Object.assign({}, it, { g: 'maybe', like: names.get(k), on: true });
    return Object.assign({}, it, { g: 'new', on: true });
  });
}
/* מזהה לספר חדש שכבר קיים מזהה כמוהו במדף ("להוסיף בכל זאת") — לא דורסים: מזהה נגזר */
export function freshId(id, taken) {
  if (!taken.has(id)) return id;
  for (let i = 2; i < 100; i++) { const x = id + '~' + i; if (!taken.has(x)) return x; }
  return id + '~' + Date.now().toString(36);
}

/* המעבר מ־Drive: לכל קובץ בתוכנית — הרשומה המקומית שלו (לפי driveId), עם הפרטים כפי שהמנהל רואה אותם (כולל עריכות),
   ונעילה לשדות שנערכו ביד. מוסתר אצל המנהל: hideAll → מוסתר לכולם; אחרת — גלוי לכולם (ונשאר מוסתר רק אצלו) */
export function migrateItems(local, plan, hideAll) {
  const byDrive = new Map(local.filter((b) => b.src === 'drive' && b.driveId).map((b) => [b.driveId, b]));
  const items = [], nolocal = [];
  for (const it of plan) {
    if (it.c) continue;
    const r = byDrive.get(it.id);
    if (!r) { nolocal.push(it.id); continue; }
    const book = { id: r.id, st: r.hidden ? (hideAll ? 'hide' : 'pub') : 'pub' };
    for (const k of MG_FIELDS) if (typeof r[k] === 'string' && r[k].trim() && !(k === 'title' && r[k] === '—')) book[k] = r[k].trim();
    if (!book.title) book.title = String(it.name || '').replace(/\.[^.]+$/, '');
    book.lock = r.edit ? MG_FIELDS.filter((k) => typeof r.edit[k] === 'string' && r.edit[k].trim()) : [];
    items.push({ d: it.id, book });
  }
  return { items, nolocal };
}
/* כפילויות (ס׳7): אותו ISBN, או אותו כותר ומחבר אחרי נרמול (כתיב חסר/מלא, ניקוד). זוג ש"אלה ספרים שונים" — לא מוצג שוב.
   בכל קבוצה: הספר שנשאר = הוותיק (המזהה שלו = ההתקדמות של הקוראים) */
const dupSkel = (s) => normQ(s).split(' ').map((t) => (/[\u05d0-\u05ea]/.test(t) ? t[0] + t.slice(1).replace(/[אויה]/g, '') : t)).join(' ');
export function dupGroups(books, dismissed) {
  const live = books.filter((b) => !b.del);
  const no = new Set(dismissed || []);
  const parent = new Map(live.map((b) => [b.id, b.id]));
  const find = (x) => { while (parent.get(x) !== x) x = parent.get(x); return x; };
  const join = (a, b) => { if (no.has([a, b].sort().join('|'))) return; const ra = find(a), rb = find(b); if (ra !== rb) parent.set(rb, ra); };
  const by = new Map();
  for (const b of live) {
    const keys = [];
    const isbn = String(b.isbn || '').replace(/[^0-9X]/gi, '');
    if (isbn.length >= 10) keys.push('i:' + isbn);
    const t = dupSkel(b.title), a = dupSkel(String(b.author || '').split(',')[0]);
    if (t && a) keys.push('t:' + t + '|' + a);
    for (const k of keys) { if (by.has(k)) join(by.get(k), b.id); else by.set(k, b.id); }
  }
  const groups = new Map();
  for (const b of live) { const r = find(b.id); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(b); }
  return [...groups.values()].filter((g) => g.length > 1).map((g) => g.sort((x, y) => (x.added || 0) - (y.added || 0) || String(x.id).localeCompare(String(y.id))));
}
/* מנהל הערכים: כל ערך של מחבר / סדרה / הוצאה / תגית וכמה ספרים */
export function valueList(books, k) {
  const m = new Map();
  for (const b of books) {
    if (b.del) continue;
    const vals = k === 'tag' ? tagsOf(b) : [String(b[k] || '').trim()].filter(Boolean);
    for (const v of vals) m.set(v, (m.get(v) || 0) + 1);
  }
  return [...m.entries()].map(([v, n]) => ({ v, n })).sort((a, b) => a.v.localeCompare(b.v, 'he'));
}
/* ערכים שכנראה אותו דבר (כתיב שונה) — הצעה למיזוג */
export function valueClusters(list) {
  const by = new Map();
  for (const x of list) { const k = dupSkel(x.v); if (!k) continue; if (!by.has(k)) by.set(k, []); by.get(k).push(x); }
  return [...by.values()].filter((g) => g.length > 1);
}
export const chunk = (a, n) => { const out = []; for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n)); return out; };
export const rid = () => Array.from({ length: 16 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('');
/* כמה נשאר בתור (הערכה לפי הקצב בפועל) */
export function etaText(doneBytes, totalBytes, ms) {
  if (!doneBytes || !ms || doneBytes >= totalBytes) return 0;
  return Math.max(1, Math.round(((totalBytes - doneBytes) / (doneBytes / ms)) / 60000));
}

/* ================================================================ המסכים (דפדפן בלבד) */
const SV = (d) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
const IC = {   // קבועים (לא מתוכן חיצוני) — מוכנסים כ־innerHTML
  edit: SV('<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>'),
  one: SV('<rect x="6" y="3" width="13" height="17" rx="2"/><path d="M3 7v12a2 2 0 0 0 2 2h10"/><path d="M10 8h5M10 12h5"/>'),
  show: SV('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  hide: SV('<path d="M3 3l18 18"/><path d="M10.6 5.1A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7c1.7 0 3.2-.4 4.5-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>'),
  more: SV('<circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="19" cy="12" r="1.3" fill="currentColor"/>'),
  restore: SV('<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>'),
  trash: SV('<path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
  spark: SV('<path d="M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9z"/>'),
};
export function createAdmin(env) {
  const { h, T, ICON } = env;
  const root = () => env.root();
  const flash = (m) => { if (typeof env.flash === 'function') env.flash(m); };
  const api = env.api;                       // (op, extra) → JSON; זורק Error(קוד) כש־ok:false
  const nowMs = () => Date.now();
  const nb = (n) => (n === 1 ? T('mgOneBook') : T('mgNBooks', { n }));
  let CAT = null;                            // { v, books: [], hist: [], src }
  const A = { chip: 'all', q: '', sel: null, more: 300 };
  let IMP = null;                            // הוספה בתור
  const ONE = { key: '', i: 0 };
  const CV = new Map(), cvAsk = new Set();   // כריכות: hash → כתובת מקומית

  /* ---------- הקטלוג */
  async function fetchGz(url) {
    if (!/^https:\/\/[a-z0-9.-]+\.r2\.cloudflarestorage\.com\//.test(String(url)) || typeof DecompressionStream === 'undefined') throw new Error('url');
    const r = await fetch(url); if (!r.ok) throw new Error('dl');
    return new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).json();
  }
  async function loadCat(force) {
    if (CAT && !force && nowMs() - CAT.at < 15000) return CAT;            // אותו מסך תוך כמה שניות — בלי לשאול שוב
    const j = await api('adminCat', { have: CAT && !force ? CAT.v : -1 });
    if (j.same && CAT) { CAT.at = nowMs(); return CAT; }
    let full = j.full;
    if (!full && j.url) {
      const raw = await fetchGz(j.url);
      full = { books: raw.books, hist: (raw.hist || []).slice(-60).map((x) => ({ v: x.v, at: x.at, by: x.by, k: x.k, n: x.n, ids: (x.ids || []).slice(0, 50), undo: !!x.inv })) };
    }
    CAT = { v: j.v, books: Object.values((full && full.books) || {}), hist: (full && full.hist) || [], src: j.src || 'drive', at: nowMs() };
    return CAT;
  }
  const byId = (id) => CAT && CAT.books.find((b) => b.id === id);
  async function apply(ops, msg) {
    const j = await api('catApply', { ops, rid: rid() });
    await loadCat(true);
    if (j.conflicts && j.conflicts.length) flash(T('mgConflict', { n: j.conflicts.length }));
    if (msg && j.n) snack(msg, () => undoV(j.v));
    return j;
  }
  async function undoV(v) {
    try {
      const j = await api('undo', { v, rid: rid() });
      await loadCat(true);
      flash(j.skipped && j.skipped.length ? T('mgUndoSkip', { n: j.skipped.length }) : T('mgUndone'));
    } catch (e) { flash(T(String(e.message) === 'later_all' ? 'mgUndoLater' : 'mgErr')); }
    rerender();
  }
  const rerender = () => { const v = env.ui.view; if (v && v.mgr) render(v); };

  /* ---------- Snackbar עם ביטול (רכיב חדש יחיד — flash הוא טקסט בלבד) */
  let snackT = 0;
  function snack(msg, onUndo) {
    const r = root(); if (!r) return;
    const old = r.querySelector('.mg-snack'); if (old) old.remove();
    const s = h('div', 'mg-snack'); s.setAttribute('role', 'status');
    s.append(h('span', null, msg));
    if (onUndo) {
      const b = h('button', 'mg-snack-b', T('mgUndo')); b.type = 'button';
      b.addEventListener('click', () => { s.remove(); clearTimeout(snackT); onUndo(); });
      s.append(b);
    }
    r.append(s);
    clearTimeout(snackT);
    snackT = setTimeout(() => s.remove(), 8000);
  }

  /* ---------- כריכות מ־R2 (קישור חתום → blob → כתובת מקומית; כל img עם data-h מתעדכן במקום) */
  async function ensureCovers(books) {
    const want = books.filter((b) => b.cover && !CV.has(b.cover.h) && !cvAsk.has(b.cover.h)).slice(0, 200);
    if (!want.length) return;
    want.forEach((b) => cvAsk.add(b.cover.h));
    let urls = {};
    try { urls = (await api('urls', { ids: want.map((b) => b.id), kind: 'c' })).urls || {}; } catch (e) { want.forEach((b) => cvAsk.delete(b.cover.h)); return; }
    const q = want.slice();
    const worker = async () => {
      for (let b; (b = q.shift());) {
        try {
          const u = urls[b.id];
          if (!/^https:\/\/[a-z0-9.-]+\.r2\.cloudflarestorage\.com\//.test(String(u || ''))) continue;
          const r = await fetch(u); if (!r.ok) continue;
          const loc = URL.createObjectURL(await r.blob());
          CV.set(b.cover.h, loc);
          const rr = root();
          if (rr) rr.querySelectorAll('[data-h="' + b.cover.h + '"]').forEach((el) => paintCv(el, loc));
        } catch (e) { /* נשארת הכריכה הטיפוגרפית */ }
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
  }
  function paintCv(el, loc) {
    el.textContent = '';
    el.className = el.className.replace(/\bmg-typ\b/, '').trim() + ' mg-img';
    const im = document.createElement('img'); im.alt = ''; im.decoding = 'async'; im.src = loc; el.append(im);
  }
  const yearOf = (b) => { const m = /\b(1[5-9]\d\d|20\d\d)\b/.exec(String(b.date || '') + ' ' + String(b.title || '')); return m ? +m[1] : 0; };
  function cvEl(b, cls) {
    const el = h('div', 'mg-cv ' + (cls || ''));
    if (b.cover && CV.has(b.cover.h)) { paintCv(el, CV.get(b.cover.h)); return el; }
    if (b.cover) el.dataset.h = b.cover.h;
    el.classList.add('mg-typ');
    el.append(env.cover({ title: b.title || '—', author: b.author || '', year: yearOf(b) }, true));
    return el;
  }

  /* ---------- שלד דף */
  function page() { const home = root().querySelector('.lib-home'); home.textContent = ''; return home; }
  function topBar(start, end, title) {
    const top = h('div', 'lib-top mg-top');
    const s = h('div', 'mg-ts'); if (start) s.append(start);
    const t = h('div', 'mg-tt', title || '');
    const e = h('div', 'mg-te'); (end || []).forEach((x) => x && e.append(x));
    top.append(s, t, e);
    return top;
  }
  function backBtn(label) {
    const b = h('button', 'lib-back'); b.type = 'button'; b.innerHTML = ICON.back; b.append(h('span', null, label));
    b.addEventListener('click', () => history.back());
    return b;
  }
  const textBtn = (label, fn, cls) => { const b = h('button', 'mg-tb' + (cls ? ' ' + cls : ''), label); b.type = 'button'; b.addEventListener('click', fn); return b; };
  const pickInput = (onFiles) => {
    const inp = h('input'); inp.type = 'file'; inp.multiple = true;
    inp.accept = '.epub,.azw3,.azw,.mobi,.kf8,.fb2,application/epub+zip';
    inp.addEventListener('change', () => { const f = Array.from(inp.files || []); inp.value = ''; if (f.length) onFiles(f); });
    return inp;
  };
  function errBox(home, e) {
    const card = h('div', 'bk-card mg-pad');
    card.append(h('p', null, T(String(e && e.message) === 'no_r2' ? 'mgNoR2' : 'mgLoadErr')));
    const b = h('button', 'mini-btn', T('acRetry')); b.type = 'button'; b.addEventListener('click', rerender);
    card.append(b); home.append(card);
  }

  /* ================================================================ A — ניהול */
  async function renderHomeMgr() {
    let home = page();
    home.append(topBar(backBtn(T('libTitle'))), h('h1', 'lib-large', T('mgTitle')));
    const skel = h('div', 'mg-skel'); for (let i = 0; i < 6; i++) skel.append(h('div', 'mg-skel-r'));
    home.append(skel);
    try { await loadCat(); } catch (e) { skel.remove(); errBox(home, e); return; }
    if (!env.ui.view || env.ui.view.mgr !== 'home') return;
    home = page();
    const cnt = mgCounts(CAT.books, nowMs());
    const selecting = !!A.sel;
    if (selecting) {
      const x = h('button', 'mg-ib', '✕'); x.type = 'button'; x.setAttribute('aria-label', T('mgSelDone'));
      x.addEventListener('click', () => { A.sel = null; rerender(); });
      const vis = visibleBooks();
      const allOn = vis.length && vis.every((b) => A.sel.has(b.id));
      const all = textBtn(T(allOn ? 'mgSelNone' : 'mgSelAll'), () => { if (allOn) A.sel.clear(); else vis.forEach((b) => A.sel.add(b.id)); rerender(); });
      const tt = topBar(x, [all], T('mgNSel', { n: A.sel.size }));
      tt.querySelector('.mg-tt').setAttribute('aria-live', 'polite');
      home.append(tt);
    } else {
      const pill = IMP && IMP.stage !== 'done' && IMP.stage !== 'check' ? impPill() : null;
      const sel = textBtn(T('mgSelect'), () => { A.sel = new Set(); rerender(); });
      const more = h('button', 'mg-ib'); more.type = 'button'; more.innerHTML = ICON.more; more.setAttribute('aria-label', T('mgMenu'));
      more.addEventListener('click', menuSheet);
      home.append(topBar(backBtn(T('libTitle')), [pill, sel, more]));
      home.append(h('h1', 'lib-large', T('mgTitle')), h('p', 'ac-sub', T('mgCount', { n: cnt.all })));
    }
    const box = h('div', 'mg');
    if (!selecting && CAT.src !== 'r2') {
      const mc = h('button', 'bk-card mg-card mg-mig'); mc.type = 'button';
      mc.append(h('b', null, T('mgMigCardT')), h('span', null, T('mgMigCardS')));
      mc.addEventListener('click', () => env.goView({ mgr: 'mig' }));
      box.append(mc);
    }
    if (!selecting && IMP && IMP.stage === 'done' && IMP.added.length) {
      const rc = h('div', 'bk-card mg-card mg-resume');
      const t = h('div', 'mg-rc-t'); t.append(h('b', null, T('mgImpToday', { n: IMP.added.length })));
      const acts = h('div', 'mg-rc-a');
      if (IMP.added.length > 1) acts.append(textBtn(T('mgEditTogether'), () => env.goView({ mgr: 'bulk', ids: IMP.added.slice() })));
      acts.append(textBtn(T('mgEditOne'), () => env.goView({ mgr: 'one', ids: IMP.added.slice() })));
      t.append(acts);
      const x = h('button', 'mg-ib sm', '✕'); x.type = 'button'; x.setAttribute('aria-label', T('mgDismiss'));
      x.addEventListener('click', () => { IMP = null; rerender(); });
      rc.append(t, x); box.append(rc);
    }
    const sw = h('div', 'lib-search mg-search');
    sw.innerHTML = ICON.search || '';
    const inp = h('input'); inp.type = 'search'; inp.placeholder = T('mgSearchPh'); inp.value = A.q; inp.id = 'mgQ';
    const qdir = () => { if (inp.value) inp.dir = 'auto'; else inp.removeAttribute('dir'); };   // ריק — כיוון הדף (אחרת ה־placeholder מתהפך)
    qdir();
    sw.append(inp); box.append(sw);
    const chips = h('div', 'lib-chips no-swipe mg-chips');
    const chip = (val, label, n) => {
      const c = h('button', 'lib-chip' + (A.chip === val ? ' on' : ''), label); c.type = 'button';
      if (n != null) c.append(h('span', 'mg-n', ' ' + n));
      c.addEventListener('click', () => { A.chip = val; A.more = 300; rerender(); });
      chips.append(c);
    };
    if (selecting && A.sel.size) chip('sel', T('mgChipSel'), A.sel.size);
    chip('all', T('learnAll'));
    if (cnt.attn) chip('attn', T('mgChipAttn'), cnt.attn);
    if (cnt.recent) chip('recent', T('mgChipRecent'));
    if (cnt.nocover) chip('nocover', T('mgChipNoCover'), cnt.nocover);
    if (cnt.draft) chip('draft', T('mgChipDraft'), cnt.draft);
    if (cnt.hide) chip('hide', T('mgChipHide'), cnt.hide);
    if (cnt.trash) chip('trash', T('mgChipTrash'), cnt.trash);
    const nDup = dupGroups(CAT.books, dupDismissed()).length;
    if (nDup && !selecting) { const c = h('button', 'lib-chip', T('mgChipDup')); c.type = 'button'; c.append(h('span', 'mg-n', ' ' + nDup)); c.addEventListener('click', () => env.goView({ mgr: 'dup' })); chips.append(c); }
    box.append(chips);
    const list = h('div', 'mg-list'); box.append(list);
    home.append(box);
    const paintList = () => {
      list.textContent = '';
      const vis = visibleBooks();
      if (!CAT.books.length) { list.append(emptyState()); return; }
      if (!vis.length) { list.append(h('p', 'lib-empty', A.q ? T('mgNoMatch', { q: A.q }) : T('admNone'))); return; }
      vis.slice(0, A.more).forEach((b) => list.append(rowEl(b)));
      if (vis.length > A.more) {
        const mb = h('button', 'mini-btn mg-more', T('ftMore', { n: vis.length - A.more })); mb.type = 'button';
        mb.addEventListener('click', () => { A.more += 300; paintList(); });
        list.append(mb);
      }
      ensureCovers(vis.slice(0, Math.min(A.more, 120)));
    };
    inp.addEventListener('input', () => { A.q = inp.value; A.more = 300; qdir(); paintList(); });   // במקום — המקלדת לא נסגרת
    paintList();
    if (selecting) home.append(actionBar());
    else {
      const fab = h('button', 'bk-cta mg-fab'); fab.type = 'button'; fab.append(h('span', null, '＋ ' + T('mgAdd')));
      fab.addEventListener('click', addSheet);
      home.append(fab);
    }
  }
  /* ס׳8: מאיפה להוסיף — קבצים, תיקייה שלמה, ZIP (גם ייצוא של Calibre), או פרויקט בן־יהודה */
  function addSheet() {
    env.sheet(T('mgAddFrom'), (sh) => {
      const list = h('div', 'lib-ios');
      const done = (files) => env.closeSheetThen(sh.parentNode, () => startImport(files));
      const fileRow = (label, sub, mk) => {
        const r = h('label', 'lib-row mg-addrow'); const t = h('span', 'mg-rt'); t.append(h('span', 'mg-t1', label), h('span', 'mg-t2', sub));
        r.append(t, mk()); list.append(r);
      };
      fileRow(T('mgAddFiles'), T('mgAddFilesS'), () => pickInput(done));
      if ('webkitdirectory' in document.createElement('input')) fileRow(T('mgAddFolder'), T('mgAddFolderS'), () => {
        const inp = h('input'); inp.type = 'file'; inp.webkitdirectory = true; inp.multiple = true;
        inp.addEventListener('change', () => { const f = Array.from(inp.files || []).filter((x) => BOOK_EXT.includes(extOf(x.name))); inp.value = ''; if (f.length) done(f); else flash(T('mgNoBooksIn')); });
        return inp;
      });
      fileRow(T('mgAddZip'), T('mgAddZipS'), () => {
        const inp = h('input'); inp.type = 'file'; inp.accept = '.zip,application/zip';
        inp.addEventListener('change', async () => {
          const z = inp.files && inp.files[0]; inp.value = ''; if (!z) return;
          try { const f = await unzipBooks(z); if (f.length) done(f); else flash(T('mgNoBooksIn')); } catch (e) { flash(T('mgBadZip')); }
        });
        return inp;
      });
      const by = h('button', 'lib-row mg-addrow'); by.type = 'button';
      const bt = h('span', 'mg-rt'); bt.append(h('span', 'mg-t1', T('mgAddBy')), h('span', 'mg-t2', T('mgAddByS')));
      by.append(bt, h('span', 'mg-chev', '‹'));
      by.addEventListener('click', () => env.closeSheetThen(sh.parentNode, () => env.goView({ mgr: 'by' })));
      list.append(by);
      sh.append(list);
    });
  }
  /* ZIP (למשל "שמירה לדיסק" של Calibre): כל קובץ ספר שבו, בלי לפרוס את השאר */
  async function unzipBooks(zipFile) {
    const EK = await kit();
    const z = await EK.readZip(zipFile);
    const out = [];
    for (const e of z.entries) {
      const name = e.name.split('/').pop();
      if (e.name.endsWith('/') || !BOOK_EXT.includes(extOf(name)) || e.usize > 100 * 1024 * 1024) continue;
      out.push(new File([await EK.readEntry(zipFile, e, { max: 100 * 1024 * 1024 })], name));
      if (out.length >= 500) break;
    }
    return out;
  }
  function visibleBooks() {
    let list = A.chip === 'sel' && A.sel ? CAT.books.filter((b) => A.sel.has(b.id)) : mgFilter(CAT.books, A.chip, A.q, nowMs());
    return mgSort(list);
  }
  function emptyState() {
    const box = h('div', 'mg-empty');
    box.append(h('div', 'mg-empty-ic', '📚'), h('b', null, T('mgEmptyT')), h('p', null, T('mgEmptyS')));
    const add = h('button', 'bk-cta'); add.type = 'button'; add.append(h('span', null, T('mgAdd')));
    add.addEventListener('click', addSheet);
    box.append(add);
    return box;
  }
  function rowEl(b) {
    const r = h('button', 'mg-row'); r.type = 'button';
    const on = A.sel && A.sel.has(b.id);
    if (A.sel) { const ck = h('span', 'mg-ck' + (on ? ' on' : ''), on ? '✓' : ''); ck.setAttribute('aria-hidden', 'true'); r.append(ck); r.setAttribute('aria-pressed', on ? 'true' : 'false'); }
    if (on) r.classList.add('sel');
    r.append(cvEl(b));
    const t = h('div', 'mg-rt');
    const t1 = h('div', 'mg-t1', b.title || '—'); t1.dir = 'auto';
    const sub = [b.author, b.series ? b.series + (b.seriesIdx ? ' ' + b.seriesIdx : '') : ''].filter(Boolean).join(' · ');
    const t2 = h('div', 'mg-t2', sub); t2.dir = 'auto';
    t.append(t1, t2);
    const tags = h('div', 'mg-tags');
    if (b.st === 'draft') tags.append(h('span', 'mg-tag g', T('mgStDraft')));
    if (b.st === 'hide') tags.append(h('span', 'mg-tag', T('mgStHide')));
    if (!b.cover) tags.append(h('span', 'mg-tag w', T('mgNoCover')));
    if (!b.author) tags.append(h('span', 'mg-tag w', T('mgNoAuthor')));
    if (tags.childNodes.length) t.append(tags);
    r.append(t);
    if (!A.sel) r.append(h('span', 'mg-chev', '‹'));
    r.addEventListener('click', () => {
      if (A.sel) { if (A.sel.has(b.id)) A.sel.delete(b.id); else A.sel.add(b.id); rerender(); return; }
      env.goView({ mgr: 'one', ids: [b.id] });
    });
    if (env.wireHold) env.wireHold(r, () => { if (!A.sel) A.sel = new Set(); A.sel.add(b.id); rerender(); });
    return r;
  }
  function actionBar() {
    const bar = h('div', 'mg-abar'); bar.setAttribute('role', 'toolbar');
    const ids = () => Array.from(A.sel || []);
    const n = ids().length;
    const item = (ic, label, fn, primary) => {
      const b = h('button', 'mg-ab' + (primary ? ' p' : '')); b.type = 'button';
      const i = h('b'); i.innerHTML = ic; b.append(i, h('span', null, label));
      if (!n) { b.disabled = true; b.setAttribute('aria-disabled', 'true'); }
      b.addEventListener('click', fn);
      bar.append(b);
    };
    if (A.chip === 'trash') {
      item(IC.restore, T('mgRestore'), async () => { await safe(() => apply([{ op: 'restore', ids: ids() }], T('mgRestored', { n }))); A.sel = null; rerender(); }, true);
      item(IC.trash, T('mgPurge'), () => env.askConfirm(T('mgPurgeQ', { n }), async () => { await safe(() => apply([{ op: 'purge', ids: ids() }], T('mgPurged', { n }))); A.sel = null; rerender(); }, { danger: true, ok: T('mgPurgeOk', { n }) }));
      return bar;
    }
    item(IC.edit, T('mgEdit'), () => env.goView(n > 1 ? { mgr: 'bulk', ids: ids() } : { mgr: 'one', ids: ids() }), true);
    item(IC.one, T('mgOneShort'), () => env.goView({ mgr: 'one', ids: mgSort(CAT.books.filter((b) => A.sel.has(b.id))).map((b) => b.id) }));
    item(IC.show, T('mgPublish'), async () => { await safe(() => apply([{ op: 'state', ids: ids(), st: 'pub' }], T('mgPublished', { n }))); rerender(); });
    item(IC.hide, T('mgHide'), async () => { await safe(() => apply([{ op: 'state', ids: ids(), st: 'hide' }], T('mgHidden', { n }))); A.sel = null; rerender(); });
    item(IC.more, T('mgMore'), () => env.sheet(nb(n), (sh, close) => {
      const list = h('div', 'lib-ios');
      const row = (label, fn, danger) => { const r = h('button', 'lib-row' + (danger ? ' mg-danger' : ''), label); r.type = 'button'; r.addEventListener('click', () => env.closeSheetThen(sh.parentNode, fn)); list.append(r); };
      row(T('mgDelete'), () => env.askConfirm(T('mgDeleteQ', { n }), async () => { await safe(() => apply([{ op: 'del', ids: ids() }], T('mgDeleted', { n }))); A.sel = null; rerender(); }, { danger: true, ok: T('mgDeleteOk', { n }) }), true);
      row(T('mgToDraft'), async () => { await safe(() => apply([{ op: 'state', ids: ids(), st: 'draft' }], T('mgDrafted', { n }))); rerender(); });
      row(T('mgTags'), () => env.goView({ mgr: 'bulk', ids: ids() }));
      row(T('mgSugRow'), () => env.goView({ mgr: 'sug', ids: ids() }));
      sh.append(list);
    }));
    return bar;
  }
  async function safe(fn) { try { return await fn(); } catch (e) { flash(T(String(e.message) === 'shrink' ? 'mgShrink' : 'mgErr')); return null; } }
  function menuSheet() {
    env.sheet(T('mgTitle'), (sh) => {
      const list = h('div', 'lib-ios');
      const row = (label, fn) => { const r = h('button', 'lib-row', label); r.type = 'button'; r.addEventListener('click', () => env.closeSheetThen(sh.parentNode, fn)); list.append(r); };
      row(T(CAT && CAT.src === 'r2' ? 'mgMigDoneRow' : 'mgMigRow'), () => env.goView({ mgr: 'mig' }));
      const nd = CAT ? dupGroups(CAT.books, dupDismissed()).length : 0;
      if (nd) row(T('mgDupRow', { n: nd }), () => env.goView({ mgr: 'dup' }));
      row(T('mgValsAuthor'), () => env.goView({ mgr: 'vals', k: 'author' }));
      row(T('mgValsSeries'), () => env.goView({ mgr: 'vals', k: 'series' }));
      row(T('mgValsPub'), () => env.goView({ mgr: 'vals', k: 'pub' }));
      row(T('mgValsTag'), () => env.goView({ mgr: 'vals', k: 'tag' }));
      row(T('mgHist'), () => env.goView({ mgr: 'hist' }));
      row(T('mgReaders'), () => env.goView({ admin: 1 }));
      row(T('mgReload'), async () => { CAT = null; rerender(); });
      sh.append(list);
    });
  }
  function impPill() {
    const done = IMP.items.filter((x) => x.st === 'ok' || x.st === 'dup').length, tot = IMP.items.filter((x) => x.st).length;
    const fail = IMP.items.filter((x) => x.st === 'fail').length;
    const b = h('button', 'mg-pill' + (fail ? ' w' : '')); b.type = 'button';
    if (fail) b.append(h('span', null, '! ' + T('mgFailedN', { n: fail })));
    else { b.append(env.ring(tot ? done / tot : 0), h('span', null, T('mgLeft', { n: tot - done }))); }
    b.addEventListener('click', () => env.goView({ mgr: 'imp' }));
    return b;
  }

  /* ================================================================ C/D/E — הוספה */
  async function startImport(files) {
    if (IMP && IMP.stage === 'queue') { flash(T('mgBusy')); return; }
    IMP = { stage: 'read', items: files.slice(0, 500).map((f, i) => (f instanceof Blob ? { k: i, file: f, name: f.name, size: f.size, ext: extOf(f.name) } : Object.assign({ k: i }, f))), pub: false, added: [], read: 0 };
    env.goView({ mgr: 'imp' });
    try { await loadCat(); } catch (e) { /* בלי הקטלוג — בלי זיהוי כפילויות; השרתון עוד יזהה זהים */ }
    for (const it of IMP.items) { if (!IMP) return; if (it.file) await readOne(it); else it.err = it.err || 'open'; IMP.read++; paintImp(); }
    if (!IMP) return;
    IMP.items = classify(IMP.items, (CAT && CAT.books) || []);
    IMP.stage = 'check';
    paintImp();
  }
  let EKP = null;
  const kit = () => (EKP || (EKP = import('./epubkit.js')));   // epubkit — רק כשמוסיפים ספרים
  /* קריאה בטלפון, לפני העלאה (מחקר 06): הסוג לפי התוכן; EPUB — בדיקת תקינות ו־DRM, תיקון מיכל (דגל UTF‑8 לשמות בעברית —
     בלעדיו הספר לא נפתח בכלל) ופרטים מה־OPF (foliate מאבד סדרה של EPUB 3 ולא רואה ISBN); MOBI — מזהה יציב מ־EXTH ובדיקת DRM;
     FB2 — סדרה, ISBN וכריכה. הקובץ שמגבבים ומעלים = הקובץ המתוקן. */
  async function readOne(it) {
    if (it.size > 100 * 1024 * 1024) { it.err = 'size'; return; }
    try {
      const EK = await kit();
      const kind = await EK.classify(it.file).catch(() => 'unknown');
      it.kind = kind;
      if (!['epub', 'mobi', 'fb2'].includes(kind)) { it.err = kind === 'kfx-drm' ? 'drm' : 'type'; return; }
      let file = it.file, opf = null, stable = '', isbn = '', fb = null;
      if (kind === 'epub') {
        const rep = await EK.inspectEpub(file);
        if (!rep.ok) { it.err = rep.drm ? 'drm' : 'broken'; it.code = (rep.errors[0] && rep.errors[0].code) || ''; return; }
        const fx = await EK.repairEpub(file, rep);
        if (fx.fixed.length) { file = new File([fx.blob], it.name, { type: 'application/epub+zip' }); it.fixed = fx.fixed; }
        opf = EK.readOpfMeta(rep.opf);
        stable = opf.uid || ''; isbn = opf.isbn || '';
      }
      if (kind === 'fb2') {
        fb = EK.fb2Meta(new DOMParser().parseFromString(await file.text(), 'application/xml'));
        stable = fb.id || ''; isbn = fb.isbn || '';
      }
      const book = await env.makeBook(file);
      const md = book.metadata || {};
      if (kind === 'mobi') {
        const mi = EK.mobiInfo(book);
        if (mi && mi.drm) { it.err = 'drm'; return; }
        stable = (mi && mi.stableId) || ''; isbn = (mi && mi.isbn) || '';
      }
      const ident = stable || (kind === 'mobi' ? '' : env.langText(md.identifier));
      it.id = ident ? 'id-' + ident : await env.fileId(file);
      const ex = env.bookExtras(book), df = env.fileDefaults(md);
      const lang0 = Array.isArray(md.language) ? md.language[0] || '' : (md.language || '');
      const title = (opf && opf.title) || env.langText(md.title) || it.name.replace(/\.[^.]+$/, '');
      const authors = opf && opf.authors.length ? opf.authors.map((a) => a.name).filter(Boolean).join(', ') : (env.langText(md.author) || '');
      it.title = title; it.author = authors;
      it.fields = {
        title, author: authors, subtitle: (opf && opf.subtitle) || df.subtitle || '',
        authorSort: (opf && opf.authors[0] && opf.authors[0].sort) || df.authorSort || '',
        pub: (opf && opf.publisher) || ex.pub || '', date: String((opf && opf.date) || ex.date || '').slice(0, 10),
        lang: (opf && opf.lang) || lang0, desc: ex.desc || '',
        series: (opf && opf.series) || (fb && fb.series) || df.series || '',
        seriesIdx: String((opf && opf.seriesIndex) || (fb && fb.seriesIndex) || (/^\d+(\.\d+)?$/.test(df.seriesIdx || '') ? df.seriesIdx : '')),
        isbn: isbn || df.isbn || '', tags: (opf && opf.tags.length ? opf.tags.join(', ') : df.tags) || '',
      };
      if (fb && fb.cover && fb.cover.b64) it.cover = await env.coverFromBlob(new Blob([EK.b64ToBytes(fb.cover.b64)], { type: fb.cover.type }), 480).catch(() => null);
      else it.cover = await env.coverThumb(book).catch(() => null);
      it.file = file; it.size = file.size;
      it.ext = kind === 'mobi' ? (['azw3', 'azw', 'kf8'].includes(it.ext) ? 'azw3' : 'mobi') : kind;   // הסוג האמיתי — השרתון מוודא שוב
      it.md5 = await EK.md5Blob(file);
    } catch (e) { it.err = 'open'; }
  }
  function paintImp() { const v = env.ui.view; if (v && v.mgr === 'imp') renderImp(); }
  function renderImp() {
    if (!IMP) { const home = page(); home.append(topBar(backBtn(T('mgTitle'))), h('p', 'lib-empty', T('mgNoImport'))); return; }
    if (IMP.stage === 'read' || IMP.stage === 'check') return renderCheck();
    if (IMP.stage === 'queue') return renderQueue();
    return renderDone();
  }
  function renderCheck() {
    const home = page();
    const cancel = textBtn(T('mgCancel'), () => { IMP = null; history.back(); });
    home.append(topBar(cancel, [], T('mgNFiles', { n: IMP.items.length })));
    const box = h('div', 'mg'); home.append(box);
    if (IMP.stage === 'read' && IMP.fetching) { box.append(h('p', 'ac-sub mg-sum', T('mgByFetching', { n: IMP.fetched || 0, t: IMP.fetching }))); return; }
    if (IMP.stage === 'read') {
      box.append(h('p', 'ac-sub mg-sum', T('mgReading', { n: IMP.read, t: IMP.items.length })));
      const l = h('div', 'mg-list');
      IMP.items.slice(0, IMP.read).forEach((it) => l.append(fileRow(it, false)));
      box.append(l);
      return;
    }
    const g = (x) => IMP.items.filter((it) => it.g === x);
    const nw = g('new'), mb = g('maybe'), sm = g('same'), bd = g('bad');
    const parts = [T('mgSumNew', { n: nw.length })];
    if (mb.length) parts.push(T('mgSumMaybe', { n: mb.length }));
    if (sm.length) parts.push(T('mgSumSame', { n: sm.length }));
    if (bd.length) parts.push(T('mgSumBad', { n: bd.length }));
    box.append(h('p', 'mg-sum', parts.join(' · ')));
    const group = (title, items, sel) => {
      if (!items.length) return;
      box.append(h('div', 'mg-lbl', title));
      const l = h('div', 'mg-list'); items.forEach((it) => l.append(fileRow(it, sel))); box.append(l);
    };
    group(T('mgGNew', { n: nw.length }), nw, true);
    group(T('mgGMaybe', { n: mb.length }), mb, true);
    if (sm.length) {
      const d = h('details', 'mg-fold'); d.append(h('summary', null, T('mgGSame', { n: sm.length })));
      const l = h('div', 'mg-list'); sm.forEach((it) => l.append(fileRow(it, false))); d.append(l); box.append(d);
    }
    group(T('mgGBad', { n: bd.length }), bd, false);
    const opts = h('div', 'lib-ios mg-opts');
    const pr = h('label', 'lib-row'); pr.append(h('span', null, T('mgPubNow')));
    const sw = h('input', 'mg-switch'); sw.type = 'checkbox'; sw.checked = IMP.pub; sw.id = 'mgPubNow';
    sw.addEventListener('change', () => { IMP.pub = sw.checked; });
    pr.append(sw); opts.append(pr); box.append(opts);
    const n = IMP.items.filter((it) => it.on && (it.g === 'new' || it.g === 'maybe')).length;
    const cta = h('button', 'bk-cta mg-cta', n === 1 ? T('mgAddOneBook') : n ? T('mgAddN', { n }) : T('mgNoneSel')); cta.type = 'button'; cta.disabled = !n;
    cta.addEventListener('click', runQueue);
    if (!nw.length && !mb.length && sm.length) box.append(h('p', 'lib-empty', T('mgAllSame', { n: sm.length })));
    home.append(cta);
  }
  function fileRow(it, selectable) {
    const r = h(selectable ? 'button' : 'div', 'mg-row' + (it.g === 'bad' ? ' dis' : ''));
    if (selectable) {
      r.type = 'button';
      const ck = h('span', 'mg-ck' + (it.on ? ' on' : ''), it.on ? '✓' : ''); r.append(ck);
      r.setAttribute('aria-pressed', it.on ? 'true' : 'false');
      r.addEventListener('click', () => { it.on = !it.on; renderCheck(); });
    }
    const cv = h('div', 'mg-cv sm');
    if (it.cover) { const im = document.createElement('img'); im.alt = ''; im.src = URL.createObjectURL(it.cover.blob); cv.classList.add('mg-img'); cv.append(im); }
    else cv.append(env.cover({ title: it.title || it.name, author: it.author || '' }, true));
    r.append(cv);
    const t = h('div', 'mg-rt');
    const t1 = h('div', 'mg-t1', it.title || it.name); t1.dir = 'auto';
    let sub = it.author || '';
    if (it.g === 'maybe') { const o = byId(it.like); sub = T(it.act === 'replace' ? 'mgReplaceOf' : 'mgLike', { t: o ? o.title : '' }); }
    if (it.g === 'same') { const o = byId(it.like); sub = o ? T('mgSameAs', { t: o.title }) : T('mgSameBatch'); }
    if (it.g === 'bad') sub = T(it.why === 'size' ? 'mgBadSize' : it.why === 'open' || it.why === 'broken' ? 'mgBadOpen' : it.why === 'drm' ? 'mgBadDrm' : /^acsm$/.test(it.ext) ? 'mgBadAcsm' : 'mgBadType');
    const t2 = h('div', 'mg-t2', sub); t2.dir = 'auto';
    t.append(t1, t2); r.append(t);
    const fm = h('span', 'mg-fmt', (it.ext || '?').toUpperCase() + ' · ' + mb(it.size)); fm.dir = 'ltr'; r.append(fm);
    if (it.g === 'maybe' && it.like === it.id && selectable) {   // גרסה חדשה או ספר נפרד — בחירה בשורה עצמה
      const sw = h('span', 'mini-btn mg-act', T(it.act === 'replace' ? 'mgActAdd' : 'mgActReplace')); sw.setAttribute('role', 'button'); sw.tabIndex = 0;
      sw.addEventListener('click', (e) => { e.stopPropagation(); it.act = it.act === 'replace' ? 'add' : 'replace'; renderCheck(); });
      t.append(sw);
    }
    return r;
  }
  const mb = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1) + 'MB' : Math.max(1, Math.round(n / 1e3)) + 'KB');
  function putFile(url, blob, onProg) {
    return new Promise((ok, no) => {
      const x = new XMLHttpRequest();
      x.open('PUT', url);
      x.upload.onprogress = (e) => { if (e.lengthComputable && onProg) onProg(e.loaded / e.total); };
      x.onload = () => (x.status === 200 ? ok() : no(new Error('put_' + x.status)));
      x.onerror = () => no(new Error('net'));
      x.onabort = () => no(new Error('abort'));
      x.send(blob.slice(0, blob.size));   // בלי סוג — בלי כותרת Content-Type (בלי preflight מיותר)
    });
  }
  async function runQueue() {
    const todo = IMP.items.filter((it) => it.on && (it.g === 'new' || it.g === 'maybe'));
    const taken = new Set(((CAT && CAT.books) || []).map((b) => b.id));
    for (const it of todo) { if (it.act !== 'replace' && taken.has(it.id)) it.id = freshId(it.id, taken); taken.add(it.id); it.st = 'wait'; }
    IMP.stage = 'queue'; IMP.batch = 'imp-' + rid().slice(0, 10); IMP.t0 = nowMs(); IMP.paused = false;
    paintImp();
    await pump();
  }
  async function pump() {
    if (!IMP || IMP.pumping) return;
    IMP.pumping = true;
    const next = () => (IMP && !IMP.paused ? IMP.items.find((x) => x.st === 'wait') : null);
    const worker = async () => {
      for (let it; (it = next());) {
        for (let k = 0; k < 3; k++) {                       // תקלה חולפת (רשת / עומס) — עד שני ניסיונות נוספים לפני "לא נוסף"
          await upOne(it);
          if (it.st !== 'fail' || !/^(net|abort|put_5|put_429|rate_limited|cat_failed|r2_)/.test(it.why || '')) break;
          it.st = 'up'; await new Promise((r) => setTimeout(r, 1500 * (k + 1)));
        }
      }
    };
    await Promise.all([worker(), worker()]);
    if (!IMP) return;
    IMP.pumping = false;
    if (!IMP.items.some((x) => x.st === 'wait' || x.st === 'up' || x.st === 'proc')) {
      IMP.stage = 'done';
      IMP.added = IMP.items.filter((x) => x.st === 'ok').map((x) => x.id);
      try { await loadCat(true); } catch (e) {}
      if (env.ui.view && env.ui.view.mgr === 'imp') renderImp();
      else snack(T('mgAddedN', { n: IMP.added.length }));
    }
  }
  async function upOne(it) {
    it.st = 'up'; it.p = 0; paintRow(it);
    try {
      const pre = it.pre && !it.fixed ? it.pre : null;      // בן־יהודה: הקובץ כבר בקובץ זמני ב־R2 (אם לא תוקן בטלפון)
      const want = pre ? [] : [{ k: 'b', size: it.size }];
      if (it.cover) want.push({ k: 'c', size: it.cover.blob.size });
      const pl = want.length ? await api('upPlan', { items: want }) : { items: [] };
      const ub = pre ? { u: pre.u } : pl.items[0];
      if (!ub || !ub.u) throw new Error((ub && ub.err) || 'plan');
      if (!pre) await putFile(ub.url, it.file, (p) => { it.p = p; paintRow(it); });
      if (pre) pl.items.unshift(null);
      it.st = 'proc'; paintRow(it);
      const book = Object.assign({ id: it.id, st: IMP.pub ? 'pub' : 'draft' }, it.fields);
      const one = it.act === 'replace' ? { u: ub.u, k: 'b', ext: it.ext, id: it.like } : { u: ub.u, k: 'b', ext: it.ext, book, batch: IMP.batch };
      const cm = await api('upCommit', { rid: rid(), items: [one] });
      if (cm.dup && cm.dup.length) { it.st = 'dup'; paintRow(it); return; }
      if (!cm.done || !cm.done.length) throw new Error((cm.bad && cm.bad[0] && cm.bad[0].why) || 'commit');
      const uc = it.act === 'replace' ? null : pl.items[1];
      if (uc && uc.u) {
        try { await putFile(uc.url, it.cover.blob); await api('upCommit', { rid: rid(), items: [{ u: uc.u, k: 'c', id: it.id, r: it.cover.w / it.cover.h, src: 'file' }] }); it.cv = 1; }
        catch (e) { /* הספר נוסף; הכריכה — אפשר להחליף מהעורך */ }
      }
      it.st = 'ok';
    } catch (e) { it.st = 'fail'; it.why = String((e && e.message) || e).slice(0, 40); }
    paintRow(it);
  }
  function stLine(it) {
    if (it.st === 'wait') return h('span', 'mg-st', '◷ ' + T('mgWait'));
    if (it.st === 'up') return h('span', 'mg-st', T('mgUp', { p: Math.round((it.p || 0) * 100) }));
    if (it.st === 'proc') return h('span', 'mg-st', '··· ' + T('mgProc'));
    if (it.st === 'ok') return h('span', 'mg-st ok', '✓ ' + T(it.cv ? 'mgOkCover' : 'mgOk'));
    if (it.st === 'dup') return h('span', 'mg-st', T('mgDupSkip'));
    if (it.st === 'fail') return h('span', 'mg-st bad', '⚠ ' + T(it.why === 'net' ? 'mgFailNet' : 'mgFail'));
    return h('span', 'mg-st', T('mgCancelled'));
  }
  function paintRow(it) {
    const r = root(); const el = r && r.querySelector('.mg-q[data-k="' + it.k + '"]');
    if (!el) { if (env.ui.view && env.ui.view.mgr === 'imp' && IMP && IMP.stage === 'queue') renderQueue(); return; }
    const old = el.querySelector('.mg-st'); if (old) old.replaceWith(stLine(it));
    const rb = el.querySelector('.mini-btn'); if (rb && it.st !== 'fail') rb.remove();
    if (it.st === 'fail' && !rb) el.append(retryBtn(it));
    paintHead();
  }
  function retryBtn(it) { const b = h('button', 'mini-btn', T('mgRetry')); b.type = 'button'; b.addEventListener('click', () => { it.st = 'wait'; renderQueue(); pump(); }); return b; }
  function qStats() {
    const todo = IMP.items.filter((x) => x.st);
    const done = todo.filter((x) => x.st === 'ok' || x.st === 'dup').length;
    const bytes = todo.reduce((s, x) => s + x.size, 0);
    const doneB = todo.reduce((s, x) => s + (x.st === 'ok' || x.st === 'dup' ? x.size : x.st === 'up' ? x.size * (x.p || 0) : 0), 0);
    return { todo, done, fail: todo.filter((x) => x.st === 'fail').length, eta: etaText(doneB, bytes, nowMs() - IMP.t0) };
  }
  function paintHead() {
    const r = root(); const hd = r && r.querySelector('.mg-qhead'); if (!hd || !IMP) return;
    const s = qStats();
    hd.querySelector('.mg-big').textContent = T('mgIofN', { i: s.done, n: s.todo.length });
    hd.querySelector('.mg-eta').textContent = IMP.paused ? T('mgPaused') : (s.eta ? T('mgEta', { t: s.eta }) : '');
    const rg = hd.querySelector('.ac-ring'); if (rg) rg.replaceWith(env.ring(s.todo.length ? s.done / s.todo.length : 0));
  }
  function renderQueue() {
    const home = page();
    home.append(topBar(backBtn(T('mgTitle')), [], T('mgQueueT')));
    const box = h('div', 'mg'); home.append(box);
    const s = qStats();
    const card = h('div', 'bk-card mg-qhead');
    const rw = h('div', 'mg-ringw'); rw.append(env.ring(s.todo.length ? s.done / s.todo.length : 0));
    const tx = h('div'); tx.append(h('div', 'mg-big', ''), h('div', 'mg-eta', '')); rw.append(tx); card.append(rw);
    const btns = h('div', 'mg-btns');
    btns.append(textBtn(T(IMP.paused ? 'mgResume' : 'mgPause'), () => { IMP.paused = !IMP.paused; renderQueue(); if (!IMP.paused) pump(); }, 'o'));
    btns.append(textBtn(T('mgCancelImp'), () => env.askConfirm(T('mgCancelQ', { n: s.done }), () => {
      IMP.items.forEach((x) => { if (x.st === 'wait') x.st = 'cancel'; }); IMP.paused = false; renderQueue(); pump();
    }, { danger: true, ok: T('mgCancelImp') }), 'o danger'));
    card.append(btns); box.append(card);
    if (s.fail) {
      const fb = h('div', 'mg-failbar'); fb.append(h('span', null, T('mgFailedN', { n: s.fail })));
      fb.append(textBtn(T('mgRetryAll'), () => { IMP.items.forEach((x) => { if (x.st === 'fail') x.st = 'wait'; }); renderQueue(); pump(); }));
      box.append(fb);
    }
    const l = h('div', 'mg-list');
    s.todo.forEach((it) => {
      const r = h('div', 'mg-row mg-q'); r.dataset.k = it.k;
      const cv = h('div', 'mg-cv xs');
      if (it.cover) { const im = document.createElement('img'); im.alt = ''; im.src = URL.createObjectURL(it.cover.blob); cv.classList.add('mg-img'); cv.append(im); }
      else cv.append(env.cover({ title: it.title || it.name, author: it.author || '' }, true));
      const t = h('div', 'mg-rt'); const t1 = h('div', 'mg-t1 one', it.title || it.name); t1.dir = 'auto'; t.append(t1, stLine(it));
      r.append(cv, t);
      if (it.st === 'fail') r.append(retryBtn(it));
      l.append(r);
    });
    box.append(l);
    paintHead();
  }
  function renderDone() {
    const home = page();
    home.append(topBar(null, [textBtn(T('mgDoneBtn'), finishImport)], ''));
    const box = h('div', 'mg mg-done'); home.append(box);
    const n = IMP.added.length, skipped = IMP.items.filter((x) => x.st === 'dup' || x.g === 'same').length;
    box.append(h('div', 'mg-ok56', '✓'), h('h2', null, n === 1 ? T('mgAddedOne') : T('mgAddedN', { n })));
    if (skipped) box.append(h('p', 'mg-sub', T('mgSkipped', { n: skipped })));
    const failed = IMP.items.filter((x) => x.st === 'fail').length;
    if (failed) box.append(h('p', 'mg-sub w', T('mgFailedN', { n: failed })));
    const books = IMP.added.map(byId).filter(Boolean);
    const noCover = books.filter((b) => !b.cover).length, noAuthor = books.filter((b) => !b.author).length;
    if (noCover || noAuthor) {
      const ch = h('div', 'lib-chips mg-chips c');
      if (noCover) ch.append(h('span', 'lib-chip', T('mgNNoCover', { n: noCover })));
      if (noAuthor) ch.append(h('span', 'lib-chip', T('mgNNoAuthor', { n: noAuthor })));
      box.append(ch);
    }
    if (n) {
      const list = h('div', 'lib-ios mg-choice');
      const choice = (ic, cls, title, sub, fn) => { const r = h('button', 'lib-row'); r.type = 'button'; const i = h('span', 'mg-ico ' + cls); i.innerHTML = ic; const t = h('div', 'mg-rt'); t.append(h('div', 'mg-t1', title), h('div', 'mg-t2', sub)); r.append(i, t, h('span', 'mg-chev', '‹')); r.addEventListener('click', fn); list.append(r); };
      if (n > 1) choice(IC.edit, 'g', T('mgEditTogether'), T('mgEditTogetherS', { n }), () => env.goView({ mgr: 'bulk', ids: IMP.added.slice() }));
      choice(IC.one, 'b', T('mgEditOne'), T('mgEditOneS'), () => env.goView({ mgr: 'one', ids: IMP.added.slice() }));
      choice(IC.spark, 'p', T('mgSugT'), T('mgSugS'), () => env.goView({ mgr: 'sug', ids: IMP.added.slice() }));
      if (!IMP.pub) choice(IC.show, 'g', T('mgPubAll', { n }), T('mgPubAllS'), async () => { await safe(() => apply([{ op: 'state', ids: IMP.added.slice(), st: 'pub' }], T('mgPublished', { n }))); IMP.pub = true; renderDone(); });
      box.append(list);
    }
  }
  function finishImport() {
    if (IMP && IMP.added.length) A.chip = 'recent';
    if (IMP) IMP.stage = 'done';
    history.back();
  }

  /* ================================================================ F — עריכה יחד */
  async function renderBulk(v) {
    const home = page();
    try { await loadCat(); } catch (e) { errBox(home, e); return; }
    const books = (v.ids || []).map(byId).filter((b) => b && !b.del);
    if (!books.length) { history.back(); return; }
    const n = books.length, bv = bulkView(books);
    const d = { f: {}, clear: [], tagsAdd: [], tagsRm: [], num: null };
    const dirty = () => bulkOps(books.map((b) => b.id), d).length > 0;
    const cancel = textBtn(T('mgCancel'), () => { if (dirty()) env.askConfirm(T('mgDiscardQ'), () => history.back(), { danger: true, ok: T('mgDiscard') }); else history.back(); });
    home.append(topBar(cancel, [], nb(n)));
    const box = h('div', 'mg'); home.append(box);
    const st = h('div', 'mg-stack'); books.slice(0, 5).forEach((b) => st.append(cvEl(b, 'sm')));
    if (n > 5) { const m = h('span', 'mg-stack-more', '+' + (n - 5)); m.dir = 'ltr'; st.append(m); }
    box.append(st); ensureCovers(books.slice(0, 5));
    const LBL = { author: T('edAuthor'), lang: T('edLang'), pub: T('edPub'), series: T('edSeries') };
    const summary = h('div', 'mg-sumline');
    const cta = h('button', 'bk-cta mg-cta', T('mgApplyN', { n })); cta.type = 'button';
    const refresh = () => {
      const s = bulkSummary(d);
      const names = s.fields.map((k) => (k === 'seriesIdx' ? T('edSeriesIdx') : LBL[k]));
      if (s.tags) names.push(T('mgTagsN', { n: s.tags }));
      summary.textContent = names.length ? T('mgWillChange', { f: names.join(', ') }) : '';
      cta.disabled = !dirty();
    };
    const form = h('div', 'bk-card ed-form'); box.append(h('div', 'mg-lbl', T('mgShared')), form);
    for (const k of BULK_FIELDS) {
      const fv = bv.f[k];
      const row = h('label', 'ed-row');
      row.append(h('span', 'ed-lbl', LBL[k]));
      const inp = h('input', 'ed-in'); inp.type = 'text'; inp.dir = k === 'lang' ? 'ltr' : 'auto'; inp.id = 'mgB' + k;
      inp.value = fv.n === 1 ? fv.v : '';
      inp.placeholder = fv.n > 1 ? T('mgVaries', { n: fv.n }) : '';
      const note = h('span', 'mg-note', fv.n === 1 && fv.miss ? T('mgMissIn', { n: fv.miss }) : '');
      const init = inp.value;
      inp.addEventListener('input', () => {
        const val = inp.value.trim();
        if (val && (val !== init || fv.miss)) { d.f[k] = val; row.classList.add('filled'); note.textContent = T('mgWillAll', { n }); }
        else { delete d.f[k]; row.classList.remove('filled'); note.textContent = fv.n === 1 && fv.miss ? T('mgMissIn', { n: fv.miss }) : ''; }
        refresh();
      });
      row.append(inp, note);
      if (fv.n) {
        const clr = h('button', 'mg-clear', T('mgClearAll')); clr.type = 'button';
        clr.addEventListener('click', (e) => {
          e.preventDefault();
          const on = !d.clear.includes(k);
          d.clear = d.clear.filter((x) => x !== k); if (on) d.clear.push(k);
          row.classList.toggle('mg-cleared', on); clr.textContent = T(on ? 'mgKeep' : 'mgClearAll'); refresh();
        });
        row.append(clr);
      }
      form.append(row);
    }
    // מספור בסדרה — לפי השנה (מהישן לחדש)
    const ordered = mgSort(books).reverse();
    const sc = h('div', 'bk-card'); box.append(h('div', 'mg-lbl', T('edSeriesIdx')), sc);
    const seg = h('div', 'mg-seg');
    const prev = h('div', 'mg-prev');
    const startIn = h('input', 'ed-in mg-start'); startIn.type = 'number'; startIn.min = '0'; startIn.value = '1'; startIn.id = 'mgNumStart'; startIn.dir = 'ltr';
    const startRow = h('label', 'mg-startrow'); startRow.append(h('span', null, T('mgStartAt')), startIn);
    const paintNum = () => {
      startRow.hidden = !(d.num && typeof d.num === 'object');
      prev.textContent = d.num && typeof d.num === 'object' ? ordered.slice(0, 3).map((b, i) => (d.num.start + i) + ' · ' + (b.title || '')).join(' — ') + (n > 3 ? ' — …' : '') : '';
    };
    [['none', T('mgNumNone')], ['seq', T('mgNumSeq')], ['clear', T('mgNumClear')]].forEach(([val, label]) => {
      const b = h('button', 'mg-seg-b' + (val === 'none' ? ' on' : ''), label); b.type = 'button';
      b.addEventListener('click', () => {
        seg.querySelectorAll('.mg-seg-b').forEach((x) => x.classList.toggle('on', x === b));
        d.num = val === 'seq' ? { start: Math.max(0, +startIn.value || 1), step: 1 } : val === 'clear' ? 'clear' : null;
        paintNum(); refresh();
      });
      seg.append(b);
    });
    startIn.addEventListener('input', () => { if (d.num && typeof d.num === 'object') { d.num.start = Math.max(0, +startIn.value || 0); paintNum(); } });
    sc.append(seg, startRow, prev); paintNum();
    // תגיות
    const tc = h('div', 'bk-card mg-tokens'); box.append(h('div', 'mg-lbl', T('edTags')), tc);
    const paintTags = () => {
      tc.textContent = '';
      bv.tags.forEach(({ t, c, all }) => {
        const rm = d.tagsRm.includes(t), add = d.tagsAdd.includes(t);
        const b = h('button', 'mg-tok' + (all ? '' : ' part') + (rm ? ' rm' : '') + (add ? ' add' : ''), all ? t : T('mgTagPart', { t, c, n })); b.type = 'button'; b.dir = 'auto';
        b.addEventListener('click', () => env.sheet(t, (sh) => {
          const list = h('div', 'lib-ios');
          const row = (label, fn) => { const r = h('button', 'lib-row', label); r.type = 'button'; r.addEventListener('click', () => { env.closeSheetThen(sh.parentNode, () => {}); fn(); paintTags(); refresh(); }); list.append(r); };
          if (!all) row(T('mgTagAddAll', { n }), () => { d.tagsRm = d.tagsRm.filter((x) => x !== t); if (!d.tagsAdd.includes(t)) d.tagsAdd.push(t); });
          row(T('mgTagRmAll'), () => { d.tagsAdd = d.tagsAdd.filter((x) => x !== t); if (!d.tagsRm.includes(t)) d.tagsRm.push(t); });
          if (rm || add) row(T('mgKeep'), () => { d.tagsAdd = d.tagsAdd.filter((x) => x !== t); d.tagsRm = d.tagsRm.filter((x) => x !== t); });
          sh.append(list);
        }));
        tc.append(b);
      });
      d.tagsAdd.filter((t) => !bv.tags.some((x) => x.t === t)).forEach((t) => {
        const b = h('button', 'mg-tok add', t); b.type = 'button'; b.dir = 'auto';
        b.addEventListener('click', () => { d.tagsAdd = d.tagsAdd.filter((x) => x !== t); paintTags(); refresh(); });
        tc.append(b);
      });
      const ti = h('input', 'mg-tok-in'); ti.type = 'text'; ti.placeholder = '＋ ' + T('mgTag'); ti.dir = 'auto'; ti.id = 'mgTagIn';
      ti.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ',') return;
        e.preventDefault();
        const t = ti.value.replace(/,/g, ' ').trim(); if (!t) return;
        if (!d.tagsAdd.includes(t)) d.tagsAdd.push(t);
        d.tagsRm = d.tagsRm.filter((x) => x !== t);
        paintTags(); refresh();
        const again = root().querySelector('#mgTagIn'); if (again) again.focus();
      });
      tc.append(ti);
    };
    paintTags();
    const one = h('button', 'lib-row mg-onelink'); one.type = 'button';
    one.append(h('span', null, T('mgPerBook')), h('span', 'mg-chev', T('mgEditOne') + ' ‹'));
    one.addEventListener('click', () => env.goView({ mgr: 'one', ids: books.map((b) => b.id) }));
    const ol = h('div', 'lib-ios mg-pad'); ol.append(one); box.append(ol);
    cta.addEventListener('click', async () => {
      const ids = (d.num && typeof d.num === 'object' ? ordered : books).map((b) => b.id);
      const ops = bulkOps(ids, d); if (!ops.length) return;
      cta.disabled = true; cta.textContent = T('mgApplying');
      const r = await safe(() => apply(ops, T('mgUpdatedN', { n })));
      if (r) history.back(); else { cta.disabled = false; cta.textContent = T('mgApplyN', { n }); }
    });
    const foot = h('div', 'mg-foot'); foot.append(summary, cta); home.append(foot);
    refresh();
  }

  /* ================================================================ G — אחד־אחד */
  const LABELS = () => ({ title: T('edTitle'), subtitle: T('edSubtitle'), author: T('edAuthor'), authorSort: T('edAuthorSort'), pub: T('edPub'), date: T('edDate'),
    lang: T('edLang'), series: T('edSeries'), seriesIdx: T('edSeriesIdx'), isbn: T('edIsbn'), tags: T('edTags'), desc: T('edDesc') });
  const LTR = new Set(['date', 'lang', 'seriesIdx', 'isbn']);
  async function renderOne(v) {
    const home = page();
    try { await loadCat(); } catch (e) { errBox(home, e); return; }
    const ids = (v.ids || []).filter((id) => byId(id));
    if (!ids.length) { history.back(); return; }
    const key = ids.join('|');
    if (ONE.key !== key) { ONE.key = key; ONE.i = 0; }
    ONE.i = Math.max(0, Math.min(ids.length - 1, ONE.i));
    const b = byId(ids[ONE.i]);
    const inputs = {};
    const save = async () => {
      const f = {}, pv = {};
      for (const k of MG_FIELDS) { const val = inputs[k].value.trim(); if (val !== String(b[k] || '')) { f[k] = val; pv[k] = String(b[k] || ''); } }
      if (!Object.keys(f).length) return true;
      const r = await safe(() => apply([{ op: 'set', id: b.id, f, pv }]));
      if (r) { const s = root().querySelector('.mg-saved'); if (s) { s.hidden = false; setTimeout(() => { s.hidden = true; }, 1200); } }
      return !!r;
    };
    const go = async (i) => { if (await save()) { ONE.i = i; renderOne(v); root().scrollTop = 0; } };
    const done = textBtn(T('mgDoneBtn'), async () => { if (await save()) history.back(); });
    const title = h('span', null, ids.length > 1 ? T('mgIofN', { i: ONE.i + 1, n: ids.length }) : (b.title || ''));
    const saved = h('span', 'mg-saved', '✓ ' + T('mgSaved')); saved.hidden = true;
    const tbar = topBar(done, [], ''); tbar.querySelector('.mg-tt').append(title, saved);
    home.append(tbar);
    const box = h('div', 'mg'); home.append(box);
    if (ids.length > 1) {
      const strip = h('div', 'mg-strip no-swipe');
      ids.forEach((id, i) => {
        const x = byId(id); const c = h('button', 'mg-sc' + (i === ONE.i ? ' cur' : '')); c.type = 'button';
        c.append(cvEl(x, 'sm'), h('span', 'mg-dot' + (needs(x).some((n) => n === 'cover' || n === 'author') ? ' w' : '')));
        c.setAttribute('aria-label', x.title || '');
        c.addEventListener('click', () => go(i));
        strip.append(c);
      });
      box.append(strip);
      ensureCovers(ids.map(byId));
      setTimeout(() => { const cur = strip.querySelector('.cur'); if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest', inline: 'center' }); }, 0);
    }
    const sg = h('button', 'lib-row mg-sugrow'); sg.type = 'button';
    const sgi = h('span', 'mg-ico p'); sgi.innerHTML = IC.spark;
    sg.append(sgi, h('span', 'mg-rt', T('mgSugOne')), h('span', 'mg-chev', '‹'));
    sg.addEventListener('click', async () => { if (await save()) env.goView({ mgr: 'sug', ids: [b.id] }); });
    const sgl = h('div', 'lib-ios mg-pad0'); sgl.append(sg); box.append(sgl);
    // מצב: פורסם / טיוטה / מוסתר
    const seg = h('div', 'mg-seg mg-stseg');
    [['pub', T('mgStPub')], ['draft', T('mgStDraft')], ['hide', T('mgStHide')]].forEach(([s, label]) => {
      const x = h('button', 'mg-seg-b' + (b.st === s ? ' on' : ''), label); x.type = 'button';
      x.addEventListener('click', async () => { if (b.st === s) return; if (await save()) { await safe(() => apply([{ op: 'state', ids: [b.id], st: s }])); renderOne(v); } });
      seg.append(x);
    });
    box.append(seg);
    // כריכה
    const cvb = h('div', 'mg-cvbox'); cvb.append(cvEl(b, 'lg'));
    const cvAct = h('div', 'mg-cvact');
    const pick = h('label', 'mini-btn'); pick.append(h('span', null, T(b.cover ? 'mgCoverChange' : 'mgCoverAdd')));
    const fin = h('input'); fin.type = 'file'; fin.accept = 'image/*';
    fin.addEventListener('change', async () => {
      const f = fin.files && fin.files[0]; fin.value = ''; if (!f) return;
      pick.classList.add('busy');
      try {
        const c = await env.coverFromBlob(f, 600);
        if (!c) throw new Error('img');
        const pl = await api('upPlan', { items: [{ k: 'c', size: c.blob.size }] });
        await putFile(pl.items[0].url, c.blob);
        await api('upCommit', { rid: rid(), items: [{ u: pl.items[0].u, k: 'c', id: b.id, r: c.w / c.h, src: 'user' }] });
        await loadCat(true); flash(T('mgCoverDone')); renderOne(v);
      } catch (e) { flash(T('edCoverErr')); }
      pick.classList.remove('busy');
    });
    pick.append(fin); cvAct.append(pick);
    if (!b.cover) cvAct.append(h('span', 'mg-miss', T('mgMissing')));
    cvb.append(cvAct); box.append(cvb);
    ensureCovers([b]);
    // השדות
    const form = h('div', 'bk-card ed-form');
    const L = LABELS();
    for (const k of MG_FIELDS) {
      const row = h('label', 'ed-row');
      const lab = h('span', 'ed-lbl', L[k]);
      if ((k === 'author' && !b.author)) lab.append(h('span', 'mg-miss', T('mgMissing')));
      if (b.lock && b.lock.includes(k)) lab.append(h('span', 'mg-lock', ' · ' + T('mgLocked')));
      row.append(lab);
      const inp = h(k === 'desc' ? 'textarea' : 'input', 'ed-in');
      if (k !== 'desc') inp.type = 'text';
      inp.dir = LTR.has(k) ? 'ltr' : 'auto'; inp.id = 'mgF' + k;
      inp.value = String(b[k] || '');
      inputs[k] = inp; row.append(inp); form.append(row);
    }
    box.append(form);
    if (b.files && b.files[0]) { const fm = h('p', 'mg-fileinfo', b.files[0].fmt.toUpperCase() + ' · ' + mb(b.files[0].size)); fm.dir = 'ltr'; box.append(fm); }
    const nav = h('div', 'mg-foot mg-nav');
    if (ids.length > 1) {
      const pv = textBtn('→ ' + T('mgPrev'), () => go(ONE.i - 1), 'o'); pv.disabled = ONE.i === 0;
      const nx = ONE.i < ids.length - 1 ? textBtn(T('mgNext') + ' ←', () => go(ONE.i + 1), 'p') : textBtn(T('mgDoneBtn'), async () => { if (await save()) history.back(); }, 'p');
      nav.append(pv, nx);
    } else nav.append(textBtn(T('edSave'), async () => { if (await save()) { flash(T('edSaved')); history.back(); } }, 'p'));
    home.append(nav);
  }

  /* ================================================================ יומן שינויים */
  async function renderHist() {
    const home = page();
    home.append(topBar(backBtn(T('mgTitle'))), h('h1', 'lib-large', T('mgHist')));
    try { await loadCat(true); } catch (e) { errBox(home, e); return; }
    const box = h('div', 'mg'); home.append(box);
    const list = h('div', 'mg-list');
    const KIND = (k) => ({ set: T('mgKSet'), bulk: T('mgKBulk'), state: T('mgKState'), del: T('mgKDel'), restore: T('mgKRestore'), purge: T('mgKPurge'),
      rename: T('mgKRename'), merge: T('mgKMerge'), add: T('mgKAdd'), file: T('mgKFile'), cover: T('mgKCover'), cfg: T('mgKCfg'), undo: T('mgKUndo'), multi: T('mgKMulti'), note: T('mgKNote'), lock: T('mgKLock') })[k] || k;
    const loc = document.documentElement.lang === 'en' ? 'en-GB' : 'he-IL';
    CAT.hist.slice().reverse().forEach((x) => {
      const r = h('div', 'mg-row');
      const t = h('div', 'mg-rt');
      t.append(h('div', 'mg-t1 one', x.k === 'cfg' ? KIND(x.k) : KIND(x.k) + ' · ' + nb(x.n || (x.ids || []).length)));
      const when = x.at ? new Date(x.at).toLocaleString(loc, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
      const t2 = h('div', 'mg-t2', [when, (x.ids || []).slice(0, 2).map((id) => (byId(id) || {}).title || '').filter(Boolean).join(', ')].filter(Boolean).join(' · ')); t2.dir = 'auto';
      t.append(t2); r.append(t);
      if (x.undo && x.k !== 'cfg') r.append(textBtn(T('mgUndo'), () => env.askConfirm(T('mgUndoQ'), () => undoV(x.v), { ok: T('mgUndo') }), 'mini'));
      list.append(r);
    });
    if (!CAT.hist.length) list.append(h('p', 'lib-empty', T('admNone')));
    box.append(list);
  }

  /* ================================================================ המעבר מ־Drive */
  const MIG = { run: false, log: null, hideAll: false };
  async function renderMig() {
    const home = page();
    home.append(topBar(backBtn(T('mgTitle'))), h('h1', 'lib-large', T('mgMigT')));
    const box = h('div', 'mg'); home.append(box);
    let plan;
    try { await loadCat(true); plan = await api('migratePlan'); } catch (e) { errBox(home, e); return; }
    const local = await env.allBooksRaw();
    const pending = plan.items.filter((x) => !x.c);
    const hidden = local.filter((b) => b.src === 'drive' && b.hidden && pending.some((p) => p.id === b.driveId)).length;
    const card = h('div', 'bk-card mg-pad');
    card.append(h('p', 'mg-mig-n', T('mgMigStat', { n: plan.items.length, m: plan.items.length - pending.length })));
    card.append(h('p', 'mg-t2 wrap', T(plan.src === 'r2' ? 'mgMigLive' : 'mgMigWhy')));
    box.append(card);
    if (hidden && pending.length) {
      const opts = h('div', 'lib-ios mg-opts');
      const pr = h('label', 'lib-row'); pr.append(h('span', null, T('mgMigHide', { n: hidden })));
      const sw = h('input', 'mg-switch'); sw.type = 'checkbox'; sw.checked = MIG.hideAll; sw.id = 'mgMigHide';
      sw.addEventListener('change', () => { MIG.hideAll = sw.checked; });
      pr.append(sw); opts.append(pr); box.append(opts);
    }
    const prog = h('div', 'bk-card mg-qhead'); prog.hidden = !MIG.run;
    const rw = h('div', 'mg-ringw'); const ptx = h('div', 'mg-big', ''); rw.append(env.ring(0), ptx); prog.append(rw); box.append(prog);
    const out = h('div', 'mg-mig-out'); box.append(out);
    if (MIG.log) out.append(migReport(MIG.log));
    if (pending.length) {
      const go = h('button', 'bk-cta mg-cta', T('mgMigGo', { n: pending.length })); go.type = 'button'; go.disabled = MIG.run;
      go.addEventListener('click', async () => {
        if (MIG.run) return;
        MIG.run = true; go.disabled = true; prog.hidden = false;
        const step = (txt, frac) => { ptx.textContent = txt; const rg = prog.querySelector('.ac-ring'); if (rg) rg.replaceWith(env.ring(frac)); };
        const log = { done: 0, skip: 0, dup: [], bad: [], missing: [], nolocal: [], covers: 0 };
        try {
          step(T('mgMigSync'), 0);
          await env.syncDrive();
          const pl = await api('migratePlan');
          const all = await env.allBooksRaw();
          const { items, nolocal } = migrateItems(all, pl.items, MIG.hideAll);
          log.nolocal = nolocal;
          const parts = chunk(items, 40);
          for (let i = 0; i < parts.length; i++) {
            step(T('mgMigCopy', { i: Math.min(items.length, (i + 1) * 40), n: items.length }), (i + 1) / (parts.length + 1));
            const j = await api('migrateCommit', { rid: rid(), items: parts[i] });
            log.done += j.done.length; log.skip += j.skip.length;
            log.dup.push(...j.dup); log.bad.push(...j.bad); log.missing.push(...j.missing);
          }
          // כריכות: מהרשומה בטלפון (מהקובץ או אישית) — רק לספרים שעברו ואין להם עדיין כריכה במדף
          await loadCat(true);
          const need = all.filter((r) => r.src === 'drive' && r.cover instanceof Blob && byId(r.id) && !byId(r.id).cover);
          const cparts = chunk(need, 20);
          for (let i = 0; i < cparts.length; i++) {
            step(T('mgMigCovers', { i: Math.min(need.length, (i + 1) * 20), n: need.length }), (parts.length + (i + 1) / cparts.length) / (parts.length + 1));
            const pl2 = await api('upPlan', { items: cparts[i].map((r) => ({ k: 'c', size: r.cover.size })) });
            const commit = [];
            await Promise.all(cparts[i].map(async (r, k) => {
              const u = pl2.items[k]; if (!u || !u.u) return;
              try { await putFile(u.url, r.cover); commit.push({ u: u.u, k: 'c', id: r.id, r: r.coverRatio || 0.667, src: r.coverCustom ? 'user' : 'file' }); } catch (e) {}
            }));
            if (commit.length) { const cj = await api('upCommit', { rid: rid(), items: commit }); log.covers += cj.done.length; }
          }
          step(T('mgMigDone'), 1);
        } catch (e) { log.err = String((e && e.message) || e).slice(0, 40); }
        MIG.run = false; MIG.log = log;
        renderMig();
      });
      box.append(go);
    }
    if (plan.src !== 'r2' && plan.items.length && !pending.length) {
      const fin = h('button', 'bk-cta mg-cta', T('mgMigFinish')); fin.type = 'button';
      fin.addEventListener('click', () => env.askConfirm(T('mgMigFinishQ'), async () => {
        const r = await safe(() => api('migrateFinish', { rid: rid() }));
        if (r) { flash(T('mgMigFinished')); await loadCat(true); renderMig(); }
      }, { ok: T('mgMigFinishOk') }));
      box.append(fin);
    }
    if (plan.src === 'r2') {
      const back = h('button', 'lib-admin-link mg-danger', T('mgMigBack')); back.type = 'button';
      back.addEventListener('click', () => env.askConfirm(T('mgMigBackQ'), async () => {
        const r = await safe(() => api('migrateFinish', { rid: rid(), back: true }));
        if (r) { flash(T('mgMigBacked')); renderMig(); }
      }, { danger: true, ok: T('mgMigBackOk') }));
      box.append(back);
    }
  }
  function migReport(log) {
    const c = h('div', 'bk-card mg-pad');
    if (log.err) c.append(h('p', 'mg-t2 w', T('mgMigErr')));
    c.append(h('p', null, T('mgMigRes', { n: log.done, s: log.skip, c: log.covers })));
    const bad = log.dup.length + log.bad.length + log.missing.length + log.nolocal.length;
    if (bad) {
      const d = h('details', 'mg-fold'); d.append(h('summary', null, T('mgMigProblems', { n: bad })));
      const ul = h('ul', 'mg-ul');
      log.dup.forEach((x) => ul.append(h('li', null, T('mgMigDup', { d: x.d }))));
      log.bad.forEach((x) => ul.append(h('li', null, T('mgMigBad', { d: x.d }))));
      log.missing.concat(log.nolocal).forEach((x) => ul.append(h('li', null, T('mgMigMiss', { d: x }))));
      d.append(ul); c.append(d);
    }
    return c;
  }

  /* ================================================================ H — הצעות מהמאגרים (ס׳6)
     השרתון מחפש בספרייה הלאומית, Google Books ו־Open Library (Apple — רק באנגלית), ומחזיר לכל ספר ציון ביטחון ושדות.
     ודאי (≥0.9) — אפשר להשלים בבת אחת, **רק שדות ריקים**; כל השאר — השוואה שדה־שדה. שום ערך קיים לא נדרס בלי אישור. */
  const SUG = { key: '', res: new Map(), i: 0, busy: false, done: { ok: 0, no: 0 } };
  const SUG_FIELDS = ['title', 'subtitle', 'author', 'pub', 'date', 'lang', 'isbn', 'series', 'seriesIdx', 'tags', 'desc'];
  const SRCL = (x) => ({ nli: T('srcNli'), google: T('srcGoogle'), ol: T('srcOpenlibrary'), apple: T('srcApple') })[x] || x;
  async function sugFetch(books, onProg) {
    const tk = await env.idToken();
    for (let i = 0; i < books.length; i += 5) {
      const part = books.slice(i, i + 5);
      let j = null;
      try {
        const r = await env.meta({ op: 'match', idToken: tk, books: part.map((b) => ({ key: b.id, title: b.title, author: b.author, isbn: b.isbn, lang: b.lang, date: b.date, pub: b.pub })) });
        j = await r.json();
      } catch (e) { j = null; }
      if (!j || !j.ok) throw new Error((j && j.error) || 'net');
      for (const x of j.results) SUG.res.set(x.key, x);
      if (onProg) onProg(Math.min(books.length, i + 5), books.length);
    }
  }
  const emptyFill = (b, x) => {                 // רק שדות ריקים בספר, לפי המקור של כל שדה
    const by = {};
    for (const k of SUG_FIELDS) if (!String(b[k] || '').trim() && x.f[k] && !(b.lock || []).includes(k)) (by[x.prov[k] || x.src] = by[x.prov[k] || x.src] || {})[k] = x.f[k];
    return Object.entries(by).map(([src, f]) => ({ op: 'set', id: b.id, f, src }));
  };
  async function sugCover(b, url, src) {
    const r = await env.meta({ op: 'cover', url });
    if (!r.ok || !/^image\//.test(r.headers.get('content-type') || '')) throw new Error('cover');
    const c = await env.coverFromBlob(await r.blob(), 600);
    if (!c) throw new Error('img');
    const pl = await api('upPlan', { items: [{ k: 'c', size: c.blob.size }] });
    await putFile(pl.items[0].url, c.blob);
    await api('upCommit', { rid: rid(), items: [{ u: pl.items[0].u, k: 'c', id: b.id, r: c.w / c.h, src }] });
  }
  async function renderSug(v) {
    const home = page();
    home.append(topBar(textBtn(T('mgClose'), () => history.back()), [], T('mgSugT')));
    const box = h('div', 'mg'); home.append(box);
    try { await loadCat(); } catch (e) { errBox(home, e); return; }
    const books = (v.ids || []).map(byId).filter((b) => b && !b.del);
    if (!books.length) { history.back(); return; }
    const key = books.map((b) => b.id).join('|');
    if (SUG.key !== key) { SUG.key = key; SUG.res = new Map(); SUG.i = 0; SUG.done = { ok: 0, no: 0 }; }
    const missing = books.filter((b) => !SUG.res.has(b.id));
    if (missing.length) {
      if (SUG.busy) return;
      const card = h('div', 'bk-card mg-qhead');
      const rw = h('div', 'mg-ringw'); const tx = h('div', 'mg-big', T('mgSugSearching', { i: 0, n: missing.length }));
      rw.append(env.ring(0), tx); card.append(rw); box.append(card);
      SUG.busy = true;
      try {
        await sugFetch(missing, (i, n) => { tx.textContent = T('mgSugSearching', { i, n }); const rg = card.querySelector('.ac-ring'); if (rg) rg.replaceWith(env.ring(i / n)); });
      } catch (e) {
        SUG.busy = false; box.textContent = '';
        const c = h('div', 'bk-card mg-pad'); c.append(h('p', null, T(String(e.message) === 'not_admin' ? 'mgErr' : 'mgSugErr')), textBtn(T('mgRetry'), () => renderSug(v), 'mini')); box.append(c);
        return;
      }
      SUG.busy = false;
      if (env.ui.view && env.ui.view.mgr === 'sug') renderSug(v);
      return;
    }
    const R = books.map((b) => ({ b, x: SUG.res.get(b.id) }));
    const auto = R.filter((r) => r.x.bucket === 'auto'), rev = R.filter((r) => r.x.bucket === 'review'), none = R.filter((r) => r.x.bucket === 'none');
    const fillable = auto.map((r) => emptyFill(r.b, r.x)).filter((o) => o.length);
    const sum = h('div', 'bk-card mg-pad');
    sum.append(h('p', 'mg-sugsum', T('mgSugSum', { a: auto.length, r: rev.length, n: none.length })));
    if (fillable.length) {
      const nF = fillable.reduce((t, o) => t + o.reduce((u, op) => u + Object.keys(op.f).length, 0), 0);
      const fb = h('button', 'bk-cta mg-cta-in', T('mgSugFill', { n: fillable.length })); fb.type = 'button';
      fb.addEventListener('click', async () => {
        fb.disabled = true;
        const ops = fillable.flat();
        let k = 0;
        for (const part of chunk(ops, 50)) { const r = await safe(() => apply(part, null)); if (r) k += r.n || 0; }
        snack(T('mgSugFilled', { n: fillable.length, f: nF }));
        renderSug(v);
      });
      sum.append(h('p', 'mg-t2 wrap', T('mgSugFillS', { f: nF })), fb);
    }
    box.append(sum);
    // הסקירה: ספר אחרי ספר (קודם "לבדיקה", אחר כך ודאיים עם הבדלים)
    const queue = rev.concat(auto).filter((r) => SUG_FIELDS.some((k) => r.x.f[k] && String(r.x.f[k]) !== String(r.b[k] || '')) || (r.x.covers.length && !r.b.cover));
    if (!queue.length) {
      box.append(h('p', 'lib-empty', none.length === books.length ? T('mgSugNone') : T('mgSugAllDone')));
      return;
    }
    SUG.i = Math.min(SUG.i, queue.length - 1);
    const { b, x } = queue[SUG.i];
    const card = h('div', 'bk-card mg-sugcard');
    card.append(h('div', 'mg-lbl', T('mgIofN', { i: SUG.i + 1, n: queue.length })));
    // כריכות: עכשיו / מוצע
    let coverPick = !b.cover && x.covers.length ? 0 : -1;
    const pair = h('div', 'mg-pair');
    const cur = h('button', 'mg-pc'); cur.type = 'button'; cur.append(cvEl(b, 'lg'), h('span', null, T('mgCur')));
    pair.append(cur);
    const sugEls = [];
    x.covers.slice(0, 2).forEach((c, i) => {
      const el = h('button', 'mg-pc'); el.type = 'button';
      const cv = h('div', 'mg-cv lg mg-img'); const im = document.createElement('img'); im.alt = ''; im.loading = 'lazy';
      env.meta({ op: 'cover', url: c.url }).then((r) => (r.ok ? r.blob() : null)).then((bl) => { if (bl) im.src = URL.createObjectURL(bl); else el.remove(); }).catch(() => el.remove());
      cv.append(im); el.append(cv, h('span', null, SRCL(c.src)));
      el.addEventListener('click', () => { coverPick = coverPick === i ? -1 : i; paintPick(); });
      sugEls.push(el); pair.append(el);
    });
    const paintPick = () => { cur.classList.toggle('pick', coverPick < 0); sugEls.forEach((el, i) => el.classList.toggle('pick', coverPick === i)); };
    cur.addEventListener('click', () => { coverPick = -1; paintPick(); });
    paintPick(); card.append(pair); ensureCovers([b]);
    const head = h('div', 'mg-sughead');
    const conf = h('span', 'mg-conf ' + (x.bucket === 'auto' ? 'g' : 'w'), (x.bucket === 'auto' ? '✓ ' + T('mgConfSure') : '◐ ' + T('mgConfLikely')));
    conf.title = x.why.join(' · ');
    conf.setAttribute('aria-label', conf.textContent + ' — ' + x.why.join(', '));
    head.append(h('span', null, SRCL(x.src) + (x.f.date ? ' · ' + String(x.f.date).slice(0, 4) : '')), conf);
    card.append(head);
    // שדה־שדה: רק מה ששונה
    const L = LABELS(), pick = {};
    const list = h('div', 'mg-sugfields');
    for (const k of SUG_FIELDS) {
      const now = String(b[k] || ''), sv = String(x.f[k] || '');
      if (!sv || sv === now) continue;
      pick[k] = now ? 'cur' : 'sug';                  // ריק — המוצע; קיים — נשאר, אלא אם בוחרים
      const g = h('div', 'mg-fg'); g.append(h('div', 'mg-lbl', L[k]));
      const opt = (val, which, label) => {
        const o = h('button', 'mg-opt'); o.type = 'button';
        const t = h('span', 'mg-ov', val || T('mgEmpty')); t.dir = 'auto'; if (!val) t.classList.add('dim');
        o.append(h('span', 'mg-rad'), t, h('span', 'mg-ob', label));
        o.addEventListener('click', () => { pick[k] = which; g.querySelectorAll('.mg-opt').forEach((z) => z.classList.toggle('on', z === o)); });
        if (pick[k] === which) o.classList.add('on');
        return o;
      };
      g.append(opt(sv, 'sug', T('mgSuggested')), opt(now, 'cur', T('mgCur')));
      list.append(g);
    }
    card.append(list);
    box.append(card);
    const next = () => { SUG.i++; renderSug(v); root().scrollTop = 0; };
    const nav = h('div', 'mg-foot mg-nav');
    nav.append(textBtn(T('mgReject'), () => { SUG.done.no++; SUG.res.set(b.id, Object.assign({}, x, { f: {}, covers: [] })); renderSug(v); }, 'o'));
    nav.append(textBtn(T('mgAccept'), async () => {
      const by = {};
      for (const k of Object.keys(pick)) if (pick[k] === 'sug') (by[x.prov[k] || x.src] = by[x.prov[k] || x.src] || {})[k] = x.f[k];
      const ops = Object.entries(by).map(([src, f]) => ({ op: 'set', id: b.id, f, src }));
      if (ops.length) await safe(() => apply(ops, T('mgUpdatedN', { n: 1 })));
      if (coverPick >= 0) { try { await sugCover(b, x.covers[coverPick].url, x.covers[coverPick].src); await loadCat(true); } catch (e) { flash(T('edCoverErr')); } }
      SUG.done.ok++;
      SUG.res.set(b.id, Object.assign({}, x, { f: {}, covers: [] }));
      renderSug(v);
    }, 'p'));
    home.append(nav);
    if (x.alts && x.alts.length) {
      const d = h('details', 'mg-fold'); d.append(h('summary', null, T('mgAlts', { n: x.alts.length })));
      const ul = h('div', 'mg-list');
      x.alts.forEach((a) => { const r = h('div', 'mg-row'); const t = h('div', 'mg-rt'); const t1 = h('div', 'mg-t1 one', a.title); t1.dir = 'auto'; const t2 = h('div', 'mg-t2', [a.authors.join(', '), a.year || '', SRCL(a.src)].filter(Boolean).join(' · ')); t2.dir = 'auto'; t.append(t1, t2); r.append(t); ul.append(r); });
      d.append(ul); box.append(d);
    }
  }

  /* ================================================================ I — כפילויות (ס׳7) */
  const LS_DUPX = 'pwa_libdupx_v1';
  const dupDismissed = () => { try { return JSON.parse(localStorage.getItem(LS_DUPX) || '[]') || []; } catch (e) { return []; } };
  const dupDismiss = (a, b) => { try { const x = dupDismissed(); x.push([a, b].sort().join('|')); localStorage.setItem(LS_DUPX, JSON.stringify(x.slice(-500))); } catch (e) {} };
  async function renderDup() {
    const home = page();
    home.append(topBar(backBtn(T('mgTitle'))), h('h1', 'lib-large', T('mgChipDup')));
    try { await loadCat(); } catch (e) { errBox(home, e); return; }
    const box = h('div', 'mg'); home.append(box);
    box.append(h('p', 'mg-t2 wrap', T('mgDupWhy')));
    const groups = dupGroups(CAT.books, dupDismissed());
    if (!groups.length) { const d = h('div', 'mg-empty'); d.append(h('div', 'mg-ok56', '✓'), h('b', null, T('mgDupNone'))); box.append(d); return; }
    const loc = document.documentElement.lang === 'en' ? 'en-GB' : 'he-IL';
    for (const g of groups) {
      const keep = g[0];
      for (const other of g.slice(1)) {
        const card = h('div', 'bk-card mg-pad mg-dupcard');
        const cols = h('div', 'mg-dup');
        for (const [b, isKeep] of [[keep, true], [other, false]]) {
          const c = h('div', 'mg-dupcol');
          c.append(cvEl(b, 'md'));
          const t1 = h('b', null, b.title || '—'); t1.dir = 'auto';
          const f = b.files && b.files[0];
          c.append(t1, h('span', null, b.author || ''), h('span', 'ltr', f ? f.fmt.toUpperCase() + ' · ' + mb(f.size) : ''),
            h('span', null, isKeep ? T('mgDupSince', { d: new Date(b.added || 0).toLocaleDateString(loc) }) : T('mgDupLater', { d: new Date(b.added || 0).toLocaleDateString(loc) })));
          if (isKeep) c.append(h('span', 'mg-tag g', T('mgDupKeep')));
          cols.append(c);
        }
        card.append(cols);
        const btns = h('div', 'mg-btns');
        btns.append(textBtn(T('mgMerge'), async () => {
          const r = await safe(() => apply([{ op: 'merge', keep: keep.id, drop: other.id }], T('mgMerged')));
          if (r) renderDup();
        }, 'p'));
        btns.append(textBtn(T('mgNotDup'), () => { dupDismiss(keep.id, other.id); renderDup(); }, 'o'));
        card.append(btns);
        box.append(card);
      }
    }
    ensureCovers(groups.flat());
  }

  /* ================================================================ מנהל הערכים (ס׳7): שינוי שם בכל הספרייה, מיזוג כתיב */
  async function renderVals(v) {
    const k = ['author', 'series', 'pub', 'tag'].includes(v.k) ? v.k : 'author';
    const TITLE = { author: T('mgValsAuthor'), series: T('mgValsSeries'), pub: T('mgValsPub'), tag: T('mgValsTag') }[k];
    const home = page();
    home.append(topBar(backBtn(T('mgTitle'))), h('h1', 'lib-large', TITLE));
    try { await loadCat(); } catch (e) { errBox(home, e); return; }
    const box = h('div', 'mg'); home.append(box);
    const list = valueList(CAT.books, k);
    const rename = (from) => env.sheet(from, (sh) => {
      const wrap = h('div', 'mg-renamebox');
      const inp = h('input', 'ed-in'); inp.type = 'text'; inp.value = from; inp.dir = 'auto'; inp.id = 'mgRename';
      const cnt = (list.find((x) => x.v === from) || {}).n || 0;
      const go = h('button', 'bk-cta', cnt === 1 ? T('mgRenameOne') : T('mgRenameAll', { n: cnt })); go.type = 'button';
      go.addEventListener('click', () => {
        const to = inp.value.trim();
        if (!to || to === from) return;
        env.closeSheetThen(sh.parentNode, async () => { const r = await safe(() => apply([{ op: 'rename', k, from, to }], T('mgRenamed'))); if (r) renderVals(v); });
      });
      const merge = list.some((x) => x.v !== from) ? h('p', 'mg-t2 wrap', T('mgRenameHint')) : null;
      wrap.append(inp, go); if (merge) wrap.append(merge);
      sh.append(wrap);
      setTimeout(() => { try { inp.focus(); inp.select(); } catch (e) {} }, 50);
    });
    const cl = valueClusters(list);
    if (cl.length) {
      const c = h('div', 'bk-card mg-pad');
      c.append(h('b', null, T('mgValsSame', { n: cl.length })));
      for (const g of cl.slice(0, 20)) {
        const r = h('div', 'mg-valsame');
        const most = g.slice().sort((a, b) => b.n - a.n)[0];
        const t = h('span', 'mg-rt', g.map((x) => x.v + ' (' + x.n + ')').join(' · ')); t.dir = 'auto';
        r.append(t, textBtn(T('mgValsJoin', { v: most.v }), async () => {
          const ops = g.filter((x) => x !== most).map((x) => ({ op: 'rename', k, from: x.v, to: most.v }));
          const res = await safe(() => apply(ops, T('mgRenamed'))); if (res) renderVals(v);
        }, 'mini'));
        c.append(r);
      }
      box.append(c);
    }
    const ul = h('div', 'mg-list');
    if (!list.length) ul.append(h('p', 'lib-empty', T('admNone')));
    list.forEach((x) => {
      const r = h('button', 'mg-row'); r.type = 'button';
      const t = h('div', 'mg-rt'); const t1 = h('div', 'mg-t1 one', x.v); t1.dir = 'auto'; t.append(t1);
      r.append(t, h('span', 'mg-fmt', String(x.n)), h('span', 'mg-chev', '‹'));
      r.addEventListener('click', () => rename(x.v));
      ul.append(r);
    });
    box.append(ul);
  }

  /* ================================================================ פרויקט בן־יהודה (ס׳8): רשות הרבים בעברית */
  const BYS = { q: '', g: '', res: null, sel: new Set(), seq: 0 };
  const BY_G = ['מכתבים', 'מאמרים', 'פרוזה', 'שירה', 'זכרונות', 'מחזות', 'עיון', 'משלים'];
  function renderBy() {
    const home = page();
    home.append(topBar(backBtn(T('mgTitle'))), h('h1', 'lib-large', T('mgAddBy')));
    const box = h('div', 'mg'); home.append(box);
    box.append(h('p', 'mg-t2 wrap', T('mgByWhy')));
    const sw = h('div', 'lib-search mg-search'); sw.innerHTML = ICON.search || '';
    const inp = h('input'); inp.type = 'search'; inp.placeholder = T('mgByPh'); inp.value = BYS.q; inp.id = 'mgByQ';
    sw.append(inp); box.append(sw);
    const chips = h('div', 'lib-chips no-swipe mg-chips');
    [''].concat(BY_G).forEach((g) => {
      const c = h('button', 'lib-chip' + (BYS.g === g ? ' on' : ''), g || T('learnAll')); c.type = 'button';
      c.addEventListener('click', () => { BYS.g = g; chips.querySelectorAll('.lib-chip').forEach((x) => x.classList.toggle('on', x === c)); run(); });
      chips.append(c);
    });
    box.append(chips);
    const info = h('p', 'mg-sum', ''); box.append(info);
    const list = h('div', 'mg-list'); box.append(list);
    const cta = h('button', 'bk-cta mg-cta'); cta.type = 'button';
    const paintCta = () => { cta.textContent = BYS.sel.size === 1 ? T('mgByAddOne') : BYS.sel.size ? T('mgByAdd', { n: BYS.sel.size }) : T('mgNoneSel'); cta.disabled = !BYS.sel.size; };
    cta.addEventListener('click', () => byImport(Array.from(BYS.sel)));
    home.append(cta);
    const paint = () => {
      list.textContent = '';
      const r = BYS.res;
      if (!r) { info.textContent = ''; paintCta(); return; }
      info.textContent = r.total > r.items.length ? T('mgByMany', { n: r.items.length, t: r.total }) : T('mgByN', { n: r.total });
      if (r.items.length) {
        const all = r.items.every((x) => BYS.sel.has(x.id));
        const sa = h('button', 'mg-tb mini mg-selall', T(all ? 'mgSelNone' : 'mgSelAll')); sa.type = 'button';
        sa.addEventListener('click', () => { r.items.forEach((x) => (all ? BYS.sel.delete(x.id) : BYS.sel.add(x.id))); paint(); });
        info.append(' · ', sa);
      }
      r.items.forEach((x) => {
        const on = BYS.sel.has(x.id);
        const row = h('button', 'mg-row' + (on ? ' sel' : '')); row.type = 'button'; row.setAttribute('aria-pressed', on ? 'true' : 'false');
        row.append(h('span', 'mg-ck' + (on ? ' on' : ''), on ? '✓' : ''));
        const t = h('div', 'mg-rt'); const t1 = h('div', 'mg-t1', x.t); t1.dir = 'auto';
        const t2 = h('div', 'mg-t2', [x.a, x.tr ? T('mgByTr', { t: x.tr }) : '', x.g].filter(Boolean).join(' · ')); t2.dir = 'auto';
        t.append(t1, t2); row.append(t);
        row.addEventListener('click', () => { if (BYS.sel.has(x.id)) BYS.sel.delete(x.id); else if (BYS.sel.size < 200) BYS.sel.add(x.id); paint(); });
        list.append(row);
      });
      paintCta();
    };
    let tm = 0;
    const run = async () => {
      const q = inp.value.trim(); BYS.q = q;
      if (q.length < 2) { BYS.res = null; paint(); return; }
      const seq = ++BYS.seq;
      info.textContent = T('mgBySearching');
      try { const j = await api('byFind', { q, g: BYS.g }); if (seq === BYS.seq) { BYS.res = j; paint(); } }
      catch (e) { if (seq === BYS.seq) info.textContent = T('mgSugErr'); }
    };
    inp.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(run, 350); });
    if (BYS.q && !BYS.res) run(); else paint();
  }
  async function byImport(ids) {
    if (IMP && IMP.stage === 'queue') { flash(T('mgBusy')); return; }
    IMP = { stage: 'read', items: [], pub: false, added: [], read: 0, fetching: ids.length };
    env.goView({ mgr: 'imp' });
    const titles = new Map(((BYS.res && BYS.res.items) || []).map((x) => [x.id, x.t]));
    const got = [];
    for (const part of chunk(ids, 5)) {
      let j = null;
      try { j = await api('byAdd', { ids: part }); } catch (e) { j = { items: part.map((id) => ({ id, err: 'net' })) }; }
      for (const x of j.items) {
        const name = (titles.get(x.id) || String(x.id)).replace(/[\\/:*?"<>|]/g, ' ').slice(0, 80) + '.epub';
        if (x.err || !/^https:\/\/[a-z0-9.-]+\.r2\.cloudflarestorage\.com\//.test(String(x.url))) { got.push({ name, size: 0, ext: 'epub', err: 'open' }); continue; }
        try { const r = await fetch(x.url); if (!r.ok) throw new Error('dl'); const bl = await r.blob(); got.push({ file: new File([bl], name, { type: 'application/epub+zip' }), name, size: bl.size, ext: 'epub', pre: { u: x.u } }); }
        catch (e) { got.push({ name, size: 0, ext: 'epub', err: 'open' }); }
      }
      if (IMP) { IMP.fetched = got.length; paintImp(); }
    }
    BYS.sel.clear();
    IMP = null;
    return startImport(got);
  }

  /* ================================================================ ניתוב */
  function render(v) {
    if (v.mgr === 'imp') return renderImp();
    if (v.mgr === 'bulk') return renderBulk(v);
    if (v.mgr === 'one') return renderOne(v);
    if (v.mgr === 'hist') return renderHist();
    if (v.mgr === 'mig') return renderMig();
    if (v.mgr === 'sug') return renderSug(v);
    if (v.mgr === 'dup') return renderDup();
    if (v.mgr === 'vals') return renderVals(v);
    if (v.mgr === 'by') return renderBy();
    return renderHomeMgr();
  }
  return { render, busy: () => !!(IMP && IMP.stage === 'queue'), _state: () => ({ A, IMP, CAT, ONE }) };
}
