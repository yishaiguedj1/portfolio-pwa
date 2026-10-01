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
const ui = { sort: 'new', author: '', view: null, q: '' };   // view: null = בית, { book: id } = דף מכתב

/* ---------------- IndexedDB: books = פרטים ומיקום (רשימה מהירה), files = הקובץ עצמו ---------------- */
let _db = null;
function idb() {
  if (_db) return Promise.resolve(_db);
  return new Promise((res, rej) => {
    const r = indexedDB.open('snb-library', 1);
    r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('books', { keyPath: 'id' }); d.createObjectStore('files'); };
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
const allBooks = () => tx('books', 'readonly', (st) => reqP(st.getAll()));
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

async function importFiles(files, extra) {
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
      };
      Object.assign(rec, bookExtras(book));
      const old = (await allBooks()).find((b) => b.id === id);
      if (old) Object.assign(rec, { added: old.added, lastRead: old.lastRead, fraction: old.fraction, cfi: old.cfi, done: old.done });
      if (extra) Object.assign(rec, extra);
      await tx('files', 'readwrite', (st) => st.put(file, id));
      await putBook(rec);
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
export function driveSyncPlan(local, items) {      // טהורה (נבדקת): מה להוריד ומה להסיר
  const byDrive = new Map(local.filter((b) => b.driveId).map((b) => [b.driveId, b]));
  const ids = new Set(items.map((i) => i.id));
  return {
    fetch: items.filter((i) => { const o = byDrive.get(i.id); return !o || (i.md5 && o.md5 !== i.md5); }),
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
};
let root = null;

function ensureCss() {
  if (document.getElementById('libCss')) return;
  const l = document.createElement('link'); l.id = 'libCss'; l.rel = 'stylesheet'; l.href = 'library.css';
  document.head.appendChild(l);
}

function cover(b, mini) {
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
  ui.view = v;
  history.pushState(Object.assign({}, history.state || {}, { lib: 1, lv: v }), '');
  renderHome();
  if (root) root.scrollTop = 0;
}

async function renderHome() {
  if (!root) return;
  if (ui.view && ui.view.book) return renderBook(ui.view.book);
  if (ui.view && ui.view.notes) return renderNotes();
  if (ui.view && ui.view.track) return renderTrack(ui.view.track);
  if (ui.view && ui.view.thinkers) return renderThinkers();
  if (ui.view && ui.view.thinker) return renderThinker(ui.view.thinker);
  if (ui.view && ui.view.glossary) return renderGlossary();
  const books = await allBooks();
  const home = root.querySelector('.lib-home');
  home.textContent = '';
  const top = h('div', 'lib-top');
  const back = h('button', 'lib-back'); back.type = 'button'; back.innerHTML = ICON.back; back.append(h('span', null, 'THE SNOWBALL'));
  back.addEventListener('click', () => history.back());
  const add = h('label', 'lib-round'); add.innerHTML = ICON.plus; add.title = T('libImport'); add.setAttribute('aria-label', T('libImport'));
  const inp = h('input'); inp.type = 'file'; inp.multiple = true; inp.accept = '.epub,.azw3,.azw,.mobi,.kf8,.fb2,application/epub+zip';
  inp.addEventListener('change', async () => { const n = await importFiles(Array.from(inp.files || [])); inp.value = ''; if (n) renderHome(); });
  add.append(inp);
  const learn = h('button', 'lib-round'); learn.type = 'button'; learn.innerHTML = ICON.notes; learn.setAttribute('aria-label', T('learnTitle')); learn.title = T('learnTitle');
  learn.addEventListener('click', () => goView({ notes: 1 }));
  const tr = h('div', 'lib-tr'); tr.append(learn, add);
  top.append(back, tr);
  home.append(top, h('h1', 'lib-large', T('libTitle')));
  if (syncNote === 'denied') home.append(h('p', 'lib-note', T('libDenied')));
  else if (syncProgress && syncProgress.total > 1) home.append(h('p', 'lib-note', T('libSyncProg', { n: syncProgress.done, t: syncProgress.total })));

  if (books.length > 3) {
    const sw = h('div', 'lib-search');
    sw.innerHTML = ICON.search;
    const si = h('input'); si.type = 'search'; si.placeholder = T('libSearchPh'); si.dir = 'auto'; si.value = ui.q || ''; si.setAttribute('aria-label', T('libSearchPh'));
    si.enterKeyHint = 'search';
    si.addEventListener('input', () => { ui.q = si.value; applySearch(home); });
    si.addEventListener('keydown', (e) => { if (e.key === 'Enter') si.blur(); });
    sw.append(si);
    home.append(sw);
  }
  if (!books.length) {
    home.append(h('p', 'lib-empty', T(syncing ? 'libSyncing' : syncNote === 'signin' ? 'libSignIn' : 'libEmpty')));
    return;
  }
  const authors = {};
  books.forEach((b) => { const a = b.author || T('libNoAuthor'); authors[a] = (authors[a] || 0) + 1; });
  const chips = h('div', 'lib-chips no-swipe');
  const chip = (label, val) => {
    const c = h('button', 'lib-chip' + (ui.author === val ? ' on' : ''), label); c.type = 'button';
    c.addEventListener('click', () => { ui.author = val; renderHome(); });
    chips.append(c);
  };
  chip(T('libAll'), '');
  Object.keys(authors).sort((a, b) => authors[b] - authors[a]).forEach((a) => chip(a, a));
  if (Object.keys(authors).length > 1) { chips.classList.add('lib-hide-q'); home.append(chips); }

  const shown = sortBooks(books.filter((b) => !ui.author || (b.author || T('libNoAuthor')) === ui.author), ui.sort);
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
  if (!ui.author) {
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
    const it = h('button', 'lib-item'); it.type = 'button';
    it.dataset.q = searchKey(b); it.dataset.i = String(shown.indexOf(b));
    const cap = h('div', 'lib-cap');
    if (b.done) cap.append(h('span', 'lib-done', T('libRead')));
    else if (b.fraction > 0) { const m = h('span', 'lib-mini'); const f = h('i'); f.style.width = Math.round(b.fraction * 100) + '%'; m.append(f); cap.append(m, h('span', null, Math.round(b.fraction * 100) + '%')); }
    else cap.append(h('span', 'lib-badge', T('libNew')));
    it.append(cover(b), cap);
    it.addEventListener('click', () => goView({ book: b.id }));
    let timer = 0;
    // לחיצה ארוכה = הסרה — רק לספר שיובא ידנית (מכתב מהספרייה המשותפת היה חוזר בסנכרון הבא)
    if (b.src !== 'drive') it.addEventListener('pointerdown', () => { timer = setTimeout(() => { timer = -1; askRemove(b); }, 650); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => it.addEventListener(ev, () => { if (timer > 0) clearTimeout(timer); }));
    it.addEventListener('click', (e) => { if (timer === -1) { e.stopImmediatePropagation(); timer = 0; } }, true);
    grid.append(it);
  });
  home.append(grid);
  home.append(h('p', 'lib-empty lib-noq', T('libNoMatch')));
  sortRow.after(h('p', 'lib-near', T('libNear')));
  applySearch(home);
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
function ring(frac) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 36 36'); svg.setAttribute('class', 'ac-ring');
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
}

function askRemove(b) {
  const go = async () => {
    await tx('books', 'readwrite', (st) => st.delete(b.id));
    await tx('files', 'readwrite', (st) => st.delete(b.id));
    renderHome();
  };
  if (typeof askConfirm === 'function') askConfirm(T('libRemoveQ', { t: b.title }), go, { danger: true, ok: T('libRemove') });
}

function sheet(title, build) {
  const veil = h('div', 'lib-veil');
  const sh = h('div', 'lib-sheet');
  sh.append(h('div', 'lib-grab'));
  if (title) sh.append(h('h3', 'lib-sh-t', title));
  build(sh, () => veil.remove());
  veil.append(sh);
  veil.addEventListener('click', (e) => { if (e.target === veil) veil.remove(); });
  root.append(veil);
  return veil;
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
  history.pushState(Object.assign({}, history.state || {}, { lib: 2 }), '');
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
      if (veil) veil.remove();
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

export async function openLibrary() {
  ensureCss();
  if (root) return;
  root = h('div', 'lib-root no-swipe');
  root.append(h('div', 'lib-home'));
  document.body.append(root);
  document.documentElement.classList.add('lib-open');
  history.pushState(Object.assign({}, history.state || {}, { lib: 1 }), '');
  if (!window._libPop) { window._libPop = true; window.addEventListener('popstate', onPop); }
  ui.view = null;
  const first = syncDrive();
  await renderHome();
  await first;
  await pullCloud();
  renderHome();
}

export const _test = { bookExtras, HL_COLORS, normTerm, bookCSS: () => bookCSS(), setSettings: (o) => { S = Object.assign({}, defaults, o); }, WEIGHTS, THEMES };
