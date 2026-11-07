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
  let authCb = null, signOuts = 0, cur = opt.user || (uid ? { uid } : null), loginBtn = null;
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
  Object.assign(sb, opt.ext || {});
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

  /* ---------- 12. שלב 2, גל 2 (7/11/2026): כניסה עם Google דרך השרת שלנו, רישום יומי, סיסמה ---------- */
  const { webcrypto } = require('crypto');
  const gEnv = () => {
    const chans = [], wins = [];
    const ext = {
      crypto: webcrypto, TextEncoder, btoa: (x) => Buffer.from(x, 'binary').toString('base64'), setInterval, clearInterval,
      BroadcastChannel: function () { this.onmessage = null; this.close = () => {}; chans.push(this); },
      open: () => { const w = { closed: false, href: '', close() { this.closed = true; }, location: {} };
        Object.defineProperty(w.location, 'href', { set(v) { w.href = v; }, get() { return w.href; } }); wins.push(w); return w; },
      addEventListener() {}, removeEventListener() {},
    };
    const post = (m) => chans.forEach((c) => c.onmessage && c.onmessage({ data: m }));
    return { ext, chans, wins, post };
  };
  const fix = (sb) => { sb.document.baseURI = 'https://invest-staging.thesnowball.app/'; sb.document.removeEventListener = () => {}; };
  const gSrv = (over) => { let ck = false; return (b) => {   // ck = העוגייה שהשרת קבע
    if (over && over[b.op]) { const v = over[b.op](b); if (b.op === 'gLogin' && v && v.s === 1) ck = true; return v; }
    if (b.op === 'gCfg') return { ok: true, on: true, cid: '123-abc.apps.googleusercontent.com' };
    if (b.op === 'gLogin') { ck = true; return { ok: true, s: 1, u: 'u-CT7', ct: 'CT7' }; }
    if (b.op === 'who' && ck) return { ok: true, s: 1, u: 'u-CT7', ct: 'CT7' };
    return { ok: true, s: 0 };
  }; };
  let E = gEnv();
  r = await run('invest-staging.thesnowball.app', gSrv(), null, null, { ext: E.ext });
  fix(r.sb);
  ok(r.calls.some((c) => c.body.op === 'gCfg'), 'לא מחובר — שואל מראש אם הכניסה עם Google דרך השרת (gCfg)');
  let p = r.loginBtn()._click();
  ok(E.wins.length === 1, 'הלחיצה פותחת את החלון מיד (לפני כל await — אחרת הדפדפן חוסם)');
  await tick(30);
  const au = new URL(E.wins[0].href), qs = au.searchParams;
  ok(au.origin === 'https://accounts.google.com' && qs.get('client_id') === '123-abc.apps.googleusercontent.com' && qs.get('scope') === 'openid email profile'
    && qs.get('redirect_uri') === 'https://invest-staging.thesnowball.app/oauth.html' && qs.get('code_challenge_method') === 'S256' && qs.get('response_type') === 'code',
    'החלון: הלקוח מ־gCfg, ‏openid email profile, ‏PKCE ‏S256, וחזרה ל־oauth.html');
  ok(/^li[\w-]{24}$/.test(qs.get('state')) && /^[\w-]{32}$/.test(qs.get('nonce')) && /^[\w-]{43}$/.test(qs.get('code_challenge')), 'state ‏(li…), ‏nonce ו־challenge אקראיים');
  E.post({ state: 'li-not-ours', code: 'EVIL' });
  await tick(20);
  ok(!r.calls.some((c) => c.body.op === 'gLogin'), 'קוד עם state אחר — מתעלמים');
  E.post({ state: qs.get('state'), code: 'C0DE' });
  await p; await tick(30);
  const gl = r.calls.find((c) => c.body.op === 'gLogin');
  const ch = Buffer.from(webcrypto.getRandomValues ? require('crypto').createHash('sha256').update(gl.body.cv).digest() : '').toString('base64url');
  ok(gl && gl.body.code === 'C0DE' && gl.body.nonce === qs.get('nonce') && gl.body.redirect === qs.get('redirect_uri') && ch === qs.get('code_challenge') && gl.init.credentials === 'include',
    'gLogin: הקוד, אותו nonce, והמאמת שמתאים ל־challenge');
  ok(r.customs[0] === 'CT7' && r.ls.getItem('pwa_sess_v1') === '1' && !r.calls.some((c) => c.body.op === 'login'), 'נכנס עם הטוקן המותאם, החיבור המשותף מסומן, בלי login מיותר');
  ok(!JSON.stringify(r.ls._m && [...r.ls._m]).includes(gl.body.cv), 'המאמת (PKCE) לא נשמר במכשיר');

  /* בלי ct — who */
  let w8 = false;
  E = gEnv();
  r = await run('invest-staging.thesnowball.app', gSrv({ gLogin: () => { w8 = true; return { ok: true, s: 1, u: 'u-W8', ct: '' }; }, who: () => (w8 ? { ok: true, s: 1, u: 'u-W8', ct: 'W8' } : { ok: true, s: 0 }) }), null, null, { ext: E.ext });
  fix(r.sb);
  p = r.loginBtn()._click(); await tick(30);
  E.post({ state: new URL(E.wins[0].href).searchParams.get('state'), code: 'C' }); await p; await tick(30);
  ok(r.customs.includes('W8'), 'gLogin בלי ct — who, ואז הטוקן המותאם');

  /* השרת נכשל אחרי שהחלון נפתח → הודעה, והלחיצה הבאה — Firebase */
  E = gEnv();
  r = await run('invest-staging.thesnowball.app', gSrv({ gLogin: () => null }), null, null, { ext: E.ext });
  fix(r.sb);
  const errEl = { textContent: '', classList: { add() {}, remove() { errEl.shown = true; } } };
  const ge = r.sb.document.getElementById; r.sb.document.getElementById = (id) => (id === 'loginErr' ? errEl : ge(id));
  p = r.loginBtn()._click(); await tick(30);
  E.post({ state: new URL(E.wins[0].href).searchParams.get('state'), code: 'C' }); await p; await tick(20);
  ok(errEl.shown && errEl.textContent === 'loginFailed' && r.customs.length === 0 && E.wins[0].closed, 'gLogin נכשל — "ההתחברות נכשלה", בלי פרטים, והחלון נסגר');
  await r.loginBtn()._click(); await tick(30);
  ok(E.wins.length === 1 && r.calls.some((c) => c.body.op === 'login'), 'הלחיצה הבאה — הכניסה של Firebase (כמו היום)');

  /* חזרה בלי קוד (בוטל / Google חסם בחלון, למשל redirect_uri_mismatch) → בלי הודעה, והלחיצה הבאה — Firebase (בלי לולאה) */
  E = gEnv();
  r = await run('invest-staging.thesnowball.app', gSrv(), null, null, { ext: E.ext });
  fix(r.sb);
  p = r.loginBtn()._click(); await tick(30);
  E.post({ state: new URL(E.wins[0].href).searchParams.get('state'), code: '', error: 'access_denied' }); await p; await tick(20);
  ok(!r.calls.some((c) => c.body.op === 'gLogin') && r.customs.length === 0, 'חזרה בלי קוד — בלי gLogin');
  await r.loginBtn()._click(); await tick(30);
  ok(E.wins.length === 1 && r.calls.some((c) => c.body.op === 'login'), 'אחרי חזרה בלי קוד — הלחיצה הבאה דרך Firebase (בלי לולאה)');

  /* כבוי בשרת → Firebase, בלי חלון שלנו */
  E = gEnv();
  r = await run('invest-staging.thesnowball.app', gSrv({ gCfg: () => ({ ok: true, on: false, cid: '' }) }), null, null, { ext: E.ext });
  fix(r.sb);
  await r.loginBtn()._click(); await tick(30);
  ok(E.wins.length === 0 && r.calls.some((c) => c.body.op === 'login'), 'gCfg כבוי — הכניסה של Firebase, בלי החלון שלנו');
  E = gEnv();
  r = await run('invest-staging.thesnowball.app', gSrv({ gCfg: () => ({ ok: true, on: true, cid: 'https://evil.example/x' }) }), null, null, { ext: E.ext });
  fix(r.sb);
  await r.loginBtn()._click(); await tick(30);
  ok(E.wins.length === 0, 'מזהה לקוח לא תקין — לא פותחים חלון');

  /* accReg פעם ביום לכל חשבון; כבוי — גם עד מחר; תקלה — ננסה שוב */
  const fresh = () => ({ uid: 'U1abcdefgh', getIdToken: async () => 'FB-TOK' });
  ls = mkStore();
  const regSrv = (ans) => (b) => (b.op === 'who' ? { ok: true, s: 1, u: 'U1abcdefgh', ct: 'X' } : b.op === 'accReg' ? ans() : { ok: true });
  r = await run('invest-staging.thesnowball.app', regSrv(() => ({ ok: true })), null, ls, { user: fresh() });
  const reg = (x) => x.calls.filter((c) => c.body.op === 'accReg');
  ok(reg(r).length === 1 && reg(r)[0].body.idToken === 'FB-TOK' && /^U1abcdef\|\d+$/.test(ls.getItem('pwa_accreg_v1')), 'accReg אחרי כניסה של Firebase, עם הטוקן');
  r = await run('invest-staging.thesnowball.app', regSrv(() => ({ ok: true })), null, ls, { user: fresh() });
  ok(reg(r).length === 0, 'באותו יום — בלי accReg נוסף');
  ls = mkStore();
  r = await run('invest-staging.thesnowball.app', regSrv(() => null), null, ls, { user: fresh() });
  ok(reg(r).length === 1 && !ls.getItem('pwa_accreg_v1'), 'תקלה בשרת — לא מסומן (ננסה בבדיקה הבאה)');
  r = await run('invest-staging.thesnowball.app', regSrv(() => ({ ok: false, error: 'off' })), null, ls, { user: fresh() });
  ok(reg(r).length === 1 && ls.getItem('pwa_accreg_v1'), 'כבוי (ייצור) — מסומן עד מחר, בלי בקשות חוזרות');
  r = await run('yishaiguedj1.github.io', regSrv(() => ({ ok: true })), null, mkStore(), { user: fresh() });
  ok(reg(r).length === 0, 'github.io — בלי accReg');

  /* pwSet פעם אחת, והסיסמה לא נשמרת */
  ls = mkStore();
  let pwAns = () => ({ ok: false, error: 'off' });
  r = await run('invest-staging.thesnowball.app', (b) => (b.op === 'pwSet' ? pwAns() : { ok: true, s: 0 }), null, ls);
  const pws = () => r.calls.filter((c) => c.body.op === 'pwSet');
  ok((await r.sb.SnbAcct.pwSet(fresh(), 'Secret-pw-1')) === false && pws().length === 1 && !ls.getItem('pwa_pwset_v1'), 'pwSet כבוי — לא מסומן (כשיידלק — בכניסה הבאה)');
  pwAns = () => ({ ok: true });
  ok((await r.sb.SnbAcct.pwSet(fresh(), 'Secret-pw-1')) === true && pws()[1].body.password === 'Secret-pw-1' && pws()[1].body.idToken === 'FB-TOK', 'pwSet: הטוקן הטרי והסיסמה');
  ok((await r.sb.SnbAcct.pwSet(fresh(), 'Secret-pw-1')) === false && pws().length === 2, 'פעם אחת לכל חשבון במכשיר');
  ok(![...ls._m.values()].some((v) => v.includes('Secret-pw-1')), 'הסיסמה לא נשמרת במכשיר');

  /* ct ישיר (קוד במייל / סיסמה דרך השרת) */
  r = await run('invest-staging.thesnowball.app', (b) => (b.op === 'who' && r && r.go ? { ok: true, s: 1, u: 'M1', ct: 'WM' } : { ok: true, s: 0 }), null);
  ok((await r.sb.SnbAcct.ct('CTM')) === true && r.customs.includes('CTM') && r.ls.getItem('pwa_sess_v1') === '1', 'SnbAcct.ct: נכנס עם הטוקן ומסמן');
  r.go = true;
  ok((await r.sb.SnbAcct.ct('')) === true && r.customs.includes('WM'), 'בלי ct — who');

  /* שלב 2, גל 3 (7/11/2026): מקור אחד לאסימון — snbIdToken: שלנו כשיש, אחרת getIdToken */
  const AH = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6InNuYi1hdC8xIn0';
  ok(AH === require(path.join(root, 'ibkr-proxy', 'lib', 'snbat.js')).HEAD, 'הכותרת בטלפון זהה לזו של השרת (snbat.HEAD)');
  const OUR = AH + '.eyJzdWIiOiJVMSJ9.c2ln', OUR2 = AH + '.eyJzdWIiOiJVMiJ9.c2lnMg';
  const fbU = () => ({ uid: 'U1abcdefgh', getIdToken: async (f) => (f ? 'FB-FORCED' : 'FB-TOK') });
  let atAns = () => ({ ok: true, s: 1, u: 'U1abcdefgh', app: 'invest', at: OUR2, atx: Math.floor(Date.now() / 1000) + 900 });
  const atSrv = (b) => (b.op === 'who' ? { ok: true, s: 1, u: 'U1abcdefgh', ct: 'X', at: OUR, atx: Math.floor(Date.now() / 1000) + 900 } : b.op === 'at' ? atAns() : { ok: true });
  ls = mkStore(); ls.setItem('pwa_sess_v1', '1');
  r = await run('invest-staging.thesnowball.app', atSrv, null, ls, { user: fbU() });
  ok(typeof r.sb.snbIdToken === 'function' && (await r.sb.snbIdToken(fbU())) === OUR && !!ls.getItem('pwa_aton_v1'), 'who עם at → snbIdToken מחזיר את האסימון שלנו, בלי בקשה נוספת');
  ok(![...ls._m.values()].some((v) => v.includes(AH)), 'האסימון לא נשמר ב־localStorage (רק בזיכרון)');
  ok((await r.sb.snbIdToken({ uid: 'OTHERuid', getIdToken: async () => 'FB-OTHER' })) === 'FB-OTHER', 'משתמש אחר ב־Firebase — getIdToken שלו');
  ok((await r.sb.snbIdToken(fbU(), true)) === 'FB-FORCED', 'force — ישר ל־Firebase');
  ls = mkStore(); ls.setItem('pwa_sess_v1', '1');
  r = await run('invest-staging.thesnowball.app', (b) => (b.op === 'who' ? { ok: true, s: 1, u: 'U1abcdefgh', ct: 'X', at: OUR, atx: Math.floor(Date.now() / 1000) + 60 } : b.op === 'at' ? atAns() : { ok: true }), null, ls, { user: fbU() });
  ok((await r.sb.snbIdToken(fbU())) === OUR2 && r.calls.filter((c) => c.body.op === 'at').length === 1, 'קרוב לתפוגה → חידוש אחד (op:at) מהעוגייה');
  // 401 לבקשה עם האסימון שלנו (Vercel / כבוי) → אותה בקשה עם Firebase. המעטפת (atFetch) נבדקת לבד, מעל fetch מדומה
  const wrapSrc = cloudSrc.slice(cloudSrc.indexOf('function atFetch'), cloudSrc.indexOf('if (typeof window !== \'undefined\') { window.snbIdToken'));
  ok(wrapSrc.length > 100, 'atFetch נמצא ב־cloud.js');
  ls = mkStore(); ls.setItem('pwa_sess_v1', '1');
  const calls2 = [];
  let reject = true;
  const srv2 = (b) => { if (b.op === 'probe') { calls2.push(b.idToken); if (reject && b.idToken.indexOf(AH) === 0) return '401'; return { ok: true }; } return atSrv(b); };
  r = await run('invest-staging.thesnowball.app', srv2, null, ls, { user: fbU() });
  r.auth.currentUser = fbU();
  // ה־fetch המדומה של ה־harness מחזיר 500 על null; כאן — fetch משלנו מתחת למעטפת
  const under = async (url, init) => { const b = JSON.parse(init.body); const a = srv2(b); return a === '401' ? { status: 401, json: async () => ({}) } : { status: 200, json: async () => a }; };
  const ctx2 = { window: null, firebase: { auth: () => r.auth }, localStorage: ls, fetch: under, Date, JSON, Object, Promise };
  ctx2.window = ctx2;
  vm.createContext(ctx2);
  vm.runInContext('const AT_HEAD = ' + JSON.stringify(AH) + '; const AT_RE = /' + AH + '\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+/g; const AT_OFF_MS = 1; let atOffUntil = 0; function atClear() { this.cleared = (this.cleared || 0) + 1; }\n' + wrapSrc + '\natFetch(window);', ctx2);
  const resp = await ctx2.fetch('https://api-staging.thesnowball.app/api/udata', { method: 'POST', body: JSON.stringify({ op: 'probe', idToken: OUR }) });
  ok(resp.status === 200 && calls2.length === 2 && calls2[0] === OUR && calls2[1] === 'FB-TOK', '401 עם האסימון שלנו (Vercel דוחה) → אותה בקשה שוב עם getIdToken');
  reject = false; calls2.length = 0;
  await ctx2.fetch('https://x/api/udata', { method: 'POST', body: JSON.stringify({ op: 'probe', idToken: 'FB-TOK' }) });
  ok(calls2.length === 1, 'בקשה עם טוקן של Firebase — בלי עטיפה');
  // כבוי: at עונה off → getIdToken, וסימון ההפעלה נמחק
  atAns = () => ({ ok: false, error: 'off' });
  ls = mkStore(); ls.setItem('pwa_sess_v1', '1'); ls.setItem('pwa_aton_v1', String(Date.now()));
  r = await run('invest-staging.thesnowball.app', (b) => (b.op === 'who' ? { ok: true, s: 1, u: 'U1abcdefgh', ct: 'X' } : b.op === 'at' ? atAns() : { ok: true }), null, ls, { user: fbU() });
  ok((await r.sb.snbIdToken(fbU())) === 'FB-TOK' && !ls.getItem('pwa_aton_v1'), 'כבוי (at → off) — getIdToken, והסימון נמחק');
  const atN = r.calls.filter((c) => c.body.op === 'at').length;
  await r.sb.snbIdToken(fbU());
  ok(r.calls.filter((c) => c.body.op === 'at').length === atN, 'אחרי off — בלי בקשות at נוספות');
  // בלי הדגל מעולם: אף בקשת at (ההתנהגות כמו היום)
  ls = mkStore(); ls.setItem('pwa_sess_v1', '1');
  r = await run('invest-staging.thesnowball.app', (b) => (b.op === 'who' ? { ok: true, s: 1, u: 'U1abcdefgh', ct: 'X' } : { ok: true }), null, ls, { user: fbU() });
  ok((await r.sb.snbIdToken(fbU())) === 'FB-TOK' && r.calls.every((c) => c.body.op !== 'at'), 'בלי הדגל — getIdToken ואף בקשת at');
  // github.io — תמיד Firebase
  r = await run('yishaiguedj1.github.io', atSrv, null, mkStore(), { user: fbU() });
  ok((await r.sb.snbIdToken(fbU())) === 'FB-TOK', 'github.io — getIdToken');
  // התנתקות מוחקת את האסימון
  ls = mkStore(); ls.setItem('pwa_sess_v1', '1');
  r = await run('invest-staging.thesnowball.app', atSrv, null, ls, { user: fbU() });
  ok((await r.sb.snbIdToken(fbU())) === OUR, 'יש אסימון שלנו');
  await r.sb.Cloud.signOut();
  ls.removeItem('pwa_aton_v1');
  ok((await r.sb.snbIdToken(fbU())) === 'FB-TOK', 'אחרי התנתקות — לא נשאר אסימון שלנו');
  // pwSet שוב אחרי איפוס: accReg עונה pw:0
  ls = mkStore(); ls.setItem('pwa_pwset_v1', JSON.stringify(['U1abcdef']));
  r = await run('invest-staging.thesnowball.app', (b) => (b.op === 'who' ? { ok: true, s: 1, u: 'U1abcdefgh', ct: 'X' } : b.op === 'accReg' ? { ok: true, pw: 0 } : { ok: true }), null, ls, { user: fbU() });
  await tick(30);
  ok(JSON.parse(ls.getItem('pwa_pwset_v1')).length === 0, 'accReg pw:0 (איפוס) → הסימון של pwSet נמחק, ישלח שוב בכניסה הבאה בסיסמה');
  ls.setItem('pwa_pwset_v1', JSON.stringify(['U1abcdef']));
  r.sb.SnbAcct.pwForget('');
  ok(!ls.getItem('pwa_pwset_v1'), 'בקשת איפוס מהמכשיר → כל הסימונים נמחקים');

  console.log('# ' + n + ' בדיקות עברו');
  process.exit(0);                                      // טיימרים של cloud.js (ה־SDK המדומה) — לא מחכים להם
})().catch((e) => { console.error('FAIL -', e); process.exit(1); });
