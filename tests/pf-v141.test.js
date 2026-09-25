// pf-v141.test.js — אחזקות ידניות: לפי מחיר ממוצע או לפי עסקאות, נכללות גם במצב IBKR.
// דיווח (25/09/2026): "הוספתי GOOG ידנית — השווי, הרווח והתשואות לא מתעדכנים".
// שורשים: במצב IBKR השווי/רווח/תשואה באו רק מהדוח, וכל סנכרון החליף את כל רשימת
// המניות (GOOG הייתה נמחקת). נתונים סינתטיים בלבד.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const retSrc = fs.readFileSync(path.join(root, 'returns.js'), 'utf8');

let n = 0;
function ok(cond, name) {
  n++;
  if (!cond) { console.error('FAIL - ' + name); process.exit(1); }
  console.log('ok - ' + name);
}
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-9);

const store = {};
const sb = {
  localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
  document: {
    hidden: false, activeElement: null, addEventListener() {}, getElementById: () => null,
    querySelectorAll: () => [], querySelector: () => null,
    createElement: () => ({ classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {}, style: {} }),
  },
  window: {}, navigator: {}, location: {},
  AbortController, fetch: () => Promise.reject(new Error('no net')),
  setTimeout: () => 0, clearTimeout() {}, console: { log() {}, warn() {}, error: console.error },
};
vm.createContext(sb);
vm.runInContext(retSrc, sb);
vm.runInContext(src, sb);
const A = (k) => vm.runInContext(k, sb);
const run = (c) => vm.runInContext(c, sb);

const T = (id, date, sym, side, qty, price, fee) => ({ id, date, sym, side, qty, price, fee: fee || 0 });

// --- 1. מצב אחזקה מעסקאות — עלות ממוצעת ---
const pos = A('mtPosition');
const tr1 = [T('a', '2026-01-10', 'XYZ', 'BUY', 10, 100, 1), T('b', '2026-02-10', 'XYZ', 'BUY', 10, 120, 1), T('c', '2026-03-10', 'XYZ', 'SELL', 5, 150, 1)];
const p1 = pos(tr1, 'XYZ');
ok(p1.shares === 15, 'כמות: 10 + 10 − 5 = 15');
ok(near(p1.avg, 2202 / 20), 'ממוצע אחרי מכירה = ממוצע לפני (עלות ממוצעת): 2202/20');
ok(near(p1.realized, 5 * 150 - 1 - 5 * (2202 / 20)), 'רווח ממומש = תמורה − עמלה − עלות ממוצעת × כמות');
ok(p1.firstDate === '2026-01-10', 'תאריך ראשון');
ok(pos(tr1, 'XYZ', '2026-02-01').shares === 10, 'מצב בתאריך: רק עסקאות עד אז');
ok(pos(tr1.concat([T('d', '2026-04-01', 'XYZ', 'SELL', 15, 90)]), 'XYZ').shares === 0, 'מכירה של הכל → 0 מניות, עלות 0');

// --- 2. ולידציה ---
const val = A('mtValidate');
ok(val(tr1, T('x', '2099-01-01', 'XYZ', 'BUY', 1, 1), null, '2026-09-25') !== null, 'תאריך עתידי → שגיאה');
ok(val(tr1, T('x', '2026-05-01', 'XYZ', 'BUY', 0, 1), null, '2026-09-25') !== null, 'כמות 0 → שגיאה');
ok(val(tr1, T('x', '2026-05-01', 'XYZ', 'BUY', 1, 0), null, '2026-09-25') !== null, 'מחיר 0 → שגיאה');
ok(val(tr1, T('x', '2026-05-01', 'XYZ', 'SELL', 16, 1), null, '2026-09-25') !== null, 'מכירה של יותר ממה שמוחזק → שגיאה');
ok(val(tr1, T('x', '2026-05-01', 'XYZ', 'SELL', 15, 1), null, '2026-09-25') === null, 'מכירה של בדיוק מה שמוחזק → תקין');
ok(val(tr1, T('x', '2026-01-05', 'XYZ', 'SELL', 1, 1), null, '2026-09-25') !== null, 'מכירה לפני הקנייה הראשונה → שגיאה');
const tr15 = tr1.slice(0, 2).concat([T('c', '2026-03-10', 'XYZ', 'SELL', 15, 150)]);
ok(val(tr15, T('a', '2026-01-10', 'XYZ', 'BUY', 4, 100), 'a', '2026-09-25') !== null, 'עריכה שמקטינה קנייה מתחת למכירה מאוחרת (4+10 < 15) → שגיאה');
ok(val(tr1, T('a', '2026-01-10', 'XYZ', 'BUY', 12, 100), 'a', '2026-09-25') === null, 'עריכה תקינה (מחליפה, לא מוסיפה)');
ok(A('mtOversold')(tr1.filter((x) => x.id !== 'a' && x.id !== 'b'), 'XYZ') === true, 'מחיקת הקניות → מכירה יתומה (חסימת מחיקה)');
// באותו יום: קנייה לפני מכירה
ok(val([T('a', '2026-01-10', 'Q', 'BUY', 5, 10)], T('b', '2026-01-10', 'Q', 'SELL', 5, 11), null, '2026-09-25') === null, 'קנייה ומכירה באותו יום — תקין');

// --- 3. תזרימים ---
const fl = A('mtFlowsByDate')(tr1);
ok(near(fl['2026-01-10'], 1001) && near(fl['2026-03-10'], -(750 - 1)), 'תזרים: קנייה +עלות, מכירה −תמורה נטו');

// --- 4. סנכרון פוזיציות מהעסקאות ---
run(`POSITIONS.length = 0;
  POSITIONS.push({ sym: 'IBK', name: 'IBK', shares: 5, avg: 50 });                 // IBKR
  POSITIONS.push({ sym: 'AVG', name: 'AVG', shares: 3, avg: 20, src: 'manual' });  // ידני לפי ממוצע
  DB.manualTrades = [
    { id: '1', date: '2026-01-02', sym: 'TRD', side: 'BUY', qty: 4, price: 10, fee: 0 },
    { id: '2', date: '2026-01-02', sym: 'IBK', side: 'BUY', qty: 1, price: 1, fee: 0 },
    { id: '3', date: '2026-01-02', sym: 'GONE', side: 'BUY', qty: 2, price: 10, fee: 0 },
    { id: '4', date: '2026-02-02', sym: 'GONE', side: 'SELL', qty: 2, price: 15, fee: 0 },
  ];
  mtSyncPositions();`);
const syms = run('POSITIONS.map(p => p.sym + ":" + p.shares + (p.fromTrades ? "T" : "") + (p.src || "")).join(",")');
ok(syms.includes('TRD:4Tmanual'), 'מניה לפי עסקאות נוצרת (fromTrades, ידני)');
ok(syms.includes('IBK:5') && !syms.includes('IBK:6'), 'פוזיציית IBKR לא מושפעת מעסקה ידנית (מוצללת)');
ok(syms.includes('AVG:3manual'), 'ידני לפי ממוצע לא מושפע');
ok(!syms.includes('GONE'), 'מניה שנמכרה כולה יורדת מהרשימה');
ok(A('mtShadowed')('IBK') === true && A('mtShadowed')('TRD') === false, 'הצללה: IBK כן, TRD לא');
ok(A('mtActiveTrades')().map((x) => x.id).join(',') === '1,3,4', 'עסקאות פעילות: בלי המוצללת');
run(`DB.manualTrades = DB.manualTrades.filter(x => x.sym !== 'TRD'); mtSyncPositions();`);
ok(!run('POSITIONS.some(p => p.sym === "TRD")'), 'כל העסקאות של מניה נמחקו → המניה יורדת');

// --- 5. שווי ורווח ידניים ---
const tot = A('manualTotalsUSD')(
  [{ sym: 'AVG', shares: 3, avg: 20, src: 'manual' }, { sym: 'TRD', shares: 4, avg: 10, src: 'manual', fromTrades: true }, { sym: 'IBK', shares: 5, avg: 50 }],
  [T('1', '2026-01-02', 'TRD', 'BUY', 4, 10), T('3', '2026-01-02', 'GONE', 'BUY', 2, 10), T('4', '2026-02-02', 'GONE', 'SELL', 2, 15)],
  { AVG: { close: 25 }, TRD: { close: 12 }, IBK: { close: 60 } });
ok(near(tot.value, 3 * 25 + 4 * 12), 'שווי ידני: ממוצע + עסקאות, בלי IBKR');
ok(near(tot.gain, (25 - 20) * 3 + (48 - 40) + (30 - 20)), 'רווח ידני: ממוצע + לא־ממומש + ממומש של מניה שנסגרה');
ok(tot.avgOnly === 1, 'ספירת מניות לפי ממוצע (לא בתשואה לאורך זמן)');
const tot2 = A('manualTotalsUSD')([{ sym: 'AVG', shares: 3, avg: 20, src: 'manual' }], [], {});
ok(tot2.missing === 1 && tot2.value === 0, 'בלי מחיר — לא נספר, מסומן חסר');

// --- 6. TWR משולב ---
const rows = A('rowsWithManualTwr');
const nav = [{ date: '2026-03-02', total: 1000 }, { date: '2026-03-03', total: 1000 }, { date: '2026-03-04', total: 1000 }, { date: '2026-03-05', total: 1000 }];
const base = nav.map((d) => ({ date: d.date, value: 100 }));
const hist = { MAN: [{ date: '2026-03-04', close: 10 }, { date: '2026-03-05', close: 11 }] };
const out = rows(base, nav, {}, [T('m1', '2026-03-04', 'MAN', 'BUY', 10, 10)], (s) => hist[s]);
ok(out && out.length === 4, 'סדרה משולבת באורך הימים');
ok(near(out[2].value, 100), 'יום הקנייה: הקנייה היא הפקדה, לא רווח (0%)');
ok(near(out[3].value, 100 * (1110 / 1100)), 'יום אחרי: רווח של המניה הידנית על הסכום (1000+110)/(1000+100)');
ok(out[1] === base[1] || near(out[1].value, 100), 'לפני העסקה הראשונה — הסדרה של IBKR כמו שהיא');
ok(rows(base, nav, {}, [T('m1', '2026-04-01', 'MAN', 'BUY', 1, 10)], (s) => hist[s]) === base, 'עסקה אחרי סוף נתוני IBKR → הסדרה הרשמית בלי שינוי');
ok(rows(base, nav, {}, [T('m1', '2026-01-01', 'MAN', 'BUY', 1, 10)], (s) => hist[s]) === null, 'עסקה לפני תחילת NAV יומי → אי אפשר לשלב (null)');
ok(rows(base, nav, {}, [T('m1', '2026-03-04', 'NOHIST', 'BUY', 1, 10)], () => []) === null, 'בלי היסטוריית מחיר → null (לא ממציאים)');
// מכירה: משיכה, לא הפסד
const out2 = rows(base, nav, {}, [T('m1', '2026-03-04', 'MAN', 'BUY', 10, 10), T('m2', '2026-03-05', 'MAN', 'SELL', 10, 11)], (s) => hist[s]);
ok(near(out2[3].value, 100 * (1110 / 1100)), 'מכירה ביום האחרון: הרווח נשמר, התמורה לא נספרת כהפסד');

// --- 7. סימון GOOG הישנה כידנית במצב IBKR ---
run(`DB.source = 'ibkr';
  ibkrSaveCfg({ data: { positions: [{ symbol: 'IBK', qty: 5, costBasis: 250, markPrice: 60, currency: 'USD', asset: 'STK', levelOfDetail: 'SUMMARY' }] } });
  POSITIONS.length = 0;
  POSITIONS.push({ sym: 'IBK', name: 'IBK', shares: 5, avg: 50 }, { sym: 'GOOG', name: 'GOOG', shares: 2, avg: 150 });`);
ok(A('markManualPositions')() === 1, 'פוזיציה שלא בדוח IBKR מסומנת ידנית');
ok(run('POSITIONS.find(p => p.sym === "GOOG").src') === 'manual' && !run('POSITIONS.find(p => p.sym === "IBK").src'), 'GOOG ידנית, IBK לא');
ok(A('markManualPositions')() === 0, 'אידמפוטנטי');

// --- 8. סנכרון IBKR שומר מניות ידניות ---
run(`renderAll = () => {}; renderIbkrCard = () => {}; flash = () => {};
  DB.manualTrades = [{ id: 't1', date: '2026-01-02', sym: 'TRD', side: 'BUY', qty: 4, price: 10, fee: 0 }];
  mtSyncPositions();
  ibkrFinishImport({ positions: [
    { symbol: 'IBK', qty: 7, costBasis: 350, markPrice: 60, currency: 'USD', asset: 'STK', levelOfDetail: 'SUMMARY' },
    { symbol: 'NEW', qty: 1, costBasis: 10, markPrice: 10, currency: 'USD', asset: 'STK', levelOfDetail: 'SUMMARY' } ],
    cashTransactions: [], cashBalances: [] });`);
const after = run('POSITIONS.map(p => p.sym + ":" + p.shares).sort().join(",")');
ok(after === 'GOOG:2,IBK:7,NEW:1,TRD:4', 'אחרי סנכרון: IBKR מעודכן, GOOG (ממוצע) ו־TRD (עסקאות) נשמרו — ' + after);
// IBKR מתחיל להחזיק מניה ידנית → IBKR גובר, בלי כפילות
run(`ibkrFinishImport({ positions: [
    { symbol: 'IBK', qty: 7, costBasis: 350, markPrice: 60, currency: 'USD', asset: 'STK', levelOfDetail: 'SUMMARY' },
    { symbol: 'TRD', qty: 9, costBasis: 90, markPrice: 10, currency: 'USD', asset: 'STK', levelOfDetail: 'SUMMARY' } ],
    cashTransactions: [], cashBalances: [] });`);
ok(run('POSITIONS.filter(p => p.sym === "TRD").length') === 1 && run('POSITIONS.find(p => p.sym === "TRD").shares') === 9, 'מניה ש־IBKR מחזיק: פוזיציה אחת (IBKR), העסקאות הידניות מוצללות');

// --- 9. ניתוק IBKR לא מוחק ידניות ---
run(`DB.ibkrSnapshot = { positions: [{ sym: 'OLD', name: 'OLD', shares: 1, avg: 1 }], deposits: [], cash: { usd: 0, ils: 0 } };
  POSITIONS.push({ sym: 'MAN2', name: 'MAN2', shares: 1, avg: 1, src: 'manual' });
  ibkrRestoreManual();`);
ok(run('POSITIONS.map(p => p.sym).sort().join(",")').includes('MAN2') && run('POSITIONS.some(p => p.sym === "OLD")'), 'שחזור בניתוק: הצילום + הידניות שנוספו אחריו');

// --- 10. שמירה וענן ---
run(`applyDbData({ positions: [], deposits: [], manualTrades: [{ id: 'z', date: '2026-01-01', sym: 'Z', side: 'BUY', qty: 1, price: 1 }] });`);
ok(run('DB.manualTrades.length') === 1, 'applyDbData מעתיק עסקאות ידניות');
const cloudSrc = fs.readFileSync(path.join(root, 'cloud.js'), 'utf8');
ok(/DB\.manualTrades = clean\.manualTrades/.test(cloudSrc), 'ענן: העסקאות הידניות נטענות');
ok(/if \(!Array\.isArray\(db\.manualTrades\)\) db\.manualTrades = \[\]/.test(src), 'loadDB: מערך עסקאות תמיד קיים');

// --- 11. חיווט ---
ok(/const mt = isIbkrMode\(\) \? manualTotalsUSD\(POSITIONS, mtActiveTrades\(\), state\.quotes(, state\.fx)?\)/.test(src), 'סקירה: שווי/רווח ידניים במצב IBKR');
ok(/ibkrReturnRows\(ibkrData\)/.test(src), 'גרף הביצועים: סדרה משולבת');
ok(/if \(!isIbkrMode\(\) \|\| p\.src === 'manual'\)/.test(src), 'כפתור עריכה גם למניות ידניות במצב IBKR');
ok(/mt\.src|src === 'manual' \? '<span class="src-tag">/.test(src), 'תגית "ידני" בכרטיס המניה');
ok(/concat\(man\.map/.test(src), 'טאב עסקאות: IBKR + ידניות יחד');

const ver = (src.match(/APP_VERSION = '(v\d+)'/) || [])[1];
ok(fs.readFileSync(path.join(root, 'sw.js'), 'utf8').includes('portfolio-pwa-' + ver), 'CACHE_NAME תואם לגרסה');
console.log('\n' + n + ' בדיקות עברו');
