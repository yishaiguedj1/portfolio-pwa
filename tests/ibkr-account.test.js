// ibkr-account.test.js — 27/10/2026: IBKR ברמת החשבון (בקשת המשתמש). הבאג: בדפדפן שלנו (מכשיר בלי סנכרון IBKR)
// המניות מהענן הוצגו "ידני" ולא IBKR, כי המקור (DB.source) והדוח (cfg.data) היו רק במכשיר שבו רץ הסנכרון,
// והגיבוי ב־Drive לא כלל את IBKR. כאן: המקור והצילום עוברים בענן, הדוח עולה/יורד דחוס, והגיבוי זהה למה שגובה.
// נתונים סינתטיים בלבד.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const cloudSrc = fs.readFileSync(path.join(root, 'cloud.js'), 'utf8');

const mkStore = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m }; };
const ls = mkStore();
const sb = {
  localStorage: ls,
  document: { addEventListener() {}, getElementById: () => null, querySelectorAll: () => [], querySelector: () => null,
    createElement: () => ({ classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {} }) },
  window: {}, navigator: {}, location: {},
  AbortController, fetch: () => Promise.reject(new Error('no net')), setTimeout, clearTimeout, console,
  Blob, Response, CompressionStream, DecompressionStream, btoa, atob, TextEncoder, TextDecoder,
};
vm.createContext(sb);
vm.runInContext(app, sb);
const A = (k) => vm.runInContext(k, sb);
const plan = A('ibkrCloudPlan');

(async () => {
  /* ---------- 1. ההחלטה מול הענן (טהורה) ---------- */
  ok(plan({ at: 0, has: false }, { at: 500, z: 'x' }, 'ibkr', 600) === 'down', 'מכשיר בלי IBKR (הדפדפן שלנו) + דוח בחשבון → מורידים');
  ok(plan({ at: 400, has: true }, { at: 500, z: 'x' }, 'ibkr', 600) === 'down', 'בענן דוח חדש יותר ממה שבמכשיר → מורידים');
  ok(plan({ at: 500, has: true }, { at: 500, z: 'x' }, 'ibkr', 600) === '', 'אותו דוח → כלום');
  ok(plan({ at: 700, has: true }, { at: 500, z: 'x' }, 'ibkr', 600) === 'up', 'במכשיר דוח חדש יותר → מעלים');
  ok(plan({ at: 300, has: true }, null, 'ibkr', 600) === 'up', 'מעבר: המכשיר המחובר (Chrome) — הדוח עוד לא בענן → מעלים');
  ok(plan({ at: 300, has: true }, null, 'manual', 600) === 'drop', 'החשבון נותק/אופס במכשיר אחר אחרי הסנכרון כאן → מוחקים את הדוח המקומי');
  ok(plan({ at: 900, has: true }, null, 'manual', 600) === 'up', 'סנכרון כאן אחרי השמירה האחרונה בענן (מרוץ) — לא מוחקים, מעלים');
  ok(plan({ at: 0, has: false }, { at: 500, z: 'x' }, 'manual', 600) === '', 'בענן מצב ידני — לא מורידים דוח ישן');
  ok(plan({ at: 0, has: false }, null, undefined, 0) === '', 'חשבון בלי IBKR — כלום');

  /* ---------- 2. דחיסה ופתיחה ---------- */
  const rep = { meta: { fromDate: '2024-01-02', toDate: '2026-10-26' }, positions: [{ symbol: 'AAA', qty: 3, costBasis: 30, currency: 'USD', asset: 'STK' }],
    trades: Array.from({ length: 400 }, (_, i) => ({ date: '2025-01-' + String(1 + (i % 28)).padStart(2, '0'), symbol: 'AAA', quantity: 1, price: 10 + i })), navPeriods: [] };
  const z = await A('ibkrPack')(rep);
  ok(typeof z === 'string' && z.length > 0 && z.length < JSON.stringify(rep).length, 'הדוח נדחס (קטן מה־JSON)');
  ok(JSON.stringify(await A('ibkrUnpack')(z)) === JSON.stringify(rep), 'פתיחה מחזירה בדיוק את הדוח');
  ok(await A('ibkrUnpack')('לא-תקין') === null && await A('ibkrUnpack')('') === null, 'חבילה פגומה → null (לא נשבר)');

  /* ---------- 3. הטעינה מהענן במכשיר בלי IBKR — התרחיש מהדיווח ---------- */
  A("DB.positions.length = 0; DB.positions.push({ sym: 'AAA', shares: 3, avg: 10 }); delete DB.source;");
  ok(A("positionSource(DB.positions[0])") === 'manual', 'לפני: מניה מהענן בלי המקור — "ידני" (הבאג)');
  await A('ibkrCloudLoaded')({ at: 500, z }, 'ibkr', 600);
  ok(A('DB.source') === 'ibkr' && A("positionSource(DB.positions[0])") === 'ibkr', 'אחרי: המניה מוצגת IBKR');
  ok(A('ibkrCfg().lastSync') === 500 && A('ibkrCfg().data.trades.length') === 400 && !A('ibkrCfg().token'), 'הדוח ירד מהחשבון (עסקאות IBKR, תשואות) — בלי token');
  ok(A('ibkrAutoSyncDue(ibkrCfg(), Date.now())') === false, 'מכשיר בלי token לא מנסה לסנכרן מול IBKR בעצמו');

  /* ---------- 4. הגיבוי זהה למה שגובה ---------- */
  const snapOf = A('pfBackupSnapshot'), merge = A('pfBackupMerge');
  const ibDb = () => ({ positions: [{ sym: 'AAA', shares: 3, avg: 10 }, { sym: 'KO', shares: 2, avg: 50, src: 'manual' }],
    deposits: [{ date: '2024-01-02', amount: 1000, place: 'IBKR', src: 'ibkr' }, { date: '05/03/2024', amount: 200, place: 'בנק' }],
    manualTrades: [], pensionFunds: [], pensionDeposits: [], cash: { usd: 77, ils: 0 }, source: 'ibkr' });
  const s = snapOf(ibDb(), true, {}, 1, true, { at: 500, z });
  ok(s.ibkr && s.ibkr.z === z && s.ibkr.at === 500, 'גיבוי במצב IBKR: הדוח הדחוס בפנים');
  ok(s.ibkr.positions.length === 1 && s.ibkr.positions[0].sym === 'AAA' && s.positions.length === 1 && s.positions[0].sym === 'KO', 'גיבוי: מניות IBKR בחלק של IBKR, הידניות בחלק הידני');
  ok(s.ibkr.deposits.length === 1 && s.deposits.length === 1 && s.ibkr.cash.usd === 77, 'גיבוי: הפקדות ומזומן של IBKR');
  ok(!JSON.stringify(s).includes('token') && !JSON.stringify(s).includes('queryId'), 'גיבוי: בלי פרטי הגישה');
  ok(snapOf(ibDb(), false, {}, 1, true, { at: 500, z }).ibkr === null && snapOf(ibDb(), true, {}, 1, true, null).ibkr === null, 'במצב ידני / בלי חבילה — בלי חלק IBKR');
  ok(A('pfBackupCount')(s) === 4, 'מספר הפריטים בגיבוי כולל את IBKR');

  // שחזור במכשיר ידני
  const man = { positions: [{ sym: 'PEP', shares: 1, avg: 100 }], deposits: [], manualTrades: [], pensionFunds: [], pensionDeposits: [], cash: { usd: 5, ils: 0 } };
  const r = merge(man, s, false, {});
  ok(r.ibkr && r.ibkr.at === 500 && man.source === 'ibkr', 'שחזור במכשיר בלי IBKR: התיק עובר ל־IBKR והחבילה חוזרת');
  ok(man.positions.find((p) => p.sym === 'PEP').src === 'manual' && !man.positions.find((p) => p.sym === 'AAA').src, 'הידנית שבטלפון נשארת ידנית, AAA חוזרת כ־IBKR');
  ok(man.deposits.length === 2 && man.cash.usd === 77 && man.ibkrSnapshot && man.ibkrSnapshot.positions.length === 2 && man.ibkrSnapshot.cash.usd === 5, 'הפקדות ומזומן IBKR חוזרים; הידני נשמר בצד לניתוק');
  const r2 = merge(man, s, true, {});
  ok(!r2.ibkr && r2.positions === 0 && r2.deposits === 0 && man.positions.length === 3, 'שחזור חוזר — בלי כפילויות');
  const ib2 = ibDb(); const r3 = merge(ib2, s, true, {});
  ok(!r3.ibkr && ib2.positions.length === 2, 'מכשיר עם IBKR — מה שבטלפון גובר');
  ok(A('pfMergeTotal')(r) > 0, 'השחזור נספר');

  /* ---------- 5. cloud.js: המקור והצילום של החשבון, והדוח בשדה נפרד ---------- */
  const writes = []; let loaded = null;
  const docs = { u1: { v: 1, db: { v: 1, positions: [{ sym: 'AAA' }], deposits: [], source: 'ibkr', ibkrSnapshot: { positions: [], deposits: [] } }, ibkr: { at: 500, z: 'Z' }, updatedAt: { toMillis: () => 600 } } };
  const DEL = { del: 1 };
  const firestore = () => ({ collection: () => ({ doc: (u) => ({ get: async () => ({ exists: !!docs[u], data: () => docs[u] }), set: async (d, o) => { writes.push({ d, o }); }, delete: async () => {} }) }) });
  firestore.FieldValue = { delete: () => DEL, serverTimestamp: () => null };
  const cls = mkStore(); cls.setItem('pwa_owner_v1', 'u1');
  const DB = { positions: [], deposits: [], pensionFunds: [], pensionDeposits: [] };
  let authCb = null;
  const csb = {
    localStorage: cls, sessionStorage: mkStore(), console, setTimeout, clearTimeout, location: { reload() {} },
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ addEventListener() {}, setAttribute() {}, appendChild() {}, classList: { add() {}, remove() {} }, style: {} }), head: { appendChild() {} }, addEventListener() {} },
    FIREBASE_CONFIG: { apiKey: 'k', authDomain: 'd', projectId: 'p' },
    firebase: { apps: [], initializeApp() { this.apps.push(1); }, auth: () => ({ onAuthStateChanged: (cb) => { authCb = cb; }, signOut: async () => {} }), firestore },
    DB, t: (k) => k, num: (x) => +x || 0, isDemoMode: () => false, setBanner() {}, stripLegacyDemo: () => false, ensurePensionKinds() {},
    saveDBto() {}, demoDb: () => ({ positions: [], deposits: [] }), applyDbData() {},
    accountOwner: () => cls.getItem('pwa_owner_v1'), accountSwitchTo: () => false,
    ibkrCloudLoaded: (c, src, at) => { loaded = { c, src, at }; },
  };
  csb.window = csb;
  vm.createContext(csb);
  vm.runInContext(cloudSrc, csb);
  csb.Cloud.boot(() => {});
  await new Promise((res) => setTimeout(res, 20));
  authCb({ uid: 'u1' });
  await new Promise((res) => setTimeout(res, 60));
  ok(DB.source === 'ibkr' && DB.ibkrSnapshot, 'cloud: המקור והצילום הידני מגיעים מהחשבון');
  ok(loaded && loaded.c.z === 'Z' && loaded.src === 'ibkr' && loaded.at === 600, 'cloud: הדוח מהחשבון עובר לאפליקציה (עם זמן השמירה)');
  delete DB.ibkrSnapshot;
  await csb.Cloud.flushSave();
  const w = writes[writes.length - 1];
  ok(w && w.d.db.ibkrSnapshot === DEL && w.d.db.source === 'ibkr' && w.o.merge, 'cloud: צילום שנמחק בטלפון נמחק גם בענן (לא חוזר ממיזוג ישן)');
  ok(await csb.Cloud.saveIbkr({ at: 700, z: 'Q' }) && writes[writes.length - 1].d.ibkr.z === 'Q' && !('db' in writes[writes.length - 1].d), 'cloud: הדוח נשמר בשדה ibkr בלבד');
  ok(await csb.Cloud.saveIbkr(null) && writes[writes.length - 1].d.ibkr === DEL, 'cloud: ניתוק/איפוס — השדה נמחק');

  /* ---------- 6. החיבורים בקוד ---------- */
  ok(/ibkrSaveCfg\(\{ lastSync: Date\.now\(\), data: data \}\);\n\s*ibkrCloudPush\(\)/.test(app), 'אחרי כל סנכרון — הדוח עולה לענן');
  ok((app.match(/ibkrCloudDrop\(\);/g) || []).length >= 2, 'ניתוק ואיפוס IBKR — הדוח נמחק מהענן');
  console.log('# ' + n + ' בדיקות עברו');
})().catch((e) => { console.error('FAIL -', e); process.exit(1); });
