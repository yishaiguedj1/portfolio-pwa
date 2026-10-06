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

// v330: ערכת ברירת המחדל = 'auto' — הקורא הולך אחרי האפליקציה (בהיר → דף לבן, כהה → דף שחור עם טקסט אפור־בהיר, כמו
// מצב כהה של קינדל), ומתחלף מיד כשהאפליקציה מתחלפת. בחירה ידנית ב־Aa (themeSet) גוברת
const defaults = { theme: 'auto', size: 19, weight: 0, spacing: 1, justify: false, font: 'snb', flow: 'paginated' };
export function normSettings(o) {          // הגדרות ישנות: 'white' שנשמר כברירת מחדל (בלי בחירה ידנית) → 'auto'
  const r = Object.assign({}, defaults, o || {});
  if (!THEMES[r.theme] && r.theme !== 'auto') r.theme = 'auto';
  if (r.theme === 'white' && !r.themeSet) r.theme = 'auto';
  return r;
}
function loadSettings() { try { return normSettings(JSON.parse(localStorage.getItem(LS_READER) || '{}')); } catch (e) { return normSettings({}); } }
const appDark = () => typeof document !== 'undefined' && !!document.documentElement && document.documentElement.getAttribute('data-theme') === 'dark';
export function themeKey(st, dark) { return st.theme === 'auto' ? (dark ? 'black' : 'white') : st.theme; }
const curTheme = () => THEMES[themeKey(S, appDark())] || THEMES.white;
function saveSettings() { try { localStorage.setItem(LS_READER, JSON.stringify(S)); } catch (e) {} }
let S = loadSettings();
const ui = { sort: 'new', author: '\u0001shelf', view: null, q: '', admin: false };   // v321: נכנסים תמיד ל"מדף ספרים"   // view: null = בית, { book: id } = דף מכתב
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
/* v326: אותה הדגשה נשמרה כמה פעמים (סימון חוזר של אותו קטע לפני שהבועה זיהתה הדגשה קיימת — "able" ×3 בצילום).
   מחזירה את ה־id של העותקים המיותרים (אותו CFI), כשהעדכני נשאר. טהורה (נבדקת). */
export function annDupes(list) {
  const best = new Map(); const out = [];
  (list || []).forEach((a) => {
    if (!a || a.d || a.b || !a.c) return;
    const o = best.get(a.c);
    if (!o) { best.set(a.c, a); return; }
    if ((a.u || 0) > (o.u || 0)) { out.push(o.id); best.set(a.c, a); } else out.push(a.id);
  });
  return out;
}
/* סינון דף "מה למדתי" (כמו המחברת של קינדל): t = all | hl | note | bm, k = צבע אחד או null. טהורה (נבדקת). */
export function annFilter(list, f) {
  const t = (f && f.t) || 'all', k = f && f.k;
  return (list || []).filter((a) => {
    if (!a || a.d) return false;
    if (t === 'bm') return !!a.b;
    if (a.b) return t === 'all' && !k;
    if (t === 'note' && !String(a.n || '').trim()) return false;
    if (k && (a.k || 'y') !== k) return false;
    return true;
  }).sort((a, b) => (a.f || 0) - (b.f || 0));
}
/* כל ההדגשות של ספר כטקסט לשיתוף/העתקה (כמו "ייצוא מחברת" בקינדל). טהורה (נבדקת). */
export function annExportText(title, author, list) {
  const head = [title, author].filter(Boolean).join(' — ');
  const items = (list || []).filter((a) => a && !a.d && !a.b).map((a) => {
    const meta = [a.ch, Math.round((a.f || 0) * 100) + '%'].filter(Boolean).join(' · ');
    return '“' + String(a.x || '').trim() + '”' + (String(a.n || '').trim() ? '\n✎ ' + String(a.n).trim() : '') + (meta ? '\n(' + meta + ')' : '');
  });
  return [head].concat(items).filter(Boolean).join('\n\n');
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
  if (lib.s && lib.s.t > (S.t || 0)) { S = normSettings(lib.s); saveSettings(); }
  const mc = mergeColls(collAll(), lib.c);       // v320: אסופות מהענן (מכשיר אחר)
  if (mc) { collSave(mc); changed++; }
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
function docText(doc) {                 // הטקסט של פרק: בלוק לכל שורה (משותף לאינדקס החיפוש ולתצוגה המקדימה בציר)
  const blocks = Array.from(doc.querySelectorAll(BLOCK_SEL)).filter((el) => !el.querySelector(BLOCK_SEL));
  return (blocks.length ? blocks.map((el) => el.textContent) : [doc.body ? doc.body.textContent : ''])
    .map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
}
async function indexBook(b) {
  const file = await getFile(b.id); if (!file) return;
  const book = await makeBook(file);
  const secs = [];
  for (const [i, sec] of (book.sections || []).entries()) {
    if (!sec.createDocument || sec.linear === 'no') continue;
    try {
      const t = docText(await sec.createDocument());
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
  undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>',
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
  cloudErr: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 18.5h10.5a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.6 9.1 4.7 4.7 0 0 0 7 18.5z"/><path d="M12 11.2v3"/><path d="M12 16.4v.1"/></svg>',
  cloudOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 18.5h10.5a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.6 9.1 4.7 4.7 0 0 0 7 18.5z"/><path d="M4 4l16 16"/></svg>',
  cloudUp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 18.5h10.5a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.6 9.1 4.7 4.7 0 0 0 7 18.5z"/><path d="M12 16v-5M9.8 13l2.2-2.2 2.2 2.2"/></svg>',
  shelf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4.5h4v15H4zM10 4.5h4v15h-4zM16.3 5.2l3.6 1-3.6 13.8-3.6-1"/></svg>',
  cloudDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 18.5h10.5a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.6 9.1 4.7 4.7 0 0 0 7 18.5z"/><path d="M12 10.5v5.5M9.8 13.8l2.2 2.2 2.2-2.2"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  unmark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="8.2"/><path d="M6.3 17.7L17.7 6.3"/></svg>',
  open: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5zM12 6.5v13"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8.5" y="8.5" width="11" height="11" rx="2.5"/><path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V4M8 8l4-4 4 4"/><path d="M6 11v8a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 18 19v-8"/></svg>',
  quote: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 6.5C6.6 7.3 4.5 9.7 4.5 13.3V18h5.6v-5.4H7.4c0-2 1-3.3 3-3.9zM19.5 6.5c-3.4.8-5.5 3.2-5.5 6.8V18h5.6v-5.4h-2.7c0-2 1-3.3 3-3.9z"/></svg>',
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

/* v321: מעבר דף אחרי המתנה ארוכה (הורדה) — רק אם עדיין יש הפעלת משתמש; אחרת Chrome מסמן את הרשומה
   לדילוג ו"חזור" מדלג על דפים. במקרה כזה — נשארים במקום והודעה. */
function safeGoView(v) {
  const ua = typeof navigator !== 'undefined' && navigator.userActivation;
  if (!ua || ua.isActive) return goView(v);
  if (root && !rd) renderHome();
  flashSafe(T('libDlReady'));
}
/* v322: pushState מיד אחרי סגירת חלון/תפריט של האפליקציה (history.back בדרך) היה נוחת על הרשומה הלא נכונה —
   app.js חושף snbAfterBack שמריץ את הקריאה אחרי שה־back נחת (ומיד כשאין back בדרך) */
const afterBack = (fn) => (typeof window !== 'undefined' && typeof window.snbAfterBack === 'function') ? window.snbAfterBack(fn) : fn();
/* v323: רשומה חדשה לא יורשת שרידי גיליון/חלון מהרשומה הנוכחית (sheet/modal) — אחרת "חזור" לא סוגר גיליון שנפתח מעליה */
function cleanState(extra) { const st = Object.assign({}, history.state || {}, extra); delete st.sheet; delete st.modal; return st; }
/* ---------------- v322: מעברים חלקים בספרייה ----------------
   כל ציור של דף עובר דרך libTransition: View Transitions (Chrome/Safari) — הדף הישן מצולם, הדף החדש נבנה (גם כש־IndexedDB
   עוד עונה) ורק אז מונפש: 'push' = הדף החדש נכנס מהצד הקדמי (RTL: משמאל), 'pop' = חזרה בכיוון ההפוך, 'fade' = הצלבה
   (צ'יפים/מיון/רענון). הקורא נסגר באנימציית CSS משלו (closeReader). בלי התמיכה / reduced-motion — ציור רגיל.
   הגלילה נקבעת בתוך המעבר (אחרי הבנייה) — אין פריים שבו הדף הישן קופץ לראש לפני שהוחלף (נמצא ב־QA של v322). */
const VT = { inside: false };
const reduceMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
function libTransition(kind, update) {
  const run = async () => { VT.inside = true; try { await update(); } finally { VT.inside = false; } };
  if (VT.inside || !kind || kind === 'none' || !root || reduceMotion() || typeof document.startViewTransition !== 'function' || document.hidden) return run();
  document.documentElement.dataset.libVt = kind;
  let vt;
  try { vt = document.startViewTransition(run); } catch (e) { return run(); }
  vt.finished.catch(() => {}).then(() => { if (document.documentElement.dataset.libVt === kind) delete document.documentElement.dataset.libVt; });
  return vt.updateCallbackDone.catch(() => {});
}
function renderHome(kind) { return libTransition(kind || 'none', renderHomeNow); }
function navigateTo(kind, y) {           // ציור הדף הנוכחי (ui.view) + גלילה ליעד — בתוך אותו מעבר
  return libTransition(kind, async () => { await renderHomeNow(); pinScroll(y || 0); });
}
let pinT = 0;
function navScroll(y) {                  // גלילה תוכנתית של מעבר דף — מסומנת (data-nav-scroll) כדי שכלי המדידה לא יספור אותה כקפיצה
  const r = root; if (!r) return;
  r.dataset.navScroll = '1';
  r.scrollTop = y;
  requestAnimationFrame(() => requestAnimationFrame(() => { delete r.dataset.navScroll; }));
}
function pinScroll(y) {                  // הדף מתארך אחרי הציור (כריכות, אסופות) — חוזרים ליעד עד שהגובה מספיק; נגיעה של המשתמש מבטלת
  clearTimeout(pinT);
  if (!root) return;
  navScroll(y);
  if (!y) return;
  const r = root, t0 = Date.now();
  const stop = () => { clearTimeout(pinT); r.removeEventListener('touchstart', stop); r.removeEventListener('wheel', stop); };
  r.addEventListener('touchstart', stop, { passive: true }); r.addEventListener('wheel', stop, { passive: true });
  const tick = () => {
    if (root !== r || rd) return stop();
    if (Math.abs(r.scrollTop - y) > 2 && r.scrollHeight - r.clientHeight >= y) navScroll(y);
    if (Math.abs(r.scrollTop - y) <= 2 || Date.now() - t0 > 2500) return stop();
    pinT = setTimeout(tick, 100);
  };
  pinT = setTimeout(tick, 60);
}
function goView(v) {           // מעבר לדף בתוך הספרייה — רשומה בהיסטוריה, כך ש"חזור" של המכשיר מחזיר
  saveLibScroll();
  ui.view = v;
  afterBack(() => history.pushState(cleanState({ lib: 1, lv: v }), ''));
  navigateTo('push', 0).then(() => { if (root) try { root.focus({ preventScroll: true }); } catch (e) {} });
}

async function renderHomeNow() {
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
  if (ui.view && ui.view.coll) return renderColl(ui.view.coll);
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
  // v327 (בקשת המשתמש, בהשראת Google Photos): מצב הגיבוי = בועה קטנה בשורת הכותרת, לא כרטיס מעל החיפוש
  const hrow = h('div', 'lib-hrow');
  hrow.append(h('h1', 'lib-large', T('libTitle')));
  if (mine) { bkAdopt(); if (books.length || cloudOnly.length) hrow.append(backupPill()); }
  home.append(top, hrow);
  home.append(shelfSeg(nMine));
  if (!mine) {
    if (syncNote === 'denied') home.append(h('p', 'lib-note', T('libDenied')));
    else if (syncProgress && syncProgress.total > 1) home.append(h('p', 'lib-note', T('libSyncProg', { n: syncProgress.done, t: syncProgress.total })));
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
    c.addEventListener('click', () => { if (ui.author === val) return; ui.author = val; navigateTo('fade', 0); });
    chips.append(c);
    return c;
  };
  const shelfChip = chip(T('colShelf'), SHELF);   // v320: "מדף ספרים" — לפני "הכל"
  shelfChip.classList.add('shelf'); shelfChip.insertAdjacentHTML('afterbegin', ICON.shelf);
  chip(T('libAll'), '');
  Object.keys(authors).sort((a, b) => authors[b] - authors[a]).forEach((a) => chip(a, a));
  if (ui.author && ui.author !== SHELF && !authors[ui.author]) ui.author = SHELF;
  chips.classList.add('lib-hide-q'); home.append(chips);
  const onShelf = ui.author === SHELF;

  const shown = sortBooks(listed.filter((b) => !ui.author || onShelf || (b.author || T('libNoAuthor')) === ui.author), ui.sort);
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
  if (onShelf) shelvesView(home, listed);
  const sortRow = h('div', 'lib-sortrow' + (onShelf ? ' lib-only-q' : ''));
  const sortBtn = h('button', 'lib-sortbtn'); sortBtn.type = 'button'; sortBtn.innerHTML = ICON.sort;
  sortBtn.append(h('span', null, T(ui.sort === 'old' ? 'libSortOld' : ui.sort === 'recent' ? 'libSortRecent' : 'libSortNew')));
  sortBtn.addEventListener('click', openSortSheet);
  const cnt = h('b', 'lib-count', T('libCount', { n: shown.length })); cnt.dataset.n = String(shown.length);
  sortRow.append(cnt, sortBtn);
  home.append(sortRow);
  const grid = h('div', 'lib-grid' + (onShelf ? ' lib-only-q' : ''));   // במדף — הרשת מופיעה רק בחיפוש
  shown.forEach((b, i) => grid.append(bookItem(b, i)));
  home.append(grid);
  if (cloudOnly.length > 1 && !onShelf) {  // v319: כמה ספרים בגיבוי — הורדה של כולם בלחיצה אחת
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
  ui.shelf = v; ui.author = SHELF; ui.q = '';   // v321: כל ספרייה נפתחת במדף
  try { localStorage.setItem(LS_SHELF, v); } catch (e) {}
  navigateTo('fade', 0);
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
let pillPrev = '';
export function bkPillState(signed, s, busy) {   // טהורה (נבדקת): off | busy | err | ok
  if (!signed || !s || !s.email) return 'off';
  if (busy) return 'busy';
  if (s.err) return 'err';
  return s.lastAt ? 'ok' : 'off';
}
function backupPill() {                    // בועת מצב הגיבוי (ענן + ✓ / חץ / !) — נגיעה = מסך הגיבוי
  const s = BK.settings();
  const st = bkPillState(signedIn(), s, BK.busy());
  const pill = h('button', 'lib-bkpill ' + st); pill.type = 'button';
  if (st === 'ok' && pillPrev === 'busy') pill.classList.add('done');   // הגיבוי הסתיים עכשיו — ה־✓ "נכתב"
  pillPrev = st;
  const ic = h('span', 'lib-bkpic');
  ic.innerHTML = st === 'ok' ? ICON.cloudOk : st === 'busy' ? ICON.cloudUp : st === 'err' ? ICON.cloudErr : ICON.cloudOff;
  const label = st === 'ok' ? T('bkPillOk') : st === 'busy' ? T('bkPillBusy') : st === 'err' ? T('bkPillErr') : T('bkPillOff');
  pill.append(ic, h('span', 'lib-bkplbl', label));
  // לקורא המסך — הפרטים המלאים (מה שהיה בכרטיס)
  const full = st === 'ok' ? [T('bkRowOn'), fmtWhen(s.lastAt), T('bkBooks', { n: s.count || 0 }), fmtBytes(s.bytes)].filter(Boolean).join(' · ')
    : st === 'busy' ? T('bkRowBusy') : st === 'err' ? T('bkRowErr') + ' · ' + bkErrText(s.err) : (signedIn() ? T('bkRowConnect') : T('bkRowSignIn'));
  pill.setAttribute('aria-label', full); pill.title = full;
  pill.addEventListener('click', () => goView({ backup: 1 }));
  return pill;
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
    const acts = [{ kind: 'edit', fn: () => downloadCloud(b, it, false).then((ok) => { if (ok) safeGoView({ edit: b.id }); }) },
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
  if (open) safeGoView({ book: b.id }); else if (root && !rd) renderHome();
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
    bk.addEventListener('click', () => closeSheetThen(sh.parentNode, () => goView({ backup: 1 })));
    const im = h('label', 'lib-row'); im.append(h('span', null, T('libImport')));
    const ii = h('span', 'lib-rowic'); ii.innerHTML = ICON.plus; im.append(ii, importInput(close));
    const rs = h('button', 'lib-row danger'); rs.type = 'button'; rs.append(h('span', null, T('libResetMine')));
    const ri = h('span', 'lib-rowic'); ri.innerHTML = ICON.trash; rs.append(ri);
    rs.addEventListener('click', () => closeSheetThen(sh.parentNode, openResetSheet));
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
      const acts = [{ kind: 'edit', fn: () => (x.onPhone ? goView({ edit: x.id }) : restoreIds([x.id], () => safeGoView({ edit: x.id }))) }, { kind: 'del', fn: () => delIds([x.id]) }];
      if (typeof showItemActions === 'function') showItemActions(r, acts);
    });
    box.append(r);
  });
}
function flashSafe(m) { if (typeof flash === 'function') flash(m); }

/* ---------------- v320: מדף ספרים — אסופות (כמו "אלבומים" באייפון; הרעיון של אסופות קינדל, בעיצוב Apple) ----------------
   אסופות שלי: { id: { n: שם, s: 'snb'|'mine', b: [מזהי ספרים], u: עדכון, d: 1 = נמחקה } } — מקומי לכל חשבון
   (pwa_libcoll_v1, ב־ACCOUNT_KEYS) ובענן (lib.c במסמך המשתמש, מיזוג לפי u). אוטומטיות — מחושבות מהספרים. */
const SHELF = '\u0001shelf';           // ערך הצ'יפ "מדף ספרים" (במקום שם כותב)
const LS_COLL = 'pwa_libcoll_v1';
export function mergeColls(local, remote) {   // טהורה (נבדקת): לכל אסופה — העדכון האחרון מנצח (כולל מחיקה)
  const out = Object.assign({}, local || {});
  let changed = false;
  for (const [id, r] of Object.entries(remote || {})) {
    if (!r || typeof r !== 'object') continue;
    const l = out[id];
    if (!l || (r.u || 0) > (l.u || 0)) { out[id] = r; changed = true; }
  }
  return changed ? out : null;
}
export function autoColls(books, shelf, isLetter) {   // טהורה (נבדקת): אסופות שנבנות לבד מפרטי הספרים
  const out = [];
  const add = (key, name, list, min) => { if (list.length >= (min || 1)) out.push({ key, name, ids: list.map((b) => b.id), auto: true }); };
  add('reading', { t: 'colReading' }, books.filter((b) => b.fraction > 0 && !b.done).sort((a, b) => (b.lastRead || 0) - (a.lastRead || 0)));
  add('done', { t: 'colDone' }, books.filter((b) => b.done));
  if (shelf === 'snb' && isLetter) add('partnership', { t: 'colPartnership' }, books.filter((b) => isLetter(b) && b.year && b.year <= 1969).sort((a, b) => a.year - b.year), 2);
  const by = (field) => { const m = new Map(); books.forEach((b) => { const v = String(b[field] || '').trim(); if (v) m.set(v, (m.get(v) || []).concat([b])); }); return m; };
  [...by('series')].sort((a, b) => b[1].length - a[1].length).forEach(([v, list]) => add('se:' + v, v, list.sort((a, b) => (+a.seriesIdx || a.year || 0) - (+b.seriesIdx || b.year || 0)), 2));
  [...by('author')].sort((a, b) => b[1].length - a[1].length).forEach(([v, list]) => add('au:' + v, v, list.sort((a, b) => (b.year || 0) - (a.year || 0)), 2));
  return out;
}
function collAll() { try { return (JSON.parse(localStorage.getItem(LS_COLL) || '{}') || {})[libOwner()] || {}; } catch (e) { return {}; } }
function collSave(map) {
  try { const all = JSON.parse(localStorage.getItem(LS_COLL) || '{}') || {}; all[libOwner()] = map; localStorage.setItem(LS_COLL, JSON.stringify(all)); } catch (e) {}
}
function collPut(id, c, push) {         // שמירה מקומית + לענן (merge של שדה אחד)
  const map = collAll(); map[id] = c; collSave(map);
  if (push !== false) { const ref = userRef(); if (ref) ref.set({ lib: { c: { [id]: c } } }, { merge: true }).catch(() => {}); }
}
const myColls = (shelf) => Object.entries(collAll()).filter(([, c]) => c && !c.d && c.s === shelf).map(([id, c]) => ({ key: 'c:' + id, id, name: c.n, ids: c.b || [], u: c.u || 0 }))
  .sort((a, b) => String(a.name).localeCompare(String(b.name), 'he'));
const collName = (c) => (c.name && typeof c.name === 'object' ? T(c.name.t) : c.name);
function findColl(key, books) {
  if (key.startsWith('c:')) return myColls(ui.shelf).find((c) => c.key === key) || null;
  return autoColls(books, ui.shelf, isBuffett).find((c) => c.key === key) || null;
}
function collStack(list) {               // שלוש כריכות בערימה (האמצעית מלפנים)
  const st = h('div', 'col-stack');
  const pick = list.slice(0, 3);
  const cls = ['c1', 'c2', 'c3'];
  pick.forEach((b, i) => { const c = cover(b); c.classList.add(cls[i]); st.append(c); });
  if (!pick.length) st.classList.add('empty');
  return st;
}
function collCard(c, byId) {
  const list = c.ids.map((id) => byId.get(id)).filter(Boolean);
  const card = h('button', 'col-card ' + (c.auto ? 'auto' : 'mine')); card.type = 'button';
  card.append(collStack(list), h('b', null, collName(c)), h('span', null, T('libCount', { n: list.length })));
  card.setAttribute('aria-label', collName(c) + ' · ' + T('libCount', { n: list.length }));
  card.addEventListener('click', () => goView({ coll: c.key }));
  if (!c.auto) wireHold(card, () => {
    if (typeof showItemActions === 'function') showItemActions(card, [{ kind: 'edit', fn: () => collNameSheet(c) }, { kind: 'del', fn: () => collDelete(c) }]);
  });
  return card;
}
function shelvesView(home, books) {      // הטאב "מדף ספרים"
  const box = h('div', 'col-view lib-hide-q');
  const byId = new Map(books.map((b) => [b.id, b]));
  const mineC = myColls(ui.shelf);
  box.append(h('h4', 'col-sec', T('colMine')));
  const g1 = h('div', 'col-grid');
  mineC.forEach((c) => g1.append(collCard(c, byId)));
  const add = h('button', 'col-card add'); add.type = 'button';
  const pl = h('span', 'col-plus'); pl.innerHTML = ICON.plus;
  add.append(pl, h('b', null, T('colNew')));
  add.addEventListener('click', () => collNameSheet(null));
  g1.append(add);
  box.append(g1);
  const autos = autoColls(books, ui.shelf, isBuffett);
  if (autos.length) {
    box.append(h('h4', 'col-sec', T('colAuto')));
    const g2 = h('div', 'col-grid');
    autos.forEach((c) => g2.append(collCard(c, byId)));
    box.append(g2);
  }
  home.append(box);
}
function collNameSheet(c, thenAdd, shelf) {   // אסופה חדשה / שינוי שם (thenAdd — ספר שנכנס לאסופה החדשה)
  sheet(c ? T('colRename') : T('colNew'), (sh, close) => {
    const inp = h('input', 'col-in'); inp.type = 'text'; inp.dir = 'auto'; inp.maxLength = 60; inp.placeholder = T('colNamePh'); inp.value = c ? collName(c) : '';
    const ok = h('button', 'bk-cta'); ok.type = 'button'; ok.textContent = T(c ? 'edSave' : 'colCreate');
    const go = () => {
      const n = inp.value.trim(); if (!n) { inp.focus(); return; }
      const id = c ? c.id : 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const prev = collAll()[id] || { s: shelf || ui.shelf, b: [] };
      const b = prev.b.slice(); if (thenAdd && !b.includes(thenAdd)) b.push(thenAdd);
      collPut(id, { n, s: prev.s || shelf || ui.shelf, b, u: Date.now() });
      close();
      if (thenAdd) flashSafe(T('colAdded', { c: n }));
      if (root && !rd) renderHome();
    };
    ok.addEventListener('click', go);
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    sh.append(inp, ok);
    setTimeout(() => { try { inp.focus(); } catch (e) {} }, 60);
  });
}
function collDelete(c) {
  const go = () => {
    const prev = collAll()[c.id] || {};
    collPut(c.id, { n: prev.n || '', s: prev.s || ui.shelf, b: [], u: Date.now(), d: 1 });
    if (ui.view && ui.view.coll === c.key) history.back(); else renderHome();
  };
  if (typeof askConfirm === 'function') askConfirm(T('colDeleteQ', { c: collName(c) }), go, { danger: true, ok: T('bkDeleteOk') }); else go();
}
function collToggle(id, bookId, on) {
  const prev = collAll()[id]; if (!prev) return;
  const b = (prev.b || []).filter((x) => x !== bookId);
  if (on) b.push(bookId);
  collPut(id, Object.assign({}, prev, { b, u: Date.now() }));
}
function addToCollSheet(book) {          // לחיצה ארוכה על ספר → "הוספה לאסופה"
  sheet(T('colAddTo', { t: book.title }), (sh, close) => {
    const list = h('div', 'lib-ios');
    myColls(shelfOf(book)).forEach((c) => {
      let on = c.ids.includes(book.id);
      const r = h('button', 'lib-row'); r.type = 'button';
      const ck = h('span', 'lib-check', on ? '✓' : '');
      r.append(h('span', null, c.name), ck);
      r.addEventListener('click', () => { on = !on; ck.textContent = on ? '✓' : ''; collToggle(c.id, book.id, on); if (on) flashSafe(T('colAdded', { c: c.name })); });
      list.append(r);
    });
    const nw = h('button', 'lib-row act'); nw.type = 'button'; nw.append(h('span', null, '＋ ' + T('colNew') + '…'));
    nw.addEventListener('click', () => closeSheetThen(sh.parentNode, () => collNameSheet(null, book.id, shelfOf(book))));
    list.append(nw);
    sh.append(list);
  }).addEventListener('click', (e) => { if (e.target.classList.contains('lib-veil') && root && !rd) renderHome(); });
}
function bookItem(b, idx) {               // פריט ספר ברשת (בית / דף אסופה)
  if (b.cloud) return cloudItem(b, idx);
  const it = h('button', 'lib-item'); it.type = 'button';
  it.dataset.q = searchKey(b); it.dataset.i = String(idx);
  const cap = h('div', 'lib-cap');
  if (b.done) cap.append(h('span', 'lib-done', T('libRead')));
  else if (b.fraction > 0) { const m = h('span', 'lib-mini'); const f = h('i'); f.style.width = Math.round(b.fraction * 100) + '%'; m.append(f); cap.append(m, h('span', null, Math.round(b.fraction * 100) + '%')); }
  else cap.append(h('span', 'lib-badge', T('libNew')));
  it.append(cover(b), cap);
  // שלב 8 (נגישות): קורא מסך שומע שם + מצב, לא את כל הטקסט הדקורטיבי של הכריכה
  it.setAttribute('aria-label', b.title + ' · ' + (b.done ? T('libRead') : b.fraction > 0 ? Math.round(b.fraction * 100) + '% ' + T('bkReadPct') : T('libNew')));
  it.addEventListener('click', () => goView({ book: b.id }));
  // v316: לחיצה ארוכה = עט (עריכה) + X (מחיקה/הסתרה) — אותם כפתורים ואותו מיקום כמו במניות; v320: + הוספה לאסופה
  wireHold(it, () => bookActions(it, b));
  return it;
}
async function renderColl(key) {           // דף אסופה
  const allB = await allBooks();
  const books = allB.filter((b) => shelfOf(b) === ui.shelf);
  const have = new Set(books.map((b) => b.id));
  const listed = books.concat(ui.shelf === 'mine' && cloudBooks ? cloudBooks.filter((c) => !have.has(c.id)) : []);
  const c = findColl(key, listed);
  if (!c) { ui.view = null; return renderHome(); }
  if (!root || !ui.view || ui.view.coll !== key) return;
  const byId = new Map(listed.map((b) => [b.id, b]));
  const list = c.ids.map((id) => byId.get(id)).filter(Boolean);
  const home = root.querySelector('.lib-home');
  home.textContent = '';
  const top = h('div', 'lib-top');
  const back = h('button', 'lib-back'); back.type = 'button'; back.innerHTML = ICON.back; back.append(h('span', null, T('colShelf')));
  back.addEventListener('click', () => history.back());
  top.append(back);
  if (!c.auto) {
    const more = h('button', 'lib-round'); more.type = 'button'; more.innerHTML = ICON.more; more.setAttribute('aria-label', T('colRename'));
    more.addEventListener('click', () => sheet(collName(c), (sh, close) => {
      const l = h('div', 'lib-ios');
      const rn = h('button', 'lib-row'); rn.type = 'button'; rn.append(h('span', null, T('colRename')));
      rn.addEventListener('click', () => closeSheetThen(sh.parentNode, () => collNameSheet(c)));
      const dl = h('button', 'lib-row danger'); dl.type = 'button'; dl.append(h('span', null, T('colDelete')));
      dl.addEventListener('click', () => closeSheetThen(sh.parentNode, () => collDelete(c)));
      l.append(rn, dl); sh.append(l);
    }));
    top.append(more);
  }
  const hero = h('div', 'col-hero');
  const tx = h('div', 'col-hero-t');
  const reading = list.filter((b) => b.fraction > 0 && !b.done).length;
  tx.append(h('b', null, collName(c)), h('span', null, T('libCount', { n: list.length }) + (reading ? ' · ' + T('colReadingN', { n: reading }) : '')));
  hero.append(collStack(list), tx);
  home.append(top, hero);
  if (!c.auto) {
    const acts = h('div', 'col-acts');
    const addB = h('button', 'col-pill'); addB.type = 'button'; addB.textContent = '＋ ' + T('colAddBooks');
    addB.addEventListener('click', () => sheet(T('colAddBooks'), (sh, close) => {
      const l = h('div', 'lib-ios col-pick');
      sortBooks(listed, 'new').forEach((b) => {
        let on = c.ids.includes(b.id);
        const r = h('button', 'lib-row'); r.type = 'button';
        const t1 = h('span', 'col-pick-t', b.title); t1.dir = 'auto';
        const ck = h('span', 'lib-check', on ? '✓' : '');
        r.append(cover(b, true), t1, ck);
        r.addEventListener('click', () => { on = !on; ck.textContent = on ? '✓' : ''; collToggle(c.id, b.id, on); c.ids = (collAll()[c.id] || {}).b || []; });
        l.append(r);
      });
      const done = h('button', 'bk-cta'); done.type = 'button'; done.textContent = T('colDoneBtn');
      done.addEventListener('click', () => { close(); renderColl(key); });
      sh.append(l, done);
    }));
    acts.append(addB);
    home.append(acts);
  }
  if (!list.length) { home.append(h('p', 'lib-empty', T(c.auto ? 'libNoMatch' : 'colEmpty'))); return; }
  const grid = h('div', 'lib-grid');
  list.forEach((b, i) => grid.append(bookItem(b, i)));
  home.append(grid);
}

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

/* v326: "מה למדתי" = המחברת של קינדל בעיצוב Apple: סינון (הכל/הדגשות/הערות/סימניות + צבע), לכל פריט ⋯ / לחיצה ארוכה
   = גיליון פעולות (צבע, הערה, העתקה, ציטוט, מעבר למקום, הסרה), שיתוף כל ההדגשות של ספר, ובלי עותקים כפולים */
const learnF = { t: 'all', k: null };
async function renderNotes() {
  const home = root.querySelector('.lib-home');
  const all = sortBooks((await allBooks()).filter((b) => (b.ann || []).some((a) => !a.d)), 'recent');
  if (!root || !ui.view || !ui.view.notes) return;
  all.forEach((b) => annCleanDupes(b));
  const rerender = () => { const y = root.scrollTop; renderNotes().then(() => navScroll(y)); };
  home.textContent = '';
  const top = h('div', 'lib-top');
  const back = h('button', 'lib-back'); back.type = 'button'; back.innerHTML = ICON.back; back.append(h('span', null, T('libTitle')));
  back.addEventListener('click', () => history.back());
  top.append(back);
  home.append(top, h('h1', 'lib-large', T('learnTitle')));
  if (!all.length) { home.append(h('p', 'lib-empty', T('learnEmpty'))); return; }
  // סינון: מקטעים + צבעים (צבע לא רלוונטי לסימניות)
  const filt = h('div', 'learn-filter');
  const seg = h('div', 'rd-seg learn-seg'); seg.setAttribute('role', 'tablist');
  [['all', T('learnAll')], ['hl', T('tabHl')], ['note', T('learnNotes')], ['bm', T('tabBm')]].forEach(([v, label]) => {
    const btn = h('button', learnF.t === v ? 'on' : '', label); btn.type = 'button'; btn.setAttribute('role', 'tab'); btn.setAttribute('aria-selected', String(learnF.t === v));
    btn.addEventListener('click', () => { learnF.t = v; if (v === 'bm') learnF.k = null; rerender(); });
    seg.append(btn);
  });
  filt.append(seg);
  if (learnF.t !== 'bm') {
    const cols = h('div', 'learn-colors'); cols.setAttribute('aria-label', T('learnColor'));
    Object.keys(HL_COLORS).forEach((k) => {
      const btn = h('button', learnF.k === k ? 'on' : ''); btn.type = 'button'; btn.style.background = HL_COLORS[k];
      btn.setAttribute('aria-pressed', String(learnF.k === k)); btn.setAttribute('aria-label', T('learnColor'));
      btn.addEventListener('click', () => { learnF.k = learnF.k === k ? null : k; rerender(); });
      cols.append(btn);
    });
    filt.append(cols);
  }
  home.append(filt);
  let shown = 0;
  all.forEach((b) => {
    const list = annFilter(b.ann, learnF);
    if (!list.length) return;
    shown++;
    const sec = h('section', 'learn-sec');
    const head = h('div', 'learn-h');
    const hl = (b.ann || []).filter((a) => !a.d && !a.b);
    head.append(h('b', null, b.title), h('span', null, T('learnCount', { n: list.length })));
    if (hl.length) {
      const ex = h('button', 'learn-exp'); ex.type = 'button'; ex.innerHTML = ICON.share; ex.setAttribute('aria-label', T('learnExport')); ex.title = T('learnExport');
      ex.addEventListener('click', async () => {
        const text = annExportText(b.title, b.author, liveAnn(b.ann));
        try {
          if (navigator.share) await navigator.share({ title: b.title, text });
          else { await navigator.clipboard.writeText(text); flashSafe(T('rdCopied')); }
        } catch (e) { if (e && e.name !== 'AbortError') { try { await navigator.clipboard.writeText(text); flashSafe(T('rdCopied')); } catch (er) {} } }
      });
      head.append(ex);
    }
    sec.append(head);
    list.forEach((a) => sec.append(annRow(a, () => openReader(b.id, { cfi: a.c }),
      () => annActions(b, a, { open: () => openReader(b.id, { cfi: a.c }), after: rerender }))));
    home.append(sec);
  });
  if (!shown) home.append(h('p', 'lib-empty', T('learnNoMatch')));
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
  const note = h('p', 'ac-ai', T('acAiNote') + (ins.model ? ' · ' + aiModelLabel(ins.model) : '')); out.push(note);   // v334: שם המודל
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
    if (held) { held = false; swallow = true; setTimeout(() => { swallow = false; }, 600); el.classList.remove('pressing'); onHold(); }   // v328: ה־click אחרי לחיצה ארוכה לא תמיד מגיע לאלמנט (נוחת על הגיליון שנפתח) — בלי איפוס, הנגיעה הבאה נבלעה
    else cancel();
  });
  el.addEventListener('pointercancel', () => { held = false; cancel(); el.classList.remove('pressing'); });
  el.addEventListener('click', (e) => { if (swallow) { swallow = false; e.stopImmediatePropagation(); e.preventDefault(); } }, true);
}
function bookActions(host, b) {
  const acts = [{ kind: 'edit', fn: () => goView({ edit: b.id }) }, { kind: 'coll', fn: () => addToCollSheet(b) }, { kind: 'del', fn: () => askRemove(b) }];
  if (typeof showItemActions === 'function') showItemActions(host, acts);
}

let sheetSkip = 0, sheetClosed = null;
/* v322: לגיליון יש רשומת היסטוריה משלו ({sheet:1}) — "חזור" של המכשיר סוגר אותו ולא עוזב את הדף/הקורא (עד v321 תוכן העניינים
   "אכל" את רשומת השומר). סגירה תוכנתית = history.back() שלנו (sheetSkip). גיליון שנפתח בזמן שרשומה כזו כבר קיימת
   (רצף מתוך גיליון אחר) משתמש בה. closeSheetThen(veil, fn): פותחים את הבא רק אחרי שה־back של הקודם נחת. */
function sheet(title, build) {
  const veil = h('div', 'lib-veil');
  const sh = h('div', 'lib-sheet');
  // שלב 8 (נגישות): דיאלוג אמיתי — קורא מסך יודע שנפתח חלון, הפוקוס נכנס אליו וחוזר למקומו בסגירה
  sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-modal', 'true'); sh.tabIndex = -1;
  if (title) sh.setAttribute('aria-label', title);
  const back = document.activeElement;
  let pushed = false;
  const close = () => {
    if (!veil.isConnected) return;
    veil.classList.add('out');
    setTimeout(() => veil.remove(), reduceMotion() ? 0 : 160);
    if (back && back.isConnected && back.focus) try { back.focus({ preventScroll: true }); } catch (e) {}
    if (pushed && history.state && history.state.sheet) { sheetSkip++; sheetClosed = new Promise((res) => { veil._settled = res; }); history.back(); }
    else sheetClosed = null;
  };
  sh.append(h('div', 'lib-grab'));
  if (title) sh.append(h('h3', 'lib-sh-t', title));
  build(sh, close);
  veil.append(sh);
  const openedAt = Date.now();
  // v328: לחיצה ארוכה פותחת גיליון בשחרור האצבע — ה־click שהדפדפן שולח אחריו נחת על הרקע וסגר אותו מיד; קליקים ב־450ms הראשונים לא סוגרים
  veil.addEventListener('click', (e) => { if (e.target === veil && Date.now() - openedAt > 450) close(); });
  veil._close = close;
  root.append(veil);
  // v323: רשומה רק עם הפעלת משתמש (כמו modalPush ב־app.js) — גיליון שנפתח מקוד אסינכרוני נסגר ב"חזור" בלי לבלוע את הניווט
  const ua = typeof navigator !== 'undefined' && navigator.userActivation;
  if (!(ua && !ua.isActive)) afterBack(() => { try { const st0 = history.state || {}; if (st0.lib && veil.isConnected) { history.pushState(Object.assign({}, st0, { sheet: (st0.sheet || 0) + 1 }), ''); pushed = true; veil._pushed = true; } } catch (e) {} });
  try { sh.focus({ preventScroll: true }); } catch (e) {}
  return veil;
}
function closeSheetThen(veil, fn) {        // סגירה ואז פתיחה של הבא — אחרי שה־back של הגיליון נחת (אחרת הרשומה החדשה נבלעת)
  const c = veil && veil._close ? veil._close : null;
  if (c) c();
  if (sheetClosed) { const p = sheetClosed; sheetClosed = null; p.then(fn); } else fn();
}
/* Escape (מקלדת) = "חזור": גיליון/בועה נסגרים, אחרת יציאה מהקורא/מהדף — באותו מסלול כמו כפתור החזור */
function onEscape() {
  const veil = root && root.querySelector('.lib-veil');
  if (veil) { (veil._close || (() => veil.remove()))(); return; }
  if (trCard && trCard._closePal && trCard.querySelector('.tr-pal')) { trCard._closePal(); return; }
  if (trCard) { hideTr(); return; }
  if (rd) return readerExit();          // מקלדת — יציאה מיידית, בלי "לחץ שוב"
  history.back();
}
function readerExit() {                  // ✕ / Escape / שגיאה — ישר לדף הספר (מדלגים גם על רשומת השומר)
  if (!rd || rd.closing) return;         // v324: ✕ פעמיים מהר = שתי חזרות כפולות — יצא מהספרייה (נמצא ב־QA)
  rd.closing = true;
  const st = history.state || {};
  if (st.lib === 2 && !st.guard) history.go(-2); else history.back();
}
function readerRearm() {                 // נגיעה בתוך הקורא אחרי "חזור" ראשון — השומר חוזר (יש הפעלת משתמש)
  try {
    const st = history.state || {};
    if (!rd || rd.closing || st.lib !== 2 || !st.guard) return;
    if (navigator.userActivation && !navigator.userActivation.isActive) return;
    history.pushState(Object.assign({}, st, { guard: 0 }), '');
  } catch (e) {}
}

function openSortSheet() {
  sheet(T('libSortTitle'), (sh, close) => {
    const list = h('div', 'lib-ios');
    [['new', 'libSortNew'], ['old', 'libSortOld'], ['recent', 'libSortRecent']].forEach(([v, k]) => {
      const r = h('button', 'lib-row'); r.type = 'button'; r.append(h('span', null, T(k)));
      if (ui.sort === v) r.append(h('span', 'lib-check', '✓'));
      r.addEventListener('click', () => { ui.sort = v; close(); renderHome('fade'); });
      list.append(r);
    });
    sh.append(list);
  });
}

/* ---------------- הקורא ---------------- */
let rd = null; // { view, book, rec, els, chrome, saveT }

function bookCSS() {
  const th = curTheme();
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
    ${th !== THEMES.white ? `body *:not(img):not(svg):not(svg *) { color: inherit !important; background-color: transparent !important; }
    a, a * { color: ${th.link} !important; }` : 'p.note, .note, caption { color: ' + th.ink2 + ' !important; }'}
    pre { white-space: pre-wrap !important; }
    img, svg { max-width: 100%; height: auto; }
    ::selection { background: rgba(48, 209, 88, .32); }
    ::highlight(snb-tap) { background-color: rgba(100, 210, 255, .36); }
    /* v337: בלי בחירה של הדפדפן — אחרת לחיצה ארוכה מקפיצה את תפריט ההעתקה של המכשיר ואת "Touch to Search" של Google.
       הסימון שלנו: צביעה (CSS Highlight) + ידיות גרירה משלנו, וההעתקה מהכרטיס */
    html, body { -webkit-user-select: none !important; user-select: none !important; -webkit-touch-callout: none !important; }
    ::highlight(snb-sel) { background-color: rgba(52, 199, 89, .34); }
  `;
}

function applyReaderStyle() {
  if (!rd) return;
  const th = curTheme();
  const box = rd.els.box;
  box.style.setProperty('--rd-page', th.page); box.style.setProperty('--rd-ink', th.ink);
  box.style.setProperty('--rd-ink2', th.ink2); box.style.setProperty('--rd-rule', th.rule);
  box.dataset.dark = th.dark ? '1' : '';
  if (rd.r3d) rd.r3d.setPage(th.page, th.dark);
  const r = rd.view.renderer;
  if (!r) return;
  r.setAttribute('flow', S.flow === 'scrolled' ? 'scrolled' : 'paginated');
  r.setAttribute('margin', '44px');
  r.setAttribute('gap', '7%');
  r.setAttribute('max-inline-size', '720px');
  r.setAttribute('max-column-count', '2');
  if (!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) r.setAttribute('animated', '');
  if (r.setStyles) r.setStyles(bookCSS());
  curlStyleVer++; curlPrebuild();
}

// v330: האפליקציה עברה בהיר↔כהה (ידנית או לפי המערכת) — קורא פתוח בערכה האוטומטית מתחלף מיד, כמו בקינדל
if (typeof MutationObserver === 'function' && typeof document !== 'undefined' && document.documentElement) {
  new MutationObserver(() => { if (rd && S.theme === 'auto') applyReaderStyle(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}

async function openReader(id, opt) {
  saveLibScroll();                        // v322: הדף שמתחת חוזר לאותו מקום אחרי הקריאה
  const rec = (await allBooks()).find((b) => b.id === id);
  const file = await getFile(id);
  if (!rec || !file) return;
  if (!(opt && opt.restored)) {
    // v321: שתי רשומות בתוך הלחיצה — "שומר" ואז הקורא. "חזור" ראשון נוחת על השומר (הודעה), שני — לדף הספר.
    // אסור pushState בתוך popstate: Chrome מסמן רשומה כזו (ואת זו שלפניה) "לדילוג", ו"חזור" יצא מהאפליקציה.
    const st = cleanState({ lib: 2, book: id });
    history.pushState(Object.assign({}, st, { guard: 1 }), '');
    history.pushState(Object.assign({}, st, { guard: 0 }), '');
  }
  else history.replaceState(Object.assign({}, history.state || {}, { lib: 2, book: id }), '');
  const box = h('div', 'rd loading' + (opt && opt.restored ? ' restored' : ''));     // v322: .loading עד העמוד הראשון — סימן טעינה במקום דף ריק; restored = בלי אנימציית כניסה
  box.addEventListener('pointerup', readerRearm, true);   // v321: נגיעה בסרגלים מחזירה את השומר
  const view = document.createElement('foliate-view');
  const foot = h('div', 'rd-foot'); const fL = h('span'); const fR = h('span'); foot.append(fL, fR);
  const topBar = h('div', 'rd-topbar');
  const xBtn = h('button', 'rd-ic'); xBtn.type = 'button'; xBtn.innerHTML = ICON.close; xBtn.setAttribute('aria-label', T('rdClose'));
  xBtn.addEventListener('click', () => readerExit());
  const ttl = h('span', 'rd-ttl', rec.title);
  const acts = h('span', 'rd-acts');
  const tocBtn = h('button', 'rd-ic'); tocBtn.type = 'button'; tocBtn.innerHTML = ICON.list; tocBtn.setAttribute('aria-label', T('rdToc'));
  const bmBtn = h('button', 'rd-ic rd-bm'); bmBtn.type = 'button'; bmBtn.innerHTML = ICON.bookmark; bmBtn.setAttribute('aria-label', T('bmAdd'));
  // v329 (בקשת המשתמש, בהשראת קינדל): סרט סימנייה תמיד בראש העמוד — מתאר אפור נקי כשאין סימנייה, ירוק מלא כשיש; נגיעה = הוספה/הסרה
  const ribbon = h('button', 'rd-ribbon'); ribbon.type = 'button'; ribbon.setAttribute('aria-label', T('bmAdd')); ribbon.setAttribute('aria-pressed', 'false');
  ribbon.innerHTML = RIBBON_SVG;
  ribbon.addEventListener('click', (e) => { e.stopPropagation(); toggleBookmark(); });
  const aaBtn = h('button', 'rd-ic rd-aa'); aaBtn.type = 'button'; aaBtn.dir = 'ltr'; aaBtn.innerHTML = 'A<small>a</small>'; aaBtn.setAttribute('aria-label', T('rdSettings'));
  acts.append(bmBtn, tocBtn, aaBtn); topBar.append(xBtn, ttl, acts);
  const botBar = h('div', 'rd-botbar');
  const chap = h('div', 'rd-chap'); const slider = h('input', 'rd-slider'); slider.type = 'range'; slider.min = '0'; slider.max = '1000'; slider.step = '1';
  slider.setAttribute('aria-label', T('rdProgress'));
  // v331 (בקשת המשתמש, Apple + רעיונות קינדל): ציר ההתקדמות — סימניות על הציר, עצירה "מגנטית" עם רטט כשעוברים עליהן,
  // תצוגה מקדימה קטנה מעל האגודל (כמו YouTube), ו"חזרה ל־X%" אחרי קפיצה (כמו קינדל). הכיוון — כיוון הספר
  // v332: גם הדגשות (קו קצר בצבע ההדגשה) והערות (נקודה בצבע) על הציר — כל סוג בצורה משלו, אותה עצירה, רטט ותצוגה מקדימה
  const scrub = h('div', 'rd-scrub'); const track = h('div', 'rd-track'); const marks = h('div', 'rd-bmarks'); marks.setAttribute('aria-hidden', 'true');
  const prev = h('div', 'rd-prev'); prev.setAttribute('aria-hidden', 'true');
  const pvCh = h('div', 'rd-prev-ch'), pvTx = h('div', 'rd-prev-tx'), pvFt = h('div', 'rd-prev-ft'), pvPct = h('span', 'rd-prev-pct'), pvBm = h('span', 'rd-prev-bm');
  pvCh.dir = 'auto'; pvTx.dir = 'auto';
  pvFt.append(pvPct, pvBm); prev.append(pvCh, pvTx, pvFt);
  scrub.append(track, marks, slider, prev);
  const nums = h('div', 'rd-nums'); const nL = h('span'); const nR = h('span');
  const backPos = h('button', 'rd-backpos hidden'); backPos.type = 'button';
  nums.append(nL, backPos, nR);
  botBar.append(chap, scrub, nums);
  box.append(view, ribbon, foot, topBar, botBar);
  root.append(box);
  rd = { view, rec, els: { box, foot, fL, fR, chap, slider, nL, nR, ttl, bmBtn, ribbon, scrub, marks, prev, pvCh, pvTx, pvPct, pvBm, backPos }, chrome: false, saveT: 0, annTap: 0, pvSeq: 0 };
  preloadSecText(rec);
  rec.ann = rec.ann || [];
  annCleanDupes(rec);
  curlSetup(box);   // v342: דפדוף בקיפול דף כמו בקינדל — נטען ברקע; עד שמוכן (או בתנועה מופחתת) — ההחלקה של המנוע
  ribbon3dSetup(box, ribbon);   // v330: סימנייה תלת־ממדית — נטענת ברקע; עד שמוכנה (או בלי WebGL) נשאר סרט ה־SVG
  const setChrome = (on) => { rd.chrome = on; box.classList.toggle('chrome', on); };
  rd.setChrome = setChrome;
  tocBtn.addEventListener('click', openToc);
  bmBtn.addEventListener('click', toggleBookmark);
  view.addEventListener('create-overlay', () => liveAnn(rd && rd.rec.ann).forEach((a) => view.addAnnotation({ value: a.c }).catch(() => {})));
  view.addEventListener('draw-annotation', (e) => {
    const a = rd && rd.rec.ann.find((x) => x.c === e.detail.annotation.value && !x.d);
    e.detail.draw(Overlayer.highlight, { color: HL_COLORS[(a && a.k) || 'y'] });
  });
  view.addEventListener('show-annotation', (e) => { rd.annTap = Date.now(); annPopup(e.detail.value, e.detail.range, e.detail.index); });
  aaBtn.addEventListener('click', openAa);
  wireScrub();
  // v333: נגיעה במילה = תרגום, אז הסרגלים נפתחים גם מנגיעה בשולי העמוד (למעלה/למטה, מחוץ לטקסט)
  box.addEventListener('click', (e) => {
    const t = e.target;
    if (!rd || (t.closest && t.closest('button, input, a, .rd-topbar, .rd-botbar, .tr-card, .rd-pop, .rd-ribbon3d'))) return;
    if (selPop) { hideSel(); clearSelection(); return; }
    if (trCard) { hideTr(); return; }
    setChrome(!rd.chrome);
  });

  view.addEventListener('relocate', (e) => {
    const d = e.detail || {};
    box.classList.remove('loading');
    curtainDown();
    const frac = d.fraction || 0;
    const left = d.time && isFinite(d.time.section) ? Math.max(1, Math.round(d.time.section)) : 0;
    fL.textContent = left ? T('rdMinLeftChap', { m: left }) : '';
    fR.textContent = Math.round(frac * 100) + '%';
    nL.textContent = d.time && isFinite(d.time.total) ? T('rdMinLeftBook', { m: Math.max(1, Math.round(d.time.total)) }) : '';
    nR.textContent = fR.textContent;
    chap.textContent = (d.tocItem && d.tocItem.label) || '';
    if (!slider.matches(':active') && !rd.scrubbing) { slider.value = String(Math.round(frac * 1000)); scrub.style.setProperty('--p', Math.round(frac * 1000) / 10 + '%'); }
    if (rd.back && Date.now() - rd.back.t > 1200 && ++rd.back.turns > 3) { rd.back = null; showBackPos(); }   // קוראים הלאה — "חזרה" נעלמת
    // v334: "העמוד זז" לפי פרק + מספר עמוד — לא לפי מחרוזת ה־CFI: בנגיעה עם רעד של אצבע המנוע "מצמיד" את העמוד
    // (~0.5 שנ׳), והטווח הגלוי נמדד מחדש בהיסט של שבר פיקסל — ה־CFI משתנה בתו־שניים והכרטיס נסגר (דיווח המשתמש: "קופץ ונעלם")
    const moved = pageMoved(rd.loc, d) && !(trCard && Date.now() - (trCard._at || 0) < 900 && !pageMoved(rd.loc, d, true));
    rd.loc = d; markBookmark(); curlPrebuild();
    if (moved) { hideSel(); hideTr(); }
    clearTimeout(rd.saveT);
    rd.saveT = setTimeout(() => {
      const r = rd && rd.rec; if (!r) return;
      Object.assign(r, { cfi: d.cfi || r.cfi, fraction: frac, lastRead: Date.now(), done: r.done || frac >= 0.985 });
      putBook(r).catch(() => {});
      pushProgress(r);
    }, 600);
  });
  view.addEventListener('load', (e) => wireDoc(e.detail.doc, setChrome, e.detail.index));
  for (const ty of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) view.addEventListener(ty, (e) => curlTouch(e, 0, 0, null), { capture: true, passive: false });   // v342: החלקה בשולי העמוד
  try {
    // v322: פענוח הספר רק אחרי שאנימציית הכניסה נגמרה — עבודה כבדה באמצע הדהייה גרמה לפריים קופץ (נמדד במצב כהה)
    if (!(opt && opt.restored) && !reduceMotion()) await new Promise((res) => { box.addEventListener('animationend', res, { once: true }); setTimeout(res, 360); });
    await view.open(file);
    rd.book = view.book;
    // v330: פרק בלי <head> (קובץ פגום; ב־XHTML הדפדפן לא משלים אותו) — המנוע מזריק את העיצוב רק ל־head,
    // ובלעדיו הערכה, הגופן והגודל לא חלים (נמצא בתצוגה הכהה: דף לבן בערכה השחורה)
    if (rd.book && rd.book.transformTarget) rd.book.transformTarget.addEventListener('data', ({ detail }) => {
      if (/html/.test(detail.type || '')) detail.data = Promise.resolve(detail.data).then((d) => (typeof d === 'string' ? ensureHead(d) : d));
    });
    if (rd.book && rd.book.dir) box.dir = rd.book.dir;
    scrub.dir = readingDir(rd.book, rec.title);   // v331: ספר אנגלי — הציר משמאל לימין גם כשהממשק בעברית
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
    readerExit();
  }
}

function closeReader() {
  if (!rd) return;
  const r = rd; rd = null;
  if (r.rec) { clearTimeout(r.saveT); pushProgress(r.rec, true); }
  hideSel(); hideTr(true);
  // v322: הקורא דוהה מעל הדף באנימציית CSS על האלמנט עצמו (צילום View Transition לא כולל את ה־iframe — יצא דף לבן ריק);
  // הדף שמתחת מצויר בזמן שהקורא עדיין אטום, עם הגלילה שנשמרה בפתיחה; המנוע נסגר רק בסוף.
  const box = r.els.box;
  if (r.r3dOff) r.r3dOff();
  box.classList.add('out');
  const gone = reduceMotion() ? Promise.resolve() : new Promise((res) => { box.addEventListener('animationend', res, { once: true }); setTimeout(res, 340); });
  return (async () => { await renderHomeNow(); pinScroll(savedLibScroll()); await gone; try { r.view.close(); } catch (e) {} if (r.r3d) r.r3d.destroy(); if (r.curl) r.curl.destroy(); box.remove(); })();
}
/* v330 (בקשת המשתמש: "סימנייה כמו בעולם האמיתי — תלת־ממדית, מתרוממת באוויר עם צל"): המנוע ב־ribbon3d.js
   (סימולציית בד + WebGL + צל ממקור אור שטחי). הקנבס בתוך כפתור הסרט — זז איתו כשהסרגל העליון נפתח; הכפתור נשאר
   אזור הנגיעה והנגישות. בלי WebGL / שגיאה — סרט ה־SVG (v329) נשאר כמו שהוא. */
async function ribbon3dSetup(box, btn) {
  if (typeof WebGLRenderingContext === 'undefined') return;
  // ההכנה (טעינת המודול + הידור השיידרים) רק אחרי אנימציית הכניסה ופענוח הספר, כשהתהליך פנוי —
  // סינכרונית באמצע הפתיחה היא יצרה פריים של ~0.25 שנ׳ (נמדד בכלי המעברים)
  await new Promise((res) => setTimeout(res, 900));
  await new Promise((res) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(res, { timeout: 2000 }) : setTimeout(res, 200)));
  if (!rd || rd.els.box !== box) return;
  let mod;
  try { mod = await import('./ribbon3d.js'); } catch (e) { return; }
  if (!rd || rd.els.box !== box) return;
  const cv = h('canvas', 'rd-ribbon3d'); cv.setAttribute('aria-hidden', 'true');
  btn.prepend(cv);
  const eng = await mod.createRibbonAsync(cv, { reduceMotion, onLand: () => { try { if (navigator.vibrate) navigator.vibrate(6); } catch (e) {} } });
  if (!eng || !rd || rd.els.box !== box) { if (eng) eng.destroy(); cv.remove(); return; }
  const lay = () => {
    if (!cv.isConnected) return;
    const r = cv.getBoundingClientRect();
    if (!r.width) return;
    eng.layout({ w: r.width, h: r.height, ax: btn.getBoundingClientRect().left + btn.offsetWidth / 2 - r.left, cx: innerWidth / 2 - r.left, cy: innerHeight / 2 - r.top, dpr: devicePixelRatio || 1 });
  };
  lay();
  const th = curTheme();
  eng.setPage(th.page, th.dark);
  eng.set(btn.classList.contains('on'), false);
  rd.r3d = eng;
  requestAnimationFrame(() => { if (rd && rd.r3d === eng) box.classList.add('r3d'); });   // הצלבה מהסרט השטוח לתלת־ממדי
  // אצבע על הסרט: הקצה מתרומם קצת עם הצל (משוב מוחשי), ואז הלחיצה מפעילה את ההוספה/ההסרה מאותו מצב
  const down = () => eng.press(true), up = () => eng.press(false);
  btn.addEventListener('pointerdown', down);
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) btn.addEventListener(ev, up);
  btn.addEventListener('transitionend', lay);
  cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); box.classList.remove('r3d'); if (rd && rd.r3d === eng) rd.r3d = null; });
  addEventListener('resize', lay);
  rd.r3dOff = () => removeEventListener('resize', lay);
}

/* נגיעות בתוך הספר: דפדוף רק בהחלקה (המנוע — paginator — גורר ומצמיד לעמוד, לפי כיוון הספר).
   נגיעה בשוליים כבר לא מדפדפת (v303, בקשת המשתמש: נגיעה במילה ליד הקצה לתרגום העבירה עמוד בטעות) —
   נגיעה בכל מקום רק מציגה/מסתירה את הסרגלים. */
function wireDoc(doc, setChrome, index) {
  doc.addEventListener('pointerup', readerRearm, true);
  doc.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); onEscape(); } });
  // v336 (בקשת המשתמש — כמו בקינדל): נגיעה קצרה = סרגלים בלבד (או סגירת הכרטיס); התרגום והסימון — רק בלחיצה ארוכה
  doc.addEventListener('click', (e) => {
    if (!(e.target && e.target.closest && e.target.closest('a[href]'))) blockTouchSearch(doc, e);
    if (rd && Date.now() - (rd.holdAt || 0) < 900) return;          // שחרור אחרי לחיצה ארוכה
    const sel = doc.getSelection && doc.getSelection();
    if (sel && !sel.isCollapsed && String(sel).trim()) return;
    if (e.target && e.target.closest && e.target.closest('a[href]')) return;
    setTimeout(() => {                         // נגיעה בהדגשה (show-annotation) — לא מחליפה סרגלים
      if (!rd || Date.now() - rd.annTap < 400) return;
      if (trCard) { hideTr(); return; }
      setChrome(!rd.chrome);
    }, 0);
  });
  // v333: לחיצה ארוכה = חלון הסימון וההערה מיד (320ms, עם רטט) — לא מחכים לבחירת הטקסט של Chrome (~0.5 שנ׳) ועוד השהיה
  let hold = null;
  const holdOff = () => { if (hold) { clearTimeout(hold.t); hold = null; } };
  doc.addEventListener('touchstart', (e) => {
    holdOff();
    if (e.touches.length !== 1) return;
    const t = e.touches[0], x = t.clientX, y = t.clientY;
    hold = { x, y, t: setTimeout(() => { hold = null; holdSelect(doc, x, y); }, HOLD_MS) };
  }, { passive: true });
  doc.addEventListener('touchmove', (e) => { const t = e.touches[0]; if (hold && t && Math.hypot(t.clientX - hold.x, t.clientY - hold.y) > 10) holdOff(); }, { passive: true });
  doc.addEventListener('touchend', () => { if (hold && rd) rd.tapAt = Date.now(); holdOff(); }, { passive: true });
  doc.addEventListener('touchcancel', holdOff, { passive: true });
  // v342: דפדוף בקיפול — לפני המנוע (capture): ההחלקה האופקית מפעילה את הקיפול, והגרירה של המנוע לא מקבלת את התנועה
  for (const ty of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) doc.addEventListener(ty, (e) => {
    const fr = doc.defaultView && doc.defaultView.frameElement; const r = fr ? fr.getBoundingClientRect() : { left: 0, top: 0 };
    curlTouch(e, r.left, r.top, holdOff);
  }, { capture: true, passive: false });
  doc.addEventListener('contextmenu', (e) => e.preventDefault());   // v337: בלי תפריט/בחירה של המכשיר בלחיצה ארוכה
  doc.__idx = index;
  let st = 0;
  doc.addEventListener('selectionchange', () => { clearTimeout(st); st = setTimeout(() => showSel(doc), 140); });
}
const HOLD_MS = 320;
/* ---- v342: דפדוף בקיפול דף (pagecurl.js) ---- */
let curlStyleVer = 0, curlPlainN = 0, curlPlainW = 0, curlT = 0, ct = null, curlTex = null, curlFont = null;
function curlFrame() {
  try { const c = rd.view.renderer.getContents(); const d = c && c[0] && c[0].doc; return d && d.defaultView ? d.defaultView.frameElement : null; } catch (e) { return null; }
}
function curlRtl() {
  // v344: באמצע מעבר בין פרקים המנוע עוד טוען את הפרק החדש — המסמך ריק, ו"לא RTL" הפך החלקה קדימה לאחורה
  // (הדפדוף נתקע/חזר עמוד בדפדוף מהיר). לכן: רק ממסמך עם תוכן, ושמירה לספר; לפני כן — כיוון הספר (OPF/שפה)
  const f = curlFrame(), d = f && f.contentDocument;
  if (d && d.body && d.body.childElementCount && d.readyState === 'complete') {
    rd.curlDir = d.body.dir === 'rtl' || d.documentElement.dir === 'rtl' || d.defaultView.getComputedStyle(d.body).direction === 'rtl';
    return rd.curlDir;
  }
  if (rd && rd.curlDir != null) return rd.curlDir;
  return !!(rd && readingDir(rd.book, rd.rec && rd.rec.title) === 'rtl');
}
async function curlSetup(box) {
  if (reduceMotion()) return;
  let mod;
  try { mod = await import('./pagecurl.js'); } catch (e) { return; }
  try {                                      // צייר העמוד + הגופן שלנו גם במסמך הראשי (הקנבס מצייר בו)
    curlTex = await import('./pagetex.js');
    if (!curlFont && typeof FontFace === 'function') { curlFont = new FontFace('SNB Noto', 'url("' + FONT_URL + '")', { weight: '100 900', stretch: '62.5% 100%' }); document.fonts.add(curlFont); curlFont.load().catch(() => {}); }
  } catch (e) { curlTex = null; }
  if (!rd || rd.els.box !== box) return;
  rd.curl = mod.createCurl({
    box, view: rd.view, foot: rd.els.foot,
    now: () => (typeof window !== 'undefined' && window.__pcNow ? window.__pcNow() : performance.now()),   // בדיקות: שעון נשלט
    frame: curlFrame, rtl: curlRtl,
    page: () => curTheme(),
    styleKey: () => curlStyleVer,
    canTurn: (dir) => { const r = rd && rd.view.renderer; return !!r && (dir > 0 ? !r.atEnd : !r.atStart); },
    renderer: () => rd && rd.view.renderer,
    bookCss: () => bookCSS(),
    adjacent: (dir) => {                      // הפרק השכן בסדר הקריאה (מדלג על פרקים לא־לינאריים, כמו המנוע)
      const r = rd && rd.view.renderer, secs = rd && rd.book && rd.book.sections; if (!r || !secs) return null;
      const c = r.getContents()[0]; if (!c) return null;
      for (let i = c.index + dir; i >= 0 && i < secs.length; i += dir) if (secs[i] && secs[i].linear !== 'no') return i;
      return null;
    },
    loadSection: (i) => rd.book.sections[i].load(),
    // v343: גב הדף בתלת־ממד — צייר העמוד (pagetex.js) מהפריסה האמיתית, ברזולוציית המסך
    paint: (o) => {
      if (!curlTex) return null;
      const real = curlFrame(), cont = real && real.parentElement && real.parentElement.parentElement;
      if (!cont) return null;
      const br = rd.els.box.getBoundingClientRect();
      return curlTex.paintPage({ doc: o.frame.contentDocument, frame: o.frame, box: rd.els.box, region: cont.getBoundingClientRect(), W: br.width, H: br.height,
        dpr: o.dpr, page: curTheme().page, shiftX: o.shiftX, foot: o.foot ? rd.els.foot : null,
        overlay: o.overlay ? [...real.parentElement.children].filter((e) => e !== real) : null });
    },
    jump: async (dir) => {                    // דפדוף מיידי במנוע (מתחת לשכבות הקיפול)
      const r = rd && rd.view.renderer; if (!r) return;
      const had = r.hasAttribute('animated'); r.removeAttribute('animated');
      try { await (dir > 0 ? r.next() : r.prev()); } finally { if (had && rd && rd.view.renderer === r) r.setAttribute('animated', ''); }
    },
    onDone: () => curlPrebuild(),
  });
  // v344: בזמן דפדוף התצוגה של הספר חתוכה (clip-path) לחלק שעוד לא התהפך — ונגיעה מחוץ לחיתוך לא מגיעה למסמך הספר
  // (בדיקת הנגיעה מכבדת clip-path). בדפדוף מהיר ברצף ההחלקה הבאה נבלעה בשקט. לכן גם שכבת הקורא מקשיבה — רק
  // לנגיעות שלא באו מהספר עצמו (אירועים מה־iframe לא מגיעים לכאן) ולא מסרגלים/כרטיסים/כפתורים
  const outside = (e) => !(e.target && e.target.closest && e.target.closest('.rd-topbar, .rd-botbar, .tr-card, .lib-sheet, .lib-veil, .rd-prev, button, input, a, [role="button"]'));
  for (const ty of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) box.addEventListener(ty, (e) => {
    if (ty === 'touchstart' ? outside(e) : ct) curlTouch(e, 0, 0, null);
  }, { capture: true, passive: false });
  curlPrebuild();
}
function curlPrebuild() {                    // שכפול מסמך הפרק + הפרקים השכנים מראש — שהקיפול יתחיל בלי עיכוב
  // v344: מיד אחרי כל דפדוף (לא דחייה של 450ms שמתאפסת בכל מעבר — בדפדוף מהיר היא לא רצה אף פעם והפרק הבא לא נטען)
  if (curlT) return;
  curlT = setTimeout(() => {
    curlT = 0;
    const go = () => { if (rd && rd.curl) rd.curl.prebuild(); };
    if (typeof requestIdleCallback === 'function') requestIdleCallback(go, { timeout: 200 }); else go();
  }, 40);
}
/* v344: מחווה שלא יכלה להתחיל מיד (הדפדוף הקודם עוד מסתיים / הפרק השכן נטען) — מחכה כמה פריימים במקום ליפול
   למעבר הפשוט. אם האצבע כבר עזבה — הדף מתהפך עד הסוף. רק אחרי 2.5 שנ׳ בלי הצלחה — מעבר רגיל של המנוע. */
const CURL_WAIT_MS = 2500;
function curlWait(w) {
  const c = rd && rd.curl; if (!c || w.done) return;
  if (c.active()) c.finishNow();             // דפדוף קודם שעוד רץ — מסתיים מיד (המשתמש כבר בדף הבא)
  const res = c.begin(w.dir, w.x, w.y);
  if (res === true) {
    w.done = true;
    if (w.up) c.turn(); else { ct = w.ct; ct.on = true; ct.wait = null; c.move(w.lx, w.ly); }
    return;
  }
  if (res === false || Date.now() - w.t0 > CURL_WAIT_MS) {
    w.done = true;
    if (w.ct === ct) { ct.wait = null; ct.dead = true; }
    if (w.up || w.ct !== ct) { curlPlainW++; const r = rd && rd.view.renderer; if (r && (w.dir > 0 ? !r.atEnd : !r.atStart)) (w.dir > 0 ? r.next() : r.prev()); }
    else ct.plain = w.dir;
    return;
  }
  requestAnimationFrame(() => curlWait(w));
}
const curlOn = () => !!(rd && rd.curl && S.flow !== 'scrolled' && !reduceMotion());
function curlTouch(e, ox, oy, holdOff) {
  if (!curlOn()) return;
  const c = rd.curl, t0 = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
  if (e.type === 'touchstart') {
    if (e.touches.length !== 1) { if (ct && ct.on) c.end('cancel'); ct = null; return; }
    if (c.active()) c.finishNow();            // דפדוף מהיר ברצף — הקודם מסתיים מיד
    ct = { x: t0.clientX + ox, y: t0.clientY + oy, wall: Date.now(), on: false, dead: false };
    return;
  }
  if (!ct) return;
  if (e.type === 'touchmove') {
    if (e.touches.length !== 1) { if (ct.on) c.end('cancel'); ct.on = false; ct.dead = true; return; }   // צביטה — למנוע
    e.stopPropagation(); if (e.cancelable) e.preventDefault();
    if (ct.dead || !t0) return;
    const x = t0.clientX + ox, y = t0.clientY + oy, dx = x - ct.x, dy = y - ct.y;
    if (!ct.on && !ct.wait) {                 // ממתין אחד לכל מחווה (לא בכל תנועת אצבע)
      if (Math.hypot(dx, dy) < 10) return;
      if (holdOff) holdOff();
      if ((rd.holdAt || 0) > ct.wall || Math.abs(dx) < Math.abs(dy) * 1.15) { ct.dead = true; return; }
      const dir = (curlRtl() ? dx > 0 : dx < 0) ? 1 : -1;
      const res = c.begin(dir, ct.x, ct.y);
      if (res === 'wait') { ct.wait = { ct, dir, x: ct.x, y: ct.y, lx: x, ly: y, t0: Date.now(), up: false, done: false }; requestAnimationFrame(() => curlWait(ct.wait)); }
      else if (!res) { ct.dead = true; ct.plain = dir; return; }
      else ct.on = true;
    }
    if (ct.wait) { ct.wait.lx = x; ct.wait.ly = y; return; }
    c.move(x, y);
    return;
  }
  if (e.type === 'touchend' || e.type === 'touchcancel') {
    if (ct.wait) { e.stopPropagation(); if (e.type === 'touchend') ct.wait.up = true; else ct.wait.done = true; }   // ממשיך לחכות — יתהפך כשמוכן
    else if (ct.on) { e.stopPropagation(); if (holdOff) holdOff(); c.end(e.type === 'touchcancel' ? 'cancel' : undefined); }
    else if (ct.plain && e.type === 'touchend') {   // הפרק השכן עוד לא מוכן לקיפול — מעבר רגיל של המנוע (בלי לאבד את ההחלקה)
      e.stopPropagation();
      const r = rd.view.renderer, d = ct.plain;
      curlPlainN++;
      if (r && (d > 0 ? !r.atEnd : !r.atStart)) (d > 0 ? r.next() : r.prev());
    }
    ct = null;
  }
}
/* v335: "Touch to Search" של Chrome (סרגל Google מלמטה) — בנגיעה במילה Chrome בוחר אותה בעצמו, הבחירה הפעילה
   את חלון הסימון, וזה סגר את כרטיס התרגום ("קופץ ונעלם"). Chrome מדלג על הסרגל כשהדף שינה את ה־DOM בזמן
   הנגיעה או טיפל בה — לכן שינוי DOM סינכרוני + preventDefault. גיבוי: בחירה שמופיעה מיד אחרי נגיעה קצרה
   (בלי לחיצה ארוכה) — לא שלנו, מבטלים אותה בשקט (foreignTapSel). */
function blockTouchSearch(doc, e) {
  try { e.preventDefault(); } catch (x) {}
  try { const s = doc.createElement('span'); s.hidden = true; doc.body.append(s); s.remove(); } catch (x) {}
}
export function foreignTapSel(now, tapAt, holdAt, popOpen) {   // בחירה שנולדה מנגיעה קצרה = של הדפדפן — טהורה
  return !popOpen && now - (tapAt || 0) < 2000 && now - (holdAt || 0) > 2000;
}
function holdSelect(doc, x, y) {
  if (!rd) return;
  const w = wordAt(doc, x, y);
  if (!w) return;
  rd.holdAt = Date.now(); rd.holdRange = w.range;
  if (rd.chrome && rd.setChrome) rd.setChrome(false);
  openSel(doc, w.range);
  try { if (navigator.vibrate) navigator.vibrate(8); } catch (e) {}
}
const WORD_CH = /[\p{L}\p{M}\p{N}'’\-\u05BE\u05F3\u05F4"]/u;
export function wordBounds(t, i) {           // גבולות המילה סביב תו i (אותיות/ניקוד/ספרות/גרש/מקף) — טהורה
  t = String(t || '');
  if (!(i < t.length && WORD_CH.test(t[i]))) { if (i > 0 && WORD_CH.test(t[i - 1])) i--; else return null; }
  let s = i, e = i + 1;
  while (s > 0 && WORD_CH.test(t[s - 1])) s--;
  while (e < t.length && WORD_CH.test(t[e])) e++;
  while (s < e && /['’\-\u05BE"]/.test(t[s])) s++;
  while (e > s && /['’\-\u05BE"]/.test(t[e - 1])) e--;
  if (s >= e || !/\p{L}/u.test(t.slice(s, e))) return null;   // מספר בלבד — לא מתרגמים
  return [s, e];
}
function wordAt(doc, x, y) {                 // המילה מתחת לאצבע — רק אם הנגיעה באמת עליה (לא בשוליים/בין שורות)
  let node, off;
  try {
    if (doc.caretPositionFromPoint) { const p = doc.caretPositionFromPoint(x, y); if (!p) return null; node = p.offsetNode; off = p.offset; }
    else if (doc.caretRangeFromPoint) { const r = doc.caretRangeFromPoint(x, y); if (!r) return null; node = r.startContainer; off = r.startOffset; }
  } catch (e) { return null; }
  if (!node || node.nodeType !== 3) return null;
  const b = wordBounds(node.data, off);
  if (!b) return null;
  const r = doc.createRange(); r.setStart(node, b[0]); r.setEnd(node, b[1]);
  const on = [...r.getClientRects()].some((q) => x >= q.left - 3 && x <= q.right + 3 && y >= q.top - 3 && y <= q.bottom + 3);
  return on ? { range: r, text: node.data.slice(b[0], b[1]) } : null;
}
const blockText = (n) => { const b = blockOf(n); return b ? b.textContent : ''; };

/* ---------------- בועת סימון + תרגום בהקשר ---------------- */
let selPop = null;
function hideSel() { if (selPop) { selPop.remove(); selPop = null; } }
function blockOf(node) {
  let el = node && (node.nodeType === 1 ? node : node.parentElement);
  while (el && el.parentElement && !/^(P|LI|TD|TH|BLOCKQUOTE|H[1-6]|DD|DT|FIGCAPTION|CAPTION)$/.test(el.tagName)) el = el.parentElement;
  return el;
}
function annOverlapping(doc, range) {     // הדגשה פעילה שחופפת לסימון (באותו פרק)
  if (!rd || !range) return null;
  for (const a of liveAnn(rd.rec.ann)) {
    try {
      const r = rd.view.resolveCFI(a.c);
      if (r.index !== doc.__idx) continue;
      const ar = r.anchor(doc);
      if (ar && range.compareBoundaryPoints(Range.START_TO_END, ar) > 0 && range.compareBoundaryPoints(Range.END_TO_START, ar) < 0) return a;
    } catch (e) {}
  }
  return null;
}
function showSel(doc) {
  const sel = doc.getSelection && doc.getSelection();
  const text = sel ? String(sel).replace(/\s+/g, ' ').trim() : '';
  const selMode = !!(trCard && trCard._sel);
  // שחרור האצבע אחרי לחיצה ארוכה יכול לקפל את הבחירה (נגיעה שמציבה סמן) — מחזירים את המילה, הכרטיס נשאר
  if (!text && rd && selMode && rd.holdRange && Date.now() - (rd.holdAt || 0) < 1500) {
    try { sel.removeAllRanges(); sel.addRange(rd.holdRange); } catch (e) {}
    return;
  }
  if (!text || !rd) return;                  // בחירה שהתבטלה (גם אחרי הדגשה) — הכרטיס נשאר פתוח
  if (foreignTapSel(Date.now(), rd.tapAt, rd.holdAt, selMode)) { try { sel.removeAllRanges(); } catch (e) {} return; }
  if (selMode && trCard._sel.t === text) return;
  openSel(doc, sel.getRangeAt(0).cloneRange());
}
function openSel(doc, range) {               // v337: הכרטיס במצב סימון לטווח — מסומן בצבע שלנו, עם ידיות (לא בחירה של הדפדפן)
  const text = String(range).replace(/\s+/g, ' ').trim();
  if (!text || !rd) return;
  try { doc.getSelection().removeAllRanges(); } catch (e) {}
  selPaint(doc, range);
  const block = blockOf(range.commonAncestorContainer);
  const hit = annOverlapping(doc, range);   // v326: סימון על הדגשה קיימת — כמו בקינדל: אפשר להחליף צבע או להסיר, בלי עותק נוסף
  const bt = block ? block.textContent : text;
  if (hit) trShow(hit.x, bt, doc, range, { text: hit.x, cfi: hit.c, ann: hit, t: text });
  else trShow(text, bt, doc, range, { text, cfi: rd.view.getCFI(doc.__idx, range), t: text });
}
function annPopup(value, range, index) {    // נגיעה בהדגשה קיימת — אותו כרטיס, עם הצבע שלה ו"הסרת הסימון"
  const ann = rd && rd.rec.ann.find((x) => x.c === value && !x.d);
  if (!ann) return;
  const doc = range.startContainer.ownerDocument;
  const block = blockOf(range.commonAncestorContainer);
  trShow(ann.x, block ? block.textContent : ann.x, doc, range, { text: ann.x, cfi: ann.c, ann, t: ann.x });
}
/* v336 (בקשת המשתמש): חלון הסימון הוטמע בכרטיס התרגום — שורת פעולות אחת, מינימליסטית, בראש הכרטיס.
   צד אחד: עיגול צבע אחד (הצבע האחרון / של ההדגשה) שנפתח לבורר צבעים, הערה, ציטוט, מונח; הצד השני: השמעה, העתקה, Google */
const HL_LAST = 'pwa_hlcolor_v1';
function hlLast() { try { const k = localStorage.getItem(HL_LAST); return HL_COLORS[k] ? k : 'b'; } catch (e) { return 'b'; } }
const ICON_NOTE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>';
const ICON_TERM = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/></svg>';
function selBar(c, sel, text) {
  const bar = h('div', 'tr-bar');
  const side = h('div', 'tr-bar-s');
  if (sel) {
    const sw = h('button', 'tr-sw'); sw.type = 'button'; sw.setAttribute('aria-haspopup', 'true'); sw.setAttribute('aria-expanded', 'false');
    const paint = () => { const k = (sel.ann && !sel.ann.d && sel.ann.k) || hlLast(); sw.style.setProperty('--sw', HL_COLORS[k]); sw.classList.toggle('on', !!(sel.ann && !sel.ann.d)); sw.setAttribute('aria-label', T('hlColor')); };
    paint();
    let pal = null;
    const closePal = () => { if (!pal) return; const p = pal; pal = null; sw.setAttribute('aria-expanded', 'false'); bar.classList.remove('pal-open'); p.remove(); };
    sw.addEventListener('click', (e) => {
      e.stopPropagation();
      if (pal) return closePal();
      pal = h('div', 'tr-pal'); pal.setAttribute('role', 'menu');
      Object.keys(HL_COLORS).forEach((k) => {
        const d = h('button', 'tr-dot' + (sel.ann && !sel.ann.d && sel.ann.k === k ? ' on' : '')); d.type = 'button'; d.style.setProperty('--sw', HL_COLORS[k]);
        d.setAttribute('aria-label', T('hlColor'));
        d.addEventListener('click', (ev) => {
          ev.stopPropagation();
          try { localStorage.setItem(HL_LAST, k); } catch (er) {}
          sel.ann = saveHighlight({ text: sel.text, cfi: sel.cfi, k, ann: sel.ann && !sel.ann.d ? sel.ann : null });
          clearSelection(); paint(); closePal();
          try { if (navigator.vibrate) navigator.vibrate(6); } catch (er) {}
        });
        pal.append(d);
      });
      if (sel.ann && !sel.ann.d && !sel.ann.b) {
        const rm = h('button', 'tr-dot tr-unmark'); rm.type = 'button'; rm.innerHTML = ICON.unmark; rm.setAttribute('aria-label', T('hlRemove'));
        rm.addEventListener('click', (ev) => { ev.stopPropagation(); annRemove(rd.rec, sel.ann); sel.ann = null; clearSelection(); paint(); closePal(); });
        pal.append(rm);
      }
      sw.setAttribute('aria-expanded', 'true');
      sw.after(pal); bar.classList.add('pal-open');   // העיגול נפתח לשורת צבעים במקום כלי הסימון (כמו iOS) — בלי חלון צף
    });
    c._closePal = closePal;
    const ib = (cls, icon, label, fn) => { const b = h('button', 'tr-ib ' + cls); b.type = 'button'; b.innerHTML = icon; b.setAttribute('aria-label', T(label)); b.title = T(label); b.addEventListener('click', (e) => { e.stopPropagation(); fn(); }); return b; };
    side.append(sw,
      ib('tr-note', ICON_NOTE, sel.ann && String(sel.ann.n || '').trim() ? 'hlEditNote' : 'hlNote', () => { const a = sel.ann && !sel.ann.d ? sel.ann : saveHighlight({ text: sel.text, cfi: sel.cfi, k: hlLast() }); hideTr(true); noteSheet(a, rd.rec); }),
      ib('tr-quote', ICON.quote, 'hlQuote', () => { hideTr(true); quoteCard(sel.text); }));
    const gm = glossaryMatch(sel.text);
    if (gm) side.append(ib('tr-term', ICON_TERM, 'acTerm', () => sheet(T('acTerm'), (sh) => sh.append(termRow(gm)))));
  }
  const acts = h('div', 'tr-acts');
  bar.append(side, acts);
  return { bar, acts };
}
function clearSelection() {
  try { const d = rd && rd.view.renderer.getContents()[0]; d && d.doc.getSelection().removeAllRanges(); } catch (e) {}
  selPaint(null);
}
/* v337: הבחירה שלנו — צביעה ב־CSS Highlight (בלי לגעת ב־DOM של הספר) + שתי ידיות לגרירה, כמו בקינדל */
let selCur = null;                         // { doc, range, hs, he }
function selPaint(doc, range) {
  if (selCur) { try { selCur.doc.defaultView.CSS.highlights.delete('snb-sel'); } catch (e) {} selCur.hs.remove(); selCur.he.remove(); selCur = null; }
  if (!doc || !range || !rd) return;
  try { const w = doc.defaultView; if (w.CSS && w.CSS.highlights && w.Highlight) w.CSS.highlights.set('snb-sel', new w.Highlight(range)); } catch (e) {}
  const mk = (cls) => { const b = h('div', 'rd-hdl ' + cls); b.setAttribute('aria-hidden', 'true'); b.append(h('i')); rd.els.box.append(b); return b; };
  selCur = { doc, range, hs: mk('s'), he: mk('e') };
  selPlace();
  selDrag(selCur.hs, true); selDrag(selCur.he, false);
}
function caretRect(range, atStart) {
  const r = range.cloneRange(); r.collapse(atStart);
  const q = r.getClientRects()[0] || r.getBoundingClientRect();
  if (q && (q.height || q.width)) return q;
  const all = range.getClientRects(); const e = all[atStart ? 0 : all.length - 1];
  if (!e) return null;
  const rtl = getComputedStyle(range.startContainer.parentElement || range.startContainer).direction === 'rtl';
  const x = atStart === rtl ? e.right : e.left;
  return { left: x, right: x, top: e.top, bottom: e.bottom };
}
function selPlace() {
  if (!selCur) return;
  const fr = selCur.doc.defaultView.frameElement.getBoundingClientRect(), bx = rd.els.box.getBoundingClientRect();
  [[selCur.hs, true], [selCur.he, false]].forEach(([el, st]) => {
    const q = caretRect(selCur.range, st);
    if (!q) { el.style.display = 'none'; return; }
    el.style.display = '';
    el.style.left = (fr.left - bx.left + q.left) + 'px';
    el.style.top = (fr.top - bx.top + q.bottom) + 'px';
  });
}
export function selExtend(cmp, range, pt, start) {   // הידית נגררה לנקודה pt — הטווח החדש (בגבולות מילה), בלי להתהפך — טהורה (cmp: השוואת נקודות)
  if (start) return cmp(pt.s, range.e) < 0 ? { s: pt.s, e: range.e } : { s: range.s, e: range.e };
  return cmp(pt.e, range.s) > 0 ? { s: range.s, e: pt.e } : { s: range.s, e: range.e };
}
function selDrag(el, start) {
  let raf = 0, last = null;
  const doc = () => selCur && selCur.doc;
  const move = (x, y) => {
    const d = doc(); if (!d) return;
    const fr = d.defaultView.frameElement.getBoundingClientRect();
    const px = x - fr.left, py = y - fr.top - 22;          // מעט מעל האצבע — רואים את המילה
    let node, off;
    try { const c = d.caretRangeFromPoint ? d.caretRangeFromPoint(px, py) : null; if (!c) return; node = c.startContainer; off = c.startOffset; } catch (e) { return; }
    if (!node || node.nodeType !== 3) return;
    const b = wordBounds(node.data, off) || [off, off];
    const R = selCur.range;
    const cmp = (a, z) => { const r1 = d.createRange(); r1.setStart(a[0], a[1]); const r2 = d.createRange(); r2.setStart(z[0], z[1]); return r1.compareBoundaryPoints(Range.START_TO_START, r2); };
    const n = selExtend(cmp, { s: [R.startContainer, R.startOffset], e: [R.endContainer, R.endOffset] }, { s: [node, b[0]], e: [node, b[1]] }, start);
    const r = d.createRange(); r.setStart(n.s[0], n.s[1]); r.setEnd(n.e[0], n.e[1]);
    if (!String(r).trim()) return;
    selCur.range = r;
    try { d.defaultView.CSS.highlights.set('snb-sel', new d.defaultView.Highlight(r)); } catch (e) {}
    selPlace();
  };
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); el.setPointerCapture(e.pointerId); el.classList.add('drag'); });
  el.addEventListener('pointermove', (e) => {
    if (!el.classList.contains('drag')) return;
    last = [e.clientX, e.clientY];
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; if (last) move(last[0], last[1]); });
  });
  const up = (e) => {
    if (!el.classList.contains('drag')) return;
    el.classList.remove('drag'); e.stopPropagation();
    if (selCur) { const d = selCur.doc, r = selCur.range; openSel(d, r); }   // הכרטיס מתעדכן לקטע החדש
  };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  el.addEventListener('click', (e) => e.stopPropagation());
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function saveHighlight({ text, cfi, k, ann }) {
  const r = rd.rec;
  const loc = rd.loc || {};
  const a = ann || { id: uid(), c: cfi, x: String(text).slice(0, 600), ch: (loc.tocItem && langText(loc.tocItem.label)) || '', f: loc.fraction || 0 };
  if (!ann) r.ann.push(a);
  annTouch(r, a, { k });
  return a;
}
/* v326: עדכון הדגשה/סימנייה בכל מקום (קורא, תוכן העניינים, "מה למדתי") — שמירה, ענן, ובקורא פתוח של אותו ספר גם ציור מחדש */
function annTouch(rec, a, patch) {
  Object.assign(a, patch, { u: Date.now() });
  putBook(rec).catch(() => {}); pushAnn(rec, a);
  if (rd && rd.rec && rd.rec.id === rec.id) {
    if (rd.rec !== rec) { const x = rd.rec.ann.find((y) => y.id === a.id); if (x) Object.assign(x, a); }
    if (!a.b) { (a.d ? rd.view.deleteAnnotation({ value: a.c }) : rd.view.addAnnotation({ value: a.c })).catch(() => {}); renderBmMarks(); }
    else markBookmark(true);               // v329: הסרת סימנייה (גם מתוכן העניינים) — הסרט מתקפל באנימציה
  }
}
function annCleanDupes(rec) {              // מצבה לעותקים כפולים של אותה הדגשה (נשמר בענן — מכשיר אחר לא יחזיר אותם)
  const ids = annDupes(rec.ann);
  if (!ids.length) return false;
  rec.ann.forEach((a) => { if (ids.includes(a.id)) { Object.assign(a, { d: 1, u: Date.now() }); pushAnn(rec, a); } });
  putBook(rec).catch(() => {});
  return true;
}
function deleteAnn(a, rec) { annTouch(rec || rd.rec, a, { d: 1 }); }
function annRemove(rec, a, after) {        // הסרת סימון: מיד; עם הערה — קודם אישור (ההערה נמחקת איתו)
  const go = () => { annTouch(rec, a, { d: 1 }); flashSafe(a.b ? T('bmRemoved') : T('hlRemoved')); if (after) after(); };
  if (!a.b && String(a.n || '').trim() && typeof askConfirm === 'function') askConfirm(T('hlRemoveNoteQ'), go, { danger: true, ok: T('hlRemove') });
  else go();
}
function noteSheet(a, rec, after) {
  sheet(String(a.n || '').trim() ? T('hlEditNote') : T('hlAddNote'), (sh, close) => {
    const q = h('p', 'ann-sh-q', '“' + a.x + '”'); q.dir = 'auto'; q.style.setProperty('--hl', HL_COLORS[a.k] || HL_COLORS.y);
    const ta = h('textarea', 'hl-ta'); ta.value = a.n || ''; ta.placeholder = T('hlNotePh'); ta.dir = 'auto'; ta.rows = 4;
    const save = h('button', 'bk-cta', T('hlSave')); save.type = 'button';
    save.addEventListener('click', () => {
      const r = rec || (rd && rd.rec);
      if (r) annTouch(r, a, { n: ta.value.trim().slice(0, 2000) });
      close();
      if (after) after();
    });
    sh.append(q, ta, save);
    setTimeout(() => ta.focus(), 250);
  });
}
/* v326: גיליון פעולות להדגשה — כמו המחברת של קינדל, בעיצוב Apple: צבע, הערה, העתקה, ציטוט, מעבר למקום, הסרה */
function annActions(rec, a, opt) {
  const o = opt || {};
  const after = () => { if (o.after) o.after(); };
  sheet('', (sh) => {
    const veil = () => sh.parentNode;
    const q = h('p', 'ann-sh-q', '“' + (a.x || '—') + '”'); q.dir = 'auto';
    if (a.b) q.classList.add('bm'); else q.style.setProperty('--hl', HL_COLORS[a.k] || HL_COLORS.y);
    sh.append(q);
    if (!a.b) {
      const cols = h('div', 'ann-colors'); cols.setAttribute('role', 'radiogroup'); cols.setAttribute('aria-label', T('hlColor'));
      Object.keys(HL_COLORS).forEach((k) => {
        const b = h('button', (a.k || 'y') === k ? 'on' : ''); b.type = 'button'; b.style.background = HL_COLORS[k];
        b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String((a.k || 'y') === k)); b.setAttribute('aria-label', T('hlColor'));
        b.addEventListener('click', () => {
          annTouch(rec, a, { k });
          cols.querySelectorAll('button').forEach((x) => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-checked', String(on)); });
          q.style.setProperty('--hl', HL_COLORS[k]);
          after();
        });
        cols.append(b);
      });
      sh.append(cols);
    }
    const list = h('div', 'lib-ios ann-acts');
    const row = (icon, label, fn, cls) => {
      const r = h('button', 'lib-row' + (cls ? ' ' + cls : '')); r.type = 'button';
      const ic = h('span', 'lib-rowic'); ic.innerHTML = icon;
      r.append(h('span', 'lib-row-l', label), ic);
      r.addEventListener('click', fn);
      list.append(r);
    };
    if (o.open) row(ICON.open, T('annOpen'), () => closeSheetThen(veil(), o.open));
    if (!a.b) row(ICON.notes, String(a.n || '').trim() ? T('hlEditNote') : T('hlAddNote'), () => closeSheetThen(veil(), () => noteSheet(a, rec, after)));
    row(ICON.copy, T('annCopy'), async () => {
      const txt = '“' + String(a.x || '').trim() + '”' + (String(a.n || '').trim() ? '\n✎ ' + String(a.n).trim() : '') + (rec.title ? '\n— ' + rec.title : '');
      try { await navigator.clipboard.writeText(txt); flashSafe(T('rdCopied')); } catch (e) {}
      const v = veil(); if (v && v._close) v._close();
    });
    if (!a.b) row(ICON.quote, T('annShareQuote'), () => closeSheetThen(veil(), () => quoteCard(a.x, rec)));
    row(ICON.trash, a.b ? T('annDeleteBm') : T('hlRemove'), () => closeSheetThen(veil(), () => annRemove(rec, a, after)), 'danger');
    sh.append(list);
  });
}

/* ---- סימניות: לפי העמוד הנוכחי (CFI של הטווח הגלוי) ---- */
/* v330 (באג שהמשתמש דיווח): סימנייה הופיעה גם בעמוד שלפני העמוד המסומן. הסימנייה נשמרת בתחילת העמוד, וסוף הטווח של
   העמוד הקודם הוא בדיוק אותה נקודה (נמדד: עמוד 1 = [/2 , /6/1:300], עמוד 2 = [/6/1:300 , /8/1:863]) — וההשוואה כללה את הסוף.
   עכשיו הטווח חצי־פתוח [תחילה, סוף): נקודה בסוף שייכת לעמוד הבא. עמוד ריק (תחילה = סוף) — רק נקודה בדיוק שם. טהורה (נבדקת). */
// מוסיף <head> ריק לפרק שאין לו (אחרי תגית <html>), כדי שהמנוע יוכל להזריק את עיצוב הקורא
export function ensureHead(src) {
  if (typeof src !== 'string' || /<head[\s>/]/i.test(src)) return src;
  return src.replace(/<html\b[^>]*>/i, (m) => m + '<head></head>');
}
export function bmOnPage(c, a, z, cmp) {
  if (cmp(c, a) < 0) return false;
  const e = cmp(c, z);
  if (e < 0) return true;
  return e === 0 && cmp(a, z) === 0;
}
function pageHasBookmark() {
  const loc = rd && rd.loc; if (!loc || !loc.cfi) return null;
  try {
    const a = CFI.collapse(loc.cfi), z = CFI.collapse(loc.cfi, true);
    return liveAnn(rd.rec.ann, 'bm').find((b) => bmOnPage(b.c, a, z, CFI.compare)) || null;
  } catch (e) { return null; }
}
/* v330: סרט קטן לכרטיס סימנייה במחברת — אותה צורה כמו בקורא, סאטן ירוק (מעבר צבע לרוחב: שוליים כהים, ברק במרכז) */
let rbSeq = 0;
function ribbonMiniSVG() {
  const g = 'snbRb' + (++rbSeq);
  return '<svg viewBox="0 0 24 40" aria-hidden="true"><defs><linearGradient id="' + g + '" x1="0" x2="1" y1="0" y2="0">' +
    '<stop offset="0" stop-color="#15843A"/><stop offset=".16" stop-color="#22B04B"/><stop offset=".36" stop-color="#5BE67F"/>' +
    '<stop offset=".52" stop-color="#34D35C"/><stop offset=".82" stop-color="#22B04B"/><stop offset="1" stop-color="#127832"/></linearGradient></defs>' +
    '<path d="' + RIBBON_PATH + '" fill="url(#' + g + ')" stroke="#127832" stroke-width=".7"/>' +
    '<path d="M4 1.5h16v3.2H4z" fill="#000" fill-opacity=".14"/></svg>';
}
/* v329: סרט בעיצוב קינדל — שכבת מתאר (צבע הדף + קו אפור) ומעליה שכבת מילוי ירוקה שנחשפת מלמעלה למטה */
const RIBBON_PATH = 'M4 1.5h16a1.5 1.5 0 0 1 1.5 1.5v33.2c0 1.15-1.24 1.87-2.24 1.3L12 33.3l-7.26 4.2c-1 .57-2.24-.15-2.24-1.3V3A1.5 1.5 0 0 1 4 1.5z';
const RIBBON_SVG = '<svg viewBox="0 0 24 40" aria-hidden="true"><path class="rb-out" d="' + RIBBON_PATH + '"/><path class="rb-fill" d="' + RIBBON_PATH + '"/><path class="rb-shine" d="M7 4v26"/></svg>';
function markBookmark(animate) {
  if (!rd) return;
  const on = !!pageHasBookmark();
  const rb = rd.els.ribbon;
  const was = rb.classList.contains('on');
  rb.classList.toggle('on', on);
  rb.setAttribute('aria-pressed', String(on)); rb.setAttribute('aria-label', on ? T('annDeleteBm') : T('bmAdd'));
  rd.els.bmBtn.classList.toggle('on', on);
  renderBmMarks();
  if (rd.r3d) rd.r3d.set(on, !!animate && was !== on);   // v330: הסרט התלת־ממדי — פעולת משתמש = התרוממות ונחיתה; החלפת עמוד = מיד
  if (animate && was !== on && !reduceMotion()) {
    // אנימציה בשלבים: בהוספה — הסרט "נשמט" למטה עם קפיצה קטנה והירוק נשפך מלמעלה; בהסרה — הירוק מתרוקן ואז הסרט מתקפל למעלה
    rb.classList.remove('anim-on', 'anim-off'); void rb.offsetWidth;
    rb.classList.add(on ? 'anim-on' : 'anim-off');
    clearTimeout(rb._animT); rb._animT = setTimeout(() => rb.classList.remove('anim-on', 'anim-off'), 700);
    try { if (navigator.vibrate) navigator.vibrate(on ? 12 : 8); } catch (e) {}
  }
}
function toggleBookmark() {
  const cur = pageHasBookmark();
  if (cur) { annTouch(rd.rec, cur, { d: 1 }); if (typeof flash === 'function') flash(T('bmRemoved')); return; }
  const loc = rd.loc || {}; if (!loc.cfi) return;
  const start = CFI.collapse(loc.cfi);
  let excerpt = '';
  try { excerpt = String(loc.range ? loc.range.toString() : '').replace(/\s+/g, ' ').trim().slice(0, 160); } catch (e) {}
  const a = { id: uid(), c: start, x: excerpt, b: 1, ch: (loc.tocItem && langText(loc.tocItem.label)) || '', f: loc.fraction || 0, u: Date.now() };
  rd.rec.ann.push(a);
  putBook(rd.rec).catch(() => {}); pushAnn(rd.rec, a);
  markBookmark(true);
  if (typeof flash === 'function') flash(T('bmAdded'));
}

export function pageMoved(a, b, strict) {   // האם עברנו עמוד: פרק אחר או מספר עמוד אחר (strict: גם שבר התקדמות > 0.2%) — טהורה
  if (!a || !b) return true;
  if (a.index !== b.index) return true;
  const la = a.location && a.location.current, lb = b.location && b.location.current;
  if (la != null && lb != null) return la !== lb;
  return strict ? Math.abs((a.fraction || 0) - (b.fraction || 0)) > 0.002 : a.cfi !== b.cfi;
}
/* ---- v331: ציר ההתקדמות — סימניות, עצירה מגנטית עם רטט, תצוגה מקדימה, חזרה למקום ---- */
const SCRUB_THUMB = 22;                    // רוחב האגודל ב־CSS — מיקום הסימניות על הציר ומיקום התצוגה המקדימה מחושבים לפיו
export function readingDir(book, title) { // כיוון הקריאה: מה־OPF, אחרת לפי שפת הספר, אחרת לפי השם
  if (book && (book.dir === 'rtl' || book.dir === 'ltr')) return book.dir;
  const lang = String([].concat((book && book.metadata && book.metadata.language) || [])[0] || '');
  if (lang) return /^(he|iw|ar|fa|ur|yi|ps|dv|ckb)(\b|-|_)/i.test(lang) ? 'rtl' : 'ltr';
  return /[\u0590-\u05FF\u0600-\u06FF]/.test(String(title || '')) ? 'rtl' : 'ltr';
}
export function sectionAt(fr, f) {         // גבולות הפרקים (0..1, n+1 ערכים) + מיקום בספר → הפרק והמיקום היחסי בתוכו
  if (!fr || fr.length < 2) return null;
  let i = 0;
  for (let k = 0; k < fr.length - 1; k++) if (fr[k] <= f + 1e-9) i = k;
  const span = fr[i + 1] - fr[i];
  return { i, w: span > 0 ? Math.min(1, Math.max(0, (f - fr[i]) / span)) : 0 };
}
export function scrubSnap(v, bms, wPx, cur) {   // v: 0..1000; סימון בטווח 10px מהאגודל (יציאה ב־15px — בלי ריצוד בגבול)
  let best = null, bd = Infinity, bs = Infinity;
  for (const b of bms) {
    const d = Math.abs(b.f * 1000 - v) / 1000 * wPx;
    const sc = d + (b.r || 0) * 0.75;      // v332: באותו מקום — סימנייה לפני הערה לפני הדגשה
    if (sc < bs) { bs = sc; bd = d; best = b; }
  }
  return best && bd <= (best.id === cur ? 15 : 10) ? best : null;
}
const MK_RANK = { bm: 0, note: 1, hl: 2 };
export function scrubMarks(ann, colors) {  // v332: כל הסימונים לציר — סוג, צבע, ובלי כפילויות באותה נקודה מאותו סוג וצבע (טהורה)
  const out = [], last = {};
  (ann || []).filter((a) => a && !a.d && typeof a.f === 'number' && a.f >= 0 && a.f <= 1)
    .map((a) => {
      const t = a.b ? 'bm' : (String(a.n || '').trim() ? 'note' : 'hl');
      return { id: a.id, f: +a.f, c: a.c, x: a.x || '', n: a.b ? '' : String(a.n || '').trim(), ch: a.ch || '', t, r: MK_RANK[t], col: a.b ? '' : (colors[a.k] || colors.y) };
    })
    .sort((a, b) => a.f - b.f || a.r - b.r)
    .forEach((m) => { const p = last[m.t + m.col]; if (p && m.f - p.f < 0.0035) return; last[m.t + m.col] = m; out.push(m); });
  return out;
}
export function scrubSnippet(t, w, n) {    // שורות הפתיחה של העמוד במיקום w בפרק — מתחילת משפט/פסקה קרובה
  if (!t) return '';
  n = n || 220;
  let p = Math.floor(Math.min(1, Math.max(0, w)) * t.length);
  const back = t.slice(Math.max(0, p - 140), p);
  const m = Math.max(back.lastIndexOf('\n'), back.lastIndexOf('. '), back.lastIndexOf('? '), back.lastIndexOf('! '), back.lastIndexOf('.” '), back.lastIndexOf('." '));
  if (m >= 0) p = p - back.length + m + 1;
  else { const sp = t.lastIndexOf(' ', p); if (sp >= 0 && sp > p - 30) p = sp + 1; }
  let out = t.slice(p, p + n).replace(/\s+/g, ' ').trim().replace(/^[.?!”"']+\s*/, '');
  if (p + n < t.length) out = out.replace(/\s+\S*$/, '') + '…';
  return out;
}
function preloadSecText(rec) {             // מהאינדקס של החיפוש (אם כבר נבנה) — התצוגה המקדימה מיידית
  tx('text', 'readonly', (st) => reqP(st.get(rec.id))).then((x) => {
    if (!rd || rd.rec !== rec || !x || !x.secs) return;
    const c = rd.ptext || (rd.ptext = new Map());
    for (const sc of x.secs) if (!c.has(sc.i)) c.set(sc.i, Promise.resolve(sc.t));
  }).catch(() => {});
}
function secText(i) {
  if (!rd || !rd.book) return Promise.resolve('');
  const c = rd.ptext || (rd.ptext = new Map());
  if (!c.has(i)) {
    const sec = rd.book.sections && rd.book.sections[i];
    c.set(i, sec && sec.createDocument ? sec.createDocument().then(docText).catch(() => '') : Promise.resolve(''));
  }
  return c.get(i);
}
const scrubBms = () => (rd && rd.mk) || [];
function renderBmMarks() {                 // שם היסטורי: מצייר את כל הסימונים — סימניות, הערות והדגשות
  if (!rd || !rd.els.marks) return;
  const mk = scrubMarks(rd.rec.ann, HL_COLORS), m = rd.els.marks;
  const key = mk.map((b) => b.id + ':' + b.t + b.col + ':' + b.f.toFixed(4) + ':' + b.n.length).join(',');
  rd.mk = mk;
  if (m._key === key) return;
  m._key = key; m.textContent = '';
  const frag = document.createDocumentFragment();
  for (const t of ['hl', 'note', 'bm']) for (const b of mk) {   // שכבות: הדגשות למטה, הערות מעליהן, סימניות למעלה
    if (b.t !== t) continue;
    const k = h('span', t === 'bm' ? 'rd-bmark' : 'rd-hlmark' + (t === 'note' ? ' note' : '')); k.dataset.id = b.id;
    k.style.setProperty('--f', b.f.toFixed(4));
    if (t === 'bm') k.innerHTML = ribbonMiniSVG(); else k.style.setProperty('--c', b.col);
    frag.append(k);
  }
  m.append(frag);
}
function scrubTrack() {
  const r = rd.els.slider.getBoundingClientRect();
  return { r, w: Math.max(1, r.width - SCRUB_THUMB), rtl: rd.els.scrub.dir === 'rtl' };
}
function scrubStart() {
  if (!rd) return;
  rd.scrubbing = true;
  rd.scrubOrigin = rd.loc && rd.loc.cfi ? { cfi: rd.loc.cfi, f: rd.loc.fraction || 0 } : null;
  rd.els.prev.classList.add('on');
  scrubInput();
}
function scrubEnd() {
  if (!rd) return;
  rd.scrubbing = false;
  rd.els.prev.classList.remove('on');
}
function scrubInput() {
  if (!rd) return;
  const el = rd.els, t = scrubTrack();
  let v = +el.slider.value;
  // עצירה מגנטית: רק בגרירה באצבע (במקלדת — צעד קטן היה "נתקע" בסימנייה)
  const hit = rd.scrubbing ? scrubSnap(v, scrubBms(), t.w, rd.scrubHit && rd.scrubHit.id) : null;
  if (hit) { v = Math.round(hit.f * 1000); if (+el.slider.value !== v) el.slider.value = String(v); }
  if ((hit && hit.id) !== (rd.scrubHit && rd.scrubHit.id)) {
    rd.scrubHit = hit;
    const old = rd.scrubHitEl; if (old) old.classList.remove('hit');
    rd.scrubHitEl = hit ? el.marks.querySelector('[data-id="' + hit.id + '"]') : null;
    if (rd.scrubHitEl) rd.scrubHitEl.classList.add('hit');
    // האגודל מקבל טבעת בצבע הסימון שעליו (ירוק לסימנייה, צבע ההדגשה להדגשה/הערה)
    if (hit) { el.scrub.dataset.hit = hit.t; el.scrub.style.setProperty('--hit', hit.col || '#30D158'); } else delete el.scrub.dataset.hit;
    if (hit) { try { if (navigator.vibrate) navigator.vibrate(10); } catch (e) {} }   // רטט עדין: "את על הסימנייה"
  }
  el.scrub.style.setProperty('--p', v / 10 + '%');
  el.slider.setAttribute('aria-valuetext', Math.round(v / 10) + '%');
  if (rd.scrubbing) scrubPreview(v / 1000, hit, t);
}
function scrubPreview(f, hit, t) {
  const el = rd.els, p = el.prev;
  const x = t.rtl ? t.r.right - SCRUB_THUMB / 2 - f * t.w : t.r.left + SCRUB_THUMB / 2 + f * t.w;
  const sr = el.scrub.getBoundingClientRect(), cw = p.offsetWidth || 216;
  const left = Math.max(12, Math.min(innerWidth - 12 - cw, x - cw / 2));
  p.style.left = Math.round(left - sr.left) + 'px';
  el.pvPct.textContent = Math.round(f * 100) + '%';
  scrubPvKind(hit);
  const at = sectionAt(rd.view.getSectionFractions ? rd.view.getSectionFractions() : null, f);
  let ch = hit && hit.ch ? hit.ch : '';
  if (!ch && at && rd.view.getProgressOf) { try { const it = rd.view.getProgressOf(at.i).tocItem; ch = it ? langText(it.label) : ''; } catch (e) {} }
  el.pvCh.textContent = ch || rd.rec.title || '';
  const seq = ++rd.pvSeq;
  if (hit && (hit.x || hit.n)) {           // על סימון — הקטע ששמור בו: סימנייה כטקסט, הדגשה במרקר בצבע שלה, הערה מעל הקטע
    el.pvTx.textContent = '';
    if (hit.t === 'bm') el.pvTx.textContent = hit.x;
    else {
      if (hit.n) el.pvTx.append(h('span', 'rd-prev-note', hit.n), document.createTextNode(' '));
      if (hit.x) el.pvTx.append(h('span', 'rd-prev-mk', hit.x));
    }
    return;
  }
  if (!at) return;
  secText(at.i).then((txt) => { if (rd && rd.pvSeq === seq) el.pvTx.textContent = scrubSnippet(txt, at.w) || '…'; });
}
function scrubPvKind(hit) {               // תווית הסוג בתחתית התצוגה המקדימה + טבעת בצבע הסימון
  const el = rd.els, p = el.prev, t = hit ? hit.t : '';
  p.classList.toggle('bm', t === 'bm'); p.classList.toggle('mk', !!t && t !== 'bm');
  if (hit && hit.col) p.style.setProperty('--hc', hit.col);
  el.pvBm.classList.toggle('on', !!t);
  if (el.pvBm._t === t) return;
  el.pvBm._t = t; el.pvBm.textContent = '';
  if (!t) return;
  if (t === 'bm') el.pvBm.innerHTML = ribbonMiniSVG();
  else el.pvBm.append(h('i', 'rd-prev-ic ' + t));
  el.pvBm.append(h('b', '', t === 'bm' ? T('annBmLabel') : t === 'note' ? T('hlNote') : T('hlColor')));
  el.pvBm.dataset.k = t;
}
function scrubCommit() {
  if (!rd) return;
  const hit = rd.scrubHit, from = rd.scrubOrigin, v = +rd.els.slider.value / 1000;
  scrubEnd();
  rd.scrubHit = null; rd.scrubOrigin = null;
  if (rd.scrubHitEl) { rd.scrubHitEl.classList.remove('hit'); rd.scrubHitEl = null; }
  delete rd.els.scrub.dataset.hit;
  // קינדל: אחרי קפיצה בציר — "חזרה ל־X%" למקום שבו הייתם (נשמר המקום שלפני הקפיצה הראשונה)
  if (from && from.cfi && Math.abs(from.f - v) > 0.004 && !rd.back) { rd.back = { cfi: from.cfi, f: from.f, turns: 0, t: Date.now() }; showBackPos(); }
  else if (rd.back) rd.back.t = Date.now();
  if (hit && hit.c) rd.view.goTo(hit.c).catch(() => rd.view.goToFraction(v));   // על סימון — בדיוק לעמוד המסומן
  else rd.view.goToFraction(v);
}
function showBackPos() {
  if (!rd) return;
  const b = rd.back, el = rd.els.backPos;
  el.classList.toggle('hidden', !b);
  if (!b) return;
  el.innerHTML = ICON.undo;
  el.append(h('span', '', T('rdBackTo', { p: Math.round(b.f * 100) + '%' })));
  el.setAttribute('aria-label', T('rdBackTo', { p: Math.round(b.f * 100) + '%' }));
}
function wireScrub() {
  const el = rd.els, s = el.slider;
  s.addEventListener('pointerdown', scrubStart);
  s.addEventListener('input', scrubInput);
  s.addEventListener('change', scrubCommit);
  // שחרור בלי שינוי ערך (נגיעה באגודל בלי גרירה) — בלי "change": רק מסתירים
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) s.addEventListener(ev, () => setTimeout(() => { if (rd && rd.scrubbing && !s.matches(':active')) scrubEnd(); }, 0));
  el.backPos.addEventListener('click', (e) => {
    e.stopPropagation();
    const b = rd && rd.back; if (!b) return;
    rd.back = null; showBackPos();
    rd.view.goTo(b.cfi).catch(() => rd.view.goToFraction(b.f));
  });
}

/* ---- כרטיס ציטוט: תמונה נקייה לשיתוף (קנבס, הפונט שלנו, בלי שום נתון אישי) ---- */
async function quoteCard(text, recIn) {
  const rec = recIn || (rd && rd.rec); if (!rec) return;
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
/* ---- v333: כרטיס תרגום מהיר (בקשת המשתמש — כמו הכרטיס של Google Translate, בעיצוב שלנו) ----
   שתי שכבות: (1) Google — תרגום, חלקי דיבר ותרגומים חלופיים, ישירות מהטלפון (נקודת הקצה של תוסף המילון של Chrome:
   בלי מפתח, בלי מכסה, ~0.3 שנ׳; גיבוי דרך השרתון); (2) Gemini — "בהקשר": מה המילה אומרת במשפט הזה + הסבר מונח.
   השכבה השנייה לא חוסמת את הראשונה; בלי AI (מכסה/רשת) — היא פשוט לא מוצגת. */
const GT_URL = 'https://clients5.google.com/translate_a/single?client=dict-chrome-ex&dt=t&dt=bd&dt=md&dt=ss&dt=rm&dj=1';   // v334: + הגדרות, נרדפות, הגייה (מילון)
const NIQQUD = /[\u0591-\u05C7]/g;
const gtClip = (x, n) => String(x == null ? '' : x).replace(/\s+/g, ' ').trim().slice(0, n);
export function parseGt(j) {               // תשובת Google → תרגום + מילון (חלקי דיבר, הגדרה, דוגמה, נרדפות, הגייה) — טהורה (זהה בשרתון ובאפליקציה)
  if (!j || !Array.isArray(j.sentences)) return null;
  // v334: הניקוד נשאר — בלעדיו כתיב מנוקד נשבר ("מְתַוֵךְ" → "מתוך"); בטקסט רציף Google לא מנקד ממילא
  const tr = j.sentences.map((x) => x.trans || '').join('').trim();
  if (!tr) return null;
  const tl = j.sentences.find((x) => x.src_translit) || {};
  const orig = j.sentences.map((x) => x.orig || '').join('').trim().toLowerCase();
  const defs = {};
  (j.definitions || []).forEach((d) => { const e = (d.entry || [])[0]; if (e && !defs[d.pos]) defs[d.pos] = { gloss: gtClip(e.gloss, 220), ex: gtClip(String(e.example || '').replace(/<\/?b>/g, ''), 160) }; });
  const dict = (j.dict || []).slice(0, 2).map((d) => {
    const ents = d.entry || [];
    const terms = [...new Set((d.terms || ents.map((e) => e.word)).map((t) => gtClip(t, 40)))].filter(Boolean).slice(0, 3);
    const back = [...new Set([].concat(...ents.map((e) => e.reverse_translation || [])).map((t) => gtClip(t, 40)))].filter(Boolean).slice(0, 6);
    const df = defs[d.pos] || {};
    return { pos: gtClip(d.pos, 30), terms, back, def: df.gloss || '', ex: df.ex || '' };
  }).filter((d) => d.terms.length);
  Object.keys(defs).forEach((pos) => { if (dict.length < 2 && !dict.some((d) => d.pos === pos)) dict.push({ pos: gtClip(pos, 30), terms: [], back: [], def: defs[pos].gloss, ex: defs[pos].ex }); });
  const syn = [];
  // נרדפות: בלי משלב מסומן (סלנג/לא רשמי) ובלי צירופים שמכילים את המילה עצמה
  ((j.synsets || [])[0] || { entry: [] }).entry.forEach((e) => { if (!e.label_info) (e.synonym || []).forEach((s) => { if (syn.length < 4 && !syn.includes(s) && s.length < 24 && !(orig && s.toLowerCase().includes(orig))) syn.push(s); }); });
  const base = gtClip(((j.dict || []).find((d) => d.base_form) || {}).base_form, 60);   // v340: צורת הבסיס (followed → follow) — לחיפוש בוויקיפדיה
  return { translation: gtClip(tr, 2000), dict, src: gtClip(j.src, 8), ipa: gtClip(tl.src_translit, 60), syn, base };
}
const uiLang = () => (typeof getLang === 'function' && getLang()) || 'he';
// מילה בעברית בממשק עברי — לאנגלית (תרגום לאותה שפה לא עוזר)
const trTarget = (text) => (uiLang() === 'he' && /[\u0590-\u05FF]/.test(text) ? 'en' : uiLang());
const gtCache = new Map();
function gtQuick(text, tl) {
  const k = tl + '|' + text.toLowerCase();
  if (gtCache.has(k)) return gtCache.get(k);
  const p = (async () => {
    try {
      const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 2500);
      const r = await fetch(GT_URL + '&sl=auto&tl=' + tl + '&hl=' + uiLang() + '&q=' + encodeURIComponent(text.slice(0, 400)), { signal: ctl.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
      clearTimeout(to);
      if (r.ok) { const o = parseGt(await r.json()); if (o) return o; }
    } catch (e) {}
    const base = (typeof IBKR_PROXY_DEFAULT !== 'undefined' && IBKR_PROXY_DEFAULT) || '';   // גיבוי: אותה פנייה דרך השרתון
    const headers = Object.assign({ 'Content-Type': 'application/json' }, typeof ibkrProxyHeaders === 'function' ? ibkrProxyHeaders() : {});
    const j = await (await fetch(base + '/api/translate', { method: 'POST', headers, body: JSON.stringify({ text: text.slice(0, 400), mode: 'quick', to: tl }) })).json();
    if (j && j.ok) return j;
    throw new Error('gt_failed');
  })();
  p.catch(() => gtCache.delete(k));
  gtCache.set(k, p); if (gtCache.size > 300) gtCache.clear();
  return p;
}
function langName(code) {
  try { return new Intl.DisplayNames([uiLang()], { type: 'language' }).of(code === 'iw' ? 'he' : code) || ''; } catch (e) { return ''; }
}
const ICON_SPARK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.5l1.9 5.6 5.6 1.9-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.9zM19 15l.9 2.1 2.1.9-2.1.9L19 21l-.9-2.1-2.1-.9 2.1-.9z"/></svg>';
let trCard = null, trSeq = 0;
function trMark(doc, range) {              // המילה שבתרגום מסומנת בעדינות (CSS Custom Highlight — בלי לגעת ב־DOM של הספר)
  try { const w = doc.defaultView; if (range && w.CSS && w.CSS.highlights && w.Highlight) w.CSS.highlights.set('snb-tap', new w.Highlight(range)); } catch (e) {}
}
function trUnmark(c) { try { c._doc.defaultView.CSS.highlights.delete('snb-tap'); } catch (e) {} }
function hideTr(instant) {
  if (!trCard) return;
  const c = trCard; trCard = null; trSeq++;
  trUnmark(c);
  if (c._sel) clearSelection();
  if (instant || reduceMotion()) { c.remove(); return; }
  c.classList.add('out');
  setTimeout(() => c.remove(), 220);
}
/* v334: שם המודל המדויק לכל תשובת AI (בקשת המשתמש — לדעת תמיד מאיזה מודל הגיעה התשובה) — טהורה */
export function aiModelLabel(m) {
  m = String(m || '').toLowerCase();
  if (!m) return '';
  const mb = m.match(/ministral-(\d+b)/);
  if (mb) return 'Ministral ' + mb[1].toUpperCase();              // v338: Ministral 14B / 8B (המסלול החינמי)
  if (m.includes('nemo')) return 'Mistral Nemo';
  if (m.includes('mistral')) return 'Mistral ' + (m.includes('small') ? 'Small' : m.includes('large') ? 'Large' : 'Medium');
  if (m.includes('gemini')) return 'Gemini ' + (m.includes('lite') ? 'Flash‑Lite' : m.includes('pro') ? 'Pro' : 'Flash');
  return m;
}
/* מצב המקטעים בכרטיס (מילון/ויקיפדיה פתוח או מקופל) — נוחות לכל קורא, רק בטלפון */
function trSecState() { try { return JSON.parse(localStorage.getItem('pwa_trsec_v1') || '{}') || {}; } catch (e) { return {}; } }
function trSecSave(k, open) { try { const st = trSecState(); st[k] = open ? 1 : 0; localStorage.setItem('pwa_trsec_v1', JSON.stringify(st)); } catch (e) {} }
const ICON_SAY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
function trSection(key, headNodes, defOpen) {   // מקטע בסגנון Apple: כותרת אפורה מעל קבוצה לבנה; מקופל = 3 שורות שנמוגות + "הצג עוד"
  const sec = h('div', 'tr-sec');
  const hd = h('div', 'tr-sec-h'); hd.append(...headNodes);
  const body = h('div', 'tr-sec-b');
  sec.append(hd, body);
  if (key) {
    const tog = h('button', 'tr-tog'); tog.type = 'button';
    const st = trSecState(); const open = key in st ? !!st[key] : defOpen;
    const paint = (o) => { sec.classList.toggle('fold', !o); tog.textContent = T(o ? 'trLess' : 'trMore'); tog.setAttribute('aria-expanded', String(o)); };
    paint(open);
    tog.addEventListener('click', (e) => { e.stopPropagation(); const o = sec.classList.contains('fold'); paint(o); trSecSave(key, o); if (o && trCard) trCard.classList.add('full'); });
    hd.append(tog);
  }
  return { sec, body };
}
function say(text, src) {                  // השמעה בקול המובנה של המכשיר — חינם, בלי רשת
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = /^(iw|he)/.test(src || '') || /[֐-׿]/.test(text) ? 'he-IL' : 'en-US';
    u.rate = 0.9; speechSynthesis.cancel(); speechSynthesis.speak(u);
  } catch (e) {}
}
function dictRows(o, heSrc) {              // מקטע המילון: לכל חלק דיבר — תרגומים, הגדרה, דוגמה; ובסוף נרדפות
  const box = document.createDocumentFragment(); let n = 0;
  for (const d of o.dict || []) {
    if (!d.terms.length && !d.def) continue;
    const r = h('div', 'dc-pos'); const l = h('div', 'dc-l');
    l.append(h('b', null, d.pos));
    if (d.terms.length) { const t = h('span', 'dc-tr', d.terms.join(' · ')); t.dir = heSrc ? 'ltr' : 'auto'; l.append(t); }
    r.append(l);
    if (d.def) { const x = h('div', 'dc-def', d.def); x.dir = 'ltr'; r.append(x); }
    if (d.ex) { const x = h('div', 'dc-ex', '“' + d.ex + '”'); x.dir = 'ltr'; r.append(x); }
    else if (heSrc && d.back.length) { const x = h('div', 'dc-ex', d.back.slice(0, 4).join(', ')); x.dir = 'rtl'; r.append(x); }
    box.append(r); n++;
  }
  if (o.syn && o.syn.length) {
    const sy = h('div', 'dc-syn'); sy.dir = 'ltr';
    sy.append(h('small', null, T('trSyn')), ...o.syn.map((w) => h('span', null, w)));
    box.append(sy); n++;
  }
  return n ? box : null;
}
/* ---- v334: ויקיפדיה (כמו בקינדל) — ישירות מהטלפון, בלי מפתח. הערך נבחר לפי ההקשר (שם הערך מה־AI),
   ובלי AI — רק התאמה מדויקת של המילה. עברית כשיש ערך בעברית, אחרת אנגלית ---- */
const ICON_G = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.4zM12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22zm-5.6-8a6 6 0 0 1 0-3.9V7.5H3.1a10 10 0 0 0 0 9zM12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.5l3.3 2.6C7.2 7.7 9.4 5.9 12 5.9z"/></svg>';
export function googleUrl(text) {            // חיפוש Google על המילה/הקטע (מילון, תרגום, ערכים) — טהורה
  const q = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  return q ? 'https://www.google.com/search?hl=he&q=' + encodeURIComponent(q) : '';
}
const wikiCache = new Map();
async function wjson(u) {
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 4500);
  try { const r = await fetch(u, { signal: ctl.signal, credentials: 'omit', referrerPolicy: 'no-referrer' }); return r.ok ? await r.json() : null; } catch (e) { return null; } finally { clearTimeout(to); }
}
async function wikiSummary(lang, title, enTitle) {
  const j = await wjson('https://' + lang + '.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(String(title).replace(/ /g, '_')));
  if (!j || j.type === 'disambiguation' || !j.extract) return null;
  return { lang, title: j.title, desc: j.description || '', sub: [enTitle && enTitle !== j.title ? enTitle : '', j.description || ''].filter(Boolean).join(' · '),
    extract: gtClip(j.extract, 1400), thumb: (j.thumbnail || {}).source || '', url: ((j.content_urls || {}).mobile || {}).page || '' };
}
export function wikiQueries(q) {          // מה לחפש: המילה, ובעברית גם בלי תחיליות (ה/ו/ב/ל/מ/ש/כ — "האתוס" → "אתוס") — טהורה
  const out = q ? [q] : [];
  if (/^[\u05D0-\u05EA]/.test(q)) { let w = q; for (let i = 0; i < 2 && w.length > 3 && /^[הובלמשכ]/.test(w); i++) { w = w.slice(1); out.push(w); } }
  return out;
}
export function wikiWord(word) {           // המילה לחיפוש: בלי ניקוד וסימני פיסוק בקצוות; מילה של אות אחת — בלי ויקיפדיה — טהורה
  const w = String(word || '').replace(/[\u0591-\u05C7]/g, '').replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').trim();
  return w.length >= 2 ? w.slice(0, 80) : '';
}
/* v339 (בקשת המשתמש): ויקיפדיה תמיד בשפת המשתמש — ערך שאין לו גרסה בשפה הזו מתורגם (כותרת + תקציר) באותו מנוע של
   Google שמתרגם את המילה; השם המקורי נשאר בשורת המשנה, והקרדיט מציין "תורגם". תקלה — נשאר במקור */
async function gtLong(text, tl) {
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 4000);
  try {
    const r = await fetch(GT_URL + '&sl=auto&tl=' + tl + '&hl=' + tl + '&q=' + encodeURIComponent(String(text).slice(0, 1500)), { signal: ctl.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
    const o = r.ok ? parseGt(await r.json()) : null;
    return o && o.translation ? o.translation : '';
  } catch (e) { return ''; } finally { clearTimeout(to); }
}
async function wikiInLang(w) {
  const tl = uiLang();
  if (!w || w.lang === tl) return w;
  const [title, extract, desc] = await Promise.all([gtLong(w.title, tl), gtLong(w.extract, tl), w.desc ? gtLong(w.desc, tl) : '']);
  if (!extract) return w;
  return Object.assign({}, w, { title: title || w.title, extract, sub: [w.title, desc].filter(Boolean).join(' · '), tr: w.lang });
}
/* v341 (בקשת המשתמש): ויקיפדיה כמו בקינדל — החיפוש הוא על הטקסט שנבחר כמו שהוא (מילה או ביטוי), בוויקיפדיה של שפת
   הספר (מילה בכתב אחר — בשפה של הכתב), והתוצאה הראשונה של מנוע החיפוש של ויקיפדיה (שמטפל בהפניות ובנטיות).
   אין ערך — הכרטיס אומר את זה (כמו בקינדל), לא נעלם. התוספת שלנו: הערך בשפת המשתמש — הערך המקביל, ואם אין — תרגום אוטומטי */
export function wikiLangFor(q, bookLang) {  // באיזו ויקיפדיה לחפש — טהורה
  const l = String(bookLang || '').toLowerCase().replace(/^iw/, 'he').slice(0, 2);
  if (/[\u0590-\u05FF]/.test(q)) return 'he';
  if (/[\u0600-\u06FF]/.test(q)) return /^(ar|fa|ur)$/.test(l) ? l : 'ar';
  if (/[a-z]/i.test(q)) return /^[a-z]{2}$/.test(l) && l !== 'he' && l !== 'ar' && l !== 'fa' ? l : 'en';
  return /^[a-z]{2}$/.test(l) ? l : 'en';
}
function bookLang() {
  try { return String([].concat((rd && rd.book && rd.book.metadata && rd.book.metadata.language) || [])[0] || ''); } catch (e) { return ''; }
}
async function wikiOtherLang(src, w, tl) {   // הערך המקביל בשפת המשתמש (קישור בין־לשוני)
  const ll = await wjson('https://' + src + '.wikipedia.org/w/api.php?action=query&prop=langlinks&lllang=' + tl + '&redirects=1&format=json&formatversion=2&origin=*&titles=' + encodeURIComponent(w.title));
  const pg = ll && ll.query && ll.query.pages && ll.query.pages[0];
  const t = pg && pg.langlinks && pg.langlinks[0] && pg.langlinks[0].title;
  if (!t) return null;
  const r = await wikiSummary(tl, t);
  return r ? Object.assign(r, { sub: [w.title, r.desc].filter(Boolean).join(' · ') }) : null;
}
function wikiKindle(text) {
  const q = wikiWord(text);
  if (!q) return Promise.resolve(null);
  const lang = wikiLangFor(q, bookLang()), tl = uiLang();
  const k = 'k|' + lang + '|' + q + '|' + tl;
  if (wikiCache.has(k)) return wikiCache.get(k);
  const out = (async () => {
    let w = null;
    for (const s of wikiQueries(q)) {        // בעברית גם בלי תחיליות — מנוע החיפוש העברי לא מסיר אותן
      const j = await wjson('https://' + lang + '.wikipedia.org/w/api.php?action=query&list=search&srlimit=3&srprop=&format=json&formatversion=2&origin=*&srsearch=' + encodeURIComponent(s));
      for (const pg of (j && j.query && j.query.search) || []) { w = await wikiSummary(lang, pg.title); if (w) break; }
      if (w) break;
    }
    if (!w) return { none: true };
    if (w.lang === tl) return w;
    return (await wikiOtherLang(lang, w, tl)) || wikiInLang(w);
  })();
  out.catch(() => wikiCache.delete(k));
  wikiCache.set(k, out); if (wikiCache.size > 200) wikiCache.clear();
  return out;
}
function wikiSection(c, w, seq) {
  if (!w || seq !== trSeq || !c.isConnected) return;
  const { sec, body } = trSection('wiki', [h('span', null, T('trWiki'))], false);
  sec.classList.add('wk');
  if (w.none) { body.append(h('div', 'wk-none', T('trWikiNone'))); c.append(sec); return; }
  const top = h('div', 'wk-title'); const tt = h('div'); tt.dir = 'auto';
  tt.append(h('b', null, w.title)); if (w.sub) tt.append(h('small', null, w.sub));
  top.append(tt);
  if (w.thumb) { const im = h('img', 'wk-img'); im.alt = ''; im.referrerPolicy = 'no-referrer'; im.loading = 'lazy'; im.src = w.thumb; im.addEventListener('error', () => im.remove()); top.append(im); }
  const tx = h('div', 'wk-tx', w.extract); tx.dir = 'auto';
  const ft = h('div', 'wk-foot'); ft.append(h('span', null, T('trWiki') + ' · CC BY-SA' + (w.tr ? ' · ' + T('trWikiTr') : '')));
  if (w.url) { const a = h('button', 'wk-more', T('trWikiMore')); a.type = 'button'; a.addEventListener('click', (e) => { e.stopPropagation(); window.open(w.url, '_blank', 'noopener'); }); ft.append(a); }
  body.append(top, tx, ft);
  c.append(sec);
}
function trShow(text, block, doc, range, sel) {
  if (!rd) return;
  text = String(text || '').replace(/\s+/g, ' ').trim();
  if (!text) return;
  hideSel();
  let c = trCard;
  if (c) { trUnmark(c); c.textContent = ''; c.scrollTop = 0; }   // כרטיס פתוח — מתחלף במקום, בלי אנימציה נוספת
  else {
    c = h('div', 'tr-card'); c.setAttribute('role', 'dialog'); c.setAttribute('aria-label', T('rdTranslate'));
    rd.els.box.append(c); trCard = c; wireTrDrag(c);
  }
  c._at = Date.now();
  c._doc = doc;
  c._sel = sel || null;
  if (doc && range) {
    if (!sel) trMark(doc, range);           // במצב סימון — הבחירה עצמה מסמנת
    try {                                    // הצד שמול המילה — המילה והשורות סביבה נשארות גלויות
      const fr = doc.defaultView.frameElement.getBoundingClientRect(), q = range.getBoundingClientRect();
      const dock = trDock(fr.top + (q.top + q.bottom) / 2, window.innerHeight);
      if (c.classList.contains('top') !== (dock === 'top')) { c.classList.toggle('top', dock === 'top'); c.style.animation = 'none'; void c.offsetWidth; c.style.animation = ''; }
    } catch (e) {}
  }
  c.classList.remove('full');
  const seq = ++trSeq;
  const grab = h('div', 'tr-grab');
  const head = h('div', 'tr-head');
  const lang = h('span', 'tr-lang'); const word = h('span', 'tr-word', text); word.dir = 'auto';
  const ipa = h('span', 'tr-ipa'); ipa.dir = 'ltr';
  const cp = h('button', 'tr-copy'); cp.type = 'button'; cp.innerHTML = ICON.copy; cp.setAttribute('aria-label', T('rdCopy'));
  if (typeof speechSynthesis !== 'undefined' && text.length < 80) {
    const sp = h('button', 'tr-say'); sp.type = 'button'; sp.innerHTML = ICON_SAY; sp.setAttribute('aria-label', T('trSay'));
    sp.addEventListener('click', (e) => { e.stopPropagation(); say(text, c._src); });
    head.append(sp);
  }
  const hw = h('div', 'tr-hw' + (text.includes(' ') ? ' phrase' : '')); const subl = h('div', 'tr-hsub'); subl.append(lang, ipa); hw.append(word, subl);
  // v335 (בקשת המשתמש): לחצן Google קטן — ההרחבה של Google (מה ש־Touch to Search של Chrome הציג) בלי הסרגל ובלי הבאג
  const gg = h('button', 'tr-gg'); gg.type = 'button'; gg.innerHTML = ICON_G; gg.setAttribute('aria-label', T('trGoogle'));
  gg.addEventListener('click', (e) => { e.stopPropagation(); googleUrl(text) && window.open(googleUrl(text), '_blank', 'noopener'); });
  const { bar, acts } = selBar(c, sel, text); acts.append(...head.childNodes, cp, gg);
  head.append(hw);
  const main = h('div', 'tr-main'); main.dir = 'auto'; main.append(h('div', 'tr-sk'));
  const dictHost = h('div', 'tr-dicthost');
  // התרגום בראש קבוצת המילון (קופסה אחת); המילון מקופל כברירת מחדל — התרגום והמשמעות הראשונה, "הצג עוד" לשאר
  const { sec: dsec, body: dbody } = trSection('dict', [h('span', null, T('trDict'))], false);
  dsec.classList.add('tr-dsec', 'nodict'); dbody.append(main); dictHost.append(dsec);
  c.append(grab, bar, head, dictHost);
  let gtText = '';
  cp.addEventListener('click', async (e) => { e.stopPropagation(); try { await navigator.clipboard.writeText(sel ? sel.text : text); flashSafe(T('rdCopied')); } catch (er) {} });
  const tl = trTarget(text);
  wikiKindle(text).then((w) => wikiSection(c, w, seq)).catch(() => {});
  gtQuick(text, tl).then((o) => {
    if (seq !== trSeq) return;
    gtText = o.translation; c._src = o.src;
    main.textContent = o.translation; main.classList.add('in');
    if (o.src && o.src !== tl) lang.textContent = langName(o.src);
    const heSrc = /^(iw|he)/.test(o.src || '');
    if (heSrc) {                            // מילה בעברית: הצורה המנוקדת + תעתיק
      const plain = text.replace(/[֑-ׇ]/g, '');
      const voc = [].concat(...(o.dict || []).map((d) => d.back)).find((b) => b.replace(/[֑-ׇ]/g, '') === plain);
      if (voc) word.textContent = voc;
      if (o.ipa) ipa.textContent = o.ipa;
    } else if (o.ipa) ipa.textContent = '/' + o.ipa + '/';
    const rows = dictRows(o, heSrc);
    if (rows) { dbody.append(rows); dsec.classList.remove('nodict'); }
  }).catch(() => {
    if (seq !== trSeq) return;
    main.textContent = T('trFail'); main.classList.add('in', 'err');
  });
}
/* v334: כמו גיליון של Apple עם שני גבהים — נפתח בגובה בינוני (לא מסתיר את הדף), גרירה לכיוון מרכז המסך = מלא,
   גרירה לכיוון הקצה = קטן ואז סגירה. כרטיס עליון (מילה בחצי התחתון) — הכיוונים הפוכים */
export function trDock(wordY, viewH) { return wordY > viewH * 0.5 ? 'top' : 'bottom'; }   // הצד שמול המילה — טהורה
function wireTrDrag(c) {
  let y0 = null, dy = 0;
  c.addEventListener('pointerdown', (e) => { if (c.scrollTop > 0 && !c.classList.contains('top')) return; y0 = e.clientY; dy = 0; c.style.transition = 'none'; });
  c.addEventListener('pointermove', (e) => {
    if (y0 == null) return;
    const out = c.classList.contains('top') ? y0 - e.clientY : e.clientY - y0;   // תזוזה לכיוון הקצה (= סגירה)
    dy = out;
    const t = Math.max(0, out);
    c.style.transform = t ? 'translateY(' + (c.classList.contains('top') ? -t : t) + 'px)' : '';
  });
  const up = () => {
    if (y0 == null) return; y0 = null; c.style.transition = ''; c.style.transform = '';
    if (dy < -40) c.classList.add('full');                     // לכיוון המרכז — גובה מלא
    else if (dy > 70) { if (c.classList.contains('full')) c.classList.remove('full'); else hideTr(); }
  };
  c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
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
      list.forEach((a) => box.append(annRow(a, () => go(a.c), () => closeSheetThen(sh.parentNode, () => annActions(rd.rec, a, { open: () => rd && rd.view.goTo(a.c).catch(() => {}) })))));
      return box;
    };
    panes.hl = annList('hl', 'noHl'); panes.bm = annList('bm', 'noBm');
    sh.append(tabs, panes.toc, panes.hl, panes.bm);
  });
}
function annRow(a, onOpen, onMore) {
  const r = h('div', 'ann-row'); r.tabIndex = 0; r.setAttribute('role', 'button');
  if (!a.b) { r.style.setProperty('--hl', HL_COLORS[a.k] || HL_COLORS.y); r.dataset.k = a.k || 'y'; }
  else {                                   // v330: סימנייה בעיצוב הסרט של הקורא (ירוק סאטן עם חריץ), יורדת מהקצה העליון של הכרטיס
    r.classList.add('bm');
    const rb = h('span', 'ann-ribbon'); rb.innerHTML = ribbonMiniSVG(); r.append(rb);
  }
  const q = h('div', 'ann-x'); q.dir = 'auto';
  if (a.b) q.textContent = a.x || '—';
  else q.append(h('span', 'ann-mark', a.x || '—'));   // v330: הקטע מסומן במרקר בצבע שלו — כמו בספר, ברור איזה סימון באיזה צבע
  r.append(q);
  if (String(a.n || '').trim()) { const n = h('div', 'ann-n'); const ic = h('span', 'ann-nic'); ic.innerHTML = ICON.notes; const t = h('span', null, a.n); t.dir = 'auto'; n.append(ic, t); r.append(n); }
  const m = h('div', 'ann-m');
  if (a.b) { const tag = h('span', 'ann-bmtag'); const ic = h('span', 'ann-bmic'); ic.innerHTML = ICON.bookmark; tag.append(ic, h('span', null, T('annBmLabel'))); m.append(tag); }
  m.append(document.createTextNode([a.ch, Math.round((a.f || 0) * 100) + '%'].filter(Boolean).join(' · ')));
  r.append(m);
  // v328: לחיצה ארוכה על הטקסט פתחה את סימון הטקסט של המערכת (העתק / Google Translate) במקום תפריט העריכה שלנו
  r.addEventListener('contextmenu', (e) => e.preventDefault());
  r.addEventListener('click', onOpen);
  r.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } });
  if (onMore) {
    r.classList.add('has-more');
    const m = h('button', 'ann-more'); m.type = 'button'; m.innerHTML = ICON.more; m.setAttribute('aria-label', T('annMore'));
    m.addEventListener('click', (e) => { e.stopPropagation(); onMore(); });
    r.append(m);
    wireHold(r, onMore);
  }
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
    [['auto', 'rdAuto'], ['white', 'rdWhite'], ['sepia', 'rdSepia'], ['green', 'rdGreen'], ['black', 'rdBlack']].forEach(([v, k]) => {
      const b = h('button', S.theme === v ? 'on' : ''); b.type = 'button';
      if (v === 'auto') b.classList.add('auto');   // חצי לבן / חצי שחור — "כמו האפליקציה"
      else { const th = THEMES[v]; b.style.background = th.page; b.style.color = th.ink; }
      b.append(h('span', 'big', 'א'), h('span', 'sm', T(k)));
      b.addEventListener('click', () => { S.theme = v; S.themeSet = v === 'auto' ? 0 : 1; themes.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); redo(); });
      themes.append(b);
    });
    pt.append(themes);
    sh.append(tabs, pf, pl, pt);
  });
}

/* ---------------- כניסה / יציאה + "חזור" של המכשיר ---------------- */
/* בזמן קריאה: "חזור" אחד (גם החלקה מקצה המסך בטעות) לא מוציא מהספר — רק שני "חזור" תוך 2 שניות
   (v303, בקשת המשתמש). גיליון פתוח (תוכן/Aa/תרגום) — "חזור" סוגר אותו. כפתור ✕ יוצא מיד. */
function onPop() {
  if (sheetSkip > 0) { sheetSkip--; const v = root && root.querySelector('.lib-veil.out'); if (v && v._settled) v._settled(); return; }   // v322: סגירה תוכנתית של גיליון — ה־back שלנו
  const ds = document.documentElement.dataset;
  if (ds.modalPop || ds.navSkip) return; // v322: חלון של האפליקציה נסגר ב"חזור" / ה־back שלה (סגירת כפתורי לחיצה ארוכה) — לא ניווט של הספרייה
  const st = history.state || {};
  const lvl = st.lib || 0;
  const veils = root ? Array.from(root.querySelectorAll('.lib-veil:not(.out)')) : [];
  if (veils.length > (st.sheet || 0)) {   // v322: "חזור" סוגר את הגיליון העליון (יש לו רשומה משלו); v323: גיליון בלי רשומה — נסגר וממשיכים בניווט
    const v = veils[veils.length - 1]; const own = !!v._pushed; (v._close || (() => v.remove()))();
    if (own) return;
  }
  if (lvl === 2 && st.guard && rd && !rd.closing) {   // "חזור" ראשון בקורא: נחת על השומר
    if (selPop) hideSel();
    else if (trCard) hideTr();               // v333: "חזור" סוגר את כרטיס התרגום
    else if (typeof flash === 'function') flash(T('rdBackTwice'));
    return;
  }
  if (lvl >= 1 && lvl < 2) ui.view = (history.state && history.state.lv) || null;
  if (lvl < 2 && rd) closeReader();
  else if (lvl === 1 && root) navigateTo('pop', savedLibScroll());
  if (lvl < 1 && root) closeLibrary();
}
/* v322: יציאה מהספרייה — השכבה יוצאת בתנועה (לא נעלמת בבת אחת) */
/* v322: רענון בזמן שהספרייה פתוחה — index.html מוריד "וילון" בצבע הרקע לפני הציור הראשון (html.lib-restoring), כדי שהמשתמש
   לא יראה את הסקירה ואז את הספרייה ואז את הספר; יורד כשהדף/העמוד הראשון מוכן (ולכל היותר אחרי 6 שניות — app.js) */
function curtainDown() {
  const e = document.documentElement;
  if (!e.classList.contains('lib-restoring')) return;
  e.classList.remove('lib-restoring');
  setTimeout(() => { e.classList.remove('lib-curtain'); e.style.removeProperty('--curtain'); }, 400);
}
function closeLibrary() {
  const r = root; root = null;
  hideSel(); hideTr(true);
  document.documentElement.classList.remove('lib-open');
  if (reduceMotion()) { r.remove(); return; }
  r.classList.add('leaving');
  setTimeout(() => r.remove(), 260);
}

/* v315: מיקום הגלילה בספרייה לכל דף — לשחזור אחרי רענון (sessionStorage: רק בלשונית הזו) */
const SCROLL_KEY = 'pwa_libscroll_v1';
const viewKey = () => JSON.stringify(ui.view || null);
function savedLibScroll() {
  try { return +(JSON.parse(sessionStorage.getItem(SCROLL_KEY) || '{}')[viewKey()] || 0); } catch (e) { return 0; }
}
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
  if (!restore) afterBack(() => history.pushState(Object.assign({}, history.state || {}, { lib: 1 }), ''));   // ברענון — הרשומות כבר בהיסטוריה
  if (!window._libPop) { window._libPop = true; window.addEventListener('popstate', onPop); }
  ui.view = restore ? (restore.lv || null) : null;
  if (!restore) { ui.author = SHELF; ui.q = ''; }   // v321: כל כניסה לספרייה — מדף ספרים
  let scT = 0;
  root.addEventListener('scroll', () => { clearTimeout(scT); scT = setTimeout(saveLibScroll, 150); }, { passive: true });
  try { await scopeLibrary(); } catch (e) {}   // v313: לפני ציור/סנכרון — רק הנתונים של החשבון הנוכחי
  const first = syncDrive();
  await renderHome();
  if (restore) {
    root.classList.add('restored');        // v322: בלי אנימציית כניסה אחרי רענון
    if (restore.lib >= 2 && restore.book) openReader(restore.book, { restored: true }).catch(() => {}).then(() => { if (!rd) curtainDown(); });
    else { restoreLibScroll(); curtainDown(); }
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

export const _test = { curl: () => rd && rd.curl, curlPlain: () => ({ end: curlPlainN, wait: curlPlainW }), state: () => ({ sheetSkip, rd: !!rd, root: !!root, view: ui.view, vt: VT.inside, veils: root ? root.querySelectorAll('.lib-veil:not(.out)').length : 0 }), indexBook, bookExtras, HL_COLORS, normTerm, bookCSS: () => bookCSS(), setSettings: (o) => { S = Object.assign({}, defaults, o); }, WEIGHTS, THEMES };
