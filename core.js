/* נוצר אוטומטית מ־app.js ב־tools/coregen.js — לא לערוך ביד (שינוי = ב־app.js, ואז node tools/coregen.js). */
/* הקוד המשותף ל־Academy ול־Studio (דפים עצמאיים, בלי app.js). לפני הקובץ — strings-<אפליקציה>.js (STRINGS). */
/* כותרת X-App-Key רדומה (v150) — בלי הגדרות IBKR בדפים האלה */
function ibkrCfg() { return {}; }

const LS_LANG = 'pwa_lang_v1';
const LS_THEME = 'pwa_theme_v1'; // 'light' | 'dark' | 'system' — נשמר ברמת המכשיר בלבד, לא בענן

const _IC_PRE = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
const ICON_EDIT = _IC_PRE + '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
const ICON_CLOSE = _IC_PRE + '<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>';
const ICON_COLL = _IC_PRE + '<path d="M4 6h11v14H4z"/><path d="M8 3h12v14"/><line x1="9.5" y1="10" x2="9.5" y2="16"/><line x1="6.5" y1="13" x2="12.5" y2="13"/></svg>';   // v320: הוספה לאסופה (ספרייה)
const ICON_GLOBE = _IC_PRE + '<circle cx="12" cy="12" r="9"/><line x1="3" y1="12" x2="21" y2="12"/><path d="M12 3a13.5 13.5 0 0 1 0 18M12 3a13.5 13.5 0 0 0 0 18"/></svg>';
const ICON_GEAR = _IC_PRE + '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
const ICON_SUN = _IC_PRE + '<circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.9" y1="4.9" x2="6.3" y2="6.3"/><line x1="17.7" y1="17.7" x2="19.1" y2="19.1"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.9" y1="19.1" x2="6.3" y2="17.7"/><line x1="17.7" y1="6.3" x2="19.1" y2="4.9"/></svg>';
const ICON_MOON = _IC_PRE + '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
const ICON_MENU = _IC_PRE + '<line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/></svg>';

function getLang() {
  const m = getLangMode();
  return m === 'system' ? systemLang() : m;
}
/* v289: מצב השפה — 'he' | 'en' | 'system' (לפי שפת המכשיר). ברירת מחדל: עברית (לא 'system' — בלי הפתעה למי שלא בחר) */
function getLangMode() {
  try { const v = localStorage.getItem(LS_LANG); return v === 'en' || v === 'system' ? v : 'he'; }
  catch (e) { return 'he'; }
}
/* שפת המכשיר: עברית אם היא הראשונה ברשימת השפות שלו, אחרת אנגלית (טהורה עם פרמטר — נבדקת) */
function systemLang(langs) {
  let l = langs;
  if (!l) { try { l = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language]; } catch (e) { l = []; } }
  const first = String((l && l[0]) || '').toLowerCase();
  return /^(he|iw)\b/.test(first) ? 'he' : 'en';
}

/* מחזיר מחרוזת מתורגמת; {var} מוחלף בערכים מ־vars. נופל לעברית ואז למפתח. */
function t(key, vars) {
  const lang = (typeof state !== 'undefined' && state.lang) || getLang();
  let s = (STRINGS[lang] && STRINGS[lang][key]) || STRINGS.he[key] || key;
  if (vars) {
    for (const k of Object.keys(vars)) s = s.split('{' + k + '}').join(String(vars[k]));
  }
  return s;
}

function getThemeMode() {
  try { const v = localStorage.getItem(LS_THEME); return v === 'dark' || v === 'light' ? v : 'system'; }
  catch (e) { return 'system'; }
}
function systemDark() {
  try { return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches); }
  catch (e) { return false; }
}
function resolveTheme() {
  const m = getThemeMode();
  return m === 'system' ? (systemDark() ? 'dark' : 'light') : m;
}
/* מחיל data-theme על <html> ומעדכן את צבע שורת הסטטוס. */
function applyTheme() {
  const th = resolveTheme();
  if (typeof cssVarCacheClear === 'function') cssVarCacheClear(); // v193 (בדפים העצמאיים אין — core)
  try {
    if (document.documentElement) document.documentElement.dataset.theme = th;
    const meta = document.querySelector && document.querySelector('#themeColorMeta');
    if (meta) meta.setAttribute('content', th === 'dark' ? '#000000' : '#30D158');
  } catch (e) {}
  if (typeof renderThemeToggle === 'function') renderThemeToggle();
  if (typeof window !== 'undefined' && typeof window.snbThemeChanged === 'function') window.snbThemeChanged(th);   // שלב 3: ההדר של הדפים העצמאיים (shell.js)
}
function setThemeMode(mode) {
  const m = mode === 'dark' ? 'dark' : mode === 'light' ? 'light' : 'system';
  try { localStorage.setItem(LS_THEME, m); } catch (e) {}
  withViewTransition(applyTheme); // v193: מעבר בהיר/כהה בהצלבה רכה (View Transitions כשיש)
}
/* v193: מריץ שינוי מסך בתוך View Transition (הצלבה של המסך הישן והחדש, ~280ms) כשהדפדפן תומך;
   אחרת — מיד. מכבד "הפחתת תנועה". fn חייבת להיות סינכרונית. */
function withViewTransition(fn) {
  try {
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduce && typeof document !== 'undefined' && typeof document.startViewTransition === 'function') { document.startViewTransition(() => { fn(); }); return; }
  } catch (e) {}
  fn();
}

const IBKR_PROXY_DEFAULT = (typeof window !== 'undefined' && window.SNB_ENV && window.SNB_ENV.proxy) || 'https://ibkr-proxy-wine.vercel.app';

function ibkrProxyBase() {
  // v298+ (בקשת המשתמש): שדה "כתובת השרתון" הוסר — תמיד הכתובת הקבועה; כתובת ישנה שנשמרה בטלפון לא משפיעה.
  // השרתון עבר כתובת → לעדכן את PROXY ב־firebase-config.js (וגם ALLOWED_ORIGINS בשרתון), לא לבקש מהמשתמש.
  return IBKR_PROXY_DEFAULT.trim().replace(/\/+$/, '');
}
/* כותרות לשרתון. X-App-Key רדום (v150): השדה הוסר מההגדרות כי APP_KEY לא מוגדר ב־Vercel.
   להפעלה מחדש: להחזיר שדה שכותב ל־ibkrCfg().appKey (ראה v148 ביומן) + APP_KEY ב־Vercel. */
function ibkrProxyHeaders() {
  const h = { 'Content-Type': 'application/json' };
  let k = '';
  try { k = String(ibkrCfg().appKey || '').trim(); } catch (e) {}
  if (k) h['X-App-Key'] = k;
  return h;
}

function dlgAvailable() {
  return typeof document !== 'undefined' && !!document.body && typeof document.body.appendChild === 'function' &&
    typeof document.createElement === 'function' && typeof requestAnimationFrame === 'function';
}
let _dlgClose = null;
function askConfirm(msg, onYes, opts) {
  const o = opts || {};
  if (!dlgAvailable()) {
    if (o.alert) { try { alert(msg); } catch (e) {} if (onYes) onYes(); return; }
    let yes = false;
    try { yes = confirm(msg); } catch (e) {}
    if (yes) { if (onYes) onYes(); } else if (o.onNo) o.onNo();
    return;
  }
  if (_dlgClose) _dlgClose(false, true);
  const veil = document.createElement('div');
  veil.className = 'dlg-veil';
  const box = document.createElement('div');
  box.className = 'dlg' + (o.alert ? ' dlg-alert' : '') + (String(msg || '').length > 110 ? ' dlg-long' : ''); // טקסט ארוך — מיושר לתחילת השורה
  box.setAttribute('role', o.alert ? 'alertdialog' : 'dialog');
  box.setAttribute('aria-modal', 'true');
  const p = document.createElement('p');
  p.className = 'dlg-msg';
  p.textContent = String(msg == null ? '' : msg);
  const btns = document.createElement('div');
  btns.className = 'dlg-btns';
  const mk = (cls, label) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'dlg-btn ' + cls; b.textContent = label; btns.appendChild(b); return b; };
  const cancel = o.alert ? null : mk('dlg-cancel', o.cancel || t('btnCancel'));
  const ok = mk('dlg-ok' + (o.danger ? ' danger' : ''), o.ok || (o.alert ? t('btnClose') : t('btnOk')));
  box.appendChild(p);
  box.appendChild(btns);
  veil.appendChild(box);
  document.body.appendChild(veil);
  requestAnimationFrame(() => veil.classList.add('on'));
  const prevFocus = document.activeElement;
  const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); done(false); } };
  let closed = false;
  const dlgModal = modalPush(() => done(false));   // v322: "חזור" = ביטול
  const done = (yes, silent) => {
    if (closed) return;
    closed = true;
    _dlgClose = null;
    modalDone(dlgModal);
    document.removeEventListener('keydown', onKey, true);
    veil.classList.remove('on');
    veil.classList.add('off');
    setTimeout(() => veil.remove(), 220);
    try { if (prevFocus && prevFocus.focus) prevFocus.focus({ preventScroll: true }); } catch (e) {}
    if (silent) return;
    if (yes || o.alert) { if (onYes) onYes(); } else if (o.onNo) o.onNo();
  };
  _dlgClose = done;
  ok.addEventListener('click', () => done(true));
  if (cancel) cancel.addEventListener('click', () => done(false));
  veil.addEventListener('click', (e) => { if (e.target === veil) done(false); });
  document.addEventListener('keydown', onKey, true);
  setTimeout(() => { try { ok.focus({ preventScroll: true }); } catch (e) {} }, 30);
}
function askAlert(msg, then) { askConfirm(msg, then || null, { alert: true }); }
function askConfirmP(msg, opts) {
  return new Promise((res) => askConfirm(msg, () => res(true), Object.assign({}, opts, { onNo: () => res(false) })));
}

/* גרסת האפליקציה — מוצגת בהגדרות כדי לוודא שהטלפון מעודכן (באזור <core>: גם Academy ו־Studio מציגות אותה —
   אחרי העלאת הגרסה: node tools/coregen.js ואז node tools/swgen.js) */
/* שני מספרים (12/10/2026), כמו versionName + versionCode באנדרואיד:
   APP_RELEASE = גרסת המערכת (SemVer: MAJOR.MINOR.PATCH) — עולה רק כשמשחררים לפרודקשן; מה חדש בה — CHANGELOG.md.
   APP_VERSION = מספר הבנייה — עולה בכל שינוי בקבצים (מפתח המטמון ב־sw.js, tools/swgen.js). בהגדרות: "1.0.0 (395)". */
const APP_RELEASE = '2.1.0';
const APP_VERSION = 'v416';
/* "1.0.0 (395)"; בסביבת הניסוי — גם "· ניסוי" */
function appVersionLabel() {
  const build = String(APP_VERSION).replace(/^v/, '');
  const st = typeof window !== 'undefined' && window.SNB_ENV && window.SNB_ENV.name === 'staging';
  return APP_RELEASE + ' (' + build + ')' + (st ? ' · ' + t('envStaging') : '');
}

const LS_OWNER = 'pwa_owner_v1', LS_STASH = 'pwa_stash_v1:', LS_LEGACY_OWNER = 'pwa_legacy_owner_v1';
const ACCOUNT_KEYS = ['pwa_db_v1', 'pwa_ibkr_v1', 'pwa_predemo_v1', 'pwa_wlactive_v1', 'pwa_srcfilter_v1', 'pwa_tdkey_v1', 'pwa_libbk_v1', 'pwa_libcoll_v1', 'pwa_studio_v1'];   // v318: גיבוי הספרייה הפרטית · v320: אסופות הספרייה · v354: טיוטות הסטודיו
function accountOwner(store) {
  try { return (store || localStorage).getItem(LS_OWNER) || ''; } catch (e) { return ''; }
}
/* מחזיר true כשהבעלים התחלף (צריך לטעון את הדף מחדש). cloudHasDoc: true/false/null (לא ידוע — למשל בלי רשת) */
function accountSwitchTo(uid, cloudHasDoc, store) {
  const ls = store || localStorage;
  const to = uid || 'local';
  let from = ls.getItem(LS_OWNER) || '';
  if (from === to) return false;
  if (!from) {
    const hasData = ACCOUNT_KEYS.some((k) => ls.getItem(k) != null);
    if (!hasData || to === 'local') { ls.setItem(LS_OWNER, to); return false; }
    if (cloudHasDoc === true) { ls.setItem(LS_OWNER, to); ls.setItem(LS_LEGACY_OWNER, to); return false; }   // אותו אדם שחוזר
    from = 'legacy';                                // חשבון חדש / לא ידוע — לא מקבל את הנתונים הישנים
  }
  const pack = {};
  for (const k of ACCOUNT_KEYS) { const v = ls.getItem(k); if (v != null) pack[k] = v; ls.removeItem(k); }
  try { if (Object.keys(pack).length) ls.setItem(LS_STASH + from, JSON.stringify(pack)); else ls.removeItem(LS_STASH + from); } catch (e) {}   // אין מקום — הפרטיות קודמת: הנתונים לא חוזרים לחשבון החדש
  let back = null;
  try { back = JSON.parse(ls.getItem(LS_STASH + to) || 'null'); } catch (e) {}
  ls.removeItem(LS_STASH + to);
  if (back) for (const k of ACCOUNT_KEYS) if (typeof back[k] === 'string') { try { ls.setItem(k, back[k]); } catch (e) {} }
  ls.setItem(LS_OWNER, to);
  return true;
}

function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

function flash(msg) {
  let toastEl = document.getElementById('toast');
  if (!toastEl) {
    toastEl = el('div', 'toast');
    toastEl.id = 'toast';
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastEl._h);
  toastEl._h = setTimeout(() => toastEl.classList.remove('show'), 2200);
}

let _navSkipPop = 0;

const _modals = [];
let _backPending = 0;
const _afterBack = [];
function afterBack(fn) { if (_backPending > 0) _afterBack.push(fn); else fn(); }
function navBack(delta) { _navSkipPop++; _backPending++; try { history.go(delta); } catch (e) { _navSkipPop--; _backPending--; } }
function modalPush(close) {
  const rec = { close, pushed: false, done: false, n: _modals.length + 1 };
  _modals.push(rec);
  // v323: רשומה רק כשיש הפעלת משתמש — pushState בלי נגיעה (למשל askAlert אחרי שגיאת סנכרון) גורם ל־Chrome לסמן את הרשומה
  // הקודמת "לדילוג", ו"חזור" היה קופץ שתי רשומות אחורה. חלון בלי רשומה נסגר ב"חזור" בלי לבלוע את הניווט (wireBackNav).
  const ua = typeof navigator !== 'undefined' && navigator.userActivation;
  if (ua && !ua.isActive) return rec;
  afterBack(() => { if (rec.done) return; try { history.pushState(Object.assign({}, history.state || {}, { modal: rec.n }), ''); rec.pushed = true; } catch (e) {} });
  return rec;
}
function modalDone(rec) {
  if (!rec || rec.done) return;
  rec.done = true;
  const i = _modals.indexOf(rec); if (i >= 0) _modals.splice(i, 1);
  if (rec.popping || !rec.pushed) return;
  try { if (history.state && history.state.modal === rec.n) navBack(-1); } catch (e) {}
}
if (typeof window !== 'undefined') window.snbAfterBack = afterBack;

/* שלב 3 בתוכנית שלוש האפליקציות: החלק הכללי של "חזור" — היסטוריה שקיצרנו בעצמנו (navBack) וחלונות פתוחים (modalPush).
   משותף לאפליקציה (wireBackNav — אחריו מעבר הטאבים) ולדפים העצמאיים (wireCoreBack, דרך core.js). true = טופל. */
function backPopHandled() {
  if (_navSkipPop > 0) { // אנחנו קיצרנו את ההיסטוריה — הטאב/החלון כבר טופל (והספרייה לא מנווטת: navSkip)
    _navSkipPop--;
    document.documentElement.dataset.navSkip = '1';
    setTimeout(() => { delete document.documentElement.dataset.navSkip; }, 0);
    if (_backPending > 0) _backPending--;
    if (!_backPending && _afterBack.length) _afterBack.splice(0).forEach((f) => { try { f(); } catch (e) {} });
    return true;
  }
  const stModal = (history.state && history.state.modal) || 0;
  if (_modals.length > stModal) {   // "חזור" על חלון פתוח — סוגר אותו (והספרייה לא מנווטת: modalPop)
    let pushedClosed = false;
    while (_modals.length > stModal) { const m = _modals.pop(); m.popping = true; m.done = true; if (m.pushed) pushedClosed = true; try { m.close(); } catch (e) {} }
    // חלון עם רשומה משלו — ה"חזור" הזה היה שלו; חלון בלי רשומה (נפתח בלי נגיעה) — ה"חזור" ניווט אמיתי, ממשיכים
    if (pushedClosed) { document.documentElement.dataset.modalPop = '1'; setTimeout(() => { delete document.documentElement.dataset.modalPop; }, 0); return true; }
  }
  return false;
}
function wireCoreBack() {
  if (typeof window === 'undefined' || !window.addEventListener || window._backNav) return;
  window._backNav = true;
  window.addEventListener('popstate', backPopHandled);
}

/* ---------------- 14/10/2026: החלקה ומעבר עמודים — אותה חוקיות בשלוש האפליקציות (בקשת המשתמש) ----------------
   הספים כוילו ב־Invest (v279→v281) ומשותפים עכשיו ל־Academy ול־Studio: משיכה ארוכה = עמוד; בעמוד עם טאבים פנימיים
   (רשימות המעקב, שתי הספריות ב־Academy, הלשוניות של התראה/תקלה ב־Studio) — קצרה = טאב, ארוכה = עמוד, ביניהן כלום. */
const PAGE_SWIPE_FRAC = 0.33, PAGE_SWIPE_MIN = 96, PAGE_SWIPE_EDGE = 22;
const PAGE_FLING_V = 0.45, PAGE_FLING_FRAC = 0.15, PAGE_FLING_MIN = 56;
const WL_SWIPE_MIN = 48, WL_SWIPE_MAX_FRAC = 0.3, WL_PAGE_FRAC = 0.55;
/* מה ההחלקה עושה (טהורה, נבדקת): d = מרחק בכיוון, w = רוחב, v = מהירות בשחרור (px/ms), watch = על רשימת מעקב
   עם כמה רשימות. מחזיר 'page' | 'list' | null. */
function pageSwipeDecide(d, w, v, watch) {
  if (watch) {
    if (d >= w * WL_PAGE_FRAC) return 'page';
    if (d >= WL_SWIPE_MIN && d < w * WL_SWIPE_MAX_FRAC) return 'list';
    return null;
  }
  if (d >= Math.max(PAGE_SWIPE_MIN, w * PAGE_SWIPE_FRAC)) return 'page';
  if (v >= PAGE_FLING_V && d >= Math.max(PAGE_FLING_MIN, w * PAGE_FLING_FRAC)) return 'page';
  return null;
}
/* ---- מעבר "קובייה" (14/10/2026, בקשת המשתמש — כמו המעבר בין המסכים במשגר של OnePlus 15) ----
   נמדד פריים־פריים בסרטון של המשתמש: קובייה קמורה — שני העמודים פאות סמוכות והצלע המשותפת מתקרבת אליך; הציר במרכז
   הקובייה (חצי רוחב מאחורי המסך), והקובייה נסוגה כך שהצלע הקרובה נשארת תמיד בגובה המסך (לא גדלה ולא נחתכת); נקודת
   המבט במרחק 1.8 רוחבי מסך (התאמה לסרטון: שגיאה של כ־1%); ההדר והרקע לא זזים. התנועה צמודה לאצבע (רבע סיבוב = רוחב
   המסך), ואחרי השחרור — קפיץ מרוסן קריטית שממשיך מהמהירות של האצבע (כ־0.3 שנ׳, כמו בסרטון).
   פאה = כל אלמנט במישור העמוד: נקודת הציר תמיד במרכז המסך (transform-origin יחסית לאלמנט), כך שעמוד צר מהמסך (Invest —
   השוליים של main) מסתובב כחלק מפאה ברוחב המסך, עם רווח בצלע — כמו הווידג׳טים בסרטון.
   אחרי השחרור / בלחיצה — Web Animations עם פריימים מחושבים מראש: רץ ב־compositor גם כשהעמוד החדש עוד נצבע. */
const CUBE_P = 1.8, CUBE_W = 17, CUBE_RUB = 0.07;
let cubeNow = null;                      // המעבר שרץ עכשיו (נגיעה חדשה / מעבר חדש — מסיימים אותו מיד)
function cubeReduce() { try { return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
function cubeSideFwd(fwd) {              // +1 = העמוד החדש נכנס מימין (קדימה ב־LTR, אחורה ב־RTL)
  const rtl = typeof document !== 'undefined' && String((document.documentElement && document.documentElement.dir) || 'ltr') === 'rtl';
  return (!!fwd !== rtl) ? 1 : -1;
}
function cubeTransform(p, side, isIn, vw) {   // טהורה (נבדקת): p = 0..1 מרבע סיבוב
  const q = Math.max(0, Math.min(1, +p || 0)), th = q * Math.PI / 2, h = vw / 2;
  const zb = h * (Math.cos(th) + Math.sin(th) - 1);   // הנסיגה: הצלע הקרובה נשארת במישור המסך
  const a = -side * q * 90 + (isIn ? side * 90 : 0);
  const f = (x) => Math.round(x * 100) / 100 || 0;
  return 'perspective(' + f(CUBE_P * vw) + 'px) translateZ(' + f(-(zb + h)) + 'px) rotateY(' + f(a) + 'deg) translateZ(' + f(h) + 'px)';
}
function cubeSpring(p0, v0, p1) {        // טהורה (נבדקת): מיקום כל 1/60 שנ׳ — קפיץ מרוסן קריטית מהמהירות של האצבע (p לשנייה)
  const w = CUBE_W, A = p0 - p1, B = (v0 || 0) + w * A, out = [];
  for (let i = 0; i < 90; i++) {
    const t = i / 60, e = Math.exp(-w * t), x = p1 + (A + B * t) * e, v = (B - w * (A + B * t)) * e;
    out.push(Math.max(0, Math.min(1, x)));
    if (i > 2 && Math.abs(x - p1) < 0.003 && Math.abs(v) < 0.1) break;   // פחות מחצי מעלה — לא נראה
  }
  out[out.length - 1] = p1;
  return out;
}
/* מכין אלמנט להיות פאה. o.fix = {top, left, width} — מוצמד למסך במקום הזה; o.clip — נחתך לגובה המסך (עמוד ארוך) */
function cubeFace(el, o) {
  const st = el.style, f = { el: el, css: st.cssText };
  if (o && o.fix) { st.position = 'fixed'; st.top = o.fix.top + 'px'; st.left = o.fix.left + 'px'; st.width = o.fix.width + 'px'; st.right = 'auto'; st.margin = '0'; }
  st.transform = '';
  const r = el.getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight, n = (x) => Math.round(x * 10) / 10;
  st.transformOrigin = n(vw / 2 - r.left) + 'px ' + n(vh / 2 - r.top) + 'px';
  if (o && o.clip) st.clipPath = 'inset(' + n(Math.max(0, -r.top)) + 'px 0 calc(100% - ' + n(Math.max(0, vh - r.top)) + 'px) 0)';
  st.backfaceVisibility = 'hidden'; st.webkitBackfaceVisibility = 'hidden'; st.willChange = 'transform';
  if (o && o.dead) st.pointerEvents = 'none';   // רק היוצא; הנכנס לחיץ כבר בזמן הסיבוב
  st.outline = 'none';                   // טבעת הפוקוס של שכבה (Academy/Studio) הסתובבה איתה כמסגרת כהה
  return f;
}
function cubeFaceOff(f) { if (f && f.el) f.el.style.cssText = f.css; }
function cubeSet(c, p) {
  const vw = window.innerWidth;
  c.p = p;
  if (c.rub) { if (c.out) c.out.el.style.transform = cubeTransform(Math.min(CUBE_RUB, p), c.side, false, vw); return; }
  if (c.out) c.out.el.style.transform = cubeTransform(p, c.side, false, vw);
  if (c.in) c.in.el.style.transform = cubeTransform(p, c.side, true, vw);
}
/* מ־c.p אל p1 בקפיץ (v0 = המהירות בשחרור, p לשנייה); done(p1) אחרי הפריים האחרון. c.finish() = לסיים מיד */
function cubeRun(c, p1, v0, done) {
  if (cubeNow && cubeNow !== c && cubeNow.finish) cubeNow.finish();
  const vw = window.innerWidth, ps = cubeSpring(c.p || 0, v0 || 0, p1), dur = Math.max(17, (ps.length - 1) * 1000 / 60);
  const anims = [];
  const one = (f, isIn) => {
    if (!f || typeof f.el.animate !== 'function') return;
    const kf = ps.map((p) => ({ transform: cubeTransform(c.rub ? Math.min(CUBE_RUB, p) : p, c.side, isIn, vw) }));
    try { anims.push(f.el.animate(kf, { duration: dur, easing: 'linear', fill: 'forwards' })); } catch (e) {}
  };
  one(c.out, false); if (!c.rub) one(c.in, true);
  let fin = false;
  const end = () => {
    if (fin) return;
    fin = true;
    if (cubeNow === c) cubeNow = null;
    cubeSet(c, p1);                       // המצב הסופי ב־style לפני שהאנימציות יורדות — בלי פריים באמצע
    anims.forEach((a) => { try { a.cancel(); } catch (e) {} });
    try { done(p1); } catch (e) { if (typeof console !== 'undefined') console.error(e); }
  };
  c.finish = end;
  cubeNow = c;
  if (!anims.length) return end();
  Promise.all(anims.map((a) => a.finished)).then(end, end);
}
/* Academy / Studio: השכבה נצבעת מחדש באותו אלמנט — הדף היוצא = העתק "מת" שלה (קנבסים, גלילה, שדות), מעליה */
function cubeClone(el) {
  // מעבר קודם עוד רץ על אותה שכבה — מסיימים אותו קודם: אחרת ההעתק והפאה החדשה "שומרים" את הסגנון של אמצע הסיבוב,
  // ובסוף השכבה משוחזרת אליו ונשארת מסובבת (נמצא ב־QA: דף שנדחף מיד אחרי דף אחר בסטודיו)
  if (cubeNow && cubeNow.finish) cubeNow.finish();
  const c = el.cloneNode(true);
  const a = el.querySelectorAll('canvas, input, textarea, select'), b = c.querySelectorAll('canvas, input, textarea, select');
  for (let i = 0; i < a.length && i < b.length; i++) {
    try {
      if (a[i].tagName === 'CANVAS') { b[i].width = a[i].width; b[i].height = a[i].height; b[i].getContext('2d').drawImage(a[i], 0, 0); }
      else b[i].value = a[i].value;
    } catch (e) {}
  }
  c.querySelectorAll('video, audio, iframe').forEach((x) => x.remove());
  c.querySelectorAll('[id]').forEach((x) => x.removeAttribute('id'));   // getElementById לא מוצא את ההעתק
  c.removeAttribute('id'); c.classList.add('cube-ghost'); c.setAttribute('aria-hidden', 'true');
  try { c.inert = true; } catch (e) {}
  el.after(c);
  c.scrollTop = el.scrollTop;
  return c;
}
function cubeBackdrop(el) {              // מתחת לשכבה — רקע אטום, כדי שמה שמאחוריה (התיק) לא יבצבץ בין הפאות (לקח v330)
  const d = document.createElement('div');
  d.className = 'cube-bd';
  el.before(d);
  return d;
}
/* מעבר שלם בשכבה (לחיצה, "חזור"): ghost = הדף היוצא (cubeClone, לפני הציור), root = הדף החדש שכבר צויר */
function cubeGhostRun(root, ghost, side) {
  const bd = cubeBackdrop(root);
  const c = { side: side, p: 0, out: cubeFace(ghost, { dead: true }), in: cubeFace(root) };
  cubeSet(c, 0);
  return new Promise((res) => cubeRun(c, 1, 0, () => { cubeFaceOff(c.in); ghost.remove(); bd.remove(); res(); }));
}
function cubeSlideIn(els, dir) {         // טאב פנימי חדש נכנס מהצד (כמו החלפת רשימת מעקב — wlSlide)
  if (cubeReduce()) return;
  for (const e of els) { try { e.animate([{ opacity: 0, transform: 'translateX(' + (28 * dir) + 'px)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.2, .9, .25, 1)' }); } catch (x) {} }
}
/* ההחלקה של Academy ו־Studio — העתק של המחווה של Invest (wirePageSwipe) על שכבה בגלילה פנימית.
   o.root — השכבה (האזנה עליה; התוכן מתחלף בתוכה); o.ok() — אפשר להתחיל עכשיו; o.hasTabs() — בעמוד יש טאבים פנימיים;
   o.page(next) → {render(), undo(), commit()} | null — העמוד השכן: render מצייר אותו לתוך root (הדף היוצא = העתק),
   undo מחזיר את הקודם (אפשר Promise), commit = ההיסטוריה; o.tabs(next) → {els, go()} | null — הטאב השכן. */
function snbSwipe(o) {
  const root = o.root;
  if (!root || root._snbSwipe) return;
  root._snbSwipe = true;
  let g = null;
  const rtl = () => String((document.documentElement && document.documentElement.dir) || 'ltr') === 'rtl';
  const clock = () => ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now());
  const buzz = (ms) => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };
  const blocked = (tg) => {
    if (!tg || !tg.closest) return true;
    if (tg.closest('canvas, input, textarea, select, video, [contenteditable="true"], .item-acts, .dlg-veil, .cube-ghost')) return true;
    const ns = tg.closest('.no-swipe');
    if (ns && ns !== root) return true;
    for (let el = tg; el && el !== root && el.nodeType === 1; el = el.parentElement) {   // פס גלילה אופקי
      if (el.scrollWidth > el.clientWidth + 2) { const ox = getComputedStyle(el).overflowX; if (ox === 'auto' || ox === 'scroll') return true; }
    }
    return false;
  };
  const tabMove = (s, x, sign) => { if (s.tab) for (const el of s.tab.els) el.style.transform = x ? 'translate3d(' + sign * x + 'px,0,0)' : ''; };
  const tabSettle = (s, back) => {
    if (!s.tab) return;
    for (const el of s.tab.els) {
      if (back) { el.style.transition = 'transform .34s cubic-bezier(.2, .9, .25, 1)'; el.style.transform = ''; setTimeout(() => { el.style.transition = ''; }, 360); }
      else { el.style.transition = ''; el.style.transform = ''; }
    }
  };
  function begin(s) {                    // התזוזה של העמוד מתחילה — העמוד השכן נצבע, או "קפיץ" כשאין
    const pg = o.page ? o.page(s.next) : null;
    const bd = cubeBackdrop(root);
    if (!pg) { s.cube = { side: s.side, p: 0, rub: true, out: cubeFace(root, { dead: true }), bd: bd }; return; }
    const ghost = cubeClone(root);
    try { pg.render(); } catch (e) { ghost.remove(); bd.remove(); s.cube = null; return; }
    s.cube = { side: s.side, p: 0, out: cubeFace(ghost, { dead: true }), in: cubeFace(root), ghost: ghost, bd: bd, pg: pg };
  }
  root.addEventListener('touchstart', (e) => {
    if (g) cancel();
    if (cubeNow && cubeNow.finish) cubeNow.finish();
    if (e.touches.length !== 1 || !root.isConnected || (o.ok && !o.ok())) return;
    const t = e.touches[0], w = root.clientWidth || window.innerWidth || 400;
    if (t.clientX < PAGE_SWIPE_EDGE || t.clientX > w - PAGE_SWIPE_EDGE) return;
    const tg = e.target;
    if (blocked(tg)) return;
    g = { x0: t.clientX, y0: t.clientY, w: w, lock: 0, act: null, watch: !!(o.hasTabs && o.hasTabs()), samples: [[clock(), t.clientX]], tg: tg };
    // העמוד השכן נצבע באמצע הגרירה ומוחק את האלמנט שנגעו בו — האירועים ממשיכים להגיע רק אליו (לקח v283 ב־Invest):
    // האזנה עליו וגם על המסמך, וכל אירוע מטופל פעם אחת
    tg.addEventListener('touchmove', move, { passive: false });
    tg.addEventListener('touchend', end, { passive: true });
    tg.addEventListener('touchcancel', cancel, { passive: true });
  }, { passive: true });
  document.addEventListener('touchmove', (e) => { if (g) move(e); }, { passive: false });
  document.addEventListener('touchend', (e) => { if (g) end(e); }, { passive: true });
  document.addEventListener('touchcancel', (e) => { if (g) cancel(e); }, { passive: true });
  const unhook = (s) => { if (!s || !s.tg) return; s.tg.removeEventListener('touchmove', move); s.tg.removeEventListener('touchend', end); s.tg.removeEventListener('touchcancel', cancel); };
  let lastEv = null;
  const seen = (e) => { if (!e) return false; if (e === lastEv) return true; lastEv = e; return false; };
  function move(e) {
    if (!g || seen(e)) return;
    if (e.touches.length !== 1) { cancel(); return; }
    const t = e.touches[0], dx = t.clientX - g.x0, dy = t.clientY - g.y0;
    if (!g.lock) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      if (Math.abs(dx) < Math.abs(dy) * 1.5) { unhook(g); g = null; return; }   // גלילה אנכית — לא נוגעים
      g.lock = 1; g.next = rtl() ? dx > 0 : dx < 0; g.side = cubeSideFwd(g.next);
      g.tab = g.watch && o.tabs ? o.tabs(g.next) : null;
    }
    if (e.cancelable) e.preventDefault();
    const now = clock();
    g.samples.push([now, t.clientX]);
    while (g.samples.length > 2 && now - g.samples[0][0] > 100) g.samples.shift();
    const same = (rtl() ? dx > 0 : dx < 0) === g.next, sign = dx < 0 ? -1 : 1;
    const d = same ? Math.abs(dx) : 0, zone = g.w * WL_SWIPE_MAX_FRAC;
    g.d = d;
    let p = 0, tx = 0, act;
    if (g.watch) {
      if (d < zone) tx = g.tab ? d * 0.5 : Math.min(18, d * 0.1);   // קצרה: רק התוכן של הטאב זז
      else p = (d - zone) / (g.w - zone);                           // מעבר לאזור — העמוד כולו מסתובב
      act = pageSwipeDecide(d, g.w, 0, true);
      if (act === 'list' && !g.tab) act = null;
    } else { p = d / g.w; act = pageSwipeDecide(d, g.w, 0, false); }
    tabMove(g, tx, sign);
    if (p > 0 && !g.cube) begin(g);
    if (g.cube) cubeSet(g.cube, g.cube.rub ? p * 0.15 : p);
    if (act === 'page' && !(g.cube && g.cube.pg)) act = null;
    if (act !== g.act) { if (act === 'page') buzz(12); else if (act === 'list') buzz(5); }
    g.act = act;
  }
  function finishCube(s, act, vp) {
    const c = s.cube;
    if (!c) return;
    if (act === 'page') {
      cubeRun(c, 1, Math.max(0, vp), () => { cubeFaceOff(c.in); c.ghost.remove(); c.bd.remove(); c.pg.commit(); });
      return;
    }
    cubeRun(c, 0, Math.min(0, vp) * (c.rub ? 0.15 : 1), () => {
      const done = () => { cubeFaceOff(c.in); cubeFaceOff(c.rub ? c.out : null); if (c.ghost) c.ghost.remove(); c.bd.remove(); };
      if (!c.pg) return done();
      let r; try { r = c.pg.undo(); } catch (e) { r = null; }
      Promise.resolve(r).then(done, done);   // הדף הקודם נצבע מחדש מאחורי ההעתק — ורק אז ההעתק יורד
    });
  }
  function end(e) {
    if (!g || seen(e)) return;
    const s = g; g = null;
    unhook(s);
    if (!s.lock) return;
    const a = s.samples[0], b = s.samples[s.samples.length - 1];
    const v = (b[0] > a[0]) ? Math.abs(b[1] - a[1]) / (b[0] - a[0]) : 0;
    const fwd = s.samples.length > 1 && ((b[1] - a[1] > 0) === (rtl() === s.next));   // ההטלה בכיוון המשיכה
    let act = pageSwipeDecide(s.d || 0, s.w, fwd ? v : 0, s.watch);
    if (act === 'page' && !(s.cube && s.cube.pg)) act = null;
    if (act === 'list' && !s.tab) act = null;
    tabSettle(s, act !== 'list');
    const span = s.watch ? s.w * (1 - WL_SWIPE_MAX_FRAC) : s.w;
    finishCube(s, act, (fwd ? v : -v) * 1000 / span);
    if (act === 'list') s.tab.go();
  }
  function cancel(e) {
    if (!g || seen(e)) return;
    const s = g; g = null;
    unhook(s);
    if (!s.lock) return;
    tabSettle(s, true);
    finishCube(s, null, 0);
  }
}

let _itemActs = null;
function clearItemActions() {
  if (!_itemActs) return;
  const a = _itemActs; _itemActs = null;
  if (a.modal) modalDone(a.modal);
  a.host.classList.remove('holding');
  a.box.classList.add('out');
  setTimeout(() => a.box.remove(), 180);
}
function showItemActions(host, acts) {
  clearItemActions();
  if (!host || !acts.length) return;
  const box = el('div', 'item-acts');
  for (const a of acts) {
    const b = el('button', 'icon-btn act-' + a.kind);
    b.type = 'button';
    b.setAttribute('aria-label', a.kind === 'edit' ? t('actEdit') : a.kind === 'coll' ? t('actColl') : t('actDelete'));
    b.innerHTML = a.kind === 'edit' ? ICON_EDIT : a.kind === 'coll' ? ICON_COLL : ICON_CLOSE;
    b.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); clearItemActions(); a.fn(); });
    box.appendChild(b);
  }
  host.classList.add('holding');
  // v278 (בקשת המשתמש): תמיד צף ממש מעל הכרטיס/הטאב, מחוץ לגבולות שלו, מיושר לצד השמאלי
  box.classList.add('floating');
  document.body.appendChild(box);
  const r = host.getBoundingClientRect();
  const bw = box.offsetWidth || 110, bh = box.offsetHeight || 56;
  box.style.top = Math.round(Math.max(8, r.top - bh - 8)) + 'px';
  box.style.left = Math.round(Math.max(8, Math.min(window.innerWidth - bw - 8, r.left))) + 'px';
  _itemActs = { host, box, at: Date.now(), modal: modalPush(clearItemActions) };   // v322: "חזור" מבטל
}
if (typeof document !== 'undefined' && document.addEventListener) {
  // לחיצה מחוץ לכפתורים — מבטלת את מצב העריכה ו"נבלעת" (לא פותחת כרטיס/טאב)
  const outside = (e) => { if (!_itemActs || Date.now() - _itemActs.at < 350) return false; return !(e.target && e.target.closest && e.target.closest('.item-acts')); };
  document.addEventListener('pointerdown', (e) => { if (outside(e)) { _itemActs.cancelTap = true; } }, true);
  document.addEventListener('click', (e) => { if (_itemActs && _itemActs.cancelTap) { e.stopPropagation(); e.preventDefault(); clearItemActions(); } }, true);
  document.addEventListener('scroll', () => { if (_itemActs && Date.now() - _itemActs.at > 350) clearItemActions(); }, true); // הכפתורים צפים — גלילה מבטלת
}

function btnFacesHTML(main, alt) {
  return '<span class="face face-main">' + main + '</span><span class="face face-alt" aria-hidden="true">' + alt + '</span>';
}
