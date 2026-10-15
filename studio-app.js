/* שלב 3ד בתוכנית שלוש האפליקציות (13/10/2026): האתחול של studio.html — הסטודיו כדף עצמאי, בלי app.js.
   כמו academy-app.js: לפני הקובץ firebase-config.js, strings-studio.js, core.js, auth.js; אותו studio.js עם opt.standalone.
   קישור מהתראה (#studio=<עבודה>&v=play|subs) פותח את העבודה. עד שלב 5 ההתראות עדיין פותחות את האתר המאוחד. */
import { openStudio } from './studio.js';
import { createShell, appBoot, APP_URL, loginGate, accountCard, displayCard, advancedRow, advancedCards } from './shell.js';

if (window.SNB_MOVING) await new Promise(() => {});   // שלב 5: הכתובת הישנה עוברת לחדשה (הסקריפט המוטבע) — לא מתחילים כאן

const de = document.documentElement;
const lang = getLang();
de.lang = lang;
de.dir = lang === 'he' ? 'rtl' : 'ltr';
apkFromHash();                                    // פתיחה מהאפליקציה לאנדרואיד (‎#app=…) — סימן ללשונית, הכתובת מתנקה (core)
wireCoreBack();                                    // "חזור" סוגר חלונות (askConfirm) לפני הסטודיו
appBoot();                                         // עדכון גרסה, רענון כשהיא משתלטת, הפס "סביבת ניסוי" (shell.js)
setTimeout(() => { de.classList.remove('lib-restoring', 'lib-curtain'); }, 6000);

const A = window.SnbAuth;
A.start();
devErrBoot(() => A.user());                        // 15/10/2026: שגיאות לשרתון — רק כשהדגל learn_full דולק (core)
const ready = new Promise((res) => {
  const to = setTimeout(() => res('boot'), 8000);
  A.onChange((st) => { clearTimeout(to); res(st); });
});
/* 14/10/2026 (דיווח המשתמש — מסך שחור ואז הכל בבת אחת): כשבטלפון כבר יש חשבון, הדף מצויר מיד מהנתונים המקומיים
   (כמו Invest), ורק פעולות שצריכות חשבון מחכות לחיבור (sa.ready → idToken). בלי חשבון — מחכים, כדי שלא יופיע דף
   ואחריו מסך הכניסה */
const owned = (() => { try { const o = localStorage.getItem('pwa_owner_v1'); return !!o && o !== 'local' && o !== 'legacy'; } catch (e) { return false; } })();
const first = owned ? 'boot' : await ready;
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
/* ההדר המשותף (shell.js) — הלוגו של Studio, הקפסולה "חיבור ל־Claude" בהדר, ובתפריט מגדל הפיקוח. הגלובוס בתפריט הפתוח = ההגדרות */
const sa = { auth: A, home: APP_URL.invest, ready };   // שלב 4: בכתובת הנפרדת — הכתובת של Invest
/* עמוד ההגדרות — כרטיס החשבון, "אפשרויות מתקדמות" (גרסה, ניקוי מטמון, האפליקציה לאנדרואיד) ו"תצוגה" של Invest (shell.js), אחד לאחד */
sa.cards = { account: () => accountCard(A, 'icon-studio-192.png'), display: displayCard, advRow: advancedRow, advanced: advancedCards };
sa.shell = createShell({
  app: 'studio', title: 'THE SNOWBALL Studio', logo: 'logo-studio.webp', logoLg: 'logo-studio-lg.webp',
  items: [
    { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3h8l-1.5 5h-5z"/><path d="M12 8v13"/><path d="M8 21h8"/></svg>',
      title: t('studioTwT'), sub: t('shellTowerSub'), on: () => sa.tower && sa.tower() },
  ],
  onSettings: () => sa.settings && sa.settings(),
});
/* לא מחובר — מסך הכניסה של Invest, עם הלוגו והשם של Studio (shell.js) */
if (first === 'out') loginGate({ app: 'studio', auth: A, logo: 'logo-studio.webp', logoLg: 'logo-studio-lg.webp', name: 'Studio' });
else if (first === 'boot') ready.then((st) => { if (st === 'out') loginGate({ app: 'studio', auth: A, logo: 'logo-studio.webp', logoLg: 'logo-studio-lg.webp', name: 'Studio' }); });
openStudio({ standalone: sa, restore: hs && hs.studio ? hs : null, job: link ? link[1] : '', view: link && link[2] ? link[2] : '' });
