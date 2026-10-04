/* האקדמיה — ספרייה וקורא (שלב 1). נטען רק כשנכנסים לספרייה (import דינמי מ־app.js), כדי שהאפליקציה לא תגדל.
   מנוע: foliate-js (vendor/foliate-js, MIT) — EPUB 3 מלא + AZW3/MOBI של קינדל, דפדוף לפי כיוון הספר (עברית ← / אנגלית →).
   אבטחה: תוכן הספר רץ ב־iframe מ־blob באותו origin — ה־CSP של index.html (בלי blob ב־script-src) חוסם כל סקריפט בספר.
   אחסון: הספרים והמיקום ב־IndexedDB בטלפון (לא localStorage — שם המכסה ~5MB ומשותפת לתיק).
   שלב 2: הספרייה המשותפת — המכתבים מתיקיית ה־Drive של המשתמש דרך השרתון (/api/library), רק לקוראים מורשים.
   עיצוב: כמו אפליקציית קינדל (בקשת המשתמש) בשפה של THE SNOWBALL; יישור לימין כברירת מחדל, עובי 1 = Regular (400). */
import { makeBook } from './vendor/foliate-js/view.js';
import { Overlayer } from './vendor/foliate-js/overlayer.js';
import * as CFI from './vendor/foliate-js/epubcfi.js';
import { THINKERS, GLOSSARY, TRACKS } from './academy-data.js';
import { createBackup, isPrivate } from './libbackup.js';

const T = (k, v) => (typeof t === 'function' ? t(k, v) : k);
const LS_READER = 'pwa_reader_v1';
const FONT_URL = new URL('fonts/NotoSansHebrew-VF.woff2', document.baseURI).href;
const WEIGHTS = [400, 470, 540, 610, 680];        // "עובי" 1–5, כמו רמת ההדגשה של קינדל
const SPACING = [1.45, 1.62, 1.85];
const THEMES = {
  white: { page: '#FFFFFF', ink: '#1A1A1A', ink2: '#6E6E73', rule: 'rgba(0,0,0,.16)', link: '#0B6B2C', dark: false },
  sepia: { page: '#F6EFE1', ink: '#3B2F22', ink2: '#7C6A55', rule: 'rgba(59,47,34,.2)', link: '#7A4A12', dark: false },
  green: { page: '#E8F0E3', ink: '#22301F', ink2: '#5B6B55', rule: 'rgba(34,48,31,.2)', link: '#1F6B33', dark: false },
  black: { page: '#000000', ink: '#D6D6D6', ink2: '#8A8A8E', rule: 'rgba(255,255,255,.18)', link: '#7EE2A0', dark: true },
};
const COVER_COLORS = [['#23426B', '#142944'], ['#3D3D3D', '#1E1E1E'], ['#5B4636', '#3A2C22'], ['#2E5A4E', '#1B3A32'], ['#5A2E3D', '#3A1C27'], ['#3F4A6B', '#272F47']];

const defaults = { theme: 'white', size: 19, weight: 0, spacing: 1, justify: false, font: 'snb', flow: 'paginated' };
function loadSettings() { try { return Object.assign({}, defaults, JSON.parse(localStorage.getItem(LS_READER) || '{}')); } catch (e) { return Object.assign({}, defaults); } }
function saveSettings() { try { localStorage.setItem(LS_READER, JSON.stringify(S)); } catch (e) {} }
let S = loadSettings();
const ui = { sort: 'new', author: '', view: null, q: '', admin: false };   // view: null = בית, { book: id } = דף מכתב
/* v318: שתי ספריות — 'snb' = ספריית THE SNOWBALL (המכתבים מה־Drive המשותף), 'mine' = הספרים שהמשתמש העלה (עם גיבוי ל־Drive שלו) */
const LS_SHELF = 'pwa_libshelf_v1';
ui.shelf = (() => { try { return localStorage.getItem(LS_SHELF) === 'mine' ? 'mine' : 'snb'; } catch (e) { return 'snb'; } })();
const shelfOf = (b) => (b && b.src === 'drive' ? 'snb' : 'mine');

/* ---------------- IndexedDB: books = פרטים ומיקום (רשימה מהירה), files = הקובץ עצמו ---------------- */
let _db = null;
function idb() {
  if (_db) return Promise.resolve(_db);
  return new Promise((res, rej) => {
    const r = indexedDB.open('snb-library', 2);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains('books')) d.createObjectStore('books', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('files')) d.createObjectStore('files');
      if (!d.objectStoreNames.contains('text')) d.createObjectStore('text', { keyPath: 'id' });   // שלב 6: טקסט לחיפוש מלא
    };
    r.onsuccess = () => { _db = r.result; res(_db); };
    r.onerror = () => rej(r.error);
  });
}
async function tx(store, mode, fn) {
  const d = await idb();
  return new Promise((res, rej) => {
    const x = d.transaction(store, mode); const st = x.objectStore(store); let out;
    Promise.resolve(fn(st)).then((v) => { out = v; });
    x.oncomplete = () => res(out); x.onerror = () => rej(x.error);
  });
}
const reqP = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
/* v313 — הפרדת חשבונות במכשיר אחד: התקדמות/הדגשות שייכות לחשבון (pOwner), ומה שלא שייך לו נשמר בצד (byOwner);
   ספר שיובא ידנית שייך לחשבון שייבא אותו (owner) ומוסתר מאחרים. מכתבי ה־Drive המשותפים — גלויים לכולם. */
const libOwner = () => { try { return localStorage.getItem('pwa_owner_v1') || 'local'; } catch (e) { return 'local'; } };
const libLegacyOwner = () => { try { return localStorage.getItem('pwa_legacy_owner_v1') || ''; } catch (e) { return ''; } };
const PERSONAL = ['cfi', 'fraction', 'done', 'lastRead', 'ann'];
export function scopeBook(b, cur, legacyTo) {   // טהורה (נבדקת): מתאימה רשומה לחשבון הנוכחי; true = השתנתה
  let ch = false;
  if (b.src !== 'drive' && !b.owner) { b.owner = legacyTo || 'legacy'; ch = true; }   // מכשיר ותיק: רק למי שאומץ
  const from = b.pOwner || legacyTo || 'legacy';
  if (from !== cur) {
    b.byOwner = b.byOwner || {};
    const mine = {};
    for (const f of PERSONAL) if (b[f] !== undefined) { mine[f] = b[f]; delete b[f]; }
    if (Object.keys(mine).length) b.byOwner[from] = mine;
    const back = b.byOwner[cur];
    if (back) { Object.assign(b, back); delete b.byOwner[cur]; }
    else Object.assign(b, { cfi: '', fraction: 0, done: false, lastRead: 0, ann: [] });
    ch = true;
  }
  if (b.pOwner !== cur) { b.pOwner = cur; ch = true; }
  return ch;
}
export const bookVisible = (b, cur) => b.src === 'drive' || b.owner === cur;
const allBooksRaw = () => tx('books', 'readonly', (st) => reqP(st.getAll()));
const allBooks = async () => { const cur = libOwner(); return (await allBooksRaw()).filter((b) => bookVisible(b, cur) && !b.hidden); };
const hiddenBooks = async () => { const cur = libOwner(); return (await allBooksRaw()).filter((b) => bookVisible(b, cur) && b.hidden); };
async function scopeLibrary() {
  const cur = libOwner(), legacyTo = libLegacyOwner();
  for (const b of await allBooksRaw()) if (scopeBook(b, cur, legacyTo)) await putBook(b);
}
const putBook = (b) => tx('books', 'readwrite', (st) => st.put(b));
const getFile = (id) => tx('files', 'readonly', (st) => reqP(st.get(id)));

/* ---------------- פרטי ספר (טהורות — נבדקות) ---------------- */
export function langText(x) {
  if (!x) return '';
  if (typeof x === 'string') return x;
  if (Array.isArray(x)) return x.map(langText).filter(Boolean).join(', ');
  if (x.name) return langText(x.name);
  const k = Object.keys(x); return k.length ? String(x[k[0]]) : '';
}
export function bookYear(title, published) {
  const m = String(title || '').match(/\b(1[89]\d\d|20\d\d)\b/); // "מכתב באפט 2023" — שנת המכתב, לא תאריך הפרסום
  if (m) return +m[1];
  const p = String(published || '').match(/\b(1[89]\d\d|20\d\d)\b/);
  return p ? +p[1] : 0;
}
/* זמן קריאה כמו במנוע (progress.js: 1600 תווים לדקה), רק פרקים "ליניאריים" */
export function readMinutes(sections) {
  const size = (sections || []).filter((x) => x && x.linear !== 'no').reduce((a, x) => a + (+x.size || 0), 0);
  return size ? Math.max(1, Math.round(size / 1600)) : 0;
}
export function plainText(html) { return String(html || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim(); }
function bookExtras(book) {
  const md = book.metadata || {};
  return { minutes: readMinutes(book.sections), chapters: (book.toc || []).length, desc: plainText(langText(md.description)).slice(0, 1200),
    pub: langText(md.publisher), date: String(md.published || '').slice(0, 10), meta: 2 };
}
/* ---------------- שלב 4: הדגשות, הערות, סימניות ----------------
   נשמרות ברשומת הספר (rec.ann) — מערך { id, c: CFI, x: הקטע, k: צבע, n: הערה, b: סימנייה, ch: פרק, f: אחוז, u: עדכון, d: נמחק }.
   מחיקה = d:1 (מצבה), כדי שמכשיר אחר לא יחזיר אותה בסנכרון. */
export const HL_COLORS = { y: '#FFD60A', g: '#30D158', b: '#64D2FF', p: '#FF6482' };
export function mergeAnn(local, remote) {   // טהורה: מיזוג לפי id — העדכון האחרון מנצח (כולל מחיקות)
  const out = new Map((local || []).map((a) => [a.id, a]));
  let changed = false;
  Object.entries(remote || {}).forEach(([id, r]) => {
    if (!r) return;
    const l = out.get(id);
    if (!l || (r.u || 0) > (l.u || 0)) { out.set(id, Object.assign({ id }, r)); changed = true; }
  });
  return changed ? Array.from(out.values()) : null;
}
export function liveAnn(list, kind) {          // הדגשות/סימניות פעילות, לפי מיקום בספר
  return (list || []).filter((a) => !a.d && (kind === 'bm' ? a.b : !a.b)).sort((a, b) => (a.f || 0) - (b.f || 0));
}
export function wrapQuote(text, maxW, measure, maxLines) {   // שורות לכרטיס הציטוט (מדידה מוזרקת — נבדקת)
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = []; let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (measure(t) <= maxW || !cur) cur = t; else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '') + '…'; }
  return lines;
}
/* ---------------- שלב 5: שכבת האקדמיה ---------------- */
const isBuffett = (b) => /באפט|buffett/i.test((b && (b.author || '') + ' ' + (b.title || '')) || '');
export function trackLetter(books, year) {      // המכתב של באפט מאותה שנה — עדיפות למכתב לבעלי המניות על פני מכתב שותפות
  const c = books.filter((b) => b.year === year && isBuffett(b));
  return c.find((b) => !/שותפות|partnership/i.test(b.title)) || c[0] || null;
}
export function trackSteps(track, books) {      // רק שלבים שיש להם מכתב בספרייה
  return track.steps.map(([y, why]) => ({ y, why, book: trackLetter(books, y) })).filter((x) => x.book);
}
const normTerm = (s) => String(s || '').toLowerCase().replace(/[\u0591-\u05C7"״׳'’.,:;!?()\[\]–—-]/g, ' ').replace(/\s+/g, ' ').trim();
export function glossaryMatch(text) {            // מונח מהמילון שמופיע בטקסט שסומן (עד 6 מילים)
  const t = normTerm(text);
  if (!t || t.split(' ').length > 6) return null;
  return GLOSSARY.find(([he, en]) => { const a = normTerm(he), b = normTerm(en); return t === a || t === b || (a.length > 3 && t.includes(a)) || (b.length > 4 && t.includes(b)); }) || null;
}
/* ---------------- שלב 6: חיפוש בתוך הטקסט של כל המכתבים ----------------
   אינדקס בטלפון (IndexedDB 'text'): לכל ספר — פסקאות לכל פרק. נבנה ברקע אחרי הסנכרון. החיפוש בלי ניקוד, בלי תלות
   באותיות סופיות/גרשיים; ביטוי מדויק, ואם אין — כל המילים באותה פסקה. נגיעה בתוצאה פותחת את הקורא בדיוק שם. */
const FOLD_MAP = { 'ם': 'מ', 'ן': 'נ', 'ץ': 'צ', 'ף': 'פ', 'ך': 'כ', '׳': "'", '’': "'", '‘': "'", '״': '"', '“': '"', '”': '"', '־': '-', '–': '-', '—': '-' };
export function foldMap(t) {            // טקסט מקופל + מפה מכל תו מקופל למיקום במקור
  let f = ''; const map = [];
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (c >= '\u0591' && c <= '\u05C7' && c !== '\u05BE') continue;   // ניקוד וטעמים
    f += FOLD_MAP[c] || c.toLowerCase(); map.push(i);
  }
  map.push(t.length);
  return { f, map };
}
const FOLD_RE = /[\u0591-\u05BD\u05BF-\u05C7]/g, FOLD_CH = /[םןץףך׳’‘״“”־–—]/g;
export function foldQuick(t) {          // אותו קיפול בלי המפה — מהיר (replace מקורי); לסינון מוקדם של פרקים
  return String(t).replace(FOLD_RE, '').replace(FOLD_CH, (c) => FOLD_MAP[c]).toLowerCase();
}
export function ftFind(text, q, max = 40, folded) {   // מיקומי התאמה בטקסט המקורי: [{ pos, len }]
  // בלי ניקוד הקיפול הוא תו־לתו (אורך זהה) → המיקומים זהים, בלי לבנות מפה (שלב 8 — הרבה יותר מהר)
  const quick = folded != null ? folded : foldQuick(text);
  const fm = quick.length === text.length ? null : foldMap(text);
  const f = fm ? fm.f : quick, at = fm ? (i) => fm.map[i] : (i) => i;
  const fq = foldQuick(String(q).trim().replace(/\s+/g, ' '));
  if (fq.length < 2) return [];
  const out = [];
  for (let i = f.indexOf(fq); i >= 0 && out.length < max; i = f.indexOf(fq, i + fq.length)) out.push({ pos: at(i), len: at(i + fq.length) - at(i) });
  if (out.length) return out;
  const words = fq.split(' ').filter((w) => w.length >= 2);
  if (words.length < 2) return [];
  let start = 0;                         // כל המילים באותה פסקה
  for (const para of f.split('\n')) {
    if (words.every((w) => para.includes(w))) {
      const p0 = start + para.indexOf(words[0]);
      out.push({ pos: at(p0), len: at(p0 + words[0].length) - at(p0), loose: true });
      if (out.length >= max) break;
    }
    start += para.length + 1;
  }
  return out;
}
export function snippet(text, pos, len, around = 70) {   // { pre, hit, post } סביב ההתאמה, בגבולות מילים
  let a = Math.max(0, pos - around), b = Math.min(text.length, pos + len + around);
  const nl1 = text.lastIndexOf('\n', pos); if (nl1 >= a) a = nl1 + 1;
  const nl2 = text.indexOf('\n', pos + len); if (nl2 >= 0 && nl2 < b) b = nl2;
  if (a > 0) { const sp = text.indexOf(' ', a); if (sp > 0 && sp < pos) a = sp + 1; }
  if (b < text.length) { const sp = text.lastIndexOf(' ', b); if (sp > pos + len) b = sp; }
  return { pre: (a > 0 ? '…' : '') + text.slice(a, pos), hit: text.slice(pos, pos + len), post: text.slice(pos + len, b) + (b < text.length ? '…' : '') };
}
export function sortBooks(list, sort) {
  const a = list.slice();
  if (sort === 'recent') return a.sort((x, y) => (y.lastRead || 0) - (x.lastRead || 0) || (y.year || 0) - (x.year || 0));
  const dir = sort === 'old' ? 1 : -1;
  return a.sort((x, y) => dir * ((x.year || 0) - (y.year || 0)) || String(x.title).localeCompare(String(y.title), 'he'));
}
function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
async function fileId(file) {
  try {
    const buf = await file.slice(0, 1 << 20).arrayBuffer();
    const d = await crypto.subtle.digest('SHA-256', buf);
    return 'f-' + Array.from(new Uint8Array(d)).slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('') + '-' + file.size;
  } catch (e) { return 'f-' + hashStr(file.name + file.size); }
}

/* כריכה מתוך הקובץ (04/10/2026): תמונה מוקטנת נשמרת ברשומת הספר — הספרייה מציגה אותה במקום הכריכה הטיפוגרפית */
async function coverThumb(book) {
  const blob = await (book.getCover ? book.getCover() : null);
  if (!blob || typeof createImageBitmap !== 'function') return null;
  const bmp = await createImageBitmap(blob);
  const w = Math.min(480, bmp.width), hgt = Math.round(bmp.height * w / bmp.width);
  if (!w || !hgt) return null;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = hgt;
  cv.getContext('2d').drawImage(bmp, 0, 0, w, hgt);
  if (bmp.close) bmp.close();
  return new Promise((res) => cv.toBlob((b) => res(b ? { blob: b, w, h: hgt } : null), 'image/jpeg', 0.85));
}

/* עריכת פרטי ספר (v316) — הפרטים שהמשתמש ערך נשמרים ב־rec.edit ומוחלים מעל מה שבקובץ, גם אחרי שהקובץ מתעדכן.
   השדות כמו ב־Calibre: כותר, כותר משנה, כותב + שם למיון, הוצאה, תאריך, שפה, סדרה + מספר, ISBN, נושאים, תקציר, כריכה */
export const EDIT_FIELDS = ['title', 'subtitle', 'author', 'authorSort', 'pub', 'date', 'lang', 'series', 'seriesIdx', 'isbn', 'tags', 'desc'];
export function applyEdit(rec, e) {   // טהורה (נבדקת)
  if (!e) return rec;
  EDIT_FIELDS.forEach((k) => { if (typeof e[k] === 'string') rec[k] = e[k].trim(); });
  if (!rec.title) rec.title = '—';
  const y = String(rec.date || '').match(/\b(1[5-9]\d\d|20\d\d)\b/);
  rec.year = y ? +y[1] : bookYear(rec.title, '');
  return rec;
}
async function coverFromBlob(blob, maxW) {   // תמונה (מהטלפון/מהרשת) → JPEG מוקטן לרשומה
  const bmp = await createImageBitmap(blob);
  const w = Math.min(maxW || 480, bmp.width), hgt = Math.round(bmp.height * w / bmp.width);
  if (!w || !hgt) return null;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = hgt;
  cv.getContext('2d').drawImage(bmp, 0, 0, w, hgt);
  if (bmp.close) bmp.close();
  return new Promise((res) => cv.toBlob((b) => res(b ? { blob: b, w, h: hgt } : null), 'image/jpeg', 0.85));
}

/* v315: ספרים שיובאו לפני v314 (או שהקובץ שלהם לא השתנה מאז) — השלמת הכריכה מהקובץ השמור, ברקע, בלי הורדה */
let backfilling = null;
function backfillCovers() {
  if (backfilling) return backfilling;
  backfilling = (async () => {
    let n = 0;
    for (const b of await allBooksRaw()) {
      if (b.coverV || b.coverCustom) continue;
      try {
        const file = await getFile(b.id);
        const cv = file ? await coverThumb(await makeBook(file)).catch(() => null) : null;
        const cur = (await allBooksRaw()).find((x) => x.id === b.id);   // רשומה עדכנית — לא לדרוס התקדמות שנשמרה בינתיים
        if (!cur) continue;
        if (cv) { cur.cover = cv.blob; cur.coverRatio = cv.w / cv.h; n++; }
        cur.coverV = 1;
        await putBook(cur);
        if (cv && n % 6 === 0 && root && !rd) renderHome();
      } catch (e) { /* בפעם הבאה */ }
    }
    if (n && root && !rd) renderHome();
    return n;
  })().finally(() => { backfilling = null; });
  return backfilling;
}

async function importFiles(files, extra, outIds) {
  let added = 0;
  for (const file of files) {
    try {
      const book = await makeBook(file);
      const md = book.metadata || {};
      const ident = langText(md.identifier);
      const id = ident ? 'id-' + ident : await fileId(file);
      const title = langText(md.title) || file.name.replace(/\.[^.]+$/, '');
      const rec = {
        id, title, author: langText(md.author) || langText(md.publisher) || '', year: bookYear(title, md.published),
        lang: Array.isArray(md.language) ? md.language[0] : (md.language || ''), dir: book.dir || '',
        size: file.size, added: Date.now(), lastRead: 0, fraction: 0, cfi: '', done: false,
        owner: libOwner(), pOwner: libOwner(),   // v313: של החשבון שייבא (מכתב Drive — גלוי לכולם לפי src)
      };
      Object.assign(rec, bookExtras(book));
      const cv = await coverThumb(book).catch(() => null);
      if (cv) { rec.cover = cv.blob; rec.coverRatio = cv.w / cv.h; }
      rec.coverV = 1;
      const old = (await allBooksRaw()).find((b) => b.id === id);
      if (old) {
        scopeBook(old, libOwner(), libLegacyOwner());   // v313: ההתקדמות של החשבון הנוכחי, והשאר נשמר בצד
        Object.assign(rec, { added: old.added, lastRead: old.lastRead, fraction: old.fraction, cfi: old.cfi, done: old.done, ann: old.ann, byOwner: old.byOwner });
        if (old.edit) { rec.edit = old.edit; applyEdit(rec, old.edit); }   // v316: הפרטים שהמשתמש ערך גוברים על הקובץ
        if (old.coverCustom) Object.assign(rec, { cover: old.cover, coverRatio: old.coverRatio, coverCustom: 1, coverV: 1 });
        if (old.hidden) rec.hidden = 1;
      }
      if (extra) Object.assign(rec, extra);
      if (rec.src !== 'drive') rec.bkD = Date.now();   // v318: ספר פרטי חדש/שהשתנה — לגיבוי הבא
      await tx('files', 'readwrite', (st) => st.put(file, id));
      await putBook(rec);
      if (outIds) outIds.push(id);
      added++;
    } catch (e) {
      if (typeof flash === 'function') flash(T('libOpenErr') + ': ' + file.name);
    }
  }
  return added;
}

/* ---------------- שלב 2: הספרייה המשותפת מה־Drive (דרך השרתון) ----------------
   בכל כניסה לספרייה: רשימת המכתבים מהשרתון (מאומת בהתחברות Google של האפליקציה) → מורידים רק מה שחדש או
   השתנה (לפי md5 של Drive) → נשמר ב־IndexedDB, וכך הקריאה עובדת גם בלי אינטרנט. מכתב שהוסר מהתיקייה — מוסר.
   בלי התחברות / בלי הרשאה / בלי רשת — שקט, והספרייה המקומית נשארת. */
let syncing = null;
let syncNote = '';
let syncProgress = null;   // { done, total } בזמן הורדה מה־Drive
async function idToken() {
  try {
    const u = typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length && firebase.auth().currentUser;
    return u ? await u.getIdToken() : '';
  } catch (e) { return ''; }
}
function libApi(body) {
  const base = (typeof IBKR_PROXY_DEFAULT !== 'undefined' && IBKR_PROXY_DEFAULT) || '';
  const headers = Object.assign({ 'Content-Type': 'application/json' }, typeof ibkrProxyHeaders === 'function' ? ibkrProxyHeaders() : {});
  return fetch(base + '/api/library', { method: 'POST', headers, body: JSON.stringify(body) });
}
/* ---------------- v318: גיבוי הספרייה הפרטית ל־Google Drive של המשתמש (libbackup.js) ---------------- */
let oauthCancel = null;
function waitCode(w, url, state) {      // הקוד חוזר מ־oauth.html (אותו origin) ב־BroadcastChannel, או באחסון כגיבוי
  return new Promise((resolve) => {
    let bc = null, poll = 0, to = 0;
    const done = (v) => {
      clearInterval(poll); clearTimeout(to); oauthCancel = null;
      try { bc && bc.close(); } catch (e) {}
      window.removeEventListener('storage', onStore);
      try { localStorage.removeItem('pwa_oauth_v1'); } catch (e) {}
      resolve(v);
    };
    const take = (m) => { if (m && m.state === state) done({ code: m.code, error: m.error }); };
    const fromLs = () => { try { const m = JSON.parse(localStorage.getItem('pwa_oauth_v1') || 'null'); if (m) take(m); } catch (e) {} };
    const onStore = (e) => { if (e.key === 'pwa_oauth_v1') fromLs(); };
    try { bc = new BroadcastChannel('snb-oauth'); bc.onmessage = (e) => take(e.data); } catch (e) {}
    window.addEventListener('storage', onStore);
    poll = setInterval(fromLs, 600);
    to = setTimeout(() => done(null), 5 * 60 * 1000);
    oauthCancel = () => done(null);
    let win = w;
    try { if (win && !win.closed) win.location.href = url; else win = window.open(url, 'snb-oauth', 'popup,width=480,height=700'); } catch (e) { win = null; }
    if (!win) done({ error: 'popup_blocked' });
  });
}
const BK = createBackup({
  owner: libOwner, libApi, idToken, allBooksRaw, putBook, getFile,
  importFiles: (files, extra, out) => importFiles(files, extra, out), applyEdit, mergeAnn: (a, b) => mergeAnn(a, b),
  redirectUri: () => new URL('oauth.html', document.baseURI).href,
  openWindow: () => { try { return window.open('', 'snb-oauth', 'popup,width=480,height=700'); } catch (e) { return null; } },
  waitCode,
  onAuto: () => { if (root && !rd && (ui.shelf === 'mine' || (ui.view && ui.view.backup))) renderHome(); },
});
const signedIn = () => { try { return !!(typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length && firebase.auth().currentUser); } catch (e) { return false; } };
const signedEmail = () => { try { return firebase.auth().currentUser.email || ''; } catch (e) { return ''; } };
let bkStatusAt = 0;
/* v319: ספרים שבגיבוי ולא בטלפון — מוצגים ב"הספרייה שלי" דהויים, עם ענן וחץ הורדה (נגיעה = הורדה) */
let cloudBooks = null, cloudLoading = null;
const cloudCovers = new Map();   // coverId → כתובת תמונה (פעם אחת לכל כניסה)
function refreshCloud(force) {
  if (!signedIn() || !BK.settings().email) { cloudBooks = null; return Promise.resolve(); }
  if (cloudLoading && !force) return cloudLoading;
  cloudLoading = BK.overview().then((o) => {
    const before = JSON.stringify((cloudBooks || []).map((x) => x.id));
    cloudBooks = (o && o.exists ? o.books : []).filter((x) => !x.onPhone)
      .map((x) => ({ id: x.id, title: x.title, author: x.author, year: x.year || 0, size: x.size, coverId: x.coverId, coverRatio: x.coverRatio, cloud: true }));
    if (JSON.stringify(cloudBooks.map((x) => x.id)) !== before && root && !rd && ui.shelf === 'mine' && !ui.view) renderHome();
  }).catch(() => {}).finally(() => { cloudLoading = null; });
  return cloudLoading;
}
function bkAdopt() {                    // מכשיר חדש / אחרי ניקוי: ההרשאה כבר בשרתון — מאמצים בשקט, פעם בעשר דקות לכל היותר
  if (!signedIn() || BK.settings().email || Date.now() - bkStatusAt < 6e5) return;
  bkStatusAt = Date.now();
  BK.status().then((j) => { if (j && j.connected && root && !rd) renderHome(); }).catch(() => {});
}
function fmtBytes(n) {
  if (!n) return '0 MB';
  if (n >= 1e9) return (n / 1e9).toFixed(n >= 1e10 ? 0 : 1) + ' GB';
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e8 ? 0 : 1) + ' MB';
  return Math.max(1, Math.round(n / 1e3)) + ' KB';
}
function fmtWhen(ts) {
  if (!ts) return T('bkNever');
  const d = new Date(ts), now = new Date();
  const loc = document.documentElement.lang === 'en' ? 'en-GB' : 'he-IL';
  const hm = d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return T('bkToday', { t: hm });
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return T('bkYesterday', { t: hm });
  return d.toLocaleDateString(loc, { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + hm;
}
const BK_ERR = { gd_not_configured: 'bkErrSetup', gd_denied: 'bkErrDenied', gd_cancel: 'bkErrCancel', gd_no_scope: 'bkErrScope', gd_no_refresh: 'bkErrRefresh', gd_popup: 'bkErrPopup', revoked: 'bkErrRevoked', not_connected: 'bkErrRevoked', drive_http_403: 'bkErrQuota' };
const bkErrText = (e) => T(BK_ERR[(e && (e.code || e.message)) || e] || 'bkErrGeneric');

export function driveSyncPlan(local, items) {      // טהורה (נבדקת): מה להוריד ומה להסיר
  const byDrive = new Map(local.filter((b) => b.driveId).map((b) => [b.driveId, b]));
  const ids = new Set(items.map((i) => i.id));
  return {
    fetch: items.filter((i) => { const o = byDrive.get(i.id); return !o || (!o.hidden && i.md5 && o.md5 !== i.md5); }),   // מוסתר — לא יורד שוב
    remove: local.filter((b) => b.driveId && !ids.has(b.driveId)),
  };
}
function syncDrive() {
  if (syncing) return syncing;
  syncing = (async () => {
    const tk = await idToken();
    if (!tk) { syncNote = 'signin'; return 0; }
    const j = await libApi({ op: 'list', idToken: tk }).then((r) => r.json()).catch(() => null);
    if (!j || !j.ok) { syncNote = j && j.error === 'not_allowed' ? 'denied' : ''; return 0; }
    syncNote = '';
    const plan = driveSyncPlan(await allBooks(), j.items || []);
    let changed = 0, done = 0;
    const queue = plan.fetch.slice();
    const total = queue.length;
    // 4 הורדות במקביל; הספרייה מתעדכנת תוך כדי (בכניסה הראשונה — עשרות מכתבים)
    const worker = async () => {
      for (let it; (it = queue.shift());) {
        try {
          const r = await libApi({ op: 'file', idToken: tk, id: it.id });
          if (r.ok) {
            const file = new File([await r.blob()], it.name, { type: 'application/epub+zip' });
            changed += await importFiles([file], { driveId: it.id, md5: it.md5 || '', src: 'drive' });
          }
        } catch (e) { /* בפעם הבאה */ }
        done++;
        syncProgress = { done, total };
        if (done % 8 === 0 && root && !rd) renderHome();
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    syncProgress = null;
    for (const b of plan.remove) {
      if (rd && rd.rec && rd.rec.id === b.id) continue;   // לא מוחקים ספר פתוח
      const cur = (await allBooksRaw()).find((x) => x.id === b.id);
      if (!cur || cur.driveId !== b.driveId) continue;   // הספר כבר עבר לקובץ אחר באותו מזהה (למשל גרסה מעודכנת בתיקייה אחרת)
      await tx('books', 'readwrite', (st) => st.delete(b.id));
      await tx('files', 'readwrite', (st) => st.delete(b.id));
      changed++;
    }
    return changed;
  })().catch(() => 0).finally(() => { syncing = null; });
  return syncing;
}

/* ---------------- שלב 3: התקדמות והגדרות בין מכשירים ----------------
   שדה נפרד `lib` במסמך המשתמש ב־Firestore (users/{uid}) — כתיבה עם merge, כך ששמירת התיק (שדה db) לא נוגעת בו
   והוא לא נוגע בתיק. p = התקדמות לכל ספר { c: CFI, f: אחוז, d: נקרא, t: זמן }, s = הגדרות הקורא. הכי עדכני מנצח. */
export function cloudKey(id) { return 'k' + String(id || '').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 140); }
export function mergeProgress(local, remote) {   // טהורה: מחזירה עדכון מקומי אם המרוחק חדש יותר, אחרת null
  if (!remote || !(remote.t > (local.lastRead || 0))) return null;
  return { cfi: remote.c || local.cfi || '', fraction: +remote.f || 0, done: !!remote.d || !!local.done, lastRead: remote.t };
}
function userRef() {
  try {
    if (typeof firebase === 'undefined' || !firebase.apps || !firebase.apps.length || !firebase.firestore) return null;
    const u = firebase.auth().currentUser;
    if (u && libOwner() !== u.uid) return null;   // v313: ההתקדמות במכשיר של חשבון אחר — לא נכתבת לחשבון הזה
    return u ? firebase.firestore().collection('users').doc(u.uid) : null;
  } catch (e) { return null; }
}
let pendingP = {}, pendingA = {}, pushT = 0, settingsT = 0;
function pushProgress(rec, now) {
  pendingP[cloudKey(rec.id)] = { c: rec.cfi || '', f: Math.round((rec.fraction || 0) * 1000) / 1000, d: !!rec.done, t: rec.lastRead || Date.now() };
  clearTimeout(pushT);
  pushT = setTimeout(flushProgress, now ? 0 : 4000);
}
function flushProgress() {
  clearTimeout(pushT);
  const ref = userRef(); const p = pendingP, a = pendingA;
  if (!ref || (!Object.keys(p).length && !Object.keys(a).length)) return;
  pendingP = {}; pendingA = {};
  const lib = {}; if (Object.keys(p).length) lib.p = p; if (Object.keys(a).length) lib.a = a;
  ref.set({ lib }, { merge: true }).catch(() => { pendingP = Object.assign(p, pendingP); pendingA = Object.assign(a, pendingA); });
}
function pushAnn(rec, ann) {
  const k = cloudKey(rec.id);
  const { id, ...rest } = ann;
  (pendingA[k] = pendingA[k] || {})[id] = rest;
  clearTimeout(pushT);
  pushT = setTimeout(flushProgress, 1500);
}
function pushSettings() {
  S.t = Date.now(); saveSettings();
  clearTimeout(settingsT);
  settingsT = setTimeout(() => { const ref = userRef(); if (ref) ref.set({ lib: { s: S } }, { merge: true }).catch(() => {}); }, 3000);
}
async function pullCloud() {
  const ref = userRef(); if (!ref) return 0;
  let lib; try { const snap = await ref.get(); lib = snap.exists && snap.data().lib; } catch (e) { return 0; }
  if (!lib) return 0;
  let changed = 0;
  if (lib.s && lib.s.t > (S.t || 0)) { S = Object.assign({}, defaults, lib.s); saveSettings(); }
  const p = lib.p || {};
  for (const b of await allBooks()) {
    if (rd && rd.rec && rd.rec.id === b.id) continue;          // הספר הפתוח — המקומי קובע
    const u = mergeProgress(b, p[cloudKey(b.id)]);
    const ann = mergeAnn(b.ann, (lib.a || {})[cloudKey(b.id)]);
    if (u) Object.assign(b, u);
    if (ann) b.ann = ann;
    if (u || ann) { await putBook(b); changed++; }
  }
  return changed;
}
if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('visibilitychange', () => { if (document.hidden) flushProgress(); });

const BLOCK_SEL = 'p,li,h1,h2,h3,h4,h5,h6,blockquote,td,th,dd,dt,figcaption,pre';
async function indexBook(b) {
  const file = await getFile(b.id); if (!file) return;
  const book = await makeBook(file);
  const secs = [];
  for (const [i, sec] of (book.sections || []).entries()) {
    if (!sec.createDocument || sec.linear === 'no') continue;
    try {
      const doc = await sec.createDocument();
      const blocks = Array.from(doc.querySelectorAll(BLOCK_SEL)).filter((el) => !el.querySelector(BLOCK_SEL));
      const t = (blocks.length ? blocks.map((el) => el.textContent) : [doc.body ? doc.body.textContent : ''])
        .map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
      if (t) secs.push({ i, t });
    } catch (e) { /* פרק שלא נפתח — מדלגים */ }
  }
  await tx('text', 'readwrite', (st) => st.put({ id: b.id, v: (b.md5 || '') + '|' + b.size, secs }));
  ftCache = null;
}
let indexing = null, ftCache = null, ftState = { done: 0, total: 0 };
function indexAll() {                   // ברקע, ספר אחרי ספר; לא בזמן קריאה
  if (indexing) return indexing;
  indexing = (async () => {
    const books = await allBooks();
    const have = new Map((await tx('text', 'readonly', (st) => reqP(st.getAll()))).map((x) => [x.id, x.v]));
    const todo = books.filter((b) => have.get(b.id) !== (b.md5 || '') + '|' + b.size);
    ftState = { done: books.length - todo.length, total: books.length };
    for (const b of todo) {
      if (!root) break;
      while (rd) await new Promise((r) => setTimeout(r, 1500));
      try { await indexBook(b); } catch (e) {}
      ftState.done++;
      await new Promise((r) => setTimeout(r, 30));
    }
  })().finally(() => {
    indexing = null;
    const home = root && root.querySelector('.lib-home');   // חיפוש פתוח — לרענן אחרי שהאינדקס הושלם
    if (home && (ui.q || '').trim().length >= 2 && home.querySelector('.lib-ft')) renderFt(home, ui.q.trim());
  });
  return indexing;
}
async function ftSearch(q) {
  // משתנה מקומי: indexBook מאפס את ftCache באמצע (מרוץ — "ftCache is not iterable")
  const cache = ftCache || (ftCache = await tx('text', 'readonly', (st) => reqP(st.getAll())));
  const books = new Map((await allBooks()).map((b) => [b.id, b]));
  const fq = foldQuick(String(q).trim().replace(/\s+/g, ' '));
  const words = fq.split(' ').filter((w) => w.length >= 2);
  const res = [];
  for (const rec of cache) {
    const b = books.get(rec.id); if (!b) continue;
    const hits = [];
    for (const sec of rec.secs) {
      // שלב 8: סינון מוקדם על טקסט מקופל שמור — המפה המלאה (foldMap) רק לפרק שבאמת מכיל את המילים
      const f = sec._f || (sec._f = foldQuick(sec.t));
      if (!f.includes(fq) && !(words.length >= 2 && words.every((w) => f.includes(w)))) continue;
      let low = null;
      for (const m of ftFind(sec.t, q, 40 - hits.length, f)) {
        const orig = sec.t.slice(m.pos, m.pos + m.len);
        low = low || sec.t.toLowerCase(); const ol = orig.toLowerCase();
        let k = 0; for (let i = low.indexOf(ol); i >= 0 && i < m.pos; i = low.indexOf(ol, i + 1)) k++;
        hits.push(Object.assign({ sec: sec.i, k, orig, text: sec.t }, m));
      }
      if (hits.length >= 40) break;
    }
    if (hits.length) res.push({ b, hits, exact: hits.some((x) => !x.loose) });
  }
  return res.sort((a, c) => (c.exact - a.exact) || (c.hits.length - a.hits.length) || ((c.b.year || 0) - (a.b.year || 0)));
}

/* ---------------- מבנה המסך ---------------- */
const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
const ICON = {
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  sort: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M7 5v14M4 16l3 3 3-3M17 19V5M14 8l3-3 3 3"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  bookmark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linejoin="round"><path d="M7 4h10v16l-5-3.6L7 20z"/></svg>',
  notes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5.5" cy="12" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="18.5" cy="12" r="1.9"/></svg>',
  cloud: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 18.5h10.5a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.6 9.1 4.7 4.7 0 0 0 7 18.5z"/></svg>',
  cloudOk: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 18.5h10.5a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.6 9.1 4.7 4.7 0 0 0 7 18.5z"/><path d="M9.3 13.6l2 2 3.6-3.8"/></svg>',
  cloudUp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 18.5h10.5a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.6 9.1 4.7 4.7 0 0 0 7 18.5z"/><path d="M12 16v-5M9.8 13l2.2-2.2 2.2 2.2"/></svg>',
  cloudDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 18.5h10.5a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.6 9.1 4.7 4.7 0 0 0 7 18.5z"/><path d="M12 10.5v5.5M9.8 13.8l2.2 2.2 2.2-2.2"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>',
};
let root = null;

function ensureCss() {
  if (document.getElementById('libCss')) return;
  const l = document.createElement('link'); l.id = 'libCss'; l.rel = 'stylesheet'; l.href = 'library.css';
  document.head.appendChild(l);
}

const coverUrls = new Map();   // id → { blob, url } — כתובת אחת לכל תמונה, משתחררת כשהתמונה מתחלפת
function coverUrl(b) {
  if (!(b.cover instanceof Blob)) return '';
  const c = coverUrls.get(b.id);
  if (c && c.blob === b.cover) return c.url;
  if (c) URL.revokeObjectURL(c.url);
  const url = URL.createObjectURL(b.cover);
  coverUrls.set(b.id, { blob: b.cover, url });
  return url;
}
function cover(b, mini) {
  const src = coverUrl(b);
  if (src) {
    const el = h('div', 'lib-cover img' + (mini ? ' mini' : ''));
    if (b.coverRatio) el.style.aspectRatio = String(b.coverRatio);
    const im = document.createElement('img'); im.src = src; im.alt = ''; im.decoding = 'async';
    el.append(im);
    return el;
  }
  const c = COVER_COLORS[hashStr(b.author || b.title) % COVER_COLORS.length];
  const el = h('div', 'lib-cover' + (mini ? ' mini' : ''));
  el.style.background = 'linear-gradient(160deg,' + c[0] + ',' + c[1] + ')';
  el.append(h('div', 'lc-top', mini ? '' : (b.author || '')));
  const mid = h('div', 'lc-mid');
  if (b.year) mid.append(h('div', 'lc-yr', String(b.year)), h('div', 'lc-rule'), h('div', 'lc-t', b.author || b.title));
  else mid.append(h('div', 'lc-name', b.title), h('div', 'lc-rule'), h('div', 'lc-t', b.author || ''));
  el.append(mid);
  return el;
}

function goView(v) {           // מעבר לדף בתוך הספרייה — רשומה בהיסטוריה, כך ש"חזור" של המכשיר מחזיר
  saveLibScroll();
  ui.view = v;
  history.pushState(Object.assign({}, history.state || {}, { lib: 1, lv: v }), '');
  renderHome();
  if (root) { root.scrollTop = 0; try { root.focus({ preventScroll: true }); } catch (e) {} }
}

async function renderHome() {
  if (!root) return;
  if (ui.view && ui.view.book) return renderBook(ui.view.book);
  if (ui.view && ui.view.notes) return renderNotes();
  if (ui.view && ui.view.track) return renderTrack(ui.view.track);
  if (ui.view && ui.view.thinkers) return renderThinkers();
  if (ui.view && ui.view.thinker) return renderThinker(ui.view.thinker);
  if (ui.view && ui.view.glossary) return renderGlossary();
  if (ui.view && ui.view.admin) return renderAdmin();
  if (ui.view && ui.view.edit) return renderEdit(ui.view.edit);
  if (ui.view && ui.view.backup) return renderBackup();
  if (ui.view && ui.view.bkbooks) return renderBackupBooks();
  const allB = await allBooks();
  const mine = ui.shelf === 'mine';
  const books = allB.filter((b) => shelfOf(b) === ui.shelf);
  const nMine = allB.filter((b) => shelfOf(b) === 'mine').length;
  const have = new Set(books.map((b) => b.id));
  const cloudOnly = mine && cloudBooks ? cloudBooks.filter((c) => !have.has(c.id)) : [];   // v319: בגיבוי ולא בטלפון
  if (mine && cloudBooks === null) refreshCloud();
  const home = root.querySelector('.lib-home');
  home.textContent = '';
  const top = h('div', 'lib-top');
  const back = h('button', 'lib-back'); back.type = 'button'; back.innerHTML = ICON.back; back.append(h('span', null, 'THE SNOWBALL'));
  back.addEventListener('click', () => history.back());
  const add = h('label', 'lib-round'); add.innerHTML = ICON.plus; add.title = T('libImport'); add.setAttribute('aria-label', T('libImport'));
  add.append(importInput());
  const learn = h('button', 'lib-round'); learn.type = 'button'; learn.innerHTML = ICON.notes; learn.setAttribute('aria-label', T('learnTitle')); learn.title = T('learnTitle');
  learn.addEventListener('click', () => goView({ notes: 1 }));
  const more = h('button', 'lib-round'); more.type = 'button'; more.innerHTML = ICON.more; more.setAttribute('aria-label', T('libMineMenu')); more.title = T('libMineMenu');
  more.addEventListener('click', openMineMenu);
  const tr = h('div', 'lib-tr'); tr.append(learn);
  if (mine) tr.append(more, add);
  top.append(back, tr);
  home.append(top, h('h1', 'lib-large', T('libTitle')));
  home.append(shelfSeg(nMine));
  if (!mine) {
    if (syncNote === 'denied') home.append(h('p', 'lib-note', T('libDenied')));
    else if (syncProgress && syncProgress.total > 1) home.append(h('p', 'lib-note', T('libSyncProg', { n: syncProgress.done, t: syncProgress.total })));
  } else {
    bkAdopt();
    if (books.length || cloudOnly.length) home.append(backupRow());
  }

  if (books.length || cloudOnly.length) {   // גם בספרייה קטנה — החיפוש מגיע גם לתוך הטקסט
    const sw = h('div', 'lib-search');
    sw.innerHTML = ICON.search;
    const si = h('input'); si.type = 'search'; si.placeholder = T(mine ? 'libSearchMinePh' : 'libSearchPh'); si.dir = 'auto'; si.value = ui.q || ''; si.setAttribute('aria-label', T('libSearchPh'));
    si.enterKeyHint = 'search';
    si.addEventListener('input', () => { ui.q = si.value; applySearch(home); });
    si.addEventListener('keydown', (e) => { if (e.key === 'Enter') si.blur(); });
    sw.append(si);
    home.append(sw);
  }
  if (!books.length && !cloudOnly.length) {
    if (mine) { home.append(mineEmpty()); return; }
    home.append(h('p', 'lib-empty', T(syncing ? 'libSyncing' : syncNote === 'signin' ? 'libSignIn' : 'libEmptySnb')));
    return;
  }
  const listed = books.concat(cloudOnly);
  const authors = {};
  listed.forEach((b) => { const a = b.author || T('libNoAuthor'); authors[a] = (authors[a] || 0) + 1; });
  const chips = h('div', 'lib-chips no-swipe');
  const chip = (label, val) => {
    const c = h('button', 'lib-chip' + (ui.author === val ? ' on' : ''), label); c.type = 'button';
    c.addEventListener('click', () => { ui.author = val; renderHome(); });
    chips.append(c);
  };
  chip(T('libAll'), '');
  Object.keys(authors).sort((a, b) => authors[b] - authors[a]).forEach((a) => chip(a, a));
  if (Object.keys(authors).length > 1) { chips.classList.add('lib-hide-q'); home.append(chips); }

  const shown = sortBooks(listed.filter((b) => !ui.author || (b.author || T('libNoAuthor')) === ui.author), ui.sort);
  const last = books.filter((b) => b.lastRead && !b.done).sort((a, b) => b.lastRead - a.lastRead)[0];
  if (last) {
    const card = h('button', 'lib-cont'); card.type = 'button';
    const meta = h('div', 'lc-meta');
    const bar = h('div', 'lib-bar'); const fill = h('i'); fill.style.width = Math.round(last.fraction * 100) + '%'; bar.append(fill);
    const left = last.minutes ? Math.max(1, Math.round(last.minutes * (1 - (last.fraction || 0)))) : 0;
    meta.append(h('div', 'lc-k', T('libContinue')), h('div', 'lc-title', last.title), bar,
      h('div', 'lc-p', Math.round(last.fraction * 100) + '%' + (left ? ' · ' + T('rdMinLeftBook', { m: left }) : '')));
    card.append(cover(last, true), meta);
    card.addEventListener('click', () => openReader(last.id));
    card.classList.add('lib-hide-q');
    home.append(card);
  }
  if (!ui.author && !mine) {
    const letters = books.filter(isBuffett);
    if (letters.length > 1) {
      const done = letters.filter((b) => b.done).length;
      const pr = h('div', 'ac-progress');
      const bar = h('div', 'lib-bar'); const f = h('i'); f.style.width = Math.round(done / letters.length * 100) + '%'; bar.append(f);
      pr.append(h('span', null, T('acReadOf', { n: done, t: letters.length })), bar);
      pr.classList.add('lib-hide-q'); home.append(pr);
    }
    const tracks = TRACKS.map((tr) => ({ tr, steps: trackSteps(tr, books) })).filter((x) => x.steps.length >= 2);
    if (tracks.length) {
      const th = h('h2', 'ac-h lib-hide-q', T('acTracks')); home.append(th);
      const row = h('div', 'ac-tracks no-swipe lib-hide-q');
      tracks.forEach(({ tr, steps }) => {
        const done = steps.filter((x) => x.book.done).length;
        const c = h('button', 'ac-track'); c.type = 'button';
        c.append(ring(done / steps.length), h('b', null, tr.he), h('span', null, tr.sub), h('small', null, T('acSteps', { n: done, t: steps.length })));
        c.addEventListener('click', () => goView({ track: tr.id }));
        row.append(c);
      });
      home.append(row);
    }
    const tiles = h('div', 'ac-tiles lib-hide-q');
    const tile = (k, sub, v) => { const b = h('button', 'ac-tile'); b.type = 'button'; b.append(h('b', null, T(k)), h('span', null, sub)); b.addEventListener('click', () => goView(v)); tiles.append(b); };
    tile('acThinkers', THINKERS.length + ' ' + T('acPeople'), { thinkers: 1 });
    tile('acGlossary', GLOSSARY.length + ' ' + T('acTerms'), { glossary: 1 });
    home.append(tiles);
  }
  const sortRow = h('div', 'lib-sortrow');
  const sortBtn = h('button', 'lib-sortbtn'); sortBtn.type = 'button'; sortBtn.innerHTML = ICON.sort;
  sortBtn.append(h('span', null, T(ui.sort === 'old' ? 'libSortOld' : ui.sort === 'recent' ? 'libSortRecent' : 'libSortNew')));
  sortBtn.addEventListener('click', openSortSheet);
  const cnt = h('b', 'lib-count', T('libCount', { n: shown.length })); cnt.dataset.n = String(shown.length);
  sortRow.append(cnt, sortBtn);
  home.append(sortRow);
  const grid = h('div', 'lib-grid');
  shown.forEach((b) => {
    if (b.cloud) { grid.append(cloudItem(b, shown.indexOf(b))); return; }
    const it = h('button', 'lib-item'); it.type = 'button';
    it.dataset.q = searchKey(b); it.dataset.i = String(shown.indexOf(b));
    const cap = h('div', 'lib-cap');
    if (b.done) cap.append(h('span', 'lib-done', T('libRead')));
    else if (b.fraction > 0) { const m = h('span', 'lib-mini'); const f = h('i'); f.style.width = Math.round(b.fraction * 100) + '%'; m.append(f); cap.append(m, h('span', null, Math.round(b.fraction * 100) + '%')); }
    else cap.append(h('span', 'lib-badge', T('libNew')));
    it.append(cover(b), cap);
    // שלב 8 (נגישות): קורא מסך שומע שם + מצב, לא את כל הטקסט הדקורטיבי של הכריכה
    it.setAttribute('aria-label', b.title + ' · ' + (b.done ? T('libRead') : b.fraction > 0 ? Math.round(b.fraction * 100) + '% ' + T('bkReadPct') : T('libNew')));
    it.addEventListener('click', () => goView({ book: b.id }));
    // v316: לחיצה ארוכה = עט (עריכה) + X (מחיקה/הסתרה) — אותם כפתורים ואותו מיקום כמו במניות (מעל הספר, בצד שמאל)
    wireHold(it, () => bookActions(it, b));
    grid.append(it);
  });
  home.append(grid);
  if (cloudOnly.length > 1) {              // v319: כמה ספרים בגיבוי — הורדה של כולם בלחיצה אחת
    const all = h('button', 'lib-admin-link lib-hide-q', T('libDlAll', { n: cloudOnly.length })); all.type = 'button';
    all.addEventListener('click', async () => {
      all.disabled = true; all.textContent = T('bkRestoring', { n: 0, t: cloudOnly.length });
      grid.querySelectorAll('.lib-item.cloud').forEach((x) => x.classList.add('loading'));
      try { const n = await BK.restore(cloudOnly.map((x) => x.id), (d, t) => { all.textContent = T('bkRestoring', { n: d, t }); }); flashSafe(T('bkRestored', { n })); indexAll(); }
      catch (e) { flashSafe(bkErrText(e)); }
      cloudBooks = null;
      if (root && !rd) renderHome();
    });
    home.append(all);
  }
  home.append(h('p', 'lib-empty lib-noq', T('libNoMatch')));
  const ft = h('div', 'lib-ft'); ft.hidden = true; home.append(ft);
  const hid = mine ? [] : await hiddenBooks();
  if (hid.length) {
    const hb = h('button', 'lib-admin-link lib-hidden-link', T('libHidden', { n: hid.length })); hb.type = 'button';
    hb.addEventListener('click', () => openHiddenSheet(hid));
    home.append(hb);
  }
  if (ui.admin && !mine) {               // שלב 6: ניהול — רק למנהל
    const adm = h('button', 'lib-admin-link', T('admTitle')); adm.type = 'button';
    adm.addEventListener('click', () => goView({ admin: 1 }));
    home.append(adm);
  }
  sortRow.after(h('p', 'lib-near', T('libNear')));
  applySearch(home);
}

/* ---------------- v318: שתי ספריות + גיבוי ל־Google Drive (ממשק) ---------------- */
function setShelf(v) {
  if (ui.shelf === v) return;
  ui.shelf = v; ui.author = ''; ui.q = '';
  try { localStorage.setItem(LS_SHELF, v); } catch (e) {}
  renderHome().then(() => { if (root) root.scrollTop = 0; });
}
function shelfSeg(nMine) {                 // בורר מקטעים בסגנון iOS
  const seg = h('div', 'lib-seg no-swipe'); seg.setAttribute('role', 'tablist');
  const one = (v, label, n) => {
    const b = h('button', 'lib-seg-b' + (ui.shelf === v ? ' on' : '')); b.type = 'button';
    b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', ui.shelf === v ? 'true' : 'false');
    b.append(h('span', null, label));
    if (n) b.append(h('small', null, String(n)));
    b.addEventListener('click', () => setShelf(v));
    seg.append(b);
  };
  one('snb', 'THE SNOWBALL', 0);
  one('mine', T('libMine'), nMine);
  seg.classList.toggle('mine', ui.shelf === 'mine');
  return seg;
}
function backupRow() {                     // שורת מצב הגיבוי בראש "הספרייה שלי" — נגיעה = מסך הגיבוי
  const s = BK.settings();
  const row = h('button', 'lib-bkrow lib-hide-q'); row.type = 'button';
  const ic = h('span', 'lib-bkic'); const sub = h('span');
  let title;
  if (!signedIn()) { ic.innerHTML = ICON.cloud; title = T('bkRowOff'); sub.textContent = T('bkRowSignIn'); }
  else if (!s.email) { ic.innerHTML = ICON.cloud; title = T('bkRowOff'); sub.textContent = T('bkRowConnect'); row.classList.add('off'); }
  else if (BK.busy()) { ic.innerHTML = ICON.cloudUp; title = T('bkRowBusy'); sub.textContent = s.email; }
  else if (s.err) { ic.innerHTML = ICON.cloud; title = T('bkRowErr'); sub.textContent = bkErrText(s.err); row.classList.add('err'); }
  else { ic.innerHTML = ICON.cloudOk; title = T('bkRowOn'); sub.textContent = [fmtWhen(s.lastAt), s.lastAt ? T('bkBooks', { n: s.count || 0 }) : '', s.lastAt ? fmtBytes(s.bytes) : ''].filter(Boolean).join(' · '); }
  const tx = h('span', 'lib-bktx'); tx.append(h('b', null, title), sub);
  const ch = h('span', 'lib-bkch'); ch.innerHTML = ICON.chev;
  row.append(ic, tx, ch);
  row.addEventListener('click', () => goView({ backup: 1 }));
  return row;
}
function cloudItem(b, idx) {
  const it = h('button', 'lib-item cloud'); it.type = 'button';
  it.dataset.q = searchKey(b); it.dataset.i = String(idx);
  const cv = cover(Object.assign({}, b, { cover: null }));
  const fill = (url) => {
    const im = document.createElement('img'); im.src = url; im.alt = ''; im.decoding = 'async';
    cv.className = 'lib-cover img'; cv.textContent = ''; cv.style.background = '';
    if (b.coverRatio) cv.style.aspectRatio = String(b.coverRatio);
    cv.append(im);
  };
  if (b.coverId && cloudCovers.has(b.coverId)) fill(cloudCovers.get(b.coverId));
  else if (b.coverId) BK.coverBlob(b.coverId).then((bl) => { if (!bl) return; const u = URL.createObjectURL(bl); cloudCovers.set(b.coverId, u); if (it.isConnected) fill(u); }).catch(() => {});
  const wrap = h('div', 'lib-cwrap');
  const badge = h('span', 'lib-cbadge'); badge.innerHTML = ICON.cloudDown;
  wrap.append(cv, badge);
  const cap = h('div', 'lib-cap');
  const ci = h('span', 'lib-cic'); ci.innerHTML = ICON.cloud;
  cap.append(ci, h('span', null, T('libInCloud') + (b.size ? ' · ' + fmtBytes(b.size) : '')));
  it.append(wrap, cap);
  it.setAttribute('aria-label', b.title + ' · ' + T('libTapDownload'));
  it.addEventListener('click', () => downloadCloud(b, it, true));
  wireHold(it, () => {
    const acts = [{ kind: 'edit', fn: () => downloadCloud(b, it, false).then((ok) => { if (ok) goView({ edit: b.id }); }) },
      { kind: 'del', fn: () => {
        const go = async () => { try { await BK.removeFromBackup([b.id]); flashSafe(T('bkRemoved', { n: 1 })); } catch (e) { flashSafe(bkErrText(e)); } await refreshCloud(true); if (root && !rd) renderHome(); };
        if (typeof askConfirm === 'function') askConfirm(T('bkRemoveQ', { t: b.title }), go, { danger: true, ok: T('bkDeleteOk') }); else go();
      } }];
    if (typeof showItemActions === 'function') showItemActions(it, acts);
  });
  return it;
}
async function downloadCloud(b, it, open) {
  if (it.classList.contains('loading')) return false;
  it.classList.add('loading');
  let ok = false;
  try { ok = (await BK.restore([b.id])) > 0; } catch (e) { flashSafe(bkErrText(e)); }
  it.classList.remove('loading');
  if (!ok) { if (!it.isConnected) return false; flashSafe(T('libDlErr')); return false; }
  if (cloudBooks) cloudBooks = cloudBooks.filter((x) => x.id !== b.id);
  indexAll();
  if (open) goView({ book: b.id }); else if (root && !rd) renderHome();
  return true;
}
function importInput(after) {
  const inp = h('input'); inp.type = 'file'; inp.multiple = true; inp.accept = '.epub,.azw3,.azw,.mobi,.kf8,.fb2,application/epub+zip';
  inp.addEventListener('change', async () => {
    const n = await importFiles(Array.from(inp.files || [])); inp.value = '';
    if (after) after();
    if (n) { if (ui.shelf !== 'mine') setShelf('mine'); else renderHome(); indexAll(); BK.schedule(); }
  });
  return inp;
}
function mineEmpty() {                     // ספרייה פרטית ריקה: הוספה, ואם יש גיבוי — שחזור בלחיצה אחת
  const box = h('div', 'lib-mine-empty');
  const card = h('div', 'lib-bkcard');
  const ic = h('div', 'lib-bkbig'); ic.innerHTML = ICON.plus;
  card.append(ic, h('b', null, T('libMineEmptyT')), h('p', null, T('libMineEmpty')));
  const add = h('label', 'bk-cta'); add.append(h('span', null, T('libImport')), importInput());
  card.append(add);
  box.append(card);
  const rs = h('div', 'lib-restore-slot');
  box.append(rs);
  if (signedIn() && BK.settings().email) {
    BK.overview().then((o) => {
      if (!o || !o.exists || !o.books.length || !rs.isConnected) return;
      rs.append(restoreCard(o));
    }).catch(() => {});
  }
  return box;
}
function restoreCard(o) {
  const card = h('div', 'lib-bkcard');
  const ic = h('div', 'lib-bkbig drive'); ic.innerHTML = ICON.cloud;
  card.append(ic, h('b', null, T('bkFound')), h('p', null, T('bkBooks', { n: o.books.length }) + ' · ' + fmtBytes(o.bytes) + '\n' + T('bkLast') + ': ' + fmtWhen(o.at)));
  const go = h('button', 'bk-cta'); go.type = 'button'; go.textContent = T('bkRestoreAll');
  const prog = h('div', 'lib-bkprog'); prog.hidden = true;
  const bar = h('div', 'lib-bar'); const fill = h('i'); fill.style.width = '0%'; bar.append(fill);
  const pt = h('span'); prog.append(pt, bar);
  go.addEventListener('click', async () => {
    go.disabled = true; prog.hidden = false; pt.textContent = T('bkRestoring', { n: 0, t: o.books.length });
    try {
      const n = await BK.restore(null, (d, t) => { pt.textContent = T('bkRestoring', { n: d, t }); fill.style.width = Math.round(d / Math.max(1, t) * 100) + '%'; });
      cloudBooks = null;
      if (typeof flash === 'function') flash(T('bkRestored', { n }));
      indexAll();
    } catch (e) { if (typeof flash === 'function') flash(bkErrText(e)); }
    if (root && !rd) renderHome();
  });
  card.append(go, prog);
  return card;
}
function openMineMenu() {                  // ⋯ בספרייה שלי: גיבוי, ייבוא, איפוס
  sheet(T('libMine'), (sh, close) => {
    const list = h('div', 'lib-ios');
    const bk = h('button', 'lib-row'); bk.type = 'button'; bk.append(h('span', null, T('bkTitle')));
    const bi = h('span', 'lib-rowic'); bi.innerHTML = ICON.cloud; bk.append(bi);
    bk.addEventListener('click', () => { close(); goView({ backup: 1 }); });
    const im = h('label', 'lib-row'); im.append(h('span', null, T('libImport')));
    const ii = h('span', 'lib-rowic'); ii.innerHTML = ICON.plus; im.append(ii, importInput(close));
    const rs = h('button', 'lib-row danger'); rs.type = 'button'; rs.append(h('span', null, T('libResetMine')));
    const ri = h('span', 'lib-rowic'); ri.innerHTML = ICON.trash; rs.append(ri);
    rs.addEventListener('click', () => { close(); openResetSheet(); });
    list.append(bk, im, rs);
    sh.append(list);
  });
}
/* איפוס הספרייה שלי — רק הספרים שהעלה החשבון הזה; מכתבי THE SNOWBALL לא מושפעים. ברירת המחדל: הגיבוי נשאר */
async function resetMine() {
  const cur = libOwner();
  const ids = (await allBooksRaw()).filter((b) => isPrivate(b, cur)).map((b) => b.id);
  for (const id of ids) {
    await tx('books', 'readwrite', (st) => st.delete(id));
    await tx('files', 'readwrite', (st) => st.delete(id));
    await tx('text', 'readwrite', (st) => st.delete(id)).catch(() => {});
    const u = coverUrls.get(id); if (u) { URL.revokeObjectURL(u.url); coverUrls.delete(id); }
  }
  ftCache = null;
  cloudBooks = null;                     // v319: מה שנמחק מהטלפון ונשאר בגיבוי — יופיע דהוי, להורדה
  return ids.length;
}
async function openResetSheet() {
  const n = (await allBooks()).filter((b) => shelfOf(b) === 'mine').length;
  const connected = signedIn() && !!BK.settings().email;
  sheet('', (sh, close) => {
    sh.append(h('h3', 'lib-sh-big', T('libResetMine')), h('p', 'lib-sh-p', T('libResetQ', { n })));
    let alsoBackup = false;
    if (connected) {
      const opts = h('div', 'lib-opts'); opts.setAttribute('role', 'radiogroup');
      const opt = (v, k, sub) => {
        const o = h('button', 'lib-opt' + (alsoBackup === v ? ' on' : '')); o.type = 'button'; o.setAttribute('role', 'radio'); o.setAttribute('aria-checked', alsoBackup === v ? 'true' : 'false');
        const tx = h('span'); tx.append(h('b', null, T(k)), h('small', null, T(sub)));
        o.append(h('i', 'lib-rd'), tx);
        o.addEventListener('click', () => { alsoBackup = v; opts.querySelectorAll('.lib-opt').forEach((x, i) => { const on = (i === 1) === v; x.classList.toggle('on', on); x.setAttribute('aria-checked', on ? 'true' : 'false'); }); });
        opts.append(o);
      };
      opt(false, 'libResetKeep', 'libResetKeepSub');
      opt(true, 'libResetAll', 'libResetAllSub');
      sh.append(opts);
    }
    const go = h('button', 'lib-btn danger'); go.type = 'button'; go.textContent = T('libResetOk');
    go.addEventListener('click', async () => {
      go.disabled = true;
      try {
        if (alsoBackup) await BK.deleteAll();
        await resetMine();
        close();
        if (typeof flash === 'function') flash(T(alsoBackup ? 'libResetDoneAll' : 'libResetDone'));
      } catch (e) { go.disabled = false; if (typeof flash === 'function') flash(bkErrText(e)); return; }
      if (ui.view) history.back(); else renderHome();
    });
    const no = h('button', 'lib-btn'); no.type = 'button'; no.textContent = T('libCancel');
    no.addEventListener('click', close);
    sh.append(go, no);
  });
}
function iosSection(home, title, foot) {
  if (title) home.append(h('h4', 'lib-sec', title));
  const list = h('div', 'lib-ios lib-card');
  home.append(list);
  if (foot) home.append(h('p', 'lib-foot', foot));
  return list;
}
function iosRow(list, label, val, onClick, cls) {
  const r = h(onClick ? 'button' : 'div', 'lib-row' + (cls ? ' ' + cls : ''));
  if (onClick) { r.type = 'button'; r.addEventListener('click', onClick); }
  r.append(h('span', 'lib-row-l', label));
  if (val != null) { const v = h('span', 'lib-row-v'); if (typeof val === 'string') v.textContent = val; else v.append(val); r.append(v); }
  list.append(r);
  return r;
}
function swEl(on, onChange, label) {
  const b = h('button', 'lib-sw'); b.type = 'button'; b.setAttribute('role', 'switch'); b.setAttribute('aria-checked', on ? 'true' : 'false'); b.setAttribute('aria-label', label);
  b.append(h('i'));
  b.addEventListener('click', (e) => { e.stopPropagation(); const v = b.getAttribute('aria-checked') !== 'true'; b.setAttribute('aria-checked', v ? 'true' : 'false'); onChange(v); });
  return b;
}
const FREQ = [['change', 'bkFreqChange'], ['daily', 'bkFreqDaily'], ['weekly', 'bkFreqWeekly']];
async function renderBackup() {
  const home = subPage(T('bkTitle'));
  home.classList.add('lib-bkpage');
  const back = home.querySelector('.lib-back span'); if (back) back.textContent = T('libMine');
  const hero = h('div', 'lib-bkhero');
  const ic = h('div', 'lib-bkbig drive'); ic.innerHTML = ICON.cloud;
  hero.append(ic, h('p', null, T('bkHero')));
  home.append(hero);
  const s = BK.settings();
  if (!signedIn()) { home.append(h('p', 'lib-empty', T('bkNeedSignIn'))); return; }
  if (!s.email) {
    const st = h('p', 'lib-foot center');
    const go = h('button', 'bk-cta lib-bkconnect'); go.type = 'button'; go.textContent = T('bkConnect');
    go.addEventListener('click', () => {
      go.disabled = true; st.textContent = T('bkWaiting');
      const p = BK.connect(signedEmail());       // החלון נפתח כאן, בתוך הלחיצה
      const cancel = h('button', 'lib-admin-link', T('libCancel')); cancel.type = 'button';
      cancel.addEventListener('click', () => { if (oauthCancel) oauthCancel(); });
      st.after(cancel);
      p.then(async () => {
        if (typeof flash === 'function') flash(T('bkConnected'));
        if (ui.view && ui.view.backup) await renderBackup();
        const has = (await allBooksRaw()).some((b) => isPrivate(b, libOwner()));
        if (has) runBackup();
      }).catch((e) => { go.disabled = false; st.textContent = bkErrText(e); cancel.remove(); });
    });
    home.append(go, st, h('p', 'lib-foot', T('bkPrivacy')));
    BK.config().then((c) => { if (!c.configured && st.isConnected && !st.textContent) st.textContent = T('bkErrSetup'); }).catch(() => {});
    return;
  }
  // גיבוי אחרון + גיבוי עכשיו
  const l1 = iosSection(home, T('bkLast'));
  const lastV = s.lastAt ? T('bkBooks', { n: s.count || 0 }) + ' · ' + fmtBytes(s.bytes) : '';
  iosRow(l1, fmtWhen(s.lastAt), lastV);
  if (s.err) iosRow(l1, bkErrText(s.err), null, null, 'err');
  const nowBtn = iosRow(l1, BK.busy() ? T('bkRunning') : T('bkNow'), null, () => runBackup(nowBtn), 'act');
  // הגדרות
  const l2 = iosSection(home, T('bkSettings'));
  iosRow(l2, T('bkAccount'), s.email);
  iosRow(l2, T('bkAuto'), swEl(s.auto !== false, (v) => { BK.saveSettings({ auto: v }); if (v) BK.schedule(2000); renderBackup(); }, T('bkAuto')));
  if (s.auto !== false) {
    const fv = h('span', 'lib-row-v'); fv.append(document.createTextNode(T((FREQ.find((f) => f[0] === s.freq) || FREQ[0])[1])));
    const ch = h('span', 'lib-bkch'); ch.innerHTML = ICON.chev; fv.append(ch);
    const fr = iosRow(l2, T('bkFreq'), fv, () => openFreqSheet());
    fr.classList.add('nav');
  }
  iosRow(l2, T('bkProg'), swEl(s.prog !== false, (v) => { BK.saveSettings({ prog: v }); }, T('bkProg')));
  home.append(h('p', 'lib-foot', T('bkAutoNote')));
  // בגיבוי
  const l3 = iosSection(home, T('bkInBackup'));
  const cv = h('span', 'lib-row-v'); cv.append(document.createTextNode(s.count != null ? String(s.count || 0) : '…'));
  const ch3 = h('span', 'lib-bkch'); ch3.innerHTML = ICON.chev; cv.append(ch3);
  iosRow(l3, T('bkBooksT'), cv, () => goView({ bkbooks: 1 })).classList.add('nav');
  const qRow = h('div', 'lib-row lib-quota');
  const qTop = h('div', 'lib-quota-t'); const qL = h('span', 'lib-row-l', T('bkQuota')); const qV = h('span', 'lib-row-v', '…'); qTop.append(qL, qV);
  const qBar = h('div', 'lib-qbar'); const qUse = h('i'); const qMine = h('u'); qBar.append(qUse, qMine);
  const qSub = h('small', null, T('bkOurs', { b: fmtBytes(s.bytes || 0) }));
  qRow.append(qTop, qBar, qSub); l3.append(qRow);
  if (s.root) {
    const open = h('a', 'lib-row act'); open.href = 'https://drive.google.com/drive/folders/' + encodeURIComponent(s.root); open.target = '_blank'; open.rel = 'noopener';
    open.append(h('span', 'lib-row-l', T('bkOpenDrive'))); l3.append(open);
  }
  BK.quota().then((q) => {
    if (!q.limit) { qV.textContent = fmtBytes(q.usage); return; }
    qV.textContent = T('bkQuotaOf', { u: fmtBytes(q.usage), l: fmtBytes(q.limit) });
    qUse.style.width = Math.min(100, q.usage / q.limit * 100).toFixed(1) + '%';
    qMine.style.width = Math.max(0.6, Math.min(100, (s.bytes || 0) / q.limit * 100)).toFixed(2) + '%';
  }).catch(() => { qV.textContent = '—'; });
  // מחיקה וניתוק
  const l4 = iosSection(home, '');
  iosRow(l4, T('bkDeleteAll'), null, () => {
    const go = async () => { cloudBooks = null; try { await BK.deleteAll(); if (typeof flash === 'function') flash(T('bkDeleted')); } catch (e) { if (typeof flash === 'function') flash(bkErrText(e)); } if (ui.view && ui.view.backup) renderBackup(); };
    if (typeof askConfirm === 'function') askConfirm(T('bkDeleteAllQ'), go, { danger: true, ok: T('bkDeleteOk') }); else go();
  }, 'danger');
  iosRow(l4, T('bkDisconnect'), null, () => {
    const go = async () => { cloudBooks = null; try { await BK.disconnect(); if (typeof flash === 'function') flash(T('bkDisconnected')); } catch (e) { if (typeof flash === 'function') flash(bkErrText(e)); } if (ui.view && ui.view.backup) renderBackup(); };
    if (typeof askConfirm === 'function') askConfirm(T('bkDisconnectQ'), go, { danger: true, ok: T('bkDisconnectOk') }); else go();
  }, 'danger');
  home.append(h('p', 'lib-foot', T('bkDeleteNote')));
}
async function runBackup(btn) {
  if (BK.busy()) return;
  const lbl = btn && btn.querySelector('.lib-row-l');
  if (lbl) lbl.textContent = T('bkRunning');
  if (btn) btn.disabled = true;
  try {
    await BK.backupNow((d, t) => { if (lbl && lbl.isConnected) lbl.textContent = T('bkRunningN', { n: d, t }); });
    if (typeof flash === 'function') flash(T('bkDone'));
  } catch (e) {
    BK.saveSettings({ err: String(e.code || e.message || 'failed').slice(0, 40), errAt: Date.now() });
    if (typeof flash === 'function') flash(bkErrText(e));
  }
  if (root && !rd) renderHome();
}
function openFreqSheet() {
  sheet(T('bkFreq'), (sh, close) => {
    const list = h('div', 'lib-ios');
    const cur = BK.settings().freq || 'change';
    FREQ.forEach(([v, k]) => {
      const r = h('button', 'lib-row'); r.type = 'button'; r.append(h('span', null, T(k)));
      if (cur === v) r.append(h('span', 'lib-check', '✓'));
      r.addEventListener('click', () => { BK.saveSettings({ freq: v }); close(); BK.schedule(2000); renderBackup(); });
      list.append(r);
    });
    sh.append(list);
  });
}
/* ספרים בגיבוי: מה בטלפון ומה רק בגיבוי; נגיעה = פתיחה / הורדה; לחיצה ארוכה = עריכה / מחיקה מהגיבוי; "בחירה" = כמה יחד */
async function renderBackupBooks() {
  const home = subPage(T('bkBooksT'));
  const back = home.querySelector('.lib-back span'); if (back) back.textContent = T('bkTitle');
  const top = home.querySelector('.lib-top');
  const selBtn = h('button', 'lib-textbtn', T('bkSelect')); selBtn.type = 'button';
  top.append(selBtn);
  const box = h('div', 'lib-ios lib-card lib-bklist');
  box.append(h('div', 'lib-row', T('bkLoading')));
  home.append(box);
  const foot = h('p', 'lib-foot', T('bkBooksNote'));
  home.append(foot);
  const bar = h('div', 'lib-selbar'); bar.hidden = true;
  const bRestore = h('button', 'lib-btn', ''); bRestore.type = 'button';
  const bDel = h('button', 'lib-btn danger', ''); bDel.type = 'button';
  bar.append(bRestore, bDel);
  home.append(bar);
  let o;
  try { o = await BK.overview(); } catch (e) { box.textContent = ''; box.append(h('div', 'lib-row err', bkErrText(e))); return; }
  if (!root || !ui.view || !ui.view.bkbooks) return;
  box.textContent = '';
  if (!o.books.length) { box.append(h('div', 'lib-row', T('bkEmpty'))); selBtn.hidden = true; return; }
  const local = new Map((await allBooks()).map((b) => [b.id, b]));
  const picked = new Set();
  let selecting = false;
  const paintBar = () => {
    bar.hidden = !selecting;
    const n = picked.size;
    const off = [...picked].filter((id) => !local.has(id)).length;
    bRestore.textContent = T('bkRestoreN', { n: off }); bRestore.disabled = !off;
    bDel.textContent = T('bkDeleteN', { n }); bDel.disabled = !n;
  };
  selBtn.addEventListener('click', () => {
    selecting = !selecting; picked.clear();
    selBtn.textContent = T(selecting ? 'libCancel' : 'bkSelect');
    box.classList.toggle('selecting', selecting);
    box.querySelectorAll('.lib-bkbook').forEach((r) => r.classList.remove('picked'));
    paintBar();
  });
  const restoreIds = async (ids, then) => {
    flashSafe(T('bkRestoring', { n: 0, t: ids.length }));
    cloudBooks = null;
    try { const n = await BK.restore(ids); flashSafe(T('bkRestored', { n })); indexAll(); if (then) then(); else if (ui.view && ui.view.bkbooks) renderBackupBooks(); }
    catch (e) { flashSafe(bkErrText(e)); }
  };
  const delIds = (ids) => {
    const go = async () => { cloudBooks = null; try { await BK.removeFromBackup(ids); flashSafe(T('bkRemoved', { n: ids.length })); } catch (e) { flashSafe(bkErrText(e)); } if (ui.view && ui.view.bkbooks) renderBackupBooks(); };
    if (typeof askConfirm === 'function') askConfirm(T(ids.length > 1 ? 'bkRemoveManyQ' : 'bkRemoveQ', { n: ids.length, t: (o.books.find((x) => x.id === ids[0]) || {}).title || '' }), go, { danger: true, ok: T('bkDeleteOk') }); else go();
  };
  bRestore.addEventListener('click', () => { const ids = [...picked].filter((id) => !local.has(id)); if (ids.length) restoreIds(ids); });
  bDel.addEventListener('click', () => { if (picked.size) delIds([...picked]); });
  o.books.forEach((x) => {
    const r = h('button', 'lib-row lib-bkbook'); r.type = 'button';
    const lb = local.get(x.id);
    const th = h('span', 'lib-bkth');
    if (lb) th.append(cover(lb, true));
    else if (x.coverId) BK.coverBlob(x.coverId).then((bl) => { if (!bl) return; const im = document.createElement('img'); im.alt = ''; im.src = URL.createObjectURL(bl); th.append(im); th.classList.add('img'); }).catch(() => {});
    const m = h('span', 'lib-bkm');
    const t1 = h('b', null, x.title); t1.dir = 'auto';
    const t2 = h('small', null, [x.author, fmtBytes(x.size)].filter(Boolean).join(' · ')); t2.dir = 'auto';
    m.append(t1, t2);
    const tag = h('span', 'lib-tag' + (x.onPhone ? ' on' : ''), T(x.onPhone ? 'bkOnPhone' : 'bkOnlyBackup'));
    const ck = h('span', 'lib-ck');
    r.append(ck, th, m, tag);
    r.addEventListener('click', () => {
      if (selecting) { if (picked.has(x.id)) picked.delete(x.id); else picked.add(x.id); r.classList.toggle('picked', picked.has(x.id)); paintBar(); return; }
      if (x.onPhone) goView({ book: x.id });
      else restoreIds([x.id]);
    });
    wireHold(r, () => {
      if (selecting) return;
      const acts = [{ kind: 'edit', fn: () => (x.onPhone ? goView({ edit: x.id }) : restoreIds([x.id], () => goView({ edit: x.id }))) }, { kind: 'del', fn: () => delIds([x.id]) }];
      if (typeof showItemActions === 'function') showItemActions(r, acts);
    });
    box.append(r);
  });
}
function flashSafe(m) { if (typeof flash === 'function') flash(m); }

async function renderBook(id) {
  const home = root.querySelector('.lib-home');
  let b = (await allBooks()).find((x) => x.id === id);
  if (!b) { ui.view = null; return renderHome(); }
  let book = null;
  if (!b.meta) {                          // ספר שיובא לפני v305 — משלימים זמן קריאה/פרקים/תקציר פעם אחת
    try { const f = await getFile(id); book = await makeBook(f); Object.assign(b, bookExtras(book)); await putBook(b); } catch (e) {}
  }
  if (!root || !ui.view || ui.view.book !== id) return;
  home.textContent = '';
  const top = h('div', 'lib-top');
  const back = h('button', 'lib-back'); back.type = 'button'; back.innerHTML = ICON.back; back.append(h('span', null, T('libTitle')));
  back.addEventListener('click', () => history.back());
  top.append(back);
  const d = h('div', 'bk');
  const cv = cover(b); cv.classList.add('bk-cover');
  d.append(cv, h('h2', 'bk-title', b.title));
  if (b.subtitle) { const st = h('div', 'bk-subtitle', b.subtitle); st.dir = 'auto'; d.append(st); }
  if (b.series) { const se = h('div', 'bk-series', b.series + (b.seriesIdx ? ' · ' + b.seriesIdx : '')); se.dir = 'auto'; d.append(se); }
  // שם המוציא רק כשהוא בשפת הממשק (מוציא באנגלית במכתב עברי שובר את כיוון השורה); כל חלק מבודד לכיוון שלו
  const heUi = !((typeof getLang === 'function' && getLang()) === 'en');
  const by = [b.pub, b.author].find((x) => x && /[\u0590-\u05FF]/.test(x) === heUi) || '';
  const parts = [by, fmtDate(b.date)].filter(Boolean);
  if (parts.length) {
    const sub = h('div', 'bk-sub');
    parts.forEach((x, i) => { if (i) sub.append(' · '); const bd = document.createElement('bdi'); bd.textContent = x; sub.append(bd); });
    d.append(sub);
  }
  const stats = h('div', 'bk-stats');
  const stat = (v, k) => { const x = h('div'); x.append(h('b', null, v), h('span', null, k)); stats.append(x); };
  if (b.chapters) stat(String(b.chapters), T('bkChapters'));
  if (b.minutes) stat('~' + b.minutes, T('bkMinutes'));
  stat(Math.round((b.fraction || 0) * 100) + '%', T('bkReadPct'));
  d.append(stats);
  const cta = h('button', 'bk-cta', T(b.done ? 'bkAgain' : b.fraction > 0 ? 'bkContinue' : 'bkRead')); cta.type = 'button';
  cta.addEventListener('click', () => openReader(id, b.done ? { fromStart: true } : null));
  d.append(cta);
  const acBox = h('div', 'ac-ins');
  d.append(acBox);
  if (b.src === 'drive' && b.driveId) fillInsight(b, acBox);
  if (b.desc && !b.ins) {
    const c = h('div', 'bk-card'); c.append(h('h4', null, T('bkAbout')));
    const pp = h('p', 'bk-desc', b.desc); pp.dir = 'auto';
    c.append(pp);
    c.addEventListener('click', () => c.classList.toggle('open'));
    d.append(c);
  }
  const toc = h('details', 'bk-card bk-toc');
  toc.append(h('summary', null, T('rdToc')));
  toc.addEventListener('toggle', async () => {
    if (!toc.open || toc.dataset.ok) return;
    toc.dataset.ok = '1';
    try { if (!book) book = await makeBook(await getFile(id)); } catch (e) { return; }
    const list = h('div', 'lib-ios');
    const walk = (items, depth) => (items || []).forEach((it) => {
      const r = h('button', 'lib-row'); r.type = 'button'; r.style.paddingInlineStart = (14 + depth * 16) + 'px';
      r.append(h('span', null, langText(it.label)));
      r.addEventListener('click', () => openReader(id, { href: it.href }));
      list.append(r);
      walk(it.subitems, depth + 1);
    });
    walk(book.toc, 0);
    toc.append(list);
  });
  d.append(toc);
  home.append(top, d);
}

/* ---------------- עריכת פרטי ספר + משיכה מהאינטרנט (v316) ----------------
   כמו "עריכת מטא־דאטה" ו"הורדת מטא־דאטה" של Calibre: כל השדות המקובלים, כריכה מהטלפון או מהרשת, ומועמדים מארבעה מאגרים
   (הספרייה הלאומית — הרשמי לעברית, Google Books, Open Library, Apple Books) דרך השרתון /api/bookmeta.
   השינויים נשמרים ברשומת הספר בטלפון (rec.edit) — הקובץ ב־Drive לא משתנה, והעריכה שורדת גם עדכון שלו. */
const SRC_LABEL = { nli: 'srcNli', google: 'srcGoogle', openlibrary: 'srcOpenlibrary', apple: 'srcApple' };
function metaApi(body) {
  const base = (typeof IBKR_PROXY_DEFAULT !== 'undefined' && IBKR_PROXY_DEFAULT) || '';
  const headers = Object.assign({ 'Content-Type': 'application/json' }, typeof ibkrProxyHeaders === 'function' ? ibkrProxyHeaders() : {});
  return fetch(base + '/api/bookmeta', { method: 'POST', headers, body: JSON.stringify(body) });
}
async function remoteCover(url) {   // כריכה מהרשת — דרך השרתון (רשימת מארחים מאושרת), חוזרת כ־Blob
  const r = await metaApi({ op: 'cover', url });
  if (!r.ok || !/^image\//.test(r.headers.get('content-type') || '')) throw new Error('cover');
  return r.blob();
}
/* ממלאים שדות שחסרים ברשומה מתוך הקובץ עצמו (כותר משנה, סדרה, ISBN, נושאים, שפה, שם למיון) */
function fileDefaults(md) {
  const ids = [].concat(md.identifier || []).map(langText).join(' ');
  const isbn = (ids.match(/97[89][0-9-]{10,14}|\b\d{9}[\dX]\b/) || [''])[0].replace(/-/g, '');
  const ser = md.belongsTo && md.belongsTo.series ? [].concat(md.belongsTo.series)[0] : null;
  const au = [].concat(md.author || [])[0];
  return { subtitle: langText(md.subtitle), series: ser ? langText(ser.name) : '', seriesIdx: ser && ser.position != null ? String(ser.position) : '',
    isbn, tags: [].concat(md.subject || []).map(langText).filter(Boolean).join(', '), lang: [].concat(md.language || [])[0] || '',
    authorSort: au && typeof au === 'object' && au.sortAs ? langText(au.sortAs) : '' };
}
async function renderEdit(id) {
  const all = await allBooksRaw();
  const b = all.find((x) => x.id === id);
  if (!b) { ui.view = null; return renderHome(); }
  let defs = {};
  try { const f = await getFile(id); if (f) defs = fileDefaults((await makeBook(f)).metadata || {}); } catch (e) {}
  if (!root || !ui.view || ui.view.edit !== id) return;
  const home = subPage(T('edTitleT'));
  const val = (k) => (b.edit && typeof b.edit[k] === 'string') ? b.edit[k] : (b[k] != null && b[k] !== '' ? String(b[k]) : (defs[k] || ''));
  let newCover = null, coverReset = false, coverJob = null;   // coverJob — כריכה מהרשת שעוד בדרך (השמירה מחכה לה)
  // כריכה
  const cvBox = h('div', 'ed-cover');
  const cvImg = h('div', 'ed-cv');
  const paintCover = () => {
    cvImg.textContent = '';
    if (newCover) { const im = document.createElement('img'); im.src = URL.createObjectURL(newCover.blob); im.alt = ''; cvImg.append(im); cvImg.style.aspectRatio = String(newCover.w / newCover.h); }
    else { const c = cover(coverReset ? Object.assign({}, b, { cover: null }) : b); cvImg.append(c); cvImg.style.aspectRatio = ''; }
  };
  paintCover();
  const cvActs = h('div', 'ed-cv-acts');
  const pick = h('label', 'ed-btn'); pick.append(h('span', null, T('edCoverPick')));
  const fin = h('input'); fin.type = 'file'; fin.accept = 'image/*';
  fin.addEventListener('change', async () => {
    const f = fin.files && fin.files[0]; fin.value = '';
    if (!f) return;
    try { newCover = await coverFromBlob(f); coverReset = false; paintCover(); } catch (e) { if (typeof flash === 'function') flash(T('edCoverErr')); }
  });
  pick.append(fin);
  cvActs.append(pick);
  if (b.coverCustom) {
    const rs = h('button', 'ed-btn ghost', T('edCoverReset')); rs.type = 'button';
    rs.addEventListener('click', () => { newCover = null; coverReset = true; paintCover(); });
    cvActs.append(rs);
  }
  cvBox.append(cvImg, cvActs);
  home.append(cvBox);
  // שדות
  const form = h('div', 'bk-card ed-form');
  const inputs = {};
  const field = (k, label, opt) => {
    const row = h('label', 'ed-row');
    row.append(h('span', 'ed-lbl', T(label)));
    const inp = h(opt && opt.multi ? 'textarea' : 'input', 'ed-in');
    if (!(opt && opt.multi)) inp.type = 'text';
    if (opt && opt.ltr) inp.dir = 'ltr'; else inp.dir = 'auto';
    if (opt && opt.ph) inp.placeholder = opt.ph;
    inp.value = val(k);
    inp.addEventListener('input', () => row.classList.remove('filled'));
    inputs[k] = inp;
    row.append(inp);
    form.append(row);
  };
  field('title', 'edTitle');
  field('subtitle', 'edSubtitle');
  field('author', 'edAuthor');
  field('authorSort', 'edAuthorSort');
  field('pub', 'edPub');
  field('date', 'edDate', { ltr: true, ph: 'YYYY-MM-DD' });
  field('lang', 'edLang', { ltr: true, ph: 'he / en' });
  field('series', 'edSeries');
  field('seriesIdx', 'edSeriesIdx', { ltr: true });
  field('isbn', 'edIsbn', { ltr: true });
  field('tags', 'edTags');
  field('desc', 'edDesc', { multi: true });
  // משיכה מהאינטרנט
  const fetchBtn = h('button', 'ed-fetch', T('edFetch')); fetchBtn.type = 'button';
  const results = h('div', 'ed-results');
  const setVals = (r, onlyCover) => {
    if (!onlyCover) {
      const put = (k, v) => { if (v == null || v === '' || (Array.isArray(v) && !v.length)) return; inputs[k].value = Array.isArray(v) ? v.join(', ') : String(v); inputs[k].closest('.ed-row').classList.add('filled'); };
      put('title', r.title); put('subtitle', r.subtitle); put('author', r.authors.join(', '));
      put('authorSort', r.authorSort); put('pub', r.publisher); put('date', r.date || (r.year ? String(r.year) : ''));
      put('lang', r.lang); put('series', r.series); put('seriesIdx', r.seriesIndex); put('isbn', r.isbn); put('tags', r.tags); put('desc', r.desc);
    }
    if (r.cover) {
      cvBox.classList.add('loading');
      coverJob = remoteCover(r.cover).then(coverFromBlob).then((c) => { if (c) { newCover = c; coverReset = false; paintCover(); } })
        .catch(() => { if (typeof flash === 'function') flash(T('edCoverErr')); })
        .finally(() => { coverJob = null; cvBox.classList.remove('loading'); });
    }
    if (typeof flash === 'function') flash(T(onlyCover ? 'edCoverSet' : 'edFilled'));
    cvBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  fetchBtn.addEventListener('click', async () => {
    fetchBtn.disabled = true; results.textContent = '';
    results.append(h('p', 'lib-empty', T('edFetching')));
    let j = null;
    try {
      j = await metaApi({ op: 'search', isbn: inputs.isbn.value, title: inputs.title.value, author: inputs.author.value.split(',')[0], lang: inputs.lang.value }).then((r) => r.json());
    } catch (e) {}
    fetchBtn.disabled = false; results.textContent = '';
    const list = (j && j.ok && j.results) || [];
    if (!list.length) { results.append(h('p', 'lib-empty', T(j && j.ok ? 'edNone' : 'edFetchErr'))); return; }
    list.slice(0, 12).forEach((r) => {
      const row = h('div', 'ed-res');
      const th = h('div', 'ed-th');
      if (r.cover) remoteCover(r.cover).then((bl) => { const im = document.createElement('img'); im.alt = ''; im.src = URL.createObjectURL(bl); th.append(im); }).catch(() => th.classList.add('none'));
      else th.classList.add('none');
      const m = h('div', 'ed-res-m');
      const t1 = h('b', null, r.title + (r.subtitle ? ': ' + r.subtitle : '')); t1.dir = 'auto';
      const t2 = h('span', null, [r.authors.join(', '), r.publisher, r.year || ''].filter(Boolean).join(' · ')); t2.dir = 'auto';
      const t3 = h('small', 'ed-src', T(SRC_LABEL[r.src]) + (r.isbn ? ' · ISBN ' + r.isbn : ''));
      m.append(t1, t2, t3);
      const acts = h('div', 'ed-res-a');
      const use = h('button', 'mini-btn', T('edUse')); use.type = 'button';
      use.addEventListener('click', () => setVals(r, false));
      acts.append(use);
      if (r.cover) { const oc = h('button', 'mini-btn ghost', T('edCoverOnly')); oc.type = 'button'; oc.addEventListener('click', () => setVals(r, true)); acts.append(oc); }
      row.append(th, m, acts);
      results.append(row);
    });
  });
  // שמירה
  const save = h('button', 'bk-cta ed-save', T('edSave')); save.type = 'button';
  save.addEventListener('click', async () => {
    if (save.disabled) return;
    if (coverJob) { save.disabled = true; await Promise.race([coverJob, new Promise((r) => setTimeout(r, 15000))]); save.disabled = false; }
    const cur = (await allBooksRaw()).find((x) => x.id === id);
    if (!cur) return;
    const e = {};
    EDIT_FIELDS.forEach((k) => { e[k] = inputs[k].value; });
    cur.edit = e; applyEdit(cur, e);
    if (newCover) Object.assign(cur, { cover: newCover.blob, coverRatio: newCover.w / newCover.h, coverCustom: 1, coverV: 1 });
    else if (coverReset) { delete cur.coverCustom; delete cur.cover; delete cur.coverRatio; delete cur.coverV; }   // השלמת הכריכה מהקובץ תחזיר אותה
    if (cur.src !== 'drive') cur.bkD = Date.now();   // v318: העריכה עוברת גם לגיבוי
    await putBook(cur);
    if (coverReset) backfillCovers();
    BK.schedule();
    if (typeof flash === 'function') flash(T('edSaved'));
    history.back();
  });
  home.append(form, fetchBtn, results, save);
  // שחזור הפרטים מהקובץ (ביטול כל העריכות)
  if (b.edit || b.coverCustom) {
    const undo = h('button', 'lib-admin-link', T('edReset')); undo.type = 'button';
    undo.addEventListener('click', () => {
      const go = async () => {
        const cur = (await allBooksRaw()).find((x) => x.id === id); if (!cur) return;
        delete cur.edit; delete cur.coverCustom; delete cur.cover; delete cur.coverRatio; delete cur.coverV;
        // הקובץ השמור נקרא מחדש: הפרטים והכריכה שבו חוזרים, ההתקדמות וההדגשות נשמרות (אותו md5 — בלי הורדה מחדש)
        try { const f = await getFile(id); if (f) { await putBook(cur); await importFiles([f], { driveId: cur.driveId, md5: cur.md5 || '', src: cur.src }); } } catch (er) { await putBook(cur); }
        if (typeof flash === 'function') flash(T('edRestored'));
        history.back();
      };
      if (typeof askConfirm === 'function') askConfirm(T('edResetQ'), go, { danger: true, ok: T('edResetOk') }); else go();
    });
    home.append(undo);
  }
}

function ring(frac) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 36 36'); svg.setAttribute('class', 'ac-ring'); svg.setAttribute('aria-hidden', 'true');
  const c1 = document.createElementNS(NS, 'circle'); c1.setAttribute('cx', 18); c1.setAttribute('cy', 18); c1.setAttribute('r', 15); c1.setAttribute('class', 'bg');
  const c2 = document.createElementNS(NS, 'circle'); c2.setAttribute('cx', 18); c2.setAttribute('cy', 18); c2.setAttribute('r', 15); c2.setAttribute('class', 'fg');
  c2.setAttribute('stroke-dasharray', (Math.max(0, Math.min(1, frac)) * 94.25).toFixed(1) + ' 94.25');
  svg.append(c1, c2);
  return svg;
}
function subPage(title, sub) {
  const home = root.querySelector('.lib-home');
  home.textContent = '';
  const top = h('div', 'lib-top');
  const back = h('button', 'lib-back'); back.type = 'button'; back.innerHTML = ICON.back; back.append(h('span', null, T('libTitle')));
  back.addEventListener('click', () => history.back());
  top.append(back);
  home.append(top, h('h1', 'lib-large', title));
  if (sub) home.append(h('p', 'ac-sub', sub));
  return home;
}
async function renderTrack(id) {
  const tr = TRACKS.find((x) => x.id === id); if (!tr) return;
  const steps = trackSteps(tr, await allBooks());
  if (!root || !ui.view || ui.view.track !== id) return;
  const home = subPage(tr.he, tr.sub);
  const list = h('div', 'ac-steps');
  steps.forEach((st, i) => {
    const r = h('button', 'ac-step' + (st.book.done ? ' done' : '')); r.type = 'button';
    const dot = h('span', 'ac-dot', st.book.done ? '✓' : String(i + 1));
    const meta = h('div', 'ac-step-m'); meta.append(h('b', null, st.why), h('span', null, st.book.title + (st.book.fraction > 0 && !st.book.done ? ' · ' + Math.round(st.book.fraction * 100) + '%' : '')));
    r.append(dot, meta);
    r.addEventListener('click', () => goView({ book: st.book.id }));
    list.append(r);
  });
  home.append(list);
}
function renderThinkers() {
  const home = subPage(T('acThinkers'), T('acThinkersSub'));
  const list = h('div', 'ac-people');
  THINKERS.forEach((p) => {
    const r = h('button', 'ac-person'); r.type = 'button';
    r.append(h('span', 'ac-av', p.he.replace(/[׳']/g, '').split(' ').map((w) => w[0]).join('').slice(0, 2)));
    const m = h('div'); m.append(h('b', null, p.he), h('span', null, p.role + ' · ' + p.years)); r.append(m);
    r.addEventListener('click', () => goView({ thinker: p.id }));
    list.append(r);
  });
  home.append(list);
}
function renderThinker(id) {
  const p = THINKERS.find((x) => x.id === id); if (!p) return;
  const home = subPage(p.he, p.en + ' · ' + p.years + ' · ' + p.role);
  const card = h('div', 'bk-card ac-card'); card.append(h('h4', null, T('acIdeas')));
  const ul = h('ul', 'ac-ul'); p.ideas.forEach((x) => ul.append(h('li', null, x))); card.append(ul);
  home.append(card);
  if (p.quote) { const q = h('blockquote', 'ac-quote', '“' + p.quote + '”'); q.dir = 'ltr'; home.append(q); }
  const bk = h('div', 'bk-card ac-card'); bk.append(h('h4', null, T('acBooks')));
  p.books.forEach((x) => { const d = h('div', 'ac-book', x); d.dir = 'auto'; bk.append(d); });
  home.append(bk);
  const terms = GLOSSARY.filter((g) => g[3] === id);
  if (terms.length) {
    const tc = h('div', 'bk-card ac-card'); tc.append(h('h4', null, T('acTerms')));
    terms.forEach((g) => tc.append(termRow(g)));
    home.append(tc);
  }
}
function termRow([he, en, def, who]) {
  const r = h('div', 'ac-term');
  const t = h('div', 'ac-term-h'); t.append(h('b', null, he)); if (en && en !== he) { const e = h('span', null, en); e.dir = 'ltr'; t.append(e); }
  r.append(t, h('p', null, def));
  const p = THINKERS.find((x) => x.id === who); if (p) r.append(h('small', null, p.he));
  return r;
}
function renderGlossary() {
  const home = subPage(T('acGlossary'), '');
  const inp = h('input', 'ac-search'); inp.type = 'search'; inp.placeholder = T('acSearch'); inp.dir = 'auto';
  const list = h('div', 'ac-terms');
  const draw = () => {
    const q = normTerm(inp.value);
    list.textContent = '';
    GLOSSARY.filter((g) => !q || normTerm(g[0] + ' ' + g[1] + ' ' + g[2]).includes(q))
      .sort((a, b) => a[0].localeCompare(b[0], 'he')).forEach((g) => list.append(termRow(g)));
    if (!list.childNodes.length) list.append(h('p', 'lib-empty', T('acNoTerm')));
  };
  inp.addEventListener('input', draw);
  home.append(inp, list);
  draw();
}

async function adminApi(op, extra) {
  const tk = await idToken(); if (!tk) throw new Error('signin');
  const j = await libApi(Object.assign({ op, idToken: tk }, extra || {})).then((r) => r.json()).catch(() => ({ ok: false, error: 'net' }));
  if (!j.ok) throw new Error(j.error || 'failed');
  return j;
}
async function renderAdmin() {
  const home = subPage(T('admTitle'), T('admSub'));
  const box = h('div', 'adm'); home.append(box);
  const draw = (j) => {
    box.textContent = '';
    if (j.store !== 'ok') box.append(h('p', 'bk-card ac-card adm-warn', T('admNoStore')));
    const add = h('div', 'adm-add');
    const inp = h('input', 'ac-search'); inp.type = 'email'; inp.placeholder = T('admEmailPh'); inp.dir = 'ltr'; inp.autocomplete = 'off';
    const btn = h('button', 'adm-btn', T('admAdd')); btn.type = 'button'; btn.disabled = j.store !== 'ok';
    btn.addEventListener('click', async () => {
      const email = inp.value.trim(); if (!email) return;
      btn.disabled = true;
      try { draw(await adminApi('addReader', { email })); if (typeof flash === 'function') flash(T('admAdded')); }
      catch (e) { btn.disabled = false; if (typeof flash === 'function') flash(T(String(e.message) === 'bad_email' ? 'admBadEmail' : 'admErr')); }
    });
    add.append(inp, btn); box.append(add);
    const list = (title, items, removable) => {
      const c = h('div', 'bk-card ac-card'); c.append(h('h4', null, title));
      if (!items.length) c.append(h('p', 'adm-empty', T('admNone')));
      items.forEach((x) => {
        const r = h('div', 'adm-row'); const e = h('span', 'adm-mail', x.email || x); e.dir = 'ltr'; r.append(e);
        if (removable) {
          const del = h('button', 'mini-btn danger', T('libRemove')); del.type = 'button';
          del.addEventListener('click', () => {
            const go = async () => { try { draw(await adminApi('removeReader', { email: x.email })); } catch (er) { if (typeof flash === 'function') flash(T('admErr')); } };
            if (typeof askConfirm === 'function') askConfirm(T('admRemoveQ', { e: x.email }), go, { danger: true, ok: T('libRemove') }); else go();
          });
          r.append(del);
        } else r.append(h('small', null, 'Vercel'));
        c.append(r);
      });
      box.append(c);
    };
    list(T('admApp'), j.app || [], true);
    list(T('admEnv'), j.open ? [T('admOpen')] : (j.env || []), false);
    const ref = h('button', 'ac-retry adm-refresh', T('admRefresh')); ref.type = 'button';
    const res = h('p', 'adm-res');
    ref.addEventListener('click', async () => {
      if (ref.disabled) return;
      ref.disabled = true; res.textContent = '';
      const label = T('admRefresh');
      ref.textContent = T('admRefreshing');
      const tick = setInterval(() => {   // התקדמות ההורדה על הכפתור עצמו
        ref.textContent = syncProgress && syncProgress.total ? T('libSyncProg', { n: syncProgress.done, t: syncProgress.total }) : T('admRefreshing');
      }, 300);
      let msg;
      try {
        if (syncing) await syncing;          // סנכרון שכבר רץ (למשל מהכניסה לספרייה) — מחכים לו, ואז רענון אמיתי
        await adminApi('refresh');
        const n = await syncDrive();
        const c = await backfillCovers();
        msg = T('admRefreshed', { n: n + c });
      } catch (e) { msg = T('admErr'); }
      clearInterval(tick);
      ref.textContent = label; ref.disabled = false;
      res.textContent = msg;
      if (typeof flash === 'function') flash(msg);
    });
    box.append(ref, res);
  };
  box.append(h('p', 'lib-empty', T('libSyncing')));
  try { draw(await adminApi('readers')); } catch (e) { box.textContent = ''; box.append(h('p', 'lib-empty', T('admErr'))); }
}

async function renderNotes() {
  const home = root.querySelector('.lib-home');
  const books = sortBooks((await allBooks()).filter((b) => liveAnn(b.ann).length), 'recent');
  if (!root || !ui.view || !ui.view.notes) return;
  home.textContent = '';
  const top = h('div', 'lib-top');
  const back = h('button', 'lib-back'); back.type = 'button'; back.innerHTML = ICON.back; back.append(h('span', null, T('libTitle')));
  back.addEventListener('click', () => history.back());
  top.append(back);
  home.append(top, h('h1', 'lib-large', T('learnTitle')));
  if (!books.length) { home.append(h('p', 'lib-empty', T('learnEmpty'))); return; }
  books.forEach((b) => {
    const list = liveAnn(b.ann);
    const sec = h('section', 'learn-sec');
    const head = h('div', 'learn-h'); head.append(h('b', null, b.title), h('span', null, T('learnCount', { n: list.length })));
    sec.append(head);
    list.forEach((a) => sec.append(annRow(a, () => openReader(b.id, { cfi: a.c }))));
    home.append(sec);
  });
}
const insFlight = new Map();
function fetchInsight(b) {
  if (insFlight.has(b.id)) return insFlight.get(b.id);
  const pr = (async () => {
    const tk = await idToken(); if (!tk) throw new Error('signin');
    const r = await libApi({ op: 'insight', idToken: tk, id: b.driveId });
    const j = await r.json().catch(() => ({}));
    if (!j.ok) throw new Error(j.error || 'failed');
    b.ins = Object.assign({}, j.insight, { md5: j.md5 || b.md5, at: Date.now() });
    await putBook(b);
    return b.ins;
  })().finally(() => insFlight.delete(b.id));
  insFlight.set(b.id, pr);
  return pr;
}
function fillInsight(b, box) {
  const fresh = b.ins && (!b.md5 || b.ins.md5 === b.md5);
  if (fresh) { box.append(...insightCards(b.ins)); return; }
  const wait = h('div', 'bk-card ac-wait'); wait.append(h('h4', null, T('bkAbout')), h('p', null, T('acMaking')), h('i', 'ac-skel'), h('i', 'ac-skel s2'));
  box.append(wait);
  fetchInsight(b).then((ins) => { if (wait.isConnected) wait.replaceWith(...insightCards(ins)); }).catch((e) => {
    if (!wait.isConnected) return;
    wait.textContent = '';
    wait.append(h('h4', null, T('bkAbout')), h('p', null, T(String(e.message) === 'quota' || String(e.message) === 'rate_limited' ? 'acQuota' : 'acFailed')));
    const again = h('button', 'ac-retry', T('acRetry')); again.type = 'button';
    again.addEventListener('click', () => { wait.remove(); fillInsight(b, box); });
    wait.append(again);
  });
}
function insightCards(ins) {
  const out = [];
  const card = (k, body) => { const c = h('div', 'bk-card ac-card'); c.append(h('h4', null, T(k))); body(c); out.push(c); };
  card('bkAbout', (c) => { const p = h('p', 'bk-desc', ins.summary); p.dir = 'auto'; c.append(p); c.addEventListener('click', () => c.classList.toggle('open')); });
  if (ins.ideas && ins.ideas.length) card('acIdeas', (c) => { const ul = h('ul', 'ac-ul'); ins.ideas.forEach((x) => ul.append(h('li', null, x))); c.append(ul); });
  if (ins.lens && ins.lens.length) card('acLens', (c) => ins.lens.forEach((l) => {
    const p = THINKERS.find((x) => x.id === l.thinker);
    const r = h('button', 'ac-lens'); r.type = 'button';
    r.append(h('b', null, p ? p.he : l.thinker), h('span', null, l.point));
    if (p) r.addEventListener('click', () => goView({ thinker: p.id }));
    c.append(r);
  }));
  if (ins.terms && ins.terms.length) card('acTermsHere', (c) => ins.terms.forEach((t) => c.append(termRow([t.he, t.en, t.def, '']))));
  if (ins.question) card('acQuestion', (c) => { const p = h('p', 'ac-q', ins.question); p.dir = 'auto'; c.append(p); });
  const note = h('p', 'ac-ai', T('acAiNote')); out.push(note);
  return out;
}

function fmtDate(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  try { return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString((typeof getLang === 'function' && getLang()) === 'en' ? 'en-US' : 'he-IL', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return iso; }
}

/* חיפוש בספרייה — סלחני כמו בגוגל: שם, כותב, שנה, מוציא ותקציר.
   מבין טעויות כתיב (מרחק עריכה כולל החלפת סדר), כתיב מלא/חסר ואותיות סופיות (בופט≈באפט), מקלדת בשפה הלא נכונה
   (ניררקאא = buffett), ושמות באנגלית לכותבים בעברית. מסנן ומדרג במקום — בלי לבנות את המסך מחדש (המקלדת נשארת פתוחה). */
const FINALS = { 'ם': 'מ', 'ן': 'נ', 'ץ': 'צ', 'ף': 'פ', 'ך': 'כ' };
const fold = (s) => normTerm(s).replace(/[םןץףך]/g, (c) => FINALS[c]);
const skel = (w) => (/[א-ת]/.test(w) ? w[0] + w.slice(1).replace(/[אויה]/g, '') : w.replace(/(?!^)[aeiouy]/g, ''));
const ALIASES = [[/באפט/, 'buffett berkshire ברקשייר'], [/buffett/i, 'באפט ברקשייר'], [/מאנגר/, 'munger'], [/munger/i, 'מאנגר'],
  [/ברקשייר/, 'berkshire'], [/דיימון/, 'dimon jpmorgan'], [/dimon/i, 'דיימון']];
const EN_HE = { q: '/', w: "'", e: 'ק', r: 'ר', t: 'א', y: 'ט', u: 'ו', i: 'ן', o: 'ם', p: 'פ', a: 'ש', s: 'ד', d: 'ג', f: 'כ', g: 'ע', h: 'י', j: 'ח', k: 'ל', l: 'ך', ';': 'ף', z: 'ז', x: 'ס', c: 'ב', v: 'ה', b: 'נ', n: 'מ', m: 'צ', ',': 'ת', '.': 'ץ' };
const HE_EN = Object.fromEntries(Object.entries(EN_HE).map(([a, b]) => [b, a]));
export function swapLayout(q) {         // טקסט שהוקלד במקלדת בשפה הלא נכונה
  const he = /[א-ת]/.test(q);
  return Array.from(String(q).toLowerCase()).map((c) => (he ? HE_EN[c] : EN_HE[c]) || c).join('');
}
export function editDist(a, b, max) {   // Damerau (OSA) עם עצירה מוקדמת
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const m = a.length, n = b.length;
  let p2 = null, p1 = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i]; let best = i;
    for (let j = 1; j <= n; j++) {
      let v = Math.min(p1[j] + 1, cur[j - 1] + 1, p1[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (p2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, p2[j - 2] + 1);
      cur.push(v); if (v < best) best = v;
    }
    if (best > max) return max + 1;
    p2 = p1; p1 = cur;
  }
  return p1[n];
}
export function searchKey(b) {
  let k = [b.title, b.author, b.pub, b.year || '', b.desc || '', b.ins && b.ins.summary || ''].join(' ');
  ALIASES.forEach(([re, add]) => { if (re.test(k)) k += ' ' + add; });
  return fold(k);
}
function wordScore(w, tokens) {         // 0 = לא נמצא; גבוה = התאמה טובה
  let best = 0;
  const th = w.length <= 3 ? 0 : w.length <= 5 ? 1 : 2;
  const sw = skel(w);
  const num = /^\d+$/.test(w);
  for (const t of tokens) {
    if (t === w) return 4;
    if (num) {                          // שנה: רק מדויקת או שתי ספרות שהתחלפו (1897 ← 1987) — לא 1986/1988
      if (t.length === w.length && /^\d+$/.test(t) && [...t].sort().join() === [...w].sort().join() && editDist(w, t, 1) <= 1) best = Math.max(best, 1.5);
      continue;
    }
    if (t.startsWith(w) && w.length >= 2) best = Math.max(best, 3);
    else if (w.length >= 3 && t.includes(w)) best = Math.max(best, 2.5);
    if (best >= 3 || !th) continue;
    const d = editDist(w, t.length > w.length + 2 ? t.slice(0, w.length + 1) : t, th);   // גם תחילת מילה ארוכה ("מכתוב" ≈ "מכתבים")
    if (d <= th) best = Math.max(best, 2 - d * 0.5);
    else if (sw.length >= 2 && (skel(t) === sw || editDist(sw, skel(t), 1) <= (sw.length >= 4 ? 1 : 0))) best = Math.max(best, 1);
  }
  return best;
}
export function searchScore(key, q) {   // 0 = לא מתאים; כל מילה בשאילתה חייבת להימצא
  const tokens = key.split(' ').filter(Boolean);
  const run = (qq) => {
    const words = fold(qq).split(' ').filter(Boolean);
    if (!words.length) return 1;
    let sum = 0;
    for (const w of words) { const sc = wordScore(w, tokens); if (!sc) return 0; sum += sc; }
    return sum / words.length;
  };
  return Math.max(run(q), run(swapLayout(q)) * 0.9);
}
export function searchHit(key, q) { return searchScore(key, q) > 0; }
function applySearch(home) {
  const q = (ui.q || '').trim();
  home.classList.toggle('searching', !!q);
  const grid = home.querySelector('.lib-grid');
  const items = Array.from(home.querySelectorAll('.lib-item'));
  let n = 0, exact = 0;
  const scored = items.map((it, i) => ({ it, sc: q ? searchScore(it.dataset.q || '', q) : 1, i: +(it.dataset.i || i) }));
  exact = scored.filter((x) => x.sc >= 2.5).length;
  scored.forEach((x) => { const on = x.sc > 0 && (!exact || x.sc >= 2.5); x.it.hidden = !on; if (on) n++; });   // יש התאמה מדויקת — בלי "קרובים"
  if (grid) (q ? scored.slice().sort((a, b) => b.sc - a.sc || a.i - b.i) : scored.slice().sort((a, b) => a.i - b.i)).forEach((x) => grid.append(x.it));
  const cnt = home.querySelector('.lib-count');
  if (cnt) cnt.textContent = T('libCount', { n: q ? n : +cnt.dataset.n });
  const none = home.querySelector('.lib-noq'); if (none) none.hidden = !(q && !n);
  const near = home.querySelector('.lib-near'); if (near) near.hidden = !(q && n && !exact);
  const sr = home.querySelector('.lib-sortrow'); if (sr) sr.hidden = !!(q && !n);   // אין התאמה בשמות — בלי "0 ספרים"
  clearTimeout(ftTimer);
  const ft = home.querySelector('.lib-ft');
  if (ft) { if (!q || q.length < 2) { ft.hidden = true; ft.textContent = ''; } else ftTimer = setTimeout(() => renderFt(home, q), 280); }
}
let ftTimer = 0, ftSeq = 0;
async function renderFt(home, q) {
  const ft = home.querySelector('.lib-ft'); if (!ft) return;
  const seq = ++ftSeq;
  const res = (await ftSearch(q)).filter((r) => shelfOf(r.b) === ui.shelf);   // v318: רק בספרייה שנבחרה
  if (seq !== ftSeq || (ui.q || '').trim() !== q) return;
  ft.textContent = ''; ft.hidden = false;
  const total = res.reduce((a, r) => a + r.hits.length, 0);
  const head = h('div', 'ft-head'); head.append(h('h2', 'ac-h', T('ftTitle')), h('span', null, total ? T('ftCount', { n: total >= 40 * res.length ? total + '+' : total }) : ''));
  ft.append(head);
  if (ftState.total && ftState.done < ftState.total) ft.append(h('p', 'lib-near', T('ftIndexing', { n: ftState.done, t: ftState.total })));
  if (!res.length) { ft.append(h('p', 'lib-empty', T('ftNone'))); }
  res.slice(0, 30).forEach(({ b, hits }) => {
    const sec = h('section', 'ft-book');
    const bh = h('div', 'learn-h'); bh.append(h('b', null, b.title), h('span', null, T('ftHits', { n: hits.length })));
    sec.append(bh);
    hits.slice(0, 3).forEach((x) => {
      const sn = snippet(x.text, x.pos, x.len);
      const row = h('button', 'ft-row'); row.type = 'button'; row.dir = 'auto';
      const mk = h('mark', null, sn.hit);
      row.append(document.createTextNode(sn.pre), mk, document.createTextNode(sn.post));
      row.addEventListener('click', () => openReader(b.id, { find: { q: x.orig, sec: x.sec, k: x.k } }));
      sec.append(row);
    });
    if (hits.length > 3) {
      const more = h('button', 'ft-more', T('ftMore', { n: hits.length - 3 })); more.type = 'button';
      more.addEventListener('click', () => {
        more.remove();
        hits.slice(3, 40).forEach((x) => {
          const sn = snippet(x.text, x.pos, x.len);
          const row = h('button', 'ft-row'); row.type = 'button'; row.dir = 'auto';
          row.append(document.createTextNode(sn.pre), h('mark', null, sn.hit), document.createTextNode(sn.post));
          row.addEventListener('click', () => openReader(b.id, { find: { q: x.orig, sec: x.sec, k: x.k } }));
          sec.append(row);
        });
      });
      sec.append(more);
    }
    ft.append(sec);
  });
  const none = home.querySelector('.lib-noq'); if (none && res.length) none.hidden = true;
}

function askRemove(b) {
  // מכתב מהספרייה המשותפת היה חוזר בסנכרון הבא — לכן הוא מוסתר (והקובץ נמחק מהטלפון), ואפשר להחזיר אותו
  const drive = b.src === 'drive';
  if (!drive && b.bk && signedIn() && BK.settings().email) return askRemoveBacked(b);   // v318: ספר מגובה — גם מהגיבוי?
  const go = async () => {
    if (drive) {
      const cur = (await allBooksRaw()).find((x) => x.id === b.id);
      if (cur) { cur.hidden = 1; await putBook(cur); }
    } else await tx('books', 'readwrite', (st) => st.delete(b.id));
    await tx('files', 'readwrite', (st) => st.delete(b.id));
    if (ui.view && ui.view.book === b.id) history.back(); else renderHome();
  };
  if (typeof askConfirm === 'function') askConfirm(T(drive ? 'libHideQ' : 'libRemoveQ', { t: b.title }), go, { danger: true, ok: T(drive ? 'libHide' : 'libRemove') });
  else go();
}
function askRemoveBacked(b) {
  sheet('', (sh, close) => {
    sh.append(h('h3', 'lib-sh-big', b.title), h('p', 'lib-sh-p', T('libRemoveBkQ')));
    const done = () => { if (ui.view && ui.view.book === b.id) history.back(); else renderHome(); };
    const local = async () => { await tx('books', 'readwrite', (st) => st.delete(b.id)); await tx('files', 'readwrite', (st) => st.delete(b.id)); };
    const a = h('button', 'lib-btn danger'); a.type = 'button'; a.textContent = T('libRemoveBoth');
    a.addEventListener('click', async () => {
      a.disabled = true;
      try { await BK.removeFromBackup([b.id]); } catch (e) { a.disabled = false; flashSafe(bkErrText(e)); return; }
      await local(); close(); flashSafe(T('libRemovedBoth')); done();
    });
    const p = h('button', 'lib-btn'); p.type = 'button'; p.textContent = T('libRemovePhone');
    p.addEventListener('click', async () => { await local(); close(); flashSafe(T('libRemovedPhone')); done(); });
    const no = h('button', 'lib-btn ghost'); no.type = 'button'; no.textContent = T('libCancel');
    no.addEventListener('click', close);
    sh.append(a, p, no);
  });
}
function openHiddenSheet(list) {
  sheet(T('libHiddenT'), (sh, close) => {
    const box = h('div', 'lib-ios');
    list.forEach((b) => {
      const r = h('div', 'lib-row'); r.append(h('span', null, b.title));
      const bt = h('button', 'mini-btn', T('libRestore')); bt.type = 'button';
      bt.addEventListener('click', async () => {
        const cur = (await allBooksRaw()).find((x) => x.id === b.id);
        if (cur) { delete cur.hidden; cur.md5 = ''; await putBook(cur); }   // md5 ריק → יורד שוב בסנכרון
        r.remove(); if (!box.children.length) close();
        syncDrive().then(() => renderHome());
      });
      r.append(bt); box.append(r);
    });
    sh.append(box);
  });
}
/* לחיצה ארוכה בלי תזוזה (כמו במניות): הספר מורם, ובשחרור — הכפתורים. גלילה/תזוזה מבטלת */
function wireHold(el, onHold) {
  const LONG = 420, SLOP = 10;
  let t = 0, sx = 0, sy = 0, held = false, swallow = false;
  const cancel = () => { clearTimeout(t); t = 0; if (!held) el.classList.remove('pressing'); };
  el.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    held = false; sx = e.clientX; sy = e.clientY;
    clearTimeout(t);
    t = setTimeout(() => { t = 0; held = true; el.classList.add('pressing'); if (navigator.vibrate) try { navigator.vibrate(8); } catch (er) {} }, LONG);
  });
  el.addEventListener('pointermove', (e) => { if (t && Math.hypot(e.clientX - sx, e.clientY - sy) > SLOP) cancel(); });
  el.addEventListener('pointerup', () => {
    if (held) { held = false; swallow = true; el.classList.remove('pressing'); onHold(); }
    else cancel();
  });
  el.addEventListener('pointercancel', () => { held = false; cancel(); el.classList.remove('pressing'); });
  el.addEventListener('click', (e) => { if (swallow) { swallow = false; e.stopImmediatePropagation(); e.preventDefault(); } }, true);
}
function bookActions(host, b) {
  const acts = [{ kind: 'edit', fn: () => goView({ edit: b.id }) }, { kind: 'del', fn: () => askRemove(b) }];
  if (typeof showItemActions === 'function') showItemActions(host, acts);
}

function sheet(title, build) {
  const veil = h('div', 'lib-veil');
  const sh = h('div', 'lib-sheet');
  // שלב 8 (נגישות): דיאלוג אמיתי — קורא מסך יודע שנפתח חלון, הפוקוס נכנס אליו וחוזר למקומו בסגירה
  sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-modal', 'true'); sh.tabIndex = -1;
  if (title) sh.setAttribute('aria-label', title);
  const back = document.activeElement;
  const close = () => { veil.remove(); if (back && back.isConnected && back.focus) try { back.focus({ preventScroll: true }); } catch (e) {} };
  sh.append(h('div', 'lib-grab'));
  if (title) sh.append(h('h3', 'lib-sh-t', title));
  build(sh, close);
  veil.append(sh);
  veil.addEventListener('click', (e) => { if (e.target === veil) close(); });
  veil._close = close;
  root.append(veil);
  try { sh.focus({ preventScroll: true }); } catch (e) {}
  return veil;
}
/* Escape (מקלדת) = "חזור": גיליון/בועה נסגרים, אחרת יציאה מהקורא/מהדף — באותו מסלול כמו כפתור החזור */
function onEscape() {
  const veil = root && root.querySelector('.lib-veil');
  if (veil) { (veil._close || (() => veil.remove()))(); return; }
  if (selPop) { hideSel(); return; }
  if (rd) rd.backAt = Date.now();         // מקלדת — יציאה מיידית, בלי "לחץ שוב"
  history.back();
}

function openSortSheet() {
  sheet(T('libSortTitle'), (sh, close) => {
    const list = h('div', 'lib-ios');
    [['new', 'libSortNew'], ['old', 'libSortOld'], ['recent', 'libSortRecent']].forEach(([v, k]) => {
      const r = h('button', 'lib-row'); r.type = 'button'; r.append(h('span', null, T(k)));
      if (ui.sort === v) r.append(h('span', 'lib-check', '✓'));
      r.addEventListener('click', () => { ui.sort = v; close(); renderHome(); });
      list.append(r);
    });
    sh.append(list);
  });
}

/* ---------------- הקורא ---------------- */
let rd = null; // { view, book, rec, els, chrome, saveT }

function bookCSS() {
  const th = THEMES[S.theme] || THEMES.white;
  const w = WEIGHTS[S.weight] || 400;
  const ourFont = S.font !== 'book';
  return `
    @font-face { font-family: "SNB Noto"; src: url("${FONT_URL}") format("woff2"); font-weight: 100 900; font-stretch: 62.5% 100%; }
    html { color-scheme: ${th.dark ? 'dark' : 'light'}; font-size: ${S.size}px !important; }
    html { background: ${th.page} !important; } /* לא שקוף: color-scheme שונה בין הספר לעמוד צובע את ה־iframe ברקע משלו */
    body { background: transparent !important; }
    html, body { color: ${th.ink} !important; font-weight: ${w}; -webkit-text-size-adjust: 100%; }
    ${ourFont ? `body, p, li, div, span, a, td, th, caption, h1, h2, h3, h4, h5, h6, blockquote, dd, dt, em, i, b, strong, small { font-family: "SNB Noto", sans-serif !important; }` : ''}
    p, li, blockquote, dd { line-height: ${SPACING[S.spacing] || 1.62} !important; text-align: ${S.justify ? 'justify' : 'start'}; hyphens: manual; widows: 2; orphans: 2; }
    [align="left"] { text-align: left; } [align="right"] { text-align: right; } [align="center"] { text-align: center; } [align="justify"] { text-align: justify; }
    table, thead, tbody, tfoot, tr, th, td, hr { border-color: ${th.rule} !important; }
    ${ourFont ? 'table { font-stretch: 90%; }' : ''}
    td.num, .num { font-variant-numeric: tabular-nums; }
    span.en { white-space: nowrap; }
    a, a:link, a:visited { color: ${th.link} !important; }
    ${S.theme !== 'white' ? `body *:not(img):not(svg):not(svg *) { color: inherit !important; background-color: transparent !important; }
    a, a * { color: ${th.link} !important; }` : 'p.note, .note, caption { color: ' + th.ink2 + ' !important; }'}
    pre { white-space: pre-wrap !important; }
    img, svg { max-width: 100%; height: auto; }
    ::selection { background: rgba(48, 209, 88, .32); }
  `;
}

function applyReaderStyle() {
  if (!rd) return;
  const th = THEMES[S.theme] || THEMES.white;
  const box = rd.els.box;
  box.style.setProperty('--rd-page', th.page); box.style.setProperty('--rd-ink', th.ink);
  box.style.setProperty('--rd-ink2', th.ink2); box.style.setProperty('--rd-rule', th.rule);
  box.dataset.dark = th.dark ? '1' : '';
  const r = rd.view.renderer;
  if (!r) return;
  r.setAttribute('flow', S.flow === 'scrolled' ? 'scrolled' : 'paginated');
  r.setAttribute('margin', '44px');
  r.setAttribute('gap', '7%');
  r.setAttribute('max-inline-size', '720px');
  r.setAttribute('max-column-count', '2');
  if (!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) r.setAttribute('animated', '');
  if (r.setStyles) r.setStyles(bookCSS());
}

async function openReader(id, opt) {
  const rec = (await allBooks()).find((b) => b.id === id);
  const file = await getFile(id);
  if (!rec || !file) return;
  if (!(opt && opt.restored)) history.pushState(Object.assign({}, history.state || {}, { lib: 2, book: id }), '');
  else history.replaceState(Object.assign({}, history.state || {}, { lib: 2, book: id }), '');
  const box = h('div', 'rd');
  const view = document.createElement('foliate-view');
  const foot = h('div', 'rd-foot'); const fL = h('span'); const fR = h('span'); foot.append(fL, fR);
  const topBar = h('div', 'rd-topbar');
  const xBtn = h('button', 'rd-ic'); xBtn.type = 'button'; xBtn.innerHTML = ICON.close; xBtn.setAttribute('aria-label', T('rdClose'));
  xBtn.addEventListener('click', () => { rd.closing = true; history.back(); });
  const ttl = h('span', 'rd-ttl', rec.title);
  const acts = h('span', 'rd-acts');
  const tocBtn = h('button', 'rd-ic'); tocBtn.type = 'button'; tocBtn.innerHTML = ICON.list; tocBtn.setAttribute('aria-label', T('rdToc'));
  const bmBtn = h('button', 'rd-ic rd-bm'); bmBtn.type = 'button'; bmBtn.innerHTML = ICON.bookmark; bmBtn.setAttribute('aria-label', T('bmAdd'));
  const ribbon = h('div', 'rd-ribbon');
  const aaBtn = h('button', 'rd-ic rd-aa'); aaBtn.type = 'button'; aaBtn.dir = 'ltr'; aaBtn.innerHTML = 'A<small>a</small>'; aaBtn.setAttribute('aria-label', T('rdSettings'));
  acts.append(bmBtn, tocBtn, aaBtn); topBar.append(xBtn, ttl, acts);
  const botBar = h('div', 'rd-botbar');
  const chap = h('div', 'rd-chap'); const slider = h('input', 'rd-slider'); slider.type = 'range'; slider.min = '0'; slider.max = '1000'; slider.step = '1';
  const nums = h('div', 'rd-nums'); const nL = h('span'); const nR = h('span'); nums.append(nL, nR);
  botBar.append(chap, slider, nums);
  box.append(view, ribbon, foot, topBar, botBar);
  root.append(box);
  rd = { view, rec, els: { box, foot, fL, fR, chap, slider, nL, nR, ttl, bmBtn, ribbon }, chrome: false, saveT: 0, annTap: 0 };
  rec.ann = rec.ann || [];
  const setChrome = (on) => { rd.chrome = on; box.classList.toggle('chrome', on); };
  tocBtn.addEventListener('click', openToc);
  bmBtn.addEventListener('click', toggleBookmark);
  view.addEventListener('create-overlay', () => liveAnn(rd && rd.rec.ann).forEach((a) => view.addAnnotation({ value: a.c }).catch(() => {})));
  view.addEventListener('draw-annotation', (e) => {
    const a = rd && rd.rec.ann.find((x) => x.c === e.detail.annotation.value && !x.d);
    e.detail.draw(Overlayer.highlight, { color: HL_COLORS[(a && a.k) || 'y'] });
  });
  view.addEventListener('show-annotation', (e) => { rd.annTap = Date.now(); annPopup(e.detail.value, e.detail.range, e.detail.index); });
  aaBtn.addEventListener('click', openAa);
  slider.addEventListener('change', () => view.goToFraction(+slider.value / 1000));

  view.addEventListener('relocate', (e) => {
    const d = e.detail || {};
    const frac = d.fraction || 0;
    const left = d.time && isFinite(d.time.section) ? Math.max(1, Math.round(d.time.section)) : 0;
    fL.textContent = left ? T('rdMinLeftChap', { m: left }) : '';
    fR.textContent = Math.round(frac * 100) + '%';
    nL.textContent = d.time && isFinite(d.time.total) ? T('rdMinLeftBook', { m: Math.max(1, Math.round(d.time.total)) }) : '';
    nR.textContent = fR.textContent;
    chap.textContent = (d.tocItem && d.tocItem.label) || '';
    if (!slider.matches(':active')) slider.value = String(Math.round(frac * 1000));
    rd.loc = d; markBookmark();
    hideSel();
    clearTimeout(rd.saveT);
    rd.saveT = setTimeout(() => {
      const r = rd && rd.rec; if (!r) return;
      Object.assign(r, { cfi: d.cfi || r.cfi, fraction: frac, lastRead: Date.now(), done: r.done || frac >= 0.985 });
      putBook(r).catch(() => {});
      pushProgress(r);
    }, 600);
  });
  view.addEventListener('load', (e) => wireDoc(e.detail.doc, setChrome, e.detail.index));
  try {
    await view.open(file);
    rd.book = view.book;
    if (rd.book && rd.book.dir) box.dir = rd.book.dir;
    applyReaderStyle();
    const startAt = opt && opt.cfi ? opt.cfi : opt && (opt.href || opt.fromStart) ? null : (rec.cfi || null);
    await view.init({ lastLocation: startAt, showTextStart: true });
    if (opt && opt.href) await view.goTo(opt.href).catch(() => {});
    if (opt && opt.find) {                 // תוצאת חיפוש: ההתאמה ה־k בפרק, מודגשת במנוע
      const cfis = [];
      try {
        for await (const r of view.search({ query: opt.find.q, index: opt.find.sec, draw: Overlayer.highlight, drawOptions: { color: '#30D158' } })) {
          if (r && r.cfi) cfis.push(r.cfi);
          if (cfis.length > opt.find.k) break;
        }
      } catch (e) {}
      const c = cfis[Math.min(opt.find.k, cfis.length - 1)];
      if (c) await view.goTo(c).catch(() => {});
    }
  } catch (e) {
    if (typeof flash === 'function') flash(T('libOpenErr'));
    rd.closing = true;
    history.back();
  }
}

function closeReader() {
  if (!rd) return;
  if (rd.rec) { clearTimeout(rd.saveT); pushProgress(rd.rec, true); }
  try { rd.view.close(); } catch (e) {}
  rd.els.box.remove();
  rd = null;
  hideSel();
  renderHome();
}

/* נגיעות בתוך הספר: דפדוף רק בהחלקה (המנוע — paginator — גורר ומצמיד לעמוד, לפי כיוון הספר).
   נגיעה בשוליים כבר לא מדפדפת (v303, בקשת המשתמש: נגיעה במילה ליד הקצה לתרגום העבירה עמוד בטעות) —
   נגיעה בכל מקום רק מציגה/מסתירה את הסרגלים. */
function wireDoc(doc, setChrome, index) {
  doc.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); onEscape(); } });
  doc.addEventListener('click', (e) => {
    const sel = doc.getSelection && doc.getSelection();
    if (sel && !sel.isCollapsed && String(sel).trim()) return;
    if (e.target && e.target.closest && e.target.closest('a[href]')) return;
    setTimeout(() => {                         // נגיעה בהדגשה (show-annotation) — לא מחליפה סרגלים
      if (!rd || Date.now() - rd.annTap < 400) return;
      if (selPop) { hideSel(); return; }
      setChrome(!rd.chrome);
    }, 0);
  });
  doc.__idx = index;
  let st = 0;
  doc.addEventListener('selectionchange', () => { clearTimeout(st); st = setTimeout(() => showSel(doc), 350); });
}

/* ---------------- בועת סימון + תרגום בהקשר ---------------- */
let selPop = null;
function hideSel() { if (selPop) { selPop.remove(); selPop = null; } }
function blockOf(node) {
  let el = node && (node.nodeType === 1 ? node : node.parentElement);
  while (el && el.parentElement && !/^(P|LI|TD|TH|BLOCKQUOTE|H[1-6]|DD|DT|FIGCAPTION|CAPTION)$/.test(el.tagName)) el = el.parentElement;
  return el;
}
function showSel(doc) {
  const sel = doc.getSelection && doc.getSelection();
  const text = sel ? String(sel).replace(/\s+/g, ' ').trim() : '';
  if (!text || !rd) { hideSel(); return; }
  const range = sel.getRangeAt(0);
  const rr = range.getBoundingClientRect();
  const fr = doc.defaultView && doc.defaultView.frameElement;
  const fb = fr ? fr.getBoundingClientRect() : { left: 0, top: 0 };
  hideSel();
  const idx = doc.__idx;
  const cfi = rd.view.getCFI(idx, range);
  const block = blockOf(range.commonAncestorContainer);
  buildPop({ text, cfi, range: range.cloneRange(), block: block ? block.textContent : text });
  root.append(selPop);
  placePop(rr, fb);
}

/* בועה אחת לסימון חדש ולהדגשה קיימת: שורת צבעים (+ הערה), ומתחת תרגום · העתק · ציטוט (+ מחיקה בקיימת) */
function buildPop({ text, cfi, block, ann }) {
  selPop = h('div', 'rd-pop rd-pop2');
  const row1 = h('div', 'rd-pop-row');
  Object.keys(HL_COLORS).forEach((k) => {
    const b = h('button', 'rd-dot' + (ann && ann.k === k ? ' on' : '')); b.type = 'button'; b.style.background = HL_COLORS[k];
    b.setAttribute('aria-label', T('hlColor'));
    b.addEventListener('click', () => { hideSel(); clearSelection(); saveHighlight({ text, cfi, k, ann }); });
    row1.append(b);
  });
  const nb = h('button', 'rd-txt', T('hlNote')); nb.type = 'button';
  nb.addEventListener('click', () => { hideSel(); clearSelection(); const a = ann || saveHighlight({ text, cfi, k: 'y' }); noteSheet(a); });
  row1.append(nb);
  const row2 = h('div', 'rd-pop-row');
  const act = (k, fn) => { const b = h('button', 'rd-txt', T(k)); b.type = 'button'; b.addEventListener('click', () => { hideSel(); fn(); }); row2.append(b); };
  act('rdTranslate', () => translateSheet(text, block || text));
  act('rdCopy', async () => { try { await navigator.clipboard.writeText(text); if (typeof flash === 'function') flash(T('rdCopied')); } catch (e) {} });
  act('hlQuote', () => quoteCard(text));
  const gm = glossaryMatch(text);
  if (gm) act('acTerm', () => sheet(T('acTerm'), (sh) => sh.append(termRow(gm))));
  if (ann) act('hlDelete', () => deleteAnn(ann));
  selPop.append(row1, row2);
}
function placePop(rr, fb) {
  const pw = selPop.offsetWidth, ph = selPop.offsetHeight;
  let top = fb.top + rr.bottom + 12;                       // מתחת לסימון — מעליו מופיע התפריט של Chrome
  if (top + ph > window.innerHeight - 50) top = fb.top + rr.top - ph - 12;
  const cx = fb.left + (rr.left + rr.right) / 2;
  selPop.style.top = Math.max(8, top) + 'px';
  selPop.style.left = Math.min(window.innerWidth - pw - 8, Math.max(8, cx - pw / 2)) + 'px';
}
function clearSelection() { try { const d = rd && rd.view.renderer.getContents()[0]; d && d.doc.getSelection().removeAllRanges(); } catch (e) {} }
function annPopup(value, range, index) {
  const ann = rd && rd.rec.ann.find((x) => x.c === value && !x.d);
  if (!ann) return;
  hideSel();
  buildPop({ text: ann.x, cfi: ann.c, ann, block: '' });
  root.append(selPop);
  const doc = range.startContainer.ownerDocument;
  const fr = doc.defaultView && doc.defaultView.frameElement;
  placePop(range.getBoundingClientRect(), fr ? fr.getBoundingClientRect() : { left: 0, top: 0 });
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function saveHighlight({ text, cfi, k, ann }) {
  const r = rd.rec;
  const loc = rd.loc || {};
  const a = ann || { id: uid(), c: cfi, x: String(text).slice(0, 600), ch: (loc.tocItem && langText(loc.tocItem.label)) || '', f: loc.fraction || 0 };
  Object.assign(a, { k, u: Date.now() });
  if (!ann) r.ann.push(a);
  putBook(r).catch(() => {}); pushAnn(r, a);
  rd.view.addAnnotation({ value: a.c }).catch(() => {});
  return a;
}
function deleteAnn(a) {
  Object.assign(a, { d: 1, u: Date.now() });
  putBook(rd.rec).catch(() => {}); pushAnn(rd.rec, a);
  if (!a.b) rd.view.deleteAnnotation({ value: a.c }).catch(() => {});
  markBookmark();
}
function noteSheet(a) {
  sheet(T('hlNote'), (sh, close) => {
    const q = h('p', 'tr-src', '“' + a.x + '”'); q.dir = 'auto';
    const ta = h('textarea', 'hl-ta'); ta.value = a.n || ''; ta.placeholder = T('hlNotePh'); ta.dir = 'auto'; ta.rows = 4;
    const save = h('button', 'bk-cta', T('hlSave')); save.type = 'button';
    save.addEventListener('click', () => {
      a.n = ta.value.trim().slice(0, 2000); a.u = Date.now();
      const rec = rd ? rd.rec : null;
      if (rec) { putBook(rec).catch(() => {}); pushAnn(rec, a); }
      close();
    });
    sh.append(q, ta, save);
    setTimeout(() => ta.focus(), 250);
  });
}

/* ---- סימניות: לפי העמוד הנוכחי (CFI של הטווח הגלוי) ---- */
function pageHasBookmark() {
  const loc = rd && rd.loc; if (!loc || !loc.cfi) return null;
  try {
    const a = CFI.collapse(loc.cfi), z = CFI.collapse(loc.cfi, true);
    return liveAnn(rd.rec.ann, 'bm').find((b) => CFI.compare(b.c, a) >= 0 && CFI.compare(b.c, z) <= 0) || null;
  } catch (e) { return null; }
}
function markBookmark() {
  if (!rd) return;
  const on = !!pageHasBookmark();
  rd.els.ribbon.classList.toggle('on', on);
  rd.els.bmBtn.classList.toggle('on', on);
}
function toggleBookmark() {
  const cur = pageHasBookmark();
  if (cur) { deleteAnn(cur); if (typeof flash === 'function') flash(T('bmRemoved')); return; }
  const loc = rd.loc || {}; if (!loc.cfi) return;
  const start = CFI.collapse(loc.cfi);
  let excerpt = '';
  try { excerpt = String(loc.range ? loc.range.toString() : '').replace(/\s+/g, ' ').trim().slice(0, 160); } catch (e) {}
  const a = { id: uid(), c: start, x: excerpt, b: 1, ch: (loc.tocItem && langText(loc.tocItem.label)) || '', f: loc.fraction || 0, u: Date.now() };
  rd.rec.ann.push(a);
  putBook(rd.rec).catch(() => {}); pushAnn(rd.rec, a);
  markBookmark();
  if (typeof flash === 'function') flash(T('bmAdded'));
}

/* ---- כרטיס ציטוט: תמונה נקייה לשיתוף (קנבס, הפונט שלנו, בלי שום נתון אישי) ---- */
async function quoteCard(text) {
  const rec = rd && rd.rec; if (!rec) return;
  const W = 1080, H = 1350, pad = 96;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  try { await document.fonts.load('500 52px "SNB Noto UI"'); await document.fonts.load('700 30px "SNB Noto UI"'); } catch (e) {}
  const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#16261C'); g.addColorStop(1, '#0B130E');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  const rtl = /[\u0590-\u05FF]/.test(text);
  x.direction = rtl ? 'rtl' : 'ltr'; x.textAlign = rtl ? 'right' : 'left';
  const ax = rtl ? W - pad : pad;
  x.fillStyle = '#30D158'; x.font = '700 150px "SNB Noto UI", sans-serif'; x.fillText(rtl ? '”' : '“', ax, pad + 120);
  // הגופן הכי גדול שנכנס (ציטוט קצר = גדול), והגוש ממורכז אנכית בין המירכאות לחתימה
  let size = 72; let lines;
  for (; size >= 34; size -= 4) { x.font = '500 ' + size + 'px "SNB Noto UI", sans-serif'; lines = wrapQuote(text, W - pad * 2, (t) => x.measureText(t).width, 14); if (lines.length * size * 1.5 < H - 560) break; }
  const top0 = pad + 200, bot0 = H - pad - 140, blockH = lines.length * size * 1.5;
  const y0 = top0 + Math.max(0, (bot0 - top0 - blockH) / 2) + size;
  x.fillStyle = '#F2F2F7';
  lines.forEach((ln, i) => x.fillText(ln, ax, y0 + i * size * 1.5));
  x.fillStyle = 'rgba(255,255,255,.55)'; x.font = '600 30px "SNB Noto UI", sans-serif';
  x.fillText([rec.author, rec.year || ''].filter(Boolean).join(' · '), ax, H - pad - 56);
  x.fillStyle = 'rgba(255,255,255,.35)'; x.font = '700 24px sans-serif'; x.direction = 'ltr'; x.textAlign = 'left';
  x.fillText('THE SNOWBALL', pad, H - pad);
  const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
  if (!blob) return;
  const file = new File([blob], 'quote.png', { type: 'image/png' });
  sheet(T('qTitle'), (sh) => {
    const img = h('img', 'q-img'); img.src = URL.createObjectURL(blob); img.alt = '';
    const row = h('div', 'q-row');
    const share = h('button', 'bk-cta', T('qShare')); share.type = 'button';
    share.addEventListener('click', async () => {
      try {
        if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file] });
        else { const a = document.createElement('a'); a.href = img.src; a.download = 'quote.png'; a.click(); }
      } catch (e) {}
    });
    row.append(share);
    sh.append(img, row);
  });
}

export function contextFor(text, block) {
  const b = String(block || '').replace(/\s+/g, ' ').trim();
  if (b.length <= 1500) return b;
  const i = b.indexOf(text.slice(0, 40));
  const s = Math.max(0, (i < 0 ? 0 : i) - 700);
  return b.slice(s, s + 1500);
}
const trCache = new Map();
async function fetchTranslation(text, context, title) {
  const key = text + '|' + context;
  if (trCache.has(key)) return trCache.get(key);
  const base = (typeof IBKR_PROXY_DEFAULT !== 'undefined' && IBKR_PROXY_DEFAULT) || '';
  const headers = Object.assign({ 'Content-Type': 'application/json' }, typeof ibkrProxyHeaders === 'function' ? ibkrProxyHeaders() : {});
  const lang = (typeof getLang === 'function' && getLang()) || 'he';
  const r = await fetch(base + '/api/translate', { method: 'POST', headers, body: JSON.stringify({ text: text.slice(0, 400), context, title, to: lang }) });
  const j = await r.json();
  if (!j || !j.ok) throw new Error((j && j.error) || 'translate_failed');
  trCache.set(key, j);
  return j;
}
function translateSheet(text, block) {
  sheet(T('trTitle'), (sh) => {
    const src = h('p', 'tr-src', text); src.dir = 'auto';
    const out = h('p', 'tr-out', T('trLoading')); out.dir = 'auto';
    const note = h('div', 'tr-note hidden');
    const warn = h('p', 'tr-warn hidden', T('trBasic'));
    sh.append(src, out, note, warn);
    fetchTranslation(text, contextFor(text, block), (rd && rd.rec && rd.rec.title) || '').then((j) => {
      out.textContent = j.translation;
      if (j.note) { note.textContent = ''; note.append(h('b', null, T('trNote')), h('span', null, j.note)); note.classList.remove('hidden'); }
      if (j.engine !== 'ai') warn.classList.remove('hidden');
    }).catch(() => { out.textContent = T('trFail'); });
  });
}

/* ---------------- תוכן עניינים + גיליון Aa ---------------- */
function openToc() {
  if (!rd || !rd.book) return;
  sheet('', (sh, close) => {
    const tabs = h('div', 'rd-seg');
    const panes = {};
    const go = (target) => { close(); rd.view.goTo(target).catch(() => {}); };
    const tab = (key, label) => {
      const b = h('button', key === 'toc' ? 'on' : '', label); b.type = 'button';
      b.addEventListener('click', () => { tabs.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); Object.keys(panes).forEach((k) => panes[k].classList.toggle('hidden', k !== key)); });
      tabs.append(b);
    };
    tab('toc', T('tabToc')); tab('hl', T('tabHl')); tab('bm', T('tabBm'));
    const toc = h('div', 'lib-ios rd-toc rd-pane');
    const walk = (items, depth) => (items || []).forEach((it) => {
      const r = h('button', 'lib-row'); r.type = 'button'; r.style.paddingInlineStart = (14 + depth * 16) + 'px';
      r.append(h('span', null, langText(it.label)));
      r.addEventListener('click', () => go(it.href));
      toc.append(r);
      walk(it.subitems, depth + 1);
    });
    walk(rd.book.toc, 0);
    panes.toc = toc;
    const annList = (kind, empty) => {
      const box = h('div', 'rd-pane hidden');
      const list = liveAnn(rd.rec.ann, kind);
      if (!list.length) { box.append(h('p', 'lib-empty', T(empty))); return box; }
      list.forEach((a) => box.append(annRow(a, () => go(a.c))));
      return box;
    };
    panes.hl = annList('hl', 'noHl'); panes.bm = annList('bm', 'noBm');
    sh.append(tabs, panes.toc, panes.hl, panes.bm);
  });
}
function annRow(a, onOpen) {
  const r = h('button', 'ann-row'); r.type = 'button';
  if (!a.b) r.style.setProperty('--hl', HL_COLORS[a.k] || HL_COLORS.y);
  else r.classList.add('bm');
  const q = h('div', 'ann-x', a.x || '—'); q.dir = 'auto'; r.append(q);
  if (a.n) { const n = h('div', 'ann-n', a.n); n.dir = 'auto'; r.append(n); }
  r.append(h('div', 'ann-m', [a.ch, Math.round((a.f || 0) * 100) + '%'].filter(Boolean).join(' · ')));
  r.addEventListener('click', onOpen);
  return r;
}

function openAa() {
  sheet('', (sh) => {
    const tabs = h('div', 'rd-seg');
    const panes = {};
    const tabBtn = (key, label) => {
      const b = h('button', null, label); b.type = 'button';
      b.addEventListener('click', () => { tabs.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); Object.keys(panes).forEach((k) => panes[k].classList.toggle('hidden', k !== key)); });
      tabs.append(b); return b;
    };
    const tFont = tabBtn('font', T('rdFont')); tabBtn('layout', T('rdLayout')); tabBtn('theme', T('rdTheme'));
    tFont.classList.add('on');
    const redo = () => { pushSettings(); applyReaderStyle(); };
    // גופן
    const pf = h('div', 'rd-pane'); panes.font = pf;
    [['snb', 'Noto Sans Hebrew'], ['book', T('rdFontBook')]].forEach(([v, label]) => {
      const r = h('button', 'rd-fontrow' + (S.font === v ? ' on' : '')); r.type = 'button';
      const nm = h('span', 'nm', label); if (v === 'snb') nm.style.fontFamily = '"SNB Noto UI", sans-serif';
      r.append(nm);
      r.addEventListener('click', () => { S.font = v; pf.querySelectorAll('.rd-fontrow').forEach((x) => x.classList.toggle('on', x === r)); redo(); });
      pf.append(r);
    });
    const sizeRow = h('div', 'rd-ctl');
    const sz = h('input', 'rd-range'); sz.type = 'range'; sz.min = '14'; sz.max = '30'; sz.step = '1'; sz.value = String(S.size);
    sz.addEventListener('input', () => { S.size = +sz.value; redo(); });
    sizeRow.append(h('span', 'lbl', T('rdSize')), h('span', 'a1', 'א'), sz, h('span', 'a2', 'א'));
    const wRow = h('div', 'rd-ctl'); wRow.append(h('span', 'lbl', T('rdWeight')));
    const dots = h('div', 'rd-dots');
    WEIGHTS.forEach((wv, i) => {
      const d = h('button', i === S.weight ? 'on' : '', String(i + 1)); d.type = 'button'; d.style.fontWeight = String(wv);
      d.addEventListener('click', () => { S.weight = i; dots.querySelectorAll('button').forEach((x, j) => x.classList.toggle('on', j === i)); redo(); });
      dots.append(d);
    });
    wRow.append(dots);
    pf.append(sizeRow, wRow);
    // פריסה
    const pl = h('div', 'rd-pane hidden'); panes.layout = pl;
    const seg = (label, opts, cur, set) => {
      const row = h('div', 'rd-ctl'); row.append(h('span', 'lbl', label));
      const g = h('div', 'rd-mini-seg');
      opts.forEach(([v, l]) => {
        const b = h('button', v === cur() ? 'on' : '', l); b.type = 'button';
        b.addEventListener('click', () => { set(v); g.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); redo(); });
        g.append(b);
      });
      row.append(g); pl.append(row);
    };
    seg(T('rdAlign'), [[false, T('rdAlignStart')], [true, T('rdAlignJustify')]], () => S.justify, (v) => { S.justify = v; });
    seg(T('rdSpacing'), [[0, T('rdSpacing1')], [1, T('rdSpacing2')], [2, T('rdSpacing3')]], () => S.spacing, (v) => { S.spacing = v; });
    seg(T('rdFlow'), [['paginated', T('rdPages')], ['scrolled', T('rdScroll')]], () => S.flow, (v) => { S.flow = v; });
    // ערכה
    const pt = h('div', 'rd-pane hidden'); panes.theme = pt;
    const themes = h('div', 'rd-themes');
    [['white', 'rdWhite'], ['sepia', 'rdSepia'], ['green', 'rdGreen'], ['black', 'rdBlack']].forEach(([v, k]) => {
      const th = THEMES[v];
      const b = h('button', S.theme === v ? 'on' : ''); b.type = 'button';
      b.style.background = th.page; b.style.color = th.ink;
      b.append(h('span', 'big', 'א'), h('span', 'sm', T(k)));
      b.addEventListener('click', () => { S.theme = v; themes.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); redo(); });
      themes.append(b);
    });
    pt.append(themes);
    sh.append(tabs, pf, pl, pt);
  });
}

/* ---------------- כניסה / יציאה + "חזור" של המכשיר ---------------- */
/* בזמן קריאה: "חזור" אחד (גם החלקה מקצה המסך בטעות) לא מוציא מהספר — רק שני "חזור" תוך 2 שניות
   (v303, בקשת המשתמש). גיליון פתוח (תוכן/Aa/תרגום) — "חזור" סוגר אותו. כפתור ✕ יוצא מיד. */
const BACK_TWICE_MS = 2000;
function onPop() {
  const lvl = (history.state && history.state.lib) || 0;
  if (lvl < 2 && rd && !rd.closing) {
    const veil = root && root.querySelector('.lib-veil');
    const now = Date.now();
    if (veil || selPop || now - (rd.backAt || 0) > BACK_TWICE_MS) {
      history.pushState(Object.assign({}, history.state || {}, { lib: 2 }), '');
      if (veil) (veil._close || (() => veil.remove()))();
      else if (selPop) hideSel();
      else { rd.backAt = now; if (typeof flash === 'function') flash(T('rdBackTwice')); }
      return;
    }
  }
  if (lvl >= 1 && lvl < 2) ui.view = (history.state && history.state.lv) || null;
  if (lvl < 2 && rd) closeReader();
  else if (lvl === 1 && root) { renderHome(); root.scrollTop = 0; }
  if (lvl < 1 && root) { hideSel(); root.remove(); root = null; document.documentElement.classList.remove('lib-open'); }
}

/* v315: מיקום הגלילה בספרייה לכל דף — לשחזור אחרי רענון (sessionStorage: רק בלשונית הזו) */
const SCROLL_KEY = 'pwa_libscroll_v1';
const viewKey = () => JSON.stringify(ui.view || null);
function saveLibScroll() {
  if (!root || rd) return;
  try { const m = JSON.parse(sessionStorage.getItem(SCROLL_KEY) || '{}'); m[viewKey()] = Math.round(root.scrollTop); sessionStorage.setItem(SCROLL_KEY, JSON.stringify(m)); } catch (e) {}
}
function restoreLibScroll() {
  let y = 0;
  try { y = +(JSON.parse(sessionStorage.getItem(SCROLL_KEY) || '{}')[viewKey()] || 0); } catch (e) {}
  if (!y || !root) return;
  const t0 = Date.now();
  const tryIt = () => {   // התוכן נטען בהדרגה — מנסים עד שהדף ארוך מספיק (עד 4 שניות)
    if (!root) return;
    root.scrollTop = y;
    if (Math.abs(root.scrollTop - y) > 2 && Date.now() - t0 < 4000) setTimeout(tryIt, 120);
  };
  tryIt();
}

export async function openLibrary(opt) {
  ensureCss();
  if (root) return;
  const restore = opt && opt.restore && opt.restore.lib ? opt.restore : null;   // רענון בזמן שהספרייה הייתה פתוחה
  root = h('div', 'lib-root no-swipe');
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', T('libTitle'));
  root.tabIndex = -1;
  if (!window._libKey) {                 // על document: אחרי מעבר דף האלמנט שבפוקוס נמחק והפוקוס נופל ל־body
    window._libKey = true;
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !root || e.defaultPrevented) return;
      if (document.querySelector('.dlg-veil')) return;   // חלון אישור של האפליקציה פתוח — הוא מטפל בעצמו
      e.preventDefault(); onEscape();
    });
  }
  root.append(h('div', 'lib-home'));
  // v316: לחיצה ארוכה על כריכה פתחה את תפריט הדפדפן ("הורדת תמונה") — אצלנו לחיצה ארוכה = עריכה/מחיקה
  root.addEventListener('contextmenu', (e) => { if (e.target.closest && e.target.closest('.lib-item, .lib-cover, .ed-cv, .ed-th')) e.preventDefault(); });
  document.body.append(root);
  document.documentElement.classList.add('lib-open');
  if (!restore) history.pushState(Object.assign({}, history.state || {}, { lib: 1 }), '');   // ברענון — הרשומות כבר בהיסטוריה
  if (!window._libPop) { window._libPop = true; window.addEventListener('popstate', onPop); }
  ui.view = restore ? (restore.lv || null) : null;
  let scT = 0;
  root.addEventListener('scroll', () => { clearTimeout(scT); scT = setTimeout(saveLibScroll, 150); }, { passive: true });
  try { await scopeLibrary(); } catch (e) {}   // v313: לפני ציור/סנכרון — רק הנתונים של החשבון הנוכחי
  const first = syncDrive();
  await renderHome();
  if (restore) {
    if (restore.lib >= 2 && restore.book) openReader(restore.book, { restored: true });
    else restoreLibScroll();
  }
  await first;
  backfillCovers();
  BK.schedule(8000);                       // v318: גיבוי אוטומטי של הספרייה הפרטית, אם הגיע הזמן
  refreshCloud(true);                      // v319: ספרים שבגיבוי ולא בטלפון
  await pullCloud();
  try { const tk = await idToken(); if (tk) { const j = await libApi({ op: 'me', idToken: tk }).then((r) => r.json()); ui.admin = !!(j && j.admin); } } catch (e) {}
  renderHome();
  setTimeout(() => indexAll(), 600);
}

export const _test = { indexBook, bookExtras, HL_COLORS, normTerm, bookCSS: () => bookCSS(), setSettings: (o) => { S = Object.assign({}, defaults, o); }, WEIGHTS, THEMES };
