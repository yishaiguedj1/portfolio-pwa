/* שלב 3ד בתוכנית שלוש האפליקציות (13/10/2026): האתחול של studio.html — הסטודיו כדף עצמאי, בלי app.js.
   כמו academy-app.js: לפני הקובץ firebase-config.js, strings-studio.js, core.js, auth.js; אותו studio.js עם opt.standalone.
   קישור מהתראה (#studio=<עבודה>&v=play|subs) פותח את העבודה. עד שלב 5 ההתראות עדיין פותחות את האתר המאוחד. */
import { openStudio } from './studio.js';
import { studioShare, studioProbeRes, studioGot, studioDlErr } from './studio.js';   // 22/10/2026: קישור מהבועה כש־Studio כבר פתוחה; ההורדה בטלפון
import { thumbsReady } from './studio.js';   // 21/10/2026: התמונות של העבודות — לפני הציור הראשון
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
// 22/10/2026: "שיתוף ← Studio" מאנדרואיד (MainActivity: ‎#share=<הטקסט ששותף>) — דף "מקישור" עם הבדיקה כבר רצה
const hashArg = (k, max) => { const m = new RegExp('[#&]' + k + '=([^&]*)').exec(location.hash || ''); try { return m ? decodeURIComponent(m[1]).slice(0, max) : ''; } catch (e) { return ''; } };
const share = hashArg('share', 4096);
// שלב 2: קובץ שנמצא בדף (דפדפן הציד) — ‎&ref=<הדף>
const shareRef = hashArg('ref', 2048);
// 22/10/2026: ההורדה בטלפון — הקובץ שחזר (sw.js → ‎#got=<מפתח>) ושגיאה (‎#dle=<n>.<קוד>)
const got = hashArg('got', 40), dle = hashArg('dle', 60);
if (link || share || got || dle) { try { history.replaceState(history.state, '', location.pathname + location.search); } catch (e) {} }
const hs = history.state;
/* ההדר המשותף (shell.js) — הלוגו של Studio, הקפסולה "חיבור ל־Claude" בהדר, ובתפריט מגדל הפיקוח. הגלובוס בתפריט הפתוח = ההגדרות */
const sa = { auth: A, home: APP_URL.invest, ready };   // שלב 4: בכתובת הנפרדת — הכתובת של Invest
/* עמוד ההגדרות — כרטיס החשבון, "אפשרויות מתקדמות" (גרסה, ניקוי מטמון, האפליקציה לאנדרואיד) ו"תצוגה" של Invest (shell.js), אחד לאחד */
sa.cards = { account: () => accountCard(A, 'icon-studio-192.png'), display: displayCard, advRow: advancedRow, advanced: advancedCards };
/* מגדל הפיקוח — תא מזוגג (בקשת המשתמש 21/10/2026, אופציה 3): בהדר בצבע של Studio, ובתפריט בצבע השורה */
const TOWER_IC = (c) => '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="' + c + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
  + '<path d="M12 1.2v2"/><path d="M8.2 3.2h7.6"/><path d="M6.8 4.8h10.4L15.7 9H8.3z" fill="' + c + '" fill-opacity=".2"/>'
  + '<path d="M8.8 10.5h6.4"/><path d="M10.6 10.5 10 21.5M13.4 10.5l.6 11"/><path d="M7.5 22h9"/></svg>';
sa.shell = createShell({
  app: 'studio', title: 'THE SNOWBALL Studio', logo: 'logo-studio.webp', logoLg: 'logo-studio-lg.webp',
  items: [
    { icon: TOWER_IC('currentColor').replace(' class="ic"', ''),
      title: t('studioTwT'), sub: t('shellTowerSub'), on: () => sa.tower && sa.tower() },
  ],
  onSettings: () => sa.settings && sa.settings(),
  /* ליד הגלובוס — מגדל הפיקוח; כשהתפריט פתוח — בהיר/כהה, כמו ב־Academy */
  action: { label: t('studioTwT'), on: () => sa.tower && sa.tower(), icon: TOWER_IC('var(--primary)') },
});
/* לא מחובר — מסך הכניסה של Invest, עם הלוגו והשם של Studio (shell.js) */
if (first === 'out') loginGate({ app: 'studio', auth: A, logo: 'logo-studio.webp', logoLg: 'logo-studio-lg.webp', name: 'Studio' });
else if (first === 'boot') ready.then((st) => { if (st === 'out') loginGate({ app: 'studio', auth: A, logo: 'logo-studio.webp', logoLg: 'logo-studio-lg.webp', name: 'Studio' }); });
/* 21/10/2026: התמונות של העבודות נטענות מהטלפון לפני הציור הראשון (מאחורי הווילון, עד 400ms) — הרשימה מופיעה איתן, בלי הבהוב */
Promise.race([thumbsReady, new Promise((r) => setTimeout(r, 400))]).then(() =>
  openStudio({ standalone: sa, restore: hs && hs.studio && !share && !got ? hs : null, job: link ? link[1] : '', view: link && link[2] ? link[2] : '', share, ref: shareRef, got, dle }));
/* 22/10/2026: קישור מהבועה / משיתוף כש־Studio כבר פתוחה — אנדרואיד מעביר אותו ללשונית הקיימת כשינוי ב־hash, בלי טעינה */
if (typeof window !== 'undefined') window.addEventListener('hashchange', () => {
  const s = hashArg('share', 4096), pr = hashArg('probe', 200000), g = hashArg('got', 40), de = hashArg('dle', 60);
  if (!s && !pr && !g && !de) return;
  const r = hashArg('ref', 2048);
  try { history.replaceState(history.state, '', location.pathname + location.search); } catch (e) {}
  if (s) studioShare(s, r);
  if (pr) studioProbeRes(pr);   // 22/10/2026: תוצאת הבדיקה בטלפון (DlActivity)
  if (g) studioGot(g);
  if (de) studioDlErr(de);
});
