// ibkr-multi.test.js — 15/11/2026: כמה חשבונות IBKR נפרדים במקביל (בקשת המשתמש).
// rMergeAccounts (returns.js): תיק משולב — איחוד, NAV מסוכם, TWR משוקלל לפי NAV של אתמול, חשבון חדש במשקל 0.
// app.js: החשבון לפי מזהה, הדוח של הראשי עובר ל־own, התיק המשולב ב־data, תקינות חשבון חדש, איפוס.
// נתונים סינתטיים בלבד.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-6);
const root = path.join(__dirname, '..');
const R = require(path.join(root, 'returns.js'));

/* ---------- 1. rMergeAccounts — טהורה ---------- */
const flowsOf = (d) => {
  const o = {};
  for (const c of (d.cashTransactions || [])) if (c.type === 'Deposits/Withdrawals') o[c.date] = (o[c.date] || 0) + c.amount;
  return o;
};
const A = {
  meta: { fromDate: '2025-12-29', toDate: '2026-01-06', baseCurrency: 'USD', fields: { Trade: ['a', 'b'] } },
  trades: [{ tradeId: 'A1', date: '2026-01-02', symbol: 'AAA', qty: 1 }],
  positions: [{ symbol: 'AAA', qty: 10, currency: 'USD', levelOfDetail: 'SUMMARY' }, { symbol: 'SAME', qty: 1, currency: 'USD', levelOfDetail: 'SUMMARY' }],
  cashTransactions: [],
  cashBalances: [{ currency: 'USD', balance: 50 }],
  navPeriods: [],
  navDaily: [{ date: '2025-12-30', total: 100 }, { date: '2025-12-31', total: 100 }, { date: '2026-01-02', total: 110 }, { date: '2026-01-05', total: 110 }, { date: '2026-01-06', total: 121 }],
};
const B = {
  meta: { fromDate: '2026-01-02', toDate: '2026-01-05', baseCurrency: 'USD', fields: { Trade: ['b', 'c'] } },
  trades: [{ tradeId: 'B1', date: '2026-01-01', symbol: 'BBB', qty: 2 }],
  positions: [{ symbol: 'SAME', qty: 4, currency: 'USD', levelOfDetail: 'SUMMARY' }],
  cashTransactions: [{ date: '2026-01-02', type: 'Deposits/Withdrawals', amount: 300, currency: 'USD' }],
  cashBalances: [{ currency: 'USD', balance: 25 }],
  navPeriods: [],
  navDaily: [{ date: '2026-01-02', total: 300 }, { date: '2026-01-05', total: 330 }],
};
ok(R.rMergeAccounts([A], flowsOf) === A, 'חשבון אחד — הדוח עצמו, בלי שום שינוי');
ok(R.rMergeAccounts([], flowsOf) === null, 'בלי דוחות → null');
const M = R.rMergeAccounts([A, B], flowsOf);
ok(M.meta.accounts === 2 && M.meta.fromDate === '2025-12-29' && M.meta.toDate === '2026-01-05', 'meta: מההתחלה המוקדמת עד הסוף המשותף');
ok(JSON.stringify(M.meta.fields.Trade) === '["a","b","c"]', 'שמות השדות — איחוד');
ok(M.trades.length === 2 && M.trades[0].tradeId === 'B1', 'עסקאות — איחוד, ממוינות לפי תאריך');
ok(M.positions.length === 3 && M.cashBalances.length === 2, 'פוזיציות ומזומן — של כל החשבונות');
ok(M.navDaily.map((x) => x.date).join() === '2025-12-30,2025-12-31,2026-01-02,2026-01-05', 'NAV יומי — רק עד היום האחרון המשותף (06/01 של A לא נכנס)');
ok(M.navDaily.map((x) => x.total).join() === '100,100,410,440', 'NAV יומי — סכום (B = 0 לפני היום הראשון שלו)');
// 02/01: A +10% במשקל 100, B ביום הראשון שלו (משקל 0) → 10%. 05/01: A 0% (110), B +10% (300) → (110*1 + 300*1.1)/410
const g2 = (110 * 1 + 300 * 1.1) / 410;
const last = M.twrDaily[M.twrDaily.length - 1];
ok(M.twrDaily[0].value === 100 && near(M.twrDaily[2].value, 110), 'TWR: יום ההפקדה לחשבון החדש לא נספר כתשואה (משקל 0)');
ok(near(last.value, 110 * g2, 1e-4), 'TWR משוקלל לפי ה־NAV של אתמול');
ok(M.navPeriods.length === 2 && M.navPeriods[0].toDate === '2025-12-31' && M.navPeriods[1].fromDate === '2026-01-02', 'תקופות לפי שנה קלנדרית');
ok(near(M.navPeriods[1].twr, (1.1 * g2 - 1) * 100, 1e-4), 'TWR של התקופה = מכפלת הימים');
ok(near(R.rChainTwr(R.rNavPeriods(M)), (last.value / 100 - 1) * 100, 1e-3), 'הכותרת (שרשור התקופות) = סוף הסדרה היומית');
// רווח: A 10 (02/01) + B 30 (05/01). ההפקדה של B (300) לא רווח
ok(near(R.rGain(M), 40, 1e-6), 'רווח = סכום הרווח היומי של כל חשבון — ההפקדה בפתיחת חשבון לא נספרת');
ok(R.rSourceKind(M) === 'official', 'יש תשואה משולבת לכותרת');
const mixed = R.rMergeAccounts([A, Object.assign({}, B, { meta: Object.assign({}, B.meta, { baseCurrency: 'ILS' }) })], flowsOf);
ok(mixed.meta.mixedBase && !mixed.navPeriods.length && !mixed.navDaily.length && mixed.positions.length === 3, 'מטבעות בסיס שונים — בלי TWR משולב (לא מנחשים), השאר נשאר');
const noDaily = R.rMergeAccounts([A, Object.assign({}, B, { navDaily: [] })], flowsOf);
ok(noDaily.meta.noDailyTwr && !noDaily.navPeriods.length && noDaily.trades.length === 2, 'חשבון בלי NAV יומי — בלי TWR משולב');
// עיגון לרשמי: חשבון עם TWR רשמי שונה מה־NAV הגולמי — המשולב משתמש בסדרה המעוגנת שלו
const A2 = Object.assign({}, A, { navPeriods: [{ fromDate: '2025-12-31', toDate: '2026-01-06', twr: 20, startingValue: 100, endingValue: 121, netFlows: 0 }] });
const M2 = R.rMergeAccounts([A2, Object.assign({}, B, { navDaily: B.navDaily.concat([{ date: '2026-01-06', total: 330 }]) })], flowsOf);
const ixA = R.rDailyTwrSeries(A2.navDaily, {}, R.rNavPeriods(A2));
ok(near(ixA[ixA.length - 1].value, 120, 1e-6), 'הסדרה של חשבון מעוגנת ל־TWR הרשמי שלו (20%)');
const gA = (d) => { const i = ixA.findIndex((r) => r.date === d); return ixA[i].value / ixA[i - 1].value; };
const exp6 = (110 * gA('2026-01-06') + 330) / 440;
const v5 = M2.twrDaily[M2.twrDaily.length - 2].value, v6 = M2.twrDaily[M2.twrDaily.length - 1].value;
ok(M2.twrDaily[M2.twrDaily.length - 1].date === '2026-01-06' && near(v6 / v5, exp6, 1e-6), 'המשולב משתמש בתשואה היומית המעוגנת של כל חשבון, לא ב־NAV הגולמי');

/* ---------- 2. app.js — חשבונות לפי מזהה ---------- */
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const mkStore = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m }; };
const sb = {
  localStorage: mkStore(),
  document: { addEventListener() {}, getElementById: () => null, querySelectorAll: () => [], querySelector: () => null,
    createElement: () => ({ classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {} }) },
  window: {}, navigator: {}, location: {},
  AbortController, fetch: () => Promise.reject(new Error('no net')), setTimeout, clearTimeout, console,
};
vm.createContext(sb);
vm.runInContext(fs.readFileSync(path.join(root, 'returns.js'), 'utf8'), sb);
vm.runInContext(app, sb);
const X = (k) => vm.runInContext(k, sb);
const save = X('ibkrSaveCfg'), cfgOf = X('ibkrCfg'), acct = X('ibkrAcct'), store = X('ibkrStoreAcct'), check = X('ibkrAcctCheck');
const accts = X('ibkrAccts'), own = X('ibkrOwnData'), wipe = X('ibkrDataWipe'), dataAt = X('ibkrDataAt'), due = X('ibkrAutoSyncDue');
const real = (d) => Object.assign({}, d, { positions: d.positions });

save({ token: 'T1', queryId: '111', data: real(A), lastSync: 1000 });
ok(own(cfgOf()).meta.toDate === '2026-01-06', 'בלי חשבון נוסף — הדוח של הראשי הוא data');
ok(store('main', real(A)).meta.toDate === '2026-01-06', 'בלי חשבון נוסף — שמירה מחזירה את הדוח כמו שהוא');
const m = acct(cfgOf(), 'main');
ok(m.main && m.token === 'T1' && m.queryId === '111' && m.lastSync === 1000, 'הראשי — מהשדות הקיימים');
ok(acct(cfgOf(), 'nope') === null, 'מזהה לא קיים → null');
ok(check(cfgOf(), 'x', '', '1') === 'credsMissing', 'חסר token → שגיאה');
ok(check(cfgOf(), 'x', 'T2', 'abc') === 'ibkrAcctBadQuery', 'Query ID לא מספר → שגיאה');
ok(check(cfgOf(), 'x', 'T1', '111') === 'ibkrAcctDup', 'אותה שאילתה כמו הראשי → כפילות');
ok(check(cfgOf(), 'x', 'T1', '222') === '', 'אותו token עם שאילתה אחרת — מותר');

// הוספת חשבון — כמו ibkrAddAcct: own = הדוח של הראשי
save({ accts: [{ id: 'a1', name: 'שני', token: 'T2', queryId: '222', data: null, lastSync: 0 }], own: cfgOf().data });
ok(accts(cfgOf()).length === 1 && own(cfgOf()).meta.toDate === '2026-01-06', 'חשבון נוסף — own = הדוח של הראשי');
ok(check(cfgOf(), 'x', 'T2', '222') === 'ibkrAcctDup', 'שאילתה שכבר מחוברת כחשבון נוסף → כפילות');
const a1 = acct(cfgOf(), 'a1');
ok(!a1.main && a1.token === 'T2' && a1.name === 'שני', 'חשבון נוסף לפי מזהה');
const comb = store('a1', real(B));
ok(comb.meta.accounts === 2 && comb.positions.length === 3, 'יבוא של חשבון נוסף → התיק המשולב');
ok(acct(cfgOf(), 'a1').data.meta.toDate === '2026-01-05' && acct(cfgOf(), 'a1').lastSync > 0, 'הדוח של החשבון הנוסף נשמר אצלו');
ok(cfgOf().lastSync === 1000, 'lastSync של הראשי לא זז (העדכון היומי שלו)');
ok(acct(cfgOf(), 'main').data.meta.toDate === '2026-01-06', 'הראשי ממשיך מהדוח שלו (own), לא מהמשולב');
X('ibkrSaveAcct')('a1', { autoTry: 5 });
ok(acct(cfgOf(), 'a1').autoTry === 5 && cfgOf().autoTry === undefined, 'ibkrSaveAcct — רק על החשבון');
ok(due(acct(cfgOf(), 'a1'), Date.now()) === false, 'חשבון שסונכרן עכשיו — לא בתור לעדכון היומי');
X('ibkrSaveAcct')('a1', { lastSync: 0, autoTry: 0 });
ok(due(acct(cfgOf(), 'a1'), Date.now()) === true && due(acct(cfgOf(), 'main'), Date.now()) === true, 'עדכון יומי — לכל חשבון חלון משלו');
save({ autoOn: false });
ok(due(acct(cfgOf(), 'a1'), Date.now()) === false, '"סנכרון אוטומטי" כבוי — גם לחשבונות הנוספים');
save({ autoOn: true });
save({ dataAt: 5000 });
ok(dataAt(cfgOf()) === 5000, 'dataAt — מתי התיק השתנה (לענן)');
// ibkrMapImport מאחד מניה שבשני חשבונות
const imp = X('ibkrMapImport')(comb);
const same = imp.positions.find((p) => p.sym === 'SAME');
ok(same && same.shares === 5 && imp.cash.usd === 75, 'מניה בשני חשבונות — שורה אחת עם הכמות של שניהם; מזומן מסוכם');
// איפוס הנתונים — החיבורים נשארים
const w = wipe(cfgOf());
ok(w.data === null && w.own === null && w.accts.length === 1 && w.accts[0].token === 'T2' && w.accts[0].data === null, 'איפוס — הנתונים נמחקים, החיבורים נשארים');
// ניתוק — גם החשבונות הנוספים (בקוד: accts: [])
ok(/data: null, own: null, accts: \[\], token: ''/.test(app), 'ניתוק מוחק גם את החשבונות הנוספים ואת ה־tokens שלהם');
// ה־token של חשבון נוסף לא עולה לענן — ibkrCloudPush אורז רק את cfg.data
ok(/const z = await ibkrPack\(cfg\.data\)/.test(app), 'לענן עולה רק התיק (cfg.data), לא ההגדרות עם ה־tokens');

console.log('\n' + n + ' בדיקות עברו');

/* ---------- 3. איפוס נפרד לכל חשבון (בקשת המשתמש) ---------- */
{
  const src = app;
  ok(/function doResetIbkrAcct\(id\)/.test(src) && /ibkrSaveAcct\(id, \{ data: null, lastSync: 0, autoTry: 0, autoRetry: false \}\)/.test(src), 'איפוס חשבון נוסף — רק הדוח שלו, החיבור נשאר');
  ok(/if \(a\.main\) \{\s*ibkrSaveCfg\(\{ own: null, lastSync: 0/.test(src), 'איפוס הראשי — רק own (הדוח שלו), החשבונות הנוספים לא נגעים');
  ok(/if \(!ibkrHasImportedData\(data\)\) \{ ibkrResetAllNow\(\); return; \}/.test(src), 'לא נשאר חשבון עם נתונים — איפוס IBKR מלא');
  ok(/keepSync: true/.test(src) && /!\(o && o\.keepSync\)/.test(src), 'איפוס הראשי לא מסמן "סונכרן עכשיו" (העדכון היומי לא מדלג)');
  // התוצאה: אחרי איפוס הראשי — התיק המשולב = החשבון הנוסף לבד
  save({ token: 'T1', queryId: '111', own: real(A), accts: [{ id: 'a1', name: 'שני', token: 'T2', queryId: '222', data: real(B), lastSync: 9 }] });
  save({ own: null });
  const after = X('ibkrCombined')(cfgOf());
  ok(after && after.meta.toDate === '2026-01-05' && !after.meta.accounts, 'אחרי איפוס הראשי — התיק = החשבון השני בלבד');
  ok(acct(cfgOf(), 'main').data === null && acct(cfgOf(), 'main').token === 'T1', 'הראשי — בלי נתונים, עם החיבור (הסנכרון הבא מושך מההתחלה)');
  X('ibkrSaveAcct')('a1', { data: null });
  ok(X('ibkrCombined')(cfgOf()) === null, 'שניהם אופסו — אין תיק');
}
console.log(n + ' בדיקות עברו (כולל איפוס)');
