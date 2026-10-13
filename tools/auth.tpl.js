'use strict';
/* החיבור הרזה לדפים העצמאיים (Academy, Studio) — שלב 3ב בתוכנית שלוש האפליקציות, 13/10/2026.
   cloud.js בנוי על app.js (התיק, הדמו, כרטיס החשבון) ולא נטען בלעדיו; כאן רק מה שדף עצמאי צריך:
   טעינת Firebase עם SRI, החיבור המשותף (/api/session — מחובר באפליקציה אחת = מחובר כאן), כניסה עם Google,
   התנתקות שמתפשטת, והחלפת בעלים במכשיר (v313 — accountSwitchTo מ־core.js). החלקים המשותפים מועתקים מ־cloud.js
   (האזורים <auth>) — כאן רק התבנית. לפני הקובץ: firebase-config.js, strings-<אפליקציה>.js, core.js.

   window.SnbAuth = { start(), onChange(cb), signIn(), signOut(), user(), state() }
   state: 'boot' (בודק) · 'in' (מחובר) · 'out' (לא מחובר) · 'off' (אין Firebase/רשת) · 'stuck' (החלפת בעלים נכשלה) */
(function () {
  if (typeof window === 'undefined') return;

  const cfg = window.FIREBASE_CONFIG || {};
  const isConfigured = !!(cfg.apiKey && cfg.authDomain && cfg.projectId && !/להדביק/.test(String(cfg.apiKey)));
  let auth = null;
  let fs = null;
  let user = null;
  async function flushSave() {}     // בדפים האלה אין שמירה ממתינה של התיק (הספרייה והסטודיו שומרים בעצמם)

// @@cloud@@

  let cur = 'boot';
  const subs = [];
  function set(st) { cur = st; for (const f of subs.slice()) { try { f(st, user); } catch (e) {} } }

  async function signIn() {
    if (!auth) return false;
    sessBusy = true;
    try {
      const cred = await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
      await sessLogin(cred && cred.user);
      return true;
    } catch (e) { return false; } finally { sessBusy = false; }
  }
  async function signOut() {
    sessMark(false);
    sessTried = true;                                        // אחרי "התנתק" — בלי כניסה שקטה (כמו ב־cloud.js)
    await sessCall({ op: 'logout' }, 3000);
    try { if (auth) await auth.signOut(); } catch (e) {}
  }

  let started = false;
  function start() {
    if (started) return;
    started = true;
    if (!isConfigured) { set('off'); return; }
    loadSdk().then((ok) => {
      if (!ok || !initSdk()) { set('off'); return; }
      auth.onAuthStateChanged(async (u) => {
        user = u;
        if (!u) {
          if (await sessSignIn()) return;                  // מחובר באפליקציה אחרת — onAuthStateChanged יחזור עם המשתמש
          if (switchOwner(null, null) === true) return;     // v313: הנתונים של החשבון הקודם יוצאים מהמכשיר הפעיל
          set('out');
          return;
        }
        sessCheck(true);
        let hasDoc = null;                                 // לא ידוע (בלי רשת) — accountSwitchTo נזהר
        try { const snap = await fs.collection('users').doc(u.uid).get(); hasDoc = !!(snap.exists && (snap.data() || {}).db); } catch (e) {}
        const sw = switchOwner(u.uid, hasDoc);
        if (sw === true) return;                           // הדף נטען מחדש עם הנתונים של החשבון הזה בלבד
        set(sw === 'stuck' ? 'stuck' : 'in');
      });
    });
  }

  window.SnbAuth = {
    start: start,
    onChange: function (cb) { subs.push(cb); if (cur !== 'boot') { try { cb(cur, user); } catch (e) {} } },
    signIn: signIn,
    signOut: signOut,
    user: function () { return user; },
    state: function () { return cur; },
  };
})();
