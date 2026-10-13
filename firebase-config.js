/* ============================================================
 * הגדרות לפי סביבה + Firebase — נטען ראשון (לפני app.js ו־cloud.js)
 *
 * שלב 2 בתוכנית הסביבות (12/10/2026): אותם קבצים בדיוק רצים בכל הסביבות,
 * והסביבה נקבעת לפי הכתובת שבה האתר נפתח:
 *   prod    — yishaiguedj1.github.io (והדומיין thesnowball.app כשיעבור)
 *   staging — staging.thesnowball.app, <אפליקציה>-staging.thesnowball.app ותצוגות מקדימות של Cloudflare Pages (*.pages.dev)
 *   local   — localhost (בדיקות) — כמו prod
 * כך "קידום לפרודקשן" = אותה בנייה שנבדקה בניסוי, בלי לבנות מחדש.
 *
 * ההגדרות של Firebase פומביות מטבען (האבטחה בחוקי Firestore ובדומיינים
 * המאושרים), אין בעיה שהן בקוד. סביבת הניסוי = פרויקט Firebase נפרד —
 * הנתונים האמיתיים לא נגישים ממנה.
 * ============================================================ */
(function () {
  var PROD_FIREBASE = {
    apiKey: "AIzaSyDpz4owHSvJCYVzUFtZQL8V_e71HpVeffk",
    authDomain: "yishaiguedj1-c786e.firebaseapp.com",
    projectId: "yishaiguedj1-c786e",
    appId: "1:286578855160:web:c2f7a7e5e6a68685b9b3f0d"
  };
  // פרויקט ה־Firebase של סביבת הניסוי (12/10/2026) — נתונים נפרדים לגמרי מהייצור, אותם כללי Firestore.
  // פרויקט חדש = גם authDomain שלו ב־CSP של index.html (connect-src + frame-src) ובדומיינים המאושרים שם.
  var STAGING_FIREBASE = {
    apiKey: "AIzaSyDHfps7L0JFwL6eVvp9UbUphiirkw6GxhU",
    authDomain: "snowball-staging-758f6.firebaseapp.com",
    projectId: "snowball-staging-758f6",
    appId: "1:111890286593:web:2277c560813ec02fd99800"
  };
  var PROXY = 'https://ibkr-proxy-wine.vercel.app';
  // השרתון של הניסוי — חדר על שרת Hetzner מאחורי Cloudflare Tunnel (2ב, 12/10/2026): Firebase ודלי R2 של הניסוי.
  // כתובת חדשה = גם ב־connect-src של index.html.
  var STAGING_PROXY = 'https://api-staging.thesnowball.app';

  /* שלב 4 בתוכנית שלוש האפליקציות (13/10/2026): כתובת לכל אפליקציה — ייצור <אפליקציה>.thesnowball.app,
     ניסוי <אפליקציה>-staging.thesnowball.app. ברמה הראשונה בלבד (כמו api-staging): התעודה החינמית של Cloudflare
     (Universal SSL) לא מכסה a.b.thesnowball.app. אותה רשימה ב־ibkr-proxy/lib/session.js (APPS) וב־functions/index.js */
  var APP_HOST_RE = /^(invest|academy|studio|account)(-staging)?\.thesnowball\.app$/;
  var APP_PAGES = { invest: './', academy: 'academy.html', studio: 'studio.html' };

  function envFor(host) {
    host = String(host || '').toLowerCase();
    if (host === 'staging.thesnowball.app' || /\.pages\.dev$/.test(host)) return 'staging';
    var m = APP_HOST_RE.exec(host);
    if (m && m[2]) return 'staging';
    if (host === 'localhost' || host === '127.0.0.1' || host === '') return 'local';
    return 'prod';
  }

  /* הכתובת של כל אפליקציה מהמקום שבו נמצאים: בכתובות הנפרדות — הכתובת המלאה של האחרת באותה סביבה;
     באתר המאוחד (github.io, staging.thesnowball.app, ‎*.pages.dev, localhost) — הדפים שלידו */
  function appsFor(host) {
    var m = APP_HOST_RE.exec(String(host || '').toLowerCase());
    if (!m) return { invest: APP_PAGES.invest, academy: APP_PAGES.academy, studio: APP_PAGES.studio };
    var suf = (m[2] || '') + '.thesnowball.app/';
    return { invest: 'https://invest' + suf, academy: 'https://academy' + suf, studio: 'https://studio' + suf };
  }

  var host0 = typeof location !== 'undefined' ? location.hostname : '';
  var name = envFor(host0);
  var env = {
    name: name,
    // הניסוי מדבר רק עם השרתון שלו — ההתחברות של הניסוי מאומתת שם מול פרויקט ה־Firebase של הניסוי
    proxy: name === 'staging' ? STAGING_PROXY : PROXY,
    firebase: name === 'staging' ? STAGING_FIREBASE : PROD_FIREBASE,
    apps: appsFor(host0)
  };
  if (typeof window !== 'undefined') {
    window.SNB_ENV = env;
    window.FIREBASE_CONFIG = env.firebase || {};
    window.snbEnvFor = envFor;
    window.snbAppsFor = appsFor;
    if (name === 'staging' && typeof document !== 'undefined') document.documentElement.classList.add('env-staging');
  }
})();
