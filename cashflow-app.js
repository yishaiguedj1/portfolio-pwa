/* Cashflow, גל 2 (6/11/2026): האתחול של cashflow.html — האפליקציה הרביעית כדף עצמאי, בלי app.js. כמו academy-app.js:
   לפני הקובץ firebase-config.js, strings-cashflow.js, core.js, auth.js. הנתונים — רק מ־POST /api/cashflow בשרתון (גל 1).
   התוכנית: riseup-finance/docs/web-app-plan.md · התיעוד: docs/cashflow.md */
import { openCashflow } from './cashflow.js';
import { createShell, appBoot, APP_URL, loginGate, accountCard, displayCard, advancedRow, advancedCards } from './shell.js';

const de = document.documentElement;
const lang = getLang();
de.lang = lang;
de.dir = lang === 'he' ? 'rtl' : 'ltr';
wireCoreBack();                                    // "חזור" סוגר חלונות (askConfirm) לפני Cashflow
appBoot();                                         // עדכון גרסה, רענון כשהיא משתלטת, הפס "סביבת ניסוי" (shell.js)
setTimeout(() => { de.classList.remove('lib-restoring', 'lib-curtain'); }, 6000);

const A = window.SnbAuth;
A.start();
const ready = new Promise((res) => {
  const to = setTimeout(() => res('boot'), 8000);
  A.onChange((st) => { clearTimeout(to); res(st); });
});
/* כמו Academy: כשבטלפון כבר יש חשבון — מציירים מיד (שלד), והנתונים מחכים לחיבור. בלי חשבון — מחכים, בלי דף ואחריו מסך כניסה */
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
const sa = { auth: A, home: APP_URL.invest, ready };
sa.cards = { account: () => accountCard(A, 'icon-cashflow-192.png'), display: displayCard, advRow: advancedRow, advanced: advancedCards };
/* ההדר המשותף — הלוגו של Cashflow; ליד הגלובוס: רענון הנתונים (כשהתפריט פתוח — בהיר/כהה, כמו ב־Academy) */
sa.shell = createShell({
  app: 'cashflow', title: 'THE SNOWBALL Cashflow', logo: 'logo-cashflow.webp', logoLg: 'logo-cashflow-lg.webp',
  items: [],
  onSettings: () => sa.settings && sa.settings(),
  action: { label: t('cfRefresh'), on: () => sa.refresh && sa.refresh(),
    icon: _IC_PRE + '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/></svg>' },
});
if (first === 'out') loginGate({ app: 'cashflow', auth: A, logo: 'logo-cashflow.webp', logoLg: 'logo-cashflow-lg.webp', name: 'Cashflow' });
else if (first === 'boot') ready.then((st) => { if (st === 'out') loginGate({ app: 'cashflow', auth: A, logo: 'logo-cashflow.webp', logoLg: 'logo-cashflow-lg.webp', name: 'Cashflow' }); });
openCashflow({ standalone: sa });
