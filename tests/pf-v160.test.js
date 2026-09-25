// pf-v160.test.js — כש־Yahoo חוסם (429): הפסקה הולכת וגדלה במקום הפצצה, השלמת היסטוריה כשהוא חוזר,
// שינוי יומי מהסגירה הקודמת שבציטוט (גם מ־CNBC), ובלי "טוען" לנצח.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
function grab(name) {
  const i = src.indexOf('function ' + name + '(');
  let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); }
}
const gate = new Function('const yahooGate = { until: 0, backoff: 0 };' + ['yahooCooling', 'yahooFailed', 'yahooOk'].map(grab).join('\n') +
  'return { yahooGate, yahooCooling, yahooFailed, yahooOk };')();
const T = 1000000;
gate.yahooFailed(T);
ok(gate.yahooCooling(T + 59000) && !gate.yahooCooling(T + 61000), 'כשל ראשון: הפסקה של דקה');
gate.yahooFailed(T); gate.yahooFailed(T);
ok(gate.yahooGate.backoff === 240000, 'כשלים חוזרים: 1 → 2 → 4 דקות');
for (let i = 0; i < 10; i++) gate.yahooFailed(T);
ok(gate.yahooGate.backoff === 600000, 'תקרה: 10 דקות');
ok(gate.yahooOk() === true && !gate.yahooCooling(T) && gate.yahooOk() === false, 'הצלחה מאפסת ומדווחת "חזר" פעם אחת');

const cnbc = new Function('num', 'todayISO', ['symCur', 'parseCNBCQuotes'].map(grab).join('\n') + 'return parseCNBCQuotes;')(
  (v) => Number(String(v).replace(/,/g, '')) || 0, () => '2026-09-25');
const q = cnbc({ FormattedQuoteResult: { FormattedQuote: [
  { symbol: 'POLI.TA', last: '7,830', previous_day_closing: '7,700' },
  { symbol: 'AAPL', last: '201', change: '-3' },
] } }, '');
ok(q['POLI.TA'].prev === 77 && q['POLI.TA'].close === 78.3, 'CNBC: סגירה קודמת (אגורות → שקלים)');
ok(q.AAPL.prev === 204, 'CNBC: בלי סגירה קודמת — מחושבת מהשינוי');

ok(/if \(dayChg === null && q && q\.prev > 0 && q\.close > 0\) dayChg = \(q\.close - q\.prev\) \/ q\.prev \* 100;/.test(src), 'שינוי יומי גם בלי היסטוריה');
ok(/if \(!yahooCooling\(\)\) \{\s*got = await liveFetch\(syms\);/.test(src) && /else yahooFailed\(\);/.test(src), 'הלולאה החיה לא שואלת את Yahoo בזמן הפסקה');
ok(/if \(yahooOk\(\)\) yahooRecovered\(\)/.test(src) && /delete histNegCache\[sym\]/.test(src), 'Yahoo חזר: משלימים היסטוריות חסרות וגרפים פתוחים');
ok(/if \(symCur\(sym\) !== 'USD'\) return null; \/\/ v160: Stooq/.test(src), 'Stooq רק לארה"ב (לא poli.ta.us)');
ok(/loading\.textContent = t\('histRetryLater'\)/.test(src) && /histRetryLater: 'Price history/.test(src), 'בלי היסטוריה — הודעה ברורה, לא "טוען" לנצח');
ok(/'prev', 'prevClose'/.test(src), 'רשת הביטחון לאגורות מתקנת גם את הסגירה הקודמת');
ok(/if \(state\.stale\) setBanner\(null\);/.test(src), 'מחירים חזרו — ההודעה "לא התקבלו מחירים" יורדת');
console.log('\n' + n + ' בדיקות עברו');
