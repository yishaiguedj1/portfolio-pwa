// שלב 3ב בתוכנית שלוש האפליקציות (13/10/2026): auth.js — החיבור הרזה של הדפים העצמאיים (Academy, Studio).
// רץ בלי app.js ובלי cloud.js: core.js + auth.js. Firebase מדומה, שרתון מדומה.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const SRC = read('strings-academy.js') + '\n' + read('core.js') + '\n' + read('auth.js');
const mkStore = (init) => { const m = new Map(Object.entries(init || {})); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m }; };
const tick = (ms) => new Promise((r) => setTimeout(r, ms || 15));

/* host: האתר; server(body) → /api/session; uid: מחובר ב־Firebase בפתיחה; doc: יש מסמך בענן */
function run(host, server, uid, opts) {
  const o = opts || {};
  const ls = o.ls || mkStore();
  const calls = [], customs = [], states = [];
  let authCb = null, signOuts = 0, reloads = 0, cur = uid ? { uid } : null;
  const auth = {
    onAuthStateChanged: (cb) => { authCb = cb; setTimeout(() => cb(cur), 1); },
    signOut: async () => { signOuts++; cur = null; setTimeout(() => authCb(null), 1); },
    signInWithCustomToken: async (tk) => { customs.push(tk); cur = { uid: 'u-' + tk }; setTimeout(() => authCb(cur), 1); },
    signInWithPopup: async () => { cur = { uid: 'g1', getIdToken: async () => 'ID-TOKEN' }; setTimeout(() => authCb(cur), 1); return { user: cur }; },
  };
  const firestore = () => ({ collection: () => ({ doc: () => ({ get: async () => ({ exists: !!o.doc, data: () => (o.doc ? { db: {} } : null) }) }) }) });
  const sb = {
    localStorage: ls, sessionStorage: mkStore(), console, setTimeout, clearTimeout, URL, JSON, Promise,
    location: { hostname: host, reload() { reloads++; } },
    navigator: { languages: ['he'] },
    SNB_ENV: { proxy: /staging/.test(host) ? 'https://api-staging.thesnowball.app' : 'https://ibkr-proxy-wine.vercel.app' },
    fetch: async (url, init) => { const body = JSON.parse(init.body); calls.push({ url, init, body }); const j = await server(body); return { status: j ? 200 : 500, json: async () => j }; },
    document: { hidden: false, addEventListener() {}, documentElement: { dataset: {} } },
    FIREBASE_CONFIG: o.noCfg ? {} : { apiKey: 'k', authDomain: 'd', projectId: 'p' },
    firebase: { apps: [], initializeApp() { this.apps.push(1); }, auth: Object.assign(() => auth, { GoogleAuthProvider: function () {} }), firestore },
  };
  sb.window = sb;
  vm.createContext(sb);
  vm.runInContext(SRC, sb);
  sb.SnbAuth.onChange((st) => states.push(st));
  sb.SnbAuth.start();
  return tick(60).then(() => ({ sb, calls, customs, states, ls, get signOuts() { return signOuts; }, get reloads() { return reloads; } }));
}

(async () => {
  ok(!/function accountSwitchTo/.test(read('cloud.js')) && /function switchOwner/.test(read('auth.js')) && /function accountSwitchTo/.test(read('core.js')),
    'auth.js = האזורים <auth> של cloud.js; accountSwitchTo מגיע מ־core.js (מקור אחד — app.js)');

  let r = await run('yishaiguedj1.github.io', () => ({ ok: true, s: 1, ct: 'T' }), null);
  ok(r.calls.length === 0 && r.states[r.states.length - 1] === 'out', 'github.io: בלי חיבור משותף — "לא מחובר", בלי פנייה');

  r = await run('staging.thesnowball.app', (b) => (b.op === 'who' ? { ok: true, s: 1, u: 'u-T1', ct: 'T1' } : { ok: true }), null, { ls: mkStore({ pwa_owner_v1: 'u-T1' }) });
  ok(r.customs[0] === 'T1' && r.states[r.states.length - 1] === 'in', 'מחובר באפליקציה אחרת → כניסה שקטה כאן ("מחובר פעם אחת — מחובר בכולן")');

  r = await run('staging.thesnowball.app', () => ({ ok: true, s: 0 }), null);
  ok(r.customs.length === 0 && r.states[r.states.length - 1] === 'out', 'אין חיבור באף מקום → "לא מחובר"');

  /* v313: חשבון אחר מהבעלים במכשיר → הנתונים עוברים למחסן והדף נטען מחדש */
  const ls = mkStore({ pwa_owner_v1: 'alice', pwa_libcoll_v1: '{"secret":1}' });
  r = await run('staging.thesnowball.app', () => ({ ok: true, s: 1, u: 'bob', ct: 'X' }), 'bob', { ls, doc: true });
  ok(r.reloads === 1 && ls.getItem('pwa_owner_v1') === 'bob' && ls.getItem('pwa_libcoll_v1') === null && /secret/.test(ls.getItem('pwa_stash_v1:alice')),
    'חשבון אחר במכשיר — הנתונים של הקודם למחסן שלו, טעינה מחדש (הפרדת חשבונות v313)');

  r = await run('staging.thesnowball.app', () => ({ ok: true, s: 1, u: 'bob', ct: 'X' }), 'bob', { ls: mkStore({ pwa_owner_v1: 'bob' }) });
  ok(r.reloads === 0 && r.states[r.states.length - 1] === 'in' && r.sb.SnbAuth.user().uid === 'bob', 'אותו בעלים — "מחובר", בלי טעינה מחדש');

  /* כניסה עם Google → עוגייה; התנתקות → גם העוגייה, ובלי כניסה שקטה אחריה */
  let cookie = false;
  r = await run('staging.thesnowball.app', (b) => {
    if (b.op === 'login') { cookie = true; return { ok: true }; }
    if (b.op === 'logout') { cookie = false; return { ok: true }; }
    return cookie ? { ok: true, s: 1, u: 'g1', ct: 'G' } : { ok: true, s: 0 };
  }, null, { ls: mkStore({ pwa_owner_v1: 'g1' }) });
  ok(await r.sb.SnbAuth.signIn() === true, 'signIn מחזיר true');
  await tick(30);
  ok(r.calls.some((c) => c.body.op === 'login' && c.body.idToken === 'ID-TOKEN') && r.ls.getItem('pwa_sess_v1') === '1', 'כניסה עם Google → העוגייה המשותפת נוצרת');
  await r.sb.SnbAuth.signOut();
  await tick(30);
  ok(r.calls.some((c) => c.body.op === 'logout') && r.signOuts === 1 && r.customs.length === 0 && r.ls.getItem('pwa_sess_v1') === null,
    'התנתקות → מוחקת את העוגייה (כל האפליקציות) ובלי כניסה שקטה אחריה');

  r = await run('staging.thesnowball.app', () => ({ ok: true }), null, { noCfg: true });
  ok(r.states.join() === 'off' && r.calls.length === 0, 'בלי הגדרת Firebase — "off" (הדף מציג הודעה, לא נתקע)');
  console.log('# ' + n + ' בדיקות עברו');
  process.exit(0);
})().catch((e) => { console.error('FAIL -', e); process.exit(1); });
