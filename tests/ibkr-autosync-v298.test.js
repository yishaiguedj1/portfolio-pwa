// v298: עדכון אוטומטי יומי מ־IBKR (14:00 שעון ישראל) + הסרת בחירת הטווח
const fs = require('fs');
const path = require('path');
const vm = require('vm');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const store = {};
function elStub() { return { value: '', textContent: '', innerHTML: '', classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, addEventListener() {}, appendChild() {}, dataset: {}, style: {}, setAttribute() {}, querySelectorAll: () => [], querySelector: () => null }; }
const els = {};
let confirms = 0;
const sandbox = {
  localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
  document: { addEventListener() {}, getElementById: (id) => (els[id] || (els[id] = elStub())), querySelectorAll: () => [], querySelector: () => null, createElement: () => elStub() },
  window: {}, navigator: {}, location: { reload() {} }, AbortController, fetch: async () => { throw new Error('no fetch'); },
  setTimeout, clearTimeout, confirm: () => { confirms++; return true; }, console,
};
vm.createContext(sandbox);
const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
vm.runInContext(app + '\n;globalThis.__t = { ibkrAutoTargetMs, ibkrAutoSyncDue, ibkrSilentResult, IBKR_AUTO_HOUR_IL, IBKR_AUTO_RETRY_MS };', sandbox, { filename: 'app.js' });
const T = sandbox.__t;
const U = (s) => Date.parse(s);

// שעת היעד — 14:00 שעון ישראל (קיץ UTC+3, חורף UTC+2)
ok(T.IBKR_AUTO_HOUR_IL === 14, 'שעת העדכון: 14:00 שעון ישראל');
ok(T.ibkrAutoTargetMs(U('2026-09-30T10:00:00Z')) === U('2026-09-29T11:00:00Z'), 'קיץ, 13:00 בישראל → היעד האחרון = אתמול 14:00');
ok(T.ibkrAutoTargetMs(U('2026-09-30T11:30:00Z')) === U('2026-09-30T11:00:00Z'), 'קיץ, 14:30 בישראל → היעד = היום 14:00');
ok(T.ibkrAutoTargetMs(U('2026-12-15T12:30:00Z')) === U('2026-12-15T12:00:00Z'), 'חורף, 14:30 בישראל → היום 14:00 (UTC+2)');
ok(T.ibkrAutoTargetMs(U('2026-12-15T21:30:00Z')) === U('2026-12-15T12:00:00Z'), 'אחרי חצות UTC אבל עדיין אותו יום בישראל — אותו יעד');

// מתי מושכים
const now = U('2026-09-30T12:00:00Z'); // 15:00 בישראל
const target = U('2026-09-30T11:00:00Z');
const base = { token: 't', queryId: '1', data: { positions: [{}], trades: [{}], navPeriods: [], meta: {} } };
const cfg = (x) => Object.assign({}, base, x);
ok(T.ibkrAutoSyncDue(cfg({ lastSync: target - 3600e3 }), now) === true, 'הסנכרון האחרון לפני 14:00 של היום → מושכים');
ok(T.ibkrAutoSyncDue(cfg({ lastSync: target + 60e3 }), now) === false, 'כבר סונכרן אחרי 14:00 → לא');
ok(T.ibkrAutoSyncDue(cfg({ lastSync: 0, autoTry: target + 60e3 }), now) === false, 'ניסיון אחד לחלון — לא חוזרים מיד');
ok(T.ibkrAutoSyncDue(cfg({ lastSync: 0, autoTry: now - T.IBKR_AUTO_RETRY_MS - 1, autoRetry: true }), now + 60e3) === true, 'תקלה חולפת → ניסיון נוסף אחרי 3 שעות');
ok(T.ibkrAutoSyncDue(cfg({ lastSync: 0, autoTry: now - 3600e3, autoRetry: true }), now) === false, 'תקלה חולפת — לא לפני 3 שעות');
ok(T.ibkrAutoSyncDue(cfg({ lastSync: 0, token: '' }), now) === false, 'בלי token → לא');
ok(T.ibkrAutoSyncDue(cfg({ lastSync: 0, data: null }), now) === false, 'בלי נתונים שיובאו (משיכה ראשונה) → רק בלחיצה');
// לכל היותר 24 שעות בין עדכונים כשמשתמשים באפליקציה: פתיחה ב־09:00 למחרת עם סנכרון מאתמול 13:00 → מושכים
ok(T.ibkrAutoSyncDue(cfg({ lastSync: U('2026-09-29T10:00:00Z') }), U('2026-09-30T06:00:00Z')) === true, 'לא נפתח אחרי 14:00 אתמול → הפתיחה הבאה משלימה');

// תוצאה שקטה
ok(T.ibkrSilentResult('ok') === 'ok', 'הצלחה → ok');
ok(T.ibkrSilentResult('fail', null, new Error('flex_1025')) === 'fail', 'נעילת טוקן → לא מנסים שוב היום');
ok(T.ibkrSilentResult('fail', null, new Error('fetch_failed')) === 'retry', 'רשת → ניסיון נוסף');
ok(T.ibkrSilentResult('fail', { latestChunkOk: false, _chunks: [{ ok: false, error: 'flex_1003' }] }) === 'retry', 'הדוח עוד לא פורסם → ניסיון נוסף');
ok(T.ibkrSilentResult('fail', { latestChunkOk: false, _throttled: true, _chunks: [] }) === 'fail', 'הגבלת קצב → לא היום');

// ממשק וחיווט
ok(!/id="ibkrRangeDetails"/.test(html), 'בחירת הטווח הוסרה מהכרטיס');
ok(/wireIbkrAutoSync\(\); \/\/ v298/.test(app) && /setInterval\(ibkrAutoSyncTick, 5 \* 60 \* 1000\)/.test(app) && /visibilitychange/.test(app), 'בדיקה בפתיחה, בחזרה לאפליקציה וכל 5 דקות');
// v312 (בקשת המשתמש): השורה "עדכון אוטומטי · כל יום ב־14:00" הוחלפה במתג אחד "סנכרון אוטומטי"
ok(/id="ibkrAutoSw" role="switch"/.test(app) && /ibkrAutoLbl: 'סנכרון אוטומטי'/.test(app) && /ibkrAutoLbl: 'Auto sync'/.test(app), 'בכרטיס: מתג "סנכרון אוטומטי"');
ok(/if \(silent && !String\(warnTxt \|\| ''\)\.trim\(\)\) \{ ibkrFinishImport\(rMergeData\(existing, incoming\), true\); return; \}/.test(app), 'עדכון שקט מייבא בלי חלון אישור (רק אזהרה שואלת)');
ok(/if \(silent && \(state\.ibkrSyncing \|\| isDemoMode\(\)\)\) return 'skip';/.test(app) && /if \(silent && !ibkrHasImportedData\(cfg\.data\)\) return 'skip';/.test(app), 'לא בזמן סנכרון ידני, לא בדמו, לא במשיכה ראשונה');
ok(/if \(silent\) return; \/\/ v298: עדכון שקט לא מחליף נתונים שמורים/.test(app), 'עדכון שקט לא מחליף מטמון שלא תואם לתיק');
console.log('# ' + n + ' בדיקות עברו');
