// v313: הפרדת חשבונות במכשיר אחד — באג פרטיות: אחרי התנתקות והתחברות לחשבון Google אחר, אחזקות ונתוני IBKR
// של החשבון הקודם נכנסו לחשבון החדש. בודק את מנגנון הבעלים/המחסן ואת cloud.js עם Firebase מדומה (התרחיש המדויק).
const fs = require('fs');
const path = require('path');
const vm = require('vm');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const cloudSrc = fs.readFileSync(path.join(root, 'cloud.js'), 'utf8');

// הפונקציות האמיתיות מ־app.js (בלי להריץ את כל האפליקציה)
const block = app.slice(app.indexOf("const LS_OWNER = 'pwa_owner_v1'"), app.indexOf('const DB = loadDB();'));
const mkStore = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m }; };
const A = new Function(block + '\nreturn { accountOwner, accountSwitchTo, ACCOUNT_KEYS };')();

/* ---------- 1. מנגנון הבעלים (טהור) ---------- */
{
  const ls = mkStore();
  ok(A.accountSwitchTo('uidA', false, ls) === false && ls.getItem('pwa_owner_v1') === 'uidA', 'מכשיר חדש בלי נתונים — הבעלים נקבע, בלי טעינה מחדש');
  ls.setItem('pwa_db_v1', '{"positions":["AAA"]}'); ls.setItem('pwa_ibkr_v1', '{"token":"tokA"}');
  ok(A.accountSwitchTo('uidA', true, ls) === false, 'אותו חשבון — כלום לא משתנה');
  ok(A.accountSwitchTo(null, null, ls) === true && ls.getItem('pwa_db_v1') === null && ls.getItem('pwa_ibkr_v1') === null && ls.getItem('pwa_owner_v1') === 'local',
    'התנתקות — התיק ונתוני IBKR (כולל ה־token) יוצאים מהמקום הפעיל');
  ok(A.accountSwitchTo('uidB', false, ls) === true && ls.getItem('pwa_db_v1') === null && ls.getItem('pwa_ibkr_v1') === null && ls.getItem('pwa_owner_v1') === 'uidB',
    'חשבון חדש אחרי ההתנתקות — מתחיל נקי (הבאג מהדיווח)');
  ls.setItem('pwa_db_v1', '{"positions":["BBB"]}');
  A.accountSwitchTo(null, null, ls); A.accountSwitchTo('uidA', true, ls);
  ok(ls.getItem('pwa_db_v1') === '{"positions":["AAA"]}' && ls.getItem('pwa_ibkr_v1') === '{"token":"tokA"}', 'חזרה לחשבון הראשון — הנתונים שלו חוזרים בדיוק (בלי סנכרון IBKR מחדש)');
  A.accountSwitchTo('uidB', true, ls);
  ok(ls.getItem('pwa_db_v1') === '{"positions":["BBB"]}' && ls.getItem('pwa_ibkr_v1') === null, 'וחזרה לשני — רק הנתונים שלו, בלי ה־token של הראשון');
  const stashes = [...ls._m.keys()].filter((k) => k.startsWith('pwa_stash_v1:'));
  ok(stashes.length === 1 && stashes[0] === 'pwa_stash_v1:uidA', 'מחסן לכל חשבון — רק של מי שלא מחובר עכשיו');
}
{
  // מכשיר ותיק (לפני v313): נתונים בלי בעלים
  const ls = mkStore(); ls.setItem('pwa_db_v1', '{"positions":["OLD"]}'); ls.setItem('pwa_ibkr_v1', '{"token":"tokOld"}');
  ok(A.accountSwitchTo('uidNew', false, ls) === true && ls.getItem('pwa_db_v1') === null && ls.getItem('pwa_ibkr_v1') === null && ls.getItem('pwa_stash_v1:legacy'),
    'מכשיר ותיק + חשבון חדש (בלי מסמך בענן) — לא מקבל את הנתונים הישנים');
  const ls2 = mkStore(); ls2.setItem('pwa_db_v1', '{"positions":["OLD"]}');
  ok(A.accountSwitchTo('uidOld', true, ls2) === false && ls2.getItem('pwa_db_v1') && ls2.getItem('pwa_legacy_owner_v1') === 'uidOld', 'מכשיר ותיק + חשבון קיים בענן — ממשיך כרגיל (אותו אדם)');
  const ls3 = mkStore(); ls3.setItem('pwa_ibkr_v1', '{"token":"t"}');
  ok(A.accountSwitchTo('uidX', null, ls3) === true && ls3.getItem('pwa_ibkr_v1') === null, 'מכשיר ותיק בלי רשת (לא ידוע אם יש מסמך) — זהירות: לא מאמצים');
  ok(A.ACCOUNT_KEYS.includes('pwa_db_v1') && A.ACCOUNT_KEYS.includes('pwa_ibkr_v1') && A.ACCOUNT_KEYS.includes('pwa_predemo_v1'), 'מפתחות החשבון כוללים תיק, IBKR וגיבוי הדמו');
}

/* ---------- 2. cloud.js מול Firebase מדומה — התרחיש מהדיווח ---------- */
function runCloud(ls, ss, uid, docs, opts = {}) {
  let authCb = null, reloads = 0, booted = 0;
  const writes = [];
  const fakeDoc = (u) => ({
    get: () => new Promise((res) => setTimeout(() => res({ exists: !!docs[u], data: () => docs[u] }), opts.getDelay || 30)),
    set: async (d) => { writes.push({ uid: u, d }); docs[u] = { v: 1, db: d.db }; },
    delete: async () => { delete docs[u]; },
  });
  const firestore = () => ({ collection: () => ({ doc: fakeDoc }) });
  firestore.FieldValue = { delete: () => null, serverTimestamp: () => null };
  const DB = JSON.parse(ls.getItem('pwa_db_v1') || '{"positions":[],"deposits":[]}');
  const sb = {
    localStorage: ls, sessionStorage: ss, console, setTimeout, clearTimeout,
    location: { reload: () => { reloads++; } },
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ addEventListener() {}, setAttribute() {}, appendChild() {}, classList: { add() {}, remove() {} }, style: {} }), head: { appendChild() {} }, addEventListener() {} },
    FIREBASE_CONFIG: { apiKey: 'k', authDomain: 'd', projectId: 'p' },
    firebase: { apps: [], initializeApp() { this.apps.push(1); }, auth: () => ({ onAuthStateChanged: (cb) => { authCb = cb; }, signOut: async () => {} }), firestore },
    DB, t: (k) => k, num: (x) => +x || 0, isDemoMode: () => false, setBanner() {},
    validCloudDbX: null, stripLegacyDemo: () => false, ensurePensionKinds() {},
    saveDBto: (d) => ls.setItem('pwa_db_v1', JSON.stringify(d)),
    demoDb: () => ({ positions: [], deposits: [] }),
    applyDbData: (d) => { DB.positions = (d.positions || []).slice(); DB.deposits = []; ls.setItem('pwa_db_v1', JSON.stringify(DB)); },
    accountOwner: (s) => A.accountOwner(s || ls), accountSwitchTo: (u, h) => A.accountSwitchTo(u, h, ls),
  };
  sb.window = sb;
  vm.createContext(sb);
  vm.runInContext(cloudSrc, sb);
  sb.Cloud.boot(() => { booted++; });
  return new Promise((resolve) => setTimeout(async () => {
    authCb(uid ? { uid } : null);
    if (opts.duringLoad) { await new Promise((r) => setTimeout(r, 5)); sb.Cloud.scheduleSave(); await sb.Cloud.flushSave(); }
    setTimeout(() => resolve({ writes, reloads, booted, DB, Cloud: sb.Cloud }), (opts.getDelay || 30) + 40);
  }, 20));
}

(async () => {
  const ls = mkStore(), ss = mkStore(), docs = {};
  // חשבון א׳ עם אחזקות ו־IBKR
  docs.uidA = { v: 1, db: { v: 1, positions: [{ sym: 'AAA' }], deposits: [] } };
  ls.setItem('pwa_db_v1', JSON.stringify({ positions: [{ sym: 'AAA' }], deposits: [] }));
  ls.setItem('pwa_ibkr_v1', JSON.stringify({ token: 'tokA', queryId: '999999' }));
  ls.setItem('pwa_owner_v1', 'uidA');

  // מתנתק מא׳
  let r = await runCloud(ls, ss, null, docs);
  ok(r.reloads === 1 && ls.getItem('pwa_db_v1') === null && ls.getItem('pwa_ibkr_v1') === null, 'cloud: התנתקות → הנתונים של א׳ יוצאים מהמכשיר הפעיל והדף נטען מחדש');
  ss.removeItem('pwa_owner_rl');

  // מתחבר לחשבון ב׳ חדש — ומישהו מנסה לשמור בזמן הטעינה (המרוץ)
  ls.setItem('pwa_db_v1', JSON.stringify({ positions: [{ sym: 'AAA' }], deposits: [] }));   // כמו לפני התיקון: התיק נשאר בטלפון גם אחרי ההתנתקות
  r = await runCloud(ls, ss, 'uidB', docs, { duringLoad: true, getDelay: 60 });
  ok(r.writes.length === 0, 'cloud: שמירה שהתחילה בזמן הטעינה של חשבון חדש — לא נכתבת (לא דולף לענן שלו)');
  ok(r.reloads === 1 && ls.getItem('pwa_owner_v1') === 'uidB' && ls.getItem('pwa_db_v1') === null, 'cloud: חשבון אחר → החלפת בעלים + טעינה מחדש לפני כל שימוש בנתונים');
  ls.removeItem('pwa_stash_v1:local');
  ss.removeItem('pwa_owner_rl');

  // אחרי הטעינה מחדש — ב׳ מתחיל נקי, והענן שלו נקי
  r = await runCloud(ls, ss, 'uidB', docs);
  ok(r.reloads === 0 && r.writes.length === 1 && r.writes[0].uid === 'uidB' && r.writes[0].d.db.positions.length === 0, 'cloud: חשבון ב׳ החדש נשמר ריק — בלי אחזקות של א׳ (הבאג מהדיווח)');
  ok(!JSON.stringify(docs.uidB).includes('AAA') && !JSON.stringify(docs.uidB).includes('tokA'), 'cloud: במסמך של ב׳ אין שום דבר מא׳');

  // חזרה לא׳ — הנתונים שלו כאן
  await runCloud(ls, ss, null, docs); ss.removeItem('pwa_owner_rl');
  r = await runCloud(ls, ss, 'uidA', docs); ss.removeItem('pwa_owner_rl');
  ok(ls.getItem('pwa_owner_v1') === 'uidA' && JSON.parse(ls.getItem('pwa_ibkr_v1')).token === 'tokA', 'cloud: חזרה לא׳ — נתוני IBKR שלו חוזרים (לא צריך לחבר מחדש)');

  // שמירה אחרי טעינה מלאה — עובדת כרגיל
  r = await runCloud(ls, ss, 'uidA', docs);
  r.DB.positions.push({ sym: 'NEW' }); await r.Cloud.flushSave();
  ok(r.writes.some((w) => w.uid === 'uidA' && JSON.stringify(w.d.db).includes('NEW')), 'cloud: אחרי הטעינה — שמירה לענן של אותו חשבון עובדת');

  // הגנה מלולאה: אם ההחלפה לא נשמרת — לא נטען מחדש שוב ושוב, ולא כותבים לענן
  const broken = mkStore(); broken.setItem('pwa_owner_v1', 'uidA'); broken.setItem('pwa_db_v1', '{"positions":[{"sym":"AAA"}],"deposits":[]}');
  const ss2 = mkStore(); ss2.setItem('pwa_owner_rl', String(Date.now()));
  const origSet = broken.setItem; broken.setItem = (k, v) => { if (k === 'pwa_owner_v1') return; origSet(k, v); };
  r = await runCloud(broken, ss2, 'uidB', {});
  ok(r.reloads === 0 && r.writes.length === 0, 'cloud: החלפה שנכשלת — בלי לולאת טעינה ובלי כתיבה לענן');

  /* ---------- 3. השרתון: לא נשלח token של חשבון אחר ---------- */
  ok(/if \(u && accountOwner\(\) !== u\.uid\) return '';/.test(app), 'סנכרון ברקע: לא נרשם בשרתון בשם חשבון שהנתונים במכשיר לא שלו');
  console.log('# ' + n + ' בדיקות עברו');
})().catch((e) => { console.error('FAIL -', e); process.exit(1); });
