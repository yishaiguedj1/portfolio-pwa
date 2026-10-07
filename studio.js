/* סטודיו התרגום (שלב 1 מתוך התוכנית): שלד — רשימת פרויקטים, פרויקט חדש (טיוטה), הגדרות ואשף החיבור.
   נטען רק בלחיצה על "תרגום סרטונים" בתפריט (import דינמי מ־app.js, כמו library.js) — האפליקציה לא גדלה.
   התרגום עצמו ירוץ בענן של Claude של המשתמש (Routine) — מהשלבים הבאים. בשלב הזה אין שום פנייה לרשת.
   אחסון: טיוטות והגדרות ב־localStorage של החשבון (pwa_studio_v1, ב־ACCOUNT_KEYS) — רק פרטים קטנים, אף פעם לא הקובץ.
   "חזור" של המכשיר: רשומה לכל דף — { studio: עומק, sv: דף, sp: פרמטר } (שאר השדות, כולל snb של האפליקציה, נשמרים);
   רענון בזמן שהסטודיו פתוח חוזר לאותו דף (app.js קורא את history.state באתחול → openStudio({ restore })).
   מחרוזות: t() של app.js (STRINGS.he/en, מפתחות studio*) — כל מפתח כתוב כאן מילולית, ו־tests/studio-v354 מאמת שהוא קיים בשתי השפות. */

const T = (k, v) => (typeof t === 'function' ? t(k, v) : k);
export const LS_STUDIO = 'pwa_studio_v1';

/* מצבי התרגום — המספרים מהמבחן מול המתרגם האנושי של TED (נספח ה׳ בתוכנית). q = איכות, u = שימוש במנוי (מתוך 5),
   min = הערכת זמן לשעת ראיון בדקות. Opus 5.5 · Medium = המומלץ וברירת המחדל */
export const MODES = [
  { id: 'opus-medium', fam: 'opus', effort: 'Medium', q: 4, u: 3, min: 105, rec: true },
  { id: 'opus-high', fam: 'opus', effort: 'High', q: 4, u: 4, min: 125 },
  { id: 'opus-max', fam: 'opus', effort: 'Max', q: 5, u: 5, min: 160 },
  { id: 'sonnet-medium', fam: 'sonnet', effort: 'Medium', q: 2, u: 1, min: 85 },
  { id: 'sonnet-high', fam: 'sonnet', effort: 'High', q: 3, u: 2, min: 95 },
];
export const DEFAULT_MODE = 'opus-medium';
/* שפות: התמלול (Parakeet v2/v3, ivrit.ai, Omnilingual) מכסה גם שפות שלא ברשימה — זו רשימת הבחירה המהירה */
export const SOURCE_LANGS = ['en', 'he', 'ar', 'ru', 'es', 'fr', 'de', 'it', 'pt', 'uk', 'pl', 'nl', 'tr', 'fa', 'hi', 'zh', 'ja', 'ko'];
export const TARGET_LANGS = ['he', 'en', 'ar', 'ru', 'es', 'fr', 'de', 'it', 'pt', 'uk', 'pl', 'nl', 'tr', 'fa', 'hi', 'zh', 'ja', 'ko', 'am'];
const QUICK_LANGS = ['he', 'en', 'ar', 'ru', 'es', 'fr'];
export const STYLES = ['bold', 'classic', 'karaoke'];
export const OUTS = ['same', 'compact', 'mkv'];
export const CONNS = ['sub', 'copy', 'api'];
const TERMS_MAX = 1000;
const COMPACT_RATIO = 0.53;   // "דחוס" ≈ חצי מהמקור (נמדד על הראיון של אקמן)

/* ---------------- טהורות (נבדקות ב־node) ---------------- */
export function defaultSettings() {
  return { mode: DEFAULT_MODE, to: ['he'], out: { same: true, compact: false, mkv: false }, style: 'bold', conn: 'sub' };
}
function normOut(o) {
  const d = { same: true, compact: false, mkv: false };
  if (o && typeof o === 'object') for (const k of OUTS) if (typeof o[k] === 'boolean') d[k] = o[k];
  return d;
}
function normTo(a) {
  const to = Array.isArray(a) ? a.filter((c, i) => TARGET_LANGS.includes(c) && a.indexOf(c) === i) : [];
  return to.length ? to : ['he'];
}
export function normSettings(o) {
  const s = defaultSettings();
  if (!o || typeof o !== 'object') return s;
  if (MODES.some((m) => m.id === o.mode)) s.mode = o.mode;
  s.to = normTo(o.to);
  s.out = normOut(o.out);
  if (STYLES.includes(o.style)) s.style = o.style;
  if (CONNS.includes(o.conn)) s.conn = o.conn;
  return s;
}
export function normDraft(d) {
  if (!d || typeof d !== 'object' || typeof d.id !== 'string' || !/^[a-z0-9]{4,40}$/i.test(d.id)) return null;
  const s = normSettings(d);
  return {
    id: d.id,
    name: String(d.name || '').slice(0, 200),
    size: Math.max(0, Math.floor(Number(d.size) || 0)),
    type: String(d.type || '').slice(0, 60),
    created: Math.max(0, Number(d.created) || 0),
    from: d.from === 'auto' || SOURCE_LANGS.includes(d.from) ? d.from : 'auto',
    to: s.to, mode: s.mode, out: s.out, style: s.style,
    terms: String(d.terms || '').slice(0, TERMS_MAX),
  };
}
export function normStore(o) {
  const src = o && typeof o === 'object' ? o : {};
  const seen = new Set();
  const drafts = (Array.isArray(src.drafts) ? src.drafts : []).map(normDraft)
    .filter((d) => d && !seen.has(d.id) && seen.add(d.id)).slice(0, 200);
  return { settings: normSettings(src.settings), drafts };
}
/* טיוטה מהטופס: רק פרטי הקובץ (שם, גודל, סוג) — הקובץ עצמו לא נשמר */
export function newDraft(form, created, id) {
  const f = form.file || {};
  return normDraft({
    id, created, name: f.name, size: f.size, type: f.type,
    from: form.from, to: form.to, mode: form.mode, out: form.out, style: form.style, terms: form.terms,
  });
}
/* 3.2GB · 312MB · 84KB (יחידות של 1024, בלי רווח — כמו בשאר האפליקציה) */
export function fmtSize(n) {
  n = Math.max(0, Number(n) || 0);
  const G = 1073741824, M = 1048576;
  if (n >= G) return (n / G).toFixed(n >= 10 * G ? 0 : 1) + 'GB';
  if (n >= M) return Math.round(n / M) + 'MB';
  return Math.max(1, Math.round(n / 1024)) + 'KB';
}
/* 105 → "1:45" */
export function fmtHM(min) {
  const m = Math.max(0, Math.round(Number(min) || 0));
  return Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0');
}
/* מה מקבלים בפועל: הבחירות + SRT תמיד */
export function outList(out) { return OUTS.filter((k) => out && out[k]).concat('srt'); }
export function modeById(id) { return MODES.find((m) => m.id === id) || MODES[0]; }
export function modeName(m) { return (m.fam === 'opus' ? 'Opus 5.5' : 'Sonnet 5.5') + ' · ' + m.effort; }
/* שם תצוגה לפרויקט מהקובץ: בלי סיומת, קווים תחתונים → רווחים ("Ackman_TKP_interview.mp4" → "Ackman TKP interview") */
export function fileTitle(name) {
  const t = String(name || '').replace(/\.[A-Za-z0-9]{1,5}$/, '').replace(/_+/g, ' ').replace(/\s+/g, ' ').trim();
  return t || String(name || '');
}
export function fileExt(name) { const m = /\.([A-Za-z0-9]{1,5})$/.exec(String(name || '')); return m ? m[1].toUpperCase() : ''; }
export function langName(code, ui) {
  try { return new Intl.DisplayNames([ui || 'he'], { type: 'language' }).of(code) || code; } catch (e) { return code; }
}
const nativeName = (c) => { const n = langName(c, c); return n.charAt(0).toLocaleUpperCase(c) + n.slice(1); };

/* ---------------- מחרוזות לפי מזהה (כל מפתח מילולי) ---------------- */
function modeSub(id) {
  switch (id) {
    case 'opus-medium': return T('studioMsOpusMed');
    case 'opus-high': return T('studioMsOpusHigh');
    case 'opus-max': return T('studioMsOpusMax');
    case 'sonnet-high': return T('studioMsSonHigh');
    default: return T('studioMsSonMed');
  }
}
function effortSub(id) {
  switch (id) {
    case 'opus-medium': return T('studioEfOpusMed');
    case 'opus-high': return T('studioEfOpusHigh');
    case 'opus-max': return T('studioEfOpusMax');
    case 'sonnet-high': return T('studioEfSonHigh');
    default: return T('studioEfSonMed');
  }
}
function modeSum(id) {
  switch (id) {
    case 'opus-medium': return T('studioSumOpusMed');
    case 'opus-high': return T('studioSumOpusHigh');
    case 'opus-max': return T('studioSumOpusMax');
    case 'sonnet-high': return T('studioSumSonHigh');
    default: return T('studioSumSonMed');
  }
}
function outName(k) {
  switch (k) {
    case 'same': return T('studioOutSame');
    case 'compact': return T('studioOutCompact');
    case 'mkv': return T('studioOutMkv');
    default: return T('studioOutSrt');
  }
}
function outSub(k) {
  switch (k) {
    case 'same': return T('studioOutSameS');
    case 'compact': return T('studioOutCompactS');
    case 'mkv': return T('studioOutMkvS');
    default: return T('studioOutSrtS');
  }
}
const outShort = (k) => (k === 'srt' ? 'SRT' : k === 'same' ? T('studioOutSameShort') : outName(k));
const modeShort = (m) => (m.fam === 'opus' ? 'Opus ' : 'Sonnet ') + m.effort;   // לשורות צרות ("Opus Medium")
function styleName(k) {
  switch (k) {
    case 'classic': return T('studioStyleClassic');
    case 'karaoke': return T('studioStyleKaraoke');
    default: return T('studioStyleBold');
  }
}

/* ---------------- מצב ואחסון ---------------- */
let root = null;
let store = normStore(null);
let form = null;                  // טופס פרויקט חדש/עריכה — בזיכרון בין הטופס לדף בחירת השפות; נמחק ביציאה לרשימה
const ui = { view: 'home', param: null };
const scrolls = {};               // מיקום הגלילה של כל דף — "חזור" מחזיר אליו

const uiLang = () => (document.documentElement.lang === 'en' ? 'en' : 'he');
const arrow = () => (document.documentElement.dir === 'ltr' ? ' → ' : ' ← ');
const isIOS = () => typeof navigator !== 'undefined' &&
  (/iPhone|iPad|iPod/.test(navigator.userAgent || '') || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
function flashSafe(m) { if (typeof flash === 'function') flash(m); }
function load() {
  try { return normStore(JSON.parse(localStorage.getItem(LS_STUDIO) || 'null')); } catch (e) { return normStore(null); }
}
function save() {
  try { localStorage.setItem(LS_STUDIO, JSON.stringify(store)); return true; } catch (e) { flashSafe(T('studioSaveErr')); return false; }
}
const newId = () => 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
function freshForm(d) {
  const s = d || store.settings;
  return {
    id: d ? d.id : null,
    file: d && d.name ? { name: d.name, size: d.size, type: d.type } : null,
    from: d ? d.from : 'auto',
    to: s.to.slice(), mode: s.mode, out: Object.assign({}, s.out), style: s.style,
    terms: d ? d.terms : '',
  };
}
/* "עברית, אנגלית" / "עברית ועוד 2" — בלי סימן פלוס שמתהפך ב־RTL */
const langsSum = (to) => { const n = to.map((c) => langName(c, uiLang())); return n.length <= 2 ? n.join(', ') : n[0] + ' ' + T('studioMoreN', { n: n.length - 1 }); };
const langsText = (from, to) => (from === 'auto' ? T('studioAuto') : langName(from, uiLang())) + arrow() + langsSum(to);
const approx = (v) => T('studioApprox', { v });   // "כ־3.2GB" בעברית (טילדה מתהפכת ב־RTL), "~3.2GB" באנגלית
/* שם קובץ: מבודד (LTR בתוך עברית) עם נקודות שבירה אחרי _ . - — בלי לשבור באמצע מילה */
function fileNameEl(name) {
  const b = document.createElement('bdi');
  String(name).split(/(?<=[_.\-])/).forEach((part, i) => { if (i) b.append(document.createElement('wbr')); b.append(part); });
  return b;
}

/* ---------------- "חזור" ---------------- */
/* לקח v350–v352 (הקורא): כל "חזור" שהוא ניווט בהיסטוריה — Chrome באנדרואיד מחליק במשיכה מצד המסך צילום של הרשומה
   הקודמת, שצולם כשעזבו אותה (בטופס: עם הבחירות הישנות) ← "קפיצה". לכן כשיש CloseWatcher (Chrome 120+) לסטודיו רשומה אחת
   בלבד ({studio:1, sv, sp} — מתעדכנת ב־replaceState לרענון), הדפים במחסנית בזיכרון (stack), ו"חזור" = בקשת סגירה של המאזין:
   דף אחורה באנימציה שלנו; בדף הבית — יציאה (back תוכנתי, בלי צילום). בלי תמיכה — רשומה לכל דף, ובלי אנימציה כפולה
   כש־Chrome כבר הנפיש (hasUAVisualTransition). */
const CW_OK = typeof window !== 'undefined' && typeof window.CloseWatcher === 'function';
let stack = [];                   // מצב CloseWatcher: הדפים הפתוחים ({v, p}); האחרון = הנוכחי
let cw = null;
/* app.js חושף snbAfterBack: pushState/replaceState/back מיד אחרי סגירת חלון (history.back שלו בדרך) נוחת על הרשומה הלא נכונה (לקח v322) */
const afterBack = (fn) => (typeof window !== 'undefined' && typeof window.snbAfterBack === 'function') ? window.snbAfterBack(fn) : fn();
function cleanState(extra) { const st = Object.assign({}, history.state || {}, extra); delete st.sheet; delete st.modal; return st; }
const depth = () => (history.state && history.state.studio) || 0;
const viewKey = () => ui.view + ':' + (ui.param == null ? '' : ui.param);
function syncState() {            // CloseWatcher: הרשומה היחידה משקפת את הדף הנוכחי (רענון חוזר אליו)
  const v = ui.view, p = ui.param;
  afterBack(() => { try { if (root && history.state && history.state.studio) history.replaceState(cleanState({ studio: 1, sv: v, sp: p }), ''); } catch (e) {} });
}
/* רענון במצב CloseWatcher: המסלול עד הדף ששמור ברשומה. הטופס לא נשמר — דף השפות של טופס חוזר לטופס חדש */
export function chainFor(v, p) {
  if (v === 'lang' && p !== 'def') { v = 'new'; p = null; }
  const parent = (x, y) => (x === 'home' ? null : (x === 'connect' || x === 'def' || x === 'lang') ? ['settings', null] : x === 'edit' ? ['project', y] : ['home', null]);
  const out = [{ v, p }];
  for (let c = parent(v, p); c; c = parent(c[0], c[1])) out.unshift({ v: c[0], p: c[1] });
  return out;
}

function go(view, param) {
  if (!root) return;
  const p = param == null ? null : param;
  scrolls[viewKey()] = root.scrollTop;
  ui.view = view; ui.param = p;
  if (CW_OK) { stack.push({ v: view, p }); syncState(); }
  else afterBack(() => { try { history.pushState(cleanState({ studio: depth() + 1, sv: view, sp: p }), ''); } catch (e) {} });
  render('push');
}
function back() {
  if (!root) return;
  if (CW_OK && stack.length > 1) {
    scrolls[viewKey()] = root.scrollTop;
    stack.pop();
    const top = stack[stack.length - 1];
    ui.view = top.v; ui.param = top.p;
    syncState();
    render('pop');
    return;
  }
  afterBack(() => { try { history.back(); } catch (e) {} });   // בלי CloseWatcher: דף אחורה; עם — בדף הבית: יציאה
}
function watch() {                // מאזין אחד בכל רגע; חדש אחרי כל בקשה (בלי הפעלת משתמש מותר אחד, ונגיעה מחדשת)
  if (!CW_OK || !root) return;
  try { if (cw) cw.destroy(); } catch (e) {}
  let w;
  try { w = new CloseWatcher(); } catch (e) { cw = null; return; }
  cw = w;
  w.onclose = () => { if (cw === w) { cw = null; closeRequest(); } };
}
function closeRequest() {
  if (!root) return;
  // חלון אישור של האפליקציה (askConfirm) פתוח — "חזור" = הביטול שלו (יש לו רשומה משלו, והוא מוריד אותה)
  const dlg = document.querySelector('.dlg-veil.on');
  if (dlg) { const b = dlg.querySelector('.dlg-cancel') || dlg.querySelector('.dlg-ok'); if (b) b.click(); }
  else back();
  if (root) watch();
}
function onPop(e) {
  if (!root) return;
  const ds = document.documentElement.dataset;
  if (ds.modalPop || ds.navSkip) return;   // חלון של האפליקציה נסגר ב"חזור" / back פנימי שלה — לא ניווט של הסטודיו
  const uaT = !!(e && e.hasUAVisualTransition);   // Chrome כבר הנפיש "חזור" משלו (משיכה מצד המסך) — בלי אנימציה שנייה
  const st = history.state || {};
  if (!st.studio) { closeStudio(uaT); appToOverview(); return; }
  if (CW_OK) return;                       // עם CloseWatcher הדפים לא ברשומות (כאן רק "קדימה" חזרה לרשומה שלנו)
  scrolls[viewKey()] = root.scrollTop;
  ui.view = st.sv || 'home'; ui.param = st.sp == null ? null : st.sp;
  render('pop', uaT);
}
/* כמו בספרייה (v350, בקשת המשתמש): "חזור" מדף הבית של הסטודיו — לסקירה. מטאב ראשי app.js כבר עבר אליה בפתיחה */
function appToOverview() {
  try { if (typeof switchTab === 'function' && typeof currentTabName === 'function' && currentTabName() !== 'overview') switchTab('overview'); } catch (e) {}
}
/* רענון בזמן שהסטודיו פתוח — index.html מוריד וילון בצבע הרקע עד שהדף הראשון מוכן (כמו בספרייה) */
function curtainDown() {
  const e = document.documentElement;
  if (!e.classList.contains('lib-restoring')) return;
  e.classList.remove('lib-restoring');
  setTimeout(() => { e.classList.remove('lib-curtain'); e.style.removeProperty('--curtain'); }, 400);
}

/* ---------------- רכיבים ---------------- */
const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
const ICON = {   // סמלים קבועים בלבד — אף פעם לא תוכן חיצוני
  back: '<polyline points="9 6 15 12 9 18"/>',
  chev: '<polyline points="15 6 9 12 15 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<polyline points="5 12.5 10 17 19 7"/>',
  film: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M10 9.2v5.6l4.6-2.8z" fill="currentColor" stroke="none"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
  globe: '<circle cx="12" cy="12" r="8.6"/><path d="M3.4 12h17.2M12 3.4c2.4 2.6 3.5 5.5 3.5 8.6s-1.1 6-3.5 8.6c-2.4-2.6-3.5-5.5-3.5-8.6s1.1-6 3.5-8.6z"/>',
  spark: '<path d="M11 2.5l1.9 5.4 5.4 1.9-5.4 1.9L11 17.1l-1.9-5.4-5.4-1.9 5.4-1.9z" fill="currentColor" stroke="none"/><path d="M18.5 14.5l.9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9z" fill="currentColor" stroke="none"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l8-8M16.2 6.8l2.3 2.3M13.8 9.2l1.8 1.8"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  out: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v4.5A1.5 1.5 0 0 1 16.5 20h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>',
  copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/>',
};
function ico(k, cls) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true');
  s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '2.2');
  s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
  if (cls) s.setAttribute('class', cls);
  s.innerHTML = ICON[k];
  return s;
}
function tile(icon, color) { const s = h('span', 'st-tile t-' + color); s.append(ico(icon)); return s; }
function btn(cls, label, onClick, k) {
  const b = h('button', cls, label); b.type = 'button';
  if (k) b.dataset.k = k;
  if (onClick) b.addEventListener('click', onClick);
  return b;
}
/* סרגל עליון: חזרה (חץ + שם הדף הקודם) או "ביטול", כותרת קטנה באמצע, ופעולה בצד השני */
function navBar(o) {
  const bar = h('div', 'st-nav');
  let lead;
  if (o.cancel) lead = btn('st-txt', o.cancel, back, 'nav-cancel');
  else { lead = btn('st-back', null, back, 'nav-back'); const l = h('span', 'st-back-l'); l.append(h('bdi', null, o.back)); lead.append(ico('back'), l); }
  const s = h('span', 'st-nav-s'); s.append(lead);
  const e = h('span', 'st-nav-e'); if (o.end) e.append(o.end);
  bar.append(s, h('span', 'st-nav-t', o.title || ''), e);
  return bar;
}
const large = (txt) => h('h1', 'st-large', txt);
function secT(txt) { const d = h('div', 'st-sec-t'); d.append(h('span', null, txt)); return d; }
function list(...rows) { const l = h('div', 'st-list'); l.append(...rows.filter(Boolean)); return l; }
const note = (txt) => h('p', 'st-note', txt);
function rowTxt(label, sub) {
  const l = h('span', 'st-l');
  l.append(h('b', null, label));
  if (sub) l.append(h('small', null, sub));
  return l;
}
/* שורה שמובילה לדף אחר */
function rowNav(o) {
  const r = btn('st-row' + (o.tile ? ' st-ric' : ''), null, o.onClick, o.k);
  if (o.tile) r.append(o.tile);
  r.append(rowTxt(o.label, o.sub));
  if (o.value) r.append(h('span', 'st-v', o.value));
  r.append(ico('chev', 'st-chev'));
  return r;
}
/* שורה עם עיגול סימון (בחירה מרובה) */
function rowCheck(o) {
  const r = o.locked ? h('div', 'st-row') : btn('st-row', null, o.onClick, o.k);
  const c = h('span', 'st-check' + (o.on ? ' on' : '') + (o.locked ? ' lock' : '')); c.append(ico('check'));
  if (!o.locked) { r.setAttribute('role', 'checkbox'); r.setAttribute('aria-checked', o.on ? 'true' : 'false'); }
  r.append(c, rowTxt(o.label, o.sub));
  if (o.value) r.append(h('span', 'st-v', o.value));
  return r;
}
/* שורה עם עיגול בחירה (אחת מכמה) */
function rowRadio(o) {
  const r = btn('st-row', null, o.disabled ? null : o.onClick, o.k);
  r.setAttribute('role', 'radio'); r.setAttribute('aria-checked', o.on ? 'true' : 'false');
  if (o.disabled) { r.disabled = true; r.classList.add('off'); }
  r.append(h('span', 'st-radio' + (o.on ? ' on' : '')), rowTxt(o.label, o.sub));
  if (o.badge) r.append(h('span', 'st-badge gray', o.badge));
  return r;
}
function kvRow(k, v, iso) {
  const r = h('div', 'st-row st-kvrow');
  const val = h('span', 'st-v'); if (iso) val.append(typeof v === 'string' ? h('bdi', null, v) : v); else val.textContent = v;
  r.append(h('span', 'st-k', k), val);
  return r;
}

/* בורר מצב התרגום — כרטיס המצב הנבחר (המומלץ בולט) + שתי קבוצות מאמץ + שורת המבחן */
function modePicker(cur, onPick) {
  const m = modeById(cur);
  const best = h('div', 'st-mode-best' + (m.rec ? '' : ' other'));
  best.append(h('span', 'st-ribbon', m.rec ? T('studioRibbonRec') : T('studioRibbonSel', { name: modeShort(MODES[0]) })));
  const mh = h('div', 'st-mh');
  const mt = h('span', 'st-l'); mt.append(h('b', null, modeName(m)), h('small', null, modeSub(m.id)));
  mh.append(tile('spark', 'green'), mt);
  const bars = (n, cls) => { const b = h('span', 'st-bars' + (cls ? ' ' + cls : '')); for (let i = 0; i < 5; i++) b.append(h('i', i < n ? 'on' : null)); return b; };
  const meter = (lbl, val) => { const d = h('div', 'st-meter'); d.append(h('small', null, lbl), val); return d; };
  const meters = h('div', 'st-meters'); meters.setAttribute('aria-hidden', 'true');
  meters.append(meter(T('studioQuality'), bars(m.q)), meter(T('studioUsage'), bars(m.u, 'amber')),
    meter(T('studioHourEst'), h('b', null, T('studioHrs', { t: fmtHM(m.min) }))));
  best.append(mh, meters);
  const grp = (fam) => {
    const g = h('div', 'st-mode-grp');
    const gh = h('div', 'st-gh');
    const title = fam === 'opus' ? T('studioGrpPerf') : T('studioGrpEco');
    gh.append(h('b', null, title), h('small', null, fam === 'opus' ? T('studioGrpPerfS') : T('studioGrpEcoS')));
    const ef = h('div', 'st-effort'); ef.setAttribute('role', 'radiogroup'); ef.setAttribute('aria-label', title);
    for (const x of MODES.filter((y) => y.fam === fam)) {
      const b = btn(null, null, () => onPick(x.id), 'm:' + x.id);
      b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', x.id === m.id ? 'true' : 'false');
      b.append(h('b', null, x.effort), h('small', x.rec ? 'star' : null, effortSub(x.id)));
      ef.append(b);
    }
    g.append(gh, ef);
    return g;
  };
  const sum = h('p', 'st-modesum');
  const nb = h('b'); nb.append(h('bdi', 'st-nw', modeName(m)));   // מבודד — שם המודל לא "נדבק" לטקסט הלטיני שלפניו
  sum.append(T('studioSumPre') + ' ', nb, ' — ' + modeSum(m.id));
  return [best, grp('opus'), grp('sonnet'), sum];
}
/* מה לקבל — שלוש אפשרויות + SRT קבוע. ההערכה לפי גודל הקובץ (כשיש) */
function outRows(out, size, onToggle) {
  const est = size ? { same: approx(fmtSize(size)), compact: approx(fmtSize(size * COMPACT_RATIO)), mkv: approx(fmtSize(size)) } : {};
  const rows = OUTS.map((k) => rowCheck({ label: outName(k), sub: outSub(k), value: est[k], on: !!out[k], onClick: () => onToggle(k), k: 'o:' + k }));
  rows.push(rowCheck({ label: outName('srt'), sub: outSub('srt'), on: true, locked: true }));
  return list(...rows);
}
/* מראה הכתוביות — שלושה כרטיסים עם דוגמה על "תמונה" כהה */
function stylePicker(cur, onPick) {
  const g = h('div', 'st-styles'); g.setAttribute('role', 'radiogroup'); g.setAttribute('aria-label', T('studioSecStyle'));
  for (const k of STYLES) {
    const b = btn('st-sty' + (k === cur ? ' on' : ''), null, () => onPick(k), 's:' + k);
    b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', k === cur ? 'true' : 'false');
    const s = h('span', 's s-' + k);
    if (k === 'karaoke') s.append(T('studioSampleK1') + ' ', h('em', null, T('studioSampleK2')));
    else s.textContent = T('studioSample');
    b.append(h('span', 'n', styleName(k)), s);
    g.append(b);
  }
  return g;
}
function toggleLang(target, c, persist) {
  if (target.to.includes(c)) {
    if (target.to.length === 1) { flashSafe(T('studioMin1')); return; }
    target.to = target.to.filter((x) => x !== c);
  } else target.to = target.to.concat(c);
  if (persist) save();
  render('none');
}

/* ---------------- דפים ---------------- */
function pageHome(p) {
  const pill = btn('st-cpill', null, () => go('settings'), 'cpill');
  pill.append(h('i'), h('span', null, T('studioConnPill')));
  p.append(navBar({ back: 'THE SNOWBALL', end: pill }), large(T('studioTitle')));
  const nc = btn('st-newcard', null, () => { form = freshForm(null); go('new'); }, 'new');
  const plus = h('span', 'st-plus'); plus.append(ico('plus'));
  nc.append(plus, rowTxt(T('studioNew'), T('studioNewSub')));
  p.append(nc);
  if (!store.drafts.length) {
    const e = h('div', 'st-empty');
    const ic = h('span', 'st-empty-ic'); ic.append(ico('film'));
    e.append(ic, h('b', null, T('studioEmptyT')), h('p', null, T('studioEmptyS')));
    p.append(e);
    return;
  }
  const rows = store.drafts.map((d) => {
    const r = btn('st-proj', null, () => go('project', d.id), 'p:' + d.id);
    const th = h('span', 'st-thumb'); th.append(ico('film'));
    const info = h('span', 'st-pinfo');
    const nm = h('b'); nm.append(h('bdi', null, d.name ? fileTitle(d.name) : T('studioUntitled')));   // שם באנגלית — מבודד, מיושר לצד של הממשק
    const stat = h('span', 'st-pstat');
    stat.append(h('span', 'st-badge gray', T('studioDraft')));
    const meta = [fileExt(d.name), d.size ? fmtSize(d.size) : ''].filter(Boolean).join(' · ');
    if (meta) stat.append(h('span', null, meta));
    const sm = h('small'); sm.append(langsText(d.from, d.to) + ' · ', h('bdi', 'st-nw', modeName(modeById(d.mode))));   // שם המודל שלם — לא נשבר באמצע
    info.append(nm, sm, stat);
    r.append(th, info);
    return r;
  });
  p.append(secT(T('studioSecDrafts')), list(...rows));
}

function pageForm(p, editing) {
  if (!form) {
    const d = editing ? store.drafts.find((x) => x.id === ui.param) : null;
    if (editing && !d) { back(); return; }
    form = freshForm(d);
  }
  const f = form;
  const saveTop = btn('st-txt bold', T('studioSave'), saveForm, 'nav-save');
  saveTop.disabled = !f.file;
  p.append(navBar({ cancel: T('studioCancel'), title: editing ? T('studioEditT') : T('studioNew'), end: saveTop }));

  // הסרטון — מהטלפון; נשמרים רק השם, הגודל והסוג
  const inp = h('input', 'st-file'); inp.type = 'file'; inp.hidden = true;
  inp.accept = 'video/*,.mkv,.mov,.mp4,.m4v,.webm,.avi';
  inp.addEventListener('change', () => {
    const file = inp.files && inp.files[0];
    if (!file) return;
    f.file = { name: file.name, size: file.size, type: file.type || '' };
    render('none');
  });
  let card;
  if (f.file) {
    card = btn('st-filecard', null, () => inp.click(), 'file');
    card.setAttribute('aria-label', T('studioReplace') + ': ' + f.file.name);
    const th = h('span', 'st-thumb'); th.append(ico('film'));
    const txt = h('span', 'st-l');
    const nm = h('b'); nm.append(fileNameEl(f.file.name));
    const sz = h('small'); sz.append(fmtSize(f.file.size) + ' · ', h('span', 'st-linkish', T('studioReplace')));
    txt.append(nm, sz, h('small', 'st-ok', T('studioPhoneOnly')));
    card.append(th, txt);
  } else {
    card = btn('st-newcard pick', null, () => inp.click(), 'file');
    const plus = h('span', 'st-plus'); plus.append(ico('film'));
    card.append(plus, rowTxt(T('studioPick'), T('studioNewSub')));
  }
  p.append(inp, secT(T('studioSecVideo')), card);
  if (isIOS()) p.append(note(T('studioIosTip')));

  // שפות
  const ul = uiLang();
  p.append(secT(T('studioSecLangs')), list(
    rowNav({ tile: tile('mic', 'blue'), label: T('studioFrom'), value: f.from === 'auto' ? T('studioAuto') : langName(f.from, ul), onClick: () => go('lang', 'from'), k: 'from' }),
    rowNav({ tile: tile('globe', 'teal'), label: T('studioTo'), value: langsSum(f.to), onClick: () => go('lang', 'to'), k: 'to' })));
  const chips = h('div', 'st-chips'); chips.setAttribute('role', 'group'); chips.setAttribute('aria-label', T('studioTo'));
  for (const c of QUICK_LANGS.concat(f.to.filter((x) => !QUICK_LANGS.includes(x)))) {
    const on = f.to.includes(c);
    const b = btn('st-chip' + (on ? ' on' : ''), null, () => toggleLang(f, c, false), 'c:' + c);
    if (on) b.append(ico('check', 'st-chk'));
    b.append(h('bdi', null, nativeName(c)));
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    chips.append(b);
  }
  chips.append(btn('st-chip', '+ ' + T('studioMore'), () => go('lang', 'to'), 'c:more'));
  p.append(chips);

  // שמות ומונחים — Claude משתמש בהם בהגהה ובתרגום
  const ta = h('textarea', 'st-ta'); ta.rows = 3; ta.maxLength = TERMS_MAX; ta.value = f.terms || '';
  ta.placeholder = T('studioTermsPh'); ta.dataset.k = 'terms'; ta.setAttribute('aria-label', T('studioSecTerms'));
  ta.addEventListener('input', () => { f.terms = ta.value; });
  p.append(secT(T('studioSecTerms')), ta, note(T('studioTermsNote')));

  // מצב התרגום — המומלץ מסומן ונבחר מראש
  p.append(secT(T('studioSecMode')), ...modePicker(f.mode, (id) => { f.mode = id; render('none'); }));
  // מה לקבל — "זהה למקור" כברירת מחדל, SRT תמיד
  p.append(secT(T('studioSecOut')), outRows(f.out, f.file ? f.file.size : 0, (k) => { f.out[k] = !f.out[k]; render('none'); }));
  p.append(secT(T('studioSecStyle')), stylePicker(f.style, (k) => { f.style = k; render('none'); }));

  // שמירה — בשלב הזה כטיוטה; התרגום ייפתח עם החיבור ל־Claude
  const saveBtn = btn('st-btn wide', T('studioSaveDraft'), saveForm, 'save');
  saveBtn.disabled = !f.file;
  p.append(h('div', 'st-gap'), saveBtn, note(f.file ? T('studioPhase2') : T('studioPickFirst')));
}
function saveForm() {
  const f = form;
  if (!f || !f.file) return;
  if (f.id) {
    const i = store.drafts.findIndex((d) => d.id === f.id);
    if (i < 0) return;
    store.drafts[i] = newDraft(f, store.drafts[i].created || Date.now(), f.id);
  } else store.drafts.unshift(newDraft(f, Date.now(), newId()));
  if (!save()) { store = load(); return; }
  flashSafe(T('studioSaved'));
  form = null;
  back();
}

function pageLang(p) {
  const which = ui.param;
  const def = which === 'def';
  const target = def ? store.settings : form;
  if (!target || (which !== 'from' && which !== 'to' && !def)) { back(); return; }
  const multi = which !== 'from';
  p.append(navBar({ back: def ? T('studioSettings') : (form.id ? T('studioEditT') : T('studioNew')) }),
    large(multi ? T('studioTo') : T('studioFrom')));
  const ul = uiLang();
  const sub = (c) => { const n = nativeName(c); return n !== langName(c, ul) ? n : null; };
  const rows = [];
  if (!multi) {
    rows.push(rowRadio({ label: T('studioAuto'), on: target.from === 'auto', onClick: () => { target.from = 'auto'; back(); }, k: 'l:auto' }));
    for (const c of SOURCE_LANGS) rows.push(rowRadio({ label: langName(c, ul), sub: sub(c), on: target.from === c, onClick: () => { target.from = c; back(); }, k: 'l:' + c }));
  } else {
    for (const c of TARGET_LANGS) rows.push(rowCheck({ label: langName(c, ul), sub: sub(c), on: target.to.includes(c), onClick: () => toggleLang(target, c, def), k: 'l:' + c }));
  }
  p.append(list(...rows));
  if (multi) p.append(note(T('studioToSub')));
}

function pageProject(p) {
  const d = store.drafts.find((x) => x.id === ui.param);
  if (!d) { back(); return; }
  p.append(navBar({ back: T('studioShort') }));
  const t1 = h('h1', 'st-large clamp'); t1.append(h('bdi', null, d.name ? fileTitle(d.name) : T('studioUntitled')));
  const tag = h('div', 'st-ptag'); tag.append(h('span', 'st-badge gray', T('studioPhoneDraft')));
  p.append(t1, tag);
  const fmtDate = (ms) => { try { return new Intl.DateTimeFormat(uiLang(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(ms); } catch (e) { return ''; } };
  p.append(list(
    kvRow(T('studioFile'), (() => { const s2 = h('span'); s2.append(fileNameEl(d.name || '—')); if (d.size) s2.append(' · ' + fmtSize(d.size)); return s2; })(), true),
    kvRow(T('studioSecLangs'), langsText(d.from, d.to)),
    kvRow(T('studioSecMode'), modeName(modeById(d.mode))),
    kvRow(T('studioSecOut'), outList(d.out).map(outShort).join(' + ')),
    kvRow(T('studioSecStyle'), styleName(d.style)),
    d.terms ? kvRow(T('studioTermsK'), d.terms, true) : null,
    kvRow(T('studioCreated'), fmtDate(d.created))));
  const edit = btn('st-btn tint wide', T('studioEdit'), () => { form = freshForm(d); go('edit', d.id); }, 'edit');
  const del = btn('st-btn danger wide', T('studioDelete'), () => {
    const doDel = () => {
      store.drafts = store.drafts.filter((x) => x.id !== d.id);
      if (!save()) { store = load(); return; }
      flashSafe(T('studioDeleted'));
      back();
    };
    if (typeof askConfirm === 'function') askConfirm(T('studioDeleteQ'), doDel, { danger: true, ok: T('studioDeleteOk') });
    else doDel();
  }, 'delete');
  p.append(h('div', 'st-gap'), edit, h('div', 'st-gap sm'), del, note(T('studioPhase2')));
}

function pageSettings(p) {
  const s = store.settings, m = modeById(s.mode);
  p.append(navBar({ back: T('studioShort') }), large(T('studioSettings')));
  // בשלב הזה רק "המנוי שלי" פעיל — העתק־הדבק ומפתח API מגיעים בשלב 7
  p.append(secT(T('studioSecClaude')), list(
    rowRadio({ label: T('studioConnSub'), sub: T('studioConnSubS'), on: true, k: 'cn:sub' }),
    rowRadio({ label: T('studioConnCopy'), sub: T('studioConnCopyS'), on: false, disabled: true, badge: T('studioSoon') }),
    rowRadio({ label: T('studioConnApi'), sub: T('studioConnApiS'), on: false, disabled: true, badge: T('studioSoon') })));
  p.append(secT(T('studioSecConnect')), list(
    rowNav({ tile: tile('key', 'green'), label: T('studioWizard'), sub: T('studioNotConn') + ' · ' + T('studioWizardS'), onClick: () => go('connect'), k: 'wizard' })));
  p.append(secT(T('studioSecDefaults')), list(
    rowNav({ label: T('studioSecMode'), value: modeShort(m), onClick: () => go('def', 'mode'), k: 'def:mode' }),
    rowNav({ label: T('studioTo'), value: langsSum(s.to), onClick: () => go('lang', 'def'), k: 'def:to' }),
    rowNav({ label: T('studioSecOut'), value: outList(s.out).map(outShort).join(' + '), onClick: () => go('def', 'out'), k: 'def:out' }),
    rowNav({ label: T('studioSecStyle'), value: styleName(s.style), onClick: () => go('def', 'style'), k: 'def:style' })));
}

/* ברירת מחדל אחת (מצב / פלטים / מראה) — נשמרת מיד */
function pageDef(p) {
  const s = store.settings, k = ui.param;
  const set = (fn) => { fn(); save(); render('none'); };
  p.append(navBar({ back: T('studioSettings') }));
  if (k === 'mode') p.append(large(T('studioSecMode')), ...modePicker(s.mode, (id) => set(() => { s.mode = id; })));
  else if (k === 'out') p.append(large(T('studioSecOut')), outRows(s.out, 0, (o) => set(() => { s.out[o] = !s.out[o]; })));
  else if (k === 'style') p.append(large(T('studioSecStyle')), stylePicker(s.style, (st) => set(() => { s.style = st; })));
  else { back(); return; }
  p.append(note(T('studioDefNote')));
}

/* אשף החיבור — שלושת השלבים של ההגדרה החד־פעמית. ההעתקה, השמירה בכספת והבדיקה דורשות את השרתון והעובד בענן (שלבים 2–3) */
function pageConnect(p) {
  p.append(navBar({ back: T('studioSettings') }), large(T('studioWizT')), h('p', 'st-lede', T('studioWizLede')));
  const soon = (label, icon) => {
    const b = btn('st-wbtn', null, null); b.disabled = true;
    b.append(ico(icon), h('span', null, label), h('span', 'st-badge gray', T('studioSoon')));
    return b;
  };
  const open = h('a', 'st-wbtn'); open.href = 'https://claude.ai/code'; open.target = '_blank'; open.rel = 'noopener noreferrer';
  open.dataset.k = 'w:open';
  open.append(ico('out'), h('span', null, T('studioOpenCode')));
  const field = (icon, label) => { const d = h('div', 'st-field'); d.setAttribute('aria-disabled', 'true'); d.append(ico(icon), h('span', null, label)); return d; };
  const steps = [
    [T('studioW1T'), T('studioW1D'), [open, soon(T('studioCopySetup'), 'copy')]],
    [T('studioW2T'), T('studioW2D'), [soon(T('studioCopyPrompt'), 'copy')]],
    [T('studioW3T'), T('studioW3D'), [field('link', T('studioFUrl')), field('key', T('studioFKey')), soon(T('studioTestConn'), 'check')]],
  ];
  const ol = h('ol', 'st-wiz');
  for (const [tt, dd, acts] of steps) {
    const li = h('li');
    const body = h('div', 'st-wbody');
    body.append(h('b', null, tt), h('p', null, dd));
    const a = h('div', 'st-wacts'); a.append(...acts); body.append(a);
    li.append(body); ol.append(li);
  }
  p.append(ol, note(T('studioWizNote')));
}

/* ---------------- ציור ---------------- */
let renderSeq = 0;
function render(kind, still) {     // kind: none (ציור מחדש במקום) / push / pop; still = בלי אנימציה (Chrome כבר הנפיש)
  if (!root) return;
  const seq = ++renderSeq;
  const keepY = kind === 'none' ? root.scrollTop : (kind === 'pop' ? (scrolls[viewKey()] || 0) : 0);
  const ae = document.activeElement;
  const fk = ae && root.contains(ae) && ae.dataset ? ae.dataset.k : null;   // הפוקוס חוזר לאותו רכיב אחרי ציור מחדש
  if (ui.view === 'home') form = null;   // יציאה מהטופס בלי שמירה — הטיוטה לא נשמרת
  const p = h('div', 'st-page');
  if (ui.view === 'new') pageForm(p, false);
  else if (ui.view === 'edit') pageForm(p, true);
  else if (ui.view === 'lang') pageLang(p);
  else if (ui.view === 'project') pageProject(p);
  else if (ui.view === 'settings') pageSettings(p);
  else if (ui.view === 'def') pageDef(p);
  else if (ui.view === 'connect') pageConnect(p);
  else pageHome(p);
  if (!root || seq !== renderSeq) return;   // הדף חזר אחורה תוך כדי בנייה (טיוטה שנמחקה וכו') — הציור החדש כבר במקום
  if ((kind === 'push' || kind === 'pop') && !still && !reduceMotion()) p.classList.add(kind === 'push' ? 'in-push' : 'in-pop');
  root.replaceChildren(p);
  root.scrollTop = keepY;
  if (kind === 'none' && fk) {
    const el = Array.from(root.querySelectorAll('[data-k]')).find((x) => x.dataset.k === fk);
    if (el) { try { el.focus({ preventScroll: true }); } catch (e) {} }
  } else if (kind !== 'none' && document.activeElement === document.body) {
    try { root.focus({ preventScroll: true }); } catch (e) {}   // מעבר דף — הפוקוס עובר לשכבה ולא "נופל" לאפליקציה שמתחת
  }
  if (CW_OK && !cw) watch();             // מאזין "חזור" חסר (למשל אחרי רענון) — חוזר
}
const reduceMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------------- כניסה / יציאה ---------------- */
function ensureCss() {
  if (document.getElementById('studioCss')) return;
  const l = document.createElement('link'); l.id = 'studioCss'; l.rel = 'stylesheet'; l.href = 'studio.css';
  document.head.appendChild(l);
}
function closeStudio(instant) {
  const r = root; root = null; form = null; stack = [];
  try { if (cw) cw.destroy(); } catch (e) {}
  cw = null;
  document.documentElement.classList.remove('studio-open');
  if (!r) return;
  if (instant || reduceMotion()) { r.remove(); return; }   // Chrome כבר הנפיש את היציאה — בלי אנימציה שנייה
  r.classList.add('leaving');
  setTimeout(() => r.remove(), 260);
}
export function openStudio(opt) {
  ensureCss();
  if (root) return;
  const restore = opt && opt.restore && opt.restore.studio ? opt.restore : null;   // רענון בזמן שהסטודיו היה פתוח
  store = load();
  root = h('div', 'st-root no-swipe');
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', T('studioTitle'));
  root.tabIndex = -1;
  root.addEventListener('pointerup', () => { if (CW_OK && root && !cw) watch(); }, true);   // נגיעה = הפעלת משתמש → מאזין חדש אם חסר
  if (!CW_OK && !window._stKey) {          // עם CloseWatcher גם Escape הוא בקשת סגירה — בלי מאזין משלנו
    window._stKey = true;
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !root || e.defaultPrevented) return;
      if (document.querySelector('.dlg-veil')) return;   // חלון אישור של האפליקציה פתוח — הוא סוגר את עצמו
      e.preventDefault(); back();
    });
  }
  document.body.append(root);
  document.documentElement.classList.add('studio-open');
  if (!restore) afterBack(() => { try { history.pushState(cleanState({ studio: 1, sv: 'home', sp: null }), ''); } catch (e) {} });
  if (!window._stPop) { window._stPop = true; window.addEventListener('popstate', onPop); }
  if (CW_OK) {
    stack = restore ? chainFor(restore.sv || 'home', restore.sp == null ? null : restore.sp) : [{ v: 'home', p: null }];
    const top = stack[stack.length - 1];
    ui.view = top.v; ui.param = top.p;
    if (restore) syncState();
    watch();                               // בתוך הלחיצה (הפעלת משתמש); ברענון — המאזין ה"חינמי"
  } else {
    ui.view = restore ? (restore.sv || 'home') : 'home';
    ui.param = restore && restore.sp != null ? restore.sp : null;
  }
  if (restore) root.classList.add('restored');
  render('none');
  if (restore) curtainDown();
  try { root.focus({ preventScroll: true }); } catch (e) {}
}

export const _test = {
  state: () => ({ open: !!root, view: ui.view, param: ui.param, drafts: store.drafts.length, form: !!form, cw: CW_OK, watching: !!cw, stack: stack.length }),
  closeRequest: () => closeRequest(),   // QA: כמו "חזור" של אנדרואיד (Playwright לא יכול לשלוח אותו)
};
