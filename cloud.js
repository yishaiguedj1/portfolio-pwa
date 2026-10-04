'use strict';
/* ============================================================
 * ענן — התחברות עם Google וסנכרון נתונים ב-Firestore
 *
 * - נטען אחרי app.js ומשתמש בפונקציות הגלובליות שלו
 *   (DB, saveDBto, tdKey, esc, setBanner, renderAll...)
 * - אם Firebase לא הוגדר או אין אינטרנט — האפליקציה עובדת
 *   מקומית כרגיל, בלי שום שינוי.
 * - כל משתמש מקבל מסמך פרטי: users/{uid}
 *   חוקי האבטחה ב-Firestore מאפשרים לכל משתמש לראות
 *   ולערוך רק את המסמך שלו.
 * ============================================================ */

(function () {
  if (typeof window === 'undefined') return;

  const cfg = window.FIREBASE_CONFIG || {};
  const isConfigured = !!(
    cfg.apiKey && cfg.authDomain && cfg.projectId &&
    !/להדביק/.test(String(cfg.apiKey))
  );

  let auth = null;
  let fs = null;
  let user = null;
  const LS_CLOUD_USER = 'pwa_cloud_user_v1'; // v193: '1' כשיש משתמש ענן מחובר במכשיר הזה
  let localMode = false;
  let bootFallback = null;
  let saveTimer = null;

  function sdkOk() {
    return isConfigured &&
      typeof firebase !== 'undefined' &&
      firebase.auth && firebase.firestore;
  }

  /* v193: ה־SDK של Firebase (3 קבצים, ~300KB) נטען כאן — אחרי הציור הראשון — ולא בתגי <script> חוסמים ב־index.html.
     אותם קבצים, אותן חתימות SRI (tests/csp.test.js בודק), נטענים בסדר (app → auth → firestore). */
  const SDK = [
    ['https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js', 'sha384-AQ3POAMqIhwS81FrUH95ekxqBZHeP5tG2JfEL3+7GuTtfRLWnrRh32UxwzM+//A9'],
    ['https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js', 'sha384-TnlRYaR4JYz/lpaGuaiU61PjNberSA4vjLjtF+oRC/IkohkJqnWxw5EmDSOt1vA1'],
    ['https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js', 'sha384-qn4Jh88HhJA8dplNQyGjOh9OGI4izVhrfj/qIFgaKcdgOE06pXqIKGlsCILZcLAC'],
  ];
  let sdkLoading = null;
  function loadSdk() {
    if (typeof firebase !== 'undefined' && firebase.auth && firebase.firestore) return Promise.resolve(true);
    if (sdkLoading) return sdkLoading;
    sdkLoading = new Promise((resolve) => {
      let i = 0;
      const next = () => {
        if (i >= SDK.length) { resolve(typeof firebase !== 'undefined' && !!firebase.auth && !!firebase.firestore); return; }
        const sc = document.createElement('script');
        sc.src = SDK[i][0];
        sc.integrity = SDK[i][1];
        sc.crossOrigin = 'anonymous';
        sc.async = false;
        sc.addEventListener('load', () => { i++; next(); });
        sc.addEventListener('error', () => resolve(false));
        document.head.appendChild(sc);
      };
      next();
    });
    return sdkLoading;
  }

  function initSdk() {
    if (!sdkOk() || auth) return sdkOk();
    try {
      if (!firebase.apps.length) firebase.initializeApp(cfg);
      auth = firebase.auth();
      fs = firebase.firestore();
      return true;
    } catch (e) {
      return false;
    }
  }

  function userDoc() {
    return fs.collection('users').doc(user.uid);
  }

  function validCloudDb(d) {
    return d && d.v === 1 &&
      Array.isArray(d.positions) && Array.isArray(d.deposits);
  }

  /* מחיל נתוני ענן על ה-DB החי — במקום, כדי לא לשבור הפניות קיימות */
  function applyCloudDb(cdb) {
    const clean = JSON.parse(JSON.stringify(cdb));
    DB.positions.length = 0;
    DB.positions.push(...clean.positions);
    DB.deposits.length = 0;
    DB.deposits.push(...clean.deposits);
    DB.pensionFunds.length = 0;
    DB.pensionFunds.push(...(clean.pensionFunds || []));
    if (typeof ensurePensionKinds === 'function') ensurePensionKinds(DB);
    DB.pensionDeposits.length = 0;
    DB.pensionDeposits.push(...(clean.pensionDeposits || []));
    const c = clean.cash || {};
    DB.cash = { usd: num(c.usd) || 0, ils: num(c.ils) || 0 };
    // v141: עסקאות ידניות (ענן ישן בלי השדה — משאירים את המקומיות)
    if (Array.isArray(clean.manualTrades)) DB.manualTrades = clean.manualTrades;
    // v244: רשימות המעקב (הראשית + הנוספות) — עוברות בין מכשירים; ענן ישן בלי השדות — המקומיות נשארות
    if (Array.isArray(clean.wishlist) && Array.isArray(DB.wishlist)) { DB.wishlist.length = 0; DB.wishlist.push(...clean.wishlist); }
    if (Array.isArray(clean.wlExtra)) DB.wlExtra = clean.wlExtra;
    if (typeof clean.wlMainName === 'string') DB.wlMainName = clean.wlMainName;
    if (Array.isArray(clean.wlOrder)) DB.wlOrder = clean.wlOrder; // v278: סדר טאבי הרשימות
    if (Array.isArray(clean.stockOrder)) DB.stockOrder = clean.stockOrder; // v246: סדר אישי בטאב המניות
    // v146: רשומות הדוגמה הישנות (עד v145) שנשמרו כנתונים — מנקים ומעדכנים את הענן
    const stripped = (typeof stripLegacyDemo === 'function') && stripLegacyDemo(DB);
    saveDBto(DB); // עדכון המטמון המקומי
    return !!stripped;
  }

  /* v146: במצב דמו לא כותבים לענן — הנתונים האמיתיים שם נשארים כמו שהם */
  function demoOn() { return typeof isDemoMode === 'function' && isDemoMode(); }

  /* שמירה לענן — עם השהיה קצרה כדי לא להציף בכתיבות */
  /* v313: שמירה לענן רק אחרי שהנתונים של החשבון המחובר נטענו, ורק כשהנתונים במכשיר שייכים לו —
     אחרת שמירה שהתחילה בזמן הטעינה הייתה כותבת את התיק של החשבון הקודם למסמך של החדש */
  let ready = false;
  function ownsLocal() { return !!user && (typeof accountOwner !== 'function' || accountOwner() === user.uid); }
  function scheduleSave() {
    if (!user || !fs || localMode || demoOn() || !ready || !ownsLocal()) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flushSave, 2000);
  }

  async function flushSave() {
    if (!user || !fs || localMode || demoOn() || !ready || !ownsLocal()) return;
    clearTimeout(saveTimer);
    try {
      await userDoc().set({
        v: 1,
        db: JSON.parse(JSON.stringify(DB)),
        // אבטחה (25/09/2026): מפתח Twelve Data נשאר בטלפון בלבד — ומוחקים עותק ישן מהענן
        tdkey: firebase.firestore.FieldValue.delete(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (e) {
      /* נכשל (למשל אין אינטרנט) — נשמר מקומית, ינסה שוב בשמירה הבאה */
    }
  }

  async function resetCloud() {
    clearTimeout(saveTimer);
    if (!user || !fs || localMode || !ownsLocal()) return;
    try { await userDoc().delete(); } catch (e) {}
  }

  function showLogin() {
    const o = document.getElementById('loginOverlay');
    if (o) o.classList.remove('hidden');
  }

  function hideLogin() {
    const o = document.getElementById('loginOverlay');
    if (o) o.classList.add('hidden');
  }

  function wireLoginUi() {
    const loginBtn = document.getElementById('googleLoginBtn');
    if (loginBtn && !loginBtn._wired) {
      loginBtn._wired = true;
      loginBtn.addEventListener('click', async () => {
        const err = document.getElementById('loginErr');
        if (err) err.classList.add('hidden');
        try {
          await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
        } catch (e) {
          if (err) {
            err.textContent = t('loginFailed');
            err.classList.remove('hidden');
          }
        }
      });
    }
    const skipBtn = document.getElementById('skipLoginBtn');
    if (skipBtn && !skipBtn._wired) {
      skipBtn._wired = true;
      skipBtn.addEventListener('click', () => {
        localMode = true;
        hideLogin();
        renderAccountCard();
        if (bootFallback) bootFallback();
      });
    }
  }

  function renderAccountCard() {
    const box = document.getElementById('accountInfo');
    if (!box) return;
    box.innerHTML = '';
    const mk = (html) => {
      const d = document.createElement('div');
      d.innerHTML = html;
      return d;
    };

    if (!sdkOk()) {
      box.appendChild(mk(
        '<p class="fine" style="padding:0">' + t('cloudNotSetup') + '</p>'
      ).firstChild);
      return;
    }

    // v297 (בקשת המשתמש, אחרי תצוגה מקדימה): בסגנון Apple ID — תמונה + שם + מייל, ופעולה כשורת רשימה
    const OUT_IC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 17l5-5-5-5"/><path d="M20 12H9"/><path d="M12 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6"/></svg>';
    const PHONE_IC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M11 18h2"/></svg>';
    const CLOUD_IC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19a4.5 4.5 0 0 0 .5-8.97A6 6 0 0 0 6.2 9.1 4 4 0 0 0 6.5 19z"/></svg>';
    const idRow = (avatarHTML, title, sub) => mk('<div class="acc-id">' + avatarHTML +
      '<div class="acc-txt"><b>' + esc(title) + '</b><span>' + esc(sub) + '</span></div></div>').firstChild;
    const actRow = (cls, icon, label, onClick) => {
      const list = mk('<div class="ios-list"><button type="button" class="ios-row ios-row-btn ' + cls + '">' +
        '<span class="ios-row-ic" aria-hidden="true">' + icon + '</span><span class="ios-row-lbl">' + esc(label) + '</span></button></div>').firstChild;
      list.querySelector('button').addEventListener('click', onClick);
      return list;
    };

    if (user) {
      const row = idRow('<img alt="" src="' + esc(user.photoURL || 'icon-192.png') + '">', user.displayName || t('userLabel'), user.email || '');
      const img = row.querySelector('img');
      if (img) img.addEventListener('error', () => { img.src = 'icon-192.png'; }, { once: true });
      box.appendChild(row);
      box.appendChild(actRow('acc-out', OUT_IC, t('signOut'), signOut));
      // v289: שורת "מחובר — הנתונים נשמרים בענן…" הוסרה (בקשת המשתמש)
      return;
    }

    if (localMode) {
      box.appendChild(idRow('<span class="acc-av" aria-hidden="true">' + PHONE_IC + '</span>', t('localModeTitle'), t('localModeSub')));
      box.appendChild(actRow('', CLOUD_IC, t('googleSignIn'), () => { localMode = false; showLogin(); }));
      return;
    }

    const p = document.createElement('p');
    p.className = 'fine';
    p.style.padding = '0';
    p.textContent = t('signingIn');
    box.appendChild(p);
  }

  async function signOut() {
    await flushSave();
    localMode = false;
    try { await auth.signOut(); } catch (e) {}
    /* onAuthStateChanged יציג את מסך ההתחברות */
  }

  function boot(fallback) {
    bootFallback = fallback;
    renderAccountCard();
    if (!isConfigured) {
      fallback(); // אין ענן — עובדים מקומית
      return;
    }
    // v193: האפליקציה כבר צוירה מהנתונים המקומיים (init קורא ל־startApp לפני boot); ה־SDK נטען אחרי הפריים הראשון
    const go = () => loadSdk().then((ok) => {
      if (!ok || !initSdk()) { renderAccountCard(); fallback(); return; }
      wireLoginUi();
      watchAuth();
    });
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => setTimeout(go, 0)); else setTimeout(go, 0);
  }

  function watchAuth() {
    const fallback = bootFallback;
    /* v313: מעבר בעלים → טעינה מחדש של הדף (שום דבר מהחשבון הקודם לא נשאר בזיכרון). שומר מפני לולאה. */
    const switchOwner = (uid, hasDoc) => {
      if (typeof accountSwitchTo !== 'function') return false;
      let changed = false;
      try { changed = accountSwitchTo(uid, hasDoc); } catch (e) { return 'stuck'; }
      if (!changed) return false;
      let last = 0;
      try { last = +sessionStorage.getItem('pwa_owner_rl') || 0; sessionStorage.setItem('pwa_owner_rl', String(Date.now())); } catch (e) {}
      if (Date.now() - last < 8000) return 'stuck';
      location.reload();
      return true;
    };
    auth.onAuthStateChanged(async (u) => {
      clearTimeout(saveTimer);
      ready = false;
      user = u;
      // v193: דגל "היה מחובר" — app.js משתמש בו כדי לא לצייר תיק ריק לרגע כשהאחסון המקומי ריק אבל הענן מלא
      try { if (u) localStorage.setItem(LS_CLOUD_USER, '1'); else localStorage.removeItem(LS_CLOUD_USER); } catch (e) {}
      if (!u) {
        if (switchOwner(null, null) === true) return;   // v313: התנתקות — הנתונים של החשבון יוצאים מהמכשיר הפעיל
        if (!localMode) showLogin();
        renderAccountCard();
        fallback(); // v193: לא מחובר — האפליקציה ממשיכה מקומית (startApp עמיד לקריאה חוזרת)
        return;
      }
      hideLogin();
      renderAccountCard();
      try {
        const snap = await userDoc().get();
        const sw = switchOwner(u.uid, !!(snap.exists && validCloudDb((snap.data() || {}).db)));
        if (sw === true) return;                       // v313: הדף נטען מחדש עם הנתונים של החשבון הזה בלבד
        if (sw === 'stuck') { fallback(); return; }    // לא הצלחנו להחליף — לא כותבים לענן בכלל (ready נשאר false)
        ready = true;                                  // הנתונים במכשיר שייכים לחשבון הזה — מותר לשמור
        if (demoOn()) {
          /* מצב דמו: לא דורסים את הדמו בנתוני הענן (הם יחזרו ביציאה מהדמו) */
        } else if (snap.exists && validCloudDb(snap.data().db)) {
          const data = snap.data();
          if (applyCloudDb(data.db)) await flushSave();
          /* מפתח Twelve Data לא נטען מהענן (אבטחה) — נשמר רק בטלפון שבו הוזן */
        } else {
          /* אין מסמך בענן עדיין (משתמש חדש / אחרי איפוס) — מתחילים מתיק ריק (v146).
             לעולם לא מושכים נתונים מהטלפון; הענן הוא מקור האמת היחיד. */
          applyDbData(demoDb());
          await flushSave();
        }
      } catch (e) {
        // בלי רשת: לא יודעים אם יש מסמך — מחליפים בעלים בזהירות (חשבון לא מוכר לא מקבל נתונים ישנים)
        const sw = ready ? false : switchOwner(u.uid, null);
        if (sw === true) return;
        if (sw !== 'stuck') ready = true;
        if (typeof setBanner === 'function') setBanner(t('offlineMode'));
      }
      fallback();
    });
  }

  window.Cloud = {
    boot: boot,
    signOut: signOut,
    resetCloud: resetCloud,
    scheduleSave: scheduleSave,
    flushSave: flushSave,
    isConfigured: function () { return isConfigured; }
  };
  /* ווים ש-app.js קורא להם — נשארים שקטים אם אין ענן */
  window.__cloudSave = scheduleSave;
  window.__cloudFlush = flushSave;
})();
