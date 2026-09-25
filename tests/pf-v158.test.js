// pf-v158.test.js — מצב ידני: TWR מהעסקאות (בדולרים, כמו IBKR), השוואת מדדים, וכרטיס "ביצועי התיק".
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const ret = fs.readFileSync(path.join(root, 'returns.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const near = (a, b, e) => Math.abs(a - b) <= (e || 1e-9);
function grab(code, name) {
  const i = code.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('missing ' + name);
  let d = 0, j = code.indexOf('{', i);
  for (let k = j; k < code.length; k++) { if (code[k] === '{') d++; else if (code[k] === '}' && --d === 0) return code.slice(i, k + 1); }
}
const names = ['symCur', 'nativeToUSD', 'mtNorm', 'mtSorted', 'mtPosition', 'closeOnOrBefore', 'addDaysISO',
  'manualTwrRows', 'holdingsUsdRows', 'manualPerfUSD'];
const f = new Function('state', names.map((x) => grab(src, x)).join('\n') + grab(ret, 'rXirr') +
  'return { manualTwrRows, holdingsUsdRows, manualPerfUSD };')({ fx: 3.5 });
const last = (rows) => rows[rows.length - 1].value / rows[0].value - 1;

// היסטוריה: מניה A עולה 1% ליום, B יורדת 0.5% ליום
const days = ['2026-01-02', '2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09'];
const A = days.map((d, i) => ({ date: d, close: 100 * Math.pow(1.01, i) }));
const B = days.map((d, i) => ({ date: d, close: 50 * Math.pow(0.995, i) }));
const T = days.map((d, i) => ({ date: d, close: 10 + i })); // ת"א, בשקלים
const H = { A: A, B: B, 'X.TA': T };
const histOf = (s) => H[s];
const fxOf = () => 4;

// 1. קנה והחזק — TWR = תשואת המניה ממחיר הקנייה
let r = f.manualTwrRows([{ date: '2026-01-05', sym: 'A', side: 'BUY', qty: 10, price: 101 }], histOf, fxOf);
ok(near(last(r), A[5].close / 101 - 1), 'קנה והחזק = תשואת המניה ממחיר הקנייה');
ok(r[0].date === '2026-01-02' && r[0].value === 100, 'המדד מתחיל ב־100 ביום שלפני העסקה הראשונה');

// 2. קנייה נוספת בסגירה — בלי קפיצה (הכסף החדש לא נספר כרווח)
r = f.manualTwrRows([
  { date: '2026-01-05', sym: 'A', side: 'BUY', qty: 10, price: A[1].close },
  { date: '2026-01-07', sym: 'A', side: 'BUY', qty: 50, price: A[3].close },
], histOf, fxOf);
ok(near(last(r), A[5].close / A[1].close - 1), 'קנייה נוספת בסגירה לא משנה את התשואה');

// 3. מכירה חלקית בסגירה — לא משנה
r = f.manualTwrRows([
  { date: '2026-01-05', sym: 'A', side: 'BUY', qty: 10, price: A[1].close },
  { date: '2026-01-07', sym: 'A', side: 'SELL', qty: 6, price: A[3].close },
], histOf, fxOf);
ok(near(last(r), A[5].close / A[1].close - 1), 'מכירה חלקית בסגירה לא משנה את התשואה');

// 4. מכירה מלאה ואז כלום — התשואה נעצרת; קנייה חדשה ממשיכה
r = f.manualTwrRows([
  { date: '2026-01-05', sym: 'A', side: 'BUY', qty: 10, price: A[1].close },
  { date: '2026-01-06', sym: 'A', side: 'SELL', qty: 10, price: A[2].close },
  { date: '2026-01-08', sym: 'B', side: 'BUY', qty: 10, price: B[4].close },
], histOf, fxOf);
ok(near(last(r), (A[2].close / A[1].close) * (B[5].close / B[4].close) - 1), 'תיק ריק באמצע: תשואות משורשרות, בלי חלוקה באפס');

// 5. שתי מניות — ממוצע משוקלל לפי שווי
r = f.manualTwrRows([
  { date: '2026-01-05', sym: 'A', side: 'BUY', qty: 10, price: A[1].close },
  { date: '2026-01-05', sym: 'B', side: 'BUY', qty: 20, price: B[1].close },
], histOf, fxOf);
const v0 = 10 * A[1].close + 20 * B[1].close, v1 = 10 * A[5].close + 20 * B[5].close;
ok(near(last(r), v1 / v0 - 1), 'שתי מניות שנקנו יחד = יחס השווי');

// 5ב. סכום גדול לתיק קטן, קנייה באמצע היום — בלי "פיצוץ": תשואת היום = תשואת המניה
r = f.manualTwrRows([
  { date: '2026-01-05', sym: 'A', side: 'BUY', qty: 1, price: A[1].close },
  { date: '2026-01-07', sym: 'A', side: 'BUY', qty: 1000, price: (A[2].close + A[3].close) / 2 },
], histOf, fxOf);
ok(near(last(r), A[5].close / A[1].close - 1, 1e-12), 'קנייה ענקית באמצע היום: התשואה = של המניה (תת־תקופות)');

// 5ג. מניה אחרת שלא נסחרה היום — התנועה שלה לא "נמהלת" בכסף החדש (קנייה בסגירה)
r = f.manualTwrRows([
  { date: '2026-01-05', sym: 'A', side: 'BUY', qty: 10, price: A[1].close },
  { date: '2026-01-07', sym: 'B', side: 'BUY', qty: 500, price: B[3].close },
], histOf, fxOf);
ok(near(last(r), (A[3].close / A[1].close) * ((10 * A[5].close + 500 * B[5].close) / (10 * A[3].close + 500 * B[3].close)) - 1, 1e-12),
  'קנייה של מניה אחרת בסגירה: המניה הקיימת מקבלת את כל התנועה של היום');

// 6. עמלה מקטינה את התשואה
r = f.manualTwrRows([{ date: '2026-01-05', sym: 'A', side: 'BUY', qty: 10, price: A[1].close, fee: 10 }], histOf, fxOf);
ok(near(last(r), 10 * A[5].close / (10 * A[1].close + 10) - 1), 'עמלה נכללת (כמו IBKR)');

// 7. מניה ישראלית — בדולרים לפי השער
r = f.manualTwrRows([{ date: '2026-01-05', sym: 'X.TA', side: 'BUY', qty: 100, price: 11 }], histOf, fxOf);
ok(near(last(r), 15 / 11 - 1), 'ת"א: שקלים → דולרים בשער של היום');
ok(f.manualTwrRows([{ date: '2026-01-05', sym: 'X.TA', side: 'BUY', qty: 1, price: 11 }], histOf, () => null) === null, 'בלי שער — null (לא ממציאים)');
ok(f.manualTwrRows([], histOf, fxOf) === null, 'בלי עסקאות — null');
ok(f.manualTwrRows([{ date: '2026-01-05', sym: 'Z', side: 'BUY', qty: 1, price: 1 }], () => [], fxOf) === null, 'בלי היסטוריית מחיר — null');

// 8. אחזקות נוכחיות (בלי עסקאות) — מתחיל כשיש מחיר לכולן
const H2 = { A: A, C: A.slice(2) };
const hr = f.holdingsUsdRows([{ sym: 'A', shares: 1 }, { sym: 'C', shares: 2 }], (s) => H2[s], fxOf);
ok(hr[0].date === '2026-01-06' && hr.length === 4, 'אחזקות: מתחיל מהיום הראשון שיש מחיר לכל המניות (בלי קפיצה מלאכותית)');

// 9. ביצועים: רווח, עמלות, XIRR
const yr = [{ date: '2025-01-02', close: 100 }, { date: '2026-01-02', close: 110 }];
const mp = f.manualPerfUSD([{ sym: 'Q', shares: 10, avg: 100, fromTrades: true }, { sym: 'AV', shares: 2, avg: 50 }],
  [{ date: '2025-01-02', sym: 'Q', side: 'BUY', qty: 10, price: 100, fee: 0 }],
  { Q: { close: 110 }, AV: { close: 60 } }, 3.5, (s) => (s === 'Q' ? yr : []), fxOf, '2026-01-02');
ok(near(mp.twr, 10, 1e-9), 'TWR שנה: 10%');
ok(near(mp.xirr, 10, 0.02), 'XIRR שנה: ~10% (' + (mp.xirr === null ? 'null' : mp.xirr.toFixed(3)) + ')');
ok(near(mp.unrealized, 100 + 20) && near(mp.gain, 120) && mp.avgOnly === 1, 'רווח לא־ממומש: עסקאות + לפי ממוצע');
const mp2 = f.manualPerfUSD([], [
  { date: '2025-01-02', sym: 'Q', side: 'BUY', qty: 10, price: 100, fee: 5 },
  { date: '2025-06-02', sym: 'Q', side: 'SELL', qty: 10, price: 120, fee: 5 },
], {}, 3.5, null, fxOf, '2026-01-02');
ok(near(mp2.realized, 1200 - 5 - 1005) && near(mp2.fees, 10), 'ממומש ועמלות');

// חיווט
ok(/srcKind === 'trades' \|\| srcKind === 'holdings'/.test(src), 'השוואת מדדים גם במצב ידני');
ok(/const mr = tr\.length \? manualTwrRows\(tr, manualHistOf/.test(src), 'הגרף במצב ידני: TWR מהעסקאות');
ok(/function paintManualHead\(\)/.test(src) && /paintManualHead\(\);\n  \}/.test(src), 'כותרת התשואה במצב ידני = TWR');
ok(/id="ibkrPerfTitleEl"/.test(html) && /perfTitleManual: 'ביצועי התיק'/.test(src) && /perfTitleManual: 'Portfolio Performance'/.test(src), 'כרטיס ביצועים גם במצב ידני');
ok(/manualHistOf\(sym\) \{ return stockChartRows\(/.test(src), 'כולל את המחיר של היום');
console.log('\n' + n + ' בדיקות עברו');
