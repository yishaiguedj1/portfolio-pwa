// pf-v134.test.js — תשואת גרף המניה לפי טווח.
// דיווח (24/09/2026): NOW בטווח "שנה" הראה כ־−25.4% כשהמספר האמיתי ~−26–28%.
// שורשים: (1) filterRange ספר שורות (שנה = 252, שבוע = 5 → 4 ימי שינוי בלבד,
// YTD מהסגירה של יום המסחר הראשון במקום 31/12); (2) הגרף נגמר בשורה האחרונה
// של היסטוריה שמורה (מטמון עד 24 שעות / בזיכרון ללא הגבלה) ולא במחיר החי.
// נתונים סינתטיים בלבד.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
/* v230: תשואת טווחי גרף המניה כמו Google — הכללים נגזרו מהסדרות ש־Google Finance מחזיר (NOW, 28/09/2026) ואומתו
   על 11 מניות (tools/qa-google-ranges.js): 1M/6M/YTD/1Y/5Y זהים עד הסנט. כאן — הכללים על נתונים סינתטיים. */
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
let n = 0;
function ok(cond, name) { n++; if (!cond) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const sb = { localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  document: { addEventListener() {}, getElementById: () => null, querySelectorAll: () => [], querySelector: () => null, createElement: () => ({ classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {} }) },
  window: {}, navigator: {}, location: {}, AbortController, fetch: () => Promise.reject(new Error('no net')), setTimeout, clearTimeout, console };
vm.createContext(sb); vm.runInContext(src, sb);
const A = (k) => vm.runInContext(k, sb);
const RR = A('stockRangeRows');
function weekdays(from, to) {
  const out = []; const t = new Date(from + 'T00:00:00Z'), end = new Date(to + 'T00:00:00Z');
  while (t <= end) { const wd = t.getUTCDay(); if (wd !== 0 && wd !== 6) out.push({ date: t.toISOString().slice(0, 10), close: 100 + out.length }); t.setUTCDate(t.getUTCDate() + 1); }
  return out;
}
const rows = weekdays('2020-01-01', '2026-09-25'); // יום המסחר האחרון: שישי 25/09; "היום" = שני 28/09
const T = '2026-09-28';
ok(RR(rows, 'month', null, T)[0].date === '2026-08-28', '1M: מהיום (28/09) → 28/08 (עד v229: מ־25/09 → 25/08, NOW +6.79% במקום −6.28%)');
ok(RR(rows, '3m', null, T)[0].date === '2026-06-29', '3M: 28/06 ראשון → יום המסחר הראשון אחריו (29/06)');
ok(RR(rows, 'year', null, T)[0].date === '2025-09-29', '1Y: 28/09/2025 ראשון → 29/09 (NOW 188.17 → −27.93% כמו Google)');
ok(RR(rows, '5y', null, T)[0].date === '2021-10-01', '5Y: שבועי — סגירת השבוע של 28/09/2021 (שישי 01/10, NOW 126.56 → +7.16%)');
ok(RR(rows, 'ytd', null, T)[0].date === '2026-01-01', 'YTD: בלי שינוי — יום המסחר הראשון בשנה');
ok(RR(rows, 'month')[0].date === '2026-08-25', 'בלי "היום" — נופל לתאריך האחרון בנתונים (תאימות)');
ok(RR(weekdays('2023-03-01', '2026-09-25'), '5y', null, T)[0].date === '2023-03-01', '5Y למניה צעירה — מהסגירה הראשונה');
ok(A("exchangeTodayIso('LUMI.TA', Date.UTC(2026, 8, 27, 22, 30))") === '2026-09-28' && A("exchangeTodayIso('NOW', Date.UTC(2026, 8, 27, 22, 30))") === '2026-09-27', 'היום בבורסה: ת״א לפי שעון ישראל, ארה״ב לפי ניו־יורק');

// סוף הטווח: אחרי הסגירה — הסגירה הרגילה (Google 135.62, לא אחרי־מסחר 135.60)
const cr = A('stockChartRows')([{ date: '2026-09-24', close: 137.78 }], { close: 135.5961, regClose: 135.62, session: 'closed', mdate: '2026-09-25' });
ok(cr[cr.length - 1].close === 135.62, 'אחרי הסגירה: הסגירה הרגילה, לא מחיר אחרי־המסחר');
const cr2 = A('stockChartRows')([{ date: '2026-09-24', close: 137.78 }], { close: 136.1, regClose: 135.62, session: 'regular', mdate: '2026-09-25' });
ok(cr2[cr2.length - 1].close === 136.1, 'בזמן מסחר: המחיר החי');

// 1D / 5D
const ISR = A('intraSessionRows');
const bars = [
  { date: '2026-09-25', time: '04:00', close: 137 }, { date: '2026-09-25', time: '09:30', close: 137.4, open: 137.25 }, { date: '2026-09-25', time: '16:00', close: 135.62 }, { date: '2026-09-25', time: '19:55', close: 135.6 },
  { date: '2026-09-28', time: '04:00', close: 136.5 }, { date: '2026-09-28', time: '04:35', close: 136.6 }];
const d1 = ISR(bars, 'day', 'NOW');
ok(d1.length === 3 && d1[0].time === '09:30' && d1[2].time === '19:55', '1D בטרום־מסחר של יום חדש: יום המסחר הקודם מ־09:30 (כמו Google) — לא 04:00–04:36 של היום');
const days5 = [];
for (const d of ['2026-09-18', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25']) days5.push({ date: d, time: '09:30', close: 101, open: 100 }, { date: d, time: '15:30', close: 102, open: 101 });
const d5 = ISR(days5, '5d', 'NOW');
ok(d5[0].date === '2026-09-21' && d5[0].close === 100 && d5.length === 11, '5D: חמשת ימי המסחר האחרונים, מתחיל במחיר הפתיחה (כמו Google: META 680 ולא 711)');
ok(/if \(\(state\.range\[sym\] \|\| 'year'\) === 'day' && !state\.stockPick\[sym\] && q1 && typeof q1\.regPct === 'number'/.test(src), '1D בשורת התשואה = השינוי מול הסגירה הקודמת (q.regPct, NOW −1.57%)');
ok(/interval=30m&range=5d/.test(fs.readFileSync(path.join(root, 'ibkr-proxy', 'api', 'history.js'), 'utf8')), 'השרתון: 5D בנרות 30 דקות (כמו Google)');
ok(fs.existsSync(path.join(root, 'tools', 'qa-google-ranges.js')), 'כלי QA מול Google קיים (להריץ אחרי כל שינוי בחישוב)');
console.log('\n' + n + ' בדיקות עברו');
