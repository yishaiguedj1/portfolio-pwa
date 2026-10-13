/* שלב 3ג בתוכנית שלוש האפליקציות (13/10/2026): האתחול של academy.html — הספרייה כדף עצמאי, בלי app.js.
   לפני הקובץ (academy.html): firebase-config.js, strings-academy.js, core.js, auth.js. אותו library.js כמו בתיק,
   עם opt.standalone (library.js — SA). עד שלב 5 האתר המאוחד לא משתנה: בתיק הספרייה עדיין נפתחת כשכבה. */
import { openLibrary } from './library.js';

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
await openLibrary({ standalone: { auth: A, home: './' }, restore: hs && hs.lib ? hs : null });
