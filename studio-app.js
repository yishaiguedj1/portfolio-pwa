/* שלב 3ד בתוכנית שלוש האפליקציות (13/10/2026): האתחול של studio.html — הסטודיו כדף עצמאי, בלי app.js.
   כמו academy-app.js: לפני הקובץ firebase-config.js, strings-studio.js, core.js, auth.js; אותו studio.js עם opt.standalone.
   קישור מהתראה (#studio=<עבודה>&v=play|subs) פותח את העבודה. עד שלב 5 ההתראות עדיין פותחות את האתר המאוחד. */
import { openStudio } from './studio.js';

const de = document.documentElement;
const lang = getLang();
de.lang = lang;
de.dir = lang === 'he' ? 'rtl' : 'ltr';
wireCoreBack();                                    // "חזור" סוגר חלונות (askConfirm) לפני הסטודיו
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
setTimeout(() => { de.classList.remove('lib-restoring', 'lib-curtain'); }, 6000);

const A = window.SnbAuth;
A.start();
const first = await new Promise((res) => {
  const to = setTimeout(() => res('boot'), 8000);
  A.onChange((st) => { clearTimeout(to); res(st); });
});
let known = first;
A.onChange((st) => {
  if (known === 'boot') { known = st; return; }
  if (st === known || (st !== 'in' && st !== 'out')) return;
  known = st;
  let last = 0;
  try { last = +sessionStorage.getItem('pwa_auth_rl') || 0; sessionStorage.setItem('pwa_auth_rl', String(Date.now())); } catch (e) {}
  if (Date.now() - last > 8000) location.reload();
});
const link = /[#&]studio=(j[A-Za-z0-9_-]{20})(?:&v=(play|subs))?/.exec(location.hash || '');
if (link) { try { history.replaceState(history.state, '', location.pathname + location.search); } catch (e) {} }
const hs = history.state;
openStudio({ standalone: { auth: A, home: './' }, restore: hs && hs.studio ? hs : null, job: link ? link[1] : '', view: link && link[2] ? link[2] : '' });
