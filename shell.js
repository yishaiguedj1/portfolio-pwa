/* ההדר המשותף של הדפים העצמאיים (Academy, Studio) — בקשת המשתמש 13/10/2026: "בדיוק במיקום ובעיצוב אחד לאחד כמו
   הממשק של Invest". אותו מבנה DOM ואותן מחלקות של ההדר ב־index.html (appbar, icon-btn, face-main/face-alt, menu-drop,
   main-menu, row-link, menu-veil, body.menu-blur — העיצוב כולו מ־styles.css), ואותה התנהגות של setMainMenuOpen ב־app.js:
   ההמבורגר פותח תפריט עם טשטוש, הגלובוס הופך להגדרות, ☰ הופך ל־✕, ו"חזור" סוגר את התפריט (modalPush מ־core.js).
   ההבדל היחיד: אין מטבע — במקום ₪ יש כפתור בהיר/כהה שמופיע רק כשהתפריט פתוח (החלטת המשתמש).
   מקום ללוגו — `logo` (היום הלוגו של THE SNOWBALL; בהמשך לוגו לכל אפליקציה).
   בראש התפריט — מעבר לשתי האפליקציות האחרות (תוכנית שלוש האפליקציות, סעיף 4), ואחריהן הפריטים של האפליקציה.
   תלוי ב־core.js (t, btnFacesHTML, ICON_*, modalPush/modalDone, resolveTheme/setThemeMode, LS_LANG). */

/* הכתובות של שלוש האפליקציות — מ־firebase-config.js (SNB_ENV.apps, לפי הכתובת שבה נמצאים; שלב 4). בלעדיו — הדפים שלידו */
const ENV_APPS = typeof window !== 'undefined' && window.SNB_ENV && window.SNB_ENV.apps;
export const APP_URL = ENV_APPS || { invest: './', academy: 'academy.html', studio: 'studio.html' };

/* האתחול המשותף של הדף (בנייה 409) — אותו דבר כמו ב־app.js של Invest. עד היום הדפים העצמאיים רק רשמו את ה־SW:
   (1) בלי בדיקת עדכון כשחוזרים מהרקע (מעבר ממסך הבית לא טוען את הדף), (2) בלי רענון כשגרסה חדשה משתלטת — עותק ישן
   נשאר פתוח והתחלף עם החדש בטלפון (Academy כחול ← ירוק ← כחול), (3) בלי הפס "סביבת ניסוי". */
export function appBoot() {
  if (window.SNB_ENV && window.SNB_ENV.name === 'staging' && !document.querySelector('.env-strip')) {
    const strip = h('div', 'env-strip', t('envStaging'));
    strip.setAttribute('role', 'note');
    document.body.prepend(strip);
  }
  if (typeof sysCfgBoot === 'function') sysCfgBoot();   // 15/10/2026: מצב תחזוקה והדגלים (core.js) — כמו ב־app.js
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
  const sw = navigator.serviceWorker;
  const hadController = !!sw.controller;               // התקנה ראשונה — בלי רענון
  let reloaded = false;
  sw.addEventListener('controllerchange', () => {
    if (reloaded || !hadController) return;
    reloaded = true;
    // באמצע העלאה של הסטודיו לא מרעננים (ההעלאה הייתה נעצרת) — מחכים שתסתיים, כמו ב־app.js
    const busy = () => { try { return typeof window.snbStudioBusy === 'function' && window.snbStudioBusy(); } catch (e) { return false; } };
    const go = () => { if (busy()) setTimeout(go, 5000); else location.reload(); };
    go();
  });
  sw.register('sw.js').then((reg) => {
    const check = () => { try { reg.update().catch(() => {}); } catch (e) {} };
    check();
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  }).catch(() => {});
}

const CHEV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 6 9 12 15 18"/></svg>';
const APPS = {
  invest: { name: 'Invest', sub: () => t('appInvestSub'), cls: 'invest-ic',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 17 9 11 13 15 21 7"/><polyline points="15 7 21 7 21 13"/></svg>' },
  academy: { name: 'Academy', sub: () => t('menuLibrarySub'), cls: 'academy-ic',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/><path d="M9 7.5h7"/></svg>' },
  studio: { name: 'Studio', sub: () => t('menuStudioSub'), cls: 'studio-ic',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M10 9.2v5.6l4.6-2.8z" fill="currentColor" stroke="none"/></svg>' },
};

const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
function menuRow(icon, icCls, title, sub, onClick) {
  const sec = h('div', 'menu-section menu-demo');
  const b = h('button', 'row-link menu-row'); b.type = 'button';
  const ic = h('span', 'row-link-ic ' + (icCls || 'demo-ic')); ic.setAttribute('aria-hidden', 'true'); ic.innerHTML = icon;
  const tx = h('span', 'row-link-txt'); tx.append(h('span', 'menu-row-t', title), h('span', 'menu-row-s', sub));
  const ch = h('span', 'row-link-chev'); ch.setAttribute('aria-hidden', 'true'); ch.innerHTML = CHEV;
  b.append(ic, tx, ch);
  b.addEventListener('click', onClick);
  sec.append(b);
  return sec;
}

/* app: 'academy' | 'studio'; items: [{icon, cls, title, sub, on}] — הפריטים של האפליקציה; onSettings / onBrand */
export function createShell(o) {
  const hdr = h('header', 'appbar');
  const row = h('div', 'appbar-row');
  const brand = h('h1', 'brand');
  const img = h('img', 'brand-logo'); img.src = o.logo || 'logo-header.png'; img.width = 128; img.height = 128; img.alt = ''; img.decoding = 'async';
  // לוגו חד בכל צפיפות מסך (13/10/2026): 512 = פי 4 מ־128; ‏logoLg (768) לטלפונים בצפיפות גבוהה יותר
  if (o.logoLg) { img.srcset = o.logo + ' 512w, ' + o.logoLg + ' 768w'; img.sizes = '128px'; }
  /* 20/10/2026: הלוגו החי — הלוגו, המצמוץ, החיוך והברק בעטיפה אחת שזזה יחד; השלג מאחור ולפני (styles.css) */
  const art = h('span', 'brand-art'), snow = h('span', 'brand-snow'), front = h('span', 'brand-snow front');
  for (const c of ['brand-blink', 'brand-smile', 'brand-sheen']) { const e = h('span', c); e.setAttribute('aria-hidden', 'true'); art.append(e); }
  art.prepend(img);
  snow.innerHTML = '<i></i><i></i><i></i><b></b><b></b><b></b>'; front.innerHTML = '<i></i>';   // שלוש שכבות שלג + שלושה ניצוצות קרח · שכבה קרובה
  snow.setAttribute('aria-hidden', 'true'); front.setAttribute('aria-hidden', 'true');
  brand.append(art, snow, front, h('span', 'sr-only', o.title || ''));
  if (o.onBrand) brand.addEventListener('click', o.onBrand);
  const left = h('div', 'appbar-left');
  const sub = h('div', 'appbar-sub src-row'); sub.hidden = true;           // קפסולת מצב של האפליקציה (Invest: מצב השוק)
  const acts = h('div', 'appbar-actions');
  /* o.action = {icon, label, on}: כפתור עם שני פנים כמו ₪ ב־Invest — רגיל = הפעולה של האפליקציה (Academy: הוספת ספר),
     בתפריט הפתוח = בהיר/כהה. בלעדיו — כפתור הערכה מופיע רק כשהתפריט פתוח */
  const act = o.action || null;
  const theme = h('button', 'icon-btn ' + (act ? 'shell-act' : 'shell-theme')); theme.type = 'button';
  const langWrap = h('div', 'lang-wrap');
  const lang = h('button', 'icon-btn'); lang.type = 'button'; lang.innerHTML = btnFacesHTML(ICON_GLOBE, ICON_GEAR);
  const langMenu = h('div', 'lang-menu hidden'); langMenu.setAttribute('role', 'menu');
  const cur = getLang();
  for (const [code, label] of [['he', 'עברית'], ['en', 'English']]) {
    const b = h('button', cur === code ? 'active' : '', label); b.type = 'button'; b.setAttribute('role', 'menuitem');
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      langMenu.classList.add('hidden');
      if (getLang() === code) return;
      try { localStorage.setItem(LS_LANG, code); } catch (err) {}
      location.reload();                     // כל הטקסטים בדף נבנים מחדש בשפה החדשה
    });
    langMenu.append(b);
  }
  langWrap.append(lang, langMenu);
  const menuWrap = h('div', 'menu-wrap');
  const menu = h('button', 'icon-btn'); menu.type = 'button'; menu.innerHTML = btnFacesHTML(ICON_MENU, ICON_CLOSE);
  menu.setAttribute('aria-haspopup', 'true'); menu.setAttribute('aria-expanded', 'false');
  const drop = h('div', 'menu-drop sh-drop hidden');
  const main = h('div', 'main-menu');
  for (const k of ['invest', 'academy', 'studio']) {
    if (k === o.app) continue;
    const A = APPS[k];
    main.append(menuRow(A.icon, A.cls, A.name, A.sub(), () => { setOpen(false); appGo(APP_URL[k]); }));   // באפליקציה לאנדרואיד — האפליקציה המותקנת (core: appGo)
  }
  for (const it of o.items || []) main.append(menuRow(it.icon, it.cls, it.title, it.sub, () => { setOpen(false); it.on(); }));
  drop.append(main);
  menuWrap.append(menu, drop);
  acts.append(theme, langWrap, menuWrap);
  left.append(sub, acts);
  row.append(brand, left);
  hdr.append(row);

  const themeIcon = () => (resolveTheme() === 'dark' ? ICON_SUN : ICON_MOON);
  const paintTheme = () => {
    if (!act) { theme.innerHTML = themeIcon(); return; }
    if (!theme.firstChild) theme.innerHTML = btnFacesHTML(act.icon, themeIcon());
    const alt = theme.querySelector('.face-alt'); if (alt) alt.innerHTML = themeIcon();
  };
  paintTheme();
  if (typeof window !== 'undefined') window.snbThemeChanged = paintTheme;
  let veil = null, modal = null;
  const isOpen = () => !drop.classList.contains('hidden');
  function setOpen(open) {
    const was = isOpen();
    if (open && !was) modal = modalPush(() => setOpen(false));            // "חזור" סוגר את התפריט (כמו ב־Invest)
    if (open && typeof appPrerender === 'function') appPrerender(Object.keys(APP_URL).filter((k) => k !== o.app).map((k) => APP_URL[k]));   // 14/10/2026: האפליקציות האחרות מוכנות מראש
    else if (!open && modal) { const m = modal; modal = null; modalDone(m); }
    drop.classList.toggle('hidden', !open);
    /* 15/10/2026 (סרטון המשתמש — התפריט "מתרענן" פעמיים): הכניסה באנימציה מהקוד ולא ב־CSS — אנימציית CSS רצה מחדש בכל
       פעם שההדר נכנס שוב לדף (הספרייה והסטודיו מציירים את דף הבית מחדש בזמן טעינה), והתפריט הפתוח הבהב שוב ושוב */
    if (open && !was && drop.animate && !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) {
      try { drop.animate([{ opacity: 0, transform: 'translateY(-6px) scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.2, .9, .25, 1)' }); } catch (e) {}
    }
    menu.setAttribute('aria-expanded', open ? 'true' : 'false');
    acts.classList.toggle('menu-open', open);
    if (open && !veil) {                    // שכבת הטשטוש — בתוך השכבה של האפליקציה, מתחת להדר
      veil = h('div', 'menu-veil'); veil.setAttribute('aria-hidden', 'true');
      veil.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
      (hdr.closest('.lib-root, .st-root') || document.body).append(veil);
    }
    document.body.classList.toggle('menu-blur', open);
    lang.setAttribute('aria-label', open ? t('menuSettings') : t('langAria'));
    theme.setAttribute('aria-label', open || !act ? t('menuThemeAria') : act.label);
    menu.setAttribute('aria-label', open ? t('menuCloseAria') : t('menuAria'));
    if (open) langMenu.classList.add('hidden');
  }
  setOpen(false);
  menu.addEventListener('click', (e) => { e.stopPropagation(); setOpen(!isOpen()); });
  theme.addEventListener('click', (e) => {
    e.stopPropagation();
    if (act && !isOpen()) { act.on(); return; }   // סגור — הפעולה (בתוך הנגיעה: בורר הקבצים נפתח)
    setThemeMode(resolveTheme() === 'dark' ? 'light' : 'dark');
  });
  lang.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isOpen()) { setOpen(false); if (o.onSettings) o.onSettings(); return; }   // תפריט פתוח → הגלובוס = הגדרות
    langMenu.classList.toggle('hidden');
  });
  document.addEventListener('click', (e) => {
    if (isOpen() && !(e.target.closest && e.target.closest('.menu-wrap'))) setOpen(false);
    if (!langMenu.classList.contains('hidden') && !(e.target.closest && e.target.closest('.lang-wrap'))) langMenu.classList.add('hidden');
  });
  // Escape — לפני המאזינים של הספרייה/הסטודיו (capture), אחרת הם מפרשים אותו כ"חזור" של הדף
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (isOpen()) { e.preventDefault(); e.stopPropagation(); setOpen(false); }
    else if (!langMenu.classList.contains('hidden')) { e.preventDefault(); e.stopPropagation(); langMenu.classList.add('hidden'); }
  }, true);
  /* בקשת סגירה מבחוץ (CloseWatcher של הסטודיו — "חזור" באנדרואיד מגיע אליו לפני ההיסטוריה) */
  if (typeof window !== 'undefined') window.snbMenuClose = () => { if (!isOpen()) return false; setOpen(false); return true; };

  return {
    el: hdr,
    close: () => setOpen(false),
    setStatus(node) { sub.textContent = ''; if (node) sub.append(node); sub.hidden = !node; },
  };
}

/* מסך הכניסה של Academy ו־Studio (13/10/2026, בקשת המשתמש: "מסך התחברות כזה בכל העמודים") — אותו מסך של Invest
   (index.html, #loginOverlay: אותן מחלקות מ־styles.css), עם הלוגו והשם של האפליקציה. מוצג רק כשהחיבור ענה "לא מחובר"
   (לא כשאין רשת / Firebase). כניסה → החיבור משתנה והדף נטען מחדש (academy-app.js / studio-app.js); "המשך בלי חשבון" —
   רק לפתיחה הזו, כמו ב־Invest. מעל הספרייה/הסטודיו (z-index ב־.login-overlay.sa). */
const GOOGLE_G = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.7 2.9c2.3-2.1 3.7-5.2 3.7-8.6z"/><path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.7-2.9c-1 .7-2.4 1.2-4.2 1.2-3.2 0-5.9-2.1-6.8-5l-3.9 3C3.3 21.3 7.3 24 12 24z"/><path fill="#FBBC05" d="M5.2 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.7.4-2.4l-3.9-3C.5 8.2 0 10 0 12s.5 3.8 1.3 5.4l3.9-3z"/><path fill="#EA4335" d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9 1.1 15.2 0 12 0 7.3 0 3.3 2.7 1.3 6.6l3.9 3c.9-2.8 3.6-4.9 6.8-4.9z"/></svg>';
const LOGIN_SUB = { academy: () => t('loginSubAcademy'), studio: () => t('loginSubStudio') };

export function loginGate(o) {
  const A = o.auth;
  if (!A || A.state() !== 'out' || document.getElementById('loginOverlay')) return null;
  const veil = document.createElement('div');
  veil.id = 'loginOverlay';
  veil.className = 'login-overlay sa';
  veil.setAttribute('role', 'dialog');
  veil.setAttribute('aria-label', t('loginAria'));
  const card = document.createElement('div');
  card.className = 'login-card';
  const img = document.createElement('img');
  img.className = 'login-logo'; img.src = o.logo; img.alt = o.name;
  if (o.logoLg) { img.srcset = o.logo + ' 512w, ' + o.logoLg + ' 768w'; img.sizes = '192px'; }   // 192px במסך — בצפיפות 3 צריך 576
  const h1 = document.createElement('h1'); h1.textContent = o.name;
  const sub = document.createElement('p'); sub.className = 'login-sub'; sub.textContent = (LOGIN_SUB[o.app] || (() => ''))();
  const go = document.createElement('button');
  go.id = 'googleLoginBtn'; go.type = 'button'; go.className = 'google-btn';
  go.innerHTML = GOOGLE_G;
  const gl = document.createElement('span'); gl.textContent = t('googleSignIn'); go.append(gl);
  const err = document.createElement('div'); err.className = 'form-err hidden'; err.id = 'loginErr';
  const skip = document.createElement('button');
  skip.id = 'skipLoginBtn'; skip.type = 'button'; skip.className = 'link-btn'; skip.textContent = t('skipLogin');
  go.addEventListener('click', () => {
    err.classList.add('hidden');
    go.disabled = true;
    A.signIn().then((ok) => {          // הצליח — החיבור משתנה והדף נטען מחדש
      go.disabled = false;
      if (!ok) { err.textContent = t('loginFailed'); err.classList.remove('hidden'); }
    });
  });
  skip.addEventListener('click', () => veil.remove());
  card.append(img, h1, sub, go, err, skip);
  veil.append(card);
  document.body.append(veil);
  return veil;
}

/* עמוד ההגדרות של Academy ו־Studio (13/10/2026, בקשת המשתמש: "אותה שפת עיצוב כמו ההגדרות של Invest; כרטיס החשבון
   בראש העמוד זהה אחד לאחד") — אותו DOM ואותן מחלקות של #accountCard (cloud.js, renderAccountCard) ושל כרטיס "תצוגה"
   (index.html), העיצוב כולו מ־styles.css. אין כאן מטבע (רק ב־Invest). */
const ACC_IC = {
  out: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 17l5-5-5-5"/><path d="M20 12H9"/><path d="M12 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M11 18h2"/></svg>',
  cloud: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19a4.5 4.5 0 0 0 .5-8.97A6 6 0 0 0 6.2 9.1 4 4 0 0 0 6.5 19z"/></svg>',
};
function accIdRow(av, title, sub) {
  const row = h('div', 'acc-id');
  const tx = h('div', 'acc-txt'); tx.append(h('b', null, title), h('span', null, sub));
  row.append(av, tx);
  return row;
}
function accActRow(cls, icon, label, onClick) {
  const list = h('div', 'ios-list');
  const b = h('button', 'ios-row ios-row-btn' + (cls ? ' ' + cls : '')); b.type = 'button';
  const ic = h('span', 'ios-row-ic'); ic.setAttribute('aria-hidden', 'true'); ic.innerHTML = icon;
  b.append(ic, h('span', 'ios-row-lbl', label));
  b.addEventListener('click', onClick);
  list.append(b);
  return list;
}
/* החשבון: מחובר — תמונה, שם, מייל והתנתקות; לא מחובר — "מצב מקומי" וכניסה עם Google (כמו Invest אחרי "המשך בלי חשבון") */
export function accountCard(A, icon) {   // icon — תמונה כשאין תמונת חשבון (האייקון של האפליקציה)
  const card = h('div', 'card'); card.id = 'accountCard';
  const box = h('div'); box.id = 'accountInfo';
  card.append(h('h2', null, t('myAccount')), box);
  const u = A && A.user();
  if (u) {
    const img = h('img'); img.alt = ''; img.src = u.photoURL || icon || 'icon-192.png';
    img.addEventListener('error', () => { img.src = icon || 'icon-192.png'; }, { once: true });
    box.append(accIdRow(img, u.displayName || t('userLabel'), u.email || ''),
      accActRow('acc-out', ACC_IC.out, t('signOut'), () => A.signOut()));   // החיבור משתנה → הדף נטען מחדש (academy-app.js / studio-app.js)
  } else if (A) {
    const av = h('span', 'acc-av'); av.setAttribute('aria-hidden', 'true'); av.innerHTML = ACC_IC.phone;
    box.append(accIdRow(av, t('localModeTitle'), t('localModeSub')),
      accActRow('', ACC_IC.cloud, t('googleSignIn'), () => { A.signIn().then((ok) => { if (!ok && typeof flash === 'function') flash(t('loginFailed')); }); }));
  }
  return card;
}
/* תצוגה: שפה (עברית / English / מערכת) וערכת נושא (בהיר / כהה / מערכת) — אותם בוררים של Invest */
export function displayCard() {
  const card = h('div', 'card display-card');
  card.append(h('h2', null, t('displayTitle')));
  const group = (label, aria, opts, cur, pick) => {
    const row = h('div', 'display-row stack');
    const tg = h('div', 'lang-toggle'); tg.setAttribute('role', 'group'); tg.setAttribute('aria-label', aria);
    for (const [v, txt] of opts) {
      const b = h('button', 'lang-opt' + (v === cur() ? ' active' : ''), txt); b.type = 'button';
      b.setAttribute('aria-pressed', v === cur() ? 'true' : 'false');
      b.addEventListener('click', () => {
        if (v === cur()) return;
        pick(v);
        for (const x of tg.children) { const on = x === b; x.classList.toggle('active', on); x.setAttribute('aria-pressed', on ? 'true' : 'false'); }
      });
      tg.append(b);
    }
    row.append(h('span', 'display-label', label), tg);
    return row;
  };
  card.append(
    group(t('langTitleBi'), 'Language', [['he', 'עברית'], ['en', 'English'], ['system', t('themeSystem')]], getLangMode, (v) => {
      const before = getLang();
      try { localStorage.setItem(LS_LANG, v); } catch (e) {}
      if (getLang() !== before) location.reload();          // כל הטקסטים בדף נבנים מחדש בשפה החדשה
    }),
    group(t('themeTitle'), 'Theme', [['light', t('themeLight')], ['dark', t('themeDark')], ['system', t('themeSystem')]], getThemeMode, (v) => setThemeMode(v)));
  return card;
}

/* "אפשרויות מתקדמות" (13/10/2026, בקשת המשתמש: "בדיוק כמו ב־Invest") — השורה בעמוד ההגדרות והכרטיסים של העמוד
   (index.html: #advancedCard, #widgetCard, #appInfoCard — אותו DOM ואותן מחלקות). בדפים העצמאיים אין תיק, ולכן
   בכרטיס הווידג׳ט רק הורדת האפליקציה לאנדרואיד וההוראות (הסנכרון לווידג׳ט — מתוך Invest באפליקציה). */
const ADV_IC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/><circle cx="9" cy="6" r="2.2" fill="currentColor"/><circle cx="15" cy="12" r="2.2" fill="currentColor"/><circle cx="8" cy="18" r="2.2" fill="currentColor"/></svg>';
const RELOAD_IC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.5 15a9 9 0 1 1-2.1-9.4L23 10"/></svg>';
export const APK_URL = 'https://github.com/yishaiguedj1/portfolio-pwa/releases/download/android-latest/the-snowball.apk';
/* 14/10/2026: לכל אפליקציה קובץ התקנה משלה (android.yml). Invest — הקישור הישן (ההתקנה הקיימת מתעדכנת במקום) */
export function apkUrl(app) { return app === 'academy' || app === 'studio' ? APK_URL.replace(/\.apk$/, '-' + app + '.apk') : APK_URL; }
export function advancedRow(onClick) {
  const card = h('div', 'card row-card'); card.id = 'advancedCard';
  const b = h('button', 'row-link'); b.type = 'button';
  const ic = h('span', 'row-link-ic adv-ic'); ic.setAttribute('aria-hidden', 'true'); ic.innerHTML = ADV_IC;
  const ch = h('span', 'row-link-chev'); ch.setAttribute('aria-hidden', 'true'); ch.innerHTML = CHEV;
  b.append(ic, h('span', 'row-link-txt', t('advancedTitle')), ch);
  b.addEventListener('click', onClick);
  // 15/10/2026: "שליחת משוב" באותו כרטיס — כמו ב־index.html (feedbackOpen ב־core)
  const f = h('button', 'row-link'); f.type = 'button'; f.id = 'feedbackOpen';
  const fic = h('span', 'row-link-ic fb-ic'); fic.setAttribute('aria-hidden', 'true'); fic.innerHTML = FB_IC;
  const fch = h('span', 'row-link-chev'); fch.setAttribute('aria-hidden', 'true'); fch.innerHTML = CHEV;
  f.append(fic, h('span', 'row-link-txt', t('fbRowT')), fch);
  f.addEventListener('click', () => feedbackOpen());
  card.append(b, f);
  return card;
}
/* ניקוי מטמון ורענון — כמו #clearCache ב־app.js: כל המטמונים של ה־Service Worker, ביטול הרישום, טעינה מחדש */
async function clearCacheReload() {
  try {
    if ('caches' in window) { const keys = await caches.keys(); await Promise.all(keys.map((k) => caches.delete(k))); }
    if ('serviceWorker' in navigator) { const regs = await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map((r) => r.unregister())); }
  } catch (e) {}
  location.reload();
}
export function advancedCards() {
  /* 14/10/2026 (שלוש אפליקציות): כאן ההתקנה של האפליקציה הזו — בלי הווידג׳ט (הוא רק ב־Invest) */
  const app = document.documentElement.dataset.app || 'invest';
  const w = h('div', 'card'); w.id = 'widgetCard';
  const row = h('div', 'btn-row');
  const apk = h('a', 'btn', t('widgetApkBtn')); apk.id = 'widgetApk'; apk.href = apkUrl(app); apk.rel = 'noopener';
  row.append(apk);
  const how = h('details', 'fine'); how.id = 'widgetHow'; how.style.padding = '0'; how.style.marginTop = '8px';
  const ol = h('ol', 'widget-steps');
  ol.append(h('li', null, t('widgetStep1')));
  how.append(h('summary', null, t('widgetHowTitle')), ol);
  w.append(h('h2', null, t('apkTitle')), row, how);

  const info = h('div', 'card list-card'); info.id = 'appInfoCard';
  const list = h('div', 'ios-list');
  const ver = h('div', 'ios-row');
  const val = h('span', 'ios-row-val', typeof appVersionLabel === 'function' ? appVersionLabel() : ''); val.id = 'appVersion'; val.dir = 'ltr';
  ver.append(h('span', 'ios-row-lbl', t('versionLbl')), val);
  const clr = h('button', 'ios-row ios-row-btn'); clr.type = 'button'; clr.id = 'clearCache';
  const ic = h('span', 'ios-row-ic'); ic.setAttribute('aria-hidden', 'true'); ic.innerHTML = RELOAD_IC;
  clr.append(ic, h('span', 'ios-row-lbl', t('clearCacheBtn')));
  clr.addEventListener('click', clearCacheReload);
  list.append(ver, clr);
  info.append(h('h2', null, t('appInfoTitle')), list);
  return [w, info];
}
