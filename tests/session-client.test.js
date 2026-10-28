// החיבור המשותף בצד האפליקציה (cloud.js, שלב 2 בתוכנית שלוש האפליקציות, 13/10/2026):
// כניסה שקטה כשמחובר באפליקציה אחרת, התנתקות שמתפשטת, ובלי שום שינוי ב־github.io (העוגייה לא נשלחת שם).
const fs = require('fs');
const path = require('path');
const vm = require('vm');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const cloudSrc = fs.readFileSync(path.join(root, 'cloud.js'), 'utf8');
const mkStore = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m }; };
const tick = (ms) => new Promise((r) => setTimeout(r, ms || 15));

/* host: הכתובת של האתר; server(body) → תשובת /api/session; uid: מי מחובר ב־Firebase בפתיחה */
function run(host, server, uid, ls, opt) {
  opt = opt || {};
  const reloads = [];
  ls = ls || mkStore();
  const calls = [], customs = [], listeners = {};
  let authCb = null, signOuts = 0, cur = uid ? { uid } : null, loginBtn = null;
  const auth = {
    onAuthStateChanged: (cb) => { authCb = cb; },
    signOut: async () => { signOuts++; cur = null; setTimeout(() => authCb(null), 1); },
    signInWithCustomToken: async (tk) => { customs.push(tk); cur = { uid: 'u-' + tk }; setTimeout(() => authCb(cur), 1); },
    signInWithPopup: async () => { cur = { uid: 'g1', getIdToken: async () => 'ID-TOKEN' }; setTimeout(() => authCb(cur), 1); return { user: cur }; },
  };
  const firestore = () => ({ collection: () => ({ doc: () => ({ get: async () => ({ exists: false, data: () => null }), set: async () => {}, delete: async () => {} }) }) });
  firestore.FieldValue = { delete: () => null, serverTimestamp: () => null };
  const el = (id) => {
    if (id === 'googleLoginBtn') return loginBtn || (loginBtn = { addEventListener: (ev, f) => { loginBtn._click = f; } });
    return null;
  };
  const sb = {
    localStorage: ls, sessionStorage: mkStore(), console, setTimeout, clearTimeout, URL, JSON,
    location: { hostname: host, reload() { reloads.push(opt.at ? opt.at() : 1); } },
    SNB_ENV: { proxy: /staging/.test(host) ? 'https://api-staging.thesnowball.app' : /thesnowball/.test(host) ? 'https://api.thesnowball.app' : 'https://ibkr-proxy-wine.vercel.app' },
    fetch: async (url, init) => { const body = JSON.parse(init.body); calls.push({ url, init, body }); const j = await server(body); return { status: j ? 200 : 500, json: async () => j }; },
    document: { hidden: false, getElementById: el, querySelector: () => null, querySelectorAll: () => [],
      createElement: () => ({ addEventListener() {}, setAttribute() {}, appendChild() {}, classList: { add() {}, remove() {} }, style: {} }),
      head: { appendChild() {} }, addEventListener: (ev, f) => { listeners[ev] = f; } },
    FIREBASE_CONFIG: { apiKey: 'k', authDomain: 'd', projectId: 'p' },
    firebase: { apps: [], initializeApp() { this.apps.push(1); }, auth: Object.assign(() => auth, { GoogleAuthProvider: function () {} }), firestore },
    DB: { positions: [], deposits: [] }, t: (k) => k, num: (x) => +x || 0, isDemoMode: () => false, setBanner() {},
    stripLegacyDemo: () => false, ensurePensionKinds() {}, saveDBto() {}, demoDb: () => ({ positions: [], deposits: [] }), applyDbData() {},
    accountOwner: () => 'x', accountSwitchTo: (u) => !!(opt.switchTo && u),
  };
  sb.window = sb;
  vm.createContext(sb);
  vm.runInContext(cloudSrc, sb);
  sb.Cloud.boot(() => {});
  return new Promise((resolve) => setTimeout(async () => {
    authCb(cur);
    await tick(40);
    resolve({ reloads, calls, customs, get signOuts() { return signOuts; }, ls, sb, listeners, auth, get cur() { return cur; }, loginBtn: () => loginBtn });
  }, 20));
}

(async () => {
  /* 1. github.io — שום דבר לא משתנה */
  let r = await run('yishaiguedj1.github.io', () => ({ ok: true, s: 1, u: 'zz', ct: 'T' }), null);
  ok(r.calls.length === 0 && r.customs.length === 0, 'github.io: אין פנייה לחיבור המשותף (העוגייה לא נשלחת שם)');
  r = await run('thesnowball.pages.dev', () => ({ ok: true, s: 1, ct: 'T' }), null);
  ok(r.calls.length === 0, 'תצוגה מקדימה ב־pages.dev (אתר אחר) — אין פנייה');

  /* 2. לא מחובר כאן, מחובר באפליקציה אחרת → כניסה שקטה */
  r = await run('staging.thesnowball.app', (b) => (b.op === 'who' ? { ok: true, s: 1, u: 'u-T1', ct: 'T1' } : { ok: true }), null);
  const c0 = r.calls[0];
  ok(c0 && c0.url === 'https://api-staging.thesnowball.app/api/session' && c0.init.credentials === 'include' && c0.body.op === 'who',
    'שואל את השרתון של הסביבה "מי מחובר?" עם העוגייה');
  ok(r.customs[0] === 'T1' && r.ls.getItem('pwa_sess_v1') === '1', 'נכנס בשקט עם הטוקן המותאם ומסמן שהחיבור משותף');

  /* 3. אין חיבור באף מקום → מסך ההתחברות הרגיל, בלי לולאה */
  r = await run('staging.thesnowball.app', () => ({ ok: true, s: 0 }), null);
  ok(r.customs.length === 0 && r.calls.filter((c) => c.body.op === 'who').length === 1, 'אין חיבור — שאלה אחת בלבד, בלי כניסה');

  /* 4. מחובר כאן (חיבור משותף), והתנתק באפליקציה אחרת → מתנתק גם כאן */
  let ls = mkStore(); ls.setItem('pwa_sess_v1', '1');
  r = await run('staging.thesnowball.app', () => ({ ok: true, s: 0 }), 'u1', ls);
  ok(r.signOuts === 1 && r.ls.getItem('pwa_sess_v1') === null, 'התנתק באפליקציה אחרת → מתנתק גם כאן');

  /* 5. חיבור ישן (לפני החיבור המשותף, בלי סימון) — לא מנותק */
  r = await run('staging.thesnowball.app', () => ({ ok: true, s: 0 }), 'u1');
  ok(r.signOuts === 0, 'חיבור ישן בלי עוגייה — לא מנותק (רק התחברות חדשה יוצרת אותה)');

  /* 6. תקלה בשרתון — לא מנתקים */
  ls = mkStore(); ls.setItem('pwa_sess_v1', '1');
  r = await run('staging.thesnowball.app', () => null, 'u1', ls);
  ok(r.signOuts === 0 && r.ls.getItem('pwa_sess_v1') === '1', 'השרתון לא זמין — לא מנתקים');

  /* 7. אותו משתמש — מסמן ולא נוגע */
  r = await run('staging.thesnowball.app', () => ({ ok: true, s: 1, u: 'u1', ct: 'X' }), 'u1');
  ok(r.signOuts === 0 && r.customs.length === 0 && r.ls.getItem('pwa_sess_v1') === '1', 'אותו חשבון בעוגייה — בלי כניסה מחדש, רק סימון');

  /* 8. חשבון אחר בעוגייה (החליף באפליקציה אחרת) → עובר אליו */
  r = await run('staging.thesnowball.app', () => ({ ok: true, s: 1, u: 'u9', ct: 'T9' }), 'u1');
  ok(r.customs[0] === 'T9', 'בעוגייה חשבון אחר → עובר אליו (תואם ל־Google)');

  /* 9. התחברות עם Google → העוגייה נוצרת */
  let cookie = false;                                   // שרתון מדומה עם עוגייה: אחרי login — מחובר
  r = await run('staging.thesnowball.app', (b) => {
    if (b.op === 'login') { cookie = true; return { ok: true }; }
    return cookie ? { ok: true, s: 1, u: 'g1', ct: 'G' } : { ok: true, s: 0 };
  }, null);
  await r.loginBtn()._click();
  await tick(30);
  const lg = r.calls.find((c) => c.body.op === 'login');
  ok(lg && lg.body.idToken === 'ID-TOKEN' && lg.init.credentials === 'include' && r.ls.getItem('pwa_sess_v1') === '1', 'התחברות עם Google → נשלח האסימון הטרי והעוגייה נוצרת');
  ok(r.signOuts === 0 && r.customs.length === 0, 'אחרי ההתחברות — לא מנותק ולא נכנס שוב');

  /* 9ב. המרוץ: בדיקה שרצה בזמן ההתחברות (לפני שהעוגייה נוצרה) לא מנתקת */
  let made = false;                                     // יצירת העוגייה איטית — הבדיקה של onAuthStateChanged מגיעה באמצע
  r = await run('staging.thesnowball.app', (b) => (b.op === 'login'
    ? new Promise((res) => setTimeout(() => { made = true; res({ ok: true }); }, 60))
    : (made ? { ok: true, s: 1, u: 'g1', ct: 'G' } : { ok: true, s: 0 })), null);
  r.sb.localStorage.setItem('pwa_sess_v1', '1');       // סימון מהתחברות קודמת במכשיר
  await r.loginBtn()._click();
  await tick(120);
  ok(r.signOuts === 0, 'בדיקה במקביל להתחברות (העוגייה עוד לא קיימת) — לא מנתקת');

  /* 9ג. התחברות אחרי "התנתק" = בעלים חדש → טעינה מחדש. עד 14/10/2026 היא קטעה את בקשת העוגייה (Academy/Studio לא
     התחברו לבד); עכשיו הבקשה יוצאת כבר ב־onAuthStateChanged, והטעינה מחכה לה */
  let done = false;
  r = await run('thesnowball.app', (b) => (b.op === 'login'
    ? new Promise((res) => setTimeout(() => { done = true; res({ ok: true }); }, 80))
    : { ok: true, s: 0 }), null, null, { switchTo: true, at: () => done });
  r.loginBtn()._click();
  await tick(40);
  ok(r.calls.filter((c) => c.body.op === 'login').length === 1 && r.reloads.length === 0, 'בעלים חדש — בקשת העוגייה יצאה אחת, והטעינה מחכה לה');
  await tick(120);
  ok(r.reloads[0] === true && r.ls.getItem('pwa_sess_v1') === '1', 'הטעינה מחדש רק אחרי שהעוגייה נשמרה');

  /* 10. התנתקות → גם העוגייה */
  ls = mkStore(); ls.setItem('pwa_sess_v1', '1');
  r = await run('staging.thesnowball.app', (b) => (b.op === 'who' ? { ok: true, s: 1, u: 'u1', ct: 'X' } : { ok: true }), 'u1', ls);
  await r.sb.Cloud.signOut();
  ok(r.calls.some((c) => c.body.op === 'logout' && c.init.credentials === 'include') && r.signOuts === 1 && r.ls.getItem('pwa_sess_v1') === null,
    'התנתקות → מוחקת את העוגייה (כל האפליקציות במכשיר) ומתנתקת');

  ok(!r.calls.some((c, i) => c.body.op === 'who' && i > r.calls.findIndex((x) => x.body.op === 'logout')) && r.customs.length === 0,
    'אחרי "התנתק" — בלי כניסה שקטה (גם אם העוגייה לא נמחקה)');

  /* 11. חזרה לאפליקציה — בדיקה לכל היותר כל 5 דקות */
  r = await run('staging.thesnowball.app', () => ({ ok: true, s: 1, u: 'u1', ct: 'X' }), 'u1');
  const before = r.calls.length;
  r.listeners.visibilitychange && r.listeners.visibilitychange();
  await tick(20);
  ok(r.calls.length === before, 'חזרה לאפליקציה מיד אחרי בדיקה — בלי בקשה נוספת (פעם ב־5 דקות)');

  console.log('# ' + n + ' בדיקות עברו');
  process.exit(0);                                      // טיימרים של cloud.js (ה־SDK המדומה) — לא מחכים להם
})().catch((e) => { console.error('FAIL -', e); process.exit(1); });
