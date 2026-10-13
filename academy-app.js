/* שלב 3ג בתוכנית שלוש האפליקציות (13/10/2026): האתחול של academy.html — הספרייה כדף עצמאי, בלי app.js.
   לפני הקובץ (academy.html): firebase-config.js, strings-academy.js, core.js, auth.js. אותו library.js כמו בתיק,
   עם opt.standalone (library.js — SA). עד שלב 5 האתר המאוחד לא משתנה: בתיק הספרייה עדיין נפתחת כשכבה. */
import { openLibrary } from './library.js';
import { createShell, APP_URL, loginGate } from './shell.js';

const de = document.documentElement;
const lang = getLang();
de.lang = lang;
de.dir = lang === 'he' ? 'rtl' : 'ltr';
wireCoreBack();                                    // "חזור" סוגר חלונות (askConfirm, כפתורי לחיצה ארוכה) לפני הספרייה
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
setTimeout(() => { de.classList.remove('lib-restoring', 'lib-curtain'); }, 6000);   // וילון הרענון — לכל היותר 6 שנ׳ (כמו app.js)

const A = window.SnbAuth;
A.start();
/* מחכים לתשובה הראשונה (מחובר / לא / אין רשת) — לכל היותר 8 שנ׳; הספרייה עובדת גם בלי (IndexedDB) */
const first = await new Promise((res) => {
  const to = setTimeout(() => res('boot'), 8000);
  A.onChange((st) => { clearTimeout(to); res(st); });
});
/* החיבור השתנה אחרי הפתיחה (כניסה מהכפתור, התנתקות באפליקציה אחרת) → טעינה מחדש, עם שומר מפני לולאה */
let known = first;
A.onChange((st) => {
  if (known === 'boot') { known = st; return; }
  if (st === known || (st !== 'in' && st !== 'out')) return;
  known = st;
  let last = 0;
  try { last = +sessionStorage.getItem('pwa_auth_rl') || 0; sessionStorage.setItem('pwa_auth_rl', String(Date.now())); } catch (e) {}
  if (Date.now() - last > 8000) location.reload();
});
const hs = history.state;
/* ההדר המשותף (shell.js) — הלוגו של Academy, ובתפריט: "מה למדתי" והגיבוי. הגלובוס בתפריט הפתוח = הגדרות Academy */
const sa = { auth: A, home: APP_URL.invest };   // שלב 4: בכתובת הנפרדת — הכתובת של Invest
sa.shell = createShell({
  app: 'academy', title: 'THE SNOWBALL Academy', logo: 'logo-academy.png',
  items: [
    { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
      title: t('learnTitle'), sub: t('shellLearnSub'), on: () => sa.notes && sa.notes() },
    { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H7a5 5 0 1 1 1.6-9.74A6 6 0 0 1 20 11.5a3.75 3.75 0 0 1-2.5 7.5z"/></svg>',
      title: t('shellBackup'), sub: 'Google Drive', on: () => sa.backup && sa.backup() },
  ],
  onSettings: () => sa.settings && sa.settings(),
});
/* לא מחובר — מסך הכניסה של Invest, עם הלוגו והשם של Academy (shell.js) */
if (first === 'out') loginGate({ app: 'academy', auth: A, logo: 'logo-academy.png', name: 'Academy' });
await openLibrary({ standalone: sa, restore: hs && hs.lib ? hs : null });
