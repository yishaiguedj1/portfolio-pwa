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
  const LS_ACC_PROF = 'pwa_accprof_v1';    // 29/10/2026: שם/מייל/תמונה מהחיבור האחרון — כרטיס החשבון בציור הראשון (ACCOUNT_KEYS)
  let authSettled = false;                    // onAuthStateChanged כבר ענה פעם אחת
  const accProf = () => { try { const o = JSON.parse(localStorage.getItem(LS_ACC_PROF) || 'null'); return o && (o.n || o.e) ? o : null; } catch (e) { return null; } };
  const LS_CLOUD_USER = 'pwa_cloud_user_v1'; // v193: '1' כשיש משתמש ענן מחובר במכשיר הזה
  let localMode = false;
  let bootFallback = null;
  let saveTimer = null;

  /* <auth> */
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
    accDaily(user);                                         // שלב 2, גל 2: הרישום השקט אצלנו (פעם ביום)
    const j = await sessCall({ op: 'who' });
    if (!j || !j.ok || !user || sessBusy) return;           // תקלה ברשת/בשרתון — לא מנתקים
    if (j.s === 1 && j.u === user.uid) { sessMark(true); return; }
    if (j.s === 1 && j.ct) { try { await flushSave(); await auth.signInWithCustomToken(j.ct); } catch (e) {} return; }
    if (j.s === 0 && sessMarked()) { sessMark(false); await flushSave(); try { await auth.signOut(); } catch (e) {} }
  }
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('visibilitychange', () => { if (!document.hidden) sessCheck(false); });
  }
  /* </auth> */

  /* <auth> */
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
  /* </auth> */

  /* <auth> */
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
  /* </auth> */

  /* <auth> */
  /* ---- שלב 2, גל 2 (7/11/2026): החשבונות אצלנו — צד הטלפון (docs/accounts.md) ----
     כניסה עם Google דרך השרת: gCfg נשאל מראש (gPrep), כי אחרי await בלחיצה כבר אי אפשר לפתוח את החלון של Firebase.
     דולק → חלון oauth.html שנפתח בתוך הלחיצה (gWin), עם state, ‏nonce ו־PKCE אקראיים (crypto) → gLogin → העוגייה + ct →
     signInWithCustomToken (בלי ct — who). כבוי / לא ידוע → הכניסה של Firebase כמו קודם. נכשל אחרי שהחלון נפתח → false,
     והלחיצה הבאה עוברת ל־Firebase (gSrvOff). accReg פעם ביום לכל חשבון; pwSet פעם אחת אחרי כניסה בסיסמה. הסיסמה לא נשמרת */
  const LS_ACCREG = 'pwa_accreg_v1', LS_PWSET = 'pwa_pwset_v1';   // ACCOUNT_KEYS
  const G_PROMPT = 'select_account';                        // בחירת חשבון בכל כניסה
  const G_CID_RE = /^[\w.-]{6,200}\.apps\.googleusercontent\.com$/;
  let gCfgP = null, gCid = '', gSrvOff = false, gCancel = null;
  function gPrep() {
    if (gCfgP || gCid || !sessBase()) return gCfgP;
    gCfgP = sessCall({ op: 'gCfg' }, 4000).then((j) => {
      gCid = j && j.ok && j.on && G_CID_RE.test(String(j.cid || '')) ? String(j.cid) : '';
      if (!j) gCfgP = null;                                   // תקלה ברשת — ננסה שוב בפעם הבאה
    });
    return gCfgP;
  }
  const gReady = () => !!(gCid && !gSrvOff && sessBase() && typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.getRandomValues === 'function');
  function gWin() { try { return window.open('', 'snb-oauth', 'popup,width=480,height=700'); } catch (e) { return null; } }
  const b64u = (a) => { let s = ''; for (const b of a) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const rnd = (n) => b64u(crypto.getRandomValues(new Uint8Array(n)));
  /* הקוד חוזר מ־oauth.html (אותו origin) — BroadcastChannel, או האחסון כגיבוי. רק עם ה־state שלנו. לחיצה נוספת מבטלת.
     חזרה לאפליקציה בלי קוד (החלון נסגר — w.closed לא אמין מול COOP של Google) → בוטל אחרי 4 שניות */
  function gCode(w, url, state) {
    if (gCancel) gCancel();
    const t0 = Date.now();
    return new Promise((resolve) => {
      let bc = null, poll = 0, to = 0, back = 0, fin = false;
      const done = (v) => {
        if (fin) return;
        fin = true;
        clearInterval(poll); clearTimeout(to); clearTimeout(back); gCancel = null;
        try { bc && bc.close(); } catch (e) {}
        try { window.removeEventListener('storage', onStore); window.removeEventListener('focus', onBack); document.removeEventListener('visibilitychange', onBack); } catch (e) {}
        try { localStorage.removeItem('pwa_oauth_v1'); } catch (e) {}
        resolve(v);
      };
      const onBack = () => {
        if (fin || (document && document.hidden) || Date.now() - t0 < 1500) return;
        clearTimeout(back);
        back = setTimeout(() => { fromLs(); done(null); }, 4000);
      };
      try { window.addEventListener('focus', onBack); document.addEventListener('visibilitychange', onBack); } catch (e) {}
      const take = (m) => { if (m && typeof m.state === 'string' && m.state === state) done({ code: String(m.code || ''), error: String(m.error || '') }); };
      const fromLs = () => { try { take(JSON.parse(localStorage.getItem('pwa_oauth_v1') || 'null')); } catch (e) {} };
      const onStore = (e) => { if (e.key === 'pwa_oauth_v1') fromLs(); };
      try { bc = new BroadcastChannel('snb-oauth'); bc.onmessage = (e) => take(e.data); } catch (e) {}
      try { window.addEventListener('storage', onStore); } catch (e) {}
      poll = setInterval(fromLs, 600);
      to = setTimeout(() => done(null), 5 * 60e3);
      gCancel = () => done(null);
      try { w.location.href = url; } catch (e) { done(null); }
    });
  }
  /* true = מחובר · 'cancel' = בוטל (בלי הודעה) · false = נכשל (הלחיצה הבאה — Firebase) */
  async function gSrvSignIn(w) {
    sessBusy = true;
    try {
      const verifier = rnd(48), state = 'li' + rnd(18), nonce = rnd(24);
      const ch = b64u(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
      const redirect = new URL('oauth.html', document.baseURI).href;
      const q = [['client_id', gCid], ['redirect_uri', redirect], ['response_type', 'code'], ['scope', 'openid email profile'], ['state', state],
        ['nonce', nonce], ['code_challenge', ch], ['code_challenge_method', 'S256'], ['prompt', G_PROMPT]];
      const got = await gCode(w, 'https://accounts.google.com/o/oauth2/v2/auth?' + q.map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&'), state);
      // בלי קוד: בוטל, או ש־Google חסם בתוך החלון (למשל redirect_uri_mismatch, 7/11/2026) — הלחיצה הבאה דרך Firebase, בלי לולאה
      if (!got || !got.code) { gSrvOff = true; return 'cancel'; }
      const j = await sessCall({ op: 'gLogin', code: got.code, redirect, nonce, cv: verifier }, 15000);
      if (!j || !j.ok || j.s !== 1) { gSrvOff = true; return false; }
      sessMark(true); sessTried = true;
      return (await ctSignIn(j.ct)) || (gSrvOff = true, false);
    } catch (e) { gSrvOff = true; return false; } finally { sessBusy = false; }
  }
  /* בלחיצה (בלי await לפני window.open): null = לא דרך השרת → הכניסה של Firebase */
  function gTry() {
    if (!gReady()) { gPrep(); return null; }
    const w = gWin();
    if (!w) return null;
    return gSrvSignIn(w).then((r) => { if (r !== true) { try { w.close(); } catch (e) {} } return r; });
  }
  async function ctSignIn(ct) {
    if (!auth) return false;
    if (!ct) { const j = await sessCall({ op: 'who' }, 4000); ct = j && j.s === 1 && j.ct ? j.ct : ''; }
    if (!ct) return false;
    sessBusy = false;                                        // onAuthStateChanged לא שולח login (טוקן מותאם אינו "כניסה טרייה" — העוגייה כבר נקבעה)
    try { await auth.signInWithCustomToken(ct); sessMark(true); return true; }
    catch (e) { sessCall({ op: 'note', c: String((e && e.code) || 'err').slice(0, 60) }); return false; }
  }
  const lsGet = (k) => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  /* רישום שקט אצלנו — פעם ביום לכל חשבון (כבוי / נרשם → עד מחר; תקלה → בבדיקה הבאה) */
  async function accDaily(u) {
    if (!u || !u.uid || typeof u.getIdToken !== 'function' || !sessBase()) return;
    const k = String(u.uid).slice(0, 8) + '|' + Math.floor(Date.now() / 864e5);
    if (lsGet(LS_ACCREG) === k) return;
    let tk = '';
    try { tk = await u.getIdToken(); } catch (e) { return; }
    const j = await sessCall({ op: 'accReg', idToken: tk }, 6000);
    if (j && (j.ok || j.error === 'off')) lsSet(LS_ACCREG, k);
  }
  /* הסיסמה אצלנו — פעם אחת לכל חשבון במכשיר, מיד אחרי כניסה בסיסמה (השרת דורש כניסה טרייה). לא נשמרת בטלפון */
  async function pwSetOnce(u, pw) {
    if (!u || !u.uid || typeof pw !== 'string' || !pw || !sessBase()) return false;
    const k = String(u.uid).slice(0, 8);
    let done = [];
    try { done = JSON.parse(lsGet(LS_PWSET) || '[]'); if (!Array.isArray(done)) done = []; } catch (e) { done = []; }
    if (done.includes(k)) return false;
    let tk = '';
    try { tk = await u.getIdToken(); } catch (e) { return false; }
    const j = await sessCall({ op: 'pwSet', idToken: tk, password: pw }, 8000);
    if (!j || !j.ok) return false;
    done.push(k); lsSet(LS_PWSET, JSON.stringify(done.slice(-10)));
    return true;
  }
  /* </auth> */

  /* <auth> */
  /* 26/10/2026 (בקשת המשתמש): כניסה גם עם מייל רגיל (סיסמה או קישור במייל), וקישור / מיזוג של כמה שיטות כניסה לאותו
     משתמש. הממשק והלוגיקה ב־acclink.js (נטען רק כשצריך, משותף לשלוש האפליקציות); כאן רק הגישה ל־Firebase ולחיבור המשותף,
     וזיהוי חזרה מקישור הכניסה שנשלח במייל */
  window.SnbAcct = {
    auth: () => auth,
    base: () => sessBase(),
    busy: (on) => { sessBusy = !!on; },
    login: (u) => sessLogin(u),
    flush: () => flushSave(),
    ct: (tk) => ctSignIn(tk),            // שלב 2, גל 2: כניסה מתשובה של השרת שלנו (קוד במייל / סיסמה)
    pwSet: (u, pw) => pwSetOnce(u, pw),
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
  /* </auth> */

  function userDoc() {
    return fs.collection('users').doc(user.uid);
  }
  /* שלב 4 (6/11/2026): קודם השרת שלנו (udGet), ורק כשהוא לא זמין — Firestore. at = מתי נשמר (updatedAt, ms) */
  async function readCloud() {
    const v = await udGet('invest');
    if (v) return { exists: !!v.doc, data: () => v.doc, at: v.at };
    const snap = await userDoc().get();
    const data = snap.exists ? snap.data() : null;
    const upd = data && data.updatedAt && typeof data.updatedAt.toMillis === 'function' ? data.updatedAt.toMillis() : 0;
    return { exists: !!snap.exists, data: () => data, at: upd };
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
    // 27/10/2026: המקור (IBKR/ידני) והצילום הידני שלפני IBKR — של החשבון, לא של המכשיר שבו רץ הסנכרון.
    // בלי זה מכשיר אחר הציג את מניות IBKR כ"ידני" (ובמצב ידני — עם עריכה ואיפוס שלא מתאימים להן)
    if (clean.source === 'ibkr' || clean.source === 'manual') DB.source = clean.source;
    if (clean.ibkrSnapshot && typeof clean.ibkrSnapshot === 'object') DB.ibkrSnapshot = clean.ibkrSnapshot;
    else delete DB.ibkrSnapshot;
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
  const held = () => typeof window !== 'undefined' && !!window.__snbHold;   // מיזוג חשבונות באמצע (acclink.js) — לא דורסים את המסמך הממוזג
  function scheduleSave() {
    if (held() || !user || !fs || localMode || demoOn() || !ready || !ownsLocal()) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flushSave, 2000);
  }

  async function flushSave() {
    if (held() || !user || !fs || localMode || demoOn() || !ready || !ownsLocal()) return;
    clearTimeout(saveTimer);
    try {
      const d = JSON.parse(JSON.stringify(DB));
      // 27/10/2026: שדה שנמחק בטלפון נמחק גם בענן (merge משאיר שדות ישנים בתוך db — צילום ידני ישן היה חוזר)
      const gone = ['ibkrSnapshot', 'source'].filter((k) => !(k in d));
      // שלב 4: דרך השרת שלנו (אותה מסכה, ו־updatedAt נכתב שם); לא זמין — ישירות, ורשומה ביומן
      if (await udPut('invest', { v: 1, db: d }, [['tdkey']].concat(gone.map((k) => ['db', k])))) return;
      for (const k of gone) d[k] = firebase.firestore.FieldValue.delete();
      await userDoc().set({
        v: 1,
        db: d,
        // אבטחה (25/09/2026): מפתח Twelve Data נשאר בטלפון בלבד — ומוחקים עותק ישן מהענן
        tdkey: firebase.firestore.FieldValue.delete(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      await udMark('invest');
    } catch (e) {
      /* נכשל (למשל אין אינטרנט) — נשמר מקומית, ינסה שוב בשמירה הבאה */
    }
  }

  /* 27/10/2026: הדוח של IBKR (דחוס) ברמת החשבון — p = { at, z }, או null למחיקה. ראו ibkrCloudPush ב־app.js */
  async function saveIbkr(p) {
    if (held() || !user || !fs || localMode || demoOn() || !ready || !ownsLocal()) return false;
    try {
      const has = !!(p && p.z);
      if (await udPut('invest', has ? { ibkr: { at: +p.at || 0, z: String(p.z) } } : {}, has ? [] : [['ibkr']])) return true;
      await userDoc().set({ ibkr: has ? { at: +p.at || 0, z: String(p.z) } : firebase.firestore.FieldValue.delete() }, { merge: true });
      await udMark('invest');
      return true;
    } catch (e) { return false; }
  }

  async function resetCloud() {
    clearTimeout(saveTimer);
    if (!user || !fs || localMode || !ownsLocal()) return;
    try { if (!(await udDel('invest'))) { await userDoc().delete(); await udMark('invest', true); } } catch (e) {}
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
        const viaSrv = gTry();                           // שלב 2, גל 2: דרך השרת שלנו (החלון נפתח כאן, בתוך הלחיצה)
        if (viaSrv) {
          const r = await viaSrv;
          if (r === false && err) { err.textContent = t('loginFailed'); err.classList.remove('hidden'); }
          return;
        }
        try {
          sessBusy = true;
          const cred = await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
          sessLogin(cred && cred.user).then(() => { sessBusy = false; });
        } catch (e) {
          sessBusy = false;
          if (err) {
            err.textContent = t('loginFailed');
            err.classList.remove('hidden');
          }
        }
      });
    }
    const mailBtn = document.getElementById('emailLoginBtn');
    if (mailBtn && !mailBtn._wired) {
      mailBtn._wired = true;
      mailBtn.addEventListener('click', () => { import('./acclink.js').then((m) => m.emailSheet()).catch(() => {}); });
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

    if (!sdkOk() && !(isConfigured && !localMode && accProf())) {
      box.appendChild(mk(
        '<p class="fine" style="padding:0">' + t('cloudNotSetup') + '</p>'
      ).firstChild);
      return;
    }

    // v297 (בקשת המשתמש, אחרי תצוגה מקדימה): לפי ת־עיצוב ID — תמונה + שם + מייל, ופעולה כשורת רשימה
    const OUT_IC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 17l5-5-5-5"/><path d="M20 12H9"/><path d="M12 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6"/></svg>';
    const PHONE_IC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M11 18h2"/></svg>';
    const KEY_IC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="15" r="4"/><path d="M10.8 12.2 20 3"/><path d="M17 6l3 3"/><path d="M15 8l2 2"/></svg>';
    const CLOUD_IC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19a4.5 4.5 0 0 0 .5-8.97A6 6 0 0 0 6.2 9.1 4 4 0 0 0 6.5 19z"/></svg>';
    const idRow = (avatarHTML, title, sub) => mk('<div class="acc-id">' + avatarHTML +
      '<div class="acc-txt"><b>' + esc(title) + '</b><span>' + esc(sub) + '</span></div></div>').firstChild;
    const actRow = (cls, icon, label, onClick) => {
      const list = mk('<div class="ios-list"><button type="button" class="ios-row ios-row-btn ' + cls + '">' +
        '<span class="ios-row-ic" aria-hidden="true">' + icon + '</span><span class="ios-row-lbl">' + esc(label) + '</span></button></div>').firstChild;
      list.querySelector('button').addEventListener('click', onClick);
      return list;
    };

    /* 29/10/2026 (סבב קפיצות 4, סרטון Invest — ההגדרות): עד שה־SDK נטען (חצי שנייה אחרי הפתיחה) הכרטיס הציג "חיבור ענן
       לא הוגדר" ואז קפץ לפרטי החשבון. מי שהיה מחובר במכשיר — הפרטים מהפעם הקודמת (LS_ACC_PROF), באותו גודל בדיוק */
    const prof = !user && isConfigured && !localMode && !authSettled ? accProf() : null;
    if (prof) {
      box.appendChild(idRow('<img alt="" src="' + esc(prof.p || 'icon-192.png') + '">', prof.n || t('userLabel'), prof.e || ''));
      box.appendChild(actRow('acc-keys', KEY_IC, t('accMethods'), () => { import('./acclink.js').then((m) => m.methodsSheet()).catch(() => {}); }));
      box.appendChild(actRow('acc-out', OUT_IC, t('signOut'), () => { if (auth) signOut(); }));
      return;
    }

    if (user) {
      try { localStorage.setItem(LS_ACC_PROF, JSON.stringify({ n: user.displayName || '', e: user.email || '', p: user.photoURL || '' })); } catch (e) {}
      const unver = !user.emailVerified && (user.providerData || []).some((p) => p && p.providerId === 'password');   // מייל שעוד לא אומת — בלי הרשאות עד האימות
      const row = idRow('<img alt="" src="' + esc(user.photoURL || 'icon-192.png') + '">', user.displayName || t('userLabel'), (user.email || '') + (unver ? ' · ' + t('accUnverified') : ''));
      const img = row.querySelector('img');
      if (img) img.addEventListener('error', () => { img.src = 'icon-192.png'; }, { once: true });
      box.appendChild(row);
      box.appendChild(actRow('acc-keys', KEY_IC, t('accMethods'), () => { import('./acclink.js').then((m) => m.methodsSheet()).catch(() => {}); }));
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
    sessMark(false);
    sessTried = true;                                        // אחרי "התנתק" — בלי כניסה שקטה (גם אם הבקשה לשרתון נכשלה)
    await sessCall({ op: 'logout' }, 3000);                  // החיבור המשותף: גם שאר האפליקציות במכשיר מתנתקות
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
      if (!ok || !initSdk()) { authSettled = true; renderAccountCard(); fallback(); return; }
      wireLoginUi();
      watchAuth();
      emailLinkLanding();
    });
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => setTimeout(go, 0)); else setTimeout(go, 0);
  }

  /* <auth> */
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
  /* </auth> */

  function watchAuth() {
    const fallback = bootFallback;
    auth.onAuthStateChanged(async (u) => {
      clearTimeout(saveTimer);
      ready = false;
      user = u;
      if (u) authSettled = true;
      // v193: דגל "היה מחובר" — app.js משתמש בו כדי לא לצייר תיק ריק לרגע כשהאחסון המקומי ריק אבל הענן מלא
      try { if (u) localStorage.setItem(LS_CLOUD_USER, '1'); else localStorage.removeItem(LS_CLOUD_USER); } catch (e) {}
      if (!u) {
        if (await sessSignIn()) return;                  // מחובר באפליקציה אחרת — onAuthStateChanged יחזור עם המשתמש
        authSettled = true;                              // לא מחובר באמת — בלי הפרטים מהפעם הקודמת
        try { localStorage.removeItem(LS_ACC_PROF); } catch (e) {}
        if (switchOwner(null, null) === true) return;   // v313: התנתקות — הנתונים של החשבון יוצאים מהמכשיר הפעיל
        if (!localMode) showLogin();
        gPrep();                                         // שלב 2, גל 2: האם הכניסה עם Google דרך השרת שלנו
        renderAccountCard();
        fallback(); // v193: לא מחובר — האפליקציה ממשיכה מקומית (startApp עמיד לקריאה חוזרת)
        return;
      }
      if (sessBusy) sessLogin(u);                        // התחברות עם Google — העוגייה מיד, לפני מעבר הבעלים
      hideLogin();
      renderAccountCard();
      sessCheck(true);
      try {
        const snap = await readCloud();
        const sw = switchOwner(u.uid, !!(snap.exists && validCloudDb((snap.data() || {}).db)));
        if (sw === true) return;                       // v313: הדף נטען מחדש עם הנתונים של החשבון הזה בלבד
        if (sw === 'stuck') { fallback(); return; }    // לא הצלחנו להחליף — לא כותבים לענן בכלל (ready נשאר false)
        ready = true;                                  // הנתונים במכשיר שייכים לחשבון הזה — מותר לשמור
        if (demoOn()) {
          /* מצב דמו: לא דורסים את הדמו בנתוני הענן (הם יחזרו ביציאה מהדמו) */
        } else if (snap.exists && validCloudDb(snap.data().db)) {
          const data = snap.data();
          if (applyCloudDb(data.db)) await flushSave();
          // 27/10/2026: הדוח של IBKR מהחשבון — הורדה / העלאה / מחיקה לפי מה שחדש יותר
          if (typeof window.ibkrCloudLoaded === 'function') {
            window.ibkrCloudLoaded(data.ibkr || null, data.db.source, snap.at);
          }
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
    saveIbkr: saveIbkr,
    isConfigured: function () { return isConfigured; }
  };
  /* ווים ש-app.js קורא להם — נשארים שקטים אם אין ענן */
  window.__cloudSave = scheduleSave;
  window.__cloudFlush = flushSave;
})();
/* 14/10/2026: האתחול של app.js מיד כאן (הסקריפט האחרון בדף) — לא אחרי DOMContentLoaded, כדי שהציור הראשון יהיה הדף המלא */
try { if (typeof window !== 'undefined' && document.readyState !== 'loading' && typeof window.snbInit === 'function') window.snbInit(); } catch (e) {}
