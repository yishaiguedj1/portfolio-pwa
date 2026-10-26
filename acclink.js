/* החשבון — כניסה עם מייל רגיל, שיטות כניסה ומיזוג חשבונות (26/10/2026, בקשת המשתמש: "להתחבר לכל האפליקציות גם
   מחשבון Google וגם מכל מייל, עם אפשרות לקשר בינהם כך שיהיו על אותו משתמש").

   נטען רק כשצריך (import מ־cloud.js / shell.js), משותף ל־Invest, Academy ו־Studio. הכל דרך Firebase Auth:
   - כניסה: מייל + סיסמה, או קישור כניסה במייל (בלי סיסמה). חשבון חדש עם סיסמה מקבל מייל אימות — הרשאות (מרכז הניהול)
     רק למייל מאומת (השרתון בודק email_verified).
   - אותו מייל = אותו משתמש: Firebase מוגדר "חשבון אחד לכל מייל" — כניסה עם Google במייל שכבר נרשם (מאומת) נכנסת לאותו
     חשבון, וקישור כניסה למייל של חשבון Google קיים נכנס אליו.
   - קישור: מחובר בחשבון אחד ומוסיף שיטה (Google / מייל אחר) — linkWith*. השיטה כבר שייכת לחשבון אחר אצלנו → מיזוג:
     נכנסים לחשבון השני באפליקציה צדדית של Firebase (בלי לשמור), השרתון מעביר את כל הנתונים שלו לחשבון הזה
     (/api/session op:'merge', ibkr-proxy/lib/acmerge.js), החשבון השני נמחק, והשיטה מתקשרת לכאן.
   התלויות מ־window.SnbAcct (האזורים <auth> של cloud.js): auth, base (כתובת השרתון כשהוא באותו אתר), busy/login (העוגייה
   של החיבור המשותף), flush. המחרוזות — t() של core.js / app.js; חלונות — askConfirm/flash/modalPush. */

const LS_LINK = 'pwa_elink_v1';          // המייל שאליו נשלח קישור כניסה + למה (s = כניסה, l = קישור לחשבון המחובר)
const LINK_MAX_MS = 6 * 3600e3;          // אחרי זה הקישור כבר פג ממילא
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;

const G_IC = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.7 2.9c2.3-2.1 3.7-5.2 3.7-8.6z"/><path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.7-2.9c-1 .7-2.4 1.2-4.2 1.2-3.2 0-5.9-2.1-6.8-5l-3.9 3C3.3 21.3 7.3 24 12 24z"/><path fill="#FBBC05" d="M5.2 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.7.4-2.4l-3.9-3C.5 8.2 0 10 0 12s.5 3.8 1.3 5.4l3.9-3z"/><path fill="#EA4335" d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9 1.1 15.2 0 12 0 7.3 0 3.3 2.7 1.3 6.6l3.9 3c.9-2.8 3.6-4.9 6.8-4.9z"/></svg>';
const MAIL_IC = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m3.5 6.5 8.5 6 8.5-6"/></svg>';
const A = () => window.SnbAcct || {};
const fb = () => window.firebase;
const auth = () => (A().auth ? A().auth() : null);
function h(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
const lang = () => ((document.documentElement.lang || 'he').slice(0, 2) === 'en' ? 'en' : 'he');
const say = (m) => { if (typeof flash === 'function') flash(m); };
/* כתובת החזרה מהמייל — הדף הנוכחי בלי פרמטרים (שם ממשיכים, finishLink) */
const backUrl = () => location.origin + location.pathname;

/* הודעה לפי קוד השגיאה של Firebase (טהורה — נבדקת) */
export function errKey(code) {
  const c = String(code || '').replace(/^auth\//, '');
  if (['invalid-credential', 'wrong-password', 'user-not-found', 'invalid-login-credentials'].includes(c)) return 'accErrCred';
  if (c === 'email-already-in-use') return 'accErrInUse';
  if (c === 'weak-password') return 'accErrWeak';
  if (c === 'invalid-email' || c === 'missing-email') return 'accErrEmail';
  if (c === 'too-many-requests') return 'accErrMany';
  if (c === 'network-request-failed') return 'accErrNet';
  if (c === 'operation-not-allowed' || c === 'admin-restricted-operation') return 'accErrOff';
  if (c === 'invalid-action-code' || c === 'expired-action-code') return 'accErrLink';
  if (c === 'requires-recent-login') return 'accErrRecent';
  if (c === 'popup-closed-by-user' || c === 'cancelled-popup-request' || c === 'user-cancelled') return '';
  if (c === 'provider-already-linked') return 'accErrLinked';
  return 'accErrGen';
}
function showErr(el, e) {
  const k = errKey(e && e.code);
  if (!k) { el.hidden = true; return; }
  el.textContent = t(k); el.hidden = false;
}

/* ---------------------------------------------------------------- הגיליון */
let open = null;
function sheet(title) {
  if (open) open.close();
  const veil = h('div', 'acx-veil');
  const box = h('div', 'acx-sheet');
  box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', title);
  box.append(h('div', 'sheet-grab'), h('h3', null, title));
  const body = h('div', 'acx-body');
  box.append(body);
  veil.append(box);
  let rec = null;
  const close = () => {
    if (!veil.isConnected) return;
    veil.remove();
    if (open && open.veil === veil) open = null;
    if (rec && typeof modalDone === 'function') { const r = rec; rec = null; modalDone(r); }
  };
  veil.addEventListener('click', (ev) => { if (ev.target === veil) close(); });
  document.body.append(veil);
  if (typeof modalPush === 'function') rec = modalPush(close);
  open = { veil, body, close };
  return open;
}
function input(type, ph, ac) {
  const i = h('input', 'acx-in'); i.type = type; i.placeholder = ph; i.setAttribute('aria-label', ph);
  i.autocomplete = ac; i.dir = 'ltr'; i.spellcheck = false;
  return i;
}
function btn(cls, label, on) { const b = h('button', cls, label); b.type = 'button'; b.addEventListener('click', on); return b; }
async function busy(b, fn) {
  if (b.disabled) return;
  b.disabled = true;
  try { await fn(); } finally { b.disabled = false; }
}

/* ---------------------------------------------------------------- כניסה עם מייל (מסך הכניסה) */
export function emailSheet(prefill) {
  const au = auth();
  if (!au) { say(t('accErrNet')); return; }
  au.languageCode = lang();
  let mode = 'in';                                   // in = כניסה, up = חשבון חדש
  const s = sheet(t('emailSignIn'));
  const em = input('email', t('accEmail'), 'username');
  em.inputMode = 'email';
  if (prefill) em.value = prefill;
  const pw = input('password', t('accPassword'), 'current-password');
  const err = h('p', 'acx-err'); err.hidden = true; err.setAttribute('role', 'alert');
  const go = btn('btn acx-go', t('accSignIn'), () => busy(go, submit));
  const swap = btn('link-btn acx-link', t('accNoAccount'), () => {
    mode = mode === 'in' ? 'up' : 'in';
    go.textContent = t(mode === 'in' ? 'accSignIn' : 'accCreate');
    swap.textContent = t(mode === 'in' ? 'accNoAccount' : 'accHaveAccount');
    pw.autocomplete = mode === 'in' ? 'current-password' : 'new-password';
    err.hidden = true;
  });
  const linkB = btn('link-btn acx-link', t('accSendLink'), () => busy(linkB, () => sendLink(em, err, 's')));
  const forgot = btn('link-btn acx-link', t('accForgot'), () => busy(forgot, async () => {
    const e = em.value.trim().toLowerCase();
    if (!EMAIL_RE.test(e)) { err.textContent = t('accErrEmail'); err.hidden = false; em.focus(); return; }
    try { await au.sendPasswordResetEmail(e, { url: backUrl() }); err.hidden = true; say(t('accResetSent')); } catch (x) { showErr(err, x); }
  }));
  async function submit() {
    const e = em.value.trim().toLowerCase();
    if (!EMAIL_RE.test(e)) { err.textContent = t('accErrEmail'); err.hidden = false; em.focus(); return; }
    if (pw.value.length < 6) { err.textContent = t('accErrWeak'); err.hidden = false; pw.focus(); return; }
    err.hidden = true;
    A().busy && A().busy(true);
    try {
      const cred = mode === 'in' ? await au.signInWithEmailAndPassword(e, pw.value) : await au.createUserWithEmailAndPassword(e, pw.value);
      if (mode === 'up' && cred && cred.user && !cred.user.emailVerified) {
        try { await cred.user.sendEmailVerification({ url: backUrl() }); say(t('accVerifySent')); } catch (x) {}
      }
      if (A().login) await A().login(cred && cred.user);   // העוגייה של החיבור המשותף — כמו בכניסה עם Google
      s.close();
      const ov = document.getElementById('loginOverlay');
      if (ov && ov.classList.contains('sa')) ov.remove();
    } catch (x) {
      showErr(err, x);
      if (String(x && x.code).endsWith('email-already-in-use')) err.textContent = t('accErrInUseIn');
    } finally { A().busy && A().busy(false); }
  }
  pw.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') go.click(); });
  em.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') pw.focus(); });
  const links = h('div', 'acx-links'); links.append(swap, linkB, forgot);
  s.body.append(em, pw, err, go, links);
  setTimeout(() => (prefill ? pw : em).focus(), 60);
}

/* קישור כניסה במייל: s = כניסה, l = הוספה לחשבון המחובר */
async function sendLink(em, err, why) {
  const au = auth();
  const e = em.value.trim().toLowerCase();
  if (!EMAIL_RE.test(e)) { err.textContent = t('accErrEmail'); err.hidden = false; em.focus(); return false; }
  try {
    au.languageCode = lang();
    await au.sendSignInLinkToEmail(e, { url: backUrl(), handleCodeInApp: true });
    try { localStorage.setItem(LS_LINK, JSON.stringify({ e, w: why, at: Date.now() })); } catch (x) {}
    err.hidden = true;
    if (typeof askAlert === 'function') askAlert(t('accLinkSent', { e })); else say(t('accLinkSent', { e }));
    return true;
  } catch (x) { showErr(err, x); return false; }
}

/* ---------------------------------------------------------------- חזרה מהקישור שבמייל */
function cleanUrl() {
  try { history.replaceState(history.state, '', location.pathname + location.hash); } catch (e) {}
}
function firstUser(au) {
  return new Promise((res) => { const off = au.onAuthStateChanged((u) => { off(); res(u); }); });
}
export async function finishLink(typed) {
  const au = auth();
  if (!au || !au.isSignInWithEmailLink(location.href)) return;
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(LS_LINK) || 'null'); } catch (e) {}
  if (saved && !(Date.now() - (+saved.at || 0) < LINK_MAX_MS)) saved = null;
  const e = String(typed || (saved && saved.e) || '').trim().toLowerCase();
  if (!EMAIL_RE.test(e)) { askEmailForLink(); return; }           // נפתח במכשיר אחר — שואלים לאיזה מייל נשלח
  const href = location.href;
  cleanUrl();                                   // לפני הכניסה: מעבר בעלים טוען את הדף מחדש, והקוד בכתובת כבר שומש
  const cur = au.currentUser || await firstUser(au);
  try {
    if (cur && saved && saved.w === 'l' && saved.e === e) {
      try { await cur.linkWithCredential(fb().auth.EmailAuthProvider.credentialWithLink(e, href)); say(t('accLinked')); }
      catch (x) {
        if (/credential-already-in-use|email-already-in-use/.test(String(x && x.code))) await mergeWith({ link: { e, href } }, e);
        else throw x;
      }
    } else {
      A().busy && A().busy(true);
      const cred = await au.signInWithEmailLink(e, href);
      if (A().login) await A().login(cred && cred.user);
    }
    try { localStorage.removeItem(LS_LINK); } catch (x) {}
  } catch (x) {
    const k = errKey(x && x.code);
    if (k && typeof askAlert === 'function') askAlert(t(k));
  } finally { A().busy && A().busy(false); }
}
function askEmailForLink() {
  const s = sheet(t('accLinkWhich'));
  const em = input('email', t('accEmail'), 'username'); em.inputMode = 'email';
  const err = h('p', 'acx-err'); err.hidden = true;
  const go = btn('btn acx-go', t('accContinue'), () => busy(go, async () => {
    const e = em.value.trim().toLowerCase();
    if (!EMAIL_RE.test(e)) { err.textContent = t('accErrEmail'); err.hidden = false; return; }
    s.close(); await finishLink(e);
  }));
  em.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') go.click(); });
  s.body.append(h('p', 'acx-note', t('accLinkWhichSub')), em, err, go);
  setTimeout(() => em.focus(), 60);
}

/* ---------------------------------------------------------------- שיטות הכניסה (מכרטיס החשבון) */
/* מה מחובר לחשבון (טהורה — נבדקת): google = מייל ה־Google, mail = המייל של הכניסה עם מייל, verified */
export function methodsOf(u) {
  const pd = (u && u.providerData) || [];
  const g = pd.find((p) => p && p.providerId === 'google.com');
  const m = pd.find((p) => p && p.providerId === 'password');
  return { google: g ? String(g.email || '') : null, mail: m ? String(m.email || (u && u.email) || '') : null,
    email: String((u && u.email) || ''), verified: !!(u && u.emailVerified), n: pd.length };
}
function row(label, sub, action) {
  const r = h('div', 'ios-row acx-row');
  const tx = h('span', 'acx-rtx'); tx.append(h('b', null, label));
  if (sub) { const sm = h('small'); sm.append(h('bdi', null, sub)); tx.append(sm); }
  r.append(tx);
  if (action) r.append(action);
  return r;
}
export function methodsSheet() {
  const au = auth();
  const u = au && au.currentUser;
  if (!u) { say(t('accErrNet')); return; }
  au.languageCode = lang();
  const s = sheet(t('accMethods'));
  const M = methodsOf(u);
  const list = h('div', 'ios-list');
  const unlinkBtn = (pid, name) => (M.n > 1 ? btn('mini-btn danger', t('accRemove'), () => {
    askConfirm(t('accRemoveQ', { m: name }), async () => {
      try { await u.unlink(pid); say(t('accRemoved')); methodsSheet(); } catch (x) { if (typeof askAlert === 'function') askAlert(t(errKey(x && x.code) || 'accErrGen')); }
    }, { danger: true, ok: t('accRemove') });
  }) : null);
  if (M.google != null) list.append(row('Google', M.google, unlinkBtn('google.com', 'Google')));
  if (M.mail != null) list.append(row(t('accMailPw'), M.mail + (M.verified ? '' : ' · ' + t('accUnverified')), unlinkBtn('password', t('accMailPw'))));
  s.body.append(list);
  if (!M.verified && M.email) {
    const vb = btn('link-btn acx-link', t('accVerifyNow'), () => busy(vb, async () => {
      try { await u.sendEmailVerification({ url: backUrl() }); say(t('accVerifySent')); } catch (x) { if (typeof askAlert === 'function') askAlert(t(errKey(x && x.code) || 'accErrGen')); }
    }));
    s.body.append(vb);
  }
  const add = h('div', 'acx-add');
  const withIc = (b, svg) => { const l = h('span', null, b.textContent); b.textContent = ''; b.insertAdjacentHTML('afterbegin', svg); b.append(l); return b; };
  if (M.google == null) add.append(withIc(btn('google-btn acx-g', t('accAddGoogle'), () => linkGoogle(u)), G_IC));
  if (M.mail == null) add.append(withIc(btn('google-btn acx-g mail-btn', t('accAddMail'), () => addMailSheet(u)), MAIL_IC));
  else if (M.mail) {
    const rp = btn('link-btn acx-link', t('accChangePw'), () => busy(rp, async () => {
      try { await au.sendPasswordResetEmail(M.mail, { url: backUrl() }); say(t('accResetSent')); } catch (x) { if (typeof askAlert === 'function') askAlert(t(errKey(x && x.code) || 'accErrGen')); }
    }));
    add.append(rp);
  }
  s.body.append(add, h('p', 'acx-note', t('accMethodsFoot')));
}

/* Google — חלון של Google, חייב להיפתח בתוך הלחיצה (בלי await לפני) */
function linkGoogle(u) {
  const p = new (fb().auth.GoogleAuthProvider)();
  p.setCustomParameters({ prompt: 'select_account' });
  u.linkWithPopup(p).then(() => { say(t('accLinked')); methodsSheet(); }).catch(async (x) => {
    const code = String(x && x.code);
    if (/credential-already-in-use|email-already-in-use|account-exists-with-different-credential/.test(code) && x.credential) {
      await mergeWith({ cred: x.credential }, (x.customData && x.customData.email) || x.email || 'Google');
      return;
    }
    const k = errKey(code);
    if (k && typeof askAlert === 'function') askAlert(t(k));
  });
}
function addMailSheet(u) {
  const au = auth();
  const s = sheet(t('accAddMail'));
  const em = input('email', t('accEmail'), 'username'); em.inputMode = 'email';
  const pw = input('password', t('accNewPassword'), 'new-password');
  const err = h('p', 'acx-err'); err.hidden = true; err.setAttribute('role', 'alert');
  const go = btn('btn acx-go', t('accAddMailGo'), () => busy(go, async () => {
    const e = em.value.trim().toLowerCase();
    if (!EMAIL_RE.test(e)) { err.textContent = t('accErrEmail'); err.hidden = false; return; }
    if (pw.value.length < 6) { err.textContent = t('accErrWeak'); err.hidden = false; return; }
    const cred = fb().auth.EmailAuthProvider.credential(e, pw.value);
    try {
      await u.linkWithCredential(cred);
      if (!u.emailVerified) { try { await u.sendEmailVerification({ url: backUrl() }); } catch (x) {} }
      say(t('accLinked')); s.close(); methodsSheet();
    } catch (x) {
      if (/credential-already-in-use|email-already-in-use/.test(String(x && x.code))) { s.close(); await mergeWith({ cred }, e); return; }
      showErr(err, x);
    }
  }));
  const lb = btn('link-btn acx-link', t('accSendLinkAdd'), () => busy(lb, async () => { if (await sendLink(em, err, 'l')) s.close(); }));
  s.body.append(em, pw, err, go, lb, h('p', 'acx-note', t('accAddMailFoot')));
  setTimeout(() => em.focus(), 60);
}

/* ---------------------------------------------------------------- מיזוג */
/* who = מה מנסים להוסיף: { cred } (Google / מייל+סיסמה) או { link: {e, href} } (קישור כניסה — חד־פעמי, לכן אחרי המיזוג
   שולחים קישור חדש לקשר אותו). label — מה מוצג למשתמש */
async function mergeWith(who, label) {
  const au = auth();
  const me = au && au.currentUser;
  const base = A().base ? A().base() : '';
  if (!me) return;
  if (!base) { if (typeof askAlert === 'function') askAlert(t('accMergeNoSrv')); return; }
  const ok = typeof askConfirmP === 'function' ? await askConfirmP(t('accMergeQ', { m: label }), { danger: true, ok: t('accMergeGo') }) : false;
  if (!ok) return;
  const F = fb();
  let side = null;
  try {
    side = F.initializeApp(F.app().options, 'snbMerge' + Date.now().toString(36));
    const sa = side.auth();
    await sa.setPersistence(F.auth.Auth.Persistence.NONE);
    const r = who.link ? await sa.signInWithEmailLink(who.link.e, who.link.href) : await sa.signInWithCredential(who.cred);
    const other = r && r.user;
    if (!other) throw Object.assign(new Error('x'), { code: 'x' });
    if (other.uid === me.uid) { say(t('accLinked')); return; }
    say(t('accMerging'));
    if (A().flush) await A().flush();                  // מה שעוד לא נשמר מהחשבון הזה — קודם
    window.__snbHold = true;                            // מכאן ועד הטעינה מחדש — לא כותבים את המסמך הישן מעל הממוזג
    const [ta, tb] = await Promise.all([me.getIdToken(true), other.getIdToken(true)]);
    const res = await fetch(base + '/api/session', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'merge', idToken: ta, idTokenB: tb }) });
    const j = await res.json().catch(() => ({}));
    if (res.status !== 200 || !j.ok) {
      window.__snbHold = false;
      if (typeof askAlert === 'function') askAlert(t(j.error === 'busy' ? 'accMergeBusy' : 'accMergeFail'));
      return;
    }
    await other.delete();                               // החשבון השני ב־Firebase (התחברות טרייה — מותר)
    if (who.cred) await me.linkWithCredential(who.cred).catch(() => null);
    else if (who.link) {
      try { localStorage.setItem(LS_LINK, JSON.stringify({ e: who.link.e, w: 'l', at: Date.now() })); } catch (x) {}
      await au.sendSignInLinkToEmail(who.link.e, { url: backUrl(), handleCodeInApp: true }).catch(() => null);
    }
    const done = () => location.reload();               // הנתונים הממוזגים נטענים מהענן
    if (typeof askAlert === 'function') askAlert(t(who.link ? 'accMergedLink' : 'accMerged'), done); else done();
  } catch (x) {
    window.__snbHold = false;
    const k = errKey(x && x.code);
    if (k && typeof askAlert === 'function') askAlert(t(k === 'accErrGen' ? 'accMergeFail' : k));
  } finally {
    if (side) { try { await side.auth().signOut(); } catch (e) {} try { await side.delete(); } catch (e) {} }
  }
}
