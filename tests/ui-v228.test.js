// pf-v134.test.js — תשואת גרף המניה לפי טווח.
// דיווח (24/09/2026): NOW בטווח "שנה" הראה כ־−25.4% כשהמספר האמיתי ~−26–28%.
// שורשים: (1) filterRange ספר שורות (שנה = 252, שבוע = 5 → 4 ימי שינוי בלבד,
// YTD מהסגירה של יום המסחר הראשון במקום 31/12); (2) הגרף נגמר בשורה האחרונה
// של היסטוריה שמורה (מטמון עד 24 שעות / בזיכרון ללא הגבלה) ולא במחיר החי.
// נתונים סינתטיים בלבד.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
/* v228: טווחי גרף המניה 1D 5D 1M 3M YTD 1Y (+תפריט 1Y/3Y/5Y), תוך־יומי דרך השרתון (1D היה איטי) וצירי זמן בלי חפיפות */
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
let n = 0;
function ok(cond, name) { n++; if (!cond) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const sb = {
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  document: { addEventListener() {}, getElementById: () => null, querySelectorAll: () => [], querySelector: () => null,
    createElement: () => ({ classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {} }) },
  window: {}, navigator: {}, location: {}, AbortController, fetch: () => Promise.reject(new Error('no net')), setTimeout, clearTimeout, console,
};
vm.createContext(sb);
vm.runInContext(src, sb);
const A = (k) => vm.runInContext(k, sb);

const R = A('RANGES').map((r) => r[0]);
ok(R.join() === 'day,5d,month,3m,ytd,year,3y,5y,max,custom', 'טווחים: 1D 5D 1M 3M YTD 1Y 3Y 5Y + (v229) מקסימום ומתאריך');
ok(A('YEAR_RANGES').join() === 'year,3y,5y,max,custom', 'כפתור השנה מאחד 1Y/3Y/5Y/מקסימום/מתאריך');
// v229: "מתאריך" — הבסיס = הסגירה האחרונה בתאריך שנבחר או לפניו
const days = [{ date: '2024-01-02', close: 10 }, { date: '2024-01-03', close: 11 }, { date: '2024-01-05', close: 12 }, { date: '2024-01-08', close: 13 }];
const cr = A('stockRangeRows')(days, 'custom', '2024-01-04');
ok(cr.length === 3 && cr[0].date === '2024-01-03', 'מתאריך: מתחיל בסגירה האחרונה לפני התאריך (סופ״ש/חג)');
ok(A('stockRangeRows')(days, 'custom', '2020-01-01').length === 4 && A('stockRangeRows')(days, 'max').length === 4, 'מתאריך לפני ההיסטוריה / מקסימום → הכל');
ok(/period1=0&period2=/.test(src) && /wantMax \? 'max'/.test(src), 'מקסימום: period1=0 (range=max של Yahoo = נרות חודשיים), דרך השרתון עם max');
ok(/if \(!force && wantMax && state\.histMax\[sym\]\) return state\.histMax\[sym\];/.test(src), 'היסטוריה מלאה נשמרת בנפרד (נתיבים אחרים מחליפים את state.hist ב־5 שנים)');
ok(/if \(state\.stockPick\[sym\]\) \{/.test(src) && /setStockFrom\(sym, d\)/.test(src), 'נגיעה בגרף במצב בחירה קובעת תאריך התחלה');
ok(/function openStockFromSheet\(sym\)/.test(src) && /inp\.max = todayISO\(\)/.test(src), 'גיליון: סימון בגרף / בחירה מהיומן (עד היום)');
ok(A("t('sr1D')") === '1D' && A("t('sr5D')") === '5D' && A("t('sr1Y')") === '1Y', 'התוויות כמו בצילום (1D, 5D, 1Y)');
ok(/range-year/.test(src) && /data-range="/.test(src) && /closeSrcPops\(\);\s*if \(b\.dataset\.range === 'custom'\) openStockFromSheet\(sym\); else pick\(b\.dataset\.range\)/.test(src), 'תפריט השנה: בחירה סוגרת ומחליפה טווח');
ok(/\.range-year \.src-pop\.range-pop \{ top: auto; bottom: calc\(100% \+ 8px\)/.test(css), 'התפריט נפתח למעלה (בלי top+bottom יחד — בועה מכווצת)');
ok(/\.stock-body \.chip-row\.stock-chips \{ overflow: visible;/.test(css), 'שורת הטווחים בלי גלילה — התפריט לא נחתך');

// תוך־יומי מהשרתון
const m0 = Date.UTC(2025, 7, 15, 16) / 60000;
const rows = A('intraRowsFromProxy')({ t: [m0, m0 + 3, m0 + 5], c: [137, 0, 138] });
ok(rows.length === 2 && rows[0].date === '2025-08-15' && rows[0].time === '16:00' && rows[1].time === '16:05', 'intraRowsFromProxy: דקות בשעון הבורסה → תאריך + שעה');
ok(A('intraRowsFromProxy')({ t: [20000, 20001], c: [1, 2] }).length === 0, 'שרתון ישן (ימים, לא דקות) → ריק, לא גרף של 1970');
const gi = src.slice(src.indexOf('async function getIntraday('), src.indexOf('async function proxyIntraday('));
ok(gi.indexOf('proxyIntraday(') > 0 && gi.indexOf('proxyIntraday(') < gi.indexOf('Promise.any('), 'getIntraday: השרתון קודם, Yahoo ישירות רק כגיבוי (במרוץ)');
ok(/lsSet\(LS_INTRA \+ key/.test(gi), 'getIntraday נשמר במטמון (עד v227 רק נקרא, לא נכתב)');
ok(!/stooqIntradayURL/.test(gi) && !/12000/.test(gi), 'בלי Stooq ובלי המתנות של 12 שניות');

// שרתון
const hist = require(path.join(root, 'ibkr-proxy', 'api', 'history.js'));
const intra = hist._parseIntra({ chart: { result: [{ meta: { gmtoffset: -14400, currency: 'USD' }, timestamp: [1790343000, 1790343300], indicators: { quote: [{ close: [137.5, null] }] } }] } });
ok(intra.t.length === 1 && new Date(intra.t[0] * 60000).toISOString().slice(11, 16) === '09:30', 'שרתון: נרות תוך־יומיים בשעון הבורסה');
console.log('\n' + n + ' בדיקות עברו');
