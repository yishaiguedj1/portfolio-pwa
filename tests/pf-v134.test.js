// pf-v134.test.js — תשואת גרף המניה לפי טווח.
// דיווח (24/09/2026): NOW בטווח "שנה" הראה כ־−25.4% כשהמספר האמיתי ~−26–28%.
// שורשים: (1) filterRange ספר שורות (שנה = 252, שבוע = 5 → 4 ימי שינוי בלבד,
// YTD מהסגירה של יום המסחר הראשון במקום 31/12); (2) הגרף נגמר בשורה האחרונה
// של היסטוריה שמורה (מטמון עד 24 שעות / בזיכרון ללא הגבלה) ולא במחיר החי.
// נתונים סינתטיים בלבד.
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
  document: {
    addEventListener() {}, getElementById: () => null,
    querySelectorAll: () => [], querySelector: () => null,
    createElement: () => ({ classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {} }),
  },
  window: {}, navigator: {}, location: {},
  AbortController, fetch: () => Promise.reject(new Error('no net')),
  setTimeout, clearTimeout, console,
};
vm.createContext(sb);
vm.runInContext(src, sb);
const A = (k) => vm.runInContext(k, sb);
const rangeRows = A('stockRangeRows');
const chartRows = A('stockChartRows');

// ימי חול בלבד, מחיר = אינדקס השורה + 100 (כדי לזהות שורות לפי מחיר)
function weekdays(from, to) {
  const out = [];
  const t = new Date(from + 'T00:00:00Z'), end = new Date(to + 'T00:00:00Z');
  while (t <= end) {
    const wd = t.getUTCDay();
    if (wd !== 0 && wd !== 6) out.push({ date: t.toISOString().slice(0, 10), close: 100 + out.length });
    t.setUTCDate(t.getUTCDate() + 1);
  }
  return out;
}
const rows = weekdays('2024-01-01', '2026-09-24'); // 24/09/2026 = יום חמישי
const last = rows[rows.length - 1];

// --- 1. בסיס לפי תאריך לוח שנה ---
const yr = rangeRows(rows, 'year');
ok(yr[0].date === '2025-09-24', 'שנה: הבסיס = הסגירה של אותו יום לפני שנה');
ok(yr[yr.length - 1] === last, 'שנה: נגמר בשורה האחרונה');
ok(A('filterRange')(rows, 'year')[0].date > '2025-09-24', 'מתועד: 252 שורות אחורה מתחיל אחרי "לפני שנה" (הבאג)');

const wk = rangeRows(rows, 'week');
ok(wk[0].date === '2026-09-17' && wk.length === 6, 'שבוע: בסיס = לפני 7 ימים → 5 ימי שינוי (הישן: 4)');

const mo = rangeRows(rows, 'month');
ok(mo[0].date === '2026-08-24', 'חודש: בסיס = אותו יום בחודש הקודם');

const ytd = rangeRows(rows, 'ytd');
ok(ytd[0].date === '2025-12-31', 'YTD: בסיס = סגירת 31/12 (הישן: יום המסחר הראשון בשנה)');

const y5 = rangeRows(rows, '5y');
ok(y5[0] === rows[0], '5 שנים כשאין מספיק היסטוריה: הכל');
ok(rangeRows(rows, 'max').length === rows.length, 'מקסימום: הכל');
ok(rangeRows([], 'year').length === 0, 'מערך ריק לא קורס');

// תאריך החיתוך נופל בסופ"ש → הסגירה של יום שישי שלפניו
const sat = weekdays('2025-01-01', '2026-09-21'); // 21/09/2026 שני → לפני שנה = 21/09/2025 ראשון
ok(rangeRows(sat, 'year')[0].date === '2025-09-19', 'חיתוך בסופ"ש: הסגירה האחרונה לפניו (שישי)');

// --- 2. נקודת הסיום = המחיר החי ---
const stale = rows.slice(0, -5); // היסטוריה שמורה שנגמרת לפני שבוע
const q = { close: 50, date: '2026-09-24', mdate: '2026-09-24', session: 'regular' };
const cr = chartRows(stale, q);
ok(cr.length === stale.length + 1 && cr[cr.length - 1].close === 50 && cr[cr.length - 1].date === '2026-09-24',
  'היסטוריה ישנה: מוסיפים את המחיר החי כנקודת הסיום');
ok(stale.length === rows.length - 5, 'לא משנה את מערך ההיסטוריה המקורי');

const same = chartRows(rows, q);
ok(same.length === rows.length && same[same.length - 1].close === 50, 'אותו יום: מחליפים את הסגירה, לא מכפילים יום');
ok(rows[rows.length - 1].close !== 50, 'ההחלפה לא נוגעת בשורה המקורית');

// אחרי חצות בישראל: date כבר מחר, mdate (שעון הבורסה) עדיין היום
const night = chartRows(rows, { close: 51, date: '2026-09-25', mdate: '2026-09-24', session: 'post' });
ok(night.length === rows.length && night[night.length - 1].date === '2026-09-24', 'אחרי חצות: תאריך הבורסה, לא יום מזויף מחר');

ok(chartRows(rows, { close: 52, date: '2026-09-25', mdate: '2026-09-25', session: 'pre' }).length === rows.length,
  'טרום־מסחר: לא מוסיפים יום שעוד לא נסחר');
ok(chartRows(rows, null).length === rows.length, 'בלי ציטוט: ההיסטוריה כמו שהיא');

// --- 3. מקצה לקצה: התשואה מהבסיס הנכון עד המחיר החי ---
const e2e = rangeRows(chartRows(stale, q), 'year');
const base = rows.find((r) => r.date === '2025-09-24');
ok(e2e[0] === base && e2e[e2e.length - 1].close === 50, 'שנה: מסגירת לפני שנה עד המחיר החי');

// --- 4. תאריך הבורסה בציטוט Yahoo ---
const pq = A('parseYahooQuote')({ chart: { result: [{
  meta: { regularMarketPrice: 137.78, regularMarketTime: 1790280003, gmtoffset: -14400 },
  indicators: { quote: [{ close: [137.78] }] },
}] } }, 'X', 1790280003000);
ok(pq && pq.mdate === '2026-09-24', 'parseYahooQuote: mdate לפי שעון הבורסה (EDT)');
ok(A('daysBetweenIso')('2026-09-17', '2026-09-24') === 7, 'daysBetweenIso');

// --- 5. חיווט ---
ok(/stockRangeRows\(rows, range === 'day' \? 'month' : range\)/.test(src), 'ensureChartData משתמש בטווח לפי תאריך');
ok(/stockChartRows\(hist, state\.quotes\[sym\]\)/.test(src), 'ensureChartData מוסיף את המחיר החי');

const ver = (src.match(/APP_VERSION = '(v\d+)'/) || [])[1];
ok(fs.readFileSync(path.join(root, 'sw.js'), 'utf8').includes('portfolio-pwa-' + ver), 'CACHE_NAME תואם לגרסה');

console.log('\n' + n + ' בדיקות עברו');
