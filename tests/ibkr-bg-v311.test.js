// v311: סנכרון IBKR ברקע (השרתון מכין, האפליקציה טוענת) + עדכון שקט בלי הודעה אדומה בתקלת רשת
const fs = require('fs');
const path = require('path');
const vm = require('vm');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const store = {};
function elStub() { return { value: '', textContent: '', innerHTML: '', classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, addEventListener() {}, appendChild() {}, dataset: {}, style: {}, setAttribute() {}, querySelectorAll: () => [], querySelector: () => null }; }
const els = {};
let netCalls = 0;
const sandbox = {
  localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
  document: { addEventListener() {}, getElementById: (id) => (els[id] || (els[id] = elStub())), querySelectorAll: () => [], querySelector: () => null, createElement: () => elStub() },
  window: {}, navigator: {}, location: { reload() {} }, AbortController, fetch: async () => { netCalls++; throw new Error('no fetch'); },
  setTimeout, clearTimeout, confirm: () => true, console,
};
vm.createContext(sandbox);
const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
vm.runInContext(app + '\n;globalThis.__t = { ibkrBgPlan, ibkrSilentIsNet, ibkrAutoSyncDue, ibkrAutoOn, ibkrBgEnsure, ibkrAutoToggle, ibkrSaveCfg, ibkrCfg, ibkrFetchFullHistory, IBKR_NET_RETRY_MS, IBKR_AUTO_RETRY_MS, ibkrAutoTargetMs };', sandbox, { filename: 'app.js' });
const T = sandbox.__t;

// החלקים המוכנים — רק רצף שמתחיל בדיוק ביום שאחרי הנתונים שבטלפון
const D = { trades: [], cashTransactions: [], positions: [] };
const p1 = T.ibkrBgPlan([{ fd: '20261001', td: '20261004', data: D }], '20261001');
ok(p1 && p1.lastTd === '20261004' && p1.map['20261001|20261004'] === D, 'חלק מוכן שמתחיל בנקודת ההמשך — נלקח');
ok(T.ibkrBgPlan([{ fd: '20260930', td: '20261004', data: D }], '20261001') === null, 'חלק שחופף למה שכבר בטלפון — לא נלקח (בלי יום כפול)');
ok(T.ibkrBgPlan([{ fd: '20261003', td: '20261004', data: D }], '20261001') === null, 'חלק שמתחיל אחרי נקודת ההמשך (חור) — לא נלקח');
const p2 = T.ibkrBgPlan([{ fd: '20260101', td: '20260105', data: D }, { fd: '20251220', td: '20251231', data: D }], '20251220');
ok(p2 && p2.lastTd === '20260105' && Object.keys(p2.map).length === 2, 'מעבר שנה — שני חלקים רצופים (כמו בחלוקה של האפליקציה)');
ok(T.ibkrBgPlan([], '20261001') === null && T.ibkrBgPlan(null, '20261001') === null && T.ibkrBgPlan([{ fd: '20261001', td: '20261004' }], '20261001') === null, 'בלי חלקים / בלי נתונים — כלום');

// תקלת רשת → ניסיון חוזר בעוד 15 דקות (לא 3 שעות)
ok(T.ibkrSilentIsNet(null, new Error('Failed to fetch')) && T.ibkrSilentIsNet({ _chunks: [{ ok: false, error: 'Failed to fetch' }] }), 'Failed to fetch מזוהה כתקלת רשת (המקרה מהצילום)');
ok(!T.ibkrSilentIsNet({ _chunks: [{ ok: false, error: 'flex_1003' }] }) && !T.ibkrSilentIsNet(null, new Error('flex_1025')), 'הדוח עוד לא פורסם / נעילה — לא "רשת"');
const now = Date.parse('2026-10-04T12:00:00Z');
const target = T.ibkrAutoTargetMs(now);
const base = { token: '123456789012', queryId: '999999', data: { positions: [{ symbol: 'A' }], trades: [], navPeriods: [], meta: { toDate: '2026-10-01' } }, lastSync: target - 1000 };
ok(T.ibkrAutoSyncDue(Object.assign({}, base, { autoTry: now - 16 * 60000, autoRetry: true, autoRetryMs: T.IBKR_NET_RETRY_MS }), now), 'אחרי תקלת רשת — מנסים שוב אחרי 15 דקות');
ok(!T.ibkrAutoSyncDue(Object.assign({}, base, { autoTry: now - 16 * 60000, autoRetry: true }), now), 'תקלה אחרת — עדיין 3 שעות');

// המשיכה עם חלקים מוכנים — בלי שום פנייה לרשת
(async () => {
  const data = { meta: { fromDate: '2026-10-01', toDate: '2026-10-04' }, trades: [{ tradeId: 'T1', date: '2026-10-02', symbol: 'AAPL', qty: 1, side: 'BUY', price: 1 }], positions: [{ symbol: 'AAPL', qty: 1 }], cashTransactions: [], navHistory: [{ fromDate: '2026-10-01', toDate: '2026-10-04', startingValue: 1, endingValue: 1 }] };
  netCalls = 0;
  const res = await T.ibkrFetchFullHistory(sandbox.fetch, 'https://x', 'tok', 'q', '20261001', null, { chunkGapMs: 5, endDate: new Date(2026, 9, 4), prefetched: { '20261001|20261004': data } });
  ok(netCalls === 0 && res.trades.length === 1 && (res._chunks || []).every((c) => c.ok), 'חלק מוכן מהשרתון נכנס לאותו צינור מיזוג — בלי פנייה ל־IBKR');

  // מבנה הקוד: עדכון שקט לא משאיר הודעה אדומה; ניתוק מוחק גם מהשרתון; ייבוא → ack
  ok(/if \(silent\) return result;\s+\/\/ v311/.test(app), 'עדכון שקט שנכשל — בלי הודעת שגיאה אדומה (התקלה מהצילום)');
  ok(/if \(res === 'ok' \|\| res === 'uptodate'\) ibkrClearErr\(\)/.test(app), 'עדכון שקט שהצליח — מנקה שגיאה ישנה מהמסך');
  ok(/const hadBg = ibkrCfg\(\)\.bgOn;[\s\S]{0,400}bgPurge: !!hadBg \}\);\s+if \(hadBg\) ibkrBgPurge\(\)/.test(app), 'ניתוק — ה־token המוצפן נמחק גם מהשרתון (עם ניסיון חוזר)');
  ok(/ibkrSaveCfg\(\{ lastSync: Date\.now\(\), data: data \}\);\s+ibkrBgAck\(\)/.test(app), 'אחרי ייבוא — הדוח נמחק מהענן (ack)');
  ok(/role="switch" aria-checked=/.test(app) && /\.ib-sw/.test(fs.readFileSync(path.join(root, 'styles.css'), 'utf8')), 'מתג נגיש (role=switch) בכרטיס');
  ok(!/localStorage[^\n]*bgToken|bg[A-Za-z]*:\s*cfg\.token/.test(app), 'ה־token לא נשמר בשום מקום חדש בטלפון');

  // v312: מתג אחד "סנכרון אוטומטי" — פעיל כברירת מחדל, מפעיל/מכבה גם את העדכון היומי וגם את הסנכרון ברקע
  ok(T.ibkrAutoOn({}) && T.ibkrAutoOn({ autoOn: true }) && !T.ibkrAutoOn({ autoOn: false }), 'ברירת מחדל: פעיל (לא מוגדר = פעיל)');
  const due = Object.assign({}, base, { lastSync: 0 });
  ok(T.ibkrAutoSyncDue(due, now) && !T.ibkrAutoSyncDue(Object.assign({}, due, { autoOn: false }), now), 'כבוי — גם העדכון היומי בפתיחה נעצר');
  // הרשמה שקטה בשרתון: עם התחברות — נשלחת פעם אחת, בלי חלון אישור
  const calls = [];
  sandbox.firebase = { apps: [1], auth: () => ({ currentUser: { uid: 'U1', getIdToken: async () => 'ID' } }) };
  sandbox.localStorage.setItem('pwa_owner_v1', 'U1');   // v313: הנתונים במכשיר שייכים למחובר
  sandbox.fetch = async (url, o) => { calls.push({ url, body: JSON.parse(o.body) }); return { status: 200, json: async () => ({ ok: true, enabled: true }) }; };
  T.ibkrSaveCfg(Object.assign({}, base, { bgOn: false, bgTry: 0, bgPurge: false, autoOn: undefined }));
  await T.ibkrBgEnsure();
  ok(calls.length === 1 && calls[0].body.op === 'enable' && calls[0].body.have === '2026-10-01' && T.ibkrCfg().bgOn === true, 'פעיל כברירת מחדל → נרשם לסנכרון ברקע לבד (בלי לשאול)');
  await T.ibkrBgEnsure();
  ok(calls.length === 1, 'כבר רשום — לא שולח שוב');
  // כיבוי: מוחק מהשרתון; בלי רשת — נשאר "למחוק" עד שמצליח, ולא נרשם מחדש בינתיים
  sandbox.fetch = async () => { throw new Error('Failed to fetch'); };
  T.ibkrAutoToggle(false); await new Promise((r) => setTimeout(r, 20));
  ok(T.ibkrCfg().autoOn === false && T.ibkrCfg().bgOn === false && T.ibkrCfg().bgPurge === true, 'כיבוי בלי רשת — המחיקה מהשרתון ממתינה לניסיון חוזר');
  calls.length = 0;
  sandbox.fetch = async (url, o) => { calls.push({ url, body: JSON.parse(o.body) }); return { status: 200, json: async () => ({ ok: true }) }; };
  T.ibkrSaveCfg({ autoOn: true, bgTry: 0 });
  await T.ibkrBgEnsure();
  ok(calls.length === 0, 'מחיקה ממתינה — אין הרשמה חדשה לפניה');
  T.ibkrSaveCfg({ autoOn: false });
  console.log('# ' + n + ' בדיקות עברו');
})().catch((e) => { console.error('FAIL -', e); process.exit(1); });
