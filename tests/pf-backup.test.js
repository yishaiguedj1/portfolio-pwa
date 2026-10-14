// pf-backup.test.js — גיבוי ושחזור של Invest ל־Google Drive (14/10/2026): רק מה שהוזן ביד נכנס לגיבוי,
// והשחזור לא יוצר כפילויות — לא בשחזור חוזר, לא מול מניה ידנית קיימת ולא מול מניה מ־IBKR. נתונים סינתטיים בלבד.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

let n = 0;
function ok(cond, name) {
  n++;
  if (!cond) { console.error('FAIL - ' + name); process.exit(1); }
  console.log('ok - ' + name);
}
const sb = {
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  document: { addEventListener() {}, getElementById: () => null, querySelectorAll: () => [], querySelector: () => null,
    createElement: () => ({ classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {} }) },
  window: {}, navigator: {}, location: {},
  AbortController, fetch: () => Promise.reject(new Error('no net')), setTimeout, clearTimeout, console,
};
vm.createContext(sb);
vm.runInContext(src, sb);
const A = (k) => vm.runInContext(k, sb);
const cp = (o) => JSON.parse(JSON.stringify(o));
const snapOf = A('pfBackupSnapshot'), merge = A('pfBackupMerge'), total = A('pfMergeTotal'), count = A('pfBackupCount');

// תיק מעורב במצב IBKR: AAPL מ־IBKR, KO ידנית לפי ממוצע, MSFT מעסקאות
const mixed = () => ({
  v: 1,
  positions: [
    { sym: 'AAPL', name: 'Apple', shares: 10, avg: 100 },
    { sym: 'KO', name: 'Coca-Cola', shares: 5, avg: 60, src: 'manual' },
    { sym: 'MSFT', name: 'MSFT', shares: 3, avg: 300, src: 'manual', fromTrades: true },
  ],
  deposits: [
    { date: '2024-01-02', amount: 1000, place: 'IBKR', src: 'ibkr' },
    { date: '05/03/2024', amount: 500, place: 'בנק' },
    { date: '05/03/2024', amount: 500, place: 'בנק' },
  ],
  manualTrades: [{ id: 't1', date: '2024-03-01', sym: 'MSFT', side: 'BUY', qty: 3, price: 300, fee: 1 }],
  pensionFunds: [{ name: 'קרן א', usd: 0, ils: 1000, kind: 'pension' }],
  pensionDeposits: [{ place: 'קרן א', period: '2024-01', amount: 200, note: '', kind: 'pension' }],
  wishlist: [{ sym: 'NVDA', name: 'NVIDIA', note: '' }],
  wlExtra: [{ id: 'l1', name: 'טכנולוגיה', items: [{ sym: 'AMD', name: 'AMD' }] }],
  wlOrder: ['l1', 'main'], wlMainName: 'שלי',
  stockOrder: ['KO', 'AAPL'],
  cash: { usd: 50, ils: 0 },
});

// --- 1. מה נכנס לגיבוי ---
const s = snapOf(mixed(), true, { pwa_lang_v1: 'he', pwa_theme_v1: 'dark', pwa_ibkr_v1: 'סוד' }, 123);
ok(s.app === 'invest' && s.v === 1 && s.at === 123, 'גיבוי: סימון ותאריך');
ok(s.positions.length === 1 && s.positions[0].sym === 'KO' && s.positions[0].src === 'manual', 'גיבוי: רק מניה ידנית לפי ממוצע (לא IBKR ולא מעסקאות)');
ok(s.deposits.length === 2 && s.deposits.every((d) => !d.src), 'גיבוי: רק הפקדות ידניות');
ok(s.trades.length === 1 && s.trades[0].id === 't1', 'גיבוי: העסקאות הידניות');
ok(s.cash === null, 'גיבוי: במצב IBKR המזומן לא נכנס (מגיע מהדוח)');
ok(snapOf(mixed(), false, {}, 0).cash.usd === 50, 'גיבוי: במצב ידני המזומן נכנס');
ok(snapOf(mixed(), false, {}, 0).positions.length === 2, 'גיבוי: במצב ידני — כל מניה שאינה מעסקאות');
ok(s.prefs.pwa_lang_v1 === 'he' && s.prefs.pwa_theme_v1 === 'dark' && !('pwa_ibkr_v1' in s.prefs), 'גיבוי: רק העדפות מהרשימה — לא נתוני IBKR');
ok(!JSON.stringify(s).includes('סוד'), 'גיבוי: שום ערך של IBKR');
ok(count(s) === 1 + 1 + 2 + 1 + 1 + 2, 'ספירת הפריטים בגיבוי');

// --- 2. שחזור לתיק ריק (מכשיר חדש) ---
const fresh = { positions: [], deposits: [], manualTrades: [], pensionFunds: [], pensionDeposits: [], wishlist: [], wlExtra: [], wlOrder: [], cash: { usd: 0, ils: 0 } };
const r1 = merge(fresh, s, false, {}, true);
ok(r1.positions === 1 && r1.trades === 1 && r1.deposits === 2 && r1.pensionFunds === 1 && r1.pensionDeposits === 1 && r1.watch === 2, 'שחזור לריק: הכל נוסף');
ok(fresh.positions[0].sym === 'KO' && fresh.positions[0].src === 'manual', 'שחזור: מניה ידנית מסומנת ידנית');
ok(fresh.wlExtra[0].id === 'l1' && fresh.wlExtra[0].items[0].sym === 'AMD' && fresh.wlMainName === 'שלי' && fresh.wlOrder.join() === 'l1,main', 'שחזור: רשימות המעקב, השם והסדר');
ok(r1.prefs.pwa_theme_v1 === 'dark' && r1.ui, 'שחזור עם הגדרות ותצוגה: ההעדפות מהגיבוי');

// --- 3. שחזור אחרי שחזור — כלום לא נוסף ---
const before = JSON.stringify(fresh);
const r2 = merge(fresh, s, false, { pwa_lang_v1: 'he', pwa_theme_v1: 'dark' }, true);
ok(total(r2) === 0 && !r2.ui && JSON.stringify(fresh) === before, 'שחזור חוזר (גם עם הגדרות): אף פריט לא נוסף ושום דבר לא השתנה');
const r3 = merge(fresh, cp(s), false, {});
ok(total(r3) === 0, 'שחזור שלישי (עותק של הגיבוי): אפס');

// --- 4. מול מניה שכבר קיימת ---
const withIb = { positions: [{ sym: 'KO', name: 'Coca-Cola', shares: 7, avg: 55 }], deposits: [], manualTrades: [], pensionFunds: [], pensionDeposits: [], wishlist: [] };
const r4 = merge(withIb, s, true, {});
ok(r4.positions === 0 && withIb.positions.length === 1 && withIb.positions[0].shares === 7, 'מניה שמחזיק IBKR — הגיבוי לא מוסיף עוד אחת ולא דורס');
const withManual = { positions: [{ sym: 'ko', shares: 9, avg: 50, src: 'manual' }], deposits: [], manualTrades: [] };
ok(merge(withManual, s, false, {}).positions === 0 && withManual.positions.length === 1 && withManual.positions[0].shares === 9, 'מניה ידנית קיימת (גם באותיות קטנות) — הטלפון גובר');
const tradedHere = { positions: [], deposits: [], manualTrades: [{ id: 'x9', date: '2024-02-01', sym: 'KO', side: 'BUY', qty: 1, price: 50, fee: 0 }] };
ok(merge(tradedHere, s, false, {}).positions === 0, 'מניה שיש לה עסקאות בטלפון — לא נוספת לפי ממוצע (העסקאות קובעות)');

// --- 5. עסקאות: לפי מזהה ולפי תוכן ---
const tr = { positions: [], deposits: [], manualTrades: [{ id: 'other', date: '2024-03-01', sym: 'msft', side: 'buy', qty: 3, price: 300, fee: 1 }] };
ok(merge(tr, s, false, {}).trades === 0 && tr.manualTrades.length === 1, 'עסקה זהה בתוכן עם מזהה אחר — לא נוספת');
const tr2 = { positions: [], deposits: [], manualTrades: [{ id: 't1', date: '2024-03-05', sym: 'MSFT', side: 'BUY', qty: 4, price: 310, fee: 1 }] };
ok(merge(tr2, s, false, {}).trades === 0 && tr2.manualTrades[0].qty === 4, 'עסקה באותו מזהה שנערכה בטלפון — הטלפון גובר');

// --- 6. הפקדות זהות: נספרות, לא מאוחדות ---
const dep = { positions: [], deposits: [{ date: '05/03/2024', amount: 500, place: 'בנק' }], manualTrades: [] };
ok(merge(dep, s, false, {}).deposits === 1 && dep.deposits.length === 2, 'שתי הפקדות זהות בגיבוי, אחת בטלפון — נוספת רק אחת');
ok(merge(dep, s, false, {}).deposits === 0 && dep.deposits.length === 2, 'ושוב — אפס');
const depIb = { positions: [], deposits: [], manualTrades: [] };
merge(depIb, { deposits: [{ date: '2024-01-02', amount: 1000, src: 'ibkr' }] }, false, {});
ok(depIb.deposits.length === 0, 'הפקדת IBKR בגיבוי (קובץ ישן/ערוך) — לא משוחזרת');

// --- 7. פנסיה, מזומן, רשימות והעדפות ---
const pen = { positions: [], deposits: [], manualTrades: [], pensionFunds: [{ name: ' קרן א ', ils: 5 }], pensionDeposits: [] };
const r7 = merge(pen, s, false, {});
ok(r7.pensionFunds === 0 && pen.pensionFunds.length === 1 && pen.pensionFunds[0].ils === 5, 'קרן פנסיה באותו שם — הטלפון גובר');
ok(r7.pensionDeposits === 1, 'הפקדת פנסיה חסרה — נוספת');
const cashDb = { positions: [], deposits: [], manualTrades: [], cash: { usd: 7, ils: 0 } };
ok(merge(cashDb, snapOf(mixed(), false, {}, 0), false, {}).cash === false && cashDb.cash.usd === 7, 'מזומן קיים בטלפון — לא נדרס');
const cashIb = { positions: [], deposits: [], manualTrades: [], cash: { usd: 0, ils: 0 } };
ok(merge(cashIb, snapOf(mixed(), false, {}, 0), true, {}).cash === false && cashIb.cash.usd === 0, 'במצב IBKR המזומן לא משוחזר');
const wl = { positions: [], deposits: [], manualTrades: [], wishlist: [{ sym: 'nvda' }], wlExtra: [{ id: 'zz', name: 'טכנולוגיה', items: [{ sym: 'INTC' }] }] };
const r8 = merge(wl, s, false, {});
ok(r8.watch === 1 && wl.wishlist.length === 1 && wl.wlExtra.length === 1 && wl.wlExtra[0].items.map((x) => x.sym).join() === 'INTC,AMD', 'רשימה באותו שם — מאוחדת, בלי כפילות סימבול');
ok(merge(wl, s, false, {}).watch === 0, 'ושוב — אפס');
ok(Object.keys(merge(wl, s, false, { pwa_theme_v1: 'light' }).prefs).length === 0, 'שחזור בלי הגדרות ותצוגה — שום העדפה לא משתנה');
ok(merge(wl, s, false, { pwa_theme_v1: 'light' }, true).prefs.pwa_theme_v1 === 'dark', 'שחזור עם הגדרות ותצוגה — ההעדפה מהגיבוי גוברת (המשתמש בחר)');
ok(Object.keys(merge(wl, { prefs: { pwa_ibkr_v1: 'x', pwa_lang_v1: 'en' } }, false, {}, true).prefs).join() === 'pwa_lang_v1', 'העדפה שלא ברשימה — לא מוחלת');

// --- 7ב. גיבוי בלי הגדרות ותצוגה ---
const noUi = snapOf(mixed(), true, { pwa_lang_v1: 'he' }, 1, false);
ok(noUi.ui === false && !Object.keys(noUi.prefs).length && !noUi.wlOrder.length && !noUi.stockOrder.length, 'גיבוי בלי הגדרות: בלי העדפות ובלי סידור');
ok(noUi.positions.length === 1 && noUi.wishlist.length === 1 && noUi.wlExtra.length === 1, 'גיבוי בלי הגדרות: הנתונים עצמם נשמרים (כולל רשימות המעקב)');
ok(!A('pfBackupHasUi')(noUi) && A('pfBackupHasUi')(s), 'pfBackupHasUi: רק גיבוי עם הגדרות');
const ord = { positions: [], deposits: [], manualTrades: [], stockOrder: ['PEP'], wlOrder: ['x'] };
const ro = merge(ord, s, false, {}, false);
ok(!ro.ui && ord.stockOrder.join() === 'PEP' && ord.wlOrder.join() === 'x', 'שחזור בלי הגדרות: הסידור בטלפון לא משתנה');
const ro2 = merge(ord, s, false, {}, true);
ok(ro2.ui && ord.stockOrder.join() === 'KO,AAPL' && ord.wlOrder.join() === 'l1,main', 'שחזור עם הגדרות: הסידור מהגיבוי');
ok(!merge(ord, noUi, false, {}, true).ui, 'גיבוי בלי הגדרות + שחזור "עם" — אין מה להחיל');

// --- 8. הסנכרון של העסקאות אחרי השחזור לא יוצר כפילות ---
A('DB.positions.length = 0; DB.manualTrades = [];');
sb.__s = s;
A('pfBackupMerge(DB, __s, false, {}); mtSyncPositions(); pfBackupMerge(DB, __s, false, {}); mtSyncPositions();');
ok(A("DB.positions.filter((p) => p.sym === 'MSFT').length") === 1 && A("DB.positions.filter((p) => p.sym === 'KO').length") === 1, 'אחרי שני שחזורים + סנכרון עסקאות — MSFT ו־KO פעם אחת');

// --- 9. המפתח של הגיבוי — לכל חשבון (הפרדת חשבונות v313) ---
ok(A('ACCOUNT_KEYS').includes('pwa_pfbk_v1'), 'pwa_pfbk_v1 ב־ACCOUNT_KEYS');

console.log('# ' + n + ' בדיקות עברו');
