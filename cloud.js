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
  let localMode = false;
  let bootFallback = null;
  let saveTimer = null;

  function sdkOk() {
    return isConfigured &&
      typeof firebase !== 'undefined' &&
      firebase.auth && firebase.firestore;
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
    saveDBto(DB); // עדכון המטמון המקומי
  }

  /* שמירה לענן — עם השהיה קצרה כדי לא להציף בכתיבות */
  function scheduleSave() {
    if (!user || !fs || localMode) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flushSave, 2000);
  }

  async function flushSave() {
    if (!user || !fs || localMode) return;
    clearTimeout(saveTimer);
    try {
      await userDoc().set({
        v: 1,
        db: JSON.parse(JSON.stringify(DB)),
        tdkey: (typeof tdKey === 'function' ? tdKey() : null) || null,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (e) {
      /* נכשל (למשל אין אינטרנט) — נשמר מקומית, ינסה שוב בשמירה הבאה */
    }
  }

  async function resetCloud() {
    clearTimeout(saveTimer);
    if (!user || !fs || localMode) return;
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

    if (user) {
      const wrap = document.createElement('div');
      wrap.className = 'account-row';
      const img = document.createElement('img');
      img.alt = '';
      img.src = user.photoURL || 'icon-192.png';
      const info = document.createElement('div');
      info.innerHTML =
        '<b>' + esc(user.displayName || t('userLabel')) + '</b><br>' +
        '<span class="fine" style="padding:0">' + esc(user.email || '') + '</span>';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip-btn';
      btn.textContent = t('signOut');
      btn.addEventListener('click', signOut);
      wrap.appendChild(img);
      wrap.appendChild(info);
      box.appendChild(wrap);
      box.appendChild(btn);
      const note = document.createElement('p');
      note.className = 'fine';
      note.style.padding = '0';
      note.textContent = t('cloudConnected');
      box.appendChild(note);
      return;
    }

    if (localMode) {
      const p = document.createElement('p');
      p.className = 'fine';
      p.style.padding = '0';
      p.textContent = t('localMode');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip-btn';
      btn.textContent = t('googleSignIn');
      btn.addEventListener('click', () => { localMode = false; showLogin(); });
      box.appendChild(p);
      box.appendChild(btn);
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
    if (!initSdk()) {
      fallback(); // אין ענן — עובדים מקומית
      return;
    }
    wireLoginUi();
    auth.onAuthStateChanged(async (u) => {
      user = u;
      if (!u) {
        if (!localMode) showLogin();
        renderAccountCard();
        return;
      }
      hideLogin();
      renderAccountCard();
      try {
        const snap = await userDoc().get();
        if (snap.exists && validCloudDb(snap.data().db)) {
          const data = snap.data();
          applyCloudDb(data.db);
          if (data.tdkey) {
            try { localStorage.setItem(LS_TDKEY, data.tdkey); } catch (e) {}
          }
        } else {
          /* אין מסמך בענן עדיין (משתמש חדש / אחרי איפוס).
             מציגים את תיק הדוגמה כדי שהאפליקציה לא תישאר ריקה —
             לעולם לא מושכים נתונים מהטלפון; הענן הוא מקור האמת היחיד. */
          applyDbData(demoDb());
          await flushSave();
        }
      } catch (e) {
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
