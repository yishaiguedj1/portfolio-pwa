/* נוצר אוטומטית מ־cloud.js ו־tools/auth.tpl.js ב־tools/coregen.js — לא לערוך ביד (שינוי = ב־cloud.js / ב־tools/auth.tpl.js, ואז node tools/coregen.js). */
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

  /* ---- החיבור המשותף (שלב 2 בתוכנית שלוש האפליקציות, 13/10/2026) ----
     השרתון מחזיק עוגייה אחת (HttpOnly — לא נראית כאן), וכל אפליקציה שואלת אותו "מי מחובר?" ומקבלת טוקן של
     Firebase לעצמה (ct). עובד רק כשהאתר והשרתון באותו אתר (thesnowball.app) — ב־github.io העוגייה לא נשלחת, ושום
     דבר לא משתנה. התנתקות מתפשטת רק כשהחיבור במכשיר הזה נוצר דרך העוגייה (LS_SESS) — חיבור ישן לא מנותק. */
  const LS_SESS = 'pwa_sess_v1';
  const SESS_CHECK_MS = 5 * 60e3;
  let sessTried = false;
  let sessCheckedAt = 0;
  let sessBusy = false;          // התחברות עם Google באמצע — בדיקה במקביל הייתה רואה "אין עוגייה" ומנתקת
  function sessBase() {
    try {
      const proxy = (window.SNB_ENV || {}).proxy || '';
      const site = (h) => String(h).toLowerCase().split('.').slice(-2).join('.');
      const host = location.hostname;
      return /(^|\.)thesnowball\.app$/i.test(host) && site(host) === site(new URL(proxy).hostname) ? proxy : '';
    } catch (e) { return ''; }
  }
  async function sessCall(body, ms) {
    const base = sessBase();
    if (!base) return null;
    const ac = typeof AbortController === 'function' ? new AbortController() : null;
    const to = ac ? setTimeout(() => ac.abort(), ms || 6000) : 0;
    try {
      const r = await fetch(base + '/api/session', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body), signal: ac ? ac.signal : undefined,
      });
      return r.status === 200 ? await r.json() : null;
    } catch (e) { return null; } finally { clearTimeout(to); }
  }
  const sessMark = (on) => { try { if (on) localStorage.setItem(LS_SESS, '1'); else localStorage.removeItem(LS_SESS); } catch (e) {} };
  const sessMarked = () => { try { return localStorage.getItem(LS_SESS) === '1'; } catch (e) { return false; } };
  /* אחרי התחברות עם Google — העוגייה (השרתון מנפיק רק מהתחברות של עד 5 דקות). בקשה אחת בכל פעם (sessLoginP):
     onAuthStateChanged מתחיל אותה כבר כשהמשתמש מגיע, ומעבר הבעלים מחכה לה לפני הטעינה מחדש — עד 14/10/2026 הטעינה
     (התחברות אחרי "התנתק" = בעלים חדש) קטעה את הבקשה, העוגייה לא נשמרה, ו־Academy/Studio לא התחברו לבד. */
  let sessLoginP = null;
  function sessLogin(u) {
    if (!u || !sessBase()) return Promise.resolve();
    if (sessLoginP) return sessLoginP;
    sessLoginP = (async () => {
      try {
        const j = await sessCall({ op: 'login', idToken: await u.getIdToken() });
        if (j && j.ok) sessMark(true);
      } catch (e) {}
    })().finally(() => { sessLoginP = null; });
    return sessLoginP;
  }
  /* "מי מחובר?" — אין משתמש כאן ויש עוגייה → מתחברים בשקט */
  async function sessSignIn() {
    if (sessTried || !sessBase()) return false;
    sessTried = true;
    const j = await sessCall({ op: 'who' }, 4000);
    if (!j || j.s !== 1 || !j.ct) return false;
    try { await auth.signInWithCustomToken(j.ct); sessMark(true); return true; } catch (e) { sessCall({ op: 'note', c: String((e && e.code) || 'err').slice(0, 60) }); return false; }
  }
  /* יש משתמש כאן: התנתק באפליקציה אחרת / ממכשיר אחר → מתנתקים; התחבר בחשבון אחר → עוברים אליו */
  async function sessCheck(force) {
    if (!user || sessBusy || !sessBase() || (!force && Date.now() - sessCheckedAt < SESS_CHECK_MS)) return;
    sessCheckedAt = Date.now();
    const j = await sessCall({ op: 'who' });
    if (!j || !j.ok || !user || sessBusy) return;           // תקלה ברשת/בשרתון — לא מנתקים
    if (j.s === 1 && j.u === user.uid) { sessMark(true); return; }
    if (j.s === 1 && j.ct) { try { await flushSave(); await auth.signInWithCustomToken(j.ct); } catch (e) {} return; }
    if (j.s === 0 && sessMarked()) { sessMark(false); await flushSave(); try { await auth.signOut(); } catch (e) {} }
  }
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('visibilitychange', () => { if (!document.hidden) sessCheck(false); });
  }

  /* ---- שלב 4 בתוכנית העצמאות מ־Firebase (6/11/2026): התיק והספרייה דרך השרת שלנו (/api/udata) ----
     udGet(app) → { doc, ut, at } (doc=null: אין מסמך), או null = השרת לא זמין → הקוראת ממשיכה ל־Firestore כמו קודם.
     udPut(app, data, del) — data כמו ל־set(…, { merge: true }), del = נתיבים למחיקה. true / false (false = לכתוב ישירות).
     udDel(app) — מחיקת המסמך (רק invest). אחרי כתיבה ישירה ל־Firestore — udMark(app): רשומה ביומן snbChg (הכללים מתירים רק
     את שלך) ודגל במכשיר; בבקשה הבאה שמצליחה השרת מאחד את המסמך מ־Firestore (fb). השרת לא זמין → 5 דק׳ בלי לנסות.
     רק בכתובות של thesnowball.app (sessBase): ב־github.io השרתון הוא Vercel, ושם אין udata (404 → Firestore). */
  const UD_COL = { invest: 'users', academy: 'academyUsers' };
  const UD_OFF_MS = 5 * 60e3, UD_MS = 4000, UD_MEMO_MS = 10e3, LS_UDFB = 'pwa_udfb_v1';
  let udDownUntil = 0, udSkew = 0, udWhy = '';   // udWhy: 'down' = השרת נפל (רק אז רשומה ביומן); 'off' = כבוי / אין (Vercel)
  const udMemo = {};
  const udFb = () => { try { return JSON.parse(localStorage.getItem(LS_UDFB) || '{}') || {}; } catch (e) { return {}; } };
  const udFbSet = (app, on) => { try { const o = udFb(); if (on) o[app] = 1; else delete o[app]; localStorage.setItem(LS_UDFB, JSON.stringify(o)); } catch (e) {} };
  function udUser() {
    try { return typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length ? firebase.auth().currentUser : null; } catch (e) { return null; }
  }
  async function udCall(app, body) {
    const base = sessBase(), u = udUser();
    if (!base || !u || !UD_COL[app] || Date.now() < udDownUntil) return null;
    let tk = '';
    try { tk = await u.getIdToken(); } catch (e) { return null; }
    const fb = !!udFb()[app];
    const ac = typeof AbortController === 'function' ? new AbortController() : null;
    const to = ac ? setTimeout(() => ac.abort(), UD_MS) : 0;
    try {
      const r = await fetch(base + '/api/udata', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.assign({ app, idToken: tk }, fb ? { fb: 1 } : {}, body)), signal: ac ? ac.signal : undefined,
      });
      const d = Date.parse((r.headers && r.headers.get && r.headers.get('date')) || '');
      if (Number.isFinite(d)) udSkew = d - Date.now();
      if (r.status === 200) { const j = await r.json(); if (j && j.ok) { udWhy = ''; if (fb) udFbSet(app, false); return j; } return null; }
      let err = '';
      try { err = String(((await r.json()) || {}).error || ''); } catch (e) {}
      if (r.status === 404 || err === 'off') { udWhy = 'off'; udDownUntil = Date.now() + UD_OFF_MS; }
      else if (r.status >= 500) { udWhy = 'down'; udDownUntil = Date.now() + UD_OFF_MS; }   // כולל not_ready (ייבוא באמצע)
      else udWhy = 'err';
      return null;
    } catch (e) { udWhy = 'down'; udDownUntil = Date.now() + UD_OFF_MS; return null; } finally { clearTimeout(to); }
  }
  async function udGet(app) {
    const m = udMemo[app], u = udUser();
    if (m && u && m.uid === u.uid && Date.now() - m.at < UD_MEMO_MS) return m.v;   // הבדיקה בכניסה ומשיכת הספרייה — קריאה אחת
    const j = await udCall(app, { op: 'get' });
    const v = j ? { doc: j.doc || null, ut: +j.ut || 0, at: +j.at || 0 } : null;
    if (v && u) udMemo[app] = { uid: u.uid, at: Date.now(), v };
    return v;
  }
  async function udPut(app, data, del) {
    delete udMemo[app];
    return !!(await udCall(app, { op: 'put', data: data || {}, del: del || [] }));
  }
  async function udDel(app) {
    delete udMemo[app];
    return !!(await udCall(app, { op: 'del' }));
  }
  async function udMark(app, isDel) {
    const u = udUser(), col = UD_COL[app];
    if (!u || !col || !sessBase() || udWhy !== 'down') return;   // רק כשהשרת נפל (לא כשהוא כבוי / ב־github.io) — אין מה לאחד
    udFbSet(app, true);
    try {
      await firebase.firestore().collection('snbChg').doc(col + '~' + u.uid).set({ c: col, i: u.uid, t: Math.round(Date.now() + udSkew), d: !!isDel, f: 1 });
    } catch (e) {}
  }
  if (typeof window !== 'undefined') window.SNBud = { get: udGet, put: udPut, del: udDel, mark: udMark };

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

  /* 26/10/2026 (בקשת המשתמש): כניסה גם עם מייל רגיל (סיסמה או קישור במייל), וקישור / מיזוג של כמה שיטות כניסה לאותו
     משתמש. הממשק והלוגיקה ב־acclink.js (נטען רק כשצריך, משותף לשלוש האפליקציות); כאן רק הגישה ל־Firebase ולחיבור המשותף,
     וזיהוי חזרה מקישור הכניסה שנשלח במייל */
  window.SnbAcct = {
    auth: () => auth,
    base: () => sessBase(),
    busy: (on) => { sessBusy = !!on; },
    login: (u) => sessLogin(u),
    flush: () => flushSave(),
  };
  function emailLinkLanding() {
    try { if (auth && auth.isSignInWithEmailLink(location.href)) import('./acclink.js').then((m) => m.finishLink()).catch(() => {}); } catch (e) {}
    setTimeout(verifyCheck, 2500);
  }
  /* מייל + סיסמה שעוד לא אומת: אחרי שאימתו (בחלון אחר / מהמייל) — רענון המשתמש והטוקן מיד, כי ההרשאות בשרתון לפי email_verified.
     משתמש עם מייל בלי Google מקבל אז בדיוק מה שמקבל משתמש Google */
  async function verifyCheck() {
    const u = auth && auth.currentUser;
    if (!u || u.emailVerified || !(u.providerData || []).some((p) => p && p.providerId === 'password')) return;
    try {
      await u.reload();
      const v = auth.currentUser;
      if (v && v.emailVerified) { await v.getIdToken(true); if (typeof flash === 'function') flash(t('accVerified')); }
    } catch (e) {}
  }
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('visibilitychange', () => { if (!document.hidden) verifyCheck(); });
  }

  /* v313: מעבר בעלים → טעינה מחדש של הדף (שום דבר מהחשבון הקודם לא נשאר בזיכרון). שומר מפני לולאה. */
  function switchOwner(uid, hasDoc) {
    if (typeof accountSwitchTo !== 'function') return false;
    let changed = false;
    try { changed = accountSwitchTo(uid, hasDoc); } catch (e) { return 'stuck'; }
    if (!changed) return false;
    let last = 0;
    try { last = +sessionStorage.getItem('pwa_owner_rl') || 0; sessionStorage.setItem('pwa_owner_rl', String(Date.now())); } catch (e) {}
    if (Date.now() - last < 8000) return 'stuck';
    const go = () => location.reload();
    if (sessLoginP) { sessLoginP.then(go, go); setTimeout(go, 7000); } else go();   // העוגייה קודם
    return true;
  }

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
      emailLinkLanding();                                  // חזרה מקישור הכניסה במייל (acclink.js)
      auth.onAuthStateChanged(async (u) => {
        user = u;
        if (!u) {
          if (await sessSignIn()) return;                  // מחובר באפליקציה אחרת — onAuthStateChanged יחזור עם המשתמש
          if (switchOwner(null, null) === true) return;     // v313: הנתונים של החשבון הקודם יוצאים מהמכשיר הפעיל
          set('out');
          return;
        }
        if (sessBusy) sessLogin(u);                        // התחברות עם Google — העוגייה מיד, לפני מעבר הבעלים
        sessCheck(true);
        let hasDoc = null;                                 // לא ידוע (בלי רשת) — accountSwitchTo נזהר
        // שלב 6 (15/10/2026): כללי Firestore לפי אפליקציה — Academy בודקת את המסמך שלה (academyUsers), Studio אין לה מסמך
        const app = (document.documentElement.dataset || {}).app || '';
        if (app === 'academy') { try { const v = await udGet('academy'); if (v) hasDoc = !!(v.doc && v.doc.lib); else { const snap = await fs.collection('academyUsers').doc(u.uid).get(); hasDoc = !!(snap.exists && (snap.data() || {}).lib); } } catch (e) {} }
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
