/* ============================================================
 * הגדרות לפי סביבה + Firebase — נטען ראשון (לפני app.js ו־cloud.js)
 *
 * שלב 2 בתוכנית הסביבות (12/10/2026): אותם קבצים בדיוק רצים בכל הסביבות,
 * והסביבה נקבעת לפי הכתובת שבה האתר נפתח:
 *   prod    — yishaiguedj1.github.io (והדומיין thesnowball.app כשיעבור)
 *   staging — staging.thesnowball.app ותצוגות מקדימות של Cloudflare Pages (*.pages.dev)
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

  function envFor(host) {
    host = String(host || '').toLowerCase();
    if (host === 'staging.thesnowball.app' || /\.pages\.dev$/.test(host)) return 'staging';
    if (host === 'localhost' || host === '127.0.0.1' || host === '') return 'local';
    return 'prod';
  }

  var name = envFor(typeof location !== 'undefined' ? location.hostname : '');
  var env = {
    name: name,
    // השרתון של הניסוי (חדר נפרד על השרת) עוד לא קיים — בינתיים אותו שרתון. בקשות מהניסוי
    // מקבלות שם רק מידע ציבורי (מחירים, היסטוריה, חיפוש): Firebase של הניסוי לא מאומת מול פרויקט הייצור.
    proxy: PROXY,
    firebase: name === 'staging' ? STAGING_FIREBASE : PROD_FIREBASE
  };
  if (typeof window !== 'undefined') {
    window.SNB_ENV = env;
    window.FIREBASE_CONFIG = env.firebase || {};
    window.snbEnvFor = envFor;
    if (name === 'staging' && typeof document !== 'undefined') document.documentElement.classList.add('env-staging');
  }
})();
