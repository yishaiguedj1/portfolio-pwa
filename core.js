/* נוצר אוטומטית מ־app.js ב־tools/coregen.js — לא לערוך ביד (שינוי = ב־app.js, ואז node tools/coregen.js). */
/* הקוד המשותף ל־Academy ול־Studio (דפים עצמאיים, בלי app.js). לפני הקובץ — strings-<אפליקציה>.js (STRINGS). */
/* כותרת X-App-Key רדומה (v150) — בלי הגדרות IBKR בדפים האלה */
function ibkrCfg() { return {}; }

const LS_LANG = 'pwa_lang_v1';

const _IC_PRE = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
const ICON_EDIT = _IC_PRE + '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
const ICON_CLOSE = _IC_PRE + '<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>';
const ICON_COLL = _IC_PRE + '<path d="M4 6h11v14H4z"/><path d="M8 3h12v14"/><line x1="9.5" y1="10" x2="9.5" y2="16"/><line x1="6.5" y1="13" x2="12.5" y2="13"/></svg>';   // v320: הוספה לאסופה (ספרייה)

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
