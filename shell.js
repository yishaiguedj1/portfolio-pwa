/* ההדר המשותף של הדפים העצמאיים (Academy, Studio) — בקשת המשתמש 13/10/2026: "בדיוק במיקום ובעיצוב אחד לאחד כמו
   הממשק של Invest". אותו מבנה DOM ואותן מחלקות של ההדר ב־index.html (appbar, icon-btn, face-main/face-alt, menu-drop,
   main-menu, row-link, menu-veil, body.menu-blur — העיצוב כולו מ־styles.css), ואותה התנהגות של setMainMenuOpen ב־app.js:
   ההמבורגר פותח תפריט עם טשטוש, הגלובוס הופך להגדרות, ☰ הופך ל־✕, ו"חזור" סוגר את התפריט (modalPush מ־core.js).
   ההבדל היחיד: אין מטבע — במקום ₪ יש כפתור בהיר/כהה שמופיע רק כשהתפריט פתוח (החלטת המשתמש).
   מקום ללוגו — `logo` (היום הלוגו של THE SNOWBALL; בהמשך לוגו לכל אפליקציה).
   בראש התפריט — מעבר לשתי האפליקציות האחרות (תוכנית שלוש האפליקציות, סעיף 4), ואחריהן הפריטים של האפליקציה.
   תלוי ב־core.js (t, btnFacesHTML, ICON_*, modalPush/modalDone, resolveTheme/setThemeMode, LS_LANG). */

/* הכתובות של שלוש האפליקציות — המקום היחיד. שלב 4 (דומיינים) = כאן בלבד */
export const APP_URL = { invest: './', academy: 'academy.html', studio: 'studio.html' };

const CHEV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 6 9 12 15 18"/></svg>';
const APPS = {
  invest: { name: 'Invest', sub: () => t('appInvestSub'), cls: 'demo-ic',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 17 9 11 13 15 21 7"/><polyline points="15 7 21 7 21 13"/></svg>' },
  academy: { name: 'Academy', sub: () => t('menuLibrarySub'), cls: 'demo-ic',
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
  brand.append(img, h('span', 'sr-only', o.title || ''));
  if (o.onBrand) brand.addEventListener('click', o.onBrand);
  const left = h('div', 'appbar-left');
  const sub = h('div', 'appbar-sub src-row'); sub.hidden = true;           // קפסולת מצב של האפליקציה (Invest: מצב השוק)
  const acts = h('div', 'appbar-actions');
  const theme = h('button', 'icon-btn shell-theme'); theme.type = 'button';
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
  const drop = h('div', 'menu-drop hidden');
  const main = h('div', 'main-menu');
  for (const k of ['invest', 'academy', 'studio']) {
    if (k === o.app) continue;
    const A = APPS[k];
    main.append(menuRow(A.icon, A.cls, A.name, A.sub(), () => { setOpen(false); location.href = APP_URL[k]; }));
  }
  for (const it of o.items || []) main.append(menuRow(it.icon, it.cls, it.title, it.sub, () => { setOpen(false); it.on(); }));
  drop.append(main);
  menuWrap.append(menu, drop);
  acts.append(theme, langWrap, menuWrap);
  left.append(sub, acts);
  row.append(brand, left);
  hdr.append(row);

  const paintTheme = () => { theme.innerHTML = resolveTheme() === 'dark' ? ICON_SUN : ICON_MOON; };
  paintTheme();
  if (typeof window !== 'undefined') window.snbThemeChanged = paintTheme;
  let veil = null, modal = null;
  const isOpen = () => !drop.classList.contains('hidden');
  function setOpen(open) {
    const was = isOpen();
    if (open && !was) modal = modalPush(() => setOpen(false));            // "חזור" סוגר את התפריט (כמו ב־Invest)
    else if (!open && modal) { const m = modal; modal = null; modalDone(m); }
    drop.classList.toggle('hidden', !open);
    menu.setAttribute('aria-expanded', open ? 'true' : 'false');
    acts.classList.toggle('menu-open', open);
    if (open && !veil) {                    // שכבת הטשטוש — בתוך השכבה של האפליקציה, מתחת להדר
      veil = h('div', 'menu-veil'); veil.setAttribute('aria-hidden', 'true');
      veil.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
      (hdr.closest('.lib-root, .st-root') || document.body).append(veil);
    }
    document.body.classList.toggle('menu-blur', open);
    lang.setAttribute('aria-label', open ? t('menuSettings') : t('langAria'));
    theme.setAttribute('aria-label', t('menuThemeAria'));
    menu.setAttribute('aria-label', open ? t('menuCloseAria') : t('menuAria'));
    if (open) langMenu.classList.add('hidden');
  }
  setOpen(false);
  menu.addEventListener('click', (e) => { e.stopPropagation(); setOpen(!isOpen()); });
  theme.addEventListener('click', (e) => { e.stopPropagation(); setThemeMode(resolveTheme() === 'dark' ? 'light' : 'dark'); });
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
