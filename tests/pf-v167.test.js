// pf-v167.test.js — שינוי יומי ביום בלי מסחר (חג/סופ"ש/לפני פתיחה): לפי תאריך המסחר האחרון (q.mdate),
// לא לפי "היום" — אחרת הסגירה של אתמול נחשבת "הקודמת" והשינוי יוצא 0.00%.
// + זהויות החשבון בכרטיס: מהקנייה % = רווח / עלות (לא / שווי), ובמניה בשקלים הרווח בדולרים באותו שער של השווי.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const sb = { localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, document: { addEventListener() {}, getElementById: () => null, querySelectorAll: () => [], querySelector: () => null, createElement: () => ({ classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {} }) }, window: {}, navigator: {}, location: {}, AbortController, fetch: () => Promise.reject(1), setTimeout, clearTimeout, console };
vm.createContext(sb); vm.runInContext(src, sb);
const R = (k) => vm.runInContext(k, sb);
R('POSITIONS.push({ sym: "ESLT.TA", shares: 35, avg: 422.3429 }, { sym: "NVDA", shares: 103, avg: 20.5 })');
R('state.fx = 3.04536887; state.hist = { "ESLT.TA": [{ date: "2026-09-22", close: 2200 }, { date: "2026-09-23", close: 2240 }, { date: "2026-09-24", close: 2262.1 }], NVDA: [{ date: "2026-09-24", close: 224.58 }] };');
// ערב חג: ת"א לא נסחרה היום; הציטוט = סגירת אתמול, Yahoo מחזיר previousClose = אותו מחיר
R('state.quotes["ESLT.TA"] = { close: 2262.1, prev: 2262.1, date: "2026-09-25", mdate: "2026-09-24" };');
const e = R('metrics("ESLT.TA")');
ok(Math.abs(e.dayChg - (2262.1 / 2240 - 1) * 100) < 1e-9, 'יום בלי מסחר: השינוי של יום המסחר האחרון (+0.99%), לא 0.00%');
R('state.quotes["ESLT.TA"].mdate = null;');
ok(Math.abs(R('metrics("ESLT.TA")').dayChg) < 1e-9, 'בלי תאריך בורסה — ההתנהגות הקודמת (לפי היום)');
R('state.quotes.NVDA = { close: 225.01, prev: 224.58, date: "2026-09-25", mdate: "2026-09-25" };');
const v = R('metrics("NVDA")');
ok(Math.abs(v.dayChg - (225.01 / 224.58 - 1) * 100) < 1e-9, 'יום מסחר רגיל — מול הסגירה של אתמול, כמו קודם');
// זהויות החשבון (המספרים מהצילום)
const gp = R('gainPctOf')(R('POSITIONS[1]'), 225.01);
ok(Math.round(v.value) === 23176 && Math.abs(v.gl - 21064.53) < 0.01 && Math.abs(gp - 997.61) < 0.01, 'NVDA: שווי $23,176, רווח $21,064, מהקנייה +997.61%');
ok(Math.abs(v.gl / (v.value - v.gl) * 100 - gp) < 1e-9, 'מהקנייה % = רווח ÷ עלות (לא ÷ שווי)');
R('state.quotes["ESLT.TA"].mdate = "2026-09-24";');
const e2 = R('metrics("ESLT.TA")'); const gp2 = R('gainPctOf')(R('POSITIONS[0]'), 2262.1);
ok(Math.round(e2.value) === 25998 && Math.round(e2.gl) === 21144 && Math.abs(gp2 - 435.61) < 0.01, 'ESLT.TA: שווי $25,998, רווח $21,144, מהקנייה +435.61%');
ok(Math.abs(e2.gl / (e2.value - e2.gl) * 100 - gp2) < 1e-9, 'מניה בשקלים: אותה זהות — הרווח בדולרים והאחוז באותו שער');
console.log('\n' + n + ' בדיקות עברו');
