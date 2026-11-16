// ackman-demo.test.js — תיק הדמו = תיק המניות של קרנות פרשינג סקוור (ביל אקמן), מהדיווחים ל־SEC (16/11/2026).
// השרתון בונה את הספר (lib/ackman*.js, נבדק ב־ackman*.test.js); כאן — הצד של האפליקציה: ההמרה לדוח, "מה השתנה",
// רשימת המעקב, הסיפור, ציר הזמן, הבידוד מהחשבון האמיתי, וכללי התצוגה של מספרים גדולים. נתונים סינתטיים בלבד.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const store = {};
const sb = { localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem(k, v) { store[k] = String(v); }, removeItem(k) { delete store[k]; } },
  document: { addEventListener() {}, getElementById: () => null, querySelectorAll: () => [], querySelector: () => null, createElement: () => ({ classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {} }) },
  window: {}, navigator: {}, location: {}, AbortController, fetch: () => Promise.reject(new Error('no net')), setTimeout, clearTimeout, console };
vm.createContext(sb); vm.runInContext(src, sb);
const A = (k) => vm.runInContext(k, sb);
const strip = (s) => String(s).replace(/[⁦-⁩]/g, '');

// --- ספר סינתטי (הצורה של השרתון: book.ackman = {quarters: [{period, filed, h: [sym, shares, value], d: [sym, before, after]}], …}) ---
const Qs = [
  { period: '2025-09-30', filed: '2025-11-14', h: [['AAA', 1000, 9e8], ['BBB', 500, 3e8], ['CCC', 200, 1e8], ['SEG-RT', 10, 1e3]], d: [] },
  { period: '2025-12-31', filed: '2026-02-17', h: [['AAA', 1000, 9.5e8], ['BBB', 600, 3.6e8], ['DDD', 300, 2e8]],
    d: [['BBB', 500, 600], ['CCC', 200, 0], ['DDD', 0, 300], ['SEG-RT', 10, 0]] },
  { period: '2026-03-31', filed: '2026-05-15', h: [['AAA', 1010, 1e9], ['BBB', 400, 2.4e8], ['EEE', 50, 5e8]],
    d: [['AAA', 1000, 1010], ['BBB', 600, 400], ['DDD', 300, 0], ['EEE', 0, 50]] },
];
const ack = { quarters: Qs, symbols: { AAA: 'Alpha Co', BBB: 'Beta', EEE: 'Epsilon' }, realizedCa: [{ date: '2025-01-02', sym: 'OLD-2014', realized: 2e6 }],
  events: [{ kind: '13F', filed: '2026-05-15' }, { kind: '13G', filed: '2026-06-02', sym: 'AAA', pct: 5.1 }, { kind: '13D', filed: '2026-07-21', sym: 'BBB', pct: 9.9 }, { kind: '13D', filed: '2026-04-01', sym: 'BBB' }] };
const book = {
  meta: { accountId: 'PERSHING-13F', fromDate: '2005-12-31', toDate: '2026-11-13', baseCurrency: 'USD', demo: 'ackman' },
  trades: [{ symbol: 'CCC', realized: 5e7 }, { symbol: 'DDD', realized: -3e7 }, { symbol: 'AAA', realized: 0 }],
  positions: [{ symbol: 'AAA', unrealized: 4e8 }, { symbol: 'BBB', unrealized: -2e6 }, { symbol: 'EEE', unrealized: 1e7 }],
  cashTransactions: [{ type: 'Deposits/Withdrawals', amount: 1e9 }, { type: 'Dividends', amount: 1e7 }, { type: 'Withholding Tax', amount: -1.5e6 }],
  navHistory: [{ fromDate: '2005-12-31', toDate: '2015-12-31', startingValue: 1, endingValue: 2, twr: 100, flows: 5 }, { fromDate: '2015-12-31', toDate: '2026-11-13', startingValue: 2, endingValue: 6, twr: 200 }],
  navDaily: [{ date: '2026-11-13', nav: 6 }], ackman: ack,
};

// --- 1. ההמרה לדוח בצורת IBKR ---
const data = A('ackToData')(book);
ok(data.meta.demo === 'ackman' && data.meta.kind === 'flex' && data.meta.baseCurrency === 'USD' && data.meta.title === 'Pershing Square', 'הדוח: מסומן דמו של אקמן, בדולרים, בצורת Flex');
ok(data.navPeriods.length === 2 && data.navPeriods[0].netFlows === 5 && data.navPeriods[1].netFlows === 0, 'תקופות NAV: התזרים נשמר, וחסר = 0');
ok(data.positionsAsOf === '20261113' && data.latestChunkOk === true && data.ackman === ack, 'תאריך האחזקות, והמידע של אקמן עובר כמו שהוא');
ok(A('ackToData')(null).trades.length === 0 && A('ackToData')({}).meta.demo === 'ackman', 'ספר ריק — לא נופל');

// --- 2. מה השתנה ברבעון ---
const ch = A('ackQDiff')(Qs[2]);
ok(ch.map((c) => c.k + ':' + c.sym).join() === 'new:EEE,exit:DDD,cut:BBB', 'חדשות, יציאות, ואז שינויים — והגדלה של 1% (AAA) לא נחשבת');
ok(Math.abs(ch[2].pct - (-1 / 3)) < 1e-9 && ch[0].to === 50, 'האחוז של ההקטנה והכמות של החדשה');
const ch1 = A('ackQDiff')(Qs[1]);
ok(ch1[0].k === 'new' && ch1[0].sym === 'DDD' && ch1.filter((c) => c.k === 'exit').map((c) => c.sym).join() === 'CCC,SEG-RT', 'יציאות לפי השווי');
ok(A('ackQDiff')(null).length === 0 && A('ackQDiff')({}).length === 0, 'בלי נתונים — רשימה ריקה');

// --- 3. רשימת המעקב: היציאות האחרונות (בלי זכויות, בלי מה שמוחזק היום) ---
const ex = A('ackRecentExits')(ack);
ok(ex.map((e) => e.sym + '@' + e.period).join() === 'DDD@2026-03-31,CCC@2025-12-31', 'יציאות — מהחדשה לישנה, עם הרבעון');
ok(!ex.some((e) => e.sym === 'SEG-RT'), 'זכויות (‎-RT‎) לא נכנסות לרשימת המעקב');
ok(A('ackSkip')('SEG-RT') && A('ackSkip')('CUSIP-123') && A('ackSkip')('ABC-WS') && !A('ackSkip')('BRK-B') && !A('ackSkip')('AGN-2015'), 'מה לא נחשב מניה ברשימות');

// --- 4. הסיפור במספרים ---
data.navPeriods = book.navHistory.map((r) => ({ twr: r.twr }));
const st = A('ackStory')(data);
ok(Math.abs(st.total - 5) < 1e-9, 'תשואה מצטברת = מכפלת ה־TWR (פי 2 ואז פי 3 = פי 6)');
ok(st.cagr > 0.088 && st.cagr < 0.091, 'תשואה שנתית ממוצעת לפי השנים (' + (st.cagr * 100).toFixed(2) + '%)');
ok(st.stocks === 5, 'מניות לאורך הדרך — בלי זכויות');
ok(st.best.map((e) => e[0]).join() === 'AAA,CCC,EEE' && st.worst.map((e) => e[0]).join() === 'DDD,BBB', 'הכי הרוויחו / הכי הפסידו (רווח ממומש + לא ממומש)');
ok(!st.best.concat(st.worst).some((e) => /-\d{4}$/.test(e[0])) && st.best.length === 3, 'סימבול שהוחזר לשימוש (‎-2014‎) מאוחד לסימבול');
ok(st.div === 1e7 && st.wht === -1.5e6, 'דיבידנדים ומס במקור');

// --- 5. ציר הזמן ---
const tl = A('ackTimeline')(ack);
ok(tl.map((e) => e.y).join() === '2026,2025' && tl[0].inn.join() === 'EEE' && tl[0].out.join() === 'DDD', 'לכל שנה — נכנסו ויצאו, מהחדשה');
ok(tl[1].inn.join() === 'AAA,BBB,CCC,DDD' && tl[1].out.join() === 'CCC', 'השנה הראשונה: כל התיק נכנס; בלי זכויות');

// --- 6. הדיווח האחרון ומה שאחריו ---
const since = A('ackSinceLast')(ack);
ok(since.map((e) => e.kind + e.filed).join() === '13D2026-07-21,13G2026-06-02', 'מאז ה־13F: רק דיווחים שהוגשו אחריו, מהחדש');
ok(A('ackChangeKey')(ack) === '13D|2026-07-21', 'מפתח "חדש": סוג + תאריך הדיווח האחרון');
ok(A('ackChangeKey')({ quarters: Qs }) === '13F|2026-05-15' && A('ackChangeKey')({}) === '', 'בלי אירועים — ה־13F האחרון');

// --- 7. בידוד: הדמו לא נוגע בחשבון ה־IBKR האמיתי ---
ok(A('ACCOUNT_KEYS').includes('pwa_demo_ibkr_v1'), 'מפתח הדמו ברשימת המפתחות של החשבון (נמחק ביציאה/החלפת משתמש)');
store.pwa_ibkr_v1 = JSON.stringify({ token: 'x' });
vm.runInContext('DB.demo = "ackman"', sb);
ok(A('ibkrCfgKey')() === 'pwa_demo_ibkr_v1' && A('isAckmanDemo')() && A('isDemoMode')(), 'במצב הדמו — הדוח במפתח נפרד');
A('ibkrSaveCfg')({ ackAt: 1 });
ok(JSON.parse(store.pwa_demo_ibkr_v1).ackAt === 1 && JSON.parse(store.pwa_ibkr_v1).token === 'x' && !('ackAt' in JSON.parse(store.pwa_ibkr_v1)), 'שמירה בדמו — רק במפתח הדמו; החשבון האמיתי לא השתנה');
vm.runInContext('DB.demo = false', sb);
ok(A('ibkrCfgKey')() === 'pwa_ibkr_v1' && A('ibkrCfg')().token === 'x', 'מחוץ לדמו — החשבון האמיתי');
ok(/localStorage\.removeItem\(LS_DEMO_IBKR\)/.test(src) && /if \(isDemoMode\(\)\) \{ ackRefresh\(false\); return; \}/.test(src), 'יציאה מנקה את מפתח הדמו; הסנכרון ברקע בדמו = עדכון מהשרתון');
ok(/ui\.fail\(err === 'not_ready' \? t\('ackNotReady'\) : t\('demoFail'\)\)/.test(src), 'השרתון עוד לא בנה את הספר — הודעה משלו');

// --- 8. כללי התצוגה של מספרים גדולים (16/11/2026) ---
const U = A('fmtUSD');
ok(U(950312.4) === '$950,312' && U(1e6) === '$1.00M' && U(1234567) === '$1.23M' && U(15.3e6) === '$15.3M' && U(153.4e6) === '$153M', 'סכום: עד מיליון מלא, ממיליון — 3 ספרות משמעותיות');
ok(U(1.4e9) === '$1.40B' && U(20.9e9) === '$20.9B' && U(999.6e6) === '$1.00B' && U(1.2e12) === '$1.20T', 'מיליארדים וטריליונים — בלי "1000M"');
ok(U(-1234.4) === '$-1,234' && U(-2.5e9) === '$-2.50B' && A('fmtILS')(3.7e9) === '₪3.70B', 'מינוס ושקלים באותו כלל');
ok(strip(A('fmtSignedMoney')(16.54e9, 'USD')) === '+$16.5B' && strip(A('fmtSignedMoney')(-53.1e6, 'USD')) === '−$53.1M', 'רווח/הפסד עם סימן');
const P = (v) => strip(A('fmtPct')(v, true));
ok(P(12.345) === '+12.35%' && P(-0.5) === '−0.50%' && P(657.83) === '+657.8%' && P(1234.5) === '+1,235%' && P(12345) === '+12.3K%', 'אחוז: 2 ספרות, מ־100% — אחת, מ־1,000% — בלי, מ־10,000% — מקוצר');
ok(strip(A('gainPctTxt')(103.6)) === '+104%' && strip(A('gainPctTxt')(-28.64)) === '−28.6%', 'אחוז עם ספרה אחת — מ־100% בלי');
ok(A('fmtQty')(6206730) === '6.21M' && A('fmtQty')(999999) === '999,999' && A('fmtQty')(12.5) === '12.5' && A('txQty')(34326200) === '34.3M' && A('txQty')(10) === '10', 'כמות מניות: מלאה עד מיליון, אחר כך מקוצרת');
ok(A('numTight')(453412) === '453K' && A('numTight')(45230) === '45,230' && A('numTight')(1.98e9) === '1.98B', 'אריח צר: מ־100 אלף — "453K"');
ok(A('fmtShortMoney')(20.9e9, 'USD') === '$20.9B' && A('fmtShortMoney')(13200, 'USD') === '$13K', 'בועות העוגה: מיליארדים ב־B (היה "20900M")');
ok(A('fmtTradeMoney')(1234.5, 'USD') === '$1,234.50' && A('fmtTradeMoney')(49.3e6, 'USD') === '$49.3M', 'סכום עסקה: אגורות עד מיליון');
ok(strip(A('ackMoney')(2.4e9, true)) === '+$2.40B' && strip(A('ackMoney')(-944e6, true)) === '−$944M' && strip(A('ackShares')(3196062)) === '3.20M', 'הגיליון של אקמן — אותם כללים');

// --- 9. מה שנשאר מהדמו הקודם וכללי (היסטוריה, מדד ת"א) ---
ok(/soldTo\[sym\]\) \{ restoreHistRows\(sym, rec\); syms\.delete\(sym\); \}/.test(src), 'מניה שנמכרה: לא נמשכת מחדש כל יום אם המטמון מכסה עד המכירה');
ok(/POSITIONS\.concat\(wlAllItems\(\), DB\.manualTrades \|\| \[\]\)/.test(src), 'יציאה מהדמו: מנקה גם את ההיסטוריה של מה שנמכר');
const slim = A('histSlimForDemo')([{ date: '2015-01-02', close: 1, open: 1 }, { date: '2026-09-01', close: 12.345678, open: 1 }]);
ok(slim.length === 1 && Object.keys(slim[0]).join() === 'date,close', 'היסטוריה בדמו: 7 שנים, תאריך + סגירה');
ok(/for \(let i = 0; i < \w+\.length; i \+= 40\) parts\.push/.test(src), 'עד 40 סימבולים לבקשה לשרתון (מגבלת השרתון)');
ok(A('isTaseIndex')('207.TA') && !A('isTaseIndex')('POLI.TA') && !A('isTaseIndex')('1233170.TA') && !A('isTaseIndex')('AAPL'), 'מדד ת"א = סימבול מספרי קצר');
vm.runInContext('state.lang = "he"', sb);
ok(A('fmtAg')(3265.58, '207.TA') === '⁧3,265.58 נק׳⁩' && A('fmtAg')(78.3, 'POLI.TA') === '⁧7,830 אג׳⁩', 'מדד בנקודות ("3,265.58 נק׳"), מניה באגורות');
ok(A('pxInFactor')('207.TA') === 1 && A('pxInFactor')('POLI.TA') === 100, 'הזנת מחיר למדד — בנקודות');
console.log('\n' + n + ' בדיקות עברו');
