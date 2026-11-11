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
/* 15/10/2026 (בקשת המשתמש, מהמחקר על ServiceNow): מצב תחזוקה והגדרות ודגלים — מהשרתון (op ציבורי cfg, בלי התחברות),
   לשלוש האפליקציות. במטמון בטלפון (LS_SYSCFG — מטמון, לא נתון אישי) כדי שהפס יופיע כבר בפריים הראשון; נבדק שוב בכל
   חזרה לאפליקציה. snbFlag(k) — דגל שלא ידוע (אין חיבור, אין מטמון) = דולק. בזמן תחזוקה — פס קבוע למעלה, בלי לחסום נגיעות */
const LS_SYSCFG = 'pwa_syscfg_v1';
let _sysCfg = null;
function sysCfgCached() {
  if (_sysCfg) return _sysCfg;
  try { _sysCfg = JSON.parse(localStorage.getItem(LS_SYSCFG) || 'null'); } catch (e) { _sysCfg = null; }
  return _sysCfg;
}
function snbFlag(k) { const c = sysCfgCached(); return !(c && c.f && c.f[k] === false); }
/* 15/10/2026 — האיסוף המלא בתקופת הפיתוח (הדגל learn_full): שגיאות JavaScript מ־Academy ו־Studio לשרתון (op devErr — רק של
   המנהל, השרתון בודק). הלכידה מתחילה כשהקובץ נטען (data-app על <html>), השליחה — אחרי devErrBoot עם החיבור, רק כשהדגל
   ידוע כדולק (בלי מטמון = לא שולחים). אותה שגיאה ברצף = שורה אחת עם מונה; עד 20 במנה, מנה לכל היותר כל 15 שנ׳ */
const _devErr = { q: [], app: '', user: null, t: 0, wired: false };
function devErrPush(ty, msg, src, ln, col, stk) {
  const q = _devErr.q, key = ty + '|' + msg + '|' + src + '|' + ln;
  const old = q.find((x) => x._k === key);
  if (old) { old.n = (old.n || 1) + 1; return; }
  if (q.length >= 20) return;
  q.push({ _k: key, ty, at: Date.now(), msg: String(msg || '').slice(0, 500), src: String(src || '').slice(0, 300), ln: ln | 0, col: col | 0,
    stk: String(stk || '').slice(0, 4000), path: String((typeof location !== 'undefined' && location.pathname) || '').slice(0, 200) });
  devErrFlush();
}
function devErrWire() {
  if (_devErr.wired || typeof window === 'undefined' || typeof document === 'undefined' || !window.addEventListener) return;
  const app = document.documentElement && document.documentElement.dataset ? document.documentElement.dataset.app : '';
  if (app !== 'academy' && app !== 'studio') return;
  _devErr.wired = true; _devErr.app = app;
  window.addEventListener('error', (e) => { if (e && e.message) devErrPush('err', e.message, e.filename, e.lineno, e.colno, e.error && e.error.stack); });
  window.addEventListener('unhandledrejection', (e) => { const r = e && e.reason; devErrPush('rej', (r && (r.message || r.name)) || String(r), '', 0, 0, r && r.stack); });
}
function devErrBoot(getUser) { _devErr.user = getUser; devErrFlush(); }
function devErrFlush() {
  if (!_devErr.q.length || !_devErr.user || _devErr.busy || typeof fetch !== 'function') return;
  const later = (ms) => { clearTimeout(_devErr.tm); _devErr.tm = setTimeout(devErrFlush, ms); };
  const c = sysCfgCached(), u = _devErr.user();
  if (!(c && c.f && c.f.learn_full === true) || !u || typeof u.getIdToken !== 'function') return later(20000);   // הדגל/החיבור עוד בדרך
  const wait = _devErr.t + 15000 - Date.now();
  if (wait > 0) return later(wait);
  const errs = _devErr.q.splice(0, 20).map((x) => { const o = Object.assign({}, x); delete o._k; return o; });
  _devErr.t = Date.now(); _devErr.busy = true;
  const pl = { app: _devErr.app, ver: typeof APP_VERSION !== 'undefined' ? APP_VERSION : '', ua: String(navigator.userAgent || '').slice(0, 200), errs };
  (typeof window !== 'undefined' && window.snbIdToken ? window.snbIdToken(u) : u.getIdToken()).then((tk) => fetch(ibkrProxyBase() + '/api/studio', { method: 'POST', headers: ibkrProxyHeaders(), keepalive: true, body: JSON.stringify(Object.assign({ op: 'devErr', idToken: tk }, pl)) }))
    .catch(() => {}).then(() => { _devErr.busy = false; if (_devErr.q.length) devErrFlush(); });
}
devErrWire();
function maintPaint(c) {
  if (typeof document === 'undefined' || !document.body) return;
  let el = document.querySelector('.maint-strip');
  const m = c && c.m;
  if (!(m && m.on && !(m.til && Date.now() > m.til))) { if (el) el.remove(); return; }
  if (!el) { el = document.createElement('div'); el.className = 'maint-strip'; el.setAttribute('role', 'status'); document.body.prepend(el); }
  el.classList.toggle('env-up', !!document.querySelector('.env-strip'));   // בסביבת הניסוי — מעל הפס שלה
  el.textContent = t('maintBar') + (m.msg ? ' · ' + m.msg : '');
}
let _sysCfgWired = false;
function sysCfgBoot() {
  newsIdleWire();
  maintPaint(sysCfgCached());
  if (typeof fetch !== 'function') return;
  const go = () => fetch(ibkrProxyBase() + '/api/studio', { method: 'POST', headers: ibkrProxyHeaders(), body: JSON.stringify({ op: 'cfg' }) })
    .then((r) => r.json()).then((j) => {
      if (!j || !j.ok || !j.cfg) return;
      _sysCfg = j.cfg;
      try { localStorage.setItem(LS_SYSCFG, JSON.stringify(j.cfg)); } catch (e) {}
      maintPaint(j.cfg);
      setTimeout(() => newsWhenIdle(j.cfg), 1800);   // אחרי שהדף נפתח — לא מעל מסך הפתיחה, ולא באמצע ניווט
    }).catch(() => {});
  go();
  if (!_sysCfgWired && typeof document !== 'undefined') { _sysCfgWired = true; document.addEventListener('visibilitychange', () => { if (!document.hidden) go(); }); }
}
/* 15/10/2026 (מרכז הניהול ← משוב ופניות, בקשת המשתמש): שורת "שליחת משוב" בהגדרות של שלוש האפליקציות → חלון קטן:
   סוג (בעיה / רעיון / אחר) + טקסט. נשלח ל־op:'fbSend' (כל משתמש מחובר), יחד עם האפליקציה והגרסה; המנהל רואה במרכז הניהול */
const appName = () => (typeof document !== 'undefined' && document.documentElement && document.documentElement.dataset.app) || 'invest';
async function fbIdToken() {
  try {
    const A = typeof window !== 'undefined' && window.SnbAuth;
    const u = A && A.user ? A.user() : (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length && firebase.auth().currentUser);
    return u ? (typeof window !== 'undefined' && window.snbIdToken ? await window.snbIdToken(u) : await u.getIdToken()) : '';   // גל 3: snbIdToken (cloud.js)
  } catch (e) { return ''; }
}
function feedbackOpen() {
  if (typeof document === 'undefined') return;
  const box = document.createElement('div'); box.className = 'fb-form';
  const seg = document.createElement('div'); seg.className = 'fb-seg';
  let kind = 'bug';
  const K = [['bug', t('fbKBug')], ['idea', t('fbKIdea')], ['other', t('fbKOther')]];
  const paint = () => [...seg.children].forEach((b, i) => b.setAttribute('aria-pressed', K[i][0] === kind ? 'true' : 'false'));
  for (const [k, lbl] of K) { const b = document.createElement('button'); b.type = 'button'; b.className = 'mini-btn'; b.textContent = lbl; b.addEventListener('click', () => { kind = k; paint(); }); seg.appendChild(b); }
  paint();
  const ta = document.createElement('textarea'); ta.className = 'fb-in'; ta.rows = 4; ta.maxLength = 1000; ta.setAttribute('dir', 'auto'); ta.placeholder = t('fbPh'); ta.setAttribute('aria-label', t('fbPh'));
  const meta = document.createElement('p'); meta.className = 'fb-meta';
  meta.textContent = t('fbMeta').replace('{a}', appName().replace(/^./, (c) => c.toUpperCase())).replace('{v}', (typeof APP_RELEASE !== 'undefined' ? APP_RELEASE : '') + ' (' + String(typeof APP_VERSION !== 'undefined' ? APP_VERSION : '').replace(/^v/, '') + ')');
  box.append(seg, ta, meta);
  askConfirm(t('fbTitle'), async () => {
    const tk = await fbIdToken();
    if (!tk) { askAlert(t('fbSignIn')); return; }
    try {
      const body = { op: 'fbSend', idToken: tk, k: kind, t: ta.value, app: appName(), ver: typeof APP_VERSION !== 'undefined' ? APP_VERSION : '', ua: String(navigator.userAgent || '').slice(0, 200) };
      const r = await fetch(ibkrProxyBase() + '/api/studio', { method: 'POST', headers: ibkrProxyHeaders(), body: JSON.stringify(Object.assign({ op: 'fbSend' }, body)) });
      const j = await r.json().catch(() => null);
      flash(j && j.ok ? t('fbThanks') : t('fbErr'));
    } catch (e) { flash(t('fbErr')); }
  }, { body: box, ok: t('fbSend'), onOpen: (ok) => {
    ok.disabled = true;
    ta.addEventListener('input', () => { ok.disabled = ta.value.trim().length < 3; });
    setTimeout(() => { try { ta.focus({ preventScroll: true }); } catch (e) {} }, 60);
  } });
}
/* השורה בהגדרות — אותו מבנה של "אפשרויות מתקדמות" (.row-link). ב־Invest בתוך #advancedCard (index.html), ב־Academy/Studio ב־advancedRow */
const FB_IC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
/* 15/10/2026 (מרכז הניהול ← הודעות): ההודעה שהמנהל כתב (cfg.an — פעם אחת בכל מכשיר לכל הודעה), ואחריה "מה חדש" אחרי שחרור לייצור:
   השורות של הגרסה מ־CHANGELOG.md (מתפרסם עם האתר) — פעם אחת לכל גרסה, לא בהתקנה ראשונה. בלי חלון בזמן שחלון אחר פתוח */
const LS_ANSEEN = 'pwa_anseen_v1', LS_RELSEEN = 'pwa_relseen_v1';
let _newsBusy = false;
function changelogItems(md, rel) {
  const lines = String(md || '').split('\n');
  const i = lines.findIndex((l) => l.startsWith('## ' + rel + ' '));
  if (i < 0) return [];
  const out = [];
  for (let k = i + 1; k < lines.length && !lines[k].startsWith('## '); k++) {
    const m = /^- (.+)/.exec(lines[k]);
    if (!m) continue;
    let x = m[1].replace(/\*\*/g, '').replace(/`/g, '').trim();
    const cut = [' — ', ' ('].map((d) => x.indexOf(d)).filter((i) => i > 8).sort((a, b) => a - b)[0];   // רק הכותרת של השורה
    if (cut) x = x.slice(0, cut);
    out.push(x.length > 90 ? x.slice(0, 88).trim() + '…' : x);
  }
  return out.slice(0, 5);
}
/* 29/10/2026 (סרטון המשתמש, Academy — ס5 בתוכנית "עמודים סטטיים"): "מה חדש" קפץ 0.3 שנ׳ אחרי החלקה בין עמודים, באמצע הניווט.
   עכשיו החלון מחכה לשקט: 2.5 שנ׳ בלי נגיעה, גלילה או מעבר (קובייה / חוגה) — ורק אז מוצג */
const NEWS_IDLE_MS = 2500;
let _newsTouch = 0;
function newsIdleWire() {               // מהפתיחה — גם נגיעה שלפני שההגדרות הגיעו נספרת
  if (newsIdleWire.on || typeof document === 'undefined' || !document.addEventListener) return;
  newsIdleWire.on = true;
  const mark = () => { _newsTouch = Date.now(); };
  ['pointerdown', 'touchstart', 'wheel', 'keydown', 'scroll'].forEach((ev) => document.addEventListener(ev, mark, { passive: true, capture: true }));
}
function newsWhenIdle(c) {
  if (typeof document === 'undefined' || !document.addEventListener) return newsShow(c);
  newsIdleWire();
  const wait = _newsTouch ? _newsTouch + NEWS_IDLE_MS - Date.now() : 0;
  if (wait > 0 || (typeof cubeNow !== 'undefined' && cubeNow) || (typeof _dial !== 'undefined' && (_dial.drag || _dial.ride))) return setTimeout(() => newsWhenIdle(c), Math.max(300, wait));
  newsShow(c);
}
function newsShow(c) {
  if (_newsBusy || typeof document === 'undefined' || document.hidden || document.querySelector('.dlg-veil')) return;
  const app = appName();
  if (!['invest', 'academy', 'studio'].includes(app)) return;
  const get = (k) => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
  const set = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const an = c && c.an;
  if (an && an.apps && an.apps.includes(app) && get(LS_ANSEEN) !== String(an.id)) {
    _newsBusy = true; set(LS_ANSEEN, String(an.id));
    askAlert([an.t, an.b].filter(Boolean).join('\n\n'), () => { _newsBusy = false; setTimeout(() => newsWhenIdle(c), 400); });
    return;
  }
  const rel = typeof APP_RELEASE !== 'undefined' ? APP_RELEASE : '';
  const seen = get(LS_RELSEEN);
  if (!rel || seen === rel) return;
  set(LS_RELSEEN, rel);
  if (!seen || getLang() !== 'he' || typeof fetch !== 'function') return;   // התקנה ראשונה — בלי "מה חדש"; הרשימה בעברית בלבד
  _newsBusy = true;
  fetch('CHANGELOG.md', { cache: 'no-store' }).then((r) => (r.ok ? r.text() : '')).then((md) => {
    const items = changelogItems(md, rel);
    if (!items.length || document.querySelector('.dlg-veil')) { _newsBusy = false; return; }
    askAlert(t('newsT').replace('{v}', rel) + '\n\n' + items.map((x) => '• ' + x).join('\n'), () => { _newsBusy = false; });
  }).catch(() => { _newsBusy = false; });
}

/* ת־פס — הזוהר מגיב לקצב ההתקדמות (10/11/2026, בקשת המשתמש: "שהאפקט יותאם לקצב ההתקדמות של הבאר").
   דוגם את רוחב המילוי (style.width) של פסי הטעינה פעם בחצי שנייה, מחשב קצב (אחוזים לשנייה, ממוצע נע),
   וכותב --cmt-v (0–1) על המסילה: מהר = זוהר ארוך, חזק ונושם מהר; לאט / תקוע = קצר, עמום ונושם לאט.
   הנגן (st-pl-track) לא נדגם — נשאר בדיוק כמו בסרטון (--cmt-v ברירת מחדל .5 = המראה של הסרטון).
   פסים עומדים (התקדמות קריאה) ופס בלי אחוז (.ind) — לא נדגמים. בלי פסים בדף — הלולאה לא עושה כלום. */
const CMT_TRACKS = ['demo-prog-bar', 'ip-bar', 'lib-bar', 'st-tprog', 'st-pbar', 'st-ut-bar', 'adm-lbar'];
/* קצב (אחוזים לשנייה) → 0–1, בסולם לוגריתמי: 0.05%/ש' ≈ תקוע, 1%/ש' ≈ באמצע, 10%/ש' ומעלה = מלא. פונקציה טהורה, נבדקת. */
function cmtSpeed(rate) {
  if (!(rate > 0)) return 0.08;
  return Math.max(0.08, Math.min(1, (Math.log10(rate) + 1.3) / 2.3));
}
/* צעד דגימה לפס אחד (טהור, נבדק): st = { w, t, ch, r } — רוחב אחרון, זמן הדגימה, זמן השינוי האחרון, קצב ממוצע.
   מחזיר את המצב החדש ואת v (או null — עוד אין מספיק מידע). */
function cmtStep(st, w, now) {
  if (!st || w < st.w - 0.5) return { s: { w, t: now, ch: now, r: 0 }, v: null };   // פס חדש / התחיל מחדש
  const s = { w: st.w, t: now, ch: st.ch, r: st.r };
  if (w > st.w + 0.05) {
    const dt = Math.max(0.25, (now - st.ch) / 1000), inst = (w - st.w) / dt;
    s.r = st.r ? st.r * 0.6 + inst * 0.4 : inst; s.w = w; s.ch = now;
  } else if (now - st.ch > 8000) s.r = st.r * 0.85;   // תקוע — הקצב דועך, והזוהר איתו
  if (!s.r) return { s, v: null };
  return { s, v: w >= 99.5 ? 0.5 : cmtSpeed(s.r) };
}
if (typeof window !== 'undefined' && typeof document !== 'undefined' && document.getElementsByClassName && typeof setInterval === 'function') {
  const cols = CMT_TRACKS.map((c) => document.getElementsByClassName(c));   // אוספים חיים — זול, בלי querySelectorAll בכל דגימה
  const mem = new WeakMap();
  const tick = () => {
    if (document.hidden) return;
    const now = Date.now();
    for (const col of cols) for (let i = 0; i < col.length; i++) {
      const tr = col[i], f = tr.firstElementChild;
      if (!f || tr.classList.contains('ind') || tr.closest('.lib-cont, .ac-progress')) continue;
      const w = parseFloat(f.style.width);
      if (!(w >= 0)) continue;
      const r = cmtStep(mem.get(tr), w, now);
      mem.set(tr, r.s);
      if (r.v == null) continue;
      const old = parseFloat(tr.style.getPropertyValue('--cmt-v'));
      if (!(Math.abs(old - r.v) < 0.03)) tr.style.setProperty('--cmt-v', r.v.toFixed(2));
      const tempo = r.v < 0.3 ? 'slow' : r.v > 0.75 ? 'fast' : '';
      if ((tr.dataset.cmt || '') !== tempo) { if (tempo) tr.dataset.cmt = tempo; else delete tr.dataset.cmt; }
    }
  };
  const iv = setInterval(tick, 500);
  if (iv && iv.unref) iv.unref();
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
  if (o.body) box.appendChild(o.body);   // 15/10/2026: תוכן נוסף בחלון (טופס המשוב)
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
  if (o.onOpen) o.onOpen(ok);
  else setTimeout(() => { try { ok.focus({ preventScroll: true }); } catch (e) {} }, 30);
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
const APP_RELEASE = '2.142.4';
const APP_VERSION = 'v757';
/* "1.0.0 (395)"; בסביבת הניסוי — גם "· ניסוי" */
function appVersionLabel() {
  const build = String(APP_VERSION).replace(/^v/, '');
  const st = typeof window !== 'undefined' && window.SNB_ENV && window.SNB_ENV.name === 'staging';
  return APP_RELEASE + ' (' + build + ')' + (st ? ' · ' + t('envStaging') : '');
}

const LS_OWNER = 'pwa_owner_v1', LS_STASH = 'pwa_stash_v1:', LS_LEGACY_OWNER = 'pwa_legacy_owner_v1';
const ACCOUNT_KEYS = ['pwa_libstats_v1', 'pwa_aton_v1', 'pwa_libq_v1', 'pwa_libauth_v1', 'pwa_db_v1', 'pwa_ibkr_v1', 'pwa_predemo_v1', 'pwa_wlactive_v1', 'pwa_srcfilter_v1', 'pwa_tdkey_v1', 'pwa_libbk_v1', 'pwa_libcoll_v1', 'pwa_studio_v1', 'pwa_pfbk_v1', 'pwa_charts_v1', 'pwa_accprof_v1', 'pwa_tax_v1', 'pwa_libpace_v1', 'pwa_stthumb_v1', 'pwa_libfeeds_v1', 'pwa_libsent_v1', 'pwa_udfb_v1', 'pwa_accreg_v1', 'pwa_pwset_v1'];   // v318: גיבוי הספרייה הפרטית · v320: אסופות הספרייה · v354: טיוטות הסטודיו · 14/10/2026: גיבוי Invest ל־Drive · 29/10/2026: פרטי החשבון לציור הראשון · 01/11/2026: הגדרות מרכז המס (הכנסה אחרת, הפסד מועבר) · 01/11/2026: קצב הקריאה (Academy) · 02/11/2026: התמונות שבראש הבית של Studio — לציור הראשון (סבב קפיצות 9) · 03/11/2026: המקורות של עיתון הבוקר ומה שנשלח למכשיר אחר (Academy Pro גל 6) · 06/11/2026: מה נכתב ישירות ב־Firestore כשהשרת לא היה זמין (שלב 4, cloud.js udCall) · 07/11/2026: הרישום השקט היומי והסיסמה אצלנו (שלב 2 גל 2, cloud.js accDaily/pwSetOnce)
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

/* ---- החוגה (29/10/2026, Invest ואז Studio — אותו מנוע, רק הצבע של האפליקציה) ----
   הפריטים יושבים על קשת (DIAL_DROP); הפעיל במרכז וגדל לבועה עם הכיתוב, והשאר עיגולים עם סמל וכיתוב מתחת. המצב = {pos, from, to, p}:
   pos — איזה פריט במרכז (שבר = באמצע תנועה), ו"פעילות" שעוברת בהצלבה מ־from ל־to לפי p (הבועה הישנה מתכווצת והחדשה גדלה יחד).
   במעבר עמודים החוגה זזה באותו קפיץ ובאותו זמן התחלה של הקובייה (dialCubeRun → dialAnimate, WAAPI — רץ גם כשהעמוד החדש נצבע),
   ובגרירה של העמוד — צמודה לאצבע (dialCube). גרירה של החוגה עצמה מעבירה גם את העמודים (dialRide*).
   המארח (dialHost) = האפליקציה: {nav(), keys(), index(name), cur(), begin(cur, to, side), drop(c), land(c), instant(to)} —
   begin מחזיר "קובייה" {in, out, to, ...} שהמנוע מזיז ב־cubeSet. אחד בכל רגע (Studio מעל Invest — שלה). */
const DIAL_S0 = 0.72, DIAL_DROP = 2.7, DIAL_GAP = 14;   // DIAL_GAP: מרווח נוסף בין הבועה לשכנים — שלא ייגעו במסך צר (בקשת המשתמש)
const _dial = { st: null, run: null, drag: null, ride: null, ret: 0, noClick: 0, els: null, ek: '', host: null };
function dialHost(hst) {
  if (_dial.host === hst) return;
  dialStop();
  if (_dial.ride && _dial.ride.finish) _dial.ride.finish();
  _dial.host = hst; _dial.els = null; _dial.ek = ''; _dial.st = null; _dial.ride = null; _dial.drag = null;
  if (typeof deskSoon === 'function') deskSoon();   // תצוגת מחשב: הפריטים בסרגל הצד = של המארח החדש
}
function dialKeys() { return (_dial.host && _dial.host.keys()) || []; }
function dialIndex(name) { return _dial.host ? _dial.host.index(name) : 0; }
function dialCurName() { return _dial.host ? _dial.host.cur() : ''; }
function dialStep(vw, n) {   // המרחק בין פריטים — כל השבעה על המסך, הקצוות חצי־גלויים (כמו בסרטון); ארבעה (Studio, Academy) — מרווחים יותר, הכיתובים לא נוגעים
  /* 03/11/2026 (סבב קפיצות 12, qa-deep): ב־Academy (שלושה) הכיתובים "THE SNOWBALL" ו"הספרייה שלי" חפפו — 9px ב־390, 16px ב־360.
     עד שלושה — יש מקום: מרווחים יותר (הפריט הרחוק בקצה חצי־גלוי, כמו ב־Invest) */
  if (n && n <= 3) return Math.max(66, Math.min(104, (vw || 400) / 3.75));
  return n && n <= 5 ? Math.max(66, Math.min(96, (vw || 400) / 4.8)) : Math.max(59, Math.min(90, (vw || 400) / 6.2 - 4));
}
function dialRest(i) { return { pos: i, from: i, to: i, p: 0 }; }
function dialMax() { return Math.max(0, dialKeys().length - 1); }
/* טהורה (נבדקת): הערכים של כל פריט במצב st — מיקום על הקשת, גודל העיגול, ושקיפות הסמל / הבועה / הכיתוב */
function dialFrame(st, n, vw, rtl) {
  const S = dialStep(vw, n), out = [], c01 = (x) => Math.max(0, Math.min(1, x)), f = (x) => Math.round(x * 100) / 100 || 0;
  for (let i = 0; i < n; i++) {
    const d = i - st.pos, ad = Math.abs(d);
    const a = c01(st.from === st.to ? (i === st.from ? 1 : 0) : (i === st.from ? 1 - st.p : 0) + (i === st.to ? st.p : 0));
    const e = a * a * (3 - 2 * a);                         // smoothstep — ההצלבה רכה בשני הקצוות
    const o = c01((3.6 - ad) / 0.6);                       // מעבר לשבעה — נמוגים (בגרירה)
    const x = (rtl ? -1 : 1) * (d * S + (n > 5 ? Math.max(-1, Math.min(1, d)) * DIAL_GAP : 0)), y = DIAL_DROP * d * d - 4 * e, sc = 1 - 0.045 * Math.min(ad, 3);
    out.push({
      it: 'translate3d(' + f(x) + 'px, ' + f(y) + 'px, 0) scale(' + f(sc) + ')', o: f(o),
      // 29/10/2026 (סרטון המשתמש, Academy): באמצע ההצלבה (e≈0.5) הסמל כבר נמוג (0.15) והבועה עוד לא (0.23) — שני עיגולים כחולים
      // ריקים בזמן הקובייה. עכשיו הבועה נכנסת מוקדם יותר (0.2→0.6) והסמל יוצא מאוחר יותר (0.3→0.65): בכל רגע אחד מהם גלוי
      disc: 'scale(' + f(DIAL_S0 + (1 - DIAL_S0) * e) + ')', glow: f(e), ico: f(c01((0.65 - e) / 0.35)),
      bub: f(c01((e - 0.2) / 0.4)), bs: 'scale(' + f(0.82 + 0.18 * e) + ')',
      // 29/10/2026 (סרטון המשתמש, Academy): בחוגה של ארבעה, כשהנבחר בקצה, הכיתובים של הפריטים במרחק 2 חפפו ("הספרייה שלי" ו־"THE SNOWBALL")
      // ונחתכו בשולי המסך. בחוגה קטנה (עד 4) — כיתוב רק עד מרחק 1.5 מהנבחר, ונמוג עד 2; ב־Invest (7) — כמו קודם
      // 30/10/2026 (בקשת המשתמש): גם מתחת לפריט הפעיל — הכיתוב שלו ("קריוקי", "תרגום סרטונים"), לא רק סמל בבועה
      // 10/11/2026: Studio עם הניתוח — חמישה פריטים, אותו כלל (במרחק 2 הם בקצה המסך)
      lbl: f(n <= 5 ? c01((2 - ad) / 0.5) : 1),
    });
  }
  return out;
}
function dialEls() {
  const keys = dialKeys(), ek = keys.join();
  if (_dial.els && _dial.ek === ek && _dial.els.length && _dial.els[0].it.isConnected) return _dial.els;
  const nav = typeof document !== 'undefined' && _dial.host && _dial.host.nav();
  if (!nav) return [];
  _dial.ek = ek;
  _dial.els = keys.map((k) => nav.querySelector('.tab[data-tab="' + k + '"]')).filter(Boolean).map((it) => ({
    it, disc: it.querySelector('.tab-disc'), glow: it.querySelector('.tab-glow'), ico: it.querySelector('.tab-ico'), bub: it.querySelector('.tab-bub'), lbl: it.querySelector('.tab-lbl'),
  }));
  return _dial.els;
}
function dialRtl() { return String((document.documentElement && document.documentElement.dir) || 'ltr') === 'rtl'; }
function dialPaint(st) {
  const els = dialEls();
  _dial.st = st;
  if (_desk.side) deskSync();                 // תצוגת מחשב: ההדגשה בסרגל הצד
  if (!els.length) return;
  const fr = dialFrame(st, els.length, window.innerWidth, dialRtl());
  els.forEach((e, i) => {
    const v = fr[i];
    e.it.style.transform = v.it; e.it.style.opacity = v.o; e.it.style.pointerEvents = v.o < 0.3 ? 'none' : '';
    if (e.disc) e.disc.style.transform = v.disc;
    if (e.glow) e.glow.style.opacity = v.glow;
    if (e.ico) e.ico.style.opacity = v.ico;
    if (e.bub) { e.bub.style.opacity = v.bub; e.bub.style.transform = v.bs; }
    if (e.lbl) e.lbl.style.opacity = v.lbl;
  });
}
/* states = מצב לכל 1/CUBE_HZ שנ׳ (כמו הקובייה). o.to = הלשונית שאליה נוסעים (null — גלילה חופשית), o.cube = הקובייה שזה חלק ממנה */
function dialAnimate(states, o) {
  dialStop();
  const els = dialEls(), last = states[states.length - 1];
  if (!els.length || states.length < 2 || typeof els[0].it.animate !== 'function') return dialPaint(last);
  const frs = states.map((st) => dialFrame(st, els.length, window.innerWidth, dialRtl()));
  const dur = (states.length - 1) * 1000 / CUBE_HZ, anims = [];
  const go = (el, kf) => {
    if (!el) return;
    const k0 = JSON.stringify(kf[0]);
    if (kf.every((k) => JSON.stringify(k) === k0)) return;    // לא משתנה — בלי אנימציה
    try { anims.push(el.animate(kf, { duration: dur, easing: 'linear', fill: 'forwards' })); } catch (e) {}
  };
  els.forEach((e, i) => {
    const kf = (fn) => frs.map((fr) => fn(fr[i]));
    e.it.style.pointerEvents = '';
    go(e.it, kf((v) => ({ transform: v.it, opacity: v.o })));
    go(e.disc, kf((v) => ({ transform: v.disc })));
    go(e.glow, kf((v) => ({ opacity: v.glow })));
    go(e.ico, kf((v) => ({ opacity: v.ico })));
    go(e.bub, kf((v) => ({ transform: v.bs, opacity: v.bub })));
    go(e.lbl, kf((v) => ({ opacity: v.lbl })));
  });
  _dial.st = last;
  if (!anims.length) return dialPaint(last);
  // כמו cubeRun: זמן ההתחלה = הפריים הנוכחי כשהוא טרי — אותו רגע בדיוק של הקובייה שנוצרה באותה משימה
  try {
    const t0 = document.timeline && document.timeline.currentTime;
    if (t0 != null && typeof performance !== 'undefined' && performance.now() - t0 < 40) anims.forEach((a) => { a.startTime = t0; });
  } catch (e) {}
  const run = { states, anims, to: o && o.to != null ? o.to : null, cube: (o && o.cube) || null, zap: !!(o && o.zap) };
  _dial.run = run;
  Promise.all(anims.map((a) => a.finished)).then(() => dialEnd(run), () => {});
}
function dialEnd(run) {   // סוף (או סיום מיידי): המצב הסופי ב־style לפני שהאנימציות יורדות — בלי פריים באמצע
  if (!run || _dial.run !== run) return;
  _dial.run = null;
  dialPaint(run.states[run.states.length - 1]);
  run.anims.forEach((a) => { try { a.cancel(); } catch (e) {} });
  if (run.zap && run.to != null) dialZap(run.to);
}
function dialStop() {     // עוצרים באמצע — החוגה נשארת איפה שהיא נראית עכשיו
  const run = _dial.run;
  if (!run) return;
  _dial.run = null;
  let i = 0;
  try { const ct = run.anims[0] && run.anims[0].currentTime; if (ct != null) i = Math.round(ct * CUBE_HZ / 1000); } catch (e) {}
  dialPaint(run.states[Math.max(0, Math.min(run.states.length - 1, i))]);
  run.anims.forEach((a) => { try { a.cancel(); } catch (e) {} });
}
function dialZap(i) {     // נחיתה על לשונית חדשה: "נשימה" רכה של הבועה, פעם אחת (בלי גל)
  const e = dialEls()[i];
  if (!e || cubeReduce()) return;
  e.it.classList.remove('zap'); void e.it.offsetWidth; e.it.classList.add('zap');
  clearTimeout(e.zt); e.zt = setTimeout(() => e.it.classList.remove('zap'), 600);
}
function dialGo(i, v0) {  // מעבר בלי קובייה (או חזרה למרכז) — אותו קפיץ
  dialStop();
  clearTimeout(_dial.ret);
  const s = _dial.st || dialRest(i), ai = s.p >= 0.5 ? s.to : s.from;
  const ps = cubeSpring(0, v0 || 0, 1);
  dialAnimate(ps.map((p) => ({ pos: s.pos + (i - s.pos) * p, from: ai, to: i, p: ai === i ? 0 : p })), { to: i, zap: ai !== i });
}
/* מצב הלשוניות אחרי מעבר / שינוי גודל / שפה. מעבר בקובייה כבר מניע את החוגה (run.to) — לא נוגעים */
function dialSync(instant, name) {   // name — הלשונית החדשה (ב־switchTab העמוד הפעיל עוד לא התחלף)
  if (typeof document === 'undefined' || !dialEls().length) return;
  const i = dialIndex(name || dialCurName());
  if (_dial.drag || _dial.ride || (_dial.run && _dial.run.to === i)) return;
  const s = _dial.st;
  if (instant || !s || document.documentElement.classList.contains('booting') || cubeReduce() || document.hidden) { dialStop(); clearTimeout(_dial.ret); return dialPaint(dialRest(i)); }
  if (!_dial.run && s.pos === i && s.from === i && s.to === i) return dialPaint(s);   // רוחב/שפה — מחשבים מחדש באותו מקום
  dialGo(i);
}
/* הקובייה של מעבר עמודים — מאיפה החוגה מתחילה ולאן; dialCubeState = המצב שמתאים לזווית p של הקובייה */
function dialCubeBegin(c, cur, to, side) {
  dialStop();
  clearTimeout(_dial.ret);
  const from = dialIndex(cur), s = _dial.st || dialRest(from), fwd = (side === 1) !== dialRtl();
  c.dial = { pos0: s.pos, from, to: to ? dialIndex(to) : null, dir: fwd ? 1 : -1 };
}
function dialCubeState(c, p) {
  const d = c.dial;
  if (d.to == null) return { pos: d.pos0 + d.dir * Math.min(CUBE_RUB, p) * 2.4, from: d.from, to: d.from, p: 0 };   // "קפיץ" — נמשכת מעט ונהדפת
  return { pos: d.pos0 + (d.to - d.pos0) * p, from: d.from, to: d.to, p };
}
function dialCube(c) { if (c && c.dial) dialPaint(dialCubeState(c, c.p || 0)); }
function dialCubeRun(c, p1, v0) {
  if (!c || !c.dial) return;
  const ps = cubeSpring(c.p || 0, v0 || 0, p1), land = p1 === 1 && c.dial.to != null;   // בדיוק הסדרה של cubeRun
  dialAnimate(ps.map((p) => dialCubeState(c, p)), { to: land ? c.dial.to : c.dial.from, cube: c, zap: land && c.dial.to !== c.dial.from });
}
function dialCubeDone(c) { if (_dial.run && _dial.run.cube === c) dialEnd(_dial.run); }
function dialRubber(pos, max) {   // מעבר לקצה — נמשכת בהתנגדות
  const over = pos < 0 ? pos : pos > max ? pos - max : 0;
  return over ? (pos < 0 ? 0 : max) + over * 0.55 / (1 + Math.abs(over) * 1.4) : pos;
}
/* 29/10/2026 (סרטון המשתמש): גרירת החוגה מעבירה גם את העמודים — מה שבמרכז נבחר תוך כדי, והקובייה צמודה למיקום החוגה.
   העמוד הנוכחי = k; הקובייה (המארח: begin) מולו אל השכן בכיוון של pos, בזווית |pos − k|. הגיע לשכן (זווית מלאה) — הוא נעשה
   הנוכחי (land, כמו סוף קובייה) והנסיעה ממשיכה ממנו. אחרי השחרור — אותו קפיץ של הקובייה (rAF: הפאות מתחלפות באמצע) */
function dialRidePaint(r, pos) {
  const max = dialMax(), cp = Math.max(0, Math.min(max, pos)), a = Math.floor(cp);
  dialPaint({ pos, from: a, to: Math.min(max, a + 1), p: cp - a });
  if (r) dialRideCube(r, pos);
}
function dialRideCube(r, pos) {
  const hst = _dial.host;
  for (let n = 0; n < 8 && hst; n++) {
    const name = hst.cur(), k = dialIndex(name), d = pos - k, dir = d > 0.001 ? 1 : d < -0.001 ? -1 : 0;
    if (r.c && r.dir !== dir) { const c = r.c; r.c = null; hst.drop(c); }
    if (!dir) return;
    const to = dialKeys()[k + dir] || null;
    if (!r.c) {
      const c = hst.begin(name, to, cubeSideFwd(dir > 0));
      if (!c) {                          // בלי קובייה (תנועה מופחתת) — מתחלף בחצי הדרך
        if (to && Math.abs(d) >= 0.5) { hst.instant(to); continue; }
        return;
      }
      r.c = c; r.dir = dir;
    }
    const p = Math.abs(d);
    if (!to) return cubeSet(r.c, Math.min(1, p) * 0.18);   // קצה — "קפיץ" קטן
    if (p < 1) return cubeSet(r.c, p);
    const c = r.c; r.c = null;
    hst.land(c);
  }
}
function dialRideRun(r, xs) {   // xs = מיקום החוגה בכל 1/CUBE_HZ שנ׳
  const t0 = performance.now(), last = xs[xs.length - 1];
  const step = () => {
    if (_dial.ride !== r) return;
    const i = Math.min(xs.length - 1, Math.round((performance.now() - t0) * CUBE_HZ / 1000));
    dialRidePaint(r, xs[i]);
    if (i < xs.length - 1) r.raf = requestAnimationFrame(step); else dialRideEnd(r);
  };
  r.finish = () => { cancelAnimationFrame(r.raf); if (_dial.ride === r) { dialRidePaint(r, last); dialRideEnd(r); } };
  cubeNow = r;   // נגיעה בעמוד / מעבר אחר — מסיימים מיד
  r.raf = requestAnimationFrame(step);
}
function dialRideEnd(r) {
  if (_dial.ride !== r) return;
  _dial.ride = null;
  if (cubeNow === r) cubeNow = null;
  if (r.c && _dial.host) { const c = r.c; r.c = null; _dial.host.drop(c); }
  const k = dialIndex(dialCurName());
  dialPaint(dialRest(k));
  if (k !== r.k0) dialZap(k);
}
/* הגרירה של החוגה עצמה (על ה־nav של המארח; פעם אחת לכל nav) */
function wireDial(nav) {
  if (!nav || nav._dial) return;
  nav._dial = true;
  const clock = () => ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now());
  let g = null;
  nav.addEventListener('touchstart', (e) => {
    g = null;
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    g = { x0: t.clientX, y0: t.clientY, lock: 0, samples: [[clock(), t.clientX]] };
  }, { passive: true });
  nav.addEventListener('touchmove', (e) => {
    if (!g) return;
    const t = e.touches[0], dx = t.clientX - g.x0;
    if (!g.lock) {
      if (Math.abs(dx) < 8) return;
      if (cubeNow && cubeNow.finish) cubeNow.finish();   // קובייה / נסיעה קודמת — נוחתת מיד, והחוגה איתה
      dialStop(); clearTimeout(_dial.ret);
      const s = _dial.st || dialRest(dialIndex(dialCurName()));
      Object.assign(g, { lock: 1, x0: t.clientX, pos0: s.pos, tick: Math.round(s.pos) });
      _dial.drag = g;
      _dial.ride = { c: null, dir: 0, k0: dialIndex(dialCurName()) };
    }
    if (e.cancelable) e.preventDefault();
    const now = clock();
    g.samples.push([now, t.clientX]);
    while (g.samples.length > 2 && now - g.samples[0][0] > 150) g.samples.shift();
    const max = dialMax(), pos = dialRubber(g.pos0 + (dialRtl() ? 1 : -1) * (t.clientX - g.x0) / dialStep(window.innerWidth, max + 1), max);
    dialRidePaint(_dial.ride, pos);
    const k = Math.round(pos);
    if (k !== g.tick && k >= 0 && k <= max) { g.tick = k; try { navigator.vibrate && navigator.vibrate(4); } catch (err) {} }   // "קליק" של חוגה בכל פריט
  }, { passive: false });
  const end = (e, cancelled) => {
    const s = g; g = null;
    if (!s || !s.lock) return;
    _dial.drag = null;
    _dial.noClick = clock();
    const r = _dial.ride, st = _dial.st, max = dialMax(), S = dialStep(window.innerWidth, max + 1);
    if (!r) return;
    const vi = cancelled ? 0 : swipeVelocity(s.samples, clock()) * 1000 / S * (dialRtl() ? 1 : -1);   // פריטים לשנייה
    const near = Math.max(0, Math.min(max, Math.round(st.pos)));
    const to = Math.max(0, Math.min(max, Math.max(near - 1, Math.min(near + 1, Math.round(st.pos + vi * 0.2))))), span = to - st.pos;
    const ps = cubeSpring(0, Math.abs(span) > 0.02 ? vi / span : 0, 1);
    dialRideRun(r, ps.map((p, i) => (i === ps.length - 1 ? to : st.pos + span * p)));
  };
  nav.addEventListener('touchend', (e) => end(e, false), { passive: true });
  nav.addEventListener('touchcancel', (e) => end(e, true), { passive: true });
  nav.addEventListener('click', (e) => { if (clock() - _dial.noClick < 400) { e.stopPropagation(); e.preventDefault(); } }, true);   // סוף גרירה אינו לחיצה
}
/* החוגה של אפליקציה שבונה אותה בקוד (Studio, Academy) — אותו מבנה בדיוק כמו ב־index.html, ורק הצבע (--primary) של האפליקציה.
   items = [{k, ico (תוכן SVG קבוע), lbl, bub?, cls?}] — bub: בבועה סמל גדול במקום הכיתוב (פתית השלג של Academy); onTap(k) — לחיצה על פריט */
const DIAL_GEAR = '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>';
/* 29/10/2026 (בקשת המשתמש): בבועה של הנבחר — רק הסמל, בלבן (כמו הפתית); it.bub = סמל אחר לבועה (הפתית המפורט) */
function dialNavBuild(cls, aria, items, onTap) {
  const nav = document.createElement('nav');
  nav.className = 'tabs ' + cls; nav.setAttribute('role', 'tablist'); nav.setAttribute('aria-label', aria);
  items.forEach((it) => {
    const b = document.createElement('button');
    b.className = 'tab' + (it.cls ? ' ' + it.cls : ''); b.type = 'button'; b.dataset.tab = it.k; b.setAttribute('role', 'tab');
    b.innerHTML = '<span class="tab-disc"><span class="tab-glow"></span><svg class="tab-ico" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + it.ico + '</svg></span><span class="tab-bub" aria-hidden="true">'
      + '<svg class="tab-bub-ico" viewBox="0 0 24 24" fill="none" stroke-width="' + (it.bub ? 1.6 : 2) + '" stroke-linecap="round" stroke-linejoin="round">' + (it.bub || it.ico) + '</svg></span><span class="tab-lbl"></span>';
    dialLabel(b, it.lbl);
    b.addEventListener('click', () => onTap(it.k));
    nav.append(b);
  });
  return nav;
}
function dialLabel(b, t) { if (!b) return; const u = b.querySelector('.tab-bub'); if (!u.firstElementChild) u.textContent = t; b.querySelector('.tab-lbl').textContent = t; b.setAttribute('aria-label', t); }

/* ---- תצוגת מחשב (11/11/2026, בקשת המשתמש — docs/desktop-plan.md, התקן: ת־מחשב ב־docs/standards.md) ----
   שכבה אחת לכל האפליקציות (Invest מ־app.js, השאר מ־core.js), והטלפון לא משתנה. העיצוב כולו ב־desktop.css.
   1. מצב קלט — html[data-input] = mouse | touch | pen, לפי הקלט האחרון (Pointer Events), ובמחשב עם מסך מגע מתחלף
      ברגע שנוגעים: עכבר = פקדים קומפקטיים ו־hover; מגע ועט = יעדי מגע מלאים, בלי hover.
   2. מסגרת מחשב — html.dk מרוחב DESK_MIN: סרגל צד מזכוכית במקום החוגה. אותם פריטים ואותו מנוע — הלחיצה עוברת לכפתור
      של החוגה (המארח של dialHost), כך שכל התנהגות של האפליקציה נשמרת. בלי קובייה (cubeReduce) — מעבר מיידי.
   3. מקלדת — לפי e.code (עובד גם בפריסה עברית): ⌘K / Ctrl+K לוח פקודות, ⌘, / Ctrl+, הגדרות, ⌥1–9 / Alt+1–9 עמודים,
      / חיפוש בעמוד, ? רשימת הקיצורים, חצים בסרגל. לוח הפקודות והרשימה — חלונות רגילים (modalPush/modalDone, Esc). */
const DESK_MIN = 1024;                   // מכאן — מסגרת מחשב (iPad לרוחב ומעלה). מתחת: הטלפון כמו שהוא
const DESK_MIN_SITE = 900;              // 11/11/2026: "אתר למחשב" בטלפון (Chrome: דף ברוחב 980 על מסך צר) — deskSiteMode
const DESK_MIN_FINE = 900;               // 11/11/2026: עם עכבר — כבר מ־900 (חלון בחצי מסך של 1920, הגדלת תצוגה 200%), שם פריסת המגע לא נוחה
const DESK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
const DESK_IC = {
  find: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  keys: '<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M6.5 10h.01M10 10h.01M14 10h.01M17.5 10h.01M8 14h8"/>',
  moon: '<path d="M20.5 13.2A8.5 8.5 0 1 1 10.8 3.5a6.6 6.6 0 0 0 9.7 9.7z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>',
  lang: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a13.5 13.5 0 0 1 0 18M12 3a13.5 13.5 0 0 0 0 18"/>',
  side: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M15 4v16"/>',
  go: '<path d="M9 6l6 6-6 6"/>',
};
/* האפליקציות בסרגל — אותן שלוש של התפריט (Cashflow עוד לא מודלקת: מופיעה רק כשנמצאים בה) */
const DESK_APPS = [
  { k: 'invest', name: 'Invest', icon: 'icon-192.png', sub: () => t('appInvestSub') },
  { k: 'academy', name: 'Academy', icon: 'icon-academy-192.png', sub: () => t('menuLibrarySub') },
  { k: 'studio', name: 'Studio', icon: 'icon-studio-192.png', sub: () => t('menuStudioSub') },
  { k: 'cashflow', name: 'Cashflow', icon: 'icon-cashflow-192.png', sub: null, only: true },
];
const _desk = { on: false, side: null, nav: null, sig: '', cur: '', set: null, inSet: null, cmds: [], pal: null, help: null, wired: false, raf: 0, tip: null, tipEl: null, tipT: 0, drops: [], drop: null, dropWired: false, top: 0, show: null };

/* טהורות (tests/desktop.test.js) */
function deskApp() { try { return (document.documentElement.dataset.app || 'invest'); } catch (e) { return 'invest'; } }
/* 11/11/2026 (מחקר 05): המערכת — mac (גם iPad עם מקלדת) · win · cros · gbook (אנדרואיד במחשב: userAgentData.platform
   "Android" גם כשה־UA הוא של ChromeOS) · linux (גם אנדרואיד שמבקש אתר מחשב — אי אפשר להבדיל) · other */
function deskOS(nav) {
  try {
    const n = nav || navigator, ud = n.userAgentData, up = String((ud && ud.platform) || ''), np = String(n.platform || ''), ua = String(n.userAgent || '');
    if (/^android$/i.test(up)) return 'gbook';
    if (/mac|iphone|ipad|ipod/i.test(up || np) || /iPhone|iPad|iPod/.test(ua)) return 'mac';
    if (/win/i.test(up || np)) return 'win';
    if (/chrome ?os/i.test(up) || /\bCrOS\b/.test(ua)) return 'cros';
    if (/Android/.test(ua)) return 'gbook';
    if (/linux|x11/i.test(up || np) || /Linux|X11/.test(ua)) return 'linux';
  } catch (e) {}
  return 'other';
}
function deskIsMac() { return deskOS() === 'mac'; }
/* מעבר בין עמודים: בחלון מותקן Mod+1–9 בכל מערכת (הדפדפן לא שומר שם מקשים). בלשונית: Alt/⌥+1–9 ב־Mac וב־Windows;
   ב־Linux, ‏ChromeOS ו־Googlebook ‏Alt+1–8 שייכים למדף/ללשוניות (ה־Ash תופס לפני הדף, Firefox בלינוקס) — שם Ctrl+Alt+1–9 */
function deskPageMod(os, standalone) { return standalone ? 'mod' : (os === 'linux' || os === 'cros' || os === 'gbook') ? 'ctrl+alt' : 'alt'; }
function deskPageHit(e, os, standalone) {
  const mod = deskModKey(e, os === 'mac');
  if (standalone && mod && !e.altKey) return true;
  const m = deskPageMod(os, false);
  return m === 'alt' ? (e.altKey && !e.ctrlKey && !e.metaKey) : (e.altKey && e.ctrlKey && !e.metaKey);
}
function deskModKey(e, mac) { return mac ? !!e.metaKey && !e.ctrlKey : !!e.ctrlKey && !e.metaKey; }   // ⌘ במק, Ctrl בשאר
function deskKbd(k, mac) {               // התווית של קיצור: 'mod+K' → ⌘K / Ctrl+K · 'alt+1' → ⌥1 / Alt+1 · 'ctrl+alt+1' → ⌃⌥1 / Ctrl+Alt+1
  return String(k).split('+').map((p) => (p === 'mod' ? (mac ? '⌘' : 'Ctrl+') : p === 'ctrl' ? (mac ? '⌃' : 'Ctrl+') : p === 'alt' ? (mac ? '⌥' : 'Alt+') : p === 'shift' ? (mac ? '⇧' : 'Shift+') : p)).join('');
}
function deskNorm(s) { return String(s || '').toLowerCase().replace(/[֑-ׇ]/g, '').replace(/[״"׳'`־\-_.]/g, '').replace(/[ךםןףץ]/g, (c) => DESK_FIN[c]).replace(/\s+/g, ' ').trim(); }
const DESK_FIN = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };
/* תיקון פריסה שגויה: "ehv" שהוקלד במקלדת אנגלית במקום "יקר" (ולהפך) — לפי מיקום המקש. מחקר 03, סעיף 7.8 */
const DESK_EN = "qwertyuiopasdfghjkl;zxcvbnm,.", DESK_HE = "/'קראטוןםפשדגכעיחלךףזסבהנמצתץ";
function deskSwap(q) {
  const s = String(q || '').toLowerCase();
  const he = /[א-ת]/.test(s), from = he ? DESK_HE : DESK_EN, to = he ? DESK_EN : DESK_HE;
  let out = '';
  for (const c of s) { const i = from.indexOf(c); out += i >= 0 ? to[i] : c; }
  return out;
}
/* ציון התאמה של פקודה לחיפוש: 0 = לא מתאים. התחלה של מילה > בתוך המילה > אותיות לפי הסדר */
function deskScore(q, label, kw) {
  const n = deskNorm(q);
  if (!n) return 1;
  const hay = deskNorm(label) + ' ' + deskNorm(kw || '');
  const sc = deskMatch(n, hay);
  if (sc >= 60) return sc;
  const w = deskNorm(deskSwap(q));   // אולי הוקלד בפריסה הלא נכונה — ציון מעט נמוך יותר מהתאמה ישירה
  return Math.max(sc, w && w !== n ? deskMatch(w, hay) - 1 : 0);
}
function deskMatch(n, hay) {
  if (hay.startsWith(n)) return 100;
  if ((' ' + hay).includes(' ' + n)) return 80;
  if (hay.includes(n)) return 60;
  let i = 0;
  for (const ch of hay) { if (ch === n[i]) i++; if (i === n.length) return 20; }
  return 0;
}
function deskFilter(q, items) {
  return items.map((it, i) => ({ it, s: deskScore(q, it.label, it.kw), i })).filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i).map((x) => x.it);
}

/* ---------- 1. מצב קלט ---------- */
function deskInput(k) {
  const de = document.documentElement;
  if (de && de.dataset && de.dataset.input !== k) de.dataset.input = k; // dataset חסר בסביבת הבדיקות (vm)
}
function deskInputInit() {
  let fine = false;
  try { fine = matchMedia('(hover: hover) and (pointer: fine)').matches; } catch (e) {}
  deskInput(fine ? 'mouse' : 'touch');
  let moves = 0;
  window.addEventListener('pointerdown', (e) => { moves = 0; deskInput(e.pointerType === 'mouse' ? 'mouse' : e.pointerType === 'pen' ? 'pen' : 'touch'); }, { capture: true, passive: true });
  // תזוזת עכבר אמיתית (לא אירועי תאימות של מגע — אלה מסומנים touch) מחזירה למצב עכבר; שלוש תזוזות — לא רעד בודד
  window.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' && document.documentElement.dataset.input !== 'mouse' && ++moves > 2) deskInput('mouse'); }, { capture: true, passive: true });
}
/* 11/11/2026 (גל 2): לחיצה ימנית בעכבר = הלחיצה הארוכה (עריכה/מחיקה/אוסף). מגע ארוך שולח גם הוא contextmenu,
   ולכן רק כשהלחיצה באה מעכבר (pointerType; בדפדפן שבו האירוע בלי pointerType — לפי הקלט האחרון) */
function deskCtxMouse(e) {
  if (e && e.pointerType) return e.pointerType === 'mouse';
  try { return document.documentElement.dataset.input === 'mouse'; } catch (er) { return false; }
}

/* ---------- 2. מסגרת מחשב ---------- */
function deskSiteMode(w, sw) { return w >= DESK_MIN_SITE && sw > 0 && sw < 600 && w > sw * 1.5; }   // "אתר למחשב" בטלפון
function deskWide() {
  try {
    let fine = false; try { fine = matchMedia('(hover: hover) and (pointer: fine)').matches; } catch (e) {}
    // 11/11/2026 (המשתמש, Chrome באנדרואיד → "אתר למחשב"): הדפדפן מצייר דף ברוחב 980 על מסך של ~410 — בחירה מפורשת בתצוגת מחשב.
    // הסימן: הדף רחב בהרבה מהמסך (בטלפון רגיל הם שווים; במחשב — רק בהקטנה חזקה, ושם הוא ממילא רחב)
    const sw = (window.screen && Math.min(window.screen.width || 0, window.screen.height || 0)) || 0;
    if (deskSiteMode(window.innerWidth, sw)) return true;
    return window.innerWidth >= (fine ? DESK_MIN_FINE : DESK_MIN);
  } catch (e) { return false; }
}
function deskMode() {
  if (typeof document === 'undefined') return;
  const on = deskWide();
  if (on === _desk.on && (!on || _desk.side || deskApp() === 'admin')) return deskSync();
  _desk.on = on;
  document.documentElement.classList.toggle('dk', on);
  if (on) { deskBuild(); deskSync(true); }
  else if (_desk.side) { _desk.side.remove(); _desk.side = null; _desk.nav = null; _desk.sig = ''; if (_desk.show) { _desk.show.remove(); _desk.show = null; } }
  try { if (typeof dialSync === 'function') dialSync(true); } catch (e) {}
}
/* ההגדרות של האפליקציה: open — פתיחה, isOn — האם פתוחות (להדגשה בסרגל). shell.js (Academy/Studio/Cashflow) ו־Invest רושמים */
function deskOnSettings(open, isOn) { _desk.set = open || null; _desk.inSet = isOn || null; deskSync(true); }
/* פקודות נוספות של האפליקציה ללוח הפקודות (Invest: המניות והמעקב) — fn(q) → [{label, sub, ico, kw, run}] */
function deskAddCmds(fn) { if (typeof fn === 'function' && !_desk.cmds.includes(fn)) _desk.cmds.push(fn); }
function deskAppUrl(k) {
  const env = (typeof window !== 'undefined' && window.SNB_ENV && window.SNB_ENV.apps) || {};
  return env[k] || { invest: './', academy: 'academy.html', studio: 'studio.html', cashflow: 'cashflow.html' }[k];
}
function deskEl(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
function deskRow(cls, ico, label, extra) {
  const b = deskEl('button', 'dk-item' + (cls ? ' ' + cls : ''));
  b.type = 'button';
  const i = deskEl('span', 'dk-ico'); if (ico) i.append(ico);
  const l = deskEl('span', 'dk-lbl'); l.textContent = label;
  b.append(i, l);
  if (extra) b.append(extra);
  return b;
}
function deskSvg(paths) { const s = deskEl('span', 'dk-svg', DESK_SVG + paths + '</svg>'); return s; }
/* הפריטים של העמוד — מהחוגה של המארח: המפתח, הכיתוב והסמל (העתק של ה־SVG) */
function deskPages() {
  const h = typeof _dial !== 'undefined' && _dial.host;
  if (!h) return [];
  const nav = h.nav && h.nav(), keys = (h.keys && h.keys()) || [];
  if (!nav) return [];
  return keys.map((k) => {
    const b = nav.querySelector('.tab[data-tab="' + k + '"]');
    if (!b) return null;
    // האייקון: של הפריט הרגיל, ובפריט המרכזי של החוגה (שמצויר כבועה) — של הבועה, בקו דק כמו השאר
    let ico = b.querySelector('.tab-ico'), lbl = b.querySelector('.tab-lbl');
    if (!ico || !ico.firstElementChild) ico = b.querySelector('.tab-bub-ico');
    const c = ico ? ico.cloneNode(true) : null;
    if (c) { c.removeAttribute('style'); c.setAttribute('class', ico.classList.contains('tab-fill') ? 'tab-ico tab-fill' : 'tab-ico'); c.setAttribute('stroke-width', '1.9'); c.setAttribute('aria-hidden', 'true'); }   // style: החוגה מעמעמת את האייקון של הפריט הפעיל (opacity 0) — לא להעתיק
    return { k, b, label: (lbl && lbl.textContent) || b.getAttribute('aria-label') || k, ico: c };
  }).filter(Boolean);
}
function deskKbdEl(k) { const e = deskEl('kbd', 'dk-kbd'); e.textContent = deskKbd(k, deskIsMac()); return e; }
function deskBuild() {
  if (_desk.side || deskApp() === 'admin') return;   // מרכז הניהול — יש לו סרגל משלו (admin.css, מעוצב לפי אותו תקן)
  const app = deskApp(), side = deskEl('aside', 'dk-side');
  side.setAttribute('aria-label', t('dkSideAria'));
  const me = DESK_APPS.find((a) => a.k === app) || DESK_APPS[0];
  const head = deskEl('div', 'dk-head');
  const logo = deskEl('img', 'dk-logo'); logo.src = me.icon; logo.alt = ''; logo.width = 32; logo.height = 32; logo.decoding = 'async';
  const nm = deskEl('div', 'dk-name'); const b = deskEl('b'); b.textContent = me.name; const s = deskEl('small'); s.textContent = 'THE SNOWBALL';
  nm.append(b, s); head.append(logo, nm);
  // גל 3: הסתרת הסרגל (⌘\) — הכפתור בראש הסרגל, ובזמן ההסתרה כפתור קטן בפינה מחזיר אותו
  const hide = deskEl('button', 'icon-btn dk-hidebtn', DESK_SVG + DESK_IC.side + '</svg>'); hide.type = 'button';
  hide.setAttribute('aria-label', t('dkSideHide')); hide.dataset.dkKey = 'mod+\\';
  hide.addEventListener('click', () => deskSideToggle(false));
  head.append(hide);
  const show = deskEl('button', 'icon-btn dk-showbtn', DESK_SVG + DESK_IC.side + '</svg>'); show.type = 'button';
  show.setAttribute('aria-label', t('dkSideShow')); show.dataset.dkKey = 'mod+\\';
  show.addEventListener('click', () => deskSideToggle(true));
  document.body.append(show); _desk.show = show;
  const find = deskRow('dk-find', deskSvg(DESK_IC.find), t('dkFind'), deskKbdEl('mod+K'));
  find.addEventListener('click', () => deskPalette());
  const nav = deskEl('nav', 'dk-nav'); nav.setAttribute('aria-label', t('dkPagesAria'));
  const apps = deskEl('div', 'dk-sec'); const at = deskEl('h2', 'dk-sec-t'); at.textContent = t('dkApps'); apps.append(at);
  for (const a of DESK_APPS) {
    if (a.k === app || (a.only && a.k !== app)) continue;
    const ic = deskEl('img', 'dk-appic'); ic.src = a.icon; ic.alt = ''; ic.width = 22; ic.height = 22; ic.decoding = 'async'; ic.loading = 'lazy';
    const r = deskRow('dk-app', ic, a.name);
    r.dataset.app = a.k;
    r.addEventListener('click', () => appGo(deskAppUrl(a.k)));
    r.addEventListener('pointerenter', () => { try { appPrerender([deskAppUrl(a.k)]); } catch (e) {} }, { passive: true });   // מעבר מיידי (core: appPrerender)
    apps.append(r);
  }
  const foot = deskEl('div', 'dk-foot');
  const set = deskRow('dk-set', deskSvg(DESK_IC.gear), t('menuSettings'), deskKbdEl('mod+,'));
  set.addEventListener('click', () => deskSettings());
  foot.append(set);
  side.append(head, find, nav, apps, foot);
  side.addEventListener('keydown', deskSideKeys);
  document.body.append(side);
  _desk.side = side; _desk.nav = nav; _desk.sig = '';
}
/* גל 3 (11/11/2026): הסתרת סרגל הצד — העדפה של המכשיר (כמו LS_DKKEYS). התוכן מתרחב (--dk-off: 0), והחוגה לא חוזרת:
   הניווט במקלדת (⌘K, Alt+1–9) ובכפתור בפינה. show: true/false, בלי — החלפה */
const LS_DKSIDE = 'pwa_dkside_v1';
function deskSideHidden() { try { return localStorage.getItem(LS_DKSIDE) === '0'; } catch (e) { return false; } }
function deskSideToggle(show) {
  const de = document.documentElement;
  if (!_desk.side) return;
  const hide = show == null ? !de.classList.contains('dk-hide') : !show;
  try { if (hide) localStorage.setItem(LS_DKSIDE, '0'); else localStorage.removeItem(LS_DKSIDE); } catch (e) {}
  const had = _desk.side.contains(document.activeElement) || (_desk.show && _desk.show === document.activeElement);
  de.classList.toggle('dk-hide', hide);
  deskTipHide();
  if (had) { try { (hide ? _desk.show : _desk.side.querySelector('.dk-hidebtn')).focus({ preventScroll: true }); } catch (e) {} }
  try { window.dispatchEvent(new Event('resize')); } catch (e) {}   // גרפים ורשתות — לרוחב החדש
}
function deskSettings() { if (_desk.set) { try { _desk.set(); } catch (e) {} } deskSoon(); }
function deskGo(p) {
  const h = _dial.host;
  if (!h) return;
  if (p.b && p.b.isConnected) p.b.click(); else if (h.instant) h.instant(p.k);
  deskSoon();
}
/* הסנכרון — הפריטים (כשהמארח או המפתחות השתנו) וההדגשה של העמוד הנוכחי. זול: נקרא מ־dialPaint ואחרי כל לחיצה */
/* גל 3: גובה ההדר הצף → --dk-top (המפקח נצמד מתחתיו). נמדד רק כשהשתנה */
function deskTop() {
  const ab = document.querySelector('.appbar');   // הלוגו והבועות יוצאים מגובה ההדר עצמו — הנמוך מכולם קובע
  const hgt = ab ? Math.round(Math.max(...[ab, ...ab.querySelectorAll('.brand-logo, .appbar-sub, .fx-pill')].map((x) => x.getBoundingClientRect().bottom))) : 0;
  if (hgt > 0 && hgt !== _desk.top) { _desk.top = hgt; document.documentElement.style.setProperty('--dk-top', hgt + 'px'); }
}
function deskSync(force) {
  if (!_desk.side) return;
  deskTop();
  const pages = deskPages(), sig = (_dial.host ? 'h' : '') + pages.map((p) => p.k + ':' + p.label).join('|');
  if (force || sig !== _desk.sig) {
    _desk.sig = sig;
    _desk.nav.textContent = '';
    pages.forEach((p, i) => {
      const r = deskRow('dk-page', p.ico, p.label, i < 9 ? deskKbdEl(deskPageMod(deskOS(), deskStandalone()) + '+' + (i + 1)) : null);
      r.dataset.k = p.k;
      r.addEventListener('click', () => deskGo(deskPages().find((x) => x.k === p.k) || p));
      _desk.nav.append(r);
    });
    _desk.cur = '';
  }
  let inSet = false;
  try { inSet = !!(_desk.inSet && _desk.inSet()); } catch (e) {}
  let cur = '';
  try { cur = inSet ? '' : String((_dial.host && _dial.host.cur()) || ''); } catch (e) {}
  const key = (inSet ? '§' : '') + cur;
  if (key === _desk.cur && !force) return;
  _desk.cur = key;
  _desk.nav.querySelectorAll('.dk-page').forEach((r) => { if (r.dataset.k === cur) r.setAttribute('aria-current', 'page'); else r.removeAttribute('aria-current'); });
  const s = _desk.side.querySelector('.dk-set');
  if (s) { if (inSet) s.setAttribute('aria-current', 'page'); else s.removeAttribute('aria-current'); }
}
function deskSoon() { if (_desk.raf || typeof requestAnimationFrame !== 'function') return; _desk.raf = requestAnimationFrame(() => { _desk.raf = 0; deskSync(); }); }
/* חצים בסרגל: מעבר בין הפריטים (מלמעלה למטה), Home/End — הראשון/האחרון */
function deskSideKeys(e) {
  if (!/^(ArrowDown|ArrowUp|Home|End)$/.test(e.key)) return;
  const all = [..._desk.side.querySelectorAll('.dk-item')];
  const i = all.indexOf(document.activeElement);
  if (i < 0) return;
  e.preventDefault();
  const n = e.key === 'Home' ? 0 : e.key === 'End' ? all.length - 1 : Math.max(0, Math.min(all.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)));
  all[n].focus();
}

/* ---------- 3. מקלדת ---------- */
function deskTyping(el) {
  if (!el || el === document.body) return false;
  const tg = el.tagName;
  return tg === 'INPUT' || tg === 'TEXTAREA' || tg === 'SELECT' || !!el.isContentEditable;
}
function deskBusy() {   // קורא פתוח, נגן במסך מלא או חלון אחר — המקשים הפשוטים שלהם (חצים, רווח, /) לא שלנו
  try { return !!document.querySelector('.rd, .dlg-veil, .st-player.full, .st-pl-menu') || (typeof _modals !== 'undefined' && _modals.length > 0 && !_desk.pal && !_desk.help); } catch (e) { return false; }
}
/* קיצורים של מקש אחד (/ ?, ובנגן K F) — אפשר לכבות (WCAG 2.1.4), ברמת המכשיר בלבד */
const LS_DKKEYS = 'pwa_dkkeys_v1';
function deskK1() { try { return localStorage.getItem(LS_DKKEYS) !== '0'; } catch (e) { return true; } }
function deskK1Set(on) { try { if (on) localStorage.removeItem(LS_DKKEYS); else localStorage.setItem(LS_DKKEYS, '0'); } catch (e) {} }
/* בחלון מותקן הדפדפן לא שומר לעצמו ⌘1–9 (מחקר 03, 1.2) — שם גם הם עוברים בין העמודים; בלשונית רגילה — רק ⌥/Alt */
function deskStandalone() { try { return matchMedia('(display-mode: standalone), (display-mode: window-controls-overlay)').matches; } catch (e) { return false; } }
function deskKey(e) {
  if (e.defaultPrevented || e.isComposing) return;
  const mac = deskIsMac(), mod = deskModKey(e, mac), c = e.code || '';   // לפי המקש הפיזי: במקלדת עברית e.key של K הוא "ל"
  if (mod && !e.altKey && !e.shiftKey && c === 'KeyK') { e.preventDefault(); return _desk.pal ? deskPalClose() : deskPalette(); }
  if (mod && !e.altKey && !e.shiftKey && c === 'Comma') { e.preventDefault(); if (_desk.pal) deskPalClose(); return deskSettings(); }
  if (mod && !e.altKey && !e.shiftKey && c === 'Backslash' && _desk.side) { e.preventDefault(); return deskSideToggle(); }
  if (!e.shiftKey && /^Digit[1-9]$/.test(c) && deskPageHit(e, deskOS(), deskStandalone())) {
    const p = deskPages()[+c.slice(5) - 1];
    if (p && !deskBusy()) { e.preventDefault(); if (_desk.pal) deskPalClose(); deskGo(p); }
    return;
  }
  if (deskGridKey(e)) return;
  if (e.ctrlKey || e.metaKey || e.altKey || deskTyping(e.target) || deskBusy() || !deskK1()) return;
  if (c === 'Slash' ? e.shiftKey : e.key === '?') { e.preventDefault(); return deskHelp(); }
  if (c === 'Slash' && !e.shiftKey) {
    const f = deskSearchField();
    e.preventDefault();
    if (f) { f.focus(); try { f.select(); } catch (err) {} } else deskPalette();
  }
}
/* שדה החיפוש הגלוי של העמוד (חיפוש מניה, חיפוש בספרים…) */
function deskSearchField() {
  const all = document.querySelectorAll('input[type="search"], .search-field input, .lib-search input');
  for (const f of all) { const r = f.getBoundingClientRect(); if (r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight && !f.closest('[hidden], .cube-ghost')) return f; }
  return null;
}

/* לוח הפקודות (⌘K): חלון זכוכית בראש המסך — חיפוש, חצים, Enter; עכבר מסמן ולחיצה מפעילה */
function deskCmdList() {
  const out = [], mac = deskIsMac(), app = deskApp();
  const pm = deskPageMod(deskOS(), deskStandalone());
  deskPages().forEach((p, i) => out.push({ label: p.label, sub: t('dkCmdPage'), ico: p.ico ? p.ico.cloneNode(true) : null, kbd: i < 9 ? deskKbd(pm + '+' + (i + 1), mac) : '', run: () => deskGo(p) }));
  if (_desk.set) out.push({ label: t('menuSettings'), sub: t('dkCmdPage'), ico: deskSvg(DESK_IC.gear), kbd: deskKbd('mod+,', mac), kw: 'settings preferences הגדרות', run: deskSettings });
  for (const a of DESK_APPS) {
    if (a.k === app || (a.only && a.k !== app)) continue;
    const ic = deskEl('img', 'dk-appic'); ic.src = a.icon; ic.alt = '';
    out.push({ label: a.name, sub: t('dkCmdApp'), ico: ic, kw: a.sub ? a.sub() : '', run: () => appGo(deskAppUrl(a.k)) });
  }
  const dark = typeof resolveTheme === 'function' && resolveTheme() === 'dark';
  out.push({ label: dark ? t('dkCmdLight') : t('dkCmdDark'), sub: t('dkCmdAct'), ico: deskSvg(dark ? DESK_IC.sun : DESK_IC.moon), kw: 'theme dark light ערכה כהה בהיר', run: () => setThemeMode(dark ? 'light' : 'dark') });
  const he = getLang() === 'he';
  out.push({ label: t('dkCmdLang'), sub: t('dkCmdAct'), ico: deskSvg(DESK_IC.lang), kw: 'language שפה english hebrew עברית', run: () => { try { localStorage.setItem(LS_LANG, he ? 'en' : 'he'); } catch (e) {} location.reload(); } });
  out.push({ label: t('dkKeysTitle'), sub: t('dkCmdAct'), ico: deskSvg(DESK_IC.keys), kbd: '?', kw: 'shortcuts keyboard מקלדת קיצורים', run: deskHelp });
  if (_desk.side) { const hid = document.documentElement.classList.contains('dk-hide'); out.push({ label: hid ? t('dkSideShow') : t('dkSideHide'), sub: t('dkCmdAct'), ico: deskSvg(DESK_IC.side), kbd: deskKbd('mod+\\', mac), kw: 'sidebar סרגל צד', run: () => deskSideToggle(hid) }); }
  return out;
}
function deskPalette() {
  if (typeof document === 'undefined') return;
  if (_desk.pal) { _desk.pal.input.focus(); _desk.pal.input.select(); return; }
  if (_desk.help) deskHelpClose();
  const veil = deskEl('div', 'dk-veil'), box = deskEl('div', 'dk-pal');
  box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', t('dkFind'));
  const bar = deskEl('div', 'dk-pal-bar');
  const inp = deskEl('input', 'dk-pal-in');
  inp.type = 'text'; inp.placeholder = t('dkPalPh'); inp.setAttribute('role', 'combobox'); inp.setAttribute('aria-expanded', 'true');
  inp.setAttribute('aria-controls', 'dkPalList'); inp.setAttribute('aria-autocomplete', 'list'); inp.autocomplete = 'off'; inp.spellcheck = false;
  bar.append(deskSvg(DESK_IC.find), inp, (() => { const k = deskEl('kbd', 'dk-kbd'); k.textContent = 'Esc'; return k; })());
  const list = deskEl('div', 'dk-pal-list'); list.id = 'dkPalList'; list.setAttribute('role', 'listbox');
  const empty = deskEl('p', 'dk-pal-empty'); empty.textContent = t('dkPalNone'); empty.hidden = true;
  box.append(bar, list, empty); veil.append(box);
  const base = deskCmdList();
  const P = { veil, box, input: inp, list, rows: [], sel: 0, items: [], modal: null, prev: document.activeElement };
  const paint = () => {
    const q = inp.value;
    let extra = [];
    for (const fn of _desk.cmds) { try { extra = extra.concat(fn(q) || []); } catch (e) {} }
    P.items = deskFilter(q, base.concat(extra)).slice(0, 40);
    list.textContent = ''; P.rows = [];
    P.items.forEach((it, i) => {
      const r = deskEl('div', 'dk-pal-row'); r.id = 'dkPal' + i; r.setAttribute('role', 'option');
      const ic = deskEl('span', 'dk-ico'); if (it.ico) ic.append(it.ico.cloneNode ? it.ico.cloneNode(true) : it.ico);
      const tx = deskEl('span', 'dk-pal-tx'); const l = deskEl('b'); l.textContent = it.label; tx.append(l);
      if (it.sub) { const s = deskEl('small'); s.textContent = it.sub; tx.append(s); }
      r.append(ic, tx);
      if (it.kbd) { const k = deskEl('kbd', 'dk-kbd'); k.textContent = it.kbd; r.append(k); }
      r.addEventListener('pointermove', () => { if (P.sel !== i) pick(i, false); });
      r.addEventListener('click', () => run(i));
      list.append(r); P.rows.push(r);
    });
    empty.hidden = P.items.length > 0;
    pick(0, true);
  };
  const pick = (i, scroll) => {
    if (!P.rows.length) { inp.removeAttribute('aria-activedescendant'); return; }
    P.sel = (i + P.rows.length) % P.rows.length;
    P.rows.forEach((r, j) => r.setAttribute('aria-selected', j === P.sel ? 'true' : 'false'));
    inp.setAttribute('aria-activedescendant', P.rows[P.sel].id);
    if (scroll) P.rows[P.sel].scrollIntoView({ block: 'nearest' });
  };
  const run = (i) => { const it = P.items[i]; deskPalClose(); if (it) setTimeout(() => { try { it.run(); } catch (e) {} }, 0); };
  inp.addEventListener('input', paint);
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); pick(P.sel + (e.key === 'ArrowDown' ? 1 : -1), true); }
    else if (e.key === 'Enter') { e.preventDefault(); run(P.sel); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (inp.value) { inp.value = ''; paint(); } else deskPalClose(); }   // קודם מנקה, אחר כך סוגר
    else if (e.key === 'Tab') e.preventDefault();   // החלון מחזיק את הפוקוס
  });
  veil.addEventListener('pointerdown', (e) => { if (e.target === veil) deskPalClose(); });
  document.body.append(veil);
  _desk.pal = P;
  P.modal = modalPush(() => deskPalClose(true));
  paint();
  requestAnimationFrame(() => { veil.classList.add('on'); inp.focus(); });
}
function deskPalClose(fromBack) {
  const P = _desk.pal;
  if (!P) return;
  _desk.pal = null;
  if (!fromBack) modalDone(P.modal);
  P.veil.classList.remove('on'); P.veil.classList.add('off');
  setTimeout(() => P.veil.remove(), 180);
  try { if (P.prev && P.prev.isConnected && P.prev.focus) P.prev.focus({ preventScroll: true }); } catch (e) {}
}
/* רשימת הקיצורים (?) — לפי האפליקציה; התוויות לפי המערכת (⌘ במק, Ctrl בשאר) */
function deskHelp() {
  if (typeof document === 'undefined' || _desk.help) return;
  if (_desk.pal) deskPalClose();
  const mac = deskIsMac(), veil = deskEl('div', 'dk-veil'), box = deskEl('div', 'dk-help');
  box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-labelledby', 'dkHelpT'); box.tabIndex = -1;
  const h = deskEl('h2', 'dk-help-t'); h.id = 'dkHelpT'; h.textContent = t('dkKeysTitle');
  const x = deskEl('button', 'dk-help-x', DESK_SVG + '<path d="M6 6l12 12M18 6 6 18"/></svg>'); x.type = 'button'; x.setAttribute('aria-label', t('menuCloseAria'));
  x.addEventListener('click', () => deskHelpClose());
  const groups = [
    [t('dkKeysGen'), [['mod+K', t('dkFind')], ['mod+,', t('menuSettings')], ['mod+\\', t('dkSideHide')], ['/', t('dkKeySearch')], ['?', t('dkKeysTitle')], ['Esc', t('dkKeyBack')]]],
    [t('dkKeysNav'), [[deskPageMod(deskOS(), deskStandalone()) + '+1–9', t('dkKeyPages')], ['↑ ↓', t('dkKeyArrows')], ['Tab', t('dkKeyTab')], ['Enter', t('dkKeyOpen')]]],
  ];
  const extra = DESK_HELP[deskApp()];
  if (extra) groups.push([t('dkKeysApp'), extra.map(([k, s]) => [k, s()])]);
  const body = deskEl('div', 'dk-help-g');
  for (const [title, rows] of groups) {
    const sec = deskEl('section', 'dk-help-s'); const st = deskEl('h3'); st.textContent = title; sec.append(st);
    for (const [k, l] of rows) {
      const r = deskEl('div', 'dk-help-r'); const lb = deskEl('span'); lb.textContent = l;
      const kb = deskEl('kbd', 'dk-kbd'); kb.textContent = deskKbd(k, mac);
      r.append(lb, kb); sec.append(r);
    }
    body.append(sec);
  }
  const head = deskEl('div', 'dk-help-h'); head.append(h, x);
  // מתג: קיצורים של מקש אחד (/ ? ובנגן K F) — WCAG 2.1.4
  const swRow = deskEl('label', 'dk-help-sw'); const swT = deskEl('span'); swT.textContent = t('dkKeys1');
  const sw = deskEl('button', 'dk-sw'); sw.type = 'button'; sw.setAttribute('role', 'switch'); sw.setAttribute('aria-checked', deskK1() ? 'true' : 'false');
  sw.addEventListener('click', () => { const on = sw.getAttribute('aria-checked') !== 'true'; deskK1Set(on); sw.setAttribute('aria-checked', on ? 'true' : 'false'); });
  swRow.append(swT, sw);
  box.append(head, body, swRow); veil.append(box);
  veil.addEventListener('pointerdown', (e) => { if (e.target === veil) deskHelpClose(); });
  box.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); deskHelpClose(); } });
  document.body.append(veil);
  _desk.help = { veil, modal: modalPush(() => deskHelpClose(true)), prev: document.activeElement };
  requestAnimationFrame(() => { veil.classList.add('on'); box.focus(); });
}
function deskHelpClose(fromBack) {
  const H = _desk.help;
  if (!H) return;
  _desk.help = null;
  if (!fromBack) modalDone(H.modal);
  H.veil.classList.remove('on'); H.veil.classList.add('off');
  setTimeout(() => H.veil.remove(), 180);
  try { if (H.prev && H.prev.isConnected && H.prev.focus) H.prev.focus({ preventScroll: true }); } catch (e) {}
}
/* הקיצורים של כל אפליקציה שכבר קיימים בה (מתועדים כאן כדי שיופיעו ב־?) */
const DESK_HELP = {
  // המפתחות מילוליים בתוך פונקציה (i18n-coverage אוסר t() דינמי)
  academy: [['← →', () => t('dkKeyPageTurn')], ['Space', () => t('dkKeyPageNext')], ['shift+Space', () => t('dkKeyPagePrev')], ['mod+F', () => t('dkKeyBookFind')], ['mod+=', () => t('dkKeyFontUp')], ['mod+−', () => t('dkKeyFontDown')]],
  studio: [['Space', () => t('dkKeyPlay')], ['← →', () => t('dkKeySeek')], ['F', () => t('dkKeyFull')], ['mod+↩', () => t('dkKeyCueNext')]],
  invest: [['← →', () => t('dkKeyChartPt')], ['shift+← →', () => t('dkKeyChartMeasure')], ['1–9', () => t('dkKeyChartRange')]],
};

/* 11/11/2026: גלגלת העכבר בשורות שנגללות רק לרוחב (שבבים, מחברים, טווחים) — עם עכבר אין החלקה והפס מוסתר, אז הגלגלת גוללת
   אותן לרוחב. המאזין (לא פסיבי — כדי לעצור את גלילת הדף) נרשם רק על השורה שהעכבר עובר מעליה, לא על כל המסמך */
function deskHRow(el) {
  for (let n = el, i = 0; n && n.nodeType === 1 && i < 6; n = n.parentElement, i++) {
    if (n === document.body || n === document.documentElement) return null;
    if (n.scrollWidth > n.clientWidth + 1 && n.scrollHeight <= n.clientHeight + 1 && /^(auto|scroll)$/.test(getComputedStyle(n).overflowX)) return n;
  }
  return null;
}
/* כמה לגלול (בפיקסלים, בכיוון הקריאה) — 0 = לא לגעת: משטח מגע שכבר אופקי, Ctrl (הגדלה), או שהשורה בקצה ואז הדף נגלל */
function deskWheelDx(e, rtl, left, max) {
  if (e.ctrlKey || e.metaKey || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return 0;
  const d = e.deltaY * (e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? 320 : 1), x = Math.abs(left);
  if ((d > 0 && x >= max - 1) || (d < 0 && x <= 1)) return 0;
  return rtl ? -d : d;
}
function deskWheel(e) {
  const el = e.currentTarget; if (e.defaultPrevented || !document.documentElement.classList.contains('dk')) return;
  const dx = deskWheelDx(e, getComputedStyle(el).direction === 'rtl', el.scrollLeft, el.scrollWidth - el.clientWidth);
  if (dx) { e.preventDefault(); el.scrollLeft += dx; }
}
function deskWheelOver(e) {
  if (!_desk.on || document.documentElement.dataset.input !== 'mouse') return;
  const r = deskHRow(e.target);
  if (r && !r.__dkWheel) { r.__dkWheel = 1; r.addEventListener('wheel', deskWheel, { passive: false }); }
}
/* ---------- 5א. רשימות־טבלה במקלדת (גל 4, 11/11/2026) ----------
   [data-dk-grid] (העסקאות, ההפקדות): Tab מגיע לרשימה, ↑ ↓ שורה, Home/End ראשונה/אחרונה, Enter — הכפתור הראשון בשורה (עריכה).
   שורה מקבלת tabindex=-1 רק כשמגיעים אליה (בלי לגעת בבנייה של הרשימות) */
function deskGridIdx(cur, n, k) {
  if (!n) return null;
  if (k === 'Home') return 0;
  if (k === 'End') return n - 1;
  if (k === 'ArrowDown') return cur < 0 ? 0 : Math.min(n - 1, cur + 1);
  if (k === 'ArrowUp') return cur < 0 ? 0 : Math.max(0, cur - 1);
  return null;
}
function deskGridRows(g) { return [...g.querySelectorAll('li')].filter((r) => !r.parentElement.closest('li') && r.offsetParent !== null && !r.classList.contains('dep-sub')); }
function deskGridKey(e) {
  const k = e.key;
  if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || !/^(ArrowUp|ArrowDown|Home|End|Enter)$/.test(k)) return false;
  const a = document.activeElement, g = a && a.closest ? a.closest('[data-dk-grid]') : null;
  if (!g || deskTyping(a)) return false;
  const rows = deskGridRows(g), cur = a === g ? -1 : rows.findIndex((r) => r === a || r.contains(a));
  if (k === 'Enter') {
    const b = cur >= 0 && rows[cur] === a ? a.querySelector('button, a[href], [role="button"]') : null;
    if (!b) return false;
    e.preventDefault(); b.click(); return true;
  }
  if (cur >= 0 && rows[cur] !== a) return false;   // הפוקוס על כפתור בתוך שורה — החצים שלו
  const j = deskGridIdx(cur, rows.length, k);
  if (j == null) return false;
  e.preventDefault();
  const r = rows[j]; if (!r.hasAttribute('tabindex')) r.tabIndex = -1;
  r.focus({ preventScroll: true }); try { r.scrollIntoView({ block: 'nearest' }); } catch (er) {}
  return true;
}
/* ---------- 6. בועית עם השם והקיצור (גל 2, 11/11/2026) ----------
   עכבר שעומד חצי שנייה על כפתור־אייקון (‎.icon-btn עם aria-label) או על [data-dk-tip] — בועית קטנה עם השם, ו־data-dk-key
   מוסיף את הקיצור (‎'mod+,' → ⌘, / Ctrl+,). נסגרת ביציאה, בלחיצה, בגלילה וב־Esc (בלי לבלוע את ה־Esc של החלון). רק במחשב ובעכבר */
const DESK_TIP_SEL = '.icon-btn[aria-label], [data-dk-tip]', DESK_TIP_MS = 500;
function deskTipText(el) { return String((el.dataset && el.dataset.dkTip) || el.getAttribute('aria-label') || '').trim(); }
function deskTipPos(r, w, h, vw, vh) {   // מתחת לאלמנט, ואם אין מקום — מעליו; תמיד בתוך החלון
  const top = r.bottom + 8 + h <= vh - 4 ? r.bottom + 8 : Math.max(4, r.top - 8 - h);
  const left = Math.max(4, Math.min(vw - w - 4, r.left + r.width / 2 - w / 2));
  return { top: Math.round(top), left: Math.round(left) };
}
function deskTipHide() {
  clearTimeout(_desk.tipT); _desk.tipT = 0; _desk.tipEl = null;
  if (_desk.tip) { _desk.tip.remove(); _desk.tip = null; }
}
function deskTipShow(el) {
  _desk.tipT = 0;
  const txt = deskTipText(el);
  if (!txt || !el.isConnected || !_desk.on) return;
  const tip = deskEl('div', 'dk-tip'); tip.setAttribute('role', 'tooltip');
  tip.append(deskEl('span', 'dk-tip-t')); tip.firstChild.textContent = txt;
  const k = el.dataset && el.dataset.dkKey; if (k) tip.append(deskKbdEl(k));
  document.body.append(tip); _desk.tip = tip;
  const p = deskTipPos(el.getBoundingClientRect(), tip.offsetWidth, tip.offsetHeight, window.innerWidth, window.innerHeight);
  tip.style.top = p.top + 'px'; tip.style.left = p.left + 'px';
  tip.classList.add('on');
}
function deskTipOver(e) {
  if (!_desk.on || document.documentElement.dataset.input !== 'mouse') return;
  const el = e.target && e.target.closest ? e.target.closest(DESK_TIP_SEL) : null;
  if (el === _desk.tipEl) return;
  deskTipHide();
  if (!el || el.title || el.disabled || el.getAttribute('aria-expanded') === 'true') return;   // לכפתור עם title יש בועית של המערכת
  _desk.tipEl = el; _desk.tipT = setTimeout(() => deskTipShow(el), DESK_TIP_MS);
}
function deskTipOut(e) { if (_desk.tipEl && !(e.relatedTarget && _desk.tipEl.contains(e.relatedTarget))) deskTipHide(); }
/* ---------- 7. גרירת קבצים לכל החלון (גל 2, 11/11/2026) ----------
   אפליקציה רושמת { ok, label, take } (Academy — ספרים, Studio — סרטון). קובץ שנגרר מעל החלון: שכבה עם הכיתוב של מי שמקבל
   (האחרון שנרשם ו־ok() אמת); שחרור → take(files). גרירה שאינה קבצים (טקסט, קישור, תמונה מהדף) — לא נוגעים */
function deskDropOn(h) { if (h && typeof h.take === 'function' && !_desk.drops.includes(h)) _desk.drops.push(h); deskDropWire(); }
function deskDropFiles(dt) { try { return !!dt && Array.from(dt.types || []).includes('Files'); } catch (e) { return false; } }
function deskDropWho() { for (let i = _desk.drops.length - 1; i >= 0; i--) { const h = _desk.drops[i]; try { if (!h.ok || h.ok()) return h; } catch (e) {} } return null; }
function deskDropShow(h) {
  if (!h) { if (_desk.drop) { _desk.drop.remove(); _desk.drop = null; } return; }
  if (_desk.drop) return;
  const v = deskEl('div', 'dk-drop'); v.setAttribute('aria-hidden', 'true');
  const b = deskEl('div', 'dk-drop-box'); b.textContent = (h.label && h.label()) || t('dkDropT');
  v.append(b); document.body.append(v); _desk.drop = v;
}
function deskDropWire() {
  if (_desk.dropWired || typeof document === 'undefined' || typeof document.addEventListener !== 'function') return;
  _desk.dropWired = true;
  let depth = 0;
  document.addEventListener('dragenter', (e) => { if (!deskDropFiles(e.dataTransfer)) return; depth++; deskDropShow(deskDropWho()); });
  document.addEventListener('dragover', (e) => { if (!deskDropFiles(e.dataTransfer) || !deskDropWho()) return; e.preventDefault(); try { e.dataTransfer.dropEffect = 'copy'; } catch (er) {} });
  document.addEventListener('dragleave', (e) => { if (!deskDropFiles(e.dataTransfer)) return; if (--depth <= 0) { depth = 0; deskDropShow(null); } });
  document.addEventListener('drop', (e) => {
    depth = 0; deskDropShow(null);
    const h = deskDropFiles(e.dataTransfer) ? deskDropWho() : null;
    if (!h) return;
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length) { try { h.take(files); } catch (er) {} }
  });
}
function deskInit() {
  if (typeof window === 'undefined' || typeof document === 'undefined' || _desk.wired || !document.documentElement) return;
  // חלון/מסמך מדומים בבדיקות (vm) — בלי מאזינים
  if (typeof window.addEventListener !== 'function' || typeof document.addEventListener !== 'function') return;
  _desk.wired = true;
  try { deskInputInit(); } catch (e) {}
  document.addEventListener('keydown', deskKey);
  document.addEventListener('mouseover', deskWheelOver, { passive: true });
  document.addEventListener('mouseover', deskTipOver, { passive: true });
  document.addEventListener('mouseout', deskTipOut, { passive: true });
  for (const ev of ['pointerdown', 'scroll', 'wheel']) document.addEventListener(ev, () => { if (_desk.tipEl) deskTipHide(); }, { capture: true, passive: true });
  document.addEventListener('keydown', (e) => { if (_desk.tipEl && e.key === 'Escape') deskTipHide(); }, true);
  window.addEventListener('blur', () => { if (_desk.tipEl) deskTipHide(); });
  let rt = 0;
  window.addEventListener('resize', () => { cancelAnimationFrame(rt); rt = requestAnimationFrame(deskMode); }, { passive: true });
  // אחרי כל לחיצה / "חזור" — ההדגשה בסרגל מתעדכנת (המעברים של האפליקציות לא עוברים תמיד דרך החוגה)
  document.addEventListener('click', deskSoon, true);
  window.addEventListener('popstate', () => setTimeout(deskSoon, 0));
  const go = () => deskMode();
  if (document.body) go(); else document.addEventListener('DOMContentLoaded', go, { once: true });
}
if (typeof window !== 'undefined' && typeof document !== 'undefined' && document.documentElement) {
  // לפני הציור הראשון: מסגרת המחשב (בלי קפיצה מהחוגה לסרגל) ומצב הקלט
  try { if (deskWide()) document.documentElement.classList.add('dk'); if (deskSideHidden()) document.documentElement.classList.add('dk-hide'); } catch (e) {}
  try { deskInit(); } catch (e) {}
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

/* ---------------- 14/10/2026: החלקה ומעבר עמודים — חוקיות אחת בשלוש האפליקציות (בקשת המשתמש) ----------------
   הספים כוילו ב־Invest (v279→v281) ומשותפים ל־Academy ול־Studio: החלקה = עמוד (שליש מהרוחב, או הטלה מהירה מ־15%).
   **אין "החלקה קצרה" לטאבים בשום מקום** (בקשת המשתמש — בוטלה ברשימות המעקב, בשתי הספריות ובלשוניות של Studio):
   בין טאבים בתוך עמוד עוברים רק בלחיצה. */
const PAGE_SWIPE_FRAC = 0.33, PAGE_SWIPE_MIN = 96, PAGE_SWIPE_EDGE = 22;
const PAGE_FLING_V = 0.45, PAGE_FLING_FRAC = 0.15, PAGE_FLING_MIN = 56;
/* מה ההחלקה עושה (טהורה, נבדקת): d = מרחק בכיוון, w = רוחב, v = מהירות בשחרור (px/ms). מחזיר 'page' | null. */
function pageSwipeDecide(d, w, v) {
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
/* תצוגת מחשב (html.dk, 11/11/2026): בלי קובייה בין עמודים — מעבר מיידי ורך, והחלקת עמודים כבויה (סרגל הצד במקום החוגה).
   האנימציות הקטנות (growIn, כניסת תמונה) — לפי cubeReduce בלבד */
function cubeDesk() { try { return typeof document !== 'undefined' && !!document.documentElement && document.documentElement.classList.contains('dk'); } catch (e) { return false; } }
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
/* טהורה (נבדקת): האם הפאה פונה למצלמה. פאה שהגב שלה פונה אליך מוסתרת כולה (opacity) — backface-visibility לבד לא מספיק:
   שכבה מורכבת בתוכה (ההדר בזכוכית, backdrop-filter) מצוירת גם מהגב, ובסוף הסיבוב הופיעה הפוכה מעל הדף החדש
   (דיווח המשתמש 14/10/2026). n·(מצלמה − מרכז הפאה) > 0  ⇔  cos a > h / (P + zb + h) */
function cubeVisible(p, side, isIn, vw) {
  const q = Math.max(0, Math.min(1, +p || 0)), th = q * Math.PI / 2, h = vw / 2;
  const zb = h * (Math.cos(th) + Math.sin(th) - 1);
  const a = (-side * q * 90 + (isIn ? side * 90 : 0)) * Math.PI / 180;
  return Math.cos(a) > h / (CUBE_P * vw + zb + h);
}
/* טהורה (נבדקת): מיקום כל 1/CUBE_HZ שנ׳ — קפיץ מרוסן קריטית שממשיך מהמהירות של האצבע (p לשנייה).
   14/10/2026, אחרי מדידה פריים־פריים (בקשת המשתמש: "הסוף לא חלק"): (1) בלי "קליק" בסוף — הקפיץ האמיתי רק מתקרב, ובפריים
   האחרון היה קופץ פי 3–4 מהפריים שלפניו; עכשיו השארית נמוגה ברכות עד אפס (הזנב האיטי נחתך בלי קפיצה); (2) בלי בלימה פתאומית
   בהחלקה מהירה — קפיץ שהיה עובר את הסוף נחתך בגבול ונעצר בבת אחת; עכשיו הקפיץ מתקשח כך שמגיע בדיוק בלי לעבור, מאותה מהירות;
   (3) 120 פריימים לשנייה — במסך של 120Hz אין מדרגות בין פריימים של 60 */
const CUBE_HZ = 120;
function cubeSpring(p0, v0, p1) {
  const A = p0 - p1, v = +v0 || 0;
  // מהירות לכיוון היעד שגדולה מ־w·|A| הייתה עוברת אותו — קפיץ קשיח יותר: מגיע בלי לעבור, בדיוק באותה מהירות התחלתית
  const w = Math.min(60, Math.max(CUBE_W, (v * A < 0 && Math.abs(A) > 1e-4) ? Math.abs(v / A) : 0));
  const B = v + w * A, xs = [];
  for (let i = 0; i < CUBE_HZ; i++) {
    const t = i / CUBE_HZ, e = Math.exp(-w * t), x = p1 + (A + B * t) * e, vx = (B - w * (A + B * t)) * e;
    xs.push(x);
    if (i > 4 && Math.abs(x - p1) < 0.006 && Math.abs(vx) < 0.25) break;   // פחות ממעלה — הזנב "זוחל" ולא נראה
  }
  const n = xs.length - 1;
  // השארית נמוגה: (1 − (i/n)³) — בהתחלה בלי שינוי (המהירות של האצבע נשמרת), בסוף מגיע ליעד בלי קפיצה
  return xs.map((x, i) => Math.max(0, Math.min(1, i === n ? p1 : p1 + (x - p1) * (1 - Math.pow(i / n, 3)))));
}
/* טהורה (נבדקת): מהירות האצבע בשחרור (פיקסלים לאלפית, עם סימן) — כמו VelocityTracker של אנדרואיד:
   ריבועים פחותים משוקללים על 80 האלפיות האחרונות (האחרונות שוקלות יותר), ואצבע שעמדה במקום לפני השחרור = 0.
   עד 14/10/2026 — ממוצע על 100 אלפיות: אצבע שהאטה בסוף "זרקה" את הקובייה קדימה, ואצבע שעצרה — עוד יותר */
function swipeVelocity(samples, now) {
  const s = samples || [];
  if (s.length < 2 || now - s[s.length - 1][0] > 50) return 0;
  const pts = s.filter((p) => now - p[0] <= 80);
  if (pts.length < 2) return 0;
  const t0 = pts[0][0];
  let sw = 0, st = 0, sx = 0, stt = 0, stx = 0;
  for (const [t, x] of pts) { const w = 1 + (t - t0) / 40, u = t - t0; sw += w; st += w * u; sx += w * x; stt += w * u * u; stx += w * u * x; }
  const den = sw * stt - st * st;
  return den > 1e-9 ? (sw * stx - st * sx) / den : 0;
}
/* 14/10/2026 (בקשת המשתמש — שלוש אפליקציות נפרדות לאנדרואיד): כל אפליקציה נפתחת עם ‎#app=… (MainActivity) —
   הסימן נשמר ללשונית (sessionStorage), וממנו המעבר בתפריט פותח את האפליקציה *המותקנת* של השנייה (intent עם החבילה
   שלה). לא מותקנת → Chrome עובר לאותה כתובת באותו מסך (browser_fallback_url; המקור מאומת — בלי שורת כתובת).
   רק בכתובות הייצור — יש APK רק להן. Invest שומרת את המזהה הישן (ההתקנה מתעדכנת במקום, הווידג'ט נשאר). */
const APK_PKGS = { invest: 'io.github.yishaiguedj1.snowball', academy: 'app.thesnowball.academy', studio: 'app.thesnowball.studio' };
const SS_INAPK = 'pwa_in_apk';
function inApk() { try { return sessionStorage.getItem(SS_INAPK) === '1'; } catch (e) { return false; } }
/* Academy/Studio בפתיחה: מסמנים ומנקים ‎app=/‎n= מהכתובת (ב־Invest — appSessionFromHash, שגם שומר את חתימת הווידג'ט) */
function apkFromHash() {
  let h = '';
  try { h = String(location.hash || ''); } catch (e) { return false; }
  if (!/(?:^#|&)app=[0-9a-z]{1,16}/.test(h)) return false;
  try { sessionStorage.setItem(SS_INAPK, '1'); } catch (e) {}
  apkUpdFromHash(h);
  const rest = h.replace(/^#/, '').split('&').filter((x) => x && !/^(app|n|upd)=/.test(x)).join('&');
  try { history.replaceState(history.state, '', location.pathname + location.search + (rest ? '#' + rest : '')); } catch (e) {}
  return true;
}
function apkIntentUrl(url) {
  const m = /^https:\/\/(invest|academy|studio)\.thesnowball\.app(\/.*)?$/.exec(String(url || ''));
  if (!m) return '';
  return 'intent://' + m[1] + '.thesnowball.app' + (m[2] || '/') + '#Intent;scheme=https;package=' + APK_PKGS[m[1]] + ';S.browser_fallback_url=' + encodeURIComponent(url) + ';end';
}
/* 08/11/2026 (בקשת המשתמש: "עדכון כמו עדכון המערכת במכשיר"): שורת "עדכון תוכנה" בכרטיס "אפליקציה" בהגדרות — רק
   בתוך אפליקציית האנדרואיד. MainActivity מוסיף ל־hash ‎upd=<חבילה>~<גרסה>~<1 אם יש עדכון> (Upd.hashParam), ונגיעה פותחת
   את המסך הנייטיב (UpdActivity: בדיקה, "עדכון" — ההורדה וההתקנה ברקע, התראה בסיום). החבילה מהאפליקציה עצמה — כך גם
   Admin והבועה (לא ב־APK_PKGS) פותחות את המסך של עצמן */
const SS_APKUPD = 'pwa_apk_upd';
function apkUpdFromHash(hash) {
  const m = /(?:^#|&)upd=([a-z][a-z0-9_.]{2,80})~(\d{1,12})~([01])(?:&|$)/.exec(String(hash || ''));
  if (!m) return;
  try { sessionStorage.setItem(SS_APKUPD, JSON.stringify({ p: m[1], c: +m[2], u: m[3] === '1' })); } catch (e) {}
}
function apkUpdInfo() {
  try { const v = JSON.parse(sessionStorage.getItem(SS_APKUPD) || 'null'); return v && typeof v.p === 'string' ? v : null; } catch (e) { return null; }
}
/* הקובץ של כל אפליקציה בקישור הקבוע (= APKS ב־tools/apk-latest.js) — לאפליקציה ישנה בלי מסך העדכון: נגיעה מורידה
   את הגרסה החדשה (browser_fallback_url) במקום לא לעשות כלום */
const APK_FILES = { 'io.github.yishaiguedj1.snowball': 'the-snowball.apk', 'app.thesnowball.academy': 'the-snowball-academy.apk',
  'app.thesnowball.studio': 'the-snowball-studio.apk', 'app.thesnowball.admin': 'the-snowball-admin.apk', 'app.thesnowball.bubble': 'the-snowball-bubble.apk' };
/* מוסיף (או מרענן אחרי החלפת שפה) את השורה מתחת ל"גרסה" ברשימה של כרטיס "אפליקציה".
   pkg = החבילה של האפליקציה כשהדף נפתח מתוכה (‎app= ב־hash) — גם בלי ‎upd=: נגיעה באייקון כשה־TWA כבר פתוח רק מחזירה
   את הדף הקיים (MainActivity לא נוצר, אין hash חדש), ואחרי עדכון ה־APK הדף הישן נשאר — השורה חייבת להופיע בכל זאת
   (08/11/2026, צילום מסך של המשתמש: Invest 1.0.271 מותקנת, השורה חסרה) */
function apkUpdMount(list, pkg) {
  if (!list || typeof document === 'undefined') return;
  const old = list.querySelector('#apkUpd');
  if (old) old.remove();
  const info = apkUpdInfo() || (pkg ? { p: pkg, c: 0, u: false } : null);
  if (!info || !/^[a-z][a-z0-9_.]{2,80}$/.test(info.p)) return;
  const row = document.createElement('button');
  row.type = 'button'; row.className = 'ios-row ios-row-btn'; row.id = 'apkUpd';
  const lbl = document.createElement('span'); lbl.className = 'ios-row-lbl'; lbl.textContent = t('apkUpdLbl');
  row.append(lbl);
  if (info.u) {
    const val = document.createElement('span'); val.className = 'ios-row-val'; val.textContent = t('apkUpdNew');
    val.style.color = 'var(--loss)';
    row.append(val);
  }
  const fb = APK_FILES[info.p] ? ';S.browser_fallback_url=' + encodeURIComponent('https://github.com/yishaiguedj1/portfolio-pwa/releases/download/android-latest/' + APK_FILES[info.p]) : '';
  // ‎?l= — המסך הנייטיב בשפת הממשק (לא בשפת הטלפון; בקשת המשתמש 08/11/2026)
  row.addEventListener('click', () => {
    const lg = (typeof getLang === 'function' ? getLang() : 'he') === 'en' ? 'en' : 'he';
    location.href = 'intent://open?l=' + lg + '#Intent;scheme=snbupd;package=' + info.p + fb + ';end';
  });
  const ver = list.querySelector('#appVersion');
  const after = ver && ver.closest('.ios-row');
  if (after && after.parentNode === list) after.after(row); else list.prepend(row);
}
/* מעבר לאפליקציה אחרת — מהתפריט ומ"THE SNOWBALL".
   14/10/2026 (סרטון המשתמש: Academy/Studio "נתקעות" — מסך שחור וחזרה ל־Invest): סגירת התפריט מחזירה את הרשומה שלו
   (modalDone → history.back, אסינכרוני). עם prerender המעבר לדף שהוכן מראש מיידי, וה"אחורה" שעוד חיכה רץ *אחריו* —
   מהאפליקציה החדשה חזרה ל־Invest. לכן עוברים רק אחרי שה"אחורה" הסתיים (afterBack); רשת ביטחון — 700ms */
function appGo(url) {
  const to = (inApk() && apkIntentUrl(url)) || url;
  let gone = false;
  const go = () => { if (gone) return; gone = true; location.href = to; };
  afterBack(go);
  if (!gone) setTimeout(go, 700);
}
/* 14/10/2026 (סרטון המשתמש — מסך שחור במעבר בין האפליקציות): כשהתפריט נפתח, Chrome מכין ברקע את האפליקציות
   האחרות (Speculation Rules — prerender), והלחיצה מחליפה לדף שכבר מצויר. אותו אתר (thesnowball.app) — היעד מסכים
   בכותרת Supports-Loading-Mode (_headers); ב־CSP ‏'inline-speculation-rules'. דפדפן בלי תמיכה / חיסכון בנתונים — כלום */
/* הטקסט קבוע לכל זוג כתובות — ה־CSP מאשר אותו לפי hash (עם hash במדיניות Chrome מתעלם מ־'inline-speculation-rules'),
   ו־tests/prerender.test.js בודק שכל ששת הצירופים (3 אפליקציות × ייצור/ניסוי) בכל הדפים */
const PRE_RE = /^https:\/\/(invest|academy|studio)(-staging)?\.thesnowball\.app\/$/;
function preRulesText(urls) { return JSON.stringify({ prerender: [{ source: 'list', urls: urls, eagerness: 'immediate' }] }); }
function appPrerender(urls) {
  try {
    if (typeof document === 'undefined' || !urls || !urls.length || window._snbPre) return;
    if (inApk()) return;   // באפליקציה לאנדרואיד המעבר פותח את האפליקציה המותקנת — אין מה להכין
    if (!(window.HTMLScriptElement && HTMLScriptElement.supports && HTMLScriptElement.supports('speculationrules'))) return;
    if (navigator.connection && navigator.connection.saveData) return;
    const list = urls.filter((u) => u && String(u).split('#')[0] !== location.href.split('#')[0]);
    if (!list.length || !list.every((u) => PRE_RE.test(u))) return;   // רק בין הכתובות של האפליקציות (ייצור / ניסוי)
    window._snbPre = 1;
    const s = document.createElement('script');
    s.type = 'speculationrules';
    s.textContent = preRulesText(list);
    document.head.appendChild(s);
  } catch (e) {}
}
/* 14/10/2026 (בקשת המשתמש — "בלי קפיצות"): הודעה שמופיעה בדף שכבר מוצג (פס התראה, שגיאת רשת) נפתחת בגובה —
   התוכן שמתחתיה זז ברצף ולא קופץ. growWatch: רק מה שנוסף אחרי שהדף הוצג (מה שהיה בציור הראשון — חלק מהדף),
   ולא מה שכבר היה גלוי בציור הקודם (ציור מחדש של אותו דף) */
function growIn(el, ms) {
  if (!el || cubeReduce() || typeof el.animate !== 'function') return;
  const cs = getComputedStyle(el), hh = el.offsetHeight;
  if (!hh) return;
  const z = { height: '0px', opacity: 0, paddingTop: '0px', paddingBottom: '0px', marginTop: '0px', marginBottom: '0px', overflow: 'hidden' };
  const f = { height: hh + 'px', opacity: 1, paddingTop: cs.paddingTop, paddingBottom: cs.paddingBottom, marginTop: cs.marginTop, marginBottom: cs.marginBottom, overflow: 'hidden' };
  try { el.animate([z, f], { duration: ms || 340, easing: 'cubic-bezier(.2,.9,.25,1)' }); } catch (e) {}
}
function growWatch(root, sel, view) {
  if (!root || typeof MutationObserver === 'undefined') return;
  let seen = new Set(), vk = null, at = 0, q = 0;
  const sig = (e) => e.className + '|' + (e.dataset.k || '');   // לא לפי הטקסט — מספר שמתעדכן בפס קיים לא "פותח" אותו שוב
  const scan = () => {
    q = 0;
    const els = [...root.querySelectorAll(sel)].filter((e) => e.getClientRects().length);
    const k = view(), now = Date.now();
    if (k !== vk) { vk = k; at = now; seen = new Set(els.map(sig)); return; }
    const next = new Set();
    for (const e of els) { const s = sig(e); next.add(s); if (!seen.has(s) && now - at > 400) growIn(e); }
    seen = next;
  };
  new MutationObserver(() => { if (!q) { q = 1; Promise.resolve().then(scan); } }).observe(root, { childList: true, subtree: true });
}
/* מכין אלמנט להיות פאה. o.fix = {top, left, width} — מוצמד למסך במקום הזה; o.clip — נחתך לגובה המסך (עמוד ארוך) */
function cubeFace(el, o) {
  // 02/11/2026 (סבב קפיצות 8): מעבר ב־View Transition — הפאות הן הצילום של הדף היוצא (old) והדף החי (new); אין אלמנט לעצב
  if (el && el._vtG) return cubeVTFace(el._vtG, false);
  if (el && el._cubeVT) return cubeVTFace(el._cubeVT, true);
  const st = el.style, f = { el: el, css: st.cssText };
  if (o && o.fix) { st.position = 'fixed'; st.top = o.fix.top + 'px'; st.left = o.fix.left + 'px'; st.width = o.fix.width + 'px'; st.right = 'auto'; st.margin = '0'; }
  st.transform = '';
  const r = el.getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight, n = (x) => Math.round(x * 10) / 10;
  st.transformOrigin = n(vw / 2 - r.left) + 'px ' + n(vh / 2 - r.top) + 'px';
  // חיתוך לגובה המסך בלבד — לא לרוחב: צל של כרטיס בשוליים נחתך בזמן הסיבוב והופיע בבת אחת בסופו (נמדד)
  if (o && o.clip) st.clipPath = 'inset(' + n(Math.max(0, -r.top)) + 'px -60px calc(100% - ' + n(Math.max(0, vh - r.top)) + 'px) -60px)';
  st.backfaceVisibility = 'hidden'; st.webkitBackfaceVisibility = 'hidden'; st.willChange = 'transform';
  if (o && o.dead) st.pointerEvents = 'none';   // רק היוצא; הנכנס לחיץ כבר בזמן הסיבוב
  // 29/10/2026 (סרטון המשתמש, Studio — בכל מעבר): זכוכית (backdrop-filter) בתוך פאה מסתובבת נצבעה בטלפון כפס אטום מתחת
  // להדר שחתך את חצי הכותרת הגדולה, ונעלמה רק אחרי הנחיתה. בזמן הסיבוב — בלי זכוכית (styles.css: ‎.cube-face ב־Studio וב־Academy), גם בעמוד גלול
  if (el.classList) { el.classList.add('cube-face'); f.face = true; }
  st.outline = 'none';                   // טבעת הפוקוס של שכבה (Academy/Studio) הסתובבה איתה כמסגרת כהה
  // 14/10/2026 (נמדד): ההדר בזכוכית (backdrop-filter) בתוך פאה מסתובבת מחושב מחדש בכל פריים — 50ms לפריים במקום 16.
  // פאה בראש הגלילה — מאחורי ההדר רק הרקע האחיד, והטשטוש לא משנה כלום: מכבים אותו (cube-flat) בלי שום הבדל נראה.
  // התוכן נגלל אל מתחת להדר (גלילה שחוזרת למקום אחרי הציור) — הטשטוש חוזר מיד, באמצע התנועה ולא בסופה
  if (!(el.scrollTop > 0) && el.classList) {
    el.classList.add('cube-flat');
    const un = () => { el.classList.remove('cube-flat'); el.removeEventListener('scroll', un); };
    el.addEventListener('scroll', un, { passive: true });
    f.flat = un;
  }
  return f;
}
/* 01/11/2026 (סבב קפיצות 7 — הקלטה: גלילה מהירה בחוגה, דף ריק עד נגיעה; שוחזר ב־Playwright במגע): פאה ששוחררה מסומנת (off),
   ושום כתיבה מאוחרת לא נוגעת בה — החימום (cubeWarmEnd, שני פריימים אחרי) של קובייה שכבר נחתה כתב על העמוד ששוחרר
   rotateY(±90deg) + opacity 0, ובגלילה מהירה זה נשאר גם על העמוד הגלוי */
function cubeFaceOff(f) { if (f && f.pe) { f.off = true; if (f.hold) { try { f.hold.cancel(); } catch (e) {} f.hold = null; } return; } if (f && f.el) { f.off = true; f.el.style.cssText = f.css; if (f.flat) f.flat(); if (f.face) f.el.classList.remove('cube-face'); } }
/* 29/10/2026 (הסבב השלישי, שני סרטוני המשתמש — Invest ו־Academy): בפריים הראשון של הסיבוב הדף הנכנס היה לבן (ב־Academy גם
   ההעתק של היוצא — רק הכריכה נראתה). הנכנס מתחיל ב־90° = opacity 0, והדפדפן לא מצייר (raster) שכבה בלתי נראית; ההעתק
   הוא שכבה חדשה. ברגע שהן נחשפות באמצע האנימציה — אין עדיין אריחים, ומוצג לבן. "חימום": שני פריימים לפני התנועה הפאות
   במקום (בלי סיבוב), הנכנס ב־opacity 0.01 — מצויר ולא נראה. בזמן הזה cubeSet רק שומר את p, ו־cubeRun מחכה */
const CUBE_WARM_OP = '0.01';
function cubeWarm(c) {
  if (c.warm !== undefined) return;
  c.warm = false;
  const vg = (c.in && c.in.vt) || (c.out && c.out.vt);
  if (vg) { if (!vg.ready && !vg.dead) { c.warm = true; vg.wait.push(c); } return; }   // הפסאודו־אלמנטים עוד לא קיימים — cubeWarmEnd ב־ready
  if (!c.in || c.rub || typeof requestAnimationFrame !== 'function' || (typeof document !== 'undefined' && document.hidden)) return;
  c.warm = true;
  for (const f of [c.out, c.in]) { if (f && f.el && !f.off) { f.el.style.transform = 'none'; f.el.style.opacity = f === c.in ? CUBE_WARM_OP : ''; } }
  requestAnimationFrame(() => requestAnimationFrame(() => cubeWarmEnd(c)));
}
function cubeWarmEnd(c) {
  if (!c.warm) return;
  c.warm = false;
  const r = c.warmRun; c.warmRun = null;
  if (r) return r();
  if (c.in && (c.in.pe ? c.in.off : (c.in.el && c.in.el.classList && !c.in.el.classList.contains('cube-face')))) return;   // בוטל בינתיים (cubeFaceOff) — לא נוגעים
  cubeSet(c, c.p || 0);
}
function cubeSet(c, p) {
  const vw = window.innerWidth;
  cubeWarm(c);
  c.p = p;
  if (c.warm) return;
  if (c.rub) { if (c.out && !c.out.off) faceSet(c.out, cubeTransform(Math.min(CUBE_RUB, p), c.side, false, vw), null); return; }
  for (const [f, isIn] of [[c.out, false], [c.in, true]]) {
    if (!f || f.off) continue;
    faceSet(f, cubeTransform(p, c.side, isIn, vw), cubeVisible(p, c.side, isIn, vw) ? '' : '0');
  }
}
/* מצב קבוע של פאה: אלמנט — סגנון בשורה; פסאודו־אלמנט של View Transition — אנימציה מושהית אחת לכל פאה (setKeyframes) */
function faceSet(f, tr, op) {
  if (!f.pe) { f.el.style.transform = tr; if (op !== null) f.el.style.opacity = op; return; }
  const k = { transform: tr };
  if (op !== null) k.opacity = op === '' ? 1 : +op;
  try { if (f.hold) { f.hold.effect.setKeyframes([k, k]); return; } } catch (e) {}
  try { f.hold = f.el.animate([k, k], { pseudoElement: f.pe, duration: 1e7, fill: 'both' }); f.hold.pause(); } catch (e) {}
}
/* מ־c.p אל p1 בקפיץ (v0 = המהירות בשחרור, p לשנייה); done(p1) אחרי הפריים האחרון. c.finish() = לסיים מיד */
function cubeRun(c, p1, v0, done) {
  if (cubeNow && cubeNow !== c && cubeNow.finish) cubeNow.finish();
  cubeWarm(c);
  if (c.warm) {                            // עוד בחימום — הסיבוב יתחיל כשייגמר; finish = לסיים מיד
    c.warmRun = () => cubeRun(c, p1, v0, done);
    c.finish = () => { c.warm = false; c.warmRun = null; cubeRun(c, p1, v0, done); if (c.finish) c.finish(); };
    cubeNow = c;
    return;
  }
  const vw = window.innerWidth, ps = cubeSpring(c.p || 0, v0 || 0, p1), dur = Math.max(17, (ps.length - 1) * 1000 / CUBE_HZ);
  const anims = [];
  const one = (f, isIn) => {
    if (!f || f.off || typeof f.el.animate !== 'function') return;
    const kf = ps.map((p) => {
      const q = c.rub ? Math.min(CUBE_RUB, p) : p;
      return { transform: cubeTransform(q, c.side, isIn, vw), opacity: c.rub || cubeVisible(q, c.side, isIn, vw) ? 1 : 0 };
    });
    // הפאה שמגיעה למקום — הפריים האחרון בלי תלת־ממד (none): העמוד מצויר חד כבר בפריים הזה, ולא "מתחדד" אחרי שהאנימציה יורדת
    const fin = c.rub ? Math.min(CUBE_RUB, p1) : p1;
    if ((isIn && fin === 1) || (!isIn && fin === 0)) kf[kf.length - 1].transform = 'none';
    const opt = { duration: dur, easing: 'linear', fill: 'forwards' };
    if (f.pe) opt.pseudoElement = f.pe;
    try { anims.push(f.el.animate(kf, opt)); } catch (e) {}
  };
  one(c.out, false); if (!c.rub) one(c.in, true);
  // 14/10/2026 (נמדד בזמן אמת): אנימציה חדשה "ממתינה" 1–3 פריימים עד שהיא מוכנה, והקובייה עמדה במקום ברגע השחרור —
  // עצירה קטנה מול אצבע שזזה. זמן ההתחלה = הפריים הנוכחי: שתי הפאות יחד, והזמן רץ מרגע השחרור.
  // רק כשהפריים האחרון טרי (בגרירה יש פריים בכל תזוזה); דף שעמד — זמן הפריים ישן, והסיבוב היה מדלג על ההתחלה שלו
  try {
    const t0 = document.timeline && document.timeline.currentTime;
    if (t0 != null && typeof performance !== 'undefined' && performance.now() - t0 < 40) anims.forEach((a) => { a.startTime = t0; });
  } catch (e) {}
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
/* 03/11/2026 (סבב קפיצות 10, הקלטת Studio 39.4 שנ׳: במעבר מהבית ל"פרויקט חדש" כרטיס העבודות בפאה היוצאת ריק לכל אורך
   הסיבוב — הכרטיס עצמו והכפתור שמתחתיו כן). גלילה פנימית (‎.st-jobs, שורות שבבים) היא בטלפון שכבה משלה, והצילום/ההעתק של הדף
   היוצא מציג אותה ריקה. בהעתק גם מקום הגלילה הפנימית אבד (cloneNode מתחיל מ־0) — הרשימה "קפצה" לראשה בתחילת המעבר.
   scrollFlat: הגלילה הופכת לחיתוך (overflow: clip — לא מכל גלילה, אין שכבה משלו) והילדים זזים במקום הגלילה (translate דו־ממדי,
   בלי שכבה) — אותם פיקסלים בדיוק, חלק מהשכבה של הדף. from = האלמנטים שמהם קוראים את מקום הגלילה (בהעתק — המקור).
   מחזיר undo (הדף שנשאר — החלקה שבוטלה). el._flat — מאזיני הגלילה של הדף לא שומרים את ה־0 של החיתוך */
const SCROLL_FLAT = '.st-jobs, .st-chips, .st-ky-schemes, .st-code, .lib-chips, .ac-tracks, .mg-strip';
function scrollFlat(root, from) {
  if (!root || !root.querySelectorAll) return () => {};
  const els = [...root.querySelectorAll(SCROLL_FLAT)], src = from ? [...from.querySelectorAll(SCROLL_FLAT)] : els;
  const done = [];
  els.forEach((el, i) => {
    const s = src[i] || el;
    if (s.scrollHeight <= s.clientHeight + 1 && s.scrollWidth <= s.clientWidth + 1) return;   // בלי גלישה — אין גלילה ואין שכבה
    const x = s.scrollLeft, y = s.scrollTop;
    el._flat = true;
    const ov = el.style.overflow;
    el.style.overflow = 'clip';
    const kids = [...el.children], tr = kids.map((k) => k.style.translate);
    if (x || y) for (const k of kids) k.style.translate = (-x) + 'px ' + (-y) + 'px';
    done.push(() => {
      if (!el.isConnected) return;
      kids.forEach((k, j) => { k.style.translate = tr[j]; });
      el.style.overflow = ov;
      el.scrollLeft = x; el.scrollTop = y;
      requestAnimationFrame(() => { el._flat = false; });   // אירוע הגלילה של השחזור — כבר עם המקום הנכון
    });
  });
  return () => { for (const u of done) u(); done.length = 0; };
}
/* Academy / Studio: השכבה נצבעת מחדש באותו אלמנט — הדף היוצא = העתק "מת" שלה (קנבסים, גלילה, שדות), מעליה */
function cubeClone(el) {
  // מעבר קודם עוד רץ על אותה שכבה — מסיימים אותו קודם: אחרת ההעתק והפאה החדשה "שומרים" את הסגנון של אמצע הסיבוב,
  // ובסוף השכבה משוחזרת אליו ונשארת מסובבת (נמצא ב־QA: דף שנדחף מיד אחרי דף אחר בסטודיו)
  if (cubeNow && cubeNow !== _dial.ride && cubeNow.finish) cubeNow.finish();   // נסיעה של החוגה מציירת את השכן בעצמה
  const c = el.cloneNode(true);
  const a = el.querySelectorAll('canvas, input, textarea, select'), b = c.querySelectorAll('canvas, input, textarea, select');
  for (let i = 0; i < a.length && i < b.length; i++) {
    try {
      if (a[i].tagName === 'CANVAS') { b[i].width = a[i].width; b[i].height = a[i].height; b[i].getContext('2d').drawImage(a[i], 0, 0); }
      else b[i].value = a[i].value;
    } catch (e) {}
  }
  c.querySelectorAll('video, audio, iframe').forEach((x) => x.remove());
  // getElementById לא מוצא את ההעתק. בתוך SVG המזהה נשאר: מעבר צבע (url(#…)) בלי המזהה שלו לא מצויר — הגרף בהעתק נעלם (27/10/2026)
  c.querySelectorAll('[id]:not(svg *)').forEach((x) => x.removeAttribute('id'));
  c.removeAttribute('id'); c.classList.add('cube-ghost'); c.setAttribute('aria-hidden', 'true');
  try { c.inert = true; } catch (e) {}
  // 29/10/2026 (המשתמש: "הלוגו מתרענן בכל המעברים"): התמונות בהעתק — בפיענוח מיידי (כבר במטמון), אחרת פריים בלי לוגו
  c.querySelectorAll('img').forEach((x) => { try { x.decoding = 'sync'; } catch (e) {} });
  el.after(c);
  c.scrollTop = el.scrollTop;
  scrollFlat(c, el);                     // סבב קפיצות 10: הגלילות הפנימיות — במקום שלהן, חלק מהשכבה של ההעתק
  animSync(el); animSync(c);             // הלוגו החי בהעתק — באותו רגע של המקור, לא מאפס
  return c;
}
/* 29/10/2026 (סבב קפיצות 4 — סרטון הניתוח: פריים שחור מלא ב־13 מתוך 13 לחיצות על לשונית; גם Studio ו־Academy):
   ההעתק (cubeClone) הוא שכבה חדשה בלי אריחים, והדף האמיתי כבר צויר מחדש ומוסתר בחימום (0.01) — בטלפון, בזמן מגע,
   הדפדפן לא מחכה לצביעה, ובפריים הראשון לא נראה כלום חוץ מהרקע (cube-bd). cubePre: ההעתק נוצר קודם בשקיפות 0.01
   מעל הדף הישן (שעוד גלוי ונצבע), שני פריימים, ורק אז go(ghost) מצייר את הדף החדש ומתחיל את הקובייה.
   קריאה חדשה בזמן ההמתנה — הקודמת רצה מיד (בלי שתי ניווטים במקביל) */
let _cubePre = null;
function cubePre(root, go) {
  if (_cubePre) _cubePre.now();
  if (cubeVTOk(root)) { const v = cubeVTPre(root, go); if (v) return v; }
  const ghost = cubeClone(root);
  if (typeof requestAnimationFrame !== 'function' || (typeof document !== 'undefined' && document.hidden)) { go(ghost); return null; }
  // 01/11/2026 (סבב קפיצות 7, הקלטה של Studio: פריים לבן בתחילת כל מעבר — רק הכפתור שבהדר נראה): בשקיפות 0.01 ההעתק כמעט
  // בלתי נראה, והדפדפן לא מחויב לצייר אותו לפני הפריים שבו הוא נחשף. ההעתק זהה לדף שמתחתיו — בהכנה הוא גלוי לגמרי (אין הבדל
  // בעין), כבר שכבה משלו (אותן תכונות של cubeFace), ובפריים הראשון של הסיבוב הוא מצויר
  ghost.style.willChange = 'transform'; ghost.style.backfaceVisibility = 'hidden'; ghost.style.webkitBackfaceVisibility = 'hidden';
  let done = false;
  const p = { now() { if (done) return; done = true; if (_cubePre === p) _cubePre = null; go(ghost); } };
  _cubePre = p;
  requestAnimationFrame(() => requestAnimationFrame(() => p.now()));
  return p;
}
const cubePreBusy = () => !!_cubePre;
/* 02/11/2026 (סבב קפיצות 8, הקלטת Studio: דף ריק לפריים או שניים בתחילת מעברים ובסופם; docs/smooth-architecture.md — ש2):
   כל מעבר יצר עשרות שכבות GPU חדשות (ההעתק של הדף: ההדר, הלוגו והשלג, הכרטיסים) והרס אותן בנחיתה; בטלפון שכבה חדשה
   מוצגת לפני שצוירה — ריק. מעבר ממוקד לשכבה (element.startViewTransition): הדף היוצא = הצילום של מה שכבר על המסך
   (‎::view-transition-old(root)), הנכנס = הדף החי עצמו (‎::view-transition-new(root)) — אין העתק ב־DOM, אין שכבות חדשות,
   ואין כיבוי של הזכוכית באמצע. הפסאודו־אלמנטים מצוירים בתוך השכבה — החוגה (מחוץ לה) נשארת חיה, לחיצה וזכוכית.
   נגיעה בתוך השכבה בזמן המעבר מגיעה ל־body — מסיימים את המעבר מיד (cubeVTTouch), והלחיצה / הגלילה מגיעות לאלמנט האמיתי.
   בלי התמיכה (דפדפן ישן) — ההעתק הישן. window.__cubeVT = false — הנתיב הישן (השוואה בגלאים) */
let _cubeVTOn = null;
function cubeVTOk(root) {
  if (!root || !root.classList || !(root.classList.contains('st-root') || root.classList.contains('lib-root')) || typeof root.startViewTransition !== 'function') return false;
  if (typeof window !== 'undefined' && window.__cubeVT === false) return false;
  return !cubeReduce() && !cubeDesk() && !(typeof document !== 'undefined' && document.hidden);
}
/* 11/11/2026 (שתי הקלטות של המשתמש, Studio ו־Academy: "קפיצה של כל העמוד" בכל מעבר — רק בדפדפן, לא באפליקציה).
   בדפדפן בטלפון, כשסרגל הכתובת גלוי, כל הדף ירד ~60px (גובה הסרגל) בנחיתה ובפריים שלפני הסיבוב, וקפץ חזרה.
   2.138.2 העביר את הדפדפן להעתק (cubeClone) — והחזיר את כל הפגמים של ההעתק: שכבה חדשה שנחשפת לפני שנצבעה (דף ריק
   2–3 פריימים בחוגה ובחזרה, הלוגו ריק לפני הסיבוב; הקלטה שלישית, 11/11 12:40). 2.142.1: חזרה למעבר הממוקד גם בדפדפן,
   והשורש עצמו: באג ידוע של Chrome (crbug 387030974) — ה־transform שהדפדפן מחשב ל־‎::view-transition-group כולל את
   ההפרש של סרגל הכתובת (ה־"snapshot containing block" מתחיל מתחת לסרגל). אצלנו הקבוצה היא השכבה עצמה, והערך הנכון
   הוא תמיד מטריצת יחידה (נמדד ב־Chromium: גם בשכבה גלולה וגם כשהיא לא בראש המסך). לכן בדפדפן עם מגע — ‎.cube-vt-pin
   (styles.css) מקבע transform: none לקבוצה. באפליקציה ובמחשב — ללא שינוי */
function cubeVTBar() {
  try { return typeof matchMedia === 'function' && matchMedia('(display-mode: browser)').matches && matchMedia('(pointer: coarse)').matches; } catch (e) { return false; }
}
function cubeVTFace(g, isNew) {
  const f = { el: g.root, pe: isNew ? '::view-transition-new(root)' : '::view-transition-old(root)', vt: g };
  if (g.dead) f.off = true; else { g.faces.push(f); if (!isNew) g.faced(); }
  return f;
}
function cubeVTPre(root, go) {
  if (cubeNow && cubeNow !== _dial.ride && cubeNow.finish) cubeNow.finish();   // כמו cubeClone: מעבר קודם נוחת קודם
  if (root._cubeVT) root._cubeVT.remove();
  const g = { root: root, ready: false, dead: false, wait: [], faces: [], vt: null };
  g._vtG = g;
  let res = null, tm = 0, called = false, done = false;
  const dom = new Promise((r) => { res = r; });
  g.faced = () => { if (!res) return; const r = res; res = null; clearTimeout(tm); r(); };
  const clean = () => {
    if (done) return;
    done = true; g.dead = true; g.faced();
    for (const f of g.faces) { f.off = true; if (f.hold) { try { f.hold.cancel(); } catch (e) {} f.hold = null; } }
    unflat();
    root.classList.remove('cube-vt', 'cube-vt-pin');
    if (root._cubeVT === g) root._cubeVT = null;
    if (_cubeVTOn === g) _cubeVTOn = null;
    const w = g.wait; g.wait = [];
    for (const c of w) cubeWarmEnd(c);    // קובייה שחיכתה לצילומים — נוחתת מיד (הפאות כבויות)
  };
  g.remove = () => { const v = g.vt; clean(); if (v) { try { v.skipTransition(); } catch (e) {} } };
  const p = {
    now() {                              // לפני שהצילום של היוצא מוכן — הציור מיד, בלי סיבוב (כמו ההעתק: go סינכרוני)
      if (called) return;
      called = true; if (_cubePre === p) _cubePre = null;
      g.dead = true;
      try { go(g); } catch (e) { if (typeof console !== 'undefined') console.error(e); }
      g.remove();
    },
  };
  const unflat = scrollFlat(root);       // סבב קפיצות 10: הגלילות הפנימיות — בתוך הצילום של היוצא (בדף שנשאר — שחזור ב־clean)
  try {
    g.vt = root.startViewTransition(() => {
      if (called) return;
      called = true; if (_cubePre === p) _cubePre = null;
      try { go(g); } catch (e) { if (typeof console !== 'undefined') console.error(e); }
      if (res && !g.dead) tm = setTimeout(g.faced, 600);   // הציור לא יצר פאה — לא מקפיאים את המסך
      return dom;
    });
  } catch (e) { clean(); return null; }
  root._cubeVT = g; _cubeVTOn = g; _cubePre = p;
  root.classList.add('cube-vt');
  if (cubeVTBar()) root.classList.add('cube-vt-pin');   // 2.142.1: בדפדפן — הקבוצה במקומה, בלי ההפרש של סרגל הכתובת
  cubeVTWire();
  g.vt.ready.then(() => {
    if (g.dead) return;
    g.ready = true;
    const w = g.wait; g.wait = [];
    for (const c of w) cubeWarmEnd(c);
  }, () => clean());
  g.vt.finished.then(clean, clean);
  return p;
}
/* נגיעה בשכבה בזמן המעבר: הפגיעה (hit test) היא ב־body. מסיימים מיד — הלחיצה והגלילה (שנבחרות אחרי touchstart) כבר
   מגיעות לאלמנט האמיתי; התחלה של החלקה עוברת ל־snbSwipe של השכבה (root._snbStart) עם האלמנט שמתחת לאצבע */
function cubeVTTouch(e) {
  const g = _cubeVTOn;
  if (!g || !e.touches || !e.touches[0] || g.root.contains(e.target)) return;
  const t = e.touches[0], r = g.root.getBoundingClientRect();
  if (t.clientX < r.left || t.clientX > r.right || t.clientY < r.top || t.clientY > r.bottom) return;
  if (_cubePre) _cubePre.now();
  if (cubeNow && cubeNow.finish) cubeNow.finish();
  if (_cubeVTOn === g) g.remove();
  let tg = null; try { tg = document.elementFromPoint(t.clientX, t.clientY); } catch (x) {}
  if (tg && g.root.contains(tg) && typeof g.root._snbStart === 'function') g.root._snbStart(e, tg);
}
function cubeVTWire() {
  if (cubeVTWire.on || typeof document === 'undefined' || !document.addEventListener) return;
  cubeVTWire.on = true;
  document.addEventListener('touchstart', cubeVTTouch, { capture: true, passive: true });
}   // ציור במקום (none) בזמן ההמתנה — מחכה לציור של המעבר
/* 30/10/2026 (סבב קפיצות 6, docs/smooth-architecture.md — ש1): סידור ילדים לפי רשימה, בלי לבנות מחדש. צומת שכבר במקומו
   לא זז (נשארים הצביעה, התמונה המפוענחת והשכבה שלו); רק מה שחסר נכנס, מה שעבר מקום זז, ומה שלא ברשימה יוצא.
   לעומת innerHTML = '' + append: אין רגע שבו הרשימה ריקה, ואין צומת חדש לכרטיס שלא השתנה */
function listSync(parent, nodes) {
  if (!parent || !nodes) return;
  const keep = new Set(nodes);
  for (let c = parent.firstChild; c;) { const nx = c.nextSibling; if (!keep.has(c)) parent.removeChild(c); c = nx; }
  let cur = parent.firstChild;
  for (const nd of nodes) {
    if (nd === cur) { cur = cur.nextSibling; continue; }
    parent.insertBefore(nd, cur);
  }
}
/* 29/10/2026 (המשתמש: "גם הלוגו מתרענן כל הזמן בכל המעברים"): אנימציית CSS מתחילה מאפס בכל פעם שהאלמנט נכנס ל־DOM —
   הלוגו החי (ריחוף, פנים, ברק, שלג) "התאפס" בכל ציור של הבית, בהעתק של הקובייה ובכל חזרה. מצמידים את האנימציות
   האינסופיות של הלוגו לשעון של הדף (startTime 0): בכל כניסה ובכל העתק — אותו רגע בדיוק, כאילו לא יצא אף פעם.
   מושהית (html.calm) — לא נוגעים */
function animSync(el) {
  if (!el || typeof el.getAnimations !== 'function') return;
  try {
    for (const a of el.getAnimations({ subtree: true })) {
      const t = a.effect && a.effect.target;
      if (!a.animationName || !t || !t.closest || !t.closest('.brand') || a.playState !== 'running') continue;
      if (a.effect.getTiming().iterations !== Infinity || a.startTime === 0) continue;
      a.startTime = 0;
    }
  } catch (e) {}
}
function cubeBackdropReal(el) { const d = document.createElement('div'); d.className = 'cube-bd'; el.before(d); return d; }   // הקפיץ — השכבה עצמה זזה
function cubeBackdrop(el) {              // מתחת לשכבה — רקע אטום, כדי שמה שמאחוריה (התיק) לא יבצבץ בין הפאות (לקח v330)
  // מעבר ממוקד (cubeVTPre) — הרקע הוא של הפסאודו־אלמנט ‎::view-transition (styles.css), לא שכבה חדשה ב־DOM
  if (el && (el._cubeVT || cubeVTOk(el))) return { remove() {} };
  const d = document.createElement('div');
  d.className = 'cube-bd';
  el.before(d);
  return d;
}
/* 14/10/2026 (בקשת המשתמש — Academy, בין שתי הספריות): רק מה שמתחת לבורר מסתובב, כמו ב־Invest מתחת ללשוניות.
   רצועה קבועה = העתק של מה שמעל y בדף החדש (ההדר והבורר), מעל הפאות ובלי סיבוב; הפאות נחתכות מתחתיה (cubeClipTop).
   מעתיקים רק את מה שמעל הקו — לא את כל הדף */
function cubeHold(root, y) {
  const top = root.getBoundingClientRect().top;
  if (!(y > top + 1)) return null;
  const copy = (el, hh) => {
    const c = el.cloneNode(false);
    for (const ch of el.childNodes) {
      if (ch.nodeType !== 1) { c.appendChild(ch.cloneNode(true)); continue; }
      const b = ch.getBoundingClientRect();
      if ((!b.width && !b.height) || b.top >= y) continue;
      c.appendChild(b.bottom <= y + 0.5 ? ch.cloneNode(true) : copy(ch, b.height));
    }
    // 29/10/2026 (גלאי הנחיתה, הניתוח — מעבר בין הלשוניות): אב שהועתק חלקית — בגובה המקורי. אלמנט דביק (sticky) לא חורג
    // מתחתית האב שלו; באב הקצוץ הלשוניות נדחפו ברצועה 4px למעלה וירדו בנחיתה
    if (hh > 0) { c.style.boxSizing = 'border-box'; c.style.minHeight = hh + 'px'; }
    return c;
  };
  const c = copy(root);
  c.querySelectorAll('[id]:not(svg *)').forEach((x) => x.removeAttribute('id'));
  c.removeAttribute('id'); c.classList.add('cube-hold', 'cube-flat'); c.setAttribute('aria-hidden', 'true');
  try { c.inert = true; } catch (e) {}
  const r = root.getBoundingClientRect(), st = c.style;
  st.position = 'fixed'; st.top = r.top + 'px'; st.left = r.left + 'px'; st.width = r.width + 'px'; st.height = (y - r.top) + 'px';
  st.bottom = 'auto'; st.right = 'auto'; st.overflow = 'hidden'; st.zIndex = '902'; st.pointerEvents = 'none'; st.transform = 'none'; st.clipPath = 'none';
  // 29/10/2026 (גלאי הנחיתה, Academy — מעבר בין המדפים): רקע מדורג (הזוהר של הזכוכית, radial-gradient ביחס לגודל) נדחס לגובה
  // הרצועה, והזוהר מאחורי ההדר "קפץ" בנחיתה. הרקע של הרצועה — בגודל השכבה המלאה, כמו שהוא נראה בה
  st.backgroundSize = r.width + 'px ' + r.height + 'px'; st.backgroundPosition = '0 0'; st.backgroundRepeat = 'no-repeat';
  (root.parentNode || document.body).appendChild(c);
  c.scrollTop = root.scrollTop;
  return c;
}
function cubeClipTop(f, y) {             // הפאה נחתכת מתחת לרצועה הקבועה (לפני הסיבוב — מידות אמיתיות)
  if (!f || !f.el || f.pe) return;
  f.el.style.clipPath = 'inset(' + Math.max(0, Math.round((y - f.el.getBoundingClientRect().top) * 10) / 10) + 'px 0 0 0)';
}
/* מעבר שלם בשכבה (לחיצה, "חזור"): ghost = הדף היוצא (cubeClone, לפני הציור), root = הדף החדש שכבר צויר.
   hold = {y, on(el, p|'commit'|'cancel')} — רצועה קבועה מעל y (cubeHold) */
function cubeGhostRun(root, ghost, side, hold) {
  const bd = cubeBackdrop(root);
  const hy = hold && hold.y > 0 ? hold.y : 0, he = hy ? cubeHold(root, hy) : null;
  const c = { side: side, p: 0, out: cubeFace(ghost, { dead: true }), in: cubeFace(root) };
  if (he) { cubeClipTop(c.out, hy); cubeClipTop(c.in, hy); if (hold.on) { hold.on(he, 0); hold.on(he, 'commit'); } }
  cubeSet(c, 0);
  return new Promise((res) => cubeRun(c, 1, 0, () => { cubeFaceOff(c.in); ghost.remove(); bd.remove(); if (he) he.remove(); res(); }));
}
function cubeSlideIn(els, dir) {         // טאב פנימי חדש נכנס מהצד (כמו החלפת רשימת מעקב — wlSlide)
  if (cubeReduce()) return;
  for (const e of els) { try { e.animate([{ opacity: 0, transform: 'translateX(' + (28 * dir) + 'px)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.2, .9, .25, 1)' }); } catch (x) {} }
}
/* ההחלקה של Academy ו־Studio — העתק של המחווה של Invest (wirePageSwipe) על שכבה בגלילה פנימית.
   o.root — השכבה (האזנה עליה; התוכן מתחלף בתוכה); o.ok() — אפשר להתחיל עכשיו;
   o.page(next) → {render(), undo(), commit()} | null — העמוד השכן: render מצייר אותו לתוך root (הדף היוצא = העתק),
   undo מחזיר את הקודם (אפשר Promise), commit = ההיסטוריה. */
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
  function begin(s) {                    // התזוזה של העמוד מתחילה — העמוד השכן נצבע, או "קפיץ" כשאין
    const pg = o.page ? o.page(s.next) : null;
    const bd = pg ? cubeBackdrop(root) : cubeBackdropReal(root);
    if (!pg) { s.cube = { side: s.side, p: 0, rub: true, out: cubeFace(root, { dead: true }), bd: bd }; if (o.dial) dialCubeBegin(s.cube, o.dial(), null, s.side); return; }
    // 29/10/2026 (סבב קפיצות 4): ההעתק נצבע שני פריימים לפני שהשכן מצויר (cubePre) — הדף הישן גלוי בינתיים, האצבע ממשיכה
    // (move שומר את p), ו־end/cancel בזמן ההמתנה מסיימים אותה מיד (s.pre.now)
    if (typeof cubePre === 'function') {
      s.pre = cubePre(root, (ghost) => { s.pre = null; beginWith(s, pg, bd, ghost); if (s.cube) { cubeSet(s.cube, s.p || 0); if (o.dial) dialCube(s.cube); holdOn(s.cube, s.p || 0); } });
      return;
    }
    beginWith(s, pg, bd, cubeClone(root));
  }
  function beginWith(s, pg, bd, ghost) {
    try { pg.render(); } catch (e) { ghost.remove(); bd.remove(); s.cube = null; return; }
    let hy = 0; try { hy = pg.hold ? pg.hold() : 0; } catch (e) {}
    const he = hy > 0 ? cubeHold(root, hy) : null;
    s.cube = { side: s.side, p: 0, out: cubeFace(ghost, { dead: true }), in: cubeFace(root), ghost: ghost, bd: bd, pg: pg, hold: he };
    if (he) { cubeClipTop(s.cube.out, hy); cubeClipTop(s.cube.in, hy); holdOn(s.cube, 0); }
    if (o.dial) dialCubeBegin(s.cube, pg.from, pg.to, s.side);   // 29/10/2026: החוגה של האפליקציה צמודה לעמוד
  }
  function holdOn(c, p) { if (c && c.hold && c.pg && c.pg.holdOn) { try { c.pg.holdOn(c.hold, p); } catch (e) {} } }
  const start = (e, real) => {          // real — האלמנט שמתחת לאצבע כשהנגיעה הגיעה ל־body (מעבר ממוקד, cubeVTTouch)
    if (g) cancel();
    if (cubeNow && cubeNow.finish) cubeNow.finish();
    if (e.touches.length !== 1 || !root.isConnected || (o.ok && !o.ok()) || cubeDesk()) return;
    const t = e.touches[0], w = root.clientWidth || window.innerWidth || 400;
    if (t.clientX < PAGE_SWIPE_EDGE || t.clientX > w - PAGE_SWIPE_EDGE) return;
    const tg = real || e.target;
    if (blocked(tg)) return;
    g = { x0: t.clientX, y0: t.clientY, w: w, lock: 0, act: null, samples: [[clock(), t.clientX]], tg: tg };
    // העמוד השכן נצבע באמצע הגרירה ומוחק את האלמנט שנגעו בו — האירועים ממשיכים להגיע רק אליו (לקח v283 ב־Invest):
    // האזנה עליו וגם על המסמך, וכל אירוע מטופל פעם אחת
    tg.addEventListener('touchmove', move, { passive: false });
    tg.addEventListener('touchend', end, { passive: true });
    tg.addEventListener('touchcancel', cancel, { passive: true });
  };
  root.addEventListener('touchstart', (e) => start(e), { passive: true });
  root._snbStart = start;
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
      g.x0 = t.clientX;                  // הסיבוב מתחיל מאפס ברגע הנעילה — בלי קפיצה של סף הנעילה
    }
    if (e.cancelable) e.preventDefault();
    const now = clock();
    g.samples.push([now, t.clientX]);
    while (g.samples.length > 2 && now - g.samples[0][0] > 150) g.samples.shift();
    const ddx = t.clientX - g.x0, same = (rtl() ? ddx > 0 : ddx < 0) === g.next;
    const d = same ? Math.abs(ddx) : 0, p = Math.min(1, d / g.w);
    g.d = d;
    let act = pageSwipeDecide(d, g.w, 0);
    g.p = p;
    if (p > 0 && !g.cube && !g.pre) begin(g);
    if (g.cube) { cubeSet(g.cube, g.cube.rub ? p * 0.15 : p); dialCube(g.cube); holdOn(g.cube, p); }
    if (act === 'page' && !(g.cube && g.cube.pg)) act = null;
    if (act !== g.act && act === 'page') buzz(12);
    g.act = act;
  }
  function finishCube(s, act, vp) {
    if (s.pre) s.pre.now();              // שחרור לפני שההעתק הוכן — בונים עכשיו וממשיכים מאותה נקודה
    const c = s.cube;
    if (!c) return;
    if (act === 'page') {
      holdOn(c, 'commit');
      dialCubeRun(c, 1, Math.max(0, vp));
      cubeRun(c, 1, Math.max(0, vp), () => { dialCubeDone(c); cubeFaceOff(c.in); c.ghost.remove(); c.bd.remove(); if (c.hold) c.hold.remove(); c.pg.commit(); });
      return;
    }
    holdOn(c, 'cancel');
    dialCubeRun(c, 0, Math.min(0, vp) * (c.rub ? 0.15 : 1));
    cubeRun(c, 0, Math.min(0, vp) * (c.rub ? 0.15 : 1), () => {
      dialCubeDone(c);
      const done = () => { cubeFaceOff(c.in); cubeFaceOff(c.rub ? c.out : null); if (c.ghost) c.ghost.remove(); c.bd.remove(); if (c.hold) c.hold.remove(); };
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
    const v = swipeVelocity(s.samples, clock()) * ((rtl() === s.next) ? 1 : -1);   // בכיוון המשיכה — חיובית = לעבר העמוד הבא
    let act = pageSwipeDecide(s.d || 0, s.w, Math.max(0, v));
    if (act === 'page' && !(s.cube && s.cube.pg)) act = null;
    finishCube(s, act, v * 1000 / s.w);
  }
  function cancel(e) {
    if (!g || seen(e)) return;
    const s = g; g = null;
    unhook(s);
    if (!s.lock) return;
    finishCube(s, null, 0);
  }
}
/* 20/10/2026 (בקשת המשתמש): הסרגל שמתחת להדר (הלשוניות ב־Invest, הבורר בין הספריות ב־Academy) דבוק לתחתית ההדר
   בגלילה — לא ב־8px מלמעלה (שם הוא נעלם מאחורי ההדר, שגובהו ~180px). ‎--appbar-h על <html> = גובה ההדר הנוכחי,
   מתעדכן כשהגובה משתנה (שפה, קפסולת המצב) וכשההדר מוחלף (ציור מחדש בספרייה) — לקרוא אחרי כל ציור של ההדר */
let _barHEl = null, _barHRO = null;
/* 27/10/2026 (מחקר היעילות — "מחכה למשתמש"): האנימציות של הלוגו בהדר (שלג, פנים, ברק, הילה) מציירות את ההדר מחדש בכל
   פריים, גם כשאף אחד לא נוגע בטלפון (נמדד: ~10% ממעבד ראשי בכרום בלי מעבד גרפי). BRAND_CALM_MS אחרי הנגיעה / הגלילה האחרונה
   הן נעצרות (html.calm — animation-play-state בלבד, באותו מקום), וכל נגיעה מחזירה אותן */
const BRAND_CALM_MS = 25e3;
let _calmT = 0, _calmAt = 0;
function brandCalmWire() {
  if (typeof document === 'undefined' || !document.addEventListener || !document.documentElement || !document.documentElement.classList || brandCalmWire.on) return;
  brandCalmWire.on = true;
  const root = document.documentElement;
  const wake = () => {
    const t = Date.now();
    if (root.classList.contains('calm')) root.classList.remove('calm');
    else if (t - _calmAt < 1000) return;                     // גלילה = עשרות אירועים בשנייה — טיימר אחד לשנייה
    _calmAt = t;
    clearTimeout(_calmT);
    _calmT = setTimeout(() => root.classList.add('calm'), BRAND_CALM_MS);
  };
  ['pointerdown', 'keydown', 'wheel', 'scroll', 'focus'].forEach((e) => document.addEventListener(e, wake, { passive: true, capture: true }));
  wake();
}
brandCalmWire();

function barHeightVar() {
  if (typeof document === 'undefined' || !document.querySelector) return;
  /* 21/10/2026 (סרטון המשתמש — הבורר של Academy קפץ אל שורת החיפוש): הגובה בפריסה (offsetHeight), לא getBoundingClientRect —
     באמצע מעבר בקובייה ההדר מסובב והמלבן שלו גדל (~240 במקום ~120), והבורר נדבק נמוך מדי עד הציור הבא; וגם לא ההעתקים
     של המעבר (cube-ghost / cube-hold), שנמחקים בסופו */
  const b = [...document.querySelectorAll('.appbar')].find((x) => !x.closest('.cube-ghost, .cube-hold')) || null;
  const put = () => { if (_barHEl && _barHEl.isConnected && _barHEl.offsetHeight) document.documentElement.style.setProperty('--appbar-h', _barHEl.offsetHeight + 'px'); };
  if (b !== _barHEl) {
    if (_barHRO) _barHRO.disconnect();
    _barHEl = b;
    if (b && typeof ResizeObserver === 'function') { _barHRO = new ResizeObserver(put); _barHRO.observe(b); }
  }
  put();
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
