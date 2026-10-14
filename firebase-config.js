/* ============================================================
 * הגדרות לפי סביבה + Firebase — נטען ראשון (לפני app.js ו־cloud.js)
 *
 * שלב 2 בתוכנית הסביבות (12/10/2026): אותם קבצים בדיוק רצים בכל הסביבות,
 * והסביבה נקבעת לפי הכתובת שבה האתר נפתח:
 *   prod    — yishaiguedj1.github.io, ומשלב 5 <אפליקציה>.thesnowball.app (השרתון שם: api.thesnowball.app)
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
  /* שלב 5 (14/10/2026): בכתובות של הייצור ב־thesnowball.app השרתון הוא החדר שלנו (snb-2) — באותו אתר, כך שעוגיית
     החיבור המשותף עוברת. Vercel = גיבוי חם: אותן פונקציות, אותם סודות ואותו Firestore (installFailover למטה).
     ב־github.io נשאר Vercel. כתובת חדשה = גם ב־connect-src של כל הדפים */
  var PROD_API = 'https://api.thesnowball.app';
  var PROD_HOST_RE = /^((invest|academy|studio|account)\.)?thesnowball\.app$/;
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

  // השרתון לפי הכתובת: הניסוי מדבר רק עם השרתון שלו (ההתחברות של הניסוי מאומתת שם מול ה־Firebase של הניסוי)
  function proxyFor(host) {
    host = String(host || '').toLowerCase();
    if (envFor(host) === 'staging') return STAGING_PROXY;
    return PROD_HOST_RE.test(host) ? PROD_API : PROXY;
  }

  /* גיבוי חם (שלב 5, ב2): השרת שלנו לא עונה (Tunnel/השרת נפלו — Cloudflare מחזיר דף שגיאה בלי CORS, כלומר
     TypeError) → אותה בקשה ל־Vercel, ו־5 דקות כל הבקשות ישר לשם (בלשונית הזו), ואז ניסיון חוזר. לא:
     /api/session (העוגייה רק על השרת שלנו — בלעדיו החיבור המשותף פשוט לא זמין), ביטול, אופליין, ו־Request עם
     גוף (נצרך כבר). בקשה שהשרת כן ענה עליה (גם 5xx) — לא חוזרת: היא כבר הגיעה. */
  var DOWN_KEY = 'snb_api_down', DOWN_MS = 5 * 60e3;
  function installFailover(win, primary, backup) {
    if (!win || typeof win.fetch !== 'function' || !backup || primary === backup) return;
    var orig = win.fetch;
    var store = function () { try { return win.sessionStorage; } catch (e) { return null; } };
    var isDown = function () { var s = store(); return !!s && +(s.getItem(DOWN_KEY) || 0) > Date.now(); };
    var markDown = function () { var s = store(); try { if (s) s.setItem(DOWN_KEY, String(Date.now() + DOWN_MS)); } catch (e) {} };
    win.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : '';
      if (url.indexOf(primary + '/') !== 0 || /\/api\/session(\b|$)/.test(url)) return orig.call(win, input, init);
      var alt = backup + url.slice(primary.length);
      if (isDown()) return orig.call(win, alt, init);
      return orig.call(win, input, init).catch(function (e) {
        var sig = init && init.signal;
        if ((e && e.name === 'AbortError') || (sig && sig.aborted)) throw e;
        if (win.navigator && win.navigator.onLine === false) throw e;
        markDown();
        return orig.call(win, alt, init);
      });
    };
  }

  var host0 = typeof location !== 'undefined' ? location.hostname : '';
  var name = envFor(host0);
  var proxy = proxyFor(host0);
  var env = {
    name: name,
    proxy: proxy,
    proxyBackup: proxy === PROD_API ? PROXY : '',
    firebase: name === 'staging' ? STAGING_FIREBASE : PROD_FIREBASE,
    apps: appsFor(host0)
  };
  if (typeof window !== 'undefined') {
    window.SNB_ENV = env;
    window.FIREBASE_CONFIG = env.firebase || {};
    window.snbEnvFor = envFor;
    window.snbAppsFor = appsFor;
    window.snbProxyFor = proxyFor;
    window.snbFailover = installFailover;   // לבדיקות
    installFailover(window, env.proxy, env.proxyBackup);
    if (name === 'staging' && typeof document !== 'undefined') document.documentElement.classList.add('env-staging');
  }
})();
